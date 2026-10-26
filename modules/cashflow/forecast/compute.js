// modules/cashflow/forecast/compute.js -- PURE. Where the usable cash is heading, day by day,
// for the next 90 days: today's balances of the everyday accounts, then every expected
// payment (found in the transactions) and the bills and pay typed on Expenses and Income,
// each on its next dates. The point is the lowest day: is there a shortfall coming?
import { compute as computeRecurring, nextAfter, addDays } from "../recurring/compute.js";
import { normalizePayee } from "../../transactions/rules/compute.js";
import { countedBalance } from "../../balance/net-worth/compute.js";

const EVERYDAY = new Set(["checking", "savings", "cash"]);
const periodToCadence = { weekly: "weekly", biweekly: "biweekly", semimonthly: "semimonthly", monthly: "monthly", quarterly: "quarterly", annual: "annual" };

/** Dates on which an item typed on Income/Expenses falls between `from` and `to`: from its start date's day, else the 1st (bills) or the 15th (pay). */
export function plannedDates(item, from, to) {
  const cadence = periodToCadence[item.period];
  if (!cadence) return [];
  let anchor = item.startDate && /^\d{4}-\d{2}-\d{2}$/.test(item.startDate) ? item.startDate : `${from.slice(0, 7)}-${item.kind === "income" ? "15" : "01"}`;
  if (String(anchor) > to) return [];
  const out = [];
  let d = String(anchor) > from ? anchor : nextAfter(anchor, cadence, addDays(from, -1));
  for (let i = 0; i < 400 && d && String(d) <= to; i++) { if (String(d) >= from && (!item.endDate || String(d) <= item.endDate)) out.push(d); d = nextAfter(d, cadence, d); }
  return out;
}

/**
 * compute(plan, { today, days = 90, accountId = "" }) -> {
 *   accounts: [{ id, name, balance }] (everyday accounts), start, days: [{ date, balance, events: [{ name, amount, source }] }],
 *   lowest: { date, balance }, end: balance, shortfallDate | null, income, spending (over the horizon), events (count),
 *   sources: { found, planned, skipped } (how many items from each list; typed items that match a found payee are skipped), hasData
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const horizon = Math.max(7, Number(params.days ?? 90));
  const everyday = (plan.accounts ?? []).filter((a) => EVERYDAY.has(a.type) && (!params.accountId || a.id === params.accountId)).map((a) => ({ id: a.id, name: a.name, balance: countedBalance(a) }));
  if (!today || !everyday.length) return { accounts: everyday, start: 0, days: [], lowest: null, end: 0, shortfallDate: null, income: 0, spending: 0, events: 0, sources: { found: 0, planned: 0, skipped: 0 }, hasData: false };
  const ids = new Set(everyday.map((a) => a.id));
  const start = everyday.reduce((s, a) => s + a.balance, 0);
  const to = addDays(today, horizon);
  const rec = computeRecurring(plan, { today });
  const events = [];
  // 1. payments found in the transactions, on their next dates (skipping the everyday-account filter when one account is chosen)
  const foundKeys = new Set(), found = [];
  for (const r of rec.detected) {
    if (!ids.has(r.accountId)) continue;
    foundKeys.add(normalizePayee(r.rawPayee ?? r.payee)); found.push(r);
    let d = r.next;
    for (let i = 0; i < 60 && d && String(d) <= to; i++) { if (String(d) >= today) events.push({ date: d, name: r.payee, amount: r.amount, source: "found" }); d = nextAfter(d, r.cadence, d); }
  }
  // 2. bills and pay typed on the pages, unless a found payment already covers them (same words)
  let skipped = 0, plannedN = 0;
  const typed = [
    ...(plan.expenses ?? []).filter((e) => e.period !== "once").map((e) => ({ ...e, kind: "expense", signed: -(Number(e.amount) || 0) })),
    ...(plan.income ?? []).filter((i) => i.period !== "once").map((i) => ({ ...i, kind: "income", signed: Number(i.amount) || 0 })),
  ];
  for (const item of typed) {
    // covered when a found payment shares a word with it, or has the same amount and rhythm (typed "Pay" vs found payroll)
    const words = normalizePayee(item.name).split(" ").filter((w) => w.length > 3);
    const sameMoney = found.some((r) => r.cadence === periodToCadence[item.period] && Math.sign(r.amount) === Math.sign(item.signed) && Math.abs(Math.abs(r.amount) - Math.abs(item.signed)) <= 0.02 * Math.abs(item.signed));
    const covered = (words.length && [...foundKeys].some((k) => words.some((w) => k.includes(w)))) || sameMoney;
    if (covered) { skipped++; continue; }
    const dates = plannedDates(item, today, to);
    if (dates.length) plannedN++;
    for (const d of dates) events.push({ date: d, name: item.name, amount: item.signed, source: "planned" });
  }
  // 3. one-time items with a date inside the horizon
  for (const e of plan.expenses ?? []) if (e.period === "once" && e.startDate && e.startDate >= today && e.startDate <= to) events.push({ date: e.startDate, name: e.name, amount: -(Number(e.amount) || 0), source: "planned" });
  for (const i of plan.income ?? []) if (i.period === "once" && i.startDate && i.startDate >= today && i.startDate <= to) events.push({ date: i.startDate, name: i.name, amount: Number(i.amount) || 0, source: "planned" });

  const byDate = new Map();
  for (const ev of events) (byDate.get(ev.date) ?? byDate.set(ev.date, []).get(ev.date)).push(ev);
  const days = [];
  let balance = start, lowest = { date: today, balance: start }, shortfallDate = null, income = 0, spending = 0;
  for (let i = 0; i <= horizon; i++) {
    const date = addDays(today, i);
    const evs = byDate.get(date) ?? [];
    for (const ev of evs) { balance += ev.amount; if (ev.amount > 0) income += ev.amount; else spending += -ev.amount; }
    balance = Math.round(balance * 100) / 100;
    days.push({ date, balance, events: evs });
    if (balance < lowest.balance) lowest = { date, balance };
    if (balance < 0 && !shortfallDate) shortfallDate = date;
  }
  return { accounts: everyday, start, days, lowest, end: balance, shortfallDate, income, spending, events: events.length, sources: { found: rec.detected.filter((r) => ids.has(r.accountId)).length, planned: plannedN, skipped }, hasData: true };
}

// modules/cashflow/forecast/compute.js -- PURE. Where the usable cash is heading, day by day,
// for the next 90 days: today's balances of the everyday accounts, then every expected
// payment (found in the transactions) and the bills and pay typed on Expenses and Income,
// each on its next dates. Pay lands as take-home (what reaches the bank), and loan and card
// payments kept only on Debts are paid too, as on the Expenses page. The point is the lowest
// day: is there a shortfall coming?
import { compute as computeRecurring, nextAfter, addDays } from "../recurring/compute.js";
import { normalizePayee } from "../../transactions/rules/compute.js";
import { countedBalance } from "../../balance/net-worth/compute.js";
import { takeHome } from "../paycheck/compute.js";
import { compute as computeExpenses } from "../expenses/compute.js";
import { compute as computeLiabilities } from "../../balance/liabilities/compute.js";
import { perYear } from "../../../core/math/periods.js";

/** Words in a bank line that mark a deposit as pay (a payroll deposit names the employer, not the person). */
export const PAY_WORDS = /\b(payroll|salary|direct ?dep(osit)?|dir ?dep|directdep|paycheck|wages?|pay ?roll)\b/i;
/** A found pay deposit covers a typed salary when its yearly total is within this share of the salary's take-home. */
export const PAY_BAND = 0.25;
/** Without a take-home share (pay typed before tax but tied to nobody, or typed after tax), a deposit covers a salary when its yearly total is this share of the typed figure: at most a little over it, at least half. */
export const TYPED_BAND = [0.5, 1.05];
/** Words in a debt's name that every loan shares; they never tie a bank payment to one debt ("loan" in "student loan pmt" is not the car loan). */
const DEBT_WORDS = new Set(["loan", "loans", "card", "cards", "credit", "payment", "payments", "pmt", "auto", "student", "mortgage", "line", "account", "personal", "the", "and"]);

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
 *   sources: { found, planned, skipped } (how many items from each list; typed items that match a found payee are skipped), hasData,
 *   takeHome: true when typed pay was turned into take-home (events then carry `beforeTax`, the typed amount), debtFromDebts (a month),
 *   payBeforeTax: some typed pay lands before tax (no take-home share), payUnlinked: some of it is tied to no adult
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
  const keyOf = (r) => normalizePayee(r.rawPayee ?? r.payee);
  for (const r of rec.detected) {
    if (!ids.has(r.accountId)) continue;
    foundKeys.add(keyOf(r)); found.push(r);
    // the first date after the last line, when that is today or later (recurring's next date is after today, so a payday due today was lost)
    const first = nextAfter(r.last, r.cadence, r.last);
    let d = !r.missed && first && String(first) >= today ? first : r.next;
    for (let i = 0; i < 60 && d && String(d) <= to; i++) { if (String(d) >= today) events.push({ date: d, name: r.payee, amount: r.amount, source: "found" }); d = nextAfter(d, r.cadence, d); }
  }
  // 2. bills and pay typed on the pages, unless a found payment already covers them (same words). Pay is typed before
  // tax; the bank sees take-home, so each salary lands at its earner's take-home share (Paycheck page). Loan and card
  // payments kept only on the Debts page are paid on the 1st, exactly when the Expenses page counts them (nothing filed
  // under loan and card payments there; the mortgage left out when it is filed under housing).
  let skipped = 0, plannedN = 0, plannedFromDebts = 0;
  const th = (plan.income ?? []).length ? takeHome(plan, { today }) : { ready: false, ratio: {} };
  const exp = (plan.expenses ?? []).length || (plan.debts ?? []).length ? computeExpenses(plan, { today }) : null;
  const debtRows = exp?.debtFromDebts > 0 ? debtLines(plan, today, exp) : [];
  const typed = [
    ...(plan.expenses ?? []).filter((e) => e.period !== "once").map((e) => ({ ...e, kind: "expense", signed: -(Number(e.amount) || 0) })),
    ...debtRows,
    ...(plan.income ?? []).filter((i) => i.period !== "once").map((i) => {
      const typedAmount = Number(i.amount) || 0, r = th.ratio[i.id];
      return r !== undefined && r < 1 ? { ...i, kind: "income", signed: typedAmount * r, beforeTax: typedAmount } : { ...i, kind: "income", signed: typedAmount };
    }),
  ];
  // A found pay deposit covers one typed salary. First pass: the salary whose take-home it is closest to, within PAY_BAND
  // (so a deposit near one earner's take-home is never given to the other earner whose pay before tax happens to be near
  // it). Second pass, for what is left: the typed figure, a deposit at most a little over it and at least half of it
  // (TYPED_BAND), for pay typed after tax or pay without a take-home share. Closest pairs first; each deposit and salary once.
  const payFound = found.filter((r) => r.amount > 0 && (PAY_WORDS.test(r.rawPayee ?? r.payee ?? "") || String(r.category ?? "") === "income-salary"));
  // only pay with a payday in the days ahead can own a deposit: an ended job never takes the new job's deposit
  const salaries = typed.filter((item) => item.kind === "income" && item.type === "salary" && perYear(item.signed, item.period) > 0 && plannedDates(item, today, to).length > 0);
  const payCovered = new Set(), payUsed = new Set();
  const pairUp = (offOf) => {
    const pairs = [];
    for (const item of salaries) if (!payCovered.has(item)) for (const r of payFound) if (!payUsed.has(r)) { const off = offOf(item, perYear(r.amount, r.cadence)); if (off !== null) pairs.push({ item, r, off }); }
    for (const pr of pairs.sort((a, b) => a.off - b.off)) if (!payCovered.has(pr.item) && !payUsed.has(pr.r)) { payCovered.add(pr.item); payUsed.add(pr.r); }
  };
  pairUp((item, y) => { if (item.beforeTax === undefined) return null; const want = perYear(item.signed, item.period), off = Math.abs(y - want) / want; return off <= PAY_BAND ? off : null; });
  pairUp((item, y) => { const asTyped = perYear(item.beforeTax ?? item.signed, item.period), share = y / asTyped; return share >= TYPED_BAND[0] && share <= TYPED_BAND[1] ? Math.abs(share - 0.75) : null; });
  // pay deposits are matched only by the pairing above; their words ("salary", "payroll") would otherwise cover every typed salary
  const otherKeys = [...new Set(found.filter((r) => !payFound.includes(r)).map(keyOf))];
  for (const item of typed) {
    // covered when a found payment shares a word with it, or has the same amount and rhythm (typed "Pay" vs found payroll)
    const isPay = salaries.includes(item);
    const words = item.words ?? normalizePayee(item.name).split(" ").filter((w) => w.length > 3);
    const pool = isPay ? found.filter((r) => !payFound.includes(r)) : found;
    const sameMoney = pool.some((r) => r.cadence === periodToCadence[item.period] && Math.sign(r.amount) === Math.sign(item.signed) && Math.abs(Math.abs(r.amount) - Math.abs(item.signed)) <= 0.02 * Math.abs(item.signed));
    const keys = isPay ? otherKeys : [...foundKeys];
    const covered = (words.length && keys.some((k) => words.some((w) => k.includes(w)))) || sameMoney || payCovered.has(item);
    if (covered) { skipped++; continue; }
    const dates = plannedDates(item, today, to);
    if (dates.length) { if (item.fromDebts) plannedFromDebts++; else plannedN++; }
    // a salary that lands as typed (no take-home share: tied to nobody and no earner to borrow a share from) is marked, so the page can say so
    const asTyped = isPay && item.beforeTax === undefined && th.ratio[item.id] === undefined;
    const unlinked = asTyped && !(plan.household?.people ?? []).some((q) => q.id === item.personId && q.role !== "dependent");
    for (const d of dates) events.push({ date: d, name: item.name, amount: item.signed, source: "planned", ...(item.beforeTax !== undefined ? { beforeTax: item.beforeTax } : {}), ...(item.fromDebts ? { fromDebts: true } : {}), ...(asTyped ? { payBeforeTax: true } : {}), ...(unlinked ? { payUnlinked: true } : {}) });
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
  const evAll = events.filter((e) => e.source === "planned");
  return { accounts: everyday, start, days, lowest, end: balance, shortfallDate, income, spending, events: events.length, sources: { found: rec.detected.filter((r) => ids.has(r.accountId)).length, planned: plannedN, fromDebts: plannedFromDebts, skipped }, hasData: true,
    takeHome: evAll.some((e) => e.beforeTax !== undefined), payBeforeTax: evAll.some((e) => e.payBeforeTax), payUnlinked: evAll.some((e) => e.payUnlinked), debtFromDebts: exp?.debtFromDebts ?? 0 };
}

/**
 * The Debts page's monthly payments the Expenses page adds (its `debtFromDebts`): each debt still owed with a payment, until its
 * payoff month (the Debts page's own date), the mortgage left out when it is filed under housing. Each line carries the words that
 * tie it to a bank payment: its account's name and lender, without the words every loan shares (DEBT_WORDS).
 */
function debtLines(plan, today, exp) {
  const specific = (r) => [...new Set(normalizePayee(`${r.name ?? ""} ${r.institution ?? ""}`).split(" ").filter((w) => w.length > 2 && !DEBT_WORDS.has(w)))];
  const line = (r) => ({ id: `debt-${r.id}`, name: `${r.name || r.typeLabel} payment`, period: "monthly", kind: "expense", signed: -r.payment, fromDebts: true, words: specific(r), ...(r.payoffDate ? { endDate: r.payoffDate } : {}) });
  const all = computeLiabilities(plan, { today }).rows.filter((r) => r.payment > 0);
  const total = (list) => list.reduce((t, r) => t + r.payment, 0);
  // the same total the Expenses page adds, whichever way it left the mortgage out; then only debts still owed are paid
  const pick = Math.abs(total(all) - exp.debtFromDebts) <= 0.5 ? all : all.filter((r) => r.type !== "mortgage");
  if (Math.abs(total(pick) - exp.debtFromDebts) > 0.5) return [{ id: "debt-all", name: "Loan and card payments (from Debts)", period: "monthly", kind: "expense", signed: -exp.debtFromDebts, fromDebts: true, words: [] }];
  return pick.filter((r) => r.owed > 0).map(line);
}

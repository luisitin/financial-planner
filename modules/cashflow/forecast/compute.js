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
import { compute as computePayoff } from "../../debt/payoff/compute.js";
import { perYear, payRhythm } from "../../../core/math/periods.js";
import { countedOn } from "../income/compute.js";
import { compute as computeEstimated, QUARTERS } from "../../taxes/estimated/compute.js";

/** Words in a bank line that mark a deposit as pay (a payroll deposit names the employer, not the person). */
export const PAY_WORDS = /\b(payroll|salary|direct ?dep(osit)?|dir ?dep|directdep|paycheck|wages?|pay ?roll)\b/i;
/** A found pay deposit covers a typed salary when its yearly total is within this share of the salary's take-home. */
export const PAY_BAND = 0.25;
/** Without a take-home share (pay typed before tax but tied to nobody, or typed after tax), a deposit covers a salary when its yearly total is this share of the typed figure: at most a little over it, at least half. */
export const TYPED_BAND = [0.5, 1.05];
/** Words in a debt's name that every loan shares; they never tie a bank payment to one debt ("loan" in "student loan pmt" is not the car loan). */
const DEBT_WORDS = new Set(["loan", "loans", "card", "cards", "credit", "payment", "payments", "pmt", "auto", "student", "mortgage", "line", "account", "personal", "the", "and"]);
/** Words in a typed income's name that many bank lines share ("Dee's business" is not covered by a "Comcast Business" bill). */
const INCOME_WORDS = new Set(["business", "income", "work", "freelance", "consulting", "side", "self", "salary", "wages", "from", "with", "monthly", "weekly", "yearly"]);
/**
 * A bank line that pays federal income tax (IRS Direct Pay and EFTPS show as "IRS USATAXPYMT"; a 1040-ES payment). A state's
 * payment (a revenue department, California's Franchise Tax Board) never pays the federal quarters, so it is not one
 * (review 2026-11-02: an $800 franchise-tax fee took $11,200 of federal estimates out of the forecast).
 */
export const FEDERAL_TAX_WORDS = /\b(irs|usataxpymt|usa ?tax|eftps|treas(ury)? tax|1040 ?es)\b/i;
/**
 * A typed bill's name for a tax that is not the income tax: the word just before "tax" ("Property tax", "Car tax",
 * "Quarterly payroll tax", "Sales tax"), so "Auto-pay estimated tax" and "Federal estimated tax (home business)" are not it
 * (review 2026-11-02, round 5: the words alone took those as property or car tax), or a fee for filing ("Tax preparer").
 */
const OTHER_TAX_NAME = /\b(property|real estate|estate|home|house|council|school|vehicle|car|auto|road|sales|use|excise|payroll|franchise|hotel|occupancy|lodging|tourism|gift|inheritance|wealth)\s+tax/i;
const TAX_FEE_NAME = /\b(prep|preparation|preparer|preparing|accountant|cpa|bookkeep\w*|software|filing|registration|licen[cs]e|permit)\b/i;
/** A typed bill's name for a debt to the tax office that no other word turns into this year's estimates: an agreement, back taxes, a penalty, interest, a lien or levy, last year's. */
const TAX_DEBT_NAME = /\b(agreement|back\s+tax(es)?|penalty|penalties|interest|levy|lien|debt|arrears|last year'?s?|prior year'?s?)\b/i;
/**
 * Softer debt words (a payment plan, what is owed, a balance): a debt to the tax office unless the name also says estimated,
 * estimate or 1040-ES (SAYS_ESTIMATE): "Estimated tax installments" is this year's (installment is the IRS's own word for
 * the 1040-ES payments), "IRS payment plan" is not (review 2026-11-02, round 5, third pass).
 */
const TAX_SOFT_DEBT_NAME = /\b(plan|installments?|instalments?|owed?|owing|balance)\b/i;
/** A name that says estimated or estimate anywhere ("Quarterly installment - estimated tax", "Est. tax"), or 1040-ES. */
const SAYS_ESTIMATE = /\bestimat(e|es|ed)\b|\best\.?\s+tax|\b1040.?es\b/i;
/** A state's or a city's tax office or name: its estimated tax never pays the federal quarters ("NY" and "CA" only in capitals: "in", "or", "me" are words). */
const STATE_NAMES = "alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|district of columbia";
/** A department of revenue is always a state's (the federal one is the Internal Revenue Service); "revenue" alone is a state's only when the name does not say estimated ("Estimated tax on revenue" is the business's). */
const STATE_NAME = new RegExp(`\\b(state|states|${STATE_NAMES}|ftb|franchise|(dept|department)\\.?\\s+of\\s+revenue|revenue\\s+(dept|department|agency|office)|taxation|comptroller|dor|city|local|county|municipal|borough|township|nyc|nys|school\\s+district)\\b`, "i");
const REVENUE_WORD = /\brevenue\b/i;
const STATE_CODE = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/;
/** A typed bill's name that pays the federal tax office ("Internal Revenue" wins over the state word "revenue"). */
const FEDERAL_NAME = /\b(federal|fed|irs|internal revenue|usataxpymt|eftps|treas(ury)?|us ?tax|1040(.?es)?)\b/i;
/** A name that says estimated or quarterly tax ("Quarterly estimated taxes", "Est. tax", "1040-ES"). */
const ESTIMATES_NAME = /(\b(estimated|estimates?|quarterly)|\best\.?)\s+((federal|fed|us|income)\s+)*tax|\b1040.?es\b/i;

const EVERYDAY = new Set(["checking", "savings", "cash"]);
const periodToCadence = { weekly: "weekly", biweekly: "biweekly", semimonthly: "semimonthly", monthly: "monthly", quarterly: "quarterly", annual: "annual" };

/** A date that is one of the 1040-ES due dates (April 15, June 15, September 15, January 15, or the day taxes/estimated moves one to off a weekend or holiday); `later`: not April 15, which may be last year's balance. */
export function irsDueDay(date, later = false) {
  const d = String(date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  if ((later ? /-(01|06|09)-15$/ : /-(01|04|06|09)-15$/).test(d)) return true;
  const y = Number(d.slice(0, 4));
  return [...QUARTERS(y).slice(later ? 1 : 0, 3), QUARTERS(y - 1)[3]].some((q) => q.due === d);
}

/** The 1040-ES due dates (taxes/estimated's QUARTERS) between `from` and `to`, none before `start` or after `end`. */
export function irsDates(from, to, start = "", end = "") {
  const out = new Set();
  for (let y = Number(String(from).slice(0, 4)) - 1; y <= Number(String(to).slice(0, 4)); y++) for (const q of QUARTERS(y)) {
    if (q.due >= from && q.due <= to && (!start || q.due >= start) && (!end || q.due <= end)) out.add(q.due);
  }
  return [...out].sort();
}

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
  // `ahead`: the tax payments this forecast already has in the days ahead (the bank's own, found on their rhythm, and
  // the tax bills typed on Expenses), so the estimated tax lines are not taken a second time
  const found = [], ahead = [];
  const keyOf = (r) => normalizePayee(r.rawPayee ?? r.payee);
  for (const r of rec.detected) {
    if (!ids.has(r.accountId)) continue;
    found.push(r);
    // the first date after the last line, when that is today or later (recurring's next date is after today, so a payday due today was lost)
    const first = nextAfter(r.last, r.cadence, r.last);
    let d = !r.missed && first && String(first) >= today ? first : r.next;
    for (let i = 0; i < 60 && d && String(d) <= to; i++) { if (String(d) >= today) { events.push({ date: d, name: r.payee, amount: r.amount, source: "found" }); ahead.push({ date: d, amount: r.amount, payee: r.payee, rawPayee: r.rawPayee }); } d = nextAfter(d, r.cadence, d); }
  }
  // 2. bills and pay typed on the pages, unless a found payment already covers them (same words). Pay is typed before
  // tax; the bank sees take-home, so each salary lands at its earner's take-home share (Paycheck page). Loan and card
  // payments kept only on the Debts page are paid on the 1st, exactly when the Expenses page counts them (nothing filed
  // under loan and card payments there; the mortgage left out when it is filed under housing).
  let skipped = 0, plannedN = 0, plannedFromDebts = 0;
  const th = (plan.income ?? []).length ? takeHome(plan, { today }) : { ready: false, ratio: {} };
  const exp = (plan.expenses ?? []).length || (plan.debts ?? []).length ? computeExpenses(plan, { today }) : null;
  const debtRows = exp?.debtFromDebts > 0 ? debtLines(plan, today, exp) : [];
  const planRow = (plan.debts ?? []).length ? debtPlanLine(plan, today) : null;
  const typed = [
    ...(plan.expenses ?? []).filter((e) => e.period !== "once").map((e) => ({ ...e, kind: "expense", signed: -(Number(e.amount) || 0) })),
    ...debtRows,
    ...(planRow ? [planRow] : []),
    ...(plan.income ?? []).filter((i) => i.period !== "once").map((i0) => {
      // a salary typed as a yearly figure lands as paychecks (the Paycheck page's count), not one deposit a year
      // uneven pay counted carefully (Side income's "count on"): the forecast plans with that figure, a month
      const careful = countedOn(i0) !== null ? { ...i0, amount: countedOn(i0), period: "monthly" } : null;
      // business or freelance income typed as a year (setup asks for "a typical year") comes in through the year, not in one
      // deposit on one day: it lands a month at a time (round 4, 2026-11-02)
      // only setup's own record ("a typical year", asked of someone paid by their own business): a once-a-year payment typed
      // on Income (a retainer, a royalty) still lands on its date (review 2026-11-02). The record keeps it after an edit on
      // Income that starts a new amount later (its new part carries `typicalYear: true`; review 2026-11-02, round 5)
      const typicalYear = i0.typicalYear === true || String(i0.id ?? "").startsWith("setup-pay-");
      const spread = !careful && i0.type === "business" && typicalYear && (i0.period === "annual" || i0.period === "quarterly") ? { ...i0, amount: perYear(i0.amount, i0.period) / 12, period: "monthly" } : null;
      const rh = careful || spread ? null : payRhythm(i0, plan), i = careful ?? spread ?? (rh ? { ...i0, period: rh.period, amount: rh.perPay } : i0);
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
  // pay deposits are matched only by the pairing above; their words ("salary", "payroll") would otherwise cover every typed
  // salary, so a salary's pool leaves them out
  for (const item of typed) {
    // covered when a found payment shares a word with it, or has the same amount and rhythm (typed "Pay" vs found payroll)
    const isPay = salaries.includes(item);
    const words = item.words ?? normalizePayee(item.name).split(" ").filter((w) => w.length > 3 && !(item.kind === "income" && INCOME_WORDS.has(w)));
    const pool = isPay ? found.filter((r) => !payFound.includes(r)) : found;
    const sameMoney = pool.some((r) => r.cadence === periodToCadence[item.period] && Math.sign(r.amount) === Math.sign(item.signed) && Math.abs(Math.abs(r.amount) - Math.abs(item.signed)) <= 0.02 * Math.abs(item.signed));
    // only a bank line going the same way can cover it: an outgoing bill never covers an income, nor the reverse (review 2026-11-02)
    const keys = [...new Set(pool.filter((r) => Math.sign(r.amount) === Math.sign(item.signed)).map(keyOf))];
    const covered = (words.length && keys.some((k) => words.some((w) => k.includes(w)))) || sameMoney || payCovered.has(item);
    if (covered) { skipped++; continue; }
    // the person's own quarterly bill for the federal estimates, with no date or dated on a due date, is paid on the IRS's
    // dates (January 15, April 15, June 15, September 15), not on the 1st or every three months: its payments then meet
    // the quarter lines they pay (review 2026-11-02, round 5, third pass: an undated one fell on February 1, moving with today)
    const taxBill = item.kind === "expense" && !item.fromDebts && typedIncomeTax(item);
    const dated = /^\d{4}-\d{2}-\d{2}$/.test(String(item.startDate ?? ""));
    const dates = taxBill && item.period === "quarterly" && (!dated || irsDueDay(item.startDate)) ? irsDates(today, to, dated ? item.startDate : "", item.endDate || "") : plannedDates(item, today, to);
    if (dates.length) { if (item.fromDebts) plannedFromDebts++; else plannedN++; }
    // a salary that lands as typed (no take-home share: tied to nobody and no earner to borrow a share from) is marked, so the page can say so
    const asTyped = isPay && item.beforeTax === undefined && th.ratio[item.id] === undefined;
    const unlinked = asTyped && !(plan.household?.people ?? []).some((q) => q.id === item.personId && q.role !== "dependent");
    for (const d of dates) events.push({ date: d, name: item.name, amount: item.signed, source: "planned", ...(item.beforeTax !== undefined ? { beforeTax: item.beforeTax } : {}), ...(item.fromDebts ? { fromDebts: true } : {}), ...(asTyped ? { payBeforeTax: true } : {}), ...(unlinked ? { payUnlinked: true } : {}) });
    if (taxBill) for (const d of dates) ahead.push({ date: d, amount: item.signed, payee: item.name, typedTax: true });
  }
  // 3. one-time items with a date inside the horizon
  for (const e of plan.expenses ?? []) if (e.period === "once" && e.startDate && e.startDate >= today && e.startDate <= to) {
    events.push({ date: e.startDate, name: e.name, amount: -(Number(e.amount) || 0), source: "planned" });
    if (typedIncomeTax(e)) ahead.push({ date: e.startDate, amount: -(Number(e.amount) || 0), payee: e.name, typedTax: true });
  }
  for (const i of plan.income ?? []) if (i.period === "once" && i.startDate && i.startDate >= today && i.startDate <= to) events.push({ date: i.startDate, name: i.name, amount: Number(i.amount) || 0, source: "planned" });
  // 4. a freelancer's estimated tax (Quarterly payments): business income lands before its tax, so the tax goes out on the
  // quarters' due dates (review 2026-11-02: it was left out, and the forecast ran thousands high)
  for (const ev of estimatedLines(plan, today, to, ahead)) events.push(ev);

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
 * estimatedLines(plan, today, to, ahead = []) -> planned events for the estimated tax payments between today and `to`: what
 * is past due, today (named "if not paid yet" when no payment was ever typed), then each quarter on its due date, the part
 * of it not paid yet (taxes/estimated: cumulative share less what is paid and what is counted before it). `ahead` is the
 * payments the forecast already has in the days ahead ([{ date, amount, payee, rawPayee, typedTax? }]): the bank's federal
 * ones (FEDERAL_TAX_WORDS) and the person's own tax bills typed on Expenses (`typedTax`, typedIncomeTax) pay these lines,
 * each only the lines due on or after its own date, the latest first, so nothing is taken twice and nothing leaves later
 * than its due date; a typed bill that lands after the days ahead takes nothing off (review 2026-11-02, round 5: any typed
 * tax bill dropped every line, an IRS payment plan or a state's tax too; third pass: a February 1 bill paid January 15's).
 * None when (review 2026-11-02, round 5):
 *   - no business or freelance income comes in today (taxOwedNow's test: one that starts next year does not count), and
 *     for last year's lines none came in during last year;
 *   - the return needs no quarterly payments, or pay withholds at least half of the year's tax (taxOwedNow's gate: the
 *     Withholding check page and the April bill are the answer there, and that withholding is often estimated from pay).
 * Paid: what was typed on Estimated payments; with nothing typed, the bank's federal tax payments in that tax year
 * (taxPaidInBank: January 16 to April 15 counted up to the 1st quarter, later lines in full). Only this tax year's quarters,
 * and on January 1 to 15 also last year's 4th quarter, due January 15 (when the Federal estimate's year is not set): the
 * next year's April payment is past a 90-day horizon.
 */
export function estimatedLines(plan, today, to, ahead = []) {
  if (!today) return [];
  // business or freelance income at some point between `a` and `b` (started by `b`, not ended before `a`)
  const business = (a, b) => (plan.income ?? []).some((x) => x.type === "business" && Number(x.amount) > 0 && (!x.startDate || String(x.startDate) <= b) && (!x.endDate || String(x.endDate) >= a));
  const est = (p) => { try { return computeEstimated(p, { today }); } catch { return null; } };
  const y = Number(String(today).slice(0, 4));
  // this year's quarters: business income coming in today. Last year's 4th quarter (January 1 to 15): business income in
  // that tax year, so one that starts on January 1 brings no quarters of the year before (review 2026-11-02, round 5,
  // third pass: retirees' consulting from January 1, 2027 brought $4,031.95 of 2026 lines on January 5)
  const now = business(today, today);
  const lastYear = !Number(plan.taxes?.year) && String(today) <= QUARTERS(y - 1)[3].due && business(`${y - 1}-01-01`, `${y - 1}-12-31`);
  if (!now && !lastYear) return [];
  const years = [];
  const e = est(plan);
  if (e && now) years.push({ e, prior: false });
  if (e && lastYear && e.year === y) {
    const last = est({ ...plan, taxes: { ...(plan.taxes ?? {}), year: y - 1 } });
    if (last) years.unshift({ e: last, prior: true });
  }
  const out = years.flatMap(({ e: ey, prior }) => yearLines(plan, ey, today, to, prior)).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  // each payment ahead pays only lines due on or after its own date, the latest first: a payment on February 1 never pays
  // the quarter due January 15, so no money leaves later than the IRS wants it (review 2026-11-02, round 5, third pass).
  // The latest payment goes first: it has the fewest lines it may pay.
  const pays = (r) => r.typedTax === true || FEDERAL_TAX_WORDS.test(`${r.rawPayee ?? ""} ${r.payee ?? ""}`);
  const payments = ahead.filter((r) => Number(r.amount) < 0 && String(r.date) >= today && String(r.date) <= to && pays(r))
    .map((r) => ({ date: String(r.date), left: -Number(r.amount) })).sort((a, b) => b.date.localeCompare(a.date));
  // each payment pays the earliest quarter it may (on or after its own date), and what is past due last
  const order = [...out.filter((x) => !x.past), ...out.filter((x) => x.past)];
  for (const p of payments) for (const line of order) {
    if (p.left <= 0) break;
    if (String(line.date) < p.date) continue;
    const cut = Math.min(p.left, -line.amount); line.amount += cut; p.left -= cut;
  }
  return out.filter((x) => -x.amount > 0.5).map(({ past, ...x }) => ({ ...x, amount: Math.round(x.amount * 100) / 100 }));
}

/** One tax year's lines: the past-due part on today, then each quarter due in the days ahead (see estimatedLines). */
function yearLines(plan, e, today, to, prior) {
  if (!e?.needsEstimates || !(e.totalTax > 0) || e.withholding >= e.totalTax / 2) return [];
  const paid = e.paidTyped ? e.paid : taxPaidInBank(plan, e.year, today, e.quarters);
  const remaining = Math.max(0, e.toPayByEstimates - paid);
  const past = (e.quarters ?? []).filter((q) => String(today) > String(q.due));
  const behind = past.length ? Math.max(0, Math.min(remaining, past[past.length - 1].cumulative - paid)) : 0;
  const of = prior ? ` for ${e.year}` : "";
  const out = [];
  let counted = 0;
  if (behind > 0.5) {
    out.push({ date: today, name: e.paidTyped ? `Estimated tax${of} past due (Estimated payments)` : `Estimated tax${of} due so far, if not paid yet (Estimated payments)`, amount: -behind, source: "planned", tax: true, past: true });
    counted = behind;
  }
  for (const q of e.quarters ?? []) {
    if (!(String(q.due) >= today && String(q.due) <= to)) continue;
    const owe = Math.max(0, Math.min(remaining, q.cumulative - paid) - counted);
    if (owe > 0.5) { out.push({ date: q.due, name: `Estimated tax, ${q.label}${prior ? ` of ${e.year}` : ""} (Estimated payments)`, amount: -owe, source: "planned", tax: true }); counted += owe; }
  }
  return out;
}

/**
 * taxPaidInBank(plan, year, today, quarters = null) -> the federal tax the bank shows paid toward `year`'s estimates: outgoing
 * lines to the IRS (FEDERAL_TAX_WORDS, not a transfer) after the 4th-quarter due date of the year before (January 15: that
 * one pays last year) and on or before today and that year's own 4th-quarter due date. A 1040-ES schedule (April, June,
 * September) is no regular rhythm, so the Bills list never finds it; the lines themselves are the record (review
 * 2026-11-02, round 5). With `quarters` (taxes/estimated's, each with `due` and `cumulative`): the lines from January 16
 * to the 1st quarter's due date (April 15), when last year's balance is paid with the return, count together up to the 1st
 * quarter's share, or up to the person's own quarterly payment when every later quarter already closed shows at least that
 * much paid (the smallest of those quarters' totals); the rest is last year's tax. Lines after April 15 count in full
 * (review 2026-11-02, round 5: a $6,000 April payment of last year's balance took $6,000 off this year's quarters; third
 * pass: capping every quarter threw away real overpayments, three $3,500 payments counted as $8,400, not $10,500).
 */
export function taxPaidInBank(plan, year, today, quarters = null) {
  const from = QUARTERS(year - 1)[3].due, until = [String(today), QUARTERS(year)[3].due].sort()[0];
  const lines = (plan.transactions ?? []).filter((t) => Number(t.amount) < 0 && !t.transferId && String(t.date) > from && String(t.date) <= until && FEDERAL_TAX_WORDS.test(`${t.rawPayee ?? ""} ${t.payee ?? ""}`));
  const sum = (list) => list.reduce((s, t) => s - Number(t.amount), 0);
  const qs = Array.isArray(quarters) && quarters.length ? quarters : null;
  if (!qs) return sum(lines);
  const q1 = String(qs[0].due);
  // the person's own quarterly payment: the smallest total paid in a later quarter (after the due date before it, up to
  // its own) among those already past today; none past, or one with nothing paid, leaves the 1st quarter's share
  const closed = qs.slice(1).map((q, i) => ({ after: String(qs[i].due), due: String(q.due) })).filter((w) => String(today) > w.due);
  const own = closed.length ? Math.min(...closed.map((w) => sum(lines.filter((t) => String(t.date) > w.after && String(t.date) <= w.due)))) : 0;
  const early = sum(lines.filter((t) => String(t.date) <= q1)), later = sum(lines.filter((t) => String(t.date) > q1));
  return Math.min(early, Math.max(Number(qs[0].cumulative) || 0, own)) + later;
}

/**
 * typedIncomeTax(expense) -> true when a bill typed on Expenses is the person's own plan for paying this year's federal
 * estimated tax, so what it pays in the days ahead comes off the quarter lines (review 2026-11-02, round 5):
 *   - a name that says estimated or quarterly tax ("Quarterly estimated taxes", "Auto-pay estimated tax", "1040-ES");
 *   - a quarterly bill (the 1040-ES rhythm) to the IRS or for federal, income or self-employment tax, or just "Taxes";
 *   - a yearly or one-time bill to the IRS or for federal, income or self-employment tax dated on the 2nd, 3rd or 4th
 *     quarter's due date (June 15, September 15, January 15): that quarter. On April 15 it may be last year's balance;
 *   - filed under "Taxes not withheld": one that says estimate, quarter or Q1 to Q4, or one to the IRS or for federal,
 *     income or self-employment tax or just "Taxes" paid on any rhythm but yearly or once ("IRS" $300 a month counts there;
 *     filed elsewhere, a monthly IRS bill is more often a payment plan). Otherwise a yearly or one-time one is the April bill.
 * Never: a debt to the tax office (an installment agreement, back taxes, a penalty, interest, a lien or levy, last year's;
 * a payment plan, what is owed or a balance unless the name says estimated, estimate or 1040-ES: "Estimated tax
 * installments" counts), a state's or a city's tax (a state's name or two-letter code in capitals, the Franchise Tax Board,
 * a department of revenue; "revenue" alone only when the name does not say estimated) unless the name also says federal or
 * IRS, another tax ("Property tax", "Car tax", "Payroll tax", "Sales tax") or a fee for filing ("Tax preparer", "Tax
 * software"). Before, an IRS payment plan, a state's estimated tax or an IRS penalty dropped every federal quarter, "auto" or
 * "home" anywhere ("Auto-pay estimated tax") made it not count, and (second pass) "Estimated tax installments", "Estimated
 * taxes owed", "Estimated tax on revenue" or a one-time "IRS payment" on January 15 did not count, so January's quarter went
 * out twice.
 */
export function typedIncomeTax(x) {
  const name = String(x?.name ?? "").trim();
  if (!(Number(x?.amount) > 0) || !name) return false;
  if (TAX_DEBT_NAME.test(name) || OTHER_TAX_NAME.test(name) || TAX_FEE_NAME.test(name)) return false;
  const says = SAYS_ESTIMATE.test(name);
  if (!says && !/\bquarter(ly|s)?\b|\bq[1-4]\b/i.test(name) && TAX_SOFT_DEBT_NAME.test(name)) return false;
  const federal = FEDERAL_NAME.test(name);
  if (!federal && (STATE_NAME.test(name) || STATE_CODE.test(name) || (!says && REVENUE_WORD.test(name)))) return false;
  if (ESTIMATES_NAME.test(name)) return true;
  const incomeTax = /\bincome\s+tax|self.?employ|\bse\s+tax/i.test(name);
  const generic = federal || incomeTax || /^tax(es)?$/i.test(name);
  if (x.period === "quarterly" && generic) return true;
  if ((x.period === "once" || x.period === "annual") && (federal || incomeTax) && irsDueDay(x.startDate, true)) return true;
  if (x.category !== "taxes") return false;
  return /estimat|quarter|\bq[1-4]\b/i.test(name) || (generic && x.period !== "annual" && x.period !== "once");
}

/**
 * The Debts page's monthly payments the Expenses page adds (its `debtFromDebts`, the debts in its `fromDebts`): each debt still owed with a payment, until its
 * payoff month (the Debts page's own date), the mortgage left out when it is filed under housing. Each line carries the words that
 * tie it to a bank payment: its account's name and lender, without the words every loan shares (DEBT_WORDS).
 */
/**
 * The saved debt plan's extra (Pay off debts' `extra`, on top of the required payments): paid on the 1st each month until the
 * last debt it goes to is gone (its targets, or every debt when it is aimed at none), as Next best action counts it
 * (round 4, 2026-11-02: before, the Forecast left it out and showed the money as still in the bank).
 */
function debtPlanLine(plan, today) {
  let pay = null;
  try { pay = computePayoff(plan, { today }); } catch { pay = null; }
  if (!pay?.hasData || !(pay.extra > 0)) return null;
  const ids = pay.targets.length ? pay.targets : pay.debts.map((x) => x.id);
  const ends = ids.map((id) => pay.chosen.debts.find((x) => x.id === id)).filter(Boolean);
  const last = ends.length === ids.length && ends.every((x) => Number.isFinite(x.months)) ? ends.reduce((a, b) => (b.months > a.months ? b : a)) : null;
  const names = ids.map((id) => pay.debts.find((x) => x.id === id)?.name).filter(Boolean);
  return { id: "debt-plan-extra", name: `Extra on ${names.length && names.length <= 2 ? names.join(" and ") : "debts"} (Pay off debts)`, period: "monthly", kind: "expense", signed: -pay.extra, fromDebts: true, words: [], ...(last?.endDate ? { endDate: last.endDate } : {}) };
}

function debtLines(plan, today, exp) {
  const specific = (r) => [...new Set(normalizePayee(`${r.name ?? ""} ${r.institution ?? ""}`).split(" ").filter((w) => w.length > 2 && !DEBT_WORDS.has(w)))];
  const line = (r) => ({ id: `debt-${r.id}`, name: `${(r.name || r.typeLabel).replace(/^Credit cards$/i, "Credit card")} payment`, period: "monthly", kind: "expense", signed: -r.payment, fromDebts: true, words: specific(r), ...(r.payoffDate ? { endDate: r.payoffDate } : {}) });
  const all = computeLiabilities(plan, { today }).rows.filter((r) => r.payment > 0);
  const total = (list) => list.reduce((t, r) => t + r.payment, 0);
  // the debts the Expenses page found no expense for (its `fromDebts`), each on its own line
  const ids = new Set((exp.fromDebts ?? []).map((x) => x.id));
  if (ids.size) { const own = all.filter((r) => ids.has(r.id)); if (Math.abs(total(own) - exp.debtFromDebts) <= 0.5) return own.filter((r) => r.owed > 0).map(line); }
  // the same total the Expenses page adds, whichever way it left the mortgage out; then only debts still owed are paid
  const pick = Math.abs(total(all) - exp.debtFromDebts) <= 0.5 ? all : all.filter((r) => r.type !== "mortgage");
  if (Math.abs(total(pick) - exp.debtFromDebts) > 0.5) return [{ id: "debt-all", name: "Loan and card payments (from Debts)", period: "monthly", kind: "expense", signed: -exp.debtFromDebts, fromDebts: true, words: [] }];
  return pick.filter((r) => r.owed > 0).map(line);
}

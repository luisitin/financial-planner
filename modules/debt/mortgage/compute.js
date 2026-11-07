// modules/debt/mortgage/compute.js -- PURE. The mortgage (the first liability account of type
// mortgage, or plan.debtPlan.mortgageAccountId) with its detail from the Debts page: the
// schedule from today, what extra payments or paying every two weeks would save, what a
// recast would do to the payment, and when mortgage insurance can go.
import { amortization, pmt, nper } from "../../../core/math/finance.js";
import { compute as computeDebts } from "../../balance/liabilities/compute.js";
import { addMonths } from "../../../core/math/dates.js";
import { homeOfLoan } from "../../overview/guesses/estimators/loanhome.js";
import { countedBalance } from "../../balance/net-worth/compute.js";
import { twinAccount } from "../../property/rental/running.js";
import { startOf, staleYear, recordOf, MORTGAGE_START } from "../../overview/guesses/estimators/debts.js";
import { profileOf } from "../../overview/guesses/estimators/common.js";
import { isGuess } from "../../../core/estimate/index.js";
import { monthsBetween } from "../../../core/math/dates.js";

/**
 * homeOf(plan, loanId) -> { account, entry, value, rental } | null: the home a mortgage is on (round 8 batch 6, landlord-2:
 * the condo's loan was measured against the main home). A property entry that names the loan (`loanAccountId`: a rental on
 * Rental analysis) is its home: its Net worth account when it names one, else the value typed for it there (review
 * 2026-11-06, money 10: an account of its name not yet linked is not read; nothing links them without "Yes, it's this one").
 * Otherwise the first Real estate account with a value that is not another loan's home nor a rental's (money 9: a rental owned
 * outright, listed first, was taken as the home's), as before for a plan with no rental.
 */
export function homeOf(plan, loanId) {
  const accounts = plan.accounts ?? [], entries = (plan.property ?? []).filter((e) => e && (e.kind === "rental" || e.kind === "home"));
  const own = entries.find((e) => loanId && e.loanAccountId === loanId) ?? null;
  const linked = (e) => (e.accountId ? accounts.find((a) => a.id === e.accountId) ?? null : null);
  if (own) {
    const a = linked(own);
    return { account: a, entry: own, value: a ? countedBalance(a) : Number(own.value) || 0, rental: own.kind === "rental", name: own.name || a?.name || "the home" };
  }
  // claimed: the homes of the other loans' entries, and every rental's (linked, or the account of its name it probably is)
  const claimed = new Set(entries.filter((e) => e.kind === "rental" || (e.loanAccountId && e.loanAccountId !== loanId && accounts.some((a) => a.id === e.loanAccountId))).map((e) => (linked(e) ?? twinAccount(plan, e))?.id).filter(Boolean));
  const a = accounts.find((x) => x.type === "property" && Number(x.balance) > 0 && !claimed.has(x.id)) ?? null;
  return a ? { account: a, entry: (plan.property ?? []).find((e) => e && e.accountId === a.id && (e.kind ?? "home") === "home") ?? null, value: Number(a.balance) || 0, rental: false, name: a.name } : null;
}

/** The loan's own home for the year box: its rental, or the home account (never the main home for a second loan). */
export const loanHome = (plan, loanId) => homeOfLoan(plan, loanId);

/**
 * How long the loan has been running, for the one plain line under the title: { year, date, via ("typed": the year the home
 * was bought as told, "tap": the start answered on Get started, "guess": the usual year for an owner of this age, "stale": a
 * year told that is too long ago to be this loan's start, so it is counted from our guess for the age), monthsLeft and yearsLeft
 * of a 30-year loan from that start (null only when there is no start at all), stale (the year told), worked: whether the balance or payment on file is our guess, so the start
 * is what they were worked from (otherwise they are the person's own and the years left come from them), pageMonths (the page's
 * own months at the payment, which the card says) and apart (true when those are more than three years off the loan's) } | null
 */
export function loanStart(plan, row, today, pageMonths = null) {
  if (!today) return null;
  try {
    const rec = recordOf(plan, "mortgage", `accounts[${row.id}].balance`);
    const did = row.detail?.id;
    const worked = isGuess(plan, `accounts[${row.id}].balance`) || (!!did && isGuess(plan, `debts[${did}].minPayment`));
    const s = startOf(plan, rec, { today, prof: profileOf(plan, today) });
    if (!s) {
      const stale = staleYear(plan, rec, { today });
      return stale ? { year: stale, date: null, via: "stale", stale, monthsLeft: null, yearsLeft: null, worked } : null;
    }
    const left = Math.max(12, 360 - (monthsBetween(s.date, today) ?? 0));
    // pageMonths: the page's own months (the payment, less its tax and insurance, against the balance), what the card says so
    // every page gives one answer (a guessed payment is rounded to $50, which moves it a year or so off the loan's own);
    // apart: more than three years off, as when a typed payment far above the usual one pays a balance capped at the home's
    // value off sooner (verify 2026-11-07)
    const page = Number.isFinite(pageMonths) ? pageMonths : null;
    const apart = worked && page !== null && Math.abs(page - left) > 36;
    // a year typed too long ago to be this loan's start: counted from our guess for the age (debts.js startOf), said as such
    if (s.stale) return { year: s.year, date: s.date, via: "stale", stale: s.stale, monthsLeft: left, yearsLeft: left / 12, worked, pageMonths: page };
    return { year: s.year, date: s.date, via: s.via, monthsLeft: left, yearsLeft: left / 12, worked, pageMonths: page, ...(apart ? { apart: true, owedGuess: isGuess(plan, `accounts[${row.id}].balance`) } : {}) };
  } catch { return null; }
}
/** Answer "when did you last refinance?" for the mortgage (the same answer Get started's tap keeps): `value` is a key of MORTGAGE_START, or null to take it back. */
export function setMortgageStart(draft, value) {
  draft.guide = draft.guide && typeof draft.guide === "object" ? draft.guide : {};
  draft.guide.setup = draft.guide.setup && typeof draft.guide.setup === "object" ? draft.guide.setup : {};
  const taps = { ...(draft.guide.setup.taps ?? {}) };
  if (MORTGAGE_START[value]) taps["mortgage-start"] = value; else delete taps["mortgage-start"];
  if (Object.keys(taps).length) draft.guide.setup.taps = taps; else delete draft.guide.setup.taps;
}

/**
 * compute(plan, { today, extra = 0, lump = 0 }) -> {
 *   mortgage: { id, name, balance, rate, payment, extra, termMonths, startDate } | null, home: { value } | null,
 *   base: { months, endDate, totalInterest, payment }, withExtra: { months, endDate, totalInterest, monthsSaved, interestSaved },
 *   biweekly: { months, endDate, totalInterest, monthsSaved, interestSaved }, recast: { newPayment, monthlySaving } | null,
 *   pmi: { basis ("price": the price paid, from the Home page; "today": today's value, when no price is entered), basisValue, ltv (owed / basisValue),
 *     dropAtBalance (80%: you can ask to cancel), monthsUntilDrop, dateDrop, autoAtBalance (78%: it ends by itself), monthsUntilAuto, dateAuto, homeValue } | null, schedule: [{ year, balance, interestPaid, principalPaid }], hasData
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const li = computeDebts(plan, { today });
  const wantId = params.accountId ?? plan.debtPlan?.mortgageAccountId;
  // the mortgage on the home you live in comes first: a loan a rental names (Rental analysis) is shown when picked (round 8 batch 6)
  const rentalLoans = new Set((plan.property ?? []).filter((e) => e?.kind === "rental" && e.loanAccountId).map((e) => e.loanAccountId));
  const owing = li.rows.filter((r) => r.type === "mortgage" && r.owed > 0);
  const row = li.rows.find((r) => r.id === wantId) ?? owing.find((r) => !rentalLoans.has(r.id)) ?? owing[0] ?? null;
  // the other mortgages, to pick from on the page
  const others = owing.filter((r) => r.id !== row?.id).map((r) => ({ id: r.id, name: r.name }));
  if (!row || !row.detail || !(row.payment > 0) || !(row.rate >= 0)) {
    return { mortgage: row ? { id: row.id, name: row.name, balance: row.owed, rate: row.rate, payment: row.payment } : null, others, hasData: false, missing: row ? "rate or payment" : "account" };
  }
  const extra = Math.max(0, Number(params.extra ?? row.extra ?? 0) || 0);
  const lump = Math.max(0, Number(params.lump ?? 0) || 0);
  const balance = row.owed, rate = row.rate, whole = row.minPayment > 0 ? row.minPayment : row.payment;
  // only what is left of the payment after the tax and insurance in it pays the loan (review D1); `required` is that part, `whole` what is paid
  const escrow = Math.min(Number(row.escrow) || 0, whole * 0.5), required = whole - escrow;
  const r = rate / 12;
  const monthsOf = (payment, principal = balance) => { const n = nper(r, payment, principal); return Number.isFinite(n) ? Math.ceil(n - 1e-9) : Infinity; };
  const totalInterestOf = (payment, principal = balance) => { const n = monthsOf(payment, principal); return Number.isFinite(n) ? amortization({ principal, annualRate: rate, years: n / 12 + 1, payment }).totalInterest : Infinity; };
  const date = (m) => today && Number.isFinite(m) ? addMonths(today, m) : null;
  const baseMonths = monthsOf(required), baseInterest = totalInterestOf(required);
  const base = { months: baseMonths, endDate: date(baseMonths), totalInterest: baseInterest, payment: whole, toLoan: required, escrow };
  const exMonths = monthsOf(required + extra), exInterest = totalInterestOf(required + extra);
  const withExtra = { extra, months: exMonths, endDate: date(exMonths), totalInterest: exInterest, monthsSaved: Number.isFinite(exMonths) ? baseMonths - exMonths : 0, interestSaved: Number.isFinite(exInterest) ? Math.round((baseInterest - exInterest) * 100) / 100 : 0 };
  // every two weeks: half the payment 26 times a year = 13 monthly payments, so 1/12 of a payment extra per month
  const bwMonths = monthsOf(required * 13 / 12), bwInterest = totalInterestOf(required * 13 / 12);
  const biweekly = { months: bwMonths, endDate: date(bwMonths), totalInterest: bwInterest, monthsSaved: Number.isFinite(bwMonths) ? baseMonths - bwMonths : 0, interestSaved: Number.isFinite(bwInterest) ? Math.round((baseInterest - bwInterest) * 100) / 100 : 0 };
  // recast: pay a lump sum, keep the end date, the lender recalculates a lower payment
  const recast = lump > 0 && Number.isFinite(baseMonths) ? (() => { const np = pmt(r, baseMonths, Math.max(0, balance - lump)); return { lump, newPayment: Math.round((np + escrow) * 100) / 100, monthlySaving: Math.round((required - np) * 100) / 100 }; })() : null;
  // mortgage insurance (the Homeowners Protection Act, 12 U.S.C. 4901-4902): you can ask to cancel it once the balance
  // reaches 80% of the home's original value (the price paid, or the appraisal if lower), counting extra payments; it ends
  // by itself when the original schedule reaches 78%. Original value: the price on the Home page; without one, today's value
  // stands in (a lender may also drop it on a new appraisal, under its own rules).
  // the home this loan is on (homeOf): its own property, so a rental's loan is measured against the rental. A rental's loan is
  // not under the Homeowners Protection Act, whose dates are for "a single-family dwelling that is the principal residence of
  // the mortgagor" (12 U.S.C. 4901(14), (15), read 2026-11-06 at law.cornell.edu): there only what is owed against its value
  // today is given (`pmi.rental`), and the lender's own rules decide
  const own = homeOf(plan, row.id);
  const home = own ? (own.account ? { ...own.account, balance: own.account.balance } : { id: null, name: own.name, balance: own.value }) : null;
  let pmi = null;
  if (own && own.rental && own.value > 0) {
    pmi = { rental: true, basis: "today", basisValue: own.value, ltv: balance / own.value, homeValue: own.value, homeName: own.name };
  } else if (home) {
    const value = Number(home.balance) || 0;
    const entry = own?.entry && (own.entry.kind ?? "home") === "home" ? own.entry : null;
    const price = Number(entry?.purchasePrice) > 0 ? Number(entry.purchasePrice) : null;
    const basisValue = price ?? value;
    const monthsTo = (line, pay) => { let m = 0, b = balance; while (b > line + 0.005 && m < 600) { b = b * (1 + r) - pay; m++; } return m; };
    const dropAt = basisValue * 0.8, autoAt = basisValue * 0.78;
    const mDrop = basisValue ? monthsTo(dropAt, required + extra) : 0, mAuto = basisValue ? monthsTo(autoAt, required) : 0;
    pmi = { basis: price ? "price" : "today", basisValue, ltv: basisValue ? balance / basisValue : null, dropAtBalance: dropAt, monthsUntilDrop: mDrop, dateDrop: date(mDrop), autoAtBalance: autoAt, monthsUntilAuto: mAuto, dateAuto: date(mAuto), homeValue: value };
  }
  // year-by-year balance at the required payment plus extra
  const sched = Number.isFinite(exMonths) ? amortization({ principal: balance, annualRate: rate, years: exMonths / 12 + 1, payment: required + extra }).schedule : [];
  const schedule = [];
  for (let y = 1; y * 12 <= sched.length + 11 && y <= 40; y++) { const rows = sched.slice((y - 1) * 12, y * 12); if (!rows.length) break; schedule.push({ year: y, endBalance: rows[rows.length - 1].balance, interestPaid: Math.round(rows.reduce((s, x) => s + x.interest, 0) * 100) / 100, principalPaid: Math.round(rows.reduce((s, x) => s + x.principal, 0) * 100) / 100 }); }
  const out = { mortgage: { id: row.id, name: row.name, balance, rate, payment: whole, toLoan: required, escrow, extra: row.extra, termMonths: row.detail.termMonths ?? null, startDate: row.detail.startDate ?? "" }, home: home ? { value: own?.rental ? own.value : Number(home.balance) || 0, name: home.name, ...(own?.rental ? { rental: true } : {}) } : null, others, base, withExtra, biweekly, recast, pmi, schedule, hasData: true };
  return { ...out, start: loanStart(plan, row, today, baseMonths) };
}

/** The button to another loan: "See Condo loan ›"; "See the loan ›" when its own name is a generic one ("Mortgage", "Loan"), which reads oddly after "See" (follow-up C9). */
export function seeLoanWords(name) {
  const n = String(name ?? "").trim();
  return !n || /^(a |the |my |our )?(home |house |mortgage |bank |second )?(mortgage|loan|home loan|mortgage loan|house loan)$/i.test(n) ? "See the loan" : `See ${n}`;
}

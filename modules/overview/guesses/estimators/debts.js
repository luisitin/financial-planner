// modules/overview/guesses/estimators/debts.js -- PURE. Guesses for loans and cards (spec 7.D: debts are never
// dropped). Formulas and sources: ../README.md "Loans and cards".
//
// For each kind (mortgage, car-loan, credit, student, loan) three keys, in the order settle refreshes them (rate, then
// what is still owed, then the payment), so each reads only what comes before it:
//   debt.<kind>.rate     a single published average (FHFA for mortgages people already have, by state; Experian or the
//                        Federal Reserve's G.19 for car loans, by new or used; G.19 for cards and personal loans; the
//                        federal undergraduate rate for student loans). Rates carry no spread (R11).
//   debt.<kind>.owed     a payment typed is worked back (the payment identity); with no payment, what families like this
//                        owe (FHFA balance per loan by state and the Survey of Consumer Finances by income and age, R2)
//   debt.<kind>.payment  what pays off what is owed over the rest of a usual term (a mortgage adds the state's usual tax
//                        and insurance; a card is the usual minimum: 1% of the balance plus the month's interest, $40 at least)
//
// Every key reads the record its path names (accounts[<id>].balance, debts[<id>].rate or .minPayment), else Get
// started's own (setup-owe-<kind>, setup-debt-<kind>). A figure counts as known (typed) when it is in the plan and is not
// itself a guess; `args` holds what Get started's screen shows and has not saved yet ({ owed, payment, rate (a fraction),
// home, start }: a number, or null for a box left blank; a key left out is read from the plan), so the grey figure on the
// screen is exactly what saving the blank box writes, and stays so after the settle that follows.
import { T } from "../data/debts.js";
import { T as BAL } from "../data/balances.js";
import { DERIVED as D_DEBTS } from "../data/debts.js";
import { DERIVED as D_BAL } from "../data/balances.js";
import { STATE_NAME } from "../data/index.js";
import { profileOf, scfR2, stateOf, placeOf, placeName, possessiveOf, pctWords, money, fit, ok, has, SCF_TABLES, YOUR_STATE, YOUR_PAY, YOUR_AGE, WHAT_YOU_PAY } from "./common.js";
import { escrowMonthly, homeValueFor, homePathOf, purchaseOf } from "./home.js";
import { boughtGuess, loanFrom, midYear, rateInYear, rateMean, guessedRate, TABLE as PT, YOUNGEST } from "./purchase.js";
import { isGuess } from "../../../../core/estimate/index.js";
import { pv, pmt } from "../../../../core/math/finance.js";
import { sigmaFromMeanMedian, combineLog, roundGuess } from "../../../../core/math/estimate.js";
import { monthsBetween } from "../../../../core/math/dates.js";

export { stateOf };
const L = (p, k) => (Array.isArray(p?.[k]) ? p[k] : []);
const cell = (id, row, col) => { const t = T[id]; const i = col === undefined ? 0 : t.cols.indexOf(col); return i >= 0 ? t.rows[row]?.[i] ?? null : null; };
const LIABILITIES = () => "#/balance/liabilities";
const WHEN_TAKEN = { label: "when you took out the mortgage", href: "#/overview/setup/owe-amounts" };
const WHEN_CAR = { label: "when you got the car loan", href: "#/overview/setup/owe-amounts" };
const RATE = "Average contract interest rate (%)";
const STATE_NOW = "mortgage_outstanding_fhfa_by_state_2026q2", US_NOW = "mortgage_outstanding_fhfa_national", STATE_NEW = "mortgage_new_purchase_fhfa_by_state_2025", US_NEW = "mortgage_new_loans_fhfa_national_2025";
const EXPERIAN = "auto_loan_terms_experian_q2_2026", G19_AUTO = "auto_personal_rate_fed_g19", CFPB = "card_minimum_payment_rule_cfpb";
const PTAX = "acs2025_effective_property_tax_rate_by_state", HO3 = "naic2023_homeowners_premium_by_state";
const MORTGAGE_TERM = 360;
/** The spread of mortgage balances among families with one (R6): the survey's mean and median balance, all families. */
const scfMortgage = (stat) => BAL[`scf2025_${stat}_value_if_held`]?.rows?.mortgageOnPrimaryResidence?.[0] ?? null;
const MORTGAGE_SIGMA = () => sigmaFromMeanMedian(scfMortgage("mean"), scfMortgage("median"));
const TERMS = { student: 120, loan: 36 };   // the 10-year standard plan; a usual personal loan (core/math/finance TYPICAL_TERMS)
const SCF_ITEM = { mortgage: "mortgageOnPrimaryResidence", "car-loan": "vehicleLoans", credit: "creditCardBalances", student: "educationLoans", loan: "otherInstallmentLoans" };

// ---- the record a key is for, and what of it is known
/** The debt row and its liability account a path names, else Get started's own for the kind; with the three paths. */
export function recordOf(plan, kind, path = null) {
  const accounts = L(plan, "accounts"), debts = L(plan, "debts");
  const m = typeof path === "string" ? /^(accounts|debts)\[([^\]]+)\]\./.exec(path) : null;
  let acct = null, row = null;
  if (m?.[1] === "accounts") { acct = accounts.find((a) => a?.id === m[2]) ?? null; row = debts.find((d) => d?.accountId === m[2]) ?? null; }
  else if (m?.[1] === "debts") { row = debts.find((d) => d?.id === m[2]) ?? debts.find((d) => d?.accountId === m[2]) ?? null; acct = row ? accounts.find((a) => a?.id === row.accountId) ?? null : null; }
  else { acct = accounts.find((a) => a?.id === `setup-owe-${kind}`) ?? null; row = debts.find((d) => d?.id === `setup-debt-${kind}`) ?? null; }
  const aid = acct?.id ?? (m?.[1] === "accounts" ? m[2] : `setup-owe-${kind}`), rid = row?.id ?? `setup-debt-${kind}`;
  return { acct, row, owedPath: `accounts[${aid}].balance`, ratePath: `debts[${rid}].rate`, payPath: `debts[${rid}].minPayment` };
}
/**
 * What the person has told us about this debt: the screen's answer (args) when it holds the box, else the plan's figure
 * unless it is a guess. owed and payment must be above 0; a rate of 0 is a real rate. -> { owed, payment, rate } (null = not known)
 */
export function knownOf(plan, rec, args = null) {
  const pick = (k, path, read, zeroOk) => {
    const good = (v) => ok(v) && (zeroOk ? v >= 0 : v > 0);
    if (has(args, k)) return good(args[k]) ? args[k] : null;
    const v = read();
    return good(v) && !isGuess(plan, path) ? v : null;
  };
  return {
    owed: pick("owed", rec.owedPath, () => (rec.acct ? Math.abs(Number(rec.acct.balance)) : null), false),
    payment: pick("payment", rec.payPath, () => (rec.row ? Number(rec.row.minPayment) : null), false),
    rate: pick("rate", rec.ratePath, () => (rec.row && rec.row.rate !== null && rec.row.rate !== "" ? Number(rec.row.rate) : null), true),
  };
}
/** A one-tap answer: the screen's (args.start) first, else the one saved on Get started (guide.setup.taps). */
const tapOf = (plan, args, key) => (has(args, "start") ? args.start ?? null : plan?.guide?.setup?.taps?.[key] ?? null);
/** The rate to work with: typed, else our guess for it (an earlier key). -> { value, typed, est } */
function rateFor(plan, kind, rec, args, lib, known) {
  if (known.rate !== null) return { value: known.rate, typed: true, est: null };
  const est = lib.estimate(`debt.${kind}.rate`, { path: rec.ratePath, args });
  return est && ok(est.value) ? { value: est.value, typed: false, est } : null;
}
/** What is owed to work with: typed; else the plan's figure (a guess refreshed earlier in the same pass); else our guess. */
function owedFor(plan, kind, rec, args, lib, known) {
  if (known.owed !== null) return { value: known.owed, typed: true, est: null };
  if (!has(args, "owed") && rec.acct && Number(rec.acct.balance)) return { value: Math.abs(Number(rec.acct.balance)), typed: false, est: null };
  const est = lib.estimate(`debt.${kind}.owed`, { path: rec.owedPath, args });
  return est && ok(est.value) ? { value: est.value, typed: false, est } : null;
}
/**
 * The tax and insurance to take out of a mortgage payment (or put into a guessed one): the figure the person gave for this loan
 * (`debts[].escrowMonthly` typed, 0 when paid apart; or the screen's answer, args.escrow), else the usual one for the home
 * (escrowMonthly), none when the escrow tap says they are paid apart. -> { total, typed? } | null
 */
function escrowFor(plan, rec, { today, args, loanId }, lib) {
  if (has(args, "escrow") && ok(args.escrow)) return args.escrow > 0 ? { total: args.escrow, typed: true } : null;
  const v = rec?.row?.escrowMonthly;
  if (typeof v === "number" && v >= 0 && !isGuess(plan, `debts[${rec.row.id}].escrowMonthly`)) return v > 0 ? { total: v, typed: true } : null;
  if (tapOf(plan, null, "escrow") === "no") return null;
  return escrowMonthly(plan, { today, args, loanId }, lib);
}
/** Tables behind a figure this one is worked out from (a guessed rate or balance), for the sources fold. */
const from = (...parts) => parts.flatMap((p) => p?.est?.tables ?? []);
const uniq = (xs) => [...new Set(xs)];
/** What families like this owe on this kind of debt (R2 on the Survey of Consumer Finances), with words for the why. */
function scfPrior(kind, prof) {
  const r = scfR2(SCF_ITEM[kind], { income: prof.income, age: prof.age });
  if (!r) return null;
  const pay = prof.income ? (prof.payHow === "guess" ? "our pay guess" : "your pay") : null;
  const at = prof.age !== null ? (pay ? `your age and ${pay === "your pay" ? "pay" : pay}` : "your age") : pay;
  return { ...r, at };
}
const sharpers = (prof, first = []) => [...first, ...(prof.state ? [] : [YOUR_STATE]), ...(prof.income ? [] : [YOUR_PAY]), ...(prof.age !== null ? [] : [YOUR_AGE])].slice(0, 2);

// ---- mortgages
/** The middle of each "when did you take it out" span (the tap mortgage-start). 2010-2019's middle is January 2015. */
export const MORTGAGE_START = { pre2010: "2007-07-01", "2010s": "2015-01-01", "2020-21": "2021-01-01", "2022on": "2024-01-01" };
const MORTGAGE_ASK = {
  key: "mortgage-start", kind: "voi", question: "When did you take out this mortgage, or last refinance it?",
  options: [{ value: "pre2010", label: "Before 2010" }, { value: "2010s", label: "2010 to 2019" }, { value: "2020-21", label: "2020 or 2021" }, { value: "2022on", label: "2022 or later" }, { value: "unsure", label: "Not sure" }],
};
/** FHFA unpaid balance per loan in the state (a derived constant), the U.S. figure by loan count with no state. */
function perLoanOf(st) {
  const s = st ? D_DEBTS.perLoanByState?.value?.[st] : null;
  if (ok(s)) return { value: s, table: STATE_NOW };
  const upb = cell(US_NOW, "Unpaid principal balance ($ billions)", "by loan count"), n = cell(US_NOW, "Active first-lien mortgages (thousands)", "by loan count");
  return ok(upb) && ok(n) && n > 0 ? { value: upb * 1e9 / (n * 1e3), table: US_NOW } : null;
}
/** Months of a loan (30 years unless its own term is typed on Debts) still to pay from a start date (12 at the least: the last year is shown, never "paid off"). */
function monthsLeftFrom(date, today, term = MORTGAGE_TERM) {
  const gone = date && today ? monthsBetween(date, today) : null;
  return gone === null ? null : Math.max(12, (term ?? MORTGAGE_TERM) - gone);
}
/**
 * The years a "when did you take it out" tap stands for, from the year the oldest adult was about 20 (YOUNGEST, the owner's rule)
 * on (2026-11-07, bought verify D3 and low items: "2010 to 2019" put a 25-year-old couple's loan in 2015, when they were 13):
 * { from, to, date (the middle of what is left of the span; the span's own date when none of it is cut) } | null (all of it before
 * about 20, or no such tap). No age: the whole span.
 */
export function tapSpan(tap, { today, age = null } = {}) {
  if (!MORTGAGE_START[tap] || !today) return null;
  const thisYear = Number(today.slice(0, 4));
  const [lo, hi] = tap === "2022on" ? [2022, thisYear] : TAP_YEARS[tap];
  const y20 = ok(age) ? thisYear - Math.floor(age) + YOUNGEST : null;
  if (y20 === null || y20 <= lo) return { from: lo, to: hi, date: MORTGAGE_START[tap] };
  if (y20 > hi) return null;
  const mid = (y20 + hi + 1) / 2, y = Math.floor(mid), m = Math.floor((mid - y) * 12) + 1;
  const date = `${y}-${String(m).padStart(2, "0")}-01`;
  return { from: y20, to: hi, date: date > today ? `${today.slice(0, 7)}-01` : date };
}
/** The "when did you take out this mortgage" question with only the spans the oldest adult was about 20 or older in (and Not sure). */
export function mortgageAsk({ today, age = null } = {}) {
  return { ...MORTGAGE_ASK, options: MORTGAGE_ASK.options.filter((o) => o.value === "unsure" || !today || tapSpan(o.value, { today, age }) !== null) };
}
const WHEN_BOUGHT = { label: "the year you bought your home", href: "#/property/home" };
/** Years on a tenure in words: "the last few years" and so on, for the why-lines and the question's help. */
export const boughtWords = (tenure) => (tenure < 1.5 ? "in the last year or two" : tenure < 5 ? "in the last few years" : tenure < 10 ? "in the last ten years or so" : tenure < 20 ? "ten to twenty years ago" : "more than twenty years ago");
/** The loan account a record is for (Get started's own when the path names none). */
export const loanIdOf = (rec) => /^accounts\[([^\]]+)\]/.exec(rec?.owedPath ?? "")?.[1] ?? "setup-owe-mortgage";
/** The years of 30-year rates a refinance (or the loan's own start) answered on the tap stands for; "2022on" is read from the state's new-loan rate. */
export const TAP_YEARS = { pre2010: [2000, 2009], "2010s": [2010, 2019], "2020-21": [2020, 2021] };
/** A start so long ago that fewer than this many months of a 30-year loan would be left: the loan was refinanced or is another one. */
const STALE_LEFT = 60;
const longAgo = (date, today) => (monthsBetween(date, today) ?? 0) > MORTGAGE_TERM - STALE_LEFT;
/**
 * The date a purchase year stands for, when the plan or screen says one: { date, year, price } | null (nothing typed, or in the
 * future, or an exact date after today).
 */
function typedStart(plan, rec, { today, args }) {
  const typed = purchaseOf(plan, { loanId: loanIdOf(rec), args });
  const date = typed.year && typed.year <= Number(today.slice(0, 4)) ? (typed.date && typed.date <= today ? typed.date : midYear(typed.year, today)) : null;
  return date ? { date, year: Number(date.slice(0, 4)), price: typed.price } : null;
}
/** The loan's own start date and term as typed on Debts ("Started", "Loan length in months"), when they can be its start: { date, term } | null. */
function loanTyped(rec, today) {
  const d = rec?.row;
  const date = typeof d?.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.startDate) && d.startDate <= today ? d.startDate : null;
  const term = Number(d?.termMonths) >= 12 && Number(d.termMonths) <= 480 ? Math.round(Number(d.termMonths)) : null;
  return date ? { date, term } : null;
}
/**
 * When the loan began, in the order of what we know: the loan's own start date typed on Debts (with its term when typed there,
 * 2026-11-07, bought verify defect 5: they were never read), else a refinance (or the loan's own start) answered on the tap (only
 * the part of its span from when the oldest adult was about 20: tapSpan), else the year the home was bought as typed (Home's
 * purchase date, or Get started's "Year you bought it"), else our guess for an owner of this age (home.boughtYear). A tap earlier
 * than the typed purchase is impossible and is set aside, as is a tap whose whole span is before about 20. A typed purchase so long
 * ago that a 30-year loan from it would be nearly paid off is not the loan's start (it was refinanced, or is another loan): the
 * loan is counted from our guess for the age, with `stale` = the year typed, and the refinance question is the way to sharpen it
 * (review D3; verify 2026-11-07: not a full new 30 years).
 * -> { date, year, via: "loan" | "tap" | "typed" | "guess", term? (months, typed on Debts), from?, to? (a tap's years), tenure?, stale? } | null
 */
export function startOf(plan, rec, { today, args = null, prof = null } = {}) {
  if (!today) return null;
  const own = loanTyped(rec, today);
  if (own) return { date: own.date, year: Number(own.date.slice(0, 4)), via: "loan", ...(own.term ? { term: own.term } : {}) };
  const tap = tapOf(plan, args, "mortgage-start");
  const typed = typedStart(plan, rec, { today, args });
  const pr = prof ?? profileOf(plan, today);
  const span = tapSpan(tap, { today, age: pr.age });
  if (span && !(typed && span.date < typed.date)) return { date: span.date, year: Number(span.date.slice(0, 4)), via: "tap", from: span.from, to: span.to };
  if (typed && !longAgo(typed.date, today)) return { ...typed, via: "typed" };
  // a year typed so long ago that a 30-year loan from it would be paid off: the loan was refinanced (or is another one), so it is
  // counted like most owners this age, from our guessed year (`stale` keeps the year typed), not as a new 30-year loan (verify
  // 2026-11-07: a 60-year-old who typed 1995 was told the mortgage runs to 2056)
  const stale = typed ? typed.year : null;
  const g = boughtGuess({ age: pr.age, today });
  const date = g ? midYear(g.year, today) : null;
  return date && !longAgo(date, today) ? { date, year: g.year, via: "guess", tenure: g.tenure, ...(stale ? { stale } : {}) } : null;
}
/** The year typed for the home when it is too long ago to be the loan's start and no refinance was answered, else null (the page asks "when did you last refinance?"). */
export function staleYear(plan, rec, { today, args = null } = {}) {
  if (!today || loanTyped(rec, today) || tapSpan(tapOf(plan, args, "mortgage-start"), { today, age: profileOf(plan, today).age })) return null;
  const typed = typedStart(plan, rec, { today, args });
  return typed && longAgo(typed.date, today) ? typed.year : null;
}

// ---- car loans
const CAR = { new: "New", used: "Used" };
const carCell = (row, cls) => cell(EXPERIAN, row, CAR[cls]);
const nearer = (x, row) => (Math.abs(Math.log(x / carCell(row, "new"))) < Math.abs(Math.log(x / carCell(row, "used"))) ? "new" : "used");
/**
 * New or used (spec E25/E26): whichever class's average payment is nearer the typed payment in log terms; else
 * whichever average amount financed is nearer the typed balance; else the balance families like this owe (R2).
 */
function carClassOf(plan, rec, args, prof) {
  const k = knownOf(plan, rec, args);
  if (k.payment !== null) return nearer(k.payment, "Average monthly payment ($)");
  if (k.owed !== null) return nearer(k.owed, "Average loan amount ($)");
  const p = scfPrior("car-loan", prof);
  return p ? nearer(p.value, "Average loan amount ($)") : "used";
}
/** Months gone on a car loan by the tap car-loan-start (the middle of each span); "5+": about half a year left. */
const CAR_GONE = { 0: 6, "1-2": 24, "3-4": 48 };
/** The fewest years ago each car-loan span reaches: a span is only offered or used when the oldest adult was about 20 by then. */
const CAR_SOONEST = { 0: 0, "1-2": 1, "3-4": 3, "5+": 5 };
const carTapOk = (start, age) => CAR_SOONEST[start] === undefined || !ok(age) || age - CAR_SOONEST[start] >= YOUNGEST;
/** Months still to pay; the months gone never reach back before the oldest adult was about 20 (2026-11-07). */
const carMonthsLeft = (start, term, age = null) => {
  if (!carTapOk(start, age)) return null;
  if (start === "5+") return 6;
  if (CAR_GONE[start] === undefined) return null;
  const gone = ok(age) ? Math.min(CAR_GONE[start], Math.max(6, (age - YOUNGEST) * 12)) : CAR_GONE[start];
  return Math.max(6, term - gone);
};
const carAsk = (age) => ({ ...CAR_ASK, options: CAR_ASK.options.filter((o) => carTapOk(o.value, age)) });
/** The "when did you take it out" question for a debt kind ("mortgage" or "car-loan"), with only the spans the oldest adult was about 20 or older in. */
export const startAsk = (kind, plan, today) => { const age = profileOf(plan, today).age; return kind === "mortgage" ? mortgageAsk({ today, age }) : kind === "car-loan" ? carAsk(age) : null; };
const CAR_ASK = {
  key: "car-loan-start", kind: "voi", question: "When did you get this car loan?",
  options: [{ value: "0", label: "This year" }, { value: "1-2", label: "1 or 2 years ago" }, { value: "3-4", label: "3 or 4 years ago" }, { value: "5+", label: "5 or more years ago" }, { value: "unsure", label: "Not sure" }],
};

// ---- loans with a usual term (student loans, another loan): what is owed and the payment
function termOwed(kind, label) {
  return function fn(plan, { today, path, args }, lib) {
    const prof = lib.memo("profile", () => profileOf(plan, today));
    const rec = recordOf(plan, kind, path), known = knownOf(plan, rec, args);
    const prior = scfPrior(kind, prof);
    if (!prior) return null;
    const words = prior.at ? `typical ${label} at ${prior.at}` : `typical ${label} among people who have one`;
    let value = prior.value, why = words;
    const rate = known.payment !== null ? rateFor(plan, kind, rec, args, lib, known) : null;
    if (rate) {
      const most = pv(rate.value / 12, TERMS[kind], known.payment);
      if (most < value) { value = most; why = `worked back from your ${money(known.payment)} payment over a usual term`; }
    }
    return { value, sigma: prior.sigma, measured: prior.sigma !== null, why: fit(why, words), uses: { pay: prof.payHow, age: prof.age !== null ? "typed" : null }, sharperWith: sharpers(prof, known.payment === null ? [WHAT_YOU_PAY] : []), tables: uniq([...SCF_TABLES, ...from(rate)]) };
  };
}
function termPayment(kind, years) {
  return function fn(plan, { today, path, args }, lib) {
    const rec = recordOf(plan, kind, path), known = knownOf(plan, rec, args);
    const rate = rateFor(plan, kind, rec, args, lib, known), owed = owedFor(plan, kind, rec, args, lib, known);
    if (!rate || !owed) return null;
    const tables = uniq(from(rate, owed));
    return {
      value: pmt(rate.value / 12, TERMS[kind], owed.value), sigma: null, measured: false,
      why: fit(`what pays off ${money(owed.value)} at ${pctWords(rate.value)} over ${years}`, `what pays off what you owe over ${years}`),
      uses: { owed: owed.typed ? "typed" : "guess", rate: rate.typed ? "typed" : "guess" }, sharperWith: [], tables, basis: tables.length ? "population" : "yours",
    };
  };
}

/**
 * The declared spread of the balance worked from a purchase: 0.25 (the year and the price are both approximate) and 0.03 more
 * for each year since, as a refinance or a cash-out can reset a loan the purchase does not see; at most 0.8 (README "When the home
 * was bought": the purchase alone is 1.2 times the survey's median mortgage for under 35s and 0.65 to 0.45 times it from 55).
 */
const purchaseSigma = (yearsOld) => Math.min(0.8, 0.25 + 0.03 * Math.max(0, yearsOld));
/**
 * The balance a purchase leaves (purchase.js loanFrom) for the loan that began at `start`: the price as typed (only for
 * the purchase itself), else today's value (typed or our guess) taken back with the price index. -> { balance, valueNow,
 * sourceWords, tables } | null
 */
function loanOf(plan, { start, rate, today, args, path, prof, home, lib, loanId }) {
  const hp = homePathOf(plan, path, loanId);
  const valueNow = home ?? (hp ? lib.estimate("home.value", { path: hp, args })?.value ?? null : null);
  const price = start.via === "typed" ? start.price ?? null : null;
  const loan = loanFrom({ startDate: start.date, today, valueNow, price, state: prof.state, age: prof.age, rate, term: start.term });
  if (!loan) return null;
  const down = Math.round(loan.down * 100);
  // a year typed too long ago to be this loan's start (`stale`): say the loan is counted from our year, never "typical in 2013" under "you bought in 1995" (verify 2026-11-07)
  const sourceWords = start.stale
    ? fit(`counted like most owners your age, from about ${start.year}: a ${start.stale} loan would be paid off by now`, `counted from about ${start.year}, like most owners your age`)
    : fit(`typical in ${start.year} with ${down}% paid up front, then paid down since`, `a ${start.year} home, ${down}% paid up front`);
  return { balance: loan.balance, pi: loan.pi, yearsOld: loan.yearsOld, valueNow, sourceWords, tables: [prof.state ? PT.hpi : PT.hpiUS, PT.buyers] };
}

export const estimators = {
  "debt.mortgage.rate": {
    tier: 2, order: 4, label: "Mortgage interest rate", unit: "rate", weight: "big", page: LIABILITIES, reads: [],
    fn(plan, { today, path, args } = {}, lib) {
      const st = stateOf(plan);
      // the loan began in a year we know or can guess (the year bought, typed or ours): that year's average 30-year rate,
      // unless a refinance was answered on the tap (the rules below) or the payment and balance are both typed and no year is
      // (then nothing about that loan moves)
      if (lib) {
        const rec = recordOf(plan, "mortgage", path), known = knownOf(plan, rec, args);
        const prof = lib.memo("profile", () => profileOf(plan, today));
        const start = startOf(plan, rec, { today, args, prof });
        const both = known.payment !== null && known.owed !== null;
        // a year typed: that year's average rate (the owner's rule); a refinance answered on the tap: the average over its years (a
        // loan taken out 2022 or later is read below from the state's new-loan rate); a year we guess: the rate for the age's
        // move-in years eased toward what loans people already have charge (purchase.js guessedRate)
        // (both typed: nothing about that loan moves, a purchase date typed on Home included; bought verify, defect 4)
        if (start?.via === "typed" && !both) {
          return { value: rateInYear(start.year), sigma: null, measured: false, why: `the average 30-year mortgage rate in ${start.year}`, uses: { year: "typed" }, sharperWith: [], tables: [PT.rate] };
        }
        if (start?.via === "loan" && !both) {
          return { value: rateInYear(start.year), sigma: null, measured: false, why: `the average 30-year mortgage rate in ${start.year}, when your loan started`, uses: { "loan-start": "typed" }, sharperWith: [], tables: [PT.rate] };
        }
        if (start?.via === "tap" && !both && TAP_YEARS[tapOf(plan, args, "mortgage-start")]) {
          // the span's years from when the oldest adult was about 20 (tapSpan)
          const y0 = start.from, y1 = start.to;
          return { value: rateMean(y0, y1), sigma: null, measured: false, why: y0 === y1 ? `the average 30-year rate in ${y0}` : `the average 30-year rate from ${y0} to ${y1}`, uses: { "mortgage-start": "typed" }, sharperWith: [], tables: [PT.rate] };
        }
        if (start?.via === "guess" && !both) {
          const st0 = stateOf(plan);
          const out = (st0 && ok(cell(STATE_NOW, RATE, st0)) ? cell(STATE_NOW, RATE, st0) : cell(US_NOW, RATE, "by loan count")) / 100;
          return { value: guessedRate({ age: prof.age, today, outstanding: ok(out) ? out : null }), sigma: null, measured: false, why: `the usual rate for loans from about ${start.year}, eased toward today's`, uses: { year: "guess" }, sharperWith: start.stale ? [WHEN_TAKEN] : [WHEN_BOUGHT], tables: uniq([PT.rate, PT.moved, PT.owners, st0 ? STATE_NOW : US_NOW]) };
        }
      }
      const recent = tapOf(plan, args, "mortgage-start") === "2022on" && (!lib || !!tapSpan("2022on", { today, age: lib.memo("profile", () => profileOf(plan, today)).age }));
      if (recent && st && ok(cell(STATE_NEW, RATE, st))) {
        return { value: cell(STATE_NEW, RATE, st) / 100, sigma: null, measured: false, why: `the average on new home loans in ${STATE_NAME[st]} lately`, uses: { state: "typed", "mortgage-start": "typed" }, sharperWith: [], tables: [STATE_NEW] };
      }
      // taken out 2022 or later and no state: the U.S. rate on 2025 home-purchase loans, not on loans people already have
      if (recent && !st && ok(cell(US_NEW, RATE, "All Mortgages (Home Purchase)"))) {
        return { value: cell(US_NEW, RATE, "All Mortgages (Home Purchase)") / 100, sigma: null, measured: false, why: "the average on new U.S. home loans lately", uses: { "mortgage-start": "typed" }, sharperWith: [YOUR_STATE], tables: [US_NEW] };
      }
      if (st && ok(cell(STATE_NOW, RATE, st))) {
        return { value: cell(STATE_NOW, RATE, st) / 100, sigma: null, measured: false, why: `the average on ${STATE_NAME[st]} mortgages people already have`, uses: { state: "typed" }, sharperWith: recent ? [] : [WHEN_TAKEN], tables: [STATE_NOW] };
      }
      const us = cell(US_NOW, RATE, "by loan count");
      if (!ok(us)) return null;
      return { value: us / 100, sigma: null, measured: false, why: "the average on U.S. mortgages people already have", uses: {}, sharperWith: [YOUR_STATE, ...(recent ? [] : [WHEN_TAKEN])], tables: [US_NOW] };
    },
  },
  "debt.mortgage.owed": {
    tier: 2, order: 5, label: "Mortgage still owed", unit: "total", weight: "big", page: LIABILITIES,
    reads: ["home.boughtYear", "home.value", "home.propertyTax", "home.insurance", "debt.mortgage.rate"],
    fn(plan, { today, path, args }, lib) {
      const prof = lib.memo("profile", () => profileOf(plan, today));
      const st = prof.state, rec = recordOf(plan, "mortgage", path), known = knownOf(plan, rec, args), loanId = loanIdOf(rec);
      const rate = rateFor(plan, "mortgage", rec, args, lib, known);
      if (!rate) return null;
      const tables = [...from(rate)];
      // the payment identity: principal and interest = the payment less the usual tax and insurance (unless the escrow tap
      // says they are paid apart; Not sure counts them in); B_max = what that pays off over 30 years
      let pi = null;
      if (known.payment !== null) {
        const esc = escrowFor(plan, rec, { today, args, loanId }, lib);
        // never less than half the payment: a payment near the usual tax and insurance may well not include them, so the
        // figure falls smoothly to half the payment instead of to almost nothing (and a higher payment never owes less)
        pi = Math.max(known.payment - (esc?.total ?? 0), known.payment / 2);
        if (esc && !esc.typed) tables.push(PTAX, HO3);
      }
      // the refinance question is asked once a payment is typed, and when a year typed is too long ago to be the loan's start
      const ask = known.payment !== null || staleYear(plan, rec, { today, args }) !== null ? mortgageAsk({ today, age: prof.age }) : null;
      // when the loan began: its start typed on Debts, a tap, the year typed, else the usual year for an owner of this age (home.boughtYear)
      const start = startOf(plan, rec, { today, args, prof });
      const left = start ? monthsLeftFrom(start.date, today, start.term) : null;
      const atRate = rate.typed ? "your rate" : st ? `${possessiveOf(st)} usual rate` : "the usual rate";
      const hv = homeValueFor(plan, { args, loanId });
      const home = hv?.typed ? hv.value : null;
      const guessed = start?.via === "guess";
      const startTables = guessed ? [PT.moved, PT.owners] : [];
      if (pi !== null && left !== null) {
        // never more than the home is worth: its value as typed, else as we guess it (a payment far above the usual one is read,
        // but a loan larger than its home is no loan: review D4)
        let cap = home;
        if (cap === null) { const hp = homePathOf(plan, path, loanId); cap = hv?.value ?? (hp ? lib.estimate("home.value", { path: hp, args })?.value ?? null : null); }
        const value = cap !== null ? Math.min(pv(rate.value / 12, left, pi), cap) : pv(rate.value / 12, left, pi);
        const when = start.stale ? `a loan from about ${start.year}, our guess` : guessed ? `the ${start.year} purchase we guess` : start.via === "typed" ? `the ${start.year} purchase` : start.via === "loan" ? `the loan's ${start.year} start` : "when you took it out";
        return { value, sigma: guessed ? 0.25 : 0.15, measured: false, why: fit(`worked back from your ${money(known.payment)} payment and ${when}`, "worked back from your payment and when you took it out"), uses: { payment: "typed", [start.via === "tap" ? "mortgage-start" : start.via === "loan" ? "loan-start" : "year"]: start.via === "guess" ? "guess" : "typed", rate: rate.typed ? "typed" : "guess" }, sharperWith: start.stale ? [WHEN_TAKEN] : guessed ? [WHEN_BOUGHT] : [], tables: uniq([...tables, ...startTables]), ask };
      }
      // priors: (a) a home value typed x the state's average loan-to-value on mortgages people have; (b) FHFA balance per
      // loan in the state x the survey's median-to-mean x its income ratio and income-adjusted age ratio (R2)
      const ltv = cell(STATE_NOW, "Average mark-to-market loan-to-value (%)", st ?? "US");
      let prior = null;
      if (home !== null && ok(ltv)) {
        prior = { value: home * ltv / 100, sigma: MORTGAGE_SIGMA(), measured: false, why: `about ${Math.round(ltv)}% of your home's value, usual for ${placeOf(st).replace(/^an? /, "")} mortgages`, short: `${Math.round(ltv)}% of your home's value, usual in ${st ? placeName(st) : "the U.S."}`, tables: [STATE_NOW] };
      } else {
        const per = perLoanOf(st), r = scfR2("mortgageOnPrimaryResidence", { income: prof.income, age: prof.age });
        if (!per || !r) return null;
        const at = scfPrior("mortgage", prof)?.at;
        prior = { value: per.value * D_BAL.scfMortgageMedianToMean.value * r.parts.rInc * r.parts.resid, sigma: MORTGAGE_SIGMA(), measured: true, why: `typical for ${placeOf(st)} mortgage${at ? ` at ${at}` : ""}`, short: `typical in ${st ? placeName(st) : "the U.S."}${at ? ` at ${at}` : ""}`, tables: [per.table, ...SCF_TABLES] };
      }
      // the purchase: price (typed, or today's value taken back with the price index) less the usual down payment, at the
      // rate of the loan, paid for the months since it began; combined in logs with the prior above (README "When the home
      // was bought": the prior alone cannot tell a 25-year-old's loan from a 60-year-old's)
      const bought = start && pi === null ? loanOf(plan, { start, rate: rate.value, today, args, path, prof, home, lib, loanId }) : null;
      if (bought) {
        const both = combineLog({ value: bought.balance, sigma: purchaseSigma(bought.yearsOld) }, { value: prior.value, sigma: prior.sigma });
        const value = home !== null ? Math.min(both.value, home) : Math.min(both.value, bought.valueNow ?? Infinity);
        const w = bought.sourceWords;
        return {
          value, sigma: both.sigma, measured: false, why: fit(w, `worked from ${start.via === "tap" ? "when you took it out" : `a ${start.year} purchase`}`, "worked from when the home was bought"),
          uses: { [start.via === "tap" ? "mortgage-start" : start.via === "loan" ? "loan-start" : "year"]: start.via === "guess" ? "guess" : "typed", home: home !== null ? "typed" : null, state: st ? "typed" : null, age: prof.age !== null ? "typed" : null },
          sharperWith: [guessed && !start.stale ? WHEN_BOUGHT : WHAT_YOU_PAY, ...(st ? [] : [YOUR_STATE])].slice(0, 2),
          tables: uniq([...prior.tables, ...tables, ...bought.tables, ...startTables]), ask,
        };
      }
      let value = prior.value, whys = [prior.why];
      if (pi !== null) {
        const most = pv(rate.value / 12, MORTGAGE_TERM, pi);
        // the payment pays off at most `most` in 30 years: below the typical balance it decides; above, it is read and
        // said so, so a payment typed never looks ignored
        if (most < value) { value = most; whys = [`worked back from your ${money(known.payment)} payment at ${atRate}`, "worked back from your payment"]; }
        else whys = [`${prior.why}; your payment covers it`, `${prior.short}; your payment covers it`, prior.why];
      }
      return {
        value, sigma: prior.sigma, measured: prior.measured && value === prior.value, why: fit(...whys, prior.why),
        uses: { payment: known.payment !== null ? "typed" : null, home: home !== null ? "typed" : null, state: st ? "typed" : null, pay: prof.payHow, age: prof.age !== null ? "typed" : null },
        sharperWith: known.payment !== null ? [WHEN_TAKEN, ...(st ? [] : [YOUR_STATE])] : sharpers(prof, [WHAT_YOU_PAY]),
        tables: uniq([...prior.tables, ...tables]), ask,
      };
    },
  },
  "debt.mortgage.payment": {
    tier: 2, order: 6, label: "Mortgage payment a month", unit: "month", weight: "big", page: LIABILITIES,
    reads: ["home.boughtYear", "home.value", "home.propertyTax", "home.insurance", "debt.mortgage.rate", "debt.mortgage.owed"],
    fn(plan, { today, path, args }, lib) {
      const prof = lib.memo("profile", () => profileOf(plan, today));
      const st = prof.state;
      const rec = recordOf(plan, "mortgage", path), known = knownOf(plan, rec, args);
      const rate = rateFor(plan, "mortgage", rec, args, lib, known), owed = owedFor(plan, "mortgage", rec, args, lib, known);
      if (!rate || !owed) return null;
      // the months left come from when the loan began (a tap, the year typed, else the year we guess), whether the balance
      // is typed or ours: the balance we guess is worked from the same start, so the two agree. With no start at all, a
      // full term (a balance that is the population's typical one already sits midway through its loans).
      const start = startOf(plan, rec, { today, args, prof });
      const left = (start ? monthsLeftFrom(start.date, today, start.term) : null) ?? MORTGAGE_TERM;
      const esc = escrowFor(plan, rec, { today, args, loanId: loanIdOf(rec) }, lib);
      // principal and interest: what pays the balance off over the months left; but a balance of ours above what the purchase's loan
      // still owes (blended up toward the survey's figure: a refinance or a cash-out restarted the clock) is paid at that loan's own
      // principal and interest, never more than the loan needs (the months then follow from it, nper; at most a new 30-year loan's
      // payment is needed): bought verify defect 3, 1.08x to 1.43x for owners 61 to 80 (2026-11-07)
      let pi = pmt(rate.value / 12, left, owed.value);
      if (!owed.typed && start) {
        const hv = homeValueFor(plan, { args, loanId: loanIdOf(rec) });
        const bought = loanOf(plan, { start, rate: rate.value, today, args, path, prof, home: hv?.typed ? hv.value : null, lib, loanId: loanIdOf(rec) });
        if (bought && ok(bought.pi) && owed.value > bought.balance + 0.5) pi = Math.min(pi, Math.max(bought.pi, pmt(rate.value / 12, MORTGAGE_TERM, owed.value)));
      }
      const guessed = start?.via === "guess";
      const tables = uniq([...from(rate, owed), ...(esc && !esc.typed ? [PTAX, HO3] : []), ...(guessed ? [PT.moved, PT.owners] : [])]);
      const plus = esc ? (esc.typed ? ", plus the tax and insurance you gave" : `, plus ${st ? `${possessiveOf(st)} usual` : "the usual"} tax and insurance`) : "";
      return {
        // to $10 inside the estimator (as the card minimum is), not R11's $50 above $1,000: the pages turn this payment, less its tax
        // and insurance, into the years left, and a $50 step moved a 25-year-old's 28 years to 26 or to 30 (verify 2026-11-07)
        value: Math.round((pi + (esc?.total ?? 0)) / 10) * 10, rounded: true, sigma: null, measured: false,
        why: fit(`a loan of about ${money(owed.value)} at ${pctWords(rate.value)}${plus}`, `a loan of about ${money(owed.value)} at ${pctWords(rate.value)}, plus the usual tax and insurance`, `a loan of about ${money(owed.value)} at ${pctWords(rate.value)}`),
        uses: { owed: owed.typed ? "typed" : "guess", rate: rate.typed ? "typed" : "guess", ...(start ? { [start.via === "tap" ? "mortgage-start" : start.via === "loan" ? "loan-start" : "year"]: guessed ? "guess" : "typed" } : {}) },
        // the start answered sharpens nothing more here; the payment itself does (what you pay a month)
        sharperWith: start?.via === "tap" || start?.via === "typed" || start?.via === "loan" ? (owed.typed ? [] : [WHAT_YOU_PAY]) : guessed && !start.stale ? [WHEN_BOUGHT] : [WHEN_TAKEN], tables, basis: tables.length ? "population" : "yours",
      };
    },
  },
  "debt.car-loan.rate": {
    tier: 2, order: 7, label: "Car loan interest rate", unit: "rate", weight: "small", page: LIABILITIES, reads: [],
    fn(plan, { today, path, args } = {}, lib) {
      const prof = lib.memo("profile", () => profileOf(plan, today));
      const cls = carClassOf(plan, recordOf(plan, "car-loan", path), args, prof);
      // used: Experian's average (an industry survey); new: the Federal Reserve's bank rate on a 72-month new-car loan
      const r = cls === "used" ? carCell("Average loan rate (%)", "used") : cell(G19_AUTO, "New car loan, 72-month (commercial banks)");
      if (!ok(r)) return null;
      return { value: r / 100, sigma: null, measured: false, why: cls === "used" ? "the average rate on a used-car loan" : "the average bank rate on a new-car loan", uses: {}, sharperWith: [], tables: [cls === "used" ? EXPERIAN : G19_AUTO] };
    },
  },
  "debt.car-loan.owed": {
    tier: 2, order: 8, label: "Car loan still owed", unit: "total", weight: "big", page: LIABILITIES, reads: ["debt.car-loan.rate"],
    fn(plan, { today, path, args }, lib) {
      const prof = lib.memo("profile", () => profileOf(plan, today));
      const rec = recordOf(plan, "car-loan", path), known = knownOf(plan, rec, args);
      const prior = scfPrior("car-loan", prof);
      const typical = prior?.at ? `typical car loan balance at ${prior.at}` : "typical car loan balance among people who have one";
      if (known.payment === null) {
        if (!prior) return null;
        return { value: prior.value, sigma: prior.sigma, measured: prior.sigma !== null, why: fit(typical, "typical car loan balance among people who have one"), uses: { pay: prof.payHow, age: prof.age !== null ? "typed" : null }, sharperWith: sharpers(prof, [WHAT_YOU_PAY]), tables: SCF_TABLES };
      }
      const rate = rateFor(plan, "car-loan", rec, args, lib, known);
      if (!rate) return null;
      const cls = carClassOf(plan, rec, args, prof), term = carCell("Average loan term (months)", cls);
      const r = rate.value / 12, p = known.payment;
      const start = tapOf(plan, args, "car-loan-start"), left = carMonthsLeft(start, term, prof.age);
      const tables = uniq([EXPERIAN, ...from(rate)]);
      if (left !== null) {
        return { value: pv(r, left, p), sigma: 0.25, measured: false, why: fit(`worked back from your ${money(p)} payment and when you got the loan`, "worked back from your payment and when you got the loan"), uses: { payment: "typed", "car-loan-start": "typed" }, sharperWith: [], tables, ask: carAsk(prof.age) };
      }
      // halfway through a usual loan, its spread from a quarter to three quarters of the way (the middle half), combined
      // with what families like this owe (R4)
      const mid = pv(r, term / 2, p), lo = pv(r, term / 4, p), hi = pv(r, term * 3 / 4, p);
      const fromPay = { value: mid, sigma: Math.log(hi / lo) / 1.349 };
      const both = prior ? combineLog(fromPay, { value: prior.value, sigma: prior.sigma }) : fromPay;
      return {
        value: both.value, sigma: both.sigma, measured: false,
        why: fit(`worked back from your ${money(p)} payment, about halfway through a usual loan`, `worked back from your ${money(p)} payment, halfway through a usual loan`, "worked back from your payment, halfway through a usual loan"),
        uses: { payment: "typed", rate: rate.typed ? "typed" : "guess" }, sharperWith: [WHEN_CAR], tables: uniq([...tables, ...(prior ? SCF_TABLES : [])]),
        ...(both.sigma > 0.5 ? { ask: carAsk(prof.age) } : {}),
      };
    },
  },
  "debt.car-loan.payment": {
    tier: 2, order: 9, label: "Car loan payment a month", unit: "month", weight: "big", page: LIABILITIES, reads: ["debt.car-loan.rate", "debt.car-loan.owed"],
    fn(plan, { today, path, args }, lib) {
      const prof = lib.memo("profile", () => profileOf(plan, today));
      const rec = recordOf(plan, "car-loan", path), known = knownOf(plan, rec, args);
      const rate = rateFor(plan, "car-loan", rec, args, lib, known), owed = owedFor(plan, "car-loan", rec, args, lib, known);
      if (!rate || !owed) return null;
      const term = carCell("Average loan term (months)", carClassOf(plan, rec, args, prof));
      const left = (owed.typed ? carMonthsLeft(tapOf(plan, args, "car-loan-start"), term, prof.age) : null) ?? term / 2;
      return {
        value: pmt(rate.value / 12, left, owed.value), sigma: null, measured: false,
        why: fit(`what pays off ${money(owed.value)} at ${pctWords(rate.value)} in about ${Math.round(left)} months`, `what pays off what you owe in about ${Math.round(left)} months`),
        uses: { owed: owed.typed ? "typed" : "guess", rate: rate.typed ? "typed" : "guess" }, sharperWith: [], tables: uniq([EXPERIAN, ...from(rate, owed)]),
      };
    },
  },
  "debt.credit.rate": {
    tier: 2, order: 10, label: "Credit card interest rate", unit: "rate", weight: "big", page: LIABILITIES, reads: [],
    fn() {
      const r = cell("cc_apr_fed_g19", "Credit card plans, accounts assessed interest (commercial banks)");
      return ok(r) ? { value: r / 100, sigma: null, measured: false, why: "the average rate on cards that charge interest", uses: {}, sharperWith: [], tables: ["cc_apr_fed_g19"] } : null;
    },
  },
  "debt.credit.owed": {
    tier: 2, order: 11, label: "Credit cards still owed", unit: "total", weight: "big", page: LIABILITIES, reads: ["debt.credit.rate"],
    fn(plan, { today, path, args }, lib) {
      const prof = lib.memo("profile", () => profileOf(plan, today));
      const rec = recordOf(plan, "credit", path), known = knownOf(plan, rec, args);
      const prior = scfPrior("credit", prof);
      if (!prior) return null;
      const words = prior.at ? `typical card balance at ${prior.at}` : "typical card balance among people who carry one";
      let value = prior.value, why = words;
      const rate = known.payment !== null ? rateFor(plan, "credit", rec, args, lib, known) : null;
      if (rate) {
        // paying at least the usual minimum (1% of the balance plus the month's interest), a payment covers at most this much
        const share = cell(CFPB, "Most common percent-of-balance component (percent of statement balance; interest, fees and past-due amounts added on top)") / 100;
        const most = known.payment / (share + rate.value / 12);
        if (most < value) { value = most; why = `worked back from your ${money(known.payment)} payment, if that's the minimum`; }
      }
      return { value, sigma: prior.sigma, measured: prior.sigma !== null && value === prior.value, why: fit(why, words, "typical card balance among people who carry one"), uses: { pay: prof.payHow, age: prof.age !== null ? "typed" : null }, sharperWith: sharpers(prof, known.payment === null ? [WHAT_YOU_PAY] : []), tables: uniq([...SCF_TABLES, ...(rate ? [CFPB, ...from(rate)] : [])]) };
    },
  },
  "debt.credit.payment": {
    tier: 2, order: 12, label: "Credit card payment a month", unit: "month", weight: "big", page: LIABILITIES, reads: ["debt.credit.rate", "debt.credit.owed"],
    fn(plan, { path, args }, lib) {
      const rec = recordOf(plan, "credit", path), known = knownOf(plan, rec, args);
      const rate = rateFor(plan, "credit", rec, args, lib, known), owed = owedFor(plan, "credit", rec, args, lib, known);
      if (!rate || !owed) return null;
      const share = cell(CFPB, "Most common percent-of-balance component (percent of statement balance; interest, fees and past-due amounts added on top)") / 100;
      const floor = cell(CFPB, "Most common dollar floor ($; minimum is the higher of the floor or the formula, never more than the balance)");
      if (!ok(share) || !ok(floor)) return null;
      // the usual minimum: 1% of the balance plus the month's interest, $40 at least, never more than the balance (CFPB)
      // rounded here, so the rounding never lifts it above the balance ($35 owed: $35, not $40)
      const raw = Math.max(floor, owed.value * share + owed.value * rate.value / 12);
      const value = raw >= owed.value ? owed.value : Math.min(owed.value, roundGuess(raw, "month"));
      return { value, rounded: true, sigma: null, measured: false, why: "the month's interest plus 1% of what you owe, a usual minimum", uses: { owed: owed.typed ? "typed" : "guess", rate: rate.typed ? "typed" : "guess" }, sharperWith: [], tables: uniq([CFPB, ...from(rate, owed)]) };
    },
  },
  "debt.student.rate": {
    tier: 2, order: 13, label: "Student loan interest rate", unit: "rate", weight: "small", page: LIABILITIES, reads: [],
    fn() {
      const r = cell("student_loan_rates_federal", "Direct Subsidized and Unsubsidized, undergraduate");
      return ok(r) ? { value: r / 100, sigma: null, measured: false, why: "the federal rate on new undergraduate student loans", uses: {}, sharperWith: [], tables: ["student_loan_rates_federal"] } : null;
    },
  },
  "debt.student.owed": { tier: 2, order: 14, label: "Student loans still owed", unit: "total", weight: "big", page: LIABILITIES, reads: ["debt.student.rate"], fn: termOwed("student", "student loan balance") },
  "debt.student.payment": { tier: 2, order: 15, label: "Student loan payment a month", unit: "month", weight: "small", page: LIABILITIES, reads: ["debt.student.rate", "debt.student.owed"], fn: termPayment("student", "10 years, the standard plan") },
  "debt.loan.rate": {
    tier: 2, order: 16, label: "Loan interest rate", unit: "rate", weight: "small", page: LIABILITIES, reads: [],
    fn() {
      const r = cell("auto_personal_rate_fed_g19", "Personal loan, 24-month (commercial banks)");
      return ok(r) ? { value: r / 100, sigma: null, measured: false, why: "the average bank rate on a two-year personal loan", uses: {}, sharperWith: [], tables: ["auto_personal_rate_fed_g19"] } : null;
    },
  },
  "debt.loan.owed": { tier: 2, order: 17, label: "Loan still owed", unit: "total", weight: "small", page: LIABILITIES, reads: ["debt.loan.rate"], fn: termOwed("loan", "balance on a loan like this") },
  "debt.loan.payment": { tier: 2, order: 18, label: "Loan payment a month", unit: "month", weight: "small", page: LIABILITIES, reads: ["debt.loan.rate", "debt.loan.owed"], fn: termPayment("loan", "3 years") },
};

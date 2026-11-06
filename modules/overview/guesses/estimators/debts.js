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
import { escrowMonthly, homeValueFor } from "./home.js";
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
/** Months of a 30-year loan still to pay, from the middle of the start span to today (null without a tap or a date). */
function monthsLeftOf(start, today) {
  const mid = MORTGAGE_START[start];
  if (!mid || !today) return null;
  const gone = monthsBetween(mid, today);
  return gone === null ? null : Math.max(12, MORTGAGE_TERM - gone);
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
const carMonthsLeft = (start, term) => (start === "5+" ? 6 : CAR_GONE[start] !== undefined ? Math.max(6, term - CAR_GONE[start]) : null);
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

export const estimators = {
  "debt.mortgage.rate": {
    tier: 2, order: 4, label: "Mortgage interest rate", unit: "rate", weight: "big", page: LIABILITIES, reads: [],
    fn(plan, { args } = {}) {
      const st = stateOf(plan);
      const recent = tapOf(plan, args, "mortgage-start") === "2022on";
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
    reads: ["home.value", "home.propertyTax", "home.insurance", "debt.mortgage.rate"],
    fn(plan, { today, path, args }, lib) {
      const prof = lib.memo("profile", () => profileOf(plan, today));
      const st = prof.state, rec = recordOf(plan, "mortgage", path), known = knownOf(plan, rec, args);
      const rate = rateFor(plan, "mortgage", rec, args, lib, known);
      if (!rate) return null;
      const start = tapOf(plan, args, "mortgage-start");
      const tables = [...from(rate)];
      // the payment identity: principal and interest = the payment less the usual tax and insurance (unless the escrow tap
      // says they are paid apart; Not sure counts them in); B_max = what that pays off over 30 years
      let pi = null;
      if (known.payment !== null) {
        const esc = tapOf(plan, null, "escrow") === "no" ? null : escrowMonthly(plan, { today, args }, lib);
        // never less than half the payment: a payment near the usual tax and insurance may well not include them, so the
        // figure falls smoothly to half the payment instead of to almost nothing (and a higher payment never owes less)
        pi = Math.max(known.payment - (esc?.total ?? 0), known.payment / 2);
        if (esc) tables.push(PTAX, HO3);
      }
      const ask = known.payment !== null ? MORTGAGE_ASK : null;
      const left = monthsLeftOf(start, today);
      const atRate = rate.typed ? "your rate" : st ? `${possessiveOf(st)} usual rate` : "the usual rate";
      if (pi !== null && left !== null) {
        return { value: pv(rate.value / 12, left, pi), sigma: 0.15, measured: false, why: fit(`worked back from your ${money(known.payment)} payment and when you took it out`, "worked back from your payment and when you took it out"), uses: { payment: "typed", "mortgage-start": "typed", rate: rate.typed ? "typed" : "guess" }, sharperWith: [], tables: uniq(tables), ask };
      }
      // priors: (a) a home value typed x the state's average loan-to-value on mortgages people have; (b) FHFA balance per
      // loan in the state x the survey's median-to-mean x its income ratio and income-adjusted age ratio (R2)
      const hv = homeValueFor(plan, { args });
      const home = hv?.typed ? hv.value : null;
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
    reads: ["home.value", "home.propertyTax", "home.insurance", "debt.mortgage.rate", "debt.mortgage.owed"],
    fn(plan, { today, path, args }, lib) {
      const st = lib.memo("profile", () => profileOf(plan, today)).state;
      const rec = recordOf(plan, "mortgage", path), known = knownOf(plan, rec, args);
      const rate = rateFor(plan, "mortgage", rec, args, lib, known), owed = owedFor(plan, "mortgage", rec, args, lib, known);
      if (!rate || !owed) return null;
      // the tap's months left go with a balance the person typed; a balance that is the population's typical one already
      // sits midway through its loans, so it is paid over a full term (a tap never turns it into a short, steep payment)
      const start = tapOf(plan, args, "mortgage-start");
      const left = (owed.typed ? monthsLeftOf(start, today) : null) ?? MORTGAGE_TERM;
      const esc = tapOf(plan, null, "escrow") === "no" ? null : escrowMonthly(plan, { today, args }, lib);
      const tables = uniq([...from(rate, owed), ...(esc ? [PTAX, HO3] : [])]);
      const plus = esc ? `, plus ${st ? `${possessiveOf(st)} usual` : "the usual"} tax and insurance` : "";
      return {
        value: pmt(rate.value / 12, left, owed.value) + (esc?.total ?? 0), sigma: null, measured: false,
        why: fit(`a loan of about ${money(owed.value)} at ${pctWords(rate.value)}${plus}`, `a loan of about ${money(owed.value)} at ${pctWords(rate.value)}, plus the usual tax and insurance`, `a loan of about ${money(owed.value)} at ${pctWords(rate.value)}`),
        uses: { owed: owed.typed ? "typed" : "guess", rate: rate.typed ? "typed" : "guess" },
        // the start tap answered sharpens nothing more here; the payment itself does (what you pay a month)
        sharperWith: MORTGAGE_START[start] ? (owed.typed ? [] : [WHAT_YOU_PAY]) : [WHEN_TAKEN], tables, basis: tables.length ? "population" : "yours",
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
      const start = tapOf(plan, args, "car-loan-start"), left = carMonthsLeft(start, term);
      const tables = uniq([EXPERIAN, ...from(rate)]);
      if (left !== null) {
        return { value: pv(r, left, p), sigma: 0.25, measured: false, why: fit(`worked back from your ${money(p)} payment and when you got the loan`, "worked back from your payment and when you got the loan"), uses: { payment: "typed", "car-loan-start": "typed" }, sharperWith: [], tables, ask: CAR_ASK };
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
        ...(both.sigma > 0.5 ? { ask: CAR_ASK } : {}),
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
      const left = (owed.typed ? carMonthsLeft(tapOf(plan, args, "car-loan-start"), term) : null) ?? term / 2;
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

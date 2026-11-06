// modules/overview/guesses/estimators/spend.js -- PURE. A month's spending, row by row (spec 7.0, 7.A: E01-E09, R10).
// Formulas and sources: ../README.md "Spending".
//
//   spend.housing ... spend.shopping   the eight rows of Get started's spending screen (setup's SPEND), each a guess at
//                     expenses[setup-x-<row>].amount, a month. Flexible rows (utilities, groceries, car and transit,
//                     insurance and health, eating out, shopping) come from the Consumer Expenditure Surveys' share of
//                     after-tax income spent on the row, by income (sQ), household type and region (R5 ratios), times the
//                     household's take-home a (7.0); rent from the state's median rent; home costs from upkeep, the HOA fee
//                     and (with no mortgage) property tax and insurance; childcare from the state's center prices; health
//                     cover by how it is had (a tap). The flexible rows are then scaled down by k (R10) so the guessed rows,
//                     the typed bills and the loan payments together stay inside what households like this spend in all
//                     (the envelope).
//   takeHome(plan, today, prof)        a (7.0): the household's income a year less federal and state income tax
//   spendTenure(plan, prof)            the home as the rows price it: a mortgage counts only while one is owed
//   spendModel(plan, o, lib)           every row at once: { rows: { [row]: { value, fixed, flex, ask, ... } }, k, envelope,
//                                      a, typed, guessed, ... }; memoised per pass (lib.memo)
//   spendBasis(plan, o, lib)           the screen's one basis line (5.6): "... one adult renting in Texas on about $48,000 a year."
//   RETIRE_RATIO                        what households 65-74 spend on a row over households 55-64 (7.F, CE by age)
//   bankSpend(plan, today)             R12 (C7): what the bank files show going out a month, row by row, over the last whole
//                                      months they cover (at most six; two or more turn R12 on): the person's own figures
//                                      beat the population's, so a row of ours becomes its bank average
//   missingSpend(plan, o, lib)         E10 (11.6, C7): a typed list far below the household's guessed total, with the rows
//                                      "Add our guesses for the rest" would write
//
// What counts as typed (the screen and the plan read the same, so the grey figure is exactly what saving the blank box
// writes, and stays so after the settle that follows): `args` = the screen's answers ({ mode, rows: { [row]: number |
// null }, total, taps }; null = left blank) when given, else the plan: a setup row whose amount is our guess is guessed,
// any other bill is typed, and a row typed as 0 (guide.setup.spendZero) is the person's 0. A guessed row never counts a
// bill twice: a bill typed elsewhere in its categories (Expenses) comes off it. Nothing here reads a guessed row's
// current figure, so a pass that refreshes one row never moves another.
import { T as SP, DERIVED as D_SPEND } from "../data/spend.js";
import { T as HOME, DERIVED as D_HOME } from "../data/home.js";
import { T as HEALTH } from "../data/health.js";
import { STATE_NAME, STATE_REGION, READ_ON } from "../data/index.js";
import { FEDERAL } from "../../../taxes/federal/data/federal.js";
import { FLAT, NO_WAGE_TAX, flatTax } from "../../../taxes/state/compute.js";
import { compute as computeExpenses, ROW_HOLDS, BANK_SPREAD, mortgageLines } from "../../../cashflow/expenses/compute.js";
import { monthOf, coverage, coverageByAccount, monthCover, monthGaps, cardPayments, isCardAccount, monthsWords } from "../../../transactions/ledger/compute.js";
import { categoriesOf } from "../../../transactions/categories/compute.js";
import { federalTax, paramsFor } from "../../../../core/math/tax.js";
import { interpLog } from "../../../../core/math/estimate.js";
import { ageOn } from "../../../../core/math/dates.js";
import { perYear, perMonth, activeOn } from "../../../../core/math/periods.js";
import { isGuess } from "../../../../core/estimate/index.js";
import { profileOf, cpiSince, money, fit, ok, YOUR_STATE, YOUR_PAY } from "./common.js";
import { escrowMonthly, homeValueFor, homePathOf } from "./home.js";

const L = (p, k) => (Array.isArray(p?.[k]) ? p[k] : []);
const EXPENSES = () => "#/cashflow/expenses";

/** The rows, in the screen's order, and the Expenses categories each stands for (setup's SPEND `covers`; a test checks they agree). */
export const ROWS = ["housing", "utilities", "groceries", "transport", "insurance", "childcare", "dining", "shopping"];
export const COVERS = { housing: ["housing"], utilities: ["utilities", "phone"], groceries: ["groceries"], transport: ["transport"], insurance: ["insurance", "health"], childcare: ["childcare"], dining: ["dining", "fun"], shopping: ["shopping"] };
/** What a bill typed elsewhere comes off (Expenses' ROW_HOLDS): a row's own categories plus what the survey puts inside it
 *  (subscriptions and pets in eating out and fun, personal care in shopping). COVERS (setup's) decides which rows Q6 asks. */
export const OFF = ROW_HOLDS;
/** Bills of another kind whose name says they are the property tax or the home insurance part of an owner's home costs. */
export const PROPERTY_TAX_BILL = /\b(property|real[\s-]*estate|home|house)[\s-]*tax/i;
export const HOME_INSURANCE_BILL = /\b(home|house|homeowners?'?|dwelling|condo)\b[^,;]*\binsur/i;
/** A bill whose name says it is (or holds) car insurance: the survey has it in "Car, gas and transit", not in "Insurance and health". */
export const CAR_INSURANCE_BILL = /\b(car|cars|auto|vehicle|truck|motorcycle)\b[^,;]*\binsur/i;
/** Rows R10 scales (the survey's shares); housing, childcare and health premiums are prices and are not scaled. */
export const FLEX = ["utilities", "groceries", "transport", "insurance", "dining", "shopping"];
export const spendPath = (row) => `expenses[setup-x-${row}].amount`;
/** The survey's items in each row (education and gifts to charity are left out: they have goal pages; vehicle purchases
 *  and loan interest too: loans are on What you owe). `oop`: out-of-pocket care, the part of health beside a premium. */
export const ITEMS = {
  utilities: ["utilities"],
  groceries: ["foodAtHome", "housekeepingSupplies"],
  transport: ["gasolineAndOtherFuels", "vehicleMaintenanceRepairs", "vehicleRentalLeasesLicensesOther", "vehicleInsurance", "publicAndOtherTransportation"],
  insurance: ["healthcare", "lifeAndOtherPersonalInsurance"],
  oop: ["medicalServices", "drugs", "medicalSupplies"],
  dining: ["foodAwayFromHome", "entertainment", "alcoholicBeverages"],
  shopping: ["apparelAndServices", "personalCare", "furnishingsAndEquipment", "reading", "tobacco", "miscellaneous", "otherHouseholdExpenses"],
};

// ---- the share model (7.A)
const Q = "incomeQuintile", HH = "householdComposition", REG = "region", TEN = "housingTenure", AGE = "ageOfReferencePerson";
const QC = ["second20", "third20", "fourth20", "highest20"];          // the lowest fifth is left out (retirees spending savings)
const spendT = (d) => SP[`ce2025_spend_by_${d}`], profT = (d) => SP[`ce2025_profile_by_${d}`], afterT = (d) => SP[`ce2023_aftertax_income_by_${d}`] ?? null;
const at = (t, row, col) => { if (!t) return null; const i = t.cols.indexOf(col); const v = i >= 0 ? t.rows[row]?.[i] : null; return ok(v) ? v : null; };
const item = (d, c, name) => at(spendT(d), name, c) ?? 0;
const before = (d, c) => at(profT(d), "incomeBeforeTaxesMean", c);
/** [2025 before-tax income, 2023 after/before ratio] of the second to fifth fifths: the ratio for cells with no after-tax column. */
const TAXR = QC.map((c) => [before(Q, c), at(afterT(Q), "incomeAfterTaxesMean", c) / at(afterT(Q), "incomeBeforeTaxesMean", c)]);
/** A(cell): the cell's 2025 income before taxes x its 2023 after/before ratio (interpolated when the table has no column for it). */
export function afterTax(d, c) {
  const bt = before(d, c), t = afterT(d);
  const r = t && at(t, "incomeBeforeTaxesMean", c) ? at(t, "incomeAfterTaxesMean", c) / at(t, "incomeBeforeTaxesMean", c) : interpLog(TAXR, bt);
  return bt * r;
}
/** What the cell spends on a row a year; the envelope is every outlay: total less insurance and pensions, cash gifts and
 *  education, plus the mortgage principal paid (the survey's profile gives it as a negative figure). */
const amountOf = (d, c, row) => (row === "envelope"
  ? item(d, c, "totalExpenditures") - item(d, c, "personalInsuranceAndPensions") - item(d, c, "cashContributions") - item(d, c, "education") - (at(profT(d), "mortgagePrincipalPaid", c) ?? 0)
  : ITEMS[row].reduce((s, i) => s + item(d, c, i), 0));
const shareOf = (d, c, row) => amountOf(d, c, row) / afterTax(d, c);
const CURVES = new Map();
const curve = (row) => { if (!CURVES.has(row)) CURVES.set(row, QC.map((c) => [afterTax(Q, c), shareOf(Q, c, row)])); return CURVES.get(row); };
/** sQ_r(a): the share of after-tax income spent on a row at take-home a (log-log between the fifths, flat outside). */
export const sQ = (row, a) => interpLog(curve(row), a);
/** r_d(cell): the cell's share over all households', with the part its income explains taken out. 1 for an unknown cell. */
export function ratio(d, c, row) {
  if (!c || c === "all") return 1;
  return (shareOf(d, c, row) / shareOf(d, "all", row)) / (sQ(row, afterTax(d, c)) / sQ(row, afterTax(d, "all")));
}
// rent: rent per renter (rentedDwellings / share renting), as a share of after-tax income
const rentPer = (d, c) => item(d, c, "rentedDwellings") / (at(profT(d), "pctRenter", c) / 100);
const RENT_CURVE = QC.map((c) => [afterTax(Q, c), rentPer(Q, c) / afterTax(Q, c)]);
function rentRatio(hh) {
  if (!hh || hh === "all") return 1;
  return ((rentPer(HH, hh) / afterTax(HH, hh)) / (rentPer(HH, "all") / afterTax(HH, "all"))) / (interpLog(RENT_CURVE, afterTax(HH, hh)) / interpLog(RENT_CURVE, afterTax(HH, "all")));
}
/** What households 65-74 spend on a row over households 55-64 (7.F): the everyday rows carried into retirement. */
export const RETIRE_RATIO = Object.fromEntries(["utilities", "groceries", "transport", "dining", "shopping"].map((r) => [r, amountOf(AGE, "65-74", r) / amountOf(AGE, "55-64", r)]));

// ---- the household
/** The survey's household type (spec 5.4): one adult, a parent, a couple, by the oldest child; null for three adults or more. */
export function householdOf(plan, today) {
  const people = L(plan?.household, "people");
  const adults = people.filter((p) => p?.role !== "dependent").length;
  const kids = people.filter((p) => p?.role === "dependent").map((p) => (p?.birthDate && today ? ageOn(p.birthDate, today) : null));
  const known = kids.filter((k) => ok(k) && k >= 0);
  const oldest = known.length === kids.length && kids.length ? Math.max(...known) : null;
  const minor = kids.some((k) => k === null || k < 18);
  if (adults <= 1) return adults === 1 && kids.length && minor ? "oneParentChildUnder18" : adults === 1 ? "singlePersonAndOther" : null;
  if (adults === 2) {
    if (!kids.length) return "marriedCoupleOnly";
    if (oldest === null) return "marriedCoupleWithChildrenTotal";
    return oldest < 6 ? "marriedCoupleOldestChildUnder6" : oldest < 18 ? "marriedCoupleOldestChild6to17" : "marriedCoupleOldestChild18plus";
  }
  return null;
}
const kidsOf = (plan, today) => L(plan?.household, "people").filter((p) => p?.role === "dependent").map((p) => ({ id: p.id, age: p?.birthDate && today ? ageOn(p.birthDate, today) : null }));
/**
 * The home as the spending rows price it (spec 5.4's tenure): the profile's, except that a mortgage counts only while one is
 * owed (an account of type mortgage with a balance; Get started's hasMortgage). A mortgage picked on question 5 and later
 * removed or paid off is not one any more, so the property tax and insurance its payment held come back into the home
 * costs (C3 verify: they were counted nowhere, about $280 a month for Pat and Lee).
 */
export function spendTenure(plan, prof) {
  if (prof?.tenure !== "ownerWithMortgage") return prof?.tenure ?? "renter";
  return L(plan, "accounts").some((a) => a?.type === "mortgage" && Number(a.balance)) ? "ownerWithMortgage" : "ownerWithoutMortgage";
}
const yearOf = (today) => { const y = Number(String(today ?? "").slice(0, 4)); return y > 1900 ? y : Math.max(...Object.keys(FEDERAL).map(Number)); };

/** Typed pre-tax retirement saving a year (401(k), traditional IRA, HSA); guessed contributions are tier 4 and left out (5.3). */
function typedPretax(plan, today) {
  const types = new Map(L(plan, "accounts").map((a) => [a?.id, a?.type]));
  return L(plan?.retirement, "contributions").filter((c) => c && ["401k", "ira", "hsa"].includes(types.get(c.accountId)) && Number(c.amount) > 0 && !(typeof c.id === "string" && isGuess(plan, `retirement.contributions[${c.id}].amount`)) && (!today || activeOn(c, today)))
    .reduce((s, c) => s + perYear(c.amount, c.period ?? "monthly"), 0);
}

/**
 * a (7.0): the household's income a year (every line coming in today: pay, a business, a pension, Social Security; the
 * survey's after-tax income is all of it) less federal income tax (core/math/tax with the filing status, children under 17
 * (a child of unknown age counts as one), adults 65 or over and typed pre-tax saving; refundable credits included) and the
 * state's income tax: none in a state with no wage tax, the flat rule (taxes/state FLAT), a rate typed on the State page,
 * else (a graduated state, or no state) the survey's own combined ratio at that income for both taxes (taxRatio2023).
 * Self-employment tax and payroll tax are outlays like any other and are not in a. -> { a, gross, federal, state, how } | null
 */
export function takeHome(plan, today, prof = null) {
  const lines = L(plan, "income").filter((x) => x && x.period !== "once" && Number(x.amount) > 0 && (!today || activeOn(x, today)));
  let wages = 0, other = 0, ss = 0, untaxed = 0;
  for (const x of lines) {
    const y = perYear(x.amount, x.period);
    if (x.taxable === false) untaxed += y;
    else if (x.type === "salary" || x.type === "bonus") wages += y;
    else if (x.type === "social") ss += y;
    else other += y;
  }
  const gross = wages + other + ss + untaxed;
  if (!(gross > 0)) return null;
  const p = prof ?? profileOf(plan, today);
  const kids = kidsOf(plan, today), adults = p.adults.length;
  // the State page's own rate wins (as taxes/state reads it), then no wage tax, then the flat rule; else the survey's ratio
  const st = p.state, raw = plan?.taxes?.state?.rate;
  const typedRate = raw === null || raw === undefined || raw === "" || !Number.isFinite(Number(raw)) ? null : Number(raw);
  if (typedRate === null && !(st && (NO_WAGE_TAX[st] || FLAT[st]))) {
    const r = interpLog(D_SPEND.taxRatio2023.value.filter(([c]) => c !== "all").map(([, ratio, bt]) => [bt, ratio]), gross);
    return { a: gross * r, gross, federal: null, state: null, how: "survey" };
  }
  const P = paramsFor(FEDERAL, yearOf(today));
  const fs = plan?.household?.filingStatus;
  const status = P.status?.[fs] ? fs : "single";
  const pretax = Math.min(wages, typedPretax(plan, today));
  const under17 = kids.filter((k) => k.age === null || k.age < 17).length;
  const fed = federalTax({ filingStatus: status, wages: wages - pretax, otherOrdinary: other, socialSecurity: ss, dependentsUnder17: under17, otherDependents: kids.length - under17, ages65plus: p.adults.filter((x) => ok(x.age) && x.age >= 65).length }, P);
  let state = 0, how = "none";
  if (typedRate !== null) { state = typedRate * Math.max(0, fed.agi); how = "typed"; }
  else if (st && FLAT[st]) { state = flatTax(FLAT[st], fed.agi, { joint: status === "married_joint", people: adults + kids.length, adults, dependents: kids.length, fed: { deduction: fed.deduction?.amount ?? 0, standard: fed.deduction?.standard ?? 0 } }).tax; how = "flat"; }
  return { a: gross - fed.totalTax - state, gross, federal: fed.totalTax, state, how };
}

// ---- prices
const STATE_OR_US = (t, row, st) => at(t, row, st ?? "US") ?? at(t, row, "US");
const energyOf = (st) => (at(SP.eia2025_residential_electric_bill_by_state, "bill", st) ?? NaN) + (at(SP.eia2024_residential_natural_gas_bill_by_state_DERIVED, "bill", st) ?? NaN);
const autoOf = (st) => at(SP.naic2023_auto_insurance_by_state, "averageExpenditure", st);
const BUCKETS = [["infant", 0, 0], ["toddler", 1, 2], ["fourYearOld", 3, 5], ["beforeAfterSchool", 6, 12]];
const NDCP_OF = { infant: "infant", toddler: "toddler", fourYearOld: "preschool", beforeAfterSchool: "schoolAge" };
const CCAOA = "ccaoa2025_childcare_annual_price_by_state", NDCP = "ndcp2022_childcare_weekly_price_by_state", NDCP_OLD = "ndcp_childcare_weekly_price_fallback_older_years";
/** The middle (median) of the states' published figures in a row: the price when the state has none, or with no state. */
function middleOfStates(t, row) {
  const v = t.cols.map((c, i) => (c === "US" ? null : t.rows[row]?.[i])).filter(ok).sort((a, b) => a - b);
  return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : null;
}
/** A year of full-time center care for one child of a bucket in a state, in 2025 prices, with the table it came from. */
export function careYear(st, bucket) {
  const c = st ? at(SP[CCAOA], `center:${bucket}`, st) : null;
  if (ok(c)) return { value: c, table: CCAOA };
  const nd = st ? at(SP[NDCP], `center:${NDCP_OF[bucket]}`, st) : null;
  if (ok(nd)) return { value: nd * 52 * cpiSince(2022), table: NDCP };
  const old = st ? at(SP[NDCP_OLD], `center:${NDCP_OF[bucket]}`, st) : null, oldYear = st ? at(SP[NDCP_OLD], `center:${NDCP_OF[bucket]}:year`, st) : null;
  if (ok(old) && ok(oldYear)) return { value: old * 52 * cpiSince(oldYear), table: NDCP_OLD };
  const mid = middleOfStates(SP[CCAOA], `center:${bucket}`);
  return ok(mid) ? { value: mid, table: CCAOA, middle: true } : null;
}
const bucketOf = (age) => (ok(age) && age >= 0 ? BUCKETS.find(([, lo, hi]) => age >= lo && age <= hi)?.[0] ?? null : null);

// ---- taps (spec 5.8; answers in guide.setup.taps)
export const HEALTH_ASK = { key: "health-cover", kind: "hurdle", question: "How do you get health cover?", options: [{ value: "work", label: "Through work" }, { value: "own", label: "On my own or the Marketplace" }, { value: "public", label: "Medicaid or Medicare" }, { value: "unsure", label: "Not sure" }] };
export const CHILDCARE_ASK = { key: "childcare", kind: "hurdle", question: "Do you pay for childcare or after-school care?", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "unsure", label: "Not sure" }] };
export const HOA_ASK = { key: "hoa", kind: "hurdle", question: "Do you pay an HOA or condo fee?", options: [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "unsure", label: "Not sure" }] };
const HOA = "acs2025_hoa_condo_fee_by_state";

// ---- R12: the person's own bank files (spec 2.2 R12, 7.A; C7)
/**
 * The months read from the bank (declared, README "Spending"). A month is read when all of these hold (C7 reviews, 2026-11-06):
 * - it is whole (transactions/ledger: over, the files together reach both ends, no account's files have a hole in it, stop
 *   early or start late) and at most `maxAge` months old (files from long ago say nothing about this year's month);
 * - a checking, savings or cash account's own files cover it: rent, bills and pay go through one, so a card's file alone
 *   shows what was bought on the card and nothing else (`whole` lists only these months);
 * - no money went to a card whose own file is not in (ledger monthGaps), or to a card that is in no file and not in the plan
 *   (a payment line with a card's words, or filed as a loan or card payment that matches no loan on Debts, while no card's
 *   file covers the month): what such a card bought is in no file, so no row can be read from the month;
 * - what is left with no kind (after the lines that are a bill typed or a payment on Debts, by amount, and those that say
 *   they are a transfer or a card's payment) is at most `uncategorised` of the month's money out, or `looseDollars`;
 * the newest `maxMonths` of them; R12 is on with `minMonths` or more. Expenses' bank card (income-statement bankVsPlan) compares
 * over the newest six whole months too. `sigma` is declared: the person's own months, not a survey.
 */
export const BANK = { minMonths: 2, maxMonths: 6, maxAge: 12, uncategorised: 0.1, looseDollars: 50, sigma: BANK_SPREAD };
/** Kinds of money out that are no spending row: loan and card payments (counted from Debts), taxes (they come off pay), saving. */
const NOT_SPENDING = new Set(["debt", "taxes", "savings"]);
/** The accounts rent, bills and pay go through: one of their own files must cover a month for it to be read. */
const DEPOSIT = new Set(["checking", "savings", "cash"]);
/** The row a kind of money out belongs to (Expenses' ROW_HOLDS); a kind in no row (travel, gifts, other, one of your own, or
 *  none yet) is "Shopping and everything else", as is childcare in a household with no children listed. */
const ROW_OF = Object.fromEntries(Object.entries(ROW_HOLDS).flatMap(([row, cats]) => cats.map((c) => [c, row])));
export const bankRowOf = (category, rows = ROWS) => { const r = ROW_OF[category]; return r && rows.includes(r) ? r : "shopping"; };
/** A housing line (bank or typed) that is the mortgage's own payment: within 10% of it, or named so (Expenses' own test). */
const isMortgagePay = (name, monthly, pay) => pay > 0 && (/mortgage|\bmtg\b/i.test(String(name ?? "")) || Math.abs(monthly - pay) <= pay * 0.1);
const mortgagePayOf = (plan) => L(plan, "debts").filter((d) => L(plan, "accounts").find((a) => a?.id === d?.accountId)?.type === "mortgage").reduce((s, d) => s + (Number(d.minPayment) || 0), 0);
/** A bank line's words that say it pays a card ("CHASE CREDIT CRD AUTOPAY", "AMEX EPAYMENT", "DISCOVER E-PAYMENT", "CITI
 *  AUTOPAY"), and a loan's or another account's words, which never do ("TOYOTA MOTOR CREDIT", "NAVIENT", "WELLS FARGO HOME MTG"). */
const CARD_LINE = /(card|crd)\b|\b(visa|mastercard|amex|american express|discover|citi|capital one|barclays|synchrony)\b/i;
const PAY_LINE = /\b(auto ?pay|e-?pay(ment)?|payment|pymt|pmt|thank you)\b/i;
const LOAN_LINE = /\b(mortgage|mtg|loans?|lending|student|navient|nelnet|sallie|mohela|aidvantage|great lakes|fedloan|edfinancial|motor credit|auto fin\w*|financial services|toyota|honda|ford credit|gm financial|ally|carmax|santander|tesla|hyundai|kia|nissan|subaru)\b/i;
const TRANSFER_LINE = /\b(transfer|xfer)\b/i;
const lineText = (t) => `${t?.rawPayee ?? ""} ${t?.payee ?? ""}`;
const cardishLine = (t) => !LOAN_LINE.test(lineText(t)) && CARD_LINE.test(lineText(t)) && PAY_LINE.test(lineText(t));
const words3 = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2 && !["the", "and", "loan", "card", "credit", "bank", "payment"].includes(w));
const ymMinus = (ym, n) => { const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1 - n; const yy = y + Math.floor(m / 12), mm = ((m % 12) + 12) % 12 + 1; return `${yy}-${String(mm).padStart(2, "0")}`; };

/**
 * R12: what the bank files show going out a month, row by row. rows: the rows the household has (childcare only with children).
 * -> { whole: [ym] (the whole months a checking, savings or cash account's files cover, newest first, down to the sixth read),
 *      months: [ym] (those read, newest six), on (two or more), byRow: { [row]: a month }, out (a month),
 *      mortgage (a month paid to the mortgage's servicer: the payment on Debts is counted there; what goes beyond it, its tax
 *      and insurance or a payment typed low, is in home costs), matched: { [bill id]: months a line with no kind was that bill },
 *      held: null | { kind: "no-checking" | "card" | "unknown-card" | "unfiled" | "old", months: [ym], cards?: [{ accountId, name,
 *      paid }], payee?, paid?, unfiled? (lines with no kind in the plan, Categorize's count) } (why R12 is off: the newest reason) }
 *    | null (no bank lines, or no today).
 * A line counts when it is money out of a spending kind (with no kind, by its sign, as the bank card reads it), not a
 * transfer between your own accounts, a loan or card payment, taxes or saving. A refund in a spending kind takes off.
 */
export function bankSpend(plan, today, { rows = ROWS } = {}) {
  const txs = L(plan, "transactions");
  if (!txs.length || !today) return null;
  // the ledger's month checks read every line for every month (about 7 ms a month on six months of 150 lines), and the store
  // settles on every change: the answer is kept for the same inputs (every line, file record, account, kind, bill and debt,
  // the day and the rows), the last few of them; the same inputs always give the same answer
  const bills = billsOf(plan, today);
  const key = JSON.stringify([today, rows, txs, L(plan, "imports"), L(plan, "accounts").map((a) => [a?.id, a?.type, a?.name, a?.institution, a?.ownerId]), plan?.categories ?? null,
    L(plan, "debts").map((d) => [d?.id, d?.accountId, d?.minPayment]), bills]);
  if (BANK_SEEN.has(key)) return structuredClone(BANK_SEEN.get(key));
  const out = bankSpendOf(plan, today, rows, txs, bills);
  BANK_SEEN.set(key, structuredClone(out));
  if (BANK_SEEN.size > 8) BANK_SEEN.delete(BANK_SEEN.keys().next().value);
  return out;
}
const BANK_SEEN = new Map();
/** The bills typed (not our guesses), each paid at most as often as its period has in a month: a line with no kind of about
 *  the same amount is that bill (a rent paid by check), counted once on Expenses. */
const billsOf = (plan, today) => L(plan, "expenses").filter((x) => x && x.period !== "once" && Number(x.amount) > 0 && (!today || activeOn(x, today)) && !(typeof x.id === "string" && isGuess(plan, `expenses[${x.id}].amount`)))
  .map((x) => ({ id: x.id, amount: Number(x.amount), times: x.period === "weekly" ? 5 : x.period === "biweekly" ? 3 : 1 }));
function bankSpendOf(plan, today, rows, txs, bills) {
  const kinds = new Map(categoriesOf(plan, { all: true }).map((c) => [c.id, c.kind]));
  const accounts = L(plan, "accounts");
  const cardIds = new Set(accounts.filter(isCardAccount).map((a) => a.id));
  const transfer = (t) => !!t.transferId || t.category === "transfer" || (!!t.category && kinds.get(t.category) === "transfer");
  const spending = (t, amt) => (t.category && kinds.has(t.category) ? kinds.get(t.category) === "expense" : amt < 0);
  const thisMonth = String(today).slice(0, 7), oldest = ymMinus(thisMonth, BANK.maxAge);
  const cov = coverage(plan), covBy = coverageByAccount(plan);
  const pay = mortgagePayOf(plan);
  // the loans on Debts (not cards): a payment line within 10% of one, or naming it, is that loan's (counted from Debts)
  const acctOf = new Map(accounts.map((a) => [a?.id, a]));
  const loans = L(plan, "debts").filter((d) => !cardIds.has(d?.accountId) && Number(d?.minPayment) > 0).map((d) => ({ pay: Number(d.minPayment), words: words3(`${acctOf.get(d.accountId)?.name ?? ""} ${acctOf.get(d.accountId)?.institution ?? ""}`) }));
  const isLoanPay = (t, v) => LOAN_LINE.test(lineText(t)) || loans.some((l) => Math.abs(v - l.pay) <= l.pay * 0.1 || (l.words.length && words3(lineText(t)).some((w) => l.words.includes(w))));
  const byMonth = new Map();
  for (const t of txs) { if (!t) continue; const ym = monthOf(t.date); if (/^\d{4}-\d{2}$/.test(ym)) (byMonth.get(ym) ?? byMonth.set(ym, []).get(ym)).push(t); }
  /** One month's lines: the spending counted (with its row), the part with no kind, the bills a line was, money to a card in no file. */
  const look = (ym, g) => {
    const lines = byMonth.get(ym) ?? [];
    const cardHasLines = lines.some((t) => cardIds.has(t.accountId));
    let flows = null;
    const toKnownCard = (t) => { flows ??= cardIds.size ? cardPayments(plan, ym, { today, covBy }) : []; return flows.some((f) => f.t === t && (f.cardId || f.maybe)); };
    const used = new Map(), counted = [], unknown = [], cardsOwed = [];
    let loose = 0;
    for (const t of lines) {
      const amt = Number(t.amount) || 0;
      const onCard = cardIds.has(t.accountId);
      if (!onCard && amt < 0) {
        // money to a card from checking: a known card's file covers it (monthGaps says when it does not), else it is held
        const debtLine = t.category === "debt", unfiled = !t.category;
        if (transfer(t)) { if (!t.transferId && cardishLine(t) && !toKnownCard(t)) unknown.push(t); continue; }
        if (debtLine || (unfiled && cardishLine(t))) {
          if (isLoanPay(t, -amt) && !cardishLine(t)) continue;               // a loan's payment, counted from Debts
          if (cardHasLines) continue;                                         // to a card whose own file shows what it bought
          const card = accounts.find((a) => cardIds.has(a.id) && words3(`${a.name} ${a.institution ?? ""}`).some((w) => words3(lineText(t)).includes(w)));
          if (card) cardsOwed.push({ accountId: card.id, name: card.name || "Card", paid: -amt }); else unknown.push(t);
          continue;
        }
        if (unfiled) {
          if (TRANSFER_LINE.test(lineText(t))) continue;                     // money moved between accounts, not spending
          const bill = bills.find((b) => (used.get(b.id) ?? 0) < b.times && Math.abs(-amt - b.amount) <= b.amount * 0.1);
          if (bill) { used.set(bill.id, (used.get(bill.id) ?? 0) + 1); continue; }   // that bill, counted on Expenses
          if (isLoanPay(t, -amt) || (pay > 0 && Math.abs(-amt - pay) <= pay * 0.1)) continue;   // a payment on Debts
          loose += -amt;
          counted.push({ t, row: "shopping", v: -amt });
          continue;
        }
      }
      if (transfer(t)) continue;
      if (!spending(t, amt) || NOT_SPENDING.has(t.category ?? "")) continue;
      counted.push({ t, row: bankRowOf(t.category ?? "", rows), v: -amt });
    }
    const out = counted.reduce((s, x) => s + x.v, 0);
    return { counted, out, loose, unknown, cardsOwed: [...(g?.cards ?? []).map((c) => ({ accountId: c.accountId, name: c.name, paid: c.paid })), ...cardsOwed], used };
  };
  const over = [...byMonth.keys()].filter((m) => m < thisMonth).sort().reverse();
  const whole = [], months = [], seen = new Map(), heldBy = [];
  for (const ym of over) {
    if (months.length >= BANK.maxMonths) break;
    if (ym < oldest) { if (!months.length && heldBy.length < BANK.maxMonths && monthCover(cov, ym, today).full) heldBy.push({ ym, kind: "old" }); continue; }
    if (!monthCover(cov, ym, today).full) continue;
    const g = monthGaps(plan, ym, today, covBy);
    if (!g.whole) continue;
    if (!accounts.some((a) => DEPOSIT.has(a?.type) && covBy[a.id] && monthCover(covBy[a.id], ym, today).full)) { heldBy.push({ ym, kind: "no-checking" }); continue; }
    whole.push(ym);
    const m = look(ym, g);
    seen.set(ym, m);
    if (m.cardsOwed.length || g.unsure) { heldBy.push({ ym, kind: "card", cards: m.cardsOwed, unsure: !!g.unsure }); continue; }
    if (m.unknown.length) { heldBy.push({ ym, kind: "unknown-card", payee: prettyLine(m.unknown[0]), paid: m.unknown.reduce((s, t) => s - (Number(t.amount) || 0), 0) }); continue; }
    if (!(m.out > 0)) continue;
    if (m.loose > Math.max(BANK.looseDollars, BANK.uncategorised * m.out)) { heldBy.push({ ym, kind: "unfiled", loose: m.loose }); continue; }
    months.push(ym);
  }
  const n = months.length;
  const byRow = Object.fromEntries(rows.map((r) => [r, 0]));
  // housing lines: the mortgage's own payment (named so, within 10% of it, or its servicer's line every month) is counted on
  // Debts; what goes to the servicer beyond that payment (its tax and insurance, or a payment typed low) is a home cost
  const housing = [];
  let out = 0;
  const matched = {};
  for (const ym of months) {
    const m = seen.get(ym);
    for (const [id, k] of m.used) matched[id] = (matched[id] ?? 0) + Math.min(1, k);
    for (const x of m.counted) {
      if (x.row === "housing" && x.v > 0) { housing.push({ t: x.t, ym, out: x.v }); continue; }
      byRow[x.row] = (byRow[x.row] ?? 0) + x.v; out += x.v;
    }
  }
  const theirs = mortgageLines(housing, months, pay);
  let mortgage = 0;
  const toServicer = new Map();
  for (const h of housing) {
    if (theirs.has(h.t)) { mortgage += h.out; toServicer.set(h.ym, (toServicer.get(h.ym) ?? 0) + h.out); continue; }
    if (byRow.housing !== undefined) byRow.housing += h.out; else byRow.shopping += h.out;
    out += h.out;
  }
  for (const v of toServicer.values()) { const beyond = Math.max(0, v - pay); if (byRow.housing !== undefined) byRow.housing += beyond; out += beyond; }
  const per = (x) => (n ? x / n : 0);
  const on = n >= BANK.minMonths;
  // why R12 is off (the newest reason; the pages say it in one line, bankHeldWords)
  let held = null;
  if (!on && heldBy.length) {
    const h = heldBy[0], same = heldBy.filter((x) => x.kind === h.kind);
    held = { kind: h.kind, months: same.map((x) => x.ym) };
    if (h.kind === "card") {
      const cards = new Map();
      for (const x of same) for (const c of x.cards ?? []) { const e = cards.get(c.accountId) ?? { accountId: c.accountId, name: c.name, paid: 0 }; e.paid += c.paid; cards.set(c.accountId, e); }
      held.cards = [...cards.values()].map((c) => ({ ...c, paid: c.paid / same.length })); held.unsure = same.some((x) => x.unsure);
    }
    // (the cards the plan has, none tied to the line by name: one of them may be it, and the words ask for its file)
    if (h.kind === "unknown-card") { held.payee = h.payee; held.paid = same.reduce((s, x) => s + x.paid, 0) / same.length; held.cards = accounts.filter((a) => cardIds.has(a.id)).map((a) => ({ accountId: a.id, name: a.name || "Card" })); }
    if (h.kind === "unfiled") held.unfiled = txs.filter((t) => t && !t.category).length;
  }
  return { whole, months, on, byRow: Object.fromEntries(Object.entries(byRow).map(([r, v]) => [r, per(v)])), out: per(out), mortgage: per(mortgage), matched, held };
}
/** A bank line's payee as the pages print it ("CHASE CREDIT CRD AUTOPAY", its reference numbers left off). */
const prettyLine = (t) => String(t?.rawPayee || t?.payee || "").replace(/\b(ppd|web|ach)?\s*id:?\s*\d+.*$/i, "").replace(/\s+\d{4,}.*$/, "").trim().slice(0, 40);
/**
 * Why the bank files set no spending row yet, in one line with what to do (Expenses under its tiles, the guesses page's
 * spending row): -> { text, link: { label, href } } | null. b: bankSpend's answer.
 */
export function bankHeldWords(plan, b, money = (v) => `$${Math.round(Number(v) || 0).toLocaleString("en-US")}`) {
  const h = b?.held;
  if (!h || b.on) return null;
  const when = monthsWords(h.months);
  const ten = (v) => money(Math.round(v / 10) * 10);
  if (h.kind === "no-checking") return { text: `Your card's files cover ${when}, but not your checking account, where rent and bills are paid. Bring in its file too, and our spending guesses become what your bank shows.`, link: { label: "Bring in a bank file ›", href: "#/transactions/import" } };
  if (h.kind === "card") {
    const c = h.cards?.[0] ?? null, many = (h.cards?.length ?? 0) > 1;
    if (!c) return { text: `Your bank files cover ${when}, but money went to one of your cards, and its file isn't in. Bring in the card files, and our spending guesses become what your bank shows.`, link: { label: "Bring in the card files ›", href: "#/transactions/import" } };
    const name = many ? "your cards" : `your ${String(c.name || "card").replace(/^(the|my|our)\s+/i, "")}`;
    return { text: `Your bank files cover ${when}, but about ${ten(h.cards.reduce((s, x) => s + x.paid, 0))} a month went to ${name}, and ${many ? "their files aren't" : "its file isn't"} in. Bring ${many ? "them" : "it"} in, and our spending guesses become what your bank shows.`, link: { label: many ? "Bring in the card files ›" : `Bring in the ${String(c.name || "card").replace(/\s*\b(credit\s+)?card\b\s*$/i, "") || "card"} file ›`, href: `#/transactions/import${many ? "" : `?accountId=${encodeURIComponent(c.accountId)}`}` } };
  }
  if (h.kind === "unknown-card") {
    const cards = h.cards ?? [];
    if (!cards.length) return { text: `Your bank files cover ${when}, but about ${ten(h.paid)} a month went to a card that isn't in your plan (${h.payee}). Add the card and bring in its file, and our spending guesses become what your bank shows.`, link: { label: "Add the card ›", href: "#/balance/net-worth" } };
    // a card in the plan the line does not name: likely that one ("CAPITAL ONE AUTOPAY" for a card saved as "Visa")
    const one = cards.length === 1 ? cards[0] : null, short = (c) => String(c.name || "card").replace(/^(the|my|our)\s+/i, "");
    return { text: `Your bank files cover ${when}, but about ${ten(h.paid)} a month went to a card (${h.payee}), and what it bought is in no file. ${one ? `If that is your ${short(one)}, bring in its file; if it is another card, add it first.` : "Bring in that card's file, or add the card first if it isn't in your plan."} Then our spending guesses become what your bank shows.`,
      link: one ? { label: `Bring in the ${short(one).replace(/\s*\b(credit\s+)?card\b\s*$/i, "") || "card"} file ›`, href: `#/transactions/import?accountId=${encodeURIComponent(one.accountId)}` } : { label: "Bring in the card files ›", href: "#/transactions/import" } };
  }
  if (h.kind === "unfiled") return { text: `${h.unfiled === 1 ? "One bank line still needs" : `${h.unfiled} bank lines still need`} a kind. File them, and our spending guesses become what your bank shows.`, link: { label: "Categorize ›", href: "#/transactions/categorize" } };
  // (months of one year are named without it: an old file's year is said, or "January and February" reads as this year's)
  const year = [...(h.months ?? [])].sort().pop()?.slice(0, 4) ?? "";
  if (h.kind === "old") return { text: `Your bank files are from ${/\d{4}/.test(when) || !year ? when : `${when} ${year}`}, more than a year ago, so our spending guesses don't use them. Bring in the last few months.`, link: { label: "Bring in a bank file ›", href: "#/transactions/import" } };
  return null;
}

// ---- words
const COUNT = ["no", "one", "two", "three", "four", "five", "six"];
const nWord = (n) => COUNT[n] ?? String(n);
/** Who the household is, for a why-line: "one person", "a parent of two", "a couple with two children". */
function whoWords(prof, kids) {
  const n = prof.adults.length, k = kids.length;
  if (n === 1) return k ? `a parent of ${nWord(k)}` : "one person";
  if (n === 2) return k ? `a couple with ${nWord(k)} ${k === 1 ? "child" : "children"}` : "a couple";
  return "a household like yours";
}
const placeIn = (st) => (st ? `in ${STATE_NAME[st]}` : "in the U.S.");
const payWords = (m) => (m.a === null ? "" : m.payHow === "guess" ? " on our pay guess" : " on your pay");

/**
 * Every row at once (the memoised heart of the spending guesses). o: { today, args, force } -- force: a row to work out as
 * if it were left blank (a row typed on the screen, asked for its grey figure). -> {
 *   rows: { [row]: { value (unrounded, a month) | null, fixed, flex, ask?, tables, why, sharper, weight } },
 *   guessed: [row], k, envelope, a, aHow, typed (a month: every typed bill and loan payment), hh, region, tenure, state, payHow,
 *   bank: { months } | null (R12 on: every row is its bank average, `bank: true` on the row)
 * }
 */
export function spendModel(plan, { today, args = null, force = null } = {}, lib) {
  const memoKey = `spend|${force ?? ""}|${args ? JSON.stringify(args) : ""}`;
  return lib.memo(memoKey, () => buildModel(plan, today, args, force, lib));
}

function buildModel(plan, today, args, force, lib) {
  const prof = lib.memo("profile", () => profileOf(plan, today));
  const taps = { ...(prof.taps ?? {}), ...(args && typeof args.taps === "object" && args.taps ? args.taps : {}) };
  const st = prof.state, region = st ? STATE_REGION[st] ?? null : null, tenure = spendTenure(plan, prof);
  const hh = householdOf(plan, today), kids = kidsOf(plan, today);
  const mortgage = tenure === "ownerWithMortgage";
  const isSetupRow = (x) => typeof x?.id === "string" && x.id.startsWith("setup-x-");
  const ex = L(plan, "expenses");
  // what is typed and what is left to us
  const guessed = new Set(), typedRow = {};
  let typedList;
  if (args) {
    const total = args.mode === "total" && ok(args.total) && args.total > 0 ? args.total : null;
    typedList = ex.filter((x) => !isSetupRow(x) && x?.id !== "setup-x-total");
    if (total) typedList.push({ id: "setup-x-total", name: "Monthly spending (rough)", category: "other", amount: total, period: "monthly", startDate: "", endDate: "" });
    else {
      for (const [k, v] of Object.entries(args.rows ?? {})) {
        if (!ROWS.includes(k)) continue;
        if (v === null) guessed.add(k);
        else if (ok(v) && v >= 0) {
          typedRow[k] = v;
          if (v > 0) typedList.push({ id: `setup-x-${k}`, name: k === "housing" ? (mortgage ? "Home costs" : "Rent") : k, category: k, amount: v, period: "monthly", startDate: "", endDate: "" });
        }
      }
    }
  } else {
    const zero = Array.isArray(plan?.guide?.setup?.spendZero) ? plan.guide.setup.spendZero : [];
    typedList = ex.filter((x) => !(typeof x?.id === "string" && isGuess(plan, `expenses[${x.id}].amount`)));
    for (const k of ROWS) {
      const r = ex.find((x) => x?.id === `setup-x-${k}`);
      if (r && isGuess(plan, spendPath(k))) guessed.add(k);
      else if (r) typedRow[k] = perMonth(r.amount, r.period);
      else if (zero.includes(k)) typedRow[k] = 0;
    }
  }
  if (force && ROWS.includes(force)) { guessed.add(force); delete typedRow[force]; }
  let typedEx = null;
  try { typedEx = computeExpenses({ ...plan, expenses: typedList }, { today }); } catch { typedEx = null; }
  const typed = typedEx?.monthly ?? 0;
  // bills typed elsewhere (Expenses) in a row's categories come off its guess; for a home with a mortgage, the mortgage's
  // own payment filed under housing is not a home cost besides it
  const mortgagePay = L(plan, "debts").filter((d) => L(plan, "accounts").find((a) => a?.id === d?.accountId)?.type === "mortgage").reduce((s, d) => s + (Number(d.minPayment) || 0), 0);
  // A bill comes off once (C7 review M7). A home insurance bill typed under Insurance: the part home costs took off its own
  // insurance part is not taken again off "Insurance and health" (health and life cover in the survey); a car insurance bill
  // typed there ("Home and car insurance", past the home's part) comes off "Car, gas and transit", where the survey has it.
  let homeInsTaken = 0, carShift = 0, carBoth = 0, homeOnly = 0;
  const elsewhere = (row) => Math.max(0, typedList.filter((x) => !isSetupRow(x) && x?.id !== "setup-x-total" && OFF[row].includes(x.category) && (!today || activeOn(x, today))
    && !(row === "housing" && mortgage && (/mortgage/i.test(x.name ?? "") || (mortgagePay > 0 && Math.abs(perMonth(x.amount, x.period) - mortgagePay) <= mortgagePay * 0.1))))
    .reduce((s, x) => s + perMonth(x.amount, x.period), 0) - (row === "insurance" ? homeInsTaken + carShift : 0) + (row === "transport" ? carShift : 0));
  {
    const insBills = typedList.filter((x) => !isSetupRow(x) && OFF.insurance.includes(x?.category) && (!today || activeOn(x, today)));
    const sumOf = (xs) => xs.reduce((t, x) => t + Math.max(0, perMonth(x.amount, x.period)), 0);
    const car = insBills.filter((x) => CAR_INSURANCE_BILL.test(String(x?.name ?? ""))), both = car.filter((x) => HOME_INSURANCE_BILL.test(String(x?.name ?? "")));
    carShift = sumOf(car);   // less what the home's part takes from a bill that names both (below, with the home costs)
    carBoth = sumOf(both); homeOnly = sumOf(insBills.filter((x) => HOME_INSURANCE_BILL.test(String(x?.name ?? "")) && !CAR_INSURANCE_BILL.test(String(x?.name ?? ""))));
  }

  // take-home and the share model's inputs
  const th = takeHome(plan, today, prof);
  const a = th && th.a > 0 ? th.a : null;
  const base = a ?? afterTax(HH, hh ?? "all");
  const share = (row) => (a !== null ? sQ(row, a) * ratio(HH, hh, row) : shareOf(HH, hh ?? "all", row));
  const flexAmount = (row, { region: useRegion = true } = {}) => share(row) * (useRegion ? ratio(REG, region, row) : 1) * base / 12;
  const T_BASE = ["ce2025_spend_by_incomeQuintile", "ce2025_profile_by_incomeQuintile", "ce2023_aftertax_income_by_incomeQuintile", "ce2025_spend_by_householdComposition", "ce2025_profile_by_householdComposition"];
  const T_REG = region ? ["ce2025_spend_by_region", "ce2025_profile_by_region", "ce2023_aftertax_income_by_region"] : [];
  const sharpers = [...(st ? [] : [YOUR_STATE]), ...(a === null || prof.payHow === "guess" ? [YOUR_PAY] : [])];
  const who = whoWords(prof, kids), place = placeIn(st);
  const m = { a, aHow: th?.how ?? null, payHow: prof.payHow, hh, region, tenure, state: st };
  const pw = payWords(m);
  const rows = {};
  const put = (row, r) => { rows[row] = { ask: null, weight: "small", sharper: sharpers, ...r }; };

  // E01 housing
  if (tenure === "renter") {
    const gross = STATE_OR_US(SP.acs2025_median_gross_rent_by_state, "grossRent", st);
    const rr = a !== null ? (interpLog(RENT_CURVE, a) * a / rentPer(Q, "all")) * rentRatio(hh) : rentPer(HH, hh ?? "all") / rentPer(HH, "all");
    put("housing", { fixed: gross * D_SPEND.contractShare.value * rr, flex: 0, weight: "big",
      why: fit(`typical rent before utilities for ${who} ${place}${pw}`, `typical rent before utilities for ${who} ${place}`, `typical rent before utilities ${place}`),
      tables: ["acs2025_median_gross_rent_by_state", "ce2025_spend_by_housingTenure", ...T_BASE] });
  } else {
    let value = homeValueFor(plan, { path: homePathOf(plan, null), args: null })?.value ?? null;
    if (value === null) value = lib.estimate("home.value", { path: homePathOf(plan, null) })?.value ?? null;
    const upkeep = ok(value) && value > 0 ? value * D_HOME.upkeepRatio.value * cpiSince(2023) / 12 : at(HOME.ahs2023_routine_maintenance_spending, "mean annual routine maintenance", "all owners") * cpiSince(2023) / 12;
    // the HOA fee by how many of the state's owners pay one (US share with no state): under 35% left out, over 65% counted,
    // in between asked ("Not sure" takes the likelier side)
    const p = (STATE_OR_US(HOME[HOA], "percent of owners paying an HOA/condo fee", st) ?? 0) / 100;
    const fee = STATE_OR_US(HOME[HOA], mortgage ? "median fee, with a mortgage" : "median fee, without a mortgage", st) ?? 0;
    const said = taps.hoa;
    let hoa = 0, ask = null, hoaWords = "";
    if (said === "yes") { hoa = fee; hoaWords = " and the usual HOA fee"; }
    else if (said === "no") hoa = 0;
    else if (p > 0.65) { hoa = fee; hoaWords = ` and the usual ${st ? `${STATE_NAME[st]} ` : ""}HOA fee`; }
    else if (p >= 0.35) { hoa = p >= 0.5 ? fee : 0; hoaWords = p >= 0.5 ? " and the usual HOA fee" : ""; if (!said) ask = HOA_ASK; }
    else if (st) hoaWords = `; few ${STATE_NAME[st]} owners pay an HOA fee`;
    // property tax and insurance: in the mortgage payment, unless there is no mortgage or the escrow tap said they are not
    const esc = !mortgage || taps.escrow === "no" ? escrowMonthly(plan, { today }, lib) : null;
    // a bill typed under another kind that names one of those two parts (a "Property tax" bill filed under taxes, "Home and
    // car insurance" under insurance) is that part: it comes off the part, never past it, so it is not counted twice (C7)
    const named = (re) => typedList.filter((x) => !isSetupRow(x) && x?.category !== "housing" && re.test(String(x?.name ?? "")) && (!today || activeOn(x, today)))
      .reduce((s, x) => s + Math.max(0, perMonth(x.amount, x.period)), 0);
    const taxLeft = esc ? Math.max(0, esc.tax - named(PROPERTY_TAX_BILL)) : 0, insLeft = esc ? Math.max(0, esc.insurance - named(HOME_INSURANCE_BILL)) : 0;
    // what the home's insurance part took from bills filed under Insurance or health (they come off that row too otherwise)
    if (esc) { homeInsTaken = Math.min(homeOnly + carBoth, esc.insurance - insLeft); carShift -= Math.min(carBoth, Math.max(0, homeInsTaken - homeOnly)); }
    const extra = taxLeft + insLeft;
    const parts = ["upkeep", ...(taxLeft > 0.5 ? ["property tax"] : []), ...(insLeft > 0.5 ? ["insurance"] : [])];
    const partWords = parts.length === 3 ? "upkeep, property tax and insurance" : parts.join(" and ");
    put("housing", { fixed: upkeep + hoa + extra, flex: 0, weight: "big", ask, upkeep, hoa, escrow: extra,
      why: parts.length > 1 ? fit(`${partWords} on a home like yours ${place}`, `${partWords} on a home like yours`)
        : fit(`upkeep owners usually spend on a home like yours${hoaWords}`, `upkeep on a home like yours${hoaWords}`, "upkeep owners usually spend on a home like yours"),
      tables: ["ahs2023_routine_maintenance_spending", HOA, ...(parts.length > 1 ? ["acs2025_effective_property_tax_rate_by_state", "naic2023_homeowners_premium_by_state"] : [])] });
  }
  // E02 utilities: the state's power and gas bills in place of the region
  {
    const e = energyOf(st ?? "US"), us = energyOf("US");
    const energy = ok(e) && ok(us) && us > 0 ? 1 + D_SPEND.energyShare.value * (e / us - 1) : 1;
    put("utilities", { fixed: 0, flex: flexAmount("utilities", { region: false }) * ratio(TEN, tenure, "utilities") * energy,
      why: fit(`power, water, internet and phones for ${who} ${place}`, `power, water, internet and phones ${place}`),
      tables: [...T_BASE, "ce2025_spend_by_housingTenure", "ce2025_profile_by_housingTenure", "eia2025_residential_electric_bill_by_state", "eia2024_residential_natural_gas_bill_by_state_DERIVED"] });
  }
  // E03 groceries
  put("groceries", { fixed: 0, flex: flexAmount("groceries"), why: "what a household like yours usually spends on food and supplies", tables: [...T_BASE, ...T_REG] });
  // E04 car, gas and transit: the insurance part scaled by the state's average car insurance
  {
    const s = autoOf(st ?? "US"), us = autoOf("US");
    const ins = ok(s) && ok(us) && us > 0 ? 1 + D_SPEND.vehicleInsShare.value * (s / us - 1) : 1;
    put("transport", { fixed: 0, flex: flexAmount("transport") * ins,
      why: fit(`gas, repairs, insurance and fares for ${who} ${place}`, `gas, repairs, insurance and fares for a household like yours ${place}`, "gas, repairs, insurance and fares for a household like yours"),
      tables: [...T_BASE, ...T_REG, "naic2023_auto_insurance_by_state"] });
  }
  // E05 insurance and health, by how cover is had (a tap asked once)
  {
    const how = taps["health-cover"] ?? null;
    const oop = flexAmount("oop");
    if (how === "work") {
      const one = prof.adults.length <= 1 && !kids.length;
      const prem = at(HEALTH.kff_ehbs2026_premiums, "worker contribution, monthly", one ? "single" : "family");
      put("insurance", { fixed: prem ?? 0, flex: oop, weight: "big", premium: prem, why: "what workers usually pay for cover at work, plus medicine and visits", tables: ["kff_ehbs2026_premiums", ...T_BASE, ...T_REG] });
    } else if (how === "public") {
      const n65 = prof.adults.filter((x) => ok(x.age) && x.age >= 65).length;
      const year = String(yearOf(today));
      const d = HEALTH.cms_medicare_part_d_parameters;
      const partD = at(d, "baseBeneficiaryPremium", year) ?? at(d, "baseBeneficiaryPremium", d.cols.filter((c) => c <= year).pop() ?? d.cols[0]);
      const each = (at(HEALTH.cms_medicare_2026_parts_ab, "partB:standardMonthlyPremium", "value") ?? 0) + (partD ?? 0) + (STATE_OR_US(HEALTH.kff_medigap_average_premium_2025, "G", st) ?? 0);
      put("insurance", { fixed: n65 * each, flex: oop, weight: "big", premium: n65 * each,
        why: n65 ? "Medicare premiums with a Plan G supplement, plus medicine and visits" : "medicine and visits, typical for a household like yours",
        tables: [...(n65 ? ["cms_medicare_2026_parts_ab", "cms_medicare_part_d_parameters", "kff_medigap_average_premium_2025"] : []), ...T_BASE, ...T_REG] });
    } else {
      put("insurance", { fixed: 0, flex: flexAmount("insurance"), weight: "big", ask: how ? null : HEALTH_ASK, why: "health cover and medicine, typical for a household like yours", tables: [...T_BASE, ...T_REG] });
    }
  }
  // E06 childcare: always asked (no published share paying); Yes prices each child under 13 whose age is known
  if (kids.length) {
    const said = taps.childcare ?? null;
    if (said !== "yes") put("childcare", { fixed: 0, flex: 0, value: null, weight: "big", ask: said ? null : CHILDCARE_ASK, why: "", tables: [] });
    else {
      const priced = kids.map((k) => ({ ...k, bucket: bucketOf(k.age) })).filter((k) => k.bucket).map((k) => ({ ...k, price: careYear(st, k.bucket) })).filter((k) => k.price);
      const full = priced.filter((k) => k.bucket !== "beforeAfterSchool").map((k) => (k.age === 0 ? "a baby" : `a ${k.age}-year-old`));
      const after = priced.filter((k) => k.bucket === "beforeAfterSchool").map((k) => `a ${k.age}`);
      const parts = [full.length ? `full-time center care ${place} for ${full.join(" and ")}` : null, after.length ? `${full.length ? "after school for" : `after-school care ${place} for`} ${after.join(" and ")}` : null].filter(Boolean);
      const unknown = kids.some((k) => k.age === null);
      put("childcare", { fixed: priced.reduce((s, k) => s + k.price.value / 12, 0), flex: 0, value: priced.length ? undefined : null, weight: "big",
        why: fit(parts.join(", "), `child care prices ${place} for your children's ages`, "typical child care prices for your children's ages"),
        sharper: [...(unknown ? [{ label: "your children's ages", href: "#/household/people" }] : []), ...(st ? [] : [YOUR_STATE])],
        tables: [...new Set(priced.map((k) => k.price.table))] });
    }
  }
  // E07 eating out and fun, E08 shopping and the rest
  put("dining", { fixed: 0, flex: flexAmount("dining"), why: fit(`eating out and fun, typical for ${who} ${place}`, "eating out and fun, typical for a household like yours"), tables: [...T_BASE, ...T_REG] });
  put("shopping", { fixed: 0, flex: flexAmount("shopping"), why: fit(`clothes, home things and the rest, typical for ${who}`, "clothes, home things and the rest, typical for a household like yours"), tables: [...T_BASE, ...T_REG] });

  // R12: with two or more whole months of bank files mostly filed under a kind, each row is what they show going out on it a
  // month (the person's own figures beat the survey's): less a bill typed elsewhere whose kind the bank puts in the row; no
  // envelope, no tap. With one month, or none, the survey's figures above stand.
  const have = Object.keys(rows);
  const bank = lib.memo(`bank|${have.join(",")}`, () => bankSpend(plan, today, { rows: have }));
  if (bank?.on) {
    const n = bank.months.length, when = monthsWords(bank.months);
    // a bill typed elsewhere whose kind the bank puts in the row comes off it, less the months a line with no kind was that bill
    // (it is then not in the row's bank figure; C7 review M3)
    const typedIn = (row) => typedList.filter((x) => !isSetupRow(x) && x?.id !== "setup-x-total" && !NOT_SPENDING.has(x?.category) && bankRowOf(x?.category, have) === row && (!today || activeOn(x, today))
      && !(row === "housing" && isMortgagePay(x.name, perMonth(x.amount, x.period), mortgagePayOf(plan))))
      .reduce((s, x) => s + perMonth(x.amount, x.period) * (1 - Math.min(n, bank.matched?.[x.id] ?? 0) / n), 0);
    // cover taken out of pay never reaches a bank file: through work, the usual worker's share (KFF); Medicare's Part B comes
    // out of Social Security
    const how = taps["health-cover"] ?? null;
    const n65 = prof.adults.filter((x) => ok(x.age) && x.age >= 65).length;
    const unseen = how === "work" ? (rows.insurance?.premium ?? 0) : how === "public" ? n65 * (at(HEALTH.cms_medicare_2026_parts_ab, "partB:standardMonthlyPremium", "value") ?? 0) : 0;
    const bankWhy = fit(`your bank files, ${when}`, `your bank files, ${nWord(n)} months to ${monthsWords(bank.months.slice(0, 1))}`);
    for (const row of have) {
      // a row the files show nothing for keeps our figure: "not in these files" is not "$0" (C7 review M1); lumpy home upkeep
      // is a mean over years and most two-month windows hold none of it
      if (!((bank.byRow[row] ?? 0) > 0.5)) continue;
      const off = typedIn(row), plus = row === "insurance" ? unseen : 0;
      rows[row] = { ...rows[row], fixed: Math.max(0, (bank.byRow[row] ?? 0) - off) + plus, flex: 0, value: undefined, ask: null, sharper: [], bank: true, elsewhere: off,
        why: row === "insurance" && plus > 0.5 ? fit(`your bank files, ${when}, and cover taken from pay`, "your bank files and the cover taken from pay")
          : row === "insurance" ? fit(`${bankWhy}; not cover taken from pay`, "your bank files; not cover taken from pay") : bankWhy, tables: [] };
    }
  }
  // a bill typed elsewhere in a row's categories comes off the guess (never counted twice)
  for (const row of Object.keys(rows)) {
    const r = rows[row], raw = r.fixed + r.flex, off = r.bank ? 0 : elsewhere(row);
    if (off > 0 && raw > 0) { const f = Math.max(0, raw - off) / raw; r.fixed *= f; r.flex *= f; r.elsewhere = off; }
  }
  // R10: the envelope (every outlay of households like this a month) holds the typed bills, the loan payments, the guessed
  // prices and the guessed flexible rows; only the flexible rows give way, and never below half
  const envelope = flexAmount("envelope");
  const g = [...guessed].filter((row) => rows[row] && rows[row].value !== null);
  const fixedSum = g.reduce((s, row) => s + rows[row].fixed, 0), flexSum = g.reduce((s, row) => s + rows[row].flex, 0);
  const k = flexSum > 0 ? Math.min(1, Math.max(0.5, (envelope - typed - fixedSum) / flexSum)) : 1;
  for (const row of Object.keys(rows)) { const r = rows[row]; if (r.value !== null) r.value = r.fixed + r.flex * k; }
  return { ...m, rows, guessed: g, typedRow, k, envelope, typed, loanPayments: typedEx?.debtFromDebts ?? 0, kids, bank: bank?.on ? { months: bank.months.length } : null };
}

/** The screen's one basis line (5.6): who the household is, its home, its state and its income, as the guesses read them;
 *  with R12 on, the bank files the figures come from. */
export function spendBasis(plan, { today } = {}) {
  const bank = bankSpend(plan, today, { rows: kidsOf(plan, today).length ? ROWS : ROWS.filter((r) => r !== "childcare") });
  if (bank?.on) return `The grey figures are what your bank files show going out on each, a month over ${monthsWords(bank.months)}.`;
  return `The grey figures are what a household like yours usually spends: ${householdWords(plan, { today })}.`;
}
/** Who the spending guesses take the household to be, in words: "one adult renting in Texas on about $48,000 a year". */
export function householdWords(plan, { today } = {}) {
  const prof = profileOf(plan, today);
  const n = prof.adults.length, k = kidsOf(plan, today).length;
  const who = n === 1 ? (k ? `one parent of ${nWord(k)}` : "one adult") : n === 2 ? (k ? `a couple with ${nWord(k)} ${k === 1 ? "child" : "children"}` : "a couple") : n ? `${nWord(n)} adults` : "a household";
  const tenure = spendTenure(plan, prof);
  const home = tenure === "renter" ? "renting" : tenure === "ownerWithMortgage" ? "paying a mortgage" : "owning their home";
  const inc = perYearIncome(plan, today);
  const pay = inc > 0 ? ` on about ${money(Number(inc.toPrecision(inc < 100000 ? 2 : 3)))} a year` : "";
  return `${who} ${home} ${placeIn(prof.state)}${pay}`;
}
const perYearIncome = (plan, today) => L(plan, "income").filter((x) => x && x.period !== "once" && Number(x.amount) > 0 && (!today || activeOn(x, today))).reduce((s, x) => s + perYear(x.amount, x.period), 0);

/** E10's line: a typed month under exp(-2.33 x 0.25) = 0.558 of the household's guessed total (R9's 2.33, the declared 0.25). */
export const MISSING_LINE = Math.exp(-2.33 * 0.25);
/**
 * E10 (11.6, C7): "Is something missing?" when all three hold: the spending is typed (no row of it our guess, and not one rough
 * total, which no row can be added beside), the typed month (bills and loan payments) is under MISSING_LINE of the
 * household's guessed total (every row ours, plus the bills typed elsewhere and the loan payments), and no bank files cover
 * two whole months (the bank card on Expenses speaks then). "That's everything" (guide.spendComplete) ends it.
 * -> { typed, guessedTotal, rest: [row] (Get started's rows with no bill of their own kind: "Add our guesses for the rest"
 *    writes these, less what is listed under their other kinds; a row typed as 0 on Get started stays the person's 0) } | null
 * ignoreComplete: as if "That's everything" had not been said (Expenses offers "Ask me again" then).
 */
export function missingSpend(plan, { today, ignoreComplete = false } = {}, lib) {
  if (plan?.guide?.spendComplete && !ignoreComplete) return null;
  const ex = L(plan, "expenses");
  if (!ex.length || ex.some((x) => x?.id === "setup-x-total")) return null;
  const bank = lib.memo("bank|whole", () => bankSpend(plan, today));
  if ((bank?.whole.length ?? 0) >= BANK.minMonths) return null;
  const m = spendModel(plan, { today }, lib);
  if (m.guessed.length) return null;
  const all = spendModel(plan, { today, args: { mode: "rows", rows: Object.fromEntries(ROWS.map((r) => [r, null])) } }, lib);
  const total = Object.values(all.rows).reduce((s, r) => s + (r.value ?? 0), 0) + all.typed;
  if (!(m.typed > 0 && m.typed < total * MISSING_LINE)) return null;
  const kinds = new Set(ex.filter((x) => !(typeof x?.id === "string" && x.id.startsWith("setup-x-")) && (!today || activeOn(x, today))).map((x) => x?.category));
  const zero = Array.isArray(plan?.guide?.setup?.spendZero) ? plan.guide.setup.spendZero : [];
  // a row counts as listed through its own kind only (its first: a phone bill leaves "Utilities and phone" to offer, less the
  // phone; C7 UX review 9); the guess for it already has what is listed under its other kinds taken off
  const rest = Object.keys(all.rows).filter((row) => !ex.some((x) => x?.id === `setup-x-${row}`) && !kinds.has(COVERS[row][0]) && !zero.includes(row));
  return { typed: m.typed, guessedTotal: total, rest };
}

/** Get started's spending rows as it writes them (setup's SPEND: the name on Expenses, must-pay or not; a test checks they
 *  agree), so a row written here from a card is the row Get started would have written. */
export const ROW_NAME = { housing: "Rent", utilities: "Utilities and phone", groceries: "Groceries", transport: "Car, gas and transit", insurance: "Insurance and health", childcare: "Childcare and school", dining: "Eating out and fun", shopping: "Shopping and everything else" };
export const MUST = ["housing", "utilities", "groceries", "transport", "insurance", "childcare"];
/** The housing row's name on Expenses (setup's housingWords): "Home costs" for an owner, "Rent" for a renter. */
export const housingName = (plan) => (spendTenure(plan, profileOf(plan, null)) === "renter" ? ROW_NAME.housing : "Home costs");

const LABELS = { housing: "Rent, or home costs besides the mortgage", utilities: "Utilities and phone", groceries: "Groceries", transport: "Car, gas and transit", insurance: "Insurance and health", childcare: "Childcare and school", dining: "Eating out and fun", shopping: "Shopping and everything else" };
const WEIGHT = { housing: "big", insurance: "big", childcare: "big" };
const estimatorFor = (row, order) => ({
  tier: 3, order, label: LABELS[row], unit: "month", weight: WEIGHT[row] ?? "small", page: EXPENSES, reads: [],
  fn(plan, { today, args }, lib) {
    // (in One rough total, only a total left blank is ours: a 0 typed is the person's; C3 review D7)
    const blank = args ? args.rows?.[row] === null || (args.mode === "total" && !(ok(args.total) && args.total >= 0)) : isGuess(plan, spendPath(row));
    const m = spendModel(plan, { today, args, force: blank ? null : row }, lib);
    const r = m.rows[row];
    if (!r) return null;
    if (r.value === null || !ok(r.value)) return r.ask ? { value: null, ask: r.ask } : null;
    // R12: the person's own months (no table; the spending tables' read date, so moving between the bank and the survey is
    // never held back by the S7 guard)
    if (r.bank) return { value: Math.max(0, r.value), sigma: BANK.sigma, measured: false, why: r.why, basis: "yours", uses: { bank: "typed" }, sharperWith: [], tables: [], dataAsOf: READ_ON.spend };
    return {
      value: Math.max(0, r.value), sigma: 0.25, measured: false, why: r.why,
      uses: { ...(m.a !== null ? { pay: m.payHow === "guess" ? "guess" : "typed" } : {}), ...(m.state ? { state: "typed" } : {}), household: "typed" },
      sharperWith: r.sharper, tables: [...new Set(r.tables)], ...(r.ask ? { ask: r.ask } : {}),
    };
  },
});
export const estimators = Object.fromEntries(ROWS.map((row, i) => [`spend.${row}`, estimatorFor(row, i + 1)]));

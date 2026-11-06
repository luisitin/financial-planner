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
//   missingSpend(plan, o, lib)         E10 (11.6): a typed list far below the household's guessed total (shown in C7)
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
import { STATE_NAME, STATE_REGION } from "../data/index.js";
import { FEDERAL } from "../../../taxes/federal/data/federal.js";
import { FLAT, NO_WAGE_TAX, flatTax } from "../../../taxes/state/compute.js";
import { compute as computeExpenses, ROW_HOLDS } from "../../../cashflow/expenses/compute.js";
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
 *   guessed: [row], k, envelope, a, aHow, typed (a month: every typed bill and loan payment), hh, region, tenure, state, payHow
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
  const elsewhere = (row) => typedList.filter((x) => !isSetupRow(x) && x?.id !== "setup-x-total" && OFF[row].includes(x.category) && (!today || activeOn(x, today))
    && !(row === "housing" && mortgage && (/mortgage/i.test(x.name ?? "") || (mortgagePay > 0 && Math.abs(perMonth(x.amount, x.period) - mortgagePay) <= mortgagePay * 0.1))))
    .reduce((s, x) => s + perMonth(x.amount, x.period), 0);

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
    const extra = esc ? esc.total : 0;
    put("housing", { fixed: upkeep + hoa + extra, flex: 0, weight: "big", ask, upkeep, hoa, escrow: extra,
      why: esc ? fit(`upkeep, property tax and insurance on a home like yours ${place}`, "upkeep, property tax and insurance on a home like yours")
        : fit(`upkeep owners usually spend on a home like yours${hoaWords}`, `upkeep on a home like yours${hoaWords}`, "upkeep owners usually spend on a home like yours"),
      tables: ["ahs2023_routine_maintenance_spending", HOA, ...(esc ? ["acs2025_effective_property_tax_rate_by_state", "naic2023_homeowners_premium_by_state"] : [])] });
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

  // a bill typed elsewhere in a row's categories comes off the guess (never counted twice)
  for (const row of Object.keys(rows)) {
    const r = rows[row], raw = r.fixed + r.flex, off = elsewhere(row);
    if (off > 0 && raw > 0) { const f = Math.max(0, raw - off) / raw; r.fixed *= f; r.flex *= f; r.elsewhere = off; }
  }
  // R10: the envelope (every outlay of households like this a month) holds the typed bills, the loan payments, the guessed
  // prices and the guessed flexible rows; only the flexible rows give way, and never below half
  const envelope = flexAmount("envelope");
  const g = [...guessed].filter((row) => rows[row] && rows[row].value !== null);
  const fixedSum = g.reduce((s, row) => s + rows[row].fixed, 0), flexSum = g.reduce((s, row) => s + rows[row].flex, 0);
  const k = flexSum > 0 ? Math.min(1, Math.max(0.5, (envelope - typed - fixedSum) / flexSum)) : 1;
  for (const row of Object.keys(rows)) { const r = rows[row]; if (r.value !== null) r.value = r.fixed + r.flex * k; }
  return { ...m, rows, guessed: g, typedRow, k, envelope, typed, loanPayments: typedEx?.debtFromDebts ?? 0, kids };
}

/** The screen's one basis line (5.6): who the household is, its home, its state and its income, as the guesses read them. */
export function spendBasis(plan, { today } = {}) {
  const prof = profileOf(plan, today);
  const n = prof.adults.length, k = kidsOf(plan, today).length;
  const who = n === 1 ? (k ? `one parent of ${nWord(k)}` : "one adult") : n === 2 ? (k ? `a couple with ${nWord(k)} ${k === 1 ? "child" : "children"}` : "a couple") : n ? `${nWord(n)} adults` : "a household";
  const tenure = spendTenure(plan, prof);
  const home = tenure === "renter" ? "renting" : tenure === "ownerWithMortgage" ? "paying a mortgage" : "owning their home";
  const inc = perYearIncome(plan, today);
  const pay = inc > 0 ? ` on about ${money(Number(inc.toPrecision(inc < 100000 ? 2 : 3)))} a year` : "";
  return `The grey figures are what a household like yours usually spends: ${who} ${home} ${placeIn(prof.state)}${pay}.`;
}
const perYearIncome = (plan, today) => L(plan, "income").filter((x) => x && x.period !== "once" && Number(x.amount) > 0 && (!today || activeOn(x, today))).reduce((s, x) => s + perYear(x.amount, x.period), 0);

/**
 * E10 (11.6): typed spending far below what households like this spend: every row typed (none guessed), the typed month
 * under exp(-2.33 x 0.25) = 0.56 of the guessed household total. -> { typed, guessedTotal } | null. Shown in C7.
 */
export function missingSpend(plan, { today } = {}, lib) {
  const m = spendModel(plan, { today }, lib);
  if (m.guessed.length) return null;
  const all = spendModel(plan, { today, args: { mode: "rows", rows: Object.fromEntries(ROWS.map((r) => [r, null])) } }, lib);
  const total = Object.values(all.rows).reduce((s, r) => s + (r.value ?? 0), 0) + all.typed;
  return m.typed > 0 && m.typed < total * Math.exp(-2.33 * 0.25) ? { typed: m.typed, guessedTotal: total } : null;
}

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
    return {
      value: Math.max(0, r.value), sigma: 0.25, measured: false, why: r.why,
      uses: { ...(m.a !== null ? { pay: m.payHow === "guess" ? "guess" : "typed" } : {}), ...(m.state ? { state: "typed" } : {}), household: "typed" },
      sharperWith: r.sharper, tables: [...new Set(r.tables)], ...(r.ask ? { ask: r.ask } : {}),
    };
  },
});
export const estimators = Object.fromEntries(ROWS.map((row, i) => [`spend.${row}`, estimatorFor(row, i + 1)]));

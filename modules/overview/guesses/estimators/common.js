// modules/overview/guesses/estimators/common.js -- PURE. What the core estimators share. Formulas and sources:
// ../README.md ("The household as the guesses read it", "Balances by pay and age (R2)", "Prices in 2025 dollars").
//
//   profileOf(plan, today)          the household as the guesses read it (spec 5.4, the parts C2 needs): adults and the
//                                   reference age, the household's income a year, the state, the tenure, what was picked
//   scfR2(item, { income, age })    a Survey of Consumer Finances median among families who hold `item`, by income and
//                                   age (R2: anchor x income ratio x income-adjusted age ratio), with its spread
//   incomePercentile(income)        where a family income sits among all families (SCF cut-offs, log-linear)
//   cpiSince(year)                  the published CPI from the year after `year` to the last year on file (2025), so a
//                                   price in `year` dollars becomes a 2025 price (spec 6.7); never the plan's inflation
//   stateOf, placeName, placeOf, possessiveOf, money, fit           small helpers for the why-lines
//   YOUR_STATE, YOUR_PAY, YOUR_AGE, WHAT_YOU_PAY                    the "Sharper if you tell us" links
import { T as BAL } from "../data/balances.js";
import { STATE_NAME } from "../data/index.js";
import { RETURNS } from "../../../retirement/historical/data/returns.js";
import { interpLinear, sigmaFromMeanMedian } from "../../../../core/math/estimate.js";
import { ageOn } from "../../../../core/math/dates.js";
import { perYear, activeOn } from "../../../../core/math/periods.js";
import { isGuess } from "../../../../core/estimate/index.js";

const L = (p, k) => (Array.isArray(p?.[k]) ? p[k] : []);
export const ok = (x) => typeof x === "number" && Number.isFinite(x);
export const has = (o, k) => !!o && typeof o === "object" && Object.prototype.hasOwnProperty.call(o, k);

/** The plan's state code when it is one of the 50 states or DC; null when blank or unknown. */
export const stateOf = (plan) => { const s = plan?.household?.state; return typeof s === "string" && s !== "US" && STATE_NAME[s] ? s : null; };
/** "Ohio", or "U.S." with no state. */
export const placeName = (st) => (st ? STATE_NAME[st] : "U.S.");
/** "an Ohio", "a Texas", "a U.S." (the article for a place used as an adjective). */
export const placeOf = (st) => { const n = placeName(st); return `${st && /^[AEIOU]/.test(n) ? "an" : "a"} ${n}`; };
/** "Ohio's", "Texas'", "the usual" with no state. */
export const possessiveOf = (st) => (st ? (STATE_NAME[st].endsWith("s") ? `${STATE_NAME[st]}'` : `${STATE_NAME[st]}'s`) : null);
/** Whole dollars with commas, for why-lines ("$1,100"). */
export const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString("en-US")}`;
/** A rate as the plan shows it in words ("4.6%"). */
export const pctWords = (r) => `${Math.round(r * 1000) / 10}%`;
/** The first of the why-lines that fits in 70 characters (spec 5.6), else the last one cut to 70. */
export const fit = (...lines) => lines.find((l) => l.length <= 70) ?? lines[lines.length - 1].slice(0, 70);

export const YOUR_STATE = { label: "your state", href: "#/household/people" };
export const YOUR_PAY = { label: "your pay", href: "#/overview/setup/money" };
export const YOUR_AGE = { label: "your age", href: "#/overview/setup/ages" };
export const WHAT_YOU_PAY = { label: "what you pay a month", href: "#/overview/setup/owe-amounts" };

/**
 * The household as the guesses read it (spec 5.4). C2 reads: the adults and the reference age (the oldest adult with a
 * birth date, the Survey of Consumer Finances' "age of the family head" in a couple), the household's income a year
 * (every income line running today, any kind: the survey's family income is all of it) and whether any of it is a
 * guess, the state, the tenure (a mortgage picked or held: owner with a mortgage; a home and no mortgage: owner without
 * one; else a renter) and what Get started's tiles picked.
 */
export function profileOf(plan, today) {
  const people = L(plan?.household, "people");
  const adults = people.filter((p) => p?.role !== "dependent").map((p) => ({ id: p.id, role: p.role, age: p?.birthDate && today ? ageOn(p.birthDate, today) : null }));
  const ages = adults.map((a) => a.age).filter((a) => ok(a) && a >= 0);
  const lines = L(plan, "income").filter((x) => x && x.period !== "once" && Number(x.amount) > 0 && (!today || activeOn(x, today)));
  const income = lines.reduce((s, x) => s + perYear(x.amount, x.period), 0);
  const payGuessed = lines.some((x) => typeof x.id === "string" && !/[.[\]]/.test(x.id) && isGuess(plan, `income[${x.id}].amount`));
  const setup = plan?.guide?.setup ?? {};
  const picked = (kind) => (Array.isArray(setup.picks?.[kind]) ? setup.picks[kind] : []);
  const accounts = L(plan, "accounts");
  const mortgage = picked("owe").includes("mortgage") || accounts.some((a) => a?.type === "mortgage");
  const home = mortgage || picked("have").includes("home") || accounts.some((a) => a?.type === "property");
  return {
    today, adults, kids: people.filter((p) => p?.role === "dependent").length,
    age: ages.length ? Math.max(...ages) : null,
    income: income > 0 ? income : null, payHow: income > 0 ? (payGuessed ? "guess" : "typed") : null,
    state: stateOf(plan),
    tenure: mortgage ? "ownerWithMortgage" : home ? "ownerWithoutMortgage" : "renter",
    picks: { have: picked("have"), owe: picked("owe") },
    taps: setup.taps && typeof setup.taps === "object" ? setup.taps : {},
  };
}

// ---- the Survey of Consumer Finances by income and age (R2)
const MED = BAL.scf2025_median_value_if_held, MEAN = BAL.scf2025_mean_value_if_held;
export const SCF_TABLES = ["scf2025_median_value_if_held", "scf2025_mean_value_if_held", "scf2025_family_income", "scf2025_actual_income_percentile_cutoffs_derived"];
/** Each income group by the percentile at its middle (the survey's groups: 0-20, 20-40, 40-60, 60-80, 80-90, 90-100). */
const INC_COLS = [["incomePercentile:0-20", 10], ["incomePercentile:20-40", 30], ["incomePercentile:40-60", 50], ["incomePercentile:60-80", 70], ["incomePercentile:80-90", 85], ["incomePercentile:90-100", 95]];
const AGE_COLS = [["age:under 35", 0, 34], ["age:35-44", 35, 44], ["age:45-54", 45, 54], ["age:55-64", 55, 64], ["age:65-74", 65, 74], ["age:75 or older", 75, Infinity]];
const cellOf = (t, row, col) => { const i = t.cols.indexOf(col); const v = i >= 0 ? t.rows[row]?.[i] : null; return ok(v) && v > 0 ? v : null; };
/** The age group a reference age falls in ("age:35-44"), or null. */
export const ageCol = (age) => (ok(age) ? AGE_COLS.find(([, lo, hi]) => age >= lo && age <= hi)?.[0] ?? null : null);

/** Where a family income sits among all families: the survey's income cut-offs, straight lines on log income ($1,000 = 0.5). */
export function incomePercentile(income) {
  const t = BAL.scf2025_actual_income_percentile_cutoffs_derived;
  const pts = [[Math.log(1000), 0.5], ...t.cols.map((c, i) => [Math.log(t.rows.income[i]), Number(c)])];
  return interpLinear(pts, Math.log(Math.max(1000, income)));
}
/** The median of `item` at an income: straight lines on the log of the medians between the income groups' middles. */
function byIncome(item, income) {
  const pts = INC_COLS.map(([c, mid]) => [mid, cellOf(MED, item, c)]).filter(([, v]) => v).map(([mid, v]) => [mid, Math.log(v)]);
  const y = interpLinear(pts, incomePercentile(income));
  return y === null ? null : Math.exp(y);
}
/**
 * R2 for a balance among families who have one: the all-families median x [median at the family's income / all] x the
 * age ratio left once the age group's typical income is taken out ([age median / all] / [median at the age group's
 * median family income / all]). An unknown income keeps the age group's own median (income integrated out); an unknown
 * age keeps the income ratio alone; neither gives the all-families median. The spread is the age group's (else all
 * families') sqrt(2 ln(mean / median)). -> { value, sigma, parts } | null
 */
export function scfR2(item, { income = null, age = null } = {}) {
  const all = cellOf(MED, item, "all:all families");
  if (!all) return null;
  const col = ageCol(age);
  const ageMed = col ? cellOf(MED, item, col) : null;
  const inc = ok(income) && income > 0 ? income : null;
  let rInc = 1, resid = 1;
  if (inc) rInc = byIncome(item, inc) / all;
  if (ageMed) {
    const rAge = ageMed / all;
    const typical = inc ? cellOf(BAL.scf2025_family_income, "median", col) : null;
    resid = typical ? rAge / (byIncome(item, typical) / all) : rAge;
  }
  const at = ageMed ? col : "all:all families";
  const sigma = sigmaFromMeanMedian(cellOf(MEAN, item, at), cellOf(MED, item, at));
  return { value: all * rInc * resid, sigma, parts: { all, rInc, resid, age: ageMed ? col : null, income: inc } };
}

/** The published CPI (Damodaran/BLS, retirement/historical's RETURNS) for every year after `year` up to its last (2025). */
export function cpiSince(year) {
  return RETURNS.filter((r) => r.year > year).reduce((f, r) => f * (1 + r.inflation), 1);
}

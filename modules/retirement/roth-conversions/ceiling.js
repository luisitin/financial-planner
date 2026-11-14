// modules/retirement/roth-conversions/ceiling.js -- PURE. "Stop sooner" (gap design #26, 2026-11-14): an income line a year's
// Roth conversion also stops at, on top of the tax rate it fills. Two lines, each from the table the app already holds:
// - "medicare": Medicare's income surcharge. A year's premium is set by the tax return from two years before (42 USC
//   1395r(i)(4)(B)(i)), so in a year t when someone will be on Medicare in t + 2, the line is the first surcharge tier
//   (retirement/medicare/data/medicare.js, by filing status, held in today's dollars as the Medicare page holds it).
// - "marketplace": the income where the help with marketplace health insurance stops (the premium tax credit, 26 USC
//   36B(c)(1)(A): 400% of the poverty line under the law as it stands for 2026). In a marketplace year the line is that year's
//   `cliff` from retirement/healthcare's own compute. Under "If the larger 2021-2025 credits come back" there is no cliff, so
//   nothing is capped and the page says so.
// The projection's buildInputs hands the result to the engine as `inputs.conversionCeiling` (core/math/retirement.js), so every
// page that starts there counts it. With the plan's choice absent or "bracket", it hands over nothing: the answers of before.
// Calls into the other pages happen inside functions only, never at load (the retirement pages import each other in a ring).
import { project } from "../../../core/math/retirement.js";
import { tiersFor } from "../medicare/data/medicare.js";
import { SCHEDULES } from "../healthcare/data/aca.js";
import { compute as computeHealthcare } from "../healthcare/compute.js";

export const CEILINGS = ["bracket", "medicare", "marketplace"];
/** The plan's choice: `retirement.conversionCeiling`, "bracket" (the tax rate alone) when absent or not one of the three. */
export const ceilingOf = (plan) => (CEILINGS.includes(plan?.retirement?.conversionCeiling) ? plan.retirement.conversionCeiling : "bracket");
/** A conversion stops this far under a line, in today's dollars, so rounding to a cent never lands on the wrong side of it. */
export const UNDER = 1;

/** Medicare's first surcharge line for a filing status (today's dollars): income up to it pays the standard premium. */
export const medicareLine = (status) => tiersFor(status || "single")[0][0];
/**
 * The years a conversion can raise a Medicare premium: someone is 65 or over, and within their plan, two years later (the
 * Medicare page's own "enrolled" rule, on the year the premium is paid). medicareYears(inputs) -> [year]
 */
export function medicareYears(inputs) {
  const out = [];
  for (let y = inputs.startYear; y <= inputs.endYear; y++) {
    if ((inputs.people ?? []).some((p) => { const a = y + 2 - p.birthYear; return a >= 65 && a <= (p.endAge ?? Infinity); })) out.push(y);
  }
  return out;
}

/**
 * The marketplace years and each one's line, from retirement/healthcare's own compute (its years, household size and poverty
 * line; nothing here depends on the plan's income, so the run it is handed is the plan with no conversions and no health line).
 * marketplaceLines(plan, inputs, { today }) -> { rules, noCliff (these rules have no line), years: [{ year, cliff | null }] }
 */
export function marketplaceLines(plan, inputs, { today = null } = {}) {
  const run = project({ ...inputs, rothConversion: null, conversionCeiling: undefined });
  const hc = computeHealthcare(plan, { today, planIncome: { inputs, run, acaMagiOf: () => 0 } });
  const rules = hc.rules ?? "law";
  return { rules, noCliff: !hc.separate && SCHEDULES[rules]?.cliff === Infinity, separate: !!hc.separate, years: (hc.years ?? []).map((y) => ({ year: y.year, cliff: y.cliff ?? null })) };
}
/** What the larger-credit rules ask of each extra dollar past four times the poverty line: the flat top share of income in that
 * schedule (0.085). Below that the share itself still climbs with income, so a dollar there can cost more than this. */
export const topShare = (rules = "enhanced") => Math.max(...(SCHEDULES[rules]?.bands ?? []).map((b) => b[3]));

/**
 * What the engine is handed for a choice: null for "bracket" (and for a line that applies in no year), else
 * { kind, lineFor(year) -> today's dollars | Infinity, untaxedSocial, years: [{ year, line }] } (the line itself; lineFor
 * stops UNDER it). conversionCeiling(plan, inputs, { today, kind? }) -- kind defaults to the plan's own choice.
 */
export function conversionCeiling(plan, inputs, { today = null, kind = ceilingOf(plan) } = {}) {
  if (!inputs || kind === "bracket" || !CEILINGS.includes(kind)) return null;
  let years = [], untaxedSocial = false;
  if (kind === "medicare") {
    const line = medicareLine(plan.household?.filingStatus);
    years = medicareYears(inputs).map((year) => ({ year, line }));
  } else {
    const m = marketplaceLines(plan, inputs, { today });
    years = m.years.filter((y) => Number.isFinite(y.cliff) && y.cliff > 0).map((y) => ({ year: y.year, line: y.cliff }));
    untaxedSocial = true;   // the marketplace counts the whole Social Security benefit (26 USC 36B(d)(2)(B)); Medicare's surcharge does not
  }
  if (!years.length) return null;
  const by = new Map(years.map((y) => [y.year, y.line]));
  return { kind, untaxedSocial, years, lineFor: (year) => (by.has(year) ? Math.max(0, by.get(year) - UNDER) : Infinity) };
}

// ---- the words (one sentence per case, each with a test in module.test.mjs) ------------------------------------------------------
const usd = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const span = (ys) => (ys.length > 1 ? (ys.at(-1) - ys[0] === ys.length - 1 ? `${ys[0]} to ${ys.at(-1)}` : `${ys.length} years from ${ys[0]} to ${ys.at(-1)}`) : String(ys[0]));
/** Each line by name, inside a sentence. */
export const LINE_NAME = { medicare: "Medicare's income surcharge", marketplace: "the marketplace credit line" };
/** The chip for each choice. */
export const CHIP = { bracket: "No earlier stop", medicare: "Under Medicare's income surcharge", marketplace: "Under the marketplace credit line" };
/** The line under the chips for a choice the plan can use: what the line is, its figure and its years. The Medicare line acts
 * two years before someone is 65: `turns63` (someone turns 63 in its first year) says so with the year; with someone already
 * past 63 it acts in every year, and no year is named (a first year that is nearly over read as stale). */
export function whyWords(stop, { money = usd } = {}) {
  if (stop.key === "medicare") return `Medicare charges more for its monthly premiums when your income two years earlier was over about ${money(stop.line)}. This keeps each year just under it${stop.turns63 ? `, from the year someone turns 63 (${stop.years[0]})` : ""}.`;
  if (stop.key === "marketplace" && stop.noCliff) return `No cliff under these rules: at higher incomes each extra $1 costs ${Number((stop.share * 100).toFixed(1))}¢ of credit.`;
  if (stop.key === "marketplace") return `The help with marketplace health insurance stops when your income passes about ${money(stop.line)}. This keeps ${stop.years.length > 1 ? "each year" : "the year"} you buy that coverage (${span(stop.years)}) just under it.`;
  return "";
}
/** A choice against no earlier stop, at the same tax rate: what is left at the end, after tax. The noun is in the figure
 * ("more left at the end"): beside a line about tax and premiums a bare "more" read as more cost. */
export function diffWords(stop, base, { money = usd } = {}) {
  if (stop.key === "bracket") return "";
  if (!stop.success) return `runs out ${stop.failYear}`;
  if (!base.success) return "lasts to the end";
  const d = stop.endAfterTaxReal - base.endAfterTaxReal;
  return Math.abs(d) < 0.5 ? "the same at the end" : d > 0 ? `${money(d)} more left at the end` : `${money(-d)} less left at the end`;
}
/**
 * A choice's lifetime tax and health insurance (marketplace cover before 65 and Medicare after), in today's dollars. Where the
 * plan's health insurance is already inside its spending (`healthPriced` false) no premium is worked out from income, so the
 * figure is left out and a line that exists to save on premiums says that its saving is not counted.
 */
export function costWords(stop, { money = usd } = {}) {
  const own = stop.key !== "bracket";
  if (stop.healthPriced === false) return `Tax over your whole plan: ${money(stop.taxesReal)}.${own ? " Your health insurance is counted inside your spending, so what this saves on premiums is not shown." : ""}`;
  return `Tax over your whole plan: ${money(stop.taxesReal)}; health insurance: ${money(stop.healthReal)}.${own && stop.sameAsBracket ? " It never comes into play: your conversions already stay under it." : ""}`;
}
/** The green line after a tap: what was saved and the answer it leads to. While conversions are off (`on` false) the plan
 * converts nothing, so no end figure is quoted as if it were the plan's: the line says when the choice starts to count. */
export function savedWords(stop, { rate, money = usd, on = true } = {}) {
  if (!on && !(stop.key === "marketplace" && stop.noCliff)) return `Saved: ${stop.key === "bracket" ? "no earlier stop" : `conversions will stop under ${LINE_NAME[stop.key]}`}. It counts once conversions are on in your plan.`;
  const tail = stop.success ? `At the ${Math.round(rate * 100)}% rate that leaves about ${money(stop.endAfterTaxReal)} at the end, after tax.` : `At the ${Math.round(rate * 100)}% rate the money runs out in ${stop.failYear}.`;
  if (stop.key === "bracket") return `Saved: conversions fill the tax rate again, with no earlier stop. ${tail}`;
  if (stop.key === "marketplace" && stop.noCliff) return "Saved. Under the rules you chose for marketplace credits there is no line to stop at, so nothing changes.";
  return `Saved: each year's conversion now stops under ${stop.key === "medicare" ? "Medicare's income surcharge" : "the marketplace credit line"}. ${tail}`;
}
/** The answer's own small line while a stop is set and has years to act in ("" otherwise). */
export const heroWords = (stop) => (!stop || stop.key === "bracket" || stop.noCliff || !stop.years.length ? "" : `Each year also stops under ${stop.key === "medicare" ? "Medicare's income surcharge" : "the marketplace credit line"}, as you chose.`);
/** A saved line with nothing to act on (no pre-tax money, or no years to convert in): said, with a way to take it off. */
export const idleWords = (kind) => `Your plan is set to stop each year's conversion under ${LINE_NAME[kind]}. With nothing to convert now, it does nothing.`;
/** The status beside "Conversion settings" (20 characters at most). */
export const statusWords = ({ on, fillRate, ceiling }) => (ceiling !== "bracket" ? `${on ? `${Math.round(fillRate * 100)}%` : "off"}, stops sooner` : on ? `on, at the ${Math.round(fillRate * 100)}% rate` : "off");

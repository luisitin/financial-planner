// modules/scenarios/sensitivity/compute.js -- PURE and heavy. Which of the plan's numbers matter most:
// each input nudged down and up by a realistic amount, everything else held, and the result measured
// as the steady spending the plan can carry (and what is left at the end). Sorted by how far each one
// swings the answer: the tornado.
import { project, affordableSpending, copyInputs } from "../../../core/math/retirement.js";
import { buildInputs } from "../../retirement/projection/compute.js";
import { ageOn } from "../../../core/math/dates.js";
import { money as fmtMoney } from "../../../core/format.js";

/** The share of scheduled Social Security payable once the retirement trust fund runs dry (2025 Trustees Report: 2033, 77%). */
export const SS_PAYABLE_IF_DEPLETED = 0.77;
/** How far each input is nudged either way. */
export const NUDGE = { returns: 0.01, inflation: 0.01, retireYears: 2, endYears: 5, saving: 0.25, mix: 0.2, tax: 0.05, raises: 0.01 };

const pct1 = (x) => `${(Math.round(x * 1000) / 10).toFixed(1)}%`;
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/**
 * compute(plan, { today }) -> {
 *   ready, missing, base: { affordableMonthly, spendingMonthly, endReal, success },
 *   rows: [{ id, label, help, baseLabel, low: { label, affordableMonthly, endReal, success }, high: {...}, swing (monthly), worse: "low"|"high" }]
 *     sorted by swing, largest first,
 *   biggest: row | null
 * }
 * "low" and "high" are the input's own low and high settings; `worse` names the one that leaves less to spend.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const b = buildInputs(plan, { today });
  if (!b.inputs) return { ready: false, missing: b.missing };
  const I = b.inputs;
  const measure = (inputs) => { const r = project(inputs); return { affordableMonthly: affordableSpending(inputs) / 12, endReal: r.endBalanceReal, success: r.success }; };
  const fromInputs = (mutate) => { const c = copyInputs(I); mutate(c); return c; };
  const fromPlan = (mutate) => { const p2 = JSON.parse(JSON.stringify(plan)); mutate(p2); return buildInputs(p2, { today }).inputs; };
  const base = { ...measure(I), spendingMonthly: I.spending.yearly / 12 };
  const rows = [];
  const add = (id, label, help, baseLabel, low, high) => {
    if (!low.inputs || !high.inputs) return;
    const lo = { label: low.label, ...measure(low.inputs) }, hi = { label: high.label, ...measure(high.inputs) };
    rows.push({ id, label, help, baseLabel, low: lo, high: hi, swing: Math.abs(hi.affordableMonthly - lo.affordableMonthly), worse: lo.affordableMonthly <= hi.affordableMonthly ? "low" : "high" });
  };
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent" && p.birthDate);
  const self = adults.find((p) => p.role === "self") ?? adults[0];
  const ageNow = ageOn(self.birthDate, today);
  const retireAge = Number(self.retirementAge ?? plan.assumptions?.retirementAge ?? 65);

  add("stocks", "How much stocks earn", "a year, before inflation", pct1(I.returns.stocks),
    { label: pct1(I.returns.stocks - NUDGE.returns), inputs: fromInputs((c) => { c.returns.stocks -= NUDGE.returns; }) },
    { label: pct1(I.returns.stocks + NUDGE.returns), inputs: fromInputs((c) => { c.returns.stocks += NUDGE.returns; }) });
  add("bonds", "How much bonds earn", "a year, before inflation", pct1(I.returns.bonds),
    { label: pct1(I.returns.bonds - NUDGE.returns), inputs: fromInputs((c) => { c.returns.bonds -= NUDGE.returns; }) },
    { label: pct1(I.returns.bonds + NUDGE.returns), inputs: fromInputs((c) => { c.returns.bonds += NUDGE.returns; }) });
  add("inflation", "Inflation", "a year; returns stay as typed, so higher inflation means less growth after it", pct1(I.rates.inflation),
    { label: pct1(I.rates.inflation - NUDGE.inflation), inputs: fromInputs((c) => { c.rates.inflation -= NUDGE.inflation; }) },
    { label: pct1(I.rates.inflation + NUDGE.inflation), inputs: fromInputs((c) => { c.rates.inflation += NUDGE.inflation; }) });
  if (ageNow !== null && ageNow < retireAge) {
    const earlier = Math.max(ageNow + 1, retireAge - NUDGE.retireYears), later = retireAge + NUDGE.retireYears;
    if (earlier < retireAge) add("retire", `When ${self.name || "you"} retire${self.name ? "s" : ""}`, "the household's spending years start then; saving stops", `age ${retireAge}`,
      { label: `age ${earlier}`, inputs: fromPlan((p) => { p.household.people.find((q) => q.id === self.id).retirementAge = earlier; }) },
      { label: `age ${later}`, inputs: fromPlan((p) => { p.household.people.find((q) => q.id === self.id).retirementAge = later; }) });
  }
  const endAge = Number(self.lifeExpectancy ?? plan.assumptions?.planEndAge ?? 95);
  add("end", "How long the plan runs", "every adult's plan-end age", `to ${endAge}`,
    { label: `to ${endAge - NUDGE.endYears}`, inputs: fromPlan((p) => { for (const q of p.household.people) if (q.role !== "dependent") q.lifeExpectancy = Number(q.lifeExpectancy ?? p.assumptions?.planEndAge ?? 95) - NUDGE.endYears; }) },
    { label: `to ${endAge + NUDGE.endYears}`, inputs: fromPlan((p) => { for (const q of p.household.people) if (q.role !== "dependent") q.lifeExpectancy = Number(q.lifeExpectancy ?? p.assumptions?.planEndAge ?? 95) + NUDGE.endYears; }) });
  if (I.contributions.length && I.retireYear > I.startYear) {
    const now = I.contributions.reduce((s, c) => s + c.yearly, 0);
    add("saving", "How much you save", "into retirement accounts, employer money included", `${fmtMoney(now / 12, plan.meta?.currency ?? "USD")} a month`,
      { label: `${Math.round(100 - NUDGE.saving * 100)}%`, inputs: fromInputs((c) => { for (const x of c.contributions) x.yearly *= 1 - NUDGE.saving; }) },
      { label: `${Math.round(100 + NUDGE.saving * 100)}%`, inputs: fromInputs((c) => { for (const x of c.contributions) x.yearly *= 1 + NUDGE.saving; }) });
    add("raises", "Pay rises", "a year; saving grows with pay", pct1(I.rates.salaryGrowth),
      { label: pct1(I.rates.salaryGrowth - NUDGE.raises), inputs: fromInputs((c) => { c.rates.salaryGrowth -= NUDGE.raises; }) },
      { label: pct1(I.rates.salaryGrowth + NUDGE.raises), inputs: fromInputs((c) => { c.rates.salaryGrowth += NUDGE.raises; }) });
  }
  const ss = plan.retirement?.socialSecurity ?? {};
  if (I.incomes.some((x) => x.kind === "social")) {
    const claimAll = (age) => fromPlan((p) => { for (const id of Object.keys(p.retirement.socialSecurity ?? {})) p.retirement.socialSecurity[id].claimAge = age; });
    const claims = [...new Set(Object.values(ss).map((s) => Number(s.claimAge) || 67))];
    add("claim", "When Social Security starts", "everyone claims at the same age", claims.length === 1 ? `at ${claims[0]}` : "as on the page",
      { label: "at 62", inputs: claimAll(62) }, { label: "at 70", inputs: claimAll(70) });
    add("ss-cut", "Social Security paid in full", `if the trust fund runs dry in 2033, about ${Math.round(SS_PAYABLE_IF_DEPLETED * 100)}% of benefits can be paid (2025 Trustees Report)`, "in full",
      { label: `${Math.round(SS_PAYABLE_IF_DEPLETED * 100)}%`, inputs: fromInputs((c) => { for (const x of c.incomes) if (x.kind === "social") x.yearly *= SS_PAYABLE_IF_DEPLETED; }) },
      { label: "in full", inputs: copyInputs(I) });
  }
  add("mix", "Stocks in retirement", "the share of savings in stocks once retired", `${Math.round(I.rates.stocksRetired * 100)}%`,
    { label: `${Math.round(clamp01(I.rates.stocksRetired - NUDGE.mix) * 100)}%`, inputs: fromInputs((c) => { c.rates.stocksRetired = clamp01(c.rates.stocksRetired - NUDGE.mix); }) },
    { label: `${Math.round(clamp01(I.rates.stocksRetired + NUDGE.mix) * 100)}%`, inputs: fromInputs((c) => { c.rates.stocksRetired = clamp01(c.rates.stocksRetired + NUDGE.mix); }) });
  if ((I.tax?.mode ?? "flat") === "flat") add("tax", "Tax on withdrawals", "the flat rate on money from pre-tax accounts", pct1(I.rates.taxRate),
    { label: pct1(Math.max(0, I.rates.taxRate - NUDGE.tax)), inputs: fromInputs((c) => { c.rates.taxRate = Math.max(0, c.rates.taxRate - NUDGE.tax); }) },
    { label: pct1(I.rates.taxRate + NUDGE.tax), inputs: fromInputs((c) => { c.rates.taxRate += NUDGE.tax; }) });

  rows.sort((a, c) => c.swing - a.swing);
  return { ready: true, missing: [], base, rows, biggest: rows[0] ?? null };
}

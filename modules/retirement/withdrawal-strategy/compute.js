// modules/retirement/withdrawal-strategy/compute.js -- PURE. The four ways of deciding how much
// to take out each year, run on this household's own numbers: under the plan's expected returns
// and through the worst real stretch of history. What each gives in the first year, what it
// could fall to, and how the money ends up.
import { project, STRATEGIES } from "../../../core/math/retirement.js";
import { buildInputs } from "../projection/compute.js";
import { RETURNS } from "../historical/data/returns.js";

export const DESCRIPTIONS = {
  "fixed-real": { name: "Same spending every year", how: "Take what you need, raise it with inflation, whatever the markets do. Steady, but a bad decade can drain the pot.", from: "The classic '4% rule' (Bengen 1994, the Trinity study)." },
  "percent": { name: "A share of what is left", how: "Take the same percentage of the balance every year. It can never run out, but a bad year cuts your spending straight away.", from: "Percent-of-portfolio rule." },
  "guardrails": { name: "Guardrails", how: "Start like the 4% rule; cut 10% when withdrawals climb past 4.8% of the pot, raise 10% when they fall under 3.2%, and skip the inflation raise after a losing year.", from: "Guyton and Klinger (2006), simplified." },
  "vpw": { name: "Spend what the years left can afford", how: "Each year, take the amount that would spread the balance evenly over the years you have left at the expected real return. Higher early, more variable, never runs out early.", from: "Bogleheads variable percentage withdrawal." },
};
/** The worst start year in history for this horizon: the one whose fixed-real run fails first or ends lowest. */
export function worstWindow(inputs) {
  const years = inputs.endYear - inputs.startYear + 1;
  let worst = null;
  for (let s = 0; s + years <= RETURNS.length; s++) {
    const seq = RETURNS.slice(s, s + years).map((r) => ({ stocks: r.stocks, bonds: r.bonds, cash: r.bills, inflation: r.inflation }));
    const r = project({ ...inputs, strategy: "fixed-real" }, { sequence: seq });
    const score = (r.failAge ?? 999) * 1e9 + r.endBalanceReal;
    if (!worst || score < worst.score) worst = { score, startYear: RETURNS[s].year, seq };
  }
  return worst;
}
/**
 * compute(plan, { today }) -> { ready, rows: [{ key, name, how, from, expected: { firstYear, lowest, endReal, success }, worst: { ... } }], worstStartYear, chosen, spendingYearly }
 * Amounts are real (today's dollars) yearly spending.
 */
export function compute(plan, params = {}) {
  const b = buildInputs(plan, params);
  if (!b.inputs) return { ready: false, missing: b.missing };
  const years = b.inputs.endYear - b.inputs.startYear + 1;
  const worst = years <= RETURNS.length ? worstWindow(b.inputs) : null;
  const summarise = (r) => { const ret = r.rows.filter((x) => x.retired); return { firstYear: ret[0]?.spendingReal ?? 0, lowest: ret.length ? Math.min(...ret.map((x) => x.spendingReal)) : 0, highest: ret.length ? Math.max(...ret.map((x) => x.spendingReal)) : 0, endReal: r.endBalanceReal, success: r.success, failAge: r.failAge }; };
  const rows = Object.keys(STRATEGIES).map((key) => ({
    key, ...DESCRIPTIONS[key],
    expected: summarise(project({ ...b.inputs, strategy: key })),
    worst: worst ? summarise(project({ ...b.inputs, strategy: key }, { sequence: worst.seq })) : null,
  }));
  return { ready: true, rows, worstStartYear: worst?.startYear ?? null, chosen: b.inputs.strategy, spendingYearly: b.inputs.spending.yearly, withdrawalRate: b.inputs.withdrawalRate };
}

// modules/retirement/withdrawal-strategy/compute.js -- PURE. The four ways of deciding how much
// to take out each year, run on this household's own numbers: under the plan's expected returns
// and through the worst real stretch of history. What each gives in the first year, what it
// could fall to, and how the money ends up.
import { project, STRATEGIES } from "../../../core/math/retirement.js";
import { buildInputs, compute as computeProjection, BUCKET_OF } from "../projection/compute.js";
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

/**
 * firstYear(plan, { today }) -> null | { year, thisYear, ages, spending, income, sources: ["Social Security", "a pension", ...],
 *   fromSavings, need, required, extra, taxes, buckets: [{ bucket, amount, accounts: [names] }], affordable, verdict, shortAge }:
 * the plain answer to "how much do we take out?" for the first year of retirement (this year, for a household already
 * retired), from Will the money last?'s own year-by-year engine with the chosen way of spending. All in today's dollars.
 *   need = spending + one-off costs + the year's tax - guaranteed income (floor 0): what savings must pay for.
 *   fromSavings = everything taken out that year (the required withdrawal included); extra = fromSavings - need, the part of a
 *   required withdrawal not needed for spending (the engine puts it back into the taxable account).
 *   buckets: where it comes from, in the order the engine takes it (cash first, then the plan's withdrawal order), with the
 *   names of the accounts of that kind.
 * Round 4, 2026-11-02: the page showed four "first year" spending figures and never an amount to take out.
 */
export function firstYear(plan, params = {}) {
  let p = null;
  try { p = computeProjection(plan, params); } catch { p = null; }
  if (!p?.ready) return null;
  const r = p.rows.find((x) => x.retired);
  if (!r) return null;
  const pl = r.priceLevel || 1, real = (n) => (Number(n) || 0) / pl;
  const w = r.withdrawn ?? {};
  const order = ["cash", ...(p.inputs.withdrawalOrder ?? ["taxable", "deferred", "free"]).filter((b) => b !== "cash")];
  const names = (b) => (plan.accounts ?? []).filter((a) => BUCKET_OF[a.type] === b && (Number(a.balance) || 0) > 0).map((a) => a.name).filter(Boolean);
  const buckets = order.filter((b) => (w[b] ?? 0) > 0.5).map((b) => ({ bucket: b, amount: real(w[b]), accounts: names(b) }));
  const fromSavings = buckets.reduce((t, b) => t + b.amount, 0);
  const taxes = real(r.taxes), spending = r.spendingReal, income = r.incomeReal;
  const need = Math.max(0, spending + real(r.eventOut) + taxes - income);
  const lines = r.incomeLines ?? [];
  const sources = [];
  if (lines.some((x) => /social security/i.test(x.name ?? ""))) sources.push("Social Security");
  if (lines.some((x) => /pension/i.test(x.name ?? ""))) sources.push("pension");
  if (lines.some((x) => !/social security|pension/i.test(x.name ?? ""))) sources.push("other income");
  const todayYear = Number(String(params.today ?? "").slice(0, 4)) || null;
  return {
    year: r.year, thisYear: r.year === todayYear, ages: r.ages, spending, income, sources,
    fromSavings, need, required: real(r.rmd), extra: Math.max(0, fromSavings - need), taxes, buckets,
    affordable: p.affordable, verdict: p.verdict, shortAge: p.shortAge ?? null,
  };
}

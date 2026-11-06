// modules/retirement/withdrawal-strategy/compute.js -- PURE. The four ways of deciding how much
// to take out each year, run on this household's own numbers: under the plan's expected returns
// and through the worst real stretch of history. What each gives in the first year, what it
// could fall to, and how the money ends up.
import { project, STRATEGIES } from "../../../core/math/retirement.js";
import { buildInputs, compute as computeProjection, BUCKET_OF, healthAdded } from "../projection/compute.js";
import { RETURNS } from "../historical/data/returns.js";
// what a required withdrawal adds to the year's federal tax (round 8, widow-2): the same figure as Required withdrawals
import { rowIncome, addedTax, withdrawalTax, payThisYear } from "../rmd/compute.js";

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
/** The ways that set what you spend (the plan's figure, then raised or cut) and the ways that set a share of savings to take out. */
export const RULE_OF = { "fixed-real": "spend", guardrails: "spend", percent: "share", vpw: "share" };

/**
 * The first retirement year of one way, in the words "take $X from savings; with your $G of income, that pays for ..." (round 8,
 * widow-1; review D6, D7 and UX 1), all in today's dollars, from the way's own run with the plan's expected returns (row r):
 *   rule "spend" (the same spending every year, guardrails): spend = the year's spending (the row's own figure, the one shown
 *     beside the way), health = its health cover, other = its other one-off costs, tax = the year's tax, take = everything that
 *     comes out of savings that year (a required withdrawal beyond the need included), short = what savings could not pay that
 *     year, back = the part of the withdrawal the engine puts back into savings after the year's need and its tax
 *     (core/math/retirement.js: surplus = withdrawn - need - taxes). With nothing short and nothing back,
 *     take + income = spend + health + other + tax, when the income does not already cover the spending and health cover.
 *   rule "share" (a share of what is left, spend what the years left can afford), when the engine's figure is held (below): the
 *     way's amount read as what it is, a withdrawal on top of the income: take = max(that amount, the required withdrawal),
 *     spend = take + income, before tax. Offered, it reads like the spend ways.
 * -> { year (the first retirement year), rule, take, spend, health, other, tax, short, back, need, income, required, beforeTax }
 */
function firstOf(key, r, held) {
  if (!r) return null;
  const pl = r.priceLevel || 1, real = (n) => (Number(n) || 0) / pl;
  const income = r.incomeReal, required = real(r.rmd);
  if (RULE_OF[key] === "share" && held) { const take = Math.max(r.spendingReal, required); return { year: r.year, rule: "share", take, spend: take + income, health: 0, other: 0, tax: 0, short: 0, back: 0, need: 0, income, required, beforeTax: true }; }
  const out = Object.values(r.withdrawn ?? {}).reduce((t, x) => t + (Number(x) || 0), 0);
  const need = Math.max(0, r.spending + r.eventSpending - r.income) + (r.eventOut - r.eventSpending);
  return { year: r.year, rule: RULE_OF[key] ?? "spend", take: real(out), spend: r.spendingReal, health: real(r.eventSpending), other: real(r.eventOut - r.eventSpending), tax: real(r.taxes),
    short: real(r.shortfall), back: Math.max(0, real(out - need - r.taxes)), need: real(need), income, required, beforeTax: false };
}

/**
 * The guard on one way's expected run (round 8, widow-1; review D2): the engine takes a percentage or guardrail way's figure as
 * all of the year's spending and only then counts guaranteed income against it, so with income it plans on too little. A way other
 * than the same spending every year is held (not offered) when its first-year spending is under what the plan spends
 * ("below-spending"), or when in any retired year it plans on less than that year's guaranteed income ("below-income": the
 * savings then pay nothing toward spending, yet the way cuts it; guardrails did this to a widow from her first year and, for a
 * retiree with $45,000 of income and a 1% draw, from her second). -> { held, under: { year, spending, income } | null }
 */
export function guardOf(key, run, planned) {
  if (key === "fixed-real") return { held: null, under: null };
  const ret = run.rows.filter((x) => x.retired);
  if (!ret.length) return { held: null, under: null };
  if (ret[0].spendingReal < planned - 0.5) return { held: "below-spending", under: null };
  const u = ret.find((x) => x.spendingReal < x.incomeReal - 0.5);
  return u ? { held: "below-income", under: { year: u.year, spending: u.spendingReal, income: u.incomeReal } } : { held: null, under: null };
}

/** heldWays(inputs) -> { [way]: null | "below-spending" | "below-income" }: the guard on each way's expected run (three runs of the engine). */
export function heldWays(inputs) {
  return Object.fromEntries(Object.keys(STRATEGIES).map((key) => [key, key === "fixed-real" ? null : guardOf(key, project({ ...inputs, strategy: key }), inputs.spending.yearly).held]));
}

/**
 * wayOptions(plan, { today }) -> [{ value, label }]: the ways the Projection page's settings offer (round 8 review UX 7: its list
 * set the ways this page does not offer, with no reason given): the ones not held, and the one the plan already uses.
 */
export function wayOptions(plan, params = {}) {
  const b = buildInputs(plan, params);
  return wayOptionsFor(b.inputs ?? null, plan.retirement?.strategy ?? "fixed-real");
}
/** wayOptionsFor(inputs | null, chosen) -> the same, from inputs already built (the Projection page's own); every way when there are none. */
export function wayOptionsFor(inputs, chosen = "fixed-real") {
  const held = inputs ? heldWays(inputs) : {};
  const mine = inputs?.strategy ?? chosen;
  return Object.entries(STRATEGIES).filter(([k]) => k === mine || !held[k]).map(([value, label]) => ({ value, label }));
}

/**
 * compute(plan, { today }) -> { ready, rows: [{ key, name, how, from, expected: { firstYear, lowest, endReal, success }, worst: { ... },
 *   first (firstOf), offer ("Use this one" is shown), held: null | "below-spending" | "below-income", under (guardOf) }], worstStartYear,
 *   chosen, chosenHeld, spendingYearly }
 * Amounts are real (today's dollars) yearly spending.
 * The guard (round 8, widow-1; review D2; the engine change is the owner's question): the engine takes a percentage or guardrail
 * way's figure as all of the year's spending and only then counts guaranteed income against it, so for a widow with $50,400 of
 * pension and Social Security, 4% of her $422,000 became "$16,880 a year" of spending, and "Use this one" planned on that against
 * the $36,000 she spends. guardOf holds such a way; the same spending every year is never held.
 */
export function compute(plan, params = {}) {
  const b = buildInputs(plan, params);
  if (!b.inputs) return { ready: false, missing: b.missing };
  const years = b.inputs.endYear - b.inputs.startYear + 1;
  const worst = years <= RETURNS.length ? worstWindow(b.inputs) : null;
  const summarise = (r) => { const ret = r.rows.filter((x) => x.retired); return { firstYear: ret[0]?.spendingReal ?? 0, lowest: ret.length ? Math.min(...ret.map((x) => x.spendingReal)) : 0, highest: ret.length ? Math.max(...ret.map((x) => x.spendingReal)) : 0, endReal: r.endBalanceReal, success: r.success, failAge: r.failAge }; };
  const planned = b.inputs.spending.yearly;
  const rows = Object.keys(STRATEGIES).map((key) => {
    const run = project({ ...b.inputs, strategy: key });
    const r0 = run.rows.find((x) => x.retired) ?? null;
    const { held, under } = guardOf(key, run, planned);
    return {
      key, ...DESCRIPTIONS[key],
      expected: summarise(run),
      worst: worst ? summarise(project({ ...b.inputs, strategy: key }, { sequence: worst.seq })) : null,
      first: firstOf(key, r0, held), held, under, offer: key !== b.inputs.strategy && !held,
    };
  });
  const chosenRow = rows.find((r) => r.key === b.inputs.strategy);
  return { ready: true, rows, worstStartYear: worst?.startYear ?? null, chosen: b.inputs.strategy, chosenHeld: chosenRow?.held ?? null, spendingYearly: planned, withdrawalRate: b.inputs.withdrawalRate };
}

/**
 * firstYear(plan, { today }) -> null | { year, thisYear, ages, spending, health (the plan's health cover that year, 2026-11-02), healthAdded (the plan adds health cover on top of spending in some year), income, sources: ["Social Security", "a pension", ...],
 *   fromSavings, need, required, requiredTax (what the required withdrawal adds to that year's federal tax: rmd/compute.js addedTax),
 *   extra, taxes, other (one-off costs other than health cover), short (what savings could not pay that year: the engine's
 *   shortfall), buckets: [{ bucket, amount, accounts: [names] }], affordable, verdict, shortAge }:
 * the plain answer to "how much do we take out?" for the first year of retirement (this year, for a household already
 * retired), from Will the money last?'s own year-by-year engine with the chosen way of spending. All in today's dollars.
 *   need = spending + one-off costs (the health cover among them) + the year's tax - guaranteed income (floor 0): what savings must pay for.
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
  // what the required withdrawal adds to that year's federal tax, at the brackets (round 8, widow-2: "after about $2,412 of tax
  // on it" was the plan's quick 15%; for her it is $3,429, since it also makes $13,666 more of Social Security taxable)
  // (verify 2026-11-06: in this year's row, on top of the first adult's own pay this year, which the projection does not hold)
  const todayYear = Number(String(params.today ?? "").slice(0, 4)) || null;
  const i = p.rows.indexOf(r), bt = withdrawalTax(plan);
  const requiredTax = r.rmd > 0 ? addedTax(rowIncome(r, p.inputs, bt, i > 0 ? p.rows[i - 1].balances.taxable : p.inputs.balances.taxable, r.year === todayYear ? payThisYear(plan, params.today) : 0), r.rmd, r, bt).added / pl : 0;
  const lines = r.incomeLines ?? [];
  const sources = [];
  if (lines.some((x) => /social security/i.test(x.name ?? ""))) sources.push("Social Security");
  if (lines.some((x) => /pension/i.test(x.name ?? ""))) sources.push("pension");
  if (lines.some((x) => !/social security|pension/i.test(x.name ?? ""))) sources.push("other income");
  return {
    year: r.year, thisYear: r.year === todayYear, ages: r.ages, spending, health: real(r.eventSpending), healthAdded: healthAdded(p.health), income, sources,
    fromSavings, need, required: real(r.rmd), requiredTax, extra: Math.max(0, fromSavings - need), taxes, other: real(r.eventOut - r.eventSpending), short: real(r.shortfall), buckets,
    affordable: p.affordable, verdict: p.verdict, shortAge: p.shortAge ?? null,
  };
}

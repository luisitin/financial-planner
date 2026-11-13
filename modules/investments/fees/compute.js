// modules/investments/fees/compute.js -- PURE. What your funds and any advisor charge each year,
// the weighted average, and what that costs over a lifetime: the same money grown at the
// plan's return with and without the fees (contributions from the Contributions page added
// each year until retirement), plus what switching to cheap index funds would keep.
// Gap #34 (2026-11-13): a plan at work's own fee (from its fee notice) and this year's trading
// and crypto fees, typed under "Set my own numbers", join the yearly cost and the lifetime cost.
import { compute as computeHoldings } from "../holdings/compute.js";
import { compute as computeContributions, limitKind } from "../../retirement/contributions/compute.js";

export const CHEAP_ER = 0.0005;   // what a broad index fund costs today (0.05% or less)

/**
 * Grow `start` for `years` at `rate` less `fee` each year, taking `flat` dollars out each year (a fee charged in dollars,
 * not as a share: a plan's own dollar fee, trading fees; never below zero), adding `yearly` (growing with `growth`) at the
 * end of each of the first `contribYears` years.
 */
export function growWithFees(start, years, rate, fee, yearly = 0, contribYears = 0, growth = 0, flat = 0) {
  let v = start;
  for (let y = 0; y < years; y++) { v *= 1 + rate - fee; if (flat) v = Math.max(0, v - flat); if (y < contribYears) v += yearly * Math.pow(1 + growth, y); }
  return v;
}

const amount = (x) => { const n = Number(x); return Number.isFinite(n) && n > 0 ? n : 0; };
/**
 * A plan at work: a 401(k) / 403(b) / 457 / TSP account, or a Roth 401(k) (a Roth account with an employer match or a
 * 401(k)/403(b)/457/TSP name, as Contributions' limitKind reads it). A Roth IRA is not one.
 */
export function isPlanAtWork(plan, acct) {
  if (acct?.type === "401k") return true;
  if (acct?.type !== "roth") return false;
  const match = Math.max(0, ...(plan.retirement?.contributions ?? []).filter((c) => c.accountId === acct.id).map((c) => Number(c.employerMatch) || 0));
  return limitKind("roth", acct.name, match) === "401k";
}

/**
 * planFeeAccounts(plan, { today }, h?) -> { accounts: [{ id, name, value, pct, dollars, yearly }], waiting: [name] }
 * The plans at work whose funds are on the Holdings page (the money this page counts), each with the plan fee typed for it
 * (`investments.planFees[id]`: pct a fraction of the account a year, dollars a year) and what that comes to a year:
 * value x pct + dollars. `waiting`: the plans at work with no funds on Holdings, so no fee of theirs can be counted yet.
 */
export function planFeeAccounts(plan, params = {}, h = computeHoldings(plan, params)) {
  const typed = plan.investments?.planFees ?? {};
  const accounts = [], waiting = [];
  for (const a of plan.accounts ?? []) {
    if (!isPlanAtWork(plan, a)) continue;
    const mine = h.items.filter((x) => x.accountId === a.id);
    if (!mine.length) { waiting.push(a.name); continue; }
    const value = mine.reduce((s, x) => s + x.value, 0);
    const pct = amount(typed[a.id]?.pct), dollars = amount(typed[a.id]?.dollars);
    accounts.push({ id: a.id, name: a.name, value, pct, dollars, yearly: value * pct + dollars });
  }
  return { accounts, waiting };
}

/** The fees the fund table cannot see, or null when none is typed (then compute() is exactly what it was before #34). */
function otherFees(plan, params, h) {
  const planFees = planFeeAccounts(plan, params, h).accounts.filter((a) => a.yearly > 0)
    .map((a) => ({ accountId: a.id, name: a.name, value: a.value, pct: a.pct, dollars: a.dollars, yearly: a.yearly }));
  const t = plan.investments?.tradingFees;
  const tradingYearly = amount(t?.amount);
  if (!planFees.length && !(tradingYearly > 0)) return null;
  const planPctYearly = planFees.reduce((s, a) => s + a.value * a.pct, 0), planDollars = planFees.reduce((s, a) => s + a.dollars, 0);
  return { planFees, planYearly: planFees.reduce((s, a) => s + a.yearly, 0), planPctYearly, planDollars, tradingYearly, tradingYear: Number(t?.year) || null };
}

/**
 * compute(plan, { today }) -> {
 *   ready, total, items: [{ symbol, name, account, value, er, feeYearly, known }], fundFees (yearly), advisoryFee (fraction), advisoryYearly, feesYearly,
 *   weightedEr, allIn (fraction of the portfolio a year), years, rate, contributions: { yearly, years },
 *   withFees, withoutFees, lifetimeCost, withCheap, cheapSaves, priciest[], unknownCount, notes, endAge,
 *   and only when a plan fee or trading fees are typed (#34): planFees: [{ accountId, name, value, pct, dollars, yearly }],
 *   planYearly, tradingYearly, tradingYear, otherYearly
 * }
 */
export function compute(plan, params = {}) {
  const h = computeHoldings(plan, params);
  const today = params.today ?? null;
  const year = today ? Number(String(today).slice(0, 4)) : new Date().getFullYear();
  const items = h.items.map((x) => ({ symbol: x.symbol, name: x.name, account: x.accountName, value: x.value, er: x.er, feeYearly: x.feeYearly, known: x.er !== null })).sort((a, b) => b.feeYearly - a.feeYearly);
  const priced = items.filter((x) => x.er !== null);
  const pricedValue = priced.reduce((s, x) => s + x.value, 0);
  const fundFees = priced.reduce((s, x) => s + x.feeYearly, 0);
  const weightedEr = pricedValue > 0 ? fundFees / pricedValue : 0;
  const advisoryFee = Math.max(0, Number(plan.investments?.advisoryFee) || 0);
  const advisoryYearly = h.total * advisoryFee;
  // yearly cost = balance x (the fund's ratio + plan %) + plan dollars + trading (#34)
  const other = otherFees(plan, params, h);
  const feesYearly = other ? fundFees + advisoryYearly + other.planYearly + other.tradingYearly : fundFees + advisoryYearly;
  const allIn = h.total > 0 ? feesYearly / h.total : 0;
  const a = plan.assumptions ?? {}, rt = plan.retirement ?? {};
  const stocks = Number(rt.stocksNow ?? 0.7);
  const rate = stocks * Number(a.returnStocks ?? 0.07) + (1 - stocks) * Number(a.returnBonds ?? 0.04);
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent" && p.birthDate);
  const self = adults.find((p) => p.role === "self") ?? adults[0] ?? null;
  const age = self ? year - Number(String(self.birthDate).slice(0, 4)) : null;
  const retireAge = Number(self?.retirementAge ?? a.retirementAge ?? 65), endAge = Number(self?.lifeExpectancy ?? a.planEndAge ?? 95);
  const years = age !== null ? Math.max(10, endAge - age) : 30;
  const contribYears = age !== null ? Math.max(0, retireAge - age) : 0;
  const c = (plan.retirement?.contributions ?? []).length ? computeContributions(plan, { today }) : null;
  const yearly = c?.totalYearly ?? 0;
  const growth = Number(a.salaryGrowth ?? 0.03);
  const withoutFees = growWithFees(h.total, years, rate, 0, yearly, contribYears, growth);
  // a fee charged as a share grows with the money; one charged in dollars (a plan's dollar fee, trading) stays the same
  // dollars each year (#34)
  const shareFee = other && h.total > 0 ? (fundFees + advisoryYearly + other.planPctYearly) / h.total : allIn;
  const flat = other ? other.planDollars + other.tradingYearly : 0;
  const withFees = growWithFees(h.total, years, rate, shareFee, yearly, contribYears, growth, flat);
  // index funds inside a plan at work still pay the plan's own fee; trading and the advisor go, as the advisor always did
  const cheapFee = other && h.total > 0 ? CHEAP_ER + other.planPctYearly / h.total : CHEAP_ER;
  const withCheap = growWithFees(h.total, years, rate, cheapFee, yearly, contribYears, growth, other ? other.planDollars : 0);
  const notes = [];
  const unknownCount = items.length - priced.length;
  if (unknownCount) notes.push(`${unknownCount} holding${unknownCount === 1 ? " has" : "s have"} no expense ratio on file (not a common fund); type it on the Holdings page. Individual stocks cost nothing to hold: enter 0.`);
  return {
    ready: h.hasData, total: h.total, items, fundFees, advisoryFee, advisoryYearly, feesYearly, weightedEr, allIn, years, rate, contributions: { yearly, years: contribYears },
    withFees, withoutFees, lifetimeCost: withoutFees - withFees, withCheap, cheapSaves: withCheap - withFees, priciest: items.filter((x) => x.er !== null && x.er > 0.002).slice(0, 5), unknownCount, notes, endAge,
    ...(other ? { planFees: other.planFees, planYearly: other.planYearly, tradingYearly: other.tradingYearly, tradingYear: other.tradingYear, otherYearly: other.planYearly + other.tradingYearly } : {}),
  };
}

// ---------------------------------------------------------------- the words (one sentence per case, R5; tests read each)
/** A rate as the page shows it: two decimals ("0.25%"). */
export const rateText = (x) => `${(x * 100).toFixed(2)}%`;
const list = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** The headline: what the fees do to the person. */
export const headlineOf = (d, money) => (d.feesYearly > 0 ? `Fees cost you about ${money(d.lifetimeCost)} over the plan` : "Your investments cost almost nothing to hold");

/**
 * The line under the headline. With no plan fee and no trading fees typed it is word for word what it was before #34:
 * the fund fees alone, or with an advisor. With them, each kind of fee is named with what it costs a year, and the
 * index-fund line says the plan's own fee is still paid. pct: the shell's percent with one decimal (the return).
 */
export function ledeOf(d, money, pct) {
  if (!(d.feesYearly > 0)) return `${rateText(d.weightedEr)} on average across ${money(d.total)}: index-fund territory. Nothing to change here.`;
  const grown = `Grown at ${pct(d.rate)} for ${d.years} years${d.contributions.yearly > 0 ? ` with your contributions` : ""}, the money ends at ${money(d.withFees)} instead of ${money(d.withoutFees)}.`;
  if (!(d.otherYearly > 0)) {
    const split = d.advisoryYearly > 0 ? ` (${money(d.fundFees)} in fund fees at ${rateText(d.weightedEr)} on average, ${money(d.advisoryYearly)} to an advisor at ${rateText(d.advisoryFee)})` : ` (fund fees at ${rateText(d.weightedEr)} on average)`;
    return `${money(d.feesYearly)} a year today: ${rateText(d.allIn)} of ${money(d.total)}${split}. ${grown}${d.cheapSaves > 1000 ? ` In broad index funds at 0.05% it would end at ${money(d.withCheap)}: ${money(d.cheapSaves)} more.` : ""}`;
  }
  const plans = d.planFees.length > 1;
  const kinds = [
    `${money(d.fundFees)} in fund fees at ${rateText(d.weightedEr)} on average`,
    d.advisoryYearly > 0 ? `${money(d.advisoryYearly)} to an advisor at ${rateText(d.advisoryFee)}` : null,
    d.planYearly > 0 ? `${money(d.planYearly)} charged by your ${plans ? "plans" : "plan"} at work` : null,
    d.tradingYearly > 0 ? `${money(d.tradingYearly)} in trading fees` : null,
  ].filter(Boolean);
  const cheap = d.cheapSaves > 1000
    ? ` In broad index funds at 0.05%${d.planYearly > 0 ? `, still paying your ${plans ? "plans' own fees" : "plan's own fee"},` : ""} it would end at ${money(d.withCheap)}: ${money(d.cheapSaves)} more.`
    : "";
  return `${money(d.feesYearly)} a year today: ${rateText(d.allIn)} of ${money(d.total)} (${list(kinds)}). ${grown}${cheap}`;
}

/** The green line after a save in "Set my own numbers" (R7): the new answer when the headline changed. */
export function savedWords(wasHeadline, d, money) {
  if (!d.ready) return "Saved. These fees count once your funds are on the Holdings page.";
  if (headlineOf(d, money) === wasHeadline) return "Saved.";
  return d.feesYearly > 0 ? `Saved. Fees now cost you about ${money(d.lifetimeCost)} over the plan, ${money(d.feesYearly)} a year today.` : "Saved. Your investments now cost almost nothing to hold.";
}

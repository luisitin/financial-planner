// modules/taxes/hsa-fsa/compute.js -- PURE. The health savings account: the limit for your
// coverage and age, the room left this year, the tax the contribution saves (income tax at your
// marginal rate plus payroll tax when it goes in through the paycheck), and what the money
// grows into untaxed. The flexible spending account: the election against its limit, what is
// unspent, and the use-it-or-lose-it deadline.
import { LIMITS } from "../../retirement/contributions/data/limits.js";
import { taxInputs } from "../federal/compute.js";
import { federalTax } from "../../../core/math/tax.js";
import { daysBetween } from "../../../core/math/dates.js";

const FICA = 0.0765;   // Social Security 6.2% + Medicare 1.45%, saved when the contribution is taken from pay

/**
 * compute(plan, { today }) -> {
 *   year, limitsYear, hsa: { coverage, limit, catchUp, contribution, employer, total, room, over, taxSaved, ficaSaved, savedTotal, marginal, years, growthRate, futureValue, futureContributions },
 *   fsa: { election, limit, spent, unspent, daysLeft, carryover, taxSaved, over },
 *   hasHsa, hasFsa, notes
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const b = taxInputs(plan, params);
  const year = b.year;
  const limitsYear = LIMITS[year] ? year : Math.max(...Object.keys(LIMITS).map(Number));
  const L = LIMITS[limitsYear].kinds;
  const h = plan.taxes?.hsa ?? {};
  const coverage = h.coverage === "family" ? "family" : "self";
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent" && p.birthDate);
  const self = adults.find((p) => p.role === "self") ?? adults[0] ?? null;
  const age = (p) => p ? year - Number(String(p.birthDate).slice(0, 4)) : null;
  const fiftyFive = adults.filter((p) => age(p) >= 55).length;
  const catchUp = Math.min(coverage === "family" ? 2 : 1, fiftyFive) * (L.hsa.catchUp ?? 1000);
  const limit = (coverage === "family" ? L.hsa.family : L.hsa.limit) + catchUp;
  const contribution = Math.max(0, Number(h.contribution) || 0), employer = Math.max(0, Number(h.employer) || 0);
  const total = contribution + employer;
  const room = Math.max(0, limit - total), over = Math.max(0, total - limit);
  // the tax the contribution saves: the federal bill with it against without it (the plan already counts it as an adjustment)
  const withIt = federalTax(b.inputs, b.params).totalTax;
  const without = federalTax({ ...b.inputs, adjustments: Math.max(0, b.inputs.adjustments - contribution) }, b.params).totalTax;
  const taxSaved = Math.max(0, without - withIt);
  const ficaSaved = contribution * FICA;
  const marginal = contribution > 0 ? taxSaved / contribution : 0;
  const a = plan.assumptions ?? {}, rt = plan.retirement ?? {};
  const stocks = Number(rt.stocksNow ?? 0.7);
  const growthRate = stocks * Number(a.returnStocks ?? 0.07) + (1 - stocks) * Number(a.returnBonds ?? 0.04);
  const years = self ? Math.max(0, 65 - age(self)) : 20;
  const futureValue = total > 0 && years > 0 ? (growthRate > 0 ? total * (Math.pow(1 + growthRate, years) - 1) / growthRate : total * years) : 0;
  const hsaBalance = (plan.accounts ?? []).filter((x) => x.type === "hsa").reduce((s, x) => s + (Number(x.balance) || 0), 0);
  const balanceGrown = hsaBalance * Math.pow(1 + growthRate, years);
  const hsa = { coverage, limit, catchUp, contribution, employer, total, room, over, taxSaved, ficaSaved, savedTotal: taxSaved + ficaSaved, marginal, years, growthRate, futureValue, futureContributions: total * years, balance: hsaBalance, balanceGrown, atSixtyFive: futureValue + balanceGrown };
  const election = Math.max(0, Number(h.fsa) || 0), spent = Math.max(0, Number(h.fsaSpent) || 0);
  const fsaLimit = L.fsa?.limit ?? 3300;
  const daysLeft = today ? Math.max(0, daysBetween(today, `${year}-12-31`)) : null;
  const fsaWith = federalTax({ ...b.inputs, wages: Math.max(0, b.inputs.wages - election) }, b.params).totalTax;
  const fsa = { election, limit: fsaLimit, spent, unspent: Math.max(0, election - spent), daysLeft, carryover: L.fsa?.carryover ?? 660, taxSaved: election > 0 ? Math.max(0, withIt - fsaWith) + election * FICA : 0, over: Math.max(0, election - fsaLimit) };
  const notes = [];
  if (over > 0) notes.push(`The HSA is over the ${limitsYear} limit by ${Math.round(over).toLocaleString("en-US")}: excess contributions are taxed 6% a year until withdrawn.`);
  if (election > 0 && total > 0) notes.push("A general-purpose health FSA and an HSA cannot run in the same year; with an HSA the FSA has to be the limited-purpose kind (dental and vision only).");
  if (fsa.over > 0) notes.push(`The FSA election is over the ${limitsYear} limit of ${fsaLimit.toLocaleString("en-US")}.`);
  return { year, limitsYear, hsa, fsa, hasHsa: total > 0 || hsaBalance > 0, hasFsa: election > 0, notes, selfName: self?.name ?? "you" };
}

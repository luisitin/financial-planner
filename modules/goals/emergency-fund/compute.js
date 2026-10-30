// modules/goals/emergency-fund/compute.js -- PURE. How big the emergency fund should be for this household
// (months of must-pay bills: three with two steady incomes, more with one income, children, or pay that
// goes up and down), how much of it is there (the usable cash on the Emergency fund page), how long the rest
// takes at what goes in each month, and where the money earns most while it waits: cash sitting in checking
// beyond a month of spending could be in savings.
import { compute as computeLiquidity } from "../../balance/liquidity/compute.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeGoals } from "../goals/compute.js";
import { solveMonths } from "../house/compute.js";

const EMERGENCY = /emergency|rainy ?day|cushion/i;

/** The months to aim for, and why: 3 with two or more steady earners, 6 with one, 3 more for self-employment or commission pay, at most 12. */
export function suggestedMonths({ earners, variable, dependants }) {
  const reasons = [];
  let m = earners >= 2 ? 3 : 6;
  reasons.push(earners >= 2 ? "two steady incomes: if one stops, the other carries most of the bills" : earners === 1 ? "one income: if it stops, nothing else comes in" : "no pay on file: plan for the longer end");
  if (variable) { m += 3; reasons.push("pay that goes up and down (self-employment, commission or bonuses) needs a bigger cushion"); }
  if (dependants && earners < 2) { reasons.push("children depend on the one income"); }
  return { months: Math.min(12, m), reasons };
}

/**
 * compute(plan, { today }) -> {
 *   essentialMonthly, now (usable cash), months (set, from Assumptions), suggested: { months, reasons }, target, gap, runwayMonths, status,
 *   goal (an emergency goal on Goals: { id, name, monthly, isEmergencyFund }) | null, monthly (what goes in a month), monthsToGo, readyDate,
 *   checking: { balance, oneMonth, spare } (cash in checking beyond a month of all spending), cashRate, spareInterest (what the spare earns a year in savings), warnings
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const liq = computeLiquidity(plan, { today });
  const inc = computeIncome(plan, { today });
  const people = plan.household?.people ?? [];
  const adults = people.filter((p) => p.role !== "dependent");
  const payers = new Set(inc.active.filter((x) => x.type === "salary" && x.personId).map((x) => x.personId));
  const earners = payers.size || (inc.active.some((x) => x.type === "salary") ? 1 : 0);
  const variable = inc.active.some((x) => ["business", "bonus", "commission"].includes(x.type));
  const suggested = suggestedMonths({ earners, variable, dependants: people.some((p) => p.role === "dependent") });
  const months = liq.targetMonths;
  const essentialMonthly = liq.expenses?.essentialMonthly ?? 0;
  const target = essentialMonthly * months;
  const g = computeGoals(plan, { today }).goals.find((x) => EMERGENCY.test(x.name ?? "") || x.icon === "🛟") ?? null;
  const monthly = g ? Number(g.monthly) || 0 : 0;
  const cashRate = Number(plan.assumptions?.returnCash ?? 0.02);
  const gap = Math.max(0, target - liq.now);
  const monthsToGo = gap <= 0 ? 0 : monthly > 0 ? solveMonths(cashRate / 12, liq.now, monthly, target) : null;
  let readyDate = null;
  if (today && monthsToGo !== null && Number.isFinite(monthsToGo)) { const [y, m] = today.split("-").map(Number); const t = y * 12 + (m - 1) + monthsToGo; readyDate = `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`; }
  // checking accounts earn next to nothing: what sits there beyond a month of all spending could earn the savings rate
  const checkingBalance = (plan.accounts ?? []).filter((a) => a.type === "checking").reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const oneMonth = liq.expenses?.monthly ?? 0;
  const spare = Math.max(0, checkingBalance - oneMonth);
  const warnings = [];
  if (g && !g.isEmergencyFund && (g.fundedBy ?? []).length) warnings.push(`The "${g.name}" goal's money is kept apart from the cash below, so it does not count toward the cushion. If that goal is your emergency fund, tick it below.`);
  if (months < suggested.months) warnings.push(`Your target is ${months} months; for this household ${suggested.months} is the usual advice.`);
  return {
    essentialMonthly, now: liq.now, months, suggested, target, gap, runwayMonths: liq.runwayMonths, status: liq.status,
    goal: g ? { id: g.id, name: g.name, monthly, isEmergencyFund: !!g.isEmergencyFund } : null, monthly, monthsToGo, readyDate,
    checking: { balance: checkingBalance, oneMonth, spare }, cashRate, spareInterest: spare * cashRate, warnings, adults: adults.length,
  };
}

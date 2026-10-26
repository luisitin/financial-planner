// modules/balance/liquidity/compute.js -- PURE. How much money you could put your hands
// on today, within a week, or not without a big cost, and how many months of bills that
// covers: the emergency-fund check.
import { ACCOUNT_TYPES, countedBalance } from "../net-worth/compute.js";
import { compute as computeExpenses } from "../../cashflow/expenses/compute.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeGoals } from "../../goals/goals/compute.js";

// How fast each account type turns into spendable cash.
export const TIERS = {
  now:   { label: "Usable today",         desc: "cash, checking, savings", types: ["cash", "checking", "savings"] },
  week:  { label: "Sellable within a week", desc: "brokerage, crypto: sell, then wait for settlement", types: ["brokerage", "crypto"] },
  later: { label: "Locked up or costly to tap", desc: "retirement accounts, HSA, 529, property, vehicles, insurance cash value", types: null },
};
const tierOf = (type) => TIERS.now.types.includes(type) ? "now" : TIERS.week.types.includes(type) ? "week" : "later";

/**
 * compute(plan, { today }) -> {
 *   now, week, later (asset totals per tier), accounts: [{ ...account, tier, tierLabel, typeLabel }] (assets only, largest first),
 *   expenses: { monthly, essentialMonthly } | null,
 *   runwayMonths (now / essential monthly), fullRunwayMonths (now / total monthly), targetMonths, target (money),
 *   gap (target - now, 0 when covered), fundedShare (now / target, capped at 1), status: "ok"|"warn"|"bad"|"unknown",
 *   warnings: [text]
 * }
 */
export function compute(plan, params = {}) {
  const accounts = (plan.accounts ?? []).filter((a) => (ACCOUNT_TYPES[a.type] ?? ACCOUNT_TYPES.other_asset).side !== "liability")
    .map((a) => ({ ...a, balance: countedBalance(a), tier: tierOf(a.type), tierLabel: TIERS[tierOf(a.type)].label, typeLabel: (ACCOUNT_TYPES[a.type] ?? ACCOUNT_TYPES.other_asset).label }))
    .sort((x, y) => y.balance - x.balance);
  const sumTier = (t) => accounts.filter((a) => a.tier === t).reduce((s, a) => s + a.balance, 0);
  const nowAll = sumTier("now"), week = sumTier("week"), later = sumTier("later");
  // F-020: money in a "usable today" account that a goal has claimed is set aside, not usable
  const goals = (plan.goals ?? []).length ? computeGoals(plan, params) : null;
  const nowIds = new Set(accounts.filter((a) => a.tier === "now").map((a) => a.id));
  let earmarked = 0;
  for (const g of goals?.goals ?? []) if ((g.fundedBy ?? []).some((id) => nowIds.has(id)) && g.status !== "no amount") earmarked += Math.max(0, Math.min(g.funded - (Number(g.saved) || 0), g.targetThen));
  earmarked = Math.min(earmarked, nowAll);
  const now = nowAll - earmarked;
  const ex = (plan.expenses ?? []).length ? computeExpenses(plan, params) : null;
  const expenses = ex ? { monthly: ex.monthly, essentialMonthly: ex.essentialMonthly } : null;
  // F-017: one-time costs and one-time income that are on the books but not in the monthly figures
  const inc = (plan.income ?? []).length ? computeIncome(plan, params) : null;
  const oneOffs = (ex?.oneTime ?? 0) - (inc?.oneTime ?? 0);
  const nowAfterOneOffs = now - oneOffs;
  const targetMonths = Number(plan.assumptions?.emergencyMonths ?? 6);
  const essential = expenses?.essentialMonthly ?? 0;
  const target = essential * targetMonths;
  const runwayMonths = essential > 0 ? now / essential : null;
  const runwayAfterOneOffs = essential > 0 && oneOffs ? nowAfterOneOffs / essential : null;
  const fullRunwayMonths = expenses && expenses.monthly > 0 ? now / expenses.monthly : null;
  const gap = target > 0 ? Math.max(0, target - now) : 0;
  const fundedShare = target > 0 ? Math.min(1, now / target) : null;
  const status = fundedShare === null ? "unknown" : fundedShare >= 1 ? "ok" : fundedShare >= 0.5 ? "warn" : "bad";
  const warnings = [];
  if (accounts.length && !expenses) warnings.push("Add your expenses to see how many months your cash covers.");
  if (expenses && essential === 0) warnings.push("None of your expenses is marked as must-pay, so the emergency-fund target is zero. Mark the bills you cannot skip.");
  return { now, nowAll, earmarked, week, later, accounts, expenses, oneOffs, nowAfterOneOffs, runwayMonths, runwayAfterOneOffs, fullRunwayMonths, targetMonths, target, gap, fundedShare, status, warnings };
}

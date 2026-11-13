// modules/balance/liquidity/compute.js -- PURE. How much money you could put your hands
// on today, within a week, or not without a big cost, and how many months of bills that
// covers: the emergency-fund check.
import { ACCOUNT_TYPES, countedBalance } from "../net-worth/compute.js";
import { compute as computeExpenses } from "../../cashflow/expenses/compute.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeGoals } from "../../goals/goals/compute.js";
import { taxOwedNow } from "../../taxes/estimated/compute.js";

// How fast each account type turns into spendable cash. (Plain-words pass C10, SPEC 13.1: "Sellable within a week" and
// "Locked up or costly to tap" with their lists of kinds were the words; the tiers, their kinds and sums are as before.)
export const TIERS = {
  now:   { label: "Usable today",         desc: "cash, checking, savings", types: ["cash", "checking", "savings"] },
  week:  { label: "Investments you could sell", desc: "the money is yours within a week of selling", types: ["brokerage", "crypto"] },
  later: { label: "Money you can't easily touch", desc: "retirement, college and health accounts, your home and car, and the like", types: null },
};
const tierOf = (type) => TIERS.now.types.includes(type) ? "now" : TIERS.week.types.includes(type) ? "week" : "later";

/**
 * compute(plan, { today }) -> {
 *   now (usable today: cash less what goals claim and less taxOwed), nowAll (all cash), earmarked (what goals claim),
 *   taxOwed (this year's federal tax on what is earned so far and not paid: taxes/estimated taxOwedNow, 0 unless the household
 *   pays its tax itself), tax (that answer, or null), week, later (asset totals per tier), accounts: [{ ...account, tier, tierLabel, typeLabel }] (assets only, largest first),
 *   expenses: { monthly, essentialMonthly } | null,
 *   runwayMonths (now / essential monthly), fullRunwayMonths (now / total monthly), targetMonths, target (money),
 *   gap (target - now, 0 when covered), fundedShare (now / target, capped at 1), status: "ok"|"warn"|"bad"|"unknown",
 *   waits?, guessedShare? (only when the plan holds guesses: the share of the must-pay bills that is ours; waits when half or more),
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
  // F-034: a goal the owner marked as the emergency fund itself (goals/emergency-fund) is the cushion, not money set aside from it
  for (const g of goals?.goals ?? []) if (!g.isEmergencyFund && (g.fundedBy ?? []).some((id) => nowIds.has(id)) && g.status !== "no amount") earmarked += Math.max(0, Math.min(g.funded - (Number(g.saved) || 0), g.targetThen));
  earmarked = Math.min(earmarked, nowAll);
  // this year's federal tax on what has already been earned, not yet paid (Estimated payments' taxOwedNow: a freelancer's
  // tax, not taken from pay): the IRS's money, so it is not cushion either (round 4, 2026-11-02)
  let tax = null;
  try { tax = taxOwedNow(plan, params); } catch { tax = null; }
  const taxOwed = tax ? Math.min(tax.owedNow, Math.max(0, nowAll - earmarked)) : 0;
  const now = nowAll - earmarked - taxOwed;
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
  // the must-pay bills are mostly our guesses (Expenses' guessedEssentialShare, only when the plan holds guesses): the months
  // the cash covers wait for the real bills (spec 8.1), said calmly, never "thin" on guesses alone
  const waits = ex && ex.guessedEssentialShare !== undefined ? { waits: ex.guessedEssentialShare >= 0.5, guessedShare: ex.guessedEssentialShare } : {};
  return { now, nowAll, earmarked, taxOwed, tax, week, later, accounts, expenses, oneOffs, nowAfterOneOffs, runwayMonths, runwayAfterOneOffs, fullRunwayMonths, targetMonths, target, gap, fundedShare, status, warnings, ...waits };
}

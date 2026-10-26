// modules/goals/goals/compute.js -- PURE. Each goal is an amount by a date. For every goal:
// how much is set aside, what it will cost by then, what to put in each month to get there,
// and whether the current monthly amount is enough.
import { pmtToReach, fv, inflate } from "../../../core/math/finance.js";
import { monthsBetween } from "../../../core/math/dates.js";
import { countedBalance } from "../../balance/net-worth/compute.js";

export const PRIORITIES = { 1: "Must have", 2: "Want", 3: "Nice to have" };
export const GOAL_ICONS = ["🎯", "🛟", "🏠", "🚗", "✈️", "🎓", "💍", "👶", "💻", "🛋️", "🐶", "🎁", "🏖️", "💼"];

/**
 * compute(plan, { today }) -> {
 *   goals: [{ ...goal, priorityLabel, monthsLeft, yearsLeft, rate, targetThen, funded, remaining, neededMonthly,
 *             projected, shortfall, progress, status: "done"|"on track"|"behind"|"no date"|"past due"|"no amount",
 *             fundedFrom: [account names], sizeLabel }],
 *   count, done, totalTarget, totalFunded, neededMonthly (sum for open dated goals), contributing (sum of monthly),
 *   warnings: [text]
 * }
 * Money set aside = goal.saved + balances of the accounts in goal.fundedBy. Growth rate =
 * goal.rate if set, else the plan's cash return for goals under 3 years away and the bond
 * return beyond that (documented in README). Inflating goals grow the target at the
 * plan's inflation until the target date. Without `today` dates are ignored.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const a = plan.assumptions ?? {};
  const accounts = plan.accounts ?? [];
  const warnings = [];
  // F-013: an account linked to several goals is shared out, never counted twice: by priority, then by date,
  // each goal takes what it still needs and passes the rest on.
  const pool = new Map((plan.accounts ?? []).map((a) => [a.id, countedBalance(a)]));
  const order = [...(plan.goals ?? [])].map((g, i) => ({ g, i })).sort((a, b) => (Number(a.g.priority) || 2) - (Number(b.g.priority) || 2) || String(a.g.targetDate || "9999").localeCompare(String(b.g.targetDate || "9999")) || a.i - b.i);
  const fromAccounts = new Map();   // goal id -> money taken from linked accounts
  const sharedWith = new Map();     // goal id -> names of other goals on the same accounts
  for (const { g } of order) {
    const target = Math.max(0, Number(g.target) || 0);
    const need = Math.max(0, target - (Number(g.saved) || 0));
    let taken = 0;
    for (const id of Array.isArray(g.fundedBy) ? g.fundedBy : []) {
      const avail = pool.get(id); if (avail === undefined) continue;
      const take = Math.max(0, Math.min(avail, need - taken));
      pool.set(id, avail - take); taken += take;
      const others = (plan.goals ?? []).filter((o) => o.id !== g.id && Array.isArray(o.fundedBy) && o.fundedBy.includes(id)).map((o) => o.name);
      if (others.length) sharedWith.set(g.id, [...new Set([...(sharedWith.get(g.id) ?? []), ...others])]);
    }
    fromAccounts.set(g.id, taken);
  }
  const goals = (plan.goals ?? []).map((g) => {
    const target = Math.max(0, Number(g.target) || 0);   // F-014: a negative amount is "no amount"
    const monthsLeft = today && g.targetDate ? monthsBetween(today, g.targetDate) : null;
    const yearsLeft = monthsLeft === null ? null : Math.max(0, monthsLeft) / 12;
    const rate = g.rate !== undefined && g.rate !== null && g.rate !== "" ? Number(g.rate) : (yearsLeft !== null && yearsLeft >= 3 ? Number(a.returnBonds ?? 0.04) : Number(a.returnCash ?? 0.02));
    const targetThen = g.inflates && yearsLeft ? inflate(target, Number(a.inflation ?? 0.03), yearsLeft) : target;
    const fundedBy = Array.isArray(g.fundedBy) ? g.fundedBy : [];
    const accts = fundedBy.map((id) => accounts.find((x) => x.id === id)).filter(Boolean);
    if (fundedBy.length && accts.length < fundedBy.length) warnings.push(`${g.name || "A goal"} points to an account that no longer exists.`);
    const funded = (Number(g.saved) || 0) + (fromAccounts.get(g.id) ?? 0);
    const remaining = Math.max(0, targetThen - funded);
    const monthly = Number(g.monthly) || 0;
    const n = monthsLeft === null ? null : Math.max(0, monthsLeft);
    const neededMonthly = n === null ? null : (remaining <= 0 ? 0 : (n === 0 ? remaining : Math.max(0, pmtToReach(rate / 12, n, targetThen, funded))));
    const projected = n === null ? null : fv(rate / 12, n, monthly, funded);
    const shortfall = projected === null ? null : Math.max(0, targetThen - projected);
    let status;
    if (!target) status = "no amount";
    else if (funded >= targetThen) status = "done";
    else if (monthsLeft === null) status = "no date";
    else if (monthsLeft < 0) status = "past due";
    else if (monthly > 0 && projected >= targetThen - 0.5) status = "on track";
    else status = "behind";
    if (Number(g.target) < 0) warnings.push(`${g.name || "A goal"} has a negative amount. It is left out of the totals until it is fixed.`);
    if (today && g.targetDate && String(g.targetDate) < today && status !== "done") warnings.push(`${g.name || "A goal"}'s date has passed. Set a new date or mark it done by raising what is set aside.`);
    return {
      ...g, target, priorityLabel: PRIORITIES[g.priority] ?? PRIORITIES[2], monthsLeft, yearsLeft, rate, targetThen, funded, remaining,
      neededMonthly, projected, shortfall, progress: targetThen > 0 ? Math.min(1, funded / targetThen) : 0, status, monthly,
      fundedFrom: accts.map((x) => x.name), sharedWith: sharedWith.get(g.id) ?? [],
    };
  });
  const counted = goals.filter((g) => g.status !== "no amount");
  const open = counted.filter((g) => g.status !== "done");
  const sum = (arr, k) => arr.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  return {
    goals, count: goals.length, done: counted.filter((g) => g.status === "done").length,
    totalTarget: sum(counted, "targetThen"), totalFunded: counted.reduce((s, g) => s + Math.max(0, Math.min(g.funded, g.targetThen)), 0),
    neededMonthly: sum(open.filter((g) => g.neededMonthly !== null), "neededMonthly"),
    contributing: sum(open, "monthly"),
    warnings,
  };
}

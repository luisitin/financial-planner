// modules/goals/goals/compute.js -- PURE. Each goal is an amount by a date. For every goal:
// how much is set aside, what it will cost by then, what to put in each month to get there,
// and whether the current monthly amount is enough.
import { pmtToReach, fv, inflate } from "../../../core/math/finance.js";
import { monthsBetween } from "../../../core/math/dates.js";
import { countedBalance } from "../../balance/net-worth/compute.js";
import { isHouseGoal } from "../house/compute.js";

export const PRIORITIES = { 1: "Must have", 2: "Want", 3: "Nice to have" };
export const GOAL_ICONS = ["🎯", "🛟", "🏠", "🚗", "✈️", "🎓", "💍", "👶", "💻", "🛋️", "🐶", "🎁", "🏖️", "💼"];

/**
 * compute(plan, { today }) -> {
 *   goals: [{ ...goal, priorityLabel, monthsLeft, yearsLeft, rate, targetThen, funded, remaining, neededMonthly,
 *             projected, shortfall, progress, status: "done"|"on track"|"behind"|"no date"|"past due"|"no amount",
 *             dueNow (a goal whose date has passed: what it still needs, due now; its neededMonthly is null),
 *             fundedFrom: [account names], sizeLabel }],
 *   count, done, totalTarget, totalFunded, neededMonthly (sum for open dated goals still ahead), dueNow? (sum for goals
 *   whose date has passed; only when there is one), contributing (sum of monthly),
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
    // a date that has passed: what is left is due now, not a month's saving (round 8 item 18: one college goal dated 2023
    // added its whole $103,000 to "Needed each month")
    const dueNow = status === "past due" ? remaining : undefined;
    if (today && g.targetDate && String(g.targetDate) < today && status !== "done") warnings.push(`The date for ${g.name || "a goal"} has passed. Set a new date, or lower its amount to what is still needed.`);
    return {
      ...g, target, priorityLabel: PRIORITIES[g.priority] ?? PRIORITIES[2], monthsLeft, yearsLeft, rate, targetThen, funded, remaining,
      neededMonthly: status === "past due" ? null : neededMonthly, ...(dueNow !== undefined ? { dueNow } : {}), projected, shortfall, progress: targetThen > 0 ? Math.min(1, funded / targetThen) : 0, status, monthly,
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
    // (only when there is one, so a plan without a passed date reads exactly as before)
    ...(open.some((g) => g.status === "past due") ? { dueNow: sum(open.filter((g) => g.status === "past due"), "dueNow") } : {}),
    contributing: sum(open, "monthly"),
    warnings,
  };
}

// Each kind of goal has a page that works out what it costs; a goal leads to it, and says when that page's figure differs.
// Travel is tested before House ("Trip home" is a trip); House uses the House page's own test, which turns away a roof,
// repairs or an office; a car loan, its insurance or repairs are not a car to buy.
const NOT_A_CAR = /\bloans?\b|pay ?-?off|payoff|insur|repair|registration|mainten|\btires?\b|\bgas\b/i;
const PLANNERS = [
  { page: "goals/education", label: "Education", test: (g) => g.icon === "🎓" || /college|education|school|tuition|529/i.test(g.name ?? "") },
  { page: "goals/vehicle", label: "Vehicle", test: (g) => !NOT_A_CAR.test(g.name ?? "") && (g.icon === "🚗" || /\b(car|vehicle|truck|suv)\b/i.test(g.name ?? "")) },
  { page: "goals/emergency-fund", label: "Emergency fund", test: (g) => g.icon === "🛟" || g.isEmergencyFund || /emergency|rainy day|cushion/i.test(g.name ?? "") },
  { page: "goals/travel", label: "Travel", test: (g) => g.icon === "✈️" || /trip|travel|vacation|holiday/i.test(g.name ?? "") },
  { page: "goals/house", label: "House down payment", test: (g) => isHouseGoal(g) },
];
export const plannerFor = (g) => PLANNERS.find((x) => x.test(g)) ?? null;

/**
 * plannerFigure(goal, goalRow, page, result, plan?) -> { amount, shown?, words, monthly } | { amount: null, note } | null:
 * what the goal's own page (its compute `result`) works out for this goal, in the goal's own dollars (today's when it
 * grows with inflation, else the dollars of its date). null when the page works out nothing for this goal, or its figure
 * would not settle: review fixes 2026-11-02 (README "Each goal leads to its page").
 * - Education: the child's cost for the share chosen there (`totalToday x share`, rounded to $1,000 as Education's own
 *   Update button rounds it), or the dollars of those years (`total x share`) for a goal that does not grow. Only for a
 *   goal naming the child, or the 🎓 goal naming no adult (a grown-up's degree is not the child's college).
 * - Vehicle: only once the Vehicle page has a price of its own; with none it takes the goal's amount and would add sales
 *   tax to it on every tap. Price + sales tax - trade-in is in the dollars of the day it is bought, so amount = target x
 *   net / targetThen for a growing goal, the net itself for one that does not grow; `shown` is the net.
 * - Emergency fund: only for the goal ticked as the emergency fund (otherwise its money never counts there, and a `note`
 *   says to tick it); the cushion's target less the other cash that counts (`target - (now - funded)`).
 * - House: the cash to close (down payment, closing costs, reserves).
 */
export function plannerFigure(g, gr, page, r, plan = null) {
  if (!g || !r) return null;
  const grows = g.inflates !== false;
  if (page === "goals/education") {
    const c = (r.children ?? []).find((x) => (x.goal?.id ?? x.goal) === g.id);
    // a child already in college (review UX 4): the next bill, as Education's own Update button writes it (to the $10, in the
    // dollars of its date), not four years "in the dollars of those years" ($103,000 beside a $25,850 goal)
    if (c?.started && c.left?.length) {
      const first = c.left[0], day = (iso) => { const [y, m, dd] = String(iso).split("-").map(Number); return `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m - 1]} ${dd}, ${y}`; };
      return { amount: Math.round((Number(c.nextYearCost) || 0) / 10) * 10, words: `for its next bill (${first.part === "spring" ? `the spring half of ${first.label}` : first.label}, ${day(c.nextBill)})`, monthly: null };
    }
    if (!c || !(c.totalToday > 0)) return null;
    const name = String(g.name ?? "").toLowerCase();
    const adults = (plan?.household?.people ?? []).filter((p) => p.role !== "dependent" && p.name).map((p) => p.name.toLowerCase());
    const namesChild = name.includes(String(c.name ?? "").toLowerCase());
    if (!namesChild && (g.icon !== "🎓" || adults.some((a) => name.includes(a)))) return null;
    const share = Math.min(1, Math.max(0, Number(c.share ?? 1)));
    const part = share < 1 ? ` for ${Math.round(share * 100)}% of it` : "";
    return grows
      ? { amount: Math.round((c.totalToday * share) / 1000) * 1000, words: `in today's money${part}`, monthly: c.neededMonthly ?? null }
      : { amount: Math.round(((c.total ?? 0) * share) / 1000) * 1000, words: `in the dollars of those years${part}`, monthly: c.neededMonthly ?? null };
  }
  if (page === "goals/vehicle") {
    if (r.goal?.id !== g.id || !(r.net > 0) || r.priceFromGoal) return null;
    if (!grows) return { amount: r.net, shown: r.net, words: "with sales tax", monthly: r.cash?.neededMonthly ?? null };
    return gr?.targetThen > 0 ? { amount: (Number(g.target) || 0) * r.net / gr.targetThen, shown: r.net, words: "with sales tax", monthly: r.cash?.neededMonthly ?? null } : null;
  }
  if (page === "goals/emergency-fund") {
    if (r.goal?.id !== g.id || !(r.target > 0)) return null;
    if (!r.goal.isEmergencyFund) return { amount: null, note: "Its money counts toward the cushion only once it is ticked as your emergency fund on that page." };
    const other = Math.max(0, (Number(r.now) || 0) - (Number(gr?.funded) || 0));
    const amount = Math.max(0, r.target - other);
    return amount > 0 ? { amount, words: `for ${r.months} months of the bills you have to pay${other > 0 ? `, less the $${Math.round(other).toLocaleString("en-US")} of other cash that counts` : ""}`, monthly: null } : null;
  }
  if (page === "goals/house") return r.goal?.id === g.id && r.cash?.total > 0 ? { amount: r.cash.total, words: "down payment, closing and reserves", monthly: r.neededMonthly ?? null } : null;
  return null;
}

/** The page's figure is worth mentioning when it is 5% or more away from the goal's amount. */
export const plannerDiffers = (g, f) => !!f && f.amount !== null && f.amount !== undefined && Math.abs(f.amount - (Number(g.target) || 0)) >= 0.05 * Math.max(1, Number(g.target) || 0);

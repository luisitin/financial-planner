// core/math/leftover.js -- the month's left-over money and what it adds up to in a year. PURE, no imports but periods.
//
// "Left over" is the app's one after-tax figure (overview/next-best-action `spare.monthly`): take-home pay after tax and
// the retirement saving out of pay, less spending (loan payments included), less the money the plan already sets aside
// for goals and the extra on debts. Spending and the left-over are the same fact said two ways, so each is worked out from
// the other: spending = pay available - left over (the exact inverse; nothing here rounds the figure that is shown).
import { perYear } from "./periods.js";

/** Get started's spending rows ("setup-x-<row>", and the "rough" one) a month: what the spending question writes. */
export function setupRowsMonthly(plan) {
  return (Array.isArray(plan?.expenses) ? plan.expenses : [])
    .filter((x) => typeof x?.id === "string" && x.id.startsWith("setup-x-"))
    .reduce((t, x) => t + perYear(Number(x.amount) || 0, x.period) / 12, 0);
}

/**
 * The note kept when spending was worked out from a left-over figure (guide.setup.spendLeft: { left, on, rows }), or null.
 * `left` is what the person said a month, `on` the day, `rows` what the spending rows added up to when we wrote them. It is
 * only good while those rows still add up to `rows`: a bill changed or removed since, and the rows are the person's again.
 */
export function leftMarker(plan) {
  const m = plan?.guide?.setup?.spendLeft;
  if (!m || !Number.isFinite(Number(m.left)) || !(Number(m.rows) >= 0)) return null;
  return Math.abs(setupRowsMonthly(plan) - Number(m.rows)) < 1 ? { left: Number(m.left), on: m.on ?? "", rows: Number(m.rows) } : null;
}

/**
 * The left-over as the person means it: how much the checking account goes up in a normal month, BEFORE any of it is moved to
 * savings for goals. That is the app's left-over figure (Next best action `spare.monthly`, after goal saving) with the goal saving
 * put back, and, when uneven pay is held back (`held`), at the month the Income page's amount brings (`spare.full`), because
 * "a normal month" is that one. The extra paid on debts stays outside (it is money already spoken for). All a month.
 * This is the figure typed left-over is worked against, so L x 12 is what builds up in a year, whatever the order of entry.
 */
export function leftOverOf(spare) {
  const s = spare ?? {};
  const base = Number.isFinite(Number(s.full)) ? Number(s.full) : Number(s.monthly) || 0;
  return base + (Number(s.goalSaving) || 0);
}

/**
 * What the month builds up over a year, from Next best action's `spare` (all a month there): the left-over and the goal saving
 * together are what lands in checking and savings (`cash`, below zero when savings are used; `cashFull` at the month all uneven pay
 * comes in); the retirement saving out of pay goes into retirement accounts (counted once, here, never inside `cash`); the debt
 * extra pays debt down. `total` is the sum, the same share Your health counts as saved. All a year.
 */
export function yearSaving(spare) {
  const s = spare ?? {};
  const m = Number(s.monthly) || 0, goals = Number(s.goalSaving) || 0, ret = Number(s.retirementSaving) || 0, debt = Number(s.debtExtra) || 0, held = Math.max(0, Number(s.held) || 0);
  return { cash: (m + goals) * 12, cashFull: (m + held + goals) * 12, left: m * 12, goals: goals * 12, retirement: ret * 12, debt: debt * 12, total: (m + goals + ret + debt) * 12 };
}

/**
 * A leftover said in plain words, never as a minus sign (follow-up 2026-11-07: "-$250 left over" read as a bill). `money(n)`
 * formats a whole-dollar amount. Above zero: "$1,000 left over a month"; below: "checking going down $250 a month"; zero: "nothing left over".
 *   leftWords(1000, money) -> "$1,000 left over a month"     leftWords(-250, money) -> "checking going down $250 a month"
 * `from` is the same figure after "from" ("from the $1,000 you said is left over each month" / "from your checking going down $250 a month").
 */
export function leftWords(n, money) {
  const v = Math.round(Number(n) || 0);
  return v > 0 ? `${money(v)} left over a month` : v < 0 ? `checking going down ${money(-v)} a month` : "nothing left over a month";
}
/**
 * The month's figure as a stat: never "-$550 Left over each month" (left2 fix round 1, L-3): below zero it is "Short each
 * month $550". `value` is the amount to show, always zero or more.
 */
export function spareLabel(spare) {
  const v = Number(spare) || 0;
  return v < 0 ? { label: "Short each month", value: -v } : { label: "Left over each month", value: v };
}
/**
 * The typed leftover below zero and goals on top of it: how the two make the month's shortfall (L-3: "checking going down
 * $250" beside "$550 short" with nothing linking them). Empty when the leftover is zero or more, or there are no goals.
 *   leftGoalsWords(-250, 300, money) -> " Your goals take another $300 a month, so you are $550 short each month."
 */
export function leftGoalsWords(left, goals, money) {
  const l = Math.round(Number(left) || 0), g = Math.round(Number(goals) || 0);
  return l < 0 && g >= 1 ? ` Your goals take another ${money(g)} a month, so you are ${money(g - l)} short each month.` : "";
}
export function leftFromWords(n, money) {
  const v = Math.round(Number(n) || 0);
  return v > 0 ? `the ${money(v)} you said is left over each month` : v < 0 ? `your checking going down ${money(-v)} a month` : "your checking staying level each month";
}

/**
 * The year's saving in plain words: "About $12,000 a year builds up in checking and savings, and $6,000 more goes into
 * retirement." `money(n)` formats a whole-dollar amount. Rounded to $100 (to $10 under $1,000): it is a month's figure x 12.
 * With goals the money also goes there ("checking, savings and your goals": a goal may sit in a college or investment account);
 * with uneven pay held back it is said at the month all of it comes in.
 */
export function yearSavingWords(spare, money) {
  const y = yearSaving(spare), s = spare ?? {};
  const held = (Number(s.held) || 0) > 0.5, goals = (Number(s.goalSaving) || 0) >= 1;
  const cash = held ? y.cashFull : y.cash;
  const r = (n) => money(Math.abs(n) >= 1000 ? Math.round(Math.abs(n) / 100) * 100 : Math.round(Math.abs(n) / 10) * 10);
  const ret = y.retirement >= 50 ? `${r(y.retirement)}` : null;
  const where = goals ? "checking, savings and your goals" : "checking and savings", when = held ? " when all your uneven pay comes in" : "";
  if (cash >= 50) return `About ${r(cash)} a year builds up in ${where}${when}${ret ? `, and ${ret} more goes into retirement` : ""}.`;
  // with goals the yearly figure is checking, savings and the goals together (left2 fix round 1, L-2: "checking and savings
  // shrink by $3,000" sat beside "$550 a month comes from savings")
  if (cash <= -50) return `About ${r(cash)} a year more goes out than comes in${when}, so ${goals ? "checking, savings and your goals together shrink" : "checking and savings shrink"} by that${ret ? `, while ${ret} goes into retirement` : ""}.`;
  return `Checking and savings stay about level over a year${when}${ret ? `, and ${ret} goes into retirement` : ""}.`;
}

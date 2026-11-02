// modules/overview/alerts/compute.js -- PURE. One list of what needs attention, built from
// the other pages' computes: missing setup, stale numbers, a thin emergency fund, spending
// above income, expensive or never-ending debt, goals that slipped. Each alert links to the
// page where it is fixed.
import { compute as netWorth } from "../../balance/net-worth/compute.js";
import { compute as people } from "../../household/people/compute.js";
import { compute as income } from "../../cashflow/income/compute.js";
import { compute as expenses } from "../../cashflow/expenses/compute.js";
import { compute as goals } from "../../goals/goals/compute.js";
import { compute as liquidity } from "../../balance/liquidity/compute.js";
import { compute as liabilities } from "../../balance/liabilities/compute.js";
import { compute as assumptions } from "../../system/assumptions/compute.js";
import { compute as nextBest } from "../next-best-action/compute.js";
import { bankVsPlan } from "../../cashflow/income-statement/compute.js";
import { taxAnswer } from "../../taxes/withholding/compute.js";
import { compute as estimatedOf } from "../../taxes/estimated/compute.js";
import { protectionGaps } from "../../insurance/life-needs/compute.js";
import { compute as estateDocs } from "../../estate/documents/compute.js";
import { daysBetween } from "../../../core/math/dates.js";
import { money as fmtMoney, date as fmtDate } from "../../../core/format.js";

export const LEVELS = { bad: { label: "fix", order: 0 }, warn: { label: "check", order: 1 }, info: { label: "to do", order: 2 } };
export const STALE_BALANCE_DAYS = 90;
export const STALE_HISTORY_DAYS = 35;

/**
 * compute(plan, { today }) -> { alerts: [{ id, level, title, detail, go: [group, id], chore? }], counts: { bad, warn, info }, total, chores, allClear }
 * `detail` is a finished sentence (money and dates already formatted). Without `today` the date checks are skipped.
 * Chores (look over the assumptions, save today's totals) are listed last with `chore: true` and left out of `counts`,
 * `total` and `allClear`, so the count on the Dashboard is what needs a look, not housekeeping. Two or more goals that
 * are behind are one alert ("3 goals are behind") with the extra they need in all.
 */
/**
 * goalsBehind(goalsResult, { nba, today }) -> { behind: [goals behind, nothing-going-in first], need (a month, more than now, in all), idle: [...],
 *   pastDue: [...], queued: [goals with nothing going in whose turn comes later], turn (the day Next best action's goals step starts, or null) }
 * Only goals behind their pace count toward the monthly need; a goal past its date is counted apart (its whole remaining
 * amount is not a monthly figure). Needs attention and the Dashboard's Goals tile both use it, so they say the same.
 */
export function goalsBehind(gl, { nba = null, today = null } = {}) {
  const goals = gl?.goals ?? [];
  // a goal with nothing going in yet, whose turn Next best action gives later (its goals step starts getting money in a
  // later month, after the cards and the cushion), is waiting its turn, not behind: a goal set a minute ago is not late
  const step = nba?.ready ? (nba.steps ?? []).find((x) => x.id === "goals") : null;
  const turn = step?.startDate && today && step.startDate.slice(0, 7) > today.slice(0, 7) ? step.startDate : null;
  const all = goals.filter((g) => g.status === "behind");
  const queued = turn ? all.filter((g) => !(g.monthly > 0)) : [];
  const behind = all.filter((g) => !queued.includes(g)).sort((a, b) => (a.monthly > 0) - (b.monthly > 0));
  const need = behind.reduce((t, g) => t + Math.max(0, (Number(g.neededMonthly) || 0) - (Number(g.monthly) || 0)), 0);
  return { behind, need, idle: behind.filter((g) => !(g.monthly > 0)), pastDue: goals.filter((g) => g.status === "past due"), queued, turn };
}

export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const p = { today };
  const alerts = [];
  const add = (id, level, title, detail, go, extra = {}) => alerts.push({ id, level, title, detail, go, ...extra });
  const chore = { chore: true };
  const cur = plan.meta?.currency ?? "USD";
  const money = (n) => fmtMoney(n, cur);

  const nw = netWorth(plan), ppl = people(plan, p), inc = income(plan, p), exp = expenses(plan, p), gl = goals(plan, p), liq = liquidity(plan, p), debt = liabilities(plan, p), asm = assumptions(plan, p);

  // setup
  if (ppl.count === 0) add("no-people", "info", "Add the people in your household", "Ages drive retirement, insurance and how long the money must last.", ["household", "people"]);
  if (nw.count === 0) add("no-accounts", "info", "Add your accounts", "Net worth, the emergency fund and every projection start from your balances.", ["balance", "net-worth"]);
  if (inc.count === 0) add("no-income", "info", "Enter what comes in", "Income is needed to check spending, debt load and savings rate.", ["cashflow", "income"]);
  if (exp.count === 0) add("no-expenses", "info", "Enter what goes out", "Expenses set the emergency-fund target and what retirement has to cover.", ["cashflow", "expenses"]);
  if (!asm.reviewedAt) add("assumptions-unreviewed", "info", "Look over the assumptions", "Ten numbers drive every projection. Confirm them once.", ["system", "assumptions"], chore);
  else if (asm.stale) add("assumptions-stale", "warn", "Assumptions were reviewed over a year ago", "Rates and inflation move. Look again and confirm.", ["system", "assumptions"]);

  // stale numbers
  if (today && nw.count) {
    const stale = (plan.accounts ?? []).filter((a) => !a.asOf || daysBetween(a.asOf, today) > STALE_BALANCE_DAYS);
    if (stale.length) add("stale-balances", "warn", `${stale.length === 1 ? "One balance is" : `${stale.length} balances are`} more than ${STALE_BALANCE_DAYS} days old`, `${stale.slice(0, 3).map((a) => a.name).join(", ")}${stale.length > 3 ? "..." : ""}. Update them so the totals mean something.`, ["balance", "update"]);
    const last = nw.history[nw.history.length - 1];
    if (!last || daysBetween(last.date, today) > STALE_HISTORY_DAYS) add("history", "info", "Save today's totals", last ? `The last saved point is from ${fmtDate(last.date)}. Saving once a month builds the net-worth history.` : "Saving once a month builds the net-worth history.", ["balance", "net-worth"], chore);
  }

  // money
  // what is left after tax, spending and saving (the Dashboard's figure); pay before tax minus spending only when the
  // tax cannot be worked out yet
  const nba = exp.leftOver !== null ? nextBest(plan, p) : null;
  const short = nba?.ready ? -nba.spare.monthly : exp.leftOver !== null ? -exp.leftOver : 0;
  // a retired household drawing from savings as the plan intends is not overspending (Next best action's `drawing`)
  if (short > 0 && !nba?.drawing) add("overspend", "bad", "You spend more than comes in", `About ${money(short)} more goes out each month than comes in${nba?.ready ? ", after tax and saving" : ""}. Check the amounts, then find what to cut.`, ["cashflow", "expenses"]);
  // a likely bill in April: the year's federal tax against what the paychecks take out by December (typed, else estimated
  // from pay) and what is already paid, the same answer as Withholding check; flagged from $1,000 left to pay
  let tax = null;
  try { tax = inc.count ? taxAnswer(plan, { today }) : null; } catch { tax = null; }
  if (tax && tax.from !== "none" && tax.balance >= 1000) add("tax-bill", "warn", `About ${money(tax.balance)} of tax to pay in April`, `About ${money(tax.totalTax)} of federal tax for ${tax.year}${tax.seTax >= 1 ? ` (${money(tax.seTax)} of it self-employment tax)` : ""}; the paychecks take out about ${money(tax.projected)}${tax.from === "paycheck" ? " (estimated from your pay)" : tax.from === "mixed" ? " (partly estimated from pay)" : ""}${tax.paid > 0 ? ` and ${money(tax.paid)} is already paid` : ""}. A W-4 change now spreads it over the paychecks left instead of one bill in April.`, ["taxes", "withholding"]);
  // no paycheck takes tax out (a retiree, the self-employed): the bill is paid by quarterly estimates, so a payment past
  // due is the thing to fix (Estimated payments' own figure)
  if (tax && tax.from === "none" && !(inc.active ?? []).some((x) => x.type === "salary" || x.type === "bonus")) {
    let e = null;
    try { e = estimatedOf(plan, { today }); } catch { e = null; }
    if (e?.needsEstimates && e.behind > 0) add("estimates-behind", "warn", `About ${money(e.behind)} of estimated tax is past due`, `Nothing in the plan takes tax out of what comes in, so ${e.year}'s federal tax (about ${money(e.totalTax)}) is paid in four estimated payments; ${money(e.paid)} is paid so far. Paying the past-due part now keeps the underpayment penalty small. If a pension or IRA withdrawal has tax taken out, type it on the Federal estimate page.`, ["taxes", "estimated"]);
  }
  // the people who count on an earner (Life insurance needs' answer, the same as Next best action's protection step), and a
  // guardian for the children: the two gaps that would hurt a family most, worked out on pages few people open
  let prot = [];
  try { prot = nba?.ready ? (nba.steps.find((x) => x.id === "protect")?.people ?? []) : protectionGaps(plan, { today }); } catch { prot = []; }
  const list = (a) => (a.length > 1 ? `${a.slice(0, -1).join(", ")} and ${a.at(-1)}` : a[0] ?? "the family");
  // the title and sentence are Life insurance needs' own (protectionGaps), the same words as the Dashboard's move
  for (const g of prot) add(`life-cover-${g.personId}`, "warn", g.title, `${g.sentence} Cover you already have, through work too, goes on Policies.`, ["insurance", "life-needs"]);
  let docs = null;
  try { docs = estateDocs(plan, { today }); } catch { docs = null; }
  if (docs?.minors?.length && docs.items?.find((x) => x.kind === "guardian")?.status !== "done") {
    const both = (plan.household?.people ?? []).filter((x) => x.role !== "dependent").length > 1;
    add("guardian", "info", `No one is named to raise ${list(docs.minors)} if ${both ? "you both" : "you"} died`, `A will names a guardian; without one a court chooses. Estate documents keeps track of the will and the guardian.`, ["estate", "documents"]);
  }
  if (liq.status === "bad") add("emergency-bad", "bad", "Emergency fund is thin", `Usable cash covers ${liq.runwayMonths === null ? "0" : (Math.round(liq.runwayMonths * 10) / 10)} months of must-pay bills; the plan aims for ${liq.targetMonths}. ${money(liq.gap)} to go.`, ["balance", "liquidity"]);
  else if (liq.status === "warn") add("emergency-warn", "warn", "Emergency fund is getting there", `${money(liq.gap)} more reaches ${liq.targetMonths} months of must-pay bills.`, ["balance", "liquidity"]);
  // a debt the saved debt plan already pays off (Next best action's step under way) is in hand: no alert for its rate
  const inHand = new Set(nba?.ready && nba.steps.some((x) => x.status === "underway") ? nba.debtPlan?.ids ?? [] : []);
  for (const r of debt.rows) {
    if (r.neverPaysOff) add(`debt-never-${r.id}`, "bad", `${r.name} never pays off at its payment`, "The payment does not cover the interest. Raise it, even a little.", ["balance", "liabilities"]);
    else if (r.expensive && !inHand.has(r.id)) add(`debt-expensive-${r.id}`, "warn", `${r.name} is expensive debt`, `About ${money(r.interestMonthly)} a month in interest at ${Math.round(r.rate * 1000) / 10}%. Extra payments here save the most.`, ["balance", "liabilities"]);
  }
  // the bank files show more going out than Expenses lists: the plan's figures are too rosy until the rest is listed
  let bank = null;
  try { bank = bankVsPlan(plan, p); } catch { bank = null; }
  if (bank?.over) add("bank-over", "warn", "Your bank shows more going out than Expenses lists", `About ${money(Math.round(bank.gap / 10) * 10)} a month more, over the last ${bank.months} whole months of bank files. Add the rest on Expenses and the plan's figures follow.`, ["cashflow", "expenses"]);
  // a loan paid off whose payment is still on Expenses: the money is free once it is stopped there
  for (const x of exp.ended ?? []) add(`debt-paid-${x.debtId}`, "warn", `${x.debtName} is paid off`, `Its payment, ${x.name} (${money(x.monthly)} a month), is still counted on Expenses. Stop it there and that money is free.`, ["cashflow", "expenses"]);
  if (debt.count && debt.withDetail < debt.count) add("debt-details", "info", `${debt.count - debt.withDetail} ${debt.count - debt.withDetail === 1 ? "debt has" : "debts have"} no rate or payment`, "Add them to see payoff dates and what interest costs.", ["balance", "liabilities"]);
  if (debt.dti !== null && debt.dti > 0.43) add("dti", "warn", "Debt payments take a big share of income", `${Math.round(debt.dti * 100)}% of monthly income goes to debt payments; lenders start worrying above 43%.`, ["balance", "liabilities"]);

  // goals
  // goals that are behind: one alert when there are two or more (four "X is behind" rows read as four problems); those
  // with nothing going in are named first (F-015: the most behind of all), and the left-over each month is beside the need
  const { behind: behindGoals, need, idle } = goalsBehind(gl, { nba, today });
  if (behindGoals.length > 1) {
    const names = behindGoals.map((g) => g.name);
    const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
    const idleNames = idle.map((g) => g.name);
    const idleText = !idle.length ? "" : idle.length === behindGoals.length ? `; nothing is going in to ${idle.length === 2 ? "either" : "any"} of them yet` : `; nothing is going in to ${idleNames.length > 1 ? `${idleNames.slice(0, -1).join(", ")} or ${idleNames[idleNames.length - 1]}` : idleNames[0]} yet`;
    add("goals-behind", "info", `${behindGoals.length} goals are behind`, `${list} need about ${money(need)} more a month in all${idleText}.${nba?.ready && nba.spare.monthly > 0 ? ` You have about ${money(nba.spare.monthly)} left over each month.` : ""}`, ["goals", "goals"]);
  }
  for (const g of gl.goals) {
    if (g.status === "past due") add(`goal-late-${g.id}`, "warn", `${g.name}: the date has passed`, `${money(g.remaining)} still to go. Set a new date or adjust the amount.`, ["goals", "goals"]);
    else if (g.status === "behind" && behindGoals.length === 1 && behindGoals.includes(g)) add(`goal-behind-${g.id}`, "info", `${g.name} is behind`, g.monthly > 0 ? `Needs about ${money(g.neededMonthly)} a month; you put in ${money(g.monthly)}.` : `Needs about ${money(g.neededMonthly)} a month; nothing is going in yet.`, ["goals", "goals"]);
  }
  // a goal past its date already has its own alert above: its warning from the Goals page would say the same thing again
  const late = gl.goals.filter((g) => g.status === "past due").map((g) => g.name);
  for (const [i, w] of gl.warnings.entries()) if (!late.some((n) => n && w.startsWith(n) && /date has passed/.test(w))) add(`goals-${i}`, "warn", "Goals: something to check", w, ["goals", "goals"]);
  // F-022: a retirement inside the next year changes income, health cover and withdrawals
  for (const p of ppl.people) if (p.role !== "dependent" && p.yearsToRetirement !== null && !p.retired && p.yearsToRetirement <= 1) add(`retiring-${p.id}`, "info", `${p.name} retires ${p.yearsToRetirement === 0 ? "this year" : "in about a year"}${p.retirementDate ? ` (${p.retirementDate.slice(0, 4)})` : ""}`, "Time to add the pension or Social Security on the Income page and give the salary an end date.", ["cashflow", "income"]);

  // data problems the pages already spotted
  for (const [i, w] of ppl.warnings.entries()) add(`people-${i}`, "warn", "People: something to check", w, ["household", "people"]);
  for (const [i, w] of inc.warnings.entries()) add(`income-${i}`, "warn", "Income: something to check", w, ["cashflow", "income"]);
  for (const [i, w] of exp.warnings.filter((w) => !w.includes("more each month")).entries()) add(`expenses-${i}`, "warn", "Expenses: something to check", w, ["cashflow", "expenses"]);
  for (const [i, w] of asm.warnings.entries()) add(`assumptions-${i}`, "warn", "Assumptions: something to check", w, ["system", "assumptions"]);

  alerts.sort((a, b) => (!!a.chore - !!b.chore) || LEVELS[a.level].order - LEVELS[b.level].order);
  const counts = { bad: 0, warn: 0, info: 0 };
  for (const a of alerts) if (!a.chore) counts[a.level]++;
  const total = counts.bad + counts.warn + counts.info;
  return { alerts, counts, total, chores: alerts.length - total, allClear: total === 0 };
}

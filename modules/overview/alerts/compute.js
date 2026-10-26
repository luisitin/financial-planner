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
import { daysBetween } from "../../../core/math/dates.js";
import { money as fmtMoney, date as fmtDate } from "../../../core/format.js";

export const LEVELS = { bad: { label: "fix", order: 0 }, warn: { label: "check", order: 1 }, info: { label: "to do", order: 2 } };
export const STALE_BALANCE_DAYS = 90;
export const STALE_HISTORY_DAYS = 35;

/**
 * compute(plan, { today }) -> { alerts: [{ id, level, title, detail, go: [group, id] }], counts: { bad, warn, info }, total, allClear }
 * `detail` is a finished sentence (money and dates already formatted). Without `today` the date checks are skipped.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const p = { today };
  const alerts = [];
  const add = (id, level, title, detail, go) => alerts.push({ id, level, title, detail, go });
  const cur = plan.meta?.currency ?? "USD";
  const money = (n) => fmtMoney(n, cur);

  const nw = netWorth(plan), ppl = people(plan, p), inc = income(plan, p), exp = expenses(plan, p), gl = goals(plan, p), liq = liquidity(plan, p), debt = liabilities(plan, p), asm = assumptions(plan, p);

  // setup
  if (ppl.count === 0) add("no-people", "info", "Add the people in your household", "Ages drive retirement, insurance and how long the money must last.", ["household", "people"]);
  if (nw.count === 0) add("no-accounts", "info", "Add your accounts", "Net worth, the emergency fund and every projection start from your balances.", ["balance", "net-worth"]);
  if (inc.count === 0) add("no-income", "info", "Enter what comes in", "Income is needed to check spending, debt load and savings rate.", ["cashflow", "income"]);
  if (exp.count === 0) add("no-expenses", "info", "Enter what goes out", "Expenses set the emergency-fund target and what retirement has to cover.", ["cashflow", "expenses"]);
  if (!asm.reviewedAt) add("assumptions-unreviewed", "info", "Look over the assumptions", "Ten numbers drive every projection. Confirm them once.", ["system", "assumptions"]);
  else if (asm.stale) add("assumptions-stale", "warn", "Assumptions were reviewed over a year ago", "Rates and inflation move. Look again and confirm.", ["system", "assumptions"]);

  // stale numbers
  if (today && nw.count) {
    const stale = (plan.accounts ?? []).filter((a) => !a.asOf || daysBetween(a.asOf, today) > STALE_BALANCE_DAYS);
    if (stale.length) add("stale-balances", "warn", `${stale.length === 1 ? "One balance is" : `${stale.length} balances are`} more than ${STALE_BALANCE_DAYS} days old`, `${stale.slice(0, 3).map((a) => a.name).join(", ")}${stale.length > 3 ? "..." : ""}. Update them so the totals mean something.`, ["balance", "net-worth"]);
    const last = nw.history[nw.history.length - 1];
    if (!last || daysBetween(last.date, today) > STALE_HISTORY_DAYS) add("history", "info", "Save today's totals", last ? `The last saved point is from ${fmtDate(last.date)}. Saving once a month builds the net-worth history.` : "Saving once a month builds the net-worth history.", ["balance", "net-worth"]);
  }

  // money
  if (exp.leftOver !== null && exp.leftOver < 0) add("overspend", "bad", "You spend more than comes in", `About ${money(-exp.leftOver)} more goes out each month than comes in. Check the amounts, then find what to cut.`, ["cashflow", "expenses"]);
  if (liq.status === "bad") add("emergency-bad", "bad", "Emergency fund is thin", `Usable cash covers ${liq.runwayMonths === null ? "0" : (Math.round(liq.runwayMonths * 10) / 10)} months of must-pay bills; the plan aims for ${liq.targetMonths}. ${money(liq.gap)} to go.`, ["balance", "liquidity"]);
  else if (liq.status === "warn") add("emergency-warn", "warn", "Emergency fund is getting there", `${money(liq.gap)} more reaches ${liq.targetMonths} months of must-pay bills.`, ["balance", "liquidity"]);
  for (const r of debt.rows) {
    if (r.neverPaysOff) add(`debt-never-${r.id}`, "bad", `${r.name} never pays off at its payment`, "The payment does not cover the interest. Raise it, even a little.", ["balance", "liabilities"]);
    else if (r.expensive) add(`debt-expensive-${r.id}`, "warn", `${r.name} is expensive debt`, `About ${money(r.interestMonthly)} a month in interest at ${Math.round(r.rate * 1000) / 10}%. Extra payments here save the most.`, ["balance", "liabilities"]);
  }
  if (debt.count && debt.withDetail < debt.count) add("debt-details", "info", `${debt.count - debt.withDetail} ${debt.count - debt.withDetail === 1 ? "debt has" : "debts have"} no rate or payment`, "Add them to see payoff dates and what interest costs.", ["balance", "liabilities"]);
  if (debt.dti !== null && debt.dti > 0.43) add("dti", "warn", "Debt payments take a big share of income", `${Math.round(debt.dti * 100)}% of monthly income goes to debt payments; lenders start worrying above 43%.`, ["balance", "liabilities"]);

  // goals
  for (const g of gl.goals) {
    if (g.status === "past due") add(`goal-late-${g.id}`, "warn", `${g.name}: the date has passed`, `${money(g.remaining)} still to go. Set a new date or adjust the amount.`, ["goals", "goals"]);
    else if (g.status === "behind") add(`goal-behind-${g.id}`, "info", `${g.name} is behind`, g.monthly > 0 ? `Needs about ${money(g.neededMonthly)} a month; you put in ${money(g.monthly)}.` : `Needs about ${money(g.neededMonthly)} a month; nothing is going in yet.`, ["goals", "goals"]);
  }
  for (const [i, w] of gl.warnings.entries()) add(`goals-${i}`, "warn", "Goals: something to check", w, ["goals", "goals"]);
  // F-022: a retirement inside the next year changes income, health cover and withdrawals
  for (const p of ppl.people) if (p.role !== "dependent" && p.yearsToRetirement !== null && !p.retired && p.yearsToRetirement <= 1) add(`retiring-${p.id}`, "info", `${p.name} retires ${p.yearsToRetirement === 0 ? "this year" : "in about a year"}${p.retirementDate ? ` (${p.retirementDate.slice(0, 4)})` : ""}`, "Time to add the pension or Social Security on the Income page and give the salary an end date.", ["cashflow", "income"]);

  // data problems the pages already spotted
  for (const [i, w] of ppl.warnings.entries()) add(`people-${i}`, "warn", "People: something to check", w, ["household", "people"]);
  for (const [i, w] of inc.warnings.entries()) add(`income-${i}`, "warn", "Income: something to check", w, ["cashflow", "income"]);
  for (const [i, w] of exp.warnings.filter((w) => !w.includes("more each month")).entries()) add(`expenses-${i}`, "warn", "Expenses: something to check", w, ["cashflow", "expenses"]);
  for (const [i, w] of asm.warnings.entries()) add(`assumptions-${i}`, "warn", "Assumptions: something to check", w, ["system", "assumptions"]);

  alerts.sort((a, b) => LEVELS[a.level].order - LEVELS[b.level].order);
  const counts = { bad: 0, warn: 0, info: 0 };
  for (const a of alerts) counts[a.level]++;
  return { alerts, counts, total: alerts.length, allClear: alerts.length === 0 };
}

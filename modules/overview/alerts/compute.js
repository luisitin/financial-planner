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
import { compute as nextBest, cushionLater, monthWords, dayWords, rmdNow, waitWords, accountWords, collegeBills, collegeWords } from "../next-best-action/compute.js";
import { bankVsPlan } from "../../cashflow/income-statement/compute.js";
import { taxAnswer } from "../../taxes/withholding/compute.js";
import { compute as estimatedOf } from "../../taxes/estimated/compute.js";
import { protectionGaps } from "../../insurance/life-needs/compute.js";
import { compute as estateDocs } from "../../estate/documents/compute.js";
import { daysBetween, monthsBetween } from "../../../core/math/dates.js";
import { pmtToReach, fv } from "../../../core/math/finance.js";
import { nameOf, NameOf, NameIn, verbFor } from "../../../core/words.js";
import { money as fmtMoney, date as fmtDate } from "../../../core/format.js";
import { rentalsOf, valueAccountOf, twinAccount, candidateAccounts } from "../../property/rental/running.js";

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
 *   pastDue: [...], queued: [goals with nothing going in whose turn comes later and that can still be reached from then], turn (the day Next best action's goals step starts, or null) }
 * Only goals behind their pace count toward the monthly need; a goal past its date is counted apart (its whole remaining
 * amount is not a monthly figure). Needs attention and the Dashboard's Goals tile both use it, so they say the same.
 */
export function goalsBehind(gl, { nba = null, today = null } = {}) {
  const goals = gl?.goals ?? [];
  // a goal with nothing going in yet, whose turn Next best action gives later (its goals step starts getting money in a
  // later month, after the cards and the cushion), is waiting its turn, not behind: a goal set a minute ago is not late
  const step = nba?.ready ? (nba.steps ?? []).find((x) => x.id === "goals") : null;
  const turn = step?.startDate && today && step.startDate.slice(0, 7) > today.slice(0, 7) ? step.startDate : null;
  // a bill Next best action pays from savings (due within 3 months, more than a month can save, the cash covers it: its goals
  // step's `fromCash`, review UX 1) is not behind by a month's saving; it is said as a bill to pay (compute, below)
  const fromCash = new Set((step?.fromCash ?? []).map((x) => x.id));
  const all = goals.filter((g) => g.status === "behind" && !fromCash.has(g.id));
  // only a goal dated after its turn can wait for it (one due sooner stays behind, review 2026-11-02), and never the
  // emergency fund: Next best action fills the cushion in its own earlier steps, not with the goals step
  // and only while it can still be reached from then, out of the spare money that reaches the goals step once it starts
  // (a trip due a month after the turn cannot wait for it, review 2026-11-02)
  const room = Number(step?.capacity ?? (Number(step?.roomYearly) || 0) / 12) || 0;
  // (the emergency fund is the goal ticked as it, as Next best action and Liquidity read it, review D6: one only named like it
  // is with the dated goals there, so it waits for the goals step's turn like them)
  const afterTurn = (g) => g.targetDate && String(g.targetDate) > turn && !g.isEmergencyFund;
  // checked month by month from the turn (review 2026-11-02, round 5, third pass: one level figure counted a short-dated
  // goal's catch-up as if it lasted until every waiting goal's date, so goals that can be reached read "behind")
  const monthsLeft = (g) => Math.max(0, monthsBetween(turn, g.targetDate) ?? 0);   // whole months the step can work on it
  const rateOf = (g) => (Number(g.rate) || 0) / 12, targetOf = (g) => Number(g.targetThen ?? g.target) || 0;
  // what a goal will have at the turn: what it has, grown with what goes in each month until then
  const atTurn = (g) => fv(rateOf(g), Math.max(0, monthsBetween(today, turn)), Number(g.monthly) || 0, Number(g.funded) || 0);
  // the same step's money first catches up the goals already getting something and still behind, dated after the turn:
  // each takes its extra a month (what it needs from the turn to its date, less what already goes in) only until its own
  // date; one due within the turn's first month draws nothing (review 2026-11-02, round 5: a wedding read "starts later"
  // on money the car and college goals need). A goal without its target and funded figures keeps today's measure
  const extraFromTurn = (g) => {
    const n = monthsLeft(g);
    if (!(n > 0)) return 0;
    const needs = (g.targetThen ?? g.target) != null && g.funded != null ? Math.max(0, pmtToReach(rateOf(g), n, targetOf(g), atTurn(g))) : Number(g.neededMonthly) || 0;
    return Math.max(0, needs - (Number(g.monthly) || 0));
  };
  const waiting = turn ? all.filter((g) => !(g.monthly > 0) && afterTurn(g)).sort((a, b) => String(a.targetDate).localeCompare(String(b.targetDate))) : [];
  // what is left of the step in each month from the turn, once those goals have their extra
  const left = Array.from({ length: Math.max(0, ...waiting.map(monthsLeft)) }, () => room);
  if (turn) for (const g of all.filter((x) => x.monthly > 0 && afterTurn(x))) { const e = extraFromTurn(g); for (let k = 0; k < Math.min(left.length, monthsLeft(g)); k++) left[k] -= e; }
  // waiting goals in date order, the sooner first: each takes what is left each month until it is reached; it waits its
  // turn when it is reached by its date (to 50 cents a month). One that is not stays short past its date, so it holds the
  // step and no later goal is said to start on that money; one due within the turn's first month gets nothing and holds nothing
  let held = false;
  const queued = waiting.filter((g) => {
    const n = monthsLeft(g);
    if (held || !(n > 0)) return false;
    const r = rateOf(g), target = targetOf(g), draw = [];
    let have = atTurn(g);
    for (let k = 0; k < n; k++) { const d = Math.min(Math.max(0, left[k]), Math.max(0, target - have * (1 + r))); have = have * (1 + r) + d; draw.push(d); }
    if (have + fv(r, n, 0.5) < target) { held = true; return false; }
    draw.forEach((d, k) => { left[k] -= d; });
    return true;
  });
  const behind = all.filter((g) => !queued.includes(g)).sort((a, b) => (a.monthly > 0) - (b.monthly > 0));
  const need = behind.reduce((t, g) => t + Math.max(0, (Number(g.neededMonthly) || 0) - (Number(g.monthly) || 0)), 0);
  return { behind, need, idle: behind.filter((g) => !(g.monthly > 0)), pastDue: goals.filter((g) => g.status === "past due"), queued, turn, fromCash: step?.fromCash ?? [] };
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
  // a rental only on Rental analysis is left out of net worth (round 8 batch 6 review, UX 10: only Rental analysis and the
  // Asset register said so): a housekeeping item, with its value and the loan typed there; asked about when Net worth may
  // already list it (running.js twinAccount, candidateAccounts), and then its title asks rather than calls it missing (batch 6
  // verify: "Condo is not in your net worth yet" stood over a Net worth that listed Condo at $260,000)
  for (const r of rentalsOf(plan)) {
    if (valueAccountOf(plan, r) || !(Number(r.value) > 0)) continue;
    const owes = !r.loanAccountId && Number(r.loanBalance) > 0 ? Number(r.loanBalance) : 0, name = String(r.name ?? "").trim() || "Your rental";
    const maybe = !!twinAccount(plan, r) || candidateAccounts(plan, r).length > 0;
    add(`rental-off-${r.id}`, "info", maybe ? `Is ${name} on Net worth already?` : `${name} is not in your net worth yet`, `It is worth ${money(Number(r.value))}${owes > 0 ? ` and owes ${money(owes)}` : ""} on Rental analysis. ${maybe ? "Net worth may already list it: say which there." : "Add it there in one tap."}`, ["property", "rental"], chore);
  }

  // money
  // what is left after tax, spending and saving (the Dashboard's figure); pay before tax minus spending only when the
  // tax cannot be worked out yet
  const nba = exp.leftOver !== null ? nextBest(plan, p) : null;
  const short = nba?.ready ? -nba.spare.monthly : exp.leftOver !== null ? -exp.leftOver : 0;
  // a retired household drawing from savings as the plan intends is not overspending (Next best action's `drawing`)
  // short on the careful month (Side income's "count on"): said so, with what a month that brings the Income page's amount
  // leaves (Next best action's spare.full, said to the nearest $10 as every page says it), review 2026-11-02. When a full
  // month leaves money it is a lean month to plan for, not a plain overspend: amber ("warn"), not red (round 5)
  // the spending is mostly our guesses (Next best action's spare.waits, spec 8.1): no red verdict on guesses, one calm line
  const waits = !!(nba?.ready && nba.spare.waits);
  if (waits) add("spend-guessed", "info", "Type what you really spend", `Most of the spending in your plan is our guesses for now${short > 0 ? `; with them, about ${money(Math.round(short / 10) * 10)} more would go out each month than comes in` : ""}. Your real figures decide whether your month works.`, ["cashflow", "expenses"]);
  else if (short > 0 && !nba?.drawing) {
    // a full month within $5 of $0 "only just about breaks even" (spare.fullKind "even"): no "about $0", and red, as good
    // months do not make up for lean ones then (round 5)
    const held = nba?.ready && nba.spare.held > 0.5, kind = held ? nba.spare.fullKind : null, about = held ? nba.spare.fullAbout : null, lean = held && kind === "ahead";
    add("overspend", lean ? "warn" : "bad", lean ? "Lean months run short" : "You spend more than comes in", `About ${money(short)} more goes out each month than comes in${nba?.ready ? ", after tax and saving" : ""}${held ? `, counting uneven pay at what you can count on (Side income); a month that brings the Income page's amount ${lean ? `leaves about ${money(about)}` : kind === "even" ? "only just about breaks even" : `is still about ${money(-about)} short`}` : ""}. ${lean ? "Good months make up for lean ones; keep a cash cushion for the months in between, or spend less." : "Check the amounts, then find what to cut."}`, ["cashflow", "expenses"]);
  }
  // a likely bill in April: the year's federal tax against what the paychecks take out by December (typed, else estimated
  // from pay) and what is already paid, the same answer as Withholding check; flagged from $1,000 left to pay
  let tax = null;
  try { tax = inc.count ? taxAnswer(plan, { today }) : null; } catch { tax = null; }
  // filing separately, a return's own bill counts: the other return's refund cannot pay it (withholding byReturn; Review
  // 2026-11-06: Bo's return owed 1,660 while the two added up came to a refund, so nothing was said)
  const owing = tax && tax.from !== "none" && Array.isArray(tax.returns) && tax.returns.length > 1 ? tax.returns.filter((x) => x.balance >= 1000) : null;
  if (owing?.length) add("tax-bill", "warn", `About ${money(owing.reduce((t, x) => t + x.balance, 0))} of tax to pay in April on ${owing.map((x) => nameOf(x.name)).join(" and ")} return`, `Filing separately, each return settles on its own, and one return's refund cannot pay the other's bill. ${owing.map((x) => `${NameOf(x.name)} return has about ${money(x.owed)} of federal tax and ${nameOf(x.name)} pay takes out about ${money(x.withheld)}${x.paid >= 0.5 ? `, ${money(x.paid)} paid` : ""}`).join("; ")}. A W-4 change now spreads it over the paychecks left instead of one bill in April.`, ["taxes", "withholding"]);
  else if (!owing && tax && tax.from !== "none" && tax.balance >= 1000) add("tax-bill", "warn", `About ${money(tax.balance)} of tax to pay in April`, `About ${money(tax.totalTax)} of federal tax for ${tax.year}${(tax.seOwn ?? tax.seTax) >= 1 ? ` (${money(tax.seOwn ?? tax.seTax)} of it self-employment tax)` : ""}; the paychecks take out about ${money(tax.projected)}${tax.from === "paycheck" ? " (estimated from your pay)" : tax.from === "mixed" ? " (partly estimated from pay)" : ""}${tax.paid > 0 ? ` and ${money(tax.paid)} is already paid` : ""}. A W-4 change now spreads it over the paychecks left instead of one bill in April.`, ["taxes", "withholding"]);
  // no paycheck takes tax out (a retiree, the self-employed): the bill is paid by quarterly estimates, so a payment past
  // due is the thing to fix (Estimated payments' own figure)
  // This year's IRA or 401(k) withdrawals in the tax (Estimated payments' holdBack): having the tax held back from a withdrawal
  // by December 31 counts as paid through the whole year, the quarters already past included (IRC 6654(g)), so the alert says
  // that, the same as Quick answers, the Tax report and Estimated payments, never "pay the past-due part" (round 8 batch 1
  // verify, item 4: the widow was told both). It is added after the required withdrawal's alert, which it follows.
  let holdBack = null;
  if (tax && tax.from === "none" && !(inc.active ?? []).some((x) => x.type === "salary" || x.type === "bonus")) {
    let e = null;
    try { e = estimatedOf(plan, { today }); } catch { e = null; }
    if (e?.needsEstimates && e.remaining > 0 && e.holdBack) holdBack = { e, h: e.holdBack };
    // nothing ever typed on Estimated payments is not "$0 paid": ask first, say what is due if none were made (review 2026-11-02)
    else if (e?.needsEstimates && e.behind > 0 && !e.paidTyped) add("estimates-behind", "warn", `Estimated tax: type what you have paid this year`, `Nothing in the plan takes tax out of what comes in, so ${e.year}'s federal tax (about ${money(e.totalTax)}) is paid in four estimated payments, and none are typed yet. If none were made, about ${money(e.behind)} was due by now: type what you paid on Estimated payments, or pay the past-due part to keep the underpayment penalty small.`, ["taxes", "estimated"]);
    else if (e?.needsEstimates && e.behind > 0) add("estimates-behind", "warn", `About ${money(e.behind)} of estimated tax is past due`, `Nothing in the plan takes tax out of what comes in, so ${e.year}'s federal tax (about ${money(e.totalTax)}) is paid in four estimated payments; ${money(e.paid)} is paid so far. Paying the past-due part now keeps the underpayment penalty small. If a pension or IRA withdrawal has tax taken out, type it on the Federal estimate page.`, ["taxes", "estimated"]);
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
  // the plan pays costly debt before the full cushion (the starter month is in cash): say so, never a red "thin" beside it
  const later = (liq.status === "bad" || liq.status === "warn") ? cushionLater(nba) : null;
  // whole months, one decimal under 2 (the Emergency fund page's rule, design log 2026-09-15)
  const wholeMonths = (m) => { const v = m < 2 ? Math.round(m * 10) / 10 : Math.round(m); return `${v} month${v === 1 ? "" : "s"}`; };
  if (liq.waits && (liq.status === "bad" || liq.status === "warn")) add("emergency-guessed", "info", "Emergency fund: by our guesses", `By our guesses of the bills you have to pay, usable cash covers about ${liq.runwayMonths === null ? "0 months" : wholeMonths(liq.runwayMonths)}; the plan aims for ${liq.targetMonths}. Type your real bills to know for sure.`, ["cashflow", "expenses"]);
  else if (later) add("emergency-later", "info", "Emergency fund: enough for now", `Usable cash covers ${wholeMonths(liq.runwayMonths)} of the bills you have to pay: enough for now. Costly debt comes first; once it is paid off${later.until ? ` (about ${monthWords(later.until)})` : ""}, the plan builds this to ${liq.targetMonths} months.`, ["balance", "liquidity"]);
  else if (liq.status === "bad") add("emergency-bad", "bad", "Emergency fund is thin", `Usable cash covers ${liq.runwayMonths === null ? "0" : (Math.round(liq.runwayMonths * 10) / 10)} months of the bills you have to pay; the plan aims for ${liq.targetMonths}. ${money(liq.gap)} to go.`, ["balance", "liquidity"]);
  else if (liq.status === "warn") add("emergency-warn", "warn", "Emergency fund is getting there", `${money(liq.gap)} more reaches ${liq.targetMonths} months of the bills you have to pay.`, ["balance", "liquidity"]);
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
  // ...unless that is mostly what went to a card whose file isn't in: its file first (re-check 4, 2026-11-02)
  // (two cards at one bank with no file for either: the months whole but for those payments, "Bring in the card files"; re-check 5)
  else if (bank?.cardFile) { const f = bank.cardFile; add("bank-card", "warn", f.title, `About ${money(Math.round(f.monthly / 10) * 10)} a month went to ${f.the} over the last ${f.months}${f.whole ? " whole" : ""} months, but ${f.plural ? "their own files aren't in, so what they bought" : "its own file isn't in, so what it bought"} can't be checked against Expenses yet.`, ["transactions", "import"], { query: { accountId: f.accountId } }); }
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
  // bills Next best action pays from savings (review UX 1): one line, as a bill to pay, never a month's saving
  const cashGoals = nba?.ready ? (nba.steps ?? []).find((x) => x.id === "goals")?.fromCash ?? [] : [];
  if (cashGoals.length) {
    const many = cashGoals.length > 1, list = cashGoals.map((x) => `${x.name} (about ${money(Math.round(x.amount / 10) * 10)} by ${dayWords(x.due)})`);
    add("goals-from-cash", "info", many ? `Pay ${cashGoals.length} goals from savings` : `Pay ${cashGoals[0].name} from savings`,
      `${list.length > 1 ? `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}` : list[0]} ${many ? "are" : "is"} due sooner than a month can save for ${many ? "them" : "it"}; your usable cash covers ${many ? "them" : "it"}. Pay ${many ? "them" : "it"} from savings when ${many ? "they are" : "it is"} due.`, ["goals", "goals"]);
  }
  // a past-due college goal of a child in college: Education's next bill, as Next best action says it (review UX 4)
  const bills = collegeBills(plan, today, gl.goals);
  for (const g of gl.goals) {
    if (g.status === "past due" && bills.has(g.id)) add(`goal-late-${g.id}`, "warn", `${g.name}: the date has passed`, collegeWords(bills.get(g.id), (n) => money(Math.round(n / 10) * 10)), ["goals", "education"]);
    else if (g.status === "past due") add(`goal-late-${g.id}`, "warn", `${g.name}: the date has passed`, `${money(g.remaining)} still to go. Set a new date or adjust the amount.`, ["goals", "goals"]);
    else if (g.status === "behind" && behindGoals.length === 1 && behindGoals.includes(g)) add(`goal-behind-${g.id}`, "info", `${g.name} is behind`, g.monthly > 0 ? `Needs about ${money(g.neededMonthly)} a month; you put in ${money(g.monthly)}.` : `Needs about ${money(g.neededMonthly)} a month; nothing is going in yet.`, ["goals", "goals"]);
  }
  // a goal past its date already has its own alert above: its warning from the Goals page would say the same thing again
  const late = gl.goals.filter((g) => g.status === "past due").map((g) => g.name);
  // (the Goals page's warning names the goal inside it since round 8's wording, "The date for X has passed")
  for (const [i, w] of gl.warnings.entries()) if (!late.some((n) => n && w.includes(n) && /date .*has passed|date has passed/.test(w))) add(`goals-${i}`, "warn", "Goals: something to check", w, ["goals", "goals"]);
  // this year's required withdrawal, from October while it is not marked taken (December 31; the first year may wait to
  // April 1): missing it costs 25% of what was not taken (IRS, Retirement topics: RMDs, reviewed 2026-04-08)
  // Someone still working: the 401(k) at that job can wait until they retire (Next best action's rmdNow, review D5), so the
  // amount is what cannot wait, and the alert says which account waits; with only that 401(k), no alert
  if (today && Number(today.slice(5, 7)) >= 10) for (const r of rmdNow(plan, { today })) {
    const dec = Number(today.slice(5, 7)) === 12;
    add(`rmd-${r.id}-${today.slice(0, 4)}`, r.first ? "info" : dec ? "bad" : "warn",
      `${r.name === "You" ? "Your" : NameOf(r.name)} required withdrawal: at least ${money(r.amount)} by ${r.first ? `April 1, ${Number(today.slice(0, 4)) + 1}` : `December 31`}`,
      `From ${r.accounts.map((a) => accountWords(a.name)).join(" and ")}${r.estimated ? ", worked out from today's balance" : ""}.${waitWords(r)} ${r.first ? `The first year may wait until April 1, but then two fall in ${Number(today.slice(0, 4)) + 1}.` : "Missing it costs 25% of what was not taken."} Tap "I've taken it" there once it is done.`,
      ["retirement", "rmd"], { due: r.first ? `${Number(today.slice(0, 4)) + 1}-04-01` : r.deadline });
  }
  if (holdBack) {
    const { e, h } = holdBack;
    add("estimates-holdback", "warn", `Have about ${money(h.amount)} of tax held back from your IRA withdrawal by December 31`,
      `About ${money(e.totalTax)} of federal tax for ${e.year}, and no tax held back is on file. Tax held back from a withdrawal counts as paid through the whole year, the quarters already past included${h.whole > h.amount + 50 ? `; about ${money(h.whole)} leaves nothing to pay in April` : ""}. Ask the firm that holds the account to hold it back. Paying by quarters works too: Estimated payments has both.`,
      ["taxes", "estimated"], { due: `${e.year}-12-31` });
  }
  // F-022: a retirement inside the next year changes income, health cover and withdrawals
  for (const p of ppl.people) if (p.role !== "dependent" && p.yearsToRetirement !== null && !p.retired && p.yearsToRetirement <= 1) add(`retiring-${p.id}`, "info", `${NameIn(p.name)} ${verbFor(p.name, "retires", "retire")} ${p.yearsToRetirement === 0 ? "this year" : "in about a year"}${p.retirementDate ? ` (${p.retirementDate.slice(0, 4)})` : ""}`, "Time to add the pension or Social Security on the Income page and give the salary an end date.", ["cashflow", "income"]);

  // data problems the pages already spotted
  for (const [i, w] of ppl.warnings.entries()) add(`people-${i}`, "warn", "People: something to check", w, ["household", "people"]);
  for (const [i, w] of inc.warnings.entries()) add(`income-${i}`, "warn", "Income: something to check", w, ["cashflow", "income"]);
  for (const [i, w] of exp.warnings.filter((w) => !w.includes("more each month")).entries()) add(`expenses-${i}`, "warn", "Expenses: something to check", w, ["cashflow", "expenses"]);
  for (const [i, w] of asm.warnings.entries()) add(`assumptions-${i}`, "warn", "Assumptions: something to check", w, ["system", "assumptions"]);

  // within a level, one with a date (`due`) first, the nearest first (round 8 item 40: a required withdrawal due December 31
  // came after "Emergency fund is getting there"); the others keep their order
  alerts.sort((a, b) => (!!a.chore - !!b.chore) || LEVELS[a.level].order - LEVELS[b.level].order || (!a.due - !b.due) || (a.due && b.due ? a.due.localeCompare(b.due) : 0));
  const counts = { bad: 0, warn: 0, info: 0 };
  for (const a of alerts) if (!a.chore) counts[a.level]++;
  const total = counts.bad + counts.warn + counts.info;
  return { alerts, counts, total, chores: alerts.length - total, allClear: total === 0 };
}

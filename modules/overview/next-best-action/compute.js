// modules/overview/next-best-action/compute.js -- PURE. Where the next spare dollar goes, in the
// well-known order (the r/personalfinance "prime directive", the Bogleheads' investing priorities):
// cover the bills, a starter emergency fund, the employer match, expensive debt, a full emergency
// fund, the HSA, an IRA, middling debt, the 401(k) to the limit, then goals and the rest. Each step
// says whether it is done, what is left, and, from the money left over each month after tax,
// spending and what already goes to savings, about when the spare money gets it done.
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeExpenses } from "../../cashflow/expenses/compute.js";
import { compute as computeLiquidity } from "../../balance/liquidity/compute.js";
import { compute as computeLiabilities } from "../../balance/liabilities/compute.js";
import { compute as computeContributions, limitKind } from "../../retirement/contributions/compute.js";
import { compute as computeGoals, plannerFor } from "../../goals/goals/compute.js";
import { compute as computeEducation } from "../../goals/education/compute.js";
import { compute as computeFederal } from "../../taxes/federal/compute.js";
import { protectionGaps, RESTS_ON } from "../../insurance/life-needs/compute.js";
import { savingVerdict, drawingAsPlanned } from "../../retirement/projection/compute.js";
import { compute as computeLimits } from "../../investments/limits/compute.js";
import { offer as payoffOffer, savedPlan } from "../../debt/payoff/compute.js";
import { yearTaxes, heldAfterTax, aboutTen, fullKind } from "../../cashflow/budget-percent/compute.js";
import { compute as computeBusiness } from "../../career/business/compute.js";
import { compute as computeBenefits, DEFAULT_TIERS, matchAt, fullMatchAt } from "../../career/benefits/compute.js";
import { thisYear as rmdThisYear } from "../../retirement/rmd/compute.js";
import { compute as computePeople } from "../../household/people/compute.js";
import { addMonths } from "../../../core/math/dates.js";
import { rmdAmount } from "../../../core/math/rmd.js";
import { pmtToReach } from "../../../core/math/finance.js";
import { leftMarker, leftOverOf, yearSaving } from "../../../core/math/leftover.js";
import { money as fmtMoney, monthsWords } from "../../../core/format.js";
import { monthsNear } from "../../../core/words.js";
import { isYou, nameIn, NameIn, NameOf, nameOf, verbFor, NamesIn } from "../../../core/words.js";
import { isGuess } from "../../../core/estimate/index.js";
import { payOf, jobPayOf, matchTerms, usualShare, typedTiers, compLimit, ageInYear, deferralLimit } from "../guesses/estimators/saving.js";

// the unnamed first adult ("Me" from Get started) and the unnamed partner ("My spouse") read "you" and "your spouse" in a
// sentence; any other name reads as typed, exactly as before (round 7, 2026-11-06)
const asTyped = (name) => !isYou(name) && nameIn(name) === String(name);
/** names leading a sentence: "Ana and Bo" as before, "You and Bo" when one is the unnamed first adult */
const whoLeads = (names) => (names.every(asTyped) ? names.join(" and ") : NamesIn(names));
/** what each person can still put in this year, in plain words (spec 13.1, C10: was "$7,500 of room left this year"):
 * "Ana can still put in $7,500 this year and Bo $3,900"; "You can still put in $7,500 this year" for the unnamed first adult;
 * "You can still put in $7,500 this year and your spouse $3,900". A typed name reads as typed, the unnamed ones as you/your spouse. */
function roomWords(list, money) {
  const who = (x, lead) => (asTyped(x.name) ? x.name : lead ? NameIn(x.name) : nameIn(x.name));
  const [first, ...rest] = list;
  const more = rest.map((x) => `${who(x, false)} ${money(x.room)}`);
  const tail = !more.length ? "" : more.length === 1 ? ` and ${more[0]}` : `, ${more.slice(0, -1).join(", ")} and ${more.at(-1)}`;
  return `${who(first, true)} can still put in ${money(first.room)} this year${tail}`;
}

/** Debt at this rate or above is "expensive": pay it before investing beyond the match (r/personalfinance wiki: above about 10%). */
export const HIGH_RATE = 0.10;
/** Debt from this rate up to HIGH_RATE is "moderate": after the IRA, before the rest of the 401(k) (the wiki's 4-5% line). Mortgages are left to the last step. */
export const MODERATE_RATE = 0.04;
/** Payroll taxes on pay: Social Security 6.2% up to the wage base and Medicare 1.45% (IRC §3101); self-employment 15.3% on 92.35% of profit (§1401, §1402). */
export const FICA = { ss: 0.062, medicare: 0.0145, selfEmployed: 0.153, seBase: 0.9235 };
/** How many months the simulation looks ahead. */
export const HORIZON_MONTHS = 120;
/** A goal due within this many months that the month cannot save for, with the cash to pay it, is paid from savings (review UX 1). */
export const FROM_CASH_MONTHS = 3;

/**
 * compute(plan, { today }) -> {
 *   ready, missing, needs (when not ready: [{ key, words, label, go }], the pages that fill what is missing, in order),
 *   spare: { monthly, leftOver (core/math/leftover.js leftOverOf: before goal saving), year (core/math/leftover.js yearSaving: what the month builds up in a year), fromLeft? (the left-over note while spending was worked out from it), gross, guessedShare?, guessedMonthly?, waits? (Expenses' guessed share of the month, only when the plan
 *            holds guesses; waits: half or more of it is ours, so the figure is not a verdict and no step is dated from it), businessCosts, federalTax, payrollTax, stateTax, careLost (the child care account's money it would lose), stateKnown, state, spending, retirementSaving, goalSaving, debtExtra,
 *     heldGross (uneven pay the plan does not count on: income's heldMonthly), held (that, less the tax on it: what the month loses),
 *     full (monthly + held: what a month that brings the Income page's amount leaves), fullAbout (full to the nearest $10),
 *     fullKind ("ahead" | "even" | "short": Budget (50/30/20)'s fullKind, how every page words the full month) }
 *            (all a month; spare may be negative; stateKnown: the state's income tax could be worked out, or the state has none;
 *            debtExtra: the extra a month the saved debt plan pays on top of the required payments, Pay off debts' `extra`),
 *   debtPlan: { extra, names, ids, until, months } | null (that saved extra: the debts it goes to, and when the last of them is gone),
 *   steps: [{ id, n, title, why, status: "done"|"now"|"later"|"check"|"skip"|"underway", detail, gap (one-off amount left) | null, roomYearly | null,
 *             underway: { extra, names, until } (a debt step the saved debt plan already pays off: no spare money goes to it),
 *             fromSavings (the expensive-debt step: what usable cash above the full cushion pays off today; the gap is the rest),
 *             doneDate | null (a gap filled by the spare money), startDate | null (when an ongoing step starts getting money), monthly | null, go,
 *             capacity | null (an ongoing step: the spare money a month that reaches it once it has started, before its own cap),
 *             ask (the match step: [{ personId, name, accounts: [401(k) ids] }] with pay, a 401(k) and nothing going in) }],
 *   next: the first step that is not done (or null)
 *   drawing: a retired household drawing from savings as planned ({ verdict, spendingMonthly, affordableMonthly }) or null
 * }
 * Steps that do not apply to this household (no 401(k), no HSA) are left out.
 */
/**
 * monthLines(spare, debtPlan) -> [{ key, label, amount }]: the lines "Each month's money" shows between the pay and what is
 * spare, in order, so that pay less the lines is the spare money (gross - sum = monthly; `amount` a month, the federal tax
 * below zero when credits pay back more than it). Lines with nothing in them are left out, except the taxes, spending and
 * saving. The child care account's money it would lose has its own line (Review 2026-11-06: it came off the spare money with
 * no line, so the lines added up to $417 more than "Spare each month").
 */
export function monthLines(s, debtPlan = null) {
  const names = debtPlan?.names?.length && debtPlan.names.length <= 2 ? debtPlan.names.join(" and ") : "debts";
  return [
    ...(s.businessCosts > 0.5 ? [{ key: "businessCosts", label: "Business costs (Self-employment page)", amount: s.businessCosts }] : []),
    { key: "federalTax", label: "Federal income tax", amount: s.federalTax },
    { key: "payrollTax", label: "Social Security and Medicare tax", amount: s.payrollTax },
    ...(s.stateTax > 0.5 ? [{ key: "stateTax", label: "State income tax", amount: s.stateTax }] : []),
    // a rental's running costs (follow-up 2026-11-07): the rent is in the pay above, its costs are not in Expenses
    ...(s.rentCosts > 0.005 ? [{ key: "rentCosts", label: "Rental running costs (Rental analysis)", amount: s.rentCosts }] : []),
    // a rental's loan typed only on Rental analysis (no Debts row, so not in Spending; left2 fix round 1, M-3 and B-4)
    ...(s.rentLoan > 0.005 ? [{ key: "rentLoan", label: "Rental loan payment (Rental analysis)", amount: s.rentLoan }] : []),
    // the account's money beyond the care it pays back: taken from pay and never paid back (Form 2441 line 14)
    ...(s.careLost > 0.005 ? [{ key: "careLost", label: "Child care account money it would lose", amount: s.careLost }] : []),
    { key: "spending", label: "Spending", amount: s.spending },
    { key: "retirementSaving", label: "Retirement saving", amount: s.retirementSaving },
    { key: "goalSaving", label: "Saving for goals", amount: s.goalSaving },
    // the saved debt plan's extra (Pay off debts) is already spoken for, so it is not spare
    ...(s.debtExtra > 0 ? [{ key: "debtExtra", label: `Extra on ${names} (Pay off debts)`, amount: s.debtExtra }] : []),
    // uneven pay above what you count on (Side income): in the pay above, not in the spare, so the lines add up
    ...(s.held > 0.005 ? [{ key: "held", label: "Side income above what you count on, after its tax", amount: s.held }] : []),
  ];
}

export function compute(plan, params = {}) {
  const today = params.today ?? null;
  if (!today) return { ready: false, missing: ["today's date"] };
  const cur = plan.meta?.currency ?? "USD";
  const money = (n) => fmtMoney(Math.round(n / 10) * 10, cur);
  const exact = (n) => fmtMoney(Math.round(n), cur);   // a balance to pay off: to the dollar, as Pay off debts says it
  // the month's own figures (left over, spending, bills, cash): to the dollar as the Dashboard says them, one rounding on every page
  // (wording follow-up n01, n02), also for a month with uneven pay held back (the Dashboard says $3,643 there too, review D1); only the
  // full-month sentence is "about", to the $10 (spare.fullAbout). Goal amounts and estimates stay at the $10 their own pages show.
  const mo = exact;
  const inc = computeIncome(plan, { today }), exp = computeExpenses(plan, { today });
  // what is missing, in words (`missing`) and as the pages that fill it (`needs`, in the same order: the view's one filled
  // button goes to the first, so it never opens a page that is already done; stress test 2026-11-11, p-overview-home/x-1)
  const needs = [];
  if (!inc.count) needs.push({ key: "income", words: "what comes in, on the Income page", label: "Add what comes in", go: ["cashflow", "income"] });
  if (!exp.count) needs.push({ key: "expenses", words: "what goes out, on the Expenses page", label: "Add what goes out", go: ["cashflow", "expenses"] });
  if (needs.length) return { ready: false, missing: needs.map((x) => x.words), needs };

  // the money left each month: pay after tax, less spending, less what already goes to retirement and goals. The tax is
  // the month's one tax figure (Budget's yearTaxes, round 4, 2026-11-02): federal income tax with half the self-employment
  // tax and the business deduction off, Social Security and Medicare (self-employment tax and the extra 0.9% included),
  // and the state's income tax at the State page's rate, so every page that shows the month says the same; the simple
  // reckoning below is kept only for a plan that tax cannot be worked out for
  let T = null;
  try { T = yearTaxes(plan, { today, inc }); } catch { T = null; }
  let federalYear, payroll, stateYear = 0, stateKnown = false, businessCosts = 0, careLost = 0, rentCosts = 0, rentLoan = 0, rentOwn = 0;
  // the child care account's money it would lose (no care to pay back, Form 2441 line 14) never reaches the bank: Budget's
  // yearTaxes `careLost`, taken off as Budget takes it (care fourth pass)
  if (T) { federalYear = T.federal; payroll = T.payroll; stateYear = T.state; stateKnown = T.stateKnown; businessCosts = T.business?.expenses ?? 0; careLost = T.careLost ?? 0; rentCosts = T.rentCosts ?? 0; rentLoan = T.rentLoan ?? 0; rentOwn = T.rentOwn ?? 0; }
  else {
    const fed = computeFederal(plan, { today });
    const base = fed.params.ssWageBase ?? Infinity;
    payroll = 0;
    for (const p of new Set(inc.active.map((x) => x.personId))) {
      const wages = inc.active.filter((x) => x.personId === p && (x.type === "salary" || x.type === "bonus")).reduce((s, x) => s + x.yearly, 0);
      const business = inc.active.filter((x) => x.personId === p && x.type === "business").reduce((s, x) => s + x.yearly, 0);
      payroll += Math.min(wages, base) * FICA.ss + wages * FICA.medicare + Math.max(0, business) * FICA.seBase * FICA.selfEmployed;
    }
    federalYear = fed.result.totalTax;
  }
  const con = computeContributions(plan, { today });
  const gl = computeGoals(plan, { today });
  const goalSaving = gl.goals.filter((g) => g.status !== "done").reduce((s, g) => s + (Number(g.monthly) || 0), 0);
  // a rental typed only on Rental analysis brings its rent in too (yearTaxes `rentOwn`; left2 fix round 2, N-1): in "Pay and
  // other income", its empty months and costs on the rental line
  const spare = { gross: inc.monthly + rentOwn / 12, businessCosts: businessCosts / 12, federalTax: federalYear / 12, payrollTax: payroll / 12, stateTax: stateYear / 12, careLost: careLost / 12, rentCosts: rentCosts / 12, rentLoan: rentLoan / 12, rentOwn: rentOwn / 12, stateKnown, state: plan.household?.state ?? "",
    spending: exp.monthly, retirementSaving: con.yearly / 12, goalSaving };
  // the saved debt plan (Pay off debts): an extra a month on top of the required payments is money already spoken for, until
  // the debts it is aimed at are gone (all of them, when it is aimed at none: it rolls from one to the next)
  // (Pay off debts' savedPlan: the one reading Budget (50/30/20) takes too, review 2026-11-02, round 5)
  const saved = savedPlan(plan, { today });
  const { ends: planEnds = [], ...debtPlanRest } = saved ?? {};
  const debtPlan = saved ? debtPlanRest : null;
  spare.debtExtra = debtPlan ? debtPlan.extra : 0;
  // uneven pay counted carefully (Side income's "count on"): the rest of it is not planned with, and neither is the tax
  // set aside from it (a lean month sets aside less), so the month is the careful income less the tax on the careful
  // income. The tax lines stay the whole year's, as every tax page says them; `held` is the part not counted on after its
  // tax: the year's taxes worked again with the careful figures, the difference taken off it (Budget's heldAfterTax, beside
  // yearTaxes, so Budget (50/30/20) takes the same careful month; review 2026-11-02)
  { const H = heldAfterTax(plan, { today, inc, T }); spare.heldGross = H.gross; spare.held = H.held; }
  spare.monthly = spare.gross - spare.businessCosts - spare.federalTax - spare.payrollTax - spare.stateTax - spare.careLost - spare.rentCosts - spare.rentLoan - spare.spending - spare.retirementSaving - spare.goalSaving - spare.debtExtra - spare.held;
  // what a month that brings the Income page's amount leaves (the careful month plus what it holds back), and that figure
  // to the nearest $10 (fullAbout), the one every page that says it shows (review 2026-11-02, round 5: Next best action
  // and Health score said "about $1,200", the Dashboard, Expenses, Budget and Needs attention "$1,197")
  spare.full = spare.monthly + spare.held;
  spare.fullAbout = aboutTen(spare.full);
  // ahead / even (within $5 of $0: "just about breaks even", never "about $0") / short, the one reading every page words
  spare.fullKind = fullKind(spare.full);
  // spending that is mostly our guesses (Get started's guessed rows, Expenses' guessedShare): the left-over figure waits for
  // the real spending (spec 8.1) -- it is still worked out, but no verdict, no dates and no "short" rest on it
  if (exp.guessedMonthly !== undefined) { spare.guessedShare = exp.guessedShare; spare.guessedMonthly = exp.guessedMonthly; spare.waits = exp.guessedShare >= 0.5; }
  // spending worked out from a left-over the person gave (guide.setup.spendLeft, Get started question 6 or Expenses): the month's
  // money left is theirs, not a guess, so the figure does not wait, whatever else in the month is still a guess (the rows
  // absorbed it). `fromLeft` is the note while its rows are as we wrote them (core/math/leftover.js leftMarker).
  const note = leftMarker(plan);
  if (note) { spare.waits = false; spare.fromLeft = note; }
  // what the month builds up over a year, said once for every page (core/math/leftover.js yearSaving)
  spare.year = yearSaving(spare);
  spare.leftOver = leftOverOf(spare);   // the left-over as a person means it (before goal saving, the month all uneven pay comes in): what a typed left-over is worked against

  const liq = computeLiquidity(plan, { today });
  const debts = computeLiabilities(plan, { today }).rows.filter((r) => r.owed > 0);
  const accounts = plan.accounts ?? [];
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const L = con.limits.kinds;
  const steps = [];
  const add = (s) => steps.push({ gap: null, roomYearly: null, doneDate: null, startDate: null, monthly: null, capacity: null, ...s });

  // 0. the bills. A retired household living on its savings as the plan intends is not overspending: it is done.
  // Short on the careful month (uneven pay counted at what you can count on): said so, with what a month that brings the
  // Income page's amount leaves (spare + held), and the way out without a goal to pause when there is none (review 2026-11-02)
  const careful = spare.held > 0.5, fullMonth = spare.full, fullIs = spare.fullKind;
  const ways = ["Trim spending", ...(spare.debtExtra ? ["lower that extra"] : []), ...(spare.goalSaving > 0.5 ? ["pause a goal"] : [])];
  const waysWords = ways.length > 1 ? `${ways.slice(0, -1).join(", ")} or ${ways[ways.length - 1]}` : ways[0];
  const shortWords = `About ${mo(-spare.monthly)} a month more goes out than comes in, after tax and saving${spare.debtExtra ? `, counting the ${mo(spare.debtExtra)} a month extra on debts (Pay off debts)` : ""}`;
  const shortDetail = !careful ? `${shortWords}. ${waysWords} first.`
    : fullIs === "ahead" ? `${shortWords}, with uneven pay counted at what you can count on (Side income). A month that brings the Income page's amount leaves about ${money(fullMonth)}, so good months make up for lean ones; to be safe in a lean month, ${waysWords.charAt(0).toLowerCase()}${waysWords.slice(1)}.`
      : `${shortWords}, with uneven pay counted at what you can count on (Side income); even a month that brings the Income page's amount ${fullIs === "even" ? "only just about breaks even" : `is about ${money(-fullMonth)} short`}. ${waysWords} first.`;
  let drawing = null;
  if (spare.monthly < 0) { try { drawing = drawingAsPlanned(plan, { today }); } catch { drawing = null; } }
  if (spare.waits) add({ id: "bills", title: "Type what you really spend", why: "Most of your spending is our guesses, and they decide whether your month works.", status: "now", waits: true,
    detail: `${spare.spending - spare.guessedMonthly < 5 ? `All ${mo(spare.spending)} a month of your spending is our guesses for now` : `About ${mo(spare.guessedMonthly)} of your ${mo(spare.spending)} a month of spending is our guesses`}, so what is left each month is not known yet. With our guesses it would be about ${money(Math.abs(spare.monthly))} ${spare.monthly < 0 ? "short" : "spare"}. Type what you really spend to see what's really left.`, go: ["cashflow", "expenses"] });
  else if (drawing) add({ id: "bills", title: "Spend within what the plan can pay for", why: "In retirement the savings pay part of each month: that is what they are for.", status: "done",
    detail: `About ${mo(-spare.monthly)} a month comes from savings, as planned. If markets do as well as average, the plan can pay for about ${money(drawing.affordableMonthly)} a month of spending in all, and the money lasts (see the Will the money last? page).`, go: ["retirement", "projection"] });
  else add({ id: "bills", title: "Spend less than you bring in", why: "Nothing else works until the month ends with money left.", status: spare.monthly >= 0 ? "done" : "now",
    detail: spare.monthly >= 0 ? (spare.debtExtra && spare.monthly < 5 ? `Every dollar has a job: after tax, spending and what already goes to savings, the rest is the ${mo(spare.debtExtra)} a month extra on debts.` : `About ${mo(spare.monthly)} a month is left after tax, spending and what already goes to savings${spare.debtExtra ? ` and the ${mo(spare.debtExtra)} extra on debts` : ""}${spare.held > 0.5 ? ", counting uneven pay at what you can count on" : ""}.`)
      : shortDetail, go: ["cashflow", "expenses"] });

  // 0b. a household no paycheck takes tax from (a freelancer): this year's tax on what is already earned is the IRS's money,
  // so the cushion steps below leave it out (Liquidity's taxOwed, from Estimated payments' taxOwedNow); an estimated payment
  // past due comes first, before any cushion or debt (round 4, 2026-11-02: the Dashboard said "Pay down the cards first"
  // while $8,400 of estimated tax was past due)
  const owed = liq.tax;
  if (owed && (owed.overdue || liq.taxOwed > 0.5)) {
    const nextWords = owed.nextDue && owed.nextDue.amount > 0.5 ? `${exact(owed.nextDue.amount)} by ${dayWords(owed.nextDue.due)}` : null;
    // no payments ever typed: the first thing is to say what was paid, not to be told it is all past due (review 2026-11-02)
    if (owed.overdue && !owed.paidTyped) add({ id: "tax", title: "Type or pay this year's estimated tax", why: "No paycheck takes your tax out, so it is paid four times a year; a late payment is charged interest for every day it is late.", status: "now",
      gap: Math.max(0, owed.overdue.amount - liq.taxOwed), doneDate: owed.overdue.amount - liq.taxOwed < 0.5 ? today : null,
      detail: `No estimated payments are typed for ${owed.year} yet. If none were made, ${exact(owed.overdue.amount)} of this year's federal tax was due by now (the first part on ${dayWords(owed.overdue.due)}): pay it at irs.gov/payments${owed.overdue.amount - liq.taxOwed < 0.5 ? " from the cash kept apart for tax" : ""}. Either way, type what you paid on Estimated payments.${nextWords ? ` The next payment is ${nextWords}.` : ""}`, go: ["taxes", "estimated"] });
    else if (owed.overdue) add({ id: "tax", title: "Pay the estimated tax that is past due", why: "A late payment is charged interest for every day it is late; it comes before any saving or extra on debt.", status: "now",
      // the cash already set apart for tax pays it today; only what the cash cannot cover waits for the money left each month
      gap: Math.max(0, owed.overdue.amount - liq.taxOwed), doneDate: owed.overdue.amount - liq.taxOwed < 0.5 ? today : null,
      detail: `${exact(owed.overdue.amount)} of this year's federal tax is past due (the first part since ${dayWords(owed.overdue.due)}). Pay it at irs.gov/payments${owed.overdue.amount - liq.taxOwed < 0.5 ? " from the cash kept apart for tax" : ""}, then type it on Estimated payments.${nextWords ? ` The next payment is ${nextWords}.` : ""}`, go: ["taxes", "estimated"] });
    else add({ id: "tax", title: "This year's tax, kept apart", why: "No paycheck takes your tax out, so part of what comes in belongs to the IRS.", status: "done", gap: 0,
      detail: `About ${money(liq.taxOwed)} of your cash is federal tax on what you have earned this year, so the steps below leave it out. Put about ${money(owed.monthly)} a month aside for this tax${nextWords ? `; the next payment is ${nextWords}` : ""}.`, go: ["taxes", "estimated"] });
  }

  // 0c. this year's required withdrawal (round 8 item 40): a dated must-do, shown from October while it is not marked taken,
  // as Needs attention shows it (Required withdrawals' thisYear: amount, accounts, deadline). Missing it costs 25% of what was
  // not taken, 10% if put right within two years (IRS, Retirement plan and IRA required minimum distributions FAQs, read
  // 2026-11-06). It takes none of the spare money, so it changes no other step's date; it comes before the cushion because
  // its date is fixed. Before, a retiree in November was told to build the cushion and never told about December 31.
  // Someone still working: the 401(k) at that job can wait until they retire (review D5, rmdNow below), so the amount is the
  // rest's, and the words say which account waits
  const rmdDue = today && Number(String(today).slice(5, 7)) >= 10 ? rmdNow(plan, { today }) : [];
  if (rmdDue.length) {
    const y = Number(String(today).slice(0, 4));
    const whose = (r) => (rmdDue.length > 1 ? `${isYou(r.name) ? "Yours" : r.name}: ` : "");
    add({ id: "rmd", title: rmdDue.length > 1 ? "Take this year's required withdrawals" : "Take this year's required withdrawal",
      why: "From your 70s the law sets a smallest amount you must take out of retirement accounts each year; missing it costs 25% of what was not taken.", status: "now",
      detail: `${rmdDue.map((r) => `${whose(r)}take at least ${exact(r.amount)} from ${listWords(r.accounts.map((a) => accountWords(a.name)))}${r.estimated ? " (worked out from today's balance)" : ""} by ${r.first ? `April 1, ${y + 1}, or by December 31 so two do not fall in ${y + 1}` : "December 31"}.${waitWords(r)}`).join(" ").replace(/^t/, "T")} You can ask the account to hold back tax from it (they will have a form), so less is owed in April. Tap "I've taken it" on Required withdrawals once it is done.`,
      go: ["retirement", "rmd"] });
  }
  // every adult retired (People: past the retirement age) and no one paid for work: the cushion is for surprise bills, not a
  // job loss (item 40); someone still working past the age keeps the job-loss reason
  const ppl = computePeople(plan, { today });
  const paidWork = (inc.active ?? []).some((x) => x.type === "salary" || x.type === "bonus" || x.type === "business");
  const allRetired = !paidWork && ppl.people.some((p) => p.role !== "dependent") && ppl.people.filter((p) => p.role !== "dependent").every((p) => p.retired === true);

  // 1. a starter emergency fund: one month of the bills you have to pay in cash you can use
  const essential = liq.expenses?.essentialMonthly ?? exp.essentialMonthly;
  // under half a dollar short is done: the page shows whole dollars, so typing the amount it asks for must finish the step
  const starterGap = essential - liq.now < 0.5 ? 0 : essential - liq.now;
  // the must-pay bills are mostly our guesses (liquidity `waits`, spec 8.1): a cushion step is never ticked done on them, and
  // what it says rests on them says so ("by our guesses of your bills"); the step itself stays
  const guessedBills = liq.waits === true;
  const byGuess = guessedBills ? ", by our guesses of your bills" : "";
  // (and the amounts to $100, as Get started's cushion says them: they are not known to the $10)
  const cushionMoney = guessedBills ? (n) => fmtMoney(Math.round(n / 100) * 100, cur) : exact;
  add({ id: "starter", title: "A starter emergency fund", why: "One month of the bills you have to pay in cash, so a surprise does not land on a credit card.", status: starterGap <= 0 ? "done" : "now", gap: starterGap,
    ...(guessedBills ? { waits: true } : {}),
    detail: starterGap <= 0 ? (guessedBills ? `Usable cash ${mo(liq.now)} covers about ${monthsNear(liq.runwayMonths ?? 0, liq.targetMonths)} of the bills you have to pay${byGuess}.` : `Usable cash ${mo(liq.now)} covers a month of the bills you have to pay (${mo(essential)}).`) : `${cushionMoney(starterGap)} more in usable cash reaches one month of the bills you have to pay (${cushionMoney(essential)}${byGuess}).`, go: ["balance", "liquidity"] });

  // 1b. the people who count on an earner: life cover for the gap Life insurance needs works out (its own answer: the
  // survivor's plan kept whole), right after the starter cushion; an action, not a sum to save, so no gap is filled
  const gaps = protectionGaps(plan, { today });
  // no child, and the plan together runs out anyway (Life insurance needs' eitherWay): the cover only keeps the survivor's
  // money lasting as long as the plan together's, so it comes after costly debt and the match, not first (round 8 item 14,
  // kept when the verify put the need back: Priya's $28,000 is real, but it is not the couple's first move)
  const protectLater = gaps.length > 0 && gaps.every((g) => g.eitherWay) && !(plan.household?.people ?? []).some((q) => q.role === "dependent");
  // the words come from Life insurance needs (protectionGaps' title and sentence), so every page says the same thing
  const protectStep = () => add({ id: "protect", title: "Protect the people who count on you", why: "If an earner died, life insurance keeps the family's plan whole. Term life insurance is the cheap way to buy it.", status: "now", gap: null,
    people: gaps.map((g) => ({ personId: g.id, name: g.name, who: g.who, whose: g.whose, gap: g.gap, cover: g.cover, until: g.until, depends: g.depends, ending: g.endsSoon.length > 0, title: g.title, sentence: g.sentence })),
    // resting on our guesses of the spending: said once, after every person's sentence (C3 fix walk)
    detail: (gaps.length > 1 && gaps.some((g) => g.rough) ? gaps.map((g) => g.sentence.replace(RESTS_ON, "")).join(" ") + RESTS_ON : gaps.map((g) => g.sentence).join(" ")) + " Add insurance you already have, including any through work, on Policies.",
    go: ["insurance", "life-needs"] });
  if (gaps.length && !protectLater) protectStep();

  // 2. the employer match: a 401(k) marked as from a job left (`formerJob`) takes no new money, and a person who said their
  // job has no plan or no match (`retirement.workPlans[id].match === false`) has nothing to check
  const k401 = accounts.filter((a) => a.type === "401k");
  const atWork = k401.filter((a) => !a.formerJob);
  // match tiers typed on Open enrollment (career/benefits) say it more exactly; without them, the answer on Contributions
  const noMatch = (id) => { const t = plan.whatIfs?.benefits?.[id]?.matchTiers; return Array.isArray(t) ? !t.some((x) => Number(x.rate) > 0 && Number(x.upTo) > 0) : plan.retirement?.workPlans?.[id]?.match === false; };
  const paid = (p) => inc.active.some((x) => x.personId === p.id && (x.type === "salary" || x.type === "bonus"));
  const ownOf = (p) => k401.filter((a) => a.ownerId === p.id || (p.role === "self" && !a.ownerId));
  // a paid adult whose every 401(k) is from a job left: the job now may have a plan with a match, so it is still asked
  // (unless they said there is none); `newJob` in the ask, with no accounts to put money in yet
  const leftOnly = adults.filter((p) => { const own = ownOf(p); return own.length && own.every((a) => a.formerJob) && paid(p) && !noMatch(p.id); });
  // a paid adult (salary or bonus: a business owner or freelancer has no employer to match) with no 401(k) or 403(b) on file
  // at all: the job may have a plan with a match (round 8 item 1: the step only existed once a 401(k) account did, so a
  // worker with nothing in it yet was never asked). Each one's figures are Work benefits' own (career/benefits, light: no
  // paycheck runs): the typed match, else the common one (50% up to 6%), the share of pay that gets all of it, a paycheck's
  // amount and what take-home pay falls by
  // (a salary: a bonus alone, such as a freelancer's year-end client bonus, is no job with a plan to ask about)
  const salaried = (p) => inc.active.some((x) => x.personId === p.id && x.type === "salary");
  // a Roth 401(k) at work is filed as type "roth": Contributions counts it with the 401(k) when it has a match or its name says
  // 401(k), 403(b), 457 or TSP (limitKind, IRC 402A(c)(2)), and so does this step: an adult with one is not asked as if there
  // were no plan (review D3, 2026-11-06)
  const workRoth = (p) => accounts.some((a) => a.type === "roth" && !a.formerJob && (a.ownerId === p.id || (p.role === "self" && !a.ownerId)) && limitKind(a.type, a.name, 0) === "401k")
    || (con.items ?? []).some((c) => c.personId === p.id && c.limitKind === "401k");
  const fresh = adults.filter((p) => !ownOf(p).length && !workRoth(p) && salaried(p) && !noMatch(p.id)).map((p) => ({ p, ...freshMatch(plan, p, today) }));
  let matchStep = null;   // set when the match step waits until after costly debt
  if (atWork.length || leftOnly.length || fresh.length) {
    const owners = adults.filter((p) => atWork.some((a) => a.ownerId === p.id) || (p.role === "self" && atWork.some((a) => !a.ownerId)));
    const working = owners.filter((p) => !noMatch(p.id) && paid(p));
    // a row Get started made with nothing going in and nothing from the employer (None, or our guess that people like them do not
    // put anything in yet) is not "contributing": the match is still free money to ask about (C4)
    const zeroSetup = (c) => typeof c.id === "string" && c.id.startsWith("setup-contrib-") && !(Number(c.amount) > 0) && !(Number(c.employerMatch) > 0)
      && (isGuess(plan, `retirement.contributions[${c.id}].amount`) || plan.guide?.setup?.saving?.[c.personId]?.pct === 0);
    const contributing = working.filter((p) => (plan.retirement?.contributions ?? []).some((c) => c.personId === p.id && k401.some((a) => a.id === c.accountId) && !zeroSetup(c)));
    const matched = contributing.filter((p) => (plan.retirement?.contributions ?? []).some((c) => c.personId === p.id && Number(c.employerMatch) > 0));
    const missing = working.filter((p) => !contributing.includes(p));
    // a 401(k) on file with nothing going in, whose match is typed on Work benefits or who said the job has a plan with a match
    // (Get started, or "Yes" on Contributions): the same answer as with no 401(k) ("put in 3% ... to get $1,170"), with its
    // 401(k) to start, not the question again (review UX 3: the app forgot a typed match once the account was on file, and
    // asked "Does Priya's job match?" right after "Yes")
    const onFile = missing.map((p) => ({ p, ...freshMatch(plan, p, today) })).filter((x) => x.kind !== "ask");
    const missingMatch = missing.filter((p) => !onFile.some((x) => x.p === p));
    const toAsk = [...missingMatch, ...leftOnly];
    const accountsOf = (p) => atWork.filter((a) => a.ownerId === p.id || (p.role === "self" && !a.ownerId)).map((a) => a.id);
    // said in Get started that the job has a retirement plan (question 2), or the only 401(k) is the empty one it made: it is not
    // "a 401(k) from a job left", so that is not asked, and the words say what was said (C4, batch 3's UX 6)
    const saidPlan = (p) => plan.retirement?.workPlans?.[p.id]?.plan === true || (accountsOf(p).length > 0 && accountsOf(p).every((id) => { const a = accounts.find((x) => x.id === id); return String(id).startsWith("setup-workplan-") && !(Math.abs(Number(a?.balance) || 0) > 0); }));
    // a 401(k) whose contribution is our guess, short of the share of pay that gets the whole usual match: "put in 6% ($290) to
    // likely get about $190" (C4). Typed contributions keep the words they had.
    const MT = matchTerms();
    const year = Number(String(today ?? "2026-01-01").slice(0, 4));
    const raise = [], shortTyped = [];
    for (const p of contributing) {
      const c = (plan.retirement?.contributions ?? []).find((x) => x.id === `setup-contrib-${p.id}` && x.period === "monthly");
      const pay = jobPayOf(plan, p.id, today);
      if (!c || !(pay > 0)) continue;
      const guessedPut = isGuess(plan, `retirement.contributions[${c.id}].amount`), guessedMatch = isGuess(plan, `retirement.contributions[${c.id}].employerMatch`);
      // a match the person typed ("I know it") is not argued with; a formula typed on Work benefits decides what gets all of it
      if (!guessedMatch && Number(c.employerMatch) > 0) continue;
      const tiers = typedTiers(plan, p.id), comp = Math.min(pay, compLimit(year));
      const needed = tiers ? fullMatchAt(tiers) : MT.needed, cap = deferralLimit(ageInYear(plan, p.id, year), year);
      const needYearly = needed * comp;
      const now = Number(c.amount) * 12 / pay;
      // already at (or past) the share that gets it all, or the whole limit goes in already: nothing to say
      if (Number(c.amount) * 12 >= needYearly - 6 || (cap && needYearly > cap) || (cap && Number(c.amount) * 12 >= cap - 6)) continue;
      const wantMonthly = Math.round(needYearly / 12);
      const wantMatch = tiers ? Math.round(matchAt(needed, tiers) * comp / 12 / 10) * 10 : Math.round(MT.value * comp / 12 / 10) * 10;
      const rate = usualShare(plan, p.id, today);
      const x = { p, rowId: c.id, accountId: c.accountId, nowPct: guessedPut && rate !== null && Math.abs(rate - now) < 0.003 ? rate : now, nowMonthly: Number(c.amount), wantPct: needed, wantMonthly, wantMatch, more: Math.max(0, wantMonthly - Number(c.amount)), formula: !!tiers };
      if (guessedPut) raise.push(x); else if (guessedMatch && !tiers) shortTyped.push(x);
    }
    const raiseWords = raise.map((x) => `${NameOf(x.p.name)} 401(k): put in ${share(x.wantPct)} of pay (${exact(x.wantMonthly)} a month${x.more >= 5 ? `, about ${exact(x.more)} more than the ${exact(x.nowMonthly)} we guess goes in now` : ""}) to ${x.formula ? "get" : "likely get"} about ${exact(x.wantMatch)} a month from the employer${x.formula ? " (the match you typed on Work benefits)" : USUAL_NOTE}.`).join(" ")
      + shortTyped.map((x) => ` ${NameOf(x.p.name)} 401(k): ${isYou(x.p.name) ? "you put in" : "puts in"} ${share(Math.round(x.nowPct * 1000) / 1000)} of pay (${exact(x.nowMonthly)} a month). Many employers add their full match at ${share(x.wantPct)} (${exact(x.wantMonthly)} a month). Check your pay stub, and if it does, that is worth about ${exact(x.wantMatch)} a month.`).join("");
    // what starting it takes from take-home pay a month (review D2): the amount a paycheck less the income tax it saves (Work
    // benefits' costPerCheck; Social Security and Medicare still apply, IRC 3121(v)(1)(A)), times the paychecks, over 12. The
    // month-by-month run below takes it from the spare money in the step's place, so every step after it moves by it
    const starting = [...onFile, ...fresh].filter((x) => x.kind !== "ask" && x.match);
    const monthlyCost = starting.reduce((t, x) => t + (Number(x.match.take) || 0) * (Number(x.match.paychecks) || 0), 0) / 12;
    const leftNames = leftOnly.map((p) => p.name);
    const left = !leftOnly.length ? "" : leftNames.every(asTyped) ? ` ${leftNames.join(" and ")}'s 401(k) is from a job you left: check whether the job now has a plan with a match.`
      : leftNames.length === 1 ? ` ${NameOf(leftNames[0])} 401(k) is from a job you left: check whether the job now has a plan with a match.`
      : ` ${leftNames.map((n, i) => (i ? nameOf(n) : NameOf(n))).join(" and ")} 401(k)s are from jobs left: check whether the jobs now have a plan with a match.`;
    const had = working.length || leftOnly.length;
    const planned = missingMatch.filter(saidPlan), otherMissing = missingMatch.filter((p) => !saidPlan(p));
    const plannedWords = !planned.length ? "" : planned.length === 1 ? `${NameOf(planned[0].name)} job has a retirement plan (you said so in Set up my plan), but nothing goes into it yet.` : `${whoLeads(planned.map((p) => p.name))} each have a job with a retirement plan (you said so in Set up my plan), but nothing goes into them yet.`;
    const missingWords = otherMissing.length ? `${whoLeads(otherMissing.map((p) => p.name))} ${otherMissing.length === 1 ? verbFor(otherMissing[0].name, "has", "have") : "have"} a 401(k) and pay but no contribution on file.` : "";
    const before = !had ? "" : toAsk.length ? `${[plannedWords, missingWords].filter(Boolean).join(" ")}${missingMatch.length ? ` Check whether the employer matches, and put in at least enough to get all of it.${otherMissing.length ? " If the 401(k) is from a job you left, or there is no match, say so on Retirement contributions." : " If there is no match, say so on Retirement contributions."}` : ""}${left}`.trim() : !contributing.length ? ""
      // (with a 401(k) still to start, "Everyone with a 401(k)" would not be true: those who put money in, by name)
      : (() => {
        const who = matched.length ? matched : onFile.length ? contributing : [];
        const many = who.length > 1 || (who.length === 1 && isYou(who[0].name));
        // what goes in and the match are both our guesses: said as ours, not as a fact (follow-up F3)
        const row = (p) => (plan.retirement?.contributions ?? []).find((c) => c.id === `setup-contrib-${p.id}`);
        const ours = who.length > 0 && who.every((p) => { const c = row(p); return c && isGuess(plan, `retirement.contributions[${c.id}].amount`) && (!matched.includes(p) || isGuess(plan, `retirement.contributions[${c.id}].employerMatch`)); });
        const lead = whoLeads(who.map((p) => p.name)) || "Everyone with a 401(k)";
        const said = ours ? `By our guess, ${lead} ${many ? "put" : "puts"} money in${matched.length ? ` and ${many ? "get" : "gets"} a match` : ""}.` : `${lead} ${many ? "put" : "puts"} money in${matched.length ? " with a match" : ""}.`;
        return `${said} If the employer would match more, raise the contribution to get every dollar.`;
      })();
    const asking = fresh.filter((x) => x.kind === "ask");
    // only a question (no 401(k) on file, no typed match, no plan we know of, and nothing to do for a 401(k) on file): it is
    // asked right after costly debt, not before it -- a sure 20%+ on a card today beats a match that may not exist (round 8
    // item 1); a known match, or a 401(k) on file with no contribution, keeps its place ahead of the cards
    const onlyAsk = !toAsk.length && !onFile.length && fresh.length > 0 && asking.length === fresh.length;
    // the month has less than starting it takes (review D2: following the move made the renter's month $80 short with no word):
    // where the money comes from -- the saved extra on debts first (the match adds 50% or 100% at once, more than any debt's
    // interest costs), then trimming spending; while the spending is mostly our guesses, only what it takes
    const costWords = () => {
      if (monthlyCost < 0.5) return "";
      const has = Math.max(0, spare.monthly), short = monthlyCost - has;
      // (to the dollar: these are small sums, and $83 against $3 is the point)
      const first = `${starting.every((x) => x.kind === "known") ? "This takes" : "That would take"} about ${exact(monthlyCost)} a month from take-home pay`;
      if (spare.waits || short < 5) return `${first}.`;
      const rate = Math.max(...starting.map((x) => Math.max(0, ...(x.match.tiers ?? []).map((t) => Number(t.rate) || 0))));
      const fromExtra = Math.min(spare.debtExtra || 0, short), trim = short - fromExtra;
      const names = debtPlan?.names?.length && debtPlan.names.length <= 2 ? listWords(debtPlan.names) : "debts";
      const extraWords = fromExtra >= 5 ? `put ${fromExtra < spare.debtExtra - 5 ? `about ${exact(fromExtra)} of ` : ""}the ${exact(spare.debtExtra)} a month extra on ${names} (Pay off debts) toward it instead${rate > 0 ? ` (the match adds ${share(rate)}, more than any debt costs)` : ""}` : "";
      const trimWords = trim >= 5 ? `trim about ${exact(trim)} a month of spending` : "";
      return `${first}, and ${has >= 1 ? `about ${exact(has)} is left each month` : "the month has nothing spare"}: ${[extraWords, trimWords].filter(Boolean).join(" and ")}.`;
    };
    matchStep = () => add({ id: "match", title: "Get the whole employer match", why: "A match is an instant 50% or 100% return; nothing else comes close.", status: toAsk.length || asking.length ? "check" : fresh.length || onFile.length || raise.length || shortTyped.length ? "now" : "done",
      detail: (() => {
        const fw = freshWords([...onFile, ...fresh], { exact, money });
        // one usual match in a step: when the common 50% up to 6% is named, the raise does not say "about 4% of pay" too (follow-up F2)
        return [before, fw, fw.includes(COMMON) ? raiseWords.replaceAll(USUAL_NOTE, "") : raiseWords, costWords()].filter(Boolean).join(" ");
      })(),
      // the take-home pay it takes a month, and the same a year for the run below (a step with room takes up to it a month)
      ...(monthlyCost >= 0.5 ? { monthlyCost, roomYearly: monthlyCost * 12 } : {}),
      ask: [...missingMatch.map((p) => ({ personId: p.id, name: p.name, accounts: accountsOf(p), ...(saidPlan(p) ? { saidPlan: true } : {}) })),
        ...leftOnly.map((p) => ({ personId: p.id, name: p.name, accounts: [], newJob: true, old: ownOf(p).map((a) => a.id) })),
        // a 401(k) on file and the match known or a plan said: Contributions starts what goes in, in one tap
        ...onFile.map((x) => ({ personId: x.p.id, name: x.p.name, accounts: accountsOf(x.p), kind: x.kind, match: x.match, monthlyCost: x.match ? (Number(x.match.take) || 0) * (Number(x.match.paychecks) || 0) / 12 : 0 })),
        // no 401(k) on file: Retirement contributions asks, and one tap there starts the 401(k) (round 8)
        ...fresh.map((x) => ({ personId: x.p.id, name: x.p.name, accounts: [], noAccount: true, kind: x.kind, match: x.match, monthlyCost: x.kind !== "ask" && x.match ? (Number(x.match.take) || 0) * (Number(x.match.paychecks) || 0) / 12 : 0 })),
        // a contribution that is our guess, short of the whole match: Contributions puts in the share that gets all of it in one tap
        ...raise.map((x) => ({ personId: x.p.id, name: x.p.name, accounts: [x.accountId], kind: "guessed", rowId: x.rowId, nowPct: x.nowPct, nowMonthly: x.nowMonthly, wantPct: x.wantPct, wantMonthly: x.wantMonthly, wantMatch: x.wantMatch }))],
      // (for Contributions' and Work benefits' cards: the sentence, and whether the month has less than it takes)
      ...(monthlyCost >= 0.5 ? { costWords: costWords(), costShort: !spare.waits && monthlyCost - Math.max(0, spare.monthly) >= 5 } : {}), go: ["retirement", "contributions"] });
    if (!had && !fresh.length && !raise.length && !shortTyped.length) matchStep = null;
    else if (!onlyAsk) { matchStep(); matchStep = null; }
  }

  // 3. expensive debt, most expensive first (mortgages left out)
  // a debt the saved debt plan's extra reaches is being paid off already: the step is under way, with the month the last
  // of them is gone (Pay off debts' own date), and no spare money is counted for it twice; one it does not reach stays to do
  const endOf = (id) => planEnds.find((x) => x.id === id);
  const reached = (d) => !!debtPlan && debtPlan.ids.includes(d.id) && Number.isFinite(endOf(d.id)?.months);
  const debtStep = (list) => {
    const on = list.filter(reached), off = list.filter((d) => !reached(d));
    const ends = on.map((d) => endOf(d.id)).sort((a, b) => a.months - b.months);
    const until = ends.length ? ends[ends.length - 1].endDate : null;
    const names = on.map((d) => d.name);
    const sentence = on.length && until ? `${money(debtPlan.extra)} a month extra already goes to ${listWords(names)} (Pay off debts), on top of the required payments: ${on.length === 1 ? "it is" : "they are"} gone by about ${monthWords(until)}.` : "";
    return { on, off, until, names, sentence, gap: off.reduce((s, d) => s + d.owed, 0) };
  };
  const high = debts.filter((d) => d.rate !== null && d.rate >= HIGH_RATE && d.type !== "mortgage").sort((a, b) => b.rate - a.rate);
  const hs = debtStep(high);
  const highGap = hs.gap;
  const highWords = (list) => `${list.map((d) => `${d.name} ${money(d.owed)} at ${pct(d.rate)}`).join(", ")}`;
  // usable cash above the full cushion pays costly debt today: the standard first move, a sure return at the debt's rate, and
  // the cushion stays full (round 4, 2026-11-02; before, the card was scheduled from the monthly left-over even when savings
  // could clear it now). Review fixes 2026-11-02: one-off costs coming up lower the cash but one-off income never raises it
  // (it may be in the balances already); no must-pay bills marked means the cushion is unknown, so nothing is offered; the
  // whole balance is said exactly when savings cover it (no $10 crumbs left at 23.9%); and a saved debt plan aimed at the
  // card no longer hides this when the cash is there.
  const cash = Math.min(liq.now ?? 0, liq.nowAfterOneOffs ?? liq.now ?? 0);
  // (never on bills that are mostly our guesses: money is not moved out of the cushion on our guesses; spec 8.1)
  const above = (liq.target ?? 0) > 0 && essential > 0 && !guessedBills ? Math.max(0, cash - liq.target) : 0;
  const highOwed = high.reduce((t, d) => t + d.owed, 0);
  const savingsCover = above >= 100 && highOwed > 0;
  if (high.length && !hs.off.length && hs.until && !savingsCover) add({ id: "high-debt", title: "Pay off expensive debt", why: `Debt at ${Math.round(HIGH_RATE * 100)}% or more costs more than investing is likely to earn.`, status: "underway", gap: 0,
    underway: { extra: debtPlan.extra, names: hs.names, until: hs.until }, detail: `Under way. ${hs.sentence}`, go: ["debt", "payoff"] });
  else {
    const pays = savingsCover && hs.on.length ? high : hs.off;   // a debt the plan's extra reaches is paid from savings too
    const payOwed = pays.reduce((t, d) => t + d.owed, 0);
    const fromSavings = !savingsCover || payOwed <= 0 ? 0 : above >= payOwed ? payOwed : Math.floor(above / 10) * 10;
    const full = fromSavings > 0 && fromSavings >= payOwed - 0.5;
    const leftMonths = fromSavings ? (cash - fromSavings) / essential : null;
    const keep = `you would still have ${monthsWords(leftMonths)} of the bills you have to pay in cash (the plan aims for ${liq.targetMonths})`;
    const rates = [...new Set(pays.map((d) => pct(d.rate)))].join(" and ");
    const rest = Math.max(0, payOwed - fromSavings);
    const detail = !fromSavings && highGap <= 0 ? `No debt at ${Math.round(HIGH_RATE * 100)}% or more.`
      : full ? `Pay ${pays.length === 1 ? `the ${pays[0].name}'s ${exact(pays[0].owed)}` : `all ${exact(payOwed)} (${pays.map((d) => d.name).join(" and ")})`} from savings now: ${keep}. Paying it is a sure ${rates} return.${hs.sentence && pays === hs.off ? ` ${hs.sentence}` : ""}`
      : fromSavings ? `Pay ${money(fromSavings)} of the ${money(payOwed)} (${pays.map((d) => `${d.name} at ${pct(d.rate)}`).join(", ")}) from savings now: ${keep}. The other ${money(rest)} ${pays === hs.off ? "comes from what is left each month" : "keeps going on your payoff plan"}.${hs.sentence && pays === hs.off ? ` ${hs.sentence}` : ""}`
      : `${highWords(hs.off)}: every extra dollar you pay here saves you that interest rate, guaranteed.${hs.sentence ? ` ${hs.sentence}` : ""}`;
    add({ id: "high-debt", title: fromSavings ? "Pay off expensive debt from savings" : "Pay off expensive debt", why: `Debt at ${Math.round(HIGH_RATE * 100)}% or more costs more than investing is likely to earn.`, status: highGap > 0 || fromSavings > 0 ? "now" : "done",
      gap: Math.max(0, highGap - fromSavings), fromSavings, doneDate: full ? today : null, detail, go: ["debt", "payoff"] });
  }

  if (matchStep) matchStep();   // the match question, right after costly debt (above)
  if (protectLater) protectStep();   // cover that only matches the plan together's run-out (above)

  // 3b. goals with a date (round 8 item 3): each one behind its pace takes its extra a month (what it needs from today to its
  // date, Goals' neededMonthly, less what already goes in) from the spare money right after costly debt, before the full
  // cushion and the open-ended steps (HSA, IRA, middling debt, the 401(k)): a date is a promise, and a goal that starts late
  // needs more each month, while the cushion and those steps lose nothing by taking a little longer. Before, the goals came
  // last, so $64,000 of loans at 6.5% took every spare dollar until two months before a 3-year house goal's date. In the
  // Goal prioritizer's order (priority, then the nearest date). A goal whose date has passed is due now: no month's saving
  // (item 18). With no goal behind, the step stays last, as before.
  // The emergency fund goal is the cushion: the starter and full emergency fund steps fill it (as Needs attention reads it),
  // so it is not moved up with the dated goals (its money would be counted twice, and the full cushion's date pushed out by
  // money that builds the same cushion). With no other goal behind, the step stays last and reads as before.
  // (the goal ticked as the emergency fund on Emergency fund: Liquidity counts only its money as the cushion; one only named
  // like it, "Rainy day fund", is money set apart, so the cushion steps never fill it and it stays with the dated goals,
  // review D6, 2026-11-06)
  const isCushion = (g) => g.isEmergencyFund === true;
  const goalsDueNow = gl.goals.filter((g) => g.status === "past due" || (g.status === "behind" && !(g.monthsLeft > 0)));
  const cushionBehind = gl.goals.filter((g) => g.status === "behind" && g.monthsLeft > 0 && isCushion(g));
  const goalPlanAll = gl.goals.filter((g) => g.status === "behind" && g.monthsLeft > 0 && !isCushion(g))
    .map((g) => ({ g, extra: Math.max(0, (Number(g.neededMonthly) || 0) - (Number(g.monthly) || 0)), months: g.monthsLeft, have: Number(g.funded) || 0, r: (Number(g.rate) || 0) / 12, mon: Number(g.monthly) || 0, target: Number(g.targetThen ?? g.target) || 0, start: null, reached: null, atDate: null }))
    .filter((x) => x.extra > 0.005)
    .sort((a, b) => (Number(a.g.priority) || 2) - (Number(b.g.priority) || 2) || String(a.g.targetDate).localeCompare(String(b.g.targetDate)));
  // a bill a few months off that the month cannot save for (review UX 1, 2026-11-06: Education's goal for a January college bill
  // read "put about $12,910 a month toward it" for a family with $55,000 in cash): due within FROM_CASH_MONTHS, its catch-up
  // more than the spare money, and the usable cash above a month of the bills you have to pay (less what pays costly debt from savings)
  // covers it -- paid from savings when it is due, in the goals' order while the cash lasts; no month's saving is asked for it,
  // and the full cushion's gap counts what it takes from the cash. Never on bills that are mostly our guesses (spec 8.1)
  let cashFree = guessedBills ? 0 : Math.max(0, (liq.now ?? 0) - essential - (steps.find((s) => s.id === "high-debt")?.fromSavings ?? 0));
  const fromCash = [];
  for (const x of goalPlanAll) {
    const amount = Math.max(0, x.target - x.have);
    if (x.months <= FROM_CASH_MONTHS && x.extra > Math.max(0, spare.monthly) && amount > 0.5 && amount <= cashFree) { fromCash.push({ id: x.g.id, name: x.g.name, amount, due: x.g.targetDate }); cashFree -= amount; }
  }
  const goalPlan = goalPlanAll.filter((x) => !fromCash.some((y) => y.id === x.g.id));
  const cashUsed = fromCash.reduce((t, x) => t + x.amount, 0);
  const cushionExtra = cushionBehind.reduce((t, g) => t + Math.max(0, (Number(g.neededMonthly) || 0) - (Number(g.monthly) || 0)), 0);
  // moved up: the dated goals' extra; last (no other goal behind): the emergency fund goal's, as before
  const goalExtra = goalPlan.length ? goalPlan.reduce((t, x) => t + x.extra, 0) : cushionExtra;
  const goalStep = () => add({ id: "goals", title: "Catch up the goals", why: "What you are saving for, by when: behind now means short later.", status: goalPlan.length || goalsDueNow.length || cushionExtra > 0 || fromCash.length ? "now" : "done", roomYearly: goalExtra * 12,
    ...(goalPlan.length ? { goalPlan } : {}), ...(fromCash.length ? { fromCash } : {}), detail: goalPlan.length || goalsDueNow.length || cushionExtra > 0 || fromCash.length ? "" : "Every goal with a date is on track.", go: ["goals", "goals"] });
  if (goalPlan.length || fromCash.length) goalStep();

  // 4. the full emergency fund
  // (a bill paid from savings above takes its cash from the cushion: the gap counts it)
  const gapNow = cashUsed > 0 ? Math.max(0, (liq.target ?? 0) - ((liq.now ?? 0) - cashUsed)) : liq.gap ?? 0;
  const fullGap = gapNow < 0.5 ? 0 : gapNow;
  add({ id: "full-fund", title: `A full emergency fund (${liq.targetMonths} months)`, why: allRetired ? "Cash for surprise bills, so you never sell investments in a bad year." : "Enough cash for the bills you have to pay to ride out a job loss without selling investments at a bad time.", status: fullGap > 0 ? "now" : "done", gap: fullGap,
    ...(guessedBills ? { waits: true } : {}),
    detail: fullGap > 0 ? `${cushionMoney(fullGap)} more reaches ${liq.targetMonths} months of the bills you have to pay (${cushionMoney(liq.target)}${byGuess})${cashUsed > 0 && (liq.gap ?? 0) < fullGap - 0.5 ? ", once the bills above are paid from savings" : ""}.` : `Usable cash covers ${guessedBills ? "about " : ""}${monthsNear(liq.runwayMonths ?? 0, liq.targetMonths)}${byGuess}; the plan aims for ${liq.targetMonths}.`, go: ["balance", "liquidity"] });

  // 5. the HSA, for those who have one and a high-deductible plan this year (none: nobody may put money in, IRC 223(c)(1))
  const hsaUsed = (con.byPerson ?? []).flatMap((p) => p.limits).filter((l) => l.kind === "hsa").reduce((s, l) => s + l.used, 0);
  // read from the Medicare-aware picture (the HSA page's own, follow-up 2026-11-07, HSA R1): once someone is on Medicare nobody is told to
  // fill the account (their limit is 0), and a part-year limit is the months before Medicare, with the catch-up from 55
  const pic = con.hsa;
  // money already typed in while nothing may go in (on Medicare all year, say) is still a step: it has to come out (verify 2026-11-07: the
  // widow with 4,400 typed was told by the HSA page and Contributions, and by nothing on the Dashboard)
  if (accounts.some((a) => a.type === "hsa") && pic && pic.coverage !== "none" && (pic.household.limit > 0 || hsaUsed >= 1)) {
    const family = pic.coverage === "family";
    const hsaLimit = pic.household.limit;
    const room = Math.max(0, hsaLimit - hsaUsed);
    // more in than the limit allows (the part year before Medicare, or a self-only plan with the family amount typed): never "at the limit"
    // (money review M6); the extra has to come out by the filing deadline or a 6% charge applies every year
    const tooMuch = Math.max(0, hsaUsed - hsaLimit);
    add({ id: "hsa", title: tooMuch >= 1 ? (hsaLimit > 0 ? "Take the extra out of the health savings account" : "Take this year's money out of the health savings account") : "Fill the health savings account", why: tooMuch >= 1 ? "Money over the limit is charged 6% every year it stays in." : "Tax-free going in, growing and coming out for health costs: the only triple tax break.", status: room > 0 || tooMuch >= 1 ? "now" : "done", roomYearly: room,
      detail: tooMuch >= 1 ? (hsaLimit > 0 ? `${money(tooMuch)} over this year's limit (${money(hsaLimit)}): take it out before the tax filing deadline.` : `Nothing can go in this year, so take the ${money(tooMuch)} out before the tax filing deadline.`) : room > 0 ? `You can still put in ${money(room)} this year.` : "At this year's limit.", go: ["taxes", "hsa-fsa"] });
  }

  // 6. an IRA for each adult with earned income
  const earners = adults.filter((p) => inc.active.some((x) => x.personId === p.id && ["salary", "bonus", "business"].includes(x.type)));
  // the plan's own answer to "are we saving enough?" (Will the money last?): when it already lasts, more saving is a choice
  let saving = null;
  try { saving = savingVerdict(plan, { today }); } catch { saving = null; }
  const optional = saving?.verdict === "on track" ? "Optional: your plan already lasts (see the Will the money last? page). More saving buys an earlier retirement or more to spend." : "";
  // the step's own first sentence (what it is) stays next to its title, then "Optional: ...", then the rest (critic C10 #2: the IRA's
  // "A retirement account you open yourself (an IRA)." came after the two optional sentences, at the end of a long grey paragraph)
  const optionalAfter = (first, rest = "") => [first, optional, rest].filter(Boolean).join(" ");
  const iraRoom = earners.map((p) => { const used = (con.byPerson.find((q) => q.personId === p.id)?.limits ?? []).filter((l) => l.kind === "ira").reduce((s, l) => s + l.used, 0); const age = con.byPerson.find((q) => q.personId === p.id)?.age; const limit = L.ira.limit + (age !== null && age !== undefined && age >= L.ira.catchUpAge ? L.ira.catchUp : 0); return { p, room: Math.max(0, limit - used), limit }; });
  const iraTotal = iraRoom.reduce((s, x) => s + x.room, 0);
  // the backdoor route is said only when this household's income is in or over the Roth limit range (Contribution limits)
  let rothNear = false;
  try { const r = computeLimits(plan, { today }).roth; rothNear = !!r && (r.status === "partial" || r.status === "over"); } catch { rothNear = false; }
  // plain words (spec 13.1, C10): what an IRA is, the two kinds, the yearly limit (each adult's, with the catch-up from 50 said when
  // it applies to one of them) and that a year skipped is lost; the detail says only what can still go in this year
  const iraLimits = [...new Set(iraRoom.map((x) => x.limit))].sort((a, b) => a - b);
  const upTo = iraLimits.length > 1 ? `${money(iraLimits[0])} a year (${money(iraLimits.at(-1))} from age ${L.ira.catchUpAge})` : `${money(iraLimits[0] ?? L.ira.limit)} a year`;
  if (earners.length) add({ id: "ira", title: earners.length > 1 ? "An IRA for each of you" : "An IRA of your own", why: optionalAfter("A retirement account you open yourself (an IRA).", `The Roth kind: no tax break now, no tax when you take it out; the traditional kind can cut this year's tax, and is taxed when you take it out. ${earners.length > 1 ? "Each of you can" : "You can"} put in up to ${upTo}; a year you skip can't be made up.`), status: iraTotal > 0 ? "now" : "done", roomYearly: iraTotal, optional: !!optional, people: iraRoom.filter((x) => x.room > 0).length,
    detail: iraTotal > 0 ? `${roomWords(iraRoom.filter((x) => x.room > 0).map((x) => ({ name: x.p.name, room: x.room })), money)}.${rothNear ? " Your income is at the Roth income limit: a Roth then goes in the long way, into a traditional IRA first and then moved to a Roth (the backdoor route)." : ""}` : "Every IRA is at this year's limit.", go: ["investments", "limits"] });

  // 7. moderate debt (not the mortgage)
  const mid = debts.filter((d) => d.rate !== null && d.rate >= MODERATE_RATE && d.rate < HIGH_RATE && d.type !== "mortgage").sort((a, b) => b.rate - a.rate);
  const ms = debtStep(mid);
  const midWhy = `Debt at ${Math.round(MODERATE_RATE * 100)}% to ${Math.round(HIGH_RATE * 100)}%: paying it is a sure return at that rate.`;
  if (mid.length && !ms.off.length && ms.until) add({ id: "mid-debt", title: "Pay down middling debt", why: midWhy, status: "underway", gap: 0,
    underway: { extra: debtPlan.extra, names: ms.names, until: ms.until }, detail: `Under way. ${ms.sentence}`, go: ["debt", "payoff"] });
  else if (mid.length) add({ id: "mid-debt", title: "Pay down middling debt", why: midWhy, status: "now", gap: ms.gap,
    detail: `${highWords(ms.off)}.${ms.sentence ? ` ${ms.sentence}` : ""}`, go: ["debt", "payoff"] });

  // 8. the 401(k) to the limit
  if (k401.length) {
    // only someone with pay can put money into a 401(k): a retired household gets no "fill the 401(k)" step
    const k = (con.byPerson ?? []).filter((p) => earners.some((e) => e.id === p.personId)).map((p) => { const l = p.limits.find((x) => x.kind === "401k"); return l ? { name: p.name, room: Math.max(0, l.limit - l.used), limit: l.limit } : null; }).filter(Boolean);
    const room = k.reduce((s, x) => s + x.room, 0);
    if (k.length) add({ id: "max-401k", title: "The 401(k) to the limit", why: optionalAfter("Every dollar the law allows grows with no tax while it stays in."), optional: !!optional, status: room > 0 ? "now" : "done", roomYearly: room,
      detail: room > 0 ? `${roomWords(k.filter((x) => x.room > 0), money)} (limit ${money(k[0].limit)}).` : "At this year's limit.", go: ["investments", "limits"] });
  }

  // 8b. a one-person business: its own retirement plan (Small business's best: a solo 401(k), a SEP-IRA or a SIMPLE IRA), far
  // more room than an IRA, every dollar off this year's tax; while nothing goes into a 401(k) for its owner (then the step
  // above is the place). Round 4, 2026-11-02: a freelancer was offered only an IRA
  let bz = null;
  try { bz = (plan.income ?? []).some((x) => x.type === "business") ? computeBusiness(plan, { today }) : null; } catch { bz = null; }
  const bizPlan = bz?.ready && bz.best ? (bz.plans ?? []).find((x) => x.key === bz.best) ?? null : null;
  const owner = bz?.person?.id ?? null;
  const into401k = (con.byPerson ?? []).some((p) => (!owner || p.personId === owner) && (p.limits.find((l) => l.kind === "401k")?.used ?? 0) > 0);
  // only when it allows more than an IRA does (a little weekend work's plan can allow less: then the IRA step is the answer)
  if (bizPlan && bizPlan.room > (L.ira?.limit ?? 0) && !bizPlan.late && !into401k && earners.length) add({ id: "business-plan", title: "A retirement plan through your business",
    why: optionalAfter("A business can put far more aside than an IRA allows, and every dollar comes off this year's tax."), optional: !!optional, status: "now", roomYearly: bizPlan.room,
    detail: `${bizPlan.label}: up to ${money(bizPlan.room)} for ${bz.year}; filling it would cut that year's tax by about ${money(bizPlan.saved)}.${bizPlan.key === "solo" ? " A new one can still be set up for this year until the April tax-filing deadline." : bizPlan.key === "sep" ? " It can be opened and filled up to the tax-filing deadline." : ""}`, go: ["career", "business"] });

  // 9. the goals, here when none is behind its pace (one behind is placed after costly debt, 3b above)
  if (gl.goals.length && !goalPlan.length && !fromCash.length) goalStep();

  // 10. the rest: a choice
  const mortgage = debts.find((d) => d.type === "mortgage");
  add({ id: "rest", title: "Then: your choice", why: "Past this point there is no wrong answer, only priorities.", status: "later",
    detail: `Invest outside retirement accounts, pay the mortgage down early${mortgage?.rate ? ` (a sure ${pct(mortgage.rate)})` : ""}, save for a child's college (a 529 plan), ${allRetired ? "" : "retire earlier, "}give. The Goal seek page shows what each would buy.`, go: ["scenarios", "goal-seek"] });

  // the spare money, month by month: one-off gaps in order, then this year's room, ongoing
  const avail0 = Math.max(0, spare.monthly);
  const left = steps.map((s) => (s.status === "now" && s.gap ? s.gap : 0));
  // costly debt first in line for the spare money: its date is Pay off debts' own (offer: the spare a month aimed at those
  // debts, required payments and interest included), so both pages give one date; the schedule then frees the spare money
  // that month (round 4, 2026-11-02: the same $410 read May 2028 here and January 2028 on Pay off debts, because this
  // reckoning paid the balance from the spare money alone)
  {
    const i = steps.findIndex((s) => s.id === "high-debt");
    const first = i >= 0 && steps.slice(0, i).every((s) => !(s.status === "now" && s.gap > 0.5));
    // what reaches the cards: the spare money less what a step before them takes every month (the match's take-home cost,
    // review D2; round 8 verify, 2026-11-06: the date was Pay off debts' at the whole spare money while the run gave the cards
    // the rest, so it read a month or more later than Pay off debts gives for what is left once the 401(k) is started)
    const ahead = i >= 0 ? steps.slice(0, i).filter((s) => s.status === "now" && !s.gap && s.roomYearly > 0).reduce((t, s) => t + s.roomYearly / 12, 0) : 0;
    const reach = Math.max(0, avail0 - ahead);
    if (first && steps[i].status === "now" && steps[i].gap > 0.5 && !(steps[i].fromSavings > 0) && reach >= 25) {
      let o = null;
      try { o = payoffOffer(plan, { today, amount: reach, stepId: "high-debt" }); } catch { o = null; }
      const months = o?.soon ? Math.max(1, Math.round((Date.parse(`${o.soon.slice(0, 7)}-15`) - Date.parse(`${today.slice(0, 7)}-15`)) / (30.44 * 864e5))) : null;
      if (months) left[i] = reach * months - 0.01;   // the spare money it takes until that month, whatever the balance today
    }
  }
  // once the saved debt plan's debts are gone, its extra is free again and joins the spare money
  const freed = debtPlan && debtPlan.months !== null ? debtPlan.months : Infinity;
  const startM = steps.map(() => null);
  let ran = 0;
  for (let m = 0; m < HORIZON_MONTHS && (avail0 > 0 || freed < HORIZON_MONTHS); m++) {
    ran = m + 1;
    let avail = Math.max(0, spare.monthly + (m >= freed ? debtPlan.extra : 0));
    steps.forEach((s, i) => {
      if (avail <= 0 || s.status !== "now") return;
      if (s.gap) {
        if (left[i] <= 0) return;
        const put = Math.min(left[i], avail); left[i] -= put; avail -= put;
        if (left[i] <= 0.5 && !s.doneDate) s.doneDate = addMonths(today, m + 1);
      } else if (s.goalPlan) {
        // each goal behind its pace takes what it needs a month to hold its amount by its date from where it stands (its extra
        // from today while it gets all of it; more, to catch up, after a month the steps before it took the money), growing at
        // its own rate with what already goes in, as Goals works it (end-of-month saving, pmtToReach); past its date, when
        // the order made it late, whatever reaches it until it holds its amount
        const before = avail;
        for (const x of s.goalPlan) {
          if (x.reached !== null) continue;
          const need = Math.max(0, pmtToReach(x.r, Math.max(1, x.months - m), x.target, x.have) - x.mon);
          const give = Math.min(need, avail); avail -= give;
          x.full = give >= need - 0.005;   // kept its pace this month (a date past the run is judged by the run's last month)
          if (give > 0.005 && x.start === null) x.start = m;
          x.have = x.have * (1 + x.r) + x.mon + give;
          if (m + 1 === x.months) x.atDate = x.have;
          if (x.have >= x.target - 0.5) { x.reached = m + 1; if (x.atDate === null && m + 1 <= x.months) x.atDate = x.have; }
        }
        const put = before - avail;
        // its first month can be the crumbs of a step finishing: the month after counts too, for what it gets and what reaches it
        if (startM[i] === m - 1) { s.capacity = Math.max(s.capacity, before); s.monthly = Math.max(s.monthly, put); }
        if (put > 0.005 && !s.startDate) { s.startDate = addMonths(today, m); s.monthly = put; s.capacity = before; startM[i] = m; }
      } else if (s.roomYearly) {
        // what reaches it: its first month can be the crumbs of a step finishing, so the month after counts too, for what
        // reaches it and what it gets (review UX 6: "about $660 a month of the $1,250 it could take" for an IRA that has its
        // whole $1,250 from the next month)
        const put = Math.min(s.roomYearly / 12, avail);
        if (startM[i] === m - 1) { s.capacity = Math.max(s.capacity, avail); s.monthly = Math.max(s.monthly, put); }
        if (put > 0 && !s.startDate) { s.startDate = addMonths(today, m); s.monthly = put; s.capacity = avail; startM[i] = m; }
        avail -= put;
      }
    });
  }
  // the goals step's words, from the run above: "needs about $1,070 a month from now to be ready by November 2029" for the
  // goals the order reaches by their dates (Goals' own pace from today), "In this order ... waits until about 2031;
  // to keep November 2029, put about $1,070 a month toward it from now" for one it does not; "on track" is never said of a
  // goal that is not. While the spending is mostly our guesses, only what each needs. A date that has passed: due now.
  { const gs = steps.find((x) => x.id === "goals");
    if (gs && gs.status !== "done") {
      const out = [];
      const onTime = (x) => !spare.waits && ran > 0 && (x.months <= ran ? x.atDate !== null && x.atDate >= x.target - 0.5 : x.full === true);
      const ok = spare.waits ? goalPlan : goalPlan.filter(onTime), late = spare.waits ? [] : goalPlan.filter((x) => !onTime(x));
      if (ok.length === 1) out.push(`${ok[0].g.name} needs about ${money(ok[0].extra)} a month from now to be ready by ${monthWords(ok[0].g.targetDate)}.`);
      else if (ok.length) out.push(`${listWords(ok.map((x) => x.g.name))} need about ${money(ok.reduce((t, x) => t + x.extra, 0))} a month in all from now to be ready by their dates.`);
      for (const x of late) out.push(x.reached !== null ? `In this order ${x.g.name} waits until about ${monthWords(addMonths(today, x.reached))}; to keep ${monthWords(x.g.targetDate)}, put about ${money(x.extra)} a month toward it from now.`
        : `In this order ${x.g.name} is not ready by ${monthWords(x.g.targetDate)}; to keep that date, put about ${money(x.extra)} a month toward it from now.`);
      // the emergency fund goal: with dated goals moved up, the cushion steps fill it; alone, the step is last, as before
      if (cushionExtra > 0) out.push(goalPlan.length ? `${listWords(cushionBehind.map((g) => g.name))} ${cushionBehind.length === 1 ? "is" : "are"} filled by the emergency fund steps, not this one.`
        : `${cushionBehind.map((g) => g.name).join(", ")}: about ${money(cushionExtra)} a month more in all puts them on track.`);
      // bills a few months off, paid from savings (review UX 1)
      if (fromCash.length) { const many = fromCash.length > 1; out.push(`${listWords(fromCash.map((x) => `${x.name} (about ${money(x.amount)} by ${dayWords(x.due)})`))} ${many ? "are" : "is"} due sooner than a month can save for ${many ? "them" : "it"}. Your usable cash, about ${money(liq.now)}, covers ${many ? "them" : "it"}: pay ${many ? "them" : "it"} from savings when ${many ? "they are" : "it is"} due.`); }
      // a date that has passed (review UX 4): a college goal points to Education's next bill for that child ("$103,000 is due
      // now" stood against Education's $25,850); the others say what to do on Goals, never "mark it done" where no button does it
      const bills = collegeBills(plan, today, goalsDueNow);
      for (const g of goalsDueNow) {
        const c = bills.get(g.id);
        out.push(g.status !== "past due" ? `${g.name} is due this month, and about ${money(g.remaining)} is still needed.`
          : c ? `${g.name}: its date has passed. ${collegeWords(c, money)}`
          : `${g.name}: its date has passed, with about ${money(g.dueNow ?? g.remaining)} still to go. Set a new date for it on Goals, or lower its amount if less is needed.`);
      }
      gs.detail = out.join(" ");
    }
    if (gs?.goalPlan) delete gs.goalPlan;
  }
  // the spending is mostly our guesses: no step is dated or given a monthly figure from the spare money (spec 8.1: "once
  // your spending is in"); what savings or the cash kept for tax pays today stays
  if (spare.waits) for (const s of steps) if ((s.doneDate && s.doneDate !== today) || s.startDate || s.monthly != null || s.capacity != null) { if (s.doneDate && s.doneDate !== today) s.doneDate = null; if (s.startDate) s.startDate = null; if (s.monthly != null) s.monthly = null; if (s.capacity != null) s.capacity = null; s.waits = true; }
  // number the steps; the first one not done is the next best action
  steps.forEach((s, i) => { s.n = i; });
  const next = steps.find((s) => s.status === "now" || s.status === "check") ?? null;
  if (next) for (const s of steps) if (s !== next && s.status === "now") s.status = "later";
  return { ready: true, missing: [], spare, steps, next, drawing, debtPlan };
}

/** A share as words: 1 -> "100%", 0.03 -> "3%", 0.045 -> "4.5%". */
const share = (x) => `${Number((x * 100).toFixed(1))}%`;
/** Match tiers as words: "100% of what Jasmine puts in, up to 3% of pay" (then ", then 50% up to 5%" for a second tier). */
function tierWords(tiers, name) {
  const t = [...(tiers ?? [])].filter((x) => x.rate > 0 && x.upTo > 0).sort((a, b) => a.upTo - b.upTo);
  if (!t.length) return "";
  return `${share(t[0].rate)} of what ${nameIn(name)} ${verbFor(name, "puts", "put")} in, up to ${share(t[0].upTo)} of pay${t.slice(1).map((x) => `, then ${share(x.rate)} up to ${share(x.upTo)}`).join("")}`;
}
/** The common match the words name (Work benefits' DEFAULT_TIERS: 50% on the first 6% of pay, Vanguard How America Saves 2025, Figure 8). */
/** The raise's own note on the usual match (left out when the step names the common match: one figure per step). */
const USUAL_NOTE = " (plans usually add about 4% of pay)";
const COMMON = `${share(DEFAULT_TIERS[0].rate)} of what you put in up to ${share(DEFAULT_TIERS[0].upTo)} of pay`;

/**
 * freshMatch(plan, person, today) -> { kind, match } for a paid adult with no 401(k) on file (round 8 item 1).
 * kind: "known" (match tiers typed on Work benefits, `whatIfs.benefits[id].matchTiers`), "plan" (said yes, there is a plan
 * with a match: `retirement.workPlans[id].match === true`, Get started's question), else "ask".
 * match: Work benefits' own figures for this person (career/benefits compute with them chosen, `paycheck: false`): { tiers,
 * pct (the share of pay that gets all of it), yearly (what goes in a year), perCheck, take (what take-home pay falls by a
 * paycheck: the amount less the federal and state income tax it saves; Social Security and Medicare still apply, IRC
 * 3121(v)(1)(A)), match (the employer's money a year), paychecks, planYear } -- the typed tiers, else the common match;
 * null when Work benefits cannot see this person's pay (a bonus with no salary).
 */
export function freshMatch(plan, person, today) {
  const tiers = plan.whatIfs?.benefits?.[person.id]?.matchTiers;
  const known = Array.isArray(tiers) && tiers.some((x) => Number(x.rate) > 0 && Number(x.upTo) > 0);
  const kind = known ? "known" : plan.retirement?.workPlans?.[person.id]?.match === true ? "plan" : "ask";
  let b = null;
  try { b = computeBenefits({ ...plan, whatIfs: { ...(plan.whatIfs ?? {}), benefits: { ...(plan.whatIfs?.benefits ?? {}), personId: person.id } } }, { today, paycheck: false }); } catch { b = null; }
  const o = b?.ready && b.person?.id === person.id ? b.k401.options.find((x) => x.key === "match") : null;
  const match = o ? { tiers: b.k401.tiers, pct: o.pct, yearly: o.yearly, perCheck: o.perCheck, take: o.costPerCheck, match: b.k401.fullMatch, paychecks: b.paychecks, planYear: b.planYear } : null;
  return { kind, match };
}

/** The match step's words for adults with no 401(k) on file: the answer when the match is typed, else the question. */
function freshWords(fresh, { exact, money }) {
  const out = [];
  for (const x of fresh.filter((y) => y.kind === "known" && y.match)) out.push(`${NameOf(x.p.name)} employer adds ${tierWords(x.match.tiers, x.p.name)}: put in ${share(x.match.pct)} (${exact(x.match.perCheck)} a paycheck) to get ${exact(x.match.match)} a year.`);
  for (const x of fresh.filter((y) => y.kind === "plan" || (y.kind === "known" && !y.match))) out.push(`${NameOf(x.p.name)} job has a retirement plan with a match: ask human resources at work how much it adds.${x.match ? ` With a common match, ${COMMON}, putting in ${share(x.match.pct)} (${exact(x.match.perCheck)} a paycheck) would get ${money(x.match.match)} a year.` : ""} Put in at least enough to get all of it.`);
  const ask = fresh.filter((y) => y.kind === "ask");
  if (ask.length) {
    const jobs = ask.map((y) => `${nameOf(y.p.name)} job`);
    const worth = ask.filter((y) => y.match);
    // "about $1,740 a year for Priya and $1,920 for Tom"; one person: "about $1,500 a year"
    const each = worth.length === 1 && ask.length === 1 ? ` would be about ${money(worth[0].match.match)} a year` : worth.length ? ` would be about ${listWords(worth.map((y, i) => `${money(y.match.match)}${i ? "" : " a year"} for ${nameIn(y.p.name)}`))}` : ` adds ${share(DEFAULT_TIERS[0].rate * DEFAULT_TIERS[0].upTo)} of pay a year`;
    out.push(`Does ${jobs.length > 1 ? `${jobs.slice(0, -1).join(", ")} or ${jobs[jobs.length - 1]}` : jobs[0]} match retirement savings? Ask human resources at work, or look on ${ask.length > 1 ? "each" : "the"} job's benefits site. A common match, ${COMMON},${each}.`);
  }
  return out.join(" ");
}

/**
 * rmdNow(plan, { today }) -> this year's required withdrawals still to take (Required withdrawals' thisYear(plan).due), each with
 * what must come out by its deadline: [{ ...that person's entry, amount, accounts, estimated (of the accounts that must pay it
 * now), waits: [the 401(k)s at the job they still work at] }], only those with an amount left.
 * A workplace plan's own required withdrawal can wait until the year its owner retires from that job (IRC 401(a)(9)(C); IRS,
 * Retirement plan and IRA required minimum distributions FAQs, read 2026-11-06: "Retirement plan account owners can delay
 * taking their RMDs until the year in which they retire", not a 5% owner); an IRA's cannot. The 401(k) at the job is one not
 * marked as from a job left (`formerJob`), as everywhere else; each account's part is its balance / the Uniform Lifetime
 * factor (core/math/rmd.js), as Required withdrawals works it (review D5: a still-working 75-year-old was told to take $16,260
 * when $4,065 was due, from the IRA).
 */
export function rmdNow(plan, { today }) {
  const out = [];
  for (const r of rmdThisYear(plan, { today }).due) {
    const atJob = (a) => !!r.working && a.type === "401k" && !(plan.accounts ?? []).find((x) => x.id === a.id)?.formerJob;
    const waits = r.accounts.filter(atJob), now = r.accounts.filter((a) => !atJob(a));
    if (!waits.length) { out.push({ ...r, waits }); continue; }
    const amount = Math.round(now.reduce((t, a) => t + rmdAmount(a.balance, r.age), 0));
    if (amount >= 1) out.push({ ...r, amount, accounts: now, estimated: now.some((a) => a.estimated), waits });
  }
  return out;
}
/**
 * collegeBills(plan, today, goals) -> Map(goal id -> { amount, label, due }): for each past-due college goal of a child already
 * in college, Education's next bill for that child (its nextYearCost, the label of what it is for, its date), the figure its
 * own Update button writes (review UX 4: "$103,000 is due now" stood against Education's $25,850). Education is worked out
 * only when there is such a goal.
 */
export function collegeBills(plan, today, goals) {
  const out = new Map();
  if (!(goals ?? []).some((g) => g.status === "past due" && plannerFor(g)?.page === "goals/education")) return out;
  let edu = null;
  try { edu = computeEducation(plan, { today }); } catch { return out; }
  for (const c of edu?.children ?? []) if (c.goal?.id && c.started && c.left?.length) out.set(c.goal.id, { amount: c.nextYearCost, label: c.left[0].part === "spring" ? `the spring half of ${c.left[0].label}` : c.left[0].label, due: c.nextBill });
  return out;
}
/** "Education says the next bill is about $12,930 (the spring half of 2026-27, due January 15, 2027): tap Update on Education to set this goal to it." */
export const collegeWords = (c, money) => `Education says the next bill is about ${money(c.amount)} (${c.label}, due ${dayWords(c.due)}): tap Update on Education to set this goal to it.`;
/**
 * leftWords(nba, currency) -> what the month has left now, in one sentence, for the confirmation after a change that takes from
 * take-home pay (Contributions' and Work benefits' one-tap 401(k) start, review D2: the renter's month went $80 short with no
 * word): spare, just about even (within $5), or short with the way out; while the spending is mostly our guesses, said so.
 */
export function leftWords(nba, cur = "USD") {
  if (!nba?.ready) return "";
  const m = nba.spare.monthly, dollars = (n) => fmtMoney(Math.round(n), cur);
  if (nba.spare.waits) return `With our guesses of your spending, each month would have about ${dollars(Math.abs(m))} ${m < 0 ? "too little" : "left"}.`;
  if (m >= 5) return `Each month now has about ${dollars(m)} left after tax, spending and saving.`;
  if (m > -5) return "Each month now just about breaks even.";
  return `Each month is now about ${dollars(-m)} short: ${nba.spare.debtExtra > 0.5 ? `lower the ${dollars(nba.spare.debtExtra)} extra on debts (Pay off debts) or trim spending` : "trim spending"} to make up for it.`;
}
/** The 401(k) that waits, said: "Ana's 401(k) at the job now (Work 401(k)) can usually wait until Ana retires (...)." */
export function waitWords(r) {
  if (!r.waits?.length) return "";
  return ` ${NameOf(r.name)} ${r.waits.length > 1 ? "401(k)s" : "401(k)"} at the job now (${listWords(r.waits.map((a) => a.name))}) can usually wait until ${nameIn(r.name)} ${verbFor(r.name, "retires", "retire")} (check the plan's rules; not if ${nameIn(r.name)} ${verbFor(r.name, "owns", "own")} 5% or more of the business).`;
}
/** An account's name as a place money comes from: "Ruth's retirement" reads as a life stage, so "account" is added to a name that does not say what it is. */
export const accountWords = (n) => (/\b(account|ira|401|403|457|tsp|plan|roth|fund)/i.test(String(n ?? "")) ? n : `${n} account`);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** "2028-01-15" -> "January 2028" (pure: no locale). */
/** "January 15, 2027" from "2027-01-15". */
export const dayWords = (iso) => (iso ? `${MONTHS[Number(String(iso).slice(5, 7)) - 1]} ${Number(String(iso).slice(8, 10))}, ${String(iso).slice(0, 4)}` : "");
export const monthWords = (iso) => (iso ? `${MONTHS[Number(String(iso).slice(5, 7)) - 1]} ${String(iso).slice(0, 4)}` : "");
const listWords = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
function pct(x) { return `${(Math.round(x * 1000) / 10).toFixed(1)}%`; }

/**
 * cushionLater(nba) -> { until ("YYYY-MM-DD" | null: when costly debt is paid off by the plan), targetMonths? } | null.
 * The full cushion waits on purpose: the starter month of the bills you have to pay is in cash, and costly debt (10% or more) is being
 * paid first, by the spare money (its step comes before the full fund's) or by a saved debt plan already on it. Needs attention, Emergency fund and the Dashboard
 * then say "enough for now" (amber) instead of a red "thin", so no page contradicts the order here.
 */
export function cushionLater(nba) {
  if (!nba?.ready) return null;
  const by = (id) => (nba.steps ?? []).find((x) => x.id === id);
  const starter = by("starter"), high = by("high-debt"), full = by("full-fund");
  if (!starter || starter.status !== "done" || !high || !full || full.status === "done") return null;
  if (high.status === "done" || high.status === "skip") return null;
  return { until: high.status === "underway" ? (nba.debtPlan?.until ?? null) : (high.doneDate ?? null) };
}

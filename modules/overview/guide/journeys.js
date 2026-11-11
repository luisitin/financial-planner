// modules/overview/guide/journeys.js -- PURE data. The seven step-by-step guides: which real pages each one
// takes you through, in order, what to do on each, and how the plan shows a step is done. No page is rebuilt:
// every step opens a page that already exists (README "Why each step is there").
//
// A step:
//   key        unique inside the guide (kebab-case; used in addresses: ?guide=<id>&step=<key>)
//   page       "group/id" of a usable page
//   title      on the guide page and the next-step card
//   short      for "Do step N: {short}", "Next: {short} ›"; 21 characters at most, starts with a verb
//   ask        one sentence: what to do on that page, naming the page's own button
//   doneWhen   one sentence after "Not done yet: " saying when the step counts as done
//   check      (plan) => boolean: done when the plan holds the data (optional)
//   looked     true: a step that only asks you to look; done once you tap Next on it
//   optional   true: an extra step, drawn after the numbered ones, never needed to finish
//   show       (plan) => boolean: an extra step that only shows when it applies (only on optional steps)
//   why        an extra step's reason line ("Because you have a credit card.")
//   none       label of a "does not apply" button; tapping it counts the step as done
//   noneSaid   what the card says after that tap (default "You said this does not apply.")
//   alt        { page, label, ask, opens }: another page that does the same step
//   opens      the title of a fold (<details>) on the page that the ask names; the guide opens it while the step is to do
//   needs      keys of earlier steps this page needs first (it shows "This step needs step 1 first")
//
//   name       (the "plan" path only) a noun phrase for "Next: <name> ›", the rows of Your plan and the continue row
//   waits      (the path only) (plan, { today }) -> null | { what, href }: this page cannot answer yet; says what it needs, never blocks
//   ownAction  (the path only) the label of a page button that is this step's own action ("Save plan"): Next stays outlined until the step is done
//
// A guide may also have variant(plan, { today, off }) -> null | { line?, haveReady?, more?, finish?, steps: { [key]: fields | null } }:
// other words for this plan, a step's fields replaced, or a step left out (null). guide/compute.js forPlan applies it.
import { compute as setupSteps } from "../dashboard/compute.js";
import { rateIsGuess, paymentIsGuess, picks, retirementGap } from "../setup/compute.js";
import { isLiability } from "../../balance/net-worth/compute.js";
import { compute as liabilities } from "../../balance/liabilities/compute.js";
import { compute as categorize } from "../../transactions/categorize/compute.js";
import { isHouseGoal } from "../../goals/house/compute.js";
import { compute as consolidation } from "../../debt/consolidation/compute.js";
import { householdRetired, retirementKnown, savingVerdict, savingsUnknown, compute as projection } from "../../retirement/projection/compute.js";
import { ageOn } from "../../../core/math/dates.js";
import { thisYear as rmdThisYear } from "../../retirement/rmd/compute.js";
import { RMD_ACCOUNT_TYPES, rmdStartYear } from "../../../core/math/rmd.js";
import { compute as expenses } from "../../cashflow/expenses/compute.js";
import { protectionAsks } from "../plan/words.js";

const L = (p, k) => (Array.isArray(p?.[k]) ? p[k] : []);
const RETIRE = ["401k", "ira", "roth", "hsa"];
const SAVINGS = ["checking", "savings", "cash", "credit"];
export const debtAccounts = (p) => L(p, "accounts").filter((a) => isLiability(a.type));
export const hasType = (p, ...types) => L(p, "accounts").some((a) => types.includes(a.type));
/** Every loan and card with a balance has its rate and payment saved (a 0% loan counts): Liabilities' own test. A typical rate the setup put in (`rateGuessed`) is not a saved rate yet. */
export const detailed = (p) => { const owed = liabilities(p).rows.filter((r) => r.owed > 0); return owed.length > 0 && owed.every((r) => !!r.detail && !rateIsGuess(r.detail) && !paymentIsGuess(r.detail)); };
export const adults = (p) => (p?.household?.people ?? []).filter((x) => x.role !== "dependent");
/** The same test as goals/emergency-fund (its EMERGENCY pattern and the 🛟 icon), plus the flag a goal may carry. */
export const emergencyGoal = (p) => L(p, "goals").some((g) => g.isEmergencyFund || g.icon === "🛟" || /emergency|rainy ?day|cushion/i.test(g.name ?? ""));
/** A goal saving to buy a home, by the same test Home affordability uses to find it (goals/house isHouseGoal: a down payment, the 🏠 icon or a home to buy; never repairs, paying it off or a trip home), so the page and the step always agree. */
export const houseGoal = (p) => L(p, "goals").some(isHouseGoal);
// Social Security already paid and typed on the Income page counts as saved too, unless it has ended (review 2026-11-02,
// round 5: an ended survivor benefit, which no other page counts, marked the step done). A line that starts later still
// counts: the projection counts it from its start date and Will the money last? takes it as known (ssOnIncome)
const socialSecurity = (p, { today = null } = {}) => Object.values(p?.retirement?.socialSecurity ?? {}).some((s) => Number(s?.monthlyAtFRA) > 0 || (s?.record ?? []).length > 0) || (p?.income ?? []).some((x) => x.type === "social" && x.period !== "once" && Number(x.amount) > 0 && !(x.endDate && today && String(x.endDate) < String(today)));
/** A pension saved on Pensions, or one already paid and typed on the Income page. */
const pension = (p, { today = null } = {}) => L(p?.retirement, "pensions").length > 0 || L(p, "income").some((x) => x.type === "pension" && x.period !== "once" && Number(x.amount) > 0 && !(x.endDate && today && String(x.endDate) < String(today)));
/** Every adult is 65 or over today (Medicare age): the guide stops offering pages about the years before it. */
const all65 = (p, today) => !!today && adults(p).length > 0 && adults(p).every((x) => x.birthDate && ageOn(x.birthDate, today) >= 65);
/**
 * The retirement guide for a household already retired (Will the money last?'s own test: setup said retired, or no pay and
 * past the retirement age): what you spend now, not "once you stop working"; no "what you save from each paycheck"; a
 * benefit already paid typed on Income; the pages a retiree uses next (round 4, 2026-11-02: the guide asked a retired
 * couple of 76 and 69 for their paycheck contributions and when they want to stop working).
 */
const retiredVariant = (p, { today }) => {
  if (!householdRetired(p, { today })) return null;
  const old = all65(p, today);
  const more = [
    { page: "retirement/withdrawal-strategy", title: "How much can I take out each year?" },
    { page: "scenarios/goal-seek", title: "How much more could I spend?" },
    // a required withdrawal is due this year, or not yet (then "when"), or never (no pre-tax account: left out)
    hasType(p, ...RMD_ACCOUNT_TYPES) ? { page: "retirement/rmd", title: (() => { try { return rmdThisYear(p, { today }).people.length ? "This year's required withdrawal" : "When must I start taking money out?"; } catch { return "When must I start taking money out?"; } })() } : null,
    old ? null : { page: "retirement/healthcare", title: "What will health care cost before 65?" },
    { page: "retirement/medicare", title: old ? "What Medicare costs each year" : "What will Medicare cost me?" },
    { page: "retirement/roth-conversions", title: "Should I move money to a Roth?" },
    { page: "retirement/longevity", title: "How long must the money last?" },
    { page: "scenarios/stress-tests", title: "What if markets fall?" },
    { page: "reports/retirement", title: "A summary to print" },
  ].filter(Boolean);
  return {
    line: "Whether your money lasts for the rest of your life, what to take out each year, and what Social Security and pensions add.",
    haveReady: "Your latest account statements, and what Social Security and any pension pay you a month.",
    more,
    finish: { page: "retirement/projection", label: "Open your retirement forecast", text: (() => { const parts = ["ages", "savings", "spending", socialSecurity(p, { today }) ? "Social Security" : null, pension(p, { today }) ? "pensions" : null].filter(Boolean); return `Your ${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]} are in your plan.`; })() },
    steps: {
      people: { ask: "Give each adult a birth date, then tap Add person or Save changes." },
      spend: { title: "Say what you spend", short: "Say what you spend", ask: "Open Retirement settings near the bottom, type what you spend a month now, then tap Save settings.", alt: { page: "cashflow/expenses", label: "Rather list your bills? Enter them on Expenses instead", ask: "List your regular bills and spending, then tap Add expense; the plan uses them as what you spend in retirement." } },
      ss: { ask: "If you get it already, add what arrives each month on the Income page (the link below); if not yet, type the amount your statement shows at full retirement age, then tap Save.", alt: { page: "cashflow/income", label: "Already getting it? Add what arrives each month on Income", ask: "Choose Social Security under Kind of income (if incomes are listed already, tap + Add another income first), type what arrives each month, then tap Add income." } },
      saving: null,
      pension: { ask: "If you get a pension, say what it pays a month, then tap Add pension; one already on the Income page counts." },
    },
  };
};
/** A paycheck figure for either earner on Withholding check (it has a line for each adult). */
const paycheckTax = (p) => ["self", "partner"].some((k) => Number(p?.taxes?.withholding?.[k]?.perPaycheck) > 0);
/** Consolidation has something to compare: two or more cards or loans it can roll together (not a mortgage or student loan), one at 10% or more (its own default pick). */
const oneLoanHelps = (p) => { try { const c = consolidation(p); return c.candidates.length >= 2 && c.ready; } catch { return false; } };
const lifePolicy = (p) => (p?.insurance?.policies ?? []).some((x) => x.kind === "term" || x.kind === "whole");

// ---------------------------------------------------------------- the path ("Your plan")
// One journey, id "plan" (never "whole-plan": a stored journeys["whole-plan"].finishedAt must not read as finished here).
// Its steps come and go with the household, the way the retirement guide's variant does: pathVariant() leaves out every step
// that does not apply. Nothing blocks (no `needs`); every step is look-only, so Next on it counts it as passed.
// Three fields only this journey uses:
//   name       a noun phrase for "Next: <name> ›", "Your plan" rows and the continue row
//   waits      (plan, { today }) -> null | { what, href }: this page cannot answer yet; says what it needs, never blocks
//   ownAction  the label of the page's own button that is this step's action ("Save plan"): Next stays outlined until done
export const PATH_ID = "plan";
/** Pay or business income still running (this year's tax has something to estimate from). */
const paidWork = (p, { today = null } = {}) => L(p, "income").some((x) => (x.type === "salary" || x.type === "business") && Number(x.amount) > 0 && !(x.endDate && today && String(x.endDate) < String(today)));
const thisYearNum = (today) => Number(String(today ?? "").slice(0, 4)) || null;
/** Debts that are not a mortgage and still have a balance (the debt step is about cards and loans). */
const debtsToPay = (p) => debtAccounts(p).filter((a) => a.type !== "mortgage" && Math.abs(Number(a.balance) || 0) > 0);
/** Setup's goal picks name `kind`, or a goal's name matches it. */
const wantsGoal = (p, kind, re) => picks(p, "goals").includes(kind) || (!!re && L(p, "goals").some((g) => re.test(g.name ?? "")));
const hasChildren = (p) => (p?.household?.people ?? []).some((x) => x.role === "dependent");
/** The expenses are typed, not mostly our guesses (Expenses' own guessedShare). */
const monthTyped = (p, { today = null } = {}) => { try { return L(p, "expenses").length > 0 && (Number(expenses(p, { today }).guessedShare) || 0) < 0.5; } catch { return false; } };
/** Setup finished, or the Dashboard's first five steps are done (the sixth, assumptions, is left out). */
const questionsDone = (p) => !!p?.guide?.setup?.finishedAt || setupSteps(p).steps.filter((s) => s.key !== "assumptions").every((s) => s.done);
const rmdNow = (p, { today = null } = {}) => {
  const y = thisYearNum(today);
  if (!y) return false;
  const ad = adults(p).filter((a) => a.birthDate), first = ad.find((a) => a.role === "self") ?? ad[0];
  return ad.some((a) => rmdStartYear(a.birthDate) <= y + 1 && L(p, "accounts").some((x) => RMD_ACCOUNT_TYPES.includes(x.type) && Number(x.balance) > 0 && (x.ownerId === a.id || (a === first && !ad.some((q) => q.id === x.ownerId)))));
};
const rmdTaken = (p, { today = null } = {}) => { const y = thisYearNum(today); return !!y && Object.keys(p?.retirement?.rmdTaken?.[y] ?? {}).length > 0; };
/** The projection's own saving verdict (cached by partsFor): tight or short. */
// (no retirement savings on file and nothing going in: the forecast says "we don't know yet", so there is nothing to help with
// yet and the step is left out; stress test 2026-11-11, j-first-renter/F4: "we can't say" above "$60,930 short")
const savingHelp = (p, { today = null } = {}) => { try { const v = savingVerdict(p, { today }); return !!v && (v.verdict === "tight" || v.verdict === "short") && !savingsUnknown(projection(p, { today })); } catch { return false; } };
/** Which keys of the path apply to this plan. Cheap except `fix-retire`, which runs the projection (partsFor caches it). */
export function pathApplies(p, { today = null } = {}) {
  const retired = householdRetired(p, { today });
  return {
    answers: true, month: true,
    debts: debtsToPay(p).length > 0,
    cushion: true,
    protect: protectionAsks(p, { today }),
    retire: true,
    "fix-retire": retirementKnown(p, today) && savingHelp(p, { today }),
    "take-out": retired,
    rmd: rmdNow(p, { today }),
    home: wantsGoal(p, "home") || houseGoal(p),
    college: hasChildren(p) && wantsGoal(p, "education", /college|education|529|school/i),
    taxes: paidWork(p, { today }),
  };
}
/** Steps left out of the path for this plan, and the wording for a household already retired. `off`: pages turned off or hidden. */
export const pathVariant = (p, { today = null, off = [] } = {}) => {
  let ap = null;
  try { ap = pathApplies(p, { today }); } catch { ap = null; }
  if (!ap) return null;
  const steps = {};
  for (const s of PATH_STEPS) if (!ap[s.key] || off.includes(s.page)) steps[s.key] = null;
  const retired = householdRetired(p, { today });
  if (retired) {
    steps.month = steps.month === null ? null : { title: "See what comes in and goes out" };
    if (steps["fix-retire"] !== null) steps["fix-retire"] = { ask: "Each card is one change that would make the money last, like spending a little less." };
  }
  // the step card says only what the page shows (stress test 2026-11-11, j-first-freelancer/F5): no "rows marked our guess"
  // over a page with no rows, no "read the answer at the top" over a forecast that cannot answer yet
  if (steps.month !== null) steps.month = { ...(steps.month ?? {}), ask: monthAsk(p, { today, retired }) };
  if (steps.retire !== null && !retired && retirementKnown(p, today)) {
    let unknown = false;
    try { unknown = savingsUnknown(projection(p, { today })); } catch { unknown = false; }
    if (unknown) steps.retire = { ask: "Your retirement savings are not in the plan yet, so this page cannot say whether the money lasts. Tap Add what you own, or go on and come back." };
  }
  return { steps };
};
/** What "Your retirement" waits for: the Social Security figure (setup's retirementGap), never blocking. */
const retireWaits = (p) => { try { const g = retirementGap(p); return g ? { what: g.what, href: `#/${g.go.join("/")}` } : null; } catch { return null; } };

/** What "Your month" waits for: the pay (what is left each month needs it; the page itself takes the spending), never blocking
 * (stress test 2026-11-11, j-first-freelancer/F5: the step said "read what is left each month at the top" over a page with no pay). */
// (a household already retired lives on its savings: no pay is not something the page waits for)
const monthWaits = (p, { today = null } = {}) => (L(p, "income").length || householdRetired(p, { today }) ? null : { what: "your pay", href: "#/cashflow/income" });
/** What the "Your month" step asks, from what Expenses shows: the empty form, the bills with our guesses, or typed bills. */
export function monthAsk(p, { today = null, retired = false } = {}) {
  const read = retired ? "Read what comes from your savings each month at the top." : "Read what is left each month at the top.";
  if (!L(p, "expenses").length) return "Type each bill or spending you know, then tap Add expense; or go on, and the plan uses our guesses until you do.";
  let guessed = 0;
  try { guessed = Number(expenses(p, { today }).guessedShare) || 0; } catch { guessed = 0; }
  return guessed > 0 ? `${read} Some bills are our guesses: open See or change each bill, then type yours or leave them.`
    : `${read} To change a bill, open See or change each bill.`;
}

/** What "Emergency fund" waits for: any account at all (the page has nothing to show without one), never blocking. */
const cushionWaits = (p) => ((p?.accounts ?? []).length ? null : { what: "your accounts and spending", href: "#/balance/net-worth" });

export const PATH_STEPS = [
  { key: "answers", name: "The questions", page: "overview/setup", title: "Answer a few easy questions", short: "Answer the questions", ask: "Answer one question at a time, and skip any you don't know.", doneWhen: "it is done once you reach the end of the questions.", check: questionsDone, looked: true },
  { key: "month", name: "Your month", page: "cashflow/expenses", title: "See what's left each month", short: "See your month", ask: "Read what is left each month at the top; rows marked our guess are figures we filled in, so tap a row to type yours, or leave them.", doneWhen: "it is done once most of your spending is typed by you, or you go on.", check: monthTyped, looked: true, waits: monthWaits },
  { key: "debts", name: "Your debts", page: "debt/payoff", title: "See when your debts are gone", short: "See your debt plan", ask: "See the month you'll be debt-free; to keep this plan, tap Save plan.", doneWhen: "it is done once you tap Save plan, or you go on.", check: (p) => !!p?.debtPlan?.order, looked: true, ownAction: "Save plan" },
  { key: "cushion", name: "Emergency fund", page: "balance/liquidity", title: "See your emergency fund", short: "See emergency fund", ask: "See how many months your cash would cover the bills you have to pay, if your pay stopped or a big repair came up.", doneWhen: "it is done once you go on.", looked: true, waits: cushionWaits },
  { key: "protect", name: "Life insurance for your family", page: "insurance/life-needs", title: "Check life insurance for the people who count on you", short: "Check life insurance", ask: "See whether your family would be all right if an earner died, and how much life insurance would close the gap.", doneWhen: "it is done once a life policy is saved, or you go on.", check: lifePolicy, looked: true, none: "No one depends on my pay", noneSaid: "You said no one depends on your pay." },
  { key: "retire", name: "Your retirement", page: "retirement/projection", title: "See if your money lasts", short: "See if money lasts", ask: "Read the answer at the top: whether your money lasts, and to what age.", doneWhen: "it is done once you go on.", looked: true, waits: retireWaits },
  { key: "fix-retire", name: "What would help", page: "scenarios/goal-seek", title: "See what would make it last", short: "See what would help", ask: "Each card is one change that would make the money last, like stopping work later or spending less.", doneWhen: "it is done once you go on.", looked: true },
  { key: "take-out", name: "Where to take money from", page: "retirement/withdrawal-strategy", title: "See where to take money from each year", short: "See what to take out", ask: "Read the first line: how much to take from savings this year, and from which accounts.", doneWhen: "it is done once you go on.", looked: true },
  { key: "rmd", name: "The yearly amount the law requires", page: "retirement/rmd", title: "Check what the law says you must take out", short: "Check required amount", ask: "See how much the law says you must take out this year, from which accounts and by when.", doneWhen: "it is done once you mark it taken, or you go on.", check: rmdTaken, looked: true },
  { key: "home", name: "The home you can afford", page: "goals/house", title: "See the home you can afford", short: "See your price range", ask: "See the price your pay supports at the top; the rate and down payment are typical figures until you type yours.", doneWhen: "it is done once you tap Work it out, or you go on.", check: (p) => !!p?.whatIfs?.house, looked: true, ownAction: "Work it out" },
  { key: "college", name: "College costs", page: "goals/education", title: "See what college could cost", short: "See college costs", ask: "See what college could cost for each child, and how much to save a month.", doneWhen: "it is done once you go on.", looked: true },
  { key: "taxes", name: "This year's tax", page: "taxes/federal", title: "See this year's tax: refund or bill", short: "See this year's tax", ask: "Read the answer at the top: what comes back, or what you owe, in April.", doneWhen: "it is done once you go on.", check: (p) => p?.taxes?.thisYear?.withheldTyped === true, looked: true },
];


export const JOURNEYS = [
  {
    id: PATH_ID, icon: "🧭", title: "Build my plan", minutes: 20,
    line: "A few easy questions, then a quick look at each step. About 20 minutes in all; stop any time.",
    haveReady: "Nothing special. Rough numbers are fine, and we fill in what you don't know.",
    steps: PATH_STEPS, variant: pathVariant,
    more: [],
    finish: { page: "overview/plan", label: "See your plan", text: "You've done every step of your plan." },
  },
  {
    id: "debt", icon: "💳", title: "Pay off what I owe", minutes: 10,
    line: "Every loan and card, the order to pay them in, and the month the last one is paid off.",
    haveReady: "Your latest card and loan statements.",
    steps: [
      { key: "add", page: "balance/net-worth", title: "Add each loan and card", short: "Add loans and cards", target: "Type", ask: "Add every card, loan and mortgage with what you owe today (if accounts are listed already, tap + Add another account first), choose its kind under Type, like Credit card or Mortgage, then tap Add account.", doneWhen: "it is done once one card, loan or mortgage is saved as an account.", check: (p) => debtAccounts(p).length > 0 },
      { key: "rates", page: "balance/liabilities", title: "Give each its rate and payment", short: "Add rates, payments", ask: "Open each loan and card, type its yearly interest rate and the payment you must make each month, then tap Save.", doneWhen: "it is done once each loan and card you owe on has a rate and a payment saved.", check: (p) => detailed(p), needs: ["add"] },
      { key: "order", page: "debt/payoff", title: "Pick your payoff order", short: "Pick payoff order", ask: "Choose any extra you can pay each month and which debt goes first, then tap Save plan.", doneWhen: "it is done once you tap Save plan.", check: (p) => !!p?.debtPlan?.order, needs: ["rates"] },
      { key: "cards", page: "debt/credit-cards", title: "Check your credit cards", short: "Check your cards", ask: "See what paying only the minimum costs, and whether moving the balance to a card that charges no interest for a while would help.", doneWhen: "it is done once you tap the button below after looking.", looked: true, optional: true, show: (p) => hasType(p, "credit"), why: "Because you have a credit card.", needs: ["rates"] },
      { key: "student", page: "debt/student-loans", title: "Pick a student loan plan", short: "Pick a loan plan", ask: "Compare the government's repayment plans, including ones based on what you earn; if you work full time for government or a nonprofit, open Your situation, check the box and tap Save.", doneWhen: "it is done once you tap Save, or the button below after looking.", check: (p) => !!p?.whatIfs?.studentLoans, looked: true, optional: true, show: (p) => hasType(p, "student_loan"), why: "Because you have a student loan." },
      { key: "one-loan", page: "debt/consolidation", title: "See if one loan is cheaper", short: "See if one loan helps", ask: "See what rolling your high-rate cards and loans into one cheaper loan or card would cost against paying as you do now; to change the offers' rates, open The offers and tap Compare.", doneWhen: "it is done once you tap Compare, or the button below after looking.", check: (p) => !!p?.whatIfs?.consolidation, looked: true, optional: true, show: oneLoanHelps, why: "Because you have more than one card or loan, and one charges 10% or more.", needs: ["rates"] },
    ],
    more: [
      { page: "debt/ratios", title: "What do lenders see?" },
      { page: "debt/refinance", title: "Would refinancing a loan save money?" },
      { page: "debt/mortgage", title: "How fast could the mortgage be paid off?" },
      { page: "overview/next-best-action", title: "Where should my next spare dollar go?" },
    ],
    finish: { page: "debt/payoff", label: "Open your payoff plan", text: "Your loans and cards, their rates and the order to pay them are in your plan." },
  },
  {
    id: "budget", icon: "💵", title: "Spend less, save more", minutes: 20,
    line: "See where the money goes, set a budget you can keep, and start an emergency fund.",
    haveReady: "Your regular bills, or your bank's website on your computer.",
    steps: [
      { key: "income", page: "cashflow/income", title: "Enter what comes in", short: "Enter what comes in", ask: "List each paycheck and any other money coming in, then tap Add income, and + Add another income for the next.", doneWhen: "it is done once one income is saved.", check: (p) => L(p, "income").length > 0 },
      { key: "accounts", page: "balance/net-worth", title: "Add your bank and card accounts", short: "Add bank accounts", ask: "Add the checking account and cards your money moves through, with today's balances (if accounts are listed already, tap + Add another account first), then tap Add account.", doneWhen: "it is done once a checking, savings or card account is saved.", check: (p) => hasType(p, ...SAVINGS) },
      { key: "spending", page: "cashflow/expenses", title: "Add what you spend", short: "Add your spending", ask: "Type each regular bill or spending, uncheck \"I must pay this\" for anything you could do without, then tap Add expense, and + Add another expense for the next.", doneWhen: "it is done once one expense or one bank file is saved.", check: (p) => L(p, "transactions").length > 0 || L(p, "expenses").length > 0, alt: { page: "transactions/import", label: "Have a file from your bank? Bring it in instead", ask: "Bring in a file from your bank's website, easiest on your computer (the account it comes from must be on Net worth first); what it shows going out counts for this step." } },
      { key: "budget", page: "cashflow/budget", title: "Set a budget", short: "Set a budget", ask: "Give each kind of spending an amount for the month: tap Add envelope, and + Add another envelope for the next.", doneWhen: "it is done once one envelope or a split is saved.", check: (p) => L(p, "budgets").length > 0 || !!p?.whatIfs?.budgetPercent, alt: { page: "cashflow/budget-percent", label: "Prefer one simple rule? Split your pay into needs, wants and savings", ask: "Lower down, under The split to aim for, pick a split (50 / 30 / 20 is the usual one) and tap Save; it needs your income and spending first.", opens: "The split to aim for" } },
      { key: "cushion", page: "goals/goals", title: "Start an emergency fund", short: "Start emergency fund", ask: "Add a goal named Emergency fund for three to six months of the bills you must pay (if goals are listed already, tap + Add another goal first), then tap Add goal.", doneWhen: "it is done once a goal named Emergency fund is saved.", check: emergencyGoal, alt: { page: "goals/emergency-fund", label: "See how big it should be", ask: "See how many months of must-pay bills to keep (it needs your bills from step 3), then add the goal on Goals." } },
      { key: "sort", page: "transactions/categorize", title: "Sort your spending into groups", short: "Sort your spending", ask: "Give each payee a category, like Groceries, in a few taps; the app remembers it next time.", doneWhen: "it is done once most of your bank rows have a group, or you tap the button below after looking.", check: (p) => L(p, "transactions").length > 0 && categorize(p).share >= 0.9, looked: true, optional: true, show: (p) => L(p, "transactions").length > 0, why: "Because you brought in a bank file." },
    ],
    more: [
      { page: "cashflow/spending", title: "Where does the money go?" },
      { page: "cashflow/subscriptions", title: "Which subscriptions do I pay for?" },
      { page: "cashflow/recurring", title: "Which bills come every month?" },
      { page: "cashflow/forecast", title: "Will the money last to the end of the month?" },
      { page: "cashflow/sinking-funds", title: "How do I save for bills that come once a year?" },
      { page: "overview/monthly-review", title: "Check in on the month" },
      { page: "transactions/rules", title: "Sort new bank rows by themselves" },
    ],
    finish: { page: "cashflow/budget", label: "Open your budget", text: "What comes in, where it goes, your budget and your emergency fund are in your plan." },
  },
  {
    id: "home", icon: "🏡", title: "Buy a home", minutes: 15,
    line: "What you can afford, renting against buying, and when the down payment is ready.",
    haveReady: "A price you have in mind and your latest pay stub.",
    steps: [
      { key: "pay", page: "cashflow/income", title: "Enter your pay", short: "Enter your pay", ask: "Add what you earn, then tap Add income, so the plan can say how much home it supports.", doneWhen: "it is done once one income is saved.", check: (p) => L(p, "income").length > 0 },
      { key: "afford", page: "goals/house", title: "See what you can afford", short: "See your price range", ask: "Type the home price, the down payment and the mortgage rate you have in mind, then tap Work it out.", doneWhen: "it is done once you tap Work it out.", check: (p) => !!p?.whatIfs?.house },
      { key: "goal", page: "goals/house", title: "Make the down payment a goal", short: "Set down payment goal", ask: "Tap Make it a goal so the plan saves toward the cash you need on the day.", doneWhen: "it is done once the down payment is saved as a goal.", check: houseGoal, needs: ["afford"] },
      { key: "lenders", page: "debt/ratios", title: "See what lenders see", short: "See what lenders see", ask: "See the shares of your pay a lender checks, from what you pay today on housing, loans and cards; the home you just priced is not counted here (Home affordability showed its share).", doneWhen: "it is done once you tap the button below after looking.", looked: true, optional: true, show: (p) => debtAccounts(p).length > 0, why: "Because you have loans or cards, which lenders count too.", needs: ["pay"] },
      { key: "rent-buy", page: "property/rent-vs-buy", title: "Compare renting and buying", short: "Compare rent and buy", ask: "Type the home price, down payment and mortgage rate from Home affordability (this page starts from its own example), the rent for a similar home and the years you would stay, then tap Compare.", doneWhen: "it is done once you tap Compare, or the button below after looking.", check: (p) => !!p?.whatIfs?.rentVsBuy, looked: true, optional: true, why: "Worth a look if you rent now." },
      { key: "fit", page: "goals/prioritizer", title: "Fit it with your other goals", short: "Fit with other goals", ask: "See which goals arrive on time when the money is shared between them.", doneWhen: "it is done once you tap the button below after looking.", looked: true, optional: true, show: (p) => L(p, "goals").length > 1, why: "Because you have more than one goal." },
    ],
    more: [
      { page: "debt/mortgage", title: "What will the mortgage cost over the years?" },
      { page: "property/home", title: "What is the home worth once you own it?" },
      { page: "goals/emergency-fund", title: "How much cash to keep after you buy?" },
    ],
    finish: { page: "goals/house", label: "Open your home numbers", text: "What you can afford and the down payment goal are in your plan." },
  },
  {
    id: "retire", icon: "🌴", title: "Plan my retirement", minutes: 20,
    line: "Whether your money will last from the age you want to stop working, and what you will live on.",
    haveReady: "Your latest retirement account statements and your Social Security statement (the paper one, or from ssa.gov).",
    steps: [
      { key: "people", page: "household/people", title: "Add your birth dates", short: "Add birth dates", ask: "Give each adult a birth date and the age they want to stop working, then tap Add person or Save changes.", doneWhen: "it is done once every adult has a birth date.", check: (p) => adults(p).length > 0 && adults(p).every((x) => !!x.birthDate) },
      { key: "savings", page: "balance/net-worth", title: "Add your savings", short: "Add your savings", ask: "List your savings and retirement accounts with today's balances (if accounts are listed already, tap + Add another account first), then tap Add account.", doneWhen: "it is done once one savings or retirement account is saved.", check: (p) => L(p, "accounts").some((a) => !isLiability(a.type)) },
      { key: "spend", page: "retirement/projection", title: "Say what you will spend", short: "Say what you'll spend", ask: "Open Retirement settings near the bottom, type what you expect to spend a month once you stop working at today's prices, then tap Save settings.", doneWhen: "it is done once a monthly amount is saved here, or your bills are on the Expenses page.", check: (p) => Number(p?.retirement?.spendingMonthly) > 0 || L(p, "expenses").length > 0, alt: { page: "cashflow/expenses", label: "Not sure what you'll spend? Enter what you spend now instead", ask: "List your regular bills and spending, then tap Add expense; the plan uses what you spend now for retirement." }, needs: ["people", "savings"] },
      { key: "ss", page: "retirement/social-security", title: "Add your Social Security", short: "Add Social Security", ask: "Type the monthly amount your Social Security statement shows at full retirement age, or paste your earnings from ssa.gov, then tap Save.", doneWhen: "it is done once one person's Social Security is saved.", check: socialSecurity, none: "I won't get Social Security", noneSaid: "You said you won't get Social Security.", needs: ["people"] },
      { key: "saving", page: "retirement/contributions", title: "Add what you save now", short: "Add what you save", ask: "If your 401(k), IRA or Roth is not on Net worth yet, add it there first (this page links to it); then say what goes into each one from each paycheck, and what an employer adds, and tap Add contribution.", doneWhen: "it is done once one contribution is saved.", check: (p) => (p?.retirement?.contributions ?? []).length > 0, none: "I'm not saving for retirement now", noneSaid: "You said you are not saving for retirement now.", needs: ["savings"] },
      { key: "pension", page: "retirement/pensions", title: "Add a pension", short: "Add a pension", ask: "If you have a pension, say what it pays a month and from what age, then tap Add pension.", doneWhen: "it is done once a pension is saved, or you say you have none.", check: pension, none: "I don't have a pension", noneSaid: "You said you don't have a pension." },
      { key: "chance", page: "retirement/monte-carlo", title: "See if the money lasts", short: "See if money lasts", ask: "See how often the money lasts to the end of the plan when markets go up and down.", doneWhen: "it is done once you tap the button below after looking.", looked: true, needs: ["people", "savings", "spend"] },
    ],
    more: [
      { page: "scenarios/goal-seek", title: "When could I stop working?" },
      { page: "retirement/healthcare", title: "What will health care cost before 65?" },
      { page: "retirement/medicare", title: "What will Medicare cost me?" },
      { page: "retirement/withdrawal-strategy", title: "How much can I take out each year?" },
      { page: "retirement/fire", title: "Could I stop work early?" },
      { page: "retirement/longevity", title: "How long must the money last?" },
      { page: "scenarios/stress-tests", title: "What if markets fall?" },
      { page: "reports/retirement", title: "A summary to print" },
    ],
    finish: { page: "retirement/projection", label: "Open your retirement forecast", text: "Your ages, savings, spending and Social Security are in your plan." },
    variant: retiredVariant,
  },
  {
    id: "taxes", icon: "🧮", title: "Sort out my taxes", minutes: 15,
    line: "Estimate this year's tax, check what your paychecks take out, and pay no more than you must.",
    haveReady: "Your latest pay stub and last year's tax return.",
    steps: [
      { key: "people", page: "household/people", title: "Say who is in your household", short: "Add your household", ask: "First choose how you file your taxes under Taxes, lower down (it saves as soon as you pick it), then add the people in your household and tap Add person.", doneWhen: "it is done once one person is saved.", check: (p) => (p?.household?.people ?? []).length > 0 },
      { key: "income", page: "cashflow/income", title: "Enter what comes in", short: "Enter what comes in", ask: "List your pay and other income, then tap Add income; or type the year's figures on the next step.", doneWhen: "it is done once one income is saved.", check: (p) => L(p, "income").length > 0 || (p?.taxes?.thisYear?.wages ?? null) !== null },
      { key: "estimate", page: "taxes/federal", title: "Estimate this year's tax", short: "See this year's tax", ask: "Lower down, under Figures the plan cannot see, type what your pay stub shows as federal income tax so far this year (year to date) in Federal tax withheld so far, then tap Save figures.", doneWhen: "it is done once you tap Save figures, or the button below after looking.", check: (p) => p?.taxes?.thisYear?.withheldTyped === true, looked: true, opens: "Figures the plan cannot see" },
      { key: "paychecks", page: "taxes/withholding", title: "Check your paychecks", short: "Check your paychecks", ask: "Lower down, under What a paycheck withholds, type the federal tax one paycheck takes out for each of you who has tax taken (the Federal income tax line on the pay stub), then tap Save.", doneWhen: "it is done once one paycheck's tax is saved.", check: paycheckTax, opens: "What a paycheck withholds", none: "No tax is taken from my pay", noneSaid: "You said no tax is taken from your pay.", needs: ["income"] },
      { key: "state", page: "taxes/state", title: "Add your state", short: "Add your state", ask: "Choose the state you live in, which saves as soon as you pick it (once one is saved, the choice is under Your figures); if no tax shows, type State tax on last year's return and the income line under Your figures, then tap Save.", doneWhen: "it is done once your state is saved.", check: (p) => !!p?.household?.state },
      { key: "room", page: "investments/limits", title: "See how much more you can put in with a tax break", short: "See tax-break limits", ask: "See how much more you can put into a 401(k), an individual retirement account (IRA) or a health savings account this year.", doneWhen: "it is done once you tap the button below after looking.", looked: true, optional: true, why: "Worth a look if you save for retirement." },
    ],
    more: [
      { page: "taxes/hsa-fsa", title: "What does a health savings account save?" },
      { page: "taxes/estimated", title: "Do I need to pay tax every quarter?" },
      { page: "taxes/documents", title: "Which tax papers will I need?" },
      { page: "taxes/brackets", title: "Which tax bracket am I in?" },
      { page: "taxes/capital-gains", title: "What is the tax on what I sell?" },
      { page: "taxes/filing-status", title: "Which way of filing costs least?" },
      { page: "taxes/self-employment", title: "What tax do I owe on work for myself?" },
      { page: "reports/tax", title: "A tax summary to print" },
    ],
    finish: { page: "taxes/federal", label: "Open your tax estimate", text: "This year's estimate, your paychecks and your state are in your plan." },
  },
  {
    id: "protect", icon: "🛡️", title: "Protect my family", minutes: 30,
    line: "Check your insurance, say who gets what, and keep the important papers easy to find.",
    haveReady: "Your insurance policies and any will or power of attorney you have signed.",
    steps: [
      { key: "people", page: "household/people", title: "Add who counts on you", short: "Add your household", ask: "Add yourself, a partner and your children, with birth dates, then tap Add person.", doneWhen: "it is done once one adult with a birth date is saved.", check: (p) => adults(p).some((x) => !!x.birthDate) },
      { key: "policies", page: "insurance/policies", title: "List your insurance", short: "List your insurance", ask: "Add every policy you have (life, disability, health, home and car), then tap Add policy.", doneWhen: "it is done once one policy is saved, or you say you have none.", check: (p) => (p?.insurance?.policies ?? []).length > 0, none: "I don't have any policies", noneSaid: "You said you don't have any policies." },
      // life insurance needs works from the retirement projection's inputs (accounts, spending, adults' birth dates)
      { key: "savings", page: "balance/net-worth", title: "Add your savings", short: "Add your savings", ask: "List your bank, savings and retirement accounts with today's balances, then tap Add account.", doneWhen: "it is done once one account is saved.", check: (p) => L(p, "accounts").length > 0 },
      { key: "spend", page: "cashflow/expenses", title: "Add what your family spends", short: "Add your spending", ask: "List your regular bills and spending, then tap Add expense; life insurance is sized to cover them.", doneWhen: "it is done once one expense is saved.", check: (p) => L(p, "expenses").length > 0 },
      { key: "life", page: "insurance/life-needs", title: "See how much life insurance you need", short: "See insurance needed", ask: "See how much life insurance each of you needs, compared with the coverage you already have.", doneWhen: "it is done once you tap the button below after looking.", looked: true, needs: ["people", "savings", "spend"] },
      { key: "papers", page: "estate/documents", title: "Note your will and health papers", short: "Check will and papers", ask: "Tap each paper, like a will or a health care power of attorney, set its Status and Where the original is kept, then tap Save.", doneWhen: "it is done once one paper is noted, even as not made yet.", check: (p) => (p?.estate?.documents ?? []).length > 0, none: "I have none of these yet", noneSaid: "You said you have none of these papers yet." },
      { key: "contacts", page: "household/contacts", title: "Add who to call", short: "Add who to call", ask: "Add someone to call in an emergency, and your advisor, lawyer and insurers, then tap Add.", doneWhen: "it is done once one person to call is saved.", check: (p) => L(p, "contacts").length > 0 },
      { key: "who-gets", page: "estate/beneficiaries", title: "Check who inherits each account", short: "Check who inherits", ask: "Tap each retirement account and life policy, write who is named on its beneficiary form, then tap Save.", doneWhen: "it is done once one account's heirs are saved.", check: (p) => (p?.estate?.beneficiaries ?? []).length > 0, optional: true, show: (p) => hasType(p, ...RETIRE) || lifePolicy(p), why: "Because you have a retirement account or a life policy." },
    ],
    more: [
      { page: "insurance/disability", title: "What if I could not work?" },
      { page: "household/documents", title: "Where are the important papers kept?" },
      { page: "estate/digital", title: "What happens to my online accounts?" },
      { page: "insurance/property", title: "Is the home and car insurance enough?" },
      { page: "insurance/health", title: "Which health plan costs least?" },
      { page: "insurance/ltc", title: "Should I plan for long-term care?" },
      { page: "estate/estate-tax", title: "Will there be estate tax?" },
    ],
    finish: { page: "insurance/life-needs", label: "Open your life insurance check", text: "Your household, insurance, papers and who to call are in your plan." },
  },
];

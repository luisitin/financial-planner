// modules/overview/setup/compute.js -- PURE. "Set up my plan": a conversation, one question per screen. This file
// holds the screens, the choices on them, and the functions that turn each screen's answers into plan records in the
// exact shapes the real pages write (People, Income, Net worth, Liabilities, Expenses, Goals, Retirement contributions,
// Social Security, Assumptions), plus "where you stand" at the end, read from the pages' own computes.
// The rules (README "What the setup writes"): records it makes carry ids starting "setup-", so going back and changing
// an answer updates the same records; a record that exists gets only the fields its screen asks for; a kind of record
// the plan already has (made on its own page) is shown and not asked again; nothing that another record points at is
// ever removed; a blank box saves nothing.
import { CATEGORIES, compute as computeExpenses, BANK_SPREAD } from "../../cashflow/expenses/compute.js";
import { bankVsPlan } from "../../cashflow/income-statement/compute.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeNetWorth, ACCOUNT_TYPES, countedBalance } from "../../balance/net-worth/compute.js";
import { compute as computeLiquidity, TIERS } from "../../balance/liquidity/compute.js";
import { compute as computeLiabilities } from "../../balance/liabilities/compute.js";
import { compute as computeNext, HIGH_RATE, MODERATE_RATE, cushionLater } from "../next-best-action/compute.js";
import { compute as computeProjection, retirementKnown, ssOnIncome } from "../../retirement/projection/compute.js";
import { compute as computeSocialSecurity, estimateBenefit, claimFactor, fullRetirementAge, LAST_AWI_YEAR } from "../../retirement/social-security/compute.js";
import { WAGE_INDICES } from "../../retirement/social-security/data/ssa.js";
import { STATE_NAMES, NO_WAGE_TAX } from "../../taxes/state/compute.js";
import { QUARTERS } from "../../taxes/estimated/compute.js";
import { perYear, activeOn } from "../../../core/math/periods.js";
import { ageOn } from "../../../core/math/dates.js";
import { nper, TYPICAL_TERMS, typicalPayment } from "../../../core/math/finance.js";
import { money as fmtMoney } from "../../../core/format.js";
import { isGuess, guessAt, markGuess, clearGuess } from "../../../core/estimate/index.js";
import { RETIRE_RATIO, spendBasis, spendTenure } from "../guesses/estimators/spend.js";
import { escrowMonthly, SETUP_HOME_ENTRY, homeEntryFor, loanEscrow } from "../guesses/estimators/home.js";
import { startOf as loanStartOf, recordOf } from "../guesses/estimators/debts.js";
import { profileOf } from "../guesses/estimators/common.js";
import { payOf as payFromEmployer } from "../guesses/estimators/saving.js";
import { PART_B } from "../../retirement/medicare/data/medicare.js";
import { limitKind } from "../../retirement/contributions/compute.js";
import { leftMarker, leftOverOf, setupRowsMonthly, yearSaving, yearSavingWords } from "../../../core/math/leftover.js";
export { leftMarker, leftOverOf, yearSaving, yearSavingWords };

const L = (p, k) => (Array.isArray(p?.[k]) ? p[k] : []);
export const isSetupId = (id) => typeof id === "string" && id.startsWith("setup-");

/**
 * A money box's text as a number: "$4,000", "4000.50", "4k", "1.2m", " 950 " all work; blank or nonsense is null
 * (a blank box saves nothing, it never becomes 0).
 */
export function parseMoney(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim().toLowerCase().replace(/[$€£,\s%]/g, "");
  if (!s) return null;
  const m = s.match(/^(-?\d*\.?\d+)([km])?$/);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] === "k" ? 1e3 : m[2] === "m" ? 1e6 : 1);
  return Number.isFinite(n) ? n : null;
}
const pos = (v) => { const n = parseMoney(v); return n !== null && n > 0 ? n : null; };
const nonneg = (v) => { const n = parseMoney(v); return n !== null && n >= 0 ? n : null; };
/** "Year you bought it": four digits from 1950 to this year (`thisYear`, from the plan's today: no hidden clock) -> the year; blank or anything else -> null. */
export function parseYear(v, thisYear = 2200) {
  const t = String(v ?? "").trim();
  if (!/^\d{4}$/.test(t)) return null;
  const y = Number(t);
  return y >= 1950 && y <= thisYear ? y : null;
}
const round2 = (n) => Math.round(n * 100) / 100;

/** The screens in order. `q` is the question number shown ("Question 3 of 7"); a follow-up screen shares its question's. */
export const SCREENS = [
  { id: "welcome" },
  { id: "you", q: 1 },
  { id: "money", q: 2 },
  { id: "ages", q: 3 },
  { id: "have", q: 4 },
  { id: "have-amounts", q: 4, follow: true, show: (p) => haveKeys(p).some((k) => askOwners(p, k).length > 0) },
  { id: "owe", q: 5 },
  { id: "owe-amounts", q: 5, follow: true, show: (p) => picks(p, "owe").some((k) => k !== "none" && !oweTaken(p, k)) },
  { id: "spend", q: 6 },
  { id: "goals", q: 7 },
  { id: "goal-details", q: 7, follow: true, show: (p) => picks(p, "goals").some((k) => GOALS.find((g) => g.key === k && !g.focus) && !goalTaken(p, k)) },
  { id: "done" },
];
export const QUESTIONS = 7;

/** What you have: one account each (retirement: one per adult). `types` = the Net worth types that count as "already have". */
export const HAVE = [
  { key: "checking", icon: "🏦", label: "Checking", line: "Everyday spending", type: "checking", types: ["checking"], name: "Checking" },
  { key: "savings", icon: "💰", label: "Savings", line: "Including money market", type: "savings", types: ["savings", "cash"], name: "Savings" },
  { key: "retire", icon: "🌴", label: "Retirement", line: "401(k), 403(b) or IRA", type: "401k", types: ["401k", "ira", "roth"], perAdult: true, name: "retirement" },
  { key: "invest", icon: "📈", label: "Investments", line: "Outside retirement", type: "brokerage", types: ["brokerage", "crypto"], name: "Investments" },
  { key: "home", icon: "🏡", label: "A home", line: "That you own", type: "property", types: ["property"], name: "Home", ask: "What it would sell for today" },
  { key: "car", icon: "🚗", label: "A car", line: "Or another vehicle", type: "vehicle", types: ["vehicle"], name: "Car", ask: "What it is worth today" },
];
/** The retirement box's two kinds: through work (a 401(k) or 403(b), with an employer match) or on your own (an IRA). */
export const RETIRE_KINDS = [{ value: "work", label: "Through work", type: "401k", group: ["401k", "roth"] }, { value: "own", label: "On my own", type: "ira", group: ["ira", "roth"] }];
/**
 * "Which kind of IRA?" under On my own (round 8, item 35): Traditional saves `ira`, Roth saves `roth`, Not sure saves `ira`
 * (counted as traditional for now, and listed among our guesses on the done screen). No answer: as before.
 */
export const IRA_KINDS = [{ value: "traditional", label: "Traditional" }, { value: "roth", label: "Roth" }, { value: "unsure", label: "Not sure" }];
/** What you owe. */
export const OWE = [
  { key: "credit", icon: "💳", label: "Credit cards", type: "credit", name: "Credit cards" },
  { key: "car-loan", icon: "🚗", label: "Car loan", type: "loan", name: "Car loan" },
  { key: "student", icon: "🎓", label: "Student loans", type: "student_loan", name: "Student loans" },
  { key: "mortgage", icon: "🏠", label: "Mortgage", type: "mortgage", name: "Mortgage" },
  { key: "loan", icon: "📄", label: "Another loan", type: "loan", name: "Other loan" },
];
/**
 * A typical yearly rate for a debt whose rate box is left blank, so its interest and payoff can be shown at once. The
 * Liabilities row keeps the guess in `rateGuessed` and counts as guessed while its rate still equals it. All read
 * 2026-11-01:
 *   credit    22.36%  Federal Reserve G.19 Consumer Credit, release of October 7, 2026, "Commercial bank interest
 *                     rates, credit card plans, accounts assessed interest", August 2026 (preliminary)
 *   car-loan   7.17%  same release, new car loans, 72-month, August 2026 (preliminary)
 *   loan      11.90%  same release, personal loans, 24-month, August 2026 (preliminary)
 *   mortgage   7.24%  Freddie Mac Primary Mortgage Market Survey, 30-year fixed, week of October 29, 2026
 *                     (freddiemac.com/pmms); a loan taken out in an earlier year may well cost less
 *   student    6.52%  studentaid.gov "Interest Rates for Direct Loans First Disbursed on or After July 1, 2026, and
 *                     Before July 1, 2027", Direct Subsidized and Unsubsidized, undergraduate
 */
export const TYPICAL_RATES = { credit: 0.2236, "car-loan": 0.0717, loan: 0.119, mortgage: 0.0724, student: 0.0652 };
export const TYPICAL_CARD_RATE = TYPICAL_RATES.credit;
/** A Liabilities row's rate is still the setup's guess (nobody has typed a real one since). */
export const rateIsGuess = (d) => typeof d?.rateGuessed === "number" && Math.abs(Number(d.rate) - d.rateGuessed) < 1e-9;
/**
 * A payment a month for a debt whose payment box is left blank, so its cost is counted (a $0 payment would drop out of
 * spending and the cushion): a loan, the level payment that pays it off over a usual term (mortgage 30 years, car loan
 * 5, student loans 10 (the Standard plan for loans made before July 1, 2026; README), another loan 3; pmt in
 * core/math/finance.js); cards, a common minimum (the month's interest plus 1% of the balance). Kept on the row in `paymentGuessed`, a guess while the payment still equals it.
 */
// the shared ones (core/math/finance.js), so "Our guesses for you" can check an older payment against today's rate and
// balance without importing this module (the guesses import rule, spec 6.2)
export { TYPICAL_TERMS, typicalPayment };
export const paymentIsGuess = (d) => typeof d?.paymentGuessed === "number" && Math.abs(Number(d.minPayment) - d.paymentGuessed) < 0.005;
/**
 * A month's spending in two groups; must-pay comes from the group (and matches the categories' own `essential`).
 * `covers`: the Expenses categories a row stands for, so a row is not asked when the plan already has one of them.
 */
export const SPEND = [
  { key: "housing", group: "must", label: "Rent", labelMortgage: "Home costs besides the mortgage", labelOwn: "Home costs", help: "Rent, or property tax, insurance and fees if you own", helpRent: "What you pay in rent. Power and water go under utilities", helpMortgage: "Repairs and upkeep, plus HOA fees and any tax or insurance not in the mortgage payment", helpOwn: "Property tax, home insurance, HOA fees and upkeep", covers: ["housing"] },
  { key: "utilities", group: "must", label: "Utilities and phone", help: "Power, water, gas, internet, phones", covers: ["utilities", "phone"] },
  { key: "groceries", group: "must", label: "Groceries", help: "Food and household things", covers: ["groceries"] },
  { key: "transport", group: "must", label: "Car, gas and transit", help: "Gas, repairs, car insurance, fares. Not the loan payment", covers: ["transport"] },
  { key: "insurance", group: "must", label: "Insurance and health", help: "Health premiums (with what comes out of your pay), medicine, doctor visits", covers: ["insurance", "health"] },
  { key: "childcare", group: "must", label: "Childcare and school", help: "Daycare, fees, activities", kids: true, covers: ["childcare"] },
  { key: "dining", group: "else", label: "Eating out and fun", help: "Restaurants, outings, hobbies", covers: ["dining", "fun"] },
  { key: "shopping", group: "else", label: "Shopping and everything else", help: "Clothes, gifts, subscriptions", covers: ["shopping"] },
];
/**
 * The housing row as the household has it (the spending guesses' tenure, spendTenure: a mortgage owed; a home and no
 * mortgage; else renting): its label and help on question 6 and its name on Expenses. An owner with no mortgage is asked for
 * "Home costs" (property tax, insurance, HOA and upkeep), never "Rent" (C3 UX review 5). -> { kind, label, help, name }
 */
export function housingWords(plan) {
  const t = spendTenure(plan, profileOf(plan, null)), h = SPEND[0];
  return t === "ownerWithMortgage" ? { kind: "mortgage", label: h.labelMortgage, help: h.helpMortgage, name: "Home costs" }
    : t === "ownerWithoutMortgage" ? { kind: "own", label: h.labelOwn, help: h.helpOwn, name: "Home costs" }
    : { kind: "rent", label: h.label, help: h.helpRent, name: h.label };
}
/** The spending screen's one line on whose figures the grey ones are (guesses' spendBasis, spec 5.6). */
export { spendBasis };
/** What you are working toward. `focus` ones are not saving goals: they put a guide among the first moves instead. */
export const GOALS = [
  { key: "cushion", icon: "🛟", label: "A safety cushion", line: "For surprises", name: "Emergency fund" },
  { key: "debt", icon: "💳", label: "Paying off debt", line: "Be debt free", focus: true },
  { key: "home", icon: "🏡", label: "Buying a home", line: "The down payment", name: "House down payment", years: 3 },
  { key: "retire", icon: "🌴", label: "Retiring well", line: "Enough to stop working", focus: true },
  { key: "education", icon: "🎓", label: "Education", line: "Yours or the kids'", name: "Education", years: 10, match: /college|education|school|tuition|529/i },
  { key: "trip", icon: "✈️", label: "A big trip", line: "Somewhere special", name: "Big trip", years: 1, match: /trip|travel|vacation|holiday/i },
  { key: "car", icon: "🚗", label: "A car", line: "Paid in cash", name: "Next car", years: 3, match: /\b(car|vehicle|truck|suv)\b/i },
  { key: "other", icon: "🎯", label: "Something else", line: "You name it", name: "My goal", years: 2 },
];
export const PAY_PERIODS = [
  { value: "annual", label: "A year" },
  { value: "monthly", label: "A month" },
  { value: "biweekly", label: "Every 2 weeks" },
  { value: "semimonthly", label: "Twice a month" },
  { value: "weekly", label: "Every week" },
];
/** Other money coming in: the Income page type each kind is saved as. Child support is not taxed (IRS Pub. 504). */
/** Who pays the work in "What comes in?": an employer (a salary) or the person's own business or freelance work. */
export const WHO_PAYS = [
  { value: "employer", label: "An employer" },
  { value: "self", label: "Myself: my business or freelance" },
];
/**
 * "Retirement plan at work?", asked under pay from an employer (round 8, 2026-11-06). Its own answer,
 * `retirement.workPlans[personId].plan` (true / false), never the match: a plan says nothing about whether the employer adds
 * money (review D2). Yes writes `plan: true` and, when the person has no 401(k) or Roth 401(k) at a job they still have, a $0
 * 401(k) of its own (`setup-workplan-<personId>`), so Next best action, Benefits and Contributions ask about the match; No
 * writes `plan: false` and `match: false` (no plan, so no match: Next best action stops asking); Not sure writes nothing.
 */
export const WORK_PLAN = [{ value: "yes", label: "Yes" }, { value: "no", label: "No" }, { value: "unsure", label: "Not sure" }];
export const OTHER_KINDS = [
  { value: "business", label: "Side work", name: "Side work" },
  { value: "rental", label: "Rent I collect", name: "Rent coming in" },
  { value: "support", label: "Child support", name: "Child support", taxable: false },
  { value: "other", label: "Something else", name: "Other money coming in" },
];
export const DATE_CHIPS = [1, 2, 3, 5];
export const STATES = Object.entries(STATE_NAMES).map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));

// ---- reading the plan
const setupOf = (p) => p?.guide?.setup ?? {};
/**
 * The kinds Q4 and Q4b work on: what was ticked; or, when Q4 was never answered and a job's plan at work was said in Q2
 * (`retirement.workPlans[id].plan === true`), Retirement, so a plan at work is never left with nothing said about what goes in (C4 review U1).
 */
export const haveKeys = (p) => (Array.isArray(setupOf(p).picks?.have) ? setupOf(p).picks.have : planSaidFor(p).length ? ["retire"] : []);
/** The adults whose job has a retirement plan, said in Get started's Q2. */
export const planSaidFor = (p) => adults(p).filter((a) => p?.retirement?.workPlans?.[a.id]?.plan === true).map((a) => a.id);
/** The people whose retirement block Q4b asks although Retirement was not ticked (plan said at work; Q4 never answered). */
export const retireAskedFor = (p) => (Array.isArray(setupOf(p).picks?.have) ? [] : planSaidFor(p).filter((id) => askOwners(p, "retire").includes(id)));
export const picks = (p, kind) => (Array.isArray(setupOf(p).picks?.[kind]) ? setupOf(p).picks[kind] : []);
const people = (p) => (Array.isArray(p?.household?.people) ? p.household.people : []);
export const adults = (p) => people(p).filter((x) => x.role !== "dependent");
export const dependents = (p) => people(p).filter((x) => x.role === "dependent");
/** People typed on the People page (not by this setup): the setup then leaves the household's list alone. */
export const ownPeople = (p) => people(p).filter((x) => !isSetupId(x.id));
const byId = (list, id) => list.find((x) => x.id === id);
/** "My" for the person the setup named "Me", else "Ana's". */
export const possessive = (p) => (!p || p.name === "Me" ? "My" : `${p.name}'s`);
/**
 * Write a record: one that exists gets only `asked` (the fields its screen asks for, so what was changed on its own
 * page stays); a new one gets `full` and `asked`.
 */
function put(list, id, asked, full) {
  const r = byId(list, id);
  if (r) { Object.assign(r, asked); return r; }
  const rec = { id, ...full, ...asked };
  list.push(rec);
  return rec;
}
/** Setup account ids: what you have ("setup-have-<key>", retirement "setup-have-retire-<personId>") and what you owe ("setup-owe-<key>"). */
export const haveId = (key, pid) => `setup-have-${key}${pid ? `-${pid}` : ""}`;
export const oweId = (key) => `setup-owe-${key}`;
const isHave = (id) => typeof id === "string" && id.startsWith("setup-have-");
const isOwe = (id) => typeof id === "string" && id.startsWith("setup-owe-");
const haveKeyOf = (id) => HAVE.find((h) => id === haveId(h.key) || id.startsWith(`${haveId(h.key)}-`))?.key ?? null;
/** Accounts of a kind the plan already holds that this setup did not make (shown as "Already in your plan"). */
export const existingHave = (p, key) => { const h = HAVE.find((x) => x.key === key); return h ? L(p, "accounts").filter((a) => !isSetupId(a.id) && h.types.includes(a.type)) : []; };
/** Whose box to ask for a kind: nobody when the plan has one already; retirement, each adult without one of their own. */
export function askOwners(p, key) {
  const h = HAVE.find((x) => x.key === key);
  if (!h) return [];
  const have = existingHave(p, key), mine = (pid) => !!byId(L(p, "accounts"), haveId(key, pid));
  if (!h.perAdult) return have.length && !mine("") ? [] : [""];
  return adults(p).filter((a) => mine(a.id) || !have.some((x) => x.ownerId === a.id || !x.ownerId)).map((a) => a.id);
}
const carName = (a) => /car|auto|vehicle|truck/i.test(a.name ?? "");
export const existingOwe = (p, key) => { const o = OWE.find((x) => x.key === key); return o ? L(p, "accounts").filter((a) => !isSetupId(a.id) && a.type === o.type && (key !== "car-loan" || carName(a)) && (key !== "loan" || !carName(a))) : []; };
/** A debt kind is not asked when the plan already has one made elsewhere, unless the setup made its own first (it stays the setup's). */
export const oweTaken = (p, key) => existingOwe(p, key).length > 0 && !byId(L(p, "accounts"), oweId(key));
/**
 * The setup's own record and what carries it on: a line made here, or the new pay a raise from a later date saved on Income
 * started from one (`continues`, review 2026-11-02, round 5), so the money question still asks for it, a cleared box
 * clears both, and removing the person removes both.
 */
export const setupRoot = (x) => (isSetupId(x?.id) ? x.id : isSetupId(x?.continues) ? x.continues : null);
const startOf = (x) => String(x?.startDate ?? "");
/**
 * lineNow(income, setupId, today) -> the line of a setup record's chain (the line with that id and every line that
 * `continues` it: the new pay a raise from a later date saved on Income started, cashflow/income changeFrom) that Get
 * started shows and changes: the one going today (the setup's own first, else the latest to start); none going, the next
 * to start; nothing to come either, the setup's own line, else the last to start. Without `today`, the setup's own line,
 * else the last to start. null when the chain is gone. Review 2026-11-02, round 5: the money screen read the setup's own
 * id only, so once the ended half was removed on Income it showed an empty box, and Continue deleted the pay still coming
 * in (typing it again doubled it); pension and other money read and wrote the half that had ended.
 */
export function lineNow(list, id, today = null) {
  const chain = (list ?? []).filter((x) => x && (x.id === id || x.continues === id));
  if (!chain.length) return null;
  const own = chain.find((x) => x.id === id) ?? null;
  const latest = (xs) => xs.reduce((a, b) => (startOf(b) >= startOf(a) ? b : a));
  if (!today) return own ?? latest(chain);
  const going = chain.filter((x) => activeOn(x, today));
  if (going.length) return going.includes(own) ? own : latest(going);
  const later = chain.filter((x) => startOf(x) > today);
  if (later.length) return later.reduce((a, b) => (startOf(b) < startOf(a) ? b : a));
  return own ?? latest(chain);
}
/** The pay Get started's money question shows and changes for a person: `lineNow` of their `setup-pay-<id>`. */
export const payLineNow = (list, pid, today = null) => lineNow(list, `setup-pay-${pid}`, today);
/**
 * A line of a setup record's chain that starts after `rec` (the raise still to come, when `rec` is today's pay): "who pays
 * you" changed before the start date goes on to it, as Salary's useAverage does for growth (review 2026-11-02, round 5).
 */
const laterInChain = (list, id, rec) => (list ?? []).filter((x) => x !== rec && (x.id === id || x.continues === id) && startOf(x) > startOf(rec));
/** A pay already on Income for this person (not made here): the money question shows it instead of asking again. */
export const existingPay = (p, pid) => L(p, "income").filter((x) => !setupRoot(x) && x.personId === pid && (x.type === "salary" || x.type === "business"));
export const existingSpend = (p) => L(p, "expenses").filter((x) => !isSetupId(x.id));
/** The spending rows to ask: childcare only with children; a row whose categories the plan already has is not asked. */
export const spendRows = (p) => { const have = new Set(existingSpend(p).map((x) => x.category)); return SPEND.filter((s) => (!s.kids || dependents(p).length > 0) && (byId(L(p, "expenses"), `setup-x-${s.key}`) || !s.covers.some((c) => have.has(c)))); };
const emergencyLike = (g) => g.isEmergencyFund || g.icon === "🛟" || /emergency|rainy ?day|cushion/i.test(g.name ?? "");
const houseLike = (g) => /down ?payment|\b(house|home)\b/i.test(g.name ?? "") && !/repair|remodel|office|pay ?off|mortgage/i.test(g.name ?? "");
/** A goal of this kind the plan already has (made on Goals): it shows ticked and nothing is added. */
export const existingGoal = (p, key) => { const def = GOALS.find((g) => g.key === key); return L(p, "goals").filter((g) => !isSetupId(g.id) && (key === "cushion" ? emergencyLike(g) : key === "home" ? houseLike(g) : def?.match ? def.match.test(g.name ?? "") : false)); };
/** A goal kind is not added when Goals already has one like it, unless the setup made its own first. */
export const goalTaken = (p, key) => existingGoal(p, key).length > 0 && !byId(L(p, "goals"), `setup-goal-${key}`);

/**
 * Why an account must stay: something else in the plan points at it (README lists where an account id can appear). The
 * setup's own debt row, contribution and goals do not count. null = nothing does.
 */
export function referenced(plan, id) {
  const has = (list, f) => L(plan, list).some((x) => !isSetupId(x.id) && f(x));
  if (L(plan, "transactions").some((t) => t.accountId === id)) return "it has transactions";
  if (L(plan, "imports").some((x) => x.accountId === id)) return "bank files were imported into it";
  if (L(plan, "holdings").some((x) => x.accountId === id)) return "it has holdings";
  if (L(plan, "reconciliations").some((x) => x.accountId === id)) return "it has checked statements";
  if (L(plan, "rules").some((x) => x.accountId === id)) return "a rule points at it";
  if (Object.values(plan?.importProfiles ?? {}).some((x) => x?.accountId === id)) return "a bank file layout points at it";
  if (has("goals", (g) => (g.fundedBy ?? []).includes(id))) return "a goal draws on it";
  if (has("debts", (d) => d.accountId === id)) return "it has loan details";
  if ((plan?.retirement?.contributions ?? []).some((c) => !isSetupId(c.id) && c.accountId === id)) return "money is set to go into it";
  if ((plan?.debtPlan?.customOrder ?? []).includes(id) || plan?.debtPlan?.mortgageAccountId === id) return "the debt plan uses it";
  if (L(plan, "property").some((x) => x.accountId === id || x.loanAccountId === id)) return "a property is linked to it";
  if (L(plan, "contacts").some((x) => (x.accountIds ?? []).includes(id))) return "a contact is linked to it";
  if ((plan?.estate?.beneficiaries ?? []).some((b) => b.accountId === id)) return "it has beneficiaries";
  return null;
}
/** Why a person must stay: a record made on another page names them. null = nothing does. */
export function personReferenced(plan, pid) {
  // the setup's own pay and the raise that carries it on (setupRoot) are the setup's: removing the person removes both
  // (review 2026-11-02, round 5: the raise kept the person, "Kept Bo: Income lists their pay")
  if (L(plan, "income").some((x) => !setupRoot(x) && x.personId === pid)) return "Income lists their pay";
  if (L(plan, "accounts").some((x) => !isSetupId(x.id) && x.ownerId === pid)) return "accounts are in their name";
  if ((plan?.retirement?.contributions ?? []).some((c) => !isSetupId(c.id) && c.personId === pid)) return "retirement saving is in their name";
  if ((plan?.retirement?.pensions ?? []).some((x) => x.personId === pid)) return "a pension is in their name";
  if ((plan?.insurance?.policies ?? []).some((x) => x.personId === pid)) return "an insurance policy covers them";
  if ((plan?.estate?.documents ?? []).some((x) => x.personId === pid)) return "their papers are listed";
  if ((plan?.retirement?.socialSecurity?.[pid]?.record ?? []).length > 0) return "their Social Security record is in the plan";
  if ((plan?.retirement?.annuities ?? []).some((x) => x.personId === pid)) return "an annuity is in their name";
  if (plan?.equity?.personId === pid) return "work stock is in their name";
  if ((plan?.taxes?.gains ?? []).some((x) => x.personId === pid)) return "investment sales are in their name";
  if ((plan?.estate?.gifts ?? []).some((x) => x.from === pid)) return "gifts are in their name";
  if ((plan?.estate?.beneficiaries ?? []).some((b) => [...(b.primary ?? []), ...(b.contingent ?? [])].some((x) => x.personId === pid))) return "they are named as a beneficiary";
  if (plan?.whatIfs?.college?.[pid]) return "a college plan is saved for them";
  return null;
}

/** The screens that apply to this plan, in order. */
export const visibleScreens = (plan) => SCREENS.filter((s) => !s.show || s.show(plan));
export function nextScreen(plan, id) { const v = visibleScreens(plan); const i = v.findIndex((s) => s.id === id); if (i >= 0) return v[i + 1]?.id ?? "done"; return resolveScreen(plan, id); }
export function prevScreen(plan, id) { const v = visibleScreens(plan); const i = v.findIndex((s) => s.id === id); return i > 0 ? v[i - 1].id : null; }
/** The screen to show for an address: itself when it applies, else the next one that does (a follow-up whose question changed). */
export function resolveScreen(plan, id) {
  const at = SCREENS.findIndex((s) => s.id === id);
  if (at < 0) return "welcome";
  return SCREENS.slice(at).find((s) => !s.show || s.show(plan))?.id ?? "done";
}
/** How far along the bar is for a screen: questions done, a follow-up screen counting half a question. */
export function barShare(id) { const s = SCREENS.find((x) => x.id === id); if (!s?.q) return id === "done" ? 1 : 0; return Math.max(0, (s.q - 1 + (s.follow ? 0.5 : 0)) / QUESTIONS); }

// ---- writing the plan: each changes only the draft it is given
function ensure(draft) {
  draft.household = draft.household ?? { people: [], filingStatus: "single", state: "" };
  draft.household.people = people(draft);
  for (const k of ["income", "accounts", "debts", "expenses", "goals"]) draft[k] = L(draft, k);
  draft.retirement = draft.retirement ?? {};
  draft.retirement.contributions = Array.isArray(draft.retirement.contributions) ? draft.retirement.contributions : [];
  draft.retirement.socialSecurity = draft.retirement.socialSecurity ?? {};
  draft.guide = draft.guide ?? {};
  draft.guide.setup = draft.guide.setup ?? {};
  draft.guide.setup.picks = draft.guide.setup.picks ?? {};
  return draft;
}
/**
 * Would this change the plan? The view asks before saving, so a Continue that changes nothing writes nothing (no save,
 * no backup, no re-render). Both sides are compared after the empty lists a writer adds, so those never count.
 */
export function wouldChange(plan, fn) {
  const a = ensure(structuredClone(plan ?? {}));
  const before = JSON.stringify(a);
  fn(a);
  return JSON.stringify(a) !== before;
}
/** Where the person is: the furthest screen reached (so Back never moves "pick up where you left off"), the start, the finish. */
export function markAt(draft, screen, today) {
  ensure(draft);
  const s = draft.guide.setup;
  const rank = (id) => SCREENS.findIndex((x) => x.id === id);
  if (rank(screen) > rank(s.at)) s.at = screen;
  if (!s.startedAt && today) s.startedAt = today;
  if (screen === "done" && !s.finishedAt && today) s.finishedAt = today;
}
/**
 * Remove setup accounts, unless something else points at one: then it stays and is reported ({ name, reason }), so
 * the screen can say "Kept Checking: it has transactions. Remove it on Net worth." Its setup debt row, setup
 * contribution and place in setup goals go with it.
 */
/**
 * "Year you bought it" (Get started's home boxes): the home's purchase date, kept on the plan's home entry for the
 * setup's home account (property[setup-home]) as July 1 of the year (an exact date already in that year stays). A blank
 * box takes the answer back; `year === undefined` (the screen has no such box) changes nothing.
 */
function applyBought(draft, year) {
  if (year === undefined) return;
  draft.property = Array.isArray(draft.property) ? draft.property : [];
  // the home's entry on the Home page when there is one (any id), else Get started's own: one answer, one place (review D5)
  const found = homeEntryFor(draft, haveId("home"));
  const i = found ? draft.property.indexOf(found) : -1;
  if (year === null) {
    if (i < 0) return;
    const e = draft.property[i];
    delete e.purchaseDate;
    if (e.id === SETUP_HOME_ENTRY && Object.keys(e).every((k) => ["id", "kind", "accountId"].includes(k))) draft.property.splice(i, 1);
    return;
  }
  const e = i >= 0 ? draft.property[i] : { id: SETUP_HOME_ENTRY, kind: "home", accountId: haveId("home") };
  if (!(typeof e.purchaseDate === "string" && e.purchaseDate.startsWith(String(year)))) e.purchaseDate = `${year}-07-01`;
  if (i < 0) draft.property.push(e);
}
/** The year on the home's entry (the Home page's, or Get started's own) for the setup's home account, else "" (the box is empty). */
export function boughtYearOn(plan) {
  const home = byId(L(plan, "accounts"), haveId("home"));
  const e = home ? homeEntryFor(plan, home.id) : L(plan, "property").find((x) => x?.id === SETUP_HOME_ENTRY) ?? null;
  const y = /^(\d{4})/.exec(String(e?.purchaseDate ?? ""));
  return y ? Number(y[1]) : "";
}
const boughtOf = (v, today) => (v && Object.prototype.hasOwnProperty.call(v, "bought") ? parseYear(v.bought, Number(String(today ?? "2200").slice(0, 4))) : undefined);
function dropAccounts(draft, ids) {
  const kept = [];
  for (const id of ids) {
    const a = byId(draft.accounts, id);
    if (!a) continue;
    const why = referenced(draft, id);
    if (why) { kept.push({ id, name: a.name, reason: why, page: "#/balance/net-worth" }); continue; }
    draft.accounts = draft.accounts.filter((x) => x.id !== id);
    if (id === haveId("home") && Array.isArray(draft.property)) draft.property = draft.property.filter((e) => e?.id !== SETUP_HOME_ENTRY);
    draft.debts = draft.debts.filter((d) => !(isSetupId(d.id) && d.accountId === id));
    draft.retirement.contributions = draft.retirement.contributions.filter((c) => !(isSetupId(c.id) && c.accountId === id));
    for (const g of draft.goals) if (isSetupId(g.id) && Array.isArray(g.fundedBy)) g.fundedBy = g.fundedBy.filter((x) => x !== id);
    // (question 7b's record of the cash linked to a goal forgets it too)
    const gf = draft.guide.setup.goalFunds;
    if (gf) { for (const k of Object.keys(gf)) { if (!gf[k].includes(id)) continue; gf[k] = gf[k].filter((x) => x !== id); if (!gf[k].length) delete gf[k]; } if (!Object.keys(gf).length) delete draft.guide.setup.goalFunds; }
  }
  return kept;
}
/** Q2's own $0 401(k): its own id, so question 4b's "On my own" IRA never takes its place (review UX 4). */
export const workPlanId = (pid) => `setup-workplan-${pid}`;
export const workPlanAcct = (p, pid) => byId(L(p, "accounts"), workPlanId(pid)) ?? null;
/** Q2's answer on file for a person: "yes" | "no" | null (`retirement.workPlans[id].plan`; Contributions' `match` alone is not it). */
export const workPlanAnswer = (p, pid) => { const x = p?.retirement?.workPlans?.[pid]?.plan; return x === true ? "yes" : x === false ? "no" : null; };
/** The match an account gets from its contribution rows (the largest employerMatch), for Contributions' limitKind. */
const matchOf = (p, id) => Math.max(0, ...(p?.retirement?.contributions ?? []).filter((c) => c.accountId === id).map((c) => Number(c.employerMatch) || 0));
/**
 * A plan at a job the person still has, other than Q2's own: a 401(k), or a Roth 401(k) (Contributions' limitKind: a Roth
 * account with a match or a 401(k)/403(b)/457/TSP name), theirs or with no owner for the first adult, not `formerJob`.
 */
const hasWorkAccount = (p, person) => L(p, "accounts").some((a) => a.id !== workPlanId(person.id) && !a.formerJob && (a.ownerId === person.id || (!a.ownerId && person.role === "self")) && limitKind(a.type, a.name, matchOf(p, a.id)) === "401k");
/** Q2's account while nothing is in it or going into it (only then is it taken back). */
const workPlanEmpty = (p, a) => !(Math.abs(Number(a.balance) || 0) > 0) && !(p?.retirement?.contributions ?? []).some((c) => c.accountId === a.id && (Number(c.amount) > 0 || Number(c.employerMatch) > 0));
/**
 * Q2's answer to "Retirement plan at work?" for one adult (WORK_PLAN). `job`: the question applies (they work for an
 * employer). Only an answer that differs from the one on file does anything (review D7: an unchanged Continue saves nothing,
 * and never takes back or puts back an account). Yes: `plan: true`, and the $0 401(k) when there is no plan account at their
 * job; a `match: false` the earlier No wrote goes, so the match is asked again. No: `plan: false` and `match: false`. Not
 * sure: the answer on file goes (with the `match: false` its No wrote). No or Not sure, or no longer working for an
 * employer, takes back Q2's own $0 401(k) while nothing is in it or going into it. No answer (null): nothing. Returns what
 * had to be kept.
 */
function applyWorkPlan(draft, person, answer, job, today) {
  const pid = person.id, kept = [], was = workPlanAnswer(draft, pid);
  const takeBack = () => { const a = workPlanAcct(draft, pid); if (a && workPlanEmpty(draft, a)) kept.push(...dropAccounts(draft, [a.id])); };
  const write = (fields) => {
    const wp = { ...(draft.retirement.workPlans?.[pid] ?? {}) };
    for (const [k, x] of Object.entries(fields)) { if (x === undefined) delete wp[k]; else wp[k] = x; }
    draft.retirement.workPlans = { ...(draft.retirement.workPlans ?? {}), [pid]: wp };
    if (!Object.keys(wp).length) delete draft.retirement.workPlans[pid];
    if (!Object.keys(draft.retirement.workPlans).length) delete draft.retirement.workPlans;
  };
  // the match: false that Q2's own No wrote (no plan, so no match) goes with that No
  const noMatchToo = () => (was === "no" && draft.retirement.workPlans?.[pid]?.match === false ? { match: undefined } : {});
  if (!job) {
    // no longer paid by an employer: the answer, and its $0 401(k), go
    if (was !== null) write({ plan: undefined, ...noMatchToo() });
    takeBack();
    return kept;
  }
  if (answer === null || answer === was) return kept;
  if (answer === "yes") {
    write({ plan: true, ...noMatchToo() });
    if (!workPlanAcct(draft, pid) && !hasWorkAccount(draft, person)) {
      const several = adults(draft).length > 1;
      put(draft.accounts, workPlanId(pid), {}, { name: several || person.name !== "Me" ? `${possessive(person)} plan at work` : "My plan at work", type: "401k", balance: 0, institution: "", asOf: today ?? "", ownerId: pid, history: [], notes: "" });
    }
  } else if (answer === "no") { write({ plan: false, match: false }); takeBack(); }
  else if (answer === "unsure") { write({ plan: undefined, ...noMatchToo() }); takeBack(); }
  return kept;
}
const andAll = (xs) => (xs.length <= 2 ? xs.join(" and ") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
/** "Priya's plan" / "Priya's and Tom's plans" / one adult "your plan": whose plan at work, in words. */
const plansWords = (plan, ps) => (adults(plan).length > 1 ? `${andAll(ps.map((p) => possessive(p)))} ${ps.length > 1 ? "plans" : "plan"}` : "your plan");
/**
 * Question 4's line for a plan at work question 2 added, still $0 (review UX 9): "Priya's plan at work is added with $0.
 * Money in it already? Tap Retirement." null when there is none. With Retirement ticked (`ticked`: the tile on screen; by
 * default the plan's, which C4 ticks for a plan at work, `haveKeys`) the next screen asks what is in it and what goes in, so
 * the line says so: "Tap Retirement" would untick it (C4 verify V4).
 */
export function workPlanLine(plan, { ticked = haveKeys(plan).includes("retire") } = {}) {
  const ps = adults(plan).filter((p) => { const a = workPlanAcct(plan, p.id); return a && !(Math.abs(Number(a.balance) || 0) > 0); });
  if (!ps.length) return null;
  const w = plansWords(plan, ps), W = `${w.charAt(0).toUpperCase()}${w.slice(1)}`, many = ps.length > 1;
  return ticked ? `${W} at work ${many ? "are" : "is"} added. Next we'll ask what is in ${many ? "them" : "it"} and what you put in.`
    : `${W} at work ${many ? "are" : "is"} added with $0. Money in ${many ? "them" : "it"} already? Tap Retirement.`;
}
/** Question 2's "Got it" words for plans at work it just added: "We added Priya's plan at work, with $0 in it for now." */
export function workPlanAdded(plan, pids) {
  const ps = adults(plan).filter((p) => pids.includes(p.id) && workPlanAcct(plan, p.id));
  return ps.length ? `We added ${plansWords(plan, ps)} at work, with $0 in ${ps.length > 1 ? "them" : "it"} for now.` : null;
}
/** Everything the setup made for one person (their pay, pension, Social Security, retirement account and saving). */
function dropPersonRecords(draft, pid) {
  const kept = dropAccounts(draft, [haveId("retire", pid), workPlanId(pid)]);
  for (const k of kept) { const a = byId(draft.accounts, k.id); if (a) a.ownerId = ""; }   // kept, but its owner is gone
  draft.income = draft.income.filter((x) => ![`setup-pay-${pid}`, `setup-pension-${pid}`, `setup-ss-${pid}`].includes(setupRoot(x)));
  for (const x of draft.income) if (setupRoot(x) === "setup-other" && x.personId === pid) x.personId = "";
  draft.retirement.contributions = draft.retirement.contributions.filter((c) => c.id !== `setup-contrib-${pid}`);
  if (!(draft.retirement.socialSecurity[pid]?.record ?? []).length) delete draft.retirement.socialSecurity[pid];
  for (const k of ["status", "ss", "ssWrote", "iraKind"]) if (draft.guide.setup[k]) delete draft.guide.setup[k][pid];
  if (draft.retirement.workPlans?.[pid]) { delete draft.retirement.workPlans[pid]; if (!Object.keys(draft.retirement.workPlans).length) delete draft.retirement.workPlans; }
  return kept;
}
const blankPerson = { birthDate: "", retirementAge: null, lifeExpectancy: null };
const filingFor = (who, kids) => (who === "spouse" ? "married_joint" : who === "me" && kids > 0 ? "head_of_household" : "single");
/**
 * Q1. Who the plan is for: { name, who: "me"|"spouse"|"partner", partnerName, kids, state }. A household typed on
 * People wins (only the state is saved). Filing status follows: married filing jointly with a spouse; head of
 * household for one adult with children at home; single otherwise (an unmarried couple files two single returns).
 * It is set the first time and again only when the answer that decides it changes, so a status chosen on Filing
 * status stays. Returns what had to be kept ({ name, reason }).
 */
export function applyYou(draft, v) {
  ensure(draft);
  const kept = [];
  const s = draft.guide.setup;
  if (STATE_NAMES[v.state] && draft.household.state !== v.state) draft.household.state = v.state;
  if (ownPeople(draft).length) return kept;
  const list = draft.household.people;
  const count = Math.max(0, Math.min(9, Math.round(Number(v.kids) || 0)));
  let who = v.who === "spouse" || v.who === "partner" ? v.who : "me";
  const prevWho = s.who ?? null, prevKids = dependents(draft).filter((k) => isSetupId(k.id)).length;
  const self = byId(list, "setup-self");
  const keep = [{ ...(self ?? blankPerson), id: "setup-self", name: String(v.name ?? "").trim() || "Me", role: "self" }];
  const partner = byId(list, "setup-partner");
  if (who === "me" && partner) {
    const why = personReferenced(draft, "setup-partner");
    if (why) { kept.push({ name: partner.name, reason: why, page: "#/household/people" }); who = partner.relation === "spouse" ? "spouse" : "partner"; }
    else kept.push(...dropPersonRecords(draft, "setup-partner"));
  }
  if (who !== "me") keep.push({ ...(partner ?? blankPerson), id: "setup-partner", name: String(v.partnerName ?? "").trim() || partner?.name || (who === "spouse" ? "My spouse" : "My partner"), role: "partner", relation: who });
  for (let i = 1; i <= 9; i++) {
    const id = `setup-kid-${i}`, kid = byId(list, id);
    if (i <= count) keep.push({ ...(kid ?? blankPerson), id, name: kid?.name ?? `Child ${i}`, role: "dependent" });
    else if (kid) { const why = personReferenced(draft, id); if (why) { kept.push({ name: kid.name, reason: why, page: "#/household/people" }); keep.push(kid); } }
  }
  draft.household.people = keep;
  const kids = dependents(draft).length;
  if (!prevWho || prevWho !== who || (who === "me" && (prevKids > 0) !== (kids > 0))) draft.household.filingStatus = filingFor(who, kids);
  s.who = who;
  return kept;
}
/**
 * Q2. What comes in: { people: { [personId]: { status: "work"|"retired"|"none", amount, period, pension } }, other:
 * { kind, amount } }. Work: pay before tax. Retired: a pension a month, if any (Social Security is on the next
 * question). Other: a month, saved as the Income type its kind names. A person whose pay is already on Income is left
 * as it is. Clearing a box removes the setup's line (Income lines are not pointed at by id).
 */
export function applyMoney(draft, v) {
  ensure(draft);
  const keep = new Set(), kept = [];
  draft.guide.setup.status = draft.guide.setup.status ?? {};
  for (const p of adults(draft)) {
    const x = v.people?.[p.id] ?? {};
    const status = ["work", "retired", "none"].includes(x.status) ? x.status : draft.guide.setup.status[p.id] ?? null;
    if (status) draft.guide.setup.status[p.id] = status;
    const base = { personId: p.id, growth: 0, startDate: "", endDate: "", taxable: true };
    // today's pay: the setup's line, or the line of its chain in force today (lineNow: a raise from a later date started, even
    // once the half that ended was removed on Income; review 2026-11-02, round 5)
    const payId = `setup-pay-${p.id}`, mine = lineNow(draft.income, payId, v.today);
    if (status === "work" && (mine || !existingPay(draft, p.id).length)) {
      const amount = pos(x.amount);
      const period = PAY_PERIODS.some((o) => o.value === x.period) ? x.period : "annual";
      // who pays: an employer (a salary, tax held back from each paycheck) or their own business or freelance work (no
      // paycheck: self-employment tax and quarterly payments). It used to be saved as a salary either way, so every tax
      // page talked about a W-4 and withholding a freelancer does not have (round 4, 2026-11-02)
      const self = x.by === "self";
      if (amount) {
        keep.add(payId);
        const type = self ? "business" : "salary";
        const nameFor = (t) => (t === "business" ? `${possessive(p)} business` : `${possessive(p)} pay`);
        // the line in force today is changed in place, never a second setup line beside it (round 5)
        const old = mine, oldType = old?.type;
        const rec = old ? Object.assign(old, { amount, period, type }) : put(draft.income, payId, { amount, period, type }, { name: nameFor(type), ...base });
        // the name follows the answer while it is still the setup's own (one renamed on Income stays)
        // the setup's own name also when the person was named (or renamed) in between: "My pay" becomes "Dee's business"
        // (review 2026-11-02); a name typed on Income that is not of that shape stays. Only the setup's own names for someone
        // not yet named ("My pay", "My spouse's business") follow a new name: one typed on Income ("My wife's business") stays
        // when the answer is saved again unchanged (review 2026-11-02, round 5)
        const follow = (r, wasType) => {
          const name = r.name;
          const setupShape = /^(My|.+'s) (pay|business)$/.test(String(name ?? ""));
          const unnamed = /^My( (spouse|partner)'s)? (pay|business)$/.test(String(name ?? ""));
          if (name !== nameFor(type) && (name === nameFor(wasType) || (setupShape && (wasType !== type || unnamed)))) r.name = nameFor(type);
          if (wasType !== type && type !== "business") delete r.countOn;   // the careful figure is for uneven business pay only
        };
        if (old) follow(rec, oldType);
        // "who pays you" changed: the raise still to come is paid the same way (round 5: it stayed a salary)
        if (old && oldType !== type) for (const y of laterInChain(draft.income, payId, rec)) { const was = y.type; y.type = type; follow(y, was); }
      }
    }
    // "Retirement plan at work?" (round 8): asked under pay from an employer, the setup's own (`by` not "self") or a salary
    // already on Income
    const onIncome = existingPay(draft, p.id);
    const job = status === "work" && (mine || !onIncome.length ? x.by !== "self" : onIncome.some((i) => i.type === "salary"));
    kept.push(...applyWorkPlan(draft, p, WORK_PLAN.some((o) => o.value === x.plan) ? x.plan : null, job, v.today));
    if (status === "retired") {
      const pension = pos(x.pension);
      // the line in force today (lineNow), changed in place: after a raise from a later date, the pension coming in now
      if (pension) { const id = `setup-pension-${p.id}`; keep.add(id); const now = lineNow(draft.income, id, v.today); if (now) now.amount = pension; else put(draft.income, id, { amount: pension }, { name: `${possessive(p)} pension`, type: "pension", period: "monthly", ...base }); }
    }
  }
  // other money: the kind is written only when one is picked and it differs (a type set on Income, like investment, stays)
  const other = pos(v.other?.amount), picked = OTHER_KINDS.find((k) => k.value === v.other?.kind) ?? null;
  if (other) {
    keep.add("setup-other");
    // the line in force today (lineNow), changed in place; a kind picked anew goes on to what starts after it (round 5)
    const self = adults(draft)[0], old = lineNow(draft.income, "setup-other", v.today);
    const kind = picked ?? (old ? null : OTHER_KINDS[3]);
    const kindFields = kind && (!old || old.type !== kind.value) ? { type: kind.value, taxable: kind.taxable !== false, personId: kind.value === "business" ? self?.id ?? "" : "" } : {};
    const r = old ? Object.assign(old, { amount: other, ...kindFields }) : put(draft.income, "setup-other", { amount: other, ...kindFields }, { name: (kind ?? OTHER_KINDS[3]).name, period: "monthly", growth: 0, startDate: "", endDate: "" });
    const named = (y) => { if (kind && OTHER_KINDS.some((k) => k.name === y.name) && y.name !== kind.name) y.name = kind.name; };   // follow the kind unless renamed on Income
    named(r);
    if (old && kindFields.type) for (const y of laterInChain(draft.income, "setup-other", r)) { Object.assign(y, kindFields); named(y); }
    if (kindFields.type && kindFields.type !== "business") for (const y of [r, ...laterInChain(draft.income, "setup-other", r)]) delete y.countOn;   // the careful figure is for business pay only
  }
  draft.income = draft.income.filter((x) => { const root = setupRoot(x); return !root || root.startsWith("setup-ss-") || keep.has(root); });
  // estimated tax already paid this year, asked of someone paid by their own business (review 2026-11-02): spread over the
  // quarters already due, so Estimated payments, Needs attention and Next best action start from what was paid, not "$0"
  const taxPaid = v.taxPaid === "" || v.taxPaid === null || v.taxPaid === undefined ? null : nonneg(v.taxPaid);
  if (taxPaid !== null && v.today && adults(draft).some((p) => payLineNow(draft.income, p.id, v.today)?.type === "business")) {
    const due = Math.max(1, QUARTERS(Number(v.today.slice(0, 4))).filter((q) => q.due <= v.today).length);
    const per = Math.floor((taxPaid / due) * 100) / 100;
    const paid = [0, 1, 2, 3].map((k) => (k < due ? per : 0));
    paid[due - 1] = Math.round((taxPaid - per * (due - 1)) * 100) / 100;
    draft.taxes = draft.taxes ?? {};
    draft.taxes.estimated = { ...(draft.taxes.estimated ?? {}), paid, typedAt: v.today };
  }
  return kept;
}
/** This year's pay before tax for a person (Income page, any salary or business pay still going). */
export const yearlyPay = (plan, pid) => L(plan, "income").filter((x) => x.personId === pid && (x.type === "salary" || x.type === "business") && !x.endDate).reduce((s, x) => s + perYear(x.amount, x.period), 0);
/**
 * Social Security at full retirement age, estimated from today's pay the way SSA's Quick Calculator does it: past
 * years' earnings assumed to have followed the national average wage (today's pay scaled back by the wage index) from
 * age 22, the same pay until stopping work, then the app's own benefit formula (retirement/social-security
 * estimateBenefit). Monthly, in today's dollars; null without a birth year or pay.
 */
export function estimateSocialSecurity({ birthYear, yearlyPay: pay, stopAge = 65, today }) {
  if (!birthYear || !(pay > 0) || !today) return null;
  const year = Number(String(today).slice(0, 4));
  const lastYear = Math.min(year - 1, LAST_AWI_YEAR);
  const base = WAGE_INDICES[LAST_AWI_YEAR];
  const record = [];
  for (let y = Math.max(1951, birthYear + 22); y <= lastYear; y++) record.push({ year: y, earnings: Math.round(pay * (WAGE_INDICES[y] ?? base) / base) });
  if (!record.length) record.push({ year: lastYear, earnings: Math.round(pay) });
  const fra = fullRetirementAge(birthYear);
  const est = estimateBenefit(record, { birthYear, claimAge: fra.asYears, futureEarnings: "same", stopYear: birthYear + Math.min(Math.floor(fra.asYears), Math.max(22, stopAge)) - 1, today });
  return est.eligible ? Math.round(est.pia) : 0;
}
/**
 * Q3. Ages, when to stop working, and Social Security: { people: { [id]: { month, year, stopAge, retired, ss: { mode:
 * "estimate"|"statement"|"getting"|"none"|"unsure", amount, started } } }, kids: { [id]: year } }. A birth date is kept
 * as the 15th of the month (so Social Security's born-on-the-1st rule never applies by accident; People keeps the exact
 * day editable). The age to stop is saved on the person only when it differs from the plan's (Assumptions), so changing
 * the plan's age moves everyone who did not choose their own; "already retired" saves today's age, once a birth date is
 * known. "Getting it": what is paid now, from the age it started (full-retirement amount = now / claim factor), and the
 * same amount as an Income line so this month counts it. A pasted ssa.gov record is never overwritten.
 */
export function applyAges(draft, v, today) {
  ensure(draft);
  draft.guide.setup.ss = draft.guide.setup.ss ?? {};
  const planAge = Number(draft.assumptions?.retirementAge ?? 65);
  // kept by the chain (setupRoot): a raise from a later date saved on Income carries the setup's line on (round 5)
  const keepIncome = new Set(L(draft, "income").map(setupRoot).filter((r) => r?.startsWith("setup-ss-")));
  for (const p of people(draft)) {
    const x = (p.role === "dependent" ? { year: v.kids?.[p.id] } : v.people?.[p.id]) ?? {};
    const year = Math.round(Number(x.year) || 0);
    const month = Math.min(12, Math.max(1, Math.round(Number(x.month) || 0) || 7));
    if (year >= 1900 && today && year <= Number(today.slice(0, 4))) {
      const iso = `${year}-${String(month).padStart(2, "0")}-${p.birthDate && p.birthDate.slice(0, 7) === `${year}-${String(month).padStart(2, "0")}` ? p.birthDate.slice(8, 10) : "15"}`;
      if (p.birthDate !== iso) p.birthDate = iso;
    }
    if (p.role === "dependent") continue;
    const now = p.birthDate && today ? ageOn(p.birthDate, today) : null;
    const stop = x.retired ? now : Math.round(Number(x.stopAge) || 0) || null;
    if (stop !== null && stop >= 18 && stop <= 100) { const want = stop === planAge ? null : stop; if ((p.retirementAge ?? null) !== want) p.retirementAge = want; }
    const ss = x.ss ?? {};
    const mode = ["estimate", "statement", "getting", "none", "unsure"].includes(ss.mode) ? ss.mode : null;
    const prev = draft.guide.setup.ss[p.id] ?? null;
    if (mode && prev !== mode) draft.guide.setup.ss[p.id] = mode;
    const wrote = draft.guide.setup.ssWrote ?? {};
    let rec = draft.retirement.socialSecurity[p.id] ?? {};
    const hasRecord = Array.isArray(rec.record) && rec.record.length > 0;
    const birthYear = p.birthDate ? Number(p.birthDate.slice(0, 4)) : null;
    const sid = `setup-ss-${p.id}`;
    if (mode !== "getting") keepIncome.delete(sid);
    // "I get it now" before 62 is a disability or survivor benefit, paid unreduced: the entry is marked `paidUnreduced`
    // (a pasted record or not, an amount or not) so the Social Security page never values it as an early claim; any other
    // answer takes the mark off; from 62 the answer below decides (review 2026-11-02, round 5, third pass)
    const young = mode === "getting" && now !== null && now < 62;
    if ((young && !rec.paidUnreduced) || (mode && mode !== "getting" && rec.paidUnreduced)) {
      const { paidUnreduced, ...rest } = rec;
      rec = young ? { ...rec, paidUnreduced: true } : rest;
      draft.retirement.socialSecurity[p.id] = rec;
    }
    if (hasRecord || !mode) continue;
    const without = (o, ...ks) => Object.fromEntries(Object.entries(o).filter(([k]) => !ks.includes(k)));
    const set = (next) => { if (JSON.stringify(next) !== JSON.stringify(rec)) draft.retirement.socialSecurity[p.id] = next; };
    // the claim age is the Social Security page's; only an age this setup wrote ("I already get it") is taken back
    const base = prev === "getting" && mode !== "getting" ? without(rec, "claimAge") : rec;
    const noteWrote = (n) => { if (n === null) { if (wrote[p.id] !== undefined) { delete wrote[p.id]; draft.guide.setup.ssWrote = wrote; } } else if (wrote[p.id] !== n) { draft.guide.setup.ssWrote = { ...wrote, [p.id]: n }; } };
    if (mode === "estimate") {
      // a figure typed on the Social Security page since the last estimate is kept
      const ours = prev !== "estimate" || !(Number(rec.monthlyAtFRA) > 0) || Number(rec.monthlyAtFRA) === wrote[p.id];
      const est = estimateSocialSecurity({ birthYear, yearlyPay: yearlyPay(draft, p.id), stopAge: p.retirementAge ?? planAge, today });
      if (ours && est !== null) { set({ ...base, monthlyAtFRA: est }); noteWrote(est); }
    } else if (mode === "statement") {
      const amount = pos(ss.amount);
      if (amount) { set({ ...base, monthlyAtFRA: amount }); noteWrote(null); }
    } else if (mode === "getting" && birthYear) {
      const amount = pos(ss.amount);
      const fra = fullRetirementAge(birthYear).asYears;
      if (amount) {
        if (now !== null && now < 62) {
          // disability or survivor benefits before 62: paid unreduced, so the amount is the full-retirement amount
          set({ ...rec, claimAge: Number(rec.claimAge) >= 62 ? rec.claimAge : Math.round(fra * 12) / 12, monthlyAtFRA: amount });
        } else {
          const top = Math.min(70, Math.max(62, now ?? 70));
          const started = Math.min(top, Math.max(62, Math.round(Number(ss.started) || 0) || (now !== null && now >= fra ? Math.round(fra) : top)));
          // the screen shows the claim age on file (its stepper held to 62..today's age) and the Income line's amount; given
          // back as shown, the entry already there is kept (third pass: going through it again turned a disability benefit,
          // $1,800 with 67 on file, into a claim at 62 worth $2,571.40 at full age). One marked `paidUnreduced` takes a new
          // amount as its full-age amount while the age is left as shown; a different age is a claim from that age
          const onFile = Number(rec.claimAge) || 0, given = Number(ss.started) || 0;
          const asShown = onFile > 0 && (Math.abs(given - onFile) < 1 / 24 || Math.abs(given - Math.max(62, Math.min(top, onFile))) < 1 / 24);
          const paid = L(draft, "income").find((i) => i.id === sid);
          // one not marked but read by the Social Security page as unreduced (paid before the claim age on file, and the
          // old Income line pays about its full-age amount: its own test, `unreduced`) is taken the same way (recheck
          // 2026-11-05: $1,800 to $1,850 made it a claim at 62 worth $2,642.90 at full age, a $2,180.30 survivor figure)
          const readUnreduced = asShown && !rec.paidUnreduced && Number(rec.monthlyAtFRA) > 0 && !!computeSocialSecurity(draft, { today }).people.find((q) => q.id === p.id)?.unreduced;
          if (asShown && (rec.paidUnreduced || readUnreduced)) set({ ...rec, monthlyAtFRA: amount });
          else if (!(asShown && Number(rec.monthlyAtFRA) > 0 && paid && Math.abs(Number(paid.amount) - amount) < 0.5)) {
            const { paidUnreduced, ...rest } = rec;
            set({ ...rest, claimAge: started, monthlyAtFRA: Math.round((amount / claimFactor(birthYear, started)) * 10) / 10 });
          }
        }
        noteWrote(null);
        keepIncome.add(sid);
        // the line in force today (lineNow), changed in place, never a second one beside it (round 5)
        const line = lineNow(draft.income, sid, today);
        if (line) line.amount = amount;
        else put(draft.income, sid, { amount }, { name: `${possessive(p)} Social Security`, type: "social", personId: p.id, period: "monthly", growth: 0, startDate: "", endDate: "", taxable: true });
      }
    } else if (mode === "none") {
      set(without(rec, "monthlyAtFRA", "claimAge"));
      noteWrote(null);
    }
  }
  draft.income = draft.income.filter((x) => { const root = setupRoot(x); return !root?.startsWith("setup-ss-") || keepIncome.has(root); });
}
/** Q4. Which kinds of account to add (keys of HAVE; a kind the plan already has is not asked). Returns what had to be kept. */
export function applyHavePicks(draft, keys) {
  ensure(draft);
  const ks = keys.filter((k) => HAVE.some((h) => h.key === k) && askOwners(draft, k).length > 0);
  const hadRetire = picks(draft, "have").includes("retire");
  if (JSON.stringify(picks(draft, "have")) !== JSON.stringify(ks)) draft.guide.setup.picks.have = ks;
  if (!ks.includes("home") && draft.guide.setup.homeFromOwe) delete draft.guide.setup.homeFromOwe;
  // Q2's own 401(k) is the answer "a plan at work", not a kind of savings: it stays. Retirement unticked here (it was
  // ticked): what question 4b put in it goes, as the retirement box's own account does (round 8)
  if (hadRetire && !ks.includes("retire")) for (const p of adults(draft)) {
    const a = workPlanAcct(draft, p.id);
    if (!a) continue;
    if (Number(a.balance) !== 0) a.balance = 0;
    const cid = `setup-contrib-${p.id}`;
    if (draft.retirement.contributions.some((c) => c.id === cid && c.accountId === a.id)) draft.retirement.contributions = draft.retirement.contributions.filter((c) => c.id !== cid);
  }
  return dropAccounts(draft, draft.accounts.filter((a) => isHave(a.id) && !ks.includes(haveKeyOf(a.id))).map((a) => a.id));
}
/**
 * Q4b. About how much in each: { [key or "retire-<personId>"]: amount, "kind-<personId>": "work"|"own", "contrib-<personId>":
 * a month from pay, "match-<personId>": a month the employer adds (through work only) }. A blank box makes no account
 * (and removes the setup's own, unless something points at it). Returns what had to be kept.
 */
export function applyHaveAmounts(draft, v, today, { guess = null } = {}) {
  if (typeof guess === "function") return applyHaveGuessed(draft, v, today, guess);
  ensure(draft);
  const gone = [], keepC = new Set();
  const several = adults(draft).length > 1;
  for (const h of HAVE) {
    if (!picks(draft, "have").includes(h.key)) continue;
    for (const pid of askOwners(draft, h.key)) {
      const amount = nonneg(v[h.perAdult ? `${h.key}-${pid}` : h.key]);
      const kind = RETIRE_KINDS.find((k) => k.value === v[`kind-${pid}`]) ?? RETIRE_KINDS[0];
      // Q2's own 401(k) (a plan at work, round 8): "Through work" goes into it, never a second 401(k), and an IRA the box
      // held before (On my own, then Through work) goes; "On my own" is an IRA in the box's own place, beside it (review UX 4)
      const slot = haveId(h.key, pid), q2 = h.perAdult ? workPlanAcct(draft, pid) : null;
      const intoQ2 = !!q2 && kind.value === "work";
      const id = intoQ2 ? q2.id : slot;
      if (intoQ2 && byId(draft.accounts, slot)) gone.push(slot);
      const mine = h.perAdult ? pos(v[`contrib-${pid}`]) : null, match = h.perAdult && kind.value === "work" ? pos(v[`match-${pid}`]) : null;
      // a box left empty over our guess (Q5b guessed the home) keeps it: the screen showed it grey, so it is what is counted
      const ours = isGuess(draft, `accounts[${id}].balance`);
      // a blank box for the plan at work is $0 in it: it stays, at $0
      if (amount === null && !mine && !match && intoQ2) { if (Number(q2.balance) !== 0) Object.assign(q2, { balance: 0, asOf: today }); continue; }
      if (amount === null && !mine && !match) { if (!ours) gone.push(id); continue; }
      if (amount !== null && ours) clearGuess(draft, `accounts[${id}].balance`);   // typed, even the same figure: the person's
      const person = pid ? byId(adults(draft), pid) : null;
      const old = byId(draft.accounts, id);
      // which kind of IRA, when asked and answered (On my own only): Roth a Roth, Traditional or Not sure an IRA (round 8)
      const ira = h.perAdult && kind.value === "own" && IRA_KINDS.some((k) => k.value === v[`iraKind-${pid}`]) ? v[`iraKind-${pid}`] : null;
      if (h.perAdult) {
        const was = draft.guide.setup.iraKind?.[pid];
        const want = kind.value === "own" ? ira ?? was ?? null : null;
        if ((was ?? null) !== want) { draft.guide.setup.iraKind = { ...(draft.guide.setup.iraKind ?? {}) }; if (want) draft.guide.setup.iraKind[pid] = want; else delete draft.guide.setup.iraKind[pid]; if (!Object.keys(draft.guide.setup.iraKind).length) delete draft.guide.setup.iraKind; }
      }
      const type = h.perAdult ? (ira ? (ira === "roth" ? "roth" : "ira") : old && kind.group.includes(old.type) ? old.type : kind.type) : undefined;   // a Roth set on Net worth stays a Roth
      const asked = { balance: amount ?? old?.balance ?? 0, asOf: today, ...(type ? { type } : {}) };
      if (old && old.balance === asked.balance && (asked.type === undefined || old.type === asked.type)) delete asked.asOf;   // unchanged: keep its date
      put(draft.accounts, id, asked, { name: h.perAdult ? (several || person?.name !== "Me" ? `${possessive(person)} retirement` : "My retirement") : h.name, type: h.type, institution: "", asOf: today, ownerId: pid || "", history: [], notes: "" });
      if (mine || match) {
        const cid = `setup-contrib-${pid}`; keepC.add(cid);
        const oc = byId(draft.retirement.contributions, cid);
        // the screen shows the match a month, rounded; a yearly figure typed on Contributions that reads back the same stays
        const yearly = oc && Math.round(Number(oc.employerMatch) / 12) === Math.round(match ?? 0) ? oc.employerMatch : Math.round((match ?? 0) * 12);
        const monthly = oc && Math.round(Number(oc.amount) || 0) === Math.round(mine ?? 0) ? oc.amount : mine ?? 0;
        put(draft.retirement.contributions, cid, { amount: monthly, employerMatch: yearly, ...(oc && oc.accountId !== id ? { accountId: id } : {}) }, { accountId: id, personId: pid, period: "monthly" });
      }
    }
  }
  applyBought(draft, picks(draft, "have").includes("home") ? boughtOf(v, today) : null);   // (a home no longer picked takes its year with it)
  const kept = dropAccounts(draft, gone);
  draft.retirement.contributions = draft.retirement.contributions.filter((c) => !c.id?.startsWith?.("setup-contrib-") || keepC.has(c.id));
  return kept;
}

// ---- Q4b with our guesses (spec 10, section 7.B): the retirement boxes, what goes in, what the employer adds, and every other box
/** What the "Other" share box holds: { pct } (a fraction), { blank }, or { bad } with the words to say (a share of pay is 0 to 100). */
export function readShareOfPay(text) {
  const t = String(text ?? "").trim().replace(/%$/, "").trim();
  if (!t) return { blank: true };
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return { bad: "That isn't a share of pay. Type a number like 7.5." };
  return n > 100 ? { bad: "A share of pay can't be more than 100%." } : { pct: n / 100 };
}
/** The shares of pay Q4b offers as chips (0 is "None"); "Other" opens a percent box. */
export const SAVING_CHIPS = [0, 0.03, 0.05, 0.06, 0.1];
/** Whole dollars a month for a share of a year's pay. */
export const pctToMonthly = (pct, pay) => Math.round(pct * pay / 12);
/** A person's pay from an employer a year, before tax (what a share of pay is a share of); 0 when none. */
export const employerPay = (plan, pid, today) => payFromEmployer(plan, pid, today);
const savingOf = (p, pid) => setupOf(p).saving?.[pid] ?? {};
const setSaving = (draft, pid, fields) => {
  const all = { ...(draft.guide.setup.saving ?? {}) }, one = { ...(all[pid] ?? {}) };
  for (const [k, x] of Object.entries(fields)) { if (x === undefined || x === null) delete one[k]; else one[k] = x; }
  if (Object.keys(one).length) all[pid] = one; else delete all[pid];
  if (Object.keys(all).length) draft.guide.setup.saving = all; else delete draft.guide.setup.saving;
};
/** The share of pay a person's screen holds (v["pct-<id>"]: a fraction, 0 for None), or null when they typed dollars or nothing. */
const pctOnScreen = (v, pid) => { const x = v?.[`pct-${pid}`]; return typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1 ? x : null; };
/** What a person puts in a month, as Q4b holds it: the share of pay as dollars, else the dollars typed (0 is the person's own 0), else null (blank). */
export function putInOnScreen(plan, v, pid, today) {
  const pct = pctOnScreen(v, pid);
  if (pct !== null) { const pay = employerPay(plan, pid, today); return pct === 0 ? 0 : pay > 0 ? pctToMonthly(pct, pay) : nonneg(v?.[`contrib-${pid}`]); }
  return nonneg(v?.[`contrib-${pid}`]);
}
/**
 * What Q4b holds for the guesses to read (core/estimate `args`; estimators/saving.js header): the retirement boxes and what each
 * person puts in (a number, or null for a box left blank), the two cash boxes, and the joint answer once it is given.
 */
export function haveArgs(plan, v = {}, today = null) {
  const out = { retire: {}, contrib: {}, noMatch: {}, checking: null, savings: null };
  const picked = haveKeys(plan);
  for (const h of HAVE) {
    if (!picked.includes(h.key)) continue;
    for (const pid of askOwners(plan, h.key)) {
      if (h.perAdult) { out.retire[pid] = nonneg(v[`${h.key}-${pid}`]); out.contrib[pid] = putInOnScreen(plan, v, pid, today); out.noMatch[pid] = v[`matchMode-${pid}`] === "none"; }
      else if (h.key === "checking" || h.key === "savings") out[h.key] = nonneg(v[h.key]);
    }
  }
  const pids = Object.keys(out.retire), typed = pids.filter((p) => out.retire[p] > 0), blank = pids.filter((p) => out.retire[p] === null);
  if (pids.length === 2 && typed.length === 1 && blank.length === 1) {
    if (v.joint === "both") out.joint = { pid: typed[0], total: out.retire[typed[0]] };
    else if (v.joint === "alone") out.joint = null;
  }
  return out;
}
/**
 * Q4b with our guesses (the view passes ctx.guess). A retirement kind that was picked always makes its account, and every
 * other picked kind does too: a box left blank gets our guess, written through markGuess (balances, what goes in, what the
 * employer adds). A figure typed is the person's (any guess on it goes); a 0 typed (the "None" and "No match" chips) is theirs
 * too. "Both of ours" splits the one joint figure typed in a couple by pay, and keeps the total in guide.setup.taps. What the
 * chips say (a share of pay, "No match") is kept in guide.setup.saving for Back. Every guess is worked out by
 * `guess(key, { path, args })` from the plan as it was before this save plus the screen's answers (haveArgs), the same call the
 * screen made for its grey figures. With no guess at all (a plan outside the U.S.: the gate is closed) a blank box does what it
 * did before the guesses.
 */
function applyHaveGuessed(draft, v, today, guess) {
  ensure(draft);
  const gone = [], keepC = new Set();
  const several = adults(draft).length > 1;
  const ask = (key, path, args) => { let e = null; try { e = guess(key, { path, args }); } catch { e = null; } return e && typeof e.value === "number" && Number.isFinite(e.value) ? e : null; };
  const args = haveArgs(draft, v, today);
  const BAL = { checking: "account.cash", savings: "account.cash", invest: "account.invest.balance", home: "home.value", car: "account.car.value" };
  for (const h of HAVE) {
    if (!haveKeys(draft).includes(h.key)) continue;
    for (const pid of askOwners(draft, h.key)) {
      const kind = RETIRE_KINDS.find((k) => k.value === v[`kind-${pid}`]) ?? RETIRE_KINDS[0];
      const slot = haveId(h.key, pid), q2 = h.perAdult ? workPlanAcct(draft, pid) : null;
      const intoQ2 = !!q2 && kind.value === "work";
      const id = intoQ2 ? q2.id : slot;
      if (intoQ2 && byId(draft.accounts, slot)) gone.push(slot);
      // "On my own" after "Through work": what the work plan's box held as our guess goes, so one box is not counted twice
      if (q2 && !intoQ2 && isGuess(draft, `accounts[${q2.id}].balance`)) { Object.assign(q2, { balance: 0, asOf: today }); clearGuess(draft, `accounts[${q2.id}].balance`); }
      const balPath = `accounts[${id}].balance`;
      const joint = h.perAdult && args.joint ? args.joint : null;
      // "both of ours": the figure typed in one box is the couple's, so both boxes are the split of it, marked
      let amount = joint ? null : nonneg(v[h.perAdult ? `${h.key}-${pid}` : h.key]);
      const typedPut = h.perAdult ? args.contrib[pid] : null;
      const typedMatch = h.perAdult && kind.value === "work" ? nonneg(v[`match-${pid}`]) : null;
      const old0 = byId(draft.accounts, id);
      // a box left empty over a balance that is already our guess (question 5 guessed the home) keeps it
      if (amount === null && old0 && isGuess(draft, balPath) && !h.perAdult) continue;
      const balKey = h.perAdult ? (joint ? "account.retire.split" : kind.value === "own" ? "account.ira.balance" : "account.retire.balance") : BAL[h.key];
      const gBal = amount === null ? ask(balKey, balPath, args) : null;
      const bal = amount ?? gBal?.value ?? null;
      // contributions and the match: only through work, and only when the person has not said the job has no plan
      const planAnswer = draft.retirement.workPlans?.[pid]?.plan;
      const works = h.perAdult && kind.value === "work" && planAnswer !== false && employerPay(draft, pid, today) > 0;
      const cpath = `retirement.contributions[setup-contrib-${pid}].amount`, mpath = `retirement.contributions[setup-contrib-${pid}].employerMatch`;
      const gPut = works && typedPut === null ? ask("contrib.amount", cpath, args) : null;
      const gMatch = works && typedMatch === null ? ask("contrib.match", mpath, { ...args, contrib: { ...args.contrib, [pid]: typedPut } }) : null;
      const putMonthly = typedPut ?? gPut?.value ?? null;
      const hasRow = h.perAdult && (putMonthly !== null || typedMatch !== null || gMatch !== null);
      if (bal === null && !hasRow) {
        if (intoQ2) { if (Number(q2.balance) !== 0) Object.assign(q2, { balance: 0, asOf: today }); continue; }
        if (!isGuess(draft, balPath)) gone.push(id);
        continue;
      }
      if (amount !== null) clearGuess(draft, balPath);
      const person = pid ? byId(adults(draft), pid) : null;
      const old = byId(draft.accounts, id);
      const ira = h.perAdult && kind.value === "own" && IRA_KINDS.some((k) => k.value === v[`iraKind-${pid}`]) ? v[`iraKind-${pid}`] : null;
      if (h.perAdult) {
        const was = draft.guide.setup.iraKind?.[pid];
        const want = kind.value === "own" ? ira ?? was ?? null : null;
        if ((was ?? null) !== want) { draft.guide.setup.iraKind = { ...(draft.guide.setup.iraKind ?? {}) }; if (want) draft.guide.setup.iraKind[pid] = want; else delete draft.guide.setup.iraKind[pid]; if (!Object.keys(draft.guide.setup.iraKind).length) delete draft.guide.setup.iraKind; }
      }
      const type = h.perAdult ? (ira ? (ira === "roth" ? "roth" : "ira") : old && kind.group.includes(old.type) ? old.type : kind.type) : undefined;
      const asked = { balance: bal ?? old?.balance ?? 0, asOf: today, ...(type ? { type } : {}) };
      if (old && old.balance === asked.balance && (asked.type === undefined || old.type === asked.type)) delete asked.asOf;
      put(draft.accounts, id, asked, { name: h.perAdult ? (several || person?.name !== "Me" ? `${possessive(person)} retirement` : "My retirement") : h.name, type: h.type, institution: "", asOf: today, ownerId: pid || "", history: [], notes: "" });
      if (gBal) markGuess(draft, balPath, gBal, today); else if (amount === null) clearGuess(draft, balPath);
      if (!h.perAdult) continue;
      if (hasRow) {
        const cid = `setup-contrib-${pid}`; keepC.add(cid);
        const oc = byId(draft.retirement.contributions, cid);
        const yearly = typedMatch !== null ? (oc && Math.round(Number(oc.employerMatch) / 12) === Math.round(typedMatch) ? oc.employerMatch : Math.round(typedMatch * 12)) : gMatch ? gMatch.value : 0;
        const monthly = putMonthly === null ? 0 : putMonthly;
        // a typed figure that is the row's own month (a row kept in another period) leaves the row as it is; anything else is monthly dollars
        const sameMonth = typedPut !== null && oc && Math.round(perYear(Number(oc.amount) || 0, oc.period) / 12) === Math.round(typedPut);
        put(draft.retirement.contributions, cid, { ...(sameMonth ? {} : { amount: monthly, period: "monthly" }), employerMatch: yearly, ...(oc && oc.accountId !== id ? { accountId: id } : {}) }, { accountId: id, personId: pid, period: "monthly", amount: monthly });
        const row = byId(draft.retirement.contributions, cid);
        if (gPut) { if (row.period !== "monthly") row.period = "monthly"; markGuess(draft, cpath, gPut, today); } else clearGuess(draft, cpath);
        if (gMatch) markGuess(draft, mpath, gMatch, today); else clearGuess(draft, mpath);
      }
      // what the chips said, for Back; "No match" is also the answer Contributions keeps as "no match at this job"
      const pct = pctOnScreen(v, pid), noMatch = hasRow && typedMatch === 0 && v[`matchMode-${pid}`] === "none";
      const had = savingOf(draft, pid);
      setSaving(draft, pid, { pct: hasRow && pct !== null && typedPut !== null ? pct : null, match: noMatch ? "none" : null });
      if (noMatch && draft.retirement.workPlans?.[pid]?.match !== false) draft.retirement.workPlans = { ...(draft.retirement.workPlans ?? {}), [pid]: { ...(draft.retirement.workPlans?.[pid] ?? {}), match: false } };
      // (and this screen's own answer, Not sure or I know it, replaces a "no match" said earlier on Contributions: the newest
      // answer stands, so the guess the screen showed is the one the plan keeps; C4 verify V3)
      else if (!noMatch && (had.match === "none" || (works && hasRow)) && draft.retirement.workPlans?.[pid]?.match === false) {
        const wp = { ...draft.retirement.workPlans[pid] }; delete wp.match;
        if (Object.keys(wp).length) draft.retirement.workPlans[pid] = wp; else delete draft.retirement.workPlans[pid];
        if (!Object.keys(draft.retirement.workPlans).length) delete draft.retirement.workPlans;
      }
    }
  }
  // the joint answer: the total typed, kept while "both of ours" stands (the split guesses read it)
  const j = args.joint;
  const taps = { ...(draft.guide.setup.taps ?? {}) };
  if (j) taps["retire-joint"] = { pid: j.pid, total: j.total }; else delete taps["retire-joint"];
  if (Object.keys(taps).length) draft.guide.setup.taps = taps; else delete draft.guide.setup.taps;
  applyBought(draft, picks(draft, "have").includes("home") ? boughtOf(v, today) : null);   // (a home no longer picked takes its year with it)
  const kept = dropAccounts(draft, gone);
  draft.retirement.contributions = draft.retirement.contributions.filter((c) => !c.id?.startsWith?.("setup-contrib-") || keepC.has(c.id));
  return kept;
}
/** Q5. Which debts to add (keys of OWE, or ["none"]; a kind the plan already has is not asked). Returns what had to be kept. */
export function applyOwePicks(draft, keys) {
  ensure(draft);
  const ks = keys.includes("none") ? ["none"] : keys.filter((k) => OWE.some((o) => o.key === k) && !oweTaken(draft, k));
  if (JSON.stringify(picks(draft, "owe")) !== JSON.stringify(ks)) draft.guide.setup.picks.owe = ks;
  draft.expenses = draft.expenses.filter((x) => x.id !== "setup-x-debt");
  return dropAccounts(draft, OWE.filter((o) => !ks.includes(o.key)).map((o) => oweId(o.key)));
}
/**
 * Q5b. Each debt: { [key]: { owed, payment, rate (percent, as typed), paidInFull (cards), home (mortgage: what the home
 * would sell for, asked when the plan has no home) } }. A card paid in full every month is not a debt: nothing is saved.
 * Otherwise a liability account with what is owed and a Liabilities row with the rate and the monthly payment. A blank
 * rate gets the typical one (TYPICAL_RATES, kept in `rateGuessed`); a blank payment gets a typical one (typicalPayment,
 * kept in `paymentGuessed`), so the debt's cost is counted. The rate is saved to a thousandth of a percent (6.875%),
 * and a rate or payment set on Liabilities that reads back the same stays as it is. The payment is not written as an
 * expense: Expenses counts the Liabilities rows' payments itself (its F-019 rule).
 */
export function applyOweAmounts(draft, v, today, { guess = null } = {}) {
  if (typeof guess === "function") return applyOweGuessed(draft, v, today, guess);
  ensure(draft);
  const gone = [];
  let paidInFull = false;
  for (const o of OWE) {
    if (!picks(draft, "owe").includes(o.key) || oweTaken(draft, o.key)) continue;
    const x = v[o.key] ?? {};
    const id = oweId(o.key), did = `setup-debt-${o.key}`;
    if (o.key === "credit" && x.paidInFull) paidInFull = true;
    const owed = o.key === "credit" && x.paidInFull ? null : pos(x.owed);
    if (!owed) { gone.push(id); continue; }
    const old = byId(draft.accounts, id);
    put(draft.accounts, id, old && old.balance === owed ? {} : { balance: owed, asOf: today }, { name: o.name, type: o.type, institution: "", asOf: today, ownerId: "", history: [], notes: "" });
    const row = byId(draft.debts, did);
    // the rate: as typed (percent, 3 decimals), unless it is what the screen showed for the row's own rate
    const typed = parseMoney(x.rate);
    const known = typed !== null && typed >= 0 && typed <= 100;
    const shown = row && !rateIsGuess(row) ? Math.round(Number(row.rate) * 100000) / 1000 : null;
    const rate = known ? (shown !== null && shown === Math.round(typed * 1000) / 1000 ? row.rate : Math.round(typed * 1000) / 100000) : row && !rateIsGuess(row) ? row.rate : TYPICAL_RATES[o.key];
    const rateGuess = !known && !(row && !rateIsGuess(row));
    // the payment: as typed (whole dollars shown), else a typical one while no real one is known
    const paid = pos(x.payment);
    const ownPay = row && !paymentIsGuess(row) && Number(row.minPayment) > 0 ? row.minPayment : null;
    const payment = paid ? (ownPay !== null && Math.round(ownPay) === Math.round(paid) ? ownPay : paid) : ownPay ?? typicalPayment(o.key, owed, rate);
    const payGuess = !paid && ownPay === null;
    const r = put(draft.debts, did, { rate, minPayment: payment }, { accountId: id, extra: 0, termMonths: null, startDate: "", securedBy: "", creditLimit: null });
    if (!rateGuess) { if ("rateGuessed" in r) delete r.rateGuessed; } else if (r.rateGuessed !== rate) r.rateGuessed = rate;
    if (!payGuess) { if ("paymentGuessed" in r) delete r.paymentGuessed; } else if (r.paymentGuessed !== payment) r.paymentGuessed = payment;
    // a mortgage with no home in the plan: what the home would sell for, so net worth has both sides
    const home = o.key === "mortgage" ? pos(x.home) : null;
    if (home && !existingHave(draft, "home").length) {
      const hid = haveId("home"), h = HAVE.find((k) => k.key === "home"), was = byId(draft.accounts, hid);
      put(draft.accounts, hid, was && was.balance === home ? {} : { balance: home, asOf: today }, { name: h.name, type: h.type, institution: "", asOf: today, ownerId: "", history: [], notes: "" });
      if (!picks(draft, "have").includes("home")) { draft.guide.setup.picks.have = [...picks(draft, "have"), "home"]; draft.guide.setup.homeFromOwe = true; }
    }
  }
  if ((draft.guide.setup.paidInFull ?? false) !== paidInFull) draft.guide.setup.paidInFull = paidInFull;
  if (picks(draft, "owe").includes("mortgage") && !oweTaken(draft, "mortgage")) applyBought(draft, boughtOf(v.mortgage, today));
  return dropAccounts(draft, gone);
}
/** The one-tap answers Q5b may show, by debt (one at a time: the mortgage's, else the car loan's; guide.setup.taps). */
export const OWE_TAPS = { mortgage: "mortgage-start", "car-loan": "car-loan-start" };
const TAP_VALUES = { "mortgage-start": ["pre2010", "2010s", "2020-21", "2022on", "unsure"], "car-loan-start": ["0", "1-2", "3-4", "5+", "unsure"], "health-cover": ["work", "own", "public", "unsure"], childcare: ["yes", "no", "unsure"], hoa: ["yes", "no", "unsure"] };
/**
 * What Q5b holds for one debt, as the guesses read it (core/estimate `args`): { owed, payment, rate (a fraction), start }
 * and, for a mortgage whose screen asks it, home. A number for a box with a figure, null for a box left blank, so the
 * grey figure on the screen is worked out from exactly what saving the screen writes (the same reading
 * applyOweAmounts makes: a payment or rate set on Liabilities that reads back the same is kept as it is).
 */
export function oweArgs(plan, x = {}, key, { askHome = false, today = null } = {}) {
  const did = `setup-debt-${key}`, row = byId(L(plan, "debts"), did);
  const typed = parseMoney(x?.rate);
  const known = typed !== null && typed >= 0 && typed <= 100;
  const own = row && !rateIsGuess(row) && !isGuess(plan, `debts[${did}].rate`);
  const shown = own ? Math.round(Number(row.rate) * 100000) / 1000 : null;
  const rate = known ? (shown !== null && shown === Math.round(typed * 1000) / 1000 ? row.rate : Math.round(typed * 1000) / 100000) : null;
  // a box left blank is null (our guess fills it); a 0 typed is the person's 0: "I owe nothing" drops the debt, a $0
  // payment (a loan on hold) is kept as typed. Neither gets a guess.
  const paid = nonneg(x?.payment);
  const ownPay = row && !paymentIsGuess(row) && !isGuess(plan, `debts[${did}].minPayment`) && Number(row.minPayment) > 0 ? row.minPayment : null;
  const out = { owed: nonneg(x?.owed), payment: paid === null ? null : paid > 0 && ownPay !== null && Math.round(ownPay) === Math.round(paid) ? ownPay : paid, rate };
  if (OWE_TAPS[key]) out.start = TAP_VALUES[OWE_TAPS[key]].includes(x?.start) ? x.start : null;
  if (key === "mortgage" && askHome) out.home = pos(x?.home);
  // "Year you bought it": the screen's box (a year, or null when left blank); a screen without the box leaves it to the plan
  if (key === "mortgage" && x && Object.prototype.hasOwnProperty.call(x, "bought")) out.bought = parseYear(x.bought, Number(String(today ?? "2200").slice(0, 4)));
  return out;
}
/**
 * Q5b with our guesses (the view passes ctx.guess; spec 10, section 7.D): a debt picked on Q5 is never dropped. A box
 * left blank gets our guess, written through markGuess (the ledger entry, and the older rateGuessed / paymentGuessed
 * flags mirrored, so Liabilities and the reveal read them as before): what is still owed (worked back from the payment
 * when it is typed), the rate and the payment; the mortgage's home value when the screen asks it. A figure typed is the
 * person's (any guess on it goes). The one-tap answer (when the loan was taken out) is kept in guide.setup.taps. Every
 * guess is worked out by `guess(key, { path, args })` from the plan as it was before this save plus the screen's answers
 * (oweArgs), the same call the screen made for its grey figures. With no guess at all (a plan outside the U.S.: the
 * guesses' gate is closed), each box does what it did before the guesses: a blank balance saves nothing, a blank rate
 * or payment gets the typical one.
 */
function applyOweGuessed(draft, v, today, guess) {
  ensure(draft);
  const gone = [];
  let paidInFull = false;
  const askHome = askHomeWithMortgage(draft);
  const ask = (key, path, args) => { let e = null; try { e = guess(key, { path, args }); } catch { e = null; } return e && typeof e.value === "number" && Number.isFinite(e.value) ? e : null; };
  for (const o of OWE) {
    if (!picks(draft, "owe").includes(o.key) || oweTaken(draft, o.key)) continue;
    const x = v[o.key] ?? {};
    const id = oweId(o.key), did = `setup-debt-${o.key}`;
    if (o.key === "credit" && x.paidInFull) { paidInFull = true; gone.push(id); continue; }
    const args = oweArgs(draft, x, o.key, { askHome });
    const owedPath = `accounts[${id}].balance`, ratePath = `debts[${did}].rate`, payPath = `debts[${did}].minPayment`;
    const gOwed = args.owed === null ? ask(`debt.${o.key}.owed`, owedPath, args) : null;
    const owed = args.owed ?? gOwed?.value ?? null;
    if (!(owed > 0)) { gone.push(id); continue; }
    const gRate = args.rate === null ? ask(`debt.${o.key}.rate`, ratePath, args) : null;
    const gPay = args.payment === null ? ask(`debt.${o.key}.payment`, payPath, args) : null;
    const gHome = o.key === "mortgage" && askHome && args.home === null ? ask("home.value", `accounts[${haveId("home")}].balance`, args) : null;
    const old = byId(draft.accounts, id);
    put(draft.accounts, id, old && old.balance === owed ? {} : { balance: owed, asOf: today }, { name: o.name, type: o.type, institution: "", asOf: today, ownerId: "", history: [], notes: "" });
    // a plan from before the guesses dropped this mortgage, so question 6 asked "Rent" and the person put the home's
    // payment there: named "Rent or mortgage", Expenses files the mortgage under it and counts the payment once
    const housing = o.key === "mortgage" && !old ? byId(draft.expenses, "setup-x-housing") : null;
    // (a row that is our guess was never the home's payment: it becomes the home's other costs, which settle then works out;
    // C3 review D1)
    if (housing && housing.name === SPEND.find((r) => r.key === "housing").label) housing.name = isGuess(draft, "expenses[setup-x-housing].amount") ? "Home costs" : "Rent or mortgage";
    const row0 = byId(draft.debts, did);
    // with no guess (the gate is closed), the rate and payment as before: the row's own, else the typical one, kept in the flag
    const ownRate = row0 && !rateIsGuess(row0) && !isGuess(draft, ratePath);
    const rate = args.rate ?? gRate?.value ?? (ownRate ? row0.rate : TYPICAL_RATES[o.key]);
    const ownPay = row0 && !paymentIsGuess(row0) && !isGuess(draft, payPath) && Number(row0.minPayment) > 0 ? row0.minPayment : null;
    const payment = args.payment ?? gPay?.value ?? ownPay ?? typicalPayment(o.key, owed, rate);
    const r = put(draft.debts, did, { rate, minPayment: payment }, { accountId: id, extra: 0, termMonths: null, startDate: "", securedBy: "", creditLimit: null });
    if (gOwed) markGuess(draft, owedPath, gOwed, today); else clearGuess(draft, owedPath);
    if (gRate) markGuess(draft, ratePath, gRate, today);
    else if (args.rate !== null || ownRate) clearGuess(draft, ratePath);
    else if (r.rateGuessed !== rate) r.rateGuessed = rate;
    if (gPay) markGuess(draft, payPath, gPay, today);
    else if (args.payment !== null || ownPay !== null) clearGuess(draft, payPath);
    else if (r.paymentGuessed !== payment) r.paymentGuessed = payment;
    const tap = OWE_TAPS[o.key];
    if (tap && args.start !== null && draft.guide.setup.taps?.[tap] !== args.start) draft.guide.setup.taps = { ...(draft.guide.setup.taps ?? {}), [tap]: args.start };
    // a mortgage with no home in the plan: what the home would sell for (typed, else our guess), so net worth has both sides
    if (o.key === "mortgage" && askHome && !existingHave(draft, "home").length) {
      const home = args.home ?? gHome?.value ?? null;
      if (home) {
        const hid = haveId("home"), h = HAVE.find((k) => k.key === "home"), was = byId(draft.accounts, hid);
        put(draft.accounts, hid, was && was.balance === home ? {} : { balance: home, asOf: today }, { name: h.name, type: h.type, institution: "", asOf: today, ownerId: "", history: [], notes: "" });
        if (gHome) markGuess(draft, `accounts[${hid}].balance`, gHome, today); else clearGuess(draft, `accounts[${hid}].balance`);
        if (!picks(draft, "have").includes("home")) { draft.guide.setup.picks.have = [...picks(draft, "have"), "home"]; draft.guide.setup.homeFromOwe = true; }
      }
    }
  }
  if ((draft.guide.setup.paidInFull ?? false) !== paidInFull) draft.guide.setup.paidInFull = paidInFull;
  if (picks(draft, "owe").includes("mortgage") && !oweTaken(draft, "mortgage")) applyBought(draft, boughtOf(v.mortgage, today));
  return dropAccounts(draft, gone);
}
/** Ask the home's value with the mortgage: the plan has no home, or only the one this box made. */
// (and while the setup's home value is still our guess: it stays a grey box here, never a line that says it was typed)
export const askHomeWithMortgage = (p) => !existingHave(p, "home").length && (!byId(L(p, "accounts"), haveId("home")) || !!setupOf(p).homeFromOwe || isGuess(p, `accounts[${haveId("home")}].balance`));
/** Has a mortgage: the housing question then asks for costs besides its payment. */
export const hasMortgage = (p) => L(p, "accounts").some((a) => a.type === "mortgage" && Number(a.balance));
/**
 * What the spending screen starts from: the plan's own bills (made on Expenses) a month, the loan and card payments
 * Expenses already counts from Liabilities (F-019), and the part of the bills that goes on after work stops (without
 * loan payments and childcare), for the retirement question's first figure.
 */
export function spendBase(plan) {
  const own = existingSpend(plan);
  // only amounts are read here, and no amount depends on the guess ledger (Expenses' guessed share and Debts' "by our
  // guesses" flag do): left out, so settle (which runs this on every update) does not look each bill up in it
  const bare = { ...plan, guesses: undefined };
  const ex = own.length ? computeExpenses({ ...bare, expenses: own, debts: [] }, {}) : null;
  const cat = (k) => ex?.byCategory.find((c) => c.category === k)?.monthly ?? 0;
  const all = L(plan, "debts").length ? computeExpenses({ ...bare, expenses: own }, {}) : null;
  return { existing: ex?.monthly ?? 0, existingCount: own.length, existingCore: (ex?.monthly ?? 0) - cat("debt") - cat("childcare"), loanPayments: all?.debtFromDebts ?? 0 };
}
/**
 * Spending once work stops, to start the question with, to $10: today's bills without childcare and loan payments,
 * plus the payment of each loan still being paid when the first adult stops work (months to payoff at its payment,
 * nper in core/math/finance.js, past the months until then; a loan that never pays off at its payment counts too).
 * Without birth dates nobody knows when work stops, so no loan is added.
 */
export function retireDefault(plan, today = null, base = spendBase(plan)) {
  const rows = L(plan, "expenses").filter((x) => isSetupId(x.id) && x.category !== "childcare").reduce((s, x) => s + perYear(x.amount, x.period) / 12, 0);
  return Math.round((base.existingCore + rows + loansAfterWork(plan, today)) / 10) * 10;
}
/** The loan payments a month still running when the first adult stops work (retireDefault's loan part). */
export const loansAfterWork = (plan, today = null) => loansRunningThen(plan, today).reduce((t, d) => t + (Number(d.minPayment) || 0), 0);
/** The debts (Liabilities rows) still being paid when the first adult stops work: loansAfterWork's list. */
export function loansRunningThen(plan, today = null) {
  const planAge = Number(plan?.assumptions?.retirementAge ?? 65);
  const left = today ? adults(plan).filter((p) => p.birthDate && setupOf(plan).status?.[p.id] !== "retired").map((p) => Math.max(0, ((p.retirementAge ?? planAge) - ageOn(p.birthDate, today)) * 12)) : [];
  const until = left.length ? Math.min(...left) : null;
  const out = [];
  if (until !== null && !L(plan, "expenses").some((x) => x.category === "debt")) {
    for (const d of L(plan, "debts")) {
      const owed = Math.abs(Number(byId(L(plan, "accounts"), d.accountId)?.balance) || 0), pay = Number(d.minPayment) || 0;
      if (!(owed > 0) || !(pay > 0)) continue;
      const months = nper((Number(d.rate) || 0) / 12, pay, owed);
      if (!Number.isFinite(months) || months > until) out.push(d);
    }
  }
  return out;
}
/**
 * Q6's rows a month as saved, or as the screen holds them (`args`, spendArgs: a blank row is our guess for it, worked out
 * by `lib.estimate`), with "total" for One rough total. -> { rows: { [row | "total"]: monthly }, guessed: true when one is ours }
 */
function spendRowValues(plan, { today, args }, lib) {
  const out = {};
  let guessed = false;
  if (args) {
    if (args.total) out.total = args.total;
    else for (const [k, v] of Object.entries(args.rows ?? {})) {
      if (v !== null) { out[k] = v; continue; }
      const e = lib?.estimate?.(`spend.${k}`, { path: `expenses[setup-x-${k}].amount`, args });
      if (e && typeof e.value === "number" && e.value > 0) { out[k] = e.value; guessed = true; }
    }
  } else {
    for (const x of L(plan, "expenses")) {
      if (typeof x.id !== "string" || !x.id.startsWith("setup-x-")) continue;
      out[x.id.slice(8)] = perYear(x.amount, x.period) / 12;
      if (isGuess(plan, `expenses[${x.id}].amount`)) guessed = true;
    }
  }
  return { rows: out, guessed };
}
/**
 * Retirement spending a month (spec 7.F), to $10. Under 50 (the oldest adult; no birth dates counts as under): today's
 * bills without childcare, plus the loans still running then (retireDefault). From 50: the everyday rows (utilities,
 * groceries, car and transit, eating out, shopping) each times what households 65-74 spend on it over households 55-64
 * (RETIRE_RATIO, the Consumer Expenditure Surveys by age), plus the home costs that go on (the housing row, and a
 * mortgage's tax and insurance once it is paid off: home.propertyTax and home.insurance), plus the other bills on Expenses
 * (as retireDefault counts them) and the loans still running then. Health cover is never in it: before and after 65 it is
 * the retirement projection's own health line. "One rough total" cannot be split, so it is carried whole.
 * -> { value, from50, guessed, loans, oldest } | null
 */
export function retireSpendFor(plan, { today = null, args = null } = {}, lib = null) {
  const ages = adults(plan).map((p) => (p.birthDate && today ? ageOn(p.birthDate, today) : null)).filter((a) => a !== null);
  const oldest = ages.length ? Math.max(...ages) : null;
  const loans = loansAfterWork(plan, today);
  const { rows, guessed } = spendRowValues(plan, { today, args }, lib);
  const base = spendBase(plan), core = base.existingCore;
  if (!(oldest >= 50)) {
    if (!args) return { value: retireDefault(plan, today, base), from50: false, guessed, loans, oldest };
    const sum = Object.entries(rows).filter(([k]) => k !== "childcare").reduce((t, [, v]) => t + v, 0);
    return { value: Math.round((core + sum + loans) / 10) * 10, from50: false, guessed, loans, oldest };
  }
  let v = core + loans + (rows.total ?? 0) + (rows.housing ?? 0);
  for (const [k, r] of Object.entries(RETIRE_RATIO)) v += (rows[k] ?? 0) * r;
  // a mortgage's tax and insurance (in its payment today) go on once it is paid off: added for a mortgage paid off before
  // work stops. One still running then is in `loans` with its whole payment, tax and insurance included, and the figure is
  // one amount for every year, so they are not added a second time (C3 review D9: they were, about $270 a month for life)
  const mortgageThen = loansRunningThen(plan, today).some((d) => L(plan, "accounts").find((a) => a.id === d.accountId)?.type === "mortgage");
  if (hasMortgage(plan) && !mortgageThen && !rows.total && setupOf(plan).taps?.escrow !== "no" && lib) { const esc = escrowMonthly(plan, { today }, lib); if (esc) v += esc.total; }
  return { value: Math.round(v / 10) * 10, from50: true, guessed, loans, oldest };
}
/** Everyone is already retired: the retirement spending question is not asked (today's bills are retirement's). */
export const allRetired = (p) => adults(p).length > 0 && adults(p).every((a) => setupOf(p).status?.[a.id] === "retired");
/**
 * Q6. A month's spending: { mode: "rows"|"total", rows: { [key]: amount }, total, retireMonthly }. Rows the plan already
 * has a bill for are not asked. One rough total is counted as must-pay (safer for the cushion). `retireMonthly` is
 * what you expect to spend a month once you stop working, saved as Retirement's own figure.
 */
export function applySpend(draft, v, today = null, { guess = null } = {}) {
  if (typeof guess === "function") return applySpendGuessed(draft, v, today, guess);
  ensure(draft);
  const mode = v.mode === "total" ? "total" : "rows";
  if ((draft.guide.setup.spendMode ?? "rows") !== mode || !draft.guide.setup.spendMode) draft.guide.setup.spendMode = mode;
  delete draft.guide.setup.spendLeft;   // spending answered as spending: a left-over said before no longer drives it (applyLeftOver sets it again)
  const keep = new Set();
  const line = { period: "monthly", inflates: true, startDate: "", endDate: "" };
  if (mode === "total") {
    const total = pos(v.total);
    if (total) { keep.add("setup-x-total"); put(draft.expenses, "setup-x-total", { amount: total }, { name: "Monthly spending (rough)", category: "other", essential: true, ...line }); }
  } else {
    const mortgage = hasMortgage(draft);
    for (const s of spendRows(draft)) {
      const amount = pos(v.rows?.[s.key]);
      if (!amount) continue;
      const id = `setup-x-${s.key}`;
      keep.add(id);
      put(draft.expenses, id, { amount }, { name: s.key === "housing" && mortgage ? "Home costs" : s.label, category: s.key, essential: s.group === "must" && CATEGORIES[s.key]?.essential !== false, ...line });
      // "Rent or mortgage" (Q5b's name for a "Rent" row once our guesses kept the mortgage): answered here as the home's
      // costs besides the mortgage, it is named so, and the mortgage's payment counts from Debts again
      const row = s.key === "housing" && mortgage ? byId(draft.expenses, id) : null;
      if (row && row.name === "Rent or mortgage") row.name = "Home costs";
    }
  }
  draft.expenses = draft.expenses.filter((x) => !isSetupId(x.id) || keep.has(x.id));
  // the figure follows the bills while it is the screen's own starting figure (retireAuto), and stays once typed
  const later = pos(v.retireMonthly);
  if (later && !allRetired(draft)) {
    if (Number(draft.retirement.spendingMonthly) !== later) draft.retirement.spendingMonthly = later;
    const auto = v.retireAuto === true;
    if ((draft.guide.setup.retireAuto ?? null) !== auto) draft.guide.setup.retireAuto = auto;
  }
}
/**
 * What Q6 holds, as the guesses read it (core/estimate `args`): { mode, rows: { [row]: number | null } (null: a box left
 * blank, which our guess fills; 0: the person's own 0), total (null when blank), taps } for the rows the screen asks
 * (spendRows). In "One rough total" with the total left blank, every row is ours. The same reading applySpend makes, so a
 * grey figure is exactly what saving the blank box writes.
 */
export function spendArgs(plan, v = {}) {
  const mode = v?.mode === "total" ? "total" : "rows";
  // (a total typed as 0 is the person's 0, so nothing is guessed under it; blank is null: C3 review D7)
  const total = mode === "total" ? nonneg(v?.total) : null;
  const rows = total !== null ? {} : Object.fromEntries(spendRows(plan).map((s) => [s.key, mode === "total" ? null : nonneg(v?.rows?.[s.key])]));
  const taps = Object.fromEntries(SPEND_TAPS.map((k) => [k, v?.taps?.[k] ?? null]).filter(([k, x]) => TAP_VALUES[k].includes(x)));
  return { mode, rows, total, taps };
}
/** The one-tap answers Q6 may show (guide.setup.taps): how health cover is had, childcare paid, an HOA fee. */
export const SPEND_TAPS = ["health-cover", "childcare", "hoa"];
/** Rows the person typed as 0 on Q6 (guide.setup.spendZero): theirs, never guessed. */
const zeroRows = (p) => (Array.isArray(setupOf(p).spendZero) ? setupOf(p).spendZero : []);
/**
 * Q6's "Your best guess for a normal month" (part 3 of the path): one figure for the month, shared out over the rows. The rows
 * typed (in the "Split it up" fold) stay as typed and come off the figure; what is left is shared over the blank rows in the
 * proportions of our guesses for them (`guessOf(row)` -> { value } | null, the guess the screen shows grey). Whole dollars, the
 * biggest row takes the odd dollars, so the rows add up to the figure. A typed split above the figure wins (nothing is left to
 * share). With no guess to share by, the rest is returned as `rest` (one rough row). -> null when no figure was typed, else
 * { rows: { [key]: dollars }, rest, typed, left }
 */
export function sumSplit(rows, args, sum, guessOf) {
  if (!(sum > 0)) return null;
  const typed = rows.reduce((t, s) => t + (args?.rows?.[s.key] > 0 ? args.rows[s.key] : 0), 0);
  const left = sum - typed;
  const out = {};
  if (!(left > 0)) return { rows: out, rest: 0, typed, left: 0 };
  const blanks = rows.filter((s) => args?.rows?.[s.key] === null).map((s) => ({ key: s.key, g: Number(guessOf(s)?.value) })).filter((x) => x.g > 0);
  const total = blanks.reduce((t, x) => t + x.g, 0);
  if (!(total > 0)) return { rows: out, rest: Math.round(left), typed, left };
  let used = 0, big = blanks[0];
  for (const x of blanks) { out[x.key] = Math.floor(left * x.g / total); used += out[x.key]; if (x.g > big.g) big = x; }
  out[big.key] += Math.round(left) - used;
  return { rows: out, rest: 0, typed, left };
}
/**
 * Q6 with our guesses (the view passes ctx.guess; spec 10, 7.A): a row typed is the person's (any guess on it goes); a 0
 * typed is their 0 (no row, remembered in guide.setup.spendZero so it is never guessed); a box left blank gets our guess,
 * written through markGuess. "One rough total" typed is written as before; left blank, the rows are written as guesses.
 * The taps answered are kept in guide.setup.taps. Retirement spending: a figure typed is the person's; otherwise our
 * figure (overview/setup:retireSpend) is written and marked, the line or the box the screen showed. Every guess is worked
 * out by `guess(key, { path, args })` from the plan as it was before this save plus the screen's answers (spendArgs).
 */
function applySpendGuessed(draft, v, today, guess) {
  ensure(draft);
  const args = spendArgs(draft, v);
  const s = draft.guide.setup;
  const mode = args.mode;
  if ((s.spendMode ?? "rows") !== mode || !s.spendMode) s.spendMode = mode;
  delete s.spendLeft;   // (see applySpend)
  const ask = (key, path, a = args) => { let e = null; try { e = guess(key, { path, args: a }); } catch { e = null; } return e && typeof e.value === "number" && Number.isFinite(e.value) ? e : null; };
  const keep = new Set(), zero = [];
  let split = null, figure = null;
  const line = { period: "monthly", inflates: true, startDate: "", endDate: "" };
  const mortgage = hasMortgage(draft);
  if (args.total) { keep.add("setup-x-total"); put(draft.expenses, "setup-x-total", { amount: args.total }, { name: "Monthly spending (rough)", category: "other", essential: true, ...line }); clearGuess(draft, "expenses[setup-x-total].amount"); }
  else {
    // "Your best guess for a normal month" (v.sum, part 3): one figure for the month. The rows the person typed stay theirs; what
    // is left of the figure is shared out over the blank rows in the proportions of our guesses for them (the same split the
    // survey writes when nothing is typed), so the rows add up to the figure. Those rows are the person's figure shared out,
    // not our guesses, so they carry no guess mark (a month the person gave is never "mostly our guesses").
    // (whole dollars: a decimal figure is rounded once here, so the rows and the retirement guess are worked from the same number)
    figure = mode === "rows" && pos(v.sum) ? Math.max(1, Math.round(pos(v.sum))) : null;
    // (and a decimal group typed beside it is rounded once too, so the rows add up to the figure exactly)
    if (figure) for (const k of Object.keys(args.rows)) if (args.rows[k] > 0) args.rows[k] = Math.max(1, Math.round(args.rows[k]));
    split = sumSplit(spendRows(draft), args, figure, (row) => ask(`spend.${row.key}`, `expenses[setup-x-${row.key}].amount`));
    for (const row of spendRows(draft)) {
      const id = `setup-x-${row.key}`, path = `expenses[${id}].amount`, typed = args.rows[row.key];
      if (typed === 0) { zero.push(row.key); continue; }
      const e = typed === null && !split ? ask(`spend.${row.key}`, path) : null;
      const amount = typed ?? (split ? split.rows[row.key] ?? null : e && e.value > 0 ? e.value : null);
      if (!amount) continue;
      keep.add(id);
      put(draft.expenses, id, { amount }, { name: row.key === "housing" ? (mortgage ? "Home costs" : housingWords(draft).name) : row.label, category: row.key, essential: row.group === "must" && CATEGORIES[row.key]?.essential !== false, ...line });
      const rec = row.key === "housing" && mortgage ? byId(draft.expenses, id) : null;
      if (rec && rec.name === "Rent or mortgage") rec.name = "Home costs";
      // answered as the home's costs (an owner), a row named "Rent" before is named as the screen asked it
      const own = row.key === "housing" && !mortgage && housingWords(draft).kind !== "rent" ? byId(draft.expenses, id) : null;
      if (own && own.name === row.label) own.name = "Home costs";
      if (e && typed === null) markGuess(draft, path, e, today); else clearGuess(draft, path);
    }
    // nothing of ours to share the rest by (no row has a guess): the rest is one rough row, as "One rough total" writes it
    if (split?.rest > 0) { keep.add("setup-x-total"); put(draft.expenses, "setup-x-total", { amount: split.rest }, { name: "Monthly spending (rough)", category: "other", essential: true, ...line }); clearGuess(draft, "expenses[setup-x-total].amount"); }
  }
  draft.expenses = draft.expenses.filter((x) => !isSetupId(x.id) || keep.has(x.id));
  // the figure given in the top box is remembered (guide.setup.spendSum) with the groups typed beside it, so reopening can put it back
  // and share it out again; gone when the box is left empty (or a total is typed the old way)
  const sumNow = split && split.left > 0 && figure ? { sum: figure, typed: spendRows(draft).filter((row) => args.rows[row.key] > 0).map((row) => row.key) } : null;
  if (JSON.stringify(s.spendSum ?? null) !== JSON.stringify(sumNow)) { if (sumNow) s.spendSum = sumNow; else delete s.spendSum; }
  if (JSON.stringify(zeroRows(draft)) !== JSON.stringify(zero)) { if (zero.length) s.spendZero = zero; else delete s.spendZero; }
  for (const [k, x] of Object.entries(args.taps)) if (s.taps?.[k] !== x) s.taps = { ...(s.taps ?? {}), [k]: x };
  if (allRetired(draft)) return;
  const typedLater = v.retireAuto === false ? pos(v.retireMonthly) : null;
  const path = "retirement.spendingMonthly";
  if (typedLater) {
    if (Number(draft.retirement.spendingMonthly) !== typedLater) draft.retirement.spendingMonthly = typedLater;
    clearGuess(draft, path);
    if ((s.retireAuto ?? null) !== false) s.retireAuto = false;
    return;
  }
  const e = ask("overview/setup:retireSpend", path, split ? { ...args, rows: { ...args.rows, ...split.rows } } : args);
  if (e && e.value > 0) { if (draft.retirement.spendingMonthly === undefined) draft.retirement.spendingMonthly = null; markGuess(draft, path, e, today); }
}
/** The month on Q6 once saved: the rows the screen asks (typed and ours), how many are ours, and their total. */
export function spendRowsNow(plan) {
  const rows = L(plan, "expenses").filter((x) => typeof x.id === "string" && x.id.startsWith("setup-x-"));
  // a row read from two months of bank files (ledger spread BANK_SPREAD, smart guesses C7 R12) is the household's own
  // spending, not "our guess", as on Expenses (`guessedMonthly`)
  const guessed = rows.filter((x) => isGuess(plan, `expenses[${x.id}].amount`) && plan.guesses?.[`expenses[${x.id}].amount`]?.s !== BANK_SPREAD);
  const m = (list) => list.reduce((t, x) => t + perYear(x.amount, x.period) / 12, 0);
  return { count: rows.length, guessed: guessed.length, monthly: m(rows), guessedMonthly: m(guessed), typedMonthly: m(rows) - m(guessed) };
}
// ---- Question 6 the other way: "what's left over". Spending and the left-over are one fact said two ways (core/math/leftover.js),
// so either is typed and the other is worked out. The left-over is Next best action's `spare.monthly`, the app's one figure;
// the spending that makes it read exactly what was typed is found by writing the rows and reading the figure back, so
// nothing here repeats the tax, saving or debt arithmetic and the two cannot drift apart.
/** The spending rows for one whole-dollar figure, written the way question 6 saves them (the best-guess figure shared out; with no guesses the rest, after the groups typed, is one rough row). */
function writeFigure(c, v, fig, today, guess) {
  // nothing for the rows (the other bills and loan payments already are the whole month): no row, none of ours left behind
  if (!(fig > 0)) { applySpend(c, { mode: "total", total: 0 }, today); delete c.guide.setup.spendSum; return; }
  // (no guesses: the same writer with nothing to share by, so the groups typed stay and the rest is one rough row)
  applySpendGuessed(c, { ...v, mode: "rows", sum: fig, total: undefined }, today, typeof guess === "function" ? guess : () => null);
}
/** The typed groups' total on the screen (blank is ours, 0 is theirs): the rows a worked-out figure must leave alone. */
const typedTotal = (plan, v) => { const a = spendArgs(plan, { ...v, mode: "rows" }); return Object.values(a.rows).reduce((t, x) => t + (x > 0 ? Math.max(1, Math.round(x)) : 0), 0); };
/**
 * Work out the spending rows' total for a month that must read a given figure. `v` is the screen as for applySpend (rows typed
 * stay typed); `want` is { left } (the left-over a month in the person's sense, core/math/leftover.js leftOverOf: before goal saving,
 * below zero when the account goes down) or { month } (all of the month's spending, loan payments and every bill on Expenses
 * included). Rows are written on a copy and the figure read back, a few passes at most (a straight line: each dollar of
 * spending is a dollar less left over), then the whole dollars around the crossing are tried, because some plans step (a
 * child care credit that moves with the bills): the answer is only `ok` when the figure read back is within a dollar of the
 * one asked for (half a dollar unless the plan steps), never on a hope.
 * -> { ok: true, figure (the rows' total, whole dollars), rows (what the rows add up to), month (all the spending a month),
 *      others (the part of it that is not these rows: other bills, loan payments), left (the left-over as it then reads),
 *      spare (Next best action's month as it then reads, for the year's saving), typed }
 *    | { ok: false, why: "pay" (no pay on file: the left-over cannot be worked out)
 *      | "typed" (the groups typed already add up to more than the figure leaves room for)
 *      | "bills" (the other bills on Expenses and the loan payments already do)
 *      | "more-than-pay" (the left-over is more than comes in after tax and saving: `available` a month)
 *      | "step" (no whole-dollar spending lands within a dollar of it), over (by how much, a month), allowed (the most they may add up to), available }
 */
export function solveSpend(plan, v, want, { today, guess = null } = {}) {
  const left = want?.left !== undefined;
  const target = left ? Math.round(Number(want.left)) : Math.round(Number(want?.month));
  if (!Number.isFinite(target)) return { ok: false, why: "pay", over: 0, allowed: 0 };
  const typed = typedTotal(plan, v);
  // one try: the rows for a whole-dollar figure on a copy of the plan, and what the month then reads
  const attempt = (fig) => {
    const c = structuredClone(plan), w = Math.max(0, Math.round(fig));
    writeFigure(c, v, w, today, guess);
    let exp = null, spare = null, m = null;
    try { exp = computeExpenses(c, { today }); } catch { return null; }
    if (left) { let n = null; try { n = computeNext(c, { today }); } catch { n = null; } spare = n?.ready ? n.spare : null; if (!spare) return null; m = leftOverOf(spare); }
    else m = exp.monthly;
    return { w, c, exp, spare, m, rows: setupRowsMonthly(c) };
  };
  const sign = left ? -1 : 1;
  let fig = typed + 1000, last = null, seen = null;
  for (let pass = 0; pass < 6; pass++) {
    last = attempt(fig);
    // (no rows and no other bills leave no month to read: a left-over that is all of what comes in, said as such, not "add your pay"; verify 2026-11-07)
    if (!last) return left && seen !== null && Math.round(fig) <= 0 ? { ok: false, why: "more-than-pay", over: Math.max(0, Math.round(target - seen)), allowed: 0, available: Math.round(seen) } : { ok: false, why: "pay", over: 0, allowed: 0 };
    if (left) seen = last.m + last.exp.monthly;
    const diff = (target - last.m) * sign;        // dollars to add to the rows to land on the target
    if (pass > 0 && Math.abs(diff) <= 0.5 + 1e-9) break;
    fig = last.w + diff;
    // the pay side of the month: what comes in after tax and saving, before any spending (the left-over is more than that: nothing can be spent)
    const available = left ? last.m + last.exp.monthly : null;
    if (left && available - target < -0.5) return { ok: false, why: "more-than-pay", over: Math.round(target - available), allowed: 0, available: Math.round(available) };
    // below what the typed groups already add up to, the figure cannot be reached: nothing is left to share
    if (fig < typed - 0.5 || fig < -0.5) {
      // below zero for all the rows: the other bills and loan payments alone use up the month; else the groups typed are too much
      return fig < -0.5 ? { ok: false, why: "bills", over: Math.max(0, Math.round(-fig)), allowed: 0, available: available === null ? null : Math.round(available) } : { ok: false, why: "typed", over: Math.max(0, Math.round(typed - fig)), allowed: Math.round(fig), available: available === null ? null : Math.round(available) };
    }
  }
  // the crossing found: keep it when it reads the figure to the dollar (a typed 0 reads level: never a hair below it); else try the
  // whole dollars around it and keep the closest, none within a dollar being "step" (nothing is written then)
  const level = left && target === 0;
  const score = (r) => (level && r.m < 0 ? Infinity : Math.abs(r.m - target));
  let best = last;
  if (!(score(best) <= 0.5)) {
    const seen = new Map([[best.w, best]]);
    for (let d = -3; d <= 3; d++) {
      const w = Math.max(typed, best.w + d);
      if (seen.has(w)) continue;
      const r = attempt(w);
      if (r) seen.set(w, r);
    }
    for (const r of seen.values()) if (score(r) < score(best) || (score(r) === score(best) && r.w < best.w)) best = r;
    if (!(score(best) <= 1 + 1e-9)) return { ok: false, why: "step", over: 0, allowed: 0 };
  }
  const others = best.exp.monthly - best.rows;
  // nothing at all to spend on (no bills, no loan payments, and the left-over is all of what comes in): not a month of any household
  if (best.w === 0 && others < 0.5) return { ok: false, why: "more-than-pay", over: 0, allowed: 0, available: left ? Math.round(best.m + best.exp.monthly) : null };
  return { ok: true, figure: best.w, rows: Math.round(best.rows), month: best.exp.monthly, left: left ? best.m : null, spare: best.spare, typed, others };
}
/** Question 6's answers as the plan holds them now, for applyLeftOver / applyMonthTotal called from another page (Expenses): typed groups stay, our figures follow. */
export function spendAnswers(plan) {
  const v = valuesFor(plan, "spend");
  return { ...v, retireMonthly: v.retireTyped ? v.retireMonthly : "", retireAuto: !v.retireTyped };
}
/**
 * Question 6 answered as "what's left over" (v.left a month, a number below zero when the account goes down): writes the same rows
 * the question writes, our guessed split scaled to the total that makes the left-over read exactly v.left, never touching a
 * group the person typed, and keeps the note guide.setup.spendLeft { left, on, rows } (core/math/leftover.js leftMarker).
 * The note's day only moves when the left-over or the rows do (passing through the question again changes nothing).
 * -> the solveSpend answer; on `ok: false` nothing is written.
 */
export function applyLeftOver(draft, v, today = null, { guess = null } = {}) {
  const left = Math.round(Number(parseMoney(v.left))) + 0;   // (+ 0: never a negative zero)
  const r = solveSpend(draft, v, { left }, { today, guess });
  if (!r.ok) return r;
  ensure(draft);
  const prev = draft.guide.setup.spendLeft;
  // the spending already reads this left-over and nothing else on the screen differs (Continue after pay moved, with the box on what it
  // now reads): the rows stay as they are, row by row. Our split follows the pay, so writing it again moved rent and food while the
  // screen said "Continue keeps your spending as it is" (verify 2026-11-07, review D10)
  if (!readsAlready(draft, v, left, today)) writeFigure(draft, v, r.figure, today, guess);
  const rows = Math.round(setupRowsMonthly(draft));
  draft.guide.setup.spendLeft = prev && Number(prev.left) === left && Number(prev.rows) === rows ? { ...prev } : { left, on: today ?? "", rows };
  return r;
}
/**
 * The plan already reads left-over `left` with the screen `v` as the plan holds it: none of the spending rows is our guess, the groups
 * typed on the screen are the rows' amounts, the taps and a typed retirement figure are as saved. Then applyLeftOver writes only the note.
 */
function readsAlready(plan, v, left, today) {
  if (spendRowsNow(plan).guessed > 0) return false;
  const mine = L(plan, "expenses").filter((x) => typeof x.id === "string" && x.id.startsWith("setup-x-"));
  if (mine.some((x) => x.period !== "monthly")) return false;
  const args = spendArgs(plan, { ...v, mode: "rows" }), s = setupOf(plan);
  for (const [k, x] of Object.entries(args.rows)) {
    if (x === null || x === undefined) continue;
    const amt = Math.round(Number(byId(mine, `setup-x-${k}`)?.amount) || 0);
    if (amt !== (x > 0 ? Math.max(1, Math.round(x)) : 0)) return false;
  }
  if (Object.entries(args.taps).some(([k, x]) => (s.taps?.[k] ?? null) !== x)) return false;
  const later = v.retireAuto === false ? pos(v.retireMonthly) : null;
  if (later && Number(plan.retirement?.spendingMonthly) !== later) return false;
  let n = null;
  try { n = computeNext(plan, { today }); } catch { return false; }
  if (!n?.ready) return false;
  const m = leftOverOf(n.spare);
  return left === 0 ? m >= -1e-9 && m <= 1 : Math.abs(m - left) <= 0.5 + 1e-9;
}
/**
 * The left-over as the plan reads it now (before goal saving, core/math/leftover.js leftOverOf), whole dollars, or null when it
 * cannot be worked out (no pay yet). What the box on question 6 is filled with after pay or bills moved the figure.
 */
export function leftReading(plan, today) {
  try { const n = computeNext(plan, { today }); return n?.ready ? Math.round(leftOverOf(n.spare)) + 0 : null; } catch { return null; }
}
/** Spending already answered by the person (a figure given, groups typed, or worked out from a left-over): the rows are theirs, not our guesses. */
export const spendAnswered = (plan) => !!leftMarker(plan) || spendRowsNow(plan).typedMonthly > 0.5;
/**
 * All of the month's spending typed in one figure (Expenses): the same rows, sized so the whole month, bills and loan payments
 * included, adds up to `total`. The rows typed stay; -> the solveSpend answer, nothing written on `ok: false`.
 */
export function applyMonthTotal(draft, v, today = null, { guess = null } = {}) {
  const r = solveSpend(draft, v, { month: Math.round(Number(parseMoney(v.total))) }, { today, guess });
  if (!r.ok) return r;
  ensure(draft);
  writeFigure(draft, v, r.figure, today, guess);
  return r;
}
/**
 * The grey figure in the left-over box: what the month leaves now when the spending is already the person's (given, typed or worked
 * out), else what it would leave if we guessed the spending (the screen's typed groups kept). Null when it cannot be worked out.
 */
export function leftOverGuess(plan, v, today, guess = null) {
  if (spendAnswered(plan)) return leftReading(plan, today);
  const c = structuredClone(plan);
  try { writeBlank(c, v, today, guess); const n = computeNext(c, { today }); return n?.ready ? leftOverOf(n.spare) : null; } catch { return null; }
}
function writeBlank(c, v, today, guess) {
  const blank = { ...v, mode: "rows", sum: "", total: "" };
  if (typeof guess === "function") applySpendGuessed(c, blank, today, guess); else applySpend(c, { ...blank, mode: "rows" }, today);
}
/** Q7. What you are working toward (keys of GOALS; a kind the plan already has is not added). Goals linked from elsewhere stay. */
export function applyGoalPicks(draft, keys) {
  ensure(draft);
  const valid = keys.filter((k) => GOALS.some((g) => g.key === k));
  const ks = valid.filter((k) => GOALS.find((g) => g.key === k).focus || !goalTaken(draft, k));
  if (JSON.stringify(picks(draft, "goals")) !== JSON.stringify(ks)) draft.guide.setup.picks.goals = ks;
  const focus = ks.filter((k) => GOALS.find((g) => g.key === k)?.focus);
  if (JSON.stringify(draft.guide.setup.focus ?? []) !== JSON.stringify(focus)) draft.guide.setup.focus = focus;
  const linked = new Set(L(draft, "events").map((e) => e.goalId).filter(Boolean));
  draft.goals = draft.goals.filter((g) => !isSetupId(g.id) || ks.includes(g.id.replace(/^setup-goal-/, "")) || linked.has(g.id));
  // question 7b's answer for a goal no longer here goes with it
  const gf = draft.guide.setup.goalFunds;
  if (gf) { for (const k of Object.keys(gf)) if (!byId(draft.goals, `setup-goal-${k}`)) delete gf[k]; if (!Object.keys(gf).length) delete draft.guide.setup.goalFunds; }
}
/**
 * The cushion: months x must-pay bills a month (Expenses, loan payments included), to $100; what cash covers it now.
 * No bills yet: no amount (loan payments alone are not the bills; Emergency fund waits for expenses the same way).
 */
export function cushion(plan, months = null, today = null) {
  const m = Math.round(Number(months ?? plan?.assumptions?.emergencyMonths ?? 6)) || 6;
  const has = L(plan, "expenses").length > 0;
  // every must-pay bill on file, dated or not: the cushion goal's amount as saved since the setup began (owner question 1)
  const essentialAll = has ? computeExpenses(plan, {}).essentialMonthly ?? 0 : 0;
  // the must-pay bills going today (Emergency fund's and Liquidity's own: a bill that ended or has not started is left out;
  // review D5); without a day, every one
  const essential = has && today ? computeExpenses(plan, { today }).essentialMonthly ?? 0 : essentialAll;
  let liq = null;
  try { liq = computeLiquidity(plan, { today }); } catch { liq = null; }
  const now = liq?.now ?? 0;
  // `target` (to $100, from every must-pay bill on file) is the cushion goal's amount, as saved since the setup began (and the
  // setup's guess of it); `exact` is Emergency fund's own target, months x the must-pay bills going today, which question 7b
  // says (round 8: $20,600 against $20,580). `all`: the cash before anything is held back; `earmarked`: what goals claim
  // (goals[].fundedBy, Liquidity's F-020); `taxOwed`: this year's tax not paid yet that the cash holds (Liquidity's, at most
  // the cash), `taxDue` all of it (Estimated payments' taxOwedNow), so the sentence can say why `now` is less
  return { months: m, essential, essentialAll, target: Math.round((m * essentialAll) / 100) * 100, exact: m * essential, now, covered: essential > 0 ? now / essential : null,
    all: liq?.nowAll ?? 0, earmarked: liq?.earmarked ?? 0, taxOwed: liq?.taxOwed ?? 0, taxDue: liq?.tax?.owedNow ?? 0, goals: heldFor(plan) };
}
/** The cash accounts (checking, savings, cash): what question 7b offers to link to a goal, those with money in them. */
export const goalFundChoices = (plan) => L(plan, "accounts").filter((a) => TIERS.now.types.includes(a.type) && Number(a.balance) > 0);
const isCash = (plan, id) => L(plan, "accounts").some((a) => a.id === id && TIERS.now.types.includes(a.type));
/** A goal in words, for "set aside for ...": the setup's own by kind ("the home"), any other by its name ('the "Japan trip" goal'). */
const GOAL_WORDS = { home: "the home", education: "education", trip: "the trip", car: "the next car" };
export const goalWords = (g) => { const k = typeof g.id === "string" && g.id.startsWith("setup-goal-") ? g.id.slice(11) : null; return (k && GOAL_WORDS[k]) || (g.name ? `the "${String(g.name)}" goal` : "a goal"); };
/** The goals that hold cash back from the cushion (Liquidity's earmark: not the emergency fund, an amount, a cash account linked). */
const heldGoals = (plan) => L(plan, "goals").filter((g) => !g.isEmergencyFund && Number(g.target) > 0 && (Array.isArray(g.fundedBy) ? g.fundedBy : []).some((id) => isCash(plan, id)));
const heldFor = (plan) => heldGoals(plan).map(goalWords);
// Liquidity's and Emergency fund's test for a goal that may be the cushion itself, not yet ticked as it (F-034)
const EMERGENCY = /emergency|rainy ?day|cushion/i;
/** A held goal that looks like the cushion itself (its name, or 🛟): its name, so the done screen can say where to count it. */
function cushionLike(plan) {
  const g = heldGoals(plan).find((x) => EMERGENCY.test(String(x.name ?? "")) || x.icon === "🛟");
  return g ? String(g.name || "") || null : null;
}
/**
 * Question 7b's own answers still standing: the cash accounts it linked to a setup goal (`guide.setup.goalFunds`) that the
 * goal still draws on. A link made on Goals is not one (review D1: plans that never answered 7b compute as before).
 */
function heldBy7b(plan) {
  const out = new Set();
  for (const [k, ids] of Object.entries(setupOf(plan).goalFunds ?? {})) {
    const g = byId(L(plan, "goals"), `setup-goal-${k}`);
    if (!g || !Array.isArray(g.fundedBy) || !Array.isArray(ids)) continue;
    for (const id of ids) if (g.fundedBy.includes(id) && isCash(plan, id)) out.add(id);
  }
  return out;
}
/**
 * What is left of each account once every goal but the cushion has taken what it still needs: Goals' own sharing (F-013,
 * goals/goals: by priority, then by date, each goal takes target less saved from its accounts in order). Goals with no
 * amount take nothing, as on Liquidity.
 */
function leftAfterGoals(plan) {
  const pool = new Map(L(plan, "accounts").map((a) => [a.id, countedBalance(a)]));
  const order = L(plan, "goals").map((g, i) => ({ g, i })).filter(({ g }) => !g.isEmergencyFund && g.id !== "setup-goal-cushion")
    .sort((a, b) => (Number(a.g.priority) || 2) - (Number(b.g.priority) || 2) || String(a.g.targetDate || "9999").localeCompare(String(b.g.targetDate || "9999")) || a.i - b.i);
  for (const { g } of order) {
    let need = Math.max(0, (Math.max(0, Number(g.target) || 0)) - (Number(g.saved) || 0));
    for (const id of Array.isArray(g.fundedBy) ? g.fundedBy : []) {
      const avail = pool.get(id); if (avail === undefined || need <= 0) continue;
      const take = Math.max(0, Math.min(avail, need)); pool.set(id, avail - take); need -= take;
    }
  }
  return pool;
}
/**
 * What each goal takes from its accounts under Goals' own sharing (F-013, goals/goals: by priority, then by date, each goal
 * takes target less saved from its accounts in order), with the setup's cushion goal drawing on `cushionIds`.
 */
function sharedOut(plan, cushionIds) {
  const pool = new Map(L(plan, "accounts").map((a) => [a.id, countedBalance(a)]));
  const goals = L(plan, "goals").map((g) => (g.id === "setup-goal-cushion" ? { ...g, fundedBy: cushionIds } : g));
  const order = goals.map((g, i) => ({ g, i })).sort((a, b) => (Number(a.g.priority) || 2) - (Number(b.g.priority) || 2) || String(a.g.targetDate || "9999").localeCompare(String(b.g.targetDate || "9999")) || a.i - b.i);
  const taken = new Map();
  for (const { g } of order) {
    const need = Math.max(0, Math.max(0, Number(g.target) || 0) - (Number(g.saved) || 0));
    let t = 0;
    for (const id of Array.isArray(g.fundedBy) ? g.fundedBy : []) {
      const avail = pool.get(id); if (avail === undefined) continue;
      const take = Math.max(0, Math.min(avail, need - t)); pool.set(id, avail - take); t += take;
    }
    taken.set(g.id, t);
  }
  return taken;
}
/**
 * The cushion's accounts: every cash account (checking, savings, cash). An account question 7b linked to a goal is left
 * out while those goals need all of it (review D3: else it stays, after the others, so Goals, Emergency fund and the done
 * screen show one cushion), and also while the cushion would take from it more than those goals leave over: Goals gives the
 * cushion (priority 1) its share first, so a $15,001 savings ticked for a $15,000 car would hand $13,799 of the car's money
 * to the cushion (verify, round 8: the help says "Up to this goal's amount then counts here, not as your safety cushion").
 * Then Emergency fund and the done screen count what the goal leaves over (Liquidity's earmark), and Goals' cushion row
 * counts only the other accounts. No 7b answer: every cash account, as before.
 */
export function cushionFundIds(plan) {
  const cash = L(plan, "accounts").filter((a) => TIERS.now.types.includes(a.type));
  const held = heldBy7b(plan);
  if (!held.size) return cash.map((a) => a.id);
  const left = leftAfterGoals(plan);
  const ids = cash.filter((a) => !held.has(a.id)).map((a) => a.id);
  for (const a of cash.filter((x) => held.has(x.id) && (left.get(x.id) ?? 0) > 0.5)) {
    const was = sharedOut(plan, ids), next = sharedOut(plan, [...ids, a.id]);
    // added only when no other goal gets less for it
    if ([...was].every(([gid, t]) => gid === "setup-goal-cushion" || (next.get(gid) ?? 0) >= t - 0.5)) ids.push(a.id);
  }
  return ids;
}
const and2 = (xs) => (xs.length <= 1 ? xs.join("") : xs.length === 2 ? `${xs[0]} and ${xs[1]}` : "your goals");
/** The kinds of cash account with money in them, in words ("checking and savings"); none known, all three. */
function cashKinds(plan) {
  const has = ["checking", "savings", "cash"].filter((t) => L(plan, "accounts").some((a) => a.type === t && Number(a.balance) !== 0));
  return has.length ? (has.length === 1 ? has[0] : has.length === 2 ? `${has[0]} and ${has[1]}` : "checking, savings and cash") : "checking, savings and cash";
}
/**
 * Question 7b's line on the cash the cushion counts (round 8, items 10 and 29): what is held back said with the reason (set
 * aside for a goal, or this year's tax not paid yet), so "$0 in checking, savings and cash" never follows $8,500 typed.
 * Nothing held back: the line it always was.
 */
export function cushionHave(plan, c) {
  const cur = plan?.meta?.currency ?? "USD";
  const m = (n) => fmtMoney(Math.round(Number(n) || 0), cur);
  const cov = (Math.round((c.covered ?? 0) * 10) / 10).toFixed(1);
  const goalsHeld = c.earmarked > 0.5 ? and2(c.goals?.length ? c.goals : ["your goals"]) : null, tax = c.taxOwed > 0.5;
  if (!goalsHeld && !tax) return `You already have ${m(c.now)} in checking, savings and cash: ${cov} of ${c.months} months.`;
  // the tax not paid yet is more than the cash: its own figure, so it never reads as the bank balance (review UX 3)
  if (!goalsHeld && (c.taxDue ?? 0) > c.all + 0.5) return `You have ${m(c.all)} in ${cashKinds(plan)}. This year's tax not paid yet, about ${m(about(c.taxDue))}, takes all of it, so none counts toward the cushion: ${cov} of ${c.months} months.`;
  const allOf = (x) => Math.abs(x - c.all) < 0.5;
  const parts = goalsHeld && tax ? `${m(c.earmarked)} is set aside for ${goalsHeld} and ${m(c.taxOwed)} is this year's tax not paid yet`
    : goalsHeld ? `${allOf(c.earmarked) ? "all" : m(c.earmarked)} of it is set aside for ${goalsHeld}`
    : `${allOf(c.taxOwed) ? "all" : m(c.taxOwed)} of it is this year's tax not paid yet`;
  return `You have ${m(c.all)} in ${cashKinds(plan)}; ${parts}, so ${c.now > 0.5 ? `${m(c.now)} counts` : "none counts"} toward the cushion: ${cov} of ${c.months} months.`;
}
/** A tax figure said "about": to the $10. */
const about = (n) => Math.round((Number(n) || 0) / 10) * 10;
/**
 * The done screen's cushion figure, when cash is held back (standing's `cushionHeld`): "Your $22,000 is set aside for the
 * home, so your cushion is $3,000." (round 8, items 10 and 29). null when nothing is held back.
 */
export function cushionHeldWords(st, plan) {
  const h = st?.cushionHeld;
  if (!h) return null;
  const cur = plan?.meta?.currency ?? "USD";
  const m = (n) => fmtMoney(Math.round(Number(n) || 0), cur);
  const goalsHeld = h.earmarked > 0.5 ? and2(h.goals.length ? h.goals : ["your goals"]) : null, tax = h.taxOwed > 0.5;
  const rest = h.now > 0.5 ? `so your cushion is ${m(h.now)}.` : "so none of it is cushion yet.";
  if (goalsHeld && tax) return `Your ${m(h.earmarked)} is set aside for ${goalsHeld} and ${m(h.taxOwed)} is this year's tax not paid yet, ${rest}`;
  // the owner's own goal that looks like the cushion: said as money that may be cushion, and asked (review UX 5)
  if (goalsHeld && h.cushionGoal && h.goals.length === 1) return `${m(h.earmarked)} more sits in your "${h.cushionGoal}" goal.`;
  if (goalsHeld) return `Your ${m(h.earmarked)} is set aside for ${goalsHeld}, ${rest}`;
  if ((h.taxDue ?? 0) > h.all + 0.5) return `This year's tax not paid yet (about ${m(about(h.taxDue))}) is more than the ${m(h.all)} you have, so none of it is cushion yet.`;
  return Math.abs(h.taxOwed - h.all) < 0.5 ? `Your ${m(h.all)} is this year's tax not paid yet, ${rest}` : `Your ${m(h.all)} includes ${m(h.taxOwed)} of this year's tax not paid yet, ${rest}`;
}
/**
 * The done screen's question when the cash held back is for a goal that looks like the cushion itself ("Emergency fund",
 * 🛟) but is not ticked as it: Emergency fund's checkbox counts it (F-034). null otherwise.
 */
export function cushionHeldAsk(st) {
  const h = st?.cushionHeld;
  if (!h?.cushionGoal) return null;
  if (h.goals.length === 1) return h.taxOwed > 0.5 ? "Is that goal your safety cushion? Say so on Emergency fund ›" : "Count it as your cushion? Say so on Emergency fund ›";
  return `Is the "${h.cushionGoal}" goal your safety cushion? Say so on Emergency fund ›`;
}
const addYears = (iso, years) => { const [y, m, d] = iso.split("-").map(Number); return `${y + years}-${String(m).padStart(2, "0")}-${String(Math.min(d, 28)).padStart(2, "0")}`; };
/**
 * Q7b. Each saving goal: { [key]: { target, years | date, name } }; the cushion: { months }. The cushion goal has no
 * date (it is kept topped up, not reached once), its target is months x must-pay bills, its money is the savings and
 * cash accounts, and its months are the plan's emergency months, so Emergency fund and this goal agree. A goal's
 * blank amount saves nothing new (a new goal starts at 0 for the Goals page to ask).
 */
export function applyGoalDetails(draft, v, today, cushionFunds = null) {
  ensure(draft);
  // "Is any of your savings already for this?" (round 8, item 10): each answer, cash accounts only; none given, none asked.
  // An answer the same as the cash the goal already draws on (a link made on Goals, shown ticked) changes nothing, so an
  // unchanged Continue saves nothing (review D1); a new answer links it and is kept as 7b's own (guide.setup.goalFunds)
  const asked = (g) => !g.focus && g.key !== "cushion" && picks(draft, "goals").includes(g.key) && !goalTaken(draft, g.key);
  const cashOf = (g) => (Array.isArray(g?.fundedBy) ? g.fundedBy : []).filter((id) => isCash(draft, id));
  const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  const fundsOf = Object.fromEntries(GOALS.filter((g) => asked(g) && Array.isArray(v[g.key]?.funds)).map((g) => [g.key, [...new Set(v[g.key].funds)].filter((id) => isCash(draft, id))])
    .filter(([k, ans]) => !sameSet(ans, cashOf(byId(draft.goals, `setup-goal-${k}`)))));
  // a goal's fundedBy with the cash answer: other accounts it draws on (a 529 linked on Goals) stay, in their places
  const linked = (old, ans) => { const was = Array.isArray(old) ? old : []; return [...was.filter((id) => !isCash(draft, id) || ans.includes(id)), ...ans.filter((id) => !was.includes(id))]; };
  for (const [k, ans] of Object.entries(fundsOf)) {
    const g = byId(draft.goals, `setup-goal-${k}`);
    if (g) { const next = linked(g.fundedBy, ans); if (JSON.stringify(next) !== JSON.stringify(g.fundedBy ?? [])) g.fundedBy = next; }
    const s = draft.guide.setup, rec = { ...(s.goalFunds ?? {}) };
    if (ans.length) rec[k] = ans; else delete rec[k];
    if (Object.keys(rec).length) s.goalFunds = rec; else delete s.goalFunds;
  }
  for (const g of GOALS) {
    if (g.focus || !picks(draft, "goals").includes(g.key) || goalTaken(draft, g.key)) continue;
    const id = `setup-goal-${g.key}`;
    const x = v[g.key] ?? {};
    if (g.key === "cushion") {
      const months = Math.min(12, Math.max(1, Math.round(Number(x.months) || Number(draft.assumptions?.emergencyMonths ?? 6))));
      if (Number(draft.assumptions?.emergencyMonths ?? 6) !== months || draft.assumptions?.emergencyMonths === undefined) draft.assumptions = { ...(draft.assumptions ?? {}), emergencyMonths: months };
      const c = cushion(draft, months, today);
      // its money: what Emergency fund counts as usable today (cash, checking, savings). The list follows the accounts
      // while it is the one this setup wrote (cushionFunds); a choice made on Goals stays. The amount the same way.
      // (not the cash 7b gave to a goal that needs all of it: Goals shares an account by priority, and the cushion comes
      // first, so it would take the house's savings; round 8, item 10. Worked out on the plan with this screen's answers in.)
      const funds = cushionFunds ?? (() => { const d = structuredClone(draft); applyGoalDetails(d, v, today, []); return cushionFundIds(d); })();
      const old = byId(draft.goals, id), s = draft.guide.setup;
      const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
      const asked = {};
      if (!old || same(old.fundedBy, s.cushionFunds)) { asked.fundedBy = funds; if (!same(s.cushionFunds, funds)) s.cushionFunds = funds; }
      // the amount follows the bills while it is the one this setup wrote; null means the person kept or typed their own
      // ("That's about right" or a figure typed on Our guesses for you), so it stays
      const oursTarget = s.cushionTarget === undefined || (s.cushionTarget !== null && Number(old?.target) === Number(s.cushionTarget));
      if (c.essentialAll > 0 && (!old || oursTarget)) { asked.target = c.target; if (s.cushionTarget !== c.target) s.cushionTarget = c.target; }
      if (old) for (const k of Object.keys(asked)) if (same(old[k], asked[k])) delete asked[k];
      put(draft.goals, id, asked, { name: g.name, icon: g.icon, target: 0, targetDate: "", priority: 1, saved: 0, fundedBy: funds, monthly: 0, rate: null, inflates: false, isEmergencyFund: true });
      continue;
    }
    const years = DATE_CHIPS.includes(Number(x.years)) ? Number(x.years) : null;
    const date = /^\d{4}-\d{2}-\d{2}$/.test(x.date ?? "") && !years ? x.date : today ? addYears(today, years ?? g.years) : "";
    const target = pos(x.target);
    const old = byId(draft.goals, id);
    const asked = { ...(target ? { target } : {}), ...(old?.targetDate === date ? {} : { targetDate: date }), ...(g.key === "other" && String(x.name ?? "").trim() ? { name: String(x.name).trim() } : {}) };
    if (old && target === old.target) delete asked.target;
    put(draft.goals, id, asked, { name: g.name, icon: g.icon, target: 0, targetDate: date, priority: 2, saved: 0, fundedBy: fundsOf[g.key] ?? [], monthly: 0, rate: null, inflates: true });
  }
}
/**
 * Question 3's help under "What you get a month" for Social Security already paid (round 8, item 37): the amount before
 * anything comes out of it. From 65 the Medicare Part B premium usually does: the standard one, PART_B ($202.90 a month in
 * 2026, CMS fact sheet "2026 Medicare Parts A & B Premiums and Deductibles", November 14, 2025; read 2026-11-06) is the
 * figure to add back to a deposit. Before 62 it is a disability or survivor benefit, paid in full.
 */
export function ssGettingHelp(age) {
  // before 62: a disability benefit (Medicare, and its Part B premium, after 24 months of it) or a survivor benefit (from
  // 60, reduced; review D10): the letter's figure, before anything comes out, counted as it is (never as an early claim)
  if (age !== null && age !== undefined && age < 62) return "Before 62 that's disability or survivor benefits. Use the figure on your benefit letter, before Medicare or anything else is taken out; we count it as it is.";
  if (age !== null && age !== undefined && age < 65) return "Before anything is taken out: the figure on your yearly benefit letter, not what reaches your bank.";
  return `Before Medicare is taken out: the figure on your yearly benefit letter, not what reaches your bank. Only know the deposit? Add about ${fmtMoney(Math.round(PART_B), "USD")}.`;
}
/**
 * Question 7b's help under a goal's "How much". The home's (round 8, item 39): some loans take 3% down (CFPB, "How to decide
 * how much to spend on your down payment", last modified June 25, 2026: "Some lenders may offer conventional loans with 3
 * percent down payments"; FHA from 3.5%; "Special zero down payment programs exist for veterans, servicemembers, and rural
 * borrowers. Those programs also require mortgage insurance or other fees."), and under 20% down a conventional loan usually
 * needs mortgage insurance (CFPB, "What is private mortgage insurance?"); both read 2026-11-06 (review D9).
 */
export function goalAmountHelp(key) {
  if (key === "home") return "The down payment and closing costs. For example, 60,000. Some loans take 3% down or less (VA and USDA loans can take none); under 20% down usually adds mortgage insurance or a fee to the monthly cost.";
  return `For example, ${key === "trip" ? "4,000" : "10,000"}.`;
}
/**
 * Question 4b's help under "Which kind of IRA?" (item 35). Nothing about a SEP-IRA: the app counts an IRA against the IRA
 * limit and deduction, and a SEP has its own (review D4; a SEP kind is Batch 1 / Limits work). `ownBiz` kept for that.
 */
export function iraKindHelp(ownBiz = false) { return "Roth: taxed going in, tax-free coming out. Not sure? We count it as Traditional for now."; }
/**
 * Question 7b's help under "Is any of your savings already for this?" (item 10; review D8 and UX 2): a linked account counts
 * toward the goal up to what the goal still needs (Goals' F-013 sharing, Liquidity's F-020 earmark min(funded - saved,
 * targetThen)); the rest stays cushion.
 */
export const GOAL_FUNDS_HELP = "Tap an account if money in it is for this. Up to this goal's amount then counts here, not as your safety cushion.";
/** The plan's guesses looked at (the card at the end): Assumptions counts as reviewed. */
export function applyGuesses(draft, today) { ensure(draft); draft.assumptions = { ...(draft.assumptions ?? {}), reviewedAt: today }; }

// ---- reading answers back (going back shows what was said)
export function valuesFor(plan, screen, { today = null } = {}) {
  const ad = adults(plan), s = setupOf(plan);
  const acct = (id) => byId(L(plan, "accounts"), id), inc = (id) => byId(L(plan, "income"), id);
  if (screen === "you") {
    const self = byId(people(plan), "setup-self"), partner = byId(people(plan), "setup-partner");
    return { name: self && self.name !== "Me" ? self.name : "", who: s.who ?? (partner ? partner.relation ?? "partner" : "me"), partnerName: partner && !/^My (spouse|partner)$/.test(partner.name) ? partner.name : "", kids: dependents(plan).filter((k) => k.id.startsWith("setup-kid-")).length, state: plan?.household?.state ?? "", own: ownPeople(plan).map((p) => p.name) };
  }
  if (screen === "money") {
    // each answer read from the line in force today (lineNow): after a raise from a later date saved on Income, the new
    // amount, and still once the half that ended was removed there (review 2026-11-02, round 5)
    const now = (id) => lineNow(L(plan, "income"), id, today);
    const o = now("setup-other");
    return {
      people: Object.fromEntries(ad.map((p) => {
        const pay = payLineNow(L(plan, "income"), p.id, today), pension = now(`setup-pension-${p.id}`);
        const status = s.status?.[p.id] ?? (pay || existingPay(plan, p.id).length ? "work" : pension ? "retired" : null);
        // "Retirement plan at work?": the answer given here (`plan`); Contributions' "No plan or no match" is not it (review D7)
        return [p.id, { status, by: pay?.type === "business" ? "self" : "employer", amount: pay?.amount ?? "", period: pay?.period ?? "annual", pension: pension?.amount ?? "", plan: workPlanAnswer(plan, p.id) }];
      })),
      other: { kind: OTHER_KINDS.some((k) => k.value === o?.type) ? o.type : "", amount: o?.amount ?? "" },
      // the estimated tax paid so far, once it was typed (here or on Estimated payments); blank until then
      taxPaid: plan?.taxes?.estimated?.typedAt ? (plan.taxes.estimated.paid ?? []).reduce((t, x) => t + (Number(x) || 0), 0) : "",
    };
  }
  if (screen === "ages") {
    const ss = plan?.retirement?.socialSecurity ?? {};
    const planAge = Number(plan?.assumptions?.retirementAge ?? 65);
    return {
      people: Object.fromEntries(ad.map((p) => {
        const [y, m] = (p.birthDate || "").split("-");
        const working = s.status?.[p.id] === "work" || existingPay(plan, p.id).length > 0 || !!payLineNow(L(plan, "income"), p.id, today);
        const typed = Number(ss[p.id]?.monthlyAtFRA) > 0 || (ss[p.id]?.record ?? []).length > 0;
        // a figure typed later wins over an earlier "none" (the retirement pages' notice can set it), so going through this screen never erases it
        const mode = typed && s.ss?.[p.id] === "none" ? "statement" : s.ss?.[p.id] ?? (typed ? "statement" : s.status?.[p.id] === "retired" ? "getting" : working ? "estimate" : "unsure");
        const getting = lineNow(L(plan, "income"), `setup-ss-${p.id}`, today);
        const now = p.birthDate && today ? ageOn(p.birthDate, today) : null;
        return [p.id, { month: m ? Number(m) : "", year: y ?? "", stopAge: p.retirementAge ?? Math.max(planAge, now !== null ? now + 1 : 0), retired: s.status?.[p.id] === "retired", ss: { mode, amount: getting?.amount ?? (mode === "statement" ? ss[p.id]?.monthlyAtFRA ?? "" : ""), started: Number(ss[p.id]?.claimAge) || (now !== null ? Math.min(70, Math.max(62, now)) : 67), startedKnown: Number(ss[p.id]?.claimAge) > 0, record: (ss[p.id]?.record ?? []).length > 0 } }];
      })),
      kids: Object.fromEntries(dependents(plan).map((k) => [k.id, k.birthDate ? Number(k.birthDate.slice(0, 4)) : ""])),
    };
  }
  if (screen === "have") return haveKeys(plan);
  if (screen === "have-amounts") {
    const o = { bought: boughtYearOn(plan) };
    // a balance that is one of our guesses reopens empty: the screen shows it grey (spec P2), never as typed text
    // (no account in the retirement box's place: Q2's plan at work, when something typed is in it; $0 and our guess show blank)
    for (const h of HAVE) for (const pid of h.perAdult ? ad.map((p) => p.id) : [""]) { const a = acct(haveId(h.key, pid)), q = h.perAdult && !a ? workPlanAcct(plan, pid) : null; o[h.perAdult ? `${h.key}-${pid}` : h.key] = a && !isGuess(plan, `accounts[${a.id}].balance`) ? a.balance : q && Number(q.balance) > 0 && !isGuess(plan, `accounts[${q.id}].balance`) ? q.balance : ""; }
    for (const p of ad) {
      const c = byId(plan?.retirement?.contributions ?? [], `setup-contrib-${p.id}`), a = acct(haveId("retire", p.id));
      // someone paid by their own business has no employer plan: "On my own" first (review 2026-11-02)
      const ownBusiness = payLineNow(L(plan, "income"), p.id, today)?.type === "business";
      o[`kind-${p.id}`] = a?.type === "ira" ? "own" : a?.type === "roth" ? (Number(c?.employerMatch) > 0 ? "work" : "own") : a || workPlanAcct(plan, p.id) ? "work" : ownBusiness ? "own" : s.status?.[p.id] === "work" || !s.status?.[p.id] ? "work" : "own";
      // what goes in and what the employer adds reopen empty when they are our guesses (they show grey), "0" when the chips None /
      // No match said so; the share of pay a chip said stays a chip while the dollars still match it (spec P2)
      const cp = `retirement.contributions[setup-contrib-${p.id}]`, sv = savingOf(plan, p.id), putGuess = !!c && isGuess(plan, `${cp}.amount`), matchGuess = !!c && isGuess(plan, `${cp}.employerMatch`);
      o[`contrib-${p.id}`] = putGuess ? "" : c?.amount ? Math.round(perYear(Number(c.amount) || 0, c.period) / 12) : c && sv.pct === 0 && Number(c.amount) === 0 ? "0" : "";
      const saidNone = plan?.retirement?.workPlans?.[p.id]?.match === false;
      o[`match-${p.id}`] = matchGuess ? "" : c?.employerMatch ? Math.round(c.employerMatch / 12) : (c && sv.match === "none" && Number(c.employerMatch) === 0) || (saidNone && !(Number(c?.employerMatch) > 0)) ? "0" : "";
      const pay = employerPay(plan, p.id, today);
      o[`pct-${p.id}`] = typeof sv.pct === "number" && !putGuess && c && (sv.pct === 0 ? Number(c.amount) === 0 : pay > 0 && Math.round(Number(c.amount)) === pctToMonthly(sv.pct, pay)) ? sv.pct : null;
      o[`matchMode-${p.id}`] = !matchGuess && ((c && sv.match === "none" && Number(c.employerMatch) === 0) || (saidNone && !(Number(c?.employerMatch) > 0))) ? "none" : !matchGuess && Number(c?.employerMatch) > 0 ? "know" : null;
      // which kind of IRA: the account's own type when it is a Roth, else the answer given here (never a guess shown as one)
      const said = s.iraKind?.[p.id];
      o[`iraKind-${p.id}`] = a?.type === "roth" ? "roth" : a?.type === "ira" && (said === "unsure" || said === "traditional") ? said : null;
    }
    // "both of ours" while the split guesses stand (the total typed is in taps["retire-joint"])
    const joint = s.taps?.["retire-joint"];
    if (joint && ad.some((p) => plan?.guesses?.[`accounts[${acct(haveId("retire", p.id))?.id ?? workPlanId(p.id)}].balance`]?.k === "account.retire.split")) { o.joint = "both"; o[`retire-${joint.pid}`] = joint.total; }
    return o;
  }
  if (screen === "owe") return picks(plan, "owe");
  if (screen === "owe-amounts") {
    const o = {};
    // a figure that is one of our guesses is not shown as typed: its box stays empty and the screen shows it grey
    const g = (path) => isGuess(plan, path);
    for (const d of OWE) {
      const a = acct(oweId(d.key)), did = `setup-debt-${d.key}`, r = byId(L(plan, "debts"), did);
      o[d.key] = { owed: a && !g(`accounts[${a.id}].balance`) ? a.balance : "", payment: r && !paymentIsGuess(r) && !g(`debts[${did}].minPayment`) && (Number(r.minPayment) > 0 || r.minPayment === 0) ? Math.round(r.minPayment) : "", rate: r && !rateIsGuess(r) && !g(`debts[${did}].rate`) ? Math.round(r.rate * 100000) / 1000 : "", paidInFull: d.key === "credit" ? !!s.paidInFull : false };
      if (OWE_TAPS[d.key]) o[d.key].start = s.taps?.[OWE_TAPS[d.key]] ?? null;
    }
    const home = acct(haveId("home"));
    o.mortgage.home = home && !g(`accounts[${home.id}].balance`) ? home.balance : "";
    o.mortgage.bought = boughtYearOn(plan);
    return o;
  }
  if (screen === "spend") {
    const rt = Number(plan?.retirement?.spendingMonthly);
    // a row that is one of our guesses reopens empty (the screen shows it grey); a row typed as 0 reopens as 0
    const rowOf = (key) => { const x = byId(L(plan, "expenses"), `setup-x-${key}`); return x ? (isGuess(plan, `expenses[${x.id}].amount`) ? "" : x.amount) : zeroRows(plan).includes(key) ? 0 : ""; };
    const ours = !!plan?.guesses?.["retirement.spendingMonthly"] && isGuess(plan, "retirement.spendingMonthly");
    // the figure given in the top box, while the bills still add up to it and the groups typed beside it are still there; an edit made
    // on Expenses since (a bill changed or removed) and the screen does not pretend: it opens as for typed rows
    const ss = s.spendSum, mine = L(plan, "expenses").filter((x) => typeof x.id === "string" && x.id.startsWith("setup-x-"));
    const held = ss && ss.sum > 0 && Array.isArray(ss.typed) && ss.typed.every((k) => byId(mine, `setup-x-${k}`)) && Math.round(mine.reduce((t, x) => t + perYear(x.amount, x.period) / 12, 0)) === ss.sum && mine.every((x) => x.period === "monthly");
    const rowOr = (key) => (held && !ss.typed.includes(key) && byId(mine, `setup-x-${key}`) ? "" : rowOf(key));
    // spending worked out from a left-over (applyLeftOver): the screen reopens on that answer, with the figure the person typed
    const note = leftMarker(plan);
    return { mode: s.spendMode ?? "rows", ...(note ? { leftOver: note.left, leftOn: note.on } : {}), ...(held ? { sum: ss.sum } : {}), rows: Object.fromEntries(SPEND.map((x) => [x.key, rowOr(x.key)])), total: byId(L(plan, "expenses"), "setup-x-total")?.amount ?? "", retireMonthly: rt > 0 && !ours ? rt : "", retireTyped: rt > 0 && !s.retireAuto, taps: Object.fromEntries(SPEND_TAPS.map((k) => [k, s.taps?.[k] ?? null])) };
  }
  if (screen === "goals") return picks(plan, "goals");
  if (screen === "goal-details") return Object.fromEntries(GOALS.filter((g) => !g.focus).map((g) => {
    const x = byId(L(plan, "goals"), `setup-goal-${g.key}`);
    // the cash accounts linked to it (question 7b's chips); none linked, nothing chosen
    const cash = g.key === "cushion" || !Array.isArray(x?.fundedBy) ? [] : x.fundedBy.filter((id) => isCash(plan, id));
    return [g.key, { target: x?.target || "", date: x?.targetDate ?? "", years: x ? null : g.years ?? null, name: g.key === "other" && x ? x.name : "", months: Number(plan?.assumptions?.emergencyMonths ?? 6), ...(g.key === "cushion" ? {} : { funds: cash.length ? cash : null }) }];
  }));
  return {};
}

/** One line back after a screen, as figures: the view words it ("Got it: about $7,400 a month before tax"). */
export function reflect(plan, screen, { today = null } = {}) {
  // with today, only the pay coming in today: both halves of a raise from a later date used to be added up (round 5).
  // Nothing coming in today, though the question was answered: what comes in from the first day pay starts (`from`), or,
  // when every line has ended, `ended` (review 2026-11-02, round 5: the list said "Not answered yet")
  if (screen === "money") {
    if (!L(plan, "income").length) return null;
    const m = computeIncome(plan, today ? { today } : {}).monthly;
    if (m > 0 || !today) return m > 0 ? { kind: "money", monthly: m } : null;
    const lines = L(plan, "income").filter((x) => x.period !== "once" && Number(x.amount) > 0);
    const from = lines.map(startOf).filter((d) => d > today).sort()[0] ?? null;
    const then = from ? computeIncome(plan, { today: from }).monthly : 0;
    if (then > 0) return { kind: "money", monthly: then, from };
    return lines.some((x) => x.endDate && String(x.endDate) < today) ? { kind: "money", monthly: 0, ended: true } : null;
  }
  if (screen === "have-amounts") {
    const mine = L(plan, "accounts").filter((a) => (isHave(a.id) || String(a.id).startsWith("setup-workplan-")) && a.type !== "property" && a.type !== "vehicle");
    const t = mine.reduce((s, a) => s + (Number(a.balance) || 0), 0);
    // how many of those balances are our guesses (spec 10: "Got it: about $X ... 3 of the 4 are our guesses")
    const guessed = mine.filter((a) => Number(a.balance) > 0 && isGuess(plan, `accounts[${a.id}].balance`)).length, of = mine.filter((a) => Number(a.balance) > 0).length;
    return t > 0 ? { kind: "have", total: t, ...(guessed ? { guessed, of } : {}) } : null;
  }
  if (screen === "owe" && picks(plan, "owe").includes("none")) return { kind: "debt-free" };
  if (screen === "owe-amounts") {
    const owe = L(plan, "accounts").filter((a) => isOwe(a.id)), t = owe.reduce((s, a) => s + Math.abs(Number(a.balance) || 0), 0);
    // how many of those balances are our guesses (said with the total: "2 of these are our guesses for now")
    const guessed = owe.filter((a) => isGuess(plan, `accounts[${a.id}].balance`)).length;
    return t > 0 ? { kind: "owe", total: t, ...(guessed ? { guessed, of: owe.length } : {}) } : setupOf(plan).paidInFull ? { kind: "paid-in-full" } : null;
  }
  if (screen === "spend") {
    const e = L(plan, "expenses").length || L(plan, "debts").length ? computeExpenses(plan, {}) : null;
    if (!e || !(e.monthly > 0)) return null;
    // with our guesses among the rows: the screen's rows (typed and ours) and how many are ours ("7 of these are our guesses")
    const r = spendRowsNow(plan);
    return { kind: "spend", monthly: e.monthly, essential: e.essentialMonthly, ...(r.guessed ? { guessed: r.guessed, count: r.count, rows: r.monthly } : {}) };
  }
  return null;
}

export const FOCUS_GUIDE = { debt: { title: "Make a plan to pay off what you owe", href: "#/overview/guide/debt" }, retire: { title: "Check your retirement step by step", href: "#/overview/guide/retire" }, home: { title: "Work out the home you can afford", href: "#/overview/guide/home" } };
/** Is retirement checkable: every adult has a birth date and Social Security (estimated, typed, a record) or said they get
 * none. One rule for every page: it lives in retirement/projection (`retirementKnown`), re-exported here. */
export { retirementKnown };
// Social Security already paid and typed on the Income page counts too (retirement/projection `ssOnIncome`)
const ssKnown = (ss, said, pid, plan = null) => Number(ss[pid]?.monthlyAtFRA) > 0 || (ss[pid]?.record ?? []).length > 0 || said[pid] === "none" || (!!plan && ssOnIncome(plan, pid, null));
/** The adults with no Social Security figure in the plan who have not said they get none (the retirement pages' notice). */
export function ssMissingFor(plan) {
  const ss = plan?.retirement?.socialSecurity ?? {}, said = setupOf(plan).ss ?? {};
  return adults(plan).filter((p) => !ssKnown(ss, said, p.id, plan));
}
/** What the retirement check still needs, in plain words: only what is missing (README "Where you stand"). */
export function retirementMissing(plan) {
  const ss = plan?.retirement?.socialSecurity ?? {}, said = setupOf(plan).ss ?? {};
  const ad = adults(plan);
  const dates = ad.some((p) => !p.birthDate), soc = ad.some((p) => !ssKnown(ss, said, p.id, plan));
  return dates && soc ? "Social Security and birth dates" : dates ? (ad.length > 1 ? "birth dates" : "your birth date") : soc ? "Social Security" : null;
}
/**
 * retirementGap(plan) -> null | { ss: [names], dates: [names], what, fix, go }: what "whether the money lasts" still needs,
 * named, for the pages that hold their verdict until it is in (Plan health score, Timeline). Only a missing birth date
 * sends the person to People; a missing Social Security figure sends them to the Social Security page, which has the
 * "won't get it" answer too (review 2026-11-02: a missing birth date was reported as "Add Social Security").
 */
export function retirementGap(plan) {
  const ss = plan?.retirement?.socialSecurity ?? {}, said = setupOf(plan).ss ?? {};
  const ad = adults(plan), one = ad.length === 1;
  const nm = (p) => p.name || (p.role === "self" ? "you" : "your spouse");
  const both = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
  const soc = ad.filter((p) => !ssKnown(ss, said, p.id, plan)).map(nm), dates = ad.filter((p) => !p.birthDate).map(nm);
  if (!soc.length && !dates.length) return null;
  const ssWords = soc.length ? (one ? "your Social Security" : `Social Security for ${both(soc)}`) : null;
  const dateWords = dates.length ? (one ? "your birth date" : dates.length === 1 ? `${dates[0]}'s birth date` : `the birth dates of ${both(dates)}`) : null;
  const what = [ssWords, dateWords].filter(Boolean).join(" and ");
  const ssFix = ssWords ? `Add ${ssWords} on the Social Security page (an estimate from ssa.gov/myaccount is enough), or say there that ${one ? "you" : soc.length === 1 ? soc[0] : "you"} will not get it.` : null;
  const dateFix = dateWords ? `Add ${dateWords} on People.` : null;
  return { ss: soc, dates, what, fix: [ssFix, dateFix].filter(Boolean).join(" "), go: soc.length ? ["retirement", "social-security"] : ["household", "people"] };
}
/** Money saved: what is in accounts that are not a home, a car or a debt (for the retiree's "drawn from savings" line). */
const savedTotal = (plan) => L(plan, "accounts").filter((a) => { const t = ACCOUNT_TYPES[a.type]; return t && t.side === "asset" && (t.liquid || t.invested); }).reduce((s, a) => s + Math.max(0, Number(a.balance) || 0), 0);
/**
 * The first moves in plain words (README "The first three moves"): Next best action's steps say "IRA", "backdoor",
 * "earns the rate for sure", fine on that page, too much as someone's first advice. A typical rate the setup guessed
 * is said to be one.
 */
export function revealWords(step, plan, { today = null, retired = false } = {}) {
  const cur = plan?.meta?.currency ?? "USD";
  const money = (n) => fmtMoney(Math.round((Number(n) || 0) / 10) * 10, cur);
  const pct = (r) => `${Math.round(r * 1000) / 10}%`;
  const several = adults(plan).length > 1;
  const costly = (lo, hi) => {
    let rows = [];
    try { rows = computeLiabilities(plan, { today }).rows; } catch { rows = []; }
    return rows.filter((r) => r.owed > 0 && r.rate !== null && r.rate >= lo && r.rate < hi && r.type !== "mortgage").sort((a, b) => b.rate - a.rate)
      .map((r) => ({ name: r.name, rate: r.rate, guess: rateIsGuess(r.detail), card: r.type === "credit", ours: typeof r.detail?.id === "string" && !!plan?.guesses?.[`debts[${r.detail.id}].rate`] }));
  };
  // where to type the real rate: a rate in the guesses' ledger is listed on Our guesses for you; an older one on Debts
  const where = (list) => (list.some((d) => d.ours) ? "Our guesses for you" : "What you owe");
  const said = (list) => {
    const words = list.map((d) => `${d.name} about ${pct(d.rate)} a year`).join(", ");
    return `${words}${list.some((d) => d.guess) ? ` (a typical rate: type yours on ${where(list)})` : ""}`;
  };
  switch (step.id) {
    // the spending is mostly our guesses: typing it is the move (Next best action's waiting step, spec 8.1)
    case "bills": if (step.waits) return { title: "Type what you really spend", detail: step.detail };
      return retired
      ? { title: "See how long your savings last", detail: `About ${money(-(step.spare ?? 0))} a month comes from savings. The retirement check shows how many years that covers.` }
      : { title: "Spend less than comes in", detail: step.detail };
    case "starter": return { title: "Keep one month of bills in cash", detail: step.detail };
    case "protect": {
      const ppl = step.people ?? [];
      // the setup's "Me" reads "yourself" / "your" (Life insurance needs' sayName)
      const names = ppl.map((x) => (x.who === "you" ? "yourself" : x.who ?? x.name)).join(" and ");
      const raise = ppl.length && ppl.every((x) => x.cover > 0);
      return { title: raise ? (ppl.length === 1 && ppl[0].who === "you" ? "Raise your life cover" : `Raise the life cover on ${names}`) : `Get life insurance on ${names || "the earners"}`, detail: step.detail };
    }
    case "match": {
      // a 401(k) with nothing going in: a question first (it may be from a job left, or the job may not match)
      const who = (step.ask ?? []).map((a) => (a.name === "Me" || !a.name ? "your" : `${a.name}'s`));
      if (step.status === "check" && who.length) return { title: `Check if ${who.length === 1 ? `${who[0]} job matches` : "your jobs match"} retirement saving`, detail: "Money an employer adds when you save for retirement. If there is a match, put in at least enough to get every dollar of it." };
      return { title: "Get all of your employer's match", detail: "Money your employer adds when you save for retirement. Put in at least enough to get every dollar of it." };
    }
    case "high-debt": {
      const list = costly(HIGH_RATE, Infinity), cards = list.length && list.every((d) => d.card);
      // savings above the full cushion pay it today (Next best action's fromSavings): the move says so
      if (step.fromSavings > 0) return { title: cards ? "Pay off the cards from your savings" : "Pay off costly debt from your savings", detail: `${step.detail}${list.some((d) => d.guess) ? ` The rate is a typical one: type yours on ${where(list)}.` : ""}` };
      return { title: cards ? "Pay down the cards first" : "Pay off costly debt first", detail: list.length ? `${said(list)}. Each extra dollar paid saves that much interest.` : step.detail };
    }
    case "full-fund": { const m = /\((\d+) months?\)/.exec(step.title)?.[1]; return { title: m ? `Build your cushion to ${m} months` : "Build your cushion", detail: step.detail }; }
    case "hsa": return { title: "Fill your health savings account", detail: step.detail };
    // "each of you" only when Next best action gives room to more than one earner (review 2026-11-02: a one-earner couple
    // read "An IRA of your own" there and "for each of you ... between you" here)
    case "ira": { const each = (step.people ?? (several ? 2 : 1)) > 1; return { title: each ? "A retirement account of your own for each of you (an IRA)" : "A retirement account of your own (an IRA)", detail: `${step.optional ? "Optional: your plan already lasts. " : ""}${step.roomYearly > 0 ? `Up to ${money(step.roomYearly)} this year${each ? " between you" : ""}. It cuts this year's tax, or with a Roth IRA grows tax-free.` : step.detail}` }; }
    case "mid-debt": { const list = costly(MODERATE_RATE, HIGH_RATE); return { title: "Pay down the loans that cost the most", detail: list.length ? `${said(list)}. Paying them early saves that interest.` : step.detail }; }
    case "max-401k": return { title: "Put more into your 401(k)", detail: `${step.optional ? "Optional: your plan already lasts. " : ""}${step.roomYearly > 0 ? `${money(step.roomYearly)} more is allowed this year, and it grows sheltered from tax.` : step.detail}` };
    case "goals": return { title: "Catch up on your goals", detail: step.detail };
    default: return { title: step.title, detail: step.detail ?? step.why ?? null };
  }
}
/** A guessed mortgage's years left and the year it began, for "Your plan" (how long the loan has run: overview/guesses README "When the home was bought"). */
function mortgageYears(plan, d, today) {
  const a = byId(L(plan, "accounts"), d.accountId);
  if (!today || a?.type !== "mortgage") return {};
  // only while the balance or the payment is our guess (they were worked from when the loan began); a mortgage whose balance
  // and payment are both typed reads as typed, whatever else is guessed (verify 2026-11-07: "about 28 years left" beside a
  // Debts row paid off in 2039). A payment our older Get started guessed (the paymentGuessed flag alone) is a level 30-year
  // payment from the day it was saved, not worked from the year bought: Your plan says what it said before (verify 2026-11-07)
  const payGuess = typeof d.id === "string" ? guessAt(plan, `debts[${d.id}].minPayment`) : null;
  const worked = isGuess(plan, `accounts[${a.id}].balance`) || (payGuess !== null && !payGuess.legacy);
  if (!worked) return {};
  try {
    const s = loanStartOf(plan, recordOf(plan, "mortgage", `accounts[${a.id}].balance`), { today, prof: profileOf(plan, today) });
    if (!s) return {};
    // the years Debts shows (the payment less the tax and insurance in it, against the balance at the rate): one answer, also
    // when a large typed payment pays a balance capped at the home's value off sooner than the loan's own term
    const owed = Math.abs(Number(a.balance) || 0), pay = (Number(d.minPayment) || 0) + (Number(d.extra) || 0);
    const toLoan = pay - loanEscrow(plan, a, d, today);
    const n = owed > 0 && toLoan > 0 ? nper((Number(d.rate) || 0) / 12, toLoan, owed) : NaN;
    if (!Number.isFinite(n)) return {};
    return { yearsLeft: Math.max(1, Math.round(Math.ceil(n - 1e-9) / 12)), bought: s.year, boughtVia: s.stale ? "stale" : s.via };
  } catch { return {}; }
}

/**
 * Where you stand, from the pages' own computes: what you own minus what you owe (Net worth; null while the plan has
 * neither), what is left each month after federal tax, spending and saving (Next best action's `spare`), how many
 * months of must-pay bills the cash covers (Emergency fund's `runwayMonths`), and whether retirement is on track (Will
 * the money last?, only once Social Security is known, so a missing figure never reads as "short"). Then the first
 * three moves: Next best action's most urgent step, a guide for what you said matters most, then its next steps, in
 * its own order ("your choice" left out). Someone retired who spends more than comes in is living on savings, as
 * planned: that is said calmly, with the retirement check first.
 */
export function standing(plan, { today }) {
  const nw = computeNetWorth(plan, { today });
  let nba = null, liq = null, proj = null;
  try { nba = computeNext(plan, { today }); } catch { nba = null; }
  try { liq = computeLiquidity(plan, { today }); } catch { liq = null; }
  const known = retirementKnown(plan, today);
  if (known) { try { proj = computeProjection(plan, { today }); } catch { proj = null; } }
  const spare = nba?.ready ? nba.spare.monthly : null;
  const runway = liq && liq.expenses && liq.expenses.essentialMonthly > 0 ? liq.runwayMonths : null;
  const runwayStatus = runway !== null ? liq?.status ?? "unknown" : "unknown";
  const retire = proj?.ready ? { verdict: proj.verdict, shortAge: proj.shortAge ?? null } : null;
  const retired = allRetired(plan);
  // the spending is mostly our guesses (spec 8.1): the left-over figure, the cushion and the retirement verdict wait for it
  const spareWaits = !!(nba?.ready && nba.spare.waits);
  const runwayWaits = runway !== null && liq?.waits === true;
  // (with no pay on file the left-over figure is not worked out at all, so the share of the month that is ours decides it
  // for the retirement verdict and the headline: C3 review D4)
  let spendShare = 0;
  if (!spareWaits && plan?.guesses) { try { spendShare = computeExpenses(plan, { today }).guessedShare ?? 0; } catch { spendShare = 0; } }
  const spendOurs = spareWaits || spendShare >= 0.5;
  const retireSpendGuessed = !!retire && spendOurs && (isGuess(plan, "retirement.spendingMonthly") || !(Number(plan?.retirement?.spendingMonthly) > 0));
  // the retirement balances are mostly our guesses (spec 8.1): the verdict word waits for them. The share of the money in retirement accounts
  // (401(k), IRA, Roth) whose balance is a guess is half or more
  const retireAccts = L(plan, "accounts").filter((a) => ["401k", "ira", "roth"].includes(a.type) && Number(a.balance) > 0);
  const retireTotal = retireAccts.reduce((t, a) => t + Number(a.balance), 0);
  const retireBalanceGuessed = !!retire && retireTotal > 0 && retireAccts.filter((a) => isGuess(plan, `accounts[${a.id}].balance`)).reduce((t, a) => t + Number(a.balance), 0) / retireTotal >= 0.5;
  const retireGuessed = retireSpendGuessed || retireBalanceGuessed;
  const spendNow = spendRowsNow(plan);
  const drawing = retired && spare !== null && spare < 0 && !spareWaits;
  // short only on the careful month (Side income's "count on" holds part of uneven pay back): what a month that brings the
  // Income page's amount leaves, so the sentence and the left-over line say a lean month, not a plain overspend (review
  // 2026-11-02, round 5: the done screen said "More goes out than comes in" above a move card saying good months make up)
  // kind: Next best action's spare.fullKind ("ahead", "even" within $5 of $0, "short"), so no line says "about $0" (round 5)
  const lean = !drawing && spare !== null && spare < 0 && (Number(nba?.spare?.held) || 0) > 0.5 ? { full: nba.spare.full, about: nba.spare.fullAbout, kind: nba.spare.fullKind } : null;
  // a debt step the saved debt plan already pays off is under way, not a move to make
  const steps = (nba?.ready ? nba.steps : []).filter((s) => s.status !== "done" && s.status !== "skip" && s.status !== "underway" && s.id !== "rest");
  const debtExtra = nba?.ready ? nba.spare.debtExtra ?? 0 : 0;
  const debtNames = nba?.debtPlan?.names ?? [];
  const open = steps.map((s) => ({ id: s.id, ...revealWords({ ...s, spare }, plan, { today, retired: drawing }), href: s.id === "bills" && s.waits ? "#/overview/setup/spend?back=done" : `#/${s.go.join("/")}` }));
  const focus = [...(drawing ? ["retire"] : []), ...(setupOf(plan).focus ?? []), ...(picks(plan, "goals").includes("home") ? ["home"] : [])];
  const debtStep = open.slice(0, 1).some((m) => m.id === "high-debt" || m.id === "mid-debt");   // the debt guide would repeat it
  const guides = focus.filter((f, i) => FOCUS_GUIDE[f] && focus.indexOf(f) === i && !(f === "debt" && debtStep)).map((f) => ({ id: `guide-${f}`, title: FOCUS_GUIDE[f].title, detail: null, href: FOCUS_GUIDE[f].href }));
  // the bank files show more going out than Expenses lists (bankVsPlan): every figure here is worked out from Expenses, so
  // putting the rest on Expenses comes first (round 4, 2026-11-02)
  // ...unless the gap is mostly payments to a card whose file isn't in: then its file comes first (re-check 4, 2026-11-02); two
  // cards at one bank with no file for either: "Bring in the card files" the same way (re-check 5, 2026-11-05)
  let bank = null, bankCard = null;
  try { const b = bankVsPlan(plan, { today }); bank = b?.over ? b : null; bankCard = !bank && b?.cardsGap ? b.cardFile : null; } catch { bank = null; bankCard = null; }
  const bankMove = bank ? [{ id: "bank", title: "Add what your bank shows to Expenses", detail: `Your bank files show about ${fmtMoney(Math.round(bank.gap / 10) * 10, plan?.meta?.currency ?? "USD")} a month more going out than Expenses lists.`, href: "#/cashflow/expenses" }]
    : bankCard ? [{ id: "bank-card", title: bankCard.title, detail: `About ${fmtMoney(Math.round(bankCard.monthly / 10) * 10, plan?.meta?.currency ?? "USD")} a month went to ${bankCard.the}, but ${bankCard.plural ? "their own files aren't in, so what they bought" : "its own file isn't in, so what it bought"} can't be checked against your plan yet.`, href: bankCard.href }] : [];
  const moves = [...bankMove, ...(drawing ? [...guides.slice(0, 1), ...open.slice(0, 1), ...guides.slice(1), ...open.slice(1)] : [...open.slice(0, 1), ...guides, ...open.slice(1)])].slice(0, 3);
  // what was left out, so the person knows what a figure is missing
  const later = [];
  const missing = retirementMissing(plan);
  const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  if (!L(plan, "income").length) later.push({ label: "What comes in", href: "#/cashflow/income", key: "income" });
  if (!L(plan, "expenses").length && !L(plan, "transactions").length) later.push({ label: "What you spend", href: "#/cashflow/expenses", key: "spend" });
  if (!L(plan, "accounts").length) later.push({ label: "Your accounts", href: "#/balance/net-worth", key: "accounts" });
  if (missing && adults(plan).length) later.push({ label: `${cap(missing)}, for the retirement check`, href: missing === "Social Security" ? "#/retirement/social-security" : "#/household/people", key: "retire" });
  // the state's income tax comes off the left-over figure once it can be worked out (a flat-rate state, or a rate typed on
  // the State page); until then, say so: a missing state is asked for, a graduated state's rate is asked for
  const st0 = plan?.household?.state;
  if (L(plan, "income").length && !NO_WAGE_TAX[st0] && !(nba?.ready && nba.spare.stateKnown)) later.push({ label: st0 ? `${STATE_NAMES[st0] ?? "Your state"}'s income tax: type its rate on the State page, and the left-over figure takes it off` : "Your state: pick it on the State page, so its income tax comes off the left-over figure", href: "#/taxes/state", key: "state" });
  // childcare is never guessed without its tap (spec E06): with our spending guesses in, a child under 13 and the tap not
  // answered Yes or No (skipped, or Not sure), say it is not counted, and where to tell us (C3 UX review 4)
  const careAsk = setupOf(plan).taps?.childcare ?? null;
  const young = dependents(plan).some((k) => !k.birthDate || !today || ageOn(k.birthDate, today) < 13);
  const childcareMissing = spendNow.guessed > 0 && young && careAsk !== "no" && careAsk !== "yes" && !zeroRows(plan).includes("childcare")
    && !L(plan, "expenses").some((x) => x.category === "childcare" && (!today || activeOn(x, today)));
  if (childcareMissing) later.push({ label: "Childcare: do you pay for it, or for after-school care? Tell us and it's counted", href: "#/overview/setup/spend?back=done", key: "childcare" });
  const couple = adults(plan).length >= 2 && (plan?.household?.filingStatus ?? "single") === "single" && adults(plan).some((p) => p.relation === "partner");
  if (couple && L(plan, "income").length) later.push({ label: "Federal tax as two returns: the left-over figure works out one return for both of you, so it reads a little low", href: "#/taxes/federal", key: "couple" });
  const wrote = setupOf(plan).ssWrote ?? {}, ssAll = plan?.retirement?.socialSecurity ?? {};
  const estimated = adults(plan).filter((p) => wrote[p.id] !== undefined && Number(ssAll[p.id]?.monthlyAtFRA) === wrote[p.id] && !(ssAll[p.id]?.record ?? []).length);
  if (estimated.length) later.push({ label: `Social Security is estimated from ${estimated.length > 1 ? "your pay" : `${estimated[0].name === "Me" ? "your" : `${estimated[0].name}'s`} pay`}: the statement at ssa.gov/myaccount is exact`, href: "#/retirement/social-security", key: "ss-estimate" });
  // debts with a figure we filled in: the rate and payment (the flags core/estimate mirrors), and what is still owed (a
  // balance that is one of our guesses; `owed` is there only then)
  const owedGuess = (d) => { const a = byId(L(plan, "accounts"), d.accountId); return a && typeof a.id === "string" && isGuess(plan, `accounts[${a.id}].balance`) ? Math.abs(Number(a.balance) || 0) : null; };
  const guessed = L(plan, "debts").filter((d) => rateIsGuess(d) || paymentIsGuess(d) || owedGuess(d) !== null).map((d) => { const o = owedGuess(d); return { name: byId(L(plan, "accounts"), d.accountId)?.name ?? "A debt", rate: rateIsGuess(d) ? d.rate : null, payment: paymentIsGuess(d) ? d.minPayment : null, ...(o !== null ? { owed: o } : {}), ...mortgageYears(plan, d, today) }; });
  // one sentence that says what matters most, never at odds with the cards under it
  const first = open[0]?.id ?? null;
  const saved = savedTotal(plan);
  const cur = plan?.meta?.currency ?? "USD";
  const headline = bank ? `Your bank shows about ${fmtMoney(Math.round(bank.gap / 10) * 10, cur)} a month more going out than your plan lists, so the figures below may be too rosy. The first move fixes that.`
    : bankCard ? `About ${fmtMoney(Math.round(bankCard.monthly / 10) * 10, cur)} a month went to ${bankCard.the}, whose ${bankCard.plural ? "files aren't" : "file isn't"} in, so your bank can't be checked against your plan yet. The first move fixes that.`
    : spareWaits || (spare === null && spendOurs) ? "Your real spending decides whether your month works, so it's the best figure to type next."
    : drawing ? `You draw about ${fmtMoney(Math.round(-spare / 10) * 10, cur)} a month from savings${saved > 0 ? ` (${fmtMoney(Math.round(saved / 100) * 100, cur)} saved)` : ""}. The retirement check shows how long that lasts.`
    : lean?.kind === "ahead" ? "Counting your uneven pay at what you can count on, more goes out than comes in. Good months make up for it; the moves below start with the lean months."
    : lean?.kind === "even" ? "Counting your uneven pay at what you can count on, more goes out than comes in, and a month that brings all of it only just about breaks even. That's the first thing to fix, and the moves below start there."
    : lean ? "More goes out than comes in each month, even when uneven pay brings its full amount. That's the first thing to fix, and the moves below start there."
    : spare !== null && spare < 0 ? "More goes out than comes in each month. That's the first thing to fix, and the moves below start there."
      : first === "high-debt" || first === "mid-debt" ? "Paying off costly debt comes first. The moves below start there."
        : first === "protect" ? "Life cover for the people who count on you comes first. The moves below start there."
        : runwayStatus === "warn" || runwayStatus === "bad" ? (first && first !== "starter" && first !== "full-fund"
          ? (spare !== null ? "Your month works. The move below comes first, then a bigger cushion for surprises." : "The move below comes first, then a cushion for surprises.")
          : spare !== null ? "Your month works. Building your cushion for surprises is next." : "A cushion for surprises is the thing to build first.")
          : retire && retire.verdict !== "on track" ? "Your month and your cushion look good. Retirement could use a closer look."
            : spare !== null && spare >= 0 && runwayStatus === "ok" && (!retire || retire.verdict === "on track") ? "You're in good shape. Here's how to make it even better."
              : "A few more answers will fill this in.";
  const empty = !L(plan, "accounts").length || (nw.assets === 0 && nw.liabilities === 0);
  const iraGuessed = adults(plan).filter((p) => setupOf(plan).iraKind?.[p.id] === "unsure" && byId(L(plan, "accounts"), haveId("retire", p.id))?.type === "ira").map((p) => ({ personId: p.id, name: byId(L(plan, "accounts"), haveId("retire", p.id)).name }));
  return {
    netWorth: empty ? null : nw.netWorth, assets: nw.assets, liabilities: nw.liabilities,
    // half or more of what you own, or of what you owe, is our guesses (Net worth's partlyGuessed): the tile says so and waits
    ...(nw.partlyGuessed ? { netWorthGuessed: true } : {}),
    spare, runway, runwayTarget: liq?.targetMonths ?? null, runwayStatus, drawing, saved, lean,
    // what the month builds up in a year, said once (core/math/leftover.js, through Next best action's spare.year): only when the
    // left-over is known (not waiting on guesses) and not drawn from savings as planned; `leftFrom` when spending was worked out
    // from a left-over the person gave, with how far the left-over has moved since (pay or bills changed)
    ...(nba?.ready && !spareWaits && !drawing ? { year: nba.spare.year, yearWords: yearSavingWords(nba.spare, (n) => fmtMoney(n, plan?.meta?.currency ?? "USD")) } : {}),
    ...(nba?.ready && nba.spare.fromLeft ? { leftFrom: { ...nba.spare.fromLeft, moved: nba.spare.leftOver - nba.spare.fromLeft.left, now: nba.spare.leftOver, spending: nba.spare.spending, goals: nba.spare.goalSaving } } : {}),
    // the full cushion waits on purpose while costly debt is paid first (next-best-action cushionLater): "enough for now"
    cushionLater: (runwayStatus === "warn" || runwayStatus === "bad") ? cushionLater(nba) : null,
    bank: bank ? { gap: bank.gap, bankOut: bank.bankOut, planOut: bank.planOut, months: bank.months } : null, bankCard,
    stateTaxCounted: !!(nba?.ready && nba.spare.stateKnown), debtExtra, debtOn: debtNames.length === 1 ? debtNames[0] : debtNames.length === 2 ? `${debtNames[0]} and ${debtNames[1]}` : debtNames.length ? "your debts" : null, debtUntil: nba?.debtPlan?.until ?? null,
    retire, retirementKnown: known, retirementMissing: missing, moves, later, headline, guessed,
    homeMissing: hasMortgage(plan) && !L(plan, "accounts").some((a) => a.type === "property"),
    // only when true (every other plan's standing is exactly as before): the tiles say "by our guesses" and wait
    ...(spareWaits ? { spareWaits: true, spareGuessedShare: nba.spare.guessedShare } : {}),
    ...(childcareMissing ? { childcareMissing: true } : {}),
    ...(runwayWaits ? { runwayWaits: true } : {}),
    // an IRA answered "Not sure" on question 4b, counted as traditional for now (round 8, item 35)
    ...(iraGuessed.length ? { iraGuessed } : {}),
    // cash held back from the cushion, set aside for a goal or this year's tax not paid yet (round 8, items 10 and 29): only
    // then, so the tile can say why it reads less than the accounts hold
    ...(runway !== null && ((liq?.earmarked ?? 0) > 0.5 || (liq?.taxOwed ?? 0) > 0.5) ? { cushionHeld: { all: liq.nowAll, earmarked: liq.earmarked, taxOwed: liq.taxOwed, now: liq.now, goals: heldFor(plan), ...(liq.taxOwed > 0.5 ? { taxDue: liq.tax?.owedNow ?? liq.taxOwed } : {}), ...(liq.earmarked > 0.5 && cushionLike(plan) ? { cushionGoal: cushionLike(plan) } : {}) } } : {}),
    // (retireGuessedWhat: "spending" | "balance" -- what the tile should ask the person to type)
    ...(retireGuessed ? { retireGuessed: true, retireGuessedWhat: retireSpendGuessed ? "spending" : "balance" } : {}),
    ...(spendNow.guessed ? { spendGuessed: { monthly: spendNow.guessedMonthly, count: spendNow.guessed, rows: spendNow.monthly, typed: spendNow.typedMonthly } } : {}),
  };
}

// ---- guesses this setup makes (docs/CONVENTIONS.md "Guesses"). Each keeps the formula it has always had; the ledger
// (core/estimate) lists them on "Our guesses for you" and, for a guess the ledger wrote, keeps it in step with the
// answers it reads. They are worked out from the plan's own answers (basis "yours"), so they cite no population table;
// RULES_ON is the day their rules were last checked (their dataAsOf). The older flags they replace (ssWrote, retireAuto,
// cushionTarget, cushionFunds) are read through core/estimate's LEGACY adapters and stay frozen.
const RULES_ON = "2026-11-02";
const ssPerson = (path) => /^retirement\.socialSecurity\.([^.]+)\.monthlyAtFRA$/.exec(path ?? "")?.[1] ?? null;
export const estimators = {
  "overview/setup:ss": {
    tier: 4, order: 3, label: "Social Security at full retirement age", unit: "month", weight: "big", basis: "yours", reads: [],
    page: () => "#/retirement/social-security",
    fn(plan, { today, path }) {
      const pid = ssPerson(path), p = people(plan).find((x) => x.id === pid);
      if (!p?.birthDate || !today || p.role === "dependent") return null;
      const est = estimateSocialSecurity({ birthYear: Number(p.birthDate.slice(0, 4)), yearlyPay: yearlyPay(plan, pid), stopAge: p.retirementAge ?? Number(plan?.assumptions?.retirementAge ?? 65), today });
      if (est === null) return null;
      return { value: est, rounded: true, why: "worked out from the pay on file with Social Security's formula", uses: { pay: "typed", birth: "typed" }, sharperWith: [{ label: "your statement at ssa.gov", href: "#/retirement/social-security" }], tables: [], dataAsOf: RULES_ON, basis: "yours" };
    },
  },
  "overview/setup:retireSpend": {
    tier: 4, order: 4, label: "Spending a month once work stops", unit: "month", weight: "big", basis: "yours", reads: [],
    page: () => "#/retirement/projection",
    fn(plan, { today, args }, lib) {
      const r = retireSpendFor(plan, { today, args }, lib);
      if (!r || !(r.value > 0)) return null;
      return r.from50
        ? { value: r.value, rounded: true, why: "everyday costs as people 65-74 spend them, home costs and loans then", uses: { spending: r.guessed ? "guess" : "typed" }, sharperWith: [], tables: ["ce2025_spend_by_ageOfReferencePerson"], basis: "yours" }
        : { value: r.value, rounded: true, why: "today's bills without childcare, plus loans still running then", uses: { spending: r.guessed ? "guess" : "typed" }, sharperWith: [], tables: [], dataAsOf: RULES_ON, basis: "yours" };
    },
  },
  "overview/setup:cushionTarget": {
    tier: 4, order: 5, label: "Safety cushion to aim for", unit: "total", weight: "small", basis: "yours", reads: [],
    page: () => "#/goals/goals",
    fn(plan, { today }) {
      const c = cushion(plan, null, today);
      return c.essentialAll > 0 ? { value: c.target, rounded: true, why: `${c.months} months of the bills you have to pay`, uses: { spending: "typed" }, sharperWith: [], tables: [], dataAsOf: RULES_ON, basis: "yours" } : null;
    },
  },
  "overview/setup:cushionFunds": {
    tier: 4, order: 6, label: "Accounts that hold the cushion", unit: "list", weight: "small", basis: "yours", reads: [],
    page: () => "#/goals/goals",
    fn(plan) {
      const funds = cushionFundIds(plan);
      return funds.length ? { value: funds, why: "your checking, savings and cash accounts", uses: { accounts: "typed" }, sharperWith: [], tables: [], dataAsOf: RULES_ON, basis: "yours" } : null;
    },
  },
};

/** For Get started: has the setup been started, where, and is it finished. */
export function progress(plan) {
  const s = setupOf(plan);
  const at = SCREENS.find((x) => x.id === s.at) ?? null;
  return { started: !!s.startedAt, finished: !!s.finishedAt, at: at ? resolveScreen(plan, at.id) : null, q: at?.q ?? null, total: QUESTIONS, share: at ? barShare(at.id) : 0 };
}

/** compute(plan, { today, screen }) -> { screens, progress, standing (on "done" only) } */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  return {
    screens: visibleScreens(plan).map((s) => ({ id: s.id, q: s.q ?? null })),
    progress: progress(plan),
    standing: params.screen === "done" && today ? standing(plan, { today }) : null,
  };
}

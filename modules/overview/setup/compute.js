// modules/overview/setup/compute.js -- PURE. "Set up my plan": a conversation, one question per screen. This file
// holds the screens, the choices on them, and the functions that turn each screen's answers into plan records in the
// exact shapes the real pages write (People, Income, Net worth, Liabilities, Expenses, Goals, Retirement contributions,
// Social Security, Assumptions), plus "where you stand" at the end, read from the pages' own computes.
// The rules (README "What the setup writes"): records it makes carry ids starting "setup-", so going back and changing
// an answer updates the same records; a record that exists gets only the fields its screen asks for; a kind of record
// the plan already has (made on its own page) is shown and not asked again; nothing that another record points at is
// ever removed; a blank box saves nothing.
import { CATEGORIES, compute as computeExpenses } from "../../cashflow/expenses/compute.js";
import { bankVsPlan } from "../../cashflow/income-statement/compute.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeNetWorth, ACCOUNT_TYPES } from "../../balance/net-worth/compute.js";
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
const round2 = (n) => Math.round(n * 100) / 100;

/** The screens in order. `q` is the question number shown ("Question 3 of 7"); a follow-up screen shares its question's. */
export const SCREENS = [
  { id: "welcome" },
  { id: "you", q: 1 },
  { id: "money", q: 2 },
  { id: "ages", q: 3 },
  { id: "have", q: 4 },
  { id: "have-amounts", q: 4, follow: true, show: (p) => picks(p, "have").some((k) => askOwners(p, k).length > 0) },
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
  { key: "housing", group: "must", label: "Rent", labelMortgage: "Home costs besides the mortgage", help: "Rent, or property tax, insurance and fees if you own", helpMortgage: "Only what the mortgage payment doesn't cover: HOA fees, and tax or insurance you pay yourself", covers: ["housing"] },
  { key: "utilities", group: "must", label: "Utilities and phone", help: "Power, water, gas, internet, phones", covers: ["utilities", "phone"] },
  { key: "groceries", group: "must", label: "Groceries", help: "Food and household things", covers: ["groceries"] },
  { key: "transport", group: "must", label: "Car, gas and transit", help: "Gas, repairs, car insurance, fares. Not the loan payment", covers: ["transport"] },
  { key: "insurance", group: "must", label: "Insurance and health", help: "Premiums you pay yourself, medicine", covers: ["insurance", "health"] },
  { key: "childcare", group: "must", label: "Childcare and school", help: "Daycare, fees, activities", kids: true, covers: ["childcare"] },
  { key: "dining", group: "else", label: "Eating out and fun", help: "Restaurants, outings, hobbies", covers: ["dining", "fun"] },
  { key: "shopping", group: "else", label: "Shopping and everything else", help: "Clothes, gifts, subscriptions", covers: ["shopping"] },
];
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
function dropAccounts(draft, ids) {
  const kept = [];
  for (const id of ids) {
    const a = byId(draft.accounts, id);
    if (!a) continue;
    const why = referenced(draft, id);
    if (why) { kept.push({ id, name: a.name, reason: why, page: "#/balance/net-worth" }); continue; }
    draft.accounts = draft.accounts.filter((x) => x.id !== id);
    draft.debts = draft.debts.filter((d) => !(isSetupId(d.id) && d.accountId === id));
    draft.retirement.contributions = draft.retirement.contributions.filter((c) => !(isSetupId(c.id) && c.accountId === id));
    for (const g of draft.goals) if (isSetupId(g.id) && Array.isArray(g.fundedBy)) g.fundedBy = g.fundedBy.filter((x) => x !== id);
  }
  return kept;
}
/** Everything the setup made for one person (their pay, pension, Social Security, retirement account and saving). */
function dropPersonRecords(draft, pid) {
  const kept = dropAccounts(draft, [haveId("retire", pid)]);
  for (const k of kept) { const a = byId(draft.accounts, k.id); if (a) a.ownerId = ""; }   // kept, but its owner is gone
  draft.income = draft.income.filter((x) => ![`setup-pay-${pid}`, `setup-pension-${pid}`, `setup-ss-${pid}`].includes(setupRoot(x)));
  for (const x of draft.income) if (setupRoot(x) === "setup-other" && x.personId === pid) x.personId = "";
  draft.retirement.contributions = draft.retirement.contributions.filter((c) => c.id !== `setup-contrib-${pid}`);
  if (!(draft.retirement.socialSecurity[pid]?.record ?? []).length) delete draft.retirement.socialSecurity[pid];
  for (const k of ["status", "ss", "ssWrote"]) if (draft.guide.setup[k]) delete draft.guide.setup[k][pid];
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
  const keep = new Set();
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
  if (JSON.stringify(picks(draft, "have")) !== JSON.stringify(ks)) draft.guide.setup.picks.have = ks;
  if (!ks.includes("home") && draft.guide.setup.homeFromOwe) delete draft.guide.setup.homeFromOwe;
  return dropAccounts(draft, draft.accounts.filter((a) => isHave(a.id) && !ks.includes(haveKeyOf(a.id))).map((a) => a.id));
}
/**
 * Q4b. About how much in each: { [key or "retire-<personId>"]: amount, "kind-<personId>": "work"|"own", "contrib-<personId>":
 * a month from pay, "match-<personId>": a month the employer adds (through work only) }. A blank box makes no account
 * (and removes the setup's own, unless something points at it). Returns what had to be kept.
 */
export function applyHaveAmounts(draft, v, today) {
  ensure(draft);
  const gone = [], keepC = new Set();
  const several = adults(draft).length > 1;
  for (const h of HAVE) {
    if (!picks(draft, "have").includes(h.key)) continue;
    for (const pid of askOwners(draft, h.key)) {
      const amount = nonneg(v[h.perAdult ? `${h.key}-${pid}` : h.key]);
      const id = haveId(h.key, pid);
      const kind = RETIRE_KINDS.find((k) => k.value === v[`kind-${pid}`]) ?? RETIRE_KINDS[0];
      const mine = h.perAdult ? pos(v[`contrib-${pid}`]) : null, match = h.perAdult && kind.value === "work" ? pos(v[`match-${pid}`]) : null;
      if (amount === null && !mine && !match) { gone.push(id); continue; }
      const person = pid ? byId(adults(draft), pid) : null;
      const old = byId(draft.accounts, id);
      const type = h.perAdult ? (old && kind.group.includes(old.type) ? old.type : kind.type) : undefined;   // a Roth set on Net worth stays a Roth
      const asked = { balance: amount ?? old?.balance ?? 0, asOf: today, ...(type ? { type } : {}) };
      if (old && old.balance === asked.balance && (asked.type === undefined || old.type === asked.type)) delete asked.asOf;   // unchanged: keep its date
      put(draft.accounts, id, asked, { name: h.perAdult ? (several || person?.name !== "Me" ? `${possessive(person)} retirement` : "My retirement") : h.name, type: h.type, institution: "", asOf: today, ownerId: pid || "", history: [], notes: "" });
      if (mine || match) {
        const cid = `setup-contrib-${pid}`; keepC.add(cid);
        const oc = byId(draft.retirement.contributions, cid);
        // the screen shows the match a month, rounded; a yearly figure typed on Contributions that reads back the same stays
        const yearly = oc && Math.round(Number(oc.employerMatch) / 12) === Math.round(match ?? 0) ? oc.employerMatch : Math.round((match ?? 0) * 12);
        const monthly = oc && Math.round(Number(oc.amount) || 0) === Math.round(mine ?? 0) ? oc.amount : mine ?? 0;
        put(draft.retirement.contributions, cid, { amount: monthly, employerMatch: yearly }, { accountId: id, personId: pid, period: "monthly" });
      }
    }
  }
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
export function applyOweAmounts(draft, v, today) {
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
  return dropAccounts(draft, gone);
}
/** Ask the home's value with the mortgage: the plan has no home, or only the one this box made. */
export const askHomeWithMortgage = (p) => !existingHave(p, "home").length && (!byId(L(p, "accounts"), haveId("home")) || !!setupOf(p).homeFromOwe);
/** Has a mortgage: the housing question then asks for costs besides its payment. */
export const hasMortgage = (p) => L(p, "accounts").some((a) => a.type === "mortgage" && Number(a.balance));
/**
 * What the spending screen starts from: the plan's own bills (made on Expenses) a month, the loan and card payments
 * Expenses already counts from Liabilities (F-019), and the part of the bills that goes on after work stops (without
 * loan payments and childcare), for the retirement question's first figure.
 */
export function spendBase(plan) {
  const own = existingSpend(plan);
  const ex = own.length ? computeExpenses({ ...plan, expenses: own, debts: [] }, {}) : null;
  const cat = (k) => ex?.byCategory.find((c) => c.category === k)?.monthly ?? 0;
  const all = L(plan, "debts").length ? computeExpenses({ ...plan, expenses: own }, {}) : null;
  return { existing: ex?.monthly ?? 0, existingCount: own.length, existingCore: (ex?.monthly ?? 0) - cat("debt") - cat("childcare"), loanPayments: all?.debtFromDebts ?? 0 };
}
/**
 * Spending once work stops, to start the question with, to $10: today's bills without childcare and loan payments,
 * plus the payment of each loan still being paid when the first adult stops work (months to payoff at its payment,
 * nper in core/math/finance.js, past the months until then; a loan that never pays off at its payment counts too).
 * Without birth dates nobody knows when work stops, so no loan is added.
 */
export function retireDefault(plan, today = null) {
  const base = spendBase(plan);
  const rows = L(plan, "expenses").filter((x) => isSetupId(x.id) && x.category !== "childcare").reduce((s, x) => s + perYear(x.amount, x.period) / 12, 0);
  return Math.round((base.existingCore + rows + loansAfterWork(plan, today)) / 10) * 10;
}
/** The loan payments a month still running when the first adult stops work (retireDefault's loan part). */
export function loansAfterWork(plan, today = null) {
  const planAge = Number(plan?.assumptions?.retirementAge ?? 65);
  const left = today ? adults(plan).filter((p) => p.birthDate && setupOf(plan).status?.[p.id] !== "retired").map((p) => Math.max(0, ((p.retirementAge ?? planAge) - ageOn(p.birthDate, today)) * 12)) : [];
  const until = left.length ? Math.min(...left) : null;
  let loans = 0;
  if (until !== null && !L(plan, "expenses").some((x) => x.category === "debt")) {
    for (const d of L(plan, "debts")) {
      const owed = Math.abs(Number(byId(L(plan, "accounts"), d.accountId)?.balance) || 0), pay = Number(d.minPayment) || 0;
      if (!(owed > 0) || !(pay > 0)) continue;
      const months = nper((Number(d.rate) || 0) / 12, pay, owed);
      if (!Number.isFinite(months) || months > until) loans += pay;
    }
  }
  return loans;
}
/** Everyone is already retired: the retirement spending question is not asked (today's bills are retirement's). */
export const allRetired = (p) => adults(p).length > 0 && adults(p).every((a) => setupOf(p).status?.[a.id] === "retired");
/**
 * Q6. A month's spending: { mode: "rows"|"total", rows: { [key]: amount }, total, retireMonthly }. Rows the plan already
 * has a bill for are not asked. One rough total is counted as must-pay (safer for the cushion). `retireMonthly` is
 * what you expect to spend a month once you stop working, saved as Retirement's own figure.
 */
export function applySpend(draft, v) {
  ensure(draft);
  const mode = v.mode === "total" ? "total" : "rows";
  if ((draft.guide.setup.spendMode ?? "rows") !== mode || !draft.guide.setup.spendMode) draft.guide.setup.spendMode = mode;
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
}
/**
 * The cushion: months x must-pay bills a month (Expenses, loan payments included), to $100; what cash covers it now.
 * No bills yet: no amount (loan payments alone are not the bills; Emergency fund waits for expenses the same way).
 */
export function cushion(plan, months = null, today = null) {
  const m = Math.round(Number(months ?? plan?.assumptions?.emergencyMonths ?? 6)) || 6;
  const essential = L(plan, "expenses").length ? computeExpenses(plan, {}).essentialMonthly ?? 0 : 0;
  let now = 0;
  try { now = computeLiquidity(plan, { today }).now ?? 0; } catch { now = 0; }
  return { months: m, essential, target: Math.round((m * essential) / 100) * 100, now, covered: essential > 0 ? now / essential : null };
}
const addYears = (iso, years) => { const [y, m, d] = iso.split("-").map(Number); return `${y + years}-${String(m).padStart(2, "0")}-${String(Math.min(d, 28)).padStart(2, "0")}`; };
/**
 * Q7b. Each saving goal: { [key]: { target, years | date, name } }; the cushion: { months }. The cushion goal has no
 * date (it is kept topped up, not reached once), its target is months x must-pay bills, its money is the savings and
 * cash accounts, and its months are the plan's emergency months, so Emergency fund and this goal agree. A goal's
 * blank amount saves nothing new (a new goal starts at 0 for the Goals page to ask).
 */
export function applyGoalDetails(draft, v, today) {
  ensure(draft);
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
      const funds = draft.accounts.filter((a) => TIERS.now.types.includes(a.type)).map((a) => a.id);
      const old = byId(draft.goals, id), s = draft.guide.setup;
      const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
      const asked = {};
      if (!old || same(old.fundedBy, s.cushionFunds)) { asked.fundedBy = funds; if (!same(s.cushionFunds, funds)) s.cushionFunds = funds; }
      // the amount follows the bills while it is the one this setup wrote; null means the person kept or typed their own
      // ("That's about right" or a figure typed on Our guesses for you), so it stays
      const oursTarget = s.cushionTarget === undefined || (s.cushionTarget !== null && Number(old?.target) === Number(s.cushionTarget));
      if (c.essential > 0 && (!old || oursTarget)) { asked.target = c.target; if (s.cushionTarget !== c.target) s.cushionTarget = c.target; }
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
    put(draft.goals, id, asked, { name: g.name, icon: g.icon, target: 0, targetDate: date, priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true });
  }
}
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
        return [p.id, { status, by: pay?.type === "business" ? "self" : "employer", amount: pay?.amount ?? "", period: pay?.period ?? "annual", pension: pension?.amount ?? "" }];
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
  if (screen === "have") return picks(plan, "have");
  if (screen === "have-amounts") {
    const o = {};
    for (const h of HAVE) for (const pid of h.perAdult ? ad.map((p) => p.id) : [""]) { const a = acct(haveId(h.key, pid)); o[h.perAdult ? `${h.key}-${pid}` : h.key] = a ? a.balance : ""; }
    for (const p of ad) {
      const c = byId(plan?.retirement?.contributions ?? [], `setup-contrib-${p.id}`), a = acct(haveId("retire", p.id));
      // someone paid by their own business has no employer plan: "On my own" first (review 2026-11-02)
      const ownBusiness = payLineNow(L(plan, "income"), p.id, today)?.type === "business";
      o[`kind-${p.id}`] = a?.type === "ira" ? "own" : a?.type === "roth" ? (Number(c?.employerMatch) > 0 ? "work" : "own") : a ? "work" : ownBusiness ? "own" : s.status?.[p.id] === "work" || !s.status?.[p.id] ? "work" : "own";
      o[`contrib-${p.id}`] = c?.amount ? Math.round(c.amount) : ""; o[`match-${p.id}`] = c?.employerMatch ? Math.round(c.employerMatch / 12) : "";
    }
    return o;
  }
  if (screen === "owe") return picks(plan, "owe");
  if (screen === "owe-amounts") {
    const o = {};
    for (const d of OWE) { const a = acct(oweId(d.key)); const r = byId(L(plan, "debts"), `setup-debt-${d.key}`); o[d.key] = { owed: a?.balance ?? "", payment: r && !paymentIsGuess(r) && Number(r.minPayment) > 0 ? Math.round(r.minPayment) : "", rate: r && !rateIsGuess(r) ? Math.round(r.rate * 100000) / 1000 : "", paidInFull: d.key === "credit" ? !!s.paidInFull : false }; }
    o.mortgage.home = acct(haveId("home"))?.balance ?? "";
    return o;
  }
  if (screen === "spend") {
    const rt = Number(plan?.retirement?.spendingMonthly);
    return { mode: s.spendMode ?? "rows", rows: Object.fromEntries(SPEND.map((x) => [x.key, byId(L(plan, "expenses"), `setup-x-${x.key}`)?.amount ?? ""])), total: byId(L(plan, "expenses"), "setup-x-total")?.amount ?? "", retireMonthly: rt > 0 ? rt : "", retireTyped: rt > 0 && !s.retireAuto };
  }
  if (screen === "goals") return picks(plan, "goals");
  if (screen === "goal-details") return Object.fromEntries(GOALS.filter((g) => !g.focus).map((g) => { const x = byId(L(plan, "goals"), `setup-goal-${g.key}`); return [g.key, { target: x?.target || "", date: x?.targetDate ?? "", years: x ? null : g.years ?? null, name: g.key === "other" && x ? x.name : "", months: Number(plan?.assumptions?.emergencyMonths ?? 6) }]; }));
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
  if (screen === "have-amounts") { const t = L(plan, "accounts").filter((a) => isHave(a.id) && a.type !== "property" && a.type !== "vehicle").reduce((s, a) => s + (Number(a.balance) || 0), 0); return t > 0 ? { kind: "have", total: t } : null; }
  if (screen === "owe" && picks(plan, "owe").includes("none")) return { kind: "debt-free" };
  if (screen === "owe-amounts") { const t = L(plan, "accounts").filter((a) => isOwe(a.id)).reduce((s, a) => s + Math.abs(Number(a.balance) || 0), 0); return t > 0 ? { kind: "owe", total: t } : setupOf(plan).paidInFull ? { kind: "paid-in-full" } : null; }
  if (screen === "spend") { const e = L(plan, "expenses").length || L(plan, "debts").length ? computeExpenses(plan, {}) : null; return e && e.monthly > 0 ? { kind: "spend", monthly: e.monthly, essential: e.essentialMonthly } : null; }
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
      .map((r) => ({ name: r.name, rate: r.rate, guess: rateIsGuess(r.detail), card: r.type === "credit" }));
  };
  const said = (list) => {
    const words = list.map((d) => `${d.name} about ${pct(d.rate)} a year`).join(", ");
    return `${words}${list.some((d) => d.guess) ? " (a typical rate: type yours on What you owe)" : ""}`;
  };
  switch (step.id) {
    case "bills": return retired
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
      if (step.fromSavings > 0) return { title: cards ? "Pay off the cards from your savings" : "Pay off costly debt from your savings", detail: `${step.detail}${list.some((d) => d.guess) ? " The rate is a typical one: type yours on What you owe." : ""}` };
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
  const drawing = retired && spare !== null && spare < 0;
  // short only on the careful month (Side income's "count on" holds part of uneven pay back): what a month that brings the
  // Income page's amount leaves, so the sentence and the left-over line say a lean month, not a plain overspend (review
  // 2026-11-02, round 5: the done screen said "More goes out than comes in" above a move card saying good months make up)
  // kind: Next best action's spare.fullKind ("ahead", "even" within $5 of $0, "short"), so no line says "about $0" (round 5)
  const lean = !drawing && spare !== null && spare < 0 && (Number(nba?.spare?.held) || 0) > 0.5 ? { full: nba.spare.full, about: nba.spare.fullAbout, kind: nba.spare.fullKind } : null;
  // a debt step the saved debt plan already pays off is under way, not a move to make
  const steps = (nba?.ready ? nba.steps : []).filter((s) => s.status !== "done" && s.status !== "skip" && s.status !== "underway" && s.id !== "rest");
  const debtExtra = nba?.ready ? nba.spare.debtExtra ?? 0 : 0;
  const debtNames = nba?.debtPlan?.names ?? [];
  const open = steps.map((s) => ({ id: s.id, ...revealWords({ ...s, spare }, plan, { today, retired: drawing }), href: `#/${s.go.join("/")}` }));
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
  const couple = adults(plan).length >= 2 && (plan?.household?.filingStatus ?? "single") === "single" && adults(plan).some((p) => p.relation === "partner");
  if (couple && L(plan, "income").length) later.push({ label: "Federal tax as two returns: the left-over figure works out one return for both of you, so it reads a little low", href: "#/taxes/federal", key: "couple" });
  const wrote = setupOf(plan).ssWrote ?? {}, ssAll = plan?.retirement?.socialSecurity ?? {};
  const estimated = adults(plan).filter((p) => wrote[p.id] !== undefined && Number(ssAll[p.id]?.monthlyAtFRA) === wrote[p.id] && !(ssAll[p.id]?.record ?? []).length);
  if (estimated.length) later.push({ label: `Social Security is estimated from ${estimated.length > 1 ? "your pay" : `${estimated[0].name === "Me" ? "your" : `${estimated[0].name}'s`} pay`}: the statement at ssa.gov/myaccount is exact`, href: "#/retirement/social-security", key: "ss-estimate" });
  const guessed = L(plan, "debts").filter((d) => rateIsGuess(d) || paymentIsGuess(d)).map((d) => ({ name: byId(L(plan, "accounts"), d.accountId)?.name ?? "A debt", rate: rateIsGuess(d) ? d.rate : null, payment: paymentIsGuess(d) ? d.minPayment : null }));
  // one sentence that says what matters most, never at odds with the cards under it
  const first = open[0]?.id ?? null;
  const saved = savedTotal(plan);
  const cur = plan?.meta?.currency ?? "USD";
  const headline = bank ? `Your bank shows about ${fmtMoney(Math.round(bank.gap / 10) * 10, cur)} a month more going out than your plan lists, so the figures below may be too rosy. The first move fixes that.`
    : bankCard ? `About ${fmtMoney(Math.round(bankCard.monthly / 10) * 10, cur)} a month went to ${bankCard.the}, whose ${bankCard.plural ? "files aren't" : "file isn't"} in, so your bank can't be checked against your plan yet. The first move fixes that.`
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
  return {
    netWorth: empty ? null : nw.netWorth, assets: nw.assets, liabilities: nw.liabilities,
    spare, runway, runwayTarget: liq?.targetMonths ?? null, runwayStatus, drawing, saved, lean,
    // the full cushion waits on purpose while costly debt is paid first (next-best-action cushionLater): "enough for now"
    cushionLater: (runwayStatus === "warn" || runwayStatus === "bad") ? cushionLater(nba) : null,
    bank: bank ? { gap: bank.gap, bankOut: bank.bankOut, planOut: bank.planOut, months: bank.months } : null, bankCard,
    stateTaxCounted: !!(nba?.ready && nba.spare.stateKnown), debtExtra, debtOn: debtNames.length === 1 ? debtNames[0] : debtNames.length === 2 ? `${debtNames[0]} and ${debtNames[1]}` : debtNames.length ? "your debts" : null, debtUntil: nba?.debtPlan?.until ?? null,
    retire, retirementKnown: known, retirementMissing: missing, moves, later, headline, guessed,
    homeMissing: hasMortgage(plan) && !L(plan, "accounts").some((a) => a.type === "property"),
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
    fn(plan, { today }) {
      const v = retireDefault(plan, today);
      return v > 0 ? { value: v, rounded: true, why: "today's bills without childcare, plus loans still running then", uses: { spending: "typed" }, sharperWith: [], tables: [], dataAsOf: RULES_ON, basis: "yours" } : null;
    },
  },
  "overview/setup:cushionTarget": {
    tier: 4, order: 5, label: "Safety cushion to aim for", unit: "total", weight: "small", basis: "yours", reads: [],
    page: () => "#/goals/goals",
    fn(plan, { today }) {
      const c = cushion(plan, null, today);
      return c.essential > 0 ? { value: c.target, rounded: true, why: `${c.months} months of your must-pay bills`, uses: { spending: "typed" }, sharperWith: [], tables: [], dataAsOf: RULES_ON, basis: "yours" } : null;
    },
  },
  "overview/setup:cushionFunds": {
    tier: 4, order: 6, label: "Accounts that hold the cushion", unit: "list", weight: "small", basis: "yours", reads: [],
    page: () => "#/goals/goals",
    fn(plan) {
      const funds = L(plan, "accounts").filter((a) => TIERS.now.types.includes(a.type)).map((a) => a.id);
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

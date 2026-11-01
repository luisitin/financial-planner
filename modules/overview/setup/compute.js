// modules/overview/setup/compute.js -- PURE. "Set up my plan": a conversation, one question per screen. This file
// holds the screens, the choices on them, and the functions that turn each screen's answers into plan records in the
// exact shapes the real pages write (People, Income, Net worth, Liabilities, Expenses, Goals, Retirement contributions,
// Social Security, Assumptions), plus "where you stand" at the end, read from the pages' own computes.
// The rules (README "What the setup writes"): records it makes carry ids starting "setup-", so going back and changing
// an answer updates the same records; a record that exists gets only the fields its screen asks for; a kind of record
// the plan already has (made on its own page) is shown and not asked again; nothing that another record points at is
// ever removed; a blank box saves nothing.
import { CATEGORIES, compute as computeExpenses } from "../../cashflow/expenses/compute.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeNetWorth } from "../../balance/net-worth/compute.js";
import { compute as computeLiquidity } from "../../balance/liquidity/compute.js";
import { compute as computeNext } from "../next-best-action/compute.js";
import { compute as computeProjection } from "../../retirement/projection/compute.js";
import { estimateBenefit, claimFactor, fullRetirementAge, LAST_AWI_YEAR } from "../../retirement/social-security/compute.js";
import { WAGE_INDICES } from "../../retirement/social-security/data/ssa.js";
import { STATE_NAMES, NO_WAGE_TAX } from "../../taxes/state/compute.js";
import { perYear } from "../../../core/math/periods.js";
import { ageOn } from "../../../core/math/dates.js";

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
  { id: "owe-amounts", q: 5, follow: true, show: (p) => picks(p, "owe").some((k) => k !== "none" && !existingOwe(p, k).length) },
  { id: "spend", q: 6 },
  { id: "goals", q: 7 },
  { id: "goal-details", q: 7, follow: true, show: (p) => picks(p, "goals").some((k) => GOALS.find((g) => g.key === k && !g.focus) && !existingGoal(p, k).length) },
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
export const RETIRE_KINDS = [{ value: "work", label: "Through work", type: "401k" }, { value: "own", label: "On my own", type: "ira" }];
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
 * A month's spending in two groups; must-pay comes from the group (and matches the categories' own `essential`).
 * `covers`: the Expenses categories a row stands for, so a row is not asked when the plan already has one of them.
 */
export const SPEND = [
  { key: "housing", group: "must", label: "Rent", labelMortgage: "Home costs besides the mortgage", help: "Rent, or property tax, insurance and fees if you own", helpMortgage: "Property tax, home insurance, fees", covers: ["housing"] },
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
  const have = existingHave(p, key);
  if (!h.perAdult) return have.length ? [] : [""];
  return adults(p).filter((a) => !have.some((x) => x.ownerId === a.id || !x.ownerId)).map((a) => a.id);
}
const carName = (a) => /car|auto|vehicle|truck/i.test(a.name ?? "");
export const existingOwe = (p, key) => { const o = OWE.find((x) => x.key === key); return o ? L(p, "accounts").filter((a) => !isSetupId(a.id) && a.type === o.type && (key !== "car-loan" || carName(a)) && (key !== "loan" || !carName(a))) : []; };
/** A pay already on Income for this person (not made here): the money question shows it instead of asking again. */
export const existingPay = (p, pid) => L(p, "income").filter((x) => !isSetupId(x.id) && x.personId === pid && (x.type === "salary" || x.type === "business"));
export const existingSpend = (p) => L(p, "expenses").filter((x) => !isSetupId(x.id));
/** The spending rows to ask: childcare only with children; a row whose categories the plan already has is not asked. */
export const spendRows = (p) => { const have = new Set(existingSpend(p).map((x) => x.category)); return SPEND.filter((s) => (!s.kids || dependents(p).length > 0) && !s.covers.some((c) => have.has(c))); };
const emergencyLike = (g) => g.isEmergencyFund || g.icon === "🛟" || /emergency|rainy ?day|cushion/i.test(g.name ?? "");
const houseLike = (g) => /down ?payment|\b(house|home)\b/i.test(g.name ?? "") && !/repair|remodel|office|pay ?off|mortgage/i.test(g.name ?? "");
/** A goal of this kind the plan already has (made on Goals): it shows ticked and nothing is added. */
export const existingGoal = (p, key) => { const def = GOALS.find((g) => g.key === key); return L(p, "goals").filter((g) => !isSetupId(g.id) && (key === "cushion" ? emergencyLike(g) : key === "home" ? houseLike(g) : def?.match ? def.match.test(g.name ?? "") : false)); };

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
  if (L(plan, "income").some((x) => !isSetupId(x.id) && x.personId === pid)) return "Income lists their pay";
  if (L(plan, "accounts").some((x) => !isSetupId(x.id) && x.ownerId === pid)) return "accounts are in their name";
  if ((plan?.retirement?.contributions ?? []).some((c) => !isSetupId(c.id) && c.personId === pid)) return "retirement saving is in their name";
  if ((plan?.retirement?.pensions ?? []).some((x) => x.personId === pid)) return "a pension is in their name";
  if ((plan?.insurance?.policies ?? []).some((x) => x.personId === pid)) return "an insurance policy covers them";
  if ((plan?.estate?.documents ?? []).some((x) => x.personId === pid)) return "their papers are listed";
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
  draft.income = draft.income.filter((x) => ![`setup-pay-${pid}`, `setup-pension-${pid}`, `setup-ss-${pid}`].includes(x.id));
  for (const x of draft.income) if (x.id === "setup-other" && x.personId === pid) x.personId = "";
  draft.retirement.contributions = draft.retirement.contributions.filter((c) => c.id !== `setup-contrib-${pid}`);
  delete draft.retirement.socialSecurity[pid];
  for (const k of ["status", "ss"]) if (draft.guide.setup[k]) delete draft.guide.setup[k][pid];
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
    if (status === "work" && !existingPay(draft, p.id).length) {
      const amount = pos(x.amount);
      const period = PAY_PERIODS.some((o) => o.value === x.period) ? x.period : "annual";
      if (amount) { const id = `setup-pay-${p.id}`; keep.add(id); put(draft.income, id, { amount, period }, { name: `${possessive(p)} pay`, type: "salary", ...base }); }
    }
    if (status === "retired") {
      const pension = pos(x.pension);
      if (pension) { const id = `setup-pension-${p.id}`; keep.add(id); put(draft.income, id, { amount: pension }, { name: `${possessive(p)} pension`, type: "pension", period: "monthly", ...base }); }
    }
  }
  const other = pos(v.other?.amount), kind = OTHER_KINDS.find((k) => k.value === v.other?.kind) ?? OTHER_KINDS[3];
  if (other) {
    keep.add("setup-other");
    const self = adults(draft)[0];
    put(draft.income, "setup-other", { amount: other, type: kind.value, taxable: kind.taxable !== false, personId: kind.value === "business" ? self?.id ?? "" : "" }, { name: kind.name, period: "monthly", growth: 0, startDate: "", endDate: "" });
    const r = byId(draft.income, "setup-other");
    if (OTHER_KINDS.some((k) => k.name === r.name)) r.name = kind.name;   // follow the kind unless renamed on Income
  }
  draft.income = draft.income.filter((x) => !isSetupId(x.id) || x.id.startsWith("setup-ss-") || keep.has(x.id));
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
  const keepIncome = new Set(L(draft, "income").filter((x) => x.id?.startsWith?.("setup-ss-")).map((x) => x.id));
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
    if (mode) draft.guide.setup.ss[p.id] = mode;
    const rec = draft.retirement.socialSecurity[p.id] ?? {};
    const hasRecord = Array.isArray(rec.record) && rec.record.length > 0;
    const birthYear = p.birthDate ? Number(p.birthDate.slice(0, 4)) : null;
    const sid = `setup-ss-${p.id}`;
    if (mode !== "getting") keepIncome.delete(sid);
    if (hasRecord || !mode) continue;
    const without = (o, ...ks) => Object.fromEntries(Object.entries(o).filter(([k]) => !ks.includes(k)));
    const set = (next) => { if (JSON.stringify(next) !== JSON.stringify(rec)) draft.retirement.socialSecurity[p.id] = next; };
    if (mode === "estimate") {
      const est = estimateSocialSecurity({ birthYear, yearlyPay: yearlyPay(draft, p.id), stopAge: p.retirementAge ?? planAge, today });
      if (est !== null) set({ ...without(rec, "claimAge"), monthlyAtFRA: est });
    } else if (mode === "statement") {
      const amount = pos(ss.amount);
      if (amount) set({ ...without(rec, "claimAge"), monthlyAtFRA: amount });
    } else if (mode === "getting" && birthYear) {
      const amount = pos(ss.amount);
      const started = Math.min(70, Math.max(62, Math.round(Number(ss.started) || 0) || Math.min(70, now ?? 67)));
      if (amount) {
        set({ ...rec, claimAge: started, monthlyAtFRA: Math.round((amount / claimFactor(birthYear, started)) * 10) / 10 });
        keepIncome.add(sid);
        put(draft.income, sid, { amount }, { name: `${possessive(p)} Social Security`, type: "social", personId: p.id, period: "monthly", growth: 0, startDate: "", endDate: "", taxable: true });
      }
    } else if (mode === "none") {
      set(without(rec, "monthlyAtFRA", "claimAge"));
    }
  }
  draft.income = draft.income.filter((x) => !x.id?.startsWith?.("setup-ss-") || keepIncome.has(x.id));
}
/** Q4. Which kinds of account to add (keys of HAVE; a kind the plan already has is not asked). Returns what had to be kept. */
export function applyHavePicks(draft, keys) {
  ensure(draft);
  const ks = keys.filter((k) => HAVE.some((h) => h.key === k) && askOwners(draft, k).length > 0);
  if (JSON.stringify(picks(draft, "have")) !== JSON.stringify(ks)) draft.guide.setup.picks.have = ks;
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
      const asked = { balance: amount ?? byId(draft.accounts, id)?.balance ?? 0, asOf: today, ...(h.perAdult ? { type: kind.type } : {}) };
      const old = byId(draft.accounts, id);
      if (old && old.balance === asked.balance && (asked.type === undefined || old.type === asked.type)) delete asked.asOf;   // unchanged: keep its date
      put(draft.accounts, id, asked, { name: h.perAdult ? (several || person?.name !== "Me" ? `${possessive(person)} retirement` : "My retirement") : h.name, type: h.type, institution: "", asOf: today, ownerId: pid || "", history: [], notes: "" });
      if (mine || match) {
        const cid = `setup-contrib-${pid}`; keepC.add(cid);
        put(draft.retirement.contributions, cid, { amount: mine ?? 0, employerMatch: Math.round((match ?? 0) * 12) }, { accountId: id, personId: pid, period: "monthly" });
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
  const ks = keys.includes("none") ? ["none"] : keys.filter((k) => OWE.some((o) => o.key === k) && !existingOwe(draft, k).length);
  if (JSON.stringify(picks(draft, "owe")) !== JSON.stringify(ks)) draft.guide.setup.picks.owe = ks;
  draft.expenses = draft.expenses.filter((x) => x.id !== "setup-x-debt");
  return dropAccounts(draft, OWE.filter((o) => !ks.includes(o.key)).map((o) => oweId(o.key)));
}
/**
 * Q5b. Each debt: { [key]: { owed, payment, rate (percent, as typed), paidInFull (cards) } }. A card paid in full every
 * month is not a debt: nothing is saved. Otherwise a liability account with what is owed and a Liabilities row with
 * the rate and the monthly payment; a blank rate gets the typical one (TYPICAL_RATES), kept in `rateGuessed`. The
 * payment is not written as an expense: Expenses counts the Liabilities rows' payments itself (its F-019 rule).
 */
export function applyOweAmounts(draft, v, today) {
  ensure(draft);
  const gone = [];
  let paidInFull = false;
  for (const o of OWE) {
    if (!picks(draft, "owe").includes(o.key) || existingOwe(draft, o.key).length) continue;
    const x = v[o.key] ?? {};
    const id = oweId(o.key), did = `setup-debt-${o.key}`;
    if (o.key === "credit" && x.paidInFull) paidInFull = true;
    const owed = o.key === "credit" && x.paidInFull ? null : pos(x.owed);
    if (!owed) { gone.push(id); continue; }
    const old = byId(draft.accounts, id);
    put(draft.accounts, id, old && old.balance === owed ? {} : { balance: owed, asOf: today }, { name: o.name, type: o.type, institution: "", asOf: today, ownerId: "", history: [], notes: "" });
    const typed = parseMoney(x.rate);
    const known = typed !== null && typed >= 0 && typed <= 100;
    const row = byId(draft.debts, did);
    const rate = known ? Math.round(typed * 100) / 10000 : row && !rateIsGuess(row) ? row.rate : TYPICAL_RATES[o.key];
    const asked = { rate, minPayment: pos(x.payment) ?? 0 };
    const r = put(draft.debts, did, asked, { accountId: id, extra: 0, termMonths: null, startDate: "", securedBy: "", creditLimit: null });
    if (known || (row && !rateIsGuess(row))) { if ("rateGuessed" in r) delete r.rateGuessed; }
    else if (r.rateGuessed !== rate) r.rateGuessed = rate;
  }
  if ((draft.guide.setup.paidInFull ?? false) !== paidInFull) draft.guide.setup.paidInFull = paidInFull;
  return dropAccounts(draft, gone);
}
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
/** Spending once work stops, to start the question with: today's bills without loan payments and childcare, to $10. */
export function retireDefault(plan) {
  const base = spendBase(plan);
  const rows = L(plan, "expenses").filter((x) => isSetupId(x.id) && x.category !== "childcare").reduce((s, x) => s + perYear(x.amount, x.period) / 12, 0);
  return Math.round((base.existingCore + rows) / 10) * 10;
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
  const later = pos(v.retireMonthly);
  if (later && !allRetired(draft) && Number(draft.retirement.spendingMonthly) !== later) draft.retirement.spendingMonthly = later;
}
/** Q7. What you are working toward (keys of GOALS; a kind the plan already has is not added). Goals linked from elsewhere stay. */
export function applyGoalPicks(draft, keys) {
  ensure(draft);
  const valid = keys.filter((k) => GOALS.some((g) => g.key === k));
  const ks = valid.filter((k) => GOALS.find((g) => g.key === k).focus || !existingGoal(draft, k).length);
  if (JSON.stringify(picks(draft, "goals")) !== JSON.stringify(ks)) draft.guide.setup.picks.goals = ks;
  const focus = ks.filter((k) => GOALS.find((g) => g.key === k)?.focus);
  if (JSON.stringify(draft.guide.setup.focus ?? []) !== JSON.stringify(focus)) draft.guide.setup.focus = focus;
  const linked = new Set(L(draft, "events").map((e) => e.goalId).filter(Boolean));
  draft.goals = draft.goals.filter((g) => !isSetupId(g.id) || ks.includes(g.id.replace(/^setup-goal-/, "")) || linked.has(g.id));
}
/** The cushion: months x must-pay bills a month (Expenses, loan payments included), to $100; what cash covers it now. */
export function cushion(plan, months = null, today = null) {
  const m = Math.round(Number(months ?? plan?.assumptions?.emergencyMonths ?? 6)) || 6;
  const essential = computeExpenses(plan, {}).essentialMonthly ?? 0;
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
    if (g.focus || !picks(draft, "goals").includes(g.key) || existingGoal(draft, g.key).length) continue;
    const id = `setup-goal-${g.key}`;
    const x = v[g.key] ?? {};
    if (g.key === "cushion") {
      const months = Math.min(12, Math.max(1, Math.round(Number(x.months) || Number(draft.assumptions?.emergencyMonths ?? 6))));
      if (Number(draft.assumptions?.emergencyMonths ?? 6) !== months || draft.assumptions?.emergencyMonths === undefined) draft.assumptions = { ...(draft.assumptions ?? {}), emergencyMonths: months };
      const c = cushion(draft, months, today);
      const fundedBy = draft.accounts.filter((a) => a.type === "savings" || a.type === "cash").map((a) => a.id);
      put(draft.goals, id, { target: c.target }, { name: g.name, icon: g.icon, targetDate: "", priority: 1, saved: 0, fundedBy, monthly: 0, rate: null, inflates: false, isEmergencyFund: true });
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
    const o = inc("setup-other");
    return {
      people: Object.fromEntries(ad.map((p) => {
        const pay = inc(`setup-pay-${p.id}`), pension = inc(`setup-pension-${p.id}`);
        const status = s.status?.[p.id] ?? (pay || existingPay(plan, p.id).length ? "work" : pension ? "retired" : null);
        return [p.id, { status, amount: pay?.amount ?? "", period: pay?.period ?? "annual", pension: pension?.amount ?? "" }];
      })),
      other: { kind: OTHER_KINDS.some((k) => k.value === o?.type) ? o.type : "", amount: o?.amount ?? "" },
    };
  }
  if (screen === "ages") {
    const ss = plan?.retirement?.socialSecurity ?? {};
    const planAge = Number(plan?.assumptions?.retirementAge ?? 65);
    return {
      people: Object.fromEntries(ad.map((p) => {
        const [y, m] = (p.birthDate || "").split("-");
        const working = s.status?.[p.id] === "work" || existingPay(plan, p.id).length > 0 || !!inc(`setup-pay-${p.id}`);
        const typed = Number(ss[p.id]?.monthlyAtFRA) > 0 || (ss[p.id]?.record ?? []).length > 0;
        const mode = s.ss?.[p.id] ?? (typed ? "statement" : s.status?.[p.id] === "retired" ? "getting" : working ? "estimate" : "unsure");
        const getting = inc(`setup-ss-${p.id}`);
        const now = p.birthDate && today ? ageOn(p.birthDate, today) : null;
        return [p.id, { month: m ? Number(m) : "", year: y ?? "", stopAge: p.retirementAge ?? Math.max(planAge, now !== null ? now + 1 : 0), retired: s.status?.[p.id] === "retired", ss: { mode, amount: getting?.amount ?? (mode === "statement" ? ss[p.id]?.monthlyAtFRA ?? "" : ""), started: Number(ss[p.id]?.claimAge) || (now !== null ? Math.min(70, Math.max(62, now)) : 67), record: (ss[p.id]?.record ?? []).length > 0 } }];
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
      o[`kind-${p.id}`] = a && (a.type === "ira" || a.type === "roth") ? "own" : s.status?.[p.id] === "work" || !s.status?.[p.id] ? "work" : "own";
      o[`contrib-${p.id}`] = c?.amount || ""; o[`match-${p.id}`] = c?.employerMatch ? Math.round(c.employerMatch / 12) : "";
    }
    return o;
  }
  if (screen === "owe") return picks(plan, "owe");
  if (screen === "owe-amounts") {
    const o = {};
    for (const d of OWE) { const a = acct(oweId(d.key)); const r = byId(L(plan, "debts"), `setup-debt-${d.key}`); o[d.key] = { owed: a?.balance ?? "", payment: r?.minPayment || "", rate: r && !rateIsGuess(r) ? Math.round(r.rate * 10000) / 100 : "", paidInFull: d.key === "credit" ? !!s.paidInFull : false }; }
    return o;
  }
  if (screen === "spend") {
    const rt = Number(plan?.retirement?.spendingMonthly);
    return { mode: s.spendMode ?? "rows", rows: Object.fromEntries(SPEND.map((x) => [x.key, byId(L(plan, "expenses"), `setup-x-${x.key}`)?.amount ?? ""])), total: byId(L(plan, "expenses"), "setup-x-total")?.amount ?? "", retireMonthly: rt > 0 ? rt : "", retireTyped: rt > 0 };
  }
  if (screen === "goals") return picks(plan, "goals");
  if (screen === "goal-details") return Object.fromEntries(GOALS.filter((g) => !g.focus).map((g) => { const x = byId(L(plan, "goals"), `setup-goal-${g.key}`); return [g.key, { target: x?.target || "", date: x?.targetDate ?? "", years: x ? null : g.years ?? null, name: g.key === "other" && x ? x.name : "", months: Number(plan?.assumptions?.emergencyMonths ?? 6) }]; }));
  return {};
}

/** One line back after a screen, as figures: the view words it ("Got it: about $7,400 a month before tax"). */
export function reflect(plan, screen) {
  if (screen === "money") { const m = L(plan, "income").length ? computeIncome(plan, {}).monthly : 0; return m > 0 ? { kind: "money", monthly: m } : null; }
  if (screen === "have-amounts") { const t = L(plan, "accounts").filter((a) => isHave(a.id) && a.type !== "property" && a.type !== "vehicle").reduce((s, a) => s + (Number(a.balance) || 0), 0); return t > 0 ? { kind: "have", total: t } : null; }
  if (screen === "owe" && picks(plan, "owe").includes("none")) return { kind: "debt-free" };
  if (screen === "owe-amounts") { const t = L(plan, "accounts").filter((a) => isOwe(a.id)).reduce((s, a) => s + Math.abs(Number(a.balance) || 0), 0); return t > 0 ? { kind: "owe", total: t } : setupOf(plan).paidInFull ? { kind: "paid-in-full" } : null; }
  if (screen === "spend") { const e = L(plan, "expenses").length || L(plan, "debts").length ? computeExpenses(plan, {}) : null; return e && e.monthly > 0 ? { kind: "spend", monthly: e.monthly, essential: e.essentialMonthly } : null; }
  return null;
}

export const FOCUS_GUIDE = { debt: { title: "Make a plan to pay off what you owe", href: "#/overview/guide/debt" }, retire: { title: "Check your retirement step by step", href: "#/overview/guide/retire" }, home: { title: "Work out the home you can afford", href: "#/overview/guide/home" } };
/** Is retirement checkable: every adult has a birth date and Social Security (estimated, typed, a record) or said they get none. */
export function retirementKnown(plan) {
  const ss = plan?.retirement?.socialSecurity ?? {}, said = setupOf(plan).ss ?? {};
  const ad = adults(plan);
  return ad.length > 0 && ad.every((p) => p.birthDate && (Number(ss[p.id]?.monthlyAtFRA) > 0 || (ss[p.id]?.record ?? []).length > 0 || said[p.id] === "none"));
}
/**
 * Where you stand, from the pages' own computes: what you own minus what you owe (Net worth), what is left each month
 * after federal tax, spending and saving (Next best action's `spare`), how many months of must-pay bills the cash
 * covers (Emergency fund's `runwayMonths`), and whether retirement is on track (Will the money last?, only once Social
 * Security is known, so a missing figure never reads as "short"). Then the first three moves: Next best action's most
 * urgent step, a guide for what you said matters most, then its next steps, in its own order ("your choice" left out).
 */
export function standing(plan, { today }) {
  const nw = computeNetWorth(plan, { today });
  let nba = null, liq = null, proj = null;
  try { nba = computeNext(plan, { today }); } catch { nba = null; }
  try { liq = computeLiquidity(plan, { today }); } catch { liq = null; }
  const known = retirementKnown(plan);
  if (known) { try { proj = computeProjection(plan, { today }); } catch { proj = null; } }
  const spare = nba?.ready ? nba.spare.monthly : null;
  const runway = liq && liq.expenses && liq.expenses.essentialMonthly > 0 ? liq.runwayMonths : null;
  const retire = proj?.ready ? { verdict: proj.verdict, shortAge: proj.shortAge ?? null } : null;
  const open = (nba?.ready ? nba.steps : []).filter((s) => s.status !== "done" && s.status !== "skip" && s.id !== "rest").map((s) => ({ id: s.id, title: s.title, detail: s.detail ?? s.why ?? null, href: `#/${s.go.join("/")}` }));
  const focus = [...(setupOf(plan).focus ?? []), ...(picks(plan, "goals").includes("home") ? ["home"] : [])];
  const debtStep = open.slice(0, 1).some((m) => m.id === "high-debt" || m.id === "mid-debt");   // the debt guide would repeat it
  const guides = focus.filter((f, i) => FOCUS_GUIDE[f] && focus.indexOf(f) === i && !(f === "debt" && debtStep)).map((f) => ({ id: `guide-${f}`, title: FOCUS_GUIDE[f].title, detail: null, href: FOCUS_GUIDE[f].href }));
  const moves = [...open.slice(0, 1), ...guides, ...open.slice(1)].slice(0, 3);
  // what was left out, so the person knows what a figure is missing
  const later = [];
  if (!L(plan, "income").length) later.push({ label: "what comes in", href: "#/cashflow/income" });
  if (!L(plan, "expenses").length && !L(plan, "transactions").length) later.push({ label: "what you spend", href: "#/cashflow/expenses" });
  if (!L(plan, "accounts").length) later.push({ label: "your accounts", href: "#/balance/net-worth" });
  if (!known && adults(plan).length) later.push({ label: "Social Security and birth dates, for the retirement check", href: "#/retirement/social-security" });
  if (L(plan, "income").length && !NO_WAGE_TAX[plan?.household?.state]) later.push({ label: "state income tax (the left-over figure counts federal tax only)", href: "#/taxes/state" });
  const guessed = L(plan, "debts").filter((d) => rateIsGuess(d)).map((d) => ({ name: byId(L(plan, "accounts"), d.accountId)?.name ?? "A debt", rate: d.rate }));
  // one sentence that says what matters most
  const headline = spare !== null && spare < 0 ? "More goes out than comes in each month. That's the first thing to fix, and the moves below start there."
    : runway !== null && runway < 1 ? "Your month works. A cushion for surprises is the thing to build next."
      : retire && retire.verdict !== "on track" ? "Your month and your cushion look good. Retirement could use a closer look."
        : spare !== null && runway !== null ? "You're in good shape. Here's how to make it even better."
          : "Here is your money on one page. A few more answers will sharpen it.";
  return {
    netWorth: nw.netWorth, assets: nw.assets, liabilities: nw.liabilities,
    spare, runway, runwayTarget: liq?.targetMonths ?? null, runwayStatus: liq?.status ?? "unknown",
    retire, retirementKnown: known, moves, later, headline, guessed,
  };
}

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

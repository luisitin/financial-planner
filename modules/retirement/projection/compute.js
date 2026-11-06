// modules/retirement/projection/compute.js -- PURE. Turns the plan into the engine's inputs
// (people, buckets, contributions, guaranteed income, spending, rates) and runs the expected-
// return projection. Every other retirement page starts from buildInputs() so they all agree.
import { isGuess, clearGuess } from "../../../core/estimate/index.js";
import { project, affordableSpending, STRATEGIES } from "../../../core/math/retirement.js";
import { rmdStartAge, RMD_ACCOUNT_TYPES } from "../../../core/math/rmd.js";
import { ACCOUNT_TYPES, countedBalance } from "../../balance/net-worth/compute.js";
import { compute as computeExpenses } from "../../cashflow/expenses/compute.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeSocialSecurity } from "../social-security/compute.js";
import { perYear } from "../../../core/math/periods.js";
import { nper } from "../../../core/math/finance.js";
import { ageOn } from "../../../core/math/dates.js";
import { paramsFor } from "../../../core/math/tax.js";
import { FEDERAL } from "../../taxes/federal/data/federal.js";
// health cover (marketplace to 65, Medicare from 65): both pages run the plan through buildInputs({ health: false }) for its
// income, so this import cycle is calls inside functions only, never at load
import { compute as computeHealthcare } from "../healthcare/compute.js";
import { compute as computeMedicare, planIncome } from "../medicare/compute.js";
// a person inside a sentence: "you", "your spouse" or the name as typed (Get started names the first adult "Me")
import { isYou, nameIn, nameOf, verbFor, namesIn, NamesIn } from "../../../core/words.js";

/** The withdrawal orders a plan can choose (after cash, which always goes first). */
export const WITHDRAWAL_ORDERS = {
  "taxable-first": { label: "Taxable, then pre-tax, then Roth", order: ["taxable", "deferred", "free"], note: "the textbook order: let tax-sheltered money grow longest" },
  "deferred-first": { label: "Pre-tax, then taxable, then Roth", order: ["deferred", "taxable", "free"], note: "drains the 401(k) early, in low-tax years, before required withdrawals" },
  "roth-last-taxable": { label: "Pre-tax, then Roth, then taxable", order: ["deferred", "free", "taxable"], note: "keeps taxable money (and its step-up at death) for last" },
  "roth-first": { label: "Roth, then taxable, then pre-tax", order: ["free", "taxable", "deferred"], note: "the usual worst: spends the tax-free money first" },
};
export const orderKey = (order) => Object.keys(WITHDRAWAL_ORDERS).find((k) => WITHDRAWAL_ORDERS[k].order.join() === (order ?? []).join()) ?? "custom";

/** Which engine bucket an account type feeds. Property, vehicles and 529s are not retirement money. */
export const BUCKET_OF = { checking: "cash", savings: "cash", cash: "cash", brokerage: "taxable", crypto: "taxable", "401k": "deferred", ira: "deferred", cash_value_life: "deferred", roth: "free", hsa: "free" };

/** The engine's tax settings from the plan: the flat rate, or the federal brackets with the household's filing status and the plan's inflation indexing the tables. */
export function taxSettings(plan, overrides = {}) {
  const rt = plan.retirement ?? {};
  const mode = overrides.mode ?? rt.taxMode ?? "flat";
  if (mode !== "brackets") return { mode: "flat" };
  const inflation = Number(plan.assumptions?.inflation ?? 0.03);
  const filingStatus = FEDERAL[Math.max(...Object.keys(FEDERAL).map(Number))].status[plan.household?.filingStatus] ? plan.household.filingStatus : "single";
  const cache = new Map();
  return { mode: "brackets", filingStatus, paramsFor: (y) => { if (!cache.has(y)) cache.set(y, paramsFor(FEDERAL, y, { inflation })); return cache.get(y); }, gainShare: Number(rt.gainShare ?? 0.5), dividendYield: Number(rt.dividendYield ?? 0.02), itemized: 0 };
}

/**
 * Pensions typed on the Income page (type "pension"), as engine incomes. One already being paid
 * (no start date, or one in the past) counts from now, as the Income page counts it; a future one
 * from the age its owner reaches in the start year; an end date stops it after that year's age.
 * A rise typed on the item means it keeps up with inflation (cola). One-off pension payments,
 * ended items and items that repeat a `retirement.pensions` entry (same person, and the same name
 * or the same monthly amount within a dollar) are left out.
 * incomePensions(plan, people, pensions, today) -> [{ name, yearly, personId, startAge, endAge?, cola, taxable, source: "income" }]
 */
export function incomePensions(plan, people, pensions, today) {
  const out = [];
  if (!people.length) return out;
  const nowYear = Number(String(today).slice(0, 4));
  for (const x of plan.income ?? []) {
    if (x.type !== "pension" || x.period === "once") continue;
    const yearly = perYear(x.amount, x.period);
    if (!(yearly > 0)) continue;
    if (x.endDate && String(x.endDate) < String(today)) continue;
    const who = people.find((p) => p.id === x.personId) ?? people[0];
    const name = String(x.name || "Pension").trim();
    const dup = pensions.some((pn) => (pn.personId || people[0].id) === who.id && (String(pn.name ?? "").trim().toLowerCase() === name.toLowerCase() || Math.abs(Number(pn.monthly) * 12 - yearly) < 12));
    if (dup) continue;
    const startYear = x.startDate && String(x.startDate) > String(today) ? Number(String(x.startDate).slice(0, 4)) : nowYear;
    const endAge = x.endDate ? Number(String(x.endDate).slice(0, 4)) - who.birthYear : undefined;
    out.push({ name, yearly, personId: who.id, startAge: startYear - who.birthYear, endAge, cola: Number(x.growth) > 0, taxable: x.taxable !== false, type: "pension", source: "income" });
  }
  return out;
}

/**
 * Social Security already being paid, typed on the Income page (type "social"), for an adult with no figure or record
 * on the Social Security page: counted from now (or its start date), rising with inflation, so a retiree who typed it
 * there is not told "Social Security is not counted yet". A Social Security page figure wins, so nothing counts twice.
 * incomeSocial(plan, people, ssPeople, today) -> [{ name, yearly, personId, startAge, cola, taxable, kind: "social", source: "income", startsOn? }]
 * startsOn: the line's own start date, only when it is after today (it starts this calendar year in the plan, but is not
 * paid yet: recheck 2026-11-05, a line from next month read "already being paid").
 */
export function incomeSocial(plan, people, ssPeople, today) {
  const out = [];
  if (!people.length) return out;
  const nowYear = Number(String(today).slice(0, 4));
  for (const x of plan.income ?? []) {
    if (x.type !== "social" || x.period === "once") continue;
    const yearly = perYear(x.amount, x.period);
    if (!(yearly > 0)) continue;
    if (x.endDate && String(x.endDate) < String(today)) continue;
    const who = people.find((p) => p.id === x.personId) ?? people[0];
    if ((ssPeople ?? []).some((q) => q.id === who.id && q.yearly > 0)) continue;
    const later = x.startDate && String(x.startDate) > String(today);
    const startYear = later ? Number(String(x.startDate).slice(0, 4)) : nowYear;
    out.push({ name: String(x.name || `${nameOf(who.name)} Social Security`).trim(), yearly, personId: who.id, startAge: startYear - who.birthYear, cola: true, taxable: x.taxable !== false, kind: "social", source: "income", ...(later ? { startsOn: String(x.startDate) } : {}) });
  }
  return out;
}

/** The Income page's kinds of pay (a job: salary, bonus; or a business): they stop when that person stops work. Rent,
 * dividends, pensions, Social Security and other income are not pay, so they never make anyone "work" (workRule). */
export const PAY_TYPES = ["salary", "bonus", "business"];
/** Income that is neither pay, a pension nor Social Security (rent, dividends and interest, support, other). */
export const OTHER_INCOME_TYPES = ["rental", "investment", "support", "other"];
/** Child support with no end date runs to the year the child turns this age (most US states end it at 18). */
export const CHILD_SUPPORT_UNTIL = 18;
const KNOWN_TYPES = [...PAY_TYPES, "pension", "social", ...OTHER_INCOME_TYPES];
const CHILD_WORDS = /\b(child|children|kids?)\b/i;
const yearOf = (d) => Number(String(d).slice(0, 4));

/**
 * ownAccountMoney(name) -> true when an income's name says it is money taken out of the household's own accounts (an IRA,
 * a 401(k), 403(b), 457(b) or TSP, a Roth, a required minimum distribution, or withdrawals or draws from savings, a brokerage
 * or a portfolio). The plan already draws on those accounts (Net worth), so such a line is never added on top (recheck
 * 2026-11-05: H-0796's "IRA withdrawals" with an end date counted the IRA twice: $85,416 a year became $106,606). "IRA",
 * "RMD", "TSP" and "HSA" are matched in capitals only, so "Help from Ira" is not one; a trust's or an annuity's payout is not
 * one either (it is money from outside the plan's accounts). Review 2026-11-06: 401(k), 403(b) and 457(b) only as the plans
 * ("Unit 401B", "457 Elm St" are not), "Roth" only next to an account or a withdrawal word ("Grandma Roth" is not), and a
 * draw from a business or against pay is not one. Rent is never checked (otherIncome).
 */
const BUSINESS_SOURCE = /\bowner['’]?s\b|\bcommissions?\b|\bbonus(es)?\b|\bpartnership\b|\bLLC\b/i;
const FROM_BUSINESS = /\bfrom\s+(?:the\s+|my\s+|our\s+|a\s+)?(?:business|company|firm)\b(?!\s+stock)/i;
const OWN_WORD = /\b(brokerage|savings|investments?|portfolio|nest egg|stock)\b/i;
export function ownAccountMoney(name) {
  const n = String(name ?? "");
  if (/\btrust\b|\bannuit/i.test(n)) return false;
  // 401(k), 403(b) and 457(b) only as the plans ("Unit 401B" is a flat, "457 Elm St" a house), and "Roth" only next to an account
  // or a withdrawal word ("Help from Grandma Roth" is a person): review 2026-11-06
  const ROTH = /\broth\b[\s\S]*\b(ira|401|403|457|accounts?|withdrawals?|distributions?|conversions?|draws?)\b|\b(withdrawals?|distributions?|draws?)\b[\s\S]*\broth\b/i;
  if (/\b(IRA|RMD|TSP|HSA)s?\b/.test(n) || /\b401\s*\(?\s*k\b|\b403\s*\(?\s*b\b|\b457\s*(\(b\)|b\b|plan\b)|required minimum/i.test(n) || ROTH.test(n)) return true;
  // draws from a business or against pay are not the household's savings ("Owner's draw from business account", "Account
  // manager bonus draws": review 2026-11-06), but only when the business is the source (seventh pass, fire-ver8b: "Withdrawals
  // from my brokerage firm account", "Draws from company stock account", "Savings account draws for the business" and
  // "Withdrawals from the investment firm" are the household's own accounts, and were counted on top of them): an owner's
  // draw, a commission, a bonus, a partnership or an LLC; money "from the business / company / firm" (not company stock); or a
  // business word with no word for the household's own account (brokerage, savings, investments, a portfolio, stock)
  if (BUSINESS_SOURCE.test(n) || FROM_BUSINESS.test(n) || (/\b(business|company|firm)\b/i.test(n) && !OWN_WORD.test(n))) return false;
  return /\b(withdrawals?|draws?|drawdowns?)\b[\s\S]*\b(savings|brokerage|portfolio|investments?|accounts?|nest egg)\b|\b(savings|brokerage|portfolio|investments?|accounts?|nest egg)\b[\s\S]*\b(withdrawals?|draws?|drawdowns?)\b/i.test(n);
}

/**
 * Rent, dividends and interest, support and other income typed on the Income page (anyone's, or the household's, which
 * belongs to the first adult), after work stops (recheck 2026-11-05: round 5 counted all of it for the rest of the plan):
 * - rent (`rental`): counted from the household's first retirement year (or its own later start date) for life, or to its
 *   end date. Gross: the rental's own costs (tax, insurance, repairs) are not taken off.
 * - support and other: counted after work only up to an end date they carry. Without one they stop when their owner stops
 *   work (a partner who works on after the household retires keeps it until then, as inside their pay before round 5;
 *   the first adult's and the household's stop at the household's retirement), and are listed in `left` (why "work").
 *   Child support with no end date ends instead in the year the child it names, else the youngest dependent with a birth
 *   date, turns 18; with no such dependent it is like any other support. Child support is a name with "support" and "child",
 *   "children", "kid(s)" or a dependent's first name ("Support for Leo"), or a support line with one of those words (recheck
 *   2026-11-05: "Children's book royalties" typed as other was counted to a grandchild's 18th).
 * - withdrawals from the household's own accounts typed as support or other (ownAccountMoney: "IRA withdrawals", "RMD"):
 *   never, end date or not, as the plan already draws on those accounts; listed in `left` (why "accounts"). Rent is not
 *   checked, whatever its name ("Rent from condo 401B": review 2026-11-06).
 * - dividends and interest (`investment`): never, the accounts' own growth already holds them; listed in `left` (why "growth").
 * Each rises with inflation when the item has a raise (cola, as pensions), taxed unless marked untaxed. One-off and ended items
 * are left out, and so is an item that ends before retirement. An unknown type is "other", as on the Income page.
 * Review 2026-11-06: `works` (workRule) is the one rule for who stops work: support and other with no end date of an owner Get
 * started says is retired or not working, and the first adult's, never count from the household's retirement on.
 * otherIncome(plan, people, retireYear, today, works?) -> {
 *   counted: [{ name, yearly, personId, startAge (its owner's age in the year it starts), endAge?, cola, taxable, type, source: "income", whileWorking? }],
 *   left: [{ name, yearly, type, personId, why: "work" | "growth" | "accounts" }]
 * }
 */
export function otherIncome(plan, people, retireYear, today, works = null) {
  const counted = [], left = [];
  if (!people.length) return { counted, left };
  const deps = (plan.household?.people ?? []).filter((p) => p.role === "dependent" && /^\d{4}/.test(String(p.birthDate ?? "")));
  // the child a "Child support for Zoe" line names, else every dependent; the youngest of them
  const wordsOf = (name) => String(name).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const namesDep = (name) => { const words = wordsOf(name); return deps.filter((d) => words.includes(String(d.name ?? "").trim().split(/\s+/)[0].toLowerCase())); };
  const childSupport = (name, type) => (/\bsupport\b/i.test(name) && (CHILD_WORDS.test(name) || namesDep(name).length > 0)) || (type === "support" && CHILD_WORDS.test(name));
  const childEnd = (name) => {
    const named = namesDep(name);
    const pool = named.length ? named : deps;
    return pool.length ? Math.max(...pool.map((d) => yearOf(d.birthDate))) + CHILD_SUPPORT_UNTIL : null;
  };
  for (const x of plan.income ?? []) {
    const type = KNOWN_TYPES.includes(x.type) ? x.type : "other";
    if (!OTHER_INCOME_TYPES.includes(type) || x.period === "once") continue;
    const yearly = perYear(x.amount, x.period);
    if (!(yearly > 0)) continue;
    if (x.endDate && String(x.endDate) < String(today)) continue;
    const who = people.find((p) => p.id === x.personId) ?? people[0];
    const name = String(x.name || "Other income").trim();
    if (type === "investment") { left.push({ name, yearly, type, personId: who.id, why: "growth" }); continue; }
    // rent is never money out of the household's own accounts, whatever its name ("Rent from condo 401B", "457 Elm St duplex":
    // review 2026-11-06, the name check dropped it and said it came out of the accounts)
    if (type !== "rental" && ownAccountMoney(name)) { left.push({ name, yearly, type, personId: who.id, why: "accounts" }); continue; }
    const from = Math.max(retireYear, x.startDate && String(x.startDate) > String(today) ? yearOf(x.startDate) : retireYear);
    let until = x.endDate ? yearOf(x.endDate) : null, whileWorking = false;
    if (until === null && type !== "rental") {
      const kid = childSupport(name, type) ? childEnd(name) : null;
      if (kid !== null) until = kid;
      else {
        // the first adult's (and the household's) stop at the household's retirement, which can now come before their own
        // retirement age (householdRetireYear); one Get started says has stopped work has none after it (review 2026-11-06)
        const own = who.birthYear + who.retireAge - 1;
        until = who.id === people[0].id || works?.status(who) === "stopped" ? Math.min(own, retireYear - 1) : own;
        whileWorking = true; left.push({ name, yearly, type, personId: who.id, why: "work" });
      }
    }
    if (until !== null && until < from) continue;
    counted.push({ name, yearly, personId: who.id, startAge: from - who.birthYear, endAge: until === null ? undefined : until - who.birthYear, cola: Number(x.growth) > 0, taxable: x.taxable !== false, type, source: "income", ...(whileWorking ? { whileWorking: true } : {}) });
  }
  return { counted, left };
}

/** The engine incomes otherIncome() counts (round 5's name, kept for its callers). */
export const incomeOther = (plan, people, retireYear, today) => otherIncome(plan, people, retireYear, today).counted;

/** An adult whose Social Security is on the Income page (type "social", recurring, not ended). */
export const ssOnIncome = (plan, id, today) => (plan?.income ?? []).some((x) => x.type === "social" && x.personId === id && x.period !== "once" && Number(x.amount) > 0 && !(x.endDate && today && String(x.endDate) < String(today)));

/**
 * Each adult's share of the pre-tax bucket that has required withdrawals, with their own start age: their own
 * 401(k)s and IRAs (an account with no owner belongs to the first person). Life-insurance cash value sits in
 * the same bucket but belongs to no owner, so it has none.
 */
export function rmdOwners(plan, people, adults, deferredTotal) {
  return people.map((p, i) => {
    const own = (plan.accounts ?? []).filter((a) => RMD_ACCOUNT_TYPES.includes(a.type) && (a.ownerId === p.id || (i === 0 && !people.some((q) => q.id === a.ownerId))));
    const held = own.reduce((s, a) => s + countedBalance(a), 0);
    return { personIndex: i, share: deferredTotal > 0 ? held / deferredTotal : (i === 0 ? 1 : 0), startAge: rmdStartAge(adults.find((a) => a.id === p.id)?.birthDate ?? p.birthYear) };
  });
}

/** An Expenses line's name that pays for Medicare: Part B, a drug plan (Part D), a supplement (Medigap). */
export const MEDICARE_LINE = /medicare|medigap|part\s*b\b|part\s*d\b/i;
const NOT_COVER = /dental|vision|\beye|life|disabil|long[- ]?term|\bltc\b|\bpet|accident|indemnity|\bcar\b|\bauto|home|renter|umbrella/i;
/** A name that joins two things ("Insurance and health", "Health & medicine", "Premiums, medicine"). */
const JOINED = /\band\b|&|\+|,|\//i;
/**
 * What an Expenses line is for health cover: "medicare" (its name says Medicare, Medigap, Part B or Part D), "cover" (a premium
 * for cover bought before Medicare and nothing else: health or medical insurance, a health plan, the marketplace, COBRA; or an
 * insurance or premium line under "Health and medical"), "mixed" (cover held with other things: Get started's own
 * "Insurance and health" row, `setup-x-insurance`, "premiums you pay yourself, medicine", or a name that joins health cover
 * to something else), or null (care itself, dental, vision, life and other insurance, everything else).
 */
export function healthLine(x) {
  const name = String(x?.name ?? "");
  if (MEDICARE_LINE.test(name)) return "medicare";
  if (x?.id === "setup-x-insurance") return "mixed";
  if (NOT_COVER.test(name)) return null;
  const says = /\b(marketplace|cobra|obamacare|aca)\b/i.test(name) || (/\b(health|medical)\b/i.test(name) && /\b(insurance|cover|coverage|plan|premiums?)\b/i.test(name)) || (x?.category === "health" && /\b(insurance|premiums?)\b/i.test(name));
  if (!says) return null;
  return JOINED.test(name) ? "mixed" : "cover";
}

/**
 * Get started's own starting figure for retirement spending, a month, to $10: setup's `retireDefault` (overview/setup/
 * compute.js), worked out here from the same parts so the retirement pages do not load Get started's page graph (it reaches
 * back into this one through Next best action and Life cover, and a module in that loop reads another's constant at load).
 * module.test.mjs checks the two agree. Today's bills without loan payments and childcare (setup's `spendBase` core, every
 * line whatever its dates, plus the setup's own rows but childcare), plus each loan still being paid when the first adult
 * stops work (months to payoff at its payment, `nper`, past the months until then; none when a bill on Expenses is a loan
 * payment, or without birth dates).
 */
export function setupFigure(plan, today = null) {
  const L = (k) => (Array.isArray(plan?.[k]) ? plan[k] : []);
  const isSetup = (id) => typeof id === "string" && id.startsWith("setup-");
  const own = L("expenses").filter((x) => !isSetup(x.id));
  const ex = own.length ? computeExpenses({ ...plan, expenses: own, debts: [] }, {}) : null;
  const cat = (k) => ex?.byCategory.find((c) => c.category === k)?.monthly ?? 0;
  const core = (ex?.monthly ?? 0) - cat("debt") - cat("childcare");
  const rows = L("expenses").filter((x) => isSetup(x.id) && x.category !== "childcare").reduce((t, x) => t + perYear(x.amount, x.period) / 12, 0);
  const planAge = Number(plan?.assumptions?.retirementAge ?? 65), status = plan?.guide?.setup?.status ?? {};
  const people = Array.isArray(plan?.household?.people) ? plan.household.people : [];
  const left = today ? people.filter((p) => p.role !== "dependent" && p.birthDate && status[p.id] !== "retired").map((p) => Math.max(0, ((p.retirementAge ?? planAge) - ageOn(p.birthDate, today)) * 12)) : [];
  const until = left.length ? Math.min(...left) : null;
  let loans = 0;
  if (until !== null && !L("expenses").some((x) => x.category === "debt")) {
    for (const d of L("debts")) {
      const owed = Math.abs(Number(L("accounts").find((a) => a.id === d.accountId)?.balance) || 0), pay = Number(d.minPayment) || 0;
      if (!(owed > 0) || !(pay > 0)) continue;
      const months = nper((Number(d.rate) || 0) / 12, pay, owed);
      if (!Number.isFinite(months) || months > until) loans += pay;
    }
  }
  return Math.round((core + rows + loans) / 10) * 10;
}

/**
 * Who works in a year: one rule for the health line and Healthcare before 65 (review 2026-11-02, it was "under the retirement
 * age", so a partner with no job counted as working and the retired one's Medicare was left to a job nobody has), and since
 * review 2026-11-06 for the household's retirement year, Financial independence and Goal seek too (`workingNow`): the
 * pages had three rules, and Financial independence asked "when can Bo retire" about a partner the health line priced as not
 * working, whose age moves nothing in the plan. Someone works while they are alive and under their retirement age, and either:
 * - said "work" in Get started (`guide.setup.status`: working, even with no pay on Income yet), or
 * - said nothing there and have pay: a salary, bonus or business line on the Income page that is theirs (a line with no owner
 *   is the first adult's; a child's, or another household member's, never counts), or a retirement contribution of theirs on
 *   Contributions (one that names nobody in the plan is the first adult's, as the engine adds it), Financial independence's
 *   rule since recheck 2026-11-05 ("the retired couple's Sam has neither"; "a contribution alone also counts"): one to a plan
 *   at work (a 401(k) account, or any with an employer match) always, any other (an IRA, a Roth, an HSA, a brokerage) only
 *   when nobody else in the plan has pay, which could fund it (a spousal IRA), or
 * - is the first adult with nothing said and no pay: presumed at work until the household retires (with `retireYear`, the
 *   household's, householdRetireYear: `.presumed(person, year)`), as the engine counts those years as working years (no
 *   spending, no withdrawals) and Financial independence asks about them while that year is ahead (recheck 2026-11-05, second
 *   pass: someone between jobs). Fifth pass (2026-11-02): the family with Ana's salary taken out has Bo on Ana's plan 2050-2052
 *   and Bo's Medicare 2053-2054 left to it, the health line $174,161 as with her salary.
 * "retired" or "none" (not working now) in Get started: not working, whatever Income or Contributions hold (the latest word;
 * Financial independence let pay or a contribution win, review 2026-11-06). Rent, dividends, pensions, Social Security and
 * other income never make anyone work, nor does the projection's "<name>'s pay" (fourth pass). A partner with no pay, no
 * contribution and no answer does not work (fifth pass), also in a plan with nothing on Income or Contributions at all
 * (review 2026-11-06: Financial independence went by age alone there, and asked about such a partner, whose age moves nothing
 * in the plan; defect 2 of the fifth pass's verify); their cover is the first adult's plan until the household retires.
 * Without `retireYear` nobody is presumed (the household's own retirement year is worked out from that).
 * workRule(plan, people, { today, retireYear }) -> (person, year) => boolean (people as buildInputs makes them), with
 * `.presumed(person, year)`, `.holds(person, year)` (the rule without the age and end-of-plan tests: Financial independence
 * tests the age by exact age today), `.hasPay(person)` (pay of their own on Income, which the engine can count) and
 * `.status(person)`: "work" (an answer, pay or a contribution), "stopped" ("retired" or "none") or "unknown"
 */
export function workRule(plan, people, { today = null, retireYear = null } = {}) {
  const said = plan?.guide?.setup?.status ?? {};
  const household = plan?.household?.people ?? [];
  // each adult's pay lines and the years each is paid (payYears; review 2026-11-06, seventh pass: it was the lines paid today,
  // so a job ending 2027-06-30 counted to the retirement age and a job starting in 2027 counted as no work)
  const ranges = new Map();
  for (const x of Array.isArray(plan?.income) ? plan.income : []) {
    if (!PAY_TYPES.includes(x.type)) continue;
    const yrs = payYears(x, today);
    if (!yrs) continue;
    // theirs; someone else in the household (a child, an adult with no birth date) never makes another adult work; no owner (or one gone): the first adult
    const owner = people.some((p) => p.id === x.personId) ? x.personId : household.some((q) => q.id && q.id === x.personId) ? null : people[0]?.id;
    if (owner) ranges.set(owner, [...(ranges.get(owner) ?? []), { ...yrs, yearly: perYear(x.amount, x.period) }]);
  }
  const paid = new Set(ranges.keys());
  // paid in a year by one of their pay lines (a line paid today, or one that starts later: a job that starts next year)
  const payIn = (p, year) => (ranges.get(p.id) ?? []).some((r) => year >= r.from && year <= r.until);
  // a retirement contribution still going in, theirs (one that names nobody in the plan is the first adult's, as buildInputs adds
  // it): one to a plan at work (a 401(k) or 403(b) account, or any with an employer match) is that person's work; any other (an
  // IRA, a Roth, an HSA, a brokerage) only when nobody else in the plan has pay, since a husband's or wife's pay can fund it (a
  // spousal IRA: the fourth pass's Lee, salary taken out and IRA saving kept, does not work while Sam does)
  const payOwners = [...paid];
  // (paid this year: a job that starts later funds nothing yet; seventh pass)
  const nowYear = today ? yearOf(today) : null;
  const payNow = payOwners.filter((id) => nowYear === null || ranges.get(id).some((r) => nowYear >= r.from && nowYear <= r.until));
  for (const c of plan?.retirement?.contributions ?? []) {
    if (!(perYear(c.amount, c.period) + (Number(c.employerMatch) || 0) > 0)) continue;
    const owner = people.some((p) => p.id === c.personId) ? c.personId : people[0]?.id;
    if (!owner) continue;
    const atWork = (plan.accounts ?? []).find((x) => x.id === c.accountId)?.type === "401k" || Number(c.employerMatch) > 0;
    if (atWork || !payNow.some((id) => id !== owner)) paid.add(owner);
  }
  const status = (p) => (said[p.id] === "retired" || said[p.id] === "none" ? "stopped" : said[p.id] === "work" || paid.has(p.id) ? "work" : "unknown");
  // at work in a year by what the plan holds: someone with pay lines in the years a line is paid (seventh pass), anyone else by
  // a "work" answer or a contribution (no dates: until their retirement age)
  const own = (p, year) => status(p) !== "stopped" && (ranges.has(p.id) ? payIn(p, year) : status(p) === "work");
  // only the first adult: their retirement year is the household's, so the household is at work until then (with nothing said
  // and no pay; seventh pass: also a year between their pay lines, a job that ends or one that starts later); a partner with no
  // pay and no answer is covered by that plan in those years (no marketplace is priced while anyone works) without working
  const presumed = (p, year) => retireYear !== null && p.id === people[0]?.id && status(p) !== "stopped" && !own(p, year) && year < retireYear && year - p.birthYear <= p.endAge;
  const holds = (p, year) => own(p, year) || presumed(p, year);
  const rule = (p, year) => {
    const age = year - p.birthYear;
    if (age > p.endAge) return false;
    return holds(p, year) && age < p.retireAge;
  };
  rule.presumed = presumed;
  rule.holds = holds;
  rule.status = status;
  rule.hasPay = (p) => payOwners.includes(p.id);
  // pay lines on Income, with the years each is paid ([{ from, until, yearly }]; the page says a gap between them), and the pay
  // of a year (the lines paid that year)
  rule.said = (p) => said[p.id] ?? null;
  rule.payLines = (p) => ranges.get(p.id) ?? [];
  rule.payOf = (p, year) => (ranges.get(p.id) ?? []).filter((r) => year >= r.from && year <= r.until).reduce((s, r) => s + r.yearly, 0);
  return rule;
}

/**
 * The calendar years a pay line on Income is counted in (review 2026-11-06, seventh pass): this year when it is paid today, a
 * later year when it is paid for more than half of it (so a line split by a raise from a later date never counts one year
 * twice, and a job ending on 2027-06-30 counts to 2026), and for good with no end date. A one-off, a line with no amount and a
 * line that has ended are not counted. Without `today` every line is taken as paid now.
 * payYears(line, today) -> { from, until (Infinity: no end) } | null
 */
export function payYears(x, today = null) {
  if (!x || x.period === "once" || !(perYear(x.amount, x.period) > 0)) return null;
  const t = today ? String(today).slice(0, 10) : null;
  if (t && x.endDate && String(x.endDate) < t) return null;
  const days = (y) => (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0) ? 366 : 365);
  const dayOf = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 864e5) + 1; };
  const now = t ? yearOf(t) : null;
  const later = !!(x.startDate && (!t || String(x.startDate) > t) && /^\d{4}-\d{2}-\d{2}/.test(String(x.startDate)));
  let from = now ?? -Infinity;
  if (later) { const s = String(x.startDate), y = yearOf(s); from = days(y) - dayOf(s) + 1 > days(y) / 2 ? y : y + 1; }
  let until = Infinity;
  if (x.endDate && /^\d{4}-\d{2}-\d{2}/.test(String(x.endDate))) {
    const e = String(x.endDate), y = yearOf(e);
    // paid today and ending this year: this year counts (the plan's first year is this one)
    until = !later && y === now ? now : dayOf(e) > days(y) / 2 ? y : y - 1;
  }
  return from > until ? null : { from, until };
}

/**
 * The household's retirement year (fifth pass, 2026-11-02): the first year of spending and withdrawals in the engine. The first
 * adult's own retirement year, as before, while they work or nothing says otherwise (no pay and no Get started answer: presumed
 * to work to their retirement age). When Get started says the first adult is retired or not working now, they no longer hold
 * the household at work: it is the year the last adult who works today stops, or this year when nobody works (it was the
 * first adult's retirement age whatever they said, so Ana "not working now" with Bo stopping at 62 left 2050-2054 with no
 * spending and no income, the marketplace priced on an income of $0, "under the poverty line").
 * Review 2026-11-06 (defect 1 of the fifth pass's verify): never later than the first adult's own year (or this year, when that
 * has passed). A partner who works on after it brings their pay in as income ("<name>'s pay"), as with no answer; it let a
 * part-time partner's job hold the whole household at work: the 68/63 couple with Ana (68, past her 60) saying "retired" and
 * Bo working to 66 for $1,500 a month read 2026-2028 as working years (no spending, nothing drawn, Ana's Social Security
 * dropped) and "Runs out in 2054", where the same plan with no answer read "Runs out in 2041".
 * Review 2026-11-06, seventh pass (follow-up 3 of the sixth pass's verify): a partner who works with pay on Income no longer
 * holds the household at work either: retirement starts this year, and their pay comes in as income ("<name>'s pay") to
 * their own stop, as Financial independence already searched it (stopNow). Rae, 62, "not working now" with 67 on file and Jo
 * part-time ($26,400 to 66) read "on track" with nothing drawn until 2030; with Rae's age set to 62 it read "tight". Only a
 * partner who works by a Get started answer or a contribution alone, whose pay the plan cannot count, still holds it until
 * they stop (never later than the first adult's own year).
 * Review 2026-11-06, the seventh pass's verify (my choice, README "Not working now before 55"): that applies when the first
 * adult said "retired", is past their own retirement age, or said "not working now" at 55 or over (STOP_NOW_FROM_AGE). A parent
 * at home under 55 with a partner on pay is a one-earner family, not a retired one: the partner's work still holds the
 * household at work until the earlier of the first adult's own year and the partner's stop, as before the seventh pass. Starting
 * retirement now for Elena (35, "not working now", Marcus on $90,000) moved the savings to the retired mix for 28 years and drew
 * the tax on Marcus's pay from savings: short in 2062 instead of 2072.
 * householdRetireYear(plan, people, year, works = workRule(...)) -> year
 */
export const STOP_NOW_FROM_AGE = 55;
export function householdRetireYear(plan, people, year, works = null) {
  if (!people.length) return year;
  const first = people[0];
  const own = Math.max(year, first.birthYear + first.retireAge);
  const w = works ?? workRule(plan, people, { today: `${year}-01-01` });
  if (w.status(first) !== "stopped") return own;
  const stop = (p) => Math.min(p.birthYear + p.retireAge, p.birthYear + p.endAge + 1);
  const atHome = w.said?.(first) === "none" && year - first.birthYear < STOP_NOW_FROM_AGE && own > year;
  const holding = people.filter((p) => p !== first && w(p, year) && (atHome || !w.hasPay(p)));
  return holding.length ? Math.max(year, Math.min(own, Math.max(...holding.map(stop)))) : year;
}

/**
 * Who starts the household's retirement (fifth pass; review 2026-11-06): the first adult while they work or nothing says
 * otherwise, and also when the year is their own (it is capped there: householdRetireYear), else the adult who works today and
 * stops in that year, or nobody when nobody works (retirement starts this year).
 * retireStarter(people, year, retireYear, works) -> { id, name, age, first } | { id: null, name: null, age: null, first: false, nobody: true }
 */
export function retireStarter(people, year, retireYear, works) {
  const first = people[0];
  const stop = (p) => Math.min(p.birthYear + p.retireAge, p.birthYear + p.endAge + 1);
  const working = people.filter((p) => p !== first && works(p, year));
  // seventh pass: the first adult has stopped and retirement starts this year while partners with pay work on (their pay is
  // income): the first adult starts it, `stopped`, with those partners and the last year each is paid (`untilYear`)
  const paidOn = works.status(first) === "stopped" && retireYear === year ? working.filter((p) => works.hasPay(p)) : [];
  if (paidOn.length) return { id: first.id, name: first.name, age: year - first.birthYear, first: true, stopped: true, notWorking: works.said?.(first) === "none", working: paidOn.map((p) => ({ id: p.id, name: p.name, stopAge: stop(p) - p.birthYear, untilYear: Math.min(stop(p) - 1, Math.max(...works.payLines(p).map((r) => r.until))) })) };
  const by = works.status(first) !== "stopped" || (working.length && retireYear === Math.max(year, first.birthYear + first.retireAge)) ? first
    : working.find((p) => Math.max(year, stop(p)) === retireYear) ?? working.sort((x, y) => stop(y) - stop(x))[0] ?? null;
  return by ? { id: by.id, name: by.name, age: retireYear - by.birthYear, first: by === first } : { id: null, name: null, age: null, first: false, nobody: true };
}

/**
 * Who still works today, for the questions about an age to stop work (review 2026-11-06: Financial independence and Goal seek's
 * "When ... can retire" lever, on the one work rule above): an adult under their retirement age by exact age today
 * (`underAge`; someone turning that age later this year still works) whom the work rule has at work this year (`holds`).
 * The question is about the first adult while they still work, else the first other adult who does (`lead`), else nobody
 * (everyone has stopped: there is no age to find). When it is about a partner while the first adult has stopped before the
 * age on file, the partner's age is searched with the first adult stopping now (`stopNow`, withStops: Financial independence's
 * rule since recheck 2026-11-05, second pass; Goal seek searches the same plan, so both give one age), the partner's pay coming
 * in as "<name>'s pay"; only when that pay is on Income: a partner who works by a Get started answer or a contribution alone
 * has no pay the plan can count, so their age is searched on the plan as it is, where the household's retirement year moves
 * with their stop (householdRetireYear; review 2026-11-06: with the first adult stopping now it moved only their saving).
 * workingNow(plan, inputs, today) -> { ageNow(p), underAge(p), holds(p), stillWorks(p), status(p), lead (an engine person or null), stopNow: [{ personId, age }], payLines(p) (workRule's) }
 */
export function workingNow(plan, I, today) {
  const birth = Object.fromEntries((plan?.household?.people ?? []).map((p) => [p.id, p.birthDate]));
  const W = workRule(plan, I.people, { today, retireYear: I.retireYear });
  const ageNow = (q) => ageOn(birth[q.id], today) ?? I.startYear - q.birthYear;
  const underAge = (q) => ageNow(q) < q.retireAge;
  const holds = (q) => W.holds(q, I.startYear) && I.startYear - q.birthYear <= q.endAge;
  const stillWorks = (q) => underAge(q) && holds(q);
  const self = I.people[0];
  const working = I.people.filter(stillWorks);
  const lead = working.find((q) => q.id === self.id) ?? working[0] ?? null;
  const stopNow = lead && lead.id !== self.id && W.hasPay(lead) && underAge(self) && !holds(self) ? [{ personId: self.id, age: ageNow(self) }] : [];
  return { ageNow, underAge, holds, stillWorks, status: W.status, lead, stopNow, payLines: W.payLines };
}

/** withStops(plan, stopNow) -> the plan with each of those adults' retirement age set to the age given (their age today); the
 * plan itself when there are none (workingNow's and Financial independence's stopNow). */
export function withStops(plan, stopNow = []) {
  if (!stopNow?.length) return plan;
  const p2 = JSON.parse(JSON.stringify(plan));
  for (const s of stopNow) { const q = p2.household?.people?.find((x) => x.id === s.personId); if (q) q.retirementAge = s.age; }
  return p2;
}

/**
 * Who needs marketplace cover in a year, before 65 (fourth pass, 2026-11-02: the Healthcare page and the health line price the
 * same years): someone under 65 and alive in the plan who does not work (workRule, the household's presumption included) and
 * has stopped: Get started says retired or not working now (from today), or they are past their own retirement age, or the
 * household has retired (`retireYear`, the projection's). Someone who works is on a job's plan until their retirement year,
 * so with no Income lines and Get started saying both work there are no marketplace years before the household retires.
 * Whether a working partner's job covers them that year is the caller's (Healthcare's `onWorkPlan`), and so is the rule that
 * no year before the household's retirement is priced (the engine's working years). Fifth pass (2026-11-02): never after the
 * end of their plan (their `endAge`; Lee with a plan to 60 was priced cover at 63 and 64), and an adult with no pay and no
 * answer is presumed at work, so on a job's plan, until the household retires.
 * coverRule(plan, people, { today, retireYear }) -> (person, year) => boolean
 */
export function coverRule(plan, people, { today = null, retireYear = null } = {}) {
  const said = plan?.guide?.setup?.status ?? {};
  const works = workRule(plan, people, { today, retireYear });
  return (p, year) => {
    const age = year - p.birthYear;
    if (age >= 65 || age > p.endAge || works(p, year)) return false;
    return said[p.id] === "retired" || said[p.id] === "none" || age >= p.retireAge || (retireYear !== null && year >= retireYear);
  };
}

/**
 * The health lines among the bills carried into retirement, and whose Medicare they already pay (2026-11-02): `cover` lines
 * come out of the carried figure (the health line pays cover from retirement on); Medicare and mixed lines stay. A Medicare
 * line pays the Medicare of the adults 65 or over this year (a line for anyone else, a parent say, leaves the household's own
 * Medicare in, and it is never a younger adult's, who is not on Medicare yet); a mixed line pays it only for those 65 or over
 * who have also stopped work (a worker's cover comes through the job; `works`, workRule). With everyone 65 or over and
 * retired this year (review 2026-11-02), a cover line is their cover alongside Medicare (a supplement, an Advantage plan or a
 * retiree plan): it stays, and pays their Medicare as a mixed line does (`era`).
 * -> { cover: [{ name, monthly }], line (a Medicare line's name), mixed (a mixed line's name), paidBy: { line, ids, names, era } | null }
 */
function carriedHealth(active, people, year, works) {
  const covers = active.filter((x) => healthLine(x) === "cover");
  const on = people.filter((p) => year - p.birthYear >= 65);
  const era = covers.length && people.length && on.length === people.length && people.every((p) => !works(p, year)) ? covers[0] : null;
  const cover = era ? [] : covers.map((x) => ({ name: x.name, monthly: x.monthly }));
  const med = active.find((x) => healthLine(x) === "medicare") ?? null, mixed = active.find((x) => healthLine(x) === "mixed") ?? null;
  const line = med ?? mixed ?? era;
  const by = med ? on : line ? on.filter((p) => !works(p, year)) : [];
  return { cover, line: med?.name ?? null, mixed: mixed?.name ?? null, paidBy: by.length && line ? { line: line.name, ids: by.map((p) => p.id), names: by.map((p) => p.name), era: !med && !mixed && !!era } : null };
}

/**
 * The health lines among the bills the plan carries into retirement (carriedHealth), when it carries them: spending taken from
 * Expenses (no figure typed), or Get started's own figure built from them (`retireAuto`); null otherwise (a typed figure is
 * taken as it is). One rule for buildInputs and the Medicare page (verify 2026-11-06, seventh pass: that page asked about a
 * husband's or wife's Medicare that a line on Expenses already pays, and its tick said "left out" while the line stayed in).
 * expensesCarried(plan, people, today, works, ex?) -> { cover, line, mixed, paidBy } | null
 */
export function expensesCarried(plan, people, today, works, ex = undefined) {
  const rt = plan.retirement ?? {};
  const e = ex !== undefined ? ex : (plan.expenses ?? []).length ? computeExpenses(plan, { today }) : null;
  const typed = Number(rt.spendingMonthly) > 0;
  const fromSetup = typed && plan.guide?.setup?.retireAuto === true && !!e;
  const year = today ? Number(String(today).slice(0, 4)) : new Date().getFullYear();
  // our figure from 50 (overview/setup:retireSpend, spec 7.F) leaves Insurance and health out (health after work is this
  // page's own line), so that row pays nobody's Medicare: it is not among the lines carried (C3 review D2). Only a figure
  // the guesses' ledger keeps; the oldest adult's age is the setup's own test (50 or over today).
  const ages = (plan.household?.people ?? []).filter((p) => p?.role !== "dependent" && p?.birthDate && today).map((p) => ageOn(p.birthDate, today));
  const from50 = fromSetup && !!plan.guesses?.["retirement.spendingMonthly"] && isGuess(plan, "retirement.spendingMonthly") && ages.length > 0 && Math.max(...ages) >= 50;
  const active = from50 ? e.active.filter((x) => x.id !== "setup-x-insurance") : e?.active;
  return e && (fromSetup || (!typed && e.monthly > 0)) ? carriedHealth(active, people, year, works) : null;
}

/**
 * The plan's health line (2026-11-02): what cover costs, in today's dollars, as engine events marked `spending` (guaranteed
 * income pays them first), one a year, "Health cover". One rule for every person and year, whoever is listed first: while
 * anyone in the household still works (`works`, workRule: pay or a "work" answer, and under their retirement age), a plan
 * through that job covers the household (Healthcare before 65's own `onWorkPlan` rule, the same workRule), so no marketplace
 * and no Medicare is priced that year (`onJob` lists the Medicare years left to it, for those whose Medicare no line on
 * Expenses already pays: one reason a year). Any other year adds
 * - the marketplace: every year of retirement/healthcare (`years[].cost`, after any credit), the same years that page prices
 *   (fourth pass, 2026-11-02: it was only from the household's retirement year, so a year that page priced for someone Get
 *   started says is retired or not working, or past their own retirement age, was left out here; coverRule), and
 * - Medicare (retirement/medicare `years[].totalYearly`: Part B, the drug plan, any supplement and the income surcharge, the
 *   same for each person on it) for everyone 65 or over, less anyone whose Medicare a line on Expenses already pays
 *   (`paidIds`): totalYearly x those left / enrolled; in any year nobody works, before the household's retirement year too.
 * `workPremium` (a month): a premium taken out of the carried spending is put back in each year from the household's
 * retirement on while someone still works (the plan at work goes on, and so does what it costs; `jobPlan`).
 * Both pages share one run of the plan's income (planIncome, worked once here), which is the plan without this line: a
 * one-pass approximation (the premiums' own withdrawals do not raise the income they are priced on).
 * -> { events, total, bridge, medicare, onJob, jobPlan }
 */
function healthCover(plan, { today, retireYear, endYear, people, works, paidIds = [], workPremium = 0 }) {
  const jobCoversSpouse = plan.retirement?.medicare?.jobCoversSpouse === true;
  const pi = planIncome(plan, { today });
  const hc = computeHealthcare(plan, { today, planIncome: pi });
  const md = computeMedicare(plan, { today, planIncome: pi });
  const age = (p, y) => y - p.birthYear;
  const workers = (y) => people.filter((p) => works(p, y));
  const paid = new Set(paidIds);
  const byYear = new Map();
  const add = (y, amt) => byYear.set(y, (byYear.get(y) ?? 0) + amt);
  // 1. the marketplace (healthcare's years: nobody works, someone who has stopped is under 65; the years that page prices)
  const bYears = hc.ready ? hc.years.filter((y) => y.year <= endYear && y.cost > 0) : [];
  for (const y of bYears) add(y.year, y.cost);
  // 2. Medicare, for those 65 or over whose Medicare no line on Expenses already pays: not for someone who still works (their
  // job's plan), and for a husband or wife who has stopped while the other still works only when the plan says that job's plan
  // covers them (`jobCoversSpouse`, retirement.medicare; review 2026-11-06, seventh pass: it was taken for granted, so a
  // part-time job "covered" a spouse of 68 and their Medicare was left out)
  const mYears = [], jobYears = [], spouseYears = [];
  for (const y of md.ready ? md.years : []) {
    if (y.year > endYear || !(y.totalYearly > 0)) continue;
    const on = people.filter((p) => age(p, y.year) >= 65 && age(p, y.year) <= p.endAge);
    // those whose Medicare no line on Expenses already pays: a year left to a job's plan names only them (one reason a year)
    const left = on.filter((p) => !paid.has(p.id));
    const each = y.totalYearly / Math.max(1, y.enrolled), eachSurcharge = y.surchargeYearly / Math.max(1, y.enrolled);
    const w = workers(y.year);
    // left to a job's plan: someone who still works, on their own job's plan (seventh pass: named as their own worker, it named
    // the first worker listed), and with the tick a husband or wife who has stopped, on the first worker's
    const own = left.filter((p) => w.includes(p));
    const byTick = w.length && jobCoversSpouse ? left.filter((p) => !w.includes(p)) : [];
    const priced = left.filter((p) => !own.includes(p) && !byTick.includes(p));
    const toJob = (worker, ps) => { if (!ps.length) return; const e = jobYears.find((j) => j.year === y.year && j.worker === worker.name); if (e) { for (const q of ps) if (!e.names.includes(q.name)) e.names.push(q.name); e.amount += each * ps.length; } else jobYears.push({ year: y.year, names: ps.map((q) => q.name), worker: worker.name, presumed: !!works.presumed?.(worker, y.year), amount: each * ps.length }); };
    for (const q of own) toJob(q, [q]);
    if (byTick.length) toJob(w[0], byTick);
    if (w.length && priced.length) spouseYears.push({ year: y.year, names: priced.map((q) => q.name), worker: w[0].name, presumed: !!works.presumed?.(w[0], y.year), amount: each * priced.length });
    if (!priced.length) continue;
    mYears.push({ year: y.year, enrolled: priced.length, names: priced.map((p) => p.name), totalYearly: each * priced.length, surchargeYearly: eachSurcharge * priced.length });
    add(y.year, each * priced.length);
  }
  // 3. a premium taken out of the carried spending, back in the retirement years while someone still works
  const premiumYears = [];
  if (workPremium > 0) for (let y = retireYear; y <= endYear; y++) if (workers(y).length) { premiumYears.push(y); add(y, workPremium * 12); }
  const events = [...byYear].sort((a, b) => a[0] - b[0]).map(([year, amount]) => ({ year, amount, label: "Health cover", kind: "health", spending: true }));
  const sum = (arr, k) => arr.reduce((t, y) => t + y[k], 0);
  const over = bYears.filter((y) => y.overCliff > 0);
  // underLine: the years the plan's income is under the poverty line (no credit; Medicaid may cover people with that income)
  const bridge = bYears.length ? {
    fromYear: bYears[0].year, untilYear: bYears.at(-1).year, years: bYears.length, total: sum(bYears, "cost"), credit: sum(bYears, "credit"), creditYears: bYears.filter((y) => y.credit > 0.5).length, underLine: bYears.filter((y) => y.underLine).map((y) => y.year),
    monthlyFirst: bYears[0].cost / 12, monthlyLow: Math.min(...bYears.map((y) => y.cost)) / 12, monthlyHigh: Math.max(...bYears.map((y) => y.cost)) / 12,
    cliff: over.length ? { income: over[0].cliff, year: over[0].year, lost: over[0].lostCredit, lostTotal: sum(over, "lostCredit"), years: over.length, yearsList: over.map((y) => y.year), overBy: Math.min(...over.map((y) => y.overCliff)) } : null,
    parts: bridgeParts(bYears).map((p) => (hc.separate ? { ...p, separate: true } : p)),
    separate: !!hc.separate,
  } : null;
  const most = mYears.length ? Math.max(...mYears.map((y) => y.enrolled)) : 0;
  const all = mYears.find((y) => y.enrolled === most);
  // the first year each person's Medicare is added; the months it costs once the most are on it (the surcharge moves it),
  // and before that for whoever is on it first ("about $240 a month for Bo from 2053, then about $480 for the two of you
  // from 2055"); the years after a death at the plan's end are left out of the words
  const joins = [];
  for (const y of mYears) for (const name of y.names) if (!joins.some((j) => j.name === name)) joins.push({ name, year: y.year });
  const full = mYears.filter((y) => y.enrolled === most), early = mYears.filter((y) => y.year < all?.year);
  const lowHigh = (ys) => ({ monthlyLow: Math.min(...ys.map((y) => y.totalYearly)) / 12, monthlyHigh: Math.max(...ys.map((y) => y.totalYearly)) / 12 });
  const medicare = mYears.length ? {
    fromYear: mYears[0].year, untilYear: mYears.at(-1).year, monthlyFirst: mYears[0].totalYearly / 12, monthlyAll: all.totalYearly / 12, allFromYear: all.year, enrolled: most, people: people.length, joins,
    ...lowHigh(full), allNames: all.names,
    early: early.length ? { fromYear: early[0].year, untilYear: early.at(-1).year, names: [...new Set(early.flatMap((y) => y.names))], ...lowHigh(early) } : null,
    total: sum(mYears, "totalYearly"), surcharge: sum(mYears, "surchargeYearly"), surchargeYears: mYears.filter((y) => y.surchargeYearly > 0.5).length,
    // what each person's Medicare holds beyond Part B and the drug plan (seventh pass): the supplement, the household's own figure
    // or the national average for Medigap Plan G (medicare/data: MEDIGAP_G)
    supplementMonthly: md.supplement, supplementDefault: !!md.supplementDefault,
  } : null;
  // in runs of the same worker (verify 2026-11-06, sixth pass: Ana working to 2030 and Bo to 2032 read "In 2028 to 2032 Bo is
  // 65 or over while Ana still works", one worker named for every year, also those after Ana stopped)
  // (seventh pass: a year can hold two workers, each with their own run; and a run is the same people, so a year is never said
  // for someone who is not 65 yet)
  const runs = (ys) => {
    const parts = [];
    for (const y of ys) {
      const last = parts.find((q) => q.worker === y.worker && q.untilYear === y.year - 1 && q.names.join("|") === y.names.join("|"));
      if (last) { last.untilYear = y.year; last.years++; }
      else parts.push({ fromYear: y.year, untilYear: y.year, years: 1, names: [...y.names], worker: y.worker, presumedUntil: y.presumed ? retireYear : null });
    }
    return parts.sort((a, b) => a.fromYear - b.fromYear);
  };
  const jobParts = runs(jobYears);
  // the plan's tick (jobCoversSpouse) is said with the years it leaves a husband's or wife's Medicare to the job (`byTick`)
  const onJob = jobYears.length ? { fromYear: jobYears[0].year, untilYear: jobYears.at(-1).year, years: new Set(jobYears.map((y) => y.year)).size, names: [...new Set(jobYears.flatMap((y) => y.names))], worker: jobYears[0].worker, presumedUntil: jobYears[0].presumed ? retireYear : null, total: sum(jobYears, "amount"), parts: jobParts.map((p) => ({ ...p, byTick: jobCoversSpouse && p.names.some((n) => n !== p.worker) })) } : null;
  // a husband's or wife's Medicare counted while the other still works (no tick): said, with how to leave it out (seventh pass)
  const spouseOnJob = spouseYears.length ? { fromYear: spouseYears[0].year, untilYear: spouseYears.at(-1).year, years: spouseYears.length, names: [...new Set(spouseYears.flatMap((y) => y.names))], total: sum(spouseYears, "amount"), parts: runs(spouseYears) } : null;
  const jobPlan = premiumYears.length ? { fromYear: premiumYears[0], untilYear: premiumYears.at(-1), years: premiumYears.length, monthly: workPremium, total: workPremium * 12 * premiumYears.length, worker: workers(premiumYears[0])[0].name } : null;
  return { events, total: events.reduce((t, e) => t + e.amount, 0), bridge, medicare, onJob, spouseOnJob, jobPlan, jobCoversSpouse };
}

/**
 * A spouse's top-up line's name (round 7): "Ana's spouse's benefit" as before for a typed name; "your benefit as a spouse" for
 * the first adult Get started left unnamed ("Me"), and "your spouse's benefit as a spouse" for "My spouse" (never "Me's
 * spouse's benefit", nor "your spouse's benefit" for your own top-up).
 */
export const spousalName = (name) => (nameIn(name) === String(name) ? `${name}'s spouse's benefit` : `${nameOf(name)} benefit as a spouse`);

/**
 * Why a plan has no retirement year (to tax, or at all), in plain words, and what to check on the People page (Review 2026-11-06: 17 qa
 * households, a plan that ends before retirement or a person already past the plan's end age, left the Tax report on
 * "Putting the tax report together..." and Tax, year by year on "This page failed to render"; round 7: with everyone past the
 * end age buildInputs returns no inputs with this as `noYears`, and fourteen pages that failed now wait and say it). `people`: buildInputs'
 * [{ name, birthYear, retireAge, endAge }]; `year`: this year. -> { why, check }:
 *   everyone already past the end age: "Maya is 126, past the age the plan runs to (95)", check "the birth date";
 *   everyone's plan ending at or before their retirement: "the plan runs to 60, and Maya retires at 70", check the ages;
 *   else "the plan has no years after work stops".
 */
export function noYearsWhy(people = [], year = null) {
  const ps = (people ?? []).filter((p) => p && Number.isFinite(p.birthYear));
  // "you" for the unnamed first adult, with the verb to match ("you are 126", "you retire at 70"; round 7)
  const named = (xs) => namesIn(xs.map((p) => p.name));
  const verb = (xs, one, many) => (xs.length === 1 && !isYou(xs[0].name) ? one : many);
  const ages = 'the retirement age and "Plan to age"';
  if (ps.length && Number.isFinite(year) && ps.every((p) => year - p.birthYear >= p.endAge)) {
    return ps.length === 1 ? { why: `${named(ps)} ${verb(ps, "is", "are")} ${year - ps[0].birthYear}, past the age the plan runs to (${ps[0].endAge})`, check: "the birth date" }
      : { why: `${named(ps)} are ${ps.length === 2 ? "both" : "all"} past the age the plan runs to`, check: "the birth dates" };
  }
  if (ps.length && ps.every((p) => p.endAge <= p.retireAge)) {
    const ends = [...new Set(ps.map((p) => p.endAge))], retires = [...new Set(ps.map((p) => p.retireAge))];
    return { why: ends.length === 1 && retires.length === 1 ? `the plan runs to ${ends[0]}, and ${named(ps)} ${verb(ps, "retires", "retire")} at ${retires[0]}` : `the plan ends before ${named(ps)} ${verb(ps, "retires", "retire")}`, check: ages };
  }
  return { why: "the plan has no years after work stops", check: ages };
}

/**
 * buildInputs(plan, { today, health = true }) -> { inputs, notes: [text], people, spendingSource, spendingYearly, setupMonthly, figureMonthly, health } or { inputs: null, missing: [text], setupMonthly, figureMonthly, noYears: { why, check } | null (everyone past the plan's end age: noYearsWhy) }
 * health: false leaves the health line out (healthcare and medicare price it from that run); `retirement.healthIncluded`
 * ("my spending figure already includes health cover") leaves it out too (`health.included`). Spending carried from today's
 * bills (today's expenses, or Get started's own starting figure, `guide.setup.retireAuto`: today's bills less childcare and
 * loans): lines that pay only for cover before Medicare (healthLine "cover": a work plan's premium, the marketplace, COBRA)
 * come out of the carried figure, since the health line pays for cover from retirement on (and puts the premium back while
 * someone still works); Medicare and mixed lines stay, and the Medicare they pay (`carriedHealth`) is not added again. A
 * figure typed on this page is taken as it is: the health line goes on top unless healthIncluded. Get started's own figure is
 * worked out live from today's bills while it is still the screen's (`setupMonthly`, setupFigure: setup's `retireDefault`; review
 * 2026-11-02: the saved figure kept the bills of the day it was saved, so a premium added or changed on Expenses later was
 * taken out of a figure that never had it); the figure saved in `retirement.spendingMonthly` is used only when that is 0.
 */
export function buildInputs(plan, params = {}) {
  const today = params.today ?? null;
  const year = today ? Number(String(today).slice(0, 4)) : new Date().getFullYear();
  const a = plan.assumptions ?? {}, rt = plan.retirement ?? {};
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent" && p.birthDate);
  const missing = [];
  if (!adults.length) missing.push("a person with a birth date on the People page");
  const self = adults.find((p) => p.role === "self") ?? adults[0];
  const people = self ? [self, ...adults.filter((p) => p !== self)].map((p) => ({ id: p.id, name: p.name, birthYear: Number(String(p.birthDate).slice(0, 4)), retireAge: Number(p.retirementAge ?? a.retirementAge ?? 65), endAge: Number(p.lifeExpectancy ?? a.planEndAge ?? 95) })) : [];
  const balances = { cash: 0, taxable: 0, deferred: 0, free: 0 };
  for (const acct of plan.accounts ?? []) { const b = BUCKET_OF[acct.type]; if (b) balances[b] += countedBalance(acct); }
  const notes = [];
  if (!(plan.accounts ?? []).length) missing.push("your accounts on the Net worth page");
  const ex = (plan.expenses ?? []).length ? computeExpenses(plan, { today }) : null;
  const withHealth = params.health !== false && rt.healthIncluded !== true;
  const typed = Number(rt.spendingMonthly) > 0;
  // spending carried from today's bills: the Expenses page's, or Get started's own starting figure (built from them, less
  // childcare and loans, while `retireAuto`, and worked out from them now): cover paid today before Medicare gives way to the
  // health line; Medicare lines stay
  const fromSetup = typed && plan.guide?.setup?.retireAuto === true && !!ex;
  // a figure our guesses keep (core/estimate's ledger: overview/setup:retireSpend, which settle works out again whenever
  // what it reads changes, so it already follows the bills) is used as saved: from 50 it is not today's bills (spec 7.F)
  const ledgered = fromSetup && !!plan.guesses?.["retirement.spendingMonthly"] && isGuess(plan, "retirement.spendingMonthly");
  const live = fromSetup && !ledgered ? setupFigure(plan, today) : 0;
  const setupMonthly = fromSetup ? (live > 0 ? live : Number(rt.spendingMonthly)) : null;
  const baseMonthly = typed ? setupMonthly ?? Number(rt.spendingMonthly) : ex?.monthly ?? 0;
  let spendingSource;
  if (typed) spendingSource = "typed";
  else if (ex && ex.monthly > 0) {
    spendingSource = "expenses";
    notes.push("Retirement spending is taken as today's expenses; set your own figure on this page if it will differ.");
  }
  else { spendingSource = "none"; missing.push("what you will spend in retirement (a figure here, or your expenses on the Expenses page)"); }
  // who works when (pay or a "work" answer, and under their retirement age; the health line's and Healthcare before 65's one
  // rule), the household's retirement year (fifth pass: the first adult's, unless Get started says they do not work; then the
  // last working adult's stop year, or this year), and with it who is presumed at work until then (no pay and no answer); then
  // the health lines among the carried bills and what comes out of the figure
  const retireYear = householdRetireYear(plan, people, year, workRule(plan, people, { today }));
  const works = workRule(plan, people, { today, retireYear });
  const carried = params.health !== false ? expensesCarried(plan, people, today, works, ex) : null;
  const coverLines = withHealth && carried ? carried.cover : [];
  const removedMonthly = Math.min(baseMonthly, coverLines.reduce((t, x) => t + x.monthly, 0));
  // the figure Retirement settings' box shows (fourth pass, 2026-11-02): what the plan counts a month before health cover, to the
  // cent: a typed figure as it is, or Get started's own less the cover lines that give way to the health line (it showed Get
  // started's figure with a premium still in it, so typing a lower one raised spending); null with no figure (today's expenses)
  const figureMonthly = typed ? Math.round((baseMonthly - removedMonthly) * 100) / 100 : null;
  // no year left to plan (round 7, 2026-11-06): everyone already past the age the plan runs to (a birth year typed 1926 for
  // 1962) left the run with no rows, and fourteen pages that read its last row failed ("This page failed to render"): Will the
  // money last?, the Timeline, the reports, Chance the money lasts and more. Now nothing runs and the page says what to check.
  const noYears = people.length && Math.max(...people.map((p) => p.birthYear + p.endAge)) < year ? noYearsWhy(people, year) : null;
  if (noYears) missing.push(`${noYears.why.charAt(0).toUpperCase()}${noYears.why.slice(1)}: check ${noYears.check} on the People page`);
  if (missing.length) return { inputs: null, missing, people, notes, setupMonthly, figureMonthly, noYears };
  const personIndex = (id) => Math.max(0, people.findIndex((p) => p.id === id));
  // a contribution to a plan at work (a 401(k) or 403(b) account, or one with an employer match: workRule's test) stops with its
  // owner's last pay line on Income when every one of them has an end date (verify 2026-11-06, seventh pass: the pay stopped
  // at the line's end date, the job's 401(k) saving and match went on to the retirement age)
  const contributions = (rt.contributions ?? []).map((c) => {
    const acct = (plan.accounts ?? []).find((x) => x.id === c.accountId);
    const bucket = BUCKET_OF[acct?.type] ?? "taxable";
    const owner = people[personIndex(c.personId)];
    const atWork = acct?.type === "401k" || Number(c.employerMatch) > 0;
    const lines = owner && atWork ? works.payLines(owner) : [];
    const lastPay = lines.length ? Math.max(...lines.map((r) => r.until)) : Infinity;
    return { bucket, yearly: perYear(c.amount, c.period) + (Number(c.employerMatch) || 0), personIndex: personIndex(c.personId), name: acct?.name ?? "contribution", ...(bucket === "deferred" && !RMD_ACCOUNT_TYPES.includes(acct?.type) ? { rmdExempt: true } : {}), ...(Number.isFinite(lastPay) ? { untilYear: lastPay } : {}) };
  }).filter((c) => c.yearly > 0);
  const incomes = [];
  const ss = computeSocialSecurity(plan, { today });
  // someone already getting it before the claim age on file (disability or survivor benefits) gets it from now (fromAge)
  for (const p of ss.people) if (p.yearly > 0) incomes.push({ name: `${nameOf(p.name)} Social Security`, yearly: p.yearly, personIndex: personIndex(p.id), startAge: p.fromAge, cola: true, taxable: true, kind: "social" });
  // a spouse's top-up on the partner's record, as the Social Security page counts it (couple.spousalCounted): from the
  // later of the two people's own start years, never before the partner has claimed (recheck 2026-11-05: never counted).
  // After each person's own line, so the stress tests' "first Social Security line of a person" stays their own
  for (const p of ss.people) { const t = ss.couple?.spousalCounted?.[p.id] ?? 0; if (t > 0) incomes.push({ name: spousalName(p.name), yearly: t * 12, personIndex: personIndex(p.id), startAge: ss.couple.spousalFromAge[p.id], cola: true, taxable: true, kind: "social" }); }
  for (const pn of rt.pensions ?? []) if (Number(pn.monthly) > 0) incomes.push({ name: pn.name || "Pension", yearly: Number(pn.monthly) * 12, personIndex: personIndex(pn.personId), startAge: Number(pn.startAge) || 65, endAge: pn.endAge ? Number(pn.endAge) : undefined, cola: pn.cola !== false, taxable: true, type: "pension" });
  for (const pn of incomePensions(plan, people, rt.pensions ?? [], today ?? `${year}-01-01`)) incomes.push({ ...pn, personIndex: personIndex(pn.personId) });
  for (const sx of incomeSocial(plan, people, ss.people, today ?? `${year}-01-01`)) incomes.push({ ...sx, personIndex: personIndex(sx.personId) });
  // a partner who keeps working after the household retires brings their pay in as income (pay only: salary, bonus, business),
  // in the years each pay line is paid (payYears; review 2026-11-06, seventh pass: it was the lines paid today, to the
  // retirement age, so a job ending 2027-06-30 was counted to 66 and one starting in 2027 not at all); lines paid in the same
  // years are one income, as before
  for (let i = 1; i < people.length; i++) {
    const p = people[i];
    // type "pay" (recheck 2026-11-05; the fifth pass called it kind "pay"): the pages tell it from rent and the like by type,
    // never by its name; a partner Get started says is retired or not working brings none in, whatever Income still holds (workRule)
    if (works.status(p) === "stopped" || !(p.birthYear + p.retireAge > retireYear)) continue;
    const groups = new Map();
    for (const x of plan.income ?? []) {
      if (x.personId !== p.id || !PAY_TYPES.includes(x.type)) continue;
      const r = payYears(x, today ?? `${year}-01-01`);
      if (!r) continue;
      const from = Math.max(year, r.from), until = Math.min(p.birthYear + p.retireAge - 1, r.until);
      if (until < from) continue;
      const key = `${from}-${until}`;
      groups.set(key, { from, until, yearly: (groups.get(key)?.yearly ?? 0) + perYear(x.amount, x.period) });
    }
    for (const g of [...groups.values()].sort((a, b) => a.from - b.from || a.until - b.until)) {
      if (g.yearly > 0) incomes.push({ name: `${nameOf(p.name)} pay`, yearly: g.yearly, personIndex: i, startAge: g.from - p.birthYear, endAge: g.until - p.birthYear, cola: true, taxable: true, type: "pay" });
    }
  }
  // rent after work stops; support and other to their end date (else while their owner works, by the work rule); never dividends (otherIncome)
  const other = otherIncome(plan, people, retireYear, today ?? `${year}-01-01`, works);
  for (const x of other.counted) incomes.push({ ...x, personIndex: personIndex(x.personId) });
  const spendingYearly = (baseMonthly - removedMonthly) * 12;
  const endYear = Math.max(...people.map((p) => p.birthYear + p.endAge));
  const inputs = {
    startYear: year, endYear, people, balances, contributions, incomes,
    spending: { yearly: spendingYearly }, retireYear,
    rates: { inflation: Number(a.inflation ?? 0.03), cash: Number(a.returnCash ?? 0.02), salaryGrowth: Number(a.salaryGrowth ?? 0.03), taxRate: Number(rt.taxRate ?? 0.15), stocksNow: Number(rt.stocksNow ?? 0.7), stocksRetired: Number(rt.stocksRetired ?? 0.5) },
    returns: { stocks: Number(a.returnStocks ?? 0.07), bonds: Number(a.returnBonds ?? 0.04) },
    stdev: { stocks: Number(a.stdevStocks ?? 0.15), bonds: Number(a.stdevBonds ?? 0.05) },
    rmd: { birthYear: people[0].birthYear, startAge: rmdStartAge(adults.find((p) => p.id === people[0].id)?.birthDate ?? people[0].birthYear), owners: rmdOwners(plan, people, adults, balances.deferred) },
    strategy: STRATEGIES[rt.strategy] ? rt.strategy : "fixed-real", withdrawalRate: Number(rt.withdrawalRate ?? 0.04),
    withdrawalOrder: Array.isArray(rt.withdrawalOrder) && rt.withdrawalOrder.length ? rt.withdrawalOrder : ["taxable", "deferred", "free"],
    tax: taxSettings(plan),
    rothConversion: rt.taxMode === "brackets" && rt.rothConversion?.on ? { fillRate: Number(rt.rothConversion.fillRate ?? 0.22), untilAge: rt.rothConversion.untilAge ? Number(rt.rothConversion.untilAge) : null } : null,
  };
  // the health line, appended to whatever events the inputs carry (worked once here: every what-if and market path reuses it)
  // paidBy: whose Medicare a Medicare (or mixed) line on Expenses already pays; otherLine: a Medicare line that is nobody's here yet
  const paidBy = carried?.paidBy ?? null;
  const said = { coverLines, removedMonthly, fromSetup: fromSetup && !!carried, paidBy, medicareLine: paidBy?.line ?? null, otherLine: carried?.line && !paidBy ? carried.line : null };
  let health = params.health === false ? null : { included: true, total: 0, bridge: null, medicare: null, onJob: null, spouseOnJob: null, jobPlan: null, ...said };
  if (withHealth) {
    const h = healthCover(plan, { today, retireYear, endYear, people, works, paidIds: paidBy?.ids ?? [], workPremium: removedMonthly });
    inputs.events = [...(inputs.events ?? []), ...h.events];
    health = { included: false, total: h.total, bridge: h.bridge, medicare: h.medicare, onJob: h.onJob, spouseOnJob: h.spouseOnJob, jobPlan: h.jobPlan, ...said };
  }
  if (!contributions.length && retireYear > year) notes.push("No retirement contributions are entered (Contributions page), so nothing is added until retirement.");
  const ssIncome = incomeSocial(plan, people, ss.people, today ?? `${year}-01-01`);
  if (ssIncome.length) notes.push(`Social Security already paid, from the Income page: ${ssIncome.map((x) => `${x.name} $${Math.round(x.yearly).toLocaleString("en-US")} a year`).join(", ")}.`);
  if (!ss.hasData && !ssIncome.length) notes.push("No Social Security estimate yet (Social Security page): the plan assumes none.");
  // who starts retirement (fifth pass; review 2026-11-06): the first adult, also when the year is their own; the adult who stops
  // in that year when Get started says the first does not work; nobody when no one works (retirement starts this year)
  const retireBy = retireStarter(people, year, retireYear, works);
  return { inputs, missing: [], people, notes, spendingSource, spendingYearly, setupMonthly, figureMonthly, health, retireBy, ssYearly: ss.householdYearly, otherLeft: other.left, orderLabel: WITHDRAWAL_ORDERS[orderKey(inputs.withdrawalOrder)]?.label ?? "in a custom order" };
}

/** What an engine income is, in the words the page names it by (Social Security, pensions, a partner's pay, rent, other income). */
export const INCOME_WORDS = { social: "Social Security", pension: "pensions", pay: "a partner's pay", rental: "rent", other: "other income" };
const wordKey = (x) => (x.kind === "social" ? "social" : x.type === "pay" ? "pay" : x.type === "rental" ? "rental" : x.type === "support" || x.type === "other" ? "other" : "pension");
/** The engine counts an income in `year` (core/math/retirement.js project: its owner's age within start and end, and the year bounds). */
export const incomeIn = (I, x, year) => {
  const age = year - (I.people[x.personIndex ?? 0]?.birthYear ?? 0);
  return !(age < x.startAge || (x.endAge !== undefined && x.endAge !== null && age > x.endAge) || (x.fromYear != null && year < x.fromYear) || (x.untilYear != null && year > x.untilYear));
};

/**
 * compute(plan, { today }) -> {
 *   ready, missing, notes, inputs, result (project with expected returns), rows,
 *   atRetirement: { year, age, totalReal }, atEnd: { year, age, totalReal }, yearsInRetirement,
 *   affordable (real yearly spending the plan can carry, on top of the health line), spendingYearly, setupMonthly (Get started's own figure, worked out from today's bills, or null),
 *   figureMonthly (what the plan counts a month before health cover when a figure is set: the one Retirement settings shows, or null),
 *   coverage (all the income that comes in / spending and health cover, in the first retirement year), coverageFrom (what that
 *   income is, in INCOME_WORDS order: ["Social Security", "pensions", "rent"]), otherLeft (buildInputs: income not counted after work stops),
 *   retireBy (buildInputs: { id, name, age, first, nobody? }: who starts retirement),
 *   health: buildInputs' health ({ included, total, bridge: { fromYear, untilYear, years, total, credit, creditYears (years with a credit), underLine (years under the poverty line), monthlyFirst, monthlyLow, monthlyHigh,
 *       cliff: { income, year, lost, lostTotal, years, yearsList, overBy (the least income over it) } | null } | null,
 *     medicare: { fromYear, untilYear, monthlyFirst, monthlyAll, allFromYear, allNames, monthlyLow, monthlyHigh (once the most are on it), enrolled, people,
 *       early: { fromYear, untilYear, names, monthlyLow, monthlyHigh } | null (before that), joins: [{ name, year }], total, surcharge, surchargeYears } | null,
 *     onJob: { fromYear, untilYear, years, names, worker, total } | null (Medicare years left to a job's plan, for those no line pays), jobPlan: { fromYear, untilYear, years, monthly, total, worker } | null (a premium put back),
 *     coverLines, removedMonthly, fromSetup, paidBy: { line, ids, names, era (a cover line counted as cover alongside Medicare) } | null, medicareLine, otherLine,
 *     shown (with `showHealth` and the box ticked: { total, bridge, medicare } worked out for the page only, never added) }),
 *   verdict: "on track" | "tight" | "short", shortYear, shortAge
 * }
 * showHealth (the page's own call): with the box ticked, still work the health line out so the page can say what it would be.
 */
export function compute(plan, params = {}) {
  const b = buildInputs(plan, params);
  if (!b.inputs) return { ready: false, missing: b.missing, notes: b.notes, people: b.people, rows: [], setupMonthly: b.setupMonthly ?? null, figureMonthly: b.figureMonthly ?? null, noYears: b.noYears ?? null };
  const result = project(b.inputs);
  const rows = result.rows;
  const rRow = rows.find((r) => r.year === b.inputs.retireYear) ?? rows[0];
  const last = rows[rows.length - 1];
  const affordable = affordableSpending(b.inputs);
  // all the income that comes in against the first retirement year's spending, health cover included (it is spending too)
  const spentFirst = rRow ? rRow.spending + (rRow.eventSpending ?? 0) : 0;
  const coverage = rRow && spentFirst > 0 ? rRow.income / spentFirst : null;
  const firstYear = new Set(rRow ? b.inputs.incomes.filter((x) => x.yearly > 0 && incomeIn(b.inputs, x, rRow.year)).map(wordKey) : []);
  const coverageFrom = Object.keys(INCOME_WORDS).filter((k) => firstYear.has(k)).map((k) => INCOME_WORDS[k]);
  const ratio = b.spendingYearly > 0 ? affordable / b.spendingYearly : 1;
  const verdict = !result.success ? "short" : ratio < 1.15 ? "tight" : "on track";
  return {
    ready: true, missing: [], notes: b.notes, inputs: b.inputs, result, rows,
    atRetirement: rRow ? { year: rRow.year, age: rRow.ages[0], totalReal: rRow.totalReal, total: rRow.total } : null,
    atEnd: { year: last.year, age: last.ages[0], totalReal: last.totalReal, total: last.total },
    yearsInRetirement: rows.filter((r) => r.retired).length,
    affordable, spendingYearly: b.spendingYearly, spendingSource: b.spendingSource, setupMonthly: b.setupMonthly, figureMonthly: b.figureMonthly, ssYearly: b.ssYearly, coverage, coverageFrom, otherLeft: b.otherLeft,
    verdict, shortYear: result.failYear, shortAge: result.failAge, people: b.people, retireBy: b.retireBy, strategy: result.strategy, orderLabel: b.orderLabel,
    health: params.showHealth && b.health?.included ? { ...b.health, shown: shownHealth(plan, params.today ?? null, b) } : b.health,
  };
}

/** The plan adds health cover on top of its spending figure (buildInputs' or compute's `health`): pages then say "on top of health cover". */
export const healthAdded = (h) => !!(h && !h.included && (h.bridge || h.medicare || h.jobPlan));

/**
 * What the marketplace years' range is, in the page's words (fourth pass, 2026-11-02): "marketplace, after the credit" only
 * when every year in it has a credit, "marketplace, no credit" when none has, and "marketplace; with the credit in the years
 * it applies" when only some have (a year under the poverty line or over the cliff was labelled "after the credit").
 * creditWords(bridge: { years, creditYears }) -> text
 */
export function creditWords(b) {
  // married filing separately (seventh pass): no credit in any year, and why
  if (b?.separate) return "marketplace, no credit on separate returns";
  const n = Number(b?.creditYears) || 0;
  return n >= (Number(b?.years) || 0) && n > 0 ? "marketplace, after the credit" : n > 0 ? "marketplace; with the credit in the years it applies" : "marketplace, no credit";
}

/**
 * The plan's income in words, each line by its own name (fifth pass, 2026-11-02): "Ana's Social Security: $32,647 a year from
 * 67" (a line named for a person says that person's ages); any other line, rent, a pension or other income under its own name,
 * says the years, or "from now": "Rental condo: $18,000 a year from 2033" (it read "from 63", Lee's age, and before the FIRE
 * answer the rent came in as "Lee's pay"). Review 2026-11-06, with the base's "Income counted" record (recheck 2026-11-05): an
 * end is said too ("to 66", or "to 2034"), and rent is "(before its costs)". incomeWords(inputs, money) -> [text]
 */
export function incomeWords(I, money = (n) => `$${Math.round(n).toLocaleString("en-US")}`) {
  return (I?.incomes ?? []).map((x) => {
    const who = I.people[x.personIndex ?? 0] ?? I.people[0];
    const start = who.birthYear + x.startAge;
    // a line named for a person: "Ana's ...", or "your ..." / "your spouse's ..." for the people Get started left unnamed (round 7)
    const named = I.people.some((p) => String(x.name).startsWith(`${p.name}'s `) || String(x.name).startsWith(`${nameOf(p.name)} `));
    const ends = x.endAge !== undefined && x.endAge !== null ? ` to ${named ? x.endAge : who.birthYear + x.endAge}` : "";
    return `${x.name}: ${money(x.yearly)} a year from ${named ? x.startAge : start <= I.startYear ? "now" : start}${ends}${x.type === "rental" ? " (before its costs)" : ""}`;
  });
}

/**
 * The marketplace years in runs of the same people covered (fifth pass, 2026-11-02), so the words can name who and when:
 * bridgeParts(years of retirement/healthcare) -> [{ names, fromYear, untilYear, years, monthlyLow, monthlyHigh, creditYears }]
 */
export function bridgeParts(years) {
  const parts = [];
  for (const y of years) {
    const last = parts.at(-1), key = y.covered.join("|");
    if (last && last.key === key && last.untilYear === y.year - 1) { last.ys.push(y); last.untilYear = y.year; } else parts.push({ key, ys: [y], fromYear: y.year, untilYear: y.year });
  }
  return parts.map(({ ys, fromYear, untilYear }) => ({ names: ys[0].covered, fromYear, untilYear, years: ys.length, monthlyLow: Math.min(...ys.map((y) => y.cost)) / 12, monthlyHigh: Math.max(...ys.map((y) => y.cost)) / 12, creditYears: ys.filter((y) => y.credit > 0.5).length }));
}

/**
 * The health line in words, a sentence for each part naming the people and the years (fifth pass, 2026-11-02: "About $210 to
 * $1,440 a month from 2026 until 65 (marketplace ...), then Medicare about $240 a month for Ana from 2026" never said Bo was
 * the one on the marketplace, and its "then" joined years that overlap). "Bo: about $210 to $1,440 a month, 2026 and 2027
 * (marketplace; with the credit in the years it applies). Ana: Medicare, about $240 a month from 2026. Bo: Medicare from 2028
 * (about $480 a month for the two of you)." Months are rounded to $10; a range when they differ by more than a quarter; the
 * Medicare months are over the years the most are on it (the surcharge moving them), with "including an income surcharge in
 * 21 of those years (Medicare page)" when there is one and `surcharge` is asked for.
 * healthSummary(bridge, medicare, { money, surcharge }) -> text ("" when neither)
 */
export function healthSummary(b, m, { money = (n) => `$${Math.round(n).toLocaleString("en-US")}`, surcharge = true } = {}) {
  const around = (n) => money(Math.round(n / 10) * 10);
  const range = (lo, hi) => (hi > lo * 1.25 ? `${around(lo)} to ${around(hi)}` : around(lo));
  // the people as a label, "You" and "your spouse" for those Get started left unnamed (round 7): "You and Bo: Medicare ..."
  const span = (from, until, n) => (from === until ? `${from}` : n === 2 ? `${from} and ${until}` : `${from} to ${until}`);
  const out = [];
  for (const p of b?.parts ?? (b ? [{ names: [], fromYear: b.fromYear, untilYear: b.untilYear, years: b.years, monthlyLow: b.monthlyLow, monthlyHigh: b.monthlyHigh, creditYears: b.creditYears }] : [])) {
    out.push(`${p.names.length ? `${NamesIn(p.names)}: about` : "About"} ${range(p.monthlyLow, p.monthlyHigh)} a month, ${span(p.fromYear, p.untilYear, p.years)} (${creditWords(p)})`);
  }
  if (m) {
    const whom = (names) => (names.length < 2 ? "" : names.length >= m.people ? (m.people === 2 ? " for the two of you" : " for all of you") : ` for ${namesIn(names)}`);
    const tail = surcharge && m.surchargeYears ? `, including an income surcharge in ${m.surchargeYears} of those years (Medicare page)` : "";
    if (m.early && m.people > 1) {
      const joiners = (m.allNames ?? []).filter((n) => !m.early.names.includes(n));
      out.push(`${NamesIn(m.early.names)}: Medicare, about ${range(m.early.monthlyLow, m.early.monthlyHigh)} a month from ${m.early.fromYear}`);
      out.push(`${NamesIn(joiners.length ? joiners : m.allNames)}: Medicare from ${m.allFromYear} (about ${range(m.monthlyLow, m.monthlyHigh)} a month${whom(m.allNames)})${tail}`);
    } else out.push(`${NamesIn(m.allNames ?? [])}: Medicare, about ${range(m.monthlyLow, m.monthlyHigh)} a month${whom(m.allNames ?? [])} from ${m.allFromYear}${tail}`);
  }
  return out.length ? `${out.join(". ")}.` : "";
}

/**
 * The Medicare years left to a job's plan, in words (verify 2026-11-06, sixth pass): one sentence for each run of years with
 * the same worker (`onJob.parts`), so a worker is never named for a year they no longer work. "In 2028 to 2030 Bo is 65 or over
 * while Ana still works: a plan through Ana's job can cover Bo, so Medicare those years is not added (the Medicare page counts
 * them). In 2031 and 2032 Bo is 65 or over but still works: ..." With `presumedUntil`, the presumption is said after its run.
 * onJobWords(onJob, list?) -> [text]
 */
export function onJobWords(j, list = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`)) {
  if (!j) return [];
  const span = (from, until, n) => (from === until ? `${from}` : n === 2 ? `${from} and ${until}` : `${from} to ${until}`);
  const out = [];
  // "you" and "your" for the first adult Get started left unnamed, with the verb to match (round 7): "while you still work"
  const who = (xs) => list(xs.map(nameIn)), are = (xs) => (xs.length > 1 || isYou(xs[0]) ? "are" : "is");
  for (const p of j.parts ?? [j]) {
    const yrs = span(p.fromYear, p.untilYear, p.years), others = p.names.filter((n) => n !== p.worker), those = p.years === 1 ? "that year" : "those years", it = p.years === 1 ? "it" : "them";
    const w = nameIn(p.worker), works = verbFor(p.worker, "works", "work"), job = `${nameOf(p.worker)} job`;
    out.push(others.length
      ? `In ${yrs} ${who(others)} ${are(others)} 65 or over while ${w} still ${works}: ${p.byTick ? `you said a plan through ${job} covers ${who(others)} (Medicare page)` : `a plan through ${job} can cover ${who(p.names)}`}, so Medicare ${those} is not added (the Medicare page counts ${it}).`
      : `In ${yrs} ${w} ${are([p.worker])} 65 or over but still ${works}: cover comes through the job, so Medicare ${those} is not added (the Medicare page counts ${it}).`);
    // the worker is presumed (no pay and no Get started answer; fifth pass): said, so "Ana's job" is not read as a fact
    if (p.presumedUntil) out.push(`No pay is listed for ${w} and Get started does not say ${w} ${verbFor(p.worker, "has", "have")} stopped work, so the plan takes ${w} as working until ${p.presumedUntil}.`);
  }
  return out;
}

/**
 * A husband's or wife's Medicare counted while the other still works (review 2026-11-06, seventh pass: a job's plan was taken
 * to cover them, a part-time job too), one sentence for each run of years with the same worker: "In 2026 to 2029 Rae is 65 or
 * over while Jo still works: Rae's Medicare is counted. If a plan through Jo's job covers Rae, tick the box on the Medicare
 * page." spouseWords(spouseOnJob, list?) -> [text]
 */
export function spouseWords(j, list = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`)) {
  if (!j) return [];
  const span = (from, until, n) => (from === until ? `${from}` : n === 2 ? `${from} and ${until}` : `${from} to ${until}`);
  // "you" and "your" for the first adult Get started left unnamed (round 7): "your spouse's Medicare", "while you still work";
  // several people with you among them are "you" too ("you and Bo are 65 or over ... your Medicare")
  const many = (xs) => xs.length > 1, withYou = (xs) => xs.some(isYou);
  const whose = (xs) => (many(xs) ? (withYou(xs) ? "your" : "their") : nameOf(xs[0])), whom = (xs) => (many(xs) ? (withYou(xs) ? "you" : "them") : nameIn(xs[0]));
  return (j.parts ?? []).flatMap((p) => {
    const w = nameIn(p.worker);
    return [`In ${span(p.fromYear, p.untilYear, p.years)} ${list(p.names.map(nameIn))} ${many(p.names) || isYou(p.names[0]) ? "are" : "is"} 65 or over while ${w} still ${verbFor(p.worker, "works", "work")}: ${whose(p.names)} Medicare is counted. If a plan through ${nameOf(p.worker)} job covers ${whom(p.names)}, tick the box on the Medicare page.`,
      // the worker is presumed (no pay and no Get started answer; fifth pass): said, as onJobWords does
      ...(p.presumedUntil ? [`No pay is listed for ${w} and Get started does not say ${w} ${verbFor(p.worker, "has", "have")} stopped work, so the plan takes ${w} as working until ${p.presumedUntil}.`] : [])];
  });
}

/**
 * Retirement settings' spending box, saved into the draft (fourth pass, 2026-11-02). `shown` is what the box showed
 * (compute's `figureMonthly`): while the figure is Get started's own (`guide.setup.retireAuto`), what the plan counts before
 * health cover. The same figure saved again keeps it Get started's (it goes on following today's bills; the saved figure stays
 * as it was); any other figure, or a blank, is the household's own: retireAuto off, and it is taken as typed, so a lower figure
 * lowers spending. -> nothing (changes the draft)
 */
export function saveSpendingFigure(draft, typed, shown) {
  const v = typed === "" || typed === undefined ? null : typed;
  draft.retirement = draft.retirement ?? {};
  const auto = draft.guide?.setup?.retireAuto === true;
  if (auto && v !== null && shown !== null && shown !== undefined && Math.abs(Number(v) - Number(shown)) < 0.005) return;
  if (auto) draft.guide.setup.retireAuto = false;
  draft.retirement.spendingMonthly = v;
  // typed here, it is the household's own figure even when it equals our guess: it stops being ours (spec S2; C3 review D8)
  clearGuess(draft, "retirement.spendingMonthly");
}

/** The health line the plan would add, for the page to say with the box ticked (the engine never sees it). */
function shownHealth(plan, today, b) {
  const I = b.inputs;
  const h = healthCover(plan, { today, retireYear: I.retireYear, endYear: I.endYear, people: I.people, works: workRule(plan, I.people, { today, retireYear: I.retireYear }), paidIds: b.health.paidBy?.ids ?? [] });
  return h.bridge || h.medicare ? { total: h.total, bridge: h.bridge, medicare: h.medicare } : null;
}

/** Is retirement checkable: every adult has a birth date and Social Security (a figure or a record on Social Security)
 * or said in Get started that they get none. Until then no page calls retirement short or on track. */
export function retirementKnown(plan, today = null) {
  const ss = plan?.retirement?.socialSecurity ?? {}, said = plan?.guide?.setup?.ss ?? {};
  const ad = (plan?.household?.people ?? []).filter((p) => p.role !== "dependent");
  return ad.length > 0 && ad.every((p) => p.birthDate && (Number(ss[p.id]?.monthlyAtFRA) > 0 || (ss[p.id]?.record ?? []).length > 0 || said[p.id] === "none" || ssOnIncome(plan, p.id, today)));
}

/** The plan's own answer to "are we saving enough?" for other pages: this page's verdict once retirement is checkable,
 * else null (Retirement contributions, How am I doing?, Next best action read it, so they never contradict it). */
export function savingVerdict(plan, params = {}) {
  if (!retirementKnown(plan, params.today ?? null)) return null;
  let d = null;
  try { d = compute(plan, params); } catch { d = null; }
  return d?.ready ? { verdict: d.verdict, shortAge: d.shortAge ?? null, affordable: d.affordable, spendingYearly: d.spendingYearly } : null;
}

/** Every adult has stopped working: the setup said "retired", or each is past their retirement age with no pay coming in
 * (salary, bonus or business on the Income page). The working-age rules (spend less than comes in, save 20%) do not apply. */
export function householdRetired(plan, params = {}) {
  const today = params.today ?? null;
  const adults = (plan?.household?.people ?? []).filter((p) => p.role !== "dependent");
  if (!adults.length || !today) return false;
  const said = plan?.guide?.setup?.status ?? {};
  let inc = null;
  try { inc = computeIncome(plan, { today }); } catch { inc = null; }
  const paid = (id) => (inc?.active ?? []).some((x) => x.personId === id && ["salary", "bonus", "business"].includes(x.type) && (Number(x.yearly) || 0) > 0);
  const ageNow = (p) => { if (!p.birthDate) return null; const [by, bm, bd] = p.birthDate.split("-").map(Number); const [ty, tm, td] = today.split("-").map(Number); return ty - by - (tm < bm || (tm === bm && td < (bd || 1)) ? 1 : 0); };
  // a retirement age left blank (the People page's default) is the plan's own, as the projection uses it (review 2026-11-02)
  const ra = (p) => (Number(p.retirementAge) > 0 ? Number(p.retirementAge) : Number(plan?.assumptions?.retirementAge ?? 65));
  return adults.every((p) => said[p.id] === "retired" || (!paid(p.id) && ageNow(p) !== null && ageNow(p) >= ra(p)));
}

/**
 * drawingAsPlanned(plan, { today }) -> { verdict, spendingMonthly, affordableMonthly } | null: a retired household living on
 * its savings as the plan intends (Will the money last? says it lasts: on track or tight). Then drawing from savings each
 * month is the plan working, not overspending: Next best action, Needs attention and Expenses say so instead of "cut".
 */
export function drawingAsPlanned(plan, params = {}) {
  if (!householdRetired(plan, params)) return null;
  const v = savingVerdict(plan, params);
  if (!v || v.verdict === "short") return null;
  return { verdict: v.verdict, spendingMonthly: v.spendingYearly / 12, affordableMonthly: v.affordable / 12 };
}

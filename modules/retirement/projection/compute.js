// modules/retirement/projection/compute.js -- PURE. Turns the plan into the engine's inputs
// (people, buckets, contributions, guaranteed income, spending, rates) and runs the expected-
// return projection. Every other retirement page starts from buildInputs() so they all agree.
import { project, affordableSpending, STRATEGIES } from "../../../core/math/retirement.js";
import { rmdStartAge, RMD_ACCOUNT_TYPES } from "../../../core/math/rmd.js";
import { ACCOUNT_TYPES, countedBalance } from "../../balance/net-worth/compute.js";
import { compute as computeExpenses } from "../../cashflow/expenses/compute.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeSocialSecurity } from "../social-security/compute.js";
import { perYear } from "../../../core/math/periods.js";
import { paramsFor } from "../../../core/math/tax.js";
import { FEDERAL } from "../../taxes/federal/data/federal.js";

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
    out.push({ name: String(x.name || `${who.name}'s Social Security`).trim(), yearly, personId: who.id, startAge: startYear - who.birthYear, cola: true, taxable: x.taxable !== false, kind: "social", source: "income", ...(later ? { startsOn: String(x.startDate) } : {}) });
  }
  return out;
}

/** The Income page's kinds of pay: they stop when that person stops work. */
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
export function ownAccountMoney(name) {
  const n = String(name ?? "");
  if (/\btrust\b|\bannuit/i.test(n)) return false;
  // 401(k), 403(b) and 457(b) only as the plans ("Unit 401B" is a flat, "457 Elm St" a house), and "Roth" only next to an account
  // or a withdrawal word ("Help from Grandma Roth" is a person): review 2026-11-06
  const ROTH = /\broth\b[\s\S]*\b(ira|401|403|457|accounts?|withdrawals?|distributions?|conversions?|draws?)\b|\b(withdrawals?|distributions?|draws?)\b[\s\S]*\broth\b/i;
  if (/\b(IRA|RMD|TSP|HSA)s?\b/.test(n) || /\b401\s*\(?\s*k\b|\b403\s*\(?\s*b\b|\b457\s*(\(b\)|b\b|plan\b)|required minimum/i.test(n) || ROTH.test(n)) return true;
  // draws from a business or against pay are not the household's savings ("Owner's draw from business account", "Account
  // manager bonus draws": review 2026-11-06)
  if (/\b(business|company|firm|LLC|partnership|owner['’]?s|commissions?|bonus(es)?)\b/i.test(n)) return false;
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
 * otherIncome(plan, people, retireYear, today) -> {
 *   counted: [{ name, yearly, personId, startAge (its owner's age in the year it starts), endAge?, cola, taxable, type, source: "income", whileWorking? }],
 *   left: [{ name, yearly, type, personId, why: "work" | "growth" | "accounts" }]
 * }
 */
export function otherIncome(plan, people, retireYear, today) {
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
      else { until = who.birthYear + who.retireAge - 1; whileWorking = true; left.push({ name, yearly, type, personId: who.id, why: "work" }); }
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

/**
 * buildInputs(plan, { today }) -> { inputs, notes: [text], people, spendingSource } or { inputs: null, missing: [text] }
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
  let spendingYearly, spendingSource;
  if (Number(rt.spendingMonthly) > 0) { spendingYearly = Number(rt.spendingMonthly) * 12; spendingSource = "typed"; }
  else if (ex && ex.monthly > 0) { spendingYearly = ex.monthly * 12; spendingSource = "expenses"; notes.push("Retirement spending is taken as today's expenses; set your own figure on this page if it will differ."); }
  else { spendingYearly = 0; spendingSource = "none"; missing.push("what you will spend in retirement (a figure here, or your expenses on the Expenses page)"); }
  if (missing.length) return { inputs: null, missing, people, notes };
  const personIndex = (id) => Math.max(0, people.findIndex((p) => p.id === id));
  const contributions = (rt.contributions ?? []).map((c) => {
    const acct = (plan.accounts ?? []).find((x) => x.id === c.accountId);
    const bucket = BUCKET_OF[acct?.type] ?? "taxable";
    return { bucket, yearly: perYear(c.amount, c.period) + (Number(c.employerMatch) || 0), personIndex: personIndex(c.personId), name: acct?.name ?? "contribution", ...(bucket === "deferred" && !RMD_ACCOUNT_TYPES.includes(acct?.type) ? { rmdExempt: true } : {}) };
  }).filter((c) => c.yearly > 0);
  const incomes = [];
  const ss = computeSocialSecurity(plan, { today });
  // someone already getting it before the claim age on file (disability or survivor benefits) gets it from now (fromAge)
  for (const p of ss.people) if (p.yearly > 0) incomes.push({ name: `${p.name}'s Social Security`, yearly: p.yearly, personIndex: personIndex(p.id), startAge: p.fromAge, cola: true, taxable: true, kind: "social" });
  // a spouse's top-up on the partner's record, as the Social Security page counts it (couple.spousalCounted): from the
  // later of the two people's own start years, never before the partner has claimed (recheck 2026-11-05: never counted).
  // After each person's own line, so the stress tests' "first Social Security line of a person" stays their own
  for (const p of ss.people) { const t = ss.couple?.spousalCounted?.[p.id] ?? 0; if (t > 0) incomes.push({ name: `${p.name}'s spouse's benefit`, yearly: t * 12, personIndex: personIndex(p.id), startAge: ss.couple.spousalFromAge[p.id], cola: true, taxable: true, kind: "social" }); }
  for (const pn of rt.pensions ?? []) if (Number(pn.monthly) > 0) incomes.push({ name: pn.name || "Pension", yearly: Number(pn.monthly) * 12, personIndex: personIndex(pn.personId), startAge: Number(pn.startAge) || 65, endAge: pn.endAge ? Number(pn.endAge) : undefined, cola: pn.cola !== false, taxable: true, type: "pension" });
  for (const pn of incomePensions(plan, people, rt.pensions ?? [], today ?? `${year}-01-01`)) incomes.push({ ...pn, personIndex: personIndex(pn.personId) });
  for (const sx of incomeSocial(plan, people, ss.people, today ?? `${year}-01-01`)) incomes.push({ ...sx, personIndex: personIndex(sx.personId) });
  const retireYear = Math.max(year, people[0].birthYear + people[0].retireAge);
  // a partner who keeps working after the household retires brings their pay in as income (pay only: salary, bonus, business)
  const inc = (plan.income ?? []).length ? computeIncome(plan, { today }) : null;
  for (let i = 1; i < people.length; i++) {
    const p = people[i];
    const theirs = inc ? inc.active.filter((x) => x.personId === p.id && PAY_TYPES.includes(x.type)).reduce((s, x) => s + x.yearly, 0) : 0;
    const ageNow = year - p.birthYear;
    if (theirs > 0 && p.birthYear + p.retireAge > retireYear) incomes.push({ name: `${p.name}'s pay`, yearly: theirs, personIndex: i, startAge: ageNow, endAge: p.retireAge - 1, cola: true, taxable: true, type: "pay" });
  }
  // rent after work stops; support and other to their end date (else while their owner works); never dividends (otherIncome)
  const other = otherIncome(plan, people, retireYear, today ?? `${year}-01-01`);
  for (const x of other.counted) incomes.push({ ...x, personIndex: personIndex(x.personId) });
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
  if (!contributions.length && retireYear > year) notes.push("No retirement contributions are entered (Contributions page), so nothing is added until retirement.");
  const ssIncome = incomeSocial(plan, people, ss.people, today ?? `${year}-01-01`);
  if (ssIncome.length) notes.push(`Social Security already paid, from the Income page: ${ssIncome.map((x) => `${x.name} $${Math.round(x.yearly).toLocaleString("en-US")} a year`).join(", ")}.`);
  if (!ss.hasData && !ssIncome.length) notes.push("No Social Security estimate yet (Social Security page): the plan assumes none.");
  return { inputs, missing: [], people, notes, spendingSource, spendingYearly, ssYearly: ss.householdYearly, otherLeft: other.left, orderLabel: WITHDRAWAL_ORDERS[orderKey(inputs.withdrawalOrder)]?.label ?? "in a custom order" };
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
 *   affordable (real yearly spending the plan can carry), spendingYearly,
 *   coverage (all the income that comes in / spending, in the first retirement year), coverageFrom (what that income is, in
 *   INCOME_WORDS order: ["Social Security", "pensions", "rent"]), otherLeft (buildInputs: income not counted after work stops),
 *   verdict: "on track" | "tight" | "short", shortYear, shortAge
 * }
 */
export function compute(plan, params = {}) {
  const b = buildInputs(plan, params);
  if (!b.inputs) return { ready: false, missing: b.missing, notes: b.notes, people: b.people, rows: [] };
  const result = project(b.inputs);
  const rows = result.rows;
  const rRow = rows.find((r) => r.year === b.inputs.retireYear) ?? rows[0];
  const last = rows[rows.length - 1];
  const affordable = affordableSpending(b.inputs);
  const coverage = rRow && rRow.spending > 0 ? rRow.income / rRow.spending : null;
  const firstYear = new Set(rRow ? b.inputs.incomes.filter((x) => x.yearly > 0 && incomeIn(b.inputs, x, rRow.year)).map(wordKey) : []);
  const coverageFrom = Object.keys(INCOME_WORDS).filter((k) => firstYear.has(k)).map((k) => INCOME_WORDS[k]);
  const ratio = b.spendingYearly > 0 ? affordable / b.spendingYearly : 1;
  const verdict = !result.success ? "short" : ratio < 1.15 ? "tight" : "on track";
  return {
    ready: true, missing: [], notes: b.notes, inputs: b.inputs, result, rows,
    atRetirement: rRow ? { year: rRow.year, age: rRow.ages[0], totalReal: rRow.totalReal, total: rRow.total } : null,
    atEnd: { year: last.year, age: last.ages[0], totalReal: last.totalReal, total: last.total },
    yearsInRetirement: rows.filter((r) => r.retired).length,
    affordable, spendingYearly: b.spendingYearly, spendingSource: b.spendingSource, ssYearly: b.ssYearly, coverage, coverageFrom, otherLeft: b.otherLeft,
    verdict, shortYear: result.failYear, shortAge: result.failAge, people: b.people, strategy: result.strategy, orderLabel: b.orderLabel,
  };
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

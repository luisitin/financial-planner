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
    out.push({ name, yearly, personId: who.id, startAge: startYear - who.birthYear, endAge, cola: Number(x.growth) > 0, taxable: x.taxable !== false, source: "income" });
  }
  return out;
}

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
  for (const p of ss.people) if (p.yearly > 0) incomes.push({ name: `${p.name}'s Social Security`, yearly: p.yearly, personIndex: personIndex(p.id), startAge: Math.floor(p.claimAge), cola: true, taxable: true, kind: "social" });
  for (const pn of rt.pensions ?? []) if (Number(pn.monthly) > 0) incomes.push({ name: pn.name || "Pension", yearly: Number(pn.monthly) * 12, personIndex: personIndex(pn.personId), startAge: Number(pn.startAge) || 65, endAge: pn.endAge ? Number(pn.endAge) : undefined, cola: pn.cola !== false, taxable: true });
  for (const pn of incomePensions(plan, people, rt.pensions ?? [], today ?? `${year}-01-01`)) incomes.push({ ...pn, personIndex: personIndex(pn.personId) });
  const retireYear = Math.max(year, people[0].birthYear + people[0].retireAge);
  // a partner who keeps working after the household retires brings their pay in as income
  const inc = (plan.income ?? []).length ? computeIncome(plan, { today }) : null;
  for (let i = 1; i < people.length; i++) {
    const p = people[i];
    const theirs = inc ? inc.active.filter((x) => x.personId === p.id && x.type !== "social" && x.type !== "pension").reduce((s, x) => s + x.yearly, 0) : 0;
    const ageNow = year - p.birthYear;
    if (theirs > 0 && p.birthYear + p.retireAge > retireYear) incomes.push({ name: `${p.name}'s pay`, yearly: theirs, personIndex: i, startAge: ageNow, endAge: p.retireAge - 1, cola: true, taxable: true });
  }
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
  if (!ss.hasData) notes.push("No Social Security estimate yet (Social Security page): the plan assumes none.");
  return { inputs, missing: [], people, notes, spendingSource, spendingYearly, ssYearly: ss.householdYearly, orderLabel: WITHDRAWAL_ORDERS[orderKey(inputs.withdrawalOrder)]?.label ?? "in a custom order" };
}

/**
 * compute(plan, { today }) -> {
 *   ready, missing, notes, inputs, result (project with expected returns), rows,
 *   atRetirement: { year, age, totalReal }, atEnd: { year, age, totalReal }, yearsInRetirement,
 *   affordable (real yearly spending the plan can carry), spendingYearly, coverage (guaranteed income / spending in the first retirement year),
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
  const ratio = b.spendingYearly > 0 ? affordable / b.spendingYearly : 1;
  const verdict = !result.success ? "short" : ratio < 1.15 ? "tight" : "on track";
  return {
    ready: true, missing: [], notes: b.notes, inputs: b.inputs, result, rows,
    atRetirement: rRow ? { year: rRow.year, age: rRow.ages[0], totalReal: rRow.totalReal, total: rRow.total } : null,
    atEnd: { year: last.year, age: last.ages[0], totalReal: last.totalReal, total: last.total },
    yearsInRetirement: rows.filter((r) => r.retired).length,
    affordable, spendingYearly: b.spendingYearly, spendingSource: b.spendingSource, ssYearly: b.ssYearly, coverage,
    verdict, shortYear: result.failYear, shortAge: result.failAge, people: b.people, strategy: result.strategy, orderLabel: b.orderLabel,
  };
}

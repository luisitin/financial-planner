// modules/taxes/federal/compute.js -- PURE. This year's federal income tax from what the plan
// already knows (pay, pensions, Social Security, pre-tax contributions, who is in the household)
// plus the figures only the owner knows (typed on the page: dividends, interest, withholding,
// itemized deductions). Every other tax page starts from taxInputs() so they all agree.
import { FEDERAL, TAX_YEARS } from "./data/federal.js";
import { MAXIMUM_EARNINGS } from "../../retirement/social-security/data/ssa.js";
import { federalTax, marginalRate, careStep, paramsFor, standardDeduction, SEPARATE_FIELDS } from "../../../core/math/tax.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { perYear } from "../../../core/math/periods.js";
import { limitsFor, catchUpFor, hsaPicture, limitKind } from "../../retirement/contributions/compute.js";
// a person inside a sentence: "you" / "your" for the first adult Get started left unnamed ("Me"), "your spouse" for the
// partner it named; a typed name as before (Review 2026-11-06 round 7). As W.*: this file has its own nameOf (an id's name)
import * as W from "../../../core/words.js";

export { TAX_YEARS };
const fmtInt = (n) => Math.round(n).toLocaleString("en-US");
/**
 * A rate as a percent to `dp` places, rounded half up on its decimal value (4,268 of 88,000 is 4.85%: "4.9%"). The one
 * rounding for a rate this page shows in more than one place (the hero, the stat, the walk; Withholding check's walk).
 */
export const ratePct = (x, dp = 1) => { const v = Number((Number(x) * 100).toPrecision(12)), f = 10 ** dp; return `${(Math.round(v * f) / f).toFixed(dp)}%`; };

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dayWords = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? "")); return m ? `${MONTH_NAMES[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}` : String(iso ?? ""); };
const EARNED_WORD = { salary: "pay", bonus: "bonus", business: "business income" };
/**
 * Earned income (pay, a bonus, business income) on the Income page that this year's estimate does not count, because the
 * engine counts a year of what is coming in today (cashflow/income `active`, one-time amounts as none a year): a line that
 * ended before today, one that starts after it, or a one-time amount (Review 2026-11-06, verifier follow-up: H-0221's pay
 * ended August 15 and H-0319's 119,600 is "once", and the child care note said "none is on the Income page").
 * `inc`: cashflow/income compute's result; `people`: the household's; `year`: the tax year. -> [{ personId, name, what,
 * why: "ended" | "starts" | "once", date, amount, inYear (it could have paid in `year`: ended or starts in it, or a one-time
 * amount undated or dated in it; only these are named as the reason) }]
 */
export function uncountedEarned(inc, people = [], year = null) {
  const nameOf = (id) => people.find((p) => p.id === id)?.name ?? null;
  const y = year === null || year === undefined ? null : String(year);
  const inYear = (x) => !y || (x.period === "once" ? !x.startDate || String(x.startDate).slice(0, 4) === y : x.ended ? String(x.endDate).slice(0, 4) >= y : !x.startDate || String(x.startDate).slice(0, 4) <= y);
  return (inc?.items ?? []).filter((x) => EARNED_WORD[x.type] && x.taxable !== false && (!x.active || x.period === "once") && (Number(x.amount) || 0) > 0)
    .map((x) => ({ personId: x.personId ?? null, name: nameOf(x.personId), what: EARNED_WORD[x.type], why: x.period === "once" ? "once" : x.ended ? "ended" : "starts", date: x.period === "once" ? null : x.ended ? x.endDate : x.startDate, amount: Number(x.amount) || 0, inYear: inYear(x) }));
}
/**
 * The plain words for `uncountedEarned` lines: "Dana's pay ended on August 15, 2026; this estimate counts only pay coming in
 * today", "Carlos's 119,600 of pay is one-time; this estimate counts no one-time pay", or "" with none.
 */
export function uncountedWords(all) {
  const list = (all ?? []).filter((x) => x.inYear !== false);
  if (!list.length) return "";
  const whose = (x) => (x.name ? W.nameOf(x.name) : "the");
  const bits = list.slice(0, 3).map((x) => (x.why === "once" ? `${whose(x)} ${fmtInt(x.amount)} of ${x.what} is one-time` : `${whose(x)} ${x.what} ${x.why === "ended" ? "ended" : "starts"} on ${dayWords(x.date)}`));
  const said = bits.length === 1 ? bits[0] : `${bits.slice(0, -1).join(", ")} and ${bits[bits.length - 1]}`;
  const counts = [list.some((x) => x.why !== "once") ? "only pay coming in today" : null, list.some((x) => x.why === "once") ? "no one-time pay" : null].filter(Boolean).join(", and ");
  return `${said.charAt(0).toUpperCase()}${said.slice(1)}; this estimate counts ${counts}.`;
}

/**
 * The itemized deductions that count, after the state-and-local cap, the medical floor and (from 2026)
 * the charity floor of 0.5% of income. On a separate return the cap, its floor and the income where
 * it starts shrinking are halved, and it shrinks at the full 30% (IRC §164(b)(7)).
 */
export function itemizedTotal(itemized, agi, status, params) {
  const it = itemized ?? {};
  const n = (k) => Math.max(0, Number(it[k]) || 0);
  const salt = params.saltCap ?? { cap: 10000 };
  const share = status === "married_separate" ? 0.5 : 1;
  let cap = salt.cap * share;
  if (salt.phaseOutStart) cap = Math.max((salt.floor ?? 0) * share, cap - Math.max(0, agi - salt.phaseOutStart * share) * (salt.phaseOutRate ?? 0.3));
  const stateAndLocal = Math.min(n("propertyTax") + n("stateTax"), cap);
  const medical = Math.max(0, n("medical") - 0.075 * Math.max(0, agi));
  const charityFloor = (params.charity?.floorRate ?? 0) * Math.max(0, agi);
  const charitable = Math.max(0, n("charitable") - charityFloor);
  const lines = [
    { key: "mortgageInterest", label: "Mortgage interest", amount: n("mortgageInterest") },
    { key: "salt", label: "State and local taxes", amount: stateAndLocal, note: n("propertyTax") + n("stateTax") > cap ? `capped at ${fmtInt(cap)}` : null },
    { key: "charitable", label: "Charitable gifts", amount: charitable, note: charityFloor > 0 && n("charitable") > 0 ? `over ${fmtInt(charityFloor)} (0.5% of income)` : null },
    { key: "medical", label: "Medical over 7.5% of income", amount: medical, note: n("medical") > 0 && medical === 0 ? "under the floor" : null },
    { key: "other", label: "Other", amount: n("other") },
  ];
  return { total: lines.reduce((s, l) => s + l.amount, 0), lines: lines.filter((l) => l.amount > 0 || l.note), saltCap: cap };
}

/** Net the year's sales the way Schedule D does: short and long offset each other; a net loss takes up to 3,000 off ordinary income. */
export function netGains(gains, filingStatus) {
  const rows = (gains ?? []).map((g) => ({ ...g, gain: (Number(g.proceeds) || 0) - (Number(g.basis) || 0) }));
  const shortTotal = rows.filter((g) => g.held !== "long").reduce((s, g) => s + g.gain, 0);
  const longTotal = rows.filter((g) => g.held === "long").reduce((s, g) => s + g.gain, 0);
  let netShort = shortTotal, netLong = longTotal;
  if (netShort < 0 && netLong > 0) { const use = Math.min(-netShort, netLong); netShort += use; netLong -= use; }
  else if (netLong < 0 && netShort > 0) { const use = Math.min(-netLong, netShort); netLong += use; netShort -= use; }
  const netLoss = Math.min(0, netShort + netLong);
  const lossAllowed = Math.max(netLoss, filingStatus === "married_separate" ? -1500 : -3000);
  return { rows, shortTotal, longTotal, netShort: Math.max(0, netShort), netLong: Math.max(0, netLong), netLoss, lossAllowed, carryForward: netLoss - lossAllowed };
}

/**
 * A sale today falls in today's tax year. When the Federal estimate is set to another year (say last year's return), work
 * today's year instead, without that year's sales typed on Capital gains (they belong to the set year). Used by Tax lots, Crypto, Home and Rental analysis. The typed figures
 * (pay, dividends) stay as the best guess at today's year. -> { plan, year, other (the set year, when it differs) }
 */
export function todaysReturn(plan, today) {
  const year = today ? Number(String(today).slice(0, 4)) : null, set = Number(plan.taxes?.year) || null;
  if (!year || !set || set === year) return { plan, year: set ?? year, other: null };
  return { plan: { ...plan, taxes: { ...(plan.taxes ?? {}), year: null, gains: [] } }, year, other: set };
}

/**
 * `inputs` with `add` (amounts such as { wages, medicareWages, otherOrdinary, qualifiedIncome, investmentIncome }, negative to
 * take off) added; filing separately, on the return of `personId` (both the total and that spouse's part, so the engine's
 * top-up rule in separateTax does not move it), or on the return `separateTo` names when that person has no return of their
 * own. Used by Employer stock, Home and Capital gains.
 */
export function addIncome(inputs, personId, add) {
  const plus = (o, k, v) => (Number(o[k] ?? (k === "medicareWages" ? o.wages : 0)) || 0) + v;
  const next = { ...inputs };
  for (const [k, v] of Object.entries(add)) if (v) next[k] = plus(inputs, k, v);
  if (Array.isArray(inputs.separate)) {
    const i = inputs.separate.findIndex((x) => x.personId != null && x.personId === personId);
    if (i >= 0) next.separate = inputs.separate.map((x, j) => (j !== i ? x : { ...x, ...Object.fromEntries(Object.entries(add).filter(([, v]) => v).map(([k, v]) => [k, plus(x, k, v)])) }));
  }
  return next;
}

/**
 * The capital loss carried to next year (IRC 1212(b)), by the Capital Loss Carryover Worksheet (Pub. 550 Worksheet 4-1):
 * taxable income (negative when it would be), the loss allowed this year (at most 3,000, 1,500 filing separately), the
 * year's net short-term and long-term results (Schedule D lines 7 and 15). Line 3 = taxable income + the allowed loss (the
 * "adjusted taxable income" of 1212(b)(2)(B), floor 0); line 4 = the smaller of that and the allowed loss; the short-term
 * loss not used by line 4 and the long-term gain carries as short-term; the long-term loss not used by the short-term gain
 * and what line 4 has left carries as long-term. So with taxable income below zero more than the loss over 3,000 carries.
 */
export function carryoverWorksheet({ taxableIncome, allowed, shortNet, longNet }) {
  const l2 = Math.max(0, Number(allowed) || 0);
  const l4 = Math.min(l2, Math.max(0, (Number(taxableIncome) || 0) + l2));
  const stLoss = Math.max(0, -shortNet), ltGain = Math.max(0, longNet), ltLoss = Math.max(0, -longNet), stGain = Math.max(0, shortNet);
  const short = Math.max(0, stLoss - (l4 + ltGain));
  const long = Math.max(0, ltLoss - (stGain + Math.max(0, l4 - stLoss)));
  return { short, long, total: short + long };
}

/** The carryover of a return worked by federalTax (`b` from taxInputs, `r` its result): each spouse's return on its own when filing separately (each with its own sales: the ones in their name and half the rest), added. */
export function lossCarryover(b, r) {
  const parts = r.separate
    ? r.separate.map((x, i) => ({ x, totals: b.separate?.[i]?.gainTotals ?? { short: b.gains.shortTotal / r.separate.length, long: b.gains.longTotal / r.separate.length } }))
    : [{ x: r, totals: { short: b.gains.shortTotal, long: b.gains.longTotal } }];
  return parts.reduce((acc, { x, totals }) => {
    const c = carryoverWorksheet({ taxableIncome: x.agi - x.deduction.amount - (x.deduction.qbi || 0), allowed: -x.income.capitalLoss, shortNet: totals.short, longNet: totals.long });
    return { short: acc.short + c.short, long: acc.long + c.long, total: acc.total + c.total };
  }, { short: 0, long: 0, total: 0 });
}

/**
 * Care for a child, for the child and dependent care credit (IRC 21), by the Expenses line's name:
 * - care named outright, in any category: day care, child care, a child minder, a nanny, a babysitter, an au pair,
 *   preschool, pre-K or nursery school, before- or after-school care (any spelling: "after school", "afterschool",
 *   "after-school"), a day camp (Pub. 503: "nursery school, preschool, or similar programs for children below the level
 *   of kindergarten are expenses for care"; "before- or after-school care of a child in kindergarten or a higher grade may
 *   be"; a day camp "even if the camp specializes in a particular activity, such as computers or soccer");
 * - in the "Childcare and school" category, also a line whose name only says care, a sitter, a nursery or a camp, unless
 *   it says schooling (tuition, school, kindergarten, college: "Expenses to attend kindergarten or a higher grade aren't
 *   expenses for care");
 * - never: a line in the Pets category or naming a pet ("Doggy daycare"), care for an adult ("Adult day care for Mom":
 *   21(b)(1)(B) and (C) cover a dependent or spouse who cannot care for themselves, which People does not record), child
 *   support ("Child support payments aren't for care"), tutoring, lessons and summer school ("Summer school and tutoring
 *   programs aren't for care"), an overnight camp (21(b)(2)(A); "The cost of sending your child to an overnight camp isn't
 *   considered a work-related expense").
 * A name that only names a kind of spending ("Diapers and formula", "Soccer and activities") is not care. Set up my plan's
 * "Childcare and school" row counts (its name says child care). Quotes: 2026 Pub. 503 draft, read 2026-11-02.
 */
export const CARE_NAME = /day[- ]?care|child[- ]?care|child[- ]?minder|nann(?:y|ies)|baby[- ]?sit|au[- ]?pair|pre[- ]?school|pre[- ]?k\b|pre[- ]?kindergarten|nursery school|(?:after|before)[- ]?school|day[- ]?camps?/i;
/** In the "Childcare and school" category: a name that only says care, a sitter, a nursery or a camp. */
export const CARE_WORD = /\bcare\b|\bsitters?\b|\bnursery\b|\bcamps?\b/i;
/** Never care, whatever else the name says. */
export const NEVER_CARE = /\bsupport\b|overnight|sleep[- ]?away|residential|boarding|tutor|lesson|summer school/i;
/** Schooling: not care unless the name names care outright ("Childcare and school", "Preschool tuition"). */
export const SCHOOLING = /tuition|\bschool\b|kindergarten|college|universit/i;
/** Not a child's care: a pet, or an adult. */
export const NOT_CHILD = /\b(?:dogs?|doggy|doggie|pupp(?:y|ies)|pets?|cats?|kennel|adults?|elder|elderly|seniors?|aging)\b|\bfor (?:my |our )?(?:mom|mum|dad|mother|father|parents?|grand(?:ma|pa|mother|father|parents?))\b/i;
export function isCare(x) {
  if (!x || x.category === "pets") return false;
  const name = String(x.name ?? "");
  if (NOT_CHILD.test(name) || NEVER_CARE.test(name)) return false;
  if (CARE_NAME.test(name)) return true;
  return x.category === "childcare" && CARE_WORD.test(name) && !SCHOOLING.test(name);
}

const DAYS_IN = (y, m) => [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
/**
 * What an expense line costs in calendar `year`: a recurring line its yearly amount for each month of the year it runs
 * (a month counts when the line runs on any day of it: Daycare ending August 31 is 8 months), a one-time line its amount
 * when its start date falls in the year. With `before` (an ISO date), only what falls before that day: the months before
 * its month, and that month's days before it (a child's 13th birthday: Form 2441 instructions, "the part of the year they
 * were under age 13"); a one-time line when its start date is before it.
 */
export function paidInYear(x, year, before = null) {
  const start = x?.startDate ? String(x.startDate) : "", end = x?.endDate ? String(x.endDate) : "";
  const cut = before ? String(before) : null;
  if (x?.period === "once") return start.slice(0, 4) === String(year) && (!cut || start < cut) ? Math.max(0, Number(x.amount) || 0) : 0;
  let months = 0;
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, "0");
    if (!((!start || start <= `${year}-${mm}-31`) && (!end || end >= `${year}-${mm}-01`))) continue;
    if (!cut || cut > `${year}-${mm}-31`) months++;
    else if (cut.slice(0, 7) === `${year}-${mm}`) months += (Number(cut.slice(8, 10)) - 1) / DAYS_IN(year, m);
  }
  return Math.max(0, perYear(x?.amount, x?.period)) * months / 12;
}

/** The care for a child on the Expenses page paid in `year` (before `before` when given) -> { lines: [{ id, name, amount }], total }. */
export function careExpenses(plan, year, before = null) {
  const lines = (plan.expenses ?? []).filter(isCare).map((x) => ({ id: x.id, name: x.name || "Child care", amount: paidInYear(x, year, before) })).filter((x) => x.amount > 0);
  return { lines, total: lines.reduce((s, x) => s + x.amount, 0) };
}

/** The month Benefits elections opens next year's choices (career/benefits DEFAULTS.enrollFromMonth; a test keeps the two equal). */
export const ENROLL_FROM_MONTH = 10;

/**
 * THE rule for the child care account (a dependent care FSA, IRC 129; Form 2441 Part III), used by every page through
 * taxInputs (`care.account`), careAccount and careInputsWith. Pure.
 *   people: [{ id, name, typed (the yearly amount chosen), earned (lines 18 and 19 before the account: pay as the return
 *     has it, after pre-tax 401(k), health FSA and HSA money, plus business income less half its self-employment tax),
 *     filer (the adult whose own earned income counts when not filing jointly) }]
 *   care: the care for a qualifying person incurred in the year (line 16); joint, separate: the filing status;
 *   limit: 7,500 from 2026 (5,000 before), 3,750 (2,500) on each separate return (129(a)(2)(A)); planMax: the most one
 *   employee's plan takes (the joint figure); typedWages: wages typed as W-2 box 1, which already leave the account out.
 * Each adult: elected = min(typed, planMax) (box 10 / line 12, what leaves the pay); the care is shared out in proportion to
 * the elections (so two accounts never pay the same care twice); forfeited = what is elected beyond that care (line 14:
 * "You forfeited an amount if you didn't receive it because you didn't incur the expense"): lost, so neither paid nor
 * taxed; received = elected - forfeited (line 15). Excluded (line 25) = received, at most the limit and the earned income
 * (lines 20 and 21: the lower earner's on a joint or separate return, the filer's otherwise; earned income here leaves the
 * account's money out); a joint (or single) return caps the household's total and shares it by what each received, a
 * separate return caps its own. taxedAsPay = received - excluded (line 26, Form 1040 line 1e). Wages and Medicare wages
 * come down by excluded + forfeited (`off`): the forfeited money is never paid, the taxed part stays pay.
 * -> { people: [{ id, name, typed, elected, care, forfeited, received, excluded, taxedAsPay, off, earned18 }], elected,
 *    forfeited, received, excluded, taxedAsPay, off, care, limit, planMax, joint, separate, overLimit, earnedCapped }
 */
export function careAccountRule({ people = [], care = 0, joint = false, separate = false, limit = 0, planMax = Infinity, typedWages = false } = {}) {
  const C = Math.max(0, Number(care) || 0);
  const rows = people.map((p) => ({ id: p.id ?? null, name: p.name ?? null, filer: !!p.filer, typed: Math.max(0, Number(p.typed) || 0), earnedBefore: Number(p.earned) || 0 }));
  for (const x of rows) { x.elected = Math.min(x.typed, planMax); x.earned18 = Math.max(0, x.earnedBefore - (typedWages ? 0 : x.elected)); }
  const E = rows.reduce((s, x) => s + x.elected, 0);
  for (const x of rows) {
    x.care = E > 0 ? C * x.elected / E : 0;
    x.forfeited = Math.max(0, x.elected - x.care);
    x.received = x.elected - x.forfeited;
  }
  const received = rows.reduce((s, x) => s + x.received, 0);
  let overLimit = false, earnedCapped = false;
  if (separate) {
    const low = rows.length ? Math.min(...rows.map((x) => x.earned18)) : 0;
    for (const x of rows) {
      x.excluded = Math.min(x.received, limit, low);
      if (x.received > limit + 0.005) overLimit = true;
      if (low < Math.min(x.received, limit) - 0.005) earnedCapped = true;
    }
  } else {
    const filer = rows.find((x) => x.filer) ?? rows[0];
    const cap = joint && rows.length >= 2 ? Math.min(...rows.map((x) => x.earned18)) : filer ? filer.earned18 : 0;
    const total = Math.min(received, limit, cap);
    overLimit = received > limit + 0.005;
    earnedCapped = cap < Math.min(received, limit) - 0.005;
    for (const x of rows) x.excluded = received > 0 ? total * x.received / received : 0;
  }
  for (const x of rows) { x.taxedAsPay = Math.max(0, x.received - x.excluded); x.off = x.excluded + x.forfeited; }
  const sum = (k) => rows.reduce((s, x) => s + x[k], 0);
  return {
    people: rows.map(({ earnedBefore, ...x }) => x), elected: E, forfeited: sum("forfeited"), received, excluded: sum("excluded"), taxedAsPay: sum("taxedAsPay"), off: sum("off"),
    care: C, limit, planMax, joint: !!joint, separate: !!separate, overLimit, earnedCapped,
  };
}

/**
 * taxInputs(plan, { today }) -> { year, params, filingStatus, inputs (for federalTax), sources: [{ key, label, amount, from: "plan" | "typed", detail }],
 *   notes: [text], itemized: { total, lines, saltCap }, people: { ages65plus, dependentsUnder17, otherDependents, adults }, pretax401k, standard, gains }
 * `inputs.itemized` is the total after caps, worked out against the AGI the plan implies.
 */
export function taxInputs(plan, params = {}) {
  const today = params.today ?? null;
  const t = plan.taxes ?? {}, ty = t.thisYear ?? {};
  const year = Number(t.year) || (today ? Number(String(today).slice(0, 4)) : new Date().getFullYear());
  const P0 = paramsFor(FEDERAL, year, { inflation: Number(plan.assumptions?.inflation ?? 0.03) });
  // a year past the last tax table inflates the wage base; SSA publishes next year's every October (2027: $192,300), so a published one wins
  const P1 = MAXIMUM_EARNINGS[year] ? { ...P0, ssWageBase: MAXIMUM_EARNINGS[year] } : P0;
  const filingStatus = P1.status[plan.household?.filingStatus] ? plan.household.filingStatus : "single";
  // filing separately, Social Security is taxed from the first dollar (base 0) unless the spouses lived apart all year,
  // when the single figures apply (IRC 86(c)(1)(C)(ii) and (c)(2)(C); the tables hold the living-together zero)
  const livedApart = filingStatus === "married_separate" && t.livedApart === true;
  const P = livedApart ? { ...P1, ssTaxation: { ...P1.ssTaxation, married_separate: P1.ssTaxation.single } } : P1;
  const inc = computeIncome(plan, { today });
  const active = inc.active.filter((x) => x.taxable !== false);
  const sumType = (...types) => active.filter((x) => types.includes(x.type)).reduce((s, x) => s + x.yearly, 0);
  const accounts = plan.accounts ?? [];
  const notes = [], sources = [];
  const typed = (k) => ty[k] !== null && ty[k] !== undefined && ty[k] !== "";
  const L = limitsFor(year);
  // the people: each adult's pay and contributions, for the limits that are per person (401(k), IRA)
  const people = plan.household?.people ?? [];
  const ageAtYearEnd = (p) => p?.birthDate ? year - Number(String(p.birthDate).slice(0, 4)) : null;
  const adults = people.filter((p) => p.role !== "dependent");
  const me = adults.find((p) => p.role === "self") ?? adults[0] ?? null;
  const adultOf = (id) => adults.find((p) => p.id === id) ?? null;
  // a row or pay that names no adult is the household's: it goes on the adult marked "Me"
  const contribs = (plan.retirement?.contributions ?? []).map((c) => {
    const acct = accounts.find((a) => a.id === c.accountId);
    return { ...c, yearly: perYear(c.amount, c.period), accountType: acct?.type, kind: limitKind(acct?.type, acct?.name, Number(c.employerMatch) || 0), owner: adultOf(c.personId) ?? adultOf(acct?.ownerId) ?? me };
  });
  const payItems = active.filter((x) => x.type === "salary" || x.type === "bonus");
  const payTotal = payItems.reduce((s, x) => s + x.yearly, 0);
  const businessItems = active.filter((x) => x.type === "business");
  const sumOf = (rows) => rows.reduce((s, c) => s + c.yearly, 0);
  const K = L.kinds["401k"], I = L.kinds.ira;
  const k401People = (adults.length ? adults : [null]).map((p) => {
    const mine = contribs.filter((c) => c.owner === p);
    const pretax = sumOf(mine.filter((c) => c.accountType === "401k")), roth = sumOf(mine.filter((c) => c.accountType === "roth" && c.kind === "401k"));
    const ownOf = (items) => (p ? items.filter((x) => (adultOf(x.personId) ?? me) === p) : items).reduce((s, x) => s + x.yearly, 0);
    const pay = ownOf(payItems);
    // compensation for the catch-up cap is 415(c)(3)'s: the pay, and for someone self-employed the earned income
    // (415(c)(3)(B), 401(c)(2)), here the Income page's business figure, so a solo 401(k) keeps its catch-up
    const compensation = pay + ownOf(businessItems);
    // the catch-up is at most the compensation left after the other deferrals (IRC 414(v)(2)(A)(ii)); pre-tax money over
    // the limit plus the catch-up is pay this year, Roth money counting as the excess first (402(g)(1)(A), last sentence)
    const catchUp = Math.min(catchUpFor(K, ageAtYearEnd(p)), Math.max(0, compensation - Math.min(pretax + roth, K.limit)));
    const limit = K.limit + catchUp, excluded = Math.min(pretax, limit);
    return { id: p?.id ?? null, name: p?.name ?? "You", age: ageAtYearEnd(p), pay, compensation, pretax, roth, limit, catchUp, excluded, inIncome: pretax - excluded };
  });
  const pretax401k = k401People.reduce((s, x) => s + x.excluded, 0);
  const k401Over = k401People.reduce((s, x) => s + x.inIncome, 0);
  // the traditional IRA: deducted (assumed deductible) up to each person's IRA limit plus catch-up (219(b)(1), (b)(5))
  const iraPeople = (adults.length ? adults : [null]).map((p) => {
    const traditional = sumOf(contribs.filter((c) => c.owner === p && c.accountType === "ira"));
    const limit = I.limit + catchUpFor(I, ageAtYearEnd(p));
    return { id: p?.id ?? null, name: p?.name ?? "You", traditional, limit, deductible: Math.min(traditional, limit) };
  });
  const iraDeductible = iraPeople.reduce((s, x) => s + x.deductible, 0);
  const iraOver = iraPeople.reduce((s, x) => s + x.traditional - x.deductible, 0);
  // the health FSA election is a cafeteria-plan salary reduction, not wages, up to the year's limit (IRC 125(i), 3121(a)(5)(G)),
  // a limit for each employee
  // each employee elects their own FSA up to the limit (Pub. 969): the adult marked "Me" (`fsa`) and the other adult (`fsaPartner`)
  const fsaLimit = L.kinds.fsa?.limit ?? Infinity;
  const partnerAdult = adults.find((p) => p !== me) ?? null;
  const fsaPeople = [{ who: me, election: Math.max(0, Number(t.hsa?.fsa) || 0) }, { who: partnerAdult, election: partnerAdult ? Math.max(0, Number(t.hsa?.fsaPartner) || 0) : 0 }]
    .filter((x, i) => i === 0 || x.who).map((x) => ({ id: x.who?.id ?? null, name: x.who?.name ?? null, election: x.election, excluded: Math.min(x.election, fsaLimit) }));
  const fsaElection = fsaPeople.reduce((s, x) => s + x.election, 0), fsaExcluded = fsaPeople.reduce((s, x) => s + x.excluded, 0);
  const fsaOf = (p) => fsaPeople.find((x) => x.id !== null && x.id === p?.id)?.excluded ?? 0;
  // HSA money through pay is kept out of income and payroll tax only up to the household's limit for its cover (106(d)(1),
  // 223(b); none without a high-deductible plan); the excess is pay, the employer's part of it included (Pub. 969)
  const hsa = hsaPicture(plan, year);
  const hsaPayroll = hsa.household.payroll, hsaExcess = hsa.household.excess;
  const wagesTyped = typed("wages");
  // typed wages are W-2 box 1, which already leaves out the HSA money from pay within the limit (and has any excess in it):
  // nothing more comes off for the HSA then (Pub. 969: "excluded from your income"; box 12 code W)
  const hsaContrib = wagesTyped ? 0 : Math.max(0, hsaPayroll - hsaExcess), hsaEmployerTaxed = Math.max(0, hsaExcess - hsaPayroll);
  // the child and dependent care credit (IRC 21, Form 2441) and the child care account (dependent care FSA, IRC 129), worked
  // before the wages because the account's money is not wages: W-2 box 1 leaves it out and Form 2441 line 26 adds back only
  // what is over the exclusion (line 25), so wages = pay less the excluded part (the research spec's example B: 62,000 of pay
  // with a 5,000 account is 57,000 of AGI). README "Child and dependent care credit".
  const deps = people.filter((p) => p.role === "dependent");
  const CC = P.careCredit ?? null;
  let care = null, dcOff = 0;
  const dcOwn = new Map();   // adult id -> the child care account money left out of their wages
  if (CC) {
    // qualifying persons (21(b)(1)(A)): dependents under 13 at the end of the year, and a child who turns 13 during it for the
    // part of the year before the birthday (Form 2441 instructions); the 3,000 / 6,000 limit is not prorated (Pub. 503)
    const ageEnd = (p) => p?.birthDate && /^\d{4}/.test(String(p.birthDate)) ? year - Number(String(p.birthDate).slice(0, 4)) : null;
    const careKids = deps.filter((p) => ageEnd(p) !== null && ageEnd(p) >= 0 && ageEnd(p) < 13);
    const turning13 = deps.filter((p) => ageEnd(p) === 13 && /^\d{4}-\d{2}-\d{2}/.test(String(p.birthDate)) && String(p.birthDate).slice(5, 10) > "01-01")
      .map((p) => ({ id: p.id, name: p.name, until: `${year}-${String(p.birthDate).slice(5, 10)}` }));
    const undatedKids = deps.filter((p) => ageEnd(p) === null);
    const persons = careKids.length + turning13.length;
    // with no child under 13 all year, only the care paid before the last 13th birthday counts
    const until = careKids.length ? null : turning13.map((x) => x.until).sort().pop() ?? null;
    const careAll = careExpenses(plan, year);
    const careLines = until ? careExpenses(plan, year, until) : careAll;
    const careCounted = persons > 0 ? careLines.total : 0;
    // earned income (21(d)(1); Form 2441 instructions, "Earned income") per adult, as the return has it: pay less what stays
    // out of income (pre-tax 401(k), the health FSA, HSA money from pay within the limit; typed wages, W-2 box 1, shared by
    // pay), plus their business income less half its self-employment tax (15.3% of 92.35% of the profit, the 12.4% part only
    // up to the wage base left after pay; none under 400 of earnings, IRC 1402(b)); the child care account comes off below
    const two = adults.slice(0, 2);
    const rows = (two.length ? two : [null]).map((p) => {
      const i = p ? adults.indexOf(p) : 0, k = k401People[i], h = hsa.people?.[i] ?? { payroll: hsaPayroll, excess: hsaExcess };
      const pay = !p ? (wagesTyped ? Number(ty.wages) : Math.max(0, payTotal - pretax401k - fsaExcluded - hsaContrib) + hsaEmployerTaxed)
        : wagesTyped ? Number(ty.wages) * (payTotal > 0 ? (k?.pay ?? 0) / payTotal : 1 / Math.max(1, two.length))
        : Math.max(0, (k?.pay ?? 0) - (k?.excluded ?? 0) - fsaOf(p) - Math.max(0, h.payroll - h.excess)) + Math.max(0, h.excess - h.payroll);
      const biz = businessItems.filter((x) => !p || (adultOf(x.personId) ?? me) === p).reduce((s, x) => s + x.yearly, 0);
      const se = biz * 0.9235;
      const halfSe = se >= 400 ? 0.5 * (0.124 * Math.min(se, Math.max(0, (P.ssWageBase ?? Infinity) - (k?.pay ?? 0))) + 0.029 * se) : 0;
      return { id: p?.id ?? null, name: p?.name ?? "You", pay, business: biz - halfSe };
    });
    // the child care account chosen on Benefits elections (`whatIfs.benefits[adultId].dcfsaElect`) for this tax year: its plan
    // year as that page has it (typed, else next year's from October, `ENROLL_FROM_MONTH`), as the Paycheck page counts it
    const all = plan.whatIfs?.benefits ?? {};
    const tY = today ? Number(String(today).slice(0, 4)) : year, tM = today ? Number(String(today).slice(5, 7)) : 1;
    const openYear = tM >= ENROLL_FROM_MONTH ? tY + 1 : tY;
    const planYearOf = (b) => (b?.planYear === null || b?.planYear === undefined || b?.planYear === "" || !Number.isFinite(Number(b?.planYear)) ? openYear : Number(b.planYear));
    const electOf = (id) => { const b = all[id] ?? {}; return id !== null && planYearOf(b) === year ? Math.max(0, Number(b.dcfsaElect) || 0) : 0; };
    const later = adults.filter((p) => Number(all[p.id]?.dcfsaElect) > 0 && planYearOf(all[p.id]) !== year).map((p) => ({ id: p.id, name: p.name, planYear: planYearOf(all[p.id]) }));
    const separateReturn = filingStatus === "married_separate";
    const benefitLimit = separateReturn ? CC.benefitLimitSeparate : CC.benefitLimit;
    const joint = filingStatus === "married_joint" && rows.length >= 2;
    const spouseUnknown = filingStatus === "married_joint" && rows.length < 2;
    const filer = rows.find((x) => x.id !== null && x.id === me?.id) ?? rows[0];
    // the one rule (careAccountRule): forfeited beyond the care, excluded up to the limit and the earned income, the rest
    // taxed as pay; the care is the qualifying care (careCounted: none without a child under 13)
    const account = careAccountRule({
      people: rows.map((x) => ({ id: x.id, name: x.name, typed: electOf(x.id), earned: x.pay + x.business, filer: x === filer })),
      care: careCounted, joint, separate: separateReturn, limit: benefitLimit, planMax: CC.benefitLimit, typedWages: wagesTyped,
    });
    account.year = year; account.later = later;
    rows.forEach((x, i) => Object.assign(x, { acct: account.people[i] }));
    const benefits = account.excluded;
    // lines 4 and 5: the earned income on the return, the account's taxable rest (line 1e) still in it; typed wages (box 1)
    // already leave the account's money out, so only its taxable rest is added
    for (const x of rows) { x.wages = Math.max(0, wagesTyped ? x.pay + x.acct.taxedAsPay : x.pay - x.acct.off); x.earned = Math.max(0, x.wages + x.business); }
    // a joint return with one adult on People: the spouse's earned income is not known, so no credit (21(d)(1)(B)), with a note
    const earnedLow = spouseUnknown ? 0 : joint ? Math.min(...rows.map((x) => x.earned)) : filer.earned;
    dcOff = wagesTyped ? -account.taxedAsPay : account.off;
    for (const x of rows) if (x.id !== null) dcOwn.set(x.id, wagesTyped ? -x.acct.taxedAsPay : x.acct.off);
    care = {
      expenses: careLines.total, persons, benefits, earnedLow, lines: careLines.lines, expensesAll: careAll.total, linesAll: careAll.lines,
      kids: careKids.map((p) => p.name), turning13, undated: undatedKids.map((p) => p.name), elected: account.elected, later, benefitLimit, offWages: dcOff,
      forfeited: account.forfeited, taxedAsPay: account.taxedAsPay, account,
      earnedPeople: rows.map((x) => ({ id: x.id, name: x.name, pay: x.pay, wages: x.wages, business: x.business, earned: x.earned, typed: x.acct.typed, elected: x.acct.elected, excluded: x.acct.excluded, forfeited: x.acct.forfeited, taxedAsPay: x.acct.taxedAsPay })),
      joint, spouseUnknown, filerId: filer.id, wagesTyped,
    };
  }
  // the wages the Income page implies (what Budget and Next best action tax: yearTaxes), the child care account's money off
  // as the one rule has it even when box 1 is typed here
  const dcOffPlan = care ? care.account.off : 0;
  const wagesPlan = Math.max(0, payTotal - pretax401k - fsaExcluded - dcOffPlan) + hsaEmployerTaxed;
  const wagesAuto = Math.max(0, payTotal - pretax401k - fsaExcluded - dcOff) + hsaEmployerTaxed;
  // typed wages are box 1, which leaves the account's money out; its taxable rest (Form 2441 line 26) is added (line 1e)
  const wages = wagesTyped ? Number(ty.wages) - dcOff : wagesAuto;
  const dcTaxed = care ? care.account.taxedAsPay : 0, dcLost = care ? care.account.forfeited : 0, dcKept = care ? care.account.excluded : 0;
  const wageParts = [pretax401k > 0 ? `less ${fmtInt(pretax401k)} of pre-tax 401(k) contributions` : null, fsaExcluded > 0 ? `less the ${fmtInt(fsaExcluded)} health FSA` : null,
    dcKept > 0.5 ? `less the ${fmtInt(dcKept)} child care account${dcTaxed > 0.5 ? ` that stays out of income` : ""}` : null, dcLost > 0.5 ? `less ${fmtInt(dcLost)} of it that would be lost (no care to pay)` : null,
    hsaEmployerTaxed > 0 ? `plus ${fmtInt(hsaEmployerTaxed)} of employer HSA money over the limit` : null].filter(Boolean);
  sources.push({ key: "wages", label: "Wages", amount: wages, from: wagesTyped ? "typed" : "plan", detail: wagesTyped ? `as typed (W-2 box 1: pre-tax 401(k), HSA, FSA and child care account money from pay are already left out)${dcTaxed > 0.5 ? `, plus ${fmtInt(dcTaxed)} of the child care account taxed as pay` : ""}` : `pay and bonuses on the Income page${wageParts.length ? `, ${wageParts.join(", ")}` : ""}` });
  if (!wagesTyped && k401Over > 0) notes.push(`${fmtInt(k401Over)} of pre-tax 401(k) money is over this year's limit, so it is taxed as pay. Ask the plan to pay it back by April 15, or it is taxed again when it comes out.`);
  for (const x of fsaPeople) if (!wagesTyped && x.election > x.excluded) notes.push(`${fsaPeople.length > 1 && x.name ? `${W.NameOf(x.name)} health FSA` : "The health FSA"} election is over this year's limit of ${fmtInt(fsaLimit)}: only ${fmtInt(x.excluded)} comes off ${fsaPeople.length > 1 && x.name ? W.nameOf(x.name) : "your"} pay before tax.`);
  const business = sumType("business"), rental = sumType("rental"), pension = sumType("pension"), investment = sumType("investment"), other = sumType("other");
  let gains = netGains(t.gains, filingStatus);
  const otherTyped = Number(ty.otherOrdinary) || 0;
  const otherOrdinary = Math.max(0, business + rental + pension + investment + other + otherTyped + gains.netShort);
  if (pension) sources.push({ key: "pension", label: "Pensions", amount: pension, from: "plan", detail: "Income page" });
  if (business) { sources.push({ key: "business", label: "Self-employment", amount: business, from: "plan", detail: "Income page; self-employment tax is not included" }); notes.push("Self-employment income is taxed here as ordinary income; the 15.3% self-employment tax on it is not included yet."); }
  if (rental) sources.push({ key: "rental", label: "Rent", amount: rental, from: "plan", detail: "Income page, before expenses" });
  if (investment) sources.push({ key: "investment", label: "Dividends and interest", amount: investment, from: "plan", detail: "Income page, counted as ordinary; type the qualified part below" });
  if (other) sources.push({ key: "other", label: "Other income", amount: other, from: "plan", detail: "Income page" });
  if (otherTyped) sources.push({ key: "otherTyped", label: "Other ordinary income", amount: otherTyped, from: "typed", detail: "interest, IRA withdrawals, conversions" });
  if (gains.netShort > 0) sources.push({ key: "shortGains", label: "Short-term gains", amount: gains.netShort, from: "plan", detail: "Capital gains page" });
  if (gains.netLoss < 0) sources.push({ key: "loss", label: "Capital loss allowed", amount: gains.lossAllowed, from: "plan", detail: gains.carryForward < 0 ? `${fmtInt(-gains.netLoss)} lost in all; ${fmtInt(-gains.carryForward)} carries forward` : "Capital gains page" });
  const qualifiedTyped = Number(ty.qualifiedIncome) || 0;
  const qualifiedIncome = Math.max(0, qualifiedTyped + gains.netLong);
  if (qualifiedTyped) sources.push({ key: "qualified", label: "Qualified dividends", amount: qualifiedTyped, from: "typed" });
  if (gains.netLong > 0) sources.push({ key: "longGains", label: "Long-term gains", amount: gains.netLong, from: "plan", detail: "Capital gains page" });
  const ssAuto = sumType("social");
  const socialSecurity = typed("socialSecurity") ? Number(ty.socialSecurity) : ssAuto;
  if (socialSecurity) sources.push({ key: "social", label: "Social Security", amount: socialSecurity, from: typed("socialSecurity") ? "typed" : "plan", detail: typed("socialSecurity") ? "as typed" : "Income page; only part of it is taxed" });
  const taxExemptInterest = Number(ty.taxExemptInterest) || 0;
  const adjustmentsTyped = Number(ty.adjustments) || 0;
  const adjustments = adjustmentsTyped + iraDeductible + hsaContrib;
  if (iraDeductible) sources.push({ key: "ira", label: "IRA contributions", amount: -iraDeductible, from: "plan", detail: `Contributions page; assumed deductible${iraOver > 0 ? `; ${fmtInt(iraOver)} over the IRA limit is not deducted` : ""}` });
  if (iraOver > 0) notes.push(`${fmtInt(iraOver)} of traditional IRA money is over this year's limit, so it is not deducted. Take it out (with what it earned) before the filing deadline to avoid a 6% tax each year it stays.`);
  if (hsaContrib) sources.push({ key: "hsa", label: "HSA contributions", amount: -hsaContrib, from: "plan", detail: `HSA page or Contributions page${hsaExcess > 0 ? `; ${fmtInt(hsaExcess)} over the limit for your cover is taxed as pay` : ""}` });
  if (hsaExcess > 0) notes.push(hsa.household.limit === 0 && hsa.coverage === "none"
    ? `${fmtInt(hsaExcess)} goes into an HSA, but the HSA page says you have no high-deductible health plan, so it is taxed as pay.`
    : `${fmtInt(hsaExcess)} of HSA money is over the limit for your cover, so it is taxed as pay. The HSA and FSA page shows who is over.`);
  if (adjustmentsTyped) sources.push({ key: "adjustments", label: "Other adjustments", amount: -adjustmentsTyped, from: "typed" });
  // the people: age allowances and dependents by age at the end of the tax year
  const ages65plus = adults.filter((p) => ageAtYearEnd(p) !== null && ageAtYearEnd(p) >= 65).length;
  const under17Auto = deps.filter((p) => ageAtYearEnd(p) === null || ageAtYearEnd(p) < 17).length;
  const given = (v) => v !== null && v !== undefined && v !== "";
  const dependentsUnder17 = given(t.dependentsUnder17) ? Number(t.dependentsUnder17) : under17Auto;
  const otherDependents = given(t.otherDependents) ? Number(t.otherDependents) : deps.length - under17Auto;
  const paid = (Number(ty.paid) || 0) + (t.estimated?.paid ?? []).reduce((s, x) => s + (Number(x) || 0), 0);
  // earned income on the Income page this year's estimate leaves out (ended, not started, one-time), by person: the notes
  // below say "counted for <year>" and why for those, not "none is on the Income page"
  const uncounted = uncountedEarned(inc, people, year);
  // nothing counted at all (no line coming in, or only one-time ones): the note at the end says so once, with the reason
  const nothingCounted = !typed("wages") && (!active.length || (uncounted.length > 0 && active.every((x) => x.period === "once")));
  const uncountedOf = (ids) => uncounted.filter((x) => ids.includes(x.personId) || (x.personId === null || !adultOf(x.personId) ? ids.includes(me?.id ?? null) : false));
  // the child care credit's figures (worked above, before the wages): where they came from, and why there is none
  if (care) {
    const c = care, say = (names) => names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
    // a separate return gets no child care credit (21(e)(2)): the care is the child care account's only, never "for the credit"
    const forWhat = filingStatus === "married_separate" ? (c.elected > 0 ? "for the child care account (a separate return gets no child care credit)" : "a separate return gets no child care credit for it") : "for the child care credit";
    if (c.expensesAll > 0) sources.push({ key: "care", label: "Child care paid", amount: c.expensesAll, from: "plan", detail: `Expenses page (${c.linesAll.map((x) => `${x.name} ${fmtInt(x.amount)}`).join(", ")})${c.persons > 0 ? `; ${forWhat}${c.expenses < c.expensesAll - 0.5 ? `, ${fmtInt(c.expenses)} of it before the 13th birthday` : ""}` : "; it does not count here: the note above says why"}` });
    if (c.expensesAll > 0 && !c.persons) {
      if (!deps.length) notes.push("Child care is on the Expenses page, but no child is on the People page, so the child care credit is not counted. Add your child there, with their birth date, and the credit comes off your tax.");
      else if (c.undated.length) notes.push(`Child care is on the Expenses page, but ${c.undated.length === 1 ? `${c.undated[0]} has` : `${say(c.undated)} have`} no birth date on the People page, so the child care credit is not counted. Add ${c.undated.length === 1 ? "it" : "them"} and the credit comes off your tax.`);
      else notes.push(`Child care is on the Expenses page, but no child on the People page is under 13 in ${year}, so it does not count for the child care credit. (Care for an older child or an adult who cannot look after themselves can count; the plan does not track that.)`);
    }
    if (c.persons > 0 && c.turning13.length && c.expenses < c.expensesAll - 0.5) notes.push(`${say(c.turning13.map((x) => x.name))} ${c.turning13.length === 1 ? "turns" : "turn"} 13 in ${year}, so only the care paid before the birthday counts for the child care credit: ${fmtInt(c.expenses)} of the ${fmtInt(c.expensesAll)}.`);
    if (c.expenses > 0 && c.persons > 0 && filingStatus === "married_separate") notes.push("Filing separately, the child care credit is not allowed, so it is not counted. A married parent who lived apart from their spouse for the last six months of the year and paid most of the cost of the home can usually file as head of household instead, which gets it; the Which way to file page compares the ways to file.");
    if (c.expenses > 0 && c.persons > 0 && c.spouseUnknown) notes.push("Filing jointly, the child care credit is worked on the lower of the two pays, and the People page lists only one adult, so the credit is not counted. Add your spouse there, with their pay on the Income page, and it is.");
    // no earned income on the return's lower side: care counts only up to it (21(d)(1)), so there is no credit; say why
    // (Review 2026-11-06, verifier follow-up: Kim & Lou, 70,000 + 0 filing jointly, read a $0 child care credit with no reason).
    // A spouse who is a full-time student or cannot look after themselves counts as earning 250 / 500 a month (21(d)(2)).
    // Pay on the Income page that the estimate does not count (ended, not started, one-time) is said as "counted for <year>"
    // with the reason, so the note does not claim none is on the Income page (Review 2026-11-06, verifier follow-up)
    if (c.expenses > 0 && c.persons > 0 && filingStatus !== "married_separate" && !c.spouseUnknown && !(c.earnedLow > 0.5)) {
      const none = c.joint ? c.earnedPeople.filter((x) => !(x.earned > 0.5)) : [];
      const lost = uncountedOf(c.joint ? none.map((x) => x.id) : [c.filerId]);
      const where = lost.length ? `counted for ${year}` : "on the Income page";
      const so = lost.length ? "so this estimate has no child care credit" : "so there is no child care credit";
      // typed wages go to the filer on a return with one adult; on a joint return they are shared by pay, so the hint is not given
      const said = nothingCounted ? "" : uncountedWords(lost);
      const hint = `${said ? ` ${said}` : ""}${!c.joint && lost.some((x) => x.inYear) ? " To count what was paid this year, type it as Wages this year below." : ""}`;
      notes.push(c.joint
        ? `Filing jointly, child care counts for the child care credit only up to the lower of your two earned incomes, and ${none.length === 1 && none[0].name ? `${W.nameIn(none[0].name)} ${W.verbFor(none[0].name, "has", "have")} no` : "neither of you has"} pay or business income ${where}, ${so}.${hint} (A spouse who was a full-time student for five months of the year, or could not look after themselves, counts as earning $250 a month for one child or $500 for two or more; the plan does not track that.)`
        : `Child care counts for the child care credit only up to your earned income (pay or business profit), and none is ${where}, ${so}.${hint}`);
    }
    if (!c.elected && c.later.length) notes.push(`The child care account on Benefits elections is chosen for ${c.later[0].planYear}, so it is not counted in ${year}'s tax. (If it is this year's, choose ${year} as the year on that page.)`);
    // the child care account (careAccountRule): over a plan's own limit, lost beyond the care, taxed beyond the limit or the pay
    const A = c.account, many = A.people.filter((x) => x.typed > 0).length > 1;
    const whose = (x) => (many && x.name ? W.NameOf(x.name) : "The");
    for (const x of A.people) if (x.typed > A.planMax + 0.5) notes.push(`${whose(x)} child care account is set to ${fmtInt(x.typed)} on Benefits elections; a plan takes at most ${fmtInt(A.planMax)} a year, so ${fmtInt(A.planMax)} is counted.`);
    if (A.forfeited > 0.5) notes.push(A.care <= 0.5
      ? `A child care account of ${fmtInt(A.elected)} is chosen on Benefits elections, but ${!c.persons ? `no child on the People page is under 13 in ${year}, so it has no care to pay for` : "no care for a child is on the Expenses page"}. The account only pays back care, so you would lose the ${fmtInt(A.forfeited)}: it is not paid to you, and it is not taxed. ${!c.persons ? "Check the birth dates on People" : "Add the care on Expenses"}, or choose less on Benefits elections.`
      : `You would lose ${fmtInt(A.forfeited)} of the ${fmtInt(A.elected)} in the child care account${many ? "s" : ""}: only ${fmtInt(A.care)} of care for a child is on the Expenses page, and the account only pays back care. The money lost is not paid to you, and it is not taxed.`);
    if (A.taxedAsPay > 0.5) {
      if (A.separate) {
        for (const x of A.people.filter((y) => y.taxedAsPay > 0.5)) notes.push(x.received > A.limit + 0.005
          ? `${x.name ? W.NameOf(x.name) : "The"} child care account pays ${fmtInt(x.received)} of care, over the ${fmtInt(A.limit)} a separate return can keep out of income: ${fmtInt(x.taxedAsPay)} of it is taxed as pay${x.name ? ` on ${W.nameOf(x.name)} return` : ""}.`
          : `Only ${fmtInt(x.excluded)} of ${x.name ? W.nameOf(x.name) : "the"} child care account stays out of income on a separate return: no more than the lower earner's earned income. The other ${fmtInt(x.taxedAsPay)} is taxed as pay.`);
      } else {
        // two accounts: the part taxed as pay is shared by what each put in, the split every page says (Benefits, Paycheck)
        const split = many ? ` (${A.people.filter((x) => x.taxedAsPay > 0.5).map((x) => `${x.name === null || x.name === undefined ? "one" : W.nameIn(x.name)} ${fmtInt(x.taxedAsPay)}`).join(", ")}, by what each put in)` : "";
        // none of it out of income (no earned income on the lower side): "None of", not "Only 0 of" (Review 2026-11-06)
        const zero = A.joint ? (c.earnedPeople ?? []).filter((x) => !(x.earned > 0.5)) : [];
        // "has none counted for <year>" when that pay is on the Income page but ended, has not started or is one-time
        const tail = uncountedOf(A.joint ? zero.map((x) => x.id) : [c.filerId]).length ? ` counted for ${year}` : "";
        notes.push(A.earnedCapped && A.excluded < 0.5
          ? `None of the ${fmtInt(A.received)} child care account${many ? "s" : ""} stays out of income: no more than ${A.joint ? `the lower earner's earned income (${zero.length === 1 && zero[0].name ? `${W.nameIn(zero[0].name)} ${W.verbFor(zero[0].name, "has", "have")} none${tail}` : `there is none${tail}`})` : `your earned income (there is none${tail})`}. All ${fmtInt(A.taxedAsPay)} is taxed as pay${split}.`
          : A.earnedCapped
          ? `Only ${fmtInt(A.excluded)} of the ${fmtInt(A.received)} child care account${many ? "s" : ""} stays out of income: no more than ${A.joint ? "the lower earner's earned income" : "your earned income"}. The other ${fmtInt(A.taxedAsPay)} is taxed as pay${split}.`
          : `The child care account${many ? "s" : ""} pay${many ? "" : "s"} ${fmtInt(A.received)} of care, over this year's limit of ${fmtInt(A.limit)} for the household: ${fmtInt(A.taxedAsPay)} of it is taxed as pay${split}.`);
      }
    }
  }
  // net investment income for the 3.8% tax (Form 8960): dividends and interest, the typed qualified dividends and the year's net gain or allowed loss; rent is left out (only its gross is known)
  const investmentIncome = Math.max(0, investment + qualifiedTyped + gains.netShort + gains.netLong + gains.lossAllowed);
  // Medicare wages for the 0.9% additional Medicare tax (W-2 box 5, Form 8959 line 1): pay before pre-tax 401(k) saving
  // (IRC 3121(v)(1)(A)), less the health FSA, the HSA payroll money within the limit (3121(a)(5)(G)) and the child care
  // account's whole election up to a plan's own limit (3121(a)(18): out of Social Security and Medicare wages when it is
  // reasonable to believe it can be excluded; W-2 box 10 instructions: only an amount over the plan's limit goes in boxes 1,
  // 3 and 5). The part over the household's limit is added back for income tax only (Form 2441 line 26), and money lost
  // beyond the care is never paid. Typed wages (box 1) are taken as they are, without that income-tax add-back
  const dcPayroll = care ? care.account.elected : 0;
  const medicareWages = wagesTyped ? Number(ty.wages) : Math.max(0, payTotal - fsaExcluded - dcPayroll - hsaPayroll + hsaExcess);
  const base = { filingStatus, wages, medicareWages, otherOrdinary, qualifiedIncome, capitalLoss: gains.lossAllowed, socialSecurity, taxExemptInterest, adjustments, ages65plus, blind: Number(t.blind) || 0, dependentsUnder17, otherDependents, withheld: Number(ty.withheld) || 0, paid, selfEmployment: business, investmentIncome, charitableCash: Math.max(0, Number(t.itemized?.charitable) || 0) };
  // only when there is care to count, so a plan without it gives the same inputs (and results) as before
  if (care && care.expenses > 0 && care.persons > 0) base.care = { expenses: care.expenses, persons: care.persons, benefits: care.benefits, earnedLow: care.earnedLow };
  const agi = federalTax({ ...base, itemized: 0 }, P).agi;
  const itemized = itemizedTotal(t.itemized, agi, filingStatus, P);
  let inputs = { ...base, itemized: itemized.total };
  // married filing separately is two returns, one per spouse (IRS Pub. 501: each reports their own income, credits and
  // deductions): each spouse's own pay, 401(k), IRA and HSA money and the income in their name; the household's income
  // with no one named, the typed figures, the sales in neither name and the itemized amounts split in half (a sale's half on
  // each return, so each has its own $1,500 loss limit, IRC 1211(b); a sale with a personId is all on that spouse's return:
  // its owner's own income, Pub. 501); pay with no one named and the health FSA on the adult marked
  // "Me"; the children on the higher earner's return (the Which way to file page's convention). The engine adds the two
  // returns up (core/math/tax.js separateTax); `separate` holds each spouse's inputs.
  let separate = null;
  if (filingStatus === "married_separate" && adults.length >= 2) {
    const two = adults.slice(0, 2);
    // a row named for someone on neither return (a third adult) is treated as in neither name, as a joint return would count it
    const shareOf = (x, p, payLike) => { const o = adultOf(x.personId); const own = o && two.includes(o) ? o : null; return own ? (own === p ? 1 : 0) : payLike ? (p === me ? 1 : 0) : 0.5; };
    const sumFor = (p, types, payLike = false) => active.filter((x) => types.includes(x.type)).reduce((s, x) => s + x.yearly * shareOf(x, p, payLike), 0);
    const gainsOf = (p) => netGains((t.gains ?? []).map((g) => { const s = shareOf(g, p, false); return { ...g, proceeds: (Number(g.proceeds) || 0) * s, basis: (Number(g.basis) || 0) * s }; }), filingStatus);
    const halfItemized = Object.fromEntries(Object.entries(t.itemized ?? {}).map(([k, v]) => [k, typeof v === "number" ? v / 2 : v]));
    const payOf = (p) => sumFor(p, ["salary", "bonus"], true);
    const carrier = [...two].sort((a, b) => payOf(b) - payOf(a))[0];
    const blindAll = Math.max(0, Math.round(Number(t.blind) || 0));
    separate = two.map((p) => {
      const i = adults.indexOf(p), k = k401People[i], ira = iraPeople[i], h = hsa.people[i];
      const fsaOwn = fsaOf(p);
      const hsaDeducted = Math.max(0, h.payroll - h.excess), hsaTaxed = Math.max(0, h.excess - h.payroll);
      const dcOut = dcOwn.get(p.id) ?? 0;   // the child care account on this return, up to 3,750 (5,000 / 2,500 before 2026)
      const acctOwn = care?.account?.people?.find((x) => x.id === p.id) ?? null;
      // typed wages (box 1) shared by pay, plus this spouse's own part of the account taxed as pay (line 1e)
      const typedShare = wagesTyped ? Number(ty.wages) * (payTotal > 0 ? k.pay / payTotal : 1 / two.length) : 0;
      const ownWages = wagesTyped ? typedShare - dcOut : Math.max(0, k.pay - k.excluded - fsaOwn - dcOut) + hsaTaxed;
      const ownBusiness = sumFor(p, ["business"]);
      const halfGains = gainsOf(p);
      const part = {
        // Medicare wages (box 5): the whole election up to a plan's limit is out of them (3121(a)(18)), as on a joint return
        filingStatus, wages: ownWages, medicareWages: wagesTyped ? typedShare : Math.max(0, k.pay - fsaOwn - (acctOwn?.elected ?? 0) - h.payroll + h.excess),
        otherOrdinary: Math.max(0, ownBusiness + sumFor(p, ["rental", "pension", "investment", "other"]) + otherTyped / 2 + halfGains.netShort),
        qualifiedIncome: Math.max(0, qualifiedTyped / 2 + halfGains.netLong), capitalLoss: halfGains.lossAllowed,
        socialSecurity: typed("socialSecurity") ? socialSecurity / 2 : sumFor(p, ["social"]), taxExemptInterest: taxExemptInterest / 2,
        adjustments: adjustmentsTyped / 2 + ira.deductible + (wagesTyped ? 0 : hsaDeducted),
        ages65plus: ageAtYearEnd(p) !== null && ageAtYearEnd(p) >= 65 ? 1 : 0, blind: p === me ? Math.min(1, blindAll) : Math.max(0, blindAll - 1),
        dependentsUnder17: p === carrier ? dependentsUnder17 : 0, otherDependents: p === carrier ? otherDependents : 0,
        withheld: base.withheld / 2, paid: paid / 2, selfEmployment: ownBusiness,
        investmentIncome: Math.max(0, sumFor(p, ["investment"]) + qualifiedTyped / 2 + halfGains.netShort + halfGains.netLong + halfGains.lossAllowed),
        charitableCash: base.charitableCash / 2,
      };
      const partAgi = federalTax({ ...part, itemized: 0 }, P).agi;
      // the Income page's money on this return alone (no typed figures, no sales): what Budget and Next best action tax
      const fromIncome = { wages: Math.max(0, k.pay - k.excluded - fsaOwn - (acctOwn?.off ?? 0)) + hsaTaxed, otherOrdinary: sumFor(p, ["rental", "pension", "investment", "other"]), socialSecurity: sumFor(p, ["social"]), investmentIncome: sumFor(p, ["investment"]), business: ownBusiness, pay: k.pay };
      return { personId: p.id, name: p.name, ...part, fromIncome, itemized: itemizedTotal(halfItemized, partAgi, filingStatus, P).total, gainTotals: { short: halfGains.shortTotal, long: halfGains.longTotal }, gains: { netShort: halfGains.netShort, netLong: halfGains.netLong, netLoss: halfGains.netLoss, lossAllowed: halfGains.lossAllowed } };
    });
    // the household's gains figures (the sources, the steps, the carryover, Capital gains, Tax lots, Crypto) as the two returns
    // have them: each return nets its own sales, so a gain on one return and a loss on the other do not cancel
    const per = separate.map((x) => x.gains);
    const add = (k) => per.reduce((t, x) => t + x[k], 0);
    gains = { ...gains, netShort: add("netShort"), netLong: add("netLong"), netLoss: add("netLoss"), lossAllowed: add("lossAllowed"), carryForward: add("netLoss") - add("lossAllowed"), byReturn: separate.map((x) => ({ personId: x.personId, name: x.name, ...x.gains })) };
    for (let k = sources.length - 1; k >= 0; k--) if (["shortGains", "longGains", "loss"].includes(sources[k].key)) sources.splice(k, 1);
    if (gains.netShort > 0) sources.push({ key: "shortGains", label: "Short-term gains", amount: gains.netShort, from: "plan", detail: "Capital gains page, each return's own" });
    if (gains.netLong > 0) sources.push({ key: "longGains", label: "Long-term gains", amount: gains.netLong, from: "plan", detail: "Capital gains page, each return's own" });
    if (gains.netLoss < 0) sources.push({ key: "loss", label: "Capital loss allowed", amount: gains.lossAllowed, from: "plan", detail: "Capital gains page, each return's own" });
    const sums = Object.fromEntries(SEPARATE_FIELDS.map((f) => [f, separate.reduce((s, x) => s + (Number(x[f]) || 0), 0)]));
    inputs = { ...inputs, ...sums, separate, separateTo: me ? me.id : separate[0].personId };   // an amount another page adds lands on Me's return
    notes.push(`Filing separately is two returns: ${separate.map((x) => (W.isYou(x.name) ? "yours" : W.nameOf(x.name))).join(" and ")}, each with their own pay, saving and income; income in neither name and the figures typed here are split in half${dependentsUnder17 + otherDependents > 0 ? `, and ${dependentsUnder17 + otherDependents === 1 ? "the child is" : "the children are"} on ${W.nameOf(carrier.name)} return` : ""}.`);
  }
  // income on the page that is not counted this year (ended, not started, one-time) is not "nothing on the Income page"
  // (Review 2026-11-06, verifier follow-up: H-0221 and H-0228, whose pay ended this year)
  if (nothingCounted) notes.push(uncounted.length ? `Nothing on the Income page is counted for ${year}.${uncountedWords(uncounted) ? ` ${uncountedWords(uncounted)}` : ""} The estimate is built from what you type below.` : "Nothing on the Income page yet: the estimate is built from what you type below.");
  if (adults.length >= 2 && filingStatus === "single") notes.push("Two adults but the filing status is Single (People page). Married couples usually file together.");
  if (filingStatus === "married_separate" && socialSecurity > 0 && !livedApart) notes.push("Filing separately while living together, up to 85% of Social Security is taxed from the first dollar. If you and your spouse lived apart all year, tick that under Year and people.");
  return {
    year, params: P, filingStatus, livedApart, inputs, sources, notes, itemized, people: { ages65plus, dependentsUnder17, otherDependents, adults: adults.length }, pretax401k, gains, separate,
    standard: separate ? separate.reduce((s, x) => s + standardDeduction(filingStatus, P, { ages65plus: x.ages65plus, blind: x.blind }), 0) : standardDeduction(filingStatus, P, { ages65plus, blind: inputs.blind }),
    k401: { people: k401People, excluded: pretax401k, inIncome: k401Over, year: L.kindYear["401k"] },
    ira: { people: iraPeople, deductible: iraDeductible, over: iraOver, year: L.kindYear.ira },
    fsa: { election: fsaElection, limit: Number.isFinite(fsaLimit) ? fsaLimit : null, excluded: fsaExcluded, over: Math.max(0, fsaElection - fsaExcluded), offWages: wagesTyped ? 0 : fsaExcluded, year: L.kindYear.fsa ?? null, people: fsaPeople.map((x) => ({ ...x, offWages: wagesTyped ? 0 : x.excluded })) },
    hsa: { picture: hsa, payroll: hsaPayroll, employer: hsa.household.employer, excess: hsaExcess, deducted: hsaContrib, employerTaxed: wagesTyped ? 0 : hsaEmployerTaxed },
    payTotal, wagesTyped, wagesPlan,
    care,   // last: the AI explain digest sends the figures breadth first, and this detail must not crowd out the result
  };
}

/**
 * `inputs.care` for a what-if on `ti` (taxInputs), worked by the one rule (careAccountRule): some adults' earnings changed,
 * `changes` = { [adultId]: { pay, business } } (each the new yearly figure as the return has it before the child care
 * account: pay after pre-tax 401(k), health FSA and HSA money; business income less half its self-employment tax), and
 * (optional) `elections` = { [adultId]: yearly amount } in place of the plan's child care accounts for the year. The
 * account's exclusion (the lower earner's earned income caps it) and the credit's earned-income cap (21(d)(1): the lower of
 * the two on a joint return, else the filer's) are worked again, so a page that adds pay for a spouse with none (a job
 * offer, a business) sees the exclusion and the credit it unlocks. -> the care inputs ({ expenses, persons, benefits,
 * earnedLow }) plus `wagesChange` (what the household's wages, and Medicare wages, move by from the account alone: add it to
 * the wages the page works) and `account` (careAccountRule); the plan's figure when there is nothing to change; null when the
 * plan has no care to count.
 */
export function careInputsWith(ti, changes = {}, elections = null) {
  const c = ti?.inputs?.care ?? null, d = ti?.care;
  if (!c || !d?.earnedPeople?.length) return c;
  const given = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
  const rows = d.earnedPeople.map((x) => {
    const ch = changes?.[x.id] ?? {};
    return { ...x, pay: given(ch.pay) ? Math.max(0, Number(ch.pay)) : x.pay, business: given(ch.business) ? Number(ch.business) : x.business, typed: elections ? Math.max(0, Number(elections[x.id]) || 0) : x.typed };
  });
  const A = d.account;
  const acct = careAccountRule({ people: rows.map((x) => ({ id: x.id, name: x.name, typed: x.typed, earned: x.pay + x.business, filer: x.id === d.filerId })), care: A.care, joint: A.joint, separate: A.separate, limit: A.limit, planMax: A.planMax, typedWages: d.wagesTyped });
  const earned = rows.map((x, i) => Math.max(0, (d.wagesTyped ? x.pay + acct.people[i].taxedAsPay : x.pay - acct.people[i].off) + x.business));
  const at = Math.max(0, rows.findIndex((x) => x.id === d.filerId));
  const earnedLow = d.spouseUnknown ? 0 : d.joint ? Math.min(...earned) : earned[at];
  const wagesChange = d.wagesTyped ? acct.taxedAsPay - A.taxedAsPay : A.off - acct.off;
  return { ...c, benefits: acct.excluded, earnedLow, wagesChange, account: acct };
}

/**
 * careAccount(plan, { year, today }) -> the child care account for tax year `year` (default: the Federal estimate's), by
 * the one rule (careAccountRule), as the Federal estimate counts it: { year, people: [{ id, name, typed, elected, care,
 * forfeited, received, excluded, taxedAsPay, off }], elected, forfeited, excluded, taxedAsPay, off, care, limit, planMax,
 * joint, separate, overLimit, earnedCapped, later }; null when the year has no figures for it. The Paycheck page takes each
 * adult's `elected` out of pay; Benefits elections, Budget and Next best action read the same figures through taxInputs.
 */
export function careAccount(plan, { year = null, today = null } = {}) {
  const set = Number(plan?.taxes?.year) || null;
  const p = year && Number(year) !== set ? { ...plan, taxes: { ...(plan.taxes ?? {}), year: Number(year) } } : plan;
  return taxInputs(p, { today }).care?.account ?? null;
}

/**
 * `inputs` whose separate returns are `parts` (filing separately), the amounts that add up across returns (SEPARATE_FIELDS)
 * set to the parts' sums, so the engine's top-up rule (core/math/tax.js separateTax) moves nothing between them.
 */
export function withReturns(inputs, parts) {
  const sums = Object.fromEntries(SEPARATE_FIELDS.map((f) => [f, parts.reduce((s, x) => s + (Number(x[f]) || 0), 0)]));
  return { ...inputs, ...sums, separate: parts };
}

/**
 * A business at its profit, on the return of the adult who runs it (IRS Pub. 501: separate filers "report only your own
 * income, credits, and deductions"; half the self-employment tax, IRC 164(f), and the 20% deduction, IRC 199A, are that
 * adult's). `inputs` counts the Income page's business amounts (`selfEmployment`, in `otherOrdinary`); `owners` = [{ personId,
 * profit (after expenses), half (half the self-employment tax on it), qbi (20% of profit less the half, before the engine's
 * limit), qbiMinimum (199A(i)'s floor, or 0) }]. A joint (or single) return: the totals move. Filing separately (`inputs.separate`):
 * each return drops its own Income-page business and takes its owner's figures (an owner with no return of their own lands on
 * `separateTo`'s, as the business with no one named does on the Self-employment page), and the totals are the returns added
 * up (withReturns). The 20% goes in as `qbiDeduction`, taken after AGI (Form 1040 line 13), not as an adjustment.
 */
export function businessOn(inputs, owners = []) {
  const n = (v) => Number(v) || 0;
  const take = (x, list) => {
    const profit = list.reduce((t, o) => t + Math.max(0, n(o.profit)), 0), half = list.reduce((t, o) => t + n(o.half), 0);
    return {
      ...x, otherOrdinary: Math.max(0, n(x.otherOrdinary) - n(x.selfEmployment) + profit), adjustments: n(x.adjustments) + half, selfEmployment: profit - half,
      qbiDeduction: n(x.qbiDeduction) + list.reduce((t, o) => t + n(o.qbi), 0), qbiMinimum: Math.max(n(x.qbiMinimum), ...list.map((o) => n(o.qbiMinimum))),
    };
  };
  if (!Array.isArray(inputs.separate) || !inputs.separate.length) return take(inputs, owners);
  const parts = inputs.separate, ids = parts.map((x) => x.personId);
  const to = Math.max(0, parts.findIndex((x) => x.personId != null && x.personId === inputs.separateTo));
  const at = (o) => (ids.includes(o.personId) ? ids.indexOf(o.personId) : to);
  return withReturns(inputs, parts.map((x, i) => take(x, owners.filter((o) => at(o) === i))));
}

/**
 * Whether the child care credit moves the next dollar's cost: by half a cent or more against the cost without it (the 1,000
 * probe, `nextDollarNoCare`), worked to the billionth as nextDollarOf is, so floating-point noise never decides it. Half a
 * cent counts: 12.5 cents shows as 13, so the bracket alone is not the reason. The one threshold the Federal estimate's
 * `careSets` and Brackets' `careMoves` share (Review 2026-11-06, verifier: Brackets used more than 0.0005 and the Federal
 * estimate more than 0.005 on the raw difference, and they disagreed on 12 of 1,500 random households; 0.125 against 0.12
 * passed or failed by floating-point noise).
 */
export const CARE_MOVES_BY = 0.005;
export const careMovesNextDollar = (nextDollar, noCare) => Math.round(Math.abs(Number(nextDollar) - Number(noCare)) * 1e9) >= Math.round(CARE_MOVES_BY * 1e9);

/**
 * What the next dollar of ordinary income costs, as a rate: the next 1,000 (marginalRate), and, with the child care credit in
 * play, the credit's own effect worked over a whole number of its steps (careStep: 4,000 joint, else 2,000), so the figure
 * does not jump between 12 and 15 cents from one pay to the next. Only the credit's part is worked over the step: the rest is
 * the 1,000 probe without it, so a bracket's edge inside the step is not averaged in (Review 2026-11-06, verifier: 2,000 below
 * the 22% bracket with a flat 1,050 credit read 17 cents, not 12). The one next-dollar figure every page shows (the Federal
 * estimate, Brackets, the Tax report).
 */
export function nextDollarOf(inputs, params) {
  const step = inputs?.care ? careStep(inputs.filingStatus, params) : 0;
  if (!(step > 0)) return marginalRate(inputs, params);
  const n = Math.ceil(1000 / step) * step, noCare = { ...inputs, care: undefined };
  // to the billionth, so a figure on a half cent (23.5) rounds the same way every time, not by floating-point noise
  return Math.max(0, Math.round((marginalRate(noCare, params) + marginalRate(inputs, params, n) - marginalRate(noCare, params, n)) * 1e9) / 1e9);
}

/**
 * The walk's line under the child and dependent care credit, in plain words: the rate, the care it is worked on, and what
 * held it there (the limit for one child or more, the child care account, the pay, the tax).
 */
function careSub(c, care) {
  const n = fmtInt, pct = Math.round(c.rate * 100);
  const who = c.persons >= 2 ? "two or more children" : "one child";
  const why = c.base < c.qualified ? `no more than ${care?.joint ? "the lower of your two pays" : "your pay"}`
    : c.benefits > 0 ? `${n(c.cap)} for ${who}, less the ${n(c.benefits)} ${accountsSay(care).pay}${accountsSay(care).many ? " free of tax" : ""}`
    : c.qualified < c.expenses ? `the most for ${who}` : null;
  const counts = c.base < c.expenses ? `${n(c.base)} of your ${n(c.expenses)} of child care counts` : `all ${n(c.expenses)} of your child care counts`;
  const capped = c.credit < c.tentative - 0.5 ? `; only ${n(c.credit)} fits under the tax, and none of it comes back as a refund` : "";
  return `${counts}${why ? ` (${why})` : ""}, at ${pct}% for your income${capped}`;
}

/**
 * Who pays the care from a child care account, for the walk: one account ("your child care account pays"), or two named
 * ("Ana's and Bo's child care accounts pay"). -> { pay, many }
 */
function accountsSay(care) {
  const list = (care?.account?.people ?? []).filter((x) => x.received > 0.5);
  if (list.length < 2) return { pay: "your child care account pays", many: false };
  const names = list.map((x) => (x.name ? W.nameOf(x.name) : "a"));
  return { pay: `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]} child care accounts pay`, many: true };
}

/** No income tax left for the care credit to come off (Form 2441 line 10 is zero). */
const incomeTaxZero = (r) => !(r.incomeTax > 0.5);

/**
 * walk(r, b, nextDollar) -> the steps from income to tax ([{ label, amount, sub }]) for a federalTax result `r` worked on
 * `b` (taxInputs: the people, the itemized lines, the care, the gains' carryover, the filing status) with `nextDollar` the
 * page's next-dollar cost. compute() builds its `steps` (the answer keys' walk) with it; the page's own figures (known.js)
 * build theirs with it and add their rows.
 */
export function walk(r, b, nextDollar) {
  const steps = [{ label: "Income", amount: r.income.gross, sub: [r.income.wages > 0 ? `wages ${fmtInt(r.income.wages)}` : null, r.income.ordinary - r.income.wages > 0 ? `other ordinary ${fmtInt(r.income.ordinary - r.income.wages)}` : null, r.income.qualified > 0 ? `dividends and gains ${fmtInt(r.income.qualified)}` : null, r.income.socialSecurity > 0 ? `Social Security ${fmtInt(r.income.socialSecurity)}` : null].filter(Boolean).join(", ") }];
  if (r.income.socialSecurity > 0) steps.push({ label: "Social Security that is taxed", amount: r.income.taxableSocialSecurity, sub: `${Math.round(r.income.taxableSocialSecurity / r.income.socialSecurity * 100)}% of the benefits, by the IRS worksheet; the rest is not income` });
  if (r.income.capitalLoss < 0) steps.push({ label: "Capital loss", amount: r.income.capitalLoss, sub: `a net loss on sales comes off any income, up to ${fmtInt(b.filingStatus === "married_separate" ? 1500 : 3000)} a year${b.separate ? " on each return" : ""}${b.gains.carryForward < 0 ? `; ${fmtInt(-b.gains.carryForward)} carries to next year` : ""}` });
  if (r.adjustments > 0) steps.push({ label: "Adjustments", amount: -r.adjustments, sub: "IRA, HSA and other above-the-line deductions" });
  steps.push({ label: "Adjusted gross income", amount: r.agi, sub: "" });
  const dsub = r.deduction.used === "itemized"
    ? `more than the ${fmtInt(r.deduction.standard)} standard deduction${r.deduction.itemizedLimit > 0 ? `; ${fmtInt(r.deduction.itemizedLimit)} less for income in the top bracket` : ""}`
    : [r.deduction.charity > 0 ? `includes ${fmtInt(r.deduction.charity)} of gifts to charity, allowed without itemizing from 2026` : null, b.itemized.total > 0 ? `your itemized ${fmtInt(b.itemized.total)} is less` : null, !b.itemized.total && b.people.ages65plus ? "includes the extra allowance for age" : null].filter(Boolean).join("; ");
  steps.push({ label: r.deduction.used === "itemized" ? "Itemized deductions" : "Standard deduction", amount: -(r.deduction.amount - r.deduction.senior), sub: dsub });
  if (r.deduction.senior > 0) steps.push({ label: "Senior deduction", amount: -r.deduction.senior, sub: "6,000 a person 65 or over, tax years 2025 to 2028, less as income rises" });
  steps.push({ label: "Taxable income", amount: r.taxableIncome, sub: r.qualifiedTaxable > 0 ? `${fmtInt(r.ordinaryTaxable)} ordinary, ${fmtInt(r.qualifiedTaxable)} at the gains rates` : "" });
  steps.push({ label: "Income tax", amount: r.incomeTax, sub: r.qualifiedTax > 0 ? `${fmtInt(r.ordinaryTax)} through the brackets, ${fmtInt(r.qualifiedTax)} on dividends and gains` : "through the brackets" });
  if (r.credits.childTaxCredit > 0 || r.credits.refundable > 0) steps.push({ label: "Child tax credit", amount: -(r.credits.childTaxCredit + r.credits.refundable), sub: r.credits.refundable > 0 ? `${fmtInt(r.credits.refundable)} of it comes back as a refund` : `${b.people.dependentsUnder17} under 17` });
  if (r.credits.careCredit > 0 && r.credits.care) steps.push({ label: "Child and dependent care credit", amount: -r.credits.careCredit, sub: careSub(r.credits.care, b.care) });
  // no credit where one could be expected: the walk says why at 0, so a missing row is not a puzzle (an account that uses up
  // the whole 3,000 / 6,000, an account that pays all the care, no tax for the credit to come off)
  else if (r.credits.care) {
    const k = r.credits.care, who = k.persons >= 2 ? "two or more children" : "one child";
    // two accounts are named, with what both pay and the part of it that skips tax (the household's limit)
    const A = b.care?.account, acc = accountsSay(b.care);
    const paid = acc.many ? `${acc.pay} ${fmtInt(A.received)} of the care${A.excluded < A.received - 0.5 ? ` (${fmtInt(A.excluded)} of it free of tax)` : ""}` : null;
    const why = k.benefits > 0 && k.limit <= 0 ? (acc.many ? `none: ${paid}, more than the ${fmtInt(k.cap)} limit for ${who}` : `none: the ${fmtInt(k.benefits)} your child care account pays is more than the ${fmtInt(k.cap)} limit for ${who}, and that money already skips tax`)
      : k.benefits > 0 && k.qualified <= 0 ? (acc.many ? `none: ${paid}, all ${fmtInt(k.expenses)} of it; care an account pays cannot count again` : `none: your child care account pays all ${fmtInt(k.expenses)} of the care, and that money already skips tax; care the account pays cannot count again`)
      : k.tentative > 0.5 && incomeTaxZero(r) ? "none: there is no income tax for it to come off, and none of it comes back as a refund"
      : null;
    if (why) steps.push({ label: "Child and dependent care credit", amount: 0, sub: why });
  }
  if (r.niit > 0) steps.push({ label: "Net investment income tax", amount: r.niit, sub: "3.8% on investment income over the threshold" });
  if (r.additionalMedicare > 0) steps.push({ label: "Additional Medicare tax", amount: r.additionalMedicare, sub: "0.9% on wages over the threshold" });
  steps.push({ label: "Federal tax", amount: r.totalTax, sub: `${r.totalTax < -0.5 ? `the credits are more than the tax: ${fmtInt(-r.totalTax)} comes back as a refund` : `${ratePct(r.effectiveRate)} of income`}; the next dollar costs ${(nextDollar * 100).toFixed(0)}¢` });
  if (r.withheld > 0 || r.paid > 0) steps.push({ label: "Already paid", amount: -(r.withheld + r.paid), sub: [r.withheld > 0 ? `${fmtInt(r.withheld)} withheld` : null, r.paid > 0 ? `${fmtInt(r.paid)} estimated payments` : null].filter(Boolean).join(", ") });
  return steps;
}

/**
 * compute(plan, { today }) -> {
 *   ...taxInputs, years (with tables), result (federalTax), marginal (the next 1,000's cost), nextDollar (what the page shows: over
 *   whole steps of the child care credit when it is in play), steps: [{ label, amount, sub }] the walk from income to tax,
 *   isIndexed (a year past the last table, figures inflated), hasIncome, careFalls (the child care credit shrinks as income rises),
 *   careSets ("covers" | "falls" | null: the child care credit, not the bracket, sets the next dollar's cost), nextDollarNoCare, care
 * }
 */
export function compute(plan, params = {}) {
  const b = taxInputs(plan, params);
  const result = federalTax(b.inputs, b.params);
  // the loss carried to next year by the worksheet (more than the loss over 3,000 when taxable income is below zero)
  if (b.gains.netLoss < 0) {
    const carry = lossCarryover(b, result);
    b.gains = { ...b.gains, carryForward: -carry.total, carryover: carry };
    b.sources = b.sources.map((x) => x.key === "loss" ? { ...x, detail: carry.total > 0.5 ? `${fmtInt(-b.gains.netLoss)} lost in all; ${fmtInt(carry.total)} carries forward` : "Capital gains page" } : x);
  }
  // `marginal`: the next 1,000's cost, as before (other pages and their tests read it). `nextDollar`, what this page says the
  // next dollar costs: with the child care credit, worked over a whole number of its steps (careStep: 4,000 joint, else
  // 2,000), so the figure does not jump between 12 and 15 cents from one pay to the next; else the same as `marginal`
  const marginal = marginalRate(b.inputs, b.params);
  const step = b.inputs.care ? careStep(b.inputs.filingStatus, b.params) : 0;
  const nextDollar = nextDollarOf(b.inputs, b.params);
  // the child care credit getting smaller as income rises (its phase-down), which the next dollar's cost counts
  const careFalls = step > 0 && result.credits.careCredit - federalTax({ ...b.inputs, otherOrdinary: (Number(b.inputs.otherOrdinary) || 0) + step }, b.params).credits.careCredit > 0.5;
  // what sets the next dollar's cost when the care credit moves it: `covers` when the credit is bigger than the tax and grows
  // with it, so more pay costs less than the bracket (down to 0); `falls` when it shrinks (careFalls); null when it does not
  // move it (the cost without the credit, the 1,000 probe nextDollarOf starts from, is the same), so the bracket is the reason
  const noCare = step > 0 ? marginalRate({ ...b.inputs, care: undefined }, b.params) : nextDollar;
  const careSets = step > 0 && careMovesNextDollar(nextDollar, noCare) ? (nextDollar < noCare ? "covers" : "falls") : null;
  const steps = walk(result, b, nextDollar);
  const { care, ...rest } = b;   // the care detail after the result, so a digest sent breadth first keeps the tax
  return { ...rest, years: TAX_YEARS, result, marginal, nextDollar, steps, isIndexed: !!b.params.indexed, hasIncome: result.income.gross > 0, careFalls, careSets, nextDollarNoCare: noCare, care };
}

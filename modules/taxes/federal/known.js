// modules/taxes/federal/known.js -- PURE. The Federal estimate as the page shows it: the answer keys' return
// (compute().result and steps, which stay as they are) with what the plan already knows put in, one step at a time:
//   1. this year's withdrawals from pre-tax retirement accounts (the required withdrawal, and the projection's draw for spending)
//   2. stock pay vesting this year (Equity compensation's restricted stock units)
//   3. a business at its profit, half its self-employment tax and its 20% deduction (the Self-employment page)
//   4. rentals after their costs, interest and depreciation, through the passive-loss rules (Rental analysis)
//   5. the traditional IRA deduction cut by the income limits for someone covered at work (IRC 219(g))
//   6. student loan interest (IRC 221)
// Each step takes the inputs the one before left and gives back new inputs and a line saying what it did. The year's tax
// every tax page uses (Withholding check's yearTax, Estimated payments, Quick answers, Needs attention) is this one's total.
// The order is the law's: the rentals' allowance is worked on modified AGI before the IRA and student loan deductions
// (469(i)(3)(E)); the IRA's after the rentals and before the student loan interest (219(g)(3)(A)); the student loan
// interest's after both (221(b)(2)(C)). README "What the plan already knows (round 8)".
import { compute as computeFederal, taxInputs, businessOn, addIncome, withReturns, walk, ratePct, nextDollarOf, careMovesNextDollar } from "./compute.js";
import { marginalRate, careStep } from "../../../core/math/tax.js";
import { federalTax, SEPARATE_FIELDS } from "../../../core/math/tax.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeSelfEmployment, seTax, SE, QBI } from "../self-employment/compute.js";
import { QBI_MINIMUM, QBI_LINE, forYear } from "../../career/business/data/business.js";
import { thisYear as rmdThisYear } from "../../retirement/rmd/compute.js";
import { compute as computeProjection } from "../../retirement/projection/compute.js";
import { rmdAmount } from "../../../core/math/rmd.js";
import { compute as computeEmployerStock, supplementalWithholding, ADDITIONAL_MEDICARE } from "../../investments/employer-stock/compute.js";
import { rentalsFor, passiveLosses, lossAllowance } from "../../property/rental/compute.js";
import { matchRent } from "../../property/rental/running.js";
import { iraDeduction, coveredAtWork } from "../../investments/limits/compute.js";
import { compute as computeLiabilities } from "../../balance/liabilities/compute.js";
import { yearOfPayments } from "../../../core/math/finance.js";
import { studentLoanFor } from "./data/adjustments.js";
import * as W from "../../../core/words.js";

const n = (v) => Number(v) || 0;
const fmtInt = (v) => Math.round(v).toLocaleString("en-US");
const given = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
const whose = (name) => (name ? W.nameOf(name) : "your");

/**
 * The household's adults and the one marked "Me" (a row naming no adult is Me's, as taxInputs has it). -> { adults, me, adultOf }
 */
function peopleOf(plan) {
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const me = adults.find((p) => p.role === "self") ?? adults[0] ?? null;
  return { adults, me, adultOf: (id) => adults.find((p) => p.id === id) ?? null };
}

/**
 * `add` (amounts by input field) on the return of `personId` when filing separately, else on the household's: addIncome,
 * with negatives allowed (an adjustment taken back).
 */
const onReturn = (inputs, personId, add) => addIncome(inputs, personId, add);

/** The return's adjusted gross income (the part of `personId` when filing separately: that spouse's own), and its taxable Social Security. */
function agiOf(inputs, params, personId = null) {
  const r = federalTax(inputs, params);
  if (!r.separate) return { agi: r.agi, ss: n(r.income?.taxableSocialSecurity), r };
  const part = r.separate.find((x) => x.personId != null && x.personId === personId) ?? r.separate.find((x) => x.personId === r.separateTo) ?? r.separate[0];
  return { agi: part.agi, ss: n(part.income?.taxableSocialSecurity), r: part };
}

/**
 * withoutIncomeRent(plan, fed, { today, rentals }) -> { inputs (fed.inputs with the Income page's rent for the rentals on
 * Rental analysis taken out of ordinary income, on the return it sits on when filing separately: the named spouse's, half
 * each when it names neither, as taxInputs puts it), removed (the rent taken out, a year), left (the Income page's rent
 * still counted: rent for a place that is not on Rental analysis), rows ([{ name, yearly, removed }]) }. The Income page's
 * "rental" rows are rent before any cost; with the property on Rental analysis the estimate counts the rental's result
 * after costs instead. Only as much comes out as the rentals there collect (`rentals`: rentalsFor's, each `rent` a year
 * before empty months): a row is matched to a rental by its name, then by its amount (within 2%), and what the rentals still
 * collect comes off the other rows in proportion; the rest stays (round 8 review: a duplex only on Income vanished).
 */
export function withoutIncomeRent(plan, fed, { today = null, rentals = null } = {}) {
  const rows = computeIncome(plan, { today }).active.filter((x) => x.type === "rental" && x.taxable !== false && n(x.yearly) > 0);
  const all = rows.reduce((s, x) => s + x.yearly, 0);
  if (!(all > 0)) return { inputs: fed.inputs, removed: 0, left: 0, rows: [] };
  // the match is Rental analysis's (running.js matchRent), shared with Income and Will the money last? (round 8 batch 6)
  const takes = matchRent(rows, rentals ?? rentalsFor(plan, { today, year: fed.year })).removed;
  const removed = takes.reduce((t, v) => t + v, 0);
  if (!(removed > 0.005)) return { inputs: fed.inputs, removed: 0, left: all, rows: rows.map((x) => ({ name: x.name, yearly: x.yearly, removed: 0 })) };
  const inp = fed.inputs;
  let inputs = { ...inp, otherOrdinary: Math.max(0, n(inp.otherOrdinary) - removed) };
  if (Array.isArray(inp.separate) && inp.separate.length) {
    const ids = inp.separate.map((x) => x.personId);
    const shareOf = (x, id) => (x.personId && ids.includes(x.personId) ? (x.personId === id ? 1 : 0) : 0.5);
    inputs = withReturns(inp, inp.separate.map((part) => ({ ...part, otherOrdinary: Math.max(0, n(part.otherOrdinary) - rows.reduce((s, x, j) => s + takes[j] * shareOf(x, part.personId), 0)) })));
  }
  return { inputs, removed, left: Math.max(0, all - removed), rows: rows.map((x, j) => ({ name: x.name, yearly: x.yearly, removed: takes[j] })) };
}

// ---- 1. withdrawals from pre-tax retirement accounts -----------------------------------------------------------------

/**
 * withdrawalStep({ plan, fed, inputs, params }) -> { inputs, line | null, note | null, withdrawal: { required, spending, total,
 * typed, people } | null }. This year's money out of pre-tax accounts (traditional IRAs and 401(k)s) is ordinary income
 * (IRC 72, 402(a), 408(d)(1); Form 1040 lines 4b and 5b):
 *   required  each owner's required withdrawal for the year (retirement/rmd thisYear: last December 31's balance over the
 *             Uniform Lifetime factor for the age reached), whether or not it is marked taken: taken or not, it is this
 *             year's income. Someone still working leaves out the 401(k)s (a plan at the job may wait, 401(a)(9)(C)).
 *   spending  what the retirement projection takes from pre-tax accounts this year beyond that, when its first year is
 *             this tax year and a retired one (the draw for spending).
 * The tax year must be today's (the required withdrawal is worked for today's year). A figure typed as "IRA and 401(k)
 * withdrawals this year" (`taxes.thisYear.iraWithdrawals`) replaces the plan's, on a separate return half on each.
 */
/**
 * The retirement projection's first year as withdrawalStep reads it: { year, retired, deferred (taken from pre-tax accounts),
 * rmd } | null. The projection is the slowest thing a tax page would run, and a retiree's pages work the year's tax several
 * times a render (Needs attention, Next best action and Quick answers each through Estimated payments), so the last few
 * answers are kept by the plan's content and the day: the same plan gives the same figures, a changed one is worked again.
 */
const FIRST_YEAR = new Map();
function firstProjectionYear(plan, today) {
  let key = null;
  try { key = `${today}|${JSON.stringify(plan)}`; } catch { key = null; }
  if (key !== null && FIRST_YEAR.has(key)) return FIRST_YEAR.get(key);
  let pr = null;
  try { pr = computeProjection(plan, { today }); } catch { pr = null; }
  const r0 = pr?.ready ? pr.rows?.[0] : null;
  const row = r0 ? { year: r0.year, retired: !!r0.retired, deferred: n(r0.withdrawn?.deferred), rmd: n(r0.rmd) } : null;
  if (key !== null) { FIRST_YEAR.set(key, row); if (FIRST_YEAR.size > 8) FIRST_YEAR.delete(FIRST_YEAR.keys().next().value); }
  return row;
}

/**
 * The share of tax year `year` before `person` reaches 59½ (IRC 72(t)(2)(A)(i): a distribution "made on or after the date on
 * which the employee attains age 59½" owes no extra 10%): 1 when the half-birthday is after December 31, 0 when it is on or
 * before January 1, else the share of the year's days before it (a draw for spending spread evenly). null without a birth date.
 */
export function shareBefore59Half(person, year) {
  const b = String(person?.birthDate ?? "");
  if (!/^\d{4}-\d{2}-\d{2}/.test(b)) return null;
  const by = Number(b.slice(0, 4)), bm = Number(b.slice(5, 7)), bd = Number(b.slice(8, 10));
  const m = bm + 6, half = Date.UTC(by + 59 + (m > 12 ? 1 : 0), (m > 12 ? m - 12 : m) - 1, bd);
  const start = Date.UTC(year, 0, 1), end = Date.UTC(year + 1, 0, 1);
  if (half >= end) return 1;
  if (half <= start) return 0;
  return (half - start) / (end - start);
}

/** The extra tax on a withdrawal before 59½ (IRC 72(t)(1); Form 5329 Part I line 4): 10% of the taxable part. */
export const EARLY_RATE = 0.1;

/**
 * Whether `person` left work in or after the year they turned 55, as the plan has it (retirementAge 55 or more, reached by
 * `year`): then money paid out of that job's 401(k) owes no extra 10% before 59½ (IRC 72(t)(2)(A)(v), "separation from service
 * ... during or after the year the employee reaches age 55"; IRS, "Retirement topics: exceptions to tax on early
 * distributions", read 2026-11-06: qualified plans yes, IRAs no). The plan's 401(k) accounts are the job's plan; once moved
 * into an IRA the rule no longer reaches the money (the account is then an IRA). Round 8 verify.
 */
export function leftWorkAt55(person, year) {
  const ra = Number(person?.retirementAge), by = Number(String(person?.birthDate ?? "").slice(0, 4));
  return person?.retirementAge != null && person?.retirementAge !== "" && Number.isFinite(ra) && ra >= 55 && by > 0 && by + ra <= year;
}

export function withdrawalStep({ plan, fed, inputs, params = {} }) {
  const today = params.today ?? null;
  const ty = plan.taxes?.thisYear ?? {};
  const year = fed.year;
  const { adults, me, adultOf } = peopleOf(plan);
  if (given(ty.iraWithdrawals)) {
    const v = Math.max(0, Number(ty.iraWithdrawals));
    let next = { ...inputs, otherOrdinary: n(inputs.otherOrdinary) + v };
    if (Array.isArray(inputs.separate) && inputs.separate.length) next = withReturns(inputs, inputs.separate.map((x) => ({ ...x, otherOrdinary: n(x.otherOrdinary) + v / inputs.separate.length })));
    // a typed figure may hold money that owes the extra 10% (or one of its exceptions): the 1099-R's code says, not the plan
    const young = v > 0 && adults.length > 0 && adults.every((p) => n(shareBefore59Half(p, year)) >= 1);
    const note = young ? `Anyone taking money out of an IRA or 401(k) before 59½ usually owes an extra 10% on it (Form 5329), unless an exception fits; the estimate does not add it to what you typed. The Form 1099-R's code in box 7 says which applies.` : null;
    return { inputs: v > 0 ? next : inputs, line: { key: "withdrawals", label: "IRA and 401(k) withdrawals", amount: v, from: "typed", detail: "as typed" }, note, withdrawal: { required: 0, spending: 0, total: v, typed: true, people: [], early: 0, counted: v } };
  }
  if (!today || Number(String(today).slice(0, 4)) !== year) return { inputs, line: null, note: null, withdrawal: null };
  const ry = rmdThisYear(plan, { today });
  const people = ry.people.map((p) => {
    const counted = p.working ? p.accounts.filter((a) => a.type !== "401k") : p.accounts;
    const amount = p.working ? Math.round(counted.reduce((t, a) => t + rmdAmount(a.balance, p.age), 0)) : p.amount;
    return { id: p.id, name: p.name, amount, taken: p.taken, first: p.first, working: p.working, estimated: p.estimated };
  }).filter((p) => p.amount >= 1);
  const required = people.reduce((t, p) => t + p.amount, 0);
  // the projection's first year: what it takes from pre-tax money beyond the required withdrawal, when that year is retired
  // (only for a household with no pay coming in: with a paycheck on the Income page the projection's first year is not a
  // retired one for the household, and the projection is the slowest thing a tax page would run)
  let spending = 0;
  const deferred = (plan.accounts ?? []).some((a) => (a.type === "401k" || a.type === "ira") && n(a.balance) > 0);
  const paid = computeIncome(plan, { today }).active.some((x) => ["salary", "bonus", "business"].includes(x.type) && n(x.yearly) > 0);
  if (deferred && !paid) {
    const row = firstProjectionYear(plan, today);
    if (row && row.year === year && row.retired) spending = Math.max(0, n(row.deferred) - Math.max(n(row.rmd), required));
  }
  if (spending < 1) spending = 0;
  const total = required + spending;
  if (!(total >= 1)) return { inputs, line: null, note: null, withdrawal: null };
  const what = people.length && !spending ? "required withdrawal" : "withdrawals from your IRA and 401(k)";
  // Other ordinary income typed on this page: the figures form used to say to type IRA withdrawals there, so a typed figure
  // replaces the plan's (as a typed Other adjustments replaces the student loan interest): never counted twice (round 8,
  // review: the widow with her 16,078 typed there paid tax on 32,156)
  const otherTyped = n(ty.otherOrdinary);
  if (otherTyped > 0) {
    return { inputs, line: null,
      note: `Other ordinary income is typed (${fmtInt(otherTyped)}), so the plan does not add this year's ${what} of ${fmtInt(total)}: it takes what you typed to include it. If it does not, type the withdrawals under IRA and 401(k) withdrawals.`,
      withdrawal: { required, spending, total, typed: false, people, early: 0, counted: 0, inOther: true } };
  }
  let next = inputs;
  for (const p of people) next = onReturn(next, p.id, { otherOrdinary: p.amount });
  if (spending > 0) next = onReturn(next, inputs.separateTo ?? null, { otherOrdinary: spending });
  // the draw for spending from someone not yet 59½ owes an extra 10% (IRC 72(t); Form 5329): each adult's share of the draw
  // by their pre-tax balances (an account with no owner is the first adult's, as the Required withdrawals page has it), for
  // the part of the year before their half-birthday. A required withdrawal (73 or older) never owes it.
  // The 401(k) of someone who left work at 55 or later owes none of it (leftWorkAt55; round 8 verify: a 57-year-old who
  // retired at 56 on a 401(k) was charged 5,171), an IRA still does.
  let early = 0;
  const earlyPeople = [], sep55 = [];
  if (spending > 0) {
    const pre = (plan.accounts ?? []).filter((a) => (a.type === "401k" || a.type === "ira") && n(a.balance) > 0);
    const all = pre.reduce((t, a) => t + n(a.balance), 0);
    const by = new Map();
    for (const a of pre) {
      const o = adultOf(a.ownerId) ?? me;
      if (!o) continue;
      const e = by.get(o) ?? { owes: 0, exempt: 0 };
      if (a.type === "401k" && leftWorkAt55(o, year)) e.exempt += n(a.balance); else e.owes += n(a.balance);
      by.set(o, e);
    }
    for (const [o, e] of by) {
      const share = n(shareBefore59Half(o, year)), part = all > 0 ? spending * e.owes / all : 0;
      const tax = EARLY_RATE * part * share;
      if (tax >= 0.5) { early += tax; earlyPeople.push({ id: o.id, name: o.name ?? null, drawn: part, share, tax }); }
      if (e.exempt > 0 && share > 0) sep55.push({ id: o.id, name: o.name ?? null, age: Number(o.retirementAge), drawn: all > 0 ? spending * e.exempt / all : 0 });
    }
  }
  const bits = [...people.map((p) => `${p.name ? W.nameOf(p.name) : "your"} required withdrawal ${fmtInt(p.amount)}${p.taken ? " (marked taken)" : ""}`), spending > 0 ? `${fmtInt(spending)} more the retirement projection takes for spending` : null].filter(Boolean);
  const said = bits.join(", and ");
  const line = { key: "withdrawals", label: people.length && !spending ? "Required withdrawal" : "Withdrawals from pre-tax retirement accounts", amount: total, from: "plan",
    detail: `${said.charAt(0).toUpperCase()}${said.slice(1)}${people.length ? " (Required withdrawals page)" : ""}; taxed as income in ${year}${early >= 0.5 ? `, with an extra 10% (${fmtInt(early)}) on what comes out before 59½` : ""}` };
  const notes = [];
  if (early >= 0.5) notes.push(`Money taken out of an IRA or 401(k) before 59½ owes an extra 10% (Form 5329): about ${fmtInt(early)} on this year's draw for spending, counted in the tax. Some ways around it: money from a 401(k) after leaving that job in the year you turned 55 or later (not an IRA), or a series of equal yearly payments set up for life; a tax preparer can check.`);
  for (const x of sep55) {
    const you = !x.name || W.isYou(x.name);
    notes.push(`${you ? "You" : W.NameIn(x.name)} left work at ${x.age}, in or after the year ${you ? "you" : W.nameIn(x.name)} turned 55, so what comes out of that job's 401(k) before 59½ owes no extra 10% (about ${fmtInt(x.drawn)} of this year's draw). The rule is for the 401(k) itself, not an IRA: moved into an IRA first, the money would owe it.`);
  }
  // the first required withdrawal may wait until April 1 of next year (IRC 401(a)(9)(C); IRS RMD FAQ), but then it is next
  // year's income, on top of next year's own
  for (const p of people.filter((x) => x.first && !x.taken)) notes.push(`This is ${p.name && !W.isYou(p.name) ? `${W.nameOf(p.name)}` : "your"} first required withdrawal: it may wait until April 1, ${year + 1}, but then it is ${year + 1}'s income, on top of ${year + 1}'s own. If you will wait, type 0 under IRA and 401(k) withdrawals.`);
  return { inputs: next, line, note: notes.length ? notes.join(" ") : null, withdrawal: { required, spending, total, typed: false, people, early, earlyPeople, sep55, counted: total } };
}

// ---- 2. stock pay ------------------------------------------------------------------------------------------------------

/** A pay line on Income that already looks like stock pay (it would be counted twice): its name says RSU, stock, equity, shares or vesting. */
export const STOCK_PAY_NAME = /\b(?:rsus?|restricted stock|stock|equity|shares?|vest(?:ing|ed|s)?)\b/i;

/**
 * stockStep({ plan, fed, inputs, params }) -> { inputs, line | null, note | null, stock: { value, personId, name, withheld,
 * withheldAfter (vests after today), vests } | null }. Restricted stock units are wages at their value when they vest (IRC
 * 83(a); Pub. 525): the units on Equity compensation vesting in the tax year, at the price on file (the same figures the
 * Equity and Employer stock pages use), go into the employee's wages and Medicare wages. The employer holds back 22% for
 * federal tax (37% on the year's part past $1 million; Pub. 15) and the 0.9% Medicare tax on the employee's wages past
 * $200,000 (IRC 3102(f)): `withheld`, which Withholding check adds to what the paychecks take out. Left out when Wages this
 * year is typed (W-2 box 1 has the vests in it) or a pay line on Income already reads like stock pay (STOCK_PAY_NAME); a
 * note says which figure counts. Option exercises and stock sales are not on file, so they are not counted.
 */
export function stockStep({ plan, fed, inputs, params = {} }) {
  const today = params.today ?? null;
  const eq = plan.equity ?? {};
  const rsus = (eq.grants ?? []).filter((g) => g.kind !== "option" && n(g.shares) > 0);
  if (!rsus.length) return { inputs, line: null, note: null, stock: null };
  let es = null;
  try { es = computeEmployerStock(plan, { today }); } catch { es = null; }
  if (!es?.ready || !(es.price > 0)) return { inputs, line: null, note: rsus.length ? "Stock units on Equity compensation are not counted: type today's share price there." : null, stock: null };
  const year = fed.year;
  const vests = es.grants.filter((g) => g.kind === "rsu").flatMap((g) => g.schedule.filter((e) => Number(e.date.slice(0, 4)) === year).map((e) => ({ date: e.date, grant: g.name, shares: e.shares, value: e.shares * es.price })));
  const value = vests.reduce((t, v) => t + v.value, 0);
  if (!(value > 0)) return { inputs, line: null, note: null, stock: null };
  const { adults, me, adultOf } = peopleOf(plan);
  const inc = computeIncome(plan, { today });
  const payRows = inc.active.filter((x) => ["salary", "bonus"].includes(x.type));
  const worker = adultOf(eq.personId) ?? adultOf(payRows.find((x) => x.type === "salary" && adultOf(x.personId))?.personId) ?? me;
  const who = worker?.id ?? null;
  const name = worker?.name ?? null;
  if (fed.wagesTyped) return { inputs, line: null, note: `Stock vesting in ${year} (${fmtInt(value)} at today's price) is not added: Wages this year is typed, and a W-2's wages already include it.`, stock: null };
  const same = payRows.find((x) => x.taxable !== false && STOCK_PAY_NAME.test(String(x.name ?? "")) && (!x.personId || adultOf(x.personId) === worker || !adults.length));
  if (same) return { inputs, line: null, note: `Stock vesting in ${year} is not added from Equity compensation: "${same.name}" on the Income page counts it (${fmtInt(same.yearly)} a year).`, stock: null };
  const pay = payRows.filter((x) => (adultOf(x.personId) ?? me) === worker && x.period !== "once").reduce((t, x) => t + x.yearly, 0);
  const held = (list, before) => {
    const v = list.reduce((t, x) => t + x.value, 0), prior = before.reduce((t, x) => t + x.value, 0);
    const fedHeld = supplementalWithholding(v, prior);
    const mcBase = pay + prior;
    const medicare = ADDITIONAL_MEDICARE.rate * (Math.max(0, mcBase + v - ADDITIONAL_MEDICARE.over) - Math.max(0, mcBase - ADDITIONAL_MEDICARE.over));
    return fedHeld + medicare;
  };
  const after = vests.filter((v) => !today || v.date > today), before = vests.filter((v) => today && v.date <= today);
  const withheld = held(vests, []), withheldAfter = held(after, before);
  const next = onReturn(inputs, who, { wages: value, medicareWages: value });
  const shares = vests.reduce((t, v) => t + v.shares, 0);
  const line = { key: "stock", label: "Stock pay vesting this year", amount: value, from: "plan",
    detail: `Equity compensation: ${fmtInt(shares)} shares vesting in ${year} at ${fmtInt(es.price)} each, in ${whose(name)} wages; about ${fmtInt(withheld)} of tax is held back from them` };
  return { inputs: next, line, note: null, stock: { value, personId: who, name, withheld, withheldAfter, vests, shares, price: es.price } };
}

// ---- 3. a business at its profit ---------------------------------------------------------------------------------------

/**
 * businessStep({ plan, fed, inputs, params }) -> { inputs, line | null, se: { total, addl, half, qbi, owners, s (the
 * Self-employment page), returns (filing separately: each return's self-employment tax) } | null }. The Income page's
 * business at its profit after the Self-employment page's expenses, on its owner's return (businessOn), half its
 * self-employment tax off income (IRC 164(f)), its 20% deduction after AGI (IRC 199A, Form 1040 line 13, with 199A(i)'s
 * floor); the self-employment tax itself (IRC 1401: 15.3% of 92.35% of the profit, the 12.4% only up to the wage base left
 * after pay) and its 0.9% Additional Medicare tax on what passes the threshold after the return's wages (Form 8959 Part II)
 * are added to the year's tax after the income tax.
 */
/**
 * qbiPhase({ tentative, taxable, filingStatus, year }) -> { amount, share, line, end }: the 20% business deduction of one
 * business above the income line, for a sole proprietor the plan knows nothing more about (no W-2 wages paid, no business
 * property: the wage and property limit of 199A(b)(2)(B) is 0). Taxable income before the deduction (199A(e)(1)) at or under
 * the line: all of it (199A(b)(3)(A)). Over it, the part above the limit (here all of it) is cut by the share of the phase-in
 * range passed, (taxable - line) / width (199A(b)(3)(B)); past the range, the limit (0). Lines and widths: Rev. Proc.
 * 2025-32 sec. 4.26 for 2026 (201,750; 403,500 joint; 201,775 separate; 75,000 wide, 150,000 joint), Rev. Proc. 2024-40
 * sec. 2.27 for 2025 (career/business data QBI_LINE). The minimum of 199A(i) is the engine's qbiMinimum, kept apart.
 */
export function qbiPhase({ tentative, taxable, filingStatus, year }) {
  const Q = forYear(QBI_LINE, year);
  const line = Q[filingStatus] ?? Q.single;
  const width = filingStatus === "married_joint" ? Q.width.married_joint : Q.width.other;
  if (!(taxable > line)) return { amount: tentative, share: 0, line, end: line + width };
  const share = Math.min(1, (taxable - line) / width);
  return { amount: tentative * (1 - share), share, line, end: line + width };
}

export function businessStep({ plan, fed, inputs, params = {}, out = {} }) {
  let s = null;
  try { s = computeSelfEmployment(plan, params); } catch { s = null; }
  if (!s?.ready) return { inputs, line: null, se: null };
  const M = forYear(QBI_MINIMUM, fed.year);
  // stock pay vesting this year (stockStep, before this one) is wages for Social Security too (IRC 83(a), 3121(a); W-2 box
  // 3), so it uses up the wage base the 12.4% part stops at (IRC 1402(b)(1)) for its owner (round 8 review: 100,000 of
  // stock and 150,000 of pay left 40,000 of profit paying 12.4% past the 184,500 base)
  const stock = out.stock ?? null;
  const stockOf = (id) => (stock && stock.value > 0 && stock.personId != null && stock.personId === id ? stock.value : 0);
  const owners = s.people.map((r) => {
    const t = seTax(r.net, { wages: r.wages + stockOf(r.id), wageBase: s.wageBase }), qb = Math.max(0, r.net - t.half);
    return { personId: r.id, profit: r.net, half: t.half, qbi: QBI.rate * qb, tentative: QBI.rate * qb, qbiMinimum: qb >= M.from ? M.amount : 0, se: t };
  });
  // the 20% deduction goes in before its income limits; qbiStep, after every other step, cuts it on the return's taxable income
  const next = businessOn(inputs, owners);
  const P = fed.params;
  const seTotal = owners.reduce((t, o) => t + o.se.total, 0), half = owners.reduce((t, o) => t + o.half, 0);
  let addl = 0, returns = null;
  if (Array.isArray(next.separate) && next.separate.length) {
    const th = P.additionalMedicareThreshold?.married_separate ?? 125000;
    const ids = next.separate.map((x) => x.personId);
    const to = Math.max(0, ids.findIndex((x) => x != null && x === next.separateTo));
    const at = (id) => (ids.includes(id) ? ids.indexOf(id) : to);
    returns = next.separate.map((part, i) => {
      const mine = owners.filter((o) => at(o.personId) === i);
      const se = mine.reduce((t, o) => t + o.se.total, 0), base = mine.reduce((t, o) => t + o.se.base, 0);
      const mw = n(part.medicareWages ?? part.wages);
      const a = SE.addlMedicare * (Math.max(0, mw + base - th) - Math.max(0, mw - th));
      return { personId: part.personId, name: part.name ?? null, se, addl: a, half: mine.reduce((t, o) => t + o.half, 0) };
    });
    addl = returns.reduce((t, x) => t + x.addl, 0);
  } else {
    // the 0.9% line is reduced by the Medicare wages (IRC 1401(b)(2)(B); Form 8959 line 10: W-2 box 5), stock pay included
    const th = P.additionalMedicareThreshold?.[fed.filingStatus] ?? 200000;
    const W0 = n(next.medicareWages ?? next.wages), base = owners.reduce((t, o) => t + o.se.base, 0);
    addl = SE.addlMedicare * (Math.max(0, W0 + base - th) - Math.max(0, W0 - th));
  }
  const line = { key: "business", label: "Business profit", amount: s.net, from: "plan",
    detail: `Income page${s.expenses > 0 ? `, less ${fmtInt(s.expenses)} of costs (Self-employment page)` : ""}; half its self-employment tax and the 20% business deduction come off in the walk above` };
  return { inputs: next, line, se: { total: seTotal, addl, half, qbi: null, owners, s, returns, expenses: s.expenses } };
}

/**
 * qbiStep({ fed, inputs, out }) -> { inputs, note | null, qbiPhase: { line, end, share, taxable, kept, full } | null }: the 20%
 * business deduction cut by its income limits (qbiPhase), last, on the taxable income every other step left (the rentals,
 * the IRA and student loan deductions move it; the deduction itself does not move them, as they are worked on AGI). Each
 * owner's deduction on the taxable income of the return it is on; the engine then holds the total to 20% of taxable income
 * and lifts it to 199A(i)'s minimum. Over the line it shrinks; past the range only the minimum is left (round 8 review:
 * 400,000 of profit took 73,421 off where the law leaves 400). What the plan cannot see (wages paid, equipment, a service
 * business) is said.
 */
export function qbiStep({ fed, inputs, out = {} }) {
  const owners = out.se?.owners ?? [];
  if (!owners.some((o) => o.tentative > 0)) return { inputs, note: null, qbiPhase: null };
  const zero = (x) => ({ ...x, qbiDeduction: 0, qbiMinimum: 0 });
  const parts = Array.isArray(inputs.separate) && inputs.separate.length ? inputs.separate : null;
  const r0 = federalTax(parts ? withReturns(inputs, parts.map(zero)) : zero(inputs), fed.params);
  const ids = parts ? parts.map((x) => x.personId) : [];
  const to = parts ? Math.max(0, ids.findIndex((x) => x != null && x === inputs.separateTo)) : 0;
  const at = (o) => (parts ? (ids.includes(o.personId) ? ids.indexOf(o.personId) : to) : 0);
  const taxableAt = (i) => (parts ? n(r0.separate?.[i]?.taxableIncome) : n(r0.taxableIncome));
  let phase = null;
  const cut = owners.map((o) => {
    const ph = qbiPhase({ tentative: o.tentative, taxable: taxableAt(at(o)), filingStatus: fed.filingStatus, year: fed.year });
    if (ph.share > 0) phase = { ...ph, taxable: taxableAt(at(o)) };
    return { ...o, qbi: ph.amount };
  });
  if (!phase) return { inputs, note: null, qbiPhase: null };
  const sumAt = (i) => cut.filter((o) => at(o) === i).reduce((t, o) => t + o.qbi, 0);
  const next = parts ? withReturns(inputs, parts.map((x, i) => ({ ...x, qbiDeduction: sumAt(i) }))) : { ...inputs, qbiDeduction: sumAt(0) };
  const kept = cut.reduce((t, o) => t + o.qbi, 0), full = owners.reduce((t, o) => t + o.tentative, 0);
  const floor = Math.max(0, ...owners.map((o) => o.qbiMinimum));
  const counts = floor > kept + 0.5 ? `${kept >= 0.5 ? `only ${fmtInt(kept)}` : "none"} of the ${fmtInt(full)} would count, so the ${fmtInt(floor)} minimum for an active business is taken` : `${kept >= 0.5 ? `only ${fmtInt(kept)}` : "none"} of the ${fmtInt(full)} counts`;
  const note = `Your taxable income before the 20% business deduction is about ${fmtInt(phase.taxable)}, over the ${fmtInt(phase.line)} where its limits start${phase.share >= 1 ? ` and past ${fmtInt(phase.end)}` : ""}: with no wages paid and no business property on file, ${counts}. If the business pays wages or owns equipment the deduction can be larger; a service business (a doctor, lawyer, consultant or adviser) can get less. A tax preparer works it out.`;
  return { inputs: next, note, qbiPhase: { ...phase, kept, full } };
}

// ---- 4. rentals after costs ----------------------------------------------------------------------------------------------

/**
 * rentalStep({ plan, fed, inputs, params }) -> { inputs, line | null, rental: { removed, net, passive, magi, allowance,
 * rentals } | null }. With a rental on Rental analysis, the Income page's rent (before costs) comes out and the rentals'
 * allowed result goes in: each rental's rent less empty months, its running costs, the year's loan interest and
 * depreciation (IRC 167, 168: 27.5 years), netted across rentals, a loss used against other income up to the $25,000
 * allowance, which shrinks by half of modified AGI over $100,000 (IRC 469(i); none filing separately while living together,
 * half each living apart all year), the rest carried to next year (rental compute passiveLosses). Modified AGI: this
 * return's AGI without the rent, the taxable Social Security and the IRA deduction (469(i)(3)(E)). A profit is ordinary
 * income and investment income for the 3.8% tax (IRC 1411(c)(1)(A)(i)); an allowed loss comes off income. Filing separately
 * the result is on the return the estimate puts added income on (rental compute's convention). Without a rental on that
 * page the Income page's rent stays at its gross and the line says so.
 */
export function rentalStep({ plan, fed, inputs, params = {}, out = {} }) {
  const today = params.today ?? null;
  const rentals = rentalsFor(plan, { today, year: fed.year });
  if (!rentals.length) return { inputs, line: null, rental: null };
  const noRent = withoutIncomeRent(plan, { ...fed, inputs }, { today, rentals });
  const base = noRent.inputs;
  const separate = fed.filingStatus === "married_separate", together = separate && fed.livedApart !== true;
  const onId = base.separateTo ?? null;
  const { agi, ss } = agiOf(base, fed.params, onId);
  const iraOn = separate ? n(fed.ira?.people?.find((x) => x.id === onId)?.deductible) : n(fed.ira?.deductible);
  // modified AGI leaves out "the deduction allowed for the deductible part of self-employment taxes" too (Form 8582
  // instructions (2025), line 6, read 2026-11-06): the half the business step took off this return goes back (round 8
  // review: 140,000 of profit read 130,109 and the allowance 9,945 where the law gives 5,000)
  const se = out.se ?? null;
  const halfOn = !se ? 0 : separate ? n(se.returns?.find((x) => x.personId === onId)?.half ?? (se.returns?.length ? 0 : se.half)) : n(se.half);
  const magi = Math.max(0, agi - ss + iraOn + halfOn);
  const allowance = together ? 0 : lossAllowance(magi, { separate });
  const passive = passiveLosses(rentals.map((x) => x.taxable), allowance);
  const net = passive.net;
  const next = net >= 0 ? onReturn(base, onId, { otherOrdinary: net, investmentIncome: net }) : onReturn(base, onId, { adjustments: -net });
  const parts = [`${rentals.length === 1 ? `${rentals[0].name}: rent ${fmtInt(rentals[0].income)} after empty months, less ${fmtInt(rentals[0].opex)} of costs, ${fmtInt(rentals[0].interest)} of loan interest and ${fmtInt(rentals[0].depreciation)} of depreciation` : `${rentals.length} rentals after costs, loan interest and depreciation`}`];
  // a loss the allowance cannot use waits (IRC 469(b)): said as what it means for this year, not as "the allowance is 0"
  if (passive.suspended > 0.5) parts.push(passive.againstOther > 0.5
    ? `at your income only ${fmtInt(passive.againstOther)} of the loss can lower this year's tax; the other ${fmtInt(passive.suspended)} waits for a year with rental profit, or the sale`
    : `at your income a rental loss cannot lower this year's tax; the ${fmtInt(passive.suspended)} waits for a year with rental profit, or the sale`);
  if (noRent.removed > 0) parts.push(`in place of the ${fmtInt(noRent.removed)} of rent on the Income page`);
  const line = { key: "rental", label: "Rentals after costs", amount: net, from: "plan", detail: `Rental analysis: ${parts.join("; ")}` };
  return { inputs: next, line, rental: { removed: noRent.removed, left: noRent.left, net, passive, magi, allowance, rentals, before: base, onId } };
}

// ---- 5. the traditional IRA deduction -------------------------------------------------------------------------------------

/**
 * iraStep({ plan, fed, inputs }) -> { inputs, line | null, ira: { people: [{ id, name, traditional, assumed, deductible,
 * limit, rule, range, magi, covered, spouseCovered }], deductible, assumed, basis } | null }. taxInputs deducts each adult's
 * traditional IRA money up to the IRA limit; here only what IRC 219(g) allows comes off (investments/limits iraDeduction):
 * someone covered by a plan at work (coveredAtWork), or married to someone who is, deducts less as modified AGI goes
 * through their range. Modified AGI (219(g)(3)(A)): the return's AGI with the rentals' allowed result in it and without
 * the IRA deduction (the taxable Social Security worked without it too, Pub. 590-A Appendix B) and the student loan
 * interest deduction. What does not come off is after-tax money in the IRA (its basis, Form 8606).
 */
export function iraStep({ plan, fed, inputs }) {
  const people = fed.ira?.people ?? [];
  if (!people.some((x) => x.traditional > 0)) return { inputs, line: null, ira: null };
  const { adults } = peopleOf(plan);
  const separate = Array.isArray(inputs.separate) && inputs.separate.length > 0;
  const assumedAll = people.reduce((t, x) => t + x.deductible, 0);
  // the return without any IRA deduction (on each separate part its own)
  let noIra = { ...inputs, adjustments: Math.max(0, n(inputs.adjustments) - assumedAll) };
  if (separate) noIra = withReturns(inputs, inputs.separate.map((part) => ({ ...part, adjustments: Math.max(0, n(part.adjustments) - n(people.find((x) => x.id !== null && x.id === part.personId)?.deductible)) })));
  const rows = people.map((x) => {
    const covered = x.id !== null ? coveredAtWork(plan, x.id) : coveredAtWork(plan, adults[0]?.id ?? null);
    const spouse = adults.find((p) => p.id !== x.id) ?? null;
    const spouseCovered = !!spouse && coveredAtWork(plan, spouse.id);
    const magi = Math.max(0, agiOf(noIra, fed.params, separate ? x.id : null).agi);
    const d = iraDeduction({ traditional: x.traditional, full: x.limit, magi, covered, spouseCovered, filingStatus: fed.filingStatus, livedApart: fed.livedApart, year: fed.year });
    const deductible = Math.min(d.deductible, x.deductible);
    return { id: x.id, name: x.name, traditional: x.traditional, assumed: x.deductible, deductible, limit: d.limit, rule: d.rule, range: d.range, magi, covered, spouseCovered };
  });
  const deductible = rows.reduce((t, x) => t + x.deductible, 0), basis = rows.reduce((t, x) => t + Math.max(0, x.traditional - x.deductible), 0);
  let next = inputs;
  for (const x of rows) if (x.assumed - x.deductible > 0.005) next = onReturn(next, separate ? x.id : null, { adjustments: -(x.assumed - x.deductible) });
  const cut = rows.filter((x) => x.assumed - x.deductible > 0.5);
  const words = (x) => x.rule === "spouse" ? `${x.name && !W.isYou(x.name) ? `${W.NameOf(x.name)}` : "Your"} spouse has a plan at work` : `${x.name && !W.isYou(x.name) ? W.nameIn(x.name) : "you"} ${x.name && !W.isYou(x.name) ? "has" : "have"} a plan at work`;
  // the income the limit is tested on is the return's: a couple's joint income on a joint return (round 8 review: "Sam's
  // is about 154,400" read as Sam's own pay)
  const joint = fed.filingStatus === "married_joint";
  const after = cut.reduce((t, x) => t + Math.max(0, x.traditional - x.deductible), 0);
  // only what was put in comes out tax-free; what it earns is taxed when it comes out (Pub. 590-B, Form 8606), unlike a Roth
  const detail = cut.length
    ? `${cut.map((x) => `${words(x)}, so at ${joint ? "your joint income of about " : "about "}${fmtInt(x.magi)}${joint ? "" : " of income"} ${x.deductible > 0.5 ? `only ${fmtInt(x.deductible)} of ${whose(x.name)} ${fmtInt(x.traditional)} comes off` : `none of ${whose(x.name)} ${fmtInt(x.traditional)} comes off`} (the limit fades out from ${fmtInt(x.range[0])} to ${fmtInt(x.range[1])})`).join("; ")}. The ${fmtInt(after)} put in after tax comes out tax-free later; what it earns is taxed. Keep a record of it (Form 8606); the Limits page says whether a Roth IRA does better`
    : `Retirement contributions page; ${rows.some((x) => x.rule !== "none") ? "within the income limit for someone with a plan at work" : "no plan at work, so all of it comes off"}`;
  // none deductible is 0, not "-0" (round 8 review: the row read "-$0")
  const line = { key: "ira", label: "IRA contributions", amount: deductible > 0.005 ? -deductible : 0, from: "plan", detail };
  return { inputs: next, line, ira: { people: rows, deductible, assumed: assumedAll, basis } };
}

// ---- 6. student loan interest ---------------------------------------------------------------------------------------------

/**
 * loanStep({ plan, fed, inputs, params }) -> { inputs, line | null, note | null, loan: { interest, max, deduction, magi, range,
 * loans } | null }. Interest paid on student loans comes off income (IRC 221): at most $2,500, less as modified AGI goes
 * through the year's range (221(b)(2)(B); data/adjustments.js), worked as the IRS worksheet does: the deduction times
 * (MAGI - start) / (end - start) comes off (Pub. 970, Student Loan Interest Deduction Worksheet). Modified AGI is the AGI
 * without this deduction, after the IRA deduction and the rentals (221(b)(2)(C)). This year's interest: each Debts row of
 * the kind "Student loan" with its rate and payment, twelve months of payments from today's balance (yearOfPayments). None
 * on a separate return (221(e)(2)). A figure typed under Other adjustments replaces it (it may hold the interest).
 */
export function loanStep({ plan, fed, inputs, params = {} }) {
  const today = params.today ?? null;
  let li = null;
  try { li = computeLiabilities(plan, { today }); } catch { li = null; }
  const loans = (li?.rows ?? []).filter((r) => r.type === "student_loan" && r.owed > 0 && r.rate !== null && r.payment > 0)
    .map((r) => ({ name: r.name, owed: r.owed, rate: r.rate, payment: r.payment, interest: yearOfPayments(r.owed, r.rate, r.payment).interest }));
  const interest = loans.reduce((t, x) => t + x.interest, 0);
  if (!(interest >= 1)) return { inputs, line: null, note: null, loan: null };
  if (fed.filingStatus === "married_separate") return { inputs, line: null, note: `About ${fmtInt(interest)} of student loan interest is paid this year, but a separate return cannot deduct it (only a joint return can); the Which way to file page compares the two.`, loan: null };
  if (n(plan.taxes?.thisYear?.adjustments) > 0) return { inputs, line: null, note: `Other adjustments is typed below, so the plan does not add the student loan interest it works out (about ${fmtInt(interest)} this year, at most 2,500 counts). If what you typed leaves it out, add it there.`, loan: null };
  const T = studentLoanFor(fed.year);
  const range = fed.filingStatus === "married_joint" ? T.married_joint : T.single;
  const magi = Math.max(0, agiOf(inputs, fed.params).agi);
  const full = Math.min(T.max, interest);
  const share = magi <= range[0] ? 0 : magi >= range[1] ? 1 : (magi - range[0]) / (range[1] - range[0]);
  const deduction = Math.max(0, full - full * share);
  // off AGI, but not off the income Social Security is tested on (the engine's studentLoanInterest; Pub. 915 (2025)
  // Worksheet 1 line 7 adds Schedule 1 lines 11 to 20, 23 and 25, not line 21; round 8 review: a retiree's loan interest
  // took 2,125 of Social Security out of tax)
  const next = deduction > 0 ? { ...inputs, studentLoanInterest: n(inputs.studentLoanInterest) + deduction } : inputs;
  const line = { key: "loanInterest", label: "Student loan interest", amount: -deduction, from: "plan",
    detail: `estimated from your loans on Debts: about ${fmtInt(interest)} of interest this year${interest > T.max ? `, of which at most ${fmtInt(T.max)} counts` : ""}${share > 0 ? share >= 1 ? `; none at your income (it fades out from ${fmtInt(range[0])} to ${fmtInt(range[1])})` : `; less at your income (it fades out from ${fmtInt(range[0])} to ${fmtInt(range[1])})` : ""}` };
  return { inputs: next, line, note: null, loan: { interest, max: T.max, deduction, magi, range, loans } };
}

// ---- the page's figures ---------------------------------------------------------------------------------------------------

const STEPS = [withdrawalStep, stockStep, businessStep, rentalStep, iraStep, loanStep, qbiStep];

/**
 * known(plan, params, fed?) -> {
 *   fed (compute(): the answer keys' result and steps, untouched), year, filingStatus, inputs (every step applied),
 *   result (federalTax on them: fed.result itself when no step changed anything), changed,
 *   lines: [{ key, label, amount, from, detail }] what each step put in (in its order), sources (fed.sources with the steps'
 *   lines in place of the ones they replace), notes (the steps' notes),
 *   withdrawal, stock, se (businessStep's), rental, ira, loan (each step's figures or null),
 *   seTax (self-employment tax with its Additional Medicare tax, 0 without a business), earlyTax (the extra 10% on a
 *   withdrawal before 59½, IRC 72(t); 0 without one), total (result.totalTax + seTax + earlyTax: the year's federal tax),
 *   totalAtGross (with a business: the same with it at its Income-page gross and no self-employment tax), rate (total /
 *   income), steps (the walk: compute()'s walk on this result with the business rows),
 *   returns (filing separately: each return's own { personId, name, incomeTax, se, addl, total }; else null),
 *   nextDollar, careSets, careFalls (compute()'s, worked on these inputs), hasIncome (any income counted, the plan's
 *   withdrawals included: compute()'s hasIncome reads the Income page and the typed figures only)
 * }
 */
/** Runs `steps` in order on `ctx` ({ plan, fed, inputs, params }), each seeing the figures the ones before left (`out`). */
const runSteps = (ctx, steps) => {
  const out = {}, lines = [], notes = [];
  ctx.out = out;
  for (const step of steps) {
    const r = step(ctx);
    ctx.inputs = r.inputs;
    if (r.line) lines.push(r.line);
    if (r.note) notes.push(r.note);
    Object.assign(out, Object.fromEntries(Object.entries(r).filter(([k]) => !["inputs", "line", "note"].includes(k))));
  }
  return { out, lines, notes };
};
const extraTaxes = (out) => {
  const se = out.se ?? null;
  return { seTax: se ? se.total + se.addl : 0, earlyTax: n(out.withdrawal?.early) };
};

/**
 * knownWithout(plan, params, fed, key) -> { total, result, inputs }: the year's tax as known() works it with one step's
 * effect left out ("rental": the rentals' result not added, their rent on the Income page still taken out), the later steps
 * worked on what is left (the IRA and student loan limits move with it). Rental analysis's "what the rentals add" is
 * known().total less this.
 */
export function knownWithout(plan, params = {}, fed = null, key = "rental") {
  const f = fed ?? computeFederal(plan, params);
  // "stock": the units vesting this year left out of the wages (the Equity compensation page adds them itself, to show what they cost)
  const swap = { rental: (ctx) => { const r = rentalStep(ctx); return { inputs: r.rental ? r.rental.before : ctx.inputs }; }, stock: (ctx) => ({ inputs: ctx.inputs }), ira: (ctx) => ({ inputs: ctx.inputs }) };
  const target = { rental: rentalStep, stock: stockStep, ira: iraStep }[key];
  const steps = STEPS.map((x) => (x === target && swap[key] ? swap[key] : x));
  const ctx = { plan, fed: f, inputs: f.inputs, params };
  const { out } = runSteps(ctx, steps);
  const result = ctx.inputs === f.inputs ? f.result : federalTax(ctx.inputs, f.params);
  const { seTax, earlyTax } = extraTaxes(out);
  return { total: result.totalTax + seTax + earlyTax, result, inputs: ctx.inputs };
}

export function known(plan, params = {}, fed = null) {
  const f = fed ?? computeFederal(plan, params);
  const ctx = { plan, fed: f, inputs: f.inputs, params };
  const { out, lines, notes } = runSteps(ctx, STEPS);
  const inputs = ctx.inputs;
  const changed = inputs !== f.inputs;
  const result = changed ? federalTax(inputs, f.params) : f.result;
  // the next dollar's cost on these inputs (compute()'s rule: over whole steps of the child care credit when it is in play)
  let nextDollar = f.nextDollar, careSets = f.careSets, careFalls = f.careFalls;
  if (changed) {
    nextDollar = nextDollarOf(inputs, f.params);
    const step = inputs.care ? careStep(inputs.filingStatus, f.params) : 0;
    careFalls = step > 0 && result.credits.careCredit - federalTax({ ...inputs, otherOrdinary: n(inputs.otherOrdinary) + step }, f.params).credits.careCredit > 0.5;
    const noCare = step > 0 ? marginalRate({ ...inputs, care: undefined }, f.params) : nextDollar;
    careSets = step > 0 && careMovesNextDollar(nextDollar, noCare) ? (nextDollar < noCare ? "covers" : "falls") : null;
  }
  const se = out.se ?? null;
  const { seTax, earlyTax } = extraTaxes(out);
  const total = result.totalTax + seTax + earlyTax;
  // with a business: the year's tax with it counted as the Income page has it (its gross as ordinary income, no
  // self-employment tax), the other steps the same: total - totalAtGross is the business's whole effect (yearTax `se`)
  let totalAtGross = total;
  if (se) {
    const c2 = { plan, fed: f, inputs: f.inputs, params };
    const r2 = runSteps(c2, STEPS.filter((x) => x !== businessStep));
    totalAtGross = (c2.inputs === f.inputs ? f.result.totalTax : federalTax(c2.inputs, f.params).totalTax) + extraTaxes(r2.out).earlyTax;
  }
  const gross = n(result.income?.gross);
  // the engine's own rate when the year's tax is its total (no business, no extra 10%), so a household with none of these
  // steps reads exactly as before; else the total with them over income
  const rate = se || earlyTax > 0 ? (gross > 0 ? total / gross : 0) : n(result.effectiveRate);
  // the sources: the base list with each step's line in place of what it replaces (the Income page's rent, the IRA as
  // assumed, the business at its gross), the new ones after the pay
  const replace = { rental: "rental", ira: "ira", business: "business" };
  const byKey = new Map(lines.map((l) => [l.key, l]));
  const sources = [];
  const rentLeft = n(out.rental?.left);
  for (const s of f.sources) {
    // rent on the Income page for a place not on Rental analysis stays at its gross, said so (the rentals' own line follows)
    if (s.key === "rental" && byKey.has("rental")) {
      if (rentLeft >= 0.5) sources.push({ ...s, amount: rentLeft, detail: "Income page, before any cost: rent for a place not on Rental analysis; add it there to count it after costs" });
      sources.push(byKey.get("rental")); byKey.delete("rental"); continue;
    }
    if (s.key === "rental") { sources.push({ ...s, detail: "Income page, before any cost: add the property on Rental analysis to count it after costs" }); continue; }
    // Other ordinary income is for interest, non-qualified dividends and Roth conversions now (withdrawals have their own
    // box); typed while the plan has this year's withdrawals, it is taken to include them (withdrawalStep)
    if (s.key === "otherTyped") { sources.push({ ...s, detail: out.withdrawal?.inOther ? `as typed; taken to include this year's IRA and 401(k) withdrawals (the plan's ${fmtInt(out.withdrawal.total)} is not added again)` : "interest, non-qualified dividends, Roth conversions" }); continue; }
    if (replace[s.key] && byKey.has(replace[s.key])) { sources.push(byKey.get(replace[s.key])); byKey.delete(replace[s.key]); continue; }
    sources.push(s);
    if (s.key === "wages" && byKey.has("stock")) { sources.push(byKey.get("stock")); byKey.delete("stock"); }
  }
  for (const l of byKey.values()) sources.push(l);
  // the walk: compute()'s, on this result, with the business's rows (its deduction, its self-employment tax), the extra 10%
  // on an early withdrawal, and the income and adjustments named
  const steps = changed || se || earlyTax > 0 ? pageWalk(f, result, inputs, out, { seTax, earlyTax, total, rate, nextDollar }) : f.steps.map((x) => ({ ...x }));
  const returns = result.separate ? result.separate.map((x) => {
    const own = se?.returns?.find((y) => y.personId === x.personId) ?? null;
    const s = own ? own.se : 0, a = own ? own.addl : 0;
    // the extra 10% sits on the return the draw for spending was put on (separateTo)
    const e = x.personId === result.separateTo ? earlyTax : 0;
    return { personId: x.personId, name: x.name, incomeTax: x.totalTax, se: s, addl: a, early: e, total: x.totalTax + s + a + e, half: own?.half ?? 0, qbi: x.deduction.qbi,
      gross: x.income?.gross ?? null, taxableIncome: x.taxableIncome, bracketRate: x.bracketRate, deduction: x.deduction };
  }) : null;
  return {
    fed: f, year: f.year, filingStatus: f.filingStatus, inputs, result, changed, lines, sources, notes,
    withdrawal: out.withdrawal ?? null, stock: out.stock ?? null, se, rental: out.rental ?? null, ira: out.ira ?? null, loan: out.loan ?? null,
    seTax, earlyTax, total, totalAtGross, rate, steps, returns, nextDollar, careSets, careFalls, hasIncome: !!f.hasIncome || gross > 0,
  };
}

/** The walk for the page's figures: compute()'s walk on `result`, the adjustments named, the 20% business deduction after the standard one, the self-employment tax before the total. */
function pageWalk(f, result, inputs, out, { seTax, earlyTax = 0, total, rate, nextDollar }) {
  const steps = walk(result, f, nextDollar);
  const se = out.se;
  // the income named by where it comes from, not "other ordinary": the business at its profit, this year's withdrawals,
  // the rentals after costs (with their rent, so a rental at a loss is not missing: round 8 review), the stock pay inside
  // the wages, pensions; what is left is "other income"
  const inc = result.income ?? {};
  const wages = n(inc.wages), business = se ? n(se.s?.net) : 0, drawn = n(out.withdrawal?.counted ?? out.withdrawal?.total), rent = Math.max(0, n(out.rental?.net));
  const pension = (f.sources ?? []).filter((x) => x.key === "pension").reduce((t, x) => t + n(x.amount), 0);
  const rentLeft = n(out.rental?.left);
  const other = n(inc.ordinary) - wages - business - drawn - rent - pension - rentLeft;
  const rentGross = (out.rental?.rentals ?? []).reduce((t, r) => t + n(r.rent), 0);
  const first = steps.find((x) => x.label === "Income");
  if (first) first.sub = [
    wages >= 0.5 ? `wages ${fmtInt(wages)}${n(out.stock?.value) >= 0.5 ? ` (${fmtInt(out.stock.value)} of it stock pay)` : ""}` : null,
    business >= 0.5 ? `business profit ${fmtInt(business)}` : null,
    drawn >= 0.5 ? `IRA and 401(k) withdrawals ${fmtInt(drawn)}` : null,
    pension >= 0.5 ? `pension ${fmtInt(pension)}` : null,
    out.rental ? `rentals ${fmtInt(rent)} after costs (${fmtInt(rentGross)} of rent; see below)` : null,
    rentLeft >= 0.5 ? `other rent ${fmtInt(rentLeft)} before costs` : null,
    other >= 0.5 ? `other income ${fmtInt(other)}` : null,
    n(inc.qualified) > 0 ? `dividends and gains ${fmtInt(inc.qualified)}` : null,
    n(inc.socialSecurity) > 0 ? `Social Security ${fmtInt(inc.socialSecurity)}` : null,
  ].filter(Boolean).join(", ");
  const names = [
    se && se.half >= 0.5 ? `half the self-employment tax ${fmtInt(se.half)}` : null,
    out.ira ? (out.ira.deductible >= 0.5 ? `IRA ${fmtInt(out.ira.deductible)}` : null) : n(f.ira?.deductible) >= 0.5 ? `IRA ${fmtInt(f.ira.deductible)}` : null,
    n(f.hsa?.deducted) >= 0.5 ? `HSA ${fmtInt(f.hsa.deducted)}` : null,
    out.loan && out.loan.deduction >= 0.5 ? `student loan interest ${fmtInt(out.loan.deduction)}` : null,
    out.rental && out.rental.net < -0.5 ? `the rental loss ${fmtInt(-out.rental.net)}` : null,
    n(f.inputs?.adjustments) - n(f.ira?.deductible) - n(f.hsa?.deducted) >= 0.5 ? `other ${fmtInt(n(f.inputs.adjustments) - n(f.ira?.deductible) - n(f.hsa?.deducted))}` : null,
  ].filter(Boolean);
  const adj = steps.find((x) => x.label === "Adjustments");
  if (adj && names.length) adj.sub = names.join(", ");
  const qbi = n(result.deduction?.qbi);
  if (qbi >= 0.5) {
    const at = steps.findIndex((x) => x.label === "Taxable income");
    steps.splice(at, 0, { label: "Business deduction (20%)", amount: -qbi, sub: "20% of the business profit after half its self-employment tax, at most 20% of taxable income" });
  }
  const at = steps.findIndex((x) => x.label === "Federal tax");
  if (at >= 0) {
    const rows = [];
    if (se && seTax >= 0.5) rows.push({ label: "Self-employment tax", amount: seTax, sub: `Social Security and Medicare for the self-employed: 15.3% of 92.35% of the profit${se.addl >= 1 ? `, plus ${fmtInt(se.addl)} of Additional Medicare tax` : ""}` });
    // the extra 10% on money taken out before 59½ (IRC 72(t); Form 5329, Schedule 2 line 8)
    if (earlyTax >= 0.5) rows.push({ label: "Extra 10% on early withdrawals", amount: earlyTax, sub: `on the ${fmtInt((out.withdrawal?.earlyPeople ?? []).reduce((t, x) => t + x.drawn * x.share, 0))} taken out of an IRA or 401(k) before 59½ (Form 5329)` });
    const last = steps[at];
    const sub = se && seTax >= 0.5 ? `income tax and self-employment tax: ${ratePct(rate)} of income` : earlyTax >= 0.5 ? `income tax and the extra 10%: ${ratePct(rate)} of income` : last.sub.replace(/^[^;]*of income/, `${ratePct(rate)} of income`);
    steps.splice(at, 1, ...rows, { ...last, amount: total, sub: total < -0.5 ? `the credits are more than the tax: ${fmtInt(-total)} comes back as a refund` : sub });
  }
  return steps;
}

/**
 * taxView(plan, params, { without }) -> what taxInputs(plan, params) gives (inputs, params, year, filingStatus, gains, hsa, care...)
 * with `inputs` and `result` (and `marginal`, `nextDollar`) the Federal estimate's own return: known()'s, so a page that
 * speaks about this household's tax year (a marginal rate, AGI, "your tax") quotes the figures the Federal estimate does
 * (round 8 batch 1 follow-up: Tax-lot harvesting said 22% where the Federal estimate said 12%). `without: "stock"` leaves the
 * units vesting this year out of the wages for a page that adds them itself (Equity compensation); `without: "rental"` or `"ira"` as
 * knownWithout ("ira": the IRA deduction as the plan assumes it, not cut by the income limits for someone covered at work: the HSA
 * page's answer key counts the saving that way). Without `params.today` there is nothing to count this year's withdrawals against, so it is taxInputs' own
 * return. `tax` is the income tax (known().total adds the self-employment tax and the extra 10%; `total` here).
 */
export function taxView(plan, params = {}, { without = null } = {}) {
  if (!params.today) {
    const b = taxInputs(plan, params), result = federalTax(b.inputs, b.params);
    return { ...b, result, known: null, total: result.totalTax };
  }
  const f = computeFederal(plan, params);
  if (without) {
    const w = knownWithout(plan, params, f, without);
    const { steps: _s, sources: _r, ...g } = f;   // the old return's walk is not this return's
    const nd = nextDollarOf(w.inputs, f.params);
    return { ...g, inputs: w.inputs, result: w.result, marginal: marginalRate(w.inputs, f.params), nextDollar: nd, nextDollarNoCare: w.inputs.care ? marginalRate({ ...w.inputs, care: undefined }, f.params) : nd, careSets: null, careFalls: null, known: null, total: w.total };
  }
  const k = known(plan, params, f);
  const { steps: _s, sources: _r, ...g } = f;
  return { ...g, inputs: k.inputs, result: k.result, marginal: marginalRate(k.inputs, f.params), nextDollar: k.nextDollar, nextDollarNoCare: k.inputs.care ? marginalRate({ ...k.inputs, care: undefined }, f.params) : k.nextDollar, careSets: k.careSets, careFalls: k.careFalls, known: k, total: k.total };
}

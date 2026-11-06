// modules/retirement/rmd/compute.js -- PURE. Required minimum distributions: when they start
// for each adult, roughly how big each one's first is (their own accounts in the projection, at
// their own age), and the tax they drag along. Life-insurance cash value is not an IRA: none. The table and start ages live in core/math/rmd.js.
import { rmdFactor, rmdStartAge, rmdStartYear, RMD_ACCOUNT_TYPES, UNIFORM_LIFETIME, rmdAmount } from "../../../core/math/rmd.js";
import { compute as computeProjection, taxSettings, PAY_TYPES } from "../projection/compute.js";
import { ACCOUNT_TYPES } from "../../balance/net-worth/compute.js";
import { federalTax } from "../../../core/math/tax.js";
import { perYear } from "../../../core/math/periods.js";

/**
 * The first adult's own pay this calendar year (verify 2026-11-06): the Income page's pay lines (salary, bonus, business; PAY_TYPES)
 * that are theirs, or have no owner in the household (a dependent's job is the dependent's), for the part of the year each was paid (by days, from the line's start and
 * end dates; no end date: to December 31). The projection never holds the first adult's pay, so a retirement year that is this
 * year (retired in June, or past the retirement age with a job still on the Income page) left it out of the income a withdrawal
 * is priced on top of: a woman of 74 who retired June 30 from a $60,000 job read "adds about $0" for $15,686 that adds $2,999.
 * Partners' pay is the projection's own (an income line while they work on). -> nominal dollars, 0 without `today`
 */
export function payThisYear(plan, today) {
  if (!today || !/^\d{4}/.test(String(today))) return 0;
  const y = Number(String(today).slice(0, 4));
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent" && p.birthDate);
  const first = adults.find((p) => p.role === "self") ?? adults[0];
  if (!first) return 0;
  const iso = (s) => (/^\d{4}-\d{2}-\d{2}/.test(String(s ?? "")) ? String(s).slice(0, 10) : null);
  const at = (s) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
  const y0 = Date.UTC(y, 0, 1), y1 = Date.UTC(y + 1, 0, 1);
  // theirs, or with no owner in the household (a child's or a partner's job is not theirs)
  const everyone = plan.household?.people ?? [];
  return (plan.income ?? []).filter((x) => PAY_TYPES.includes(x.type) && x.taxable !== false && (x.personId === first.id || !everyone.some((p) => p.id === x.personId)))
    .reduce((t, x) => {
      const s = iso(x.startDate), e = iso(x.endDate);
      const from = Math.max(y0, s ? at(s) : y0), to = Math.min(y1, e ? at(e) + 864e5 : y1);
      return t + (to > from ? perYear(x.amount, x.period) * (to - from) / (y1 - y0) : 0);
    }, 0);
}

/**
 * The federal brackets a withdrawal is priced on (round 8): the projection's brackets setting (taxSettings: the filing status,
 * the tables indexed with the plan's inflation), and, for a married couple filing separately who lived apart all year
 * (`plan.taxes.livedApart`, as the Federal estimate reads it), the single base amounts for Social Security (IRC 86(c)(1)(C)(ii)
 * and (c)(2)(C); the tables hold the living-together zero). -> taxSettings' object
 */
export function withdrawalTax(plan) {
  const t = taxSettings(plan, { mode: "brackets" });
  if (t.filingStatus !== "married_separate" || plan.taxes?.livedApart !== true) return t;
  const cache = new Map();
  return { ...t, livedApart: true, paramsFor: (y) => { if (!cache.has(y)) { const P = t.paramsFor(y); cache.set(y, { ...P, ssTaxation: { ...P.ssTaxation, married_separate: P.ssTaxation.single } }); } return cache.get(y); } };
}

/** The engine's guaranteed incomes paid in a projection row, in the order of `row.incomeLines` (core/math/retirement.js step 2's own test). */
function paidIncomes(row, I) {
  const ages = row.ages ?? [];
  return (I.incomes ?? []).filter((inc) => {
    const age = ages[inc.personIndex ?? 0];
    if (age < inc.startAge || (inc.endAge !== undefined && inc.endAge !== null && age > inc.endAge)) return false;
    return !((inc.fromYear !== undefined && inc.fromYear !== null && row.year < inc.fromYear) || (inc.untilYear !== undefined && inc.untilYear !== null && row.year > inc.untilYear));
  });
}

/**
 * The income a projection row is taxed on, as core/math/tax.js federalTax reads it (round 8, widow-2): the engine's own figures
 * when the plan runs on the brackets (`row.taxInfo`); on the quick flat setting the same parts the brackets would count: the
 * taxable incomes of the year (pensions, a partner's pay, rent; Social Security apart, for the benefits worksheet), every
 * pre-tax withdrawal and conversion, and from the taxable account the gain share of what is sold plus the dividends on what
 * it held at the start of the year (`prevTaxable`: last year's closing balance). -> { ordinary, qualified, social } (nominal)
 * Filing separately (round 8 review D1) it also has `by`: each spouse's own part [{ ordinary, qualified, social, age }], for
 * their own return (IRS Pub. 501: each reports only their own income): each income to its owner, each required withdrawal to
 * its owner (`row.rmdBy`), and the other pre-tax withdrawals, conversions and the taxable account's gains and dividends in
 * proportion to the required withdrawals (all to the first adult in a year with none).
 * `pay`: the first adult's own pay that year, which the projection does not hold (payThisYear, for this year's row only; verify
 * 2026-11-06), on their return.
 */
export function rowIncome(row, I, tax, prevTaxable = 0, pay = 0) {
  const separate = tax.filingStatus === "married_separate";
  pay = Math.max(0, Number(pay) || 0);
  if (row.taxInfo && !separate) return { ordinary: row.taxInfo.ordinary + pay, qualified: row.taxInfo.qualified, social: row.taxInfo.socialSecurity };
  const n = separate ? Math.min(2, Math.max(1, (I.people ?? []).length)) : 1;
  const by = Array.from({ length: n }, (_, k) => ({ ordinary: 0, qualified: 0, social: 0, age: row.ages?.[k] ?? 0 }));
  const lines = row.incomeLines ?? [], paid = paidIncomes(row, I);
  const named = new Map();
  for (const x of I.incomes ?? []) if (!named.has(x.name)) named.set(x.name, x);
  lines.forEach((l, i) => {
    const x = paid.length === lines.length ? paid[i] : named.get(l.name);
    if (x?.taxable === false) return;
    const k = Math.min(n - 1, x?.personIndex ?? 0);
    if (x?.kind === "social") by[k].social += l.amount; else by[k].ordinary += l.amount;
  });
  const qualified = (row.withdrawn?.taxable ?? 0) * (tax.gainShare ?? 0.5) + (row.retired ? (Number(prevTaxable) || 0) * (tax.dividendYield ?? 0.02) : 0);
  const rmdBy = row.rmdBy ?? [], rmdSum = rmdBy.reduce((t, x) => t + (x || 0), 0);
  const share = (k) => (n === 1 ? 1 : rmdSum > 0 ? (rmdBy[k] ?? 0) / rmdSum : k === 0 ? 1 : 0);
  const otherDeferred = (row.withdrawn?.deferred ?? 0) - (row.rmd ?? 0) + (row.conversion ?? 0);
  by.forEach((b, k) => { b.ordinary += (n === 1 ? (row.rmd ?? 0) : rmdBy[k] ?? 0) + otherDeferred * share(k) + (k === 0 ? pay : 0); b.qualified += qualified * share(k); });
  const sum = (f) => by.reduce((t, b) => t + b[f], 0);
  const out = { ordinary: sum("ordinary"), qualified: sum("qualified"), social: sum("social") };
  return separate ? { ...out, by } : out;
}

/**
 * What `amount` of the year's ordinary income adds to its federal tax (round 8, widow-2): the tax on the year's income with it
 * less the tax without it, through that year's brackets (`tax`: withdrawalTax(plan); the filing status, the tables indexed with
 * the plan's inflation, the senior deduction for those 65 or over) and the Social Security worksheet, so a withdrawal that makes
 * more of the benefit taxable carries that tax too. Filing separately (`parts.by`, round 8 review D1) each spouse's part is priced
 * on their own return (federalTax with `separate`: no Social Security base while living together, no senior deduction), and
 * `amount` is each spouse's (an array by person, or one figure shared like the year's required withdrawals, `row.rmdBy`).
 * -> { added, socialMore (taxable Social Security it adds), byIndex (separately: what each spouse's own return adds) }
 */
export function addedTax(parts, amount, row, tax) {
  const params = tax.paramsFor(row.year);
  if (parts.by) {
    const rmdBy = row.rmdBy ?? [], rmdSum = rmdBy.reduce((t, x) => t + (x || 0), 0), total = Array.isArray(amount) ? 0 : Number(amount) || 0;
    const amts = Array.isArray(amount) ? amount : parts.by.map((_, k) => (parts.by.length === 1 ? total : rmdSum > 0 ? total * (rmdBy[k] ?? 0) / rmdSum : k === 0 ? total : 0));
    const one = (b, ord, k) => ({ personId: k, otherOrdinary: Math.max(0, ord), qualifiedIncome: b.qualified, socialSecurity: b.social, itemized: tax.itemized ?? 0, ages65plus: b.age >= 65 ? 1 : 0 });
    const run = (cut) => federalTax({ filingStatus: "married_separate", separate: parts.by.map((b, k) => one(b, b.ordinary - (cut[k] ?? 0), k)) }, params).separate;
    const w = run([]), wo = run(amts);
    const byIndex = parts.by.map((_, k) => Math.max(0, w[k].totalTax) - Math.max(0, wo[k].totalTax));
    return { added: byIndex.reduce((t, x) => t + x, 0), socialMore: parts.by.reduce((t, _, k) => t + (w[k].income.taxableSocialSecurity ?? 0) - (wo[k].income.taxableSocialSecurity ?? 0), 0), byIndex };
  }
  const ages65plus = (row.ages ?? []).slice(0, 2).filter((a) => a >= 65).length;
  const run = (ord) => federalTax({ filingStatus: tax.filingStatus, otherOrdinary: Math.max(0, ord), qualifiedIncome: parts.qualified, socialSecurity: parts.social, itemized: tax.itemized ?? 0, ages65plus }, params);
  const w = run(parts.ordinary), wo = run(parts.ordinary - amount);
  return { added: Math.max(0, w.totalTax) - Math.max(0, wo.totalTax), socialMore: (w.income.taxableSocialSecurity ?? 0) - (wo.income.taxableSocialSecurity ?? 0) };
}

/**
 * compute(plan, { today }) -> {
 *   people: [{ id, name, birthYear, age, startAge, startYear, yearsUntil, deferredNow (their own 401(k)s and IRAs), firstRmd (theirs, nominal, from the projection) | null, firstRmdReal }],
 *   schedule: [{ year, age, factor, rmd, taxes (the plan's flat rate, kept for the answer key), extraTax, extraTaxReal (what the
 *     withdrawal adds to that year's federal tax: addedTax; null in a year the first adult still works, whose pay the projection
 *     does not hold), deferredEnd, owners: [{ id, name, age, factor, rmd, rmdReal }] (whose withdrawals they are, each at their
 *     own age and factor, from the projection's rmdBy: `age` and `factor` are the first adult's, kept for the answer key, and
 *     read wrong when the money is a younger or older spouse's) }] (the projection's yearly RMD rows),
 *   totalRmdReal, totalTaxReal, totalExtraTaxReal, taxRate, hasDeferred, ready, table: [{ age, factor }] (72-100)
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const year = today ? Number(String(today).slice(0, 4)) : new Date().getFullYear();
  const deferredAccounts = (plan.accounts ?? []).filter((a) => RMD_ACCOUNT_TYPES.includes(a.type));
  const deferredNow = deferredAccounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const pr = computeProjection(plan, params);
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent" && p.birthDate);
  const first = adults.find((p) => p.role === "self") ?? adults[0];
  // each owner's own accounts (one with no owner, or an owner who is not in the household, belongs to the first person)
  const owns = (p, a) => a.ownerId === p.id || (p === first && !adults.some((q) => q.id === a.ownerId));
  const people = adults.map((p) => {
    const birthYear = Number(String(p.birthDate).slice(0, 4));
    const startAge = rmdStartAge(p.birthDate), startYear = rmdStartYear(p.birthDate);
    const row = pr.ready ? pr.rows.find((r) => r.year === startYear) : null;
    const k = pr.ready ? pr.inputs.people.findIndex((q) => q.id === p.id) : -1;
    const firstRmd = row ? (row.rmdBy?.[k] ?? 0) : null;
    const own = deferredAccounts.filter((a) => owns(p, a)).reduce((s, a) => s + (Number(a.balance) || 0), 0);
    return { id: p.id, name: p.name, birthYear, age: year - birthYear, startAge, startYear, yearsUntil: Math.max(0, startYear - year), deferredNow: own, firstRmd, firstRmdReal: row ? firstRmd / row.priceLevel : null, factor: rmdFactor(Math.max(72, Math.ceil(startAge))) };
  });
  const tax = pr.ready ? withdrawalTax(plan) : null;
  const pay = payThisYear(plan, today);   // this year's row only: the first adult's pay the projection does not hold
  const schedule = pr.ready ? pr.rows.map((r, i) => [r, i]).filter(([r]) => r.rmd > 0).map(([r, i]) => {
    const extraTax = r.retired ? addedTax(rowIncome(r, pr.inputs, tax, i > 0 ? pr.rows[i - 1].balances.taxable : pr.inputs.balances.taxable, r.year === year ? pay : 0), r.rmd, r, tax).added : null;
    const owners = (r.rmdBy ?? []).map((amt, k) => [amt, k]).filter(([amt]) => amt > 0).map(([amt, k]) => ({ id: pr.inputs.people[k]?.id ?? null, name: pr.inputs.people[k]?.name ?? "", age: r.ages[k], factor: rmdFactor(r.ages[k]), rmd: amt, rmdReal: amt / r.priceLevel }));
    return { year: r.year, age: r.ages[0], factor: rmdFactor(r.ages[0]), rmd: r.rmd, rmdReal: r.rmd / r.priceLevel, taxes: r.rmd * pr.inputs.rates.taxRate, extraTax, extraTaxReal: extraTax === null ? null : extraTax / r.priceLevel, deferredEnd: r.balances.deferred, owners };
  }) : [];
  return {
    people, schedule, hasDeferred: deferredNow > 0, deferredNow, deferredAccounts: deferredAccounts.map((a) => ({ name: a.name, type: ACCOUNT_TYPES[a.type]?.label ?? a.type, balance: Number(a.balance) || 0 })),
    totalRmdReal: schedule.reduce((s, r) => s + r.rmdReal, 0), totalTaxReal: schedule.reduce((s, r) => s + r.taxes / (r.rmd / r.rmdReal || 1), 0), totalExtraTaxReal: schedule.reduce((s, r) => s + (r.extraTaxReal ?? 0), 0), taxRate: pr.ready ? pr.inputs.rates.taxRate : Number(plan.retirement?.taxRate ?? 0.15),
    ready: pr.ready, table: Object.entries(UNIFORM_LIFETIME).filter(([a]) => Number(a) <= 100).map(([age, factor]) => ({ age: Number(age), factor })),
  };
}

/**
 * thisYear(plan, { today }) -> { year, deadline ("YYYY-12-31"), people: [{ id, name, age (reached this year), first (the
 * first year: it may wait until April 1 next year, then two fall in that year), deadline, amount, accounts: [{ id, name,
 * type, balance (the December 31 balance used), estimated (no balance from around last December 31 on file: today's) }],
 * estimated, taken (the day "I've taken it" was tapped, or null), working (a salary still coming in: a 401(k) at that
 * job may wait) }], due: [people with an amount not marked taken], total }
 * This year's required withdrawal for each owner whose withdrawals have started and who has pre-tax money: the balance on
 * December 31 of last year divided by the Uniform Lifetime factor for the age reached this year (IRS, "Retirement topics:
 * required minimum distributions", reviewed 2026-04-08). The balance is the account's history point nearest last
 * December 31 (within 45 days), else today's balance, said as an estimate.
 */
export function thisYear(plan, params = {}) {
  const today = params.today ?? null;
  if (!today) return { year: null, deadline: null, people: [], due: [], total: 0 };
  const year = Number(String(today).slice(0, 4));
  const yearEnd = `${year - 1}-12-31`;
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent" && p.birthDate);
  const firstAdult = adults.find((p) => p.role === "self") ?? adults[0];
  const owns = (p, a) => a.ownerId === p.id || (p === firstAdult && !adults.some((q) => q.id === a.ownerId));
  const near = (a) => {
    const days = (d) => Math.abs((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${yearEnd}T00:00:00Z`)) / 86400000);
    const pts = [...(a.history ?? []), ...(a.asOf ? [{ date: a.asOf, balance: a.balance }] : [])].filter((h) => /^\d{4}-\d{2}-\d{2}$/.test(String(h?.date ?? "")) && days(h.date) <= 45);
    pts.sort((x, y) => days(x.date) - days(y.date));
    return pts[0] ?? null;
  };
  const working = (p) => (plan.income ?? []).some((x) => x.personId === p.id && x.type === "salary" && (!x.endDate || x.endDate >= today) && (!x.startDate || x.startDate <= today));
  const people = [];
  for (const p of adults) {
    const start = rmdStartYear(p.birthDate);
    if (year < start) continue;
    const age = year - Number(String(p.birthDate).slice(0, 4));
    const accounts = (plan.accounts ?? []).filter((a) => RMD_ACCOUNT_TYPES.includes(a.type) && owns(p, a) && Number(a.balance) > 0).map((a) => {
      const pt = near(a);
      return { id: a.id, name: a.name || "Account", type: a.type, balance: Number(pt ? pt.balance : a.balance) || 0, estimated: !pt };
    });
    if (!accounts.length) continue;
    const amount = Math.round(accounts.reduce((t, a) => t + rmdAmount(a.balance, age), 0));
    const first = year === start;
    people.push({ id: p.id, name: p.name || "You", age, first, deadline: first ? `${year + 1}-04-01` : `${year}-12-31`, amount, accounts,
      estimated: accounts.some((a) => a.estimated), taken: plan.retirement?.rmdTaken?.[year]?.[p.id] || null, working: working(p) });
  }
  const due = people.filter((x) => x.amount >= 1 && !x.taken);
  return { year, deadline: `${year}-12-31`, people, due, total: due.reduce((t, x) => t + x.amount, 0) };
}

/**
 * thisYearTax(plan, { today }) -> null | { year, total, byPerson: { [id]: tax }, socialMore, separate }: what this year's required
 * withdrawals (thisYear's amounts, taken or not: either way they are this year's income) add to this year's federal tax, on top of
 * the projection's other income that year (round 8, widow-2: the page said 15%, $2,412 for a widow whose withdrawal also made
 * $13,666 more of her Social Security taxable: $3,429). `total` is all of them together. On one return each person's figure is
 * their share of it, in proportion to their withdrawal (round 8 review D4: each one priced last-in added up to $485 less than the
 * two together, since only the first pulled Social Security into tax). Filing separately (`separate`, review D1) it is what their
 * withdrawal adds to their own return, and `total` the sum. Null when nobody's withdrawals have started, or this year is not a
 * retirement year in the projection (the first adult still works: the engine does not hold their pay).
 */
export function thisYearTax(plan, params = {}) {
  const ty = params.thisYear ?? thisYear(plan, params);
  const all = ty.people.filter((x) => x.amount >= 1);
  if (!all.length) return null;
  let pr = null;
  try { pr = params.projection ?? computeProjection(plan, params); } catch { pr = null; }
  const i = pr?.ready ? pr.rows.findIndex((r) => r.year === ty.year) : -1;
  const row = i >= 0 ? pr.rows[i] : null;
  if (!row || !row.retired) return null;
  const tax = withdrawalTax(plan);
  const parts = rowIncome(row, pr.inputs, tax, i > 0 ? pr.rows[i - 1].balances.taxable : pr.inputs.balances.taxable, payThisYear(plan, params.today));
  // this year's withdrawals as worked out from the December 31 balances, in place of the projection's (today's balances)
  const sum = all.reduce((t, x) => t + x.amount, 0);
  if (parts.by) {
    const n = parts.by.length;
    const at = (x) => Math.min(n - 1, Math.max(0, pr.inputs.people.findIndex((q) => q.id === x.id)));
    const amts = parts.by.map((_, k) => all.filter((x) => at(x) === k).reduce((t, x) => t + x.amount, 0));
    const base = { ...parts, by: parts.by.map((b, k) => ({ ...b, ordinary: b.ordinary - (n === 1 ? row.rmd : row.rmdBy?.[k] ?? 0) + amts[k] })) };
    const r = addedTax(base, amts, row, tax);
    const byPerson = Object.fromEntries(all.map((x) => [x.id, amts[at(x)] > 0 ? r.byIndex[at(x)] * x.amount / amts[at(x)] : 0]));
    return { year: ty.year, total: r.added, byPerson, socialMore: r.socialMore, separate: true };
  }
  const base = { ...parts, ordinary: parts.ordinary - row.rmd + sum };
  const whole = addedTax(base, sum, row, tax);
  const byPerson = Object.fromEntries(all.map((x) => [x.id, whole.added * x.amount / sum]));
  return { year: ty.year, total: whole.added, byPerson, socialMore: whole.socialMore, separate: false };
}

/** markTaken(draft, year, personId, day | null): "I've taken it" (a day) or taken back (null). Changes `draft` in place. */
export function markTaken(draft, year, personId, day) {
  draft.retirement = draft.retirement ?? {};
  const all = draft.retirement.rmdTaken = draft.retirement.rmdTaken ?? {};
  const y = all[year] = all[year] ?? {};
  if (day) y[personId] = day; else { delete y[personId]; if (!Object.keys(y).length) delete all[year]; }
}

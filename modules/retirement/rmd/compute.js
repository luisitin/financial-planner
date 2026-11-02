// modules/retirement/rmd/compute.js -- PURE. Required minimum distributions: when they start
// for each adult, roughly how big each one's first is (their own accounts in the projection, at
// their own age), and the tax they drag along. Life-insurance cash value is not an IRA: none. The table and start ages live in core/math/rmd.js.
import { rmdFactor, rmdStartAge, rmdStartYear, RMD_ACCOUNT_TYPES, UNIFORM_LIFETIME, rmdAmount } from "../../../core/math/rmd.js";
import { compute as computeProjection } from "../projection/compute.js";
import { ACCOUNT_TYPES } from "../../balance/net-worth/compute.js";

/**
 * compute(plan, { today }) -> {
 *   people: [{ id, name, birthYear, age, startAge, startYear, yearsUntil, deferredNow (their own 401(k)s and IRAs), firstRmd (theirs, nominal, from the projection) | null, firstRmdReal }],
 *   schedule: [{ year, age, factor, rmd, taxes, deferredEnd }] (the projection's yearly RMD rows for the primary person),
 *   totalRmdReal, totalTaxReal, taxRate, hasDeferred, ready, table: [{ age, factor }] (72-100)
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
  const schedule = pr.ready ? pr.rows.filter((r) => r.rmd > 0).map((r) => ({ year: r.year, age: r.ages[0], factor: rmdFactor(r.ages[0]), rmd: r.rmd, rmdReal: r.rmd / r.priceLevel, taxes: r.rmd * pr.inputs.rates.taxRate, deferredEnd: r.balances.deferred })) : [];
  return {
    people, schedule, hasDeferred: deferredNow > 0, deferredNow, deferredAccounts: deferredAccounts.map((a) => ({ name: a.name, type: ACCOUNT_TYPES[a.type]?.label ?? a.type, balance: Number(a.balance) || 0 })),
    totalRmdReal: schedule.reduce((s, r) => s + r.rmdReal, 0), totalTaxReal: schedule.reduce((s, r) => s + r.taxes / (r.rmd / r.rmdReal || 1), 0), taxRate: pr.ready ? pr.inputs.rates.taxRate : Number(plan.retirement?.taxRate ?? 0.15),
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

/** markTaken(draft, year, personId, day | null): "I've taken it" (a day) or taken back (null). Changes `draft` in place. */
export function markTaken(draft, year, personId, day) {
  draft.retirement = draft.retirement ?? {};
  const all = draft.retirement.rmdTaken = draft.retirement.rmdTaken ?? {};
  const y = all[year] = all[year] ?? {};
  if (day) y[personId] = day; else { delete y[personId]; if (!Object.keys(y).length) delete all[year]; }
}

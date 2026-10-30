// modules/retirement/rmd/compute.js -- PURE. Required minimum distributions: when they start
// for each adult, roughly how big each one's first is (their own accounts in the projection, at
// their own age), and the tax they drag along. Life-insurance cash value is not an IRA: none. The table and start ages live in core/math/rmd.js.
import { rmdFactor, rmdStartAge, rmdStartYear, RMD_ACCOUNT_TYPES, UNIFORM_LIFETIME } from "../../../core/math/rmd.js";
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

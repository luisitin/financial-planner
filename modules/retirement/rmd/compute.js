// modules/retirement/rmd/compute.js -- PURE. Required minimum distributions: when they start
// for each adult, roughly how big the first ones are (from the projection's deferred balance in
// that year), and the tax they drag along. The table and start ages live in core/math/rmd.js.
import { rmdFactor, rmdStartAge, UNIFORM_LIFETIME } from "../../../core/math/rmd.js";
import { compute as computeProjection } from "../projection/compute.js";
import { ACCOUNT_TYPES } from "../../balance/net-worth/compute.js";

/**
 * compute(plan, { today }) -> {
 *   people: [{ id, name, birthYear, age, startAge, startYear, yearsUntil, deferredNow, firstRmd (nominal, from the projection) | null, firstRmdReal }],
 *   schedule: [{ year, age, factor, rmd, taxes, deferredEnd }] (the projection's yearly RMD rows for the primary person),
 *   totalRmdReal, totalTaxReal, taxRate, hasDeferred, ready, table: [{ age, factor }] (72-100)
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const year = today ? Number(String(today).slice(0, 4)) : new Date().getFullYear();
  const deferredAccounts = (plan.accounts ?? []).filter((a) => ["401k", "ira", "cash_value_life"].includes(a.type));
  const deferredNow = deferredAccounts.reduce((s, a) => s + (Number(a.balance) || 0), 0);
  const pr = computeProjection(plan, params);
  const people = (plan.household?.people ?? []).filter((p) => p.role !== "dependent" && p.birthDate).map((p) => {
    const birthYear = Number(String(p.birthDate).slice(0, 4));
    const startAge = rmdStartAge(birthYear), startYear = birthYear + startAge;
    const row = pr.ready ? pr.rows.find((r) => r.year === startYear) : null;
    return { id: p.id, name: p.name, birthYear, age: year - birthYear, startAge, startYear, yearsUntil: Math.max(0, startYear - year), deferredNow, firstRmd: row ? row.rmd : null, firstRmdReal: row ? row.rmd / row.priceLevel : null, factor: rmdFactor(startAge) };
  });
  const schedule = pr.ready ? pr.rows.filter((r) => r.rmd > 0).map((r) => ({ year: r.year, age: r.ages[0], factor: rmdFactor(r.ages[0]), rmd: r.rmd, rmdReal: r.rmd / r.priceLevel, taxes: r.rmd * pr.inputs.rates.taxRate, deferredEnd: r.balances.deferred })) : [];
  return {
    people, schedule, hasDeferred: deferredNow > 0, deferredNow, deferredAccounts: deferredAccounts.map((a) => ({ name: a.name, type: ACCOUNT_TYPES[a.type]?.label ?? a.type, balance: Number(a.balance) || 0 })),
    totalRmdReal: schedule.reduce((s, r) => s + r.rmdReal, 0), totalTaxReal: schedule.reduce((s, r) => s + r.taxes / (r.rmd / r.rmdReal || 1), 0), taxRate: pr.ready ? pr.inputs.rates.taxRate : Number(plan.retirement?.taxRate ?? 0.15),
    ready: pr.ready, table: Object.entries(UNIFORM_LIFETIME).filter(([a]) => Number(a) <= 100).map(([age, factor]) => ({ age: Number(age), factor })),
  };
}

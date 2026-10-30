// modules/retirement/healthcare/compute.js -- PURE. Health cover between retiring and Medicare at 65: the
// marketplace (ACA) benchmark plan for the people it covers each year, the premium tax credit on the plan's
// own income, what is left to pay, and the cliff: under the law as it stands for 2026, a household with income
// over four times the poverty line gets no credit at all, so a dollar more can cost thousands.
import { planIncome } from "../medicare/compute.js";
import { FPL, SCHEDULES, AGE_CURVE, BENCHMARK_40 } from "./data/aca.js";

/** A premium's age factor (relative to 21): flat under 15, straight-line between the curve's ages from 15, 3 from 64. */
export function ageFactor(age) {
  if (age >= 64) return 3;
  if (age < 15) return AGE_CURVE[0][1];   // children under 15: one flat rate
  for (let i = AGE_CURVE.length - 1; i >= 0; i--) {
    const [a0, f0] = AGE_CURVE[i];
    if (age >= a0) { const next = AGE_CURVE[i + 1]; return next ? f0 + (age - a0) / (next[0] - a0) * (next[1] - f0) : f0; }
  }
  return AGE_CURVE[0][1];
}
/** The poverty line for a household of n. */
export const povertyLine = (n) => FPL.base + FPL.each * Math.max(0, n - 1);
/** The share of income expected toward the benchmark plan at a multiple of the poverty line; null over the cliff (no credit). */
export function expectedShare(multiple, rules = "law") {
  const s = SCHEDULES[rules] ?? SCHEDULES.law;
  if (multiple > s.cliff) return null;
  const band = s.bands.find(([from, to]) => multiple <= to) ?? s.bands[s.bands.length - 1];
  const [from, to, a, b] = band;
  return to === Infinity || to === from ? a : a + (Math.max(from, multiple) - from) / (to - from) * (b - a);
}
/** The credit on a year's income: { multiple, share, contribution, credit, cost } for a benchmark a year. */
export function credit({ magi, size, benchmarkYearly, rules = "law" }) {
  const multiple = magi / povertyLine(size);
  const share = expectedShare(multiple, rules);
  const contribution = share === null ? Infinity : share * magi;
  const c = share === null ? 0 : Math.max(0, benchmarkYearly - contribution);
  return { multiple, share, contribution, credit: c, cost: benchmarkYearly - c };
}

/**
 * compute(plan, { today }) -> {
 *   ready, missing, rules, rulesLabel, benchmark40, size, cliffIncome (the household's income at the cliff), people: [{ name, retireAge, bridgeYears }],
 *   years: [{ year, covered: [names], magi, multiple, benchmark, credit, cost, overCliff (income over the cliff), lostCredit (the credit at an income just at the cliff, lost by going over), room (income still under the cliff) }],
 *   total, totalCredit, cliffYears, onWorkPlan: [{ year, covered, worker }] (years a working partner's job plan can cover the retired one), noBridge (no marketplace years)
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const set = plan.retirement?.aca ?? {};
  const rules = SCHEDULES[set.rules] ? set.rules : "law";
  const household = plan.household?.people ?? [];
  const size = Math.max(1, household.length);
  const base = { rules, rulesLabel: SCHEDULES[rules].label, size, cliffIncome: SCHEDULES[rules].cliff === Infinity ? null : povertyLine(size) * SCHEDULES[rules].cliff };
  const pi = planIncome(plan, { today });
  if (!pi.inputs) return { ...base, ready: false, missing: pi.missing, years: [] };
  const { inputs: I, run: r, magiOf } = pi;
  // the household's benchmark now, from the setting (for the adults today) or the national figure by age
  const adultsNow = I.people.map((p) => I.startYear - p.birthYear);
  const ratio40 = (Number(set.benchmarkMonthly) > 0 ? Number(set.benchmarkMonthly) / adultsNow.reduce((s, a) => s + ageFactor(a) / ageFactor(40), 0) : BENCHMARK_40) / ageFactor(40);
  const years = [], onWorkPlan = [];
  for (const row of r.rows) {
    // covered: adults who have stopped working and are under 65; children under 26 while a parent is covered
    const adults = I.people.map((p, k) => ({ p, age: row.ages[k] })).filter(({ p, age }) => age >= p.retireAge && age < 65);
    if (!adults.length) continue;
    // while anyone still works, the household can usually join that job's plan: those years are counted apart
    const workers = I.people.filter((p, k) => row.ages[k] < p.retireAge).map((p) => p.name);
    if (workers.length) { onWorkPlan.push({ year: row.year, covered: adults.map((a) => a.p.name), worker: workers[0] }); continue; }
    const kids = household.filter((q) => q.role === "dependent" && q.birthDate).map((q) => ({ name: q.name, age: row.year - Number(q.birthDate.slice(0, 4)) })).filter((k) => k.age < 26);
    const benchmark = 12 * ratio40 * [...adults.map((a) => a.age), ...kids.map((k) => k.age)].reduce((s, a) => s + ageFactor(a), 0);
    const magi = magiOf(row);
    const famSize = I.people.filter((p, k) => row.ages[k] <= p.endAge).length + kids.filter((k) => k.age < 19).length;
    const c = credit({ magi, size: Math.max(1, famSize), benchmarkYearly: benchmark, rules });
    const cliff = SCHEDULES[rules].cliff === Infinity ? null : povertyLine(Math.max(1, famSize)) * SCHEDULES[rules].cliff;
    years.push({ year: row.year, covered: [...adults.map((a) => a.p.name), ...kids.map((k) => k.name)], magi, size: famSize, multiple: c.multiple, benchmark, credit: c.credit, cost: c.cost, cliff, overCliff: cliff !== null && magi > cliff ? magi - cliff : 0, lostCredit: cliff !== null && magi > cliff ? credit({ magi: cliff, size: Math.max(1, famSize), benchmarkYearly: benchmark, rules }).credit : 0, room: cliff !== null && magi <= cliff ? cliff - magi : null, conversion: (row.conversion ?? 0) / row.priceLevel });
  }
  const people = I.people.map((p) => ({ name: p.name, retireAge: p.retireAge, bridgeYears: Math.max(0, 65 - p.retireAge) }));
  // the cliff as it will apply: the first marketplace year's household, when there is one
  if (years.length) { base.size = years[0].size; base.cliffIncome = years[0].cliff; }
  return { ...base, ready: true, missing: [], benchmark40: ratio40 * ageFactor(40), people, years, total: years.reduce((s, y) => s + y.cost, 0), totalCredit: years.reduce((s, y) => s + y.credit, 0), cliffYears: years.filter((y) => y.overCliff > 0).length, onWorkPlan, noBridge: !years.length };
}

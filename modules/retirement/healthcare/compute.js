// modules/retirement/healthcare/compute.js -- PURE. Health cover between retiring and Medicare at 65: the
// marketplace (ACA) benchmark plan for the people it covers each year, the premium tax credit on the plan's
// own income, what is left to pay, and the cliff: under the law as it stands for 2026, a household with income
// over four times the poverty line gets no credit at all, so a dollar more can cost thousands.
import { planIncome } from "../medicare/compute.js";
import { FPL_BY_YEAR, FIRST_YEAR, LAW_BY_YEAR, SCHEDULES, AGE_CURVE, CHILDREN_COUNTED, BENCHMARK_40 } from "./data/aca.js";

/** The coverage year whose figures apply: the year itself when published, else the nearest (later years hold the newest, in today's dollars). */
const yearOf = (year, table) => { const ys = Object.keys(table).map(Number).sort((a, b) => a - b); const y = Math.trunc(Number(year)) || ys[0]; return ys.filter((x) => x <= y).at(-1) ?? ys[0]; };
/** A premium's age factor (relative to 21): the federal default curve's own factor for the whole age (0-14 one rate, 64 and older 3). */
export function ageFactor(age) {
  const a = Math.floor(Number(age) || 0);
  return AGE_CURVE[Math.min(64, Math.max(14, a))];
}
/** The poverty line for a household of n, for coverage in `year` (the guidelines of the year before; FIRST_YEAR when none is given). */
export const povertyLine = (n, year = FIRST_YEAR) => { const f = FPL_BY_YEAR[yearOf(year, FPL_BY_YEAR)]; return f.base + f.each * Math.max(0, n - 1); };
/**
 * The share of income expected toward the benchmark plan at a multiple of the poverty line, for coverage in `year`:
 * straight-line inside its band, rounded to the nearest one-hundredth of one percent (26 CFR 1.36B-3(g)(1)); null when
 * there is no credit: under 100% of the poverty line (36B(c)(1)(A)) or over the cliff.
 */
export function expectedShare(multiple, rules = "law", year = FIRST_YEAR) {
  const s = SCHEDULES[rules] ?? SCHEDULES.law;
  const bands = s === SCHEDULES.law ? LAW_BY_YEAR[yearOf(year, LAW_BY_YEAR)] : s.bands;
  if (!(multiple >= 1 - 1e-12) || multiple > s.cliff) return null;
  // "at least" a band's start and "less than" its end; the last band takes its end too (4 under the law)
  const band = bands.find(([from, to]) => multiple < to - 1e-12) ?? bands[bands.length - 1];
  const [from, to, a, b] = band;
  const share = to === Infinity || to === from ? a : a + (Math.min(to, Math.max(from, multiple)) - from) / (to - from) * (b - a);
  return Math.floor(share * 10000 + 0.5 + 1e-9) / 10000;
}
/** The credit on a year's income for coverage in `year`: { multiple, share, contribution, credit, cost } for a benchmark a year. */
export function credit({ magi, size, benchmarkYearly, rules = "law", year = FIRST_YEAR }) {
  const multiple = magi / povertyLine(size, year);
  const share = expectedShare(multiple, rules, year);
  const contribution = share === null ? Infinity : share * magi;
  const c = share === null ? 0 : Math.max(0, benchmarkYearly - contribution);
  return { multiple, share, contribution, credit: c, cost: benchmarkYearly - c };
}
/** The ages a family's benchmark counts: every adult and child 21 to 25, and only the three oldest children under 21. */
export function countedAges(ages) {
  const young = ages.filter((a) => a < 21).sort((x, y) => y - x);
  return [...ages.filter((a) => a >= 21), ...young.slice(0, CHILDREN_COUNTED)];
}

/**
 * compute(plan, { today }) -> {
 *   ready, missing, rules, rulesLabel, benchmark40, size, cliffIncome (the household's income at the cliff), people: [{ name, retireAge, bridgeYears }],
 *   years: [{ year, covered: [names], magi, multiple, underLine (under the poverty line), benchmark, credit, cost, overCliff (income over the cliff), lostCredit (the credit at an income just at the cliff, lost by going over), room (income still under the cliff) }],
 *   total, totalCredit, cliffYears, underLineYears (years under the poverty line: no credit), onWorkPlan: [{ year, covered, worker }] (years a working partner's job plan can cover the retired one), noBridge (no marketplace years)
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
    const benchmark = 12 * ratio40 * countedAges([...adults.map((a) => a.age), ...kids.map((k) => k.age)]).reduce((s, a) => s + ageFactor(a), 0);
    const magi = magiOf(row);
    const famSize = I.people.filter((p, k) => row.ages[k] <= p.endAge).length + kids.filter((k) => k.age < 19).length;
    const year = row.year;   // that year's poverty line and table, the newest held for later years
    const c = credit({ magi, size: Math.max(1, famSize), benchmarkYearly: benchmark, rules, year });
    const cliff = SCHEDULES[rules].cliff === Infinity ? null : povertyLine(Math.max(1, famSize), year) * SCHEDULES[rules].cliff;
    years.push({ year: row.year, covered: [...adults.map((a) => a.p.name), ...kids.map((k) => k.name)], magi, size: famSize, multiple: c.multiple, underLine: c.multiple < 1, benchmark, credit: c.credit, cost: c.cost, cliff, overCliff: cliff !== null && magi > cliff ? magi - cliff : 0, lostCredit: cliff !== null && magi > cliff ? credit({ magi: cliff, size: Math.max(1, famSize), benchmarkYearly: benchmark, rules, year }).credit : 0, room: cliff !== null && magi <= cliff ? cliff - magi : null, conversion: (row.conversion ?? 0) / row.priceLevel });
  }
  const people = I.people.map((p) => ({ name: p.name, retireAge: p.retireAge, bridgeYears: Math.max(0, 65 - p.retireAge) }));
  // the cliff as it will apply: the first marketplace year's household, when there is one
  if (years.length) { base.size = years[0].size; base.cliffIncome = years[0].cliff; }
  return { ...base, ready: true, missing: [], benchmark40: ratio40 * ageFactor(40), people, years, total: years.reduce((s, y) => s + y.cost, 0), totalCredit: years.reduce((s, y) => s + y.credit, 0), cliffYears: years.filter((y) => y.overCliff > 0).length, underLineYears: years.filter((y) => y.underLine).length, onWorkPlan, noBridge: !years.length };
}

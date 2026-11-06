// modules/retirement/healthcare/compute.js -- PURE. Health cover between retiring and Medicare at 65: the
// marketplace (ACA) benchmark plan for the people it covers each year, the premium tax credit on the plan's
// own income, what is left to pay, and the cliff: under the law as it stands for 2026, a household with income
// over four times the poverty line gets no credit at all, so a dollar more can cost thousands.
import { planIncome } from "../medicare/compute.js";
// who works and who needs cover in a year: the projection's own rules, so its health line and this page price the same years
// (calls only, never at load)
import { workRule, coverRule } from "../projection/compute.js";
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
/**
 * Whether a household can have the credit at all, by its filing status (review 2026-11-06, seventh pass): a married couple must
 * file a joint return (26 U.S.C. 36B(c)(1)(C)), so married filing separately gets none. The one exception, a spouse living apart
 * who cannot file jointly because of domestic abuse or abandonment and says so on the return (26 CFR 1.36B-2(b)(2)(ii)-(v), for
 * at most three years running), is said on the page, not assumed. creditAllowed(filingStatus) -> boolean
 */
export const creditAllowed = (filingStatus) => filingStatus !== "married_separate";

/** The ages a family's benchmark counts: every adult and child 21 to 25, and only the three oldest children under 21. */
export function countedAges(ages) {
  const young = ages.filter((a) => a < 21).sort((x, y) => y - x);
  return [...ages.filter((a) => a >= 21), ...young.slice(0, CHILDREN_COUNTED)];
}

/**
 * compute(plan, { today }) -> {
 *   ready, missing, rules, rulesLabel, benchmark40, size, cliffIncome (the household's income at the cliff), people: [{ name, retireAge, bridgeYears }],
 *   years: [{ year, covered: [names], magi, multiple, underLine (under the poverty line), benchmark, credit, cost, overCliff (income over the cliff), lostCredit (the credit at an income just at the cliff, lost by going over), room (income still under the cliff) }],
 *   total, totalCredit, cliffYears, underLineYears (years under the poverty line: no credit), onWorkPlan: [{ year, covered, worker }] (years a working partner's job plan can cover the retired one), noBridge (no marketplace years),
 *   separate (married filing separately: no credit in any year, creditAllowed; no cliff)
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const set = plan.retirement?.aca ?? {};
  const rules = SCHEDULES[set.rules] ? set.rules : "law";
  const household = plan.household?.people ?? [];
  const size = Math.max(1, household.length);
  // married filing separately: no credit (creditAllowed), so no cliff either; the full benchmark is the cost
  const separate = !creditAllowed(plan.household?.filingStatus);
  const base = { rules, rulesLabel: SCHEDULES[rules].label, size, separate, cliffIncome: separate || SCHEDULES[rules].cliff === Infinity ? null : povertyLine(size) * SCHEDULES[rules].cliff };
  const pi = params.planIncome ?? planIncome(plan, { today });   // the projection's health line passes the run it already made
  if (!pi.inputs) return { ...base, ready: false, missing: pi.missing, years: [] };
  // the marketplace's own income: AGI plus untaxed Social Security plus tax-exempt interest (fifth pass; Medicare's surcharge
  // leaves untaxed Social Security out: medicare/compute.js marketplaceIncome and irmaaIncome)
  const { inputs: I, run: r, acaMagiOf } = pi;
  // works: under their retirement age with pay (a salary, bonus or business line on Income) or a "work" answer in Get started,
  // and not "retired" or "not working now" there (review 2026-11-02: it was the age alone, so a partner with no job was never
  // priced cover and the household was left to a job nobody has); with no pay and no answer, presumed at work until the
  // household retires (fifth pass). stopped: under 65, alive in the plan, not working, and retired or not working in Get
  // started (from today), past their retirement age, or the household retired (fourth pass: it was anyone not working, from
  // today, so a household with no Income lines yet was priced cover through its working years)
  const works = workRule(plan, I.people, { today, retireYear: I.retireYear });
  const stopped = coverRule(plan, I.people, { today, retireYear: I.retireYear });
  // the household's benchmark now, from the setting (for the adults today) or the national figure by age
  const adultsNow = I.people.map((p) => I.startYear - p.birthYear);
  const ratio40 = (Number(set.benchmarkMonthly) > 0 ? Number(set.benchmarkMonthly) / adultsNow.reduce((s, a) => s + ageFactor(a) / ageFactor(40), 0) : BENCHMARK_40) / ageFactor(40);
  const years = [], onWorkPlan = [];
  for (const row of r.rows) {
    // covered: adults under 65 who have stopped (coverRule); children under 26 while a parent is covered
    const adults = I.people.map((p, k) => ({ p, age: row.ages[k] })).filter(({ p }) => stopped(p, row.year));
    if (!adults.length) continue;
    // while anyone still works, the household can usually join that job's plan: those years are counted apart
    const workers = I.people.filter((p) => works(p, row.year)).map((p) => p.name);
    if (workers.length) { onWorkPlan.push({ year: row.year, covered: adults.map((a) => a.p.name), worker: workers[0] }); continue; }
    // never a year before the household's retirement (fifth pass): the engine counts it as a working year, with no spending and
    // no withdrawals, so its income would read $0 and "under the poverty line" (householdRetireYear makes such years rare)
    if (row.year < I.retireYear) continue;
    const kids = household.filter((q) => q.role === "dependent" && q.birthDate).map((q) => ({ name: q.name, age: row.year - Number(q.birthDate.slice(0, 4)) })).filter((k) => k.age < 26);
    const benchmark = 12 * ratio40 * countedAges([...adults.map((a) => a.age), ...kids.map((k) => k.age)]).reduce((s, a) => s + ageFactor(a), 0);
    const magi = acaMagiOf(row);
    const famSize = I.people.filter((p, k) => row.ages[k] <= p.endAge).length + kids.filter((k) => k.age < 19).length;
    const year = row.year;   // that year's poverty line and table, the newest held for later years
    const c = separate ? { multiple: magi / povertyLine(Math.max(1, famSize), year), share: null, contribution: Infinity, credit: 0, cost: benchmark } : credit({ magi, size: Math.max(1, famSize), benchmarkYearly: benchmark, rules, year });
    const cliff = separate || SCHEDULES[rules].cliff === Infinity ? null : povertyLine(Math.max(1, famSize), year) * SCHEDULES[rules].cliff;
    years.push({ year: row.year, covered: [...adults.map((a) => a.p.name), ...kids.map((k) => k.name)], magi, size: famSize, multiple: c.multiple, underLine: c.multiple < 1, benchmark, credit: c.credit, cost: c.cost, cliff, overCliff: cliff !== null && magi > cliff ? magi - cliff : 0, lostCredit: cliff !== null && magi > cliff ? credit({ magi: cliff, size: Math.max(1, famSize), benchmarkYearly: benchmark, rules, year }).credit : 0, room: cliff !== null && magi <= cliff ? cliff - magi : null, conversion: (row.conversion ?? 0) / row.priceLevel });
  }
  const people = I.people.map((p) => ({ name: p.name, retireAge: p.retireAge, bridgeYears: Math.max(0, 65 - p.retireAge) }));
  // the cliff as it will apply: the first marketplace year's household, when there is one
  if (years.length) { base.size = years[0].size; base.cliffIncome = years[0].cliff; }
  // who is presumed at work (no pay and no Get started answer) in a year someone else relies on their plan: said on the page
  const presumed = [...new Set(onWorkPlan.map((o) => I.people.find((p) => p.name === o.worker)).filter((p) => p && works.presumed(p, I.startYear)).map((p) => p.name))]
    .map((name) => ({ name, untilYear: I.retireYear }));
  return { ...base, ready: true, missing: [], benchmark40: ratio40 * ageFactor(40), people, years, total: years.reduce((s, y) => s + y.cost, 0), totalCredit: years.reduce((s, y) => s + y.credit, 0), cliffYears: years.filter((y) => y.overCliff > 0).length, underLineYears: years.filter((y) => y.underLine).length, onWorkPlan, noBridge: !years.length, noBridgeWhy: years.length ? null : whyNoBridge(I, works, onWorkPlan), presumed };
}

/**
 * Why no one needs marketplace cover, person by person (fifth pass, 2026-11-02: the page said "everyone works until 65, or a
 * partner's job covers the gap" to a retired couple of 72 and 69): "medicare" (65 or over today), "job" (they work every year
 * until 65, or to the end of their plan), or "partner" (the years they do not work before 65 are on a working partner's plan:
 * `worker`, from `fromYear`, after their own work ends at `ownUntilAge` when they work first). `endsBefore65`: their plan ends
 * before 65. Adults past the end of their plan are left out. -> [{ name, why, retireAge, worker?, fromYear?, ownUntilAge?, endsBefore65 }]
 */
export function whyNoBridge(I, works, onWorkPlan) {
  const out = [];
  for (const p of I.people) {
    const ageNow = I.startYear - p.birthYear;
    if (ageNow > p.endAge) continue;
    if (ageNow >= 65) { out.push({ name: p.name, why: "medicare", retireAge: p.retireAge }); continue; }
    const before = [];
    for (let y = I.startYear; y - p.birthYear < 65 && y - p.birthYear <= p.endAge; y++) before.push(y);
    const endsBefore65 = p.endAge < 64;
    const off = before.filter((y) => !works(p, y));
    if (!off.length) { out.push({ name: p.name, why: "job", retireAge: p.retireAge, endsBefore65 }); continue; }
    // whose plan: the one Healthcare names that year, else whoever works then (a partner with no pay and no answer is not
    // listed before the household retires, but a job's plan covers them)
    const on = onWorkPlan.find((o) => o.covered.includes(p.name)) ?? null;
    const worker = on?.worker ?? I.people.find((q) => q !== p && works(q, off[0]))?.name ?? null;
    out.push({ name: p.name, why: "partner", retireAge: p.retireAge, worker, fromYear: off[0], ownUntilAge: off[0] > I.startYear ? off[0] - p.birthYear : null, endsBefore65 });
  }
  return out;
}

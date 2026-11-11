// modules/retirement/longevity/compute.js -- PURE. How long the money may have to last: the
// chance of each adult (and of either of a couple) reaching 80, 85, 90, 95 and 100, and the
// age the plan should run to. The curve is a Gompertz mortality law fitted to the Social
// Security Administration's period life tables (an approximation; the exact SSA table is a
// later improvement noted in the README). A "better" or "worse" health choice shifts it.
import { ageOn } from "../../../core/math/dates.js";
import { nameOf } from "../../../core/words.js";

// Gompertz survival: S(t | x) = exp( -exp((x - m) / b) * (exp((t - x) / b) - 1) ); m = modal age at death, b = dispersion.
// Fitted to approximate SSA 2021 period tables (women live longer; unisex sits between).
export const GOMPERTZ = { m: { m: 84.0, b: 10.5 }, f: { m: 88.0, b: 9.5 }, "": { m: 86.0, b: 10.0 } };
const HEALTH_SHIFT = { better: 3, average: 0, worse: -4 };
export function survival(age, toAge, { sex = "", health = "average" } = {}) {
  const g = GOMPERTZ[sex] ?? GOMPERTZ[""];
  const m = g.m + (HEALTH_SHIFT[health] ?? 0), b = g.b;
  if (toAge <= age) return 1;
  return Math.exp(-Math.exp((age - m) / b) * (Math.exp((toAge - age) / b) - 1));
}
// The curve always crosses any chance above zero; the searches stop there (300 years is only a guard).
/** The age by which the chance of still being alive falls to `p` or under (e.g. 0.1 -> the 90th percentile of lifespan). */
export function ageAtSurvival(age, p, opts) { let a = age; while (a < age + 300 && survival(age, a, opts) > p) a++; return a; }
/** Expected remaining years (life expectancy): the survival curve summed at mid-year points until what is left is negligible. */
export function lifeExpectancy(age, opts) {
  let e = 0;
  for (let t = age; t < age + 300; t++) { const s = survival(age, t + 0.5, opts); e += s; if (s < 1e-15) break; }
  return e;
}

/**
 * compute(plan, { today }) -> {
 *   people: [{ id, name, age, sex, health, expectancy, ages: [{ age, p }] for 80..100, planTo (age with 10% chance of being alive), currentPlanEnd }],
 *   either: { ages: [{ age, p }], planTo } | null (the chance that at least one of a couple is alive), suggestion: text, hasData,
 *   apply: { year, fromYear?, ages: { personId: age }, from: { personId: age } } | null (the Plan to ages the suggestion needs)
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const lg = plan.retirement?.longevity ?? {};
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent" && p.birthDate);
  const marks = [80, 85, 90, 95, 100];
  const people = adults.map((p) => {
    const age = today ? ageOn(p.birthDate, today) : null;
    const s = lg[p.id] ?? {};
    const opts = { sex: s.sex ?? "", health: s.health ?? "average" };
    if (age === null) return { id: p.id, name: p.name, age: null, ...opts, expectancy: null, ages: [], planTo: null, currentPlanEnd: Number(p.lifeExpectancy ?? plan.assumptions?.planEndAge ?? 95) };
    return { id: p.id, name: p.name, age, ...opts, expectancy: age + lifeExpectancy(age, opts), ages: marks.map((a) => ({ age: a, p: a > age ? survival(age, a, opts) : 1 })), planTo: ageAtSurvival(age, 0.1, opts), currentPlanEnd: Number(p.lifeExpectancy ?? plan.assumptions?.planEndAge ?? 95) };
  });
  const alive = people.filter((p) => p.age !== null);
  let either = null;
  if (alive.length >= 2) {
    const [a, b] = alive;
    const pEither = (calendarYearsAhead) => 1 - (1 - survival(a.age, a.age + calendarYearsAhead, a)) * (1 - survival(b.age, b.age + calendarYearsAhead, b));
    const ages = marks.map((m) => ({ age: m, p: pEither(m - a.age) }));   // "age" on the first person's clock
    let y = 0; while (y < 300 && pEither(y) > 0.1) y++;
    either = { ages, planTo: a.age + y, planToYear: today ? Number(String(today).slice(0, 4)) + y : null, first: a.name, second: b.name };
  }
  // what a tap would set (stress test 2026-11-11, RC-6: the page advised an age and gave no way to use it): each adult's "Plan to
  // age" (People page, household.people[].lifeExpectancy) so the plan runs to the year the suggestion names. One adult: their own
  // 1 in 10 age. A couple: the plan runs to the year the chance that either is alive drops under 1 in 10; the adult whose age ends
  // the plan now is set to their age in that year.
  const thisYear = today ? Number(String(today).slice(0, 4)) : null;
  const birthYear = (id) => { const b = adults.find((x) => x.id === id)?.birthDate; return b ? Number(String(b).slice(0, 4)) : null; };
  const endYear = (p) => (birthYear(p.id) === null ? null : birthYear(p.id) + p.currentPlanEnd);
  let apply = null;
  if (alive.length === 1) {
    const p = alive[0];
    if (p.planTo !== p.currentPlanEnd) apply = { year: endYear(p) === null ? null : birthYear(p.id) + p.planTo, ages: { [p.id]: p.planTo }, from: { [p.id]: p.currentPlanEnd } };
  } else if (either && either.planToYear !== null) {
    // only the adult whose "Plan to age" ends the plan now moves: the other keeps theirs, so their own income is not counted
    // into an age nobody suggested (a first try set the husband to 101)
    // (and any adult whose age ends the plan after that year comes down to it, so one tap always gives the year the button names)
    const pair = alive.slice(0, 2).filter((p) => endYear(p) !== null);
    const last = pair.reduce((a, b) => (endYear(b) > endYear(a) ? b : a), pair[0]);
    const nowEnd = last ? endYear(last) : null;
    const Y = either.planToYear;
    const moved = pair.filter((p) => p === last ? endYear(p) !== Y : endYear(p) > Y);
    if (last && moved.length) apply = { year: Y, fromYear: nowEnd, ages: Object.fromEntries(moved.map((p) => [p.id, Y - birthYear(p.id)])), from: Object.fromEntries(moved.map((p) => [p.id, p.currentPlanEnd])) };
  }
  const suggestion = !alive.length ? "" : either ? `Plan for at least one of you being alive to about ${either.planTo} (${nameOf(either.first)} age): that is when the chance drops under 1 in 10.` : `Plan to about ${alive[0].planTo}: that is when the chance of still being alive drops under 1 in 10.`;
  return { people, either, suggestion, apply, hasData: alive.length > 0 };
}

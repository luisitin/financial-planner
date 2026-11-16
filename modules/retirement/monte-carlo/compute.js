// modules/retirement/monte-carlo/compute.js -- PURE and heavy (runs on the PC when connected).
// The same projection thousands of times with returns drawn at random around the plan's
// assumptions (lognormal, the plan's means and swings), to say how often the money lasts.
import { project, affordableSpending } from "../../../core/math/retirement.js";
import { mulberry32, normal, percentile, pickIndices, ar1Paths, lag1 } from "../../../core/math/montecarlo.js";
import { buildInputs, retirementUnknown } from "../projection/compute.js";
import { BAD_RUN_NOTE } from "../odds.js";
import { toCsv } from "../../../core/csv.js";
import { RETURNS } from "../historical/data/returns.js";
// the plan's own odds of living, read only (gap next-60 #37): How long to plan for's chances, by its own function
import { compute as longevityOf, survival } from "../longevity/compute.js";

/** Yearly return sequences: lognormal draws with the given arithmetic mean and standard deviation, stocks and bonds drawn together with a mild correlation. */
export function drawSequences(n, years, { stocks, bonds, stdevStocks, stdevBonds, corr = 0.1, seed = 1 }) {
  return shapeSequences(drawShocks(n, years, seed), { stocks, bonds, stdevStocks, stdevBonds, corr });
}

/**
 * drawShocks(n, years, seed) -> n paths of `years` pairs [a, b] of standard normal draws: the luck of each pretend year, before
 * it is turned into returns. Drawn once, it can be shaped into the returns of several versions of a plan (shapeSequences), so
 * a copy with other expected returns meets the same good and bad years as the plan (Compare, stress test 2026-11-11, W7).
 * The draws come in the order drawSequences always used, so drawSequences(n, years, {..., seed}) is unchanged.
 */
export function drawShocks(n, years, seed = 1) {
  const rand = mulberry32(seed);
  const out = [];
  for (let p = 0; p < n; p++) {
    const path = [];
    for (let y = 0; y < years; y++) { const a = normal(rand); path.push([a, normal(rand)]); }
    out.push(path);
  }
  return out;
}

/** shapeSequences(shocks, { stocks, bonds, stdevStocks, stdevBonds, corr }) -> the yearly returns of each path (lognormal, as drawSequences). Paths longer than needed may be sliced first. */
export function shapeSequences(shocks, { stocks, bonds, stdevStocks, stdevBonds, corr = 0.1 }) {
  const muS = Math.log(1 + stocks) - 0.5 * Math.log(1 + (stdevStocks / (1 + stocks)) ** 2), sigS = Math.sqrt(Math.log(1 + (stdevStocks / (1 + stocks)) ** 2));
  const muB = Math.log(1 + bonds) - 0.5 * Math.log(1 + (stdevBonds / (1 + bonds)) ** 2), sigB = Math.sqrt(Math.log(1 + (stdevBonds / (1 + bonds)) ** 2));
  // Convert the requested correlation of simple returns to the correlation of their normal log draws.
  const spread = Math.sqrt(Math.expm1(sigS ** 2) * Math.expm1(sigB ** 2));
  const normalCorr = spread > 0 ? Math.log1p(corr * spread) / (sigS * sigB) : corr;
  const k = Math.sqrt(1 - normalCorr * normalCorr);
  return shocks.map((path) => path.map(([z1, n2]) => {
    const z2 = normalCorr * z1 + k * n2;
    return { stocks: stdevStocks === 0 ? stocks : Math.exp(muS + sigS * z1) - 1, bonds: stdevBonds === 0 ? bonds : Math.exp(muB + sigB * z2) - 1 };
  }));
}

/** The chance a careful spending figure is worked to unless the plan says otherwise: the money lasts in 9 of 10 pretend futures. */
export const CAREFUL_CHANCE = 0.9;
/** The chips on Chance the money lasts > "Set my own numbers" (gap #17): Fidelity's "below average" and "significantly below
 * average" markets (75% and 90% confidence) and the top of T. Rowe Price's 80% to 95% "Confidence Zone" (README, read 2026-11-13). */
export const CAREFUL_CHOICES = Object.freeze([0.75, 0.9, 0.95]);
/** The lines for the verdict unless the plan says otherwise: strong from 85 in 100, fair from 70 (README: the usual bands). */
export const GOOD_CHANCE = 0.85;
export const OK_CHANCE = 0.7;
const share = (x, lo, hi) => (typeof x === "number" && Number.isFinite(x) && x >= lo && x <= hi ? x : null);
/** asCarefulChance(x) -> x when it is a chance to plan to (a number from 0.5 to 0.99: below a coin toss is not careful; at 100%
 * there is no figure), else 9 in 10. */
export const asCarefulChance = (x) => share(x, 0.5, 0.99) ?? CAREFUL_CHANCE;
/**
 * carefulChanceOf(plan) -> the chance the plan asks the careful spending to be worked to (gap #17): `assumptions.carefulChance`
 * read by asCarefulChance, so 9 in 10 when it is not set. compute() below works to it unless it is asked for another chance;
 * a page gets a figure worked to it only when it asks (modules/retirement/careful.js whenCareful's `chance`), and then says that
 * chance in words (badRunNote), never odds.js's fixed "(only 1 in 10 is worse)" (critic of g34, 2026-11-13).
 */
export const carefulChanceOf = (plan) => asCarefulChance(plan?.assumptions?.carefulChance);
/** linesOf(plan) -> { good, ok }: the person's own lines for "strong" and "fair" (`assumptions.goodChance`, `okChance`, each
 * from 0.01 to 1), else 85 and 70; fair is never above strong. */
export function linesOf(plan) {
  const a = plan?.assumptions ?? {};
  const good = share(a.goodChance, 0.01, 1) ?? GOOD_CHANCE;
  return { good, ok: Math.min(share(a.okChance, 0.01, 1) ?? OK_CHANCE, good) };
}
/** verdictOf(rate, { good, ok }) -> "strong" | "fair" | "weak" for a share of pretend futures in which the money lasts. */
export const verdictOf = (rate, { good = GOOD_CHANCE, ok = OK_CHANCE } = {}) => (rate >= good ? "strong" : rate >= ok ? "fair" : "weak");
/** perHundred(share) -> the share in whole hundredths, rounded down (580 of 2,000 is 29, though 0.29 * 100 is 28.999...), never
 * 100 unless it is every one. */
export const perHundred = (s) => (s >= 1 ? 100 : Math.max(0, Math.min(99, Math.floor(Number(s) * 100 + 1e-9))));
/** inWords(share, word = "in") -> "19 in 20": the smallest whole "N in M" (M up to 100) that is the share; "of" for "19 of 20". */
export function inWords(s, word = "in") {
  for (let m = 2; m <= 100; m++) { const n = Math.round(s * m); if (n > 0 && Math.abs(n - s * m) < 1e-9) return `${n} ${word} ${m}`; }
  return `${perHundred(s)} ${word} 100`;
}
/** badRunNote(chance) -> the note beside "even in a bad run of years" for a careful chance: "(only 1 in 10 is worse)" at 9 in
 * 10 (odds.js BAD_RUN_NOTE), "(only 1 in 20 is worse)" at 19 in 20, "(only 3 in 20 are worse)" at 17 in 20. */
export function badRunNote(chance = CAREFUL_CHANCE) {
  if (chance === CAREFUL_CHANCE) return BAD_RUN_NOTE;
  const w = inWords(1 - chance);
  return `(only ${w} ${/^1 /.test(w) ? "is" : "are"} worse)`;
}
/** The first so many paths of the draw give a first guess at the careful figure (cheap: 300 paths, not 2,000). */
export const CAREFUL_PATHS = 300;
/** The draw the careful figure is settled on: the Chance page's own 2,000 paths (same seed), so a plan spending exactly the
 * careful figure lasts in at least 9 of 10 of the paths that page counts, never "9 of 10" next to 88% (round 5, 2026-11-02). */
export const CAREFUL_SETTLE_PATHS = 2000;

/**
 * spendingAtChance(inputs, { chance, seed, paths, coarse, sequences, legacy }) -> { yearly, chance, rate, planned, average, paths, runs }:
 * the most a year (today's dollars, whole $100s, the same every year after inflation: the "fixed-real" rule that
 * `affordableSpending` uses) that still lasts to the end, leaving at least `legacy`, in at least `chance` of the market paths
 * drawn around the plan's returns: the `paths` (2,000) of `drawSequences(paths, years, { seed })`, or `sequences` when given
 * (compute() passes its own draw). A first guess on the first `coarse` (300) paths, then settled on all of them.
 * `rate` is the share of paths that last at `yearly`; `planned` the share that last at the plan's own spending spent the same
 * way (steady, whatever rule the plan picked); `average` is affordableSpending's figure (every year earning exactly the
 * average return: about a 4 in 10 chance on the fixtures); `runs` how many times the projection ran.
 * Cost: a path that lasts at some spending lasts at any less, and one that falls short at some spending falls short at any
 * more, so each path remembers the most it lasted at and the least it fell short at, and only paths whose answer is not yet
 * known run again (about 4,000 runs in all on the fixtures, where a plain 300-path search alone took 4,200).
 */
export function spendingAtChance(inputs, options = {}) {
  const it = carefulSteps(inputs, options);
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}

/**
 * carefulSteps(inputs, options): the same search as spendingAtChance, as a generator that yields every few dozen runs of the
 * projection and returns the same answer, so a page working it out on a phone can do it a slice at a time between frames
 * (the screen stays live) instead of in one long block. Still pure: it never looks at the clock; the caller decides when to
 * ask for the next slice.
 */
export function* carefulSteps(inputs, { chance = CAREFUL_CHANCE, seed = 1, paths = CAREFUL_SETTLE_PATHS, coarse = CAREFUL_PATHS, sequences = null, legacy = 0, slice = 40 } = {}) {
  const average = affordableSpending(inputs);
  yield 0;
  const years = inputs.endYear - inputs.startYear + 1;
  const seqs = sequences ?? drawSequences(paths, years, { stocks: inputs.returns.stocks, bonds: inputs.returns.bonds, stdevStocks: inputs.stdev.stocks, stdevBonds: inputs.stdev.bonds, seed });
  yield 0;
  const N = seqs.length;
  const okAt = new Array(N).fill(-Infinity), shortAt = new Array(N).fill(Infinity);
  let runs = 0, next = slice;
  const lasts = (k, s) => {
    if (s <= okAt[k]) return true;
    if (s >= shortAt[k]) return false;
    runs++;
    const r = project({ ...inputs, strategy: "fixed-real", spending: { yearly: s } }, { sequence: seqs[k] });
    const ok = r.success && (legacy <= 0 || r.endBalanceReal >= legacy - 0.5);
    if (ok) okAt[k] = s; else shortAt[k] = s;
    return ok;
  };
  function* count(s, n = N) { let c = 0; for (let k = 0; k < n; k++) { if (lasts(k, s)) c++; if (runs >= next) { next = runs + slice; yield runs; } } return c; }
  function* enough(s, n = N) { return (yield* count(s, n)) >= Math.ceil(chance * n - 1e-9); }
  const down100 = (x) => Math.max(0, Math.floor(x / 100) * 100);
  // 1. a first guess on the first paths: halve the gap between a figure that lasts and one that does not, to $100
  const nC = Math.min(coarse, N);
  let lo = 0, hi = down100(Math.max(average, 1000) * 1.25) + 100;
  for (let k = 0; k < 8 && (yield* enough(hi, nC)); k++) { lo = hi; hi = down100(hi * 1.5); }
  while (hi - lo > 100) { const mid = down100((lo + hi) / 2); if (mid <= lo) break; if (yield* enough(mid, nC)) lo = mid; else hi = mid; }
  // 2. settle on every path: a figure a little above the guess that falls short, one below it that lasts, then halve the gap
  const margin = Math.max(1000, down100(lo * 0.04));
  hi = lo + margin;
  let found = null;
  for (let k = 0; k < 12 && (yield* enough(hi)); k++) { found = hi; hi += margin * 2 ** (k + 1); }
  if (found !== null) lo = found;
  else {
    lo = Math.max(0, hi - 2 * margin);
    for (let k = 0; k < 40 && lo > 0 && !(yield* enough(lo)); k++) { hi = lo; lo = Math.max(0, lo - margin * 2 ** (k + 2)); }
  }
  if (lo > 0 || (yield* enough(0))) while (hi - lo > 100) { const mid = down100((lo + hi) / 2); if (mid <= lo) break; if (yield* enough(mid)) lo = mid; else hi = mid; }
  else lo = 0;   // even spending nothing falls short in more than 1 of 10 paths
  const rate = (yield* count(lo)) / N, planned = (yield* count(inputs.spending?.yearly ?? 0)) / N;
  return { yearly: lo, chance, rate, planned, average, paths: N, runs };
}

/**
 * carefulSettled(plan, build, options): carefulSteps for a whole plan, settled (left2 fix round 1, 2026-11-12, M-1). The health
 * line is priced from the plan's spending (Medicare's income-related surcharge and the marketplace credit move with what is
 * drawn), so a plan that types the careful figure as its spending has slightly different health costs: on
 * qa/fixtures/retirement-plan.mjs at $110,100 the first search gives $97,800, and a plan spending $97,800 lasts in only 0.8985
 * of the paths. So when the plan's spending is a typed figure (`retirement.spendingMonthly`, not Get started's own figure and
 * not one typed over today's bills, which reads the bills: projection README), the plan is run again with the figure typed;
 * while that plan lasts in fewer than 9 of 10 paths, its own careful figure is taken and checked the same way (at most 4 more
 * searches): $97,700 (0.899), then $97,600 (0.9005). A figure that already lasts is kept, so a plan spending less than its
 * careful figure ($78,000 on the fixture: $96,900, 0.9085) gets the answer it always had. `planned` stays the share at the
 * plan's own spending; `rate` is the share a plan spending `yearly` lasts in. `build(plan)` -> projection inputs or null. A
 * plan whose spending is read from today's bills is searched once, as before. Same yields as carefulSteps.
 */
export function* carefulSettled(plan, build, options = {}) {
  const inputs = build(plan);
  if (!inputs) return null;
  const first = yield* carefulSteps(inputs, options);
  const rt = plan?.retirement ?? {};
  const typed = Number(rt.spendingMonthly) > 0 && plan?.guide?.setup?.retireAuto !== true && rt.spendingFrom !== "expenses";
  if (!typed || first.yearly <= 0) return first;
  const want = options.chance ?? CAREFUL_CHANCE;
  let cur = first, runs = first.runs;
  for (let k = 0; k < 5; k++) {
    const q = structuredClone(plan); q.retirement.spendingMonthly = cur.yearly / 12;
    const I = build(q);
    if (!I) break;
    const next = yield* carefulSteps(I, options);
    runs += next.runs;
    if (next.planned >= want - 1e-9 || next.yearly >= cur.yearly || k === 4) { cur = { ...cur, rate: next.planned }; break; }
    cur = next;
  }
  return { ...cur, planned: first.planned, average: first.average, runs };
}
/** settledAtChance(plan, build, options): carefulSettled run to the end. */
export function settledAtChance(plan, build, options = {}) {
  const it = carefulSettled(plan, build, options);
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}

// ---------------------------------------------------------------- how the pretend years are drawn (gap next-60 #35)
/** The ways Chance the money lasts can draw its pretend years: the usual way (drawSequences: returns around the plan's averages
 * and swings, prices rising steadily), years picked from history, and prices that rise unevenly. */
export const DRAWS = Object.freeze(["usual", "history", "prices"]);
/** asDraw(x) -> "history" | "prices" for those words, else "usual" (anything else is the usual way). */
export const asDraw = (x) => (x === "history" || x === "prices" ? x : "usual");
/** drawOf(plan) -> the way the person kept on Chance the money lasts (`assumptions.chanceDraw`, read only by that page's view,
 * which asks compute() for it: compute() never reads the field, so no other page moves when it is kept). */
export const drawOf = (plan) => asDraw(plan?.assumptions?.chanceDraw);
const meanOf = (xs) => xs.reduce((t, x) => t + x, 0) / xs.length;
const sdOf = (xs) => { const m = meanOf(xs); return Math.sqrt(xs.reduce((t, x) => t + (x - m) ** 2, 0) / (xs.length - 1)); };
/**
 * HISTORY: what the bundled history holds (modules/retirement/historical/data/returns.js: Damodaran, NYU Stern, S&P 500 with
 * dividends, 10-year Treasury, 3-month bills and CPI, yearly; README), worked out from the file itself: its first and last
 * year, how many years, each class's arithmetic mean (cash is the bills), and inflation's swing (sample standard deviation) and
 * lag-1 autocorrelation. 1928 to 2025: means 11.86%, 4.82%, 3.42% and 3.11%; inflation's swing 3.90%, lag-1 0.61.
 */
export const HISTORY = Object.freeze((() => {
  const col = (k) => RETURNS.map((r) => r[k]);
  const infl = col("inflation");
  return { from: RETURNS[0].year, to: RETURNS[RETURNS.length - 1].year, years: RETURNS.length,
    mean: Object.freeze({ stocks: meanOf(col("stocks")), bonds: meanOf(col("bonds")), cash: meanOf(col("bills")), inflation: meanOf(infl) }),
    inflationSd: sdOf(infl), inflationLag1: lag1(infl) };
})());
/** The second stream's seed for prices that rise unevenly: the seed XOR this, so the returns keep the usual draw's own seed. */
export const PRICES_SEED = 0x5bd1e995;
/**
 * historySequences(n, years, { stocks, bonds, cash, inflation, seed }) -> { picks, seqs }: years picked from history. Each
 * pretend year picks one real year k (pickIndices: floor(u x 98), u from mulberry32(seed), with replacement) and takes that
 * year's stocks, bonds, bills (cash) and CPI change together, each set to average the plan's own figure m over the whole
 * history: (1 + r_k) x (1 + m) / (1 + h) - 1, h the history's mean (HISTORY.mean). So over the 98 years each class averages
 * exactly the plan's figure; the swings, the tails and the moving together are history's. `picks` holds the index of the real
 * year behind each pretend year (RETURNS[k]).
 */
export function historySequences(n, years, { stocks, bonds, cash, inflation, seed = 1 }) {
  const picks = pickIndices(n, years, RETURNS.length, seed);
  const M = HISTORY.mean;
  const k = { stocks: (1 + stocks) / (1 + M.stocks), bonds: (1 + bonds) / (1 + M.bonds), cash: (1 + cash) / (1 + M.cash), inflation: (1 + inflation) / (1 + M.inflation) };
  const seqs = picks.map((path) => path.map((i) => {
    const r = RETURNS[i];
    return { stocks: (1 + r.stocks) * k.stocks - 1, bonds: (1 + r.bonds) * k.bonds - 1, cash: (1 + r.bills) * k.cash - 1, inflation: (1 + r.inflation) * k.inflation - 1 };
  }));
  return { picks, seqs };
}
/**
 * pricesSequences(n, years, { stocks, bonds, stdevStocks, stdevBonds, inflation, seed }) -> the usual draw (drawSequences on the
 * same seed: the same good and bad years for stocks and bonds) with each year's inflation drawn too: ar1Paths around the plan's
 * figure, swinging by history's 3.90% with history's lag-1 of 0.61 (a year of high prices tends to be followed by another),
 * this year at the plan's figure, from a second stream (seed XOR PRICES_SEED).
 */
export function pricesSequences(n, years, { stocks, bonds, stdevStocks, stdevBonds, inflation, seed = 1 }) {
  const base = drawSequences(n, years, { stocks, bonds, stdevStocks, stdevBonds, seed });
  const infl = ar1Paths(n, years, { mean: inflation, phi: HISTORY.inflationLag1, sd: HISTORY.inflationSd, seed: (seed ^ PRICES_SEED) >>> 0 });
  return base.map((path, p) => path.map((st, y) => ({ ...st, inflation: infl[p][y] })));
}
/** drawFor(way, n, years, inputs, seed) -> the pretend years for a way (asDraw), from projection inputs. */
export function drawFor(way, n, years, I, seed = 1) {
  const o = { stocks: I.returns.stocks, bonds: I.returns.bonds, stdevStocks: I.stdev.stocks, stdevBonds: I.stdev.bonds, seed };
  const w = asDraw(way);
  if (w === "history") return historySequences(n, years, { stocks: o.stocks, bonds: o.bonds, cash: Number(I.rates?.cash) || 0, inflation: Number(I.rates?.inflation) || 0, seed }).seqs;
  if (w === "prices") return pricesSequences(n, years, { ...o, inflation: Number(I.rates?.inflation) || 0 });
  return drawSequences(n, years, o);
}

// ---------------------------------------------------------------- money and the odds of living (gap next-60 #37)
/** The ages the page shows: the first three of these above today's age and within the plan. */
export const LIVING_AGES = Object.freeze([85, 90, 95, 100]);
/** per100(shares) -> whole numbers out of 100 that add to 100 (shares that add to 1): each share x 100 rounded down, then the
 * units left over go to the largest remainders, the earlier on a tie (Hamilton's method). */
export function per100(shares) {
  const raw = shares.map((x) => Math.max(0, Number(x) || 0) * 100);
  const out = raw.map((x) => Math.floor(x));
  let left = 100 - out.reduce((t, x) => t + x, 0);
  const order = raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0 && order.length; k = (k + 1) % order.length, left--) out[order[k][1]]++;
  return out;
}
/**
 * livingOdds(plan, byAge, { today, inputs }) -> { whose: "one" | "either", names, clock, ages: [{ age, year, alive, funded,
 * rich, broke, dead, per100 }] } | null: at the first three of LIVING_AGES above the first adult's age today and within the
 * plan, the share of pretend futures alive with money left (rich), alive with the money gone (broke) and no longer alive
 * (dead), which add to 1. alive: How long to plan for's own chance (retirement/longevity `survival`, with the sex and health
 * chosen there), for one adult that adult's, for two or more the chance that at least one of the first adult and the next is
 * alive, 1 - (1 - S_a)(1 - S_b) (that page's rule), years ahead on the first adult's clock (the projection's first person, whose
 * age the page's figures use). funded: byAge's share still funded in the year that adult turns the age. rich = alive x funded,
 * broke = alive x (1 - funded), dead = 1 - alive: living long and markets doing well taken as unrelated. null without today's
 * date or an adult with a birth date.
 */
export function livingOdds(plan, byAge, { today, inputs } = {}) {
  if (!today || !inputs?.people?.length || !byAge?.length) return null;
  const known = longevityOf(plan, { today }).people.filter((p) => p.age !== null);
  const first = known.find((p) => p.id === inputs.people[0].id);
  if (!first) return null;
  const pair = [first, ...known.filter((p) => p !== first)].slice(0, 2);
  const endAge = byAge[byAge.length - 1].age;
  const ages = LIVING_AGES.filter((m) => m > first.age && m <= endAge && byAge.some((r) => r.age === m)).slice(0, 3);
  return {
    whose: pair.length >= 2 ? "either" : "one", names: pair.map((p) => p.name), clock: first.name,
    ages: ages.map((m) => {
      const s = pair.map((p) => survival(p.age, p.age + (m - first.age), { sex: p.sex, health: p.health }));
      const alive = s.length >= 2 ? 1 - (1 - s[0]) * (1 - s[1]) : s[0];
      const row = byAge.find((r) => r.age === m);
      const rich = alive * row.funded, broke = alive * (1 - row.funded), dead = 1 - alive;
      return { age: m, year: row.year, alive, funded: row.funded, rich, broke, dead, per100: per100([rich, broke, dead]) };
    }),
  };
}

// ---------------------------------------------------------------- how the runs end, and every run as a file (gap next-60 #36)
/** The ages that split the runs that ran out: before 80, 80 to 89, 90 or later. */
export const FAIL_EDGES = Object.freeze([80, 90]);
/** The runs file holds each run's year-by-year balances while runs x years stays at or under this: 2,000 runs of up to 100
 * years (about 1.5 MB at most); 10,000 runs of a 40-year plan (about 3 MB) leave them out. */
export const RUNS_CELLS = 200000;
/** The runs file's first three columns; the year columns follow, "End of 2026" and so on. */
export const RUNS_HEAD = Object.freeze(["Pretend future", "Ran out at age", "Left at the end (today's dollars)"]);

/**
 * failGroups(ages, startAge, endAge, edges = FAIL_EDGES) -> [{ from, to, n }]: the runs that ran out, counted by the first
 * adult's age in the first year short (project's failAge), in groups cut at the edges the plan's ages reach: a plan from 58
 * to 97 has [58, 79], [80, 89], [90, 97]; one from 85 to 100 has [85, 89], [90, 100]; one from 91 to 100 one group. Every
 * group is returned, empty or not; an age outside the plan's ages counts in the nearest group.
 */
export function failGroups(ages, startAge, endAge, edges = FAIL_EDGES) {
  const cuts = edges.filter((e) => e > startAge && e <= endAge);
  const bounds = [startAge, ...cuts, Math.max(startAge, endAge) + 1];
  const out = [];
  for (let k = 0; k + 1 < bounds.length; k++) out.push({ from: bounds[k], to: bounds[k + 1] - 1, n: 0 });
  for (const a of ages) (out.find((g) => a <= g.to) ?? out[out.length - 1]).n++;
  return out;
}

/** niceStep(x, floor = 1000) -> the smallest of 1, 2, 2.5 and 5 times a power of ten at or above x (and at least floor). */
export function niceStep(x, floor = 1000) {
  const v = Math.max(floor, Number(x) || 0);
  for (let e = Math.floor(Math.log10(v)); ; e++) for (const m of [1, 2, 2.5, 5]) { const s = m * 10 ** e; if (s >= v * (1 - 1e-12)) return s; }
}

/**
 * leftBands(ends) -> { step, bands: [{ from, to, n }] (to: null for the last), median }: what is left at the end of the runs
 * that lasted, in today's dollars, in four bands of one round width: under s, s to 2s, 2s to 3s, 3s or more, where s is
 * niceStep(the 90th percentile / 4). So 3s is 0.75 to 1.5 times the 90th percentile: the top band holds the highest runs, often a
 * tenth or less, more in a long-tailed spread (27% of the widow's at 2,000 runs) and all of them when only one or two lasted; the
 * three below show the shape (n1 fix F3: this said "about the top tenth or less").
 * `median` is the middle run's figure rounded down to $1,000 (so "half of them end with more than" it is true); no runs:
 * { step: null, bands: [], median: null }.
 */
export function leftBands(ends) {
  const s = [...ends].map((v) => Math.max(0, Number(v) || 0)).sort((x, y) => x - y);
  if (!s.length) return { step: null, bands: [], median: null };
  const step = niceStep(percentile(s, 0.9) / 4);
  const bands = [0, 1, 2, 3].map((k) => ({ from: k * step, to: k < 3 ? (k + 1) * step : null, n: 0 }));
  for (const v of s) bands[Math.min(3, Math.floor(v / step + 1e-9))].n++;
  return { step, bands, median: Math.floor(percentile(s, 0.5) / 1000) * 1000 };
}

const whole = (v) => Math.max(0, Math.round(Number(v) || 0));
/** The cells of one run's line in the file: its number, the age the money ran out (blank when it lasted), what is left at the
 * end, then (withYears) its balance at the end of each year, whole dollars, today's dollars, never below 0. */
const runCells = (k, r, withYears) => [k + 1, r.success ? "" : (r.failAge ?? ""), whole(r.endBalanceReal), ...(withYears ? r.rows.map((x) => whole(x.totalReal)) : [])];
/** The bytes core/csv.js toCsv writes for one line of plain cells (no comma, quote or line break in any): the cells, a comma
 * between each, then CRLF. */
const lineBytes = (cells) => cells.reduce((t, c) => t + String(c).length, 0) + cells.length - 1 + 2;
const headOf = (years) => [...RUNS_HEAD, ...years.map((y) => `End of ${y}`)];

/**
 * runsCsv(d) -> the runs file's text, from compute(plan, { runs: true }): one line per pretend future in the order drawn, the
 * three RUNS_HEAD columns, then "End of <year>" for each year in d.runsYears (none when the file would be too big: RUNS_CELLS).
 * Through core/csv.js toCsv, so a spreadsheet opens it; its length is d.endings.file.bytes when both were asked for together.
 */
export function runsCsv(d) {
  const years = d.runsYears ?? [];
  return toCsv(headOf(years), (d.runs ?? []).map((r, k) => [k + 1, r.failAge ?? "", whole(r.endReal), ...(years.length ? (r.balances ?? []).map(whole) : [])]));
}

/**
 * compute(plan, { today, paths = 2000, seed = 1, maxPaths, careful = true, legacy = 0, chance, endings, runs, draw, living }) -> {
 *   ready, paths, successRate, medianEndReal, failAges: { p10, p50 } (ages money ran out among failing paths),
 *   bands: [{ year, age, p10, p25, p50, p75, p90 }] real totals per year, byAge: [{ age, alive: share of paths still funded }],
 *   verdict: "strong" | "fair" | "weak" (verdictOf with the plan's lines, linesOf), inputsSummary,
 *   careful: spendingAtChance(...) for the plan (the spending that lasts in `chance` of the pretend futures when it is asked
 *            for, read by asCarefulChance, else in the plan's own careful chance, carefulChanceOf: 9 in 10 unless it chose another;
 *            the share that lasts at the plan's spending spent steadily, and the average-market figure); null with careful:
 *            false (pages that do not show it)
 *   with endings: true (gap next-60 #36), also endings: { paths, ranOut, lasted, startAge, endAge, out: failGroups(...),
 *            step, left: leftBands(...).bands, medianLeft, file: { rows, years (columns of balances, 0 when left out), bytes } };
 *   with runs: true, also runs: [{ failAge (null when it lasted), endReal, balances? (each year's end, today's dollars, while
 *            runs x years <= RUNS_CELLS) }] and runsYears (the years of those columns, [] when left out): runsCsv(d) is the file.
 *   Without either, the result is what it always was, byte for byte (tests/n1-invariance.test.mjs).
 *   with draw: "history" or "prices" (gap next-60 #35), the pretend years are drawn that way (drawFor) and the result also holds
 *            draw: the way; any other draw is the usual way, byte for byte (tests/chance-draws-invariance.test.mjs);
 *   with living: true (gap next-60 #37), also living: livingOdds(...) (money and the odds of living at 85, 90, 95), or null.
 * }
 */
export function compute(plan, params = {}) {
  const b = buildInputs(plan, params);
  if (!b.inputs) return { ready: false, missing: b.missing };
  const want = Math.max(100, Number(params.paths ?? 2000));
  const paths = Math.min(want, Number(params.maxPaths ?? 20000));
  const years = b.inputs.endYear - b.inputs.startYear + 1;
  // the way the pretend years are drawn (gap next-60 #35): the usual way unless "history" or "prices" is asked for, by the line
  // it always was
  const way = asDraw(params.draw);
  const seqs = way === "usual" ? drawSequences(paths, years, { stocks: b.inputs.returns.stocks, bonds: b.inputs.returns.bonds, stdevStocks: b.inputs.stdev.stocks, stdevBonds: b.inputs.stdev.bonds, seed: Number(params.seed ?? 1) })
    : drawFor(way, paths, years, b.inputs, Number(params.seed ?? 1));
  const perYear = Array.from({ length: years }, () => []);
  let successes = 0; const failAges = [];
  const alive = new Array(years).fill(0);
  // how the runs end and the runs file, only when asked (the page's part and its button)
  const wantEnds = params.endings === true, wantRuns = params.runs === true;
  const withYears = paths * years <= RUNS_CELLS;
  const yearList = Array.from({ length: years }, (_, i) => b.inputs.startYear + i);
  const lastingEnds = [], runs = [];
  let bytes = wantEnds ? lineBytes(headOf(withYears ? yearList : [])) : 0;
  seqs.forEach((seq, k) => {
    const r = project(b.inputs, { sequence: seq });
    if (r.success) successes++; else failAges.push(r.failAge);
    r.rows.forEach((row, i) => { perYear[i].push(row.totalReal); if (row.shortfall <= 0 && (i === 0 || r.failYear === null || row.year < r.failYear)) alive[i]++; });
    if (wantEnds) { if (r.success) lastingEnds.push(r.endBalanceReal); bytes += lineBytes(runCells(k, r, withYears)); }
    if (wantRuns) runs.push({ failAge: r.success ? null : (r.failAge ?? null), endReal: r.endBalanceReal, ...(withYears ? { balances: r.rows.map((x) => x.totalReal) } : {}) });
  });
  const bands = perYear.map((vals, i) => { const s = [...vals].sort((x, y) => x - y); const row = { year: b.inputs.startYear + i, age: b.inputs.startYear + i - b.inputs.people[0].birthYear }; for (const p of [10, 25, 50, 75, 90]) row[`p${p}`] = percentile(s, p / 100); return row; });
  const successRate = successes / paths;
  const fa = [...failAges].sort((x, y) => x - y);
  const out = {
    ready: true, paths, successRate, medianEndReal: bands[bands.length - 1].p50,
    failAges: fa.length ? { p10: percentile(fa, 0.1), p50: percentile(fa, 0.5), count: fa.length } : null,
    bands, byAge: alive.map((n, i) => ({ age: bands[i].age, year: bands[i].year, funded: n / paths })),
    verdict: verdictOf(successRate, linesOf(plan)),   // strong from 85 in 100, fair from 70, or the person's own lines (gap #17)
    retireYear: b.inputs.retireYear, endYear: b.inputs.endYear, spendingYearly: b.inputs.spending.yearly, seed: Number(params.seed ?? 1),
    // settled on the seed's first 2,000 paths whatever `paths` asks for (the Chance page's own draw: one answer on every page);
    // `legacy` is what the money should still hold at the end (Goal seek's goal)
    // and settled on the plan spending it (carefulSettled, M-1)
    careful: params.careful === false ? null : settledAtChance(plan, (q) => (q === plan ? b.inputs : buildInputs(q, params).inputs ?? null), { chance: params.chance === undefined || params.chance === null ? carefulChanceOf(plan) : asCarefulChance(params.chance), seed: Number(params.seed ?? 1), legacy: Math.max(0, Number(params.legacy) || 0), sequences: paths >= CAREFUL_SETTLE_PATHS && way === "usual" ? seqs.slice(0, CAREFUL_SETTLE_PATHS) : null }),
  };
  // another way of drawing says so (the careful figure above is always the usual way's: one figure on every page)
  if (way !== "usual") out.draw = way;
  if (wantEnds) {
    const startAge = bands[0].age, endAge = bands[bands.length - 1].age;
    const left = leftBands(lastingEnds);
    out.endings = { paths, ranOut: failAges.length, lasted: successes, startAge, endAge, out: failGroups(failAges, startAge, endAge), step: left.step, left: left.bands, medianLeft: left.median, file: { rows: paths, years: withYears ? years : 0, bytes } };
  }
  if (wantRuns) { out.runs = runs; out.runsYears = withYears ? yearList : []; }
  // money and the odds of living, only when asked (the page's "How the pretend futures end")
  if (params.living === true) out.living = livingOdds(plan, out.byAge, { today: params.today, inputs: b.inputs });
  // nothing saved for retirement and nothing going in: Will the money last?'s "We don't know yet", never "0 of 100" (whole-app
  // sweep x3, 2026-11-16); absent for every other plan
  const unknown = retirementUnknown(plan, { today: params.today ?? null });
  if (unknown) out.unknown = unknown;
  return out;
}

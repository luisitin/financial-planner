// modules/retirement/historical/compute.js -- PURE and heavy. The plan replayed through every
// stretch of real history since 1928 (Damodaran's yearly stock, bond, bill and inflation
// figures): if you had started this exact plan in 1929, in 1966, in 2000... how would it have
// gone? Only start years with enough history for the whole plan are used.
import { project, affordableSpending } from "../../../core/math/retirement.js";
import { buildInputs, retirementUnknown } from "../projection/compute.js";
import { RETURNS } from "./data/returns.js";

/** The plan's horizon replayed from every possible start year. */
export function replayAll(inputs, { fromRetirement = false } = {}) {
  const years = inputs.endYear - inputs.startYear + 1;
  const runs = [];
  for (let s = 0; s + years <= RETURNS.length; s++) {
    const slice = RETURNS.slice(s, s + years).map((r) => ({ stocks: r.stocks, bonds: r.bonds, cash: r.bills, inflation: r.inflation }));
    const r = project(inputs, { sequence: slice });
    runs.push({ startYear: RETURNS[s].year, success: r.success, failYear: r.failYear, failAge: r.failAge, endReal: r.endBalanceReal, minReal: Math.min(...r.rows.map((x) => x.totalReal)) });
  }
  return runs;
}
// ---------------------------------------------------------------- the rate that never touches the starting money (gap next-60 #53)
/**
 * perpetualRate(stretch, stocks) -> the most that could be taken out in the first year, as a share of the savings then, with the
 * same amount raised each year by that year's prices, so that at the end of the stretch the savings in today's dollars are at
 * least what they started with (Portfolio Charts' "perpetual withdrawal rate"; README). `stretch`: [{ stocks, bonds, inflation }]
 * yearly, `stocks`: the share in stocks, the rest in bonds. Each year t (1..N): take w x B x P_t at the start, where P_1 = 1 and
 * P_t = P_(t-1) x (1 + i_(t-1)), then the year's return r_t = s x stocks_t + (1 - s) x bonds_t. The real end is
 * B x G - w x B x H, G = prod(1 + r_t) / P_(N+1), H = sum_t P_t x prod_(u >= t)(1 + r_u) / P_(N+1), so the rate is
 * max(0, (G - 1) / H): exact, no search. A balance that went below zero would stay below (returns only scale it and later
 * withdrawals deepen it), so an end at or above the start means the money never ran out on the way. 0 when even taking nothing
 * ends below the start; null for an empty stretch.
 */
export function perpetualRate(stretch, stocks) {
  const N = stretch?.length ?? 0;
  if (!N) return null;
  const s = Math.min(1, Math.max(0, Number(stocks) || 0));
  let grow = 1;
  const from = new Array(N);   // growth from the start of year t to the end of the stretch
  for (let t = N - 1; t >= 0; t--) { grow *= 1 + s * stretch[t].stocks + (1 - s) * stretch[t].bonds; from[t] = grow; }
  let P = 1, H = 0;
  for (let t = 0; t < N; t++) { H += P * from[t]; P *= 1 + stretch[t].inflation; }
  return Math.max(0, (from[0] / P - 1) / (H / P));
}

/**
 * planRate(inputs) -> { year, rate } | null: what the plan takes from its savings in its first retired year if markets do as
 * well as average (project(inputs) with no sequence): the spending, one-time and health costs and the year's tax, less the year's
 * income (How much to take out's firstYear `need`), over the savings at the start of that year (the year before's end, or
 * today's balances when it is retired already). rate null when there are no savings then; null with no retired year.
 */
export function planRate(I) {
  const r = project(I);
  const k = r.rows.findIndex((x) => x.retired);
  if (k < 0) return null;
  const row = r.rows[k], B = I.balances ?? {};
  const start = k > 0 ? r.rows[k - 1].total : ["cash", "taxable", "deferred", "free"].reduce((t, b) => t + (Number(B[b]) || 0), 0);
  const need = Math.max(0, row.spending + (row.eventOut ?? 0) + row.taxes - row.income);
  return { year: row.year, rate: start > 0.5 ? need / start : null };
}

/**
 * perpetualOf(inputs) -> { years, from, to, stocks, windows, worst: { startYear, rate }, middle: { startYear, rate }, plan } |
 * null: perpetualRate over the plan's years of taking money out (its retirement year, or this year when retired already, to its
 * last year), from every start year history has room for, at the plan's stock share once retired (`rates.stocksRetired`).
 * worst: the lowest rate (the earliest start year on a tie); middle: the lower middle of the start years sorted by rate;
 * plan: planRate(inputs). null when the years are more than history holds.
 */
export function perpetualOf(I) {
  const from = Math.max(I.startYear, I.retireYear), to = I.endYear, N = to - from + 1;
  if (!(N >= 1) || N > RETURNS.length) return null;
  const stocks = Number(I.rates?.stocksRetired ?? 0.5);
  const rows = [];
  for (let k = 0; k + N <= RETURNS.length; k++) rows.push({ startYear: RETURNS[k].year, rate: perpetualRate(RETURNS.slice(k, k + N), stocks) });
  const sorted = [...rows].sort((a, c) => a.rate - c.rate || a.startYear - c.startYear);
  return { years: N, from, to, stocks, windows: rows.length, worst: sorted[0], middle: sorted[Math.floor((sorted.length - 1) / 2)], plan: planRate(I) };
}

/**
 * compute(plan, { today, quick, perpetual }) -> {
 *   ready, windows, years, successRate, worst: [{ startYear, failAge | endReal }] (5), best: [...] (3), medianEndReal,
 *   runs: [...all], safeSpending (real yearly spending that survived every start year; null when quick),
 *   dataRange: [first, last], note
 *   with perpetual: true (gap next-60 #53), also perpetual: perpetualOf(inputs); without it the result is what it always was,
 *   byte for byte (tests/n1-invariance.test.mjs)
 * }
 */
export function compute(plan, params = {}) {
  const b = buildInputs(plan, params);
  if (!b.inputs) return { ready: false, missing: b.missing };
  const years = b.inputs.endYear - b.inputs.startYear + 1;
  if (years > RETURNS.length) return { ready: false, missing: [`the plan runs ${years} years; history covers ${RETURNS.length}`] };
  const runs = replayAll(b.inputs);
  const successRate = runs.filter((r) => r.success).length / runs.length;
  const sorted = [...runs].sort((a, c) => (a.failAge ?? 999) - (c.failAge ?? 999) || a.endReal - c.endReal);
  const ends = runs.map((r) => r.endReal).sort((a, c) => a - c);
  let safeSpending = null;
  if (!params.quick) {
    // the spending every start year could carry: bisection over the worst starts (the ones that define the floor)
    const worstStarts = sorted.slice(0, 6).map((r) => r.startYear);
    safeSpending = Infinity;
    for (const sy of worstStarts) {
      const s = RETURNS.findIndex((r) => r.year === sy);
      const seq = RETURNS.slice(s, s + years).map((r) => ({ stocks: r.stocks, bonds: r.bonds, cash: r.bills, inflation: r.inflation }));
      safeSpending = Math.min(safeSpending, affordableSpending(b.inputs, { sequence: seq }, { steps: 24 }));
    }
  }
  const out = {
    ready: true, windows: runs.length, years, successRate, runs,
    worst: sorted.slice(0, 5), best: [...runs].sort((a, c) => c.endReal - a.endReal).slice(0, 3),
    medianEndReal: ends[Math.floor(ends.length / 2)], safeSpending, spendingYearly: b.inputs.spending.yearly,
    dataRange: [RETURNS[0].year, RETURNS[RETURNS.length - 1].year], retireYear: b.inputs.retireYear,
    verdict: successRate >= 0.9 ? "strong" : successRate >= 0.75 ? "fair" : "weak",
  };
  if (params.perpetual === true) out.perpetual = perpetualOf(b.inputs);
  // nothing saved for retirement and nothing going in: Will the money last?'s "We don't know yet", never "ran out from every start
  // year" (whole-app sweep x3, 2026-11-16); absent for every other plan
  const unknown = retirementUnknown(plan, { today: params.today ?? null });
  if (unknown) out.unknown = unknown;
  return out;
}

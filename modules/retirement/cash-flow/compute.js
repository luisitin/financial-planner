// modules/retirement/cash-flow/compute.js -- PURE. The year-by-year table behind the projection:
// for every year, ages, what comes in (pay contributions, Social Security, pensions), what goes
// out (spending, taxes), what is taken from which bucket, and the balances at year end, in
// today's dollars or in the dollars of the year. Modelled on the Bogleheads Retiree Portfolio
// Model's yearly ledger; the numbers come from the Projection page's engine run.
import { compute as computeProjection, buildInputs, savingsUnknown, nothingSaved } from "../projection/compute.js";
import { listOf, clean, drawSets, check, apply as applyHappenings, SPEND_FLOOR } from "../happenings.js";

/**
 * compute(plan, { today, real = true }) -> { ready, missing, real, rows: [{ year, age, ages, retired, in: { contributions, income, lines }, out: { spending (health cover included), health, taxes }, from: { cash, taxable, deferred, free }, rmd, end: { cash, taxable, deferred, free, total }, shortfall, moves? }], totals, retireYear }
 * moves (only in a year with one: money moved between accounts on Will the money last?, gap list next 60 item 26): [{ fromName,
 * toName, amount, tax, capped }] in the dollars chosen, the engine row's own; its tax is in the year's `out.taxes` already.
 */
export function compute(plan, params = {}) {
  const pr = computeProjection(plan, params);
  if (!pr.ready) return { ready: false, missing: pr.missing, rows: [] };
  const real = params.real !== false;
  const k = (row, v) => real ? v / row.priceLevel : v;
  const rows = pr.rows.map((r) => ({
    year: r.year, age: r.ages[0], ages: r.ages, retired: r.retired, priceLevel: r.priceLevel,
    in: { contributions: k(r, r.contributions), income: k(r, r.income), lines: r.incomeLines.map((l) => ({ name: l.name, amount: k(r, l.amount) })) },
    // spending is all of it: the plan's spending and its health cover (marketplace to 65, then Medicare; 2026-11-02)
    out: { spending: k(r, r.spending + (r.eventSpending ?? 0)), health: k(r, r.eventSpending ?? 0), taxes: k(r, r.taxes) },
    from: { cash: k(r, r.withdrawn.cash), taxable: k(r, r.withdrawn.taxable), deferred: k(r, r.withdrawn.deferred), free: k(r, r.withdrawn.free) },
    rmd: k(r, r.rmd), returnPct: r.portfolioReturn,
    end: { cash: k(r, r.balances.cash), taxable: k(r, r.balances.taxable), deferred: k(r, r.balances.deferred), free: k(r, r.balances.free), total: k(r, r.total) },
    shortfall: k(r, r.shortfall),
    ...(r.moves ? { moves: r.moves.map((m) => ({ fromName: m.fromName, toName: m.toName, amount: k(r, m.amount), tax: k(r, m.tax), capped: m.capped })) } : {}),
  }));
  const sum = (f) => rows.reduce((s, r) => s + f(r), 0);
  return { ready: true, real, rows, order: [...(pr.inputs.withdrawalOrder ?? [])], ...(pr.inputs.withdrawalSplit ? { split: pr.inputs.withdrawalSplit } : {}), retireYear: pr.inputs.retireYear, people: pr.people, totals: { contributions: sum((r) => r.in.contributions), income: sum((r) => r.in.income), spending: sum((r) => r.out.spending), taxes: sum((r) => r.out.taxes), withdrawn: sum((r) => r.from.cash + r.from.taxable + r.from.deferred + r.from.free) }, verdict: pr.verdict, shortYear: pr.shortYear,
    // nothing saved for retirement and nothing going in: the projection's own "We don't know yet" on this same run (whole-app sweep
    // x3, 2026-11-16: "The money runs out in 2067" beside it); absent for every other plan
    ...(savingsUnknown(pr) ? { unknown: { nothingSaved: nothingSaved(plan) } } : {}) };
}

// ---- a change of one year, made from its row (gap list, next 60, item 32; map A10) ----------------------------------------------
// Each is a thing that will happen (`retirement.happenings`, modules/retirement/happenings.js), one year long, saved by the
// very functions Will the money last? saves with, so every page counts it the same way. Nothing here is in compute()'s output.

/** The four changes a year's row offers, in the order shown. */
export const YEAR_KINDS = Object.freeze(["more", "less", "in", "out"]);
/**
 * yearOffers(row, strategy) -> the kinds that row offers. A change in spending only in a year the household is retired, with
 * a way of taking money out that spends the plan's figure (the same spending every year, trim after bad years): the engine
 * changes spending only then (core/math/retirement.js step 3, `spendingChanges`); money in or out once in any year.
 */
export function yearOffers(row, strategy = "fixed-real") {
  return row?.retired && !drawSets(strategy) ? [...YEAR_KINDS] : ["in", "out"];
}
/**
 * yearChange(kind, year, { id, amount, name }) -> the happening as it is saved (happenings.js clean()), amount in today's dollars:
 *   more  { id, kind: "spend", year, untilYear: year, monthly: amount }     (amount a month)
 *   less  { id, kind: "spend", year, untilYear: year, monthly: -amount }
 *   in    { id, kind: "in", year, name?, amount }                         (money coming in once)
 *   out   { id, kind: "out", year, name?, amount }                        (a big cost once)
 */
export function yearChange(kind, year, { id, amount, name = "" } = {}) {
  const a = amount === null || amount === undefined || amount === "" ? null : Number(amount);
  if (kind === "more" || kind === "less") return clean({ id, kind: "spend", year, untilYear: year, monthly: a === null ? null : kind === "less" ? -a : a });
  if (kind === "in" || kind === "out") return clean({ id, kind, year, name, amount: a });
  throw new Error(`yearChange: unknown kind "${kind}"`);
}
/** Is h a change of one year: money in or out once, or spending changed for its year only? */
export function isYearChange(h) {
  if (!h || typeof h !== "object" || !Number.isInteger(h.year)) return false;
  if (h.kind === "in" || h.kind === "out") return true;
  return h.kind === "spend" && h.untilYear !== null && h.untilYear !== undefined && h.untilYear !== "" && Number(h.untilYear) === h.year;
}
/** yearChanges(plan) -> { [year]: [happening] }: the plan's changes of one year (well formed: happenings.js listOf), in its order. */
export function yearChanges(plan) {
  const out = {};
  for (const h of listOf(plan)) if (isYearChange(h)) (out[h.year] ??= []).push(h);
  return out;
}
/**
 * yearFacts(plan, { today }) -> { strategy, nowYear, endYear, people, retireYear, accounts, spend: { base, steps } } | null: what
 * a change of one year is checked against (happenings.js check(): the projection's first and last year, its people, the plan's
 * accounts), the way of taking money out that decides the spending chips, the year retirement starts (the engine's
 * `retired`: year >= retireYear) and the spending a change in spending moves; from the projection's own buildInputs, so it is
 * what Will the money last? checks with. null: no plan to run.
 * `spend`: the yearly spending, in today's dollars, that happenings.js moves (apply(): S0 = `spending.yearly` less the loan
 * payments it holds) and, from each year it changes, its level with every thing that will happen in the plan counted
 * (spendingFactors: L(Y) = S0 x the product of the factors up to Y, each a level over the one before, at least SPEND_FLOOR).
 */
export function yearFacts(plan, { today = null } = {}) {
  let b = null;
  try { b = buildInputs(plan, { today, happenings: false }); } catch { b = null; }
  const I = b?.inputs;
  if (!I) return null;
  let a = null;
  try { a = applyHappenings(plan, I, { nowYear: I.startYear, today }); } catch { a = null; }
  const base = Math.max(0, (Number(I.spending?.yearly) || 0) - (I.loans ?? []).reduce((t, l) => t + (Number(l?.inBase) || 0), 0));
  // apply() puts the plan's own factors after those the inputs had: only those are a thing that will happen
  const own = (a?.inputs?.spendingChanges ?? []).slice((I.spendingChanges ?? []).length);
  let level = base;
  const steps = own.map((f) => ({ fromYear: f.fromYear, level: (level *= f.factor) }));
  return { strategy: I.strategy ?? "fixed-real", nowYear: I.startYear, endYear: I.endYear, people: I.people ?? [], retireYear: I.retireYear, accounts: plan?.accounts ?? [], spend: { base, steps } };
}
/** spendIn(facts, year) -> that year's spending a change moves, in today's dollars a year, everything the plan holds counted. */
export function spendIn(facts, year) {
  if (!facts?.spend) return 0;
  let L = facts.spend.base;
  for (const s of facts.spend.steps) if (s.fromYear <= year) L = s.level;
  return L;
}
/**
 * lessRoom(facts, year) -> the most "Spend less" takes off a month in that year, whole dollars: floor((L(Y) - SPEND_FLOOR) / 12),
 * so a cut never reaches the floor happenings.js keeps spending above (which would make the saved line say more than it does;
 * critic of item 32, F2). 0: spending cannot go down that year.
 */
export function lessRoom(facts, year) {
  return Math.max(0, Math.floor((spendIn(facts, year) - SPEND_FLOOR) / 12));
}
/** Why a change of one year is not counted, one sentence per case (yearMarks); a refusal by check() says check()'s own words. */
export const NOT_COUNTED = Object.freeze({
  before: "The plan does not count spending before you retire.",
  way: "This is not used with your way of taking money out (How much to take out).",
});
/**
 * yearMarks(plan, facts) -> { [year]: [{ h, counted, why, floored }] }: each change of one year (yearChanges), with whether the
 * engine counts it, so a row never says "changed" for one it skips (critic of item 32, F1):
 *   refused by happenings.js check() (a line typed by hand or imported: an amount under $0, not a number, $0, too large, a year
 *     outside the plan)   counted: false, why: check()'s words, as Will the money last? shows them
 *   a change in spending in a year before retirement (year < retireYear: the engine counts no spending then)   why: NOT_COUNTED.before
 *   a change in spending with a way of taking money out that sets its own spending (drawSets)   why: NOT_COUNTED.way
 *   a cut that takes that year's spending to the floor (L(Y) at SPEND_FLOOR or under)   counted, floored: true
 * facts null (the plan cannot be run): each counted as saved, nothing to check against.
 */
export function yearMarks(plan, facts) {
  const out = {};
  for (const [y, list] of Object.entries(yearChanges(plan))) {
    out[y] = list.map((h) => {
      if (!facts) return { h, counted: true, why: null, floored: false };
      const no = check(h, { nowYear: facts.nowYear, endYear: facts.endYear, people: facts.people, accounts: facts.accounts });
      if (no) return { h, counted: false, why: no.words, floored: false };
      if (h.kind !== "spend") return { h, counted: true, why: null, floored: false };
      if (!(h.year >= facts.retireYear)) return { h, counted: false, why: NOT_COUNTED.before, floored: false };
      if (drawSets(facts.strategy)) return { h, counted: false, why: NOT_COUNTED.way, floored: false };
      return { h, counted: true, why: null, floored: Number(h.monthly) < 0 && spendIn(facts, h.year) <= SPEND_FLOOR + 1e-9 };
    });
  }
  return out;
}
/**
 * removeYearChange(draft, h) -> whether one line went: the first line that is h itself (the same fields), else the first with
 * its id, and only that one (a plan typed by hand can hold two lines with one id: critic of item 32, F3); the field goes when
 * the list is empty, as happenings.js removeHappening.
 */
export function removeYearChange(draft, h) {
  const xs = draft?.retirement?.happenings;
  if (!Array.isArray(xs) || !h) return false;
  const same = JSON.stringify(h);
  let i = xs.findIndex((x) => JSON.stringify(x) === same);
  if (i < 0) i = xs.findIndex((x) => x?.id === h.id);
  if (i < 0) return false;
  const rest = xs.filter((_, k) => k !== i);
  if (rest.length) draft.retirement.happenings = rest; else delete draft.retirement.happenings;
  return true;
}

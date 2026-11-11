// modules/scenarios/compare/compute.js -- PURE and heavy. Your plan and up to four copies of it with a few
// things changed (retire earlier, spend less, save more, claim Social Security later, different returns
// or inflation, a one-off sum, an advisor's fee), each run through the same engine: does the money last,
// the chance it lasts across simulated markets, what it could spend, what it holds at retirement and at
// the end. The changes live in plan.scenarios; the plan itself is never changed.
import { project, affordableSpending, copyInputs } from "../../../core/math/retirement.js";
import { buildInputs } from "../../retirement/projection/compute.js";
import { drawShocks, shapeSequences } from "../../retirement/monte-carlo/compute.js";

export const MAX_SCENARIOS = 4;
export const PATHS = 400;

/** The levers a scenario can change. `person` levers take one value per adult. Plan levers change a copy of the plan; input levers change the engine's inputs. */
export const LEVERS = [
  { key: "retireAge", label: "Retire at age", type: "number", person: true, min: 40, max: 85, get: (p, id) => person(p, id)?.retirementAge ?? p.assumptions?.retirementAge ?? 65, set: (p, v, id) => { const x = person(p, id); if (x) x.retirementAge = v; } },
  { key: "claimAge", label: "Start Social Security at", type: "number", person: true, min: 62, max: 70, get: (p, id) => p.retirement?.socialSecurity?.[id]?.claimAge ?? 67, set: (p, v, id) => { p.retirement = p.retirement ?? {}; p.retirement.socialSecurity = p.retirement.socialSecurity ?? {}; p.retirement.socialSecurity[id] = { ...(p.retirement.socialSecurity[id] ?? {}), claimAge: v }; } },
  // a figure typed in a scenario is a typed figure (review 2026-11-02): no longer Get started's own (retireAuto), so a health
  // premium on Expenses is not taken out of it and health cover goes on top, as when it is typed on Will the money last?
  { key: "spendingMonthly", label: "Spend in retirement, a month", type: "money", get: (p) => p.retirement?.spendingMonthly ?? null, set: (p, v) => { p.retirement = p.retirement ?? {}; p.retirement.spendingMonthly = v; if (p.guide?.setup?.retireAuto === true) { p.guide.setup.retireAuto = false; p.guide.setup.retireHeld = true; } } },   // (retireHeld: it still holds the loans Get started's figure held, fix round 1, 2026-11-11)
  { key: "extraSavingMonthly", label: "Save more each month (until retiring)", type: "money", get: () => 0, set: (p, v) => { const self = (p.household?.people ?? []).find((x) => x.role === "self") ?? (p.household?.people ?? [])[0]; p.retirement = p.retirement ?? {}; p.retirement.contributions = [...(p.retirement.contributions ?? []), { id: "scenario-extra", accountId: "", personId: self?.id ?? "", amount: v, period: "monthly", employerMatch: 0 }]; } },
  { key: "stocksNow", label: "Share in stocks now", type: "percent", get: (p) => p.retirement?.stocksNow ?? 0.7, set: (p, v) => { p.retirement = p.retirement ?? {}; p.retirement.stocksNow = v; } },
  { key: "stocksRetired", label: "Share in stocks in retirement", type: "percent", get: (p) => p.retirement?.stocksRetired ?? 0.5, set: (p, v) => { p.retirement = p.retirement ?? {}; p.retirement.stocksRetired = v; } },
  { key: "returnStocks", label: "Stock return a year", type: "percent", get: (p) => p.assumptions?.returnStocks ?? 0.07, set: (p, v) => { p.assumptions = { ...(p.assumptions ?? {}), returnStocks: v }; } },
  { key: "returnBonds", label: "Bond return a year", type: "percent", get: (p) => p.assumptions?.returnBonds ?? 0.04, set: (p, v) => { p.assumptions = { ...(p.assumptions ?? {}), returnBonds: v }; } },
  { key: "inflation", label: "Inflation a year", type: "percent", get: (p) => p.assumptions?.inflation ?? 0.03, set: (p, v) => { p.assumptions = { ...(p.assumptions ?? {}), inflation: v }; } },
  { key: "fee", label: "Advisor or fund fees a year", type: "percent", input: true, get: () => 0, apply: (I, v) => { I.returns = { ...I.returns, stocks: I.returns.stocks - v, bonds: I.returns.bonds - v }; } },
  { key: "lumpSum", label: "A one-time sum (+ in, − out)", type: "money", input: true, signed: true, get: () => 0, apply: (I, v, ch) => { I.events.push({ year: Number(ch.lumpYear) || I.startYear, amount: -v, label: "one-time" }); } },
  { key: "lumpYear", label: "Year of the one-time sum", type: "number", input: true, min: 1990, max: 2150, get: () => null, apply: () => {} },
];
function person(p, id) { return (p.household?.people ?? []).find((x) => x.id === id); }

/** The changes as stored ({ key or "key:personId": value }) applied to a copy of the plan and to its engine inputs. -> { plan, inputs, missing } */
export function applyChanges(plan, changes = {}, { today } = {}) {
  const p2 = JSON.parse(JSON.stringify(plan));
  const set = (lv, v, id) => { if (v === null || v === undefined || v === "" || !Number.isFinite(Number(v))) return; lv.set?.(p2, Number(v), id); };
  for (const [k, v] of Object.entries(changes)) {
    const [key, id] = k.split(":");
    const lv = LEVERS.find((l) => l.key === key);
    if (lv && !lv.input) set(lv, v, id);
  }
  const b = buildInputs(p2, { today });
  if (!b.inputs) return { plan: p2, inputs: null, missing: b.missing ?? [] };
  const I = copyInputs(b.inputs);
  for (const [k, v] of Object.entries(changes)) {
    const lv = LEVERS.find((l) => l.key === k);
    if (lv?.input && v !== null && v !== "" && Number.isFinite(Number(v)) && Number(v) !== 0) lv.apply(I, Number(v), changes);
  }
  return { plan: p2, inputs: I, missing: [] };
}

/** One run's key figures: does it last, the chance it lasts over simulated markets, what it could spend a month, at retirement, at the end (today's dollars). */
export function results(I, { paths = PATHS, shocks = null } = {}) {
  const r = project(I);
  const atRet = r.rows.find((x) => x.year === I.retireYear) ?? r.rows[0];
  let chance = null;
  if (paths > 0) {
    const years = I.endYear - I.startYear + 1;
    // `shocks`: the one draw of pretend years shared by the plan and its copies (compute below), sliced to this run's length;
    // without it, the same draw made here (seed 1), as before
    const luck = shocks && shocks.length >= paths && (shocks[0]?.length ?? 0) >= years ? shocks.slice(0, paths).map((p) => p.slice(0, years)) : drawShocks(paths, years, 1);
    const seqs = shapeSequences(luck, { stocks: I.returns.stocks, bonds: I.returns.bonds, stdevStocks: I.stdev?.stocks ?? 0.18, stdevBonds: I.stdev?.bonds ?? 0.06 });
    let ok = 0;
    for (const seq of seqs) if (project(I, { sequence: seq }).success) ok++;
    chance = ok / paths;
  }
  return { success: r.success, failYear: r.failYear ?? null, failAge: r.failAge ?? null, retireYear: I.retireYear, atRetirementReal: atRet?.totalReal ?? 0, endReal: r.endBalanceReal, affordableMonthly: affordableSpending(I) / 12, spendingMonthly: I.spending.yearly / 12, chance };
}

/**
 * chanceShown(planChance, copyChance, known) -> { value, text, about }: the chance a column of Compare shows (stress test
 * 2026-11-11, W7: the plan read 78% here and 80% on Chance the money lasts). Compare runs the plan and every copy on one
 * shared set of PATHS pretend futures, so the difference between a copy and the plan is fair; the plan's own figure on that
 * small set can still be a point or two off the Chance page's 2,000. So:
 * - `known` (the Chance page's own figure for this very plan, worked out on this visit): the plan shows it, and a copy shows it
 *   plus the copy's difference from the plan on the shared set (kept between 0 and 1);
 * - otherwise every column says "about" and is rounded to the nearest 5 points.
 * copyChance null = the plan's own column. value is what the "points" difference is taken from.
 */
export function chanceShown(planChance, copyChance = null, known = null) {
  const own = copyChance === null;
  if (planChance === null || planChance === undefined || (!own && (copyChance === null || copyChance === undefined))) return { value: null, text: "-", about: false };
  if (Number.isFinite(known)) {
    const v = own ? known : Math.min(1, Math.max(0, known + (copyChance - planChance)));
    // rounded as the Chance page's fmt.pct rounds (float noise cleared first), so 28.5% reads 29% on both (review of W7)
    const pct = Math.round(Number((v * 100).toPrecision(12)));
    return { value: pct / 100, text: `${pct}%`, about: false };
  }
  // to the nearest 5, but never "about 0%" or "about 100%" for a chance that is neither: those read as "none" or "every future"
  const raw = own ? planChance : copyChance;
  const pct = raw <= 0 ? 0 : raw >= 1 ? 100 : Math.min(95, Math.max(5, Math.round(Number((raw * 20).toPrecision(12))) * 5));
  return { value: pct / 100, text: `about ${pct}%`, about: true };
}

/** The changes in words. */
export function describe(plan, changes = {}) {
  const people = plan.household?.people ?? [];
  const pct = (v) => `${Math.round(Number(v) * 1000) / 10}%`;
  const money = (v) => `$${Math.abs(Math.round(Number(v))).toLocaleString("en-US")}`;
  const out = [];
  for (const [k, v] of Object.entries(changes)) {
    if (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) || k === "lumpYear") continue;
    const [key, id] = k.split(":");
    const who = people.find((x) => x.id === id)?.name ?? "Someone";
    const year = changes.lumpYear ? ` in ${changes.lumpYear}` : " this year";
    const text = {
      retireAge: `${who} retires at ${v}`, claimAge: `${who} starts Social Security at ${v}`, spendingMonthly: `spend ${money(v)} a month in retirement`,
      extraSavingMonthly: `save ${money(v)} more a month`, stocksNow: `${pct(v)} in stocks now`, stocksRetired: `${pct(v)} in stocks in retirement`,
      returnStocks: `stocks earn ${pct(v)} a year`, returnBonds: `bonds earn ${pct(v)} a year`, inflation: `prices rise ${pct(v)} a year`, fee: `fees of ${pct(v)} a year`,
      lumpSum: Number(v) >= 0 ? `${money(v)} arrives${year}` : `${money(v)} is spent${year}`,
    }[key];
    if (text && !(key === "fee" && Number(v) === 0) && !(key === "lumpSum" && Number(v) === 0)) out.push(text);
  }
  return out;
}

/**
 * compute(plan, { today, paths }) -> {
 *   ready, missing, base: results, scenarios: [{ id, name, changes, described: [text], results, missing }],
 *   current: { [lever key or key:personId]: the plan's own value }, adults: [{ id, name }]
 * }
 * current.spendingMonthly, while the plan's figure is Get started's own (retireAuto), is what the plan spends before health
 * cover (Get started's figure from today's bills, less a health premium among them): the figure a typed scenario is set against.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const paths = params.paths ?? PATHS;
  const b = buildInputs(plan, { today });
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent").map((p) => ({ id: p.id, name: p.name }));
  const current = {};
  for (const lv of LEVERS) if (lv.person) for (const a of adults) current[`${lv.key}:${a.id}`] = lv.get(plan, a.id); else current[lv.key] = lv.get(plan);
  if (!b.inputs) return { ready: false, missing: b.missing ?? [], scenarios: [], current, adults };
  if (b.health?.fromSetup) current.spendingMonthly = Math.round(b.spendingYearly / 12);
  // one draw of pretend years for the plan and every copy (same seed, same count; W7), as long as the longest of them
  const copies = (plan.scenarios ?? []).slice(0, MAX_SCENARIOS).map((s) => ({ s, a: applyChanges(plan, s.changes ?? {}, { today }) }));
  const years = Math.max(b.inputs.endYear - b.inputs.startYear + 1, ...copies.map(({ a }) => (a.inputs ? a.inputs.endYear - a.inputs.startYear + 1 : 0)));
  const shocks = paths > 0 ? drawShocks(paths, years, 1) : null;
  const base = results(b.inputs, { paths, shocks });
  const scenarios = copies.map(({ s, a }) => ({ id: s.id, name: s.name || "A scenario", changes: s.changes ?? {}, described: describe(plan, s.changes ?? {}), results: a.inputs ? results(a.inputs, { paths, shocks }) : null, missing: a.missing }));
  return { ready: true, missing: [], base, scenarios, current, adults };
}

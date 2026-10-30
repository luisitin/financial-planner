// modules/scenarios/compare/compute.js -- PURE and heavy. Your plan and up to four copies of it with a few
// things changed (retire earlier, spend less, save more, claim Social Security later, different returns
// or inflation, a one-off sum, an adviser's fee), each run through the same engine: does the money last,
// the chance it lasts across simulated markets, what it could spend, what it holds at retirement and at
// the end. The changes live in plan.scenarios; the plan itself is never changed.
import { project, affordableSpending, copyInputs } from "../../../core/math/retirement.js";
import { buildInputs } from "../../retirement/projection/compute.js";
import { drawSequences } from "../../retirement/monte-carlo/compute.js";

export const MAX_SCENARIOS = 4;
export const PATHS = 400;

/** The levers a scenario can change. `person` levers take one value per adult. Plan levers change a copy of the plan; input levers change the engine's inputs. */
export const LEVERS = [
  { key: "retireAge", label: "Retire at age", type: "number", person: true, min: 40, max: 85, get: (p, id) => person(p, id)?.retirementAge ?? p.assumptions?.retirementAge ?? 65, set: (p, v, id) => { const x = person(p, id); if (x) x.retirementAge = v; } },
  { key: "claimAge", label: "Start Social Security at", type: "number", person: true, min: 62, max: 70, get: (p, id) => p.retirement?.socialSecurity?.[id]?.claimAge ?? 67, set: (p, v, id) => { p.retirement = p.retirement ?? {}; p.retirement.socialSecurity = p.retirement.socialSecurity ?? {}; p.retirement.socialSecurity[id] = { ...(p.retirement.socialSecurity[id] ?? {}), claimAge: v }; } },
  { key: "spendingMonthly", label: "Spend in retirement, a month", type: "money", get: (p) => p.retirement?.spendingMonthly ?? null, set: (p, v) => { p.retirement = p.retirement ?? {}; p.retirement.spendingMonthly = v; } },
  { key: "extraSavingMonthly", label: "Save more each month (until retiring)", type: "money", get: () => 0, set: (p, v) => { const self = (p.household?.people ?? []).find((x) => x.role === "self") ?? (p.household?.people ?? [])[0]; p.retirement = p.retirement ?? {}; p.retirement.contributions = [...(p.retirement.contributions ?? []), { id: "scenario-extra", accountId: "", personId: self?.id ?? "", amount: v, period: "monthly", employerMatch: 0 }]; } },
  { key: "stocksNow", label: "Share in stocks now", type: "percent", get: (p) => p.retirement?.stocksNow ?? 0.7, set: (p, v) => { p.retirement = p.retirement ?? {}; p.retirement.stocksNow = v; } },
  { key: "stocksRetired", label: "Share in stocks in retirement", type: "percent", get: (p) => p.retirement?.stocksRetired ?? 0.5, set: (p, v) => { p.retirement = p.retirement ?? {}; p.retirement.stocksRetired = v; } },
  { key: "returnStocks", label: "Stock return a year", type: "percent", get: (p) => p.assumptions?.returnStocks ?? 0.07, set: (p, v) => { p.assumptions = { ...(p.assumptions ?? {}), returnStocks: v }; } },
  { key: "returnBonds", label: "Bond return a year", type: "percent", get: (p) => p.assumptions?.returnBonds ?? 0.04, set: (p, v) => { p.assumptions = { ...(p.assumptions ?? {}), returnBonds: v }; } },
  { key: "inflation", label: "Inflation a year", type: "percent", get: (p) => p.assumptions?.inflation ?? 0.03, set: (p, v) => { p.assumptions = { ...(p.assumptions ?? {}), inflation: v }; } },
  { key: "fee", label: "Adviser or fund fees a year", type: "percent", input: true, get: () => 0, apply: (I, v) => { I.returns = { ...I.returns, stocks: I.returns.stocks - v, bonds: I.returns.bonds - v }; } },
  { key: "lumpSum", label: "A one-off sum (+ in, − out)", type: "money", input: true, signed: true, get: () => 0, apply: (I, v, ch) => { I.events.push({ year: Number(ch.lumpYear) || I.startYear, amount: -v, label: "one-off" }); } },
  { key: "lumpYear", label: "Year of the one-off", type: "number", input: true, min: 1990, max: 2150, get: () => null, apply: () => {} },
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
export function results(I, { paths = PATHS } = {}) {
  const r = project(I);
  const atRet = r.rows.find((x) => x.year === I.retireYear) ?? r.rows[0];
  let chance = null;
  if (paths > 0) {
    const years = I.endYear - I.startYear + 1;
    const seqs = drawSequences(paths, years, { stocks: I.returns.stocks, bonds: I.returns.bonds, stdevStocks: I.stdev?.stocks ?? 0.18, stdevBonds: I.stdev?.bonds ?? 0.06, seed: 1 });
    let ok = 0;
    for (const seq of seqs) if (project(I, { sequence: seq }).success) ok++;
    chance = ok / paths;
  }
  return { success: r.success, failYear: r.failYear ?? null, failAge: r.failAge ?? null, retireYear: I.retireYear, atRetirementReal: atRet?.totalReal ?? 0, endReal: r.endBalanceReal, affordableMonthly: affordableSpending(I) / 12, spendingMonthly: I.spending.yearly / 12, chance };
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
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const paths = params.paths ?? PATHS;
  const b = buildInputs(plan, { today });
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent").map((p) => ({ id: p.id, name: p.name }));
  const current = {};
  for (const lv of LEVERS) if (lv.person) for (const a of adults) current[`${lv.key}:${a.id}`] = lv.get(plan, a.id); else current[lv.key] = lv.get(plan);
  if (!b.inputs) return { ready: false, missing: b.missing ?? [], scenarios: [], current, adults };
  const base = results(b.inputs, { paths });
  const scenarios = (plan.scenarios ?? []).slice(0, MAX_SCENARIOS).map((s) => {
    const a = applyChanges(plan, s.changes ?? {}, { today });
    return { id: s.id, name: s.name || "A scenario", changes: s.changes ?? {}, described: describe(plan, s.changes ?? {}), results: a.inputs ? results(a.inputs, { paths }) : null, missing: a.missing };
  });
  return { ready: true, missing: [], base, scenarios, current, adults };
}

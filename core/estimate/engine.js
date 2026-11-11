// core/estimate/engine.js -- PURE. Runs estimators and keeps untouched guesses fresh (docs/CONVENTIONS.md "Guesses").
// It holds no data and imports no module: estimators (pure functions in any module's compute.js, merged by core/app.js
// from every loaded manifest) and the table registry (`guessTables`, merged the same way) are passed in.
//
//   applies(plan)                                   U.S. figures apply: currency USD and not "I live outside the U.S."
//   estimate(plan, key, { estimators, tables, today, path?, rec?, args?, memo? })   one Estimate, or null
//   settle(draft, { estimators, tables, today })    refresh untouched guesses inside a change (core/store.js update)
//   rangeOf(fn, plan, moves)                        a verdict's range when guessed inputs move to their middle-half ends
//   mergeEstimators(registries)                     { estimators, tables, weights, problems } from [{ from, estimators, tables }]
//   checkEstimators(estimators | [registry...])     the contract, as a list of problems (tests and tools/check.mjs)
import { getAt, setAt } from "./paths.js";
import { same, isEntry, LEGACY, orphanDebt } from "./ledger.js";
import { roundGuess, middleHalf } from "../math/estimate.js";

export const UNITS = ["month", "year", "total", "rate", "age", "year-date", "list"];
export const WEIGHTS = ["big", "small"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * U.S. figures apply: the currency is USD (absent counts as emptyPlan's "USD"), no bank file brought in was in another
 * currency (its import record keeps the file's currency column: transactions/import importRecord), and the person did not
 * say they live outside the U.S.
 */
export function applies(plan) {
  const cur = plan?.meta?.currency;
  if (cur && cur !== "USD") return false;
  if (Array.isArray(plan?.imports) && plan.imports.some((im) => typeof im?.currency === "string" && im.currency !== "" && im.currency !== "USD")) return false;
  return plan?.guide?.setup?.outsideUS !== true;
}

const earlier = (a, b) => a.tier < b.tier || (a.tier === b.tier && a.order < b.order);
/** The estimator a key names, own keys only: a ledger key such as "constructor" names no estimator. */
const defOf = (estimators, key) => (estimators && typeof key === "string" && Object.prototype.hasOwnProperty.call(estimators, key) ? estimators[key] : undefined);
const finiteValue = (v, unit) => (unit === "list" ? Array.isArray(v) && v.every((x) => typeof x === "string") : typeof v === "number" && Number.isFinite(v));

/**
 * One estimate. estimators: the merged registry; tables: the merged table registry ({ [id]: { readOn, ... } }).
 * opts: { today, path?, rec?, args?, memo? } -- args = what is on the screen and not saved yet (so the grey preview
 * equals what saving the blank box writes); memo = a Map shared by one pass (lib.memo).
 * Returns null unless applies(plan) and the estimator returns a finite value (a list of ids for unit "list") with
 * tables (each a known id; at least one unless basis is "yours", a figure worked out from the plan's own answers),
 * dataAsOf (given, or the newest readOn of its tables) and why. Rounds with roundGuess unless the result says rounded.
 * An estimator still waiting on a tap returns { value: null, ask }; that comes back as { key, value: null, ask } (5.8).
 * An estimator that throws throws here too (settle's caller keeps the person's change).
 */
export function estimate(plan, key, { estimators, tables, today, path, rec, args, memo } = {}) {
  if (!applies(plan)) return null;
  const def = defOf(estimators, key);
  if (!def || typeof def.fn !== "function") return null;
  const pass = memo instanceof Map ? memo : new Map();
  const lib = {
    today,
    applies: () => applies(plan),
    memo: (name, make) => { if (!pass.has(name)) pass.set(name, make()); return pass.get(name); },
    // earlier keys only (tier, then order): a guess never reads one that is worked out after it
    estimate: (k2, o2 = {}) => { const d2 = defOf(estimators, k2); return d2 && earlier(d2, def) ? estimate(plan, k2, { estimators, tables, today, memo: pass, ...o2 }) : null; },
  };
  const r = def.fn(plan, { today, path, rec, args }, lib);
  if (!r || typeof r !== "object") return null;
  const unit = r.unit ?? def.unit;
  if ((r.value === null || r.value === undefined) && r.ask) return { key, value: null, unit, ask: r.ask };
  if (!finiteValue(r.value, unit)) return null;
  const ids = Array.isArray(r.tables) ? r.tables : null;
  const known = tables ?? {};
  if (!ids || ids.some((id) => !known[id])) return null;
  const basis = r.basis ?? def.basis ?? "population";
  if (basis !== "yours" && !ids.length) return null;
  const dataAsOf = r.dataAsOf ?? ids.map((id) => known[id].readOn).filter(Boolean).sort().pop() ?? null;
  if (!dataAsOf || !ISO.test(dataAsOf)) return null;
  if (typeof r.why !== "string" || !r.why.trim()) return null;
  const sigma = typeof r.sigma === "number" && Number.isFinite(r.sigma) ? r.sigma : null;
  const measured = !!r.measured && sigma !== null;
  const round = (v) => (r.rounded || unit === "list" ? v : roundGuess(v, unit, sigma, measured));
  let low = null, high = null;
  if (measured && unit !== "list") {
    const [lo, hi] = Array.isArray(r.range) ? r.range : middleHalf(r.value, sigma);
    low = round(lo); high = round(hi);
  }
  return {
    key, value: round(r.value), unit, sigma, measured, low, high,
    why: r.why.trim(), uses: r.uses ?? {}, sharperWith: Array.isArray(r.sharperWith) ? r.sharperWith.slice(0, 2) : [],
    tables: ids, dataAsOf, weight: def.weight ?? "small", basis,
    ...(r.ask ? { ask: r.ask } : {}),
  };
}

const mirror = (draft, path, value) => { for (const a of LEGACY) if (a.owns(path)) a.mirror(draft, path, value); };

/**
 * Refresh untouched guesses inside a draft (core/store.js calls it in update(), after the page's change). Never creates
 * an entry; never writes a field whose value differs from its entry's v (that one was typed: the entry goes); a figure
 * that comes back the same from a source of another spread only refreshes the entry's s (the field is untouched); legacy
 * flags are not in the ledger and are never re-estimated; an entry that is not { k, v, ... } with v a number or a list (an
 * import or a hand edit) is dropped first, so one bad entry never stops the rest, and a ledger that is not an object at all
 * goes the same way (dropped: [{ path: "guesses", why: "bad" }]); a debt row's entry whose loan account is gone goes as "gone"
 * (orphanDebt). Returns { changed: [{ path, k, from, to }], dropped: [{ path, k,
 * why: "typed" | "gone" | "bad" }] } and leaves the same draft object, changed in place.
 */
export function settle(draft, { estimators = {}, tables = {}, today } = {}) {
  const led = draft?.guesses;
  const changed = [], dropped = [];
  if (led === undefined || led === null) return { changed, dropped };                              // every plan without guesses: one look
  if (typeof led !== "object" || Array.isArray(led)) { delete draft.guesses; dropped.push({ path: "guesses", k: null, why: "bad" }); return { changed, dropped }; }
  if (!Object.keys(led).length) return { changed, dropped };
  for (const [path, e] of Object.entries(led)) if (!isEntry(e)) { delete led[path]; dropped.push({ path, k: null, why: "bad" }); }
  const tierOf = (e) => defOf(estimators, e.k)?.tier ?? 5;                                          // 5: an estimator no module has any more (frozen)
  const orderOf = (e) => defOf(estimators, e.k)?.order ?? 0;
  for (const tier of [1, 2, 3, 4, 5]) {
    const memo = new Map();                                                                          // the profile is rebuilt after each tier
    const here = Object.entries(led).filter(([, e]) => tierOf(e) === tier)
      .sort(([pa, a], [pb, b]) => orderOf(a) - orderOf(b) || (pa < pb ? -1 : pa > pb ? 1 : 0));
    for (const [path, e] of here) {
      let cur;
      try { cur = getAt(draft, path); } catch { cur = undefined; }
      if (cur === undefined || orphanDebt(draft, path)) { delete led[path]; mirror(draft, path, undefined); dropped.push({ path, k: e.k, why: "gone" }); continue; }
      if (!same(cur, e.v, e.u)) { delete led[path]; mirror(draft, path, undefined); dropped.push({ path, k: e.k, why: "typed" }); continue; }
      if (!defOf(estimators, e.k)) continue;                                                         // S6: stays frozen, still labelled
      const est = estimate(draft, e.k, { estimators, tables, today, path, memo });
      if (!est || est.value === null) continue;                                                      // the gate closed or an input went: frozen
      if (e.d && est.dataAsOf < e.d) continue;                                                       // S7: never put older figures back
      // the same figure from a source of another spread (a spending row now read from the bank files, sigma 0.15, where the
      // survey's 0.25 gave the same rounded figure; C7 review M9): the entry says where it comes from, the field is untouched
      if (same(est.value, e.v, e.u)) { if ((est.sigma ?? null) !== (e.s ?? null)) led[path] = { ...e, s: est.sigma ?? null }; continue; }
      if (!setAt(draft, path, est.value)) continue;
      led[path] = { ...e, v: est.value, s: est.sigma ?? null, at: today, d: est.dataAsOf };
      mirror(draft, path, est.value);
      changed.push({ path, k: e.k, from: e.v, to: est.value });
    }
  }
  if (!Object.keys(led).length) delete draft.guesses;
  return { changed, dropped };
}

/**
 * A verdict's range when guessed inputs move to their middle-half ends. moves: [{ paths: [path...], factorLow,
 * factorHigh }] (guessed spending rows move together as one group). fn(plan) -> number. Works on copies; never settles.
 * -> { low, mid, high, decisive: the index of the move with the largest swing (or null) }
 */
export function rangeOf(fn, plan, moves = []) {
  const moved = (which, only = null) => {
    const copy = structuredClone(plan);
    moves.forEach((m, i) => {
      if (only !== null && i !== only) return;
      for (const p of m.paths ?? []) { const v = getAt(copy, p); if (typeof v === "number") setAt(copy, p, v * (which === "low" ? m.factorLow : m.factorHigh)); }
    });
    return fn(copy);
  };
  const mid = fn(structuredClone(plan));
  const a = moved("low"), b = moved("high");
  let decisive = null, swing = -1;
  moves.forEach((_, i) => { const s = Math.abs(moved("high", i) - moved("low", i)); if (s > swing) { swing = s; decisive = i; } });
  return { low: Math.min(a, b, mid), mid, high: Math.max(a, b, mid), decisive };
}

/**
 * Merge every module's estimators and tables. registries: [{ from: "group/id", estimators?, tables? }].
 * A key or table id defined twice keeps the first and is reported.
 */
export function mergeEstimators(registries = []) {
  const estimators = {}, tables = {}, weights = {}, problems = [], owner = {};
  for (const r of registries) {
    for (const [k, e] of Object.entries(r?.estimators ?? {})) {
      if (estimators[k]) { problems.push(`estimator ${k} is defined twice (${owner[k]} and ${r.from})`); continue; }
      estimators[k] = e; owner[k] = r.from; weights[k] = e?.weight ?? "small";
    }
    for (const [id, t] of Object.entries(r?.tables ?? {})) {
      if (tables[id] && tables[id] !== t) { problems.push(`guess table ${id} is defined twice (${r.from})`); continue; }
      tables[id] = t;
    }
  }
  return { estimators, tables, weights, problems };
}

/**
 * The estimator contract, as a list of problems: every estimator has tier (1-4), order, label, unit, weight and fn;
 * `reads` names only keys that exist and come earlier (tier, then order); no key is defined twice (pass an array of
 * registries to check that across modules).
 */
export function checkEstimators(input) {
  const problems = [];
  const list = Array.isArray(input) ? input : [input ?? {}];
  const all = {};
  for (const reg of list) {
    const ests = reg?.estimators && typeof reg.estimators === "object" && !reg.fn ? reg.estimators : reg;
    for (const [k, e] of Object.entries(ests ?? {})) {
      if (all[k]) { problems.push(`${k}: defined twice`); continue; }
      all[k] = e;
    }
  }
  for (const [k, e] of Object.entries(all)) {
    if (!e || typeof e !== "object") { problems.push(`${k}: not an estimator`); continue; }
    if (![1, 2, 3, 4].includes(e.tier)) problems.push(`${k}: tier must be 1, 2, 3 or 4`);
    if (typeof e.order !== "number" || !Number.isFinite(e.order)) problems.push(`${k}: order must be a number`);
    if (typeof e.label !== "string" || !e.label.trim()) problems.push(`${k}: missing label`);
    if (!UNITS.includes(e.unit)) problems.push(`${k}: unit must be one of ${UNITS.join(", ")}`);
    if (!WEIGHTS.includes(e.weight)) problems.push(`${k}: weight must be "big" or "small"`);
    if (typeof e.fn !== "function") problems.push(`${k}: fn must be a function`);
    if (e.basis !== undefined && !["population", "yours"].includes(e.basis)) problems.push(`${k}: basis must be "population" or "yours"`);
    for (const r of Array.isArray(e.reads) ? e.reads : []) {
      const d = all[r];
      if (!d) problems.push(`${k}: reads ${r}, which no module defines`);
      else if (!earlier(d, e)) problems.push(`${k}: reads ${r}, which is not earlier (tier ${d.tier}, order ${d.order})`);
    }
    if (e.reads !== undefined && !Array.isArray(e.reads)) problems.push(`${k}: reads must be a list`);
  }
  return problems;
}

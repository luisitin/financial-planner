// tests/guesses-invariance.test.mjs -- the guess plumbing changes nothing a person sees in a plan that has no ledger
// (every plan today): for every qa/fixtures/*-plan.mjs and every household in qa/households (the 14 types with every
// variation of their packs), settle returns no change and the JSON is identical, migrate() adds no `guesses`, and the
// store with the hook registered keeps exactly the plan the store without it keeps (nothing new is written on load or
// save). Every module's compute is then compared on the plans from both stores. The older Get started flags
// (qa/fixtures/guessed-plan.mjs) are frozen: settle moves none of them.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { settle, mergeEstimators, guessesInUse } from "../core/estimate/index.js";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { estimators as guessEstimators, TABLES } from "../modules/overview/guesses/compute.js";
import { estimators as setupEstimators } from "../modules/overview/setup/compute.js";
import { ARCHETYPES, COMMON_PACKS, SPECIAL_PACKS } from "../qa/households/lib/catalog.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const T = "2026-11-02";
const REG = mergeEstimators([{ from: "overview/guesses", estimators: guessEstimators, tables: TABLES }, { from: "overview/setup", estimators: setupEstimators }]);
const OPTS = { estimators: REG.estimators, tables: REG.tables, today: T };

// every plan builder (an exported function named ...Plan) in qa/fixtures/*-plan.mjs, called with its defaults, plus the
// variations card-gap-plan.mjs builds from its plan with helpers that take a plan (they are not builders themselves)
const VARIANTS = {
  "card-gap-plan.mjs": (m) => [
    ["cardGapPlan, no 90-day file", m.cardGapPlan(undefined, { withFile: false })],
    ["withVisaFile late start", m.withVisaFile(m.cardGapPlan(), "2026-08-20", "2026-10-31")],
    ["withVisaFile early stop", m.withVisaFile(m.cardGapPlan(), "2026-08-20", "2026-09-19")],
    ["noCardFromAug", m.noCardFromAug(m.cardGapPlan())],
    ["oneFileAMonth", m.oneFileAMonth(m.cardGapPlan(), "a-chk")],
  ],
};
async function fixtures() {
  const dir = path.join(ROOT, "qa", "fixtures");
  const out = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) out.push({ name: `fixture ${f}:${name}`, plan: fn() });
    for (const [name, plan] of VARIANTS[f]?.(m) ?? []) out.push({ name: `fixture ${f}:${name}`, plan });
  }
  return out;
}
function households() {
  const out = [];
  for (const a of ARCHETYPES) {
    out.push({ name: `${a.id}/base`, plan: a.build() });
    for (const [pack, vs] of Object.entries({ ...COMMON_PACKS, special: SPECIAL_PACKS[a.id] ?? [] })) {
      for (const v of vs) { const plan = structuredClone(a.build()); v.apply(plan); out.push({ name: `${a.id}/${pack}/${v.slug}`, plan }); }
    }
  }
  return out;
}
const FIX = await fixtures();
const ALL = [...FIX, ...households(), { name: "empty plan", plan: emptyPlan() }];
// the save's own stamps (and migrate's createdAt for a plan that had none) differ between any two saves; nothing else may
const strip = (p) => { const q = structuredClone(p); if (q.meta) { delete q.meta.updatedAt; delete q.meta.rev; delete q.meta.createdAt; } return q; };

test(`settle changes nothing and migrate adds no guesses: ${ALL.length} plans`, () => {
  assert.ok(FIX.length >= 14 && ALL.length > 500, `${FIX.length} fixtures, ${ALL.length} plans in all`);
  assert.ok(FIX.every(({ plan }) => plan && typeof plan === "object" && plan.meta && Array.isArray(plan.accounts)), "every fixture entry is a plan");
  for (const { name, plan } of ALL) {
    assert.equal("guesses" in plan, false, `${name}: no plan has a ledger today`);
    const m = migrate(structuredClone(plan));
    assert.equal("guesses" in m, false, `${name}: migrate adds no guesses`);
    const json = JSON.stringify(m);
    assert.deepEqual(settle(m, OPTS), { changed: [], dropped: [] }, name);
    assert.equal(JSON.stringify(m), json, `${name}: identical after settle`);
  }
});

test("the older Get started guesses are frozen: settle with every estimator moves none of them", () => {
  const p = FIX.find((f) => f.name.includes("guessed-plan")).plan;
  assert.equal(guessesInUse(p).length, 9, "two rates, two payments, two Social Security figures, retirement spending, the cushion and its accounts");
  const q = structuredClone(p);
  q.household.state = "AZ";                                     // an answer the new mortgage guess would follow
  const json = JSON.stringify(q);
  assert.deepEqual(settle(q, OPTS), { changed: [], dropped: [] });
  assert.equal(JSON.stringify(q), json);
});

// ---- the store, with and without the hook: what it keeps after a change (and in this browser's copy) is the same
function storage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }
globalThis.location = { search: "", protocol: "file:", origin: "null" };    // no PC: this device only
globalThis.Event = class { constructor(type) { this.type = type; } };
globalThis.addEventListener = () => {};
globalThis.dispatchEvent = () => true;
let n = 0;
async function device(hook) {
  const ls = storage(), tab = storage();
  globalThis.localStorage = ls; globalThis.sessionStorage = tab;
  const { store } = await import(`../core/store.js?inv=${++n}`);
  if (hook) store.settleWith((d) => settle(d, OPTS));
  await store.load();
  return { store, ls, use: () => { globalThis.localStorage = ls; globalThis.sessionStorage = tab; } };
}
const kept = new Map();                                         // name -> [plan without hook, plan with hook]

test("the store keeps the same plan with and without the hook, and writes no guesses on load or save", async () => {
  const off = await device(false), on = await device(true);
  for (const { name, plan } of ALL) {
    const run = (d) => {
      d.use();
      d.store.replace(structuredClone(plan));
      d.store.update((draft) => { draft.notes = draft.notes ?? ""; });   // a save that changes nothing else
      return structuredClone(d.store.get());
    };
    const a = run(off), b = run(on);
    assert.deepEqual(strip(b), strip(a), name);
    assert.equal(on.store.takeSettled()?.changed.length ?? 0, 0, name);
    on.use();
    assert.equal("guesses" in JSON.parse(on.ls.getItem("planner.plan")), false, `${name}: nothing new written to the device`);
    if (FIX.some((f) => f.name === name) || name.endsWith("/base")) kept.set(name, [a, b]);
  }
  for (const d of [off, on]) { d.use(); d.store.eraseDevice(); }
});

test("every module's compute is the same on the plans kept with and without the hook (fixtures and the 14 households)", async () => {
  const mods = [];
  for (const g of fs.readdirSync(path.join(ROOT, "modules"), { withFileTypes: true })) {
    if (!g.isDirectory() || g.name.startsWith("_")) continue;
    for (const m of fs.readdirSync(path.join(ROOT, "modules", g.name), { withFileTypes: true })) {
      const f = path.join(ROOT, "modules", g.name, m.name, "compute.js");
      if (m.isDirectory() && fs.existsSync(f)) mods.push([`${g.name}/${m.name}`, (await import(pathToFileURL(f).href)).compute]);
    }
  }
  assert.ok(mods.length >= 150, `${mods.length} modules`);
  assert.ok(kept.size >= 22, `${kept.size} plans`);
  let compared = 0;
  for (const [name, [a, b]] of kept) {
    b.meta = { ...b.meta, updatedAt: a.meta?.updatedAt, rev: a.meta?.rev, createdAt: a.meta?.createdAt };   // the save stamps differ; nothing else may
    for (const [key, compute] of mods) {
      let x, y;
      try { x = JSON.stringify(compute(structuredClone(a), {})); } catch (e) { x = `throws ${e.message}`; }
      try { y = JSON.stringify(compute(structuredClone(b), {})); } catch (e) { y = `throws ${e.message}`; }
      assert.equal(y, x, `${name}: ${key}`);
      compared++;
    }
  }
  assert.ok(compared >= 150 * 22);
});

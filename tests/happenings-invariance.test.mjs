// tests/happenings-invariance.test.mjs -- "Things that will happen" (gap design #1: `retirement.happenings`, `retirement.countGoals`,
// modules/retirement/happenings.js) changes no figure until a person sets one. For every qa/fixtures/*-plan.mjs plan, the 14
// households' base plans, the phone-built ones and the empty plan: no plan has the fields and migrate adds none; the projection's
// buildInputs hands back exactly what it did before the feature (the run with `happenings: false` is the old code path, and
// with nothing set apply() returns the very same inputs object); and every module's compute that can reach the projection gives the same output
// with an empty list and a "no" for the goals as with the fields absent, over the 14 households and four fixture plans (pattern of tests/leftover-invariance.test.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";
import * as phone from "../qa/fixtures/phone-households.mjs";
import { buildInputs, compute as projection } from "../modules/retirement/projection/compute.js";
import { apply, listOf, effects } from "../modules/retirement/happenings.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const T = "2026-11-13";
async function plans() {
  const out = [];
  const dir = path.join(ROOT, "qa", "fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) out.push({ name: `fixture ${f}:${name}`, plan: fn() });
  }
  for (const a of ARCHETYPES) out.push({ name: `${a.id}/base`, plan: a.build() });
  for (const [name, fn] of Object.entries(phone)) out.push({ name: `phone ${name}`, plan: fn() });
  out.push({ name: "empty plan", plan: emptyPlan() });
  return out;
}
const ALL = await plans();
async function modules() {
  const mods = [];
  for (const g of fs.readdirSync(path.join(ROOT, "modules"), { withFileTypes: true })) {
    if (!g.isDirectory() || g.name.startsWith("_")) continue;
    for (const m of fs.readdirSync(path.join(ROOT, "modules", g.name), { withFileTypes: true })) {
      const f = path.join(ROOT, "modules", g.name, m.name, "compute.js");
      if (m.isDirectory() && fs.existsSync(f)) mods.push([`${g.name}/${m.name}`, (await import(pathToFileURL(f).href)).compute]);
    }
  }
  return mods;
}
// System > Diagnostics and Settings measure the saved plan's size: any field added changes it, by design
const SIZE_ONLY = new Set(["system/diagnostics", "system/settings"]);
const out = (compute, plan) => { try { return JSON.stringify(compute(structuredClone(plan), { today: T })); } catch (e) { return `throws ${e.message}`; } };

test(`no plan has things that will happen today, and migrate adds none: ${ALL.length} plans`, () => {
  assert.ok(ALL.length >= 30, `${ALL.length} plans`);
  for (const { name, plan } of ALL) {
    for (const p of [plan, migrate(structuredClone(plan))]) {
      assert.equal(p.retirement?.happenings, undefined, `${name}: none`);
      assert.equal(p.retirement?.countGoals, undefined, `${name}: none`);
      assert.deepEqual(listOf(p), []);
    }
  }
});

test("with nothing set, the projection's inputs and answer are what they were: the same object, byte for byte", () => {
  let ran = 0;
  for (const { name, plan } of ALL) {
    const a = migrate(structuredClone(plan));
    const old = buildInputs(a, { today: T, happenings: false }), now = buildInputs(a, { today: T });
    assert.equal(JSON.stringify(now), JSON.stringify(old), `${name}: buildInputs`);
    assert.equal("happenings" in now, false, `${name}: nothing new is returned`);
    if (!old.inputs) continue;
    const r = apply(a, old.inputs, { nowYear: old.inputs.startYear, today: T });
    assert.equal(r.inputs, old.inputs, `${name}: the very same inputs object`);
    assert.equal(r.changed, false);
    // the page's own sum of effects: nothing to list, and its answer is the projection's
    const fx = effects(a, (p, params) => buildInputs(p, { today: T, ...params }).inputs ?? null, { today: T });
    assert.deepEqual(fx.items, []); assert.equal(fx.goals, null);
    assert.equal(fx.answer.lasts, projection(a, { today: T }).result.success, `${name}: the same answer`);
    assert.deepEqual(fx.answer, fx.without, `${name}: with none is the answer`);
    ran++;
  }
  assert.ok(ran >= 20, `${ran} plans that run`);
});

// the modules whose compute can reach the fields at all: those whose compute.js imports, directly or through other files, the
// projection's compute.js (the one reader of modules/retirement/happenings.js). Worked out from the files, so a new reader is
// picked up by itself.
function reaches(file, target, seen = new Map()) {
  if (file === target) return true;
  if (seen.has(file)) return seen.get(file);
  seen.set(file, false);   // a cycle back to here adds nothing
  let src = "";
  try { src = fs.readFileSync(file, "utf8"); } catch { return false; }
  const hit = [...src.matchAll(/(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g)].some((m) => reaches(path.resolve(path.dirname(file), m[1]), target, seen));
  seen.set(file, hit);
  return hit;
}

test("every module's compute that can reach the projection is the same with an empty list and a 'no' for the goals as with the fields absent", async () => {
  const target = path.join(ROOT, "modules", "retirement", "projection", "compute.js");
  const seen = new Map();
  const mods = (await modules()).filter(([key]) => !SIZE_ONLY.has(key) && reaches(path.join(ROOT, "modules", key, "compute.js"), target, seen));
  assert.ok(mods.some(([k]) => k === "retirement/monte-carlo") && mods.some(([k]) => k === "overview/timeline") && mods.some(([k]) => k === "scenarios/goal-seek"), "the pages that start from buildInputs are among them");
  assert.ok(mods.length >= 40, `${mods.length} modules reach the projection`);
  // every plan: the one way in (buildInputs) reads an empty list and a "no" as nothing set
  const withEmpty = (plan) => { const b = structuredClone(plan); b.retirement = { ...(b.retirement ?? {}), happenings: [], countGoals: false }; return b; };
  for (const { name, plan } of ALL) {
    const a = migrate(structuredClone(plan));
    assert.equal(JSON.stringify(buildInputs(withEmpty(a), { today: T })), JSON.stringify(buildInputs(a, { today: T })), `${name}: buildInputs`);
    assert.equal(out(projection, withEmpty(a)), out(projection, a), `${name}: retirement/projection`);
  }
  // the four fixture plans the pages are judged on (the family, the renter with debts, the retired couple, the sample couple):
  // every one of those modules, whole (the sweep over every household as well took two minutes of each test run for a field
  // only buildInputs reads; the households are covered by the lines above)
  const four = ALL.filter(({ name }) => /fixture (family|renter-debt|retired-couple|retirement)-plan/.test(name));
  assert.ok(four.length >= 4, `${four.length} plans`);
  let compared = 0;
  for (const { name, plan } of four) {
    const a = migrate(structuredClone(plan)), b = withEmpty(a);
    for (const [key, compute] of mods) { assert.equal(out(compute, b), out(compute, a), `${name}: ${key}`); compared++; }
  }
  assert.ok(compared >= 40 * 4, `${compared} comparisons`);
});

test("happenings.js reads leaves only: none of its imports leads back to the projection that reads it at load", () => {
  // the browser loads pages in any order; a file the projection imports that itself reaches a page importing the projection
  // makes that order matter ("Cannot access ... before initialization", seen 2026-11-13 with the Home page's compute)
  const file = path.join(ROOT, "modules", "retirement", "happenings.js"), target = path.join(ROOT, "modules", "retirement", "projection", "compute.js");
  const imports = [...fs.readFileSync(file, "utf8").matchAll(/from\s*["'](\.{1,2}\/[^"']+)["']/g)].map((m) => path.resolve(path.dirname(file), m[1]));
  assert.ok(imports.length >= 5, `${imports.length} imports`);
  for (const f of imports) assert.equal(reaches(f, target), false, `${path.relative(ROOT, f)} leads back to the projection`);
});

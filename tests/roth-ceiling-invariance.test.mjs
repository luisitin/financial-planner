// tests/roth-ceiling-invariance.test.mjs -- "Stop sooner" on Roth conversions (gap design #26: `retirement.conversionCeiling`,
// modules/retirement/roth-conversions/ceiling.js, `inputs.conversionCeiling` in core/math/retirement.js) changes no figure until a
// person picks a line. For every qa/fixtures/*-plan.mjs plan, the 14 households' base plans, the phone-built ones and the empty
// plan: no plan has the field and migrate adds none; the projection's buildInputs hands the engine nothing new, with conversions
// off and with them on; the engine with a line that is Infinity every year gives the rows it gave; and every module's compute that
// can reach the projection gives the same output with "bracket" as with the field absent (pattern of
// tests/happenings-invariance.test.mjs). The page's own two new keys (`ceiling`, `stops`) are the only additions to its output.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { project } from "../core/math/retirement.js";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";
import * as phone from "../qa/fixtures/phone-households.mjs";
import { buildInputs, compute as projection } from "../modules/retirement/projection/compute.js";
import { compute as roth } from "../modules/retirement/roth-conversions/compute.js";
import { ceilingOf, conversionCeiling } from "../modules/retirement/roth-conversions/ceiling.js";

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
  for (const [name, fn] of Object.entries(phone)) if (typeof fn === "function") out.push({ name: `phone ${name}`, plan: fn() });
  out.push({ name: "empty plan", plan: emptyPlan() });
  return out;
}
const ALL = await plans();
const out = (compute, plan) => { try { return JSON.stringify(compute(structuredClone(plan), { today: T })); } catch (e) { return `throws ${e.message}`; } };
const withBracket = (plan) => { const b = structuredClone(plan); b.retirement = { ...(b.retirement ?? {}), conversionCeiling: "bracket" }; return b; };
// the same plan with conversions in it, so the engine's conversion step runs
const converting = (plan, rate = 0.22) => { const b = structuredClone(plan); b.retirement = { ...(b.retirement ?? {}), taxMode: "brackets", rothConversion: { on: true, fillRate: rate, untilAge: null } }; return b; };

test(`no plan has the choice today, and migrate adds none: ${ALL.length} plans`, () => {
  assert.ok(ALL.length >= 30, `${ALL.length} plans`);
  for (const { name, plan } of ALL) for (const p of [plan, migrate(structuredClone(plan))]) {
    assert.equal(p.retirement?.conversionCeiling, undefined, `${name}: none`);
    assert.equal(ceilingOf(p), "bracket");
  }
});

test("with no line chosen the engine is handed nothing, conversions off or on, and an engine line of Infinity changes no row", () => {
  let ran = 0, converted = 0;
  for (const { name, plan } of ALL) {
    const a = migrate(structuredClone(plan));
    for (const p of [a, converting(a), converting(a, 0.12)]) {
      const now = buildInputs(p, { today: T });
      if (!now.inputs) continue;
      assert.equal("conversionCeiling" in now.inputs, false, `${name}: no key`);
      assert.equal(conversionCeiling(p, now.inputs, { today: T }), null);
      const same = buildInputs(withBracket(p), { today: T });
      assert.equal(JSON.stringify(same), JSON.stringify(now), `${name}: buildInputs`);
      assert.equal("conversionCeiling" in same.inputs, false);
      const r = project(now.inputs);
      assert.equal(JSON.stringify(project({ ...now.inputs, conversionCeiling: { lineFor: () => Infinity, untaxedSocial: true } })), JSON.stringify(r), `${name}: the engine`);
      ran++; if (r.totalConverted > 0) converted++;
    }
  }
  assert.ok(ran >= 60, `${ran} runs`);
  assert.ok(converted >= 20, `${converted} runs that convert`);
});

// the modules whose compute can reach the field: those whose compute.js imports, directly or through other files, the
// projection's compute.js (the one place the choice is read for the engine). Worked out from the files.
function reaches(file, target, seen = new Map()) {
  if (file === target) return true;
  if (seen.has(file)) return seen.get(file);
  seen.set(file, false);
  let src = "";
  try { src = fs.readFileSync(file, "utf8"); } catch { return false; }
  const hit = [...src.matchAll(/(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g)].some((m) => reaches(path.resolve(path.dirname(file), m[1]), target, seen));
  seen.set(file, hit);
  return hit;
}
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
// Will it last in bad markets? runs the engine a thousand times from the same buildInputs (20 seconds a run): its inputs are
// proven identical above, and the engine with no line is proven identical row by row, so it is left out of the whole sweep
const TOO_SLOW = new Set(["retirement/monte-carlo"]);

test("every page that can reach the projection gives the same output with \"bracket\" as with the field absent", async () => {
  const target = path.join(ROOT, "modules", "retirement", "projection", "compute.js");
  const seen = new Map();
  const mods = (await modules()).filter(([key]) => !SIZE_ONLY.has(key) && !TOO_SLOW.has(key) && reaches(path.join(ROOT, "modules", key, "compute.js"), target, seen));
  assert.ok(mods.some(([k]) => k === "retirement/roth-conversions") && mods.some(([k]) => k === "retirement/medicare") && mods.some(([k]) => k === "retirement/healthcare"), "the pages the lines come from are among them");
  // every plan, off and converting: Will the money last? and the page itself
  for (const { name, plan } of ALL) {
    const a = migrate(structuredClone(plan));
    for (const p of [a, converting(a)]) {
      assert.equal(out(projection, withBracket(p)), out(projection, p), `${name}: retirement/projection`);
      assert.equal(out(roth, withBracket(p)), out(roth, p), `${name}: retirement/roth-conversions`);
    }
  }
  // one fixture plan with conversions in the plan (the couple still saving): every one of those modules, whole (the sweep over
  // all four judged plans took three minutes of each test run for a field only buildInputs reads; every plan is covered by the
  // lines above and by the engine test)
  const one = ALL.filter(({ name }) => /fixture retirement-plan/.test(name));
  assert.equal(one.length, 1);
  let compared = 0;
  for (const { name, plan } of one) {
    const a = converting(migrate(structuredClone(plan))), b = withBracket(a);
    for (const [key, compute] of mods) { assert.equal(out(compute, b), out(compute, a), `${name}: ${key}`); compared++; }
  }
  assert.ok(compared >= 40, `${compared} comparisons`);
});

test("the page's own output gains two keys and nothing else moves: `ceiling` is \"bracket\" and the tax rate alone in `stops` is the page's own line", () => {
  let withStops = 0;
  for (const { name, plan } of ALL) {
    const d = roth(converting(migrate(structuredClone(plan))), { today: T });
    if (!d.ready) continue;
    assert.equal(d.ceiling, "bracket", name);
    assert.ok(Array.isArray(d.stops), name);
    if (!d.stops.length) continue;
    withStops++;
    const own = d.options.find((o) => o.fillRate === d.shown), base = d.stops[0];
    assert.equal(base.key, "bracket"); assert.equal(base.chosen, true);
    assert.equal(base.endAfterTaxReal, own.endAfterTaxReal, `${name}: left at the end`);
    assert.equal(base.taxesReal, own.taxesReal, `${name}: lifetime tax`);
    assert.equal(base.healthReal, own.healthReal, `${name}: health insurance`);
    assert.equal(base.totalConvertedReal, own.totalConvertedReal, `${name}: converted`);
  }
  assert.ok(withStops >= 10, `${withStops} plans with a line to compare`);
});

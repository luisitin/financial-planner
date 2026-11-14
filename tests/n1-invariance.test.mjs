// tests/n1-invariance.test.mjs -- three quiet additions to the retirement answer pages (gap next-60 #36 and #53) change no figure
// a page already showed. Nothing new is typed anywhere (no plan field, no what-if, no device key): each addition is a new
// compute param, and a compute asked for it gives, beside its new key, exactly what it gives without it. For every
// qa/fixtures/*-plan.mjs plan, the 14 households' base plans, the phone-built ones and the empty plan (the pattern of
// tests/early-invariance.test.mjs):
//   - Chance the money lasts: { endings: true } adds `endings`, { runs: true } adds `runs` and `runsYears`;
//   - If history repeated: { perpetual: true } adds `perpetual`;
//   - Financial independence: { ladder: true } adds `ladder`;
//   - without the param, no new key is there (so every other caller reads the same bytes as before);
//   - migrate adds no field for any of them.
// The comparison with the code as it was before these commits (6ffb433), byte for byte, is in the builder's log.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";
import * as phone from "../qa/fixtures/phone-households.mjs";
import { compute as chance } from "../modules/retirement/monte-carlo/compute.js";
import { compute as history } from "../modules/retirement/historical/compute.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const T = "2026-11-14";
async function plans() {
  const out = [];
  const dir = path.join(ROOT, "qa", "fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) out.push({ name: `fixture ${f}:${name}`, plan: fn(T) });
  }
  for (const a of ARCHETYPES) out.push({ name: `${a.id}/base`, plan: a.build() });
  for (const [name, fn] of Object.entries(phone)) if (typeof fn === "function") out.push({ name: `phone ${name}`, plan: fn() });
  out.push({ name: "empty plan", plan: emptyPlan() });
  return out;
}
const ALL = (await plans()).map((x) => ({ ...x, plan: migrate(structuredClone(x.plan)) }));
const without = (o, keys) => { const c = { ...o }; for (const k of keys) delete c[k]; return c; };
const run = (fn, plan, params) => { try { return fn(structuredClone(plan), params); } catch (e) { return { threw: e.message }; } };

test(`the plans: ${ALL.length}, and migrate adds nothing these pages read`, () => {
  assert.ok(ALL.length >= 30, `${ALL.length} plans`);
  for (const { name, plan } of ALL) assert.equal(JSON.stringify(migrate(structuredClone(plan))), JSON.stringify(plan), `${name}: migrate is settled`);
});

test("Chance the money lasts: endings and runs add their keys and move nothing else, byte for byte", () => {
  let ran = 0;
  for (const { name, plan } of ALL) {
    const base = { today: T, paths: 120, careful: false };
    const a = run(chance, plan, base);
    const b = run(chance, plan, { ...base, endings: true, runs: true });
    assert.equal(JSON.stringify(without(b, ["endings", "runs", "runsYears"])), JSON.stringify(a), name);
    for (const k of ["endings", "runs", "runsYears"]) assert.equal(k in a, false, `${name}: no ${k} unless asked`);
    if (!a.ready) continue;
    ran++;
    assert.equal(b.endings.ranOut + b.endings.lasted, 120, name);
    assert.equal(b.runs.length, 120, name);
  }
  assert.ok(ran >= 20, `${ran} plans that run`);
});

test("If history repeated: perpetual adds its key and moves nothing else, byte for byte (quick and full)", () => {
  let ran = 0;
  for (const { name, plan } of ALL) {
    for (const quick of [true, false]) {
      if (!quick && ran > 6) continue;   // the full search (safe spending) on the first plans that run: it is the same code path
      const base = { today: T, quick };
      const a = run(history, plan, base);
      const b = run(history, plan, { ...base, perpetual: true });
      assert.equal(JSON.stringify(without(b, ["perpetual"])), JSON.stringify(a), `${name} quick ${quick}`);
      assert.equal("perpetual" in a, false, `${name}: no perpetual unless asked`);
      if (a.ready && quick) { ran++; assert.ok(b.perpetual === null || b.perpetual.windows >= 1, name); }
    }
  }
  assert.ok(ran >= 20, `${ran} plans that run`);
});

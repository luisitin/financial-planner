// tests/early-invariance.test.mjs -- Money before 59½ (gap design #38: the engine's `early` input, `retirement.early.sepp`) changes
// no figure unless the plan takes money out of a 401(k) or IRA before its owner is 59½, or a person sets equal payments.
// For every qa/fixtures/*-plan.mjs plan, the 14 households' base plans, the phone-built ones and the empty plan (the pattern of
// tests/happenings-invariance.test.mjs):
//   - no plan has the field and migrate adds none;
//   - the run with the `early` input is, byte for byte, the run without it whenever no year charges the 10% (and the plans where
//     a year does are named: they are the ones that reach into pre-tax money early);
//   - an empty `retirement.early` is the field absent, for the projection and for every page on the four fixture plans;
//   - core/math/early.js reads leaves only.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";
import * as phone from "../qa/fixtures/phone-households.mjs";
import * as round8 from "../qa/fixtures/round8-households.mjs";
import { project } from "../core/math/retirement.js";
import { buildInputs, compute as projection } from "../modules/retirement/projection/compute.js";

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
  // the round 8 households, the early retiree among them (50, living on an IRA): the one invented plan that reaches in early
  for (const [name, fn] of Object.entries(round8)) if (typeof fn === "function" && /Plan$/.test(name)) out.push({ name: `round8 ${name}`, plan: fn() });
  out.push({ name: "empty plan", plan: emptyPlan() });
  return out;
}
const ALL = await plans();
const out = (compute, plan) => { try { return JSON.stringify(compute(structuredClone(plan), { today: T })); } catch (e) { return `throws ${e.message}`; } };

test(`no plan sets equal payments today, and migrate adds none: ${ALL.length} plans`, () => {
  assert.ok(ALL.length >= 30, `${ALL.length} plans`);
  for (const { name, plan } of ALL) for (const p of [plan, migrate(structuredClone(plan))]) assert.equal(p.retirement?.early, undefined, `${name}: none`);
});

test("with no year that takes pre-tax money out before 59½, the run is the run without the new input, byte for byte", () => {
  let ran = 0, withKey = 0;
  const charged = [];
  for (const { name, plan } of ALL) {
    const b = buildInputs(migrate(structuredClone(plan)), { today: T });
    if (!b.inputs) continue;
    ran++;
    const { early, ...before } = b.inputs;
    if (early) { withKey++; assert.equal(early.sepp, undefined, `${name}: no equal payments`); }
    const now = project(b.inputs), old = project(before);
    const hit = now.rows.filter((r) => r.earlyTax > 0 || r.early55 > 0);
    if (hit.length) {
      charged.push(name);
      // the years before the first one that reaches in early are untouched
      const first = now.rows.indexOf(hit[0]);
      assert.equal(JSON.stringify(now.rows.slice(0, first)), JSON.stringify(old.rows.slice(0, first)), `${name}: the years before ${hit[0].year}`);
      assert.ok(hit.every((r) => r.ages.some((a) => a <= 60)), `${name}: only while someone is under 59½`);
      continue;
    }
    assert.equal(JSON.stringify(now), JSON.stringify(old), `${name}: identical`);
    assert.equal("totalEarlyTax" in now, false, `${name}: no new field in the result`);
  }
  assert.ok(ran >= 20, `${ran} plans that run`);
  assert.ok(withKey >= 5, `${withKey} plans have someone under 59½ who owns a 401(k) or IRA`);
  // the invented plans that reach into a 401(k) or IRA before 59½ (their answers now hold the 10%, or the age-55 rule spares it)
  assert.deepEqual(charged.sort(), CHARGED, "the plans whose figures the 10% moves");
});
/** The invented plans where a year takes pre-tax money out before 59½ (see the test above). */
const CHARGED = ["round8 earlyRetireePlan"];

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
test("an empty retirement.early is the field absent: the projection for every plan, and every page that reaches it on the four fixture plans", async () => {
  const withEmpty = (plan) => { const b = structuredClone(plan); b.retirement = { ...(b.retirement ?? {}), early: {} }; return b; };
  for (const { name, plan } of ALL) {
    const a = migrate(structuredClone(plan));
    assert.equal(JSON.stringify(buildInputs(withEmpty(a), { today: T })), JSON.stringify(buildInputs(a, { today: T })), `${name}: buildInputs`);
    assert.equal(out(projection, withEmpty(a)), out(projection, a), `${name}: retirement/projection`);
  }
  const target = path.join(ROOT, "modules", "retirement", "projection", "compute.js");
  const seen = new Map(), mods = [];
  for (const g of fs.readdirSync(path.join(ROOT, "modules"), { withFileTypes: true })) {
    if (!g.isDirectory() || g.name.startsWith("_")) continue;
    for (const m of fs.readdirSync(path.join(ROOT, "modules", g.name), { withFileTypes: true })) {
      const f = path.join(ROOT, "modules", g.name, m.name, "compute.js");
      // System > Diagnostics and Settings measure the saved plan's size: any field added changes it, by design
      if (m.isDirectory() && fs.existsSync(f) && !["system/diagnostics", "system/settings"].includes(`${g.name}/${m.name}`) && reaches(f, target, seen)) mods.push([`${g.name}/${m.name}`, (await import(pathToFileURL(f).href)).compute]);
    }
  }
  assert.ok(mods.length >= 40 && mods.some(([k]) => k === "retirement/early-access"), `${mods.length} modules reach the projection`);
  const four = ALL.filter(({ name }) => /fixture (family|renter-debt|retired-couple|retirement)-plan/.test(name));
  assert.ok(four.length >= 4, `${four.length} plans`);
  for (const { name, plan } of four) { const a = migrate(structuredClone(plan)), b = withEmpty(a); for (const [key, compute] of mods) assert.equal(out(compute, b), out(compute, a), `${name}: ${key}`); }
});

test("core/math/early.js reads leaves only: nothing it imports leads to a module", () => {
  const src = fs.readFileSync(path.join(ROOT, "core", "math", "early.js"), "utf8");
  const imports = [...src.matchAll(/from\s*["']([^"']+)["']/g)].map((m) => m[1]);
  assert.deepEqual(imports, ["./rmd.js"]);
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, "core", "math", "rmd.js"), "utf8"), /^import /m);
});

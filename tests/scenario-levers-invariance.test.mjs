// tests/scenario-levers-invariance.test.mjs -- Scenario compare's new levers and "Make this my plan" (gap design #25:
// `scenarios[].changes` keys spendingEase, strategy, homeYear, homeBuyFor, homeRent, lessWho, lessFrom, lessUntil, lessShare; and
// `scenarios[].madePlan`) change no figure until a person uses one. For every qa/fixtures/*-plan.mjs plan, the 14 households'
// base plans, the phone-built ones and the empty plan, each with the versions a plan could hold before this design:
//   - compute()'s output has the keys it had, and `current` none of the new levers;
//   - a version whose new keys are absent, empty, null or not a number gives the very same output as one without them;
//   - a version that was made the plan and put back, or that still holds its record, gives the same output as before (the
//     record is read by the page only);
//   - the copy of the plan a version runs on has no "Things that will happen", way of taking money out or easing of its own.
// (Pattern of tests/happenings-invariance.test.mjs. The figures themselves against the code before this design: compared once,
// byte for byte, when it was built; see modules/scenarios/compare/README.md "Make this my plan".)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";
import * as phone from "../qa/fixtures/phone-households.mjs";
import { compute, applyChanges, makeMyPlan, putBack, HAPPENING_KEYS } from "../modules/scenarios/compare/compute.js";
import { compute as advisor } from "../modules/scenarios/advisor-plan/compute.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const T = "2026-11-14";
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
/** The versions a plan could hold before this design: every lever it had. */
function oldVersions(plan) {
  const adults = (plan.household?.people ?? []).filter((x) => x.role !== "dependent");
  const per = (key, v) => Object.fromEntries(adults.map((a) => [`${key}:${a.id}`, v]));
  return [
    { id: "o1", name: "Earlier, later, less", changes: { ...per("retireAge", 61), ...per("claimAge", 69), spendingMonthly: 4321, extraSavingMonthly: 250 } },
    { id: "o2", name: "Markets", changes: { stocksNow: 0.55, stocksRetired: 0.35, returnStocks: 0.061, returnBonds: 0.031, inflation: 0.027, fee: 0.01, lumpSum: -15000, lumpYear: 2028 } },
  ];
}
const NEW_KEYS = ["spendingEase", "strategy", ...HAPPENING_KEYS];
const run = (plan) => { try { return JSON.stringify(compute(structuredClone(plan), { today: T, paths: 20 })); } catch (e) { return `throws ${e.message}`; } };

test(`no plan has a version with the new levers or a record of being made the plan, and migrate adds none: ${ALL.length} plans`, () => {
  assert.ok(ALL.length >= 30, `${ALL.length} plans`);
  for (const { name, plan } of ALL) for (const p of [plan, migrate(structuredClone(plan))]) for (const s of p.scenarios ?? []) {
    assert.ok(!("madePlan" in s), name);
    for (const k of NEW_KEYS) assert.ok(!(k in (s.changes ?? {})), `${name}: ${k}`);
  }
});

test("compute(): the keys it had; new keys absent, empty or unusable move nothing; the record of being made the plan is not read", () => {
  let ready = 0;
  for (const { name, plan } of ALL) {
    const p = migrate(structuredClone(plan));
    p.scenarios = oldVersions(p);
    const base = run(p);
    const d = JSON.parse(base);
    if (d.ready) {
      ready++;
      assert.deepEqual(Object.keys(d), ["ready", "missing", "base", "scenarios", "current", "adults"], name);
      for (const s of d.scenarios) assert.deepEqual(Object.keys(s), ["id", "name", "changes", "described", "results", "missing"], name);
      for (const k of NEW_KEYS) assert.ok(!(k in d.current), `${name}: current.${k}`);
    }
    for (const blank of ["", null, "soon", undefined]) {
      const q = structuredClone(p);
      for (const s of q.scenarios) for (const k of NEW_KEYS) s.changes[k] = blank;
      const got = JSON.parse(run(q));
      for (const s of got.scenarios ?? []) for (const k of NEW_KEYS) delete s.changes[k];
      assert.equal(JSON.stringify(got), base, `${name}: new keys ${JSON.stringify(blank)}`);
    }
    // a price, a rent or a share with no year adds no line
    const loose = structuredClone(p);
    Object.assign(loose.scenarios[0].changes, { homeBuyFor: 200000, homeRent: 900, lessWho: "nobody", lessUntil: 2031, lessShare: 0.5 });
    const got = JSON.parse(run(loose));
    for (const s of got.scenarios ?? []) for (const k of NEW_KEYS) delete s.changes[k];
    assert.equal(JSON.stringify(got), base, `${name}: no year, no line`);
    // made the plan and put back: the plan of before, so the output of before; the record alone is not read by compute
    const made = structuredClone(p);
    const r = makeMyPlan(made, "o1", { today: T });
    if (r.carried.length) {
      const withRecord = structuredClone(p); withRecord.scenarios[0].madePlan = structuredClone(made.scenarios[0].madePlan);
      assert.equal(run(withRecord), base, `${name}: the record is not read`);
    }
    putBack(made, "o1");
    assert.equal(JSON.stringify(made), JSON.stringify(p), `${name}: put back`);
    assert.equal(run(made), base, name);
  }
  assert.ok(ready >= 20, `${ready} plans could be run`);
});

test("the copy a version runs on gets nothing of the new levers, and An advisor's plan (which shares the levers) reads as before", () => {
  for (const { name, plan } of ALL) {
    const p = migrate(structuredClone(plan));
    for (const s of oldVersions(p)) {
      const a = applyChanges(p, s.changes, { today: T });
      assert.equal(JSON.stringify(a.plan.retirement?.happenings), JSON.stringify(p.retirement?.happenings), name);
      assert.equal(a.plan.retirement?.strategy, p.retirement?.strategy, name); assert.equal(a.plan.retirement?.spendingEase, p.retirement?.spendingEase, name);
    }
    p.advisor = { firm: "An invented firm", fee: 0.01, changes: { returnStocks: 0.06, inflation: 0.025 } };
    const before = JSON.stringify(advisor(structuredClone(p), { today: T, paths: 20 }));
    p.advisor.changes = { ...p.advisor.changes, strategy: "vpw", spendingEase: 0.02, homeYear: 2040, lessFrom: 2030 };
    assert.equal(JSON.stringify(advisor(structuredClone(p), { today: T, paths: 20 })), before, `${name}: the advisor's page takes none of the new levers`);
  }
});

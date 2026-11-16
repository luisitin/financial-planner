// tests/sweep-x3-invariance.test.mjs -- the whole-app sweep x3's fixes (2026-11-16) change no figure and no word of any plan they
// were not meant for. Over every qa/fixtures/*-plan.mjs plan, the 14 households' base plans, the phone-built ones, the round 8
// households, the Get started personas and the empty plan, each touched compute()'s whole output is checked against a digest
// written down from the code before the sweep's fixes (commit ce79d70), with nothing new typed. The only outputs allowed to move:
//   - a plan with nothing saved for retirement and nothing going in (retirement/projection retirementUnknown): the pages that add
//     `unknown` must be, without that one field, byte for byte what they were, and the field is the projection's own answer; the
//     Timeline, How am I doing and Quick answers say their new words there (tests/sweep-x3.test.mjs pins those);
//   - Disability, for a plan whose pay Paycheck can work out (its take-home is now Paycheck's): listed by the test, and every
//     other plan's Disability is what it was.
//
// To write the digests down again (from the code before a deliberate change): PRINT=1 node --test tests/sweep-x3-invariance.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";
import * as phone from "../qa/fixtures/phone-households.mjs";
import * as round8 from "../qa/fixtures/round8-households.mjs";
import * as personas from "../qa/fixtures/setup-personas.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const T = "2026-11-16";
const FILE = new URL("./sweep-x3-invariance.json", import.meta.url);
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);

async function plans() {
  const out = [];
  const dir = path.join(ROOT, "qa", "fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) out.push({ name: `fixture ${f}:${name}`, plan: fn(T) });
  }
  for (const a of ARCHETYPES) out.push({ name: `${a.id}/base`, plan: a.build() });
  for (const [name, fn] of Object.entries(phone)) if (typeof fn === "function") out.push({ name: `phone ${name}`, plan: fn() });
  for (const [name, fn] of Object.entries(round8)) if (typeof fn === "function" && /Plan$/.test(name)) out.push({ name: `round8 ${name}`, plan: fn() });
  for (const n of ["sam", "jordan", "patLee", "ruth"]) out.push({ name: `persona ${n}`, plan: personas.finishSetup(n, personas[n](T), T) });
  out.push({ name: "empty plan", plan: emptyPlan() });
  return out.map((x) => ({ ...x, plan: migrate(structuredClone(x.plan)) }));
}

// every compute the sweep's commits touched, with the parameters its page asks for (heavy ones at fewer pretend futures: the same
// in both runs)
const PAGES = [
  ["retirement/projection", { today: T }],
  ["retirement/historical", { today: T, quick: true, perpetual: true }],
  ["retirement/monte-carlo", { today: T, paths: 200, seed: 1, careful: false, endings: true }],
  ["retirement/withdrawal-strategy", { today: T }],
  ["retirement/sequence-risk", { today: T }],
  ["retirement/fire", { today: T, ladder: true }],
  ["retirement/cash-flow", { today: T, real: true }],
  ["scenarios/stress-tests", { today: T }],
  ["insurance/ltc", { today: T }],
  ["insurance/disability", { today: T }],
  ["taxes/projection", { today: T }],
  ["overview/benchmarks", { today: T }],
  ["overview/timeline", { today: T }],
  ["overview/quick", { today: T }],
  ["reports/retirement", { today: T, maxPaths: 200 }],
];
/** The pages whose only change for a nothing-saved plan is the added `unknown` field. */
const ADDS_UNKNOWN = ["retirement/historical", "retirement/monte-carlo", "retirement/withdrawal-strategy", "retirement/sequence-risk", "retirement/fire",
  "retirement/cash-flow", "scenarios/stress-tests", "insurance/ltc", "taxes/projection", "reports/retirement"];
/** The pages whose words change for a nothing-saved plan (pinned in tests/sweep-x3.test.mjs). */
const SAYS_UNKNOWN = ["overview/timeline", "overview/benchmarks", "overview/quick"];

const digest = (v) => crypto.createHash("sha256").update(JSON.stringify(v) ?? "undefined").digest("base64url").slice(0, 22);
const run = (fn) => { try { return fn(); } catch (e) { return { threw: String(e.message) }; } };
const mods = {};
for (const [key] of PAGES) mods[key] = await imp(`modules/${key}/compute.js`);
const goalSeek = await imp("modules/scenarios/goal-seek/compute.js");

function figures(plan) {
  const out = {};
  for (const [key, params] of PAGES) out[key] = run(() => mods[key].compute(structuredClone(plan), { ...params }));
  // Goal seek's nothingSaved moved to the projection (re-exported): the same answer for every plan
  out["scenarios/goal-seek nothingSaved"] = run(() => goalSeek.nothingSaved(plan));
  return out;
}

const ALL = await plans();

if (process.env.PRINT) {
  const json = { note: "digests of the touched computes before the whole-app sweep x3's fixes (commit ce79d70); tests/sweep-x3-invariance.test.mjs says how to write them again", today: T, plans: {} };
  for (const { name, plan } of ALL) json.plans[name] = Object.fromEntries(Object.entries(figures(plan)).map(([k, v]) => [k, digest(v)]));
  fs.writeFileSync(FILE, JSON.stringify(json, null, 1) + "\n");
  test("digests written", () => {});
} else {
  const before = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const proj = await imp("modules/retirement/projection/compute.js");
  const paycheck = await imp("modules/cashflow/paycheck/compute.js");
  test("the plans are the ones the digests were written for", () => {
    assert.deepEqual(ALL.map((x) => x.name), Object.keys(before.plans));
    assert.ok(ALL.length >= 40, `${ALL.length} plans`);
  });
  const moved = { unknown: [], disability: [] };
  for (const { name, plan } of ALL) {
    test(`${name}: every touched compute is what it was, but for the changes it is meant for`, () => {
      const was = before.plans[name];
      const now = figures(plan);
      const u = proj.retirementUnknown(plan, { today: T });
      let pay = null;
      try { pay = paycheck.takeHome(plan, { today: T }); } catch { pay = null; }
      if (u) moved.unknown.push(name);
      for (const [key, v] of Object.entries(now)) {
        if (u && SAYS_UNKNOWN.includes(key)) continue;   // its new words: tests/sweep-x3.test.mjs
        if (key === "insurance/disability" && pay?.ready && (v?.earners ?? []).length) { if (digest(v) !== was[key]) moved.disability.push(name); continue; }
        let mine = v;
        if (u && ADDS_UNKNOWN.includes(key) && v && typeof v === "object" && "unknown" in v) {
          assert.deepEqual(v.unknown, u, `${name} ${key}: the projection's own answer`);
          mine = { ...v }; delete mine.unknown;
        }
        assert.equal(digest(mine), was[key], `${name}: ${key} changed`);
      }
    });
  }
  test("what moved, by name (nothing else may)", () => {
    // the plans with nothing saved for retirement and nothing going in: Riley (renterDebt) and the Get started personas that said
    // nothing about savings, among them
    assert.ok(moved.unknown.includes("fixture renter-debt-plan.mjs:renterDebtPlan"), moved.unknown.join(", "));
    assert.ok(moved.unknown.includes("persona sam"), moved.unknown.join(", "));
    assert.ok(!moved.unknown.includes("fixture family-plan.mjs:familyPlan"));
    // Disability moved only where Paycheck works the take-home out, and for the family it did
    assert.ok(moved.disability.includes("fixture family-plan.mjs:familyPlan"), moved.disability.join(", "));
  });
}

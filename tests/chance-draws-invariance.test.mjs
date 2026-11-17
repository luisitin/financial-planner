// tests/chance-draws-invariance.test.mjs -- two quiet additions to Chance the money lasts (gap list, next 60, items 35 and 37)
// change no figure of a plan that keeps the usual way of drawing the pretend years: "How the pretend years are drawn" (years
// picked from history, prices that rise unevenly: compute's `draw` param, and the optional `assumptions.chanceDraw` the page
// alone reads) and "Money and the odds of living" (compute's `living` param). Over every qa/fixtures/*-plan.mjs plan, the 14
// households' base plans, the phone-built ones, the round 8 households and the empty plan (the pattern of
// tests/withdrawal-ways-invariance.test.mjs):
//   - no plan has the new field, and migrate adds none;
//   - Chance the money lasts' compute (as the page and the reports ask for it, with how the runs end and every run as a file,
//     and with the careful figure for the fixture plans), the draws other pages share (drawShocks, shapeSequences,
//     drawSequences, the seeded generator), Reports > Retirement, the plan summary, Financial independence, Goals and
//     Compare give, byte for byte, the very output they gave before the change, checked by a digest per plan written down
//     from the code before it (commit 81a5288);
//   - the same with `draw: "usual"` asked for, with an unknown draw, and with `assumptions.chanceDraw` saved in the plan:
//     compute never reads the field (the page reads it and asks for the way), so no other page moves when it is kept.
//
// z1 (2026-11-16): the plan summary quotes Plan health score, which now scores "Retirement on track" when Social Security is the
// only gap and the money lasts without it (overview/setup lastsWithoutSs). For the three plans that lifts (the retired couple,
// 08-retired, 14-unusual-structures) the `summary` and `summaryButJobLoss` digests were rewritten from a PRINT run after that
// change, those entries only (the score, its band, the retirement part and the list of what would lift it moved; nothing else);
// tests/one-answer.test.mjs checks the summary quotes the Health score's own answer.
// To write the digests down again after a deliberate change to these figures: PRINT=1 node --test tests/chance-draws-invariance.test.mjs
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
import { mulberry32, normal } from "../core/math/montecarlo.js";
import { compute as chance, drawShocks, shapeSequences, drawSequences } from "../modules/retirement/monte-carlo/compute.js";
import { compute as reportRetirement } from "../modules/reports/retirement/compute.js";
import { compute as summary } from "../modules/reports/plan-summary/compute.js";
import { compute as fire } from "../modules/retirement/fire/compute.js";
import { compute as goals } from "../modules/goals/goals/compute.js";
import { compute as compare } from "../modules/scenarios/compare/compute.js";
import { retirementUnknown } from "../modules/retirement/projection/compute.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const T = "2026-11-15";
const FILE = new URL("./chance-draws-invariance.json", import.meta.url);
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
  out.push({ name: "empty plan", plan: emptyPlan() });
  return out;
}
const ALL = (await plans()).map((x) => ({ ...x, plan: migrate(structuredClone(x.plan)) }));
const digest = (v) => crypto.createHash("sha256").update(JSON.stringify(v) ?? "undefined").digest("base64url").slice(0, 22);
const run = (fn) => { try { return fn(); } catch (e) { return { threw: e.message }; } };
// Whole-app sweep x3 (2026-11-16): for a plan with nothing saved for retirement and nothing going in, the retirement pages add
// `unknown`, the projection's own "We don't know yet" (retirementUnknown). Without that one field each output is what it was
// before; the field must be the projection's answer. The words those pages now say are pinned by tests/sweep-x3.test.mjs.
const sansUnknown = (v, u) => { if (!u || !v || typeof v !== "object" || !("unknown" in v)) return v; assert.deepEqual(v.unknown, u); const { unknown: _u, ...rest } = v; return rest; };
/** The plans whose plan summary now says "not known yet" (the Timeline's and the Plan health score's words; tests/sweep-x3.test.mjs
 * and the health score's module test pin them): their summary is not compared here. */
const SAYS_UNKNOWN = new Set(ALL.filter(({ plan }) => retirementUnknown(plan, { today: T })).map((x) => x.name));
/** The plan summary without the job loss's row among the shocks the plan does not survive: the Stress tests' job loss takes the
 * take-home Paycheck works out since the sweep x3 fix round (critic F3), so that row's figures move where the shock fails; the rest
 * of the summary may not, nor which shocks fail (`jobLossFails` and the count passed). Its digests were written from ce79d70, the
 * code before that change, where every other digest here was the same as at 81a5288. */
const JOB_LOSS = / out of work for /;
const butJobLoss = (s) => (s?.protection ? { ...s, protection: { ...s.protection, failing: s.protection.failing.filter((f) => !JOB_LOSS.test(f.title)) } } : s);
/** The plan summary without its Goals row's reason and step (ha (b), 2026-11-17: `why` and `step`, the Plan health score's own
 * words where it could not judge Goals; modules/reports/plan-summary/module.test.mjs pins them): without them, what it was. */
const sansWhy = (s) => (s?.health ? { ...s, health: { ...s.health, parts: s.health.parts.map(({ why: _w, step: _s, ...x }) => x) } } : s);
const skipped = (name, k, jobLossFails) => (k === "summary" && (SAYS_UNKNOWN.has(name) || jobLossFails)) || (k === "summaryButJobLoss" && SAYS_UNKNOWN.has(name));
/** The careful figure (thousands of runs) only for the plans the module tests use. */
const CAREFUL = new Set(["fixture family-plan.mjs:familyPlan", "fixture retirement-plan.mjs:retirementPlan", "fixture widow-plan.mjs:widowPlan"]);
/** Chance the money lasts' own figures for one plan, asked for with `extra` on top of each call the pages make. */
function chanceFigures(name, plan, extra = {}) {
  const p = () => structuredClone(plan);
  const u = retirementUnknown(plan, { today: T });
  return {
    page: run(() => sansUnknown(chance(p(), { today: T, paths: 300, seed: 1, careful: false, ...extra }), u)),
    ends: run(() => sansUnknown(chance(p(), { today: T, paths: 300, seed: 1, careful: false, endings: true, runs: true, ...extra }), u)),
    careful: CAREFUL.has(name) ? run(() => sansUnknown(chance(p(), { today: T, paths: 300, ...extra }), u)) : null,
  };
}
/** Every figure these changes could reach, for one plan, by what it is. */
function figures(name, plan) {
  const p = () => structuredClone(plan);
  const u = retirementUnknown(plan, { today: T });
  return {
    ...chanceFigures(name, plan),
    report: run(() => sansUnknown(reportRetirement(p(), { today: T, maxPaths: 200 }), u)),
    ...(() => { const s = sansWhy(run(() => summary(p(), { today: T, maxPaths: 200 }))); return { summary: s, summaryButJobLoss: butJobLoss(s), jobLossFails: !!s?.protection?.failing?.some((f) => JOB_LOSS.test(f.title)) }; })(),
    fire: run(() => sansUnknown(fire(p(), { today: T }), u)),
    goals: run(() => goals(p(), { today: T })),
    compare: run(() => compare(p(), { today: T, paths: 100 })),
  };
}
/** The draws other pages share, the same for every plan. */
function shared() {
  const r = mulberry32(1);
  const u = Array.from({ length: 200 }, () => r());
  const z = Array.from({ length: 200 }, () => normal(r));
  const shocks = drawShocks(40, 30, 1);
  return {
    uniform: digest(u), normal: digest(z), shocks: digest(shocks),
    shaped: digest(shapeSequences(shocks, { stocks: 0.07, bonds: 0.04, stdevStocks: 0.15, stdevBonds: 0.05 })),
    sequences: digest(drawSequences(40, 30, { stocks: 0.07, bonds: 0.04, stdevStocks: 0.15, stdevBonds: 0.05, seed: 7 })),
  };
}

test(`the plans: ${ALL.length}; none has the new field, and migrate adds none`, () => {
  assert.ok(ALL.length >= 40, `${ALL.length} plans`);
  for (const { name, plan } of ALL) {
    assert.equal(plan.assumptions?.chanceDraw, undefined, `${name}: no way of drawing saved`);
    assert.equal(JSON.stringify(migrate(structuredClone(plan))), JSON.stringify(plan), `${name}: migrate is settled`);
  }
});

test("with the usual way of drawing, every figure is the one the code gave before (81a5288), byte for byte", () => {
  const now = Object.fromEntries(ALL.map(({ name, plan }) => [name, Object.fromEntries(Object.entries(figures(name, plan)).map(([k, v]) => [k, digest(v)]))]));
  if (process.env.PRINT) {
    fs.writeFileSync(FILE, `${JSON.stringify({ note: "digests of Chance the money lasts and the pages that share its draws, before the ways of drawing the pretend years and the odds of living (commit 81a5288); tests/chance-draws-invariance.test.mjs says how to write them again", shared: shared(), plans: now }, null, 1)}\n`);
    return;
  }
  const was = JSON.parse(fs.readFileSync(FILE, "utf8"));
  assert.deepEqual(shared(), was.shared, "the draws other pages share");
  assert.deepEqual(Object.keys(now).sort(), Object.keys(was.plans).sort(), "the same plans");
  let ran = 0;
  for (const [name, d] of Object.entries(now)) {
    for (const [k, v] of Object.entries(was.plans[name])) if (!skipped(name, k, d.jobLossFails === digest(true))) assert.equal(d[k], v, `${name}: ${k}`);
    if (ALL.find((x) => x.name === name) && chance(structuredClone(ALL.find((x) => x.name === name).plan), { today: T, paths: 100, careful: false }).ready) ran++;
  }
  assert.ok(ran >= 25, `${ran} plans run`);
});

test("the usual way asked for by name, an unknown way, a way kept in the plan, or the odds of living asked for: the same bytes (compute never reads the field)", { skip: !!process.env.PRINT }, () => {
  const was = JSON.parse(fs.readFileSync(FILE, "utf8")).plans;
  for (const { name, plan } of ALL) {
    const kept = (way) => { const q = structuredClone(plan); q.assumptions = { ...(q.assumptions ?? {}), chanceDraw: way }; return q; };
    const cases = [["draw usual", plan, { draw: "usual" }], ["draw unknown", plan, { draw: "lottery" }], ["draw null", plan, { draw: null }],
      ["kept history", kept("history"), {}], ["kept prices", kept("prices"), {}]];
    for (const [label, q, extra] of cases) {
      const d = chanceFigures("", q, extra);   // the careful figure once, below (thousands of runs)
      for (const k of ["page", "ends"]) assert.equal(digest(d[k]), was[name][k], `${name}, ${label}: ${k}`);
    }
    // money and the odds of living adds its key and moves nothing else (the page asks for it with its one run)
    const withLiving = chanceFigures("", plan, { living: true });
    for (const k of ["page", "ends"]) {
      const v = withLiving[k];
      if (v?.ready) { assert.ok("living" in v, `${name}: living asked for`); delete v.living; }
      assert.equal(digest(v), was[name][k], `${name}, living: ${k}`);
    }
    // every figure, with a way kept in the plan: this page as the other pages ask for it, and every other page
    const d = figures(name, kept("history"));
    for (const k of Object.keys(was[name])) if (!skipped(name, k, d.jobLossFails === true)) assert.equal(digest(d[k]), was[name][k], `${name}, kept history: ${k}`);
  }
});

// tests/withdrawal-ways-invariance.test.mjs -- a fifth withdrawal order ("A share from every account", `retirement.withdrawalSplit`)
// and two more named withdrawal rules (`retirement.strategy` "endowment" and "ninety-five") change no figure of a plan that keeps
// today's order and rule (gap list, next 60, items 21 and 22). Over every qa/fixtures/*-plan.mjs plan, the 14 households' base plans,
// the phone-built ones, the round 8 households and the empty plan (the pattern of tests/reader-invariance.test.mjs):
//   - no plan has the new field, and migrate adds none;
//   - the engine's run of every one of the four ways under every one of the four orders, the projection, Cash flow in retirement,
//     Withdrawal order, How much to take out (its compute and its first-year answer), Compare's offers and the ways Retirement
//     settings lists give, byte for byte, the very output they gave before the change, checked by a digest per plan written down
//     from the code before it (commit 154a597). A compute's new keys (Withdrawal order's `share` and `five`, How much to take out's
//     `more`) are taken off before the digest: everything that was there is exactly as it was.
//
// To write the digests down again after a deliberate change to these figures: PRINT=1 node --test tests/withdrawal-ways-invariance.test.mjs
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
import { project } from "../core/math/retirement.js";
import { buildInputs, compute as projection } from "../modules/retirement/projection/compute.js";
import { compute as cashFlow } from "../modules/retirement/cash-flow/compute.js";
import { compute as order } from "../modules/retirement/withdrawal-order/compute.js";
import { compute as ways, firstYear, wayOptions } from "../modules/retirement/withdrawal-strategy/compute.js";
import { offers } from "../modules/scenarios/compare/compute.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const T = "2026-11-15";
const FILE = new URL("./withdrawal-ways-invariance.json", import.meta.url);
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
const without = (o, keys) => { if (!o || typeof o !== "object") return o; const c = { ...o }; for (const k of keys) delete c[k]; return c; };
const run = (fn) => { try { return fn(); } catch (e) { return { threw: e.message }; } };
const WAYS = ["fixed-real", "percent", "guardrails", "vpw"];
const ORDERS = [["taxable", "deferred", "free"], ["deferred", "taxable", "free"], ["deferred", "free", "taxable"], ["free", "taxable", "deferred"]];
/** Every figure these changes could reach, for one plan, by what it is. */
function figures(plan) {
  const p = () => structuredClone(plan);
  const b = run(() => buildInputs(p(), { today: T }));
  const engine = {};
  if (b?.inputs) for (const way of WAYS) for (const o of ORDERS) engine[`${way} ${o.join(">")}`] = run(() => project({ ...b.inputs, strategy: way, withdrawalOrder: o }));
  return {
    inputs: b?.inputs ? without(b, ["inputs"]) : b,
    engine,
    projection: run(() => projection(p(), { today: T })),
    cashFlow: run(() => cashFlow(p(), { today: T })),
    order: without(run(() => order(p(), { today: T })), ["share", "five"]),
    ways: without(run(() => ways(p(), { today: T })), ["more"]),
    firstYear: run(() => firstYear(p(), { today: T })),
    wayOptions: run(() => wayOptions(p(), { today: T })),
    offers: run(() => offers(p(), { today: T })),
  };
}

test(`the plans: ${ALL.length}; none has the new field, and migrate adds none`, () => {
  assert.ok(ALL.length >= 40, `${ALL.length} plans`);
  for (const { name, plan } of ALL) {
    assert.equal(plan.retirement?.withdrawalSplit, undefined, `${name}: no split`);
    assert.ok(WAYS.includes(plan.retirement?.strategy ?? "fixed-real"), `${name}: one of the four ways`);
    assert.equal(JSON.stringify(migrate(structuredClone(plan))), JSON.stringify(plan), `${name}: migrate is settled`);
  }
});

test("with today's order and rule, every figure is the one the code gave before (154a597), byte for byte", () => {
  const now = Object.fromEntries(ALL.map(({ name, plan }) => [name, Object.fromEntries(Object.entries(figures(plan)).map(([k, v]) => [k, digest(v)]))]));
  if (process.env.PRINT) {
    fs.writeFileSync(FILE, `${JSON.stringify({ note: "digests of the retirement figures before the fifth withdrawal order and the named withdrawal rules (commit 154a597); tests/withdrawal-ways-invariance.test.mjs says how to write them again", plans: now }, null, 1)}\n`);
    return;
  }
  const was = JSON.parse(fs.readFileSync(FILE, "utf8")).plans;
  assert.deepEqual(Object.keys(now).sort(), Object.keys(was).sort(), "the same plans");
  let ran = 0;
  for (const [name, d] of Object.entries(now)) {
    for (const [k, v] of Object.entries(was[name])) assert.equal(d[k], v, `${name}: ${k}`);
    if (Object.keys(figures(ALL.find((x) => x.name === name).plan).engine).length) ran++;
  }
  assert.ok(ran >= 25, `${ran} plans run the engine`);
});

// tests/deferred-pay-invariance.test.mjs -- "Pay held for later" (gap list, next 60, item 30: deferred pay plans from work on
// Equity compensation, `equity.deferred`; their payouts counted by Will the money last? through `deferredIncomes` and the
// engine's `pretax` income lines) changes no figure of a plan that holds no deferred pay. Over every qa/fixtures/*-plan.mjs
// plan, the 14 households' base plans, the phone-built ones, the round 8 households (the equity couple among them), the empty
// plan and the family with each kind of stock pay (the pattern of tests/move-invariance.test.mjs):
//   - no plan holds deferred pay, and migrate adds none;
//   - Equity compensation's compute, the projection's inputs, the engine's run of the six ways in the plan's own tax setting
//     and in the federal brackets, the projection and Year by year (its rows) give, byte for byte, the very output they gave
//     before the change, checked by a digest per plan written down from the code before it (commit 7d9ca39).
//
// To write the digests down again after a deliberate change to these figures: PRINT=1 node --test tests/deferred-pay-invariance.test.mjs
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
import { familyPlan } from "../qa/fixtures/family-plan.mjs";
import { project } from "../core/math/retirement.js";
import { buildInputs, compute as projection, taxSettings, retirementUnknown } from "../modules/retirement/projection/compute.js";
import { compute as cashFlow } from "../modules/retirement/cash-flow/compute.js";
import { compute as equity } from "../modules/career/equity/compute.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const T = "2026-11-16";
const FILE = new URL("./deferred-pay-invariance.json", import.meta.url);
// the family with stock from work, as career/equity's own tests build it: units, both kinds of options, purchase-plan shares
const RSU = { id: "r", kind: "rsu", name: "New hire units", granted: "2025-01-15", vestStart: "2025-01-15", shares: 2400, vestMonths: 48, cliffMonths: 12, every: 3 };
const ISO = { id: "i", kind: "option", optionType: "iso", name: "Incentive options", granted: "2023-03-01", vestStart: "2023-03-01", shares: 4000, strike: 20, vestMonths: 48, cliffMonths: 12, every: 3 };
const NSO = { id: "n", kind: "option", name: "Options", granted: "2024-03-01", vestStart: "2024-03-01", shares: 1000, strike: 30, vestMonths: 48, cliffMonths: 12, every: 3 };
const LOT = { id: "e1", offeringDate: "2025-01-01", purchaseDate: "2025-06-30", shares: 100, fmvOffering: 40, fmvPurchase: 45, price: 34, discount: 0.15 };
const withEquity = (grants, espp = []) => { const p = familyPlan(T); p.equity = { symbol: "ACME", price: 50, priceAsOf: T, personId: "p-ana", grants, espp }; return p; };
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
  out.push({ name: "family with units, options and purchase-plan shares", plan: withEquity([RSU, ISO, NSO], [LOT]) });
  out.push({ name: "family with purchase-plan shares and no price", plan: (() => { const p = familyPlan(T); p.equity = { espp: [LOT] }; return p; })() });
  return out;
}
const ALL = (await plans()).map((x) => ({ ...x, plan: migrate(structuredClone(x.plan)) }));
const digest = (v) => crypto.createHash("sha256").update(JSON.stringify(v) ?? "undefined").digest("base64url").slice(0, 22);
const run = (fn) => { try { return fn(); } catch (e) { return { threw: e.message }; } };
// Whole-app sweep x3 (2026-11-16): for a plan with nothing saved for retirement and nothing going in, the retirement pages add
// `unknown`, the projection's own "We don't know yet" (retirementUnknown). Without that one field each output is what it was
// before; the field must be the projection's answer. The words those pages now say are pinned by tests/sweep-x3.test.mjs.
const sansUnknown = (v, u) => { if (!u || !v || typeof v !== "object" || !("unknown" in v)) return v; assert.deepEqual(v.unknown, u); const { unknown: _u, ...rest } = v; return rest; };
const WAYS = ["fixed-real", "percent", "guardrails", "vpw", "endowment", "ninety-five"];
/** Every figure the change could reach, for one plan, by what it is. */
function figures(plan) {
  const p = () => structuredClone(plan);
  const u = retirementUnknown(plan, { today: T });
  const b = run(() => buildInputs(p(), { today: T }));
  const engine = {}, brackets = {};
  if (b?.inputs) {
    const tax = taxSettings(p(), { mode: "brackets" });
    for (const way of WAYS) {
      engine[way] = run(() => project({ ...b.inputs, strategy: way }));
      brackets[way] = run(() => project({ ...b.inputs, strategy: way, tax }));
    }
  }
  return {
    equity: run(() => equity(p(), { today: T })),
    inputs: b,
    engine,
    brackets,
    projection: run(() => projection(p(), { today: T })),
    cashFlow: run(() => sansUnknown(cashFlow(p(), { today: T }), u)),
  };
}

test(`no plan holds deferred pay today, and migrate adds none: ${ALL.length} plans`, () => {
  assert.ok(ALL.length >= 40, `${ALL.length} plans`);
  for (const { name, plan } of ALL) assert.equal(plan.equity?.deferred, undefined, `${name}: no deferred pay`);
  assert.ok(ALL.filter(({ plan }) => plan.equity?.grants?.length || plan.equity?.espp?.length).length >= 3, "plans with stock from work are among them");
});

test("with no deferred pay, every figure is what it was before the change (digests from commit 7d9ca39)", () => {
  const now = {};
  for (const { name, plan } of ALL) { const f = figures(plan); now[name] = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, digest(v)])); }
  if (process.env.PRINT) {
    fs.writeFileSync(FILE, `${JSON.stringify({ note: "digests of Equity compensation's and the retirement figures before deferred pay (commit 7d9ca39); tests/deferred-pay-invariance.test.mjs says how to write them again", plans: now }, null, 1)}\n`);
    return;
  }
  const was = JSON.parse(fs.readFileSync(FILE, "utf8")).plans;
  assert.deepEqual(Object.keys(now).sort(), Object.keys(was).sort(), "the same plans");
  let compared = 0;
  for (const name of Object.keys(was)) for (const k of Object.keys(was[name])) { assert.equal(now[name][k], was[name][k], `${name}: ${k}`); compared++; }
  assert.ok(compared >= 40 * 6, `${compared} digests`);
});

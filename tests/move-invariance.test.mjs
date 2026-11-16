// tests/move-invariance.test.mjs -- "Move money between accounts" (gap list, next 60, item 26: a seventh kind of thing that will
// happen, `retirement.happenings[].kind: "move"`, and the engine's new `moves` hook in core/math/retirement.js) changes no figure
// of a plan that sets no move. Over every qa/fixtures/*-plan.mjs plan, the 14 households' base plans, the phone-built ones, the
// round 8 households and the empty plan (the pattern of tests/withdrawal-ways-invariance.test.mjs):
//   - no plan has a move, and migrate adds none;
//   - the projection's inputs, the engine's run of the six ways in the plan's own tax setting and in the federal brackets (so
//     the tax worked out on a sale and the extra 10% before 59½ run through the changed lines), a copy of the inputs, the
//     projection, Year by year (its rows) and the same with the other six kinds of happening set (so `apply` and `effects` run
//     their changed lines) give, byte for byte, the very output they gave before the change, checked by a digest per plan
//     written down from the code before it (commit 3c0b8a1).
//
// To write the digests down again after a deliberate change to these figures: PRINT=1 node --test tests/move-invariance.test.mjs
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
import { project, copyInputs } from "../core/math/retirement.js";
import { buildInputs, compute as projection, taxSettings, retirementUnknown } from "../modules/retirement/projection/compute.js";
import { compute as cashFlow } from "../modules/retirement/cash-flow/compute.js";
import { effects } from "../modules/retirement/happenings.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const T = "2026-11-15";
const FILE = new URL("./move-invariance.json", import.meta.url);
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
const WAYS = ["fixed-real", "percent", "guardrails", "vpw", "endowment", "ninety-five"];
/** The other six kinds, one of each the plan can hold (a home sale only with a home; working less for whoever still works). */
function withHappenings(plan) {
  const p = structuredClone(plan);
  const y = Number(T.slice(0, 4));
  const people = (p.household?.people ?? []).filter((x) => x.role !== "dependent" && x.birthDate);
  const list = [
    { id: "i1", kind: "in", name: "An inheritance", year: y + 6, amount: 80000 },
    { id: "i2", kind: "out", name: "A new roof", year: y + 9, amount: 30000 },
    { id: "i3", kind: "spend", year: y + 20, untilYear: y + 24, monthly: -400 },
  ];
  if (people[0]) list.push({ id: "i4", kind: "after", personId: people[0].id, year: Number(String(people[0].birthDate).slice(0, 4)) + 70, untilYear: Number(String(people[0].birthDate).slice(0, 4)) + 72, monthly: 1200 });
  if ((p.accounts ?? []).some((a) => a.type === "property")) list.push({ id: "i5", kind: "home", year: y + 15, buyFor: 0, rentMonthly: 1500 });
  p.retirement = { ...(p.retirement ?? {}), happenings: list };
  return p;
}
// Whole-app sweep x3 (2026-11-16): for a plan with nothing saved for retirement and nothing going in, the retirement pages add
// `unknown`, the projection's own "We don't know yet" (retirementUnknown). Without that one field each output is what it was
// before; the field must be the projection's answer. The words those pages now say are pinned by tests/sweep-x3.test.mjs.
const sansUnknown = (v, u) => { if (!u || !v || typeof v !== "object" || !("unknown" in v)) return v; assert.deepEqual(v.unknown, u); const { unknown: _u, ...rest } = v; return rest; };
/** Every figure the change could reach, for one plan, by what it is. */
function figures(plan) {
  const p = () => structuredClone(plan);
  const b = run(() => buildInputs(p(), { today: T }));
  const engine = {}, brackets = {};
  if (b?.inputs) {
    const tax = taxSettings(p(), { mode: "brackets" });
    for (const way of WAYS) {
      engine[way] = run(() => project({ ...b.inputs, strategy: way }));
      brackets[way] = run(() => project({ ...b.inputs, strategy: way, tax }));
    }
  }
  const h = withHappenings(plan);
  const hb = run(() => buildInputs(structuredClone(h), { today: T }));
  return {
    inputs: b,
    engine,
    brackets,
    copy: b?.inputs ? run(() => copyInputs(b.inputs)) : null,
    projection: run(() => projection(p(), { today: T })),
    cashFlow: run(() => sansUnknown(cashFlow(p(), { today: T }), retirementUnknown(plan, { today: T }))),
    hapInputs: hb,
    hapEngine: hb?.inputs ? run(() => project(hb.inputs)) : null,
    hapProjection: run(() => projection(structuredClone(h), { today: T })),
    hapCashFlow: run(() => sansUnknown(cashFlow(structuredClone(h), { today: T }), retirementUnknown(h, { today: T }))),
    hapEffects: run(() => effects(structuredClone(h), (q, params) => buildInputs(q, { today: T, ...params }).inputs ?? null, { today: T })),
  };
}

test(`no plan moves money between accounts today, and migrate adds none: ${ALL.length} plans`, () => {
  assert.ok(ALL.length >= 30, `${ALL.length} plans`);
  for (const { name, plan } of ALL) assert.ok(!(plan.retirement?.happenings ?? []).some((x) => x?.kind === "move"), `${name}: no move`);
});

test("with no move, every figure is what it was before the change (digests from commit 3c0b8a1)", () => {
  const now = {};
  for (const { name, plan } of ALL) { const f = figures(plan); now[name] = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, digest(v)])); }
  if (process.env.PRINT) {
    fs.writeFileSync(FILE, `${JSON.stringify({ note: "digests of the retirement figures before moving money between accounts (commit 3c0b8a1); tests/move-invariance.test.mjs says how to write them again", plans: now }, null, 1)}\n`);
    return;
  }
  const was = JSON.parse(fs.readFileSync(FILE, "utf8")).plans;
  assert.deepEqual(Object.keys(now).sort(), Object.keys(was).sort(), "the same plans");
  let compared = 0;
  for (const name of Object.keys(was)) for (const k of Object.keys(was[name])) { assert.equal(now[name][k], was[name][k], `${name}: ${k}`); compared++; }
  assert.ok(compared >= 30 * 11, `${compared} digests`);
});

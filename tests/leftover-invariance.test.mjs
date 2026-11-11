// tests/leftover-invariance.test.mjs -- the left-over answer (spec L4, `retirement.leftover`) changes no figure by being there: no
// module's compute reads it for one. (The one reader, in words only: retirement/projection leaves out its note "a typed leftover
// is not added" while `leftover.rowId` is set; claude-c's left2 merge B3, tests/left2-merge-items.test.mjs. None of these plans
// has a typed leftover, so nothing differs here.) For every qa/fixtures/*-plan.mjs plan, the 14 households' base plans and the five phone-built ones,
// migrate adds none, and every module's compute gives the same output with a "spend" answer as without one. An "invested"
// answer counts only through the ordinary contribution row it writes: the row with the answer beside it and the same row
// without it give the same output everywhere (pattern of tests/guesses-invariance.test.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";
import * as phone from "../qa/fixtures/phone-households.mjs";
import { applyLeftover } from "../modules/retirement/levers.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const T = "2026-11-11";
async function plans() {
  const out = [];
  const dir = path.join(ROOT, "qa", "fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) out.push({ name: `fixture ${f}:${name}`, plan: fn() });
  }
  for (const a of ARCHETYPES) out.push({ name: `${a.id}/base`, plan: a.build() });
  for (const [name, fn] of Object.entries(phone)) out.push({ name: `phone ${name}`, plan: fn(), phone: true });
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

test(`migrate adds no left-over answer, and no plan has one today: ${ALL.length} plans`, () => {
  assert.ok(ALL.length >= 30, `${ALL.length} plans`);
  for (const { name, plan } of ALL) {
    assert.equal(plan.retirement?.leftover, undefined, `${name}: none today`);
    assert.equal(migrate(structuredClone(plan)).retirement?.leftover, undefined, `${name}: migrate adds none`);
  }
});

test("every module's compute is the same with a 'spend' answer as without one, and with an 'invested' answer as with its row alone", async () => {
  const mods = await modules();
  assert.ok(mods.length >= 150, `${mods.length} modules`);
  let compared = 0;
  for (const { name, plan, phone: isPhone } of ALL) {
    const a = migrate(structuredClone(plan));
    const b = structuredClone(a); applyLeftover(b, { answer: "spend", monthly: 500, today: T });
    const pairs = [[a, b]];
    if (isPhone) {
      // the row an "invested" answer writes, with and without the answer beside it
      const row = structuredClone(a); applyLeftover(row, { answer: "invest", monthly: 500, amount: 480, newAccount: { id: "inv-new", name: "Investments for later", type: "brokerage" }, personId: "setup-self", today: T });
      const bare = structuredClone(row); delete bare.retirement.leftover;
      pairs.push([bare, row]);
    }
    for (const [x, y] of pairs) for (const [key, compute] of mods) { if (SIZE_ONLY.has(key)) continue; assert.equal(out(compute, y), out(compute, x), `${name}: ${key}`); compared++; }
  }
  assert.ok(compared >= 150 * 35, `${compared} comparisons`);
});

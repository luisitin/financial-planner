// tests/minimum-tax-invariance.test.mjs -- the alternative minimum tax for everyone (gap list, next 60, item 29: the Federal
// estimate's own return, modules/taxes/federal/minimum-tax.js, and core/math/tax.js `inputs.amt`) changes no figure for a
// plan that owes none and has typed no incentive-option spread. Over every qa/fixtures/*-plan.mjs plan, the 14 households'
// base plans, the phone-built ones and the empty plan (pattern of tests/happenings-invariance.test.mjs): no plan has the new
// field and migrate adds none; none owes the minimum tax; the Federal estimate's own return (known.js) is byte for byte what
// the code before gives (`MINIMUM_TAX.on = false`), its inputs never carry `amt`; and every module's compute that can reach
// the new step gives byte-identical output with the switch on and off (every such module on the four fixture plans; the tax
// pages on every plan). At build time the same was checked against a worktree at 7d9ca39 over every household and its
// variants (build log): 52,503 tax-page outputs on 1,419 plans and every module on the 33 base plans, none different.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";
import * as phone from "../qa/fixtures/phone-households.mjs";
import { known } from "../modules/taxes/federal/known.js";
import { MINIMUM_TAX, summary } from "../modules/taxes/federal/minimum-tax.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const T = "2026-11-16";
async function plans() {
  const out = [];
  const dir = path.join(ROOT, "qa", "fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) out.push({ name: `fixture ${f}:${name}`, plan: fn(T) });
  }
  for (const a of ARCHETYPES) out.push({ name: `${a.id}/base`, plan: a.build() });
  for (const [name, fn] of Object.entries(phone)) out.push({ name: `phone ${name}`, plan: fn(T) });
  out.push({ name: "empty plan", plan: emptyPlan() });
  return out;
}
const ALL = await plans();
const json = (fn) => { try { return JSON.stringify(fn()); } catch (e) { return `throws ${e.message}`; } };
/** fn() with the minimum tax off (the code before the design) and on: [off, on]. */
const both = (fn) => { MINIMUM_TAX.on = false; let off; try { off = json(fn); } finally { MINIMUM_TAX.on = true; } return [off, json(fn)]; };

test(`no plan has an incentive-option spread typed, migrate adds none, and none owes the minimum tax: ${ALL.length} plans`, () => {
  assert.ok(ALL.length >= 30, `${ALL.length} plans`);
  for (const { name, plan } of ALL) {
    for (const p of [plan, migrate(structuredClone(plan))]) assert.equal(p.taxes?.thisYear?.isoSpread, undefined, `${name}: none`);
    const k = known(migrate(structuredClone(plan)), { today: T });
    const s = summary(migrate(structuredClone(plan)), k);
    assert.ok(!s || s.amt < 0.5, `${name}: owes ${s?.amt}`);
    assert.equal(k.inputs.amt, undefined, `${name}: nothing put on the return`);
    assert.ok(!(k.inputs.separate ?? []).some((x) => x.amt), `${name}: nor on either separate return`);
    assert.equal(k.result.minimumTax, undefined, `${name}: the result keeps its shape`);
  }
});

test("the Federal estimate's own return is byte for byte the code before, for every plan", () => {
  for (const { name, plan } of ALL) {
    const p = migrate(structuredClone(plan));
    const [off, on] = both(() => known(structuredClone(p), { today: T }));
    assert.equal(on, off, `${name}: known()`);
  }
});

// the modules whose compute can reach the new step at all: those whose compute.js imports, directly or through other files,
// modules/taxes/federal/minimum-tax.js. Worked out from the files, so a new reader is picked up by itself.
function reaches(file, target, seen = new Map()) {
  if (file === target) return true;
  if (seen.has(file)) return seen.get(file);
  seen.set(file, false);   // a cycle back to here adds nothing
  let src = "";
  try { src = fs.readFileSync(file, "utf8"); } catch { return false; }
  const hit = [...src.matchAll(/(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g)].some((m) => reaches(path.resolve(path.dirname(file), m[1]), target, seen));
  seen.set(file, hit);
  return hit;
}
async function modules() {
  const target = path.join(ROOT, "modules", "taxes", "federal", "minimum-tax.js");
  const mods = [], all = [];
  for (const g of fs.readdirSync(path.join(ROOT, "modules"), { withFileTypes: true })) {
    if (!g.isDirectory() || g.name.startsWith("_")) continue;
    for (const m of fs.readdirSync(path.join(ROOT, "modules", g.name), { withFileTypes: true })) {
      const f = path.join(ROOT, "modules", g.name, m.name, "compute.js");
      // System > Diagnostics and Settings measure the saved plan's size, Change log and Backups stamp the time: not figures
      if (!m.isDirectory() || !fs.existsSync(f) || ["system/diagnostics", "system/settings", "system/audit", "system/backups"].includes(`${g.name}/${m.name}`)) continue;
      const entry = [`${g.name}/${m.name}`, (await import(pathToFileURL(f).href)).compute];
      all.push(entry);
      if (reaches(f, target, new Map())) mods.push(entry);   // a fresh map each: a cycle met half-way is never cached as "no"
    }
  }
  return { mods, all };
}
const { mods: MODS, all: ALL_MODS } = await modules();

test("every module's compute that can reach the minimum tax gives the same output with it on and off", () => {
  assert.ok(MODS.some(([k]) => k === "taxes/withholding") && MODS.some(([k]) => k === "career/equity") && MODS.some(([k]) => k === "reports/tax"), "the tax pages are among them");
  assert.ok(MODS.length >= 40, `${MODS.length} modules reach it`);
  // the four fixture plans the pages are judged on, every one of those modules
  const four = ALL.filter(({ name }) => /fixture (family|renter-debt|retired-couple|retirement)-plan/.test(name));
  assert.ok(four.length >= 4, `${four.length} plans`);
  let compared = 0;
  for (const { name, plan } of four) {
    const p = migrate(structuredClone(plan));
    for (const [key, compute] of MODS) { const [off, on] = both(() => compute(structuredClone(p), { today: T })); assert.equal(on, off, `${name}: ${key}`); compared++; }
  }
  assert.ok(compared >= 40 * 4, `${compared} comparisons`);
});

test("the tax pages give the same output with it on and off on every plan", () => {
  // every tax page, whether or not it reaches the step (the answer keys' own return, taxes/federal's compute, does not)
  const tax = ALL_MODS.filter(([k]) => /^taxes\/|^career\/equity$|^reports\/tax$|^investments\/employer-stock$/.test(k));
  assert.ok(tax.length >= 13, `${tax.length} tax pages`);
  for (const { name, plan } of ALL) {
    const p = migrate(structuredClone(plan));
    for (const [key, compute] of tax) { const [off, on] = both(() => compute(structuredClone(p), { today: T })); assert.equal(on, off, `${name}: ${key}`); }
  }
});

test("Equity compensation's one change (the deduction for 65 and over added back) cannot move a figure here: no plan has incentive options and someone 65 or over", () => {
  for (const { name, plan } of ALL) {
    const isos = (plan.equity?.grants ?? []).some((g) => g?.optionType === "iso");
    const old = (plan.household?.people ?? []).some((x) => x.role !== "dependent" && x.birthDate && 2026 - Number(String(x.birthDate).slice(0, 4)) >= 65);
    assert.ok(!(isos && old), name);
  }
});

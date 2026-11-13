// tests/health-growth-invariance.test.mjs -- "Health costs rise" on Assumptions (gap design #10: `assumptions.healthGrowth`)
// changes no figure until a person chooses it. For every qa/fixtures/*-plan.mjs plan, the households' base plans, the
// phone-built ones and the empty plan: no plan has the field and migrate adds none; the three computes that read it
// (Before Medicare, Medicare at 65, the projection's health line) and Assumptions' own give byte-identical output with the
// field absent, zero, null or blank; and every module whose compute can reach one of those readers gives the same output for
// "with prices" stored as 0 as for the field absent, over the four fixture plans the pages are judged on (the pattern of
// tests/happenings-invariance.test.mjs). That the output is also what it was BEFORE the field existed was checked once at
// build, base tree against this one (modules/system/assumptions/README.md, "Health costs that rise faster than prices").
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";
import * as phone from "../qa/fixtures/phone-households.mjs";
import { buildInputs, compute as projection } from "../modules/retirement/projection/compute.js";
import { compute as healthcare } from "../modules/retirement/healthcare/compute.js";
import { compute as medicare } from "../modules/retirement/medicare/compute.js";
import { compute as assumptions, healthGrowthOf, healthFactor } from "../modules/system/assumptions/compute.js";

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
  for (const [name, fn] of Object.entries(phone)) if (typeof fn === "function") out.push({ name: `phone ${name}`, plan: fn() });
  out.push({ name: "empty plan", plan: emptyPlan() });
  return out;
}
const ALL = await plans();
const out = (compute, plan) => { try { return JSON.stringify(compute(structuredClone(plan), { today: T })); } catch (e) { return `throws ${e.message}`; } };
const withValue = (plan, v) => { const b = structuredClone(plan); b.assumptions = { ...(b.assumptions ?? {}), healthGrowth: v }; return b; };

test(`no plan has the choice today, and migrate adds none: ${ALL.length} plans`, () => {
  assert.ok(ALL.length >= 30, `${ALL.length} plans`);
  for (const { name, plan } of ALL) for (const p of [plan, migrate(structuredClone(plan))]) {
    assert.equal(p.assumptions?.healthGrowth, undefined, `${name}: none`);
    assert.equal(healthGrowthOf(p), 0, name);
  }
});

test("with prices the factor is exactly 1 for every year, so a product with it is the same number to the last bit", () => {
  for (let y = 1990; y <= 2130; y++) assert.equal(healthFactor(0, y, 2026), 1);
  for (const x of [202.9, 38.99, 194, 5230.68, 33721.123456789, 1 / 3]) assert.equal(x * 12 * healthFactor(0, 2060, 2026), x * 12);
});

test("the readers: Before Medicare, Medicare at 65, the projection (its inputs and its answer) and Assumptions are byte-identical with the field absent, 0, null or blank, for every plan", () => {
  let ran = 0, priced = 0;
  for (const { name, plan } of ALL) {
    const a = migrate(structuredClone(plan));
    const base = { hc: out(healthcare, a), md: out(medicare, a), pr: out(projection, a), as: out(assumptions, a), bi: JSON.stringify(buildInputs(a, { today: T })) };
    assert.doesNotMatch(base.hc + base.md + base.as, /"healthGrowth"/, `${name}: nothing new is returned`);
    assert.doesNotMatch(base.bi, /"growth":/, `${name}: nothing new on the health line`);
    for (const v of [0, null, ""]) {
      const b = withValue(a, v);
      assert.equal(out(healthcare, b), base.hc, `${name}: retirement/healthcare with ${JSON.stringify(v)}`);
      assert.equal(out(medicare, b), base.md, `${name}: retirement/medicare with ${JSON.stringify(v)}`);
      assert.equal(out(projection, b), base.pr, `${name}: retirement/projection with ${JSON.stringify(v)}`);
      assert.equal(out(assumptions, b), base.as, `${name}: system/assumptions with ${JSON.stringify(v)}`);
      assert.equal(JSON.stringify(buildInputs(b, { today: T })), base.bi, `${name}: buildInputs with ${JSON.stringify(v)}`);
    }
    ran++;
    // and it is not a dead switch: where the plan prices health cover, one point faster moves it
    const h0 = buildInputs(a, { today: T }).health?.total ?? 0;
    if (h0 > 0) { assert.ok(buildInputs(withValue(a, 0.01), { today: T }).health.total > h0, `${name}: one point faster costs more`); priced++; }
  }
  assert.ok(ran >= 30 && priced >= 10, `${ran} plans, ${priced} with a health line`);
});

// the modules whose compute can reach a reader of the field: worked out from the files, so a new reader is picked up by itself
function reaches(file, targets, seen = new Map()) {
  if (targets.has(file)) return true;
  if (seen.has(file)) return seen.get(file);
  seen.set(file, false);   // a cycle back to here adds nothing
  let src = "";
  try { src = fs.readFileSync(file, "utf8"); } catch { return false; }
  const hit = [...src.matchAll(/(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g)].some((m) => reaches(path.resolve(path.dirname(file), m[1]), targets, seen));
  seen.set(file, hit);
  return hit;
}
// System > Diagnostics and Settings measure the saved plan's size (a stored 0 is a field more), and Backups and the audit
// line read the clock: none of them reads the figure
const NOT_FIGURES = new Set(["system/diagnostics", "system/settings", "system/backups", "system/audit"]);

test("every module's compute that can reach a reader of the field is the same with 'with prices' stored as 0 as with the field absent", async () => {
  const targets = new Set(["retirement/healthcare", "retirement/medicare", "retirement/projection", "system/assumptions"].map((k) => path.join(ROOT, "modules", k, "compute.js")));
  const mods = [], seen = new Map();
  for (const g of fs.readdirSync(path.join(ROOT, "modules"), { withFileTypes: true })) {
    if (!g.isDirectory() || g.name.startsWith("_")) continue;
    for (const m of fs.readdirSync(path.join(ROOT, "modules", g.name), { withFileTypes: true })) {
      const f = path.join(ROOT, "modules", g.name, m.name, "compute.js"), key = `${g.name}/${m.name}`;
      if (m.isDirectory() && fs.existsSync(f) && !NOT_FIGURES.has(key) && reaches(f, targets, seen)) mods.push([key, (await import(pathToFileURL(f).href)).compute]);
    }
  }
  assert.ok(mods.length >= 40, `${mods.length} modules reach a reader`);
  assert.ok(["retirement/monte-carlo", "retirement/roth-conversions", "overview/dashboard"].every((k) => mods.some(([m]) => m === k)), "the pages that start from the projection are among them");
  const four = ALL.filter(({ name }) => /fixture (family|renter-debt|retired-couple|retirement)-plan/.test(name));
  assert.ok(four.length >= 4, `${four.length} plans`);
  let compared = 0;
  for (const { name, plan } of four) {
    const a = migrate(structuredClone(plan)), b = withValue(a, 0);
    for (const [key, compute] of mods) { assert.equal(out(compute, b), out(compute, a), `${name}: ${key}`); compared++; }
  }
  assert.ok(compared >= 40 * 4, `${compared} comparisons`);
});

test("the rate's file reads leaves only: nothing Assumptions' compute imports leads back to a page that reads it at load", () => {
  // the browser loads pages in any order; a file the projection imports that itself reaches the projection makes that order
  // matter ("Cannot access ... before initialization")
  const file = path.join(ROOT, "modules", "system", "assumptions", "compute.js");
  const back = new Set(["retirement/healthcare", "retirement/medicare", "retirement/projection"].map((k) => path.join(ROOT, "modules", k, "compute.js")));
  const imports = [...fs.readFileSync(file, "utf8").matchAll(/from\s*["'](\.{1,2}\/[^"']+)["']/g)].map((m) => path.resolve(path.dirname(file), m[1]));
  assert.ok(imports.length >= 1);
  for (const f of imports) assert.equal(reaches(f, back), false, `${path.relative(ROOT, f)} leads back`);
});

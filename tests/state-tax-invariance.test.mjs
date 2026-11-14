// tests/state-tax-invariance.test.mjs -- state income tax by brackets (gap design #40) changes no figure for a state the app
// has no brackets for, nor where the person typed a figure on the State page. Over every qa/fixtures/*-plan.mjs plan, the 14
// households' base plans, the phone-built ones and the empty plan (pattern of tests/happenings-invariance.test.mjs): the
// month's taxes (cashflow/budget-percent yearTaxes) and Tax, year by year (taxes/projection) give byte-identical output
// with the new path on and off (`brackets: false`, `stateBrackets: false` are the code before #40), for each plan's own state
// when it has no rules and for the plan moved to states that have none; and only those two computes read the new table, so
// every other compute follows from them. The design adds no field to the plan (it has no input), so there is none to leave out.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";
import * as phone from "../qa/fixtures/phone-households.mjs";
import { yearTaxes } from "../modules/cashflow/budget-percent/compute.js";
import { compute as projection } from "../modules/taxes/projection/compute.js";
import { hasRules } from "../core/math/state-tax.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const T = "2026-11-13";
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
const same = (name, plan) => {
  const p = migrate(structuredClone(plan));
  const tax = (o) => { try { return JSON.stringify(yearTaxes(structuredClone(p), { today: T, ...o })); } catch (e) { return `throws ${e.message}`; } };
  const proj = (o) => { try { return JSON.stringify(projection(structuredClone(p), { today: T, ...o })); } catch (e) { return `throws ${e.message}`; } };
  assert.equal(tax({}), tax({ brackets: false }), `${name}: the month's taxes`);
  assert.equal(proj({}), proj({ stateBrackets: false }), `${name}: Tax, year by year`);
  assert.equal(proj({ real: false }), proj({ real: false, stateBrackets: false }), `${name}: Tax, year by year in each year's dollars`);
};

test(`a plan in a state with no brackets in the app gives exactly today's answer: ${ALL.length} plans`, () => {
  assert.ok(ALL.length >= 30, `${ALL.length} plans`);
  let ran = 0;
  for (const { name, plan } of ALL) if (!hasRules(plan.household?.state)) { same(name, plan); ran++; }
  assert.ok(ran >= 18, `${ran} plans outside the table`);
});

test("every plan moved to Ohio, Pennsylvania, Oregon or no state gives exactly today's answer", () => {
  for (const { name, plan } of ALL) for (const code of ["OH", "PA", "OR", ""]) {
    const p = structuredClone(plan); p.household = { ...(p.household ?? {}), state: code };
    same(`${name} in ${code || "no state"}`, p);
  }
});

test("in a state with brackets, a rate or last year's return typed on the State page wins: the month's taxes are as before", () => {
  for (const { name, plan } of ALL) for (const [code, s] of [["CA", { rate: 0.06 }], ["NY", { priorTax: 3000, priorAgi: 90000 }], ["IL", { deduction: 4000 }]]) {
    const p = migrate(structuredClone(plan)); p.household = { ...(p.household ?? {}), state: code }; p.taxes = { ...(p.taxes ?? {}), state: s };
    const a = JSON.stringify(yearTaxes(structuredClone(p), { today: T })), b = JSON.stringify(yearTaxes(structuredClone(p), { today: T, brackets: false }));
    assert.equal(a, b, `${name} in ${code} with ${JSON.stringify(s)}`);
  }
});

test("only the month's taxes and Tax, year by year read the state table, so every other compute follows from them", () => {
  const readers = [];
  const walk = (dir) => { for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel);
    else if (e.name.endsWith(".js") && /state-tax\.js["']/.test(fs.readFileSync(path.join(ROOT, rel), "utf8"))) readers.push(rel);
  } };
  walk("modules"); walk("core");
  assert.deepEqual(readers.sort(), ["modules/cashflow/budget-percent/compute.js", "modules/taxes/projection/compute.js"]);
});


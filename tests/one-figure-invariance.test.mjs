// tests/one-figure-invariance.test.mjs -- "One figure or item by item" (gap list, next 60, item 11: on Net worth and Income,
// a kind of account or of income kept as one figure, `accounts[].oneFigure` and `income[].oneFigure`) changes no figure and
// no page of a plan where nobody chose it. Over every qa/fixtures/*-plan.mjs plan, the 14 households' base plans, the
// phone-built ones, the round 8 households, the four Get started personas and the empty plan:
//   - no plan holds the mark, and migrate adds none;
//   - Net worth's and Income's compute, rent after costs, Paycheck's take-home and its compute, the Federal estimate, the
//     retirement plan's inputs and its projection give, byte for byte, the very output they gave before the change;
//   - the two pages, drawn, say the very words they said before, for every plan where no kind of account or income can be
//     put together (on the others, the one new quiet row is the only addition: tested in the pages' own tests);
// checked by a digest per plan written down from the code before it (commit a491122).
//
// To write the digests down again after a deliberate change to these figures: PRINT=1 node --test tests/one-figure-invariance.test.mjs
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
import { renderPage } from "../qa/fixtures/fake-dom.mjs";
import { compute as netWorth } from "../modules/balance/net-worth/compute.js";
import { compute as income, rentAfterCostsOf } from "../modules/cashflow/income/compute.js";
import { compute as paycheck, takeHome } from "../modules/cashflow/paycheck/compute.js";
import { compute as federal } from "../modules/taxes/federal/compute.js";
import { buildInputs, compute as projection } from "../modules/retirement/projection/compute.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const T = "2026-11-16";
const FILE = new URL("./one-figure-invariance.json", import.meta.url);
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
  return out;
}
const ALL = (await plans()).map((x) => ({ ...x, plan: migrate(structuredClone(x.plan)) }));
const digest = (v) => crypto.createHash("sha256").update(JSON.stringify(v, (k, x) => (x instanceof Map ? [...x] : x)) ?? "undefined").digest("base64url").slice(0, 22);
const run = (fn) => { try { return fn(); } catch (e) { return { threw: e.message }; } };
/** Every figure the change could reach, for one plan, by what it is. */
function figures(plan) {
  const p = () => structuredClone(plan);
  return {
    netWorth: run(() => netWorth(p(), { today: T })),
    income: run(() => income(p(), { today: T })),
    rent: run(() => rentAfterCostsOf(p(), { today: T })),
    takeHome: run(() => takeHome(p(), { today: T })),
    paycheck: run(() => paycheck(p(), { today: T })),
    federal: run(() => federal(p(), { today: T })),
    inputs: run(() => buildInputs(p(), { today: T })),
    projection: run(() => projection(p(), { today: T })),
  };
}
const NW = new URL("../modules/balance/net-worth/view.js", import.meta.url).href;
const INC = new URL("../modules/cashflow/income/view.js", import.meta.url).href;
async function pages(plan) {
  const nw = await renderPage(NW, plan, T, { computeOf: { "balance/net-worth": netWorth } });
  const inc = await renderPage(INC, plan, T);
  return { netWorthPage: nw.text(), incomePage: inc.text() };
}

test(`no plan holds the one-figure mark today, and migrate adds none: ${ALL.length} plans`, () => {
  assert.ok(ALL.length >= 45, `${ALL.length} plans`);
  for (const { name, plan } of ALL) {
    assert.ok(!(plan.accounts ?? []).some((a) => "oneFigure" in a), `${name}: no account marked`);
    assert.ok(!(plan.income ?? []).some((x) => "oneFigure" in x), `${name}: no income marked`);
  }
});

test("with no one-figure mark, every figure and both pages are what they were before the change (digests from commit a491122)", async () => {
  const now = {};
  for (const { name, plan } of ALL) {
    const f = figures(plan);
    const pg = await pages(plan);
    now[name] = Object.fromEntries([...Object.entries(f), ...Object.entries(pg)].map(([k, v]) => [k, digest(v)]));
  }
  if (process.env.PRINT) {
    fs.writeFileSync(FILE, `${JSON.stringify({ note: "digests of Net worth's, Income's, Paycheck's, the Federal estimate's and the retirement figures, and of the Net worth and Income pages' words, before One figure or item by item (commit a491122); tests/one-figure-invariance.test.mjs says how to write them again", plans: now }, null, 1)}\n`);
    return;
  }
  const was = JSON.parse(fs.readFileSync(FILE, "utf8")).plans;
  assert.deepEqual(Object.keys(now).sort(), Object.keys(was).sort(), "the same plans");
  // the pages may differ only where a kind can be put together (the one new quiet row): the list is the pages' own tests'
  const { sectionsOf } = await import("../modules/balance/net-worth/one-figure.js").catch(() => ({ sectionsOf: null }));
  const { sectionsOf: incomeSections } = await import("../modules/cashflow/income/one-figure.js").catch(() => ({ sectionsOf: null }));
  let compared = 0, pagesSkipped = 0;
  for (const name of Object.keys(was)) {
    const plan = ALL.find((x) => x.name === name).plan;
    for (const k of Object.keys(was[name])) {
      if (k === "netWorthPage" && sectionsOf?.(plan, { today: T }).some((s) => s.changes)) { pagesSkipped++; continue; }
      if (k === "incomePage" && incomeSections?.(plan, { today: T }).some((s) => s.changes)) { pagesSkipped++; continue; }
      assert.equal(now[name][k], was[name][k], `${name}: ${k}`);
      compared++;
    }
  }
  assert.ok(compared >= 45 * 10 - pagesSkipped, `${compared} digests`);
  assert.ok(pagesSkipped <= 4, `${pagesSkipped} pages with a kind that can be put together`);
});

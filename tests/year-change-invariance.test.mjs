// tests/year-change-invariance.test.mjs -- "Change this year" on Year by year (gap list, next 60, item 32: tap a year's row,
// spend more or less that year only, money in or out once, each saved as the matching thing that will happen) changes no
// figure and no row of a plan where nothing was changed. Over every qa/fixtures/*-plan.mjs plan, the 14 households' base plans,
// the phone-built ones, the round 8 households and the empty plan (the pattern of tests/move-invariance.test.mjs):
//   - no plan holds a one-year change today, so nothing new is drawn on any row;
//   - Year by year's compute (today's dollars and each year's dollars), the projection's compute, the answer of Will the money
//     last? (levers.js answerOf), and the page as a phone draws it (the hero and every year's record, word for word) give,
//     byte for byte, the very output they gave before the change, checked by a digest per plan written down from the code
//     before it (commit dca545e).
//
// To write the digests down again after a deliberate change to these figures: PRINT=1 node --test tests/year-change-invariance.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderPage, textOf } from "../qa/fixtures/fake-dom.mjs";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";
import * as phone from "../qa/fixtures/phone-households.mjs";
import * as round8 from "../qa/fixtures/round8-households.mjs";
import { compute as projection } from "../modules/retirement/projection/compute.js";
import { compute as cashFlow } from "../modules/retirement/cash-flow/compute.js";
import { answerOf } from "../modules/retirement/levers.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const T = "2026-11-16";
const FILE = new URL("./year-change-invariance.json", import.meta.url);
const VIEW = new URL("../modules/retirement/cash-flow/view.js", import.meta.url).href;
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
/** The page as a phone reads it: the hero, and every year's record (the list under the table), word for word. */
async function page(plan) {
  try {
    const r = await renderPage(VIEW, structuredClone(plan), T);
    const hero = r.root.querySelector(".hero");
    const list = r.root.all().find((e) => e.tagName === "UL" && /\brecords\b/.test(e.className)) ?? null;
    return { hero: textOf(hero), rows: list ? list.children.map((li) => textOf(li)) : null };
  } catch (e) { return { threw: e.message }; }
}
async function figures(plan) {
  const p = () => structuredClone(plan);
  return {
    cashFlow: run(() => cashFlow(p(), { today: T })),
    cashFlowNominal: run(() => cashFlow(p(), { today: T, real: false })),
    projection: run(() => projection(p(), { today: T })),
    answer: run(() => answerOf(p(), { today: T })),
    page: await page(plan),
  };
}

test(`no plan holds a change of one year today: ${ALL.length} plans`, () => {
  assert.ok(ALL.length >= 30, `${ALL.length} plans`);
  const oneYear = (h) => h && (h.kind === "in" || h.kind === "out" || (h.kind === "spend" && Number(h.untilYear) === h.year));
  for (const { name, plan } of ALL) assert.ok(!(plan.retirement?.happenings ?? []).some(oneYear), `${name}: no one-year change`);
});

test("with nothing changed, every figure and every row is what it was before the change (digests from commit dca545e)", async () => {
  const now = {};
  for (const { name, plan } of ALL) { const f = await figures(plan); now[name] = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, digest(v)])); }
  if (process.env.PRINT) {
    fs.writeFileSync(FILE, `${JSON.stringify({ note: "digests of Year by year, the projection and its answer before 'Change this year' (commit dca545e); tests/year-change-invariance.test.mjs says how to write them again", plans: now }, null, 1)}\n`);
    return;
  }
  const was = JSON.parse(fs.readFileSync(FILE, "utf8")).plans;
  assert.deepEqual(Object.keys(now).sort(), Object.keys(was).sort(), "the same plans");
  let compared = 0;
  for (const name of Object.keys(was)) for (const k of Object.keys(was[name])) { assert.equal(now[name][k], was[name][k], `${name}: ${k}`); compared++; }
  assert.ok(compared >= 30 * 5, `${compared} digests`);
});

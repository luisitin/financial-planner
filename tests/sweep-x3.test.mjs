// tests/sweep-x3.test.mjs -- the whole-app phone sweep x3 (2026-11-16): every usable page at 390 px for the empty plan and the
// invented households, and what it found on claude-b's pages, each pinned by a test that would have caught it at ce79d70.
//
// 1. The retirement answer said two ways. For a plan with nothing saved for retirement and nothing going in (renterDebt: Riley,
//    24, an empty 401(k); sam: nothing said about savings), Will the money last?, Goal seek and What matters most say "We don't
//    know yet" while twelve pages said the money "runs out at 65". The shared gate is retirement/projection's retirementUnknown.
// The pages are drawn as the shell draws them (qa/first-view-lib: the real UI kit on the stand-in DOM, the clock held at its TODAY).
import { test } from "node:test";
import assert from "node:assert/strict";
import { retirementUnknown, unknownWords, nothingSaved, compute as projection, savingsUnknown } from "../modules/retirement/projection/compute.js";
import { nothingSaved as goalSeekNothingSaved } from "../modules/scenarios/goal-seek/compute.js";
import { migrate } from "../core/schema/migrate.js";
import { familyPlan } from "../qa/fixtures/family-plan.mjs";
import { renterDebtPlan } from "../qa/fixtures/renter-debt-plan.mjs";
import { retiredCouplePlan } from "../qa/fixtures/retired-couple-plan.mjs";
import * as personas from "../qa/fixtures/setup-personas.mjs";

const T = "2026-11-13";   // qa/first-view-lib's held TODAY
const sam = () => migrate(personas.finishSetup("sam", personas.sam(T), T));
const rd = () => migrate(renterDebtPlan());
const fam = () => migrate(familyPlan(T));

// ---- the page as a person meets it: its text, outside nothing (every fold's words included, as a reader who opens them)
const textOf = (el) => (el.data !== undefined && !el.tagName ? el.data : el.tagName === "STYLE" ? "" : (el.childNodes ?? []).map(textOf).join(" ")).replace(/\s+/g, " ");
const filledOf = (root) => { const out = []; const walk = (n) => { if (n.tagName && /\bbtn\b/.test(String(n.className ?? "")) && !/\b(secondary|chip|ghost|link)\b/.test(String(n.className ?? ""))) out.push(textOf(n).trim()); for (const c of n.childNodes ?? []) walk(c); }; walk(root); return out; };
let L = null;
async function drawn(key, plan) {
  L = L ?? await import("../qa/first-view-lib.mjs");
  const app = await L.loadApp();
  app.plans.x3 = migrate(structuredClone(plan));
  const d = await L.draw(key, "x3");
  assert.ok(!d.error, `${key}: ${d.error}`);
  return { root: d.root, text: textOf(d.root), filled: filledOf(d.root) };
}
const RUNS_OUT = /runs? out|ran out|runs short|run short|money does not last/i;

// ---- the gate and its words ------------------------------------------------------------------------------------------------
test("retirementUnknown: nothing saved and nothing going in, retirement ahead -> the two cases; any other plan -> null", () => {
  assert.deepEqual(retirementUnknown(rd(), { today: T }), { nothingSaved: true }, "Riley's empty Work 401(k) says it: nothing is saved");
  assert.deepEqual(retirementUnknown(sam(), { today: T }), { nothingSaved: false }, "Sam said nothing about retirement savings");
  assert.equal(retirementUnknown(fam(), { today: T }), null);
  assert.equal(retirementUnknown(migrate(retiredCouplePlan(T)), { today: T }), null, "a retired couple: retirement is not ahead");
  assert.equal(retirementUnknown(migrate({}), { today: T }), null, "the empty plan cannot be run at all");
  // one dollar invested, or a dollar a month going in, is an answer
  const one = rd(); one.accounts.find((a) => a.type === "401k").balance = 1;
  assert.equal(retirementUnknown(one, { today: T }), null);
  // the gate is the projection page's own, so the two can never disagree
  for (const p of [rd(), sam(), fam()]) assert.equal(!!retirementUnknown(p, { today: T }), !!retirementUnknownFromPage(p));
});
const retirementUnknownFromPage = (p) => savingsUnknown(projection(p, { today: T }));

test("nothingSaved moved to the projection; Goal seek re-exports the same function", () => {
  assert.equal(goalSeekNothingSaved, nothingSaved);
  assert.equal(nothingSaved(rd()), true);
  assert.equal(nothingSaved(sam()), false);
});

test("unknownWords: one sentence per case, the page's own question inside it, short and with one 'yet' (fix round, critics P3 and P4)", () => {
  assert.equal(unknownWords({ nothingSaved: true }, "the chance the money lasts"),
    "Nothing is saved for retirement, so we can't say the chance the money lasts yet. Once you start saving, add it and we can answer.");
  assert.equal(unknownWords({ nothingSaved: false }, "the chance the money lasts"),
    "You haven't told us about retirement savings, so we can't say the chance the money lasts yet. Add what you own and we can answer.");
  // the long sentence said word for word on twelve pages, and "yet" twice, are gone (critic P3: "That is common; once something is
  // saved or goes in each paycheck, add it and come back."; P4: "Nothing is saved for retirement yet, ... we can't say ... yet")
  for (const n of [true, false]) {
    const w = unknownWords({ nothingSaved: n }, "whether the money lasts");
    assert.equal(w.match(/\byet\b/g).length, 1, w);
    assert.doesNotMatch(w, /That is common|come back/);
    assert.ok(w.split(/\s+/).length <= 24, `${w.split(/\s+/).length} words`);
  }
});

test("Goal seek and What matters most say the same words as the twelve pages (one sentence, unknownWords)", async () => {
  const { renderPage } = await import("../qa/fixtures/fake-dom.mjs");
  const cases = [["scenarios/goal-seek", "what it would take", { only: ["spending"] }], ["scenarios/sensitivity", "which of your numbers change the answer most", {}]];
  for (const [key, what, extra] of cases) {
    const { compute } = await import(`../modules/${key}/compute.js`);
    const live = { [key]: (plan, params) => compute(plan, { ...params, ...extra }) };
    for (const [plan, nothing] of [[rd(), true], [(() => { const u = rd(); u.accounts = u.accounts.filter((a) => a.type !== "401k"); return u; })(), false]]) {
      const r = await renderPage(new URL(`../modules/${key}/view.js`, import.meta.url), plan, T, { computeRemote: live });
      assert.ok(r.text().includes(unknownWords({ nothingSaved: nothing }, what)), `${key}, nothing saved ${nothing}: ${r.text().slice(0, 400)}`);
    }
  }
});

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

// ---- each page, drawn for Riley (nothing saved) and Sam (nothing said), and for the family (the answer as before) --------------
async function saysUnknown(key, what, { title = null } = {}) {
  for (const [who, plan, words] of [["renterDebt", rd(), unknownWords({ nothingSaved: true }, what)], ["sam", sam(), unknownWords({ nothingSaved: false }, what)]]) {
    const r = await drawn(key, plan);
    assert.ok(r.text.includes(words), `${key} for ${who}: the page's own "we can't say yet" sentence\n${r.text.slice(0, 600)}`);
    assert.doesNotMatch(r.text, RUNS_OUT, `${key} for ${who}: never "runs out" beside Will the money last?'s "We don't know yet"`);
    assert.ok(r.filled.includes("Add what you own ›"), `${key} for ${who}: the way on is the one filled link (${r.filled})`);
    assert.equal(r.filled.length, 1, `${key} for ${who}: one filled button (${r.filled})`);
    if (title) assert.ok(r.text.includes(title), `${key}: its title stays`);
  }
}

test("If history repeated: nothing saved -> the page's own we-can't-say-yet sentence, no '0 of 27'; the family's answer unchanged", async () => {
  const { UNKNOWN_WHAT } = await import("../modules/retirement/historical/view.js");
  await saysUnknown("retirement/historical", UNKNOWN_WHAT, { title: "If history repeated itself" });
  const r = await drawn("retirement/historical", rd());
  assert.doesNotMatch(r.text, /0 of 27|nothing left to chart/);
  const f = await drawn("retirement/historical", fam());
  assert.match(f.text, /start years since 1928 in which the money lasts to the end/);
  assert.doesNotMatch(f.text, /can't say/);
});

test("Chance the money lasts: nothing saved -> the page's own we-can't-say-yet sentence, no '0 of 100'; the family's answer unchanged", async () => {
  const { UNKNOWN_WHAT } = await import("../modules/retirement/monte-carlo/view.js");
  await saysUnknown("retirement/monte-carlo", UNKNOWN_WHAT, { title: "Chance the money lasts" });
  const r = await drawn("retirement/monte-carlo", rd());
  assert.doesNotMatch(r.text, /0 of 100|Weak/);
  const f = await drawn("retirement/monte-carlo", fam());
  assert.match(f.text, /pretend futures where the money lasts/);
  assert.doesNotMatch(f.text, /can't say/);
});

test("How much to take out: nothing saved -> the page's own we-can't-say-yet sentence, no 'runs out at 65'; the family's answer unchanged", async () => {
  const { UNKNOWN_WHAT } = await import("../modules/retirement/withdrawal-strategy/view.js");
  await saysUnknown("retirement/withdrawal-strategy", UNKNOWN_WHAT, { title: "How much to take out each year" });
  const f = await drawn("retirement/withdrawal-strategy", fam());
  assert.match(f.text, /about \$[\d,]+ a month/);
  assert.doesNotMatch(f.text, /can't say/);
});

test("Order of returns: nothing saved -> the page's own we-can't-say-yet sentence, no 'runs out at 65' rows; the family's rows unchanged", async () => {
  const { UNKNOWN_WHAT } = await import("../modules/retirement/sequence-risk/view.js");
  await saysUnknown("retirement/sequence-risk", UNKNOWN_WHAT, { title: "Why the order of returns matters" });
  const f = await drawn("retirement/sequence-risk", fam());
  assert.match(f.text, /Same years, three orders/);
  assert.doesNotMatch(f.text, /can't say/);
});

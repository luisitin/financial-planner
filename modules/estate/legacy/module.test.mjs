import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, legacyTarget } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const withLegacy = (legacy) => { const p = familyPlan(TODAY); p.estate.legacy = legacy; return p; };
const BEQ = [{ id: "a", to: "Cy", kind: "person", amount: 900000 }, { id: "b", to: "Food bank", kind: "charity", amount: 50000 }];

test("the target: the bequests' total, less the home when it is part of the legacy", () => {
  assert.deepEqual(legacyTarget(emptyPlan()), { total: 0, home: 0, target: 0 });
  assert.deepEqual(legacyTarget(withLegacy({ bequests: BEQ })), { total: 950000, home: 0, target: 950000 });
  assert.deepEqual(legacyTarget(withLegacy({ bequests: BEQ, includeHome: true })), { total: 950000, home: 380000, target: 570000 });
  assert.equal(legacyTarget(withLegacy({ bequests: [{ id: "a", to: "Cy", amount: 100000 }], includeHome: true })).target, 0, "never below zero");
});

test("nothing to leave: no goal-seek run", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.equal(d.total, 0); assert.equal(d.levers, null); assert.equal(d.meets, true);
});

test("the family's legacy: shares, by kind, checked against the plan's end and solved by goal seek", () => {
  const d = compute(withLegacy({ bequests: BEQ, includeHome: true }), { today: TODAY });
  assert.equal(d.people, 900000); assert.equal(d.charity, 50000); assert.ok(Math.abs(d.bequests[0].share - 900000 / 950000) < 1e-12);
  assert.equal(d.ready, true); assert.equal(d.meets, d.endReal >= 570000);
  assert.ok(Array.isArray(d.levers) && d.levers.some((l) => l.id === "spending"));
  const big = compute(withLegacy({ bequests: [{ id: "a", to: "Cy", kind: "person", amount: 2000000 }] }), { today: TODAY });
  assert.equal(big.meets, false); assert.ok(big.gap > 0); assert.equal(big.levers.find((l) => l.id === "spending").status, "needs");
});

test("not ready without the plan's basics, the bequests still listed", () => {
  const p = emptyPlan(); p.estate.legacy = { bequests: BEQ };
  const d = compute(p, { today: TODAY });
  assert.equal(d.ready, false); assert.equal(d.total, 950000);
});

// fix round 1 of the owner's request 2026-11-11 (2026-11-12, B3): the return it needs is information on Goal seek, never a change,
// so "Does the plan leave it?" does not list it, and the Social Security card keeps its place in the five
test("fix round 1 (B3): the changes listed leave out the return it needs (information, not a change)", async () => {
  const { listedLevers } = await import("./compute.js");
  // an invented one-adult household like the phone walk's Jamie (short, no match), leaving $20,000
  const p = emptyPlan();
  p.household.people.push({ id: "me", name: "Jamie", role: "self", birthDate: "1982-11-15" });
  p.household.filingStatus = "single";
  p.accounts.push({ id: "k", name: "Jamie's plan at work", type: "401k", balance: 30000, ownerId: "me" }, { id: "chk", name: "Checking", type: "checking", balance: 3000 }, { id: "sav", name: "Savings", type: "savings", balance: 18000 });
  p.income.push({ id: "pay", name: "Pay", type: "salary", personId: "me", amount: 64000, period: "annual" });
  p.retirement.spendingMonthly = 3220;
  p.retirement.socialSecurity = { me: { monthlyAtFRA: 2484 } };
  p.retirement.workPlans = { me: { plan: true, match: false } };
  p.retirement.contributions.push({ id: "row", accountId: "k", personId: "me", period: "monthly", amount: 250, employerMatch: 0 });
  p.estate.legacy = { bequests: [{ id: "a", to: "Cy", kind: "person", amount: 20000 }] };
  const d = compute(p, { today: "2026-11-11" });
  assert.equal(d.meets, false);
  assert.ok(d.levers.some((l) => l.id === "returns" && l.info), "Goal seek still works it out");
  const listed = listedLevers(d.levers);
  assert.ok(listed.length <= 5); assert.ok(!listed.some((l) => l.id === "returns" || l.info));
  assert.ok(listed.some((l) => l.id === "claim"), listed.map((l) => l.id).join());
  // the page
  const { pageText } = await import("../../../qa/fixtures/fake-dom.mjs");
  const t = await pageText(new URL("./view.js", import.meta.url), p, "2026-11-11", { computeRemote: { "estate/legacy": compute } });
  assert.doesNotMatch(t, /The return it needs/); assert.match(t, /When to claim Social Security/);
});

// simple first (owner, 2026-11-12 and 2026-11-13; fix round 2): the first three changes in Goal seek's order, the rest one quiet tap
// away; the add form shows three boxes and folds the optional note, open and saying so when the one being changed has a note
test("simple first (fix round 2): three changes first, the rest folded; the add form's note one tap away, never hiding a note", async () => {
  const { listedLevers } = await import("./compute.js");
  const { firstLevers } = await import("../../scenarios/goal-seek/compute.js");
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const p = withLegacy({ bequests: [{ id: "a", to: "Cy", kind: "person", amount: 2000000, notes: "for a first home" }] });
  const d = compute(p, { today: TODAY });
  assert.equal(d.meets, false);
  // the list is Goal seek's first-view order (firstLevers), at most five, never the return it needs or a "just right"
  const listed = listedLevers(d.levers);
  const { shown, more } = firstLevers(d.levers.filter((l) => !l.info && l.status !== "same"));
  assert.deepEqual(listed.map((l) => l.id), [...shown, ...more].slice(0, 5).map((l) => l.id));
  const r = await renderPage(new URL("./view.js?simple-first", import.meta.url), p, TODAY, { computeRemote: { "estate/legacy": compute } });
  const leave = r.root.querySelectorAll("section").find((x) => /Does the plan leave it\?/.test(x.textContent));
  const rest = leave.querySelectorAll("details").find((x) => x.classList.contains("lg-rest"));
  const inRest = rest ? rest.querySelectorAll("li") : [];
  const first = leave.querySelectorAll("li").filter((x) => !inRest.includes(x));
  assert.equal(first.length, Math.min(3, listed.length));
  assert.equal(inRest.length, listed.length - first.length);
  if (rest) { assert.ok(!rest.hasAttribute("open")); assert.match(rest.querySelector("summary").textContent, new RegExp(`^${inRest.length} more change`)); }
  // the bequest listed: the form is folded behind "+ Add someone"; opened, three boxes and the note folded and closed
  const addBtn = r.root.querySelectorAll("button").find((b) => b.textContent === "+ Add someone");
  addBtn.click();
  const form = r.root.querySelectorAll("form")[0];
  const note = form.querySelectorAll("details").find((x) => x.classList.contains("lg-note"));
  assert.ok(note && !note.hasAttribute("open")); assert.equal(note.querySelector("summary").textContent, "Add a noteoptional›");
  assert.ok(note.querySelector('[name="notes"]'), "the note's box is inside the fold");
  const outside = ["to", "kind", "amount"].map((k) => form.querySelector(`[name="${k}"]`));
  assert.ok(outside.every((x) => x && !note.all().includes(x)));
  // changing Cy, who has a note: open, and its line says so
  r.root.querySelectorAll("li").find((x) => x.getAttribute("role") === "button").click();
  const note2 = r.root.querySelectorAll("form")[0].querySelectorAll("details").find((x) => x.classList.contains("lg-note"));
  assert.ok(note2.hasAttribute("open")); assert.equal(note2.querySelector("summary").textContent, "The notehas one›");
  assert.equal(note2.querySelector('[name="notes"]').value, "for a first home");
  // saving reads the note from inside the fold; opening anything saved nothing
  assert.deepEqual(r.saved, []);
  r.root.querySelectorAll("form")[0].dispatch("submit");
  assert.equal(r.saved.length, 1); assert.equal(r.saved[0].estate.legacy.bequests[0].notes, "for a first home");
});

test("final fix (rule 7): a 401(k) with nothing going in stays among the first three changes when saving alone cannot get there", async () => {
  const { listedLevers } = await import("./compute.js");
  const { ARCHETYPES, COMMON_PACKS } = await import("../../../qa/households/lib/catalog.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  // the qa couple spending more than comes in: Priya's 401(k) holds $92,000 and nothing goes in
  const p = ARCHETYPES.find((a) => a.id === "02-couple-no-kids").build();
  COMMON_PACKS.expenses.find((v) => v.slug === "spending-above-income").apply(p);
  const plan = migrate(p);
  plan.estate = { ...(plan.estate ?? {}), legacy: { bequests: [{ id: "a", to: "Cy", kind: "person", amount: 50000 }] } };
  const d = compute(plan, { today: TODAY });
  assert.equal(d.meets, false);
  const first = listedLevers(d.levers).slice(0, 3);
  const saving = first.find((l) => l.id === "saving");
  assert.ok(saving, first.map((l) => l.id).join(", "));
  assert.equal(saving.status, "cannot"); assert.match(saving.sentence, /Priya's 401\(k\) holds \$92,000, but nothing goes into it now/);
});

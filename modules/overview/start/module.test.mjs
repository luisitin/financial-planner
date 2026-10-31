// modules/overview/start/module.test.mjs -- when Get started opens by itself, its choices and the featured panel.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { compute, isEmptyPlan, firstRun, opensHere, setChosen, featured, ROWS, CHOICE_IDS, MORE } from "./compute.js";
import { activeSummary, startGuide, journeyById } from "../guide/compute.js";
import { compute as dashboard } from "../dashboard/compute.js";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { router } from "../../../core/router.js";

const empty = () => migrate(emptyPlan());
const MODS = fileURLToPath(new URL("../../", import.meta.url));

test("an empty plan is one with no accounts, people, income, expenses, goals or transactions", () => {
  assert.equal(isEmptyPlan(empty()), true);
  for (const [k, v] of [["accounts", { id: "a" }], ["income", { id: "i" }], ["expenses", { id: "e" }], ["goals", { id: "g" }], ["transactions", { id: "t" }]]) {
    const p = empty(); p[k] = [v]; assert.equal(isEmptyPlan(p), false, k);
  }
  const p = empty(); p.household.people = [{ id: "me" }]; assert.equal(isEmptyPlan(p), false);
});
test("first visit: only 'look around' stops it; any other choice leaves the plan empty and keeps it", () => {
  const p = empty();
  assert.equal(firstRun(p), true);
  setChosen(p, "quick", "2026-10-31");
  assert.equal(firstRun(p), true, "a quick answer does not fill the plan");
  setChosen(p, "look", "2026-10-31");
  assert.equal(firstRun(p), false);
  assert.equal(firstRun(migrate(familyPlan("2026-10-31"))), false);
});
test("opensHere: the first visit, or a guide still followed before any account exists", () => {
  const p = empty(); setChosen(p, "look", "2026-10-31");
  assert.equal(opensHere(p), false);
  startGuide(p, "debt", "2026-10-31");
  assert.equal(opensHere(p, { today: "2026-10-31" }), true);
  assert.equal(opensHere(p, { today: "2026-12-31" }), false, "a guide gone quiet does not");
  p.accounts = [{ id: "a", type: "checking", balance: 10 }];
  assert.equal(opensHere(p, { today: "2026-10-31" }), false);
});
test("setChosen writes { id, at } and nothing else, and does not save the same choice twice in a day", () => {
  const p = empty(), before = JSON.stringify({ ...p, guide: undefined });
  assert.equal(setChosen(p, "debt", "2026-10-31"), true);
  assert.deepEqual(p.guide, { chosen: { id: "debt", at: "2026-10-31" } });
  assert.equal(setChosen(p, "debt", "2026-10-31"), false);
  assert.equal(setChosen(p, "debt", "2026-11-01"), true);
  assert.equal(setChosen(p, "nonsense", "2026-11-01"), false);
  assert.equal(JSON.stringify({ ...p, guide: undefined }), before);
});
test("the featured panel follows the dashboard's six steps: start, continue, look over", () => {
  const p = empty();
  let f = featured(p);
  assert.deepEqual([f.label, f.state, f.href], ["Start my plan", "new", "#/balance/net-worth?guide=whole-plan&step=accounts"]);
  assert.match(f.line, /6 short steps, about 30 minutes/);
  const fam = migrate(familyPlan("2026-10-31"));
  f = featured(fam);
  assert.deepEqual([f.label, f.doneCount, f.total], ["Continue my plan", dashboard(fam).doneCount, 6]);
  assert.equal(f.line, "5 of 6 steps are done. Next: check the assumptions.");
  const sk = empty(); startGuide(sk, "whole-plan", "2026-10-31");
  sk.guide.journeys["whole-plan"].later = { accounts: "2026-10-31" };
  f = featured(sk);
  assert.deepEqual([f.label, f.state, f.line], ["Continue my plan", "started", "You skipped 1 step for now. Next: add your household."], "started and skipped step 1: not 'Start my plan'");
  fam.assumptions = { ...(fam.assumptions ?? {}), reviewedAt: "2026-10-31" };
  f = featured(fam);
  assert.deepEqual([f.label, f.href], ["Look over my plan", "#/overview/guide/whole-plan"]);
});
test("choices: a quick answer and four guides, then more guides; every target is a real page or guide", () => {
  assert.deepEqual(ROWS, ["quick", "debt", "budget", "home", "retire"]);
  const d = compute(empty());
  assert.equal(d.rows.length, 5);
  for (const r of d.rows) {
    assert.ok(CHOICE_IDS.includes(r.id));
    const { group, id, rest } = router.parse(r.href);
    assert.ok(fs.existsSync(`${MODS}${group}/${id}/module.js`), r.href);
    if (rest[0]) assert.ok(journeyById(rest[0]), r.href);
    assert.match(r.line, /\.$/);
  }
  assert.equal(router.parse(MORE.href).query.more, "1");
  assert.equal(d.rows.find((r) => r.id === "debt").status, null, "not started: no status line");
});
test("the resume card: the followed guide unless it is the whole plan (the featured panel covers that)", () => {
  const p = migrate(familyPlan("2026-10-31"));
  assert.equal(compute(p).resume, null);
  startGuide(p, "taxes", "2026-10-31");
  const d = compute(p, { today: "2026-10-31" });
  assert.deepEqual(d.resume, activeSummary(p, { today: "2026-10-31" }));
  assert.equal(d.rows.find((r) => r.id === "debt").status, null);
  const q = migrate(familyPlan("2026-10-31")); startGuide(q, "whole-plan", "2026-10-31");
  assert.equal(compute(q).resume, null);
  startGuide(q, "debt", "2026-10-31");
  assert.equal(compute(q).rows.find((r) => r.id === "debt").status, "In progress: 2 of 3 steps done");
});

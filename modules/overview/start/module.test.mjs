// modules/overview/start/module.test.mjs -- when Get started opens by itself, its choices and the featured panel.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { compute, isEmptyPlan, firstRun, opensHere, setChosen, featured, ROWS, CHOICE_IDS, MORE } from "./compute.js";
import { activeSummary, startGuide, journeyById } from "../guide/compute.js";
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
test("the featured panel follows the path: Build my plan, Continue my plan, See your plan (the old shape, from pathSummary)", async () => {
  const S = await import("../setup/compute.js");
  const T = "2026-11-02";
  const p = empty();
  let f = featured(p, { today: T });
  assert.deepEqual([f.label, f.state, f.href, f.doneCount], ["Build my plan", "new", "#/overview/setup/you", 0]);
  assert.match(f.line, /About 20 minutes in all/);
  const fam = migrate(familyPlan(T));
  f = featured(fam, { today: T });
  assert.deepEqual([f.label, f.state], ["Continue my plan", "started"]);
  assert.match(f.line, /^Step \d of \d\. Next: /);
  assert.ok(f.href.includes("guide=plan&step="));
  const q = empty(); S.applyYou(q, { name: "Ana", who: "me" }); S.markAt(q, "money", T);
  assert.equal(featured(q, { today: T }).state, "started", "the questions started: the plan is under way");
  const { passStep, pathSummary } = await import("../guide/compute.js");
  const done = migrate(familyPlan(T)); S.markAt(done, "done", T);
  for (const x of pathSummary(done, { today: T }).parts.slice(1)) passStep(done, x.key, T);
  f = featured(done, { today: T });
  assert.deepEqual([f.label, f.state, f.href], ["See your plan", "done", "#/overview/plan"]);
  assert.equal(compute(done, { today: T }).path.complete, true);
  assert.equal(compute(done, { today: T }).resume, null);
});
test("CHOICE_IDS keeps whole-plan (a stored choice) and adds plan", () => {
  assert.ok(CHOICE_IDS.includes("whole-plan") && CHOICE_IDS.includes("plan"));
  const p = empty();
  assert.equal(setChosen(p, "plan", "2026-11-02"), true);
  assert.equal(p.guide.chosen.id, "plan");
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
test("the resume card: the followed guide unless it is the path (the featured panel covers that)", () => {
  const p = migrate(familyPlan("2026-10-31"));
  assert.equal(compute(p).resume, null);
  startGuide(p, "taxes", "2026-10-31");
  const d = compute(p, { today: "2026-10-31" });
  assert.deepEqual(d.resume, activeSummary(p, { today: "2026-10-31" }));
  assert.equal(d.rows.find((r) => r.id === "debt").status, null);
  const q = migrate(familyPlan("2026-10-31")); startGuide(q, "plan", "2026-10-31");
  assert.equal(compute(q).resume, null);
  startGuide(q, "debt", "2026-10-31");
  assert.equal(compute(q).rows.find((r) => r.id === "debt").status, "In progress: 2 of 3 steps done");
});

test("Set up my plan card: new, then started (question and next), then done (figures and the next move)", async () => {
  const S = await import("../setup/compute.js");
  const p = empty();
  assert.deepEqual(compute(p, { today: "2026-11-01" }).setup, { state: "new", href: "#/overview/setup/you", total: 7 });
  S.applyYou(p, { name: "Ana", who: "me" }); S.markAt(p, "money", "2026-11-01");
  const st = compute(p, { today: "2026-11-01" }).setup;
  assert.deepEqual([st.state, st.q, st.href, st.next], ["started", 2, "#/overview/setup/money", "what comes in"]);
  S.applyMoney(p, { people: { "setup-self": { status: "work", amount: 60000 } } });
  S.applySpend(p, { mode: "rows", rows: { housing: 1400, groceries: 500 } }); S.markAt(p, "done", "2026-11-01");
  const done = compute(p, { today: "2026-11-01" }).setup;
  assert.equal(done.state, "done");
  assert.equal(done.href, "#/overview/setup/done");
  assert.ok(done.move && done.move.href.startsWith("#/"), "a next move with a link");
});
test("opens here while Set up my plan is started and not finished, unless 'look around' was chosen", async () => {
  const S = await import("../setup/compute.js");
  const p = empty();
  S.applyYou(p, { name: "Ana", who: "me" }); S.markAt(p, "money", "2026-11-01");
  assert.equal(firstRun(p), false, "the plan has a person now");
  assert.equal(opensHere(p), true);
  setChosen(p, "look", "2026-11-01");
  assert.equal(opensHere(p), false);
  const q = empty(); S.applyYou(q, { who: "me" }); S.markAt(q, "done", "2026-11-01");
  assert.equal(opensHere(q), false, "finished");
});
test("tiles: a quick answer, six guides and a big life change, each a real page; a started guide shows how far", () => {
  const d = compute(empty());
  assert.deepEqual(d.tiles.map((t) => t.id), ["quick", "debt", "budget", "home", "retire", "taxes", "protect", "life"]);
  for (const t of d.tiles) {
    assert.ok(CHOICE_IDS.includes(t.id), t.id);
    const { group, id, rest } = router.parse(t.href);
    assert.ok(fs.existsSync(`${MODS}${group}/${id}/module.js`), t.href);
    if (rest[0]) assert.ok(journeyById(rest[0]), t.href);
    assert.ok(t.title.length <= 22 && t.line.length <= 34, `${t.title}: short enough for a phone tile`);
  }
  const p = migrate(familyPlan("2026-10-31")); startGuide(p, "taxes", "2026-10-31");
  assert.match(compute(p).tiles.find((t) => t.id === "taxes").status, /^\d+ of \d+$/);
});

test("setupCard: a stored question whose screen is now hidden keeps its number (review 2026-11-02)", async () => {
  const { setupCard } = await import("./compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  // the trip goal was added on the Goals page after reaching question 7, so "how much, and by when" is skipped
  const p = familyPlan("2026-11-02"); p.guide = { ...(p.guide ?? {}), setup: { startedAt: "2026-10-20", at: "goal-details", picks: { goals: ["trip"] } } };
  const c = setupCard(p, {});
  assert.equal(c.state, "started"); assert.equal(c.q, 7); assert.equal(c.next, "where you stand");
  // stopped at question 2: question 2
  p.guide.setup = { startedAt: "2026-10-20", at: "money" };
  assert.equal(setupCard(p, {}).q, 2);
});
test("setupCard is done for a plan built page by page: the Dashboard's first five steps, no whole-plan anywhere", async () => {
  const { setupCard } = await import("./compute.js");
  const p = migrate(familyPlan("2026-11-02"));
  assert.equal(p.guide?.setup?.startedAt, undefined);
  assert.equal(setupCard(p, { today: "2026-11-02" }).state, "done");
  const q = structuredClone(p); q.goals = [];
  assert.notEqual(setupCard(q, { today: "2026-11-02" }).state, "done", "four of the five: not built yet");
  const src = fs.readFileSync(fileURLToPath(new URL("./compute.js", import.meta.url)), "utf8").split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));
  assert.ok(!src.some((l) => /journeyById\("whole-plan"\)/.test(l)));
});

test("review fix: the Dashboard of a plan with only questions answered or skipped links to Your plan, and says both times", () => {
  // (the link sits under the hero's one filled button since the stress test of 2026-11-11)
  const dash = fs.readFileSync(new URL("../dashboard/view.js", import.meta.url), "utf8");
  assert.match(dash, /setupOn && pathStarted && nx\?\.kind !== "plan" \? ui\.h\("a", \{ class: "db-all", href: pathStarted\.planHref/);
  assert.match(dash, /about five minutes for those, about 20 for your whole plan/);
});

test("setupCard: started and left on the welcome screen counts as question 1, so no page says Let's go while another says Continue", async () => {
  const { setupCard } = await import("./compute.js");
  const p = migrate({ meta: { currency: "USD" } });
  p.guide = { setup: { startedAt: "2026-11-10", at: "welcome" } };
  const c = setupCard(p, { today: "2026-11-11" });
  assert.equal(c.state, "started"); assert.equal(c.q, 1); assert.equal(c.href, "#/overview/setup/you");
});

test("N12 (review 2026-11-11): each guide tile carries the guide's own title", async () => {
  for (const t of compute(empty()).tiles) { const j = journeyById(t.id); if (j) assert.equal(t.title, j.title, t.id); }
});

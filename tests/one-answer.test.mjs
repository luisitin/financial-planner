// tests/one-answer.test.mjs -- one retirement answer on every overview page (z1, 2026-11-16). Will the money last? counts no Social
// Security for an adult with no figure; while that is the only gap and the money lasts even so, its answer stands (overview/setup
// lastsWithoutSs, the one rule), and every overview page gives it, naming whose Social Security it leaves out. Where the money is
// short or only just lasts without it, every page keeps asking for it, as the page's own notice does first.
// Over every invented household (qa/fixtures plans, the 14 households, the phone-built ones, round 8, the Get started personas, the
// demo and the empty plan): what each page says about retirement, read from its compute, against what Will the money last? says.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";
import * as phone from "../qa/fixtures/phone-households.mjs";
import * as round8 from "../qa/fixtures/round8-households.mjs";
import * as personas from "../qa/fixtures/setup-personas.mjs";
import { demoHousehold } from "../qa/fixtures/demo-household.mjs";
import { retiredCouplePlan } from "../qa/fixtures/retired-couple-plan.mjs";
import { compute as projection, savingsUnknown, retirementKnown } from "../modules/retirement/projection/compute.js";
import { standing, lastsWithoutSs, ssMissingFor, ssLeftOutWords, ssLeftOutLine, retireTileWords, retireGuessAsk, orphanSsLine } from "../modules/overview/setup/compute.js";
import { retireRow } from "../modules/overview/dashboard/compute.js";
import { compute as alerts } from "../modules/overview/alerts/compute.js";
import { compute as yourPlan } from "../modules/overview/plan/compute.js";
import { compute as quick, answerFor } from "../modules/overview/quick/compute.js";
import { compute as timeline } from "../modules/overview/timeline/compute.js";
import { markGuess } from "../core/estimate/index.js";

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
  for (const [name, fn] of Object.entries(phone)) if (typeof fn === "function") out.push({ name: `phone ${name}`, plan: fn() });
  for (const [name, fn] of Object.entries(round8)) if (typeof fn === "function" && /Plan$/.test(name)) out.push({ name: `round8 ${name}`, plan: fn() });
  for (const n of ["sam", "jordan", "patLee", "ruth"]) out.push({ name: `persona ${n}`, plan: personas.finishSetup(n, personas[n](T), T) });
  out.push({ name: "demo", plan: demoHousehold(T) });
  out.push({ name: "empty plan", plan: emptyPlan() });
  return out.map((x) => ({ ...x, plan: migrate(structuredClone(x.plan)) }));
}
const ALL = await plans();
const run = (fn) => { try { return fn(); } catch (e) { return { threw: String(e.message) }; } };
const c = (p) => structuredClone(p);

// ---------------------------------------------------------------- what each page says, in one word
// lasts | tight | short | unknown (nothing saved for retirement) | asks-ss (asks for Social Security) | asks (asks for something
// else) | none (says nothing about it)
/** Will the money last?: its compute and its heading ("We don't know yet", "Runs out in YEAR", "The money lasts", "It lasts, just"). */
function pageSays(d) {
  if (!d?.ready) return "asks";
  if (savingsUnknown(d)) return "unknown";
  return d.verdict === "on track" ? "lasts" : d.verdict === "tight" ? "tight" : "short";
}
const VERDICT = { "on track": "lasts", tight: "tight", short: "short" };
/** Get started's done screen, its Retirement tile (setup/view.js, the branches in order). */
function tileSays(st) {
  if (!st.retire) return /Social Security/.test(st.tileWhy?.retire ?? `Needs ${st.retirementMissing ?? ""}`) && !st.retirementKnown ? "asks-ss" : "asks";
  if (st.retireSavingsUnknown) return "unknown";
  return VERDICT[st.retire.verdict];
}
/** The Dashboard's row. */
function rowSays(r) {
  if (r.v === "Not known yet") return "unknown";
  if (r.open) return /Social Security/.test(r.s) ? "asks-ss" : "asks";
  return r.v === "On track" ? "lasts" : r.v === "Tight" ? "tight" : "short";
}
/** Your plan's "Will the money last?" row (it quotes Quick answers' answerFor). */
function planSays(d) {
  const r = (d.groups ?? []).flatMap((g) => g.rows).find((x) => x.key === "retire");
  if (!r) return "none";
  if (r.status === "open") return /Social Security/.test(r.needs ?? "") ? "asks-ss" : "asks";
  if (r.value === "Not known yet") return "unknown";
  return r.value === "The money lasts" ? "lasts" : r.value === "It lasts, just" ? "tight" : /^Runs out/.test(r.value) ? "short" : `? ${r.value}`;
}
/** Quick answers: "Will my money last?" under "answers" (with the plan's answer) or under "needs your numbers first". */
function quickSays(d) {
  const a = d.answers.find((x) => x.guide === "retire");
  if (!a) return d.needsFirst.some((x) => x.guide === "retire") ? "asks" : "none";
  return a.verdict === "unknown" ? "unknown" : VERDICT[a.verdict];
}
/** The Timeline: its top box (lasts to the end, runs out, not known yet) and what it asks for. It says "lasts" for "only just" too. */
function timelineSays(d) {
  const h = d?.headline;
  if (!h) return "asks";
  if (h.lastsTo) return "lasts";
  if (h.shortYear) return "short";
  if (h.unknown) return "unknown";
  return h.needsSS && /Social Security/.test(h.needs ?? "") ? "asks-ss" : "asks";
}
/** Needs attention: its only retirement item is "Your retirement money runs out at N". */
const attentionSays = (a) => (a.alerts.some((x) => x.id === "retire-short") ? "short" : "none");

const RUNS = ALL.map(({ name, plan }) => {
  const d = run(() => projection(c(plan), { today: T }));
  const st = standing(c(plan), { today: T });
  return { name, plan, d, st, page: pageSays(d), missing: ssMissingFor(plan).length > 0, known: retirementKnown(plan, T), stands: lastsWithoutSs(plan, { today: T }),
    says: { "Get started": tileSays(st), Dashboard: rowSays(retireRow(st, { plan: c(plan), today: T })), "Needs attention": attentionSays(alerts(c(plan), { today: T })),
      "Your plan": planSays(yourPlan(c(plan), { today: T })), "Quick answers": quickSays(quick(c(plan), { today: T })), Timeline: timelineSays(run(() => timeline(c(plan), { today: T }))) } };
});
const RC = RUNS.find((r) => r.name === "fixture retired-couple-plan.mjs:retiredCouplePlan");

test("the households: every answer Will the money last? gives is among them, and three lift", () => {
  assert.ok(RUNS.length >= 45, `${RUNS.length}`);
  for (const k of ["lasts", "tight", "short", "asks"]) assert.ok(RUNS.some((r) => r.page === k), k);
  assert.ok(RUNS.some((r) => r.missing && r.page === "short"), "a household short without the missing Social Security");
  assert.deepEqual(RUNS.filter((r) => r.stands).map((r) => r.name).sort(), ["08-retired/base", "14-unusual-structures/base", "fixture retired-couple-plan.mjs:retiredCouplePlan"]);
});

test("every page agrees with Will the money last?, for every household", () => {
  for (const r of RUNS) {
    for (const [where, said] of Object.entries(r.says)) {
      const at = `${r.name}: Will the money last? ${r.page}${r.missing ? " (Social Security missing)" : ""}, ${where} ${said}`;
      if (where === "Needs attention") {
        // it says nothing until the money runs out on a checked plan; it never asks for Social Security
        assert.ok(said === "none" || (said === "short" && r.page === "short" && r.known), at);
        continue;
      }
      if (r.page === "lasts" && (r.known || r.stands)) { assert.equal(said, "lasts", at); continue; }
      // short or only just lasting while Social Security is missing: the missing figure could change it, so every page asks for it
      if (r.missing && !r.known) { assert.ok(said === "asks-ss" || said === "asks" || (where === "Your plan" && said === "none"), at); assert.ok(!["lasts", "tight", "short"].includes(said), at); continue; }
      if (r.page === "asks") { assert.ok(said === "asks" || said === "asks-ss", at); continue; }
      if (r.page === "unknown") { assert.ok(!["lasts", "tight", "short"].includes(said), at); continue; }
      // checked and short or tight: the same verdict (the Timeline's "The money lasts" covers "only just" too: its run succeeds)
      if (where === "Timeline" && r.page === "tight") { assert.equal(said, "lasts", at); continue; }
      assert.equal(said, r.page, at);
    }
  }
});

test("the one rule: Social Security the only gap and the money lasting without it", () => {
  const p = retiredCouplePlan(T), before = JSON.stringify(p);
  const w = lastsWithoutSs(p, { today: T });
  assert.equal(JSON.stringify(p), before, "nothing is written");
  assert.deepEqual([w.ids, w.words, w.proj.verdict], [["p-sam"], "Sam's Social Security", "on track"]);
  // the answer is Will the money last?'s own: the same compute, and the same as counting Sam's as none
  const d = projection(retiredCouplePlan(T), { today: T });
  assert.deepEqual([w.proj.verdict, w.proj.affordable, w.proj.spendingYearly], [d.verdict, d.affordable, d.spendingYearly]);
  // a projection handed in is used as it is
  assert.equal(lastsWithoutSs(retiredCouplePlan(T), { today: T, proj: d }).proj, d);
  // null: short without it (spending three times as high), a birth date missing too, Social Security in for everyone, said "none"
  const high = retiredCouplePlan(T); for (const x of high.expenses) x.amount *= 3;
  assert.equal(projection(high, { today: T }).verdict, "short"); assert.equal(lastsWithoutSs(high, { today: T }), null);
  const nd = retiredCouplePlan(T); nd.household.people.find((x) => x.id === "p-sam").birthDate = "";
  assert.equal(lastsWithoutSs(nd, { today: T }), null);
  const typed = retiredCouplePlan(T); typed.retirement.socialSecurity = { "p-sam": { monthlyAtFRA: 1500 } };
  assert.equal(lastsWithoutSs(typed, { today: T }), null);
  const none = retiredCouplePlan(T); none.guide = { ...(none.guide ?? {}), setup: { ...(none.guide?.setup ?? {}), ss: { "p-sam": "none" } } };
  assert.equal(lastsWithoutSs(none, { today: T }), null);
  // only just lasting without it: still asks (the 15% to spare that "on track" needs is not there)
  const tight = RUNS.find((r) => r.missing && !r.known && r.page === "tight");
  if (tight) assert.equal(tight.stands, null, tight.name);
  // the empty plan, a plan with no people: nothing to say
  assert.equal(lastsWithoutSs(emptyPlan(), { today: T }), null);
});

// a figure typed for each adult the answer leaves out (tiny, small, middling, large): the money still lasts, as every page said
const typedFor = (plan, ids, monthly) => { const q = c(plan); q.retirement = q.retirement ?? {}; q.retirement.socialSecurity = { ...(q.retirement.socialSecurity ?? {}) }; for (const id of ids) q.retirement.socialSecurity[id] = { ...(q.retirement.socialSecurity[id] ?? {}), monthlyAtFRA: monthly }; return q; };
test("an answer that stands stays: a Social Security figure typed for whoever it leaves out never makes the money stop lasting (critic M1)", () => {
  const lifted = RUNS.filter((r) => r.stands);
  assert.equal(lifted.length, 3);
  for (const r of lifted) for (const monthly of [1, 100, 400, 2000]) assert.equal(projection(typedFor(r.plan, r.stands.ids, monthly), { today: T }).verdict, "on track", `${r.name}: $${monthly} a month each`);
  // the critic's case: Ruth's Social Security on the Income page with no one named on it, the spending 2.05 times as high. The
  // projection counts the line for the first adult and drops it once that adult has a figure: $100 a month each made the money
  // short (and $400 tight). The answer must not stand: the pages keep asking for both figures
  const p = retiredCouplePlan(T); for (const x of p.expenses) x.amount *= 2.05;
  p.income.find((x) => x.id === "i-ss").personId = "";
  assert.equal(projection(c(p), { today: T }).verdict, "on track", "on track while both figures are missing");
  assert.equal(projection(typedFor(p, ["p-ruth", "p-sam"], 100), { today: T }).verdict, "short", "the trap: a typed figure drops the Income line");
  assert.equal(orphanSsLine(p, T), true);
  assert.equal(lastsWithoutSs(p, { today: T }), null);
  assert.deepEqual([standing(c(p), { today: T }).withoutSs, answerFor("retire", c(p), { today: T })], [undefined, null]);
  // the same line given to a child, or to someone no longer in the household: the same
  const kid = c(p); kid.household.people.push({ id: "p-kid", name: "Kim", role: "dependent", birthDate: "2015-01-01" }); kid.income.find((x) => x.id === "i-ss").personId = "p-kid";
  assert.equal(lastsWithoutSs(kid, { today: T }), null);
  const gone = c(p); gone.income.find((x) => x.id === "i-ss").personId = "p-gone";
  assert.equal(lastsWithoutSs(gone, { today: T }), null);
  // a line that has ended, or one paid once, is not counted by the projection: it does not hold the answer back
  const ended = c(retiredCouplePlan(T)); ended.income.push({ id: "i-old", name: "Old benefit", type: "social", personId: "", amount: 300, period: "monthly", endDate: "2020-01-01" }, { id: "i-once", name: "Back pay", type: "social", personId: "", amount: 900, period: "once" });
  assert.equal(orphanSsLine(ended, T), false); assert.deepEqual(lastsWithoutSs(ended, { today: T }).ids, ["p-sam"]);
  // Ruth's line named to Ruth (the household as it is): the answer stands, Sam's figure only adds
  assert.equal(orphanSsLine(retiredCouplePlan(T), T), false);
});

test("standing() carries the answer and says whose Social Security it leaves out; the rest of it is as before", () => {
  const st = RC.st;
  assert.deepEqual([st.retire.verdict, st.retirementKnown, st.retirementMissing, st.withoutSs, st.tileWhy.retire, st.tileAt.retire], ["on track", false, "Social Security for Sam", "Sam's Social Security", null, null]);
  // the same household with Sam's said "won't get it": the same answer and figures, only the words of what is missing differ
  const none = retiredCouplePlan(T); none.guide = { ...(none.guide ?? {}), setup: { ...(none.guide?.setup ?? {}), ss: { "p-sam": "none" } } };
  const s2 = standing(none, { today: T });
  assert.deepEqual(s2.retire, st.retire);
  for (const k of ["netWorth", "spare", "runway", "headline", "moves"]) assert.deepEqual(s2[k], st[k], k);
  assert.equal(s2.withoutSs, undefined);
  // a plan the rule does not lift has no withoutSs at all
  for (const r of RUNS.filter((x) => !x.stands)) assert.equal("withoutSs" in r.st, false, r.name);
});

test("whose Social Security, in the pages' words, and the sentence they add", () => {
  const p = retiredCouplePlan(T);
  assert.equal(ssLeftOutWords(p), "Sam's Social Security");
  // the person themself, or everyone missing: "your"
  const ruth = retiredCouplePlan(T); ruth.retirement.socialSecurity = { "p-sam": { monthlyAtFRA: 1500 } }; ruth.income = (ruth.income ?? []).filter((x) => !/social security/i.test(x.name ?? ""));
  assert.deepEqual(ssMissingFor(ruth).map((x) => x.role), ["self"]); assert.equal(ssLeftOutWords(ruth), "your Social Security");
  const both = retiredCouplePlan(T); both.income = (both.income ?? []).filter((x) => !/social security/i.test(x.name ?? ""));
  assert.equal(ssMissingFor(both).length, 2); assert.equal(ssLeftOutWords(both), "your Social Security");
  // one adult on their own (14-unusual-structures: Grace)
  assert.equal(RUNS.find((r) => r.name === "14-unusual-structures/base").st.withoutSs, "your Social Security");
  assert.equal(ssLeftOutLine("Sam's Social Security"), "Sam's Social Security is not counted yet.");
  assert.equal(ssLeftOutLine("your Social Security"), "Your Social Security is not counted yet.");
});

test("Get started's Retirement tile, one sentence per case", () => {
  assert.equal(retireTileWords(RC.st), "If nothing changes, even without Sam's Social Security.");
  assert.equal(retireTileWords({ retire: { verdict: "on track" } }), "If nothing changes.");
  assert.equal(retireTileWords({ retire: { verdict: "short" } }), "If nothing changes.");
  // resting on our guesses: each ask of retireGuessAsk, with whose Social Security it leaves out
  for (const what of ["pay", "saving", "balance", "spending"]) {
    const st = { retire: { verdict: "on track" }, retireGuessed: true, retireGuessedWhat: what };
    const plain = retireGuessAsk(st).words;
    assert.match(plain, /^Partly our guesses\. /);
    assert.equal(retireTileWords(st), plain);
    assert.equal(retireTileWords({ ...st, withoutSs: "Sam's Social Security" }), plain.replace("Partly our guesses.", "Partly our guesses, without Sam's Social Security."));
  }
  assert.equal(retireTileWords({ retire: { verdict: "on track" }, retireGuessed: true, retireGuessedWhat: "spending", withoutSs: "Sam's Social Security" }), "Partly our guesses, without Sam's Social Security. Type what you spend ›");
  // Ruth and Sam with our guesses carrying their spending: the tile and the Dashboard both say it
  const g = retiredCouplePlan(T);
  for (const x of g.expenses) markGuess(g, `expenses[${x.id}].amount`, { key: "spend.x", value: x.amount, unit: "month", sigma: 0.25, dataAsOf: "2026-09-01" }, T);
  const sg = standing(g, { today: T });
  assert.equal(retireTileWords(sg), "Partly our guesses, without Sam's Social Security. Type what you spend ›");
  assert.equal(retireRow(sg, { plan: g, today: T }).s, "Partly our guesses of your spending, without Sam's Social Security");
});

test("Your plan and Quick answers quote the answer that stands, with the sentence that says whose Social Security it leaves out", () => {
  const a = answerFor("retire", retiredCouplePlan(T), { today: T });
  assert.deepEqual([a.headline, a.verdict, a.status, a.withoutSs], ["The money lasts", "on track", "ok", "Sam's Social Security"]);
  assert.equal(a.line, "You plan to spend $33,360 a year. If markets do as well as average, your plan can pay for $85,416 a year; less after a run of bad years (see the Will the money last? page). Sam's Social Security is not counted yet.");
  const row = yourPlan(retiredCouplePlan(T), { today: T }).groups.flatMap((g) => g.rows).find((x) => x.key === "retire");
  assert.deepEqual([row.value, row.status, row.short], ["The money lasts", "ok", "the money lasts"]);
  assert.equal(row.line, "You plan to spend $33,360 a year. If markets do as well as average, your plan can pay for $85,416 a year; less after a run of bad years. Sam's Social Security is not counted yet.");
  // a checked plan's answer has no such sentence and no withoutSs (the same answer, Sam's typed)
  const typed = retiredCouplePlan(T); typed.retirement.socialSecurity = { "p-sam": { monthlyAtFRA: 1500 } };
  const b = answerFor("retire", typed, { today: T });
  assert.equal(b.withoutSs, undefined); assert.doesNotMatch(b.line, /not counted yet/);
  // short without it: no answer, the guide's own line (needs your numbers first)
  const high = retiredCouplePlan(T); for (const x of high.expenses) x.amount *= 3;
  assert.equal(answerFor("retire", high, { today: T }), null);
  assert.ok(quick(high, { today: T }).needsFirst.some((x) => x.guide === "retire"));
});

test("Ruth and Sam, by name: every page says what Will the money last? says", () => {
  assert.equal(RC.page, "lasts");
  assert.deepEqual(RC.says, { "Get started": "lasts", Dashboard: "lasts", "Needs attention": "none", "Your plan": "lasts", "Quick answers": "lasts", Timeline: "lasts" });
  const tl = timeline(c(RC.plan), { today: T });
  assert.deepEqual([tl.headline.lastsTo, tl.headline.needsSS, tl.headline.needs, tl.headline.withoutSs], [2054, false, null, "Sam's Social Security"]);
  const end = tl.events.find((e) => e.id === "lasts");
  assert.deepEqual([end.title, end.detail], ["The money lasts", "About $966,600 is left at the end, in today's dollars. Sam's Social Security is not counted yet."]);
  assert.ok(!tl.events.some((e) => e.id === "needs-ss"));
  assert.deepEqual(retireRow(RC.st, { plan: c(RC.plan), today: T }), { dot: "ok", k: "Retirement", s: "The money lasts, even without Sam's Social Security", v: "On track", href: "#/retirement/projection" });
  // a single adult short without Social Security: every page keeps asking, as the page's notice asks first
  const one = RUNS.find((r) => r.name === "01-single-adult/base");
  assert.deepEqual([one.page, one.says["Get started"], one.says.Dashboard, one.says["Your plan"], one.says["Quick answers"], one.says.Timeline], ["short", "asks-ss", "asks-ss", "asks-ss", "asks", "asks-ss"]);
});

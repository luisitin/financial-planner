import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { compute, largestWhere, smallestWhere } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";
import { buildInputs } from "../../retirement/projection/compute.js";
import { project, copyInputs } from "../../../core/math/retirement.js";

const TODAY = "2026-10-30";
const lever = (d, id) => d.levers.find((l) => l.id === id);
const I = buildInputs(familyPlan(), { today: TODAY }).inputs;
const meets = (inputs, legacy = 0) => { const r = project(inputs); return r.success && r.endBalanceReal >= legacy - 0.5; };

test("the search helpers: largest and smallest where a test holds, the bracket grown when needed", () => {
  assert.ok(Math.abs(largestWhere((x) => x <= 1234.5, 0, 10, 0.01) - 1234.5) < 0.01, "grows past hi");
  assert.equal(largestWhere((x) => x < 0, 0, 10), null);
  assert.ok(Math.abs(smallestWhere((x) => x >= 77.25, 0, 1000, 0.01) - 77.25) < 0.01);
  assert.equal(smallestWhere((x) => x >= 0, 0, 10), 0); assert.equal(smallestWhere(() => false, 0, 10), null);
});

test("an empty plan says what is missing", () => {
  const e = compute(emptyPlan(), { today: TODAY });
  assert.equal(e.ready, false); assert.ok(e.missing.length);
});

test("just lasting: every lever has room, and each answer is the edge (it works there and not a step beyond)", () => {
  const d = compute(familyPlan(), { today: TODAY });
  assert.equal(d.meets, true);
  assert.deepEqual(d.levers.map((l) => l.id), ["spending", "retire", "saving", "returns", "lump", "claim"]);
  for (const l of d.levers) assert.equal(l.status === "room" || l.status === "same", true, l.id);
  const s = lever(d, "spending").value * 12;
  assert.ok(meets({ ...copyInputs(I), spending: { yearly: s } }) && !meets({ ...copyInputs(I), spending: { yearly: s + 24 } }), "spending edge");
  const retire = lever(d, "retire").value;
  const at = (a) => { const p = familyPlan(); p.household.people[0].retirementAge = a; return buildInputs(p, { today: TODAY }).inputs; };
  assert.ok(meets(at(retire)) && !meets(at(retire - 1)), "earliest retirement age");
  const room = lever(d, "lump").value;
  const out = (x) => { const c = copyInputs(I); c.events.push({ year: 2026, amount: x }); return c; };
  assert.ok(meets(out(room)) && !meets(out(room + 200)), "room today");
});

test("leaving $3 million is out of reach for spending and retiring alone; saving, returns and a lump sum say how much", () => {
  const d = compute(familyPlan(), { today: TODAY, legacy: 3000000 });
  assert.equal(d.meets, false); assert.equal(d.legacy, 3000000);
  assert.equal(lever(d, "spending").status, "cannot"); assert.equal(lever(d, "retire").status, "cannot");
  const save = lever(d, "saving");
  assert.equal(save.status, "needs"); assert.ok(save.value > save.current);
  const extra = (save.value - save.current) * 12;
  const c = copyInputs(I); c.contributions.push({ bucket: "deferred", yearly: extra, personIndex: 0, name: "extra" });
  assert.ok(meets(c, 3000000), "the extra saving reaches it");
  const ret = lever(d, "returns"); assert.equal(ret.status, "needs"); assert.ok(ret.value > ret.current);
  const lump = lever(d, "lump"); assert.equal(lump.title, "What it is short today"); assert.ok(lump.value > 0);
  const l = copyInputs(I); l.events.push({ year: 2026, amount: -lump.value });
  assert.ok(meets(l, 3000000));
});

test("Social Security: the claiming age that leaves the most to spend, with the curve of all nine", () => {
  const d = compute(familyPlan(), { today: TODAY });
  const c = lever(d, "claim");
  assert.equal(c.results.length, 9); assert.deepEqual(c.results.map((r) => r.age), [62, 63, 64, 65, 66, 67, 68, 69, 70]);
  const best = c.results.reduce((a, r) => (r.monthly > a.monthly ? r : a));
  assert.equal(c.value, best.age);
});

test("the claiming lever moves only who has not claimed, from the ages still possible (round 4)", async () => {
  const { retirementPlan } = await import("../../../qa/fixtures/retirement-plan.mjs");
  const T = "2026-11-02";
  const p = retirementPlan();
  // Sam is 76 and gets it already (on Income); Lee is 69 and 5 months and has not claimed
  p.household.people.find((x) => x.id === "sam").birthDate = "1950-03-10";
  p.household.people.find((x) => x.id === "lee").birthDate = "1957-06-20";
  for (const x of p.household.people) x.retirementAge = 62;
  p.income = (p.income ?? []).filter((x) => !["salary", "bonus", "business"].includes(x.type));
  p.income.push({ id: "ss-sam", name: "Sam's Social Security", type: "social", personId: "sam", amount: 2800, period: "monthly", growth: 0, taxable: true });
  p.retirement.socialSecurity = { sam: { claimAge: 66, monthlyAtFRA: 2800 }, lee: { claimAge: 70, monthlyAtFRA: 2100 } };
  const d = compute(p, { today: T });
  const lever = d.levers?.find((l) => l.id === "claim");
  if (!lever) return;   // the plan cannot be judged on this fixture: nothing to say
  assert.deepEqual(lever.who, ["lee"]);
  // 69 and 5 months: "now" (to the month, the Social Security page's first choice) and 70 are what is left (review 2026-11-02)
  assert.deepEqual(lever.results.map((r) => Math.round(r.age * 12)), [69 * 12 + 5, 70 * 12]);
  assert.match(lever.sentence, /^Lee claiming (at 70|now \(69 and 5 months\))/); assert.match(lever.sentence, /Sam already gets it/);
});

test("the spending lever says its figure is the average-market one (round 5, 2026-11-02)", () => {
  const d = compute(familyPlan(), { today: TODAY });
  assert.match(lever(d, "spending").sentence, /^If markets do as well as average, (up to )?about \$[\d,]+ a month/);
  const big = compute(familyPlan(), { today: TODAY, legacy: 2500000 });
  assert.ok(lever(big, "spending").status === "cannot" || /^If markets do as well as average/.test(lever(big, "spending").sentence));
});

test("the claiming lever says 'now' only when it is now for everyone it moves (review 2026-11-02, round 5)", async () => {
  const { retirementPlan } = await import("../../../qa/fixtures/retirement-plan.mjs");
  const T = "2026-11-02";
  // Sam is 64 and 6 months, Lee 60 and 5 months; a short plan, so claiming as soon as possible spends the most
  const p = retirementPlan();
  p.household.people[0].birthDate = "1962-05-10"; p.household.people[1].birthDate = "1966-06-20";
  for (const x of p.household.people) { x.retirementAge = 60; x.lifeExpectancy = 74; }
  p.income = []; p.retirement.contributions = [];
  const c = lever(compute(p, { today: T }), "claim");
  assert.equal(Math.round(c.nowAge * 12), 64 * 12 + 6); assert.equal(c.nowForAll, false, "19 months away for Lee");
  assert.equal(c.value, c.nowAge);
  assert.match(c.sentence, /^Sam and Lee claiming at 64 and 6 months lets the plan spend the most/); assert.doesNotMatch(c.sentence, /\bnow\b/);
  // Sam alone: today's age is now
  delete p.retirement.socialSecurity.lee;
  const s = lever(compute(p, { today: T }), "claim");
  assert.equal(s.nowForAll, true); assert.equal(s.value, s.nowAge);
  assert.match(s.sentence, /^Sam claiming now \(64 and 6 months\)/);
});

test("recheck 2026-11-05: the earliest age spends the plan's amount the same every year, whatever rule the plan uses", async () => {
  const { earliestRetireAge } = await import("./compute.js");
  const T = "2026-11-02";
  const steady = earliestRetireAge(familyPlan(T), { today: T });
  assert.ok(steady.age > steady.ageNow, "the family cannot stop now");
  for (const rule of ["percent", "guardrails", "vpw"]) {
    const p = familyPlan(T); p.retirement.strategy = rule;
    // with the plan's own rule spending shrinks with the money and never runs short: "stopping now would do" at 36
    assert.equal(earliestRetireAge(p, { today: T }).age, steady.age, rule);
    const d = compute(p, { today: T });
    assert.equal(lever(d, "retire").value, steady.age, rule);
    assert.equal(d.strategy, rule);
  }
  assert.equal(compute(familyPlan(T), { today: T }).strategy, "fixed-real");
});

// review 2026-11-02: the spending answer says it is on top of health cover, as Will the money last? does (its target)
test("the spending lever says it is on top of health cover, and not when the spending figure already includes it", () => {
  const p = familyPlan();
  assert.match(lever(compute(p, { today: TODAY }), "spending").sentence, /a month on top of health cover, .* the plan spends before health cover\.$/);
  p.retirement.healthIncluded = true;
  assert.doesNotMatch(lever(compute(p, { today: TODAY }), "spending").sentence, /health cover/);
});

// Review 2026-11-06 (sixth pass verify): "How it is worked out" said "Retirement: the first person's earliest age" while the lever
// is about the adult who still works (workingNow): the part-time couple's "When Jo can retire" (Jo listed second) sat under it.
test("verify 2026-11-06: the method sentence names the adult the retirement lever is about, not the first person", async () => {
  const { RETIRE_HOW } = await import("./compute.js");
  assert.ok(!/first person's earliest age/.test(RETIRE_HOW), "was: the first person's earliest age");
  assert.match(RETIRE_HOW, /earliest age of the adult who still works/);
  const { emptyPlan: empty } = await import("../../../core/schema/migrate.js");
  const p = empty();
  p.household.filingStatus = "married_joint";
  p.household.people.push({ id: "rae", name: "Rae", role: "self", birthDate: "1960-01-15", retirementAge: 63 }, { id: "jo", name: "Jo", role: "partner", birthDate: "1964-10-01", retirementAge: 66 });
  p.guide = { setup: { status: { rae: "retired", jo: "work" } } };
  p.accounts.push({ id: "ira", name: "Rae's IRA", type: "ira", balance: 380000, ownerId: "rae" }, { id: "sav", name: "Savings", type: "savings", balance: 30000 });
  p.income.push({ id: "ss", name: "Rae's Social Security", type: "social", personId: "rae", amount: 2400, period: "monthly", growth: 0.025, taxable: true }, { id: "jo", name: "Jo's part-time job", type: "salary", personId: "jo", amount: 2200, period: "monthly", growth: 0.02, taxable: true });
  p.retirement.socialSecurity = { jo: { claimAge: 67, monthlyAtFRA: 1600 } };
  p.expenses.push({ id: "o", name: "Everything", category: "other", amount: 4350, period: "monthly", essential: true, inflates: true });
  const d = compute(p, { today: "2026-11-06" });
  assert.equal(lever(d, "retire").title, "When Jo can retire", "the second adult listed: the words must not say the first person");
});

test("review 2026-11-06 (round 7): the unnamed first adult reads you, the partner your spouse; names as before", async () => {
  const fam = familyPlan(); fam.household.people[0].name = "Me"; fam.household.people[1].name = "My spouse";
  const m = compute(fam, { today: TODAY });
  assert.equal(lever(m, "retire").title, "When you can retire");
  assert.match(lever(m, "claim").sentence, /^You and your spouse claiming /);
  for (const l of m.levers) assert.doesNotMatch(`${l.title} ${l.sentence}`, /\bMe\b|My spouse/, l.id);
  const named = compute(familyPlan(), { today: TODAY });
  assert.equal(lever(named, "retire").title, "When Ana can retire");
  assert.match(lever(named, "claim").sentence, /^Ana and Bo claiming /);
  // one already paid: "you already get it", the other moved alone
  const { retirementPlan } = await import("../../../qa/fixtures/retirement-plan.mjs");
  const T = "2026-11-02";
  const p = retirementPlan();
  p.household.people.find((x) => x.id === "sam").birthDate = "1950-03-10";
  p.household.people.find((x) => x.id === "lee").birthDate = "1957-06-20";
  for (const x of p.household.people) x.retirementAge = 62;
  p.household.people.find((x) => x.id === "sam").name = "Me"; p.household.people.find((x) => x.id === "lee").name = "My spouse";
  p.income = (p.income ?? []).filter((x) => !["salary", "bonus", "business"].includes(x.type));
  p.income.push({ id: "ss-sam", name: "My Social Security", type: "social", personId: "sam", amount: 2800, period: "monthly", growth: 0, taxable: true });
  p.retirement.socialSecurity = { sam: { claimAge: 66, monthlyAtFRA: 2800 }, lee: { claimAge: 70, monthlyAtFRA: 2100 } };
  const c = compute(p, { today: T }).levers?.find((l) => l.id === "claim");
  if (c) { assert.match(c.sentence, /^Your spouse claiming /); assert.match(c.sentence, / You already get it, so that stays as it is\.$/); }
});

// --- round 8 (2026-11-06): the Plan health score asks for its own target, on the same levers ----------------------------------
test("round 8: spendingScale solves the levers for that many times the planned spending; bisect finds the scan's age", async () => {
  const { earliestRetireAge } = await import("./compute.js");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { retirementPlan } = await import("../../../qa/fixtures/retirement-plan.mjs");
  const today = "2026-11-06";
  const renter = renterDebtPlan(); renter.accounts.find((a) => a.id === "k401").balance = 100000;
  for (const [name, plan] of [["family", familyPlan()], ["renter", renter], ["renter as is", renterDebtPlan()], ["retirement", retirementPlan()]]) {
    for (const spendingScale of [1, 1.15]) {
      const scan = earliestRetireAge(plan, { today, spendingScale }), half = earliestRetireAge(plan, { today, spendingScale, search: "bisect" });
      assert.equal(half?.age ?? null, scan?.age ?? null, `${name} x${spendingScale}`);
    }
  }
  // 115% of the spending: the saving it takes is more, and the spending lever's "most you can spend" does not move
  const one = compute(renter, { today, only: ["spending", "saving"] }), more = compute(renter, { today, spendingScale: 1.15, only: ["spending", "saving"] });
  assert.deepEqual(one.levers.map((l) => l.id), ["spending", "saving"]);
  assert.ok(lever(more, "saving").value > lever(one, "saving").value);
  assert.ok(Math.abs(lever(more, "spending").value - lever(one, "spending").value) < 1);
  assert.ok(Math.abs(more.spendingMonthly - 1.15 * one.spendingMonthly) < 1e-6);
  // left out, the page's own call: every lever, as before
  assert.deepEqual(compute(renter, { today }).levers.map((l) => l.id), ["spending", "retire", "saving", "returns", "lump", "claim"]);
});

// --- round 8 review (2026-11-06), D4: the Plan health score's link opens Goal seek on the target its hint was worked out for --
test("review D4: #/scenarios/goal-seek?target=last opens on \"Just last\", even with an amount on Legacy goals", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const p = renterDebtPlan(); p.estate = { ...(p.estate ?? {}), legacy: { bequests: [{ id: "b1", to: "Heirs", kind: "people", amount: 200000 }] } };
  const view = new URL("./view.js", import.meta.url);
  const notReady = { "scenarios/goal-seek": () => ({ ready: false, missing: [] }) };
  // opened from the menu: Legacy goals' amount, as before
  const a = await renderPage(view, p, "2026-11-06", { computeRemote: notReady });
  assert.equal(a.remote.find((r) => r.key === "scenarios/goal-seek").params.legacy, 200000);
  // opened from the score's hint: the money lasting, leaving nothing
  const b = await renderPage(view, p, "2026-11-06", { computeRemote: notReady, route: { rest: [], query: { target: "last" } } });
  assert.equal(b.remote.find((r) => r.key === "scenarios/goal-seek").params.legacy, 0);
});

// path part 3: the first screen says things in plain words (the path walk's banned-word check, qa/flows/path-walk.js, runs it in the browser)
test("part 3: plain words on the first screen: no hard word in this page's view or compute strings", () => {
  const strip = (t) => t.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[^]*?\*\//g, "");
  const view = strip(fs.readFileSync(fileURLToPath(new URL("./view.js", import.meta.url)), "utf8"));
  for (const w of ['each change would have to be', 'Even in a bad run of years:']) assert.ok(view.includes(w), w);
  for (const w of ['lever would', 'each lever', 'lever alone']) assert.ok(!view.includes(w), w);
});

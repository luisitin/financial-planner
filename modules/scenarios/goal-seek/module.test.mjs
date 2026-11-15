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
test("the spending lever says it is on top of health insurance, and not when the spending figure already includes it", () => {
  const p = familyPlan();
  assert.match(lever(compute(p, { today: TODAY }), "spending").sentence, /a month on top of health insurance, .* the plan spends before health insurance\.$/);
  p.retirement.healthIncluded = true;
  assert.doesNotMatch(lever(compute(p, { today: TODAY }), "spending").sentence, /health insurance/);
});

// Review 2026-11-06 (sixth pass verify): "How it is worked out" said "Retirement: the first person's earliest age" while the lever
// is about the adult who still works (workingNow): the part-time couple's "When Jo can retire" (Jo listed second) sat under it.
test("verify 2026-11-06: the method sentence names the adult the retirement lever is about, not the first person", async () => {
  const { RETIRE_HOW } = await import("./compute.js");
  assert.ok(!/first person's earliest age/.test(RETIRE_HOW), "was: the first person's earliest age");
  assert.match(RETIRE_HOW, /earliest age at which the person still working could stop/);
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

// --- round 8 batch 4 follow-ups (2026-11-07) -------------------------------------------------------------------------------------
test("F1: an amount you must reach rounds up to the shown $10, a limit rounds down; the unrounded value stays", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { shownValue, roundUp, roundDown } = await import("./compute.js");
  const today = "2026-11-06";
  const p = renterDebtPlan();
  const d = compute(p, { today });
  const save = lever(d, "saving");
  // the renter needs $243.53 a month more: the page said $240 and the money still ran short ($2,028 of $2,040); $250 lasts
  assert.ok(Math.abs(save.value - 243.53) < 0.01, String(save.value));   // unrounded, as before
  assert.equal(shownValue(save), 250);
  assert.match(save.sentence, /^Save about \$250 a month\. You save nothing toward this today\.$/);
  const I = buildInputs(p, { today }).inputs;
  const withExtra = (e) => { const c = copyInputs(I); c.contributions.push({ bucket: "taxable", yearly: e * 12, personIndex: 0, name: "extra" }); return c; };
  assert.equal(meets(withExtra(shownValue(save))), true, "following the words works");
  assert.equal(meets(withExtra(240)), false, "the old $240 fell short");
  // a lump sum that is short rounds up the same way; following it works
  const lump = lever(d, "lump");
  assert.equal(shownValue(lump), roundUp(lump.value)); assert.ok(shownValue(lump) >= lump.value);
  const withLump = (x) => { const c = copyInputs(I); c.events.push({ year: c.startYear, amount: -x, label: "lump sum" }); return c; };
  assert.equal(meets(withLump(shownValue(lump))), true);
  assert.ok(lump.sentence.includes(`About $${shownValue(lump).toLocaleString("en-US")} more in savings today`), lump.sentence);
  // helpers: exact multiples stay, a cent over goes up; limits go down
  assert.equal(roundUp(250), 250); assert.equal(roundUp(250.01), 260); assert.equal(roundUp(0.2), 0); assert.equal(roundDown(1239.99), 1230); assert.equal(roundDown(1240), 1240);
  // limits on the family plan: spending and room today never show more than the edge
  const f = compute(familyPlan(), { today: TODAY });
  for (const id of ["spending", "lump"]) assert.ok(shownValue(lever(f, id)) <= lever(f, id).value + 1e-9, id);
  assert.ok(shownValue(lever(f, "spending")) > lever(f, "spending").value - 10);
  // a return you must earn rounds up to the shown tenth of a percent
  const r = { id: "returns", unit: "rate", status: "needs", value: 0.05412 };
  assert.equal(shownValue(r), 0.055); assert.equal(shownValue({ ...r, status: "same" }), 0.054);
  // the Plan health score's hint says the same $250
  const { compute: score } = await import("../../overview/health-score/compute.js");
  assert.match(score(p, { today }).parts.find((x) => x.id === "retirement").fix, /save about \$250 a month more/);
});

// --- round 8 batch 4 follow-ups F4 and F5 (2026-11-07): ?target=last is read once; a "Room for bad luck (115%)" chip -----------------
test("F4 and F5: the address's target is read once and cleared; the bad-luck chip asks compute for spendingScale 1.15 and survives a redraw", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const { BAD_LUCK } = await import("./compute.js");
  assert.equal(BAD_LUCK, 1.15);
  const calls = [];
  globalThis.history = { state: null, replaceState: (...a) => calls.push(a) };
  globalThis.location = { pathname: "/", search: "?sandbox=1", hash: "" };
  // the renter has no retirement savings on file: the page is its hero and one filled "Add what you own" (stress test 2026-11-11, F4);
  // the chip is checked on the family, who have savings
  const view = new URL("./view.js", import.meta.url);
  const live = { "scenarios/goal-seek": (plan, params) => compute(plan, params) };
  const last = { group: "scenarios", id: "goal-seek", rest: [], query: { target: "last" } };
  const renter = await renderPage(view, renterDebtPlan(), "2026-11-06", { computeRemote: live, route: last });
  assert.match(renter.text(), /Add what you own ›/); assert.equal(renter.root.querySelectorAll(".chip").length, 0);
  calls.length = 0;
  const p = familyPlan("2026-11-06");
  const route = { ...last, query: { target: "last" } };
  const a = await renderPage(view, p, "2026-11-06", { computeRemote: live, route });
  const params = (r) => r.remote[r.remote.length - 1].params;
  // read: just last, as planned; and the address loses ?target=last (once)
  assert.equal(params(a).legacy, 0); assert.equal(params(a).spendingScale, undefined);
  assert.equal(calls.length, 1); assert.equal(calls[0][2], "/?sandbox=1#/scenarios/goal-seek");
  // the chip, with one plain line under it
  const chip = () => a.root.querySelectorAll(".chip").find((c) => c.textContent.startsWith("Room for bad luck"));
  assert.equal(chip().textContent, "Room for bad luck"); assert.equal(chip().getAttribute("aria-pressed"), "false");
  // gap #21 (R14): it names the two amounts it compares
  assert.match(a.text(), /Plans for spending 15% more than you expect \(\$8,050 a month instead of \$7,000\), in case markets or prices turn out worse\./);
  chip().click(); await new Promise((r) => setTimeout(r, 0));
  assert.equal(params(a).spendingScale, 1.15);
  assert.equal(chip().getAttribute("aria-pressed"), "true");
  assert.match(a.text(), /Every figure below is worked out as if you spent 15% more than the \$[\d,]+ a month your plan has\./);
  // the shell redraws the page with the same route (a sync): the chip stays, ?target=last is not read again, the address is left alone
  const again = await renderPage(view, p, "2026-11-06", { computeRemote: live, route });
  assert.equal(params(again).spendingScale, 1.15); assert.equal(calls.length, 1);
  // a new visit to the link (a new route) starts from just last, as planned, again
  const visit = await renderPage(view, p, "2026-11-06", { computeRemote: live, route: { ...last, query: { target: "last" } } });
  assert.equal(params(visit).spendingScale, undefined); assert.equal(params(visit).legacy, 0); assert.equal(calls.length, 2);
  // the amounts under it are worked for the scaled spending: the saving it needs is more
  const one = compute(p, { today: "2026-11-06" }), more = compute(p, { today: "2026-11-06", spendingScale: BAD_LUCK });
  assert.ok(lever(more, "saving").value > lever(one, "saving").value);
  delete globalThis.history; delete globalThis.location;
});

// --- review of the follow-ups (2026-11-07) ------------------------------------------------------------------------------------------
test("D2: under 'room for bad luck' what you can spend is in the plan's terms: the most to plan, each month then 15% more", async () => {
  const { shownValue, BAD_LUCK } = await import("./compute.js");
  const p = familyPlan(); p.retirement = { ...(p.retirement ?? {}), spendingMonthly: 7600 };
  const one = compute(p, { today: TODAY }), more = compute(p, { today: TODAY, spendingScale: BAD_LUCK });
  assert.equal(more.scale, 1.15); assert.equal(one.scale, 1);
  const sp = lever(more, "spending");
  // the unrounded value and current stay as they were (the score reads them); the page shows value / scale, rounded down
  assert.ok(Math.abs(sp.current - more.spendingMonthly) < 1e-9);
  const shown = shownValue(sp, more.scale);
  assert.equal(shown, Math.floor(sp.value / 1.15 / 10 + 1e-9) * 10);
  assert.ok(sp.sentence.includes(`$${shown.toLocaleString("en-US")} a month`), sp.sentence);
  assert.ok(sp.sentence.includes(`the $${(Math.round(one.spendingMonthly / 10) * 10).toLocaleString("en-US")} the plan spends`), sp.sentence);
  // following it works: plan that many dollars a month, spend 15% more, the money still lasts
  const I = buildInputs(p, { today: TODAY }).inputs;
  assert.equal(meets({ ...copyInputs(I), strategy: "fixed-real", spending: { yearly: shown * 12 * 1.15 } }), true);
  assert.ok(shown * 1.15 <= sp.value + 1e-6);
  assert.equal(shownValue(lever(one, "spending"), one.scale), shownValue(lever(one, "spending")));
});

test("D4: a plan just short of the line never reads 'just what you assume'", () => {
  const p = familyPlan();
  let lo = 1, hi = 1.6;
  const meetsAt = (x) => compute(p, { today: TODAY, spendingScale: x, only: ["returns"] }).meets;
  assert.ok(meetsAt(lo) && !meetsAt(hi));
  for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if (meetsAt(mid)) lo = mid; else hi = mid; }
  const d = compute(p, { today: TODAY, spendingScale: hi, only: ["returns"] });
  assert.equal(d.meets, false);
  const r = lever(d, "returns");
  assert.notEqual(r.status, "same");
  // the words since 2026-11-11 (L1; fix round 1, 2026-11-12): what it would have to grow against what the plan uses, never "just
  // what you assume"
  assert.match(r.sentence, /^For the plan to work as it is, investments would have to grow about [\d.]+% a year, against the [\d.]+% a year we use\. /);
  assert.doesNotMatch(r.sentence, /just what you assume/);
});

// --- verify of the follow-ups (2026-11-07): under "Room for bad luck" the hero never says "as it stands" ----------------------------
test("verify: with Room for bad luck on, the hero speaks of 15% more spending, not of the plan as it stands", async () => {
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  globalThis.history = { state: null, replaceState: () => {} };
  globalThis.location = { pathname: "/", search: "?sandbox=1", hash: "" };
  // the family planning $7,600 a month: the money lasts as planned, and runs out in 2082 at 15% more
  const p = familyPlan(); p.retirement = { ...(p.retirement ?? {}), spendingMonthly: 7600 };
  assert.equal(compute(p, { today: "2026-11-07", only: ["returns"] }).meets, true);
  const live = { "scenarios/goal-seek": (plan, params) => compute(plan, params) };
  const route = { group: "scenarios", id: "goal-seek", rest: [], query: { target: "last" } };   // starts from just last, chip off
  const r = await renderPage(new URL("./view.js", import.meta.url), p, "2026-11-07", { computeRemote: live, route });
  // the headline waits for the bad-run figure (stress test 2026-11-11, W5): "Checking ..." until it is in, then the one verdict
  assert.match(r.text(), /Your plan works, with room to spare|Checking your plan against bad years/); assert.match(r.text(), /As it stands the money lasts and leaves about/);
  r.root.querySelectorAll(".chip").find((c) => c.textContent === "Room for bad luck").click(); await new Promise((ok) => setTimeout(ok, 0));
  assert.match(r.text(), /With 15% more spending than you plan, the money runs out in 20\d\d\./);
  assert.ok(!/As it stands the money runs out/.test(r.text()), "the plan as it stands does not run out");
  r.root.querySelectorAll(".chip").find((c) => c.textContent === "Room for bad luck").click(); await new Promise((ok) => setTimeout(ok, 0));
  assert.match(r.text(), /As it stands the money lasts/);
  delete globalThis.history; delete globalThis.location;
});

// --- owner's request 2026-11-11, L1: a higher return is never offered as a fix ----------------------------------------------------
// An invented household like the 2026-11-11 phone walk's Casey: one adult, $72,000 pay, a 401(k) at work holding $48,000 with
// "None" going in (a typed $0 row), Social Security estimated, $3,090 a month planned in retirement: short at 67.
function casey({ said = true, balance = 48000, formerJob = false, pay = 72000, name = "Casey's plan at work" } = {}) {
  const p = emptyPlan();
  p.household.people.push({ id: "c", name: "Casey", role: "self", birthDate: "1980-06-15" });
  p.household.filingStatus = "single";
  p.accounts.push({ id: "k", name, type: "401k", balance, ownerId: "c", ...(formerJob ? { formerJob: true } : {}) }, { id: "chk", name: "Checking", type: "checking", balance: 4000 }, { id: "sav", name: "Savings", type: "savings", balance: 15000 });
  if (pay) p.income.push({ id: "pay", name: "Pay", type: "salary", personId: "c", amount: pay, period: "annual" });
  p.retirement.spendingMonthly = 3090;
  p.retirement.socialSecurity = { c: { monthlyAtFRA: 2697 } };
  p.retirement.workPlans = { c: { plan: true } };
  if (said) p.retirement.contributions.push({ id: "row", accountId: "k", personId: "c", period: "monthly", amount: 0, employerMatch: 0 });
  p.guide = { setup: { status: { c: "work" } } };
  return p;
}
const T11 = "2026-11-11";

test("L1: the return it needs is information with the sourced forecasts, never a change: no card, no button, no 'raise'", async () => {
  const { returnWords, RETURN_FORECAST, forecastFor } = await import("./compute.js");
  assert.deepEqual(JSON.parse(JSON.stringify(RETURN_FORECAST)), { low: 0.048, high: 0.068, bonds: { low: 0.051, high: 0.061 }, who: "Vanguard", asOf: "2026-09-30", asOfWords: "September 30, 2026" });
  // short: the plan would need more than any forecast for its mix (fix round 1, M4/P4: like with like, and whose figures they are)
  const short = lever(compute(casey(), { today: T11 }), "returns");
  assert.equal(short.info, true); assert.equal(short.status, "needs");
  // simple first (owner, 2026-11-12): the line is the need, what the plan uses and whose that is, and the forecasts' range; what
  // the 5.8% is made of and whose the parts are is `more`, shown in the fold "How it is worked out"
  assert.equal(short.sentence, "For the plan to work as it is, investments would have to grow about 11.2% a year, against the 5.8% a year we use. Most forecasts for a mix like the plan's are lower: about 4.9%-6.5% a year (Vanguard). That isn't a choice you can make.");
  assert.equal(short.line, short.sentence.replace(/\.$/, "; the cards above are."));
  assert.equal(short.more, "The 5.8% is 7% for stocks and 4% for bonds on the plan's mix, about 60% in stocks: our usual figures unless you change them.");
  // the forecasts on the plan's own mix: 60% stocks blends 4.8%-6.8% (stocks) and 5.1%-6.1% (bonds) to 4.92%-6.52%
  const f = forecastFor(0.6); near(f.low, 0.6 * 0.048 + 0.4 * 0.051, 1e-12); near(f.high, 0.6 * 0.068 + 0.4 * 0.061, 1e-12);
  assert.deepEqual(forecastFor(1), { low: 0.048, high: 0.068 });
  // the edge: "lower" only when the figure shown is above the top of the blended range as shown (6.5%; 6.51% shows 6.6%)
  assert.match(returnWords({ status: "needs", need: 0.065, now: 0.058, mix: 0.6 }).sentence, /grow about 6\.5% a year, against the 5\.8% a year we use\. Forecasts for a mix like the plan's: about 4\.9%-6\.5% a year \(Vanguard\)\. That isn't/);
  assert.match(returnWords({ status: "needs", need: 0.0651, now: 0.058, mix: 0.6 }).sentence, /grow about 6\.6% a year, .* Most forecasts for a mix like the plan's are lower: about 4\.9%-6\.5% a year/);
  // all in stocks: the stocks range itself (6.8% is inside it)
  assert.match(returnWords({ status: "needs", need: 0.068, now: 0.07, mix: 1 }).sentence, /Forecasts for a mix like the plan's: about 4\.8%-6\.8% a year/);
  // room, just right, out of reach: information too, the forecasts where there is a figure to set against them
  assert.equal(returnWords({ status: "room", need: 0.0431, now: 0.058, room: 0.0149, mix: 0.6 }).line, "Investments growing about 4.4% a year would still do, against the 5.8% a year we use. Forecasts for a mix like the plan's: about 4.9%-6.5% a year (Vanguard).");
  assert.match(returnWords({ status: "same", now: 0.058 }).sentence, /^It gets there only if investments grow the 5\.8% a year we use: no room for bad luck\. Forecasts for a mix like the plan's: about 4\.9%-6\.5% a year \(Vanguard\)\.$/);
  assert.equal(returnWords({ status: "cannot", now: 0.058 }).line, "Even if investments grew far faster than the 5.8% a year we use, it would not get there. That isn't a choice you can make; the cards above are.");
  // "you chose" only for figures typed or reviewed on Assumptions
  const reviewed = casey(); reviewed.assumptions = { ...(reviewed.assumptions ?? {}), reviewedAt: T11 };
  const rev = lever(compute(reviewed, { today: T11 }), "returns");
  assert.match(rev.line, /against the 5\.8% a year your own figures give\. /);
  assert.equal(rev.more, "The 5.8% is 7% for stocks and 4% for bonds on the plan's mix, about 60% in stocks: the figures you chose.");
  const typed = casey(); typed.assumptions = { ...(typed.assumptions ?? {}), returnStocks: 0.065 };
  const typ = lever(compute(typed, { today: T11 }), "returns");
  assert.match(typ.line, /against the 5\.5% a year your own figures give\. /);
  assert.match(typ.more, /^The 5\.5% is 6\.5% for stocks and 4% for bonds on the plan's mix, about 60% in stocks: the figures you chose\.$/);
  // no lever's words ever ask for a higher return, and no "percentage points"
  for (const p of [casey(), familyPlan()]) for (const l of compute(p, { today: T11 }).levers) { assert.doesNotMatch(`${l.sentence} ${l.line ?? ""}`, /\braise\b|\bincrease (the|your) return/i, l.id); assert.doesNotMatch(`${l.sentence} ${l.line ?? ""}`, /percentage point/, l.id); }
  // the page: five cards, the grey line under them, no way to Assumptions, and an outlined way on to What matters most (P7)
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const live = { "scenarios/goal-seek": (plan, params) => compute(plan, params) };
  const r = await renderPage(new URL("./view.js", import.meta.url), casey(), T11, { computeRemote: live });
  assert.equal(r.root.querySelectorAll(".gs-lever").length, 5);
  const info = r.root.querySelectorAll(".gs-info");
  assert.equal(info.length, 1); assert.ok(info[0].classList.contains("muted"));
  assert.match(r.text(), /That isn't a choice you can make; the cards above are\./);
  // the line itself is short; its detail (what the 5.8% is, whose, the source's date) is in the part "How this is worked out"
  assert.ok(info[0].textContent.length < 260, `the grey line is ${info[0].textContent.length} characters`);
  assert.doesNotMatch(info[0].textContent, /September|7% for stocks/);
  const fold = r.root.querySelectorAll("details").find((x) => x.dataset.part === "how");
  assert.match(fold.querySelector(".fold-title").textContent, /^How this is worked out$/);
  assert.match(fold.textContent, /The 5\.8% is 7% for stocks and 4% for bonds on the plan's mix, about 60% in stocks: our usual figures unless you change them\. The forecasts are Vanguard's for the next 10 years, a year before inflation \(as of September 30, 2026\): U\.S\. stocks 4\.8% to 6\.8%, U\.S\. bonds 5\.1% to 6\.1%/);
  assert.ok(!r.root.querySelectorAll("a").some((a) => String(a.getAttribute("href")).includes("assumptions")), "no Assumptions button");
  assert.ok(!/The return it needs/.test(r.text()));
  const more = r.root.querySelectorAll("a").filter((a) => a.getAttribute("href") === "#/scenarios/sensitivity");
  assert.equal(more.length, 1); assert.equal(more[0].textContent, "What matters most? ›");
  assert.ok(more[0].classList.contains("secondary"), "outlined, never a second filled button");
});

test("fix round 1 (B2): a plan that does not need growth prints no growth figure, never the search's edge", async () => {
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { returnWords, RETURN_FLOOR } = await import("./compute.js");
  // the retired couple lasts even with both returns 15 points lower (-9.2% on its mix): that was the search's floor, not a need
  const ret = lever(compute(retiredCouplePlan(T11), { today: T11 }), "returns");
  assert.equal(ret.status, "room"); assert.ok(ret.value <= RETURN_FLOOR + 0.07);
  assert.equal(ret.line, "Your plan does not depend on how investments grow: it gets there even if they lost money every year.");
  assert.doesNotMatch(ret.line, /-\d|15\.0|point/);
  // a need at or below nothing, away from the floor: "even with no growth at all"
  assert.equal(returnWords({ status: "room", need: -0.001, now: 0.058, room: 0.059, mix: 0.6 }).line, "Your plan does not depend on how investments grow: it gets there even with no growth at all.");
  // at the floor with returns typed so high the floor is still growth: no figure either, the distance said in points a year
  assert.match(returnWords({ status: "room", need: 0.04, now: 0.19, mix: 0.6, stocks: 0.2, bonds: 0.17, floor: true }).line, /^It gets there even if investments grew 15 points a year less than the 19\.0% a year we use\.$/);
  // nothing to explain when no figure is shown
  assert.equal(ret.more, undefined);
});

test("fix round 1 (P1): the Social Security card on a short plan says what that age does to the headline", async () => {
  // invented households like the 2026-11-11 phone walk's Jamie (no match), Robin (near retirement) and Morgan (renter, an IRA)
  const jamie = one({ name: "Jamie", born: "1982-11-15", pay: 64000, k401: 30000, amount: 250, noMatch: true, ss: 2484, spend: 3220, checking: 3000, savings: 18000 });
  const robin = one({ name: "Robin", born: "1963-03-15", pay: 70000, k401: 185000, amount: 600, match: 2760, ss: 2513, spend: 3010, retireAge: 67, checking: 5000, savings: 15000 });
  const morgan = one({ name: "Morgan", born: "1984-02-15", pay: 56000, ira: 12000, ss: 2270, spend: 3180, checking: 2500, savings: 9000 });
  const j = compute(jamie, { today: T11 }), jc = lever(j, "claim");
  assert.equal(j.meets, false); assert.equal(j.failYear, 2052);
  // Jamie: claiming at 69 pays more steady, but at the plan's spending the money runs out two years sooner: not on its own
  assert.equal(jc.value, 69); assert.equal(jc.status, "cannot");
  assert.equal(jc.sentence, "Jamie claiming at 69 lets the plan pay about $110 a month more, steady, if markets do as well as average. At the $3,220 a month the plan spends, though, the money would run out in 2050 (age 68) instead of 2052 (age 70): waiting means drawing more from savings until it starts.");
  // said = done: claim at 69 and the headline is what the card said
  const j2 = JSON.parse(JSON.stringify(jamie)); j2.retirement.socialSecurity.me.claimAge = 69;
  const after = compute(j2, { today: T11, only: ["spending"] }); assert.equal(after.meets, false); assert.equal(after.failYear, 2050);
  // Robin: claiming at 70 alone reaches the goal: "needs a change", and doing it makes the plan meet
  const rc = lever(compute(robin, { today: T11 }), "claim");
  assert.equal(rc.value, 70); assert.equal(rc.status, "needs");
  assert.equal(rc.sentence, "Robin claiming at 70 alone makes the money last: about $3,150 a month can be spent if markets do as well as average, $170 more than claiming at 67.");
  const r2 = JSON.parse(JSON.stringify(robin)); r2.retirement.socialSecurity.me.claimAge = 70;
  assert.equal(compute(r2, { today: T11, only: ["spending"] }).meets, true);
  // Morgan: nothing changes on the headline
  const mc = lever(compute(morgan, { today: T11 }), "claim");
  assert.equal(mc.status, "cannot"); assert.match(mc.sentence, /At the \$3,180 a month the plan spends, the money would still run out in 2049 \(age 65\)\.$/);
  // a plan that reaches the goal keeps "room to spare"; the family planning $9,000 a month (short) is never "room" or "helps"
  assert.equal(lever(compute(familyPlan(), { today: TODAY }), "claim").status, "room");
  const over = familyPlan(); over.retirement = { ...(over.retirement ?? {}), spendingMonthly: 9000 };
  const oc = lever(compute(over, { today: TODAY }), "claim");
  assert.ok(["needs", "cannot"].includes(oc.status), oc.status);
  // the page: the pill is the amber or red one the other cards use, never a grey "helps" or a green "room to spare" on a short plan
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const live = { "scenarios/goal-seek": (plan, params) => compute(plan, params) };
  for (const [p, want] of [[jamie, ["pill bad", "not on its own"]], [robin, ["pill warn", "needs a change"]]]) {
    const r = await renderPage(new URL("./view.js", import.meta.url), p, T11, { computeRemote: live });
    const card = r.root.querySelectorAll(".gs-lever").find((c) => /When to claim Social Security/.test(c.textContent));
    const pill = card.querySelectorAll(".pill")[0];
    assert.deepEqual([pill.className.trim(), pill.textContent], want);
    assert.ok(!r.root.querySelectorAll(".pill").some((x) => x.textContent === "helps" || x.textContent === "room to spare"));
  }
});

test("fix round 1 (M5): while the plan as it stands falls short, the retirement card never says 'room to spare'", async () => {
  const { earliestRetireAge } = await import("./compute.js");
  // `from`: the search starts at that age (never below this year's): the family's earliest age from 64 on is at least 64
  const fam = familyPlan(), ana = fam.household.people[0];
  const all = earliestRetireAge(fam, { today: TODAY, personId: ana.id });
  const later = earliestRetireAge(fam, { today: TODAY, personId: ana.id, from: 64 });
  assert.ok(all.age < 64); assert.ok(later.age >= 64);
  assert.equal(earliestRetireAge(fam, { today: TODAY, personId: ana.id, from: 64, search: "bisect" }).age, later.age);
  // short plans: the card is "needs a change" (a later age) or "not on its own", never green
  const over = familyPlan(); over.retirement = { ...(over.retirement ?? {}), spendingMonthly: 9000 };
  for (const p of [casey(), over, one({ name: "Jamie", born: "1982-11-15", pay: 64000, k401: 30000, amount: 250, noMatch: true, ss: 2484, spend: 3220 })]) {
    const d = compute(p, { today: T11 }); assert.equal(d.meets, false);
    const r = lever(d, "retire"); if (r) assert.notEqual(r.status, "room", r.sentence);
  }
});

test("fix round 1 (M1/P2): the saving card works its amount out going into the idle 401(k) it names, and typing it there gets there", async () => {
  const { idleWorkPlans } = await import("./compute.js");
  const { deferralLimit } = await import("../../overview/guesses/estimators/saving.js");
  const said = lever(compute(casey(), { today: T11 }), "saving");
  // short (owner, 2026-11-12, simple first): what to put where, the one caveat, what we know; the reminder to add what goes in
  // only when the person has not said that nothing does
  assert.equal(said.sentence, "Put about $790 a month into Casey's plan at work. Less would do if Casey's job adds some. It holds $48,000, but nothing goes into it now (you said so).");
  assert.deepEqual(said.idle, ["k"]); assert.deepEqual(said.into.map((x) => [x.accountId, x.monthly, x.capped]), [["k", 790, false]]); assert.equal(said.rest, 0);
  // said = done: $790 typed on the $0 row (what the Contributions form writes) reaches the goal; $10 less does not
  const typedAt = (amt) => { const p = casey(); p.retirement.contributions[0].amount = amt; return compute(p, { today: T11, only: ["spending"] }).meets; };
  assert.equal(typedAt(790), true); assert.equal(typedAt(780), false);
  // what it said before (into savings, not the 401(k)) was short there: $670
  assert.equal(typedAt(670), false);
  // done: the card is "just right", never "room to spare ... $0 less than the $790 going in now"
  const done = casey(); done.retirement.contributions[0].amount = 790;
  const after = lever(compute(done, { today: T11 }), "saving");
  assert.equal(after.status, "same"); assert.equal(after.sentence, "Exactly what goes in now, $790 a month.");
  // the plain search is still there for a caller that names no account (the Plan health score's hint asks for `only` some levers)
  const plain = lever(compute(casey(), { today: T11, only: ["saving"] }), "saving");
  assert.equal(plain.into, undefined); assert.equal(plain.sentence, "Save about $670 a month. Casey's plan at work holds $48,000, but nothing goes into it now (you said so).");
  // no $0 row: not "you said so"; the person said the job adds nothing: no "less would do"
  assert.match(lever(compute(casey({ said: false }), { today: T11 }), "saving").sentence, /^Put about \$790 a month into Casey's plan at work\. Less would do if Casey's job adds some\. It holds \$48,000, but nothing goes into it now\. If some of each paycheck does go in, add it on Retirement contributions\.$/);
  const noMatch = casey(); noMatch.retirement.workPlans.c.match = false;
  assert.match(lever(compute(noMatch, { today: T11 }), "saving").sentence, /^Put about \$790 a month into Casey's plan at work\. It holds \$48,000/);
  // past the year's 401(k) limit: the most allowed, then the rest into other savings, both typed and it gets there
  const big = casey({ pay: 150000 }); big.retirement.spendingMonthly = 7000;
  const bl = lever(compute(big, { today: T11 }), "saving");
  const cap = deferralLimit(2026 - 1980, 2026) / 12;
  assert.equal(bl.into[0].capped, true); assert.equal(bl.into[0].monthly, Math.floor(cap / 10) * 10); assert.ok(bl.rest > 0);
  assert.match(bl.sentence, /^Put about \$2,040 a month into Casey's plan at work, the most allowed in 2026, and \$[\d,]+ more into other savings, such as a brokerage account\. Less would do if Casey's job adds some\. It holds /);
  const both = JSON.parse(JSON.stringify(big)); both.retirement.contributions[0].amount = bl.into[0].monthly;
  both.retirement.contributions.push({ id: "rest", accountId: "", personId: "c", amount: bl.rest, period: "monthly", employerMatch: 0 });
  assert.equal(compute(both, { today: T11, only: ["spending"] }).meets, true);
  both.retirement.contributions[1].amount = bl.rest - 10;
  assert.equal(compute(both, { today: T11, only: ["spending"] }).meets, false, "the rest is the edge, rounded up to $10");
  // a 401(k) from a job left (marked, or named old, former, previous, prior or rollover), an empty one, or no pay today: none named
  for (const p of [casey({ formerJob: true }), casey({ balance: 0 }), casey({ name: "Old job 401(k)" }), casey({ name: "Rollover 401(k)" })]) assert.match(lever(compute(p, { today: T11 }), "saving").sentence, /^Save about \$[\d,]+ a month\. You save nothing toward this today\.$/);
  assert.equal(idleWorkPlans(casey({ pay: 0 }), T11), null);
  // something going in: not idle
  const p = casey(); p.retirement.contributions[0].amount = 300;
  assert.equal(idleWorkPlans(p, T11), null);
  // two of them: the old one is not named; two current ones are named together, "between them"
  const two = casey(); two.accounts.push({ id: "k2", name: "Old job 401(k)", type: "401k", balance: 12000, ownerId: "c" });
  assert.match(idleWorkPlans(two, T11).words, /^Casey's plan at work holds \$48,000, but nothing goes into it now/);
  const both2 = casey(); both2.accounts.push({ id: "k2", name: "Second job 401(k)", type: "401k", balance: 12000, ownerId: "c" });
  assert.match(idleWorkPlans(both2, T11).words, /^Casey's plan at work and Second job 401\(k\) hold \$60,000 between them, but nothing goes into them now\. If some/);
  // a few dollars: to the dollar, never "holds $0" (B6)
  assert.match(idleWorkPlans(casey({ balance: 4 }), T11).words, /^Casey's plan at work holds \$4, but/);
});

test("fix round 1 (M1): on every qa base household with such a card, the amounts typed as the card says reach the goal, within the year's 401(k) limit", async () => {
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { deferralLimit, ageInYear } = await import("../../overview/guesses/estimators/saving.js");
  let cards = 0, capped = 0;
  for (const a of ARCHETYPES) {
    const plan = migrate(a.build());
    // the page's own saving answer (into the idle 401(k)), the other levers left out for speed
    const d = compute(plan, { today: T11, only: ["saving"], savingInto: "work" });
    const l = d.ready ? lever(d, "saving") : null;
    if (!l?.into) continue;
    cards++;
    // typed as the Contributions form writes it: the amount on each 401(k)'s row, the rest in a row with no account
    const typed = JSON.parse(JSON.stringify(plan));
    typed.retirement.contributions = typed.retirement.contributions ?? [];
    for (const part of l.into) {
      const lim = deferralLimit(ageInYear(plan, part.personId, 2026), 2026);
      assert.ok(part.monthly * 12 <= lim + 1e-6, `${a.id}: ${part.name} ${part.monthly} a month is over the ${lim} allowed`);
      if (part.capped) capped++;
      if (!(part.monthly > 0)) continue;
      const row = typed.retirement.contributions.find((c) => c.accountId === part.accountId);
      if (row) { row.amount = part.monthly; row.period = "monthly"; } else typed.retirement.contributions.push({ id: `t-${part.accountId}`, accountId: part.accountId, personId: part.personId, amount: part.monthly, period: "monthly", employerMatch: 0 });
    }
    if (l.rest > 0) typed.retirement.contributions.push({ id: "t-rest", accountId: "", personId: l.into[0].personId, amount: l.rest, period: "monthly", employerMatch: 0 });
    assert.equal(compute(typed, { today: T11, only: ["spending"] }).meets, true, `${a.id}: ${l.sentence}`);
    assert.match(l.sentence, /^Put about \$[\d,]+ a month into /, a.id);
  }
  assert.ok(cards >= 5, `${cards} qa base households have an idle 401(k) card`);
  assert.ok(capped >= 1, "at least one of them is at the year's limit, with the rest into other savings");
});

test("fix round 1 (B4): gated with an empty 401(k) on file, Goal seek says nothing is saved, not that we were not told", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const live = { "scenarios/goal-seek": (plan, params) => compute(plan, params) };
  const told = renterDebtPlan();   // a $0 "Work 401(k)" on file
  const d = compute(told, { today: T11, only: ["spending"] });
  assert.equal(d.noSavings, true); assert.equal(d.nothingSaved, true);
  const r = await renderPage(new URL("./view.js", import.meta.url), told, T11, { computeRemote: live });
  assert.match(r.text(), /Nothing is saved for retirement yet, and nothing goes in/); assert.doesNotMatch(r.text(), /haven't told us/);
  const untold = renterDebtPlan(); untold.accounts = untold.accounts.filter((a) => a.type !== "401k");
  assert.equal(compute(untold, { today: T11, only: ["spending"] }).nothingSaved, false);
  const r2 = await renderPage(new URL("./view.js", import.meta.url), untold, T11, { computeRemote: live });
  assert.match(r2.text(), /You haven't told us about retirement savings/);
});

test("fix round 1 (M5): 'as early as' holds for every later age; a gap in the engine's answers is never shown as room", async () => {
  // Casey as left by Get started on the phone (invented): a mortgage inside the spending figure, which the engine drops at its
  // payoff only for some stop years, so retiring at 60 and 61 lasts and 62 to 64 runs out once $790 a month goes in (claude-c's)
  const { buildInputs: bi } = await import("../../retirement/projection/compute.js");
  const withAmount = (amt) => { const p = JSON.parse(CASEY_PHONE); p.retirement.contributions[0].amount = amt; return p; };
  const lastsAt = (p, a) => { const q = JSON.parse(JSON.stringify(p)); q.household.people[0].retirementAge = a; q.retirement.strategy = "fixed-real"; return project(bi(q, { today: T11 }).inputs).success; };
  const p790 = withAmount(790);
  assert.deepEqual([60, 61, 62, 63, 64, 65].map((a) => lastsAt(p790, a)), [true, true, false, false, false, true], "the engine's gap this test is about");
  const d = compute(p790, { today: T11 }); assert.equal(d.meets, true);
  const r = lever(d, "retire");
  assert.ok(r.value >= 65, `${r.status} ${r.sentence}`);
  for (let a = r.value; a <= 65; a++) assert.equal(lastsAt(p790, a), true, `age ${a}`);
  // short as it stands ($670 typed): the planned age on, "at 66: 1 year later", never "room to spare: as early as 61"
  const r670 = lever(compute(withAmount(670), { today: T11 }), "retire");
  assert.equal(r670.status, "needs"); assert.equal(r670.sentence, "If markets do as well as average, at 66: 1 year later than the plan's 65.");
});
const CASEY_PHONE = "{\"schemaVersion\":1,\"meta\":{\"name\":\"My plan\",\"currency\":\"USD\",\"locale\":\"en-US\",\"createdAt\":\"2026-11-11T21:35:24.154Z\",\"updatedAt\":\"2026-11-11T21:35:49.000Z\",\"rev\":\"test\"},\"household\":{\"people\":[{\"birthDate\":\"1980-06-15\",\"retirementAge\":null,\"lifeExpectancy\":null,\"id\":\"setup-self\",\"name\":\"Casey\",\"role\":\"self\"}],\"filingStatus\":\"single\",\"state\":\"PA\"},\"accounts\":[{\"id\":\"setup-workplan-setup-self\",\"name\":\"Casey's plan at work\",\"type\":\"401k\",\"balance\":48000,\"institution\":\"\",\"asOf\":\"2026-11-11\",\"ownerId\":\"setup-self\",\"history\":[],\"notes\":\"\"},{\"id\":\"setup-have-checking\",\"name\":\"Checking\",\"type\":\"checking\",\"institution\":\"\",\"asOf\":\"2026-11-11\",\"ownerId\":\"\",\"history\":[],\"notes\":\"\",\"balance\":4000},{\"id\":\"setup-have-savings\",\"name\":\"Savings\",\"type\":\"savings\",\"institution\":\"\",\"asOf\":\"2026-11-11\",\"ownerId\":\"\",\"history\":[],\"notes\":\"\",\"balance\":15000},{\"id\":\"setup-have-home\",\"name\":\"Home\",\"type\":\"property\",\"institution\":\"\",\"asOf\":\"2026-11-11\",\"ownerId\":\"\",\"history\":[],\"notes\":\"\",\"balance\":300000},{\"id\":\"setup-owe-mortgage\",\"name\":\"Mortgage\",\"type\":\"mortgage\",\"institution\":\"\",\"asOf\":\"2026-11-11\",\"ownerId\":\"\",\"history\":[],\"notes\":\"\",\"balance\":190000}],\"netWorthHistory\":[],\"transactions\":[],\"categories\":[],\"rules\":[],\"imports\":[],\"importProfiles\":{},\"recurringIgnored\":[],\"debtPlan\":{},\"income\":[{\"id\":\"setup-pay-setup-self\",\"name\":\"Casey's pay\",\"personId\":\"setup-self\",\"growth\":0,\"startDate\":\"\",\"endDate\":\"\",\"taxable\":true,\"amount\":72000,\"period\":\"annual\",\"type\":\"salary\"}],\"expenses\":[{\"id\":\"setup-x-housing\",\"name\":\"Home costs\",\"category\":\"housing\",\"essential\":true,\"period\":\"monthly\",\"inflates\":true,\"startDate\":\"\",\"endDate\":\"\",\"amount\":85},{\"id\":\"setup-x-utilities\",\"name\":\"Utilities and phone\",\"category\":\"utilities\",\"essential\":true,\"period\":\"monthly\",\"inflates\":true,\"startDate\":\"\",\"endDate\":\"\",\"amount\":435},{\"id\":\"setup-x-groceries\",\"name\":\"Groceries\",\"category\":\"groceries\",\"essential\":true,\"period\":\"monthly\",\"inflates\":true,\"startDate\":\"\",\"endDate\":\"\",\"amount\":478},{\"id\":\"setup-x-transport\",\"name\":\"Car, gas and transit\",\"category\":\"transport\",\"essential\":true,\"period\":\"monthly\",\"inflates\":true,\"startDate\":\"\",\"endDate\":\"\",\"amount\":467},{\"id\":\"setup-x-insurance\",\"name\":\"Insurance and health\",\"category\":\"insurance\",\"essential\":true,\"period\":\"monthly\",\"inflates\":true,\"startDate\":\"\",\"endDate\":\"\",\"amount\":159},{\"id\":\"setup-x-dining\",\"name\":\"Eating out and fun\",\"category\":\"dining\",\"essential\":false,\"period\":\"monthly\",\"inflates\":true,\"startDate\":\"\",\"endDate\":\"\",\"amount\":566},{\"id\":\"setup-x-shopping\",\"name\":\"Shopping and everything else\",\"category\":\"shopping\",\"essential\":false,\"period\":\"monthly\",\"inflates\":true,\"startDate\":\"\",\"endDate\":\"\",\"amount\":510}],\"budgets\":[],\"debts\":[{\"id\":\"setup-debt-mortgage\",\"accountId\":\"setup-owe-mortgage\",\"extra\":0,\"termMonths\":null,\"startDate\":\"\",\"securedBy\":\"\",\"creditLimit\":null,\"rate\":0.055,\"minPayment\":1500}],\"goals\":[{\"id\":\"setup-goal-cushion\",\"name\":\"Emergency fund\",\"icon\":\"\ud83d\udedf\",\"target\":18700,\"targetDate\":\"\",\"priority\":1,\"saved\":0,\"fundedBy\":[\"setup-have-checking\",\"setup-have-savings\"],\"monthly\":0,\"rate\":null,\"inflates\":false,\"isEmergencyFund\":true}],\"holdings\":[],\"investments\":{\"target\":null,\"band\":0.05,\"advisoryFee\":0,\"newMoney\":0,\"glide\":\"plan\"},\"insurance\":{\"policies\":[]},\"taxes\":{\"year\":null,\"thisYear\":{\"wages\":null,\"otherOrdinary\":0,\"qualifiedIncome\":0,\"taxExemptInterest\":0,\"adjustments\":0,\"socialSecurity\":null,\"withheld\":0,\"paid\":0},\"itemized\":{\"mortgageInterest\":0,\"propertyTax\":0,\"stateTax\":0,\"charitable\":0,\"medical\":0,\"other\":0},\"dependentsUnder17\":null,\"otherDependents\":null,\"blind\":0,\"priorYear\":{\"tax\":null,\"agi\":null},\"estimated\":{\"paid\":[0,0,0,0]},\"gains\":[],\"withholding\":{},\"hsa\":{\"coverage\":\"self\",\"contribution\":0,\"employer\":0,\"fsa\":0,\"fsaSpent\":0}},\"estate\":{\"documents\":[],\"beneficiaries\":[]},\"property\":[],\"assumptions\":{\"inflation\":0.03,\"returnStocks\":0.07,\"returnBonds\":0.04,\"returnCash\":0.02,\"salaryGrowth\":0.03,\"retirementAge\":65,\"planEndAge\":95,\"stdevStocks\":0.15,\"stdevBonds\":0.05,\"emergencyMonths\":6},\"retirement\":{\"spendingMonthly\":3090,\"stocksNow\":0.7,\"stocksRetired\":0.5,\"taxRate\":0.15,\"strategy\":\"fixed-real\",\"withdrawalRate\":0.04,\"contributions\":[{\"id\":\"setup-contrib-setup-self\",\"accountId\":\"setup-workplan-setup-self\",\"personId\":\"setup-self\",\"period\":\"monthly\",\"amount\":0,\"employerMatch\":0}],\"socialSecurity\":{\"setup-self\":{\"monthlyAtFRA\":2697}},\"pensions\":[],\"longevity\":{},\"taxMode\":\"flat\",\"withdrawalOrder\":[\"taxable\",\"deferred\",\"free\"],\"rothConversion\":{\"on\":false,\"fillRate\":0.22,\"untilAge\":null},\"gainShare\":0.5,\"dividendYield\":0.02,\"workPlans\":{\"setup-self\":{\"plan\":true}}},\"scenarios\":[],\"pageNotes\":{},\"reviews\":[],\"notes\":\"\",\"guide\":{\"setup\":{\"picks\":{\"have\":[\"retire\",\"checking\",\"savings\",\"home\"],\"owe\":[\"mortgage\"],\"goals\":[\"cushion\",\"retire\"]},\"who\":\"me\",\"at\":\"done\",\"startedAt\":\"2026-11-11\",\"status\":{\"setup-self\":\"work\"},\"ss\":{\"setup-self\":\"estimate\"},\"ssWrote\":{\"setup-self\":2697},\"saving\":{\"setup-self\":{\"pct\":0}},\"oweSaved\":[\"mortgage\"],\"spendMode\":\"rows\",\"spendSum\":{\"sum\":2700,\"typed\":[]},\"retireAuto\":true,\"focus\":[\"retire\"],\"cushionWrote\":6,\"cushionFunds\":[\"setup-have-checking\",\"setup-have-savings\"],\"cushionTarget\":18700,\"finishedAt\":\"2026-11-11\"},\"journeys\":{\"plan\":{\"done\":{},\"none\":{},\"later\":{},\"startedAt\":\"2026-11-11\"}},\"active\":\"plan\",\"activeAt\":\"2026-11-11\"},\"guesses\":{\"retirement.contributions[setup-contrib-setup-self].employerMatch\":{\"k\":\"contrib.match\",\"v\":0,\"u\":\"year\",\"s\":null,\"at\":\"2026-11-11\",\"d\":\"2026-11-02\"},\"retirement.spendingMonthly\":{\"k\":\"overview/setup:retireSpend\",\"v\":3090,\"u\":\"month\",\"s\":null,\"at\":\"2026-11-11\",\"d\":\"2026-11-02\"}}}";

// a one-adult household built the way Get started leaves it (invented; the P1 and M5 tests)
function one({ name, born, pay, k401 = 0, amount = null, match = 0, noMatch = false, ira = 0, ss, spend, retireAge, checking = 3000, savings = 15000 }) {
  const p = emptyPlan();
  p.household.people.push({ id: "me", name, role: "self", birthDate: born, ...(retireAge ? { retirementAge: retireAge } : {}) });
  p.household.filingStatus = "single";
  if (k401) p.accounts.push({ id: "k", name: `${name}'s plan at work`, type: "401k", balance: k401, ownerId: "me" });
  if (ira) p.accounts.push({ id: "ira", name: `${name}'s retirement`, type: "ira", balance: ira, ownerId: "me" });
  p.accounts.push({ id: "chk", name: "Checking", type: "checking", balance: checking }, { id: "sav", name: "Savings", type: "savings", balance: savings });
  p.income.push({ id: "pay", name: "Pay", type: "salary", personId: "me", amount: pay, period: "annual" });
  p.retirement.spendingMonthly = spend;
  p.retirement.socialSecurity = { me: { monthlyAtFRA: ss } };
  p.retirement.workPlans = { me: { plan: !!k401, ...(noMatch ? { match: false } : {}) } };
  if (amount !== null) p.retirement.contributions.push({ id: "row", accountId: "k", personId: "me", period: "monthly", amount, employerMatch: match });
  p.guide = { setup: { status: { me: "work" } } };
  return p;
}
function near(a, b, tol = 0.5) { assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`); }

// --- fix round 2 (2026-11-13): simple first, N2, N4 ---------------------------------------------------------------------------------
test("simple first (owner, 2026-11-12 and 2026-11-13; fix round 2): three change cards first, the rest one quiet tap away; the goal's chips first, its options folded and saying when one is in use", async () => {
  const { firstLevers, FIRST_CARDS } = await import("./compute.js");
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const live = { "scenarios/goal-seek": (plan, params) => compute(plan, params) };
  // the order: worth money first (the Social Security card that gets there or adds room; the 401(k) with nothing going in, while
  // saving gets there), then on its own, room, just right, not on its own; never the return it needs (a grey line, not a card)
  assert.equal(FIRST_CARDS, 3);
  const L = (id, status, extra = {}) => ({ id, status, title: id, ...extra });
  const order = (ls) => { const { shown, more } = firstLevers(ls); return [shown.map((l) => l.id), more.map((l) => l.id)]; };
  assert.deepEqual(order([L("spending", "needs"), L("retire", "cannot"), L("saving", "needs", { idle: ["k"] }), L("returns", "needs", { info: true }), L("lump", "needs"), L("claim", "same")]), [["spending", "saving", "lump"], ["retire", "claim"]]);
  assert.deepEqual(order([L("spending", "cannot"), L("retire", "needs"), L("saving", "needs"), L("lump", "needs"), L("claim", "needs")]), [["retire", "saving", "claim"], ["spending", "lump"]]);
  assert.deepEqual(order([L("spending", "room"), L("retire", "room"), L("saving", "room"), L("lump", "room"), L("claim", "room")]), [["spending", "retire", "claim"], ["saving", "lump"]]);
  assert.deepEqual(order([L("spending", "room"), L("returns", "room", { info: true }), L("lump", "room")]), [["spending", "lump"], []]);
  // the page, Casey (a fresh copy of the view: what a person opened is kept on the device, so earlier tests' taps would show)
  const view = new URL("./view.js?simple-first", import.meta.url);
  const r = await renderPage(view, casey(), T11, { computeRemote: live });
  // the parts are drawn by core/ui/more.js (gap #21, docs/OPTIONAL.md): found by their names, never by a hand-written class
  const details = (id) => r.root.querySelectorAll("details").find((x) => x.dataset.part === id);
  const rest = details("changes");
  assert.ok(rest && !rest.hasAttribute("open"), "the rest starts closed");
  assert.equal(rest.dataset.kind, "more");
  // its status names what is inside only when that fits in 20 characters ("retiring, Social Security" does not)
  assert.match(rest.querySelector("summary").textContent, /^2 more changes›$/);
  const inRest = rest.querySelectorAll(".gs-lever");
  const first = r.root.querySelectorAll(".gs-lever").filter((x) => !inRest.includes(x));
  assert.deepEqual(first.map((x) => x.querySelector(".gs-t").textContent), ["What you can spend", "What you need to save", "What it is short today"]);
  assert.equal(inRest.length, 2);
  // the goal: four chips, then "Set my own numbers" (closed; "More options" until gap #21), whose status says what is in it
  const goal = r.root.querySelectorAll("section").find((x) => /The goal/.test(x.textContent));
  const opts = details("goal");
  assert.ok(opts && !opts.hasAttribute("open") && goal.querySelectorAll("details").includes(opts));
  assert.equal(opts.dataset.kind, "own");
  assert.equal(opts.querySelector("summary").textContent, "Set my own numbers bad luck, own amount›");
  assert.deepEqual(goal.querySelectorAll(".chip").filter((c) => !opts.querySelectorAll(".chip").includes(c)).map((c) => c.textContent), ["Just last", "Leave $250,000", "Leave $500,000", "Leave $1,000,000"]);
  assert.deepEqual(opts.querySelectorAll(".chip").map((c) => c.textContent), ["Room for bad luck"]);
  assert.ok(opts.querySelectorAll("input").length === 1 && opts.querySelectorAll("button").some((b) => b.textContent === "Use this"));
  // the Social Security card's bars by age: one tap away, under "See each age" (a part of kind item: the card's own row, which may
  // sit inside "N more changes", R11)
  const each = details("claim-ages");
  assert.ok(each && !each.hasAttribute("open")); assert.equal(each.dataset.kind, "item"); assert.equal(each.querySelector("summary").textContent, "See each age›"); assert.equal(each.querySelectorAll(".gs-claims").length, 1);
  // an amount of their own: the line says so and the fold stays open
  const box = opts.querySelectorAll("input")[0];
  box.setAttribute("value", "150,000");
  opts.querySelectorAll("form")[0].dispatch("submit"); await new Promise((x) => setTimeout(x, 0));
  assert.equal(r.remote[r.remote.length - 1].params.legacy, 150000);
  const opts2 = details("goal");
  assert.ok(opts2.hasAttribute("open")); assert.match(opts2.querySelector("summary").textContent, /^Set my own numbers 1 set by you›$/);
  // an error opens it and says what to do, under the box
  const box2 = opts2.querySelectorAll("input")[0]; box2.setAttribute("value", "lots");
  opts2.open = false; opts2.querySelectorAll("form")[0].dispatch("submit");
  assert.equal(opts2.open, true); assert.match(opts2.textContent, /Type an amount in dollars, like 150,000, or 0 to just last\./);
  // room for bad luck on: said in the line too
  opts2.querySelectorAll(".chip")[0].click(); await new Promise((x) => setTimeout(x, 0));
  assert.match(details("goal").querySelector("summary").textContent, /^Set my own numbers 2 set by you›$/);
  // opening or closing anything changes nothing in the plan
  assert.deepEqual(r.saved, []);
  // a plan with another spending rule: its note is in "How this is worked out", not under the heading
  const g = familyPlan(T11); g.retirement.strategy = "guardrails";
  const r2 = await renderPage(new URL("./view.js?simple-first-2", import.meta.url), g, T11, { computeRemote: live });
  const how = r2.root.querySelectorAll("details").find((x) => x.dataset.part === "how");
  assert.match(how.textContent, /your plan uses another rule/);
  const head = r2.root.querySelectorAll("section").find((x) => /How far each change could go|What each change would have to be/.test(x.textContent));
  assert.doesNotMatch(head.querySelector("p").textContent, /another rule/);
});

test("fix round 2 (N4): at 320 px a card's title keeps a column wide enough for its words; the pill moves under it", () => {
  const src = fs.readFileSync(fileURLToPath(new URL("./view.js", import.meta.url)), "utf8");
  assert.match(src, /\.gs-root \.gs-top \{[^}]*flex-wrap: wrap/);
  assert.match(src, /\.gs-root \.gs-t \{ flex: 1 1 8\.5em;/);
});

test("fix round 2 (N2, for claude-f's Plan health score): a caller asking for `only` some levers gets the 401(k) answer with savingInto 'work', the amount that works typed there", () => {
  // the score's hint asks for only spending, retiring and saving and, by default, the plain search into savings ($670 for Casey):
  // its own test pins that figure, so the switch is claude-f's to make; this is what it gets when it passes savingInto: "work"
  const fast = lever(compute(casey(), { today: T11, only: ["spending", "retire", "saving"], retireSearch: "bisect", savingInto: "work" }), "saving");
  const page = lever(compute(casey(), { today: T11 }), "saving");
  assert.equal(fast.value, page.value); assert.equal(fast.sentence, page.sentence);
  assert.deepEqual(fast.into.map((x) => [x.accountId, x.monthly]), [["k", 790]]);
  // that amount typed into the 401(k) reaches the goal; the plain figure typed there still runs out
  const typedAt = (amt) => { const p = casey(); p.retirement.contributions[0].amount = amt; return compute(p, { today: T11, only: ["spending"] }).meets; };
  assert.equal(typedAt(790), true); assert.equal(typedAt(670), false);
});


test("final fix (rule 7): the saving card that names an idle 401(k) stays in the first view when saving alone cannot get there", async () => {
  const { firstLevers } = await import("./compute.js");
  const { ARCHETYPES, COMMON_PACKS } = await import("../../../qa/households/lib/catalog.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  // made up: "not on its own" with an idle 401(k) is kept ahead of the other cards; without one it is still last
  const L = (id, status, extra = {}) => ({ id, status, title: id, ...extra });
  const order = (ls) => { const { shown, more } = firstLevers(ls); return [shown.map((l) => l.id), more.map((l) => l.id)]; };
  assert.deepEqual(order([L("spending", "needs"), L("retire", "cannot"), L("saving", "cannot", { idle: ["k"] }), L("lump", "needs"), L("claim", "same")]), [["spending", "saving", "lump"], ["retire", "claim"]]);
  assert.deepEqual(order([L("spending", "needs"), L("retire", "cannot"), L("saving", "cannot"), L("lump", "needs"), L("claim", "cannot")]), [["spending", "retire", "lump"], ["saving", "claim"]]);
  assert.deepEqual(order([L("spending", "needs"), L("retire", "needs"), L("saving", "room", { idle: ["k"] }), L("lump", "needs")]), [["spending", "retire", "lump"], ["saving"]], "with room it is not a hint");
  // the qa couple spending more than comes in (the final skeptic's plan): Priya's 401(k) holds $92,000 and nothing goes in
  const plan = (() => { const p = ARCHETYPES.find((a) => a.id === "02-couple-no-kids").build(); COMMON_PACKS.expenses.find((v) => v.slug === "spending-above-income").apply(p); return migrate(p); })();
  for (const params of [{ legacy: 0 }, { legacy: 0, spendingScale: 1.15 }, { legacy: 250000 }]) {
    const d = compute(plan, { today: T11, ...params });
    const saving = lever(d, "saving");
    assert.equal(saving.status, "cannot"); assert.ok(saving.idle?.length);
    assert.match(saving.sentence, /^No amount of saving gets there before retirement\. Priya's 401\(k\) holds \$92,000, but nothing goes into it now\. If some of each paycheck does go in, add it on Retirement contributions\.$/);
    const { shown, more } = firstLevers(d.levers);
    assert.ok(shown.includes(saving), JSON.stringify(params)); assert.equal(shown.length, 3);
    assert.ok(more.every((l) => !/nothing goes into it/.test(l.sentence)));
  }
  // on the page: the card is above the fold, and "1 more change" names retiring
  const live = { "scenarios/goal-seek": (p, params) => compute(p, params) };
  const r = await renderPage(new URL("./view.js?idle-cannot", import.meta.url), plan, T11, { computeRemote: live });
  const rest = r.root.querySelectorAll("details").find((x) => x.dataset.part === "changes");
  const inRest = rest ? rest.querySelectorAll(".gs-lever") : [];
  const first = r.root.querySelectorAll(".gs-lever").filter((x) => !inRest.includes(x));
  assert.ok(first.some((x) => /Priya's 401\(k\) holds \$92,000, but nothing goes into it now/.test(x.textContent)));
  assert.ok(inRest.every((x) => !/nothing goes into it/.test(x.textContent)));
  assert.match(rest.querySelector("summary").textContent, /^1 more change retiring›$/);
  assert.deepEqual(r.saved, []);
});

// ---------------------------------------------------------------- gap #21: a row for each retirement age (2026-11-13)
// One `more` part, "N more ages", lazy: one line per age from today's age or 55 to 70, the plan with only that adult's retirement
// age moved (Scenario compare's "Retire at age" lever), run once at average markets; "could spend" from affordableSpending.
const T13 = "2026-11-13";
const qaPlans = async () => {
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  return [["family", familyPlan(T13)], ["renterDebt", renterDebtPlan()], ["retiredCouple", retiredCouplePlan()], ["empty", emptyPlan()], ["casey", casey()], ...ARCHETYPES.map((a) => [a.id, a.build()])]
    .map(([n, p]) => [n, migrate(structuredClone(p))]);
};

test("gap #21 (test 2): the ages shown, from today's age or 55 to 70, widened to take in Goal seek's own answer; the count is the rows", async () => {
  const { ageSpan, AGES_FROM, AGES_TO } = await import("./compute.js");
  assert.deepEqual([AGES_FROM, AGES_TO], [55, 70]);
  assert.deepEqual(ageSpan({ ageNow: 36, planned: 65, answer: 62 }), { from: 55, to: 70, n: 16 });
  assert.deepEqual(ageSpan({ ageNow: 61, planned: 65, answer: 61 }), { from: 61, to: 70, n: 10 });
  assert.deepEqual(ageSpan({ ageNow: 40, planned: 65, answer: null }), { from: 55, to: 70, n: 16 }, "no age works: 55 to 70 all the same");
  assert.deepEqual(ageSpan({ ageNow: 35, planned: 60, answer: 48 }), { from: 48, to: 70, n: 23 }, "an answer before 55 is the first row");
  assert.deepEqual(ageSpan({ ageNow: 50, planned: 67, answer: 72 }), { from: 55, to: 72, n: 18 }, "an answer after 70 is the last row");
  assert.deepEqual(ageSpan({ ageNow: 66, planned: 72, answer: 66 }), { from: 66, to: 72, n: 7 }, "a planned age past 70 is the last row");
  assert.equal(ageSpan({ ageNow: null, planned: 65 }), null);
  // the page's title count (agesFor, drawn before anything is worked out) is the number of rows worked out when the part opens
  const { agesFor } = await import("./compute.js");
  let withRows = 0;
  for (const [name, p] of await qaPlans()) {
    const d = compute(p, { today: T13, only: ["retire"] });   // the card alone (the same card as the whole page's: test 1)
    if (!d.ready || d.noSavings) continue;
    const r = lever(d, "retire");
    const a = compute(p, { today: T13, only: [], ages: true }).ages;
    const span = agesFor(p, { today: T13, lever: r });
    if (!r) { assert.equal(a, undefined, `${name}: no card, no rows`); assert.equal(span, null, name); continue; }
    withRows++;
    assert.equal(a.rows.length, span.n, name); assert.equal(a.n, span.n, name);
    assert.deepEqual(a.rows.map((x) => x.age), Array.from({ length: span.n }, (_, i) => span.from + i), name);
  }
  assert.ok(withRows >= 10, `${withRows} households with rows`);
  const fam = compute(familyPlan(T13), { today: T13, only: [], ages: true }).ages;
  assert.equal(fam.rows.length, 16); assert.equal(fam.rows[0].age, 55); assert.equal(fam.rows.at(-1).age, 70);
});

test("gap #21 (test 1): the first age that lasts is Goal seek's answer, for every goal, with and without room for bad luck", async () => {
  let checked = 0;
  // the card asked for alone is the whole page's card
  assert.deepEqual(lever(compute(familyPlan(T13), { today: T13, only: ["retire"] }), "retire"), lever(compute(familyPlan(T13), { today: T13 }), "retire"));
  for (const [name, p] of await qaPlans()) for (const params of [{ legacy: 0 }, { legacy: 500000 }, { legacy: 0, spendingScale: 1.15 }]) {
    const d = compute(p, { today: T13, ...params, only: ["retire"] });
    const r = d.ready && !d.noSavings ? lever(d, "retire") : null;
    if (!r) continue;
    const a = compute(p, { today: T13, ...params, only: [], ages: true }).ages;
    assert.equal(a.answer, r.value, `${name} ${JSON.stringify(params)}: drawn around the card's age`);
    const first = a.rows.find((x) => x.lasts) ?? null;
    assert.equal(first?.age ?? null, r.value, `${name} ${JSON.stringify(params)}: the first age that lasts`);
    if (r.value !== null) assert.ok(a.rows.filter((x) => x.age >= r.value).every((x) => x.lasts), `${name}: every later age lasts too`);
    checked++;
  }
  assert.ok(checked >= 30, `${checked} cases`);
  // each row is the plan rebuilt with that one age, run once at average markets, spending the same every year (made by hand here)
  const p = familyPlan(T13);
  const a = compute(p, { today: T13, only: [], ages: true }).ages;
  for (const row of a.rows) {
    const q = familyPlan(T13); q.household.people[0].retirementAge = row.age; q.retirement.strategy = "fixed-real";
    const inp = buildInputs(q, { today: T13 }).inputs;
    const run = project({ ...inp, strategy: "fixed-real" });
    assert.equal(row.lasts, run.success, `age ${row.age}`);
    assert.equal(row.runsOutAt, run.success ? null : run.failYear - 1990, `age ${row.age}`);
    assert.equal(row.lastsTo, inp.endYear - 1990);
    assert.equal(row.stopYear, Math.max(2026, 1990 + row.age));
  }
  assert.deepEqual(a.rows.filter((x) => x.lasts).map((x) => x.age)[0], 62);
});

test("gap #21: could spend is the most a month that still gets there (affordableSpending), and with an amount to leave, the spending card's search", async () => {
  const { affordableSpending } = await import("../../../core/math/retirement.js");
  const p = familyPlan(T13);
  const a = compute(p, { today: T13, only: [], ages: true }).ages;
  const at = (age, scale = 1) => { const q = familyPlan(T13); q.household.people[0].retirementAge = age; q.retirement.strategy = "fixed-real"; return buildInputs(q, { today: T13 }).inputs; };
  const row = a.rows.find((x) => x.age === 64);
  assert.ok(row.lasts);
  near(row.monthly, affordableSpending(at(64)) / 12, 1e-9);
  // the edge: the figure shown (rounded down to $10) lasts, $2 a month more than the figure worked out does not
  const { roundDown } = await import("./compute.js");
  const run = (s, legacy = 0) => { const r = project({ ...at(64), strategy: "fixed-real", spending: { yearly: s } }); return r.success && r.endBalanceReal >= legacy - 0.5; };
  assert.ok(run(roundDown(row.monthly) * 12) && !run(row.monthly * 12 + 24));
  // rows that do not last have no figure
  assert.ok(a.rows.filter((x) => !x.lasts).every((x) => x.monthly === null));
  // leaving $500,000: the most that lasts AND leaves it, to $1 a year
  const b = compute(p, { today: T13, legacy: 500000, only: [], ages: true }).ages;
  const r2 = b.rows.find((x) => x.age === 66);
  assert.ok(r2.lasts && r2.endReal >= 500000 - 0.5);
  const run66 = (s) => { const r = project({ ...at(66), strategy: "fixed-real", spending: { yearly: s } }); return r.success && r.endBalanceReal >= 500000 - 0.5; };
  assert.ok(run66(roundDown(r2.monthly) * 12) && run66(r2.monthly * 12) && !run66(r2.monthly * 12 + 2));
  assert.ok(r2.monthly < a.rows.find((x) => x.age === 66).monthly, "leaving money means spending less");
  // room for bad luck: "lasts" is tested at 1.15 times the spending, and could spend is in the plan's terms (divided by 1.15)
  const c = compute(p, { today: T13, spendingScale: 1.15, only: [], ages: true }).ages;
  const r3 = c.rows.find((x) => x.age === 66);
  near(r3.monthly, affordableSpending(at(66)) / 12 / 1.15, 1e-9);
  const plain = at(65), scaledRun = project({ ...plain, strategy: "fixed-real", spending: { ...plain.spending, yearly: plain.spending.yearly * 1.15 } });
  assert.equal(c.rows.find((x) => x.age === 65).lasts, scaledRun.success);
});

test("gap #21 (test 3): a couple: only the first adult's age moves, the partner keeps theirs, and the part says so", async () => {
  const p = familyPlan(T13);   // Ana (36, planned 65) and Bo (38, planned 62)
  const a = compute(p, { today: T13, only: [], ages: true }).ages;
  assert.equal(a.personId, "p-ana"); assert.deepEqual(a.others, [{ id: "p-bo", name: "Bo", works: true, age: 62 }]);
  for (const row of a.rows) {
    const only = familyPlan(T13); only.household.people[0].retirementAge = row.age; only.retirement.strategy = "fixed-real";
    const both = familyPlan(T13); both.household.people[0].retirementAge = row.age; both.household.people[1].retirementAge = row.age; both.retirement.strategy = "fixed-real";
    const a1 = project({ ...buildInputs(only, { today: T13 }).inputs, strategy: "fixed-real" });
    assert.equal(row.lasts, a1.success, `age ${row.age}: Bo keeps 62`);
    if (row.age === 70) assert.notEqual(JSON.stringify(project({ ...buildInputs(both, { today: T13 }).inputs, strategy: "fixed-real" }).rows.at(-1)), JSON.stringify(a1.rows.at(-1)), "moving Bo too would change the run");
  }
  // the plan itself is not changed by working the rows out
  assert.equal(p.household.people[0].retirementAge, 65); assert.equal(p.household.people[1].retirementAge, 62);
  const { agesWords } = await import("./compute.js");
  assert.equal(agesWords(a).at(-1), "Only Ana's age changes: Bo still stops work at 62.");
});

test("gap #21: one written sentence per case (R5): each line, and the words above the lines", async () => {
  const { ageLine, agesWords } = await import("./compute.js");
  // the three lines, the design's own examples
  assert.equal(ageLine({ age: 62, lasts: false, runsOutAt: 81, lastsTo: 92 }, { planned: 65 }), "62: runs out at 81");
  assert.equal(ageLine({ age: 64, lasts: true, runsOutAt: null, lastsTo: 92, monthly: 6109.9 }, { planned: 65 }), "64: lasts to 92 · could spend $6,100 a month");
  assert.equal(ageLine({ age: 63, lasts: false, runsOutAt: null, lastsTo: 92, monthly: null }, { planned: 65, legacy: 500000 }), "63: lasts to 92, but leaves less than $500,000");
  // the planned age says so; could spend is a limit (rounded down to $10)
  assert.equal(ageLine({ age: 65, lasts: true, runsOutAt: null, lastsTo: 92, monthly: 6789.99 }, { planned: 65 }), "65, as planned: lasts to 92 · could spend $6,780 a month");
  assert.equal(ageLine({ age: 65, lasts: false, runsOutAt: 79, lastsTo: 92 }, { planned: 65 }), "65, as planned: runs out at 79");
  // the words above the lines
  const one = { name: "Me", others: [], healthOnTop: false };
  assert.deepEqual(agesWords(one), [
    "Each line is your plan with you stopping work at that age and everything else as it is, if markets do as well as average every year.",
    "\"Could spend\" is the most a month, steady, in today's dollars, that still gets there."]);
  assert.equal(agesWords({ ...one, healthOnTop: true })[1], "\"Could spend\" is the most a month, steady, in today's dollars, that still gets there, on top of health insurance.");
  assert.equal(agesWords(one, { legacy: 250000 })[2], "\"Lasts\" here means it also leaves $250,000 in today's dollars.");
  assert.equal(agesWords(one, { scale: 1.15 })[2], "Room for bad luck is on: every line is worked out for 15% more spending than you plan.");
  assert.equal(agesWords({ ...one, others: [{ name: "My spouse", works: true, age: 63 }] }).at(-1), "Only your age changes: your spouse still stops work at 63.");
  assert.equal(agesWords({ ...one, others: [{ name: "My spouse", works: false, age: 60 }] }).at(-1), "Only your age changes: your spouse's plan stays as it is.");
  assert.equal(agesWords({ name: "Jo", others: [{ name: "Me", works: false, age: 58 }] }).at(-1), "Only Jo's age changes: your plan stays as it is.");
  assert.equal(agesWords({ name: "Jo", others: [{ name: "Me", works: true, age: 64 }] }).at(-1), "Only Jo's age changes: you still stop work at 64.");
  assert.equal(agesWords({ ...one, others: [{ name: "Sam", works: true, age: 60 }, { name: "Lee", works: false }] }).at(-1), "Only your age changes: everyone else's plan stays as it is.");
});

test("gap #21 invariance (gap spec 3.5): without `ages`, compute() is what it was; with it, only `ages` is added", async () => {
  for (const [name, p] of await qaPlans()) {
    const before = compute(p, { today: T13 });
    assert.ok(!("ages" in before), name);
    const { ages, ...rest } = compute(p, { today: T13, ages: true });
    assert.equal(JSON.stringify(rest), JSON.stringify(before), `${name}: asking for the rows changes nothing else`);
    if (before.ready && lever(before, "retire")) assert.ok(ages?.rows?.length, name); else assert.equal(ages, undefined, name);
  }
});

// the page: the part is one row of the parts card, shut, and nothing is worked out for it until it is opened or printed
const pageOf = async (plan, tag, route) => {
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const live = { "scenarios/goal-seek": (p, params) => compute(p, params) };
  return renderPage(new URL(`./view.js?${tag}`, import.meta.url), plan, T13, { computeRemote: live, ...(route ? { route } : {}) });
};
const partIn = (root, id) => root.querySelectorAll("details").find((x) => x.dataset.part === id) ?? null;
const agesCalls = (r) => r.remote.filter((x) => x.params.ages === true);
const tick = () => new Promise((x) => setTimeout(x, 0));

test("gap #21 (test 4): lazy: the ages are worked out when the part is opened, and when the page prints; never before", async () => {
  const more = await import("../../../core/ui/more.js");
  more._test.reset();
  const r = await pageOf(familyPlan(T13), "ages-lazy");
  // the first view: unchanged answer first; the part is a shut row of the one parts card, after the cards, before nothing else
  const ages = partIn(r.root, "ages");
  assert.ok(ages && !ages.hasAttribute("open"));
  assert.equal(ages.dataset.kind, "more");
  assert.equal(ages.querySelector("summary").textContent, "16 more ages retiring at 55 to 70›");
  const card = r.root.querySelectorAll("section").find((s) => s.dataset.parts !== undefined);
  assert.deepEqual(card.querySelectorAll("details").map((x) => x.dataset.part), ["ages", "how"]);
  assert.equal(ages.querySelector(".fold-body").childNodes.length, 0, "nothing built before it is opened");
  assert.equal(agesCalls(r).length, 0, "nothing worked out before it is opened");
  // the answer stays first (the hero, then the goal, then the cards with "When Ana can retire: age 62"); the part comes after them
  const sections = r.root.querySelectorAll("section");
  assert.ok(sections[0].classList.contains("hero"));
  assert.ok(sections.indexOf(card) > sections.findIndex((x) => x.querySelectorAll(".gs-lever").length), "after the cards");
  assert.ok(r.root.querySelectorAll(".gs-lever").some((x) => /When Ana can retire/.test(x.textContent) && /age 62/.test(x.textContent)));
  // opened: the words at once, then one line per age from the computer (or this device), the card's own age in bold
  ages.setAttribute("open", ""); ages.dispatch("toggle");
  assert.equal(agesCalls(r).length, 1);
  assert.deepEqual(agesCalls(r)[0].params, { today: T13, legacy: 0, only: [], ages: true });
  assert.match(ages.textContent, /Each line is your plan with Ana stopping work at that age/);
  assert.match(ages.textContent, /Working out each age\.\.\./);
  await tick();
  const lines = ages.querySelectorAll("li");
  assert.equal(lines.length, 16);
  assert.equal(lines[0].textContent, "55: runs out at 70");
  assert.equal(lines.find((li) => li.dataset.age === "62").querySelector("strong").textContent, lines.find((li) => li.dataset.age === "62").textContent, "the card's age in bold");
  assert.match(lines.find((li) => li.dataset.age === "65").textContent, /^65, as planned: lasts to 95 · could\u00a0spend\u00a0\$[\d,]+0\u00a0a\u00a0month$/, "kept on one line");
  assert.match(ages.textContent, /Only Ana's age changes: Bo still stops work at 62\./);
  assert.doesNotMatch(ages.textContent, /Working out/);
  // opening it again works nothing out again
  ages.removeAttribute("open"); ages.dispatch("toggle"); ages.setAttribute("open", ""); ages.dispatch("toggle");
  assert.equal(agesCalls(r).length, 1);
  assert.deepEqual(r.saved, [], "opening changes nothing in the plan");
  // printing: every shut part opens, the ages are built and worked out (core/ui/more.js openAll, as on beforeprint)
  const p2 = await pageOf(familyPlan(T13), "ages-print");
  assert.equal(agesCalls(p2).length, 0);
  const shutAgain = more.openAll(p2.root);
  assert.equal(agesCalls(p2).length, 1);
  await tick();
  assert.equal(partIn(p2.root, "ages").querySelectorAll("li").length, 16);
  shutAgain();
  assert.ok(!partIn(p2.root, "ages").hasAttribute("open"));
  // the goal and room for bad luck the cards were worked out for are the rows' too
  const p3 = await pageOf(familyPlan(T13), "ages-badluck", { rest: [], query: { target: "badluck" } });
  partIn(p3.root, "ages").setAttribute("open", ""); partIn(p3.root, "ages").dispatch("toggle");
  assert.deepEqual(agesCalls(p3)[0].params, { today: T13, legacy: 0, spendingScale: 1.15, only: [], ages: true });
  // a household with no working adult (the retired couple) and one with no savings told have no such part
  for (const [plan, tag] of [[(await import("../../../qa/fixtures/retired-couple-plan.mjs")).retiredCouplePlan(), "ages-retired"], [emptyPlan(), "ages-empty"]]) {
    const q = await pageOf(plan, tag);
    assert.equal(partIn(q.root, "ages"), null, tag);
  }
});

// docs/OPTIONAL.md S11 (R17): Goal seek saves nothing to the plan; its own figures (an amount to leave, room for bad luck) are kept on
// this device and the page works its answers out again. After "Use this" or the bad-luck chip, "Set my own numbers" stays open and
// no other part opens or shuts: the reading parts the person opened stay open, the shut ones shut.
test("S11: after Use this or the bad-luck chip only Set my own numbers changes; the ages and How this is worked out stay as they were", async () => {
  const more = await import("../../../core/ui/more.js");
  more._test.reset();
  const states = (root) => Object.fromEntries(root.querySelectorAll("details").filter((x) => x.dataset.part !== undefined).map((x) => [x.dataset.part, x.hasAttribute("open")]));
  const r = await pageOf(familyPlan(T13), "s11");
  const before = states(r.root);
  assert.deepEqual(before, { goal: false, "claim-ages": false, changes: false, ages: false, how: false });
  // the person opens the ages with a tap (kept on this phone, a reading part) and Set my own numbers
  const ages = partIn(r.root, "ages");
  ages.setAttribute("open", ""); ages.dispatch("toggle"); ages.querySelector("summary").dispatch("click", { isTrusted: true });
  const goal = partIn(r.root, "goal");
  goal.setAttribute("open", ""); goal.dispatch("toggle");
  await tick();
  const box = goal.querySelectorAll("input")[0];
  box.setAttribute("value", "150,000");
  goal.querySelectorAll("form")[0].dispatch("submit");
  await tick(); await tick();
  assert.deepEqual(states(r.root), { ...before, goal: true, ages: true }, "Set my own numbers stays open, the ages stay open, nothing else moves");
  assert.equal(r.remote.filter((x) => x.params.legacy === 150000 && x.params.ages === true).length, 1, "the open ages follow the new goal");
  assert.match(partIn(r.root, "ages").textContent, /"Lasts" here means it also leaves \$150,000 in today's dollars\./);
  partIn(r.root, "goal").querySelectorAll(".chip")[0].click();
  await tick(); await tick();
  assert.deepEqual(states(r.root), { ...before, goal: true, ages: true });
  assert.match(partIn(r.root, "goal").querySelector("summary").textContent, /^Set my own numbers 2 set by you›$/);
  assert.deepEqual(r.saved, [], "nothing is written to the plan");
  // a new visit: the part with boxes shuts again; the ages the person opened stay open (this phone remembers a reading part)
  const again = await pageOf(familyPlan(T13), "s11");
  assert.equal(partIn(again.root, "goal").hasAttribute("open"), false);
  assert.equal(partIn(again.root, "ages").hasAttribute("open"), true);
  more.kept.clear("all"); more._test.reset();
});

test("gap #21 (R14): the parts made from hand-written folds hold their figures: the bad-luck amounts, and the first and last claiming age", async () => {
  const r = await pageOf(familyPlan(T13), "ages-figures");
  const d = compute(familyPlan(T13), { today: T13 });
  const near10 = (n) => `$${(Math.round(n / 10) * 10).toLocaleString("en-US")}`, down10 = (n) => `$${(Math.floor(n / 10 + 1e-9) * 10).toLocaleString("en-US")}`;
  const goal = partIn(r.root, "goal");
  assert.ok(goal.textContent.includes(`Plans for spending 15% more than you expect (${near10(d.spendingMonthly * 1.15)} a month instead of ${near10(d.spendingMonthly)}), in case markets or prices turn out worse.`), goal.textContent);
  const c = lever(d, "claim");
  assert.equal(partIn(r.root, "claim-ages").querySelector("p").textContent, `About ${down10(c.results[0].monthly)} a month claiming at ${c.results[0].age}, about ${down10(c.results.at(-1).monthly)} at 70.`);
});

// ---------------------------------------------------------------- gap list, next 60, #31 (map A8): when will your savings reach a
// figure, and could you stop work then. Savings are what Will the money last? counts: today's four buckets, then each year's
// end-of-year total in today's dollars of the plan run as it is; "stop then" is the line of that age in "N more ages".
const o2 = await import("./compute.js");
const tgt = (plan, figure, extra = {}) => compute(plan, { today: T13, only: [], target: figure, ...extra }).target;
const rowAt = (plan, age, extra = {}) => compute(plan, { today: T13, only: [], ages: true, ...extra }).ages.rows.find((x) => x.age === age);
const nearRetire = async () => { const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs"); const { migrate } = await import("../../../core/schema/migrate.js"); return migrate(structuredClone(ARCHETYPES.find((a) => a.id === "09-near-retirement").build())); };

test("o2 (#31): reaching: the first year the plan's own savings reach the figure, by hand from Will the money last?'s run; stopping then is that age's line", async () => {
  const p = familyPlan(T13);
  const t = tgt(p, 1000000);
  // by hand: the projection Will the money last? draws (the plan as it is), end-of-year totals in today's dollars
  const I2 = buildInputs(familyPlan(T13), { today: T13 }).inputs;
  const rows = project(I2).rows;
  const k = rows.findIndex((x) => x.totalReal >= 1000000);
  assert.ok(k > 0 && rows[k - 1].totalReal < 1000000);
  assert.equal(rows[k].year, 2049);
  assert.deepEqual(t.reach, { year: 2050, age: 60, already: false }, "reached by the start of the next year, the year Ana turns 60");
  near(t.now, I2.balances.cash + I2.balances.taxable + I2.balances.deferred + I2.balances.free, 1e-9);
  assert.equal(t.personId, "p-ana"); assert.equal(t.planned, 65); assert.equal(t.when, "earlier");
  // stopping at 60 is the 60 line of "16 more ages": runs out at 79
  const r60 = rowAt(p, 60);
  assert.equal(t.stop.age, 60); assert.equal(t.stop.year, 2050);
  assert.equal(t.stop.lasts, r60.lasts); assert.equal(t.stop.runsOutAt, r60.runsOutAt); assert.equal(t.stop.lastsTo, r60.lastsTo);
  assert.equal(t.stop.runsOutAt, 79); assert.equal(t.stop.meets, false); assert.equal(o2.canUseAge(t), false, "no button to an age that runs out");
  assert.equal(o2.reachWords(t), "Your savings would reach $1,000,000 by 2050, the year Ana turns 60, if markets do as well as average.");
  assert.equal(o2.stopWords(t), "If Ana stopped work then, at 60, the money would run out at 79.");
  // $1,100,000: by 2052, at 62, the card's own age, which lasts: one outlined "Use age 62"
  const u = tgt(p, 1100000);
  assert.deepEqual(u.reach, { year: 2052, age: 62, already: false });
  assert.ok(u.stop.meets); assert.equal(o2.canUseAge(u), true);
  assert.equal(o2.stopWords(u), "If Ana stopped work then, at 62, the money would last to 95.");
  assert.equal(lever(compute(p, { today: T13, only: ["retire"] }), "retire").value, 62, "the card says 62 too");
  // with an amount to leave and room for bad luck, the line follows the page's goal, as the ages do
  for (const extra of [{ legacy: 500000 }, { spendingScale: 1.15 }]) {
    const v = tgt(p, 1100000, extra), row = rowAt(p, 62, extra);
    assert.equal(v.stop.meets, row.lasts, JSON.stringify(extra));
    assert.deepEqual(v.reach, u.reach, "the savings are the plan's as it is: the goal does not move them");
  }
  assert.equal(o2.stopWords(tgt(p, 1100000, { legacy: 500000 }), { legacy: 500000 }), "If Ana stopped work then, at 62, the money would last to 95 but leave less than $500,000.");
  // the plan is not changed by working it out
  assert.equal(p.household.people[0].retirementAge, 65);
});

test("o2 (#31): never reached says so, with the highest figure and when; savings that only fall are highest today", () => {
  const p = familyPlan(T13);
  const t = tgt(p, 2100000);
  const rows = project(buildInputs(familyPlan(T13), { today: T13 }).inputs).rows;
  const top = rows.reduce((a, x) => (x.totalReal > a.totalReal ? x : a));
  assert.equal(t.reach, null); assert.equal(t.when, null); assert.equal(t.stop, null);
  near(t.peak.value, top.totalReal, 1e-9);
  assert.deepEqual([t.peak.year, t.peak.age, t.peak.today], [top.year + 1, top.year + 1 - 1990, false]);
  assert.deepEqual([t.peak.year, t.peak.age], [2055, 65]);
  assert.equal(o2.reachWords(t), "Your savings never reach $2,100,000 with the plan as it is: the most is about $1,233,000, by 2055, the year Ana turns 65, if markets do as well as average.");
  assert.equal(o2.stopWords(t), null); assert.equal(o2.canUseAge(t), false);
  // just above the highest: still never, and the "about" figure is never above the figure asked for
  const edge = tgt(p, Math.ceil(top.totalReal) + 1);
  assert.equal(edge.reach, null);
  assert.match(o2.reachWords(edge), /the most is about \$1,233,000,/);
  // just at the highest: reached, the year it is highest
  assert.deepEqual(tgt(p, Math.floor(top.totalReal)).reach, { year: 2055, age: 65, already: false });
  // savings that only fall (every return -20% a year): highest today
  const q = familyPlan(T13); q.assumptions = { ...q.assumptions, returnStocks: -0.2, returnBonds: -0.2, returnCash: -0.2 };
  const f = tgt(q, 500000);
  assert.equal(f.reach, null); assert.equal(f.peak.today, true); near(f.peak.value, f.now, 1e-9);
  assert.equal(o2.reachWords(f), "Your savings never reach $500,000 with the plan as it is: they are highest today, about $192,000.");
});

test("o2 (#31): already there: today's savings, and stopping now is the plan with that adult stopping this year", async () => {
  const p = await nearRetire();   // Gloria 61 (planned 65) and Frank; $1,347,500 saved
  const t = tgt(p, 1000000);
  assert.ok(t.now >= 1000000);
  assert.deepEqual(t.reach, { year: 2026, age: 61, already: true });
  assert.equal(t.when, "earlier"); assert.equal(t.stop.age, 61); assert.equal(t.stop.year, 2026);
  // by hand: the plan with Gloria's retirement age set to 61, steady spending, run once
  const q = structuredClone(p); q.household.people.find((x) => x.id === t.personId).retirementAge = 61; q.retirement = { ...q.retirement, strategy: "fixed-real" };
  const inp = buildInputs(q, { today: T13 }).inputs, run = project({ ...inp, strategy: "fixed-real" });
  assert.equal(t.stop.lasts, run.success); assert.equal(t.stop.lastsTo, inp.endYear - 1965);
  assert.equal(o2.reachWords(t), "You already have more than $1,000,000 saved: about $1,348,000 today.");
  assert.equal(o2.stopWords(t), "If Gloria stopped work now, at 61, the money would last to 95.");
  assert.equal(o2.canUseAge(t), true);
  assert.equal(o2.targetConfirmWords(t), "Change Gloria's retirement age from 65 to 61? The plan then counts Gloria as stopping work this year. Undo puts it back, and so does the People page.");
  assert.equal(o2.targetSavedWords(t), "Saved: Gloria's retirement age is now 61, so Gloria stops work this year. The money would last to 95.");
  // exactly today's savings is already there; a dollar more is not (it is reached later or never)
  assert.equal(tgt(p, Math.floor(t.now)).reach.already, true);
  assert.notEqual(tgt(p, Math.ceil(t.now) + 1).reach?.already, true);
});

test("o2 (#31): a couple, and a first adult who has stopped: only the adult the ages are about moves; on every qa plan the stop line is that age's line", async () => {
  // the family: only Ana's age moves at the stop; Bo keeps his 62 (moving him too, to 60, would change the run)
  const p = familyPlan(T13);
  const t = tgt(p, 1100000);
  const only = familyPlan(T13); only.household.people[0].retirementAge = 62; only.retirement.strategy = "fixed-real";
  const both = familyPlan(T13); both.household.people[0].retirementAge = 62; both.household.people[1].retirementAge = 60; both.retirement.strategy = "fixed-real";
  const a1 = project({ ...buildInputs(only, { today: T13 }).inputs, strategy: "fixed-real" }), a2 = project({ ...buildInputs(both, { today: T13 }).inputs, strategy: "fixed-real" });
  near(t.stop.endReal, a1.endBalanceReal, 1e-9);
  assert.notEqual(a1.endBalanceReal, a2.endBalanceReal, "moving Bo too would change it");
  // Ana said she has stopped, Bo is paid: the question is about Bo, on the plan the card counts ("This counts Ana as stopped from
  // this year"): its savings are that plan's, so they never read "reach $340,000 at 60" beside "stopping at 60 runs out at 56"
  const s = familyPlan(T13); s.guide = { ...(s.guide ?? {}), setup: { ...(s.guide?.setup ?? {}), status: { "p-ana": "retired" } } };
  const { workingNow, withStops } = await import("../../retirement/projection/compute.js");
  const wn = workingNow(s, buildInputs(s, { today: T13 }).inputs, T13);
  assert.deepEqual(wn.stopNow, [{ personId: "p-ana", age: 36 }]);
  const b = tgt(s, 340000);
  assert.equal(b.personId, "p-bo"); assert.equal(b.name, "Bo");
  const sRows = project(buildInputs(withStops(s, wn.stopNow), { today: T13 }).inputs).rows;
  const first = sRows.find((x) => x.totalReal >= 340000 - 0.5);
  assert.deepEqual(b.reach, first ? { year: first.year + 1, age: first.year + 1 - 1988, already: false } : null);
  if (b.stop) assert.ok(b.stop.runsOutAt === null || b.stop.runsOutAt >= b.stop.age, "never runs out before the age it stops at");
  assert.match(o2.reachWords(b), /Bo turns \d+|highest today/);
  // every qa plan, every chip figure the page would offer: the stop line is the ages' line for that age, and the reach is the
  // first year of the plan's own run at or above the figure
  const { compute: fire } = await import("../../retirement/fire/compute.js");
  let checked = 0, earlier = 0;
  for (const [name, plan] of await qaPlans()) {
    const d = compute(plan, { today: T13, only: [], target: 0 });
    if (!d.ready || !d.target) { if (d.ready) assert.equal(lever(compute(plan, { today: T13, only: ["retire"] }), "retire"), undefined, `${name}: no adult at work, no answer`); continue; }
    const fi = fire(plan, { today: T13, withIncome: false });
    const chips = o2.targetChips({ fi: fi.ready ? fi.fiNumber : null, years: fi.ready ? 1 / fi.withdrawalRate : null, spendingYearly: d.spendingMonthly * 12, peak: d.target.peak.value, now: d.target.now });
    assert.ok(chips.length >= 2 && chips.length <= 4, `${name}: ${chips.length} chips`);
    // fix round 1: one rule-of-thumb chip (F2), and the figure the part opens on is one of the chips (P5)
    assert.equal(chips.filter((c) => c.kind !== "round").length, 1, `${name}: one rule of thumb`);
    assert.ok(chips.some((c) => c.value === o2.targetDefault(chips, { now: d.target.now, peak: d.target.peak.value })), `${name}: the default is a chip`);
    const ages = compute(plan, { today: T13, only: [], ages: true }).ages;
    const wn = workingNow(plan, buildInputs(plan, { today: T13 }).inputs, T13);
    const rows = project(buildInputs(withStops(plan, wn.stopNow), { today: T13 }).inputs).rows;
    for (const c of chips) {
      const x = tgt(plan, c.value);
      checked++;
      if (!x.reach) { assert.ok(rows.every((r) => r.totalReal < c.value - 0.5) && x.now < c.value - 0.5, `${name} ${c.value}: never`); continue; }
      if (!x.reach.already) assert.equal(rows.find((r) => r.totalReal >= c.value - 0.5).year + 1, x.reach.year, `${name} ${c.value}`);
      if (x.when !== "earlier") { assert.equal(x.stop, null); continue; }
      earlier++;
      const line = ages.rows.find((r) => r.age === x.stop.age);
      if (line) { assert.equal(x.stop.lasts, line.lasts, `${name} ${c.value}`); assert.equal(x.stop.meets, line.lasts); assert.equal(x.stop.runsOutAt, line.runsOutAt); assert.equal(x.stop.lastsTo, line.lastsTo); }
      assert.equal(o2.canUseAge(x), x.stop.meets);
    }
    // a chip the savings reach, when they reach any figure above today's
    if (d.target.peak.value >= 10000 + d.target.now) assert.ok(chips.some((c) => c.value <= d.target.peak.value + 0.5), `${name}: one chip answers "by when"`);
  }
  assert.ok(checked >= 40 && earlier >= 10, `${checked} figures, ${earlier} with a stop line`);
});

test("o2 (#31): the chips: one rule of thumb (the Financial independence figure, else 25 times spending), round figures near it, low to high, at most four", async () => {
  const { compute: fire } = await import("../../retirement/fire/compute.js");
  const p = familyPlan(T13);
  const fr = fire(p, { today: T13, withIncome: false }), fi = fr.fiNumber, d = compute(p, { today: T13, only: [], target: 0 });
  assert.equal(Math.round(fi), 2100000); assert.equal(d.spendingMonthly * 12 * 25, 2100000); assert.equal(1 / fr.withdrawalRate, 25);
  // the family: the rule of thumb, the round figure under it, and $1,000,000, which the savings do reach
  const fam = o2.targetChips({ fi, years: 1 / fr.withdrawalRate, spendingYearly: d.spendingMonthly * 12, peak: d.target.peak.value, now: d.target.now });
  assert.deepEqual(fam, [{ value: 1000000, kind: "round" }, { value: 2000000, kind: "round" }, { value: 2100000, kind: "fi", years: 25 }]);
  // fix round 1, P3 and P4: "(enough to live on)" read as the plan failing beside "Your plan works", "(25 times spending)" was jargon
  assert.deepEqual(fam.map((c) => o2.chipLabel(c)), ["$1,000,000", "$2,000,000", "$2,100,000 (25 years of spending)"]);
  assert.equal(o2.ruleWords(fam), "\"25 years of spending\" is the figure on the Financial independence page: a common rule of thumb for living on savings alone. It counts no Social Security or pension, so a plan that has them can work with less.");
  // reachable: the round figure under it and the one over it
  assert.deepEqual(o2.targetChips({ fi: 2100000, spendingYearly: 84000, peak: 3e6, now: 1e5 }).map((c) => c.value), [2000000, 2100000, 2250000]);
  // fix round 1, F2: the two figures 12% apart (01-single-adult's $811,200 and $910,500) or 2% apart are ONE chip, the Financial
  // independence page's; 25 times spending is never shown beside it
  for (const [fiN, yearly] of [[811200, 36420], [1397155, 66360], [1315838, 53800], [1649200, 55580]]) {
    const cs = o2.targetChips({ fi: fiN, spendingYearly: yearly, peak: 5e6, now: 1e5 });
    assert.deepEqual(cs.filter((c) => c.kind !== "round").map((c) => [c.value, c.kind]), [[fiN, "fi"]], String(fiN));
  }
  assert.deepEqual(o2.targetChips({ fi: 811200, spendingYearly: 36420, peak: 66710, now: 51000 }).map((c) => o2.chipLabel(c)), ["$60,000", "$800,000", "$811,200 (25 years of spending)"]);
  // another withdrawal rate on the Financial independence page: its own number of years
  assert.equal(o2.chipLabel(o2.targetChips({ fi: 2400000, years: 1 / 0.035, peak: 3e6, now: 1e5 }).find((c) => c.kind === "fi")), "$2,400,000 (29 years of spending)");
  // four at most: the rule, the round under it, the one the savings reach (and no step over: three already)
  assert.deepEqual(o2.targetChips({ fi: 1397155, spendingYearly: 66360, peak: 417089, now: 202200 }).map((c) => c.value), [400000, 1250000, 1397155]);
  // a figure already round: the step under it; the steps by size
  assert.equal(o2.targetChips({ fi: 2000000, peak: 5e6 })[0].value, 1750000);
  assert.deepEqual([o2.targetStep(2e6), o2.targetStep(1e6), o2.targetStep(999999), o2.targetStep(1e5), o2.targetStep(99999)], [250000, 250000, 50000, 50000, 10000]);
  // no Financial independence figure: 25 times spending is the rule of thumb, with the round figures either side, and says so
  const own = o2.targetChips({ fi: null, spendingYearly: 36420, peak: 2e6, now: 0 });
  assert.deepEqual(own.map((c) => [c.value, c.kind]), [[900000, "round"], [910500, "times25"], [950000, "round"]]);
  assert.equal(o2.chipLabel(own[1]), "$910,500 (25 years of spending)");
  assert.equal(o2.ruleWords(own), "\"25 years of spending\" is a common rule of thumb for living on savings alone: 25 times what your plan spends in a year. It counts no Social Security or pension, so a plan that has them can work with less.");
  assert.equal(o2.ruleWords([{ value: 1e6, kind: "round" }]), null);
  // the savings reach nothing above today's: no such chip; nothing to go on: no chips
  assert.ok(o2.targetChips({ fi: 2100000, spendingYearly: 84000, peak: 192700, now: 192700 }).every((c) => c.value > 192700));
  assert.deepEqual(o2.targetChips({}), []);
});

test("o2 (#31) fix round 1, P5: the figure answered as the part opens: the lowest chip reached later, else the rule of thumb, else the first", () => {
  const fam = [{ value: 1000000, kind: "round" }, { value: 2000000, kind: "round" }, { value: 2100000, kind: "fi", years: 25 }];
  assert.equal(o2.targetDefault(fam, { now: 177000, peak: 1233685 }), 1000000, "the family: reached by 2050");
  assert.equal(o2.targetDefault(fam, { now: 1100000, peak: 2050000 }), 2000000, "today's savings are past the first: the next one reached");
  assert.equal(o2.targetDefault(fam, { now: 192700, peak: 192700 }), 2100000, "none reached: the rule of thumb (the never sentence)");
  assert.equal(o2.targetDefault(fam, { now: 3e6, peak: 3e6 }), 2100000, "all already there: the rule of thumb");
  assert.equal(o2.targetDefault([{ value: 5e5, kind: "round" }, { value: 6e5, kind: "round" }], { now: 7e5, peak: 7e5 }), 5e5, "no rule chip: the first");
  assert.equal(o2.targetDefault([], { now: 1, peak: 2 }), null);
  assert.equal(o2.targetDefault(fam, { now: 177000 }), 1000000, "no peak known: the first above today's");
});

test("o2 (#31): one written sentence per case (R5): the reach, the stop, the question before the save, the green line and Undo", () => {
  const base = { figure: 1000000, now: 192700, name: "Me", ageNow: 36, planned: 65, peak: { value: 1233685, year: 2055, age: 65, today: false } };
  const later = { ...base, reach: { year: 2050, age: 60, already: false }, when: "earlier" };
  const now = { ...base, figure: 150000, reach: { year: 2026, age: 36, already: true }, when: "earlier" };
  // the reach: four cases
  assert.equal(o2.reachWords(now), "You already have more than $150,000 saved: about $193,000 today.");
  // fix round 1, P8: savings that round to the figure itself are not "more than" it
  assert.equal(o2.reachWords({ ...now, figure: 193000, now: 192999.8 }), "You already have $193,000 saved today.");
  assert.equal(o2.reachWords({ ...now, figure: 193000, now: 193000 }), "You already have $193,000 saved today.");
  assert.equal(o2.reachWords({ ...now, figure: 192500, now: 192700 }), "You already have more than $192,500 saved: about $193,000 today.");
  assert.equal(o2.reachWords(later), "Your savings would reach $1,000,000 by 2050, the year you turn 60, if markets do as well as average.");
  assert.equal(o2.reachWords({ ...base, figure: 2100000, reach: null }), "Your savings never reach $2,100,000 with the plan as it is: the most is about $1,233,000, by 2055, the year you turn 65, if markets do as well as average.");
  assert.equal(o2.reachWords({ ...base, figure: 500000, reach: null, peak: { value: 192700, year: 2026, age: 36, today: true } }), "Your savings never reach $500,000 with the plan as it is: they are highest today, about $192,000.");
  assert.equal(o2.reachWords({ ...base, name: "My spouse", reach: later.reach }), "Your savings would reach $1,000,000 by 2050, the year your spouse turns 60, if markets do as well as average.");
  assert.equal(o2.reachWords({ ...base, figure: 0 }), null);
  // the stop: then and now, four outcomes each; at the planned age; after it
  const stop = (s) => ({ age: 60, year: 2050, lasts: true, meets: true, runsOutAt: null, lastsTo: 95, ...s });
  assert.equal(o2.stopWords({ ...later, stop: stop({ lasts: false, meets: false, runsOutAt: 79 }) }), "If you stopped work then, at 60, the money would run out at 79.");
  assert.equal(o2.stopWords({ ...later, stop: stop({}) }), "If you stopped work then, at 60, the money would last to 95.");
  assert.equal(o2.stopWords({ ...later, stop: stop({}) }, { legacy: 500000 }), "If you stopped work then, at 60, the money would last to 95 and leave at least $500,000.");
  assert.equal(o2.stopWords({ ...later, stop: stop({ meets: false }) }, { legacy: 500000 }), "If you stopped work then, at 60, the money would last to 95 but leave less than $500,000.");
  assert.equal(o2.stopWords({ ...now, stop: stop({ age: 36, lasts: false, meets: false, runsOutAt: 54 }) }), "If you stopped work now, at 36, the money would run out at 54.");
  assert.equal(o2.stopWords({ ...now, stop: stop({ age: 36 }) }), "If you stopped work now, at 36, the money would last to 95.");
  assert.equal(o2.stopWords({ ...now, stop: stop({ age: 36 }) }, { legacy: 250000 }), "If you stopped work now, at 36, the money would last to 95 and leave at least $250,000.");
  assert.equal(o2.stopWords({ ...now, stop: stop({ age: 36, meets: false }) }, { legacy: 250000 }), "If you stopped work now, at 36, the money would last to 95 but leave less than $250,000.");
  assert.equal(o2.stopWords({ ...later, name: "Ana", reach: { year: 2055, age: 65, already: false }, when: "planned", stop: null }), "That is the year Ana plans to stop work anyway, at 65.");
  assert.equal(o2.stopWords({ ...later, reach: { year: 2055, age: 65, already: false }, when: "planned", stop: null }), "That is the year you plan to stop work anyway, at 65.");
  assert.equal(o2.stopWords({ ...later, name: "Ana", reach: { year: 2057, age: 67, already: false }, when: "after", stop: null }), "The plan already has Ana stopping work before then, at 65.");
  assert.equal(o2.stopWords({ ...base, reach: null }), null);
  // the button only where stopping then meets the goal
  assert.equal(o2.canUseAge({ ...later, stop: stop({}) }), true);
  assert.equal(o2.canUseAge({ ...later, stop: stop({ meets: false }) }), false);
  assert.equal(o2.canUseAge({ ...later, when: "planned", stop: null }), false);
  // the phone's question, the green line, Undo
  const t = { ...later, name: "Me", stop: stop({ age: 62, year: 2052 }) };
  assert.equal(o2.targetConfirmWords(t), "Change your retirement age from 65 to 62? Undo puts it back, and so does the People page.");
  assert.equal(o2.targetConfirmWords({ ...now, stop: stop({ age: 36 }) }), "Change your retirement age from 65 to 36? The plan then counts you as stopping work this year. Undo puts it back, and so does the People page.");
  assert.equal(o2.targetSavedWords(t), "Saved: your retirement age is now 62, so you stop work in 2052. The money would last to 95.");
  assert.equal(o2.targetSavedWords({ ...t, name: "Ana" }, { legacy: 500000 }), "Saved: Ana's retirement age is now 62, so Ana stops work in 2052. The money would last to 95 and leave at least $500,000.");
  assert.equal(o2.targetSavedWords({ ...now, stop: stop({ age: 36 }) }), "Saved: your retirement age is now 36, so you stop work this year. The money would last to 95.");
  assert.equal(o2.targetUndoneWords(t), "Back to retiring at 65, as before.");
});

test("o2 invariance (gap spec 3.5): without `target`, compute() has no target key; with it, only `target` is added, over every fixture and qa plan", async () => {
  const path = await import("node:path");
  const { pathToFileURL } = await import("node:url");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const phone = await import("../../../qa/fixtures/phone-households.mjs");
  const dir = fileURLToPath(new URL("../../../qa/fixtures/", import.meta.url));
  const all = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) all.push([`${f}:${name}`, fn(T13)]);
  }
  for (const a of ARCHETYPES) all.push([a.id, a.build()]);
  for (const [name, fn] of Object.entries(phone)) if (typeof fn === "function") all.push([`phone ${name}`, fn()]);
  all.push(["empty", emptyPlan()]);
  let withTarget = 0;
  for (const [name, raw] of all) {
    const p = migrate(structuredClone(raw));
    const before = compute(structuredClone(p), { today: T13 });
    assert.ok(!("target" in before), `${name}: no target unless asked`);
    for (const params of [{ target: 1000000 }, { target: 0, legacy: 250000 }]) {
      const { target, ...rest } = compute(structuredClone(p), { today: T13, ...params });
      const plain = params.legacy ? compute(structuredClone(p), { today: T13, legacy: params.legacy }) : before;
      assert.equal(JSON.stringify(rest), JSON.stringify(plain), `${name} ${JSON.stringify(params)}: asking changes nothing else`);
      if (before.ready) { assert.ok("target" in compute(p, { today: T13, only: [], ...params }), name); if (target) withTarget++; }
    }
    // the ages are what they were (their run is shared with the stop line now)
    if (before.ready && lever(before, "retire")) assert.equal(JSON.stringify(compute(structuredClone(p), { today: T13, only: [], ages: true, target: 1000000 }).ages), JSON.stringify(compute(structuredClone(p), { today: T13, only: [], ages: true }).ages), name);
  }
  assert.ok(all.length >= 30 && withTarget >= 20, `${all.length} plans, ${withTarget} answers`);
  // a figure that is not a number asks nothing
  for (const v of [undefined, null, "x", -5]) assert.ok(!("target" in compute(familyPlan(T13), { today: T13, only: [], target: v })), String(v));
});

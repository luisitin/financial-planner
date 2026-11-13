// modules/retirement/claiming/module.test.mjs -- When to start Social Security (gap design #7, 2026-11-13): every formula,
// every sentence the headline can say, what "Use these ages" and "Set my own numbers" write, and the invariance check
// (Social Security's figures are the ones recorded on the base before this page; no other page reads claimingRate).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compute, words, agesFor, oddsOf, lifetime, lifetimePlain, bestOf, roundAbout, nowWords, savedWords, undoWords, retireWords, pairName, CLOSE, SAME } from "./compute.js";
import { compute as socialSecurity, pairYears, claimFactor, spousalEarlyFactor, floorDime, couple } from "../social-security/compute.js";
import { survival } from "../longevity/compute.js";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";
import { retirementPlan } from "../../../qa/fixtures/retirement-plan.mjs";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";

const T = "2026-11-13";
const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
/** One adult, born on `birth`, with a statement figure at full retirement age. */
function one({ birth = "1966-03-15", pia = 2400, name = "Riley", claimAge, health, sex } = {}) {
  const p = emptyPlan();
  p.household.people.push({ id: "a", name, role: "self", birthDate: birth });
  p.retirement.socialSecurity = { a: { monthlyAtFRA: pia, ...(claimAge ? { claimAge } : {}) } };
  if (health || sex) p.retirement.longevity = { a: { sex: sex ?? "", health: health ?? "average" } };
  return p;
}
/** A married couple: Ana (the larger earner by default) and Bo. */
function two({ a = { birth: "1966-03-15", pia: 3000 }, b = { birth: "1968-07-20", pia: 1000 }, relation } = {}) {
  const p = emptyPlan();
  p.household.people.push({ id: "a", name: "Ana", role: "self", birthDate: a.birth }, { id: "b", name: "Bo", role: "partner", birthDate: b.birth, ...(relation ? { relation } : {}) });
  p.retirement.socialSecurity = {};
  if (a.pia) p.retirement.socialSecurity.a = { monthlyAtFRA: a.pia, ...(a.claimAge ? { claimAge: a.claimAge } : {}) };
  if (b.pia) p.retirement.socialSecurity.b = { monthlyAtFRA: b.pia, ...(b.claimAge ? { claimAge: b.claimAge } : {}) };
  return p;
}
const ssPeople = (plan, today = T) => socialSecurity(migrate(structuredClone(plan)), { today }).people;

// ---------------------------------------------------------------- the ages tried and the odds
test("agesFor: 62 to 70 before 62; past 62, now (to the month) and the whole ages after it", () => {
  assert.deepEqual(agesFor(58.6), [62, 63, 64, 65, 66, 67, 68, 69, 70]);
  assert.deepEqual(agesFor(64.25), [64.25, 65, 66, 67, 68, 69, 70]);
  assert.deepEqual(agesFor(64.2), [Math.ceil(64.2 * 12) / 12, 65, 66, 67, 68, 69, 70]);
  assert.deepEqual(agesFor(66), [66, 67, 68, 69, 70], "exactly 66 today: 66 is now");
  assert.deepEqual(agesFor(69.95), [70]);
});

test("oddsOf: alive at mid-year from longevity's curve; the chances of dying by year add up to one less the chance of being alive", () => {
  const o = oddsOf(60, 50, { health: "average" });
  assert.ok(Math.abs(o.alive[0] - survival(60, 60.5)) < 1e-12);
  assert.ok(Math.abs(o.alive[10] - survival(60, 70.5)) < 1e-12);
  for (const k of [0, 5, 20, 49]) {
    const died = o.dies.slice(0, k + 1).reduce((s, x) => s + x, 0);
    assert.ok(Math.abs(died - (1 - o.alive[k])) < 1e-12, `year ${k}`);
  }
  const better = oddsOf(60, 50, { health: "better" }), worse = oddsOf(60, 50, { health: "worse" });
  assert.ok(better.alive[25] > o.alive[25] && o.alive[25] > worse.alive[25]);
});

test("roundAbout: $1,000 steps from $10,000, $100 from $1,000, $10 below", () => {
  assert.equal(roundAbout(38420), 38000);
  assert.equal(roundAbout(8649), 8600);
  assert.equal(roundAbout(472), 470);
  assert.equal(roundAbout(-2550), 2600, "a size, never a sign");
});

// ---------------------------------------------------------------- the money rules, year by year (pairYears)
test("pairYears: own benefit is the full-age amount times the factor for the claim age, from the year the age is reached", () => {
  const people = ssPeople(one({ birth: "1966-03-15", pia: 2400 }));
  const p = people[0];
  const py = pairYears(people, { a: 70 }, { years: 20 });
  const monthly = floorDime(2400 * claimFactor(1966, 70));
  assert.equal(monthly, floorDime(2400 * 1.24), "70 with a full age of 67: 3 years of credits at 8%");
  const startK = Math.floor(70 - p.ageNow);
  assert.equal(py.own.a[startK - 1], 0, "nothing before 70");
  const share = p.ageNow + startK + 1 - 70;
  assert.ok(Math.abs(py.own.a[startK] - 12 * monthly * share) < 1e-9, "the year 70 is reached pays for the months from 70");
  assert.ok(Math.abs(py.own.a[startK + 1] - 12 * monthly) < 1e-9, "a whole year after");
  const at62 = pairYears(people, { a: 62 }, { years: 20 });
  assert.equal(Math.max(...at62.own.a) / 12, floorDime(2400 * 0.7), "62 with a full age of 67: 30% less (36 x 5/9% + 24 x 5/12%)");
});

test("pairYears: a spouse with a full-age amount under half the other's gets a top-up; one above half does not", () => {
  const under = ssPeople(two({ a: { birth: "1966-03-15", pia: 3000 }, b: { birth: "1966-09-15", pia: 1000 } }));
  const py = pairYears(under, { a: 67, b: 67 }, { years: 40 });
  assert.ok(Math.max(...py.topUp.b) > 0, "Bo: half of $3,000 is $1,500, more than his $1,000");
  assert.equal(Math.max(...py.topUp.b) / 12, floorDime(500 * spousalEarlyFactor(1966, 67)), "$500 a month at full retirement age");
  assert.equal(Math.max(...py.topUp.a), 0, "Ana gets none: half of $1,000 is under her own");
  const over = ssPeople(two({ a: { birth: "1966-03-15", pia: 3000 }, b: { birth: "1966-09-15", pia: 1600 } }));
  assert.equal(Math.max(...pairYears(over, { a: 67, b: 67 }, { years: 40 }).topUp.b), 0, "$1,600 is above half of $3,000");
  // the top-up starts once both have started: Bo at 62 waits for Ana at 70, and it is reduced for his age then
  const late = pairYears(under, { a: 70, b: 62 }, { years: 40 });
  const bo = under.find((p) => p.id === "b"), ana = under.find((p) => p.id === "a");
  const from = bo.ageNow + (70 - ana.ageNow);
  assert.equal(Math.max(...late.topUp.b) / 12, floorDime(500 * spousalEarlyFactor(1966, from)));
  assert.equal(late.topUp.b[Math.floor(from - bo.ageNow) - 1], 0, "nothing before Ana starts");
  // not married (Get started's "partner"): no spouse's or widow(er)'s benefit
  const partners = ssPeople(two({ relation: "partner" }));
  const np = pairYears(partners, { a: 67, b: 67 }, { years: 40, married: false });
  assert.equal(Math.max(...np.topUp.b), 0);
  assert.equal(Math.max(...np.widow.a), 0);
});

test("pairYears: the widow(er)'s amount on a record (survivorAmount, the 82.5% floor, the full-age amount before starting)", () => {
  const people = ssPeople(two({ a: { birth: "1966-03-15", pia: 3000 }, b: { birth: "1968-07-20", pia: 1000 } }));
  const ana = people.find((p) => p.id === "a");
  const late = 40;   // Ana dies long after she started
  const w70 = pairYears(people, { a: 70, b: 67 }, { years: 50 }).widow.a[late];
  const w67 = pairYears(people, { a: 67, b: 67 }, { years: 50 }).widow.a[late];
  const w62 = pairYears(people, { a: 62, b: 67 }, { years: 50 }).widow.a[late];
  assert.equal(w70, floorDime(3000 * 1.24), "she waited to 70: the survivor keeps the larger check");
  assert.equal(w67, 3000);
  assert.equal(w62, floorDime(3000 * 0.825), "started at 62 (70%): never under 82.5% of her full-age amount");
  assert.ok(w70 > w67 && w67 > w62, "the larger earner waiting raises the survivor's check");
  // died before starting: before full retirement age, the full-age amount; after it, the credits earned up to death
  const py = pairYears(people, { a: 70, b: 67 }, { years: 50 });
  const dBeforeFra = Math.floor(66 - ana.ageNow);
  assert.equal(py.widow.a[dBeforeFra], 3000);
  const d68 = Math.ceil(68 - ana.ageNow);
  const diesAt = ana.ageNow + d68;
  assert.equal(py.widow.a[d68], floorDime(3000 * claimFactor(1966, diesAt)), "dies at 68 and some months before starting at 70");
  assert.ok(py.widow.a[d68] > 3000 && py.widow.a[d68] < w70);
});

test("pairYears: alone() is the larger of one's own check and the widow(er)'s amount, the latter from full retirement age", () => {
  const people = ssPeople(two({ a: { birth: "1966-03-15", pia: 3000 }, b: { birth: "1968-07-20", pia: 1000 } }));
  const bo = people.find((p) => p.id === "b");
  const py = pairYears(people, { a: 70, b: 62 }, { years: 50 });
  const kFull = Math.ceil(67 - bo.ageNow) + 1;   // a whole year past his full retirement age
  assert.ok(Math.abs(py.alone("b", kFull, 30) - 12 * floorDime(3000 * 1.24)) < 1e-9, "Ana's larger check");
  const kEarly = Math.ceil(63 - bo.ageNow);       // a year he gets his own (from 62) and is under 67
  assert.ok(Math.abs(py.alone("b", kEarly, 0) - 12 * floorDime(1000 * 0.7)) < 1e-9, "before 67: his own reduced check only");
  // Ana outliving Bo keeps her own (his record pays less)
  assert.ok(Math.abs(py.alone("a", 30, 10) - 12 * floorDime(3000 * 1.24)) < 1e-9);
});

test("pairYears at the plan's ages gives the Social Security page's own monthly figures and top-ups (every qa household; a claim age gone by too)", async () => {
  for (const { name, plan } of await allPlans()) {
    const ss = socialSecurity(migrate(structuredClone(plan)), { today: T });
    const adults = ss.people.filter((p) => p.birthYear && Number.isFinite(p.ageNow)).slice(0, 2);
    if (!adults.length) continue;
    const married = !(plan.household?.people ?? []).some((p) => p.role !== "dependent" && p.relation === "partner");
    const py = pairYears(ss.people, {}, { married, years: 80 });
    for (const p of adults) {
      const own = Math.max(...py.own[p.id]) / 12;
      const want = p.claimed && p.source === "none" ? (p.paidLine ? (p.paidLine.period === "monthly" ? p.paidLine.amount : own) : 0) : p.monthly;
      assert.ok(Math.abs(own - want) < 0.01, `${name} ${p.id}: ${own} vs ${want}`);
    }
    const c = couple(adults, { married });
    if (c && adults.length === 2) for (const p of adults) {
      const top = Math.max(...py.topUp[p.id]) / 12;
      assert.ok(Math.abs(top - c.spousalCounted[p.id]) < 0.01, `${name} ${p.id} top-up ${top} vs ${c.spousalCounted[p.id]}`);
    }
  }
});

// ---------------------------------------------------------------- the sum and the best pair
test("lifetime: grouping the death years by the widow(er)'s amount gives the same total as the plain year-by-year sum", () => {
  const people = ssPeople(familyPlan());
  const years = 75;
  const odds = Object.fromEntries(people.map((p) => [p.id, oddsOf(p.ageNow, years)]));
  for (const ages of [{ "p-ana": 62, "p-bo": 70 }, { "p-ana": 67, "p-bo": 67 }, { "p-ana": 70, "p-bo": 62 }, { "p-ana": 65, "p-bo": 68 }]) {
    for (const rate of [0, 0.02]) {
      const py = pairYears(people, ages, { years });
      const a = lifetime(py, odds, { rate }), b = lifetimePlain(py, odds, { rate });
      assert.ok(Math.abs(a - b) < 1e-6 * b, `${JSON.stringify(ages)} at ${rate}: ${a} vs ${b}`);
    }
  }
});

test("the brute-force best pair equals an independent loop over every pair (the plain sum, a plain max)", () => {
  for (const plan of [retirementPlan(), familyPlan(), two(), two({ a: { birth: "1961-02-10", pia: 2200 }, b: { birth: "1963-05-01", pia: 2100 } })]) {
    const d = compute(migrate(structuredClone(plan)), { today: T });
    assert.ok(d.ready, "an answer");
    const people = ssPeople(plan);
    const ids = d.people.filter((p) => p.varies).map((p) => p.id);
    const years = Math.ceil(110 - Math.min(...d.people.map((p) => p.ageNow)));
    const odds = Object.fromEntries(d.people.map((p) => [p.id, oddsOf(p.ageNow, years, { sex: p.sex, health: p.health })]));
    let best = null, n = 0;
    for (const x of d.people.find((p) => p.id === ids[0]).ages) for (const y of d.people.find((p) => p.id === ids[1]).ages) {
      const total = lifetimePlain(pairYears(people, { [ids[0]]: x, [ids[1]]: y }, { years }), odds, { rate: 0 });
      n++;
      if (best === null || total > best.total + 1e-9) best = { x, y, total };
    }
    assert.equal(d.pairs.length, n);
    const top = d.state === "best" ? d.pairs[0] : d.best;
    assert.deepEqual([top.ages[ids[0]], top.ages[ids[1]]], [best.x, best.y]);
    assert.ok(Math.abs(top.total - best.total) < 1e-6 * best.total);
    assert.deepEqual(bestOf(d.pairs).ages, top.ages);
  }
});

test("one person at 0% with an average or long life picks 70; with worse health and 2% a year, 62 or near it", () => {
  for (const health of ["average", "better"]) {
    const d = compute(one({ health }), { today: T });
    assert.equal(d.best.ages.a, 70, health);
  }
  const p = one({ health: "worse", sex: "m" });
  p.retirement.claimingRate = 0.02;
  const d = compute(p, { today: T });
  assert.ok(d.best.ages.a <= 63, `worse health and 2%: ${d.best.ages.a}`);
  // a rate always lowers every total: later years count less
  const z = compute(one(), { today: T }), r = compute(Object.assign(one(), {}), { today: T });
  const q = one(); q.retirement.claimingRate = 0.01;
  assert.ok(compute(q, { today: T }).best.total < z.best.total);
  assert.equal(r.best.total, z.best.total);
});

test("a couple: the larger earner waits (the survivor keeps the larger check); the smaller check starts early", () => {
  const d = compute(retirementPlan(), { today: T });
  assert.equal(d.state, "gain");
  assert.equal(d.best.ages.sam, 70);
  assert.equal(d.best.ages.lee, 62);
  assert.deepEqual(d.survivor, { keeps: "lee", from: "sam" });
  assert.deepEqual(d.apply, { sam: 70, lee: 62 });
});

test("someone already collecting keeps their age; only the other varies", () => {
  const p = two({ a: { birth: "1958-03-15", pia: 2600 }, b: { birth: "1966-07-20", pia: 1500 } });
  p.income.push({ id: "ss-a", name: "Ana's Social Security", type: "social", personId: "a", amount: 2700, period: "monthly" });
  const d = compute(p, { today: T });
  const ana = d.people.find((x) => x.id === "a");
  assert.equal(ana.varies, false);
  assert.equal(ana.why, "claimed");
  assert.equal(ana.ages.length, 1);
  assert.ok(d.pairs.every((x) => x.ages.a === ana.planAge), "Ana's age is the same in every pair");
  assert.equal(d.pairs.length, 9, "Bo's nine ages");
  assert.deepEqual(Object.keys(d.apply ?? {}), d.state === "best" ? [] : ["b"]);
});

test("today's dollars: the totals do not move with the plan's inflation", () => {
  const a = familyPlan(), b = familyPlan();
  a.assumptions.inflation = 0.01; b.assumptions.inflation = 0.06;
  const x = compute(a, { today: T }), y = compute(b, { today: T });
  assert.deepEqual(x.pairs.map((p) => p.total), y.pairs.map((p) => p.total));
});

test("states: close within 2%, best within 0.1%, gain beyond", () => {
  // a single person whose plan already says 69: within 2% of 70 at most
  const d69 = compute(one({ claimAge: 69 }), { today: T });
  assert.ok(d69.gain <= CLOSE * d69.best.total);
  assert.ok(["close", "best"].includes(d69.state));
  const d70 = compute(one({ claimAge: 70 }), { today: T });
  assert.equal(d70.state, "best");
  assert.equal(d70.apply, null);
  assert.ok(d70.gain <= SAME * d70.best.total);
  const d62 = compute(one({ claimAge: 62 }), { today: T });
  assert.equal(d62.state, "gain");
});

// ---------------------------------------------------------------- one written sentence per case
test("words: the empty plan and no Social Security figure", () => {
  const e = words(compute(emptyPlan(), { today: T }), money);
  assert.equal(e.lede, "First add the adults in your home, with their birth dates.");
  const p = emptyPlan(); p.household.people.push({ id: "a", name: "Riley", role: "self", birthDate: "1980-01-01" });
  const d = compute(p, { today: T });
  assert.equal(d.state, "empty");
  assert.equal(words(d, money).lede, "The best age to start depends on what you would get. Add your Social Security figure first, from your ssa.gov account or your statement.");
  assert.equal(words(d, money).link, null, "no row on the Social Security page");
});

test("words: gain, for a couple, for one of a couple and for one person", () => {
  const d = compute(retirementPlan(), { today: T });
  const w = words(d, money);
  assert.equal(w.title, "Sam at 70, Lee at 62");
  assert.equal(w.lede, `Starting Sam's at 70 and Lee's at 62 pays the most over your lives: about ${money(roundAbout(d.gain))} more than the ages in your plan (Sam at 67, Lee at 67).`);
  assert.equal(w.survivor, "If Lee outlives Sam, Lee keeps Sam's larger check.");
  assert.equal(w.ask, "When should each of us start?");
  assert.equal(w.link, `Sam at 70, Lee at 62: about ${money(roundAbout(d.gain))} more over your lives`);
  const s = compute(one({ claimAge: 62 }), { today: T });
  const ws = words(s, money);
  assert.equal(ws.title, "Start at 70");
  assert.equal(ws.lede, `Starting at 70 pays the most over your life: about ${money(roundAbout(s.gain))} more than at 62, the age in your plan.`);
  assert.equal(ws.ask, "When should I start?");
  assert.equal(ws.link, `At 70: about ${money(roundAbout(s.gain))} more over your life`);
  assert.equal(ws.survivor, "");
  // Bo's own check at 70 is well above what Ana's record would leave him, so his waiting pays (with $2,400 it would not:
  // Ana's $2,700 as a widower's check is about what waiting gives him, and 62 pays the most)
  const p = two({ a: { birth: "1958-03-15", pia: 2600 }, b: { birth: "1966-07-20", pia: 3200, claimAge: 62 } });
  p.income.push({ id: "ss-a", name: "Ana's Social Security", type: "social", personId: "a", amount: 2700, period: "monthly" });
  const o = compute(p, { today: T });
  assert.equal(o.state, "gain");
  const wo = words(o, money);
  assert.equal(wo.title, `Start Bo's at ${o.best.ages.b}`);
  assert.equal(wo.lede, `Starting Bo's at ${o.best.ages.b} pays the most over your lives: about ${money(roundAbout(o.gain))} more than at 62, the age in your plan.`);
});

test("words: the unnamed first adult reads 'you' and 'yours'", () => {
  const p = retirementPlan();
  p.household.people[0].name = "Me";
  const w = words(compute(p, { today: T }), money);
  assert.equal(w.title, "You at 70, Lee at 62");
  assert.match(w.lede, /^Starting yours at 70 and Lee's at 62 pays the most over your lives: about \$[\d,]+ more than the ages in your plan \(you at 67, Lee at 67\)\.$/);
  assert.equal(w.survivor, "If Lee outlives you, Lee keeps your larger check.");
});

// ---------------------------------------------------------------- a claim age gone by, adults left out, a rate out of range (critic g16)
test("a claim age gone by stays the age in the plan, valued as the plan counts it, and is said (critic g16 #1)", async () => {
  // Ana is 68 and 8 months, has not started, and the plan still says 66: the Social Security page says 66 has passed and
  // counts her check at 66 from today; this page showed "the ages in your plan (68 and 8 months and 67)"
  const p = two({ a: { birth: "1958-03-15", pia: 2600, claimAge: 66 }, b: { birth: "1960-07-20", pia: 1500 } });
  const people = ssPeople(p);
  const ana = people.find((x) => x.id === "a");
  assert.equal(ana.pastClaimAge, true);
  assert.equal(ana.monthly, 2484.4);
  const d = compute(p, { today: T });
  assert.equal(d.plan.ages.a, 66, "the age in the plan, as the Social Security page says it");
  assert.equal(d.plan.ages.b, 67);
  assert.ok(d.people.find((x) => x.id === "a").ages.every((x) => x >= ana.ageNow), "66 is not one of the ages tried: it cannot be chosen any more");
  // the plan's total is what the plan counts: Ana's check at 66 from today
  const years = Math.ceil(110 - Math.min(...d.people.map((x) => x.ageNow)));
  const odds = Object.fromEntries(d.people.map((x) => [x.id, oddsOf(x.ageNow, years)]));
  const py = pairYears(people, { a: 66, b: 67 }, { years });
  assert.ok(Math.abs(py.own.a[0] - 12 * 2484.4) < 1e-9, "paid from today");
  assert.ok(Math.abs(d.plan.total - lifetime(py, odds)) < 1e-6 * d.plan.total);
  assert.equal(d.state, "gain");
  const w = words(d, money);
  assert.equal(w.title, "Ana at 70, Bo at 66 and 4 months");
  assert.equal(w.lede, `Starting Ana's at 70 and Bo's at 66 and 4 months pays the most over your lives: about ${money(roundAbout(d.gain))} more than the ages in your plan (Ana at 66, Bo at 67).`);
  assert.equal(w.passed, "The plan has Ana claiming at 66, which has passed, so it counts $2,484 a month.");
  assert.equal(undoWords(d), "Back to the ages you had: Ana at 66, Bo at 67.");
  const pg = await page(p);
  assert.match(pg.outside(), /The plan has Ana claiming at 66, which has passed, so it counts \$2,484 a month\. Use these ages/);
  // both gone by, one with months: each is named, never "68 and 8 months and 66 and 4 months"
  const q = two({ a: { birth: "1958-03-15", pia: 2600, claimAge: 66 }, b: { birth: "1960-03-20", pia: 2500, claimAge: 66 + 4 / 12 } });
  const dq = compute(q, { today: T });
  const bo = ssPeople(q).find((x) => x.id === "b");
  assert.match(words(dq, money).lede, / than the ages in your plan \(Ana at 66, Bo at 66 and 4 months\)\./);
  assert.equal(undoWords(dq), "Back to the ages you had: Ana at 66, Bo at 66 and 4 months.");
  assert.equal(words(dq, money).passed, `The plan has Ana claiming at 66, which has passed, so it counts $2,484 a month. The plan has Bo claiming at 66 and 4 months, which has passed, so it counts ${money(bo.monthly)} a month.`);
  // the unnamed first adult
  p.household.people[0].name = "Me";
  const wy = words(compute(p, { today: T }), money);
  assert.match(wy.lede, / than the ages in your plan \(you at 66, Bo at 67\)\.$/);
  assert.equal(wy.passed, "The plan has you claiming at 66, which has passed, so it counts $2,484 a month.");
  // one person, and past 70 (start now): the age gone by is said too
  const s = compute(one({ birth: "1960-01-10", claimAge: 63 }), { today: T });
  assert.equal(s.plan.ages.a, 63);
  assert.match(words(s, money).lede, /about \$[\d,]+ more than at 63, the age in your plan\.$/);
  const o = compute(one({ birth: "1955-01-10", claimAge: 66 }), { today: T });
  assert.equal(o.state, "now");
  assert.equal(words(o, money).passed, "The plan has Riley claiming at 66, which has passed, so it counts $2,373 a month.");
  // an age in the plan still ahead, and a claim age Get started set to the age then (not "gone by" on the Social Security page)
  assert.equal(words(compute(two(), { today: T }), money).passed, "");
  const g = one({ birth: "1963-03-15", claimAge: 63 });
  g.guide = { setup: { ssClaimWrote: { a: 63 } } };
  const dg = compute(g, { today: T });
  assert.equal(dg.plan.ages.a, 63, "the plan's own claim from then");
  assert.equal(words(dg, money).passed, "");
});

test("a claimingRate outside 0 to 10% (an imported plan) is read as the nearest end (critic g16 #3)", () => {
  const at = (r) => { const p = one({ claimAge: 62 }); if (r !== undefined) p.retirement.claimingRate = r; return compute(p, { today: T }); };
  const zero = at(undefined), ten = at(0.1);
  for (const [r, want, same] of [[-0.5, 0, zero], [-0.01, 0, zero], [5, 0.1, ten], [0.11, 0.1, ten], ["abc", 0, zero], [null, 0, zero], ["0.1", 0.1, ten]]) {
    const d = at(r);
    assert.equal(d.rate, want, String(r));
    assert.deepEqual(d.pairs.map((x) => x.total), same.pairs.map((x) => x.total), String(r));
    assert.ok(d.gain < d.best.total, `${r}: the gain was about $2e13 at -50%`);
  }
  assert.equal(at(-0.5).set.rate, false, "read as 0: not counted as set by you");
  assert.equal(at(5).set.rate, true);
});

test("adults this page leaves out are said on the first view: a third adult, one with no birth date (critic g16 #4)", async () => {
  const p = two();
  p.household.people.push({ id: "c", name: "Cy", role: "partner", birthDate: "1961-05-01" });
  p.retirement.socialSecurity.c = { monthlyAtFRA: 2200 };
  const d = compute(p, { today: T });
  assert.deepEqual(d.people.map((x) => x.id), ["a", "b"], "the pair is the first two adults, as the Social Security page pairs them");
  assert.deepEqual(d.left, [{ id: "c", name: "Cy", why: "third" }]);
  assert.equal(words(d, money).left, "Cy is left out here: this page works out the best ages for two people.");
  const pg = await page(p);
  assert.match(pg.outside(), /Cy is left out here: this page works out the best ages for two people\. Use these ages/);
  p.household.people.push({ id: "e", name: "Di", role: "partner", birthDate: "1990-01-01" });
  assert.equal(words(compute(p, { today: T }), money).left, "Cy and Di are left out here: this page works out the best ages for two people.");
  // no birth date: that adult is left out, and the page says so (the answer is then for one person)
  const q = two();
  q.household.people[0].birthDate = "";
  const dq = compute(q, { today: T });
  assert.deepEqual(dq.people.map((x) => x.id), ["b"]);
  assert.deepEqual(dq.left, [{ id: "a", name: "Ana", why: "noBirth" }]);
  assert.equal(words(dq, money).left, "Ana's birth date is not in the plan, so Ana is left out here.");
  q.household.people[0].name = "Me";
  assert.equal(words(compute(q, { today: T }), money).left, "Your birth date is not in the plan, so you are left out here.");
  // nobody left out: no sentence; no adult with a birth date: the first sentence says to add them, and nothing more
  assert.equal(words(compute(two(), { today: T }), money).left, "");
  const none = two();
  for (const x of none.household.people) x.birthDate = "";
  assert.equal(compute(none, { today: T }).state, "noPeople");
  assert.equal(words(compute(none, { today: T }), money).left, "");
});

test("words: close (within 2%) for a couple and for one; best for a couple and for one", () => {
  const c = compute(one({ claimAge: 69 }), { today: T });
  if (c.state === "close") assert.equal(words(c, money).lede, `Starting at 70 pays the most, but only about ${money(roundAbout(c.gain))} more than at 69, the age in your plan. Several ages come within 2% of each other; any of them is a sound choice.`);
  const p = retirementPlan();
  p.retirement.socialSecurity.sam.claimAge = 69; p.retirement.socialSecurity.lee.claimAge = 62;
  const d = compute(p, { today: T });
  assert.equal(d.state, "close");
  assert.equal(words(d, money).lede, `Starting Sam's at 70 and Lee's at 62 pays the most, but only about ${money(roundAbout(d.gain))} more than the ages in your plan (Sam at 69, Lee at 62). Several pairs come within 2% of each other; any of them is a sound choice.`);
  p.retirement.socialSecurity.sam.claimAge = 70;
  const b = compute(p, { today: T });
  assert.equal(b.state, "best");
  const wb = words(b, money);
  assert.equal(wb.title, "Keep the ages in your plan");
  assert.equal(wb.lede, "Starting Sam's at 70 and Lee's at 62, the ages in your plan, already pays the most over your lives.");
  assert.equal(wb.link, "The ages in your plan already pay the most");
  const s = compute(one({ claimAge: 70 }), { today: T });
  assert.equal(words(s, money).title, "Keep the age in your plan");
  assert.equal(words(s, money).lede, "Starting at 70, the age in your plan, already pays the most over your life.");
  // one of two, already the best
  const q = two({ a: { birth: "1958-03-15", pia: 2600 }, b: { birth: "1966-07-20", pia: 2400, claimAge: 70 } });
  q.income.push({ id: "ss-a", name: "Ana's Social Security", type: "social", personId: "a", amount: 2700, period: "monthly" });
  const ob = compute(q, { today: T });
  if (ob.state === "best") assert.equal(words(ob, money).lede, "Starting Bo's at 70, the age in your plan, already pays the most over your lives.");
});

test("words: nothing left to choose (already collecting) and past 70", () => {
  const p = one({ birth: "1955-03-15" });
  p.income.push({ id: "ss", name: "Social Security", type: "social", personId: "a", amount: 2500, period: "monthly" });
  const d = compute(p, { today: T });
  assert.equal(d.state, "fixed");
  assert.equal(words(d, money).title, "No age left to choose");
  assert.equal(words(d, money).lede, "Riley already gets Social Security, so there is no age left to choose.");
  assert.equal(words(d, money).link, null);
  const q = two({ a: { birth: "1955-03-15", pia: 2600 }, b: { birth: "1957-07-20", pia: 1500 } });
  q.income.push({ id: "x", name: "Ana's", type: "social", personId: "a", amount: 2700, period: "monthly" }, { id: "y", name: "Bo's", type: "social", personId: "b", amount: 1500, period: "monthly" });
  assert.equal(words(compute(q, { today: T }), money).lede, "You both already get Social Security, so there is no age left to choose.");
  const old = one({ birth: "1955-01-10" });
  const o = compute(old, { today: T });
  assert.equal(o.state, "now");
  assert.equal(words(o, money).title, "Start now");
  assert.equal(words(o, money).lede, "Waiting past 70 adds nothing, so starting now pays the most.");
});

test("words: a partner with no figure yet is said, and only their widow(er)'s check is counted", () => {
  const p = two({ a: { birth: "1966-03-15", pia: 3000 }, b: { birth: "1968-07-20", pia: 0 } });
  const d = compute(p, { today: T });
  assert.deepEqual(d.noFigure, ["b"]);
  assert.ok(d.ready);
  assert.equal(words(d, money).noFigure, "Bo's Social Security is not in the plan yet, so only what Bo would get as a widow or widower is counted.");
  assert.equal(d.pairs.length, 9, "only Ana's age is tried");
  assert.equal(d.best.ages.a, 70, "her waiting raises what he would keep");
});

test("the green lines: the answer now, the ages saved, Undo, and Will the money last?", () => {
  const d = compute(retirementPlan(), { today: T });
  assert.equal(nowWords(d), "The ages that pay the most are now Sam at 70, Lee at 62.");
  assert.equal(nowWords(d, { sam: 70, lee: 62 }), "The ages that pay the most stay Sam at 70, Lee at 62.");
  assert.equal(nowWords(d, { sam: 69, lee: 62 }), "The ages that pay the most are now Sam at 70, Lee at 62.");
  assert.equal(savedWords(d), "Saved: your plan now starts Sam's at 70 and Lee's at 62.");
  assert.equal(undoWords(d), "Back to the ages you had: Sam at 67, Lee at 67.");
  const s = compute(one({ claimAge: 62 }), { today: T });
  assert.equal(nowWords(s), "The age that pays the most is now 70.");
  assert.equal(nowWords(s, { a: 70 }), "The age that pays the most stays 70.");
  assert.equal(savedWords(s), "Saved: your plan now starts it at 70.");
  assert.equal(undoWords(s), "Back to the age you had: 62.");
  assert.equal(nowWords(compute(one({ claimAge: 70 }), { today: T })), "The age in your plan pays the most.");
  assert.equal(retireWords({ ready: true, verdict: "on track" }), "Will the money last? now says the money lasts to the end of the plan.");
  assert.equal(retireWords({ ready: true, verdict: "tight" }), "Will the money last? now says the money lasts, with little to spare.");
  assert.equal(retireWords({ ready: true, verdict: "short", shortAge: 88 }), "Will the money last? now says the money runs out at about 88.");
  assert.equal(retireWords({ ready: false }), "");
  assert.equal(pairName(d, { sam: 69, lee: 63 }), "Sam at 69, Lee at 63");
  assert.equal(pairName(s, { a: 68 }), "At 68");
});

// ---------------------------------------------------------------- the page
const VIEW = new URL("./view.js", import.meta.url).href;
async function page(plan, opts = {}) {
  const { renderPage, FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const r = await renderPage(VIEW, plan, T, { computeOf: { "retirement/projection": () => null, ...(opts.computeOf ?? {}) }, route: { rest: [], query: {} } });
  const partsOf = () => r.root.all().filter((e) => e.tagName === "DETAILS");
  const partText = (id) => textOf(partsOf().find((e) => e.dataset?.part === id));
  // the words of the first view: everything outside the parts, and each part's summary row (its title and status)
  const outside = () => { const walk = (n) => (!(n instanceof FakeElement) ? n.textContent : n.hidden ? "" : n.tagName === "DETAILS" ? n.childNodes.filter((c) => c.tagName === "SUMMARY").map(walk).join(" ") : n.childNodes.map(walk).join(" ")); return walk(r.root).replace(/\s+/g, " ").trim(); };
  const buttons = () => r.root.all().filter((e) => e.tagName === "BUTTON" || (e.tagName === "A" && /\bbtn\b/.test(e.className)));
  const filled = () => buttons().filter((e) => !/secondary|chip|notice-action/.test(e.className) && e.tagName !== "SUMMARY");
  return { ...r, partsOf, partText, outside, buttons, filled, textOf };
}

test("page: the answer, the survivor, one filled button 'Use these ages', and three quiet parts", async () => {
  const p = await page(retirementPlan());
  const first = p.outside();
  assert.match(first, /Sam at 70, Lee at 62/);
  assert.match(first, /Starting Sam's at 70 and Lee's at 62 pays the most over your lives/);
  assert.match(first, /If Lee outlives Sam, Lee keeps Sam's larger check\./);
  assert.deepEqual(p.filled().map((b) => b.textContent), ["Use these ages"]);
  assert.deepEqual(p.partsOf().map((e) => e.dataset.part), ["pairs", "own", "how"]);
  assert.ok(p.partsOf().every((e) => !e.hasAttribute("open")), "every part shut on the first view");
  assert.match(first, /80 more pairs/);
  assert.match(first, /Set my own numbers/);
  assert.match(first, /How this is worked out/);
  assert.match(first, /More on this/);
  assert.match(first, /When should each of us start\?|What would each of us get\?/);
});

test("page: 'Use these ages' writes the two claim ages and nothing else, and says so in green with Undo", async () => {
  const plan = retirementPlan();
  const p = await page(plan);
  p.filled()[0].click();
  assert.equal(p.saved.length, 1);
  const before = migrate(structuredClone(plan)), after = structuredClone(p.saved[0]);
  assert.equal(after.retirement.socialSecurity.sam.claimAge, 70);
  assert.equal(after.retirement.socialSecurity.lee.claimAge, 62);
  after.retirement.socialSecurity.sam.claimAge = 67; after.retirement.socialSecurity.lee.claimAge = 67;
  const strip = (x) => { const q = structuredClone(x); delete q.meta; return q; };
  assert.deepEqual(strip(after), strip(before), "nothing else changed");
  // the next draw: the green line names the new answer and the new verdict of Will the money last?
  const again = await page(p.saved[0], { computeOf: { "retirement/projection": () => ({ ready: true, verdict: "on track" }) } });
  const t = again.outside();
  assert.match(t, /Saved: your plan now starts Sam's at 70 and Lee's at 62\. Will the money last\? now says the money lasts to the end of the plan\./);
  assert.match(t, /Keep the ages in your plan/);
  assert.ok(again.buttons().some((b) => b.textContent === "Undo"), "Undo");
  assert.equal(again.filled().length, 0, "no filled button once the plan's ages are the best");
});

test("page: 'Set my own numbers' writes the rate and a person's health, stays open after the save and names the answer", async () => {
  const plan = retirementPlan();
  const p = await page(plan);
  const own = p.partsOf().find((e) => e.dataset.part === "own");
  const chip = own.all().find((e) => e.tagName === "BUTTON" && e.textContent === "2% a year");
  chip.click();
  assert.equal(p.saved.at(-1).retirement.claimingRate, 0.02);
  const after = await page(p.saved.at(-1));
  const own2 = after.partsOf().find((e) => e.dataset.part === "own");
  assert.ok(own2.hasAttribute("open"), "the part just saved stays open");
  assert.ok(after.partsOf().filter((e) => e.dataset.part !== "own").every((e) => !e.hasAttribute("open")), "no other part opens");
  assert.match(after.partText("own"), /Saved: each later year now counts 2% less\. The (ages that pay the most (are now|stay) \w+ at \d+, \w+ at \d+|ages in your plan pay the most)\./);
  assert.equal(own2.all().filter((e) => e.tagName === "LABEL" && e.all().some((x) => x.tagName === "BUTTON")).length, 0, "no chip inside a <label>");
  assert.match(after.outside(), /set by you/);
  // health, kept where How long to plan for keeps it (sex untouched)
  plan.retirement.longevity = { lee: { sex: "f", health: "average" } };
  const h = await page(plan);
  const better = h.partsOf().find((e) => e.dataset.part === "own").all().filter((e) => e.tagName === "BUTTON" && e.textContent === "Better than most");
  better[1].click();
  assert.deepEqual(h.saved.at(-1).retirement.longevity.lee, { sex: "f", health: "better" });
});

test("S11: after a save only the saved part changes: Use these ages opens no part; a chip in Set my own numbers keeps that part open and no other", async () => {
  const states = (p) => Object.fromEntries(p.partsOf().filter((e) => e.dataset?.part).map((e) => [e.dataset.part, e.hasAttribute("open")]));
  await page(retirementPlan());   // a green line an earlier test's tap left (the view keeps it for the next draw) is said here
  const p = await page(retirementPlan());
  const before = states(p);
  assert.deepEqual(before, { pairs: false, own: false, how: false });
  // a save outside every part: the one filled button; its green line is under the answer, every part as it was
  p.filled()[0].click();
  assert.equal(p.saved.length, 1);
  const q = await page(p.saved[0]);
  const after = states(q);
  for (const [id, open] of Object.entries(after)) assert.equal(open, before[id] ?? false, `${id} as it was (a part drawn new is shut)`);
  assert.match(q.outside(), /Saved: your plan now starts Sam's at 70 and Lee's at 62\./);
  assert.ok(!q.partsOf().some((e) => e.all().some((x) => /\bnotice\b/.test(x.className ?? ""))), "the green line is in no part");
  // a save inside a part: a chip in Set my own numbers; that part opens with its green line, no other moves
  const chip = q.partsOf().find((e) => e.dataset.part === "own").all().find((e) => e.tagName === "BUTTON" && e.textContent === "1% a year");
  chip.click();
  assert.equal(q.saved.at(-1).retirement.claimingRate, 0.01);
  const r = await page(q.saved.at(-1));
  assert.deepEqual(states(r), { ...after, own: true });
  assert.match(r.partText("own"), /Saved: each later year now counts 1% less\./);
  // the confirmation is said once: the next draw has every part shut again
  assert.deepEqual(states(await page(q.saved.at(-1))), after);
});

test("page: 'How this is worked out' holds the rules, each person's odds and what is left out", async () => {
  const p = await page(retirementPlan());
  const how = p.partText("how");
  assert.match(how, /5\/9 of 1%/);
  assert.match(how, /82\.5%/);
  assert.match(how, /Sam has about a \d+% chance of reaching 85/);
  assert.match(how, /Left out/);
  assert.match(how, /November 13, 2026/);
});

test("page: no Social Security figure gives the empty state 'Add your Social Security first ›'", async () => {
  const plan = emptyPlan();
  plan.household.people.push({ id: "a", name: "Riley", role: "self", birthDate: "1980-01-01" });
  const p = await page(plan);
  assert.deepEqual(p.filled().map((b) => b.textContent), ["Add your Social Security first ›"]);
  assert.equal(p.partsOf().length, 0);
  const none = await page(emptyPlan());
  assert.deepEqual(none.filled().map((b) => b.textContent), ["Add the people in your home ›"]);
});

test("page: nothing left to choose draws the sentence and the links only (no parts, no button, no stray words)", async () => {
  const plan = one({ birth: "1955-03-15" });
  plan.income.push({ id: "ss", name: "Social Security", type: "social", personId: "a", amount: 2500, period: "monthly" });
  const p = await page(plan);
  const t = p.outside();
  assert.match(t, /^No age left to choose Riley already gets Social Security, so there is no age left to choose\. More on this/);
  assert.doesNotMatch(t, /null|undefined|NaN/);
  assert.equal(p.partsOf().length, 0);
  assert.equal(p.filled().length, 0);
});

test("page: one person's button says 'Use this age' and a partner with no figure is said above the parts", async () => {
  const s = await page(one({ claimAge: 62 }));
  assert.deepEqual(s.filled().map((b) => b.textContent), ["Use this age"]);
  assert.match(s.outside(), /8 more ages/);
  const c = await page(two({ a: { birth: "1966-03-15", pia: 3000 }, b: { birth: "1968-07-20", pia: 0 } }));
  assert.match(c.outside(), /Bo's Social Security is not in the plan yet, so only what Bo would get as a widow or widower is counted\. Use this age Add Bo's Social Security ›/);
});

test("Social Security page: one 'More on this' row with the answer under it (and none without one)", async () => {
  const { renderPage, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ss = new URL("../social-security/view.js", import.meta.url).href;
  const r = await renderPage(ss, retirementPlan(), T, { computeOf: { "retirement/claiming": compute }, route: { rest: [], query: {} } });
  const t = textOf(r.root);
  assert.match(t, /More on this When should each of us start\? Sam at 70, Lee at 62: about \$\d[\d,]* more over your lives/);
  // the row names money the couple gets by choosing the ages: a hint worth money (docs/OPTIONAL.md R9 item 6), marked so the
  // check holds it out of every shut part (S5), and in no shut part on the first view
  const worth = r.root.all().filter((x) => x.dataset?.worth !== undefined);
  assert.equal(worth.length, 1);
  assert.match(textOf(worth[0]), /^When should each of us start\? Sam at 70, Lee at 62: about \$\d[\d,]* more over your lives/);
  for (let a = worth[0].parentNode; a; a = a.parentNode) assert.ok(!(a.tagName === "DETAILS" && !a.hasAttribute("open")), "not inside a shut part");
  const e = await renderPage(ss, emptyPlan(), T, { computeOf: { "retirement/claiming": compute }, route: { rest: [], query: {} } });
  assert.doesNotMatch(textOf(e.root), /When should/);
  const n = await renderPage(ss, retirementPlan(), T, { route: { rest: [], query: {} } });
  assert.doesNotMatch(textOf(n.root), /When should/, "no claiming compute at hand: no row");
});

// ---------------------------------------------------------------- invariance (gap spec 3.5)
async function allPlans() {
  const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
  const out = [];
  for (const f of fs.readdirSync(path.join(ROOT, "qa", "fixtures")).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(ROOT, "qa", "fixtures", f)).href);
    for (const [n, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(n)) out.push({ name: `${f}:${n}`, plan: fn() });
  }
  const { ARCHETYPES, COMMON_PACKS, SPECIAL_PACKS } = await import(pathToFileURL(path.join(ROOT, "qa", "households", "lib", "catalog.mjs")).href);
  for (const a of ARCHETYPES) {
    out.push({ name: `${a.id}/base`, plan: a.build() });
    for (const [pack, vs] of Object.entries({ ...COMMON_PACKS, special: SPECIAL_PACKS[a.id] ?? [] })) for (const v of vs) { const plan = structuredClone(a.build()); v.apply(plan); out.push({ name: `${a.id}/${pack}/${v.slug}`, plan }); }
  }
  out.push({ name: "empty", plan: emptyPlan() });
  return out;
}
/** Couples and singles that reach Social Security's harder cases (a top-up, partners, one already paid, an age gone by, no
 * figure, past 70, a third adult, an early start), for the recorded figures below. */
function samples() {
  const paid = two({ a: { birth: "1958-03-15", pia: 2600 }, b: { birth: "1966-07-20", pia: 1500 } });
  paid.income.push({ id: "ss-a", name: "Ana's Social Security", type: "social", personId: "a", amount: 2700, period: "monthly" });
  const third = two();
  third.household.people.push({ id: "c", name: "Cy", role: "partner", birthDate: "1961-05-01" });
  third.retirement.socialSecurity.c = { monthlyAtFRA: 2200 };
  return [
    ["a couple, a top-up for Bo", two()],
    ["partners, not married", two({ relation: "partner" })],
    ["Ana already paid", paid],
    ["Ana's claim age gone by", two({ a: { birth: "1958-03-15", pia: 2600, claimAge: 66 }, b: { birth: "1960-07-20", pia: 1500 } })],
    ["Bo with no figure", two({ b: { birth: "1968-07-20", pia: 0 } })],
    ["past 70, not started", one({ birth: "1955-01-10" })],
    ["past 70, a claim age gone by", one({ birth: "1955-01-10", claimAge: 66 })],
    ["a third adult", third],
    ["one at 62", one({ claimAge: 62 })],
  ];
}
/** Social Security's figures for a plan at T: the household's year | each person's claim age, monthly check and
 * widow(er)'s amount ("paid": already gets it; "past": a claim age gone by) | the counted top-ups. */
function ssFigures(plan) {
  const r2 = (x) => Math.round(x * 100) / 100;
  const d = socialSecurity(migrate(structuredClone(plan)), { today: T });
  const ppl = d.people.map((p) => `${p.id} ${r2(p.claimAge)} ${r2(p.monthly)} ${r2(p.survivor)}${p.claimed ? " paid" : ""}${p.pastClaimAge ? " past" : ""}`).join(", ");
  const top = d.couple ? Object.values(d.couple.spousalCounted).map(r2).join("/") : "-";
  return `${r2(d.householdYearly)} | ${ppl || "-"} | ${top}`;
}
// Recorded on the base before this page (c5779a2, 2026-11-13) with that tree's Social Security compute, by the same
// ssFigures and samples(). This page's commit adds pairYears to that file and leaves its compute() as it was, so every
// figure is the same; a change to Social Security's rules that moves one of them on purpose updates its row here. (At the
// commit, the whole output of Social Security's compute over every qa plan on three days, and of every other compute.js
// over the fixture plans and the household bases, was compared with the base's, byte for byte: README "Tests".)
const BEFORE = [
  ["card-gap-plan.mjs:cardGapPlan", "66600 | p-ana 67 2650 2650, p-bo 67 2900 2900 | 0/0"],
  ["debt-plan.mjs:debtPlan", "0 | - | -"],
  ["family-plan.mjs:familyPlan", "66600 | p-ana 67 2650 2650, p-bo 67 2900 2900 | 0/0"],
  ["guessed-plan.mjs:guessedPlan", "56208 | setup-self 67 2590 2590, setup-partner 67 2094 2094 | 0/0"],
  ["held-plan.mjs:heldPlan", "66600 | p-ana 67 2650 2650, p-bo 67 2900 2900 | 0/0"],
  ["investments-plan.mjs:investmentsPlan", "58800 | sam 67 2800 2800, lee 67 2100 2100 | 0/0"],
  ["renter-debt-plan.mjs:renterDebtPlan", "21804 | setup-self 67 1817 1817 | -"],
  ["renter-debt-plan.mjs:renterPayingExtraPlan", "21804 | setup-self 67 1817 1817 | -"],
  ["retired-couple-plan.mjs:retiredCouplePlan", "0 | p-ruth 66 0 0 paid, p-sam 66.5 0 0 | -"],
  ["retirement-plan.mjs:retirementPlan", "58800 | sam 67 2800 2800, lee 67 2100 2100 | 0/0"],
  ["sample-plan.mjs:samplePlan", "0 | - | -"],
  ["tax-plan.mjs:taxPlan", "58800 | sam 67 2800 2800, lee 67 2100 2100 | 0/0"],
  ["widow-plan.mjs:widowPlan", "27600 | p-ruth 65 2300 2300 paid | -"],
  ["a couple, a top-up for Bo", "54000 | a 67 3000 3000, b 67 1000 1000 | 0/500"],
  ["partners, not married", "48000 | a 67 3000 3000, b 67 1000 1000 | 0/0"],
  ["Ana already paid", "50400 | a 66.67 2700 2700 paid, b 67 1500 1500 | 0/0"],
  ["Ana's claim age gone by", "47812.8 | a 66 2484.4 2484.4 past, b 67 1500 1500 | 0/0"],
  ["Bo with no figure", "36000 | a 67 3000 3000, b 67 0 0 | 0/0"],
  ["past 70, not started", "37632 | a 70 3136 3136 | -"],
  ["past 70, a claim age gone by", "28479.6 | a 66 2373.3 2373.3 past | -"],
  ["a third adult", "80400 | a 67 3000 3000, b 67 1000 1000, c 67 2200 2200 | 0/500"],
  ["one at 62", "20160 | a 62 1680 1980 | -"],
];
test("invariance: Social Security's figures are the ones it gave before this page (recorded on the base: every fixture plan and nine samples)", async () => {
  const plans = new Map([...(await allPlans()).map((x) => [x.name, x.plan]), ...samples()]);
  for (const [name, want] of BEFORE) {
    assert.ok(plans.has(name), `${name}: no such plan`);
    assert.equal(ssFigures(plans.get(name)), want, name);
  }
});
test("guard: no other page reads claimingRate (no other module or core file names it; Social Security's compute is the same with it set)", async () => {
  const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
  const names = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) walk(f);
      else if (/\.(js|mjs)$/.test(e.name) && !e.name.endsWith(".test.mjs") && fs.readFileSync(f, "utf8").includes("claimingRate")) names.push(path.relative(ROOT, f).split(path.sep).join("/"));
    }
  };
  walk(path.join(ROOT, "modules"));
  walk(path.join(ROOT, "core"));
  assert.deepEqual(names.filter((f) => !f.startsWith("modules/retirement/claiming/")), [], "only this page reads it");
  for (const [name, plan] of [...samples(), ["retirementPlan", retirementPlan()], ["familyPlan", familyPlan()]]) {
    const m = migrate(structuredClone(plan));
    const withRate = structuredClone(m); withRate.retirement.claimingRate = 0.02;
    assert.equal(JSON.stringify(socialSecurity(withRate, { today: T })), JSON.stringify(socialSecurity(m, { today: T })), name);
  }
});
test("claimingRate absent reads as 0%: every year counts the same (the fixture plans and a sample of the households)", async () => {
  const all = await allPlans();
  const sample = all.filter((x, i) => x.name.includes(".mjs:") || i % 60 === 0);
  assert.ok(sample.length > 20, `${sample.length} plans`);
  for (const { name, plan } of sample) {
    const m = migrate(structuredClone(plan));
    assert.equal(m.retirement?.claimingRate, undefined, `${name}: no plan holds the new field`);
    const zero = structuredClone(m); zero.retirement.claimingRate = 0;
    const a = compute(m, { today: T }), b = compute(zero, { today: T });
    assert.deepEqual({ ...a, set: null }, { ...b, set: null }, name);
  }
});

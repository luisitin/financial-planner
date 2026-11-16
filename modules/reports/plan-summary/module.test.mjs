import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, MILESTONE_YEARS, UNKNOWN_STEPS, UNKNOWN_PART, NOT_KNOWN_PARTS } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";
import { compute as timeline } from "../../overview/timeline/compute.js";
import { compute as health } from "../../overview/health-score/compute.js";

const TODAY = "2026-10-30";

test("no people: not ready", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
});

test("the family's summary carries each page's own figures", () => {
  const d = compute(familyPlan(), { today: TODAY, maxPaths: 300 });
  assert.equal(d.ready, true);
  assert.deepEqual(d.household.people.map((p) => `${p.name} ${p.age}`), ["Ana 36", "Bo 37", "Cy 6"]);
  assert.equal(Math.round(d.netWorth.netWorth), 287100);
  assert.equal(d.retirement.retireYear, 2055); assert.equal(d.retirement.lastsTo, 2085); assert.equal(d.retirement.paths, 300, "the PC's cap is respected");
  assert.ok(d.retirement.chance > 0.5 && d.retirement.chance <= 1);
  assert.equal(d.health.score, health(familyPlan(), { today: TODAY }).score);
  assert.equal(d.protection.total, 12); assert.equal(d.protection.failing.length, d.protection.total - d.protection.passed);
  assert.equal(d.goals.length, 4); assert.equal(d.debts.length, 3);
  assert.equal(d.nextSteps[0].title, "A starter emergency fund");
});

test("debt payoff dates agree with the timeline; milestones stop ten years out", () => {
  const d = compute(familyPlan(), { today: TODAY, maxPaths: 100 });
  const t = timeline(familyPlan(), { today: TODAY });
  assert.equal(d.debts.find((x) => x.name === "Mortgage").payoffDate, t.events.find((e) => e.id === "debt-a-mort").date);
  assert.ok(d.milestones.every((m) => m.year <= 2026 + MILESTONE_YEARS)); assert.ok(d.milestones.length <= 10);
});

test("debts: the payoff plan's date, and the own-payment date where it is later (the Debts page's)", () => {
  const today = "2026-11-02";
  const d = compute(familyPlan(today), { today });
  const m = d.debts.find((x) => x.name === "Mortgage");
  assert.equal(m.payoffDate.slice(0, 7), "2039-03"); assert.equal(m.ownPayoffDate.slice(0, 7), "2046-01");
  assert.equal(d.debts.find((x) => x.name === "Visa card").ownPayoffDate, null);
});

test("a goal waiting its turn on Next best action reads 'starts later' with its month, not 'behind' (review 2026-11-02)", () => {
  const T = "2026-11-02";
  const p = familyPlan(T);
  p.goals = p.goals.filter((g) => g.id === "g-col" || g.id === "g-car");
  p.goals.find((g) => g.id === "g-col").monthly = 0; p.goals.find((g) => g.id === "g-car").monthly = 900;
  const d = compute(p, { today: T, maxPaths: 100 });
  const col = d.goals.find((g) => g.name === "Cy's college");
  assert.equal(col.status, "starts later"); assert.match(col.startsIn, /^\w+ \d{4}$/);
  assert.equal(d.goals.find((g) => g.name === "Replace Bo's car").status, "on track");
  assert.doesNotMatch(JSON.stringify(d.nextSteps), /college needs more each month/);
});

// --- round 8 review (2026-11-06): the summary says what the score and Goal seek say, and no cut bigger than the spending ------
test("review UX: the summary's retirement and stress-test lines never ask for more than the whole planned spending", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { pageText } = await import("../../../qa/fixtures/fake-dom.mjs");
  const t = await pageText(new URL("./view.js", import.meta.url), renterDebtPlan(), "2026-11-06",
    { computeRemote: { "reports/plan-summary": (p, params) => compute(p, { ...params, maxPaths: 200 }) } });
  // nothing saved for retirement on file ("Retirement: not known yet"): the stress tests wait for it, never "runs out at 65"
  // under "not known yet" (smart guesses C8, critic F4)
  assert.match(t, /The stress tests need your retirement savings first\./);
  assert.ok(!/The plan survives \d+ of \d+ shocks/.test(t));
  // the score's retirement part is not known yet there either (whole-app sweep x3 fix round, critic F2): its next step is the
  // shared words, never "save about $250 a month more" under "Retirement: not known yet" (the score's own tests keep that hint, with
  // $1 saved); the sheet's own step, never "Retirement on track" (z2, 2026-11-16), and an action, not a label (z2 fix round, P1)
  assert.match(t, /Start saving for retirement\. Once you add what you have saved, we can say whether the money will last\./);
  assert.ok(!/Retirement on track/.test(t));
  assert.ok(!/To make the money last/.test(t), "no way to make it last under not known yet");
  // with $1,000 saved the stress tests run: the plan carries $0 of the $2,040 planned, so "spend about $2,040 a month less"
  // would be all of it, and does not make it last
  const saved = renterDebtPlan();
  saved.accounts.push({ id: "a-401k-x", name: "Work 401(k)", type: "401k", balance: 1000, asOf: "2026-11-01", ownerId: saved.household.people[0].id });
  const s = await pageText(new URL("./view.js", import.meta.url), saved, "2026-11-06",
    { computeRemote: { "reports/plan-summary": (p, params) => compute(p, { ...params, maxPaths: 200 }) } });
  assert.ok(!/\$2,040 a month less/.test(s), "no cut as big as the whole spending");
  assert.match(s, /The plan survives \d+ of \d+ shocks/);
  assert.match(s, /even spending nothing would not make it last/);
  // the debts' own dates hold at today's payments ("on its own payment" read as "paying the minimum")
  assert.match(t, /If you keep paying today's payments, the Visa card runs to/); assert.ok(!/On its own payment/.test(t));
});

// ---------------------------------------------------------------- z2 (c): the retirement line by Will the money last?'s gate (2026-11-16)
// Drawn for every household, the sheet's retirement answer already used Will the money last?'s gate (savingsUnknown on the same run).
// What contradicted it was on the same sheet, in the score's words: for Riley (the renter-debt fixture: 24, an empty 401(k)) "Retirement:
// not known yet" stood above "Retirement on track. Once you start saving, add it and we can answer." and "Retirement on track 0 out of
// 25". The same for the second Riley fixture and the Get started personas Sam and Jordan; nowhere else.
const z2Draw = async (plan, today) => {
  const { pageText } = await import("../../../qa/fixtures/fake-dom.mjs");
  return (await pageText(new URL("./view.js", import.meta.url), plan, today, { computeRemote: { "reports/plan-summary": (p, params) => compute(p, { ...params, maxPaths: 100 }) } })).replace(/\s+/g, " ");
};
const z2Riley = async () => (await import("../../../qa/fixtures/renter-debt-plan.mjs")).renterDebtPlan();
const z2Sam = async (T) => { const P = await import("../../../qa/fixtures/setup-personas.mjs"); return P.finishSetup("sam", P.sam(T), T); };

test("z2 (c): compute: the gate's two cases, and the score's retirement step and row titled with the answer only there", async () => {
  const T = "2026-11-16";
  const { retirementUnknown } = await import("../../retirement/projection/compute.js");
  const r = compute(await z2Riley(), { today: T, maxPaths: 100 });
  assert.equal(r.retirement.unknown, true); assert.equal(r.retirement.nothingSaved, true);
  assert.ok(retirementUnknown(await z2Riley(), { today: T }), "the same answer as the projection's gate");
  assert.deepEqual(r.nextSteps.find((s) => /retirement/i.test(s.title)), UNKNOWN_STEPS.nothingSaved);
  assert.deepEqual(UNKNOWN_STEPS.nothingSaved, { title: "Start saving for retirement", detail: "Once you add what you have saved, we can say whether the money will last." });
  assert.deepEqual(r.health.parts.filter((p) => /^Retirement/.test(p.title)).map((p) => [p.title, p.status, p.notKnown]), [[UNKNOWN_PART, "unknown", true]]);
  assert.ok(!JSON.stringify(r).includes("Retirement on track"));
  const s = compute(await z2Sam(T), { today: T, maxPaths: 100 });
  assert.equal(s.retirement.unknown, true); assert.equal(s.retirement.nothingSaved, false);
  assert.deepEqual(s.nextSteps.find((x) => /retirement/i.test(x.title)), UNKNOWN_STEPS.untold);
  assert.deepEqual(UNKNOWN_STEPS.untold, { title: "Add your retirement savings", detail: "Once they are on the Net worth page, we can say whether the money will last." });
  // an answer: the score's own titles, no new field
  const f = compute(familyPlan(T), { today: T, maxPaths: 100 });
  assert.equal(f.retirement.unknown, false); assert.ok(!("nothingSaved" in f.retirement));
  assert.equal(f.health.parts.find((p) => /^Retirement/.test(p.title)).title, "Retirement on track");
});

test("z2 (c): Riley's and Sam's sheets say not known yet everywhere, in Will the money last?'s words; the family's as before", async () => {
  const T = "2026-11-16";
  const t = await z2Draw(await z2Riley(), T);
  assert.doesNotMatch(t, /Retirement on track/);
  assert.match(t, /Retirement: not known yet\. Nothing is saved for retirement, so we can't say whether the money will last yet\. Plan health/);
  assert.match(t, /Nothing saved yet Retirement savings/);
  assert.match(t, /Not known yet Does the money last\?/);
  assert.match(t, /Start saving for retirement\. Once you add what you have saved, we can say whether the money will last\./);
  assert.match(t, /Retirement not known yet Protection not known yet Goals 0 out of 5 /);
  assert.doesNotMatch(t, /0 out of 25/);
  assert.doesNotMatch(t, /runs out/);
  const s = await z2Draw(await z2Sam(T), T);
  assert.doesNotMatch(s, /Retirement on track/);
  assert.match(s, /Retirement: not known yet\. You haven't told us about retirement savings, so we can't say whether the money will last yet\. Plan health/);
  assert.match(s, /Not entered yet Retirement savings/);
  assert.match(s, /Add your retirement savings\. Once they are on the Net worth page, we can say whether the money will last\./);
  // an answer: the score's row and its points, as before
  const f = await z2Draw(familyPlan(T), T);
  assert.match(f, /Retirement on track 25 out of 25/);
  assert.doesNotMatch(f, /not known yet/i);
});

// ---------------------------------------------------------------- z2 invariance (2026-11-16)
// Where the sheet's retirement answer is "not known yet" (Will the money last?'s own gate: savingsUnknown on the same run), the
// Plan health score's retirement step and row no longer say "Retirement on track", and the lead says Will the money last?'s words
// for the two cases. Over every qa/fixtures/*-plan.mjs plan, the 14 households' base plans, the phone-built ones, the round 8
// households, the four personas (finished and mid-setup), the demo and the empty plan, with nothing new typed, compute gives byte
// for byte what it gave at e223a42 (z2-invariance.json, written by this test on that code); a plan the gate calls unknown gives it
// once its new words are put back (`retirement.nothingSaved` taken off, the step and the row titled as the score titles them).
// To write the digests down again (only on the code before a deliberate change): PRINT=1 node --test modules/reports/plan-summary/module.test.mjs
test("z2 invariance: the plan summary is e223a42's for every household, but the retirement words where it is not known yet", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const crypto = await import("node:crypto");
  const { pathToFileURL, fileURLToPath } = await import("node:url");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const T = "2026-11-16";
  const dig = (x) => crypto.createHash("sha256").update(JSON.stringify(x) ?? "undefined").digest("base64url").slice(0, 22);
  const plans = [];
  const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
  const dir = path.join(ROOT, "qa", "fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) plans.push({ name: `fixture ${f}:${name}`, plan: fn(T) });
  }
  const { ARCHETYPES } = await imp("qa/households/lib/catalog.mjs");
  for (const a of ARCHETYPES) plans.push({ name: `${a.id}/base`, plan: a.build() });
  for (const [name, fn] of Object.entries(await imp("qa/fixtures/phone-households.mjs"))) if (typeof fn === "function") plans.push({ name: `phone ${name}`, plan: fn() });
  for (const [name, fn] of Object.entries(await imp("qa/fixtures/round8-households.mjs"))) if (typeof fn === "function" && /Plan$/.test(name)) plans.push({ name: `round8 ${name}`, plan: fn() });
  const P = await imp("qa/fixtures/setup-personas.mjs");
  for (const n of ["sam", "jordan", "patLee", "ruth"]) { plans.push({ name: `persona ${n}`, plan: P.finishSetup(n, P[n](T), T) }); plans.push({ name: `persona ${n} mid`, plan: P[n](T) }); }
  plans.push({ name: "demo", plan: (await imp("qa/fixtures/demo-household.mjs")).demoHousehold(T) });
  plans.push({ name: "empty plan", plan: emptyPlan() });
  const run = (f) => { try { return f(); } catch (e) { return { threw: e.message }; } };
  // the gated sheet with the score's own retirement step and titles back and without the new fields: what e223a42 gave
  const { compute: health } = await import("../../overview/health-score/compute.js");
  const sheetSteps = Object.values(UNKNOWN_STEPS).map((x) => x.title);
  const putBack = (d, plan) => {
    if (!d?.retirement?.unknown) return d;
    const { nothingSaved: _n, ...retirement } = d.retirement;
    const fix = health(plan, { today: T }).parts.find((x) => x.id === "retirement").fix;
    return { ...d, retirement,
      nextSteps: d.nextSteps.map((s) => (sheetSteps.includes(s.title) ? { title: "Retirement on track", detail: fix } : s)),
      health: d.health && { ...d.health, parts: d.health.parts.map(({ notKnown: _k, ...x }) => (x.title === UNKNOWN_PART ? { ...x, title: "Retirement on track" } : x)) } };
  };
  const now = {}, gated = [];
  for (const { name, plan } of plans) {
    const q = migrate(structuredClone(plan));
    const d = run(() => compute(q, { today: T, maxPaths: 200 }));
    if (d?.retirement?.unknown) gated.push(name);
    now[name] = dig(process.env.PRINT ? d : putBack(d, q));
  }
  const file = new URL("./z2-invariance.json", import.meta.url);
  if (process.env.PRINT) { fs.writeFileSync(file, `${JSON.stringify({ note: "Plan summary at e223a42 (z2), maxPaths 200; PRINT=1 writes them again: only on that code", today: T, plans: now }, null, 1)}\n`); return; }
  const was = JSON.parse(fs.readFileSync(file, "utf8")).plans;
  assert.ok(Object.keys(now).length >= 50, `${Object.keys(now).length} households`);
  assert.deepEqual(now, was);
  assert.deepEqual(gated, ["fixture renter-debt-plan.mjs:renterDebtPlan", "fixture renter-debt-plan.mjs:renterPayingExtraPlan", "persona sam", "persona jordan"]);
});

// ---------------------------------------------------------------- z2 fix round (2026-11-17): the step and the table rows
// M1: a 24-year-old with an empty 401(k), a salary, rent and no Social Security entered: the score waits for Social Security, the
// sheet's answer for savings. The step said "Retirement: not known yet. Add your Social Security on the Social Security page ..."
// under an opening that says nothing is saved. P1: "Retirement: not known yet. Once you start saving, add it and we can answer."
// read as a label and "it" named nothing. M2/P4: every part the score could not judge read "not known yet", Goals too (no goal
// with a date), while every other sheet says "0 out of 5" for it.
const z2Young = (accounts) => {
  const p = emptyPlan();
  p.household = { people: [{ id: "a", name: "Riley", role: "self", birthDate: "2002-03-01", retirementAge: 65 }], filingStatus: "single", state: "TX" };
  p.income = [{ id: "i", name: "Job", type: "salary", personId: "a", amount: 52000, period: "yearly", taxable: true }];
  p.expenses = [{ id: "e", name: "Rent", category: "housing", amount: 1500, period: "monthly", essential: true }];
  p.accounts = accounts;
  return p;
};

test("z2 fix (M1, P1): the retirement step is the sheet's own action, one sentence per case, even where the score waits for Social Security", async () => {
  const T = "2026-11-17";
  const { compute: health } = await import("../../overview/health-score/compute.js");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const empty401k = migrate(z2Young([{ id: "k", name: "401k", type: "401k", balance: 0, ownerId: "a" }]));
  assert.match(health(empty401k, { today: T }).parts.find((p) => p.id === "retirement").fix, /Social Security/, "the score itself waits for Social Security");
  const r = compute(empty401k, { today: T, maxPaths: 100 });
  assert.equal(r.retirement.unknown, true); assert.equal(r.retirement.nothingSaved, true);
  const step = r.nextSteps.find((s) => /retirement/i.test(s.title));
  assert.deepEqual(step, UNKNOWN_STEPS.nothingSaved);
  assert.ok(!r.nextSteps.some((s) => /^Retirement/.test(s.title)), "no step reads as a label");
  // cash only: told us nothing about retirement savings
  const cash = migrate(z2Young([{ id: "c", name: "Checking", type: "checking", balance: 5000, ownerId: "a" }]));
  const c = compute(cash, { today: T, maxPaths: 100 });
  assert.equal(c.retirement.unknown, true); assert.equal(c.retirement.nothingSaved, false);
  assert.deepEqual(c.nextSteps.find((s) => /retirement/i.test(s.title)), UNKNOWN_STEPS.untold);
  // drawn: the opening and the step say the same thing
  const t = await z2Draw(empty401k, T);
  assert.match(t, /Retirement: not known yet\. Nothing is saved for retirement, so we can't say whether the money will last yet\./);
  assert.match(t, /Start saving for retirement\. Once you add what you have saved, we can say whether the money will last\./);
  assert.doesNotMatch(t, /not known yet\. Add your Social Security/);
  assert.doesNotMatch(t, /add it and we can answer/);
  // $1 in the 401(k): an answer, and the score's own step and title come back
  const one = migrate(z2Young([{ id: "k", name: "401k", type: "401k", balance: 1, ownerId: "a" }]));
  const o = compute(one, { today: T, maxPaths: 100 });
  assert.equal(o.retirement.unknown, false);
  assert.ok(!o.nextSteps.some((s) => Object.values(UNKNOWN_STEPS).some((x) => x.title === s.title)));
});

test("z2 fix (M2, P4): under not known yet only the parts waiting for that answer say so; Goals keeps its points", async () => {
  const T = "2026-11-16";
  assert.deepEqual(NOT_KNOWN_PARTS, ["retirement", "protection"]);
  const r = compute(await z2Riley(), { today: T, maxPaths: 100 });
  assert.deepEqual(r.health.parts.filter((p) => p.notKnown).map((p) => p.title), [UNKNOWN_PART, "Protection"]);
  const goals = r.health.parts.find((p) => p.title === "Goals");
  assert.equal(goals.status, "unknown", "the score could not judge Goals either (no goal with a date)");
  assert.ok(!("notKnown" in goals));
  // a sheet with an answer: no part carries the flag, whatever its status
  const f = compute(familyPlan(T), { today: T, maxPaths: 100 });
  assert.ok(f.health.parts.every((p) => !("notKnown" in p)));
});

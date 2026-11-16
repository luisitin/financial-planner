import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, MILESTONE_YEARS } from "./compute.js";
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
  // $1 saved)
  assert.match(t, /Retirement on track\. Once you start saving, add it and we can answer\./);
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

import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, crisisFacts, CRISES, TAKE_HOME, JOB_LOSS_MONTHS, CARE_HOME_YEARLY } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { retirementPlan } from "../../../qa/fixtures/retirement-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const fam = compute(familyPlan(), { today: TODAY });
const sc = (d, id) => d.scenarios.find((s) => s.id === id);

test("an empty plan says what is missing", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.ready, false); assert.ok(d.missing.length);
});

test("the family: twelve shocks, two deaths for a couple, the count of survivals", () => {
  assert.equal(fam.ready, true);
  assert.deepEqual(fam.scenarios.map((s) => s.id), ["crash-2008", "lost-decade", "seventies", "depression", "both-down", "lower-returns", "job-loss", "disability", "death-p-ana", "death-p-bo", "long-life", "care-home"]);
  assert.equal(fam.passed, fam.scenarios.filter((s) => s.success).length);
  assert.equal(fam.total, 12);
  assert.equal(fam.when, "retire"); assert.equal(fam.hitYear, 2055);
  for (const s of fam.scenarios) if (s.success) assert.ok(s.roomMonthly > -1, `${s.id}: lasting means some spending room`); else assert.ok(s.roomMonthly < 0 && s.failYear && s.failAge, s.id);
});

test("a market crisis replays the real years from the hit year: the path is the plan's own until then", () => {
  const crash = sc(fam, "crash-2008");
  const k = fam.hitYear - fam.startYear;
  for (let i = 0; i < k; i++) near(crash.path[i], fam.base.path[i], 1e-6);
  assert.ok(crash.path[k] < fam.base.path[k], "2008 hits in the retirement year");
  const now = compute(familyPlan(), { today: TODAY, when: "now" });
  assert.equal(now.hitYear, 2026); assert.ok(sc(now, "crash-2008").path[0] < now.base.path[0]);
  assert.ok(sc(fam, "lower-returns").endReal < fam.base.endReal);
});

test("crisis facts come from the data: 1929's fall, 2008's first year, a one-year span", () => {
  const f29 = crisisFacts(CRISES.find((c) => c.id === "depression"));
  near(f29.fall, 1 - 0.917021 * 0.748764 * 0.561625 * 0.913576, 0.001);
  const f08 = crisisFacts(CRISES.find((c) => c.id === "crash-2008"));
  near(f08.first.stocks, -0.365523, 1e-9); assert.equal(f08.span, "2008 to 2012");
  assert.equal(crisisFacts(CRISES.find((c) => c.id === "both-down")).span, "2022");
});

test("life: the job loss takes six months of the bigger take-home pay; the death shocks drop spending and the dead partner's pay", () => {
  const job = sc(fam, "job-loss");
  const anaPay = 3900 * 26;   // the bigger earner
  assert.match(job.title, /^Ana /);
  assert.match(job.story, new RegExp(`\\$${(Math.round(anaPay * TAKE_HOME * JOB_LOSS_MONTHS / 12 / 10) * 10).toLocaleString("en-US")}`));
  assert.ok(job.path[0] < fam.base.path[0], "the first year's savings are lower");
  assert.ok(sc(fam, "disability").endReal < fam.base.endReal);
  const deathAna = sc(fam, "death-p-ana");
  assert.match(deathAna.story, /Bo goes on alone/); assert.match(deathAna.story, /head of household/, "a child at home");
  const single = retirementPlan(); single.household.people = single.household.people.slice(0, 1);
  const s1 = compute(single, { today: TODAY });
  assert.equal(s1.scenarios.some((s) => s.id.startsWith("death-")), false, "no partner, no death shock");
});

test("a long life runs five more years; a care home takes three years of the median cost", () => {
  const ll = sc(fam, "long-life");
  assert.equal(ll.path.length, fam.base.path.length + 5, "95 -> 100 for the last of them");
  assert.match(ll.story, /chance .* is (about|under)/);
  const care = sc(fam, "care-home");
  assert.match(care.story, /85th birthday/); assert.ok(care.story.includes(CARE_HOME_YEARLY.toLocaleString("en-US")));
  assert.ok(care.endReal < fam.base.endReal);
});

test("someone already retired: markets hit now and there is no job to lose", () => {
  const p = retirementPlan(); p.household.people[0].birthDate = "1956-01-01"; p.household.people[1].birthDate = "1957-01-01"; p.income = [];
  const d = compute(p, { today: TODAY, when: "retire" });
  assert.equal(d.when, "now", "already retired: the only time a crash can hit is now");
  assert.equal(d.scenarios.some((s) => s.id === "job-loss" || s.id === "disability"), false);
  assert.ok(d.notes.some((n) => n.includes("job-loss")));
});

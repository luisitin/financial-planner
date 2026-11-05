import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, PARTS, BANDS } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const part = (d, id) => d.parts.find((p) => p.id === id);

test("the weights add to 100 and the bands cover every score", () => {
  assert.equal(Object.values(PARTS).reduce((s, v) => s + v, 0), 100);
  for (const s of [0, 49, 50, 70, 85, 100]) assert.ok(BANDS.find((b) => s >= b.min));
});

test("an empty plan scores low and every part says what to add", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.ready, true); assert.ok(d.score < 30, String(d.score));
  for (const id of ["cushion", "saving", "retirement", "protection", "goals"]) assert.equal(part(d, id).status, "unknown", id);
  assert.ok(d.parts.every((p) => p.fix || p.points === p.max));
});

test("the family: each part from its page, the total is the sum, the gains largest first", () => {
  const d = compute(familyPlan(), { today: TODAY });
  assert.equal(d.score, Math.round(d.parts.reduce((s, p) => s + p.points, 0)));
  assert.equal(d.band, BANDS.find((b) => d.score >= b.min).label);
  const c = part(d, "cushion"); assert.ok(c.points < 3 && c.status === "bad", "0.9 months of 6");
  assert.equal(part(d, "retirement").points, 25, "133% of planned spending");
  assert.equal(part(d, "saving").points, 15);
  const pr = part(d, "protection"); assert.equal(pr.points, 10, "4 of 6 life shocks"); assert.match(pr.detail, /"Ana can never work again"/);
  assert.equal(part(d, "goals").points, 0);
  for (let i = 1; i < d.gains.length; i++) assert.ok(d.gains[i - 1].max - d.gains[i - 1].points >= d.gains[i].max - d.gains[i].points);
  assert.equal(d.gains[0].id, "cushion");
});

test("improving the plan raises the score: a full cushion and reviewed assumptions", () => {
  const before = compute(familyPlan(), { today: TODAY }).score;
  const p = familyPlan(); p.accounts.find((a) => a.id === "a-chk").balance = 40000; p.assumptions.reviewedAt = "2026-10-01";
  const d = compute(p, { today: TODAY });
  assert.equal(part(d, "cushion").points, 15); assert.equal(part(d, "knows").points, 10);
  assert.ok(d.score > before + 10, `${before} -> ${d.score}`);
});

test("short on the careful month (review 2026-11-02): the saving part says it counts uneven pay at what you can count on, and what a full month leaves", async () => {
  const { compute: next } = await import("../next-best-action/compute.js");
  // nothing saved yet, so the saving part reads the month itself; the side income ($600) counted at $0
  const plan = () => { const p = familyPlan(); p.retirement.contributions = []; p.goals = []; return p; };
  const at = (leftInFull) => { const p = plan(); p.expenses.push({ id: "x-more", name: "More", category: "fun", amount: next(plan(), { today: TODAY }).spare.monthly - leftInFull, period: "monthly", essential: false }); p.income.find((x) => x.id === "i-side").countOn = 0; return p; };
  const good = at(150), s = next(good, { today: TODAY }).spare;
  assert.ok(s.monthly < 0 && s.held > 0.5);
  assert.match(part(compute(good, { today: TODAY }), "saving").detail, /a month more goes out than comes in after tax, counting uneven pay at what you can count on \(Side income\); a month that brings the Income page's amount leaves about \$150\.$/);
  assert.match(part(compute(at(-120), { today: TODAY }), "saving").detail, /a month that brings the Income page's amount is still about \$120 short\.$/);
  // nothing held back: the plain sentence
  const p = plan(); p.expenses.push({ id: "x-more", name: "More", category: "fun", amount: next(plan(), { today: TODAY }).spare.monthly + 100, period: "monthly", essential: false });
  assert.match(part(compute(p, { today: TODAY }), "saving").detail, /^About \$100 a month more goes out than comes in after tax\.$/);
});

test("no retirement verdict before Social Security is known: not scored, the top fix is to add it; Quick answers and the Timeline say nothing either way (round 4)", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { answerFor } = await import("../quick/compute.js");
  const { compute: timeline } = await import("../timeline/compute.js");
  const { compute: next } = await import("../next-best-action/compute.js");
  const T = "2026-11-02";
  const p = familyPlan(T);
  p.retirement.socialSecurity = {};
  const d = compute(p, { today: T });
  const r = d.parts.find((x) => x.id === "retirement"), pr = d.parts.find((x) => x.id === "protection");
  assert.equal(r.status, "unknown"); assert.equal(r.points, 0); assert.match(r.detail, /^Not scored yet/); assert.doesNotMatch(r.detail, /runs out/);
  assert.match(r.fix, /^Add Social Security for Ana and Bo on the Social Security page .*, or say there that you will not get it\.$/); assert.deepEqual(r.go, ["retirement", "social-security"]);
  assert.equal(pr.status, "unknown");
  assert.equal(d.gains[0].id, "retirement", "the biggest gain is adding Social Security, not spending less");
  assert.equal(answerFor("retire", p, { today: T }), null);
  const tl = timeline(p, { today: T });
  assert.ok(!tl.events.some((e) => e.id === "short" || e.id === "lasts")); assert.ok(tl.events.some((e) => e.id === "needs-ss"));
  // review 2026-11-02: the Timeline's top box says neither "runs out" nor "lasts" until then
  assert.equal(tl.headline.shortYear, null); assert.equal(tl.headline.lastsTo, null); assert.equal(tl.headline.needsSS, true);
  // only a birth date missing: it says that, and goes to People, not the Social Security page
  const nb = familyPlan(T); delete nb.household.people.find((x) => x.id === "p-bo").birthDate;
  const rb = compute(nb, { today: T }).parts.find((x) => x.id === "retirement");
  assert.equal(rb.status, "unknown");
  assert.equal(rb.detail, "Not scored yet: whether the money lasts needs Bo's birth date."); assert.equal(rb.fix, "Add Bo's birth date on People."); assert.deepEqual(rb.go, ["household", "people"]);
  const tb = timeline(nb, { today: T }).events.find((e) => e.id === "needs-ss");
  assert.match(tb.detail, /Bo's birth date on People/); assert.deepEqual(tb.go, ["household", "people"]);
  // one figure missing: named
  const half = familyPlan(T); delete half.retirement.socialSecurity["p-bo"];
  assert.match(compute(half, { today: T }).parts.find((x) => x.id === "retirement").fix, /^Add Social Security for Bo on the Social Security page .*, or say there that Bo will not get it\.$/);
  // said as "none" for both, it is judged again
  p.guide = { setup: { ss: { "p-ana": "none", "p-bo": "none" } } };
  assert.notEqual(compute(p, { today: T }).parts.find((x) => x.id === "retirement").status, "unknown");
  // one adult: "An IRA of your own", not "for each of you"
  const one = familyPlan(T);
  one.household.people = one.household.people.filter((x) => x.id !== "p-bo");
  one.income = one.income.filter((x) => x.personId !== "p-bo");
  assert.equal(next(one, { today: T }).steps.find((s) => s.id === "ira")?.title, "An IRA of your own");
  // review 2026-11-02: two adults, one earner: one IRA's room, said the same on Next best action and the Dashboard's move
  const { revealWords } = await import("../setup/compute.js");
  const oneEarner = familyPlan(T); oneEarner.income = oneEarner.income.filter((x) => x.personId !== "p-bo");
  const ira = next(oneEarner, { today: T }).steps.find((s) => s.id === "ira");
  assert.equal(ira.title, "An IRA of your own"); assert.equal(ira.people, 1); assert.doesNotMatch(ira.detail, /each/);
  const w = revealWords(ira, oneEarner, { today: T });
  assert.equal(w.title, "A retirement account of your own (an IRA)"); assert.doesNotMatch(w.detail, /between you/);
});

test("Goals part: a goal waiting its turn on Next best action counts as on track, as on Goals and the Timeline (review 2026-11-02)", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const T = "2026-11-02";
  const p = familyPlan(T);
  p.goals = p.goals.filter((g) => g.id === "g-col" || g.id === "g-car");
  p.goals.find((g) => g.id === "g-col").monthly = 0; p.goals.find((g) => g.id === "g-car").monthly = 900;
  const part = compute(p, { today: T }).parts.find((x) => x.id === "goals");
  assert.equal(part.share, 1);
  assert.match(part.detail, /2 of 2 goals with a date are done or on track, counting one waiting its turn\./);
  assert.equal(part.fix, null);
  assert.doesNotMatch(JSON.stringify(compute(p, { today: T }).parts), /needs more each month/);
});

test("the full-month figure is Next best action's own, to the nearest $10, as every page says it (review 2026-11-02, round 5)", async () => {
  const { compute: next } = await import("../next-best-action/compute.js");
  const plan = () => { const p = familyPlan(); p.retirement.contributions = []; p.goals = []; p.income.find((x) => x.id === "i-side").countOn = 0; return p; };
  const p = plan(); p.expenses.push({ id: "x-more", name: "More", category: "fun", amount: next(plan(), { today: TODAY }).spare.full - 297, period: "monthly", essential: false });
  const s = next(p, { today: TODAY }).spare;
  assert.ok(s.monthly < 0); assert.equal(s.fullAbout, 300);
  assert.match(part(compute(p, { today: TODAY }), "saving").detail, /a month that brings the Income page's amount leaves about \$300\.$/);
});

test("a full month within $5 of $0 'only just about breaks even' in the saving part, never 'about $0' (review 2026-11-02, round 5)", async () => {
  const { compute: next } = await import("../next-best-action/compute.js");
  const plan = () => { const p = familyPlan(); p.retirement.contributions = []; p.goals = []; p.income.find((x) => x.id === "i-side").countOn = 0; return p; };
  const at = (left) => { const p = plan(); p.expenses.push({ id: "x-more", name: "More", category: "fun", amount: next(plan(), { today: TODAY }).spare.full - left, period: "monthly", essential: false }); return p; };
  for (const left of [3, -2]) {
    const detail = part(compute(at(left), { today: TODAY }), "saving").detail;
    assert.match(detail, /a month that brings the Income page's amount only just about breaks even\.$/);
    assert.doesNotMatch(detail, /about \$0\b/);
  }
});

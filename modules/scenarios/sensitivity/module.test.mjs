import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, NUDGE, SS_PAYABLE_IF_DEPLETED } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";
import { buildInputs } from "../../retirement/projection/compute.js";
import { affordableSpending, copyInputs } from "../../../core/math/retirement.js";

const TODAY = "2026-10-30";
const d = compute(familyPlan(), { today: TODAY });
const row = (id) => d.rows.find((r) => r.id === id);

test("an empty plan says what is missing", () => {
  const e = compute(emptyPlan(), { today: TODAY });
  assert.equal(e.ready, false); assert.ok(e.missing.length);
});

test("eleven inputs for the family, sorted by swing, the biggest first", () => {
  assert.equal(d.ready, true);
  assert.deepEqual(d.rows.map((r) => r.id).sort(), ["bonds", "claim", "end", "inflation", "mix", "raises", "retire", "saving", "ss-cut", "stocks", "tax"]);
  for (let i = 1; i < d.rows.length; i++) assert.ok(d.rows[i - 1].swing >= d.rows[i].swing);
  assert.equal(d.biggest, d.rows[0]);
  near(d.base.spendingMonthly, 7000);
});

test("each end is the plan with exactly one thing changed (checked against a hand-made change)", () => {
  const I = buildInputs(familyPlan(), { today: TODAY }).inputs;
  const s = copyInputs(I); s.returns.stocks -= NUDGE.returns;
  near(row("stocks").low.affordableMonthly, affordableSpending(s) / 12, 1);
  const c = copyInputs(I); for (const x of c.incomes) if (x.kind === "social") x.yearly *= SS_PAYABLE_IF_DEPLETED;
  near(row("ss-cut").low.affordableMonthly, affordableSpending(c) / 12, 1);
  near(row("ss-cut").high.affordableMonthly, d.base.affordableMonthly, 1);
  assert.equal(row("retire").low.label, "age 63"); assert.equal(row("retire").high.label, "age 67");
  assert.equal(row("saving").baseLabel.startsWith("$"), true);
});

test("the directions make sense: more return, later retirement, saving more and later claiming help; more inflation and a longer plan hurt", () => {
  for (const id of ["stocks", "bonds", "retire", "saving", "claim", "raises"]) assert.equal(row(id).worse, "low", id);
  for (const id of ["inflation", "end", "tax"]) assert.equal(row(id).worse, "high", id);
});

test("no flat tax row in brackets mode; no retirement row once retired", () => {
  const p = familyPlan(); p.retirement.taxMode = "brackets";
  assert.equal(compute(p, { today: TODAY }).rows.some((r) => r.id === "tax"), false);
  const q = familyPlan(); q.household.people[0].birthDate = "1958-01-01";
  assert.equal(compute(q, { today: TODAY }).rows.some((r) => r.id === "retire"), false);
});

test("review 2026-11-02 (round 5): the trust-fund row stays when nobody can still choose; left-out people by reason; 'now' only when it is now for all", async () => {
  const { retirementPlan } = await import("../../../qa/fixtures/retirement-plan.mjs");
  const T = "2026-11-02";
  const retired = (samBorn, leeBorn) => { const p = retirementPlan(); p.household.people[0].birthDate = samBorn; p.household.people[1].birthDate = leeBorn; p.income = []; p.retirement.contributions = []; return p; };
  const social = (id, amount) => ({ id: `ss-${id}`, name: "Social Security", type: "social", personId: id, amount, period: "monthly" });
  // both already get it: no claiming row, but the 77% row, checked against a hand-made cut
  const both = retired("1950-03-10", "1957-06-20"); both.income = [social("sam", 2800), social("lee", 2100)];
  const a = compute(both, { today: T });
  assert.equal(a.rows.some((r) => r.id === "claim"), false);
  const cut = a.rows.find((r) => r.id === "ss-cut");
  assert.ok(cut, "the trust-fund row is there for benefits already paid");
  const c = copyInputs(buildInputs(both, { today: T }).inputs); for (const x of c.incomes) if (x.kind === "social") x.yearly *= SS_PAYABLE_IF_DEPLETED;
  near(cut.low.affordableMonthly, affordableSpending(c) / 12, 1); near(cut.high.affordableMonthly, a.base.affordableMonthly, 1);
  // Sam is 76 and never claimed (66 on file), Lee 69 and 5 months: only Lee moves, and Sam is left out for his age
  const old = retired("1950-06-20", "1957-06-10"); old.retirement.socialSecurity.sam.claimAge = 66;
  const b = compute(old, { today: T }).rows.find((r) => r.id === "claim");
  assert.equal(b.help, "Lee only: Sam is 70 or over, when waiting adds nothing"); assert.equal(b.low.label, "now (69 and 5 months)");
  old.income = [social("sam", 2100)];
  assert.equal(compute(old, { today: T }).rows.find((r) => r.id === "claim").help, "Lee only: Sam already gets it");
  // 64 and 6 months and 60 and 5 months, both moved to the older one's age: "at", not "now"; alone, Sam's "now" is true
  const mixed = retired("1962-05-10", "1966-06-20"); mixed.household.people[1].retirementAge = 60;
  assert.equal(compute(mixed, { today: T }).rows.find((r) => r.id === "claim").low.label, "at 64 and 6 months");
  delete mixed.retirement.socialSecurity.lee;
  assert.equal(compute(mixed, { today: T }).rows.find((r) => r.id === "claim").low.label, "now (64 and 6 months)");
});

test("review 2026-11-02 (round 5, second pass): the method note says how the claiming row moves a couple", async () => {
  const { retirementPlan } = await import("../../../qa/fixtures/retirement-plan.mjs");
  const { ssMethodNote } = await import("./compute.js");
  const T = "2026-11-02";
  const retired = (samBorn, leeBorn) => { const p = retirementPlan(); p.household.people[0].birthDate = samBorn; p.household.people[1].birthDate = leeBorn; p.income = []; p.retirement.contributions = []; return p; };
  // 64 and 6 months and 60 and 5 months: both move to the older one's age today, not to 62
  const mixed = retired("1962-05-10", "1966-06-20"); mixed.household.people[1].retirementAge = 60;
  const m = compute(mixed, { today: T });
  assert.equal(m.rows.find((r) => r.id === "claim").low.label, "at 64 and 6 months");
  assert.equal(m.ssMethod, "Social Security: Sam and Lee claiming at the same age, the older one's age today (62 at the earliest), or both at 70; and the 77% that would be payable if the retirement trust fund runs dry in 2033 (2025 Trustees Report).");
  // one person still choosing
  delete mixed.retirement.socialSecurity.lee;
  assert.match(compute(mixed, { today: T }).ssMethod, /^Social Security: Sam claiming at today's age \(62 at the earliest\) or at 70; and the 77%/);
  // both already paid: no claiming row, so only the trust fund
  const both = retired("1950-03-10", "1957-06-20"); both.income = [{ id: "a", name: "SS", type: "social", personId: "sam", amount: 2800, period: "monthly" }, { id: "b", name: "SS", type: "social", personId: "lee", amount: 2100, period: "monthly" }];
  assert.equal(compute(both, { today: T }).ssMethod, "Social Security: the 77% that would be payable if the retirement trust fund runs dry in 2033 (2025 Trustees Report).");
  assert.equal(ssMethodNote([], false), null);
  assert.match(ssMethodNote(["A", "B", "C"], false), /^Social Security: A, B and C claiming at the same age, the oldest one's age today \(62 at the earliest\), or all at 70\.$/);
});

function near(a, b, tol = 0.5) { assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`); }

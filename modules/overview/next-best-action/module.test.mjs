import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, FICA, HIGH_RATE } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const step = (d, id) => d.steps.find((s) => s.id === id);
const near = (a, b, tol = 1) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("no income or expenses: says what is missing", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.ready, false); assert.equal(d.missing.length, 2);
});

test("the spare money: pay less federal and payroll tax, spending, retirement and goal saving", () => {
  const d = compute(familyPlan(), { today: TODAY });
  near(d.spare.gross, (3900 * 26 + 5200 * 12 + 600 * 12) / 12, 0.01);
  const payroll = (3900 * 26) * (FICA.ss + FICA.medicare) + (5200 * 12) * (FICA.ss + FICA.medicare) + 600 * 12 * FICA.seBase * FICA.selfEmployed;
  near(d.spare.payrollTax, payroll / 12, 0.01);
  near(d.spare.retirementSaving, (470 * 26 + 300 * 12) / 12, 0.01);   // the employer's match is not from pay
  near(d.spare.goalSaving, 400 + 300 + 250, 0.01);
  near(d.spare.monthly, d.spare.gross - d.spare.federalTax - d.spare.payrollTax - d.spare.spending - d.spare.retirementSaving - d.spare.goalSaving, 0.01);
  assert.ok(d.spare.monthly > 3000 && d.spare.monthly < 5000, String(d.spare.monthly));
});

test("the order for the family, the next step, and the dates the spare money reaches", () => {
  const d = compute(familyPlan(), { today: TODAY });
  assert.deepEqual(d.steps.map((s) => s.id), ["bills", "starter", "protect", "match", "high-debt", "full-fund", "ira", "mid-debt", "max-401k", "goals", "rest"]);
  assert.equal(d.next.id, "starter");
  // Ana's death would leave Bo and Cy short (Life insurance needs' own answer); Bo's would not: the plan holds
  const pr = step(d, "protect");
  assert.deepEqual(pr.people.map((x) => [x.name, x.gap, x.cover, x.until, x.depends]), [["Ana", 212000, 0, 2042, ["Bo", "Cy"]]]);
  assert.match(pr.detail, /^If Ana died this year, Bo and Cy would be about \$212,000 short\. Term life cover on Ana until about 2042 \(Cy turns 22\) closes it\./);
  assert.equal(pr.gap, null, "an action, not a sum the spare money fills");
  assert.equal(step(d, "bills").status, "done");
  assert.equal(step(d, "match").status, "check", "Bo has a 401(k) and pay but no contribution");
  near(step(d, "high-debt").gap, 6400); assert.ok(step(d, "high-debt").detail.includes("23.9%"));
  assert.ok(step(d, "mid-debt").detail.includes("Car loan"), "5.9% is middling"); assert.equal(step(d, "mid-debt").detail.includes("Mortgage"), false);
  // the gaps fill in order: starter, then the card, then the full fund
  assert.ok(step(d, "starter").doneDate <= step(d, "high-debt").doneDate && step(d, "high-debt").doneDate <= step(d, "full-fund").doneDate);
  near(step(d, "ira").roomYearly, 7500 + (7500 - 3600));
  near(step(d, "max-401k").roomYearly, 24500 - 470 * 26, 1);   // the match does not use the employee's limit
  assert.ok(step(d, "ira").startDate >= step(d, "full-fund").doneDate.slice(0, 7) || step(d, "ira").startDate <= step(d, "full-fund").doneDate);
});

test("spending more than comes in makes the bills the next step and stops the dates", () => {
  const p = familyPlan(); p.expenses.push({ id: "big", name: "Boat", category: "fun", amount: 9000, period: "monthly", essential: false });
  const d = compute(p, { today: TODAY });
  assert.ok(d.spare.monthly < 0); assert.equal(d.next.id, "bills");
  assert.ok(d.steps.every((s) => !s.doneDate && !s.startDate));
});

test("no expensive debt, no HSA, no 401(k): those steps are done or left out", () => {
  const p = familyPlan();
  p.debts = p.debts.filter((x) => x.accountId !== "a-visa"); p.accounts = p.accounts.filter((a) => a.id !== "a-visa" && a.type !== "401k");
  p.retirement.contributions = p.retirement.contributions.filter((c) => c.accountId !== "a-401");
  const d = compute(p, { today: TODAY });
  assert.equal(step(d, "high-debt").status, "done");
  assert.equal(step(d, "match"), undefined); assert.equal(step(d, "max-401k"), undefined); assert.equal(step(d, "hsa"), undefined);
  assert.ok(HIGH_RATE === 0.10);
});

test("an HSA account but no high-deductible plan this year: no HSA step (IRC 223(c)(1))", () => {
  const p = familyPlan();
  if (!p.accounts.some((a) => a.type === "hsa")) p.accounts.push({ id: "a-hsa-test", name: "HSA", type: "hsa", balance: 1000, ownerId: p.household.people[0].id });
  assert.ok(step(compute(p, { today: TODAY }), "hsa"), "with self-only cover the step is there");
  p.taxes.hsa = { ...p.taxes.hsa, coverage: "none" };
  assert.equal(step(compute(p, { today: TODAY }), "hsa"), undefined);
});

test("the match step: a 401(k) from a job left moves the question to the job now; no match leaves nothing to check; the step names who to ask", () => {
  const p = familyPlan("2026-11-02");
  const d0 = compute(p, { today: "2026-11-02" });
  const m0 = step(d0, "match");
  assert.equal(m0.status, "check", "Bo has a 401(k) and pay, nothing going in");
  assert.deepEqual(m0.ask.map((a) => a.personId), ["p-bo"]);
  assert.ok(m0.ask[0].accounts.length >= 1);
  // the 401(k) is from a job Bo left
  const p1 = familyPlan("2026-11-02");
  for (const a of p1.accounts) if (m0.ask[0].accounts.includes(a.id)) a.formerJob = true;
  const m1 = step(compute(p1, { today: "2026-11-02" }), "match");
  assert.equal(m1.status, "check", "Bo is still paid: the question moves to the job Bo has now");
  assert.deepEqual(m1.ask, [{ personId: "p-bo", name: "Bo", accounts: [], newJob: true, old: m0.ask[0].accounts }], "no question about putting money into the old job's 401(k)");
  p1.retirement.workPlans = { "p-bo": { match: false } };
  const m1b = step(compute(p1, { today: "2026-11-02" }), "match");
  assert.ok(!m1b || m1b.status === "done", "and nothing once Bo said the job now has no plan or no match");
  // Bo's job has no match
  const p2 = familyPlan("2026-11-02");
  p2.retirement.workPlans = { "p-bo": { match: false } };
  const m2 = step(compute(p2, { today: "2026-11-02" }), "match");
  assert.ok(!m2 || m2.status === "done", "nothing to check once Bo said there is no match");
  assert.equal(m2?.ask?.length ?? 0, 0);
});

test("review: a gap under half a dollar is done; Open enrollment's match tiers answer the match question too", () => {
  const p = familyPlan("2026-11-02");
  const T = "2026-11-02";
  const gap = step(compute(p, { today: T }), "starter").gap;
  p.accounts.find((a) => a.id === "a-chk").balance += Math.round(gap);   // the amount the page shows, in whole dollars
  const st = step(compute(p, { today: T }), "starter");
  assert.equal(st.status, "done"); assert.equal(st.gap, 0);
  const q = familyPlan(T);
  q.accounts.find((a) => a.id === "a-chk").balance += 1000;
  q.whatIfs = { ...(q.whatIfs ?? {}), benefits: { "p-bo": { matchTiers: [] } } };
  assert.ok(!step(compute(q, { today: T }), "match") || step(compute(q, { today: T }), "match").status === "done", "no match typed on Open enrollment");
  q.whatIfs.benefits["p-bo"].matchTiers = [{ rate: 0.5, upTo: 0.06 }];
  q.retirement.workPlans = { "p-bo": { match: false } };
  assert.equal(step(compute(q, { today: T }), "match").status, "check", "a match typed there wins over an older no");
});

test("protection: done once the cover on file reaches the need; no step for a household nobody depends on", () => {
  const p = familyPlan();
  p.insurance = { ...(p.insurance ?? {}), policies: [{ id: "t1", kind: "term", personId: "p-ana", benefit: 250000, premium: 25, period: "monthly", throughWork: false }] };
  assert.equal(compute(p, { today: TODAY }).steps.find((s) => s.id === "protect"), undefined, "Ana's $250,000 covers the $212,000");
  p.insurance.policies[0].benefit = 100000;
  const pr = compute(p, { today: TODAY }).steps.find((s) => s.id === "protect");
  assert.equal(pr.people[0].gap, 112000); assert.match(pr.detail, /even with the \$100,000 of cover on file\. More cover on Ana/);
  const single = familyPlan();
  single.household.people = single.household.people.filter((x) => x.id === "p-ana");
  single.income = single.income.filter((x) => x.personId === "p-ana");
  assert.equal(compute(single, { today: TODAY }).steps.find((s) => s.id === "protect"), undefined, "one adult, no children: nobody to protect");
});

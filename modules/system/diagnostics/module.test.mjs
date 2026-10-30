import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, applyFix, checkPages, LINKS, ID_LISTS, STORAGE_LIMIT, STORAGE_WARN } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan, SCHEMA_VERSION } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const fam = (fn) => { const p = familyPlan(TODAY); if (fn) fn(p); return p; };
const issue = (p, key) => compute(p, { today: TODAY }).issues.find((x) => x.key === key);

test("a whole plan and an empty one have nothing to fix", () => {
  assert.deepEqual(compute(fam(), { today: TODAY }).issues, []);
  assert.deepEqual(compute(emptyPlan(), { today: TODAY }).issues, []);
  const c = compute(fam(), { today: TODAY }).counts;
  assert.equal(c.people, 3); assert.equal(c.accounts, 10); assert.equal(c.goals, 4);
});

test("links to a person who is gone: found, named, and fixed by making them the household's", () => {
  const p = fam((q) => { q.income[0].personId = "p-gone"; q.income[1].personId = "p-gone"; q.accounts[2].ownerId = "p-gone"; });
  const i = issue(p, "link:income.person");
  assert.equal(i.count, 2); assert.equal(i.level, "warn"); assert.equal(i.page, "cashflow/income");
  assert.match(i.text, /^2 income items belong to someone no longer on the People page/); assert.match(i.names, /Ana's salary, Bo's salary/);
  assert.match(issue(p, "link:accounts.owner").text, /^1 account belongs to/);
  assert.equal(applyFix(p, "link:income.person"), 2);
  assert.equal(p.income[0].personId, ""); assert.equal(p.income[2].personId, "p-bo", "a good link is left alone");
  assert.equal(issue(p, "link:income.person"), undefined);
});

test("a goal counting an account that is gone loses only that account; a required link is a problem without a fix", () => {
  const p = fam((q) => { q.goals[0].fundedBy = ["a-sav", "a-gone"]; q.retirement.contributions[0].accountId = "a-gone"; q.debts[0].accountId = ""; });
  assert.ok(issue(p, "link:goals.fundedBy").fix);
  assert.equal(applyFix(p, "link:goals.fundedBy"), 1); assert.deepEqual(p.goals[0].fundedBy, ["a-sav"]);
  const c = issue(p, "link:contributions.account");
  assert.equal(c.level, "bad"); assert.equal(c.fix, null); assert.equal(applyFix(p, "link:contributions.account"), 0);
  assert.equal(issue(p, "link:debts.account").count, 1, "a loan detail with no account at all");
  // every link names a page and a list
  for (const L of LINKS) assert.ok(L.page && L.field && L.say.length === 2);
});

test("the same id twice, or none: each gets its own, the first keeps it", () => {
  const p = fam((q) => { q.accounts[5].id = q.accounts[4].id; delete q.expenses[0].id; });
  const a = issue(p, "ids:accounts");
  assert.equal(a.level, "bad"); assert.equal(a.count, 1); assert.match(a.text, /share an id/);
  const first = p.accounts[4].id;
  assert.equal(applyFix(p, "ids:accounts"), 1);
  assert.equal(p.accounts[4].id, first); assert.equal(p.accounts[5].id, `${first}-2`);
  assert.match(issue(p, "ids:expenses").text, /have no id/);
  applyFix(p, "ids:expenses"); assert.equal(p.expenses[0].id, "expenses-2");
  assert.deepEqual(compute(p, { today: TODAY }).issues, []);
  assert.ok(ID_LISTS.every((D) => D.page));
});

test("a \"how often\" the app does not know, and amounts that are not numbers", () => {
  const p = fam((q) => { q.expenses[0].period = "yearly"; q.income[0].amount = "lots"; q.accounts[0].balance = null; q.expenses[1].amount = -5; });
  assert.match(issue(p, "period:expenses").text, /^1 expense has a "how often" the app does not know \("yearly"\), so it is counted as every month/);
  assert.equal(issue(p, "amount:income").count, 1); assert.equal(issue(p, "amount:expenses").count, 1);
  assert.equal(issue(p, "amount:accounts").level, "bad");
  assert.equal(issue(fam((q) => { q.income[0].amount = "3900"; }), "amount:income"), undefined, "a number typed as text still counts");
});

test("dates: not real dates (30 February), birth dates and balance dates after today, ends before starts", () => {
  const p = fam((q) => { q.household.people[0].birthDate = "1990-02-30"; q.household.people[1].birthDate = "2030-01-01"; q.accounts[0].asOf = "2027-01-01"; q.expenses[0].startDate = "2026-06-01"; q.expenses[0].endDate = "2026-01-01"; q.goals[0].targetDate = "soon"; });
  assert.match(issue(p, "date:people.birth").text, /^1 person's birth date is not a real date \(for example "1990-02-30"\)/);
  assert.equal(issue(p, "future:people.birth").count, 1); assert.equal(issue(p, "future:accounts.asOf").count, 1);
  assert.match(issue(p, "order:expenses").text, /ends before it starts/);
  assert.equal(issue(p, "date:goals.date").count, 1);
  assert.equal(issue(fam((q) => { q.household.people[0].birthDate = "2000-02-29"; }), "date:people.birth"), undefined, "a leap day is a date");
  assert.ok(issue(fam((q) => { q.household.people[0].birthDate = "1900-02-29"; }), "date:people.birth"), "1900 was not a leap year");
});

test("rates typed as whole numbers (6 for 6%) are read as percentages", () => {
  const p = fam((q) => { q.debts[0].rate = 6.5; q.assumptions = { ...(q.assumptions ?? {}), inflation: 3 }; });
  const d = issue(p, "rate:debts.rate");
  assert.equal(d.level, "bad"); assert.match(d.text, /interest rate over 100% \(for example 650%\): probably 6.5% was meant/);
  assert.equal(d.names, "Mortgage", "a loan detail is named by its account"); assert.equal(d.fix.label, "Read it as a percentage");
  assert.equal(applyFix(p, "rate:debts.rate"), 1); assert.equal(p.debts[0].rate, 0.065);
  assert.equal(applyFix(p, "rate:assumptions"), 1); assert.equal(p.assumptions.inflation, 0.03);
  assert.equal(issue(fam((q) => { q.debts[0].rate = 1; }), "rate:debts.rate"), undefined, "100% exactly is left alone");
});

test("one person marked as you; a plan from a newer app; a plan near the browser's room", () => {
  assert.match(issue(fam((q) => { q.household.people[1].role = "self"; }), "people.self").text, /^2 people are marked as "you"/);
  assert.match(issue(fam((q) => { q.household.people[0].role = "partner"; }), "people.self").text, /^Nobody is marked/);
  assert.ok(issue(fam((q) => { q.schemaVersion = SCHEMA_VERSION + 1; }), "schema"));
  const big = fam((q) => { q.notes = "x".repeat(Math.ceil(STORAGE_LIMIT * STORAGE_WARN)); });
  const s = issue(big, "size"); assert.equal(s.level, "warn"); assert.match(s.text, /^The plan takes 80% of the space/);
  const d = compute(fam(), { today: TODAY }).size;
  assert.equal(d.chars, JSON.stringify(fam()).length); assert.equal(d.share, d.chars / STORAGE_LIMIT);
});

test("every page's sums: placeholders and heavy pages skipped, an error caught with the page named", () => {
  const ok = { key: "a/ok", title: "Fine", compute: () => ({ x: 1 }), status: "usable" };
  const boom = { key: "a/boom", title: "Broken", compute: (p) => p.nothing.here, status: "usable" };
  const said = { key: "a/said", title: "Said", compute: () => ({ error: "no data" }), status: "stub" };
  const planned = { key: "a/p", title: "Later", compute: () => { throw new Error("never run"); }, status: "planned" };
  const heavy = { key: "a/h", title: "Slow", compute: () => { throw new Error("never run"); }, status: "usable", heavy: true };
  const touch = { key: "a/t", title: "Writes", compute: (p) => { p.income = []; return {}; }, status: "usable" };
  const plan = fam();
  const r = checkPages([ok, boom, said, planned, heavy, touch], plan, TODAY);
  assert.equal(r.ran, 4); assert.equal(r.skipped, 2);
  assert.deepEqual(r.failed.map((f) => f.key), ["a/boom", "a/said"]); assert.match(r.failed[0].error, /Cannot read properties of undefined/);
  assert.equal(plan.income.length, 3, "each page gets its own copy of the plan");
});

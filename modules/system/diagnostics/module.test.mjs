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

test("links to a person who is gone: found, named, and fixed by making them the household's; a typed owner name is not a link", () => {
  const p = fam((q) => { q.income[0].personId = "p-gone"; q.income[1].personId = "p-gone"; q.accounts[2].ownerId = "Ana"; q.accounts[3].ownerId = "Grandma"; q.accounts[4].ownerId = "p-gone"; q.retirement.pensions = [{ id: "pn1", personId: "p-gone", name: "Teacher pension", monthly: 1500, startAge: 60 }]; });
  const i = issue(p, "link:income.person");
  assert.equal(i.count, 2); assert.equal(i.level, "warn"); assert.equal(i.page, "cashflow/income");
  assert.match(i.text, /^2 income items belong to someone no longer on the People page/); assert.equal(i.names, "Ana's salary; Bo's salary");
  assert.equal(i.fix.label, "Make them the household's");
  const o = issue(p, "link:accounts.owner");
  assert.equal(o.count, 1, "Net worth's \"whose account\" is typed text: only a label the app made (a removed person's) counts"); assert.equal(o.names, "Bo's old 401(k)");
  const pn = issue(p, "link:pensions.person");
  assert.match(pn.text, /^1 pension belongs to someone no longer on the People page; its page counts it as Ana's until you choose whose it is/);
  assert.equal(pn.fix, null, "a pension cannot be the household's: its page decides");
  assert.equal(applyFix(p, "link:income.person"), 2);
  assert.equal(p.income[0].personId, ""); assert.equal(p.income[2].personId, "p-bo", "a good link is left alone");
  assert.equal(issue(p, "link:income.person"), undefined);
  assert.equal(p.accounts[2].ownerId, "Ana", "nothing else touched");
});

test("a goal counting an account that is gone loses only that account; leftovers no page shows can be removed", () => {
  const p = fam((q) => {
    q.goals[0].fundedBy = ["a-sav", "a-gone"]; q.retirement.contributions[0].accountId = "a-gone";
    q.accounts = q.accounts.filter((a) => a.id !== "a-car");   // the car loan paid off and deleted on Net worth: its loan detail stays
    q.holdings = [{ id: "h1", accountId: "a-gone", symbol: "VTI", shares: 10 }, { id: "h2", accountId: "a-brk", symbol: "BND", shares: 5 }];
    q.estate = { ...(q.estate ?? {}), beneficiaries: [{ key: "account:a-gone", accountId: "a-gone", primary: [] }, { key: "account:a-401", accountId: "a-401", primary: [] }] };
    q.debtPlan = { ...(q.debtPlan ?? {}), mortgageAccountId: "a-gone", customOrder: ["a-visa", "a-gone"] };
    q.retirement.socialSecurity = { "p-ana": { claimAge: 67 }, "p-gone": { claimAge: 62 } };
  });
  assert.ok(issue(p, "link:goals.fundedBy").fix);
  assert.equal(applyFix(p, "link:goals.fundedBy"), 1); assert.deepEqual(p.goals[0].fundedBy, ["a-sav"]);
  const c = issue(p, "link:contributions.account");
  assert.equal(c.level, "bad"); assert.equal(c.fix, null); assert.equal(applyFix(p, "link:contributions.account"), 0);
  assert.equal(c.names, "a saving of $470 every two weeks", "a saving with no account is named by its amount, never its id");
  const d = issue(p, "link:debts.account");
  assert.equal(d.count, 1); assert.equal(d.fix.label, "Remove the leftover loan detail"); assert.match(d.names, /^a loan at \d/);
  assert.equal(d.page, null, "no page shows a leftover, so none is offered");
  assert.equal(issue(p, "link:debtPlan.mortgage").names, "", "a single setting has no name to show");
  const before = p.debts.length;
  assert.equal(applyFix(p, "link:debts.account"), 1); assert.equal(p.debts.length, before - 1);
  assert.equal(applyFix(p, "link:holdings.account"), 1); assert.deepEqual(p.holdings.map((h) => h.id), ["h2"]);
  assert.equal(applyFix(p, "link:beneficiaries.account"), 1); assert.equal(p.estate.beneficiaries.length, 1);
  assert.equal(applyFix(p, "link:debtPlan.mortgage"), 1); assert.equal(p.debtPlan.mortgageAccountId, "");
  assert.equal(applyFix(p, "link:debtPlan.order"), 1); assert.deepEqual(p.debtPlan.customOrder, ["a-visa"]);
  assert.match(issue(p, "link:socialSecurity.person").text, /kept for someone no longer on the People page/);
  assert.equal(applyFix(p, "link:socialSecurity.person"), 1); assert.deepEqual(Object.keys(p.retirement.socialSecurity), ["p-ana"]);
  // every link names a page, a field and its words for one and several
  for (const L of LINKS) assert.ok((L.page === null ? L.fix === "remove" : !!L.page) && L.field && (typeof L.say === "function" ? L.say("Ana").length === 2 : L.say.length === 2) && (!L.fix || L.fixLabel.length === 2), L.key);
});

test("items are named in plain words, never by their hidden label", () => {
  const p = fam((q) => {
    q.rules = [{ id: "7f3c9a2e-1b4d-4c8e-9f0a-2b6d1e3f5a7c", contains: "COFFEE", accountId: "a-gone" }];
    q.estate = { ...(q.estate ?? {}), documents: [{ id: "m3k9x2ab", kind: "will", personId: "p-gone" }, { id: "g1", kind: "guardian", personId: "p-gone" }, { id: "x1", kind: "constructor", personId: "p-gone" }] };
    q.property = [{ id: "pr1", kind: "vehicle", name: "Family car", loanAccountId: "a-gone" }];
    q.insurance = { ...(q.insurance ?? {}), policies: [{ id: "po1", name: "Car insurance", kind: "auto", accountId: "a-gone" }] };
  });
  assert.equal(issue(p, "link:rules.account").names, 'the rule for "COFFEE"');
  const e = issue(p, "link:estate.person");
  assert.equal(e.names, "Will and 1 more", "the Estate papers page's own words; an unknown kind is counted, not named"); assert.equal(e.count, 2); assert.equal(e.fix.label, "Remove the leftover papers");
  assert.equal(issue(p, "link:estate.household").fix.label, "Make it the household's", "a guardian paper comes back once blank");
  const q = structuredClone(p); applyFix(q, "link:estate.person"); applyFix(q, "link:estate.household");
  assert.deepEqual(q.estate.documents.map((x) => [x.id, x.personId]), [["g1", ""]]);
  assert.equal(issue(p, "link:property.loan").page, "property/vehicles");
  assert.equal(issue(p, "link:insurance.account").names, "Car insurance");
  for (const x of compute(p, { today: TODAY }).issues) assert.doesNotMatch(`${x.text} ${x.names}`, /7f3c9a2e|m3k9x2ab|returnStocks/);
});

test("two items with the same hidden label, or none: told apart, the first keeps its own", () => {
  const p = fam((q) => { q.accounts[5].id = q.accounts[4].id; delete q.expenses[0].id; });
  const a = issue(p, "ids:accounts");
  assert.equal(a.level, "bad"); assert.equal(a.count, 2, "both copies");
  assert.match(a.text, /^2 of your accounts share a hidden label with another, so changing or removing one can change another/); assert.equal(a.fix.label, "Tell them apart");
  assert.equal(a.changes, 1, "the first keeps its label: the fix changes one");
  const first = p.accounts[4].id;
  assert.equal(applyFix(p, "ids:accounts"), 1);
  assert.equal(p.accounts[4].id, first); assert.equal(p.accounts[5].id, `${first}-2`);
  const e = issue(p, "ids:expenses");
  assert.match(e.text, /^1 of your expenses has no hidden label, so the app cannot safely change or remove it/); assert.equal(e.fix.label, "Give it a label");
  applyFix(p, "ids:expenses"); assert.equal(p.expenses[0].id, "expenses-2");
  assert.deepEqual(compute(p, { today: TODAY }).issues, []);
  assert.ok(ID_LISTS.every((D) => D.page));
  for (const x of compute(fam((q) => { q.accounts[5].id = q.accounts[4].id; }), { today: TODAY }).issues) assert.doesNotMatch(`${x.text} ${x.fix?.label ?? ""}`, /\bid\b/i, "no \"id\" on screen");
});

test("a \"how often\" missing or unknown, amounts that are not numbers, amounts below 0", () => {
  const p = fam((q) => { q.expenses[0].period = "yearly"; delete q.expenses[2].period; q.income[0].amount = "lots"; q.accounts[0].balance = null; q.expenses[1].amount = -260; });
  assert.match(issue(p, "period:expenses").text, /^1 expense has a "how often" the app does not know \("yearly"\), so it is counted as every month/);
  assert.match(issue(p, "period-blank:expenses").text, /^1 expense has no "how often", so it is counted as every month/);
  assert.match(issue(p, "amount:income").text, /not a number, so it counts as 0/);
  assert.match(issue(p, "negative:expenses").text, /^1 expense has an amount below 0, so it is taken off your totals instead of added/);
  assert.equal(issue(p, "amount:expenses"), undefined, "a number below 0 is not \"not a number\"");
  assert.equal(issue(p, "amount:accounts").level, "bad");
  assert.equal(issue(fam((q) => { q.income[0].amount = "3900"; }), "amount:income"), undefined, "a number typed as text still counts");
  assert.ok(issue(fam((q) => { q.expenses[0].period = "constructor"; }), "period:expenses"), "only the app's own periods count");
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
  assert.equal(d.level, "bad"); assert.match(d.text, /^1 loan has an interest rate over 100% \(for example 650%\): probably 6.5% was meant/);
  assert.equal(d.names, "Mortgage", "a loan detail is named by its account"); assert.equal(d.fix.label, "Read it as a percentage");
  assert.equal(applyFix(p, "rate:debts.rate"), 1); assert.equal(p.debts[0].rate, 0.065);
  assert.equal(applyFix(p, "rate:assumptions"), 1); assert.equal(p.assumptions.inflation, 0.03);
  assert.equal(issue(fam((q) => { q.debts[0].rate = 1; }), "rate:debts.rate"), undefined, "100% exactly is left alone");
  assert.match(issue(fam((q) => { q.debts[0].rate = 1.004; }), "rate:debts.rate").text, /for example 100.4%/, "never shown as 100%");
  assert.match(issue(fam((q) => { q.debts[0].rate = 1.0004; }), "rate:debts.rate").text, /for example 100.1%/, "rounded up, never down to 100%");
  assert.match(issue(fam((q) => { q.goals[2].rate = 7; }), "rate:goals.rate").text, /^1 goal has a growth rate over 100%/);
  const A = issue(fam((q) => { q.assumptions = { ...(q.assumptions ?? {}), returnStocks: 7, salaryGrowth: 3 }; }), "rate:assumptions");
  assert.equal(A.names, "stock returns, pay growth");
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

test("every fix changes exactly as many items as its confirm question says", () => {
  const p = fam((q) => {
    q.income[0].personId = "p-gone"; q.accounts[4].ownerId = "p-gone"; q.accounts[5].id = q.accounts[4].id; q.accounts[6].id = q.accounts[4].id; delete q.expenses[0].id;
    q.goals[0].fundedBy = ["a-sav", "a-gone"]; q.debts[0].rate = 6.5; q.goals[1].rate = 4; q.assumptions = { ...(q.assumptions ?? {}), inflation: 3, returnStocks: 7 };
    q.accounts = q.accounts.filter((a) => a.id !== "a-car"); q.holdings = [{ id: "h1", accountId: "a-gone", symbol: "VTI", shares: 1 }];
    q.rules = [{ id: "r1", contains: "COFFEE", accountId: "a-gone" }]; q.events = [{ id: "e1", name: "Trip", goalId: "g-gone" }];
    q.estate = { documents: [{ id: "d1", kind: "will", personId: "p-gone" }, { id: "d2", kind: "letter", personId: "p-gone" }], beneficiaries: [{ key: "policy:po-gone", policyId: "po-gone", primary: [{ name: "Bo", share: 1 }] }] };
    q.insurance = { policies: [{ id: "po1", name: "Car", kind: "auto", personId: "p-gone", accountId: "a-gone" }] };
    q.property = [{ id: "pr1", kind: "vehicle", name: "Car", accountId: "a-gone", loanAccountId: "a-gone" }];
    q.debtPlan = { mortgageAccountId: "a-gone", customOrder: ["a-gone", "a-visa"] }; q.equity = { personId: "p-gone", grants: [] };
    q.retirement.socialSecurity = { "p-gone": { claimAge: 62 } };
  });
  const fixable = compute(p, { today: TODAY }).issues.filter((x) => x.fix);
  assert.ok(fixable.length >= 15, `${fixable.length} fixable`);
  for (const x of fixable) assert.equal(applyFix(structuredClone(p), x.key), x.changes ?? x.count, x.key);
  assert.equal(issue(p, "link:beneficiaries.policy").names, "the list naming Bo");
});

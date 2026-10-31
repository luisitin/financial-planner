import { test } from "node:test";
import assert from "node:assert/strict";
import { changesBetween, timeline, entryFor, labelOf, words, firstOf, prepare, compute, whenOf, listOf } from "./compute.js";
import { migrate } from "../../../core/schema/migrate.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const base = () => familyPlan("2026-10-31");
const texts = (l) => l.map((x) => x.text);

test("one save: records added, removed and changed by name; an object's details in words; a list inside it as its own entry", () => {
  const older = base();
  const newer = structuredClone(older);
  newer.accounts.push({ id: "new", name: "New savings", type: "savings", balance: 100 });
  newer.accounts = newer.accounts.filter((a) => a.id !== "a-visa");
  newer.accounts.find((a) => a.id === "a-chk").balance += 50;
  newer.household.filingStatus = "single";
  newer.household.people[0].name = "Ana B.";
  newer.insurance.policies.push({ id: "pol-new", name: "Renters cover", kind: "home" });
  newer.assumptions.returnStocks = 0.06;
  newer.notes = "a note";
  newer.meta.updatedAt = "2099-01-01T00:00:00Z";   // differs on every save: never a change
  const d = changesBetween(older, newer);
  const by = Object.fromEntries(d.map((x) => [x.key, x]));
  assert.deepEqual(texts(by.accounts.added), ["New savings"]);
  assert.equal(by.accounts.removed.length, 1);
  assert.deepEqual(texts(by.accounts.changed), ["Chase checking"]);
  assert.deepEqual(by.accounts.changed[0].fields, ["balance"], "what changed in it");
  assert.equal(by.accounts.count, 3);
  assert.deepEqual(by.household.details, ["filing status"], "the people list is not a detail: it has its own entry");
  assert.deepEqual(texts(by["household.people"].changed), ["Ana B."]);
  assert.deepEqual(by["household.people"].changed[0].fields, ["name"]);
  assert.equal(by["household.people"].label, "People");
  assert.deepEqual(texts(by["insurance.policies"].added), ["Renters cover"]);
  assert.ok(!by.insurance, "insurance's only change is a policy: no empty entry for the section");
  assert.deepEqual(by.assumptions.details, ["stock returns"]);
  assert.deepEqual(by.notes.details, ["changed"]);
  assert.ok(!by.meta);
  assert.deepEqual(d.map((x) => x.key), ["household", "household.people", "accounts", "insurance.policies", "assumptions", "notes"], "the app's section order, a section's own list right after it");
});

test("records keyed by month or day count as records (monthly reviews, net worth history); a section the plan did not have", () => {
  const older = base();
  const newer = structuredClone(older);
  newer.reviews = [{ month: "2026-10", at: "2026-10-31", note: "" }];
  newer.netWorthHistory.push({ date: "2026-10-31", assets: 1, liabilities: 0, netWorth: 1 });
  newer.reminders = [{ id: "r1", name: "Car registration", date: "2026-12-01", repeat: "yearly" }];
  const by = Object.fromEntries(changesBetween(older, newer).map((x) => [x.key, x]));
  assert.deepEqual(texts(by.reviews.added), ["2026-10"]);
  assert.deepEqual(texts(by.netWorthHistory.added), ["2026-10-31"]);
  assert.deepEqual(texts(by.reminders.added), ["Car registration"]);
  assert.equal(by.reminders.label, "Reminders");
  assert.deepEqual(changesBetween(older, structuredClone(older)), [], "nothing changed");
  assert.deepEqual(changesBetween(null, undefined), []);
});

test("a record's name: its own, the account it is about, a paper's checklist name, its kind; a transaction keeps its amount and day", () => {
  const p = base();
  assert.deepEqual(labelOf({ id: "t1", payee: "Corner Cafe", amount: -4.5, date: "2026-10-30" }, p, "transactions"), { text: "Corner Cafe", amount: -4.5, date: "2026-10-30" });
  assert.deepEqual(labelOf({ id: "d-mort", accountId: "a-mort", rate: 0.06 }, p, "debts"), { text: p.accounts.find((a) => a.id === "a-mort").name });
  assert.deepEqual(labelOf({ id: "rc1", accountId: "a-chk", from: "2026-09-01", to: "2026-09-30" }, p, "reconciliations"), { text: "Statement for Chase checking", date: "2026-09-30" });
  const ana = p.household.people[0];
  assert.equal(labelOf({ key: `birth:${ana.id}`, where: "safe" }, p, "papers").text, `Birth certificate (${ana.name})`);
  assert.equal(labelOf({ key: "taxReturns", where: "file box" }, p, "papers").text, "Tax returns");
  assert.equal(labelOf({ key: "own-1", label: "Boat title", custom: true }, p, "papers").text, "Boat title");
  assert.equal(labelOf({ id: "le1", kind: "baby", date: "2027-01-01" }, p, "lifeEvents").text, "a baby or adoption", "lower case: it follows added, removed or changed");
  assert.equal(labelOf({ id: "x" }, p, "other").text, "an item");
  assert.equal(labelOf({ id: "x", name: "  " , kind: "nothing" }, p).text, "an item", "a blank name is no name");
});

test("details in words: split at capitals, or the app's own word for it", () => {
  assert.equal(words("filingStatus"), "filing status");
  assert.equal(words("returnStocks"), "stock returns");
  assert.equal(words("plan_end-age"), "plan end age");
  assert.deepEqual(firstOf(["a", "b", "c", "d", "e"]), { shown: ["a", "b", "c"], more: 2 });
  assert.deepEqual(firstOf([], 3), { shown: [], more: 0 });
});

test("the log: each save is the copy made at it against the next copy (the plan now for the newest), newest first", () => {
  const p0 = base();
  const p1 = structuredClone(p0); p1.goals.push({ id: "g-new", name: "New roof", target: 9000 }); p1.meta.updatedBy = "Kitchen tablet";
  const p2 = structuredClone(p1); p2.meta.updatedAt = "2026-10-31T10:00:00Z";   // a save where nothing you can see changed
  const p3 = structuredClone(p2); p3.goals = p3.goals.filter((g) => g.id !== "g-new"); p3.meta.updatedBy = "Phone";
  const steps = [
    { name: "plan-2026-10-31T08-00-00.json", when: "2026-10-31T08:00:00Z", plan: p0 },
    { name: "plan-2026-10-31T09-00-00.json", when: "2026-10-31T09:00:00Z", plan: p1 },
    { name: "plan-2026-10-31T10-00-00.json", when: "2026-10-31T10:00:00Z", plan: p2 },
    { plan: p3 },
  ];
  const t = timeline(steps);
  assert.equal(t.quiet, 1);
  assert.deepEqual(t.entries.map((e) => e.when), ["2026-10-31T10:00:00Z", "2026-10-31T08:00:00Z"]);
  assert.deepEqual(texts(t.entries[0].changes[0].removed), ["New roof"]);
  assert.equal(t.entries[0].by, "Phone", "the device the newer side records");
  assert.deepEqual(texts(t.entries[1].changes[0].added), ["New roof"]);
  assert.equal(t.entries[1].by, "Kitchen tablet");
  assert.equal(t.entries[1].count, 1);
});

test("a copy that could not be read: the two saves beside it say so; no device recorded is null; too few copies", () => {
  const p0 = base(), p2 = structuredClone(p0);
  p2.notes = "x";
  const t = timeline([{ when: "2026-10-31T08:00:00Z", plan: p0 }, { when: "2026-10-31T09:00:00Z", plan: null }, { plan: p2 }]);
  assert.deepEqual(t.entries.map((e) => [e.when, e.unreadable]), [["2026-10-31T09:00:00Z", true], ["2026-10-31T08:00:00Z", true]]);
  const one = timeline([{ when: "2026-10-31T08:00:00Z", plan: p0 }, { plan: p2 }]);
  assert.equal(one.entries[0].by, null);
  assert.deepEqual(timeline([{ plan: p2 }]), { entries: [], quiet: 0 });
  assert.deepEqual(timeline(undefined), { entries: [], quiet: 0 });
});

test("compute: the plan's last save and its device; the copies' names and times come from Backups", () => {
  const p = emptyPlan();
  assert.equal(compute(p).by, null);
  p.meta.updatedBy = " Laptop ";
  assert.equal(compute(p).by, "Laptop");
  assert.equal(compute(undefined).savedAt, null);
  assert.equal(whenOf("plan-2026-10-31T09-30-05.json"), "2026-10-31T09:30:05Z");
  assert.equal(listOf(["plan-2026-10-30T10-00-00.json", "plan-2026-10-31T09-30-00.json"])[0].name, "plan-2026-10-31T09-30-00.json");
});

test("a copy saved before the app added a section or a default: brought up to date first, so nothing shows that nobody changed", () => {
  const old = base();
  delete old.reviews; delete old.taxes.gains; delete old.assumptions.emergencyMonths; delete old.retirement.pensions; delete old.debtPlan;
  const now = migrate(structuredClone(old));
  assert.ok(changesBetween(old, now).length > 0, "compared raw, the filled-in defaults look like changes");
  assert.deepEqual(changesBetween(prepare(old), now), []);
  const t = timeline([{ when: "2026-10-31T08:00:00Z", plan: old }, { plan: now }]);
  assert.deepEqual([t.entries.length, t.quiet], [0, 1], "a save that changed nothing you can see");
  assert.ok(!("reviews" in old), "the copy itself is not changed");
  assert.deepEqual(changesBetween({ papers: undefined, notes: "" }, { papers: [], notes: null }), [], "missing and empty are the same");
});

test("the plan's name and currency count; the save stamps do not; page notes are listed by page; bank file layouts are one change", () => {
  const a = base(), b = structuredClone(a);
  b.meta.updatedAt = "2099-01-01T00:00:00Z"; b.meta.updatedBy = "Phone"; b.meta.createdAt = "2099-01-01T00:00:00Z";
  assert.deepEqual(changesBetween(a, b), []);
  b.meta.currency = "EUR";
  b.pageNotes = { "balance/net-worth": "check the house value" };
  b.importProfiles = { "date|description|amount": { date: 0 } };
  const by = Object.fromEntries(changesBetween(a, b).map((x) => [x.key, x]));
  assert.deepEqual([by.meta.label, by.meta.details], ["Plan name and currency", ["currency"]]);
  assert.deepEqual([by.pageNotes.details, by.pageNotes.pages], [["balance/net-worth"], true], "the view names the page");
  assert.deepEqual([by.importProfiles.label, by.importProfiles.details], ["How bank files are read", ["changed"]], "never the layout's key");
});

test("names for records with no name of their own: papers for a policy, a beneficiary row, a budget envelope, a will, a gift, a tax form, shares bought", () => {
  const p = base();
  p.insurance.policies = [{ id: "pol-t", name: "Term policy", kind: "term" }, { id: "pol-u", name: "", kind: "umbrella" }];
  const pol = p.insurance.policies[0];
  assert.equal(labelOf({ key: `policy:${pol.id}`, where: "file" }, p, "papers").text, `Papers for ${pol.name}`);
  assert.equal(labelOf({ key: "policy:pol-u", policyId: "pol-u" }, p, "estate.beneficiaries").text, "an umbrella policy", "no name: its kind");
  assert.equal(labelOf({ key: "policy:gone", where: "file" }, p, "papers").text, "Insurance policy papers");
  assert.equal(labelOf({ key: `policy:${pol.id}`, policyId: pol.id, primary: [] }, p, "estate.beneficiaries").text, pol.name, "never the key the app made up");
  assert.equal(labelOf({ key: "policy:gone", policyId: "gone" }, p, "estate.beneficiaries").text, "an item");
  assert.equal(labelOf({ id: "b1", category: "groceries", amount: 600 }, p, "budgets").text, "Envelope for Groceries");
  const ana = p.household.people[0];
  assert.equal(labelOf({ id: "d1", kind: "will", personId: ana.id, status: "done" }, p, "estate.documents").text, `Will (${ana.name})`);
  assert.equal(labelOf({ id: "d2", kind: "trust", personId: "", status: "none" }, p, "estate.documents").text, "Living trust");
  assert.equal(labelOf({ id: "g1", to: "Cy's 529", amount: 5000 }, p, "estate.gifts").text, "Gift to Cy's 529");
  assert.equal(labelOf({ id: "f1", form: "1099-K" }, p, "taxes.extraDocuments").text, "1099-K");
  assert.equal(labelOf({ id: "e1", purchaseDate: "2026-06-30", shares: 10 }, p, "equity.espp").text, "Shares bought 2026-06-30");
  assert.equal(labelOf(null, p).text, "an item");
});

test("a list inside a section with no plain name gets one comma, not a second colon; details use the section's own word", () => {
  const a = base(), b = structuredClone(a);
  b.retirement.annuities = [{ id: "an1", name: "Acme annuity" }];
  b.retirement.spareList = [{ id: "s1", name: "Thing" }];
  b.debts[0].rate = 0.07; b.debts[0].extra = 50;
  b.goals[0].rate = 0.03;
  const by = Object.fromEntries(changesBetween(a, b).map((x) => [x.key, x]));
  assert.equal(by["retirement.annuities"].label, "Annuities");
  assert.equal(by["retirement.spareList"].label, "Retirement, spare list");
  assert.deepEqual(by.debts.changed[0].fields, ["interest rate", "extra payment"]);
  assert.deepEqual(by.goals.changed[0].fields, ["growth per year"]);
  assert.equal(words("rate"), "rate"); assert.equal(words("rate", "debts"), "interest rate"); assert.equal(words("monthlyAtFRA"), "monthly benefit at full retirement age");
});

test("one save from its two plans: a damaged side makes it unreadable; the device comes from the newer side", () => {
  const p = base(), q = structuredClone(p);
  q.notes = "x"; q.meta.updatedBy = "Laptop";
  assert.deepEqual([entryFor({ when: "w", plan: p }, { plan: q }).count, entryFor({ when: "w", plan: p }, { plan: q }).by], [1, "Laptop"]);
  assert.equal(entryFor({ when: "w", plan: null }, { plan: q }).unreadable, true);
  assert.equal(entryFor({ when: "w", plan: p }, { plan: null }).unreadable, true);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-09-15";
const planWith = (people, extra = {}) => { const p = emptyPlan(); p.household.people = people; Object.assign(p.household, extra); return p; };

test("empty plan: no people, no warnings, no horizon", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.count, 0); assert.equal(d.horizonYears, null); assert.deepEqual(d.warnings, []); assert.equal(d.self, null);
});
test("ages, retirement and plan-end dates use the plan's defaults", () => {
  const d = compute(planWith([{ id: "a", name: "Ana", role: "self", birthDate: "1990-05-20" }]), { today: TODAY });
  const me = d.people[0];
  assert.equal(me.age, 36);
  assert.equal(me.retirementAge, 65);
  assert.equal(me.retirementDate, "2055-05-20");
  assert.equal(me.yearsToRetirement, 29);
  assert.equal(me.retired, false);
  assert.equal(me.planEndAge, 95);
  assert.equal(me.planEndDate, "2085-05-20");
  assert.equal(me.yearsLeft, 59);
  assert.equal(d.horizonYears, 59);
  assert.equal(d.self.id, "a");
});
test("a person's own retirement age and plan age win over the defaults", () => {
  const d = compute(planWith([{ id: "a", name: "Ana", role: "self", birthDate: "1990-05-20", retirementAge: 55, lifeExpectancy: 100 }]), { today: TODAY });
  assert.equal(d.people[0].retirementAge, 55);
  assert.equal(d.people[0].yearsToRetirement, 19);
  assert.equal(d.people[0].planEndAge, 100);
  assert.equal(d.horizonYears, 64);
});
test("dependents have no retirement; the horizon follows the adults", () => {
  const d = compute(planWith([
    { id: "a", name: "Ana", role: "self", birthDate: "1990-05-20" },
    { id: "b", name: "Bo", role: "partner", birthDate: "1985-01-01" },
    { id: "c", name: "Cy", role: "dependent", birthDate: "2020-03-03" },
  ], { filingStatus: "married_joint" }), { today: TODAY });
  assert.equal(d.adults, 2); assert.equal(d.dependents, 1);
  assert.equal(d.people[2].retirementAge, null);
  assert.equal(d.people[2].yearsToRetirement, null);
  assert.equal(d.people[2].age, 6);
  assert.equal(d.horizonYears, 59, "Ana (36 -> 95) is the longer horizon; Bo is 41 -> 95 = 54");
  assert.deepEqual(d.warnings, []);
  assert.equal(d.filingLabel, "Married, filing together");
});
test("warnings: nobody is Me, two adults filing single, future birth date, retirement past plan end", () => {
  let d = compute(planWith([{ id: "b", name: "Bo", role: "partner", birthDate: "1985-01-01" }]), { today: TODAY });
  assert.ok(d.warnings.some((w) => w.includes('"Me"')));
  d = compute(planWith([{ id: "a", name: "Ana", role: "self" }, { id: "b", name: "Bo", role: "partner" }]), { today: TODAY });
  assert.ok(d.warnings.some((w) => w.includes("Single")));
  d = compute(planWith([{ id: "a", name: "Ana", role: "self", birthDate: "2030-01-01" }]), { today: TODAY });
  assert.ok(d.warnings.some((w) => w.includes("future")));
  d = compute(planWith([{ id: "a", name: "Ana", role: "self", birthDate: "1990-01-01", retirementAge: 96 }]), { today: TODAY });
  assert.ok(d.warnings.some((w) => w.includes("past the plan")));
});
test("without today, ages are null and nothing crashes", () => {
  const d = compute(planWith([{ id: "a", name: "Ana", role: "self", birthDate: "1990-05-20" }]));
  assert.equal(d.people[0].age, null); assert.equal(d.people[0].yearsToRetirement, null); assert.equal(d.horizonYears, null);
});

// ---- removing a person: what is theirs goes with them, or stays as the household's (R4-7, 2026-11-02)
import { tiedTo, removePerson } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
const withBoExtras = () => {
  const p = familyPlan("2026-11-02");
  p.insurance.policies = [...(p.insurance.policies ?? []), { id: "pol-bo", name: "Term life on Bo", kind: "term", personId: "p-bo", benefit: 500000, premium: 35, period: "monthly" }];
  p.estate.beneficiaries = [{ key: "account:a-401", accountId: "a-401", primary: [{ name: "Bo", share: 1, personId: "p-bo" }], contingent: [] },
    { key: "account:a-roth", accountId: "a-roth", primary: [{ name: "Ana", share: 1, personId: "p-ana" }], contingent: [] }];
  p.debts = [...(p.debts ?? []), { id: "d-bocard", accountId: "a-bocard", rate: 0.2, minPayment: 50, extra: 0 }];
  p.accounts.push({ id: "a-bocard", name: "Bo's store card", type: "credit", balance: 900, asOf: "2026-11-02", ownerId: "p-bo", history: [] });
  p.goals[0].fundedBy = [...(p.goals[0].fundedBy ?? []), "a-roth"];
  p.whatIfs = { ...(p.whatIfs ?? {}), paycheck: { "p-bo": { paychecks: 12 }, "p-ana": { paychecks: 26 } } };
  return p;
};
test("tiedTo lists a partner's pay, accounts (owed ones as owed), Social Security and policy, and where they still name them", () => {
  const t = tiedTo(withBoExtras(), "p-bo");
  assert.deepEqual(t.items.map((i) => [i.kind, i.name]), [
    ["income", "Bo's salary"], ["income", "Weekend photography"],
    ["account", "Bo's Roth IRA"], ["account", "Bo's old 401(k)"], ["account", "Bo's store card"],
    ["socialSecurity", "Bo's Social Security"], ["policy", "Term life on Bo"],
  ]);
  assert.equal(t.items[0].amount, 5200); assert.equal(t.items[0].every, "a month");
  assert.equal(t.items.find((i) => i.id === "a-bocard").every, "owed");
  assert.equal(t.items.find((i) => i.id === "a-bocard").href, "#/balance/liabilities");
  assert.deepEqual(t.named.map((x) => x.name), ["Ana's 401(k)"]);   // the Roth goes with Bo, so its row is not listed
  assert.equal(t.leavesOneAdult, true); assert.equal(t.married, true); assert.equal(t.dependents, 1);
});
test("removing with everything: pay, accounts and their loan details, saving and goal links go; filing becomes Single", () => {
  const p = withBoExtras();
  const r = removePerson(p, "p-bo");
  assert.deepEqual(p.household.people.map((x) => x.id), ["p-ana", "p-cy"]);
  assert.deepEqual(p.income.map((x) => x.id), ["i-ana"]);
  assert.ok(!p.accounts.some((a) => ["a-roth", "a-bk401", "a-bocard"].includes(a.id)));
  assert.ok(!p.debts.some((d) => d.accountId === "a-bocard"));
  assert.ok(!p.retirement.contributions.some((c) => c.personId === "p-bo" || c.accountId === "a-roth"));
  assert.ok(!(p.goals[0].fundedBy ?? []).includes("a-roth"));
  assert.ok(!p.estate.beneficiaries.some((b) => b.accountId === "a-roth"));
  assert.equal(p.retirement.socialSecurity["p-bo"], undefined);
  assert.equal(p.whatIfs.paycheck["p-bo"], undefined); assert.ok(p.whatIfs.paycheck["p-ana"]);
  assert.ok(!p.insurance.policies.some((x) => x.id === "pol-bo"));
  assert.equal(p.household.filingStatus, "single"); assert.equal(r.filing, "single");
  assert.ok(r.removed.includes("Bo's salary") && r.removed.includes("Bo's Social Security"));
  assert.deepEqual(compute(p, { today: TODAY }).warnings, []);
});
test("removing but keeping: the same records stay, owned by the household; Social Security still goes", () => {
  const p = withBoExtras();
  const r = removePerson(p, "p-bo", { keep: true });
  assert.deepEqual(p.income.filter((x) => x.personId === "").map((x) => x.id), ["i-bo", "i-side"]);
  assert.equal(p.accounts.find((a) => a.id === "a-roth").ownerId, "");
  assert.ok(p.debts.some((d) => d.accountId === "a-bocard"));
  assert.equal(p.retirement.contributions.find((c) => c.accountId === "a-roth").personId, "");
  assert.equal(p.insurance.policies.find((x) => x.id === "pol-bo").personId, "");
  assert.equal(p.retirement.socialSecurity["p-bo"], undefined);
  assert.ok(r.kept.includes("Bo's Roth IRA")); assert.deepEqual(r.removed, ["Bo's Social Security"]);
});
test("a dependent with nothing tied, and a single filer, change nothing else", () => {
  const p = familyPlan("2026-11-02");
  const t = tiedTo(p, "p-cy");
  assert.deepEqual(t.items, []); assert.equal(t.leavesOneAdult, false);
  removePerson(p, "p-cy");
  assert.equal(p.household.people.length, 2); assert.equal(p.household.filingStatus, "married_joint");
  const q = familyPlan("2026-11-02"); q.household.filingStatus = "head_of_household";
  removePerson(q, "p-bo"); assert.equal(q.household.filingStatus, "head_of_household");
  assert.deepEqual(removePerson(familyPlan(), "nobody"), { removed: [], kept: [], filing: null });
});
test("one adult left on a married filing status is a warning with the Change it link", () => {
  const w = compute(planWith([{ id: "a", name: "Ana", role: "self" }], { filingStatus: "married_joint" }), { today: TODAY }).warnings;
  assert.equal(w.length, 1); assert.match(w[0], /One adult but the tax filing status is Married, filing together\. Change it/);
});

test("review 2026-11-02: their own papers and Social Security go either way; the funds in removed accounts go with them", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { tiedTo: tied, removePerson: remove } = await import("./compute.js");
  const p = familyPlan("2026-11-02");
  p.estate = { ...(p.estate ?? {}), documents: [{ id: "w1", kind: "will", personId: "p-bo", status: "done" }, { id: "w2", kind: "will", personId: "p-ana", status: "none" }] };
  const t = tied(p, "p-bo");
  assert.ok(t.items.find((i) => i.kind === "estateDoc").always); assert.ok(t.items.find((i) => i.kind === "socialSecurity").always);
  // keep as the household's: the will is not left with no owner (it was shown nowhere); Ana's will stays
  const k = structuredClone(p); const rk = remove(k, "p-bo", { keep: true });
  assert.deepEqual(k.estate.documents.map((x) => x.id), ["w2"]);
  assert.ok(rk.removed.includes("Will")); assert.ok(!rk.kept.includes("Will"));
  // remove with them: a holding and a bank line in Bo's Roth IRA go too
  const r = structuredClone(p);
  r.holdings = [{ id: "h1", accountId: "a-roth", symbol: "VTI", shares: 100, price: 310 }, { id: "h2", accountId: "a-401", symbol: "VXUS", shares: 10, price: 60 }];
  r.transactions = [{ id: "t1", accountId: "a-roth", date: "2026-10-01", amount: 100 }];
  remove(r, "p-bo", { keep: false });
  assert.deepEqual(r.holdings.map((h) => h.id), ["h2"]); assert.deepEqual(r.transactions, []);
});

test("the first adult left unnamed (\"Me\") and \"My spouse\": warnings and Social Security say you, your, your spouse", () => {
  const d = compute(planWith([
    { id: "p1", name: "Me", role: "self", birthDate: "2030-01-01" },
    { id: "p2", name: "My spouse", role: "partner", birthDate: "1990-01-01", retirementAge: 99, lifeExpectancy: 90 },
  ], { filingStatus: "married_joint" }), { today: TODAY });
  assert.ok(d.warnings.includes("You have a birth date in the future."), d.warnings.join(" | "));
  assert.ok(d.warnings.includes("Your spouse: the retirement age (99) is past the plan's end age (90)."), d.warnings.join(" | "));
  const r = compute(planWith([{ id: "p1", name: "Me", role: "self", birthDate: "1990-01-01", retirementAge: 99, lifeExpectancy: 90 }]), { today: TODAY });
  assert.ok(r.warnings.includes("Your retirement age (99) is past the plan's end age (90)."), r.warnings.join(" | "));
  // a name as typed reads as before
  assert.ok(compute(planWith([{ id: "p1", name: "Ana", role: "self", birthDate: "2030-01-01" }]), { today: TODAY }).warnings.includes("Ana has a birth date in the future."));
  // Social Security named at compute time: "Your Social Security", "Your spouse's Social Security"
  const p = withBoExtras(); p.household.people.find((x) => x.id === "p-bo").name = "Me";
  assert.ok(tiedTo(p, "p-bo").items.some((i) => i.kind === "socialSecurity" && i.name === "Your Social Security"));
  const q = withBoExtras(); q.household.people.find((x) => x.id === "p-bo").name = "My spouse";
  assert.deepEqual(removePerson(q, "p-bo", { keep: true }).removed, ["Your spouse's Social Security"]);
});

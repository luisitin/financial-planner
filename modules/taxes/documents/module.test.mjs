import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, expected, DUE } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";

test("an empty plan: only last year's return and the property tax bill", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.deepEqual(d.items.map((x) => x.key), ["property-tax", "last-return"]);
  assert.equal(d.received, 0); assert.equal(d.total, 2);
});

test("the family: a W-2 each, the business 1099, interest, the brokerage composite, the 1098 and the Roth's 5498", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  const keys = d.items.map((x) => x.key);
  for (const k of ["w2:p-ana", "w2:p-bo", "nec:i-side", "int:a-sav", "b:a-brk", "1098:a-mort", "5498:a-roth"]) assert.ok(keys.includes(k), k);
  assert.ok(!keys.some((k) => k.startsWith("int:a-chk")), "no 1099-INT for checking");
  assert.ok(!keys.some((k) => k.includes("401")), "the 401(k)s are on the W-2");
  assert.ok(!keys.includes("1098t"), "Cy is 6: no tuition form");
  assert.equal(d.items.find((x) => x.key === "b:a-brk").due, DUE.feb15);
  assert.equal(d.items.find((x) => x.key === "5498:a-roth").due, DUE.may31);
  assert.equal(new Set(keys).size, keys.length, "no form twice");
});

test("one person with a salary and a bonus gets one W-2", () => {
  const p = familyPlan(TODAY);
  p.income.push({ id: "i-bonus", type: "bonus", name: "Ana's bonus", personId: "p-ana", amount: 5000, period: "yearly" });
  assert.equal(expected(p, { today: TODAY }).filter((x) => x.form === "W-2").length, 2);
});

test("the tax year is last year until April 15, then this year", () => {
  const p = familyPlan(TODAY);
  assert.equal(compute(p, { today: "2027-02-01" }).year, 2026);
  assert.equal(compute(p, { today: "2027-04-15" }).year, 2026);
  assert.equal(compute(p, { today: "2027-04-16" }).year, 2027);
  assert.equal(compute(p, { today: "2027-02-01" }).deadline, "2027-04-15");
});

test("ticks count for their own year only", () => {
  const p = familyPlan(TODAY);
  p.taxes = { ...(p.taxes ?? {}), documents: { 2026: { "w2:p-ana": true, "b:a-brk": true }, 2025: { "w2:p-bo": true } } };
  const d = compute(p, { today: TODAY });
  assert.equal(d.received, 2);
  assert.ok(d.items.find((x) => x.key === "w2:p-ana").received);
  assert.ok(!d.items.find((x) => x.key === "w2:p-bo").received);
});

test("crypto, HSA, student loan, Social Security, pension, rent, marketplace cover and a college-age child each add their form", () => {
  const p = emptyPlan();
  p.household.people = [{ id: "p1", name: "Sam", role: "self", birthDate: "1960-01-01" }, { id: "p2", name: "Kit", role: "dependent", birthDate: "2008-05-01" }];
  p.accounts = [{ id: "c", type: "crypto", name: "Coins", balance: 900 }, { id: "h", type: "hsa", name: "HSA", balance: 3000 }, { id: "s", type: "student_loan", name: "Loans", balance: -12000 }, { id: "z", type: "savings", name: "Empty", balance: 0 }];
  p.income = [{ id: "ss", type: "social", name: "Social Security", personId: "p1", amount: 2000, period: "monthly" }, { id: "pn", type: "pension", name: "Pension", personId: "p1", amount: 900, period: "monthly" }, { id: "rt", type: "rental", name: "Flat", amount: 1200, period: "monthly" }];
  p.retirement = { ...(p.retirement ?? {}), aca: { members: 1 } };
  p.taxes = { ...(p.taxes ?? {}), itemized: { charitable: 600 } };
  const forms = Object.fromEntries(expected(p, { today: TODAY }).map((x) => [x.key, x.form]));
  assert.equal(forms["b:c"], "1099-DA");
  assert.equal(forms["5498sa:h"], "5498-SA"); assert.equal(forms["1099sa:h"], "1099-SA");
  assert.equal(forms["1098e:s"], "1098-E");
  assert.equal(forms["ssa:p1"], "SSA-1099"); assert.equal(forms["1099r:pn"], "1099-R");
  assert.ok(forms.rental); assert.equal(forms["1095a"], "1095-A"); assert.equal(forms["1098t"], "1098-T");
  assert.equal(forms.charity, "Gift receipts");
  assert.ok(!forms["int:z"], "an empty account sends nothing");
});

test("documents you add join the list and can be ticked", () => {
  const p = familyPlan(TODAY);
  p.taxes = { ...(p.taxes ?? {}), extraDocuments: [{ id: "dc", form: "Daycare receipts", from: "the daycare" }, { id: "bad" }], documents: { 2026: { "x:dc": true } } };
  const d = compute(p, { today: TODAY });
  const own = d.items.filter((x) => x.own);
  assert.equal(own.length, 1, "an entry with no name is skipped");
  assert.equal(own[0].form, "Daycare receipts"); assert.ok(own[0].received);
});

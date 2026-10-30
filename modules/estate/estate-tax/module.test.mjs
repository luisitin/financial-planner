import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, estateTax } from "./compute.js";
import { tentativeTax } from "../gifting/data/transfer-tax.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("the tax: 40% over the exemption once both are past $1M; gifts added back; nothing under it", () => {
  assert.equal(estateTax(10000000, 0, 15000000), 0);
  near(estateTax(20000000, 0, 15000000), 0.4 * 5000000);
  near(estateTax(20000000, 1000000, 15000000), 0.4 * 6000000);
  near(estateTax(500000, 0, 0), tentativeTax(500000));
});

test("an empty plan: one person, nothing owed", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.couple, false); assert.equal(d.single.tax, 0); assert.equal(d.exclusion, 15000000);
});

test("the family: each person's share, life insurance counted, the two deaths, the end of the plan", () => {
  const p = familyPlan(TODAY);
  p.insurance = { policies: [{ id: "t", name: "Term", kind: "term", personId: "p-ana", benefit: 500000 }, { id: "h", name: "Home", kind: "home", benefit: 400000 }] };
  const d = compute(p, { today: TODAY });
  assert.equal(d.couple, true); assert.equal(d.lifeCover, 500000); assert.equal(d.estateToday, 287100 + 500000);
  const [ana, bo] = d.people;
  near(ana.estate + bo.estate, d.estateToday); assert.equal(ana.lifeCover, 500000);
  // Ana owns her 401(k) (86,000); half of what has no owner is hers
  const joint = p.accounts.filter((a) => !a.ownerId).reduce((s, a) => s + (["mortgage", "credit", "loan"].includes(a.type) ? -a.balance : a.balance), 0);
  near(ana.estate, 86000 + joint / 2 + 500000);
  assert.equal(d.pair.firstDeath.tax, 0); assert.equal(d.pair.secondDeath.exemption, 30000000); assert.equal(d.pair.secondDeath.tax, 0);
  assert.ok(d.end.estate > 0 && d.end.tax === 0);
  assert.equal(d.headroom, 30000000 - d.estateToday);
  assert.deepEqual(d.warnings, []);
});

test("a large estate: portability saves the tax; the return at the first death is flagged; gifts use the exemption", () => {
  const p = familyPlan(TODAY); p.accounts.push({ id: "x", name: "Business", type: "other_asset", balance: 28000000, ownerId: "" });
  const d = compute(p, { today: TODAY });
  assert.equal(d.pair.secondDeath.tax, 0); near(d.pair.secondDeath.taxWithout, 0.4 * (d.estateToday - 15000000));
  assert.match(d.warnings[0], /Form 706/);
  p.estate.gifts = [{ id: "g", to: "Niece", from: "p-bo", amount: 1019000, year: 2026, kind: "cash" }];
  const g = compute(p, { today: TODAY });
  assert.equal(g.people[1].gifts, 1000000); assert.equal(g.people[1].exemptionLeft, 14000000);
  near(g.pair.secondDeath.exemption, 15000000 + 14000000);
});

test("charity left in the will comes off; a state with its own estate tax, a rough figure once its exemption and rate are entered", () => {
  const p = familyPlan(TODAY); p.household.people = p.household.people.filter((q) => q.id !== "p-bo");
  p.accounts.push({ id: "x", name: "Shares", type: "brokerage", balance: 16000000, ownerId: "" });
  p.estate.legacy = { bequests: [{ id: "c", to: "Food bank", kind: "charity", amount: 1000000 }] };
  p.household.state = "MA"; p.estate.stateTax = { exemption: 2000000, rate: 0.16 };
  const d = compute(p, { today: TODAY });
  near(d.single.taxable, d.estateToday - 1000000); near(d.single.tax, 0.4 * (d.single.taxable - 15000000));
  assert.equal(d.state.estateTax, true); near(d.state.tax, 0.16 * (d.estateToday - 1000000 - 2000000));
  p.household.state = "PA"; assert.equal(compute(p, { today: TODAY }).state.inheritanceTax, true);
});

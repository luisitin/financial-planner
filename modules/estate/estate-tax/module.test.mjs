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

test("gift tax already payable comes off (IRC 2001(b)(2)); a couple shows the costlier real order of death", async () => {
  const { estateTax, giftTaxOn } = await import("./compute.js");
  // $16,000,000 of lifetime gifts against $15,000,000: $400,000 of gift tax was payable on them; an estate of $5,000,000 more
  assert.equal(giftTaxOn(16000000, 15000000), 400000); assert.equal(giftTaxOn(14000000, 15000000), 0);
  near(estateTax(5000000, 16000000, 15000000, giftTaxOn(16000000, 15000000)), 2000000);   // 40% x 6,000,000 - 400,000
  near(estateTax(5000000, 16000000, 15000000), 2400000, 1e-6);                            // without the subtraction
  // one person on the page: lifetime gifts over the exemption
  const one = familyPlan(TODAY); one.household.people = one.household.people.filter((q) => q.role === "self");
  one.accounts.push({ id: "x", name: "Business", type: "other_asset", balance: 5000000, ownerId: "" });
  one.estate.gifts = [{ id: "g", to: "Niece", from: one.household.people[0].id, amount: 16019000, year: 2026, kind: "cash" }];
  const s = compute(one, { today: TODAY });
  near(s.single.giftTax, 400000); near(s.single.tax, 0.4 * (s.single.taxable + 16000000 - 15000000) - 400000);
  // a couple without portability: the survivor's own gifts count, so the order where the one who gave more survives costs more
  const p = familyPlan(TODAY); p.accounts.push({ id: "x", name: "Business", type: "other_asset", balance: 28000000, ownerId: "" });
  p.estate.gifts = [{ id: "g", to: "Niece", from: "p-bo", amount: 3019000, year: 2026, kind: "cash" }];
  const d = compute(p, { today: TODAY }), T = d.pair.secondDeath.taxable;
  near(d.pair.secondDeath.taxWithout, 0.4 * (T + 3000000 - 15000000));   // Bo survives: his $3,000,000 added back
  // with portability both orders give 40% x (T + 3,000,000 - 30,000,000 + ...) the same way; the page used to add Bo's gifts and carry Bo's smaller unused part
  near(d.pair.secondDeath.tax, Math.max(0, 0.4 * (T + 3000000 - 30000000)));
});

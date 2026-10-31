// The full checks for this page are in tests/tax-pages.test.mjs (fixture qa/fixtures/tax-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { taxPlan } from "../../../qa/fixtures/tax-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("federal: runs on the tax fixture and on an empty plan", () => {
  const d = compute(taxPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

test("federal: the 0.9% additional Medicare tax is worked on pay before pre-tax 401(k) saving", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan("2026-10-30");
  p.income.find((x) => x.id === "i-ana").amount = 7600;   // 197,600 + Bo's 62,400 = 260,000 of pay; 12,220 to Ana's 401(k)
  const d = compute(p, { today: "2026-10-30" });
  assert.equal(d.inputs.medicareWages, 260000);
  assert.equal(d.inputs.wages, 260000 - 12220);
  assert.ok(Math.abs(d.result.additionalMedicare - 0.009 * 10000) < 0.01);
  const typed = familyPlan("2026-10-30"); typed.taxes.thisYear.wages = 255000;
  assert.equal(compute(typed, { today: "2026-10-30" }).inputs.medicareWages, 255000, "typed wages are taken as they are");
});

test("federal: filing separately, Social Security is taxed from the first dollar unless the spouses lived apart all year (IRC 86(c))", () => {
  const p = emptyPlan();
  p.household.filingStatus = "married_separate";
  p.taxes.thisYear.socialSecurity = 30000; p.taxes.thisYear.otherOrdinary = 5000;
  const together = compute(p, { today: "2026-10-30" });
  assert.equal(together.result.income.taxableSocialSecurity, 0.85 * (5000 + 15000));   // 17,000
  assert.ok(together.notes.some((n) => /lived apart all year/.test(n)));
  p.taxes.livedApart = true;
  const apart = compute(p, { today: "2026-10-30" });
  assert.equal(apart.livedApart, true);
  assert.equal(apart.result.income.taxableSocialSecurity, 0);   // provisional 20,000 under the single base of 25,000
  p.household.filingStatus = "married_joint";
  assert.equal(compute(p, { today: "2026-10-30" }).livedApart, false);   // the tick counts only on a separate return
});

test("federal: a year past the tables takes SSA's published wage base (2027: $192,300), later years inflate", () => {
  const p = emptyPlan();
  p.taxes.year = 2027;
  assert.equal(compute(p, { today: "2026-10-30" }).params.ssWageBase, 192300);
  p.taxes.year = 2026;
  assert.equal(compute(p, { today: "2026-10-30" }).params.ssWageBase, 184500);
  p.taxes.year = 2029;
  assert.ok(compute(p, { today: "2026-10-30" }).params.ssWageBase > 184500);
});

// --- wages, Medicare wages and the adjustments against the year's limits (README "Pay and contributions") ----------
const person = (id, role, birthDate) => ({ id, name: id === "r" ? "Rosa" : id === "k" ? "Kai" : id === "a" ? "Ana" : "Ben", role, birthDate });
function earner({ people, pay, rows = [], hsa = {}, status = "single" }) {
  const p = emptyPlan();
  p.household.filingStatus = status;
  p.household.people = people;
  p.income = Object.entries(pay).map(([id, amount]) => ({ id: `pay-${id}`, name: "Pay", type: "salary", personId: id, amount, period: "annual", growth: 0 }));
  p.accounts = rows.map(([id, type, name, owner]) => ({ id, type, name, balance: 0, ownerId: owner }));
  p.retirement.contributions = rows.map(([id, , , owner, amount, match = 0]) => ({ id: `c-${id}`, accountId: id, personId: owner, amount, period: "annual", employerMatch: match }));
  p.taxes.hsa = { ...p.taxes.hsa, ...hsa };
  return p;
}

test("federal: the health FSA comes off wages and Medicare wages, up to the year's limit (IRC 125(i), 3121(a)(5)(G); key RULES.md 10.6)", () => {
  const jo = (fsa) => compute(earner({ people: [person("k", "self", "1981-02-02")], pay: { k: 80000 }, hsa: { fsa } }), { today: "2026-10-30" });
  const d = jo(3600);   // Jo elects 3,600: 3,400 is the 2026 limit, the 200 over stays in pay
  assert.equal(d.inputs.wages, 80000 - 3400); assert.equal(d.inputs.medicareWages, 80000 - 3400);
  assert.deepEqual([d.fsa.excluded, d.fsa.over, d.fsa.limit, d.fsa.offWages], [3400, 200, 3400, 3400]);
  assert.ok(d.notes.some((n) => /FSA election is over this year's limit of 3,400/.test(n)));
  assert.equal(jo(2000).inputs.wages, 78000);
  assert.equal(compute(earner({ people: [person("k", "self", "1981-02-02")], pay: { k: 80000 }, hsa: { fsa: 3600 } }), { today: "2025-10-30" }).fsa.excluded, 3300, "2025: Rev. Proc. 2024-40's 3,300");
});

test("federal: pre-tax 401(k) money comes off wages only up to the limit plus catch-up, Roth money first in the excess (IRC 402(g)(1)(A); RULES.md 10.1)", () => {
  // Rosa, 61 in 2026: limit 24,500 + 11,250; pre-tax 26,000 + Roth 10,000 = 36,000, 250 over, all of it Roth: nothing in pay
  const rosa = (pretax, roth) => compute(earner({ people: [person("r", "self", "1965-03-14")], pay: { r: 150000 }, rows: [["k", "401k", "401(k)", "r", pretax, 6000], ["rk", "roth", "Roth 401(k)", "r", roth]] }), { today: "2026-10-30" });
  const d = rosa(26000, 10000);
  assert.equal(d.k401.people[0].catchUp, 11250); assert.equal(d.k401.people[0].inIncome, 0); assert.equal(d.inputs.wages, 150000 - 26000);
  assert.equal(d.inputs.medicareWages, 150000, "401(k) money stays in Medicare wages (3121(v)(1)(A))");
  // all 36,000 pre-tax: the 250 over the 35,750 is pay this year
  const e = rosa(36000, 0);
  assert.equal(e.k401.people[0].inIncome, 250); assert.equal(e.inputs.wages, 150000 - 35750); assert.equal(e.pretax401k, 35750);
  assert.ok(e.notes.some((n) => /250 of pre-tax 401\(k\) money is over this year's limit/.test(n)));
  // at 45 there is no catch-up: 30,000 pre-tax leaves 5,500 in pay
  const young = compute(earner({ people: [person("k", "self", "1981-02-02")], pay: { k: 150000 }, rows: [["k1", "401k", "401(k)", "k", 30000]] }), { today: "2026-10-30" });
  assert.equal(young.inputs.wages, 150000 - 24500); assert.equal(young.k401.inIncome, 5500);
});

test("federal: the 401(k) catch-up is at most the pay left after the other deferrals (IRC 414(v)(2)(A)(ii))", () => {
  // Rosa paid 30,000 puts 30,000 pre-tax: the catch-up is 30,000 - 24,500 = 5,500, not 11,250, so all of it stays out of pay
  const p = earner({ people: [person("r", "self", "1965-03-14")], pay: { r: 30000 }, rows: [["k", "401k", "401(k)", "r", 30000]] });
  const d = compute(p, { today: "2026-10-30" });
  assert.equal(d.k401.people[0].catchUp, 5500); assert.equal(d.k401.people[0].excluded, 30000); assert.equal(d.inputs.wages, 0);
  // no pay at all: no catch-up, and the 401(k) money over the base limit is income
  p.income = [];
  const n = compute(p, { today: "2026-10-30" });
  assert.equal(n.k401.people[0].catchUp, 0); assert.equal(n.k401.people[0].inIncome, 30000 - 24500);
  // self-employed, a solo 401(k): compensation is the earned income (415(c)(3)(B), 401(c)(2)), so the business keeps
  // Rosa's whole 11,250 catch-up and nothing is taxed as an excess deferral
  p.income = [{ id: "biz", name: "Consulting", type: "business", personId: "r", amount: 90000, period: "annual", growth: 0 }];
  p.retirement.contributions[0].amount = 35750;
  const s = compute(p, { today: "2026-10-30" });
  assert.equal(s.k401.people[0].compensation, 90000); assert.equal(s.k401.people[0].pay, 0);
  assert.equal(s.k401.people[0].catchUp, 11250); assert.equal(s.k401.people[0].inIncome, 0);
  assert.ok(!s.notes.some((x) => /401\(k\) money is over/.test(x)));
  // a business that earns less than the deferrals caps it: 30,000 - 24,500 = 5,500
  p.income[0].amount = 30000;
  assert.equal(compute(p, { today: "2026-10-30" }).k401.people[0].catchUp, 5500);
});

test("federal: HSA money through pay is kept out of income and Medicare wages only up to the household's limit (IRC 106(d)(1), 223(b), 3121(a)(5)(G))", () => {
  // Kai (RULES.md 10.5): 210,000 of pay, 24,500 pre-tax 401(k), 4,400 of HSA through pay, self-only cover
  const kai = (hsa) => compute(earner({ people: [person("k", "self", "1981-02-02")], pay: { k: 210000 }, rows: [["k1", "401k", "401(k)", "k", 24500], ["h", "hsa", "HSA", "k", hsa]], hsa: { coverage: "self", contribution: hsa } }), { today: "2026-10-30" });
  const d = kai(4400);
  assert.equal(d.inputs.wages, 210000 - 24500); assert.equal(d.inputs.adjustments, 4400); assert.equal(d.result.agi, 181100);
  assert.equal(d.inputs.medicareWages, 205600); assert.ok(Math.abs(d.result.additionalMedicare - 0.009 * 5600) < 1e-9, "0.9% on 5,600 over 200,000");
  // 5,000 in: the 600 over the 4,400 limit is pay
  const o = kai(5000);
  assert.equal(o.inputs.adjustments, 4400); assert.equal(o.inputs.medicareWages, 210000 - 4400); assert.equal(o.hsa.excess, 600);
  assert.ok(o.sources.some((s) => s.key === "hsa" && s.amount === -4400 && /600 over the limit/.test(s.detail)));
  assert.ok(o.notes.some((n) => /600 of HSA money is over the limit/.test(n)));
});

test("federal: without high-deductible cover HSA money is pay, the employer's too; a spouse outside self-only cover the same (IRC 223(c)(1), Pub. 969)", () => {
  const couple = (coverage) => earner({ status: "married_joint", people: [person("a", "self", "1970-05-01"), person("b", "partner", "1974-05-01")], pay: { a: 100000, b: 60000 },
    rows: [["ha", "hsa", "HSA", "a", 3000, 1000], ["hb", "hsa", "HSA", "b", 2000, 500]], hsa: { coverage, contribution: 5000, employer: 1500 } });
  const fam = compute(couple("family"), { today: "2026-10-30" });
  assert.equal(fam.inputs.adjustments, 5000); assert.equal(fam.inputs.wages, 160000); assert.equal(fam.inputs.medicareWages, 155000);
  const none = compute(couple("none"), { today: "2026-10-30" });
  assert.equal(none.inputs.adjustments, 0); assert.equal(none.inputs.wages, 160000 + 1500, "the employer's 1,500 is pay too"); assert.equal(none.inputs.medicareWages, 161500);
  assert.equal(none.hsa.employerTaxed, 1500); assert.ok(none.notes.some((n) => /no high-deductible health plan/.test(n)));
  // self-only cover is Ana's (56: 4,400 + 1,000): Ben's 2,500 is over, of which 2,000 his pay and 500 his employer's
  const self = compute(couple("self"), { today: "2026-10-30" });
  assert.equal(self.hsa.excess, 2500); assert.equal(self.inputs.adjustments, 5000 - 2500); assert.equal(self.inputs.wages, 160000);
  assert.equal(self.result.agi, 160000 - 3000 + 500, "pay less Ana's 3,000; Ben's 2,000 is not deducted and his employer's 500 is pay");
});

test("federal: the traditional IRA deduction stops at each person's IRA limit plus catch-up (IRC 219(b)(1), (b)(5))", () => {
  const p = earner({ status: "married_joint", people: [person("a", "self", "1970-05-01"), person("b", "partner", "1984-05-01")], pay: { a: 90000, b: 40000 },
    rows: [["ia", "ira", "IRA", "a", 9000], ["ib", "ira", "IRA", "b", 7000]] });
  const d = compute(p, { today: "2026-10-30" });
  // Ana, 56: 7,500 + 1,100 = 8,600 of her 9,000; Ben, 42: all 7,000
  assert.deepEqual(d.ira.people.map((x) => x.deductible), [8600, 7000]); assert.equal(d.inputs.adjustments, 15600); assert.equal(d.ira.over, 400);
  assert.ok(d.sources.some((s) => s.key === "ira" && s.amount === -15600 && /400 over the IRA limit/.test(s.detail)));
});

test("federal: typed wages are the person's own W-2 box 1: nothing comes off them", () => {
  const p = earner({ people: [person("k", "self", "1981-02-02")], pay: { k: 80000 }, rows: [["k1", "401k", "401(k)", "k", 30000]], hsa: { fsa: 3000 } });
  p.taxes.thisYear.wages = 50000;
  const d = compute(p, { today: "2026-10-30" });
  assert.equal(d.inputs.wages, 50000); assert.equal(d.inputs.medicareWages, 50000); assert.equal(d.fsa.offWages, 0);
  assert.ok(!d.notes.some((n) => /401\(k\) money is over|FSA election is over/.test(n)));
});

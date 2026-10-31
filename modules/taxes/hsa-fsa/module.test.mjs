// The full checks for this page are in tests/tax-pages.test.mjs (fixture qa/fixtures/tax-plan.mjs) and
// tests/golden-limits.test.mjs (the answer key, tests/golden/limits/RULES.md). Here: one test per formula, with the
// invented people of RULES.md section 10.
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, payrollTaxSaved, withoutHsaPayroll } from "./compute.js";
import { taxPlan } from "../../../qa/fixtures/tax-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const near = (a, b, tol = 0.011) => assert.ok(Math.abs(a - b) <= tol, `${a} is not ${b}`);

/** One plan: adults with pay, pre-tax 401(k), traditional IRA and HSA money (each as a Contributions row on their own account). */
function planOf({ status = "single", cover, coveredId, fsa = 0, people }) {
  const p = emptyPlan();
  p.household.filingStatus = status;
  p.household.people = people.map((x, i) => ({ id: x.id, name: x.name, role: i ? "partner" : "self", birthDate: x.birth }));
  p.income = people.filter((x) => x.pay).map((x) => ({ id: `pay-${x.id}`, name: "Pay", type: "salary", personId: x.id, amount: x.pay, period: "annual", growth: 0, taxable: true }));
  p.accounts = []; p.retirement.contributions = [];
  for (const x of people) for (const [key, type] of [["k401", "401k"], ["ira", "ira"], ["hsa", "hsa"]]) {
    const amount = x[key] ?? 0, match = key === "hsa" ? x.hsaEmployer ?? 0 : 0;
    if (!(amount > 0 || match > 0)) continue;
    p.accounts.push({ id: `${key}-${x.id}`, name: key, type, balance: 0, ownerId: x.id });
    p.retirement.contributions.push({ id: `c-${key}-${x.id}`, accountId: `${key}-${x.id}`, personId: x.id, amount, period: "annual", employerMatch: match });
  }
  const sum = (k) => people.reduce((s, x) => s + (x[k] ?? 0), 0);
  p.taxes.hsa = { coverage: cover, contribution: sum("hsa"), employer: sum("hsaEmployer"), fsa, fsaSpent: 0 };
  if (coveredId) p.taxes.hsa.coveredId = coveredId;
  return p;
}
const kai = (pay, extra = {}) => planOf({ cover: "self", ...extra, people: [{ id: "kai", name: "Kai", birth: "1981-06-01", pay, k401: 24500, hsa: 4400, ...(extra.kai ?? {}) }] });

test("hsa-fsa: runs on the tax fixture and on an empty plan", () => {
  const d = compute(taxPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

test("payroll tax saved: 6.2% only below the Social Security pay limit, 1.45% on all (3101(a), (b)(1); 3121(a)(1))", () => {
  const below = payrollTaxSaved(95000, 90000, 184500);
  near(below.socialSecurity, 310); near(below.medicare, 72.5); near(below.total, 382.5);
  // RULES.md 10.5: Kai at 210,000 stays above the base: Medicare only; at 186,000 the money straddles it
  const above = payrollTaxSaved(210000, 205600, 184500);
  near(above.socialSecurity, 0); near(above.medicare, 63.8);
  const across = payrollTaxSaved(186000, 181600, 184500);
  near(across.socialSecurity, 179.8); near(across.total, 243.6);
  near(payrollTaxSaved(-500, -900, 184500).total, 0);   // wages from 0 up
});

test("tax saved, Kai above the wage base (RULES.md 10.5): income tax 1,056 + additional Medicare 39.60; payroll tax 63.80, not 336.60", () => {
  const d = compute(kai(210000), { today: "2026-06-01" });
  near(d.wageBase, 184500, 0);
  near(d.hsa.taxSaved, 1056 + 39.6, 0.02);   // the Medicare wages fall by the money too, so the 0.9% tax is in the saving
  near(d.hsa.ficaSaved, 63.8); near(d.hsa.socialSecuritySaved, 0);
  assert.deepEqual(d.hsa.aboveWageBase, ["Kai"]);
  const e = compute(kai(186000), { today: "2026-06-01" });
  near(e.hsa.taxSaved, 1056, 0.02); near(e.hsa.ficaSaved, 243.6);
  const f = compute(kai(95000, { kai: { k401: 0 } }), { today: "2026-06-01" });
  near(f.hsa.ficaSaved, 336.6); assert.deepEqual(f.hsa.aboveWageBase, []);
});

test("only money within the limit saves tax (106(d)(1); Pub. 15-B 'Up to specified dollar limits')", () => {
  // 5,000 through pay against a 4,400 self-only limit: 600 over, taxed as pay
  const d = compute(kai(95000, { kai: { k401: 0, hsa: 5000 } }), { today: "2026-06-01" });
  near(d.hsa.limit, 4400, 0); near(d.hsa.over, 600, 0); near(d.hsa.excess, 600, 0); near(d.hsa.deducted, 4400, 0);
  near(d.hsa.taxSaved, 0.22 * 4400, 0.02); near(d.hsa.ficaSaved, 0.0765 * 4400);
  assert.ok(d.notes.some((n) => /over the 2026 limit by 600/.test(n)));
  // the 600 has to come out, so only 4,400 a year grows to 65
  near(d.hsa.kept, 4400, 0); near(d.hsa.futureContributions, 4400 * d.hsa.years, 0);
  near(d.hsa.futureValue, 4400 * (Math.pow(1 + d.hsa.growthRate, d.hsa.years) - 1) / d.hsa.growthRate);
});

test("no high-deductible plan: the limit is 0, nothing saves tax, and the page warns (223(b)(1), (c)(1))", () => {
  const d = compute(kai(95000, { cover: "none", kai: { k401: 0, hsa: 3000 } }), { today: "2026-06-01" });
  assert.equal(d.hsa.coverage, "none");
  near(d.hsa.limit, 0, 0); near(d.hsa.catchUp, 0, 0); near(d.hsa.room, 0, 0); near(d.hsa.over, 3000, 0); near(d.hsa.excess, 3000, 0);
  near(d.hsa.taxSaved, 0, 0.02); near(d.hsa.ficaSaved, 0); near(d.hsa.kept, 0, 0); near(d.hsa.futureValue, 0, 0);
  assert.ok(d.notes.some((n) => /no high-deductible health plan/.test(n)));
  // nothing going in: no warning, the limit is still 0
  const e = compute(kai(95000, { cover: "none", kai: { k401: 0, hsa: 0 } }), { today: "2026-06-01" });
  near(e.hsa.limit, 0, 0); assert.equal(e.notes.length, 0);
  // left out, the cover reads as self-only, the old default
  const p = kai(95000); delete p.taxes.hsa.coverage;
  near(compute(p, { today: "2026-06-01" }).hsa.limit, 4400, 0);
});

test("self-only cover: only the covered adult's catch-up, and a spouse outside the plan saves nothing (223(b)(3); Pub. 969)", () => {
  const people = [{ id: "ana", name: "Ana", birth: "1986-02-01", pay: 90000, hsa: 2000 }, { id: "ben", name: "Ben", birth: "1968-02-01", pay: 60000 }];
  const d = compute(planOf({ status: "married_joint", cover: "self", people }), { today: "2026-06-01" });
  near(d.hsa.catchUp, 0, 0); near(d.hsa.limit, 4400, 0);   // Ben is 58 but not on Ana's plan
  assert.equal(d.hsa.coveredId, "ana");
  // the plan covers Ben instead: his catch-up counts, and Ana's 2,000 is not allowed
  const e = compute(planOf({ status: "married_joint", cover: "self", coveredId: "ben", people }), { today: "2026-06-01" });
  near(e.hsa.catchUp, 1000, 0); near(e.hsa.limit, 5400, 0); near(e.hsa.excess, 2000, 0);
  near(e.hsa.ficaSaved, 0); near(e.hsa.taxSaved, 0, 0.02);
  assert.ok(e.notes.some((n) => /Ana is not on the self-only health plan/.test(n)));
});

test("family cover, married: the 2026 family limit plus each catch-up from 55 (RULES.md 10.4)", () => {
  const people = [{ id: "ana", name: "Ana", birth: "1970-02-01", pay: 90000, hsa: 3000, hsaEmployer: 1000 }, { id: "ben", name: "Ben", birth: "1974-02-01", pay: 80000, hsa: 5000, hsaEmployer: 500 }];
  const d = compute(planOf({ status: "married_joint", cover: "family", people }), { today: "2026-06-01" });
  near(d.hsa.limit, 9750, 0); near(d.hsa.total, 9500, 0); near(d.hsa.room, 250, 0); near(d.hsa.over, 0, 0);
  near(d.hsa.ficaSaved, 0.0765 * 8000);
});

test("2027: the HSA limits of Rev. Proc. 2026-24 (4,500 / 9,000), the FSA still 2026's", () => {
  const d = compute(kai(95000, { kai: { k401: 0 } }), { today: "2027-03-01" });
  assert.equal(d.limitsYear, 2027); assert.equal(d.fsaYear, 2026);
  near(d.hsa.limit, 4500, 0); near(d.hsa.room, 100, 0);
  const e = compute(kai(95000, { cover: "family", kai: { k401: 0 } }), { today: "2027-03-01" });
  near(e.hsa.limit, 9000, 0);
});

test("the health FSA is out of wages and payroll-tax wages, so the HSA saving is worked on what is left (125; 3121(a)(5)(G))", () => {
  // single 2026, pay 70,000, FSA 3,400, HSA 4,400: taxable without the HSA 50,500, with it 46,100 -> 100 at 22% + 4,300 at 12%
  const d = compute(kai(70000, { fsa: 3400, kai: { k401: 0 } }), { today: "2026-06-01" });
  near(d.hsa.taxSaved, 100 * 0.22 + 4300 * 0.12, 0.02);
  // pay 186,000 with the FSA: payroll-tax wages 182,600 without, 178,200 with, all under the 184,500 base
  const e = compute(kai(186000, { fsa: 3400, kai: { k401: 0 } }), { today: "2026-06-01" });
  near(e.hsa.socialSecuritySaved, 0.062 * 4400); near(e.hsa.ficaSaved, 0.0765 * 4400);
});

test("pre-tax 401(k) money over the limit is income, so the saving is at the higher rate (402(g)(1)(A))", () => {
  // pay 148,300, pre-tax 30,000 (5,500 over): wages 123,800, taxable without the HSA 107,700 -> 2,000 at 24% + 2,400 at 22%
  const d = compute(kai(148300, { kai: { k401: 30000 } }), { today: "2026-06-01" });
  near(d.hsa.taxSaved, 2000 * 0.24 + 2400 * 0.22, 0.02);
});

test("traditional IRA money over its limit is not deducted, so the saving is at the higher rate (219(b)(1))", () => {
  // pay 75,000, traditional IRA 10,000 (7,500 deducted): taxable without the HSA 51,400 -> 1,000 at 22% + 3,400 at 12%
  const d = compute(kai(75000, { kai: { k401: 0, ira: 10000 } }), { today: "2026-06-01" });
  near(d.hsa.taxSaved, 1000 * 0.22 + 3400 * 0.12, 0.02);
});

test("no pay on the Income page: the money within the limit saves the full 7.65%", () => {
  const p = emptyPlan(); p.taxes.hsa = { coverage: "self", contribution: 3000, employer: 0, fsa: 0, fsaSpent: 0 };
  near(compute(p, { today: "2026-06-01" }).hsa.ficaSaved, 229.5);
});

test("the return without the HSA money: own money from pay set to 0, the employer's kept, the plan untouched", () => {
  const p = kai(95000, { kai: { hsaEmployer: 500 } });
  const q = withoutHsaPayroll(p);
  assert.equal(q.taxes.hsa.contribution, 0); assert.equal(q.taxes.hsa.employer, 500);
  const row = q.retirement.contributions.find((c) => c.accountId === "hsa-kai");
  assert.equal(row.amount, 0); assert.equal(row.employerMatch, 500);
  assert.equal(p.taxes.hsa.contribution, 4400); assert.equal(p.retirement.contributions.find((c) => c.accountId === "hsa-kai").amount, 4400);
  assert.equal(q.retirement.contributions.find((c) => c.accountId === "k401-kai").amount, 24500);
});

// Round 8 follow-up check (D1-D8, N1, N2): Part A backdating, a married split in the year one spouse starts Medicare,
// the covered adult on the Health page, typed wages and typed Social Security, FSA with no pay, words, and the other
// pages that read the HSA. Invented households only.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { emptyPlan } from "../core/schema/migrate.js";
import { compute } from "../modules/taxes/hsa-fsa/compute.js";
import { compute as health } from "../modules/insurance/health/compute.js";
import { hsaPictureMedicare, adultMedicare } from "../modules/taxes/federal/hsa-medicare.js";
import { medicareFrom } from "../core/math/medicare.js";
import { pageText } from "../qa/fixtures/fake-dom.mjs";
import { widowPlan } from "../qa/fixtures/widow-plan.mjs";

const T = "2026-11-06";
const near = (a, b, tol = 0.011) => assert.ok(Math.abs(a - b) <= tol, `${a} is not ${b}`);
const HP = { tier: "self", expected: 5000, plans: [{ id: "x", name: "HDHP", premium: 300, deductible: 3000, oopMax: 6000, coinsurance: 0.2, hsa: true, employerHsa: 0 }] };

function one({ birth, pay = 80000, ss = null, pension = 0, hsa = 4400, fsa = 0 }) {
  const p = emptyPlan();
  p.household.filingStatus = "single";
  p.household.people = [{ id: "a", name: "Ada", role: "self", birthDate: birth }];
  p.income = [];
  if (pay) p.income.push({ id: "pay", name: "Pay", type: "salary", personId: "a", amount: pay, period: "annual", growth: 0, taxable: true });
  if (pension) p.income.push({ id: "pen", name: "Pension", type: "pension", personId: "a", amount: pension, period: "annual", growth: 0, taxable: true });
  if (ss !== null) p.income.push({ id: "ss", name: "Social Security", type: "social", personId: "a", amount: 24000, period: "annual", growth: 0, startDate: ss, taxable: true });
  p.accounts = [{ id: "h", name: "HSA", type: "hsa", balance: 3000, ownerId: "a" }];
  p.retirement.contributions = [];
  p.taxes.hsa = { coverage: "self", contribution: hsa, employer: 0, fsa, fsaSpent: 0 };
  return p;
}

test("D1 Part A goes back six months from when Social Security starts, and never before the month of the 65th birthday", () => {
  const lim = (p) => compute(p, { today: T }).hsa.limit;
  // 65 in March, Social Security from October: Part A from April, 3 months of the year to go
  near(lim(one({ birth: "1961-03-20", ss: "2026-10-01" })), 5400 * 3 / 12);
  // 66, Social Security from March 2027: Part A from September 2026, 8 months to go
  near(lim(one({ birth: "1960-02-20", ss: "2027-03-01" })), 5400 * 8 / 12);
  // 68, Social Security from December: Part A from June
  near(lim(one({ birth: "1958-02-20", ss: "2026-12-01" })), 5400 * 5 / 12);
  // Social Security from July next year goes back to January next year: nothing this year
  near(lim(one({ birth: "1958-02-20", ss: "2027-07-01" })), 5400);
  // from June next year goes back to December this year: one month
  near(lim(one({ birth: "1958-02-20", ss: "2027-06-01" })), 5400 * 11 / 12);
  // the core rule on its own
  assert.deepEqual(medicareFrom(2026, { birthDate: "1961-03-20", socialSecurityStart: "2026-10-01" }), { firstMonth: 4, months: 9 });
  assert.deepEqual(medicareFrom(2026, { birthDate: "1961-03-20", socialSecurityStart: "2026-01-01" }), { firstMonth: 3, months: 10 });
  const d = compute(one({ birth: "1961-03-20", ss: "2026-10-01" }), { today: T });
  assert.ok(d.notes.some((n) => /on Medicare from April/.test(n) && /goes back six months/.test(n)), d.notes.join("|"));
});

// married, family cover: Mo turns 65 in July 2026 and gets Social Security (Part A from July, 6 months eligible), Eve is 56 with pay
function fam({ mHsa, eHsa, mBirth = "1961-07-15" }) {
  const p = emptyPlan();
  p.household.filingStatus = "married_joint";
  p.household.people = [{ id: "e", name: "Eve", role: "self", birthDate: "1970-04-10" }, { id: "m", name: "Mo", role: "partner", birthDate: mBirth }];
  p.income = [{ id: "pay", name: "Pay", type: "salary", personId: "e", amount: 90000, period: "annual", growth: 0, taxable: true }, { id: "ss", name: "Social Security", type: "social", personId: "m", amount: 20000, period: "annual", growth: 0, startDate: "", taxable: true }];
  p.accounts = [{ id: "he", name: "HSA Eve", type: "hsa", balance: 0, ownerId: "e" }, { id: "hm", name: "HSA Mo", type: "hsa", balance: 0, ownerId: "m" }];
  p.retirement.contributions = [{ id: "ce", accountId: "he", personId: "e", period: "annual", amount: eHsa, employerMatch: 0 }, { id: "cm", accountId: "hm", personId: "m", period: "annual", amount: mHsa, employerMatch: 0 }];
  p.taxes.hsa = { coverage: "family", contribution: 0, employer: 0, fsa: 0, fsaSpent: 0 };
  return p;
}

test("D2 a married family split in the year one spouse starts Medicare: even halves of the family limit are legal", () => {
  const p = fam({ mHsa: 4375, eHsa: 4375 });
  const pic = hsaPictureMedicare(p, 2026);
  const mo = pic.people.find((x) => x.id === "m"), eve = pic.people.find((x) => x.id === "e");
  assert.equal(mo.medicareMonths, 6);
  near(mo.excess, 0); near(eve.excess, 0);
  near(pic.household.excess, 0); near(pic.household.over, 0);
  near(mo.limit, 500 + Math.min(4375, 8750 - 3375));
  near(eve.limit, 1000 + (8750 - 3875));
  const d = compute(p, { today: T, iraAsAssumed: false });
  assert.ok(!d.notes.some((n) => /going into|over the|In all/.test(n)), d.notes.join("|"));
  assert.ok(d.hsa.deducted > 8000);
});

test("D2 a split past what the family limit allows puts the excess on the spouse whose money it is", () => {
  const p = fam({ mHsa: 4875, eHsa: 5875 });
  const pic = hsaPictureMedicare(p, 2026);
  const mo = pic.people.find((x) => x.id === "m"), eve = pic.people.find((x) => x.id === "e");
  near(mo.excess, 0); near(eve.excess, 500); near(pic.household.excess, 500);
  const d = compute(p, { today: T, iraAsAssumed: false });
  assert.ok(!d.notes.some((n) => /going into Mo/.test(n)), d.notes.join("|"));
  assert.ok(d.notes.some((n) => /over the 2026 limit by 500/.test(n)), d.notes.join("|"));
});

test("D2 a spouse on Medicare all year takes no part: the other keeps the whole family limit and own catch-up", () => {
  const pic = hsaPictureMedicare(fam({ mHsa: 1000, eHsa: 9750, mBirth: "1955-07-15" }), 2026);
  const mo = pic.people.find((x) => x.id === "m"), eve = pic.people.find((x) => x.id === "e");
  near(eve.limit, 9750); near(eve.excess, 0); near(mo.limit, 0); near(mo.excess, 1000);
});

test("D3 Health page, self-only: Medicare is read for the adult the plan covers, not the one marked Me", () => {
  const mk = (meIsMo) => {
    const p = emptyPlan(); p.household.filingStatus = "married_joint";
    const mo = { id: "m", name: "Mo", role: meIsMo ? "self" : "partner", birthDate: "1952-01-10" }, eve = { id: "e", name: "Eve", role: meIsMo ? "partner" : "self", birthDate: "1970-04-10" };
    p.household.people = meIsMo ? [mo, eve] : [eve, mo];
    p.income = [{ id: "pay", name: "Pay", type: "salary", personId: "e", amount: 90000, period: "annual", growth: 0, taxable: true }, { id: "ss", name: "SS", type: "social", personId: "m", amount: 20000, period: "annual", growth: 0, startDate: "", taxable: true }];
    p.accounts = [{ id: "he", name: "HSA", type: "hsa", balance: 0, ownerId: "e" }];
    p.retirement.contributions = [{ id: "ce", accountId: "he", personId: "e", period: "annual", amount: 4400, employerMatch: 0 }];
    p.taxes.hsa = { coverage: "self", coveredId: "e", contribution: 0, employer: 0, fsa: 0, fsaSpent: 0 };
    p.insurance.health = HP;
    return p;
  };
  for (const meIsMo of [true, false]) { const h = health(mk(meIsMo), { today: T }); assert.equal(h.medicareMonths, 0); assert.equal(h.hsaLimit, 5400); assert.equal(h.warnings.length, 0); }   // Eve is 56: 4,400 + 1,000 catch-up, as on the HSA page (money review M7)
  // and the other way: the covered partner is on Medicare, Me is not
  const q = mk(false); q.taxes.hsa.coveredId = "m";
  const h = health(q, { today: T }); assert.equal(h.medicareMonths, 12); assert.equal(h.hsaLimit, 0);
});

test("D4 Health page keeps the payroll part when wages are typed on the Federal estimate", () => {
  const p = emptyPlan(); p.household.filingStatus = "single"; p.household.people = [{ id: "a", name: "Ada", role: "self", birthDate: "1980-05-05" }];
  p.income = [{ id: "int", name: "Interest", type: "interest", personId: "a", amount: 500, period: "annual", growth: 0, taxable: true }];
  p.taxes.thisYear = { ...(p.taxes.thisYear ?? {}), wages: 60000 }; p.taxes.hsa = { coverage: "self", contribution: 3000, employer: 0, fsa: 0, fsaSpent: 0 };
  p.insurance.health = HP;
  const h = health(p, { today: T });
  near(h.taxRate - h.marginal, 0.0765, 0.0005);
});

test("D5 Social Security typed on the Federal estimate counts as received", () => {
  const p = one({ birth: "1952-03-15", pay: 0, pension: 22800 });
  p.taxes.thisYear = { ...(p.taxes.thisYear ?? {}), socialSecurity: 27600 };
  const d = compute(p, { today: T });
  assert.equal(d.hsa.limit, 0); near(d.hsa.over, 4400); near(d.hsa.taxSaved, 0);
  // a 74-year-old with no Social Security anywhere is not inferred to be on Medicare
  assert.equal(compute(one({ birth: "1952-03-15", pay: 0, pension: 22800 }), { today: T }).hsa.limit, 5400);
  // a couple: only the 65+ one when the other is under 62; otherwise nothing is inferred and the page asks whose it is
  const c = fam({ mHsa: 0, eHsa: 4400, mBirth: "1952-01-10" }); c.income = c.income.filter((x) => x.type !== "social");
  c.taxes.thisYear = { ...(c.taxes.thisYear ?? {}), socialSecurity: 20000 };
  assert.equal(adultMedicare(c, c.household.people.find((x) => x.id === "m"), 2026).months, 12);
  assert.equal(adultMedicare(c, c.household.people.find((x) => x.id === "e"), 2026).months, 0);
  const both = fam({ mHsa: 0, eHsa: 4400, mBirth: "1952-01-10" }); both.income = both.income.filter((x) => x.type !== "social"); both.household.people[0].birthDate = "1956-01-10";
  both.taxes.thisYear = { ...(both.taxes.thisYear ?? {}), socialSecurity: 20000 };
  assert.equal(adultMedicare(both, both.household.people[1], 2026).months, 0);
  assert.ok(compute(both, { today: T }).notes.some((n) => /You typed Social Security/.test(n) && /whose it is/.test(n)));
});

test("D6 a health FSA saves no payroll tax for a person with no pay", () => {
  const d = compute(one({ birth: "1976-05-05", pay: 0, pension: 40000, hsa: 0, fsa: 2000 }), { today: T });
  assert.equal(d.fsa.payrollTaxSaved, 0); assert.equal(d.fsa.taxSaved, 0);
  assert.ok(d.notes.some((n) => /FSA comes out of pay through an employer/.test(n)), d.notes.join("|"));
  // with pay it still saves 7.65%
  const w = compute(one({ birth: "1976-05-05", pay: 60000, hsa: 0, fsa: 2000 }), { today: T });
  near(w.fsa.payrollTaxSaved, 2000 * 0.0765);
});

test("D7 no-pay wording: money that did not come from pay is not 'taxed as wages'", () => {
  const d = compute(one({ birth: "1952-03-15", pay: 0, pension: 22800, ss: "" }), { today: T });
  const note = d.notes.find((n) => /too much/.test(n));
  assert.ok(note && !/taxed as wages/.test(note) && /no tax break and is charged 6% a year/.test(note), note);
  const src = readFileSync(new URL("../modules/taxes/federal/compute.js", import.meta.url), "utf8");
  assert.match(src, /over the limit for your coverage or for Medicare/);
});

test("D8 on Medicare with nothing going in, the page does not invite contributions", async () => {
  const w = widowPlan(); w.accounts.push({ id: "h", name: "HSA", type: "hsa", balance: 3000, asOf: T, ownerId: "p-ruth" }); w.taxes.hsa = { coverage: "self", contribution: 0, employer: 0, fsa: 0, fsaSpent: 0 };
  const text = (await pageText(new URL("../modules/taxes/hsa-fsa/view.js", import.meta.url), w, T)).replace(/\s+/g, " ");
  assert.match(text, /Once you're on Medicare you can't add to an HSA/);
  assert.ok(!/Type what goes in below/.test(text) && !/7\.65%/.test(text), text.slice(0, 600));
});

test("N1 the equity card shows '(0.9% included)' only when the extra 0.9% is owed", () => {
  const src = readFileSync(new URL("../modules/career/equity/view.js", import.meta.url), "utf8");
  assert.match(src, /t\.extraMedicare >= 1 \? " \(0\.9% included\)" : ""/);
});

test("N2 Health page works Medicare months for the return's year", () => {
  const src = readFileSync(new URL("../modules/insurance/health/compute.js", import.meta.url), "utf8");
  assert.match(src, /adultMedicare\(plan, [a-z]+, b\.year\)/);
});

test("Other pages: Tax report works the HSA as the HSA and FSA page does; Limits uses the Medicare-aware picture", async () => {
  const { compute: limits } = await import("../modules/investments/limits/compute.js");
  const w = widowPlan(); w.accounts.push({ id: "h", name: "HSA", type: "hsa", balance: 3000, ownerId: "p-ruth" });
  w.taxes.hsa = { coverage: "self", contribution: 4400, employer: 0, fsa: 0, fsaSpent: 0 };
  const l = limits(w, { today: T });
  const row = JSON.stringify(l).match(/"kind":"hsa"[^}]*/);
  assert.ok(row && !/"limit":5400/.test(row[0]), row?.[0]);
  const src = readFileSync(new URL("../modules/reports/tax/compute.js", import.meta.url), "utf8");
  assert.match(src, /iraAsAssumed: false/);
});

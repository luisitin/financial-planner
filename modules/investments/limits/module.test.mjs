// The full checks for this page are in tests/investments.test.mjs (fixture qa/fixtures/investments-plan.mjs) and against the
// answer key in tests/golden-limits.test.mjs. The worked examples below are those of tests/golden/limits/RULES.md section 10.
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, rothRange, rothStatus, rothReduced, rothAllowed } from "./compute.js";
import { investmentsPlan } from "../../../qa/fixtures/investments-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("limits: runs on the investments fixture and on an empty plan", () => {
  const d = compute(investmentsPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  const e = compute(emptyPlan(), { today: "2026-09-16" });
  assert.ok(e.notes.length); assert.equal(e.people.length, 0); assert.equal(e.roth.people[0].name, "You");
});

/** One household: adults a (role self) and b (partner), each { birth, pay, k401, roth401k, match, trad, rothIra, hsa, hsaEmployer }. */
function household({ status = "married_joint", apart = false, coverage = "self", covered = null, interest = 0, fsa = 0, a = {}, b = null, typedHsa = null }) {
  const p = emptyPlan();
  const xs = b ? [["a", a], ["b", b]] : [["a", a]];
  p.household.filingStatus = status;
  p.household.people = xs.map(([x, d], i) => ({ id: x, name: x === "a" ? "Ana" : "Ben", role: i ? "partner" : "self", birthDate: d.birth ?? "1980-06-01" }));
  p.taxes.livedApart = apart;
  p.taxes.thisYear.otherOrdinary = interest;
  p.income = xs.filter(([, d]) => d.pay > 0).map(([x, d]) => ({ id: `pay-${x}`, name: "Pay", type: "salary", personId: x, amount: d.pay, period: "annual", growth: 0, taxable: true }));
  p.accounts = []; p.retirement.contributions = [];
  for (const [x, d] of xs) {
    const add = (key, type, name, amount = 0, match = 0) => {
      if (!(amount > 0 || match > 0)) return;
      p.accounts.push({ id: `${key}-${x}`, name, type, balance: 0, ownerId: x });
      p.retirement.contributions.push({ id: `c-${key}-${x}`, accountId: `${key}-${x}`, personId: x, amount, period: "annual", employerMatch: match });
    };
    add("k401", "401k", "401(k)", d.k401, d.match);
    add("roth401k", "roth", "Roth 401(k)", d.roth401k);
    add("ira", "ira", "Traditional IRA", d.trad);
    add("rothira", "roth", "Roth IRA", d.rothIra);
    add("hsa", "hsa", "HSA", d.hsa, d.hsaEmployer);
  }
  const all = (k) => xs.reduce((s, [, d]) => s + (d[k] ?? 0), 0);
  p.taxes.hsa = { coverage, contribution: typedHsa ? typedHsa[0] : all("hsa"), employer: typedHsa ? typedHsa[1] : all("hsaEmployer"), fsa, fsaSpent: 0, ...(covered ? { coveredId: covered } : {}) };
  return p;
}
const row = (d, i, kind) => d.people[i].rows.find((r) => r.kind === kind);
const pick = (r, ...keys) => Object.fromEntries(keys.map((k) => [k, r[k]]));

test("Roth IRA formulas: the range for the return, Table 2-1's bands, the $10 rounding and the $200 floor, less traditional money (IRC 408A(c)(2), (c)(3); 219(g)(2), (g)(4))", () => {
  const po = { single: [153000, 168000], married_joint: [242000, 252000], married_separate: [0, 10000], head_of_household: [153000, 168000] };
  assert.deepEqual(rothRange(po, "married_separate", false), [0, 10000]);
  assert.deepEqual(rothRange(po, "married_separate", true), [153000, 168000], "separate and apart all year: not married, the single range");
  assert.deepEqual(rothRange(po, "married_joint", true), [242000, 252000], "living apart matters only on separate returns");
  assert.equal(rothStatus(241999, [242000, 252000]), "ok"); assert.equal(rothStatus(242000, [242000, 252000]), "partial"); assert.equal(rothStatus(252000, [242000, 252000]), "over");
  assert.equal(rothStatus(0, [0, 10000]), "ok", "zero (-0-) on the separate range: the full amount"); assert.equal(rothStatus(1, [0, 10000]), "partial");
  // RULES.md 10.2: joint MAGI 246,321 in 2026; Dev L 7,500: cut 3,240.75 down to 3,240 -> 4,260; Mara L 8,600: 3,716.06 -> 3,710 -> 4,890
  assert.equal(rothReduced(7500, 246321, [242000, 252000]), 4260); assert.equal(rothReduced(8600, 246321, [242000, 252000]), 4890);
  assert.equal(rothAllowed(8600, 4890, 6000), 2600, "Mara: the IRA limit left after 6,000 of traditional money");
  // RULES.md 10.3: separate, together: Lee 9,000 -> 750; at 9,990 the 10 left becomes 200; at or past the end nothing
  assert.equal(rothReduced(7500, 9000, [0, 10000]), 750); assert.equal(rothReduced(7500, 9990, [0, 10000]), 200); assert.equal(rothReduced(7500, 10000, [0, 10000]), 0);
  assert.equal(rothReduced(7500, 242000, [242000, 252000]), 7500, "nothing is cut at the start");
});

test("Roth IRA check per person on modified AGI: the traditional IRA deduction is added back (IRC 219(g)(3)(A), 408A(c)(3)(B)); RULES.md 10.2", () => {
  // Dev (45): pay 150,000, pre-tax 401(k) 10,000, Roth IRA 4,260. Mara (52): pay 105,000, traditional IRA 6,000, Roth IRA 3,000. Interest 1,321.
  const d = compute(household({ interest: 1321, a: { birth: "1981-02-01", pay: 150000, k401: 10000, rothIra: 4260 }, b: { birth: "1974-02-01", pay: 105000, trad: 6000, rothIra: 3000 } }), { today: "2026-10-31" });
  assert.equal(d.roth.magi, 246321, "AGI 240,321 + the 6,000 deducted");
  assert.deepEqual(d.roth.people.map((r) => pick(r, "magi", "status", "full", "reduced", "allowed", "over")), [
    { magi: 246321, status: "partial", full: 7500, reduced: 4260, allowed: 4260, over: 0 },
    { magi: 246321, status: "partial", full: 8600, reduced: 4890, allowed: 2600, over: 400 }]);
  assert.deepEqual(pick(row(d, 1, "ira"), "used", "over"), { used: 9000, over: 400 });
  assert.ok(d.warnings.some((w) => /^Ben: 3,000 is going into a Roth IRA, 400 more than the 2,600 allowed/.test(w)));
});

test("filing separately: each spouse's own income, the other income halved; apart all year the single range; zero is the full amount (IRC 219(g)(4); Pub. 590-A Table 2-1); RULES.md 10.3", () => {
  // Sam (Ana here, 40): pay 90,000; Lee (Ben, 38): pay 9,000; each 7,500 in a Roth IRA
  const base = { status: "married_separate", a: { birth: "1986-03-01", pay: 90000, rothIra: 7500 }, b: { birth: "1988-03-01", pay: 9000, rothIra: 7500 } };
  const t = compute(household(base), { today: "2026-10-31" });
  assert.equal(t.roth.separate, true); assert.equal(t.roth.magi, null); assert.deepEqual(t.roth.phaseOut, [0, 10000]);
  assert.deepEqual(t.roth.people.map((r) => pick(r, "magi", "status", "allowed", "over")), [
    { magi: 90000, status: "over", allowed: 0, over: 7500 }, { magi: 9000, status: "partial", allowed: 750, over: 6750 }]);
  assert.equal(t.roth.status, "over", "the more limited spouse");
  const apart = compute(household({ ...base, apart: true }), { today: "2026-10-31" });
  assert.deepEqual(apart.roth.phaseOut, [153000, 168000]);
  assert.deepEqual(apart.roth.people.map((r) => pick(r, "status", "allowed")), [{ status: "ok", allowed: 7500 }, { status: "ok", allowed: 7500 }]);
  // interest is split in half; pre-tax 401(k) within the limit, HSA payroll money and the FSA (on "Me") come off each one's own pay
  const own = compute(household({ status: "married_separate", coverage: "family", interest: 1000, fsa: 2000, a: { pay: 90000, k401: 5000, hsa: 3000 }, b: { pay: 40000, k401: 30000 } }), { today: "2026-10-31" });
  assert.deepEqual(own.roth.people.map((r) => r.magi), [90000 - 5000 - 2000 - 3000 + 500, 40000 - 24500 + 500]);
  // other income the Income page puts on one spouse is that spouse's; only the unnamed rest is halved
  const named = household({ status: "married_separate", interest: 1000, a: { pay: 90000 }, b: { pay: 7200 } });
  named.income.push({ id: "biz", name: "Photography", type: "business", personId: "b", amount: 7200, period: "annual", growth: 0, taxable: true }, { id: "div", name: "Dividends", type: "investment", amount: 400, period: "annual", growth: 0, taxable: true });
  // b's business at its profit with half its self-employment tax off b's own return (round 8: the Federal estimate's figures,
  // known.js; 7,200 x 92.35% x 15.3% / 2 = 508.66), where the business used to count in full
  assert.deepEqual(compute(named, { today: "2026-10-31" }).roth.people.map((r) => r.magi), [90000 + 700, Math.round((7200 + 7200 + 700 - 7200 * 0.9235 * 0.153 / 2) * 100) / 100]);
  // zero on the separate range
  const zero = compute(household({ status: "married_separate", a: { pay: 50000 }, b: { birth: "1970-01-01", pay: 0, rothIra: 8600 } }), { today: "2026-10-31" });
  assert.deepEqual(pick(zero.roth.people[1], "magi", "status", "allowed", "over"), { magi: 0, status: "ok", allowed: 8600, over: 0 });
});

test("Roth 401(k) money counts on the 401(k) row, not the IRA row, also for 'has an account' (IRC 402A(c)(2), 408A(c)(2)); RULES.md 10.1", () => {
  // Rosa (61 in 2026): pay 150,000, pre-tax 26,000, Roth 401(k) 10,000, match 6,000
  const d = compute(household({ status: "single", a: { birth: "1965-03-14", pay: 150000, k401: 26000, roth401k: 10000, match: 6000 } }), { today: "2026-10-31" });
  assert.deepEqual(pick(row(d, 0, "401k"), "limit", "catchUp", "used", "room", "over"), { limit: 24500 + 11250, catchUp: 11250, used: 36000, room: 0, over: 250 });
  assert.deepEqual(pick(row(d, 0, "ira"), "used", "hasAccount"), { used: 0, hasAccount: false });
  const only = compute(household({ status: "single", a: { pay: 80000, roth401k: 5000 } }), { today: "2026-10-31" });
  assert.equal(row(only, 0, "401k").hasAccount, true); assert.deepEqual(row(only, 0, "401k").accounts, ["Roth 401(k)"]);
});

test("the 401(k) catch-up is at most the pay left after the other deferrals (IRC 414(v)(2)(A)(ii)); with no pay on file at all, the whole catch-up", () => {
  const d = compute(household({ a: { birth: "1974-01-01", pay: 30000, k401: 24500 }, b: { birth: "1970-01-01", pay: 0, k401: 2000 } }), { today: "2026-10-31" });
  assert.deepEqual(pick(row(d, 0, "401k"), "catchUp", "catchUpFull", "catchUpCapped", "limit"), { catchUp: 5500, catchUpFull: 8000, catchUpCapped: true, limit: 30000 });
  assert.deepEqual(pick(row(d, 1, "401k"), "catchUp", "limit", "over"), { catchUp: 0, limit: 24500, over: 0 }, "no pay of their own");
  assert.equal(row(d, 0, "ira").catchUp, 1100, "the IRA catch-up is not capped here (enough pay assumed)");
  const none = compute(household({ a: { birth: "1974-01-01", k401: 24500 } }), { today: "2026-10-31" });
  assert.equal(none.payKnown, false); assert.equal(row(none, 0, "401k").catchUp, 8000);
  // self-employed with a solo 401(k): the business income is the compensation (415(c)(3)(B), 401(c)(2)), so no cap
  const solo = household({ a: { birth: "1974-01-01", k401: 32500 } });
  solo.income = [{ id: "biz", name: "Consulting", type: "business", personId: solo.household.people[0].id, amount: 90000, period: "annual", growth: 0 }];
  const s = compute(solo, { today: "2026-10-31" });
  assert.equal(s.payKnown, true); assert.deepEqual(pick(row(s, 0, "401k"), "catchUp", "catchUpCapped", "over"), { catchUp: 8000, catchUpCapped: false, over: 0 });
});

test("HSA rows: no high-deductible plan gives no limit; self-only is the covered adult's; each adult's own and employer money; spouses share the family limit (IRC 223(b), (c)(1)); RULES.md 10.4", () => {
  const none = compute(household({ coverage: "none", a: { hsa: 1000 }, b: {} }), { today: "2026-10-31" });
  assert.deepEqual(pick(row(none, 0, "hsa"), "limit", "used", "room", "over", "eligible"), { limit: 0, used: 1000, room: 0, over: 1000, eligible: false });
  assert.equal(row(none, 0, "hsa").label, "HSA (no high-deductible plan)");
  // the plan covers Ana (chosen on the HSA page): Ben's money is over
  const self = compute(household({ coverage: "self", covered: "a", a: { birth: "1968-01-01" }, b: { birth: "1968-01-01", hsa: 500 } }), { today: "2026-10-31" });
  assert.deepEqual(pick(row(self, 0, "hsa"), "limit", "catchUp", "used"), { limit: 4400 + 1000, catchUp: 1000, used: 0 });
  assert.deepEqual(pick(row(self, 1, "hsa"), "limit", "catchUp", "over", "eligible"), { limit: 0, catchUp: 0, over: 500, eligible: false });
  assert.equal(self.hsa.coveredName, "Ana");
  // not chosen: the one adult whose HSA rows hold money is taken as covered (a plan saved before the choice existed)
  const guessed = compute(household({ coverage: "self", a: { birth: "1968-01-01" }, b: { birth: "1968-01-01", hsa: 500 } }), { today: "2026-10-31" });
  assert.equal(guessed.hsa.coveredName, "Ben"); assert.deepEqual(pick(row(guessed, 1, "hsa"), "limit", "over"), { limit: 5400, over: 0 });
  // the HSA page's typed money is on the covered adult only, never on each adult
  const typed = compute(household({ coverage: "family", a: {}, b: {}, typedHsa: [5000, 1000] }), { today: "2026-10-31" });
  assert.deepEqual([row(typed, 0, "hsa").used, row(typed, 1, "hsa").used], [6000, 0]);
  // employer money alone counts
  const emp = compute(household({ coverage: "self", status: "single", a: { hsaEmployer: 1500 } }), { today: "2026-10-31" });
  assert.deepEqual(pick(row(emp, 0, "hsa"), "used", "room"), { used: 1500, room: 2900 });
  // Ana 56: 3,000 + 1,000 from her employer; Ben 52: 5,000 + 500; one family limit of 8,750
  const fam = compute(household({ coverage: "family", a: { birth: "1970-01-01", hsa: 3000, hsaEmployer: 1000 }, b: { birth: "1974-01-01", hsa: 5000, hsaEmployer: 500 } }), { today: "2026-10-31" });
  assert.deepEqual(pick(row(fam, 0, "hsa"), "limit", "used", "room", "shared"), { limit: 4250, used: 4000, room: 250, shared: true });
  assert.deepEqual(pick(row(fam, 1, "hsa"), "limit", "used", "room"), { limit: 5750, used: 5500, room: 250 });
});

test("a 2027 date: the HSA from Rev. Proc. 2026-24 (4,500 / 9,000), the rest from 2026 until the IRS publishes 2027's", () => {
  const d = compute(household({ coverage: "family", status: "single", a: { birth: "1970-01-01", hsa: 9500 } }), { today: "2027-03-01" });
  assert.deepEqual(pick(row(d, 0, "hsa"), "limit", "year", "over"), { limit: 9000 + 1000, year: 2027, over: 0 });
  assert.deepEqual([row(d, 0, "401k").year, row(d, 0, "ira").year, d.limitsYear, d.roth.year], [2026, 2026, 2026, 2026]);
});

test("the IRA and HSA deadline is April 15 moved off a weekend or a D.C. holiday (IRC 219(f)(3), 223(d)(4)(B), 7503)", () => {
  const due = (today) => compute(emptyPlan(), { today }).deadlines.find((x) => /IRA and HSA/.test(x.label)).date;
  assert.equal(due("2025-06-01"), "2026-04-15"); assert.equal(due("2026-06-01"), "2027-04-15");
  assert.equal(due("2027-06-01"), "2028-04-18", "Saturday the 15th, Emancipation Day kept on Monday the 17th");
});

test("Review 2026-11-06 (round 7): the Roth IRA warning says your for the unnamed first adult and your spouse's for the partner", () => {
  // the Roth IRA test's household, with the names Get started gives when none is typed
  const p = household({ interest: 1321, a: { birth: "1981-02-01", pay: 150000, k401: 10000, rothIra: 4260 }, b: { birth: "1974-02-01", pay: 105000, trad: 6000, rothIra: 3000 } });
  p.household.people[0].name = "Me"; p.household.people[1].name = "My spouse";
  const d = compute(p, { today: "2026-10-31" });
  assert.ok(d.warnings.some((w) => /^Your spouse's 3,000 is going into a Roth IRA, 400 more than the 2,600 allowed/.test(w)), d.warnings.join(" | "));
  // one adult over the limit: "Your 3,000 is going in", no "Me:"
  const one = household({ status: "single", a: { birth: "1981-02-01", pay: 200000, rothIra: 3000 } });
  one.household.people[0].name = "Me";
  const e = compute(one, { today: "2026-10-31" });
  assert.ok(e.warnings.some((w) => /^Your 3,000 is going into a Roth IRA, but none is allowed directly this year/.test(w)), e.warnings.join(" | "));
  assert.ok(!e.warnings.some((w) => /^Me\b/.test(w)));
});

// ---- round 8, Batch 1 (equity-3, landlord-3): the IRA deduction's income limits (IRC 219(g)) and the income the plan knows
import { iraDeduction, coveredAtWork } from "./compute.js";
test("round 8 item 9: iraDeduction, the traditional IRA deduction for someone covered at work (2026: 129,000 to 149,000 joint)", () => {
  const at = (magi, o = {}) => iraDeduction({ traditional: 7500, full: 7500, magi, covered: true, filingStatus: "married_joint", year: 2026, ...o });
  assert.equal(at(213000).deductible, 0, "213,000 joint, covered: none");
  // 140,000: 7,500 x (149,000 - 140,000) / 20,000 = 3,375, rounded up to 3,380 (Pub. 590-A Worksheet 1-2 line 7)
  assert.equal(at(140000).deductible, 3380); assert.equal(at(140000).deductible % 10, 0);
  assert.equal(at(120000).deductible, 7500, "under the range: all of it");
  assert.equal(at(148990).deductible, 200, "the $200 floor until the range's end (219(g)(2)(B))");
  // single 81,000 to 91,000; not covered but married to someone covered 242,000 to 252,000 (219(g)(7))
  assert.equal(at(86000, { filingStatus: "single" }).deductible, 3750);
  assert.equal(at(213000, { covered: false, spouseCovered: true }).deductible, 7500);
  assert.equal(at(247000, { covered: false, spouseCovered: true }).deductible, 3750);
  // separately: 0 to 10,000; living apart all year, the single range (219(g)(4))
  assert.equal(at(5000, { filingStatus: "married_separate" }).deductible, 3750);
  assert.equal(at(50000, { filingStatus: "married_separate", livedApart: true }).deductible, 7500);
  // nobody covered: all of it at any income
  assert.equal(at(900000, { covered: false }).deductible, 7500);
  // 2025's own range (126,000 to 146,000)
  assert.equal(at(136000, { year: 2025, full: 7000, traditional: 7000 }).deductible, 3500);
});

test("round 8 items 9 and 12: Limits says how much of the IRA money comes off, and stock pay closes the direct Roth IRA", async () => {
  const { equityPlan, freelancerPlan } = await import("../../../qa/fixtures/round8-households.mjs");
  const p = equityPlan();
  assert.equal(coveredAtWork(p, "mo"), true); assert.equal(coveredAtWork(p, "lin"), true); assert.equal(coveredAtWork(freelancerPlan(), "me"), false);
  // 213,000 of AGI from pay alone, 318,000 with the 105,000 of stock vesting: over 252,000, no direct Roth IRA for either
  const d = compute(p, { today: "2026-11-06" });
  assert.equal(d.roth.magi, 318000); assert.deepEqual(d.roth.people.map((x) => x.allowed), [0, 0]);
  p.accounts.push({ id: "ira-mo", name: "Mo's IRA", type: "ira", balance: 0, ownerId: "mo" });
  p.retirement.contributions.push({ id: "c-ira", accountId: "ira-mo", personId: "mo", period: "annual", amount: 7500, employerMatch: 0 });
  const row = compute(p, { today: "2026-11-06" }).people[0].rows.find((r) => r.kind === "ira");
  assert.equal(row.deduct.deductible, 0); assert.equal(row.deduct.rule, "covered"); assert.deepEqual(row.deduct.range, [129000, 149000]);
  // the freelancer has no plan at work: all 3,000 comes off
  const f = compute(freelancerPlan(), { today: "2026-11-06" }).people[0].rows.find((r) => r.kind === "ira");
  assert.equal(f.deduct.deductible, 3000); assert.equal(f.deduct.rule, "none");
  // no traditional IRA money: no deduct figure at all
  assert.equal("deduct" in compute(equityPlan(), { today: "2026-11-06" }).people[0].rows.find((r) => r.kind === "ira"), false);
});

// ================================================================ after-tax money into Roth (gap list, next 60, item 28)
import { annualAdditionsFor, afterTaxRoom, afterTaxWords, afterTaxAnswer, setAfterTaxAnswer, atWorkPlan, AFTER_TAX_KEYS } from "./compute.js";
import { LIMITS } from "../../retirement/contributions/data/limits.js";
import { limitsFor } from "../../retirement/contributions/compute.js";
const T13 = "2026-11-13";
const ROOM = { year: 2026, limit: 72000, limitYear: 2026 };
/** One adult (or two) through the household() above, with answers on workPlans and extra accounts. */
const withPlan = (o = {}, answers = null, extra = []) => {
  const p = household(o);
  for (const a of extra) p.accounts.push({ balance: 0, ownerId: "a", ...a });
  if (answers) p.retirement.workPlans = { a: answers };
  return p;
};
const roomOf = (p, today = T13) => afterTaxRoom(p, { today });

test("the yearly limit on all money into a work plan (IRC 415(c)(1)(A)): 70,000 in 2025, 72,000 in 2026; a later year keeps the newest; the page's other 2026 figures as the IRS printed them", () => {
  // Notice 2025-67 (read 2026-11-15, https://www.irs.gov/pub/irs-drop/n-25-67.pdf): "The limitation for defined contribution
  // plans under section 415(c)(1)(A) is increased in 2026 from $70,000 to $72,000."
  assert.deepEqual(annualAdditionsFor(2026), { limit: 72000, year: 2026 });
  assert.deepEqual(annualAdditionsFor(2025), { limit: 70000, year: 2025 });
  assert.deepEqual(annualAdditionsFor(2027), { limit: 72000, year: 2026 }, "2027's is not out (the IRS's table, read 2026-11-15, ends at 2026)");
  assert.deepEqual(annualAdditionsFor(2020), { limit: 70000, year: 2025 }, "a year before the table: the first");
  // the IRS's 401(k) page (read 2026-11-15): "$72,000 in 2026 ($80,000 including catch-up contributions or up to $83,250 for
  // those age 60 to 63)": the catch-up is on top
  const K = limitsFor(2026).kinds["401k"];
  assert.equal(72000 + K.catchUp, 80000); assert.equal(72000 + K.superCatchUp.amount, 83250);
  // the page's other 2026 figures, checked at irs.gov on 2026-11-15: Notice 2025-67 (402(g) 24,500; catch-up 8,000; 60 to 63
  // 11,250; IRA 7,500 + 1,100; Roth IRA 153,000-168,000 and 242,000-252,000; IRA deduction 81,000-91,000, 129,000-149,000,
  // spouse 242,000-252,000), Rev. Proc. 2025-19 s.2.01(1) (HSA 4,400 / 8,750), Rev. Proc. 2025-32 (health FSA 3,400,
  // carryover 680; gift exclusion 19,000). All agree; nothing was corrected.
  const L = LIMITS[2026];
  assert.deepEqual([L.kinds["401k"].limit, L.kinds["401k"].catchUp, L.kinds["401k"].superCatchUp.amount, L.kinds.ira.limit, L.kinds.ira.catchUp], [24500, 8000, 11250, 7500, 1100]);
  assert.deepEqual([L.rothPhaseOut.single, L.rothPhaseOut.married_joint, L.rothPhaseOut.married_separate], [[153000, 168000], [242000, 252000], [0, 10000]]);
  assert.deepEqual([L.iraDeductPhaseOut.covered.single, L.iraDeductPhaseOut.covered.married_joint, L.iraDeductPhaseOut.spouse.married_joint], [[81000, 91000], [129000, 149000], [242000, 252000]]);
  assert.deepEqual([L.kinds.hsa.limit, L.kinds.hsa.family, L.kinds.fsa.limit, L.kinds.fsa.carryover, L.giftExclusion], [4400, 8750, 3400, 680, 19000]);
});

test("after-tax room = the limit (or all of the pay when less) - what goes in from pay (up to 24,500, catch-up left out) - the employer's money, never below 0 (IRC 415(c)(1), 414(v)(3)(A))", () => {
  // Ana, 36: 12,220 of her pay and 3,050 from the employer: 72,000 - 12,220 - 3,050 = 56,730; 24,500 - 12,220 = 12,280 usual room left
  const a = roomOf(withPlan({ a: { birth: "1990-06-01", pay: 101400, k401: 12220, match: 3050 } })).people[0];
  assert.deepEqual(pick(a, "cap", "capByPay", "own", "employer", "room", "regularLeft", "catchUp", "catchUpIn", "verdict"), { cap: 72000, capByPay: false, own: 12220, employer: 3050, room: 56730, regularLeft: 12280, catchUp: 0, catchUpIn: 0, verdict: "ask" });
  // all of the pay when less (415(c)(1)(B)): 39,000 of pay, a 401(k) at the job, nothing going in
  const b = roomOf(withPlan({ a: { pay: 39000 } }, null, [{ id: "w", name: "Work 401(k)", type: "401k" }])).people[0];
  assert.deepEqual(pick(b, "cap", "capByPay", "own", "employer", "room"), { cap: 39000, capByPay: true, own: 0, employer: 0, room: 39000 });
  // at the limit, and past it: never below 0
  assert.equal(roomOf(withPlan({ a: { pay: 200000, k401: 24500, match: 47500 } })).people[0].room, 0);
  const over = roomOf(withPlan({ a: { pay: 200000, k401: 24500, match: 60000 } })).people[0];
  assert.equal(over.room, 0); assert.equal(over.verdict, "full");
  // money over the 24,500 (no catch-up at 46) is not counted twice: only 24,500 of it
  assert.equal(roomOf(withPlan({ a: { pay: 150000, k401: 30000 } })).people[0].own, 24500);
  assert.equal(roomOf(withPlan({ a: { pay: 150000, k401: 30000 } })).people[0].room, 47500);
  // 55: 32,500 in = 24,500 + the 8,000 catch-up, which does not count; 10,000 from the employer -> 72,000 - 24,500 - 10,000 = 37,500
  const c = roomOf(withPlan({ a: { birth: "1971-06-01", pay: 150000, k401: 32500, match: 10000 } })).people[0];
  assert.deepEqual(pick(c, "own", "catchUp", "catchUpIn", "room"), { own: 24500, catchUp: 8000, catchUpIn: 8000, room: 37500 });
  // 61: the 11,250 catch-up from 60 to 63, none of it used
  const d = roomOf(withPlan({ a: { birth: "1965-06-01", pay: 150000, k401: 10000 } })).people[0];
  assert.deepEqual(pick(d, "catchUp", "catchUpIn", "room"), { catchUp: 11250, catchUpIn: 0, room: 62000 });
  // no pay on file at all: the limit itself (the page cannot know the pay)
  const e = roomOf(withPlan({ a: { k401: 10000 } })).people[0];
  assert.deepEqual(pick(e, "compensation", "payKnown", "cap", "capByPay", "room"), { compensation: 0, payKnown: false, cap: 72000, capByPay: false, room: 62000 });
  assert.equal(a.payKnown, true);
  // Roth 401(k) money counts with the pre-tax money (both are what goes in from pay)
  assert.equal(roomOf(withPlan({ a: { pay: 150000, k401: 10000, roth401k: 5000 } })).people[0].own, 15000);
  // two adults: each their own room, and the total of those whose way is not closed
  const two = roomOf(withPlan({ status: "married_joint", a: { pay: 150000, k401: 10000 }, b: { pay: 90000, k401: 5000, match: 2000 } }));
  assert.deepEqual(two.people.map((x) => x.room), [62000, 65000]); assert.equal(two.total, 127000);
  assert.equal(two.limit, 72000); assert.equal(two.limitYear, 2026);
  // a 2027 date: 2026's limit, said as such
  const y = roomOf(withPlan({ a: { pay: 150000, k401: 10000 } }), "2027-03-01");
  assert.deepEqual([y.year, y.limit, y.limitYear], [2027, 72000, 2026]);
  // a date before the table (a phone's clock set back): the first year kept, 2025's
  const old = roomOf(withPlan({ a: { pay: 150000, k401: 10000 } }), "2024-06-01");
  assert.deepEqual([old.year, old.limit, old.limitYear], [2024, 70000, 2025]);
});

test("review o1 F1: a row marked Household (no person) counts for the account's owner, else the first adult, as on Retirement contributions and the Federal estimate", () => {
  // one adult, a 401(k) of hers, a row naming no one: 10,000 from pay and 5,000 from the employer -> 72,000 - 10,000 - 5,000 = 57,000
  const p = withPlan({ a: { pay: 100000, k401: 10000, match: 5000 } });
  p.retirement.contributions[0].personId = null;
  const x = roomOf(p).people[0];
  assert.deepEqual(pick(x, "used", "own", "employer", "room", "regularLeft"), { used: 10000, own: 10000, employer: 5000, room: 57000, regularLeft: 14500 });
  // "" (the Contributions form's "Household") reads the same, and a row naming her reads the same: one figure either way
  p.retirement.contributions[0].personId = "";
  assert.equal(roomOf(p).people[0].room, 57000);
  p.retirement.contributions[0].personId = "a";
  assert.equal(roomOf(p).people[0].room, 57000);
  // two adults, Ben's 401(k), a row naming no one: Ben's, not Ana's (the account's owner)
  const two = withPlan({ status: "married_joint", a: { pay: 150000, k401: 10000 }, b: { pay: 90000, k401: 6000, match: 2000 } });
  two.retirement.contributions.find((c) => c.accountId === "k401-b").personId = "";
  assert.deepEqual(roomOf(two).people.map((z) => [z.id, z.own, z.employer, z.room]), [["a", 10000, 0, 62000], ["b", 6000, 2000, 64000]]);
  // an account that names no one and a row that names no one: the first adult's ("Me"); Ben then has no 401(k) of his own
  two.accounts.find((a) => a.id === "k401-b").ownerId = "";
  assert.deepEqual(roomOf(two).people.map((z) => [z.id, z.own, z.employer]), [["a", 16000, 2000]]);
  // the catch-up on such a row: 55, 32,500 in (24,500 + 8,000), 10,000 from the employer, the row naming no one -> 37,500 as when it names her
  const c = withPlan({ a: { birth: "1971-06-01", pay: 150000, k401: 32500, match: 10000 } });
  c.retirement.contributions[0].personId = "";
  assert.deepEqual(pick(roomOf(c).people[0], "own", "catchUp", "catchUpIn", "room"), { own: 24500, catchUp: 8000, catchUpIn: 8000, room: 37500 });
});

test("who has a 401(k) or 403(b) at work: money going in, Get started's answer, or pay and an account at the job; not an old job's account, a 457 or the TSP", () => {
  const at = (p) => roomOf(p).people.map((x) => x.id);
  const acct = (o) => ({ id: "w", name: "401(k)", type: "401k", ...o });
  assert.deepEqual(at(withPlan({ a: { pay: 80000 } }, null, [acct()])), ["a"], "pay and a 401(k) of their own");
  assert.deepEqual(at(withPlan({ a: { pay: 80000 } }, { plan: false }, [acct()])), [], "Get started: no plan at work");
  assert.deepEqual(at(withPlan({ a: { pay: 80000, k401: 5000 } }, { plan: false })), ["a"], "money going in shows a plan whatever was answered");
  assert.deepEqual(at(withPlan({ a: { pay: 80000 } }, { plan: true })), ["a"], "Get started: yes, before any account");
  assert.deepEqual(at(withPlan({ a: { pay: 80000 } }, null, [acct({ name: "Old job 401(k)" })])), [], "an old job's 401(k)");
  assert.deepEqual(at(withPlan({ a: { pay: 80000 } }, null, [acct({ formerJob: true })])), [], "a 401(k) from a job left");
  assert.deepEqual(at(withPlan({ a: { pay: 80000 } }, null, [acct({ name: "457(b) plan" })])), [], "a 457 is not a 401(k)");
  assert.deepEqual(at(withPlan({ a: { pay: 80000 } }, null, [acct({ name: "TSP" })])), [], "nor the Thrift Savings Plan");
  assert.deepEqual(at(withPlan({ a: { pay: 80000 } }, null, [acct({ type: "roth", name: "Roth 401(k)" })])), ["a"], "a Roth 401(k) at the job");
  assert.deepEqual(at(withPlan({ a: { pay: 80000 } }, null, [acct({ type: "roth", name: "Roth IRA" })])), [], "a Roth IRA is not a plan at work");
  assert.deepEqual(at(withPlan({ a: {} }, null, [acct()])), [], "no pay and nothing going in");
  // an account that names no adult is the first adult's (as on the rest of this page)
  assert.deepEqual(at(withPlan({ status: "married_joint", a: { pay: 80000 }, b: { pay: 70000 } }, null, [acct({ ownerId: "" })])), ["a"]);
  assert.equal(atWorkPlan(emptyPlan(), "x", 50000), false);
  // the retired couple and the empty plan: nobody, so the page draws nothing new
  assert.equal(roomOf(emptyPlan()).people.length, 0);
});

test("the answers decide the case: No closes it, a plan that cannot move it closes it, two yeses open it, else what to ask; no room is no room", () => {
  const v = (answers, o = { pay: 150000, k401: 10000 }) => { const x = roomOf(withPlan({ a: o }, answers)).people[0]; return [x.verdict, x.asks.join(","), x.set]; };
  assert.deepEqual(v(null), ["ask", "afterTax,toRoth", 0]);
  assert.deepEqual(v({ afterTax: true }), ["ask", "toRoth", 1]);
  assert.deepEqual(v({ afterTaxToRoth: true }), ["ask", "afterTax", 1]);
  assert.deepEqual(v({ afterTax: true, afterTaxToRoth: true }), ["ok", "", 2]);
  assert.deepEqual(v({ afterTax: false }), ["no", "", 1]);
  assert.deepEqual(v({ afterTax: false, afterTaxToRoth: true }), ["no", "", 2]);
  assert.deepEqual(v({ afterTax: true, afterTaxToRoth: false }), ["stuck", "", 2]);
  assert.deepEqual(v({ afterTaxToRoth: false }), ["stuck", "", 1]);
  assert.deepEqual(v({ afterTax: true, afterTaxToRoth: true }, { pay: 200000, k401: 24500, match: 47500 }), ["full", "", 2]);
  // the total leaves out the closed ways
  const p = withPlan({ status: "married_joint", a: { pay: 150000, k401: 10000 }, b: { pay: 90000, k401: 5000 } });
  p.retirement.workPlans = { b: { afterTax: false } };
  assert.equal(roomOf(p).total, 62000);
  assert.deepEqual(afterTaxAnswer(p, "b"), { afterTax: false, toRoth: null });
  assert.deepEqual(afterTaxAnswer(p, "a"), { afterTax: null, toRoth: null });
});

test("one written sentence per case (R5): ok, the three asks, no, closed, full; how the room is worked out; the usual room; the catch-up; you and your for an unnamed first adult", () => {
  const X = { name: "Ana", age: 36, cap: 72000, capByPay: false, payKnown: true, own: 12220, employer: 3050, room: 56730, regularLeft: 12280, catchUp: 0, catchUpIn: 0, afterTax: null, toRoth: null, verdict: "ask", asks: ["afterTax", "toRoth"] };
  const w = (o = {}, r = ROOM) => afterTaxWords({ ...X, ...o }, r);
  assert.equal(w({ verdict: "ok", asks: [] }).line, "Ana could put up to $56,730 more into the plan after tax this year and move it to Roth.");
  assert.equal(w({ verdict: "ok", asks: [] }).next, null);
  assert.equal(w().line, "Ana could put up to $56,730 more into the plan after tax this year, if the plan allows it.");
  // review o1 P2: where to find out, with the words the plan's papers use
  assert.equal(w().next, 'Not sure? Ask HR, or look on the plan\'s website for "after-tax contributions" and "in-plan Roth conversion".');
  assert.equal(w({ asks: ["toRoth"] }).line, "Ana's plan takes after-tax money: up to $56,730 more could go in this year.");
  assert.equal(w({ asks: ["toRoth"] }).next, 'Not sure? Ask HR, or look on the plan\'s website for "in-plan Roth conversion" or "in-service withdrawal".');
  assert.equal(w({ asks: ["afterTax"] }).line, "Ana could put up to $56,730 more into the plan after tax this year, if the plan takes after-tax money.");
  assert.equal(w({ asks: ["afterTax"] }).next, 'Not sure? Ask HR, or look on the plan\'s website for "after-tax contributions".');
  assert.equal(w({ verdict: "no", asks: [] }).line, "Ana's plan does not take after-tax money, so this way into Roth is closed.");
  assert.equal(w({ verdict: "stuck", afterTax: true, asks: [] }).line, "Ana's plan cannot move after-tax money to Roth while Ana works, so this way into Roth is closed.");
  // review o1 F5: the first answer still "Not sure": the sentence does not take for granted that the plan takes after-tax money
  assert.equal(w({ verdict: "stuck", afterTax: null, asks: [] }).line, "If Ana's plan takes after-tax money, that money cannot be moved to Roth while Ana works, so this way into Roth is closed.");
  assert.equal(w({ verdict: "stuck", asks: [] }).next, "After-tax money left in the plan grows, and the growth is taxed as pay when it comes out.");
  assert.equal(w({ verdict: "full", room: 0, own: 24500, employer: 47500, asks: [] }).line, "Ana's work plan is already at its $72,000 limit for 2026, so no after-tax money fits this year.");
  assert.equal(w({ verdict: "full", room: 0, cap: 30000, capByPay: true, own: 24500, employer: 6000, asks: [] }).line, "Ana's work plan is already at its 2026 limit, which is all of Ana's pay ($30,000), so no after-tax money fits this year.");
  // how the room is worked out, each case
  assert.equal(w().sum, "The 2026 limit on all money into Ana's work plan is $72,000. $12,220 goes in from Ana's pay, before tax or as Roth, and $3,050 from the employer, which leaves $56,730.");
  assert.equal(w({ employer: 0, room: 59780 }).sum, "The 2026 limit on all money into Ana's work plan is $72,000. $12,220 goes in from Ana's pay, before tax or as Roth, which leaves $59,780.");
  assert.equal(w({ own: 0, room: 68950 }).sum, "The 2026 limit on all money into Ana's work plan is $72,000. $3,050 goes in from the employer, which leaves $68,950.");
  assert.equal(w({ own: 0, employer: 0, room: 72000 }).sum, "The 2026 limit on all money into Ana's work plan is $72,000. Nothing goes in yet, so all of it is room.");
  assert.equal(w({ cap: 39000, capByPay: true, own: 0, employer: 0, room: 39000 }).sum, "The 2026 limit on all money into Ana's work plan is $39,000, all of Ana's pay: it is the pay when that is less than $72,000. Nothing goes in yet, so all of it is room.");
  assert.equal(w({ verdict: "full", own: 24500, employer: 47500, room: 0 }).sum, "The 2026 limit on all money into Ana's work plan is $72,000. $24,500 goes in from Ana's pay, before tax or as Roth, and $47,500 from the employer, which leaves nothing.");
  assert.equal(w({}, { year: 2027, limit: 72000, limitYear: 2026 }).sum, "The 2026 limit (2027's is not out yet) on all money into Ana's work plan is $72,000. $12,220 goes in from Ana's pay, before tax or as Roth, and $3,050 from the employer, which leaves $56,730.");
  // review o1 F2: a year before the table (a phone's clock set back) is not "not out yet": the first year this app has
  assert.equal(w({ cap: 70000, room: 54730 }, { year: 2024, limit: 70000, limitYear: 2025 }).sum, "The 2025 limit (the earliest this app has) on all money into Ana's work plan is $70,000. $12,220 goes in from Ana's pay, before tax or as Roth, and $3,050 from the employer, which leaves $54,730.");
  // the usual room, and the catch-up
  // review o1 P3: the usual room is said as part of the same limit, not as room on top of the figure
  assert.equal(w().regular, "Ana also has $12,280 of usual 401(k) room left this year. It counts toward the same $72,000: what goes in there comes off the $56,730.");
  assert.equal(w({ verdict: "no", asks: [] }).regular, "Ana also has $12,280 of usual 401(k) room left this year.", "a closed way: no room to come off");
  assert.equal(w({ regularLeft: 0 }).regular, null);
  assert.equal(w({ verdict: "full", regularLeft: 100 }).regular, null, "no room: nothing about the usual room");
  assert.equal(w().catchUp, null);
  assert.equal(w({ age: 55, catchUp: 8000 }).catchUp, "The $8,000 catch-up from 50 is on top of this limit and does not use it.");
  assert.equal(w({ age: 61, catchUp: 11250 }).catchUp, "The $11,250 catch-up from 60 to 63 is on top of this limit and does not use it.");
  assert.equal(w({ age: 55, catchUp: 8000, catchUpIn: 8000 }).catchUp, "Of what goes in from Ana's pay, $8,000 is catch-up money: it is on top of this limit and does not use it.");
  // review o1 F4: no pay on the Income page: said, with what it means
  assert.equal(w().pay, null);
  assert.equal(w({ payKnown: false }).pay, "Ana's pay is not on the Income page, so this uses the full $72,000. If Ana earns less than that, the limit is all of Ana's pay.");
  // the two questions, in plain words (review o1 P2)
  assert.equal(w().q1, "Does Ana's work plan take after-tax money, on top of the usual 401(k) money?");
  assert.equal(w().q2, "Can that money be moved to Roth while Ana still works there?");
  // an unnamed first adult ("Me"): you and your
  const me = (o = {}) => w({ name: "Me", ...o });
  assert.equal(me({ verdict: "ok", asks: [] }).line, "You could put up to $56,730 more into the plan after tax this year and move it to Roth.");
  assert.equal(me({ asks: ["toRoth"] }).line, "Your plan takes after-tax money: up to $56,730 more could go in this year.");
  assert.equal(me().q2, "Can that money be moved to Roth while you still work there?");
  assert.equal(me({ verdict: "stuck", afterTax: true, asks: [] }).line, "Your plan cannot move after-tax money to Roth while you work, so this way into Roth is closed.");
  assert.equal(me({ verdict: "stuck", asks: [] }).line, "If your plan takes after-tax money, that money cannot be moved to Roth while you work, so this way into Roth is closed.");
  assert.equal(me().regular, "You also have $12,280 of usual 401(k) room left this year. It counts toward the same $72,000: what goes in there comes off the $56,730.");
  assert.equal(me({ payKnown: false }).pay, "Your pay is not on the Income page, so this uses the full $72,000. If you earn less than that, the limit is all of your pay.");
  assert.equal(me().sum, "The 2026 limit on all money into your work plan is $72,000. $12,220 goes in from your pay, before tax or as Roth, and $3,050 from the employer, which leaves $56,730.");
  assert.equal(me().q1, "Does your work plan take after-tax money, on top of the usual 401(k) money?");
});

test("the answers are kept on retirement.workPlans[person]: yes and no as true and false, not sure as nothing, the entry's other answers kept, an empty entry removed", () => {
  const p = { retirement: { workPlans: { a: { match: false } } } };
  setAfterTaxAnswer(p, "a", "afterTax", "yes");
  assert.deepEqual(p.retirement.workPlans.a, { match: false, afterTax: true });
  setAfterTaxAnswer(p, "a", "afterTaxToRoth", "no");
  assert.deepEqual(p.retirement.workPlans.a, { match: false, afterTax: true, afterTaxToRoth: false });
  setAfterTaxAnswer(p, "a", "afterTax", "unsure"); setAfterTaxAnswer(p, "a", "afterTaxToRoth", "unsure");
  assert.deepEqual(p.retirement.workPlans, { a: { match: false } }, "Get started's answer stays");
  const q = { retirement: {} };
  setAfterTaxAnswer(q, "b", "afterTax", "no"); assert.deepEqual(q.retirement.workPlans, { b: { afterTax: false } });
  setAfterTaxAnswer(q, "b", "afterTax", "unsure"); assert.equal("workPlans" in q.retirement, false, "nothing left: workPlans goes");
  setAfterTaxAnswer(q, "b", "match", "yes"); setAfterTaxAnswer(q, "", "afterTax", "yes");
  assert.equal("workPlans" in q.retirement, false, "only the two keys, only for a person");
  assert.deepEqual(AFTER_TAX_KEYS, ["afterTax", "afterTaxToRoth"]);
  // review o1 F3: an entry (or workPlans) that is not a plain object, from a hand-edited file, is read as nothing, never
  // spread into keys "0", "1" ...
  for (const [wp, want] of [[{ a: "abc" }, { a: { afterTax: true } }], [{ a: [1] }, { a: { afterTax: true } }], [{ a: null, b: { plan: true } }, { a: { afterTax: true }, b: { plan: true } }], ["x", { a: { afterTax: true } }], [[1, 2], { a: { afterTax: true } }]]) {
    const r = { retirement: { workPlans: structuredClone(wp) } };
    setAfterTaxAnswer(r, "a", "afterTax", "yes");
    assert.deepEqual(r.retirement.workPlans, want, JSON.stringify(wp));
  }
});

// ---------------------------------------------------------------- the page: one quiet row, saved only by a tap on an answer
async function livePage(plan0, today = T13) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { render } = await import("./view.js");
  let cur = migrate(structuredClone(plan0));
  const page = { saves: 0, root: null };
  const store = { get: () => cur, update: (fn) => { const d = structuredClone(cur); fn(d); cur = d; page.saves++; page.draw(); } };
  page.draw = () => { page.root = new FakeElement("main"); render(page.root, { ui, fmt: { ...fmt, today: () => today }, plan: cur, route: { group: "investments", id: "limits", rest: [], query: {} }, module: { group: "investments", id: "limits" }, store, redraw: () => page.draw(), computeOf: () => null }); return page; };
  page.plan = () => cur;
  page.text = () => textOf(page.root);
  page.part = (id) => page.root.all().find((e) => e.tagName === "DETAILS" && e.dataset.part === id);
  page.body = (id) => textOf(page.part(id)?.querySelector(".fold-body"));
  page.status = (id) => textOf(page.part(id)?.querySelector(".fold-status"));
  page.first = () => { const walk = (n) => (n.data !== undefined ? n.data : n.hidden ? "" : n.tagName === "DETAILS" && !n.hasAttribute("open") ? walk(n.childNodes.find((c) => c.tagName === "SUMMARY") ?? { data: "" }) : n.tagName === "STYLE" ? "" : n.childNodes.map(walk).join(" ")); return walk(page.root).replace(/\s+/g, " ").trim(); };
  page.open = () => Object.fromEntries(page.root.all().filter((e) => e.tagName === "DETAILS" && e.dataset.part).map((e) => [e.dataset.part, e.hasAttribute("open")]));
  page.chips = (key) => page.root.all().filter((e) => e.dataset?.ask === key);
  page.tap = (key, label, n = 0) => { const box = page.chips(key)[n]; assert.ok(box, `question ${key}`); const b = box.all().find((e) => e.tagName === "BUTTON" && textOf(e) === label); assert.ok(b, `chip ${label}`); b.click(); return page; };
  page.on = (key, n = 0) => page.chips(key)[n]?.all().find((e) => e.tagName === "BUTTON" && e.getAttribute("aria-pressed") === "true")?.textContent;
  page.notices = () => page.root.all().filter((e) => /\bnotice\b/.test(e.className ?? "")).map((e) => [e.className.replace("notice", "").trim(), textOf(e)]);
  page.head = (pid) => textOf(page.root.all().find((e) => e.tagName === "LI" && e.dataset?.person === pid)?.querySelector(".rec-value"));
  return page.draw();
}
const fresh = async () => { (await import("./view.js"))._reset(); };
const familyOf = async () => (await import("../../../qa/fixtures/family-plan.mjs")).familyPlan(T13);

test("the page: one shut row only with a 401(k) or 403(b) at work, titled as pinned, the room as its status; nothing new on the first view beyond it; no box inside", async () => {
  await fresh();
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  // the retired couple (no plan at work) and the empty plan: the page exactly as before
  for (const p of [retiredCouplePlan(), emptyPlan()]) { const pg = await livePage(p); assert.equal(pg.part("aftertax"), undefined); assert.ok(!/after tax|after-tax/i.test(pg.text())); }
  const page = await livePage(await familyOf());
  const part = page.part("aftertax");
  assert.ok(part && !part.hasAttribute("open"), "shut on arrival");
  assert.equal(part.dataset.kind, "own");
  assert.equal(textOf_(part.querySelector(".fold-title")), "After-tax money into Roth");
  const { PINNED_TITLES } = await import("../../../qa/first-view-lib.mjs");
  assert.ok(PINNED_TITLES.includes("After-tax money into Roth"));
  // review o1 P1: before any answer the room is "if allowed", never a promise (most plans do not take after-tax money)
  assert.equal(page.status("aftertax"), "$56,730 if allowed");
  assert.equal(page.head("p-ana"), "$56,730 if allowed");
  // the first view: the title and its status only
  assert.match(page.first(), /After-tax money into Roth \$56,730 if allowed/);
  for (const w of ["Ask the plan", "Not sure", "information, not advice", "What you save for retirement"]) assert.ok(!page.first().includes(w), w);
  // the link is a full 44 px row, not a small inline link
  assert.equal(part.all().find((e) => e.tagName === "A").style.minHeight, "44px");
  // one tap away: Ana's answer, the sum, the usual room, the two questions, the tax line, the way to Retirement contributions
  const body = page.body("aftertax");
  for (const w of [
    "Some work plans take money after tax on top of the usual 401(k) limit, and let you move it to Roth, where it grows tax-free. It works only if the plan allows it.",
    'Ana could put up to $56,730 more into the plan after tax this year, if the plan allows it. Not sure? Ask HR, or look on the plan\'s website for "after-tax contributions" and "in-plan Roth conversion".',
    "The 2026 limit on all money into Ana's work plan is $72,000. $12,220 goes in from Ana's pay, before tax or as Roth, and $3,050 from the employer, which leaves $56,730.",
    "Ana also has $12,280 of usual 401(k) room left this year. It counts toward the same $72,000: what goes in there comes off the $56,730.",
    "Does Ana's work plan take after-tax money, on top of the usual 401(k) money?",
    "Can that money be moved to Roth while Ana still works there?",
    "Only what the money earns before the move is taxed, so moving it soon after it goes in keeps the tax small. This is information, not advice.",
    "Nothing here changes your plan.",
  ]) assert.ok(body.includes(w), w);
  // the family has pay on file: nothing about it, and no way to the Income page
  assert.ok(!body.includes("not on the Income page")); assert.equal(part.all().filter((e) => e.getAttribute?.("href") === "#/cashflow/income").length, 0);
  // Bo's only 401(k) is his old job's: not at work, not listed
  assert.ok(!body.includes("Bo"));
  assert.ok(part.all().some((e) => e.tagName === "A" && e.getAttribute("href") === "#/retirement/contributions" && /What you save for retirement/.test(e.textContent)));
  // R24's pinned title: no number box inside, only the picks; and no hand-written <details>
  assert.equal(part.all().filter((e) => ["INPUT", "SELECT", "TEXTAREA"].includes(e.tagName)).length, 0);
  assert.ok(page.root.all().filter((e) => e.tagName === "DETAILS").every((d) => d.dataset.part));
  // "Not sure" is on for both questions until answered
  assert.equal(page.on("afterTax"), "Not sure"); assert.equal(page.on("afterTaxToRoth"), "Not sure");
  // no filled button anywhere (a chip is not one)
  assert.equal(page.root.all().filter((e) => e.tagName === "BUTTON" && !/secondary|chip/.test(e.className)).length, 0);
});
const textOf_ = (el) => String(el?.textContent ?? "").replace(/\s+/g, " ").trim();

test("a tap on an answer saves it at once, the green line names the new answer, and the plan changes only there", async () => {
  await fresh();
  const page = await livePage(await familyOf());
  const before = structuredClone(page.plan());
  page.tap("afterTax", "Yes");
  assert.equal(page.saves, 1);
  assert.deepEqual(page.plan().retirement.workPlans, { "p-ana": { afterTax: true } });
  const after = structuredClone(page.plan()); delete after.retirement.workPlans;
  assert.deepEqual(after, before, "nothing else in the plan moved");
  assert.deepEqual(page.notices().filter(([k]) => k === "ok"), [["ok", "Saved. Ana's plan takes after-tax money: up to $56,730 more could go in this year."]]);
  assert.equal(page.status("aftertax"), "1 set by you");
  assert.equal(page.on("afterTax"), "Yes");
  assert.equal(page.head("p-ana"), "$56,730 if allowed", "one yes: still if allowed");
  page.tap("afterTaxToRoth", "Yes");
  assert.deepEqual(page.notices().filter(([k]) => k === "ok"), [["ok", "Saved. Ana could put up to $56,730 more into the plan after tax this year and move it to Roth."]]);
  assert.equal(page.status("aftertax"), "2 set by you");
  assert.equal(page.head("p-ana"), "$56,730 of room", "two yeses: the room");
  page.tap("afterTaxToRoth", "No");
  assert.deepEqual(page.notices().filter(([k]) => k === "ok"), [["ok", "Saved. Ana's plan cannot move after-tax money to Roth while Ana works, so this way into Roth is closed."]]);
  // review o1 P1: a closed way shows no figure beside the closed sentence
  assert.equal(page.head("p-ana"), "Closed");
  assert.ok(page.body("aftertax").includes("After-tax money left in the plan grows, and the growth is taxed as pay when it comes out."));
  // No to the first question: the second goes, the way is closed
  page.tap("afterTax", "No");
  assert.deepEqual(page.notices().filter(([k]) => k === "ok"), [["ok", "Saved. Ana's plan does not take after-tax money, so this way into Roth is closed."]]);
  assert.equal(page.chips("afterTaxToRoth").length, 0);
  assert.equal(page.head("p-ana"), "Closed");
  // Not sure takes the answers back off the plan
  page.tap("afterTax", "Not sure");
  assert.deepEqual(page.plan().retirement.workPlans, { "p-ana": { afterTaxToRoth: false } });
  // a chip already on does nothing
  const n = page.saves; page.tap("afterTax", "Not sure"); assert.equal(page.saves, n);
  // a later visit: nothing pending, the part shut again, saying what is set
  await fresh();
  const again = await livePage(page.plan());
  assert.equal(again.open().aftertax, false); assert.equal(again.status("aftertax"), "1 set by you");
  assert.deepEqual(again.notices().filter(([k]) => k === "ok"), []);
});

test("S11: after a save only the saved part changes: a tap opens After-tax money into Roth on the redraw, and no other part opens or shuts", async () => {
  await fresh();
  const page = await livePage(await familyOf());
  assert.deepEqual(page.open(), { aftertax: false });
  page.tap("afterTax", "Yes");
  assert.deepEqual(page.open(), { aftertax: true }, "the saved part stays open (R17)");
  // the next draw that is not after a save draws it as the page does
  page.draw();
  assert.deepEqual(page.open(), { aftertax: false });
});

test("the page for an unnamed first adult says you and your; a full plan shows no questions; two adults at work each have their row", async () => {
  await fresh();
  const p = withPlan({ a: { pay: 200000, k401: 24500, match: 47500 } }); p.household.people[0].name = "Me";
  const full = await livePage(p);
  assert.equal(full.status("aftertax"), "no room left");
  assert.ok(full.body("aftertax").includes("Your work plan is already at its $72,000 limit for 2026, so no after-tax money fits this year."));
  assert.equal(full.chips("afterTax").length, 0);
  const two = await livePage(withPlan({ status: "married_joint", a: { pay: 150000, k401: 10000 }, b: { pay: 90000, k401: 5000, match: 2000 } }));
  assert.equal(two.status("aftertax"), "$127,000 if allowed");
  assert.equal(two.chips("afterTax").length, 2);
  two.tap("afterTax", "No", 1);
  assert.deepEqual(two.plan().retirement.workPlans, { b: { afterTax: false } });
  assert.equal(two.notices().filter(([k]) => k === "ok")[0][1], "Saved. Ben's plan does not take after-tax money, so this way into Roth is closed.");
  // both closed: "not possible"
  two.tap("afterTax", "No", 0);
  assert.equal(two.status("aftertax"), "2 set by you");
  await fresh();
  const q = two.plan(); const shut = await livePage(q);
  assert.equal(shut.status("aftertax"), "2 set by you");
  const none = structuredClone(q); none.retirement.workPlans = { a: { afterTaxToRoth: false }, b: { afterTaxToRoth: false } };
  const r = afterTaxRoom(none, { today: T13 }); assert.equal(r.total, 0); assert.deepEqual(r.people.map((x) => x.verdict), ["stuck", "stuck"]);
});

test("review o1 F4 and P1: no pay on file says the full limit is used and leads to the Income page; the status and headings fit and say 'if allowed' until both answers are yes", async () => {
  await fresh();
  const { roomSays } = await import("./view.js");
  // 5,000 into her 401(k), no income row: the room is worked from the dollar limit, and the screen says why
  const page = await livePage(withPlan({ a: { k401: 5000 } }));
  assert.equal(page.status("aftertax"), "$67,000 if allowed");
  const body = page.body("aftertax");
  assert.ok(body.includes("Ana's pay is not on the Income page, so this uses the full $72,000. If Ana earns less than that, the limit is all of Ana's pay."), body);
  const to = page.part("aftertax").all().filter((e) => e.tagName === "A" && e.getAttribute("href") === "#/cashflow/income");
  assert.equal(to.length, 1); assert.equal(textOf_(to[0]), "Add pay on the Income page ›"); assert.equal(to[0].style.minHeight, "44px");
  // with pay added, neither the sentence nor the way to the Income page
  const paid = await livePage(withPlan({ a: { pay: 60000, k401: 5000 } }));
  assert.ok(!paid.body("aftertax").includes("not on the Income page"));
  // the status stays one short line (more.js STATUS_MAX) for up to three adults at the whole limit
  const { STATUS_MAX } = await import("../../../core/ui/more.js");
  const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
  for (const n of [56730, 144000, 216000]) for (const v of [["ask"], ["ok"], ["ok", "ask"]]) assert.ok(roomSays(money, n, v).length <= STATUS_MAX, roomSays(money, n, v));
  assert.equal(roomSays(money, 56730, ["ok", "ok"]), "$56,730 of room"); assert.equal(roomSays(money, 56730, ["ok", "ask"]), "$56,730 if allowed");
});

// ---------------------------------------------------------------- invariance (gap spec 3.5)
// With the new fields absent, every figure this page and Retirement contributions (whose data file gained annualAdditions)
// worked out before is byte-identical: compute() of both over every qa/fixtures plan builder, the empty plan, and the
// 1,400 qa/households plans (one digest per household type over its plans, in catalog order). The digests were taken at
// 461df76 (before gap next-60 #28) with today = 2026-11-13; letters stand for the digits (the leak guard refuses long digit
// runs). Refresh them only for a deliberate change: LIMITS_DIGESTS=print node --test <this file>.
const BEFORE_28 = {
  fixtures: {
    "card-gap-plan.mjs:cardGapPlan": "djkpniagakngklgo", "debt-plan.mjs:debtPlan": "oiphpfpapphmcjoa", "family-plan.mjs:familyPlan": "djkpniagakngklgo",
    "guessed-plan.mjs:guessedPlan": "ebdnmflomhjfodhp", "held-plan.mjs:heldPlan": "djkpniagakngklgo", "investments-plan.mjs:investmentsPlan": "fbhjleldoeaoklkg",
    "renter-debt-plan.mjs:renterDebtPlan": "mjfpjkifllbdocph", "renter-debt-plan.mjs:renterPayingExtraPlan": "mjfpjkifllbdocph",
    "retired-couple-plan.mjs:retiredCouplePlan": "eiinnoepggaeephj", "retirement-plan.mjs:retirementPlan": "ckbahppmhfdodfhf", "sample-plan.mjs:samplePlan": "nhkdhblgdknajlom",
    "tax-plan.mjs:taxPlan": "lcemdkkdpgefljnf", "widow-plan.mjs:widowPlan": "cgnfehcbndlcobjk", empty: "nhkdhblgdknajlom",
  },
  households: {
    "01-single-adult": "hbjbchjbpnalfopf", "02-couple-no-kids": "lmdckdlfaajgidkc", "03-single-parent": "ghalmecaehdchkpl", "04-two-parents": "eaknjkghdanfnfol",
    "05-stay-at-home-parent": "mggaoonfnegghdkg", "06-blended-family": "jmfonfdapmchhjno", "07-multigenerational": "cacefhajhnndmfae", "08-retired": "iplmdmcnckapfhjh",
    "09-near-retirement": "knjnlcodcpcbdekn", "10-student-and-starter": "kgcccbidldbfhdhe", "11-self-employed": "ekjbhpclekgkjjml", "12-high-net-worth": "hdolhcmnjabkgolh",
    "13-in-crisis": "pbcodoloifbaeofc", "14-unusual-structures": "cnkmlbecnglfloin",
  },
};
test("invariance: with no after-tax answers, compute() here and on Retirement contributions is byte-identical to 461df76 (fixtures, households, empty plan)", async () => {
  const fs = await import("node:fs");
  const { createHash } = await import("node:crypto");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { compute: contributions } = await import("../../retirement/contributions/compute.js");
  const { ARCHETYPES, COMMON_PACKS, SPECIAL_PACKS } = await import("../../../qa/households/lib/catalog.mjs");
  const letters = (hex) => hex.replace(/[0-9]/g, (d) => "ghijklmnop"[d]);
  const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
  const both = (plan) => { const q = migrate(structuredClone(plan)); return JSON.stringify([compute(q, { today: T13 }), contributions(q, { today: T13 })]); };
  const now = { fixtures: {}, households: {} };
  const dir = new URL("../../../qa/fixtures/", import.meta.url);
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(new URL(f, dir).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) now.fixtures[`${f}:${name}`] = letters(sha(both(fn())));
  }
  now.fixtures.empty = letters(sha(both(emptyPlan())));
  for (const a of ARCHETYPES) {
    const list = [sha(both(a.build()))];
    for (const [, vs] of Object.entries({ ...COMMON_PACKS, special: SPECIAL_PACKS[a.id] ?? [] })) for (const v of vs) { const p = structuredClone(a.build()); v.apply(p); list.push(sha(both(p))); }
    now.households[a.id] = letters(sha(list.join(",")));
  }
  if (process.env.LIMITS_DIGESTS === "print") console.log(JSON.stringify(now, null, 1));
  for (const [k, v] of Object.entries(BEFORE_28.fixtures)) assert.equal(now.fixtures[k], v, `fixture ${k}: a figure moved`);
  for (const [k, v] of Object.entries(BEFORE_28.households)) assert.equal(now.households[k], v, `households ${k}: a figure moved`);
});

test("invariance: the two answers change no page's figures: with both saved for every adult, every page's compute() is byte-identical (fixtures: every page; households: the groups whose pages read workPlans); no other file reads them", async () => {
  const { default: REGISTRY } = await import("../../registry.js");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const mods = (await Promise.all(REGISTRY.map(async (e) => (await e.load()).default))).filter((m) => !m.placeholder && !m.heavy);
  const answered = (plan, a, b) => { const q = structuredClone(plan); for (const p of (q.household?.people ?? []).filter((x) => x.role !== "dependent")) { setAfterTaxAnswer(q, p.id, "afterTax", a); setAfterTaxAnswer(q, p.id, "afterTaxToRoth", b); } return q; };
  // Diagnostics and Settings measure the plan file's size, and Export writes the plan out: a longer plan is a bigger file
  const out = (m, q) => { try { const r = m.compute(q, { today: T13 }); if (["diagnostics", "settings"].includes(m.id) && r) { delete r.size; delete r.sizeKB; } return JSON.stringify(r); } catch (e) { return `THROW ${e.message}`; } };
  const fixtures = [investmentsPlan(), familyPlan(T13), renterDebtPlan(), retiredCouplePlan(), emptyPlan()];
  // the groups with a page that reads retirement.workPlans (Next best action, our guesses, Get started, the document reader,
  // People, the scenarios, Benefits, the retirement levers, Retirement contributions) and this page's own
  const near = mods.filter((m) => ["retirement", "investments", "overview", "career", "scenarios", "household", "ai"].includes(m.group));
  let n = 0;
  // yes to one, no to the other: both keys written, an entry made where there was none
  for (const plan of fixtures) {
    const a = migrate(structuredClone(plan)), q = answered(a, "yes", "no");
    for (const m of mods.filter((x) => !(x.group === "reports" && x.id === "export"))) { assert.equal(out(m, q), out(m, a), `${m.group}/${m.id}`); n++; }
  }
  for (const plan of ARCHETYPES.map((a) => a.build())) {
    const a = migrate(structuredClone(plan)), q = answered(a, "yes", "no");
    for (const m of near) { assert.equal(out(m, q), out(m, a), `${m.group}/${m.id}`); n++; }
  }
  assert.ok(n > 900, `${n} page drawings compared`);
  // and no code outside this page reads the new fields
  const fs = await import("node:fs"); const path = await import("node:path"); const { fileURLToPath } = await import("node:url");
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : /\.m?js$/.test(e.name) ? [path.join(d, e.name)] : []));
  const readers = [...walk(path.join(ROOT, "modules")), ...walk(path.join(ROOT, "core")), ...walk(path.join(ROOT, "server"))]
    .filter((f) => !f.includes(`${path.sep}investments${path.sep}limits${path.sep}`) && /afterTaxToRoth|workPlans[^\n]*\.afterTax\b/.test(fs.readFileSync(f, "utf8")));
  assert.deepEqual(readers, []);
  // the 415(c) figure added to Retirement contributions' data file is read here only
  const rel = (f) => path.relative(ROOT, f).split(path.sep).join("/");
  const added = [...walk(path.join(ROOT, "modules")), ...walk(path.join(ROOT, "core"))].filter((f) => /\bannualAdditions\b/.test(fs.readFileSync(f, "utf8"))).map(rel).filter((f) => !f.endsWith(".test.mjs"));
  assert.deepEqual(added.sort(), ["modules/investments/limits/compute.js", "modules/retirement/contributions/data/limits.js"]);
});

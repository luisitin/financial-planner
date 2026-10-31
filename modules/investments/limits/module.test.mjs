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
  assert.deepEqual(compute(named, { today: "2026-10-31" }).roth.people.map((r) => r.magi), [90000 + 700, 7200 + 7200 + 700]);
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

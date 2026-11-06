// The full checks for this page are in tests/tax-pages.test.mjs (fixture qa/fixtures/tax-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { taxPlan } from "../../../qa/fixtures/tax-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("brackets: runs on the tax fixture and on an empty plan", () => {
  const d = compute(taxPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

test("brackets: filing separately, the ladder is the return of the adult marked Me, and more income lands on it", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan("2026-10-30"); p.household.filingStatus = "married_separate";
  const d = compute(p, { today: "2026-10-30", extra: 10000 });
  assert.equal(d.whose, "Ana"); assert.equal(d.separate.length, 2);
  const ana = d.separate.find((x) => x.shown);
  assert.equal(ana.name, "Ana"); assert.equal(d.taxableIncome, ana.taxableIncome);
  assert.equal(d.ladder.reduce((s, l) => s + l.filled, 0), d.ordinaryTaxable);   // one return's ladder fills to its own taxable income
  assert.ok(Math.abs(d.totalTax - d.separate.reduce((s, x) => s + x.totalTax, 0)) < 0.011);   // the household's tax is both
  assert.ok(d.extra.taxableIncome - ana.taxableIncome > 9999);   // the extra 10,000 is on Ana's return
  p.household.filingStatus = "married_joint";
  assert.equal(compute(p, { today: "2026-10-30" }).separate, null);
});

test("Review 2026-11-06: credits more than the tax read as no tax and credits back, never a negative rate (\"overall you pay -5.7%\")", async () => {
  // Jo, head of household, 30,000 of pay, one child, 900 a month of care: 585 of income tax, the care credit takes it all,
  // and 1,700 of the child tax credit is refundable: the tax is -1,700 and the rate -5.7%
  const p = emptyPlan(); p.household.filingStatus = "head_of_household"; p.household.state = "OH";
  p.household.people = [{ id: "jo", name: "Jo", role: "self", birthDate: "1993-03-15" }, { id: "kid", name: "Kit", role: "dependent", birthDate: "2022-07-15" }];
  p.income = [{ id: "pay", name: "Jo's pay", type: "salary", personId: "jo", amount: 30000, period: "annual", growth: 0, taxable: true }];
  p.expenses = [{ id: "care", name: "Daycare", category: "childcare", amount: 900, period: "monthly" }];
  const NOV = "2026-11-02";
  assert.equal(compute(p, { today: NOV }).totalTax, -1700);
  const { render } = await import("./view.js");
  const fmt = await import("../../../core/format.js");
  const node = (tag, kids = []) => { const x = { tag, kids: [], style: {}, append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) x.kids.push(c); }, prepend(...k) { x.append(...k); }, remove() {}, replaceChildren() { x.kids = []; }, querySelector() { return null; }, addEventListener() {}, setAttribute() {}, get textContent() { return x.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } }; x.append(...kids); return x; };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  const base = { h: (tag, a, ...k) => node(tag, isAttrs(a) ? k : [a, ...k]), card: (t, ...k) => node("card", [t, ...k]), row: (...k) => node("row", k), stat: (l, v, s) => node("stat", [l, v, s]) };
  const ui = new Proxy(base, { get: (t, k) => t[k] ?? ((...a) => node(String(k), a.filter((x) => typeof x !== "object" || x === null || Array.isArray(x) || "kids" in x))) });
  const root = node("root");
  render(root, { ui, fmt: { ...fmt, today: () => NOV }, plan: p, store: { update() {} } });
  const text = root.textContent.replace(/\s+/g, " ");
  assert.ok(text.includes("the credits are more than the tax, so you pay no federal income tax and about $1,700 of credits come back"), text.slice(0, 500));
  assert.ok(!/-\d+(\.\d)?%/.test(text), "no negative rate");
});

// --- Review 2026-11-06 (follow-up to the verifier) ---------------------------------------------------------------------------
test("Review 2026-11-06: a 0% next dollar is not 'covers part of the tax'; the child care credit is named only when it covers the tax alone", async () => {
  // Jo (head of household, one child, 900 a month of care) at 30,000: 585 of income tax, the care credit (44% of 3,000) held to
  // it. Lee at 45,000 with two children and 10,800 of care: 2,148 of tax, 2,100 of care credit, the child tax credit the rest.
  // Both pay 0 on the next dollar; the stat said "the child care credit covers part of the tax on more pay"
  const parent = (amount, fn) => {
    const p = emptyPlan(); p.household.filingStatus = "head_of_household"; p.household.state = "OH";
    p.household.people = [{ id: "jo", name: "Jo", role: "self", birthDate: "1993-03-15" }, { id: "kid", name: "Kit", role: "dependent", birthDate: "2022-07-15" }];
    p.income = [{ id: "pay", name: "Jo's pay", type: "salary", personId: "jo", amount, period: "annual", growth: 0, taxable: true }];
    p.expenses = [{ id: "care", name: "Daycare", category: "childcare", amount: 900, period: "monthly" }];
    if (fn) fn(p);
    return p;
  };
  const lee = parent(45000, (p) => {
    p.household.people.push({ id: "kid2", name: "Ned", role: "dependent", birthDate: "2018-06-01" });
    p.expenses[0].amount = 600; p.expenses.push({ id: "as", name: "After-school care", category: "childcare", amount: 300, period: "monthly" });
  });
  const NOV = "2026-11-06";
  const { render } = await import("./view.js");
  const fmt = await import("../../../core/format.js");
  const node = (tag, kids = []) => { const x = { tag, kids: [], style: {}, append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) x.kids.push(c); }, prepend(...k) { x.append(...k); }, remove() {}, replaceChildren() { x.kids = []; }, querySelector() { return null; }, addEventListener() {}, setAttribute() {}, get textContent() { return x.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } }; x.append(...kids); return x; };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  const base = { h: (tag, a, ...k) => node(tag, isAttrs(a) ? k : [a, ...k]), card: (t, ...k) => node("card", [t, ...k]), row: (...k) => node("row", k), stat: (l, v, s) => node("stat", [l, v, s]) };
  const ui = new Proxy(base, { get: (t, k) => t[k] ?? ((...a) => node(String(k), a.filter((x) => typeof x !== "object" || x === null || Array.isArray(x) || "kids" in x))) });
  const page = (p) => { const root = node("root"); render(root, { ui, fmt: { ...fmt, today: () => NOV }, plan: p, store: { update() {} } }); return root.textContent.replace(/\s+/g, " "); };
  for (const p of [parent(30000), lee]) { const d = compute(p, { today: NOV }); assert.ok(Math.abs(d.marginal) < 0.005 && d.careMoves); }
  const jo = page(parent(30000)), le = page(lee);
  assert.ok(!jo.includes("covers part of") && jo.includes("Next dollar 0% less than the bracket: the child care credit covers the tax on more pay"), jo.slice(0, 900));
  assert.ok(!le.includes("covers part of") && le.includes("Next dollar 0% less than the bracket: with the child care credit, the credits cover the tax on more pay"), le.slice(0, 900));
});

// --- Review 2026-11-06 (fix round 6) --------------------------------------------------------------------------------------
/** A household with child care (the verifier's random households): `fs`, `kids` under 13, pay for A (and B), daycare a month, a child care account on A. */
function careHousehold({ fs, kids, pa, pb = 0, care, acct = 0 }) {
  const p = emptyPlan(); p.household.filingStatus = fs; p.household.state = "TX";
  p.household.people = [{ id: "a", name: "A", role: "self", birthDate: "1988-01-01" }];
  if (fs === "married_joint") p.household.people.push({ id: "b", name: "B", role: "partner", birthDate: "1989-01-01" });
  for (let k = 0; k < kids; k++) p.household.people.push({ id: `k${k}`, name: `K${k}`, role: "dependent", birthDate: `${2015 + k * 3}-05-01` });
  p.income = [{ id: "i0", name: "pay", type: "salary", personId: "a", amount: pa, period: "annual", growth: 0, taxable: true }];
  if (pb) p.income.push({ id: "i1", name: "pay", type: "salary", personId: "b", amount: pb, period: "annual", growth: 0, taxable: true });
  p.expenses = [{ id: "c", name: "Daycare", category: "childcare", amount: care, period: "monthly" }];
  if (acct) p.whatIfs = { benefits: { a: { dcfsaElect: acct, planYear: 2026 } } };
  return p;
}

test("Review 2026-11-06: Brackets and the Federal estimate use one threshold for 'the child care credit moves the next dollar'", async () => {
  const { compute: federal, careMovesNextDollar, CARE_MOVES_BY } = await import("../federal/compute.js");
  // the verifier's household 584 (below): the two pages must give one answer
  { const q = careHousehold({ fs: "married_joint", kids: 3, pa: 124720, pb: 77369, care: 2000, acct: 5000 });
    assert.equal(compute(q, { today: "2026-11-06" }).careMoves, federal(q, { today: "2026-11-06" }).careSets !== null, "Brackets and the Federal estimate disagree"); }
  // the rule: half a cent or more against the cost without the credit, to the billionth (12.5 cents shows as 13)
  assert.equal(CARE_MOVES_BY, 0.005);
  assert.equal(careMovesNextDollar(0.2225, 0.22), false, "a quarter of a cent: the bracket is the reason");
  assert.equal(careMovesNextDollar(0.125, 0.12), true, "half a cent: 13 cents shown against the 12% bracket");
  assert.equal(careMovesNextDollar(0.1 + 0.005, 0.1), true, "floating-point noise below half a cent does not decide it");
  assert.equal(careMovesNextDollar(0.12 + 0.0049999, 0.12), false);
  assert.equal(careMovesNextDollar(0, 0.0041), false); assert.equal(careMovesNextDollar(0, 0.12), true);
  // the verifier's random household 584: joint, 124,720 + 77,369, three children, 2,000 a month of daycare, a 5,000 account.
  // The next dollar is 22.25 cents against 22 without the credit: Brackets said the credit moves it (0.0005), the Federal
  // estimate said not (0.005)
  const p584 = careHousehold({ fs: "married_joint", kids: 3, pa: 124720, pb: 77369, care: 2000, acct: 5000 });
  const f584 = federal(p584, { today: "2026-11-06" }), b584 = compute(p584, { today: "2026-11-06" });
  assert.ok(Math.abs(f584.nextDollar - 0.2225) < 1e-9 && Math.abs(f584.nextDollarNoCare - 0.22) < 1e-9, `${f584.nextDollar} ${f584.nextDollarNoCare}`);
  assert.equal(f584.careSets, null); assert.equal(b584.careMoves, false, "the same answer as the Federal estimate");
  // household 740: head of household, 44,586, two children, 1,400 a month, a 5,000 account: 10.5 cents against 10 (shown
  // as 11 against the 10% bracket). Both pages now say the credit getting smaller is the reason
  const p740 = careHousehold({ fs: "head_of_household", kids: 2, pa: 44586, care: 1400, acct: 5000 });
  const f740 = federal(p740, { today: "2026-11-06" }), b740 = compute(p740, { today: "2026-11-06" });
  assert.ok(Math.abs(f740.nextDollar - 0.105) < 1e-9 && Math.abs(f740.nextDollarNoCare - 0.1) < 1e-9, `${f740.nextDollar} ${f740.nextDollarNoCare}`);
  assert.equal(f740.careSets, "falls"); assert.equal(b740.careMoves, true);
  // on 300 random households with child care (a Park and Miller generator) the two pages always agree
  const M = 2 ** 31 - 1; let seed = 7; const rnd = () => (seed = (seed * 16807) % M) / M; const pick = (a) => a[Math.floor(rnd() * a.length)];
  for (let i = 0; i < 300; i++) {
    const fs = pick(["married_joint", "head_of_household", "single"]);
    const p = careHousehold({ fs, kids: 1 + Math.floor(rnd() * 3), pa: Math.round(15000 + rnd() * 250000), pb: fs === "married_joint" && rnd() > 0.2 ? Math.round(rnd() * 120000) : 0, care: pick([200, 500, 900, 1400, 2000]), acct: rnd() < 0.3 ? pick([2000, 5000, 7500]) : 0 });
    const f = federal(p, { today: "2026-11-06" }), b = compute(p, { today: "2026-11-06" });
    assert.equal(b.careMoves, f.careSets !== null, `household ${i}: ${f.nextDollar} vs ${f.nextDollarNoCare}`);
  }
});

test("round 8 review 3: Bracket explorer is the Federal estimate's return (the business at its profit, this year's withdrawal, stock pay)", async () => {
  const { widowPlan, freelancerPlan, equityPlan } = await import("../../../qa/fixtures/round8-households.mjs");
  const { known } = await import("../federal/known.js");
  const T = "2026-11-06";
  const f = compute(freelancerPlan(), { today: T, extra: 10000 }), kf = known(freelancerPlan(), { today: T });
  assert.equal(f.bracketRate, 0.12); assert.ok(Math.abs(f.taxableIncome - 42711.58) < 0.05);
  assert.equal(f.totalTax, kf.total); assert.equal(f.effectiveRate, kf.rate); assert.equal(f.marginal, kf.nextDollar);
  const w = compute(widowPlan(), { today: T });
  assert.equal(w.bracketRate, 0.12); assert.ok(Math.abs(w.ladder.reduce((t, x) => t + x.tax, 0) - 3964.52) < 0.05);
  assert.ok(Math.abs(w.effectiveRate - 3964.52 / 66478) < 1e-4, String(w.effectiveRate));
  // 10,000 more for the stock couple stays in the 24% bracket (it said 22%)
  const e = compute(equityPlan(), { today: T, extra: 10000 });
  assert.equal(e.bracketRate, 0.24); assert.equal(e.extra.bracketRate, 0.24);
});

test("round 8 fix: the Deductions tile names the business deduction, so income less the deductions is the ladder's taxable income", async () => {
  const { freelancerPlan, widowPlan } = await import("../../../qa/fixtures/round8-households.mjs");
  const { known } = await import("../federal/known.js");
  const T = "2026-11-06";
  const f = compute(freelancerPlan(), { today: T }), kf = known(freelancerPlan(), { today: T });
  // 78,000 of profit; SE tax 78,000 x 0.9235 x 0.153 = 11,021.05; less 8,510.52 of adjustments (half of it, 5,510.52, and
  // the IRA 3,000) = AGI 69,489.48; less the standard 16,100 and the business deduction 10,677.90 (20% of the taxable
  // income before it, 53,389.48, which is less than 20% of the profit after half the SE tax) = 42,711.58
  assert.equal(f.deduction, 16100);
  assert.ok(Math.abs(f.businessDeduction - 10677.90) < 0.01, String(f.businessDeduction));
  assert.ok(Math.abs(kf.result.agi - f.deduction - f.businessDeduction - f.taxableIncome) < 0.01);
  // the business deduction is held to 20% of taxable income, so one more dollar of other income adds 80 cents of taxable
  // income: 12% x 0.8 = 9.6% (the tile says the deduction grows with it instead of "what it really costs")
  assert.ok(Math.abs(f.marginal - 0.096) < 1e-9, String(f.marginal)); assert.equal(f.bracketRate, 0.12);
  // no business: nothing extra
  assert.equal(compute(widowPlan(), { today: T }).businessDeduction, 0);
});

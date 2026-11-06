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

// The full checks for this page are in tests/retirement-pages.test.mjs (fixture qa/fixtures/retirement-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { retirementPlan } from "../../../qa/fixtures/retirement-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("rmd: runs on the sample couple and on an empty plan", () => {
  const d = compute(retirementPlan(), { today: "2026-09-16", paths: 200, quick: true });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16", paths: 200, quick: true }));
});

// ---- this year's withdrawal: amount, accounts, deadline, taken (round 4, 2026-11-02)
import { thisYear, markTaken } from "./compute.js";
import { emptyPlan as blank } from "../../../core/schema/migrate.js";
const retirees = () => {
  const p = blank();
  p.household.people = [{ id: "r", name: "Ruth", role: "self", birthDate: "1950-03-10" }, { id: "s", name: "Sam", role: "partner", birthDate: "1953-06-20" }];
  p.accounts = [
    { id: "ira", name: "Ruth's IRA", type: "ira", balance: 310000, ownerId: "r", asOf: "2026-09-15", history: [] },
    { id: "k", name: "Sam's 401(k)", type: "401k", balance: 200000, ownerId: "s", history: [{ date: "2025-12-31", balance: 190000 }] },
    { id: "roth", name: "Sam's Roth", type: "roth", balance: 60000, ownerId: "s", history: [] },
  ];
  return p;
};
test("thisYear: the December 31 balance over the factor for the age reached; first year may wait to April 1; Roths have none", () => {
  const t = thisYear(retirees(), { today: "2026-11-02" });
  const ruth = t.people.find((x) => x.id === "r"), sam = t.people.find((x) => x.id === "s");
  assert.equal(ruth.age, 76); assert.equal(ruth.amount, Math.round(310000 / 23.7)); assert.equal(ruth.amount, 13080);
  assert.equal(ruth.estimated, true, "no balance near last December 31: today's, said as an estimate");
  assert.equal(ruth.deadline, "2026-12-31"); assert.equal(ruth.first, false);
  assert.equal(sam.first, true, "born 1953: 73 in 2026, the first year"); assert.equal(sam.deadline, "2027-04-01");
  assert.equal(sam.amount, Math.round(190000 / 26.5), "the December 31 point, not today's 200,000"); assert.equal(sam.estimated, false);
  assert.deepEqual(sam.accounts.map((a) => a.id), ["k"], "the Roth has no required withdrawal");
  assert.equal(t.total, 13080 + 7170);
  assert.deepEqual(thisYear(retirees(), { today: "2021-11-02" }).people, [], "before anyone's start year");
});
test("markTaken: I've taken it, and taken back", () => {
  const p = retirees();
  markTaken(p, 2026, "r", "2026-11-02");
  const t = thisYear(p, { today: "2026-11-02" });
  assert.equal(t.people.find((x) => x.id === "r").taken, "2026-11-02");
  assert.deepEqual(t.due.map((x) => x.id), ["s"]);
  markTaken(p, 2026, "r", null);
  assert.deepEqual(p.retirement.rmdTaken, {});
  assert.equal(thisYear(p, { today: "2026-11-02" }).due.length, 2);
});

// ---- round 8 (2026-11-06, widow-2): the tax a required withdrawal brings is what it adds to the year's federal tax ----------
// Ruth, 74, single: $22,800 pension, $27,600 Social Security, $16,078 required out of a $410,000 IRA (factor 25.5). By hand
// (IRS Rev. Proc. 2025-32 for 2026: $16,100 standard deduction, $2,050 more at 65 for a single filer, 10% to $12,400 and 12% to
// $50,400; IRC 151(d)(5)(C): $6,000 more at 65 through 2028, phasing out over $75,000; IRC 86: Social Security taxed over
// $25,000 / $34,000 of income plus half the benefit):
//   with it: income 22,800 + 16,078 = 38,878; half of Social Security 13,800, so 52,678 against 34,000: taxable Social Security
//            0.85 x 18,678 + 4,500 = 20,376.30; AGI 59,254.30; taxable 59,254.30 - 24,150 = 35,104.30;
//            tax 1,240 + 0.12 x 22,704.30 = 3,964.52
//   without: 22,800 + 13,800 = 36,600: 0.85 x 2,600 + 4,500 = 6,710; AGI 29,510; taxable 5,360; tax 536
//   so it adds 3,964.52 - 536 = 3,428.52: about $3,429 (round 8's $3,428 is the difference of the two rounded figures), not
//   the flat 15% of the plan's quick setting ($2,412)
import { widowPlan } from "../../../qa/fixtures/widow-plan.mjs";
import { migrate } from "../../../core/schema/migrate.js";
import { federalTax, paramsFor } from "../../../core/math/tax.js";
import { FEDERAL } from "../../taxes/federal/data/federal.js";
test("round 8 (widow-2): this year's required withdrawal adds about $3,429 of federal tax, the brackets' difference, not 15%", async () => {
  const today = "2026-11-06";
  const P = paramsFor(FEDERAL, 2026, { inflation: 0.03 });
  const tax = (ordinary) => federalTax({ filingStatus: "single", otherOrdinary: ordinary, socialSecurity: 27600, ages65plus: 1 }, P).totalTax;
  assert.ok(Math.abs(tax(22800 + 16078) - 3964.52) < 0.01 && Math.abs(tax(22800) - 536) < 0.01, "the hand figures");
  const { thisYearTax } = await import("./compute.js");
  const t = thisYearTax(migrate(widowPlan()), { today });
  assert.ok(Math.abs(t.total - 3428.52) < 0.01, String(t.total)); assert.ok(Math.abs(t.byPerson["p-ruth"] - 3428.52) < 0.01);
  assert.ok(Math.abs(t.total - (tax(22800 + 16078) - tax(22800))) < 0.01);
  // the schedule: each year's withdrawal priced the same way at that year's brackets (in today's dollars); the flat figures stay
  const d = compute(migrate(widowPlan()), { today });
  assert.ok(Math.abs(d.schedule[0].extraTax - (tax(22800 + d.schedule[0].rmd) - tax(22800))) < 0.01, String(d.schedule[0].extraTax));
  assert.ok(Math.abs(d.schedule[0].taxes - d.schedule[0].rmd * 0.15) < 1e-9, "the flat figure the answer key checks is unchanged");
  assert.ok(d.schedule.every((r) => r.extraTax > 0 && Math.abs(r.extraTaxReal - r.extraTax / (r.rmd / r.rmdReal)) < 1e-6));
  assert.ok(d.totalExtraTaxReal > d.totalTaxReal, "more than the flat 15% on this plan");
});
test("round 8 (widow-2 and widow-3): the page says what the withdrawal adds to the tax, and that conversions go on after it", async () => {
  const today = "2026-11-06";
  const { render } = await import("./view.js");
  const fmt = await import("../../../core/format.js");
  const node = (tag, kids) => { const x = { tag, kids: [], append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false && typeof c !== "function") x.kids.push(c); }, remove() {}, get textContent() { return x.kids.map((c) => (typeof c === "object" ? c.textContent ?? "" : String(c))).join(" "); }, style: {} }; x.append(...kids); return x; };
  const isNode = (a) => a && typeof a === "object" && "kids" in a;
  const ui = new Proxy({ h: (tag, attrs, ...k) => node(tag, attrs && typeof attrs === "object" && !Array.isArray(attrs) && !isNode(attrs) ? k : [attrs, ...k]), button: (label) => node("button", [label]) },
    { get: (t, k) => t[k] ?? ((...a) => node(String(k), a.filter((x) => x === null || typeof x !== "object" || Array.isArray(x) || isNode(x)))) });
  const root = node("root", []);
  render(root, { ui, fmt: { ...fmt, today: () => today }, plan: migrate(widowPlan()), store: { update() {} } });
  const text = root.textContent.replace(/\s+/g, " ");
  assert.ok(/adds about \$3,429 to your federal income tax for 2026/.test(text), text.slice(0, 900));
  assert.ok(!/Taxed at the plan's 15%/.test(text));
  assert.ok(/you can still move more to a Roth/.test(text), "conversions after the withdrawal");
});

// ---- round 8, Batch 5 reviews (2026-11-06) ------------------------------------------------------------------------------------
// Al and Bea (qa/fixtures/retiree-cases.mjs): 75, a $400,000 IRA, a $20,000 pension and $30,000 of Social Security each.
// Filing separately each spouse has their own return (IRS Pub. 501): no Social Security base while living together (IRC 86(c)(1)(C)(ii),
// (c)(2)(C)), so 85% of the $30,000 is taxed either way; the standard deduction $16,100 + $1,650 at 65 (Rev. Proc. 2025-32); no senior
// deduction on a separate return (IRC 151(d)(5)(C)). This year's withdrawals are rounded to the dollar ($16,260 each):
//   with it:  20,000 + 16,260 + 25,500 = 61,760 of income, taxable 61,760 - 17,750 = 44,010, tax 1,240 + 12% x 31,610 = 5,033.20
//   without:  20,000 + 25,500 = 45,500, taxable 27,750, tax 1,240 + 12% x 15,350 = 3,082
// so each withdrawal adds 1,951.20, and the two 3,902.40 (the page said 3,577 each, 7,154: one return for two people).
import { separateCouple, youngerOwnerCouple } from "../../../qa/fixtures/retiree-cases.mjs";
function fakePage(plan, today = "2026-11-06") {
  const node = (tag, kids) => { const x = { tag, kids: [], append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false && typeof c !== "function") x.kids.push(c); }, remove() {}, get textContent() { return x.kids.map((c) => (typeof c === "object" ? c.textContent ?? "" : String(c))).join(" "); }, style: {} }; x.append(...kids); return x; };
  const isNode = (a) => a && typeof a === "object" && "kids" in a;
  const ui = new Proxy({ h: (tag, attrs, ...k) => node(tag, attrs && typeof attrs === "object" && !Array.isArray(attrs) && !isNode(attrs) ? k : [attrs, ...k]), button: (label) => node("button", [label]) },
    { get: (t, k) => t[k] ?? ((...a) => node(String(k), a.filter((x) => x === null || typeof x !== "object" || Array.isArray(x) || isNode(x)))) });
  return import("./view.js").then(async ({ render }) => {
    const fmt = await import("../../../core/format.js");
    const root = node("root", []);
    render(root, { ui, fmt: { ...fmt, today: () => today }, plan, store: { update() {} } });
    return root.textContent.replace(/\s+/g, " ");
  });
}
test("round 8 review D1: filing separately, each required withdrawal is priced on its owner's own return", async () => {
  const today = "2026-11-06";
  const { thisYearTax } = await import("./compute.js");
  const P = paramsFor(FEDERAL, 2026, { inflation: 0.03 });
  const own = (other) => federalTax({ filingStatus: "married_separate", otherOrdinary: other, socialSecurity: 30000, ages65plus: 1 }, P).totalTax;
  assert.ok(Math.abs(own(36260) - 5033.2) < 0.01 && Math.abs(own(20000) - 3082) < 0.01, "the hand figures");
  const t = thisYearTax(migrate(separateCouple()), { today });
  assert.ok(Math.abs(t.byPerson.a - 1951.2) < 0.01 && Math.abs(t.byPerson.b - 1951.2) < 0.01, JSON.stringify(t));
  assert.ok(Math.abs(t.total - 3902.4) < 0.01, String(t.total));
  // the schedule and How much to take out price the projection's own withdrawals (16,260.16 each) the same way: 3,902.44
  const d = compute(migrate(separateCouple()), { today });
  assert.ok(Math.abs(d.schedule[0].extraTax - 2 * (own(20000 + 400000 / 24.6) - own(20000))) < 0.01, String(d.schedule[0].extraTax));
  assert.ok(Math.abs(d.schedule[0].extraTax - 3902.44) < 0.01);
  const { firstYear } = await import("../withdrawal-strategy/compute.js");
  assert.ok(Math.abs(firstYear(migrate(separateCouple()), { today }).requiredTax - 3902.44) < 0.01);
  // living apart all year: the single base amounts for Social Security (IRC 86(c)(1)(C)(ii)), the rest as above
  const apart = migrate(separateCouple()); apart.taxes = { ...(apart.taxes ?? {}), livedApart: true };
  const PA = { ...P, ssTaxation: { ...P.ssTaxation, married_separate: P.ssTaxation.single } };
  const ownA = (other) => federalTax({ filingStatus: "married_separate", otherOrdinary: other, socialSecurity: 30000, ages65plus: 1 }, PA).totalTax;
  assert.ok(Math.abs(ownA(36260) - 4273.72) < 0.01 && Math.abs(ownA(20000) - 760) < 0.01, "by hand: 19,171 of the benefit taxed with it, 5,350 without");
  assert.ok(Math.abs(thisYearTax(apart, { today }).total - 2 * 3513.72) < 0.01);
  // the page: each card is that spouse's own figure
  const text = await fakePage(migrate(separateCouple()));
  assert.ok(/adds about \$1,951 to Al's federal income tax/.test(text) && /adds about \$1,951 to Bea's federal income tax/.test(text), text.slice(0, 1400));
});
test("round 8 review D4: filing jointly, the two cards add up to what the two withdrawals add together", async () => {
  const today = "2026-11-06";
  const { thisYearTax } = await import("./compute.js");
  const P = paramsFor(FEDERAL, 2026, { inflation: 0.03 });
  const joint = (other) => federalTax({ filingStatus: "married_joint", otherOrdinary: other, socialSecurity: 60000, ages65plus: 2 }, P).totalTax;
  const t = thisYearTax(migrate(separateCouple("married_joint")), { today });
  // the joint figure itself does not move: tax with both withdrawals less tax with neither
  assert.ok(Math.abs(t.total - (joint(40000 + 2 * 16260) - joint(40000))) < 0.01, String(t.total));
  // shared in proportion to each withdrawal (the first one pulls Social Security into tax, the second does not: last-in figures missed $485)
  assert.ok(Math.abs(t.byPerson.a + t.byPerson.b - t.total) < 0.01, JSON.stringify(t));
  assert.ok(Math.abs(t.byPerson.a - t.total / 2) < 0.01);
});
test("round 8 review D3: a couple whose pre-tax money belongs to the younger one does not read that withdrawals have started", async () => {
  const text = await fakePage(migrate(youngerOwnerCouple()));
  assert.ok(!/The required amount itself cannot be converted/.test(text), text);
  assert.ok(/before they start \(a Roth conversion\)/.test(text));
});
test("round 8 review D5 and UX 5: the hold-back is for the federal tax, the state is named where it taxes income, and it is not 'if you like'", async () => {
  const text = await fakePage(migrate(widowPlan()));
  assert.ok(/hold back about \$3,429 for the federal tax/.test(text), text.slice(0, 1600));
  assert.ok(!/if you like/.test(text));
  assert.ok(!/your state may tax it too/.test(text), "Florida has no income tax");
  const ga = migrate(widowPlan()); ga.household.state = "GA";
  assert.ok(/for the federal tax \(your state may tax it too\)/.test(await fakePage(ga)));
});
test("round 8 review UX 11: once taken, the card still says what it adds to the year's tax", async () => {
  const p = migrate(widowPlan());
  markTaken(p, 2026, "p-ruth", "2026-11-06");
  const text = await fakePage(p);
  assert.ok(/withdrawal is taken \(marked November 6, 2026\)/.test(text), text.slice(0, 900));
  assert.ok(/It adds about \$3,429 to your 2026 federal income tax/.test(text), text.slice(0, 900));
});
test("round 8 review (with D3): each year's withdrawal is shown at its owner's own age and factor", async () => {
  // Bea's IRA, Al ten years older: her first required withdrawal is in 2035 at 75 (factor 24.6), not "age 84, factor 16.8"
  const d = compute(migrate(youngerOwnerCouple()), { today: "2026-11-06" });
  assert.equal(d.schedule[0].year, 2035);
  assert.deepEqual(d.schedule[0].owners.map((o) => [o.name, o.age, o.factor]), [["Bea", 75, 24.6]]);
  assert.equal(d.schedule[0].age, 84, "the first adult's age, kept for the answer key");
  const text = await fakePage(migrate(youngerOwnerCouple()));
  assert.ok(/2035 · Bea, age 75 \$[\d,]+ factor 24\.6/.test(text) && /the IRS factor for Bea's age \(24\.6 at 75\)/.test(text), text);
  // both withdrawing: both ages and factors
  const both = await fakePage(migrate(separateCouple("married_joint")));
  assert.ok(/2026 · ages 75 \/ 75 \$[\d,]+ factors 24\.6 \/ 24\.6/.test(both), both);
});

// ---- verify (2026-11-06): this year's pay before retiring ---------------------------------------------------------------------
// Ann, 74 in 2026 (born 1952-02-01), single, Florida, retired June 30 from a $60,000-a-year job (the Income page's salary line
// ends 2026-06-30), $2,000 a month of Social Security already paid, a $400,000 IRA: this year's required withdrawal 400,000 / 25.5
// = 15,686 (rounded). The projection has her retired all of 2026 and holds no pay for her, so the page priced the withdrawal on
// Social Security alone and said nothing of tax (it adds $0 there). Her 2026 pay: 60,000 x 181 / 365 = 29,753.42 (January 1 to
// June 30). By hand (Rev. Proc. 2025-32: $16,100 + $2,050 at 65 unmarried, 10% to $12,400, 12% to $50,400; IRC 151(d)(5)(C):
// $6,000 at 65 under $75,000 of MAGI; IRC 86: $25,000 / $34,000, 85% at most):
//   with it:    29,753.42 + 15,686 = 45,439.42; + 12,000 (half the benefit) = 57,439.42, so 0.85 x 23,439.42 + 4,500 = 24,423.51,
//               capped at 0.85 x 24,000 = 20,400 taxed; AGI 65,839.42; taxable 65,839.42 - 24,150 = 41,689.42;
//               tax 1,240 + 12% x 29,289.42 = 4,754.73
//   without it: 29,753.42 + 12,000 = 41,753.42, so 0.85 x 7,753.42 + 4,500 = 11,090.41 taxed; AGI 40,843.83; taxable 16,693.83;
//               tax 1,240 + 12% x 4,293.83 = 1,755.26
// so it adds 2,999.47 this year.
import * as rmdCompute from "./compute.js";
const payThisYear = (...a) => rmdCompute.payThisYear(...a);
function retiredThisYear(endDate = "2026-06-30") {
  const p = emptyPlan();
  p.household.people.push({ id: "a", name: "Ann", role: "self", birthDate: "1952-02-01", retirementAge: 74, lifeExpectancy: null });
  p.household.filingStatus = "single"; p.household.state = "FL";
  p.accounts.push({ id: "c", name: "Checking", type: "checking", balance: 30000, asOf: "2026-11-06", ownerId: "" }, { id: "i", name: "Ann's IRA", type: "ira", balance: 400000, asOf: "2026-11-06", ownerId: "a" });
  p.income.push({ id: "w", name: "Ann's pay", type: "salary", personId: "a", amount: 60000, period: "annual", growth: 0, taxable: true, startDate: "", endDate },
    { id: "s", name: "Ann's Social Security", type: "social", personId: "a", amount: 2000, period: "monthly", growth: 0, taxable: true, startDate: "", endDate: "" });
  p.expenses.push({ id: "x", name: "Everything", category: "groceries", essential: true, period: "monthly", inflates: true, amount: 3000 });
  Object.assign(p.retirement, { taxMode: "flat", taxRate: 0.15, strategy: "fixed-real", withdrawalRate: 0.04, socialSecurity: {} });
  return migrate(p);
}
test("verify: a withdrawal this year is priced on top of the pay the first adult drew this year before retiring", async () => {
  const today = "2026-11-06";
  const { thisYearTax } = await import("./compute.js");
  const { firstYear } = await import("../withdrawal-strategy/compute.js");
  const p = retiredThisYear();
  const t = thisYearTax(p, { today });
  assert.ok(t && Math.abs(t.total - 2999.47) < 0.01, String(t?.total));
  assert.ok(Math.abs(payThisYear(p, today) - 60000 * 181 / 365) < 0.01, "January 1 to June 30");
  const d = compute(p, { today });
  assert.equal(d.schedule[0].year, 2026);
  assert.ok(Math.abs(d.schedule[0].extraTax - 2999.5) < 0.05, `this year's schedule row: ${d.schedule[0].extraTax}`);
  assert.ok(Math.abs(d.schedule[1].extraTax - compute(retiredThisYear("2025-12-31"), { today }).schedule[1].extraTax) < 1e-6, "later years: no pay");
  assert.ok(Math.abs(firstYear(p, { today }).requiredTax - 2999.5) < 0.05, "How much to take out says the same");
  // the page
  const text = await fakePage(p);
  assert.ok(/Taking it adds about \$2,999 to your federal income tax for 2026/.test(text) && /hold back about \$2,999 for the federal tax/.test(text), text.slice(0, 1400));
  // a job that ended last year, or a partner's pay (the projection's own income line), adds nothing here
  assert.equal(payThisYear(retiredThisYear("2025-12-31"), today), 0);
  const q = retiredThisYear("2025-12-31"); q.income[0].personId = "someone-else"; q.household.people.push({ id: "someone-else", name: "Bo", role: "partner", relation: "spouse", birthDate: "1960-01-01", retirementAge: 67, lifeExpectancy: null });
  q.income[0].endDate = "";
  assert.equal(payThisYear(q, today), 0, "the partner's pay is not the first adult's");
  const kid = retiredThisYear("2025-12-31"); kid.household.people.push({ id: "k", name: "Kim", role: "dependent", birthDate: "2010-06-01" });
  kid.income.push({ id: "kj", name: "Kim's summer job", type: "salary", personId: "k", amount: 600, period: "monthly", growth: 0, taxable: true });
  assert.equal(payThisYear(kid, today), 0, "a child's job is the child's");
  assert.equal(payThisYear(p, null), 0);
});

// The full checks for this page are in tests/retirement-pages.test.mjs (fixture qa/fixtures/retirement-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
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
  assert.ok(/It adds about \$3,429 to your 2026 federal tax: ask your bank or broker to hold that back when they send it\./.test(text), text.slice(0, 900));
  assert.ok(!/Taxed at the plan's 15%/.test(text));
  assert.ok(/you can still move more into an account you pay the tax on this year, then never have to take money out of/.test(text), "conversions after the withdrawal, the word explained in passing");
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
  assert.ok(/It adds about \$1,951 to Al's 2026 federal tax/.test(text) && /It adds about \$1,951 to Bea's 2026 federal tax/.test(text), text.slice(0, 1400));
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
test("follow-up 2026-11-07 (B): once taken, the January 15 fallback is a link to Estimated payments' hold-back where it applies", async () => {
  // spending $80,000 a year draws more than the required amount, so Estimated payments has a hold-back for the draw still to come
  const p = migrate(widowPlan()); p.retirement.spendingMonthly = 80000 / 12;
  markTaken(p, 2026, "p-ruth", "2026-11-06");
  const hb = (await import("../../taxes/estimated/compute.js")).compute(p, { today: "2026-11-06" }).holdBack;
  assert.ok(hb && hb.amount > 0, "the hold-back applies");
  const text = await fakePage(p);
  assert.ok(/If none was held back, Estimated payments shows how much to have held back from a withdrawal still to come\./.test(text), text.slice(0, 900));
  assert.ok(!/send that to the IRS by January 15/.test(text), "the date fallback is gone where the hold-back applies");
  // the module's own source links it to that page
  assert.ok(/href: "#\/taxes\/estimated"/.test(fs.readFileSync(fileURLToPath(new URL("./view.js", import.meta.url)), "utf8")));
});
test("round 8 review D3: a couple whose pre-tax money belongs to the younger one does not read that withdrawals have started", async () => {
  const text = await fakePage(migrate(youngerOwnerCouple()));
  assert.ok(!/The required amount itself cannot be converted/.test(text), text);
  assert.ok(/Moving some into an account you pay the tax on now, and never have to take money out of, makes them smaller before they start/.test(text), text);
});
test("round 8 review D5 and UX 5: the hold-back is for the federal tax, the state is named where it taxes income, and it is not 'if you like'", async () => {
  const text = await fakePage(migrate(widowPlan()));
  assert.ok(/It adds about \$3,429 to your 2026 federal tax: ask your bank or broker to hold that back/.test(text), text.slice(0, 1600));
  assert.ok(!/if you like/.test(text));
  assert.ok(!/state may tax it too/i.test(text), "Florida has no income tax");
  const ga = migrate(widowPlan()); ga.household.state = "GA";
  assert.ok(/to hold that back when they send it\. Your state may tax it too\./.test(await fakePage(ga)));
});
test("round 8 review UX 11: once taken, the card still says what it adds to the year's tax", async () => {
  const p = migrate(widowPlan());
  markTaken(p, 2026, "p-ruth", "2026-11-06");
  const text = await fakePage(p);
  assert.ok(/Marked as taken on November 6, 2026\./.test(text), text.slice(0, 900));
  // batch 5b UX review 2 said the date itself because Estimated payments did not count the withdrawal; Batch 1 has landed, so (follow-up
  // 2026-11-07) the card keeps the date and adds the link where Estimated payments has payments to make
  assert.ok(/It adds about \$3,429 to your 2026 federal tax\. If none was held back, send that to the IRS by January 15, 2027 \(irs\.gov\/payments\)\. Estimated payments has the amounts by quarter\./.test(text), text.slice(0, 900));
});
test("round 8 review (with D3): each year's withdrawal is shown at its owner's own age and factor", async () => {
  // Bea's IRA, Al ten years older: her first required withdrawal is in 2035 at 75 (factor 24.6), not "age 84, factor 16.8"
  const d = compute(migrate(youngerOwnerCouple()), { today: "2026-11-06" });
  assert.equal(d.schedule[0].year, 2035);
  assert.deepEqual(d.schedule[0].owners.map((o) => [o.name, o.age, o.factor]), [["Bea", 75, 24.6]]);
  assert.equal(d.schedule[0].age, 84, "the first adult's age, kept for the answer key");
  const text = await fakePage(migrate(youngerOwnerCouple()));
  assert.ok(/2035 · Bea, 75 \$[\d,]+ The balance divided by 24\.6, the IRS figure at 75/.test(text), text);
  // both withdrawing: both ages and factors
  const both = await fakePage(migrate(separateCouple("married_joint")));
  assert.ok(/2026 · Al and Bea, 75 and 75 \$[\d,]+ Each balance divided by the IRS figure for its owner's age \(24\.6 at 75, 24\.6 at 75\)/.test(both), both);
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
  assert.ok(/It adds about \$2,999 to your 2026 federal tax: ask your bank or broker to hold that back when they send it\./.test(text), text.slice(0, 1400));
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

// path part 3: the first screen says things in plain words (the path walk's banned-word check, qa/flows/path-walk.js, runs it in the browser)
test("part 3: plain words on the first screen: no hard word in this page's view or compute strings", () => {
  const strip = (t) => t.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[^]*?\*\//g, "");
  const view = strip(fs.readFileSync(fileURLToPath(new URL("./view.js", import.meta.url)), "utf8"));
  // (batch 5b's page has no balance tile, so "Not taxed yet, today" is gone with it; its first screen names the accounts instead)
  for (const w of ["you haven't paid tax on yet"]) assert.ok(view.includes(w), w);
  for (const w of ['pre-tax accounts', 'Pre-tax money today', 'Net worth page']) assert.ok(!view.includes(w), w);
});

// review fix: the Roth sentence and the IRS source line stay on the page when no account is on file (they sit under the notice)
test("part 3 review: the Roth sentence and the source line show in the none-on-file state and in the fold", () => {
  const view = fs.readFileSync(fileURLToPath(new URL("./view.js", import.meta.url)), "utf8");
  assert.match(view, /const ROTH_SOURCE = "Rules from IRS Publication 590-B and the SECURE 2\.0 Act\. Roth accounts \(money you already paid tax on\)/);
  // defined once and used in the none-on-file state; with an account on file batch 5b's fold, "How this is worked out", has the
  // Roth sentence and the source line in its own words
  assert.equal((view.match(/ROTH_SOURCE/g) || []).length, 2, "defined once, used under the none-on-file answer");
  const none = view.split("\n").find((l) => l.includes("if (!d.hasDeferred)"));
  assert.ok(none.includes("ROTH_SOURCE"));
  assert.ok(view.includes("Roth IRAs and, since 2024, Roth 401(k)s have none while the owner is alive.") && view.includes("Rules from IRS Publication 590-B (the Uniform Lifetime Table) and the SECURE 2.0 Act"));
});

// ---- round 8, Batch 5b (2026-11-06): the owner, "Just make sure a layman can easily understand and use the page" ---------------
// The first screen says what to take, from where, by when and why, with what it lets her spend; the IRS figures, the year-by-year
// list and the table are under "How this is worked out". Ruth (qa/fixtures/widow-plan.mjs): $410,000 / 25.5 = $16,078 this year,
// adding $3,429 to her federal tax (by hand above); $50,400 of Social Security and pension.
function rmdUi() {
  const buttons = [];
  const node = (tag, kids, attrs = {}) => { const x = { tag, attrs, kids: [], append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false && typeof c !== "function") x.kids.push(c); }, replaceChildren(...k) { x.kids = []; x.append(...k); }, remove() {}, get textContent() { return x.kids.map((c) => (typeof c === "object" ? c.textContent ?? "" : String(c))).join(" "); }, style: {}, offsetHeight: 0 }; x.append(...kids); return x; };
  const isNode = (a) => a && typeof a === "object" && "kids" in a;
  const ui = new Proxy({
    h: (tag, attrs, ...k) => (attrs && typeof attrs === "object" && !Array.isArray(attrs) && !isNode(attrs) ? node(tag, k, attrs) : node(tag, [attrs, ...k])),
    button: (label, fn, opts = {}) => { const b = node("button", [label], opts); b.click = fn; buttons.push(b); return b; },
  }, { get: (t, k) => t[k] ?? ((...a) => node(String(k), a.filter((x) => x === null || typeof x !== "object" || Array.isArray(x) || isNode(x)))) });
  return { ui, buttons };
}
const outside = (n) => (n && typeof n === "object" ? (n.tag === "details" ? "" : (n.kids ?? []).map(outside).join(" ")) : String(n ?? ""));
const paragraphs = (n, out = []) => { if (n && typeof n === "object" && n.tag !== "details") { if (n.tag === "p") out.push(n.textContent.replace(/\s+/g, " ").trim()); (n.kids ?? []).forEach((k) => paragraphs(k, out)); } return out; };
async function rmdPage(plan, today = "2026-11-06", route = { rest: [], query: {} }) {
  const { render } = await import("./view.js");
  const fmt = await import("../../../core/format.js");
  const { ui, buttons } = rmdUi();
  const root = { kids: [], append(...k) { this.kids.push(...k.flat()); }, get textContent() { return this.kids.map((c) => c?.textContent ?? String(c)).join(" ").replace(/\s+/g, " "); } };
  let saved = null;
  render(root, { ui, fmt: { ...fmt, today: () => today }, plan, route, store: { update: (fn) => { saved = structuredClone(plan); fn(saved); } }, api: null, server: null });
  let fold = "";
  const walk = (n) => { if (!n || typeof n !== "object") return; if (n.tag === "details" && /How this is worked out/.test(n.textContent)) fold = n.textContent.replace(/\s+/g, " "); (n.kids ?? []).forEach(walk); };
  root.kids.forEach(walk);
  return { text: root.textContent, first: root.kids.map(outside).join(" ").replace(/\s+/g, " "), fold, paras: root.kids.flatMap((k) => paragraphs(k)), buttons, saved: () => saved };
}
const JARGON = [/factor/i, /IRS figure/i, /bracket/i, /590-B/, /SECURE/, /IRMAA/, /premium tax credit/i, /poverty line/i, /Uniform Lifetime/i];

test("5b page: Ruth reads what to take, from where, by when and why, and what she can spend, in two sentences", async () => {
  const w = await rmdPage(migrate(widowPlan()));
  assert.ok(/^Required withdrawals This year, take at least \$16,078 from Ruth's retirement account by December 31: the law requires it\. With your \$50,400 of Social Security and pension, you can spend about\s+a month and the money lasts even in a bad run of years \(only 1 in 10 is worse\)\./.test(w.first), w.first.slice(0, 600));
  // what to do: one line with its figure, one filled button
  assert.ok(/It adds about \$3,429 to your 2026 federal tax: ask your bank or broker to hold that back when they send it\./.test(w.first), w.first);
  const taken = w.buttons.filter((b) => /I've taken it/.test(b.textContent));
  assert.equal(taken.length, 1); assert.ok(!/secondary/.test(taken[0].attrs.class ?? ""), "the page's one action is the filled button");
  taken[0].click(); assert.equal(w.saved().retirement.rmdTaken[2026]["p-ruth"], "2026-11-06");
  for (const word of JARGON) assert.ok(!word.test(w.first), `${word} on the first screen: ${w.first}`);
  assert.ok(w.paras.every((p) => p.length <= 160), w.paras.filter((p) => p.length > 160).join(" | "));
  // the years ahead in plain words, and the Roth line
  assert.ok(/Next year's is about \$16,402, in today's dollars\./.test(w.first), w.first);
  assert.ok(/you can still move more into an account you pay the tax on this year/.test(w.first));
  // the word Roth is not on the page's first screen (path part 3's banned words: the walk checks the first 844 px, and this page is shorter);
  // the line and its button stay, one tap from the bottom
  assert.ok(!/Roth/.test(w.first), w.first);
  assert.ok(/Move some to a tax-free account/.test(w.first));
  // the workings: today's balance over the IRS figure for 74, Social Security pulled into tax, the schedule, the table
  assert.ok(/Ruth's retirement account holds \$410,000 today\. The law divides that by 25\.5, the IRS figure for age 74: \$16,078\./.test(w.fold), w.fold.slice(0, 900));
  assert.ok(/makes \$13,666 more of the Social Security taxable: about \$3,429 more federal tax in all\./.test(w.fold), w.fold.slice(0, 1200));
  assert.ok(/2026 · age 74 \$16,078 The balance divided by 25\.5, the IRS figure at 74 · adds about \$3,429 of federal tax/.test(w.fold), w.fold);
  assert.ok(/74: 25\.5/.test(w.fold) && /Missing it costs 25% of what was not taken \(10% if it is taken within two years\)/.test(w.fold));
});

test("5b page: taken, two at once, not started yet, and nothing pre-tax", async () => {
  // taken: said first, with the tax still to cover
  const p = migrate(widowPlan()); markTaken(p, 2026, "p-ruth", "2026-11-06");
  const t = await rmdPage(p);
  // said once (batch 5b UX review 15: hero, notice and card each said "taken")
  assert.ok(/^Required withdrawals Done for 2026\./.test(t.first), t.first.slice(0, 300));
  assert.ok(/Marked as taken on November 6, 2026\./.test(t.first) && !/required withdrawal is taken|withdrawal is taken \(marked/.test(t.first), t.first.slice(0, 600));
  // the way back is named (stress test 2026-11-11, R4)
  assert.ok(t.buttons.some((b) => /^Undo: not taken yet$/.test(b.textContent.trim())));
  // Al and Bea: both amounts in one sentence, each card with its own figure
  const c = await rmdPage(migrate(separateCouple()));
  assert.ok(/This year, take at least \$16,260 from Al's IRA and \$16,260 from Bea's IRA by December 31: the law requires both\./.test(c.first), c.first.slice(0, 600));
  assert.equal(c.buttons.filter((b) => /I've taken it/.test(b.textContent)).length, 2);
  // a first one may wait to April 1 of next year
  const r = await rmdPage(retirees(), "2026-11-02");
  assert.ok(/take at least \$13,080 from Ruth's IRA by December 31 and \$7,170 from Sam's 401\(k\) by April 1, 2027: the law requires both\./.test(r.first), r.first.slice(0, 600));
  assert.ok(/This is Sam's first one: it can wait until April 1, 2027, but then 2027 has two, both taxed that year\./.test(r.first));
  // Bea's withdrawals start in 2035: nothing to do now, and the first one's size
  const y = await rmdPage(migrate(youngerOwnerCouple()));
  const d = compute(migrate(youngerOwnerCouple()), { today: "2026-11-06" });
  assert.ok(new RegExp(`^Required withdrawals Nothing is required yet\\. Required withdrawals from Bea's IRA start in 2035, when Bea turns 75\\. Then the law makes Bea take a share out each year: about \\$${Math.round(d.schedule[0].rmdReal).toLocaleString("en-US")} the first year, in today's dollars, taxed as income\\.`).test(y.first), y.first.slice(0, 600));
  assert.equal(y.buttons.filter((b) => /I've taken it/.test(b.textContent)).length, 0);
  for (const word of JARGON) assert.ok(!word.test(y.first), `${word}: ${y.first}`);
  // two owners starting the same year: "they", and the paragraph stays short (the couple at 60 read four lines of each)
  const { bridgeCouple } = await import("../../../qa/fixtures/retiree-cases.mjs");
  const two = await rmdPage(migrate(bridgeCouple()));
  assert.ok(/^Required withdrawals Nothing is required yet\. Required withdrawals from Pat's 401\(k\) and Jo's IRA start in 2041, when they turn 75\. Then the law makes Pat and Jo take a share out each year: about \$[\d,]+ the first year, in today's dollars, taxed as income\./.test(two.first), two.first.slice(0, 500));
  // an account named without its owner gets the owner's name (batch 5b UX review 16: "from Old 401(k) start in 2056")
  const { earlyRetiree } = await import("../../../qa/fixtures/retiree-cases.mjs");
  const k = await rmdPage(migrate(earlyRetiree()));
  assert.ok(/Required withdrawals from Kim's Old 401\(k\) start in 2056, when Kim turns 75\./.test(k.first), k.first.slice(0, 500));
  // nothing pre-tax: no withdrawals, and where to add an account
  const none = migrate(widowPlan()); none.accounts = none.accounts.filter((a) => a.type !== "ira");
  const n = await rmdPage(none);
  assert.ok(/^Required withdrawals The law requires no withdrawals: there is no 401\(k\) or traditional IRA on file\./.test(n.first), n.first);
});

// stress test 2026-11-11: R4 (one filled button on a step of the path), R-A9 and RB3 (the way on is a 44 px button, not a word in a sentence)
const allNodes = (n, out = []) => { if (n && typeof n === "object") { out.push(n); (n.kids ?? []).forEach((k) => allNodes(k, out)); } return out; };
const linksOf = (root) => root.kids.flatMap((k) => allNodes(k)).filter((n) => n.tag === "a");
test("stress test: I've taken it is outlined on the plan's path and filled elsewhere", async () => {
  const off = await rmdPage(migrate(widowPlan()));
  const taken = (r) => r.buttons.find((b) => /I've taken it/.test(b.textContent));
  assert.ok(off.buttons.length && !taken(off).attrs.class, "filled off the path");
  const on = await rmdPage(migrate(widowPlan()), "2026-11-06", { rest: [], query: { guide: "plan", step: "rmd" } });
  assert.equal(taken(on).attrs.class, "secondary");
});
test("stress test: empty and no-pre-tax states have a button, not a small link", async () => {
  const empty = migrate(widowPlan()); empty.household.people = [];
  const { render } = await import("./view.js");
  const fmt = await import("../../../core/format.js");
  const { ui } = rmdUi();
  const root = { kids: [], append(...k) { this.kids.push(...k.flat()); } };
  render(root, { ui, fmt: { ...fmt, today: () => "2026-11-06" }, plan: empty, route: { rest: [], query: {} }, store: { update() {} } });
  const a = linksOf(root);
  assert.ok(a.some((x) => x.attrs.class === "btn" && x.attrs.href === "#/household/people" && /Add the people in your home/.test(x.textContent)), JSON.stringify(a.map((x) => [x.attrs, x.textContent])));
  assert.ok(a.every((x) => /\bbtn\b/.test(x.attrs.class ?? "")), "no inline link left");
  const none = migrate(widowPlan()); none.accounts = none.accounts.filter((x) => !/ira|401k|403b|457|tsp/i.test(x.type));
  const root2 = { kids: [], append(...k) { this.kids.push(...k.flat()); } };
  render(root2, { ui, fmt: { ...fmt, today: () => "2026-11-06" }, plan: none, route: { rest: [], query: {} }, store: { update() {} } });
  const b = linksOf(root2);
  assert.ok(b.some((x) => x.attrs.class === "btn secondary" && x.attrs.href === "#/balance/net-worth" && /Add it on Net worth/.test(x.textContent)), JSON.stringify(b.map((x) => [x.attrs, x.textContent])));
});

// ---- simple first (docs/OPTIONAL.md): "How this is worked out" is a part drawn by core/ui/more.js, title unchanged --------------
test("S11: I've taken it saves and says so; How this is worked out (the helper's part) stays as it was, and no fold is by hand", async () => {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  let p = migrate(widowPlan());
  const saved = [];
  let root;
  const draw = () => { root = new FakeElement("main"); render(root, { ui, fmt: { ...fmt, today: () => "2026-11-06" }, plan: p, route: { group: "retirement", id: "rmd", rest: [], query: {} }, module: { group: "retirement", id: "rmd" },
    store: { get: () => p, update: (fn) => { const d = structuredClone(p); fn(d); saved.push(d); p = d; draw(); } }, redraw: draw }); };
  draw();
  const states = () => root.all().filter((e) => e.tagName === "DETAILS").map((e) => [e.dataset.part, e.dataset.kind, e.hasAttribute("open")]);
  const before = states();
  assert.deepEqual(before, [["how", "how", false]], "one part, of kind how (Settings' switch opens it), shut; no fold by hand");
  const how = root.all().find((e) => e.dataset.part === "how");
  assert.equal(how.querySelector(".fold-title").textContent, "How this is worked out", "the title a guide's words and the tests name is unchanged");
  assert.match(textOf(how), /The law divides that by 25\.5, the IRS figure for age 74: \$16,078\./, "the working is inside it");
  root.all().find((e) => e.tagName === "BUTTON" && e.textContent === "I've taken it").click();
  assert.equal(saved.length, 1);
  assert.equal(p.retirement.rmdTaken[2026]["p-ruth"], "2026-11-06");
  assert.match(textOf(root), /Marked: Ruth's 2026 withdrawal is taken\./, "the green line (never folded)");
  assert.deepEqual(states(), before, "after the save no part opened or shut");
});

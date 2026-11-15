// The full checks for this page are in tests/tax-pages.test.mjs (fixture qa/fixtures/tax-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, stateLine, zeroTop, zeroRoom, agiRoom, gainsWords, gainsYearLine, gainsUseLine, gainsStatus, GAINS_TITLE, GAINS_SMALL } from "./compute.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { paramsFor, indexParams, federalTax } from "../../../core/math/tax.js";
import { FEDERAL } from "../federal/data/federal.js";
import { ARCHETYPES } from "../../../qa/households/lib/catalog.mjs";
import * as phone from "../../../qa/fixtures/phone-households.mjs";
import { taxPlan } from "../../../qa/fixtures/tax-plan.mjs";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";
import { stateIncomeTax } from "../../../core/math/state-tax.js";
import { retiredCouplePlan } from "../../../qa/fixtures/retired-couple-plan.mjs";
import { familyPlan as familyNow } from "../../../qa/fixtures/family-plan.mjs";

const near = (a, b, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test("projection: runs on the tax fixture and on an empty plan", () => {
  const d = compute(taxPlan(), { today: "2026-09-16" });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16" }));
});

// --- Review 2026-11-06 (fix round 6) --------------------------------------------------------------------------------------
test("Review 2026-11-06: no retirement year in the plan says why, here and on the Tax report (noYearsWhy)", async () => {
  const { noYearsWhy } = await import("./compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan("2026-10-30");
  for (const x of p.household.people.filter((y) => y.role !== "dependent")) { x.retirementAge = 70; x.lifeExpectancy = 60; }
  // the page draws a hero that says why, where it threw on d.rows[0].year ("This page failed to render")
  const { render } = await import("./view.js");
  const fmt = await import("../../../core/format.js");
  const node = (tag, kids = []) => { const x = { tag, kids: [], append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) x.kids.push(c); }, get textContent() { return x.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } }; x.append(...kids); return x; };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  const ui = new Proxy({ h: (tag, a, ...k) => node(tag, isAttrs(a) ? k : [a, ...k]) }, { get: (t, k) => t[k] ?? ((...a) => node(String(k), a.filter((x) => typeof x !== "object" || x === null || Array.isArray(x) || "kids" in x))) });
  const root = node("root");
  render(root, { ui, fmt: { ...fmt, today: () => "2026-10-30" }, plan: p });
  assert.ok(root.textContent.includes(`There are no retirement years to tax: the plan runs to 60, and Ana and Bo retire at 70. Check the retirement age and "Plan to age" on the People page`), root.textContent);
  const ages = 'the retirement age and "Plan to age"';
  // the plan ends before retirement (H-0008: runs to 60, retires at 70; H-0191: runs to 95, both retire at 96)
  assert.deepEqual(noYearsWhy([{ name: "Maya", birthYear: 1997, retireAge: 70, endAge: 60 }], 2026), { why: "the plan runs to 60, and Maya retires at 70", check: ages });
  assert.deepEqual(noYearsWhy([{ name: "Priya", birthYear: 1992, retireAge: 96, endAge: 95 }, { name: "Tom", birthYear: 1989, retireAge: 96, endAge: 95 }], 2026), { why: "the plan runs to 95, and Priya and Tom retire at 96", check: ages });
  assert.deepEqual(noYearsWhy([{ name: "A", birthYear: 1980, retireAge: 70, endAge: 60 }, { name: "B", birthYear: 1981, retireAge: 72, endAge: 65 }], 2026), { why: "the plan ends before A and B retire", check: ages });
  // past the plan's end age (H-0090: born 1900): this year less the birth year against the end age
  assert.deepEqual(noYearsWhy([{ name: "Maya", birthYear: 1900, retireAge: 65, endAge: 95 }], 2026), { why: "Maya is 126, past the age the plan runs to (95)", check: "the birth date" });
  assert.deepEqual(noYearsWhy([{ name: "A", birthYear: 1900, retireAge: 65, endAge: 95 }, { name: "B", birthYear: 1901, retireAge: 65, endAge: 95 }], 2026), { why: "A and B are both past the age the plan runs to", check: "the birth dates" });
  assert.deepEqual(noYearsWhy([], 2026), { why: "the plan has no years after work stops", check: ages });
  // the compute: rows empty, peak null, the reason; a plan with retirement years has none
  const d = compute(p, { today: "2026-10-30" });
  assert.equal(d.ready, true); assert.equal(d.rows.length, 0); assert.equal(d.peak, null);
  assert.equal(d.noYears.why, "the plan runs to 60, and Ana and Bo retire at 70");
  assert.equal(compute(familyPlan("2026-10-30"), { today: "2026-10-30" }).noYears, null);
  // one retirement year (born 1931, plan to 95): "1 year, 2026", not "1 years from 2026 to 2026", with no average and no
  // biggest year (verifier)
  const one = familyPlan("2026-10-30"); one.household.people = one.household.people.filter((y) => y.id !== "p-bo"); one.household.filingStatus = "single";
  Object.assign(one.household.people.find((y) => y.id === "p-ana"), { birthDate: "1931-12-20", retirementAge: 65, lifeExpectancy: 95 });
  assert.equal(compute(one, { today: "2026-10-30" }).rows.length, 1);
  // the hero is drawn first; the chart under it needs a real DOM (svg), which this stub does not have
  const r1 = node("root"); try { render(r1, { ui, fmt: { ...fmt, today: () => "2026-10-30" }, plan: one }); } catch { /* the chart */ }
  assert.ok(r1.textContent.includes("1 year, 2026, in today's dollars, filing single.") && !/1 years|a year on average|The biggest year/.test(r1.textContent), r1.textContent.slice(0, 400));
});

// --- gap design #40: the state's income tax in each retirement year, from its own brackets (core/math/state-tax.js) ----------
const NOV = "2026-11-13";
const couple = (code) => { const p = retiredCouplePlan(NOV); p.household.state = code; return p; };
const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;

test("gap #40: one written sentence per case on the state (R5)", () => {
  assert.equal(stateLine(undefined, money), "State tax is not included.");
  // a state the app has no rules for is named (fix round 1, P2)
  assert.equal(stateLine(undefined, money, false, "Massachusetts"), "Massachusetts income tax is not counted yet.");
  assert.equal(stateLine({ code: "TX", name: "Texas", none: true, total: 0 }, money), "Texas has no state income tax.");
  assert.equal(stateLine({ code: "WA", name: "Washington", none: true, total: 0 }, money), "Washington has no income tax on this; its tax on large capital gains is not counted.");
  assert.equal(stateLine({ code: "IL", name: "Illinois", none: false, total: 0.4, average: 0 }, money), "Illinois takes no income tax from this retirement income.");
  assert.equal(stateLine({ code: "NY", name: "New York", none: false, total: 27287, average: 941 }, money), "New York income tax adds about $27,287 over the same years, $941 a year on average.");
  assert.equal(stateLine({ code: "NY", name: "New York", none: false, total: 404, average: 404 }, money, true), "New York income tax adds about $404 that year.");
  // each case from a real plan: Arizona (no brackets in the app) and no state, Texas, Washington, New York
  assert.equal(stateLine(compute(couple("AZ"), { today: NOV }).state, money), "State tax is not included.");
  assert.equal(stateLine(compute(couple(""), { today: NOV }).state, money), "State tax is not included.");
  assert.equal(stateLine(compute(couple("TX"), { today: NOV }).state, money), "Texas has no state income tax.");
  assert.match(stateLine(compute(couple("WA"), { today: NOV }).state, money), /^Washington has no income tax on this/);
  assert.match(stateLine(compute(couple("NY"), { today: NOV }).state, money), /^New York income tax adds about \$[\d,]+ over the same years, \$[\d,]+ a year on average\.$/);
  // Illinois with only Social Security, a pension and the IRA: nothing while that is all the income (gains later on are taxed)
  const il = couple("IL"); il.rentals = []; il.income = il.income.filter((x) => !["rental", "investment"].includes(x.type));
  il.accounts = il.accounts.filter((a) => a.type !== "brokerage");
  const ilD = compute(il, { today: NOV });
  assert.ok(ilD.rows.slice(0, 10).every((r) => r.state === 0), "the first ten years: no Illinois tax");
  assert.equal(stateLine({ ...ilD.state, total: 0 }, money), "Illinois takes no income tax from this retirement income.");
});

test("gap #40: each year's state tax by hand, from the year's federal income, its pensions and Social Security", () => {
  // the retired couple (Sam 72 with an $18,000 pension, Ruth 69 with $25,200 of Social Security, $24,000 of rent): 2026's
  // federal AGI is 42,000 ordinary + 2,400 dividends + 17,050 of Social Security taxed = 61,450
  const ny = compute(couple("NY"), { today: NOV }), il = compute(couple("IL"), { today: NOV }), ca = compute(couple("CA"), { today: NOV });
  // New York: 61,450 − 17,050 − the $18,000 pension (under 2 × $20,000) − $16,050 = 10,350 taxable, at 3.9%
  near(ny.rows[0].state, 10350 * 0.039, 0.01);
  // Illinois: 61,450 − 17,050 − 18,000 − 2 × 2,925 − 2 × 1,000 = 18,550, at 4.95% (the rent and the dividends are taxed)
  near(il.rows[0].state, 18550 * 0.0495, 0.01);
  // California: 61,450 − 17,050 − 11,412 = 32,988; Schedule Y 229.12 + 2% × 10,076 = 430.64, less four credits of $153
  // (two people, both 65 or older): nothing
  assert.equal(ca.rows[0].state, 0);
  // the totals are the rows added up, the average over the years
  near(ny.totals.state, ny.rows.reduce((t, r) => t + r.state, 0)); near(ny.state.average, ny.totals.state / ny.rows.length);
  assert.equal(ny.state.name, "New York"); assert.deepEqual(ny.state.rules, stateIncomeTax("NY", { year: 2026 }).rules);
  assert.equal(ny.state.local, "New York City's and Yonkers' own income taxes");
  // the federal answer is untouched
  assert.equal(JSON.stringify(ny.rows.map((r) => r.taxes)), JSON.stringify(compute(couple("AZ"), { today: NOV }).rows.map((r) => r.taxes)));
  // Texas: a zero every year
  assert.ok(compute(couple("TX"), { today: NOV }).rows.every((r) => r.state === 0));
});

test("gap #40: later years: today's dollars are each year's divided by the price level; Illinois raises its exemption with prices, New York does not", () => {
  const nominal = compute(couple("NY"), { today: NOV, real: false }), real = compute(couple("NY"), { today: NOV });
  near(real.rows[5].state, nominal.rows[5].state / nominal.rows[5].priceLevel);
  assert.equal(nominal.state.indexed, false); assert.equal(nominal.state.yearWords, null);
  // Illinois in a later year: the same income less the exemptions raised by the plan's inflation since 2026 (Sam's pension has
  // no raises: $18,000 every year; the required withdrawals come off too)
  const il = compute(couple("IL"), { today: NOV, real: false });
  assert.equal(il.state.indexed, true);
  const r = il.rows[5], k = r.priceLevel / il.rows[0].priceLevel;
  assert.ok(k > 1.1);
  near(r.state, 0.0495 * Math.max(0, r.ordinary + r.qualified - 18000 - r.withdrawnDeferred - r.conversion - 2 * 2925 * k - 2 * 1000), 0.01);
  assert.equal(compute(couple("CA"), { today: NOV }).state.yearWords, "2026 brackets; the standard deduction and credits are 2025's: the 2026 ones are not out yet");
});

test("S11: the page saves nothing; its parts are the helper's (N more years, Gains you could take tax-free, How this is worked out), shut, and say the state's rules", async () => {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  const draw = (plan) => {
    const saved = [];
    const root = new FakeElement("main");
    render(root, { ui, fmt: { ...fmt, today: () => NOV }, plan, route: { group: "taxes", id: "projection", rest: [], query: {} }, module: { group: "taxes", id: "projection" }, store: { get: () => plan, update: (fn) => saved.push(fn) }, redraw() {} });
    return { root, saved };
  };
  const { root, saved } = draw(migrate(couple("NY")));
  const parts = root.all().filter((e) => e.tagName === "DETAILS").map((e) => [e.dataset.part, e.dataset.kind, e.hasAttribute("open")]);
  assert.deepEqual(parts, [["years", "more", false], ["gains", "more", false], ["how", "how", false]], "three parts, shut; no fold by hand");
  const years = root.all().find((e) => e.dataset.part === "years"), how = root.all().find((e) => e.dataset.part === "how");
  const gains = root.all().find((e) => e.dataset.part === "gains");
  assert.match(years.querySelector(".fold-title").textContent, /^\d+ more years$/);
  assert.equal(how.querySelector(".fold-title").textContent, "How this is worked out");
  assert.equal(how.querySelector(".fold-status").textContent, "New York");
  // the rules one plain line each (no "IRA"), then that the state's tax is not in Will the money last?
  assert.deepEqual(how.all().filter((e) => e.tagName === "LI").map(textOf), ["Social Security is not taxed.", "Pensions and money taken out of retirement accounts: the first $20,000 a person is not taxed from age 59½.", "A standard deduction comes off first."]);
  assert.match(textOf(how), /New York: Social Security is not taxed\. Pensions and money taken out of retirement accounts: the first \$20,000 a person is not taxed from age 59½\. A standard deduction comes off first\./);
  assert.ok(!/\bIRA\b/.test(textOf(how)), "no shorthand on screen");
  assert.match(textOf(how), /New York's tax is shown here only: Will the money last\? does not take it out of your savings yet\./);
  assert.match(textOf(how), /In later years New York's figures stay as written in its law/);
  assert.match(textOf(how), /New York City's and Yonkers' own income taxes are not counted\./);
  // outside the parts: the state's one sentence, and the dashed line named
  const outside = textOf(root).replace(textOf(how), "").replace(textOf(years), "").replace(textOf(gains), "");
  assert.match(outside, /New York income tax adds about \$[\d,]+ over the same years/);
  // the two lines' key beside the chart, and the state's total as a tile of its own in place of "A year" (fix round 1, P1 and P5)
  assert.match(outside, /Federal tax New York income tax/);
  const tilesOf = (r) => r.all().filter((e) => /\bstat\b/.test(e.className ?? "") && !/stat-/.test(e.className ?? "")).map((e) => textOf(e).replace(/\u200b/g, ""));
  const tiles = tilesOf(root);
  const nyD = compute(migrate(couple("NY")), { today: NOV });
  assert.ok(tiles.includes(`${money(nyD.state.total)} New York tax over the plan, ${money(nyD.state.average)} a year`), tiles.join(" | "));
  assert.ok(tiles.includes(`${money(nyD.totals.taxes)} Federal tax over the plan, today's dollars`), tiles.join(" | "));
  assert.equal(tiles.length, 4, "four tiles: the state's takes the place of A year"); assert.ok(!tiles.some((t) => / A year on average$/.test(t)));
  assert.equal(saved.length, 0, "nothing on this page writes the plan");
  // a state without brackets in the app: today's sentence, and How this is worked out says where its tax is
  const az = draw(migrate(couple("AZ"))).root;
  assert.match(textOf(az), /Arizona income tax is not counted yet\./);
  assert.ok(!/is shown here only/.test(textOf(az)));
  const azTiles = tilesOf(az);
  assert.ok(azTiles.some((t) => / Over the plan today's dollars$/.test(t)) && azTiles.some((t) => / A year on average$/.test(t)), `no state tile, the tiles as before: ${azTiles.join(" | ")}`);
  assert.match(textOf(az.all().find((e) => e.dataset.part === "how")), /For Arizona, the State tax page works out this year's tax from your own figures\./);
  const samples = (r) => r.all().filter((e) => /border-top:2px/.test(e.getAttribute("style") ?? "")).length;
  assert.equal(samples(az), 0, "no key without a state line"); assert.equal(samples(root), 2, "a solid and a dashed sample");
});

test("gap #40 stage 2: Georgia, North Carolina, New Jersey and Virginia in each retirement year, by hand", () => {
  // the retired couple (Sam 72, Ruth 69) in each year's dollars: AGI less Social Security = the year's ordinary income and dividends
  const run = (code) => compute(couple(code), { today: NOV, real: false });
  const ga = run("GA"), nc = run("NC"), nj = run("NJ"), va = run("VA");
  for (const r of ga.rows.slice(0, 10)) {
    // Georgia: both 65 or older ($65,000 each) leave out the pension, the IRA money, the dividends and the rent (Form 500
    // Schedule 1 page 2, line 13; the duplex's $24,000 rises 2% a year, so with the plan's prices)
    const counted = 18000 + 24000 * r.priceLevel + r.withdrawnDeferred + r.conversion + r.qualified;
    near(r.state, 0.0499 * Math.max(0, r.ordinary + r.qualified - Math.min(counted, 130000, r.ordinary + r.qualified) - 30000), 0.01);
  }
  // with the rent left out of what is counted, as before this fix, Georgia would tax it in every year above the deduction
  assert.ok(ga.rows.slice(0, 10).every((r) => r.state < 0.0499 * Math.max(0, r.ordinary + r.qualified - Math.min(18000 + r.withdrawnDeferred + r.conversion + r.qualified, 130000) - 30000) + 0.01));
  // North Carolina taxes all but Social Security: 2026, 0.0399 × (42,000 + 2,400 − 25,500) = 754.11
  near(nc.rows[0].state, 0.0399 * (42000 + 2400 - 25500), 0.01);
  for (const r of nc.rows.slice(0, 10)) near(r.state, 0.0399 * Math.max(0, r.ordinary + r.qualified - 25500), 0.01);
  // New Jersey: income under $100,000, no pay: the pension exclusion and the rest of the $100,000 leave nothing to tax
  assert.ok(nj.rows.slice(0, 8).every((r) => r.state === 0));
  assert.equal(nj.state.local, "New Jersey's property tax deduction and credit for your home");
  // Virginia: 2026, 44,400 less two age deductions of $12,000 is 20,400, under the $23,900 line: nothing; 2027, the standard
  // deduction is $18,400 for a couple (the 2026 Appropriation Act): 57,594 − 24,000 − 18,400 − 2 × 930 − 2 × 800 = 11,734,
  // so 120 + 5% × 6,734
  assert.equal(va.rows[0].state, 0);
  const r1 = va.rows[1]; assert.equal(r1.year, 2027);
  near(r1.state, 120 + 0.05 * (r1.ordinary + r1.qualified - 24000 - 18400 - 1860 - 1600 - 5000), 0.01);
  near(r1.ordinary + r1.qualified, 57594, 1);
  // each later year on the deduction its law gives that year: $18,600 in 2028 and 2029, $6,000 from 2030 (as the law stands)
  for (const r of va.rows.filter((x) => x.year >= 2028 && x.year <= 2032)) {
    const one = stateIncomeTax("VA", { year: r.year, status: "married_joint", agi: r.ordinary + r.qualified + r.taxableSocialSecurity, taxableSocialSecurity: r.taxableSocialSecurity, ages: r.ages });
    assert.equal(one.deduction, r.year <= 2029 ? 18600 : 6000, String(r.year)); near(r.state, one.tax, 0.01);
  }
  // the federal answer is untouched, and none of the four raises its figures with prices
  for (const d of [ga, nc, nj, va]) { assert.equal(d.state.indexed, false); assert.equal(JSON.stringify(d.rows.map((r) => r.taxes)), JSON.stringify(compute(couple("AZ"), { today: NOV, real: false }).rows.map((r) => r.taxes))); }
  assert.equal(ga.state.yearWords, "2026 rate and deductions; the retirement exclusion is 2025's: the 2026 one is not out yet");
  assert.equal(nc.state.yearWords, null);
});

test("gap #40 stage 2: How this is worked out names the new states' rules, New Jersey's property tax deduction, and the full list", async () => {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  const how = (code) => {
    const plan = migrate(couple(code)), root = new FakeElement("main");
    render(root, { ui, fmt: { ...fmt, today: () => NOV }, plan, route: { group: "taxes", id: "projection", rest: [], query: {} }, module: { group: "taxes", id: "projection" }, store: { get: () => plan, update() {} }, redraw() {} });
    return textOf(root.all().find((e) => e.dataset.part === "how"));
  };
  assert.match(how("NJ"), /New Jersey: Social Security is not taxed\. From age 62, pensions and money taken out of retirement accounts are not taxed, up to \$100,000 for a couple or \$75,000 alone\. That shrinks once your income passes \$100,000, and stops above \$150,000\./);
  assert.match(how("NJ"), /New Jersey's property tax deduction and credit for your home are not counted\./);
  assert.match(how("VA"), /The standard deduction, \$8,750 alone or \$17,500 for a couple, rises to \$9,200 \(\$18,400\) in 2027 and \$9,300 \(\$18,600\) in 2028 and 2029; then, as the law stands today, it falls to \$3,000 \(\$6,000\)\./);
  assert.match(how("GA"), /From age 62, the first \$35,000 a person of pensions, money taken out of retirement accounts, interest, dividends, gains and rent is not taxed, and from 65 the first \$65,000\./);
  for (const code of ["CA", "NY", "IL", "GA", "NC", "NJ", "VA"]) assert.ok(!/\bIRA\b|\bflat\b/.test(how(code)), `${code}: plain words`);
  assert.match(how("GA"), /2026 rate and deductions; the retirement exclusion is 2025's: the 2026 one is not out yet\./);
  assert.match(how("AZ"), /The app has the income tax rules of California, New York, Illinois, Georgia, North Carolina, New Jersey and Virginia, and of the states with no income tax\. Pennsylvania, Ohio and Michigan come next\. For Arizona, the State tax page works out this year's tax from your own figures\./);
  assert.match(how("PA"), /Pennsylvania, Ohio and Michigan come next\. For Pennsylvania, the State tax page/);
});

// --- gap list, next 60, item 25: gains taken at 0% across several low-income years ------------------------------------------
const P26 = paramsFor(FEDERAL, 2026);
const money0 = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const one =(o) => ({ filingStatus: "single", otherOrdinary: 0, qualifiedIncome: 0, socialSecurity: 0, itemized: 0, ages65plus: 0, ...o });

test("next-60 #25: the 0% line for each filing status is Rev. Proc. 2025-32's for 2026", () => {
  assert.deepEqual(["single", "married_joint", "married_separate", "head_of_household", "qualifying_surviving"].map((s) => zeroTop(s, P26)), [49450, 98900, 49450, 66200, 98900]);
});

test("next-60 #25: the room at 0% by hand: one person, a couple, a year with Social Security, a year already over the line", () => {
  // one person, $30,000 of pension and $2,000 of dividends: taxable 30,000 + 2,000 - 16,100 = 15,900; room 49,450 - 15,900
  const a = zeroRoom(one({ otherOrdinary: 30000, qualifiedIncome: 2000 }), P26);
  assert.equal(a.before.taxableIncome, 15900); assert.equal(a.room, 33550); assert.equal(a.after.taxableIncome, 49450);
  assert.equal(a.after.totalTax, a.before.totalTax, "the gain itself is taxed at 0%"); assert.equal(a.after.qualifiedTax, 0);
  // a couple, both 65 or over: deduction 32,200 + 2 x 1,650 + the senior deduction 2 x 6,000 (AGI under 150,000 even with the room)
  const b = zeroRoom(one({ filingStatus: "married_joint", otherOrdinary: 60000, qualifiedIncome: 5000, ages65plus: 2 }), P26);
  assert.equal(b.before.taxableIncome, 65000 - 35500 - 12000); assert.equal(b.room, 98900 - 17500); assert.equal(b.after.agi, 146400);
  // one person, 66, $20,000 pension and $30,000 of Social Security: $5,350 of it taxed (provisional 35,000: 4,500 + 0.85 x 1,000),
  // AGI 25,350, deduction 16,100 + 2,050 + 6,000 = 24,150, taxable 1,200. The gain pulls Social Security in at 85 cents a dollar
  // until 85% of it is taxed (25,500, at a gain of 23,705.88), then 1:1: room = 49,450 - (20,000 + 25,500 - 24,150) = 28,100
  const c = zeroRoom(one({ otherOrdinary: 20000, socialSecurity: 30000, ages65plus: 1 }), P26);
  assert.equal(c.before.income.taxableSocialSecurity, 5350); assert.equal(c.before.taxableIncome, 1200);
  assert.equal(c.room, 28100);
  assert.equal(c.after.income.taxableSocialSecurity - c.before.income.taxableSocialSecurity, 20150);
  // the tax: 10% of 1,200 = 120 before; after, ordinary taxable 49,450 - 28,100 = 21,350: 1,240 + 12% x 8,950 = 2,314
  assert.equal(c.before.totalTax, 120); assert.equal(c.after.totalTax, 2314);
  // the 2025-2028 deduction for people 65 and over shrinks by 6% of AGI past $75,000 (head of household): one person of 65 with a
  // $40,000 pension: deduction 24,150 + 2,050 + 6,000, taxable 7,800 (tax $780). Past AGI 75,000 each $1 of gain adds $1.06 of
  // taxable income: 1.06 AGI - 36,700 = 66,200, AGI 97,075.47, room $57,075; the deduction loses 6% x 22,075 = $1,324.50, and the
  // 10% on the $9,124.50 of ordinary taxable income left under the gain is $912.45: $132.45 more tax
  const h = zeroRoom(one({ filingStatus: "head_of_household", otherOrdinary: 40000, ages65plus: 1 }), P26);
  assert.equal(h.before.taxableIncome, 7800); assert.equal(h.before.totalTax, 780);
  assert.equal(h.room, 57075); near(h.before.deduction.senior - h.after.deduction.senior, 1324.5); assert.equal(h.after.totalTax, 912.45);
  // already over: $80,000 of pension; or $50,000 and $20,000 of gains (taxable 53,900): no room
  assert.equal(zeroRoom(one({ otherOrdinary: 80000 }), P26).room, 0);
  assert.equal(zeroRoom(one({ otherOrdinary: 50000, qualifiedIncome: 20000 }), P26).room, 0);
  // the deduction not used yet: the gain fills it first, at no tax either: 5,000 + g - 16,100 = 49,450
  assert.equal(zeroRoom(one({ otherOrdinary: 5000 }), P26).room, 60550);
  // a dollar more than the room is past the line (whole dollars, rounded down)
  for (const x of [one({ otherOrdinary: 20000, socialSecurity: 30000, ages65plus: 1 }), one({ filingStatus: "head_of_household", otherOrdinary: 41234.56, qualifiedIncome: 789 })]) {
    const z = zeroRoom(x, P26);
    assert.ok(z.after.taxableIncome <= z.top + 1e-6);
    assert.ok(zeroRoom({ ...x, qualifiedIncome: x.qualifiedIncome + z.room + 1 }, P26).before.taxableIncome > z.top, "one more dollar crosses");
  }
});

test("next-60 #25: the room under Medicare's line by hand (agiRoom)", () => {
  // AGI = 25,350 + 1.85 g while Social Security is phasing in: 60,000 is reached at g = 18,729.73
  assert.equal(agiRoom(one({ otherOrdinary: 20000, socialSecurity: 30000, ages65plus: 1 }), P26, 60000), 18729);
  assert.equal(agiRoom(one({ otherOrdinary: 70000 }), P26, 60000), 0);
  assert.equal(agiRoom(one({ otherOrdinary: 10000 }), P26, 60000), 50000);
});

test("next-60 #25 (fix round, found while checking M1): the 3.8% tax on investment income can come inside the 0% band in later years, and is named", () => {
  // the 0% line and the deduction rise with prices; the 3.8% tax's $200,000 line (one person) does not (IRC 1411(b)). At 3.1 times
  // 2026's prices: deduction 16,100 x 3.1 = 49,910 -> 49,900; 0% line 49,450 x 3.1 = 153,295 -> 153,300. $100,000 of pension:
  // taxable 50,100, room 153,300 - 50,100 = 103,200; AGI with it 203,200, so 3.8% of the 3,200 past $200,000 = $121.60, all of
  // the extra tax (the gain itself is at 0%, no Social Security, under 65)
  const p31 = indexParams(P26, 3.1, 2026);
  const z = zeroRoom(one({ otherOrdinary: 100000 }), p31);
  assert.equal(z.room, 103200); assert.equal(z.after.agi, 203200);
  near(z.after.niit - z.before.niit, 121.6); near(z.after.totalTax - z.before.totalTax, 121.6);
  assert.equal(gainsYearLine({ room: 103200, extraTax: 121.6, ssMore: 0, seniorLost: 0, niitMore: 121.6 }, money0), "$122 more tax: the 3.8% tax on investment income");
  assert.equal(gainsYearLine({ room: 103200, extraTax: 2765, ssMore: 9000, seniorLost: 0, niitMore: 900 }, money0), "$2,765 more tax on Social Security and the 3.8% tax on investment income");
  // a far year of the invented family (2055, each year's dollars): no more Social Security taxed, yet about $2,500 more tax: the
  // 3.8% tax, not "more tax on Social Security" as the first build read
  const d = compute(migrate(familyNow(NOV)), { today: NOV, real: false, gains: true });
  const y = d.gains.years.find((v) => v.year === 2055);
  assert.equal(y.ssMore, 0); assert.ok(y.niitMore > 100); near(y.niitMore, y.extraTax, 0.01);   // total tax is kept to the cent
  assert.match(gainsYearLine(y, money0), /^\$[\d,]+ more tax: the 3\.8% tax on investment income$/);
  // and 2026's own figures keep it out of reach: the 0% line plus the deduction is under $200,000 / $250,000
  assert.equal(zeroRoom(one({ filingStatus: "married_joint", otherOrdinary: 0 }), P26).after.niit, 0);
  assert.equal(federalTax(one({ qualifiedIncome: 49450 + 16100 }), P26).niit, 0);
});

const ARCH = Object.fromEntries(ARCHETYPES.map((a) => [a.id, a]));
const gainsOf = (plan, o = {}) => compute(migrate(structuredClone(plan)), { today: NOV, gains: true, ...o });

test("next-60 #25: each year's room is worked on the engine's own return for that year", () => {
  for (const plan of [retiredCouplePlan(NOV), ARCH["09-near-retirement"].build(), ARCH["14-unusual-structures"].build(), ARCH["12-high-net-worth"].build()]) {
    const d = gainsOf(plan);
    assert.ok(d.gains, "this plan has money in taxable accounts");
    for (const y of d.gains.years) {
      const row = d.rows.find((r) => r.year === y.year);
      near(y.before, row.taxableIncome, 1e-6);
      // with the room taken, taxable income sits on the line: under it by less than the last dollar's worth (rounded down)
      if (y.room >= 1) assert.ok(y.after <= y.top + 1e-6 && y.top - y.after < 2.5 / (y.top / zeroTop(d.filingStatus, P26)), `${y.year}: ${y.after} against ${y.top}`);
      else assert.ok(y.before >= y.top - 1e-6, `${y.year}: no room only when already at or past the line`);
    }
    const next = d.gains.next.map((y) => y.year);
    assert.deepEqual(next, [...next].sort((a, b) => a - b), "the years with room in date order (critic P2)");
    near(d.gains.total, d.gains.years.filter((y) => y.room >= 1).reduce((s, y) => s + y.room, 0));
    assert.equal(d.gains.roomYears + d.gains.overYears, d.gains.years.length);
  }
});

test("next-60 #25 (critics M1, M2): what is taken never passes the gain the plan holds, nor a year's room, and its costs are worked on it", () => {
  const plans = [retiredCouplePlan(NOV), familyNow(NOV), ...ARCHETYPES.map((a) => a.build())];
  let some = 0;
  for (const plan of plans) for (const real of [true, false]) {
    const g = gainsOf(plan, { real }).gains;
    if (!g || !g.roomYears) continue;
    some++;
    const took = g.taken.reduce((s, t) => s + t.amount, 0);
    near(took, Math.min(g.held.amount, g.total), 1e-6);
    const room = new Map(g.next.map((y) => [y.year, y.room]));
    for (const t of g.taken) assert.ok(t.amount > 0 && t.amount <= room.get(t.year) + 1e-9, `${t.year}: ${t.amount} of ${room.get(t.year)}`);
    assert.deepEqual(g.taken.map((t) => t.year), g.next.slice(0, g.taken.length).map((y) => y.year), "the first years with room, in date order");
    assert.equal(g.coverYear, took >= g.held.amount - 0.5 ? g.taken.at(-1).year : null);
    // the costs: only the years taken, and never more than taking all of those years' room
    for (const k of ["extra", "medicare", "marketplace"]) if (g[k]) for (const yr of g[k].years) assert.ok(g.taken.some((t) => t.year === yr), `${k} ${yr} is a year taken`);
    if (g.extra) assert.ok(g.extra.tax <= g.taken.reduce((s, t) => s + (g.years.find((y) => y.year === t.year).extraTax ?? 0), 0) + 1e-6);
    if (g.state?.total) assert.ok(g.state.total <= g.taken.reduce((s, t) => s + (g.years.find((y) => y.year === t.year).state ?? 0), 0) + 1e-6);
    // no sentence says the room summed over the years when the plan's gain is less than it (the first build: "In all, about $2,759,800")
    const all = Object.values(gainsWords(g, money0)).flat().join(" ");
    assert.ok(!/In all, about/.test(all));
    if (g.coverYear !== null) assert.ok(!all.includes(money0(g.total)), `the room's sum ${money0(g.total)} is not said`);
  }
  assert.ok(some >= 10, `${some} plans with room`);
});

test("next-60 #25: the invented households: a retired couple, a surviving spouse, every year over the line, a state that taxes gains", () => {
  const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
  // the retired couple (Arizona, joint): $120,000 in the brokerage, half of it gain as the plan counts it; 2026 alone covers it
  const rc = gainsOf(retiredCouplePlan(NOV)).gains;
  assert.deepEqual(rc.line, { year: 2026, top: 98900 });
  assert.equal(rc.held.year, 2026); near(rc.held.amount, 60000); assert.equal(rc.coverYear, rc.next[0].year);
  assert.deepEqual(rc.taken.map((t) => t.year), [2026]); near(rc.taken[0].amount, 60000);
  const w = gainsWords(rc, money);
  assert.equal(w.intro, "Federal tax on the profit from shares held more than a year is 0% while your taxable income stays under $98,900 (the 2026 line, rising with prices). What is left under that line in a year is its room.");
  assert.equal(w.held, "We assume about half of what your taxable accounts hold is profit: about $60,000 in 2026. The room in 2026 alone would cover it.");
  // taking $60,000 in 2026 taxes all the Social Security it can (85%) already, so it costs what all of 2026's room costs: $437
  near(rc.extra.tax, rc.years[0].extraTax, 1e-6); assert.deepEqual(rc.extra.why, ["ss"]);
  assert.deepEqual(w.watch, ["Taking the profit in 2026 also makes more of your Social Security taxed: about $437 more federal tax.", "Arizona income tax on these gains is not counted."]);
  assert.equal(rc.medicare.over.length, 0);
  // a qualifying surviving spouse: the joint 0% line ($98,900) and the single Medicare line ($109,000), so the room can pass it
  const qs = gainsOf(ARCH["14-unusual-structures"].build()).gains;
  for (const y of qs.years.filter((v) => v.medicare?.over)) assert.ok(y.medicare.room < y.room && y.medicare.room > 0, `${y.year}: some room is under Medicare's line`);
  // her $235,085 of gain takes the room of 2031, 2032 and part of 2033; the first two pass Medicare's line, the last part does not
  assert.deepEqual(qs.taken.map((t) => t.year), [2031, 2032, 2033]); assert.equal(qs.coverYear, 2033);
  assert.deepEqual(qs.medicare.over, [2031, 2032]);
  assert.ok(gainsWords(qs, money).watch.includes("Taking the profit in 2031 and 2032 would also pass the line where Medicare premiums go up two years later ($109,000 in today's dollars)."));
  // its marketplace year: the help stops before the room is used up, and that year's line says where
  assert.ok(qs.marketplace && qs.marketplace.cliff > 0); assert.deepEqual(qs.marketplace.years, [2031]);
  const mk = qs.years.find((y) => y.year === qs.marketplace.years[0]);
  assert.ok(mk.cliffRoom > 0 && mk.cliffRoom < mk.room);
  assert.match(gainsYearLine(mk, money), new RegExp(`marketplace help stops past \\${money(mk.cliffRoom)}`));
  // every year over the line: nothing to take, said in words, and no catch or "what it buys"
  const hn = gainsOf(ARCH["12-high-net-worth"].build()).gains;
  assert.equal(hn.roomYears, 0); assert.equal(gainsStatus(hn), "no room"); assert.deepEqual(hn.taken, []);
  const hw = gainsWords(hn, money);
  assert.equal(hw.total, "No year of your retirement has room: in each one your taxable income is already at or past the line.");
  assert.deepEqual([hw.label, hw.over, hw.held, hw.buys, hw.watch.length], ["", "", "", "", 0]);
  // North Carolina (3.99% on income past its deduction): the state's share of each year's room, and of the profit taken (M2:
  // about $100,477 in 2030, so at most 3.99% of it, where the first build said $60,818 "over the plan, if you took all the room")
  const nc = gainsOf(ARCH["09-near-retirement"].build()).gains;
  assert.equal(nc.state.name, "North Carolina");
  for (const y of nc.years.filter((v) => v.room >= 1)) assert.ok(y.state <= 0.0399 * y.room + 0.01, `${y.year}: ${y.state} of ${y.room}`);
  assert.ok(nc.years.some((y) => y.room >= 1 && Math.abs(y.state - 0.0399 * y.room) < 1e-6), "past the deduction, exactly 3.99% of the room");
  assert.deepEqual(nc.taken.map((t) => t.year), [2030]);
  assert.ok(nc.state.total > 0 && nc.state.total <= 0.0399 * nc.held.amount + 0.01, `${nc.state.total} on ${nc.held.amount}`);
  assert.match(gainsWords(nc, money).watch.at(-1), /^North Carolina taxes the profit as income: about \$[\d,]+\.$/);
  // each year's dollars: the same room times the year's price level
  const nom = gainsOf(retiredCouplePlan(NOV), { real: false });
  const real = gainsOf(retiredCouplePlan(NOV));
  for (const y of nom.gains.years) { const r = real.gains.years.find((v) => v.year === y.year), lvl = nom.rows.find((v) => v.year === y.year).priceLevel; near(y.room / lvl, r.room, 1e-6); }
  // no money in taxable accounts in any retirement year: no row at all; nor when the plan counts none of it as gain
  assert.equal(gainsOf(ARCH["01-single-adult"].build()).gains, null);
  const noGain = retiredCouplePlan(NOV); noGain.retirement = { ...(noGain.retirement ?? {}), gainShare: 0 };
  assert.equal(gainsOf(noGain).gains, null);
  assert.equal(gainsOf(emptyPlan()).gains, undefined, "an empty plan has no answer to add to");
});

test("next-60 #25: one written sentence per case (R5)", () => {
  const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
  const g = (o) => ({ line: { year: 2026, top: 49450 }, years: [], next: [{ year: 2030, room: 20000 }, { year: 2031, room: 30000 }], total: 50000, roomYears: 2, overYears: 0, over: [], first: 2030, held: null, taken: [], coverYear: null, extra: null, marketplace: null, medicare: null, state: null, ...o });
  const w = (o) => gainsWords(g(o), money);
  // the line, and what "room" means
  assert.equal(w({}).intro, "Federal tax on the profit from shares held more than a year is 0% while your taxable income stays under $49,450 (the 2026 line, rising with prices). What is left under that line in a year is its room.");
  // the label over the list: the next years with room, in date order (critic P2: not the biggest first)
  assert.equal(w({ roomYears: 6 }).label, "The next 5 years with room:");
  assert.equal(w({}).label, "The years with room:");
  assert.equal(w({ roomYears: 1, next: [{ year: 2031, room: 30000 }], total: 30000 }).label, "");
  // no sum of the room over the years (critics M1, P1): it is not gain anyone has
  assert.equal(w({}).total, "");
  assert.ok(!Object.values(w({ held: { year: 2030, amount: 15000, share: 0.5 }, coverYear: 2030 })).flat().join(" ").includes("$50,000"), "the summed room is never said when the gain is less");
  assert.equal(w({ roomYears: 1, next: [{ year: 2031, room: 30000 }], total: 30000 }).total, "2031 is the only year with room.");
  assert.equal(w({ roomYears: 0, next: [], total: 0 }).total, "No year of your retirement has room: in each one your taxable income is already at or past the line.");
  // the years at or past the line (critic M3: a year with under $1 of room is at the line, counted here)
  assert.equal(w({}).over, "");
  assert.equal(w({ overYears: 1, over: [2034] }).over, "In 2034 your taxable income is already at or past the line.");
  assert.equal(w({ overYears: 8, over: [2034] }).over, "In 8 other years your taxable income is already at or past the line.");
  // the profit the plan counts, against the room (critic P3: said as an assumption, in plain words)
  assert.equal(w({}).held, "");
  assert.equal(w({ held: { year: 2030, amount: 15000, share: 0.5 }, coverYear: 2030 }).held, "We assume about half of what your taxable accounts hold is profit: about $15,000 in 2030. The room in 2030 alone would cover it.");
  assert.equal(w({ held: { year: 2030, amount: 45000, share: 0.4 }, coverYear: 2031 }).held, "We assume about 40% of what your taxable accounts hold is profit: about $45,000 in 2030. The room from 2030 to 2031 would cover it.");
  assert.equal(w({ held: { year: 2030, amount: 90000, share: 1 } }).held, "We assume all of what your taxable accounts hold is profit: about $90,000 in 2030. All the room in your retirement, about $50,000, would cover only part of it.");
  // what it buys (critic P6: shares only, and a tax preparer to confirm)
  assert.equal(w({}).buys, "Selling shares in a year with room and buying them back raises what they count as having cost, so less is taxed when you sell them later. The 30-day wait on buying back is only for shares sold at a loss; ask a tax preparer before you count on it.");
  assert.equal(w({}).note, "Nothing here changes your plan.");
  // what to watch, worked on the profit taken in the years named: Social Security
  assert.deepEqual(w({}).watch, []);
  assert.deepEqual(w({ extra: { years: [2030, 2031], tax: 4300, why: ["ss"] } }).watch, ["Taking the profit in 2030 and 2031 also makes more of your Social Security taxed: about $4,300 more federal tax in all."]);
  assert.deepEqual(w({ extra: { years: [2031], tax: 400, why: ["ss"] } }).watch, ["Taking the profit in 2031 also makes more of your Social Security taxed: about $400 more federal tax."]);
  // ... or the 2025-2028 deduction for people 65 and over shrinking, or the 3.8% tax on investment income, or several
  assert.deepEqual(w({ extra: { years: [2027], tax: 132, why: ["senior"] } }).watch, ["Taking the profit in 2027 also shrinks the extra deduction for people 65 and over: about $132 more federal tax."]);
  assert.deepEqual(w({ extra: { years: [2026, 2027, 2028], tax: 900, why: ["ss", "senior"] } }).watch, ["Taking the profit in 2026 to 2028 also makes more of your Social Security taxed and shrinks the extra deduction for people 65 and over: about $900 more federal tax in all."]);
  assert.deepEqual(w({ extra: { years: [2060], tax: 300, why: ["niit"] } }).watch, ["Taking the profit in 2060 also brings in the 3.8% tax on investment income: about $300 more federal tax."]);
  // under $50 in all is not worth a line (critic P7)
  assert.deepEqual(w({ extra: { years: [2027], tax: GAINS_SMALL - 1, why: ["senior"] } }).watch, []);
  // the marketplace: with the line where its help stops, without one; one year, two, a run, years apart
  assert.deepEqual(w({ marketplace: { years: [2027, 2028, 2029], cliff: 84600 } }).watch, ["In 2027 to 2029 you buy marketplace health insurance: the gain counts as income for its help, which shrinks with each dollar and stops once your income passes about $84,600 in today's dollars."]);
  assert.deepEqual(w({ marketplace: { years: [2027], cliff: null } }).watch, ["In 2027 you buy marketplace health insurance: the gain counts as income for its help, which shrinks with each dollar."]);
  assert.match(w({ marketplace: { years: [2027, 2028], cliff: null } }).watch[0], /^In 2027 and 2028 you buy/);
  assert.match(w({ marketplace: { years: [2027, 2029, 2033], cliff: null } }).watch[0], /^In 3 years from 2027 to 2033 you buy/);
  // Medicare, two years later: said only when taking the profit passes its line (critic P5: no line for a catch that does not apply)
  assert.deepEqual(w({ medicare: { years: [2030], line: 218000, over: [] } }).watch, []);
  assert.deepEqual(w({ medicare: { years: [2030, 2031], line: 109000, over: [2031] } }).watch, ["Taking the profit in 2031 would also pass the line where Medicare premiums go up two years later ($109,000 in today's dollars)."]);
  assert.deepEqual(w({ medicare: { years: [2030, 2031], line: 109000, over: [2030, 2031] } }).watch, ["Taking the profit in 2030 and 2031 would also pass the line where Medicare premiums go up two years later ($109,000 in today's dollars)."]);
  // the state: counted on the profit taken (critic M2), not counted (named, or none chosen)
  assert.deepEqual(w({ state: { code: "CA", name: "California", total: 1500 } }).watch, ["California taxes the profit as income: about $1,500."]);
  assert.deepEqual(w({ state: { counted: false, name: "Oregon" } }).watch, ["Oregon income tax on these gains is not counted."]);
  assert.deepEqual(w({ state: { counted: false, name: null } }).watch, ["State income tax on these gains is not counted."]);
  // all four, in this order; and none of them when no year has room
  assert.equal(w({ extra: { years: [2031], tax: 400, why: ["ss"] }, marketplace: { years: [2027], cliff: null }, medicare: { years: [2030], line: 109000, over: [2030] }, state: { counted: false, name: null } }).watch.length, 4);
  assert.deepEqual(w({ roomYears: 0, next: [], total: 0, extra: { years: [2031], tax: 400, why: ["ss"] }, state: { counted: false, name: null } }).watch, []);
  // a year's second line (all of that year's room)
  assert.equal(gainsYearLine({ room: 30000 }, money), "");
  assert.equal(gainsYearLine({ room: 30000, extraTax: 1100, ssMore: 9000, seniorLost: 0, state: 2300, cliffRoom: 12300, medicare: { over: true, room: 9000 } }, money, "California"), "$1,100 more tax on Social Security · $2,300 California tax · marketplace help stops past $12,300 · Medicare premiums go up past $9,000");
  assert.equal(gainsYearLine({ room: 30000, extraTax: 132, ssMore: 0, seniorLost: 1324 }, money), "$132 more tax: a smaller deduction for 65 and over");
  assert.equal(gainsYearLine({ room: 30000, extraTax: 700, ssMore: 4000, seniorLost: 600 }, money), "$700 more tax on Social Security and a smaller deduction for 65 and over");
  assert.equal(gainsYearLine({ room: 30000, cliffRoom: Infinity, medicare: { over: false } }, money), "", "no line under the larger credits; Medicare not passed");
  assert.equal(gainsYearLine({ room: 30000, cliffRoom: 30000 }, money), "", "the help lasts the whole room");
  assert.equal(gainsYearLine({ room: 30000, state: 0.4 }, money, "Georgia"), "", "under $1 of state tax is not said");
  // amounts under $50 are left out (critic P7: "$5 more tax" beside $68,642)
  assert.equal(GAINS_SMALL, 50);
  assert.equal(gainsYearLine({ room: 68642, extraTax: 5, ssMore: 0, seniorLost: 80 }, money), "");
  assert.equal(gainsYearLine({ room: 67854, extraTax: 55, ssMore: 0, seniorLost: 900 }, money), "$55 more tax: a smaller deduction for 65 and over");
  assert.equal(gainsYearLine({ room: 30000, state: 49 }, money, "Georgia"), "");
  // the status beside the title says what it counts (critic P4)
  assert.deepEqual([gainsStatus(g({})), gainsStatus(g({ roomYears: 1 })), gainsStatus(g({ roomYears: 0 })), gainsStatus(g({ roomYears: 100 }))], ["2 years with room", "1 year with room", "no room", "100 years with room"]);
  assert.ok(gainsStatus(g({ roomYears: 100 })).length <= 20, "one line beside the title at 320 px");
});

test("next-60 #25 S11: Gains you could take tax-free is one shut reading row; open, it holds no box and no button, and nothing is saved", async () => {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  const draw = (plan) => {
    const saved = [], root = new FakeElement("main");
    render(root, { ui, fmt: { ...fmt, today: () => NOV }, plan, route: { group: "taxes", id: "projection", rest: [], query: {} }, module: { group: "taxes", id: "projection" }, store: { get: () => plan, update: (fn) => saved.push(fn) }, redraw() {} });
    return { root, saved };
  };
  const plan = migrate(retiredCouplePlan(NOV));
  const { root, saved } = draw(plan);
  const gains = root.all().find((e) => e.dataset.part === "gains");
  assert.equal(gains.querySelector(".fold-title").textContent, GAINS_TITLE);
  assert.equal(GAINS_TITLE, "Gains you could take tax-free");
  const d = compute(plan, { today: NOV, gains: true });
  assert.equal(gains.querySelector(".fold-status").textContent, `${d.gains.roomYears} years with room`);
  assert.ok(!gains.hasAttribute("open"), "shut until tapped");
  // one card holds this row and How this is worked out, in that order
  const card = root.all().find((e) => e.dataset.parts !== undefined);
  assert.deepEqual(card.all().filter((e) => e.tagName === "DETAILS").map((e) => e.dataset.part), ["gains", "how"]);
  const text = textOf(gains);
  assert.match(text, /Federal tax on the profit from shares held more than a year is 0% while your taxable income stays under \$98,900 \(the 2026 line, rising with prices\)\./);
  // the answer before the list: the plan's profit and the years whose room covers it (critic P3)
  assert.match(text, /We assume about half of what your taxable accounts hold is profit: about \$60,000 in 2026\. The room in 2026 alone would cover it\./);
  assert.ok(text.indexOf("We assume") < text.indexOf("The next 5 years with room:"));
  // the next five years with room, in date order (critic P2)
  const recs = gains.all().filter((e) => e.tagName === "LI" && /\brecords\b/.test(e.parentNode?.className ?? ""));
  assert.deepEqual(recs.map((e) => Number(textOf(e).match(/\d{4}/)[0])), d.gains.next.slice(0, 5).map((y) => y.year));
  assert.deepEqual(d.gains.next.slice(0, 5).map((y) => y.year), [2026, 2027, 2028, 2029, 2030]);
  // no summed room (critics M1, P1), no "$5 more tax" (P7), no Medicare line that does not apply (P5)
  assert.ok(!/In all, about/.test(text) && !/\$5 more tax/.test(text) && !/Medicare/.test(text), text);
  assert.match(text, /What to watch:/);
  assert.match(text, /ask a tax preparer before you count on it\./);
  assert.match(text, /Nothing here changes your plan\./);
  // the next step is the part's last row (critic P8), and only there: More on this keeps its three rows of before
  const last = gains.all().filter((e) => e.tagName === "A").at(-1);
  assert.equal(last.getAttribute?.("href") ?? last.href, "#/taxes/capital-gains");
  assert.match(textOf(last), /What would selling some shares this year cost\?/);
  assert.ok(text.lastIndexOf("Nothing here changes your plan.") < text.indexOf("What would selling some shares this year cost?"));
  assert.equal(gains.all().filter((e) => ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(e.tagName)).length, 0, "information only");
  assert.equal(saved.length, 0);
  // the hero keeps the state's sentence; how brackets rise moved into How this is worked out
  const hero = root.all().find((e) => /\bhero\b/.test(e.className ?? ""));
  assert.ok(!/Brackets and deductions rise/.test(textOf(hero)) && /Arizona income tax is not counted yet\./.test(textOf(hero)));
  assert.match(textOf(root.all().find((e) => e.dataset.part === "how")), /Brackets and deductions rise with the plan's inflation rate\. By law the Social Security thresholds do not, so more of the benefit gets taxed over time\./);
  // More on this: the three rows of before (the Capital gains question lives in the part)
  const more = root.all().find((e) => e.dataset.links !== undefined);
  assert.deepEqual(more.all().filter((e) => e.tagName === "A").map((e) => e.getAttribute?.("href") ?? e.href), ["#/taxes/state", "#/retirement/roth-conversions", "#/retirement/projection"]);
  // no taxable money in any retirement year: no row, How this is worked out alone
  const none = draw(migrate(ARCH["01-single-adult"].build())).root;
  assert.deepEqual(none.all().filter((e) => e.tagName === "DETAILS").map((e) => e.dataset.part).filter((x) => x !== "years"), ["how"]);
});

// The invariance proof (spec section 3.5): nothing new is typed for this row (it has no input), so every plan must give exactly
// the answer of before. Without `gains: true` the compute runs no new line; with it, every key but `gains` is the same.
// (A run against 154a597's own code, every household, is in the builder's log.)
async function everyPlan() {
  const out = [];
  const dir = fileURLToPath(new URL("../../../qa/fixtures/", import.meta.url));
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) out.push({ name: `fixture ${f}:${name}`, plan: fn(NOV) });
  }
  for (const a of ARCHETYPES) out.push({ name: `${a.id}/base`, plan: a.build() });
  for (const [name, fn] of Object.entries(phone)) out.push({ name: `phone ${name}`, plan: fn(NOV) });
  out.push({ name: "empty plan", plan: emptyPlan() });
  return out;
}
test("next-60 #25 invariance: with or without the row, every existing figure of Tax, year by year is the same, for every invented household", async () => {
  const all = await everyPlan();
  assert.ok(all.length >= 30, `${all.length} plans`);
  let withRow = 0;
  for (const { name, plan } of all) for (const real of [true, false]) {
    const p = migrate(structuredClone(plan));
    const run = (o) => { try { return compute(structuredClone(p), { today: NOV, real, ...o }); } catch (e) { return { threw: e.message }; } };
    const before = run({}), after = run({ gains: true });
    assert.ok(!("gains" in before), `${name}: no gains unless asked`);
    if (after.gains) withRow++;
    const { gains, ...rest } = after;
    assert.equal(JSON.stringify(rest), JSON.stringify(before), `${name}${real ? "" : " (each year's dollars)"}`);
  }
  assert.ok(withRow >= 10, `${withRow} draws with the row`);
});

// ---------------------------------------------------------------- fix round r2: room past the plan's own gain
// The invented family (qa/fixtures/family-plan.mjs): 2055's room is $64,117 and the plan's gain $19,645, taken there in full;
// 2066 to 2069 had $41,977 to $43,921 of room each, listed with $2,394 to $2,765 of tax for taking all of it, after the gain
// was used up. Each record now says what the plan's own gain does that year.
test("r2: each year taken carries what taking that amount adds; their sums are the part's own totals", () => {
  const plans = [retiredCouplePlan(NOV), familyNow(NOV), ...ARCHETYPES.map((a) => a.build())];
  let partial = 0;
  for (const plan of plans) for (const real of [true, false]) {
    const g = gainsOf(plan, { real }).gains;
    if (!g || !g.roomYears) continue;
    for (const t of g.taken) for (const k of ["extraTax", "ssMore", "seniorLost", "niitMore"]) assert.ok(Number.isFinite(t[k]), `${t.year} ${k}`);
    // extra: the years where it adds a dollar or more, and their sum; the state's total; Medicare's years past its line
    const ex = g.taken.filter((t) => t.extraTax >= 1);
    if (g.extra) { assert.deepEqual(g.extra.years, ex.map((t) => t.year)); near(g.extra.tax, ex.reduce((a, t) => a + t.extraTax, 0), 1e-6); } else assert.equal(ex.length, 0);
    if (g.state?.total) near(g.state.total, g.taken.reduce((a, t) => a + (t.state ?? 0), 0), 1e-6);
    if (g.medicare) assert.deepEqual(g.medicare.over, g.taken.filter((t) => t.medicareOver).map((t) => t.year));
    // a year whose whole room is taken costs what its own figures say for all of it; part of it costs no more than all
    for (const t of g.taken) {
      const y = g.next.find((v) => v.year === t.year);
      if (t.amount >= y.room - 1e-9) { near(t.extraTax, y.extraTax, 1e-6); if (y.state !== undefined) near(t.state, y.state, 1e-6); }
      else { partial++; assert.ok(t.extraTax <= y.extraTax + 1e-6, `${t.year}: part of the room costs no more than all of it`); }
    }
  }
  assert.ok(partial >= 5, `${partial} years where the gain uses part of the room`);
});

test("r2: a year's line beside its room, one case each: all of it used, part of it used, none of it left", () => {
  const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
  const y = { room: 64117, extraTax: 1076, ssMore: 0, seniorLost: 0, niitMore: 1076, cliffRoom: undefined };
  // all of its room used: as before
  assert.equal(gainsUseLine(y, { amount: 64117 }, money), gainsYearLine(y, money));
  assert.equal(gainsUseLine(y, { amount: 64116.8 }, money), "$1,076 more tax: the 3.8% tax on investment income");
  // part of it: what the plan's gain uses, then what taking that much adds (nothing worth a line here)
  assert.equal(gainsUseLine(y, { amount: 19645.4, extraTax: 0, ssMore: 0, seniorLost: 0, niitMore: 0 }, money), "taking all your profit would use $19,645 of it");
  assert.equal(gainsUseLine({ room: 80580, extraTax: 437, ssMore: 2000 }, { amount: 60000, extraTax: 437, ssMore: 2000, seniorLost: 0, niitMore: 0 }, money), "taking all your profit would use $60,000 of it · $437 more tax on Social Security");
  assert.equal(gainsUseLine({ room: 120832, state: 4458 }, { amount: 100477, extraTax: 0, ssMore: 0, seniorLost: 0, niitMore: 0, state: 3646 }, money, "North Carolina"), "taking all your profit would use $100,477 of it · $3,646 North Carolina tax");
  // the marketplace's line and Medicare's are said only when what is taken passes them
  const mk = { room: 102045, cliffRoom: 34769, medicare: { over: true, room: 79928 } };
  assert.equal(gainsUseLine(mk, { amount: 30000, extraTax: 0, ssMore: 0, seniorLost: 0, niitMore: 0, medicareOver: false }, money), "taking all your profit would use $30,000 of it");
  assert.equal(gainsUseLine(mk, { amount: 90000, extraTax: 0, ssMore: 0, seniorLost: 0, niitMore: 0, medicareOver: true }, money), "taking all your profit would use $90,000 of it · marketplace help stops past $34,769 · Medicare premiums go up past $79,928");
  // none of it: the gain is used up before this year
  assert.equal(gainsUseLine(y, undefined, money), "you would already have taken all your profit by then");
  // after an earlier year took part of it: what is left (a person critic's P4: "your profit uses" read as already taken)
  assert.equal(gainsUseLine(y, { amount: 19645.4, extraTax: 0, ssMore: 0, seniorLost: 0, niitMore: 0 }, money, null, { rest: true }), "the rest of your profit would use $19,645 of it");
  for (const t of [gainsUseLine(y, undefined, money), gainsUseLine(y, { amount: 1, extraTax: 0 }, money)]) assert.ok(!/used up|profit uses/.test(t), t);
});

test("r2 the page: the family's records say what their $19,645 of gain uses, and no year lists tax for room their gain cannot reach", async () => {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  const draw = (plan) => { const root = new FakeElement("main"); render(root, { ui, fmt: { ...fmt, today: () => NOV }, plan, route: { group: "taxes", id: "projection", rest: [], query: {} }, module: { group: "taxes", id: "projection" }, store: { get: () => plan, update() {} }, redraw() {} }); return root; };
  const recsOf = (root) => root.all().find((e) => e.dataset.part === "gains").all().filter((e) => e.tagName === "LI" && /\brecords\b/.test(e.parentNode?.className ?? "")).map((e) => textOf(e).replace(/\s+/g, " ").trim());
  assert.deepEqual(recsOf(draw(migrate(familyNow(NOV)))), [
    "2055 · ages 65 / 67 $64,117 taking all your profit would use $19,645 of it",
    "2066 · ages 76 / 78 $43,921 you would already have taken all your profit by then",
    "2067 · ages 77 / 79 $43,367 you would already have taken all your profit by then",
    "2068 · ages 78 / 80 $42,651 you would already have taken all your profit by then",
    "2069 · ages 79 / 81 $41,977 you would already have taken all your profit by then"]);
  // the retired couple: $60,000 of 2026's $80,580, and what taking it adds ($437, all of Social Security that can be taxed)
  const rc = recsOf(draw(migrate(retiredCouplePlan(NOV))));
  assert.equal(rc[0], "2026 · ages 72 / 69 $80,580 taking all your profit would use $60,000 of it · $437 more tax on Social Security");
  assert.ok(rc.slice(1).every((t) => t.endsWith("you would already have taken all your profit by then")), rc.join(" | "));
  // a gain bigger than a year's room: the whole room used, the line as before (the surviving spouse's 2031 and 2032)
  const qs = recsOf(draw(migrate(ARCH["14-unusual-structures"].build())));
  assert.equal(qs[0], "2031 · age 64 $102,045 marketplace help stops past $34,769 · Medicare premiums go up past $79,928");
  assert.equal(qs[2], "2033 · age 66 $99,568 the rest of your profit would use $29,025 of it");
});

test("r2 invariance: with the gains asked, each year taken keeps its year and amount and only gains its costs; without, nothing moves", async () => {
  const all = await everyPlan();
  let some = 0;
  const NEW = ["extraTax", "ssMore", "seniorLost", "niitMore", "state", "medicareOver"];
  for (const { name, plan } of all) for (const real of [true, false]) {
    const p = migrate(structuredClone(plan));
    const g = compute(structuredClone(p), { today: NOV, real, gains: true }).gains;
    if (!g) continue;
    some++;
    for (const t of g.taken) assert.deepEqual(Object.keys(t).filter((k) => !NEW.includes(k)), ["year", "amount"], name);
  }
  assert.ok(some >= 10, `${some} draws with the row`);
});

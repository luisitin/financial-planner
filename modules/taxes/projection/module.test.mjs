// The full checks for this page are in tests/tax-pages.test.mjs (fixture qa/fixtures/tax-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, stateLine } from "./compute.js";
import { taxPlan } from "../../../qa/fixtures/tax-plan.mjs";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";
import { stateIncomeTax } from "../../../core/math/state-tax.js";
import { retiredCouplePlan } from "../../../qa/fixtures/retired-couple-plan.mjs";

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

test("S11: the page saves nothing; its parts are the helper's (N more years, How this is worked out), shut, and say the state's rules", async () => {
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
  assert.deepEqual(parts, [["years", "more", false], ["how", "how", false]], "two parts, shut; no fold by hand");
  const years = root.all().find((e) => e.dataset.part === "years"), how = root.all().find((e) => e.dataset.part === "how");
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
  const outside = textOf(root).replace(textOf(how), "").replace(textOf(years), "");
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

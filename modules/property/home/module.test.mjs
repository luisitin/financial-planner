import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, growthRate, twoYearTest, fullMonths, addMonthsEnd, DEFAULTS, EXCLUSION } from "./compute.js";
import { compute as computeMortgage } from "../../debt/mortgage/compute.js";
import { yearOfPayments } from "../../cashflow/statement/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const withDetails = (extra = {}) => { const p = familyPlan(TODAY); p.property = [{ id: "h1", kind: "home", accountId: "a-home", purchasePrice: 310000, purchaseDate: "2022-06-01", improvements: 15000, propertyTax: 4800, insurance: 1900, ...extra }]; return p; };

test("growthRate: compounded a year; nothing under a year", () => {
  near(growthRate(100, 121, 24), 0.1, 1e-9);
  assert.equal(growthRate(100, 120, 6), null); assert.equal(growthRate(0, 120, 24), null);
});

test("no home: not ready", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).ready, false);
});

test("the family's house: worth, owed, yours, and growth since 2022", () => {
  const d = compute(withDetails(), { today: TODAY });
  assert.equal(d.value, 380000); assert.equal(d.owed, 265000); assert.equal(d.equity, 115000);
  near(d.equityShare, 115000 / 380000); near(d.ltv, 265000 / 380000);
  near(d.bought.growth, Math.pow(380000 / 310000, 12 / 52) - 1, 1e-9);
});

test("a year of keeping it: tax, insurance, upkeep at 1% and the mortgage's interest", () => {
  const p = withDetails();
  const d = compute(p, { today: TODAY });
  const pay = yearOfPayments(265000, 0.0625, 1980);
  near(d.costs.total, 4800 + 1900 + 380000 * DEFAULTS.maintenance + pay.interest);
  near(d.costs.principal, pay.principal);
  const noTax = compute(familyPlan(TODAY), { today: TODAY });
  assert.ok(!noTax.costs.lines.some((l) => l.key === "tax"), "no property tax typed anywhere");
});

test("selling today: costs, the mortgage, and no tax under the joint exclusion", () => {
  const d = compute(withDetails(), { today: TODAY });
  near(d.sale.costs, 380000 * 0.06); near(d.sale.gain, 380000 - 22800 - 325000);
  assert.equal(d.sale.exclusion, EXCLUSION.married_joint); assert.equal(d.sale.tax, 0);
  near(d.sale.net, 380000 - 22800 - 265000);
});

test("a big gain above the exclusion is taxed at the gains rate", () => {
  const d = compute(withDetails({ purchasePrice: 100000, improvements: 0, purchaseDate: "1990-01-01" }), { today: TODAY });   // a 257,200 gain: still under 500,000
  const p = withDetails({ purchasePrice: 50000, improvements: 0, purchaseDate: "1985-01-01" });
  p.accounts.find((a) => a.id === "a-home").balance = 1200000;
  const big = compute(p, { today: TODAY });
  near(big.sale.taxable, 1200000 * 0.94 - 50000 - 500000);
  assert.ok(big.sale.rate >= 0.15); near(big.sale.tax, big.sale.taxable * big.sale.rate); assert.equal(big.sale.term, "long");
  assert.equal(d.sale.tax, 0);
});

test("ahead: the value growing, the mortgage on the mortgage page's schedule", () => {
  const p = withDetails();
  const d = compute(p, { today: TODAY });
  const sch = computeMortgage(p, { today: TODAY }).schedule;
  const five = d.ahead.find((a) => a.years === 5);
  near(five.value, 380000 * Math.pow(1.035, 5)); near(five.owed, sch.find((r) => r.year === 5).endBalance);
  near(five.equity, five.value - five.owed);
  assert.equal(d.ahead.find((a) => a.years === 20).owed, 0, "paid off by then");
});

// one adult filing single, typed wages, a home account and its details (the answer key's household, RULES.md 9.5-9.6)
function keyHome(wages, home, value, loan) {
  const p = emptyPlan();
  p.household.people = [{ id: "a1", name: "Adult 1", role: "self", birthDate: "1980-01-01" }];
  p.household.filingStatus = "single"; p.household.state = "";
  p.taxes.year = 2026; p.taxes.thisYear.wages = wages;
  p.accounts = [{ id: "home", name: "Home", type: "property", balance: value }];
  if (loan) { p.accounts.push({ id: "mtg", name: "Mortgage", type: "mortgage", balance: loan.balance }); p.debts = [{ id: "d1", accountId: "mtg", rate: loan.rate, minPayment: loan.payment, extra: 0 }]; }
  p.property = [{ id: "h1", kind: "home", accountId: "home", name: "Home", ...home }];
  return p;
}

test("the two-year test: 730 days or 24 full months, whichever comes first; a month-end purchase counts month ends (26 CFR 1.121-1(c)(1))", () => {
  assert.deepEqual(twoYearTest("2025-05-16", "2026-11-16"), { days: 549, months: 18, meets: false, from: "2027-05-16" });
  // a February 29 inside: 730 days a day before 24 full months
  const t = twoYearTest("2023-11-02", "2025-11-01"); assert.equal(t.days, 730); assert.equal(t.months, 23); assert.equal(t.meets, true);
  assert.equal(fullMonths("2024-02-29", "2026-02-28"), 24); assert.equal(addMonthsEnd("2024-01-31", 1), "2024-02-29");
  assert.equal(addMonthsEnd("2024-01-15", 1), "2024-02-15");
});

test("Pat's home, bought 18 months ago: no exclusion, the 27,400 gain at 15% is 4,110; bought 10 months ago it is taxed like pay, 6,040 (IRC 121(a), 1222; RULES.md 9.5)", () => {
  const pat = { purchasePrice: 400000, purchaseDate: "2025-05-16", improvements: 5000, propertyTax: 5500, insurance: 1600 };
  const d = compute(keyHome(95000, pat, 460000, { balance: 360000, rate: 0.06, payment: 2200 }), { today: "2026-11-16" });
  near(d.sale.gain, 27400); assert.equal(d.sale.exclusion, 0); near(d.sale.taxable, 27400);
  assert.equal(d.sale.term, "long"); assert.equal(d.sale.longOn, "2026-05-17");
  near(d.sale.tax, 4110); near(d.sale.net, 68290);
  const recent = compute(keyHome(95000, { ...pat, purchaseDate: "2026-01-16" }, 460000, { balance: 360000, rate: 0.06, payment: 2200 }), { today: "2026-11-16" });
  assert.equal(recent.sale.term, "short"); near(recent.sale.tax, 6040);   // 22% x 26,800 + 24% x 600
  // selling early for a new job: 549/730 of 250,000 (more than 18/24 by months) covers the gain (121(c); 1.121-3(g))
  const moved = compute(keyHome(95000, { ...pat, reducedReason: true }, 460000, { balance: 360000, rate: 0.06, payment: 2200 }), { today: "2026-11-16" });
  near(moved.sale.exclusion, 188013.70); near(moved.sale.tax, 0); near(moved.sale.net, 72400);
});

test("Quinn's long-held home: 450,000 taxable, stacked through 15% and 20%, the 3.8% only on income over 200,000: 87,260 (IRC 1(h), 1411; RULES.md 9.6)", () => {
  const d = compute(keyHome(180000, { purchasePrice: 380000, purchaseDate: "2004-06-15", improvements: 48000 }, 1200000, { balance: 150000, rate: 0.04, payment: 1600 }), { today: "2026-11-16" });
  near(d.sale.gain, 700000); assert.equal(d.sale.test.meets, true); near(d.sale.taxable, 450000);
  near(d.sale.incomeTax, 70920); near(d.sale.niit, 16340); near(d.sale.tax, 87260); near(d.sale.net, 890740);
});

// filing separately, two adults with 90,000 of wages each (typed 180,000), the home worth 700,000, bought 2010 for 300,000
function separateHome(ownerId) {
  const p = keyHome(180000, { purchasePrice: 300000, purchaseDate: "2010-06-15" }, 700000);
  p.household.people.push({ id: "a2", name: "Adult 2", role: "spouse", birthDate: "1980-01-01" });
  p.household.filingStatus = "married_separate";
  p.accounts[0].ownerId = ownerId;
  return p;
}

test("filing separately: a home in neither name is half each, each half with its own $250,000 (26 CFR 1.121-2(a)(2))", () => {
  // gain 700,000 - 42,000 of costs - 300,000 = 358,000: 179,000 on each return, under each $250,000
  const d = compute(separateHome(""), { today: TODAY });
  near(d.sale.gain, 358000); assert.equal(d.sale.owners, 2); near(d.sale.cap, 500000); near(d.sale.taxable, 0); near(d.sale.tax, 0);
  // in Adult 1's name: one $250,000; 108,000 on their return: all at 15% (ordinary taxable 73,900 is past the 49,450 line) = 16,200,
  // plus 3.8% of the 73,000 of income over the 125,000 separate line = 2,774
  const e = compute(separateHome("a1"), { today: TODAY });
  assert.equal(e.sale.owners, 1); near(e.sale.taxable, 108000); near(e.sale.niit, 2774); near(e.sale.tax, 18974);
});

test("no purchase date: the sale is worked as if the two years were met, and the page is told the date is missing", () => {
  const d = compute(keyHome(95000, { purchasePrice: 400000, improvements: 5000 }, 800000), { today: TODAY });
  assert.equal(d.sale.dateMissing, true); assert.equal(d.sale.test, null);
  assert.equal(compute(keyHome(95000, { purchasePrice: 400000, purchaseDate: "2020-01-01" }, 800000), { today: TODAY }).sale.dateMissing, false);
});

test("the 3.8% line comes from the engine: $250,000 for a qualifying surviving spouse (IRC 1411(b)(1))", () => {
  const p = keyHome(95000, { purchasePrice: 400000, purchaseDate: "2020-01-01" }, 800000);
  p.household.filingStatus = "qualifying_surviving"; p.household.people.push({ id: "k", name: "Child", role: "dependent", birthDate: "2015-01-01" });
  assert.equal(compute(p, { today: TODAY }).sale.niitLine, 250000);
  assert.equal(compute(keyHome(95000, { purchasePrice: 400000 }, 800000), { today: TODAY }).sale.niitLine, 200000);
});

// ---- "Work done on the home": a dated list of jobs and the last 12 months against the upkeep counted (gap list, next 60, item 56)
import { upkeepLog, yearAgo, logLine, sharePct, UNEVEN, LOG_INTRO, useConfirmWords, useSavedWords, useUndoneWords, removeConfirmWords, removedWords, restoredWords, addedWords, jobFrom, CLOSE, USE_MAX, USE_MIN_JOBS, isDay, withoutJob,
  improvementOf, improvementsWith, improvementOff, IMPROVE_HINT, JOB_KEYS } from "./compute.js";
import { migrate } from "../../../core/schema/migrate.js";

const T15 = "2026-11-15";
const $ = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
/** The family's house ($380,000, upkeep counted at 1%: $3,800 a year) with these jobs on its entry. */
const withJobs = (jobs, extra = {}) => { const p = familyPlan(T15); p.property = [{ id: "h1", kind: "home", accountId: "a-home", jobs, ...extra }]; return p; };
const logFor = (jobs, extra) => upkeepLog(compute(withJobs(jobs, extra), { today: T15 }), T15);
const job = (id, date, cost, what = `Job ${id}`) => ({ id, date, what, cost });
/** A job from before the last 12 months: with it the list reaches back a whole year, so the year can be compared (it counts in no total here). */
const OLD = job("o", "2025-06-12", 180, "Furnace serviced");

test("the last 12 months: after the same day a year ago, up to today; month ends go to month ends", () => {
  assert.equal(yearAgo("2026-11-15"), "2025-11-15");
  assert.equal(yearAgo("2028-02-29"), "2027-02-28");
  assert.equal(yearAgo("2026-03-31"), "2025-03-31");
  const log = logFor([job("a", "2025-11-15", 900), job("b", "2025-11-16", 1200), job("c", T15, 450), job("d", "2026-12-01", 5000)]);
  assert.deepEqual([log.year.from, log.year.to, log.year.count], ["2025-11-15", T15, 2], "a year ago to the day is out, the next day and today are in, a later day is out");
  assert.equal(log.year.total, 1650, "1,200 + 450 by hand");
  assert.equal(log.count, 4, "every job is listed, the later one too");
});

test("the list: newest first; on the same day the one added later first; a job without a day is not listed; a blank cost counts $0", () => {
  const log = logFor([job("a", "2026-03-02", 300), job("b", "2026-07-20", null), job("c", "2026-03-02", 120), { id: "x", what: "no day", cost: 50 }, null]);
  assert.deepEqual(log.jobs.map((j) => j.id), ["b", "c", "a"]);
  assert.equal(log.year.total, 420);
});

test("the comparison: every case by hand against the $3,800 a year of upkeep the family's page counts", () => {
  const d0 = compute(familyPlan(T15), { today: T15 });
  assert.equal(d0.costs.lines.find((l) => l.key === "maintenance").amount, 3800, "1% of $380,000");
  const cases = [
    [[], "empty", null],
    [[job("a", "2024-05-01", 2000)], "none", "Nothing logged in the last 12 months. This page counts $3,800 a year of upkeep."],
    [[OLD, job("a", "2026-05-01", 3650)], "close", "In the last 12 months you logged $3,650 of work, about the $3,800 a year of upkeep this page counts."],
    [[OLD, job("a", "2026-05-01", 1450), job("b", "2026-09-10", 700)], "less", "In the last 12 months you logged $2,150 of work, $1,650 less than the $3,800 a year of upkeep this page counts."],
    [[OLD, job("a", "2026-01-12", 5000)], "more", "In the last 12 months you logged $5,000 of work, $1,200 more than the $3,800 a year of upkeep this page counts."],
  ];
  for (const [jobs, kase, words] of cases) {
    const log = logFor(jobs);
    assert.equal(log.case, kase, kase);
    assert.equal(logLine(log, $), words, kase);
  }
  // within 10% of the upkeep is "about": $3,420 is exactly 10% under, $3,419 is not
  assert.equal(CLOSE, 0.1);
  assert.equal(logFor([OLD, job("a", "2026-05-01", 3420)]).case, "close");
  assert.equal(logFor([OLD, job("a", "2026-05-01", 3419)]).case, "less");
  assert.equal(logFor([OLD, job("a", "2026-05-01", 4180)]).case, "close");
  assert.equal(logFor([OLD, job("a", "2026-05-01", 4181)]).case, "more");
  // no upkeep counted (the share set to 0)
  const none = logFor([OLD, job("a", "2026-05-01", 2150)], { maintenance: 0 });
  assert.equal(none.case, "no-upkeep");
  assert.equal(logLine(none, $), "In the last 12 months you logged $2,150 of work. This page counts no upkeep.");
  const old = logFor([job("a", "2023-05-01", 2150)], { maintenance: 0 });
  assert.equal(old.case, "none-no-upkeep");
  assert.equal(logLine(old, $), "Nothing logged in the last 12 months, and this page counts no upkeep.");
  assert.equal(UNEVEN, "One year can be uneven: a roof or a furnace comes once in many years.");
  assert.equal(LOG_INTRO, "Keep a dated list of work on the home: handy when you sell, and a check on the upkeep this page counts.");
});

test("\"Use $X a year\": the share is X over the value to 7 decimals, so the upkeep counted rounds back to X; the year after, by hand", () => {
  const log = logFor([OLD, job("a", "2026-05-01", 1450), job("b", "2026-09-10", 700)]);
  assert.equal(log.use.yearly, 2150);
  assert.equal(log.use.rate, 0.0056579, "2,150 / 380,000 = 0.00565789... to 7 decimals");
  const d0 = compute(withJobs(log.jobs), { today: T15 });
  near(log.use.total, d0.costs.total - 3800 + 380000 * 0.0056579);
  const after = compute(withJobs(log.jobs, { maintenance: log.use.rate }), { today: T15 });
  assert.equal(Math.round(after.costs.lines.find((l) => l.key === "maintenance").amount), 2150, "the page now counts $2,150");
  near(after.costs.total, log.use.total);
  assert.equal(upkeepLog(after, T15).use, null, "once used, nothing more to offer");
  assert.equal(upkeepLog(after, T15).case, "equal");
  assert.equal(logLine(upkeepLog(after, T15), $), "In the last 12 months you logged $2,150 of work, the same as the yearly upkeep this page counts.");
  assert.deepEqual([sharePct(0.01), sharePct(0.0056579), sharePct(0.035), sharePct(0)], ["1.0%", "0.57%", "3.5%", "0.0%"]);
  // the words, in full
  assert.equal(useConfirmWords(log, $), "Count upkeep at $2,150 a year from now on? That is 0.57% of the home's $380,000 value; a year of owning it changes with it.");
  assert.equal(useSavedWords(log, $), `Saved. Upkeep is now counted at $2,150 a year (0.57% of the value): a year of owning it comes to ${$(log.use.total)}.`);
  assert.equal(useUndoneWords(log, $), "Upkeep is back at $3,800 a year (1.0% of the value).");
  // over the details box's 10% the button is not offered; nor for $0 of jobs; nor for a home worth $0
  assert.equal(USE_MAX, 0.1);
  assert.ok(logFor([OLD, job("a", "2026-05-01", 19000), job("b", "2026-06-01", 19000)]).use, "exactly 10%");
  assert.equal(logFor([OLD, job("a", "2026-05-01", 19000), job("b", "2026-06-01", 19001)]).use, null);
  assert.equal(logFor([OLD, job("a", "2026-05-01", null), job("b", "2026-06-01", null)]).use, null);
  const p = withJobs([OLD, job("a", "2026-05-01", 900), job("b", "2026-06-01", 300)]); p.accounts.find((a) => a.id === "a-home").balance = 0;
  assert.equal(upkeepLog(compute(p, { today: T15 }), T15).use, null);
  // the same as counted already (within $1): nothing to change
  assert.equal(logFor([OLD, job("a", "2026-05-01", 1900), job("b", "2026-06-01", 1900.4)]).use, null);
});

test("a job from the form: what and the day are needed; a blank cost is no cost; a later day is refused", () => {
  assert.deepEqual(jobFrom({ date: "2026-10-02", what: "  New   water heater ", cost: 1450, note: " in the garage " }, { id: "j1", today: T15 }),
    { job: { id: "j1", date: "2026-10-02", what: "New water heater", cost: 1450, note: "in the garage" } });
  assert.deepEqual(jobFrom({ date: "2026-10-02", what: "Gutters", cost: null, note: "" }, { id: "j2", today: T15 }), { job: { id: "j2", date: "2026-10-02", what: "Gutters", cost: null } });
  assert.deepEqual(jobFrom({ date: "2026-10-02", what: " ", cost: 5 }, { id: "j3", today: T15 }), { error: "what", words: "Say what was done, like \"New water heater\"." });
  assert.deepEqual(jobFrom({ date: "", what: "Roof", cost: 5 }, { id: "j4", today: T15 }), { error: "date", words: "Pick the day it was done." });
  assert.deepEqual(jobFrom({ date: "2026-11-16", what: "Roof", cost: 5 }, { id: "j5", today: T15 }), { error: "date", words: "That day is still ahead: pick the day it was done." });
  assert.equal(removeConfirmWords({ what: "New water heater" }), "Remove \"New water heater\" from the list?");
  assert.equal(removedWords({ what: "New water heater" }), "Removed \"New water heater\" from the list.");
  assert.equal(restoredWords({ what: "New water heater" }), "\"New water heater\" is back on the list.");
  assert.equal(addedWords({ what: "New water heater", cost: 1450 }, $), "Added \"New water heater\", $1,450, to the list.");
  assert.equal(addedWords({ what: "Gutters", cost: null }, $), "Added \"Gutters\" to the list.");
});

test("gap next-60 #56 invariance: over the four fixture plans and the invented households, compute() is the same with a list of jobs as without, but for the entry it echoes", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const plans = [["family", familyPlan(T15)], ["renterDebt", renterDebtPlan()], ["retiredCouple", retiredCouplePlan(T15)], ["empty", emptyPlan()], ...ARCHETYPES.map((a) => [a.id, a.build()])];
  assert.ok(plans.length >= 18);
  let homes = 0;
  for (const [name, p0] of plans) {
    const p = migrate(structuredClone(p0));
    const a = compute(p, { today: T15 });
    assert.equal(JSON.stringify(compute(structuredClone(p), { today: T15 })), JSON.stringify(a), name);
    if (!a.ready) continue;
    homes++;
    const q = structuredClone(p);
    q.property = Array.isArray(q.property) ? q.property : [];
    let x = q.property.find((e) => (e.kind ?? "home") === "home" && e.accountId === a.accountId);
    if (!x) { x = { id: "inv", kind: "home", accountId: a.accountId }; q.property.push(x); }
    x.jobs = [job("a", "2026-05-01", 1450), job("b", "2026-09-10", 700)];
    const { details: d1, ...b } = compute(q, { today: T15 });
    const { details: d0, ...rest } = a;
    assert.equal(JSON.stringify(b), JSON.stringify(rest), `${name}: a list of jobs changes no figure`);
    assert.deepEqual(d1.jobs, x.jobs);
  }
  assert.ok(homes >= 12, `${homes} homes checked`);
});

// ---- the page, drawn on the stand-in DOM
async function drawHome(plan0, { answer = true } = {}) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js"); const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  const asked = [];
  let cur = migrate(structuredClone(plan0)); const saved = [];
  let n = 0;
  const store = { get: () => cur, update: (fn) => { const dft = structuredClone(cur); fn(dft); cur = dft; saved.push(dft); } };
  const draw = () => {
    const root = new FakeElement("main");
    const ctx = { ui: { ...ui, uid: () => `new-${++n}`, confirm: (q) => { asked.push(q); return answer; } }, fmt: { ...fmt, today: () => T15 }, plan: cur, route: { rest: [], query: {} }, module: { group: "property", id: "home" }, computeOf: () => null, store };
    render(root, ctx);
    return root;
  };
  return { draw, saved, asked, textOf, plan: () => cur };
}
const partsOpen = (root) => Object.fromEntries(root.querySelectorAll("details").filter((x) => x.dataset.part).map((x) => [x.dataset.part, x.hasAttribute("open")]));
const partEl = (root, id) => root.querySelectorAll("details").find((x) => x.dataset.part === id);
const btn = (root, words) => root.querySelectorAll("button").find((b) => b.textContent === words);
const box = (el, name) => el.querySelector(`[name="${name}"]`);

test("the page: one quiet row under the year of owning it, shut, no status while empty; opening writes nothing; no fold by hand", async () => {
  const a = await drawHome(withDetails());
  const root = a.draw();
  const log = partEl(root, "log");
  assert.ok(log, "the row is there");
  assert.equal(a.textOf(log.querySelector(".fold-title")).trim(), "Work done on the home");
  assert.equal(log.querySelector(".fold-status"), null, "no status while the list is empty");
  assert.equal(log.hasAttribute("open"), false);
  assert.deepEqual(partsOpen(root), { log: false, value: false, details: false }, "the details are shut once a price is saved");
  assert.equal(root.querySelectorAll("details").filter((x) => !x.dataset.part && !x.className.includes("form-more")).length, 0, "no fold by hand (R10)");
  const t = a.textOf(log);
  assert.match(t, /Keep a dated list of work on the home: handy when you sell, and a check on the upkeep this page counts\./);
  assert.ok(box(log, "date") && box(log, "what") && box(log, "cost"), "an empty list keeps its form open inside the part (R20)");
  assert.equal(box(log, "date").value, T15, "today, ready");
  assert.equal(a.saved.length, 0, "drawing writes nothing");
  const fresh = await drawHome(familyPlan(T15));
  assert.equal(partsOpen(fresh.draw()).details, true, "with no price yet the details are open, as before");
});

test("S11 (R17): adding a job saves it on the home, keeps only that part open with its green line, and the row counts it", async () => {
  const a = await drawHome(withDetails());
  let root = a.draw();
  const form = box(partEl(root, "log"), "what").closest("form");
  box(form, "what").value = "New water heater"; box(form, "cost").value = "1450"; box(form, "date").value = "2026-10-02";
  form.dispatch("submit");
  assert.equal(a.saved.length, 1);
  const entry = a.plan().property.find((x) => x.kind === "home");
  assert.deepEqual(entry.jobs, [{ id: "new-1", date: "2026-10-02", what: "New water heater", cost: 1450 }]);
  assert.equal(entry.purchasePrice, 310000, "the rest of the entry is kept");
  assert.deepEqual(a.saved[0].accounts, withDetails().accounts.map((x) => x), "nothing else changes");
  root = a.draw();
  assert.deepEqual(partsOpen(root), { log: true, value: false, details: false }, "the part just saved stays open, no other moves");
  const t = a.textOf(partEl(root, "log"));
  assert.match(t, /Added "New water heater", \$1,450, to the list\./);
  // a list that starts inside the last 12 months says so, and offers no yearly figure (s3 fix P1)
  assert.match(t, /Your list starts in October 2026, so it cannot show a whole year yet\. So far it holds \$1,450 of work\./);
  assert.doesNotMatch(t, /One year can be uneven|less than the/);
  assert.equal(a.textOf(partEl(root, "log").querySelector(".fold-status")).trim(), "1 job");
  assert.equal(btn(root, "Use $1,450 a year"), undefined, "a month of jobs is not a year's figure");
  assert.ok(btn(root, "+ Add another job"), "the form folds behind its outlined button once the list has a job (R20)");
  assert.equal(box(partEl(root, "log"), "what"), null);
  root = a.draw();
  assert.deepEqual(partsOpen(root), { log: false, value: false, details: false }, "the next visit opens shut");
  // a job with no words is refused and nothing is saved
  const b = await drawHome(withDetails());
  const r2 = b.draw(); const f2 = box(partEl(r2, "log"), "what").closest("form");
  box(f2, "what").value = ""; box(f2, "cost").value = "90";
  f2.dispatch("submit");
  assert.equal(b.saved.length, 0, "no job without what was done");
});

test("remove asks first; No changes nothing; Yes removes it with a green line and Undo, which puts it back", async () => {
  const jobs = [job("a", "2026-05-01", 1450, "New water heater"), job("b", "2026-09-10", 700, "Gutters")];
  const no = await drawHome(withJobs(jobs, { purchasePrice: 310000 }), { answer: false });
  btn(no.draw(), "Remove").click();
  assert.deepEqual(no.asked, ["Remove \"Gutters\" from the list?"], "the newest first, asked first");
  assert.equal(no.saved.length, 0, "No keeps it");
  const a = await drawHome(withJobs(jobs, { purchasePrice: 310000 }));
  btn(a.draw(), "Remove").click();
  assert.equal(a.saved.length, 1);
  assert.deepEqual(a.plan().property[0].jobs.map((j) => j.id), ["a"]);
  let root = a.draw();
  assert.equal(partsOpen(root).log, true);
  assert.match(a.textOf(partEl(root, "log")), /Removed "Gutters" from the list\./);
  btn(root, "Undo").click();
  assert.deepEqual(a.plan().property[0].jobs.map((j) => j.id), ["a", "b"], "Undo puts it back where it was");
  root = a.draw();
  assert.equal(partsOpen(root).log, true);
  assert.match(a.textOf(partEl(root, "log")), /"Gutters" is back on the list\./);
});

test("\"Use $2,150 a year\" asks first, then counts upkeep at that figure; Undo puts the share back; nothing changes the figure without it", async () => {
  const jobs = [OLD, job("a", "2026-05-01", 1450, "New water heater"), job("b", "2026-09-10", 700, "Gutters")];
  const no = await drawHome(withJobs(jobs, { purchasePrice: 310000 }), { answer: false });
  btn(no.draw(), "Use $2,150 a year").click();
  assert.equal(no.asked[0], "Count upkeep at $2,150 a year from now on? That is 0.57% of the home's $380,000 value; a year of owning it changes with it.");
  assert.equal(no.saved.length, 0, "No changes nothing");
  const a = await drawHome(withJobs(jobs, { purchasePrice: 310000 }));
  btn(a.draw(), "Use $2,150 a year").click();
  assert.equal(a.saved.length, 1);
  assert.equal(a.plan().property[0].maintenance, 0.0056579);
  let root = a.draw();
  const d = compute(a.plan(), { today: T15 });
  assert.match(a.textOf(partEl(root, "log")), new RegExp(`Saved\\. Upkeep is now counted at \\$2,150 a year \\(0\\.57% of the value\\): a year of owning it comes to \\$${Math.round(d.costs.total).toLocaleString("en-US")}\\.`));
  assert.equal(btn(root, "Use $2,150 a year"), undefined, "once used, the button goes");
  btn(root, "Undo").click();
  assert.equal(a.plan().property[0].maintenance, undefined, "Undo takes the share off again: 1% is counted");
  root = a.draw();
  assert.match(a.textOf(partEl(root, "log")), /Upkeep is back at \$3,800 a year \(1\.0% of the value\)\./);
});

// ---- s3 fix (critics' findings M1, M2, M3, P1, P4)
test("s3 fix P1: a list that starts inside the last 12 months cannot show a year: its own sentence, and no \"Use $X a year\"", () => {
  // the critic's walk: two jobs logged today
  const today = logFor([job("a", T15, 1450, "New water heater"), job("b", T15, 300, "Gutters cleaned")]);
  assert.equal(today.case, "new"); assert.equal(today.start, T15); assert.equal(today.use, null);
  assert.equal(logLine(today, $), "Your list starts today, so it cannot show a whole year yet. So far it holds $1,750 of work. Add older jobs with their dates to compare a whole year.");
  const june = logFor([job("a", "2026-06-03", 1450), job("b", "2026-09-10", 700)]);
  assert.equal(june.case, "new"); assert.equal(june.use, null);
  assert.equal(logLine(june, $), "Your list starts in June 2026, so it cannot show a whole year yet. So far it holds $2,150 of work. Add older jobs with their dates to compare a whole year.");
  // with no upkeep counted it is the same sentence: no comparison either way
  assert.equal(logFor([job("a", "2026-06-03", 900)], { maintenance: 0 }).case, "new");
  // a list whose first job is a year ago to the day reaches back a whole year: compared, and Use offered
  const year = logFor([job("o", "2025-11-15", 100), job("a", "2026-06-03", 1450), job("b", "2026-09-10", 700)]);
  assert.equal(year.start, "2025-11-15"); assert.equal(year.case, "less"); assert.equal(year.use.yearly, 2150);
  assert.equal(logFor([job("o", "2025-11-16", 100), job("a", "2026-06-03", 1450)]).case, "new", "the next day is inside the year");
});

test("s3 fix M3: jobs logged with no cost are not \"$0 of work, $3,800 less\": their own sentence, and nothing to use", () => {
  const free = logFor([OLD, job("a", "2026-06-01", null, "Gutters"), job("b", "2026-07-01", "", "Painted the fence"), job("c", "2026-07-02", "abc", "Weeded")]);
  assert.equal(free.case, "no-cost"); assert.equal(free.year.count, 3); assert.equal(free.year.total, 0); assert.equal(free.use, null);
  assert.equal(logLine(free, $), "In the last 12 months you logged 3 jobs, none with a cost, so there is nothing to compare with the $3,800 a year of upkeep this page counts.");
  const one = logFor([job("a", "2026-06-01", null)]);
  assert.equal(one.case, "no-cost", "a young list with no cost: nothing to compare either");
  assert.equal(logLine(one, $), "In the last 12 months you logged 1 job, none with a cost, so there is nothing to compare with the $3,800 a year of upkeep this page counts.");
  const noUp = logFor([job("a", "2026-06-01", null), job("b", "2026-07-01", -500)], { maintenance: 0 });
  assert.equal(noUp.case, "no-cost-no-upkeep");
  assert.equal(logLine(noUp, $), "In the last 12 months you logged 2 jobs, none with a cost, and this page counts no upkeep.");
  // one costed job among them: compared on what was costed (work done yourself is $0); one job is not a year's figure (P3)
  const some = logFor([OLD, job("a", "2026-06-01", null), job("b", "2026-07-01", 300)]);
  assert.equal(some.case, "less"); assert.equal(some.year.total, 300); assert.equal(some.year.costed, 1); assert.equal(some.use, null);
  const two = logFor([OLD, job("a", "2026-06-01", null), job("b", "2026-07-01", 300), job("c", "2026-08-01", 200)]);
  assert.equal(two.year.costed, 2); assert.equal(two.use.yearly, 500);
});

test("s3 fix M2: a day the calendar does not have (2026-02-30) is not a job: not listed, not counted, refused by the form", () => {
  assert.deepEqual(["2026-02-28", "2028-02-29", "2026-02-29", "2026-02-30", "2026-13-01", "2026-04-31", "2026-4-01", "", null, 20260301].map(isDay),
    [true, true, false, false, false, false, false, false, false, false]);
  const log = logFor([OLD, job("z", "2026-02-30", 400, "Impossible"), job("a", "2026-03-01", 250), job("b", "2026-04-01", 100)]);
  assert.deepEqual(log.jobs.map((j) => j.id), ["b", "a", "o"]);
  assert.equal(log.year.total, 350); assert.equal(log.year.costed, 2); assert.equal(log.use.yearly, 350);
  assert.deepEqual(jobFrom({ date: "2026-02-30", what: "Roof", cost: 5 }, { id: "j", today: T15 }), { error: "date", words: "Pick the day it was done." });
});

test("s3 fix M1: Remove takes away the one job tapped, also in a list saved without ids", async () => {
  const A = { date: "2026-03-01", what: "A", cost: 100 }, B = { date: "2026-04-01", what: "B", cost: 200 };
  assert.deepEqual(withoutJob([A, B], A, 0), [B]);
  assert.deepEqual(withoutJob([A, B], B, 1), [A]);
  assert.deepEqual(withoutJob([A, { ...A }], A, 1), [A], "two the same: the one at its place");
  assert.deepEqual(withoutJob([B, A], A, 0), [B], "moved since it was drawn: found by its day and words");
  assert.deepEqual(withoutJob([B], A, 0), [B], "gone already: nothing else is taken");
  const dup = [job("x", "2026-03-01", 100, "A"), job("x", "2026-04-01", 200, "B")];
  assert.deepEqual(withoutJob(dup, dup[1], 1), [dup[0]], "two sharing an id: only the one tapped");
  // on the page: the critic's steps, Remove on A (the older, listed last) with no ids
  const a = await drawHome(withJobs([{ ...A }, { ...B }], { purchasePrice: 310000 }));
  const rm = a.draw().querySelectorAll("button").filter((b) => b.textContent === "Remove");
  assert.equal(rm.length, 2);
  rm[1].click();
  assert.deepEqual(a.asked, ["Remove \"A\" from the list?"]);
  assert.deepEqual(a.plan().property[0].jobs, [B], "B is kept");
  const root = a.draw();
  assert.match(a.textOf(partEl(root, "log")), /Removed "A" from the list\./);
  btn(root, "Undo").click();
  assert.deepEqual(a.plan().property[0].jobs, [A, B], "Undo puts A back where it was");
});

test("s3 fix P4: while the home's details are open (no price yet) their Save is the one filled button; the job form's is outlined", async () => {
  const submitOf = (root) => box(partEl(root, "log"), "what").closest("form").querySelector('[type="submit"]');
  const fresh = await drawHome(familyPlan(T15));
  const r1 = fresh.draw();
  assert.equal(partsOpen(r1).details, true);
  assert.ok(submitOf(r1).className.split(/\s+/).includes("secondary"), "Add to the list is outlined beside the open details' Save");
  const priced = await drawHome(withDetails());
  assert.ok(!(submitOf(priced.draw()).className ?? "").split(/\s+/).includes("secondary"), "with the details shut it is the part's filled Save");
});

// ---- s3 fix round 2 (critics' findings P1, P3, P4)
test("s3 fix round 2 P3: one big job in the last 12 months is compared but not offered as a year's upkeep; two or more are", async () => {
  assert.equal(USE_MIN_JOBS, 2);
  // the critic's walk: a $6,000 furnace this year and an older job, so the list covers a year
  const furnace = [job("o", "2025-04-02", 250, "Gutters cleaned"), job("f", "2026-08-20", 6000, "New furnace")];
  const one = logFor(furnace);
  assert.equal(one.case, "more"); assert.equal(one.year.costed, 1); assert.equal(one.use, null);
  assert.equal(logLine(one, $), "In the last 12 months you logged $6,000 of work, $2,200 more than the $3,800 a year of upkeep this page counts.");
  const page = await drawHome(withJobs(furnace, { purchasePrice: 310000 }));
  const t = page.textOf(partEl(page.draw(), "log"));
  assert.match(t, /One year can be uneven: a roof or a furnace comes once in many years\./);
  assert.doesNotMatch(t, /Use \$/, "no button that makes one furnace the yearly upkeep");
  // a second costed job in the year: the year's figure may be used (asked first, as before)
  const more = logFor([...furnace, job("w", "2026-10-02", 400, "Window repair")]);
  assert.equal(more.year.costed, 2); assert.equal(more.use.yearly, 6400);
  // a job with no cost does not count toward the two
  assert.equal(logFor([...furnace, job("d", "2026-10-02", null, "Painted the fence")]).use, null);
});

test("s3 fix round 2 P1: a list too young for a year says what to do next", () => {
  const young = logFor([job("a", "2026-03-10", 12000, "New roof"), job("b", "2026-06-01", 6000, "New furnace")]);
  assert.equal(young.case, "new");
  assert.equal(logLine(young, $), "Your list starts in March 2026, so it cannot show a whole year yet. So far it holds $18,000 of work. Add older jobs with their dates to compare a whole year.");
});

test("s3 fix round 2 P4: \"Also count this as an improvement\" adds the job's cost to Improvements; its Remove takes it off; Undo puts both back", async () => {
  assert.ok(JOB_KEYS.includes("improvement"));
  // the pure parts
  const roof = { id: "r", date: "2026-03-10", what: "New roof", cost: 12000, improvement: true };
  assert.equal(improvementOf(roof), 12000);
  assert.equal(improvementOf({ ...roof, improvement: undefined }), 0, "not ticked: nothing");
  assert.deepEqual([improvementsWith(15000, roof), improvementsWith(null, roof), improvementsWith("", roof), improvementsWith(15000, { ...roof, improvement: false })], [27000, 12000, 12000, 15000]);
  assert.deepEqual([improvementOff(27000, roof), improvementOff(5000, roof), improvementOff(null, roof), improvementOff(27000, { ...roof, improvement: false })], [12000, 5000, 0, 0], "never more than Improvements holds");
  assert.deepEqual(jobFrom({ date: "2026-03-10", what: "New roof", cost: 12000, improvement: true }, { id: "r", today: T15 }), { job: roof });
  assert.deepEqual(jobFrom({ date: "2026-03-10", what: "New roof", cost: 12000, improvement: false }, { id: "r", today: T15 }), { job: { id: "r", date: "2026-03-10", what: "New roof", cost: 12000 } }, "unticked: no field");
  assert.deepEqual(jobFrom({ date: "2026-03-10", what: "New deck", cost: null, improvement: true }, { id: "r", today: T15 }), { error: "cost", words: "Type what it cost to count it as an improvement, or untick that box." });
  assert.equal(addedWords(roof, $, 27000), "Added \"New roof\", $12,000, to the list and to Improvements, now $27,000: that lowers the tax when you sell.");
  assert.equal(addedWords({ ...roof, improvement: undefined }, $, 27000), "Added \"New roof\", $12,000, to the list.");
  assert.equal(removeConfirmWords(roof, $, 12000), "Remove \"New roof\" from the list? Its $12,000 also comes off Improvements.");
  assert.equal(removeConfirmWords(roof, $, 0), "Remove \"New roof\" from the list?");
  assert.equal(removedWords(roof, $, 12000), "Removed \"New roof\" from the list, and its $12,000 from Improvements.");
  assert.equal(restoredWords(roof, $, 12000), "\"New roof\" is back on the list, and its $12,000 under Improvements.");
  assert.equal(IMPROVE_HINT, "A new roof or an addition also lowers the tax when you sell: when you add one, tick \"Also count this as an improvement\" under More details (optional).");

  // the page: Ana and Bo's home, $15,000 of improvements typed, one older job so the list is not empty
  const a = await drawHome(withJobs([job("o", "2025-06-12", 180, "Furnace serviced")], { purchasePrice: 310000, improvements: 15000 }));
  const gainBefore = compute(a.plan(), { today: T15 }).sale.gain;
  let root = a.draw();
  assert.ok(a.textOf(partEl(root, "log")).includes(IMPROVE_HINT));
  btn(root, "+ Add another job").click();
  const tick = box(partEl(root, "log"), "improvement");
  assert.ok(tick, "the tick is in the job form");
  assert.ok(tick.closest(".form-more"), "under More details (optional), shut: the form opens short");
  assert.equal(tick.getAttribute("type"), "checkbox");
  box(partEl(root, "log"), "what").value = "New roof";
  box(partEl(root, "log"), "cost").value = "12000";
  box(partEl(root, "log"), "date").value = "2026-03-10";
  tick.checked = true;
  box(partEl(root, "log"), "what").closest("form").dispatch("submit");
  let x = a.plan().property[0];
  assert.equal(x.improvements, 27000, "the roof's $12,000 added to the $15,000 there");
  assert.deepEqual(x.jobs.at(-1), { id: x.jobs.at(-1).id, date: "2026-03-10", what: "New roof", cost: 12000, improvement: true });
  assert.equal(compute(a.plan(), { today: T15 }).sale.gain, gainBefore - 12000, "the gain on a sale falls by the roof's cost");
  root = a.draw();
  let t = a.textOf(partEl(root, "log"));
  assert.match(t, /Added "New roof", \$12,000, to the list and to Improvements, now \$27,000: that lowers the tax when you sell\./);
  assert.match(t, /Mar 10, 2026 · counted as an improvement/);
  // Remove asks first and says what comes off; Yes takes both; Undo puts both back
  const rm = root.querySelectorAll("button").filter((b) => b.textContent === "Remove");
  rm[0].click();
  assert.equal(a.asked.at(-1), "Remove \"New roof\" from the list? Its $12,000 also comes off Improvements.");
  x = a.plan().property[0];
  assert.equal(x.improvements, 15000); assert.deepEqual(x.jobs.map((j) => j.what), ["Furnace serviced"]);
  root = a.draw();
  assert.match(a.textOf(partEl(root, "log")), /Removed "New roof" from the list, and its \$12,000 from Improvements\./);
  btn(root, "Undo").click();
  x = a.plan().property[0];
  assert.equal(x.improvements, 27000); assert.deepEqual(x.jobs.map((j) => j.what), ["Furnace serviced", "New roof"]);
  // ticked with no cost: refused at the cost box, nothing saved
  const b = await drawHome(withJobs([], { purchasePrice: 310000, improvements: 15000 }));
  root = b.draw();
  box(partEl(root, "log"), "what").value = "Built a deck myself";
  box(partEl(root, "log"), "improvement").checked = true;
  box(partEl(root, "log"), "what").closest("form").dispatch("submit");
  assert.deepEqual(b.plan().property[0].jobs, []); assert.equal(b.plan().property[0].improvements, 15000);
  // an improvement job removed after Improvements was typed lower takes off only what is there
  const c = await drawHome(withJobs([{ ...roof }], { purchasePrice: 310000, improvements: 5000 }));
  root = c.draw();
  root.querySelectorAll("button").filter((y) => y.textContent === "Remove")[0].click();
  assert.equal(c.asked.at(-1), "Remove \"New roof\" from the list? Its $5,000 also comes off Improvements.");
  assert.equal(c.plan().property[0].improvements, 0);
});

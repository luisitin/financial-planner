// The full checks for this page are in tests/retirement-pages.test.mjs (fixture qa/fixtures/retirement-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { retirementPlan } from "../../../qa/fixtures/retirement-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("cash-flow: runs on the sample couple and on an empty plan", () => {
  const d = compute(retirementPlan(), { today: "2026-09-16", paths: 200, quick: true });
  assert.ok(d && typeof d === "object");
  assert.ok(compute(emptyPlan(), { today: "2026-09-16", paths: 200, quick: true }));
});

test("Review 2026-11-06 (round 7): the year's income lines say 'your Social Security' for the first adult Get started left unnamed", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const T = "2026-11-06";
  const lines = (plan) => [...new Set(compute(plan, { today: T }).rows.flatMap((r) => r.in.lines.map((l) => l.name)))];
  assert.deepEqual(lines(familyPlan(T)), ["Bo's Social Security", "Ana's Social Security"], "typed names read as before");
  for (const [partner, theirs] of [["My spouse", "your spouse's"], ["Bo", "Bo's"]]) {
    const p = familyPlan(T); p.household.people[0].name = "Me"; p.household.people[1].name = partner;
    assert.deepEqual(lines(p), [`${theirs} Social Security`, "your Social Security"], "was: Me's Social Security, My spouse's Social Security");
  }
});

// stress test 2026-11-11: the key under the table says the plan's own order, not always "taxable, then pre-tax"
test("stress test: the key names the plan's withdrawal order", async () => {
  const { orderSaid } = await import("./view.js");
  assert.equal(orderSaid(["taxable", "deferred", "free"]), "Money comes out of cash first, then taxable savings, then pre-tax accounts (taxed as it comes out), then Roth (tax-free).");
  assert.equal(orderSaid(["deferred", "free", "taxable"]), "Money comes out of cash first, then pre-tax accounts (taxed as it comes out), then Roth (tax-free), then taxable savings.");
  const p = retirementPlan(); p.retirement.withdrawalOrder = ["deferred", "taxable", "free"];
  assert.deepEqual(compute(p, { today: "2026-11-11" }).order, ["deferred", "taxable", "free"]);
});

// money moved between accounts (Will the money last?, gap list next 60 item 26): the year's record says it, one sentence per case
test("a year with money moved between accounts says it, in the dollars shown", async () => {
  const { moveSaid } = await import("./view.js");
  const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
  assert.equal(moveSaid({ fromName: "Savings", toName: "Brokerage", amount: 20000, tax: 0, capped: false }, money), "Moved $20,000 from Savings to Brokerage");
  assert.equal(moveSaid({ fromName: "Sam's 401(k)", toName: "Brokerage", amount: 20000, tax: 3000, capped: false }, money), "Moved $20,000 from Sam's 401(k) to Brokerage, $3,000 of tax");
  assert.equal(moveSaid({ fromName: "Savings", toName: "Brokerage", amount: 38211, tax: 0, capped: true }, money), "Moved $38,211 from Savings to Brokerage, all it held");
  assert.equal(moveSaid({ fromName: "Savings", toName: "Brokerage", amount: 0, tax: 0, capped: true }, money), "Nothing to move from Savings");
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const p = retirementPlan(); p.retirement.happenings = [{ id: "h1", kind: "move", fromId: "k401", toId: "brk", year: 2034, amount: 20000 }];
  const r = await renderPage(new URL("./view.js", import.meta.url).href, p, "2026-09-16");
  assert.match(r.root.textContent, /Moved \$20,000 from Sam's 401\(k\) to Brokerage, \$3,000 of tax\./, "the year's record on a phone");
  assert.match(r.root.textContent, /2034: Moved \$20,000 from Sam's 401\(k\) to Brokerage, \$3,000 of tax\./, "the line under the table");
});

// ---- Change this year (gap list, next 60, item 32): a tap on a year's row; each change is a thing that will happen ------------
const TY = "2026-11-16";
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} against ${b}`);
/** The page in the fake DOM with a store that keeps what it saves (the kit's Undo reads what is there now), as the app's does. */
async function yearPage(plan, { route = { rest: [], query: {} } } = {}) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js"), fmt = await import("../../../core/format.js");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { render } = await import("./view.js");
  const s = { now: migrate(structuredClone(plan)), saves: 0, root: null, route };
  s.store = { get: () => s.now, update: (fn) => { const d = structuredClone(s.now); fn(d); s.now = d; s.saves++; } };
  s.draw = () => { s.root = new FakeElement("main"); render(s.root, { ui, fmt: { ...fmt, today: () => TY }, plan: s.now, route: s.route, store: s.store }); return s.root; };
  s.text = (el = s.root) => textOf(el);
  s.row = (year) => s.root.all().find((e) => e.tagName === "LI" && e.dataset?.key === `y${year}`) ?? null;
  s.tap = (year) => s.row(year).querySelector(".cf-row").click();
  s.button = (el, label) => el.all().find((e) => e.tagName === "BUTTON" && e.textContent === label) ?? null;
  s.submit = (year, values) => {
    const form = s.row(year).querySelector("form");
    for (const [k, v] of Object.entries(values)) form.querySelector(`[name="${k}"]`).value = String(v);
    form.reset = () => {};
    form.dispatch("submit");
    return form;
  };
  /** Tap the year, its chip, type, Save; then draw again as the shell does after a save. */
  s.change = (year, chip, values) => { s.tap(year); s.button(s.row(year), chip).click(); s.submit(year, values); return s.draw(); };
  s.draw();
  return s;
}

test("change this year: each change is the matching thing that will happen, as happenings.js saves it", async () => {
  const { yearChange } = await import("./compute.js");
  assert.deepEqual(yearChange("more", 2060, { id: "h1", amount: 500 }), { id: "h1", kind: "spend", year: 2060, untilYear: 2060, monthly: 500 });
  assert.deepEqual(yearChange("less", 2060, { id: "h2", amount: 300 }), { id: "h2", kind: "spend", year: 2060, untilYear: 2060, monthly: -300 });
  assert.deepEqual(yearChange("in", 2045, { id: "h3", amount: 100000, name: "  An inheritance " }), { id: "h3", kind: "in", year: 2045, name: "An inheritance", amount: 100000 });
  assert.deepEqual(yearChange("out", 2045, { id: "h4", amount: "40000", name: "" }), { id: "h4", kind: "out", year: 2045, amount: 40000 }, "no name: left out; a typed figure is a number");
  assert.deepEqual(yearChange("more", 2060, { id: "h5", amount: null }), { id: "h5", kind: "spend", year: 2060, untilYear: 2060 }, "no amount: left out, and check() refuses it");
  assert.throws(() => yearChange("home", 2060, { id: "h6" }), /unknown kind/);
});

test("change this year: only changes of one year are a row's own, in the plan's order", async () => {
  const { isYearChange, yearChanges } = await import("./compute.js");
  assert.equal(isYearChange({ id: "a", kind: "spend", year: 2060, untilYear: 2060, monthly: 500 }), true);
  assert.equal(isYearChange({ id: "a", kind: "spend", year: 2060, untilYear: 2064, monthly: 500 }), false, "five years: Will the money last?'s own");
  assert.equal(isYearChange({ id: "a", kind: "spend", year: 2060, monthly: 500 }), false, "for good");
  assert.equal(isYearChange({ id: "a", kind: "in", year: 2060, amount: 1 }), true);
  assert.equal(isYearChange({ id: "a", kind: "out", year: 2060, amount: 1 }), true);
  assert.equal(isYearChange({ id: "a", kind: "move", year: 2060, fromId: "x", toId: "y" }), false);
  assert.equal(isYearChange({ id: "a", kind: "in", year: "2060", amount: 1 }), false, "a year that is not a whole number");
  const plan = { retirement: { happenings: [
    { id: "h1", kind: "out", year: 2060, name: "A new roof", amount: 40000 }, { id: "h2", kind: "spend", year: 2050, untilYear: 2059, monthly: -200 },
    { kind: "in", year: 2060, amount: 5 }, { id: "h3", kind: "spend", year: 2060, untilYear: 2060, monthly: 500 }, { id: "h4", kind: "in", year: 2045, amount: 9000 }] } };
  const m = yearChanges(plan);
  assert.deepEqual(Object.keys(m), ["2045", "2060"]);
  assert.deepEqual(m[2060].map((h) => h.id), ["h1", "h3"], "the plan's order; one with no id is not read");
  assert.deepEqual(yearChanges({}), {});
});

test("change this year: spending can change only in a retired year with a way that spends the plan's figure", async () => {
  const { yearOffers, YEAR_KINDS } = await import("./compute.js");
  assert.deepEqual(YEAR_KINDS, ["more", "less", "in", "out"]);
  assert.deepEqual(yearOffers({ retired: true }, "fixed-real"), ["more", "less", "in", "out"]);
  assert.deepEqual(yearOffers({ retired: true }, "guardrails"), ["more", "less", "in", "out"], "trim after bad years scales its target too");
  for (const way of ["percent", "vpw", "endowment", "ninety-five"]) assert.deepEqual(yearOffers({ retired: true }, way), ["in", "out"], way);
  assert.deepEqual(yearOffers({ retired: false }, "fixed-real"), ["in", "out"], "before retirement the engine counts no spending");
});

test("change this year: what a change is checked against is the projection's own first and last year", async () => {
  const { yearFacts } = await import("./compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { buildInputs } = await import("../projection/compute.js");
  const p = familyPlan(TY), f = yearFacts(p, { today: TY }), I = buildInputs(p, { today: TY }).inputs;
  assert.deepEqual({ strategy: f.strategy, nowYear: f.nowYear, endYear: f.endYear, people: f.people }, { strategy: "fixed-real", nowYear: I.startYear, endYear: I.endYear, people: I.people });
  assert.equal(f.nowYear, 2026); assert.equal(f.endYear, 2085);
  assert.equal(yearFacts(emptyPlan(), { today: TY }), null);
});

test("change this year: the figures move as the engine counts each kind (today's dollars)", async () => {
  const { yearChange } = await import("./compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const base = compute(familyPlan(TY), { today: TY });
  const withOne = (kind, amount) => { const p = familyPlan(TY); p.retirement.happenings = [yearChange(kind, 2060, { id: "h1", amount })]; return compute(p, { today: TY }); };
  const at = (d, y) => d.rows.find((r) => r.year === y);
  const taken = (r) => r.from.cash + r.from.taxable + r.from.deferred + r.from.free;
  // spending in Y = (S0 + 12 x m) x p_Y, and S0 x p_Y again from Y + 1 (spendingFactors: the two factors multiply to 1)
  const more = withOne("more", 500), less = withOne("less", 500);
  near(at(more, 2060).out.spending - at(base, 2060).out.spending, 6000, 0.01, "$500 a month more is $6,000 more in 2060");
  near(at(less, 2060).out.spending - at(base, 2060).out.spending, -6000, 0.01, "$500 a month less");
  for (const y of [2059, 2061, 2070]) { near(at(more, y).out.spending, at(base, y).out.spending, 0.01, `${y}: as before`); near(at(less, y).out.spending, at(base, y).out.spending, 0.01, `${y}: as before`); }
  assert.ok(taken(at(more, 2060)) > taken(at(base, 2060)) + 5999, "the $6,000 comes out of savings, with its tax");
  // a big cost once: A x p_Y out of savings on top of the year's spending; money in once: A x p_Y into savings at the start of Y
  const out = withOne("out", 40000), inn = withOne("in", 100000);
  assert.ok(taken(at(out, 2060)) - taken(at(base, 2060)) >= 40000 - 0.01, "the cost comes out of savings, with any tax on top");
  near(at(out, 2060).out.spending, at(base, 2060).out.spending, 0.01, "a cost once is not the year's spending");
  assert.ok(at(inn, 2060).end.total - at(base, 2060).end.total > 100000, "the money in is there at the year's end, grown");
  for (const d of [more, less, out, inn]) assert.deepEqual(d.rows.filter((r) => r.year < 2060).map((r) => r.end.total), base.rows.filter((r) => r.year < 2060).map((r) => r.end.total), "the years before are as they were");
});

test("change this year: tap a year, Spend more, Save: the plan holds that happening, the row says it, the green line names the new answer, Undo takes it out", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const s = await yearPage(familyPlan(TY));
  assert.match(s.text(), /Years from retirement on every year Tap a year to change it\. /, "how to change a year: first in the ledger, its own line");
  assert.match(s.text(), /Left: savings at year end\. Money comes out of cash first/);
  const btn = s.row(2060).querySelector(".cf-row");
  assert.equal(btn.getAttribute("aria-expanded"), "false");
  s.tap(2060);
  assert.equal(btn.getAttribute("aria-expanded"), "true");
  assert.equal(s.text(s.row(2060).querySelector(".cf-panel")), "Change this year: Spend more Spend less Money coming in once A big cost once Close");
  assert.match(s.row(2060).className, /\bcf-open\b/, "the open row is tinted");
  assert.equal(s.saves, 0, "opening writes nothing");
  s.button(s.row(2060), "Spend more").click();
  assert.equal(s.button(s.row(2060), "Spend more").getAttribute("aria-expanded"), "true", "the chosen chip (drawn in the accent by the page's style)");
  assert.match(s.text(s.row(2060).querySelector(".cf-panel")), /In 2060: spend more How much more a month \$ in today's dollars, for each month of 2060\. For example, \$500\. Save Cancel$/, "an example in the help, never grey in the box (grey means our guess); Close gives way to Cancel");
  s.submit(2060, { amount: 500 });
  assert.deepEqual(s.now.retirement.happenings, [{ id: "h1", kind: "spend", year: 2060, untilYear: 2060, monthly: 500 }]);
  s.draw();
  const row = s.row(2060);
  assert.equal(row.querySelector(".cf-panel"), null, "the panel is shut: the change is on the row");
  assert.equal(row.querySelector(".pill").textContent, "changed");
  assert.match(s.text(row), /^2060 · ages 70 and 72 \$[\d,]+ left \$100,461 spent \(\$10,461 health insurance\) .* changed Spending goes up \$500 a month in 2060 Saved\. Your retirement answer: lasts to the end, with about \$12,000 less left at 95 \(today's dollars\)\. Undo$/, "the row says the change; the green line under it does not say it again");
  assert.doesNotMatch(row.className, /\bcf-open\b/);
  const undo = s.button(row.querySelector(".notice"), "Undo");
  assert.match(undo.className, /secondary/, "Undo is outlined");
  undo.click();
  assert.equal(s.now.retirement.happenings, undefined, "Undo takes the line out again, and the field with it");
  s.draw();
  assert.equal(s.row(2060).querySelector(".pill"), null);
  assert.match(s.text(s.row(2060)), /\$94,461 spent .* Undone: Spending goes up \$500 a month in 2060\. Your retirement answer: lasts to the end, with about \$12,000 more left at 95 \(today's dollars\)\.$/);
  assert.equal(s.button(s.row(2060), "Undo"), null, "an Undo works once");
  s.draw();
  assert.equal(s.row(2060).querySelector(".notice"), null, "the green line is drawn once");
});

test("change this year: Spend less, Money coming in once and A big cost once are each saved as their happening, with ids after the plan's", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan(TY);
  p.retirement.happenings = [{ id: "h1", kind: "spend", year: 2050, untilYear: 2054, monthly: -200 }];
  const s = await yearPage(p);
  s.change(2060, "Spend less", { amount: 300 });
  s.change(2061, "Money coming in once", { name: "An inheritance", amount: 100000 });
  s.change(2062, "A big cost once", { name: "A new roof", amount: 40000 });
  assert.deepEqual(s.now.retirement.happenings, [
    { id: "h1", kind: "spend", year: 2050, untilYear: 2054, monthly: -200 },
    { id: "h2", kind: "spend", year: 2060, untilYear: 2060, monthly: -300 },
    { id: "h3", kind: "in", year: 2061, name: "An inheritance", amount: 100000 },
    { id: "h4", kind: "out", year: 2062, name: "A new roof", amount: 40000 }]);
  assert.match(s.text(s.row(2062)), /changed A new roof in 2062: \$40,000 out of savings Saved\. Your retirement answer: lasts to the end, with about \$[\d,]+ less left at 95 \(today's dollars\)\. Undo$/);
  assert.match(s.text(s.row(2061)), /changed An inheritance in 2061: \$100,000 into savings$/);
  assert.match(s.text(s.row(2060)), /changed Spending goes down \$300 a month in 2060$/);
  assert.doesNotMatch(s.text(s.row(2052) ?? s.root), /changed Spending goes down \$200/, "a change of five years is Will the money last?'s, not a row's");
  // the table on a wider screen: the year's mark and one line under it
  const wide = s.root.all().find((e) => /\bonly-wide\b/.test(e.className));
  assert.match(s.text(wide), /Your changes: Spending goes down \$300 a month in 2060; An inheritance in 2061: \$100,000 into savings; A new roof in 2062: \$40,000 out of savings\./);
  assert.equal(wide.all().filter((e) => /\bpill\b/.test(e.className)).length, 3, "a mark beside each changed year");
});

test("change this year: the same change saved on Will the money last? is the same record, so every figure is the same", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const { compute: nba } = await import("../../overview/next-best-action/compute.js");
  const { compute: projection } = await import("../projection/compute.js");
  const { answerOf } = await import("../levers.js");
  /** Will the money last?'s own form under "Things that will happen", as a person fills it. */
  const viaProjection = async (chip, values) => {
    const r = await renderPage(new URL("../projection/view.js", import.meta.url).href, familyPlan(TY), TY, { route: { rest: [], query: {} }, computeOf: { "overview/next-best-action": nba } });
    for (let i = 0; i < 200 && r.root.all().some((e) => e.getAttribute("aria-busy") === "true"); i++) await new Promise((ok) => setTimeout(ok, 50));
    const part = r.root.querySelectorAll("details").find((x) => x.dataset?.part === "happenings");
    part.all().find((e) => e.tagName === "BUTTON" && e.textContent === chip).click();
    const form = part.querySelector("form");
    for (const [k, v] of Object.entries(values)) form.querySelector(`[name="${k}"]`).value = String(v);
    form.reset = () => {};
    form.dispatch("submit");
    return r.saved[0];
  };
  const cases = [
    ["Spend more", { amount: 500 }, "Spending changes for some years", { year: 2060, untilYear: 2060, direction: "up", amount: 500 }],
    ["Spend less", { amount: 500 }, "Spending changes for some years", { year: 2060, untilYear: 2060, direction: "down", amount: 500 }],
    ["Money coming in once", { name: "An inheritance", amount: 100000 }, "Money coming in once", { name: "An inheritance", year: 2060, amount: 100000 }],
    ["A big cost once", { name: "A new roof", amount: 40000 }, "A big cost once", { name: "A new roof", year: 2060, amount: 40000 }],
  ];
  for (const [chip, values, theirChip, theirs] of cases) {
    const s = await yearPage(familyPlan(TY));
    s.change(2060, chip, values);
    const there = await viaProjection(theirChip, theirs);
    assert.deepEqual(s.now.retirement.happenings, there.retirement.happenings, `${chip}: the same record`);
    const noStamp = (x) => ({ ...x, meta: { ...x.meta, createdAt: null, updatedAt: null } });
    assert.deepEqual(noStamp(s.now), noStamp(there), `${chip}: the same plan (but for the moment each test plan was made)`);
    assert.deepEqual(answerOf(s.now, { today: TY }), answerOf(there, { today: TY }), `${chip}: the same answer`);
    assert.deepEqual(compute(s.now, { today: TY }), compute(there, { today: TY }), `${chip}: the same years`);
    assert.deepEqual(projection(s.now, { today: TY }), projection(there, { today: TY }), `${chip}: the same projection`);
    assert.notDeepEqual(answerOf(s.now, { today: TY }), answerOf(familyPlan(TY), { today: TY }), `${chip}: and the answer moved`);
  }
});

test("change this year: Remove from the row, then Undo puts the same line back in its place", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan(TY);
  const first = [{ id: "h1", kind: "in", year: 2060, name: "An inheritance", amount: 100000 }, { id: "h2", kind: "spend", year: 2065, untilYear: 2070, monthly: 300 }];
  p.retirement.happenings = structuredClone(first);
  const s = await yearPage(p);
  assert.match(s.text(s.row(2060)), /changed An inheritance in 2060: \$100,000 into savings$/, "the mark is on the row before any tap");
  s.tap(2060);
  const panel = s.row(2060).querySelector(".cf-panel");
  assert.match(s.text(panel), /^An inheritance in 2060: \$100,000 into savings Remove Change this year: Spend more/);
  const remove = s.button(panel, "Remove");
  assert.match(remove.className, /secondary/); assert.equal(remove.getAttribute("aria-label"), "Remove: An inheritance in 2060: $100,000 into savings");
  remove.click();
  assert.deepEqual(s.now.retirement.happenings, [first[1]], "only that line goes");
  s.draw();
  assert.equal(s.row(2060).querySelector(".pill"), null);
  assert.match(s.text(s.row(2060).querySelector(".notice")), /^Removed: An inheritance in 2060: \$100,000 into savings\. Your retirement answer: lasts to the end, with about \$[\d,]+ less left at 95 \(today's dollars\)\. Undo$/);
  s.button(s.row(2060).querySelector(".notice"), "Undo").click();
  assert.deepEqual(s.now.retirement.happenings, first, "the same record, first again");
  s.draw();
  assert.match(s.text(s.row(2060)), /changed An inheritance in 2060: \$100,000 into savings Put back\. Your retirement answer: lasts to the end, with about \$[\d,]+ more left at 95 \(today's dollars\)\.$/);
});

test("change this year: before retirement, and with a way that sets spending, only money in or out once, and the row says why", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { BEFORE_WORDS, WAY_WORDS } = await import("./view.js");
  assert.equal(BEFORE_WORDS, "Before you retire this plan only follows your savings, so you can add or take out a one-time amount for this year.");
  assert.equal(WAY_WORDS, "Your way of taking money out sets each year's spending (How much to take out), so only money in or out once can change this year.");
  const s = await yearPage(familyPlan(TY));
  const years = s.root.all().find((e) => e.tagName === "SELECT" && e.getAttribute("aria-label") === "Years");
  years.value = "all"; years.dispatch("change");
  s.draw();
  s.tap(2030);
  assert.equal(s.text(s.row(2030).querySelector(".cf-panel")), `Change this year: ${BEFORE_WORDS} Money coming in once A big cost once Close`);
  s.button(s.row(2030), "A big cost once").click();
  assert.match(s.text(s.row(2030).querySelector("form")), /How much comes out of savings \$ in today's dollars \(your pay is not counted before you retire\)/);
  s.submit(2030, { amount: 15000 });
  assert.deepEqual(s.now.retirement.happenings, [{ id: "h1", kind: "out", year: 2030, amount: 15000 }]);
  years.value = "retirement"; years.dispatch("change");
  const p = familyPlan(TY); p.retirement.strategy = "percent";
  const w = await yearPage(p);
  w.tap(2060);
  assert.equal(w.text(w.row(2060).querySelector(".cf-panel")), `Change this year: ${WAY_WORDS} Money coming in once A big cost once Close`);
});

test("change this year: an amount the plan cannot count is refused at the box and nothing is saved", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { yearChange, yearFacts } = await import("./compute.js");
  const { check } = await import("../happenings.js");
  // the words at the box are happenings.js check()'s, the very ones Will the money last? shows (the kit draws them in a browser)
  const f = yearFacts(familyPlan(TY), { today: TY }), env = { nowYear: f.nowYear, endYear: f.endYear, people: f.people };
  assert.deepEqual(check(yearChange("more", 2060, { id: "h1", amount: 0 }), env), { field: "monthly", words: "Type how much a month, more than $0." });
  assert.deepEqual(check(yearChange("in", 2060, { id: "h1", amount: 0 }), env), { field: "amount", words: "Type how much, more than $0." });
  assert.deepEqual(check(yearChange("out", 2060, { id: "h1", amount: 200000000 }), env), { field: "amount", words: "That is more than this plan can hold: check for an extra digit." });
  const s = await yearPage(familyPlan(TY));
  s.tap(2060); s.button(s.row(2060), "Spend more").click();
  const form = s.submit(2060, { amount: 0 });
  assert.equal(s.saves, 0);
  assert.equal(s.row(2060).querySelector("form"), form, "the form stays as typed");
  s.button(s.row(2060), "Money coming in once").click();
  const f2 = s.submit(2060, { amount: 0 });
  assert.equal(s.saves, 0);
  s.button(f2, "Cancel").click();
  assert.equal(s.row(2060).querySelector(".cf-panel"), null, "Cancel shuts the year (critic of item 32, P4)");
  assert.equal(s.row(2060).querySelector(".cf-row").getAttribute("aria-expanded"), "false");
  assert.doesNotMatch(s.row(2060).className, /\bcf-open\b/);
  assert.equal(s.saves, 0);
});

test("change this year: opening and shutting write nothing; one row is open at a time; a new visit starts with every row shut", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const s = await yearPage(familyPlan(TY));
  const was = s.now;
  s.tap(2060);
  s.tap(2061);
  assert.equal(s.row(2060).querySelector(".cf-panel"), null, "the first row shuts when another opens");
  assert.equal(s.row(2060).querySelector(".cf-row").getAttribute("aria-expanded"), "false");
  assert.ok(s.row(2061).querySelector(".cf-panel"));
  s.draw();
  assert.ok(s.row(2061).querySelector(".cf-panel"), "the open row stays open when the page is drawn again");
  s.tap(2061);
  assert.equal(s.row(2061).querySelector(".cf-panel"), null, "a second tap shuts it");
  s.tap(2061);
  s.route = { rest: [], query: {} };
  s.draw();
  assert.equal(s.root.all().some((e) => /\bcf-panel\b/.test(e.className)), false, "a new visit");
  assert.equal(s.saves, 0); assert.equal(s.now, was, "the plan is the very same object");
});

test("change this year: the words of the green line, one sentence per case, and of the row's mark", async () => {
  const { doneWords, marksSaid, markSaid, hiddenSaid, TAP_WORDS, CHIP } = await import("./view.js");
  const { NOT_COUNTED } = await import("./compute.js");
  const said = "Spending goes up $500 a month in 2060", w = "lasts to the end, with about $12,000 less left at 95 (today's dollars)";
  assert.equal(doneWords("saved", said, w), "Saved: Spending goes up $500 a month in 2060. Your retirement answer: lasts to the end, with about $12,000 less left at 95 (today's dollars).");
  assert.equal(doneWords("removed", said, "now runs out at 88 (was 91)"), "Removed: Spending goes up $500 a month in 2060. Your retirement answer: now runs out at 88 (was 91).");
  assert.equal(doneWords("undoSave", said, "still runs out at 88"), "Undone: Spending goes up $500 a month in 2060. Your retirement answer: still runs out at 88.");
  assert.equal(doneWords("undoRemove", said, w), "Put back: Spending goes up $500 a month in 2060. Your retirement answer: lasts to the end, with about $12,000 less left at 95 (today's dollars).");
  assert.equal(doneWords("saved", said, ""), "Saved: Spending goes up $500 a month in 2060.", "no answer to compare: the first sentence alone");
  // under its own row, which says the change (critic of item 32, P5): a save and a put back do not say it again
  assert.equal(doneWords("saved", said, w, { onRow: true }), "Saved. Your retirement answer: lasts to the end, with about $12,000 less left at 95 (today's dollars).");
  assert.equal(doneWords("undoRemove", said, w, { onRow: true }), "Put back. Your retirement answer: lasts to the end, with about $12,000 less left at 95 (today's dollars).");
  assert.equal(doneWords("saved", said, "", { onRow: true }), "Saved.");
  assert.equal(doneWords("removed", said, w, { onRow: true }), `Removed: ${said}. Your retirement answer: ${w}.`, "the row no longer says it after a remove");
  assert.equal(doneWords("undoSave", said, w, { onRow: true }), `Undone: ${said}. Your retirement answer: ${w}.`);
  assert.throws(() => doneWords("edited", said, w), /unknown case/);
  const money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
  const yes = (h) => ({ h, counted: true, why: null, floored: false });
  const list = [yes({ id: "h1", kind: "out", year: 2060, name: "A new roof", amount: 40000 }), yes({ id: "h2", kind: "spend", year: 2060, untilYear: 2060, monthly: -300 })];
  assert.equal(marksSaid(list, { money }), "A new roof in 2060: $40,000 out of savings; Spending goes down $300 a month in 2060");
  assert.equal(marksSaid(list.slice(0, 1), { money, real: false }), "A new roof in 2060: $40,000 out of savings (today's dollars)", "said in today's dollars while the page shows each year's");
  assert.equal(marksSaid([yes({ id: "h3", kind: "in", year: 2061, amount: 5000 })], { money }), "Money coming in in 2061: $5,000 into savings");
  // each case of markSaid (critic of item 32, F1 and F2)
  assert.equal(markSaid({ h: { id: "h4", kind: "spend", year: 2060, untilYear: 2060, monthly: -9000 }, counted: true, why: null, floored: true }, { money }), "Spending goes down $9,000 a month in 2060 (more than that year's spending, so spending is taken to $0)");
  assert.equal(markSaid({ h: { id: "h5", kind: "spend", year: 2040, untilYear: 2040, monthly: 500 }, counted: false, why: NOT_COUNTED.before }, { money }), "Spending goes up $500 a month in 2040 (not counted: the plan does not count spending before you retire)");
  assert.equal(markSaid({ h: { id: "h6", kind: "spend", year: 2060, untilYear: 2060, monthly: 500 }, counted: false, why: NOT_COUNTED.way }, { money }), "Spending goes up $500 a month in 2060 (not counted: this is not used with your way of taking money out (How much to take out))");
  assert.equal(markSaid({ h: { id: "h7", kind: "in", year: 2060, amount: -500 }, counted: false, why: "Type how much, more than $0." }, { money }), "Money coming in in 2060: $-500 into savings (not counted: type how much, more than $0)");
  assert.equal(NOT_COUNTED.before, "The plan does not count spending before you retire.");
  assert.equal(NOT_COUNTED.way, "This is not used with your way of taking money out (How much to take out).");
  // changes in years with no row of their own (critic of item 32, F5)
  assert.equal(hiddenSaid("A new roof in 2040: $40,000 out of savings"), "Your changes in years not listed here: A new roof in 2040: $40,000 out of savings.");
  assert.equal(hiddenSaid("A new roof in 2040: $40,000 out of savings", { byFilter: true }), "Your changes in years not listed here: A new roof in 2040: $40,000 out of savings. Choose every year under Years to see it.");
  assert.equal(hiddenSaid("x; y", { byFilter: true, many: true }), "Your changes in years not listed here: x; y. Choose every year under Years to see them.");
  assert.equal(TAP_WORDS, "Tap a year to change it.");
  assert.deepEqual(Object.values(CHIP), ["Spend more", "Spend less", "Money coming in once", "A big cost once"]);
});

// ---- the critics of item 32 ---------------------------------------------------------------------------------------------------
test("critic F1: a change the plan does not count is never marked 'changed': it says 'not counted' and why", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { yearMarks, yearFacts, NOT_COUNTED } = await import("./compute.js");
  const { apply } = await import("../happenings.js");
  const { buildInputs } = await import("../projection/compute.js");
  const bad = [
    { id: "h1", kind: "in", year: 2060, amount: -500 }, { id: "h2", kind: "out", year: 2061, amount: "abc" }, { id: "h3", kind: "in", year: 2062, amount: 1e15 },
    { id: "h4", kind: "spend", year: 2063, untilYear: 2063, monthly: 0 }, { id: "h5", kind: "spend", year: 2064, untilYear: 2064, monthly: "x" },
  ];
  const p = familyPlan(TY); p.retirement.happenings = structuredClone(bad);
  const f = yearFacts(p, { today: TY }), m = yearMarks(p, f);
  // the very lines the engine skips (happenings.js apply(): check() refuses them) are those marked not counted
  const skipped = apply(p, buildInputs(p, { today: TY, happenings: false }).inputs, { nowYear: f.nowYear, today: TY }).skipped.map((x) => x.id).sort();
  assert.deepEqual(Object.values(m).flat().filter((x) => !x.counted).map((x) => x.h.id).sort(), skipped);
  assert.deepEqual(skipped, ["h1", "h2", "h3", "h4", "h5"]);
  assert.equal(m[2060][0].why, "Type how much, more than $0.");
  assert.equal(m[2062][0].why, "That is more than this plan can hold: check for an extra digit.");
  assert.equal(m[2063][0].why, "Type how much a month, more than $0.");
  // and the page: no "changed" pill, a "not counted" pill with why, on the row and in the line under the table
  const s = await yearPage(p);
  assert.equal(s.root.all().filter((e) => /\bpill\b/.test(e.className) && e.textContent === "changed").length, 0);
  assert.match(s.text(s.row(2060)), /not counted Money coming in in 2060: -\$500 into savings\. Type how much, more than \$0\.$/);
  assert.match(s.text(s.row(2063)), /not counted Spending goes up \$0 a month in 2063\. Type how much a month, more than \$0\.$/);
  const wide = s.root.all().find((e) => /\bonly-wide\b/.test(e.className));
  assert.match(s.text(wide), /Your changes: Money coming in in 2060: -\$500 into savings \(not counted: type how much, more than \$0\);/);
  // a change in spending the engine passes over: a year before retirement, a way of taking money out that sets spending
  const q = familyPlan(TY); q.retirement.happenings = [{ id: "h1", kind: "spend", year: 2040, untilYear: 2040, monthly: 500 }, { id: "h2", kind: "spend", year: 2060, untilYear: 2060, monthly: 500 }];
  const mq = yearMarks(q, yearFacts(q, { today: TY }));
  assert.deepEqual([mq[2040][0].counted, mq[2040][0].why, mq[2060][0].counted], [false, NOT_COUNTED.before, true]);
  q.retirement.strategy = "percent";
  const mw = yearMarks(q, yearFacts(q, { today: TY }));
  assert.deepEqual([mw[2060][0].counted, mw[2060][0].why], [false, NOT_COUNTED.way]);
  // with each of these the figures are exactly those of the plan without it: nothing changed, so nothing says "changed"
  const none = familyPlan(TY);
  assert.deepEqual(compute(p, { today: TY }).rows, compute(none, { today: TY }).rows);
  assert.deepEqual(compute(q, { today: TY }).rows, compute({ ...none, retirement: { ...none.retirement, strategy: "percent" } }, { today: TY }).rows);
  assert.equal(yearMarks(p, null)[2060][0].counted, true, "no plan to check against: as saved");
});

test("critic F2: Spend less goes down at most to that year's spending, so the saved line is what the plan counts", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { yearFacts, lessRoom, spendIn, yearMarks, yearChange } = await import("./compute.js");
  const { SPEND_FLOOR } = await import("../happenings.js");
  const p = familyPlan(TY), f = yearFacts(p, { today: TY });
  const base = compute(p, { today: TY }).rows.find((r) => r.year === 2060);
  // the spending a change moves: the row's spending less health insurance (the family holds no loan payment in it then)
  near(spendIn(f, 2060), base.out.spending - base.out.health, 0.01, "L(2060), today's dollars a year");
  assert.equal(lessRoom(f, 2060), Math.floor((spendIn(f, 2060) - SPEND_FLOOR) / 12));
  assert.equal(lessRoom(f, 2060), 6999, "$84,000 a year: $6,999 a month leaves at least the $1 floor");
  // another change in force that year is counted first
  const q = familyPlan(TY); q.retirement.happenings = [{ id: "h1", kind: "spend", year: 2058, untilYear: 2062, monthly: -2000 }];
  assert.equal(lessRoom(yearFacts(q, { today: TY }), 2060), 4999);
  assert.equal(lessRoom(yearFacts(q, { today: TY }), 2063), 6999, "after it ends, as before");
  // the most the box takes is counted in full: spending falls by exactly 12 x that, never floored
  const r = familyPlan(TY); r.retirement.happenings = [yearChange("less", 2060, { id: "h1", amount: 6999 })];
  const at = compute(r, { today: TY }).rows.find((x) => x.year === 2060);
  near(at.out.spending, base.out.spending - 12 * 6999, 0.01, "spending in 2060");
  assert.equal(yearMarks(r, yearFacts(r, { today: TY }))[2060][0].floored, false);
  // the page: one dollar more is refused at the box with the kit's words, nothing saved
  const s = await yearPage(familyPlan(TY));
  s.tap(2060); s.button(s.row(2060), "Spend less").click();
  const box = s.row(2060).querySelector("form").querySelector('[name="amount"]');
  assert.equal(Number(box.getAttribute("max") ?? box.max), 6999, "the box's most is that year's spending");
  // a cut larger than the spending, made elsewhere (Will the money last? or by hand), says it is taken to $0
  const big = familyPlan(TY); big.retirement.happenings = [{ id: "h1", kind: "spend", year: 2060, untilYear: 2060, monthly: -1000000 }];
  const mb = yearMarks(big, yearFacts(big, { today: TY }));
  assert.equal(mb[2060][0].floored, true);
  const sb = await yearPage(big);
  assert.match(sb.text(sb.row(2060)), /changed Spending goes down \$1,000,000 a month in 2060 \(more than that year's spending, so spending is taken to \$0\)$/);
  // with spending already at its floor that year, Spend less is not offered
  sb.tap(2060);
  assert.equal(sb.button(sb.row(2060), "Spend less"), null);
  assert.ok(sb.button(sb.row(2060), "Spend more"));
});

test("critic F3: Remove takes out that one line only, and a save never writes over a line another tab added", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { removeYearChange } = await import("./compute.js");
  const two = [{ id: "h1", kind: "in", year: 2060, amount: 1000 }, { id: "h1", kind: "out", year: 2060, amount: 2000 }];
  const p = familyPlan(TY); p.retirement.happenings = structuredClone(two);
  const s = await yearPage(p);
  s.tap(2060);
  s.root.all().filter((e) => e.tagName === "BUTTON" && e.textContent === "Remove")[1].click();
  assert.deepEqual(s.now.retirement.happenings, [two[0]], "the second line goes, the first with its id stays");
  s.draw();
  s.button(s.row(2060).querySelector(".notice"), "Undo").click();
  assert.deepEqual(s.now.retirement.happenings, two, "Undo puts back that one line");
  // the pure helper: the line itself first, else the first with its id, the field gone when empty
  const d = { retirement: { happenings: structuredClone(two) } };
  assert.equal(removeYearChange(d, two[1]), true); assert.deepEqual(d.retirement.happenings, [two[0]]);
  assert.equal(removeYearChange(d, { id: "h1", kind: "in", year: 2060, amount: 999 }), true, "changed since: the line with its id");
  assert.equal(d.retirement.happenings, undefined);
  assert.equal(removeYearChange(d, two[0]), false);
  // a page drawn from an older plan: the other tab's h1 lands in the store before this one saves
  const t = await yearPage(familyPlan(TY));
  t.tap(2060); t.button(t.row(2060), "Money coming in once").click();
  const other = { id: "h1", kind: "out", year: 2070, name: "Other tab", amount: 5000 };
  t.now = { ...t.now, retirement: { ...t.now.retirement, happenings: [other] } };
  t.submit(2060, { amount: 7000 });
  assert.deepEqual(t.now.retirement.happenings, [other, { id: "h2", kind: "in", year: 2060, amount: 7000 }], "both lines, each its own id");
});

test("critic F4 and F5: money in says where it goes; a change in a year with no row of its own is still said", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const s = await yearPage(familyPlan(TY));
  s.tap(2060); s.button(s.row(2060), "Money coming in once").click();
  assert.match(s.text(s.row(2060).querySelector("form")), /How much \$ after any tax, in today's dollars\. It goes into savings at the start of the year\. Save Cancel$/);
  // before retirement, with Years from retirement on: the line names it and the way to see it
  const p = familyPlan(TY); p.retirement.happenings = [{ id: "h1", kind: "out", year: 2040, name: "A new roof", amount: 40000 }];
  const h = await yearPage(p);
  assert.match(h.text(), /Tap a year to change it\. Your changes in years not listed here: A new roof in 2040: \$40,000 out of savings\. Choose every year under Years to see it\. /);
  const years = h.root.all().find((e) => e.tagName === "SELECT" && e.getAttribute("aria-label") === "Years");
  years.value = "all"; years.dispatch("change");
  h.draw();
  assert.doesNotMatch(h.text(), /years not listed here/, "every year: the row says it");
  assert.match(h.text(h.row(2040)), /changed A new roof in 2040: \$40,000 out of savings$/);
  years.value = "retirement"; years.dispatch("change");
  // in the folded "nothing left" years: said in the line, with no way to unfold (it is not the filter)
  const { renderPage, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const rd = renterDebtPlan(TY);
  const d0 = compute(rd, { today: TY });
  const lastYear = d0.rows.at(-1).year;
  rd.retirement = { ...(rd.retirement ?? {}), happenings: [{ id: "h1", kind: "in", year: lastYear, name: "A gift", amount: 500 }] };
  const r = await renderPage(new URL("./view.js", import.meta.url).href, rd, TY);
  const t = textOf(r.root);
  assert.match(t, / to \d{4} Left: not known yet about \$[\d,]+ of spending a year not covered/, "the folded row is there (\"Left: not known yet\" under \"we can't say yet\": y2 (b))");
  assert.match(t, new RegExp(`Your changes in years not listed here: A gift in ${lastYear}: \\$500 into savings\\. (?!Choose)`));
});

test("critic P2 and P4: a chevron on each record, the open row tinted, and Close shuts the year", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("./view.js", import.meta.url), "utf8");
  assert.match(src, /\.cf-root \.cf-row::after \{ content: "›";/, "a chevron after each phone record");
  assert.match(src, /\.cf-root \.cf-row\[aria-expanded="true"\]::after \{ transform: translateY\(-50%\) rotate\(90deg\); \}/);
  assert.match(src, /\.cf-root \.records li\.cf-open \{[^}]*background: var\(--accent-soft\)/, "the open row tinted");
  assert.match(src, /\.cf-root \.cf-panel \.chip\[aria-expanded="true"\] \{ border-color: var\(--accent\); background: var\(--accent-soft\); color: var\(--accent-ink\); \}/, "the chosen chip outlined in the accent, not filled (one filled button: Save)");
  const s = await yearPage(familyPlan(TY));
  s.tap(2060);
  const close = s.button(s.row(2060), "Close");
  assert.match(close.className, /secondary/);
  assert.equal(close.getAttribute("aria-label"), "Close 2060");
  close.click();
  assert.equal(s.row(2060).querySelector(".cf-panel"), null);
  assert.equal(s.row(2060).querySelector(".cf-row").getAttribute("aria-expanded"), "false");
  assert.doesNotMatch(s.row(2060).className, /\bcf-open\b/);
  s.tap(2060);
  assert.ok(s.row(2060).querySelector(".cf-panel"), "and opens again");
  assert.equal(s.saves, 0);
});

// ---------------------------------------------------------------- leftovers of the rechecks (y2, 2026-11-16)
/** Every invented household (y2 invariance, against 398a01e): the qa fixture plans, the qa/households archetypes, the phone,
 *  round 8 and persona households, and the empty plan. */
async function y2Plans(today) {
  const fs = await import("node:fs"), path = await import("node:path"), { fileURLToPath, pathToFileURL } = await import("node:url");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const phone = await import("../../../qa/fixtures/phone-households.mjs");
  const round8 = await import("../../../qa/fixtures/round8-households.mjs");
  const personas = await import("../../../qa/fixtures/setup-personas.mjs");
  const { migrate, emptyPlan: blank } = await import("../../../core/schema/migrate.js");
  const out = [];
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../qa/fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) out.push([`fixture ${f}:${name}`, fn(today)]);
  }
  for (const a of ARCHETYPES) out.push([`${a.id}/base`, a.build()]);
  for (const [name, fn] of Object.entries(phone)) if (typeof fn === "function") out.push([`phone ${name}`, fn()]);
  for (const [name, fn] of Object.entries(round8)) if (typeof fn === "function" && /Plan$/.test(name)) out.push([`round8 ${name}`, fn()]);
  for (const n of ["sam", "jordan", "patLee", "ruth"]) out.push([`persona ${n}`, personas.finishSetup(n, personas[n](today), today)]);
  out.push(["empty plan", blank()]);
  return out.map(([name, p]) => [name, migrate(structuredClone(p))]);
}
const y2Digest = async (x) => (await import("node:crypto")).createHash("sha256").update(typeof x === "string" ? x : JSON.stringify(x) ?? "undefined").digest("base64url").slice(0, 22);

// (b) Under "we can't say ... yet" (nothing saved for retirement and nothing going in: the invented Riley), a year whose savings are
// gone read "$0 left" beside that lead; it reads "Left: not known yet" now (a bare dash at first; fix round, critic P1: the value
// said nothing), "not known yet" in the table's Left column, and the folded run of such years says only what is not covered.
test("y2 (b) nothing saved (Riley): a year with nothing left reads Left: not known yet, not $0 left, in the records, the folded run and the table", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { LEFT_UNKNOWN, LEFT_UNKNOWN_RECORD } = await import("./view.js");
  assert.equal(LEFT_UNKNOWN, "not known yet"); assert.equal(LEFT_UNKNOWN_RECORD, "Left: not known yet");
  const s = await yearPage(renterDebtPlan());
  s.draw();
  const d = compute(s.now, { today: TY });
  assert.ok(d.unknown?.nothingSaved, "Riley: the page's lead says we can't say whether the money lasts");
  assert.match(s.text(), /Nothing is saved for retirement, so we can't say whether the money lasts yet\./);
  assert.doesNotMatch(s.text(), /\$0 left/, "no $0 left anywhere on the page");
  // 2067, the first year retired: "Left: not known yet", then what the year does, in the plain colour (as before)
  const y = s.row(2067);
  const value = y.all().find((e) => e.className.split(/\s+/).includes("rec-value"));
  assert.equal(s.text(value), "Left: not known yet"); assert.doesNotMatch(value.className, /\bbad\b/);
  assert.match(s.text(y), /^2067 · age 65 Left: not known yet \$[\d,]+ spent \(\$[\d,]+ health insurance\) · .* tax \$[\d,]+ of spending not covered this year$/);
  // the folded run of years: "Left: not known yet" and what is not covered, with no "nothing left" under it
  const tail = s.root.all().filter((e) => e.tagName === "LI").at(-1);
  assert.match(s.text(tail), /^2068 to 2097 Left: not known yet about \$[\d,]+ of spending a year not covered$/);
  // the table (a wider screen): the Left cell of 2067 is "not known yet" under the column's heading, and the line under it has no
  // "nothing left"
  const cells = s.root.all().filter((e) => e.tagName === "TD");
  const row2067 = s.root.all().find((e) => e.tagName === "TR" && e.all().some((c) => c.tagName === "BUTTON" && s.text(c) === "2067"));
  assert.equal(s.text(row2067.children.at(-1)), "not known yet");
  assert.ok(cells.length > 0);
  assert.match(s.text(), /2068 to 2097: about \$[\d,]+ of spending a year not covered\./);
  // a year with money in it still says it: Riley's cash before retirement
  s.root.all().find((e) => e.tagName === "SELECT" && e.getAttribute("aria-label") === "Years").value = "all";
  s.root.all().find((e) => e.tagName === "SELECT" && e.getAttribute("aria-label") === "Years").dispatch("change");
  s.draw();
  assert.match(s.text(s.row(2026)), /^2026 · age 24 \$1,020 left /);
  const years = s.root.all().find((e) => e.tagName === "SELECT" && e.getAttribute("aria-label") === "Years");
  years.value = "retirement"; years.dispatch("change");
});
test("y2 (b) the words: what a year the money does not cover says, four cases", async () => {
  const { shortWords } = await import("./view.js");
  assert.equal(shortWords("$29,040"), "$29,040 short this year");
  assert.equal(shortWords("$29,040", { unknown: true }), "$29,040 of spending not covered this year");
  assert.equal(shortWords("$29,711", { every: true }), "nothing left; about $29,711 short every year");
  assert.equal(shortWords("$29,711", { unknown: true, every: true }), "about $29,711 of spending a year not covered");
});
test("y2 (b) a plan with savings reads as before: the family's records say what is left, in red when short", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const s = await yearPage(familyPlan(TY));
  s.draw();
  assert.ok(!compute(s.now, { today: TY }).unknown);
  assert.doesNotMatch(s.text(), /not known yet/);
  assert.match(s.text(s.row(2060)), /^2060 · ages [\d]+ and [\d]+ \$[\d,]+ left /);
});
// fix round, critic P2: under "we can't say yet" the lede also said "Over the whole plan: $715,836 of guaranteed income, $1,341
// taken from savings, $0 of tax on withdrawals." (Sam), beside "You haven't told us about retirement savings" and a first retired
// year with "$0 guaranteed income". The whole plan's totals are said only when the page can answer.
test("y2 (b) fix P2: the lede leaves out the whole plan's totals under \"we can't say yet\", and keeps them for a plan it answers", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const personas = await import("../../../qa/fixtures/setup-personas.mjs");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const lede = (s) => s.text(s.root.all().find((e) => e.tagName === "P" && e.className === "lede"));
  const riley = await yearPage(renterDebtPlan()); riley.draw();
  assert.equal(lede(riley), "72 years, from 2026 to 2097. Nothing is saved for retirement, so we can't say whether the money lasts yet. Once you start saving, add it and we can answer.");
  const sam = await yearPage(personas.finishSetup("sam", personas.sam(TY), TY)); sam.draw();
  assert.ok(compute(sam.now, { today: TY }).unknown, "Sam: the page cannot answer");
  assert.doesNotMatch(lede(sam), /Over the whole plan|guaranteed income|taken from savings/);
  assert.match(lede(sam), /^\d+ years, from 2026 to \d{4}\. You haven't told us about retirement savings, so we can't say whether the money lasts yet\. Add what you own and we can answer\.$/);
  const fam = await yearPage(familyPlan(TY)); fam.draw();
  assert.match(lede(fam), /^\d+ years, from 2026 to \d{4}\. The money (runs out in \d{4}|lasts to the end)\. Over the whole plan: \$[\d,]+ of guaranteed income, \$[\d,]+ taken from savings, \$[\d,]+ of tax on withdrawals\.$/);
});

// (b) invariance: with nothing new typed, Year by year's figures (both dollar choices) are those of 398a01e for every household, and
// its words too for every household the page can answer for (no "we can't say yet"). Written with PRINT_Y2=1 on 398a01e's code.
test("y2 (b) invariance: the figures for every household, and the words wherever the answer is known, are those of 398a01e", async () => {
  const fs = await import("node:fs");
  const file = new URL("./y2-invariance.json", import.meta.url);
  const now = {};
  for (const [name, plan] of await y2Plans(TY)) {
    const safe = (f) => { try { return f(); } catch (e) { return `THROW ${e.message}`; } };
    const real = safe(() => compute(structuredClone(plan), { today: TY })), nominal = safe(() => compute(structuredClone(plan), { today: TY, real: false }));
    const s = await yearPage(plan, { route: { rest: [], query: {}, name } });
    const words = safe(() => { s.draw(); return s.text(); });
    now[name] = { figures: await y2Digest([real, nominal]), words: await y2Digest(words), unknown: !!real?.unknown };
  }
  if (process.env.PRINT_Y2) { fs.writeFileSync(file, `${JSON.stringify({ note: "digests at 398a01e (y2 leftovers); PRINT_Y2=1 writes them again: only on that code", plans: now }, null, 1)}\n`); return; }
  const was = JSON.parse(fs.readFileSync(file, "utf8")).plans;
  assert.ok(Object.keys(was).length >= 45, `${Object.keys(was).length} households`);
  assert.deepEqual(Object.keys(now), Object.keys(was));
  assert.ok(Object.values(was).some((x) => x.unknown), "a household the page cannot answer for is among them");
  for (const name of Object.keys(was)) {
    assert.equal(now[name].figures, was[name].figures, `${name}: figures`);
    assert.equal(now[name].unknown, was[name].unknown, name);
    if (!was[name].unknown) assert.equal(now[name].words, was[name].words, `${name}: words`);
  }
});

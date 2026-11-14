// The full checks for this page are in tests/debt-pages.test.mjs (shared fixture qa/fixtures/debt-plan.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { debtPlan } from "../../../qa/fixtures/debt-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("ratios: runs on the sample household and on an empty plan", () => {
  const d = compute(debtPlan(), { today: "2026-09-15" });
  assert.ok(d.dti > 0 && d.dti < 1); assert.equal(d.rows.length, 4);
  assert.ok(compute(emptyPlan(), { today: "2026-09-15" }));
});

test("card use: Credit cards' answer to how much less gets under 30%, and the required part of what is paid", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const today = "2026-11-02";
  const d = compute(familyPlan(today), { today });
  assert.equal(Math.round(d.under.less30), 1900); assert.equal(d.under.date30, "2027-06-02");
  assert.ok(d.minimums < d.payments, "the family pays more than the required amounts");
});

// --- round 8 (2026-11-06), renter-debt-6: a renter's debt payments are graded on the renters' line --------------------------
test("round 8: a renter's 21% is over the CFPB's 20% line for renters (rent not counted); with a housing payment like the rent, 49.8%", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const d = compute(renterDebtPlan(), { today: "2026-11-06" });
  // $670 of required payments on $3,250 a month: 20.6%; the line for renters is 15 to 20% or less, rent not counted
  assert.ok(Math.abs(d.dti - 670 / 3250) < 1e-12);
  assert.equal(d.renter, true);
  assert.deepEqual([d.grades.dti.level, d.grades.dti.label], ["warn", "over the guideline for renters"]);
  // a home lender adds the housing payment: (670 + 950) / 3,250 = 49.85%
  assert.ok(Math.abs(d.withHousing - 1620 / 3250) < 1e-12);
  const row = d.rows.find((r) => r.key === "dti");
  assert.match(row.why, /renters/); assert.match(row.note, /like your \$950 rent and a lender would see 50% of your income going to debts: more than most lenders accept/);
  // a homeowner (a mortgage on file): as before, 36% comfortable, no renter fields
  const own = compute(debtPlan(), { today: "2026-09-15" });
  assert.equal(own.grades.dti.label, "comfortable"); assert.equal("renter" in own, false); assert.equal("withHousing" in own, false);
});

// --- round 8 review (2026-11-06): D3 required payments, D6 a rent that has ended, D7 graded at the percent shown ---------------
test("review D3: a renter paying $400 extra is graded on the $320 required (10%, within); a lender would see 39%, not 51%", async () => {
  const { renterPayingExtraPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const d = compute(renterPayingExtraPlan(), { today: "2026-11-06" });
  const row = d.rows.find((r) => r.key === "dti");
  assert.ok(Math.abs(row.value - 320 / 3250) < 1e-12, String(row.value));
  assert.deepEqual([d.grades.dti.level, d.grades.dti.label], ["ok", "within the guideline for renters"]);
  // (320 + 950) / 3,250 = 39.1% (Fannie Mae B3-6-05: a card counts at its required minimum)
  assert.ok(Math.abs(d.withHousing - 1270 / 3250) < 1e-12);
  assert.match(row.note, /lender would see 39% of your income going to debts: more than the 36% most lenders like/);
});

test("review D6: the rent a lender would add is today's rent, not one that has ended", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const p = renterDebtPlan(); p.expenses.find((x) => x.category === "housing").endDate = "2025-12-31";
  const d = compute(p, { today: "2026-11-06" });
  assert.equal(d.housingPayment, 0); assert.equal(d.withHousing, null); assert.equal(d.rows.find((r) => r.key === "dti").note, undefined);
  p.expenses.push({ id: "rent2", name: "New rent", category: "housing", essential: true, period: "monthly", inflates: true, startDate: "2026-01-01", endDate: "", amount: 1000 });
  const e = compute(p, { today: "2026-11-06" });
  assert.equal(e.housingPayment, 1000); assert.match(e.rows.find((r) => r.key === "dti").note, /your \$1,000 rent/);
});

test("review D7: shares are graded at the whole percent the page shows", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  // $660 / $3,250 = 20.3%, shown as 20%: within the 20% line, as it reads
  const p = renterDebtPlan(); p.debts.find((x) => x.id === "setup-debt-credit").minPayment = 140;
  assert.equal(compute(p, { today: "2026-11-06" }).grades.dti.label, "within the guideline for renters");
  assert.equal(compute(renterDebtPlan(), { today: "2026-11-06" }).grades.dti.label, "over the guideline for renters", "20.6% shows as 21%");
  // rent $920 on $3,250: 28.3%, shown as 28%: comfortable against 28%
  const q = renterDebtPlan(); q.expenses.find((x) => x.category === "housing").amount = 920;
  assert.equal(compute(q, { today: "2026-11-06" }).grades.housing.label, "comfortable");
});

// --- verify (2026-11-06): rent of exactly 28.5% of income is printed "29%" and graded as 29% -----------------------------------------
test("verify: housing at 28.5% reads 29% and on the high side, here and on How am I doing", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { compute: bench } = await import("../../overview/benchmarks/compute.js");
  const { pct } = await import("../../../core/format.js");
  const p = renterDebtPlan(); p.expenses.find((e) => e.category === "housing").amount = 926.25;   // 926.25 / 3,250 = 28.5%
  const d = compute(p, { today: "2026-11-06" }), row = d.rows.find((r) => r.key === "housing");
  assert.equal(pct(row.value, 0), "29%"); assert.equal(row.grade.label, "on the high side");
  const h = bench(p, { today: "2026-11-06" }).items.find((x) => x.id === "housing");
  assert.equal(h.verdict, "behind"); assert.match(h.sentence, / is 29% of income before tax/);
});

// --- verify (2026-11-06): a rent that is still our guess is not "your rent" ---------------------------------------------------------
test("verify: when the rent is our guess, the home-lender sentence says so, here and on How am I doing", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { markGuess } = await import("../../../core/estimate/index.js");
  const { compute: bench } = await import("../../overview/benchmarks/compute.js");
  const T = { today: "2026-11-06" };
  const p = renterDebtPlan();
  // Get started's housing row filled in by our guesses (smart guesses, spending): $1,200 a month
  assert.ok(markGuess(p, "expenses[setup-x-housing].amount", { key: "spend.housing", value: 1200, unit: "usd/mo", sigma: 300, dataAsOf: "2025" }, T.today));
  // (670 + 1,200) / 3,250 = 57.5%, printed 58%
  const note = compute(p, T).rows.find((r) => r.key === "dti").note;
  assert.match(note, /^Add a home payment like the \$1,200 rent we guessed for you \(type yours on Expenses\) and a lender would see 58% of your income going to debts/);
  assert.ok(!/your \$1,200 rent/.test(note), note);
  assert.match(bench(p, T).items.find((x) => x.id === "debt").sentence, /the \$1,200 rent we guessed for you/);
  // a typed rent is still "your rent"
  assert.match(compute(renterDebtPlan(), T).rows.find((r) => r.key === "dti").note, /^Add a home payment like your \$950 rent/);
});

// --- simple first (docs/OPTIONAL.md; gap design #18's links row), 2026-11-13 -----------------------------------------------------
/** The page drawn on the fake DOM: the words outside the parts (the first view), and each part's title, status and words. */
async function firstView(plan, today = "2026-11-13") {
  const { renderPage, textOf, FakeElement } = await import("../../../qa/fixtures/fake-dom.mjs");
  const r = await renderPage(new URL("./view.js", import.meta.url), plan, today, { route: { rest: [], query: {} } });
  const outside = (n) => (n.tagName === "STYLE" ? "" : n.tagName === "DETAILS" ? textOf(n.childNodes[0]) : n.childNodes ? n.childNodes.map((c) => (c instanceof FakeElement ? outside(c) : c.data)).join(" ") : "");
  const parts = r.root.querySelectorAll("details").map((x) => ({ id: x.dataset.part, kind: x.dataset.kind, title: x.querySelector(".fold-title")?.textContent, status: x.querySelector(".fold-status")?.textContent ?? "", open: x.hasAttribute("open"), text: textOf(x) }));
  return { root: r.root, first: outside(r.root).replace(/\s+/g, " ").trim(), parts };
}

test("simple first: one headline and one written sentence per case (homeowner, renter, no debts, no income)", async () => {
  const { headlineOf, sentenceOf } = await import("./view.js");
  const { pct } = await import("../../../core/format.js");
  const own = (level, dti) => ({ hasIncome: true, hasDebts: true, dti, grades: { dti: { level } } });
  assert.equal(headlineOf(own("ok", 0.196), pct), "Lenders would see 20% of your income going to debts: usually fine");
  assert.equal(sentenceOf(own("ok", 0.196)), "That is under the 36% most lenders like to see.");
  assert.equal(headlineOf(own("warn", 0.4), pct), "Lenders would see 40% of your income going to debts: on the high side");
  assert.equal(sentenceOf(own("warn", 0.4)), "That is over the 36% most lenders like; many still approve up to 43%, but the payments get tight.");
  assert.equal(headlineOf(own("bad", 0.52), pct), "Lenders would see 52% of your income going to debts: high");
  assert.equal(sentenceOf(own("bad", 0.52)), "That is more than most lenders accept: some go to 45 or 50%, and only with a strong credit score and savings.");
  const rent = (level, req) => ({ hasIncome: true, hasDebts: true, renter: true, dti: 0.9, dtiRequired: req, grades: { dti: { level } } });
  assert.equal(headlineOf(rent("ok", 0.098), pct), "Lenders would see 10% of your income going to debts: usually fine", "a renter's required payments, not what is paid on top");
  assert.equal(sentenceOf(rent("ok", 0.098)), "Your debt payments, not counting rent, are within the 15 to 20% guideline for renters.");
  assert.equal(sentenceOf(rent("warn", 0.21)), "Your debt payments, not counting rent, are over the 15 to 20% guideline for renters.");
  assert.equal(sentenceOf(rent("bad", 0.4)), "Your debt payments alone, not counting rent, are more than the 36% lenders like for everything, a home payment included.");
  assert.equal(headlineOf({ hasIncome: true, hasDebts: false }, pct), "Lenders would see no debts on your income");
  assert.equal(sentenceOf({ hasIncome: true, hasDebts: false }), "No debts on file. If you have any, add them; if not, every ratio here is zero, which is the best it gets.");
  assert.equal(headlineOf({ hasIncome: false, hasDebts: true }, pct), "What lenders see");
  assert.equal(sentenceOf({ hasIncome: false, hasDebts: true }), "Most of these need your income.");
  assert.equal(sentenceOf({ hasIncome: false, hasDebts: false }), "Most of these need your income first, then your debts.");
  // the real households read the same way
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const r = compute(renterDebtPlan(), { today: "2026-11-06" });
  assert.equal(headlineOf(r, pct), "Lenders would see 21% of your income going to debts: on the high side");
});

test("simple first: the family's first view is the answer, the card-use line and its way on; the numbers and the ratios are one tap away", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { first, parts, root } = await firstView(familyPlan("2026-11-13"));
  assert.match(first, /^Lenders would see 20% of your income going to debts: usually fine That is under the 36% most lenders like to see\. \$1,900 less on the cards gets you under 30%: about June 2027 at what you pay now\. Open my payoff plan/);
  assert.ok(!/Income a month|Debt payments out of income|rules of thumb/.test(first), first);
  assert.deepEqual(parts.map((x) => [x.id, x.kind, x.title, x.status, x.open]), [["numbers", "more", "3 more numbers", "", false], ["how", "how", "How this is worked out", "4 ratios", false]]);
  assert.match(parts[0].text, /Income a month/); assert.match(parts[0].text, /You owe in total/);
  assert.match(parts[1].text, /Card limits in use/); assert.match(parts[1].text, /rules of thumb from US lending/);
  // no filled button once there is an answer; "More on this" asks the credit score question
  assert.ok(!root.querySelectorAll("a").some((a) => a.className === "btn"));
  assert.ok(root.querySelectorAll("a").some((a) => a.getAttribute("href") === "#/debt/credit-score" && /What is my credit score\?/.test(a.textContent)));
  assert.ok(first.split(" ").length <= 160, String(first.split(" ").length));
});

test("simple first: housing over the high line is never folded; the renter's home-lender sentence is in the working", async () => {
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const p = renterDebtPlan(); p.expenses.find((x) => x.category === "housing").amount = 1200;   // 1,200 / 3,250 = 37%
  const { first, parts } = await firstView(p, "2026-11-06");
  assert.match(first, /Housing takes 37% of your income before tax: more than the 35% lenders call high\./);
  assert.match(parts.find((x) => x.id === "how").text, /a lender would see 58% of your income going to debts/);
  // no income: the empty page keeps its two ways to start and nothing else
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const e = await firstView(emptyPlan());
  assert.equal(e.first, "What lenders see Most of these need your income first, then your debts. Add your income Add your debts");
  assert.equal(e.parts.length, 0);
});

test("S11: What lenders see saves nothing (no box, no Save, no store.update), so no part can move after a save; a tap on any part, button or link writes nothing", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("./view.js", import.meta.url), "utf8");
  assert.ok(!/\bstore\b|\.update\(/.test(src), "the view never writes the plan");
  // the page drawn with a ctx that records every key the page (and the helpers it calls) reads, a store that records every
  // method asked for, and a plan frozen all the way down: a save by any path (store.update, ctx.save, a helper, a write
  // into the plan) is seen here, not only the one the source names (integ2 check, item 5)
  const { FakeElement } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { render } = await import("./view.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const freeze = (o) => { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); for (const v of Object.values(o)) freeze(v); } return o; };
  const READS = ["ui", "fmt", "plan", "module", "route", "view", "computeOf", "computeRemote", "redraw", "modules"];   // what a page may read and still save nothing ("modules": the list of pages, read by the shared "How this is worked out" part to link How we work out the answers)
  for (const plan0 of [familyPlan("2026-11-13"), renterDebtPlan(), retiredCouplePlan()]) {
    const p = freeze(migrate(structuredClone(plan0)));
    const was = JSON.stringify(p);
    const read = new Set(), asked = [];
    const store = new Proxy({ get: () => p }, { get: (t, k) => { asked.push(String(k)); return t[k]; } });
    const draw = () => {
      const root = new FakeElement("main");
      const ctx = new Proxy({ ui, fmt: { ...fmt, today: () => "2026-11-13" }, plan: p, route: { rest: [], query: {} }, module: { group: "debt", id: "ratios" }, store, computeOf: () => null, redraw: () => {} },
        { get: (t, k) => { read.add(String(k)); return t[k]; } });
      render(root, ctx);
      return root;
    };
    const openOf = (root) => root.querySelectorAll("details").filter((x) => x.dataset.part).map((x) => [x.dataset.part, x.hasAttribute("open")]);
    const root = draw();
    await new Promise((r) => setTimeout(r, 0));
    const before = openOf(root);
    assert.deepEqual(before, [["numbers", false], ["how", false]]);
    assert.equal(root.querySelectorAll("input").length + root.querySelectorAll("select").length + root.querySelectorAll("textarea").length + root.querySelectorAll("form").length, 0, "no box and no form");
    // every tap a person can make: each part opened and shut, each button, each link, a change on anything
    for (const d of root.querySelectorAll("details")) { d.setAttribute("open", ""); d.dispatch("toggle"); d.removeAttribute("open"); d.dispatch("toggle"); }
    for (const b of root.querySelectorAll("button")) b.click();
    for (const a of root.querySelectorAll("a")) a.dispatch("click");
    for (const e of root.all()) { e.dispatch("change"); e.dispatch("input"); }
    await new Promise((r) => setTimeout(r, 0));
    assert.deepEqual(asked, [], "the store was never asked for anything");
    assert.deepEqual([...read].filter((k) => !READS.includes(k)), [], "no other way to save was reached");
    assert.equal(JSON.stringify(p), was, "the plan is as it was");
    // the redraw a save would bring: every part as it was before the taps (none can be the one saved in)
    assert.deepEqual(openOf(draw()), before);
  }
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, ASSUMPTIONS, RETURN_PRESETS, INFLATION_PRESETS, HOPEFUL_MAX, HOPEFUL_WORDS, FORECAST_LINE, FORECAST_SOURCE, FORECASTS, hopefulReturn, saveAssumptions } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-09-15";
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test("defaults in emptyPlan match the documented defaults; nothing changed; not reviewed", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  for (const r of d.rows) assert.equal(r.value, r.def, r.key);
  assert.equal(d.changedCount, 0);
  assert.equal(d.reviewedAt, null);
  assert.equal(d.stale, true);
  assert.deepEqual(d.warnings, []);
  assert.equal(ASSUMPTIONS.length, 10);
});
test("real returns are (1+nominal)/(1+inflation)-1", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  near(d.realStocks, 1.07 / 1.03 - 1);
  near(d.realCash, 1.02 / 1.03 - 1);
});
test("changed values are counted; a missing key falls back to the default", () => {
  const p = emptyPlan();
  p.assumptions.returnStocks = 0.09;
  delete p.assumptions.emergencyMonths;
  const d = compute(p, { today: TODAY });
  assert.equal(d.changedCount, 1);
  assert.equal(d.rows.find((r) => r.key === "emergencyMonths").value, 6);
});
test("review stamp: fresh, stale after a year", () => {
  const p = emptyPlan();
  p.assumptions.reviewedAt = "2026-09-01";
  let d = compute(p, { today: TODAY });
  assert.equal(d.daysSinceReview, 14); assert.equal(d.stale, false);
  p.assumptions.reviewedAt = "2025-01-01";
  d = compute(p, { today: TODAY });
  assert.equal(d.stale, true);
});
test("warnings: stocks below bonds, optimistic stocks, retirement past plan end", () => {
  const p = emptyPlan();
  p.assumptions.returnStocks = 0.03; p.assumptions.returnBonds = 0.04;
  assert.ok(compute(p).warnings.some((w) => w.includes("less than bonds")));
  p.assumptions.returnStocks = 0.15; p.assumptions.inflation = 0.03;
  assert.ok(compute(p).warnings.some((w) => w.includes("optimistic") && w.includes(HOPEFUL_WORDS)), "one amber line, with history's word too");
  assert.equal(compute(p).warnings.filter((w) => /forecast|optimistic/.test(w)).length, 1);
  p.assumptions.retirementAge = 95; p.assumptions.planEndAge = 95;
  assert.ok(compute(p).warnings.some((w) => w.includes("end age")));
});

// ---- careful, middle and hopeful (spec L5, owner's request 2026-11-11) ----
test("L5 presets: careful 6%, middle 7% (ours, the default), hopeful 8%; prices 2.5%, 3% (ours, the default), 4%; each with a reason", () => {
  assert.deepEqual(RETURN_PRESETS.map((x) => [x.name, x.value, !!x.ours]), [["Careful", 0.06, false], ["Middle", 0.07, true], ["Hopeful", 0.08, false]]);
  assert.deepEqual(INFLATION_PRESETS.map((x) => [x.value, !!x.ours]), [[0.025, false], [0.03, true], [0.04, false]]);
  assert.equal(RETURN_PRESETS.find((x) => x.ours).value, ASSUMPTIONS.find((x) => x.key === "returnStocks").def);
  assert.equal(INFLATION_PRESETS.find((x) => x.ours).value, ASSUMPTIONS.find((x) => x.key === "inflation").def);
  assert.equal(HOPEFUL_MAX, RETURN_PRESETS.at(-1).value);
  for (const x of [...RETURN_PRESETS, ...INFLATION_PRESETS]) assert.ok(x.why.length > 20);
  // the forecasts named with their dates, from one constant (Vanguard VCMM as of 2026-09-30; J.P. Morgan's 2027 LTCMA,
  // released 2026-10-19: U.S. large cap 7.5%, the edition before 6.7%; review 2026-11-12, M6)
  assert.equal(FORECAST_LINE, "Forecasts for the next 10 years or so differ: 4.8%-6.8% a year for U.S. stocks (Vanguard, as of 2026-09-30); 7.5% (J.P. Morgan, October 2026).");
  assert.equal(FORECAST_SOURCE, "J.P. Morgan's figure is for U.S. large companies, from its 2027 long-term capital market assumptions (2026-10-19; 10 to 15 years; the edition before said 6.7%).");
  assert.deepEqual([FORECASTS.vanguard.low, FORECASTS.vanguard.high, FORECASTS.jpMorgan.value, FORECASTS.jpMorgan.before], [0.048, 0.068, 0.075, 0.067]);
  // the newer forecast is above the middle figure and under the hopeful one: "higher than any forecast we know" still holds above 8%
  assert.ok(FORECASTS.jpMorgan.value > RETURN_PRESETS.find((x) => x.ours).value && FORECASTS.jpMorgan.value <= HOPEFUL_MAX);
  // never above the hopeful figure: no preset invites a return higher than the forecasts' top by more than about a point
  assert.ok(RETURN_PRESETS.every((x) => x.value <= 0.068 + 0.0125));
});
test("L5 above 8% is hopeful: the amber line and the flag, not at 8% itself", () => {
  const p = emptyPlan();
  for (const [v, hopeful] of [[0.07, false], [0.08, false], [0.0801, true], [0.09, true]]) {
    p.assumptions.returnStocks = v;
    const d = compute(p, { today: TODAY });
    assert.equal(d.hopeful, hopeful, String(v));
    assert.equal(hopefulReturn(p), hopeful, String(v));
    assert.equal(d.warnings.some((w) => w.includes(HOPEFUL_WORDS)), hopeful, String(v));
  }
  p.assumptions.returnStocks = 0.09;
  assert.equal(compute(p).warnings.find((w) => w.includes(HOPEFUL_WORDS)), `Stocks are set to grow 9% a year. ${HOPEFUL_WORDS}`);
  assert.equal(hopefulReturn({}), false, "no figure: the default 7%");
});
test("L5 saveAssumptions: every figure typed, blanks kept, the review date; the plan's other parts untouched", () => {
  const p = emptyPlan();
  p.assumptions.returnBonds = 0.05;
  const before = JSON.stringify({ ...p, assumptions: null });
  saveAssumptions(p, { returnStocks: 0.06, inflation: 0.025, returnBonds: null, stdevStocks: Number.NaN }, "2026-11-11");
  assert.equal(p.assumptions.returnStocks, 0.06);
  assert.equal(p.assumptions.inflation, 0.025);
  assert.equal(p.assumptions.returnBonds, 0.05, "a blank keeps what is there");
  assert.equal(p.assumptions.stdevStocks, 0.15);
  assert.equal(p.assumptions.reviewedAt, "2026-11-11");
  assert.equal(JSON.stringify({ ...p, assumptions: null }), before);
  const q = {}; saveAssumptions(q, { returnStocks: 0.08 }, null);
  assert.deepEqual(q, { assumptions: { returnStocks: 0.08 } });
});


// ---- a link that names one number: that number alone, its own Save, the rest one quiet tap away (review 2026-11-12, P4) ----
test("P4: ?show=returnStocks opens the stock figure alone with its chips, the forecast line and Save; the other nine fold; Save there saves without marking the rest reviewed", async () => {
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const view = new URL("./view.js", import.meta.url).href;
  const plan = emptyPlan();
  const r = await renderPage(view, plan, "2026-11-11", { route: { rest: [], query: { show: "returnStocks" } } });
  const form = r.root.querySelector("form");
  const fold = form.querySelectorAll("details").find((x) => /as-more/.test(x.className));
  assert.ok(fold, "the other numbers in a fold");
  assert.match(fold.textContent, /^All the numbers9 more›/);
  assert.equal(fold.querySelector('[name="returnStocks"]'), null, "the stock box is not folded");
  for (const x of ASSUMPTIONS.filter((y) => y.key !== "returnStocks")) assert.ok(fold.querySelector(`[name="${x.key}"]`), `${x.key} in the fold`);
  const save = form.querySelectorAll("button").find((b) => b.getAttribute("type") === "submit" || b.textContent === "Save");
  assert.equal(save.textContent, "Save");
  assert.match(r.text(), /Careful 6%.*Middle 7%.*Hopeful 8%/);
  assert.match(r.text(), /Forecasts for the next 10 years or so differ/);
  // a chip, then Save: the figure saved, the review date left alone (the other nine were not looked over)
  assert.ok(r.root.querySelectorAll("button").some((b) => /^Careful/.test(b.textContent)), "the chips over the box");
  form.querySelector('[name="returnStocks"]').value = "6";   // (what "Careful 6%" puts in the box; the fake DOM has no events to send)
  form.reset = () => {};
  form.dispatch("submit");
  assert.equal(r.saved.length, 1);
  assert.equal(r.saved[0].assumptions.returnStocks, 0.06);
  assert.equal(r.saved[0].assumptions.reviewedAt ?? null, null);
  // opened, the fold changes nothing but what Save says it does; then Save marks them all reviewed
  fold.open = true; fold.setAttribute?.("open", ""); fold.dispatch("toggle");
  assert.equal(save.textContent, "Save and mark as reviewed");
  form.dispatch("submit");
  assert.equal(r.saved[1].assumptions.reviewedAt, "2026-11-11");
  // opened plainly (from the menu): the two the owner named, their chips and "Save"; the other eight under the same fold, and
  // opening it turns Save into "Save and mark as reviewed" (the final review F6, owner 2026-11-13: simple by default; round 17's
  // one filled button and "saving is reviewing" kept for when all ten are in view)
  const plain = await renderPage(view, emptyPlan(), "2026-11-11", { route: { rest: [], query: {} } });
  const pf = plain.root.querySelector("form");
  const pfold = pf.querySelectorAll("details").find((x) => /as-more/.test(x.className));
  assert.match(pfold.textContent, /^All the numbers8 more›/);
  for (const k of ["inflation", "returnStocks"]) assert.equal(pfold.querySelector(`[name="${k}"]`), null, `${k} is not folded`);
  for (const x of ASSUMPTIONS.filter((y) => !["inflation", "returnStocks"].includes(y.key))) assert.ok(pfold.querySelector(`[name="${x.key}"]`), `${x.key} in the fold`);
  assert.match(plain.text(), /Careful 6%.*Middle 7%.*Hopeful 8%/);
  assert.match(plain.text(), /2\.5%.*3% \(ours\).*4%/);
  const psave = pf.querySelectorAll("button").find((b) => /^Save/.test(b.textContent));
  assert.equal(psave.textContent, "Save");
  assert.equal(pf.querySelectorAll("button").filter((b) => /^Save/.test(b.textContent)).length, 1, "one Save");
  assert.match(plain.text(), /Save keeps these two numbers\. To look the rest over and mark them all as reviewed, open "All the numbers" first\./);
  pf.reset = () => {};
  pf.dispatch("submit");
  assert.equal(plain.saved[0].assumptions.reviewedAt ?? null, null, "folded: saved, not marked as reviewed");
  pfold.open = true; pfold.dispatch("toggle");
  assert.equal(psave.textContent, "Save and mark as reviewed");
  assert.match(plain.text(), /Saving marks the setup step on the dashboard as done and dates it/);
  pf.dispatch("submit");
  assert.equal(plain.saved[1].assumptions.reviewedAt, "2026-11-11");
});

test("F3 (review 2026-11-13): a figure changed under the closed \"All the numbers\" is said on its line and under Save, and the notice names it", async () => {
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const { jamie } = await import("../../../qa/fixtures/phone-households.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const view = new URL("./view.js", import.meta.url).href;
  const r = await renderPage(view, migrate(jamie()), "2026-11-13", { route: { rest: [], query: { show: "returnStocks" } } });
  const form = r.root.querySelector("form");
  const fold = form.querySelectorAll("details").find((x) => /as-more/.test(x.className));
  assert.match(fold.textContent, /^All the numbers9 more›/);
  // what the inflation chip "4%" does: the box says 4 and an input event goes up to the form
  form.querySelector('[name="inflation"]').value = "4";
  form.dispatch("input");
  assert.match(fold.textContent, /^All the numbers9 more, 1 to save›/);
  assert.match(r.text(), /Save keeps this number and what you changed under "All the numbers"\./);
  // opening and closing changes nothing in the plan
  fold.open = true; fold.dispatch("toggle"); fold.open = false; fold.dispatch("toggle");
  assert.equal(r.saved.length, 0);
  // put back, the line goes back
  form.querySelector('[name="inflation"]').value = "3";
  form.dispatch("change");
  assert.match(fold.textContent, /^All the numbers9 more›/);
  form.querySelector('[name="inflation"]').value = "4";
  form.dispatch("input");
  form.reset = () => {};
  form.dispatch("submit");
  assert.equal(r.saved.length, 1);
  assert.equal(r.saved[0].assumptions.inflation, 0.04);
  const after = await renderPage(view, r.saved[0], "2026-11-13", { route: { rest: [], query: { show: "returnStocks" } } });
  assert.match(after.text(), /Saved: prices rising 3% → 4%\. Your retirement answer: now /);
});

// --- plain words (spec 13.1, C10, 2026-11-13): the lede and the swing labels; keys, defaults and saved values as before -----------
test("C10 plain words: 'How bumpy stocks are, in a typical year'; the lede says what the page is about; keys and figures unchanged", async () => {
  const by = Object.fromEntries(ASSUMPTIONS.map((x) => [x.key, x]));
  assert.equal(by.stdevStocks.label, "How bumpy stocks are, in a typical year");
  assert.equal(by.stdevBonds.label, "How bumpy bonds are, in a typical year");
  assert.equal(by.stdevStocks.def, 0.15); assert.equal(by.stdevBonds.def, 0.05);
  assert.deepEqual(ASSUMPTIONS.map((x) => x.key), ["inflation", "returnStocks", "returnBonds", "returnCash", "stdevStocks", "stdevBonds", "salaryGrowth", "retirementAge", "planEndAge", "emergencyMonths"]);
  // a save still writes the same key
  const p = emptyPlan(); saveAssumptions(p, { stdevStocks: 0.18 }, TODAY);
  assert.equal(p.assumptions.stdevStocks, 0.18);
  const { pageText } = await import("../../../qa/fixtures/fake-dom.mjs");
  const t = await pageText(new URL("./view.js", import.meta.url), emptyPlan(), TODAY);
  assert.match(t, /What the plan assumes about prices and markets\./);
  assert.doesNotMatch(t, /Ten numbers drive every projection|How much stocks swing|How much bonds swing/);
  const fs = await import("node:fs");
  const view = fs.readFileSync(new URL("./view.js", import.meta.url), "utf8");
  assert.ok(view.includes('stdevStocks: "how bumpy stocks are"') && !view.includes("how much stocks swing"), "the save notice uses the same words");
});

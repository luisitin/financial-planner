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

// ---- health costs that rise faster than prices (gap design #10, 2026-11-13) ---------------------------------------------------
import { HEALTH_PRESETS, HEALTH_GROWTH_MAX, HEALTH_SOURCE, HEALTH_SOURCE_LINE, HEALTH_GROWTH_HIGH, healthGrowthOf, healthFactor, healthPoints, healthSays, healthGapPoints, healthHighWords, healthGrowthWords, healthGrowthBridgeWords, saveHealthGrowth } from "./compute.js";
import { healthEffect, healthEffectWords } from "./health.js";

test("#10 the rate: absent, empty, zero, negative or not a number is 'with prices' (0); a figure is kept, held to 10 points", () => {
  // (M1, the money critic 2026-11-14: `true` read as 1 and was held to 10 points; only a number or a number as text counts)
  for (const v of [undefined, null, "", "  ", 0, -0.01, "abc", Number.NaN, true, false, [0.02], ["0.02"], {}, Infinity]) { const p = emptyPlan(); if (v !== undefined) p.assumptions.healthGrowth = v; assert.equal(healthGrowthOf(p), 0, String(v)); }
  assert.equal(healthGrowthOf({}), 0); assert.equal(healthGrowthOf(null), 0);
  const p = emptyPlan(); p.assumptions.healthGrowth = 0.01; assert.equal(healthGrowthOf(p), 0.01);
  p.assumptions.healthGrowth = "0.015"; assert.equal(healthGrowthOf(p), 0.015);
  p.assumptions.healthGrowth = 0.5; assert.equal(healthGrowthOf(p), HEALTH_GROWTH_MAX);
  // the save takes the same care: true or a list stores nothing
  for (const v of [true, [0.02], "abc"]) { const q = emptyPlan(); saveHealthGrowth(q, v); assert.equal("healthGrowth" in q.assumptions, false, String(v)); }
  const q2 = emptyPlan(); saveHealthGrowth(q2, "0.015"); assert.equal(q2.assumptions.healthGrowth, 0.015);
  assert.deepEqual(HEALTH_PRESETS.map((x) => [x.value, x.label]), [[0, "With prices"], [0.01, "1 point faster"], [0.02, "2 points faster"]]);
});

test("#10 the formula: a health cost in year t = cost today x (1 + h)^(t - now); exactly 1 with prices, this year or before", () => {
  assert.equal(healthFactor(0, 2060, 2026), 1); assert.equal(healthFactor(0.01, 2026, 2026), 1); assert.equal(healthFactor(0.01, 2020, 2026), 1);
  near(healthFactor(0.01, 2036, 2026), Math.pow(1.01, 10)); near(healthFactor(0.02, 2027, 2026), 1.02);
  // a premium of $500 a month, ten years on, one point faster: 500 x 1.01^10 = $552.31
  assert.equal(Math.round(500 * healthFactor(0.01, 2036, 2026) * 100) / 100, 552.31);
});

test("#10 the words: points, the status, and the sentence the other pages say (nothing with prices)", () => {
  assert.equal(healthPoints(0.01), "1 point"); assert.equal(healthPoints(0.02), "2 points"); assert.equal(healthPoints(0.015), "1.5 points");
  assert.equal(healthSays(0), "with prices"); assert.equal(healthSays(0.01), "1 point faster"); assert.equal(healthSays(0.025), "2.5 points faster");
  for (const h of [0, 0.01, 0.02, 0.025, 0.1]) assert.ok(healthSays(h).length <= 20, "one line beside the title at 320 px");
  assert.equal(healthGrowthWords(0), ""); assert.equal(healthGrowthBridgeWords(0), "");
  assert.equal(healthGrowthBridgeWords(0.01), "Premiums are set to rise 1 point a year faster than prices (your choice on Assumptions). In a year with a tax credit, the credit takes up the rise; in a year without one, you pay it.");
  assert.equal(healthGrowthWords(0.01), "Health costs are set to rise 1 point a year faster than prices (your choice on Assumptions), so later years cost more in today's dollars.");
  assert.equal(healthGrowthWords(0.02), "Health costs are set to rise 2 points a year faster than prices (your choice on Assumptions), so later years cost more in today's dollars.");
});

test("#10 the source line: the published pair, 5.4% against 4.1% for the economy, said as about 1.3 points, with the day it was read", () => {
  // (M2, the money critic 2026-11-14: the row said 1.4, our own arithmetic from the shares; the published pair gives 1.3)
  assert.equal(HEALTH_SOURCE.growth, 0.054); assert.equal(HEALTH_SOURCE.economy, 0.041);
  assert.equal(HEALTH_SOURCE.gap, 0.013);
  assert.equal(healthGapPoints(), 1.3);
  // the two shares tell much the same story (1.36 a year), and stay in the sources fold as context
  assert.ok(Math.abs(Math.pow(HEALTH_SOURCE.shareTo / HEALTH_SOURCE.shareFrom, 1 / (HEALTH_SOURCE.shareToYear - HEALTH_SOURCE.shareFromYear)) - 1 - 0.0136) < 1e-4);
  assert.match(HEALTH_SOURCE.readOn, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(HEALTH_SOURCE_LINE, "The government's actuaries expect the country's health spending to grow about 1.3 points a year faster than the economy through 2034 (Centers for Medicare and Medicaid Services, June 2026). Nobody knows what your own premiums will do, so this is your choice, not a forecast.");
});

test("#10 a typed rate above 5 points is allowed and says in amber that it is a bad case to try (M4)", async () => {
  assert.equal(HEALTH_GROWTH_HIGH, 0.05);
  for (const h of [0, 0.01, 0.02, 0.05]) assert.equal(healthHighWords(h), "", String(h));
  assert.equal(healthHighWords(0.051), "5.1 points a year is far above what the government's actuaries expect (about 1.3). Kept up for decades it multiplies health costs many times over, so use it to try a bad case, not as your plan.");
  assert.match(healthHighWords(0.1), /^10 points a year is far above/);
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const view = new URL("./view.js", import.meta.url).href;
  const rowOf = async (h) => { const p = migrate(familyPlan("2026-11-13")); p.assumptions.healthGrowth = h; const r = await renderPage(view, p, "2026-11-13", { route: { rest: [], query: { show: "health" } } }); return r.root.querySelectorAll("details").find((x) => x.dataset.part === "health"); };
  const warnIn = (row) => row.querySelectorAll("div").filter((n) => /notice/.test(n.className) && /warn/.test(n.className)).map((n) => n.textContent);
  assert.deepEqual(warnIn(await rowOf(0.05)), []);
  assert.deepEqual(warnIn(await rowOf(0.02)), []);
  const high = warnIn(await rowOf(0.08));
  assert.equal(high.length, 1); assert.match(high[0], /^8 points a year is far above what the government's actuaries expect \(about 1\.3\)/);
});

test("#10 the save: a figure is kept (held to the most); 'with prices' removes the field; compute says it only when chosen", () => {
  const p = emptyPlan(); const before = JSON.stringify(p), d0 = JSON.stringify(compute(p, { today: TODAY }));
  assert.equal("healthGrowth" in compute(p, { today: TODAY }), false);
  saveHealthGrowth(p, 0.01); assert.equal(p.assumptions.healthGrowth, 0.01); assert.equal(compute(p, { today: TODAY }).healthGrowth, 0.01);
  assert.equal(compute(p, { today: TODAY }).changedCount, 0, "not one of the ten");
  saveHealthGrowth(p, 0.4); assert.equal(p.assumptions.healthGrowth, HEALTH_GROWTH_MAX);
  saveHealthGrowth(p, 0); assert.equal("healthGrowth" in p.assumptions, false);
  assert.equal(JSON.stringify(p), before, "back to with prices: the plan is what it was");
  assert.equal(JSON.stringify(compute(p, { today: TODAY })), d0);
  // a stored zero or blank reads as absent
  for (const v of [0, null, ""]) { const q = emptyPlan(); q.assumptions.healthGrowth = v; assert.equal(JSON.stringify(compute(q, { today: TODAY })), d0); }
  const q = {}; saveHealthGrowth(q, 0.02); assert.deepEqual(q, { assumptions: { healthGrowth: 0.02 } });
});

test("#10 what the choice does to this plan, one written sentence per case", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { buildInputs } = await import("../../retirement/projection/compute.js");
  const T = "2026-11-13";
  // not yet: the plan cannot work out a retirement
  const e0 = healthEffect(emptyPlan(), { today: T });
  assert.equal(e0.case, "not-yet");
  assert.equal(healthEffectWords(e0), "This will count once the plan can work out your retirement. It is used for health insurance after you stop work.");
  // with prices: the plan's own health line over retirement
  const fam = migrate(familyPlan(T));
  const e1 = healthEffect(fam, { today: T });
  assert.equal(e1.case, "flat"); assert.equal(e1.total, buildInputs(fam, { today: T }).health.total);
  assert.equal(healthEffectWords(e1), `Now: with prices. On your plan, health insurance after you stop work comes to about $${(Math.round(e1.total / 1000) * 1000).toLocaleString("en-US")} in all, in today's dollars.`);
  // faster: with the choice, and what it would be with prices (the figure of the case above)
  const fast = structuredClone(fam); fast.assumptions.healthGrowth = 0.01;
  const e2 = healthEffect(fast, { today: T });
  assert.equal(e2.case, "faster"); assert.equal(e2.flat, e1.total); assert.ok(e2.total > e2.flat);
  assert.equal(healthEffectWords(e2), `Now: 1 point a year faster than prices. On your plan, health insurance after you stop work comes to about $${(Math.round(e2.total / 1000) * 1000).toLocaleString("en-US")} in all, in today's dollars. Rising with prices it would be about $${(Math.round(e2.flat / 1000) * 1000).toLocaleString("en-US")}.`);
  assert.equal(healthEffectWords({ h: 0.02, case: "faster", total: 505560, flat: 340372 }), "Now: 2 points a year faster than prices. On your plan, health insurance after you stop work comes to about $506,000 in all, in today's dollars. Rising with prices it would be about $340,000.");
  assert.equal(healthEffectWords({ h: 0, case: "flat", total: 8440 }), "Now: with prices. On your plan, health insurance after you stop work comes to about $8,400 in all, in today's dollars.");
  // the spending figure already includes health cover: Will the money last? adds none
  const inc = structuredClone(fast); inc.retirement.healthIncluded = true;
  const e3 = healthEffect(inc, { today: T });
  assert.equal(e3.case, "included");
  assert.equal(healthEffectWords(e3), "You said your spending figure already includes health insurance, so this choice does not change Will the money last? The pages Before Medicare and Medicare at 65 still use it.");
  // none: a line on Expenses already pays the retired couple's Medicare, so the plan adds no health line of its own
  const e4 = healthEffect(migrate(retiredCouplePlan()), { today: T });
  assert.equal(e4.case, "none");
  // (P3, the person critic 2026-11-14: the sentence began with a page title)
  assert.equal(healthEffectWords(e4), "Your plan does not add health insurance of its own right now (a plan at work or a line on Expenses covers it), so this only changes the pages Before Medicare and Medicare at 65.");
  for (const c of ["not-yet", "included", "none", "flat", "faster"]) assert.doesNotMatch(healthEffectWords({ h: 0.01, case: c, total: 1000, flat: 900 }), /^Will the money last\?/, c);
  assert.equal(healthEffectWords(null), "");
});

test("#10 the page: one quiet row 'Health costs rise · with prices', shut; a chip saves at once, the green line names the retirement answer, the row stays open; 'With prices' takes the field away", async () => {
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const view = new URL("./view.js", import.meta.url).href;
  const T = "2026-11-13";
  const plan = migrate(familyPlan(T));
  const partOf = (r) => r.root.querySelectorAll("details").find((x) => x.dataset.part === "health");
  // first view: the row is there, shut, and none of its words or chips are on the page
  const first = await renderPage(view, plan, T);
  const row = partOf(first);
  assert.ok(row, "the row"); assert.equal(row.open, false);
  assert.match(row.textContent, /^Health costs rise with prices›$/);
  assert.doesNotMatch(first.text(), /Type my own|Nobody knows what your own premiums/);
  assert.deepEqual(first.root.querySelectorAll("button").filter((b) => !/secondary|chip/.test(b.className)).map((b) => b.textContent), ["Save"], "one filled button, the form's Save");
  // a link that names it (?show=health, from Before Medicare and Medicare at 65) opens it
  const r = await renderPage(view, plan, T, { route: { rest: [], query: { show: "health" } } });
  const open = partOf(r);
  assert.equal(open.open, true);
  const chips = open.querySelectorAll("button").filter((b) => /chip/.test(b.className));
  assert.deepEqual(chips.map((b) => b.textContent), ["With prices", "1 point faster", "2 points faster", "Type my own"]);
  assert.equal(chips[0].getAttribute("aria-pressed"), "true");
  assert.match(open.textContent, /Now: with prices\. On your plan, health insurance after you stop work comes to about \$[\d,]+ in all, in today's dollars\./);
  assert.match(open.textContent, /about 1\.3 points a year faster than the economy through 2034/);
  // "Type my own" says its limits on the label (P2: 40 was refused with no hint of the limit beforehand)
  chips[3].click();
  assert.ok(open.querySelectorAll("label").some((l) => /^How much faster than prices, a year \(0 to 10\)/.test(l.textContent)), "the box says 0 to 10");
  const ownBox = open.querySelector('[name="healthGrowth"]');
  assert.equal(String(ownBox.getAttribute("max")), "10"); assert.equal(String(ownBox.getAttribute("min")), "0");
  chips[3].click();
  chips[0].click(); assert.equal(r.saved.length, 0);
  // a tap saves
  chips[1].click();
  assert.equal(r.saved.length, 1); assert.equal(r.saved[0].assumptions.healthGrowth, 0.01);
  assert.equal(r.saved[0].assumptions.reviewedAt, plan.assumptions.reviewedAt, "the review date is left alone");
  const after = await renderPage(view, r.saved[0], T);
  assert.match(after.text(), /Saved: health costs now rise 1 point a year faster than prices\. Your retirement answer: lasts to the end, with about \$[\d,]+ less left at \d+ \(today's dollars\)\./);
  const kept = partOf(after);
  assert.equal(kept.open, true, "the saved row stays open");
  assert.match(kept.textContent, /^Health costs rise 1 point faster›/);
  assert.match(kept.textContent, /Now: 1 point a year faster than prices\..*Rising with prices it would be about \$[\d,]+\./);
  // the next draw (nothing saved) it is shut again
  assert.equal(partOf(await renderPage(view, r.saved[0], T)).open, false);
  // back to with prices: the field goes, and the plan is the one we started from
  const back = await renderPage(view, r.saved[0], T, { route: { rest: [], query: { show: "health" } } });
  partOf(back).querySelectorAll("button").find((b) => b.textContent === "With prices").click();
  assert.equal("healthGrowth" in back.saved[0].assumptions, false);
  assert.equal(JSON.stringify(back.saved[0]), JSON.stringify(plan));
  assert.match((await renderPage(view, back.saved[0], T)).text(), /Saved: health costs now rise with prices\. Your retirement answer: lasts to the end, with about \$[\d,]+ more left/);
  // a typed figure reads back as "Yours"
  const own = structuredClone(plan); own.assumptions.healthGrowth = 0.015;
  const o = await renderPage(view, own, T, { route: { rest: [], query: { show: "health" } } });
  assert.ok(partOf(o).querySelectorAll("button").some((b) => b.textContent === "Yours: 1.5 points faster" && b.getAttribute("aria-pressed") === "true"));
  // Reset to defaults takes it away with the rest
  const reset = o.root.querySelectorAll("button").find((b) => b.textContent === "Reset to defaults");
  reset.click();
  assert.equal("healthGrowth" in o.saved.at(-1).assumptions, false);
});

test("S11: after a save only the saved part changes: a chip opens 'Health costs rise' and nothing else; the form's Save moves no part", async () => {
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const view = new URL("./view.js", import.meta.url).href;
  const T = "2026-11-13";
  const plan = migrate(familyPlan(T));
  const openOf = (r) => Object.fromEntries(r.root.querySelectorAll("details").filter((e) => e.dataset.part).map((e) => [e.dataset.part, e.hasAttribute("open")]));
  // every fold of the page but the form's own line is a part of the helper, shut on the first view
  const first = await renderPage(view, plan, T);
  assert.deepEqual(openOf(first), { health: false, sources: false });
  assert.deepEqual(first.root.querySelectorAll("details").filter((e) => !e.dataset.part).map((e) => e.className), ["fold as-more"], "the one fold by hand is the form's own line, All the numbers");
  assert.match(first.root.querySelectorAll("details").find((e) => e.dataset.part === "sources").textContent, /^Where these numbers come from›/);
  // a chip in the row: on the next draw that row is open and the other part is as it was
  const r = await renderPage(view, plan, T, { route: { rest: [], query: { show: "health" } } });
  r.root.querySelectorAll("button").find((b) => b.textContent === "2 points faster").click();
  assert.equal(r.saved.at(-1).assumptions.healthGrowth, 0.02);
  const after = await renderPage(view, r.saved.at(-1), T);
  assert.deepEqual(openOf(after), { health: true, sources: false }, "only the part saved in differs");
  // the form's Save (outside every part): no part opens
  const f = await renderPage(view, r.saved.at(-1), T);
  const form = f.root.querySelector("form");
  form.querySelector('[name="returnStocks"]').value = "6"; form.reset = () => {};
  form.dispatch("submit");
  assert.equal(f.saved.at(-1).assumptions.returnStocks, 0.06);
  assert.equal(f.saved.at(-1).assumptions.healthGrowth, 0.02, "the form's Save leaves the choice alone");
  assert.deepEqual(openOf(await renderPage(view, f.saved.at(-1), T)), { health: false, sources: false });
});

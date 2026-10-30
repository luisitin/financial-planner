import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, flatTax, FLAT, NO_WAGE_TAX, STATE_NAMES, LOCAL_TAX } from "./compute.js";
import { compute as computeFederal } from "../federal/compute.js";
import { US_STATES } from "../../household/people/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const inState = (code, taxes = {}) => { const p = familyPlan(TODAY); p.household.state = code; p.taxes = { ...p.taxes, ...taxes }; return p; };
const AGI = computeFederal(familyPlan(TODAY), { today: TODAY }).result.agi;

test("the tables cover every state the People page offers, and the lists do not overlap", () => {
  for (const c of US_STATES) assert.ok(STATE_NAMES[c], c);
  assert.equal(Object.keys(NO_WAGE_TAX).length, 9);
  for (const c of Object.keys(FLAT)) assert.ok(!NO_WAGE_TAX[c], c);
  for (const c of [...Object.keys(FLAT), ...LOCAL_TAX]) assert.ok(STATE_NAMES[c], c);
});

test("no state chosen: nothing to estimate", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.code, ""); assert.equal(d.method, "unknown"); assert.equal(d.tax, null);
});

test("Texas: no wage tax, nothing to count on Federal", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.equal(d.method, "none"); assert.equal(d.tax, 0); assert.equal(d.federal.saving, 0);
});

test("Illinois: 4.95% of income less $2,850 for each of the three", () => {
  const d = compute(inState("IL"), { today: TODAY });
  assert.equal(d.method, "flat"); assert.equal(d.allowance, 8550);
  near(d.tax, 0.0495 * (AGI - 8550)); near(d.monthly, d.tax / 12); near(d.effective, d.tax / AGI);
  assert.ok(d.local === false);
});

test("the flat rules by hand: standard, per adult, the zero band, federal taxable income", () => {
  const ctx = { joint: true, people: 3, adults: 2, dependents: 1, fed: { deduction: 32200, standard: 32200 } };
  near(flatTax(FLAT.NC, 100000, ctx).tax, 0.0399 * (100000 - 25500));
  near(flatTax(FLAT.NC, 100000, { ...ctx, joint: false }).tax, 0.0399 * (100000 - 12750));
  near(flatTax(FLAT.MA, 100000, ctx).tax, 0.05 * (100000 - 2 * 4400 - 1000));
  near(flatTax(FLAT.OH, 100000, ctx).tax, 0.0275 * (100000 - 26050));
  near(flatTax(FLAT.CO, 100000, ctx).tax, 0.044 * (100000 - 32200));
  near(flatTax(FLAT.IN, 100000, ctx).tax, 0.0295 * (100000 - 3 * 1000 - 1500));
  near(flatTax(FLAT.PA, 100000, ctx).tax, 3070);
  assert.equal(flatTax(FLAT.OH, 20000, ctx).tax, 0, "under the zero band");
});

test("California: graduated, so it waits for last year's return; then the same share of this year's income", () => {
  assert.equal(compute(inState("CA"), { today: TODAY }).method, "unknown");
  const d = compute(inState("CA", { state: { priorTax: 6000, priorAgi: 150000 } }), { today: TODAY });
  assert.equal(d.method, "prior"); near(d.rate, 0.04); near(d.tax, 0.04 * AGI);
});

test("a typed rate beats everything, with its own deduction; last year's return beats the flat rule", () => {
  const typed = compute(inState("TX", { state: { rate: 0.03, deduction: 10000, priorTax: 1, priorAgi: 2 } }), { today: TODAY });
  assert.equal(typed.method, "typed"); near(typed.tax, 0.03 * (AGI - 10000));
  const prior = compute(inState("PA", { state: { priorTax: 4000, priorAgi: 100000 } }), { today: TODAY });
  assert.equal(prior.method, "prior"); near(prior.tax, 0.04 * AGI);
  const ded = compute(inState("PA", { state: { deduction: 5000 } }), { today: TODAY });
  assert.equal(ded.method, "flat"); near(ded.tax, 0.0307 * (AGI - 5000));
});

test("withholding: what is left to pay, or the refund", () => {
  const d = compute(inState("PA", { state: { withheld: 6000 } }), { today: TODAY });
  near(d.balance, d.tax - 6000);
  assert.equal(compute(inState("PA"), { today: TODAY }).balance, null);
});

test("on Federal: nothing while the standard deduction wins; the 22% saving once itemizing wins", () => {
  assert.equal(compute(inState("IL"), { today: TODAY }).federal.saving, 0);
  const p = inState("IL"); p.taxes.itemized = { ...p.taxes.itemized, mortgageInterest: 21000, propertyTax: 7800 };
  const d = compute(p, { today: TODAY });
  assert.ok(d.federal.itemizes);
  near(d.federal.saving, (21000 + 7800 + Math.round(d.tax) - 32200) * 0.22, 1);
  const counted = inState("IL"); counted.taxes.itemized = { ...counted.taxes.itemized, stateTax: Math.round(d.tax) };
  assert.equal(compute(counted, { today: TODAY }).federal.saving, 0, "already counted");
});

test("the same income elsewhere: no-tax states first, the most expensive flat state last", () => {
  const d = compute(inState("IL"), { today: TODAY });
  assert.equal(d.others.length, 9 + Object.keys(FLAT).length);
  assert.deepEqual(d.others.slice(0, 9).map((o) => o.tax), Array(9).fill(0));
  for (let i = 1; i < d.others.length; i++) assert.ok(d.others[i].tax >= d.others[i - 1].tax);
  near(d.others.find((o) => o.code === "IL").tax, d.tax);
});

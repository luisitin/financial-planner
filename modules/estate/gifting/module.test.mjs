import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { tentativeTax, exclusionFor, annualExclusionFor, RATE_SCHEDULE } from "./data/transfer-tax.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-10-30";
const withGifts = (gifts) => { const p = familyPlan(TODAY); p.estate.gifts = gifts; return p; };

test("the federal figures: 2026's exemption and yearly limit, the latest year carried forward", () => {
  assert.equal(exclusionFor(2026), 15000000); assert.equal(exclusionFor(2025), 13990000); assert.equal(exclusionFor(2030), 15000000);
  assert.equal(annualExclusionFor(2026), 19000); assert.equal(annualExclusionFor(2024), 18000); assert.equal(annualExclusionFor(2020), 18000);
});

test("the unified rate schedule (IRC 2001(c)): each bracket's base is the tax on the brackets below", () => {
  for (let i = 1; i < RATE_SCHEDULE.length; i++) { const [lo, base, rate] = RATE_SCHEDULE[i - 1]; assert.equal(Math.round(base + (RATE_SCHEDULE[i][0] - lo) * rate), RATE_SCHEDULE[i][1]); }
  assert.equal(tentativeTax(0), 0); assert.equal(tentativeTax(10000), 1800); assert.equal(tentativeTax(1000000), 345800);
  assert.equal(tentativeTax(15000000), 345800 + 0.4 * 14000000);
});

test("no gifts: the yearly limit and the 529 front-load for a couple", () => {
  const d = compute(familyPlan(TODAY), { today: TODAY });
  assert.equal(d.count, 0); assert.equal(d.couple, true); assert.equal(d.superfund.perGiver, 95000); assert.equal(d.superfund.couple, 190000);
  assert.equal(compute(emptyPlan(), { today: TODAY }).superfund.couple, 95000);
});

test("gifts against the yearly limit: split gifts, a 529 spread over five years, an excess in the first year, the lifetime exemption used", () => {
  const d = compute(withGifts([
    { id: "1", to: "Cy", from: "both", amount: 60000, year: 2026, kind: "529", superfund: true },
    { id: "2", to: "Cy", from: "p-ana", amount: 5000, year: 2027, kind: "cash" },
    { id: "3", to: "Niece", from: "p-bo", amount: 30000, year: 2026, kind: "cash" },
    { id: "4", to: "Cousin", from: "p-ana", amount: 120000, year: 2026, kind: "529", superfund: true },
  ]), { today: TODAY });
  const y = (yr) => d.byYear.find((b) => b.year === yr);
  const row = (yr, to, giver) => y(yr).rows.find((r) => r.to === to && r.giverId === giver);
  assert.equal(row(2026, "Cy", "p-ana").counted, 6000); assert.equal(row(2026, "Cy", "p-bo").counted, 6000);
  assert.equal(row(2027, "Cy", "p-ana").counted, 11000); assert.equal(row(2030, "Cy", "p-bo").counted, 6000);
  assert.equal(row(2026, "Niece", "p-bo").over, 11000);
  // 120,000 from one giver: 95,000 spread (19,000 a year), 25,000 more in the first year
  assert.equal(row(2026, "Cousin", "p-ana").counted, 19000 + 25000); assert.equal(row(2026, "Cousin", "p-ana").over, 25000); assert.equal(row(2028, "Cousin", "p-ana").over, 0);
  assert.equal(d.lifetimeUsed["p-ana"], 25000); assert.equal(d.lifetimeUsed["p-bo"], 11000);
  assert.equal(d.lifetimeLeft["p-ana"], 15000000 - 25000);
  assert.equal(y(2026).needs709, true); assert.equal(y(2028).needs709, false);
  assert.ok(d.warnings.some((w) => w.includes("Cousin's 529")));
});

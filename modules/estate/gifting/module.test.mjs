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
  assert.equal(annualExclusionFor(2026), 19000); assert.equal(annualExclusionFor(2024), 18000);
  // earlier years have their own figures (Rev. Procs. 2010-40 to 2022-38; the Form 706 instructions' table)
  assert.equal(annualExclusionFor(2023), 17000); assert.equal(annualExclusionFor(2020), 15000); assert.equal(annualExclusionFor(2011), 13000);
  assert.equal(exclusionFor(2023), 12920000); assert.equal(exclusionFor(2018), 11180000); assert.equal(exclusionFor(2017), 5490000); assert.equal(exclusionFor(2011), 5000000);
  // $17,500 to one person in 2023 is $500 over that year's $17,000 and needs a return
  const d = compute(withGifts([{ id: "1", to: "Cy", from: "p-ana", amount: 17500, year: 2023, kind: "cash" }]), { today: TODAY });
  assert.equal(d.byYear[0].rows[0].over, 500); assert.equal(d.byYear[0].needs709, true);
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

test("gifts against the yearly limit: a year with a gift from both splits every gift of that year; 529 totals spread over five years", () => {
  const d = compute(withGifts([
    { id: "1", to: "Cy", from: "both", amount: 60000, year: 2026, kind: "529", superfund: true },
    { id: "2", to: "Cy", from: "p-ana", amount: 5000, year: 2027, kind: "cash" },
    { id: "3", to: "Niece", from: "p-bo", amount: 30000, year: 2026, kind: "cash" },
    { id: "4", to: "Cousin", from: "p-ana", amount: 120000, year: 2026, kind: "529", superfund: true },
  ]), { today: TODAY });
  const y = (yr) => d.byYear.find((b) => b.year === yr);
  const row = (yr, to, giver) => y(yr).rows.find((r) => r.to === to && r.giverId === giver);
  // 2026 has a gift from both: the consent covers every gift that year (IRC 2513(a)(2)), so Bo's $30,000 and Ana's $120,000 are halved too
  assert.deepEqual(d.splitYears, [2026]); assert.equal(d.gifts.find((g) => g.id === "3").splitByElection, true);
  assert.equal(row(2026, "Niece", "p-bo").counted, 15000); assert.equal(row(2026, "Niece", "p-ana").counted, 15000); assert.equal(row(2026, "Niece", "p-bo").over, 0);
  // each half of a 529 over the yearly limit is spread: $30,000 -> $6,000 a year; $60,000 -> $12,000 a year, nothing over
  assert.equal(row(2026, "Cy", "p-ana").counted, 6000); assert.equal(row(2030, "Cy", "p-bo").counted, 6000);
  assert.equal(row(2027, "Cy", "p-ana").counted, 11000);   // 2027 is not a split year: Ana's own $5,000 on top of her fifth
  assert.equal(row(2026, "Cousin", "p-ana").counted, 12000); assert.equal(row(2026, "Cousin", "p-bo").counted, 12000);
  assert.equal(d.elections.length, 4); assert.equal(d.lifetimeUsed["p-ana"], 0); assert.equal(d.lifetimeUsed["p-bo"], 0);
  assert.equal(y(2026).needs709, true); assert.equal(y(2028).needs709, false); assert.equal(d.warnings.length, 0);
  assert.ok(d.notes.some((n) => /split half each too/.test(n)));
});

test("without a split: the five-year cap, the excess in the first year, the lifetime exemption used", () => {
  const d = compute(withGifts([
    { id: "3", to: "Niece", from: "p-bo", amount: 30000, year: 2026, kind: "cash" },
    { id: "4", to: "Cousin", from: "p-ana", amount: 120000, year: 2026, kind: "529", superfund: true },
  ]), { today: TODAY });
  const y = (yr) => d.byYear.find((b) => b.year === yr);
  const row = (yr, to, giver) => y(yr).rows.find((r) => r.to === to && r.giverId === giver);
  assert.equal(row(2026, "Niece", "p-bo").over, 11000);
  // 120,000 from one giver: 95,000 spread (19,000 a year), 25,000 more in the first year
  assert.equal(row(2026, "Cousin", "p-ana").counted, 19000 + 25000); assert.equal(row(2026, "Cousin", "p-ana").over, 25000); assert.equal(row(2028, "Cousin", "p-ana").over, 0);
  assert.equal(d.lifetimeUsed["p-ana"], 25000); assert.equal(d.lifetimeUsed["p-bo"], 11000);
  assert.equal(d.lifetimeLeft["p-ana"], 15000000 - 25000);
  assert.equal(y(2026).needs709, true); assert.equal(y(2028).needs709, false);
  assert.ok(d.warnings.some((w) => w.includes("Cousin's 529")));
});

test("529s: one total per giver, child and year; nothing to spread at or under the yearly limit (IRC 529(c)(2)(B))", () => {
  // $15,000 ticked to spread: within $19,000, so it counts in 2026, needs no return, and the page says why
  const small = compute(withGifts([{ id: "1", to: "Cy", from: "p-ana", amount: 15000, year: 2026, kind: "529", superfund: true }]), { today: TODAY });
  assert.equal(small.elections.length, 0); assert.deepEqual(small.byYear.map((b) => b.year), [2026]);
  assert.equal(small.byYear[0].rows[0].counted, 15000); assert.equal(small.byYear[0].needs709, false); assert.ok(small.notes.some((n) => /nothing to spread/.test(n)));
  // $30,000 not ticked and $50,000 ticked to the same child in the same year: one $80,000 total, all spread, $16,000 a year
  const two = compute(withGifts([
    { id: "1", to: "Cy", from: "p-ana", amount: 30000, year: 2026, kind: "529" },
    { id: "2", to: "Cy", from: "p-ana", amount: 50000, year: 2026, kind: "529", superfund: true },
  ]), { today: TODAY });
  assert.equal(two.elections.length, 1); assert.equal(two.elections[0].elected, 80000);
  for (const b of two.byYear) assert.equal(b.rows[0].counted, 16000);
  assert.equal(two.lifetimeUsed["p-ana"], 0);
  // two ticked $95,000 gifts: one cap of $95,000 for the total, the other $95,000 counted in 2026, one warning, one return
  const big = compute(withGifts([
    { id: "1", to: "Cy", from: "p-ana", amount: 95000, year: 2026, kind: "529", superfund: true },
    { id: "2", to: "Cy", from: "p-ana", amount: 95000, year: 2026, kind: "529", superfund: true },
  ]), { today: TODAY });
  assert.equal(big.elections[0].elected, 95000); assert.equal(big.elections[0].excess, 95000);
  assert.equal(big.lifetimeUsed["p-ana"], 95000); assert.equal(big.warnings.length, 1);
  assert.deepEqual(big.byYear.filter((b) => b.needs709).map((b) => b.year), [2026]);
});

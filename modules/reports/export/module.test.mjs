import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, datasetCsv, DATASETS } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";
import { parseCsv, toObjects } from "../../../core/csv.js";

const TODAY = "2026-10-30";

test("every dataset builds on an empty plan and on the family; the counts match", () => {
  const e = compute(emptyPlan(), { today: TODAY });
  assert.equal(e.total, 0);
  const d = compute(familyPlan(), { today: TODAY });
  const n = (id) => d.datasets.find((x) => x.id === id).rows;
  assert.equal(n("accounts"), 10); assert.equal(n("income"), 3); assert.equal(n("expenses"), 13); assert.equal(n("debts"), 3); assert.equal(n("goals"), 4);
  assert.equal(n("retirement-years"), 2085 - 2026 + 1); assert.ok(n("timeline") > 20);
  assert.equal(d.datasets.length, DATASETS.length);
});

test("a CSV reads back with its headers, its rows and its numbers", () => {
  const csv = datasetCsv(familyPlan(), "debts", TODAY);
  assert.ok(csv.endsWith("\r\n"));
  const rows = toObjects(parseCsv(csv));
  const visa = rows.find((r) => r.name === "Visa card");
  assert.equal(visa.rate_pct, "23.9"); assert.equal(visa.owed, "6400"); assert.equal(visa.payment, "400");
  const acc = toObjects(parseCsv(datasetCsv(familyPlan(), "accounts", TODAY)));
  assert.equal(acc.find((a) => a.name === "Ana's 401(k)").owner, "Ana");
  assert.equal(acc.find((a) => a.name === "House").owner, "household");
});

test("text with commas and quotes is quoted; an unknown dataset throws", () => {
  const p = familyPlan(); p.expenses.push({ id: "x", name: 'Gifts, "big" ones', category: "gifts", amount: 100, period: "monthly", essential: false });
  const csv = datasetCsv(p, "expenses", TODAY);
  assert.ok(csv.includes('"Gifts, ""big"" ones"'));
  assert.equal(toObjects(parseCsv(csv)).some((r) => r.name === 'Gifts, "big" ones'), true);
  assert.throws(() => datasetCsv(p, "nope", TODAY));
});

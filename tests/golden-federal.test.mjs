// tests/golden-federal.test.mjs -- the federal tax engine against 12,000 invented returns whose
// expected results were worked independently from the IRS figures in tests/golden/taxes/RULES.md
// (Rev. Procs. 2023-34, 2024-40, 2025-32 and the July 2025 law), never from this repo's code.
// Each CSV row is mapped the way the Federal estimate page feeds the engine: gains netted by
// netGains, itemized deductions capped by itemizedTotal, then federalTax. Every result must be
// within $1 (marginal rate within 0.001, i.e. $1 on the extra $1,000). Rows where the engine is
// known to disagree with the law are listed in TODO below and run as { todo } tests.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseCsv, toObjects } from "../core/csv.js";
import { FEDERAL } from "../modules/taxes/federal/data/federal.js";
import { federalTax } from "../core/math/tax.js";
import { netGains, itemizedTotal } from "../modules/taxes/federal/compute.js";

const YEARS = [2024, 2025, 2026];

// Where the engine and the law part ways (worked examples in tests/golden/taxes/RULES.md, "Known
// disagreements"). The case ids for each cause are in golden/taxes/federal-todo.json; a row can have
// more than one cause. When a cause is fixed, delete its list and those rows must then pass.
const REASONS = {};   // cause -> plain-words reason; all seven causes found by the key were fixed on 2026-10-30 (F-029)
const TODO = {};   // case_id -> reason
const todoLists = JSON.parse(fs.readFileSync(new URL("./golden/taxes/federal-todo.json", import.meta.url), "utf8"));
for (const [cause, ids] of Object.entries(todoLists)) for (const id of ids) TODO[id] = TODO[id] ? `${TODO[id]}; ${REASONS[cause]}` : REASONS[cause];

const num = (v) => Number(v) || 0;

/** One CSV row -> the engine's result plus the marginal rate on the next 1,000 of IRA withdrawals. */
function engine(row, params, extraIra = 0) {
  const status = row.filing_status, joint = status === "married_joint";
  const gains = netGains([
    { proceeds: num(row.st_gain), basis: 0, held: "short" },
    { proceeds: num(row.lt_gain), basis: 0, held: "long" },
  ], status);
  const capital = gains.netShort + gains.netLong + gains.lossAllowed;   // Form 1040 line 7
  const interest = num(row.interest), dividends = num(row.ordinary_dividends), qualifiedDividends = num(row.qualified_dividends);
  const base = {
    filingStatus: status,
    wages: num(row.wages),
    otherOrdinary: Math.max(0, interest + dividends - qualifiedDividends + num(row.pensions) + num(row.ira_distributions) + extraIra + gains.netShort),
    qualifiedIncome: qualifiedDividends + gains.netLong,
    capitalLoss: gains.lossAllowed,                                  // Schedule D line 21: off any income
    charitableCash: num(row.charity),                                // the 2026 deduction for people who do not itemize
    socialSecurity: num(row.social_security),
    ages65plus: (num(row.age_1) >= 65 ? 1 : 0) + (joint && num(row.age_2) >= 65 ? 1 : 0),
    blind: num(row.blind_1) + (joint ? num(row.blind_2) : 0),
    dependentsUnder17: num(row.kids_under_17),
    otherDependents: num(row.other_dependents),
    investmentIncome: Math.max(0, interest + dividends + capital),   // Form 8960 lines 1, 2, 5a
  };
  const agi = federalTax({ ...base, itemized: 0 }, params).agi;
  const itemized = itemizedTotal({ stateTax: num(row.salt_paid), mortgageInterest: num(row.mortgage_interest), charitable: num(row.charity) }, agi, status, params).total;
  return federalTax({ ...base, itemized }, params);
}

function actual(row, params) {
  const r = engine(row, params);
  const next = engine(row, params, 1000);
  return {
    agi: r.agi,
    taxable_social_security: r.income.taxableSocialSecurity,
    deduction: r.deduction.amount,
    taxable_income: r.taxableIncome,
    ordinary_tax: r.ordinaryTax,
    capital_gains_tax: r.qualifiedTax,
    credits: r.credits.childTaxCredit + r.credits.refundable,
    niit: r.niit,
    additional_medicare: r.additionalMedicare,
    total_tax: r.totalTax,
    marginal_rate: (next.totalTax - r.totalTax) / 1000,
  };
}

function mismatches(row, params) {
  const got = actual(row, params), out = [];
  for (const [key, value] of Object.entries(got)) {
    const want = Number(row[key]), tol = key === "marginal_rate" ? 0.001 : 1;
    if (!(Math.abs(value - want) <= tol)) out.push(`${key}: engine ${value.toFixed(2)}, key ${row[key]}`);
  }
  return out;
}

for (const year of YEARS) {
  const file = new URL(`./golden/taxes/federal-${year}.csv`, import.meta.url);
  const rows = toObjects(parseCsv(fs.readFileSync(file, "utf8")));
  // the key works separate returns as spouses who lived apart all year (RULES.md section 6), which takes the single
  // Social Security figures; the tables hold the living-together zero (IRC 86(c)(1)(C)(ii)), checked in tests/tax.test.mjs
  const params = { ...FEDERAL[year], ssTaxation: { ...FEDERAL[year].ssTaxation, married_separate: FEDERAL[year].ssTaxation.single } };

  test(`golden federal ${year}: the file holds 4,000 cases`, () => {
    assert.equal(rows.length, 4000);
    assert.equal(new Set(rows.map((r) => r.case_id)).size, 4000);
  });

  // the rows the engine gets right, one test per filing status and income band
  const shards = new Map();
  for (const row of rows) {
    if (TODO[row.case_id]) continue;
    const shard = row.case_id.split("-").slice(0, 3).join("-");
    if (!shards.has(shard)) shards.set(shard, []);
    shards.get(shard).push(row);
  }
  for (const [shard, list] of shards) {
    test(`golden federal ${shard}: ${list.length} cases within $1`, () => {
      const failed = [];
      for (const row of list) { const m = mismatches(row, params); if (m.length) failed.push(`${row.case_id} ${m.join("; ")}`); }
      assert.deepEqual(failed, []);
    });
  }

  // the rows where the engine and the law part ways: kept, reported, not yet fixed
  for (const row of rows) {
    const reason = TODO[row.case_id];
    if (!reason) continue;
    test(`golden federal ${row.case_id}`, { todo: reason }, () => {
      assert.deepEqual(mismatches(row, params), []);
    });
  }
}

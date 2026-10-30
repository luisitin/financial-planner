// tests/golden-career.test.mjs -- career/equity's alternative minimum tax, the room before it, and purchase-plan sales,
// against an answer key worked independently from the IRS rules (tools/golden_career, tests/golden/career/RULES.md),
// never from this repo's code. Each AMT row is fed to the engine the way career/equity does: the household's federal
// inputs (wages, qualified dividends, itemized deductions with their state and local taxes), the spread as the
// preference. Money must agree within $1. The key's room is the largest whole-dollar spread that leaves the AMT at
// exactly 0; the engine must give 0 there and more than 0 a dollar later. The page's room counts an AMT under 50 cents
// as none (a return rounds to the dollar), so it sits past the key's by up to 50 cents over the slowest rate the AMT
// can rise at (15%, while the spread only moves dividends out of the 0% band) plus the key's and the search's dollar.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseCsv, toObjects } from "../core/csv.js";
import { FEDERAL } from "../modules/taxes/federal/data/federal.js";
import { paramsFor, federalTax } from "../core/math/tax.js";
import { amt, amtRoom, esppSale } from "../modules/career/equity/compute.js";
import { amtFor } from "../modules/career/equity/data/amt.js";

const read = (name) => toObjects(parseCsv(fs.readFileSync(new URL(`./golden/career/${name}`, import.meta.url), "utf8")));
const num = (v) => Number(v) || 0;
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: app ${a} vs key ${b}`);

const amtRows = read("amt.csv");
test(`the answer key has AMT rows (${amtRows.length})`, () => assert.ok(amtRows.length >= 1000));
for (const row of amtRows) {
  test(`AMT ${row.case_id}`, () => {
    const year = num(row.year), P = paramsFor(FEDERAL, year);
    const itemized = num(row.itemized_salt) + num(row.itemized_other);
    const inputs = { filingStatus: row.filing_status, wages: num(row.wages), qualifiedIncome: num(row.qualified_dividends), itemized, investmentIncome: 0 };
    const r = federalTax(inputs, P);
    near(r.taxableIncome, num(row.taxable_income), 1, "taxable income");
    near(r.incomeTax, num(row.regular_tax), 1, "regular tax");
    const a = amt(inputs, P, amtFor(year), { preference: num(row.iso_spread), salt: num(row.itemized_salt) });
    near(a.amti, num(row.amti), 1, "AMT income");
    near(a.exemption, num(row.exemption), 1, "exemption");
    near(a.tentative, num(row.tentative_min_tax), 1, "tentative minimum tax");
    near(a.amt, num(row.amt), 1, "AMT");
    const keyRoom = num(row.room), opts = { salt: num(row.itemized_salt) };
    assert.ok(amt(inputs, P, amtFor(year), { ...opts, preference: keyRoom }).amt < 0.005, "no AMT at the key's room");
    assert.ok(amt(inputs, P, amtFor(year), { ...opts, preference: keyRoom + 1 }).amt > 0, "some AMT a dollar past it");
    const room = amtRoom(inputs, P, amtFor(year), opts);
    assert.ok(room >= keyRoom && room <= keyRoom + 0.5 / 0.15 + 1, `room: app ${room} vs key ${keyRoom}`);
  });
}

const esppRows = read("espp.csv");
test(`the answer key has purchase-plan rows (${esppRows.length})`, () => assert.ok(esppRows.length >= 500));
for (const row of esppRows) {
  test(`purchase-plan sale ${row.case_id}`, () => {
    const lot = { offeringDate: row.offering_date, purchaseDate: row.purchase_date, shares: num(row.shares), fmvOffering: num(row.fmv_offering), fmvPurchase: num(row.fmv_purchase), price: num(row.price_paid), discount: 0.15 };
    const s = esppSale(lot, num(row.sale_price), row.sale_date);
    assert.equal(s.qualifying, row.qualifying === "true", "qualifying");
    near(s.ordinary, num(row.ordinary_income), 0.01, "pay");
    near(s.shortGain, num(row.short_gain), 0.01, "short-term gain");
    near(s.longGain, num(row.long_gain), 0.01, "long-term gain");
  });
}

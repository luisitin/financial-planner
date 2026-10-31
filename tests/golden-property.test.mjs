// tests/golden-property.test.mjs -- the Rental analysis page (property/rental: depreciation, lossAllowance, analyse, compute)
// and the Home page (property/home: compute) against an answer key worked independently from the law (tools/golden_property,
// tests/golden/property/RULES.md), never from this repo's code. The key works each row twice in exact fractions and rounds
// once when written: money to the cent and rates and ratios to six decimals, half away from zero. The pages work in
// floating point, so every amount is compared within a cent and every rate within half a unit of the sixth decimal (5e-7);
// months, counts and the number of rentals are compared exactly. The law columns are compared within $1.
//
// depreciation.csv: depreciation(basis, placed_in_service, tax_year), the page's own function, one building per row.
// rentals.csv: each row is one plan, emptyPlan() with one adult (self) born 1980-01-01 (under 65 in both years),
// household.filingStatus, no state (household.state "": the state page has no figure, so the page's state share is 0),
// taxes.year = tax_year, taxes.thisYear.wages = wages (typed W-2 wages, the only income), taxes.livedApart when the key gives
// lived_apart_all_year, and one property entry { kind: "rental" } per rental in the key's order with its typed fields
// (purchaseDate = the key's month, day 01; loanBalance, loanRate, loanPayment typed; a blank stays blank, null). Then
// compute(plan, { today }).
// homes.csv: each row is one plan, the same household, with a property account "home" (balance = value), a mortgage account
// "mtg" (balance = loan_balance) with its detail in plan.debts (rate, minPayment = loan_payment, extra 0) when the key has a
// loan (the mortgage page reads it), and one property entry { kind: "home", accountId: "home" } with purchasePrice,
// purchaseDate, improvements, sellCosts = sell_share, propertyTax, insurance, hoaMonthly, maintenance, appreciation. Then
// compute(plan, { today }).
//
// What is compared, by part (each row is one test per part):
//   depreciation.csv depreciation  the year's amount against depreciation_page; the running total (the function summed from
//                               the year placed in service) against cumulative_page and the basis left, unrecovered_page
//   rentals.csv  rental     per rental in the key's order: rent, vacancy, income, opex, noi, cap_rate, debt_service,
//                           interest, principal, cash_flow, cash_on_cash, dscr, break_even, one_percent, equity, growth,
//                           total_return, return_on_equity (a blank key value is the page's null); the number of rentals;
//                           totals.cashFlow against cash_flow_total
//                rentaltax  the page's taxable result, per rental: basis, depreciation, taxable; the federal marginal rate
//                           (+ the state share, 0 here) against marginal_rate
//                rentlaw    what the page says will happen this year, against the law (within $1): each rental's loss that
//                           counts this year (lossUsable) against the law's allowed_loss and the part that "waits"
//                           (lossCarried) against suspended_loss (Form 8582); lossRoom against law_allowance (line 8); the
//                           netting (passive: profits less losses, netLoss, againstOther, allowed, suspended, net) against
//                           law_net_passive ... law_allowed_net; tax.niit against law_niit_change; the sum of the tax lines
//                           against law_tax_change (federal tax with the allowed net result less without, the 3.8% included)
//                           and totals.afterTax against law_after_tax_total
//   homes.csv    home       equity, ltv (none at value 0), the whole months owned (bought.years x 12) against months_owned
//                           (M1), bought.growth against growth_since_bought (none under 12 months)
//                upkeep     the year's cost lines (property tax, insurance, dues, upkeep, mortgage interest; a line the page
//                           leaves out is 0) and costs.total against costs_year
//                sale       sale.costs, basis and gain against sell_costs, basis, gain
//                ahead      the values in 5, 10 and 20 years against value_5y, value_10y, value_20y
//                homelaw    what the page says selling today leaves, against the law: the days owned, full months, the
//                           2-of-5-year test, the first long-term day and the term exactly; within $1 the exclusion (the cap
//                           against law_exclusion_max, the part of the gain excluded against law_exclusion), sale.taxable
//                           against law_taxable_gain, its income tax and 3.8% parts against law_income_tax and law_niit,
//                           sale.tax against law_tax, sale.net against law_keep
// Reported only (no pass or fail; the page has no such figure, follows another lawful method, or does not show the figure as
// what will happen), as counts: of rows where the page's figure differs from the law's by more than $1, or where the app
// equals one of the key's convention columns:
//   - depreciation.csv and rentals.csv: P946 Table A-6 (depreciation_law_table_a6, depreciation_table_a6) against the page's
//     formula (both are lawful: P946 allows figuring it without the table);
//   - rentals.csv: the brief's old page method (rental_results loss_usable, loss_carried, tax_line, after_tax; page_loss_room
//     and the page totals), which no longer describes the page, against the page: how far the 2026-10-31 fixes moved it;
//   - homes.csv: the key's other readings of "whole months" (M2, M3) against the app; the old page method's exclusion,
//     taxable gain, tax and keep against the page; the page's taxable income (convention H6) against the federal estimate;
//     page_rate where nothing is taxed; 121(c)'s reduced exclusion (a contrast: the page applies it only when the sale's
//     reason is ticked, which the key's households never do).
// Not compared (the page has no such figure): depreciation.csv recovery_year, year_is, months_counted, note; rentals.csv
// rental_law allowed_result (the page's taxable and lossUsable give it), rental_depreciation recovery_year and
// placed_this_year, rental_loan, law_net_passive, law_passive_activity_loss, law_allowed_against_wages, law_allowed_net,
// law_tax_without, law_tax_with, law_minus_page, ratio_law_to_page, note; homes.csv loan_payments_made, page_taxable_income
// (reported), law_tax_without, law_minus_page_tax and the reduced_* columns (reported), note.
//
// On 2026-10-31 the first run found every page-convention figure in agreement (depreciation, rental, rentaltax, home,
// upkeep, sale, ahead: every row), so the brief's open conventions hold on the pages (whole months M1, the page's taxable
// income H6, return on equity blank at equity 0 or less E1, a blank cost 0, a blank share the default). The law parts
// differed by nine causes, each checked against the sources and proved with a copy of the page's code with one switch per
// cause: on the Rental page (1,433 of 2,000 rows) no passive netting across rentals (469(d)(1)), the allowance used in the
// order typed instead of pro rata (469(j)(4)), the allowance for a couple filing separately who lived together (none:
// 469(i)(5)(B)), the tax at one marginal rate instead of the federal estimate's tax with the rentals less without, and no
// 3.8% on net rent (1411); on the Home page (881 of 1,500 rows) no 2-of-5-year test (121(a), 1.121-1(c)(1)), a short-term
// gain at 15% or 20% instead of like pay (1222), one flat 15% or 20% with 2025's single and joint lines instead of the year's
// own 0/15/20% bands for the status (1(h)), and the 3.8% on the whole gain instead of on the lesser of the gain and the income
// over the line (1411(a)(1); 125,000 filing separately). All nine were fixed the same day; every row of every part agrees.
// The comparisons with the brief's page columns that the fixes moved off (rentaltax's losses, tax lines and totals; sale's
// exclusion, taxable gain, rate, tax and keep) are now counts in the reported tests, and the law parts compare the pages'
// in-between figures too (the netting, the allowance, the 3.8%; the days, months, test, term and exclusion).
//
// Should the page and the key part ways again, list the case ids by cause in golden/property/todo.json ("<part>-<why>") with
// a reason in WHY that starts with the verdict ("app wrong", "simplification" or "convention"); they then run as { todo }
// tests. Delete a cause's list when it is fixed.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseCsv, toObjects } from "../core/csv.js";
import { emptyPlan } from "../core/schema/migrate.js";
import { compute as rentalPage, depreciation } from "../modules/property/rental/compute.js";
import { compute as homePage } from "../modules/property/home/compute.js";
import { compute as federalPage } from "../modules/taxes/federal/compute.js";

const read = (name) => fs.readFileSync(new URL(`./golden/property/${name}`, import.meta.url), "utf8");
const csv = (name) => toObjects(parseCsv(read(name)));
const num = (v) => Number(v) || 0;
const show = (x) => x === null || x === undefined ? "none" : typeof x !== "number" ? String(x) : Number.isInteger(x) ? String(x) : String(Number(x.toFixed(6)));
const yes = (v) => v === "yes";
const blank = (v) => v === "" || v === undefined;
/** A typed input: blank stays blank (null, the page's default applies), anything else is a number. */
const typedOrNull = (v) => (blank(v) ? null : Number(v));
const CENT = 0.01, RATE = 5e-7, LAW = 1, EPS = 1e-9;
/** A key list field: items joined by ";", fields by "|". */
const items = (v) => (blank(v) ? [] : v.split(";").map((s) => s.split("|")));
const sum = (xs, f) => xs.reduce((s, x) => s + (f(x) ?? 0), 0);

const SETS = {
  "depreciation.csv": ["depreciation"],
  "rentals.csv": ["rental", "rentaltax", "rentlaw"],
  "homes.csv": ["home", "upkeep", "sale", "ahead", "homelaw"],
};
const PART_OF = Object.fromEntries(Object.entries(SETS).flatMap(([f, parts]) => parts.map((p) => [p, f])));
const idOf = (f, row) => row.case_id;

// Where the page and the key part ways (tests/golden/property/RULES.md sections 5, 7 and 8, tools/golden_property/README.md
// open points). A cause is "<part>-<why>"; the reason is the why's.
const WHY = {};   // every cause found on 2026-10-31 is fixed (see the header)
const reasonOf = (cause) => WHY[cause.slice(cause.indexOf("-") + 1)];
const todoLists = JSON.parse(read("todo.json"));
const TODO = {};   // "<id> <part>" -> reason
for (const [cause, ids] of Object.entries(todoLists)) {
  const part = cause.split("-")[0];
  for (const id of ids) { const k = `${id} ${part}`, why = `${cause}: ${reasonOf(cause)}`; TODO[k] = TODO[k] ? `${TODO[k]}; ${why}` : why; }
}

// --- comparing one figure ---------------------------------------------------------------------------------------
function near(out, label, got, want, tol = CENT) {
  if (!(typeof got === "number" && Math.abs(got - num(want)) <= tol + EPS)) out.push(`${label}: app ${show(got)}, key ${blank(want) ? "none" : want}`);
}
/** A figure the key leaves blank where it does not apply: the page must have none there. */
function opt(out, label, got, want, tol = CENT) {
  if (blank(want)) { if (got !== null && got !== undefined) out.push(`${label}: app ${show(got)}, key none`); }
  else near(out, label, got, want, tol);
}
function same(out, label, got, want) {
  if (got !== want) out.push(`${label}: app ${show(got)}, key ${want === "" || want === null || want === undefined ? "none" : show(want)}`);
}

// --- depreciation.csv ---------------------------------------------------------------------------------------------
const placedOf = (row) => `${row.placed_in_service}-01`;
function runningTotal(basis, placed, year) {
  let total = 0;
  for (let y = Number(placed.slice(0, 4)); y <= year; y++) total += depreciation(basis, placed, y);
  return total;
}
function depreciationMismatches(row, part) {
  const out = [];
  if (part === "depreciation") {
    const basis = num(row.basis), placed = placedOf(row), year = num(row.tax_year);
    near(out, "depreciation_page", depreciation(basis, placed, year), row.depreciation_page);
    const total = runningTotal(basis, placed, year);
    near(out, "cumulative_page", total, row.cumulative_page);
    near(out, "unrecovered_page", basis - total, row.unrecovered_page);
  }
  return out;
}

// --- rentals.csv --------------------------------------------------------------------------------------------------
const RENTAL_FIELDS = ["purchase_price", "purchase_date", "land_share", "improvements", "value", "rent_monthly", "vacancy", "property_tax", "insurance", "hoa_monthly", "maintenance", "management", "utilities_monthly", "other_monthly", "loan_balance", "loan_rate", "loan_payment", "cash_in", "appreciation"];
const RESULT_FIELDS = ["rent", "vacancy", "income", "opex", "noi", "cap_rate", "debt_service", "interest", "principal", "cash_flow", "cash_on_cash", "dscr", "break_even", "one_percent", "basis", "depreciation", "taxable", "loss_usable", "loss_carried", "tax_line", "after_tax", "equity", "growth", "total_return", "return_on_equity"];
const fieldsOf = (names) => (f) => Object.fromEntries(names.map((k, i) => [k, f[i] ?? ""]));
const rentalsOf = (row) => items(row.rentals).map(fieldsOf(RENTAL_FIELDS));
const resultsOf = (row) => items(row.rental_results).map(fieldsOf(RESULT_FIELDS));
const lawOf = (row) => items(row.rental_law).map(fieldsOf(["allowed_loss", "suspended_loss", "allowed_result"]));
const tableOf = (row) => items(row.rental_depreciation).map(fieldsOf(["recovery_year", "depreciation_table_a6", "table_minus_page", "placed_this_year"]));

/** The household both pages start from: one adult under 65, typed wages, no state. */
function household(row) {
  const p = emptyPlan();
  p.household.people = [{ id: "a1", name: "Adult 1", role: "self", birthDate: "1980-01-01" }];
  p.household.filingStatus = row.filing_status;
  p.household.state = "";
  p.taxes.year = num(row.tax_year);
  p.taxes.thisYear.wages = num(row.wages);
  if (!blank(row.lived_apart_all_year)) p.taxes.livedApart = yes(row.lived_apart_all_year);
  return p;
}
/** The row as a plan for the Rental analysis page. */
function rentalPlan(row) {
  const p = household(row);
  p.property = rentalsOf(row).map((x, i) => ({
    id: `r${i}`, kind: "rental", name: `Rental ${i + 1}`,
    value: typedOrNull(x.value), purchasePrice: typedOrNull(x.purchase_price), purchaseDate: `${x.purchase_date}-01`,
    landShare: typedOrNull(x.land_share), improvements: typedOrNull(x.improvements), rentMonthly: typedOrNull(x.rent_monthly),
    vacancy: typedOrNull(x.vacancy), propertyTax: typedOrNull(x.property_tax), insurance: typedOrNull(x.insurance),
    hoaMonthly: typedOrNull(x.hoa_monthly), maintenance: typedOrNull(x.maintenance), management: typedOrNull(x.management),
    utilitiesMonthly: typedOrNull(x.utilities_monthly), otherMonthly: typedOrNull(x.other_monthly), cashIn: typedOrNull(x.cash_in),
    loanBalance: typedOrNull(x.loan_balance), loanRate: typedOrNull(x.loan_rate), loanPayment: typedOrNull(x.loan_payment),
    appreciation: typedOrNull(x.appreciation),
  }));
  return p;
}
const rentalCache = new Map();
const rentalOf = (row) => { if (!rentalCache.has(row.case_id)) rentalCache.set(row.case_id, rentalPage(rentalPlan(row), { today: row.today })); return rentalCache.get(row.case_id); };

function rentalMismatches(row, part) {
  const out = [], d = rentalOf(row), want = resultsOf(row), app = d.rentals ?? [];
  if (part === "rental") {
    same(out, "ready", d.ready, true);
    same(out, "rentals", app.length, want.length);
    want.forEach((w, i) => {
      const r = app[i], L = `rental ${i + 1}`;
      if (!r) return;
      near(out, `${L} rent`, r.rent, w.rent);
      near(out, `${L} vacancy`, r.vacancy, w.vacancy);
      near(out, `${L} income`, r.income, w.income);
      near(out, `${L} opex`, r.opex, w.opex);
      near(out, `${L} noi`, r.noi, w.noi);
      opt(out, `${L} cap_rate`, r.capRate, w.cap_rate, RATE);
      near(out, `${L} debt_service`, r.debtService, w.debt_service);
      near(out, `${L} interest`, r.interest, w.interest);
      near(out, `${L} principal`, r.principal, w.principal);
      near(out, `${L} cash_flow`, r.cashFlow, w.cash_flow);
      opt(out, `${L} cash_on_cash`, r.cashOnCash, w.cash_on_cash, RATE);
      opt(out, `${L} dscr`, r.dscr, w.dscr, RATE);
      opt(out, `${L} break_even`, r.breakEven, w.break_even, RATE);
      opt(out, `${L} one_percent`, r.onePercent, w.one_percent, RATE);
      near(out, `${L} equity`, r.equity, w.equity);
      near(out, `${L} growth`, r.growth, w.growth);
      near(out, `${L} total_return`, r.totalReturn, w.total_return);
      opt(out, `${L} return_on_equity`, r.returnOnEquity, w.return_on_equity, RATE);
    });
    near(out, "cash_flow_total", d.totals?.cashFlow, row.cash_flow_total);
  }
  if (part === "rentaltax") {
    want.forEach((w, i) => {
      const r = app[i], L = `rental ${i + 1}`;
      if (!r) return;
      near(out, `${L} basis`, r.basis, w.basis);
      near(out, `${L} depreciation`, r.depreciation, w.depreciation);
      near(out, `${L} taxable`, r.taxable, w.taxable);
    });
    near(out, "marginal_rate (federal marginal + state share)", d.rates ? d.rates.marginal + d.rates.state : null, row.marginal_rate, RATE);
  }
  if (part === "rentlaw") {
    lawOf(row).forEach((w, i) => {
      const r = app[i], L = `rental ${i + 1}`;
      if (!r) return;
      near(out, `${L} loss lowering other tax this year (lossUsable) against allowed_loss`, r.lossUsable, w.allowed_loss, LAW);
      near(out, `${L} loss waiting (lossCarried) against suspended_loss`, r.lossCarried, w.suspended_loss, LAW);
    });
    near(out, "loss room (the allowance) against law_allowance", d.lossRoom, row.law_allowance, LAW);
    const P = d.passive ?? {};
    near(out, "passive.profits - passive.losses against law_net_passive", (P.profits ?? 0) - (P.losses ?? 0), row.law_net_passive, LAW);
    near(out, "passive.netLoss against law_passive_activity_loss", P.netLoss, row.law_passive_activity_loss, LAW);
    near(out, "passive.againstOther against law_allowed_against_wages", P.againstOther, row.law_allowed_against_wages, LAW);
    near(out, "passive.allowed against law_loss_allowed_total", P.allowed, row.law_loss_allowed_total, LAW);
    near(out, "passive.suspended against law_suspended_total", P.suspended, row.law_suspended_total, LAW);
    near(out, "passive.net against law_allowed_net", P.net, row.law_allowed_net, LAW);
    near(out, "tax.niit against law_niit_change", d.tax?.niit, row.law_niit_change, LAW);
    near(out, "tax lines against law_tax_change", sum(app, (r) => r.tax), row.law_tax_change, LAW);
    near(out, "after tax against law_after_tax_total", d.totals?.afterTax, row.law_after_tax_total, LAW);
  }
  return out;
}

// --- homes.csv ----------------------------------------------------------------------------------------------------
/** The row as a plan for the Home page: a property account, a mortgage account with its detail, the home's details. */
function homePlan(row) {
  const p = household(row);
  p.accounts = [{ id: "home", name: "Home", type: "property", balance: num(row.value) }];
  if (!blank(row.loan_balance)) {
    p.accounts.push({ id: "mtg", name: "Mortgage", type: "mortgage", balance: num(row.loan_balance) });
    p.debts = [{ id: "d1", accountId: "mtg", rate: num(row.loan_rate), minPayment: num(row.loan_payment), extra: 0 }];
  }
  p.property = [{
    id: "h1", kind: "home", accountId: "home", name: "Home",
    purchasePrice: typedOrNull(row.purchase_price), purchaseDate: row.purchase_date, improvements: typedOrNull(row.improvements),
    sellCosts: typedOrNull(row.sell_share), propertyTax: typedOrNull(row.property_tax), insurance: typedOrNull(row.insurance),
    hoaMonthly: typedOrNull(row.hoa_monthly), maintenance: typedOrNull(row.maintenance), appreciation: typedOrNull(row.appreciation),
  }];
  return p;
}
const homeCache = new Map();
const homeOf = (row) => { if (!homeCache.has(row.case_id)) homeCache.set(row.case_id, homePage(homePlan(row), { today: row.today })); return homeCache.get(row.case_id); };
const monthsOf = (d) => (d.bought && d.bought.years !== null ? Math.round(d.bought.years * 12) : null);
const COST_LINES = [["tax", "cost_property_tax"], ["insurance", "cost_insurance"], ["hoa", "cost_hoa"], ["maintenance", "cost_maintenance"], ["interest", "cost_interest"]];

function homeMismatches(row, part) {
  const out = [], d = homeOf(row);
  if (!d.ready) return ["ready: app false, key true"];
  if (part === "home") {
    near(out, "equity", d.equity, row.equity);
    opt(out, "ltv", d.ltv, row.ltv, RATE);
    same(out, "months_owned (bought.years x 12)", monthsOf(d), num(row.months_owned));
    opt(out, "growth_since_bought", d.bought?.growth ?? null, row.growth_since_bought, RATE);
  }
  if (part === "upkeep") {
    for (const [key, col] of COST_LINES) near(out, col, d.costs.lines.find((l) => l.key === key)?.amount ?? 0, row[col]);
    near(out, "costs_year", d.costs.total, row.costs_year);
  }
  if (part === "sale") {
    const s = d.sale;
    near(out, "sell_costs", s.costs, row.sell_costs);
    near(out, "basis", s.basis, row.basis);
    near(out, "gain", s.gain, row.gain);
  }
  if (part === "ahead") {
    for (const [i, col] of [[0, "value_5y"], [1, "value_10y"], [2, "value_20y"]]) near(out, col, d.ahead[i]?.value, row[col]);
  }
  if (part === "homelaw") {
    const t = d.sale.test;
    same(out, "days owned against days_owned", t?.days ?? null, num(row.days_owned));
    same(out, "full months against full_months_owned", t?.months ?? null, num(row.full_months_owned));
    same(out, "two-year test against meets_2_of_5", t?.meets ?? null, yes(row.meets_2_of_5));
    same(out, "first long-term day against first_long_day", d.sale.longOn, row.first_long_day);
    same(out, "term against term", d.sale.term, row.term);
    near(out, "exclusion (the most tax-free) against law_exclusion_max", d.sale.exclusion, row.law_exclusion_max, LAW);
    near(out, "excluded (the part of the gain tax-free) against law_exclusion", d.sale.excluded, row.law_exclusion, LAW);
    near(out, "taxable gain against law_taxable_gain", d.sale.taxable, row.law_taxable_gain, LAW);
    near(out, "income tax on the gain against law_income_tax", d.sale.incomeTax, row.law_income_tax, LAW);
    near(out, "3.8% on the gain against law_niit", d.sale.niit, row.law_niit, LAW);
    near(out, "tax on the gain against law_tax", d.sale.tax, row.law_tax, LAW);
    near(out, "you would keep against law_keep", d.sale.net, row.law_keep, LAW);
  }
  return out;
}

const CHECK = { "depreciation.csv": depreciationMismatches, "rentals.csv": rentalMismatches, "homes.csv": homeMismatches };
const SIZE = { "depreciation.csv": 1500, "rentals.csv": 2000, "homes.csv": 1500 };
const ROWS = Object.fromEntries(Object.keys(SETS).map((f) => [f, csv(f)]));

// ---- tests ----
for (const [f, rows] of Object.entries(ROWS)) {
  test(`the answer key has ${SIZE[f].toLocaleString("en-US")} rows in ${f}, each once (${rows.length})`, () => {
    assert.equal(rows.length, SIZE[f]);
    assert.equal(new Set(rows.map((r) => idOf(f, r))).size, SIZE[f]);
  });
}
test("every household row is a tax year the pages work (2025 or 2026), seen on a day of that year, nothing bought after it", () => {
  for (const r of [...ROWS["rentals.csv"], ...ROWS["homes.csv"]]) assert.ok(["2025", "2026"].includes(r.tax_year) && r.today.slice(0, 4) === r.tax_year, r.case_id);
  for (const r of ROWS["rentals.csv"]) for (const x of rentalsOf(r)) assert.ok(x.purchase_date <= r.today.slice(0, 7), `${r.case_id} rental placed in service ${x.purchase_date}`);
  for (const r of ROWS["homes.csv"]) assert.ok(r.purchase_date <= r.today, `${r.case_id} bought ${r.purchase_date}`);
});
test("every to-do cause has a reason and names rows of the key that its part reads", () => {
  for (const [cause, list] of Object.entries(todoLists)) {
    assert.ok(reasonOf(cause), `no reason for ${cause}`);
    const part = cause.split("-")[0], f = PART_OF[part];
    assert.ok(f, `${cause} does not start with a part (${Object.keys(PART_OF).join(", ")})`);
    const ids = new Set(ROWS[f].map((r) => idOf(f, r)));
    assert.deepEqual(list.filter((id) => !ids.has(id)), [], `${cause} names rows ${part} does not read`);
    assert.equal(new Set(list).size, list.length, `${cause} names a row twice`);
  }
});

for (const [f, rows] of Object.entries(ROWS)) {
  for (const row of rows) {
    for (const part of SETS[f]) {
      const id = idOf(f, row), reason = TODO[`${id} ${part}`];
      test(`property ${id} ${part}`, reason ? { todo: reason } : {}, () => {
        assert.deepEqual(CHECK[f](row, part), []);
      });
    }
  }
}

// ---- reported only: another lawful method, a convention, and the law's figures the pages do not show as what will happen ----
const over = (a, b) => Math.abs(a - b) > LAW + EPS;
test("reported: P946 Table A-6 against the page's formula (both lawful), as counts", (t) => {
  let rows = 0, differ = 0, largest = 0, runDiffer = 0, runLargest = 0;
  for (const row of ROWS["depreciation.csv"]) {
    if (blank(row.table_a6_percent) && num(row.depreciation_page) === 0) continue;
    const basis = num(row.basis), placed = placedOf(row), year = num(row.tax_year);
    const page = depreciation(basis, placed, year), table = num(row.depreciation_law_table_a6), run = runningTotal(basis, placed, year);
    rows++;
    if (over(page, table)) differ++;
    largest = Math.max(largest, Math.abs(page - table));
    if (over(run, num(row.cumulative_table_a6))) runDiffer++;
    runLargest = Math.max(runLargest, Math.abs(run - num(row.cumulative_table_a6)));
  }
  let rentals = 0, rentalsDiffer = 0;
  for (const row of ROWS["rentals.csv"]) {
    const app = rentalOf(row).rentals ?? [];
    tableOf(row).forEach((w, i) => { if (!app[i]) return; rentals++; if (over(app[i].depreciation, num(w.depreciation_table_a6))) rentalsDiffer++; });
  }
  assert.ok(rows > 0);
  t.diagnostic(`depreciation.csv: the table's year differs from the page's by more than $1 on ${differ} of ${rows} rows with depreciation (largest $${largest.toFixed(2)}); the running totals on ${runDiffer} (largest $${runLargest.toFixed(2)})`);
  t.diagnostic(`rentals.csv: the table's year differs from the page's by more than $1 on ${rentalsDiffer} of ${rentals} rentals`);
});
test("reported: the brief's old page method against the Rental page now (how far the 2026-10-31 fixes moved it), as counts", (t) => {
  const R = ROWS["rentals.csv"];
  let rentals = 0, usable = 0, carried = 0, line = 0, room = 0, total = 0;
  for (const row of R) {
    const d = rentalOf(row), app = d.rentals ?? [], want = resultsOf(row);
    want.forEach((w, i) => { const r = app[i]; if (!r) return; rentals++; if (over(r.lossUsable, num(w.loss_usable))) usable++; if (over(r.lossCarried, num(w.loss_carried))) carried++; if (over(r.tax, num(w.tax_line))) line++; });
    if (over(d.lossRoom ?? 0, num(row.page_loss_room))) room++;
    if (over(d.totals?.afterTax ?? 0, num(row.page_after_tax_total))) total++;
  }
  t.diagnostic(`of ${rentals} rentals the old method's usable loss differs from the page's by more than $1 on ${usable}, its carried loss on ${carried}, its tax line on ${line}`);
  t.diagnostic(`of ${R.length} rows its loss room differs on ${room} (the couples filing separately who lived together), its after-tax total on ${total}`);
});
test("reported: the Home page against the key's other month counts, the law's dates and rates, H6 and the reduced exclusion, as counts", (t) => {
  const H = ROWS["homes.csv"];
  let m1 = 0, m2 = 0, m3 = 0, g2 = 0, g3 = 0, fullMonths = 0, fails = 0, short = 0, oldExclusion = 0, oldTax = 0, oldKeep = 0, h6 = 0, rateShown = 0, noTax = 0, reduced = 0, failsReduced = 0;
  for (const row of H) {
    const d = homeOf(row), months = monthsOf(d);
    if (months === num(row.months_owned)) m1++;
    if (months === num(row.months_owned_m2)) m2++;
    if (months === num(row.months_owned_m3)) m3++;
    const g = d.bought?.growth ?? null;
    if ((g === null) === blank(row.growth_m2) && (g === null || Math.abs(g - num(row.growth_m2)) <= RATE + EPS)) g2++;
    if ((g === null) === blank(row.growth_m3) && (g === null || Math.abs(g - num(row.growth_m3)) <= RATE + EPS)) g3++;
    if (months !== num(row.full_months_owned)) fullMonths++;
    if (!yes(row.meets_2_of_5)) fails++;
    if (row.term === "short") short++;
    const s = d.sale;
    if (over(s.exclusion, num(row.page_exclusion))) oldExclusion++;
    if (over(s.tax, num(row.page_tax))) oldTax++;
    if (over(s.net, num(row.page_keep))) oldKeep++;
    const fed = federalPage(homePlan(row), { today: row.today });
    if (Math.abs(fed.result.taxableIncome - num(row.page_taxable_income)) <= CENT + EPS) h6++;
    if (!(s.taxable > 0)) { noTax++; if (Math.abs(s.rate - num(row.page_rate)) <= RATE + EPS) rateShown++; }
    if (!yes(row.meets_2_of_5)) { failsReduced++; if (over(s.tax, num(row.reduced_tax))) reduced++; }
  }
  t.diagnostic(`whole months: the app equals M1 (months_owned) on ${m1} of ${H.length} rows, M2 on ${m2}, M3 on ${m3}; its growth equals growth_m2 on ${g2}, growth_m3 on ${g3}`);
  t.diagnostic(`the law's full months (L1) differ from the page's whole months on ${fullMonths} rows; the 2-of-5-year test fails on ${fails}; the term is short on ${short}`);
  t.diagnostic(`the brief's old page method against the page now: its exclusion differs by more than $1 on ${oldExclusion} rows, its tax on ${oldTax}, what you keep on ${oldKeep}`);
  t.diagnostic(`H6: the federal estimate's taxable income equals page_taxable_income (wages less the standard deduction) on ${h6} of ${H.length} rows`);
  t.diagnostic(`where nothing is taxed (${noTax} rows) the page keeps a rate of 0 and shows none; the key's page_rate (15% or more, "shown even when nothing is taxed") equals it on ${rateShown}`);
  t.diagnostic(`121(c) contrast: of the ${failsReduced} rows that fail the 2-of-5-year test, the reduced exclusion (by days) would give another tax than the page's by more than $1 on ${reduced}`);
});

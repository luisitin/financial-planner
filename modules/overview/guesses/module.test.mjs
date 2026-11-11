// modules/overview/guesses/module.test.mjs -- "Our guesses for you" (commits C1 and C2): the bundled tables (sources, shape,
// spot values, derived constants, nothing refused got in), the estimator contract for every key that ships (this
// module's and the setup's), the import rule, the gate (EUR and "outside the U.S." get nothing; a blank state gets the
// national figure), the coverage file and the page's compute. C2: the home and debt answer keys of 7.H (the three walks
// in qa/fixtures/setup-personas.mjs, the arithmetic in comments) and the "Better guesses are ready" card (11.5). The
// plumbing has its own tests in tests/estimate-*.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { compute, estimators, TABLES, LEGACY_WORDS, useNewGuesses, keepOldGuesses, sameLoan, twoLoans } from "./compute.js";
import manifest from "./module.js";
import { T as SPEND, DERIVED as D_SPEND } from "./data/spend.js";
import { T as BAL, DERIVED as D_BAL } from "./data/balances.js";
import { T as PAY, DERIVED as D_PAY } from "./data/pay.js";
import { T as DEBTS, DERIVED as D_DEBTS } from "./data/debts.js";
import { T as HOME, DERIVED as D_HOME } from "./data/home.js";
import { READ_ON, NEWEST_READ, STATES, STATE_NAME, STATE_REGION } from "./data/index.js";
import { COVERAGE, BUILT } from "./coverage.js";
import { prepareImport, importRecord } from "../../transactions/import/compute.js";
import { NEVER as NEVER_BUNDLED, UNVERIFIED, unverifiedProblems } from "../../../tools/guess-data-unverified.mjs";
import { estimators as setupEstimators, oweArgs, askHomeWithMortgage, applyHaveAmounts } from "../setup/compute.js";
import { estimate, mergeEstimators, checkEstimators, markGuess, saveField, applies } from "../../../core/estimate/index.js";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";
import { guessedPlan } from "../../../qa/fixtures/guessed-plan.mjs";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { retiredCouplePlan } from "../../../qa/fixtures/retired-couple-plan.mjs";
import { escrowMonthly } from "./estimators/home.js";
import { jordan, patLee, sam } from "../../../qa/fixtures/setup-personas.mjs";
import { ARCHETYPES, SPECIAL_PACKS } from "../../../qa/households/lib/catalog.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const T0 = "2026-11-02";
const TODAY = new Date().toISOString().slice(0, 10);
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const REG = mergeEstimators([{ from: "overview/guesses", estimators, tables: TABLES }, { from: "overview/setup", estimators: setupEstimators }]);
const OPTS = { estimators: REG.estimators, tables: REG.tables, today: T0 };
const cell = (t, row, col) => t.rows[row]?.[t.cols.indexOf(col)];
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ""}: ${a} vs ${b}`);

// ---- data
test("every bundled table has its source: publisher, https address, vintage and a read date not after today", () => {
  assert.equal(Object.keys(TABLES).length, 69);
  for (const [id, t] of Object.entries(TABLES)) {
    for (const k of ["title", "publisher", "vintage", "readOn", "stat"]) assert.ok(typeof t[k] === "string" && t[k].trim(), `${id}: ${k}`);
    assert.match(t.url, /^https:\/\//, `${id}: url`);
    assert.match(t.readOn, ISO, `${id}: readOn`);
    assert.ok(t.readOn <= TODAY, `${id}: read ${t.readOn}, after today`);
    assert.equal(typeof t.industry, "boolean"); assert.equal(typeof t.derived, "boolean");
    assert.ok(Array.isArray(t.cols) && t.cols.length, `${id}: cols`);
    for (const [row, vals] of Object.entries(t.rows)) {
      assert.equal(vals.length, t.cols.length, `${id}/${row}: one value per column`);
      for (const v of vals) assert.ok(v === null || (typeof v === "number" && Number.isFinite(v)), `${id}/${row}: numbers or null`);
    }
    if (t.by === "state") assert.deepEqual(t.cols, STATES, `${id}: the state columns`);
  }
  assert.equal(NEWEST_READ, Object.values(TABLES).map((t) => t.readOn).sort().pop());
  assert.deepEqual(Object.keys(READ_ON).sort(), ["balances", "cells", "debts", "health", "home", "pay", "purchase", "retire", "spend"]);
  assert.equal(STATES.length, 52); assert.equal(STATES[0], "US");
  assert.equal(Object.keys(STATE_REGION).length, 51, "the 50 states and DC each in a Census region");
  assert.deepEqual([...new Set(Object.values(STATE_REGION))].sort(), ["midwest", "northeast", "south", "west"]);
  assert.deepEqual([STATE_NAME.OH, STATE_NAME.AZ, STATE_NAME.DC], ["Ohio", "Arizona", "District of Columbia"]);
  assert.deepEqual(manifest.guessTables, TABLES, "the manifest carries the tables for the shell's registry");
});

test("spot values match the published tables", () => {
  assert.equal(cell(SPEND.ce2025_spend_by_incomeQuintile, "totalExpenditures", "all"), 81905, "CE all-households spending");
  assert.equal(cell(BAL.vanguard_has2026_401k_balance_by_age, "median", "age:35-44"), 46919, "Vanguard 35-44 median");
  assert.equal(cell(DEBTS.mortgage_outstanding_fhfa_by_state_2026q2, "Average contract interest rate (%)", "OH"), 4.6, "FHFA Ohio");
  assert.equal(cell(DEBTS.mortgage_outstanding_fhfa_by_state_2026q2, "Average contract interest rate (%)", "AZ"), 4.3, "FHFA Arizona");
  assert.equal(cell(HOME.acs2025_median_home_value_by_state, "value", "OH"), 254100, "ACS Ohio home value");
  assert.equal(cell(SPEND.acs2025_median_gross_rent_by_state, "grossRent", "TX"), 1515, "ACS Texas median gross rent");
  assert.equal(cell(SPEND.naic2023_homeowners_premium_by_state, "HO-3", "OH"), 1116, "NAIC Ohio HO-3");
  assert.equal(cell(SPEND.ccaoa2025_childcare_annual_price_by_state, "center:fourYearOld", "OH"), 10552, "CCAoA Ohio four-year-old center");
  assert.equal(DEBTS.cc_apr_fed_g19.rows["Credit card plans, accounts assessed interest (commercial banks)"][0], 22.36);
  assert.equal(DEBTS.mortgage_rate_pmms_weekly_2026.rows["30-year fixed"][0], 7.24);
  assert.equal(DEBTS.student_loan_rates_federal.rows["Direct Subsidized and Unsubsidized, undergraduate"][0], 6.52);
  assert.equal(cell(DEBTS.mortgage_outstanding_fhfa_national, "Average contract interest rate (%)", "by loan count"), 4.4);
});

test("the derived constants recompute from the tables", () => {
  const ten = (k) => cell(SPEND.ce2025_spend_by_housingTenure, k, "renter");
  near(D_SPEND.contractShare.value, ten("rentedDwellings") / (ten("rentedDwellings") + ten("utilities") - ten("telephoneServices")), 0.0005, "contractShare");
  near(D_SPEND.contractShare.value, 0.897, 1e-9, "contractShare as documented");
  const q = SPEND.ce2023_aftertax_income_by_incomeQuintile;
  for (const [c, ratio, before] of D_SPEND.taxRatio2023.value) {
    near(ratio, cell(q, "incomeAfterTaxesMean", c) / cell(q, "incomeBeforeTaxesMean", c), 0.0005, `taxRatio2023 ${c}`);
    assert.equal(before, cell(q, "incomeBeforeTaxesMean", c));
  }
  assert.deepEqual(D_SPEND.taxRatio2023.value.slice(2).map((x) => x[1]), [0.997, 0.937, 0.896, 0.798]);
  const all = (k) => cell(SPEND.ce2025_spend_by_incomeQuintile, k, "all");
  near(D_SPEND.energyShare.value, (all("electricity") + all("naturalGas") + all("fuelOilOtherFuels")) / all("utilities"), 0.0005, "energyShare");
  near(D_SPEND.energyShare.value, 0.523, 1e-9);
  const tr = ["gasolineAndOtherFuels", "vehicleMaintenanceRepairs", "vehicleRentalLeasesLicensesOther", "vehicleInsurance", "publicAndOtherTransportation"].reduce((s, k) => s + all(k), 0);
  near(D_SPEND.vehicleInsShare.value, all("vehicleInsurance") / tr, 0.0005, "vehicleInsShare");
  near(D_SPEND.vehicleInsShare.value, 0.269, 1e-9);
  const f = DEBTS.mortgage_outstanding_fhfa_by_state_2026q2;
  for (const st of ["OH", "AZ", "TX", "CA"]) {
    assert.equal(D_DEBTS.perLoanByState.value[st], Math.round(cell(f, "Unpaid principal balance ($ billions)", st) * 1e9 / (cell(f, "Active first-lien mortgages (thousands)", st) * 1e3)), `perLoan ${st}`);
  }
  assert.deepEqual([D_DEBTS.perLoanByState.value.OH, D_DEBTS.perLoanByState.value.AZ, D_DEBTS.perLoanByState.value.TX], [156814, 250538, 223570]);
  near(D_HOME.upkeepRatio.value, cell(HOME.ahs2023_routine_maintenance_spending, "aggregate maintenance / aggregate home value (percent)", "all owners") / 100, 1e-12, "upkeepRatio");
  near(D_HOME.upkeepRatio.value, 0.00293, 1e-12);
  near(D_BAL.scfMortgageMedianToMean.value, cell(BAL.scf2025_median_value_if_held, "mortgageOnPrimaryResidence", "all:all families") / cell(BAL.scf2025_mean_value_if_held, "mortgageOnPrimaryResidence", "all:all families"), 0.0005, "scfMortgageMedianToMean");
  near(D_BAL.scfMortgageMedianToMean.value, 0.767, 1e-9);
  near(D_PAY.deferralMedianToMean.value, 6.6 / 7.6, 0.0005, "deferralMedianToMean");
  assert.deepEqual(PAY.vanguard_has2026_headline.rows["median participant deferral rate"], [6.6]);
});

test("nothing refused got in: no never-bundled id, and (where the research files are on hand) nothing on an unverified list", (t) => {
  const NEVER = [/^usda_/, /^fanniemae_maintenance_rule_of_thumb$/, /^limra_/, /^acli_/, /^bls_ncs_/];
  for (const id of Object.keys(TABLES)) assert.ok(!NEVER.some((re) => re.test(id)), `${id} is never bundled`);
  const dir = path.join(ROOT, "vendor", "guess-data");
  if (!fs.existsSync(dir)) { t.diagnostic("vendor/guess-data is not on this machine: the unverified-list check runs where it is"); return; }
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".json"))) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const own = new Set((j.tables ?? []).map((x) => x.id));
    for (const u of j.unverified ?? []) {
      const named = [u?.id, ...(Array.isArray(u?.ids) ? u.ids : []), u?.table].filter(Boolean);
      for (const id of Object.keys(TABLES)) if (own.has(id)) assert.ok(!named.includes(id) && !String(u?.what ?? "").includes(id), `${id} is the subject of ${f}'s unverified entry "${String(u.what).slice(0, 80)}"`);
    }
  }
  const r = spawnSync(process.execPath, [path.join(ROOT, "tools", "build-guess-data.mjs"), dir, "--check"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /the files match a fresh build/);
});

// review of C1 (2026-11-06, data 5; spec 6.7): a price-aging step needs the year of each table's dollars. The research's own
// field said "nominal dollars of the row's year" or nothing, so six tables whose year is known had none
test("every table in dollars says the year of its dollars, or where each figure's year is", () => {
  for (const [id, t] of Object.entries(TABLES)) {
    if (!/dollar/i.test(t.unit ?? "")) continue;
    assert.ok(Number.isInteger(t.dollarsOf) || ["row", "col", "cell"].includes(t.dollarsBy), `${id}: dollarsOf ${t.dollarsOf}`);
  }
  const year = (id) => TABLES[id].dollarsOf;
  // the flows spec 6.7 ages with the published CPI, and the other prices fixed to a year
  assert.deepEqual(["naic2023_auto_insurance_by_state", "naic2023_homeowners_premium_by_state", "ahs2023_routine_maintenance_spending", "ndcp2022_childcare_weekly_price_by_state"].map(year), [2023, 2023, 2023, 2022]);
  assert.deepEqual(["acs2025_median_home_value_by_state", "acs2025_median_home_value_by_state_and_mortgage_status", "acs2025_hoa_condo_fee_by_state", "kff_medigap_average_premium_2025"].map(year), [2025, 2025, 2025, 2025]);
  assert.equal(TABLES.ndcp_childcare_weekly_price_fallback_older_years.dollarsBy, "cell", "each older figure carries its own study year");
  assert.ok(Object.keys(TABLES.ndcp_childcare_weekly_price_fallback_older_years.rows).some((k) => k.endsWith(":year")));
});

// review of C1 (2026-11-06, data 7): the sources fold shows each table's publisher, its table, a plain "as of" line and the
// read date, and counts publishers rather than calling 69 tables "sources"; no working notes from the research reach the screen
test("the sources fold's words: organisation, publisher, table and 'as of' in plain words for every table", () => {
  const NOTES = /\bsee\b|sourceRef|file source line|Flourish|Datawrapper|\.(csv|xlsx?|zip|pdf)\b|research step|newest commercial-bank survey|=|\b[A-Z]+_[A-Z_]+\b|^derived$/i;
  for (const [id, t] of Object.entries(TABLES)) {
    for (const k of ["org", "shownBy", "tableShown", "asOf"]) {
      assert.ok(typeof t[k] === "string" && t[k].trim(), `${id}: ${k}`);
      assert.doesNotMatch(t[k], NOTES, `${id}: ${k} "${t[k]}"`);
    }
    assert.ok(t.asOf.length <= 80, `${id}: asOf is one short line`);
  }
  const orgs = new Set(Object.values(TABLES).map((t) => t.org));
  assert.equal(orgs.size, 18, [...orgs].join("; "));
  assert.equal(TABLES.ccaoa2025_childcare_annual_price_by_state.industry, false, "Child Care Aware is a nonprofit, not an industry source");
  const readme = fs.readFileSync(path.join(HERE, "README.md"), "utf8");
  assert.doesNotMatch(readme, /Industry sources[^.]*Child Care Aware/, "the README does not list Child Care Aware among the industry sources");
  assert.match(readme, /Child Care Aware of\s+America is a nonprofit/);
  const d = compute(migrate(emptyPlan()), OPTS);
  assert.equal(d.sources.orgs, orgs.size);
  assert.deepEqual(Object.keys(d.sources.all[0]).sort(), ["asOf", "derived", "id", "industry", "org", "publisher", "readOn", "shownBy", "table", "tableShown", "title", "url", "vintage"]);
});

// review of C1 (2026-11-06, data 2): the research files' unverified entries are prose with no ids, so the build's guard matched
// nothing. Each entry is now mapped by hand (tools/guess-data-unverified.mjs); these cases run on every clone
test("the unverified lists: an unmapped entry, a stale row or a refused table stops the build; approved substitutes pass", () => {
  const bundled = Object.keys(TABLES);
  const file = (unverified, ids = ["cc_apr_fed_g19", "card_balances_apr_cfpb"]) => ({ "debts.json": { tables: ids.map((id) => ({ id })), unverified } });
  const mapped = (what) => UNVERIFIED.filter((r) => r.file === "debts.json").map((r) => ({ what: `${r.what} (as the file says it)` })).concat(what ? [{ what }] : []);
  assert.deepEqual(unverifiedProblems(file(mapped()), bundled), [], "every debts.json entry mapped: nothing to say");
  const unmapped = unverifiedProblems(file(mapped("Credit card interest rate on accounts assessed interest (Fed G.19)")), bundled);
  assert.equal(unmapped.length, 1); assert.match(unmapped[0], /no row in tools\/guess-data-unverified\.mjs/);
  const stale = unverifiedProblems(file(mapped().slice(1)), bundled);
  assert.equal(stale.length, 1); assert.match(stale[0], /matches no unverified entry/);
  // an entry that concerns a bundled table, or names one in its words, refuses it unless it is that entry's approved substitute
  const map = [...UNVERIFIED, { file: "debts.json", what: "Card rate check", concerns: ["cc_apr_fed_g19"], substitutes: [], note: "" }];
  const refused = unverifiedProblems(file([...mapped(), { what: "Card rate check" }]), bundled, map);
  assert.deepEqual(refused, [`cc_apr_fed_g19: refused, the subject of debts.json's unverified entry "Card rate check"`]);
  const byName = unverifiedProblems(file([...mapped(), { what: "Card rate check 2", tried: "kept cc_apr_fed_g19 from a press page" }]), bundled, [...UNVERIFIED, { file: "debts.json", what: "Card rate check 2", concerns: [], substitutes: [], note: "" }]);
  assert.equal(byName.length, 1, "a bundled id named in the entry's words is refused too");
  const ok = unverifiedProblems(file([...mapped(), { what: "Card rate check 3", tried: "used cc_apr_fed_g19 instead" }]), bundled, [...UNVERIFIED, { file: "debts.json", what: "Card rate check 3", concerns: [], substitutes: ["cc_apr_fed_g19"], note: "" }]);
  assert.deepEqual(ok, [], "an approved substitute passes");
  assert.deepEqual(unverifiedProblems({}, ["usda_food_plans_sep2026"]), ["usda_food_plans_sep2026: never bundled (spec 6.4)"]);
  assert.ok(NEVER_BUNDLED.some((re) => re.test("limra_barometer_2026_ownership")));
  for (const r of UNVERIFIED) for (const id of r.substitutes) assert.ok(TABLES[id], `${r.file} "${r.what}": substitute ${id} is a bundled table`);
});

// ---- the estimator contract
const PLANS = (() => {
  const out = [["empty", migrate(emptyPlan())], ["guessed (Ohio)", guessedPlan()], ["family", migrate(familyPlan(T0))]];
  for (const a of ARCHETYPES) out.push([a.id, migrate(a.build())]);
  const az = guessedPlan(); az.household.state = "AZ"; out.push(["guessed (Arizona)", az]);
  const blank = guessedPlan(); blank.household.state = ""; out.push(["guessed (no state)", blank]);
  const recent = guessedPlan(); recent.guide.setup.taps = { "mortgage-start": "2022on" }; out.push(["guessed (mortgage from 2022)", recent]);
  const recentUS = guessedPlan(); recentUS.household.state = ""; recentUS.guide.setup.taps = { "mortgage-start": "2022on" }; out.push(["guessed (mortgage from 2022, no state)", recentUS]);
  // C3: the spending taps answered (childcare paid, cover through work; Medicare)
  const care = guessedPlan(); care.guide.setup.taps = { childcare: "yes", "health-cover": "work" }; out.push(["guessed (childcare, cover at work)", care]);
  const careUS = guessedPlan(); careUS.household.state = ""; careUS.guide.setup.taps = { childcare: "yes", "health-cover": "public", hoa: "yes" }; out.push(["guessed (childcare, public cover, no state)", careUS]);
  // C4: a couple's joint 401(k) figure, "both of ours", split by pay (the split guesses need the tap on file)
  const both = patLee();
  applyHaveAmounts(both, { "retire-setup-self": "500000", joint: "both", checking: "28000", home: "450000" }, T0, { guess: (k, o) => estimate(structuredClone(both), k, { ...OPTS, ...o }) });
  out.push(["Pat and Lee (both of ours)", both]);
  return out;
})();
// the tax and insurance in a mortgage payment (2026-11-07, loans lane 1) is a figure of a debt row: each mortgage's row
const pathsFor = (plan, key) => (key === "overview/setup:ss" ? (plan.household?.people ?? []).map((p) => `retirement.socialSecurity.${p.id}.monthlyAtFRA`)
  : key === "debt.mortgage.escrow" ? (plan.debts ?? []).filter((d) => (plan.accounts ?? []).some((a) => a.id === d.accountId && a.type === "mortgage")).map((d) => `debts[${d.id}].escrowMonthly`)
  : [undefined]);

test("every estimator that ships returns null or a sourced Estimate (why <= 70, dataAsOf, tables known, low <= value <= high)", () => {
  const keys = Object.keys(REG.estimators);
  // C2 adds what is owed and the payment for each kind, the car loan's rate, and the home (spec 7.C-7.D)
  assert.deepEqual(keys.sort(), [
    // C4: retirement saving and balances (spec 7.B)
    "account.car.value", "account.cash", "account.invest.balance", "account.ira.balance", "account.retire.balance", "account.retire.split", "contrib.amount", "contrib.match",
    "debt.car-loan.owed", "debt.car-loan.payment", "debt.car-loan.rate", "debt.credit.owed", "debt.credit.payment", "debt.credit.rate",
    "debt.loan.owed", "debt.loan.payment", "debt.loan.rate", "debt.mortgage.escrow", "debt.mortgage.owed", "debt.mortgage.payment", "debt.mortgage.rate",
    "debt.student.owed", "debt.student.payment", "debt.student.rate", "home.boughtYear", "home.insurance", "home.propertyTax", "home.value",
    "overview/setup:cushionFunds", "overview/setup:cushionTarget", "overview/setup:retireSpend", "overview/setup:ss",
    // C3: the eight rows of a month's spending (spec 7.A)
    "spend.childcare", "spend.dining", "spend.groceries", "spend.housing", "spend.insurance", "spend.shopping", "spend.transport", "spend.utilities"]);
  assert.deepEqual(REG.problems, []);
  assert.deepEqual(checkEstimators([estimators, setupEstimators]), []);
  const seen = new Set();
  for (const [name, plan] of PLANS) for (const key of keys) for (const p of pathsFor(plan, key)) {
    const e = estimate(plan, key, { ...OPTS, path: p });
    if (e === null) continue;
    // a tap still to answer (spec 5.8: childcare is always asked): no figure yet, only the question
    if (e.value === null) { assert.ok(e.ask?.key && e.ask.question && e.ask.options.length >= 2, `${name} ${key}: ask`); continue; }
    seen.add(key);
    const where = `${name} ${key} ${p ?? ""}`;
    assert.equal(e.key, key);
    assert.ok(e.unit === "list" ? Array.isArray(e.value) : Number.isFinite(e.value), `${where}: value`);
    assert.ok(e.why.length > 0 && e.why.length <= 70, `${where}: why "${e.why}" (${e.why.length})`);
    assert.match(e.dataAsOf, ISO, `${where}: dataAsOf`);
    assert.ok(e.dataAsOf <= TODAY, where);
    for (const id of e.tables) assert.ok(TABLES[id], `${where}: table ${id}`);
    if (e.basis !== "yours") assert.ok(e.tables.length > 0, `${where}: a population figure cites its table`);
    if (e.measured) assert.ok(e.low <= e.value && e.value <= e.high, `${where}: low <= value <= high`);
    else assert.deepEqual([e.low, e.high], [null, null], `${where}: no range unless measured`);
    assert.ok(["big", "small"].includes(e.weight));
    assert.ok(e.sharperWith.length <= 2 && e.sharperWith.every((s) => s.label && s.href?.startsWith("#/")), `${where}: sharperWith`);
  }
  assert.deepEqual([...seen].sort(), keys.sort(), "each key gives a figure for at least one household");
});

test("the debt rates: Ohio's and Arizona's averages, the national one with no state, the state's new-loan rate from 2022", () => {
  // 2026-11-07: with the payment and the balance both typed and no year bought, nothing about the loan moves: the average on
  // loans people already have (FHFA, by state). Without them, the rate is the year the home was bought's (purchase.js).
  const BOTH = { payment: 1100, owed: 150000 };
  const rate = (name, args = BOTH) => estimate(PLANS.find(([n]) => n === name)[1], "debt.mortgage.rate", { ...OPTS, args });
  const oh = rate("guessed (Ohio)");
  assert.deepEqual([oh.value, oh.why, oh.tables, oh.sharperWith.map((s) => s.label)], [0.046, "the average on Ohio mortgages people already have", ["mortgage_outstanding_fhfa_by_state_2026q2"], ["when you took out the mortgage"]]);
  assert.equal(rate("guessed (Arizona)").value, 0.043);
  const us = rate("guessed (no state)");
  assert.deepEqual([us.value, us.tables, us.sharperWith.map((s) => s.label)], [0.044, ["mortgage_outstanding_fhfa_national"], ["your state", "when you took out the mortgage"]]);
  const recent = rate("guessed (mortgage from 2022)");
  assert.equal(recent.value, Math.round(cell(DEBTS.mortgage_new_purchase_fhfa_by_state_2025, "Average contract interest rate (%)", "OH") * 10) / 1000);
  assert.deepEqual([recent.tables, recent.sharperWith], [["mortgage_new_purchase_fhfa_by_state_2025"], []]);
  // not both typed: the average 30-year rate in the year the home was probably bought (Freddie Mac), and the year sharpens it
  const guessedYear = rate("guessed (Ohio)", {});
  assert.match(guessedYear.why, /^the usual rate for loans from about \d{4}, eased toward today's$/);   // (2026-11-07 review D7: the middle half of the age's move-in years, eased toward the loans people have)
  assert.deepEqual(guessedYear.sharperWith.map((s) => s.label), ["the year you bought your home"]);
  assert.ok(guessedYear.tables.includes("pmms30_annual_average_by_year"));
  assert.equal(rate("guessed (Ohio)", { bought: 2019 }).value, 0.039);
  // loans lane 1 (2026-11-07, item 7): with the balance and the payment both typed, a year bought typed no longer moves the rate:
  // the two figures already say the loan (a refinance since the purchase is common), so the rate stays the average on loans
  // people already have (was: "the average 30-year mortgage rate in 2019")
  assert.equal(rate("guessed (Ohio)", { ...BOTH, bought: 2019 }).why, "the average on Ohio mortgages people already have", "both typed: the year bought does not move the rate");
  const g = PLANS[1][1];
  assert.deepEqual(["debt.credit.rate", "debt.student.rate", "debt.loan.rate"].map((k) => estimate(g, k, OPTS).value), [0.224, 0.065, 0.119]);
  // review of C1 (2026-11-06, data 3): "taken out 2022 or later" with no state used the rate on loans people already have
  // (4.4%); it is the U.S. rate on 2025 home-purchase loans, by loan count (FHFA NMDB, all purchase loans: 6.3%)
  const recentUS = rate("guessed (mortgage from 2022, no state)");   // (the tap is in that plan)
  assert.deepEqual([recentUS.value, recentUS.why, recentUS.tables, recentUS.sharperWith.map((s) => s.label)], [0.063, "the average on new U.S. home loans lately", ["mortgage_new_loans_fhfa_national_2025"], ["your state"]]);
  assert.equal(cell(DEBTS.mortgage_new_loans_fhfa_national_2025, "Average contract interest rate (%)", "All Mortgages (Home Purchase)"), 6.3);
});

test("the gate: a EUR household and 'I live outside the U.S.' get no guess for any key", () => {
  const eur = guessedPlan(); eur.meta.currency = "EUR";
  const away = guessedPlan(); away.guide.setup.outsideUS = true;
  const unusual = ARCHETYPES.find((a) => a.id === "14-unusual-structures");
  const euroHousehold = structuredClone(unusual.build()); SPECIAL_PACKS["14-unusual-structures"].find((v) => v.slug === "euro-currency").apply(euroHousehold);
  // spec 4.8 (review of C1, 2026-11-06, plumbing 5): qa/fixtures/european-bank.csv imported into a USD plan, through the
  // importer's own record; its euro lines close the gate until the file is undone
  const banked = guessedPlan();
  const csv = fs.readFileSync(path.join(ROOT, "qa", "fixtures", "european-bank.csv"), "utf8");
  const prep = prepareImport(banked, csv, { accountId: "setup-have-checking", importId: "imp-eu" });
  for (const t of prep.add) banked.transactions.push(t);
  banked.imports = [...(banked.imports ?? []), importRecord(prep, { id: "imp-eu", at: "2026-11-02T10:00:00.000Z", accountId: "setup-have-checking", fileName: "european-bank.csv" })];
  assert.equal(banked.meta.currency, "USD");
  for (const [name, plan] of [["EUR", eur], ["outside the U.S.", away], ["the EUR household (qa/households 14)", migrate(euroHousehold)], ["a USD plan holding european-bank.csv", banked]]) {
    assert.equal(applies(plan), false, name);
    for (const key of Object.keys(REG.estimators)) for (const p of pathsFor(plan, key)) assert.equal(estimate(plan, key, { ...OPTS, path: p }), null, `${name}: ${key}`);
  }
  banked.imports = banked.imports.filter((im) => im.id !== "imp-eu");
  assert.equal(applies(banked), true, "undone: the gate opens again");
});

// ---- the import rule (spec 6.2)
// static imports and re-exports, bare imports, and dynamic import("...") (review of C1, 2026-11-06, plumbing 8: a late
// import() in core/estimate passed both this test and npm run check)
const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*["']([^"']+)["']|(?:^|\n)\s*import\s*["']([^"']+)["']|\bimport\(\s*["'`]([^"'`]+)["'`]\s*\)/g;
const importsIn = (src, file) => [...src.matchAll(IMPORT)].map((m) => m[1] ?? m[2] ?? m[3]).filter((s) => s.startsWith(".")).map((s) => path.resolve(path.dirname(file), s));
const importsOf = (file) => importsIn(fs.readFileSync(file, "utf8"), file);
// spec 6.2: core/*, its own data and estimators, three named data files of other modules, and three computes read-only; C7
// adds two for R12 (the bank files' whole months and transfers, transactions/ledger; the kinds, transactions/categories),
// read-only, so a row taken from the bank files reads the same months as Expenses' bank card
const ALLOWED = [/^core\//, /^modules\/overview\/guesses\/(data|estimators)\//, /^modules\/taxes\/federal\/data\/federal\.js$/, /^modules\/retirement\/social-security\/data\/ssa\.js$/,
  /^modules\/retirement\/historical\/data\/returns\.js$/, /^modules\/retirement\/contributions\/data\/limits\.js$/, /^modules\/career\/benefits\/data\/benefits\.js$/, /^modules\/taxes\/state\/compute\.js$/, /^modules\/cashflow\/expenses\/compute\.js$/,
  /^modules\/transactions\/ledger\/compute\.js$/, /^modules\/transactions\/categories\/compute\.js$/];
function reach(start) {
  const seen = new Set(), todo = [start];
  while (todo.length) { const f = todo.pop(); if (seen.has(f)) continue; seen.add(f); todo.push(...importsOf(f)); }
  seen.delete(start);
  return seen;
}
test("the import rule: core/*, its own data and estimators, other modules' data and five named computes; no cycle, no overview compute", () => {
  const rel = (f) => path.relative(ROOT, f).split(path.sep).join("/");
  const own = [path.join(HERE, "compute.js"), ...fs.readdirSync(path.join(HERE, "estimators")).map((f) => path.join(HERE, "estimators", f)), ...fs.readdirSync(path.join(HERE, "data")).map((f) => path.join(HERE, "data", f))];
  for (const f of own) for (const i of importsOf(f)) assert.ok(ALLOWED.some((re) => re.test(rel(i))), `${rel(f)} imports ${rel(i)}`);
  const reached = [...reach(path.join(HERE, "compute.js"))].map(rel);
  assert.ok(!reached.includes("modules/overview/guesses/compute.js"), "nothing it imports imports it back");
  assert.deepEqual(reached.filter((r) => /^modules\/overview\/[^/]+\/compute\.js$/.test(r)), [], "no overview compute");
  for (const f of fs.readdirSync(path.join(ROOT, "core", "estimate"))) for (const i of importsOf(path.join(ROOT, "core", "estimate", f))) assert.match(rel(i), /^core\/(estimate|math)\//, `core/estimate/${f} stays dependency-free`);
  assert.deepEqual(importsOf(path.join(ROOT, "core", "math", "estimate.js")), []);
});

test("the import rule sees a dynamic import() and allows only the three named data files of other modules", () => {
  const rel = (f) => path.relative(ROOT, f).split(path.sep).join("/");
  const at = path.join(ROOT, "core", "estimate", "ledger.js");
  const late = importsIn('export const late = () => import("../../modules/overview/setup/compute.js");\nconst b = await import( \'./paths.js\' );', at).map(rel);
  assert.deepEqual(late, ["modules/overview/setup/compute.js", "core/estimate/paths.js"], "both dynamic imports are seen");
  const ok = (r) => ALLOWED.some((re) => re.test(r));
  assert.deepEqual(["modules/taxes/federal/data/federal.js", "modules/retirement/social-security/data/ssa.js", "modules/retirement/historical/data/returns.js", "modules/overview/guesses/data/spend.js", "core/math/finance.js"].map(ok), [true, true, true, true, true]);
  assert.deepEqual(["modules/goals/goals/data/x.js", "modules/overview/dashboard/data/tiles.js", "modules/taxes/federal/data/other.js", "modules/overview/setup/compute.js"].map(ok), [false, false, false, false], "any other module's data/ is not allowed");
  for (const f of fs.readdirSync(path.join(ROOT, "core", "estimate"))) assert.doesNotMatch(fs.readFileSync(path.join(ROOT, "core", "estimate", f), "utf8"), /\bimport\s*\(/, `core/estimate/${f}: no dynamic import`);
});

// ---- coverage
test("coverage: every row says how a blank is handled, and every guess: key exists", () => {
  assert.equal(BUILT, 4);
  // 191: the inventory's "does not know" rows, de-duplicated, including its two "roughly / no" and "no (until quoted)"
  // rows (review of C1, 2026-11-06, data 1): the 401(k) balance on Get started (E12, C4) and the refinance offer's rate (C9)
  assert.equal(COVERAGE.length, 191);
  const row = (page, p) => COVERAGE.find((r) => r.page === page && r.path === p);
  assert.equal(row("overview/setup", "accounts[setup-have-retire-<pid>].balance")?.how, "guess:account.retire.balance");
  assert.equal(row("debt/refinance", "debtPlan.refinance.rate")?.how, "later:C9");
  assert.equal(new Set(COVERAGE.map((r) => `${r.page}|${r.path}|${r.label}`)).size, COVERAGE.length, "no row twice");
  for (const r of COVERAGE) {
    assert.ok(r.page && r.path && r.label, JSON.stringify(r));
    assert.match(r.how, /^(guess:\S+|compute:.+|fallback:.+|example|ask|other-builder|later:C(\d+))$/, JSON.stringify(r));
    if (r.how.startsWith("guess:")) assert.ok(REG.estimators[r.how.slice(6)], r.how);
    const later = /^later:C(\d+)$/.exec(r.how);
    if (later) assert.ok(Number(later[1]) > BUILT, `${r.label}: C${later[1]} is built`);
  }
  // C1 handled 48; C2 the six rate boxes of Get started's debt screen; C3 two spending rows and retirement spending; C4 the four retirement-saving boxes
  assert.equal(COVERAGE.filter((r) => !r.how.startsWith("later:")).length, 61);
  assert.equal(COVERAGE.filter((r) => r.how === "later:C2" || r.how === "later:C3").length, 0);
  assert.equal(row("overview/setup", "retirement.spendingMonthly (+ guide.setup.retireAuto)")?.how, "guess:overview/setup:retireSpend");
});

// ---- the page
const page = (plan) => compute(plan, { ...OPTS });
test("the page on an empty plan and on a plan with every figure typed: nothing to look over, and why", () => {
  const e = page(migrate(emptyPlan()));
  assert.deepEqual([e.count, e.planEmpty, e.rows, e.offers], [0, true, [], { fill: [], upgrade: [] }]);
  assert.equal(e.sources.all.length, 69, "the sources fold still lists every table on hand");
  const f = page(migrate(familyPlan(T0)));
  assert.deepEqual([f.count, f.planEmpty], [0, false]);
  assert.deepEqual(compute(migrate(emptyPlan())).sources.all.length, 69, "without a registry passed in it uses its own");
});

test("the page orders a frozen guess first, then the big ones; a ledger guess shows its estimator's words and table", () => {
  const p = guessedPlan();
  p.accounts.push({ id: "a-old", name: "Old savings", type: "savings", balance: 1234 });
  p.guesses = { "accounts[a-old].balance": { k: "account.cash.v0", v: 1234, u: "total", s: null, at: "2026-01-01", d: "2026-01-01" } };   // made by code that is gone
  p.debts.find((d) => d.id === "setup-debt-mortgage").rate = 0.0724;
  markGuess(p, "debts[setup-debt-mortgage].rate", estimate(p, "debt.mortgage.rate", OPTS), T0);
  const d = page(p);
  assert.equal(d.rows[0].label, "Old savings: a figure we filled in");
  assert.deepEqual([d.rows[0].frozen, d.rows[0].why, d.frozen], [true, "Type the real figure; we can't update this one any more.", 1]);
  assert.ok(d.big.includes(d.rows[0]), "a frozen guess leads the first card");
  assert.equal(d.top.includes(d.rows[0]), false);
  const m = d.rows.find((r) => r.path === "debts[setup-debt-mortgage].rate");
  assert.deepEqual([m.legacy, m.label, m.value, m.why, m.sources, m.href], [false, "Mortgage: interest rate", 0.047, "the usual rate for loans from about 2021, eased toward today's", ["pmms30_annual_average_by_year", "acs2025_year_moved_in_by_age_us", "acs2025_owner_households_by_age_us", "mortgage_outstanding_fhfa_by_state_2026q2"], "#/balance/liabilities"]);
  assert.equal(p.debts.find((x) => x.id === "setup-debt-mortgage").rateGuessed, 0.047, "the ledger write mirrors the older flag");
  const bigFirst = d.rows.findIndex((r) => r.weight !== "big" && !r.frozen);
  assert.ok(d.rows.slice(bigFirst).every((r) => r.weight !== "big"), "big ones before the rest");
  assert.ok(d.sources.used.some((s) => s.id === "pmms30_annual_average_by_year" && s.publisher.includes("Freddie Mac")));
});

test("the older rate words cite a table only for the table's own figure", () => {
  assert.deepEqual(LEGACY_WORDS.rate("mortgage", 0.0724).sources, ["mortgage_rate_pmms_weekly_2026"]);
  assert.deepEqual(LEGACY_WORDS.rate("credit", 0.2236).sources, ["cc_apr_fed_g19"]);
  assert.deepEqual(LEGACY_WORDS.rate("car-loan", 0.0717).sources, ["auto_personal_rate_fed_g19"]);
  assert.deepEqual(LEGACY_WORDS.rate("loan", 0.119).sources, ["auto_personal_rate_fed_g19"]);
  assert.deepEqual(LEGACY_WORDS.rate("student", 0.0652).sources, ["student_loan_rates_federal"]);
  assert.deepEqual(LEGACY_WORDS.rate("mortgage", 0.0699), { field: "interest rate", why: "a typical rate filled in when the box was left empty", sources: [], weight: "big" });
  assert.equal(manifest.estimators, estimators);
  assert.equal(manifest.id, "guesses"); assert.equal(manifest.group, "overview");
});

// review of C1 (2026-11-06, plumbing 1 and data 4): an older payment guess was worked out by Get started from the rate and the
// balance then (typicalPayment). The page vouched for it "at that rate", citing the rate's table, after the rate or balance
// had changed, and cited the rate's table even when the rate was the person's own
test("an older payment guess: said and cited from the rate it was worked out at; stale once the rate or balance moved", async () => {
  const { typicalPayment, TYPICAL_TERMS } = await import("../../../core/math/finance.js");
  const S = await import("../setup/compute.js");
  assert.equal(S.typicalPayment, typicalPayment, "Get started uses the shared one");
  assert.equal(S.TYPICAL_TERMS, TYPICAL_TERMS);
  const row = (d, path) => d.rows.find((r) => r.path === path);
  const PAY = "debts[setup-debt-mortgage].minPayment", CARD = "debts[setup-debt-credit].minPayment", RATE = "debts[setup-debt-mortgage].rate";
  // as Get started left it: 7.24% (Freddie Mac's new 30-year rate) and $1,261 = pmt(7.24%/12, 360, 185,000)
  const p = guessedPlan();
  assert.equal(typicalPayment("mortgage", 185000, 0.0724), 1261);
  let d = page(p);
  assert.deepEqual([row(d, PAY).stale, row(d, PAY).why, row(d, PAY).sources], [false, "what pays off what you owe over 30 years at our rate guess", ["mortgage_rate_pmms_weekly_2026"]]);
  assert.deepEqual(row(d, CARD).sources, ["cc_apr_fed_g19", "card_minimum_payment_rule_cfpb"]);
  // the plumbing review's repro: 6.125% typed on the page; at 6.125% the 30-year payment is $1,124, so $1,261 is $137 too high
  saveField(p, RATE, { value: 0.06125, guessed: false }, null, T0);
  assert.equal(typicalPayment("mortgage", 185000, 0.06125), 1124);
  d = page(p);
  const stale = row(d, PAY);
  assert.deepEqual([stale.stale, stale.sources, stale.value], [true, [], 1261]);
  assert.equal(stale.why, "We worked this out from the rate and what you owed back then. They've changed, so type your real payment.");
  assert.equal(d.rows[0], stale, "it leads the page");
  assert.ok(d.big.includes(stale));
  // a card: 29.99% typed leaves the $103 minimum worked out at 22.36% (it would be $126)
  saveField(p, "debts[setup-debt-credit].rate", { value: 0.2999, guessed: false }, null, T0);
  assert.equal(typicalPayment("credit", 3600, 0.2999), 126);
  assert.equal(row(page(p), CARD).stale, true);
  // the balance moved on Net worth: stale too
  const q = guessedPlan(); q.accounts.find((a) => a.id === "setup-owe-mortgage").balance = 150000;
  assert.equal(row(page(q), PAY).stale, true);
  // the data review's repro: Ohio, $185,000 owed, 3.1% typed and the payment left blank. The $790 is the payment at the
  // person's own rate: not stale, said "at your rate", and no rate table cited
  const own = migrate(emptyPlan());
  S.applyYou(own, { name: "Ana", who: "alone", kids: 0, state: "OH" });
  S.applyOwePicks(own, ["mortgage"]);
  S.applyOweAmounts(own, { mortgage: { owed: 185000, rate: "3.1", home: "260k" } }, T0);
  const r = row(page(own), PAY);
  assert.deepEqual([r.value, r.stale, r.why, r.sources], [790, false, "what pays off what you owe over 30 years at your rate", []]);
  const ds = page(own);
  assert.ok(!ds.sources.used.some((x) => x.id === "mortgage_rate_pmms_weekly_2026"), "the 7.24% table is not behind any guess");
});

// review of C1 (2026-11-06, plumbing 6; spec 4.8): a plan outside the U.S. gets no U.S. figures, and none are named as the
// source of its older guesses either
test("a plan not in U.S. dollars: older guesses in neutral words with no source; the page says the tables are not used", () => {
  for (const make of [(p) => { p.meta.currency = "EUR"; }, (p) => { p.guide.setup.outsideUS = true; }, (p) => { p.imports = [{ id: "imp", currency: "EUR" }]; }]) {
    const p = guessedPlan(); make(p);
    const d = page(p);
    assert.equal(d.applies, false);
    const rate = d.rows.find((r) => r.path === "debts[setup-debt-mortgage].rate");
    assert.deepEqual([rate.why, rate.sources], ["a typical rate filled in when the box was left empty", []]);
    assert.ok(d.rows.every((r) => r.sources.length === 0), "no row cites a U.S. table");
    assert.deepEqual(d.sources.used, []);
  }
  assert.equal(page(guessedPlan()).applies, true);
});

/** A null, undefined or false handed to the DOM's own append or replaceChildren shows as that word on screen (C7 fix: "null"
 *  under "How it adds up" on Expenses): never in a drawn page. */
function noStrayText(root) {
  const walk = (n) => { if (!n || typeof n !== "object") return; for (const k of n.kids) { if (k === "null" || k === "undefined" || k === "false") throw new Error(`"${k}" written on the page inside <${n.tag}>`); walk(k); } };
  walk(root);
}
// ---- the page drawn with a stand-in for the UI kit (no browser): every element keeps its attributes and children, so the
// words, the links' classes and the Save handler can be read and used (review of C1, 2026-11-06)
async function drawPage(plan, { view = "./view.js", more = {} } = {}) {
  const fmt = await import("../../../core/format.js");
  const { render } = await import(view);
  const { estimators: setupEst } = await import("../setup/compute.js");
  const node = (tag, attrs = {}, kids = []) => {
    const n = { tag, attrs: attrs ?? {}, kids: [], style: {}, value: attrs?.value ?? "",
      // as the DOM: append and replaceChildren write null, undefined or false as text (ui.h skips them: add)
      add(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) n.kids.push(c); },
      append(...k) { for (const c of k) n.kids.push(c !== null && typeof c === "object" ? c : String(c)); },
      replaceChildren(...k) { n.kids = []; n.append(...k); }, focus() {}, remove() {}, scrollIntoView() {}, querySelector() { return null; }, set innerHTML(v) { n.kids = []; void v; },
      get textContent() { return n.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } };
    n.add(...kids); return n;
  };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  const ui = {
    h: (tag, a, ...k) => (isAttrs(a) ? node(tag, a, k) : node(tag, {}, [a, ...k])),
    card: (t, ...k) => node("section", { class: "card" }, [t ? node("h2", {}, [t]) : null, ...k]),
    notice: (kind, t) => node("div", { class: `notice ${kind}` }, [t]),
    button: (label, onClick, o = {}) => node("button", { class: o.class ?? "", onClick }, [label]),
    moneyBox: (o) => { const input = node("input", { ...o, placeholder: o.placeholder }); return { box: node("span", { class: "money-in" }, [input]), input }; },
    moneyValue: (el) => fmt.readAmount(el.value),
    // (the other pages' kit, for Expenses: C7 fix UX)
    row: (...k) => node("div", { class: "row" }, k), stat: (l, v, s) => node("div", { class: "stat" }, [l, v, s]), form: () => node("form"), field: (l, c) => node("label", {}, [l, c]),
    select: () => node("select"), uid: () => "u1", confirm: () => true,
  };
  let current = structuredClone(plan);
  const modules = new Map([["overview/guesses", { group: "overview", id: "guesses", estimators, guessTables: TABLES }], ["overview/setup", { group: "overview", id: "setup", estimators: setupEst }]]);
  const draw = () => {
    const root = node("root");
    render(root, ctxOf(current));
    noStrayText(root);
    return root;
  };
  function ctxOf(p) {
    const extra = typeof more === "function" ? more(p) : more;
    return { ui, fmt: { ...fmt, today: () => T0 }, plan: p, modules, isReady: () => true, features: { enabled: () => true }, route: { query: {} },
      store: { update(fn) { const next = structuredClone(current); fn(next); current = next; } }, ...extra };
  }
  const all = (n, test, out = []) => { if (n && typeof n === "object") { if (test(n)) out.push(n); for (const k of n.kids) all(k, test, out); } return out; };
  const text = (n) => n.textContent.replace(/\s+/g, " ");
  // the guesses listed (C2: the "Better guesses are ready" card comes first on a plan with older guesses; its rows have no box)
  const listed = (root) => all(root, (n) => n.tag === "section" && /\bcard\b/.test(n.attrs.class ?? "") && !/hero/.test(n.attrs.class ?? "") && !/^Better guesses are ready/.test(text(n)));
  return { draw, all, text, listed, plan: () => current, ctx: () => ctxOf(current) };
}

test("the page on a phone: the source links are 44 px buttons, rates keep a thousandth of a percent, a stale payment is said first", async () => {
  const pg = await drawPage(guessedPlan());
  let root = pg.draw();
  // plumbing 2: the fold's links were inline 16 px text; .btn (core/ui/base.css) is 44 px tall
  const src = pg.all(root, (n) => /\bgs-src\b/.test(n.attrs.class ?? ""));
  const links = src.flatMap((ul) => pg.all(ul, (n) => n.tag === "a"));
  assert.equal(links.length, 69, "one link per table");
  assert.ok(links.every((a) => /\bbtn\b/.test(a.attrs.class) && /\bsmall\b/.test(a.attrs.class)), "every source link is a .btn.small");
  // data 7: "69 tables from 18 publishers", and each table's publisher, table name, as-of line and read date
  const fold = pg.text(pg.all(root, (n) => n.tag === "details").pop());
  assert.match(fold, /Where our guesses come from 69 tables from 18 publishers/);
  assert.match(fold, /Rate on a new 30-year fixed mortgage, latest week Freddie Mac Primary Mortgage Market Survey, weekly history The week of October 29, 2026\. Read /);
  assert.doesNotMatch(fold, /file source line|\(see |\.csv|\.xlsx|Flourish|sourceRef/);
  // plumbing 7: 6.125% is said as 6.125%, not 6.13%; plumbing 1: the payment worked out at the old rate is named
  const rate = pg.all(pg.listed(root)[0], (n) => n.tag === "li" && /Mortgage: interest rate/.test(n.textContent))[0];
  const input = pg.all(rate, (n) => n.tag === "input")[0];
  assert.equal(input.attrs.placeholder, "7.24");
  input.value = "6.125";
  pg.all(rate, (n) => n.tag === "form")[0].attrs.onSubmit({ preventDefault() {} });
  assert.equal(pg.plan().debts.find((d) => d.id === "setup-debt-mortgage").rate, 0.06125);
  root = pg.draw();
  const said = pg.text(pg.all(root, (n) => /notice ok/.test(n.attrs.class ?? ""))[0]);
  assert.equal(said, "Saved. Mortgage: interest rate is 6.125% now. It's yours, so we won't change it. Your payment of $1,261 a month was worked out at the old rate, so type your real one too.");
  const first = pg.all(pg.listed(root)[0], (n) => n.tag === "li")[0];
  assert.match(pg.text(first), /^Mortgage: payment a month \$1,261 a month We worked this out from the rate and what you owed back then\. They've changed, so type your real payment\./);
  assert.doesNotMatch(pg.text(first), /Our guess:/);
  assert.match(pg.text(pg.listed(root)[0]), /^Type these first/);
  // a rate of 6.875% shows as 6.875 in its box
  const p = guessedPlan(); p.debts.find((d) => d.id === "setup-debt-mortgage").rate = p.debts.find((d) => d.id === "setup-debt-mortgage").rateGuessed = 0.06875;
  const pg2 = await drawPage(p);
  const r2 = pg2.all(pg2.listed(pg2.draw())[0], (n) => n.tag === "li" && /Mortgage: interest rate/.test(n.textContent))[0];
  assert.equal(pg2.all(r2, (n) => n.tag === "input")[0].attrs.placeholder, "6.875");
  assert.match(pg2.text(r2), /6\.875%/);
});

test("the page for a plan not in U.S. dollars: no table is listed as on hand, and it says why", async () => {
  const p = guessedPlan(); p.meta.currency = "EUR";
  const pg = await drawPage(p);
  const root = pg.draw();
  const fold = pg.text(pg.all(root, (n) => n.tag === "details").pop());
  assert.match(fold, /We fill in typical figures only for households in the U\.S\. that count in dollars, so none of these tables is used for your plan\./);
  assert.doesNotMatch(fold, /On hand/);
  assert.equal(pg.all(root, (n) => /\bgs-src\b/.test(n.attrs.class ?? "")).length, 0);
  assert.doesNotMatch(pg.text(root), /the average rate on a new 30-year mortgage/);
});

// ---- C2: the home and the debts (7.C, 7.D), answer keys from 7.H
// The three walks are built with Get started's apply functions up to Q5b (qa/fixtures/setup-personas.mjs; today
// 2026-11-02). Q5b's boxes reach the estimators as `args` exactly as the screen sends them (setup's oweArgs): a blank
// box is null. R11 rounds every saved figure: a total to two figures when its spread is over 0.15, else three; a month
// or year to $10 under $1,000, else $50; a rate to a tenth of a point. Where a 7.H figure is the unrounded one, the
// comment says so and the test follows R11.
const BOX = { owed: (k) => `accounts[setup-owe-${k}].balance`, rate: (k) => `debts[setup-debt-${k}].rate`, payment: (k) => `debts[setup-debt-${k}].minPayment`, home: "accounts[setup-have-home].balance" };
/** Q5b's args for one debt, as the screen sends them (the typed answers; blank boxes null). */
const q5b = (plan, kind, typed = {}) => oweArgs(plan, typed, kind, { askHome: kind === "mortgage" && askHomeWithMortgage(plan) });
const guessOf = (plan, key, path, args) => estimate(plan, key, { ...OPTS, path, args });
const labels = (e) => (e.sharperWith ?? []).map((s) => s.label);

test("C2 7.H Jordan's home (E18, E23, E24): $210,000, tax $210 and insurance $100 a month", () => {
  const j = jordan(), args = q5b(j, "mortgage", { payment: "1,100" });
  assert.equal(askHomeWithMortgage(j), true, "a home picked and no figure for it: Q5b asks the home's value too");
  assert.deepEqual(args, { owed: null, payment: 1100, rate: null, start: null, home: null });
  // E18 (no purchase price): ACS Ohio median home value with a mortgage $270,800 x the SCF income ratio for a home at
  // $58,000 (the 36th income percentile; 0.7417) x the age ratio left once the 35-44 group's typical income is taken
  // out (1.0471) = $210,309; spread sqrt(2 ln(mean/median)) for 35-44 = 0.81, so two figures: $210,000
  const home = guessOf(j, "home.value", BOX.home, args);
  assert.equal(home.value, 210000);
  near(home.sigma, 0.8074, 0.001, "spread");
  assert.equal(home.measured, true);
  assert.ok(home.low < home.value && home.value < home.high, `middle half ${home.low}-${home.high}`);
  assert.equal(home.why, "typical for an Ohio home with a mortgage, on your pay");
  assert.deepEqual(labels(home), ["what the home cost and when"]);
  // E23: $210,000 x 1.223% (ACS Ohio median taxes / median value) = $2,568 a year -> $2,550; a month 214.0 -> $210
  const tax = guessOf(j, "home.propertyTax", undefined, args);
  assert.equal(tax.value, 2550);
  assert.equal(Math.round(210000 * 0.01223 / 12 / 10) * 10, 210, "7.H's $210 a month");
  assert.equal(tax.why, "Ohio homes pay about 1.2% of their value a year");
  assert.equal(tax.uses.value, "guess");
  // E24 (guess-sanity, 2026-11-07): NAIC Ohio HO-3 $1,116 (2023) x CPI 2024-2025 1.0570 = $1,179.6 a year for Ohio's typical
  // owner-occupied home (ACS 2025 median value), scaled by this home's value against that one -> $970 for $210,000
  const ins = guessOf(j, "home.insurance");
  assert.equal(ins.value, 970);
  assert.equal(ins.why, "typical home insurance for a home like yours in Ohio");
});

test("C2 7.H Pat and Lee's home: typed $450,000; tax $170 and insurance $110 a month", () => {
  const n = patLee(), args = q5b(n, "mortgage", { payment: "1,600" });
  assert.equal(askHomeWithMortgage(n), false, "the home was typed at question 4: not asked again");
  // E23: $450,000 x 0.443% (Arizona) = $1,993.5 a year -> $2,000; a month 166.1 -> 7.H's $170
  const tax = guessOf(n, "home.propertyTax", undefined, args);
  assert.equal(tax.value, 2000);
  assert.equal(tax.uses.value, "typed");
  assert.equal(Math.round(450000 * 0.00443 / 12 / 10) * 10, 170);
  // E24 (guess-sanity, 2026-11-07): $1,194 (Arizona HO-3, 2023) x 1.0570 = $1,262.1 a year for Arizona's typical home, scaled
  // by this $450,000 home against it -> $1,350 saved (R11's $50 steps)
  assert.equal(guessOf(n, "home.insurance").value, 1350);
});

test("C2 E18 with what was paid: the price grown with the state's home prices (FHFA), three figures", () => {
  const j = jordan();
  j.accounts.push({ id: "setup-have-home", name: "Home", type: "property", balance: 0 });
  j.property = [{ id: "home-1", kind: "home", accountId: "setup-have-home", purchasePrice: 150000, purchaseDate: "2018-05-01" }];
  // $150,000 x FHFA Ohio HPI 2025 674.68 / 2018 402.30 = $251,559; a declared spread of 0.15 keeps three figures
  const e = guessOf(j, "home.value", BOX.home);
  assert.equal(e.value, 252000);
  assert.equal(e.why, "what you paid in 2018, grown with Ohio home prices since");
  assert.deepEqual(e.tables, ["fhfa_hpi_at_state_annual"]);
  // with no state there is no state index: back to the typical home, and "your state" sharpens it
  j.household.state = "";
  const us = guessOf(j, "home.value", BOX.home);
  assert.match(us.why, /^typical for a U\.S\. home/);
  assert.ok(labels(us).includes("your state"));
});

test("C2 7.H Jordan's mortgage (answer key moved 2026-11-07): the year bought, the start tap, $910 if the payment is blank", () => {
  const j = jordan(), args = q5b(j, "mortgage", { payment: "1,100" });
  // Jordan (Ohio, born June 1985, 41) has no year bought typed: home.boughtYear is the usual year for an owner of 41 (2020),
  // so the rate is the mean of Freddie Mac's yearly averages over the middle half of the move-in years (2015 to 2024) eased toward
  // the average on loans people already have (4.6%): 4.4% (2026-11-07 review D7; the answer key's 4.6% was the average alone)
  const year = guessOf(j, "home.boughtYear");
  assert.equal(year.value, 2020);
  assert.equal(year.why, "Most owners your age bought in the last ten years or so.");
  const rate = guessOf(j, "debt.mortgage.rate", BOX.rate("mortgage"), args);
  assert.equal(rate.value, 0.044, "the middle half of the move-in years' average, eased toward 4.6%");
  assert.equal(rate.why, "the usual rate for loans from about 2020, eased toward today's");
  assert.deepEqual(labels(rate), ["the year you bought your home"]);
  // The payment typed: P&I = 1,100 - tax 214.0 - insurance 81.2 (scaled to the home; guess-sanity) = 804.7; the loan began July
  // 2020, 76 months gone, 284 left: pv(4.4%/12, 284, 804.7) = $141,8xx, declared spread 0.25 (the year is a guess) -> two figures: $140,000
  const owed = guessOf(j, "debt.mortgage.owed", BOX.owed("mortgage"), args);
  assert.equal(owed.value, 140000);
  assert.equal(owed.sigma, 0.25);
  assert.equal(owed.why, "worked back from your $1,100 payment and the 2020 purchase we guess");
  assert.equal(owed.ask?.key, "mortgage-start", "a typed payment: one tap asks when it was taken out");
  assert.equal(owed.ask.question, "When did you take out this mortgage, or last refinance it?");
  assert.deepEqual(owed.ask.options.map((o) => o.label), ["Before 2010", "2010 to 2019", "2020 or 2021", "2022 or later", "Not sure"]);
  assert.equal(guessOf(j, "debt.mortgage.owed", BOX.owed("mortgage"), q5b(j, "mortgage", {})).ask, undefined, "no payment: no tap");
  // the year typed (Get started's box) replaces the guess: 2015 -> 3.85% (Freddie Mac's 2015 average), 136 months gone
  const typedYear = guessOf(j, "debt.mortgage.owed", BOX.owed("mortgage"), { ...args, bought: 2015 });
  assert.equal(typedYear.why, "worked back from your $1,100 payment and the 2015 purchase");
  assert.equal(typedYear.sigma, 0.15);
  // the tap: pv(rate/12, 360 - months since the middle of the span, 804.7), declared spread 0.15 -> three figures. A refinance
  // answered on the tap is the loan's real start and wins over the guess; its rate is the mean of Freddie Mac's yearly averages
  // over the span (2026-11-07 review D6; the 7.H keys at the state's 4.6% were $116,000, $138,000 and $79,600 and move):
  //   2010 to 2019: January 2015, 142 months gone, 4.1% -> $123,556 -> $124,000;  2020 or 2021: January 2021, 70 gone, 3.0%
  //   -> $165,851 -> $166,000;  before 2010: July 2007, 232 gone, 6.3% (2000 to 2009) -> $74,866 -> $74,900
  // loans lane 1 (2026-11-07, item 5): a span is read only from the year the owner was about 20: Jordan (41) was 20 in 2005, so
  // "before 2010" is 2005 to 2009: July 2007 still, at 5.9% (2005 to 2009) -> $76,300 (was 6.3% over 2000 to 2009, $74,900)
  for (const [start, want, wantRate] of [["2010s", 124000, 0.041], ["2020-21", 166000, 0.03], ["pre2010", 76300, 0.059]]) {
    const t = guessOf(j, "debt.mortgage.owed", BOX.owed("mortgage"), { ...args, start });
    assert.equal(t.value, want, start);
    assert.equal(t.sigma, 0.15);
    assert.equal(t.why, "worked back from your $1,100 payment and when you took it out");
    assert.equal(guessOf(j, "debt.mortgage.rate", BOX.rate("mortgage"), { ...args, start }).value, wantRate, "the tap's years' average 30-year rate");
  }
  // 2022 or later: the rate is a new loan's, not the average on loans people have
  const recent = guessOf(j, "debt.mortgage.rate", BOX.rate("mortgage"), { ...args, start: "2022on" });
  assert.equal(recent.why, "the average on new home loans in Ohio lately");
  assert.notEqual(recent.value, 0.046);
  // an impossible tap (a loan taken out before the year typed for the purchase) is set aside: the year typed stands
  assert.equal(guessOf(j, "debt.mortgage.owed", BOX.owed("mortgage"), { ...args, bought: 2024, start: "2010s" }).why, "worked back from your $1,100 payment and the 2024 purchase");
  // "Not sure" is no answer: the guessed year again
  assert.equal(guessOf(j, "debt.mortgage.owed", BOX.owed("mortgage"), { ...args, start: "unsure" }).value, 140000);
  // E21 with the payment blank: the 2020 price (today's Ohio home taken back with the FHFA index) less 10% down (NAR first-time
  // buyers), at 4.4%, paid for 76 months, combined in logs with the old prior ($111,114, spread 0.73) at weight (1/0.35^2)
  // : (1/0.73^2): $110,000. The loan is worked from the same start, so the payment is its P&I over the 284 months left:
  // pmt(4.4%/12, 284, $110,000) = 624.0 + tax 214.0 + insurance 81.2 (scaled to the home; guess-sanity) = $919.2 -> $920
  // (the old answer key: $880 over 360 months; $940 with the flat state insurance of $98.3)
  const none = q5b(j, "mortgage", {});
  const o2 = guessOf(j, "debt.mortgage.owed", BOX.owed("mortgage"), none);
  assert.equal(o2.value, 110000);
  assert.equal(o2.why, "typical in 2020 with 10% paid up front, then paid down since");
  // loans lane 1 (2026-11-07, item 4): our $110,000 (the purchase loan combined with the usual balance for the age) is above what
  // the 2020 purchase loan would owe now, so the principal and interest is the purchase loan's own (about $615 a month), not
  // the larger one over the 284 months left: about $615 + $295.2 -> $910 (was $920)
  const pay = guessOf(j, "debt.mortgage.payment", BOX.payment("mortgage"), none);
  assert.equal(pay.value, 910);
  assert.equal(pay.why, "a loan of about $110,000 at 4.4%, plus Ohio's usual tax and insurance");
  // a typed escrow "no" leaves tax and insurance out
  const noEscrow = structuredClone(j); noEscrow.guide.setup.taps = { escrow: "no" };
  assert.equal(guessOf(noEscrow, "debt.mortgage.payment", BOX.payment("mortgage"), none).value, 620);
});

test("C2 7.H Pat and Lee's mortgage (answer key moved 2026-11-07): 4.4% from the year bought, tap 2010s $126,000", () => {
  const n = patLee(), args = q5b(n, "mortgage", { payment: "1,100" });
  // the older of the two is 61: the usual year is 2012; the rate is Freddie Mac's yearly averages over the middle half of the
  // move-in years (2005 to 2019) eased toward the average on loans people have (4.6%, weight 0.3 on the purchase years) -> 4.4%
  assert.equal(guessOf(n, "home.boughtYear").value, 2012);
  assert.equal(guessOf(n, "debt.mortgage.rate", BOX.rate("mortgage"), args).value, 0.044);
  // payment typed, the home typed: P&I = 1,100 - 166.1 - 110.7 (insurance scaled to the $450,000 home; guess-sanity) = 823.2;
  // the loan began July 2012, 172 months gone, 188 left: pv(4.4%/12, 188, 823.2) = $111,6xx -> $110,000 (the answer key's $210,000 was the state's loan-to-value on the typed home)
  const owed = guessOf(n, "debt.mortgage.owed", BOX.owed("mortgage"), args);
  assert.equal(owed.value, 110000);
  assert.equal(owed.why, "worked back from your $1,100 payment and the 2012 purchase we guess");
  // the tap, 2010 to 2019: pv(4.1%/12, 218, 823.2) = $126,390 -> $126,000; 2020 or 2021: 3.0% -> $169,656 -> $170,000 (the tap's years' average rate, review D6)
  assert.equal(guessOf(n, "debt.mortgage.owed", BOX.owed("mortgage"), { ...args, start: "2010s" }).value, 126000);
  assert.equal(guessOf(n, "debt.mortgage.owed", BOX.owed("mortgage"), { ...args, start: "2020-21" }).value, 170000);
  // and never more than the home typed ($450,000): a $5,000 payment bought in 2024 would owe more than that
  const big = guessOf(n, "debt.mortgage.owed", BOX.owed("mortgage"), { ...args, payment: 5000, bought: 2025 });
  assert.ok(big.value <= 450000, String(big.value));
  // a payment small enough to leave little: $700 a month -> P&I 423.2 -> pv(4.4%/12, 188, 423.2) = $57,4xx -> $57,000
  const small = guessOf(n, "debt.mortgage.owed", BOX.owed("mortgage"), { ...args, payment: 700 });
  assert.ok(small.value < 70000 && small.value > 55000, String(small.value));
});

test("C2 7.H Sam's car loan and cards: 11.2%, $12,000 owed (7.H $12,500 unrounded), card 22.4% and $90 (7.H $86 unrounded)", () => {
  const s = sam(), car = q5b(s, "car-loan", { payment: 420 }), card = q5b(s, "credit", { owed: "3,000" });
  // E26: $420 is nearer Experian's used-car payment ($542) than the new ($765) in log terms -> used: 11.19% -> 11.2%
  const rate = guessOf(s, "debt.car-loan.rate", BOX.rate("car-loan"), car);
  assert.equal(rate.value, 0.112);
  assert.equal(rate.why, "the average rate on a used-car loan");
  // E25: halfway through a usual used-car loan (67.86 months): pv(11.2%/12, 33.93, 420) = $12,166, spread from a
  // quarter (6,562) to three quarters (16,954) of the way: ln(16,954/6,562)/1.349 = 0.704; combined in logs with the
  // SCF car loan balance at 24 and $48,000 ($12,843, spread 0.78) -> $12,464 (7.H's $12,500), spread 0.52 -> $12,000
  const owed = guessOf(s, "debt.car-loan.owed", BOX.owed("car-loan"), car);
  assert.equal(owed.value, 12000);
  near(owed.sigma, 0.524, 0.002, "combined spread");
  assert.equal(owed.ask?.key, "car-loan-start", "spread over 0.5: the one tap asks when the loan began");
  assert.deepEqual(labels(owed), ["when you got the car loan"]);
  // the tap: 1 or 2 years ago -> 24 months gone, pv(.., 43.86, 420) = $15,060 -> $15,000 (spread 0.25)
  assert.equal(guessOf(s, "debt.car-loan.owed", BOX.owed("car-loan"), { ...car, start: "1-2" }).value, 15000);
  // a new-car payment picks the new-car rate: $760 -> the Fed's 72-month bank rate 7.17% -> 7.2%
  assert.equal(guessOf(s, "debt.car-loan.rate", BOX.rate("car-loan"), { ...car, payment: 760 }).value, 0.072);
  // no payment typed: the SCF balance alone, and "what you pay a month" sharpens it
  const bare = guessOf(s, "debt.car-loan.owed", BOX.owed("car-loan"), q5b(s, "car-loan", {}));
  assert.equal(bare.value, 13000);
  assert.deepEqual(labels(bare), ["what you pay a month"]);
  // E27 card rate: the Fed's G.19 rate on accounts charged interest, 22.36% -> 22.4%
  assert.equal(guessOf(s, "debt.credit.rate", BOX.rate("credit"), card).value, 0.224);
  // E29 card payment on $3,000 typed: 1% x 3,000 + 3,000 x 22.4%/12 = 30 + 56 = $86 (7.H) -> $90
  const pay = guessOf(s, "debt.credit.payment", BOX.payment("credit"), card);
  assert.equal(pay.value, 90);
  assert.equal(pay.why, "the month's interest plus 1% of what you owe, a usual minimum");
});

test("C2 the card minimum: $40 at least, never more than the balance; a typed payment caps what is owed", () => {
  const s = sam();
  const pay = (owed) => guessOf(s, "debt.credit.payment", BOX.payment("credit"), q5b(s, "credit", { owed })).value;
  assert.equal(pay(500), 40, "5 + 9.3 = $14.3 is under the $40 floor (CFPB)");
  assert.equal(pay(30), 30, "never more than the balance");
  // E28: a payment covers at most payment / (1% + 22.4%/12) owed. $50 -> $1,744, more than Sam's SCF card balance
  // ($1,607), so the SCF figure stands; $20 -> 20 / 0.02867 = $698, under it, so the bound speaks: $700
  const owed = (payment) => guessOf(s, "debt.credit.owed", BOX.owed("credit"), q5b(s, "credit", { payment }));
  assert.equal(owed(50).value, 1600, "SCF card balance at 24 and $48,000: $1,607 -> $1,600");
  const capped = owed(20);
  assert.equal(capped.value, 700);
  assert.equal(capped.why, "worked back from your $20 payment, if that's the minimum");
});

test("C2 student loans and other loans: the federal rate, the SCF balance, a 10-year or 3-year payment", () => {
  const s = sam();
  const rate = guessOf(s, "debt.student.rate", BOX.rate("student"), q5b(s, "student", {}));
  assert.equal(rate.value, 0.065, "Direct undergraduate 6.52% -> 6.5%");
  // owed: SCF education loans at 24 and $48,000 = $27,988 -> $28,000; with a $150 payment the 10-year bound
  // pv(6.5%/12, 120, 150) = $13,210 binds -> $13,000
  assert.equal(guessOf(s, "debt.student.owed", BOX.owed("student"), q5b(s, "student", {})).value, 28000);
  assert.equal(guessOf(s, "debt.student.owed", BOX.owed("student"), q5b(s, "student", { payment: 150 })).value, 13000);
  // payment on $26,000 typed: pmt(6.5%/12, 120, 26,000) = $295.2 -> $300
  const pay = guessOf(s, "debt.student.payment", BOX.payment("student"), q5b(s, "student", { owed: 26000 }));
  assert.equal(pay.value, 300);
  assert.equal(pay.why, "what pays off $26,000 at 6.5% over 10 years, the standard plan");
  // another loan: the Fed's 24-month personal loan rate 11.9%; $6,000 typed over 3 years: pmt(11.9%/12, 36, 6,000) = $198.9 -> $200
  assert.equal(guessOf(s, "debt.loan.rate", BOX.rate("loan"), q5b(s, "loan", {})).value, 0.119);
  assert.equal(guessOf(s, "debt.loan.payment", BOX.payment("loan"), q5b(s, "loan", { owed: 6000 })).value, 200);
});

test("C2 no state: national figures, and \"your state\" sharpens every state-based guess", () => {
  const j = jordan(); j.household.state = "";
  const args = q5b(j, "mortgage", { payment: 1100 });
  // (the payment and the balance both typed, and no year bought: the loan is left as it was, at the U.S. average)
  const rate = guessOf(j, "debt.mortgage.rate", BOX.rate("mortgage"), { ...args, owed: 150000 });
  assert.equal(rate.why, "the average on U.S. mortgages people already have");
  assert.deepEqual(labels(rate), ["your state", "when you took out the mortgage"]);
  const tax = guessOf(j, "home.propertyTax", undefined, args), ins = guessOf(j, "home.insurance");
  assert.equal(tax.why, "U.S. homes pay about 0.9% of their value a year");
  assert.deepEqual(labels(tax), ["your state"]);
  // U.S. HO-3 $1,737 x 1.0570 = $1,836 for the typical U.S. home, scaled to this $210,000 home (guess-sanity) -> $1,550
  assert.equal(ins.value, 1550);
  assert.deepEqual(labels(ins), ["your state"]);
  const owed = guessOf(j, "debt.mortgage.owed", BOX.owed("mortgage"), q5b(j, "mortgage", {}));
  // (2026-11-07) worked from the year bought: the 2020 price of a typical U.S. home, 10% down, paid since
  assert.equal(owed.why, "typical in 2020 with 10% paid up front, then paid down since");
  assert.deepEqual(labels(owed), ["the year you bought your home", "your state"]);
  // with the payment typed, the loan is worked back from it over the months left since the year we guess
  assert.equal(guessOf(j, "debt.mortgage.owed", BOX.owed("mortgage"), args).why, "worked back from your $1,100 payment and the 2020 purchase we guess");
});

test("C2 the gate: a plan in euros or outside the U.S. gets no home or debt guess", () => {
  const eur = jordan(); eur.meta.currency = "EUR";
  const out = jordan(); out.guide.setup.outsideUS = true;
  for (const p of [eur, out]) {
    for (const key of ["home.value", "home.propertyTax", "home.insurance", "debt.mortgage.rate", "debt.mortgage.owed", "debt.mortgage.payment", "debt.credit.payment"]) {
      assert.equal(guessOf(p, key, undefined, q5b(p, "mortgage", { payment: 1100 })), null, key);
    }
  }
});

test("C2 the profile the guesses read: the oldest adult, all of today's income, the tenure", async () => {
  const { profileOf } = await import("./compute.js");
  const n = patLee(), prof = profileOf(n, T0);
  assert.equal(prof.age, 61, "Pat, born March 1965, is the oldest adult");
  assert.equal(prof.income, 125000, "$85,000 + $40,000");
  assert.equal(prof.payHow, "typed");
  assert.equal(prof.state, "AZ");
  assert.equal(prof.tenure, "ownerWithMortgage");
  assert.equal(profileOf(sam(), T0).tenure, "renter");
  const owner = jordan(); owner.guide.setup.picks.owe = [];
  assert.equal(profileOf(owner, T0).tenure, "ownerWithoutMortgage", "a home picked and no mortgage");
});

// ---- C2: "Better guesses are ready" (11.5)
test("C2 offers.upgrade on a plan with older guesses: the rate and payment move, nothing changes until a tap", () => {
  const p = guessedPlan(T0);
  const before = structuredClone(p);
  const up = compute(p, OPTS).offers.upgrade;
  assert.deepEqual(p, before, "compute writes nothing");
  const rate = up.find((x) => x.path === "debts[setup-debt-mortgage].rate");
  assert.deepEqual([rate.label, rate.from, rate.to], ["Mortgage: interest rate", 0.0724, 0.047]);
  assert.equal(rate.why, "the usual rate for loans from about 2021, eased toward today's");
  const pay = up.find((x) => x.path === "debts[setup-debt-mortgage].minPayment");
  // the older payment: $185,000 at 7.24% over 30 years = $1,261; the new one at 4.7% over the months left of a loan begun in
  // 2021 (2026-11-07 review D7: the rate eased toward the average on loans people have), plus Ohio's tax and insurance on the typed home:
  // pmt(4.7%/12, 296, 185,000) = 1,056.9 + 363.3 = $1,420.2 -> $1,420 (the mortgage payment is rounded to $10, verify 2026-11-07; it was $1,400)
  assert.deepEqual([pay.from, pay.to], [1261, 1420]);
  assert.ok(up.every((x) => x.from !== x.to && typeof x.label === "string" && !("est" in x)));
  // Keep the old ones: nothing moves and the card does not come back
  const kept = structuredClone(p); keepOldGuesses(kept, T0);
  assert.deepEqual(kept.guide.guessUpgrade, { at: T0, choice: "kept" });
  assert.equal(kept.debts.find((d) => d.id === "setup-debt-mortgage").rate, 0.0724);
  assert.deepEqual(compute(kept, OPTS).offers.upgrade, []);
  // Use the new guesses: each one is written as a guess (the ledger), and the older flags follow it
  const used = structuredClone(p); useNewGuesses(used, OPTS);
  const d = used.debts.find((x) => x.id === "setup-debt-mortgage");
  assert.equal(d.rate, 0.047);
  assert.equal(d.rateGuessed, 0.047, "the legacy flag mirrors the ledger");
  assert.equal(used.guesses["debts[setup-debt-mortgage].rate"].k, "debt.mortgage.rate");
  assert.equal(d.minPayment, 1420);
  assert.equal(used.guide.guessUpgrade.choice, "new");
  assert.deepEqual(compute(used, OPTS).offers.upgrade, []);
  // a plan with no older guesses, or outside the gate, is offered nothing
  assert.deepEqual(compute(migrate(familyPlan(T0)), OPTS).offers.upgrade, []);
  const eur = guessedPlan(T0); eur.meta.currency = "EUR";
  assert.deepEqual(compute(eur, OPTS).offers.upgrade, []);
});

test("C2 the guesses page shows the card first, and its two buttons save and say so", async () => {
  const pg = await drawPage(guessedPlan(T0));
  let root = pg.draw();
  const card = pg.all(root, (n) => n.tag === "section" && /^Better guesses are ready/.test(pg.text(n)))[0];
  assert.ok(card, "the card is drawn");
  assert.match(pg.text(card), /These \d+ would change; nothing moves until you say so\./);
  assert.match(pg.text(card), /Mortgage: interest rate From 7\.24% to 4\.7% Our new guess: the usual rate for loans from about 2021, eased toward today's\./);
  const buttons = pg.all(card, (n) => n.tag === "button");
  assert.deepEqual(buttons.map((b) => pg.text(b).trim()), ["Use the new guesses", "Keep the old ones"]);
  buttons[0].attrs.onClick();
  root = pg.draw();
  assert.match(pg.text(pg.all(root, (n) => /notice ok/.test(n.attrs.class ?? ""))[0]), /^Saved: the \d+ new guesses are in your plan\./);
  assert.equal(pg.all(root, (n) => n.tag === "section" && /^Better guesses are ready/.test(pg.text(n))).length, 0, "gone once answered");
  assert.equal(pg.plan().debts.find((d) => d.id === "setup-debt-mortgage").rate, 0.047);
  const pg2 = await drawPage(guessedPlan(T0));
  const card2 = pg2.all(pg2.draw(), (n) => n.tag === "section" && /^Better guesses are ready/.test(pg2.text(n)))[0];
  pg2.all(card2, (n) => n.tag === "button")[1].attrs.onClick();
  assert.match(pg2.text(pg2.all(pg2.draw(), (n) => /notice ok/.test(n.attrs.class ?? ""))[0]), /^Kept: your older figures stay as they are\. We won't ask again\./);
  assert.equal(pg2.plan().debts.find((d) => d.id === "setup-debt-mortgage").rate, 0.0724);
});

// ---- C2 fixes after the reviews (est/c2/c2-fix.md, D2): a debt typed later beside the one we guessed is asked about once
test("C2 fix (D2): a mortgage added on Net worth beside our guessed one is offered as the same loan; Yes counts it once", async () => {
  const S = await import("../setup/compute.js");
  const { compute: netWorth } = await import("../../balance/net-worth/compute.js");
  const { compute: liabilities } = await import("../../balance/liabilities/compute.js");
  const { settle } = await import("../../../core/estimate/index.js");
  const spend = { mode: "rows", rows: { housing: 120, utilities: 560, groceries: 780, transport: 960, insurance: 910, dining: 1000, shopping: 930 } };
  const n = patLee(); const before = structuredClone(n);
  S.applyOweAmounts(n, { mortgage: { payment: "1,600" } }, T0, { guess: (k, o) => estimate(before, k, { ...OPTS, ...o }) });
  S.applySpend(n, spend);
  // the person then adds their real mortgage on Net worth ($205,000) and its payment on Debts: the natural move
  n.accounts.push({ id: "acct-real", name: "Home loan", type: "mortgage", balance: 205000, asOf: T0, institution: "", ownerId: "", history: [], notes: "" });
  n.debts.push({ id: "debt-real", accountId: "acct-real", rate: 0.0375, minPayment: 1600, extra: 0, termMonths: null, startDate: "", securedBy: "", creditLimit: null });
  settle(n, OPTS);
  assert.equal(netWorth(n, { today: T0 }).netWorth, 593000, "both counted: $978,000 - $180,000 - $205,000");
  const twins = compute(n, OPTS).offers.twins;
  assert.deepEqual(twins.map((t) => [t.kind, t.id, t.name, t.amount, t.twinId, t.twinName, t.twinAmount]), [["loan", "setup-owe-mortgage", "Mortgage", 180000, "acct-real", "Home loan", 205000]]);
  // Yes: ours goes (its account, its loan row and its guesses), theirs is counted once
  const yes = structuredClone(n); assert.equal(sameLoan(yes, "setup-owe-mortgage", "acct-real"), true); settle(yes, OPTS);
  assert.equal(netWorth(yes, { today: T0 }).netWorth, 773000, "as before the guesses: $978,000 - $205,000");
  assert.equal(liabilities(yes, { today: T0 }).payments, 1600);
  assert.equal(Object.keys(yes.guesses ?? {}).filter((k) => /setup-(owe|debt)-mortgage/.test(k)).length, 0);
  assert.equal(compute(yes, OPTS).offers.twins, undefined, "nothing left to ask");
  assert.equal(S.oweTaken(yes, "mortgage"), true, "Get started no longer asks for a mortgage of its own");
  // their loan with no row on Debts yet: our rate and payment move onto it, still marked, and follow its balance
  const bare = structuredClone(n); bare.debts = bare.debts.filter((d) => d.id !== "debt-real");
  sameLoan(bare, "setup-owe-mortgage", "acct-real"); settle(bare, OPTS);
  const moved = bare.debts.find((d) => d.accountId === "acct-real");
  assert.ok(moved && moved.id !== "setup-debt-mortgage");
  assert.equal(moved.minPayment, 1600, "the payment typed on Q5b stays");
  assert.equal(bare.guesses[`debts[${moved.id}].rate`].k, "debt.mortgage.rate");
  assert.equal(netWorth(bare, { today: T0 }).netWorth, 773000);
  // No, two loans: both stay and the question does not come back
  const no = structuredClone(n); twoLoans(no, "setup-owe-mortgage", "acct-real", T0);
  assert.deepEqual(no.guide.setup.twins, { "setup-owe-mortgage": { "acct-real": T0 } });
  assert.equal(compute(no, OPTS).offers.twins, undefined);
  assert.equal(netWorth(no, { today: T0 }).netWorth, 593000);
  // a plan with no guesses is never asked (and its page output has no new key)
  assert.equal("twins" in compute(migrate(familyPlan(T0)), OPTS).offers, false);
});

// C2 verify: "No, two loans" is kept for that pair only. Pat and Lee add a HELOC on Net worth and answer No (it is a second
// loan); later they add their real home loan: before the fix it was never asked about, so our guessed $190,000 and their
// $205,000 were both counted in silence (net worth $583,000 where it is $743,000 with the HELOC).
test("C2 verify: \"No, two loans\" is remembered for that pair; a loan added later is still asked about", async () => {
  const S = await import("../setup/compute.js");
  const { compute: netWorth } = await import("../../balance/net-worth/compute.js");
  const { settle } = await import("../../../core/estimate/index.js");
  const n = patLee(); const before = structuredClone(n);
  S.applyOweAmounts(n, { mortgage: { payment: "1,600" } }, T0, { guess: (k, o) => estimate(before, k, { ...OPTS, ...o }) });
  const add = (p, id, name, balance) => p.accounts.push({ id, name, type: "mortgage", balance, asOf: T0, institution: "", ownerId: "", history: [], notes: "" });
  add(n, "acct-heloc", "HELOC", 30000); settle(n, OPTS);
  assert.deepEqual(compute(n, OPTS).offers.twins.map((t) => [t.id, t.twinId]), [["setup-owe-mortgage", "acct-heloc"]]);
  twoLoans(n, "setup-owe-mortgage", "acct-heloc", T0); settle(n, OPTS);
  assert.equal(compute(n, OPTS).offers.twins, undefined, "the HELOC is not asked about again");
  add(n, "acct-real", "Home loan", 205000); settle(n, OPTS);
  assert.equal(netWorth(n, { today: T0 }).netWorth, 563000, "$978,000 - $180,000 - $30,000 - $205,000: counted twice until answered");
  assert.deepEqual(compute(n, OPTS).offers.twins.map((t) => [t.id, t.twinId, t.twinName]), [["setup-owe-mortgage", "acct-real", "Home loan"]]);
  assert.equal(sameLoan(n, "setup-owe-mortgage", "acct-real"), true); settle(n, OPTS);
  assert.equal(netWorth(n, { today: T0 }).netWorth, 743000, "$978,000 - $30,000 - $205,000");
  assert.equal(compute(n, OPTS).offers.twins, undefined);
  // the HELOC deleted and another loan added in its place: that one is asked about too (a new pair)
  const m = patLee(); const b2 = structuredClone(m);
  S.applyOweAmounts(m, { mortgage: { payment: "1,600" } }, T0, { guess: (k, o) => estimate(b2, k, { ...OPTS, ...o }) });
  add(m, "acct-heloc", "HELOC", 30000); twoLoans(m, "setup-owe-mortgage", "acct-heloc", T0);
  m.accounts = m.accounts.filter((a) => a.id !== "acct-heloc"); add(m, "acct-real", "Home loan", 205000); settle(m, OPTS);
  assert.deepEqual(compute(m, OPTS).offers.twins.map((t) => t.twinId), ["acct-real"]);
});

test("C2 fix (D2): the page asks \"Is this the same loan?\" first, and Yes counts the loan once", async () => {
  const S = await import("../setup/compute.js");
  const n = patLee(); const before = structuredClone(n);
  S.applyOweAmounts(n, { mortgage: { payment: "1,600" } }, T0, { guess: (k, o) => estimate(before, k, { ...OPTS, ...o }) });
  n.accounts.push({ id: "acct-real", name: "Home loan", type: "mortgage", balance: 205000, asOf: T0, institution: "", ownerId: "", history: [], notes: "" });
  const pg = await drawPage(n);
  const card = pg.all(pg.draw(), (n2) => n2.tag === "section" && /^Is this the same loan\?/.test(pg.text(n2)))[0];
  assert.ok(card, "the card is drawn");
  assert.match(pg.text(card), /You added Home loan, \$205,000\. We also have Mortgage, with our guess of about \$180,000 still owed\./);
  const [yes, no] = pg.all(card, (x) => x.tag === "button");
  assert.deepEqual([pg.text(yes).trim(), pg.text(no).trim(), no.attrs.class], ["Yes, the same loan", "No, two loans", "secondary"]);
  yes.attrs.onClick();
  const root = pg.draw();
  assert.match(pg.text(pg.all(root, (x) => /notice ok/.test(x.attrs.class ?? ""))[0]), /^Done: Home loan counts once, and our guess for Mortgage is gone\./);
  assert.equal(pg.plan().accounts.some((a) => a.id === "setup-owe-mortgage"), false);
  assert.equal(pg.all(root, (x) => x.tag === "section" && /^Is this the same loan\?/.test(pg.text(x))).length, 0);
});

test("C2 fix (D2, the home): a home added on Net worth beside the one Q5b guessed is asked about the same way", async () => {
  const S = await import("../setup/compute.js");
  const { compute: netWorth } = await import("../../balance/net-worth/compute.js");
  const j = jordan(); const before = structuredClone(j);
  S.applyOweAmounts(j, { mortgage: { payment: 1100 } }, T0, { guess: (k, o) => estimate(before, k, { ...OPTS, ...o }) });
  // the home left blank on Q5b is our $210,000; the person then adds the house on Net worth at $300,000
  j.accounts.push({ id: "acct-house", name: "House", type: "property", balance: 300000, asOf: T0, institution: "", ownerId: "", history: [], notes: "" });
  j.property = [{ id: "pr-1", kind: "home", accountId: "setup-have-home", name: "Home" }];
  assert.equal(netWorth(j, { today: T0 }).netWorth, 370000, "both counted: $210,000 + $300,000 - $140,000");
  const twins = compute(j, OPTS).offers.twins;
  assert.deepEqual(twins.map((t) => [t.kind, t.id, t.amount, t.twinId, t.twinAmount]), [["home", "setup-have-home", 210000, "acct-house", 300000]]);
  sameLoan(j, "setup-have-home", "acct-house");
  assert.equal(netWorth(j, { today: T0 }).netWorth, 160000, "counted once: $300,000 - $140,000");
  assert.equal(j.property[0].accountId, "acct-house", "the Home page's entry follows the home that stays");
  assert.equal(isGuessIn(j, "accounts[setup-have-home].balance"), false);
  const pg = await drawPage((() => { const k = jordan(); const b = structuredClone(k); S.applyOweAmounts(k, { mortgage: { payment: 1100 } }, T0, { guess: (kk, o) => estimate(b, kk, { ...OPTS, ...o }) }); k.accounts.push({ id: "acct-house", name: "House", type: "property", balance: 300000, asOf: T0, institution: "", ownerId: "", history: [], notes: "" }); return k; })());
  const card = pg.all(pg.draw(), (n2) => n2.tag === "section" && /^Is this the same home\?/.test(pg.text(n2)))[0];
  assert.ok(card, "the card is drawn with the home's words");
  assert.match(pg.text(card), /You added House, \$300,000\. We also have Home, with our guess of about \$210,000\. If they're the same home, it's counted twice now\./);
  assert.deepEqual(pg.all(card, (x) => x.tag === "button").map((b) => pg.text(b).trim()), ["Yes, the same home", "No, two homes"]);
});
const isGuessIn = (p, path) => Object.prototype.hasOwnProperty.call(p.guesses ?? {}, path);

// ---- C3: spending (spec 7.0, 7.A, R10, 7.F; tests 14.3). The three walks of 7.H answer Q5b and Q6 through Get started's
// own apply functions, with the grey figures the screen shows (estimate with the screen's args, on the plan before the save)
import * as SP from "./estimators/spend.js";
const C3 = await import("../setup/compute.js");
const { settle } = await import("../../../core/estimate/index.js");
const { compute: nextBest } = await import("../next-best-action/compute.js");
const { federalTax, paramsFor } = await import("../../../core/math/tax.js");
const { FEDERAL } = await import("../../taxes/federal/data/federal.js");
const { typoCheck } = await import("../../../core/math/estimate.js");
const ROWS7H = ["housing", "utilities", "groceries", "transport", "insurance", "dining", "shopping"];
const viaGuess = (p, fn) => { const before = structuredClone(p); fn(p, (k, o = {}) => estimate(before, k, { ...OPTS, ...o })); return settle(p, OPTS); };
const OWE7H = { sam: { "car-loan": { payment: 420 }, credit: { owed: "3,000" } }, jordan: { mortgage: { payment: 1100 } }, patLee: { mortgage: { payment: 1600 } } };
const atQ6 = (name) => { const p = { sam, jordan, patLee }[name](); viaGuess(p, (d, g) => C3.applyOweAmounts(d, OWE7H[name], T0, { guess: g })); return p; };
const lib0 = (p) => { const m = new Map(); return { today: T0, memo: (n, f) => { if (!m.has(n)) m.set(n, f()); return m.get(n); }, estimate: (k, o = {}) => estimate(p, k, { ...OPTS, ...o }) }; };
/** Q6's grey figures as the screen shows them: every asked row blank except `typed`, with `taps`. */
function greys(p, typed = {}, taps = {}) {
  const args = C3.spendArgs(p, { mode: "rows", rows: typed, taps });
  return { args, rows: Object.fromEntries(Object.entries(args.rows).filter(([, v]) => v === null).map(([k]) => [k, estimate(p, `spend.${k}`, { ...OPTS, path: SP.spendPath(k), args })])) };
}

test("C3 7.0 take-home a: S $44,420 (federal $3,580, Texas none), J $57,813 (refundable credits, Ohio 2.75% over $26,050), N $112,040", () => {
  // S: 48,000 single; federal = 3,580 (2026 tables); Texas has no wage tax: 48,000 - 3,580 = 44,420
  const s = SP.takeHome(sam(), T0);
  assert.deepEqual([Math.round(s.a), Math.round(s.federal), s.state, s.how], [44420, 3580, 0, "none"]);
  // J: 58,000 head of household, two children under 17: federal -692 (the refundable child credit; 7.0 says -1,075 with C4's
  // $3,190 of pre-tax saving, which spending is worked out without, 5.3); Ohio (58,000 - 26,050) x 2.75% = 878.6
  const j = SP.takeHome(jordan(), T0);
  assert.deepEqual([Math.round(j.a), Math.round(j.federal), Math.round(j.state), j.how], [57813, -692, 879, "flat"]);
  // the 7.0 example's Ohio $791 is with C4's $3,190 of pre-tax saving: typed, it counts here too ((58,000 - 3,190 - 26,050) x 2.75% = 790.9)
  const jp = jordan(); jp.accounts.push({ id: "k1", name: "401(k)", type: "401k", balance: 0 }); jp.retirement.contributions.push({ id: "c1", accountId: "k1", personId: "setup-self", amount: 3190 / 12, period: "monthly", employerMatch: 0 });
  assert.equal(Math.round(SP.takeHome(jp, T0).state), 791);
  // ...but a contribution that is our guess (C4, tier 4) does not: spending is worked out before saving (5.3)
  markGuess(jp, "retirement.contributions[c1].amount", { key: "contrib.amount", value: 3190 / 12, unit: "month", sigma: null, dataAsOf: T0 }, T0);
  assert.equal(Math.round(SP.takeHome(jp, T0).state), 879);
  // N: 125,000 joint, Arizona 2.5% after the federal standard deduction
  assert.equal(Math.round(SP.takeHome(patLee(), T0).a), 112040);
  // a graduated state with no rate typed: the survey's own after-tax ratio at that income (taxRatio2023), labelled
  const ga = sam(); ga.household.state = "GA";
  const g = SP.takeHome(ga, T0);
  assert.equal(g.how, "survey"); assert.ok(g.a > 0.85 * 48000 && g.a < 1.0 * 48000, `${g.a}`);
  // no income at all: no a (the household type's own share is used instead)
  const none = sam(); none.income = []; assert.equal(SP.takeHome(none, T0), null);
});

test("C3 7.H spending (health cover Not sure): every row, the envelope, k, and the total from the rounded rows", () => {
  // proto3 (spec-tools): S raw 1,215 / 227 / 319 / 398 / 346 / 295 / 379, envelope 3,221, typed loans 420 + card 86 -> k 0.764.
  // Here the card payment is our R11-rounded $90 (C2), so k = (3,221 - 510 - 1,215) / 1,964 = 0.762 and eating out is
  // 295 x 0.762 = 224.8 -> $220 (7.H $230, which used 0.764: 225.4 -> $230); R11 wins, the total is $2,680 (7.H $2,690)
  const want = {
    // (guess-sanity 2026-11-07: health cover follows the oldest adult's age and the household's size, CE 2025 by age, not the
    // household type: a 29-year-old on her own is $70, not $260, and the other rows take the room)
    sam: { rows: [1200, 200, 280, 350, 70, 260, 330], env: 3221, k: 0.882, total: 2690 },
    // J: childcare typed $900; mortgage $1,100 typed on Q5b. k = (4,986 - 2,000 - 54) / 3,192 = 0.918
    jordan: { rows: [50, 460, 540, 470, 360, 460, 650], env: 4986, k: 0.910, total: 2990, typed: { childcare: 900 } },
    // N: room 7,763 - 1,600 - 116 = 6,047 > 5,146 of flexible rows: k = 1
    patLee: { rows: [120, 560, 780, 960, 640, 1000, 930], env: 7763, k: 1, total: 4990 },
  };
  for (const [name, w] of Object.entries(want)) {
    const p = atQ6(name);
    const { args, rows } = greys(p, w.typed ?? {});
    assert.deepEqual(ROWS7H.map((r) => rows[r]?.value), w.rows, name);
    const m = SP.spendModel(p, { today: T0, args }, lib0(p));
    near(m.envelope, w.env, 1, `${name} envelope`); near(m.k, w.k, 0.001, `${name} k`);
    assert.equal(ROWS7H.reduce((t, r) => t + rows[r].value, 0), w.total, `${name} total`);
    for (const r of ROWS7H) { assert.ok(rows[r].why.length <= 70, rows[r].why); assert.equal(rows[r].unit, "month"); assert.deepEqual([rows[r].sigma, rows[r].measured], [0.25, false]); }
  }
  const s = greys(atQ6("sam")).rows;
  assert.equal(s.housing.why, "typical rent before utilities for one person in Texas on your pay");
  assert.equal(greys(atQ6("jordan"), { childcare: 900 }).rows.housing.why, "upkeep on a home like yours; few Ohio owners pay an HOA fee");
});

test("C3 the envelope holds (R10); the bias is stated: S spends 70-85% of a; J's flexible rows give way, housing does not; flat above $250,000", () => {
  for (const name of ["sam", "jordan", "patLee"]) {
    const p = atQ6(name), { args } = greys(p);
    const m = SP.spendModel(p, { today: T0, args }, lib0(p));
    const guessed = m.guessed.reduce((t, r) => t + m.rows[r].value, 0);
    if (m.k > 0.5) assert.ok(guessed + m.typed <= m.envelope + 10, `${name}: ${guessed} + ${m.typed} <= ${m.envelope}`);
  }
  // every household archetype with every row left blank
  for (const a of ARCHETYPES) {
    const p = migrate(a.build());
    const args = { mode: "rows", rows: Object.fromEntries(SP.ROWS.map((r) => [r, null])), taps: {} };
    const m = SP.spendModel(p, { today: T0, args }, lib0(p));
    const guessed = m.guessed.reduce((t, r) => t + (m.rows[r].value ?? 0), 0);
    if (m.k > 0.5) assert.ok(guessed + m.typed <= m.envelope + 10, `${a.id}`);
    assert.ok(guessed > 0, `${a.id}: spending is never $0`);
  }
  // S's living share of a: 2,680 x 12 / 44,420 = 0.72
  const s = atQ6("sam"), gs = greys(s).rows, share = ROWS7H.reduce((t, r) => t + gs[r].value, 0) * 12 / SP.takeHome(s, T0).a;
  assert.ok(share >= 0.7 && share <= 0.85, `${share}`);
  const j = atQ6("jordan"), jm = SP.spendModel(j, { today: T0, args: greys(j, { childcare: 900 }).args }, lib0(j));
  assert.ok(jm.k < 1); near(jm.rows.housing.value, jm.rows.housing.fixed, 1e-9, "housing is a price, not scaled");
  // above the top fifth's after-tax income the shares are flat (no extrapolation)
  for (const r of ["utilities", "groceries", "dining", "envelope"]) assert.equal(SP.sQ(r, 300000), SP.sQ(r, 500000), r);
});

test("C3 monotone: a dollar of pay at a bucket edge moves a guess under 0.1%; typing pay never widens a row's spread", () => {
  const edge = SP.afterTax("incomeQuintile", "fourth20");
  for (const r of ["groceries", "dining", "envelope"]) { const a = SP.sQ(r, edge) * edge, b = SP.sQ(r, edge + 1) * (edge + 1); assert.ok(Math.abs(b - a) / a < 0.001, r); }
  const p = atQ6("sam"), noPay = atQ6("sam"); noPay.income = [];
  for (const r of ROWS7H) assert.ok(greys(p).rows[r].sigma <= greys(noPay).rows[r].sigma, r);
  // no pay: the household type's own share at its income, with "your pay" as a sharper
  const n = greys(noPay).rows;
  assert.ok(n.groceries.value > 0 && n.groceries.sharperWith.some((x) => x.label === "your pay"));
});

test("C3 hurdles: Ohio's HOA left out, Arizona's asked (Not sure takes the likelier side, No); childcare always asked; health cover asked once", () => {
  const j = greys(atQ6("jordan"), { childcare: 900 }).rows;
  assert.equal(j.housing.ask, undefined, "17.8% of Ohio owners: no question");
  const n = greys(atQ6("patLee")).rows;
  assert.equal(n.housing.ask?.key, "hoa", "48.8% of Arizona owners: asked");
  assert.equal(n.housing.value, 120, "unanswered or Not sure: 48.8% is under half, so no fee");
  const nYes = greys(atQ6("patLee"), {}, { hoa: "yes" }).rows.housing.value;
  // Yes adds Arizona's median fee for owners with a mortgage: 116.2 upkeep + the fee, to $10
  const fee = cell(HOME.acs2025_hoa_condo_fee_by_state, "median fee, with a mortgage", "AZ");
  assert.equal(nYes, Math.round((450000 * D_HOME.upkeepRatio.value * 1.0574 / 12 + fee) / 10) * 10, "Yes adds the state's median fee");
  assert.equal(greys(atQ6("patLee"), {}, { hoa: "no" }).rows.housing.value, 120);
  // childcare: asked with no figure until answered; Yes prices a 3-year-old and a 7-year-old in Ohio: (10,552 + 6,162) / 12 =
  // 1,392.8 -> $1,400 (R11: $50 steps from $1,000; 7.H says $1,390); No and Not sure write nothing
  const jb = greys(atQ6("jordan")).rows;
  assert.deepEqual([jb.childcare.value, jb.childcare.ask.key], [null, "childcare"]);
  assert.equal(cell(SPEND.ccaoa2025_childcare_annual_price_by_state, "center:fourYearOld", "OH"), 10552);
  assert.equal(greys(atQ6("jordan"), {}, { childcare: "yes" }).rows.childcare.value, 1400);
  assert.equal(greys(atQ6("jordan"), {}, { childcare: "yes" }).rows.childcare.why, "full-time center care in Ohio for a 3-year-old, after school for a 7");
  for (const no of ["no", "unsure"]) assert.equal(greys(atQ6("jordan"), {}, { childcare: no }).rows.childcare, null);
  // a state Child Care Aware has no figure for (Colorado): NDCP 2022 x CPI to 2025
  assert.equal(SP.careYear("CO", "infant").table, "ndcp2022_childcare_weekly_price_by_state");
  assert.equal(SP.careYear(null, "infant").middle, true, "no state: the middle of the states' prices");
  // health cover: asked while unanswered, then gone
  assert.equal(greys(atQ6("sam")).rows.insurance.ask.key, "health-cover");
  assert.equal(greys(atQ6("sam"), {}, { "health-cover": "unsure" }).rows.insurance.ask, undefined);
});

test("C3 E05 by how cover is had: work (KFF worker share + out of pocket), Medicare, Medicaid, Not sure", () => {
  // through work: S single $139 + out of pocket 90 x k (0.794) = 210; 7.H's $230 adds the out-of-pocket share before R10 scales
  // it, as the flexible part of the row it is; J family $623 + 120 x 0.783 = 717 -> $720 (7.H $740 before R10)
  assert.equal(greys(atQ6("sam"), {}, { "health-cover": "work" }).rows.insurance.value, 160);
  assert.equal(greys(atQ6("jordan"), { childcare: 900 }, { "health-cover": "work" }).rows.insurance.value, 720);
  const s = atQ6("sam"), m = SP.spendModel(s, { today: T0, args: greys(s, {}, { "health-cover": "work" }).args }, lib0(s));
  assert.deepEqual([m.rows.insurance.premium, Math.round(m.rows.insurance.flex)], [139, 26]);
  // Medicare: a 66-year-old in Arizona: Part B 202.90 + Part D base 38.99 + Arizona's Plan G average, plus out of pocket
  const old = atQ6("sam"); old.household.people[0].birthDate = "1960-01-15"; old.household.state = "AZ";
  const om = SP.spendModel(old, { today: T0, args: greys(old, {}, { "health-cover": "public" }).args }, lib0(old));
  near(om.rows.insurance.premium, 202.9 + 38.99 + cell(HEALTH_T.kff_medigap_average_premium_2025, "G", "AZ"), 1e-9, "Medicare");
  // Medicaid (under 65): out of pocket only
  const young = SP.spendModel(s, { today: T0, args: greys(s, {}, { "health-cover": "public" }).args }, lib0(s));
  assert.equal(young.rows.insurance.fixed, 0);
});
import { T as HEALTH_T } from "./data/health.js";

test("C3 a bill typed later on Expenses comes off its row's guess (never counted twice); the rest stay ours", () => {
  const p = atQ6("patLee");
  viaGuess(p, (d, g) => C3.applySpend(d, { mode: "rows", rows: {} }, T0, { guess: g }));
  const before = Object.fromEntries(p.expenses.map((x) => [x.id, x.amount]));
  assert.equal(before["setup-x-groceries"], 780);
  // the person adds a Costco run on Expenses: $300 a month of groceries
  p.expenses.push({ id: "costco", name: "Costco", category: "groceries", amount: 300, period: "monthly", essential: true, inflates: true, startDate: "", endDate: "" });
  const r = settle(p, OPTS);
  // groceries: 784 - 300 = 484 -> $480 (k stays 1); the retirement figure (from 50) follows: the $300 bill counts whole, as
  // every bill on Expenses does, and the row it came off counted 95.3%: 5,390 + 300 - 300 x 0.953 = 5,404 -> $5,400
  assert.deepEqual(r.changed.map((c) => [c.path, c.from, c.to]), [["expenses[setup-x-groceries].amount", 780, 480], ["retirement.spendingMonthly", 5390, 5400]]);
  assert.equal(p.expenses.filter((x) => x.category === "groceries").reduce((t, x) => t + x.amount, 0), 780, "the month's groceries are counted once");
  // removed again: our guess comes back
  p.expenses = p.expenses.filter((x) => x.id !== "costco");
  settle(p, OPTS);
  assert.equal(p.expenses.find((x) => x.id === "setup-x-groceries").amount, 780);
});

test("C3 7.F retirement ratios from the survey by age, and Pat and Lee's figure from 50: $3,790 of costs besides the mortgage, plus its payment", () => {
  assert.deepEqual(Object.fromEntries(Object.entries(SP.RETIRE_RATIO).map(([k, v]) => [k, Math.round(v * 1000) / 1000])), { utilities: 0.88, groceries: 0.953, transport: 0.792, dining: 0.876, shopping: 0.859 });
  const p = atQ6("patLee");
  const { args } = greys(p);
  const e = estimate(p, "overview/setup:retireSpend", { ...OPTS, path: "retirement.spendingMonthly", args });
  // 560 x .880 + 780 x .953 + 960 x .792 + 1,000 x .876 + 930 x .859 = 3,671; + upkeep 120 = about 3,790; + the $1,600
  // mortgage still running when Pat stops at 65 (about 13 years left at its payment), which holds the home's tax and insurance
  // (E22), so they are not added again (C3 review D9: 7.H's "$4,100 + mortgage" adds tax 170-ish and insurance 110-ish on top
  // of the payment that already pays them; the figure is one amount for every year, so that counted them twice for life)
  const r = C3.retireSpendFor(p, { today: T0, args }, lib0(p));
  assert.equal(r.from50, true); assert.equal(r.loans, 1600);
  near(r.value - r.loans, 3790, 30, "7.H $4,100 less the tax and insurance in the payment"); assert.equal(e.value, r.value);
  assert.ok(!/health/i.test(e.why) && e.why.length <= 70);
  // under 50: today's rows without childcare, plus loans then (Sam: the car loan and card are paid off by then)
  const s = atQ6("sam"), sr = C3.retireSpendFor(s, { today: T0, args: greys(s).args }, lib0(s));
  assert.deepEqual([sr.from50, sr.value], [false, 2690]);
});

test("C3 a $15,000 rent is asked about (year-as-month), a $1,500 one is not; the screen's rows cover what the guesses' rows cover", () => {
  const p = atQ6("sam"), g = greys(p).rows.housing;
  const slips = [{ id: "year-as-month", map: (x) => x / 12, words: "" }];
  assert.equal(typoCheck(15000, g, slips)?.slip, "year-as-month");
  assert.equal(typoCheck(1500, g, slips), null);
  assert.deepEqual(Object.fromEntries(C3.SPEND.map((s) => [s.key, s.covers])), SP.COVERS);
  assert.deepEqual(C3.SPEND.map((s) => s.key), SP.ROWS);
});

test("C3 the basis line and E10 (a typed list far below the household's usual total)", () => {
  assert.equal(SP.spendBasis(sam(), { today: T0 }), "The grey figures are what a household like yours usually spends: one adult renting in Texas on about $48,000 a year.");
  assert.equal(SP.spendBasis(atQ6("jordan"), { today: T0 }), "The grey figures are what a household like yours usually spends: one parent of two paying a mortgage in Ohio on about $58,000 a year.");
  const p = atQ6("patLee");
  C3.applySpend(p, { mode: "rows", rows: { housing: 100, groceries: 600, utilities: 300 } });
  const low = SP.missingSpend(p, { today: T0 }, lib0(p));
  assert.ok(low && low.typed < 0.56 * low.guessedTotal, "about $2,600 typed of about $6,900");
  C3.applySpend(p, { mode: "rows", rows: { housing: 120, utilities: 560, groceries: 780, transport: 960, insurance: 910, dining: 1000, shopping: 930 } });
  assert.equal(SP.missingSpend(p, { today: T0 }, lib0(p)), null);
});

// C3 money review D5 (est/c3/c3-review-money.md): the survey's entertainment (streaming and other subscriptions, pets) is in
// "Eating out and fun", its personal care in "Shopping and everything else": a bill typed under those on Expenses comes off
// the row that already holds it, as a groceries bill does (never counted twice)
test("C3 review D5: streaming, pets and personal care typed on Expenses come off the guessed rows that hold them", () => {
  const p = atQ6("patLee");
  viaGuess(p, (d, g) => C3.applySpend(d, { mode: "rows", rows: {} }, T0, { guess: g }));
  const month = () => p.expenses.reduce((t, x) => t + x.amount, 0);
  const before = month(), dining = p.expenses.find((x) => x.id === "setup-x-dining").amount, shopping = p.expenses.find((x) => x.id === "setup-x-shopping").amount;
  const bill = (id, name, category, amount) => ({ id, name, category, amount, period: "monthly", essential: false, inflates: true, startDate: "", endDate: "" });
  p.expenses.push(bill("x1", "Streaming", "subscriptions", 45), bill("x2", "Haircuts", "personal", 60), bill("x3", "Dog", "pets", 120));
  settle(p, OPTS);
  // dining 1,000 - 45 - 120 = 835 -> $840 and shopping 930 - 60 = 870 (k stays 1): the month moves by rounding only
  assert.ok(Math.abs(month() - before) <= 15, `counted once (to R11 rounding): ${before} -> ${month()}`);
  assert.ok(p.expenses.find((x) => x.id === "setup-x-dining").amount <= dining - 160);
  assert.ok(p.expenses.find((x) => x.id === "setup-x-shopping").amount <= shopping - 50);
  // a gift or a trip is not inside a row: it adds to the month
  p.expenses.push(bill("x4", "Birthday gifts", "giving", 50)); const m = month(); settle(p, OPTS);
  assert.equal(month(), m, "a gift moves no guess");
});

// ---- C7 (spec 11.4-11.6, R12): plans made before the guesses fill in what they skipped; the bank files; "Is something missing?"
// A plan made before the guesses: Get started dropped a debt whose balance was left blank (its rate and payment too) and wrote
// nothing for a skipped spending screen. The same household through Get started today, with the same boxes blank, is the
// answer key: one tap on "Use these guesses" must make the same plan (key order aside), and the settle after it moves nothing.
const G7 = await import("./compute.js");
const { compute: dashboard } = await import("../dashboard/compute.js");
const { bankVsPlan } = await import("../../cashflow/income-statement/compute.js");
const { compute: computeExpenses7 } = await import("../../cashflow/expenses/compute.js");
const { cardGapPlan: cardGap7, withVisaFile: withVisa7 } = await import("../../../qa/fixtures/card-gap-plan.mjs");
const OWE7 = { patLee: ["mortgage"], jordan: ["mortgage"], sam: ["car-loan", "credit"] };
const canon7 = (x) => JSON.stringify(x, (k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v));
const bare7 = (p) => { const q = structuredClone(p); delete q.meta; if (q.guide) delete q.guide.fillSkipped; return canon7(q); };
/** Get started before the guesses: Q5b with every owed box blank but Sam's card ($3,000 typed), spending skipped, finished. */
function older7(name) {
  const p = { sam, jordan, patLee }[name](T0);
  C3.applyOweAmounts(p, Object.fromEntries(OWE7[name].map((k) => [k, name === "sam" && k === "credit" ? { owed: "3,000" } : { owed: "" }])), T0);
  C3.applySpend(p, { mode: "rows", rows: {} }, T0);
  C3.markAt(p, "done", T0);
  return p;
}
/** Get started today with the same boxes blank (Sam's card typed the older way, as in the plan above). */
function today7(name) {
  const a = older7(name), p = { sam, jordan, patLee }[name](T0);
  viaGuess(p, (d, g) => C3.applyOweAmounts(d, Object.fromEntries(OWE7[name].map((k) => [k, name === "sam" && k === "credit" ? { owed: "3,000" } : {}])), T0, { guess: g }));
  if (name === "sam") {
    Object.assign(p.debts.find((d) => d.id === "setup-debt-credit"), structuredClone(a.debts.find((d) => d.id === "setup-debt-credit")));
    for (const f of ["rate", "minPayment"]) delete p.guesses[`debts[setup-debt-credit].${f}`];
  }
  viaGuess(p, (d, g) => C3.applySpend(d, { mode: "rows", rows: {} }, T0, { guess: g }));
  C3.markAt(p, "done", T0);
  return p;
}
const acct7 = (p, id) => p.accounts.find((a) => a.id === id);
const debt7 = (p, id) => p.debts.find((d) => d.id === id);

test("C7 11.4: a plan made before the guesses is offered what Get started writes today; 'Use these guesses' makes the same plan", () => {
  for (const name of ["patLee", "jordan", "sam"]) {
    const a = older7(name), b = today7(name), before = structuredClone(a);
    assert.equal(acct7(a, `setup-owe-${OWE7[name][0]}`), undefined, `${name}: the older Get started dropped the debt`);
    assert.equal(a.expenses.length, 0);
    const offers = G7.fillOffers(a, OPTS);
    assert.deepEqual(a, before, "working the card out writes nothing");
    const debts = offers.filter((x) => x.case === "debt");
    assert.deepEqual(debts.map((x) => x.key), OWE7[name].filter((k) => !(name === "sam" && k === "credit")), `${name}: the dropped debts (Sam's typed card is there)`);
    for (const x of debts) {
      assert.equal(x.owed, acct7(b, `setup-owe-${x.key}`).balance, `${name} ${x.key} owed`);
      assert.equal(x.rate, debt7(b, `setup-debt-${x.key}`).rate, `${name} ${x.key} rate`);
      assert.equal(x.payment, debt7(b, `setup-debt-${x.key}`).minPayment, `${name} ${x.key} payment`);
      assert.equal(x.home, x.key === "mortgage" && !acct7(a, "setup-have-home") ? acct7(b, "setup-have-home").balance : null, `${name}: the home's value only with no home in the plan`);
    }
    const s = offers.find((x) => x.case === "spend");
    assert.deepEqual(s.rows.map((r) => [r.row, r.value]), b.expenses.filter((x) => x.id.startsWith("setup-x-")).map((x) => [x.id.slice(8), x.amount]), `${name}: the rows`);
    assert.equal(s.total, s.rows.reduce((t, r) => t + r.value, 0));
    assert.equal(s.retire, b.retirement.spendingMonthly, `${name}: spending once work stops`);
    // the tap (inside store.update: the settle after it)
    assert.equal(G7.useFillGuesses(a, OPTS), offers.length);
    assert.deepEqual(settle(a, OPTS).changed, [], `${name}: the settle after the tap moves nothing`);
    assert.equal(bare7(a), bare7(b), `${name}: the plan Get started makes today`);
    assert.deepEqual(a.guide.fillSkipped, { at: T0, choice: "used" });
    assert.deepEqual(G7.fillOffers(a, OPTS), [], "nothing left to fill");
  }
  // Jordan's home (picked on question 4, its value asked with the mortgage on question 5): the card adds it, as our guess
  const j = older7("jordan"); G7.useFillGuesses(j, OPTS);
  assert.deepEqual([acct7(j, "setup-have-home").type, isGuessIn(j, "accounts[setup-have-home].balance")], ["property", true]);
  // with no home picked, it is added to "what you have" as question 5 adds it
  const j2 = older7("jordan"); j2.guide.setup.picks.have = ["checking"]; G7.useFillGuesses(j2, OPTS);
  assert.deepEqual([j2.guide.setup.picks.have, j2.guide.setup.homeFromOwe], [["checking", "home"], true]);
});

test("C7 11.4: what is not offered (kept elsewhere, paid in full, Get started not past the question, none, outside the U.S., spending there)", () => {
  const kinds = (p, o = OPTS) => G7.fillOffers(p, o).map((x) => (x.case === "debt" ? x.key : x.case));
  assert.deepEqual(kinds(older7("sam")), ["car-loan", "spend"]);
  // a car loan added on What you owe after Get started: it is the one picked
  const kept = older7("sam"); kept.accounts.push({ id: "acct-car", name: "Honda auto loan", type: "loan", balance: 9000, asOf: T0, institution: "", ownerId: "", history: [], notes: "" });
  assert.deepEqual(kinds(kept), ["spend"]);
  // another loan (not a car's) does not stand in for the car loan
  const other = older7("sam"); other.accounts.push({ id: "acct-x", name: "Personal loan", type: "loan", balance: 2000, asOf: T0, institution: "", ownerId: "", history: [], notes: "" });
  assert.deepEqual(kinds(other), ["car-loan", "spend"]);
  // a card picked and "I pay it in full" (no balance on purpose)
  const full = { sam }.sam(T0);
  C3.applyOweAmounts(full, { "car-loan": { owed: "" }, credit: { paidInFull: true } }, T0); C3.markAt(full, "done", T0);
  assert.deepEqual(kinds(full), ["car-loan", "spend"]);
  // Get started stopped on the debts' screen: it asks them itself when the person goes back
  const mid = older7("jordan"); delete mid.guide.setup.finishedAt; mid.guide.setup.at = "owe-amounts";
  assert.deepEqual(kinds(mid), []);
  mid.guide.setup.at = "spend"; assert.deepEqual(kinds(mid), ["mortgage"], "past the debts, not past the spending");
  mid.guide.setup.at = "goals"; assert.deepEqual(kinds(mid), ["mortgage", "spend"]);
  const none = older7("jordan"); none.guide.setup.picks.owe = ["none"]; assert.deepEqual(kinds(none), ["spend"]);
  // outside the U.S. or not in dollars: nothing
  const eur = older7("jordan"); eur.meta.currency = "EUR"; assert.deepEqual(kinds(eur), []);
  const out = older7("jordan"); out.guide.setup.outsideUS = true; assert.deepEqual(kinds(out), []);
  // spending: a bill, a bank line, no pay, pay that has ended
  const bill = older7("jordan"); bill.expenses.push({ id: "x1", name: "Rent", category: "housing", amount: 900, period: "monthly", inflates: true, startDate: "", endDate: "" });
  assert.deepEqual(kinds(bill), ["mortgage"]);
  const bank = older7("jordan"); bank.transactions = [{ id: "t1", date: "2026-10-03", amount: -40, payee: "Shell", accountId: "setup-have-checking", category: "transport" }];
  assert.deepEqual(kinds(bank), ["mortgage"]);
  const nopay = older7("jordan"); nopay.income = []; assert.deepEqual(kinds(nopay), ["mortgage"]);
  const ended = older7("jordan"); for (const x of ended.income) x.endDate = "2026-06-30"; assert.deepEqual(kinds(ended), ["mortgage"]);
  // a row typed as 0 on Get started stays the person's 0; childcare is offered only once its question says Yes (none here)
  const zero = older7("sam"); zero.guide.setup.spendZero = ["dining"];
  assert.ok(!G7.fillOffers(zero, OPTS).find((x) => x.case === "spend").rows.some((r) => r.row === "dining"));
  assert.ok(!G7.fillOffers(older7("jordan"), OPTS).find((x) => x.case === "spend").rows.some((r) => r.row === "childcare"));
});

test("C7 11.4: 'Not now' writes only guide.fillSkipped and the card is back after 30 days; after 'Use', a debt removed stays removed", () => {
  const a = older7("patLee"), before = structuredClone(a);
  G7.fillLater(a, T0);
  assert.deepEqual(a.guide.fillSkipped, { at: T0, choice: "later" });
  delete a.guide.fillSkipped; assert.deepEqual(a, before, "nothing else was written");
  G7.fillLater(a, T0);
  assert.equal(G7.FILL_AGAIN_DAYS, 30);
  assert.deepEqual(G7.fillOffers(a, { ...OPTS, today: "2026-12-01" }), [], "29 days on");
  assert.equal(G7.fillOffers(a, { ...OPTS, today: "2026-12-02" }).length, 2, "30 days on: the mortgage and the spending again");
  // used, then the person removes the mortgage and every bill: the card does not put them back
  const u = older7("patLee"); G7.useFillGuesses(u, OPTS);
  u.accounts = u.accounts.filter((x) => x.id !== "setup-owe-mortgage"); u.debts = []; u.expenses = [];
  assert.deepEqual(G7.fillOffers(u, OPTS), []);
  // a plan built on the pages (no Get started): its spending is offered, with nothing written for retirement
  const pages = older7("sam"); delete pages.guide.setup; const r0 = structuredClone(pages.retirement);
  const offers = G7.fillOffers(pages, OPTS);
  assert.deepEqual(offers.map((x) => x.case), ["spend"]);
  assert.equal(offers[0].retire, null);
  G7.useFillGuesses(pages, OPTS);
  assert.deepEqual(pages.retirement, r0);
  assert.ok(pages.expenses.length >= 6 && pages.expenses.every((x) => isGuessIn(pages, `expenses[${x.id}].amount`)));
});

test("C7 11.3: the Dashboard's cards (key only with a day; one at a time: fill, then missing, then the better guesses); nothing is written", () => {
  const a = older7("patLee"), before = structuredClone(a);
  assert.equal("guesses" in dashboard(a), false, "the shell's own compute (no day) is as before");
  const d = dashboard(a, OPTS);
  assert.deepEqual(a, before);
  assert.equal(d.guesses.first, "fill");
  assert.deepEqual(d.guesses.fill, G7.fillOffers(a, OPTS));
  assert.equal(page(a).offers.fill.length, 2, "the page's offers.fill");
  // a typed list far too short: "Is something missing?"
  const m = atQ6("patLee"); C3.applySpend(m, { mode: "rows", rows: { housing: 100, groceries: 600, utilities: 300 } }, T0); C3.markAt(m, "done", T0);
  const dm = dashboard(m, OPTS).guesses;
  assert.equal(dm.first, "missing"); assert.deepEqual(dm.fill, []);
  // older Get started flags only: the better guesses
  assert.equal(dashboard(guessedPlan(T0), OPTS).guesses.first, "upgrade");
  // a plan with nothing to offer has no key at all
  const done = today7("patLee");
  assert.equal("guesses" in dashboard(done, OPTS), false);
});

// R12: Pat and Lee (all rows ours) bring in their checking account's files. A month: pay $8,000 in; the mortgage's own $1,600
// (on Debts: left out of the rows); home things 90; power 180 + phone 150; groceries 4 x (200 + 50k); gas 120; insurance 180 +
// pharmacy 40; dining 60 + streaming 20; Target 150 + ATM 100 ("other": everything else) + 50 with no kind; $500 to savings
// (a transfer) and $300 of tax (neither is spending); the second month a $30 refund at Target. (k = 0 the older month)
const BANK7 = (ym, k) => [
  [`${ym}-01`, "ACME PAYROLL", 8000, "income-salary"], [`${ym}-02`, "WELLS FARGO HOME MTG", -1600, "housing"], [`${ym}-03`, "HOME DEPOT", -90, "housing"],
  [`${ym}-05`, "APS ELECTRIC", -180, "utilities"], [`${ym}-06`, "VERIZON WIRELESS", -150, "phone"],
  ...[7, 14, 21, 28].map((d) => [`${ym}-${d}`, "SAFEWAY", -200 - 50 * k, "groceries"]),
  [`${ym}-09`, "SHELL", -120, "transport"], [`${ym}-10`, "STATE FARM", -180, "insurance"], [`${ym}-11`, "CVS PHARMACY", -40, "health"],
  [`${ym}-12`, "CHIPOTLE", -60, "dining"], [`${ym}-13`, "NETFLIX", -20, "subscriptions"],
  [`${ym}-15`, "TARGET", -150, "shopping"], [`${ym}-16`, "ATM WITHDRAWAL", -100, "other"], [`${ym}-17`, "SQ COFFEE", -50, null],
  [`${ym}-18`, "Transfer to savings", -500, "transfer"], [`${ym}-20`, "IRS USATAXPYMT", -300, "taxes"],
  ...(k ? [[`${ym}-25`, "TARGET REFUND", 30, "shopping"]] : []),
];
function withBank7(p, months, { lines = BANK7, file = true } = {}) {
  p.accounts.push({ id: "bank-chk", name: "Checking", type: "checking", balance: 5000, asOf: T0, institution: "", ownerId: "", history: [], notes: "" });
  p.transactions = []; p.imports = [];
  months.forEach((ym, k) => { for (const [date, payee, amount, category] of lines(ym, k)) p.transactions.push({ id: `t${p.transactions.length}`, date, amount, payee, rawPayee: payee, accountId: "bank-chk", category, tags: [], note: "", importId: "imp-1" }); });
  const [y, m] = months[months.length - 1].split("-").map(Number);
  if (file) p.imports.push({ id: "imp-1", accountId: "bank-chk", from: `${months[0]}-01`, to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10), at: T0, rows: p.transactions.length });
  return p;
}
const spendPath7 = (row) => `expenses[setup-x-${row}].amount`;
const ours7 = () => { const p = atQ6("patLee"); viaGuess(p, (d, g) => C3.applySpend(d, { mode: "rows", rows: {} }, T0, { guess: g })); return p; };
const rows7 = (p) => Object.fromEntries(p.expenses.filter((x) => x.id.startsWith("setup-x-")).map((x) => [x.id.slice(8), x.amount]));

test("C7 R12: two whole months of bank files replace the guessed rows (transfers, tax and the mortgage left out); the plan's month is the bank's", () => {
  const was = rows7(ours7());
  assert.deepEqual(was, { housing: 120, utilities: 560, groceries: 780, transport: 960, insurance: 640, dining: 1000, shopping: 930 }, "the survey's rows");
  const p = withBank7(ours7(), ["2026-09", "2026-10"]);
  const b = SP.bankSpend(p, T0, { rows: ROWS7H });
  assert.deepEqual([b.on, b.months], [true, ["2026-10", "2026-09"]]);
  // groceries (800 + 1,000) / 2 = 900; shopping (150 + 100 + 50) + (150 + 100 + 50 - 30) over 2 = 285; the mortgage's 1,600 apart
  assert.deepEqual(b.byRow, { housing: 90, utilities: 330, groceries: 900, transport: 120, insurance: 220, dining: 80, shopping: 285 });
  assert.deepEqual([b.out, b.mortgage], [2025, 1600]);
  // the bank files come in (store.update): settle moves every row of ours to its bank figure (R11: shopping 285 -> 290)
  settle(p, OPTS);
  assert.deepEqual(rows7(p), { housing: 90, utilities: 330, groceries: 900, transport: 120, insurance: 220, dining: 80, shopping: 290 });
  const e = estimate(p, "spend.groceries", { ...OPTS, path: spendPath7("groceries") });
  assert.deepEqual([e.why, e.sigma, e.basis, e.tables], ["your bank files, September and October", 0.15, "yours", []]);
  assert.equal(SP.spendBasis(p, { today: T0 }), "The grey figures are what your bank files show going out on each, a month over September and October.");
  // the person's own months: the left-over figure does not wait on them (Expenses' share of the month that is our guesses)
  assert.equal(p.guesses[spendPath7("groceries")].s, 0.15);
  assert.equal(computeExpenses7(p, { today: T0 }).guessedMonthly, undefined, "no row is a survey guess now");
  assert.ok(computeExpenses7(ours7(), { today: T0 }).guessedShare > 0.5, "before the bank files: mostly our guesses");
  // Expenses' bank card: the bank's month (with the mortgage) and the plan's agree to R11's rounding; no line to add
  const v = bankVsPlan(p, { today: T0 });
  assert.equal(v.months, 2); near(v.bankOut, 2025 + 1600, 1e-9, "bank"); near(v.gap, 0, 10, "gap");
  assert.equal(v.over, false);
  assert.ok(!v.lines.some((l) => l.category === "housing"), "the mortgage's own payment is not 'more spent on the home'");
  // a row the person typed stays theirs; a bill typed on Expenses in a row's kinds comes off its bank figure (never twice)
  const q = withBank7(ours7(), ["2026-09", "2026-10"]);
  q.expenses.push({ id: "netflix", name: "Netflix", category: "subscriptions", amount: 20, period: "monthly", essential: false, inflates: true, startDate: "", endDate: "" });
  saveField(q, "expenses[setup-x-groceries].amount", { value: 650 }, null, T0);
  settle(q, OPTS);
  assert.deepEqual([rows7(q).groceries, rows7(q).dining], [650, 60]);
});

test("C7 R12: one month, a month mostly not filed under a kind, or months the files do not cover leave the survey's rows", () => {
  const one = withBank7(ours7(), ["2026-10"]);
  assert.equal(SP.bankSpend(one, T0, { rows: ROWS7H }).on, false);
  assert.deepEqual(settle(one, OPTS).changed, [], "one month: nothing moves");
  // September's lines all without a kind: it is not read, so only October counts
  const loose = withBank7(ours7(), ["2026-09", "2026-10"], { lines: (ym, k) => BANK7(ym, k).map((l) => (k === 0 ? [l[0], l[1], l[2], l[2] < 0 && l[3] !== "transfer" ? null : l[3]] : l)) });
  const lb = SP.bankSpend(loose, T0, { rows: ROWS7H });
  assert.deepEqual([lb.whole.length, lb.months, lb.on], [2, ["2026-10"], false]);
  assert.equal(SP.BANK.uncategorised, 0.1);
  // no import record and a gap in the lines: September is not whole
  const holes = withBank7(ours7(), ["2026-09", "2026-10"], { file: false, lines: (ym, k) => BANK7(ym, k).filter((l) => !(k === 0 && l[0] < `${ym}-12`)) });
  assert.equal(SP.bankSpend(holes, T0, { rows: ROWS7H }).on, false);
  // the month still running is never read
  assert.equal(SP.bankSpend(withBank7(ours7(), ["2026-10", "2026-11"]), "2026-11-20", { rows: ROWS7H }).on, false);
  // a transfer is never spending, by its kind or its pair
  const t = withBank7(ours7(), ["2026-09", "2026-10"]);
  t.transactions.push({ id: "tx-pair", date: "2026-10-19", amount: -700, payee: "To brokerage", accountId: "bank-chk", category: "shopping", transferId: "tx-pair-2" });
  assert.equal(SP.bankSpend(t, T0, { rows: ROWS7H }).byRow.shopping, 285);
  // money paid to a card whose own file is not in (the sample family's Visa): its purchases are in no file, so those months
  // are not read, though the ledger calls them whole; with the Visa's file in, they are
  const cg = SP.bankSpend(cardGap7(T0), T0);
  assert.deepEqual([cg.whole, cg.months, cg.on], [["2026-10", "2026-09"], [], false]);
  assert.deepEqual(SP.bankSpend(withVisa7(cardGap7(T0), "2026-08-20", "2026-10-31"), T0).months, ["2026-10", "2026-09"]);
  // kinds map to rows as Expenses holds them; a kind in no row is "everything else"
  assert.deepEqual(["phone", "health", "pets", "personal", "travel", "giving", "other", "my-own"].map((c) => SP.bankRowOf(c)), ["utilities", "insurance", "dining", "shopping", "shopping", "shopping", "shopping", "shopping"]);
  assert.equal(SP.bankRowOf("childcare", ROWS7H), "shopping", "childcare with no children listed");
});

// E10: Pat and Lee's household total with every row ours is G (their rows plus the $1,600 mortgage); bills typed on Expenses in
// rows' kinds come off those rows, so G stays put while the typed month grows (k stays 1 for them). The line is 0.5585 G.
const missing7 = (bills) => {
  const p = atQ6("patLee"); C3.markAt(p, "done", T0);
  for (const [category, amount] of Object.entries(bills)) p.expenses.push({ id: `b-${category}`, name: category, category, amount, period: "monthly", essential: true, inflates: true, startDate: "", endDate: "" });
  return p;
};
test("C7 11.6: 'Is something missing?' only when the spending is typed, under 0.5585 of the usual total, with under two months of bank files", () => {
  near(SP.MISSING_LINE, 0.5585, 0.0001, "exp(-2.33 x 0.25)");
  const base = { transport: 700, insurance: 300, dining: 500, shopping: 300 };
  const first = G7.spendMissing(missing7(base), OPTS);
  assert.ok(first, "1,800 + the 1,600 mortgage typed");
  const G = first.usual, line = G * SP.MISSING_LINE;
  assert.equal(first.typed, 1600 + 1800);
  // a dollar under the line: asked; at it (to the cent) and a dollar past it: not
  const at = (d) => G7.spendMissing(missing7({ ...base, shopping: 300 + (line - 3400) + d }), OPTS);
  const under = at(-1);
  assert.ok(under, "a dollar under"); near(under.usual, G, 0.01, "G stays put");
  assert.equal(at(0.01), null, "at the line"); assert.equal(at(1), null, "a dollar past");
  // the rows it would add: Get started's rows with no bill of their kinds (housing, utilities, groceries; no children)
  assert.deepEqual(under.rows.map((r) => r.row), ["housing", "utilities", "groceries"]);
  assert.equal(under.rows.find((r) => r.row === "housing").name, "Home costs");
  // condition 1: a row of ours, or one rough total, ends it
  const g = missing7(base); viaGuess(g, (d, gg) => C3.applySpend(d, { mode: "rows", rows: { transport: 700, insurance: 300, dining: 500, shopping: 300 } }, T0, { guess: gg }));
  assert.ok(g.expenses.some((x) => isGuessIn(g, `expenses[${x.id}].amount`)));
  assert.equal(G7.spendMissing(g, OPTS), null, "a row is our guess");
  const rough = atQ6("patLee"); C3.applySpend(rough, { mode: "total", total: 2000 }, T0);
  assert.equal(G7.spendMissing(rough, OPTS), null, "one rough total");
  // condition 3: bank files of two whole months (the bank card on Expenses speaks then); one month does not stop it
  assert.equal(G7.spendMissing(withBank7(missing7(base), ["2026-09", "2026-10"]), OPTS), null);
  assert.ok(G7.spendMissing(withBank7(missing7(base), ["2026-10"]), OPTS));
  // "That's everything" ends it; nothing typed at all is the fill card's, not this one's
  const c = missing7(base); G7.spendIsComplete(c, T0);
  assert.equal(c.guide.spendComplete, T0); assert.equal(G7.spendMissing(c, OPTS), null);
  assert.equal(G7.spendMissing(atQ6("patLee"), OPTS), null);
});

test("C7 11.6: 'Add our guesses for the rest' writes only those rows, as Get started writes them; the settle after moves nothing", () => {
  const p = missing7({ transport: 700, insurance: 300, dining: 500, shopping: 300 }), before = structuredClone(p);
  const m = G7.spendMissing(p, OPTS);
  assert.deepEqual(p, before);
  assert.equal(G7.addSpendGuesses(p, OPTS), 3);
  assert.deepEqual(settle(p, OPTS).changed, []);
  assert.deepEqual(p.expenses.slice(0, 4), before.expenses.slice(0, 4), "the bills typed stay as typed");
  for (const r of m.rows) {
    const x = p.expenses.find((e) => e.id === `setup-x-${r.row}`);
    assert.equal(x.amount, r.value); assert.ok(isGuessIn(p, `expenses[setup-x-${r.row}].amount`));
    const row = C3.SPEND.find((s) => s.key === r.row);
    assert.deepEqual([x.category, x.period, x.inflates], [r.row, "monthly", true]);
    assert.equal(x.essential, row.group === "must");
  }
  assert.equal(G7.spendMissing(p, OPTS), null, "with a row of ours it is answered");
});

// The qa retirees own their home outright and typed "Property tax" under taxes and "Home and car insurance" under insurance:
// the home costs row (upkeep + property tax + insurance with no mortgage) must not count those two again, or "Is something
// missing?" offers them a second time (it did: $430 of home costs, $300 of it the tax and insurance they had typed).
test("C7: property tax or home insurance typed under another kind comes off the home costs guess, never counted twice", () => {
  const p = migrate(retiredCouplePlan());
  const bill = (q, name) => q.expenses.find((x) => x.name === name);
  assert.deepEqual([bill(p, "Property tax").category, bill(p, "Home and car insurance").category], ["taxes", "insurance"]);
  const esc = escrowMonthly(p, { today: T0 }, lib0(p));
  assert.ok(esc.tax > 50 && esc.insurance > 50, "no mortgage: both parts are in the row");
  const without = (...names) => { const q = structuredClone(p); q.expenses = q.expenses.filter((x) => !names.includes(x.name)); return q; };
  const full = guessOf(without("Property tax", "Home and car insurance"), "spend.housing");
  assert.match(full.why, /upkeep, property tax and insurance/);
  const both = guessOf(p, "spend.housing");
  near(full.value - both.value, esc.total, 10, "both parts typed: only the upkeep is left");
  assert.match(both.why, /^upkeep/); assert.doesNotMatch(both.why, /property tax|insurance/);
  const taxOnly = guessOf(without("Home and car insurance"), "spend.housing");
  near(full.value - taxOnly.value, esc.tax, 10, "the property tax part"); assert.match(taxOnly.why, /^upkeep and insurance/);
  const insOnly = guessOf(without("Property tax"), "spend.housing");
  near(full.value - insOnly.value, esc.insurance, 10, "the insurance part"); assert.match(insOnly.why, /^upkeep and property tax/);
  // a bill bigger than the part takes off that part only; a car insurance bill or another tax is not the home's
  const big = without("Home and car insurance"); bill(big, "Property tax").amount = 60000;
  near(full.value - guessOf(big, "spend.housing").value, esc.tax, 10, "never past the part");
  const other = without("Property tax", "Home and car insurance");
  other.expenses.push({ id: "b-car", name: "Car insurance", category: "insurance", amount: 900, period: "annual", essential: true, inflates: true, startDate: "", endDate: "" },
    { id: "b-irs", name: "Quarterly tax payments", category: "taxes", amount: 2000, period: "quarterly", essential: true, inflates: false, startDate: "", endDate: "" });
  assert.equal(guessOf(other, "spend.housing").value, full.value);
  // the card: their list ($2,780: no car costs past the insurance, no clothes, no upkeep) sits just under the line, so it is
  // asked, and offers the car less the car insurance they typed ("Home and car insurance" past the home's part; C7 review M7)
  const m = G7.spendMissing(p, OPTS);
  assert.deepEqual(m.rows.map((r) => r.row), ["housing", "transport", "shopping"]);
  assert.ok(m.rows.find((r) => r.row === "transport").value < estimate(without("Home and car insurance"), "spend.transport", { ...OPTS, path: spendPath7("transport"), args: { mode: "rows", rows: { transport: null } } }).value - 200, "the car's insurance is not offered again");
});

test("C7: the cards write records as Get started does (its debts, rows and names agree)", () => {
  assert.deepEqual(G7.OWE_KINDS, C3.OWE.map(({ key, type, name }) => ({ key, type, name })));
  assert.deepEqual(Object.keys(SP.ROW_NAME), C3.SPEND.map((s) => s.key));
  for (const s of C3.SPEND) if (s.key !== "housing") assert.equal(SP.ROW_NAME[s.key], s.label, s.key);
  assert.deepEqual(SP.MUST, C3.SPEND.filter((s) => s.group === "must").map((s) => s.key));
  for (const p of [sam(T0), jordan(T0), patLee(T0)]) assert.equal(SP.housingName(p), C3.housingWords(p).name);
  assert.equal(SP.householdWords(sam(), { today: T0 }), "one adult renting in Texas on about $48,000 a year");
});

test("C7 the cards on the guesses page: 'Use these guesses' and 'Not now' write through store.update and say so", async () => {
  const pg = await drawPage(older7("jordan"));
  let root = pg.draw();
  const titled = (g, r, t) => g.all(r, (n) => n.tag === "section" && n.kids.some((k) => k?.tag === "h2" && g.text(k).trim() === t))[0];
  const card = () => titled(pg, root, "Fill in what you skipped");
  const c = card();
  assert.ok(c, "the card is drawn");
  // $910, not $920: the purchase loan's own principal and interest (loans lane 1, item 4; the C2 7.H test above)
  assert.match(pg.text(c), /Mortgage about \$110,000 owed \$910 a month at 4\.4% a year Your home: worth about \$210,000 Our guess: typical in 2020 with 10% paid up front, then paid down since\./);
  assert.match(pg.text(c), /Day-to-day spending \(not the mortgage\) about \$3,260 a month Our guess: typical for one parent of two paying a mortgage in Ohio on about \$58,000 a year\./);
  assert.match(pg.text(c), /Nothing changes until you tap\./);
  const btn = (n, label) => pg.all(n, (x) => x.tag === "button" && pg.text(x).trim() === label)[0];
  assert.match(btn(c, "Not now").attrs.class, /secondary/);
  btn(c, "Not now").attrs.onClick();
  assert.equal(pg.plan().guide.fillSkipped.choice, "later");
  assert.equal(pg.plan().accounts.some((a) => a.id === "setup-owe-mortgage"), false, "nothing else");
  root = pg.draw();
  assert.equal(pg.text(pg.all(root, (n) => /notice ok/.test(n.attrs.class ?? ""))[0]).trim(), "Nothing was changed. We'll ask again in a month; Our guesses for you keeps them until then.");
  // (C7 UX review 7) not at the top any more, but kept here folded, so the page never says there is nothing to look over
  const fold = pg.all(root, (n) => n.tag === "details" && /^Skipped for now: your mortgage and your spending/.test(pg.text(n).trim()))[0];
  assert.ok(fold, "the skipped offers stay on the page, folded");
  assert.ok(pg.all(fold, (n) => n.tag === "section" && /Fill in what you skipped/.test(pg.text(n)))[0], "with the card inside");
  assert.doesNotMatch(pg.text(root), /Every figure in your plan is one you typed/);
  // the tap that fills them in
  const pg2 = await drawPage(older7("jordan"));
  root = pg2.draw();
  const c2 = titled(pg2, root, "Fill in what you skipped");
  pg2.all(c2, (x) => x.tag === "button" && pg2.text(x).trim() === "Use these guesses")[0].attrs.onClick();
  assert.ok(pg2.plan().accounts.some((a) => a.id === "setup-owe-mortgage"));
  assert.ok(pg2.plan().expenses.length >= 6);
  root = pg2.draw();
  assert.equal(pg2.text(pg2.all(root, (n) => /notice ok/.test(n.attrs.class ?? ""))[0]).trim(), "Saved: your mortgage (about $110,000 owed) and about $3,260 a month of spending are counted now. Type the real figures on Expenses and Debts when you have them.");
});

test("C7 R12 on the page: a row read from the bank files says where it comes from, not 'Our guess'", async () => {
  const p = withBank7(ours7(), ["2026-09", "2026-10"]); settle(p, OPTS);
  const pg = await drawPage(p), root = pg.draw();
  const row = pg.all(root, (n) => n.tag === "li" && /^Groceries/.test(pg.text(n).trim()))[0];
  assert.match(pg.text(row), /From your bank files, September and October\./);
  assert.doesNotMatch(pg.text(row), /Our guess:/);
});

// ---- C7 fix (reviews of 2026-11-06: money M1-M9). Each test failed on the C7 build before its fix.
/** A bank file on an account of its own: `lines(ym, k)` -> [date, payee, amount, category]; one import record over whole months. */
function file7(p, id, type, months, lines, { name = id } = {}) {
  p.accounts.push({ id, name, type, balance: type === "credit" ? 0 : 5000, asOf: T0, institution: "", ownerId: "", history: [], notes: "" });
  p.transactions = p.transactions ?? []; p.imports = p.imports ?? [];
  let n = 0;
  months.forEach((ym, k) => { for (const [date, payee, amount, category] of lines(ym, k)) { p.transactions.push({ id: `${id}-t${p.transactions.length}`, date, amount, payee, rawPayee: payee, accountId: id, category, tags: [], note: "", importId: `imp-${id}` }); n++; } });
  const [y, m] = months[months.length - 1].split("-").map(Number);
  p.imports.push({ id: `imp-${id}`, accountId: id, from: `${months[0]}-01`, to: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10), at: T0, rows: n });
  return p;
}
const ours7S = () => { const p = atQ6("sam"); viaGuess(p, (d, g) => C3.applySpend(d, { mode: "rows", rows: {} }, T0, { guess: g })); return p; };
const sOf = (p, row) => p.guesses?.[spendPath7(row)]?.s ?? null;

test("C7 fix M1a: a card's own file alone reads no month (no checking file covers it): every row keeps our figure", () => {
  const p = ours7S(), was = rows7(p);
  file7(p, "visa", "credit", ["2026-09", "2026-10"], (ym) => [
    ...[3, 10, 17, 24].map((d) => [`${ym}-${String(d).padStart(2, "0")}`, "KROGER", -60, "groceries"]),
    [`${ym}-05`, "SHELL", -45, "transport"], [`${ym}-12`, "CHIPOTLE", -30, "dining"], [`${ym}-20`, "TARGET", -80, "shopping"],
    [`${ym}-28`, "PAYMENT THANK YOU", 400, "transfer"]], { name: "Visa" });
  const b = SP.bankSpend(p, T0);
  assert.equal(b.on, false, "the rent, power and insurance are paid from checking, whose file is not in");
  assert.deepEqual(b.months, []);
  assert.deepEqual(settle(p, OPTS).changed, [], "nothing moves: rent stays $1,200, not $0 'from your bank'");
  assert.deepEqual(rows7(p), was);
  assert.equal(b.held?.kind, "no-checking", "the reason is said");
});

test("C7 fix M1b: money to a card that is in no file and not in the plan leaves the month unread (filed as a payment or a transfer)", () => {
  for (const [payee, cat] of [["CHASE CREDIT CRD AUTOPAY", "debt"], ["CHASE CREDIT CRD AUTOPAY", "transfer"], ["CITI AUTOPAY PAYMENT", "debt"], ["AMEX EPAYMENT ACH PMT", "debt"], ["DISCOVER E-PAYMENT", "debt"]]) {
    const p = ours7(), was = rows7(p);
    withBank7(p, ["2026-09", "2026-10"], { lines: (ym, k) => [...BANK7(ym, k), [`${ym}-25`, payee, -3200, cat]] });
    const b = SP.bankSpend(p, T0, { rows: ROWS7H });
    assert.deepEqual([b.on, b.months], [false, []], `${payee} [${cat}]: what the card bought is in no file`);
    assert.equal(b.held?.kind, "unknown-card", payee);
    settle(p, OPTS);
    assert.deepEqual(rows7(p), was, `${payee}: our rows stay ($6,860 a month, not $1,930)`);
  }
  // a loan on Debts paid from checking is not a card (Sam's car loan, $420): the months are read
  const s = ours7S();
  file7(s, "chk", "checking", ["2026-09", "2026-10"], (ym) => [[`${ym}-01`, "ACME PAYROLL", 3000, "income-salary"], [`${ym}-03`, "CAMDEN APTS RENT", -1150, "housing"],
    [`${ym}-08`, "TOYOTA MOTOR CREDIT", -420, "debt"], [`${ym}-12`, "TXU ENERGY", -110, "utilities"], [`${ym}-14`, "KROGER", -300, "groceries"], [`${ym}-16`, "SHELL", -90, "transport"],
    [`${ym}-18`, "GEICO", -120, "insurance"], [`${ym}-20`, "CHIPOTLE", -80, "dining"], [`${ym}-22`, "TARGET", -140, "shopping"], [`${ym}-30`, "INTEREST PAID", 0.05, "income-interest"]]);
  assert.equal(SP.bankSpend(s, T0).on, true);
});

test("C7 fix M1c: a row the bank files show nothing for keeps our figure (not in these files is not $0)", () => {
  const p = withBank7(ours7(), ["2026-09", "2026-10"], { lines: (ym, k) => BANK7(ym, k).filter((l) => !["insurance", "health"].includes(l[3])) });
  settle(p, OPTS);
  const r = rows7(p);
  assert.equal(r.groceries, 900, "a row the files show is theirs");
  assert.ok(r.insurance >= 300, `insurance and health keeps our figure: ${r.insurance}`);
  assert.equal(sOf(p, "insurance"), 0.25, "still our guess (the waiting verdict counts it)");
  assert.equal(sOf(p, "groceries"), 0.15);
  assert.match(estimate(p, "spend.insurance", { ...OPTS, path: spendPath7("insurance") }).why, /health cover/);
});

test("C7 fix M2: a servicer's line with no 'mortgage' in its name, beside a different payment on Debts, is the mortgage (counted once)", () => {
  for (const [servicer, onDebts, paid] of [["MR COOPER", 1300, 1600], ["PENNYMAC LOAN SVC", 1500, 1900], ["WELLS FARGO HOME MTG", 1300, 1600]]) {
    const p = ours7(); p.debts.find((d) => d.id === "setup-debt-mortgage").minPayment = onDebts; settle(p, OPTS);
    withBank7(p, ["2026-09", "2026-10"], { lines: (ym, k) => BANK7(ym, k).map((l) => (l[1] === "WELLS FARGO HOME MTG" ? [l[0], servicer, -paid, "housing"] : l)) });
    const b = SP.bankSpend(p, T0, { rows: ROWS7H });
    // home costs: the bank's other housing ($90) plus what goes to the servicer beyond the payment on Debts (its tax and
    // insurance, or a payment typed low): the plan's month is then the bank's
    assert.deepEqual([b.byRow.housing, b.mortgage], [90 + paid - onDebts, paid], servicer);
    settle(p, OPTS);
    const v = bankVsPlan(p, { today: T0 });
    near(v.gap, 0, 10, `${servicer}: the plan's month is the bank's`);
    assert.ok(!v.lines.some((l) => ["housing", "debt"].includes(l.category)), `${servicer}: no line for the home or the loan`);
  }
});

test("C7 fix M3: a line with no kind that is a bill typed (rent by check) is that bill, counted once; at most a tenth of a month unfiled", () => {
  assert.equal(SP.BANK.uncategorised, 0.1);
  const p = atQ6("sam");
  viaGuess(p, (d, g) => C3.applySpend(d, { mode: "rows", rows: { housing: 1200 } }, T0, { guess: g }));
  file7(p, "chk", "checking", ["2026-09", "2026-10"], (ym) => [
    [`${ym}-01`, "ACME PAYROLL", 1850, "income-salary"], [`${ym}-02`, "CHECK 1043", -1200, null],
    [`${ym}-05`, "TXU ENERGY", -120, "utilities"], [`${ym}-06`, "T-MOBILE", -60, "phone"], ...[4, 11, 18, 25].map((d) => [`${ym}-${String(d).padStart(2, "0")}`, "KROGER", -70, "groceries"]),
    [`${ym}-09`, "SHELL", -80, "transport"], [`${ym}-10`, "GEICO", -130, "insurance"], [`${ym}-12`, "CHIPOTLE", -150, "dining"], [`${ym}-15`, "ACME PAYROLL", 1850, "income-salary"],
    [`${ym}-20`, "TARGET", -200, "shopping"], [`${ym}-22`, "AMAZON", -260, "shopping"], [`${ym}-30`, "INTEREST PAID", 0.05, "income-interest"]]);
  const b = SP.bankSpend(p, T0, { rows: ROWS7H });
  assert.equal(b.on, true);
  assert.equal(b.byRow.shopping, 460, "the check is the rent typed, not 'everything else'");
  settle(p, OPTS);
  assert.equal(rows7(p).shopping, 460);
  const e = computeExpenses7(p, { today: T0 });
  near(e.monthly - e.debtFromDebts, b.out + 1200, 10, "the plan's month (less the loans on Debts) is the bank's");
});

test("C7 fix M4: a loan added on Debts under any name is the car loan picked (no second one); with both loans picked, the name splits them", () => {
  const kinds = (p) => G7.fillOffers(p, OPTS).filter((x) => x.case === "debt").map((x) => x.key);
  for (const name of ["Honda Civic", "Toyota Financial", "Ally loan", "Civic payment"]) {
    const p = older7("sam");
    p.accounts.push({ id: "acct-car", name, type: "loan", balance: 9000, asOf: T0, institution: "", ownerId: "", history: [], notes: "" });
    p.debts.push({ id: "d-car", accountId: "acct-car", rate: 0.069, minPayment: 420, extra: 0 });
    assert.deepEqual(kinds(p), [], name);
  }
  const both = (name) => { const p = older7("sam"); p.guide.setup.picks.owe = [...p.guide.setup.picks.owe, "loan"]; p.accounts.push({ id: "acct-x", name, type: "loan", balance: 4000, asOf: T0, institution: "", ownerId: "", history: [], notes: "" }); return kinds(p); };
  assert.deepEqual(both("Honda auto loan"), ["loan"], "a car's name: the car loan is kept, the other loan is offered");
  assert.deepEqual(both("Personal loan"), ["car-loan"], "a personal loan: the car loan is offered");
});

test("C7 fix M5: a house or car payment typed on Expenses is the debt's payment: written as typed, the balance worked back from it", () => {
  for (const name of ["House payment", "Wells Fargo"]) {
    const p = patLee(T0);
    C3.applyOweAmounts(p, { mortgage: { owed: "" } }, T0); C3.markAt(p, "done", T0);
    const bill = (id, nm, category, amount) => ({ id, name: nm, category, amount, period: "monthly", essential: true, inflates: true, startDate: "", endDate: "" });
    p.expenses = [bill("b1", name, "housing", 1600), bill("b2", "Groceries", "groceries", 800), bill("b3", "Power", "utilities", 300), bill("b4", "Car", "transport", 600), bill("b5", "Health", "insurance", 900), bill("b6", "Fun", "dining", 700), bill("b7", "Stuff", "shopping", 600)];
    const before = computeExpenses7(p, { today: T0 }).monthly;
    const offer = G7.fillOffers(p, OPTS).find((x) => x.case === "debt");
    assert.equal(offer.payment, 1600, `${name}: the payment typed`);
    G7.useFillGuesses(p, OPTS); settle(p, OPTS);
    const d = debt7(p, "setup-debt-mortgage");
    assert.deepEqual([d.minPayment, isGuessIn(p, "debts[setup-debt-mortgage].minPayment")], [1600, false], `${name}: the person's figure`);
    assert.equal(computeExpenses7(p, { today: T0 }).monthly, before, `${name}: the month counts it once ($5,500)`);
    // worked back from $1,600 (as question 5 does with a payment typed), not the $1,300 guessed payment's $210,000
    const typed = estimate(patLee(T0), "debt.mortgage.owed", { ...OPTS, path: "accounts[setup-owe-mortgage].balance", args: { owed: null, payment: 1600, rate: null, start: null } });
    assert.equal(acct7(p, "setup-owe-mortgage").balance, typed.value);
  }
  // a car loan's payment under "Loan and card payments", named for the car's maker: counted once
  const s = sam(T0);
  C3.applyOweAmounts(s, { "car-loan": { owed: "" }, credit: { owed: "3,000" } }, T0); C3.markAt(s, "done", T0);
  s.expenses = [{ id: "b0", name: "Rent", category: "housing", amount: 1200, period: "monthly", essential: true, inflates: true, startDate: "", endDate: "" }, { id: "b1", name: "Toyota", category: "debt", amount: 380, period: "monthly", essential: true, inflates: true, startDate: "", endDate: "" }];
  const was = computeExpenses7(s, { today: T0 }).monthly;
  assert.equal(G7.fillOffers(s, OPTS).find((x) => x.case === "debt").payment, 380);
  G7.useFillGuesses(s, OPTS); settle(s, OPTS);
  const card = debt7(s, "setup-debt-credit").minPayment;
  near(computeExpenses7(s, { today: T0 }).monthly - was, card, 0.01, "only the card's minimum is new ($380 is the car loan's, counted once)");
});

test("C7 fix M6: a debt removed on Net worth (its row left on Debts) is not offered again, and a typed rate or payment is never overwritten", () => {
  const p = jordan(T0);
  C3.applyOweAmounts(p, { mortgage: { owed: "150,000", rate: "3.1", payment: "1,100" } }, T0);
  C3.applySpend(p, { mode: "rows", rows: { housing: 60, utilities: 400, groceries: 600, transport: 400, insurance: 300, childcare: 900, dining: 300, shopping: 400 } }, T0);
  C3.markAt(p, "done", T0);
  p.accounts = p.accounts.filter((x) => x.id !== "setup-owe-mortgage");
  const row = structuredClone(debt7(p, "setup-debt-mortgage"));
  assert.deepEqual(G7.fillOffers(p, OPTS), [], "removed on purpose: nothing to fill");
  G7.useFillGuesses(p, OPTS);
  assert.deepEqual(debt7(p, "setup-debt-mortgage"), row, "the row as she left it");
  assert.equal(acct7(p, "setup-owe-mortgage"), undefined);
});

test("C7 fix M7: a homeowners insurance bill typed under Insurance comes off our guesses once ($150 a month, not $250)", () => {
  const base = migrate(retiredCouplePlan());
  base.expenses = base.expenses.filter((x) => !["Property tax", "Home and car insurance"].includes(x.name));
  const g = (q, row) => estimate(q, `spend.${row}`, { ...OPTS, path: spendPath7(row) }).value;
  const b = structuredClone(base);
  b.expenses.push({ id: "hi", name: "Homeowners insurance", category: "insurance", amount: 1800, period: "annual", essential: true, inflates: true, startDate: "", endDate: "" });
  const fall = (g(base, "housing") - g(b, "housing")) + (g(base, "insurance") - g(b, "insurance"));
  near(fall, 150, 10, "the bill comes off once");
  // the home's insurance part first (our figure for it: no mortgage holds it), the rest off Insurance and health as before
  const part = escrowMonthly(base, { today: T0 }, lib0(base)).insurance;
  near(g(base, "housing") - g(b, "housing"), Math.min(150, part), 10, "home costs give up their insurance part");
});

test("C7 fix M8: bank files more than a year old set no row; the words name the months read", () => {
  const old = withBank7(ours7(), ["2024-01", "2024-02"]);
  assert.equal(SP.bankSpend(old, T0, { rows: ROWS7H }).on, false);
  assert.deepEqual(settle(old, OPTS).changed, []);
  const p = withBank7(ours7(), ["2026-09", "2026-10"]); settle(p, OPTS);
  assert.equal(estimate(p, "spend.groceries", { ...OPTS, path: spendPath7("groceries") }).why, "your bank files, September and October");
  assert.equal(SP.spendBasis(p, { today: T0 }), "The grey figures are what your bank files show going out on each, a month over September and October.");
});

test("C7 fix M9: a row whose bank figure equals our survey figure is read from the bank all the same (not 'our guess')", () => {
  const p = withBank7(ours7(), ["2026-09", "2026-10"], { lines: (ym, k) => BANK7(ym, k).map((l) => (l[1] === "SAFEWAY" ? [l[0], l[1], -195, l[3]] : l)) });
  settle(p, OPTS);
  assert.equal(rows7(p).groceries, 780, "the bank's $780 is the survey's $780");
  assert.equal(sOf(p, "groceries"), 0.15, "and the row is the bank's");
  assert.equal(computeExpenses7(p, { today: T0 }).guessedMonthly, undefined);
});

// ---- C7 fix (UX review of 2026-11-06, items 1-12): the cards, the Dashboard and Expenses drawn with the stand-in kit
const withNext = (view) => ({ view, more: (p) => ({ computeOf: (key, params) => (key === "overview/next-best-action" ? nextBest(p, params) : null) }) });
const EXPENSES = withNext("../../cashflow/expenses/view.js");
/** The Dashboard drawn with every module (the shell's registry), each page's compute through computeOf. */
let allModules = null;
async function drawDash(plan) {
  if (!allModules) {
    allModules = new Map();
    for (const r of (await import("../../registry.js")).default) { const m = (await r.load()).default; allModules.set(`${m.group}/${m.id}`, m); }
  }
  const fmt = await import("../../../core/format.js");
  const node = (tag, attrs = {}, kids = []) => {
    const n = { tag, attrs: attrs ?? {}, kids: [], style: {}, classList: { add() {}, remove() {}, toggle() {} },
      // as the DOM: append and replaceChildren write null, undefined or false as text (ui.h skips them: add)
      add(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) n.kids.push(c); },
      append(...k) { for (const c of k) n.kids.push(c !== null && typeof c === "object" ? c : String(c)); },
      replaceChildren(...k) { n.kids = []; n.append(...k); }, focus() {}, remove() {}, scrollIntoView() { n.scrolled = true; }, querySelector() { return node("q"); }, setAttribute(k, v) { n.attrs[k] = v; }, addEventListener() {},
      get textContent() { return n.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); }, set textContent(v) { n.kids = [String(v)]; } };
    n.add(...kids); return n;
  };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  const kit = {
    h: (tag, a, ...k) => (isAttrs(a) ? node(tag, a, k) : node(tag, {}, [a, ...k])),
    card: (t, ...k) => node("section", { class: "card" }, [t ? node("h2", {}, [t]) : null, ...k]),
    notice: (kind, t) => node("div", { class: `notice ${kind}` }, [t]),
    button: (label, onClick, o = {}) => node("button", { class: o.class ?? "", onClick }, [label]),
    row: (...k) => node("div", { class: "row" }, k), stat: (l, v, s) => node("div", { class: "stat" }, [l, v, s]),
  };
  const ui = new Proxy(kit, { get: (t, k) => t[k] ?? ((...a) => node(String(k), {}, a.filter((x) => typeof x === "string"))) });
  let current = structuredClone(plan);
  const draw = () => {
    const root = node("root"), m = allModules.get("overview/dashboard");
    const computeOf = (key, params) => allModules.get(key)?.compute?.(current, params ?? {}) ?? null;
    m.render(root, { ui, fmt: { ...fmt, today: () => T0 }, plan: current, modules: allModules, isReady: (x) => x.status !== "planned", features: { enabled: () => true }, ai: {}, go() {}, announce() {},
      derived: m.compute(current), computeOf, store: { update(fn) { const next = structuredClone(current); fn(next); current = next; }, get: () => current } });
    noStrayText(root);
    return root;
  };
  const all = (n, test, out = []) => { if (n && typeof n === "object") { if (test(n)) out.push(n); for (const k of n.kids) all(k, test, out); } return out; };
  return { draw, all, text: (n) => n.textContent.replace(/\s+/g, " "), plan: () => current };
}
const btnOf = (pg, n, label) => pg.all(n, (x) => x.tag === "button" && pg.text(x).trim() === label)[0];
const cardTitled = (pg, n, t) => pg.all(n, (x) => x.tag === "section" && x.kids.some((k) => k?.tag === "h2" && pg.text(k).trim() === t))[0];
const noticeOf = (pg, root) => pg.all(root, (n) => /notice ok/.test(n.attrs.class ?? ""))[0];
/** (a) of the review: the sample family whose plan was made before the guesses: every bill and bank line gone, Get started finished. */
function familyBefore() {
  const p = migrate(familyPlan(T0)); p.expenses = []; p.transactions = []; p.imports = [];
  p.guide = { setup: { at: "done", startedAt: "2026-10-01", finishedAt: "2026-10-01", picks: { have: ["checking", "home"], owe: ["mortgage"], goals: [] } } };
  return p;
}

test("C7 fix UX 1: a month with more than a tenth (or $50) of its money out filed under no kind is not read; Expenses and the page say how many lines to file", async () => {
  const half = ["APS ELECTRIC", "VERIZON WIRELESS", "STATE FARM", "CHIPOTLE", "NETFLIX"];
  const p = withBank7(ours7(), ["2026-09", "2026-10"], { lines: (ym, k) => BANK7(ym, k).map((l) => (half.includes(l[1]) ? [l[0], l[1], l[2], null] : l)) });
  const was = rows7(p);
  const b = SP.bankSpend(p, T0, { rows: ROWS7H });
  assert.deepEqual([b.on, b.held?.kind], [false, "unfiled"]);
  settle(p, OPTS);
  assert.deepEqual(rows7(p), was, "no $0 rows 'from your bank', no $1,850 of 'everything else'");
  const note = G7.spendBankNote(p, OPTS);
  assert.equal(note.text, "12 bank lines still need a kind. File them, and our spending guesses become what your bank shows.");
  assert.deepEqual(note.link, { label: "Categorize ›", href: "#/transactions/categorize" });
  const ex = await drawPage(p, EXPENSES), exRoot = ex.draw();
  assert.match(ex.text(exRoot), /12 bank lines still need a kind\. File them, and our spending guesses become what your bank shows\. Categorize ›/);
  const pg = await drawPage(p, withNext("./view.js")), root = pg.draw();
  assert.match(pg.text(pg.all(root, (n) => n.tag === "li" && /^(Spending, with the mortgage payment|Everyday spending)/.test(pg.text(n).trim()))[0]), /12 bank lines still need a kind\./);
  // a line with no kind that reads as a move between accounts ("Transfer to savings") is not spending, and $50 unfiled is read
  const q = withBank7(ours7(), ["2026-09", "2026-10"], { lines: (ym, k) => BANK7(ym, k).map((l) => (l[1] === "Transfer to savings" ? [l[0], l[1], l[2], null] : l)) });
  const bq = SP.bankSpend(q, T0, { rows: ROWS7H });
  assert.equal(bq.on, true);
  assert.equal(bq.byRow.shopping, SP.bankSpend(withBank7(ours7(), ["2026-09", "2026-10"]), T0, { rows: ROWS7H }).byRow.shopping, "the $500 to savings is not shopping");
});

const tens = (v) => `$${(Math.round(v / 10) * 10).toLocaleString("en-US")}`;
test("C7 fix UX 2 and 4: on the Dashboard the card sits right under where you stand, and the rows it decides wait on it and lead to it", async () => {
  const pg = await drawDash(familyBefore()), root = pg.draw();
  const kids = root.kids.filter((n) => n?.tag === "section");
  const at = kids.findIndex((n) => /\bdb-now\b/.test(n.attrs.class ?? ""));
  assert.ok(at >= 0, "where you stand is drawn");
  assert.equal(pg.text(kids[at + 1].kids.find((k) => k?.tag === "h2")).trim(), "Fill in what you skipped", "the card comes next, above the money tiles");
  const row = (k) => pg.all(kids[at], (n) => n.tag === "a" && pg.text(n).trim().startsWith(k))[0];
  assert.equal(pg.text(row("Left over each month")).trim(), "Left over each month Depends on your spending: not counted yet See below ›");
  assert.equal(pg.text(row("Safety cushion")).trim(), "Safety cushion Needs your spending See below ›");
  assert.equal(pg.text(row("Retirement")).trim(), "Retirement Depends on the figures below See below ›", "no green 'On track' while spending is not counted");
  for (const k of ["Left over each month", "Safety cushion", "Retirement"]) {
    const a = row(k);
    assert.equal(a.attrs.href, "#/overview/guesses", k);
    assert.doesNotMatch(pg.all(a, (n) => /db-dot/.test(n.attrs.class ?? ""))[0].attrs.class, /\b(ok|warn|bad)\b/, k);
    let stopped = false; a.attrs.onClick({ preventDefault() { stopped = true; } });
    assert.ok(stopped && kids[at + 1].scrolled, `${k}: one way to fill in spending: the card`);
  }
  // one name for each figure: the card's day-to-day spending leaves the mortgage out
  assert.match(pg.text(kids[at + 1]), /Day-to-day spending \(not the mortgage\) about \$5,550 a month/);
  // the list far too short ("Is something missing?"): the left-over row waits on it the same way
  const m = await drawDash(missing7({ transport: 700, insurance: 300, dining: 500, shopping: 300 })), r2 = m.draw();
  const k2 = r2.kids.filter((n) => n?.tag === "section"), a2 = k2.findIndex((n) => /\bdb-now\b/.test(n.attrs.class ?? ""));
  assert.equal(m.text(k2[a2 + 1].kids.find((k) => k?.tag === "h2")).trim(), "Is something missing?");
  const miss = G7.spendMissing(m.plan(), OPTS);
  assert.equal(m.text(m.all(k2[a2], (n) => n.tag === "a" && /^Left over each month/.test(m.text(n).trim()))[0]).trim(), `Left over each month Depends on your spending: your list may be missing about ${tens(miss.rest)} a month See below ›`);
});

test("C7 fix UX 2: Expenses' left-over tile waits while 'Is something missing?' applies (no green figure above the question)", async () => {
  const p = missing7({ transport: 700, insurance: 300, dining: 500, shopping: 300 });
  const miss = G7.spendMissing(p, OPTS);
  const pg = await drawPage(p, EXPENSES), root = pg.draw(), t = pg.text(root);
  const tile = pg.all(root, (n) => /\bstat\b/.test(n.attrs.class ?? "") && /^Left over/.test(pg.text(n).trim()))[0];
  assert.equal(pg.text(tile).trim(), `Left over Depends on your spending Your list may be missing about ${tens(miss.rest)} a month. See "Is something missing?" just below. ›`);
  assert.ok(t.indexOf("Is something missing?") > t.indexOf("Depends on your spending"), "the question right under the tiles");
  // answered: the tile has its figure again
  const done = structuredClone(p); G7.spendIsComplete(done, T0);
  const pg2 = await drawPage(done, EXPENSES), t2 = pg2.text(pg2.draw());
  assert.doesNotMatch(t2, /Depends on your spending/);
});

test("C7 fix UX 3: bank files that set no spending row say why, and what to do, on Expenses and on the page", async () => {
  const words = (p) => SP.bankHeldWords(p, SP.bankSpend(p, T0, { rows: ROWS7H }));
  // a card paid from checking whose own file is not in
  const card = withBank7(ours7(), ["2026-09", "2026-10"], { lines: (ym, k) => [...BANK7(ym, k), [`${ym}-25`, "VISA PAYMENT", -300, "debt"]] });
  card.accounts.push({ id: "visa", name: "Visa", type: "credit", balance: 900, asOf: T0, institution: "", ownerId: "", history: [], notes: "" });
  assert.deepEqual(words(card), { text: "Your bank files cover September and October, but about $300 a month went to your Visa, and its file isn't in. Bring it in, and our spending guesses become what your bank shows.",
    link: { label: "Bring in the Visa file ›", href: "#/transactions/import?accountId=visa" } });
  assert.deepEqual(SP.bankHeldWords(cardGap7(T0), SP.bankSpend(cardGap7(T0), T0)).link, { label: "Bring in the Visa file ›", href: "#/transactions/import?accountId=a-visa" });
  // only a card's own file
  const only = ours7S();
  file7(only, "visa", "credit", ["2026-09", "2026-10"], (ym) => [[`${ym}-03`, "KROGER", -60, "groceries"], [`${ym}-28`, "PAYMENT THANK YOU", 400, "transfer"]], { name: "Visa" });
  assert.deepEqual(words(only), { text: "Your card's files cover September and October, but not your checking account, where rent and bills are paid. Bring in its file too, and our spending guesses become what your bank shows.",
    link: { label: "Bring in a bank file ›", href: "#/transactions/import" } });
  // money to a card the plan does not have
  const unknown = withBank7(ours7(), ["2026-09", "2026-10"], { lines: (ym, k) => [...BANK7(ym, k), [`${ym}-25`, "CHASE CREDIT CRD AUTOPAY", -3200, "debt"]] });
  assert.deepEqual(words(unknown), { text: "Your bank files cover September and October, but about $3,200 a month went to a card that isn't in your plan (CHASE CREDIT CRD AUTOPAY). Add the card and bring in its file, and our spending guesses become what your bank shows.",
    link: { label: "Add the card ›", href: "#/balance/net-worth" } });
  // a card's payment that names no card of the plan, beside one card with no file (the phone check's (c): "CAPITAL ONE
  // AUTOPAY" filed as a transfer, a card saved as "Visa"): likely that one, and its file is asked for
  const likely = withBank7(ours7(), ["2026-09", "2026-10"], { lines: (ym, k) => [...BANK7(ym, k), [`${ym}-24`, "CAPITAL ONE AUTOPAY", -300, "transfer"]] });
  likely.accounts.push({ id: "visa", name: "Visa", type: "credit", balance: 900, asOf: T0, institution: "", ownerId: "", history: [], notes: "" });
  assert.deepEqual(words(likely), { text: "Your bank files cover September and October, but about $300 a month went to a card (CAPITAL ONE AUTOPAY), and what it bought is in no file. If that is your Visa, bring in its file; if it is another card, add it first. Then our spending guesses become what your bank shows.",
    link: { label: "Bring in the Visa file ›", href: "#/transactions/import?accountId=visa" } });
  // files over a year old
  assert.deepEqual(words(withBank7(ours7(), ["2024-01", "2024-02"])), { text: "Your bank files are from January and February 2024, more than a year ago, so our spending guesses don't use them. Bring in the last few months.",
    link: { label: "Bring in a bank file ›", href: "#/transactions/import" } });
  // read: nothing to say
  assert.equal(words(withBank7(ours7(), ["2026-09", "2026-10"])), null);
  // where it is said: under Expenses' tiles (a muted line and its link) and in the page's spending row
  const ex = await drawPage(card, EXPENSES), exRoot = ex.draw();
  const line = ex.all(exRoot, (n) => n.tag === "p" && /^Your bank files cover/.test(ex.text(n).trim()))[0];
  assert.match(line.attrs.class, /muted small/);
  assert.equal(ex.all(line, (n) => n.tag === "a")[0].attrs.href, "#/transactions/import?accountId=visa");
  const pg = await drawPage(card, withNext("./view.js")), root = pg.draw();
  assert.match(pg.text(pg.all(root, (n) => n.tag === "li" && /^Everyday spending/.test(pg.text(n).trim()))[0]), /about \$300 a month went to your Visa, and its file isn't in\. .* Bring in the Visa file ›/);
});

test("C7 fix UX 5: the card asks question 6's open questions as chips; an answer changes the card only, and 'Use these guesses' keeps it as question 6 does", async () => {
  const before = older7("jordan");
  const pg = await drawPage(before);
  let root = pg.draw(), c = cardTitled(pg, root, "Fill in what you skipped");
  const asks = G7.fillOffers(before, OPTS).find((x) => x.case === "spend").asks;
  assert.deepEqual(asks.map((a) => a.key), ["health-cover", "childcare"], "a parent of two: health cover and childcare");
  const group = (q) => pg.all(c, (n) => n.attrs.role === "radiogroup" && n.attrs["aria-label"] === q)[0];
  assert.equal(pg.all(group("How do you get health cover?"), (n) => n.attrs.role === "radio").length, 4);
  const pub = asks[0].options.find((o) => o.value === "public").label;
  pg.all(group("How do you get health cover?"), (n) => n.attrs.role === "radio" && pg.text(n).trim() === pub)[0].attrs.onClick();
  assert.deepEqual(pg.plan(), before, "nothing is written by a chip");
  const answered = G7.fillOffers(before, { ...OPTS, taps: { "health-cover": "public" } }).find((x) => x.case === "spend");
  assert.notEqual(answered.total, 3230);
  assert.match(pg.text(c), new RegExp(`Day-to-day spending \\(not the mortgage\\) about \\$${answered.total.toLocaleString("en-US")} a month`), "the card's figure follows the answer");
  assert.equal(pg.all(c, (n) => n.attrs.role === "radio" && n.attrs["aria-checked"] === "true").map((n) => pg.text(n).trim()).join(), pub);
  assert.ok(group("How do you get health cover?") && group("Do you pay for childcare or after-school care?"), "both questions stay, the answer picked (it can be changed until the tap)");
  // a second answer on the same card: the first is kept with it
  const no = asks[1].options.find((o) => o.value === "no").label;
  pg.all(group("Do you pay for childcare or after-school care?"), (n) => n.attrs.role === "radio" && pg.text(n).trim() === no)[0].attrs.onClick();
  assert.equal(pg.all(c, (n) => n.attrs.role === "radio" && n.attrs["aria-checked"] === "true").length, 2);
  assert.deepEqual(pg.plan(), before);
  btnOf(pg, c, "Use these guesses").attrs.onClick();
  assert.deepEqual([pg.plan().guide.setup.taps["health-cover"], pg.plan().guide.setup.taps.childcare], ["public", "no"], "kept where question 6 keeps them");
  const both = G7.fillOffers(before, { ...OPTS, taps: { "health-cover": "public", childcare: "no" } }).find((x) => x.case === "spend");
  const sum = pg.plan().expenses.filter((x) => x.id.startsWith("setup-x-")).reduce((t, x) => t + x.amount, 0);
  assert.equal(sum, both.total, "the rows written are the card's");
  // a plan Get started never saw: the answer starts guide.setup with it alone
  const q = jordan(T0); delete q.guide;
  G7.useFillGuesses(q, { ...OPTS, taps: { childcare: "no", other: "x" } });
  assert.deepEqual(q.guide.setup, { taps: { childcare: "no" } });
  assert.equal(q.expenses.some((x) => x.id === "setup-x-childcare"), false, "No: no childcare row");
});

test("C7 fix UX 6: the card says what else its tap changes, and the notice says what is counted now and where to type the real figures", async () => {
  const words = async (name) => { const pg = await drawPage(older7(name)), root = pg.draw(); return pg.text(pg.all(cardTitled(pg, root, "Fill in what you skipped"), (n) => /gs-effect/.test(n.attrs.class ?? ""))[0]).trim(); };
  assert.equal(await words("jordan"), "This counts the $110,000 you owe on your home and your home, worth about $210,000, so what you own minus what you owe goes up by about $100,000, and about $3,260 a month of spending.");
  assert.equal(await words("sam"), "This counts the $13,000 you owe on your car loan, so what you own minus what you owe goes down by about $13,000, and about $2,680 a month of spending.");
  assert.deepEqual(G7.fillEffect(G7.fillOffers(older7("patLee"), OPTS)), { owed: 140000, home: 0, net: -140000, spend: 4990 });
  // the notice after the tap (Sam: two debts and the spending)
  const pg = await drawPage(older7("sam")); let root = pg.draw();
  btnOf(pg, cardTitled(pg, root, "Fill in what you skipped"), "Use these guesses").attrs.onClick();
  root = pg.draw();
  assert.equal(pg.text(noticeOf(pg, root)).trim(), "Saved: your car loan (about $13,000 owed) and about $2,680 a month of spending are counted now. Type the real figures on Expenses and Debts when you have them.");
});

test("C7 fix UX 7: every card's tap that writes figures has an outlined Undo that puts the plan back; 'Ask me again' after 'That's everything'", async () => {
  const before = older7("jordan");
  const pg = await drawPage(before); let root = pg.draw();
  btnOf(pg, cardTitled(pg, root, "Fill in what you skipped"), "Use these guesses").attrs.onClick();
  assert.notDeepEqual(pg.plan(), before);
  root = pg.draw();
  const undo = btnOf(pg, root, "Undo");
  assert.match(undo.attrs.class, /secondary/);
  undo.attrs.onClick();
  assert.deepEqual(pg.plan(), before, "as it was before the tap: no mortgage, no home, no rows, no fillSkipped");
  root = pg.draw();
  assert.equal(pg.text(noticeOf(pg, root)).trim(), "Undone: your plan is as it was before the tap.");
  assert.equal(btnOf(pg, root, "Undo"), undefined, "one Undo, on the next render only");
  assert.ok(cardTitled(pg, root, "Fill in what you skipped"), "the card is back");
  // "Is something missing?" on Expenses: Add, then Undo
  const miss = missing7({ transport: 700, insurance: 300, dining: 500, shopping: 300 });
  const ex = await drawPage(miss, EXPENSES); let er = ex.draw();
  btnOf(ex, cardTitled(ex, er, "Is something missing?"), "Add our guesses for the rest").attrs.onClick();
  er = ex.draw();
  assert.match(ex.text(noticeOf(ex, er)), /^ ?Added our guesses for what wasn't listed: about \$[\d,]+ a month\. Change any of them in the list below when you know the real figure\./);
  btnOf(ex, er, "Undo").attrs.onClick();
  assert.deepEqual(ex.plan(), miss);
  // "That's everything", then "Ask me again" (muted line under the tiles, outlined button): the question is back
  er = ex.draw();
  btnOf(ex, cardTitled(ex, er, "Is something missing?"), "That's everything").attrs.onClick();
  assert.equal(ex.plan().guide.spendComplete, T0);
  er = ex.draw();
  assert.equal(cardTitled(ex, er, "Is something missing?"), undefined);
  assert.match(ex.text(er), /Noted: what's listed is everything\. You can ask for this again just below the totals\. .*You said this list is everything\. Ask me again/);
  const again = btnOf(ex, er, "Ask me again");
  assert.match(again.attrs.class, /secondary/);
  again.attrs.onClick();
  assert.equal("spendComplete" in ex.plan().guide, false);
  er = ex.draw();
  assert.ok(cardTitled(ex, er, "Is something missing?"), "asked again");
  // a list that has grown past the line since: no "Ask me again" (nothing left to ask)
  const grown = missing7({ transport: 700, insurance: 300, dining: 500, shopping: 3000 }); G7.spendIsComplete(grown, T0);
  assert.equal(G7.spendSaidComplete(grown, OPTS), false);
  const g2 = await drawPage(grown, EXPENSES);
  assert.doesNotMatch(g2.text(g2.draw()), /You said this list is everything/);
  // "Use the new guesses" on this page too
  const older = guessedPlan(T0), up = await drawPage(older); let ur = up.draw();
  btnOf(up, cardTitled(up, ur, "Better guesses are ready"), "Use the new guesses").attrs.onClick();
  ur = up.draw();
  btnOf(up, ur, "Undo").attrs.onClick();
  assert.deepEqual(up.plan(), older);
});

test("C7 fix UX 4: one name for each figure: after the tap the page says 'Spending, with the mortgage payment', and the home's row is its upkeep", async () => {
  const pg = await drawPage(older7("jordan"), withNext("./view.js")); let root = pg.draw();
  const c = cardTitled(pg, root, "Fill in what you skipped");
  assert.match(pg.text(c), /How it adds up › Home upkeep \(tax and insurance are in the mortgage payment\) \$[\d,]+/);
  btnOf(pg, c, "Use these guesses").attrs.onClick();
  root = pg.draw();
  const row = pg.all(root, (n) => n.tag === "li" && /^Spending, with the mortgage payment about \$[\d,]+ a month/.test(pg.text(n).trim()))[0];
  assert.ok(row, "the page's figure says the mortgage payment is in it");
  const nba = nextBest(pg.plan(), { today: T0 }).spare;
  assert.match(pg.text(row), new RegExp(`about ${tens(nba.guessedMonthly).replace("$", "\\$")} a month`));
  near(nba.guessedMonthly, 3260 + debt7(pg.plan(), "setup-debt-mortgage").minPayment, 10, "the card's day-to-day spending plus the mortgage's payment");
});

test("C7 fix UX 8: Expenses with nothing listed offers the same guesses as the Dashboard (spending alone: 'Not sure what you spend?', 'I'll type mine')", async () => {
  // income and nothing else owed: the spending alone
  const p = jordan(T0); C3.markAt(p, "done", T0); p.guide.setup.picks = { ...(p.guide.setup.picks ?? {}), owe: ["none"] };
  const offer = G7.fillOffers(p, OPTS);
  assert.deepEqual(offer.map((x) => x.case), ["spend"]);
  const pg = await drawPage(p, EXPENSES); let root = pg.draw();
  const c = cardTitled(pg, root, "Not sure what you spend?");
  assert.ok(c, "the card is on Expenses");
  assert.ok(pg.text(c).includes(`Households like yours (${offer[0].who}) spend about $${offer[0].total.toLocaleString("en-US")} a month. Use our guesses to start, and type your own figures as you learn them.`));
  assert.match(pg.text(c), /Nothing changes until you tap\. After that, you can type your real figures any time in the list below\./);
  assert.deepEqual(pg.all(c, (n) => n.tag === "button" && !/chip/.test(n.attrs.class ?? "")).map((b) => pg.text(b).trim()), ["Use these guesses", "I'll type mine"]);
  assert.match(btnOf(pg, c, "I'll type mine").attrs.class, /secondary/);
  btnOf(pg, c, "I'll type mine").attrs.onClick();
  assert.deepEqual(pg.plan(), p, "I'll type mine writes nothing");
  btnOf(pg, c, "Use these guesses").attrs.onClick();
  assert.equal(pg.plan().expenses.filter((x) => x.id.startsWith("setup-x-")).reduce((t, x) => t + x.amount, 0), offer[0].total);
  assert.equal(pg.plan().guide.fillSkipped, undefined, "the spending alone: nothing else was answered");
  root = pg.draw();
  assert.match(pg.text(noticeOf(pg, root)), /Saved: about \$[\d,]+ a month of spending is counted now\. Type the real figures in the list below when you have them\./);
  // with a debt left out too (the Dashboard's card): the same card, both cases, the same figures; "Not now" there does not hide it here
  const q = older7("jordan"); G7.fillLater(q, T0);
  const ex = await drawPage(q, EXPENSES), er = ex.draw(), c2 = cardTitled(ex, er, "Fill in what you skipped");
  assert.ok(c2);
  assert.match(ex.text(c2), /Mortgage about \$110,000 owed .* Day-to-day spending \(not the mortgage\) about \$3,260 a month/);
  btnOf(ex, c2, "Use these guesses").attrs.onClick();
  assert.ok(acct7(ex.plan(), "setup-owe-mortgage") && ex.plan().expenses.length >= 6);
});

test("C7 fix UX 9: 'Is something missing?' offers a row whose own kind is not listed, less what is listed under its others; the list's total is to the dollar and adds up", async () => {
  const p = missing7({ transport: 700, insurance: 300, dining: 500, shopping: 300 });
  p.expenses.push({ id: "b-phones", name: "Phones", category: "phone", amount: 95, period: "monthly", essential: true, inflates: true, startDate: "", endDate: "" });
  const m = G7.spendMissing(p, OPTS);
  assert.ok(m, "still far below the usual total");
  const util = m.rows.find((r) => r.row === "utilities");
  assert.ok(util, "a phone bill does not stand for the power and water");
  assert.equal(util.listed, 95);
  near(m.typed, 1600 + 1800 + 95, 0.01, "the mortgage's payment and every bill, to the cent");
  near(m.withThese, m.typed + m.rest, 0.01);
  const pg = await drawPage(p, EXPENSES), c = cardTitled(pg, pg.draw(), "Is something missing?");
  assert.match(pg.text(c), /You've listed \$3,495\./);
  assert.match(pg.text(c), new RegExp(`Utilities and phone, besides the \\$95 you listed \\$${util.value.toLocaleString("en-US")}`));
  const round = (v) => Math.round(v / 100) * 100;
  assert.match(pg.text(c), new RegExp(`With these, your list comes to about \\$${round(m.withThese).toLocaleString("en-US")}`));
  // the rows offered add up to "Not listed yet"
  assert.equal(m.rows.reduce((t, r) => t + r.value, 0), m.rest);
  assert.match(pg.text(c), new RegExp(`Not listed yet about \\$${m.rest.toLocaleString("en-US")} a month`));
});

test("C7 fix UX 10: the Dashboard's 'Better guesses are ready' gives the reasons, counts the small changes, and links to the rest", async () => {
  const before = guessedPlan(T0);
  const pg = await drawDash(before), root = pg.draw();
  const c = cardTitled(pg, root, "Better guesses are ready");
  assert.ok(c, "the card, after the money tiles");
  const up = G7.upgradeOffers(guessedPlan(T0), OPTS);
  const small = up.filter((x) => x.kind === "money" && Number(x.from) > 0 && Math.abs(x.to - x.from) / Number(x.from) < 0.02).length;
  // (the cushion's $12,000 to $12,100 was the small one; since 2026-11-07 the payment it counts moved too, so there may be none)
  assert.match(pg.text(c), /Mortgage: interest rate From 7\.24% to 4\.7% Our new guess: the usual rate for loans from about 2021, eased toward today's\./);
  if (small) assert.match(pg.text(c), new RegExp(`Plus ${small === 1 ? "one small change" : `${small} small changes`} of under 2%\\.`));
  else assert.doesNotMatch(pg.text(c), /small change/);
  const link = pg.all(c, (n) => n.tag === "a")[0];
  assert.deepEqual([pg.text(link).trim(), link.attrs.href], ["See all on Our guesses for you ›", "#/overview/guesses"]);
  btnOf(pg, c, "Use the new guesses").attrs.onClick();
  assert.equal(debt7(pg.plan(), "setup-debt-mortgage").rate, 0.047);
  const r2 = pg.draw();
  assert.match(pg.text(noticeOf(pg, r2)), /^ ?Saved: the \d+ new guesses are in your plan\./);
  btnOf(pg, r2, "Undo").attrs.onClick();
  assert.deepEqual(pg.plan(), before, "Undo puts the older figures back (the cushion goal's target with them)");
});

test("C7 fix UX 11: rows read from the bank files fold on their own (no 'That's about right'); cover taken from pay is kept in Insurance and health", async () => {
  const p = withBank7(ours7(), ["2026-09", "2026-10"]); settle(p, OPTS);
  const pg = await drawPage(p), root = pg.draw();
  const fold = pg.all(root, (n) => n.tag === "details" && /^Read from your bank files/.test(pg.text(n).trim()))[0];
  assert.ok(fold);
  const d = G7.compute(p, OPTS);
  assert.match(pg.text(fold), new RegExp(`^ ?Read from your bank files ${d.bank.length} rows`));
  assert.equal(btnOf(pg, fold, "That's about right"), undefined);
  for (const r of d.bank) assert.ok(!d.rows.some((x) => x.path === r.path && !x.fromBank), r.path);
  // health cover through work: the worker's share never reaches a bank file, so it stays in the row
  const w = withBank7(ours7(), ["2026-09", "2026-10"]); w.guide.setup.taps = { ...(w.guide.setup.taps ?? {}), "health-cover": "work" }; settle(w, OPTS);
  const e = estimate(w, "spend.insurance", { ...OPTS, path: spendPath7("insurance") });
  const { T: HEALTH7 } = await import("./data/health.js");
  const prem = HEALTH7.kff_ehbs2026_premiums.rows["worker contribution, monthly"][1];
  assert.ok(prem > 0);
  near(e.value, 180 + 40 + prem, 5, "the bank's $220 plus the worker's share of a family plan (to the nearest $10)");
  assert.equal(e.why, "your bank files, September and October, and cover taken from pay");
  const own = estimate(withBank7(ours7(), ["2026-09", "2026-10"]), "spend.insurance", { ...OPTS, path: spendPath7("insurance") });
  assert.equal(own.why, "your bank files, September and October; not cover taken from pay");
});

test("C7 verify V1: a car payment typed under 'Car, gas and transit' is the car loan's payment, counted once after the tap (it moves under Loan and card payments)", () => {
  const bill = (id, nm, category, amount) => ({ id, name: nm, category, amount, period: "monthly", essential: true, inflates: true, startDate: "", endDate: "" });
  for (const [name, amount] of [["Car payment", 420], ["Toyota payment", 380]]) {
    const s = sam(T0);
    C3.applyOweAmounts(s, { "car-loan": { owed: "" }, credit: { owed: "3,000" } }, T0); C3.markAt(s, "done", T0);
    s.expenses = [bill("b0", "Rent", "housing", 1200), bill("b1", name, "transport", amount), bill("b2", "Food", "groceries", 300)];
    // before: the car payment under transport, the card's minimum counted from Debts
    const was = computeExpenses7(s, { today: T0 }).monthly;
    const offer = G7.fillOffers(s, OPTS).find((x) => x.case === "debt");
    assert.deepEqual([offer.key, offer.payment, offer.paidAs, offer.paidUnder], ["car-loan", amount, name, "transport"], `${name}: the card names the bill and where it is`);
    G7.useFillGuesses(s, OPTS); settle(s, OPTS);
    assert.deepEqual([debt7(s, "setup-debt-car-loan").minPayment, isGuessIn(s, "debts[setup-debt-car-loan].minPayment")], [amount, false], `${name}: the person's figure`);
    assert.equal(s.expenses.find((x) => x.id === "b1").category, "debt", `${name}: filed where Expenses ties it to the loan`);
    assert.equal(computeExpenses7(s, { today: T0 }).monthly, was, `${name}: the month counts the payment once (it was ${was} before the tap)`);
  }
  // under Loan and card payments already: nothing is moved
  const d = sam(T0);
  C3.applyOweAmounts(d, { "car-loan": { owed: "" }, credit: { owed: "3,000" } }, T0); C3.markAt(d, "done", T0);
  d.expenses = [bill("b0", "Rent", "housing", 1200), bill("b1", "Car payment", "debt", 420)];
  assert.equal(G7.fillOffers(d, OPTS).find((x) => x.case === "debt").paidUnder, "debt");
  G7.useFillGuesses(d, OPTS);
  assert.equal(d.expenses.find((x) => x.id === "b1").category, "debt");
});

test("C7 verify V2: a mortgage added on Net worth with no payment on Debts: the spending card says the payment is not counted and where to add it", async () => {
  const p = older7("patLee");
  p.accounts.push({ id: "acct-m1", name: "Home loan", type: "mortgage", balance: 182000, asOf: T0, institution: "", ownerId: "", history: [], notes: "" });
  const offers = G7.fillOffers(p, OPTS);
  assert.deepEqual(offers.map((x) => x.case), ["spend"], "the mortgage is kept elsewhere: not offered again");
  assert.deepEqual([offers[0].mortgage, offers[0].mortgageUnpaid], [true, true]);
  const pg = await drawPage(p), root = pg.draw();
  const card = cardTitled(pg, root, "Fill in what you skipped");
  assert.match(pg.text(card), /Your mortgage's payment isn't on Debts yet, so it isn't counted\./);
  assert.ok(pg.all(card, (n) => n.tag === "a" && n.attrs.href === "#/balance/liabilities").length, "a link to Debts");
  // its payment typed on Debts: counted, and the line goes
  p.debts = [...(p.debts ?? []), { id: "d-m1", accountId: "acct-m1", rate: 0.039, minPayment: 1820, extra: 0 }];
  assert.equal(G7.fillOffers(p, OPTS)[0].mortgageUnpaid, false);
  // the card's own mortgage (offered with the spending) is counted from Debts once written: no line
  assert.equal(G7.fillOffers(older7("patLee"), OPTS).find((x) => x.case === "spend").mortgageUnpaid, false);
});

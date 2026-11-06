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
import { estimators as setupEstimators, oweArgs, askHomeWithMortgage } from "../setup/compute.js";
import { estimate, mergeEstimators, checkEstimators, markGuess, saveField, applies } from "../../../core/estimate/index.js";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";
import { guessedPlan } from "../../../qa/fixtures/guessed-plan.mjs";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
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
  assert.equal(Object.keys(TABLES).length, 63);
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
  assert.deepEqual(Object.keys(READ_ON).sort(), ["balances", "debts", "health", "home", "pay", "retire", "spend"]);
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
// read date, and counts publishers rather than calling 63 tables "sources"; no working notes from the research reach the screen
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
  assert.equal(orgs.size, 17, [...orgs].join("; "));
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
  return out;
})();
const pathsFor = (plan, key) => (key === "overview/setup:ss" ? (plan.household?.people ?? []).map((p) => `retirement.socialSecurity.${p.id}.monthlyAtFRA`) : [undefined]);

test("every estimator that ships returns null or a sourced Estimate (why <= 70, dataAsOf, tables known, low <= value <= high)", () => {
  const keys = Object.keys(REG.estimators);
  // C2 adds what is owed and the payment for each kind, the car loan's rate, and the home (spec 7.C-7.D)
  assert.deepEqual(keys.sort(), [
    "debt.car-loan.owed", "debt.car-loan.payment", "debt.car-loan.rate", "debt.credit.owed", "debt.credit.payment", "debt.credit.rate",
    "debt.loan.owed", "debt.loan.payment", "debt.loan.rate", "debt.mortgage.owed", "debt.mortgage.payment", "debt.mortgage.rate",
    "debt.student.owed", "debt.student.payment", "debt.student.rate", "home.insurance", "home.propertyTax", "home.value",
    "overview/setup:cushionFunds", "overview/setup:cushionTarget", "overview/setup:retireSpend", "overview/setup:ss"]);
  assert.deepEqual(REG.problems, []);
  assert.deepEqual(checkEstimators([estimators, setupEstimators]), []);
  const seen = new Set();
  for (const [name, plan] of PLANS) for (const key of keys) for (const p of pathsFor(plan, key)) {
    const e = estimate(plan, key, { ...OPTS, path: p });
    if (e === null) continue;
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
  const rate = (name) => estimate(PLANS.find(([n]) => n === name)[1], "debt.mortgage.rate", OPTS);
  const oh = rate("guessed (Ohio)");
  assert.deepEqual([oh.value, oh.why, oh.tables, oh.sharperWith.map((s) => s.label)], [0.046, "the average on Ohio mortgages people already have", ["mortgage_outstanding_fhfa_by_state_2026q2"], ["when you took out the mortgage"]]);
  assert.equal(rate("guessed (Arizona)").value, 0.043);
  const us = rate("guessed (no state)");
  assert.deepEqual([us.value, us.tables, us.sharperWith.map((s) => s.label)], [0.044, ["mortgage_outstanding_fhfa_national"], ["your state", "when you took out the mortgage"]]);
  const recent = rate("guessed (mortgage from 2022)");
  assert.equal(recent.value, Math.round(cell(DEBTS.mortgage_new_purchase_fhfa_by_state_2025, "Average contract interest rate (%)", "OH") * 10) / 1000);
  assert.deepEqual([recent.tables, recent.sharperWith], [["mortgage_new_purchase_fhfa_by_state_2025"], []]);
  const g = PLANS[1][1];
  assert.deepEqual(["debt.credit.rate", "debt.student.rate", "debt.loan.rate"].map((k) => estimate(g, k, OPTS).value), [0.224, 0.065, 0.119]);
  // review of C1 (2026-11-06, data 3): "taken out 2022 or later" with no state used the rate on loans people already have
  // (4.4%); it is the U.S. rate on 2025 home-purchase loans, by loan count (FHFA NMDB, all purchase loans: 6.3%)
  const recentUS = rate("guessed (mortgage from 2022, no state)");
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
// spec 6.2: core/*, its own data and estimators, three named data files of other modules, and three computes read-only
const ALLOWED = [/^core\//, /^modules\/overview\/guesses\/(data|estimators)\//, /^modules\/taxes\/federal\/data\/federal\.js$/, /^modules\/retirement\/social-security\/data\/ssa\.js$/,
  /^modules\/retirement\/historical\/data\/returns\.js$/, /^modules\/taxes\/state\/compute\.js$/, /^modules\/cashflow\/expenses\/compute\.js$/];
function reach(start) {
  const seen = new Set(), todo = [start];
  while (todo.length) { const f = todo.pop(); if (seen.has(f)) continue; seen.add(f); todo.push(...importsOf(f)); }
  seen.delete(start);
  return seen;
}
test("the import rule: core/*, its own data and estimators, other modules' data and three named computes; no cycle, no overview compute", () => {
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
  assert.equal(BUILT, 2);
  // 191: the inventory's "does not know" rows, de-duplicated, including its two "roughly / no" and "no (until quoted)"
  // rows (review of C1, 2026-11-06, data 1): the 401(k) balance on Get started (E12, C4) and the refinance offer's rate (C9)
  assert.equal(COVERAGE.length, 191);
  const row = (page, p) => COVERAGE.find((r) => r.page === page && r.path === p);
  assert.equal(row("overview/setup", "accounts[setup-have-retire-<pid>].balance")?.how, "later:C4");
  assert.equal(row("debt/refinance", "debtPlan.refinance.rate")?.how, "later:C9");
  assert.equal(new Set(COVERAGE.map((r) => `${r.page}|${r.path}|${r.label}`)).size, COVERAGE.length, "no row twice");
  for (const r of COVERAGE) {
    assert.ok(r.page && r.path && r.label, JSON.stringify(r));
    assert.match(r.how, /^(guess:\S+|compute:.+|fallback:.+|example|ask|other-builder|later:C(\d+))$/, JSON.stringify(r));
    if (r.how.startsWith("guess:")) assert.ok(REG.estimators[r.how.slice(6)], r.how);
    const later = /^later:C(\d+)$/.exec(r.how);
    if (later) assert.ok(Number(later[1]) > BUILT, `${r.label}: C${later[1]} is built`);
  }
  // C1 handled 48; C2 the six rate boxes of Get started's debt screen
  assert.equal(COVERAGE.filter((r) => !r.how.startsWith("later:")).length, 54);
  assert.equal(COVERAGE.filter((r) => r.how === "later:C2").length, 0);
});

// ---- the page
const page = (plan) => compute(plan, { ...OPTS });
test("the page on an empty plan and on a plan with every figure typed: nothing to look over, and why", () => {
  const e = page(migrate(emptyPlan()));
  assert.deepEqual([e.count, e.planEmpty, e.rows, e.offers], [0, true, [], { fill: [], upgrade: [] }]);
  assert.equal(e.sources.all.length, 63, "the sources fold still lists every table on hand");
  const f = page(migrate(familyPlan(T0)));
  assert.deepEqual([f.count, f.planEmpty], [0, false]);
  assert.deepEqual(compute(migrate(emptyPlan())).sources.all.length, 63, "without a registry passed in it uses its own");
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
  assert.deepEqual([m.legacy, m.label, m.value, m.why, m.sources, m.href], [false, "Mortgage: interest rate", 0.046, "the average on Ohio mortgages people already have", ["mortgage_outstanding_fhfa_by_state_2026q2"], "#/balance/liabilities"]);
  assert.equal(p.debts.find((x) => x.id === "setup-debt-mortgage").rateGuessed, 0.046, "the ledger write mirrors the older flag");
  const bigFirst = d.rows.findIndex((r) => r.weight !== "big" && !r.frozen);
  assert.ok(d.rows.slice(bigFirst).every((r) => r.weight !== "big"), "big ones before the rest");
  assert.ok(d.sources.used.some((s) => s.id === "mortgage_outstanding_fhfa_by_state_2026q2" && s.publisher.includes("FHFA")));
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

// ---- the page drawn with a stand-in for the UI kit (no browser): every element keeps its attributes and children, so the
// words, the links' classes and the Save handler can be read and used (review of C1, 2026-11-06)
async function drawPage(plan) {
  const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  const { estimators: setupEst } = await import("../setup/compute.js");
  const node = (tag, attrs = {}, kids = []) => {
    const n = { tag, attrs: attrs ?? {}, kids: [], style: {}, value: attrs?.value ?? "",
      append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) n.kids.push(c); },
      replaceChildren(...k) { n.kids = []; n.append(...k); }, focus() {},
      get textContent() { return n.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } };
    n.append(...kids); return n;
  };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  const ui = {
    h: (tag, a, ...k) => (isAttrs(a) ? node(tag, a, k) : node(tag, {}, [a, ...k])),
    card: (t, ...k) => node("section", { class: "card" }, [t ? node("h2", {}, [t]) : null, ...k]),
    notice: (kind, t) => node("div", { class: `notice ${kind}` }, [t]),
    button: (label, onClick, o = {}) => node("button", { class: o.class ?? "", onClick }, [label]),
    moneyBox: (o) => { const input = node("input", { ...o, placeholder: o.placeholder }); return { box: node("span", { class: "money-in" }, [input]), input }; },
    moneyValue: (el) => fmt.readAmount(el.value),
  };
  let current = structuredClone(plan);
  const modules = new Map([["overview/guesses", { group: "overview", id: "guesses", estimators, guessTables: TABLES }], ["overview/setup", { group: "overview", id: "setup", estimators: setupEst }]]);
  const draw = () => {
    const root = node("root");
    render(root, { ui, fmt: { ...fmt, today: () => T0 }, plan: current, modules, store: { update(fn) { const next = structuredClone(current); fn(next); current = next; } } });
    return root;
  };
  const all = (n, test, out = []) => { if (n && typeof n === "object") { if (test(n)) out.push(n); for (const k of n.kids) all(k, test, out); } return out; };
  const text = (n) => n.textContent.replace(/\s+/g, " ");
  // the guesses listed (C2: the "Better guesses are ready" card comes first on a plan with older guesses; its rows have no box)
  const listed = (root) => all(root, (n) => n.tag === "section" && /\bcard\b/.test(n.attrs.class ?? "") && !/hero/.test(n.attrs.class ?? "") && !/^Better guesses are ready/.test(text(n)));
  return { draw, all, text, listed, plan: () => current };
}

test("the page on a phone: the source links are 44 px buttons, rates keep a thousandth of a percent, a stale payment is said first", async () => {
  const pg = await drawPage(guessedPlan());
  let root = pg.draw();
  // plumbing 2: the fold's links were inline 16 px text; .btn (core/ui/base.css) is 44 px tall
  const src = pg.all(root, (n) => /\bgs-src\b/.test(n.attrs.class ?? ""));
  const links = src.flatMap((ul) => pg.all(ul, (n) => n.tag === "a"));
  assert.equal(links.length, 63, "one link per table");
  assert.ok(links.every((a) => /\bbtn\b/.test(a.attrs.class) && /\bsmall\b/.test(a.attrs.class)), "every source link is a .btn.small");
  // data 7: "63 tables from 17 publishers", and each table's publisher, table name, as-of line and read date
  const fold = pg.text(pg.all(root, (n) => n.tag === "details").pop());
  assert.match(fold, /Where our guesses come from 63 tables from 17 publishers/);
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
  // E24: NAIC Ohio HO-3 $1,116 (2023) x CPI 2024-2025 1.0570 = $1,179.6 a year -> $1,200; a month 98.3 -> $100
  const ins = guessOf(j, "home.insurance");
  assert.equal(ins.value, 1200);
  assert.equal(Math.round(1116 * 1.057021924231 / 12 / 10) * 10, 100, "7.H's $100 a month");
  assert.equal(ins.why, "the average Ohio homeowner policy, in 2025 prices");
});

test("C2 7.H Pat and Lee's home: typed $450,000; tax $170 and insurance $110 a month", () => {
  const n = patLee(), args = q5b(n, "mortgage", { payment: "1,600" });
  assert.equal(askHomeWithMortgage(n), false, "the home was typed at question 4: not asked again");
  // E23: $450,000 x 0.443% (Arizona) = $1,993.5 a year -> $2,000; a month 166.1 -> 7.H's $170
  const tax = guessOf(n, "home.propertyTax", undefined, args);
  assert.equal(tax.value, 2000);
  assert.equal(tax.uses.value, "typed");
  assert.equal(Math.round(450000 * 0.00443 / 12 / 10) * 10, 170);
  // E24: $1,194 (Arizona HO-3, 2023) x 1.0570 = $1,262.1 a year -> $1,250 saved (R11's $50 steps); a month from the
  // unrounded year 105.2 -> 7.H's $110
  assert.equal(guessOf(n, "home.insurance").value, 1250);
  assert.equal(Math.round(1194 * 1.057021924231 / 12 / 10) * 10, 110);
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

test("C2 7.H Jordan's mortgage: 4.6%, $110,000 owed (7.H $111,000 unrounded), the start tap, $880 if the payment is blank", () => {
  const j = jordan(), args = q5b(j, "mortgage", { payment: "1,100" });
  const rate = guessOf(j, "debt.mortgage.rate", BOX.rate("mortgage"), args);
  assert.equal(rate.value, 0.046, "FHFA: Ohio's average rate on mortgages people have, 4.6%");
  assert.equal(rate.why, "the average on Ohio mortgages people already have");
  assert.deepEqual(labels(rate), ["when you took out the mortgage"]);
  // E21 prior (b), no home value typed: FHFA Ohio balance per loan $156,814 x SCF median-to-mean 0.767 x income ratio
  // 0.6835 x income-adjusted age ratio 1.3516 = $111,114 (7.H's $111,000); spread 0.73 -> two figures: $110,000.
  // The payment's bound: P&I = 1,100 - tax 214.0 - insurance 98.3 = 787.7; pv(4.6%/12, 360, 787.7) = $153,649 > the
  // prior, so the prior stands.
  const owed = guessOf(j, "debt.mortgage.owed", BOX.owed("mortgage"), args);
  assert.equal(owed.value, 110000);
  near(owed.sigma, 0.729, 0.001, "spread from the SCF mean $241,300 and median $185,000");
  // the payment typed is read: it covers the typical balance (B_max $153,650), and the line says so (C2 review, UX 7)
  assert.equal(owed.why, "typical in Ohio at your age and pay; your payment covers it");
  assert.equal(owed.ask?.key, "mortgage-start", "a typed payment: one tap asks when it was taken out");
  assert.equal(owed.ask.question, "When did you take out this mortgage, or last refinance it?");
  assert.deepEqual(owed.ask.options.map((o) => o.label), ["Before 2010", "2010 to 2019", "2020 or 2021", "2022 or later", "Not sure"]);
  assert.equal(guessOf(j, "debt.mortgage.owed", BOX.owed("mortgage"), q5b(j, "mortgage", {})).ask, undefined, "no payment: no tap");
  // the tap: pv(4.6%/12, 360 - months since the middle of the span, 787.7), declared spread 0.15 -> three figures
  //   2010 to 2019: January 2015, 142 months gone -> pv(.., 218, 787.7) = $116,244 -> $116,000 (7.H)
  //   2020 or 2021: January 2021, 70 gone -> $137,731 -> $138,000;  before 2010: July 2007, 232 gone -> $79,563 -> $79,600
  for (const [start, want] of [["2010s", 116000], ["2020-21", 138000], ["pre2010", 79600]]) {
    const t = guessOf(j, "debt.mortgage.owed", BOX.owed("mortgage"), { ...args, start });
    assert.equal(t.value, want, start);
    assert.equal(t.sigma, 0.15);
    assert.equal(t.why, "worked back from your $1,100 payment and when you took it out");
  }
  // 2022 or later: the rate is a new loan's, not the average on loans people have
  const recent = guessOf(j, "debt.mortgage.rate", BOX.rate("mortgage"), { ...args, start: "2022on" });
  assert.equal(recent.why, "the average on new home loans in Ohio lately");
  assert.notEqual(recent.value, 0.046);
  // "Not sure" is no answer: the prior again
  assert.equal(guessOf(j, "debt.mortgage.owed", BOX.owed("mortgage"), { ...args, start: "unsure" }).value, 110000);
  // E22 with every box blank: pmt(4.6%/12, 360, $110,000) = 563.9 + tax 214.0 + insurance 98.3 = $876.2 -> $880
  const none = q5b(j, "mortgage", {});
  const pay = guessOf(j, "debt.mortgage.payment", BOX.payment("mortgage"), none);
  assert.equal(pay.value, 880);
  assert.equal(pay.why, "a loan of about $110,000 at 4.6%, plus Ohio's usual tax and insurance");
  // a typed escrow "no" leaves tax and insurance out
  const noEscrow = structuredClone(j); noEscrow.guide.setup.taps = { escrow: "no" };
  assert.equal(guessOf(noEscrow, "debt.mortgage.payment", BOX.payment("mortgage"), none).value, 560);
});

test("C2 7.H Pat and Lee's mortgage: 4.3%, $210,000 owed (7.H $214,000 unrounded), tap 2010s $201,000", () => {
  const n = patLee(), args = q5b(n, "mortgage", { payment: "1,600" });
  assert.equal(guessOf(n, "debt.mortgage.rate", BOX.rate("mortgage"), args).value, 0.043);
  // E21 prior (a), the home typed: $450,000 x FHFA Arizona loan-to-value 47.6% = $214,200 (7.H); spread 0.73 -> $210,000.
  // The bound: P&I = 1,600 - 166.1 - 105.2 = 1,328.7; pv(4.3%/12, 360, 1,328.7) = $268,494 > the prior.
  const owed = guessOf(n, "debt.mortgage.owed", BOX.owed("mortgage"), args);
  assert.equal(owed.value, 210000);
  assert.equal(owed.why, "48% of your home's value, usual in Arizona; your payment covers it");
  assert.equal(owed.measured, false, "a typed home x an average: a declared spread, not a measured one");
  // the tap, 2010 to 2019: pv(4.3%/12, 218, 1,328.7) = $200,784 -> $201,000 (7.H); 2020 or 2021: $239,386 -> $239,000
  assert.equal(guessOf(n, "debt.mortgage.owed", BOX.owed("mortgage"), { ...args, start: "2010s" }).value, 201000);
  assert.equal(guessOf(n, "debt.mortgage.owed", BOX.owed("mortgage"), { ...args, start: "2020-21" }).value, 239000);
  // a payment too small for the prior caps it: $700 a month -> P&I 428.7 -> pv(.., 360, 428.7) = $86,6xx -> $87,000
  const small = guessOf(n, "debt.mortgage.owed", BOX.owed("mortgage"), { ...args, payment: 700 });
  assert.ok(small.value < 100000 && small.value > 80000, String(small.value));
  assert.equal(small.why, "worked back from your $700 payment at Arizona's usual rate");
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
  const rate = guessOf(j, "debt.mortgage.rate", BOX.rate("mortgage"), args);
  assert.equal(rate.why, "the average on U.S. mortgages people already have");
  assert.deepEqual(labels(rate), ["your state", "when you took out the mortgage"]);
  const tax = guessOf(j, "home.propertyTax", undefined, args), ins = guessOf(j, "home.insurance");
  assert.equal(tax.why, "U.S. homes pay about 0.9% of their value a year");
  assert.deepEqual(labels(tax), ["your state"]);
  // U.S. HO-3 $1,737 x 1.0570 = $1,836 -> $1,850
  assert.equal(ins.value, 1850);
  assert.deepEqual(labels(ins), ["your state"]);
  const owed = guessOf(j, "debt.mortgage.owed", BOX.owed("mortgage"), q5b(j, "mortgage", {}));
  assert.equal(owed.why, "typical for a U.S. mortgage at your age and pay");
  assert.deepEqual(labels(owed), ["what you pay a month", "your state"]);
  // with the payment typed, the U.S. balance per loan is more than $1,100 a month can carry: the bound speaks
  assert.equal(guessOf(j, "debt.mortgage.owed", BOX.owed("mortgage"), args).why, "worked back from your $1,100 payment at the usual rate");
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
  assert.deepEqual([rate.label, rate.from, rate.to], ["Mortgage: interest rate", 0.0724, 0.046]);
  assert.equal(rate.why, "the average on Ohio mortgages people already have");
  const pay = up.find((x) => x.path === "debts[setup-debt-mortgage].minPayment");
  // the older payment: $185,000 at 7.24% over 30 years = $1,261; the new one at 4.6% plus Ohio's tax and insurance on
  // the typed $260,000 home: pmt(4.6%/12, 360, 185,000) = 948.4 + 265.0 + 98.3 = $1,311.7 -> $1,300
  assert.deepEqual([pay.from, pay.to], [1261, 1300]);
  assert.ok(up.every((x) => x.from !== x.to && typeof x.label === "string" && !("est" in x)));
  // Keep the old ones: nothing moves and the card does not come back
  const kept = structuredClone(p); keepOldGuesses(kept, T0);
  assert.deepEqual(kept.guide.guessUpgrade, { at: T0, choice: "kept" });
  assert.equal(kept.debts.find((d) => d.id === "setup-debt-mortgage").rate, 0.0724);
  assert.deepEqual(compute(kept, OPTS).offers.upgrade, []);
  // Use the new guesses: each one is written as a guess (the ledger), and the older flags follow it
  const used = structuredClone(p); useNewGuesses(used, OPTS);
  const d = used.debts.find((x) => x.id === "setup-debt-mortgage");
  assert.equal(d.rate, 0.046);
  assert.equal(d.rateGuessed, 0.046, "the legacy flag mirrors the ledger");
  assert.equal(used.guesses["debts[setup-debt-mortgage].rate"].k, "debt.mortgage.rate");
  assert.equal(d.minPayment, 1300);
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
  assert.match(pg.text(card), /Mortgage: interest rate From 7\.24% to 4\.6% Our new guess: the average on Ohio mortgages people already have\./);
  const buttons = pg.all(card, (n) => n.tag === "button");
  assert.deepEqual(buttons.map((b) => pg.text(b).trim()), ["Use the new guesses", "Keep the old ones"]);
  buttons[0].attrs.onClick();
  root = pg.draw();
  assert.match(pg.text(pg.all(root, (n) => /notice ok/.test(n.attrs.class ?? ""))[0]), /^Saved: the \d+ new guesses are in your plan\./);
  assert.equal(pg.all(root, (n) => n.tag === "section" && /^Better guesses are ready/.test(pg.text(n))).length, 0, "gone once answered");
  assert.equal(pg.plan().debts.find((d) => d.id === "setup-debt-mortgage").rate, 0.046);
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
  assert.equal(netWorth(n, { today: T0 }).netWorth, 563000, "both counted: $978,000 - $210,000 - $205,000");
  const twins = compute(n, OPTS).offers.twins;
  assert.deepEqual(twins.map((t) => [t.kind, t.id, t.name, t.amount, t.twinId, t.twinName, t.twinAmount]), [["loan", "setup-owe-mortgage", "Mortgage", 210000, "acct-real", "Home loan", 205000]]);
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
  assert.equal(netWorth(no, { today: T0 }).netWorth, 563000);
  // a plan with no guesses is never asked (and its page output has no new key)
  assert.equal("twins" in compute(migrate(familyPlan(T0)), OPTS).offers, false);
});

// C2 verify: "No, two loans" is kept for that pair only. Pat and Lee add a HELOC on Net worth and answer No (it is a second
// loan); later they add their real home loan: before the fix it was never asked about, so our guessed $210,000 and their
// $205,000 were both counted in silence (net worth $563,000 where it is $743,000 with the HELOC).
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
  assert.equal(netWorth(n, { today: T0 }).netWorth, 533000, "$978,000 - $210,000 - $30,000 - $205,000: counted twice until answered");
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
  assert.match(pg.text(card), /You added Home loan, \$205,000\. We also have Mortgage, with our guess of about \$210,000 still owed\./);
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
  assert.equal(netWorth(j, { today: T0 }).netWorth, 400000, "both counted: $210,000 + $300,000 - $110,000");
  const twins = compute(j, OPTS).offers.twins;
  assert.deepEqual(twins.map((t) => [t.kind, t.id, t.amount, t.twinId, t.twinAmount]), [["home", "setup-have-home", 210000, "acct-house", 300000]]);
  sameLoan(j, "setup-have-home", "acct-house");
  assert.equal(netWorth(j, { today: T0 }).netWorth, 190000, "counted once: $300,000 - $110,000");
  assert.equal(j.property[0].accountId, "acct-house", "the Home page's entry follows the home that stays");
  assert.equal(isGuessIn(j, "accounts[setup-have-home].balance"), false);
  const pg = await drawPage((() => { const k = jordan(); const b = structuredClone(k); S.applyOweAmounts(k, { mortgage: { payment: 1100 } }, T0, { guess: (kk, o) => estimate(b, kk, { ...OPTS, ...o }) }); k.accounts.push({ id: "acct-house", name: "House", type: "property", balance: 300000, asOf: T0, institution: "", ownerId: "", history: [], notes: "" }); return k; })());
  const card = pg.all(pg.draw(), (n2) => n2.tag === "section" && /^Is this the same home\?/.test(pg.text(n2)))[0];
  assert.ok(card, "the card is drawn with the home's words");
  assert.match(pg.text(card), /You added House, \$300,000\. We also have Home, with our guess of about \$210,000\. If they're the same home, it's counted twice now\./);
  assert.deepEqual(pg.all(card, (x) => x.tag === "button").map((b) => pg.text(b).trim()), ["Yes, the same home", "No, two homes"]);
});
const isGuessIn = (p, path) => Object.prototype.hasOwnProperty.call(p.guesses ?? {}, path);

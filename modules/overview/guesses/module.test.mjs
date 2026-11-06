// modules/overview/guesses/module.test.mjs -- "Our guesses for you" in commit C1: the bundled tables (sources, shape,
// spot values, derived constants, nothing refused got in), the estimator contract for every key that ships (this
// module's and the setup's), the import rule, the gate (EUR and "outside the U.S." get nothing; a blank state gets the
// national figure), the coverage file and the page's compute. The plumbing has its own tests in tests/estimate-*.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { compute, estimators, TABLES, LEGACY_WORDS } from "./compute.js";
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
import { estimators as setupEstimators } from "../setup/compute.js";
import { estimate, mergeEstimators, checkEstimators, markGuess, saveField, applies } from "../../../core/estimate/index.js";
import { emptyPlan, migrate } from "../../../core/schema/migrate.js";
import { guessedPlan } from "../../../qa/fixtures/guessed-plan.mjs";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
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
  assert.deepEqual(keys.sort(), ["debt.credit.rate", "debt.loan.rate", "debt.mortgage.rate", "debt.student.rate", "overview/setup:cushionFunds", "overview/setup:cushionTarget", "overview/setup:retireSpend", "overview/setup:ss"]);
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
  assert.equal(BUILT, 1);
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
  assert.equal(COVERAGE.filter((r) => !r.how.startsWith("later:")).length, 48);
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
  assert.deepEqual([m.legacy, m.label, m.value, m.why, m.sources, m.href], [false, "Mortgage interest rate", 0.046, "the average on Ohio mortgages people already have", ["mortgage_outstanding_fhfa_by_state_2026q2"], "#/balance/liabilities"]);
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
  return { draw, all, text, plan: () => current };
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
  const rate = pg.all(root, (n) => n.tag === "li" && /Mortgage: interest rate/.test(n.textContent))[0];
  const input = pg.all(rate, (n) => n.tag === "input")[0];
  assert.equal(input.attrs.placeholder, "7.24");
  input.value = "6.125";
  pg.all(rate, (n) => n.tag === "form")[0].attrs.onSubmit({ preventDefault() {} });
  assert.equal(pg.plan().debts.find((d) => d.id === "setup-debt-mortgage").rate, 0.06125);
  root = pg.draw();
  const said = pg.text(pg.all(root, (n) => /notice ok/.test(n.attrs.class ?? ""))[0]);
  assert.equal(said, "Saved. Mortgage: interest rate is 6.125% now. It's yours, so we won't change it. Your payment of $1,261 a month was worked out at the old rate, so type your real one too.");
  const first = pg.all(root, (n) => n.tag === "li")[0];
  assert.match(pg.text(first), /^Mortgage: payment a month \$1,261 a month We worked this out from the rate and what you owed back then\. They've changed, so type your real payment\./);
  assert.doesNotMatch(pg.text(first), /Our guess:/);
  assert.match(pg.text(pg.all(root, (n) => n.tag === "section" && /\bcard\b/.test(n.attrs.class ?? "") && !/hero/.test(n.attrs.class ?? ""))[0]), /^Type these first/);
  // a rate of 6.875% shows as 6.875 in its box
  const p = guessedPlan(); p.debts.find((d) => d.id === "setup-debt-mortgage").rate = p.debts.find((d) => d.id === "setup-debt-mortgage").rateGuessed = 0.06875;
  const pg2 = await drawPage(p);
  const r2 = pg2.all(pg2.draw(), (n) => n.tag === "li" && /Mortgage: interest rate/.test(n.textContent))[0];
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

// tools/build-guess-data.mjs -- builds the sourced tables behind "our guesses" (modules/overview/guesses/data/*.js) from
// the research step's JSON files. Run it again when a table is refreshed (each file's header names the next release).
//
//   node tools/build-guess-data.mjs <folder with spend.json, balances.json, pay.json, debts.json, home.json, insurance-health.json>
//   node tools/build-guess-data.mjs vendor/guess-data            (a rebuild from the copy the first run keeps)
//   node tools/build-guess-data.mjs <folder> --check             build in memory and compare with the files on disk
//
// What it does (docs: modules/overview/guesses/README.md "Data"):
// 1. Reads the research files. Stops (exit 1) with a list when a table on the SELECT list below is missing or lacks a
//    publisher, a URL, a vintage or a read date (the table's own `source.readOn`, else its file's `readOn`).
// 2. Refuses any table that is the subject of an entry on its file's `unverified` list, and any id on the never-bundled
//    list (USDA food plans, Fannie Mae's rule of thumb, the LIMRA, ACLI and NCS life and disability tables). The entries
//    are prose, so tools/guess-data-unverified.mjs maps each one by hand to the tables it concerns and the substitutes
//    bundled instead; an entry with no row there, or a row that matches no entry, stops the build too.
// 3. Keeps only the SELECT rows and fields, columnar ({ cols, rows: { key: [value per col] } }), values exactly as
//    published (never rounded or inflated here). Drops `notes` and every field not listed; keeps a URL only when it
//    starts with https://.
// 4. Writes data/<file>.js with a header, `READ_ON`, `T` (each table: title, publisher, table, url, vintage, readOn,
//    stat, unit, dollarsOf, industry, derived, by, cols, rows, and for the sources fold on screen: org, shownBy,
//    tableShown, asOf) and `DERIVED` (constants worked out from T, each with
//    { value, from, how }; tests recompute them), plus data/index.js (READ_ON per file, NEWEST_READ, STATES,
//    STATE_NAME, STATE_REGION).
// 5. Runs tools/leak-guard.mjs on the folder and exits 1 when it objects.
// 6. Prints one line per table: rows kept, bytes.
// It also copies the research files to vendor/guess-data/ (git-ignored) and lists them in vendor/sources.json when that
// file exists, so the next rebuild needs nothing outside the repo.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { NEVER, unverifiedProblems } from "./guess-data-unverified.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "modules", "overview", "guesses", "data");
const args = process.argv.slice(2);
const CHECK = args.includes("--check");
const SRC = args.find((a) => !a.startsWith("--"));
if (!SRC) { console.error("usage: node tools/build-guess-data.mjs <folder with the research *.json> [--check]"); process.exit(2); }
const srcDir = path.resolve(process.cwd(), SRC);

// ---- states: 50 states, DC and the U.S. as a whole (Puerto Rico is left out: the plan's state list has no PR)
const STATE_NAME = {
  US: "United States", AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana",
  IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia",
  WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};
const STATES = ["US", ...Object.keys(STATE_NAME).filter((c) => c !== "US").sort()];
const CODE_OF = new Map(Object.entries(STATE_NAME).flatMap(([c, n]) => [[c.toLowerCase(), c], [n.toLowerCase(), c]]));
const stateCode = (v) => CODE_OF.get(String(v ?? "").trim().toLowerCase()) ?? null;
// Census Bureau regions (the CE survey's regions), "Census Regions and Divisions of the United States"
const REGION = {
  northeast: ["CT", "ME", "MA", "NH", "RI", "VT", "NJ", "NY", "PA"],
  midwest: ["IL", "IN", "MI", "OH", "WI", "IA", "KS", "MN", "MO", "NE", "ND", "SD"],
  south: ["DE", "DC", "FL", "GA", "MD", "NC", "SC", "VA", "WV", "AL", "KY", "MS", "TN", "AR", "LA", "OK", "TX"],
  west: ["AZ", "CO", "ID", "MT", "NV", "NM", "UT", "WY", "AK", "CA", "HI", "OR", "WA"],
};

// ---- never bundled (spec 6.4; NEVER in tools/guess-data-unverified.mjs): a recommended diet is not spending; a rule of
// thumb is advice; no estimator reads the rest yet

// ---- what the sources fold on the guesses page shows (review of C1, 2026-11-06, data 7): the research's `publisher` and
// `vintage` carry working notes ("(see eia_...)", "(file source line: ...)"), so each table also gets the organisation
// (counted for "63 tables from 17 publishers"), a plain publisher line, the publisher's table name without file names or
// chart ids, and a plain "as of" line. A publisher that matches no row here stops the build.
const PUBLISHERS = [
  [/^U\.S\. Bureau of Labor Statistics, Consumer Expenditure Surveys$/, "U.S. Bureau of Labor Statistics", "U.S. Bureau of Labor Statistics, Consumer Expenditure Surveys"],
  [/^U\.S\. Census Bureau, American Community Survey$/, "U.S. Census Bureau", "U.S. Census Bureau, American Community Survey"],
  [/^U\.S\. Census Bureau, Current Population Survey/, "U.S. Census Bureau", "U.S. Census Bureau, Current Population Survey"],
  [/^U\.S\. Census Bureau and HUD, American Housing Survey$/, "U.S. Census Bureau and HUD", "U.S. Census Bureau and HUD, American Housing Survey"],
  [/U\.S\. Energy Information Administration/, "U.S. Energy Information Administration", "U.S. Energy Information Administration"],
  [/^National Association of Insurance Commissioners/, "National Association of Insurance Commissioners", "National Association of Insurance Commissioners"],
  [/^Child Care Aware of America/, "Child Care Aware of America", "Child Care Aware of America"],
  [/^U\.S\. Department of Labor, Women's Bureau/, "U.S. Department of Labor", "U.S. Department of Labor, Women's Bureau"],
  [/Survey of Consumer Finances|Federal Reserve SCF/, "Federal Reserve Board", "Federal Reserve Board, Survey of Consumer Finances"],
  [/^Board of Governors of the Federal Reserve System$/, "Federal Reserve Board", "Federal Reserve Board"],
  [/^Vanguard/, "Vanguard", "Vanguard, How America Saves"],
  [/^Federal Housing Finance Agency/, "Federal Housing Finance Agency", "Federal Housing Finance Agency"],
  [/^Freddie Mac$/, "Freddie Mac", "Freddie Mac"],
  [/^U\.S\. Department of Education, Federal Student Aid$/, "U.S. Department of Education", "U.S. Department of Education, Federal Student Aid"],
  [/^Consumer Financial Protection Bureau/, "Consumer Financial Protection Bureau", "Consumer Financial Protection Bureau"],
  [/^Experian Automotive/, "Experian", "Experian Automotive"],
  [/^KFF, Employer Health Benefits Survey$/, "KFF", "KFF, Employer Health Benefits Survey"],
  [/^KFF State Health Facts$/, "KFF", "KFF State Health Facts"],
  [/^KFF \(analysis of NAIC Medicare Supplement data/, "KFF", "KFF, from NAIC Medigap data"],
  [/^CMS Center for Consumer Information and Insurance Oversight/, "Centers for Medicare & Medicaid Services", "Centers for Medicare & Medicaid Services"],
  [/^Centers for Medicare & Medicaid Services/, "Centers for Medicare & Medicaid Services", "Centers for Medicare & Medicaid Services"],
  [/^Social Security Administration/, "Social Security Administration", "Social Security Administration"],
];
/** The publisher's table name without file names, chart ids or field lists (the link goes to the table itself). */
const tablePlain = (t) => String(t ?? "")
  .replace(/\s*\((?:[^()]*\.(?:csv|xlsx?|zip|pdf)\b[^()]*|Flourish[^()]*|Datawrapper[^()]*|columns [^()]*)\)/gi, "")
  .replace(/,\s*fields [A-Z_, ]+$/, "")
  .replace(/;\s*file [^;]*\.(?:csv|xlsx?|zip|pdf)\b[^;]*/gi, "")
  .replace(/\s+/g, " ").trim();

// ---- the SELECT list: which research tables become which compact tables, and which cells they keep
const CE_ITEMS = ["foodAtHome", "housekeepingSupplies", "utilities", "electricity", "naturalGas", "fuelOilOtherFuels", "telephoneServices", "rentedDwellings",
  "gasolineAndOtherFuels", "vehicleMaintenanceRepairs", "vehicleRentalLeasesLicensesOther", "vehicleInsurance", "publicAndOtherTransportation", "healthcare",
  "medicalServices", "drugs", "medicalSupplies", "lifeAndOtherPersonalInsurance", "foodAwayFromHome", "entertainment", "alcoholicBeverages", "apparelAndServices",
  "personalCare", "furnishingsAndEquipment", "reading", "tobacco", "miscellaneous", "otherHouseholdExpenses", "totalExpenditures", "personalInsuranceAndPensions",
  "cashContributions", "education"];
const CE_PROFILE = ["incomeBeforeTaxesMean", "pctRenter", "mortgagePrincipalPaid", "persons", "vehicles"];
const CE_BY = { incomeQuintile: "income fifth", householdComposition: "kind of household", region: "region", housingTenure: "renting or owning", ageOfReferencePerson: "age" };
const SCF_ITEMS = ["retirementAccounts", "transactionAccounts", "pooledInvestmentFunds", "stocksDirectlyHeld", "vehicles", "primaryResidence", "mortgageOnPrimaryResidence",
  "vehicleLoans", "creditCardBalances", "educationLoans", "otherInstallmentLoans"];
const SCF_GROUPS = ["all", "age", "incomePercentile"];
const FHFA_STATE = ["Active first-lien mortgages (thousands)", "Average contract interest rate (%)", "Average mark-to-market loan-to-value (%)", "Average monthly payment incl. escrow ($)", "Unpaid principal balance ($ billions)"];
const INDUSTRY = /^(vanguard_|kff_|auto_loan_terms_experian|auto_rate_by_credit_tier_experian|home_buyer_down_payment_nar|limra_|avg_balance_per_borrower_transunion)/;

const SELECT = [
  // spend.js: BLS Consumer Expenditure Surveys 2025 (means), the 2023 after-tax income, rent, energy, insurance, childcare
  ...Object.entries(CE_BY).map(([by, words]) => ({ out: "spend", id: `ce2025_spend_by_${by}`, title: `Average yearly spending by category, by ${words}`, stat: "mean", col: by, row: "item", keep: CE_ITEMS, unit: "dollars a year per household", next: "CE 2026: September 2027", asOf: "2025 figures, published 2026", dollarsOf: 2025 })),
  ...Object.entries(CE_BY).map(([by, words]) => ({ out: "spend", id: `ce2025_profile_by_${by}`, title: `Households and their income before taxes, by ${words}`, stat: "mean", col: by, row: "field", keep: CE_PROFILE, unit: "mixed: dollars a year (income, principal), percent (pctRenter), people and vehicles per household", asOf: "2025 figures, published 2026", dollarsOf: 2025 })),
  ...["incomeQuintile", "region", "ageOfReferencePerson"].map((by) => ({ out: "spend", id: `ce2023_aftertax_income_by_${by}`, title: `Income before and after income taxes, by ${CE_BY[by]} (2023, the newest year published)`, stat: "mean", col: by, row: "field", keep: ["incomeBeforeTaxesMean", "incomeAfterTaxesMean"], unit: "dollars a year per household", asOf: "2023 figures, the newest year with income after taxes", dollarsOf: 2023 })),
  { out: "spend", id: "acs2025_median_gross_rent_by_state", title: "Median rent with utilities, by state", stat: "median", col: "state", row: null, rowName: "grossRent", unit: "dollars a month", next: "ACS 2026: September 2027", asOf: "2025 figures, published October 2026", dollarsOf: 2025 },
  { out: "spend", id: "eia2025_residential_electric_bill_by_state", title: "Average home electric bill, by state", stat: "mean", col: "state", row: null, rowName: "bill", unit: "dollars a month per home", asOf: "2025 figures, published October 2026", dollarsOf: 2025 },
  { out: "spend", id: "eia2024_residential_natural_gas_bill_by_state_DERIVED", title: "Average home gas bill, by state (worked out from EIA's price, deliveries and customers)", stat: "mean", col: "state", row: null, rowName: "bill", unit: "dollars a month per gas customer", derived: true, asOf: "2024 figures, published October 2026", dollarsOf: 2024, tableShown: "Natural gas prices, deliveries and customers by state, 2024 (worked out into a monthly bill)" },
  { out: "spend", id: "naic2023_auto_insurance_by_state", title: "Average car insurance spending per insured car, by state", stat: "mean", col: "state", row: "measure", where: { year: [2023, "2023"] }, keep: ["averageExpenditure"], unit: "dollars a year per insured vehicle (2023 dollars)", asOf: "2023 figures, published February 2026", dollarsOf: 2023 },
  { out: "spend", id: "naic2023_homeowners_premium_by_state", title: "Average homeowner insurance premium (HO-3 policy), by state", stat: "mean", col: "state", row: "policyForm", keep: ["HO-3"], unit: "dollars a year per policy (2023 dollars)", asOf: "2023 figures, published July 2026", dollarsOf: 2023 },
  { out: "spend", id: "ccaoa2025_childcare_annual_price_by_state", title: "Price of full-time child care, by state, setting and age", stat: "mean", col: "state", row: ["setting", "age"], where: { age: ["infant", "toddler", "fourYearOld", "beforeAfterSchool"] }, unit: "dollars a year per child (2025 prices)", industry: false, asOf: "2025 prices, published May 2026", dollarsOf: 2025 },
  { out: "spend", id: "ndcp2022_childcare_weekly_price_by_state", title: "Median weekly price of full-time child care, by state (2022)", stat: "median", col: "state", row: ["setting", "age"], unit: "dollars a week per child (2022 prices)", asOf: "2022 prices, published November 2024", dollarsOf: 2022, tableShown: "National Database of Childcare Prices 2022, state-level estimates" },
  { out: "spend", id: "ndcp_childcare_weekly_price_fallback_older_years", title: "Median weekly child care price from an earlier year, where 2022 is missing", stat: "median", col: "state", row: ["setting", "age"], extra: { year: "studyYear" }, unit: "dollars a week per child (prices of the study year shown)", asOf: "Prices from an earlier year where 2022 is missing, published November 2024", dollarsBy: "cell", tableShown: "National Database of Childcare Prices 2008-2022, state-level estimates" },
  // balances.js: Federal Reserve Survey of Consumer Finances 2025, Vanguard How America Saves 2026
  { out: "balances", id: "scf2025_median_value_if_held", title: "Median amount among families who have each kind of asset or debt", stat: "median", col: ["groupBy", "group"], where: { groupBy: SCF_GROUPS }, row: "item", keep: SCF_ITEMS, unit: "dollars (2025)", asOf: "2025 survey, published October 2026", dollarsOf: 2025 },
  { out: "balances", id: "scf2025_mean_value_if_held", title: "Average amount among families who have each kind of asset or debt", stat: "mean", col: ["groupBy", "group"], where: { groupBy: SCF_GROUPS }, row: "item", keep: SCF_ITEMS, unit: "dollars (2025)", asOf: "2025 survey, published October 2026", dollarsOf: 2025 },
  { out: "balances", id: "scf2025_pct_families_holding", title: "Share of families who have each kind of asset or debt", stat: "share", col: ["groupBy", "group"], where: { groupBy: SCF_GROUPS }, row: "item", keep: SCF_ITEMS, unit: "percent of families", asOf: "2025 survey, published October 2026" },
  { out: "balances", id: "scf2025_family_income", title: "Median family income, by age", stat: "median", col: ["groupBy", "group"], where: { groupBy: ["all", "age"] }, row: "stat", keep: ["median"], unit: "dollars a year (2025)", asOf: "2025 survey, published October 2026", dollarsOf: 2025 },
  { out: "balances", id: "scf2025_actual_income_percentile_cutoffs_derived", title: "Family income at each percentile (worked out from the survey's public file)", stat: "percentile", col: "percentile", row: null, rowName: "income", unit: "dollars a year (2025)", derived: true, asOf: "2025 survey, published October 2026", dollarsOf: 2025, tableShown: "2025 Survey of Consumer Finances, public summary file: family income" },
  { out: "balances", id: "vanguard_has2026_401k_balance_by_age", title: "401(k) balances, by age and pay", stat: "median and mean", col: ["groupBy", "group"], where: { groupBy: ["all", "age", "income"] }, row: "stat", keep: ["median", "average"], colExtra: { min: "min", max: "max" }, unit: "dollars (end of 2025)", asOf: "End of 2025, published 2026", dollarsOf: 2025 },
  // pay.js: Census ACS 2025, CPS ASEC 2026, Vanguard 2026
  { out: "pay", id: "acs_median_earnings_by_state", title: "Median yearly earnings, by state", stat: "median", col: "state", row: "workers", keep: ["full-time year-round, both sexes", "all people with earnings, both sexes"], unit: "dollars a year (2025)", asOf: "2025 figures, published October 2026", dollarsOf: 2025 },
  { out: "pay", id: "cps_ftyr_income_by_age5", title: "Income of people working full time all year, by age", stat: "median and mean", col: "ageBand", row: "workers", extra: { mean: "mean" }, unit: "dollars a year (2025)", asOf: "2025 income, published September 2026", dollarsOf: 2025 },
  { out: "pay", id: "cps_median_earnings_by_age", title: "Median yearly earnings, by age", stat: "median", col: "ageBand", row: "workers", unit: "dollars a year (2025)", asOf: "2025 earnings, published September 2026", dollarsOf: 2025 },
  { out: "pay", id: "vanguard_has2026_headline", title: "401(k) saving at a glance", stat: "as published", col: null, row: "measure", keep: ["participant-weighted participation rate", "average participant deferral rate", "median participant deferral rate", "average value of promised employer match (plans with single/multitier match)", "median value of promised employer match (plans with single/multitier match)", "average employee deferral needed to get the full match", "median employee deferral needed to get the full match"], unit: "percent", asOf: "2025 figures, published June 2026" },
  { out: "pay", id: "vanguard_has2026_deferral_by_income_age", title: "Share of pay people put in, by pay and age", stat: "mean", col: ["group", "band"], where: { group: ["all", "income", "age"] }, row: null, rowName: "deferral", unit: "percent of pay", asOf: "2025 figures, published June 2026" },
  { out: "pay", id: "vanguard_has2026_participation_by_income_age", title: "Share of people who put money in, by pay and age", stat: "share", col: ["group", "band"], where: { group: ["all", "income", "age"], enrollment: ["all plans"] }, row: null, rowName: "participation", unit: "percent of eligible employees", asOf: "2025 figures, published June 2026" },
  { out: "pay", id: "vanguard_has2026_top_match_formulas", title: "The most common employer match formulas", stat: "share", col: null, row: "matchFormula", unit: "percent of plans with a match", asOf: "2025 figures, published June 2026" },
  { out: "pay", id: "vanguard_has2026_deferral_distribution", title: "How much of pay people put in, spread", stat: "share", col: null, row: "deferralRate", unit: "percent of participants", asOf: "2025 figures, published June 2026" },
  // debts.js: Federal Reserve G.19, FHFA National Mortgage Database, Freddie Mac PMMS, Education, CFPB, Experian
  { out: "debts", id: "cc_apr_fed_g19", title: "Credit card interest rate on accounts that pay interest", stat: "average", col: "period", latest: "period", row: "series", keep: ["Credit card plans, accounts assessed interest (commercial banks)"], unit: "percent a year", asOf: "August 2026, published October 2026" },
  { out: "debts", id: "auto_personal_rate_fed_g19", title: "New-car and personal loan rates at banks", stat: "average", col: "period", latest: "period", row: "series", keep: ["New car loan, 72-month (commercial banks)", "Personal loan, 24-month (commercial banks)"], unit: "percent a year", asOf: "August 2026, published October 2026" },
  { out: "debts", id: "mortgage_outstanding_fhfa_by_state_2026q2", title: "Mortgages people already have: rate, size and payment, by state", stat: "average", col: "state", row: "measure", keep: FHFA_STATE, unit: "see each row", asOf: "April to June 2026, published September 2026", dollarsOf: 2026 },
  { out: "debts", id: "mortgage_outstanding_fhfa_national", title: "Mortgages people already have: rate, size and payment, U.S.", stat: "average", col: "weighting", where: { quarter: ["2026Q2"] }, row: "measure", unit: "see each row", asOf: "April to June 2026, published September 2026", dollarsOf: 2026 },
  { out: "debts", id: "mortgage_new_purchase_fhfa_by_state_2025", title: "New home-purchase mortgages in 2025: rate, loan-to-value and term, by state", stat: "average", col: "state", row: "measure", keep: ["Average contract interest rate (%)", "Average loan-to-value, first lien (%)", "Average term to maturity (years)"], unit: "see each row", asOf: "Loans made in 2025, published September 2026" },
  // the U.S. row of the same, for "taken out 2022 or later" with no state (review of C1, 2026-11-06, data 3): by loan count, like the state rows
  { out: "debts", id: "mortgage_new_loans_fhfa_national_2025", title: "New home-purchase mortgages in 2025: rate, loan-to-value and term, U.S.", stat: "average", col: "market", where: { market: ["All Mortgages (Home Purchase)"], weighting: ["by loan count"] }, row: "measure", keep: ["Average contract interest rate (%)", "Average loan-to-value, first lien (%)", "Average term to maturity (years)"], unit: "see each row", asOf: "Loans made in 2025, published September 2026" },
  { out: "debts", id: "mortgage_rate_pmms_weekly_2026", title: "Rate on a new 30-year fixed mortgage, latest week", stat: "average", col: "weekEnding", latest: "weekEnding", row: "product", keep: ["30-year fixed"], unit: "percent a year", asOf: "The week of October 29, 2026", tableShown: "Primary Mortgage Market Survey, weekly history" },
  { out: "debts", id: "student_loan_rates_federal", title: "Federal student loan rates for loans first paid out in 2026-27", stat: "as set by law", col: "awardYear", where: { awardYear: (v) => String(v).startsWith("2026-27") }, row: "loanType", unit: "percent a year", asOf: "Loans first paid out July 2026 to June 2027" },
  { out: "debts", id: "card_minimum_payment_rule_cfpb", title: "How card minimum payments are usually set", stat: "most common", col: null, row: "measure", keep: ["Most common percent-of-balance component (percent of statement balance; interest, fees and past-due amounts added on top)", "Most common dollar floor ($; minimum is the higher of the floor or the formula, never more than the balance)"], unit: "percent; dollars", asOf: "December 2025 report", dollarsOf: 2025 },
  { out: "debts", id: "auto_loan_terms_experian_q2_2026", title: "Car loans in mid-2026: amount, payment, rate and term", stat: "average", col: "vehicle", where: { year: ["2026Q2"] }, row: "measure", unit: "see each row", asOf: "April to June 2026", dollarsOf: 2026 },
  { out: "debts", id: "auto_rate_by_credit_tier_experian_q2_2026", title: "Car loan rates, new and used", stat: "average", col: "vehicle", row: "riskTier", keep: ["All"], unit: "percent a year", asOf: "April to June 2026" },
  // home.js: Census ACS 2025, FHFA House Price Index, the 2023 American Housing Survey
  { out: "home", id: "acs2025_median_home_value_by_state_and_mortgage_status", title: "Median home value, by state, with and without a mortgage", stat: "median", col: "state", row: "mortgageStatus", unit: "dollars (2025)", next: "ACS 2026: September 2027", asOf: "2025 figures, published October 2026", dollarsOf: 2025 },
  { out: "home", id: "acs2025_median_home_value_by_state", title: "Median home value, by state", stat: "median", col: "state", row: null, rowName: "value", unit: "dollars (2025)", asOf: "2025 figures, published October 2026", dollarsOf: 2025 },
  { out: "home", id: "acs2025_effective_property_tax_rate_by_state", title: "Property tax as a share of home value, by state (median tax over median value)", stat: "ratio of medians", col: "state", row: "method", keep: ["median taxes / median value"], unit: "percent of value a year", derived: true, asOf: "2025 figures, published October 2026" },
  { out: "home", id: "acs2025_hoa_condo_fee_by_state", title: "HOA and condo fees, by state", stat: "median and share", col: "state", row: "measure", unit: "percent; dollars a month (2025)", asOf: "2025 figures, published October 2026", dollarsOf: 2025 },
  { out: "home", id: "acs2025_year_moved_in_by_age_us", title: "When owners and renters moved in, by age", stat: "count", col: "movedIn", row: ["tenure", "ageOfHouseholder"], unit: "households", asOf: "2025 figures, published October 2026" },
  { out: "home", id: "acs2025_median_year_moved_in_by_state", title: "Median year people moved into their home, by state", stat: "median", col: "state", row: "tenure", unit: "calendar year", asOf: "2025 figures, published October 2026" },
  { out: "home", id: "acs2025_homeownership_by_age_us", title: "Share of households who own their home, by age", stat: "share", col: "ageOfHouseholder", row: null, rowName: "owners", unit: "percent", asOf: "2025 figures, published October 2026" },
  { out: "home", id: "fhfa_hpi_at_state_annual", title: "Home price index, by state and year", stat: "index", col: "state", row: "year", where: { year: (y) => Number(y) >= 1990 }, unit: "index (each state's first year = 100)", asOf: "1990 to 2025, published March 2026" },
  { out: "home", id: "ahs2023_routine_maintenance_spending", title: "What owners spend on routine upkeep in a year (worked out from the 2023 American Housing Survey's public file)", stat: "median, mean and ratio", col: "group", row: "measure", unit: "dollars a year (2023 dollars); percent of value", derived: true, asOf: "2023 survey, the newest", dollarsOf: 2023, tableShown: "2023 American Housing Survey, public-use file: routine upkeep and home value" },
  // health.js: KFF Employer Health Benefits Survey 2026, KFF and CMS marketplace and Medicare tables
  { out: "health", id: "kff_ehbs2026_premiums", title: "What workers pay toward job-based health insurance", stat: "mean", col: "coverage", where: { firmGroup: ["all firms"] }, row: "measure", keep: ["worker contribution, annual", "worker contribution, monthly"], unit: "dollars (2026)", asOf: "2026 figures, published October 2026", dollarsOf: 2026 },
  { out: "health", id: "kff_aca_benchmark_premium_40yo", title: "Marketplace benchmark plan for a 40-year-old before help, by state", stat: "average", col: "state", row: "year", where: { year: [2026, 2027, "2026", "2027"] }, unit: "dollars a month", asOf: "Plan years 2026 and 2027", dollarsBy: "row" },
  { out: "health", id: "cms_aca_age_rating_curve", title: "How marketplace prices rise with age (federal default curve)", stat: "ratio", col: "age", row: "curve", keep: ["default"], unit: "ratio to the age-21 price", asOf: "In use since 2018, the newest published" },
  { out: "health", id: "cms_medicare_2026_parts_ab", title: "Medicare Part B premium and deductible, 2026", stat: "as set", col: null, row: ["part", "item"], where: { part: ["partB"], item: ["standardMonthlyPremium", "annualDeductible"] }, unit: "dollars", asOf: "2026 figures, published November 2025", dollarsOf: 2026 },
  { out: "health", id: "cms_medicare_part_d_parameters", title: "Medicare drug plan base premium", stat: "as set", col: "year", row: "item", keep: ["baseBeneficiaryPremium"], unit: "dollars a month", asOf: "2026 and 2027 figures", dollarsBy: "col", tableShown: "Medicare Part D base beneficiary premium, 2026 and 2027 announcements" },
  { out: "health", id: "kff_medigap_average_premium_2025", title: "Average Medigap premium (Plan G), by state", stat: "mean", col: "state", row: "plan", keep: ["G"], unit: "dollars a month (2025)", asOf: "2025 premiums, published October 2026", dollarsOf: 2025 },
  // retire.js: Social Security Administration
  { out: "retire", id: "ssa_snapshot_2026_09_average_benefit", title: "Average Social Security benefit, September 2026", stat: "mean", col: null, row: "beneficiaryType", keep: ["Retired workers", "Spouses of retired workers", "Disabled workers"], unit: "dollars a month", asOf: "September 2026, published October 2026", dollarsOf: 2026 },
  { out: "retire", id: "ssa_retired_worker_benefit_by_age_sex_2025", title: "Average retired-worker benefit, by age", stat: "mean", col: "ageBand", row: ["sex", "claimed"], unit: "dollars a month (December 2025)", asOf: "December 2025, published 2026", dollarsOf: 2025 },
];
const FILE_NOTE = {
  spend: "BLS CE 2026: September 2027; ACS 2026 1-year: September 2027; EIA 2026: October 2027; NAIC 2024: 2026-27; Child Care Aware 2026: spring 2027",
  balances: "SCF 2028: autumn 2029; Vanguard How America Saves 2027: June 2027",
  pay: "ACS 2026 1-year: September 2027; CPS ASEC 2027: September 2027; Vanguard How America Saves 2027: June 2027",
  debts: "Fed G.19: monthly; FHFA NMDB: quarterly; Freddie Mac PMMS: weekly; Experian: quarterly; Federal student loan rates: each May",
  home: "ACS 2026 1-year: September 2027; FHFA HPI: quarterly (annual state series each spring); AHS 2025: 2026-27",
  health: "KFF EHBS 2027: October 2027; marketplace benchmarks: each autumn; Medicare 2027 figures: November 2026",
  retire: "SSA Monthly Statistical Snapshot: monthly; SSA Supplement: each spring",
};

// ---- read
const problems = [];
const research = {};
for (const f of fs.readdirSync(srcDir).filter((x) => x.endsWith(".json")).sort()) {
  try { research[f] = JSON.parse(fs.readFileSync(path.join(srcDir, f), "utf8")); } catch (e) { problems.push(`${f}: not JSON (${e.message})`); }
}
const byId = new Map();
for (const [f, j] of Object.entries(research)) for (const t of j?.tables ?? []) byId.set(t.id, { t, file: f, j });
// the unverified lists and the never-bundled ids (tools/guess-data-unverified.mjs): any problem stops the build
problems.push(...unverifiedProblems(research, SELECT.map((s) => s.id)));

const httpsOnly = (u) => String(u ?? "").split(/\s*;\s*|\s+/).find((x) => x.startsWith("https://")) ?? null;
const yearOf = (s) => { const m = /\b(19|20)\d{2}\b/.exec(String(s ?? "")); return m ? Number(m[0]) : null; };
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const keyOf = (r, dims) => (Array.isArray(dims) ? dims.map((d) => r[d]).filter((v) => v !== undefined && v !== null && v !== "").join(":") : String(r[dims]));
const allow = (v, rule) => (typeof rule === "function" ? rule(v) : Array.isArray(rule) ? rule.some((x) => String(x) === String(v)) : String(rule) === String(v));

function compact(sel) {
  const hit = byId.get(sel.id);
  if (!hit) { problems.push(`${sel.id}: missing from the research files`); return null; }
  const { t, file, j } = hit;
  const src = t.source ?? {};
  const readOn = src.readOn ?? t.readOn ?? j.readOn ?? null;
  const url = httpsOnly(src.url);
  for (const [k, v] of [["publisher", src.publisher], ["url", url], ["vintage", src.vintage], ["read date", readOn]]) if (!v) problems.push(`${sel.id}: no ${k}${k === "url" ? " (an https:// address)" : ""}`);
  if (NEVER.some((re) => re.test(sel.id))) return null;            // said once above
  let rows = (Array.isArray(t.rows) ? t.rows : []).filter((r) => Object.entries(sel.where ?? {}).every(([d, rule]) => allow(r[d], rule)));
  if (sel.latest) { const last = rows.map((r) => String(r[sel.latest])).sort().pop(); rows = rows.filter((r) => String(r[sel.latest]) === last); }
  const rowKey = (r) => (sel.row ? keyOf(r, sel.row) : sel.rowName ?? "value");
  if (sel.keep) rows = rows.filter((r) => sel.keep.includes(rowKey(r)));
  const state = sel.col === "state";
  const colOf = (r) => (sel.col === null ? "value" : state ? stateCode(r.state) : keyOf(r, sel.col));
  const cols = state ? STATES : sel.col === null ? ["value"] : [...new Set(rows.map(colOf))];
  const keys = sel.keep ? sel.keep.filter((k) => rows.some((r) => rowKey(r) === k)) : [...new Set(rows.map(rowKey))];
  const out = {};
  const fields = { "": "value", ...(sel.extra ?? {}) };
  for (const k of keys) for (const suffix of Object.keys(fields)) out[suffix ? `${k}:${suffix}` : k] = cols.map(() => null);
  for (const name of Object.keys(sel.colExtra ?? {})) out[name] = cols.map(() => null);   // a field that belongs to the column (a band's bounds)
  const num = (v) => (isNum(v) ? v : v === null || v === undefined || v === "" || !isNum(Number(v)) ? null : Number(v));
  let kept = 0;
  for (const r of rows) {
    const ci = cols.indexOf(colOf(r));
    if (ci < 0) continue;                                          // Puerto Rico, census divisions: not a state of the plan
    const k = rowKey(r);
    for (const [suffix, field] of Object.entries(fields)) out[suffix ? `${k}:${suffix}` : k][ci] = num(r[field]);
    for (const [name, field] of Object.entries(sel.colExtra ?? {})) if (out[name][ci] === null) out[name][ci] = num(r[field]);
    kept++;
  }
  if (!kept) problems.push(`${sel.id}: no rows kept (check the SELECT entry)`);
  if (sel.keep) for (const k of sel.keep) if (!keys.includes(k)) problems.push(`${sel.id}: kept row "${k}" not found`);
  // the dollars' year (6.7: a price-aging step needs it): the SELECT entry's own, else the research's; a table in dollars
  // with neither must say where each figure's year is (dollarsBy: its rows, columns or a year per cell)
  const unit = sel.unit ?? t.unit ?? null;
  const dollarsOf = sel.dollarsOf ?? yearOf(t.dollarsOf);
  if (/dollar/i.test(String(unit)) && !isNum(dollarsOf) && !["row", "col", "cell"].includes(sel.dollarsBy)) problems.push(`${sel.id}: in dollars but no dollarsOf year (or dollarsBy) on its SELECT entry`);
  const pub = PUBLISHERS.find(([re]) => re.test(String(src.publisher ?? "")));
  if (!pub) problems.push(`${sel.id}: publisher "${src.publisher}" has no row in PUBLISHERS (what the sources fold shows)`);
  if (!sel.asOf) problems.push(`${sel.id}: no asOf (the plain "as of" line the sources fold shows)`);
  return {
    file, kept,
    table: {
      title: sel.title, publisher: src.publisher, table: src.table ?? null, url, vintage: src.vintage, readOn,
      stat: sel.stat, unit, dollarsOf: isNum(dollarsOf) ? dollarsOf : null, ...(sel.dollarsBy ? { dollarsBy: sel.dollarsBy } : {}),
      industry: sel.industry ?? INDUSTRY.test(sel.id), derived: !!(sel.derived ?? t.derived ?? /_DERIVED$|_derived$/.test(sel.id)),
      org: pub?.[1] ?? null, shownBy: pub?.[2] ?? null, tableShown: sel.tableShown ?? tablePlain(src.table), asOf: sel.asOf ?? null,
      by: sel.col === null ? null : Array.isArray(sel.col) ? sel.col.join(":") : sel.col, cols, rows: out,
    },
  };
}

const T = {};
const meta = {};
for (const sel of SELECT) {
  const c = compact(sel);
  if (!c) continue;
  (T[sel.out] ??= {})[sel.id] = c.table;
  meta[sel.id] = { kept: c.kept, from: c.file };
}

// ---- derived constants (spec 6.5), each worked out from T and recomputed by the tests
const cell = (file, id, row, col) => { const t = T[file]?.[id]; const i = t?.cols.indexOf(col); return i >= 0 ? t.rows[row]?.[i] ?? null : null; };
const r3 = (x) => Math.round(x * 1000) / 1000;
const DERIVED = { spend: {}, balances: {}, pay: {}, debts: {}, home: {}, health: {}, retire: {} };
try {
  const ten = (item) => cell("spend", "ce2025_spend_by_housingTenure", item, "renter");
  DERIVED.spend.contractShare = { value: r3(ten("rentedDwellings") / (ten("rentedDwellings") + ten("utilities") - ten("telephoneServices"))), from: ["ce2025_spend_by_housingTenure"], how: "renters: rentedDwellings / (rentedDwellings + utilities - telephoneServices); contract rent as a share of rent plus utilities without phones" };
  const q = T.spend.ce2023_aftertax_income_by_incomeQuintile;
  DERIVED.spend.taxRatio2023 = { value: q.cols.map((c, i) => [c, r3(q.rows.incomeAfterTaxesMean[i] / q.rows.incomeBeforeTaxesMean[i]), q.rows.incomeBeforeTaxesMean[i]]), from: ["ce2023_aftertax_income_by_incomeQuintile"], how: "[fifth, incomeAfterTaxesMean / incomeBeforeTaxesMean, incomeBeforeTaxesMean] per income fifth, 2023" };
  const all = (item) => cell("spend", "ce2025_spend_by_incomeQuintile", item, "all");
  DERIVED.spend.energyShare = { value: r3((all("electricity") + all("naturalGas") + all("fuelOilOtherFuels")) / all("utilities")), from: ["ce2025_spend_by_incomeQuintile"], how: "all households: (electricity + naturalGas + fuelOilOtherFuels) / utilities" };
  const tr = ["gasolineAndOtherFuels", "vehicleMaintenanceRepairs", "vehicleRentalLeasesLicensesOther", "vehicleInsurance", "publicAndOtherTransportation"].reduce((s, k) => s + all(k), 0);
  DERIVED.spend.vehicleInsShare = { value: r3(all("vehicleInsurance") / tr), from: ["ce2025_spend_by_incomeQuintile"], how: "all households: vehicleInsurance / (gasoline + maintenance and repairs + rentals, leases, licences + vehicle insurance + public transport)" };
  const f = T.debts.mortgage_outstanding_fhfa_by_state_2026q2;
  const upb = f.rows["Unpaid principal balance ($ billions)"], loans = f.rows["Active first-lien mortgages (thousands)"];
  DERIVED.debts.perLoanByState = { value: Object.fromEntries(f.cols.map((c, i) => [c, isNum(upb[i]) && isNum(loans[i]) && loans[i] > 0 ? Math.round(upb[i] * 1e9 / (loans[i] * 1e3)) : null]).filter(([, v]) => v !== null)), from: ["mortgage_outstanding_fhfa_by_state_2026q2"], how: "unpaid principal balance x 1e9 / (active loans x 1e3), dollars per loan" };
  DERIVED.home.upkeepRatio = { value: cell("home", "ahs2023_routine_maintenance_spending", "aggregate maintenance / aggregate home value (percent)", "all owners") / 100, from: ["ahs2023_routine_maintenance_spending"], how: "all owners: aggregate routine maintenance / aggregate home value (the published percent / 100)" };
  const med = cell("balances", "scf2025_median_value_if_held", "mortgageOnPrimaryResidence", "all:all families"), mean = cell("balances", "scf2025_mean_value_if_held", "mortgageOnPrimaryResidence", "all:all families");
  DERIVED.balances.scfMortgageMedianToMean = { value: r3(med / mean), from: ["scf2025_median_value_if_held", "scf2025_mean_value_if_held"], how: "all families with a mortgage: median / mean balance" };
  const h = (m) => cell("pay", "vanguard_has2026_headline", m, "value");
  DERIVED.pay.deferralMedianToMean = { value: r3(h("median participant deferral rate") / h("average participant deferral rate")), from: ["vanguard_has2026_headline"], how: "median / average participant deferral rate" };
} catch (e) { problems.push(`derived constants: ${e.message}`); }

if (problems.length) { console.log("build-guess-data: FAIL"); for (const p of problems) console.log("  " + p); process.exit(1); }

// ---- write
const HEADS = {};
const files = {};
for (const out of Object.keys(DERIVED)) {
  const tables = T[out] ?? {};
  const readOn = Object.values(tables).map((t) => t.readOn).sort().pop();
  const from = [...new Set(Object.keys(tables).map((id) => meta[id].from))].join(", ");
  HEADS[out] = readOn;
  const body = [
    `// modules/overview/guesses/data/${out}.js`,
    `// GENERATED by tools/build-guess-data.mjs from the research file${from.includes(",") ? "s" : ""} ${from} (read ${readOn}). Do not edit; change the`,
    `// build's SELECT list and rebuild. Formulas: ../README.md. Values are exactly as published (never rounded or aged here).`,
    `// Next releases: ${FILE_NOTE[out]}.`,
    `export const READ_ON = ${JSON.stringify(readOn)};`,
    `export const T = {`,
    ...Object.entries(tables).map(([id, t]) => `  ${id}: ${JSON.stringify(t)},`),
    `};`,
    `export const DERIVED = ${JSON.stringify(DERIVED[out], null, 0)};`,
    "",
  ].join("\n");
  files[`${out}.js`] = body;
}
const newest = Object.values(HEADS).filter(Boolean).sort().pop();
const regionOf = Object.fromEntries(Object.entries(REGION).flatMap(([r, cs]) => cs.map((c) => [c, r])));
files["index.js"] = [
  "// modules/overview/guesses/data/index.js",
  "// GENERATED by tools/build-guess-data.mjs. Do not edit. The read date of each data file, the newest of them, and the",
  "// state list every state table's columns follow (the U.S. first, then the 50 states and DC by code).",
  "// STATE_REGION: U.S. Census Bureau, \"Census Regions and Divisions of the United States\" (the four regions the BLS",
  "// Consumer Expenditure Surveys report by), https://www2.census.gov/geo/pdfs/maps-data/maps/reference/us_regdiv.pdf",
  `export const READ_ON = ${JSON.stringify(HEADS)};`,
  `export const NEWEST_READ = ${JSON.stringify(newest)};`,
  `export const STATES = ${JSON.stringify(STATES)};`,
  `export const STATE_NAME = ${JSON.stringify(STATE_NAME)};`,
  `export const STATE_REGION = ${JSON.stringify(regionOf)};`,
  "",
].join("\n");

if (CHECK) {
  const stale = Object.entries(files).filter(([n, body]) => !fs.existsSync(path.join(OUT, n)) || fs.readFileSync(path.join(OUT, n), "utf8") !== body).map(([n]) => n);
  console.log(stale.length ? `build-guess-data: these differ from a fresh build: ${stale.join(", ")}` : "build-guess-data: the files match a fresh build");
  process.exit(stale.length ? 1 : 0);
}
fs.mkdirSync(OUT, { recursive: true });
for (const [n, body] of Object.entries(files)) fs.writeFileSync(path.join(OUT, n), body, "utf8");

// keep a copy of the research files where the next rebuild can find them (vendor/ is git-ignored)
const VEND = path.join(ROOT, "vendor", "guess-data");
if (path.resolve(srcDir) !== VEND) {
  try {
    fs.mkdirSync(VEND, { recursive: true });
    for (const f of Object.keys(research)) fs.copyFileSync(path.join(srcDir, f), path.join(VEND, f));
    const sj = path.join(ROOT, "vendor", "sources.json");
    if (fs.existsSync(sj)) {
      const s = JSON.parse(fs.readFileSync(sj, "utf8"));
      s.guessData = Object.keys(research).map((f) => ({ name: `guess-data/${f}`, readOn: research[f].readOn ?? null, tables: Object.keys(meta).filter((id) => meta[id].from === f) }));
      fs.writeFileSync(sj, JSON.stringify(s, null, 2) + "\n");
    }
  } catch (e) { console.log(`  note: could not copy the research files to vendor/guess-data (${e.message})`); }
}

// the leak guard on what was written
const lg = spawnSync(process.execPath, [path.join(ROOT, "tools", "leak-guard.mjs"), "--worktree"], { cwd: ROOT, encoding: "utf8" });
const flagged = (lg.stdout ?? "").split("\n").filter((l) => l.includes("modules/overview/guesses/data/"));
if (flagged.length) { console.log("build-guess-data: the leak guard objects to the written files:"); for (const l of flagged) console.log("  " + l.trim()); process.exit(1); }

for (const sel of SELECT) {
  const t = T[sel.out][sel.id];
  const bytes = Buffer.byteLength(JSON.stringify(t));
  console.log(`  ${sel.out}.js  ${sel.id}: ${meta[sel.id].kept} rows kept, ${Object.keys(t.rows).length} x ${t.cols.length} cells, ${bytes} bytes`);
}
const total = Object.values(files).reduce((s, b) => s + Buffer.byteLength(b), 0);
console.log(`build-guess-data: ${SELECT.length} tables in ${Object.keys(files).length} files, ${Math.round(total / 1024)} KB, newest read ${newest}`);

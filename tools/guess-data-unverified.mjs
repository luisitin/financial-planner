// tools/guess-data-unverified.mjs -- PURE. The research files' `unverified` lists, mapped by hand to the tables they concern,
// so tools/build-guess-data.mjs can refuse what they say could not be checked (guesses spec 6.4 "never bundled: every entry on
// any file's unverified list"; 6.6 step 2). The entries are prose with no ids, so matching an id in their text alone refused
// nothing (review of C1, 2026-11-06, data 2). Here each entry, found by the start of its `what`, says:
//   concerns     the research tables that hold (or would hold) the figure it could not verify: never bundled
//   substitutes  the tables bundled instead, each labelled for what it is (derived, a mean, an older year, another source)
// The build stops (exit 1) when an entry has no row here, when a row here matches no entry (the files changed: look again),
// or when a bundled table is one an entry concerns or names in its text without being an approved substitute.
//
//   NEVER                                   ids never bundled whatever the lists say (spec 6.4)
//   UNVERIFIED                              [{ file, what, concerns, substitutes, note }]
//   unverifiedProblems(research, bundled)   research: { "<file>.json": { tables, unverified } }; bundled: ids -> [problems]

export const NEVER = [/^usda_/, /^fanniemae_maintenance_rule_of_thumb$/, /^limra_/, /^acli_/, /^bls_ncs_/];

const row = (file, what, concerns = [], substitutes = [], note = "") => ({ file, what, concerns, substitutes, note });
export const UNVERIFIED = [
  // balances.json
  row("balances.json", "Published dollar cut points for the ACTUAL-income percentile groups", [], ["scf2025_actual_income_percentile_cutoffs_derived"], "no published cut points; the derived table is computed from the public extract and marked derived"),
  row("balances.json", "SCF 2025 holdings split by income percentile AND age at the same time", [], [], "not published; not included"),
  row("balances.json", "Median Social Security retired-worker benefit (a published median)", [], ["ssa_snapshot_2026_09_average_benefit", "ssa_retired_worker_benefit_by_age_sex_2025"], "SSA prints means only; the bundled tables are means and say so"),
  row("balances.json", "SSA cohort life expectancy", [], [], "not fetched"),
  row("balances.json", "Direct file downloads from ssa.gov", [], ["ssa_snapshot_2026_09_average_benefit", "ssa_retired_worker_benefit_by_age_sex_2025"], "the route only: pages transcribed through a browser and checked (sums, cross-table equality)"),
  row("balances.json", "Social Security benefit by sex for September 2026", [], ["ssa_retired_worker_benefit_by_age_sex_2025"], "the newest by-sex figures are December 2025"),
  // debts.json
  row("debts.json", "Used auto loan rate from Fed G.19", [], ["auto_rate_by_credit_tier_experian_q2_2026"], "G.19 has no used-car rate; Experian's (industry) is marked"),
  row("debts.json", "NY Fed Household Debt and Credit Report for 2026 Q3", [], [], "Q3 not released; NY Fed tables are not bundled"),
  row("debts.json", "Median debt balances by age from the NY Fed", [], [], "SCF medians by age instead"),
  row("debts.json", "Average credit card balance per borrower by age", ["avg_balance_per_borrower_transunion_q2_2026"], [], "press coverage only"),
  row("debts.json", "Mortgage interest rate by credit score band", [], [], "no primary source"),
  row("debts.json", "Credit card APR by credit tier for all existing accounts", ["card_balances_apr_cfpb"], [], "tier lines unreadable"),
  row("debts.json", "NAR 2026 Profile of Home Buyers and Sellers", [], [], "the 2025 profile is in the research; NAR is not bundled"),
  row("debts.json", "NAR all-buyer median down payment 19%", ["home_buyer_down_payment_nar_2025"], [], "seen in search results only"),
  row("debts.json", "NCUA credit union and bank rates for 2026 Q1-Q3", [], [], "newest posted is 2025 Q4; not bundled"),
  row("debts.json", "TransUnion figures on TransUnion's own site", ["avg_balance_per_borrower_transunion_q2_2026"], [], "read from syndications"),
  row("debts.json", "studentaid.gov interest-rate page", [], ["student_loan_rates_federal"], "the route only: the Department's own electronic announcements"),
  row("debts.json", "Share of owners with a mortgage by age of householder", [], [], "SCF shares instead"),
  // home.json
  row("home.json", "Tax Foundation 'Property Taxes by State and County, 2026'", [], ["acs2025_effective_property_tax_rate_by_state"], "the same method from ACS 2025, marked derived"),
  row("home.json", "A published Census/HUD table figure for median or mean annual routine", [], ["ahs2023_routine_maintenance_spending"], "computed from the AHS 2023 public-use file, marked derived"),
  row("home.json", "2025 American Housing Survey", [], [], "not released"),
  row("home.json", "Total yearly spending on repairs plus replacements and improvements", [], [], "not read"),
  row("home.json", "Fannie Mae maintenance percentages for homes between new and 30 years", ["fanniemae_maintenance_rule_of_thumb"], [], "never bundled either way"),
  row("home.json", "Median mortgage balance remaining by state", [], [], "not published"),
  row("home.json", "Median mortgage balance across ALL owners of an age", [], [], "not published"),
  row("home.json", "Year the home was purchased (as distinct from year moved in)", [], ["acs2025_year_moved_in_by_age_us", "acs2025_median_year_moved_in_by_state"], "year moved in, said as such"),
  row("home.json", "Median years in the home by age of owner", [], ["acs2025_year_moved_in_by_age_us"], "counts in bands, not a median"),
  row("home.json", "Effect of the Oct 1 - Nov 12, 2025 federal funding lapse on 2025 ACS", [], [], "no user note found; ACS 2025 figures used as published"),
  row("home.json", "FHFA House Price Index for 2026Q3", [], [], "not released"),
  row("home.json", "Income-percentile cut-offs needed to place a household's pay", [], [], "the income domain's derived table"),
  // insurance-health.json
  row("insurance-health.json", "Median face amount of individual life insurance per insured adult", [], [], "LIMRA is never bundled"),
  row("insurance-health.json", "Share of adults with individual (non-workplace) life cover", [], [], "LIMRA is never bundled"),
  row("insurance-health.json", "LIMRA 2026 ownership for Millennials and by race/ethnicity", [], [], "LIMRA is never bundled"),
  row("insurance-health.json", "Need-gap head count (92M vs 98M)", [], [], "LIMRA is never bundled"),
  row("insurance-health.json", "2027 Medicare Part B premium, deductible, Part A deductible and 2027 IRMAA", [], [], "not published; the 2026 figures are bundled"),
  row("insurance-health.json", "Average Medigap premium by age (65 vs 75 vs 85) and for new enrollees", [], [], "not evaluable"),
  row("insurance-health.json", "MEPS (AHRQ) mean and median out-of-pocket spending per person by age", [], [], "not reachable"),
  row("insurance-health.json", "CMS NHE age-and-sex tables after 2020", [], [], "not published"),
  row("insurance-health.json", "ACA age curve updates after the 2018 CMS table", [], ["cms_aca_age_rating_curve"], "the newest table on the CMS page, said as 2018"),
  row("insurance-health.json", "ACA 2026 benchmark premium by age for each state", [], ["kff_aca_benchmark_premium_40yo", "cms_aca_age_rating_curve"], "the 40-year-old benchmark and the age curve"),
  row("insurance-health.json", "BLS NCS March 2025 life/disability figures as a separate vintage", [], [], "NCS is never bundled"),
  row("insurance-health.json", "SSA IRMAA page wording", [], [], "the route only"),
  // pay.json
  row("pay.json", "SSA scaled-worker earnings factors by age 21-64", [], ["cps_median_earnings_by_age", "cps_ftyr_income_by_age5"], "cross-section pay by age from the CPS instead"),
  row("pay.json", "Median earnings of full-time year-round workers aged 18-24", [], ["cps_median_earnings_by_age", "cps_ftyr_income_by_age5"], "not published; never derived by subtraction"),
  row("pay.json", "Share of private-sector workers whose defined contribution plan has an", [], [], "NCS is not bundled"),
  row("pay.json", "Median deferral rate by age or income band (Vanguard)", [], ["vanguard_has2026_deferral_by_income_age"], "means by band, labelled as means"),
  row("pay.json", "Median (not mean) employee health premium contribution in dollars", [], ["kff_ehbs2026_premiums"], "averages, labelled as such"),
  // spend.json
  row("spend.json", "BLS Consumer Expenditure Surveys income after taxes and personal taxes for 2024", [], ["ce2023_aftertax_income_by_incomeQuintile", "ce2023_aftertax_income_by_region", "ce2023_aftertax_income_by_ageOfReferencePerson"], "2023 is the newest year with after-tax income"),
  row("spend.json", "Median (rather than mean) spending by category", [], [], "CE publishes means; the spending rows are means by design (R1)"),
  row("spend.json", "BLS CE after-tax income for the housing tenure and household composition", [], [], "not fetched; not bundled"),
  row("spend.json", "Average residential natural gas bill by state as an EIA-published figure", [], ["eia2024_residential_natural_gas_bill_by_state_DERIVED"], "computed from EIA's three series, marked derived"),
  row("spend.json", "Childcare prices from the DOL National Database of Childcare Prices for any year after 2022", [], ["ndcp2022_childcare_weekly_price_by_state", "ndcp_childcare_weekly_price_fallback_older_years"], "2022 is the newest; older years only where 2022 is empty, each with its year"),
  row("spend.json", "Child Care Aware of America 2025 state prices for Colorado, New Mexico", [], ["ccaoa2025_childcare_annual_price_by_state"], "those states' cells are empty; the age bands are an assumption said in the README"),
  row("spend.json", "NAIC auto insurance average expenditure/premium for 2024", [], ["naic2023_auto_insurance_by_state", "naic2023_homeowners_premium_by_state"], "2023 is the newest NAIC year"),
  row("spend.json", "USDA Low-Cost, Moderate-Cost and Liberal plan reference-family totals", [], [], "USDA is never bundled"),
  row("spend.json", "Census Data API access for ACS tables", [], [], "the route only: the summary files hold the same estimates"),
];

const named = (u, ids) => {
  const text = `${u?.what ?? ""} ${u?.tried ?? ""}`;
  const listed = [u?.id, ...(Array.isArray(u?.ids) ? u.ids : []), u?.table].filter(Boolean);
  return ids.filter((id) => listed.includes(id) || new RegExp(`\\b${id}\\b`).test(text));
};

/**
 * Every problem with the unverified lists against the tables to bundle. research: { "<file>.json": { tables, unverified } };
 * bundled: the table ids on the SELECT list. -> [strings]; empty when nothing refused got in and every entry is mapped.
 */
export function unverifiedProblems(research, bundled, map = UNVERIFIED) {
  const problems = [];
  const want = new Set(bundled);
  for (const id of want) if (NEVER.some((re) => re.test(id))) problems.push(`${id}: never bundled (spec 6.4)`);
  const used = new Set();
  for (const [file, j] of Object.entries(research ?? {})) {
    const ids = (j?.tables ?? []).map((t) => t.id);
    for (const u of j?.unverified ?? []) {
      const what = String(u?.what ?? "");
      const m = map.find((r) => r.file === file && what.startsWith(r.what));
      if (!m) { problems.push(`${file}: an unverified entry with no row in tools/guess-data-unverified.mjs: "${what.slice(0, 100)}"`); continue; }
      used.add(m);
      for (const id of new Set([...m.concerns, ...named(u, ids)])) {
        if (want.has(id) && !m.substitutes.includes(id)) problems.push(`${id}: refused, the subject of ${file}'s unverified entry "${what.slice(0, 80)}"`);
      }
    }
  }
  for (const r of map) if (research?.[r.file] && !used.has(r)) problems.push(`${r.file}: the row "${r.what}" in tools/guess-data-unverified.mjs matches no unverified entry (the file changed: look again)`);
  return problems;
}

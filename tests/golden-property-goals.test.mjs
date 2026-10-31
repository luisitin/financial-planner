// tests/golden-property-goals.test.mjs -- the Vehicles page (property/vehicles: compute), the Big purchase planner
// (property/purchase: compute) and the Renovation page (property/renovation: compute) against an answer key worked
// independently from the pages' brief and the law (tools/golden_property_goals, tests/golden/property-goals/RULES.md), never
// from this repo's code. The key works each row twice in exact fractions and rounds once when written: money to the cent and
// rates and ratios to six decimals, half away from zero. The pages work in floating point, so every amount is compared within
// a cent and every rate within half a unit of the sixth decimal (5e-7); months, counts, flags, names and the order of the
// goals are compared exactly. Today is 2026-10-31 on every row.
//
// The key takes as given eight figures that the pages read from elsewhere in the app. The plans are built so that the app's
// own figure comes out as the key gives it (nothing is read from the app and fed back into the key), and three tests check
// it on every row:
//   purchases.csv   spare: next-best-action spare.monthly (income less tax, spending, saving and the open goals' monthly
//                   saving), from one untaxed income ("support": no income or payroll tax) of spare + the must-pay expense +
//                   the monthly saving of the goals the Goals page counts as open; usable_cash: one checking account (no goal
//                   draws on it, so none of it is earmarked); emergency_target: one must-pay expense of that amount a month,
//                   with assumptions.emergencyMonths 1; cash_return: assumptions.returnCash.
//   renovations.csv usable_cash: one checking account; blended_return: planReturn with retirement.stocksNow 1 and
//                   assumptions.returnStocks = the return; top_rate and itemizes: typed 2026 wages that put taxable income
//                   well inside the bracket (TAXABLE_AT), with 40,000 of other itemized deductions when the key itemizes
//                   (the Federal estimate's marginal rate and deduction.used); essential_monthly: one must-pay expense (with a
//                   mortgage, its payment is filed as an optional "Loan and card payments" expense, or the expenses page
//                   would add it to the must-pay figure, F-019); filing status married filing separately, or single for
//                   the key's "other" (it sets the limit L of R1: $375,000 separately, $750,000 otherwise).
// vehicles.csv: emptyPlan() with one adult; per car a vehicle account (balance = value) and a property entry { kind: "vehicle",
// accountId } with its typed fields (a blank stays blank, null; the key never leaves insurance, upkeep, registration or an
// electric car's kWh fields blank, where the page's defaults are not the key's 0), and with a loan a loan account (balance)
// with its plan.debts entry (rate, minPayment, extra 0) named by loanAccountId; whatIfs.vehicles with the first car and every
// what-if input as the key types it, a blank as null, so the page applies its own default (D1: new price 35,000, tax 6%,
// 32 mpg, 7% over 60 months, cash down 0, insurance share 1.25, upkeep $500, the lease 450 / 3,000 / 36 months / 12,000
// miles / 0.25, upkeep rise 10%; veh-0026 leaves every one blank but the years; a blank new mpg on an electric first car
// leaves its new car charged like the car, E1). purchases.csv: the goals typed as listed (saved =
// set_aside, rate = growth, priority, targetDate = due, monthly; no inflation, no linked account) and whatIfs.purchase { name,
// price, salesTax, when, saved, apr, termMonths, promoMonths }. renovations.csv: the home as a property account, the mortgage
// as a mortgage account with its plan.debts entry, and whatIfs.renovation { project "other", cost, recoup and the typed offers;
// a blank stays blank, null, so the page's defaults apply (D1): the line 8% over 10 years, the refinance 6.5% over 30 years
// with closing costs 3%, the loan 12% over 5 years }. Then compute(plan, { today }).
//
// What is compared (2026-10-31): the key's MAIN columns. Since its second revision they follow the pages' stated
// conventions (RULES.md sections 7 and 11), and since its fourth revision (2026-10-31) five more: L1 (the line's tax by IRS
// Publication 936 Table 1), A7 (cash back), A9 (the cheapest by a $1 walk), B5 (a spare below 0 counts as 0) and D1 (blank
// inputs at the pages' defaults), with E1 (an electric first car's new car charged like the car when its mpg is blank; the
// key's correction of D1 after this test's run that day, see History). The pages in the working tree carry them out, so the
// main columns check each page's own model exactly, and a mismatch is a bug on one side, not a reading. By part (each row is
// one test per part):
//   vehicles.csv    car       per car in order: the year's lines (value lost, fuel or charging, insurance, upkeep,
//                             registration, loan interest; a line the page leaves out is 0), total, per mile, monthly
//                   whatif    the car compared, the period (years x 12), trade_in, loan_left, financed, cash_back (A7: the
//                             page's cashBack), new_payment, cheapest (A9: the page's best, the walk keep, buy, lease that
//                             changes only for more than $1 less)
//                   keep, buy, lease  paid (out), end value, owed at the end, back, cost, cost a month: V1 on Keep only the
//                             upkeep rises, V2 Buy and Lease flat (the lease's upkeep halved), V3 Keep's back less what the old
//                             loan still owes then; Buy with A7's cash back taken off what is paid; blank what-if inputs at
//                             D1's defaults (E1 on an electric first car); lease: leases started and lease_trade_in_credited
//                             (V3, the page's leaseCredit)
//   purchases.csv   save      total, months (P1: W2, the day of the month must be reached, at least 1), save_monthly,
//                             save_earned (no save-up way without a date)
//                   savegoals the goals that give way to saving up, in order (P2: a done goal is skipped): what each gives, its
//                             new monthly saving, paused, the months later (new_months - old_months; none when paused or never
//                             reached); the need (B5: amount - max(0, spare), so what they give + what is left), save_uncovered,
//                             save_more_than_you_have (anything over half a cent left, giveWay's own line)
//                   finance   finance_principal, finance_payment, finance_interest
//                   financegoals  as savegoals, for the finance payment
//                   paycash   P3: the amount (total - set aside, the key's finance_principal), cash_after, cash_fits (usable
//                             cash >= the amount: the page's cash.fits)
//   renovations.csv project   value_added, equity_change, borrowable (none without a home)
//                   cushion   cash_fits, cash's today's money (0), cushion (usable cash - cost), cushion_months
//                   line, loan  monthly, interest, fees, deductible (a deductible kind of interest and the household
//                             itemizes), tax_saved (the line by L1: (its interest x s_new - the mortgage's interest over the
//                             line's term x (s_old - s_new)) x top, s_new = min(1, L / (M + C)), s_old = min(1, L / M)),
//                             todays_money (R2: after the tax saved, discounted like the payments; L1 for the line), fits
//                             (R4: the line when value x 85% - M >= C; no line without a home); a blank rate or years at D1's
//                             8% / 10 (line) and 12% / 5 (loan)
//                   refi      fees (closing costs), payment_change (the page's monthly), interest (the extra interest),
//                             deductible, tax_saved (R1: within L, closing costs left out, can be below 0), todays_money (R2),
//                             fits (R4: the new loan at most 80% of the value); none without a mortgage with a payment (R3); a
//                             blank rate or years at D1's 6.5% / 30 (ren-0016 to -0018)
//                   best      R5: the walk with a $1 margin in the order cash, line, refinance, loan (the line's today's money
//                             by L1)
// What the key's revisions renamed or moved, as this test reads it. Second revision: months is W2 (it was W1, now
// alt_months_w1; months_w2 is gone); cash_fits is P3, so the test compares the page's own cash.fits; alt_keep_rise_upkeep_only,
// line_law_tax_saved and refi_law_tax_saved are gone (main columns now); Pay cash's amount and the lease's credited trade-in
// are compared. Fourth revision: line_tax_saved and line_todays_money hold L1 (they were R1's figure, now alt_line_tax_saved_r1
// and alt_line_todays_money_r1), and line_law_tax_saved_table1 and line_law_todays_money_table1 are gone (they would equal
// them); cash_back is compared (the page has had cashBack since commit ae1f0b2); cheapest is the A9 walk (the plain lowest is
// alt_cheapest_lowest); save_need and finance_need follow B5; every blank input reaches the page as null (D1), where the test
// used to send the vehicles what-if's blank price, rate, term, cash down and lease boxes as 0 (no row had them blank);
// line_mortgage_interest_in_term is new (not compared, below). E1's correction added alt_buy_electric_new_at_32_mpg and
// alt_lease_electric_new_at_32_mpg.
//
// Reported only (no pass or fail), as counts in t.diagnostic: the key's contrast and law columns, each its earlier reading of a
// stated convention, another reading or the law. They are not the page's model, so a difference is not a failure; the count
// says, on the rows where a contrast differs from its main column, whether the page sides with the main, the contrast or
// neither, so a drift to another reading shows. vehicles.csv: alt_keep_rise_all, alt_buy_rise_all, alt_lease_rise_all (A1,
// and the cheapest under it), alt_buy_rise_upkeep_only, alt_lease_rise_upkeep_only (Keep's rule on the new car),
// alt_lease_old_running (A2), alt_lease_equity_not_credited (A5), alt_keep_owed_end_ignored (A6),
// alt_buy_tax_after_trade_in_credit (TXMV), new_car_loss_at_end, alt_cheapest_lowest (A9's), alt_buy_blank_keeps_old and
// alt_lease_blank_keeps_old (D1's: A3, a blank new mpg or upkeep keeping the old car's), alt_buy_electric_new_at_32_mpg and
// alt_lease_electric_new_at_32_mpg (E1's: the fourth revision's 32 mpg at the fuel price the electric car carries, and the
// cheapest under it), two costs within A9's $1 margin, the rows with cash back, a blank new mpg taken as 32, a Keep that
// costs less than nothing. purchases.csv: alt_months_w1, alt_save_monthly_w1, alt_save_earned_w1 and months_w3 (P1's
// contrasts), alt_save_giving_done_goals_give, alt_save_uncovered_done_goals_give, alt_finance_giving_done_goals_give,
// alt_finance_uncovered_done_goals_give (P2's), alt_save_need_spare_literal, alt_save_uncovered_spare_literal,
// alt_finance_need_spare_literal, alt_finance_uncovered_spare_literal (B5's: a spare below 0 taken literally),
// alt_cash_fits_keeps_emergency_target (P3's; the screen's warning under the emergency target), alt_level_payment,
// alt_level_interest, alt_all_zero_payment, balance_after_promo and deferred_interest_if_not_paid (B9), the page's 50-cent
// line for "more than you have". renovations.csv: alt_line_tax_saved_no_limit, alt_refi_tax_saved_extra_interest,
// refi_tax_saved_whole_new_interest (R1's), alt_line_tax_saved_r1, alt_line_todays_money_r1 and alt_ranking_line_r1 (L1's:
// R1's line figure, the line's own interest x the share; with it the best changes), line_law_share and refi_law_share
// (163(h)(3), P936), alt_line_todays_money_before_tax, alt_refi_todays_money_before_tax (R2's), alt_refi_no_mortgage_monthly,
// alt_refi_no_mortgage_todays_money, alt_refi_no_mortgage_fits, alt_ranking_refi_no_mortgage (R3's),
// alt_ranking_blank_refi_not_offered (D1's: C4's first half, and the page's 6.5% / 30 for a blank refinance rate or years),
// ranking (R5: the page marks only the best, so the test walks the page's own ways and counts), alt_ranking_lowest_first (C7)
// and alt_ranking_before_tax, the alt_refi_* reading (3% of the new loan: fees, monthly, today's money, LTV), refi_ltv_after,
// line_cltv_after and refi_above_fha_80 (the lenders' limits).
// Not compared (the page has no such figure): vehicles.csv car_results loan_paid_year, loan_balance_after_year,
// loan_months_year, negative_trade_in_cash (the page adds a negative trade-in into what is paid), keep_loan_paid,
// keep_loan_months, keep_running, buy_loan_paid, buy_loan_months, buy_running, lease_due_total, lease_payments,
// lease_excess_miles, lease_excess_charge, lease_running (the page gives each way's total only), note; purchases.csv
// finance_kind (the page shows the 0% months), the giving goals' old and new months one by one (the page shows the months
// later), goals_months (the Goals page has no months to the target), note; renovations.csv line_months, loan_months,
// line_pv_payments, loan_pv_payments, line_mortgage_interest_in_term (L1: the page works it inside the line's tax saved and
// does not return it; the tax saved and today's money check it), refi_new_loan, refi_months, refi_old_payment,
// refi_old_months_left, refi_new_interest, refi_old_interest, refi_pv_new, refi_pv_old (the page shows the change, the extra
// interest and today's money), alt_refi_new_loan, note.
//
// History. The first run (2026-10-31) found 7,735 row-parts apart by thirteen causes; the key was revised where it was wrong
// (RULES.md section 11: C1, B8, 5.2, C4, and A5 and A6 like for like), and 7,233 row-parts stayed to-dos under eleven whys,
// each proved with a switched copy of the page's compute.js: five "app wrong" (Pay cash took the whole total; Keep left in
// what the old loan still owes; the lease dropped a positive trade-in; the refinance fitted by the line's 85% limit; the
// refinance's tax saved was floored at 0) and six conventions the pages state (what rises on Keep, Buy and Lease, two whys;
// whole months; a done goal giving way; the tax in today's money; the refinance without a mortgage). The pages were then fixed
// (commit a4a2c81: the five, plus deductible interest by the law's limit and today's money after it) and the key's main
// columns set to the pages' stated conventions, its earlier readings kept as alt_* columns (its second revision). Against it,
// and against its third revision (two law columns added, no main column changed), every row of every part agreed. The pages
// then stated five more conventions (commit ae1f0b2: L1 and A7 in the code, A9 and D1 in the READMEs; B5 already the page's)
// and the key made them main (its fourth revision, sixteen new edge rows). Its first run, on 2026-10-31, found one cause:
// 201 row-parts in 96 rows (vehicles.csv buy 96, lease 96, whatif 9), every electric first car (all with a blank new mpg),
// veh-0007 for one (buy 18,353.11 on the page, 21,299.11 in the key; lease 25,182.00 and 28,128.00; veh-0481's cheapest buy
// on the page, keep in the key). The key read D1's 32 mpg as making an electric household's new car a petrol car at a fuel
// price, which it had to add to its electric cars; the page charges the new car like the car. Proved with a switched copy of
// the page's compute.js (the new car on petrol at the new mpg and the car's fuel price): switched off it gives exactly what
// the page gives on all 1,500 rows, switched on every vehicles row of every part agrees with the key, and the failing rows are
// exactly the 96. Verdict: key wrong. D1 sets the default of the new mpg box, which the page takes (32 on every blank row);
// an electric car is charged by its kWh (the page's README, Formulas: "electric: miles x kWh a mile x price") and the page
// does not compare gas against electric (its README lists "Gas against electric" under "Ideas / not yet"). The key was
// corrected in both derivations (E1, RULES.md 3.4 and 11; the fourth revision's figures kept as alt_buy_electric_new_at_32_mpg
// and alt_lease_electric_new_at_32_mpg) and regenerated; against it every row of every part agrees: vehicles.csv car, whatif,
// keep, buy, lease; purchases.csv save, savegoals, finance, financegoals, paycash; renovations.csv project, cushion, line,
// refi, loan, best: 1,500 of 1,500 rows each (24,000 row-parts); golden/property-goals/todo.json is {}.
//
// Should the page and the key part ways again, list the case ids by cause in golden/property-goals/todo.json ("<part>-<why>")
// with a reason in WHY that starts with the verdict ("app wrong", "key wrong", "simplification" or "convention", then ": ");
// they then run as { todo } tests. Delete a cause's list when it is fixed.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseCsv, toObjects } from "../core/csv.js";
import { emptyPlan } from "../core/schema/migrate.js";
import { compute as vehiclesPage } from "../modules/property/vehicles/compute.js";
import { compute as purchasePage } from "../modules/property/purchase/compute.js";
import { compute as renovationPage } from "../modules/property/renovation/compute.js";
import { compute as goalsPage } from "../modules/goals/goals/compute.js";
import { compute as liquidityPage } from "../modules/balance/liquidity/compute.js";

const read = (name) => fs.readFileSync(new URL(`./golden/property-goals/${name}`, import.meta.url), "utf8");
const csv = (name) => toObjects(parseCsv(read(name)));
const num = (v) => Number(v) || 0;
const show = (x) => x === null || x === undefined ? "none" : typeof x !== "number" ? String(x) : Number.isInteger(x) ? String(x) : String(Number(x.toFixed(6)));
const yes = (v) => v === "yes";
const blank = (v) => v === "" || v === undefined;
/** A typed input: blank stays blank (null, the page's default applies), anything else is a number. */
const typedOrNull = (v) => (blank(v) ? null : Number(v));
const CENT = 0.01, RATE = 5e-7, EPS = 1e-9;
/** A key list field: items joined by ";", fields by "|". */
const items = (v) => (blank(v) ? [] : v.split(";").map((s) => s.split("|")));
const fieldsOf = (names) => (f) => Object.fromEntries(names.map((k, i) => [k, f[i] ?? ""]));
const TODAY = "2026-10-31";
const ADULT = { id: "a1", name: "Adult 1", role: "self", birthDate: "1980-01-01" };

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
const flag = (b) => (b === true ? "yes" : b === false ? "no" : b);

// --- vehicles.csv -------------------------------------------------------------------------------------------------
const CAR_FIELDS = ["name", "value", "miles", "mpg", "fuel_price", "electric", "kwh_per_mile", "kwh_price", "insurance", "maintenance", "registration", "loss", "loan_balance", "loan_rate", "loan_payment"];
const CAR_RESULTS = ["value_lost", "fuel", "insurance", "maintenance", "registration", "loan_interest", "total", "per_mile", "monthly", "loan_paid_year", "loan_balance_after_year", "loan_months_year"];
const carsOf = (row) => items(row.cars).map(fieldsOf(CAR_FIELDS));
const carResultsOf = (row) => items(row.car_results).map(fieldsOf(CAR_RESULTS));

/** The row as a plan for the Vehicles page: one vehicle account per car (balance = value) with its details in
 * plan.property, and a car loan account with its rate and payment in plan.debts when the car has a loan. Every what-if
 * input reaches the page as the key types it, a blank as null, so the page applies its own default (D1). */
function vehiclePlan(row) {
  const p = emptyPlan();
  p.household.people = [{ ...ADULT }];
  carsOf(row).forEach((c, i) => {
    p.accounts.push({ id: `car${i}`, name: c.name, type: "vehicle", balance: num(c.value) });
    const hasLoan = !blank(c.loan_balance);
    if (hasLoan) {
      p.accounts.push({ id: `carloan${i}`, name: `${c.name} loan`, type: "loan", balance: num(c.loan_balance) });
      p.debts.push({ id: `d${i}`, accountId: `carloan${i}`, rate: num(c.loan_rate), minPayment: num(c.loan_payment), extra: 0 });
    }
    p.property.push({
      id: `v${i}`, kind: "vehicle", accountId: `car${i}`, name: c.name, milesYear: typedOrNull(c.miles), mpg: typedOrNull(c.mpg),
      fuelPrice: typedOrNull(c.fuel_price), electric: yes(c.electric), kwhPerMile: typedOrNull(c.kwh_per_mile), kwhPrice: typedOrNull(c.kwh_price),
      insuranceYear: typedOrNull(c.insurance), maintenanceYear: typedOrNull(c.maintenance), registrationYear: typedOrNull(c.registration),
      loss: typedOrNull(c.loss), loanAccountId: hasLoan ? `carloan${i}` : null,
    });
  });
  p.whatIfs = { vehicles: {
    car: "car0", years: typedOrNull(row.years), newPrice: typedOrNull(row.new_price), newSalesTax: typedOrNull(row.new_sales_tax), newMpg: typedOrNull(row.new_mpg),
    newRate: typedOrNull(row.new_rate), newTermMonths: typedOrNull(row.new_term), newDown: typedOrNull(row.cash_down), newInsuranceShare: typedOrNull(row.new_insurance_share),
    newMaintenanceYear: typedOrNull(row.new_maintenance), leaseMonthly: typedOrNull(row.lease_monthly), leaseDue: typedOrNull(row.lease_due),
    leaseMonths: typedOrNull(row.lease_months), leaseMiles: typedOrNull(row.lease_miles), leaseExcess: typedOrNull(row.lease_excess), upkeepRise: typedOrNull(row.upkeep_rise),
  } };
  return p;
}
const LINE_OF = [["loss", "value_lost"], ["fuel", "fuel"], ["insurance", "insurance"], ["maintenance", "maintenance"], ["registration", "registration"], ["interest", "loan_interest"]];
const WAY_COLS = {
  keep: [["out", "keep_paid"], ["endValue", "keep_end_value"], ["owedAtEnd", "keep_owed_end"], ["back", "keep_back"], ["cost", "keep_cost"], ["monthly", "keep_cost_monthly"]],
  buy: [["out", "buy_paid"], ["endValue", "buy_end_value"], ["owedAtEnd", "buy_owed_end"], ["back", "buy_back"], ["cost", "buy_cost"], ["monthly", "buy_cost_monthly"]],
  lease: [["out", "lease_paid"], ["endValue", "lease_end_value"], ["owedAtEnd", "lease_owed_end"], ["back", "lease_back"], ["cost", "lease_cost"], ["monthly", "lease_cost_monthly"]],
};

function vehicleMismatches(row, part, d) {
  const out = [];
  if (!d.ready) return ["ready: app false, key true"];
  if (part === "car") {
    const want = carResultsOf(row);
    same(out, "cars", d.cars.length, want.length);
    want.forEach((w, i) => {
      const c = d.cars[i], L = `car ${i + 1}`;
      if (!c) return;
      for (const [key, col] of LINE_OF) near(out, `${L} ${col}`, c.year.lines.find((l) => l.key === key)?.amount ?? 0, w[col]);
      near(out, `${L} total`, c.year.total, w.total);
      opt(out, `${L} per_mile`, c.year.perMile, w.per_mile, RATE);
      near(out, `${L} monthly`, c.year.monthly, w.monthly);
    });
  }
  const cmp = d.comparison, opt3 = (id) => cmp.options.find((o) => o.id === id);
  if (part === "whatif") {
    same(out, "car compared", d.chosen, "car0");
    same(out, "period_months (years x 12)", cmp.years * 12, num(row.period_months));
    near(out, "trade_in", cmp.tradeIn, row.trade_in);
    near(out, "loan_left", cmp.loanLeft, row.loan_left);
    near(out, "financed", cmp.financed, row.financed);
    near(out, "cash_back (A7: the equity and the cash down past the new car with its tax)", cmp.cashBack, row.cash_back);
    near(out, "new_payment", cmp.newPayment, row.new_payment);
    same(out, "cheapest (A9: the walk keep, buy, lease with a $1 margin)", d.best, row.cheapest);
  }
  if (part === "keep" || part === "buy" || part === "lease") {
    const o = opt3(part);
    for (const [k, col] of WAY_COLS[part]) near(out, col, o[k], row[col]);
    if (part === "lease") {
      same(out, "lease_count (leases started)", o.terms, num(row.lease_count));
      near(out, "lease_trade_in_credited (a positive trade-in, A5 and V3)", cmp.leaseCredit, row.lease_trade_in_credited);
    }
  }
  return out;
}

// --- purchases.csv ------------------------------------------------------------------------------------------------
const GOAL_FIELDS = ["name", "priority", "due", "target", "set_aside", "monthly", "growth"];
const goalsOf = (row) => items(row.goals).map(fieldsOf(GOAL_FIELDS));
const givingOf = (v) => items(v).map(fieldsOf(["name", "gives", "new_monthly", "old_months", "new_months", "paused"]));

/** The row as a plan for the Big purchase planner. The page reads four figures from elsewhere in the app; the plan is
 * built so that they come out as the key gives them: usable cash = one checking account (balance = usable_cash, no goal
 * draws on it); the emergency target = must-pay spending x assumptions.emergencyMonths, here one must-pay expense of
 * emergency_target a month with emergencyMonths = 1; the cash return = assumptions.returnCash; the money left each month
 * (next-best-action spare.monthly = income - tax - spending - saving - the open goals' monthly saving) = one untaxed income
 * ("support": no income or payroll tax) of spare + the expense + the monthly saving of the goals the Goals page counts as
 * open. The goals are typed as the key lists them (saved = set_aside, rate = growth, no inflation, no linked account). */
function purchasePlan(row) {
  const p = emptyPlan();
  p.household.people = [{ ...ADULT }];
  p.assumptions.returnCash = num(row.cash_return);
  p.assumptions.emergencyMonths = 1;
  p.accounts = [{ id: "chk", name: "Checking", type: "checking", balance: num(row.usable_cash) }];
  p.expenses = [{ id: "e1", name: "Must-pay bills", category: "housing", amount: num(row.emergency_target), period: "monthly", essential: true }];
  p.goals = goalsOf(row).map((g, i) => ({
    id: `g${i}`, name: g.name, priority: num(g.priority), targetDate: g.due || null, target: num(g.target), saved: num(g.set_aside),
    monthly: num(g.monthly), rate: typedOrNull(g.growth), inflates: false, fundedBy: [],
  }));
  const open = goalsPage(p, { today: TODAY }).goals.filter((g) => g.status !== "done").reduce((s, g) => s + g.monthly, 0);
  p.income = [{ id: "i1", name: "Money in", type: "support", amount: num(row.spare) + num(row.emergency_target) + open, period: "monthly" }];
  p.whatIfs = { purchase: {
    name: row.name, price: num(row.price), salesTax: typedOrNull(row.sales_tax), when: row.when || "", saved: num(row.set_aside),
    apr: num(row.apr), termMonths: num(row.term), promoMonths: num(row.promo),
  } };
  return p;
}

/** One way's goals against the key: the order, what each gives, its new monthly saving, paused, the months later. */
function givingMismatches(out, L, e, want, needCol, uncoveredCol, moreCol, row) {
  if (!e) { out.push(`${L}: app none, key a way`); return; }
  const app = e.list;
  near(out, `${L} ${needCol} (what the goals give + what is left over)`, app.reduce((s, g) => s + g.from, 0) + e.uncovered, row[needCol]);
  same(out, `${L} goals giving (in order)`, app.map((g) => g.name).join(";"), want.map((w) => w.name).join(";"));
  want.forEach((w, i) => {
    const g = app[i];
    if (!g || g.name !== w.name) return;
    near(out, `${L} ${w.name} gives`, g.from, w.gives);
    near(out, `${L} ${w.name} new monthly`, g.now, w.new_monthly);
    same(out, `${L} ${w.name} paused`, flag(g.paused), w.paused);
    const later = yes(w.paused) || blank(w.new_months) || blank(w.old_months) ? null : num(w.new_months) - num(w.old_months);
    same(out, `${L} ${w.name} months later (new_months - old_months)`, g.monthsLater, later);
  });
  near(out, `${L} ${uncoveredCol}`, e.uncovered, row[uncoveredCol]);
  same(out, `${L} ${moreCol} (anything left uncovered: more than half a cent, giveWay's own line)`, flag(e.uncovered > 0.005), row[moreCol]);
}

function purchaseMismatches(row, part, d) {
  const out = [];
  if (part === "save") {
    near(out, "total", d.total, row.total);
    if (blank(row.when)) { same(out, "months (no date)", d.months, null); same(out, "save (no date)", d.save, null); return out; }
    same(out, "months (W2: the day of the month must be reached, at least 1)", d.months, num(row.months));
    if (!d.save) return [...out, "save: app none, key a way"];
    near(out, "save_monthly", d.save.monthly, row.save_monthly);
    near(out, "save_earned", d.save.earned, row.save_earned);
  }
  if (part === "savegoals") {
    if (blank(row.when)) { same(out, "goals giving way to saving up (no date)", d.effect.save, null); return out; }
    givingMismatches(out, "save", d.effect.save, givingOf(row.save_giving), "save_need", "save_uncovered", "save_more_than_you_have", row);
  }
  if (part === "finance") {
    near(out, "finance_principal", d.finance.principal, row.finance_principal);
    near(out, "finance_payment", d.finance.payment, row.finance_payment);
    near(out, "finance_interest", d.finance.interest, row.finance_interest);
  }
  if (part === "financegoals") givingMismatches(out, "finance", d.effect.finance, givingOf(row.finance_giving), "finance_need", "finance_uncovered", "finance_more_than_you_have", row);
  if (part === "paycash") {
    // P3: the amount is total - set aside (the key's amount, B2, is its finance_principal); fits when usable cash >= it
    near(out, "cash amount (total - set aside: the key's finance_principal)", d.cash.amount, row.finance_principal);
    near(out, "cash_after", d.cash.after, row.cash_after);
    same(out, "cash_fits (usable cash >= the amount)", flag(d.cash.fits), row.cash_fits);
  }
  return out;
}

// --- renovations.csv ----------------------------------------------------------------------------------------------
/** Typed wages that put this household's next dollar in the key's top bracket (2026 tables, taxable income well inside
 * the bracket), with 40,000 of other itemized deductions when the key says the household itemizes (more than the
 * 16,100 standard deduction). The test checks that the Federal estimate then gives the key's top_rate and itemizes. */
const TAXABLE_AT = { "0.10": 6000, "0.12": 30000, "0.22": 80000, "0.24": 150000, "0.32": 230000, "0.35": 320000, "0.37": 1500000 };
const ITEMIZED = 40000, STANDARD_2026 = 16100;
/** The row as a plan for the Renovation page: a checking account (usable_cash), the home as a property account and the
 * mortgage as a mortgage account with its rate and payment in plan.debts; one must-pay expense of essential_monthly (and,
 * with a mortgage, its payment filed as an optional "Loan and card payments" expense, so the expenses page does not add
 * the payment to the must-pay figure: F-019); the plan's blended return = retirement.stocksNow 1 x returnStocks; the
 * federal top rate and itemizing from typed wages and itemized deductions (TAXABLE_AT); the filing status (married filing
 * separately, or single for "other"). */
function renovationPlan(row) {
  const p = emptyPlan();
  p.household.people = [{ ...ADULT }];
  p.household.filingStatus = row.filing_status === "married_separate" ? "married_separate" : "single";
  p.taxes.year = 2026;
  p.taxes.thisYear.wages = TAXABLE_AT[row.top_rate] + (yes(row.itemizes) ? ITEMIZED : STANDARD_2026);
  p.taxes.itemized.other = yes(row.itemizes) ? ITEMIZED : 0;
  p.retirement.stocksNow = 1;
  p.assumptions.returnStocks = num(row.blended_return);
  p.accounts = [{ id: "chk", name: "Checking", type: "checking", balance: num(row.usable_cash) }];
  p.expenses = [{ id: "e1", name: "Must-pay bills", category: "housing", amount: num(row.essential_monthly), period: "monthly", essential: true }];
  if (yes(row.home)) p.accounts.push({ id: "home", name: "Home", type: "property", balance: num(row.home_value) });
  if (!blank(row.mortgage_balance)) {
    p.accounts.push({ id: "mtg", name: "Mortgage", type: "mortgage", balance: num(row.mortgage_balance) });
    p.debts = [{ id: "d1", accountId: "mtg", rate: num(row.mortgage_rate), minPayment: num(row.mortgage_payment), extra: 0 }];
    p.expenses.push({ id: "e2", name: "Mortgage payment", category: "debt", amount: num(row.mortgage_payment), period: "monthly", essential: false });
  }
  p.whatIfs = { renovation: {
    project: "other", cost: num(row.cost), recoup: typedOrNull(row.recoup), helocRate: typedOrNull(row.heloc_rate), helocYears: typedOrNull(row.heloc_years),
    refiRate: typedOrNull(row.refi_rate), refiYears: typedOrNull(row.refi_years), refiCosts: typedOrNull(row.refi_cost_share),
    loanRate: typedOrNull(row.loan_rate), loanYears: typedOrNull(row.loan_years),
  } };
  return p;
}
const WAY_ID = { line: "heloc", refi: "refi", loan: "loan", cash: "cash" };
const KEY_WAY = { heloc: "line", refi: "refi", loan: "loan", cash: "cash" };

function renovationMismatches(row, part, d) {
  const out = [], way = (k) => d.ways.find((w) => w.id === WAY_ID[k]) ?? null;
  if (part === "project") {
    near(out, "value_added", d.valueAdded, row.value_added);
    near(out, "equity_change", d.equityChange, row.equity_change);
    opt(out, "borrowable", d.home ? d.home.borrowable : null, row.borrowable);
  }
  if (part === "cushion") {
    const c = way("cash");
    same(out, "cash_fits", flag(c.fits), row.cash_fits);
    near(out, "cash_todays_money", c.today, row.cash_todays_money);
    near(out, "cushion", d.cushion.after, row.cushion);
    opt(out, "cushion_months", d.cushion.monthsAfter, row.cushion_months, RATE);
  }
  if (part === "line" || part === "loan") {
    const w = way(part), P = part;
    if (blank(row[`${P}_monthly`])) { if (w) out.push(`${P}: app a way, key none`); return out; }
    if (!w) return [`${P}: app none, key a way`];
    near(out, `${P}_monthly`, w.monthly, row[`${P}_monthly`]);
    near(out, `${P}_interest`, w.interest, row[`${P}_interest`]);
    near(out, `${P}_fees`, w.fees, row[`${P}_fees`]);
    same(out, `${P}_deductible (deductible kind of interest and the household itemizes)`, flag(w.deductible && d.itemizes), row[`${P}_deductible`]);
    near(out, `${P}_tax_saved`, w.taxSaved, row[`${P}_tax_saved`]);
    near(out, `${P}_todays_money`, w.today, row[`${P}_todays_money`]);
    same(out, `${P}_fits`, flag(w.fits), row[`${P}_fits`]);
  }
  if (part === "refi") {
    const w = way("refi");
    if (blank(row.refi_new_loan)) { if (w) out.push("refi: app a way, key none"); return out; }
    if (!w) return ["refi: app none, key a way"];
    near(out, "refi_fees (closing costs)", w.fees, row.refi_fees);
    near(out, "refi_payment_change (the page's monthly: new payment less the old)", w.monthly, row.refi_payment_change);
    near(out, "refi_interest (extra interest: new loan less the old mortgage's)", w.interest, row.refi_interest);
    same(out, "refi_deductible (deductible kind of interest and the household itemizes)", flag(w.deductible && d.itemizes), row.refi_deductible);
    near(out, "refi_tax_saved", w.taxSaved, row.refi_tax_saved);
    near(out, "refi_todays_money", w.today, row.refi_todays_money);
    same(out, "refi_fits", flag(w.fits), row.refi_fits);
  }
  if (part === "best") same(out, "best", KEY_WAY[d.best] ?? d.best, row.best);
  return out;
}

const SETS = {
  "vehicles.csv": ["car", "whatif", "keep", "buy", "lease"],
  "purchases.csv": ["save", "savegoals", "finance", "financegoals", "paycash"],
  "renovations.csv": ["project", "cushion", "line", "refi", "loan", "best"],
};
const PART_OF = Object.fromEntries(Object.entries(SETS).flatMap(([f, parts]) => parts.map((p) => [p, f])));
const idOf = (f, row) => row.case_id;

// Where the pages and the key part ways: a cause is "<part>-<why>", listed in golden/property-goals/todo.json, and its
// reason is WHY[why], which starts with the verdict. On 2026-10-31, against the key's fourth revision as corrected that
// day (E1), every row of every part agrees with the pages in the working tree, so there is no cause and todo.json is {}.
// The causes of the earlier runs, all settled, are in the header.
const VERDICTS = ["app wrong", "key wrong", "simplification", "convention"];
const WHY = {};
const reasonOf = (cause) => WHY[cause.slice(cause.indexOf("-") + 1)];
const todoLists = JSON.parse(read("todo.json"));
const TODO = {};   // "<id> <part>" -> reason
for (const [cause, ids] of Object.entries(todoLists)) {
  const part = cause.split("-")[0];
  for (const id of ids) { const k = `${id} ${part}`, why = `${cause}: ${reasonOf(cause)}`; TODO[k] = TODO[k] ? `${TODO[k]}; ${why}` : why; }
}

const PAGE = { "vehicles.csv": [vehiclePlan, vehiclesPage], "purchases.csv": [purchasePlan, purchasePage], "renovations.csv": [renovationPlan, renovationPage] };
const cache = new Map();
const pageOf = (f, row) => { const k = `${f} ${row.case_id}`; if (!cache.has(k)) { const [plan, page] = PAGE[f]; cache.set(k, page(plan(row), { today: TODAY })); } return cache.get(k); };
const CHECK = { "vehicles.csv": vehicleMismatches, "purchases.csv": purchaseMismatches, "renovations.csv": renovationMismatches };
const SIZE = { "vehicles.csv": 1500, "purchases.csv": 1500, "renovations.csv": 1500 };
const ROWS = Object.fromEntries(Object.keys(SETS).map((f) => [f, csv(f)]));

// ---- tests ----
for (const [f, rows] of Object.entries(ROWS)) {
  test(`the answer key has ${SIZE[f].toLocaleString("en-US")} rows in ${f}, each once (${rows.length})`, () => {
    assert.equal(rows.length, SIZE[f]);
    assert.equal(new Set(rows.map((r) => idOf(f, r))).size, SIZE[f]);
  });
}
test("vehicles.csv: every plan gives the Vehicles page the key's cars, values and loans", () => {
  for (const row of ROWS["vehicles.csv"]) {
    const d = pageOf("vehicles.csv", row), cars = carsOf(row);
    assert.equal(d.cars.length, cars.length, row.case_id);
    cars.forEach((c, i) => {
      const a = d.cars[i];
      assert.equal(a.name, c.name, row.case_id);
      assert.equal(a.value, num(c.value), row.case_id);
      if (blank(c.loan_balance)) assert.equal(a.loan, null, row.case_id);
      else assert.deepEqual([a.loan.balance, a.loan.rate, a.loan.payment], [num(c.loan_balance), num(c.loan_rate), num(c.loan_payment)], row.case_id);
    });
  }
});
test("purchases.csv: every plan gives the Big purchase planner the key's spare, usable cash, emergency target and goals", () => {
  for (const row of ROWS["purchases.csv"]) {
    const p = purchasePlan(row), d = pageOf("purchases.csv", row), liq = liquidityPage(p, { today: TODAY });
    assert.ok(Math.abs(d.spare - num(row.spare)) <= 1e-6, `${row.case_id} spare ${d.spare}`);
    assert.equal(liq.now, num(row.usable_cash), row.case_id);
    assert.equal(d.cash.target, num(row.emergency_target), row.case_id);
    assert.equal(p.assumptions.returnCash, num(row.cash_return), row.case_id);
    const gl = goalsPage(p, { today: TODAY }).goals;
    goalsOf(row).forEach((g, i) => assert.deepEqual([gl[i].name, gl[i].targetThen, gl[i].funded, gl[i].monthly, gl[i].rate, gl[i].targetDate], [g.name, num(g.target), num(g.set_aside), num(g.monthly), num(g.growth), g.due], row.case_id));
  }
});
test("renovations.csv: every plan gives the Renovation page the key's usable cash, plan return, top rate, itemizing, essential spending, home and mortgage", () => {
  for (const row of ROWS["renovations.csv"]) {
    const p = renovationPlan(row), d = pageOf("renovations.csv", row);
    assert.equal(d.cushion.now, num(row.usable_cash), row.case_id);
    assert.ok(Math.abs(d.discount - num(row.blended_return)) <= 1e-12, `${row.case_id} plan return ${d.discount}`);
    assert.ok(Math.abs(d.marginal - num(row.top_rate)) <= 1e-9, `${row.case_id} top rate ${d.marginal}`);
    assert.equal(d.itemizes, yes(row.itemizes), row.case_id);
    assert.equal(liquidityPage(p, { today: TODAY }).expenses.essentialMonthly, num(row.essential_monthly), row.case_id);
    assert.equal(d.home ? d.home.value : null, yes(row.home) ? num(row.home_value) : null, row.case_id);
    assert.deepEqual(d.mortgage ? [d.mortgage.owed, d.mortgage.rate, d.mortgage.payment] : null, blank(row.mortgage_balance) ? null : [num(row.mortgage_balance), num(row.mortgage_rate), num(row.mortgage_payment)], row.case_id);
  }
});
test("every reason starts with its verdict (app wrong, key wrong, simplification or convention)", () => {
  for (const [why, reason] of Object.entries(WHY)) assert.ok(VERDICTS.some((v) => reason.startsWith(`${v}: `)), `${why}: ${reason.slice(0, 40)}`);
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
      test(`property-goals ${id} ${part}`, reason ? { todo: reason } : {}, () => {
        assert.deepEqual(CHECK[f](row, part, pageOf(f, row)), []);
      });
    }
  }
}


// ---- reported only, as counts: the key's contrast and law columns (its earlier readings, other readings, the law) ----
// The page states its convention and the main columns follow it, so these never fail; a count says, on the rows where a
// contrast differs from its main column, whether the page sides with the main reading, the contrast, or neither: how far
// the other reading would move the page's figure, and a check that the page has not drifted to it.
const at = (a, b, tol = CENT) => typeof a === "number" && !blank(b) && Math.abs(a - num(b)) <= tol + EPS;
/** An amount: on the rows where the contrast differs from the main column by more than tol, which one the page equals. */
function contrast(rows, f, appOf, mainCol, altCol, tol = CENT) {
  const c = { differ: 0, main: 0, alt: 0 };
  for (const row of rows) {
    if (blank(row[mainCol]) || blank(row[altCol]) || Math.abs(num(row[mainCol]) - num(row[altCol])) <= tol + EPS) continue;
    const a = appOf(pageOf(f, row), row);
    if (a === null || a === undefined) continue;
    c.differ++; if (at(a, row[mainCol], tol)) c.main++; else if (at(a, row[altCol], tol)) c.alt++;
  }
  return `${altCol} differs from ${mainCol} on ${c.differ} rows: the page equals ${mainCol} on ${c.main}, ${altCol} on ${c.alt}, neither on ${c.differ - c.main - c.alt}`;
}
/** A flag, a name or a list: on the rows where the contrast's text differs from the main column's, which one the page
 * matches (`match(app, keyText)`; a blank is a value here: "no goal gives way" is an answer). */
function contrastOf(rows, f, appOf, mainCol, altCol, match = (a, k) => a === k) {
  const c = { differ: 0, main: 0, alt: 0 };
  for (const row of rows) {
    if (row[mainCol] === row[altCol]) continue;
    const a = appOf(pageOf(f, row), row);
    if (a === null || a === undefined) continue;
    c.differ++; if (match(a, row[mainCol])) c.main++; else if (match(a, row[altCol])) c.alt++;
  }
  return `${altCol} differs from ${mainCol} on ${c.differ} rows: the page matches ${mainCol} on ${c.main}, ${altCol} on ${c.alt}, neither on ${c.differ - c.main - c.alt}`;
}
/** The cheapest of keep, buy and lease by the key's costs, as A9 finds it: a walk keep, buy, lease, a later way taking
 * over only when its cost is lower by more than $1. */
const cheapestOf = (costs) => Object.entries(costs).reduce((a, b) => (b[1] < a[1] - 1 ? b : a))[0];

test("reported: the Vehicles page against the key's contrasts (what rises, whose running costs on the lease, the trade-in, the sales tax, the debt left on Keep, the new car's loss, the cheapest's margin, the blank inputs), as counts", (t) => {
  const V = ROWS["vehicles.csv"], F = "vehicles.csv", cost = (id) => (d) => d.comparison.options.find((x) => x.id === id).cost;
  t.diagnostic(`V1 against A1 (every running cost rising), Keep: ${contrast(V, F, cost("keep"), "keep_cost", "alt_keep_rise_all")}`);
  t.diagnostic(`V2 against A1, Buy: ${contrast(V, F, cost("buy"), "buy_cost", "alt_buy_rise_all")}`);
  t.diagnostic(`V2 against A1, Lease: ${contrast(V, F, cost("lease"), "lease_cost", "alt_lease_rise_all")}`);
  t.diagnostic(`V2 against Keep's rule on the new car (its upkeep rising), Buy: ${contrast(V, F, cost("buy"), "buy_cost", "alt_buy_rise_upkeep_only")}`);
  t.diagnostic(`V2 against Keep's rule on the new car, Lease: ${contrast(V, F, cost("lease"), "lease_cost", "alt_lease_rise_upkeep_only")}`);
  t.diagnostic(`A2, the old car's running costs on the lease (flat, upkeep halved): ${contrast(V, F, cost("lease"), "lease_cost", "alt_lease_old_running")}`);
  t.diagnostic(`A5 and V3, the lease without the trade-in's equity (the brief's): ${contrast(V, F, cost("lease"), "lease_cost", "alt_lease_equity_not_credited")}`);
  t.diagnostic(`A6 and V3, Keep with what the old loan still owes left in (the brief's): ${contrast(V, F, cost("keep"), "keep_cost", "alt_keep_owed_end_ignored")}`);
  t.diagnostic(`TXMV, the sales tax on the price less the trade-in: ${contrast(V, F, cost("buy"), "buy_cost", "alt_buy_tax_after_trade_in_credit")}`);
  t.diagnostic(`A9 against the lowest cost (ties keep, buy, lease; alt_cheapest_lowest), the cheapest: ${contrastOf(V, F, (d) => d.best, "cheapest", "alt_cheapest_lowest")}`);
  t.diagnostic(`D1 against A3 (a blank new mpg or upkeep keeping the old car's), Buy: ${contrast(V, F, cost("buy"), "buy_cost", "alt_buy_blank_keeps_old")}`);
  t.diagnostic(`D1 against A3, Lease: ${contrast(V, F, cost("lease"), "lease_cost", "alt_lease_blank_keeps_old")}`);
  t.diagnostic(`E1 against the fourth revision's reading (an electric first car's new car at 32 mpg and the fuel price it carries), Buy: ${contrast(V, F, cost("buy"), "buy_cost", "alt_buy_electric_new_at_32_mpg")}`);
  t.diagnostic(`E1 against the fourth revision's reading, Lease: ${contrast(V, F, cost("lease"), "lease_cost", "alt_lease_electric_new_at_32_mpg")}`);
  let a1 = 0, a1Page = 0, keepRule = 0, keepRulePage = 0, e1 = 0, e1Page = 0, close = 0, below0 = 0, keyBelow0 = 0, loss = 0, cashBack = 0, cashBackPage = 0, mpg32 = 0, blankMpg = 0;
  for (const row of V) {
    const d = pageOf(F, row), keep = d.comparison.options.find((x) => x.id === "keep"), buy = d.comparison.options.find((x) => x.id === "buy");
    const underA1 = cheapestOf({ keep: num(row.alt_keep_rise_all), buy: num(row.alt_buy_rise_all), lease: num(row.alt_lease_rise_all) });
    if (underA1 !== row.cheapest) { a1++; if (d.best === row.cheapest) a1Page++; }
    const underKeepRule = cheapestOf({ keep: num(row.keep_cost), buy: num(row.alt_buy_rise_upkeep_only), lease: num(row.alt_lease_rise_upkeep_only) });
    if (underKeepRule !== row.cheapest) { keepRule++; if (d.best === row.cheapest) keepRulePage++; }
    const underE1 = cheapestOf({ keep: num(row.keep_cost), buy: num(row.alt_buy_electric_new_at_32_mpg), lease: num(row.alt_lease_electric_new_at_32_mpg) });
    if (underE1 !== row.cheapest) { e1++; if (d.best === row.cheapest) e1Page++; }
    if (num(row.cash_back) > 0) { cashBack++; if (at(d.comparison.cashBack, row.cash_back)) cashBackPage++; }
    if (blank(row.new_mpg)) { blankMpg++; if (d.inputs.newMpg === 32) mpg32++; }
    const costs = [num(row.keep_cost), num(row.buy_cost), num(row.lease_cost)].sort((x, y) => x - y);
    if (costs[1] - costs[0] <= 1) close++;
    if (keep.cost < 0) below0++;
    if (num(row.keep_cost) < 0) keyBelow0++;
    if (at(1 - buy.endValue / d.inputs.newPrice, row.new_car_loss_at_end, RATE)) loss++;   // the price the page took (D1: a blank is 35,000)
  }
  t.diagnostic(`the cheapest way (the A9 walk) under A1 (alt_*_rise_all) differs from the key's cheapest on ${a1} rows, the page names the key's cheapest on ${a1Page}; under Keep's rule on the new car on ${keepRule} rows, the page names the key's cheapest on ${keepRulePage}; under the fourth revision's 32 mpg for an electric first car (E1's contrast) on ${e1} rows, the page names the key's cheapest on ${e1Page}`);
  t.diagnostic(`A9's $1 margin: the two cheapest ways are within $1 of each other on ${close} rows (only there can the walk and the plain lowest part)`);
  t.diagnostic(`A7, cash back: on ${cashBack} rows the key has cash back (the equity and the cash down past the new car with its tax); the page's cashBack is the key's on ${cashBackPage}`);
  t.diagnostic(`D1 and E1, a blank new mpg: on ${blankMpg} rows the new mpg is blank and the page takes 32 on ${mpg32}; on an electric first car the 32 does not enter, the new car is charged like the car (E1)`);
  t.diagnostic(`Keep costs less than nothing on ${below0} rows on the page and ${keyBelow0} in the key: the car's value at the end comes back while its value today is not counted as paid (Buy and Lease take the same equity as the trade-in), so a short keep of a car worth more than its running costs shows a negative cost; the differences between the ways are what compare`);
  t.diagnostic(`the new car's loss at the end (new_car_loss_at_end, 1 - 0.8 x 0.85^(years - 1); the sources say "around 60%" by year five) equals the page's 1 - end value / price on ${loss} of ${V.length} rows`);
});
test("reported: the Big purchase planner against the key's other month counts, a done goal giving way, a spare below 0 taken literally, the emergency-target fit, the other payments, the deferred-interest contrast and the 50-cent line, as counts", (t) => {
  const P = ROWS["purchases.csv"], F = "purchases.csv";
  /** the goals that give way and what each gives, against a key list */
  const gives = (e, v) => { const w = givingOf(v); return e.list.length === w.length && e.list.every((g, i) => g.name === w[i].name && at(g.from, w[i].gives)); };
  let dated = 0, w1 = 0, w2 = 0, w3 = 0, doneGiving = 0, ways = 0, promoRows = 0, warned = 0, deferred = 0, left = 0, more = 0, small = 0, fitsDiffer = 0, screenWarns = 0;
  for (const row of P) {
    const d = pageOf(F, row), f = d.finance, done = new Set(goalsPage(purchasePlan(row), { today: TODAY }).goals.filter((g) => g.status === "done").map((g) => g.name));
    if (!blank(row.when)) { dated++; if (d.months === num(row.months)) w2++; if (d.months === Math.max(1, num(row.alt_months_w1))) w1++; if (d.months === Math.max(1, num(row.months_w3))) w3++; }
    for (const e of [d.effect.save, d.effect.finance]) if (e) { ways++; if (e.list.some((g) => done.has(g.name))) doneGiving++; }
    if (row.cash_fits !== row.alt_cash_fits_keeps_emergency_target) { fitsDiffer++; if (d.cash.target && d.cash.after < d.cash.target) screenWarns++; }
    if (!blank(row.balance_after_promo)) { promoRows++; deferred += num(row.deferred_interest_if_not_paid); left += num(row.balance_after_promo); if (f.promo && f.promo < f.months) warned++; }
    for (const [e, col] of [[d.effect.save, "save_more_than_you_have"], [d.effect.finance, "finance_more_than_you_have"]]) if (e && yes(row[col])) { more++; if (e.uncovered <= 0.5) small++; }
  }
  t.diagnostic(`P1, whole months: of ${dated} rows with a date the page's months equal W2 (months, the main) on ${w2}, W1 (alt_months_w1) on ${w1}, W3 (months_w3, at least 1) on ${w3}`);
  t.diagnostic(`P1 against W1, the monthly saving: ${contrast(P, F, (d) => d.save?.monthly, "save_monthly", "alt_save_monthly_w1")}`);
  t.diagnostic(`P1 against W1, what the saving earns: ${contrast(P, F, (d) => d.save?.earned, "save_earned", "alt_save_earned_w1")}`);
  t.diagnostic(`P2 against a done goal giving way, saving up, who gives and how much: ${contrastOf(P, F, (d) => d.effect.save, "save_giving", "alt_save_giving_done_goals_give", gives)}`);
  t.diagnostic(`P2, saving up, what is left uncovered: ${contrast(P, F, (d) => d.effect.save?.uncovered, "save_uncovered", "alt_save_uncovered_done_goals_give")}`);
  t.diagnostic(`P2, financing, who gives and how much: ${contrastOf(P, F, (d) => d.effect.finance, "finance_giving", "alt_finance_giving_done_goals_give", gives)}`);
  t.diagnostic(`P2, financing, what is left uncovered: ${contrast(P, F, (d) => d.effect.finance.uncovered, "finance_uncovered", "alt_finance_uncovered_done_goals_give")}`);
  t.diagnostic(`P2: a goal the Goals page counts as done is among the goals giving way in ${doneGiving} of the page's ${ways} ways (P2: never)`);
  /** what a way's goals must cover: what they give + what is left over (the page's need) */
  const need = (e) => (e ? e.list.reduce((s, g) => s + g.from, 0) + e.uncovered : null);
  t.diagnostic(`B5 against a spare below 0 taken literally, saving up, the need: ${contrast(P, F, (d) => need(d.effect.save), "save_need", "alt_save_need_spare_literal")}`);
  t.diagnostic(`B5, saving up, what is left uncovered: ${contrast(P, F, (d) => d.effect.save?.uncovered, "save_uncovered", "alt_save_uncovered_spare_literal")}`);
  t.diagnostic(`B5, financing, the need: ${contrast(P, F, (d) => need(d.effect.finance), "finance_need", "alt_finance_need_spare_literal")}`);
  t.diagnostic(`B5, financing, what is left uncovered: ${contrast(P, F, (d) => d.effect.finance?.uncovered, "finance_uncovered", "alt_finance_uncovered_spare_literal")}`);
  t.diagnostic(`B5: the spare is below 0 on ${P.filter((r) => num(r.spare) < 0).length} rows of the key and on ${P.filter((r) => pageOf(F, r).spare < 0).length} on the page`);
  t.diagnostic(`P3 against the emergency-target fit (what is left >= the target): ${contrastOf(P, F, (d) => flag(d.cash.fits), "cash_fits", "alt_cash_fits_keeps_emergency_target")}; on ${screenWarns} of those ${fitsDiffer} rows the screen still says the cash left is under the emergency target (view.js), so the contrast's reading is the page's warning, not its verdict`);
  t.diagnostic(`the APR from the first month: ${contrast(P, F, (d) => d.finance.payment, "finance_payment", "alt_level_payment")}`);
  t.diagnostic(`the APR from the first month, the interest: ${contrast(P, F, (d) => d.finance.interest, "finance_interest", "alt_level_interest")}`);
  t.diagnostic(`all 0%: ${contrast(P, F, (d) => d.finance.payment, "finance_payment", "alt_all_zero_payment")}`);
  t.diagnostic(`B9, deferred interest (CFPBDI): on ${promoRows} rows with 0% then a rate the page models a true 0% period (${left.toFixed(2)} still owed when the free months end, in all); it warns that such offers can charge the interest back on ${warned}; the key's charge-back would come to ${deferred.toFixed(2)} in all`);
  t.diagnostic(`of ${more} ways where the key says "more than you have", the page's uncovered amount is 50 cents a month or less on ${small} (the page names the amount only above 50 cents)`);
});
test("reported: the Renovation page against the key's earlier readings of the tax (R1's line figure among them), today's money, the refinance without a mortgage or with a blank rate and the ranking, the 3%-of-the-new-loan reading, the law's shares and the lenders' limits, as counts", (t) => {
  const R = ROWS["renovations.csv"], F = "renovations.csv", way = (id) => (d) => d.ways.find((x) => x.id === id) ?? null;
  const refi = way("refi"), line = way("heloc");
  t.diagnostic(`R1 against no limit, the line's tax saved: ${contrast(R, F, (d) => line(d)?.taxSaved, "line_tax_saved", "alt_line_tax_saved_no_limit")}`);
  t.diagnostic(`L1 (P936 Table 1, lines 12 to 15: the limit's share on ALL the home's interest, so the line also cuts the mortgage's deduction over the line's term) against R1's line figure (the line's own interest x the share), the line's tax saved: ${contrast(R, F, (d) => line(d)?.taxSaved, "line_tax_saved", "alt_line_tax_saved_r1")}`);
  {
    // the best if the line's today's money were R1's (alt_line_todays_money_r1): the page's ways that fit, walked by R5
    let n = 0, moved = 0;
    for (const row of R) {
      if (blank(row.alt_line_todays_money_r1) || Math.abs(num(row.alt_line_todays_money_r1) - num(row.line_todays_money)) <= CENT) continue;
      const d = pageOf(F, row), ways = d.ways.filter((w) => w.fits).map((w) => ({ id: w.id, today: w.id === "heloc" ? num(row.alt_line_todays_money_r1) : w.today }));
      n++;
      if (ways.length && ways.reduce((a, w) => (w.today < a.today - 1 ? w : a), ways[0]).id !== d.best) moved++;
    }
    t.diagnostic(`L1 against R1's line figure, the line's today's money: ${contrast(R, F, (d) => line(d)?.today, "line_todays_money", "alt_line_todays_money_r1")}; with R1's figure for the line the page's best would change on ${moved} of those ${n} rows`);
  }
  t.diagnostic(`R1 against the extra interest x top (C2), the refinance's tax saved: ${contrast(R, F, (d) => refi(d)?.taxSaved, "refi_tax_saved", "alt_refi_tax_saved_extra_interest")}`);
  t.diagnostic(`R1 against the new loan's whole interest x top, the refinance's tax saved: ${contrast(R, F, (d) => refi(d)?.taxSaved, "refi_tax_saved", "refi_tax_saved_whole_new_interest")}`);
  t.diagnostic(`R2 against before tax (C3), the line's today's money: ${contrast(R, F, (d) => line(d)?.today, "line_todays_money", "alt_line_todays_money_before_tax")}`);
  t.diagnostic(`R2 against before tax (C3), the refinance's today's money: ${contrast(R, F, (d) => refi(d)?.today, "refi_todays_money", "alt_refi_todays_money_before_tax")}`);
  t.diagnostic(`C1, 3% of the new loan, the closing costs: ${contrast(R, F, (d) => refi(d)?.fees, "refi_fees", "alt_refi_fees")}`);
  t.diagnostic(`C1, 3% of the new loan, the new payment (the page's change + the old payment): ${contrast(R, F, (d) => refi(d) ? refi(d).monthly + d.mortgage.payment : null, "refi_monthly", "alt_refi_monthly")}`);
  t.diagnostic(`C1, 3% of the new loan, today's money (after tax): ${contrast(R, F, (d) => refi(d)?.today, "refi_todays_money", "alt_refi_todays_money")}`);
  t.diagnostic(`C1, 3% of the new loan, the new loan over the value: ${contrast(R, F, (d) => refi(d)?.ltv, "refi_ltv_after", "alt_refi_ltv_after", RATE)}`);
  /** R5: the ways that fit walked in the page's order (cash, line, refinance, loan), a way taking over only when lower by more than $1, repeated */
  const walk = (ways) => { const left = ways.filter((w) => w.fits), out = []; while (left.length) { const b = left.reduce((a, w) => (w.today < a.today - 1 ? w : a), left[0]); out.push(KEY_WAY[b.id]); left.splice(left.indexOf(b), 1); } return out.join(";"); };
  const ORDER = ["cash", "heloc", "refi", "loan"];
  const lowest = (ways) => ways.filter((w) => w.fits).sort((a, b) => a.today - b.today || ORDER.indexOf(a.id) - ORDER.indexOf(b.id)).map((w) => KEY_WAY[w.id]).join(";");
  let rank = 0, low = 0, lowRows = 0, lowBest = 0, lowBestPage = 0, before = 0, beforeBest = 0, beforeBestPage = 0;
  let noMtg = 0, noMtgAlt = 0, noMtgPage = 0, noMtgFits = 0, noMtgBest = 0, noMtgBestPage = 0;
  let lineShare = 0, lineShareRows = 0, refiShare = 0, refiShareRows = 0, ltv = 0, ltvRows = 0, negPage = 0, negKey = 0, capped = 0, cappedPage = 0;
  let fha = 0, fhaRefi = 0, fhaFits = 0, cltv = 0, cltvRows = 0;
  for (const row of R) {
    const d = pageOf(F, row), r = refi(d), l = line(d), best = KEY_WAY[d.best] ?? d.best;
    if (walk(d.ways) === row.ranking) rank++;
    if (row.alt_ranking_lowest_first !== row.ranking) { lowRows++; if (lowest(d.ways) === row.alt_ranking_lowest_first) low++; }
    if (row.alt_ranking_lowest_first.split(";")[0] !== row.best) { lowBest++; if (best === row.best) lowBestPage++; }
    if (row.alt_ranking_before_tax !== row.ranking) before++;
    if (row.alt_ranking_before_tax.split(";")[0] !== row.best) { beforeBest++; if (best === row.best) beforeBestPage++; }
    if (yes(row.home) && blank(row.mortgage_balance)) {
      noMtg++; if (!r) noMtgPage++;
      if (!blank(row.alt_refi_no_mortgage_monthly)) { noMtgAlt++; if (yes(row.alt_refi_no_mortgage_fits)) noMtgFits++; }
      if (row.alt_ranking_refi_no_mortgage.split(";")[0] === "refi") { noMtgBest++; if (best === row.best) noMtgBestPage++; }
    }
    if (l && !blank(row.line_law_share)) { lineShareRows++; if (at(l.deductibleShare, row.line_law_share, RATE)) lineShare++; }
    if (r && !blank(row.refi_law_share)) { refiShareRows++; if (at(r.deductibleShare, row.refi_law_share, RATE)) refiShare++; }
    if (r && !blank(row.refi_ltv_after)) { ltvRows++; if (at(r.ltv, row.refi_ltv_after, RATE)) ltv++; }
    if (r && r.taxSaved < -0.005) negPage++;
    if (num(row.refi_tax_saved) < -0.005) negKey++;
    if (yes(row.itemizes) && !blank(row.line_law_share) && num(row.line_law_share) < 1) { capped++; if (l && at(l.taxSaved, row.line_tax_saved)) cappedPage++; }
    if (l && !blank(row.line_cltv_after)) { cltvRows++; if ((num(row.line_cltv_after) <= 0.85 + EPS) === l.fits) cltv++; }
    if (yes(row.refi_above_fha_80)) { fha++; if (r) { fhaRefi++; if (r.fits) fhaFits++; } }
  }
  t.diagnostic(`R5, the ranking (the page marks only the cheapest): the page's ways that fit, walked by R5 and repeated, are the key's ranking on ${rank} of ${R.length} rows`);
  t.diagnostic(`R5 against lowest first with exact ties by order (C7, alt_ranking_lowest_first): it differs from the ranking on ${lowRows} rows (the page's ways sorted that way give it on ${low}), and its first from the best on ${lowBest}, where the page's best is the key's best on ${lowBestPage}`);
  t.diagnostic(`R2 and R5 against the before-tax walk (alt_ranking_before_tax): it differs from the ranking on ${before} rows and its first from the best on ${beforeBest}, where the page's best is the key's (after-tax) best on ${beforeBestPage}`);
  t.diagnostic(`L1 against R1's line figure, the ranking (the page's ways that fit, walked by R5 and repeated): ${contrastOf(R, F, (d) => walk(d.ways), "ranking", "alt_ranking_line_r1")}`);
  t.diagnostic(`D1 against no refinance unless its rate and years are typed (C4's first half), the ranking: ${contrastOf(R, F, (d) => walk(d.ways), "ranking", "alt_ranking_blank_refi_not_offered")}`);
  {
    const withMtg = R.filter((r) => !blank(r.mortgage_balance)), noRate = withMtg.filter((r) => blank(r.refi_rate)), noYears = withMtg.filter((r) => blank(r.refi_years));
    t.diagnostic(`D1, a blank refinance rate or years on a home with a mortgage: the rate is blank on ${noRate.length} rows and the page takes 6.5% on ${noRate.filter((r) => pageOf(F, r).inputs.refiRate === 0.065).length}; the years on ${noYears.length} and the page takes 30 on ${noYears.filter((r) => pageOf(F, r).inputs.refiYears === 30).length}`);
  }
  t.diagnostic(`R3 against a refinance with an old side of 0 (C6): of ${noMtg} homes without a mortgage the page offers no refinance on ${noMtgPage}; the contrast offers one on ${noMtgAlt} (alt_refi_no_mortgage_*), it would fit on ${noMtgFits} and be the best on ${noMtgBest} (alt_ranking_refi_no_mortgage), where the page's best is the key's on ${noMtgBestPage}`);
  t.diagnostic(`R1, the law's shares (163(h)(3)(F), P936): the page's deductible share equals line_law_share on ${lineShare} of ${lineShareRows} lines and refi_law_share on ${refiShare} of ${refiShareRows} refinances; of ${capped} rows where the household itemizes and the line's debt is above the limit, the page's line tax saved is the key's on ${cappedPage}; the refinance's tax saved is below 0 on ${negPage} rows on the page and ${negKey} in the key`);
  t.diagnostic(`lenders' limits: the line fits exactly when the combined loan-to-value after it (line_cltv_after) is at most 85% on ${cltv} of ${cltvRows} rows; the page's new loan over the value is refi_ltv_after on ${ltv} of ${ltvRows} refinances; of ${fha} rows where the key's new loan is above the 80% cash-out limit (refi_above_fha_80, HUD ML 2019-11) the page offers a refinance on ${fhaRefi} and lets it fit on ${fhaFits}`);
});

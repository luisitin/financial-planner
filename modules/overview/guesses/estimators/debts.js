// modules/overview/guesses/estimators/debts.js -- PURE. Guesses for loans and cards (spec 7.D). Formulas and sources:
// ../README.md "Loans and cards". In this first commit (C1) only the interest rates are here, each a single published
// average; nothing writes them yet (Get started starts using them in C2, with what is owed and the payment).
//
//   debt.mortgage.rate  the state's average rate on mortgages people already have (FHFA NMDB 2026 Q2), the U.S. figure
//                       (4.4%, by loan count) with no state; "taken out 2022 or later" (tap mortgage-start): the average
//                       rate on new 2025 home-purchase loans (FHFA), the state's, or the U.S. one (6.3%, by loan count)
//                       with no state
//   debt.credit.rate    the average rate on cards that charge interest (Federal Reserve G.19, August 2026: 22.36%)
//   debt.student.rate   the federal rate on undergraduate loans first paid out July 2026 to June 2027 (6.52%)
//   debt.loan.rate      the average bank rate on a 24-month personal loan (Federal Reserve G.19, August 2026: 11.90%)
// Rates are rounded to 0.1 of a point (roundGuess) and carry no spread (R11: rates have no band).
import { T } from "../data/debts.js";
import { STATE_NAME } from "../data/index.js";

const cell = (id, row, col) => { const t = T[id]; const i = col === undefined ? 0 : t.cols.indexOf(col); return i >= 0 ? t.rows[row]?.[i] ?? null : null; };
const ok = (x) => typeof x === "number" && Number.isFinite(x);
/** The plan's state code when it is one of the 50 states or DC; null when blank or unknown. */
export const stateOf = (plan) => { const s = plan?.household?.state; return typeof s === "string" && s !== "US" && STATE_NAME[s] ? s : null; };
const LIABILITIES = () => "#/balance/liabilities";
const YOUR_STATE = { label: "your state", href: "#/household/people" };
const WHEN_TAKEN = { label: "when you took out the mortgage", href: "#/overview/setup/owe-amounts" };
const RATE = "Average contract interest rate (%)";
const STATE_NOW = "mortgage_outstanding_fhfa_by_state_2026q2", US_NOW = "mortgage_outstanding_fhfa_national", STATE_NEW = "mortgage_new_purchase_fhfa_by_state_2025", US_NEW = "mortgage_new_loans_fhfa_national_2025";

export const estimators = {
  "debt.mortgage.rate": {
    tier: 2, order: 4, label: "Mortgage interest rate", unit: "rate", weight: "big", page: LIABILITIES, reads: [],
    fn(plan) {
      const st = stateOf(plan);
      const recent = plan?.guide?.setup?.taps?.["mortgage-start"] === "2022on";
      if (recent && st && ok(cell(STATE_NEW, RATE, st))) {
        return { value: cell(STATE_NEW, RATE, st) / 100, sigma: null, measured: false, why: `the average on new home loans in ${STATE_NAME[st]} lately`, uses: { state: "typed", "mortgage-start": "typed" }, sharperWith: [], tables: [STATE_NEW] };
      }
      // taken out 2022 or later and no state: the U.S. rate on 2025 home-purchase loans, not on loans people already have
      if (recent && !st && ok(cell(US_NEW, RATE, "All Mortgages (Home Purchase)"))) {
        return { value: cell(US_NEW, RATE, "All Mortgages (Home Purchase)") / 100, sigma: null, measured: false, why: "the average on new U.S. home loans lately", uses: { "mortgage-start": "typed" }, sharperWith: [YOUR_STATE], tables: [US_NEW] };
      }
      if (st && ok(cell(STATE_NOW, RATE, st))) {
        return { value: cell(STATE_NOW, RATE, st) / 100, sigma: null, measured: false, why: `the average on ${STATE_NAME[st]} mortgages people already have`, uses: { state: "typed" }, sharperWith: recent ? [] : [WHEN_TAKEN], tables: [STATE_NOW] };
      }
      const us = cell(US_NOW, RATE, "by loan count");
      if (!ok(us)) return null;
      return { value: us / 100, sigma: null, measured: false, why: "the average on U.S. mortgages people already have", uses: {}, sharperWith: [YOUR_STATE, ...(recent ? [] : [WHEN_TAKEN])], tables: [US_NOW] };
    },
  },
  "debt.credit.rate": {
    tier: 2, order: 10, label: "Credit card interest rate", unit: "rate", weight: "big", page: LIABILITIES, reads: [],
    fn() {
      const r = cell("cc_apr_fed_g19", "Credit card plans, accounts assessed interest (commercial banks)");
      return ok(r) ? { value: r / 100, sigma: null, measured: false, why: "the average rate on cards that charge interest", uses: {}, sharperWith: [], tables: ["cc_apr_fed_g19"] } : null;
    },
  },
  "debt.student.rate": {
    tier: 2, order: 13, label: "Student loan interest rate", unit: "rate", weight: "small", page: LIABILITIES, reads: [],
    fn() {
      const r = cell("student_loan_rates_federal", "Direct Subsidized and Unsubsidized, undergraduate");
      return ok(r) ? { value: r / 100, sigma: null, measured: false, why: "the federal rate on new undergraduate student loans", uses: {}, sharperWith: [], tables: ["student_loan_rates_federal"] } : null;
    },
  },
  "debt.loan.rate": {
    tier: 2, order: 16, label: "Loan interest rate", unit: "rate", weight: "small", page: LIABILITIES, reads: [],
    fn() {
      const r = cell("auto_personal_rate_fed_g19", "Personal loan, 24-month (commercial banks)");
      return ok(r) ? { value: r / 100, sigma: null, measured: false, why: "the average bank rate on a two-year personal loan", uses: {}, sharperWith: [], tables: ["auto_personal_rate_fed_g19"] } : null;
    },
  },
};

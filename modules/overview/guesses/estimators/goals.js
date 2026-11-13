// modules/overview/guesses/estimators/goals.js -- PURE. Goal amounts (spec 7.F: goal.home.target). Formulas: ../README.md
// "Goal amounts". The Education goal's amount (goals/education:target) is the Education page's own figure and lives in
// overview/setup's estimators (it reads goals/education's compute, which this folder may not import: spec 6.2).
//
//   goal.home.target   Get started's "Buying a home" left blank on question 7b: the typical down payment, NAR's median share
//                      of the price (10% for first-time buyers, 23% for repeat buyers) x the state's median home value (ACS);
//                      the down payment only (no closing-cost table is bundled), which the why-line says
import { T as HOME } from "../data/home.js";
import { T as PURCHASE } from "../data/purchase.js";
import { STATE_NAME } from "../data/index.js";
import { ok, stateOf, profileOf, cpiSince, fit, YOUR_STATE } from "./common.js";

const ACS = "acs2025_median_home_value_by_state", NAR = "nar2025_home_buyer_profile";
const cell = (t, row, col) => { const i = t.cols.indexOf(col); const v = i >= 0 ? t.rows[row]?.[i] : null; return ok(v) && v > 0 ? v : null; };
/** NAR's median down payment, a share of the price: first-time buyers (a renter buys a first home) or repeat buyers. */
export const downShare = (repeat) => cell(PURCHASE[NAR], "median down payment (% of price)", repeat ? "repeat buyers" : "first-time buyers") / 100;

export const estimators = {
  "goal.home.target": {
    tier: 4, order: 7, label: "Home down payment to save", unit: "total", weight: "big", reads: [],
    page: () => "#/goals/house",
    fn(plan, { today }) {
      const st = stateOf(plan), t = HOME[ACS];
      const value = cell(t, "value", st ?? "US");
      if (!value) return null;
      // someone who owns a home already buys as a repeat buyer; a renter as a first-time buyer
      const repeat = profileOf(plan, today).tenure !== "renter";
      const share = downShare(repeat);
      const price = value * cpiSince(t.dollarsOf ?? 2025);
      const pct = `${Math.round(share * 100)}%`, where = st ? STATE_NAME[st] : "U.S.";
      return {
        value: price * share, sigma: null, measured: false,
        why: fit(`${pct} down on a typical ${where} home; add closing costs if you know them`, `${pct} down on a typical ${where} home, not counting closing costs`, `${pct} down on a typical home in your state; closing costs not counted`),
        uses: { state: st ? "typed" : null, tenure: "typed" },
        sharperWith: st ? [] : [YOUR_STATE],
        tables: [ACS, NAR],
      };
    },
  },
};

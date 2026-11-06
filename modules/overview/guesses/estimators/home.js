// modules/overview/guesses/estimators/home.js -- PURE. The home (spec 7.C: E18, E23, E24). Formulas and sources:
// ../README.md "The home".
//
//   home.value          what the home would sell for: what was paid, grown with the state's home price index since the
//                       year it was bought (FHFA HPI, to 2025), when both are known; else the state's median home value
//                       for owners with (or without) a mortgage (ACS 2025) x an income ratio and an income-adjusted age
//                       ratio on the Survey of Consumer Finances' home values (R2)
//   home.propertyTax    property tax a year: the home's value x the state's median tax over median value (ACS 2025)
//   home.insurance      home insurance a year: the state's average HO-3 premium (NAIC 2023) in 2025 prices (CPI)
//
// Helpers the mortgage guesses use (estimators/debts.js): homeValueFor (the home's value as the plan or the screen
// holds it, typed or not), escrowMonthly (tax and insurance a month, not rounded, so a payment worked back from them is
// the figure the spec's arithmetic uses), homePathOf.
import { T as HOME } from "../data/home.js";
import { T as SPEND } from "../data/spend.js";
import { STATE_NAME } from "../data/index.js";
import { profileOf, scfR2, cpiSince, placeOf, placeName, fit, ok, has, SCF_TABLES, YOUR_STATE, YOUR_PAY } from "./common.js";
import { isGuess } from "../../../../core/estimate/index.js";

const VALUE = "acs2025_median_home_value_by_state_and_mortgage_status", HPI = "fhfa_hpi_at_state_annual";
const PTAX = "acs2025_effective_property_tax_rate_by_state", HO3 = "naic2023_homeowners_premium_by_state";
const L = (p, k) => (Array.isArray(p?.[k]) ? p[k] : []);
const col = (t, row, c) => { const i = t.cols.indexOf(c); const v = i >= 0 ? t.rows[row]?.[i] : null; return ok(v) ? v : null; };
const HOME_ID = "setup-have-home";
const NET_WORTH = () => "#/balance/net-worth";
const HOME_PAGE = () => "#/property/home";
const COST_AND_WHEN = { label: "what the home cost and when", href: "#/property/home" };
const STATUS = { ownerWithMortgage: "with a mortgage", ownerWithoutMortgage: "without a mortgage" };

/** The home account a path names (accounts[<id>].balance, or a property entry's account), else Get started's own, else the plan's first home. */
function homeAccountOf(plan, path) {
  const accounts = L(plan, "accounts");
  const m = path ? /^(accounts|property)\[([^\]]+)\]\./.exec(path) : null;
  if (m?.[1] === "accounts") return accounts.find((a) => a?.id === m[2]) ?? null;
  if (m?.[1] === "property") { const e = L(plan, "property").find((x) => x?.id === m[2]); return accounts.find((a) => a?.id === e?.accountId) ?? null; }
  return accounts.find((a) => a?.id === HOME_ID) ?? accounts.find((a) => a?.type === "property") ?? null;
}
export const homePathOf = (plan, path) => `accounts[${homeAccountOf(plan, path)?.id ?? HOME_ID}].balance`;

/**
 * The home's value as the plan or the screen holds it: args.home (Get started's box, typed: a number, or null when left
 * blank) wins; else the home account's balance. -> { value, typed } | null (no figure: the caller asks home.value).
 */
export function homeValueFor(plan, { path = null, args = null } = {}) {
  if (has(args, "home")) return ok(args.home) && args.home > 0 ? { value: args.home, typed: true } : null;
  const a = homeAccountOf(plan, path);
  const v = a ? Number(a.balance) : NaN;
  if (!(v > 0)) return null;
  return { value: v, typed: !isGuess(plan, `accounts[${a.id}].balance`) };
}

/** The state's median property tax over median home value (percent of value a year), the U.S. figure with no state. */
const taxRateOf = (st) => col(HOME[PTAX], "median taxes / median value", st ?? "US");
/** The state's average HO-3 premium a year in 2023 dollars (U.S. with no state). */
const premiumOf = (st) => col(SPEND[HO3], "HO-3", st ?? "US");

/**
 * Property tax and home insurance a month, not rounded (the payment identity in debt.mortgage.owed and
 * debt.mortgage.payment uses them as the spec's arithmetic does: 210,000 x 1.223% / 12 = 214.0 and 1,116 x 1.057 / 12 =
 * 98.3). The home's value: typed or on file, else our guess (home.value). -> { tax, insurance, total, value } | null
 */
export function escrowMonthly(plan, { today, args = null, path = null } = {}, lib) {
  const st = lib.memo("profile", () => profileOf(plan, today)).state;
  let value = homeValueFor(plan, { path, args })?.value ?? null;
  if (value === null) value = lib.estimate("home.value", { path: homePathOf(plan, path), args })?.value ?? null;
  // the tax and insurance typed on Home (a year) win over the state's usual ones
  const acct = homeAccountOf(plan, path);
  const entry = acct ? L(plan, "property").find((x) => x?.kind === "home" && x.accountId === acct.id) : null;
  const typed = (k) => { const v = Number(entry?.[k]); return entry && typeof entry.id === "string" && v > 0 && !isGuess(plan, `property[${entry.id}].${k}`) ? v / 12 : null; };
  const rate = taxRateOf(st), prem = premiumOf(st);
  const tax = typed("propertyTax") ?? (ok(value) && ok(rate) ? value * rate / 100 / 12 : null);
  const insurance = typed("insurance") ?? (ok(prem) ? prem * cpiSince(2023) / 12 : null);
  if (!ok(tax) || !ok(insurance)) return null;
  return { tax, insurance, total: tax + insurance, value };
}

export const estimators = {
  "home.value": {
    tier: 2, order: 1, label: "What your home would sell for", unit: "total", weight: "big", page: NET_WORTH, reads: [],
    fn(plan, { today, path }, lib) {
      const prof = lib.memo("profile", () => profileOf(plan, today));
      const st = prof.state;
      // what was paid and when (Home's purchase price and date), grown with the state's home prices to 2025
      const acct = homeAccountOf(plan, path);
      const entry = acct ? L(plan, "property").find((x) => x?.kind === "home" && x.accountId === acct.id) : null;
      const price = Number(entry?.purchasePrice), year = Number(String(entry?.purchaseDate ?? "").slice(0, 4));
      if (st && price > 0 && year >= 1990) {
        const then = col(HOME[HPI], String(Math.min(year, 2025)), st), now = col(HOME[HPI], "2025", st);
        if (ok(then) && ok(now) && then > 0) {
          return { value: price * now / then, sigma: 0.15, measured: false, why: fit(`what you paid in ${year}, grown with ${STATE_NAME[st]} home prices since`, "what you paid, grown with home prices since"), uses: { price: "typed", state: "typed" }, sharperWith: [], tables: [HPI] };
        }
      }
      const status = STATUS[prof.tenure] ?? "all owners";
      const base = col(HOME[VALUE], status, st ?? "US");
      const r = scfR2("primaryResidence", { income: prof.income, age: prof.age });
      if (!ok(base) || !r) return null;
      const words = prof.tenure === "ownerWithMortgage" ? " with a mortgage" : "";
      const on = prof.income ? (prof.payHow === "guess" ? ", on our pay guess" : ", on your pay") : "";
      return {
        value: base * r.parts.rInc * r.parts.resid, sigma: r.sigma, measured: r.sigma !== null,
        why: fit(`typical for ${placeOf(st)} home${words}${on}`, `typical for ${placeOf(st)} home${on}`),
        uses: { state: st ? "typed" : null, pay: prof.payHow, age: prof.age !== null ? "typed" : null },
        sharperWith: [...(st ? [] : [YOUR_STATE]), ...(prof.income ? [] : [YOUR_PAY]), COST_AND_WHEN].slice(0, 2),
        tables: [VALUE, ...SCF_TABLES],
      };
    },
  },
  "home.propertyTax": {
    tier: 2, order: 2, label: "Property tax a year", unit: "year", weight: "big", page: HOME_PAGE, reads: ["home.value"],
    fn(plan, { today, path, args }, lib) {
      const st = lib.memo("profile", () => profileOf(plan, today)).state;
      const rate = taxRateOf(st);
      let home = homeValueFor(plan, { path, args });
      if (!home) { const g = lib.estimate("home.value", { path: homePathOf(plan, path), args }); home = g ? { value: g.value, typed: false, tables: g.tables } : null; }
      if (!home || !ok(rate)) return null;
      const share = `${Math.round(rate * 10) / 10}%`;
      return {
        value: home.value * rate / 100, sigma: null, measured: false,
        why: `${placeName(st)} homes pay about ${share} of their value a year`,
        uses: { state: st ? "typed" : null, value: home.typed ? "typed" : "guess" },
        sharperWith: st ? [] : [YOUR_STATE], tables: [PTAX, ...(home.tables ?? [])],
      };
    },
  },
  "home.insurance": {
    tier: 2, order: 3, label: "Home insurance a year", unit: "year", weight: "small", page: HOME_PAGE, reads: [],
    fn(plan, { today }, lib) {
      const st = lib.memo("profile", () => profileOf(plan, today)).state;
      const prem = premiumOf(st);
      if (!ok(prem)) return null;
      return {
        value: prem * cpiSince(2023), sigma: null, measured: false,
        why: `the average ${placeName(st)} homeowner policy, in 2025 prices`,
        uses: { state: st ? "typed" : null }, sharperWith: st ? [] : [YOUR_STATE], tables: [HO3],
      };
    },
  },
};

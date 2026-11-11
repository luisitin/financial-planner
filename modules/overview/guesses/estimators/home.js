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
import { profileOf, scfR2, homeRatios, HOME_RATIO_TABLES, cpiSince, placeOf, placeName, fit, ok, has, SCF_TABLES, YOUR_STATE, YOUR_PAY } from "./common.js";
import { isGuess, guessAt, markGuess, clearGuess } from "../../../../core/estimate/index.js";
import { boughtGuess, yearOf, TABLE as PT } from "./purchase.js";
import { homeOfLoan, homeEntryFor } from "./loanhome.js";
export { homeOfLoan, homeEntryFor };

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
/** The path of the home account a path (or, with `loanId`, a loan) is on; for a loan with no home of its own, null (not the main home's). */
export function homePathOf(plan, path, loanId) {
  if (loanId !== undefined) { const a = homeOfLoan(plan, loanId)?.account; return a ? `accounts[${a.id}].balance` : !loanId || loanId === "setup-owe-mortgage" ? `accounts[${HOME_ID}].balance` : null; }
  return `accounts[${homeAccountOf(plan, path)?.id ?? HOME_ID}].balance`;
}

/**
 * The home's value as the plan or the screen holds it: args.home (Get started's box, typed: a number, or null when left
 * blank) wins; else the home account's balance. -> { value, typed } | null (no figure: the caller asks home.value).
 */
export function homeValueFor(plan, { path = null, loanId, args = null } = {}) {
  if (has(args, "home")) return ok(args.home) && args.home > 0 ? { value: args.home, typed: true } : null;
  if (loanId !== undefined) {
    const h = homeOfLoan(plan, loanId);
    if (!h) return null;
    if (!h.account) return h.value > 0 ? { value: h.value, typed: true } : null;
    const v = Number(h.account.balance);
    return v > 0 ? { value: v, typed: !isGuess(plan, `accounts[${h.account.id}].balance`) } : null;
  }
  const a = homeAccountOf(plan, path);
  const v = a ? Number(a.balance) : NaN;
  if (!(v > 0)) return null;
  return { value: v, typed: !isGuess(plan, `accounts[${a.id}].balance`) };
}

/** The property entry Get started makes for the home (its "Year you bought it" box writes the purchase date there). */
export const SETUP_HOME_ENTRY = "setup-home";
/**
 * What the plan or the screen says about the purchase: { year, date, price } (null for what is not said). The screen's
 * answer (args.bought: a year, or null for a box left blank) wins; else the purchase date and price on the Home page's entry
 * for this home (or, for a loan a rental names, that rental's). A date in the future counts as no answer.
 */
export function purchaseOf(plan, { path = null, loanId = null, args = null } = {}) {
  const props = L(plan, "property");
  let entry;
  if (loanId) {
    // a loan's own home only (a rental's entry names the loan; a second loan never reads the main home's year)
    const h = homeOfLoan(plan, loanId);
    entry = props.find((x) => x?.loanAccountId === loanId) ?? (h?.account ? homeEntryFor(plan, h.account.id) : null);
  } else {
    const acct = homeAccountOf(plan, path);
    entry = (acct ? homeEntryFor(plan, acct.id) : null) ?? props.find((x) => x?.id === SETUP_HOME_ENTRY) ?? null;
  }
  const date = typeof entry?.purchaseDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(entry.purchaseDate) ? entry.purchaseDate : null;
  const price = Number(entry?.purchasePrice) > 0 ? Number(entry.purchasePrice) : null;
  if (has(args, "bought") && (!loanId || loanId === "setup-owe-mortgage")) { const y = yearOf(args.bought); return { year: y, date: y && date && date.startsWith(String(y)) ? date : null, price }; }
  return { year: date ? Number(date.slice(0, 4)) : null, date, price };
}

/** A bound taken to two figures on the inside (the guess is shown to two figures, so rounding it must not step over the bound). */
const sig2 = (x, f) => { const p = 10 ** Math.max(0, Math.floor(Math.log10(x)) - 1); return f(x / p) * p; };
/** The mortgage balance the person typed (Get started's box, or the account), 0 when blank or a guess. */
function typedMortgageOwed(plan, args) {
  if (has(args, "owed")) return ok(args.owed) && args.owed > 0 ? args.owed : 0;
  const a = L(plan, "accounts").find((x) => x?.id === "setup-owe-mortgage");
  const v = a ? Math.abs(Number(a.balance)) : 0;
  return v > 0 && !isGuess(plan, `accounts[${a.id}].balance`) ? v : 0;
}
/** The state's median property tax over median home value (percent of value a year), the U.S. figure with no state. */
const taxRateOf = (st) => col(HOME[PTAX], "median taxes / median value", st ?? "US");
/** The state's average HO-3 premium a year in 2023 dollars (U.S. with no state). */
const premiumOf = (st) => col(SPEND[HO3], "HO-3", st ?? "US");

/**
 * Home insurance a year for a home worth `value`: the state's average HO-3 premium in 2025 prices (NAIC 2023 x CPI) for the
 * state's typical owner-occupied home (ACS 2025 median value), scaled by this home's value against that one, never under $350
 * (a policy has a floor whatever the house). Insurers price on the cost to rebuild, so the premium follows the home's value;
 * a flat state average gave a $64,000 home $2,150 (guess-sanity HD-HOMEINS, 2026-11-07). No value: the state average.
 */
export function insuranceYear(st, value) {
  const prem = premiumOf(st);
  if (!ok(prem)) return null;
  const avg = prem * cpiSince(2023), typical = col(HOME[VALUE], "all owners", st ?? "US");
  return ok(value) && value > 0 && ok(typical) && typical > 0 ? Math.max(350, avg * value / typical) : avg;
}
/**
 * Property tax and home insurance a month, not rounded (the payment identity in debt.mortgage.owed and
 * debt.mortgage.payment uses them as the spec's arithmetic does: 210,000 x 1.223% / 12 = 214.0 and 1,116 x 1.057 / 12 =
 * 98.3). The home's value: typed or on file, else our guess (home.value). -> { tax, insurance, total, value } | null
 */
export function escrowMonthly(plan, { today, args = null, path = null, loanId } = {}, lib) {
  const st = lib.memo("profile", () => profileOf(plan, today)).state;
  let value = homeValueFor(plan, { path, loanId, args })?.value ?? null;
  if (value === null) { const hp = homePathOf(plan, path, loanId); if (hp) value = lib.estimate("home.value", { path: hp, args })?.value ?? null; }
  // the tax and insurance typed on Home (a year) win over the state's usual ones
  let entry = null;
  if (loanId !== undefined) { const h = homeOfLoan(plan, loanId); entry = h?.entry ?? null; }
  else { const acct = homeAccountOf(plan, path); entry = acct ? homeEntryFor(plan, acct.id) : null; }
  const typed = (k) => { const v = Number(entry?.[k]); return entry && typeof entry.id === "string" && v > 0 && !isGuess(plan, `property[${entry.id}].${k}`) ? v / 12 : null; };
  const rate = taxRateOf(st), yearIns = insuranceYear(st, value);
  const tax = typed("propertyTax") ?? (ok(value) && ok(rate) ? value * rate / 100 / 12 : null);
  const insurance = typed("insurance") ?? (ok(yearIns) ? yearIns / 12 : null);
  if (!ok(tax) || !ok(insurance)) return null;
  return { tax, insurance, total: tax + insurance, value };
}

/** A lib that answers from the plan alone (no estimating): what the pages use to ask escrowMonthly outside a guess. */
const PLAIN = { memo: (_k, fn) => fn(), estimate: () => null };
/**
 * The tax and insurance inside a mortgage's monthly payment, for the pages that turn the payment into years left (Debts,
 * Mortgage, Pay off debts, Timeline, Your plan). The payment counts them in unless it and the balance are both the person's
 * own (then it is read as typed, nothing moves) or the person said "paid apart" (the tap `escrow`: "no"); `debts[].escrowMonthly`
 * (a number, optional) overrides. Never more than half the payment (the same floor the balance guess uses). A payment our
 * older Get started guessed (only the `paymentGuessed` flag, no ledger entry) is the loan's level payment alone
 * (typicalPayment: pmt over 30 years, no tax or insurance), so nothing comes out of it. And a guessed tax and insurance never
 * turns a payment that pays the loan off into one that never does: when taking them out would leave no more than the
 * month's interest (balance x rate / 12), the payment is read as the loan's alone. -> a number >= 0
 */
export function loanEscrow(plan, account, debt, today) {
  const pay = Number(debt?.minPayment);
  if (!account || account.type !== "mortgage" || !(pay > 0)) return 0;
  if (typeof debt.escrowMonthly === "number" && debt.escrowMonthly >= 0) return Math.min(debt.escrowMonthly, pay / 2);
  if (plan?.guide?.setup?.taps?.escrow === "no") return 0;
  const payGuess = typeof debt.id === "string" ? guessAt(plan, `debts[${debt.id}].minPayment`) : null;
  if (payGuess?.legacy) return 0;
  const guessed = payGuess !== null || isGuess(plan, `accounts[${account.id}].balance`);
  if (!guessed) return 0;
  return usualEscrowIn(plan, account, debt, today, PLAIN);
}
/**
 * The usual tax and insurance a month inside this mortgage's payment (escrowMonthly, by the home's value and state), never more
 * than half the payment, and none when taking them out would leave no more than the month's interest (the payment is then read
 * as the loan's alone). `lib`: PLAIN for the pages (the home's value on file), an estimator's own lib for the guess. -> a number >= 0
 */
function usualEscrowIn(plan, account, debt, today, lib) {
  const pay = Number(debt?.minPayment);
  if (!account || !(pay > 0)) return 0;
  let esc = null;
  try { esc = escrowMonthly(plan, { today, loanId: account.id }, lib); } catch { esc = null; }
  if (!esc) return 0;
  const out = Math.min(esc.total, pay / 2);
  const interest = Math.abs(Number(account.balance) || 0) * (Number(debt.rate) || 0) / 12;
  return interest > 0 && pay > interest && pay - out <= interest ? 0 : out;
}

// ---- the tax and insurance inside a mortgage payment, once the person's (2026-11-07, lane 1: items 2 and 3)
/** The guess key for `debts[<id>].escrowMonthly`: the usual tax and insurance inside the payment. */
export const ESCROW_KEY = "debt.mortgage.escrow";
const cents = (x) => Math.round(x * 100) / 100;
const escrowEst = (value) => ({ key: ESCROW_KEY, value: cents(value), unit: "month", sigma: null, dataAsOf: null });
/** Write our figure for a debt's tax and insurance (the field first: a guess is only ever written into a field that is there). */
const markEscrow = (draft, d, value, today) => { d.escrowMonthly = cents(value); markGuess(draft, `debts[${d.id}].escrowMonthly`, escrowEst(value), today); return true; };
/**
 * What each guessed mortgage payment holds, before a save that may make it the person's: { [debtId]: { pay, escrow } } for every
 * mortgage whose payment is our guess in the ledger (not the older flag) and holds tax and insurance (loanEscrow > 0).
 */
export function escrowBefore(plan, today) {
  const out = {};
  for (const d of L(plan, "debts")) {
    if (typeof d?.id !== "string" || typeof d.escrowMonthly === "number") continue;
    const g = guessAt(plan, `debts[${d.id}].minPayment`);
    if (!g || g.legacy) continue;
    const a = L(plan, "accounts").find((x) => x?.id === d.accountId);
    const esc = loanEscrow(plan, a, d, today);
    if (esc > 0) out[d.id] = { pay: Number(d.minPayment), escrow: esc };
  }
  return out;
}
/**
 * After "Keep" on Our guesses, or the same figure typed (Debts, Get started): a guessed mortgage payment that is now the person's
 * keeps the tax and insurance it held, written to `debts[].escrowMonthly` as our guess (ESCROW_KEY), so the payoff does not jump
 * (bought verify defect 2: a couple aged 25 went from June 2054 to August 2043 with every figure on screen unchanged). A payment
 * typed at another figure is left to the question "Does this payment include property tax and home insurance?" (answerEscrow).
 * `held`: escrowBefore of the plan before the save. Changes `draft` in place. -> true when it wrote
 */
export function escrowKept(draft, held, today) {
  let wrote = false;
  for (const [id, h] of Object.entries(held ?? {})) {
    const d = L(draft, "debts").find((x) => x?.id === id);
    if (!d || typeof d.escrowMonthly === "number" || isGuess(draft, `debts[${id}].minPayment`)) continue;
    if (Math.abs(Number(d.minPayment) - h.pay) > 0.005) continue;
    wrote = markEscrow(draft, d, h.escrow, today) || wrote;
  }
  return wrote;
}
/**
 * The answer to "Does this payment include property tax and home insurance?" for one mortgage (Debts' form, Get started's
 * mortgage step): "yes" (the usual case: an escrow account; `amount` typed, else our guess of it), "no" (paid apart: 0), "unsure"
 * (our guess of the usual, as most payments hold them: SCF 2025, 56% of mortgage payers), or null (no answer: nothing is written,
 * so a balance and payment both typed stay as typed). The answer is also kept in Get started's tap `escrow` (the housing row of the
 * spending question counts the tax and insurance when they are paid apart). Changes `draft` in place.
 */
export function answerEscrow(draft, debtId, said, amount, today) {
  if (!["yes", "no", "unsure"].includes(said)) return false;
  const d = L(draft, "debts").find((x) => x?.id === debtId);
  if (!d) return false;
  const path = `debts[${debtId}].escrowMonthly`;
  draft.guide = draft.guide && typeof draft.guide === "object" ? draft.guide : {};
  draft.guide.setup = draft.guide.setup && typeof draft.guide.setup === "object" ? draft.guide.setup : {};
  draft.guide.setup.taps = { ...(draft.guide.setup.taps ?? {}), escrow: said };
  if (said === "no") { clearGuess(draft, path); d.escrowMonthly = 0; return true; }
  if (said === "yes" && Number(amount) > 0) { clearGuess(draft, path); d.escrowMonthly = cents(Number(amount)); return true; }
  // our guess of the usual tax and insurance (the payment's own figure decides the cap: never more than half of it)
  const a = L(draft, "accounts").find((x) => x?.id === d.accountId);
  const { escrowMonthly: _drop, ...bare } = d;
  const v = usualEscrowIn(draft, a, bare, today, PLAIN);
  if (v > 0) return markEscrow(draft, d, v, today);
  clearGuess(draft, path); delete d.escrowMonthly;
  return true;
}
/** The answer as a page shows it, for one mortgage: "yes" | "no" | "unsure" | null (not answered). */
export function escrowSaid(plan, debt) {
  const v = debt?.escrowMonthly;
  if (typeof v !== "number") return null;
  if (v === 0) return "no";
  // our figure: "yes" or "unsure" as answered; kept from a guessed payment ("Keep") with no answer: not answered
  if (typeof debt.id === "string" && isGuess(plan, `debts[${debt.id}].escrowMonthly`)) { const t = plan?.guide?.setup?.taps?.escrow; return t === "yes" || t === "unsure" ? t : null; }
  return "yes";
}

/**
 * The tax and insurance inside a mortgage's payment as two parts, for the Home page's year of costs (2026-11-07, HD-ESCROW-ONCE:
 * it left them out when nothing was typed there): loanEscrow's figure, split as the usual tax and insurance split (escrowMonthly,
 * which reads a tax or insurance typed on Home first). -> { tax, insurance, total } a month (tax and insurance null when there is
 * no split to go by: one line then) | null (nothing inside the payment)
 */
export function escrowParts(plan, account, debt, today) {
  const total = loanEscrow(plan, account, debt, today);
  if (!(total > 0)) return null;
  let e = null;
  try { e = escrowMonthly(plan, { today, loanId: account.id }, PLAIN); } catch { e = null; }
  if (!e || !(e.total > 0)) return { tax: null, insurance: null, total };
  return { tax: total * e.tax / e.total, insurance: total * e.insurance / e.total, total };
}

export const estimators = {
  // the tax and insurance inside a mortgage payment that is our guess (answered "Not sure" or "Yes" with no figure, or kept from a
  // guessed payment): the usual figure for the home's value and state, at most half the payment (usualEscrowIn)
  [ESCROW_KEY]: {
    tier: 2, order: 7, label: "Property tax and home insurance in your mortgage payment", unit: "month", weight: "small", page: () => "#/balance/liabilities",
    reads: ["home.value", "home.propertyTax", "home.insurance"],
    fn(plan, { today, path }, lib) {
      const m = path ? /^debts\[([^\]]+)\]\./.exec(path) : null;
      const d = m ? L(plan, "debts").find((x) => x?.id === m[1]) : null;
      const a = d ? L(plan, "accounts").find((x) => x?.id === d.accountId) : null;
      if (!d || !a || a.type !== "mortgage") return null;
      const st = lib.memo("profile", () => profileOf(plan, today)).state;
      const { escrowMonthly: _drop, ...bare } = d;
      const value = cents(usualEscrowIn(plan, a, bare, today, lib));
      return {
        // to the cent (not R11's rounding): the pages take exactly this out of the payment, and a kept payment's figure must not move
        value, rounded: true, sigma: null, measured: false,
        why: fit(`the usual property tax and home insurance for a home like yours${st ? ` in ${STATE_NAME[st]}` : ""}`, "the usual property tax and home insurance for a home like yours"),
        uses: { state: st ? "typed" : null }, sharperWith: [], tables: [PTAX, HO3, VALUE],
      };
    },
  },
  "home.boughtYear": {
    tier: 1, order: 1, label: "The year you bought your home", unit: "year-date", weight: "big", page: HOME_PAGE, reads: [],
    fn(plan, { today }, lib) {
      const prof = lib.memo("profile", () => profileOf(plan, today));
      const g = boughtGuess({ age: prof.age, today });
      if (!g) return null;
      const when = g.tenure < 1.5 ? "Most owners your age bought in the last year or two." : g.tenure < 5 ? "Most owners your age bought in the last few years." : g.tenure < 10 ? "Most owners your age bought in the last ten years or so." : g.tenure < 20 ? "Most owners your age bought ten to twenty years ago." : "Most owners your age have been in their home for twenty years or more.";
      return {
        value: g.year, sigma: null, measured: false, why: prof.age !== null ? when : "Half of all owners have lived in their home 13 years or less.",
        uses: { age: prof.age !== null ? "typed" : null }, sharperWith: [], tables: [PT.moved, PT.owners],
      };
    },
  },
  "home.value": {
    tier: 2, order: 1, label: "What your home would sell for", unit: "total", weight: "big", page: NET_WORTH, reads: [],
    fn(plan, { today, path, args }, lib) {
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
      // owners' homes run from about 1.3 to 7 times their income at under 35 (SCF 2025, cells.js): two published medians
      // multiplied gave a $20,000 earner a $210,000 home (10.5 times; guess-sanity HD-HOME-VALUE-INCOME). Held to the age
      // group's 5th..95th percentile of value over income. A mortgage balance the person typed puts a floor under it: the
      // home is worth at least the balance over the age group's 75th-percentile loan-to-value (HD-MORT-UNDERWATER).
      // Not under $1,000 a year of income (the lowest point of the survey's income scale, incomePercentile): a ratio to almost
      // nothing bounds nothing, and a $1 pay held a couple's home to $13 (integration with the "bought" build, 2026-11-07).
      const lim = homeRatios(prof.age);
      let value = base * r.parts.rInc * r.parts.resid, bound = "";
      if (lim && prof.income >= 1000) { const hi = lim.p95 * prof.income, lo = lim.p5 * prof.income; if (value > hi) { value = sig2(hi, Math.floor); bound = "cap"; } else if (value < lo) { value = sig2(lo, Math.ceil); bound = "floor"; } }
      const owed = typedMortgageOwed(plan, args);
      if (lim && owed > 0 && value < owed / lim.ltv75) { value = owed / lim.ltv75; bound = "owed"; }
      return {
        value, sigma: r.sigma, measured: r.sigma !== null,
        why: fit(`typical for ${placeOf(st)} home${words}${on}`, `typical for ${placeOf(st)} home${on}`),
        uses: { state: st ? "typed" : null, pay: prof.payHow, age: prof.age !== null ? "typed" : null },
        sharperWith: [...(st ? [] : [YOUR_STATE]), ...(prof.income ? [] : [YOUR_PAY]), COST_AND_WHEN].slice(0, 2),
        tables: [VALUE, ...SCF_TABLES, ...(bound ? HOME_RATIO_TABLES : [])],
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
    tier: 2, order: 3, label: "Home insurance a year", unit: "year", weight: "small", page: HOME_PAGE, reads: ["home.value"],
    fn(plan, { today, path, args }, lib) {
      const st = lib.memo("profile", () => profileOf(plan, today)).state;
      let home = homeValueFor(plan, { path, args });
      if (!home) { const g = lib.estimate("home.value", { path: homePathOf(plan, path), args }); home = g ? { value: g.value, typed: false } : null; }
      const yearIns = insuranceYear(st, home?.value ?? null);
      if (!ok(yearIns)) return null;
      return {
        value: yearIns, sigma: null, measured: false,
        why: fit(`typical home insurance for a home like yours${st ? ` in ${STATE_NAME[st]}` : ""}`, "typical home insurance for a home like yours"),
        uses: { state: st ? "typed" : null, value: home ? (home.typed ? "typed" : "guess") : null }, sharperWith: st ? [] : [YOUR_STATE], tables: [HO3, VALUE],
      };
    },
  },
};

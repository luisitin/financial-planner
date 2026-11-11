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
import { profileOf, incomeGuessWords, scfR2, homeRatios, homeCellValue, HOME_RATIO_TABLES, cpiSince, placeOf, placeName, fit, ok, has, SCF_TABLES, YOUR_STATE, YOUR_PAY } from "./common.js";
import { isGuess, guessAt, markGuess, clearGuess } from "../../../../core/estimate/index.js";
import { boughtGuess, yearOf, TABLE as PT } from "./purchase.js";
import { homeOfLoan, homeEntryFor } from "./loanhome.js";
import { pmt } from "../../../../core/math/finance.js";
export { homeOfLoan, homeEntryFor };

const VALUE = "acs2025_median_home_value_by_state_and_mortgage_status", HPI = "fhfa_hpi_at_state_annual";
/** home.value: how far over the top of the range (1.25 times) the formula runs before the survey cell's figure stands alone (ssg-B-4). */
export const CELL_BLEND = 1.25;
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

/** What owners of cheap homes pay a year for home insurance, as a share of the value: the weighted median of INSURAMT x 12 over
 *  MARKETVAL among owners (TENURE 1) of homes worth under $30,000 who pay a premium (Census American Housing Survey 2023
 *  national PUF v1.1, household.csv, WEIGHT; 314 homes; computed 2026-11-07, follow-up lane 2). A policy costs more of a
 *  cheap home's value than of a dear one's: the 1.61% the sanity check holds to is the 95th percentile over all owners,
 *  and owners of homes under $30,000 pay more than that three times in four (25th percentile 1.68%). */
export const INSURANCE_SHARE_CHEAP = 0.0255;
/** The least a year's home insurance is guessed at ($350), never more than INSURANCE_SHARE_CHEAP of the home's value. */
export const INSURANCE_FLOOR = 350;
/**
 * Home insurance a year for a home worth `value`: the state's average HO-3 premium in 2025 prices (NAIC 2023 x CPI) for the
 * state's typical owner-occupied home (ACS 2025 median value), scaled by this home's value against that one, never under $350
 * (a policy has a floor whatever the house), and that floor never above what owners of homes under $30,000 pay of the value,
 * 2.55% (INSURANCE_SHARE_CHEAP, AHS 2023: a $10,000 home is guessed at $255, not $350; from $13,700 the $350 stands, under
 * the $600 a year owners of $15,000 to $30,000 homes pay in the middle; follow-up lane 2, 2026-11-07). Insurers price on the
 * cost to rebuild, so the premium follows the home's value; a flat state average gave a $64,000 home $2,150 (guess-sanity
 * HD-HOMEINS, 2026-11-07). No value: the state average.
 */
export function insuranceYear(st, value) {
  const prem = premiumOf(st);
  if (!ok(prem)) return null;
  const avg = prem * cpiSince(2023), typical = col(HOME[VALUE], "all owners", st ?? "US");
  return ok(value) && value > 0 && ok(typical) && typical > 0 ? Math.max(Math.min(INSURANCE_FLOOR, INSURANCE_SHARE_CHEAP * value), avg * value / typical) : avg;
}
/** The state's home prices against the nation's: the ACS 2025 median value of owner-occupied homes, the state's over the U.S.'s (1 with no state). */
export const statePriceLevel = (st) => { const s = col(HOME[VALUE], "all owners", st ?? "US"), us = col(HOME[VALUE], "all owners", "US"); return ok(s) && ok(us) && us > 0 ? s / us : 1; };
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
/** Get started's own mortgage (its account and its details row): the only loan the plan-wide tap `escrow` speaks for. */
const SETUP_LOAN = "setup-owe-mortgage", SETUP_ROW = "setup-debt-mortgage";
const isSetupLoan = (account, debt) => account?.id === SETUP_LOAN || debt?.id === SETUP_ROW;
/**
 * The person said this mortgage's tax and insurance are paid apart: the answer on the loan itself (`debts[].escrowSaid`), else,
 * for Get started's own mortgage only, the tap `escrow` (fix round 1, 2026-11-11: the tap was read for every mortgage, so "No" on a
 * cabin's loan took the tax and insurance out of the home's payment).
 */
const saidApart = (plan, account, debt) => debt?.escrowSaid === "no" || (debt?.escrowSaid === undefined && isSetupLoan(account, debt) && plan?.guide?.setup?.taps?.escrow === "no");
/**
 * The most a GUESSED tax and insurance can be inside a payment: what is left of the payment after the level payment that pays the
 * balance off over a new 30-year loan (core/math/finance.js pmt over 360 months); 0 when the payment is under that. So a figure of
 * ours never makes a loan run longer than 30 years (fix round 1, 2026-11-11: the only guard was "more than the month's interest",
 * and a figure just under it stretched typed loans to 40 to 90 years, with a cliff to 0 beside it where more debt gave an earlier
 * payoff). A figure the person typed is never cut by this. (Not the loan's own term left: a start typed on Debts can be an older
 * loan's, debts.js loanTyped, and 30 years bounds every loan.)
 */
export function escrowCap(account, debt) {
  const pay = Number(debt?.minPayment), owed = Math.abs(Number(account?.balance) || 0);
  if (!(pay > 0)) return 0;
  if (!(owed > 0)) return pay / 2;
  return Math.max(0, pay - pmt((Number(debt.rate) || 0) / 12, 360, owed));
}
/**
 * The tax and insurance inside a mortgage's monthly payment, for the pages that turn the payment into years left (Debts,
 * Mortgage, Pay off debts, Timeline, Your plan). In order:
 *   - `debts[].escrowMonthly` the person typed: that figure, never more than the payment (fix round 1, 2026-11-11: it was cut to
 *     half the payment without a word; Debts says so when what is left does not cover the interest);
 *   - `debts[].escrowMonthly` that is our guess (answered "Not sure" or "Yes" with no figure, or kept from a guessed payment): that
 *     figure, never more than half the payment or escrowCap;
 *   - the person said they are paid apart (saidApart): 0;
 *   - a payment or a balance that is still our guess: the usual figure for the home (usualEscrowIn), 0 when it cannot be worked
 *     out; a payment our older Get started guessed (only the `paymentGuessed` flag, no ledger entry) is the loan's level payment
 *     alone (typicalPayment: pmt over 30 years, no tax or insurance), so nothing comes out of it;
 *   - the payment and the balance both the person's own and no answer: 0 (read as typed, nothing moves).
 * -> a number >= 0
 */
export function loanEscrow(plan, account, debt, today) {
  const pay = Number(debt?.minPayment);
  if (!account || account.type !== "mortgage" || !(pay > 0)) return 0;
  if (typeof debt.escrowMonthly === "number" && debt.escrowMonthly >= 0) {
    const ours = typeof debt.id === "string" && isGuess(plan, `debts[${debt.id}].escrowMonthly`);
    return ours ? Math.min(debt.escrowMonthly, pay / 2, escrowCap(account, debt)) : Math.min(debt.escrowMonthly, pay);
  }
  if (saidApart(plan, account, debt)) return 0;
  const payGuess = typeof debt.id === "string" ? guessAt(plan, `debts[${debt.id}].minPayment`) : null;
  if (payGuess?.legacy) return 0;
  const guessed = payGuess !== null || isGuess(plan, `accounts[${account.id}].balance`);
  if (!guessed) return 0;
  return usualEscrowIn(plan, account, debt, today, PLAIN) ?? 0;
}
/**
 * The usual tax and insurance a month inside this mortgage's payment (escrowMonthly, by the home's value and state), never more
 * than half the payment or escrowCap (what the payment can hold and still pay the loan off in 30 years). `lib`: PLAIN for the
 * pages (the home's value on file), an estimator's own lib for the guess. -> a number >= 0 | null (no home to work it out from)
 */
function usualEscrowIn(plan, account, debt, today, lib) {
  const pay = Number(debt?.minPayment);
  if (!account || !(pay > 0)) return null;
  let esc = null;
  try { esc = escrowMonthly(plan, { today, loanId: account.id }, lib); } catch { esc = null; }
  if (!esc) return null;
  return Math.max(0, Math.min(esc.total, pay / 2, escrowCap(account, debt)));
}
/**
 * What goes on after a mortgage on the home is paid off, a month: its property tax and home insurance. The figure inside the
 * payment (loanEscrow) when there is one; else, for a payment read as all loan because nobody said (a balance and payment typed
 * and the question never answered, or a figure of ours the payment has no room for), the usual figure for the home (escrowMonthly,
 * at most half the payment), unless the person said they pay them apart or Expenses already holds a property tax or home
 * insurance bill (`billed`). Only the retirement figure reads this (Get started's and Will the money last?): Debts and the payoff
 * date never do, so a typed plan's payoff does not move (fix round 1, 2026-11-11, money review D8: a typed mortgage's whole
 * payment left retirement spending at payoff, and with it the only property tax in 642 of the 1,400 qa plans).
 * -> { monthly, assumed: true when it is the usual figure and not one inside the payment, topped?: true when it is the usual figure
 *      because ours inside the payment was cut to what the payment has room for, taxOnly?: true when only the property tax is kept
 *      because an insurance bill on Expenses may hold the home insurance (insuranceMaybeBilled) }
 */
export function escrowAfterLoan(plan, account, debt, today, { billed = false } = {}) {
  const inside = loanEscrow(plan, account, debt, today);
  const pay = Number(debt?.minPayment);
  if (inside > 0) {
    // a figure of ours that escrowCap cut to what the payment has room for: the home's tax and insurance do not shrink because more
    // is owed, so after the payoff the usual figure goes on (`topped`), as it does for a payment with room for none (fix round 2,
    // 2026-11-11: "Not sure" on $1,200 a month kept $395 for life at $150,000 owed and $126 at $200,000, so more debt gave a
    // better verdict). Not when Expenses holds such a bill, and never for a figure the person typed.
    const ours = typeof debt.escrowMonthly === "number" ? typeof debt.id === "string" && isGuess(plan, `debts[${debt.id}].escrowMonthly`) : true;
    if (ours && !billed && escrowCap(account, debt) <= inside + 0.005 && !L(plan, "property").some((e) => e?.kind === "rental" && e.loanAccountId === account.id)) {
      let esc = null;
      try { esc = escrowMonthly(plan, { today, loanId: account.id }, PLAIN); } catch { esc = null; }
      const taxOnly = !!esc && insuranceMaybeBilled(plan);
      const usual = esc ? Math.min(taxOnly ? esc.tax : esc.total, pay / 2) : 0;
      if (usual > inside + 0.005) return { monthly: usual, assumed: false, topped: true, ...(taxOnly ? { taxOnly: true } : {}) };
    }
    return { monthly: inside, assumed: false };
  }
  if (billed || !account || account.type !== "mortgage" || !(pay > 0)) return { monthly: 0, assumed: false };
  // a rental's loan: its tax and insurance are the rental's running costs (Rental analysis), never assumed into the payment
  if (L(plan, "property").some((e) => e?.kind === "rental" && e.loanAccountId === account.id)) return { monthly: 0, assumed: false };
  if (saidApart(plan, account, debt) || (typeof debt.escrowMonthly === "number" && !(typeof debt.id === "string" && isGuess(plan, `debts[${debt.id}].escrowMonthly`)))) return { monthly: 0, assumed: false };
  let esc = null;
  try { esc = escrowMonthly(plan, { today, loanId: account.id }, PLAIN); } catch { esc = null; }
  if (!esc || !(esc.total > 0)) return { monthly: 0, assumed: false };
  // an insurance bill of the person's own on Expenses that names no other kind of cover may already hold the home's: only the
  // property tax is kept then (`taxOnly`), and the page says the insurance was left to that bill (fix round 2, 2026-11-11)
  if (insuranceMaybeBilled(plan)) return esc.tax > 0 ? { monthly: Math.min(esc.tax, pay / 2), assumed: true, taxOnly: true } : { monthly: 0, assumed: false };
  return { monthly: Math.min(esc.total, pay / 2), assumed: true };
}
/** Expenses holds a property tax or home insurance bill of the person's own (by its name): the tax and insurance are counted there. */
export const taxOrInsuranceBilled = (plan) => L(plan, "expenses").some((x) => typeof x?.name === "string" && /property tax|real estate tax|home ?owner'?s? insurance|home insurance|house insurance|hazard insurance/i.test(x.name) && Number(x.amount) > 0);

/** Words in an insurance bill's name that say it is another kind of cover, not the home's. */
const OTHER_COVER = /health|medical|medicare|medigap|dental|vision|drug|prescription|car\b|cars\b|auto|vehicle|truck|motor|life|term\b|renter|pet\b|umbrella|disab|long[- ]term|ltc|travel|boat|phone|device|flood|earthquake/i;
/**
 * Expenses holds an insurance bill of the person's own that may be the home's: in the Insurance category, not one of Get
 * started's rows ("Insurance and health" is our guess of health, car and life cover: setup's SPEND rows), and its name names no
 * other kind of cover (OTHER_COVER). A bill just called "Insurance" is the usual case (634 of the 1,400 qa plans have one).
 */
export const insuranceMaybeBilled = (plan) => L(plan, "expenses").some((x) => x?.category === "insurance" && Number(x.amount) > 0 && !(typeof x.id === "string" && x.id.startsWith("setup-x-")) && !OTHER_COVER.test(String(x.name ?? "")));

// ---- the tax and insurance inside a mortgage payment, once the person's (2026-11-07, lane 1: items 2 and 3)
/** The guess key for `debts[<id>].escrowMonthly`: the usual tax and insurance inside the payment. */
export const ESCROW_KEY = "debt.mortgage.escrow";
const cents = (x) => Math.round(x * 100) / 100;
const escrowEst = (value) => ({ key: ESCROW_KEY, value: cents(value), unit: "month", sigma: null, dataAsOf: null });
/** Write our figure for a debt's tax and insurance (the field first: a guess is only ever written into a field that is there). */
const markEscrow = (draft, d, value, today) => { d.escrowMonthly = cents(value); markGuess(draft, `debts[${d.id}].escrowMonthly`, escrowEst(value), today); return true; };
/** A mortgage's payment or balance is still our guess (its tax and insurance are then read live, loanEscrow). */
const stillGuessed = (plan, account, debt) => (typeof debt?.id === "string" && isGuess(plan, `debts[${debt.id}].minPayment`)) || (!!account && isGuess(plan, `accounts[${account.id}].balance`));
/**
 * What each mortgage payment read with a tax and insurance of ours holds, before a save that may make the loan's figures the
 * person's: { [debtId]: { pay, escrow } } for every mortgage with no `escrowMonthly` whose payment is read with them inside
 * (loanEscrow > 0: the payment or the balance is our guess in the ledger, not the older flag). Fix round 1 (2026-11-11): a payment
 * typed beside a balance of ours is held too (keeping that balance dropped the tax and insurance: 448 of 448 households moved).
 */
export function escrowBefore(plan, today) {
  const out = {};
  for (const d of L(plan, "debts")) {
    if (typeof d?.id !== "string" || typeof d.escrowMonthly === "number") continue;
    const a = L(plan, "accounts").find((x) => x?.id === d.accountId);
    const esc = loanEscrow(plan, a, d, today);
    if (!(esc > 0)) continue;
    // a payment still ours is worked out around the home's usual figure (escrowFor), which the pages then hold to what it has room
    // for: kept with the balance alone, it is that usual figure that is kept, so the payment rebuilt from it is the same (fix round 2)
    let usual = null;
    if (typeof d.id === "string" && isGuess(plan, `debts[${d.id}].minPayment`)) { try { usual = escrowMonthly(plan, { today, loanId: a.id }, PLAIN)?.total ?? null; } catch { usual = null; } }
    out[d.id] = { pay: Number(d.minPayment), escrow: esc, ...(usual > 0 ? { usual } : {}) };
  }
  return out;
}
/**
 * After "Keep" on Our guesses, or the same figure typed (Debts, Get started): a mortgage whose payment and balance are now both
 * the person's, with the payment unchanged, keeps the tax and insurance that payment was read with, written to
 * `debts[].escrowMonthly` as our guess (ESCROW_KEY), so the payoff does not jump (bought verify defect 2: a couple aged 25 went
 * from June 2054 to August 2043 with every figure on screen unchanged). A payment typed at another figure is left to the question
 * "Does this payment include property tax and home insurance?" (answerEscrow). A balance kept while the payment is still ours
 * keeps it too (fix round 2, 2026-11-11: the home's value takes a typed balance as a floor, which moved the payment we show).
 * `held`: escrowBefore of the plan before the save. Changes `draft` in place. -> true when it wrote
 */
export function escrowKept(draft, held, today) {
  let wrote = false;
  for (const [id, h] of Object.entries(held ?? {})) {
    const d = L(draft, "debts").find((x) => x?.id === id);
    if (!d || typeof d.escrowMonthly === "number") continue;
    const a = L(draft, "accounts").find((x) => x?.id === d.accountId);
    if (!a || saidApart(draft, a, d)) continue;
    // the balance kept while the payment is still ours: the home's guessed value takes the typed balance as a floor
    // (HD-MORT-UNDERWATER), which moved the tax and insurance and so the payment we show ($2,280 -> $2,340 for a couple of 35 in
    // Texas). The figure the payment was read with is kept with the balance too (fix round 2, 2026-11-11, final check F-3)
    const balKept = !isGuess(draft, `accounts[${a.id}].balance`);
    if (stillGuessed(draft, a, d) && !balKept) continue;
    if (Math.abs(Number(d.minPayment) - h.pay) > 0.005) continue;
    const payOurs = typeof d.id === "string" && isGuess(draft, `debts[${d.id}].minPayment`);
    wrote = markEscrow(draft, d, payOurs && h.usual > 0 ? h.usual : h.escrow, today) || wrote;
  }
  return wrote;
}
/**
 * The answer to "Does this payment include property tax and home insurance?" for one mortgage (Debts' form, Get started's
 * mortgage step): "yes" (the usual case: an escrow account; `amount` typed, else our guess of it), "no" (paid apart: 0), "unsure"
 * (our guess of the usual, as most payments hold them: SCF 2025, 55.8% of mortgage payers), or null (no answer: nothing is written,
 * so a balance and payment both typed stay as typed). The answer is kept on the loan (`debts[].escrowSaid`); for Get started's own
 * mortgage it is also kept in the tap `escrow` (the housing row of the spending question counts the tax and insurance when they
 * are paid apart), never for another mortgage (fix round 1, 2026-11-11). Changes `draft` in place.
 * -> false (nothing done) | "no" | "typed" (the person's figure; `capped` when it was above the payment and the payment was written)
 *    | "ours" (our figure, at most what the payment can hold: usualEscrowIn) | "ask" (the answer is kept, but no usual figure can
 *    be worked out, as the loan has no home on file: the page asks for the figure)
 */
export function answerEscrow(draft, debtId, said, amount, today) {
  if (!["yes", "no", "unsure"].includes(said)) return false;
  const d = L(draft, "debts").find((x) => x?.id === debtId);
  if (!d) return false;
  const path = `debts[${debtId}].escrowMonthly`;
  const a = L(draft, "accounts").find((x) => x?.id === d.accountId);
  d.escrowSaid = said;
  if (isSetupLoan(a, d)) {
    draft.guide = draft.guide && typeof draft.guide === "object" ? draft.guide : {};
    draft.guide.setup = draft.guide.setup && typeof draft.guide.setup === "object" ? draft.guide.setup : {};
    draft.guide.setup.taps = { ...(draft.guide.setup.taps ?? {}), escrow: said };
  }
  if (said === "no") { clearGuess(draft, path); d.escrowMonthly = 0; return "no"; }
  const pay = Number(d.minPayment);
  if (said === "yes" && Number(amount) > 0) { clearGuess(draft, path); d.escrowMonthly = cents(pay > 0 ? Math.min(Number(amount), pay) : Number(amount)); return "typed"; }
  // our guess of the usual tax and insurance, at most what the payment can hold (usualEscrowIn)
  const { escrowMonthly: _drop, ...bare } = d;
  const v = usualEscrowIn(draft, a, bare, today, PLAIN);
  if (v !== null) { markEscrow(draft, d, v, today); return "ours"; }
  clearGuess(draft, path); delete d.escrowMonthly;
  return "ask";
}
/** The answer as a page shows it, for one mortgage: "yes" | "no" | "unsure" | null (not answered). */
export function escrowSaid(plan, debt) {
  if (["yes", "no", "unsure"].includes(debt?.escrowSaid)) return debt.escrowSaid;
  const v = debt?.escrowMonthly;
  if (typeof v !== "number") return null;
  if (v === 0) return "no";
  // our figure kept from a guessed payment ("Keep") with no answer: not answered
  if (typeof debt.id === "string" && isGuess(plan, `debts[${debt.id}].escrowMonthly`)) return null;
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

/** The person typed something about the home a loan is on: its value, or a property tax or insurance on Home. */
export function homeFactsTyped(plan, loanId) {
  const hv = homeValueFor(plan, { loanId });
  if (hv?.typed) return true;
  const h = homeOfLoan(plan, loanId), e = h?.entry;
  return !!e && typeof e.id === "string" && ["propertyTax", "insurance"].some((k) => Number(e[k]) > 0 && !isGuess(plan, `property[${e.id}].${k}`));
}
/** The usual property tax and home insurance a month for the home a loan is on (escrowMonthly on the plan's own figures): { tax, insurance, total } | null. */
export function usualParts(plan, loanId, today) {
  let e = null;
  try { e = escrowMonthly(plan, { today, loanId }, PLAIN); } catch { e = null; }
  return e && e.total > 0 ? { tax: e.tax, insurance: e.insurance, total: e.total } : null;
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
      // a figure kept from a payment the person agreed to ("Keep", or the same figure typed) with no answer is frozen: it is the
      // one that payment was read with, and a home value typed later must not move the payoff (fix round 1, 2026-11-11: 2054 ->
      // 2077). One answered "Not sure" or "Yes" with no figure follows the home, inside what the payment can hold.
      const { escrowMonthly: _drop, ...bare } = d;
      const answered = d.escrowSaid === "yes" || d.escrowSaid === "unsure";
      // a figure kept with a balance while the payment is still ours (escrowKept, fix round 2) follows what the person types about
      // the home (its value, tax or insurance), as the payment we show did; only our own guessed home value is held still
      const follows = !answered && isGuess(plan, `debts[${d.id}].minPayment`) && homeFactsTyped(plan, a.id);
      let fresh = answered ? usualEscrowIn(plan, a, bare, today, lib) : null;
      // (not held to what today's payment has room for: that payment is ours and is worked out around this figure)
      if (follows) { try { fresh = escrowMonthly(plan, { today, loanId: a.id }, lib)?.total ?? null; } catch { fresh = null; } }
      const value = cents(fresh ?? (typeof d.escrowMonthly === "number" ? d.escrowMonthly : 0));
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
      const on = prof.income ? (prof.payHow === "guess" ? `, on ${incomeGuessWords(prof)}` : ", on your income") : "";
      // owners' homes run from about 1.3 to 7 times their income at under 35 (SCF 2025, cells.js): two published medians
      // multiplied gave a $20,000 earner a $210,000 home (10.5 times; guess-sanity HD-HOME-VALUE-INCOME). Held to the age
      // group's 5th..95th percentile of value over income. A mortgage balance the person typed puts a floor under it: the
      // home is worth at least the balance over the age group's 75th-percentile loan-to-value (HD-MORT-UNDERWATER).
      // Not under $1,000 a year of income (the lowest point of the survey's income scale, incomePercentile): a ratio to almost
      // nothing bounds nothing, and a $1 pay held a couple's home to $13 (integration with the "bought" build, 2026-11-07).
      // Over the top of that range the formula is no figure to believe, and the top is not the likeliest one either (a $20,000
      // earner of 20 in New York was held at $140,000, 7 times pay): there the guess is the most likely value for the
      // household, the survey's age x income cell (homeCellValue: the cell's median value over income) at the state's prices
      // (ACS: the state's median home value over the nation's), and the range only guards that (2026-11-07, follow-up lane 2).
      // Where the formula's figure is inside the range it stands (the middle of it is what the answer keys hold). Under the
      // bottom it stays held at the bottom: there the formula's figure runs along the 5th percentile for higher pay (1.19 to
      // 1.22 times pay from $230,000 to $300,000 at 45 in Mississippi), so swapping in the cell's figure each time it dips
      // under would make the guess fall a sixth and rise again as pay goes up $5,000 at a time.
      const lim = homeRatios(prof.age);
      let value = base * r.parts.rInc * r.parts.resid, bound = "";
      if (lim && prof.income >= 1000) {
        const hi = lim.p95 * prof.income, lo = lim.p5 * prof.income;
        // the cell takes over gradually (fixer round 1, 2026-11-11, finding ssg-B-4): from the top of the range where the formula
        // just reaches it, to the cell's own figure once the formula is a quarter over it (CELL_BLEND), on a log scale;
        // switching at the top made an Ohio home at 24 go from $73,000 at $13,000 pay to $96,000 at $14,000 (x1.32)
        if (value > hi) {
          const cell = homeCellValue({ age: prof.age, income: prof.income });
          if (ok(cell)) { const w = Math.min(1, Math.log(value / hi) / Math.log(CELL_BLEND)); value = Math.exp((1 - w) * Math.log(hi) + w * Math.log(cell * statePriceLevel(st))); bound = "cell"; }
        }
        // (judged at two figures, the rounding the figure is saved at, so rounding never steps over the range)
        if (sig2(value, Math.round) > hi) { value = sig2(hi, Math.floor); bound = "cap"; } else if (sig2(value, Math.round) < lo) { value = sig2(lo, Math.ceil); bound = "floor"; }
      }
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

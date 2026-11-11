// modules/overview/guesses/estimators/purchase.js -- PURE. When the home was bought, and the mortgage worked from it.
// Formulas and sources: ../README.md "When the home was bought".
//
//   boughtGuess({ age, today })       the year an owner of this age most likely bought (home.boughtYear): how long owners of
//                                     the age have lived in their home (Census ACS B25128 by age group, truncated at the
//                                     years since the person was 20), the middle of that
//   loanStart(plan, ctx)              the start the mortgage is worked from: a refinance answered on Get started's tap, else
//                                     the year typed on the home (Home's purchase date or Get started's "Year you bought it"),
//                                     else our guess -> { date, year, via: "tap" | "typed" | "guess" }
//   loanFrom({ ... })                 the loan a purchase leaves today: price (typed, or today's value deflated by the FHFA
//                                     index), less the usual down payment (NAR, by age at purchase), at that year's average
//                                     30-year rate (Freddie Mac), paid for the months since: balance, rate, P&I, months left
import { T as HOME } from "../data/home.js";
import { T as PURCHASE } from "../data/purchase.js";
import { monthsBetween } from "../../../../core/math/dates.js";
import { pmt } from "../../../../core/math/finance.js";

const TERM30 = 360;
const ok = (x) => typeof x === "number" && Number.isFinite(x);
export const TABLE = { moved: "acs2025_year_moved_in_by_age_us", owners: "acs2025_owner_households_by_age_us", rate: "pmms30_annual_average_by_year", buyers: "nar2025_home_buyer_profile", hpi: "fhfa_hpi_at_state_annual", hpiUS: "fhfa_hpi_national_annual", newLoans: "mortgage_new_loans_fhfa_national_2025" };
/** The youngest age a home is assumed to be bought at when the person has not said (the owner's rule: about 20). */
export const YOUNGEST = 20;

// ---- how long owners have been in their home, by age (Census ACS B25128, owners only)
// The table's columns are move-in spans; their edges in years before the survey's interviews (ACS 2025 interviews run through
// 2025, so they fall mid-2025 on average: "2023 or later" is 2.5 years, "2020 to 2022" 5.5, "2010 to 2019" 15.5, and so on; review
// 2026-11-07, D9). The oldest span ("1989 or earlier") is taken to run 20 years further back (to 55.5 years), so the oldest
// owner's cap still falls inside it.
const EDGES = [0, 2.5, 5.5, 15.5, 25.5, 35.5, 55.5];
const GROUPS = [["owners:15 to 34", ["15 to 24", "25 to 34"]], ["owners:35 to 64", ["35 to 44", "45 to 54", "55 to 59", "60 to 64"]], ["owners:65 and over", ["65 to 74", "75 to 84", "85 and over"]]];
const BRACKET_AGE = { "15 to 24": 19.5, "25 to 34": 29.5, "35 to 44": 39.5, "45 to 54": 49.5, "55 to 59": 57, "60 to 64": 62, "65 to 74": 69.5, "75 to 84": 79.5, "85 and over": 87 };
const MOVED = () => HOME[TABLE.moved];
const OWNERS = () => PURCHASE[TABLE.owners];
/** Share of a group's owners who moved in within `t` years of the survey's end (straight lines inside each span). */
function share(counts, t) {
  const total = counts.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let i = 0; i < counts.length; i++) {
    const lo = EDGES[i], hi = EDGES[i + 1];
    if (t >= hi) { acc += counts[i]; continue; }
    if (t > lo) acc += counts[i] * (t - lo) / (hi - lo);
    break;
  }
  return acc / total;
}
/** The inverse of `share`: how many years back the p-th share of the group's owners moved in. */
function quantile(counts, p) {
  const total = counts.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let i = 0; i < counts.length; i++) {
    const next = acc + counts[i] / total;
    if (p <= next || i === counts.length - 1) return counts[i] > 0 ? EDGES[i] + (EDGES[i + 1] - EDGES[i]) * (p - acc) / (counts[i] / total) : EDGES[i];
    acc = next;
  }
  return EDGES[EDGES.length - 1];
}
/** [counts per span, the owners' mean age] of each age group, from the two Census tables. */
function groups() {
  const m = MOVED(), o = OWNERS();
  return GROUPS.map(([row, brackets]) => {
    const w = brackets.map((b) => o.rows.owners[o.cols.indexOf(b)]);
    const age = brackets.reduce((s, b, i) => s + BRACKET_AGE[b] * w[i], 0) / w.reduce((a, b) => a + b, 0);
    return { counts: m.rows[row], age };
  });
}
let GROUP_CACHE = null;
const G = () => (GROUP_CACHE ??= groups());
/** The mean age of each age group's owners (28.6, 50.3, 74.6), the points the groups are blended between. */
export const GROUP_AGES = () => G().map((g) => g.age);

/**
 * Years an owner of this age has most likely lived in the home: the middle (median) of the age group's move-in spans
 * once those who would have bought before the age of 20 are set aside (cap = age - 20 years), blended between the two
 * neighbouring groups by age. No age: the middle of all owners. -> years (a number)
 */
export function tenureMedian(age) { return tenureAt(age, 0.5); }
/** The same at any share p of the owners (0.25: a quarter have been in the home less than this; 0.75: three quarters). */
export function tenureAt(age, p) {
  const g = G();
  const at = (grp, cap) => quantile(grp.counts, p * share(grp.counts, cap));
  if (!ok(age)) { const all = g[0].counts.map((_, i) => g.reduce((s, x) => s + x.counts[i], 0)); return quantile(all, p); }
  const cap = Math.max(0.5, age - YOUNGEST);
  if (age <= g[0].age) return at(g[0], cap);
  if (age >= g[2].age) return at(g[2], cap);
  const [a, b] = age <= g[1].age ? [0, 1] : [1, 2];
  const w = (age - g[a].age) / (g[b].age - g[a].age);
  return (1 - w) * at(g[a], cap) + w * at(g[b], cap);
}

/** The decimal year of a date ("2026-11-07" -> 2026.85). */
const decimalYear = (iso) => { const y = Number(iso.slice(0, 4)), m = Number(iso.slice(5, 7)), d = Number(iso.slice(8, 10)); return y + ((m - 1) + (d - 1) / 31) / 12; };

/**
 * The year an owner of this age most likely bought: today less the usual years in the home, never before the age of 20.
 * -> { year, tenure } | null (no today)
 */
export function boughtGuess({ age = null, today } = {}) {
  if (!today) return null;
  const tenure = tenureMedian(age);
  const now = decimalYear(today);
  let year = Math.floor(now - tenure);
  if (ok(age)) year = Math.max(year, Math.floor(now) - Math.max(0, Math.floor(age) - YOUNGEST));
  return { year: Math.min(year, Number(today.slice(0, 4))), tenure };
}

// ---- the loan a purchase leaves
/** The average 30-year rate of a year (a fraction): the year's Freddie Mac figure, else the nearest year on file. */
export function rateInYear(year) {
  const t = PURCHASE[TABLE.rate], ys = t.cols.map(Number);
  const y = Math.min(Math.max(year, ys[0]), ys[ys.length - 1]);
  return t.rows["30-year fixed"][ys.indexOf(y)] / 100;
}
/** The mean of the yearly 30-year rates from `from` to `to` (a fraction), years outside the table taken at its ends. */
export function rateMean(from, to) {
  const lo = Math.min(from, to), hi = Math.max(from, to);
  let t = 0, n = 0;
  for (let y = lo; y <= hi; y++) { t += rateInYear(y); n++; }
  return n ? t / n : null;
}
/**
 * The 30-year rate to guess for a loan that began in a year we only guess (not typed, not a refinance answered): the mean of
 * the yearly rates over the middle half of the age's move-in years, eased toward `outstanding` (the average on mortgages people
 * already have, FHFA) the longer ago that is, since many of those owners refinanced in 2012 or 2020-21 and a rate from the
 * year of purchase would claim a 70-year-old pays 6.4%. The weight on the purchase years is 1 up to 2 years in the home and
 * falls 0.07 a year after, to 0.3 (README "When the home was bought": a judgment, not a measured figure; a year the person
 * TYPES keeps its own year's rate). -> a fraction
 */
export function guessedRate({ age = null, today, outstanding = null } = {}) {
  const now = decimalYear(today), t25 = tenureAt(age, 0.25), t75 = tenureAt(age, 0.75), mid = tenureAt(age, 0.5);
  const bought = rateMean(Math.floor(now - t75), Math.floor(now - t25));
  if (!ok(outstanding)) return bought;
  const w = Math.min(1, Math.max(0.3, 1 - 0.07 * Math.max(0, mid - 2)));
  return w * bought + (1 - w) * outstanding;
}

/** The share of the price put down, by the buyer's age at purchase: 10% to 40 (NAR first-time buyers), 23% from 62 (repeat buyers), straight between. */
export function downShare(ageAtPurchase) {
  const t = PURCHASE[TABLE.buyers], first = t.rows["median down payment (% of price)"][0] / 100, repeat = t.rows["median down payment (% of price)"][1] / 100;
  const a0 = t.rows["median age (years)"][0], a1 = t.rows["median age (years)"][1];
  if (!ok(ageAtPurchase) || ageAtPurchase <= a0) return first;
  if (ageAtPurchase >= a1) return repeat;
  return first + (repeat - first) * (ageAtPurchase - a0) / (a1 - a0);
}
/** The FHFA all-transactions index in a year: the state's when there is one, else the nation's; years outside the table take the nearest. */
export function hpiIn(state, year) {
  const clamp = (keys) => Math.min(Math.max(year, keys[0]), keys[keys.length - 1]);
  const t = HOME[TABLE.hpi], col = state ? t.cols.indexOf(state) : -1;
  if (col > 0) {
    const keys = Object.keys(t.rows).map(Number).sort((a, b) => a - b);
    const v = t.rows[String(clamp(keys))]?.[col];
    if (ok(v) && v > 0) return v;
  }
  const n = PURCHASE[TABLE.hpiUS], keys = n.cols.map(Number);
  const v = n.rows.HPI[keys.indexOf(clamp(keys))];
  return ok(v) && v > 0 ? v : null;
}
/** What a home worth `valueNow` today cost in `year`: the value taken back with the price index. */
export function priceThen(valueNow, state, year, today) {
  const then = hpiIn(state, year), now = hpiIn(state, Number(today.slice(0, 4)));
  return ok(then) && ok(now) ? valueNow * Math.min(1, then / now) : null;
}

/**
 * The loan a purchase on `startDate` leaves today (spec: the standard 30-year loan; `term`, months, when the loan's own is typed). `price` is what was paid (typed), else
 * `valueNow` is taken back to the start with the price index. -> { balance, rate, pi (principal and interest a month),
 * monthsLeft, gone, price, loan, down (share), yearsOld } | null
 */
export function loanFrom({ startDate, today, valueNow = null, price = null, state = null, age = null, rate: rateOver = null, term: termOver = null } = {}) {
  const TERM = ok(termOver) && termOver >= 12 ? Math.round(termOver) : TERM30;   // the loan's own term when typed on Debts (2026-11-07)
  if (!startDate || !today) return null;
  const year = Number(startDate.slice(0, 4));
  const paid = ok(price) && price > 0 ? price : ok(valueNow) && valueNow > 0 ? priceThen(valueNow, state, year, today) : null;
  if (paid === null) return null;
  const gone = Math.min(Math.max(0, monthsBetween(startDate, today) ?? 0), TERM - 12);   // a 30-year loan is shown with its last year still to pay
  const yearsOld = gone / 12;
  const down = downShare(ok(age) ? age - yearsOld : null);
  const loan = paid * (1 - down), rate = ok(rateOver) && rateOver >= 0 ? rateOver : rateInYear(year), i = rate / 12;
  const pi = pmt(i, TERM, loan);
  const left = TERM - gone;
  // the balance after `gone` payments; never above the home's value, never negative
  let balance = i === 0 ? loan * (1 - gone / TERM) : loan * (Math.pow(1 + i, TERM) - Math.pow(1 + i, gone)) / (Math.pow(1 + i, TERM) - 1);
  if (ok(valueNow) && valueNow > 0) balance = Math.min(balance, valueNow);
  return { balance, rate, pi, monthsLeft: left, gone, price: paid, loan, down, yearsOld };
}

/** The start date a year stands for: the middle of the year, never after today. */
export const midYear = (year, today) => { const d = `${year}-07-01`; return d > today ? today : d; };
/** The year in a purchase date ("2024-03-15" -> 2024), or in a typed year (2024); null when it is neither. */
export function yearOf(v) {
  if (ok(v)) return v >= 1900 && v <= 2200 ? Math.round(v) : null;
  const m = /^(\d{4})/.exec(String(v ?? ""));
  return m ? Number(m[1]) : null;
}

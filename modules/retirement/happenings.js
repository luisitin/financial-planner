// modules/retirement/happenings.js -- PURE. Things that will happen, in the plan (gap design #1, 2026-11-13): selling the home
// or moving to a smaller one, working less or taking a break, work after retiring, money coming in once, a big cost once,
// spending that changes for some years, and money moved from one of the plan's accounts to another (gap list, next 60, item 26,
// 2026-11-15), each set on Will the money last? and kept in `retirement.happenings`; and the goals with a date, taken from
// savings when due (`retirement.countGoals`). Everything is in today's dollars.
//
// apply(plan, inputs) turns them into the hooks the engine already has (core/math/retirement.js header: `events`,
// `spendingChanges`, a contribution's `skipYears`, an income's `fromYear` / `untilYear`, a loan's `untilYear`; and `moves`, added
// for money moved between accounts), so every page
// that starts from the projection's buildInputs counts them with no edit of its own. With nothing set it hands back the very
// same inputs object: no figure anywhere moves (tests/happenings-invariance.test.mjs). Formulas and sources: projection README
// "Things that will happen". Every import here is a leaf: none leads back to the projection's compute.js, which reads this file
// at load (the Home page's own compute does, through the federal estimate: importing it made pages fail to load in the browser,
// in whichever order the files happened to arrive; tests/happenings-invariance.test.mjs keeps it so).
import { project } from "../../core/math/retirement.js";
import { amortization } from "../../core/math/finance.js";
import { monthsBetween } from "../../core/math/dates.js";
import { keepingLines, DEFAULTS as HOME, EXCLUSION } from "../property/home/keeping.js";
import { compute as computeMortgage } from "../debt/mortgage/compute.js";
import { homeEntryFor } from "../overview/guesses/estimators/loanhome.js";
import { countedBalance } from "../balance/net-worth/compute.js";
import { NameIn, nameIn, nameOf, verbFor } from "../../core/words.js";

/** The seven kinds, in the order the page offers them. */
export const KINDS = ["home", "less", "after", "in", "out", "spend", "move"];
/**
 * Money moved between accounts (kind "move"): the kind of money each account is to the engine, as the projection's own
 * BUCKET_OF has it (this file may not import the projection, which reads it: a test keeps the two equal); the accounts money
 * can come out of (not a Roth or a health savings account: the tax on taking money out of those depends on age and use, which
 * the engine does not follow; not a life policy's cash value), and the ones it can go into (money goes into a 401(k), IRA,
 * Roth or health savings account only as yearly saving, up to a limit: What you save for retirement).
 */
export const MOVE_BUCKET = Object.freeze({ checking: "cash", savings: "cash", cash: "cash", brokerage: "taxable", crypto: "taxable", "401k": "deferred", ira: "deferred", cash_value_life: "deferred", roth: "free", hsa: "free" });
export const MOVE_FROM = Object.freeze(["checking", "savings", "cash", "brokerage", "crypto", "401k", "ira"]);
export const MOVE_INTO = Object.freeze(["checking", "savings", "cash", "brokerage", "crypto"]);
/** The rate on the part of a home's gain over the tax-free amount: the middle long-term rate (IRC 1(h)(1)(C)); a stated simplification. */
export const GAIN_RATE = 0.15;
/** Yearly spending is never taken under this by a change (the engine multiplies: a level of $0 could not come back). */
export const SPEND_FLOOR = 1;
/** A slip of extra digits is refused at the box: far above any household this plan is for. */
export const AMOUNT_CEILING = 100000000, MONTHLY_CEILING = 1000000;

const dollars = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const capFirst = (t) => String(t).replace(/^./, (c) => c.toUpperCase());
const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const isYear = (v) => Number.isInteger(v) && v >= 1900 && v <= 2300;
/** Money to a round figure for a line: $100s under $10,000, else $1,000s (levers.js rounds an effect the same way). */
export const roundMoney = (n) => (Math.abs(n) >= 10000 ? Math.round(n / 1000) * 1000 : Math.round(n / 100) * 100);

/** The plan's happenings that are well formed enough to read: objects with an id and a kind we know. */
export function listOf(plan) {
  const xs = plan?.retirement?.happenings;
  return Array.isArray(xs) ? xs.filter((h) => h && typeof h === "object" && typeof h.id === "string" && h.id && KINDS.includes(h.kind)) : [];
}

/** clean(h) -> the record as it is saved: only the fields its kind uses, numbers as numbers, blanks left out. */
export function clean(h) {
  const out = { id: String(h.id), kind: h.kind, year: num(h.year) };
  const put = (k, v) => { if (v !== null && v !== undefined && v !== "") out[k] = v; };
  const name = String(h.name ?? "").trim().slice(0, 60);
  if (h.kind === "home") { put("buyFor", Math.max(0, num(h.buyFor) ?? 0)); if (num(h.rentMonthly) > 0 || (num(h.rentMonthly) === 0 && !(num(h.buyFor) > 0))) put("rentMonthly", num(h.rentMonthly)); put("sellCosts", num(h.sellCosts)); if (num(h.value) > 0) put("value", num(h.value)); }
  if (h.kind === "less") { put("personId", h.personId || null); put("untilYear", num(h.untilYear) ?? out.year); put("share", num(h.share) ?? 0); if (num(h.fromSavings) > 0) put("fromSavings", num(h.fromSavings)); }
  if (h.kind === "after") { put("personId", h.personId || null); put("untilYear", num(h.untilYear) ?? out.year); put("monthly", num(h.monthly)); }
  if (h.kind === "in" || h.kind === "out") { if (name) put("name", name); put("amount", num(h.amount)); }
  if (h.kind === "spend") { put("untilYear", num(h.untilYear)); put("monthly", num(h.monthly)); }
  // (a move with no amount moves all of the account: the field is left out)
  if (h.kind === "move") { put("fromId", h.fromId ? String(h.fromId) : null); put("toId", h.toId ? String(h.toId) : null); put("amount", num(h.amount)); }
  return out;
}
/** Add or replace one (by id) in the draft's `retirement.happenings`; returns the saved record. `at`: where a new one goes in the list; the end when left out. */
export function saveHappening(draft, h, at = null) {
  const rec = clean(h);
  draft.retirement = draft.retirement ?? {};
  const xs = Array.isArray(draft.retirement.happenings) ? draft.retirement.happenings : [];
  const i = xs.findIndex((x) => x?.id === rec.id);
  draft.retirement.happenings = i >= 0 ? xs.map((x, k) => (k === i ? rec : x)) : Number.isInteger(at) && at >= 0 && at < xs.length ? [...xs.slice(0, at), rec, ...xs.slice(at)] : [...xs, rec];
  return rec;
}
/** Take one out by id; the field goes when the list is empty (a plan with none reads as it did before the page had any). */
export function removeHappening(draft, id) {
  const xs = (draft.retirement?.happenings ?? []).filter((x) => x?.id !== id);
  if (!draft.retirement) return;
  if (xs.length) draft.retirement.happenings = xs; else delete draft.retirement.happenings;
}
/** An id no other happening of the plan has: "h1", "h2", ... */
export function nextId(plan) {
  const used = new Set((plan?.retirement?.happenings ?? []).map((x) => x?.id));
  let n = 1; while (used.has(`h${n}`)) n++;
  return `h${n}`;
}

// ---- the home ---------------------------------------------------------------------------------------------------------------
/**
 * homeFacts(plan, { today }) -> null (no home in the plan) | { accountId, name, value, growth, sellCosts, basis (price +
 * improvements, or null when the price is not on file), cap (the gain that is tax-free: $500,000 on a joint return, else
 * $250,000), runningYearly (property tax + insurance + dues + upkeep a year, from the home's fields or our guesses: Your
 * home's own lines, without the mortgage interest), taxInsYearly (the property tax and home insurance among them), mortgage: { id, name, balance, rate, payment (to the loan, with any
 * extra) } | null }. The home is the one Your home shows (the one with an entry, else the most valuable); the mortgage is
 * the mortgage page's. Never through Your home's whole sum: that works the tax on a sale today through the federal
 * estimate, which reads this projection.
 */
export function homeFacts(plan, { today = null } = {}) {
  const homes = (plan?.accounts ?? []).filter((a) => a.type === "property");
  const entries = (plan?.property ?? []).filter((x) => x && x.kind === "home");
  const acct = homes.find((a) => entries.some((e) => e.accountId === a.id)) ?? [...homes].sort((a, b) => countedBalance(b) - countedBalance(a))[0] ?? null;
  if (!acct) return null;
  const e = homeEntryFor(plan, acct.id) ?? {};
  const value = countedBalance(acct);
  let m = null;
  try { const mm = computeMortgage(plan, { today }); m = mm?.hasData ? mm.mortgage : null; } catch { m = null; }
  const price = num(e.purchasePrice);
  let running = 0, taxIns = 0;
  try {
    const lines = keepingLines(plan, e, m, value, today).filter((l) => l.amount > 0.5);
    running = lines.reduce((t, l) => t + l.amount, 0);
    taxIns = lines.filter((l) => l.key === "tax" || l.key === "insurance").reduce((t, l) => t + l.amount, 0);
  } catch { running = value * HOME.maintenance; taxIns = 0; }
  return {
    accountId: acct.id, name: e.name || acct.name, value, growth: num(e.appreciation) ?? HOME.appreciation, sellCosts: num(e.sellCosts) ?? HOME.sellCosts,
    basis: price ? price + (num(e.improvements) ?? 0) : null, cap: plan?.household?.filingStatus === "married_joint" ? EXCLUSION.married_joint : EXCLUSION.single, runningYearly: running, taxInsYearly: taxIns,
    mortgage: m && m.balance > 0.5 ? { id: m.id, name: m.name, balance: m.balance, rate: Number(m.rate) || 0, payment: (Number(m.toLoan ?? m.payment) || 0) + (Number(m.extra) || 0) } : null,
  };
}
/** What is still owed on a loan after `months` more payments (core/math/finance.js amortization), in the dollars of that day. */
export function balanceAfter(loan, months) {
  if (!loan || !(loan.balance > 0)) return 0;
  if (!(months > 0)) return loan.balance;
  const sch = amortization({ principal: loan.balance, annualRate: loan.rate, years: Math.ceil(months / 12), payment: loan.payment }).schedule;
  return sch.length >= months ? sch[months - 1].balance : sch.length && sch.at(-1).balance <= 0.005 ? 0 : sch.at(-1)?.balance ?? loan.balance;
}
/**
 * homeSale(facts, h, { nowYear, inflation }) -> the sale in year Y = h.year, every figure in today's dollars:
 *   value   V = V0 x ((1 + g) / (1 + i))^(Y - now)          (V0: h.value typed, else the home's value on file)
 *   costs   V x c                                           (c: h.sellCosts, else the home's own, else 6%)
 *   owed    the mortgage after 12 x (Y - now) more payments, / (1 + i)^(Y - now)
 *   tax     15% x max(0, V_nominal x (1 - c) - basis - cap) / (1 + i)^(Y - now); 0 when what was paid is not on file (`noBasis`)
 *   net     V x (1 - c) - owed - tax - buyFor
 *   running costs: `oldCosts` a year today; `newCosts` = oldCosts x buyFor / V, or 12 x the rent when nothing is bought
 *   (a rent of $0: no housing cost after, `noCost`). `escrowYearly`: the property tax and home insurance the projection keeps
 *   in spending for this home because nobody said whether the mortgage payment holds them (buildInputs `loans[].assumed`);
 *   what of it the home's own lines do not already hold is part of oldCosts, so it leaves spending with the home.
 */
export function homeSale(facts, h, { nowYear, inflation = 0.03, escrowYearly = 0 } = {}) {
  const n = Math.max(0, h.year - nowYear);
  const V0 = num(h.value) > 0 ? num(h.value) : facts.value;
  const c = num(h.sellCosts) ?? facts.sellCosts;
  const deflator = Math.pow(1 + inflation, n);
  const nominal = V0 * Math.pow(1 + facts.growth, n);
  const value = nominal / deflator;
  const costs = value * c;
  const owed = balanceAfter(facts.mortgage, 12 * n) / deflator;
  const noBasis = facts.basis === null || facts.basis === undefined;
  const taxedGain = noBasis ? 0 : Math.max(0, nominal * (1 - c) - facts.basis - facts.cap) / deflator;
  const tax = taxedGain * GAIN_RATE;
  const buyFor = Math.max(0, num(h.buyFor) ?? 0);
  const rentMonthly = buyFor > 0 ? 0 : Math.max(0, num(h.rentMonthly) ?? 0);
  const net = value * (1 - c) - owed - tax - buyFor;
  const oldCosts = facts.runningYearly + Math.max(0, (Number(escrowYearly) || 0) - (Number(facts.taxInsYearly) || 0));
  const newCosts = buyFor > 0 ? (value > 0 ? oldCosts * buyFor / value : 0) : rentMonthly * 12;
  return { year: h.year, value, costs, owed, taxedGain, tax, noBasis, buyFor, rentMonthly, noCost: !(buyFor > 0) && !(rentMonthly > 0), net, oldCosts, newCosts, mortgageId: facts.mortgage?.id ?? null, hadMortgage: owed > 0.5 };
}

// ---- goals with a date ------------------------------------------------------------------------------------------------------
/** The emergency fund is kept, not spent: the goal ticked as it (goals/emergency-fund), or one that says so in its name. */
const isCushion = (g) => g.isEmergencyFund === true || /emergency|rainy[- ]day/i.test(String(g.name ?? ""));
/**
 * goalEvents(plan, { nowYear, endYear, today, inflation }) -> [{ goalId, name, year, amount }]: each goal with a date inside
 * the plan (never the emergency fund: it is kept, not spent), as money out of savings in its year, in today's dollars:
 *   amount = max(0, T - saved - monthly x months left)
 * T is the goal's amount in today's money (a goal marked as not growing with prices, `inflates: false`, is in the dollars of
 * its date: T = target / (1 + i)^years; one with no mark grows, as the Goals page reads it). `saved` is money set aside outside the plan's accounts; the goal's own monthly saving is taken as new money
 * that is not also counted as retirement saving. Money in an account linked to the goal is already in the savings the
 * projection counts, so it comes out with the rest. A goal that needs nothing more gives no event.
 */
export function goalEvents(plan, { nowYear, endYear, today = null, inflation = 0.03 } = {}) {
  const from = today ?? `${nowYear}-01-01`;
  const out = [];
  for (const g of plan?.goals ?? []) {
    if (!g || isCushion(g) || !g.targetDate) continue;
    const year = Number(String(g.targetDate).slice(0, 4)), target = Math.max(0, Number(g.target) || 0);
    if (!isYear(year) || year < nowYear || year > endYear || !(target > 0)) continue;
    const T = g.inflates !== false ? target : target / Math.pow(1 + inflation, year - nowYear);
    const months = Math.max(0, monthsBetween(from, g.targetDate));
    const amount = Math.max(0, T - (Number(g.saved) || 0) - (Number(g.monthly) || 0) * months);
    if (amount > 0.5) out.push({ goalId: g.id, name: g.name || "A goal", year, amount });
  }
  return out;
}
/** How many goals have a date inside the plan (what the page's "Take them from savings when due · 3 goals" counts). */
export function datedGoals(plan, { nowYear, endYear } = {}) {
  return (plan?.goals ?? []).filter((g) => g && !isCushion(g) && g.targetDate && Number(g.target) > 0 && (() => { const y = Number(String(g.targetDate).slice(0, 4)); return y >= nowYear && y <= endYear; })()).length;
}

// ---- checking one -----------------------------------------------------------------------------------------------------------
const personOf = (people, id) => { const k = id ? people.findIndex((p) => p.id === id) : 0; return k >= 0 ? { k, p: people[k] } : null; };
/**
 * check(h, { nowYear, endYear, people, hasHome, accounts }) -> null (it can be counted) | { field, words }: why it cannot, in
 * words for the box. A year before this one or after the plan's end, an amount under $0, a share outside 0 to 100%, years for
 * working less that are not before that person stops work, work "after retiring" in a year they still work; a move with an
 * account missing, gone from the plan (`accounts`: the plan's), the same twice, out of a Roth or health savings account, or
 * into a retirement account.
 */
export function check(h, { nowYear, endYear, people = [], hasHome = true, accounts = [] } = {}) {
  const span = `from ${nowYear} to ${endYear}, when the plan ends`;
  if (!isYear(h.year)) return { field: "year", words: `Type a year ${span}.` };
  if (h.year < nowYear) return { field: "year", words: `${h.year} has passed. Pick a year ${span}.` };
  if (h.year > endYear) return { field: "year", words: `The plan ends in ${endYear}. Pick a year ${span}.` };
  const until = num(h.untilYear);
  if (until !== null) {
    if (!isYear(until) || until < h.year) return { field: "untilYear", words: `The last year cannot be before the first (${h.year}).` };
    if (until > endYear) return { field: "untilYear", words: `The plan ends in ${endYear}. Pick a last year up to then.` };
  }
  const neg = (k) => num(h[k]) !== null && num(h[k]) < 0;
  if (h.kind === "in" || h.kind === "out") {
    if (!(num(h.amount) > 0)) return { field: "amount", words: "Type how much, more than $0." };
    if (num(h.amount) > AMOUNT_CEILING) return { field: "amount", words: "That is more than this plan can hold: check for an extra digit." };
  }
  if (h.kind === "spend") {
    if (!num(h.monthly)) return { field: "monthly", words: "Type how much a month, more than $0." };
    if (Math.abs(num(h.monthly)) > MONTHLY_CEILING) return { field: "monthly", words: "That is more than this plan can hold: check for an extra digit." };
  }
  if (h.kind === "move") {
    const list = Array.isArray(accounts) ? accounts : [];
    const gone = "That account is no longer in the plan. Pick another, or remove this line.";
    const from = h.fromId ? list.find((a) => a?.id === h.fromId) : null, to = h.toId ? list.find((a) => a?.id === h.toId) : null;
    if (!h.fromId) return { field: "fromId", words: "Pick the account the money comes out of." };
    if (!from) return { field: "fromId", words: gone };
    if (!h.toId) return { field: "toId", words: "Pick the account the money goes into." };
    if (!to) return { field: "toId", words: gone };
    if (h.fromId === h.toId) return { field: "toId", words: "Pick two different accounts." };
    if (!MOVE_FROM.includes(from.type)) return { field: "fromId", words: MOVE_BUCKET[from.type] === "free" ? "Moving money out of a Roth or health savings account is not offered: the tax on it depends on your age and what the money is for." : "Pick a bank, investment, 401(k) or IRA account to take the money from." };
    if (!MOVE_INTO.includes(to.type)) return { field: "toId", words: MOVE_BUCKET[to.type] === "deferred" || MOVE_BUCKET[to.type] === "free" ? "Money goes into a 401(k), IRA, Roth or health savings account only as yearly saving: set that under What you save for retirement." : "Pick a bank or investment account to put the money in." };
    // an amount that is there but is not a number (a plan typed by hand, or imported) is refused, never read as "all of it"
    // (critic of item 26, M3: "abc" moved a whole 401(k)); none at all is all of it
    const a = num(h.amount);
    if (h.amount !== null && h.amount !== undefined && h.amount !== "" && (a === null || (typeof h.amount !== "number" && typeof h.amount !== "string"))) return { field: "amount", words: "Type how much as a number, or choose All of it." };
    if (a !== null && !(a > 0)) return { field: "amount", words: "Type how much, more than $0, or choose All of it." };
    if (a !== null && a > AMOUNT_CEILING) return { field: "amount", words: "That is more than this plan can hold: check for an extra digit." };
  }
  if (h.kind === "home") {
    if (!hasHome) return { field: "year", words: "The plan has no home to sell. Add it under What you own first." };
    if (neg("buyFor") || neg("rentMonthly") || neg("value")) return { field: "buyFor", words: "Type an amount of $0 or more." };
    if (num(h.sellCosts) !== null && (num(h.sellCosts) < 0 || num(h.sellCosts) > 0.5)) return { field: "sellCosts", words: "Use a number from 0% to 50%." };
    // neither a price nor a rent: the page cannot tell renting from a slip. A rent of $0 typed is an answer (no housing cost after)
    if (!(num(h.buyFor) > 0) && num(h.rentMonthly) === null) return { field: "rentMonthly", words: "Say what the next place costs: a price to buy above, or a rent a month here (0 if none)." };
  }
  if (h.kind === "less" || h.kind === "after") {
    const who = personOf(people, h.personId);
    if (!who) return { field: "personId", words: "Pick who this is about." };
    if (until === null) return { field: "untilYear", words: "Type the last year." };
    const stops = who.p.birthYear + who.p.retireAge, name = who.p.name;
    if (h.kind === "less") {
      const s = num(h.share);
      if (s === null || s < 0 || s > 1) return { field: "share", words: "Use a number from 0% to 100%." };
      if (neg("fromSavings")) return { field: "fromSavings", words: "Type an amount of $0 or more." };
      if (until >= stops) return { field: h.year >= stops ? "year" : "untilYear", words: `${NameIn(name)} ${verbFor(name, "stops", "stop")} work in ${stops} in this plan. Pick years before that, or change the age on the People page.` };
    } else {
      if (!(num(h.monthly) > 0)) return { field: "monthly", words: "Type the pay a month, more than $0." };
      if (num(h.monthly) > MONTHLY_CEILING) return { field: "monthly", words: "That is more than this plan can hold: check for an extra digit." };
      if (h.year < stops) return { field: "year", words: `${NameIn(name)} ${verbFor(name, "is", "are")} still at work until ${stops} in this plan. Pick a year from ${stops} on, or change the age on the People page.` };
    }
  }
  return null;
}

// ---- spending that changes --------------------------------------------------------------------------------------------------
/**
 * spendingFactors(S0, changes) -> { factors: [{ fromYear, factor }], floored }: the engine multiplies fixed spending by every
 * factor whose year has come, so a change of D dollars a year is said as a factor of the level in force. `changes` are
 * [{ from, until (null = for good), delta (a year, + or -) }]; the level in a year is L = max(SPEND_FLOOR, S0 + the deltas
 * in force), and at each year the level moves the factor is L / (the level before). One change from Y to U gives
 * (S0 + D) / S0 at Y and S0 / (S0 + D) at U + 1: the two multiply to 1.
 */
export function spendingFactors(S0, changes = []) {
  if (!(S0 > 0) || !changes.length) return { factors: [], floored: false };
  const years = [...new Set(changes.flatMap((c) => [c.from, ...(c.until !== null && c.until !== undefined ? [c.until + 1] : [])]))].sort((a, b) => a - b);
  const factors = [];
  let prev = S0, floored = false;
  for (const y of years) {
    const raw = S0 + changes.reduce((t, c) => (y >= c.from && (c.until === null || c.until === undefined || y <= c.until) ? t + c.delta : t), 0);
    if (raw < SPEND_FLOOR) floored = true;
    const level = Math.max(SPEND_FLOOR, raw);
    if (Math.abs(level - prev) > 1e-9) factors.push({ fromYear: y, factor: level / prev });
    prev = level;
  }
  return { factors, floored };
}

// ---- money moved between accounts -------------------------------------------------------------------------------------------
/**
 * moveFacts(accounts, h, people, { free }) -> null (an account is not in the plan) | { from, to (the engine's kinds of money),
 * share, personIndex, account, in401, freed, fromName, toName }. `share`: what the account the money comes out of holds today
 * over what its kind holds today (`countedBalance`, the balance the projection counts; a kind holding $0 today is shared
 * equally among its accounts), so "all of it" in a later year is that share of the kind then. `personIndex`: its owner among
 * the engine's people (no owner, or one not in the plan: the first adult, as the money before 59½ counts it). The extra 10%
 * before 59½ follows that account, not the owner's blend of every pre-tax account (critic of item 26, M1): `in401`, a 401(k),
 * which the age-55 rule can spare (an IRA it cannot: IRS Topic 558); `freed`, money of someone a what-if says has died, or
 * of someone it says can never work again (`free`: the plan's `retirement.early.free`, as the projection's earlyInputs reads
 * it), which owes none.
 */
export function moveFacts(accounts, h, people = [], { free = null } = {}) {
  const list = Array.isArray(accounts) ? accounts.filter((a) => a && typeof a === "object") : [];
  const src = list.find((a) => a.id === h.fromId), dst = list.find((a) => a.id === h.toId);
  if (!src || !dst) return null;
  const from = MOVE_BUCKET[src.type] ?? null, to = MOVE_BUCKET[dst.type] ?? null;
  const same = list.filter((a) => MOVE_BUCKET[a.type] === from);
  const total = same.reduce((t, a) => t + Math.max(0, countedBalance(a)), 0);
  const share = total > 0 ? Math.max(0, countedBalance(src)) / total : 1 / Math.max(1, same.length);
  const k = people.findIndex((p) => p.id === src.ownerId), owner = people[k >= 0 ? k : 0];
  const died = Array.isArray(free?.owners) ? free.owners : [], unable = Array.isArray(free?.people) ? free.people : [];
  const freed = (src.ownerId !== undefined && src.ownerId !== null && died.includes(src.ownerId)) || (!!owner && unable.includes(owner.id));
  return { from, to, share, personIndex: k >= 0 ? k : 0, account: src.id, in401: src.type === "401k", freed, fromName: String(src.name || "").trim() || "an account", toName: String(dst.name || "").trim() || "an account" };
}
/**
 * moveOutcome(run, h) -> null | what one move did in the run (the projection at average markets with everything in it), in
 * today's dollars: { year, asked (null: all of it), moved, tax (the year's tax with it against without it), early (the extra
 * 10% before 59½ in that tax), capped (more was asked than the account held), sameKind (both accounts are the same kind of
 * money: nothing moves for the plan), from, to, failYear (the year the money runs out, null when it lasts) }. effects() adds
 * `conversionLess`: how much less the year's Roth conversion is with the move than without it (today's dollars; 0 when none).
 */
export function moveOutcome(run, h) {
  const row = run?.rows?.find((r) => r.year === h.year);
  const m = row?.moves?.find((x) => x.happening === h.id);
  if (!row || !m) return null;
  const p = row.priceLevel || 1;
  return { year: h.year, asked: m.asked === null ? null : m.asked / p, moved: m.amount / p, tax: m.tax / p, early: m.early / p, capped: !!m.capped, sameKind: m.from === m.to, from: m.from, to: m.to, failYear: run.success ? null : run.failYear };
}

// ---- into the engine --------------------------------------------------------------------------------------------------------
const yearsFrom = (a, b) => { const out = []; for (let y = a; y <= b; y++) out.push(y); return out; };
/**
 * apply(plan, inputs, { nowYear, today, skip, goals, facts }) -> { inputs, used, skipped, goals, floored, changed }
 * `inputs`: the engine inputs with every happening of the plan in them (a copy; the very same object, `changed: false`, when
 * there is nothing to count). `skip`: the id of one to leave out (its own effect is the answer with all against the answer
 * with all but it). `goals`: true or false overrides `retirement.countGoals`. `used`: [{ id, kind, sale? (homeSale), moved?
 * (working less: how many saving rows and pay lines it changed) }]; `skipped`: [{ id, field, words }] (check); `goals`:
 * goalEvents when counted. `floored`: a cut took spending to the floor.
 *   in / out   events { year, amount: out ? A : -A }  (> 0 comes out of savings in the withdrawal order; < 0 goes into regular savings)
 *   spend      a level change of 12 x the monthly change (spendingFactors), on the spending the engine raises with prices:
 *              spending.yearly less the loan payments it holds (`loans[].inBase`)
 *   less       that person's saving rows get the years in `skipYears`; with a share s > 0 each row is added again at
 *              yearly x s (its `own` too) for those years only; a pay line of theirs the engine counts (a partner still at
 *              work after the household retires) is cut into before, during (x s) and after; `fromSavings` > 0 is an event
 *              out in each of the years
 *   after      incomes { yearly: 12 x monthly, startAge: 0, fromYear, untilYear, cola: true, taxable: true, type: "other" }
 *   home       homeSale: events { year, amount: -net }; the mortgage's entry in `loans` ends the year before; the running
 *              costs move as a spending change of newCosts - oldCosts from that year on
 *   goals      goalEvents: events { year, amount }
 *   move       moves { year, from, to, amount (today's dollars; null: all of it), share, personIndex, account, in401, freed, fromName, toName }
 *              (moveFacts); the engine moves it after the year's required withdrawal and taxes it as that kind coming out
 */
export function apply(plan, inputs, { nowYear = inputs?.startYear, today = null, skip = null, goals = undefined, facts = undefined } = {}) {
  const none = { inputs, used: [], skipped: [], goals: [], floored: false, changed: false };
  if (!inputs) return none;
  const items = listOf(plan).filter((h) => h.id !== skip);
  const inflation = Number(inputs.rates?.inflation ?? 0.03), endYear = inputs.endYear, people = inputs.people ?? [];
  const goalList = (goals ?? plan?.retirement?.countGoals === true) ? goalEvents(plan, { nowYear, endYear, today, inflation }) : [];
  if (!items.length && !goalList.length) return none;
  const I = { ...inputs, contributions: (inputs.contributions ?? []).map((c) => ({ ...c })), incomes: (inputs.incomes ?? []).map((x) => ({ ...x })), events: [...(inputs.events ?? [])],
    ...(Array.isArray(inputs.loans) ? { loans: inputs.loans.map((l) => (l && typeof l === "object" ? { ...l } : l)) } : {}) };
  const used = [], skipped = [], changes = [], moves = [];
  const accounts = plan?.accounts ?? [];
  let home = facts, sold = false;
  for (const h of items) {
    if (h.kind === "home" && home === undefined) home = homeFacts(plan, { today });
    const no = check(h, { nowYear, endYear, people, hasHome: h.kind !== "home" || !!home, accounts }) ?? (h.kind === "home" && sold ? { field: "year", words: "The home is already sold by another line here. Remove one of the two." } : null);
    if (no) { skipped.push({ id: h.id, ...no }); continue; }
    const label = h.name || { home: "The home sold", less: "Working less", after: "Work after retiring", in: "Money coming in", out: "A big cost", spend: "Spending changes", move: "Money moved" }[h.kind];
    if (h.kind === "in" || h.kind === "out") {
      I.events.push({ year: h.year, amount: h.kind === "out" ? h.amount : -h.amount, label, happening: h.id });
      used.push({ id: h.id, kind: h.kind });
    } else if (h.kind === "spend") {
      changes.push({ from: h.year, until: num(h.untilYear), delta: 12 * h.monthly });
      used.push({ id: h.id, kind: h.kind });
    } else if (h.kind === "after") {
      const { k, p } = personOf(people, h.personId);
      I.incomes.push({ name: `${nameOf(p.name)} work after retiring`, yearly: 12 * h.monthly, personIndex: k, startAge: 0, fromYear: h.year, untilYear: h.untilYear, cola: true, taxable: true, type: "other", happening: h.id });
      used.push({ id: h.id, kind: h.kind });
    } else if (h.kind === "less") {
      const { k } = personOf(people, h.personId), s = h.share, range = yearsFrom(h.year, h.untilYear), inRange = new Set(range);
      const outside = yearsFrom(inputs.startYear, endYear).filter((y) => !inRange.has(y));
      let moved = 0;
      const more = [];
      for (const c of I.contributions) {
        if ((c.personIndex ?? 0) !== k) continue;
        const was = c.skipYears ?? [];
        if (s > 0) more.push({ ...c, yearly: c.yearly * s, ...(c.own !== undefined && c.own !== null ? { own: c.own * s } : {}), skipYears: [...new Set([...was, ...outside])] });
        c.skipYears = [...new Set([...was, ...range])];
        moved++;
      }
      I.contributions.push(...more);
      // a pay line the engine counts for this person: before, during (at the share) and after
      const lines = [];
      for (const x of I.incomes) {
        const p = people[x.personIndex ?? 0];
        const first = Math.max(p.birthYear + x.startAge, x.fromYear ?? -Infinity), last = Math.min(x.endAge !== undefined && x.endAge !== null ? p.birthYear + x.endAge : Infinity, x.untilYear ?? Infinity);
        if (x.type !== "pay" || (x.personIndex ?? 0) !== k || last < h.year || first > h.untilYear) { lines.push(x); continue; }
        if (first < h.year) lines.push({ ...x, untilYear: h.year - 1 });
        if (s > 0) lines.push({ ...x, yearly: x.yearly * s, fromYear: Math.max(first, h.year), untilYear: Math.min(last, h.untilYear) });
        if (last > h.untilYear) lines.push({ ...x, fromYear: h.untilYear + 1 });
        moved++;
      }
      I.incomes = lines;
      if (h.fromSavings > 0) for (const y of range) I.events.push({ year: y, amount: h.fromSavings, label, happening: h.id });
      used.push({ id: h.id, kind: h.kind, moved });
    } else if (h.kind === "home") {
      // the tax and insurance kept in spending for this home on our guess (`assumed`): they go with the home
      const kept = (I.loans ?? []).find((l) => l && typeof l === "object" && home.mortgage && l.accountId === home.mortgage.id && l.assumed);
      const sale = homeSale(home, h, { nowYear, inflation, escrowYearly: kept ? (Number(kept.escrow) || 0) * 12 : 0 });
      sold = true;
      I.events.push({ year: h.year, amount: -sale.net, label, happening: h.id });
      for (const l of I.loans ?? []) {
        if (!l || typeof l !== "object" || !sale.mortgageId || l.accountId !== sale.mortgageId) continue;
        if (l.untilYear === undefined || l.untilYear === null || l.untilYear >= h.year) { l.untilYear = h.year - 1; delete l.lastMonths; l.ends = `${h.year - 1}-12`; l.soldHome = h.year; }
      }
      changes.push({ from: h.year, until: null, delta: sale.newCosts - sale.oldCosts });
      used.push({ id: h.id, kind: h.kind, sale });
    } else if (h.kind === "move") {
      const f = moveFacts(accounts, h, people, { free: plan?.retirement?.early?.free ?? null });
      moves.push({ year: h.year, from: f.from, to: f.to, amount: num(h.amount), share: f.share, personIndex: f.personIndex, account: f.account, in401: f.in401, freed: f.freed, fromName: f.fromName, toName: f.toName, label, happening: h.id });
      used.push({ id: h.id, kind: h.kind });
    }
  }
  if (moves.length) I.moves = [...(Array.isArray(inputs.moves) ? inputs.moves : []), ...moves];
  for (const g of goalList) I.events.push({ year: g.year, amount: g.amount, label: g.name, goal: g.goalId });
  const S0 = Math.max(0, (Number(I.spending?.yearly) || 0) - (I.loans ?? []).reduce((t, l) => t + (Number(l?.inBase) || 0), 0));
  const f = spendingFactors(S0, changes);
  if (f.factors.length) I.spendingChanges = [...(inputs.spendingChanges ?? []), ...f.factors];
  if (!I.events.length && inputs.events === undefined) delete I.events;
  return { inputs: I, used, skipped, goals: goalList, floored: f.floored, changed: true };
}
/** toEngine(plan, inputs, opts) -> the engine inputs with the plan's happenings in them (apply's `inputs`). */
export const toEngine = (plan, inputs, opts = {}) => apply(plan, inputs, opts).inputs;

// ---- what each one does to the answer ---------------------------------------------------------------------------------------
/** One projection at average markets, in the answer's own unit (levers.js outcomeOf's shape). */
export const outcome = (inputs) => outcomeOf(project(inputs));
/** outcome() of a run already made. */
function outcomeOf(r) {
  const last = r.rows.at(-1);
  return { lasts: !!r.success, age: r.success ? null : r.failAge, endAge: last?.ages?.[0] ?? null, endReal: last?.totalReal ?? 0 };
}
/**
 * effects(plan, build, { today }) -> { answer (with everything), without (with none of it), items: [{ h, with, without,
 * sale?, moved?, move? (moveOutcome: what a move did in the run with everything), skipped?: { field, words } }], goals: { list,
 * with, without } | null, floored, strategy } | null.
 * `build(plan, params)`: the projection's own buildInputs for a plan, returning the engine inputs or null (handed in: this file
 * is read by that one). Each line's effect is two runs at average markets: the plan as it is against the plan without that
 * one line, built again from the start, so it is exactly the answer the page gives once the line is removed (health
 * insurance, which follows the plan's income, included).
 */
export function effects(plan, build, { today = null } = {}) {
  const base = build(plan, { happenings: false });
  if (!base) return null;
  const nowYear = base.startYear;
  const list = listOf(plan), rt = plan?.retirement ?? {};
  const facts = list.some((h) => h.kind === "home") ? homeFacts(plan, { today }) : null;
  const all = apply(plan, base, { nowYear, today, facts });
  const run = (p) => { const I = build(p, {}); return I ? outcome(I) : null; };
  // (the line itself, not every line with its id: two lines sharing an id in a hand-edited file each get their own effect)
  const minus = (h) => ({ ...plan, retirement: { ...rt, happenings: (rt.happenings ?? []).filter((x) => x !== h) } });
  // the run with everything is kept whole: a move's line says what it moved and the tax, from that run's row of its year
  const full = (() => { const I = build(plan, {}); return I ? project(I) : null; })();
  const answer = full ? outcomeOf(full) : null;
  const items = list.map((h) => {
    const no = all.skipped.find((x) => x.id === h.id);
    if (no) return { h, skipped: { field: no.field, words: no.words } };
    const u = all.used.find((x) => x.id === h.id) ?? {};
    const mv = h.kind === "move" ? moveOutcome(full, h) : null;
    if (!mv) return { h, with: answer, without: run(minus(h)), ...(u.sale ? { sale: u.sale } : {}), ...(u.moved !== undefined ? { moved: u.moved } : {}) };
    // a move's run without it is kept whole too: what the year's Roth conversion is without the move (M4)
    const I0 = build(minus(h), {}), r0 = I0 ? project(I0) : null;
    const row = full.rows.find((r) => r.year === h.year), row0 = r0?.rows.find((r) => r.year === h.year);
    const conversionLess = row && row0 ? Math.max(0, ((row0.conversion ?? 0) - (row.conversion ?? 0)) / (row.priceLevel || 1)) : 0;
    return { h, with: answer, without: r0 ? outcomeOf(r0) : null, move: { ...mv, conversionLess } };
  });
  const goals = all.goals.length ? { list: all.goals, with: answer, without: run({ ...plan, retirement: { ...rt, countGoals: false } }) } : null;
  return { answer, without: run({ ...plan, retirement: { ...rt, happenings: [], countGoals: false } }), items, goals, floored: all.floored, strategy: base.strategy ?? "fixed-real" };
}

// ---- the words --------------------------------------------------------------------------------------------------------------
const yearsWords = (from, until) => (until === null || until === undefined ? `from ${from} on` : from === until ? `in ${from}` : `${from} to ${until}`);
/**
 * lineWords(h, { people, sale, money }) -> the one line that says a happening, written out for each case:
 *   "Sell the home in 2041 and buy one for $250,000: about $212,000 into savings after the mortgage and costs"
 *   "Sell the home in 2041 and rent for $1,800 a month: about $412,000 into savings after selling costs"
 *   "Sell the home in 2041 and buy one for $900,000: about $88,000 out of savings on top of what the sale brings"
 *   "Sell the home in 2041 with no housing cost after: about $412,000 into savings after selling costs"
 *   "Bo takes a break from work 2030 to 2034" | "Bo works half-time 2030 to 2034" | "Bo works for 60% of the usual pay in 2030"
 *   "Bo works after retiring 2040 to 2044: $1,500 a month"
 *   "An inheritance in 2035: $100,000 into savings" | "A new roof in 2035: $40,000 out of savings"
 *   "Spending goes up $500 a month from 2040 on" | "Spending goes down $300 a month 2040 to 2049"
 *   a move (`accounts`: the plan's, for the names; `move`: moveOutcome, what the run moved and the tax):
 *   "Move $20,000 from Savings to Brokerage in 2030" | "Move all of Savings to Brokerage in 2030" (before the run), then
 *   "...: no tax" | "...: about $4,400 of tax" | "...: about $6,400 of tax, $2,000 of it the extra 10% before 59½" |
 *   "...: about $1,500 of tax on the gain" | "...: under $100 of tax" | all of it, or less than asked: "...: about $41,000
 *   by then (today's dollars), no tax" | "...: about $610,000 by then (today's dollars), with about $190,000 of tax" | nothing
 *   there: "...: nothing moves"
 */
export function lineWords(h, { people = [], sale = null, money = dollars, accounts = [], move = null } = {}) {
  if (h.kind === "move") return moveWords(h, { accounts, move, money });
  if (h.kind === "home") {
    const next = num(h.buyFor) > 0 ? `and buy one for ${money(h.buyFor)}` : num(h.rentMonthly) > 0 ? `and rent for ${money(num(h.rentMonthly))} a month` : "with no housing cost after";
    const lead = `Sell the home in ${h.year} ${next}`;
    if (!sale) return lead;
    const after = sale.hadMortgage ? "after the mortgage and costs" : "after selling costs";
    return sale.net >= 0 ? `${lead}: about ${money(roundMoney(sale.net))} into savings ${after}` : `${lead}: about ${money(roundMoney(-sale.net))} out of savings on top of what the sale brings`;
  }
  if (h.kind === "in") return `${h.name || "Money coming in"} in ${h.year}: ${money(h.amount)} into savings`;
  if (h.kind === "out") return `${h.name || "A big cost"} in ${h.year}: ${money(h.amount)} out of savings`;
  if (h.kind === "spend") return `Spending goes ${h.monthly < 0 ? "down" : "up"} ${money(Math.abs(h.monthly))} a month ${yearsWords(h.year, num(h.untilYear))}`;
  const who = personOf(people, h.personId)?.p ?? people[0] ?? { name: "" };
  const Who = NameIn(who.name), when = yearsWords(h.year, num(h.untilYear) ?? h.year);
  if (h.kind === "after") return `${Who} ${verbFor(who.name, "works", "work")} after retiring ${when}: ${money(h.monthly)} a month`;
  const s = num(h.share) ?? 0;
  const what = s === 0 ? `${verbFor(who.name, "takes", "take")} a break from work` : Math.abs(s - 0.5) < 1e-9 ? `${verbFor(who.name, "works", "work")} half-time` : `${verbFor(who.name, "works", "work")} for ${Number((s * 100).toFixed(1))}% of the usual pay`;
  return `${Who} ${what} ${when}${num(h.fromSavings) > 0 ? `, with ${money(h.fromSavings)} a year taken from savings` : ""}`;
}
/** What an account holds today, as the projection counts it (`countedBalance`), for "All of it" on the form; null: not in the plan. */
export function moveHolds(accounts, id) {
  const a = (Array.isArray(accounts) ? accounts : []).find((x) => x && typeof x === "object" && x.id === id);
  return a ? Math.max(0, countedBalance(a)) : null;
}
/** The names of a move's two accounts, as the plan has them ("an account" when one is gone or has no name). */
export function moveNames(h, accounts = []) {
  const list = Array.isArray(accounts) ? accounts : [];
  const name = (id) => String(list.find((a) => a?.id === id)?.name ?? "").trim() || "an account";
  return { from: name(h.fromId), to: name(h.toId) };
}
/** A move's line (lineWords' cases for kind "move"). */
function moveWords(h, { accounts = [], move = null, money = dollars } = {}) {
  const n = moveNames(h, accounts), amount = num(h.amount);
  const lead = amount > 0 ? `Move ${money(amount)} from ${n.from} to ${n.to} in ${h.year}` : `Move all of ${n.from} to ${n.to} in ${h.year}`;
  if (!move) return lead;
  if (!(move.moved >= 0.5)) return `${lead}: nothing moves`;
  const t = roundMoney(move.tax), e = roundMoney(move.early);
  const tax = !(move.tax >= 0.5) ? null
    : t === 0 ? `under ${money(100)} of tax`
    : `about ${money(t)} of tax${e > 0 ? `, ${money(e)} of it the extra 10% before 59½` : move.from === "taxable" ? " on the gain" : ""}`;
  // what moved is said when it is not the amount typed: all of the account, or less than asked because that is all it held;
  // it is what the account holds in that year, so "by then", in today's dollars as every figure here (critic of item 26, P5)
  if (amount > 0 && !move.capped) return `${lead}: ${tax ?? "no tax"}`;
  return `${lead}: about ${money(roundMoney(move.moved))} by then (today's dollars), ${tax ? `with ${tax}` : "no tax"}`;
}

/**
 * effectSay(with, without, money) -> what one line does to the answer, in the answer's own words:
 *   "runs out at 93 (at 88 without it)" | "runs out at 88 either way" | "lasts to the end (runs out at 88 without it)" |
 *   "runs out at 86 (lasts to the end without it)" | "about $40,000 more left at 95" | "about $40,000 less left at 95" |
 *   "about the same left at 95"
 */
export function effectSay(w, wo, money = dollars) {
  if (!w || !wo) return "";
  if (!w.lasts && !wo.lasts) return w.age === wo.age ? `runs out at ${w.age} either way` : `runs out at ${w.age} (at ${wo.age} without it)`;
  if (w.lasts && !wo.lasts) return `lasts to the end (runs out at ${wo.age} without it)`;
  if (!w.lasts) return `runs out at ${w.age} (lasts to the end without it)`;
  const diff = w.endReal - wo.endReal, r = roundMoney(Math.abs(diff));
  if (r < 100) return `about the same left at ${w.endAge}`;
  return `about ${money(r)} ${diff > 0 ? "more" : "less"} left at ${w.endAge}`;
}
/** Is this line's effect better for the plan than without it (it lasts where it did not, longer, or with more left)? */
const better = (w, wo) => !!w && !!wo && (w.lasts && !wo.lasts ? true : !w.lasts && wo.lasts ? false : !w.lasts ? w.age > wo.age : roundMoney(w.endReal - wo.endReal) >= 100);
/**
 * moveTail(item, { taxMode }) -> "" | the clause a move's effect ends with, where the effect alone would mislead (critic of
 * item 26, M2 and P6): pre-tax money into an investment account with the plan's one simple tax rate, which never taxes what
 * investments earn, reads better than it is: "but with one simple tax rate the plan counts no tax on what investments earn,
 * so this may look better than it is"; bank money into an investment account that leaves more: "because investments are
 * assumed to grow more than savings".
 */
export function moveTail(item, { taxMode = "flat" } = {}) {
  const m = item?.h?.kind === "move" ? item.move : null;
  if (!m || m.sameKind || !(m.moved >= 0.5)) return "";
  if (taxMode !== "brackets" && m.from === "deferred" && m.to === "taxable") return "but with one simple tax rate the plan counts no tax on what investments earn, so this may look better than it is";
  if (m.from === "cash" && m.to === "taxable" && better(item.with, item.without)) return "because investments are assumed to grow more than savings";
  return "";
}
/** Does a move's line want the way to the federal brackets (the plan's one simple tax rate leaves out a tax it would owe)? */
export const wantsBrackets = (item, { taxMode = "flat" } = {}) => {
  const m = item?.h?.kind === "move" ? item.move : null;
  return !!m && taxMode !== "brackets" && !m.sameKind && m.moved >= 0.5 && (m.from === "taxable" || (m.from === "deferred" && m.to === "taxable"));
};
/** Is spending set by savings each year (a share of what is left, the years-left way, or one of the two named rules that take a
 * share: How much to take out's "endowment" and "ninety-five", gap list next 60 item 21)? A spending change is not used then. */
export const drawSets = (strategy) => strategy === "percent" || strategy === "vpw" || strategy === "endowment" || strategy === "ninety-five";
/**
 * noteWords(item, { strategy, people, money }) -> [sentence]: what a person should know about one line beyond its effect.
 * Each is a written case: a spending change with a way of taking money out that sets its own spending; a home's gain over
 * the tax-free amount; a home with no purchase price on file; what running the next home costs; a big cost in a working year
 * (`retireYear`: the year retirement starts), and one that alone empties the savings before then; working less that changes no
 * saving in the plan; a move that moved less than asked, or nothing (the money has run out by then, or that account is empty),
 * between two accounts of the same kind, or a sale from an investment account with the plan's one simple tax rate (`taxMode`
 * "flat"), which counts no tax on it (the page adds its way to the brackets, wantsBrackets()):
 *   "Savings holds only about $41,000 by 2030 in this plan, so that is what moves."
 *   "The money runs out in 2058 in this plan, so there is nothing to move in 2060."
 *   "Nothing is left in Savings by 2040 in this plan, so nothing moves."
 *   "To the plan both are the same kind of money, so this changes nothing in the answer."
 *   "This plan uses one simple tax rate and counts no tax when you sell investments."
 *   (pre-tax money into an investment account with that rate is said on the effect itself: moveTail())
 *   a taxed move before retirement with the brackets, which hold no pay in those years (`retireYear`):
 *   "The plan does not count your pay before retirement, so this tax is worked out as if the move were your only income in
 *   2030: on top of your pay it would be more."
 *   a pre-tax move in a year with a Roth conversion, which it takes room from (`move.conversionLess`):
 *   "This move uses room in the tax bracket that your Roth conversion fills, so about $21,000 less goes into your Roth that
 *   year."
 */
export function noteWords(item, { strategy = "fixed-real", people = [], money = dollars, retireYear = null, accounts = [], taxMode = "flat" } = {}) {
  const h = item.h, out = [];
  if (h.kind === "move" && item.move) {
    const m = item.move, n = moveNames(h, accounts);
    if (!(m.moved >= 0.5)) out.push(Number.isInteger(m.failYear) && m.failYear <= h.year ? `The money runs out in ${m.failYear} in this plan, so there is nothing to move in ${h.year}.` : `Nothing is left in ${n.from} by ${h.year} in this plan, so nothing moves.`);
    else if (m.capped) out.push(`${capFirst(n.from)} holds only about ${money(roundMoney(m.moved))} by ${h.year} in this plan, so that is what moves.`);
    const flat = taxMode !== "brackets", taxed = m.from === "deferred" || m.from === "taxable";
    // (plain words, critic of item 26, P1 and P2: "flat rate on pre-tax withdrawals" meant nothing to a layperson)
    if (m.sameKind) out.push("To the plan both are the same kind of money, so this changes nothing in the answer.");
    else if (m.moved >= 0.5 && flat && m.from === "taxable") out.push("This plan uses one simple tax rate and counts no tax when you sell investments.");
    else if (m.moved >= 0.5 && !flat && taxed && Number.isInteger(retireYear) && h.year < retireYear) out.push(`The plan does not count your pay before retirement, so this tax is worked out as if the move were your only income in ${h.year}: on top of your pay it would be more.`);
    // a move out of pre-tax money in a year the plan converts to a Roth up to a bracket's top: the move takes that room, so
    // the conversion is smaller (critic of item 26, M4); the move's own tax above is on top of the conversion as it ends
    if (!m.sameKind && m.moved >= 0.5 && roundMoney(m.conversionLess ?? 0) >= 100) out.push(`This move uses room in the tax bracket that your Roth conversion fills, so about ${money(roundMoney(m.conversionLess))} less goes into your Roth that year.`);
  }
  const notUsed = "not used with your way of taking money out (How much to take out)";
  if (h.kind === "spend" && drawSets(strategy)) out.push(`This is ${notUsed}.`);
  if (h.kind === "home" && item.sale) {
    const s = item.sale;
    if (s.tax > 0.5) out.push(`Your gain is over the tax-free amount; a tax preparer can say exactly. About ${money(roundMoney(s.tax))} of tax is taken off here.`);
    if (s.noBasis) out.push("What you paid for the home is not on file, so no tax on the gain is counted (Your home).");
    const costs = `Running a home: about ${money(roundMoney(s.oldCosts))} a year now, ${s.buyFor > 0 ? `about ${money(roundMoney(s.newCosts))} a year after` : s.rentMonthly > 0 ? `${money(roundMoney(s.newCosts))} of rent a year after` : "nothing after"}`;
    out.push(drawSets(strategy) ? `${costs}; that change is ${notUsed}.` : `${costs}.`);
  }
  // a cost in a working year: the plan holds no pay for those years, so all of it comes out of savings; when that alone
  // empties them before retirement starts, the line says why the answer reads as it does
  if (h.kind === "out" && Number.isInteger(retireYear) && h.year < retireYear) {
    const w = item.with, wo = item.without, born = people[0]?.birthYear;
    const emptied = !!w && !w.lasts && Number.isFinite(born) && born + w.age < retireYear && (!wo || wo.lasts || wo.age > w.age);
    out.push(emptied
      ? `The plan counts your savings in ${h.year}, not your pay, and the savings alone do not cover this: that is why it says the money runs out then. If pay will cover part of it, type only the part that comes out of savings.`
      : "This is before retirement, where the plan counts your savings and not your pay: all of it comes out of savings here. If pay will cover part of it, type only the part that comes out of savings.");
  }
  if (h.kind === "less" && item.moved === 0) {
    const who = personOf(people, h.personId)?.p ?? { name: "" };
    out.push(num(h.fromSavings) > 0 ? `The plan holds no saving of ${nameOf(who.name) === "your" ? "yours" : nameOf(who.name)} for those years, so only the money taken from savings counts.` : `The plan holds no saving of ${nameOf(who.name) === "your" ? "yours" : nameOf(who.name)} for those years, so this changes nothing yet (What you save for retirement).`);
  }
  return out;
}
/** The standing caveats for "How this is worked out", only those that apply to what is set. */
export function howWords(fx, { money = dollars, taxMode = "flat" } = {}) {
  const kinds = new Set((fx?.items ?? []).filter((x) => !x.skipped).map((x) => x.h.kind));
  const out = [];
  if (kinds.has("less")) out.push("Working less: the plan counts what you save in working years, not your pay or your bills, so a break changes the answer only through the saving it stops (and any money you said it takes from savings).");
  if (kinds.has("after")) out.push("Work after retiring is counted as taxable income in those years, rising with prices; in years the household still works it is spent, not saved.");
  if (kinds.has("home")) out.push(`Selling the home: its value grows as Your home says, the mortgage is paid down on its schedule, selling costs come off, and a gain over the tax-free amount is taxed at ${GAIN_RATE * 100}% (a simplification). What is left goes into regular savings at the start of that year.`);
  if (kinds.has("in") || kinds.has("out")) out.push("Money in or out once is in today's dollars and rises with prices until its year. Money in goes into regular savings; a cost comes out of savings in the usual order. Before retirement the plan counts what you save, not your pay or your bills, so a cost in a working year comes out of savings in full, as if no pay helped with it.");
  if (kinds.has("spend")) out.push("A change in spending counts from the year retirement starts; before that the plan does not count your bills.");
  if (kinds.has("move")) out.push(`Moving money: money moved out of a 401(k) or IRA is taxed as income that year, with 10% more on money of someone under 59½ (not from the 401(k) of a job left at 55 or later); ${taxMode === "brackets" ? "money moved out of an investment account is taxed on its gain, as the plan taxes a sale" : "with one simple tax rate the plan counts no tax on money moved out of an investment account, nor on what investments earn"}; money moved out of a bank account is not taxed. The tax comes out of savings in the usual order. All of an account is its part of that kind of savings today, taken from what that kind holds that year.`);
  if (fx?.goals) out.push(`Goals with a date: ${fx.goals.list.map((g) => `${g.name}, ${money(roundMoney(g.amount))} in ${g.year}`).join("; ")}. Each is what the goal costs less what you set aside for it outside your accounts and what its own monthly saving adds by then; that monthly saving is taken as money that is not also in your retirement saving. A goal due while you still work comes out of savings in full: the plan does not count pay.`);
  if (fx?.floored) out.push("A cut here is larger than the spending it comes off, so spending is taken to $0 in those years.");
  return out;
}
/** people the page can ask "who" about: those still at work in a year to come (less), everyone (after). */
export const whoWords = (p) => nameIn(p.name).replace(/^./, (c) => c.toUpperCase());

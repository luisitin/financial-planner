// modules/overview/guesses/compute.js -- PURE. "Our guesses for you": every figure the plan filled in where a box was
// left empty, the ones that matter most first, each with why and where it comes from (README.md). It also holds the
// core estimators (estimators/*.js) and the sourced tables (data/*.js) that core/app.js merges with every module's own.
//
//   estimators            the core set, by topic (debts.js in this commit; the rest arrive with spec 15's C2-C5)
//   TABLES                every bundled table by id, with its source (publisher, title, table, url, vintage, readOn)
//   LEGACY_WORDS          how the older Get started guesses are named and explained (they are read through
//                         core/estimate's LEGACY adapters, frozen: nothing here re-estimates them). An older payment is
//                         checked against the debt's rate and balance today (typicalPayment): once either has moved it
//                         is stale, leads the page and cites nothing
//   rowOf(plan, entry, o) one guess as the page shows it
//   compute(plan, { estimators, tables, today }) -> { rows, top, count, frozen, stale, applies, sources: { used, all, orgs },
//                         offers: { fill, upgrade }, lookedAt, planEmpty }
//   upgradeOffers(plan, o)  "Better guesses are ready" (spec 11.5): each older guess whose new estimate differs, old -> new
//   useNewGuesses(draft, o) / keepOldGuesses(draft, today)   the card's two buttons (guide.guessUpgrade, asked once)
//   fillOffers(plan, o)   "Fill in what you skipped" (spec 11.4, C7): the blanks an older plan has, each with our guess
//                         (FILL_CASES: a debt picked on Get started with no record; income with no spending at all; C4 and
//                         C5 add theirs). useFillGuesses(draft, o) / fillLater(draft, today): the card's two buttons
//                         (guide.fillSkipped; "Not now" returns after FILL_AGAIN_DAYS)
//   spendMissing(plan, o) "Is something missing?" (spec 11.6, E10): typed spending far below what households like this
//                         spend, with our guesses for the rows not listed. addSpendGuesses(draft, o) / spendIsComplete(draft,
//                         today): its two buttons (guide.spendComplete ends it)
//   guessCards(plan, o)   the Dashboard's cards (spec 11.3): fill, missing, goals, upgrade, which comes first, waitsMonth
//   guessTwins(plan)      "Is this the same loan?": a debt Get started guessed beside one of its kind added later
//   sameLoan(draft, id, twinId) / twoLoans(draft, id, twinId, today)   that card's two buttons (guide.setup.twins: each pair
//                         asked once)
//   profileOf             the household as the guesses read it (estimators/common.js)
//
// The import rule (spec 6.2, tests/guesses-imports in module.test.mjs): this file and estimators/*.js import core/*,
// their own data/, and nothing from overview/*.
import { guessesInUse, guessAt, estimate, applies, same, parsePath, getAt, mergeEstimators, markGuess, clearGuess, isGuess, settle } from "../../../core/estimate/index.js";
import { roundGuess } from "../../../core/math/estimate.js";
import { typicalPayment, TYPICAL_TERMS } from "../../../core/math/finance.js";
import { daysBetween } from "../../../core/math/dates.js";
import { perYear, perMonth, activeOn } from "../../../core/math/periods.js";
import { estimators as debtEstimators } from "./estimators/debts.js";
import { estimators as spendEstimators, ROWS as SPEND_ROWS, ROW_NAME, MUST, housingName, householdWords, missingSpend, spendPath, spendTenure, OFF as ROW_HOLDS, bankSpend, bankHeldWords, BANK } from "./estimators/spend.js";
import { profileOf as profileFor } from "./estimators/common.js";
import { estimators as savingEstimators, personOf } from "./estimators/saving.js";
import { money as fmtMoney } from "../../../core/format.js";
import { NameOf } from "../../../core/words.js";
import { estimators as homeEstimators } from "./estimators/home.js";
// a guessed mortgage payment kept or typed as the same figure keeps the tax and insurance it held (the view's Keep and Save)
export { escrowBefore, escrowKept } from "./estimators/home.js";
import { estimators as payEstimators } from "./estimators/pay.js";
import { estimators as goalEstimators } from "./estimators/goals.js";
import { T as SPEND } from "./data/spend.js";
import { T as BALANCES } from "./data/balances.js";
import { T as PAY } from "./data/pay.js";
import { T as DEBTS } from "./data/debts.js";
import { T as HOME } from "./data/home.js";
import { T as PURCHASE } from "./data/purchase.js";
import { T as HEALTH } from "./data/health.js";
import { T as RETIRE } from "./data/retire.js";
import { T as CELLS } from "./data/cells.js";

export const estimators = { ...payEstimators, ...homeEstimators, ...debtEstimators, ...savingEstimators, ...spendEstimators, ...goalEstimators };
export { profileOf } from "./estimators/common.js";

const FILES = { spend: SPEND, balances: BALANCES, pay: PAY, debts: DEBTS, home: HOME, purchase: PURCHASE, health: HEALTH, retire: RETIRE, cells: CELLS };
/** Every bundled table by id: its source fields plus the data file it lives in. */
export const TABLES = Object.fromEntries(Object.entries(FILES).flatMap(([file, T]) => Object.entries(T).map(([id, t]) => [id, { ...t, file }])));
const SOURCE_FIELDS = ["title", "publisher", "table", "url", "vintage", "readOn", "industry", "derived", "org", "shownBy", "tableShown", "asOf"];
const sourceOf = (id, tables = TABLES) => { const t = tables[id]; return t ? { id, ...Object.fromEntries(SOURCE_FIELDS.map((k) => [k, t[k] ?? null])) } : null; };

const L = (p, k) => (Array.isArray(p?.[k]) ? p[k] : []);
const byId = (list, id) => list.find((x) => x?.id === id) ?? null;
const near = (a, b) => typeof a === "number" && typeof b === "number" && Math.abs(a - b) < 1e-9;

// ---- the older Get started guesses (core/estimate LEGACY): what they are called, why, and the table behind each figure
const RATE_SOURCE = {
  mortgage: { id: "mortgage_rate_pmms_weekly_2026", row: "30-year fixed", why: "the average rate on a new 30-year mortgage" },
  credit: { id: "cc_apr_fed_g19", row: "Credit card plans, accounts assessed interest (commercial banks)", why: "the average rate on cards that charge interest" },
  "car-loan": { id: "auto_personal_rate_fed_g19", row: "New car loan, 72-month (commercial banks)", why: "the average bank rate on a six-year new-car loan" },
  loan: { id: "auto_personal_rate_fed_g19", row: "Personal loan, 24-month (commercial banks)", why: "the average bank rate on a two-year personal loan" },
  student: { id: "student_loan_rates_federal", row: "Direct Subsidized and Unsubsidized, undergraduate", why: "the federal rate on new undergraduate student loans" },
};
const TERM_WORDS = Object.fromEntries(Object.entries(TYPICAL_TERMS).map(([k, n]) => [k, `${n / 12} years`]));   // 30, 5, 10, 3
const NEUTRAL_RATE = "a typical rate filled in when the box was left empty";
/** Said (not "Our guess: ...") of an older payment whose rate or balance has moved since Get started worked it out. */
export const STALE_PAYMENT = "We worked this out from the rate and what you owed back then. They've changed, so type your real payment.";
const firstCell = (id, row) => TABLES[id]?.rows?.[row]?.[0] ?? null;
const legacyOrder = (k) => {
  const m = /^debt\.([^.]+)\.(rate|payment)$/.exec(k);
  if (m) return ["mortgage", "car-loan", "credit", "student", "loan"].indexOf(m[1]) * 2 + (m[2] === "payment" ? 0 : 1);
  return 20 + ["overview/setup:ss", "overview/setup:retireSpend", "overview/setup:cushionTarget", "overview/setup:cushionFunds"].indexOf(k);
};
/**
 * Words and sources for a guess Get started made before the ledger: label, why, sources, weight. us: the plan takes U.S.
 * figures (core/estimate applies); a plan that does not is told no U.S. source.
 */
export const LEGACY_WORDS = {
  rate(kind, v, { us = true } = {}) {
    const s = RATE_SOURCE[kind];
    const fits = us && s && near((firstCell(s.id, s.row) ?? NaN) / 100, v);    // the figure is the table's own: say so and cite it
    return { field: "interest rate", why: fits ? s.why : NEUTRAL_RATE, sources: fits ? [s.id] : [], weight: kind === "student" || kind === "loan" ? "small" : "big" };
  },
  /**
   * An older payment. Get started worked it out with typicalPayment from the debt's rate and balance then; it is checked
   * against them today. o: { owed, rate (the debt's today), v (the payment), rateSources (the sources of the rate when it is
   * still a guess, else null: the person's own), us }. Stale (the rate or balance moved): STALE_PAYMENT, no source.
   */
  payment(kind, { owed = null, rate = null, v = null, rateSources = null, us = true } = {}) {
    const known = typeof owed === "number" && Number.isFinite(owed) && typeof rate === "number" && Number.isFinite(rate) && typeof v === "number";
    if (known && !same(typicalPayment(kind, owed, rate), v, "month")) return { field: "payment a month", weight: "big", why: STALE_PAYMENT, sources: [], stale: true };
    const at = rateSources === null ? "your rate" : "our rate guess";
    return {
      field: "payment a month", weight: "big", stale: false,
      why: kind === "credit" ? "the month's interest plus 1% of what you owe, a usual minimum" : `what pays off what you owe over ${TERM_WORDS[kind] ?? "a usual term"} at ${at}`,
      sources: us ? [...(rateSources ?? []), ...(kind === "credit" ? ["card_minimum_payment_rule_cfpb"] : [])] : [],
    };
  },
};

/** The setup's own older guesses, named and explained even when its estimators are not in the registry passed in. */
const LEGACY_SETUP = {
  "overview/setup:ss": { label: "Social Security at full retirement age", why: "worked out from the pay on file with Social Security's formula", weight: "big" },
  "overview/setup:retireSpend": { label: "Spending a month once work stops", why: "today's bills without childcare, plus loans still running then", weight: "big" },
  "overview/setup:cushionTarget": { label: "Emergency fund to aim for", why: "months of the bills you have to pay (Assumptions says how many)", weight: "small" },
  "overview/setup:cushionFunds": { label: "Accounts that hold the emergency fund", why: "your checking, savings and cash accounts", weight: "small" },
};

/** A debt's figures in the words of Q5b's boxes and the older rows (LEGACY_WORDS). */
const DEBT_FIELD = { rate: "interest rate", owed: "still owed", payment: "payment a month" };
/** The record a path names, in plain words ("Mortgage", "Ana"), or null. */
function recordName(plan, path) {
  const segs = parsePath(path);
  const [first] = segs;
  if (first.name === "debts" && first.id) { const d = byId(L(plan, "debts"), first.id); return byId(L(plan, "accounts"), d?.accountId)?.name ?? null; }
  if (first.id && ["accounts", "expenses", "income", "goals"].includes(first.name)) return byId(L(plan, first.name), first.id)?.name ?? null;
  if (first.name === "retirement" && segs[1]?.name === "socialSecurity") { const p = byId(L(plan?.household, "people"), segs[2]?.name); return p ? p.name : null; }
  return null;
}
/** The name of the adult a retirement-account guess is for (null when it is nobody's: the household's). */
const personName = (plan, path) => { const pid = personOf(plan, path); const x = L(plan?.household, "people").find((p) => p?.id === pid && p.role !== "dependent"); return x ? x.name : null; };
const possessive = (name) => (!name || name === "Me" ? "Your" : `${name}'s`);
const kindOfUnit = (u) => (u === "rate" ? "percent" : u === "list" ? "list" : u === "age" || u === "year-date" ? "number" : "money");
const hrefOf = (path, def) => {
  const first = parsePath(path)[0].name;
  if (first === "debts") return "#/balance/liabilities";
  if (first === "accounts") return "#/balance/net-worth";
  if (first === "expenses") return "#/cashflow/expenses";
  if (first === "goals") return "#/goals/goals";
  if (path.startsWith("retirement.socialSecurity.")) return "#/retirement/social-security";
  if (path === "retirement.spendingMonthly") return "#/retirement/projection";
  try { return typeof def?.page === "function" ? def.page() : null; } catch { return null; }
};

/**
 * One guess as the page shows it. o: { estimators, tables, today }.
 * -> { path, k, label, record, value, unit, kind, why, weight, legacy, frozen, href, sources: [ids], basis, order }
 */
/** An older payment's context: the debt's balance and rate today, and the sources of the rate while it is still a guess. */
function paymentContext(plan, path, kind, o) {
  const m = /^debts\[([^\]]+)\]\.minPayment$/.exec(path);
  const row = m ? L(plan, "debts").find((d) => d?.id === m[1]) : null;
  if (!row) return {};
  const acct = byId(L(plan, "accounts"), row.accountId);
  const owed = typeof acct?.balance === "number" ? Math.abs(acct.balance) : null;
  const rate = Number(row.rate);
  const g = guessAt(plan, `debts[${row.id}].rate`);
  const us = applies(plan);
  let rateSources = null;
  if (g) {
    if (g.legacy) rateSources = LEGACY_WORDS.rate(kind, g.v, { us }).sources;
    else { let est = null; try { est = estimate(plan, g.k, { ...o, path: g.path }); } catch { est = null; } rateSources = est?.tables ?? []; }
  }
  return { owed, rate: Number.isFinite(rate) ? rate : null, rateSources, us };
}

export function rowOf(plan, e, { estimators: ests = estimators, tables = TABLES, today = null } = {}) {
  const def = own(ests, e.k) ?? null;
  const record = recordName(plan, e.path);
  const debt = /^debt\.([^.]+)\.(rate|payment)$/.exec(e.k);
  const ledgerDebt = /^debt\.[^.]+\.(rate|owed|payment)$/.exec(e.k);
  const known = own(LEGACY_SETUP, e.k);
  const us = applies(plan);
  let label = def?.label ?? known?.label ?? "A figure we filled in", why = null, sources = [], weight = def?.weight ?? known?.weight ?? "small", stale = false;
  if (e.legacy && debt) {
    const w = debt[2] === "rate" ? LEGACY_WORDS.rate(debt[1], e.v, { us }) : LEGACY_WORDS.payment(debt[1], { ...paymentContext(plan, e.path, debt[1], { estimators: ests, tables, today }), v: e.v });
    label = `${record ?? "A debt"}: ${w.field}`; why = w.why; sources = w.sources; weight = w.weight; stale = !!w.stale;
  } else if (record && def && DEBT_FIELD[ledgerDebt?.[1]]) {
    // a debt's figure reads as the older rows and Q5b's boxes do: "Credit cards: interest rate", "Car loan: still owed"
    label = `${record}: ${DEBT_FIELD[ledgerDebt[1]]}`;
  } else if (e.k === "overview/setup:ss") {
    // one possessive for both Social Security rows, the person named as a sentence names them ("Your", "Your spouse's", "Ana's";
    // fixer round 1, ssg-L-7)
    label = `${NameOf(record)} Social Security at full retirement age`;
  } else if (e.k === "overview/setup:ssPaid" && record) {
    // what Social Security pays now: "Your Social Security a month" (follow-up lane 2; the line's own name read "My Social Security"
    // beside "Your Social Security at full retirement age", ssg-L-7)
    const m = /^income\[([^\]]+)\]\.amount$/.exec(e.path), line = m ? byId(L(plan, "income"), m[1]) : null;
    const who = line?.personId ? L(plan?.household, "people").find((p) => p?.id === line.personId)?.name : undefined;
    label = who !== undefined ? `${NameOf(who)} Social Security a month` : record;
  } else if (/^account\.(retire\.balance|retire\.split|ira\.balance)$/.test(e.k) && personName(plan, e.path) !== null) {
    // the person's savings, not the account's name beside the estimator's label: "Sam's retirement savings at work" (follow-up F7)
    const who = possessive(personName(plan, e.path)), tot = plan?.guide?.setup?.taps?.["retire-joint"]?.total;
    label = e.k === "account.retire.balance" ? `${who} retirement savings at work` : e.k === "account.ira.balance" ? `${who} retirement savings on your own`
      : tot > 0 ? `${who} share of your ${fmtMoney(tot)} retirement savings` : `${who} share of your retirement savings`;
  } else if (record && /^spend\./.test(e.k)) {
    // a spending row reads as its row on Expenses: "Rent", "Home costs", "Groceries"
    label = record;
  } else if (record && def && !def.label.toLowerCase().includes(record.toLowerCase())) {
    label = `${record}: ${def.label.charAt(0).toLowerCase()}${def.label.slice(1)}`;
  } else if (record && !def && !known) {
    label = `${record}: a figure we filled in`;
  }
  const frozen = !e.legacy && !def && !known;                         // S6: the code that made it is gone
  if (!why && def) {
    let est = null;
    try { est = estimate(plan, e.k, { estimators: ests, tables, today, path: e.path }); } catch { est = null; }
    if (est && est.value !== null) { why = est.why; sources = est.tables; }
  }
  if (frozen) why = "Type the real figure; we can't update this one any more.";
  if (!why && known) why = known.why;
  if (!why) why = "what Set up my plan filled in when the box was left empty";
  // older guesses keep the setup's own order (each debt's payment then rate; people in household order)
  const segs = parsePath(e.path);
  const person = e.k === "overview/setup:ss" ? Math.max(0, L(plan?.household, "people").findIndex((x) => x.id === segs[2]?.name)) : 0;
  const order = (e.legacy || !def ? legacyOrder(e.k) : def.tier * 100 + def.order) + person / 100;
  return {
    path: e.path, k: e.k, label, record, value: e.v, unit: e.u, kind: kindOfUnit(e.u), why, weight, legacy: !!e.legacy, frozen, stale,
    // read from the person's own bank files (R12): theirs in all but name, listed apart on the page (C7 UX review 11)
    fromBank: /^your bank files\b/.test(why ?? ""),
    href: hrefOf(e.path, def), sources: us ? sources.filter((id) => tables[id]) : [], basis: def?.basis ?? (debt ? "population" : "yours"),
    order,
  };
}

// ---- "Better guesses are ready" (spec 11.5): the older Get started guesses are frozen (S5) until the person takes the new ones
const own = (o, k) => (o && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
const tierOrder = (ests, k) => { const d = own(ests, k); return d ? d.tier * 100 + d.order : 999; };
/**
 * The older guesses whose new estimate differs, in the order settle works (tier, then order), each worked out on a copy
 * of the plan that already holds the new figures before it, so a payment follows the new rate. "Differs" is judged at
 * the new figure's rounding (R11): the older card rate 22.36% is the new 22.4%, and is not offered.
 * -> [{ path, k, label, kind, unit, from, to, why, est }] ([] once answered, guide.guessUpgrade, or outside the U.S.)
 */
export function upgradeOffers(plan, o = {}) {
  if (plan?.guide?.guessUpgrade || !applies(plan)) return [];
  const ests = o.estimators ?? estimators, tables = o.tables ?? TABLES;
  const legacy = guessesInUse(plan).filter((e) => e.legacy && own(ests, e.k))
    .sort((a, b) => tierOrder(ests, a.k) - tierOrder(ests, b.k) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  if (!legacy.length) return [];
  const copy = structuredClone(plan), out = [];
  for (const e of legacy) {
    let est = null;
    try { est = estimate(copy, e.k, { estimators: ests, tables, today: o.today ?? null, path: e.path }); } catch { est = null; }
    if (!est || est.value === null || est.value === undefined) continue;
    const old = typeof e.v === "number" && est.basis !== "yours" ? roundGuess(e.v, e.u, est.sigma, est.measured) : e.v;
    if (same(est.value, e.v, e.u) || same(est.value, old, e.u)) continue;
    // never a lower retirement spending: it falls only when a re-guessed loan "ends" before work stops, and a guessed
    // mortgage payment holds the state's tax and insurance, which the payoff counts as loan (an owner question, C2
    // review UX 1: $1,300 ends in about 2044 where its $948 of loan runs to 2056). The older figure stays (spec 17.4).
    if (e.k === "overview/setup:retireSpend" && est.value < e.v) continue;
    const row = rowOf(plan, e, { estimators: ests, tables, today: o.today ?? null });
    out.push({ path: e.path, k: e.k, label: row.label, kind: row.kind, unit: e.u, from: e.v, to: est.value, why: est.why, est });
    markGuess(copy, e.path, est, o.today ?? null);
  }
  return out;
}
/** "Use the new guesses": each offer written with markGuess (the ledger entry, the older flag mirrored), in the same order, worked out on the draft itself. */
export function useNewGuesses(draft, o = {}) {
  const offers = upgradeOffers(draft, o);
  for (const x of offers) {
    let est = null;
    try { est = estimate(draft, x.k, { estimators: o.estimators ?? estimators, tables: o.tables ?? TABLES, today: o.today ?? null, path: x.path }); } catch { est = null; }
    if (est && est.value !== null) markGuess(draft, x.path, est, o.today ?? null);
  }
  draft.guide = draft.guide ?? {};
  draft.guide.guessUpgrade = { at: o.today ?? null, choice: "new" };
  return offers.length;
}
/** "Keep the old ones": nothing moves, and the card never comes back. */
export function keepOldGuesses(draft, today) {
  draft.guide = draft.guide ?? {};
  draft.guide.guessUpgrade = { at: today ?? null, choice: "kept" };
}

// ---- "Is this the same loan?" (C2 review D2): Get started keeps every debt picked, with our guess of what is owed, and
// the home Q5b asked about, with our guess of its value. A person who later adds the real loan or home on Net worth or
// Debts (the natural place) would have it counted twice.
const SETUP_OWE = /^setup-owe-|^setup-have-home$/;
const owedOf = (a) => Math.abs(Number(a?.balance) || 0);
/**
 * Get started's debts (and home) whose balance is still our guess, each beside an account of the same type the person
 * added elsewhere with a balance of their own, the pair not yet answered (guide.setup.twins[<our id>][<their id>]: a
 * "No, two loans" for a second loan, a HELOC say, still asks about the real one added later).
 * -> [{ kind: "loan" | "home", id, name, amount, twinId, twinName, twinAmount }]
 */
export function guessTwins(plan) {
  const accounts = L(plan, "accounts"), asked = plan?.guide?.setup?.twins ?? {};
  // not by type alone (C2 follow-up F4, 2026-11-07): a rental is not the home we guessed, and a car loan and another loan are told
  // apart by the name, as Get started's own existingOwe does
  const rentals = new Set(L(plan, "property").filter((x) => x?.kind === "rental").flatMap((x) => [x.accountId, x.loanAccountId]).filter(Boolean));
  const carName = (b) => /car|auto|vehicle|truck/i.test(b?.name ?? "");
  const fits = (a, b) => !rentals.has(b.id) && (a.id === "setup-owe-car-loan" ? carName(b) : a.id === "setup-owe-loan" ? !carName(b) : true);
  const out = [];
  for (const a of accounts) {
    if (typeof a?.id !== "string" || !SETUP_OWE.test(a.id) || !isGuess(plan, `accounts[${a.id}].balance`)) continue;
    const no = asked[a.id] && typeof asked[a.id] === "object" ? asked[a.id] : {};
    const twin = accounts.find((b) => b !== a && b?.type === a.type && typeof b.id === "string" && !b.id.startsWith("setup-") && !Object.prototype.hasOwnProperty.call(no, b.id) && fits(a, b) && owedOf(b) > 0 && !isGuess(plan, `accounts[${b.id}].balance`));
    if (twin) out.push({ kind: a.id === "setup-have-home" ? "home" : "loan", id: a.id, name: a.name, amount: owedOf(a), twinId: twin.id, twinName: twin.name, twinAmount: owedOf(twin) });
  }
  return out;
}
/**
 * "Yes, it's the same loan" (or home): ours goes (its account and its guessed balance). Their loan keeps its own rate and
 * payment; when it has none on Debts yet, ours move onto it under an id of its own, still marked as our guesses where
 * they were, so they follow its balance from now on (a payment typed on Get started stays as typed). A Home page entry
 * on our home moves to theirs when theirs has none. -> true when done
 */
export function sameLoan(draft, id, twinId) {
  const accounts = L(draft, "accounts"), debts = L(draft, "debts");
  const ours = accounts.find((a) => a?.id === id), theirs = accounts.find((a) => a?.id === twinId);
  if (!ours || !theirs || !SETUP_OWE.test(String(id))) return false;
  const row = debts.find((d) => d?.accountId === id), theirRow = debts.find((d) => d?.accountId === twinId);
  clearGuess(draft, `accounts[${id}].balance`);
  if (row && !theirRow && typeof row.id === "string") {
    let nid = `debt-${twinId}`;
    while (debts.some((d) => d?.id === nid)) nid = `${nid}-1`;
    const led = draft.guesses && typeof draft.guesses === "object" ? draft.guesses : null;
    for (const f of ["rate", "minPayment"]) {
      const from = `debts[${row.id}].${f}`;
      if (led && own(led, from)) { led[`debts[${nid}].${f}`] = led[from]; delete led[from]; }
    }
    row.id = nid; row.accountId = twinId;
  } else if (row) {
    for (const f of ["rate", "minPayment"]) clearGuess(draft, `debts[${row.id}].${f}`);
    draft.debts = debts.filter((d) => d !== row);
  }
  const props = L(draft, "property");
  if (!props.some((x) => x?.accountId === twinId)) for (const x of props) if (x?.accountId === id) x.accountId = twinId;
  draft.accounts = accounts.filter((a) => a !== ours);
  return true;
}
/** "No, they're two loans": both stay, and the question is not asked again for this pair (another loan added later is). */
export function twoLoans(draft, id, twinId, today) {
  draft.guide = draft.guide ?? {};
  draft.guide.setup = draft.guide.setup ?? {};
  const was = draft.guide.setup.twins?.[id];
  draft.guide.setup.twins = { ...(draft.guide.setup.twins ?? {}), [id]: { ...(was && typeof was === "object" ? was : {}), [twinId]: today ?? null } };
}

// ---- "Fill in what you skipped" (spec 11.4, C7): a plan made before the guesses has blanks Get started dropped (a debt picked
// with no balance typed) or never asked for (spending). The card lists our guess for each; nothing is written until a tap.
/** Days "Not now" keeps the card away (guide.fillSkipped = { at, choice: "later" }). */
export const FILL_AGAIN_DAYS = 30;
/** Get started's debts (setup's OWE: key, the Net worth type, the account's name; a test checks they agree). */
export const OWE_KINDS = [
  { key: "credit", type: "credit", name: "Credit cards" },
  { key: "car-loan", type: "loan", name: "Car loan" },
  { key: "student", type: "student_loan", name: "Student loans" },
  { key: "mortgage", type: "mortgage", name: "Mortgage" },
  { key: "loan", type: "loan", name: "Other loan" },
];
const setupOf = (p) => (p?.guide?.setup && typeof p.guide.setup === "object" ? p.guide.setup : {});
const isSetupId = (id) => typeof id === "string" && id.startsWith("setup-");
const carName = (a) => /car|auto|vehicle|truck/i.test(a?.name ?? "");
/** A loan's name that says it is not a car's ("Personal loan", "Student", "HELOC"). */
const notCarName = (a) => /personal|student|school|tuition|medical|dental|home|heloc|equity|furniture|boat|signature|consolidat|payday|family|401k|solar|business/i.test(a?.name ?? "");
/** Get started is past a screen: finished, or its furthest screen reached is one of these (so it will not ask again itself). */
const past = (plan, screens) => !!setupOf(plan).finishedAt || screens.includes(setupOf(plan).at);
const PAST_DEBTS = ["spend", "goals", "goal-details", "done"], PAST_SPEND = ["goals", "goal-details", "done"], PAST_GOALS = ["done"];
/** Get started's goals that take our amount when left blank (question 7b, C5): the home's down payment, the Education page's figure. */
const GOAL_FILL = { "setup-goal-home": "goal.home.target", "setup-goal-education": "goals/education:target" };
/**
 * A kind the person keeps elsewhere (setup's existingOwe: an account of its type they added on Net worth or Debts). A car loan and
 * another loan share the type (C7 review M4): any loan added stands for the one picked whatever its name ("Honda Civic", "Ally
 * loan"), unless its name says it is the other kind; with both picked, a car's name is the car loan, a name that says it is not
 * a car's is the other loan, and a name that says neither goes to the car loan first.
 */
function keptElsewhere(plan, o, picked) {
  const theirs = L(plan, "accounts").filter((a) => !isSetupId(a?.id) && a?.type === o.type);
  if (o.type !== "loan") return theirs.length > 0;
  const both = picked.includes("car-loan") && picked.includes("loan");
  if (!both) return o.key === "car-loan" ? theirs.some((a) => carName(a) || !notCarName(a)) : theirs.length > 0;
  const car = theirs.filter(carName), other = theirs.filter((a) => !carName(a) && notCarName(a)), neither = theirs.length - car.length - other.length;
  return o.key === "car-loan" ? car.length > 0 || neither > 0 : other.length > 0 || neither - (car.length ? 0 : 1) > 0;
}
/** Words a housing bill has when it is not a mortgage's payment (the home's other costs). */
const NOT_HOUSE_PAYMENT = /home costs|tax|insur|hoa|condo|associat|repair|upkeep|mainten|util|electric|water|power|gas\b|internet|clean|lawn|yard|garden|pest|security|alarm|furnit|improv|storage/i;
/** A loan payment's words that say it is a car's ("Car payment", "Toyota", "Ally auto"). */
const CAR_PAY = /\b(car|auto|vehicle|truck|toyota|honda|ford|chevy|chevrolet|gm|nissan|hyundai|kia|subaru|mazda|tesla|jeep|dodge|ram|bmw|mercedes|lexus|acura|volkswagen|vw|ally|carmax|santander)\b/i;
/**
 * A payment the person typed on Expenses for a debt Get started dropped (C7 review M5): Expenses counts it there, so it is the
 * debt's payment (written as typed, the balance worked back from it) and not a second payment beside ours. The mortgage: the
 * largest active housing bill that is not one of the home's other costs, named for the payment ("Mortgage", "House payment",
 * "Rent" from before) or at least half our guessed payment ("Wells Fargo" $1,600). A car loan: the largest bill under loan and
 * card payments, or under the car, named for a car or its maker, or under loan and card payments named for a loan when no
 * other loan was picked. -> { id, name, category, monthly } | null
 */
function typedPaymentOf(plan, key, guess, picked, today) {
  const bills = L(plan, "expenses").filter((x) => x && x.period !== "once" && Number(x.amount) > 0 && (!today || activeOn(x, today)) && !(typeof x.id === "string" && isGuess(plan, `expenses[${x.id}].amount`)))
    .map((x) => ({ id: x.id ?? null, name: x.name ?? "", category: x.category, monthly: perMonth(x.amount, x.period) })).sort((a, b) => b.monthly - a.monthly);
  if (key === "mortgage") return bills.find((b) => b.category === "housing" && !NOT_HOUSE_PAYMENT.test(b.name) && (/mortgage|house|home loan|rent/i.test(b.name) || b.monthly >= 0.5 * (guess ?? 0))) ?? null;
  if (key === "car-loan") return bills.find((b) => !/card|credit|visa|master|amex|discover|student/i.test(b.name) && ((b.category === "debt" && (CAR_PAY.test(b.name) || (!picked.includes("loan") && /loan|payment/i.test(b.name))))
    || (b.category === "transport" && CAR_PAY.test(b.name) && /payment|loan|financ|lease/i.test(b.name)))) ?? null;
  return null;
}
/** Write a record as Get started does (setup's put): one that exists gets only `asked`; a new one `full` then `asked`. */
function put(list, id, asked, full) {
  const r = list.find((x) => x?.id === id);
  if (r) { Object.assign(r, asked); return r; }
  const rec = { id, ...full, ...asked };
  list.push(rec);
  return rec;
}
const ACCOUNT = (name, type, today) => ({ name, type, institution: "", asOf: today, ownerId: "", history: [], notes: "" });
const incomeNow = (plan, today) => L(plan, "income").some((x) => x && x.period !== "once" && Number(x.amount) > 0 && (!today || activeOn(x, today)));
const allRetired = (plan) => { const a = L(plan?.household, "people").filter((x) => x?.role !== "dependent"); return a.length > 0 && a.every((x) => setupOf(plan).status?.[x.id] === "retired"); };
const guessOf = (plan, key, opts, extra) => { try { const e = estimate(plan, key, { ...opts, ...extra }); return e && typeof e.value === "number" && Number.isFinite(e.value) ? e : null; } catch { return null; } };

/**
 * The cases, in Get started's order (its debts screen, then its spending screen), each worked out from the plan as it is
 * when its turn comes (after the cases before it are written), as Get started's screens are. A case: { id, can(plan, o)
 * (cheap: is there anything to look at), find(plan, o) -> [item] (our guesses, from the plan as given), write(draft, item, o),
 * endsWhenUsed (after "Use these guesses" the case is not offered again: a debt or the spending removed later was removed on
 * purpose) }. C4 adds a retirement tile picked with no account for an adult (balance, contribution, match; the contribution
 * a question when its amount and match are both 0; not built yet); C5 a setup goal with target 0 (education, home): "goal".
 */
export const FILL_CASES = [
  {
    // a debt picked on Get started's question 5 with no record: Get started before the guesses dropped a debt whose balance
    // was left blank. The account, what is owed, the rate and the payment (E20-E32), as question 5 would write them today,
    // and with a mortgage and no home in the plan, the home's value (question 5 asks it then).
    id: "debt", endsWhenUsed: true,
    can: (plan) => {
      const picked = Array.isArray(setupOf(plan).picks?.owe) ? setupOf(plan).picks.owe : [];
      return picked.length > 0 && !picked.includes("none") && past(plan, PAST_DEBTS);
    },
    find(plan, o) {
      const s = setupOf(plan), picked = s.picks.owe, accounts = L(plan, "accounts");
      const out = [], memo = new Map();   // one pass over one plan: the household is read once
      for (const k of OWE_KINDS) {
        if (!picked.includes(k.key) || accounts.some((a) => a?.id === `setup-owe-${k.key}`) || keptElsewhere(plan, k, picked) || (k.key === "credit" && s.paidInFull)) continue;
        // its row on Debts is there without its account: it was removed on Net worth, on purpose (C7 review M6)
        if (L(plan, "debts").some((d) => d?.id === `setup-debt-${k.key}`)) continue;
        // question 5b saved it once (guide.setup.oweSaved) and its account is gone: deleted on purpose, not dropped by the older
        // Get started (fix round 1, 2026-11-11, C2 follow-up F5)
        if (Array.isArray(s.oweSaved) && s.oweSaved.includes(k.key)) continue;
        const addHome = k.key === "mortgage" && !accounts.some((a) => a?.type === "property");
        const tap = { mortgage: "mortgage-start", "car-loan": "car-loan-start" }[k.key];
        const args = { owed: null, payment: null, rate: null, ...(tap ? { start: s.taps?.[tap] ?? null } : {}), ...(addHome ? { home: null } : {}) };
        const paths = { owed: `accounts[setup-owe-${k.key}].balance`, rate: `debts[setup-debt-${k.key}].rate`, payment: `debts[setup-debt-${k.key}].minPayment`, home: "accounts[setup-have-home].balance" };
        const est = {
          owed: guessOf(plan, `debt.${k.key}.owed`, o, { path: paths.owed, args, memo }),
          rate: guessOf(plan, `debt.${k.key}.rate`, o, { path: paths.rate, args, memo }),
          payment: guessOf(plan, `debt.${k.key}.payment`, o, { path: paths.payment, args, memo }),
          home: addHome ? guessOf(plan, "home.value", o, { path: paths.home, args, memo }) : null,
        };
        if (!(est.owed?.value > 0) || !est.rate || !(est.payment?.value >= 0)) continue;
        // the payment typed on Expenses: what is owed and the rate are worked back from it (question 5 asks the payment first)
        const typed = typedPaymentOf(plan, k.key, est.payment.value, picked, o.today);
        if (typed) {
          const a2 = { ...args, payment: typed.monthly };
          const owed = guessOf(plan, `debt.${k.key}.owed`, o, { path: paths.owed, args: a2, memo: new Map() }), rate = guessOf(plan, `debt.${k.key}.rate`, o, { path: paths.rate, args: a2, memo: new Map() });
          if (owed?.value > 0 && rate) { est.owed = owed; est.rate = rate; est.payment = { ...est.payment, value: typed.monthly, typed: true }; }
        }
        out.push({ case: "debt", key: k.key, name: k.name, type: k.type, paths, est, ...(est.payment.typed ? { paidAs: typed.name, paidBy: { id: typed.id, category: typed.category } } : {}) });
      }
      return out;
    },
    write(draft, x, { today }) {
      draft.accounts = L(draft, "accounts"); draft.debts = L(draft, "debts"); draft.expenses = L(draft, "expenses");
      const id = `setup-owe-${x.key}`, did = `setup-debt-${x.key}`;
      put(draft.accounts, id, { balance: x.est.owed.value, asOf: today }, ACCOUNT(x.name, x.type, today));
      // saved, as question 5b records it (oweSaved, in question 5's order)
      const st = draft.guide?.setup;
      if (st) { const all = OWE_KINDS.map((k) => k.key).filter((k) => k === x.key || (Array.isArray(st.oweSaved) && st.oweSaved.includes(k))); if (JSON.stringify(all) !== JSON.stringify(st.oweSaved ?? null)) st.oweSaved = all; }
      // a "Rent" row typed when Get started had dropped this mortgage held the home's payment: named "Rent or mortgage", Expenses
      // files the mortgage under it and counts the payment once (as question 5 does today)
      const housing = x.key === "mortgage" ? draft.expenses.find((e) => e?.id === "setup-x-housing") : null;
      if (housing && housing.name === ROW_NAME.housing) housing.name = isGuess(draft, "expenses[setup-x-housing].amount") ? "Home costs" : "Rent or mortgage";
      // a row on Debts that is there already is the person's: never written over (C7 review M6)
      const fresh = !draft.debts.some((d) => d?.id === did);
      if (fresh) draft.debts.push({ id: did, accountId: id, extra: 0, termMonths: null, startDate: "", securedBy: "", creditLimit: null, rate: x.est.rate.value, minPayment: x.est.payment.value });
      markGuess(draft, x.paths.owed, x.est.owed, today);
      if (fresh) {
        markGuess(draft, x.paths.rate, x.est.rate, today);
        // a payment typed on Expenses stays the person's (Expenses matches it, so it is counted once)
        if (!x.est.payment.typed) markGuess(draft, x.paths.payment, x.est.payment, today);
      }
      // a car payment typed under "Car, gas and transit": Expenses ties a loan's payment to its bill only under "Loan and card
      // payments", so it would be counted twice (the bill, and the loan's payment from Debts); it moves there (C7 verify V1)
      const paidBy = x.paidBy?.id != null ? draft.expenses.find((e) => e?.id === x.paidBy.id) : null;
      if (paidBy && paidBy.category !== "debt" && paidBy.category !== "housing") paidBy.category = "debt";
      if (x.est.home?.value > 0) {
        put(draft.accounts, "setup-have-home", { balance: x.est.home.value, asOf: today }, ACCOUNT("Home", "property", today));
        markGuess(draft, x.paths.home, x.est.home, today);
        const s = draft.guide?.setup;
        if (s) {
          s.picks = s.picks ?? {};
          const have = Array.isArray(s.picks.have) ? s.picks.have : [];
          if (!have.includes("home")) { s.picks.have = [...have, "home"]; s.homeFromOwe = true; }
        }
      }
    },
  },
  {
    // income on file but nothing going out: no bill and no bank file (Get started's spending screen skipped, or a plan built on
    // its pages). Each of Get started's rows as question 6 writes it when every box is left empty (7.A; childcare only with
    // children, and only once its tap says Yes; a row typed as 0 stays the person's 0), and, for a plan made through Get
    // started with no figure for it yet, spending once work stops (overview/setup:retireSpend, the same screen's).
    id: "spend", endsWhenUsed: true,
    can: (plan, { today }) => !L(plan, "expenses").length && !L(plan, "transactions").length && incomeNow(plan, today) && (!setupOf(plan).startedAt || past(plan, PAST_SPEND)),
    find(plan, o) {
      const s = setupOf(plan);
      const zero = Array.isArray(s.spendZero) ? s.spendZero : [];
      const kids = L(plan?.household, "people").some((p) => p?.role === "dependent");
      const rows = SPEND_ROWS.filter((r) => (r !== "childcare" || kids) && !zero.includes(r));
      // the card's own questions answered on it (how health cover is had, childcare: o.taps), as question 6 asks them
      const taps = Object.fromEntries(Object.entries(o.taps ?? {}).filter(([k, v]) => SPEND_TAPS.includes(k) && typeof v === "string" && v));
      const args = { mode: "rows", rows: Object.fromEntries(rows.map((r) => [r, null])), total: null, taps };
      const memo = new Map();   // the rows are worked out together (one household spending plan, one envelope)
      const raw = rows.map((row) => { let e = null; try { e = estimate(plan, `spend.${row}`, { ...o, path: spendPath(row), args, memo }); } catch { e = null; } return { row, e }; });
      // the questions still open (question 6's taps: health cover, childcare with a child, an HOA fee in some states)
      const asks = [];
      for (const { e } of raw) if (e?.ask && !asks.some((a) => a.key === e.ask.key)) asks.push(e.ask);
      const est = raw.filter(({ e }) => e && typeof e.value === "number" && Number.isFinite(e.value) && e.value > 0).map(({ row, e }) => ({ row, est: e }));
      if (!est.length) return [];
      const later = plan?.guide?.setup && !allRetired(plan) && !(Number(plan?.retirement?.spendingMonthly) > 0) && plan?.retirement && typeof plan.retirement === "object"
        ? guessOf(plan, "overview/setup:retireSpend", o, { path: "retirement.spendingMonthly", args, memo }) : null;
      const mortgage = spendTenure(plan, profileFor(plan, null)) === "ownerWithMortgage";
      // a mortgage added on Net worth with no payment on Debts is counted nowhere yet: the spending here leaves it out, so the
      // card says so (C7 verify V2). The card's own mortgage is written before this case is worked out, with its payment.
      const accounts = L(plan, "accounts");
      const mortgageUnpaid = mortgage && !L(plan, "debts").some((d) => Number(d?.minPayment) > 0 && accounts.find((a) => a?.id === d?.accountId)?.type === "mortgage");
      return [{ case: "spend", rows: est.map((r) => ({ ...r, name: r.row === "housing" ? (mortgage ? "Home costs" : housingName(plan)) : ROW_NAME[r.row] })), retire: later && later.value > 0 ? later : null, who: householdWords(plan, { today: o.today }), mortgage, mortgageUnpaid, asks, taps }];
    },
    write(draft, x, { today }) {
      draft.expenses = L(draft, "expenses");
      const s = draft.guide?.setup;
      if (s && s.spendMode !== "rows") s.spendMode = "rows";
      // the answers given on the card are kept as question 6 keeps them (guide.setup.taps), so the rows follow them from now on
      if (Object.keys(x.taps ?? {}).length) {
        draft.guide = draft.guide ?? {};
        draft.guide.setup = draft.guide.setup ?? {};
        draft.guide.setup.taps = { ...(draft.guide.setup.taps ?? {}), ...x.taps };
      }
      for (const r of x.rows) {
        put(draft.expenses, `setup-x-${r.row}`, { amount: r.est.value }, { name: r.name, category: r.row, essential: MUST.includes(r.row), period: "monthly", inflates: true, startDate: "", endDate: "" });
        markGuess(draft, spendPath(r.row), r.est, today);
      }
      if (x.retire) {
        if (draft.retirement.spendingMonthly === undefined) draft.retirement.spendingMonthly = null;
        markGuess(draft, "retirement.spendingMonthly", x.retire, today);
      }
    },
  },
  {
    // a home or education goal Get started made on question 7b with its amount left blank: before C5 it was written as 0, and
    // the goal was counted nowhere ("no amount"). Our figure, as question 7b writes it today: goal.home.target (the typical down
    // payment) and goals/education:target (the Education page's own figure, overview/setup's estimators: the registry passed in)
    id: "goal", endsWhenUsed: true,
    can: (plan) => past(plan, PAST_GOALS) && L(plan, "goals").some((g) => GOAL_FILL[g?.id] && !(Number(g.target) > 0)),
    find(plan, o) {
      const out = [], memo = new Map();
      for (const g of L(plan, "goals")) {
        const key = GOAL_FILL[g?.id];
        if (!key || Number(g.target) > 0) continue;
        // two or more children still to start college: one goal for each, its own figure and start, as question 7b writes
        // them (critics M2 and person 2): the first child's in the Education goal, renamed; the others' added
        if (g.id === "setup-goal-education") {
          const kids = L(plan?.household, "people").filter((k) => k?.role === "dependent" && k.id && /^\d{4}/.test(k.birthDate ?? ""))
            .map((k) => ({ k, est: guessOf(plan, key, o, { path: `goals[setup-goal-education-${k.id}].target`, args: { childId: k.id }, memo }) })).filter((x) => x.est?.value > 0);
          if (kids.length > 1) {
            kids.forEach(({ k, est }, i) => {
              const id = i ? `setup-goal-education-${k.id}` : g.id, start = Number(k.birthDate.slice(0, 4)) + (Number(plan?.whatIfs?.college?.[k.id]?.startAge) || 18);
              out.push({ case: "goal", id, name: `${String(k.name || "Your child")}'s college`, path: `goals[${id}].target`, est, split: { date: `${start}-08-15`, add: i > 0 } });
            });
            continue;
          }
        }
        const path = `goals[${g.id}].target`, est = guessOf(plan, key, o, { path, memo });
        if (!(est?.value > 0)) continue;
        out.push({ case: "goal", id: g.id, name: String(g.name || "Goal"), path, est });
      }
      return out;
    },
    write(draft, x, { today }) {
      if (x.split?.add && !L(draft, "goals").some((y) => y?.id === x.id)) {
        const first = L(draft, "goals").find((y) => y?.id === "setup-goal-education");
        if (!first || (Number(first.target) > 0 && !isGuess(draft, "goals[setup-goal-education].target"))) return;   // typed since: one goal, the person's
        draft.goals.push({ id: x.id, name: x.name, icon: first.icon ?? "🎓", target: 0, targetDate: x.split.date, priority: 2, saved: 0, fundedBy: [], monthly: 0, rate: null, inflates: true });
      }
      const g = L(draft, "goals").find((y) => y?.id === x.id);
      if (!g || Number(g.target) > 0) return;   // an amount typed since: the person's
      if (x.split) {
        // the Education goal becomes the first child's (its date that child's start); Get started's eduSplit tells the
        // estimator which child the Education goal is for, so settle keeps it on that child's figure
        if (g.name !== x.name) g.name = x.name;
        if (g.targetDate !== x.split.date) g.targetDate = x.split.date;
        draft.guide = draft.guide ?? {}; draft.guide.setup = draft.guide.setup ?? {};
        if (draft.guide.setup.eduSplit !== true) draft.guide.setup.eduSplit = true;
      }
      markGuess(draft, x.path, x.est, today);
    },
  },
];

/** "Not now" was tapped under FILL_AGAIN_DAYS ago (a day that is not a date asks again). */
export function fillWaits(plan, today) {
  const f = plan?.guide?.fillSkipped;
  if (!f || typeof f !== "object" || f.choice !== "later") return false;
  const d = typeof f.at === "string" && today ? daysBetween(f.at, today) : null;
  return d !== null && d >= 0 && d < FILL_AGAIN_DAYS;
}
/** Work the cases out in order on `target` and write them into it; the plan after each case is the next one's (settled, as the
 *  store settles after each of Get started's screens). -> [item] */
function runFill(target, o = {}) {
  const today = o.today ?? null;
  const opts = { estimators: o.estimators ?? estimators, tables: o.tables ?? TABLES, today };
  if (!applies(target) || (!o.ignoreLater && fillWaits(target, today))) return [];
  const used = target?.guide?.fillSkipped?.choice === "used";
  const items = [];
  for (const c of FILL_CASES) {
    if ((o.only && c.id !== o.only) || (used && c.endsWhenUsed) || !c.can(target, { ...opts, taps: o.taps })) continue;
    if (items.length) settle(target, opts);
    const found = c.find(structuredClone(target), { ...opts, taps: o.taps });
    for (const x of found) c.write(target, x, opts);
    items.push(...found);
  }
  return items;
}
/** One item as the card shows it (no Estimate objects): the figures and why-lines. */
function fillShown(x) {
  if (x.case === "debt") return { case: "debt", key: x.key, name: x.name, owed: x.est.owed.value, rate: x.est.rate.value, payment: x.est.payment.value, paidAs: x.paidAs ?? null, paidUnder: x.paidBy?.category ?? null, home: x.est.home?.value > 0 ? x.est.home.value : null, why: x.est.owed.why };
  // (with a mortgage, the home's row is its upkeep: its tax and insurance are in the mortgage's payment; C7 UX review 4)
  if (x.case === "spend") return { case: "spend", rows: x.rows.map((r) => ({ row: r.row, name: r.name, label: r.row === "housing" && x.mortgage ? "Home upkeep" : r.name, value: r.est.value, why: r.est.why })), total: x.rows.reduce((t, r) => t + r.est.value, 0), retire: x.retire?.value ?? null, who: x.who, mortgage: !!x.mortgage, mortgageUnpaid: !!x.mortgageUnpaid, asks: x.asks ?? [], taps: x.taps ?? {} };
  if (x.case === "goal") return { case: "goal", id: x.id, name: x.name, value: x.est.value, why: x.est.why };
  return { case: x.case };
}
/** The card's answers (o.taps) that a question it shows may take: question 6's one-tap answers. */
const SPEND_TAPS = ["health-cover", "childcare", "hoa"];
/**
 * "Fill in what you skipped": what one tap would write, worked out on a copy (nothing is written). o: { estimators, tables, today,
 * taps (the card's own answers: health cover, childcare, HOA), only (one case id: Expenses offers the spending alone),
 * ignoreLater (the guesses page lists what "Not now" put off) }.
 * [] once answered for now (guide.fillSkipped "later", for FILL_AGAIN_DAYS), outside the U.S., or with nothing to fill.
 * -> [{ case: "goal", id, name, value, why } (a home or education goal left at 0 on Get started)
 *     | { case: "debt", key, name, owed, rate, payment, paidAs (the bill typed on Expenses that is its payment), paidUnder (that bill's
 *       kind: a car payment under "Car, gas and transit" moves under "Loan and card payments" with the tap), home, why }
 *     | { case: "spend", rows: [{ row, name, label, value, why }], total, retire, who, mortgage (a mortgage's payment is counted
 *       from Debts, so the home's row is its upkeep), mortgageUnpaid (a mortgage with no payment on Debts: counted nowhere yet),
 *       asks: [question 6's taps still open], taps (the answers given) }]
 */
export function fillOffers(plan, o = {}) {
  return runFill(structuredClone(plan), o).map(fillShown);
}
/** What the card's tap changes beside the spending: what is owed and the home added, what you own minus what you owe moves by,
 *  and the spending a month counted. -> { owed, home, net, spend } */
export function fillEffect(items) {
  const owed = items.filter((x) => x.case === "debt").reduce((t, x) => t + x.owed, 0), home = items.filter((x) => x.case === "debt").reduce((t, x) => t + (x.home ?? 0), 0);
  return { owed, home, net: home - owed, spend: items.find((x) => x.case === "spend")?.total ?? 0 };
}
/** "Use these guesses": the same figures, written with markGuess on the draft; guide.fillSkipped = { at, choice: "used" } (not when
 *  one case alone is taken, `only`: Expenses' spending card, whose case ends on its own once the rows are there). -> how many items */
export function useFillGuesses(draft, o = {}) {
  const items = runFill(draft, o);
  if (o.only) return items.length;
  draft.guide = draft.guide ?? {};
  draft.guide.fillSkipped = { at: o.today ?? null, choice: "used" };
  return items.length;
}
/** "Not now": nothing is written but the answer; the card comes back after FILL_AGAIN_DAYS. */
export function fillLater(draft, today) {
  draft.guide = draft.guide ?? {};
  draft.guide.fillSkipped = { at: today ?? null, choice: "later" };
}

// ---- "Is something missing?" (spec 11.6, E10)
const libFor = (plan, opts) => { const memo = new Map(); return { today: opts.today, memo: (n, f) => { if (!memo.has(n)) memo.set(n, f()); return memo.get(n); }, estimate: (k, o2 = {}) => estimate(plan, k, { ...opts, memo, ...o2 }) }; };
/**
 * Typed spending far below what households like this spend (estimators/spend.js missingSpend: every row typed, under 0.56 of
 * the household's guessed total, no bank files of two whole months, not answered "That's everything"), with our guesses for
 * Get started's rows that have no bill of their kinds, worked out together (one envelope, so the settle after writing moves
 * nothing). -> { typed, usual, rows: [{ row, name, value, est }], rest (their total) } | null
 */
export function spendMissing(plan, o = {}) {
  const opts = { estimators: o.estimators ?? estimators, tables: o.tables ?? TABLES, today: o.today ?? null };
  if (!opts.today || !applies(plan)) return null;
  let m = null;
  try { m = missingSpend(plan, { today: opts.today, ignoreComplete: !!o.ignoreComplete }, libFor(plan, opts)); } catch { m = null; }
  if (!m) return null;
  const typedRows = Object.fromEntries(L(plan, "expenses").filter((x) => typeof x?.id === "string" && x.id.startsWith("setup-x-") && SPEND_ROWS.includes(x.id.slice(8)))
    .map((x) => [x.id.slice(8), perMonth(x.amount, x.period)]));
  const args = { mode: "rows", rows: { ...typedRows, ...Object.fromEntries(m.rest.map((r) => [r, null])) }, total: null, taps: {} };
  const mortgage = spendTenure(plan, profileFor(plan, null)) === "ownerWithMortgage";
  const memo = new Map();
  // what is listed already under a row's other kinds (the phones under "Utilities and phone"): the row is offered less it
  const bills = L(plan, "expenses").filter((x) => !(typeof x?.id === "string" && x.id.startsWith("setup-x-")) && (!opts.today || activeOn(x, opts.today)));
  const listedIn = (row) => bills.filter((x) => (ROW_HOLDS[row] ?? []).includes(x?.category)).reduce((t, x) => t + perMonth(x.amount, x.period), 0);
  const rows = m.rest.map((row) => ({ row, name: row === "housing" ? (mortgage ? "Home costs" : housingName(plan)) : ROW_NAME[row], est: guessOf(plan, `spend.${row}`, opts, { path: spendPath(row), args, memo }) }))
    .filter((r) => r.est && r.est.value > 0).map((r) => ({ ...r, value: r.est.value, listed: listedIn(r.row) }));
  const rest = rows.reduce((t, r) => t + r.value, 0);
  return { typed: m.typed, usual: m.guessedTotal, rows, rest, withThese: m.typed + rest };
}
/** "Add our guesses for the rest": those rows, as Get started writes them, marked as our guesses. -> how many */
export function addSpendGuesses(draft, o = {}) {
  const miss = spendMissing(draft, o);
  if (!miss) return 0;
  draft.expenses = L(draft, "expenses");
  for (const r of miss.rows) {
    put(draft.expenses, `setup-x-${r.row}`, { amount: r.value }, { name: r.name, category: r.row, essential: MUST.includes(r.row), period: "monthly", inflates: true, startDate: "", endDate: "" });
    markGuess(draft, spendPath(r.row), r.est, o.today ?? null);
  }
  return miss.rows.length;
}
/** "That's everything": the list is the person's whole month, and the question ends (guide.spendComplete). */
export function spendIsComplete(draft, today) {
  draft.guide = draft.guide ?? {};
  draft.guide.spendComplete = today ?? null;
}
/** "Ask me again" (Expenses, after "That's everything"): the question comes back while it applies. */
export function spendAskAgain(draft) {
  if (draft?.guide && typeof draft.guide === "object") delete draft.guide.spendComplete;
}
/** "That's everything" was said and the list is still far below the usual total: Expenses offers to ask again. */
export const spendSaidComplete = (plan, o = {}) => !!plan?.guide?.spendComplete && !!spendMissing(plan, { ...o, ignoreComplete: true });
/**
 * Why the bank files set no spending row yet, while a row is still our survey guess (R12 held: a card's file missing, a card in
 * no file, lines with no kind, no checking file, files over a year old): estimators/spend.js bankHeldWords. -> { text, link } | null
 */
export function spendBankNote(plan, o = {}) {
  if (!o.today || !applies(plan) || !L(plan, "transactions").length) return null;
  const led = plan?.guesses && typeof plan.guesses === "object" ? plan.guesses : {};
  const ours = L(plan, "expenses").some((x) => typeof x?.id === "string" && x.id.startsWith("setup-x-") && isGuess(plan, `expenses[${x.id}].amount`) && led[`expenses[${x.id}].amount`]?.s !== BANK.sigma);
  if (!ours) return null;
  const kids = L(plan?.household, "people").some((p) => p?.role === "dependent");
  try { return bankHeldWords(plan, bankSpend(plan, o.today, { rows: kids ? SPEND_ROWS : SPEND_ROWS.filter((r) => r !== "childcare") })); } catch { return null; }
}

/**
 * The Dashboard's cards about our guesses (spec 11.3): "Fill in what you skipped", "Is something missing?" and "Better guesses
 * are ready", each only while it has something; `first` is the one the Dashboard shows (one at a time, in that order: the
 * blanks that leave a figure out, then the list that is far too short, then the older figures). -> { fill, missing, upgrade,
 * first } | null when none applies. o: { estimators, tables, today } (the registry merged from every module).
 */
export function guessCards(plan, o = {}) {
  if (!o.today) return null;
  const merged = o.estimators ? { estimators: o.estimators, tables: o.tables ?? TABLES } : { estimators, tables: TABLES };
  const opts = { ...merged, today: o.today };
  let fill = [], missing = null, upgrade = [];
  try { fill = fillOffers(plan, opts); } catch { fill = []; }
  try { const m = spendMissing(plan, opts); missing = m ? { typed: m.typed, usual: m.usual, rows: m.rows.map(({ est, ...r }) => r), rest: m.rest } : null; } catch { missing = null; }
  try { upgrade = upgradeOffers(plan, opts).map(({ est, ...x }) => x); } catch { upgrade = []; }
  // a goal's amount does not change the left-over: a card with only goals on it never makes the month or retirement wait
  // (critic person 1, C5: an older plan's Education goal at $0 read "Depends on what you owe"). Those go in `goals` and
  // `first` is "goals"; the Dashboard's waiting card ("fill") is for spending and debts. waitsMonth: the month waits on a card.
  const goals = fill.filter((x) => x.case === "goal");
  if (goals.length === fill.length) fill = [];
  const first = fill.length ? "fill" : missing?.rows.length ? "missing" : goals.length ? "goals" : upgrade.length ? "upgrade" : null;
  return first ? { fill, ...(fill.length ? { fillEffect: fillEffect(fill) } : {}), missing, upgrade, ...(goals.length ? { goals } : {}), first, waitsMonth: first === "fill" || first === "missing" } : null;
}

/** Where the real figures of a card's items are typed, in words: "on Expenses and Debts", "on Goals" (critic person 1). */
export function typeWhere(items) {
  const pages = [["spend", "Expenses"], ["debt", "Debts"], ["goal", "Goals"]].filter(([k]) => (items ?? []).some((x) => x?.case === k)).map(([, w]) => w);
  if (!pages.length) return "on Expenses and Debts";
  return `on ${pages.length > 1 ? `${pages.slice(0, -1).join(", ")} and ${pages[pages.length - 1]}` : pages[0]}`;
}

const planEmpty = (plan) => !L(plan?.household, "people").length && !L(plan, "accounts").length && !L(plan, "income").length && !L(plan, "expenses").length;

/**
 * The page: every guess still in use (ledger and older flags), a frozen one first, then the big ones, then the rest;
 * the sources behind them and all the tables on hand. params: { estimators, tables } (the merged registry from every
 * module; this module's own when absent), today. offers.upgrade is the "Better guesses are ready" card (spec 11.5, C2);
 * offers.fill the "Fill in what you skipped" card (11.4, C7: fillOffers).
 */
export function compute(plan, params = {}) {
  const merged = params.estimators ? { estimators: params.estimators, tables: params.tables ?? TABLES } : mergeEstimators([{ from: "overview/guesses", estimators, tables: TABLES }]);
  const o = { estimators: merged.estimators, tables: merged.tables, today: params.today ?? null };
  // a frozen guess (S6) and a stale older payment lead: both ask for the real figure
  const first = (r) => (r.frozen || r.stale ? 1 : 0);
  // one row per person's Social Security: when the monthly payment is our guess, the full-retirement-age figure behind it is not shown again
  const inUse = guessesInUse(plan);
  const paidOurs = new Set(inUse.filter((e) => e.k === "overview/setup:ssPaid")
    .map((e) => { const m = /^income\[([^\]]+)\]\.amount$/.exec(e.path); return m ? byId(L(plan, "income"), m[1])?.personId : null; }).filter(Boolean));
  const rows = inUse.filter((e) => getAt(plan, e.path) !== undefined)
    .filter((e) => !(e.k === "overview/setup:ss" && paidOurs.has(/^retirement\.socialSecurity\.([^.]+)\.monthlyAtFRA$/.exec(e.path)?.[1])))
    .map((e) => rowOf(plan, e, o))
    .sort((a, b) => (b.frozen - a.frozen) || (b.stale - a.stale) || ((a.weight === "big" ? 0 : 1) - (b.weight === "big" ? 0 : 1)) || a.order - b.order || (a.path < b.path ? -1 : 1));
  const ours = rows.filter((r) => !r.fromBank);
  const waits = fillWaits(plan, o.today);
  const skipped = waits ? fillOffers(plan, { ...o, ignoreLater: true }) : [];
  const used = [...new Set(rows.flatMap((r) => r.sources))];
  const twins = guessTwins(plan);
  const all = Object.keys(o.tables).map((id) => sourceOf(id, o.tables)).filter(Boolean);
  return {
    rows, top: ours.filter((r) => !r.frozen && !r.stale).slice(0, 3), count: rows.length, frozen: rows.filter((r) => r.frozen).length, stale: rows.filter((r) => r.stale).length,
    big: ours.filter((r) => r.weight === "big" || first(r)), small: ours.filter((r) => r.weight !== "big" && !first(r)), bank: rows.filter((r) => r.fromBank),
    applies: applies(plan),
    sources: { used: used.map((id) => sourceOf(id, o.tables)).filter(Boolean), all, orgs: new Set(all.map((x) => x.org ?? x.publisher)).size },
    // "Fill in what you skipped" (C7) and "Better guesses" list what one tap would write (nothing written until then)
    // "Is this the same loan?" only while one is to ask (the key is absent otherwise, so older plans compute as before)
    offers: { fill: fillOffers(plan, o), upgrade: upgradeOffers(plan, o).map(({ est, ...x }) => x), ...(twins.length ? { twins } : {}), ...(skipped.length ? { skipped } : {}) },
    // why two months of bank files set no spending row yet (R12 held), while a row is our survey guess
    bankNote: spendBankNote(plan, o),
    lookedAt: plan?.guide?.guessesLookedAt ?? null,
    planEmpty: planEmpty(plan),
  };
}

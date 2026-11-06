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
//   guessTwins(plan)      "Is this the same loan?": a debt Get started guessed beside one of its kind added later
//   sameLoan(draft, id, twinId) / twoLoans(draft, id, twinId, today)   that card's two buttons (guide.setup.twins: each pair
//                         asked once)
//   profileOf             the household as the guesses read it (estimators/common.js)
//
// The import rule (spec 6.2, tests/guesses-imports in module.test.mjs): this file and estimators/*.js import core/*,
// their own data/, and nothing from overview/*.
import { guessesInUse, guessAt, estimate, applies, same, parsePath, getAt, mergeEstimators, markGuess, clearGuess, isGuess } from "../../../core/estimate/index.js";
import { roundGuess } from "../../../core/math/estimate.js";
import { typicalPayment, TYPICAL_TERMS } from "../../../core/math/finance.js";
import { estimators as debtEstimators } from "./estimators/debts.js";
import { estimators as spendEstimators } from "./estimators/spend.js";
import { estimators as savingEstimators } from "./estimators/saving.js";
import { estimators as homeEstimators } from "./estimators/home.js";
import { estimators as payEstimators } from "./estimators/pay.js";
import { estimators as goalEstimators } from "./estimators/goals.js";
import { T as SPEND } from "./data/spend.js";
import { T as BALANCES } from "./data/balances.js";
import { T as PAY } from "./data/pay.js";
import { T as DEBTS } from "./data/debts.js";
import { T as HOME } from "./data/home.js";
import { T as HEALTH } from "./data/health.js";
import { T as RETIRE } from "./data/retire.js";

export const estimators = { ...payEstimators, ...homeEstimators, ...debtEstimators, ...savingEstimators, ...spendEstimators, ...goalEstimators };
export { profileOf } from "./estimators/common.js";

const FILES = { spend: SPEND, balances: BALANCES, pay: PAY, debts: DEBTS, home: HOME, health: HEALTH, retire: RETIRE };
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
  "overview/setup:cushionTarget": { label: "Safety cushion to aim for", why: "months of your must-pay bills (Assumptions says how many)", weight: "small" },
  "overview/setup:cushionFunds": { label: "Accounts that hold the cushion", why: "your checking, savings and cash accounts", weight: "small" },
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
    label = `${possessive(record)} Social Security at full retirement age`;
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
  if (!why) why = "what Get started filled in when the box was left empty";
  // older guesses keep the setup's own order (each debt's payment then rate; people in household order)
  const segs = parsePath(e.path);
  const person = e.k === "overview/setup:ss" ? Math.max(0, L(plan?.household, "people").findIndex((x) => x.id === segs[2]?.name)) : 0;
  const order = (e.legacy || !def ? legacyOrder(e.k) : def.tier * 100 + def.order) + person / 100;
  return {
    path: e.path, k: e.k, label, record, value: e.v, unit: e.u, kind: kindOfUnit(e.u), why, weight, legacy: !!e.legacy, frozen, stale,
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
  const out = [];
  for (const a of accounts) {
    if (typeof a?.id !== "string" || !SETUP_OWE.test(a.id) || !isGuess(plan, `accounts[${a.id}].balance`)) continue;
    const no = asked[a.id] && typeof asked[a.id] === "object" ? asked[a.id] : {};
    const twin = accounts.find((b) => b !== a && b?.type === a.type && typeof b.id === "string" && !b.id.startsWith("setup-") && !Object.prototype.hasOwnProperty.call(no, b.id) && owedOf(b) > 0 && !isGuess(plan, `accounts[${b.id}].balance`));
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

const planEmpty = (plan) => !L(plan?.household, "people").length && !L(plan, "accounts").length && !L(plan, "income").length && !L(plan, "expenses").length;

/**
 * The page: every guess still in use (ledger and older flags), a frozen one first, then the big ones, then the rest;
 * the sources behind them and all the tables on hand. params: { estimators, tables } (the merged registry from every
 * module; this module's own when absent), today. offers.upgrade is the "Better guesses are ready" card (spec 11.5, C2);
 * offers.fill (11.4) arrives with C7: empty here.
 */
export function compute(plan, params = {}) {
  const merged = params.estimators ? { estimators: params.estimators, tables: params.tables ?? TABLES } : mergeEstimators([{ from: "overview/guesses", estimators, tables: TABLES }]);
  const o = { estimators: merged.estimators, tables: merged.tables, today: params.today ?? null };
  // a frozen guess (S6) and a stale older payment lead: both ask for the real figure
  const first = (r) => (r.frozen || r.stale ? 1 : 0);
  const rows = guessesInUse(plan).filter((e) => getAt(plan, e.path) !== undefined).map((e) => rowOf(plan, e, o))
    .sort((a, b) => (b.frozen - a.frozen) || (b.stale - a.stale) || ((a.weight === "big" ? 0 : 1) - (b.weight === "big" ? 0 : 1)) || a.order - b.order || (a.path < b.path ? -1 : 1));
  const used = [...new Set(rows.flatMap((r) => r.sources))];
  const twins = guessTwins(plan);
  const all = Object.keys(o.tables).map((id) => sourceOf(id, o.tables)).filter(Boolean);
  return {
    rows, top: rows.filter((r) => !r.frozen && !r.stale).slice(0, 3), count: rows.length, frozen: rows.filter((r) => r.frozen).length, stale: rows.filter((r) => r.stale).length,
    big: rows.filter((r) => r.weight === "big" || first(r)), small: rows.filter((r) => r.weight !== "big" && !first(r)),
    applies: applies(plan),
    sources: { used: used.map((id) => sourceOf(id, o.tables)).filter(Boolean), all, orgs: new Set(all.map((x) => x.org ?? x.publisher)).size },
    // "Fill in what you skipped" arrives with C7; the "Better guesses" card here lists old -> new (nothing written until a tap)
    // "Is this the same loan?" only while one is to ask (the key is absent otherwise, so older plans compute as before)
    offers: { fill: [], upgrade: upgradeOffers(plan, o).map(({ est, ...x }) => x), ...(twins.length ? { twins } : {}) },
    lookedAt: plan?.guide?.guessesLookedAt ?? null,
    planEmpty: planEmpty(plan),
  };
}

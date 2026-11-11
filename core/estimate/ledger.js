// core/estimate/ledger.js -- PURE. The ledger of guesses: `plan.guesses[path] = { k, v, u, s, at, d }` (docs/DATA_MODEL.md
// `guesses`, docs/CONVENTIONS.md "Guesses"). A guess is an ordinary value in its field plus one entry here; the field
// counts as a guess only while it still equals `v` (per unit: rates within 1e-9, money within half a cent).
//
//   TOLERANCE, same(a, b, unit)                     is the field still the guess?
//   guessAt(plan, path) / isGuess(plan, path)       the guess on a field, while it is one
//   guessesInUse(plan)                              every guess still in use: the ledger, plus the older setup flags
//                                                   read through the LEGACY adapters (legacy: true, frozen)
//   guessesTouching(plan, sections, { weights })    those whose path starts in one of `sections`
//   markGuess(draft, path, est, today)              write a guess: the field and its entry (the only writer, with saveField)
//   clearGuess(draft, path) / confirmGuess          the person typed it, kept it ("That's about right") or removed it
//   saveField(draft, path, read, est, today)        the one call a page makes when it saves a box that may hold a guess
//   LEGACY                                          the five older flags, read as frozen guesses and kept in step
//
// `plan.guesses` is optional: not in emptyPlan(), read as `plan.guesses ?? {}`, deleted when it empties, so a plan whose
// guesses were all typed over has exactly the shape of one that never had any.
import { parsePath, getAt, setAt, canonical } from "./paths.js";

export const TOLERANCE = { rate: 1e-9, month: 0.005, year: 0.005, total: 0.005, age: 0, "year-date": 0 };

/** Numbers: |a - b| <= TOLERANCE[unit] (0 for any other unit); strings: ===; anything else (a list): JSON equality. */
export function same(a, b, unit) {
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= (TOLERANCE[unit] ?? 0);
  if (typeof a === "string" || typeof b === "string") return a === b;
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

const L = (p, k) => (Array.isArray(p?.[k]) ? p[k] : []);
/**
 * A ledger entry worth reading (an import or a hand edit may hold anything): a plain object with a string estimator key
 * and a value markGuess could have written, a finite number or a list. Anything else is not a guess, so settle never
 * fills a blank field (v null) or writes a figure into a field that never held one (v a word).
 */
export const isEntry = (e) => !!e && typeof e === "object" && !Array.isArray(e) && typeof e.k === "string" && e.k !== ""
  && ((typeof e.v === "number" && Number.isFinite(e.v)) || Array.isArray(e.v));
/** The ledger as a plain object: `plan.guesses` when it is one, else {} (a word, a number or a list there is no ledger). */
export const ledgerOf = (plan) => { const g = plan?.guesses; return g && typeof g === "object" && !Array.isArray(g) ? g : {}; };
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const setupOf = (p) => p?.guide?.setup ?? {};
const safePath = (path) => { try { parsePath(path); return true; } catch { return false; } };
const DEBT_KIND = { credit: "credit", mortgage: "mortgage", student_loan: "student", loan: "loan" };
/** A debt row's kind for its estimator key: the setup's own id says it, else the liability account's type. */
export function debtKind(plan, row) {
  const m = /^setup-debt-(.+)$/.exec(row?.id ?? "");
  if (m) return m[1];
  const acct = L(plan, "accounts").find((a) => a.id === row?.accountId);
  return DEBT_KIND[acct?.type] ?? "loan";
}
/**
 * A guess on a debt row whose loan account is gone: Net worth's Delete removes the account and keeps its `debts` row, so the
 * row's guesses would stay listed on Our guesses and the done screen (C2 follow-up F2, 2026-11-07). A row with no accountId is
 * not one of these (nothing to have lost). -> boolean
 */
export function orphanDebt(plan, path) {
  const m = /^debts\[([^\]]+)\]\./.exec(path ?? "");
  if (!m) return false;
  const row = L(plan, "debts").find((d) => d?.id === m[1]);
  return !!row?.accountId && !L(plan, "accounts").some((a) => a?.id === row.accountId);
}
const debtRowOf = (plan, path) => { const m = /^debts\[([^\]]+)\]\.(rate|minPayment)$/.exec(path); return m ? { row: L(plan, "debts").find((d) => d.id === m[1]), field: m[2] } : null; };
const CUSHION = "setup-goal-cushion";

/**
 * The older guesses Get started already writes (before the ledger existed). Each reads its flag as synthetic entries
 * { path, k, v, u } (match), says which paths it owns (owns), and keeps its flag in step when the ledger writes or
 * clears that path (mirror: value -> the guess was written; undefined -> it is the person's now). Settle never
 * re-estimates them: they stay as they are until the person takes the new figures (the "Better guesses" card).
 */
export const LEGACY = [
  {
    id: "rateGuessed",
    match: (plan) => L(plan, "debts").filter((d) => typeof d?.rateGuessed === "number" && safePath(`debts[${d.id}].rate`))
      .map((d) => ({ path: `debts[${d.id}].rate`, k: `debt.${debtKind(plan, d)}.rate`, v: d.rateGuessed, u: "rate" })),
    owns: (path) => /^debts\[[^\]]+\]\.rate$/.test(path),
    mirror(draft, path, value) {
      const { row } = debtRowOf(draft, path) ?? {};
      if (!row) return false;
      if (value === undefined) { if (!("rateGuessed" in row)) return false; delete row.rateGuessed; return true; }
      if (row.rateGuessed === value) return false;
      row.rateGuessed = value; return true;
    },
  },
  {
    id: "paymentGuessed",
    match: (plan) => L(plan, "debts").filter((d) => typeof d?.paymentGuessed === "number" && safePath(`debts[${d.id}].minPayment`))
      .map((d) => ({ path: `debts[${d.id}].minPayment`, k: `debt.${debtKind(plan, d)}.payment`, v: d.paymentGuessed, u: "month" })),
    owns: (path) => /^debts\[[^\]]+\]\.minPayment$/.test(path),
    mirror(draft, path, value) {
      const { row } = debtRowOf(draft, path) ?? {};
      if (!row) return false;
      if (value === undefined) { if (!("paymentGuessed" in row)) return false; delete row.paymentGuessed; return true; }
      if (row.paymentGuessed === value) return false;
      row.paymentGuessed = value; return true;
    },
  },
  {
    id: "ssWrote",
    // the figure the setup's estimate last wrote; a pasted ssa.gov record is the person's own and never a guess
    match: (plan) => Object.entries(setupOf(plan).ssWrote ?? {})
      .filter(([pid, n]) => typeof n === "number" && safePath(`retirement.socialSecurity.${pid}.monthlyAtFRA`) && !L(plan?.retirement?.socialSecurity?.[pid], "record").length)
      .map(([pid, n]) => ({ path: `retirement.socialSecurity.${pid}.monthlyAtFRA`, k: "overview/setup:ss", v: n, u: "month" })),
    owns: (path) => /^retirement\.socialSecurity\.[^.]+\.monthlyAtFRA$/.test(path),
    mirror(draft, path, value) {
      const pid = path.split(".")[2];
      const s = draft?.guide?.setup;
      if (value === undefined) { if (!s?.ssWrote || !(pid in s.ssWrote)) return false; delete s.ssWrote[pid]; return true; }
      if (!s) return false;
      if (s.ssWrote?.[pid] === value) return false;
      s.ssWrote = { ...(s.ssWrote ?? {}), [pid]: value }; return true;
    },
  },
  {
    id: "retireAuto",
    // the screen's own starting figure, which follows the bills; the flag holds no figure, so the guess is today's value
    match: (plan) => (setupOf(plan).retireAuto === true && typeof plan?.retirement?.spendingMonthly === "number" && plan.retirement.spendingMonthly > 0
      ? [{ path: "retirement.spendingMonthly", k: "overview/setup:retireSpend", v: plan.retirement.spendingMonthly, u: "month" }] : []),
    owns: (path) => path === "retirement.spendingMonthly",
    mirror(draft, path, value) {
      const s = draft?.guide?.setup;
      if (!s) return false;
      const want = value !== undefined;
      if ((s.retireAuto === true) === want) return false;
      s.retireAuto = want; return true;
    },
  },
  {
    id: "cushion",
    // the safety-cushion goal's amount and accounts as the setup last wrote them (cushionTarget null: the person's own)
    match: (plan) => {
      const g = L(plan, "goals").find((x) => x.id === CUSHION), s = setupOf(plan), out = [];
      if (!g) return out;
      if (typeof s.cushionTarget === "number") out.push({ path: `goals[${CUSHION}].target`, k: "overview/setup:cushionTarget", v: s.cushionTarget, u: "total" });
      if (Array.isArray(s.cushionFunds)) out.push({ path: `goals[${CUSHION}].fundedBy`, k: "overview/setup:cushionFunds", v: s.cushionFunds, u: "list" });
      return out;
    },
    owns: (path) => path === `goals[${CUSHION}].target` || path === `goals[${CUSHION}].fundedBy`,
    mirror(draft, path, value) {
      const s = draft?.guide?.setup;
      if (!s) return false;
      if (path.endsWith(".target")) {
        const want = value === undefined ? null : value;
        if (s.cushionTarget === want) return false;
        s.cushionTarget = want; return true;
      }
      if (value === undefined) { if (!("cushionFunds" in s)) return false; delete s.cushionFunds; return true; }
      if (JSON.stringify(s.cushionFunds) === JSON.stringify(value)) return false;
      s.cushionFunds = value; return true;
    },
  },
];
const mirrorAll = (draft, path, value) => LEGACY.reduce((ch, a) => (a.owns(path) ? a.mirror(draft, path, value) || ch : ch), false);

function legacyEntries(plan) {
  const out = [];
  for (const a of LEGACY) { try { out.push(...a.match(plan).map((x) => ({ ...x, s: null, at: null, d: null, legacy: true }))); } catch { /* a malformed flag is not a guess */ } }
  return out;
}

export function guessAt(plan, path) {
  let p;
  try { p = canonical(plan, path); } catch { return null; }
  const led = ledgerOf(plan);
  const e = has(led, p) ? led[p] : undefined;
  if (isEntry(e)) { const cur = getAt(plan, p); return cur !== undefined && same(cur, e.v, e.u) ? { path: p, ...e } : null; }
  if (e !== undefined) return null;                    // a malformed entry on this path: not a guess (settle drops it)
  const x = legacyEntries(plan).find((l) => l.path === p);
  if (!x) return null;
  const cur = getAt(plan, p);
  return cur !== undefined && same(cur, x.v, x.u) ? x : null;
}
export const isGuess = (plan, path) => guessAt(plan, path) !== null;

export function guessesInUse(plan) {
  const out = [];
  const led = ledgerOf(plan);
  for (const [path, e] of Object.entries(led)) {
    if (!isEntry(e)) continue;                           // malformed: settle drops it as "bad"
    let cur;
    try { cur = getAt(plan, path); } catch { continue; }
    if (cur !== undefined && same(cur, e.v, e.u)) out.push({ path, ...e });
  }
  for (const x of legacyEntries(plan)) {
    if (has(led, x.path)) continue;                      // the ledger wins on a shared path
    const cur = getAt(plan, x.path);
    if (cur !== undefined && same(cur, x.v, x.u)) out.push(x);
  }
  return out;
}

/** The guesses in use whose path starts in one of `sections` ("expenses", "accounts", ...), each with its weight. */
export function guessesTouching(plan, sections = [], { weights } = {}) {
  const want = new Set(sections);
  return guessesInUse(plan).filter((e) => want.has(parsePath(e.path)[0].name)).map((e) => (weights ? { ...e, weight: weights[e.k] ?? "small" } : e));
}

/**
 * Write a guess: the field and its entry. Idempotent: the same key and value change nothing (`at` is kept). Mirrors the
 * older flag on a path it owns. est: an Estimate ({ key, value, unit, sigma, dataAsOf }). -> true when the plan changed.
 */
export function markGuess(draft, path, est, today) {
  if (!est || est.value === null || est.value === undefined) return false;
  if (!(typeof est.value === "number" ? Number.isFinite(est.value) : Array.isArray(est.value))) return false;
  const p = canonical(draft, path);
  const cur = getAt(draft, p);
  const unit = est.unit;
  let changed = false;
  // setAt refuses when the record is not there: nothing is created
  if (cur === undefined || !same(cur, est.value, unit)) { if (!setAt(draft, p, est.value)) return false; changed = true; }
  const led = ledgerOf(draft);                            // a ledger that is not an object is replaced, never spread
  const old = has(led, p) && isEntry(led[p]) ? led[p] : null;
  if (!(old && old.k === est.key && same(old.v, est.value, unit) && !changed)) {
    const keepAt = old && old.k === est.key && same(old.v, est.value, unit);
    draft.guesses = { ...led, [p]: { k: est.key, v: est.value, u: unit, s: est.sigma ?? null, at: keepAt ? old.at : today, d: est.dataAsOf ?? null } };
    changed = true;
  }
  return mirrorAll(draft, p, est.value) || changed;
}

/** The person typed it, kept it, or removed its record: drop the entry and the mirrored flag; the value stays. */
export function clearGuess(draft, path) {
  let p;
  try { p = canonical(draft, path); } catch { return false; }
  let changed = false;
  if (has(ledgerOf(draft), p)) {
    delete draft.guesses[p];
    if (!Object.keys(draft.guesses).length) delete draft.guesses;
    changed = true;
  }
  return mirrorAll(draft, p, undefined) || changed;
}
/** "That's about right": the figure stays and becomes the person's own. */
export const confirmGuess = clearGuess;

/**
 * The one call a page makes when it saves a box that may hold a guess. read = { value: number | null, guessed: boolean }
 * (ui.form's meta, or a setup box):
 *   guessed and an estimate -> markGuess
 *   typed (not guessed)     -> the value is set and any guess on it dropped: it is theirs, even when equal to ours
 *   blank, no guess         -> null is saved and any guess dropped (as a blank box saves today)
 */
export function saveField(draft, path, read, est, today) {
  if (read?.guessed && est && est.value !== null && est.value !== undefined) return markGuess(draft, path, est, today);
  const value = read?.value ?? null;
  const p = canonical(draft, path);
  const before = getAt(draft, p);
  const set = setAt(draft, p, value);
  const cleared = clearGuess(draft, p);
  return (set && !same(before, value, "")) || cleared;
}

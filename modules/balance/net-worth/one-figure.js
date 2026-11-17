// modules/balance/net-worth/one-figure.js -- PURE. "One figure or item by item" (gap list, next 60, item 11; research Ux8):
// a kind of account of one owner (a SECTION: Savings, Ana's 401(k), Credit cards) kept as one figure, typed and changed in one
// place, or listed account by account. Going to one figure replaces the section's rows with one row holding their total
// (after a question, with Undo); going back to item by item keeps that one row as the first of the list. The choice is the
// optional mark `accounts[].oneFigure` (docs/DATA_MODEL.md); no total reads it.
//
// Why a section is one KIND of one OWNER (README "One figure or item by item"): the pages that read accounts read more than
// the sum. The retirement plan sorts balances by kind (a Roth is tax-free later, a 401(k) is not) and reads contributions by
// the account's kind; Net worth's own figures, Emergency fund and the tax pages read the kind; Balance sheet by owner, the tax
// pages, early access and required withdrawals read the owner. Rows of one kind and owner are counted the same by all of
// them, so one row with their total gives every page the same answer. A row that something else in the plan keeps its id
// for (a goal, bank lines, holdings, loan details...), or whose balance is our guess, stays on its own, and says why.
// Some pages read an account's NAME too: a 401(k), IRA or Roth named "old", "former", "previous", "prior" or "rollover" is
// from a job left (retirement/contributions, Goal seek, Sensitivity), a Roth named for a 401(k), 403(b), 457, TSP or thrift
// plan is one through work (contributions limitKind), a 401(k) named 457, TSP or thrift is not a 401(k) for the limits
// (investments/limits), a loan named or banked "car", "auto", "vehicle" or "truck" is a car loan (insurance/property). Those
// words are part of the kind (`nameClass`), and a row of a kind whose name is read keeps its own name when put together.
import { countedBalance, isLiability } from "./compute.js";
import { labelsOf, sameLabel } from "./labels.js";
import { isGuess } from "../../../core/estimate/index.js";
import { codeOf, shareOf, trustOf } from "./worked.js";

/** The kinds a person can keep as one figure: bank accounts, investments, retirement accounts, cards and loans. Not the
 * mortgage (tied to a home), a home, a car, something else owned, the HSA, college savings (one per child), a policy. */
export const ONE_FIGURE_KINDS = Object.freeze(["checking", "savings", "cash", "brokerage", "crypto", "401k", "ira", "roth", "credit", "loan", "student_loan", "other_liability"]);
// the section's name (the one row's name once put together) and what its rows are called, by kind
const NAMES = {
  checking: ["Checking", "checking accounts"], savings: ["Savings", "savings accounts"], cash: ["Cash", "cash"],
  brokerage: ["Investments", "investment accounts"], crypto: ["Crypto", "crypto"],
  "401k": ["401(k)", "401(k) accounts"], ira: ["Traditional IRA", "traditional IRAs"], roth: ["Roth", "Roth accounts"],
  credit: ["Credit cards", "credit cards"], loan: ["Loans", "loans"], student_loan: ["Student loans", "student loans"], other_liability: ["Other debts", "other debts"],
};
const people = (plan) => (Array.isArray(plan?.household?.people) ? plan.household.people : []);
const list = (plan) => (Array.isArray(plan?.accounts) ? plan.accounts : []).filter((a) => a && typeof a === "object");
const ownerOf = (a) => (typeof a?.ownerId === "string" ? a.ownerId : "");
/** "Ana's", "My" (the person named "Me"), or null (shared, or an owner who is not a person on file). */
export function possessive(plan, id) {
  const p = id ? people(plan).find((x) => x && x.id === id) : null;
  if (!p) return null;
  const n = String(p.name ?? "").trim();
  return !n ? null : n === "Me" ? "My" : `${n}'s`;
}
const lower = (s) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
// the words in a name other pages read (see the top of this file), the same patterns as those pages
const OLD_JOB = /\b(old|former|previous|prior|rollover)\b/i;          // retirement/contributions atJob, Goal seek, levers
const WORK_PLAN = /\b(?:401\s*\(?k\)?|403\s*\(?b\)?|457|tsp|thrift)/i;  // contributions limitKind (a Roth through work)
const NOT_401K = /\b(?:457|tsp|thrift)\b/i;                          // investments/limits
const CAR = /car|auto|vehicle|truck/i;                                 // insurance/property (the name and the bank)
/** NAME_READ: the kinds whose rows keep their own name when put together (other pages read it). */
export const NAME_READ = Object.freeze(["401k", "ira", "roth", "loan"]);
/** nameClass(account) -> the words of its name other pages read, as letters: "o" old job, "w" a Roth through work, "t" a 457,
 * TSP or thrift plan, "c" a car loan; "" for none. Rows of one kind and owner with another class are another kind here. */
export function nameClass(a) {
  const n = String(a?.name ?? "");
  if (a?.type === "401k") return `${OLD_JOB.test(n) ? "o" : ""}${NOT_401K.test(n) ? "t" : ""}`;
  if (a?.type === "roth") return `${OLD_JOB.test(n) ? "o" : ""}${WORK_PLAN.test(n) ? "w" : ""}`;
  if (a?.type === "ira") return OLD_JOB.test(n) ? "o" : "";
  if (a?.type === "loan") return CAR.test(`${a.name ?? ""} ${a.institution ?? ""}`) ? "c" : "";
  return "";
}
/** sectionKey(account) -> "type|ownerId|1 (a 401(k) from a job left, `formerJob`) or 0|nameClass", or null for a kind that is never one figure. */
export function sectionKey(a) {
  if (!a || !ONE_FIGURE_KINDS.includes(a.type)) return null;
  return `${a.type}|${ownerOf(a)}|${a.formerJob === true ? 1 : 0}|${nameClass(a)}`;
}
const partsOf = (key) => { const [type, ownerId, past, cls] = String(key).split("|"); return { type, ownerId: ownerId ?? "", past: past === "1", cls: cls ?? "" }; };
/** The section's name: "Savings", "Ana's 401(k)", "My Roth", "Ana's 401(k), from former jobs", "Ana's Roth through work",
 * "Ana's 401(k), a 457, TSP or thrift plan", "Car loans", "Credit cards". */
export function sectionName(plan, key) {
  const { type, ownerId, past, cls } = partsOf(key);
  const base = type === "loan" && cls.includes("c") ? "Car loans" : (NAMES[type] ?? ["Accounts"])[0];
  const who = possessive(plan, ownerId);
  const name = `${base}${type === "roth" && cls.includes("w") ? " through work" : ""}${type === "401k" && cls.includes("t") ? ", a 457, TSP or thrift plan" : ""}${past || cls.includes("o") ? ", from former jobs" : ""}`;
  return who ? `${who} ${type === "401k" || type === "roth" ? name : lower(name)}` : name;
}
/** What the section's rows are, for "One figure for your savings accounts" / "...for Ana's 401(k) accounts". */
export function sectionNoun(plan, key) {
  const { type, ownerId, past, cls } = partsOf(key);
  const noun = `${type === "loan" && cls.includes("c") ? "car loans" : NAMES[type]?.[1] ?? "accounts"}${past || cls.includes("o") ? " from former jobs" : ""}`;
  return `${possessive(plan, ownerId) ?? "your"} ${noun}`;
}

// ---- where else the plan keeps an account's id (the setup's referenced() list, read as a scan so a new place is never missed)
const PLACES = {
  transactions: "it has bank lines in your ledger", imports: "bank files were imported into it", holdings: "it has investments listed in it",
  reconciliations: "its statements were checked against it", rules: "a rule files bank lines into it", importProfiles: "a bank file layout points at it",
  goals: "a goal draws on it", debts: "its rate and payment are on Debts", debtPlan: "your debt plan puts it in its own place",
  property: "a home or rental is linked to it", contacts: "a contact is linked to it", "estate.beneficiaries": "it has beneficiaries",
  "retirement.happenings": "a money move in your retirement plan uses it", guide: "it is an answer in Get started",
};
const OTHER_PLACE = "another page keeps something about it";
const WORKED = "it is in another currency, or only partly yours";
const TRUSTED = "a trust owns it";
// a row whose id is missing or shared with another row: the plan cannot say which row a change is for (review 2026-11-16, F3:
// three savings rows "a", "a", "b" put together removed all three, and net worth fell to $0)
const SAME_ID = "the app cannot tell it apart from another account on your list";
// never looked in: the accounts themselves, the guesses' ledger (keyed by path, read apart), the plan's stamp
const SKIP = new Set(["accounts", "guesses", "meta", "schemaVersion"]);
const placeOf = (path) => (["retirement", "estate", "whatIfs"].includes(path[0]) && path[1] ? `${path[0]}.${path[1]}` : path[0]);
/**
 * pointedAt(plan, id) -> the places outside `accounts` that hold this account's id as a value: "transactions", "goals",
 * "debts", "retirement.contributions", "guide", ... (a list, each once). A contribution follows the row (asOne points it at
 * the row kept, of the same kind); Get started's own answers do not stop a row from holding the figure.
 */
export function pointedAt(plan, id) {
  if (typeof id !== "string" || !id) return [];
  const found = new Set();
  const walk = (x, path) => {
    if (typeof x === "string") { if (x === id) found.add(placeOf(path)); return; }
    if (!x || typeof x !== "object") return;
    if (Array.isArray(x)) { for (const y of x) walk(y, path); return; }
    for (const [k, v] of Object.entries(x)) walk(v, [...path, k]);
  };
  for (const [k, v] of Object.entries(plan ?? {})) if (!SKIP.has(k)) walk(v, [k]);
  return [...found];
}
const FOLLOWS = new Set(["retirement.contributions"]);         // re-pointed at the row kept
const KEEPER_OK = new Set(["retirement.contributions", "guide"]); // may be on the row that holds the figure (its balance is not read)
const isSetup = (id) => typeof id === "string" && id.startsWith("setup-");
/** Why a row cannot go into one figure on its own account (its id missing or shared, held elsewhere, our guess), or null. */
function ownWhy(plan, a, places, seen) {
  if (typeof a.id !== "string" || !a.id || seen.get(a.id) > 1) return SAME_ID;
  // its balance is worked from a whole in another currency or a share, or a trust owns it (worked.js): summed with other rows,
  // what it is worked from would be lost (absent on every other row: nothing changes for them)
  if (codeOf(plan, a) || shareOf(a) < 1) return WORKED;
  if (trustOf(a)) return TRUSTED;
  const p = places.find((x) => !FOLLOWS.has(x) && x !== "guide");
  if (p) return PLACES[p] ?? OTHER_PLACE;
  if (typeof a.id === "string" && isGuess(plan, `accounts[${a.id}].balance`)) return "its balance is our guess for now: type the real one first";
  return null;
}
const cents = (n) => Math.round(n * 100) / 100;
const sameLabels = (a, b) => { const x = labelsOf(a), y = labelsOf(b); return x.length === y.length && x.every((l) => y.some((m) => sameLabel(l, m))); };

/**
 * sectionsOf(plan, { all = false }) -> [{ key, type, ownerId, name, noun, debt, ids, count, total, kept, mode, keep, join, held,
 * changes, marked }] for each section with two or more rows or a row marked one figure (all: every section with a row).
 *   total   the section's balance as the plan counts it (owed, for debts), every row; kept: the keeper's alone;
 *           together: the keeper's and the joining rows' (what one figure would hold)
 *   keep    the id of the row that holds (or would hold) the figure: the row marked, else a Get started row, else the
 *           biggest; one that nothing but a contribution or Get started keeps, and whose balance is not our guess
 *   join    the ids that would go into it; held: [{ id, name, why }] the rows that stay on their own
 *   mode    "one" when a row is marked and every other row stays on its own; else "items"
 *   changes true when the choice can change something (rows to put together, or one figure to list item by item)
 * Assets first, then debts, the biggest first.
 */
export function sectionsOf(plan, { all = false } = {}) {
  const groups = new Map(), seen = new Map();
  for (const a of list(plan)) {
    if (typeof a.id === "string") seen.set(a.id, (seen.get(a.id) ?? 0) + 1);
    const k = sectionKey(a); if (k) (groups.get(k) ?? groups.set(k, []).get(k)).push(a);
  }
  const out = [];
  for (const [key, rows] of groups) {
    const marked = rows.find((a) => a.oneFigure === true) ?? null;
    if (!all && rows.length < 2 && !marked) continue;
    const { type, ownerId } = partsOf(key);
    const places = new Map(rows.map((a) => [a, pointedAt(plan, a.id)]));
    const why = new Map(rows.map((a) => [a, ownWhy(plan, a, places.get(a), seen)]));
    const free = rows.filter((a) => !why.get(a));
    // the keeper: the row marked, else Get started's, else the biggest (the first of equals)
    const big = (xs) => xs.reduce((m, a) => (Math.abs(countedBalance(a)) > Math.abs(countedBalance(m)) ? a : m), xs[0]);
    const pool = free.filter((a) => (places.get(a) ?? []).every((p) => KEEPER_OK.has(p)));
    const keeper = (marked && pool.includes(marked) ? marked : null) ?? pool.find((a) => isSetup(a.id)) ?? (pool.length ? big(pool) : null);
    const held = [], join = [];
    let together = keeper ? countedBalance(keeper) : 0;
    for (const a of rows) {
      if (a === keeper) continue;
      const w = why.get(a)
        ?? ((places.get(a) ?? []).includes("guide") ? PLACES.guide : null)
        ?? (isSetup(a.id) ? PLACES.guide : null)
        ?? (keeper && !sameLabels(a, keeper) ? "it carries labels of its own" : null);
      if (w || !keeper) held.push({ id: a.id, name: a.name || "An account", why: w ?? OTHER_PLACE }); else { join.push(a.id); together += countedBalance(a); }
    }
    const total = rows.reduce((t, a) => t + countedBalance(a), 0);
    const mode = marked && marked === keeper && join.length === 0 ? "one" : "items";
    out.push({ key, type, ownerId, name: sectionName(plan, key), noun: sectionNoun(plan, key), debt: isLiability(type), ids: rows.map((a) => a.id), count: rows.length, total,
      together: cents(together), kept: keeper ? countedBalance(keeper) : 0, mode, keep: keeper?.id ?? null, join, held, changes: join.length > 0 || mode === "one", marked: marked?.id ?? null });
  }
  return out.sort((a, b) => Number(a.debt) - Number(b.debt) || Math.abs(b.total) - Math.abs(a.total));
}

/**
 * mergedHistory(rows, { owed = false, sign = 1 }) -> [{ date, balance }]: from the first day on which EVERY row has a point,
 * over every day any row has one, the sum of each row's latest point on or before that day. Before that day a row has no
 * figure, and counting it as 0 would show its first point as growth (review 2026-11-16, F2: two brokerage rows, one saved
 * from January and one only from September, read as a 520% return on Performance); so those days are left out, and a row
 * with no point at all leaves no day ([]: the history starts afresh). `owed` (debts): each point counts as what is owed
 * (|balance|, as countedBalance), and the sum is signed `sign` like the balance kept (F4: -400 and +250 owed 650, not -150).
 */
export function mergedHistory(rows, { owed = false, sign = 1 } = {}) {
  const hs = rows.map((a) => (Array.isArray(a.history) ? a.history : []).filter((h) => h && typeof h.date === "string").slice().sort((x, y) => x.date.localeCompare(y.date)));
  if (!hs.length || hs.some((h) => !h.length)) return [];
  const from = hs.map((h) => h[0].date).sort().at(-1);
  const dates = [...new Set(hs.flat().map((h) => h.date))].filter((d) => d >= from).sort();
  const val = (p) => { const n = Number(p.balance) || 0; return owed ? Math.abs(n) : n; };
  return dates.map((date) => ({ date, balance: cents(sign * hs.reduce((t, h) => { let v = 0; for (const p of h) { if (p.date > date) break; v = val(p); } return t + v; }, 0)) }));
}

/**
 * asOne(draft, key, today) -> { kept, gone: [ids], names: [the rows' names, kept first], sum, name } | null: the section kept
 * as one figure. Its rows that can go together become the kept row: balance = their total as the plan counts it (owed for a
 * debt, with the kept row's sign), the section's name (the kept row's own for a kind whose name is read: NAME_READ), the
 * earliest "as of" among them (the figure is no fresher than its oldest part), the latest day one of them was typed
 * (`typedOn`), their history added up from the first day every row has a point (mergedHistory), the bank or company they
 * share, their notes, and the mark; the others (those very rows, never a row that shares an id) are removed and a contribution that
 * went into one goes into the kept row (the same kind, so the retirement plan reads it the same). A section of one row is
 * only marked. Rows that stay on their own are left as they are.
 */
export function asOne(draft, key, today = null) {
  void today;
  const s = sectionsOf(draft, { all: true }).find((x) => x.key === key);
  if (!s || !s.keep) return null;
  const rows = list(draft);
  const kept = rows.find((a) => a.id === s.keep);
  const going = rows.filter((a) => a !== kept && s.join.includes(a.id));
  for (const a of rows) if (a !== kept && sectionKey(a) === key) delete a.oneFigure;   // one mark in a section
  if (!going.length) { kept.oneFigure = true; return { kept: kept.id, gone: [], names: [kept.name], sum: countedBalance(kept), name: kept.name }; }
  const all = [kept, ...going];
  const sum = cents(all.reduce((t, a) => t + countedBalance(a), 0));
  const debt = isLiability(kept.type);
  const dates = all.map((a) => (typeof a.asOf === "string" ? a.asOf : "")).filter(Boolean).sort();
  const typed = all.map((a) => (typeof a.typedOn === "string" ? a.typedOn : "")).filter(Boolean).sort();
  const inst = [...new Set(all.map((a) => String(a.institution ?? "").trim()))];
  const notes = [...new Set(all.map((a) => String(a.notes ?? "").trim()).filter(Boolean))];
  const names = all.map((a) => a.name || "An account");
  const sign = debt && Number(kept.balance) < 0 ? -1 : 1;
  kept.balance = sign * sum;
  if (!NAME_READ.includes(kept.type)) kept.name = s.name;   // a kind whose name other pages read keeps the kept row's own
  if (dates.length) kept.asOf = dates[0];
  if (typed.length) kept.typedOn = typed.at(-1); else delete kept.typedOn;
  if (all.some((a) => Array.isArray(a.history) && a.history.length)) kept.history = mergedHistory(all, { owed: debt, sign });
  if (inst.length === 1) { if (inst[0]) kept.institution = inst[0]; } else kept.institution = "";
  if (notes.length) kept.notes = notes.join(" · ");
  kept.oneFigure = true;
  const gone = going.map((a) => a.id);
  const goingSet = new Set(going);
  draft.accounts = draft.accounts.filter((a) => !goingSet.has(a));
  for (const c of Array.isArray(draft.retirement?.contributions) ? draft.retirement.contributions : []) if (c && gone.includes(c.accountId)) c.accountId = kept.id;
  return { kept: kept.id, gone, names, sum, name: kept.name };
}
/** itemize(draft, key) -> { kept, name, sum } | null: the section listed item by item again; its one row stays as the first. */
export function itemize(draft, key) {
  let hit = null;
  for (const a of list(draft)) if (sectionKey(a) === key && a.oneFigure === true) { delete a.oneFigure; hit = hit ?? a; }
  return hit ? { kept: hit.id, name: hit.name, sum: countedBalance(hit) } : null;
}
/** unmarkOnAdd(draft, account) -> the name of the section that was one figure and is item by item again now that `account`
 * of its kind and owner is added beside it, or null. */
export function unmarkOnAdd(draft, account) {
  const k = sectionKey(account);
  if (!k) return null;
  let was = null;
  for (const a of list(draft)) if (a !== account && a.id !== account?.id && sectionKey(a) === k && a.oneFigure === true) { delete a.oneFigure; was = sectionName(draft, k); }
  return was;
}
/** The row's line on the list when it holds its section's figure ("One figure for your savings accounts"), else null. */
export function rowLine(plan, account, sections = sectionsOf(plan)) {
  const s = sections.find((x) => x.marked === account?.id && x.mode === "one");
  return s ? `One figure for ${s.noun}` : null;
}

// ---- the words, one sentence per case (README "One figure or item by item"); money(n) -> "$15,200"
const names = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const owed = (s) => (s.debt ? " owed" : "");
export const INTRO = "Keep a kind of account as one figure, typed and changed in one place, or list each account on its own. Either way your net worth counts the same, and so does every plan that reads it.";
/** The part's status: "2 as one figure" / "1 can be one figure" / "" (nothing to choose). */
export function statusWords(sections) {
  const one = sections.filter((s) => s.mode === "one").length;
  if (one) return `${one} as one figure`;
  const can = sections.filter((s) => s.changes).length;
  return can ? `${can} can be one figure` : "";
}
/** The section's line: "3 accounts, $15,200 in all" / "2 of 3 accounts can be one figure, $3,200" (some stay on their own:
 * the line says what one figure would hold, review 2026-11-16 P1) / "One figure: $15,200" / "One figure: $3,200, with 1 more on
 * its own" / "...owed". */
export function sectionLine(s, money) {
  const n = s.held.length;
  if (s.mode === "one") return `One figure: ${money(s.kept)}${owed(s)}${n ? `, with ${n} more on ${n === 1 ? "its" : "their"} own` : ""}`;
  if (n && s.join.length) return `${s.join.length + 1} of ${s.count} accounts can be one figure, ${money(s.together)}${owed(s)}`;
  return `${s.count} account${s.count === 1 ? "" : "s"}, ${money(s.total)}${owed(s)} in all`;
}
/** A row that stays on its own: "Rainy day stays on its own: a goal draws on it." */
export const holdWords = (h) => `${h.name} stays on its own: ${h.why}.`;
const joiningOf = (plan, s) => { const ids = [s.keep, ...s.join]; return list(plan).filter((a) => ids.includes(a.id)); };
/** The sum of the rows that would go together (the kept row and those joining it). */
export const joinSum = (plan, s) => cents(joiningOf(plan, s).reduce((t, a) => t + countedBalance(a), 0));
/** The question before rows are replaced: one sentence per case (all of them; some stay on their own). */
export function askWords(plan, s, money, netWorth) {
  const rows = joiningOf(plan, s);
  const ask = `Replace ${names(rows.map((a) => a.name || "An account"))} with one line, ${s.name}: ${money(joinSum(plan, s))}${owed(s)}?`;
  const stay = s.held.length ? ` ${names(s.held.map((h) => h.name))} ${s.held.length === 1 ? "stays on its own" : "stay on their own"}.` : "";
  return `${ask}${stay} Your net worth stays ${money(netWorth)}.`;
}
/** The green line after: "Savings is one figure now: $15,200, in place of 3 accounts. Your net worth is still $98,400.", naming
 * the rows of the kind that stay on their own ("Ally savings stays on its own."), so a "Savings" row beside them is no surprise. */
export function doneWords(r, s, money, netWorth) {
  const stay = r.gone.length && s.held?.length ? ` ${names(s.held.map((h) => h.name))} ${s.held.length === 1 ? "stays on its own" : "stay on their own"}.` : "";
  if (!r.gone.length) return `${r.name} is one figure now: ${money(r.sum)}${owed(s)}. Your net worth is still ${money(netWorth)}.`;
  return `${r.name} is one figure now: ${money(r.sum)}${owed(s)}, in place of ${r.names.length} accounts.${stay} Your net worth is still ${money(netWorth)}.`;
}
/** The green line after Item by item (short, for a phone: review 2026-11-16 P4). */
export const itemizeWords = (r) => `${r.name} is item by item now. List each one: tap Edit on its line to rename it, then + Add another account.`;
/** The green line after Undo of a put-together (the rows back) or of Item by item (the figure back). */
export const undoneWords = (r, money, netWorth) => (r.gone?.length ? `Put back: ${names(r.names)}. Your net worth is still ${money(netWorth)}.` : `Back as it was: ${r.name}. Your net worth is still ${money(netWorth)}.`);
/** Said with "<name> added." when the add took a section off one figure. */
export const addWords = (name) => `${name} is item by item again: each account is on the list.`;
export const PART_TITLE = "One figure or item by item";

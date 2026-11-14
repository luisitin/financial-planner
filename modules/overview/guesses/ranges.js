// modules/overview/guesses/ranges.js -- PURE. Verdicts that wait, stage 2 (spec 8.2): how far an answer could move if our
// guesses are off, and which one guess decides it. A page's own compute calls it behind `params.ranges` (Next best action's
// left over, Emergency fund's months, Will the money last?'s verdict); nothing here is worked out unless a page asks, and a
// plan with no guess that has a spread gets nothing at all (the key stays absent, so its compute output is unchanged).
//
//   guessMoves(plan, { sections, keep, registry, today, max, group })   the guesses in use that can move, as rangeOf moves
//   measure(fn, plan, moves, { kindOf })                               the range, the guess that decides it, whether it
//                                                                      crosses the line, whether it may be printed
//   decidesWords(decisive)                                             "Your rent decides it" and "Type your rent"
//   registryFrom(modules)                                              the estimators and tables merged from the manifests
//
// The rules (README "Verdicts that wait, stage 2"): each guess moves to the ends of its middle half, exp(-+0.674 s), with the
// spread its ledger entry carries (measured from its table, or declared: survey spending 0.25). Guessed spending rows move
// together, with the declared 0.25 (they share one survey, so they are off together). A rate has no spread, an older guess
// (legacy) keeps none, a row read from the person's own bank files is theirs: none of them moves. A range is printed only
// when every move in it is measured (never a dollar range from a declared spread, spec 2.2 R6 and 16).
//
// Imports core/estimate and the Expenses page's bank-spread constant only, so any page's compute may import it (the guesses
// compute does not need to: the import rule, spec 6.2, is about guesses/compute.js and its estimators).
import { guessesInUse, rangeOf, estimate, same, mergeEstimators, parsePath, getAt } from "../../../core/estimate/index.js";
import { BANK_SPREAD } from "../../cashflow/expenses/compute.js";

/** The middle half of a log-normal guess: exp(-+0.674 s) (core/math/estimate.js middleHalf). */
export const Z = 0.674;
/** The declared spread of survey spending rows (README; spec 2.2 R6: declared, never printed as a range). */
export const SPEND_SIGMA = 0.25;
/** At most this many moves go through a page's range (spec 11.2: the top 8 by static weight). */
export const MOVE_MAX = 8;
/** A spending row is named on its own when it is at least this share of the guessed spending that moves (else "your spending"). */
export const NAME_ROW_SHARE = 0.4;
/** The widest spread a move takes: our estimators reach about 1.9 at most; a hand-edited or imported ledger entry with a wider
 * one (s = 40 gave ranges of 1e15) is taken at this, so a range stays a figure a person can read (critic F6). */
export const SIGMA_MAX = 2;

const UNITS = new Set(["month", "year", "total"]);
const L = (p, k) => (Array.isArray(p?.[k]) ? p[k] : []);
const byId = (list, id) => list.find((x) => x?.id === id) ?? null;
const lower = (s) => String(s ?? "").trim().toLowerCase();
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const segs = (path) => { try { return parsePath(path); } catch { return null; } };
/** The person named in a sentence: "your" for the first adult or a name left as "Me", else "Dana's". */
function whose(plan, pid) {
  const p = L(plan?.household, "people").find((x) => x?.id === pid);
  const n = String(p?.name ?? "").trim();
  return !p || p.role === "self" || !n || /^(me|you)$/i.test(n) ? "your" : `${n}'s`;
}
/** A row of our spending guesses (not one read from the person's bank files, which is theirs). */
const spendRow = (e) => /^expenses\[[^\]]+\]\.amount$/.test(e.path) && e.u === "month" && !(typeof e.k === "string" && e.k.startsWith("spend.") && e.s === BANK_SPREAD);

/** Words for one moving guess: what it is ("your rent"), its verb ("decides" / "decide") and where the real figure is typed. */
export function labelOf(plan, e, registry = null) {
  const s = segs(e.path) ?? [];
  const head = s[0]?.name, id = s[0]?.id, field = s[s.length - 1]?.name;
  const one = (label, href = "#/overview/guesses") => ({ label, verb: "decides", href });
  if (head === "expenses") {
    const x = byId(L(plan, "expenses"), id);
    const setup = typeof id === "string" && id.startsWith("setup-x-");
    const href = setup ? "#/overview/setup/spend?back=done" : "#/cashflow/expenses";
    const name = lower(x?.name) || "this bill";
    if (id === "setup-x-housing" && /^rent$/i.test(String(x?.name ?? "").trim())) return { label: "your rent", verb: "decides", href };
    return { label: `what you spend on ${name}`, verb: "decides", href };
  }
  if (head === "accounts") {
    const a = byId(L(plan, "accounts"), id);
    const t = a?.type, w = whose(plan, a?.ownerId), name = lower(a?.name);
    if (field !== "balance") return one(registry?.estimators?.[e.k]?.label ? lower(registry.estimators[e.k].label) : "one of our guesses");
    if (t === "checking") return one("your checking balance");
    if (t === "savings") return one("your savings balance");
    if (t === "cash") return one("your cash on hand");
    if (t === "401k") return one(`${w} 401(k) balance`);
    if (t === "ira" || t === "roth") return one(`${w} IRA balance`);
    if (t === "hsa") return one(`${w} health savings balance`);
    if (t === "brokerage" || t === "crypto") return one("what your investments are worth");
    if (t === "property") return one("what your home is worth");
    if (t === "vehicle") return one("what your car is worth");
    if (t === "mortgage") return one("what's left on your mortgage");
    if (t === "credit") return one("what you owe on your cards");
    if (t === "loan" || t === "student_loan" || t === "other_liability") return one(`what's left on your ${name || "loan"}`);
    return one(name ? `the balance of ${name}` : "one of our balances");
  }
  if (head === "debts") {
    const d = byId(L(plan, "debts"), id);
    const a = byId(L(plan, "accounts"), d?.accountId);
    const name = a?.type === "credit" ? "card" : lower(a?.name) || "loan";
    if (field === "minPayment") return one(`your ${name} payment`);
    return one(`what's left on your ${name}`);
  }
  if (head === "income") {
    const x = byId(L(plan, "income"), id);
    return one(`${whose(plan, x?.personId)} pay`);
  }
  if (head === "retirement" && s[1]?.name === "contributions") {
    const c = byId(L(plan?.retirement, "contributions"), s[1].id);
    return one(field === "employerMatch" ? "what your employer adds" : `what goes into ${whose(plan, c?.personId)} plan at work`);
  }
  const lab = registry?.estimators?.[e.k]?.label;
  return one(lab ? lower(lab) : "one of our guesses");
}

/** Is this entry's spread measured from its table? Re-estimated with the registry (the ledger keeps only the spread). */
function measuredOf(plan, e, registry, today) {
  if (!registry?.estimators || !today) return false;
  try {
    const est = estimate(plan, e.k, { estimators: registry.estimators, tables: registry.tables, today, path: e.path });
    return !!est && est.measured === true && typeof est.value === "number" && same(est.value, e.v, e.u);
  } catch { return false; }
}

/**
 * The guesses in use that can move, as rangeOf moves, at most `max`, the biggest first.
 * opts: sections (first path segments to look at: ["expenses", "debts", ...]; all when absent), keep(entry, plan) (a page's own
 * filter: Emergency fund keeps only the must-pay bills and the cash), registry ({ estimators, tables }: big guesses first and
 * `measured`), today, group (true: spending rows move together; false: each on its own, as the guesses page ranks them).
 * -> [{ id, paths, factorLow, factorHigh, kind: "spend" | "one", label, verb, href, measured, weight, size, rows? }]
 */
export function guessMoves(plan, { sections = null, keep = null, registry = null, today = null, max = MOVE_MAX, group = true } = {}) {
  let inUse = [];
  try { inUse = guessesInUse(plan); } catch { inUse = []; }
  const want = sections ? new Set(sections) : null;
  const can = inUse.filter((e) => !e.legacy && typeof e.v === "number" && Number.isFinite(e.v) && e.v > 0 && UNITS.has(e.u)
    && typeof e.s === "number" && Number.isFinite(e.s) && e.s > 0 && (!want || want.has(segs(e.path)?.[0]?.name)) && (!keep || keep(e, plan)));
  const weightOf = (e) => registry?.weights?.[e.k] ?? registry?.estimators?.[e.k]?.weight ?? "small";
  // the swing in dollars a year: a flow's yearly figure, a balance as it is (the order among the big ones; spec 11.2)
  const sizeOf = (v, s, u) => v * (Math.exp(Z * s) - Math.exp(-Z * s)) * (u === "month" ? 12 : 1);
  const moves = [];
  const spend = group ? can.filter(spendRow) : [];
  if (spend.length) {
    const lo = Math.exp(-Z * SPEND_SIGMA), hi = Math.exp(Z * SPEND_SIGMA);
    const rows = spend.map((e) => ({ path: e.path, k: e.k, v: e.v })).sort((a, b) => b.v - a.v || (a.path < b.path ? -1 : 1));
    const total = rows.reduce((t, r) => t + r.v, 0);
    const top = rows[0];
    const named = rows.length === 1 || top.v >= NAME_ROW_SHARE * total ? labelOf(plan, spend.find((e) => e.path === top.path), registry) : null;
    const href = rows.every((r) => /^expenses\[setup-x-/.test(r.path)) ? "#/overview/setup/spend?back=done" : "#/cashflow/expenses";
    moves.push({ id: "spending", paths: rows.map((r) => r.path), factorLow: lo, factorHigh: hi, kind: "spend", label: named?.label ?? "your spending", verb: named?.verb ?? "decides",
      ask: named ? null : "Type what you spend", href: named?.href ?? href, measured: false, weight: spend.some((e) => weightOf(e) === "big") ? "big" : "small", size: sizeOf(total, SPEND_SIGMA, "month"), rows });
  }
  for (const e of can) {
    if (group && spendRow(e)) continue;
    const w = labelOf(plan, e, registry);
    const s = Math.min(e.s, SIGMA_MAX);
    // (v and u: what the guess itself is and its unit, so the guesses page can say how far "off" it means; rank.js)
    moves.push({ id: e.path, paths: [e.path], factorLow: Math.exp(-Z * s), factorHigh: Math.exp(Z * s), kind: spendRow(e) ? "spend" : "one", ...w,
      measured: measuredOf(plan, e, registry, today), weight: weightOf(e), size: sizeOf(e.v, s, e.u), k: e.k, v: e.v, u: e.u });
  }
  moves.sort((a, b) => (a.weight === "big" ? 0 : 1) - (b.weight === "big" ? 0 : 1) || b.size - a.size || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return moves.slice(0, Math.max(0, max));
}

const num = (r) => (r !== null && typeof r === "object" ? r.value : r);
const fin = (x) => typeof x === "number" && Number.isFinite(x);

/**
 * The range of an answer when the guesses move, and the one guess that decides it. fn(plan) -> number, or { value, verdict }.
 * kindOf(result) -> the verdict a result reads as ("short" / "spare", "on track" / "tight" / "short"), for `crosses`.
 * -> null (no move, or the answer cannot be worked out), or {
 *   low, mid, high      each move at the end that lowers (raises) the answer, added up: one move gives its exact ends
 *   crosses             a move (or all of them at once) gives another verdict than the answer as it is
 *   printable           every move is measured: the range may be said in figures (never with a declared spread)
 *   decisive            the move with the largest swing (one that changes the verdict first): { id, label, verb, href, ask?, measured }
 *   labels              the moves that change it at all, biggest first, in words
 *   kinds               the verdicts the answer reads as, as it is (first) and with the guesses moved (kindOf's words)
 *   each                [{ id, low, high, side (the larger distance from mid), flips }] in the order of `moves`
 *   moves               how many moved
 * }
 */
export function measure(fn, plan, moves, { kindOf = null } = {}) {
  if (!Array.isArray(moves) || !moves.length) return null;
  const r = rangeOf(fn, plan, moves);
  const mid = num(r.ends.mid);
  if (!fin(mid)) return null;
  const k0 = kindOf ? kindOf(r.ends.mid) : null;
  let down = 0, up = 0;
  const each = moves.map((m, i) => {
    const lo = num(r.swings[i].low), hi = num(r.swings[i].high);
    const d1 = fin(lo) ? lo - mid : 0, d2 = fin(hi) ? hi - mid : 0;
    down += Math.min(0, d1, d2); up += Math.max(0, d1, d2);
    const flips = !!kindOf && (kindOf(r.swings[i].low) !== k0 || kindOf(r.swings[i].high) !== k0);
    return { id: m.id, low: mid + Math.min(d1, d2), high: mid + Math.max(d1, d2), side: Math.max(Math.abs(d1), Math.abs(d2)), flips };
  });
  const low = mid + down, high = mid + up;
  // the verdict at every move's own worse and better end, added up, too, when the answer is a plain number (fn's result)
  const plain = typeof r.ends.mid === "number";
  const crosses = !!kindOf && (each.some((x) => x.flips) || kindOf(r.ends.low) !== k0 || kindOf(r.ends.high) !== k0 || (plain && (kindOf(low) !== k0 || kindOf(high) !== k0)));
  let at = -1;
  each.forEach((x, i) => { if (at < 0 || (x.flips && !each[at].flips) || (x.flips === each[at].flips && x.side > each[at].side)) at = i; });
  const m = moves[at];
  const decisive = m && (each[at].side > 0 || each[at].flips) ? { id: m.id, label: m.label, verb: m.verb, href: m.href, ...(m.ask ? { ask: m.ask } : {}), measured: !!m.measured, kind: m.kind } : null;
  // the guesses that move it at all, biggest first (a printed range names them: "depending on your checking balance")
  // every verdict the moved answers read as (the answer as it is first): "decides whether the money lasts" needs to know them
  const kinds = kindOf ? [...new Set([k0, kindOf(r.ends.low), kindOf(r.ends.high), ...r.swings.flatMap((x) => [kindOf(x.low), kindOf(x.high)])].filter((x) => x !== null && x !== undefined))] : [];
  const labels = [...new Set(moves.map((x, i) => ({ x, side: each[i].side })).filter((y) => y.side > 0).sort((a, b) => b.side - a.side).map((y) => y.x.label))];
  return { low, mid, high, crosses, printable: moves.every((x) => x.measured === true), decisive, labels, kinds, each, moves: moves.length };
}

/** "Your rent decides it" and "Type your rent" (a group with no one row big enough: "Your spending decides it", "Type what you spend"). */
export function decidesWords(d) {
  if (!d?.label) return null;
  const label = String(d.label);
  const ask = d.ask ?? `Type ${label}`;
  return { says: `${cap(label)} ${d.verb ?? "decides"} it`, ask, href: d.href ?? "#/overview/guesses" };
}

/** The estimators, tables and weights merged from every loaded manifest (core/app.js merges the same at boot). */
export const registryFrom = (modules) => mergeEstimators([...(modules?.values?.() ?? [])].map((m) => ({ from: `${m.group}/${m.id}`, estimators: m.estimators, tables: m.guessTables })));

/** True when the plan holds a guess that can move (cheap: the ledger only; a compute asks before it works anything out). */
export const anyMoving = (plan) => {
  const g = plan?.guesses;
  if (!g || typeof g !== "object" || Array.isArray(g)) return false;
  return Object.entries(g).some(([path, e]) => e && typeof e === "object" && typeof e.s === "number" && e.s > 0 && typeof e.v === "number" && getAt(plan, path) !== undefined);
};

// modules/cashflow/budget/compute.js -- PURE. Envelopes: a monthly amount per spending
// category, spent so far this month from the transactions, what is left, whether the pace
// is right for the day of the month, and what rolled over from last month. Suggested amounts
// come from the last three months the bank files fully cover.
// plan.budgets: [{ id, category, amount, period ("monthly"), rollover: bool }]
// plan.budgetPlan (optional, gap #37 "Budget your way"): { method?: "zero" | "three" (absent: envelopes), carryOver?: true,
// moves?: [{ id, month, from, to, amount }], hold?: { "YYYY-MM": amount } }. Absent, every figure here is what it was.
import { allLines, isTransfer, monthOf, coverage, monthCover, COVER_SLACK, coverageByAccount, monthGaps, gapIssues, unimportedCardLines, unsureCardPayments, unsureWords } from "../../transactions/ledger/compute.js";
import { categoriesOf, categoryById, categoryLabel, categoryIcon } from "../../transactions/categories/compute.js";
import { addMonths, daysBetween } from "../../../core/math/dates.js";
import { compute as computeExpenses } from "../expenses/compute.js";
import { compute as computeSinking } from "../sinking-funds/compute.js";
import { normalizePayee } from "../../transactions/rules/compute.js";
import { payRhythm } from "../../../core/math/periods.js";
import { money as fmtMoney } from "../../../core/format.js";

// (a purchase split across categories comes as one line per part: ledger allLines, gap #24)
const spendingOf = (plan, ym) => allLines(plan).filter((t) => monthOf(t.date) === ym && !isTransfer(t, plan) && (categoryById(plan, t.category)?.kind ?? (Number(t.amount) >= 0 ? "income" : "expense")) === "expense");
/**
 * Card stand-in lines summed per card: [{ cardId, name, label, total, months: [ym] (the months with a stand-in, oldest first),
 * before (every one dated before the card's first line `first`: "before its file starts on 8/1", re-check 4), first }].
 */
const cardTotals = (lines) => {
  const m = new Map();
  for (const t of lines) {
    const c = m.get(t.cardId) ?? { cardId: t.cardId, name: t.cardName, label: t.payee, total: 0, months: [], before: true, first: t.first ?? null };
    c.total -= Number(t.amount) || 0; if (!c.months.includes(monthOf(t.date))) c.months.push(monthOf(t.date));
    if (!t.before) { c.before = false; c.label = t.payee; }
    m.set(t.cardId, c);
  }
  return [...m.values()].map((c) => ({ ...c, months: c.months.sort() }));
};
const byCat = (txs) => { const m = new Map(); for (const t of txs) m.set(t.category || "", (m.get(t.category || "") ?? 0) - (Number(t.amount) || 0)); return m; };
const daysIn = (ym) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();

/**
 * compute(plan, { today, month }) -> {
 *   month, label, dayOfMonth, daysInMonth, daysLeft,
 *   envelopes: [{ id, category, label, icon, amount, rollover, carried, available, spent, left, share, pace ("on"|"ahead"|"over"|"paid": one payment of 90% or more of the envelope, as last month: a monthly bill), expectedByNow }],
 *   totals: { amount, available, spent, left }, unbudgeted: [{ category, label, icon, spent }] (spending this month with no envelope),
 *   (a card whose own file is missing this month: { category: "", card: true, cardId, label "<card>, details not imported yet", spent }),
 *   suggestions: [{ category, label, icon, average, months }] for categories without an envelope, hasBudget, hasData,
 *   suggestFrom: [ym] (the whole months the suggestions average over), suggestSkipped: [{ ym, holes (monthHoles), issues
 *   (gapIssues: holes, accounts whose lines stop early or start late) }] (spanned at both ends but not whole, so left out),
 *   suggestCards: [{ cardId, name, label, average, months, inMonths: [ym], total, before, first }] (the payments to a card on days its own file
 *   does not cover in those months: `average` = total / months, a month, in no category's suggestion; `inMonths` = the months
 *   they were in, so "October's purchases" is said when its file is in for the others; `before`: all dated before its first
 *   line `first`),
 *   unsure: "$2,610 went to one of your Chase cards in October; bring in the card files to see what it bought." | null (this
 *   month: a payment counted for neither card, ledger unsureCardPayments; re-check 4),
 *   cover: { from, to } | null (the days the bank files cover),
 *   stale (the files stop more than COVER_SLACK days before today in this month, so "spent so far" is missing the latest days),
 *   fromExpenses: [{ category, label, icon, amount }] (no envelopes and no whole bank month: Expenses' monthly amount per kind
 *   of spending, debt payments included), fromExpensesTotal
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const month = params.month ?? (today ? today.slice(0, 7) : null);
  if (!month) return { month: null, label: "", envelopes: [], totals: { amount: 0, available: 0, spent: 0, left: 0 }, unbudgeted: [], suggestions: [], hasBudget: false, hasData: false, dayOfMonth: 0, daysInMonth: 30, daysLeft: 30, suggestFrom: [], cover: null, stale: false };
  const daysInMonth = daysIn(month);
  const dayOfMonth = today && today.slice(0, 7) === month ? Number(today.slice(8, 10)) : (today && today.slice(0, 7) > month ? daysInMonth : 0);
  const daysLeft = daysInMonth - dayOfMonth;
  const monthTx = spendingOf(plan, month);
  const spent = byCat(monthTx);
  const count = new Map(); for (const t of monthTx) count.set(t.category || "", (count.get(t.category || "") ?? 0) + 1);
  const prevYm = addMonths(`${month}-01`, -1).slice(0, 7);
  const prevTx = spendingOf(plan, prevYm);
  const prev = byCat(prevTx);
  const prevCount = new Map(); for (const t of prevTx) prevCount.set(t.category || "", (prevCount.get(t.category || "") ?? 0) + 1);
  const budgets = (plan.budgets ?? []).filter((b) => b.category);
  // Budget your way (gap #37): only when the plan holds a budgetPlan; without one nothing below differs
  const bp = isSection(plan.budgetPlan) ? wayOf(plan) : null;
  const moves = bp ? movesIn(bp, month, budgets) : [], movesPrev = bp ? movesIn(bp, prevYm, budgets) : [];
  const net = netOf(moves), netPrev = netOf(movesPrev);
  // what rolled into last month (only asked for when overspending comes out of next month: critic M1)
  let prev2 = null, netPrev2 = null;
  if (bp?.carryOver) { const ym2 = addMonths(`${month}-01`, -2).slice(0, 7); prev2 = byCat(spendingOf(plan, ym2)); netPrev2 = netOf(movesIn(bp, ym2, budgets)); }
  const envelopes = budgets.map((b) => {
    const amount = Number(b.amount) || 0;
    // last month's money: the amount, plus or minus what was moved that month (one month back, as the rollover looks)
    const prevMoney = amount + (netPrev.get(b.category) ?? 0);
    const carried = b.rollover ? Math.max(0, prevMoney - (prev.get(b.category) ?? 0)) : 0;   // last month's unspent, never a debt
    const moved = net.get(b.category) ?? 0;
    // last month's overspending, when asked: past everything the envelope had last month, so money that rolled into last
    // month counts (450 a month, 420 spent in July, 470 in August: August had 480, nothing is owed in September)
    const carriedPrev = prev2 && b.rollover ? Math.max(0, amount + (netPrev2.get(b.category) ?? 0) - (prev2.get(b.category) ?? 0)) : 0;
    const owed = bp?.carryOver ? Math.max(0, (prev.get(b.category) ?? 0) - prevMoney - carriedPrev) : 0;
    const available = amount + carried + moved - owed;
    const sp = spent.get(b.category) ?? 0;
    const left = available - sp;
    const expectedByNow = available * (dayOfMonth / daysInMonth);
    // a bill paid once a month (the mortgage on the 1st) is not "spending fast": one payment of 90% or more of the envelope is
    // "paid" when last month also had one payment there of about the same amount (within 10%), so one big grocery trip is not
    const same = prevCount.get(b.category) === 1 && Math.abs((prev.get(b.category) ?? 0) - sp) <= 0.1 * sp;
    const paid = sp <= available && count.get(b.category) === 1 && sp >= 0.9 * available && available > 0 && same;
    const pace = sp > available ? "over" : paid ? "paid" : sp > expectedByNow * 1.1 + 1 ? "ahead" : "on";
    const e = { id: b.id, category: b.category, label: categoryLabel(plan, b.category), icon: categoryIcon(plan, b.category), amount, rollover: !!b.rollover, carried, available, spent: sp, left, share: available ? Math.min(1, sp / available) : 0, pace, expectedByNow };
    if (bp) { e.moved = moved; e.owed = owed; if (available <= 0) e.share = sp > 0 ? 1 : 0; }
    return e;
  }).sort((a, b) => b.available - a.available);
  const budgeted = new Set(budgets.map((b) => b.category));
  // a card whose own file is missing: what went to it is spending this month with no envelope (it is no kind yet), one line a card
  const cov = coverage(plan), covBy = coverageByAccount(plan);
  const cardsNow = cardTotals(unimportedCardLines(plan, month, { today, covBy }));
  const unbudgeted = [...[...spent.entries()].filter(([c, v]) => !budgeted.has(c) && v > 0).map(([category, sp]) => ({ category, label: categoryLabel(plan, category), icon: categoryIcon(plan, category), spent: sp })),
    ...cardsNow.map((c) => ({ category: "", card: true, cardId: c.cardId, label: c.label, icon: "💳", spent: c.total }))].sort((a, b) => b.spent - a.spent);
  // suggestions: per spending category not yet budgeted, the average over the last three months the bank files cover from
  // start to end (a month cut by the file would read low) and that is whole account by account: no hole in any account's
  // files, no account whose lines stop early or start late (a month missing the mortgage, or half the card's purchases, would
  // read low too; ledger's monthGaps, 2026-11-02), divided by the number of those months, so "average of N months" is the N it
  // was divided by; a month with nothing in a category counts as nothing spent. A card whose file is missing counts in no
  // category: its payments are said apart (suggestCards), so the amounts read "from checking only" rather than looking complete.
  const suggestFrom = [], suggestSkipped = [];
  for (let k = 1; k <= 3; k++) {
    const ym = addMonths(`${month}-01`, -k).slice(0, 7);
    if (!monthCover(cov, ym, today).full) continue;
    const g = monthGaps(plan, ym, today, covBy);
    if (g.whole) suggestFrom.push(ym); else suggestSkipped.push({ ym, holes: g.holes, issues: gapIssues(plan, { ...g, cards: [] }, ym) });
  }
  const sums = new Map();
  for (const ym of suggestFrom) for (const [c, v] of byCat(spendingOf(plan, ym))) sums.set(c, (sums.get(c) ?? 0) + v);
  const n = suggestFrom.length;
  const suggestions = n ? [...sums.entries()].filter(([c, v]) => c && !budgeted.has(c) && v > 0 && categoriesOf(plan).some((x) => x.id === c && x.kind === "expense")).map(([category, total]) => ({ category, label: categoryLabel(plan, category), icon: categoryIcon(plan, category), average: Math.round(total / n), months: n })).sort((a, b) => b.average - a.average) : [];
  const suggestCards = n ? cardTotals(suggestFrom.flatMap((ym) => unimportedCardLines(plan, ym, { today, covBy }))).map((c) => ({ cardId: c.cardId, name: c.name, label: c.label, average: Math.round(c.total / n), months: n, inMonths: c.months, total: Math.round(c.total * 100) / 100, before: c.before, first: c.first })) : [];
  // this month: a payment that went to one of two cards and is counted for neither, in one sentence (re-check 4, 2026-11-02)
  const unsureNow = unsureCardPayments(plan, month, { today, covBy });
  // no whole bank month to average yet: start from what the Expenses page already holds (each kind of spending's monthly
  // amount, debt payments included), so "Set a budget" is one tap instead of retyping every bill (round 4, 2026-11-02)
  let fromExpenses = [];
  if (!n && !budgets.length) {
    let ex = null;
    try { ex = computeExpenses(plan, { today }); } catch { ex = null; }
    fromExpenses = (ex?.byCategory ?? []).filter((c) => c.monthly >= 0.5 && categoriesOf(plan).some((x) => x.id === c.category && x.kind === "expense"))
      .map((c) => ({ category: c.category, label: categoryLabel(plan, c.category), icon: categoryIcon(plan, c.category), amount: Math.round(c.monthly) }));
  }
  // this month's "spent so far" is short when the files stop more than COVER_SLACK days before today
  const dayNo = (iso) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 864e5;
  const stale = !!(cov && today && today.slice(0, 7) === month && dayNo(today) - dayNo(cov.to) > COVER_SLACK);
  const totals = { amount: envelopes.reduce((s, e) => s + e.amount, 0), available: envelopes.reduce((s, e) => s + e.available, 0), spent: envelopes.reduce((s, e) => s + e.spent, 0) };
  totals.left = totals.available - totals.spent;
  const out = { month, label: `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`, dayOfMonth, daysInMonth, daysLeft, envelopes, totals, unbudgeted, suggestions, hasBudget: envelopes.length > 0, hasData: (plan.transactions ?? []).length > 0, suggestFrom, suggestSkipped, suggestCards, unsure: unsureNow ? `${unsureWords(plan, unsureNow, month)}.` : null, cover: cov, stale,
    fromExpenses, fromExpensesTotal: fromExpenses.reduce((t, x) => t + x.amount, 0) };
  if (bp) {
    const label = (c) => categoryLabel(plan, c);
    out.way = { method: bp.method, carryOver: bp.carryOver, moves: moves.map((m) => ({ ...m, fromLabel: label(m.from), toLabel: label(m.to) })),
      heldIn: bp.hold[prevYm] ?? 0, heldOut: bp.hold[month] ?? 0 };
  }
  return out;
}

// ---------------------------------------------------------------- Budget your way (gap #37, 2026-11-14)
export const WAYS = ["envelopes", "zero", "three"];
const isYm = (x) => typeof x === "string" && /^\d{4}-\d{2}$/.test(x);
const cents = (x) => Math.round((Number(x) || 0) * 100) / 100;
/** A section of the plan as it should be stored: an object, not a list (a hand-edited file can hold anything). */
const isSection = (x) => !!x && typeof x === "object" && !Array.isArray(x);
/** An amount of money a person could mean: above 0 and under a billion (a hand-edited file can hold 1e308, which adds up to no number). */
const isAmount = (x) => Number(x) > 0 && Number(x) < 1e9;
/**
 * wayOf(plan) -> { method ("envelopes" unless budgetPlan.method is "zero" or "three"), carryOver (true only when ticked),
 * moves: [{ id, month, from, to, amount }] (well-formed ones: a month, two different kinds, an amount above 0),
 * hold: { "YYYY-MM": amount above 0 } }. Read with defaults: a plan with no budgetPlan budgets with envelopes, as before.
 */
export function wayOf(plan) {
  const b = isSection(plan?.budgetPlan) ? plan.budgetPlan : {};
  const moves = (Array.isArray(b.moves) ? b.moves : []).filter((m) => m && isYm(m.month) && m.from && m.to && m.from !== m.to && isAmount(m.amount))
    .map((m) => ({ id: m.id, month: m.month, from: m.from, to: m.to, amount: cents(m.amount) }));
  const hold = {};
  for (const [ym, v] of Object.entries(isSection(b.hold) ? b.hold : {})) if (isYm(ym) && isAmount(v)) hold[ym] = cents(v);
  return { method: WAYS.includes(b.method) ? b.method : "envelopes", carryOver: b.carryOver === true, moves, hold };
}
/** A month's moves between two kinds that both have an envelope (a move to or from an envelope since removed moves nothing). */
const movesIn = (way, ym, budgets) => { const has = new Set(budgets.map((b) => b.category)); return way.moves.filter((m) => m.month === ym && has.has(m.from) && has.has(m.to)); };
/** What each kind gained (+) or gave (-) by those moves; the values add up to zero. */
const netOf = (moves) => { const m = new Map(); for (const x of moves) { m.set(x.to, (m.get(x.to) ?? 0) + x.amount); m.set(x.from, (m.get(x.from) ?? 0) - x.amount); } return m; };
/**
 * setWay(draft, patch): write the choice into the plan, keeping only what differs from the default. patch: { method?,
 * carryOver?, addMove?: { id, month, from, to, amount }, removeMove?: id, hold?: { month, amount } }. A budgetPlan with
 * nothing left in it is deleted, so "Envelopes" with no option set is a plan with no budgetPlan again. A budgetPlan that
 * is not an object (a hand-edited file) is started again, never spread into one.
 */
export function setWay(draft, patch = {}) {
  const b = isSection(draft.budgetPlan) ? { ...draft.budgetPlan } : {};
  if (patch.method !== undefined) { if (patch.method === "zero" || patch.method === "three") b.method = patch.method; else delete b.method; }
  if (patch.carryOver !== undefined) { if (patch.carryOver) b.carryOver = true; else delete b.carryOver; }
  if (patch.addMove) b.moves = [...(Array.isArray(b.moves) ? b.moves : []), { id: patch.addMove.id, month: patch.addMove.month, from: patch.addMove.from, to: patch.addMove.to, amount: cents(patch.addMove.amount) }];
  if (patch.removeMove !== undefined) b.moves = (Array.isArray(b.moves) ? b.moves : []).filter((m) => m?.id !== patch.removeMove);
  if (patch.hold) { b.hold = { ...(isSection(b.hold) ? b.hold : {}) }; if (isAmount(patch.hold.amount)) b.hold[patch.hold.month] = cents(patch.hold.amount); else delete b.hold[patch.hold.month]; }
  if (Array.isArray(b.moves) && !b.moves.length) delete b.moves;
  if (b.hold && !Object.keys(b.hold).length) delete b.hold;
  if (Object.keys(b).length) draft.budgetPlan = b; else delete draft.budgetPlan;
  return draft;
}
/**
 * dropOrphanMoves(draft) -> the number dropped. After an envelope is removed, or given another kind of spending, a move to
 * or from a kind with no envelope left is taken out of the plan (any month's): hidden, it could never be undone, and it
 * would count again the day an envelope for that kind came back (critic M4).
 */
export function dropOrphanMoves(draft) {
  if (!isSection(draft.budgetPlan) || !Array.isArray(draft.budgetPlan.moves)) return 0;
  const has = new Set((draft.budgets ?? []).filter((b) => b?.category).map((b) => b.category));
  const keep = draft.budgetPlan.moves.filter((m) => m && has.has(m.from) && has.has(m.to));
  const dropped = draft.budgetPlan.moves.length - keep.length;
  if (dropped) { draft.budgetPlan = { ...draft.budgetPlan, moves: keep }; setWay(draft, {}); }
  return dropped;
}
/**
 * moneyNote(e, money) -> "" | " ($70 rolled over)" | " (after $70 rolled over, $40 moved out and $20 over last month)": why an
 * envelope's money this month is not its monthly amount, in one pair of brackets (critic P6).
 */
export function moneyNote(e, money = (n) => fmtMoney(n)) {
  const why = [e.carried ? `${money(e.carried)} rolled over` : null, e.moved > 0 ? `${money(e.moved)} moved in` : e.moved < 0 ? `${money(-e.moved)} moved out` : null, e.owed ? `${money(e.owed)} over last month` : null].filter(Boolean);
  return !why.length ? "" : why.length === 1 ? ` (${why[0]})` : ` (after ${why.slice(0, -1).join(", ")} and ${why[why.length - 1]})`;
}
/**
 * moveProblem(d, { from, to, amount }, money) -> a sentence saying what to change, or null when the move can be made
 * (d = compute()): two different envelopes, an amount above 0, and no more than the giving envelope has left.
 */
export function moveProblem(d, { from, to, amount } = {}, money = (n) => fmtMoney(n)) {
  const a = d.envelopes.find((e) => e.category === from), b = d.envelopes.find((e) => e.category === to);
  if (!a || !b) return "Pick the envelope the money comes from and the one it goes to.";
  if (from === to) return "Pick two different envelopes: the money moves from one to the other.";
  if (!(Number(amount) > 0)) return "Type how much to move: an amount above 0.";
  if (a.left < 0.005) return `${a.label} has nothing left this month. Pick an envelope that still has money in it.`;
  if (Number(amount) > a.left + 0.005) return `${a.label} has ${money(a.left)} left this month. Move that much or less.`;
  return null;
}

/** The Expenses page's kinds of spending (debt payments included), a month each; none when the page cannot be read. */
function expenseKinds(plan, today) {
  try { return computeExpenses(plan, { today }).byCategory ?? []; } catch { return []; }
}

/**
 * jobOf(d, { spare, currency, plan?, today? }) -> { drawn: false, why: "no envelopes" | "plan" | "guesses", words: { wait } } | {
 *   drawn: true, kind: "give" | "done" | "over", takeHome, heldIn, envelopes, outside, outsideKinds: [label], saving, heldOut,
 *   toGive, canHold, words: { head, more } }
 * Every dollar a job (d = compute() for this month). To give a job = money in after tax this month (the month Safe to
 * spend uses: Next best action's `spare`, an object or a function returning it) + held from last month - the envelopes'
 * amounts - what the Expenses page holds for kinds of spending with no envelope (`outside`, with `plan`: a mortgage typed
 * there already has a job, critic M2) - the saving the plan already makes (retirement from pay, goals, the extra on debts)
 * - held for next month. canHold: the most that can be held for next month, in whole dollars, rounded down so holding it
 * all never tips the month over (critic M3).
 */
export function jobOf(d, { spare: given, currency = "USD", plan = null, today = null } = {}) {
  const money = (n) => fmtMoney(n, currency);
  if (!d.hasBudget) return { drawn: false, why: "no envelopes", words: { wait: "Every dollar a job starts with an envelope: add your first one below." } };
  const spare = typeof given === "function" ? given() : given;
  if (!spare || !Number.isFinite(spare.monthly)) return { drawn: false, why: "plan", words: { wait: "What is still to give a job shows once your pay is on the Income page." } };
  if (spare.waits) return { drawn: false, why: "guesses", words: { wait: "What is still to give a job shows once your pay and bills are your own figures: too much of the month is still our guess." } };
  const saving = (Number(spare.retirementSaving) || 0) + (Number(spare.goalSaving) || 0) + (Number(spare.debtExtra) || 0);
  const takeHome = spare.monthly + (Number(spare.spending) || 0) + saving;
  const heldIn = d.way?.heldIn ?? 0, heldOut = d.way?.heldOut ?? 0, envelopes = d.totals.amount;
  const enveloped = new Set(d.envelopes.map((e) => e.category));
  const rows = plan ? expenseKinds(plan, today).filter((c) => !enveloped.has(c.category) && c.monthly >= 0.005) : [];
  const outside = rows.reduce((t, c) => t + c.monthly, 0);
  const toGive = takeHome + heldIn - envelopes - outside - saving - heldOut;
  const canHold = Math.max(0, Math.floor(cents(toGive + heldOut)));
  let kind, head, more;
  if (toGive >= 0.5) { kind = "give"; head = `${money(toGive)} still to give a job this month.`; more = "Put it in an envelope, or hold it for next month."; }
  else if (toGive > -0.5) {
    kind = "done"; head = "Every dollar has a job this month.";
    more = outside >= 0.5 ? "What comes in after tax is all spoken for: envelopes, bills on your Expenses page, saving and money held for next month."
      : "What comes in after tax is all in an envelope, in saving or held for next month.";
  } else {
    kind = "over"; head = `You have given out ${money(-toGive)} more than you have this month.`;
    // the way out names what caused it: money held for next month comes first (critic P1)
    more = heldOut >= 0.5 && toGive + heldOut > -0.5 ? `Hold ${money(-toGive)} less for next month, or take it out of your envelopes.`
      : heldOut >= 0.5 ? `Hold less for next month, or take ${money(-toGive)} out of your envelopes, so the month adds up.`
      : `Take ${money(-toGive)} out of your envelopes so the month adds up.`;
  }
  return { drawn: true, kind, takeHome, heldIn, envelopes, outside, outsideKinds: rows.map((c) => categoryLabel(plan, c.category)), saving, heldOut, toGive, canHold, words: { head, more } };
}

/** Yearly, quarterly and one-time costs: what Irregular expenses sets aside a month, except the must-pay kinds' own (their
 * monthly share is already in the must-pay bills) and costs that have ended; and the lines among `lines` that pay one of
 * them (the typed cost's kind within 10% of its amount, one line each, or the payee a found yearly charge is). */
function setAsideFor(plan, today, lines, isBill) {
  const byId = new Map((plan.expenses ?? []).map((e) => [e.id, e]));
  const funds = computeSinking(plan, { today }).funds.filter((f) => {
    if (f.source !== "typed") return true;
    const e = byId.get(f.expenseId);
    return !!e && !(isDay(e.endDate) && e.endDate < today) && !isBill(e.category);
  });
  const paid = new Set();
  for (const f of funds) {
    if (f.source === "typed") { const cat = byId.get(f.expenseId).category; const t = lines.find((x) => !paid.has(x) && x.category === cat && Math.abs(-(Number(x.amount) || 0) - f.amount) <= 0.1 * f.amount); if (t) paid.add(t); }
    else for (const t of lines) if (`${t.accountId ?? ""}|${normalizePayee(t.rawPayee ?? t.payee)}` === f.key) paid.add(t);
  }
  return { funds, setAside: funds.reduce((t, f) => t + f.monthly, 0), paid };
}

/**
 * threeOf(plan, { today, month?, budget?, currency? }) -> { month, source: "expenses" | "envelopes" | "both" | null, hasData,
 *   tiles: [{ key: "fixed" | "flexible" | "yearly", label, plan (a month; null with no source), spent, left }],
 *   words: { head, more } }
 * Three numbers. The plan for each, kind of spending by kind: an envelope's money this month where the person made one
 * (critic P2: the envelopes they built are their plan), else what the Expenses page holds for that kind. Fixed = the
 * must-pay kinds; flexible = the others (for kinds with no envelope, less their yearly and quarterly bills, which are in
 * once a year); once a year = what Irregular expenses sets aside a month (Safe to spend's figure). source says where the
 * plans came from: the Expenses page, the envelopes, or both. Spent, from the month's bank lines: must-pay kinds are fixed,
 * a line that pays a set-aside cost is once a year, everything else (not sorted yet included) is flexible.
 */
export function threeOf(plan, params = {}) {
  const today = isDay(params.today) ? params.today : null;
  const ym = params.month ?? (today ? today.slice(0, 7) : null);
  const d = params.budget?.month === ym ? params.budget : compute(plan, { today, month: ym ?? undefined });
  const money = (n) => fmtMoney(n, params.currency ?? plan.meta?.currency ?? "USD");
  const isBill = (cat) => !!cat && !!categoryById(plan, cat)?.essential;
  const lines = ym ? spendingOf(plan, ym) : [];
  const { funds, setAside, paid } = setAsideFor(plan, today, lines, isBill);
  const enveloped = new Set(d.envelopes.map((e) => e.category));
  const rows = expenseKinds(plan, today).filter((c) => !enveloped.has(c.category));
  const kindOf = new Map((plan.expenses ?? []).map((e) => [e.id, e.category]));
  const fixedE = rows.filter((c) => isBill(c.category)).reduce((t, c) => t + c.monthly, 0);
  const inFlex = funds.filter((f) => f.source === "typed" && f.period !== "once" && !enveloped.has(kindOf.get(f.expenseId))).reduce((t, f) => t + f.monthly, 0);
  const flexE = Math.max(0, rows.filter((c) => !isBill(c.category)).reduce((t, c) => t + c.monthly, 0) - inFlex);
  const fromE = fixedE + flexE >= 0.5, fromV = d.envelopes.length > 0;
  const source = fromE && fromV ? "both" : fromE ? "expenses" : fromV ? "envelopes" : null;
  const fixed = source ? (fromE ? fixedE : 0) + d.envelopes.filter((e) => isBill(e.category)).reduce((t, e) => t + e.available, 0) : null;
  const flexible = source ? (fromE ? flexE : 0) + d.envelopes.filter((e) => !isBill(e.category)).reduce((t, e) => t + e.available, 0) : null;
  const spent = { fixed: 0, flexible: 0, yearly: 0 };
  for (const t of lines) spent[isBill(t.category) ? "fixed" : paid.has(t) ? "yearly" : "flexible"] -= Number(t.amount) || 0;
  const tile = (key, label, planned) => ({ key, label, plan: planned, spent: spent[key], left: planned === null ? null : planned - spent[key] });
  const tiles = [tile("fixed", "Must-pay bills", fixed), tile("flexible", "Flexible spending", flexible), tile("yearly", "Once-a-year costs", source || setAside >= 0.5 ? setAside : null)];
  const hasData = d.hasData;
  const past = !!today && !!ym && ym < today.slice(0, 7), name = ym ? MONTH_NAMES[Number(ym.slice(5, 7)) - 1] : "";
  let head, more;
  if (!source) { head = "Three numbers need your bills first."; more = "Add them on the Expenses page, or give each kind of spending an envelope below."; }
  // no bank file yet: the answer is the plan itself (critic P4)
  else if (!hasData) { head = `Your plan is ${money(fixed + flexible + setAside)} a month, in three numbers.`; more = "What you spend against each one shows once a bank file is in."; }
  else {
    const left = tiles[1].left, bills = tiles[0].left;
    const billsWords = bills > -0.5 ? (past ? "Must-pay bills stayed within their plan." : "Must-pay bills are within their plan.")
      : (past ? `Must-pay bills went ${money(-bills)} past their plan.` : `Must-pay bills are ${money(-bills)} past their plan.`);
    if (flexible < 0.5) {
      // nothing planned for flexible spending (only must-pay envelopes): "$0 of your flexible money is left" would say nothing (critic M6)
      head = bills > -0.5 ? (past ? `${money(Math.max(0, bills))} of your must-pay money was left in ${name}.` : `${money(Math.max(0, bills))} of your must-pay money is left this month.`)
        : (past ? `Must-pay bills went ${money(-bills)} past their plan in ${name}.` : `Must-pay bills are ${money(-bills)} past their plan this month.`);
      more = spent.flexible >= 0.5 ? `${money(spent.flexible)} ${past ? "went" : "has gone"} on flexible spending, which has no plan yet: give it an envelope below.` : "Flexible spending has no plan yet: give it an envelope below.";
    } else {
      head = left > -0.5 ? (past ? `${money(Math.max(0, left))} of your flexible money was left in ${name}.` : `${money(Math.max(0, left))} of your flexible money is left this month.`)
        : (past ? `Flexible spending went ${money(-left)} past its plan in ${name}.` : `Flexible spending is ${money(-left)} past its plan this month.`);
      more = billsWords;
    }
  }
  return { month: ym, source, hasData, tiles, words: { head, more } };
}

/** useExpenses(draft, rows): one envelope per row ({ category, amount }) not budgeted yet. -> the number added. */
export function useExpenses(draft, rows, newId) {
  draft.budgets = draft.budgets ?? [];
  let added = 0;
  for (const r of rows ?? []) {
    if (!r?.category || draft.budgets.some((b) => b.category === r.category)) continue;
    draft.budgets.push({ id: newId(), category: r.category, amount: Math.max(0, Math.round(Number(r.amount) || 0)), period: "monthly", rollover: false });
    added++;
  }
  return added;
}

// ---------------------------------------------------------------- Safe to spend (gap #5, 2026-11-13)
/** The spans a person can ask for: today, the days through Sunday, the days until the next payday (when one is known). */
export const SAFE_SPANS = ["today", "week", "payday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const isDay = (x) => typeof x === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x);
const plusDays = (iso, n) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)) + n)).toISOString().slice(0, 10);
const weekday = (iso) => new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))).getUTCDay();
const monthEnd = (ym) => `${ym}-${String(daysIn(ym)).padStart(2, "0")}`;
/** The first date after `after` on a pay rhythm counted from `anchor` (a payday), or null for a rhythm with no dates. */
function nextOn(anchor, period, after) {
  if (period === "weekly" || period === "biweekly") {
    const step = period === "weekly" ? 7 : 14;
    return plusDays(anchor, (Math.floor(daysBetween(anchor, after) / step) + 1) * step);
  }
  if (period === "semimonthly") {   // the 15th and the last day of the month (core/math/periods.js; household/calendar)
    const ym = after.slice(0, 7), next = addMonths(`${ym}-01`, 1).slice(0, 7);
    return [`${ym}-15`, monthEnd(ym), `${next}-15`, monthEnd(next)].find((d) => d > after);
  }
  const m = { monthly: 1, quarterly: 3, annual: 12 }[period];
  if (!m) return null;
  const gap = (Number(after.slice(0, 4)) - Number(anchor.slice(0, 4))) * 12 + Number(after.slice(5, 7)) - Number(anchor.slice(5, 7));
  for (let k = Math.floor(gap / m) - 1, i = 0; i < 8; k++, i++) { const d = addMonths(anchor, k * m); if (d > after) return d; }
  return null;
}
/**
 * nextPayday(plan, today) -> the first payday after today of any pay with a payday typed (`income[].payday`: one payday that
 * has passed, asked on the Calendar page), on its rhythm: a salary typed as a year's pay is paid as the Paycheck page counts
 * it (core/math/periods.js payRhythm), a pension or Social Security typed as a year's amount monthly, anything else as typed.
 * Never before the pay starts or after it ends. null when no payday is known.
 */
export function nextPayday(plan, today) {
  if (!isDay(today)) return null;
  let best = null;
  for (const inc of plan.income ?? []) {
    if (!inc || !isDay(inc.payday) || inc.period === "once") continue;
    const rhythm = payRhythm(inc, plan);
    const period = rhythm ? rhythm.period : ["pension", "social"].includes(inc.type) && ["annual", "quarterly"].includes(inc.period) ? "monthly" : inc.period;
    let d = nextOn(inc.payday, period, today);
    if (d && isDay(inc.startDate) && d < inc.startDate) d = nextOn(inc.payday, period, plusDays(inc.startDate, -1));
    if (!d || (isDay(inc.endDate) && d > inc.endDate)) continue;
    if (!best || d < best) best = d;
  }
  return best;
}
/** "About $310": to the dollar under $100, to the $10 above; never $0 while something is left. */
const aboutOf = (x) => (x <= 0 ? 0 : Math.max(1, x < 99.5 ? Math.round(x) : Math.round(x / 10) * 10));

/**
 * safeToSpend(plan, { today, span?, spare?, budget? }) -> { drawn: false, why } | {
 *   drawn: true, mode: "envelopes" | "plan", kind: "ok" | "spent" | "over" | "short", month, monthName, daysInMonth,
 *   dayOfMonth, daysLeft (counting today), planned, spent, noEnvelope (mode "envelopes": the part of spent in kinds with no
 *   envelope, not sorted yet included), left, billsPaid (must-pay lines this month: never counted as spent), setAsidePaid (lines a set-aside cost paid: never counted as spent), plan: { takeHome, mustPay, mustPayKinds,
 *   setAside, retirement, goals, debtExtra } (mode "plan"), envelopes: [{ label, available }] (mode "envelopes"),
 *   span, spans (no two with the same days), nextPayday, rawDays, days, cut (the span ran past the month's end), until, safe, about,
 *   words: { headline, second, doubt: [sentence] }
 * }
 * Drawn only for today's month when there is something to measure: this month's bank lines reach from its first days
 * (by the 4th) to within COVER_SLACK days of today. Planned money for the things that are not bills ("must-pay" kinds of
 * spending, the categories list's `essential`) comes from the envelopes for them when there are any, else from the plan's
 * month: the after-tax month the Dashboard uses (Next best action's `spare`, passed in, or a function returning it) less
 * must-pay bills, less what is set aside for yearly and one-time costs (Irregular expenses), less saving (retirement from pay,
 * goals' monthly) and the debt plan's extra. Spent so far = this month's money out in kinds that are not bills, transfers left
 * out. Left = planned - spent; safe = max(0, left) x days(span) / days left in the month counting today.
 */
export function safeToSpend(plan, params = {}) {
  const today = isDay(params.today) ? params.today : null;
  const none = (why) => ({ drawn: false, why });
  if (!today) return none("no date");
  const ym = today.slice(0, 7);
  if (params.month && params.month !== ym) return none("another month");
  // something to measure: the files reach this month's first days and come within the bank's usual delay of today
  const cov = coverage(plan);
  if (!cov) return none("no files");
  if (cov.from > `${ym}-${String(1 + COVER_SLACK).padStart(2, "0")}` || daysBetween(cov.to, today) > COVER_SLACK) return none("files");
  const d = params.budget?.month === ym && params.budget?.dayOfMonth === Number(today.slice(8, 10)) ? params.budget : compute(plan, { today });
  const isBill = (cat) => !!cat && !!categoryById(plan, cat)?.essential;
  const lines = spendingOf(plan, ym);
  const cur = plan.meta?.currency ?? "USD";
  const money = (n) => fmtMoney(n, cur);
  const doubt = [];
  let mode, planned, planParts = null, envelopes = null;
  let paid = new Set();   // lines that pay a cost set aside for (plan mode)
  const flex = d.envelopes.filter((e) => !isBill(e.category));
  const enveloped = new Set(flex.map((e) => e.category));
  if (flex.length) {
    mode = "envelopes";
    envelopes = flex.map((e) => ({ label: e.label, available: e.available }));
    planned = flex.reduce((t, e) => t + e.available, 0);
  } else {
    const spare = typeof params.spare === "function" ? params.spare() : params.spare;
    if (!spare || !Number.isFinite(spare.monthly)) return none("plan");
    if (spare.waits) return none("guesses");   // a month mostly of our guesses gives no figure (Next best action, spec 8.1)
    mode = "plan";
    const exp = computeExpenses(plan, { today });
    const mustRows = exp.byCategory.filter((c) => isBill(c.category));
    const mustPay = mustRows.reduce((t, c) => t + c.monthly, 0);
    // yearly, quarterly and one-time costs set aside for, and the lines this month that pay one (setAsideFor)
    const aside = setAsideFor(plan, today, lines, isBill);
    const setAside = aside.setAside; paid = aside.paid;
    const retirement = Number(spare.retirementSaving) || 0, goals = Number(spare.goalSaving) || 0, debtExtra = Number(spare.debtExtra) || 0;
    // the after-tax month (careful with uneven pay), as Next best action's lines add up: spare = takeHome - spending - saving - extra
    const takeHome = spare.monthly + (Number(spare.spending) || 0) + retirement + goals + debtExtra;
    planned = takeHome - mustPay - setAside - retirement - goals - debtExtra;
    planParts = { takeHome, mustPay, mustPayKinds: mustRows.map((c) => categoryLabel(plan, c.category)), setAside, retirement, goals, debtExtra };
    if ((Number(spare.guessedMonthly) || 0) > 0.5) doubt.push("Some of the bills it sets aside are our guesses.");
  }
  let spent = 0, billsPaid = 0, setAsidePaid = 0, noEnvelope = 0;
  for (const t of lines) {
    const out = -(Number(t.amount) || 0);
    if (isBill(t.category)) billsPaid += out;
    else if (paid.has(t)) setAsidePaid += out;
    else {
      spent += out;   // not sorted yet counts as spent: the figure errs low
      if (mode === "envelopes" && !enveloped.has(t.category)) noEnvelope += out;   // comes off the envelopes' money: said (critic 3)
    }
  }
  // a card whose own file is missing: what went to it this month is in no kind yet, so it is said, not guessed at
  for (const u of d.unbudgeted.filter((x) => x.card)) doubt.push(`It leaves out the ${money(u.spent)} that went to ${(plan.accounts ?? []).find((a) => a.id === u.cardId)?.name || "a card"} this month: its own file isn't in yet.`);
  const left = planned - spent;
  const daysInMonth = daysIn(ym), dayOfMonth = Number(today.slice(8, 10)), daysLeft = daysInMonth - dayOfMonth + 1;
  const payday = nextPayday(plan, today);
  const dow = weekday(today);
  const rawOf = (x) => (x === "today" ? 1 : x === "week" ? (dow === 0 ? 1 : 8 - dow) : daysBetween(today, payday));
  const daysOf = (x) => Math.min(rawOf(x), daysLeft);
  // two chips never give the same answer (critic 5): a span with the same days as one before it is not offered (on a
  // Sunday this week is today; on the month's last day every span is), and a saved one reads as the one it matches
  const known = SAFE_SPANS.filter((x) => x !== "payday" || payday);
  const spans = known.filter((x, i) => !known.slice(0, i).some((y) => daysOf(y) === daysOf(x)));
  const asked = params.span ?? plan.whatIfs?.safeSpend?.span;
  const want = known.includes(asked) ? asked : "week";
  const span = spans.find((x) => daysOf(x) === daysOf(want));
  const rawDays = rawOf(span);
  const days = Math.min(rawDays, daysLeft), cut = rawDays > daysLeft;
  const safe = left > 0 ? left * days / daysLeft : 0;
  const about = aboutOf(safe);
  const monthName = MONTH_NAMES[Number(ym.slice(5, 7)) - 1];
  // one written sentence per case (docs/OPTIONAL.md R5)
  let kind, headline, second;
  // at or past zero the second sentence says where more money comes from, in each mode's own terms (critic 2: "the bills still
  // to come need what is left" read as the negative "Left for <month>" in How, and envelopes keep bills out of the figure)
  const over = money(Math.round(-left));
  if (mode === "plan" && planned < 0.5) { kind = "short"; headline = "Nothing is free to spend this month."; second = "Your bills and saving need more than comes in after tax."; }
  else if (left <= -0.5) {
    kind = "over"; headline = `Spending is ${over} past this month's plan.`;
    second = mode === "plan" ? `Unless more comes in, that ${over} comes out of the money for bills and saving.` : `Your envelopes for spending don't cover that ${over}, so it comes out of money meant for bills or saving.`;
  } else if (left < 0.5) {
    kind = "spent"; headline = "This month's free money is all spent.";
    second = mode === "plan" ? "Anything more this month comes out of the money for bills and saving." : "Your envelopes for spending are used up: anything more comes out of money meant for bills or saving.";
  } else {
    kind = "ok";
    const m = money(about);
    if (span === "today" || rawDays === 1) headline = `About ${m} is free to spend today.`;
    else if (cut) headline = `About ${m} is free to spend to the end of ${monthName}.`;
    else if (span === "week") headline = `About ${m} is free to spend until Sunday.`;
    else headline = `About ${m} is free to spend until payday on ${MONTH_NAMES[Number(payday.slice(5, 7)) - 1]} ${Number(payday.slice(8, 10))}.`;
    second = mode === "plan" ? `That keeps your bills and saving covered to the end of ${monthName}.`
      : noEnvelope >= 0.5 ? `That keeps your spending within your envelopes to the end of ${monthName}, counting the ${money(Math.round(noEnvelope))} spent with no envelope.`
      : `That keeps your spending within your envelopes to the end of ${monthName}.`;
  }
  return { drawn: true, mode, kind, month: ym, monthName, daysInMonth, dayOfMonth, daysLeft, planned, spent, noEnvelope, left, billsPaid, setAsidePaid,
    plan: planParts, envelopes, span, spans, nextPayday: payday, rawDays, days, cut, until: plusDays(today, days - 1), safe, about,
    words: { headline, second, doubt } };
}

/**
 * envelopeWords(d, { today, currency }) -> { head, more }: what the envelopes say (d = compute()), one written sentence per
 * case (docs/OPTIONAL.md R5). head: what is left, or how far over, this month or in a past one in its own tense; more: which
 * envelopes are over (the two furthest by name, then "and N more"), or that none is, with the days still to go.
 */
export function envelopeWords(d, { today, currency = "USD" } = {}) {
  const money = (n) => fmtMoney(n, currency);
  const past = isDay(today) && d.month < today.slice(0, 7), month = MONTH_NAMES[Number(d.month.slice(5, 7)) - 1];
  const left = d.totals.left;
  const over = d.envelopes.filter((e) => e.left < -0.005).sort((a, b) => a.left - b.left);
  const named = over.slice(0, 2).map((e) => `${e.label} by ${money(-e.left)}`);
  const list = over.length > 2 ? `${named.join(", ")} and ${over.length - 2} more` : named.join(" and ");
  const toGo = d.daysLeft === 0 ? "with today left" : `with ${d.daysLeft} day${d.daysLeft === 1 ? "" : "s"} to go`;
  const head = left > -0.005 ? (past ? `${money(left)} was left in your envelopes in ${month}.` : `${money(left)} is left in your envelopes.`)
    : (past ? `Your envelopes went ${money(-left)} over in ${month}.` : `Your envelopes are ${money(-left)} over.`);
  const more = !over.length ? (past ? "Every envelope stayed within its amount." : `Every envelope is within its amount, ${toGo}.`)
    : past ? `Over on ${list}.` : `Over on ${list}, ${toGo}.`;
  return { head, more };
}

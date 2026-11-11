// modules/overview/monthly-review/compute.js -- PURE. The month in ten minutes: nine steps in order,
// each checked against the plan (are the balances fresh, is this month's net worth saved, are the
// bank files in and filed, how spending went against the budget and last month, the goals, what
// needs attention, the next step), then the month marked reviewed with a note.
import { compute as computeNetWorth } from "../../balance/net-worth/compute.js";
import { compute as computeCategorize } from "../../transactions/categorize/compute.js";
import { compute as computeBudget } from "../../cashflow/budget/compute.js";
import { compute as computeSpending } from "../../cashflow/spending/compute.js";
import { compute as computeGoals } from "../../goals/goals/compute.js";
import { compute as computeAlerts, goalsBehind } from "../alerts/compute.js";
import { compute as computeNext } from "../next-best-action/compute.js";
import { daysBetween } from "../../../core/math/dates.js";
import { coverage, monthCover, COVER_SLACK, monthGaps, gapIssues, theCard, paymentsTo, bringWords, shortDate, firstLineOf } from "../../transactions/ledger/compute.js";
import { usualInDays } from "../../transactions/import/compute.js";
import { date as fmtDate } from "../../../core/format.js";

/** A balance typed within this many days counts as fresh for the month's review. */
export const FRESH_DAYS = 20;
import { money as fmtMoney } from "../../../core/format.js";

/** A review in the first days of a month is about the month just ended. */
export const LOOK_BACK_DAYS = 10;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthLabel = (ym) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
export const prevMonth = (ym) => { const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; };
/**
 * The month a review on `today` is about: the month just ended while it has no review (all month, not only the first
 * LOOK_BACK_DAYS days: stress test 2026-11-11, MR-3, the check-in opened on a month that could not be finished while the one
 * that could was left open), else this month. Without `plan`, the old rule: last month in the first LOOK_BACK_DAYS days. A
 * plan that holds nothing dated before this month (made this month) is about this month: there is no last month to look back on.
 */
export const defaultMonth = (today, plan = null) => {
  const now = today.slice(0, 7), ended = prevMonth(now);
  if (!plan) return Number(today.slice(8, 10)) <= LOOK_BACK_DAYS ? ended : now;
  const f = firstDay(plan);
  if (!f || f.slice(0, 7) >= now) return now;
  return (plan.reviews ?? []).some((r) => r.month === ended) ? now : ended;
};

const isDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? ""));
/**
 * firstDay(plan) -> "YYYY-MM-DD" | null: the earliest day the plan holds anything for: an account's balance date or a
 * point in its history, a saved net worth total, a bank line, a review. Not meta.createdAt: an app opened empty in
 * October and filled in on November 2 has nothing to look back on in October.
 */
export function firstDay(plan) {
  let first = null;
  const see = (d) => { if (isDay(d) && (!first || d < first)) first = d; };
  for (const a of plan.accounts ?? []) { see(a.asOf); for (const h of a.history ?? []) see(h?.date); }
  for (const h of plan.netWorthHistory ?? []) see(h?.date);
  for (const t of plan.transactions ?? []) see(t?.date);
  for (const r of plan.reviews ?? []) see(r?.month ? `${r.month}-01` : null);
  return first;
}

/**
 * checkInDue(plan, today) -> { month, name, done, nextName, nextWhen } | null: the month just ended, with accounts on file and
 * the plan holding something from before this month (so a plan made today is not asked about a month it never saw).
 * done false: not checked in on yet, any day of the month (stress test 2026-11-11, MR-2: from the 11th the Dashboard had no
 * way in). done true: checked in; nextName is this month (looked back on next month, nextWhen). The Dashboard's row uses it.
 */
export function checkInDue(plan, today) {
  if (!isDay(today) || !(plan.accounts ?? []).length) return null;
  const now = today.slice(0, 7), ended = prevMonth(now);
  const f = firstDay(plan);
  if (!f || f.slice(0, 7) >= now) return null;
  const done = (plan.reviews ?? []).some((r) => r.month === ended);
  const nm = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1];
  const after = now.slice(5, 7) === "12" ? `${Number(now.slice(0, 4)) + 1}-01` : `${now.slice(0, 4)}-${String(Number(now.slice(5, 7)) + 1).padStart(2, "0")}`;
  return { month: ended, name: nm(ended), done, nextName: nm(now), nextWhen: nm(after) };
}

/**
 * compute(plan, { today, month }) -> {
 *   ready, missing, empty (nothing in the plan to check in on yet), month, label, choices: [ym, ym, ...] (this month and last, then the month shown and any month opened again with a note, newest first),
 *   steps: [{ id, title, status: "done"|"todo"|"info"|"skip", state ("done"|"todo"|null: how a look step stands), detail, go, query?,
 *     quiet?: [{ accountId, from, to, name }] (the files step: days that can be marked "nothing happened"), links?: [{ label, go,
 *     rest?, query? }] (the files step: one way to each fix it names, when it names more than one account or days to add by hand) }], done, todo
 *   (done and todo count only the chores: balances, net worth, bank files, filing),
 *   reviewed: { month, at, note } | null, draftNote (the note of a month opened again, kept in plan.reviewNotes), history: [reviews, newest first, up to 12], streak (months in a row reviewed up to this one),
 *   summary: [the month in words, once known: net worth's change, spending against the month before], nextCheck: { month (the next one to review), when (the month name it is done in) }
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  if (!today) return { ready: false, missing: ["today's date"] };
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month : defaultMonth(today, plan);
  const label = monthLabel(month);
  const money = (n) => fmtMoney(Math.round(n), plan.meta?.currency ?? "USD");
  const steps = [];
  const add = (s) => steps.push(s);
  const inMonth = (d) => String(d ?? "").slice(0, 7) === month;
  const hasTx = (plan.transactions ?? []).length > 0;

  // 1. balances
  const accounts = plan.accounts ?? [];
  // fresh = typed in the last three weeks: a balance from the 1st no longer counts as this month's by the 30th
  const stale = accounts.filter((a) => !a.asOf || daysBetween(a.asOf, today) > FRESH_DAYS);
  add({ id: "balances", title: "Update the balances", status: !accounts.length ? "todo" : stale.length ? "todo" : "done",
    detail: !accounts.length ? "No accounts yet: add them on Net worth." : stale.length ? `${stale.length} of ${accounts.length} are more than three weeks old: ${stale.slice(0, 4).map((a) => a.name).join(", ")}${stale.length > 4 ? ` and ${stale.length - 4} more` : ""}.` : (accounts.length === 1 ? "Your balance is from the last three weeks." : `All ${accounts.length} balances are from the last three weeks.`), go: ["balance", stale.length ? "update" : "net-worth"] });

  // 2. the month's net worth point (monthPoint): the newest saved after the 10th of the month through the 10th of the next
  // (a review in early November saves October's close in November), compared with the month before's close
  const nw = computeNetWorth(plan, { today });
  const { point, before } = monthPoint(plan.netWorthHistory, month, { late: month < today.slice(0, 7) });
  add({ id: "net-worth", title: "Save the month's net worth", status: point ? "done" : accounts.length ? "todo" : "skip",
    detail: point ? `${money(point.netWorth)} saved on ${fmtDate(point.date)}${point.late ? ", after the month ended" : ""}${before ? `: ${point.netWorth >= before.netWorth ? "up" : "down"} ${money(Math.abs(point.netWorth - before.netWorth))} since ${fmtDate(before.date)}` : ""}.` : accounts.length ? `Today's totals: ${money(nw.netWorth)}. Save them with "Save today's totals", at the bottom of Net worth, to build the history.` : "Comes after the balances.", go: ["balance", "net-worth"] });

  // 3. the bank files, 4. filing them: the files are in when they cover the month (an ended month to within COVER_SLACK
  // days of each end; the month in progress up to within COVER_SLACK days of today), not when one line falls in it
  const txMonth = (plan.transactions ?? []).filter((t) => inMonth(t.date));
  const cat = hasTx ? computeCategorize(plan) : null;
  const unfiled = txMonth.filter((t) => !t.category && !t.transferId);
  const cov = hasTx ? coverage(plan) : null, mc = cov ? monthCover(cov, month, today) : null;
  const current = month === today.slice(0, 7);
  const nameOf = (id) => accounts.find((a) => a.id === id)?.name ?? "That account";
  // the files together reach both ends of the month; then, account by account (2026-11-02): no hole inside it, no account
  // whose lines stop early or start late, and no card whose own file is missing while money went to it (its purchases would
  // be missing); ledger's monthGaps and gapIssues say which
  const spanIn = !!(txMonth.length && mc && (mc.full || (current && mc.firstDay <= 1 + COVER_SLACK && daysBetween(cov.to, today) <= COVER_SLACK)));
  const gaps = spanIn ? monthGaps(plan, month, today) : null;
  const issues = gaps ? gapIssues(plan, gaps, month, money) : [];
  const filesIn = spanIn && !issues.length;
  const partial = txMonth.length && !spanIn;
  // filing and the budget wait for what the files step asks for: a named file, or the rest of the month
  const waitWords = issues.length ? `Waits for the missing ${issues.length === 1 ? "file" : "files"} above.` : `Waits for the rest of ${label}'s bank files.`;
  add({ id: "import", title: "Bring in the bank files", status: !hasTx ? "skip" : filesIn ? "done" : "todo",
    detail: !hasTx ? "Optional: the app works without transactions; import a bank file to see real spending." : filesIn ? `${txMonth.length} transaction${txMonth.length === 1 ? "" : "s"} dated in ${label}.`
      : issues.length ? `${issues.slice(0, 2).map((x) => x.text).join(" ")}${issues.length > 2 ? ` And ${issues.length - 2} more.` : ""}`
      : partial ? `Your files ${mc.firstDay > 1 + COVER_SLACK ? `start on ${fmtDate(mc.from)}` : `stop on ${fmtDate(cov.to)}`}: import the rest of ${label}.` : `Nothing dated in ${label} yet: download this month's file from each bank and import it.`,
    go: ["transactions", "import"], ...(issues.length ? { query: { accountId: issues[0].accountId, ...(issues[0].kind === "hole" ? { need: `${issues[0].from}..${issues[0].to}` } : {}) } } : {}),
    // the days of the gaps named above that the owner can mark as checked when nothing happened on them (ledger markQuiet),
    // never days a usual payment falls in with none of it on file that month (the mortgage of the 2nd did happen), nor days
    // money went to that account from another one (a payment to the card on 8/14: its purchases happened; re-check 2026-11-02)
    ...(() => { const q = issues.slice(0, 2).filter((x) => x.quiet && !usualInDays(plan, x.quiet.accountId, x.quiet.from, x.quiet.to).length && !paymentsTo(plan, x.quiet.accountId, x.quiet.from, x.quiet.to, { today }).length).map((x) => ({ ...x.quiet, name: nameOf(x.accountId) })); return q.length ? { quiet: q } : {}; })(),
    // one way to each fix the detail names, when it names more than one account or days to add by hand (the step itself opens
    // the first): "Bring in the Visa file", "Bring in the Chase checking file", "Add Chase checking's lines by hand". A hole's
    // import says the days it needs (need: from..to) and its "by hand" opens the Ledger on that account and month with a new
    // line dated the first missing day (re-check 4, 2026-11-02); a payment to one of two cards: each card's file
    ...(() => {
      const shown = issues.slice(0, 2), links = [];
      for (const x of shown) for (const id of x.kind === "unsure" ? x.cardIds ?? [] : [x.accountId]) {
        const label = bringWords(nameOf(id)).replace(/\.$/, "");
        if (!links.some((l) => l.label === label)) links.push({ label, go: ["transactions", "import"], query: { accountId: id, ...(x.kind === "hole" ? { need: `${x.from}..${x.to}` } : {}) } });
        if (x.kind === "hole") links.push({ label: `Add ${nameOf(id)}'s lines by hand`, go: ["transactions", "ledger"], rest: ["account", id], query: { month: x.from.slice(0, 7) < month ? month : x.from.slice(0, 7), add: x.from < `${month}-01` ? `${month}-01` : x.from } });
      }
      return new Set(shown.flatMap((x) => (x.kind === "unsure" ? x.cardIds ?? [] : [x.accountId]))).size > 1 || shown.some((x) => x.kind === "hole") ? { links } : {};
    })() });
  // until the month's files are in, filing (with nothing left to file) and the budget wait for them, never "done"
  add({ id: "file", title: "File what came in", status: !hasTx || (!filesIn && !unfiled.length) ? "skip" : unfiled.length ? "todo" : "done",
    detail: !hasTx ? "Comes after the bank files." : !txMonth.length ? `Waits for ${label}'s bank files.` : unfiled.length ? `${unfiled.length} of ${label}'s transactions ${unfiled.length === 1 ? "has" : "have"} no category yet (${cat?.uncategorised ?? unfiled.length} in all).` : !filesIn ? waitWords : `Every transaction in ${label} is filed.`, go: ["transactions", "categorize"] });

  // 5. spending against the budget, and against last month
  const bud = hasTx ? computeBudget(plan, { today, month }) : null;
  const sp = hasTx && txMonth.length ? computeSpending(plan, { today, month }) : null;
  // the budget is a look step too: a month that ended over in an envelope is still reviewed (it can no longer be undone)
  if (bud?.hasBudget && !filesIn) add({ id: "budget", title: "Spending against the budget", status: "skip", detail: txMonth.length ? waitWords : `Waits for ${label}'s bank files.`, go: ["cashflow", "budget"], query: { month } });
  else if (bud?.hasBudget) {
    const over = bud.envelopes.filter((e) => e.left < 0);
    add({ id: "budget", title: "Spending against the budget", status: "info", state: over.length ? "todo" : "done",
      detail: `${money(bud.totals.spent)} spent of ${money(bud.totals.available)}${over.length ? `; over in ${over.map((e) => `${e.label} (${money(-e.left)})`).join(", ")}` : "; every envelope within its amount"}.`, go: ["cashflow", "budget"], query: { month } });
  } else add({ id: "budget", title: "Spending against the budget", status: hasTx ? "info" : "skip", detail: hasTx ? "No envelopes yet: the Budget page suggests amounts from past months." : "Needs the bank files.", go: ["cashflow", "budget"], query: { month } });
  // the change in dollars and as a share, on the same days of the month before when the file covers only part of one
  if (sp?.hasData && sp.month === month) {
    const diff = sp.previous && sp.change !== null ? (sp.previous.current ?? sp.total) - sp.previous.total : null;
    // "most on" is a kind of spending, never a card's stand-in line; what went to a card whose file isn't in is said apart
    const kinds = sp.byCategory.filter((c) => !c.unimported), cardsOut = sp.byCategory.filter((c) => c.unimported);
    // a card whose file is in for part of the month stands in only for payments before its file starts (ledger cardPayments)
    // (any month before the card's first line, re-check 4 2026-11-02: July said "whose file isn't in" once August's file was in)
    const cardSay = cardsOut.map((c) => { const name = accounts.find((a) => a.id === c.cardId)?.name ?? "a card"; const first = c.first ?? firstLineOf(plan, c.cardId);
      return `${money(c.total)} went to ${theCard(name)}, ${c.before && first ? `before its file starts on ${shortDate(first)}` : "whose file isn't in"}`; });
    // a month whose files miss some days (or the one before it) is not compared: the change would be the missing days (re-check);
    // a payment counted for neither card: what it bought is missing, so neither is it (re-check 4)
    const gapWhat = sp.cmpGap?.card ? "card purchases aren't all in" : "files miss some days";
    const gapSay = !sp.cmpGap ? "" : sp.cmpGap.ym === month ? ` (its ${gapWhat}, so it is not compared with ${monthLabel(sp.cmpGap.prev)})` : ` (${monthLabel(sp.cmpGap.ym)}'s ${gapWhat}, so the two are not compared)`;
    add({ id: "spending", title: "Where the money went", status: "info",
      detail: `${money(sp.total)} spent in ${label}${gapSay}${diff !== null ? `, ${diff >= 0 ? "up" : "down"} ${money(Math.abs(diff))} (${Math.round(Math.abs(sp.change) * 100)}%) on ${sp.sameDays ? `the same days of ${monthLabel(sp.previous.ym)}` : monthLabel(sp.previous.ym)}` : ""}${kinds[0] ? `; most on ${kinds[0].label} (${money(kinds[0].total)})` : ""}${cardSay.length ? `; ${cardSay.join("; ")}` : ""}.`, go: ["cashflow", "spending"], query: { month } });
  }

  // 6. goals, 7. what needs attention, 8. the next step
  const gl = computeGoals(plan, { today });
  const nb = computeNext(plan, { today });
  // the same count as Goals, the Dashboard and Needs attention (alerts' goalsBehind): a goal with nothing going in whose
  // turn on Next best action comes later is waiting, named apart, not behind (review 2026-11-02)
  const gb = goalsBehind(gl, { nba: nb, today });
  const behind = [...gb.behind, ...gb.pastDue];
  const waits = gb.queued.length ? ` ${gb.queued.length === 1 ? `${gb.queued[0].name} starts` : `${gb.queued.length} start`} in ${monthLabel(gb.turn.slice(0, 7))}, when its turn comes on Next best action.` : "";
  // goals, what needs attention and the next step are things to look at, not chores: a goal can be behind for a year and the
  // month is still reviewed, so they never hold the count back ("info"); their words say how they stand
  add({ id: "goals", title: "Check the goals", status: "info", state: !gl.goals.length ? null : behind.length ? "todo" : "done",
    detail: !gl.goals.length ? "No goals yet: what are you saving for?" : behind.length ? `${behind.length} of ${gl.goals.length} behind: ${behind.map((g) => g.name).join(", ")}.${waits}` : gb.queued.length ? `None behind.${waits}` : (gl.goals.length === 1 ? "Your goal is done or on track." : `All ${gl.goals.length} done or on track.`), go: ["goals", "goals"] });
  const al = computeAlerts(plan, { today });
  add({ id: "attention", title: "Look at what needs attention", status: "info", state: al.counts.bad + al.counts.warn ? "todo" : "done",
    detail: al.total ? `${[al.counts.bad ? `${al.counts.bad} to fix` : null, al.counts.warn ? `${al.counts.warn} to check` : null, al.counts.info ? `${al.counts.info} to do` : null].filter(Boolean).join(", ")}${al.alerts[0] ? `; first: ${al.alerts[0].title}` : ""}.` : "Nothing needs attention.", go: ["overview", "alerts"] });
  add({ id: "next", title: "Take the next step", status: nb.ready ? "info" : "skip", state: nb.ready && !nb.next ? "done" : null,
    detail: nb.ready ? (nb.next ? `${nb.next.title}: ${nb.next.detail}` : "Every step of the order is done.") : "Needs income and expenses.", go: ["overview", "next-best-action"] });

  const reviews = [...(plan.reviews ?? [])].sort((a, b) => b.month.localeCompare(a.month));
  const reviewed = reviews.find((r) => r.month === month) ?? null;
  let streak = 0;
  for (let m = month; reviews.some((r) => r.month === m); m = prevMonth(m)) streak++;
  // the look steps that say how a thing stands (goals, attention, budget): "to look at" while amber, never a chore (stress test
  // 2026-11-11, MR-3 and OV-3: the hero counted only the chores over a list of eight, and a full bar sat over amber steps)
  const looks = steps.filter((s) => s.status === "info" && (s.state === "todo" || s.state === "done"));
  const lookLeft = looks.filter((s) => s.state === "todo").length;
  const counted = steps.filter((s) => s.status === "done" || s.status === "todo");
  // the month in one line once it is reviewed: net worth's change and spending against the month before
  const summary = [
    point && before ? `net worth ${point.netWorth >= before.netWorth ? "up" : "down"} ${money(Math.abs(point.netWorth - before.netWorth))} since ${fmtDate(before.date)}` : point ? `net worth ${money(point.netWorth)}` : null,
    sp?.hasData && sp.month === month ? `${money(sp.total)} spent${sp.previous && sp.change !== null ? ` (${sp.change >= 0 ? "up" : "down"} ${Math.round(Math.abs(sp.change) * 100)}%)` : ""}` : null,
  ].filter(Boolean);
  // the next review is the next month's, early in the month after it (October's on Nov 2: November's in early December)
  const nextCheck = { month: nextMonth(month), when: MONTHS[Number(nextMonth(nextMonth(month)).slice(5, 7)) - 1] };
  // a month still running is not marked reviewed: marked on the 2nd, it would hide the real check-in in early next month
  // (the Dashboard asks only for a month not yet reviewed), and its files and spending are not in yet
  const ended = month < today.slice(0, 7);
  const finishIn = MONTHS[Number(nextMonth(month).slice(5, 7)) - 1];
  // nothing in the plan yet (no accounts, pay, bills, transactions or check-ins): there is nothing to check in on, and the page
  // says to set the plan up first, as every other page does (review 2026-11-11 N6: "update the balances" with no accounts)
  const empty = !(plan.accounts ?? []).length && !(plan.income ?? []).length && !(plan.expenses ?? []).length && !hasTx && !reviews.length;
  return { ready: true, missing: [], empty, month, label, choices: monthChoices(today, month, plan), steps, done: counted.filter((s) => s.status === "done").length, todo: counted.length, lookLeft, lookTotal: looks.length, firstTodo: (() => { const f = counted.find((s) => s.status === "todo"); return f ? { id: f.id, title: f.title } : null; })(), reviewed, draftNote: String(plan.reviewNotes?.[month] ?? ""), history: reviews.slice(0, 12), streak, summary, nextCheck, ended, finishIn };
}

// this month and last, then the month on screen and every month opened again and not finished (its note waits in
// plan.reviewNotes): an older month opened again stays one tap away, never out of reach with its note (attack on review N11)
function monthChoices(today, month, plan) {
  const two = [today.slice(0, 7), prevMonth(today.slice(0, 7))];
  const more = [month, ...Object.keys(plan.reviewNotes ?? {})].filter((m) => /^\d{4}-\d{2}$/.test(m) && m <= two[0] && !two.includes(m));
  return [...two, ...[...new Set(more)].sort().reverse()];
}

export const nextMonth = (ym) => { const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`; };

/**
 * monthPoint(history, month) -> { point, before }: the month's net worth point is the newest one saved after the
 * LOOK_BACK_DAYS-th (10th) of the month through the 10th of the next, so each point belongs to one month only (a point saved
 * on Oct 2 closes September; one saved on Nov 2 closes October); `before` is the newest one saved up to the 10th of the
 * month (the month before's close), so October's review on Nov 2 compares Nov 2 with Oct 2. `late` (a month already over):
 * with nothing in that span, the first point saved after it closes the month, marked `late`.
 */
export function monthPoint(history, month, { late = false } = {}) {
  const pts = [...(history ?? [])].filter((h) => h && /^\d{4}-\d{2}-\d{2}/.test(String(h.date))).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const dd = String(LOOK_BACK_DAYS).padStart(2, "0");
  // each point belongs to one month only: after the 10th of the month through the 10th of the next
  const after = `${month}-${dd}`, to = `${nextMonth(month)}-${dd}`;
  let point = pts.filter((h) => h.date.slice(0, 10) > after && h.date.slice(0, 10) <= to).pop() ?? null;
  // a month checked in late (after the 10th of the next): with nothing saved in its span, the first save after it closes
  // the month, so "Save today's totals" still finishes the step (stress test 2026-11-11: on Nov 11 October's step could
  // not be done at all); it is said to be late
  if (!point && late) { const first = pts.find((h) => h.date.slice(0, 10) > to); if (first) point = { ...first, late: true }; }
  const before = point ? pts.filter((h) => h.date.slice(0, 10) <= after).pop() ?? null : null;
  return { point, before };
}

/**
 * The plan change for "Open this month again" and Undo after finishing: the month's entry taken out, so every page that counts
 * plan.reviews (this one, the Dashboard, the annual review) sees the month open; its note moves to plan.reviewNotes[month],
 * which fills the box again and goes back on the entry when the month is finished (review 2026-11-11 N11: Undo deleted the
 * note without a word). PURE.
 */
export function unmarkReviewed(draft, month) {
  const was = (draft.reviews ?? []).find((r) => r.month === month);
  draft.reviews = (draft.reviews ?? []).filter((r) => r.month !== month);
  const note = String(was?.note ?? "").trim();
  if (note) draft.reviewNotes = { ...(draft.reviewNotes ?? {}), [month]: note };
  return draft;
}

/** The plan change for "mark reviewed": the month's entry added or replaced. PURE (the view passes it to store.update). */
export function markReviewed(draft, month, today, note) {
  draft.reviews = (draft.reviews ?? []).filter((r) => r.month !== month);
  draft.reviews.push({ month, at: today, note: String(note ?? "").trim() });
  draft.reviews.sort((a, b) => a.month.localeCompare(b.month));
  // the note held while the month was open again is now on the entry
  if (draft.reviewNotes && month in draft.reviewNotes) { delete draft.reviewNotes[month]; if (!Object.keys(draft.reviewNotes).length) delete draft.reviewNotes; }
  return draft;
}

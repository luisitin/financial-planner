// modules/overview/monthly-review/compute.js -- PURE. The month in ten minutes: nine steps in order,
// each checked against the plan (are the balances fresh, is this month's net worth saved, are the
// bank files in and filed, how spending went against the budget and last month, the goals, what
// needs attention, the next step), then the month marked reviewed with a note.
import { compute as computeNetWorth } from "../../balance/net-worth/compute.js";
import { compute as computeCategorize } from "../../transactions/categorize/compute.js";
import { compute as computeBudget } from "../../cashflow/budget/compute.js";
import { compute as computeSpending } from "../../cashflow/spending/compute.js";
import { compute as computeGoals } from "../../goals/goals/compute.js";
import { compute as computeAlerts } from "../alerts/compute.js";
import { compute as computeNext } from "../next-best-action/compute.js";
import { daysBetween } from "../../../core/math/dates.js";
import { coverage, monthCover, COVER_SLACK } from "../../transactions/ledger/compute.js";
import { date as fmtDate } from "../../../core/format.js";

/** A balance typed within this many days counts as fresh for the month's review. */
export const FRESH_DAYS = 20;
import { money as fmtMoney } from "../../../core/format.js";

/** A review in the first days of a month is about the month just ended. */
export const LOOK_BACK_DAYS = 10;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthLabel = (ym) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
export const prevMonth = (ym) => { const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`; };
/** The month a review on `today` is about: last month in the first LOOK_BACK_DAYS days, else this one. */
export const defaultMonth = (today) => (Number(today.slice(8, 10)) <= LOOK_BACK_DAYS ? prevMonth(today.slice(0, 7)) : today.slice(0, 7));

/**
 * compute(plan, { today, month }) -> {
 *   ready, missing, month, label, choices: [ym, ym] (this month and last),
 *   steps: [{ id, title, status: "done"|"todo"|"info"|"skip", state ("done"|"todo"|null: how a look step stands), detail, go, query? }], done, todo
 *   (done and todo count only the chores: balances, net worth, bank files, filing),
 *   reviewed: { month, at, note } | null, history: [reviews, newest first, up to 12], streak (months in a row reviewed up to this one),
 *   summary: [the month in words, once known: net worth's change, spending against the month before], nextCheck: { month (the next one to review), when (the month name it is done in) }
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  if (!today) return { ready: false, missing: ["today's date"] };
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "") ? params.month : defaultMonth(today);
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
    detail: !accounts.length ? "No accounts yet: add them on Net worth." : stale.length ? `${stale.length} of ${accounts.length} are more than three weeks old: ${stale.slice(0, 4).map((a) => a.name).join(", ")}${stale.length > 4 ? ` and ${stale.length - 4} more` : ""}.` : `All ${accounts.length} balances are from the last three weeks.`, go: ["balance", stale.length ? "update" : "net-worth"] });

  // 2. the month's net worth point (monthPoint): the newest saved after the 10th of the month through the 10th of the next
  // (a review in early November saves October's close in November), compared with the month before's close
  const nw = computeNetWorth(plan, { today });
  const { point, before } = monthPoint(plan.netWorthHistory, month);
  add({ id: "net-worth", title: "Save the month's net worth", status: point ? "done" : accounts.length ? "todo" : "skip",
    detail: point ? `${money(point.netWorth)} saved on ${fmtDate(point.date)}${before ? `: ${point.netWorth >= before.netWorth ? "up" : "down"} ${money(Math.abs(point.netWorth - before.netWorth))} since ${fmtDate(before.date)}` : ""}.` : accounts.length ? `Today's totals: ${money(nw.netWorth)}. Save them on Net worth to build the history.` : "Comes after the balances.", go: ["balance", "net-worth"] });

  // 3. the bank files, 4. filing them: the files are in when they cover the month (an ended month to within COVER_SLACK
  // days of each end; the month in progress up to within COVER_SLACK days of today), not when one line falls in it
  const txMonth = (plan.transactions ?? []).filter((t) => inMonth(t.date));
  const cat = hasTx ? computeCategorize(plan) : null;
  const unfiled = txMonth.filter((t) => !t.category && !t.transferId);
  const cov = hasTx ? coverage(plan) : null, mc = cov ? monthCover(cov, month, today) : null;
  const current = month === today.slice(0, 7);
  const filesIn = !!(txMonth.length && mc && (mc.full || (current && mc.firstDay <= 1 + COVER_SLACK && daysBetween(cov.to, today) <= COVER_SLACK)));
  const partial = txMonth.length && !filesIn;
  add({ id: "import", title: "Bring in the bank files", status: !hasTx ? "skip" : filesIn ? "done" : "todo",
    detail: !hasTx ? "Optional: the app works without transactions; import a bank file to see real spending." : filesIn ? `${txMonth.length} transaction${txMonth.length === 1 ? "" : "s"} dated in ${label}.`
      : partial ? `Your files ${mc.firstDay > 1 + COVER_SLACK ? `start on ${fmtDate(mc.from)}` : `stop on ${fmtDate(cov.to)}`}: import the rest of ${label}.` : `Nothing dated in ${label} yet: download this month's file from each bank and import it.`, go: ["transactions", "import"] });
  // until the month's files are in, filing (with nothing left to file) and the budget wait for them, never "done"
  add({ id: "file", title: "File what came in", status: !hasTx || (!filesIn && !unfiled.length) ? "skip" : unfiled.length ? "todo" : "done",
    detail: !hasTx ? "Comes after the bank files." : !txMonth.length ? `Waits for ${label}'s bank files.` : unfiled.length ? `${unfiled.length} of ${label}'s transactions ${unfiled.length === 1 ? "has" : "have"} no category yet (${cat?.uncategorised ?? unfiled.length} in all).` : !filesIn ? `Waits for the rest of ${label}'s bank files.` : `Every transaction in ${label} is filed.`, go: ["transactions", "categorize"] });

  // 5. spending against the budget, and against last month
  const bud = hasTx ? computeBudget(plan, { today, month }) : null;
  const sp = hasTx && txMonth.length ? computeSpending(plan, { today, month }) : null;
  // the budget is a look step too: a month that ended over in an envelope is still reviewed (it can no longer be undone)
  if (bud?.hasBudget && !filesIn) add({ id: "budget", title: "Spending against the budget", status: "skip", detail: txMonth.length ? `Waits for the rest of ${label}'s bank files.` : `Waits for ${label}'s bank files.`, go: ["cashflow", "budget"], query: { month } });
  else if (bud?.hasBudget) {
    const over = bud.envelopes.filter((e) => e.left < 0);
    add({ id: "budget", title: "Spending against the budget", status: "info", state: over.length ? "todo" : "done",
      detail: `${money(bud.totals.spent)} spent of ${money(bud.totals.available)}${over.length ? `; over in ${over.map((e) => `${e.label} (${money(-e.left)})`).join(", ")}` : "; every envelope within its amount"}.`, go: ["cashflow", "budget"], query: { month } });
  } else add({ id: "budget", title: "Spending against the budget", status: hasTx ? "info" : "skip", detail: hasTx ? "No envelopes yet: the Budget page suggests amounts from past months." : "Needs the bank files.", go: ["cashflow", "budget"], query: { month } });
  // the change in dollars and as a share, on the same days of the month before when the file covers only part of one
  if (sp?.hasData && sp.month === month) {
    const diff = sp.previous && sp.change !== null ? (sp.previous.current ?? sp.total) - sp.previous.total : null;
    add({ id: "spending", title: "Where the money went", status: "info",
      detail: `${money(sp.total)} spent in ${label}${diff !== null ? `, ${diff >= 0 ? "up" : "down"} ${money(Math.abs(diff))} (${Math.round(Math.abs(sp.change) * 100)}%) on ${sp.sameDays ? `the same days of ${monthLabel(sp.previous.ym)}` : monthLabel(sp.previous.ym)}` : ""}${sp.byCategory[0] ? `; most on ${sp.byCategory[0].label} (${money(sp.byCategory[0].total)})` : ""}.`, go: ["cashflow", "spending"], query: { month } });
  }

  // 6. goals, 7. what needs attention, 8. the next step
  const gl = computeGoals(plan, { today });
  const behind = gl.goals.filter((g) => g.status === "behind" || g.status === "past due");
  // goals, what needs attention and the next step are things to look at, not chores: a goal can be behind for a year and the
  // month is still reviewed, so they never hold the count back ("info"); their words say how they stand
  add({ id: "goals", title: "Check the goals", status: "info", state: !gl.goals.length ? null : behind.length ? "todo" : "done",
    detail: !gl.goals.length ? "No goals yet: what are you saving for?" : behind.length ? `${behind.length} of ${gl.goals.length} behind: ${behind.map((g) => g.name).join(", ")}.` : `All ${gl.goals.length} done or on track.`, go: ["goals", "goals"] });
  const al = computeAlerts(plan, { today });
  add({ id: "attention", title: "Look at what needs attention", status: "info", state: al.counts.bad + al.counts.warn ? "todo" : "done",
    detail: al.total ? `${al.counts.bad} to fix, ${al.counts.warn} to check, ${al.counts.info} to do${al.alerts[0] ? `; first: ${al.alerts[0].title}` : ""}.` : "Nothing needs attention.", go: ["overview", "alerts"] });
  const nb = computeNext(plan, { today });
  add({ id: "next", title: "Take the next step", status: nb.ready ? "info" : "skip", state: nb.ready && !nb.next ? "done" : null,
    detail: nb.ready ? (nb.next ? `${nb.next.title}: ${nb.next.detail}` : "Every step of the order is done.") : "Needs income and expenses.", go: ["overview", "next-best-action"] });

  const reviews = [...(plan.reviews ?? [])].sort((a, b) => b.month.localeCompare(a.month));
  const reviewed = reviews.find((r) => r.month === month) ?? null;
  let streak = 0;
  for (let m = month; reviews.some((r) => r.month === m); m = prevMonth(m)) streak++;
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
  return { ready: true, missing: [], month, label, choices: [today.slice(0, 7), prevMonth(today.slice(0, 7))], steps, done: counted.filter((s) => s.status === "done").length, todo: counted.length, reviewed, history: reviews.slice(0, 12), streak, summary, nextCheck, ended, finishIn };
}

export const nextMonth = (ym) => { const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)); return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`; };

/**
 * monthPoint(history, month) -> { point, before }: the month's net worth point is the newest one saved after the
 * LOOK_BACK_DAYS-th (10th) of the month through the 10th of the next, so each point belongs to one month only (a point saved
 * on Oct 2 closes September; one saved on Nov 2 closes October); `before` is the newest one saved up to the 10th of the
 * month (the month before's close), so October's review on Nov 2 compares Nov 2 with Oct 2.
 */
export function monthPoint(history, month) {
  const pts = [...(history ?? [])].filter((h) => h && /^\d{4}-\d{2}-\d{2}/.test(String(h.date))).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const dd = String(LOOK_BACK_DAYS).padStart(2, "0");
  // each point belongs to one month only: after the 10th of the month through the 10th of the next
  const after = `${month}-${dd}`, to = `${nextMonth(month)}-${dd}`;
  const point = pts.filter((h) => h.date.slice(0, 10) > after && h.date.slice(0, 10) <= to).pop() ?? null;
  const before = point ? pts.filter((h) => h.date.slice(0, 10) <= after).pop() ?? null : null;
  return { point, before };
}

/** The plan change for "mark reviewed": the month's entry added or replaced. PURE (the view passes it to store.update). */
export function markReviewed(draft, month, today, note) {
  draft.reviews = (draft.reviews ?? []).filter((r) => r.month !== month);
  draft.reviews.push({ month, at: today, note: String(note ?? "").trim() });
  draft.reviews.sort((a, b) => a.month.localeCompare(b.month));
  return draft;
}

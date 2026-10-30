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
 *   steps: [{ id, title, status: "done"|"todo"|"info"|"skip", detail, go }], done, todo,
 *   reviewed: { month, at, note } | null, history: [reviews, newest first, up to 12], streak (months in a row reviewed up to this one)
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
  const stale = accounts.filter((a) => !a.asOf || (a.asOf.slice(0, 7) < month && daysBetween(a.asOf, today) > 20));
  add({ id: "balances", title: "Update the balances", status: !accounts.length ? "todo" : stale.length ? "todo" : "done",
    detail: !accounts.length ? "No accounts yet: add them on Net worth." : stale.length ? `${stale.length} of ${accounts.length} are older than ${label}: ${stale.slice(0, 4).map((a) => a.name).join(", ")}${stale.length > 4 ? "..." : ""}.` : `All ${accounts.length} balances are from ${label} or later.`, go: ["balance", "net-worth"] });

  // 2. this month's net worth point
  const nw = computeNetWorth(plan, { today });
  const point = (plan.netWorthHistory ?? []).filter((h) => inMonth(h.date)).pop();
  const before = (plan.netWorthHistory ?? []).filter((h) => h.date.slice(0, 7) < month).pop();
  add({ id: "net-worth", title: "Save the month's net worth", status: point ? "done" : accounts.length ? "todo" : "skip",
    detail: point ? `${money(point.netWorth)} saved on ${point.date}${before ? `: ${point.netWorth >= before.netWorth ? "up" : "down"} ${money(Math.abs(point.netWorth - before.netWorth))} since ${monthLabel(before.date.slice(0, 7))}` : ""}.` : accounts.length ? `Today's totals: ${money(nw.netWorth)}. Save them on Net worth to build the history.` : "Comes after the balances.", go: ["balance", "net-worth"] });

  // 3. the bank files, 4. filing them
  const txMonth = (plan.transactions ?? []).filter((t) => inMonth(t.date));
  const cat = hasTx ? computeCategorize(plan) : null;
  const unfiled = txMonth.filter((t) => !t.category && !t.transferId);
  add({ id: "import", title: "Bring in the bank files", status: !hasTx ? "skip" : txMonth.length ? "done" : "todo",
    detail: !hasTx ? "Optional: the app works without transactions; import a bank file to see real spending." : txMonth.length ? `${txMonth.length} transactions dated in ${label}.` : `Nothing dated in ${label} yet: download this month's file from each bank and import it.`, go: ["transactions", "import"] });
  add({ id: "file", title: "File what came in", status: !hasTx ? "skip" : unfiled.length ? "todo" : "done",
    detail: !hasTx ? "Comes after the bank files." : unfiled.length ? `${unfiled.length} of ${label}'s transactions have no category yet (${cat?.uncategorised ?? unfiled.length} in all).` : `Every transaction in ${label} is filed.`, go: ["transactions", "categorize"] });

  // 5. spending against the budget, and against last month
  const bud = hasTx ? computeBudget(plan, { today, month }) : null;
  const sp = hasTx ? computeSpending(plan, { today, month }) : null;
  if (bud?.hasBudget) {
    const over = bud.envelopes.filter((e) => e.left < 0);
    add({ id: "budget", title: "Spending against the budget", status: over.length ? "todo" : "done",
      detail: `${money(bud.totals.spent)} spent of ${money(bud.totals.available)}${over.length ? `; over in ${over.map((e) => `${e.label} (${money(-e.left)})`).join(", ")}` : "; every envelope within its amount"}.`, go: ["cashflow", "budget"] });
  } else add({ id: "budget", title: "Spending against the budget", status: hasTx ? "info" : "skip", detail: hasTx ? "No envelopes yet: the Budget page suggests amounts from past months." : "Needs the bank files.", go: ["cashflow", "budget"] });
  if (sp?.hasData && sp.month === month) add({ id: "spending", title: "Where the money went", status: "info",
    detail: `${money(sp.total)} spent in ${label}${sp.previous ? `, ${sp.change >= 0 ? "up" : "down"} ${money(Math.abs(sp.change))} on ${monthLabel(sp.previous.ym)}` : ""}${sp.byCategory[0] ? `; most on ${sp.byCategory[0].label} (${money(sp.byCategory[0].total)})` : ""}.`, go: ["cashflow", "spending"] });

  // 6. goals, 7. what needs attention, 8. the next step
  const gl = computeGoals(plan, { today });
  const behind = gl.goals.filter((g) => g.status === "behind" || g.status === "past due");
  add({ id: "goals", title: "Check the goals", status: !gl.goals.length ? "info" : behind.length ? "todo" : "done",
    detail: !gl.goals.length ? "No goals yet: what are you saving for?" : behind.length ? `${behind.length} of ${gl.goals.length} behind: ${behind.map((g) => g.name).join(", ")}.` : `All ${gl.goals.length} done or on track.`, go: ["goals", "goals"] });
  const al = computeAlerts(plan, { today });
  add({ id: "attention", title: "Clear what needs attention", status: al.counts.bad + al.counts.warn ? "todo" : "done",
    detail: al.total ? `${al.counts.bad} to fix, ${al.counts.warn} to check, ${al.counts.info} to do${al.alerts[0] ? `; first: ${al.alerts[0].title}` : ""}.` : "Nothing needs attention.", go: ["overview", "alerts"] });
  const nb = computeNext(plan, { today });
  add({ id: "next", title: "Take the next step", status: nb.ready && nb.next ? "info" : nb.ready ? "done" : "skip",
    detail: nb.ready ? (nb.next ? `${nb.next.title}: ${nb.next.detail}` : "Every step of the order is done.") : "Needs income and expenses.", go: ["overview", "next-best-action"] });

  const reviews = [...(plan.reviews ?? [])].sort((a, b) => b.month.localeCompare(a.month));
  const reviewed = reviews.find((r) => r.month === month) ?? null;
  let streak = 0;
  for (let m = month; reviews.some((r) => r.month === m); m = prevMonth(m)) streak++;
  const counted = steps.filter((s) => s.status === "done" || s.status === "todo");
  return { ready: true, missing: [], month, label, choices: [today.slice(0, 7), prevMonth(today.slice(0, 7))], steps, done: counted.filter((s) => s.status === "done").length, todo: counted.length, reviewed, history: reviews.slice(0, 12), streak };
}

/** The plan change for "mark reviewed": the month's entry added or replaced. PURE (the view passes it to store.update). */
export function markReviewed(draft, month, today, note) {
  draft.reviews = (draft.reviews ?? []).filter((r) => r.month !== month);
  draft.reviews.push({ month, at: today, note: String(note ?? "").trim() });
  draft.reviews.sort((a, b) => a.month.localeCompare(b.month));
  return draft;
}

// modules/overview/start/compute.js -- PURE. Get started: the choices, what the featured "Build my whole plan" panel
// says for this plan, the guide being followed (the resume card), and whether opening the app with no page in the
// address should land here instead of on the dashboard.
import { journeyById, journeyStatus, activeSummary, guideHref } from "../guide/compute.js";

/** Every choice the page offers (written to plan.guide.chosen when tapped). */
export const CHOICE_IDS = ["whole-plan", "quick", "debt", "budget", "home", "retire", "more", "look"];
const QUICK = { id: "quick", icon: "⚡", title: "Get a quick answer", line: "Work out one thing, like paying cash for a car or borrowing, or which health plan costs least. Nothing to set up.", href: "#/overview/quick" };
/** The rows under the featured panel, in order: a quick answer, then four guides. */
export const ROWS = ["quick", "debt", "budget", "home", "retire"];
export const MORE = { id: "more", label: "More guides: taxes, protecting your family, a baby or a move ›", href: "#/overview/guide?more=1" };

const L = (p, k) => (Array.isArray(p?.[k]) ? p[k] : []);
/** Nothing in the plan yet: no accounts, people, income, expenses, goals or transactions. */
export function isEmptyPlan(plan) {
  return !L(plan, "accounts").length && !(plan?.household?.people ?? []).length && !L(plan, "income").length && !L(plan, "expenses").length && !L(plan, "goals").length && !L(plan, "transactions").length;
}
/** The first visit: an empty plan where "look around" was never chosen (any other choice, like a quick answer, leaves the plan empty and should not hide this page). */
export const firstRun = (plan) => isEmptyPlan(plan) && plan?.guide?.chosen?.id !== "look";
/** Open here instead of the dashboard when the address names no page: the first visit, or a guide still being followed before any account exists (the dashboard would not mention it). */
export function opensHere(plan, { today = null } = {}) {
  if (firstRun(plan)) return true;
  const a = activeSummary(plan, { today });
  return !!a && !a.complete && !L(plan, "accounts").length;
}
/** Remember the choice. No change (no save) when the same choice was already made today. */
export function setChosen(draft, id, today) {
  if (!CHOICE_IDS.includes(id)) return false;
  if (draft.guide?.chosen?.id === id && draft.guide.chosen.at === today) return false;
  draft.guide = draft.guide ?? {};
  draft.guide.chosen = { id, at: today };
  return true;
}
/** The featured panel: Start / Continue / Look over my plan, from the whole-plan guide (= the dashboard's six steps). */
export function featured(plan, { off = [] } = {}) {
  const s = journeyStatus(journeyById("whole-plan"), plan, { off });
  if (s.complete) return { state: "done", label: "Look over my plan", line: `All ${s.total} steps are done. See what to look at next.`, href: s.guideHref, doneCount: s.doneCount, total: s.total };
  if (s.doneCount === 0 && !s.started) return { state: "new", label: "Start my plan", line: `Your accounts, family, income, bills and goals, put in once. ${s.total} short steps, about ${s.minutes} minutes in all; stop any time.`, href: s.next.href, doneCount: 0, total: s.total };
  const skipped = s.steps.filter((x) => x.state === "later").length;
  const line = s.doneCount === 0 && skipped ? `You skipped ${skipped} step${skipped === 1 ? "" : "s"} for now. Next: ${s.next.short.toLowerCase()}.` : `${s.doneCount} of ${s.total} steps are done. Next: ${s.next.short.toLowerCase()}.`;
  return { state: "started", label: "Continue my plan", line, href: s.next.href, doneCount: s.doneCount, total: s.total };
}

/** compute(plan, { today?, off? }) -> { empty, firstRun, opensHere, featured, rows, more, resume, hasAccounts } */
export function compute(plan, params = {}) {
  const off = params.off ?? [], today = params.today ?? null;
  const rows = ROWS.map((id) => {
    if (id === "quick") return { ...QUICK, status: null };
    const j = journeyById(id), s = journeyStatus(j, plan, { off });
    return { id, icon: j.icon, title: j.title, line: j.line, href: guideHref(id), status: s.finished ? "Done" : s.started ? `In progress: ${s.doneCount} of ${s.total} steps done` : null };
  });
  const active = activeSummary(plan, { off, today });
  return {
    empty: isEmptyPlan(plan), firstRun: firstRun(plan), opensHere: opensHere(plan, { today }),
    featured: featured(plan, { off }), rows, more: MORE,
    // the whole plan's own progress is the featured panel, so it gets no second card
    resume: active && !active.complete && active.id !== "whole-plan" ? active : null,
    hasAccounts: L(plan, "accounts").length > 0,
  };
}

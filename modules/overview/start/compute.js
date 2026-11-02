// modules/overview/start/compute.js -- PURE. Get started: the choices, what the featured "Build my whole plan" panel
// says for this plan, the guide being followed (the resume card), and whether opening the app with no page in the
// address should land here instead of on the dashboard.
import { journeyById, journeyStatus, activeSummary, guideHref } from "../guide/compute.js";
import { progress as setupProgress, standing, SCREENS as SETUP_SCREENS, QUESTIONS } from "../setup/compute.js";

/** Every choice the page offers (written to plan.guide.chosen when tapped). */
export const CHOICE_IDS = ["setup", "whole-plan", "quick", "debt", "budget", "home", "retire", "taxes", "protect", "life", "more", "look"];
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
/**
 * Open here instead of the dashboard when the address names no page: the first visit, "Set up my plan" started and
 * not finished (unless "look around" was chosen), or a guide still being followed before any account exists (the
 * dashboard would mention neither).
 */
export function opensHere(plan, { today = null } = {}) {
  if (firstRun(plan)) return true;
  const sp = setupProgress(plan);
  if (sp.started && !sp.finished && plan?.guide?.chosen?.id !== "look") return true;
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

/** The tiles under "Or jump straight to", in order: a quick answer, six guides, and a big life change. */
export const TILES = [
  { id: "quick", icon: "⚡", title: "Quick answer", line: "One question, nothing to set up", href: "#/overview/quick", page: "overview/quick" },
  { id: "debt", title: "Pay off debt", line: "Which first, and when you're free" },
  { id: "budget", title: "Spend less, save more", line: "A budget you can keep" },
  { id: "home", title: "Buy a home", line: "What you can afford" },
  { id: "retire", title: "Plan retirement", line: "Will the money last?" },
  { id: "taxes", title: "Sort out taxes", line: "Pay no more than you must" },
  { id: "protect", title: "Protect my family", line: "Insurance, a will, the papers" },
  { id: "life", icon: "👪", title: "Big life change", line: "A baby, a move, a new job", href: "#/household/life-events", page: "household/life-events" },
];
/**
 * The "Set up my plan" card: new (Let's go), started (the bar and where to pick up), or done (two figures and the
 * next move, from the setup's own "where you stand"). A plan built on its own pages first (the whole-plan guide's
 * steps all done) counts as done too: the questions would only show what is there.
 */
export function setupCard(plan, { off = [], today = null } = {}) {
  const sp = setupProgress(plan);
  const whole = journeyStatus(journeyById("whole-plan"), plan, { off });
  if (sp.finished || (!sp.started && whole.complete)) {
    let st = null;
    try { st = today ? standing(plan, { today }) : null; } catch { st = null; }
    return { state: "done", href: "#/overview/setup/done", netWorth: st?.netWorth ?? null, spare: st?.spare ?? null, move: st?.moves?.[0] ?? null };
  }
  if (sp.started && sp.at && sp.at !== "welcome") {
    const at = SETUP_SCREENS.find((x) => x.id === sp.at);
    return { state: "started", href: `#/overview/setup/${sp.at}`, q: at?.q ?? sp.q ?? 1, total: QUESTIONS, share: sp.share, next: NEXT_LABEL[sp.at] ?? null };
  }
  return { state: "new", href: "#/overview/setup/you", total: QUESTIONS };
}
const NEXT_LABEL = { you: "who the plan is for", money: "what comes in", ages: "your ages", have: "what you have", "have-amounts": "how much is in each", owe: "what you owe", "owe-amounts": "each debt", spend: "a typical month", goals: "what you're working toward", "goal-details": "how much, and by when", done: "where you stand" };

/** compute(plan, { today?, off? }) -> { empty, firstRun, opensHere, featured, setup, tiles, rows, more, resume, hasAccounts } */
export function compute(plan, params = {}) {
  const off = params.off ?? [], today = params.today ?? null;
  const rows = ROWS.map((id) => {
    if (id === "quick") return { ...QUICK, status: null };
    const j = journeyById(id), s = journeyStatus(j, plan, { off, today });
    return { id, icon: j.icon, title: j.title, line: s.line, href: guideHref(id), status: s.finished ? "Done" : s.started ? `In progress: ${s.doneCount} of ${s.total} steps done` : null };
  });
  const active = activeSummary(plan, { off, today });
  return {
    empty: isEmptyPlan(plan), firstRun: firstRun(plan), opensHere: opensHere(plan, { today }),
    featured: featured(plan, { off }), rows, more: MORE,
    setup: setupCard(plan, { off, today }),
    tiles: TILES.map((t) => {
      const j = t.href ? null : journeyById(t.id);
      const s = j ? journeyStatus(j, plan, { off, today }) : null;
      return { id: t.id, icon: t.icon ?? j.icon, title: t.title, line: t.line, href: t.href ?? guideHref(t.id), page: t.page ?? "overview/guide", status: !s ? null : s.finished ? "Done" : s.started ? `${s.doneCount} of ${s.total}` : null };
    }),
    // the whole plan's own progress is the featured panel, so it gets no second card
    resume: active && !active.complete && active.id !== "whole-plan" ? active : null,
    hasAccounts: L(plan, "accounts").length > 0,
  };
}

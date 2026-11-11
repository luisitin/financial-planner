// modules/overview/start/compute.js -- PURE. Get started: the choices, what the featured "Build my plan" panel
// says for this plan (the path, overview/guide's "plan" journey), the guide being followed (the resume card), and whether opening the app with no page in the
// address should land here instead of on the dashboard.
import { journeyById, journeyStatus, activeSummary, guideHref, pathSummary, PATH_ID, PLAN_HREF } from "../guide/compute.js";
import { progress as setupProgress, standing, SCREENS as SETUP_SCREENS, QUESTIONS } from "../setup/compute.js";
import { compute as dashboardSteps } from "../dashboard/compute.js";

/** Every choice the page offers (written to plan.guide.chosen when tapped). */
// ("whole-plan" stays: a plan may already hold it as guide.chosen.id; the path itself is "plan")
export const CHOICE_IDS = ["setup", "whole-plan", "plan", "quick", "debt", "budget", "home", "retire", "taxes", "protect", "life", "more", "look"];
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
/**
 * The featured panel: Build my plan / Continue my plan / See your plan, from the path (pathSummary). The same shape as
 * before the path: { state: new | started | done, label, line, href, doneCount, total }.
 */
export function featured(plan, { off = [], today = null } = {}) {
  const p = pathSummary(plan, { off, today });
  if (p.complete) return { state: "done", label: "See your plan", line: `All ${p.total} steps are done. See your whole plan on one page.`, href: p.planHref, doneCount: p.doneCount, total: p.total };
  if (!p.started || !p.next) return { state: "new", label: "Build my plan", line: journeyById(PATH_ID).line, href: "#/overview/setup/you", doneCount: 0, total: p.total };
  return { state: "started", label: "Continue my plan", line: `Step ${p.step} of ${p.total}. Next: ${p.next.name.charAt(0).toLowerCase()}${p.next.name.slice(1)}.`, href: p.next.href, doneCount: p.doneCount, total: p.total };
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
 * next move, from the setup's own "where you stand"). A plan built on its own pages first (the Dashboard's first five
 * steps all done: accounts, people, income, expenses, goals; the sixth, assumptions, is left out) counts as done too:
 * the questions would only show what is there. The path's first step uses the same five.
 */
export function setupCard(plan, { off = [], today = null } = {}) {
  const sp = setupProgress(plan);
  const builtByHand = dashboardSteps(plan).steps.filter((x) => x.key !== "assumptions").every((x) => x.done);
  if (sp.finished || (!sp.started && builtByHand)) {
    let st = null;
    try { st = today ? standing(plan, { today }) : null; } catch { st = null; }
    return { state: "done", href: "#/overview/setup/done", netWorth: st?.netWorth ?? null, spare: st?.spare ?? null, move: st?.moves?.[0] ?? null };
  }
  if (sp.started && sp.at && sp.at !== "welcome") {
    const at = SETUP_SCREENS.find((x) => x.id === sp.at);
    return { state: "started", href: `#/overview/setup/${sp.at}`, q: at?.q ?? sp.q ?? 1, total: QUESTIONS, share: sp.share, next: NEXT_LABEL[sp.at] ?? null };
  }
  // started and left on the welcome screen (Let's go tapped, no answer yet): the path counts as started, so every page says
  // "question 1 of 7" rather than one page "Continue" and another "Let's go" (stress test 2026-11-11, review of the next-step table)
  if (sp.started) return { state: "started", href: "#/overview/setup/you", q: 1, total: QUESTIONS, share: 0, next: NEXT_LABEL.you };
  return { state: "new", href: "#/overview/setup/you", total: QUESTIONS };
}
const NEXT_LABEL = { you: "who the plan is for", money: "what comes in", ages: "your ages", have: "what you have", "have-amounts": "how much is in each", owe: "what you owe", "owe-amounts": "each debt", spend: "a typical month", goals: "what you're working toward", "goal-details": "how much, and by when", done: "where you stand" };

/** compute(plan, { today?, off? }) -> { empty, firstRun, opensHere, featured, path, setup, tiles, rows, more, resume, hasAccounts } */
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
    featured: featured(plan, { off, today }), rows, more: MORE, path: pathSummary(plan, { off, today }),
    setup: setupCard(plan, { off, today }),
    tiles: TILES.map((t) => {
      const j = t.href ? null : journeyById(t.id);
      const s = j ? journeyStatus(j, plan, { off, today }) : null;
      // a guide's tile says it is a few short steps, and how long (stress test 2026-11-11, j-one-answer/A2: the line promised
      // an answer and the tap opened a guide); the eight tiles and their fold stay as the owner chose (2026-11-06)
      const steps = s ? `${s.total} step${s.total === 1 ? "" : "s"}, about ${s.minutes ?? 10} min.`.replace(" min.", " minutes") : null;
      return { id: t.id, icon: t.icon ?? j.icon, title: t.title, line: t.line, steps, href: t.href ?? guideHref(t.id), page: t.page ?? "overview/guide", status: !s ? null : s.finished ? "Done" : s.started ? `${s.doneCount} of ${s.total}` : null };
    }),
    // the path's own progress is the featured panel, so it gets no second card
    resume: active && !active.complete && active.id !== PATH_ID ? active : null,
    hasAccounts: L(plan, "accounts").length > 0,
  };
}

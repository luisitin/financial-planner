// modules/overview/guide/compute.js -- PURE. Where each step-by-step guide stands for this plan: which steps
// count, which are done (worked out from the plan's own data, as the dashboard's setup steps are), the next
// one, which step a page is, and what the shell draws around a page while a guide is followed. Also the
// small changes a tap makes to plan.guide (each returns true only when it changed something, so a view can
// skip a save that would change nothing). Everything returned is plain data: no functions.
import { JOURNEYS } from "./journeys.js";
export { JOURNEYS } from "./journeys.js";

/** The guide's own pages: no bar or card is drawn on them. */
export const OWN_PAGES = ["overview/guide", "overview/start", "overview/quick"];
/** A followed guide stops showing its bar when nothing was tapped in it for this many days. */
export const STALE_DAYS = 30;

export const journeyById = (id) => JOURNEYS.find((j) => j.id === id) ?? null;
export const guideHref = (id) => `#/overview/guide/${id}`;
/** href for a step: "#/<page>?guide=<id>&step=<key>" (ids and keys are kebab-case: nothing to escape). */
export const stepHref = (journeyId, step, viaAlt = false) => `#/${viaAlt && step.alt ? step.alt.page : step.page}?guide=${journeyId}&step=${step.key}`;
const progressOf = (plan, id) => plan?.guide?.journeys?.[id] ?? {};
const plain = (step) => { if (!step) return null; const { check, show, variant, ...rest } = step; return { ...rest, hasCheck: !!check }; };
const safe = (fn, plan, today = null) => { try { return !!fn(plan, { today }); } catch { return false; } };

/**
 * The guide as it reads for this plan: a journey's `variant(plan, { today })` may return other words for the guide
 * (line, haveReady, more, moreTitle, finish) and, under `steps`, for each step by key: an object of fields that replace
 * the step's own, or null to leave the step out (the retirement guide for a household already retired: no "what you
 * save from each paycheck", today's spending instead of "once you stop working"; round 4, 2026-11-02).
 */
export function forPlan(journey, plan, today = null) {
  let v = null;
  try { v = journey?.variant ? journey.variant(plan, { today }) : null; } catch { v = null; }
  if (!v) return journey;
  const { steps: per = {}, ...top } = v;
  const steps = journey.steps.flatMap((s) => (!(s.key in per) ? [s] : per[s.key] === null ? [] : [{ ...s, ...per[s.key] }]));
  return { ...journey, ...top, steps };
}

/** Steps that count for this plan: an extra step whose show() is false is hidden, and so is an extra whose page is off on this device. Numbered (required) steps always count. */
export function visibleSteps(journey, plan, off = []) {
  return journey.steps.filter((s) => !s.optional || ((!s.show || safe(s.show, plan)) && !off.includes(s.page)));
}

/** "done" | "none" | "later" | "todo": the plan's data first, then a look-only step's tick, then "does not apply", then "skipped for now". */
export function stepState(step, plan, progress = {}, today = null) {
  if (step.check && safe(step.check, plan, today)) return "done";
  if (step.looked && progress.done?.[step.key]) return "done";
  if (progress.none?.[step.key]) return "none";
  if (progress.later?.[step.key]) return "later";
  return "todo";
}
const finishedState = (st) => st === "done" || st === "none";

/** Everything a view needs about one guide. Counts and "finished" are about the numbered steps only; extras have their own count. */
export function journeyStatus(base, plan, { off = [], today = null } = {}) {
  const journey = forPlan(base, plan, today);
  const prog = progressOf(plan, journey.id);
  let n = 0;
  const steps = visibleSteps(journey, plan, off).map((s) => {
    const state = stepState(s, plan, prog, today);
    return { ...plain(s), optional: !!s.optional, index: s.optional ? null : ++n, state, href: stepHref(journey.id, s) };
  });
  for (const s of steps) {
    const need = (s.needs ?? []).map((k) => steps.find((x) => x.key === k)).find((x) => x && !finishedState(x.state));
    s.blockedBy = need ? { key: need.key, index: need.index, short: need.short, href: need.href } : null;
  }
  const req = steps.filter((s) => !s.optional), extras = steps.filter((s) => s.optional);
  const doneCount = req.filter((s) => finishedState(s.state)).length;
  const complete = doneCount === req.length;
  const marks = ["done", "none", "later"].some((k) => Object.keys(prog[k] ?? {}).length > 0);
  // the next step to do: one that can be done now first (never one waiting on a skipped step while another is free)
  const free = (s) => !s.blockedBy;
  const next = req.find((s) => s.state === "todo" && free(s)) ?? req.find((s) => s.state === "later" && free(s)) ?? req.find((s) => s.state === "todo") ?? req.find((s) => s.state === "later") ?? null;
  return {
    id: journey.id, title: journey.title, icon: journey.icon, line: journey.line, minutes: journey.minutes, haveReady: journey.haveReady ?? null,
    steps, doneCount, total: req.length, complete, finished: complete || !!prog.finishedAt,
    extrasLeft: extras.filter((s) => !finishedState(s.state)).length, extrasTotal: extras.length,
    started: !!prog.startedAt || marks, startedAt: prog.startedAt ?? null, finishedAt: prog.finishedAt ?? null,
    next: next ? { key: next.key, index: next.index, short: next.short, title: next.title, href: next.href } : null,
    nextExtra: (() => { const x = extras.find((s) => s.state === "todo" && free(s)) ?? extras.find((s) => s.state === "todo"); return x ? { key: x.key, short: x.short, title: x.title, href: x.href } : null; })(),
    more: (journey.more ?? []).filter((m) => !off.includes(m.page)), moreTitle: journey.moreTitle ?? "More on this",
    finish: journey.finish, guideHref: guideHref(journey.id),
  };
}

/**
 * Which step this page is in one guide: the step named in the address when it is on this page (or its alt
 * page); else the first not-done step whose own page this is; else one reached by its alt page; else the
 * first step on this page at all. A page used twice (Buy a home: goals/house) moves on as steps get done.
 */
export function stepForPage(status, pageKey, stepKey) {
  const on = (s) => s.page === pageKey, viaAlt = (s) => s.alt?.page === pageKey;
  const named = stepKey ? status.steps.find((s) => s.key === stepKey && (on(s) || viaAlt(s))) : null;
  if (named) return { step: named, viaAlt: !on(named) };
  const open = (s) => !finishedState(s.state);
  const pick = status.steps.find((s) => on(s) && open(s)) ?? status.steps.find((s) => viaAlt(s) && open(s)) ?? status.steps.find(on) ?? status.steps.find(viaAlt);
  return pick ? { step: pick, viaAlt: !on(pick) } : null;
}

/** prev: the step before in order (numbered, then extras). next: the first open step (to do or skipped) that can be done now, after this one, else before it (wrapped); one that needs an earlier step only when no other is left; else null. */
export function neighbours(status, step) {
  const i = status.steps.findIndex((s) => s.key === step.key);
  const open = (s) => s.state === "todo" || s.state === "later";
  const ready = (s) => open(s) && !s.blockedBy;   // a step that needs an earlier one only when nothing else is left
  const after = status.steps.slice(i + 1), before = status.steps.slice(0, Math.max(0, i));
  const next = after.find(ready) ?? before.find(ready) ?? after.find(open) ?? before.find(open) ?? null;
  return { prev: i > 0 ? status.steps[i - 1] : null, next, wrapped: !!next && before.includes(next) };
}

const daysBetween = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5;
/** The guide being followed, or null: plan.guide.active, unless nothing was tapped in it for STALE_DAYS. */
export function activeJourney(plan, today) {
  const g = plan?.guide ?? {};
  const j = g.active ? journeyById(g.active) : null;
  if (!j) return null;
  if (today && g.activeAt && daysBetween(g.activeAt, today) > STALE_DAYS) return null;
  return j;
}

/**
 * What the shell draws around a page. null = nothing.
 *  - "guide": the address names the followed guide (?guide=<active>): the bar with what to do, and the next-step card.
 *  - "compact": the page is a step of the followed guide but was reached another way (the menu, a page's own link):
 *    one line, only while that step is still to do, and never once the guide is complete.
 *  - "quick": opened from Quick answers (?from=quick) and no guide applies.
 *  - "review": opened from a step of the Monthly review (?from=review&review=YYYY-MM), unless the address names the
 *    followed guide (then "guide"); it wins over "compact".
 * Only plan.guide.active switches a guide on; query.step only picks which step (inside the followed guide).
 */
export function barFor(plan, { page, query = {}, off = [], today = null } = {}) {
  if (!page || OWN_PAGES.includes(page)) return null;
  const review = query.from === "review" && page !== "overview/monthly-review" ? { mode: "review", month: /^\d{4}-\d{2}$/.test(query.review ?? "") ? query.review : null } : null;
  const j = activeJourney(plan, today);
  if (j) {
    const status = journeyStatus(j, plan, { off, today });
    const full = query.guide === j.id;
    // opened from a Monthly review step, the way back to the check-in wins over the followed guide's one-line reminder
    // (the guide's own address, ?guide=, still shows the full bar)
    if (review && !full) return review;
    const found = stepForPage(status, page, full ? query.step : undefined);
    if (found) {
      const { step, viaAlt } = found;
      const show = full || (!status.complete && !finishedState(step.state));
      if (show) {
        const nb = neighbours(status, step);
        const lite = (s) => (s ? { key: s.key, index: s.index, short: s.short, title: s.title, href: s.href, optional: s.optional, state: s.state } : null);
        return {
          mode: full ? "guide" : "compact", journey: { id: j.id, title: j.title, icon: j.icon }, step, viaAlt, index: step.index, total: status.total,
          doneCount: status.doneCount, state: step.state, prev: lite(nb.prev), next: lite(nb.next), wrapped: nb.wrapped, complete: status.complete,
          guideHref: status.guideHref, blockedBy: step.blockedBy,
        };
      }
    }
  }
  if (query.from === "quick") return { mode: "quick" };
  // a step of the Monthly review (?from=review&review=2026-10): one line back to the check-in
  if (review) return review;
  return null;
}

/** For Get started and the dashboard (designer D2): the guide being followed, if any. */
export function activeSummary(plan, { off = [], today = null } = {}) {
  const j = activeJourney(plan, today);
  if (!j) return null;
  const s = journeyStatus(j, plan, { off, today });
  return { id: s.id, title: s.title, icon: s.icon, doneCount: s.doneCount, total: s.total, complete: s.complete, next: s.next, guideHref: s.guideHref };
}

// ---------------------------------------------------------------- changes (each on a draft inside store.update)
const ensure = (draft, id) => {
  draft.guide = draft.guide ?? {};
  draft.guide.journeys = draft.guide.journeys ?? {};
  const j = (draft.guide.journeys[id] = draft.guide.journeys[id] ?? {});
  for (const k of ["done", "none", "later"]) j[k] = j[k] ?? {};
  return j;
};
const touch = (draft, today) => { if (today) draft.guide.activeAt = today; };
/** Follow guide `id`. No change when it is already followed, started and was tapped today (a guide gone quiet comes back). */
export function startGuide(draft, id, today) {
  if (!journeyById(id)) return false;
  if (draft.guide?.active === id && draft.guide?.journeys?.[id]?.startedAt && (!today || draft.guide.activeAt === today)) return false;
  const j = ensure(draft, id);
  j.startedAt = j.startedAt ?? today;
  draft.guide.active = id; touch(draft, today);
  return true;
}
/** A tap inside the followed guide (Next, All steps...): remember the day, at most once a day, so the guide does not go quiet while it is used. */
export function touchGuide(draft, today) {
  if (!draft.guide?.active || !today || draft.guide.activeAt === today) return false;
  draft.guide.activeAt = today;
  return true;
}
/** Tick a look-only step (Next on it). */
export function markLooked(draft, id, key, today) {
  if (draft.guide?.journeys?.[id]?.done?.[key]) return false;
  const j = ensure(draft, id);
  j.done[key] = today; delete j.later[key]; touch(draft, today);
  return true;
}
/** "Does not apply": counts as done. Removes a "skipped" mark for the same step. */
export function markNone(draft, id, key, today) {
  if (draft.guide?.journeys?.[id]?.none?.[key]) return false;
  const j = ensure(draft, id);
  j.none[key] = today; delete j.later[key]; touch(draft, today);
  // "I won't get Social Security": saved as the setup's own "none" for each adult with no figure, as the retirement pages'
  // notice does, so the Dashboard, Retirement contributions and the retirement check stop asking for it
  if (key === "ss") {
    const ss = draft.retirement?.socialSecurity ?? {};
    draft.guide.setup = draft.guide.setup ?? {}; draft.guide.setup.ss = draft.guide.setup.ss ?? {};
    for (const p of draft.household?.people ?? []) if (p.role !== "dependent" && !(Number(ss[p.id]?.monthlyAtFRA) > 0) && !(ss[p.id]?.record ?? []).length) draft.guide.setup.ss[p.id] = "none";
  }
  return true;
}
/** "Skipped for now": still to do. Removes a "does not apply" mark for the same step. */
export function markLater(draft, id, key, today) {
  if (draft.guide?.journeys?.[id]?.later?.[key]) return false;
  const j = ensure(draft, id);
  j.later[key] = today; delete j.none[key]; touch(draft, today);
  return true;
}
/** Undo a look, "does not apply" or "skipped" for one step. */
export function clearMark(draft, id, key) {
  const j = draft.guide?.journeys?.[id];
  if (!j || !["done", "none", "later"].some((k) => j[k]?.[key])) return false;
  for (const k of ["done", "none", "later"]) if (j[k]) delete j[k][key];
  return true;
}
/** Stop following the guide; its progress stays. */
export function leaveGuide(draft) {
  if (!draft.guide?.active) return false;
  draft.guide.active = null;
  return true;
}
/** The guide is finished: remember it (it stays "Done" if new data reopens a step) and stop following it. */
export function finishGuide(draft, id, today) {
  const was = draft.guide?.journeys?.[id]?.finishedAt, active = draft.guide?.active === id;
  if (was && !active) return false;
  const j = ensure(draft, id);
  j.finishedAt = was ?? today;
  if (active) draft.guide.active = null;
  return true;
}
/** Look over the steps again: clear the guide's ticks, "does not apply" and "skipped" marks, and follow it. What is in the plan still counts. */
export function restartGuide(draft, id, today) {
  if (!journeyById(id)) return false;
  const j = ensure(draft, id);
  j.done = {}; j.none = {}; j.later = {}; j.startedAt = today; delete j.finishedAt;
  draft.guide.active = id; touch(draft, today);
  return true;
}

/** compute(plan, { id?, off?, today? }) -> { journeys: journeyStatus[], active: activeSummary | null, detail: journeyStatus | null } */
export function compute(plan, params = {}) {
  const off = params.off ?? [], today = params.today ?? null;
  const journeys = JOURNEYS.map((j) => journeyStatus(j, plan, { off, today }));
  const j = params.id ? journeyById(params.id) : null;
  return { journeys, active: activeSummary(plan, { off, today }), detail: j ? journeys.find((s) => s.id === j.id) : null };
}

/**
 * The on-screen labels a step's instruction points at, in the order "Show me where" looks for them: a step's own
 * `target` (one label or several), "+ Add another ..." (shown once a list has rows, with the form folded behind it),
 * the buttons named after "tap" ("tap Add account", "tap Add person or Save changes"), then the folds it names
 * ("open Retirement settings", "under What a paycheck withholds", and the step's `opens`). Labels start with a capital
 * letter or "+"; "tap each paper" names no button.
 */
export function targetsOf(ask, { target = null, opens = null } = {}) {
  const out = [];
  const push = (s) => { const t = String(s ?? "").trim().replace(/\s+/g, " "); if (t && /^[A-Z+]/.test(t) && !out.includes(t)) out.push(t); };
  for (const t of [].concat(target ?? [])) push(t);
  const text = String(ask ?? "");
  for (const m of text.matchAll(/\+ Add another [a-z]+/g)) push(m[0]);
  for (const m of text.matchAll(/\btap ([^,.;()]+)/gi)) {
    const phrase = m[1].replace(/\s+(first|for the next|so|to|again)\b.*$/i, "").replace(/\s+and\s+\+.*$/, "");
    for (const part of phrase.split(/\s+or\s+/)) push(part);
  }
  for (const m of text.matchAll(/\b(?:[Oo]pen|under) ([A-Z][^,.;()]*?)(?=,|\.|;|\(| near| lower| and | pick| type| tick|$)/g)) push(m[1]);
  if (opens) push(opens);
  return out;
}

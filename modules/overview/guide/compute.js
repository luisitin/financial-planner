// modules/overview/guide/compute.js -- PURE. Where each step-by-step guide stands for this plan: which steps
// count, which are done (worked out from the plan's own data, as the dashboard's setup steps are), the next
// one, which step a page is, and what the shell draws around a page while a guide is followed. Also the
// small changes a tap makes to plan.guide (each returns true only when it changed something, so a view can
// skip a save that would change nothing). Everything returned is plain data: no functions.
import { JOURNEYS, PATH_ID, PATH_STEPS, pathVariant } from "./journeys.js";
export { JOURNEYS, PATH_ID } from "./journeys.js";

/** The guide's own pages: no bar or card is drawn on them. */
export const OWN_PAGES = ["overview/guide", "overview/start", "overview/quick"];
/** Pages that lead the way on themselves (the questions, and the finished plan): the frame draws nothing on them either. */
export const SELF_LED = ["overview/setup", "overview/plan"];
/** Where the path ends. */
export const PLAN_PAGE = "overview/plan";
export const PLAN_HREF = "#/overview/plan";
/** A followed guide stops showing its bar when nothing was tapped in it for this many days. */
export const STALE_DAYS = 30;

export const journeyById = (id) => JOURNEYS.find((j) => j.id === id) ?? null;
export const guideHref = (id) => `#/overview/guide/${id}`;
/** href for a step: "#/<page>?guide=<id>&step=<key>" (ids and keys are kebab-case: nothing to escape). */
export const stepHref = (journeyId, step, viaAlt = false) => `#/${viaAlt && step.alt ? step.alt.page : step.page}?guide=${journeyId}&step=${step.key}`;
const progressOf = (plan, id) => plan?.guide?.journeys?.[id] ?? {};
const plain = (step) => { if (!step) return null; const { check, show, variant, waits, ...rest } = step; return { ...rest, hasCheck: !!check }; };
const safe = (fn, plan, today = null) => { try { return !!fn(plan, { today }); } catch { return false; } };

/**
 * The guide as it reads for this plan: a journey's `variant(plan, { today })` may return other words for the guide
 * (line, haveReady, more, moreTitle, finish) and, under `steps`, for each step by key: an object of fields that replace
 * the step's own, or null to leave the step out (the retirement guide for a household already retired: no "what you
 * save from each paycheck", today's spending instead of "once you stop working"; round 4, 2026-11-02).
 */
export function forPlan(journey, plan, today = null, off = []) {
  // the path: its steps come from partsFor, which is cached (the frame asks on every page and after every save)
  if (journey?.id === PATH_ID) return { ...journey, steps: partsFor(plan, { today, off }) };
  let v = null;
  try { v = journey?.variant ? journey.variant(plan, { today, off }) : null; } catch { v = null; }
  if (!v) return journey;
  const { steps: per = {}, ...top } = v;
  const steps = journey.steps.flatMap((s) => (!(s.key in per) ? [s] : per[s.key] === null ? [] : [{ ...s, ...per[s.key] }]));
  return { ...journey, ...top, steps };
}

// ---------------------------------------------------------------- the path's steps, cached
// Which steps of the path apply is worked out live (a new loan adds one, the last card paid off drops one) and only
// `fix-retire` runs a projection. The frame asks on every page and after every save, so the answer is kept twice:
//  1. by the plan object, for page views with no save in between;
//  2. by the plan's content without the parts a tap changes (guide.journeys, active, activeAt, chosen, meta), because
//     store.update clones the whole plan on every update and every Next tap is one.
const partsByPlan = new WeakMap();
let partsLast = null;
const contentKey = (plan) => {
  const g = plan?.guide ?? {};
  return JSON.stringify({ ...plan, meta: undefined, guide: { ...g, journeys: undefined, active: undefined, activeAt: undefined, chosen: undefined } });
};
const ALWAYS = ["answers", "month", "cushion", "retire"];
function buildParts(plan, today, off) {
  let v = null;
  try { v = pathVariant(plan, { today, off }); } catch { v = null; }
  const per = v?.steps ?? Object.fromEntries(PATH_STEPS.filter((s) => !ALWAYS.includes(s.key) || off.includes(s.page)).map((s) => [s.key, null]));
  return PATH_STEPS.flatMap((s) => (!(s.key in per) ? [s] : per[s.key] === null ? [] : [{ ...s, ...per[s.key] }]));
}
/** The steps of the path that apply to this plan, in order (raw step definitions). The same array while only ticks change. A plan object counts as unchanged (the store hands out a new one on every change): copy it before changing it. */
export function partsFor(plan, { today = null, off = [] } = {}) {
  const k = `${today}|${[...off].sort().join(",")}`;
  const obj = plan && typeof plan === "object";
  const hit = obj ? partsByPlan.get(plan) : null;
  if (hit && hit.k === k) return hit.steps;
  const content = contentKey(plan);
  let steps;
  if (partsLast && partsLast.content === content && partsLast.k === k) steps = partsLast.steps;
  else { steps = buildParts(plan, today, off); partsLast = { content, k, steps }; }
  if (obj) partsByPlan.set(plan, { k, steps });
  return steps;
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
/** A path step's `waits(plan, { today })` -> { what, href } | null, never throwing. */
const waitingOf = (step, plan, today) => { if (!step.waits) return null; try { const w = step.waits(plan, { today }); return w?.what ? { what: w.what, href: w.href ?? null } : null; } catch { return null; } };

/** Everything a view needs about one guide. Counts and "finished" are about the numbered steps only; extras have their own count. */
export function journeyStatus(base, plan, { off = [], today = null } = {}) {
  const journey = forPlan(base, plan, today, off);
  const prog = progressOf(plan, journey.id);
  const isPath = journey.id === PATH_ID;
  let n = 0;
  const steps = visibleSteps(journey, plan, off).map((s) => {
    const state = stepState(s, plan, prog, today);
    const row = { ...plain(s), optional: !!s.optional, index: s.optional ? null : ++n, state, href: stepHref(journey.id, s) };
    if (isPath) {
      // passed: the person tapped Next on it (or it is marked "does not apply"); step 1 is passed when it is done
      row.passed = s.key === "answers" ? finishedState(state) : !!prog.done?.[s.key] || state === "none";
      row.byData = !!(s.check && safe(s.check, plan, today));   // done by what the plan holds, not only by Next
      row.waiting = waitingOf(s, plan, today);
    }
    return row;
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
  // the path resumes at the first step not passed, else the first not done (pathSummary's rule)
  const next = isPath ? (req.find((s) => !s.passed) ?? req.find((s) => !finishedState(s.state)) ?? null)
    : (req.find((s) => s.state === "todo" && free(s)) ?? req.find((s) => s.state === "later" && free(s)) ?? req.find((s) => s.state === "todo") ?? req.find((s) => s.state === "later") ?? null);
  return {
    id: journey.id, title: journey.title, icon: journey.icon, line: journey.line, minutes: journey.minutes, haveReady: journey.haveReady ?? null,
    // the path is "Done" only when every step that applies now is done (new data can add a step later); never journeys.plan.finishedAt
    steps, doneCount, total: req.length, complete, finished: isPath ? complete : complete || !!prog.finishedAt,
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

// ---------------------------------------------------------------- the path: where a person stands, and what Next does
const hasAnyData = (plan) => ["accounts", "income", "expenses", "goals", "transactions"].some((k) => Array.isArray(plan?.[k]) && plan[k].length > 0) || (plan?.household?.people ?? []).length > 0;
const stepName = (s) => s.name ?? s.short;
/**
 * pathSummary(plan, { off, today }) -> where the person is on the path. Cheap on purpose (the frame asks on every page):
 * it never runs standing(), protectionGaps() or answerFor(); only partsFor, which caches its one projection.
 *   started   the questions were started, or the path was, or the plan holds something
 *   complete  every step that applies now is done (never journeys.plan.finishedAt: new data can add a step later)
 *   step      the position (1-based) of `next`; total the number of steps that apply
 *   next      where to resume: the first step not passed, else the first not done, else null
 *   parts     every step: state, passed, waiting (what its page cannot answer without), href
 *   gaps      the parts that are waiting
 *   changed   { added, removed } step names against the list saved at the last Next tap, or null
 */
export function pathSummary(plan, { off = [], today = null } = {}) {
  const s = journeyStatus(journeyById(PATH_ID), plan, { off, today });
  const prog = progressOf(plan, PATH_ID);
  const parts = s.steps.map((x) => ({ key: x.key, name: stepName(x), title: x.title, page: x.page, state: x.state, passed: !!x.passed, done: finishedState(x.state), waiting: x.waiting, href: x.href }));
  const nextStep = s.next ? s.steps.find((x) => x.key === s.next.key) : null;
  const next = nextStep ? { key: nextStep.key, name: stepName(nextStep), page: nextStep.page, short: nextStep.short, title: nextStep.title, href: nextStep.href } : null;
  const nowKeys = parts.map((x) => x.key), was = Array.isArray(prog.parts) ? prog.parts : null;
  const nameOf = (k) => { const d = PATH_STEPS.find((x) => x.key === k); return d ? stepName(d) : k; };
  const added = was ? nowKeys.filter((k) => !was.includes(k)).map(nameOf) : [], removed = was ? was.filter((k) => !nowKeys.includes(k)).map(nameOf) : [];
  return {
    started: !!plan?.guide?.setup?.startedAt || !!prog.startedAt || hasAnyData(plan),
    complete: s.complete && parts.length > 0, step: next ? nowKeys.indexOf(next.key) + 1 : null, total: parts.length, doneCount: s.doneCount,
    next, parts, gaps: parts.filter((x) => x.waiting),
    changed: added.length || removed.length ? { added, removed } : null,
    planHref: PLAN_HREF,
  };
}
/**
 * nextAfter(plan, key, { off, today }) -> { key, name, href, kind: "next" | "still" | "finish" }: what the Next button on
 * step `key` goes to. The first step after it that is not passed yet ("next"); else the first step that is not done
 * anywhere ("still"); else the end, Your plan ("finish"). On a first walk-through that is simply the next step in
 * order, done by data or not, so each step's page is seen once; after a jump back it never walks the steps passed again.
 */
export function nextAfter(plan, key, { off = [], today = null } = {}) {
  const sum = pathSummary(plan, { off, today });
  const i = sum.parts.findIndex((p) => p.key === key);
  const order = PATH_STEPS.findIndex((p) => p.key === key);
  const after = i >= 0 ? sum.parts.slice(i + 1) : sum.parts.filter((p) => PATH_STEPS.findIndex((x) => x.key === p.key) > order);
  const pick = (p, kind) => ({ key: p.key, name: p.name, href: p.href, kind });
  const n = after.find((p) => !p.passed);
  if (n) return pick(n, "next");
  const st = sum.parts.find((p) => p.key !== key && !p.done);
  if (st) return pick(st, "still");
  return { key: null, name: "Your plan", href: PLAN_HREF, kind: "finish" };
}

/** The rows of Your plan in order, by group. `step` ties a row to a step of the path (shown when it applies); `data` rows show whenever the plan holds data. */
export const RESULT_ROWS = [
  { key: "net", group: 0, name: "What you own, minus what you owe", page: "balance/net-worth", data: (p) => (p?.accounts ?? []).length > 0 },
  { key: "month", group: 0, step: "month", name: "Your month", page: "cashflow/expenses" },
  { key: "debts", group: 0, step: "debts", name: "Your debts", page: "debt/payoff" },
  { key: "cushion", group: 0, step: "cushion", name: "Emergency fund", page: "balance/liquidity" },
  { key: "protect", group: 1, step: "protect", name: "Life insurance for your family", page: "insurance/life-needs" },
  { key: "retire", group: 1, step: "retire", name: "Your retirement", page: "retirement/projection" },
  { key: "fix-retire", group: 1, step: "fix-retire", name: "What would help", page: "scenarios/goal-seek" },
  { key: "take-out", group: 1, step: "take-out", name: "Where to take money from", page: "retirement/withdrawal-strategy" },
  { key: "rmd", group: 1, step: "rmd", name: "The yearly amount the law requires", page: "retirement/rmd" },
  { key: "goals", group: 2, name: "Your goals", page: "goals/goals", data: (p) => (p?.goals ?? []).length > 0 },
  { key: "home", group: 2, step: "home", name: "The home you can afford", page: "goals/house" },
  { key: "college", group: 2, step: "college", name: "College costs", page: "goals/education" },
  { key: "taxes", group: 2, step: "taxes", name: "This year's tax", page: "taxes/federal" },
];
/** The rows Your plan shows, in order: a row shows when its step applies (or the plan holds its data) and its page is not off. */
export function resultOrder(plan, { off = [], today = null } = {}) {
  const have = new Set(partsFor(plan, { today, off }).map((p) => p.key));
  return RESULT_ROWS.filter((r) => !off.includes(r.page) && (r.step ? have.has(r.step) : r.data ? r.data(plan) : true)).map((r) => ({ key: r.key, name: r.name, page: r.page, group: r.group }));
}

/** The quiet row at the bottom of any page (and the page's last way on): what it says and where it goes. null on a page that leads the way itself. */
function continueFor(plan, { page, off, today }) {
  const sum = pathSummary(plan, { off, today });
  if (sum.complete) return { text: "See your plan ›", href: PLAN_HREF, hidden: "", startPath: false, kind: "done" };
  if (!sum.started || !sum.next) return { text: "Start your plan: a few easy questions ›", href: "#/overview/start", hidden: "", startPath: false, kind: "new" };
  const n = sum.next, ofTotal = `step ${sum.step} of ${sum.total}`;
  // this page is the next step and was reached without the guide in the address: one tap draws the bar
  if (n.page === page) return { text: `This is ${ofTotal} of your plan ›`, href: `#/${page}?guide=${PATH_ID}&step=${n.key}`, hidden: ` ${n.name}`, startPath: true, kind: "here" };
  return { text: `Continue your plan: ${ofTotal} ›`, href: n.href, hidden: ` ${n.name}`, startPath: true, kind: "continue" };
}

/**
 * What the shell draws around a page. null = nothing. On the guide's own pages, the Dashboard and the pages that lead the
 * way themselves (SELF_LED), nothing. Otherwise the first of these that applies:
 *  1. "guide": the address names a guide (?guide=<id>, any of them, followed or not): the bar with what to do, and the
 *     next-step card. For the path (`path: true`) Next is nextAfter, in order.
 *  2. "review": opened from a step of the Monthly review (?from=review&review=YYYY-MM): one line back to the check-in.
 *  3. "quick": opened from Quick answers (?from=quick).
 *  4. "plan": a row of Your plan opened from it (?from=plan), or after the path is complete: "Next result".
 *  5. "compact": the page is a step of the followed guide (not the path) but was reached another way: one line, only while
 *     that step is still to do, and never once the guide is complete.
 *  6. "continue": one quiet row at the bottom: where the path goes on.
 * "review" and "compact" also carry that continue row as `cont`, for their bottom. Only the address switches a guide on
 * for a render; plan.guide.active decides which one "compact" follows.
 */
/**
 * The path step card's sentence (stress test 2026-11-11): it starts with the step's name, the words the Next button that led
 * here used ("Next: Your month ›" opens Expenses; j-first-family/F9, j-first-renter/F9), and while the page waits for
 * something it says so in place of the instruction (j-first-freelancer/F5), the way the card at the bottom does.
 */
export function pathAsk(step) {
  const name = step?.name ?? step?.short ?? "";
  const ask = step?.waiting ? `This step needs ${step.waiting.what} first: add it, or go on and come back to it.` : String(step?.ask ?? "");
  return name ? `${name}. ${ask}` : ask;
}

export function barFor(plan, { page, query = {}, off = [], today = null } = {}) {
  if (!page || OWN_PAGES.includes(page) || SELF_LED.includes(page) || page === "overview/dashboard") return null;
  const cont = () => continueFor(plan, { page, off, today });
  const review = query.from === "review" && page !== "overview/monthly-review" ? { mode: "review", month: /^\d{4}-\d{2}$/.test(query.review ?? "") ? query.review : null } : null;
  const named = query.guide ? journeyById(query.guide) : null;
  const j = named ?? activeJourney(plan, today);
  const full = !!named;
  let compact = null;   // the followed guide's one-line reminder: only after review, quick and plan have had their say
  if (j) {
    const status = journeyStatus(j, plan, { off, today });
    // opened from a Monthly review step, the way back to the check-in wins over the followed guide's one-line reminder
    // (the guide's own address, ?guide=, still shows the full bar)
    if (review && !full) return { ...review, cont: cont() };
    const found = stepForPage(status, page, full ? query.step : undefined);
    if (found) {
      const { step, viaAlt } = found;
      const isPath = j.id === PATH_ID;
      const show = full || (!isPath && !status.complete && !finishedState(step.state));
      if (show) {
        const lite = (s) => (s ? { key: s.key, index: s.index, short: s.short, title: s.title, href: s.href, optional: s.optional, state: s.state } : null);
        const bar = {
          mode: full ? "guide" : "compact", journey: { id: j.id, title: j.title, icon: j.icon }, step, viaAlt, index: step.index, total: status.total,
          doneCount: status.doneCount, state: step.state, complete: status.complete, guideHref: status.guideHref, blockedBy: step.blockedBy,
        };
        if (isPath) {
          const ps = pathSummary(plan, { off, today });
          const i = status.steps.findIndex((x) => x.key === step.key), prev = i > 0 ? status.steps[i - 1] : null;
          // Back goes to the step before; from step 2 to the questions' end screen only when they were finished (opening it
          // would mark them finished), else to the list of steps
          const back = !prev ? { href: status.guideHref, label: "All steps", index: null }
            : prev.key === "answers" ? { href: plan?.guide?.setup?.finishedAt ? "#/overview/setup/done" : status.guideHref, label: prev.name ?? prev.short, index: prev.index }
              : { href: prev.href, label: prev.name ?? prev.short, index: prev.index };
          return { ...bar, step: { ...step, ask: pathAsk(step) }, path: true, prev: lite(prev), next: lite(status.next), after: nextAfter(plan, step.key, { off, today }), back, changed: ps.changed, waiting: step.waiting ?? null, name: step.name ?? step.short, ownAction: step.ownAction ?? null, hasLeft: ps.parts.some((x) => !x.done && x.key !== step.key) };
        }
        const nb = neighbours(status, step);
        const out = { ...bar, prev: lite(nb.prev), next: lite(nb.next), wrapped: nb.wrapped };
        if (bar.mode === "guide") return out;
        compact = { ...out, cont: cont() };
      }
    }
  }
  if (review) return { ...review, cont: cont() };
  if (query.from === "quick") return { mode: "quick" };
  // Your plan's rows, opened from it (or any time the plan is complete): the next result, and the way back
  const rows = resultOrder(plan, { off, today });
  const ri = rows.findIndex((r) => r.page === page);
  if (ri >= 0 && (query.from === "plan" || pathSummary(plan, { off, today }).complete)) {
    const nx = rows[ri + 1] ?? null;
    return { mode: "plan", planHref: PLAN_HREF, next: nx ? { name: nx.name, page: nx.page, href: `#/${nx.page}?from=plan` } : null };
  }
  if (compact) return compact;
  return { mode: "continue", ...cont() };
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

/**
 * Next on a step of the path: tick it as passed (even when it is already done, so it counts as seen), save the list of
 * steps that apply (so "we added a step" can be said), follow the path, and, only when no step is left open, finish it.
 * Returns true only when something changed. Used inside store.update on a draft.
 */
export function passStep(draft, key, today, off = []) {
  let changed = markLooked(draft, PATH_ID, key, today);
  const keys = partsFor(draft, { today, off }).map((s) => s.key);
  const j = ensure(draft, PATH_ID);
  if (JSON.stringify(j.parts) !== JSON.stringify(keys)) { j.parts = keys; changed = true; }
  if (startGuide(draft, PATH_ID, today)) changed = true;
  if (pathSummary(draft, { off, today }).complete && finishGuide(draft, PATH_ID, today)) changed = true;
  return changed;
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

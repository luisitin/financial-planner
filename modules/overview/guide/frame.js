// modules/overview/guide/frame.js -- DOM only. The shell hook (docs/CONVENTIONS.md "Shell hook: frame"): what is drawn
// above and below a page while a step-by-step guide is followed, or when the page was opened from Quick answers.
// The shell renders the page into its own <div data-page>, so a page that clears and redraws itself never wipes these.
//   guide    the bar (what to do here, and Next once the step is done) and the next-step card. For the path (Your plan) the
//            smaller bar without its own Next, and one Next at the bottom: the next step in order, "Still to do", or the end
//   compact  one line on a step page reached another way (menu, a page's own link), while that step is still to do
//   quick    "‹ Quick answers" and the question on top, "Another question?" below; one page later, "‹ Back to: <the question>"
//   review   "‹ Back to the October 2026 check-in" on a page opened from a Monthly review step
//   plan     a result page opened from Your plan: "‹ Your plan" on top, "Next result" below
//   continue one quiet row at the bottom of every other page: where the path goes on (also under review and compact)
import { barFor, OWN_PAGES, SELF_LED, PATH_ID, PLAN_HREF, startGuide, passStep, markLooked, markNone, markLater, clearMark, targetsOf } from "./compute.js";
import { questionFor } from "../quick/compute.js";
import { ageOn } from "../../../core/math/dates.js";
import { offKeys, usable, change, lowerFirst, isDirty, controlValue } from "./act.js";

let pending = null;          // a green line for the top of the next render
let ai = { on: false, at: 0 };   // the AI's last known state, checked at most once a minute
const TRAIL = "planner.quickTrail", GTRAIL = "planner.guideTrail";

const STYLE = `
.gb-root { margin: 0 0 14px; }
.gb-root .gb-head { display: flex; align-items: center; gap: 10px; min-height: 44px; margin: -6px 0 0; }
.gb-root .gb-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 650; color: var(--text); }
.gb-root .gb-all, .gb-root .gb-back, .gn-root .gn-links a, .gb-root .gb-next a, .gb-root .gb-first a { display: inline-flex; align-items: center; min-height: 44px; font-weight: 600; }
.gb-root .gb-all { flex: none; }
.gb-root .gb-sub { font-size: var(--fs-sm); color: var(--text-2); font-variant-numeric: tabular-nums; margin-top: -4px; }
.gb-root .gb-track { height: 4px; border-radius: 999px; background: var(--line); overflow: hidden; margin: 8px 0 0; }
.gb-root .gb-track > span { display: block; height: 100%; background: var(--accent); }
.gb-root .gb-task { margin: 12px 0 0; color: var(--text); }
.gb-root .gb-task b { font-weight: 650; }
.gb-root .gb-title { margin: 12px 0 0; font-weight: 650; color: var(--text); }
.gb-root .gb-title + .gb-task { margin-top: 2px; color: var(--text-2); line-height: 1.45; }
.gb-root .gb-show { margin-top: 10px; }
.gb-root .gb-show[hidden] { display: none; }
.gb-ring { outline: 3px solid var(--accent) !important; outline-offset: 4px; border-radius: var(--radius-sm); animation: gb-ring 2s ease-out forwards; }
@keyframes gb-ring { 0%, 75% { outline-color: var(--accent); } 100% { outline-color: transparent; } }
@media (prefers-reduced-motion: reduce) { .gb-ring { animation: none; } }
.gb-toast { position: fixed; left: 12px; right: 12px; bottom: calc(12px + env(safe-area-inset-bottom, 0px)); z-index: 40; max-width: 560px; margin: 0 auto; display: flex; gap: 12px; align-items: center; padding: 10px 12px 10px 16px; border-radius: var(--radius); background: var(--panel); border: 1px solid var(--accent); box-shadow: var(--shadow); }
.gb-toast p { flex: 1; margin: 0; color: var(--text); font-size: var(--fs-sm); line-height: 1.4; }
.gb-toast button { flex: none; min-height: 44px; min-width: 56px; }
.gb-root .gb-first { margin-top: 2px; }
.gb-root .gb-state { margin: 12px 0 8px; color: var(--text); }
.gb-root .gb-next { display: flex; justify-content: flex-end; margin-top: 4px; }
.gb-root .gb-go { width: 100%; }
.gb-tick { color: var(--ok); font-weight: 700; }
.gb-compact { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; padding: 0 12px; margin: 0 0 14px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--panel); color: var(--text-2); font-size: var(--fs-sm); }
.gb-compact > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gb-compact a { flex: none; display: inline-flex; align-items: center; min-height: 44px; font-weight: 600; }
.gb-cont { margin: 14px 0 0; justify-content: flex-start; }
.gb-root .gb-line { margin: 8px 0 0; color: var(--text-2); font-size: var(--fs-sm); line-height: 1.4; }
.gb-root .gb-line.gb-changed { color: var(--text); }
.gb-root .gb-links { display: flex; flex-wrap: wrap; align-items: center; gap: 0 16px; margin-top: 4px; }
.gb-root .gb-links[hidden], .gb-root .gb-links > [hidden] { display: none; }
.gn-root .gn-state a { font-weight: 600; display: inline-flex; align-items: center; min-height: 44px; padding: 0 6px; }
.gn-root .gn-links .gn-back { margin-right: auto; }
.gb-quick .gb-back { margin: -6px 0 0; }
.gb-quick .gb-task { margin-top: 4px; color: var(--text-2); }
.gn-root.card { margin-top: 20px; }
.gn-root > h2.gn-k { font-size: var(--fs-sm); font-weight: 600; color: var(--text-2); margin: 0 0 8px; font-variant-numeric: tabular-nums; }
.gn-root .gn-state { margin: 0 0 12px; }
.gn-root .gn-main { display: flex; flex-direction: column; gap: 8px; }
.gn-root .gn-main .btn, .gn-root .gn-main button { width: 100%; }
.gn-root .gn-links { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0 16px; margin-top: 6px; }
.gb-textbtn { background: none; border: 0; color: var(--accent-ink); padding: 0 4px; min-height: 44px; font-weight: 600; font: inherit; font-weight: 600; cursor: pointer; }
.gb-root .vh, .gn-root .vh, .gb-compact .vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
@media (min-width: 720px) { .gn-root .gn-main { align-items: flex-start; } .gn-root .gn-main .btn, .gn-root .gn-main button, .gb-root .gb-go { width: auto; min-width: 300px; } }
`;

/** What a path step's card says while it is still to do (the wording of the spec, 6.2). */
const READ_ONLY = "Read it, then go on. Nothing to type here.";
const PATH_STATE = {
  cushion: READ_ONLY, "take-out": READ_ONLY, rmd: READ_ONLY, college: READ_ONLY, "fix-retire": READ_ONLY,
  retire: "Read the answer at the top, then go on.",
  protect: "Read the answer at the top, then go on.",
  month: "Most of this is our guesses (marked \"our guess\"). Type what you know, or go on: the plan uses our guesses until you do.",
  debts: "Tap Save plan to keep it, or go on: nothing is lost.",
  home: "These are typical figures. Tap Work it out to keep them, or type yours first, or go on: nothing is lost.",
  taxes: "No pay stub at hand? Go on: we estimate it from your pay.",
};
const YEARS_AWAY = "This is years away, and small steps now count the most. Read the answer at the top, then go on.";
/** Every adult under 45 (the retirement step says it is years away). */
const allUnder45 = (plan, today) => { const ad = (plan?.household?.people ?? []).filter((x) => x.role !== "dependent"); return ad.length > 0 && ad.every((x) => x.birthDate && ageOn(x.birthDate, today) < 45); };

const readTrail = (name) => { try { return JSON.parse(sessionStorage.getItem(name) || "null"); } catch { return null; } };
const writeTrail = (name, t) => { try { if (t) sessionStorage.setItem(name, JSON.stringify(t)); else sessionStorage.removeItem(name); } catch { } };
const writeGuideTrail = (t) => writeTrail(GTRAIL, t);

/**
 * Open the page's fold titled `title` (a <details> whose summary says it), the one the step's ask names, every time the
 * page draws it anew (pages that redraw themselves make a new one). One the person shuts stays shut until the next draw.
 */
function openFold(page, title) {
  const seen = new WeakSet();
  const run = () => {
    for (const d of page.querySelectorAll("details")) {
      if (seen.has(d)) continue;
      seen.add(d);
      const s = d.querySelector(":scope > summary");
      if (!d.open && s && s.textContent.includes(title)) d.open = true;
    }
  };
  try { new MutationObserver(run).observe(page, { childList: true, subtree: true }); } catch { }
}

/**
 * The first element on the page a step's labels name, drawn or inside a closed fold: a button, link or fold whose text
 * starts with the label, or a form box whose label is exactly it ("Type": the box itself, so the ring is on it).
 */
function findTarget(page, labels) {
  const norm = (x) => String(x ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  const shown = (e) => e.getClientRects().length > 0 || e.closest("details:not([open])");
  const els = [...page.querySelectorAll("button, a, summary, [role=button], input[type=submit]")];
  const boxes = [...page.querySelectorAll("label")].map((l) => ({ name: norm(l.querySelector(".field-label")?.textContent ?? l.textContent), box: l.control ?? l.querySelector("input, select, textarea") })).filter((x) => x.box);
  for (const l of labels) {
    const want = norm(l);
    const hit = els.find((e) => norm(e.textContent || e.value).startsWith(want) && shown(e)) ?? boxes.find((x) => x.name === want && shown(x.box))?.box;
    if (hit) return hit;
  }
  return null;
}
/**
 * Scroll to it (opening any fold around it), focus it (a form's Add button: the form's first box), ring it for two
 * seconds; then the step's instruction stays in a strip at the bottom of the screen for a while (`ask`), since the
 * scroll moved the bar off screen.
 */
function showTarget(el, ask = null, ui = null) {
  for (let d = el.closest("details:not([open])"); d; d = d.parentElement?.closest("details:not([open])")) d.open = true;
  const submit = el.form && (el.type === "submit");
  const box = el.matches("input, select, textarea");
  const ring = submit ? el.form.closest(".card") ?? el.form : el.tagName === "SUMMARY" ? el.parentElement : box ? el.closest("label") ?? el : el;
  const focusEl = submit ? el.form.querySelector("input:not([type=hidden]):not([type=checkbox]), select, textarea") ?? el : el;
  let still = false;
  try { still = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { }
  ring.style.scrollMarginTop = "88px";
  ring.scrollIntoView({ block: submit ? "start" : "center", behavior: still ? "auto" : "smooth" });
  try { focusEl.focus({ preventScroll: true }); } catch { }
  ring.classList.remove("gb-ring"); void ring.offsetWidth; ring.classList.add("gb-ring");
  setTimeout(() => ring.classList.remove("gb-ring"), 2200);
  if (ask && ui) {
    document.querySelector(".gb-toast")?.remove();
    const close = () => toast.remove();
    const toast = ui.h("div", { class: "gb-toast", role: "status" }, ui.h("p", {}, ask), ui.h("button", { type: "button", class: "secondary small", onClick: close }, "OK"));
    document.body.append(toast);
    setTimeout(() => { if (toast.isConnected) close(); }, 9000);
    window.addEventListener("hashchange", close, { once: true });
  }
}

function checkAi(ctx) {
  if (Date.now() - ai.at < 60000) return;
  ai.at = Date.now();
  Promise.resolve().then(() => ctx.ai.status()).then((s) => { ai.on = String(s).startsWith("on"); }).catch(() => { ai.on = false; });
}

/** frame(ctx, page) -> { before, after } | null. `page` is the <div data-page> the page renders into. */
export function frame(ctx, page) {
  const { ui, fmt } = ctx;
  const key = `${ctx.module.group}/${ctx.module.id}`;
  const today = fmt.today();
  const bar = barFor(ctx.plan, { page: key, query: ctx.route.query ?? {}, off: offKeys(ctx), today });
  const style = ui.h("style", {}, STYLE);
  const note = pending; pending = null;
  const noteEl = note ? (() => { const n = ui.notice("ok", note); n.setAttribute("role", "status"); ctx.announce?.(note); return n; })() : null;

  // one page of "‹ Back to ..." after a quick answer, or after a step page whose own link or button moved on to a page that is
  // not a step (in this tab only). The quiet continue row does not clear them: it is drawn with them
  let trail = readTrail(TRAIL), gtrail = readTrail(GTRAIL);
  const resting = OWN_PAGES.includes(key) || SELF_LED.includes(key) || key === "overview/dashboard";
  const real = bar && bar.mode !== "continue" ? bar : null;
  if (resting || real) { if (real?.mode !== "quick") writeTrail(TRAIL, null); writeTrail(GTRAIL, null); trail = gtrail = null; }
  if (real?.mode === "quick") { const q = questionFor(key); writeTrail(TRAIL, q ? { page: key, title: q.title } : null); trail = null; }
  const hop = (t, name) => { if (!t || t.page === key) return null; if (!t.hop || t.hop === key) { t.hop = key; writeTrail(name, t); return t; } writeTrail(name, null); return null; };
  if (!resting && !real) { gtrail = ctx.plan.guide?.active === gtrail?.journey ? hop(gtrail, GTRAIL) : (writeTrail(GTRAIL, null), null); trail = gtrail ? null : hop(trail, TRAIL); }

  // the quiet row at the bottom of a page (Your plan's way on); it keeps the path going when it is tapped
  const contRow = (c) => (c ? ui.h("nav", { class: "gb-compact gb-cont", "aria-label": "Your plan" },
    ui.h("a", { href: c.href, onClick: () => { if (c.startPath) change(ctx, (q) => startGuide(q, PATH_ID, today)); } }, c.text, c.hidden ? ui.h("span", { class: "vh" }, c.hidden) : null)) : null);

  if (!real) {
    const isPath = gtrail?.journey === PATH_ID;
    const back = gtrail ? ui.h("a", { href: gtrail.href }, isPath ? "‹ Back to your plan" : `‹ Back to the guide: ${gtrail.title}`) : trail ? ui.h("a", { href: `#/${trail.page}?from=quick` }, `‹ Back to: ${trail.title}`) : null;
    const row = contRow(bar);
    const top = back ? ui.h("nav", { class: "gb-compact", "aria-label": gtrail ? (isPath ? "Back to your plan" : "Back to your guide") : "Back to your quick answer" }, back) : null;
    if (top || noteEl) return { before: ui.h("div", {}, style, noteEl, top), after: row ? ui.h("div", {}, style, row) : null };
    return row ? { before: null, after: ui.h("div", {}, style, row) } : null;
  }

  if (bar.mode === "review") {
    const M = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const name = bar.month ? `${M[Number(bar.month.slice(5, 7)) - 1]} ${bar.month.slice(0, 4)}` : "monthly";
    const row = contRow(bar.cont);
    return { before: ui.h("div", {}, style, noteEl, ui.h("nav", { class: "gb-compact", "aria-label": "Back to your monthly check-in" }, ui.h("a", { href: bar.month ? `#/overview/monthly-review?month=${bar.month}` : "#/overview/monthly-review", dataset: { back: "" } }, `‹ Back to the ${name} check-in`))), after: row ? ui.h("div", {}, style, row) : null };
  }

  if (bar.mode === "quick") {
    const q = questionFor(key);
    return {
      before: ui.h("div", {}, style, noteEl, ui.h("nav", { class: "card gb-root gb-quick", "aria-label": "Quick answers" },
        ui.h("a", { href: "#/overview/quick", class: "gb-back", dataset: { back: "" } }, "‹ Quick answers"),
        q ? ui.h("p", { class: "gb-task" }, ui.h("b", {}, q.title), ` ${q.hint ?? "Type your own numbers below."}`) : null)),
      after: ui.h("section", { class: "card gn-root", "aria-labelledby": "gn-q-h" },
        ui.h("h2", { id: "gn-q-h" }, "Another question?"),
        ui.h("div", { class: "gn-main" }, ui.h("a", { href: "#/overview/quick", class: "btn secondary", dataset: { back: "" } }, "Back to quick answers"))),
    };
  }

  if (bar.mode === "plan") {
    // a result page opened from Your plan (or any time the plan is complete): the next result, and the way back
    return {
      before: ui.h("div", {}, style, noteEl, ui.h("nav", { class: "gb-compact", "aria-label": "Your plan" }, ui.h("a", { href: PLAN_HREF, dataset: { back: "" } }, "‹ Your plan"))),
      after: ui.h("section", { class: "card gn-root", "aria-labelledby": "gn-p-h" },
        ui.h("h2", { class: "gn-k", id: "gn-p-h" }, "Your plan"),
        ui.h("div", { class: "gn-main" }, bar.next ? ui.h("a", { href: bar.next.href, class: "btn secondary" }, `Next result: ${bar.next.name} ›`) : ui.h("a", { href: PLAN_HREF, class: "btn secondary", dataset: { back: "" } }, "Back to your plan ›")),
        bar.next ? ui.h("div", { class: "gn-links" }, ui.h("a", { href: PLAN_HREF, dataset: { back: "" } }, "‹ Back to your plan")) : null),
    };
  }

  const { journey: j, step, next } = bar;
  const where = step.optional ? "Extra step" : `Step ${bar.index} of ${bar.total}`;
  const stepHrefFull = `#/${bar.viaAlt && step.alt ? step.alt.page : step.page}?guide=${j.id}&step=${step.key}`;

  // typing that is not saved yet: each control's value when first focused, compared when a guide link is tapped
  const starts = new WeakMap();
  page.addEventListener("focusin", (e) => { const c = e.target; if (c?.matches?.("input, select, textarea") && !starts.has(c)) starts.set(c, controlValue(c)); });
  let warned = false;
  const warnSlots = [];
  const slot = () => { const s = ui.h("div", {}); warnSlots.push(s); return s; };
  const WARN = "You typed something on this page that is not saved yet. Tap the page's own button (Save, Add, Compare...) first, or tap again to leave without it.";
  /** Leaving with typing that was not saved: the first tap warns, a second tap goes. */
  const guard = (e) => {
    if (warned || !isDirty(page.querySelectorAll("input, select, textarea"), starts)) return true;
    e.preventDefault(); warned = true;
    for (const s of warnSlots) s.replaceChildren(ui.notice("error", WARN));
    ctx.announce?.(WARN);
    return false;
  };

  if (bar.mode === "compact") {
    // its link redraws this page with the guide's bar, so it is guarded like the bar's own links
    return { before: ui.h("div", {}, style, noteEl, ui.h("nav", { class: "gb-compact", "aria-label": `Guide: ${j.title}` },
      ui.h("span", {}, `Following: ${j.title}`),
      ui.h("a", { href: stepHrefFull, onClick: (e) => guard(e) }, `${where} ›`, ui.h("span", { class: "vh" }, ` of ${j.title}: show what to do here`))), slot()), after: bar.cont ? ui.h("div", {}, style, contRow(bar.cont)) : null };
  }

  // ---- the path (Your plan): a smaller bar with no Next of its own, and one Next at the bottom
  if (bar.path) return pathMode();

  // ---- full guide mode
  // remembered for one page, in case this page's own link or button moves on to a page that is not a step
  writeGuideTrail({ journey: j.id, title: j.title, page: key, href: stepHrefFull });
  const blocked = !!bar.blockedBy && step.state === "todo";
  const isLooked = step.looked && step.state === "todo" && !blocked;
  // any tap in the bar follows this guide (it may have been opened by its address while another was followed, 3.2): startGuide
  // sets plan.guide.active and the day, and changes nothing once the guide is followed and was tapped today
  const touch = () => change(ctx, (q) => startGuide(q, j.id, today));
  const tickLooked = () => { if (isLooked) change(ctx, (q) => { const a = startGuide(q, j.id, today); const b = markLooked(q, j.id, step.key, today); return a || b; }); else touch(); };
  const nav = (href, label, cls, before = touch) => ui.h("a", { href, class: cls, onClick: (e) => { if (guard(e)) before?.(); } }, label);
  const nextLabel = (n) => !n ? null : bar.wrapped ? (n.index ? `Back to step ${n.index}: ${n.short} ›` : `Still to do: ${n.short} ›`) : `Next: ${n.short} ›`;
  const finishedLabel = "See the finished guide ›";
  const allLabel = bar.complete ? finishedLabel : "All steps ›";
  const undo = () => ui.h("button", { type: "button", class: "gb-textbtn", onClick: () => { pending = "Undone: this step is back on your list."; change(ctx, (q) => clearMark(q, j.id, step.key)); } }, "Undo");
  const finishedState = step.state === "done" || step.state === "none";
  const noneSaid = step.noneSaid ?? "You said this does not apply.";
  const ask = bar.viaAlt && step.alt?.ask ? step.alt.ask : step.ask;
  // the fold the ask names ("Lower down, under ..."), opened while the step is still to do
  const opens = bar.viaAlt ? step.alt?.opens : step.opens;
  if (opens && !blocked && (step.state === "todo" || step.state === "later")) openFold(page, opens);
  const needLine = blocked ? `This step needs ${bar.blockedBy.index ? `step ${bar.blockedBy.index}` : "an earlier step"} first.` : null;

  // the bar
  const pct = bar.total ? Math.round(100 * bar.doneCount / bar.total) : 0;
  // "Show me where": drawn once the page shows a button, link or fold the instruction names
  const labels = targetsOf(ask, { target: bar.viaAlt ? step.alt?.target : step.target, opens });
  let showBtn = null;
  if (labels.length && !blocked && step.state !== "none") {
    showBtn = ui.h("button", { type: "button", class: "secondary small gb-show", hidden: true, onClick: () => { const t = findTarget(page, labels); if (t) showTarget(t, ask, ui); } }, "Show me where");
    let queued = false;
    const check = () => { queued = false; showBtn.hidden = !findTarget(page, labels); };
    const later = () => { if (!queued) { queued = true; requestAnimationFrame(check); } };
    later();
    try { const mo = new MutationObserver(later); mo.observe(page, { childList: true, subtree: true }); } catch { }
  }
  const task = blocked
    ? [ui.h("p", { class: "gb-task" }, needLine), ui.h("div", { class: "gb-first" }, nav(bar.blockedBy.href, `${bar.blockedBy.short} ›`, null))]
    : step.state === "none" ? null
      : [ui.h("p", { class: "gb-title" }, step.title), ui.h("p", { class: "gb-task" }, ask), showBtn];
  const barNext = finishedState
    ? ui.h("div", {},
      ui.h("p", { class: "gb-state" }, step.state === "done" ? [ui.h("span", { class: "gb-tick", "aria-hidden": "true" }, "✓ "), "This step is done."] : [noneSaid, " ", undo()]),
      next ? nav(next.href, nextLabel(next), "btn gb-go") : bar.complete ? nav(bar.guideHref, finishedLabel, "btn gb-go") : null)
    : isLooked && next ? ui.h("div", { class: "gb-next" }, nav(next.href, nextLabel(next), null, tickLooked)) : null;
  const before = ui.h("div", {}, style, noteEl,
    ui.h("nav", { class: "card gb-root", "aria-label": `Guide: ${j.title}` },
      ui.h("div", { class: "gb-head" },
        ui.h("span", { class: "gb-name" }, j.title),
        nav(bar.guideHref, ["All steps ›", ui.h("span", { class: "vh" }, ` of ${j.title}`)], "gb-all", tickLooked)),
      ui.h("div", { class: "gb-sub" }, step.optional ? `Extra step · ${bar.doneCount} of ${bar.total} main steps done` : `${where} · ${bar.doneCount} done`),
      ui.h("div", { class: "gb-track", "aria-hidden": "true" }, ui.h("span", { style: { width: `${pct}%` } })),
      task, barNext, slot()));

  // the next-step card
  const stateLine = step.state === "done" ? [ui.h("span", { class: "gb-tick", "aria-hidden": "true" }, "✓ "), "This step is done."]
    : step.state === "none" ? [noneSaid, " ", undo()]
      : step.state === "later" ? ["Skipped for now. ", undo()]
        : blocked ? [needLine]
          : isLooked && !step.hasCheck ? ["Have a look above. When you are done, tap the button below; that counts this step as done."]
            : [ui.h("b", {}, "Not done yet: "), step.doneWhen ?? "save what this page asks for."];
  const skip = () => { if (step.state === "todo" && change(ctx, (q) => { const a = startGuide(q, j.id, today); const b = markLater(q, j.id, step.key, today); return a || b; })) pending = `Skipped for now: ${lowerFirst(step.short)}. It stays on your list under All steps.`; else touch(); };
  const main = [];
  if (blocked) main.push(nav(bar.blockedBy.href, bar.blockedBy.index ? `Do step ${bar.blockedBy.index} first: ${bar.blockedBy.short} ›` : `Do this first: ${bar.blockedBy.short} ›`, "btn"));
  else if (finishedState) main.push(next ? nav(next.href, nextLabel(next), "btn secondary") : nav(bar.guideHref, finishedLabel, "btn secondary"));
  else if (isLooked) main.push(next ? nav(next.href, nextLabel(next), "btn", tickLooked) : nav(bar.guideHref, bar.doneCount + (step.optional ? 0 : 1) >= bar.total ? finishedLabel : "Back to all steps ›", "btn", tickLooked));
  else if (next) main.push(nav(next.href, `Skip to: ${next.short} ›`, "btn secondary", skip));   // the last open step: "All steps ›" below is the way back
  if (step.alt && !finishedState) {
    const otherHref = bar.viaAlt ? `#/${step.page}?guide=${j.id}&step=${step.key}` : `#/${step.alt.page}?guide=${j.id}&step=${step.key}`;
    const otherLabel = bar.viaAlt ? `Or do it on ${ctx.modules.get(step.page)?.title ?? "its own page"} ›` : `${step.alt.label} ›`;
    if (usable(ctx, bar.viaAlt ? step.page : step.alt.page)) main.push(nav(otherHref, otherLabel, "btn secondary"));
  }
  if (step.none && (step.state === "todo" || step.state === "later")) {
    main.push(ui.h("button", { type: "button", class: "secondary", onClick: () => { pending = `Noted: ${lowerFirst(noneSaid)}`; change(ctx, (q) => { const a = startGuide(q, j.id, today); const b = markNone(q, j.id, step.key, today); return a || b; }); } }, step.none));
  }
  checkAi(ctx);
  const help = ai.on && usable(ctx, "ai/assistant") ? nav("#/ai/assistant", "Ask the app a question ›", null)
    : usable(ctx, "system/help") ? nav("#/system/help", "Questions? See the help ›", null) : null;
  const after = ui.h("section", { class: "card gn-root", "aria-labelledby": "gn-h" },
    ui.h("h2", { class: "gn-k", id: "gn-h" }, `${where} · ${step.title}`),
    slot(),
    ui.h("p", { class: "gn-state" }, stateLine),
    main.length ? ui.h("div", { class: "gn-main" }, main) : null,
    ui.h("div", { class: "gn-links" }, main.some((el) => el.getAttribute?.("href") === bar.guideHref) ? ui.h("span", {}) : nav(bar.guideHref, [allLabel, ui.h("span", { class: "vh" }, ` of ${j.title}`)], null, tickLooked), help));
  return { before, after };

  /**
   * The path: the bar says only where you are and what to do (no step title, no "All steps", no Next of its own); the card
   * at the bottom has the page's one Next. Next ticks the step as passed and goes on in order (nextAfter): the next step,
   * "Still to do" for one skipped earlier, or the end. Nothing blocks.
   */
  function pathMode() {
    const off = offKeys(ctx);
    const doneNow = step.state === "done" || step.state === "none";
    const touchP = () => change(ctx, (q) => startGuide(q, PATH_ID, today));
    const navP = (href, label, cls, before = touchP, aria = null) => ui.h("a", { href, class: cls, "aria-label": aria, onClick: (e) => { if (guard(e)) before?.(); } }, label);
    writeGuideTrail({ journey: j.id, title: j.title, page: key, href: stepHrefFull });
    const noneSaid = step.noneSaid ?? "You said this does not apply.";
    const undo = () => ui.h("button", { type: "button", class: "gb-textbtn", onClick: () => { pending = "Undone: this step is back on your list."; change(ctx, (q) => clearMark(q, j.id, step.key)); } }, "Undo");
    // the bar says where you are: step 4 of 4 is a full bar (steps done may be fewer: a skipped one is still to do)
    const pct = bar.total ? Math.round(100 * Math.max(bar.doneCount, bar.index ?? 0) / bar.total) : 0;

    // "Show me where": drawn once the page shows a button, link or fold the instruction names
    const labels = targetsOf(step.ask, { target: step.target, opens: step.opens });
    let showBtn = null;
    if (labels.length && step.state !== "none") {
      showBtn = ui.h("button", { type: "button", class: "gb-textbtn gb-show", hidden: true, onClick: () => { const t = findTarget(page, labels); if (t) showTarget(t, step.ask, ui); } }, "Show me where");
      let queued = false;
      const check = () => { queued = false; showBtn.hidden = !findTarget(page, labels); };
      const later = () => { if (!queued) { queued = true; requestAnimationFrame(check); } };
      later();
      try { new MutationObserver(later).observe(page, { childList: true, subtree: true }); } catch { }
    }
    // "Done? Go to Next": a long page (taxes, the forecast, spending) is easier to leave from the top; hidden on a short one
    let afterEl = null;
    const goDown = ui.h("button", { type: "button", class: "gb-textbtn", hidden: true, onClick: () => {
      if (!afterEl) return;
      let still = false;
      try { still = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { }
      afterEl.scrollIntoView({ block: "center", behavior: still ? "auto" : "smooth" });
      try { afterEl.querySelector(".gn-main .btn")?.focus({ preventScroll: true }); } catch { }
    } }, "Done? Go to Next ↓");
    let tall = false;
    const measure = () => { tall = false; try { tall = document.documentElement.scrollHeight > window.innerHeight * 1.5; } catch { } goDown.hidden = !tall; };
    try { requestAnimationFrame(measure); new MutationObserver(() => requestAnimationFrame(measure)).observe(page, { childList: true, subtree: true }); } catch { }

    const ch = bar.changed;
    const changed = ch ? [ch.added.length ? `We added a step because of what you told us: ${ch.added.join(", ")}.` : null, ch.removed.length ? `One step is no longer needed: ${ch.removed.join(", ")}.` : null].filter(Boolean) : [];
    const barEl = ui.h("nav", { class: "card gb-root", "aria-label": "Your plan" },
      ui.h("div", { class: "gb-head" }, ui.h("span", { class: "gb-name" }, `Your plan · ${where}`)),
      ui.h("div", { class: "gb-track", "aria-hidden": "true" }, ui.h("span", { style: { width: `${pct}%` } })),
      step.state === "none" ? null : ui.h("p", { class: "gb-task" }, step.ask),
      bar.index === 2 ? ui.h("p", { class: "gb-line" }, "You can leave any time. Your place is saved.") : null,
      changed.map((t) => ui.h("p", { class: "gb-line gb-changed" }, t)),
      showBtn || goDown ? ui.h("div", { class: "gb-links" }, showBtn, goDown) : null,
      slot());

    // the card at the bottom
    const nx = bar.after;
    const nextLabel = nx.kind === "finish" ? "Finish: see your plan ›" : nx.kind === "still" ? `Still to do: ${nx.name} ›` : `Next: ${nx.name} ›`;
    const own = step.ownAction && !doneNow;   // the page's own button (Save plan, Work it out) is the one to press first
    const tick = () => change(ctx, (q) => passStep(q, step.key, today, off));
    const adultsYoung = allUnder45(ctx.plan, today);
    const todoText = step.key === "retire" && adultsYoung ? YEARS_AWAY
      : step.key === "month" && !(ctx.plan.expenses ?? []).length ? "Nothing is typed here yet. Type what you know, or go on: the plan uses our guesses until you do."
        : PATH_STATE[step.key] ?? READ_ONLY;
    const stateLine = bar.waiting ? ["This step needs ", bar.waiting.what, " first. ", bar.waiting.href ? navP(bar.waiting.href, "Add it ›", null) : null, " Or go on and come back to it."]
      : step.state === "none" ? [noneSaid, " ", undo()]
        : doneNow ? [ui.h("span", { class: "gb-tick", "aria-hidden": "true" }, "✓ "), step.byData ? "Done." : "Looked at."]
          : [todoText];
    const main = [navP(nx.href, nextLabel, own ? "btn secondary" : "btn", tick)];
    if (step.none && (step.state === "todo" || step.state === "later")) {
      main.push(ui.h("button", { type: "button", class: "secondary", onClick: () => { pending = `Noted: ${lowerFirst(noneSaid)}`; change(ctx, (q) => markNone(q, j.id, step.key, today)); } }, step.none));
    }
    const back = bar.back;
    afterEl = ui.h("section", { class: "card gn-root", "aria-labelledby": "gn-h" },
      ui.h("h2", { class: "gn-k", id: "gn-h" }, `${where} · ${step.title}`),
      slot(),
      ui.h("p", { class: "gn-state" }, stateLine),
      ui.h("div", { class: "gn-main" }, main),
      ui.h("div", { class: "gn-links" },
        navP(back.href, "‹ Back", "gn-back", touchP, back.index ? `Back to step ${back.index}: ${back.label}` : "Back to all steps"),
        navP(bar.guideHref, "All steps ›", null, touchP)));
    return { before: ui.h("div", {}, style, noteEl, barEl), after: afterEl };
  }
}

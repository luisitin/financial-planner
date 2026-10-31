// modules/overview/guide/frame.js -- DOM only. The shell hook (docs/CONVENTIONS.md "Shell hook: frame"): what is drawn
// above and below a page while a step-by-step guide is followed, or when the page was opened from Quick answers.
// The shell renders the page into its own <div data-page>, so a page that clears and redraws itself never wipes these.
//   guide    the bar (what to do here, and Next once the step is done) and the next-step card
//   compact  one line on a step page reached another way (menu, a page's own link), while that step is still to do
//   quick    "‹ Quick answers" and the question on top, "Another question?" below; one page later, "‹ Back to: <the question>"
import { barFor, OWN_PAGES, markLooked, markNone, markLater, clearMark, touchGuide } from "./compute.js";
import { questionFor } from "../quick/compute.js";
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
.gb-root .gb-first { margin-top: 2px; }
.gb-root .gb-state { margin: 12px 0 8px; color: var(--text); }
.gb-root .gb-next { display: flex; justify-content: flex-end; margin-top: 4px; }
.gb-root .gb-go { width: 100%; }
.gb-tick { color: var(--ok); font-weight: 700; }
.gb-compact { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; padding: 0 12px; margin: 0 0 14px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--panel); color: var(--text-2); font-size: var(--fs-sm); }
.gb-compact > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gb-compact a { flex: none; display: inline-flex; align-items: center; min-height: 44px; font-weight: 600; }
.gb-quick .gb-back { margin: -6px 0 0; }
.gb-quick .gb-task { margin-top: 4px; color: var(--text-2); }
.gn-root > h2.gn-k { font-size: var(--fs-sm); font-weight: 600; color: var(--text-2); margin: 0 0 8px; font-variant-numeric: tabular-nums; }
.gn-root .gn-state { margin: 0 0 12px; }
.gn-root .gn-main { display: flex; flex-direction: column; gap: 8px; }
.gn-root .gn-main .btn, .gn-root .gn-main button { width: 100%; }
.gn-root .gn-links { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0 16px; margin-top: 6px; }
.gb-textbtn { background: none; border: 0; color: var(--accent-ink); padding: 0 4px; min-height: 44px; font-weight: 600; font: inherit; font-weight: 600; cursor: pointer; }
.gb-root .vh, .gn-root .vh, .gb-compact .vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; }
@media (min-width: 720px) { .gn-root .gn-main { align-items: flex-start; } .gn-root .gn-main .btn, .gn-root .gn-main button, .gb-root .gb-go { width: auto; min-width: 300px; } }
`;

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

  // one page of "‹ Back to ..." after a quick answer, or after a step page whose own link or button moved on to a
  // page that is not a step (in this tab only)
  let trail = readTrail(TRAIL), gtrail = readTrail(GTRAIL);
  const resting = OWN_PAGES.includes(key) || key === "overview/dashboard";
  if (resting || bar) { if (bar?.mode !== "quick") writeTrail(TRAIL, null); writeTrail(GTRAIL, null); trail = gtrail = null; }
  if (bar?.mode === "quick") { const q = questionFor(key); writeTrail(TRAIL, q ? { page: key, title: q.title } : null); trail = null; }
  const hop = (t, name) => { if (!t || t.page === key) return null; if (!t.hop || t.hop === key) { t.hop = key; writeTrail(name, t); return t; } writeTrail(name, null); return null; };
  if (!resting && !bar) { gtrail = ctx.plan.guide?.active === gtrail?.journey ? hop(gtrail, GTRAIL) : (writeTrail(GTRAIL, null), null); trail = gtrail ? null : hop(trail, TRAIL); }

  if (!bar) {
    const back = gtrail ? ui.h("a", { href: gtrail.href }, `‹ Back to the guide: ${gtrail.title}`) : trail ? ui.h("a", { href: `#/${trail.page}?from=quick` }, `‹ Back to: ${trail.title}`) : null;
    if (back) return { before: ui.h("div", {}, style, noteEl, ui.h("nav", { class: "gb-compact", "aria-label": gtrail ? "Back to your guide" : "Back to your quick answer" }, back)), after: null };
    return noteEl ? { before: ui.h("div", {}, style, noteEl), after: null } : null;
  }

  if (bar.mode === "quick") {
    const q = questionFor(key);
    return {
      before: ui.h("div", {}, style, noteEl, ui.h("nav", { class: "card gb-root gb-quick", "aria-label": "Quick answers" },
        ui.h("a", { href: "#/overview/quick", class: "gb-back" }, "‹ Quick answers"),
        q ? ui.h("p", { class: "gb-task" }, ui.h("b", {}, q.title), ` ${q.hint ?? "Type your own numbers below."}`) : null)),
      after: ui.h("section", { class: "card gn-root", "aria-labelledby": "gn-q-h" },
        ui.h("h2", { id: "gn-q-h" }, "Another question?"),
        ui.h("div", { class: "gn-main" }, ui.h("a", { href: "#/overview/quick", class: "btn secondary" }, "Back to quick answers"))),
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
      ui.h("a", { href: stepHrefFull, onClick: (e) => guard(e) }, `${where} ›`, ui.h("span", { class: "vh" }, ` of ${j.title}: show what to do here`))), slot()), after: null };
  }

  // ---- full guide mode
  // remembered for one page, in case this page's own link or button moves on to a page that is not a step
  writeGuideTrail({ journey: j.id, title: j.title, page: key, href: stepHrefFull });
  const blocked = !!bar.blockedBy && step.state === "todo";
  const isLooked = step.looked && step.state === "todo" && !blocked;
  const touch = () => change(ctx, (q) => touchGuide(q, today));
  const tickLooked = () => { if (isLooked) change(ctx, (q) => markLooked(q, j.id, step.key, today)); else touch(); };
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
  const task = blocked
    ? [ui.h("p", { class: "gb-task" }, needLine), ui.h("div", { class: "gb-first" }, nav(bar.blockedBy.href, `${bar.blockedBy.short} ›`, null))]
    : step.state === "none" ? null
      : ui.h("p", { class: "gb-task" }, ui.h("b", {}, "On this page: "), lowerFirst(ask));
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
  const skip = () => { if (step.state === "todo" && change(ctx, (q) => markLater(q, j.id, step.key, today))) pending = `Skipped for now: ${lowerFirst(step.short)}. It stays on your list under All steps.`; else touch(); };
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
    main.push(ui.h("button", { type: "button", class: "secondary", onClick: () => { pending = `Noted: ${lowerFirst(noneSaid)}`; change(ctx, (q) => markNone(q, j.id, step.key, today)); } }, step.none));
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
}

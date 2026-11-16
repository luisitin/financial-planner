// modules/system/settings/talk.js -- DOM only. Settings' "How the helper talks to you" (gap list next 60, item 58; X8): one
// shut row, after "Screen", with three chips, Gentle, Plain and Blunt, and one example of each on the same finding.
//
// Drawn only while a page that talks is offered: Ask the plan or Explain a page, switched on, in the build view or with the
// AI helper answering (ctx.shown, core/view.js). The household's view never shows the AI helper's words without the AI
// (design log 2026-11-06), so with no helper there is no row, and Settings' first view is what it was.
// Shut by default (simple first). The shut row says nothing while the helper talks plainly (the default, today's words),
// and "talks gently" or "talks bluntly" otherwise (lower case, like Screen's "larger text" or "dark").
// The choice lives on this device only (../../ai/assistant/tone.js: localStorage planner.tone, planner.tone.sandbox in the
// sandbox), never in the plan: it is how the helper talks to whoever holds this phone, like text size (README).
// The chips are core/ui/more.js choice(). The row is a folded card drawn the way Settings draws its other folded cards
// (Screen, PC connection, AI assistant, Advanced: the owner's, 2026-09-15), not with core/ui/more.js part(): see looks.js
// for why a part on Settings would make the first-view check refuse the page's own folds.
import { choice } from "../../../core/ui/more.js";
import { tone } from "../../ai/assistant/tone.js";
import { TONES, toneOf, DEFAULT_TONE } from "../../ai/assistant/compute.js";

export const TALK_WORDS = Object.freeze({
  title: "How the helper talks to you",
  // the pages' names ("Ask the plan", "Explain a page") are not words a person knows from Settings: what they do instead
  lead: "For the helper that answers your questions and explains pages. Only the words change: the figures still come from your plan.",
  chips: Object.freeze({ gentle: "Gentle", plain: "Plain", blunt: "Blunt" }),
  said: Object.freeze({
    gentle: "Done. The helper now talks to you gently.",
    plain: "Done. The helper talks to you plainly again.",
    blunt: "Done. The helper now talks to you bluntly.",
  }),
  example: "For example, when eating out went over the budget:",
  // one finding, said three ways (invented round figures, the same in each): $460 spent against $400 planned
  examples: Object.freeze({
    gentle: "“Eating out came to $460 this month, a little over the $400 you planned. A quieter week or two would bring it back.”",
    plain: "“Eating out came to $460 this month, $60 over the $400 you planned.”",
    blunt: "“You spent $60 more on eating out than you planned. Cut back for the rest of the month.”",
  }),
  phone: "On this phone only; your plan stays the same.",
});
/** What the shut row says: nothing for Plain (the helper talks as it always did), else "talks gently" or "talks bluntly":
 * words that say what they describe once the row is shut (a bare "blunt" did not). Pure. */
export const saysOf = (t) => (toneOf(t) === DEFAULT_TONE ? "" : `talks ${toneOf(t) === "gentle" ? "gently" : "bluntly"}`);
/** The pages that use the tone (the row is drawn while one of them is offered). */
export const TALK_PAGES = Object.freeze(["ai/assistant", "ai/explain"]);
/** Is a page that talks offered on this device right now? (build view, or the helper answering; the page switched on) */
export function talks(ctx) {
  const on = (m) => !!m && (ctx.features?.enabled?.(m) ?? true) && (ctx.shown ? !!ctx.shown(m) : !!(ctx.view?.build || ctx.live?.ai));
  return TALK_PAGES.some((k) => on(ctx.modules?.get?.(k)));
}

// The shell draws the page again after a chip (ctx.redraw), which would wipe the green line and shut the row: the line
// waits here for that draw, and the row stays open on it.
let said = null;

/** The row, or null when no page that talks is offered. A chip acts at once (no Save) and says so in green under the chips. */
export function talkCard(ctx) {
  if (!talks(ctx)) return null;
  const { ui } = ctx;
  const now = tone.chosen, justSaid = said;
  said = null;
  const says = saysOf(now);
  const out = ui.h("div", { class: "out" });
  if (justSaid) { const note = ui.notice("ok", justSaid); out.append(note); setTimeout(() => { if (note.parentNode === out) note.remove(); }, 6000); }
  const small = (text) => ui.h("p", { class: "small muted", style: { margin: "0" } }, text);
  const line = (t) => ui.h("li", {}, ui.h("strong", {}, `${TALK_WORDS.chips[t]}: `), TALK_WORDS.examples[t]);
  return ui.h("details", { class: "card fold fold-card", open: justSaid ? true : null, dataset: { talk: "" } },
    ui.h("summary", {}, ui.h("h2", {}, TALK_WORDS.title), says ? ui.h("span", { class: "fold-status" }, says) : null, ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
    ui.h("div", { class: "fold-body", style: { display: "grid", gap: "10px" } },
      small(TALK_WORDS.lead),
      choice(ctx, { id: "talk-tone", label: TALK_WORDS.title, presets: TONES.map((t) => ({ value: t, label: TALK_WORDS.chips[t] })), value: now,
        onPick: (v) => { tone.set(v); said = TALK_WORDS.said[toneOf(v)]; ctx.redraw?.(); } }),
      out,
      ui.h("div", {}, ui.h("p", { class: "small", style: { margin: "0 0 4px" } }, TALK_WORDS.example),
        ui.h("ul", { class: "small", style: { margin: "0", paddingLeft: "18px", display: "grid", gap: "6px" } }, TONES.map(line))),
      small(TALK_WORDS.phone)));
}

/** "Erase the copy on this device": the helper talks plainly again (the sandbox's own key in the sandbox). */
export const forgetTalk = () => tone.forget();

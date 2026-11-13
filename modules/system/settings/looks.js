// modules/system/settings/looks.js -- DOM only. Settings' "Screen": one shut row, third after Plan basics and "How much to
// show" (gap design 8; docs/DESIGN_LOG.md 2026-11-13). Inside: the tick "Hide amounts on screen".
//
// Shut by default (simple first): Settings' first view gains one word, the row's name, and nothing else; the row says
// what is changed ("amounts hidden") while it is shut. The name is one plain word because Settings' first view is at its
// allowed count on the empty plan (tests/first-view.known.json: 200 words, 199 before this row), and a count there may
// only go down; the design's own name, "How this phone looks", would take it to 203.
// The choice lives on this phone only, in localStorage planner.look (planner.look.sandbox in the sandbox), kept by
// core/look.js; never in the plan, never sent to the computer.
// The row is a folded card drawn the way Settings draws its other folded cards (PC connection, AI assistant, Advanced:
// the owner's, 2026-09-15), not with core/ui/more.js part(): one part on the page makes the first-view check count
// Settings as drawn with parts and then refuse each of its hand-written folds (the page topics, Advanced). Converting
// those is a redesign of a page the owner reviewed, and not this change's to make.
import { look, HIDE_WORDS } from "../../../core/look.js";

export const WORDS = Object.freeze({
  title: "Screen",
  hide: "Hide amounts on screen",
  hideHelp: "Every amount reads as dots; percentages and dates stay. Boxes you type in still show their figure, and so does anything you print.",
  hideOn: HIDE_WORDS.on,
  hideOff: HIDE_WORDS.off,
  phone: "On this phone only; your plan stays the same.",
});
/** What the shut row says: nothing while the phone looks as it always did, else what is changed. Pure. */
export const saysOf = ({ hide = false } = {}) => (hide ? "amounts hidden" : "");

// The shell draws the page again after a tick (ctx.redraw), which would wipe the green line and shut the row: both wait
// here for that draw.
let said = null;

/**
 * The row. A tick acts at once (no Save), is undone by the same tick, and says so in green under it, where the thumb
 * is; the row stays open on that draw. Nothing here writes the plan; Settings is a System page, so the shell never
 * keeps or replays a tick as typing.
 */
export function lookCard(ctx) {
  const { ui } = ctx;
  const chosen = look.chosen;
  const out = ui.h("div", { class: "out" });
  const again = (text) => { said = text; ctx.redraw?.(); };
  const justSaid = said; said = null;
  if (justSaid) { const note = ui.notice("ok", justSaid); out.append(note); setTimeout(() => { if (note.parentNode === out) note.remove(); }, 6000); }
  const small = (text) => ui.h("p", { class: "small muted", style: { margin: "0" } }, text);
  const says = saysOf(chosen);
  return ui.h("details", { class: "card fold fold-card", open: justSaid ? true : null, dataset: { look: "" } },
    ui.h("summary", {}, ui.h("h2", {}, WORDS.title), says ? ui.h("span", { class: "fold-status" }, says) : null, ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
    ui.h("div", { class: "fold-body", style: { display: "grid", gap: "10px" } },
    ui.h("label", { class: "toggle-row" },
      ui.h("input", { type: "checkbox", name: "look-hide", checked: chosen.hide ? true : null, onChange: (e) => {
        const yes = !!e.target.checked;
        look.set({ hide: yes });
        again(yes ? WORDS.hideOn : WORDS.hideOff);
      } }),
      ui.h("span", { class: "toggle-text" }, WORDS.hide)),
    small(WORDS.hideHelp),
    small(WORDS.phone),
    out));
}

/** "Erase the copy on this device": the phone looks as it did on the first day (the sandbox's own key in the sandbox). */
export const forgetLook = () => look.forget();

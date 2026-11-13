// modules/system/settings/looks.js -- DOM only. Settings' "Screen": one shut row, third after Plan basics and "How much to
// show" (gap designs 8 and 9; docs/DESIGN_LOG.md 2026-11-13). Inside: the tick "Hide amounts on screen", then two rows
// of chips, "Text size" (Usual, Larger, Largest) and "Light or dark" (Like the phone, Light, Dark).
//
// Shut by default (simple first): Settings' first view gains one word, the row's name, and nothing else; the row says
// what is changed ("amounts hidden", "larger text", "dark"; several with commas between) while it is shut. The name is one plain word because Settings' first view is at its
// allowed count on the empty plan (tests/first-view.known.json: 200 words, 199 before this row), and a count there may
// only go down; the design's own name, "How this phone looks", would take it to 203.
// The choice lives on this phone only, in localStorage planner.look (planner.look.sandbox in the sandbox), kept by
// core/look.js; never in the plan, never sent to the computer.
// The chips are core/ui/more.js choice(): presets, no box. The row is a folded card drawn the way Settings draws its other folded cards (PC connection, AI assistant, Advanced:
// the owner's, 2026-09-15), not with core/ui/more.js part(): one part on the page makes the first-view check count
// Settings as drawn with parts and then refuse each of its hand-written folds (the page topics, Advanced). Converting
// those is a redesign of a page the owner reviewed, and not this change's to make.
import { choice } from "../../../core/ui/more.js";
import { look, HIDE_WORDS } from "../../../core/look.js";

export const WORDS = Object.freeze({
  title: "Screen",
  hide: "Hide amounts on screen",
  hideHelp: "Every amount reads as dots; percentages and dates stay. Boxes you type in still show their figure, and so does anything you print.",
  hideOn: HIDE_WORDS.on,
  hideOff: HIDE_WORDS.off,
  text: "Text size",
  texts: Object.freeze({ usual: "Usual", larger: "Larger", largest: "Largest" }),
  textSaid: Object.freeze({
    usual: "Done. Text is back to its usual size.",
    larger: "Done. Text is now larger on this phone.",
    largest: "Done. Text is now at its largest on this phone.",
  }),
  theme: "Light or dark",
  themes: Object.freeze({ phone: "Like the phone", light: "Light", dark: "Dark" }),
  themeSaid: Object.freeze({
    phone: "Done. Light or dark now follows the phone's own setting.",
    light: "Done. The app now stays light on this phone.",
    dark: "Done. The app now stays dark on this phone.",
  }),
  phone: "On this phone only; your plan stays the same.",
});
/** What the shut row says: nothing while the phone looks as it always did; each change in its own words ("amounts hidden",
 * "larger text", "largest text", "light", "dark"), several with commas between ("amounts hidden, largest text, dark": a
 * count, "3 changed", said nothing). One change is at most 20 characters; the longer ones wrap under the title. Pure. */
export function saysOf({ hide = false, text = "usual", theme = "phone" } = {}) {
  const changed = [hide ? "amounts hidden" : null, text === "larger" ? "larger text" : text === "largest" ? "largest text" : null, theme === "light" ? "light" : theme === "dark" ? "dark" : null].filter(Boolean);
  return changed.join(", ");
}

// The shell draws the page again after a tick (ctx.redraw), which would wipe the green line and shut the row: both wait
// here for that draw. { at: "hide" | "text" | "theme", text }: the line is drawn right under the thing that was tapped, so
// it is read where the finger is and the shell has no need to repeat it at the bottom of the screen.
let said = null;

/**
 * The row. A tick or a chip acts at once (no Save), is undone by the same tick or the first chip, and says so in green
 * right under what was tapped; the row stays open on that draw. Nothing here writes the plan; Settings is a System page, so the shell never
 * keeps or replays a tick as typing.
 */
export function lookCard(ctx) {
  const { ui } = ctx;
  const chosen = look.chosen;
  const again = (at, text) => { said = { at, text }; ctx.redraw?.(); };
  const justSaid = said; said = null;
  const out = (at) => {
    if (justSaid?.at !== at) return null;
    const note = ui.notice("ok", justSaid.text), box = ui.h("div", { class: "out" }, note);
    setTimeout(() => { if (note.parentNode === box) note.remove(); }, 6000);
    return box;
  };
  const small = (text) => ui.h("p", { class: "small muted", style: { margin: "0" } }, text);
  const label = (text) => ui.h("div", { style: { fontWeight: "600", marginTop: "6px" } }, text);
  const says = saysOf(chosen);
  return ui.h("details", { class: "card fold fold-card", open: justSaid ? true : null, dataset: { look: "" } },
    ui.h("summary", {}, ui.h("h2", {}, WORDS.title), says ? ui.h("span", { class: "fold-status", style: { whiteSpace: "normal", textAlign: "right" } }, says) : null, ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
    ui.h("div", { class: "fold-body", style: { display: "grid", gap: "10px" } },
    ui.h("label", { class: "toggle-row" },
      ui.h("input", { type: "checkbox", name: "look-hide", checked: chosen.hide ? true : null, onChange: (e) => {
        const yes = !!e.target.checked;
        look.set({ hide: yes });
        again("hide", yes ? WORDS.hideOn : WORDS.hideOff);
      } }),
      ui.h("span", { class: "toggle-text" }, WORDS.hide)),
    out("hide"),
    small(WORDS.hideHelp),
    label(WORDS.text),
    choice(ctx, { id: "look-text", label: WORDS.text, presets: Object.entries(WORDS.texts).map(([value, label]) => ({ value, label })), value: chosen.text,
      onPick: (v) => { look.set({ text: v }); again("text", WORDS.textSaid[v]); } }),
    out("text"),
    label(WORDS.theme),
    choice(ctx, { id: "look-theme", label: WORDS.theme, presets: Object.entries(WORDS.themes).map(([value, label]) => ({ value, label })), value: chosen.theme,
      onPick: (v) => { look.set({ theme: v }); again("theme", WORDS.themeSaid[v]); } }),
    out("theme"),
    small(WORDS.phone)));
}

/** "Erase the copy on this device": the phone looks as it did on the first day (the sandbox's own key in the sandbox). */
export const forgetLook = () => look.forget();

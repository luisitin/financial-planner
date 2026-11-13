// modules/system/settings/show.js -- DOM only. Settings' "How much to show" card, second after Plan basics (the owner's
// "toggles", 2026-11-12 and 2026-11-13; docs/OPTIONAL.md "The two switches"; docs/DESIGN_LOG.md 2026-11-13): two ticks,
// on this phone only, both off unless the person ticks them, and the rows this phone keeps open with "Shut them all".
//
// Its own file because Settings draws no optional part: it only reads and writes this device's choices, which
// core/ui/more.js keeps in localStorage planner.more (planner.more.sandbox in the sandbox), never in the plan. The rest of
// Settings keeps its own folds as the owner reviewed them (2026-09-15), and this card can be drawn in a Node test without
// the PC connection and the AI helper the rest of the page needs.
//
// Short on purpose (simple first; review of opt C7, 2026-11-13): the title, the two ticks and one line, 24 words on
// Settings' first view.
// What a tick opens is said in green the moment it is ticked, and only what is true: every "How this is worked out" is
// drawn by the helper (opt C6), so the first tick opens each one; two forms' "More details (optional)" (Goals, Quick
// answers) are still drawn by hand and stay shut, hence "Most forms" (module.test.mjs finds them in the sources and fails
// when the last one goes, so the words can lose "Most" then).
import { detail, kept, forgetAll, KEEP_DAYS } from "../../../core/ui/more.js";

export const WORDS = Object.freeze({
  title: "How much to show",
  working: "Show how answers are worked out",
  workingOn: "Done. \"How this is worked out\" now starts open on this phone.",
  workingOff: "Done. Pages on this phone open short again.",
  boxes: "Show every box in forms",
  boxesOn: "Done. Most forms on this phone now start with \"More details (optional)\" open.",
  boxesOff: "Done. Forms on this phone open short again.",
  phone: "On this phone only; your plan stays the same.",
  shut: "Shut them all",
});
/** "1 row you opened stays open on this phone. ..." for the rows a person opened by hand and this phone keeps (opt spec F4). */
export const keptWords = (n) => `${n === 1 ? "1 row you opened stays" : `${n} rows you opened stay`} open on this phone. Each shuts by itself if its page goes ${KEEP_DAYS} days without a visit.`;

// The shell draws the page again after a tick (ctx.redraw), which would wipe the green line: it waits here for that draw.
let said = null;

/**
 * The card. A tick acts at once (no Save), is undone by the same tick, and says so in green under the ticks, where the
 * thumb is. Nothing here writes the plan or sends anything to the computer; Settings is a System page, so the shell never
 * keeps or replays a tick as typing (core/place.js neverKept).
 */
export function howMuchCard(ctx) {
  const { ui } = ctx;
  const chosen = detail.chosen;
  const out = ui.h("div", { class: "out" });
  const again = (text) => { said = text; ctx.redraw?.(); };
  const tick = (key, label, on, off) => ui.h("label", { class: "toggle-row" },
    ui.h("input", { type: "checkbox", name: `show-${key}`, checked: chosen[key] ? true : null, onChange: (e) => {
      const yes = !!e.target.checked;
      detail.set({ [key]: yes });
      again(yes ? on : off);
    } }),
    ui.h("span", { class: "toggle-text" }, label));
  const n = kept.count();
  const card = ui.card(WORDS.title,
    tick("working", WORDS.working, WORDS.workingOn, WORDS.workingOff),
    tick("boxes", WORDS.boxes, WORDS.boxesOn, WORDS.boxesOff),
    ui.h("p", { class: "small muted", style: { margin: "8px 0 0" } }, WORDS.phone),
    n ? ui.h("p", { class: "small", style: { margin: "10px 0 0" } }, keptWords(n)) : null,
    n ? ui.row(ui.button(WORDS.shut, () => { kept.clear("open"); again(n === 1 ? "Done. That row starts shut again." : "Done. Those rows start shut again."); }, { class: "secondary" })) : null,
    out);
  if (said) { const note = ui.notice("ok", said); out.append(note); said = null; setTimeout(() => { if (note.parentNode === out) note.remove(); }, 4000); }
  return card;
}

/** "Erase the copy on this device": both ticks and every row kept open go too (the sandbox's own in the sandbox). */
export const forgetShown = () => forgetAll();

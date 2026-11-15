// modules/balance/net-worth/labels-view.js -- DOM only, through ctx.ui. The pieces Net worth and Holdings draw for the
// person's own labels (gap next-60 #44): the labels box of a form with a chip for each label already used, the reading of
// that box at Save, and the row of chips that narrows a list to one label. The rules live in labels.js (pure).
import { LABEL_MAX, cleanLabels, spellAs, tooLong, toggleIn, sameLabel } from "./labels.js";

/** The labels box of a form (under "More details (optional)") and, under it, a chip for each label already used in the plan:
 * a tap adds it to the box, a second tap takes it out. Shared with Holdings. */
export const LABELS_FIELD = { key: "labelsText", label: "Your own labels", type: "text", more: true, help: "For example, kids or retirement. Commas between two or more." };
export function labelPicks(ui, form, known) {
  const box = form?.querySelector?.('[name="labelsText"]');
  const lab = box?.closest?.("label");
  if (!box || !lab || !known.length) return null;
  const chips = known.map((l) => ui.h("button", { type: "button", class: "chip", "aria-pressed": "false", onClick: () => { box.value = toggleIn(box.value, l); mark(); } }, l));
  const mark = () => { const now = cleanLabels(box.value); known.forEach((l, i) => { const on = now.some((x) => sameLabel(x, l)); chips[i].className = on ? "chip on" : "chip"; chips[i].setAttribute("aria-pressed", on ? "true" : "false"); }); };
  box.addEventListener?.("input", mark);
  form.addEventListener?.("reset", () => setTimeout(mark, 0));
  mark();
  const picks = ui.h("div", { dataset: { labelPicks: "" } }, ui.h("small", { class: "help" }, "Or tap one you already use:"), ui.h("div", { class: "chips", role: "group", "aria-label": "Labels you already use" }, chips));
  lab.after(picks);
  return picks;
}
/** The labels typed in a form, read at Save: { list } spelled as the plan's own, or { error } with what to do. */
export function readLabels(text, known) {
  const long = tooLong(text);
  if (long) return { error: `Keep each label to ${LABEL_MAX} letters or fewer. Separate two labels with a comma.` };
  return { list: spellAs(cleanLabels(text), known) };
}
/** The chips that narrow a list to one label: "All <noun>" first, then each label; the one shown is on. */
export function labelChips(ui, labels, shown, pick, all, style = null) {
  const chip = (text, on, run) => ui.h("button", { type: "button", class: on ? "chip on" : "chip", "aria-pressed": on ? "true" : "false", onClick: run }, text);
  return ui.h("div", { class: "chips", role: "group", "aria-label": "Show one label", dataset: { labelFilter: "" }, style },
    chip(all, !shown, () => pick(null)), labels.map((l) => chip(l, !!shown && sameLabel(shown, l), () => pick(l))));
}


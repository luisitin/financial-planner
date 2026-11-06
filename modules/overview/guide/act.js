// modules/overview/guide/act.js -- small helpers the guide's views and frame share (no DOM; they touch ctx).
/** "group/id" keys of pages that are not ready or are switched off on this device. */
export const offKeys = (ctx) => [...ctx.modules.entries()].filter(([, m]) => !ctx.isReady(m) || !ctx.features.enabled(m)).map(([k]) => k);
export const usable = (ctx, key) => { const m = ctx.modules.get(key); return !!m && ctx.isReady(m) && ctx.features.enabled(m) && (ctx.shown ? ctx.shown(m) : true); };   // shown: the household's view (core/view.js)
/**
 * Apply one of compute.js's changes (startGuide, markLooked, ...) through store.update, but only when it changes
 * something: every save sends the whole plan to the PC and leaves a backup copy there, so a tap that changes
 * nothing must not save.
 */
export function change(ctx, fn) {
  const probe = structuredClone(ctx.store.get());
  if (!fn(probe)) return false;
  ctx.store.update(fn);
  return true;
}
/** First letter lower-cased, to follow "On this page: ". */
export const lowerFirst = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);
/** A form control's value as compared by isDirty (a tick box by its tick). */
export const controlValue = (c) => (c.type === "checkbox" || c.type === "radio" ? c.checked : c.value);
/** Boxes a person types into (a choice list or tick box changed by mistake costs nothing to redo, and pages use them as filters). */
const TYPED = new Set(["text", "number", "date", "month", "email", "tel", "url", "textarea", ""]);
/**
 * Typing that is not saved yet: a box typed into that is still on the page and whose value differs from the one it had
 * when first focused (`starts`, a Map or WeakMap filled on focus). A box that saves on change makes the shell redraw
 * the page, which replaces it, so it never counts; a cancelled form is gone from the page too. Choice lists, tick
 * boxes, search and file boxes, and anything marked data-nodirty never count (a filter or an account picker would
 * warn about nothing). Works on plain objects shaped like controls (tested in Node).
 */
export function isDirty(controls, starts) {
  for (const c of controls) {
    if (!c || c.isConnected === false || !starts.has(c)) continue;
    if (!TYPED.has(String(c.type ?? "").toLowerCase()) || (c.dataset && "nodirty" in c.dataset)) continue;
    if (controlValue(c) !== starts.get(c)) return true;
  }
  return false;
}

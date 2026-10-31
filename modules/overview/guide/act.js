// modules/overview/guide/act.js -- small helpers the guide's views and frame share (no DOM; they touch ctx).
/** "group/id" keys of pages that are not ready or are switched off on this device. */
export const offKeys = (ctx) => [...ctx.modules.entries()].filter(([, m]) => !ctx.isReady(m) || !ctx.features.enabled(m)).map(([k]) => k);
export const usable = (ctx, key) => { const m = ctx.modules.get(key); return !!m && ctx.isReady(m) && ctx.features.enabled(m); };
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

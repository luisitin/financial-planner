// core/heal.js -- the shell mends itself once when its files do not fit together, and otherwise says so in plain words.
// docs/PLAN.md "On a static host (GitHub Pages)".
//
// When pages fail to load (core/app.js `broken`), a page throws while drawing, or the boot fails, the likeliest cause
// is a mix of old and new files (a deploy landed while the phone was opening the app). One reload fixes that, so the
// shell reloads once before showing any error, and never again within HEAL_WINDOW_MS (the time is kept in this tab's
// sessionStorage), so a real bug shows its message instead of reloading for ever. Where sessionStorage cannot keep the
// time (a sandboxed frame, a browser that keeps nothing) it never reloads.
//
// index.html's opening guard (a plain script, for when core/app.js itself cannot start) follows the same rule with the
// same key; tests/heal.test.mjs checks the two agree.

export const HEAL_KEY = "planner.healAt";
export const HEAL_WINDOW_MS = 2 * 60 * 1000;

/** May the shell reload by itself now? `last`: when it last did (ms since 1970, as stored; null/"" when never). */
export function mayHeal(last, now, windowMs = HEAL_WINDOW_MS) {
  const t = Number(last);
  if (!Number.isFinite(t) || t <= 0) return true;
  const since = now - t;
  return !(since >= 0 && since < windowMs);   // a clock set back (since < 0) does not block for ever
}

const tabStorage = () => { try { return globalThis.sessionStorage ?? null; } catch { return null; } };

/**
 * Reload once: true when a reload was started (the caller then shows nothing and waits for it). False when it already
 * reloaded within the window, or when the time cannot be kept (so it can never loop).
 */
export function healOnce({ storage = tabStorage(), now = Date.now(), reload = () => globalThis.location.reload() } = {}) {
  if (!storage) return false;
  try {
    if (!mayHeal(storage.getItem(HEAL_KEY), now)) return false;
    storage.setItem(HEAL_KEY, String(now));
    if (storage.getItem(HEAL_KEY) !== String(now)) return false;
  } catch { return false; }
  try { reload(); } catch { return false; }
  return true;
}

/**
 * Tell the service worker (sw.js) this open drew without a problem, so the files it was made of become the saved whole
 * copy that a weak or stalled connection opens from next time (docs/PLAN.md "On a static host (GitHub Pages)", "The saved
 * whole copy"). Sent a moment after the shell is up, and only when no red notice and no opening screen is showing then.
 * Before that, at once, it says "running" (see below).
 * Nothing happens without a worker controlling the page (the PC's copy, the first open, a file). Returns true when it is
 * going to look.
 */
export function announceOpened({ nav = globalThis.navigator, doc = globalThis.document, delay = 1500, later = (fn, ms) => setTimeout(fn, ms) } = {}) {
  let controller = null;
  try { controller = nav?.serviceWorker?.controller ?? null; } catch { }
  if (!controller || !doc) return false;
  // at once: this version's code has started. The worker then never opens an OLDER saved version after it (sw.js
  // `running`): an older app could otherwise run after a newer one had already saved the plan.
  try { controller.postMessage({ type: "running" }); } catch { }
  later(() => {
    try { if (!doc.querySelector("#content .notice.error, #content .booting")) controller.postMessage({ type: "opened" }); } catch { }
  }, delay);
  return true;
}

/**
 * The words when pages could not load and one reload did not help. `pc`: the app's files come from the PC's server
 * (restarting it can help); otherwise (GitHub Pages, phone only) the PC is not mentioned.
 */
export function brokenWords(n, pc) {
  if (pc) return `${n === 1 ? "One page" : `${n} pages`} could not load right now. Reload the page; if it keeps happening, restart the app on your computer.`;
  return `${n === 1 ? "One page" : "Some pages"} could not open. Reload to try again.`;
}
/** A page that threw while drawing. */
export const PAGE_WORDS = "This page could not open.";
/** The app itself could not start (core/app.js boot failed). */
export function bootWords(pc) {
  return pc ? "The app could not open. Reload the page; if it keeps happening, restart the app on your computer." : "The app could not open. Reload to try again.";
}

/** The plan on this device was saved by a newer version of the app than the code that is running (core/schema/migrate.js tooNew). */
export const NEWER_PLAN_WORDS = "Your plan was last saved by a newer version of this app than the one open now. Reload to get the newer version. Nothing in your plan has been changed.";

/**
 * A red notice in plain words with a filled Reload button; the technical text sits behind "Show details" (design log
 * 2026-09-15). `ui`: core/ui's { h, button } (passed in, so this file stays free of the DOM and testable in Node).
 * `reload: false` leaves the button out: when the shell already shows one notice with a Reload button, a page that
 * also could not open says so without a second button (one sentence to act on, one button).
 */
export function failNotice(ui, words, details = [], { reload = true, onReload = () => globalThis.location.reload() } = {}) {
  return ui.h("div", { class: "notice error", role: "alert" },
    ui.h("div", {}, words),
    reload ? ui.h("div", { class: "row", style: { marginTop: "10px" } }, ui.button("Reload", onReload)) : null,
    details.length ? ui.h("details", { class: "notice-details" }, ui.h("summary", {}, "Show details"), ui.h("ul", {}, details.map((d) => ui.h("li", {}, d)))) : null);
}

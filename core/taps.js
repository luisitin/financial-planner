// core/taps.js -- the tap guard. A tap lands only on something the person could have aimed at.
//
// Two things go wrong on a phone (the touch stress test of 2026-11-11, theme SH-TAP):
//  1. A double tap, or an impatient second tap, 120 to 800 ms after the first. The first tap saved, or opened a page, and
//     the screen under the thumb is now something else: a link to another page, another row's button, an answer of the
//     next question. The second tap was aimed at what was there before.
//  2. A tap made while the screen was frozen (a slow page being worked out). It is delivered when the freeze ends, to
//     whatever the new screen put under the finger.
// The guard swallows exactly those taps and no others:
//  - "stale":    the finger went down before the shell finished drawing the screen it is delivered to (or it is handed
//                over in the moment between the end of a frozen draw and the next painted frame);
//  - "new-page": a tap on the spot of the last tap, soon after it, and the address changed in between;
//  - "changed":  the same, and what is under the finger now was not there, in that place, when the last tap was made;
//  - "repeat":   the same control as the last tap, and the plan changed in between (a second Add, the next row's Remove);
//                never a box or a picker (tapping one again is how it is used);
//  - "double":   on the top bar, a second tap on the same spot within DOUBLE_MS (a true double tap on "‹"). The bar means
//                the same on every page, so any slower tap on it lands ("‹" twice at a person's pace goes back twice).
// A second tap on the same control with nothing changed (a stepper, a fold, a box), a tap on a neighbour that did not
// move, a tap anywhere else, a tap after SEE_MS, a key, a click with no finger behind it all go through. Nothing is
// delayed and scrolling is never touched. A control that must take every tap carries data-taps="repeat".
//
// verdict(), same() and fieldText() are pure (tests/taps.test.mjs); install() wires the guard to the document.

export const NEAR_PX = 40;     // "the same spot": a thumb's second tap lands within about a finger pad of the first
export const SEE_MS = 800;     // nobody sees a changed screen, reads it and aims a new tap at the same spot in less (R1 saw a harmful second tap at 800 ms)
export const SPAN_MS = 4000;   // the longest wait between two taps that can still be one burst (a frozen screen between them)
export const DOUBLE_MS = 250;  // the top bar: two taps closer than this are one double tap; slower ones are two taps
const AFTER_MS = 150;          // a change, key or typing this long after a tap is something new the person did
const SLACK = 6;               // px a control may differ by and still be "in the same place"
const FIELD = /^(INPUT|SELECT|TEXTAREA)$/;

/** Do two control signatures look the same and sit in the same place (a control redrawn where it was)? */
export function same(a, b) {
  if (!a || !b) return false;
  return (a.id === b.id || (a.tag === b.tag && a.text === b.text)) && Math.abs(a.x - b.x) <= SLACK && Math.abs(a.y - b.y) <= SLACK && Math.abs(a.w - b.w) <= SLACK && Math.abs(a.h - b.h) <= SLACK;
}
/** The words that tell one box or picker from another: its kind, name, id, spoken name and placeholder. */
export const fieldText = ({ type, name, id, label, placeholder } = {}) => [type, name, id, label, placeholder].map((x) => String(x ?? "")).join("|");

/**
 * Should this tap be swallowed? Returns null (no) or the reason.
 *   last:     the last tap that was carried out: { t, x, y, hash, rev, c1, around: [sig], burst? } or null
 *   tap:      this one, as the finger goes down: { t, x, y, hash, rev, c, inPage }
 *   drawnAt:  when the shell last finished drawing (same clock as t); settling: a draw just ended, no frame painted yet
 *   movedAt:  when the page last brought something into view by itself (planner:reveal)
 * A sig is { id, tag, text, x, y, w, h }: the control under a point (id: a number per DOM node). `hash` is the page part
 * of the address (no ?query).
 */
export function verdict({ last, tap, drawnAt = 0, settling = false, movedAt = 0 }) {
  if (tap.inPage && (tap.t < drawnAt || settling)) return "stale";
  if (!last || tap.t < last.t || tap.t - last.t > SPAN_MS) return null;
  // the top bar means the same on every page (its "‹" goes back one more page each time): only a true double tap, a
  // second tap on the same spot within DOUBLE_MS, counts once (regress-break 2: "‹" twice at a person's pace)
  if (!tap.inPage) return tap.t - last.t < DOUBLE_MS && Math.hypot(tap.x - last.x, tap.y - last.y) <= NEAR_PX ? "double" : null;
  // the window runs from the latest of: the last tap, the last draw after it, the last move of the page after it, and the
  // last swallowed tap of this burst (a thumb that keeps tapping the same spot is one gesture until it rests for SEE_MS)
  const after = (x) => (x > last.t ? x : 0);
  const changedAt = Math.max(last.t, after(drawnAt), after(movedAt), last.burst ?? 0);
  if (tap.t >= changedAt + SEE_MS) return null;
  if (Math.hypot(tap.x - last.x, tap.y - last.y) > NEAR_PX) return null;
  if (tap.hash !== last.hash) return "new-page";
  if (!tap.c) return null;
  const field = FIELD.test(tap.c.tag);
  // the very control the last tap hit (the same node, wherever it is now): a stepper, a box, a fold. A second Add or
  // Save on it, after the first one changed the plan, is a repeat nobody meant.
  if (last.c1 && tap.c.id === last.c1.id) return !field && tap.rev !== last.rev ? "repeat" : null;
  // anything else must have been here, in this place, when the last tap was made (a neighbour that did not move)
  if (!last.around.some((r) => same(r, tap.c))) return "changed";
  // a copy of the tapped control drawn where it was, after the plan changed: the next row's Remove, the same Add again
  if (!field && same(last.c1, tap.c) && tap.rev !== last.rev) return "repeat";
  return null;
}

// ---------------------------------------------------------------- the browser side
// (a form element's own properties can be shadowed by its boxes' names: read every element through the prototypes)
const CONTROL = 'a[href], button, summary, label, input, select, textarea, [role="button"], [tabindex]:not([tabindex="-1"]), tr.clickable, li';
const ids = new WeakMap(); let nextId = 1;
const idOf = (el) => { let n = ids.get(el); if (!n) { n = nextId++; ids.set(el, n); } return n; };
const get = (proto, prop) => Object.getOwnPropertyDescriptor(proto, prop)?.get;
const call = { closest: (el, s) => Element.prototype.closest.call(el, s), attr: (el, k) => Element.prototype.getAttribute.call(el, k), rect: (el) => Element.prototype.getBoundingClientRect.call(el), tag: (el) => get(Element.prototype, "tagName").call(el), text: (el) => get(Node.prototype, "textContent").call(el) };
/** The control under a point: the nearest thing a tap could act on, else the element itself. */
function sigAt(x, y) {
  const raw = document.elementFromPoint(x, y);
  if (!raw) return null;
  const el = call.closest(raw, CONTROL) ?? raw;
  const r = call.rect(el), tag = call.tag(el);
  const text = FIELD.test(tag)
    ? fieldText({ type: el.type, name: call.attr(el, "name"), id: call.attr(el, "id"), label: call.attr(el, "aria-label") ?? el.labels?.[0]?.textContent?.replace(/\s+/g, " ").trim(), placeholder: call.attr(el, "placeholder") })
    : (call.attr(el, "aria-label") || call.text(el) || "").replace(/\s+/g, " ").trim().slice(0, 60);
  return { id: idOf(el), tag, text, x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), el };
}
/** Every control within NEAR_PX of a point (the point, a ring at half the distance, a ring at the full distance). */
function around(x, y) {
  const out = [], seen = new Set();
  for (const r of [0, NEAR_PX / 2, NEAR_PX]) {
    for (let k = 0; k < (r ? 8 : 1); k++) {
      const a = (Math.PI / 4) * k, s = sigAt(x + r * Math.cos(a), y + r * Math.sin(a));
      if (s && !seen.has(s.id)) { seen.add(s.id); const { el, ...plain } = s; out.push(plain); }
    }
  }
  return out;
}
/**
 * When an event happened, on the clock the shell reads (performance.now()). A browser stamps an event with its own
 * clock, and on a phone that clock can drift away from performance.now(): after the phone has slept with the page open
 * the two can be minutes or hours apart (the owner's iPhone, 2026-11-13: every tap in the menu and on the page looked
 * older than the last draw, was called "stale" and dropped, until a reload). A stamp is believed only when it sits just
 * behind now: not ahead of it, and no further back than a frozen screen can hold a tap (MAX_LAG_MS). Otherwise the tap
 * happened now, as far as anyone can tell, and it lands.
 */
export const MAX_LAG_MS = 4000;   // as long as two taps can still be one burst (SPAN_MS)
export function tapTime(stamp, now, origin = 0) {
  if (!Number.isFinite(stamp) || stamp <= 0) return now;
  const t = stamp > 1e11 ? stamp - origin : stamp;   // an old browser stamps events with the date
  const lag = now - t;
  return lag >= -50 && lag <= MAX_LAG_MS ? Math.min(t, now) : now;
}
const clock = (e) => tapTime(e?.timeStamp, performance.now(), performance.timeOrigin);
const pageOf = () => String(location.hash).split("?")[0];

/**
 * Wire the guard to the document (capture phase, once). `rev()` gives a number that changes whenever the plan changes;
 * `inPage(el)` says whether an element is part of what the shell redraws (the page, the menu), not the top bar; `log`
 * hears each swallowed tap (the sandbox only). Returns { drawn(), moved() }.
 */
export function install({ rev = () => 0, inPage = () => true, log = null } = {}) {
  let last = null, drawnAt = 0, movedAt = 0, gesture = null, settling = false;
  const down = (e) => {
    if (!e.isTrusted || e.isPrimary === false || (e.pointerType === "mouse" && e.button !== 0)) return;
    const c = sigAt(e.clientX, e.clientY);
    const tap = { t: clock(e), x: e.clientX, y: e.clientY, hash: pageOf(), rev: rev(), c, inPage: !!c && inPage(c.el) };
    const repeatable = !!c && !!call.closest(c.el, '[data-taps="repeat"]');
    let why = verdict({ last, tap, drawnAt, settling, movedAt });
    if (why === "repeat" && repeatable) why = null;
    if (c) delete c.el;   // nothing kept holds a page's node
    gesture = { why, t: tap.t, x: tap.x, y: tap.y, hash: tap.hash, rev: tap.rev, c, used: false };
    if (why && why !== "stale" && last) last.burst = tap.t;   // a thumb still tapping the same spot: one gesture
    if (why) { log?.({ why, t: Math.round(tap.t), on: c?.text ?? "" }); if (e.pointerType === "mouse") e.preventDefault(); }
  };
  const cancel = () => { gesture = null; };   // the finger scrolled instead: no tap, nothing to remember
  const stop = (e) => { if (gesture?.why && e.isTrusted && e.cancelable) e.preventDefault(); };   // no click, focus, picker or keyboard follows
  const click = (e) => {
    if (!e.isTrusted) return;
    const g = gesture;
    // a click with no finger behind it (Enter or Space on a button, a label handing its click to its box) is never
    // swallowed and leaves the last tap as it was
    if (!g || g.used) return;
    g.used = true;
    if (g.why) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    // what was under the finger as it went down: the screen the person aimed at (the capture phase runs before the
    // page's own handler, so the screen is still the one aimed at)
    last = { t: g.t, at: clock(e), x: g.x, y: g.y, hash: g.hash, rev: g.rev, c1: g.c, around: around(g.x, g.y) };
  };
  document.addEventListener("pointerdown", down, true);
  document.addEventListener("pointercancel", cancel, true);
  document.addEventListener("touchend", stop, { capture: true, passive: false });
  document.addEventListener("mousedown", stop, true);
  document.addEventListener("click", click, true);
  // something happened between two taps (a pick in a picker, a key, typing): the next tap is not the second of a double
  // tap, so it is never compared with the one before (a picker tapped again to fix a choice it just saved). Not the
  // box's own change that the tap itself causes (a tick box, a tile): that comes within the tap's own moment.
  const forget = (e) => { if (e.isTrusted && last && clock(e) - last.at > AFTER_MS) last = null; };
  for (const type of ["change", "input", "keydown"]) document.addEventListener(type, forget, true);
  const guard = {
    /** The shell finished drawing a screen: from here on (after the next painted frame) a tap is aimed at it. */
    drawn() {
      drawnAt = performance.now(); settling = true;
      requestAnimationFrame(() => { drawnAt = Math.max(drawnAt, performance.now()); setTimeout(() => { settling = false; }, 0); });
    },
    /** The page brought something into view by itself: what is under a resting thumb changed (the window starts again). */
    moved() { movedAt = performance.now(); },
  };
  addEventListener("planner:reveal", () => guard.moved());
  return guard;
}

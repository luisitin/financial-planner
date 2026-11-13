// tests/taps.test.mjs -- the tap guard's decision (core/taps.js verdict): which second taps do nothing, and which taps
// must always land. The cases are the ones the touch stress test of 2026-11-11 reproduced on a phone (theme SH-TAP).
import { test } from "node:test";
import assert from "node:assert/strict";
import { verdict, same, fieldText, tapTime, NEAR_PX, SEE_MS, SPAN_MS, DOUBLE_MS, MAX_LAG_MS } from "../core/taps.js";

const sig = (id, tag, text, x, y, w = 120, h = 44) => ({ id, tag, text, x, y, w, h });
const SAVE = sig(1, "BUTTON", "Save", 20, 600);
const NAME = sig(2, "INPUT", "text|name||", 20, 540, 350);
const first = (over = {}) => ({ t: 1000, x: 80, y: 622, hash: "#/cashflow/income", rev: 5, c1: SAVE, around: [SAVE, NAME], ...over });
const tap = (over = {}) => ({ t: 1300, x: 82, y: 620, hash: "#/cashflow/income", rev: 5, c: SAVE, inPage: true, ...over });

test("the first tap of a visit, and a tap with nothing before it, always land", () => {
  assert.equal(verdict({ last: null, tap: tap() }), null);
});
test("a second tap on the very same control lands when nothing changed (a stepper, a box, a fold)", () => {
  assert.equal(verdict({ last: first(), tap: tap() }), null);
  assert.equal(verdict({ last: first(), tap: tap({ c: { ...SAVE, y: 580 } }) }), null, "the same node, moved (the keyboard opened): still the control that was tapped");
});
test("a second Add or Save on the same button after the first one changed the plan does nothing", () => {
  assert.equal(verdict({ last: first(), tap: tap({ rev: 6 }) }), "repeat");
  assert.equal(verdict({ last: first(), tap: tap({ rev: 6, c: sig(9, "BUTTON", "Save", 21, 601) }), drawnAt: 1080 }), "repeat", "the button redrawn where it was");
});
test("the next row's button sliding under the thumb after a remove does nothing (same words, same place, another row)", () => {
  const notSub = sig(4, "BUTTON", "Not a subscription", 250, 300, 130);
  const l = first({ c1: notSub, around: [notSub], x: 300, y: 320 });
  assert.equal(verdict({ last: l, tap: tap({ x: 300, y: 320, rev: 6, c: sig(7, "BUTTON", "Not a subscription", 250, 300, 130) }), drawnAt: 1070 }), "repeat");
});
test("something else under the thumb after a redraw does nothing: a link, another form, a box that moved there", () => {
  assert.equal(verdict({ last: first(), tap: tap({ rev: 6, c: sig(8, "A", "Open my payoff plan", 20, 598, 160) }), drawnAt: 1070 }), "changed");
  assert.equal(verdict({ last: first(), tap: tap({ c: { ...NAME, y: 600 } }) }), "changed", "a neighbour that slid under the thumb (the browser scrolled to a box it rejected)");
  assert.equal(verdict({ last: first(), tap: tap({ c: sig(11, "SECTION", "Over time", 0, 500, 390, 300) }) }), "changed", "plain page where the button was: swallowed too, it does nothing either way");
});
test("a neighbour that did not move is a meant tap, also after the plan changed and the page was redrawn", () => {
  assert.equal(verdict({ last: first(), tap: tap({ y: 590, c: NAME }) }), null);
  assert.equal(verdict({ last: first(), tap: tap({ y: 590, rev: 6, c: sig(12, "INPUT", "text|name||", 21, 541, 350) }), drawnAt: 1080 }), null);
});
test("a new address: the tap on the same spot does nothing, whatever is there (Continue under Continue)", () => {
  assert.equal(verdict({ last: first(), tap: tap({ hash: "#/overview/setup/owe", c: sig(13, "BUTTON", "Save", 20, 600) }), drawnAt: 1100 }), "new-page");
});
test("far from the last tap, or after the time it takes to see the new screen, a tap always lands", () => {
  assert.equal(verdict({ last: first(), tap: tap({ x: 80 + NEAR_PX + 1, rev: 6, c: sig(8, "A", "x", 0, 0) }), drawnAt: 1070 }), null);
  assert.equal(verdict({ last: first(), tap: tap({ t: 1000 + SEE_MS, rev: 6, c: sig(8, "A", "x", 0, 0) }) }), null);
  assert.equal(verdict({ last: first(), tap: tap({ t: 1070 + SEE_MS - 1, rev: 6, c: sig(8, "A", "x", 0, 0) }), drawnAt: 1070 }), "changed");
  assert.equal(verdict({ last: first(), tap: tap({ t: 1070 + SEE_MS, rev: 6, c: sig(8, "A", "x", 0, 0) }), drawnAt: 1070 }), null);
});
test("a slow page: the window starts when the new screen is drawn, not when the first tap was made", () => {
  assert.equal(verdict({ last: first(), tap: tap({ t: 3000, hash: "#/retirement/monte-carlo" }), drawnAt: 2900 }), "new-page");
  assert.equal(verdict({ last: first(), tap: tap({ t: 1000 + SPAN_MS + 1, hash: "#/retirement/monte-carlo" }), drawnAt: 1000 + SPAN_MS }), null, "a draw long after the last tap is not its burst");
});
test("a tap made while the screen was frozen (finger down before the draw finished) does nothing on the page, and lands on the top bar", () => {
  assert.equal(verdict({ last: null, tap: tap({ t: 2000 }), drawnAt: 2900 }), "stale");
  assert.equal(verdict({ last: first(), tap: tap({ t: 2000, x: 300, y: 100 }), drawnAt: 2900 }), "stale", "anywhere on the page, not only near the last tap");
  assert.equal(verdict({ last: null, tap: tap({ t: 2000, inPage: false }), drawnAt: 2900 }), null);
});
test("the top bar's back, tapped twice at a person's pace, goes back twice; only a true double tap counts once (regress-break 2)", () => {
  const bar = sig(3, "BUTTON", "Back to Income", 66, 6, 44, 44);
  const one = first({ x: 88, y: 28, c1: bar, around: [bar], hash: "#/balance/net-worth" });
  for (const gap of [300, 500, 800, 1200]) assert.equal(verdict({ last: one, tap: tap({ t: 1000 + gap, x: 88, y: 28, c: bar, inPage: false, hash: "#/cashflow/expenses" }), drawnAt: 1000 + gap - 100 }), null, `${gap} ms: a second deliberate tap`);
  assert.equal(verdict({ last: one, tap: tap({ t: 1000 + DOUBLE_MS - 1, x: 88, y: 28, c: bar, inPage: false, hash: "#/cashflow/expenses" }) }), "double");
  assert.equal(verdict({ last: one, tap: tap({ t: 1100, x: 340, y: 28, c: bar, inPage: false }) }), null, "elsewhere on the bar (the pill, the menu)");
});
test("same(): the same place within a few pixels, the same words; a different place is a different control", () => {
  assert.ok(same(SAVE, sig(99, "BUTTON", "Save", 24, 603)));
  assert.ok(!same(SAVE, sig(99, "BUTTON", "Save", 20, 650)));
  assert.ok(!same(SAVE, sig(99, "BUTTON", "Add", 20, 600)));
  assert.ok(!same(SAVE, null));
});

// ---- the final design's answers to its critics
test("a tap handed over between the end of a frozen draw and the next painted frame is stale, whatever its time says (breaker S6)", () => {
  assert.equal(verdict({ last: null, tap: tap({ t: 5000 }), drawnAt: 4000, settling: true }), "stale");
  assert.equal(verdict({ last: null, tap: tap({ t: 5000, inPage: false }), drawnAt: 4000, settling: true }), null, "the top bar always answers");
});
test("a thumb that keeps tapping one spot is one gesture until it rests (person critic P3: the 4th tap of 0/400/800/1200)", () => {
  const l = first({ t: 0, burst: 800 });
  assert.equal(verdict({ last: l, tap: tap({ t: 1200, rev: 6, c: sig(8, "A", "Continue your plan", 20, 598, 300) }), drawnAt: 60 }), "changed");
  assert.equal(verdict({ last: first({ t: 0 }), tap: tap({ t: 1200, rev: 6, c: sig(8, "A", "Continue your plan", 20, 598, 300) }), drawnAt: 60 }), null, "without the burst the window would have closed at 760 ms");
  assert.equal(verdict({ last: l, tap: tap({ t: 800 + SEE_MS, rev: 6, c: sig(8, "A", "x", 0, 0) }), drawnAt: 60 }), null, "a rest of SEE_MS after the last tap ends the burst");
});
test("a box or a picker tapped again is never a repeat, even after the plan changed (breaker X2: State you live in)", () => {
  const sel = sig(20, "SELECT", "select-one|||State you live in|", 20, 400, 350);
  const l = first({ c1: sel, around: [sel], x: 100, y: 420 });
  assert.equal(verdict({ last: l, tap: tap({ x: 100, y: 420, rev: 6, c: sel }), drawnAt: 1100 }), null);
  assert.equal(verdict({ last: l, tap: tap({ x: 100, y: 420, rev: 6, c: { ...sel, id: 21 } }), drawnAt: 1100 }), null, "the same picker drawn again in its place");
});

// ---- the build (wave 1, seams I7 and the field signature)
test("a box's signature carries its id and its spoken name: two unnamed pickers in one place are not 'the same control'", () => {
  const a = fieldText({ type: "select-one", name: "", id: "cat-1", label: "Category for Rent", placeholder: "" });
  const b = fieldText({ type: "select-one", name: "", id: "cat-2", label: "Category for Coffee", placeholder: "" });
  assert.notEqual(a, b);
  assert.ok(!same(sig(30, "SELECT", a, 20, 400, 350), sig(31, "SELECT", b, 20, 400, 350)), "the next row's picker that slid up is another control");
  assert.equal(fieldText({ type: "text", name: "amount" }), "text|amount|||", "missing parts are empty, never 'undefined'");
});
test("the page brought something into view (planner:reveal): the window starts again from that moment, nothing is stale", () => {
  const link = sig(8, "A", "Open my payoff plan", 20, 598, 160);
  // the answer slid under the thumb 700 ms after the tap: a tap 300 ms later is still aimed at what was there before
  assert.equal(verdict({ last: first(), tap: tap({ t: 2000, c: link }), movedAt: 1700 }), "changed");
  assert.equal(verdict({ last: first(), tap: tap({ t: 2000, c: link }) }), null, "without the move the window closed at 1800 ms");
  assert.equal(verdict({ last: null, tap: tap({ t: 1650 }), movedAt: 1700 }), null, "a move never makes a tap stale");
  assert.equal(verdict({ last: first(), tap: tap({ t: 1700 + SEE_MS, c: link }), movedAt: 1700 }), null, "SEE_MS after the move a tap lands");
});

// the owner's iPhone, 2026-11-13: after the phone slept with the page open, the browser's event clock sat far behind
// performance.now(), so every tap in the menu and on the page looked older than the last draw and was dropped as "stale"
test("a tap's time is believed only just behind now; a drifted clock (a phone that slept) means the tap happened now", () => {
  assert.equal(tapTime(9990, 10000), 9990, "ten milliseconds ago: believed");
  assert.equal(tapTime(10000 - MAX_LAG_MS, 10000), 10000 - MAX_LAG_MS, "held by a frozen screen: believed");
  assert.equal(tapTime(10000 - MAX_LAG_MS - 1, 10000), 10000, "further back than a frozen screen can hold a tap: now");
  assert.equal(tapTime(10000 - 3600000, 10000), 10000, "an hour behind: now");
  assert.equal(tapTime(10000 + 3600000, 10000), 10000, "an hour ahead: now");
  assert.equal(tapTime(10020, 10000), 10000, "a hair ahead (rounding): never later than now");
  assert.equal(tapTime(0, 10000), 10000, "no stamp: now");
  assert.equal(tapTime(undefined, 10000), 10000);
  assert.equal(tapTime(1.8e12 + 9990, 10000, 1.8e12), 9990, "an old browser stamps events with the date");
});
test("with the clock an hour behind, a tap on a screen drawn a minute ago lands (it was dropped as stale)", () => {
  const now = 5000000, drawnAt = now - 60000;
  const raw = now - 3600000;   // the event's own stamp
  const tap = (t) => ({ t, x: 100, y: 300, hash: "#/overview/start", rev: 1, c: { id: 7, tag: "A", text: "Dashboard", x: 18, y: 280, w: 243, h: 44 }, inPage: true });
  assert.equal(verdict({ last: null, tap: tap(raw), drawnAt }), "stale", "the fault, as it was");
  assert.equal(verdict({ last: null, tap: tap(tapTime(raw, now)), drawnAt }), null);
});

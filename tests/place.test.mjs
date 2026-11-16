// tests/place.test.mjs -- the pure rules of the shell's place and typing memory (core/place.js) and of the history entries
// (core/router.js): which entry a way back returns to, how an arrival is told apart, which typing goes back where, when a
// confirmation counts as seen, how long the bottom note stays. Both files import in Node with no DOM and no storage.
// The last part (docs/OPTIONAL.md "Back, Forward, reload") runs wave 1's own record of open sections (foldsOf,
// applyFolds) against the optional parts of core/ui/more.js on a small stand-in DOM: the two memories agree.
import { test } from "node:test";
import assert from "node:assert/strict";
import { sameEntry, backSteps, kindOf, stampOf, hashOf } from "../core/router.js";

// ---------------------------------------------------------------- router
test("sameEntry: the same page and its query keys; from does not count; a month the entry lacks is its own", () => {
  assert.equal(sameEntry("#/overview/plan", "#/overview/plan"), true);
  assert.equal(sameEntry("#/overview/plan?from=plan", "#/overview/plan"), true, "from only says how a page was reached");
  assert.equal(sameEntry("#/overview/plan", "#/overview/plan?from=dash"), true);
  assert.equal(sameEntry("#/overview/monthly-review?month=2026-10", "#/overview/monthly-review"), true, "the check-in opened without ?month showed that month");
  assert.equal(sameEntry("#/overview/monthly-review?month=2026-10", "#/overview/monthly-review?month=2026-11"), false, "October is not November");
  assert.equal(sameEntry("#/overview/quick?q=retire", "#/overview/quick"), false, "any other key the entry lacks is another page");
  assert.equal(sameEntry("#/a/b", "#/a/c"), false);
  assert.equal(sameEntry("#/a/b/x", "#/a/b"), false, "the rest counts");
  assert.equal(sameEntry("http://h/?sandbox=1#/a/b", "#/a/b"), true, "a full address is read by its hash");
  assert.equal(hashOf("http://h/?sandbox=1#/a/b?x=1"), "#/a/b?x=1");
});
test("backSteps: one step when the page is just behind, a Next-result walk, else 0", () => {
  const t = { 1: { h: "#/overview/dashboard", p: null }, 2: { h: "#/overview/monthly-review", p: 1 }, 3: { h: "#/balance/update?from=review&review=2026-10", p: 2 } };
  assert.equal(backSteps(t, 3, "#/overview/monthly-review?month=2026-10"), 1, "the check-in step's way back");
  assert.equal(backSteps(t, 3, "#/overview/dashboard"), 0, "not just behind, and no walk: follow the link");
  assert.equal(backSteps({}, 1, "#/a/b"), 0, "a fresh tab");
  assert.equal(backSteps({ 1: { h: "#/a/b", p: null } }, 1, "#/a/b"), 0, "nothing behind the first entry");
  const oct = { 4: { h: "#/overview/monthly-review?month=2026-11", p: null }, 5: { h: "#/balance/update?from=review&review=2026-10", p: 4 } };
  assert.equal(backSteps(oct, 5, "#/overview/monthly-review?month=2026-10"), 0, "October is not November");
  // the check-in's way back carried one page further (step 7 > Needs attention > a row): data-back="1" walks over that page
  const ci = { 1: { h: "#/overview/monthly-review", p: null }, 2: { h: "#/overview/alerts?from=review&review=2026-10", p: 1 }, 3: { h: "#/debt/payoff", p: 2 } };
  assert.equal(backSteps(ci, 3, "#/overview/monthly-review?month=2026-10"), 0, "without it: followed as a link (topways new problem 2)");
  assert.equal(backSteps(ci, 3, "#/overview/monthly-review?month=2026-10", 1), 2, "with it: two entries back, the place kept");
  assert.equal(backSteps(ci, 3, "#/overview/dashboard", 1), 0, "a page not there: followed");
  const ciOct = { ...ci, 1: { h: "#/overview/monthly-review?month=2026-10", p: null } };
  assert.equal(backSteps(ciOct, 3, "#/overview/monthly-review?month=2026-11", 1), 0, "another month's check-in: followed");
  // Your plan, then two "Next result" pages: the way back walks over the whole walk
  const walk = { 1: { h: "#/overview/plan", p: null }, 2: { h: "#/retirement/projection?from=plan", p: 1 }, 3: { h: "#/taxes/federal?from=plan", p: 2 } };
  assert.equal(backSteps(walk, 3, "#/overview/plan"), 2);
  assert.equal(backSteps(walk, 2, "#/overview/plan"), 1);
  // a page opened another way in between stops the walk
  const mixed = { 1: { h: "#/overview/plan", p: null }, 2: { h: "#/retirement/projection?from=plan", p: 1 }, 3: { h: "#/cashflow/income", p: 2 }, 4: { h: "#/taxes/federal?from=plan", p: 3 } };
  assert.equal(backSteps(mixed, 4, "#/overview/plan"), 0);
  // at most 10 steps
  const long = { 0: { h: "#/overview/plan", p: null } };
  for (let i = 1; i <= 12; i++) long[i] = { h: `#/x/p${i}?from=plan`, p: i - 1 };
  assert.equal(backSteps(long, 10, "#/overview/plan"), 10);
  assert.equal(backSteps(long, 12, "#/overview/plan"), 0);
});
test("kindOf: a numbered entry at the first draw is a reload; smaller is Back, larger Forward", () => {
  assert.equal(kindOf(true, 4, null), "reload");
  assert.equal(kindOf(false, 4, null), "new");
  assert.equal(kindOf(false, 2, 4), "back");
  assert.equal(kindOf(false, 5, 4), "forward");
});
test("stampOf: keeps a page's own state, numbers after the entry on screen, keeps it on a replace, another visit is new", () => {
  const s = stampOf({ suFrom: "q2" }, { v: "t1", cur: { n: 3 }, top: 7 });
  assert.deepEqual(s.state, { suFrom: "q2", v: "t1", n: 4, l: 0 }); assert.equal(s.kind, "new"); assert.equal(s.p, 3);
  assert.deepEqual(stampOf({ v: "t1", n: 2, suFrom: "q1" }, { v: "t1", cur: { n: 4 } }), { state: { v: "t1", n: 2, suFrom: "q1" }, n: 2, kind: "back", stamped: false });
  assert.equal(stampOf({ v: "t1", n: 2 }, { v: "t1", first: true }).kind, "reload");
  const other = stampOf({ v: "t0", n: 2 }, { v: "t1", cur: { n: 4 }, top: 6, away: true });
  assert.deepEqual([other.n, other.kind, other.p], [7, "new", null], "an entry of another visit (sessionStorage gone, history kept) is new and has nothing behind it");
  const rep = stampOf(null, { v: "t1", cur: { n: 4 }, replaced: true });
  assert.deepEqual([rep.n, rep.replaced, rep.p], [4, true, null]);
  assert.deepEqual([stampOf(null, { v: "t1", top: 9 }).n, stampOf(null, { v: "t1", top: 9 }).p], [10, null], "a first draw follows every number known");
  assert.equal(stampOf("junk", { v: "t1" }).n, 1);
});

// ---------------------------------------------------------------- place (pure rules; the DOM side is walked with the kit)
import { shape, secretText, pageKeyOf, neverKept, boxVerdict, refillVerdict, pickTwin, figuresOf, pickForm, seenEnough, echoStay, fresh, prune, pruneTyping, planSig, usedOnLeave, calmArgs, boxName, wrapScrolls, scrolls, roomDue, DAY } from "../core/place.js";

test("figures leave the words, so a row is the same row after a save", () => {
  assert.equal(shape("Store card $1,201"), shape("Store card $1,202"));
  assert.equal(shape("Raises and promotions 3.0% ›"), "raises and promotions #");
  assert.notEqual(shape("Edit Ana's salary"), shape("Edit Bo's salary"), "two rows' forms differ by their title");
});
test("a box's own name: its visible label first, then aria-label, then placeholder", () => {
  assert.equal(boxName("Amount", "Amount: $4,100 a month", "e.g. 4,000"), "amount", "pages rewrite aria-label as you type");
  assert.equal(boxName("", "Pasted CSV", "...or paste"), "pasted csv");
  assert.equal(boxName("", null, "Search"), "search");
});
test("boxes for keys, tokens, passwords, secrets and PINs are never kept; ordinary words are", () => {
  for (const t of ["apiKey", "API key (for another service)", "Access token", "password", "Passcode", "pass code", "passphrase", "secret", "PIN", "bankPin"]) assert.equal(secretText(t), true, t);
  for (const t of ["Transit pass a month", "Monkey bars", "Spending in retirement, a month", "Pinned note", "Keystone fund", "Passport renewal"]) assert.equal(secretText(t), false, t);
  assert.equal(secretText(null, "", undefined, "Name", "apiKey"), true);
  assert.equal(neverKept("#/system/settings"), true);
  assert.equal(neverKept("#/cashflow/income"), false);
});
test("typing is kept under the page and only the query keys that change what it holds", () => {
  assert.equal(pageKeyOf("#/balance/update?from=review&review=2026-11"), "#/balance/update");
  assert.equal(pageKeyOf("#/balance/update"), "#/balance/update");
  assert.equal(pageKeyOf("#/cashflow/expenses?guide=plan&step=month"), "#/cashflow/expenses");
  assert.equal(pageKeyOf("#/overview/monthly-review?month=2026-10"), "#/overview/monthly-review?month=2026-10", "a month changes what the page holds");
  assert.equal(pageKeyOf("#/balance/liabilities/abc?add=1"), "#/balance/liabilities/abc");
  assert.equal(pageKeyOf("#/balance/net-worth?edit=a1&back=overview/plan"), "#/balance/net-worth?edit=a1", "back only says where to go after");
  assert.equal(pageKeyOf("#/x/y?b=2&a=1"), "#/x/y?a=1&b=2");
  assert.equal(pageKeyOf("http://h/?sandbox=1#/x/y?view=all"), "#/x/y");
});
test("a box drawn again: put back, already back, or let go because its saved figure changed", () => {
  assert.equal(boxVerdict("3,900", "9,999", "3,900"), "fill");
  assert.equal(boxVerdict("3,900", "9,999", "9,999"), "same", "the page put it back itself (Get started, People): no cue");
  assert.equal(boxVerdict("380,000", "391,000", "395,000"), "changed", "the house's value was saved elsewhere meanwhile");
  assert.equal(boxVerdict("", "Weekend tutoring", ""), "fill");
});
test("a box the person is typing in now is never written into nor let go (a correction is not undone mid-typing)", () => {
  // regress-person 1: 48,000 + "5" typed, a pause, one delete: the box is back at its drawn value while the record still
  // says 480,005; the page redraws a live line, and the put-back must leave the box alone
  assert.equal(refillVerdict(true, "48,000", "480,005", "48,000"), "same");
  assert.equal(refillVerdict(true, "3,900", "9,999", "3,90"), "same", "mid-typing: neither the record nor the drawn value, never 'changed'");
  assert.equal(refillVerdict(false, "48,000", "480,005", "48,000"), "fill", "a box drawn again (Back, a reload) is put back as before");
  assert.equal(refillVerdict(false, "380,000", "391,000", "395,000"), "changed");
});
test("twins (alike but for their figures): the one tapped, never another row that moved into its place", () => {
  // place NP1: Roth "At the 10% rate" chosen: its button goes, "No conversions" gains one; the 12% button must not count as it
  const before = ["at the 10% rate $3,105 more use this one", "at the 12% rate $8,165 more use this one", "at the 22% rate $16,062 more use this one"];
  assert.equal(pickTwin(0, before, ["at the 12% rate $8,165 more use this one", "at the 22% rate $16,062 more use this one", "no conversions turn conversions off"]), -1);
  assert.equal(pickTwin(1, before, before.slice()), 1, "nothing changed: the same place");
  assert.equal(pickTwin(1, before, [before[1], before[2]]), 0, "its own words, once, elsewhere");
  assert.equal(pickTwin(0, before, ["at the 10% rate $3,200 more use this one", before[1], before[2]]), 0, "only its own row changed: the row edited in place");
  assert.equal(pickTwin(0, before, ["x", "y", before[2]]), -1, "two rows changed: not certain");
  assert.equal(pickTwin(5, before, before), -1);
  assert.equal(figuresOf("At the 10% rate$3,105 moreMoves about $13,308 in all."), "10%|$3,105|$13,308");
  assert.equal(figuresOf("No conversions"), "");
});
test("which form a record names: the same identity, and twins only by position while their count is unchanged", () => {
  assert.equal(pickForm({ fk: "a", i: 0, of: 1 }, ["b", "a", "c"]), 1);
  assert.equal(pickForm({ fk: "a", i: 1, of: 2 }, ["a", "b", "a"]), 2, "Bo's W-4 is the second of two alike");
  assert.equal(pickForm({ fk: "a", i: 0, of: 2 }, ["a", "b"]), -1, "one twin went: never a guess");
  assert.equal(pickForm({ fk: "a", i: 0, of: 1 }, ["a", "a"]), -1, "a twin appeared: never a guess");
  assert.equal(pickForm({ fk: "z", i: 0, of: 1 }, ["a"]), -1);
});
test("a confirmation is seen when most of it is between the top bar and the bottom edge", () => {
  assert.equal(seenEnough({ top: 22, bottom: 70 }, 56, 844), false, "p-taxes/x-5: 14 px under a 56 px bar");
  assert.equal(seenEnough({ top: 100, bottom: 160 }, 56, 844), true);
  assert.equal(seenEnough({ top: 800, bottom: 900 }, 56, 844), false);
  assert.equal(seenEnough({ top: 700, bottom: 1000 }, 56, 844), true, "144 px of a tall notice");
  assert.equal(seenEnough({ top: -400, bottom: -300 }, 56, 844), false);
  assert.equal(seenEnough({ top: 20, bottom: 114 }, 56, 844), false, "place NP4: 62% shows, but its first line is under the bar");
  assert.equal(seenEnough({ top: 52, bottom: 146 }, 56, 844), true, "4 px under the bar: read");
});
test("the bottom note stays 4 to 10 s by its length, longer with a way on, at least 6 s for an error", () => {
  assert.equal(echoStay(10), 4000);
  assert.equal(echoStay(100, 1), 9500);
  assert.equal(echoStay(400, 2), 10000);
  assert.equal(echoStay(10, 0, true), 6000);
});
test("records and typing are bounded: 60 entries, a day, 20 KB a page", () => {
  const r = {}; for (let i = 1; i <= 70; i++) r[i] = { y: i };
  assert.deepEqual(Object.keys(prune(r, 60)).map(Number).slice(0, 2), [11, 12]);
  const now = Date.now();
  assert.equal(fresh(now - DAY + 1000, now), true);
  assert.equal(fresh(now - DAY - 1, now), false);
  assert.equal(fresh(now + 5000, now), false, "a clock that went back is not fresh");
  const t = { "#/a/b": { forms: { x: { at: now - 2 * DAY, boxes: [] } }, loose: [] }, "#/c/d": { forms: { y: { at: now, boxes: [{ v: "x".repeat(30000) }] } }, loose: [] }, "#/e/f": { forms: { z: { at: now, boxes: [{ v: "1" }] } }, loose: [] }, "#/g/h": { loose: [{ at: now - 2 * DAY }] } };
  assert.deepEqual(Object.keys(pruneTyping(t, now)), ["#/e/f"]);
});
test("a store update that changed only the stamp is not a save", () => {
  const a = { meta: { rev: "1" }, incomes: [{ amount: 1 }] };
  assert.equal(planSig(a), planSig({ meta: { rev: "2", updatedAt: "x" }, incomes: [{ amount: 1 }] }));
  assert.notEqual(planSig(a), planSig({ meta: { rev: "1" }, incomes: [{ amount: 2 }] }));
});
test("the save-and-leave rule: one act saved the plan and left the page, with no newer touch, within 1.5 s", () => {
  assert.equal(usedOnLeave({ at: 1000, mark: 7 }, 1800, 7), true, "Import's button: saved, then Categorize");
  assert.equal(usedOnLeave({ at: 1000, mark: 7 }, 1800, 8), false, "a newer touch: the leaving is another act");
  assert.equal(usedOnLeave({ at: 1000, mark: 7 }, 2600, 7), false, "too late");
  assert.equal(usedOnLeave(null, 1800, 7), false);
});
test("room borrowed under a page goes 600 ms after it last grew, never while the page says it is working out its answer", () => {
  assert.equal(roomDue(700, false), true, "the page stopped growing: its real end may show");
  assert.equal(roomDue(300, false), false, "it may still grow");
  assert.equal(roomDue(5000, true), false, "\"Working it out...\" is on the screen: the answer will fill the room (Stress tests' Now chip)");
  assert.equal(roomDue(601, false, 600), true);
});
test("reduced motion: a smooth scroll call becomes instant; everything else passes as it is", () => {
  assert.deepEqual(calmArgs("scrollIntoView", [{ behavior: "smooth", block: "start" }], true), [{ behavior: "auto", block: "start" }]);
  assert.deepEqual(calmArgs("scrollTo", [{ top: 5, behavior: "smooth" }], true), [{ top: 5, behavior: "auto" }]);
  assert.deepEqual(calmArgs("scrollTo", [0, 40], true), [0, 40]);
  assert.deepEqual(calmArgs("scrollIntoView", [{ behavior: "smooth" }], false), [{ behavior: "smooth" }]);
  assert.deepEqual(calmArgs("scrollIntoView", [true], true), [true]);
});
test("the one wrapper of the scroll calls keeps this, every argument and the return value, and counts the page's calls", () => {
  const seen = [];
  const win = { scrollTo(...a) { seen.push([this, a]); return "w"; }, scrollBy() { return 1; }, scroll() { } };
  const el = { scrollIntoView(...a) { seen.push([this, a]); return "e"; }, scrollTo() { }, scrollBy() { }, scroll() { } };
  const html = { focus(...a) { seen.push([this, a]); return "f"; } };
  const reduce = { matches: true };
  wrapScrolls({ win, el, html, reduce });
  wrapScrolls({ win, el, html, reduce });   // wrapped once only
  const s0 = scrolls();
  assert.equal(win.scrollTo(0, 120), "w");
  assert.deepEqual(seen.at(-1), [win, [0, 120]]);
  const node = Object.create(el);
  assert.equal(node.scrollIntoView({ behavior: "smooth", block: "center" }), "e");
  assert.equal(seen.at(-1)[0], node); assert.deepEqual(seen.at(-1)[1], [{ behavior: "auto", block: "center" }]);
  assert.equal(scrolls(), s0 + 2);
  const box = Object.create(html);
  assert.equal(box.focus({ preventScroll: true }), "f");
  assert.equal(scrolls(), s0 + 2, "a focus that does not scroll is not the page scrolling");
  box.focus();
  assert.equal(scrolls(), s0 + 3);
});

// ---------------------------------------------------------------- two memories agree (docs/OPTIONAL.md "Back, Forward, reload")
// core/ui/more.js `kept` says how the page draws a part (this phone, the reading parts, a person's own tap); wave 1's
// record says what one screen looked like when the person left it (this tab's history entry, every section they set by
// hand, put back only where the page draws it as it did then). Neither writes the other's store. These cases run the
// real code of both on a small DOM shaped like a browser's (prototype getters, the selectors core/place.js uses): a draw
// is the page drawn afresh; Back, Forward and a reload are a draw then applyFolds(record of that entry); a save's redraw
// is foldsOf, a draw, applyFolds; a new visit is a draw alone. Built after all the imports above (none needs a document).
import { start as placeStart, foldsOf, applyFolds, inShutFold } from "../core/place.js";
import { parts as moreParts, detail as moreDetail, kept as moreKept, MORE_KEY, _test as moreTest } from "../core/ui/more.js";
import { h as uiH, form as uiForm } from "../core/ui/dom.js";

function miniDom() {
  const kebab = (k) => k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
  const cache = new Map();
  function compound(s) {
    const tests = [];
    let i = 0;
    const tag = /^[a-zA-Z][\w-]*/.exec(s);
    if (tag) { const t = tag[0].toUpperCase(); tests.push((e) => e.tagName === t); i = tag[0].length; }
    while (i < s.length) {
      const r = s.slice(i);
      let m;
      if ((m = /^\.([\w-]+)/.exec(r))) { const c = m[1]; tests.push((e) => e.className.split(/\s+/).includes(c)); }
      else if ((m = /^#([\w-]+)/.exec(r))) { const id = m[1]; tests.push((e) => e.getAttribute("id") === id); }
      else if ((m = /^\[([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\]]*)))?\]/.exec(r))) { const [, a, v1, v2, v3] = m, v = v1 ?? v2 ?? v3; tests.push((e) => e.hasAttribute(a) && (v === undefined || e.getAttribute(a) === v)); }
      else if ((m = /^:not\(([^)]*)\)/.exec(r))) { const inner = compound(m[1].trim()); tests.push((e) => !inner(e)); }
      else throw new Error(`the stand-in DOM does not read the selector "${s}"`);
      i += m[0].length;
    }
    return (e) => tests.every((t) => t(e));
  }
  const compile = (sel) => {
    if (!cache.has(sel)) cache.set(sel, sel.split(",").map((x) => x.trim()).map((x) => { const scope = /^:scope\s*>\s*/.test(x); return { scope, test: compound(x.replace(/^:scope\s*>\s*/, "")) }; }));
    return cache.get(sel);
  };
  class N {
    constructor() { this.parentNode = null; this.childNodes = []; }
    get parentElement() { return this.parentNode instanceof E ? this.parentNode : null; }
    get textContent() { return this instanceof T ? this.data : this.childNodes.map((c) => c.textContent).join(""); }
    get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === html; }
    contains(x) { for (let n = x; n; n = n.parentNode) if (n === this) return true; return false; }
  }
  class T extends N { constructor(s) { super(); this.data = String(s); } }
  class E extends N {
    constructor(tag) {
      super(); this.tag = String(tag).toUpperCase(); this.attrs = new Map(); this.style = {}; this.on = {};
      const el = this;
      this.dataset = new Proxy({}, { set(_, k, v) { el.setAttribute(`data-${kebab(String(k))}`, v); return true; }, get(_, k) { return typeof k === "string" ? el.getAttribute(`data-${kebab(k)}`) ?? undefined : undefined; } });
    }
    get tagName() { return this.tag; }
    get className() { return this.getAttribute("class") ?? ""; }
    set className(v) { this.setAttribute("class", v); }
    get id() { return this.getAttribute("id") ?? ""; }
    get type() { return this.getAttribute("type") ?? (this.tag === "INPUT" ? "text" : ""); }
    get value() { return this.getAttribute("value") ?? ""; }
    set value(v) { this.setAttribute("value", v); }
    get open() { return this.attrs.has("open"); }
    set open(v) { if (!!v === this.open) return; if (v) this.attrs.set("open", ""); else this.attrs.delete("open"); setTimeout(() => this.dispatchEvent({ type: "toggle" }), 0); }
    setAttribute(k, v) { this.attrs.set(k, String(v)); }
    getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
    hasAttribute(k) { return this.attrs.has(k); }
    removeAttribute(k) { this.attrs.delete(k); }
    setCustomValidity() { }
    append(...ns) { for (const n of ns.flat(Infinity)) { if (n === null || n === undefined) continue; const c = n instanceof N ? n : new T(n); if (c.parentNode) c.parentNode.childNodes.splice(c.parentNode.childNodes.indexOf(c), 1); c.parentNode = this; this.childNodes.push(c); } }
    remove() { if (this.parentNode) { this.parentNode.childNodes.splice(this.parentNode.childNodes.indexOf(this), 1); this.parentNode = null; } }
    get children() { return this.childNodes.filter((c) => c instanceof E); }
    addEventListener(t, f) { (this.on[t] ??= []).push(f); }
    dispatchEvent(ev) { for (const f of this.on[ev.type] ?? []) f({ target: this, currentTarget: this, preventDefault() { }, ...ev }); return true; }
    getBoundingClientRect() { return { top: 0, bottom: 20, left: 0, right: 100, width: 100, height: 20 }; }
    getClientRects() { return [this.getBoundingClientRect()]; }
    focus() { }
    matches(sel) { return compile(sel).some((s) => !s.scope && s.test(this)); }
    closest(sel) { for (let e = this; e instanceof E; e = e.parentNode) if (e.matches(sel)) return e; return null; }
    querySelectorAll(sel) { const list = compile(sel), out = []; const walk = (e) => { for (const c of e.children) { if (list.some((s) => (!s.scope || c.parentNode === this) && s.test(c))) out.push(c); walk(c); } }; walk(this); return out; }
    querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
  }
  const html = new E("html"), body = new E("body"), root = new E("div");
  root.setAttribute("id", "content"); html.append(body); body.append(root);
  const on = {};
  globalThis.Node = N; globalThis.Element = E;
  globalThis.document = { documentElement: html, body, activeElement: null, visibilityState: "visible", createElement: (t) => new E(t), createTextNode: (s) => new T(s), addEventListener: (t, f) => { (on[t] ??= []).push(f); }, getElementById: (id) => html.querySelector(`#${id}`) };
  globalThis.addEventListener = () => { };
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
  return { root, on, store };
}
let dom = null;
const PAGE_CTX = (query = {}) => ({ ui: { h: uiH }, module: { group: "taxes", id: "federal" }, route: { group: "taxes", id: "federal", rest: [], query } });
const READ = { id: "how", kind: "how", says: "11 steps", body: ["Your pay, less the standard deduction"] };
const MORE = { id: "numbers", kind: "more", n: 4, noun: "numbers", body: ["$1,200", "$3,400", "$5,600", "$7,800"] };
const BOXES = { id: "itemized", kind: "own", title: "Itemized deductions", body: ["Gifts to charity"] };
const ITEM = { id: "ana", kind: "item", title: "Ana", body: ["Pay $72,000", "Withheld $8,100"] };
const later = () => new Promise((r) => setTimeout(r, 5));
const echoes = [];   // what the shell's bottom note would say (place's echo hook): read by the "coming back" cases below
function agreeing() {
  if (!dom) { dom = miniDom(); placeStart({ root: () => dom.root, echo: (t) => echoes.push(t) }); }
  dom.store.clear(); moreTest.reset(); moreTest.clock(() => T0); moreDetail.set({ working: false });
  return dom;
}
const T0 = Date.UTC(2026, 10, 13, 12);
/** The page drawn afresh into #content: its parts as rows of one card. Returns each part by its id. */
function draw(list, ctx = PAGE_CTX()) {
  for (const c of [...dom.root.childNodes]) { c.parentNode = null; }
  dom.root.childNodes = [];
  dom.root.append(moreParts(ctx, ...list));
  return Object.fromEntries(dom.root.querySelectorAll("details").map((d) => [d.dataset.part, d]));
}
/** A person's tap on a section's summary: the click (wave 1 on the document, then the part's own listener), then the
 * browser's own toggle, then the next ticks where both write down what happened. */
async function tapFold(d) {
  const sum = d.querySelector(":scope > summary");
  const ev = { type: "click", isTrusted: true, target: sum };
  for (const f of dom.on.click ?? []) f({ ...ev, preventDefault() { } });
  sum.dispatchEvent(ev);
  d.open = !d.open;
  await later();
}
const keptMarks = () => Object.fromEntries(Object.entries(JSON.parse(dom.store.get(MORE_KEY) ?? "{}").parts ?? {}).map(([k, v]) => [k, v[0]]));
const record = () => foldsOf(dom.root).map((f) => [f.loc.k, f.by, f.drew]);
const ON_DAY = (days) => { moreTest.clock(() => T0 + days * 864e5); moreTest.reset(); };   // a new visit that many days later

test("agree: a reading part opened by hand is open after Back, a save, a new visit and next week; forgotten after 90 days unseen", async () => {
  agreeing();
  const LIST = [MORE, READ, BOXES];
  let p = draw(LIST);
  await tapFold(p.how);
  assert.deepEqual(keptMarks(), { "taxes/federal#how": 1 }, "kept: this phone stores 1");
  const entry = foldsOf(dom.root);
  assert.deepEqual(record(), [["D|how this is worked out", "open", "shut"]], "wave 1 notes { by: open, drew: shut } for this entry");
  p = draw(LIST); applyFolds(dom.root, entry);
  assert.equal(p.how.open, true, "Back, Forward or a reload of that entry");
  const snap = foldsOf(dom.root); p = draw(LIST); applyFolds(dom.root, snap);
  assert.equal(p.how.open, true, "a save's redraw");
  p = draw(LIST);
  assert.deepEqual([p.numbers.open, p.how.open, p.itemized.open], [false, true, false], "a new visit (menu, link, Next): only that part");
  ON_DAY(7); p = draw(LIST);
  assert.equal(p.how.open, true, "next week");
  ON_DAY(7 + 90); p = draw(LIST);
  assert.equal(p.how.open, false, "90 days unseen: the page draws it shut again");
  assert.equal(dom.store.has(MORE_KEY), false);
});
test("agree: a reading part shut against the switch stays shut after Back, a new visit and next week, until the switch is checked again", async () => {
  agreeing();
  moreDetail.set({ working: true });
  const LIST = [MORE, READ, BOXES];
  let p = draw(LIST);
  assert.deepEqual([p.numbers.open, p.how.open, p.itemized.open], [true, true, false], "the switch opens the reading parts only");
  await tapFold(p.how);
  assert.deepEqual(keptMarks(), { "taxes/federal#how": 0 }, "kept: 0, a shut against the switch");
  const entry = foldsOf(dom.root);
  assert.deepEqual(record(), [["D|how this is worked out", "shut", "open"]]);
  p = draw(LIST); applyFolds(dom.root, entry);
  assert.equal(p.how.open, false, "Back, Forward, a reload");
  p = draw(LIST); assert.equal(p.how.open, false, "a new visit");
  ON_DAY(7); p = draw(LIST); assert.equal(p.how.open, false, "next week");
  assert.equal(p.numbers.open, true, "the other reading part still follows the switch");
  moreDetail.set({ working: true });
  p = draw(LIST); assert.equal(p.how.open, true, "checking the switch again forgets the shut");
});
test("agree: a part with boxes and an item opened by hand are open after Back and a save, and shut on a new visit ('1 set by you')", async () => {
  for (const o of [BOXES, ITEM]) {
    agreeing();
    let p = draw([o]);
    await tapFold(p[o.id]);
    assert.equal(dom.store.has(MORE_KEY), false, `${o.kind}: nothing on this phone`);
    const entry = foldsOf(dom.root);
    assert.equal(record()[0][1], "open", `${o.kind}: wave 1 notes it`);
    p = draw([o]); applyFolds(dom.root, entry);
    assert.equal(p[o.id].open, true, `${o.kind}: Back, Forward or a reload: as they left that screen`);
    const snap = foldsOf(dom.root);
    p = draw([{ ...o, set: 1 }]); applyFolds(dom.root, snap);
    assert.equal(p[o.id].open, true, `${o.kind}: the redraw after a save inside it (its status changed, its title did not)`);
    p = draw([{ ...o, set: 1 }]);
    assert.equal(p[o.id].open, false, `${o.kind}: a new visit draws it shut`);
    assert.equal(p[o.id].querySelector(".fold-status").textContent, "1 set by you", `${o.kind}: saying what of theirs it holds`);
  }
});
test("agree: 'More details (optional)' opened by hand stays open for the visit (the form kit) and nothing reaches this phone's key", async () => {
  agreeing();
  const drawForm = () => { for (const c of [...dom.root.childNodes]) c.parentNode = null; dom.root.childNodes = []; dom.root.append(uiForm([{ key: "what", label: "What is it", type: "text" }, { key: "note", label: "Note", type: "text", more: true }], {}, () => { })); return dom.root.querySelector("details"); };
  let d = drawForm();
  assert.equal(d.open, false);
  await tapFold(d);
  const entry = foldsOf(dom.root);
  assert.deepEqual(record(), [["D|more details (optional)", "open", "shut"]]);
  d = drawForm(); applyFolds(dom.root, entry);
  assert.equal(d.open, true, "Back to that entry");
  d = drawForm();
  assert.equal(d.open, true, "a new visit within the visit: the kit keeps the person's choice");
  assert.equal(dom.store.has(MORE_KEY), false); assert.equal(moreKept.count(), 0);
  await tapFold(d);   // shut again: the kit forgets it (other tests start from a short form)
  assert.equal(drawForm().open, false);
});
test("agree: a landing (?show=) opens its part while that entry lasts, and nothing is kept", async () => {
  agreeing();
  const FIG = { id: "figures", kind: "own", title: "Figures the plan cannot see", holds: ["withheld"], body: ["Federal tax withheld so far"] };
  const LIST = [READ, FIG];
  const arrival = PAGE_CTX({ show: "withheld" });
  let p = draw(LIST, arrival);
  assert.deepEqual([p.figures.open, p.how.open], [true, false]);
  assert.deepEqual(record(), [], "a landing is not a tap: wave 1 notes nothing");
  assert.equal(dom.store.has(MORE_KEY), false);
  p = draw([READ, { ...FIG, open: true }], arrival);
  assert.equal(p.figures.open, true, "the redraw after a save inside it: the page's own open: true (pending) keeps it");
  p = draw(LIST, PAGE_CTX({ show: "withheld" }));
  assert.equal(p.figures.open, true, "Back to that entry (a new arrival at the same address)");
  p = draw(LIST);
  assert.equal(p.figures.open, false, "a new visit without it: as the page draws it");
});
test("agree: Back to an older entry shows that screen as it was, though the part was shut by hand later; a new visit shows the newer choice", async () => {
  agreeing();
  const LIST = [MORE, READ];
  let p = draw(LIST);
  await tapFold(p.how);
  const first = foldsOf(dom.root);
  p = draw(LIST);
  assert.equal(p.how.open, true, "the second entry (a new visit): kept open");
  await tapFold(p.how);
  assert.equal(dom.store.has(MORE_KEY), false, "shut by hand = as the page draws it: the entry goes");
  const second = foldsOf(dom.root);
  assert.deepEqual(second.map((f) => [f.by, f.drew]), [["shut", "open"]]);
  p = draw(LIST); applyFolds(dom.root, second);
  assert.equal(p.how.open, false, "Back to the second entry");
  p = draw(LIST); applyFolds(dom.root, first);
  assert.equal(p.how.open, true, "Back to the first entry: as they left that screen");
  p = draw(LIST);
  assert.equal(p.how.open, false, "a new visit: the newer choice");
});
test("agree: typing put back inside a shut part opens it (wave 1), and this phone keeps nothing for it", async () => {
  agreeing();
  const p = draw([{ ...BOXES, body: () => uiForm([{ key: "charity", label: "Gifts to charity", type: "money" }], {}, () => { }) }]);
  const box = p.itemized.querySelector("input");
  assert.equal(inShutFold(box), p.itemized);
  for (let d = inShutFold(box); d; d = inShutFold(box)) d.open = true;   // what refill() does when it puts typing back
  await later();
  assert.equal(p.itemized.open, true);
  assert.deepEqual(record(), [], "not a tap"); assert.equal(dom.store.has(MORE_KEY), false);
});

// ---------------------------------------------------------------- coming back to a page (2026-11-16)
// A part a person opened stays open across a save and a reload, also when the page itself draws the part it was saved in
// open again (docs/OPTIONAL.md R17: Crypto's "Sales for your tax return" after "Record the sale", Tax lots' "Compare ways
// to sell part of a fund" after "Work it out"). A save's redraw is foldsOf, a draw, applyFolds; a reload is a draw, then
// applyFolds(the entry's record).
import * as place from "../core/place.js";
const BO = { id: "bo", kind: "item", title: "Bo", body: ["Pay $50,000", "Withheld $4,100"] };
test("coming back: a part opened by hand and saved in (the page draws it open itself, R17) is open after a reload", async () => {
  agreeing();
  let p = draw([ITEM, BO]);
  await tapFold(p.ana);
  let snap = foldsOf(dom.root);
  p = draw([{ ...ITEM, set: 1, open: true }, BO]); applyFolds(dom.root, snap);   // "Record the sale": open: true for the part saved in
  assert.equal(p.ana.open, true, "after the save");
  assert.deepEqual(record(), [["D|ana", "open", "shut"]], "the person's record goes on with the part the page drew open again");
  const entry = foldsOf(dom.root);
  p = draw([{ ...ITEM, set: 1 }, BO]); applyFolds(dom.root, entry);
  assert.equal(p.ana.open, true, "a reload: the page draws it shut again, the record opens it");
  assert.equal(p.ana.querySelector(".fold-status").textContent, "1 set by you", "its status still says what it holds");
});
test("coming back: after a save in one part, a save in another part leaves the first open (no other part opens or shuts)", async () => {
  agreeing();
  let p = draw([ITEM, BO]);
  await tapFold(p.ana);
  let snap = foldsOf(dom.root);
  p = draw([{ ...ITEM, open: true }, BO]); applyFolds(dom.root, snap);   // saved in Ana
  await tapFold(p.bo);
  snap = foldsOf(dom.root);
  p = draw([ITEM, { ...BO, open: true }]); applyFolds(dom.root, snap);   // then saved in Bo
  assert.deepEqual([p.ana.open, p.bo.open], [true, true]);
  const entry = foldsOf(dom.root);
  p = draw([ITEM, BO]); applyFolds(dom.root, entry);
  assert.deepEqual([p.ana.open, p.bo.open], [true, true], "and after a reload");
});
test("coming back: a part saved in and then shut by hand is shut after a reload; opened again, open", async () => {
  agreeing();
  let p = draw([ITEM]);
  await tapFold(p.ana);
  const snap = foldsOf(dom.root);
  p = draw([{ ...ITEM, open: true }]); applyFolds(dom.root, snap);
  await tapFold(p.ana);
  assert.equal(p.ana.open, false);
  let entry = foldsOf(dom.root);
  p = draw([ITEM]); applyFolds(dom.root, entry);
  assert.equal(p.ana.open, false, "shut, as left");
  await tapFold(p.ana);
  entry = foldsOf(dom.root);
  p = draw([ITEM]); applyFolds(dom.root, entry);
  assert.equal(p.ana.open, true, "opened again: open, as left");
});
test("coming back: a part the page now draws open for its own reason, which the person had opened, shut by hand stays shut", async () => {
  agreeing();
  let p = draw([ITEM]);
  await tapFold(p.ana);
  const first = foldsOf(dom.root);
  p = draw([{ ...ITEM, fix: 1 }]); applyFolds(dom.root, first);   // Back to that entry: the page draws it open now ("1 to fix")
  assert.equal(p.ana.open, true);
  await tapFold(p.ana);
  const entry = foldsOf(dom.root);
  assert.deepEqual(record(), [["D|ana", "shut", "open"]], "measured against how the page draws it now");
  p = draw([{ ...ITEM, fix: 1 }]); applyFolds(dom.root, entry);
  assert.equal(p.ana.open, false, "a reload: shut, as left");
});
test("coming back: nothing opened by hand, nothing kept; a part only the page opened is not the person's (R17 as before)", async () => {
  agreeing();
  let p = draw([ITEM, BO]);
  let snap = foldsOf(dom.root);
  p = draw([{ ...ITEM, open: true }, BO]); applyFolds(dom.root, snap);
  assert.deepEqual(record(), [], "the page's own open: true is not a tap");
  const entry = foldsOf(dom.root);
  p = draw([ITEM, BO]); applyFolds(dom.root, entry);
  assert.deepEqual([p.ana.open, p.bo.open], [false, false], "a reload: as the page draws them");
});

// The few more pieces of a browser the cases below reach (typing and the arrival's "open the form again"); added to the
// stand-in once, after the cases above, which never use them.
let roomyDone = false;
function roomy(hash) {
  agreeing();
  globalThis.location = { hash, search: "?sandbox=1", href: `http://h/?sandbox=1${hash}` };
  if (roomyDone) return dom;
  roomyDone = true;
  const E = globalThis.Element.prototype, N = globalThis.Node.prototype;
  globalThis.CSS = { escape: (s) => String(s).replace(/["\\]/g, "\\$&") };
  globalThis.scrollY = 0; globalThis.innerHeight = 844;
  globalThis.document.querySelectorAll = (s) => globalThis.document.documentElement.querySelectorAll(s);
  const get = (o, k) => Object.getOwnPropertyDescriptor(o, k)?.get;
  const tget = get(E, "type"), cget = get(N, "textContent");
  Object.defineProperty(E, "type", { configurable: true, get: tget, set(v) { this.setAttribute("type", v); } });
  Object.defineProperty(N, "textContent", { configurable: true, get: cget, set(v) { for (const c of this.childNodes) c.parentNode = null; this.childNodes = []; this.append(String(v)); } });
  Object.defineProperty(N, "firstChild", { configurable: true, get() { return this.childNodes[0] ?? null; } });
  Object.defineProperty(E, "form", { configurable: true, get() { return /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(this.tagName) ? this.closest("form") : undefined; } });
  N.insertBefore = function (n, ref) { this.append(n); if (ref) { this.childNodes.splice(this.childNodes.indexOf(n), 1); this.childNodes.splice(this.childNodes.indexOf(ref), 0, n); } return n; };
  E.prepend = function (n) { this.insertBefore(n, this.childNodes[0] ?? null); };
  E.after = function (n) { this.parentNode.insertBefore(n, this.parentNode.childNodes[this.parentNode.childNodes.indexOf(this) + 1] ?? null); };
  // a script's click: the document's listeners, the element's own, then the browser's default (a summary toggles its section)
  E.click = function () { const ev = { type: "click", isTrusted: false, target: this }; for (const f of dom.on.click ?? []) f({ ...ev, preventDefault() { } }); this.dispatchEvent(ev); if (this.tagName === "SUMMARY" && this.parentNode?.tagName === "DETAILS") this.parentNode.open = !this.parentNode.open; };
  return dom;
}
/** A person typing into a box: the focus, each keystroke's input, then the change as they leave it (document first). */
function typeInto(box, text) {
  for (const f of dom.on.focusin ?? []) f({ type: "focusin", target: box });
  box.value = text;
  for (const f of dom.on.input ?? []) f({ type: "input", isTrusted: true, target: box });
  box.dispatchEvent({ type: "input", isTrusted: true });
  for (const f of dom.on.change ?? []) f({ type: "change", isTrusted: true, target: box });
  box.dispatchEvent({ type: "change", isTrusted: true });
}
// what the page's observer hands over (the stand-in has no MutationObserver); a form is found inside what was added
const removed = (n) => ({ addedNodes: [], removedNodes: [n] });
const added = (n) => ({ addedNodes: [n], removedNodes: [] });

test("coming back: a reload with typing kept in a part built when opened opens the part once, with the typing in its form", async () => {
  roomy("#/investments/tax-lots");
  place.visit({ v: "u1-a2", n: 1 }, "#/investments/tax-lots");
  const SELL = { id: "sell", kind: "item", title: "Compare ways to sell part of a fund", says: "2 ways", lazy: true,
    body: () => uiForm([{ key: "amount", label: "Shares to sell", type: "number" }], {}, () => { }, { submitLabel: "Work it out" }) };
  let p = draw([SELL]);
  await tapFold(p.sell);                                   // opened by hand: the body is built on the toggle
  await later();
  const f0 = p.sell.querySelector("form");
  assert.ok(f0, "the form is drawn once the part is open");
  place._test.watch([added(p.sell.querySelector(".fold-body"))]);   // what the page's observer hands over: the form appeared after the tap
  typeInto(f0.querySelector("input"), "5");
  place.remember();                                        // the page goes (pagehide): the typing is written down
  const entry = foldsOf(dom.root);
  // the reload: the page draws the part shut and its body not built yet; then what afterArrive does
  place.visit({ v: "u1-a2", n: 1 }, "#/investments/tax-lots");
  p = draw([SELL]);
  applyFolds(dom.root, entry); place.refill(dom.root); place._test.reopen(dom.root); place.tell(dom.root);
  await later(); await later();
  const f1 = p.sell.querySelector("form");
  if (f1) { place._test.watch([added(p.sell.querySelector(".fold-body"))]); await later(); }
  assert.equal(p.sell.open, true, "open, as left (the form's opener is that part's own row: it is not pressed again)");
  assert.equal(p.sell.querySelector("input")?.value, "5", "the typing is back in its box");
  assert.equal(dom.root.querySelector("[data-place=kept]"), null, "no 'Not saved yet ... Open it' line: the form is on the screen");
  place.forgetAll();
});
test("coming back: a part is the same part after a save changed a heading inside it (its card is named by its own heading only)", async () => {
  agreeing();
  // Crypto: the card of parts has no heading of its own; "Record a sale" is the form's heading inside "Sales for your tax
  // return", and it goes when the sale is recorded (the form folds behind "+ Record another sale")
  const SALES = { id: "sales", kind: "item", title: "Sales for your tax return", says: "none in 2026", body: () => [uiH("h3", {}, "Record a sale"), "How many coins you sold"] };
  const SOLD = { ...SALES, says: "1 in 2026", body: () => ["0.05 BTC sold Nov 16, 2026", "+ Record another sale"] };
  let p = draw([SALES]);
  await tapFold(p.sales);
  const snap = foldsOf(dom.root);
  p = draw([{ ...SOLD, open: true }]); applyFolds(dom.root, snap);
  const entry = foldsOf(dom.root);
  assert.deepEqual(entry.map((f) => [f.loc.k, f.loc.s, f.by, f.drew]), [["D|sales for your tax return", "c:", "open", "shut"]], "named by its card's own heading (none), never by the form's");
  p = draw([SOLD]); applyFolds(dom.root, entry);
  assert.equal(p.sales.open, true, "a reload: open, '1 in 2026' beside it");
});

// ---------------------------------------------------------------- typing the page took itself is never "changed since" (2026-11-16)
// "Some of what you typed was not put back: those figures were changed since." is for typing let go because the saved figure
// under it moved while the person was away. Never for a figure the page took itself (Goal seek's own box: 50000, 0,
// 300000, "Use age 61"), nor for one a save took and the page drew its own way.
const LET_GO = "Some of what you typed was not put back: those figures were changed since.";
test("the same figure written two ways is the same figure; a code or words are compared as written", () => {
  assert.equal(place.sameFigure("50,000", "50000"), true, "the box's own commas, put in as it is left");
  assert.equal(place.sameFigure("$50,000", "50000"), true);
  assert.equal(place.sameFigure("50k", "50,000"), true, "the kit reads 50k as 50,000");
  assert.equal(place.sameFigure("1,234.5", "1234.50"), true);
  assert.equal(place.sameFigure("50,000", "50,001"), false);
  assert.equal(place.sameFigure("02139", "2139"), false, "a leading zero: a code, not an amount");
  assert.equal(place.sameFigure("Weekend tutoring", "weekend tutoring"), false, "words as written");
  assert.equal(place.sameFigure("", "0"), false, "an empty box is not a zero");
  assert.equal(place.sameFigure("", ""), true);
  assert.equal(boxVerdict("600,000", "50000", "50,000"), "same", "the page put the typing back in its own writing");
  assert.equal(boxVerdict("3,900", "9999", "3,900"), "fill");
  assert.equal(boxVerdict("3,900", "9999", "3900"), "fill", "drawn as before, in other writing: put back");
  assert.equal(boxVerdict("380,000", "391,000", "395,000"), "changed", "the saved figure moved meanwhile");
});
test("the same figure: only an amount as a money box writes it (commas between groups of three); other text as written", () => {
  // a comma or a space is a thousands mark only between groups of three digits: "1,5" (a decimal comma), "12 34", a phone
  // number "555 1234" are not amounts, so they are compared as written (wave 1's rule): "1,5" typed and 15 drawn is a change
  for (const [a, b] of [["1,5", "15"], ["1,23", "123"], ["12 34", "1234"], ["555 1234", "5551234"], ["10", "1 0"], ["2025", "20 25"],
    ["5000", "5,00,0"], ["1,0000", "10000"], ["1234,567", "1234567"], ["1 000 000", "1000000"], ["1.5", "1,5"]]) {
    assert.equal(place.sameFigure(a, b), false, `${JSON.stringify(a)} is not ${JSON.stringify(b)}`);
  }
  for (const [a, b] of [["1,000", "1000"], ["50,000", "50000"], ["$50,000", "50000"], ["50k", "50,000"], ["5m", "5,000,000"],
    ["1,234.5", "1234.50"], ["1,234,567", "1234567"], ["-$50", "-50"], ["$ 1,200", "1200"], ["0.5", ".5"], [" 300000 ", "300,000"]]) {
    assert.equal(place.sameFigure(a, b), true, `${JSON.stringify(a)} is ${JSON.stringify(b)}`);
  }
  assert.equal(boxVerdict("1", "1,5", "15"), "changed", "a decimal comma typed, 15 drawn: not put back, and said (as before)");
  assert.equal(boxVerdict("15", "1,5", "15"), "fill", "drawn as before the typing: put back (as before)");
});

/** Goal seek's "N more ages" as the page draws it: the chips, "Type my own" (choice()'s one box, the kit's money box, which
 * commits on change to the page's own choice and draws the chips again without it), the answer and its "Use age 61". */
function goalSeek({ target = null, typed = false } = {}) {
  const st = { target, box: null, label: null };
  const amount = (n) => n.toLocaleString("en-US");
  const host = uiH("div", {}), answer = uiH("div", {});
  const use = uiH("button", { type: "button" }, "Use age 61");
  const openBox = () => {
    const input = uiH("input", { type: "text", name: "savingsTarget", "aria-label": "Your own figure, in today's dollars" });
    input.value = st.target === null ? "600,000" : amount(st.target);
    input.addEventListener("change", () => {
      const n = Number(String(input.value).replace(/[$,\s]/g, ""));
      if (!(n >= 1)) return;                        // the kit refuses 0 ("Use $1 or more."): the box stays
      st.target = Math.min(n, 1000000);              // the page's own choice; a page may answer with its own figure
      const was = st.label; st.label = null; st.box = null; was.remove();
      place._test.watch([removed(was)]);
    });
    st.box = input;
    st.label = uiH("label", { class: "field" }, uiH("span", { class: "field-label" }, "Your own figure, in today's dollars"), input);
    host.append(st.label);
    place._test.watch([added(st.label)]);
    return input;
  };
  const p = draw([{ id: "ages", kind: "more", n: 16, noun: "ages", open: true, body: () => [uiH("p", {}, "When will your savings reach a figure?"), host, answer] }]);
  answer.append(use);
  if (typed) openBox();
  return { p, st, openBox, use };
}
const tap = (el) => { for (const f of dom.on.pointerdown ?? []) f({ type: "pointerdown", isTrusted: true, target: el }); for (const f of dom.on.click ?? []) f({ type: "click", isTrusted: true, target: el, preventDefault() { } }); };
/** What the shell does when a store.update changed the plan: saved(), then the redraw (before, a draw, then afterSave's own
 * first steps: the sections, the typing, the kept lines). */
function savedAndRedrawn(redraw) {
  place.saved(true);
  const snap = place.before();
  const out = redraw();
  applyFolds(dom.root, snap.folds); place.refill(dom.root); place.tell(dom.root, { quiet: true });
  return out;
}
const said = () => echoes.filter((t) => /was not put back/.test(t));

test("typing the page took: Goal seek's own figures 50000, then 0, then 300000, then 'Use age 61' say nothing was lost", async () => {
  roomy("#/scenarios/goal-seek");
  place.visit({ v: "u1-b", n: 1 }, "#/scenarios/goal-seek");
  echoes.length = 0;
  const g = goalSeek();
  typeInto(g.openBox(), "50000"); await later();
  typeInto(g.openBox(), "0"); await later();          // "Type my own" again: the box shows "50,000", the page's own writing
  typeInto(g.st.box, "300000"); await later();         // the kit refused 0; the same box
  assert.equal(g.st.target, 300000);
  tap(g.use);
  savedAndRedrawn(() => goalSeek({ target: 300000 }));   // "Saved: Pat's retirement age is now 61 ..." (the page's own line)
  await later();
  assert.deepEqual(said(), [], "no 'not put back' line, at any moment");
  const again = goalSeek({ target: 300000, typed: true });   // "Type my own" after the save: the page's $300,000
  await later(); place.tell(dom.root);
  assert.equal(again.st.box.value, "300,000");
  assert.deepEqual(said(), []);
  place.forgetAll();
});
test("typing the page took: a clean 300000 then 'Use age 61' says nothing either (as before)", async () => {
  roomy("#/scenarios/goal-seek");
  place.visit({ v: "u1-b", n: 1 }, "#/scenarios/goal-seek");
  echoes.length = 0;
  const g = goalSeek();
  typeInto(g.openBox(), "300000"); await later();
  tap(g.use);
  savedAndRedrawn(() => goalSeek({ target: 300000 }));
  await later();
  assert.deepEqual(said(), []);
  place.forgetAll();
});
test("typing the page took and answered with its own figure (5,000,000 typed, its most, 1,000,000, drawn): let go quietly", async () => {
  roomy("#/scenarios/goal-seek");
  place.visit({ v: "u1-b", n: 1 }, "#/scenarios/goal-seek");
  echoes.length = 0;
  const g = goalSeek();
  typeInto(g.openBox(), "5,000,000"); await later();
  assert.equal(g.st.target, 1000000);
  const box = g.openBox(); await later(); place.tell(dom.root);
  assert.equal(box.value, "1,000,000", "the page's figure stands");
  assert.deepEqual(said(), []);
  assert.equal(place.hasTyping(), false, "the draft is gone: the page has its answer");
  place.forgetAll();
});

/** A card with one box in no form and its own button ("Use this"), as a calculator's what-if row draws it. */
function homeCard(value) {
  for (const c of [...dom.root.childNodes]) c.parentNode = null;
  dom.root.childNodes = [];
  const input = uiH("input", { type: "text", name: "homeValue", "aria-label": "What your home is worth" });
  input.value = value;
  const use = uiH("button", { type: "button" }, "Use this");
  dom.root.append(uiH("section", { class: "card" }, uiH("h2", {}, "Your home"), uiH("label", { class: "field" }, uiH("span", { class: "field-label" }, "What your home is worth"), input), use));
  return { input, use };
}
test("typing a save took: the box drawn again in the page's own rounding says nothing; drawn as before the typing, put back as before", async () => {
  roomy("#/property/home");
  place.visit({ v: "u1-c", n: 1 }, "#/property/home");
  echoes.length = 0;
  let h = homeCard("380,000");
  typeInto(h.input, "391234.567");
  tap(h.use);
  h = savedAndRedrawn(() => homeCard("391,234.57"));   // saved, rounded to cents by the page
  await later();
  assert.deepEqual(said(), [], "the save took it: no 'not put back' line");
  place.forgetAll();
  // the same, where the save did not use the box (the page draws what it showed before the typing): put back, as before
  place.visit({ v: "u1-c", n: 1 }, "#/property/home");
  h = homeCard("380,000");
  typeInto(h.input, "391,000");
  tap(h.use);
  h = savedAndRedrawn(() => homeCard("380,000"));
  assert.equal(h.input.value, "391,000", "put back, with 'Not saved yet'");
  assert.deepEqual(said(), []);
  place.forgetAll();
});
/** The same card with a second box the button does not save ("What you still owe on it"); `owed: null` draws the card
 * without it (the page shows it again later). */
function homeCard2(value, owed) {
  const h = homeCard(value);
  if (owed === null) return h;
  const box = uiH("input", { type: "text", name: "owed", "aria-label": "What you still owe on it" });
  box.value = owed;
  dom.root.querySelector("section").append(uiH("label", { class: "field" }, uiH("span", { class: "field-label" }, "What you still owe on it"), box));
  return { ...h, owed: box };
}
test("typing a save took is only a box whose figure the save wrote: another box in its card it did not use is still said when its figure moves", async () => {
  roomy("#/property/home");
  // (1) the save's redraw leaves the other box out; the person goes on, leaves, and its saved figure moves meanwhile
  place.visit({ v: "u1-f", n: 1 }, "#/property/home");
  echoes.length = 0;
  let h = homeCard2("380,000", "200,000");
  typeInto(h.input, "391,000");
  typeInto(h.owed, "210,000");
  tap(h.use);                                          // "Use this" saves the home's worth only
  h = savedAndRedrawn(() => homeCard2("391,000", null));
  await later();
  assert.deepEqual(said(), []);
  tap(dom.root.querySelector("h2"));                   // the person goes on (a tap: another act)
  place.remember();
  place.visit({ v: "u1-f", n: 2 }, "#/overview/dashboard");
  homeCard("1");
  place.visit({ v: "u1-f", n: 1 }, "#/property/home");
  h = homeCard2("391,000", "195,000");                 // back: what is owed was changed elsewhere meanwhile
  place.refill(dom.root); place.tell(dom.root);
  assert.equal(h.owed.value, "195,000", "the plan wins");
  assert.deepEqual(said(), [LET_GO], "the typing in the box the save did not use was let go: said, as before");
  place.forgetAll();
  // (2) the save's redraw draws the other box as before: its typing is put back and is not the save's either
  place.visit({ v: "u1-g", n: 1 }, "#/property/home");
  echoes.length = 0;
  h = homeCard2("380,000", "200,000");
  typeInto(h.input, "391,000");
  typeInto(h.owed, "210,000");
  tap(h.use);
  h = savedAndRedrawn(() => homeCard2("391,000", "200,000"));
  assert.equal(h.owed.value, "210,000", "put back, with 'Not saved yet'");
  assert.equal(h.input.value, "391,000");
  h = homeCard2("391,000", "195,000");                 // drawn again with a figure saved elsewhere
  place.refill(dom.root); place.tell(dom.root);
  assert.equal(h.owed.value, "195,000");
  assert.deepEqual(said(), [LET_GO]);
  place.forgetAll();
  // (3) one tap whose page updates the plan twice: the box the first update covered is the save's on the redraw
  place.visit({ v: "u1-h", n: 1 }, "#/property/home");
  echoes.length = 0;
  h = homeCard("380,000");
  typeInto(h.input, "391234.567");
  tap(h.use);
  place.saved(true);                                   // the page's first store.update
  h = savedAndRedrawn(() => homeCard("391,234.57"));   // its second, then the redraw in the page's rounding
  await later();
  assert.deepEqual(said(), [], "the save took it: no 'not put back' line");
  place.forgetAll();
});
test("typing let go because the saved figure moved while the person was away is said once, on its page, when it happens", async () => {
  roomy("#/property/home");
  place.visit({ v: "u1-d", n: 1 }, "#/property/home");
  echoes.length = 0;
  let h = homeCard("380,000");
  typeInto(h.input, "391,000");
  place.remember();                                   // left by the menu: the typing is written down
  place.visit({ v: "u1-d", n: 2 }, "#/overview/dashboard");
  homeCard("1");                                      // another page
  // back: the page works its answer out and draws the box a moment later, with the figure saved elsewhere meanwhile
  place.visit({ v: "u1-d", n: 1 }, "#/property/home");
  for (const c of [...dom.root.childNodes]) c.parentNode = null;
  dom.root.childNodes = [];
  place.refill(dom.root); place.tell(dom.root);        // the arrival: the box is not drawn yet
  assert.deepEqual(said(), []);
  h = homeCard("395,000");
  place._test.watch([added(dom.root.querySelector("section"))]);
  await later();
  assert.deepEqual(said(), [LET_GO], "said once, when it is found, on its own page");
  place.visit({ v: "u1-d", n: 3 }, "#/overview/dashboard");
  homeCard("1"); place.refill(dom.root); place.tell(dom.root);
  assert.deepEqual(said(), [LET_GO], "never again, never on another page");
  place.forgetAll();
});
test("typing the page took: a chip picked since, then 'Type my own' again, says nothing; a reload that lost the page's choice puts the typing back, as before", async () => {
  roomy("#/scenarios/goal-seek");
  place.visit({ v: "u1-e", n: 1 }, "#/scenarios/goal-seek");
  echoes.length = 0;
  let g = goalSeek();
  typeInto(g.openBox(), "50000"); await later();
  let box = g.openBox(); await later();
  assert.equal(box.value, "50,000", "the page's own writing of the figure: left as drawn");
  const shut = uiH("button", { type: "button" }, "Type my own");
  dom.root.querySelector("details").append(shut);
  tap(shut); const was = g.st.label; was.remove(); g.st.label = null; place._test.watch([removed(was)]); await later();   // the chooser shut by a tap
  g.st.target = 1000000;                              // the "$1,000,000" chip
  box = g.openBox(); await later(); place.tell(dom.root);
  assert.equal(box.value, "1,000,000");
  assert.deepEqual(said(), [], "the chip is the page's answer: nothing 'not put back'");
  // a reload: the page forgot its choice and draws what it drew before the typing; the typing goes back in, as before
  place.forgetAll();
  place.visit({ v: "u1-e", n: 1 }, "#/scenarios/goal-seek");
  g = goalSeek();
  typeInto(g.openBox(), "50000"); await later();
  place.remember();
  place.visit({ v: "u1-e", n: 1 }, "#/scenarios/goal-seek");
  g = goalSeek();                                     // target null again: the box draws "600,000"
  box = g.openBox(); await later();
  assert.equal(box.value, "50000", "put back, with 'Not saved yet' and 'Undo my typing' beside it");
  assert.ok(box.parentNode.querySelector(".place-cue"));
  assert.deepEqual(said(), []);
  place.forgetAll();
});

// ---------------------------------------------------------------- invariance: nothing new happens where nothing new is typed or drawn
// The rules as they were at 67dfd25, written out: every case they decided the same way is decided the same way now.
const OLD_VERDICT = (d, v, now) => (now === v ? "same" : now === d ? "fill" : "changed");
test("invariance: a box drawn again is decided as before unless two of its texts are one amount written two ways", () => {
  const texts = ["", "0", "3,900", "9,999", "380,000", "391,000", "395,000", "Weekend tutoring", "2026-11-16", "02139", "2139", "7%", "Store card", "12.5"];
  let n = 0;
  for (const d of texts) for (const v of texts) for (const now of texts) {
    const twoWays = [[d, v], [d, now], [v, now]].some(([a, b]) => a !== b && place.sameFigure(a, b));
    assert.equal(twoWays, false, "the grid holds no amount written two ways");
    assert.equal(boxVerdict(d, v, now), OLD_VERDICT(d, v, now), `${JSON.stringify([d, v, now])}`);
    n++;
  }
  assert.equal(n, texts.length ** 3);
  // text that only looks like an amount once its commas and spaces are dropped: as before, every way
  const loose = ["1,5", "15", "1,23", "123", "12 34", "1234", "555 1234", "5551234"];
  for (const d of loose) for (const v of loose) for (const now of loose) {
    assert.equal(boxVerdict(d, v, now), OLD_VERDICT(d, v, now), `${JSON.stringify([d, v, now])}`);
    n++;
  }
  assert.equal(n, 2744 + 512);
  // only the same amount written two ways reads otherwise: the page's own writing of the typing
  assert.deepEqual([OLD_VERDICT("600,000", "50000", "50,000"), boxVerdict("600,000", "50000", "50,000")], ["changed", "same"]);
  assert.deepEqual([OLD_VERDICT("3,900", "9999", "3900"), boxVerdict("3,900", "9999", "3900")], ["changed", "fill"]);
});
test("invariance: sections the page draws as before go back exactly as before (Back, a reload, a save's redraw)", async () => {
  agreeing();
  // drawn as before: the reading parts' own memory on this phone is cleared before each draw, so the page draws every part
  // shut as it did when the record was made (with it, the page draws them open itself: the case above, R17's kin)
  const LIST = [MORE, READ, BOXES, ITEM, BO];
  for (const tapped of [["how"], ["numbers", "ana"], ["itemized", "bo", "how"]]) {
    let p = draw(LIST);
    for (const id of tapped) await tapFold(p[id]);
    const entry = foldsOf(dom.root);
    moreKept.clear("all");
    for (const f of entry) assert.equal(f.drew, "shut", "each was drawn shut and opened by hand");
    p = draw(LIST); applyFolds(dom.root, entry);
    assert.deepEqual(Object.entries(p).filter(([, d]) => d.open).map(([k]) => k).sort(), [...tapped].sort(), "the same ones open");
    assert.deepEqual(foldsOf(dom.root).map((f) => [f.loc.k, f.by, f.drew]), entry.map((f) => [f.loc.k, f.by, f.drew]), "the same record");
    for (const id of tapped) await tapFold(p[id]);   // shut again: nothing kept
    assert.deepEqual(record(), []);
    moreKept.clear("all");
  }
});

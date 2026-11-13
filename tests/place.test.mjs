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
function agreeing() {
  if (!dom) { dom = miniDom(); placeStart({ root: () => dom.root }); }
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

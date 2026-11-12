// tests/router-replace.test.mjs -- the router's history numbering in a pretend browser (core/router.js): a link is a new
// entry, a page's own location.replace keeps the entry's number, Back and Forward and a reload are told apart, a layer
// (the menu, an edit form) is one more entry that Back closes, and "‹ Back to ..." links go Back only when the page they
// name is just behind. The pretend browser fires popstate then hashchange on a fragment navigation, as Chromium does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isReplace } from "../core/router.js";

test("isReplace: a mark decides; else no traversal, the same length, under the cap", () => {
  assert.equal(isReplace({ had: false, mark: "replace", traversed: false, len: 3, lenRef: 3 }), false, "the first entry is never a replace");
  assert.equal(isReplace({ had: true, mark: "new", traversed: false, len: 3, lenRef: 3 }), false);
  assert.equal(isReplace({ had: true, mark: "replace", traversed: true, len: 9, lenRef: 3 }), true);
  assert.equal(isReplace({ had: true, mark: null, traversed: false, len: 3, lenRef: 3 }), true, "a page's own location.replace");
  assert.equal(isReplace({ had: true, mark: null, traversed: false, len: 4, lenRef: 3 }), false, "a link grows the history");
  assert.equal(isReplace({ had: true, mark: null, traversed: true, len: 3, lenRef: 3 }), false, "after a Back the length cannot tell");
  assert.equal(isReplace({ had: true, mark: null, traversed: false, len: 50, lenRef: 50 }), false, "at the browser's cap a push keeps the length");
});

// ---------------------------------------------------------------- a pretend browser, just enough for the router
const listeners = {};
const fire = (type) => { for (const fn of listeners[type] ?? []) fn({ type }); };
const store = new Map();
globalThis.sessionStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.addEventListener = (t, fn) => { (listeners[t] ??= []).push(fn); };
const clicks = [];
globalThis.document = { addEventListener: (t, fn) => { if (t === "click") clicks.push(fn); } };
const ORIGIN = "http://x/";
class History {
  constructor() { this.entries = [{ url: ORIGIN + "#/overview/dashboard", state: null }]; this.i = 0; }
  get length() { return this.entries.length; }
  get state() { return this.entries[this.i].state; }
  pushState(s, _t, u) { this.entries.splice(this.i + 1); this.entries.push({ url: u ? ORIGIN + u : this.entries[this.i].url, state: structuredClone(s) }); this.i++; }
  replaceState(s, _t, u) { this.entries[this.i] = { url: u ? ORIGIN + u : this.entries[this.i].url, state: structuredClone(s) }; }
  go(d) { const j = this.i + d; if (j < 0 || j >= this.entries.length) return; const was = location.hash; this.i = j; queueMicrotask(() => { fire("popstate"); if (location.hash !== was) fire("hashchange"); }); }
  back() { this.go(-1); }
  forward() { this.go(1); }
}
globalThis.History = History;
globalThis.history = new History();
const hashOfUrl = (u) => u.slice(u.indexOf("#"));
globalThis.location = {
  get hash() { return hashOfUrl(history.entries[history.i].url); },
  set hash(h) { if (h === this.hash) return; history.entries.splice(history.i + 1); history.entries.push({ url: ORIGIN + h, state: null }); history.i++; queueMicrotask(() => { fire("popstate"); fire("hashchange"); }); },
  get href() { return history.entries[history.i].url; },
  search: "",
  replace(h) { history.entries[history.i] = { url: ORIGIN + h, state: null }; queueMicrotask(() => { fire("popstate"); fire("hashchange"); }); },
};
const tick = () => new Promise((r) => setTimeout(r, 0));

test("a walk: links, Back, a page's own replace, Forward, a layer and the ways back", async () => {
  const { router } = await import("../core/router.js");
  const seen = [];
  router.start((route, e) => seen.push({ page: `${route.group}/${route.id}`, n: e.n, kind: e.kind, from: e.from?.n ?? null, replaced: e.replaced }));
  const last = () => seen.at(-1);
  assert.deepEqual(last(), { page: "overview/dashboard", n: 1, kind: "new", from: null, replaced: false }, "the first draw of a fresh tab");
  location.hash = "#/a/one"; await tick();
  assert.equal(last().n, 2); assert.equal(last().kind, "new");
  history.back(); await tick();
  assert.deepEqual([last().n, last().kind], [1, "back"]);
  location.hash = "#/b/two"; await tick();
  assert.deepEqual([last().n, last().kind, last().replaced], [2, "new", false], "link, Back, link: 2, 1, 2 (the second link is not a replace)");
  assert.equal(router.at(2).href, "#/b/two"); assert.equal(router.at(2).p, 1);
  // a page replaces its own address (Get started's own ‹, the Ledger's deep link): the entry keeps its number and where it came from
  location.replace("#/b/two-and-a-half"); await tick();
  assert.deepEqual([last().n, last().replaced, last().page], [2, true, "b/two-and-a-half"]);
  assert.equal(router.at(2).p, 1);
  assert.equal(history.length, 2, "nothing was added");
  // a state the page wrote without the numbers keeps them
  history.replaceState(null, "", "#/b/two-and-a-half?x=1");
  assert.equal(history.state.n, 2); assert.equal(router.at(2).href, "#/b/two-and-a-half?x=1", "the trail follows the address (touch)");
  history.replaceState({ ...history.state, suFrom: "q3" }, "");
  assert.equal(history.state.suFrom, "q3"); assert.equal(history.state.n, 2);
  location.hash = "#/c/three"; await tick();
  assert.deepEqual([last().n, last().from], [3, 2]);
  history.back(); await tick(); history.forward(); await tick();
  assert.deepEqual(seen.slice(-2).map((x) => [x.n, x.kind]), [[2, "back"], [3, "forward"]]);
  // a layer: Back closes it, no redraw, the address stays
  let closed = 0;
  const drawn = seen.length;
  const release = router.layer(() => { closed++; });
  assert.equal(history.length, 4); assert.equal(history.state.l, 1); assert.equal(router.layersOpen(), 1);
  history.back(); await tick();
  assert.equal(closed, 1); assert.equal(seen.length, drawn, "no redraw"); assert.equal(location.hash, "#/c/three"); assert.equal(router.layersOpen(), 0);
  release(); await tick();
  assert.equal(history.i, 2, "release() after Back already closed it does nothing");
  // a layer closed by itself steps off its entry; the next Back leaves the page
  const r2 = router.layer(() => { closed++; });
  r2(); await tick();
  assert.equal(closed, 1, "release() does not call close()"); assert.equal(history.state.l ?? 0, 0); assert.equal(seen.length, drawn);
  // Forward onto the entry of a layer no longer open is stepped off at once
  history.forward(); await tick(); await tick();
  assert.equal(history.state.l ?? 0, 0); assert.equal(seen.length, drawn);
  // a link while a layer is open takes the layer's entry
  router.layer(() => { closed++; });
  router.open("#/d/four", { via: "menu" }); await tick();
  assert.deepEqual([last().page, last().n, last().from], ["d/four", 4, 3]);
  assert.equal(router.at(4).via, "menu"); assert.equal(closed, 2, "leaving the page closed what was open over it");
  history.back(); await tick();
  assert.deepEqual([last().page, last().n], ["c/three", 3], "Back from it reaches the page, not a menu's entry");
  // ways back: the page just behind; along a Next-result walk; a page opened another way in between is a link
  location.hash = "#/e/five"; await tick();
  assert.equal(router.back("#/c/three?from=plan"), true, "the page just behind (from does not count)"); await tick();
  assert.deepEqual([last().page, last().kind], ["c/three", "back"]);
  assert.equal(router.back("#/a/one"), false, "not just behind: the link is followed");

  // regress-break 1: entries another visit numbered (sessionStorage blocked: a new visit at every load; or the version before
  // wave 1, whose entries carry no number). Back onto one must not take the number of the entry on screen, and Forward
  // from it draws the page its address names
  location.hash = "#/f/six"; await tick();
  location.hash = "#/g/seven"; await tick();
  history.entries[history.i - 1].state = { v: "a-visit-whose-id-was-lost", n: 2, l: 0 };
  const onScreen = last().n;
  history.back(); await tick();
  assert.equal(last().page, "f/six"); assert.notEqual(last().n, onScreen, "a number of its own, not the one on screen");
  let before = seen.length;
  history.forward(); await tick();
  assert.equal(seen.length, before + 1, "Forward draws"); assert.equal(last().page, "g/seven");
  // an entry with no number at all (the version before): even when it is taken for the entry on screen, Forward still draws
  history.entries[history.i - 1].state = null;
  history.back(); await tick();
  assert.equal(last().page, "f/six");
  before = seen.length;
  history.forward(); await tick();
  assert.equal(seen.length, before + 1, "Forward draws the page of its address"); assert.equal(last().page, "g/seven");
  history.back(); await tick();
  assert.equal(last().page, "f/six", "and Back again");
});

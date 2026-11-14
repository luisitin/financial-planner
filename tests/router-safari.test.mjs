// tests/router-safari.test.mjs -- the router in a pretend Safari (core/router.js). Safari keeps an entry's history.state
// when location.replace() changes only the part after "#"; Chromium empties it. The open menu is an entry whose state
// says "something is open over the page" (l: 1), and a row tapped in the menu replaces that entry. With the state kept,
// the router read the new page's entry as "a menu is still open here" and stepped Back off it: the menu closed and the
// page never changed (the owner's iPhone recording, 2026-11-13). A row in the menu must open its page in both browsers.
import { test } from "node:test";
import assert from "node:assert/strict";

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
  replace(h) { history.entries[history.i] = { url: ORIGIN + h, state: history.entries[history.i].state };   // Safari: the state stays
    queueMicrotask(() => { fire("popstate"); fire("hashchange"); }); },
};
const tick = () => new Promise((r) => setTimeout(r, 0));


test("Safari keeps the state across location.replace: a row in the open menu still opens its page", async () => {
  const { router } = await import("../core/router.js");
  const seen = [];
  router.start((route, e) => seen.push({ page: `${route.group}/${route.id}`, n: e.n, from: e.from?.n ?? null }));
  const last = () => seen.at(-1);
  location.hash = "#/overview/start"; await tick();
  assert.deepEqual(last(), { page: "overview/start", n: 2, from: 1 });
  let closed = 0;
  router.layer(() => { closed++; });                       // the menu opens
  assert.equal(history.state.l, 1);
  router.open("#/transactions/rules", { via: "menu" }); await tick(); await tick(); await tick();
  assert.equal(location.hash, "#/transactions/rules", "the page chosen is the one on screen");
  assert.deepEqual(last(), { page: "transactions/rules", n: 3, from: 2 }, "drawn once, as a new numbered entry after the page the menu was opened on");
  assert.equal(closed, 1, "the menu closed");
  assert.equal(history.state.l ?? 0, 0, "the entry no longer stands for an open menu");
  assert.equal(router.at(3).via, "menu");
  history.back(); await tick();
  assert.deepEqual([last().page, last().n], ["overview/start", 2], "Back returns to the page the menu was opened on");
  // and again, straight after: open the menu, pick another row
  router.layer(() => { closed++; });
  router.open("#/investments/allocation", { via: "menu" }); await tick(); await tick(); await tick();
  assert.equal(location.hash, "#/investments/allocation");
  assert.equal(last().page, "investments/allocation");
  // a page's own replace (no menu open) keeps its number here too
  location.replace("#/investments/allocation?x=1"); await tick();
  assert.equal(last().n, 3); assert.equal(history.state.l ?? 0, 0);
});

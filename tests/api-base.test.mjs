// tests/api-base.test.mjs -- core/api.js asks for a PC only where one can be: a static site (GitHub Pages) has none at its
// own address, and used to request /api/health and /api/config at the github.io domain root on every open (404 each time;
// store.js asked again on every sync: 13 per open on the live site). Now api.base() is blank unless the PC served the
// page (its import map is there), a PC address is typed on Settings, and nothing is requested without one.
import test from "node:test";
import assert from "node:assert/strict";

const calls = [];
globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return new Response(JSON.stringify({ ok: true }), { status: 200 }); };
const store = {};
globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
globalThis.dispatchEvent = () => true;
const page = (origin, importmap) => {
  const u = new URL(origin);
  globalThis.location = { protocol: u.protocol, origin: u.origin, hostname: u.hostname };
  globalThis.document = { querySelector: (sel) => (importmap && sel === 'script[type="importmap"]' ? {} : null) };
};
const { api, conn, pageFromPc } = await import("../core/api.js");
const reset = () => { calls.length = 0; for (const k of Object.keys(store)) delete store[k]; api.health = null; api.configCache = null; };

test("a static site (no import map): no PC address, and not one request for it", async () => {
  reset(); page("https://someone.github.io", false);
  assert.equal(pageFromPc(), false);
  assert.equal(api.base(), "");
  assert.equal(await api.ready(), false, "no PC to ask");
  assert.equal(await api.config(), null);
  await assert.rejects(api.getPlan(), /This needs your computer\. Connect to it in Settings first/);
  await assert.rejects(api.putPlan({}), /This needs your computer\. Connect to it in Settings first/);
  await assert.rejects(api.compute("x", {}), /This needs your computer\. Connect to it in Settings first/);
  await assert.rejects(api.aiChat([]), /This needs your computer\. Connect to it in Settings first/);
  await assert.rejects(api.aiModels(), /This needs your computer\. Connect to it in Settings first/);
  await assert.rejects(api.readStatement({}), /This needs your computer\. Connect to it in Settings first/);
  await assert.rejects(api.readDocumentText({}), /This needs your computer\. Connect to it in Settings first/);
  assert.equal(calls.length, 0, "nothing went to https://someone.github.io/api/... (13 404s per open before)");
});

test("the PC served the page (its import map): the page's own address is the PC, as before", async () => {
  reset(); page("http://planner-pc.example:8787", true);
  assert.equal(pageFromPc(), true);
  assert.equal(api.base(), "http://planner-pc.example:8787");
  assert.equal(await api.ready(), true);
  assert.equal(calls[0].url, "http://planner-pc.example:8787/api/health");
  await api.config();
  assert.equal(calls[1].url, "http://planner-pc.example:8787/api/config");
  await api.compute("monte-carlo", {});
  assert.equal(calls[2].url, "http://planner-pc.example:8787/api/compute/monte-carlo");
  page("http://localhost:8787", true);
  assert.equal(api.base(), "http://localhost:8787", "the PC itself");
});

test("a PC address typed on Settings is used wherever the page came from; a trailing slash is dropped", async () => {
  reset(); page("https://someone.github.io", false);
  conn.save({ serverUrl: "http://planner-pc.example:8787/", token: "t" });
  assert.equal(api.base(), "http://planner-pc.example:8787");
  assert.equal(await api.ready(), true);
  assert.equal(calls[0].url, "http://planner-pc.example:8787/api/health");
  assert.equal(calls[0].init.headers["X-Planner-Token"], "t");
  assert.equal(api.url("/api/plan"), "http://planner-pc.example:8787/api/plan");
  reset();
  assert.equal(api.base(), "", "cleared again: back to no PC");
});

test("a file or a copy with no server: no PC; no document at all does not throw", () => {
  reset();
  globalThis.location = { protocol: "file:", origin: "null" };
  globalThis.document = { querySelector: () => ({}) };
  assert.equal(api.base(), "", "a file is never the PC");
  globalThis.location = { protocol: "https:", origin: "https://x.github.io" };
  delete globalThis.document;
  assert.equal(pageFromPc(), false);
  assert.equal(api.base(), "");
});

// ---- 2026-11-11 review round 1 (findings M-3/B-5): the two pages that asked the PC by themselves
/** A pretend UI kit that only records what a page drew, and a page to draw into. */
function pretendUi() {
  const node = (tag, text = "") => ({ tag, text, kids: [], isConnected: true, append(...c) { this.kids.push(...c.filter(Boolean)); }, replaceChildren() { this.kids = []; }, remove() { } });
  const flat = (c) => c.flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false);
  const h = (tag, _attrs, ...kids) => { const n = node(tag); for (const k of flat(kids)) n.kids.push(typeof k === "string" ? node("#text", k) : k); return n; };
  const ui = { h, notice: (kind, text) => node(`notice-${kind}`, text), card: (title, ...kids) => { const n = h("section", {}, ...kids); n.text = title; return n; }, row: (...kids) => h("div", {}, ...kids), button: (label) => node("button", label) };
  const words = (n) => [n.text, ...(n.kids ?? []).flatMap(words)].filter(Boolean);
  return { ui, page: node("main"), words };
}

test("System > Earlier copies and What changed, on the static site with no PC set, also in the sandbox: nothing is asked, and the page says it is not connected", async () => {
  const asked = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (u) => { asked.push(String(u)); return Promise.reject(new TypeError("no network in this test")); };
  try {
    for (const [id, sandbox] of [["backups", true], ["audit", true], ["backups", false], ["audit", false]]) {
      const view = await import(`../modules/system/${id}/view.js`);
      const { ui, page, words } = pretendUi();
      const store = { sandbox: () => sandbox, backend: () => "local", get: () => ({}) };
      const done = view.render(page, { ui, plan: {}, store, api: { base: () => "", headers: () => ({}) }, fmt: {}, modules: [] });
      await new Promise((r) => setTimeout(r, 20));
      assert.deepEqual(asked, [], `system/${id}${sandbox ? " in the sandbox" : ""}: no request (it asked the site's own /api/plan/backups)`);
      const said = words(page).join(" | ");
      assert.match(said, /Not connected to your computer/, `system/${id}${sandbox ? " in the sandbox" : ""}`);
      assert.doesNotMatch(said, /did not send/, "no red notice about a PC that was never set up");
      if (typeof done === "function") done();
    }
  } finally { globalThis.fetch = realFetch; }
});

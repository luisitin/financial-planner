// tests/sw-copy.test.mjs -- sw.js's saved whole copy (docs/PLAN.md "On a static host", "The saved whole copy"): a weak or
// stalled connection opens the app from the last whole set of files, never from a mix of two versions. The worker runs in a
// Node vm with a pretend site, a pretend Cache Storage and the clock; qa/flows/static-stall.mjs proves it in Chromium.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = fs.readFileSync(path.join(REPO, "sw.js"), "utf8");
const ORIGIN = "https://someone.github.io", HOME = `${ORIGIN}/financial-planner/`;
const hoursAgo = (h) => new Date(Date.now() - h * 3600e3).toUTCString();

/** A Cache Storage that keeps bodies as text (what a real one does, minus the disk). */
function fakeCaches() {
  const all = new Map();
  const cacheOf = (name) => {
    if (!all.has(name)) all.set(name, new Map());
    const m = all.get(name);
    const key = (k) => String(k.url ?? k);
    return {
      async match(k) { const e = m.get(key(k)); return e ? new Response(e.body, { status: e.status, headers: e.headers }) : undefined; },
      async put(k, res) { m.set(key(k), { body: await res.text(), status: res.status, headers: [...res.headers.entries()] }); },
      async keys() { return [...m.keys()]; },
      async delete(k) { return m.delete(key(k)); },
    };
  };
  return { all, open: async (n) => cacheOf(n), keys: async () => [...all.keys()], delete: async (n) => all.delete(n), has: async (n) => all.has(n) };
}

/** A pretend GitHub Pages: every file of a deploy has the same Last-Modified. `mode`: ok | stall | down. */
function pretendSite(files, stamp = hoursAgo(2)) {
  const site = { files, stamp, mode: "ok", calls: [], aborted: 0 };
  site.net = (input, init = {}) => {
    const url = typeof input === "string" ? input : input.url;
    site.calls.push({ url: url.replace(HOME, ""), cache: init.cache });
    if (site.mode === "down") return Promise.reject(new TypeError("Failed to fetch"));
    if (site.holdNext && url === HOME) { site.holdNext = false; return new Promise((ok) => { site.release = () => ok(site.net(input, init)); }); }   // this one answers when released
    if (site.mode === "stall") return new Promise((_, no) => init.signal?.addEventListener("abort", () => { site.aborted++; no(Object.assign(new Error("aborted"), { name: "AbortError" })); }));
    const rel = url.replace(HOME, "").replace(/[?#].*$/, "") || "index.html";
    const body = site.files[rel === "" ? "index.html" : rel];
    if (body === undefined) return Promise.resolve(new Response("not found", { status: 404, headers: { "Last-Modified": site.stamp } }));
    return Promise.resolve(new Response(body, { status: 200, headers: { "Last-Modified": site.stamp, "Content-Type": rel.endsWith(".js") ? "application/javascript" : "text/html", "Cache-Control": "max-age=600", "Content-Encoding": "gzip" } }));
  };
  return site;
}
const REGISTRY = 'export default [\n { group: "a", id: "b", load: () => import("./a/b/module.js") },\n { group: "c", id: "d", load: () => import("./c/d/module.js") },\n];\n';
const appFiles = (v) => ({ "index.html": `<html>${v}</html>`, "core/app.js": `app ${v}`, "core/format.js": `format ${v}`, "modules/registry.js": `${REGISTRY}// ${v}`, "modules/a/b/module.js": `ab ${v}`, "modules/c/d/module.js": `cd ${v}`, "docs/note.md": `note ${v}` });
const FILES = Object.keys(appFiles("x")).filter((f) => f !== "index.html");

function load(site, caches = fakeCaches(), { probe = 60, origin = ORIGIN } = {}, pages = []) {
  const listeners = {};
  const gone = new Set();             // pages the browser no longer has (clients.get resolves undefined); every other id is a live page
  const self = { location: { origin, href: `${HOME.replace(ORIGIN, origin)}sw.js` }, addEventListener: (t, f) => { listeners[t] = f; }, skipWaiting: () => Promise.resolve(), clients: { matchAll: async () => pages, get: async (id) => (gone.has(id) ? undefined : { id }) }, registration: {} };
  const ctx = vm.createContext({ self, fetch: site.net, URL, Response, Headers, Promise, console, caches, AbortController, setTimeout, clearTimeout, Date, Set, Map, Math });
  vm.runInContext(SRC, ctx, { filename: "sw.js" });
  ctx.PROBE_MS = probe; ctx.MISS_MS = probe; ctx.MIN_FILES = 3;     // a pretend site is small and answers at once or never
  return { ctx, listeners, caches, site, gone };
}
const req = (url, more = {}) => ({ method: "GET", url, mode: "cors", cache: "default", ...more });
async function dispatch(sw, request, ids = {}) {
  let answer = null;
  sw.listeners.fetch({ request, clientId: ids.clientId ?? "", resultingClientId: ids.resultingClientId ?? "", respondWith: (p) => { answer = p; } });
  return answer ? await answer : "not answered";
}
const open = (sw, id, url = HOME) => dispatch(sw, req(url, { mode: "navigate" }), { resultingClientId: id });
const file = (sw, id, rel) => dispatch(sw, req(`${HOME}${rel}`), { clientId: id });
/** The page drew without a problem (core/heal.js announceOpened): the message the page sends the worker. */
async function opened(sw, id) {
  let waited = Promise.resolve();
  sw.listeners.message({ data: { type: "opened" }, source: { id }, waitUntil: (p) => { waited = p; } });
  await waited;
}
/** A whole open from the site: the page and every file, then the message. Returns the texts the page got. */
async function wholeOpen(sw, id) {
  const got = { page: await (await open(sw, id)).text() };
  for (const f of FILES) got[f] = await (await file(sw, id, f)).text();
  await opened(sw, id);
  return got;
}
const current = async (sw) => { const r = await (await sw.caches.open("planner-current-1")).match("current"); return r ? r.json() : null; };
const sets = (sw) => [...sw.caches.all.keys()].filter((n) => n.startsWith("planner-set-1-"));

test("the first controlled open comes from the site and, once the page says it drew, becomes the saved whole copy", async () => {
  const site = pretendSite(appFiles("A")), sw = load(site);
  assert.equal(await current(sw), null, "nothing saved yet");
  const got = await wholeOpen(sw, "p1");
  assert.equal(got.page, "<html>A</html>");
  assert.equal(got["core/app.js"], "app A");
  const cur = await current(sw);
  assert.equal(cur.stamp, site.stamp);
  assert.equal(cur.n, 1 + FILES.length, "the page and every file the page was given");
  assert.deepEqual(sets(sw), [cur.name], "one saved copy");
  const copy = await sw.caches.open(cur.name);
  assert.equal(await (await copy.match(HOME)).text(), "<html>A</html>", "the page is saved under the app's folder");
  const f = await copy.match(`${HOME}core/app.js`);
  assert.equal(f.headers.get("cache-control"), "no-cache", "what is saved is what the page was given (no in-memory reuse)");
  assert.equal(f.headers.get("content-encoding"), null, "decoded already");
});

test("the next open, the site unchanged: one request (the page), everything else from the saved copy, whole", async () => {
  const site = pretendSite(appFiles("A")), sw = load(site);
  await wholeOpen(sw, "p1");
  site.calls.length = 0;
  const got = {};
  got.page = await (await open(sw, "p2", `${HOME}?sandbox=1`)).text();
  for (const f of FILES) got[f] = await (await file(sw, "p2", f)).text();
  assert.equal(got.page, "<html>A</html>");
  assert.equal(got["modules/c/d/module.js"], "cd A");
  assert.deepEqual(site.calls.map((c) => c.url), ["?sandbox=1"], "one request for the whole open: the 566 revalidations are gone");
  assert.equal(site.calls[0].cache, "no-cache", "that one asks the site, not the browser's copy");
});

test("a stalled site: the page opens from the saved copy after the wait, and so does every file (nothing is asked of the site)", async () => {
  const site = pretendSite(appFiles("A")), sw = load(site);
  await wholeOpen(sw, "p1");
  site.mode = "stall"; site.calls.length = 0;
  const t0 = Date.now();
  const page = await (await open(sw, "p2")).text();
  assert.equal(page, "<html>A</html>");
  assert.ok(Date.now() - t0 >= 50 && Date.now() - t0 < 1500, "after the wait, not before and not never");
  assert.equal(site.aborted, 1, "the stalled request is given up");
  for (const f of FILES) assert.equal(await (await file(sw, "p2", f)).text(), appFiles("A")[f], f);
  assert.deepEqual(site.calls.map((c) => c.url), [""], "only the page was asked; no file waited on the stalled site");
});

test("no network at all: the same, at once", async () => {
  const site = pretendSite(appFiles("A")), sw = load(site);
  await wholeOpen(sw, "p1");
  site.mode = "down";
  assert.equal(await (await open(sw, "p2")).text(), "<html>A</html>");
  assert.equal(await (await file(sw, "p2", "core/app.js")).text(), "app A");
});

test("a new deploy: the open comes from the site whole (never a file from the old copy), then it becomes the saved copy", async () => {
  const site = pretendSite(appFiles("A"), hoursAgo(5)), sw = load(site);
  await wholeOpen(sw, "p1");
  const oldCopy = (await current(sw)).name;
  Object.assign(site, { files: appFiles("B"), stamp: hoursAgo(1) });
  const got = await wholeOpen(sw, "p2");
  assert.equal(got.page, "<html>B</html>");
  for (const f of FILES) assert.match(got[f], / B$/, f + " is the new version");
  const cur = await current(sw);
  assert.notEqual(cur.name, oldCopy);
  assert.equal(cur.stamp, site.stamp);
  assert.deepEqual(sets(sw), [cur.name], "the old copy is gone once the new one is saved");
  site.mode = "stall";
  assert.equal(await (await open(sw, "p3")).text(), "<html>B</html>", "and the stalled open shows the new version whole");
  assert.equal(await (await file(sw, "p3", "core/app.js")).text(), "app B");
});

test("a page opened from the old copy keeps getting files from it, though a newer copy is saved meanwhile (never old next to new)", async () => {
  const site = pretendSite(appFiles("A"), hoursAgo(5)), sw = load(site);
  await wholeOpen(sw, "p1");
  site.mode = "stall";
  assert.equal(await (await open(sw, "old-tab")).text(), "<html>A</html>");
  site.mode = "ok"; Object.assign(site, { files: appFiles("B"), stamp: hoursAgo(1) });
  await wholeOpen(sw, "new-tab");                      // another tab saves version B (the old copy is not deleted: old-tab is pinned to it)
  assert.equal(await (await file(sw, "old-tab", "core/app.js")).text(), "app A");
  assert.equal(await (await file(sw, "old-tab", "core/format.js")).text(), "format A");
});

test("a worker restarted in the middle of an open: the page's files still come from its copy (the pin is kept in Cache Storage)", async () => {
  const site = pretendSite(appFiles("A")), sw = load(site);
  await wholeOpen(sw, "p1");
  site.mode = "stall";
  await open(sw, "p2");
  const again = load(site, sw.caches);                 // the browser stopped the worker and started it again: nothing in memory
  site.calls.length = 0;
  assert.equal(await (await file(again, "p2", "core/app.js")).text(), "app A", "from the pin, not from the site");
  assert.equal(site.calls.length, 0);
});

test("a deploy landing during an open: two stamps in one open is no whole copy, so nothing is saved", async () => {
  const site = pretendSite(appFiles("A")), sw = load(site);
  await open(sw, "p1");
  await file(sw, "p1", "core/app.js");
  site.stamp = hoursAgo(0.5);                          // the site switches to the new deploy between two files
  await file(sw, "p1", "core/format.js");
  for (const f of FILES.slice(2)) await file(sw, "p1", f);
  await opened(sw, "p1");
  assert.equal(await current(sw), null, "not saved");
  assert.deepEqual(sets(sw), [], "and nothing left behind");
});

test("a deploy landing right after the page drew: asked once more before it is saved", async () => {
  const site = pretendSite(appFiles("A")), sw = load(site);
  await open(sw, "p1");
  for (const f of FILES) await file(sw, "p1", f);
  site.stamp = hoursAgo(0.1);                          // new deploy before the page's message arrives
  await opened(sw, "p1");
  assert.equal(await current(sw), null);
});

test("a copy that lacks a module the registry names is never saved (nothing could open a missing page from it)", async () => {
  const site = pretendSite(appFiles("A")), sw = load(site);
  await open(sw, "p1");
  for (const f of FILES.filter((f) => f !== "modules/c/d/module.js")) await file(sw, "p1", f);
  await opened(sw, "p1");
  assert.equal(await current(sw), null);
  const small = load(pretendSite(appFiles("A")));
  small.ctx.MIN_FILES = 50;
  await wholeOpen(small, "p1");
  assert.equal(await current(small), null, "far fewer files than an open of this app loads");
});

test("a file the saved copy lacks, for a page that came from it: from the same deploy it is taken, from another it is refused (code) or passed (data)", async () => {
  const site = pretendSite({ ...appFiles("A"), "docs/more.md": "more A", "core/extra.js": "extra A" }), sw = load(site);
  await wholeOpen(sw, "p1");
  site.mode = "stall";
  await open(sw, "tab");
  site.mode = "ok";
  assert.equal(await (await file(sw, "tab", "core/extra.js")).text(), "extra A", "same deploy: it belongs to the copy");
  const cur = await current(sw);
  assert.ok((await (await sw.caches.open(cur.name)).keys()).includes(`${HOME}core/extra.js`), "and is added to it");
  Object.assign(site, { files: { ...appFiles("B"), "core/more.js": "more B", "docs/more.md": "more B" }, stamp: hoursAgo(0.2) });
  const refused = await file(sw, "tab", "core/more.js");
  assert.equal(refused.status, 404, "new code never runs under the old page");
  assert.equal(await (await file(sw, "tab", "docs/more.md")).text(), "more B", "a data file (a note) is passed as it is");
  site.mode = "stall";
  await assert.rejects(file(sw, "tab", "docs/other.md"), /aborted/, "a file nobody has, with the site stalled: an honest failure after the wait");
});

test("trusted for 24 hours, then every file is checked again; a stamp that is no recent deploy time is never trusted", async () => {
  const site = pretendSite(appFiles("A")), sw = load(site);
  await wholeOpen(sw, "p1");
  const cur = await current(sw);
  await (await sw.caches.open("planner-current-1")).put("current", new Response(JSON.stringify({ ...cur, at: Date.now() - 25 * 3600e3 })));
  site.calls.length = 0;
  await open(sw, "p2");
  await file(sw, "p2", "core/app.js");
  assert.deepEqual(site.calls.map((c) => c.url), ["", "core/app.js"], "a day later the open is checked against the site again");
  // a host that sends the same old date for every file (or none) proves nothing about a deploy
  const fixed = pretendSite(appFiles("A"), "Mon, 01 Jan 1990 00:00:00 GMT"), s2 = load(fixed);
  await wholeOpen(s2, "p1");
  assert.equal(await current(s2), null, "never saved, so never served stale");
  const none = pretendSite(appFiles("A")); const orig = none.net;
  none.net = (...a) => orig(...a).then((r) => { const h = new Headers(r.headers); h.delete("Last-Modified"); return new Response(r.body, { status: r.status, headers: h }); });
  const s3 = load(none);
  await wholeOpen(s3, "p1");
  assert.equal(await current(s3), null);
});

test("what it does not touch: no client id, another page, the PC's /api/, no Cache Storage", async () => {
  const site = pretendSite(appFiles("A")), sw = load(site);
  await wholeOpen(sw, "p1");
  site.mode = "stall"; site.calls.length = 0;
  // an older Safari gives no resultingClientId: the page is asked of the site as before (no saved copy for a page the worker cannot follow)
  const t0 = Date.now(); site.mode = "ok";
  assert.equal(await (await dispatch(sw, req(HOME, { mode: "navigate" }), {})).text(), "<html>A</html>");
  assert.equal(site.calls[0].url, "");
  // a navigation to something else than the app's page
  assert.equal(await (await open(sw, "x1", `${HOME}docs/guide.html`)).status, 404);
  assert.equal(await dispatch(sw, req(`${ORIGIN}/api/plan`)), "not answered");
  // without Cache Storage it is the worker of the day before
  const bare = load(pretendSite(appFiles("A")), undefined);
  bare.ctx.caches = undefined;
  assert.equal(await (await open(bare, "p1")).text(), "<html>A</html>");
  assert.equal(await current(sw) !== null, true);
  assert.ok(Date.now() - t0 < 1000);
});

test("tidying: a copy being taken when the worker stopped is deleted at the next start, a copy a page still uses is kept", async () => {
  const site = pretendSite(appFiles("A")), sw = load(site);
  await wholeOpen(sw, "p1");
  const keep = (await current(sw)).name;
  await sw.caches.open("planner-set-1-orphan");
  await sw.caches.open("someone-elses-cache");
  const again = load(site, sw.caches);
  await file(again, "x", "core/app.js");                // any request starts the worker's tidy-up
  assert.ok(!sets(again).includes("planner-set-1-orphan"), "the orphan is gone");
  assert.ok(sets(again).includes(keep), "the saved copy is kept");
  assert.ok(sw.caches.all.has("someone-elses-cache"), "another cache is none of its business");
});

test("the page tells the worker it drew only when nothing is wrong on screen (core/heal.js announceOpened)", async () => {
  const { announceOpened } = await import("../core/heal.js");
  const posted = [];
  const nav = (on) => ({ serviceWorker: on ? { controller: { postMessage: (m) => posted.push(m) } } : {} });
  const doc = (broken) => ({ querySelector: () => broken });
  let timers = [];
  const later = (fn) => timers.push(fn);
  assert.equal(announceOpened({ nav: nav(false), doc: doc(null), later }), false, "no worker controlling this page (PC, first open, a file): nothing");
  assert.equal(announceOpened({ nav: nav(true), doc: doc(null), later }), true);
  assert.deepEqual(posted, [{ type: "running" }], "at once: this version's code has started (the worker then never opens an older one)");
  timers.shift()();
  assert.deepEqual(posted, [{ type: "running" }, { type: "opened" }]);
  announceOpened({ nav: nav(true), doc: doc({}), later });   // a red notice or the opening screen is still showing
  timers.shift()();
  assert.deepEqual(posted.map((m) => m.type), ["running", "opened", "running"], "nothing is said about an open that did not draw, but its code did start");
  assert.equal(announceOpened({ nav: { get serviceWorker() { throw new Error("SecurityError"); } }, doc: doc(null), later }), false, "a sandboxed frame");
  const app = fs.readFileSync(path.join(REPO, "core", "app.js"), "utf8");
  assert.match(app, /boot\(\)\.then\(\(\) => \{ announceOpened\(\); mendBlockedForms\(\); \}\)/);
});

test("opens that never say they drew leave no copy behind for ever: at most a few dozen are kept, older ones are deleted", async () => {
  const site = pretendSite(appFiles("A")), sw = load(site);
  for (let i = 0; i < 90; i++) await open(sw, `tab-${i}`);      // 90 opens, each starts a copy; none sends its message
  await new Promise((ok) => setTimeout(ok, 20));
  assert.ok(sets(sw).length <= sw.ctx.KEEP, `${sets(sw).length} copies in progress (limit ${sw.ctx.KEEP})`);
  assert.equal(await current(sw), null, "and none was saved");
  // the same page opened again replaces its own unfinished copy
  const before = sets(sw).length;
  await open(sw, "tab-89");
  await new Promise((ok) => setTimeout(ok, 20));
  assert.equal(sets(sw).length, before);
});

// ---- 2026-11-11 review round 1 (findings M-1/B-1, M-4/B-4, M-6, B-7)
/** The page says its code has started (core/heal.js announceOpened sends it at once). */
async function runningMsg(sw, id) {
  let waited = Promise.resolve();
  sw.listeners.message({ data: { type: "running" }, source: { id }, waitUntil: (p) => { waited = p; } });
  await waited;
}

test("the record outlives its files (evicted, or deleted by another tab), the site unchanged: the page still opens, from the site, and the record is forgotten", async () => {
  for (const what of ["the whole set", "only the set's page"]) {
    const site = pretendSite(appFiles("A")), sw = load(site);
    await wholeOpen(sw, "p1");
    const cur = await current(sw);
    if (what === "the whole set") sw.caches.all.delete(cur.name);
    else await (await sw.caches.open(cur.name)).delete(HOME);
    const res = await open(sw, "p2");
    assert.equal(res.status, 200, what);
    assert.equal(await res.text(), "<html>A</html>", `${what}: the page the browser gets can be read (not a cancelled answer)`);
    assert.equal(await (await file(sw, "p2", "core/app.js")).text(), "app A");
    for (const f of FILES) await file(sw, "p2", f);
    await opened(sw, "p2");
    const next = await current(sw);
    assert.ok(next && next.name !== cur.name, `${what}: this open is saved as the new copy`);
    assert.ok(sets(sw).includes(next.name), "and its files exist");
  }
  // the same with the site silent: no copy to open, so the record is forgotten and the browser's own copy is asked
  const site = pretendSite(appFiles("A")), sw = load(site);
  await wholeOpen(sw, "p1");
  sw.caches.all.delete((await current(sw)).name);
  site.mode = "down";
  await assert.rejects(open(sw, "p2"), /Failed to fetch/, "the same error as without a worker");
  assert.equal(await current(sw), null, "the record that named missing files is gone");
});

test("two tabs opened together: both say they drew, and the saved record names a copy that exists", async () => {
  for (const lag of [0, 5]) {
    const site = pretendSite(appFiles("A")), sw = load(site);
    const net = site.net;
    sw.ctx.fetch = (...a) => new Promise((ok) => setTimeout(ok, lag)).then(() => net(...a));
    await Promise.all(["t1", "t2"].map(async (id) => { await open(sw, id); for (const f of FILES) await file(sw, id, f); }));
    await Promise.all([opened(sw, "t1"), opened(sw, "t2")]);
    const cur = await current(sw);
    assert.ok(cur, `lag ${lag}: a copy is saved`);
    assert.deepEqual(sets(sw), [cur.name], `lag ${lag}: exactly the copy the record names is kept`);
    assert.equal(await (await (await sw.caches.open(cur.name)).match(HOME)).text(), "<html>A</html>");
    site.calls.length = 0;
    assert.equal(await (await open(sw, "t3")).text(), "<html>A</html>", "and the next open works");
  }
});

test("tidying deletes nothing when the record cannot be read (it may name the copy in use)", async () => {
  const site = pretendSite(appFiles("A")), caches = fakeCaches(), sw = load(site, caches);
  await wholeOpen(sw, "p1");
  const keep = (await current(sw)).name;
  await (await caches.open("planner-pins-1")).keys();
  const realOpen = caches.open;
  let failing = true;
  caches.open = async (n) => { if (failing && n === "planner-current-1") throw new Error("QuotaExceededError"); return realOpen(n); };
  const again = load(site, caches);
  await file(again, "x", "core/app.js");                // starts the worker's tidy-up while the record is unreadable
  failing = false;
  assert.ok(sets(again).includes(keep), "the saved copy is still there");
  assert.equal((await current(again)).name, keep);
});

test("never back a version: once a newer deploy's code has started, the older saved copy is forgotten, even when the new one is never saved", async () => {
  const site = pretendSite(appFiles("A")), sw = load(site);
  await wholeOpen(sw, "p1");
  const a = await current(sw);
  site.files = appFiles("B"); site.stamp = hoursAgo(1);
  assert.equal(await (await open(sw, "p2")).text(), "<html>B</html>");
  assert.equal((await current(sw)).name, a.name, "the page alone proves nothing: B has not run yet (a stall now still opens A whole)");
  await file(sw, "p2", "core/app.js");
  await runningMsg(sw, "p2");                            // B's code has started; the app is closed before it says it drew
  assert.equal(await current(sw), null, "A is no longer the saved copy");
  site.mode = "down";
  await assert.rejects(open(sw, "p3"), /Failed to fetch/, "a later open without the site is not answered with A");
  // a page from the saved copy, or the same deploy checked again, forgets nothing
  const site2 = pretendSite(appFiles("A")), sw2 = load(site2);
  await wholeOpen(sw2, "p1");
  await open(sw2, "p2"); await runningMsg(sw2, "p2");
  assert.ok(await current(sw2), "a page from the copy");
  await runningMsg(sw2, "nobody");
  assert.ok(await current(sw2), "a page this worker did not open");
});

test("the copy is kept only where one stamp per deploy is verified (GitHub Pages, the test harness), and has an off switch", async () => {
  const other = "https://planner.example", site = pretendSite(appFiles("A"));
  const net = site.net; site.net = (input, init) => net(typeof input === "string" ? input.replace(other, ORIGIN) : { ...input, url: input.url.replace(other, ORIGIN) }, init);
  const sw = load(site, fakeCaches(), { origin: other });
  const home = HOME.replace(ORIGIN, other);
  for (let round = 0; round < 2; round++) {
    await dispatch(sw, req(home, { mode: "navigate" }), { resultingClientId: `p${round}` });
    for (const f of FILES) await dispatch(sw, req(`${home}${f}`), { clientId: `p${round}` });
    await opened(sw, `p${round}`);
  }
  assert.equal(sw.caches.all.size, 0, "another host: nothing is saved (a fixed Last-Modified there would make two deploys look like one)");
  assert.equal(site.calls.length, 2 * (1 + FILES.length), "every file is asked of the site on every open, as before");
  for (const h of ["https://someone.github.io", "http://127.0.0.1:9440", "http://localhost:8787"]) {
    assert.equal(load(pretendSite({}), fakeCaches(), { origin: h }).ctx.copyHost(), true, h);
  }
  assert.equal(load(pretendSite({}), fakeCaches(), { origin: "https://github.io.example" }).ctx.copyHost(), false);
  const off = load(pretendSite(appFiles("A")));
  off.ctx.COPY_ON = false;
  await wholeOpen(off, "p1"); await wholeOpen(off, "p2");
  assert.equal(off.caches.all.size, 0, "COPY_ON = false: no copy, no record");
});

test("a browser whose page id is not the id its files arrive under never gets a saved copy (so it works as before the copy existed)", async () => {
  const site = pretendSite(appFiles("A")), sw = load(site);
  for (let round = 0; round < 3; round++) {
    await open(sw, `nav-${round}`);
    for (const f of FILES) await file(sw, `page-${round}`, f);     // the files come under another id than the navigation named
    await opened(sw, `page-${round}`);
  }
  assert.equal(await current(sw), null);
  assert.equal(site.calls.length, 3 * (1 + FILES.length), "every open asks the site for every file");
});

// ---- 2026-11-11 final check (findings F-1, F-2)
const flagged = async (sw) => !!(await (await sw.caches.open("planner-current-1")).match("ids"));
/** A saved copy of A, then the site moves to B. Returns the worker and the site. */
async function savedAThenB() {
  const site = pretendSite(appFiles("A"), hoursAgo(5)), sw = load(site);
  await wholeOpen(sw, "p1");
  assert.ok(await current(sw), "A is saved");
  return { site, sw, toB: () => Object.assign(site, { files: { ...appFiles("B"), "core/new.js": "new B" }, stamp: hoursAgo(1), mode: "ok" }) };
}
/** An open from the saved copy: the site is silent while the page is asked for. */
async function openFromCopy(sw, site, id) {
  const was = site.mode; site.mode = "stall";
  const page = await (await open(sw, id)).text();
  site.mode = was;
  return page;
}

test("F-2: opens closed before they say they drew do not pile up: at most 3 copies are in progress, and one whose page is gone is deleted at the next open", async () => {
  const site = pretendSite(appFiles("A")), sw = load(site);
  for (let i = 0; i < 6; i++) { await open(sw, `quick-${i}`); await file(sw, `quick-${i}`, "core/app.js"); }
  await new Promise((ok) => setTimeout(ok, 20));
  assert.ok(sets(sw).length <= 3, `${sets(sw).length} copies in progress after 6 quick opens (limit 3)`);
  // the browser says which pages still exist: a copy whose page is gone goes at the next open, however few there are
  const s2 = pretendSite(appFiles("A")), w2 = load(s2), alive = new Set();
  w2.ctx.self.clients.get = async (id) => (alive.has(id) ? { id } : undefined);
  alive.add("a"); await open(w2, "a");
  alive.delete("a"); alive.add("b"); await open(w2, "b");
  await new Promise((ok) => setTimeout(ok, 20));
  assert.equal(sets(w2).length, 1, "the closed page's copy is gone, the open page's is kept");
  for (const f of FILES) await file(w2, "b", f);
  await opened(w2, "b");
  assert.ok(await current(w2), "and the open page's copy is still saved when it draws");
  // two tabs open at once (both alive) are both kept, and a copy being saved is never deleted under it
  const s3 = pretendSite(appFiles("A")), w3 = load(s3);
  w3.ctx.self.clients.get = async () => undefined;      // every page reads as gone
  await open(w3, "t1"); for (const f of FILES) await file(w3, "t1", f);
  const saving = opened(w3, "t1");
  await open(w3, "t2");
  await saving;
  const cur = await current(w3);
  assert.ok(cur && sets(w3).includes(cur.name), "the record names files that exist");
});

test("F-1: a page from the saved copy whose files arrive under an id the worker does not know never gets code from the site (a mix); the copy is forgotten", async () => {
  const { site, sw, toB } = await savedAThenB();
  assert.equal(await openFromCopy(sw, site, "nav-2"), "<html>A</html>", "the old shell, from the copy");
  toB();
  const res = await file(sw, "page-2", "core/app.js");           // not the id the navigation announced
  assert.equal(res.status, 404, "never B's code under A's shell");
  assert.notEqual(await res.text(), "app B");
  assert.equal((await file(sw, "page-2", "core/new.js")).status, 404, "nor a file only B has");
  assert.equal((await file(sw, "page-2", "core/ui/base.css")).status, 404, "nor its styles");
  assert.equal(await (await file(sw, "page-2", "docs/note.md")).text(), "note B", "a data file passes, as for any page from the copy");
  assert.equal(await current(sw), null, "the saved copy is forgotten");
  assert.equal(await flagged(sw), true, "and this browser is marked: one open was refused");
  // the page's one reload (core/heal.js) replaces it, comes from the site, whole, and works as before the copy existed
  sw.gone.add("nav-2"); sw.ctx.CLAIM_MS = 0;
  assert.equal(await (await open(sw, "nav-3")).text(), "<html>B</html>");
  for (const f of FILES) assert.match(await (await file(sw, "page-3", f)).text(), / B$/, f);
  await opened(sw, "page-3");
  // the page that was refused stays refused for as long as it lives, also after the worker restarts
  assert.equal((await file(sw, "page-2", "modules/a/b/module.js")).status, 404, "a page of the old shell opened later");
  const again = load(site, sw.caches); again.gone.add("nav-2"); again.ctx.CLAIM_MS = 0;
  assert.equal((await file(again, "page-2", "modules/c/d/module.js")).status, 404, "after a restart too");
  assert.match(await (await file(again, "page-3", "core/format.js")).text(), / B$/, "the reloaded page is still served by the site");
  // one refusal is not proof that ids never match here (R3-3: it takes two opens): an open whose ids match is kept again
  await wholeOpen(again, "p8");
  assert.equal((await current(again))?.stamp, site.stamp);
});

test("F-1: the same when the files arrive with no id at all; the next open works", async () => {
  const { site, sw, toB } = await savedAThenB();
  await openFromCopy(sw, site, "nav-2");
  toB();
  await open(sw, "other-tab");                                     // another tab, from the site, whose ids do match: it is being saved
  for (const f of FILES) assert.match(await (await file(sw, "other-tab", f)).text(), / B$/);
  assert.equal((await dispatch(sw, req(`${HOME}core/app.js`), {})).status, 404, "no id: not B under A's shell");
  assert.equal((await dispatch(sw, req(`${HOME}core/format.js`), {})).status, 404, "every code file of that open, not only the first");
  assert.equal(await current(sw), null);
  await opened(sw, "other-tab");
  assert.equal((await current(sw))?.stamp, site.stamp, "the other tab's open (its files under its own id) is whole and kept: one refusal is not proof");
  sw.gone.add("nav-2"); sw.ctx.CLAIM_MS = 0;                      // the refused page is replaced by its reload
  assert.equal(await (await open(sw, "nav-3")).text(), "<html>B</html>", "the reload opens B (from the other tab's copy)");
  assert.equal(await (await file(sw, "nav-3", "core/app.js")).text(), "app B", "and its files too");
  sw.gone.add("nav-3");
  assert.equal(await (await dispatch(sw, req(`${HOME}core/app.js`), {})).text(), "app B", "no id, no page from a copy alive: the site");
});

test("F-1: two tabs at once, one from the copy and one from the site: each gets its own version whole, and nothing is given up", async () => {
  const { site, sw, toB } = await savedAThenB();
  await openFromCopy(sw, site, "old-tab");                        // A's shell; its files have not been asked for yet
  toB();
  assert.equal(await (await open(sw, "new-tab")).text(), "<html>B</html>");
  assert.equal(await (await file(sw, "new-tab", "core/app.js")).text(), "app B", "the tab from the site is served by the site while the other tab's files are still to come");
  assert.equal(await (await file(sw, "old-tab", "core/app.js")).text(), "app A");
  assert.equal(await (await file(sw, "new-tab", "core/format.js")).text(), "format B");
  assert.equal(await (await file(sw, "old-tab", "core/format.js")).text(), "format A");
  assert.equal(await flagged(sw), false, "ids matched: nothing is given up");
  for (const f of FILES) await file(sw, "new-tab", f);
  await opened(sw, "new-tab");
  assert.equal((await current(sw)).stamp, site.stamp, "and the new version becomes the saved copy");
});

test("F-1: a worker restarted between the two tabs' pages and their files: the tab from the site is still served by the site, the tab from the copy by the copy", async () => {
  const { site, sw, toB } = await savedAThenB();
  await openFromCopy(sw, site, "old-tab");
  toB();
  await open(sw, "new-tab");
  await new Promise((ok) => setTimeout(ok, 10));
  const again = load(site, sw.caches);                            // nothing in memory
  assert.equal(await (await file(again, "new-tab", "core/app.js")).text(), "app B", "not refused: the worker wrote down that it opened this page from the site");
  assert.equal(await (await file(again, "old-tab", "core/app.js")).text(), "app A");
  assert.equal(await flagged(again), false);
  // once the tab from the copy has asked for a file under its own id, it holds the refusal while it lives (R3-1), also
  // after a restart; once it is gone, a page this worker never saw is served by the site, as before
  await new Promise((ok) => setTimeout(ok, 10));
  const third = load(site, sw.caches);
  third.gone.add("old-tab");
  assert.equal(await (await file(third, "someone-new", "core/app.js")).text(), "app B", "a page this worker never saw, no page from the copy alive: the site, as before");
  assert.equal(await flagged(third), false);
});

test("F-1: pages that came from the site are never refused: one opened under the previous worker, one whose navigation had no id, one opened while an open from the copy was never followed by a file", async () => {
  // the transition: a page opened under the previous sw.js keeps asking this one for files, under an id it never saw
  const { site, sw, toB } = await savedAThenB();
  assert.equal(await (await file(sw, "page-of-old-worker", "core/app.js")).text(), "app A", "the site, as before");
  await openFromCopy(sw, site, "left-open");                      // an open from the copy that never asks for a file (closed at once)
  toB();
  assert.equal(await (await file(sw, "page-of-old-worker", "core/format.js")).text(), "format B", "still the site (per file, as before this rule): the worker has met this page");
  assert.equal(await flagged(sw), false);
  assert.ok(await current(sw), "the saved copy stays");
  // a later open from the copy whose ids match is served by the copy although the earlier one was never claimed
  assert.equal(await openFromCopy(sw, site, "p5"), "<html>A</html>");
  assert.equal(await (await file(sw, "p5", "core/app.js")).text(), "app A");
  assert.equal(await flagged(sw), false);
  // pages that exist when the worker starts are known to it (the browser lists them), so one that asks for its first file
  // only after an open from the copy is still served by the site
  const s2 = pretendSite(appFiles("A"), hoursAgo(5)), w1 = load(s2);
  await wholeOpen(w1, "p1");
  const w2 = load(s2, w1.caches, {}, [{ id: "sleeping-tab" }]);
  await openFromCopy(w2, s2, "left-open");
  Object.assign(s2, { files: appFiles("B"), stamp: hoursAgo(1) });
  assert.equal(await (await file(w2, "sleeping-tab", "core/app.js")).text(), "app B");
  assert.equal(await flagged(w2), false);
  // a navigation without an id (an older Safari): from the site, files from the site, with or without a saved copy
  const s3 = pretendSite(appFiles("A")), w3 = load(s3);
  for (const withCopy of [false, true]) {
    if (withCopy) { await wholeOpen(w3, "p1"); assert.ok(await current(w3)); }
    assert.equal(await (await dispatch(w3, req(HOME, { mode: "navigate" }), {})).text(), "<html>A</html>");
    assert.equal(await (await file(w3, `no-nav-id-${withCopy}`, "core/app.js")).text(), "app A");
    assert.equal(await (await dispatch(w3, req(`${HOME}core/format.js`), {})).text(), "format A");
    assert.equal(await flagged(w3), false);
  }
});

test("F-1: the very first opens, and an open from the copy that claims its files, leave everything as it was", async () => {
  const site = pretendSite(appFiles("A")), sw = load(site);
  await wholeOpen(sw, "p1");
  site.calls.length = 0;
  assert.equal(await (await open(sw, "p2")).text(), "<html>A</html>");
  for (const f of FILES) assert.equal(await (await file(sw, "p2", f)).text(), appFiles("A")[f]);
  assert.equal(site.calls.length, 1, "one request, as before");
  sw.gone.add("p2");
  assert.equal(await (await file(sw, "a-stranger", "core/app.js")).text(), "app A", "p2 is closed: a page the worker does not know is served by the site");
  assert.equal(await flagged(sw), false);
  assert.ok(await current(sw));
});

// ---- 2026-11-11 final check, round 3 (findings R3-1 .. R3-4): the refusal lasts as long as a page from the copy lives
const tick = (ms = 0) => new Promise((ok) => setTimeout(ok, ms));
/** How many opens were refused in this browser (0: none; 2: ids do not match here, the copy is given up). */
const strikes = async (sw) => { const r = await (await sw.caches.open("planner-current-1")).match("ids"); return r ? ((await r.json()).strikes ?? 1) : 0; };

test("R3-1: a page from the copy that has had its first file still never gets code from the site under another id or none, for as long as it lives", async () => {
  const { site, sw, toB } = await savedAThenB();
  await openFromCopy(sw, site, "pg");
  toB();
  assert.equal(await (await file(sw, "pg", "core/app.js")).text(), "app A");
  const other = await file(sw, "pg-other-id", "modules/a/b/module.js");
  assert.equal(other.status, 404, `a page module under another id: never B's under A's app.js (got ${other.status} ${await other.clone().text()})`);
  const none = await dispatch(sw, req(`${HOME}modules/c/d/module.js`), {});
  assert.equal(none.status, 404, "nor with no id");
  assert.equal(await (await file(sw, "pg", "core/format.js")).text(), "format A", "under its own id: still its copy");
  assert.equal(await current(sw), null, "the saved copy is forgotten");
  const again = load(site, sw.caches);                            // a restarted worker reads the pin back
  assert.equal((await file(again, "pg-third-id", "core/app.js")).status, 404, "after a restart too");
  again.gone.add("pg");                                           // the page is closed or reloaded
  assert.equal(await (await file(again, "someone-new", "core/app.js")).text(), "app B", "then a page the worker never met is served by the site again");
  assert.equal(await (await dispatch(again, req(`${HOME}core/format.js`), {})).text(), "format B");
});

test("R3-2: two tabs from the copy whose files come under other ids: tab one's reload does not open tab two to the site's code", async () => {
  const { site, sw, toB } = await savedAThenB();
  await openFromCopy(sw, site, "nav-1"); await openFromCopy(sw, site, "nav-2");
  toB();
  assert.equal((await file(sw, "y1", "core/app.js")).status, 404, "tab one's first file: refused");
  sw.gone.add("nav-1");                                           // tab one is replaced by its reload
  assert.equal(await (await open(sw, "nav-1b")).text(), "<html>B</html>");
  const r2 = await file(sw, "y2", "core/app.js");
  assert.equal(r2.status, 404, `tab two still shows A's shell: never B's app.js (got ${r2.status})`);
  sw.ctx.CLAIM_MS = 0; sw.gone.add("nav-2");                      // tab two reloads too
  await open(sw, "nav-2b");
  assert.equal(await (await file(sw, "y2b", "core/app.js")).text(), "app B", "and once it has, the site");
});

test("R3-3: a page from the site is answered only once the worker has written down that it opened it (a restart right after still knows it)", async () => {
  const { site, sw, toB } = await savedAThenB();
  await openFromCopy(sw, site, "old-tab");
  toB();
  await open(sw, "new-tab");
  assert.ok(await (await sw.caches.open("planner-ids-1")).match("ok/new-tab"), "on disk before the page is answered");
  await open(sw, "other-page", `${HOME}docs/guide.html`);         // another page of the site (not the app's own): the same
  assert.ok(await (await sw.caches.open("planner-ids-1")).match("ok/other-page"), "another page of the site too");
  const again = load(site, sw.caches, {}, [{ id: "new-tab" }, { id: "old-tab" }]);
  assert.equal(await (await file(again, "new-tab", "core/app.js")).text(), "app B");
  assert.equal(await strikes(again), 0);
});

test("R3-3: an open from the copy never followed by a file stops counting a minute later once its page is gone (a tab closed during the wait)", async () => {
  const { site, sw, toB } = await savedAThenB();
  await openFromCopy(sw, site, "closed-at-once");
  toB();
  const young = load(site, sw.caches, {}, [{ id: "listed-window" }]);
  young.gone.add("closed-at-once");                               // a page still loading may not be found yet
  assert.equal((await file(young, "met-nowhere", "core/app.js")).status, 404, "within the minute: refused (it may be that page under another id)");
  assert.equal((await file(young, "listed-window", "core/app.js")).status, 404, "a window the browser lists at the restart is not taken for a page from the site while that open waits for its files");
  const s2 = await savedAThenB();
  await openFromCopy(s2.sw, s2.site, "closed-at-once");
  s2.toB();
  s2.sw.ctx.CLAIM_MS = 30; await tick(40);
  const again = load(s2.site, s2.sw.caches); again.ctx.CLAIM_MS = 30; again.gone.add("closed-at-once");
  assert.equal(await (await file(again, "mark-lost", "core/app.js")).text(), "app B", "a page whose mark was lost is served by the site");
  assert.equal(await strikes(again), 0);
  assert.ok(await current(again), "nothing is given up");
});

test("R3-3: one refusal does not switch the copy off for good: it takes two, on two different opens, and they are forgotten after 30 days", async () => {
  const { site, sw, toB } = await savedAThenB();
  await openFromCopy(sw, site, "nav-2"); toB();
  assert.equal((await file(sw, "x2", "core/app.js")).status, 404, "refused: never a mix");
  assert.equal((await dispatch(sw, req(`${HOME}core/format.js`), {})).status, 404, "the same open again: refused, and not a second strike");
  assert.equal(await strikes(sw), 1);
  assert.equal(await current(sw), null, "the copy that was in use is forgotten");
  sw.gone.add("nav-2"); sw.ctx.CLAIM_MS = 0;
  await wholeOpen(sw, "p3");
  assert.equal((await current(sw))?.stamp, site.stamp, "one refusal (a restart at the wrong moment): a copy is kept again");
  await openFromCopy(sw, site, "nav-4");
  Object.assign(site, { files: appFiles("C"), stamp: hoursAgo(0.5) });
  assert.equal((await file(sw, "x4", "core/app.js")).status, 404, "a second open refused");
  assert.equal(await strikes(sw), 2);
  sw.gone.add("nav-4");
  await wholeOpen(sw, "p5");
  assert.equal(await current(sw), null, "two: ids do not match here, no copy is kept");
  const again = load(site, sw.caches); again.ctx.CLAIM_MS = 0;
  await wholeOpen(again, "p6");
  assert.equal(await current(again), null, "after a restart too");
  const c = await sw.caches.open("planner-current-1"), rec = await (await c.match("ids")).json();
  await c.put("ids", new Response(JSON.stringify({ ...rec, at: Date.now() - 31 * 864e5 })));
  const later = load(site, sw.caches);
  await wholeOpen(later, "p7");
  assert.ok(await current(later), "30 days later the copy is tried again (a mismatch then is refused again, never mixed)");
});

test("R3-4: the manifest is not code: asked with no id while a page from the copy lives, it passes and nothing is given up", async () => {
  const { site, sw, toB } = await savedAThenB();
  await openFromCopy(sw, site, "pg");
  toB(); site.files["manifest.webmanifest"] = '{"name":"B"}';
  const r = await dispatch(sw, req(`${HOME}manifest.webmanifest`), {});
  assert.equal(r.status, 200);
  assert.equal(await strikes(sw), 0);
  assert.ok(await current(sw));
});

test("R3-4: a copy being saved is never deleted under it: not by the limit of 3 copies in progress, not by its page reading as gone", async () => {
  const site = pretendSite(appFiles("A")), sw = load(site);
  sw.ctx.PROBE_MS = 5000;
  await open(sw, "t1"); for (const f of FILES) await file(sw, "t1", f);
  site.holdNext = true;
  const saving = opened(sw, "t1");                                // its last check of the site is held
  while (!site.release) await tick(1);
  for (const id of ["t2", "t3", "t4", "t5"]) await open(sw, id);
  await tick(5);
  site.release(); await saving;
  const cur = await current(sw);
  assert.ok(cur && sets(sw).includes(cur.name), "the limit: the record names files that exist");
  const s2 = pretendSite(appFiles("A")), w2 = load(s2);
  w2.ctx.PROBE_MS = 5000;
  let say = null;
  w2.ctx.self.clients.get = () => new Promise((ok) => { say = () => ok(undefined); });   // the browser takes its time, then says "gone"
  await open(w2, "t1"); for (const f of FILES) await file(w2, "t1", f);
  await open(w2, "t2");                                           // asks whether t1's page still exists
  while (!say) await tick(1);
  s2.holdNext = true;
  const saving2 = opened(w2, "t1");                               // meanwhile t1 says it drew
  while (!s2.release) await tick(1);
  say(); await tick(5);
  s2.release(); await saving2;
  const c2 = await current(w2);
  assert.ok(c2 && sets(w2).includes(c2.name), "read as gone while being saved: the record names files that exist");
});

test("R3-4: once ids are found not to match, no copy is used, begun or saved (each check on its own)", async () => {
  // the record outlived the give-up (its deletion failed): it is not used
  const { site, sw } = await savedAThenB();
  await (await sw.caches.open("planner-current-1")).put("ids", new Response(JSON.stringify({ strikes: 2, at: Date.now() })));
  const w = load(site, sw.caches);
  site.calls.length = 0;
  await open(w, "p2"); for (const f of FILES) await file(w, "p2", f);
  assert.equal(site.calls.length, 1 + FILES.length, "every file from the site, none from the record's copy");
  const before = sets(w).length;
  await open(w, "p3");
  assert.equal(sets(w).length, before, "no copy is begun");
  // the second refusal arrives while another tab's copy is being saved: it is not saved
  const s = await savedAThenB();
  await openFromCopy(s.sw, s.site, "nav-2"); s.toB();
  await file(s.sw, "x2", "core/app.js");
  s.sw.gone.add("nav-2"); s.sw.ctx.CLAIM_MS = 0;
  await wholeOpen(s.sw, "p3");
  await openFromCopy(s.sw, s.site, "nav-4");
  Object.assign(s.site, { files: appFiles("C"), stamp: hoursAgo(0.5) });
  s.sw.ctx.PROBE_MS = 5000;
  await open(s.sw, "other-tab"); for (const f of FILES) await file(s.sw, "other-tab", f);
  s.site.holdNext = true;
  const saving = opened(s.sw, "other-tab");
  while (!s.site.release) await tick(1);
  s.sw.ctx.CLAIM_MS = 60000;
  assert.equal((await file(s.sw, "x4", "core/app.js")).status, 404);
  assert.equal(await strikes(s.sw), 2);
  s.site.release(); await saving;
  assert.equal(await current(s.sw), null, "the copy being saved when ids were found not to match is not kept");
});

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

function load(site, caches = fakeCaches(), { probe = 60 } = {}) {
  const listeners = {};
  const self = { location: { origin: ORIGIN, href: `${HOME}sw.js` }, addEventListener: (t, f) => { listeners[t] = f; }, skipWaiting: () => Promise.resolve(), clients: {}, registration: {} };
  const ctx = vm.createContext({ self, fetch: site.net, URL, Response, Headers, Promise, console, caches, AbortController, setTimeout, clearTimeout, Date, Set, Map, Math });
  vm.runInContext(SRC, ctx, { filename: "sw.js" });
  ctx.PROBE_MS = probe; ctx.MISS_MS = probe; ctx.MIN_FILES = 3;     // a pretend site is small and answers at once or never
  return { ctx, listeners, caches, site };
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
  timers.shift()();
  assert.deepEqual(posted, [{ type: "opened" }]);
  announceOpened({ nav: nav(true), doc: doc({}), later });   // a red notice or the opening screen is still showing
  timers.shift()();
  assert.equal(posted.length, 1, "nothing is said about an open that did not draw");
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

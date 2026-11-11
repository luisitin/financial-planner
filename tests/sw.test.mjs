// tests/sw.test.mjs -- sw.js, the service worker that keeps a phone on one version of the app on GitHub Pages
// (docs/PLAN.md "On a static host (GitHub Pages)"). The file is a plain script for the browser; here it runs in a Node
// vm with a pretend `self`, so its request rule (swRule) and its install/activate/fetch handlers can be checked
// without a browser. qa/flows/static-skew.mjs --check proves it in Chromium.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = fs.readFileSync(path.join(REPO, "sw.js"), "utf8");
const ORIGIN = "https://someone.github.io";
const HOME = `${ORIGIN}/financial-planner/`;

/** Load sw.js as the browser would, with a pretend worker scope; `net(url, init)` answers its fetches. */
function load(net = async () => new Response("ok"), src = SRC) {
  const listeners = {}, calls = [], did = [];
  const self = {
    location: { origin: ORIGIN, href: `${HOME}sw.js` },
    addEventListener: (type, fn) => { listeners[type] = fn; },
    skipWaiting: () => { did.push("skipWaiting"); return Promise.resolve(); },
    clients: { claim: () => { did.push("claim"); return Promise.resolve(); } },
    registration: { unregister: () => { did.push("unregister"); return Promise.resolve(true); } },
  };
  const fetch = (input, init) => { calls.push({ input, init }); return net(input, init); };
  const ctx = vm.createContext({ self, fetch, URL, Response, Headers, Promise, console });
  vm.runInContext(src, ctx, { filename: "sw.js" });
  return { ctx, listeners, calls, did };
}
/**
 * Dispatch a fetch event; resolves to the response the worker answered with, or "not answered". `ids`: the event's
 * clientId (the page asking for a file) and resultingClientId (the page a navigation opens).
 */
async function dispatch(sw, request, ids = {}) {
  let answer = null;
  sw.listeners.fetch({ request, clientId: ids.clientId ?? "", resultingClientId: ids.resultingClientId ?? "", respondWith: (p) => { answer = p; } });
  return answer ? await answer : "not answered";
}
const req = (url, more = {}) => ({ method: "GET", url, mode: "cors", cache: "default", ...more });

test("the request rule: same-site GETs are fetched fresh; /api/, hashed addresses, other methods and sites are left alone", () => {
  const { ctx } = load();
  const rule = (r) => ctx.swRule(r, ORIGIN, HOME);
  // fetched fresh
  assert.equal(rule(req(`${HOME}core/app.js`)), "file");
  assert.equal(rule(req(`${HOME}modules/overview/pages/view.js`)), "file");
  assert.equal(rule(req(`${HOME}README.md`, { mode: "same-origin" })), "file");
  assert.equal(rule(req(`${HOME}manifest.webmanifest`, { mode: "no-cors" })), "file");
  assert.equal(rule(req(`${HOME}?view=build`, { mode: "navigate" })), "page", "a navigation; ?view= is not a hash");
  assert.equal(rule(req(`${HOME}?sandbox=1`, { mode: "navigate" })), "page");
  assert.equal(rule(req(`${ORIGIN}/`, { mode: "navigate" })), "page", "the PC: the app at the root");
  // left to the browser
  assert.equal(rule(req(`${ORIGIN}/api/health`)), "pass", "the PC's /api/ at the root (api.base() is the origin)");
  assert.equal(rule(req(`${HOME}api/plan`)), "pass", "and in the app's own folder (a PC behind a proxy under a subpath)");
  assert.equal(ctx.swRule(req(`${ORIGIN}/api/plan`), ORIGIN, `${ORIGIN}/`), "pass", "the PC: the app and its /api/ at the root");
  // only there: a page folder called api is one of the app's files, fetched fresh like the rest (it would mix otherwise)
  assert.equal(rule(req(`${HOME}modules/money/api/view.js`)), "file", "a folder named api inside the app");
  assert.equal(rule(req(`${HOME}docs/api/README.md`)), "file");
  assert.equal(ctx.swRule(req(`${ORIGIN}/modules/x/api/y.js`), ORIGIN, `${ORIGIN}/`), "file", "the same on the PC");
  assert.equal(rule(req(`${ORIGIN}/core/app.js?v=a1b2c3d4e5f6`)), "pass", "a content-hashed address from the PC's import map");
  assert.equal(rule(req(`${ORIGIN}/core/ui/base.css?v=a1b2c3d4e5f6`, { mode: "no-cors" })), "pass");
  assert.equal(rule(req(`${ORIGIN}/core/app.js?v=`)), "file", "an empty ?v= is no hash");
  assert.equal(rule(req(`${ORIGIN}/api/plan`, { method: "PUT" })), "pass");
  assert.equal(rule(req(`${HOME}core/app.js`, { method: "POST" })), "pass");
  assert.equal(rule(req(`${HOME}core/app.js`, { method: "HEAD" })), "pass");
  assert.equal(rule(req("https://cdn.jsdelivr.net/npm/x@1.0.0/x.js")), "pass", "another site");
  assert.equal(rule(req("http://someone.github.io/financial-planner/")), "pass", "another origin (http vs https)");
  assert.equal(rule(req("not a url")), "pass");
  assert.equal(rule(null), "pass");
});

test("fresh: every file is asked of the site with cache no-cache (304 when unchanged), a stricter request keeps its own", async () => {
  const sw = load();
  const r = req(`${HOME}core/app.js`);
  const res = await dispatch(sw, r);
  assert.equal(await res.text(), "ok");
  assert.equal(sw.calls.length, 1);
  assert.equal(sw.calls[0].input, r, "the page's own request (mode, credentials, headers kept)");
  assert.deepEqual({ ...sw.calls[0].init }, { cache: "no-cache" });
  await dispatch(sw, req(`${HOME}core/app.js`, { cache: "reload" }));
  assert.equal(sw.calls[1].init.cache, "reload");
  await dispatch(sw, req(`${HOME}core/app.js`, { cache: "no-store" }));
  assert.equal(sw.calls[2].init.cache, "no-store");
  await dispatch(sw, req(`${HOME}core/app.js`, { cache: "force-cache" }));
  assert.equal(sw.calls[3].init.cache, "no-cache", "a request that would take a stale copy is checked too");
});

test("the page's copy says Cache-Control: no-cache, so no in-memory cache reuses it without asking the worker again", async () => {
  // Chromium reused core/math/tax.js (fetched through the worker, max-age=600) for the next page without asking:
  // the old copy ran after a deploy (qa/flows/static-skew.mjs --check, before this rule)
  const site = new Response("export const a = 1;", { status: 200, statusText: "OK", headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "max-age=600", ETag: '"5f-13"', Age: "0" } });
  const sw = load(async () => site);
  const res = await dispatch(sw, req(`${HOME}core/math/tax.js`));
  assert.equal(res.headers.get("cache-control"), "no-cache");
  assert.equal(res.headers.get("content-type"), "application/javascript; charset=utf-8", "the type is kept (a module needs it)");
  assert.equal(res.headers.get("etag"), '"5f-13"');
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "export const a = 1;");
  const missing = await dispatch(load(async () => new Response("<h1>404</h1>", { status: 404, headers: { "Cache-Control": "max-age=600" } })), req(`${HOME}vendor/README.md`));
  assert.equal(missing.status, 404, "a 404 stays a 404");
  assert.equal(missing.headers.get("cache-control"), "no-cache");
  // a redirected file keeps its own response (a module's address decides where its imports are looked up)
  const moved = new Response("x", { status: 200 });
  Object.defineProperty(moved, "redirected", { value: true });
  assert.equal(await dispatch(load(async () => moved), req(`${HOME}old.js`)), moved);
});

test("the page's copy drops Content-Encoding and Content-Length: its body is already decoded (no engine decodes it twice)", async () => {
  // GitHub Pages: core/app.js arrives gzipped, Content-Length is the gzip size (10,729 for a 31,024-byte file)
  const body = "export const a = 1; // " + "x".repeat(200);
  const site = new Response(body, { status: 200, headers: { "Content-Type": "application/javascript; charset=utf-8", "Content-Encoding": "gzip", "Content-Length": "57", "Cache-Control": "max-age=600", ETag: 'W/"5f-13"' } });
  const res = await dispatch(load(async () => site), req(`${HOME}core/app.js`));
  assert.equal(res.headers.get("content-encoding"), null);
  assert.equal(res.headers.get("content-length"), null);
  assert.equal(res.headers.get("content-type"), "application/javascript; charset=utf-8");
  assert.equal(res.headers.get("etag"), 'W/"5f-13"', "everything else is kept");
  assert.equal(await res.text(), body, "the whole body, as the site sent it");
});

test("left alone: the worker does not answer, so the browser handles the request as if there were no worker", async () => {
  const sw = load();
  for (const r of [req(`${ORIGIN}/api/health`), req(`${ORIGIN}/core/app.js?v=a1b2c3d4e5f6`), req(`${HOME}x`, { method: "POST" }), req("https://example.com/x.js")]) {
    assert.equal(await dispatch(sw, r), "not answered", r.url);
  }
  assert.equal(sw.calls.length, 0, "nothing fetched by the worker");
});

test("no network: the copy the browser already holds (force-cache); with none, the same failure as without a worker", async () => {
  const sw = load(async (input, init) => { if (init.cache === "no-cache") throw new TypeError("Failed to fetch"); return new Response("cached copy"); });
  const res = await dispatch(sw, req(`${HOME}core/app.js`));
  assert.equal(await res.text(), "cached copy");
  assert.deepEqual(sw.calls.map((c) => c.init.cache), ["no-cache", "force-cache"]);
  const page = await dispatch(sw, req(HOME, { mode: "navigate" }));
  assert.equal(await page.text(), "cached copy", "an open without signal still opens when the last one did");
  const none = load(async () => { throw new TypeError("Failed to fetch"); });
  await assert.rejects(dispatch(none, req(`${HOME}core/app.js`)), /Failed to fetch/);
  assert.equal(none.calls.length, 2);
});

test("a navigation is asked for by its address and is never answered with a redirected response", async () => {
  // a plain open: the fetched page is passed on
  const sw = load(async () => new Response("<!doctype html>", { status: 200 }));
  const res = await dispatch(sw, req(`${HOME}?sandbox=1`, { mode: "navigate", cache: "default" }));
  assert.equal(res.status, 200);
  assert.equal(sw.calls[0].input, `${HOME}?sandbox=1`, "by its address: a navigate-mode Request is not copied with new options");
  assert.deepEqual({ ...sw.calls[0].init }, { cache: "no-cache", credentials: "same-origin", redirect: "follow" });
  // a folder without its slash redirected: answered with a fresh redirect to where it ended, never the redirected response
  const target = `${HOME}docs/`;
  const redirected = new Response("<h1>404</h1>", { status: 404 });
  Object.defineProperty(redirected, "redirected", { value: true });
  Object.defineProperty(redirected, "url", { value: target });
  const sw2 = load(async () => redirected);
  const out = await dispatch(sw2, req(`${HOME}docs`, { mode: "navigate" }));
  assert.notEqual(out, redirected);
  assert.equal(out.redirected, false);
  assert.equal(out.status, 302);
  assert.equal(out.headers.get("location"), target);
});

test("install takes over at once (skipWaiting) but never claims a page that started without it", async () => {
  // claim() took over a page halfway through its first open after the worker shipped: the old core/app.js had run from
  // the browser's copy, the rest came new from the site ("Cannot read properties of undefined (reading 'build')", 2 of
  // 2 runs; 0 of 2 without it). A page that started without the worker finishes without it; the next open has it.
  const sw = load();
  sw.listeners.install({ waitUntil: () => { } });
  assert.equal(sw.listeners.activate, undefined, "no activate handler");
  assert.deepEqual(sw.did, ["skipWaiting"]);
  assert.doesNotMatch(SRC.replace(/^\s*\/\/.*$/gm, ""), /clients\.claim/, "no claim anywhere in the code");
});

test("one open is decided as a whole: a page from the site never gets an older copy of a file next to new ones", async () => {
  // the site answers the page, then drops core/app.js's connection (a phone on one bar right after a deploy)
  let down = false;
  const net = async (input, init) => {
    if (init.cache === "force-cache") return new Response("the browser's older copy");
    if (down) throw new TypeError("Failed to fetch");
    return new Response("from the site");
  };
  const sw = load(net);
  assert.equal(await (await dispatch(sw, req(HOME, { mode: "navigate" }), { resultingClientId: "page-1" })).text(), "from the site");
  assert.equal(await (await dispatch(sw, req(`${HOME}core/format.js`), { clientId: "page-1" })).text(), "from the site");
  down = true;
  const before = sw.calls.length;
  await assert.rejects(dispatch(sw, req(`${HOME}core/app.js`), { clientId: "page-1" }), /Failed to fetch/, "the file fails: an honest error, then one reload and plain words");
  assert.deepEqual(sw.calls.slice(before).map((c) => c.init.cache), ["no-cache"], "the browser's older copy is never asked for");
});

test("one open is decided as a whole: a page from the browser's copy (no network) takes every file from that copy", async () => {
  let asked = 0;
  const net = async (input, init) => {
    if (init.cache === "force-cache") return new Response("copy");
    asked++; throw new TypeError("Failed to fetch");
  };
  const sw = load(net);
  assert.equal(await (await dispatch(sw, req(HOME, { mode: "navigate" }), { resultingClientId: "page-2" })).text(), "copy");
  assert.equal(asked, 1, "the page asked the site once");
  for (const f of ["core/app.js", "core/format.js", "modules/overview/pages/view.js"]) {
    assert.equal(await (await dispatch(sw, req(`${HOME}${f}`), { clientId: "page-2" })).text(), "copy", f);
  }
  assert.equal(asked, 1, "no file asks the site again: one version (the copy) and no wait on each file");
  // the network is back on the next open: that page comes from the site again
  const sw2 = load(async (input, init) => new Response(init.cache === "force-cache" ? "copy" : "site"));
  sw2.ctx.fromCopy.add("page-3");
  assert.equal(await (await dispatch(sw2, req(HOME, { mode: "navigate" }), { resultingClientId: "page-3" })).text(), "site");
  assert.equal(sw2.ctx.fromCopy.has("page-3"), false);
  assert.equal(sw2.ctx.fromSite.has("page-3"), true);
});

test("a page the worker did not open (Safari before 16, or the worker restarted since) keeps the per-file rule", async () => {
  const sw = load(async (input, init) => { if (init.cache === "no-cache") throw new TypeError("Failed to fetch"); return new Response("copy"); });
  assert.equal(await (await dispatch(sw, req(`${HOME}core/app.js`), { clientId: "unknown-page" })).text(), "copy");
  assert.equal(await (await dispatch(sw, req(`${HOME}core/app.js`))).text(), "copy", "no client id at all");
  // and it remembers only a few dozen pages (memory only, nothing kept)
  const many = load();
  for (let i = 0; i < 200; i++) await dispatch(many, req(HOME, { mode: "navigate" }), { resultingClientId: `p${i}` });
  assert.equal(many.ctx.fromSite.size, many.ctx.KEEP);
  assert.equal(many.ctx.fromSite.has("p199"), true, "the newest are kept");
  await dispatch(many, req(HOME, { mode: "navigate" }));   // no resultingClientId: nothing to remember
  assert.equal(many.ctx.fromSite.size, many.ctx.KEEP);
});

test("retiring the worker: never delete sw.js; the two-line replacement in its header unregisters it", async () => {
  // a deleted sw.js (404 on the update check) keeps the old worker running for good (Service Worker spec, Update);
  // the documented replacement takes over at once and unregisters, so the next open is not controlled
  assert.match(SRC, /never delete this file/i);
  const lines = SRC.split("\n").filter((l) => /^\/\/\s{3}self\.addEventListener/.test(l)).map((l) => l.replace(/^\/\/\s{3}/, ""));
  assert.equal(lines.length, 2, "the replacement is written out in sw.js's header");
  const kill = load(undefined, lines.join("\n"));
  kill.listeners.install({});
  let waited = null;
  kill.listeners.activate({ waitUntil: (p) => { waited = p; } });
  assert.equal(await waited, true);
  assert.deepEqual(kill.did, ["skipWaiting", "unregister"]);
  assert.equal(kill.listeners.fetch, undefined, "it answers nothing meanwhile");
  const plan = fs.readFileSync(path.join(REPO, "docs", "PLAN.md"), "utf8");
  assert.match(plan, /never delete `sw\.js`/i, "docs/PLAN.md says so too");
});

test("the worker is plain and self-contained: no imports, no storage but its own Cache Storage names, small enough to read", () => {
  assert.doesNotMatch(SRC, /^\s*import\s|importScripts\s*\(/m);
  assert.doesNotMatch(SRC, /indexedDB|localStorage|sessionStorage/);
  // Cache Storage only for the saved whole copy (tests/sw-copy.test.mjs), under names no other cache uses
  for (const m of SRC.matchAll(/caches\.(open|delete)\(([A-Za-z_]+)/g)) assert.match(m[2], /^(CURRENT|PINS|name|cur|pin|st|old|extra|n)/, `caches.${m[1]}(${m[2]}`);
  for (const m of SRC.matchAll(/var (SET_PREFIX|CURRENT|PINS)\b[^;]*;/g)) assert.match(m[0], /"planner-/);
  assert.ok(SRC.split("\n").length < 420, "small enough to read in one sitting");
});

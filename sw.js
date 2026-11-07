// sw.js -- one version of the app at a time on a static host (GitHub Pages). A plain script: no imports, no Cache
// Storage, nothing kept on disk. docs/PLAN.md "On a static host (GitHub Pages)" says why it exists.
//
// The problem it solves (2026-11-07): GitHub Pages sends every file with Cache-Control: max-age=600, and its CDN adds
// an Age header per file, so files a phone fetched together stop being fresh at different times. Right after a deploy
// the phone ran some files from its own cache (old) and the rest from the site (new): an old core/app.js with new
// pages ("99 pages could not load", "undefined is not an object (evaluating 'ctx.view.build')"), and a reload did not
// help until the old copies ran out, up to ten minutes later.
//
// What it does: each request it handles goes to the site with cache: "no-cache", so every file is checked against the
// site on every open (a 304 when it has not changed, the new file after a deploy) and the files that run are always
// the ones the site has now. The page gets each file marked Cache-Control: no-cache, so the browser's in-memory cache
// never hands it to the next page without asking this worker again (see noReuse). One open is decided as a whole: a
// page that came from the site takes every file from the site (a file that fails, fails: never an older copy next to
// new ones); a page that came from the browser's copy (no network) takes every file from that copy. So an open without
// signal still works when the last one did.
//
// What it leaves to the browser, untouched: other methods than GET, other sites, the PC's /api/ addresses, and any
// address with a content hash (?v=..., from the PC server's import map: those never change, stay cached for good and
// cost the PC nothing here).
//
// It never calls clients.claim(): a page that started loading without the worker (the first open after it ships, or
// after Safari cleared it) finishes without it, so that one open never takes part of its files from the browser's copy
// and the rest from the site. The next open, and the app's one self-heal reload, go through it.
//
// Retiring it: never delete this file. A phone keeps a worker whose sw.js cannot be fetched (a failed update keeps the
// old one), so a deleted sw.js leaves every phone on this worker for good. Instead stop registering it in index.html,
// replace this whole file with these two lines (tests/sw.test.mjs runs them), and keep that file for months:
//   self.addEventListener("install", function () { self.skipWaiting(); });
//   self.addEventListener("activate", function (event) { event.waitUntil(self.registration.unregister()); });
//
// The opening guard in index.html registers it with scope "./" (so it also works under /financial-planner/);
// tests/sw.test.mjs loads this file in Node and checks swRule() and the handlers.
"use strict";

/**
 * What to do with one request. Pure: `req` needs { method, url, mode }, `origin` is this site's origin, `home` the
 * address of the folder the app lives in (this file's folder; "https://someone.github.io/financial-planner/").
 *   "pass"  leave it to the browser (the worker does not answer)
 *   "page"  a navigation (opening index.html): fetched fresh, never answered with a redirected response
 *   "file"  anything else on this site: fetched fresh
 */
function swRule(req, origin, home) {
  if (!req || req.method !== "GET") return "pass";
  var u;
  try { u = new URL(req.url); } catch (e) { return "pass"; }
  if (u.origin !== origin) return "pass";
  // the PC's plan, AI and compute (api.base() is the origin, or the app's folder behind a proxy): never touched. Only
  // there: a page folder that happens to be called "api" is still one of the app's files.
  var homePath = "/";
  try { homePath = new URL(home || origin + "/").pathname; } catch (e) { }
  if (u.pathname.indexOf("/api/") === 0 || u.pathname.indexOf(homePath + "api/") === 0) return "pass";
  if (u.searchParams.get("v")) return "pass";             // a content-hashed address (the PC's import map)
  return req.mode === "navigate" ? "page" : "file";
}

/** The cache mode of the fresh fetch: a request that already asks for at least as fresh ("reload", "no-store") keeps it. */
function freshMode(cache) {
  return cache === "reload" || cache === "no-store" ? cache : "no-cache";
}

/**
 * A page whose address redirected (a folder without its trailing slash) is answered with a new redirect to where it
 * ended, which the browser then follows itself. A response that went through a redirect is refused for a navigation
 * (the Fetch standard: a navigation's redirect mode is "manual"; Safari says "Response served by service worker has
 * redirections"), so it is never passed on as it is.
 */
function unredirect(res) {
  return res.redirected ? Response.redirect(res.url, 302) : res;
}

/**
 * The copy handed to the page says Cache-Control: no-cache. With the site's own max-age=600 the browser's in-memory
 * cache reuses a file for the next page by itself, without asking this worker: in qa/flows/static-skew.mjs --check,
 * Chromium ran the old core/math/tax.js after a deploy and a reload (it was fetched through this worker on the first
 * visit and was still "fresh"). no-cache means "never reuse without checking" (RFC 9111's no-cache response
 * directive), and the check comes here. The browser's HTTP cache keeps the site's own headers (this worker always asks
 * it with no-cache anyway).
 * Content-Encoding and Content-Length are dropped: the body here is already decoded (GitHub Pages sends gzip, and
 * Content-Length is the gzip size), and an engine that believed them would decode twice or cut the file short
 * (Firefox bug 1141332).
 * Left as they are: a redirected response (its address matters to a module) and opaque ones (never same-site).
 */
function noReuse(res) {
  if (res.redirected || res.type === "opaque" || res.type === "opaqueredirect") return res;
  var headers = new Headers(res.headers);
  headers.set("Cache-Control", "no-cache");
  headers.delete("Content-Encoding");
  headers.delete("Content-Length");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: headers });
}

/** Ask the site. A navigation is asked for by its address: a Request in "navigate" mode is not copied with new options. */
function askSite(req, kind, cache) {
  if (kind === "page") return fetch(req.url, { cache: cache, credentials: "same-origin", redirect: "follow" }).then(unredirect);
  return fetch(req, { cache: cache }).then(noReuse);
}

// The pages this worker opened, by client id (FetchEvent.resultingClientId; Safari 16+): from the site, or from the
// browser's copy. Kept in memory only, a few dozen at most; a page it does not know (an older Safari, or the worker was
// restarted since) gets the per-file rule: fresh, or the copy when the network fails.
var fromSite = new Set(), fromCopy = new Set();
var KEEP = 64;
function remember(set, other, id) {
  if (!id) return;
  other.delete(id);
  if (set.size >= KEEP) set.delete(set.values().next().value);
  set.add(id);
}

/** The answer to one request this worker handles (kind "page" or "file"). */
function answer(req, kind, clientId, resultingClientId) {
  var copy = function () { return askSite(req, kind, "force-cache"); };   // whatever the browser holds (or the same error as without a worker)
  if (kind === "page") {
    return askSite(req, kind, freshMode(req.cache)).then(
      function (res) { remember(fromSite, fromCopy, resultingClientId); return res; },
      function () { remember(fromCopy, fromSite, resultingClientId); return copy(); });
  }
  if (clientId && fromCopy.has(clientId)) return copy();             // this open came from the copy: all of it does
  var opened = !!clientId && fromSite.has(clientId);
  return askSite(req, kind, freshMode(req.cache)).catch(function (e) {
    if (opened) throw e;                                              // never an older copy next to the site's new files
    return copy();
  });
}

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("fetch", function (event) {
  var req = event.request;
  var kind = swRule(req, self.location.origin, self.location.href.replace(/[^/]*$/, ""));
  if (kind === "pass") return;
  event.respondWith(answer(req, kind, event.clientId, event.resultingClientId));
});

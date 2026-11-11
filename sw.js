// sw.js -- one version of the app at a time on a static host (GitHub Pages). A plain script: no imports. It keeps one
// whole copy of the app in Cache Storage (see "The saved whole copy" below); nothing else is kept.
// docs/PLAN.md "On a static host (GitHub Pages)" says why it exists.
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
// The saved whole copy (2026-11-07, for a weak or stalled connection). Asking the site about ~570 files on every open is
// slow on a poor connection, and on a stalled one the open waited for ever. So the worker also keeps the last whole set of
// files, taken from one open that drew without a problem and whose files all carried the same deploy stamp (GitHub Pages
// gives every file of one deploy the same Last-Modified, and a new deploy a new one: the same ETag prefix). On the next
// open the page asks the site first (one file, 4 seconds at most):
//   - the site answers with the saved copy's stamp: nothing changed, so the whole open comes from the saved copy (no
//     other request at all: the quick open the price of one-version-at-a-time had taken away);
//   - the site answers with another stamp: a new deploy; the open comes from the site as before, and becomes the new
//     saved copy once it has drawn (the page tells the worker with a message, core/heal.js announceOpened);
//   - the site does not answer in time, or not at all: the open comes from the saved copy, whole. It may be the previous
//     version; never a mix, because every file of that page comes from that one copy (a page remembers its copy: the
//     pin, kept in Cache Storage too, so a worker restarted in the middle of an open still serves the same copy).
// A page that came from the site never takes a file from the saved copy, and a page from the saved copy never takes a
// code file from anywhere else (a file the copy lacks is asked of the site and accepted only when it carries the copy's
// stamp). Nothing to save, no stamp, a stamp that does not look like a recent deploy, no Cache Storage (a private window,
// Safari out of space): the worker does what it did before this section existed. The copy is trusted for 24 hours, then
// the next open checks every file again and saves a new copy.
// If the saved format ever changes, give the caches new names (planner-set-2-...) and delete the old ones; retiring the
// worker (below) leaves its caches to the browser, which evicts them: they are harmless (the app, ~12 MB).
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
function askSite(req, kind, cache, signal) {
  var init = { cache: cache };
  if (signal) init.signal = signal;
  if (kind === "page") { init.credentials = "same-origin"; init.redirect = "follow"; return fetch(req.url, init).then(unredirect); }
  return fetch(req, init).then(noReuse);
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

/** The answer to one request when no saved copy takes part: fresh from the site, or the browser's copy when it is out of reach. */
function siteAnswer(req, kind, clientId, resultingClientId) {
  var copy = function () { return askSite(req, kind, "force-cache"); };   // whatever the browser holds (or the same error as without a worker)
  if (kind === "page") {
    return askSite(req, kind, freshMode(req.cache)).then(
      function (res) { remember(fromSite, fromCopy, resultingClientId); return res; },
      function () { remember(fromCopy, fromSite, resultingClientId); return copy(); });
  }
  if (clientId && fromCopy.has(clientId)) return copy();             // this open came from the copy: all of it does
  var opened = !!clientId && fromSite.has(clientId);
  return askSite(req, kind, freshMode(req.cache)).then(function (res) { stage(clientId, fileKey(req.url), res); return res; }, function (e) {
    if (opened) throw e;                                              // never an older copy next to the site's new files
    return copy();
  });
}

// ---------------------------------------------------------------- the saved whole copy
var SET_PREFIX = "planner-set-1-", CURRENT = "planner-current-1", PINS = "planner-pins-1";
var PROBE_MS = 4000;                 // how long the site may take to answer the page before the saved copy opens it
var MISS_MS = 8000;                  // ... and a file the copy lacks
var TRUST_MS = 24 * 3600 * 1000;     // a saved copy is trusted this long; after it every file is checked again
var PLAUSIBLE_MS = 90 * 24 * 3600 * 1000;   // a stamp more than this older than the open is no deploy time (a host with a fixed date)
var MIN_FILES = 50;
var staging = new Map();             // clientId -> the copy being taken from that page's open: { name, stamp, ok, page, n, pending, cache }
var pinned = new Map();              // clientId -> { name, stamp }: the saved copy that page came from
var startup = null;

function hasStore() { return typeof caches !== "undefined" && !!caches && typeof caches.open === "function"; }
function home() { return self.location.href.replace(/[^/]*$/, ""); }
/** The key a page is saved under (the app's folder, whatever the query or index.html), or null for another page. */
function pageKey(url) {
  try { var u = new URL(url), h = home(), bare = u.origin + u.pathname; return bare === h || bare === h + "index.html" ? h : null; } catch (e) { return null; }
}
function fileKey(url) { return String(url).replace(/#.*$/, ""); }
function isCode(key) { return /\.(m?js|css|html|json|webmanifest)$/.test(String(key).replace(/[?#].*$/, "")); }
/** The deploy a response belongs to: GitHub Pages sends one Last-Modified for every file of a deploy. */
function stampOf(res) { try { return (res && res.headers && res.headers.get("Last-Modified")) || null; } catch (e) { return null; } }
/** Does this stamp look like the time of a deploy shortly before `at`? (A fixed or missing date proves nothing.) */
function plausible(stamp, at) {
  var t = Date.parse(stamp);
  return isFinite(t) && t <= at + 60000 && at - t < PLAUSIBLE_MS;
}
function keepIn(map, id, value) {
  if (!id) return;
  map.delete(id);
  if (map.size >= KEEP) map.delete(map.keys().next().value);
  map.set(id, value);
}
function readCurrent() {
  if (!hasStore()) return Promise.resolve(null);
  return caches.open(CURRENT).then(function (c) { return c.match("current"); }).then(function (r) { return r ? r.json() : null; }).catch(function () { return null; });
}
function savePin(id, pin) {
  keepIn(pinned, id, pin);
  return caches.open(PINS).then(function (c) {
    return c.put("pin/" + id, new Response(JSON.stringify(pin))).then(function () { return c.keys(); }).then(function (keys) {
      return keys.length > KEEP ? c.delete(keys[0]) : null;       // oldest first
    });
  }).catch(function () { });
}
function pinFor(id) {
  if (!id) return Promise.resolve(null);
  if (pinned.has(id)) return Promise.resolve(pinned.get(id));
  return caches.open(PINS).then(function (c) { return c.match("pin/" + id); }).then(function (r) { return r ? r.json() : null; })
    .then(function (p) { if (p) keepIn(pinned, id, p); return p; }).catch(function () { return null; });
}
/** Once per worker start, and after each new copy: delete every saved copy nothing refers to (one being taken when the worker stopped, an old one). */
function tidy(extraKeep) {
  return Promise.all([caches.keys(), readCurrent(), caches.open(PINS).then(function (c) {
    return c.keys().then(function (keys) { return Promise.all(keys.map(function (k) { return c.match(k).then(function (r) { return r ? r.json() : null; }); })); });
  })]).then(function (all) {
    var names = all[0], cur = all[1], pins = all[2], keep = new Set(extraKeep || []);
    if (cur) keep.add(cur.name);
    staging.forEach(function (st) { keep.add(st.name); });
    var now = Date.now();
    pins.forEach(function (p) { if (p && now - p.at < 2 * TRUST_MS) keep.add(p.name); });
    pinned.forEach(function (p) { keep.add(p.name); });
    return Promise.all(names.filter(function (n) { return n.indexOf(SET_PREFIX) === 0 && !keep.has(n); }).map(function (n) { return caches.delete(n); }));
  }).catch(function () { });
}
function once() { if (!startup) startup = hasStore() ? tidy() : Promise.resolve(); return startup; }

/** Take a file of the page's open into the copy being saved. Only the exact response the page gets, from one deploy. */
function stage(id, key, res) {
  var st = id && staging.get(id);
  if (!st || !st.ok || !res) return;
  if (res.status !== 200) return;                                     // a missing file is not part of the copy
  if (res.redirected || res.type === "opaque" || res.type === "opaqueredirect" || stampOf(res) !== st.stamp) { st.ok = false; return; }   // two deploys in one open: not a whole copy
  var copy; try { copy = res.clone(); } catch (e) { st.ok = false; return; }
  st.pending.push(st.cache.then(function (c) { return c.put(key, copy); }).then(function () { st.n++; }, function () { st.ok = false; }));
}
function beginStaging(id, res) {
  var stamp = stampOf(res);
  if (!id || !stamp || res.status !== 200 || res.redirected || !plausible(stamp, Date.now())) return;
  var name = SET_PREFIX + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  var st = { name: name, stamp: stamp, ok: true, page: false, n: 0, pending: [], cache: caches.open(name) };
  st.cache.catch(function () { st.ok = false; });
  var forget = function (key) { var old = staging.get(key); staging.delete(key); if (old) caches.delete(old.name).catch(function () { }); };   // an open that never said it drew leaves no copy behind
  forget(id);
  if (staging.size >= KEEP) forget(staging.keys().next().value);
  staging.set(id, st);
  stage(id, home(), res);
  st.page = st.ok;
}

/** The page answered normally: the open is from the site, and its files become the next saved copy if it draws. */
function openFromSite(res, id) {
  remember(fromSite, fromCopy, id);
  if (hasStore() && id) beginStaging(id, res);
  return res;
}
/** The page from the saved copy; its files follow from the same copy (the pin). null when the copy has no page. */
function openFromStore(cur, id) {
  return caches.open(cur.name).then(function (c) { return c.match(home()); }).then(function (page) {
    if (!page) return null;
    fromSite.delete(id); fromCopy.delete(id);
    return savePin(id, { name: cur.name, stamp: cur.stamp, at: Date.now() }).then(function () { return page; });
  }, function () { return null; });
}

function answerPage(req, clientId, resultingClientId) {
  if (!pageKey(req.url) || !resultingClientId) return siteAnswer(req, "page", clientId, resultingClientId);
  var mode = freshMode(req.cache);
  return readCurrent().then(function (cur) {
    if (!cur || !cur.name || !cur.stamp) {
      return askSite(req, "page", mode).then(function (res) { return openFromSite(res, resultingClientId); },
        function () { remember(fromCopy, fromSite, resultingClientId); return askSite(req, "page", "force-cache"); });
    }
    var ctl = typeof AbortController === "function" ? new AbortController() : null, timer;
    var attempt = askSite(req, "page", mode, ctl && ctl.signal).then(function (res) { return { res: res }; }, function (err) { return { err: err }; });
    var slow = new Promise(function (ok) { timer = setTimeout(function () { ok(null); }, PROBE_MS); });
    var fromCopyOrSite = function (res) {
      return openFromStore(cur, resultingClientId).then(function (page) {
        if (page) return page;
        if (res) return openFromSite(res, resultingClientId);
        remember(fromCopy, fromSite, resultingClientId);
        return askSite(req, "page", "force-cache");
      });
    };
    return Promise.race([attempt, slow]).then(function (got) {
      clearTimeout(timer);
      if (!got) { if (ctl) ctl.abort(); return fromCopyOrSite(null); }                       // the site is not answering: the saved copy, whole
      if (got.err) return fromCopyOrSite(null);                                               // no network at all
      var res = got.res;
      if (res.status >= 500) return fromCopyOrSite(res);                                      // the site is failing
      var same = res.status === 200 && stampOf(res) === cur.stamp && Date.now() - cur.at < TRUST_MS && plausible(cur.stamp, cur.at);
      if (same) { try { if (res.body) res.body.cancel(); } catch (e) { } return fromCopyOrSite(res); }   // nothing changed since the copy: no other request
      return openFromSite(res, resultingClientId);                                            // a new deploy (or an old copy): from the site
    }).catch(function () { return siteAnswer(req, "page", clientId, resultingClientId); });
  });
}

function storeFile(pin, req) {
  var key = fileKey(req.url);
  var miss = function () {
    var ctl = typeof AbortController === "function" ? new AbortController() : null, t = ctl ? setTimeout(function () { ctl.abort(); }, MISS_MS) : 0;
    return askSite(req, "file", "no-cache", ctl && ctl.signal).then(function (res) {
      clearTimeout(t);
      if (res.status !== 200) return res;
      if (stampOf(res) === pin.stamp) {                                                       // the same deploy as the copy: it belongs to it
        try { var copy = res.clone(); caches.open(pin.name).then(function (c) { return c.put(key, copy); }).catch(function () { }); } catch (e) { }
        return res;
      }
      return isCode(key) ? new Response("", { status: 404, statusText: "Not in the saved copy of this version" }) : res;   // never new code under an old page
    }, function (e) { clearTimeout(t); throw e; });
  };
  return caches.open(pin.name).then(function (c) { return c.match(key); }).then(function (hit) { return hit || miss(); }, miss);
}
function answerFile(req, clientId) {
  var pin = clientId && pinned.get(clientId);
  if (pin) return storeFile(pin, req);
  if (clientId && !fromSite.has(clientId) && !fromCopy.has(clientId) && !staging.has(clientId)) {   // a page this worker does not remember: its pin, if it has one
    return pinFor(clientId).then(function (p) { return p ? storeFile(p, req) : siteAnswer(req, "file", clientId, ""); });
  }
  return siteAnswer(req, "file", clientId, "");
}

/** Does the copy hold the app's whole code? The shell and every page module the registry names. */
function whole(cache) {
  var h = home();
  return cache.match(h + "modules/registry.js").then(function (r) { return r ? r.text() : null; }).then(function (text) {
    if (!text) return false;
    var wants = [h + "core/app.js"], re = /import\("\.\/([^"]+)"\)/g, m;
    while ((m = re.exec(text))) wants.push(h + "modules/" + m[1]);
    if (wants.length < 2) return false;
    return Promise.all(wants.map(function (k) { return cache.match(k); })).then(function (all) { return all.every(Boolean); });
  });
}
/** The page drew without a problem (core/heal.js announceOpened): the copy taken from its open becomes the saved one. */
function promote(id) {
  var st = staging.get(id);
  if (!st) return Promise.resolve();
  staging.delete(id);
  var drop = function () { return caches.delete(st.name).catch(function () { }); };   // not saved: nothing is left behind
  return Promise.all(st.pending).then(function () {
    if (!st.ok || !st.page || st.n < MIN_FILES) return false;
    return caches.open(st.name).then(whole);
  }).then(function (ok) {
    if (!ok) return drop();
    var ctl = typeof AbortController === "function" ? new AbortController() : null, t = ctl ? setTimeout(function () { ctl.abort(); }, PROBE_MS) : 0;
    // a deploy that landed while the page was opening makes the copy two versions: ask once more
    return fetch(home(), { cache: "no-cache", credentials: "same-origin", signal: ctl ? ctl.signal : undefined }).then(function (res) {
      clearTimeout(t);
      try { if (res.body) res.body.cancel(); } catch (e) { }
      if (res.status !== 200 || stampOf(res) !== st.stamp) return drop();
      return caches.open(CURRENT).then(function (c) { return c.put("current", new Response(JSON.stringify({ name: st.name, stamp: st.stamp, at: Date.now(), n: st.n }))); })
        .then(function () { return tidy([st.name]); });
    }, function () { clearTimeout(t); return drop(); });
  }).catch(drop);
}

/** The answer to one request this worker handles (kind "page" or "file"). */
function answer(req, kind, clientId, resultingClientId) {
  if (!hasStore()) return siteAnswer(req, kind, clientId, resultingClientId);
  return once().then(function () { return kind === "page" ? answerPage(req, clientId, resultingClientId) : answerFile(req, clientId); });
}

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("message", function (event) {
  var d = event.data;
  if (!hasStore() || !d || d.type !== "opened" || !event.source || !event.source.id) return;
  event.waitUntil(promote(event.source.id));
});
self.addEventListener("fetch", function (event) {
  var req = event.request;
  var kind = swRule(req, self.location.origin, self.location.href.replace(/[^/]*$/, ""));
  if (kind === "pass") return;
  event.respondWith(answer(req, kind, event.clientId, event.resultingClientId));
});

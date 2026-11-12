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
// Safari out of space), a host other than GitHub Pages or this machine (copyHost), COPY_ON false: the worker does what
// it did before this section existed. The copy is trusted for 24 hours, then the next open checks every file again.
// Never back a version (2026-11-11): once a page from the site of another deploy than the saved copy says its code has
// started ("running"), the saved copy is forgotten; if that open is never saved, the phone waits for the site.
// Ids that do not match (2026-11-11, the section below): while a page from the saved copy lives, a code file asked for
// under an id this worker does not know, or none, is refused with the 404 used for "missing from the copy", never
// answered by the site (the old page with new files: a mix); a 404 is never a mix. Two such refusals on two opens give
// the copy up in this browser for 30 days from the first.
// NOT VERIFIED ON WEBKIT (only Chromium runs where this was built; the phone is an iPhone). It rests on a page's files
// arriving under the id its navigation announced (resultingClientId) and on clients.get finding that page. Not covered:
// a browser that hands a new page an older page's id, or whose clients.get does not find a live page after its first
// minute. After the push that ships this, check once on the phone: open twice, airplane mode, open again (it opens in
// about 5 s), then open a few pages. If it misbehaves, set COPY_ON = false (below): the worker of before the copy.
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
  if (!id) return Promise.resolve();
  other.delete(id);
  if (set.size >= KEEP) set.delete(set.values().next().value);
  set.add(id);
  return hasStore() ? mark(known, "ok/", id) : Promise.resolve();   // written down too: a restarted worker still knows it opened this page
}

/** The answer to one request when no saved copy takes part: fresh from the site, or the browser's copy when it is out of reach. */
function siteAnswer(req, kind, clientId, resultingClientId) {
  var copy = function () { return askSite(req, kind, "force-cache"); };   // whatever the browser holds (or the same error as without a worker)
  if (kind === "page") {
    return askSite(req, kind, freshMode(req.cache)).then(
      function (res) { return remember(fromSite, fromCopy, resultingClientId).then(function () { return res; }); },
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
var STAGING_KEEP = 3;                // copies being taken at once (tabs opened together); an older unfinished one is deleted
var staging = new Map();             // clientId -> the copy being taken from that page's open: { name, stamp, ok, page, n, pending, cache, busy }
var pinned = new Map();              // clientId -> { name, stamp, at, open, spent }: the saved copy that page came from
var startup = null;

// Ids that do not match (2026-11-11). Everything above rests on one thing the browser does: a page's files arrive under
// the id its navigation announced. A page from the saved copy (its pin) holds a refusal for as long as it lives
// (clients.get finds it), and from its open for CLAIM_MS even when the browser does not list it yet: while any pin holds,
// a code file asked for under an id this worker does not know (or under none) may belong to that page, so it is refused
// (404), never answered by the site, whose files may be another deploy's. That covers the page's first file and every
// later one (a page module loaded on demand under another id was the 2026-11-07 crash). Each refusal forgets the saved
// copy and writes the id down as refused (that page gets no code from the site while it lives). Refusals on two
// different opens are the proof that ids do not match in this browser (`idsBroken`, the record "ids" next to the saved
// one, forgotten after FORGIVE_MS): no copy is kept here any more, which leaves the worker of before the copy. One
// refusal alone is not proof (a worker restarted at the wrong moment can cause one), so a copy is kept again after it.
// Pages that came from the site are not touched by this: the worker knows every page it opened (`known`, written to
// Cache Storage before the page is answered, so a restart keeps it), every page that existed when it started
// (clients.matchAll: the pages of the previous sw.js), and every page that asked for a file while no pin held.
var IDS = "planner-ids-1";           // "ok/<id>": a page this worker knows did not come from the saved copy; "no/<id>": refused
var known = new Set(), refused = new Set();
var idsBroken = false, strikes = 0, struckAt = 0;
var OPEN_MS = 2 * TRUST_MS;          // a pin counts for at most as long as its copy is kept
var CLAIM_MS = 60 * 1000;            // ... and one whose page is not found, for this long after its open
var FORGIVE_MS = 30 * 24 * 3600 * 1000;   // refusals older than this are forgotten: the copy is tried again
function mark(set, prefix, id) {
  if (!id || set.has(id)) return Promise.resolve();
  if (set.size >= 2 * KEEP) set.delete(set.values().next().value);
  set.add(id);
  return caches.open(IDS).then(function (c) {
    return c.put(prefix + id, new Response("1")).then(function () { return c.keys(); }).then(function (keys) {
      return keys.length > 4 * KEEP ? c.delete(keys[0]) : null;
    });
  }).catch(function () { });
}
/** What is written down about an id this worker does not remember: "no" (refused), "ok" (known), or null. */
function markOf(id) {
  if (!id) return Promise.resolve(null);
  if (refused.has(id)) return Promise.resolve("no");
  if (known.has(id)) return Promise.resolve("ok");
  return caches.open(IDS).then(function (c) { return Promise.all([c.match("no/" + id), c.match("ok/" + id)]); }).then(function (r) {
    if (r[0]) { refused.add(id); return "no"; }
    if (r[1]) { known.add(id); return "ok"; }
    return null;
  }).catch(function () { return null; });
}
/** Does the browser still have this page? When it cannot say, assume it does (refused, never mixed). */
function alive(id) {
  if (!self.clients || typeof self.clients.get !== "function") return Promise.resolve(true);
  return Promise.resolve().then(function () { return self.clients.get(id); }).then(function (c) { return !!c; }, function () { return true; });
}
/** The pins that hold the refusal now ([id, pin]); `unclaimed`: only those never followed by a file under their own id. */
function holding(unclaimed) {
  var now = Date.now(), list = [];
  pinned.forEach(function (p, id) { if (now - p.at < OPEN_MS && (!unclaimed || p.open)) list.push([id, p]); });
  return Promise.all(list.map(function (e) { return e[1].open && now - e[1].at < CLAIM_MS ? true : alive(e[0]); }))
    .then(function (live) { return list.filter(function (e, i) { return live[i]; }); });
}
/** A file was asked for under the pin's own id: ids match for this file. */
function claim(id, pin) {
  if (!pin.open) return;
  pin.open = false;
  savePin(id, pin);
}
/** A code file was refused: the saved copy is forgotten, this id never gets code from the site, and an open refused for the first time counts. */
function giveUp(id, held) {
  var jobs = [mark(refused, "no/", id), dropCurrent()], fresh = held.filter(function (e) { return !e[1].spent; });
  fresh.forEach(function (e) { e[1].spent = true; jobs.push(savePin(e[0], e[1])); });
  if (fresh.length) {
    var now = Date.now();
    if (!strikes || now - struckAt >= FORGIVE_MS) { strikes = 0; struckAt = now; }
    strikes++;
    if (strikes >= 2) idsBroken = true;
    jobs.push(caches.open(CURRENT).then(function (c) { return c.put("ids", new Response(JSON.stringify({ strikes: strikes, at: struckAt }))); }).catch(function () { }));
  }
  return Promise.all(jobs);
}
function notInCopy() { return new Response("", { status: 404, statusText: "Not in the saved copy of this version" }); }
/** Code a page runs or is drawn with (the manifest is neither, and the browser may ask for it under no id). */
function runs(key) { return isCode(key) && !/\.webmanifest$/.test(String(key).replace(/[?#].*$/, "")); }
/** What this worker wrote down before it was stopped: every pin, and whether ids were found not to match. */
function recall() {
  var pins = caches.open(PINS).then(function (c) {
    return c.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        var m = /pin\/([^/]+)$/.exec(String(k && k.url ? k.url : k)), id = m && m[1], now = Date.now();
        try { id = id && decodeURIComponent(id); } catch (e) { }
        return id && c.match(k).then(function (r) { return r ? r.json() : null; }).then(function (p) {
          if (p && now - p.at < OPEN_MS && !pinned.has(id)) keepIn(pinned, id, p);     // older ones: their copy is no longer kept (tidy)
        });
      }));
    });
  }).catch(function () { });
  var flag = caches.open(CURRENT).then(function (c) { return c.match("ids"); }).then(function (r) { return r && r.json(); }).then(function (rec) {
    if (rec && Date.now() - rec.at < FORGIVE_MS) { strikes = rec.strikes || 1; struckAt = rec.at; idsBroken = strikes >= 2; }
  }).catch(function () { });
  return Promise.all([pins, flag]).then(function () { return holding(true); }).then(function (unclaimed) {
    // the pages that exist now and have no pin were opened by the site (under this worker before it stopped, or under
    // the sw.js before this one). Not while a pin waits for its first file: one of them may be that pin's page under another id.
    if (unclaimed.length || !self.clients || typeof self.clients.matchAll !== "function") return null;
    return self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then(function (list) {
      return Promise.all((list || []).map(function (c) {
        return c && c.id && !pinned.has(c.id) && markOf(c.id).then(function (what) { if (!what) mark(known, "ok/", c.id); });   // not one that was refused
      }));
    });
  }).catch(function () { });
}

// The off switch for the saved copy alone: false makes this worker do exactly what it did before the copy existed (every
// file checked against the site on every open). Use it when a phone's browser is found to misbehave with the copy.
var COPY_ON = true;
/**
 * Is this a host whose deploy stamp is known to be one per deploy? Verified for GitHub Pages (*.github.io) on 2026-11-07;
 * this machine (localhost, 127.0.0.1) is the test harness, which does the same. Any other host (a custom domain, another
 * static host) might send one fixed Last-Modified for every deploy, which would make two deploys look like one: no copy
 * is kept there.
 */
function copyHost() {
  try { var h = new URL(self.location.href).hostname; return /\.github\.io$/.test(h) || h === "localhost" || h === "127.0.0.1"; } catch (e) { return false; }
}
function hasStore() { return COPY_ON && typeof caches !== "undefined" && !!caches && typeof caches.open === "function" && copyHost(); }
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
/** The record of the saved copy, or null when there is none. Rejects when it could not be read (tidy then deletes nothing). */
function readCurrentOrFail() {
  return caches.open(CURRENT).then(function (c) { return c.match("current"); }).then(function (r) { return r ? r.json() : null; });
}
function readCurrent() {
  if (!hasStore() || idsBroken) return Promise.resolve(null);
  return readCurrentOrFail().catch(function () { return null; });
}
/** Forget the saved copy (its files go at the next tidy): the next open asks the site, as before the copy existed. */
function dropCurrent() {
  return caches.open(CURRENT).then(function (c) { return c.delete("current"); }).catch(function () { });
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
  return Promise.all([caches.keys(), readCurrentOrFail(), caches.open(PINS).then(function (c) {
    return c.keys().then(function (keys) { return Promise.all(keys.map(function (k) { return c.match(k).then(function (r) { return r ? r.json() : null; }); })); });
  })]).then(function (all) {
    var names = all[0], cur = all[1], pins = all[2], keep = new Set(extraKeep || []);
    if (cur) keep.add(cur.name);
    staging.forEach(function (st) { keep.add(st.name); });   // a copy stays in `staging` until promote() has finished with it
    var now = Date.now();
    pins.forEach(function (p) { if (p && now - p.at < 2 * TRUST_MS) keep.add(p.name); });
    pinned.forEach(function (p) { keep.add(p.name); });
    return Promise.all(names.filter(function (n) { return n.indexOf(SET_PREFIX) === 0 && !keep.has(n); }).map(function (n) { return caches.delete(n); }));
  }).catch(function () { });
}
function once() { if (!startup) startup = hasStore() ? tidy().then(recall) : Promise.resolve(); return startup; }

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
  if (!id || !stamp || idsBroken || res.status !== 200 || res.redirected || !plausible(stamp, Date.now())) return;
  var name = SET_PREFIX + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  var st = { name: name, stamp: stamp, ok: true, page: false, n: 0, pending: [], cache: caches.open(name) };
  st.cache.catch(function () { st.ok = false; });
  var forget = function (key) { var old = staging.get(key); staging.delete(key); if (old) caches.delete(old.name).catch(function () { }); };   // an open that never said it drew leaves no copy behind
  forget(id);
  // An app opened and closed a few times in a row left a copy (~12 MB) per open until the worker stopped. So: a copy
  // whose page is gone is deleted now, and at most STAGING_KEEP are in progress. Never one that is being saved (busy).
  var idle = function () { var keys = []; staging.forEach(function (s, key) { if (!s.busy) keys.push(key); }); return keys; };
  for (var spare = idle(); staging.size >= STAGING_KEEP && spare.length; ) forget(spare.shift());
  if (self.clients && typeof self.clients.get === "function") {
    idle().forEach(function (key) {
      var was = staging.get(key);
      Promise.resolve().then(function () { return self.clients.get(key); }).then(function (client) {
        if (!client && staging.get(key) === was && !was.busy) forget(key);
      }).catch(function () { });
    });
  }
  staging.set(id, st);
  stage(id, home(), res);
  st.page = st.ok;
}

/** The page answered normally: the open is from the site, and its files become the next saved copy if it draws. */
function openFromSite(res, id) {
  if (hasStore() && id) beginStaging(id, res);
  return remember(fromSite, fromCopy, id).then(function () { return res; });
}
/** The page from the saved copy; its files follow from the same copy (the pin). null when the copy has no page. */
function openFromStore(cur, id) {
  return caches.open(cur.name).then(function (c) { return c.match(home()); }).then(function (page) {
    if (!page) return null;
    fromSite.delete(id); fromCopy.delete(id);
    return savePin(id, { name: cur.name, stamp: cur.stamp, at: Date.now(), open: true }).then(function () { return page; });
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
    // `res`: the site's own answer, whole and unread (its body is cancelled only once the copy's page is in hand: a
    // cancelled answer handed to the browser is an error page, and it was, for as long as the record outlived its files)
    var fromCopyOrSite = function (res) {
      return openFromStore(cur, resultingClientId).then(function (page) {
        if (page) { try { if (res && res.body) res.body.cancel(); } catch (e) { } return page; }
        return dropCurrent().then(function () {                        // the record names files that are gone: forget it
          if (res) return openFromSite(res, resultingClientId);
          remember(fromCopy, fromSite, resultingClientId);
          return askSite(req, "page", "force-cache");
        });
      });
    };
    return Promise.race([attempt, slow]).then(function (got) {
      clearTimeout(timer);
      if (!got) { if (ctl) ctl.abort(); return fromCopyOrSite(null); }                       // the site is not answering: the saved copy, whole
      if (got.err) return fromCopyOrSite(null);                                               // no network at all
      var res = got.res;
      if (res.status >= 500) return fromCopyOrSite(res);                                      // the site is failing
      var same = res.status === 200 && stampOf(res) === cur.stamp && Date.now() - cur.at < TRUST_MS && plausible(cur.stamp, cur.at);
      if (same) return fromCopyOrSite(res);                                                   // nothing changed since the copy: no other request
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
      return isCode(key) ? notInCopy() : res;   // never new code under an old page
    }, function (e) { clearTimeout(t); throw e; });
  };
  return caches.open(pin.name).then(function (c) { return c.match(key); }).then(function (hit) { return hit || miss(); }, miss);
}
function answerFile(req, clientId) {
  var pin = clientId && pinned.get(clientId);
  if (pin) { claim(clientId, pin); return storeFile(pin, req); }
  if (clientId && (fromSite.has(clientId) || fromCopy.has(clientId) || staging.has(clientId))) return siteAnswer(req, "file", clientId, "");
  // a page this worker does not remember: its pin, if it has one
  return pinFor(clientId).then(function (p) {
    if (p) { claim(clientId, p); return storeFile(p, req); }
    return strangerFile(req, clientId);
  });
}
/** A file for a page with no pin that this worker did not open itself (or does not remember opening): see "Ids that do not match". */
function strangerFile(req, clientId) {
  var site = function () { return siteAnswer(req, "file", clientId, ""); };
  var code = runs(fileKey(req.url));
  return markOf(clientId).then(function (what) {
    if (what === "no") return code ? notInCopy() : site();            // a page from the copy under another id: never code from the site
    if (what === "ok") return site();
    return holding(false).then(function (held) {
      if (!held.length) { mark(known, "ok/", clientId); return site(); }   // no page from the copy lives: a page from the site
      if (!code) return site();
      return giveUp(clientId, held).then(notInCopy);                    // it may be a page from the copy: refuse
    });
  });
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
/**
 * The page drew without a problem (core/heal.js announceOpened): the copy taken from its open becomes the saved one.
 * One at a time, and the copy stays in `staging` until it is either the saved one or deleted: two tabs opened together
 * used to delete each other's copy in tidy() and leave a record naming files that were gone.
 */
var promoting = Promise.resolve();
function promote(id) {
  var next = promoting.then(function () { return promoteOne(id); });
  promoting = next.catch(function () { });
  return next;
}
function promoteOne(id) {
  var st = staging.get(id);
  if (!st) return Promise.resolve();
  st.busy = true;                                                     // being saved: beginStaging leaves it alone
  var done = function () { if (staging.get(id) === st) staging.delete(id); };
  var drop = function () { done(); return caches.delete(st.name).catch(function () { }); };   // not saved: nothing is left behind
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
      if (res.status !== 200 || stampOf(res) !== st.stamp || idsBroken) return drop();   // idsBroken: checked here, the last moment before it is saved
      return caches.open(CURRENT).then(function (c) { return c.put("current", new Response(JSON.stringify({ name: st.name, stamp: st.stamp, at: Date.now(), n: st.n }))); })
        .then(function () { done(); return tidy([st.name]); });
    }, function () { clearTimeout(t); return drop(); });
  }).catch(drop);
}
/**
 * Never back a version. The page says its code has started (core/heal.js announceOpened, at once): when that page came
 * from the site and is another deploy than the saved copy, the saved copy is forgotten there and then. Until this open
 * is saved in its place (a moment later, if it drew) the phone has no copy and waits for the site, as it did before the
 * copy existed. Without this, an app closed right after a new version drew, or a site that went silent just then, left
 * the OLD copy as the saved one, and the next stalled open ran the old version after the new one had already run (and
 * possibly saved the plan).
 */
function running(id) {
  if (!id || !fromSite.has(id)) return Promise.resolve();
  var st = staging.get(id), stamp = st ? st.stamp : null;
  return readCurrent().then(function (cur) {
    if (!cur || (stamp && cur.stamp === stamp)) return null;
    return dropCurrent();
  });
}

/** The answer to one request this worker handles (kind "page" or "file"). */
function answer(req, kind, clientId, resultingClientId) {
  if (!hasStore()) return siteAnswer(req, kind, clientId, resultingClientId);
  return once().then(function () {
    return kind === "page" ? answerPage(req, clientId, resultingClientId) : answerFile(req, clientId);
  });
}

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("message", function (event) {
  var d = event.data;
  if (!hasStore() || !d || !event.source || !event.source.id) return;
  if (d.type === "running") event.waitUntil(running(event.source.id));
  if (d.type === "opened") event.waitUntil(promote(event.source.id));
});
self.addEventListener("fetch", function (event) {
  var req = event.request;
  var kind = swRule(req, self.location.origin, self.location.href.replace(/[^/]*$/, ""));
  if (kind === "pass") return;
  event.respondWith(answer(req, kind, event.clientId, event.resultingClientId));
});

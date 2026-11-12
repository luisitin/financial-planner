// core/app.js -- boots the shell: loads every module in modules/registry.js, builds the
// sidebar (search, "Ready now", collapsible groups), routes #/group/id to a module's
// render(), and keeps the status pill fresh.
//
// Modules never import this file. They get everything through the `ctx` object passed to
// render() and compute() -- see docs/CONVENTIONS.md "The ctx object".
import { GROUPS } from "./groups.js";
import registry from "../modules/registry.js";
import { store } from "./store.js";
import { tooNew, SCHEMA_VERSION } from "./schema/migrate.js";
import { api, conn } from "./api.js";
import { ai } from "./ai.js";
import { router } from "./router.js";
import { features } from "./features.js";
import * as ui from "./ui/dom.js";
import * as fmt from "./format.js";
import { matchRank, closeShare, cleanQuery, words as queryWords } from "./search.js";
import { estimate, settle, mergeEstimators, guessesTouching } from "./estimate/index.js";
import { view, reach, shown as offeredPage } from "./view.js";
import { healOnce, brokenWords, bootWords, PAGE_WORDS, NEWER_PLAN_WORDS, failNotice as healNotice, announceOpened } from "./heal.js";
import * as place from "./place.js";

const modules = new Map();          // "group/id" -> manifest
const broken = [];                  // modules that failed to import (shown on the dashboard)
let cleanup = null;                 // the current page's cleanup function
let current = null;                 // current route
let renderSeq = 0;                  // a newer show() wins over a slow one still rendering
let rerender = null;                // the re-render a store update schedules (show() cancels it: it would be redundant)
let drawnSeq = 0;                   // the last show() that finished drawing (the place of a half-drawn page is never written)
const NAV_KEY = "planner.nav";      // { open: {groupId: bool}, showSoon: bool }
const nav = (() => { try { return { open: {}, showSoon: true, ...JSON.parse(localStorage.getItem(NAV_KEY) || "{}") }; } catch { return { open: {}, showSoon: true }; } })();
const saveNav = () => { try { localStorage.setItem(NAV_KEY, JSON.stringify(nav)); } catch { } };
// Guesses (docs/CONVENTIONS.md "Guesses"): every loaded manifest's `estimators` and `guessTables`, merged once at boot
// whatever the per-device page toggles, so a guess keeps following the answers even when its page is switched off.
let GUESS = { estimators: {}, tables: {}, weights: {} };
let moved = 0;                      // how many guesses the last save moved (store.takeSettled), said once with its notice
export const isReady = (m) => m.status !== "planned";
// A mix of old and new files (a deploy landing while the app opens) is mended by one reload (core/heal.js), before any
// error is shown; never twice within two minutes. The sandbox (testers, ?sandbox=1) never reloads by itself: a tester
// sees the error at once. The PC's server always puts an import map in index.html, so its presence says the app's files
// come from the PC (restarting it can help); on GitHub Pages (phone only) the words never mention the PC.
const heal = () => !store.sandbox() && healOnce();
const servedByPc = () => !!document.querySelector('script[type="importmap"]');
/** A red notice in plain words with a filled Reload button; the technical text sits behind "Show details" (core/heal.js). */
const failNotice = (words, details = [], opts = {}) => healNotice(ui, words, details, opts);
// The household's view (core/view.js): a page is offered (menu, search, lists) only when it is ready, not a builder's
// page, and what it needs (the PC, the AI helper) answers. The build view offers everything, as before.
const isShown = (m) => offeredPage(m, isReady);
const userView = () => !view.build;
view.init();

async function loadModules() {
  const loaded = await Promise.all(registry.map(async (entry) => {
    try {
      const m = (await entry.load()).default;
      if (!m || m.id !== entry.id || m.group !== entry.group) {
        console.warn(`[planner] module at ${entry.group}/${entry.id} declares id/group ${m?.group}/${m?.id}; folder names win`);
        if (m) { m.id = entry.id; m.group = entry.group; }
      }
      return m;
    } catch (e) { console.error(`[planner] module ${entry.group}/${entry.id} failed to load`, e); broken.push(`${entry.group}/${entry.id}: ${e.message}`); return null; }
  }));
  for (const m of loaded) if (m) modules.set(`${m.group}/${m.id}`, m);
  const reg = mergeEstimators([...modules.values()].map((m) => ({ from: `${m.group}/${m.id}`, estimators: m.estimators, tables: m.guessTables })));
  for (const p of reg.problems) console.error(`[planner] ${p}`);
  GUESS = reg;
}

function pagesInGroup(groupId) {
  return [...modules.values()].filter((m) => m.group === groupId && features.enabled(m) && isShown(m)).sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}

// ---------------------------------------------------------------- sidebar
function buildNav(filter = "") {
  const side = document.getElementById("sidebar");
  side.innerHTML = "";
  const q = filter.trim().toLowerCase();
  const search = ui.h("input", { type: "search", class: "nav-search", placeholder: "Find a page...", value: filter, "aria-label": "Find a page" });
  search.addEventListener("input", () => { buildNav(search.value); side.querySelector(".nav-search").focus(); });
  side.append(search);

  const link = (m, extraClass = "") => ui.h("a", { href: `#/${m.group}/${m.id}`, class: `nav-link${isReady(m) ? "" : " planned"}${extraClass}`, dataset: { key: `${m.group}/${m.id}` } },
    extraClass ? ui.h("span", { class: "ic" }, m.icon ?? "") : null, ui.h("span", {}, m.title), isReady(m) ? null : ui.h("span", { class: "soon" }, "soon"));

  // Search ranking (design log 2026-09-15): page name hit = 0, topic name hit = 1,
  // description-only hit = 2. Topics are ordered by their best hit, pages inside a topic too.
  // core/search.js also understands the owner's own words ("what I owe" -> Net worth) and manifest aliases.
  // the household's first names are left out of the query ("college for Cy" finds the college page)
  const ignore = (store.get()?.household?.people ?? []).map((p) => p.name).filter((n) => n && n !== "Me");
  const rank = (m, g) => matchRank(m, g.title, q, { ignore });

  if (!q) {
    const ready = [...modules.values()].filter((m) => isReady(m) && features.enabled(m) && isShown(m)).sort((a, b) => GROUPS.findIndex((g) => g.id === a.group) - GROUPS.findIndex((g) => g.id === b.group) || (a.order ?? 100) - (b.order ?? 100));
    // "Recent": the 8 ready pages opened last on this device, Dashboard always first; before
    // anything has been opened, the first ready pages in topic order (design log 2026-09-15, pass 2).
    const READY_MAX = 8;
    const recent = (nav.recent ?? []).map((k) => modules.get(k)).filter((m) => m && isReady(m) && features.enabled(m) && isShown(m));
    const dash = modules.get("overview/dashboard");
    const shown = [];
    for (const m of [dash, ...recent, ...ready]) if (m && !shown.includes(m) && shown.length < READY_MAX) shown.push(m);
    side.append(ui.h("div", { class: "nav-section" }, (recent.length > 2 || (recent.length && !userView())) ? "Recent" : userView() ? "Start with" : "Ready now"));
    for (const m of shown) side.append(link(m, " ready-link"));
    if (ready.length > READY_MAX) side.append(ui.h("a", { href: userView() ? "#/overview/pages" : "#/overview/pages/ready", class: "nav-link ready-link nav-more" }, ui.h("span", { class: "ic" }, ""), ui.h("span", {}, userView() ? `All ${ready.length} pages ›` : `All ${ready.length} ready pages ›`)));
    // The hide/show toggle sits on the topics header, not at the bottom of 18 topics.
    // (the household's view has no "coming soon" pages to hide: the toggle is for the build view)
    const toggle = userView() ? null : ui.h("button", { type: "button", class: "nav-soon-toggle", onClick: () => { nav.showSoon = !nav.showSoon; saveNav(); buildNav(); } }, nav.showSoon ? "Hide coming soon" : "Show coming soon");
    side.append(ui.h("div", { class: "nav-section nav-section-row" }, ui.h("span", {}, "By topic"), toggle));
  }
  const groups = [];
  for (const g of GROUPS) {
    let pages = pagesInGroup(g.id).map((m) => ({ m, r: rank(m, g) })).filter((x) => x.r >= 0);
    if (!nav.showSoon && !q && !userView()) pages = pages.filter((x) => isReady(x.m));
    if (!pages.length) continue;
    if (q) pages.sort((a, b) => a.r - b.r);
    groups.push({ g, pages: pages.map((x) => x.m), best: Math.min(...pages.map((x) => x.r)), hits: pages.length, named: q && g.title.toLowerCase().includes(q) ? 0 : 1, total: pagesInGroup(g.id).length });
  }
  if (q) groups.sort((a, b) => a.best - b.best || a.named - b.named || b.hits - a.hits);
  for (const { g, pages, total } of groups) {
    const readyN = pages.filter(isReady).length;
    const open = q ? true : !!nav.open[g.id];
    const grp = ui.h("div", { class: `nav-group${open ? " open" : ""}` });
    const count = userView() ? `${pages.length}` : q ? (readyN ? `${readyN} ready` : `${pages.length} soon`) : (readyN ? `${readyN} of ${total} ready` : `${pages.length} soon`);
    const head = ui.h("button", { type: "button", class: "nav-group-head", onClick: () => { nav.open[g.id] = !grp.classList.contains("open"); saveNav(); grp.classList.toggle("open"); } },
      ui.h("span", { class: "ic" }, g.icon), ui.h("span", { class: "t" }, g.title),
      ui.h("span", { class: "n" }, count), ui.h("span", { class: "chev" }, "▶"));
    grp.append(head, ui.h("div", { class: "nav-group-body" }, pages.map((m) => link(m))));
    side.append(grp);
  }
  let closest = false;
  if (q && !groups.length) {
    // no page has every word: the closest few (two or more meaningful words, at least half of them found), ready pages first
    if (queryWords(cleanQuery(q, ignore)).length >= 2) {
      const close = [...modules.values()].filter((m) => features.enabled(m) && isReady(m) && isShown(m))
        .map((m) => ({ m, s: closeShare(m, GROUPS.find((g) => g.id === m.group)?.title ?? "", q, { ignore }) })).filter((x) => x.s >= 0.5)
        .sort((a, b) => b.s - a.s || (a.m.order ?? 100) - (b.m.order ?? 100)).slice(0, 5);
      if (close.length) { side.append(ui.h("div", { class: "nav-section" }, "Closest pages")); for (const { m } of close) side.append(link(m, " ready-link")); }
      closest = close.length > 0;
    }
    side.append(ui.h("div", { class: "nav-empty" }, ui.h("div", {}, closest ? `No page has every word of “${filter.trim()}”.` : `No page matches “${filter.trim()}”.`),
      ui.h("div", {}, "Try another word, or ", ui.h("a", { href: "#/overview/pages" }, "browse All pages"), ".")));
  }
  if (!userView()) side.append(ui.h("div", { class: "nav-foot" }, ui.h("div", {}, `${[...modules.values()].filter(isReady).length} of ${modules.size} pages ready`)));
  markActive();
}
function markActive() {
  for (const a of document.querySelectorAll("#sidebar .nav-link")) a.classList.toggle("active", !!current && a.dataset.key === `${current.group}/${current.id}`);
}
function setToggleIcon(open) {
  const b = document.getElementById("nav-toggle");
  if (!b) return;
  b.textContent = open ? "✕" : "☰";
  b.setAttribute("aria-label", open ? "Close menu" : "Menu"); b.title = open ? "Close menu" : "Menu";
}
function closeDrawer() { document.getElementById("sidebar").classList.remove("open"); document.getElementById("scrim").classList.remove("show"); setToggleIcon(false); }
function openSearch() {   // ctx.openSearch(): the menu with the cursor in its search box (on a phone the drawer opens)
  const side = document.getElementById("sidebar");
  if (!matchMedia("(min-width: 960px)").matches && !side.classList.contains("open")) toggleDrawer();
  side.querySelector(".nav-search")?.focus();
}
function toggleDrawer() { const open = document.getElementById("sidebar").classList.toggle("open"); document.getElementById("scrim").classList.toggle("show", open); setToggleIcon(open); }

// ---------------------------------------------------------------- pages
function safeCompute(m, plan, params) {
  if (typeof m.compute !== "function") return null;
  try { return m.compute(plan, params ?? {}); } catch (e) { console.error(`[planner] compute failed in ${m.group}/${m.id}`, e); return { error: String(e) }; }
}
/** ctx.announce(text): read a confirmation out to screen readers (one live region outside #content, which is rebuilt on every render). */
function announce(text) {
  const el = document.getElementById("announce");
  if (!el) return;
  el.textContent = "";
  setTimeout(() => { el.textContent = String(text ?? ""); }, 60);
}
function makeCtx(route) {
  const plan = store.get();
  return {
    route, plan, store, api, ai, ui, fmt, features, modules, GROUPS, isReady,
    view, live: reach, shown: isShown,   // the household's view and what answers (core/view.js); pages follow them, see docs/CONVENTIONS.md "View"
    computeOf: (key, params) => { const m = modules.get(key); return m ? safeCompute(m, store.get(), params) : null; },
    computeRemote: async (key, params) => {
      const m = modules.get(key); if (!m) return null;
      // the PC works on this device's plan, sent along: its own copy may not have the latest change yet
      if (m.heavy && store.backend() === "server") { try { return await api.compute(key, params, store.get()); } catch (e) { console.warn("[planner] remote compute failed, running locally", e); } }
      return safeCompute(m, store.get(), params);
    },
    go: (group, id, rest, query) => router.go(group, id, rest, query),
    // something opened over the page that the phone's Back should close (an edit form): returns release(), called when it
    // closes itself (Save, Cancel, another row); docs/CONVENTIONS.md "What the shell keeps for you"
    layer: (close) => router.layer(close),
    // an on-screen way back done in code: true when the page `href` names was just behind and the shell went Back to it
    // (a link does the same by carrying data-back)
    back: (href) => router.back(href),
    // draw this page again without writing the plan (its own open/close state changed); never store.update(() => {})
    redraw: () => { clearTimeout(rerender); rerender = setTimeout(() => { if (current) show(current, { keepScroll: true }); }, 0); },
    // our guess for one field: an Estimate (value, why, ...) or null; opts: { path, rec, args } (core/estimate estimate)
    guess: (key, opts = {}) => { try { return estimate(store.get(), key, { estimators: GUESS.estimators, tables: GUESS.tables, today: fmt.today(), ...opts }); } catch (e) { console.error(`[planner] guess ${key} failed`, e); return null; } },
    openSearch,
    announce,
  };
}
/**
 * Draw a page. A new address starts at the top; Back, Forward and a reload (`entry.kind`) put back the place, the open
 * sections and the typing of that entry (core/place.js). The redraw after a save (store.update, an adopted plan,
 * ctx.redraw) passes keepScroll: open sections, typing elsewhere and the focus stay, the thing tapped stays under the
 * thumb, and a page that brings its answer into view itself still wins. When the green "Saved." (or red error) the save
 * produced cannot be read where it is, a short copy of it shows at the bottom for a few seconds.
 */
async function show(route, { keepScroll = false, entry = null } = {}) {
  clearTimeout(rerender);
  const seq = ++renderSeq;
  current = route;
  let m = modules.get(`${route.group}/${route.id}`);
  if (!m || !features.enabled(m)) m = modules.get("overview/dashboard") ?? [...modules.values()][0];
  // place (core/place.js): what the person would lose when the page is cleared, and the place to put back
  place.busy(seq);
  let revealed = false; const onReveal = () => { revealed = true; };
  addEventListener("planner:reveal", onReveal);
  try {
  const snap = keepScroll ? place.before() : null;
  let rec = null;
  if (!keepScroll) {
    document.querySelector(".save-echo")?.remove();   // a note belongs to the page it was said on
    if (entry?.from && drawnSeq === seq - 1) { place.leave(entry.from.n, entry.from.href); keepWays(entry.from.n, document.getElementById("content")); }   // the entry left, with its address (and a one-tap change's way back)
    if (entry?.kind === "new" && !entry.replaced && !entry.away) place.forgetAfter(entry.from?.n ?? entry.n - 1);   // Forward can no longer reach those (a Back onto another visit's entry: it still can)
    place.visit(entry, place.pageKeyOf(location.hash));
    // Back, Forward, Reload: the record of this entry (not while the "changed in two places" bar asks to be seen)
    rec = entry && entry.kind !== "new" && !document.getElementById("sync-bar") ? place.recordOf(entry.n, location.href) : null;
  } else place.shown(place.pageKeyOf(location.hash));
  if (cleanup) { try { cleanup(); } catch (e) { console.warn(e); } cleanup = null; }
  const root = document.getElementById("content");
  ui.setMoneySign(currencySign(store.get()?.meta?.currency));
  const keepY = keepScroll ? window.scrollY : rec ? rec.y : 0;
  const noticesBefore = keepScroll ? new Set([...root.querySelectorAll(".notice.ok, .notice.error")].map((n) => n.textContent)) : null;
  root.style.minHeight = keepScroll ? `${root.offsetHeight}px` : rec ? `${rec.y + window.innerHeight}px` : "";   // room while the page draws (place.hold lets it go)
  if (!keepScroll) place.releaseFocus(root);   // a new page: the box with the cursor goes quietly (its typing is written down)
  root.innerHTML = "";
  document.getElementById("page-title").textContent = m ? m.title : "Planner";
  document.title = `${m ? m.title : "Planner"} - Planner`;
  if (m && isReady(m)) {   // remember for the drawer's "Recent" list
    const key = `${m.group}/${m.id}`;
    nav.recent = [key, ...(nav.recent ?? []).filter((k) => k !== key)].slice(0, 12);
    saveNav(); buildNav();
  }
  markActive();
  if (!keepScroll) closeDrawer();
  place.scrollTo(0, keepY);
  if (!m) { root.append(ui.notice("error", "No modules are registered. Run `npm run registry`.")); return; }
  // an older app (a saved copy, another tab) never edits a plan a newer one saved: the words and a Reload button, no page
  // (no room is borrowed for it and it is shown from the top: Back, a reload or a redraw must not leave it off the screen)
  if (tooNew(store.get())) { root.style.minHeight = ""; place.scrollTo(0, 0); root.append(failNotice(NEWER_PLAN_WORDS, [`The plan is version ${store.get().schemaVersion}; this app reads up to version ${SCHEMA_VERSION}.`])); showPill(); return; }
  // Plain words first; the technical list sits behind a tap (design log 2026-09-15). Shown only when the one reload
  // at boot did not mend it (boot() below).
  if (broken.length) root.append(failNotice(brokenWords(broken.length, servedByPc()), broken));
  const ctx = makeCtx(route);
  ctx.module = m;
  // The page draws into its own plain <div data-page>, so a page that clears and redraws itself never wipes
  // what the shell puts around it: the step-by-step guide's bar and next-step card (overview/guide `frame`,
  // docs/CONVENTIONS.md "Shell hook: frame").
  const page = ui.h("div", { dataset: { page: `${m.group}/${m.id}` } });
  const gm = modules.get("overview/guide");
  let frame = null;
  if (gm?.frame && isReady(gm) && features.enabled(gm)) { try { frame = gm.frame(ctx, page); } catch (e) { console.warn("[planner] guide frame failed", e); } }
  if (frame?.before) root.append(frame.before);
  const note = guessNote(m, ctx.plan);
  if (note) root.append(note);
  root.append(page);
  ctx.derived = safeCompute(m, ctx.plan);
  let c = null;
  const scrolls0 = place.scrolls();
  try { c = (await m.render(page, ctx)) ?? null; }
  catch (e) {
    console.error(e);
    if (seq === renderSeq && heal()) return;   // reloading: likely old and new files mixed; a second throw shows the notice
    page.append(failNotice(PAGE_WORDS, [String(e)], { reload: !broken.length }));   // one Reload button on the screen
  }
  if (seq !== renderSeq) { try { c?.(); } catch { } return; }   // a newer page took over while this one rendered
  cleanup = c;
  if (frame?.after) root.append(frame.after);
  drawnSeq = seq; router.touch(); place.idle(seq);
  if (keepScroll) {
    const pageScrolled = place.pageMoved(scrolls0) || revealed;   // the page or the form kit brought something into view: it wins
    const put = place.afterSave(root, snap, { scroll: !pageScrolled });
    // guesses that followed this save (core/estimate settle) are said on its green notice, or on their own at the bottom
    const followed = moved; moved = 0;
    const words = followed ? ` ${followed} of our guesses moved with it.` : "";
    const firstOk = followed ? [...root.querySelectorAll(".notice.ok")].find((n) => !noticesBefore.has(n.textContent) || lastFresh.has(n.textContent)) ?? null : null;
    if (firstOk) firstOk.append(words);
    else if (followed) echo(words.trim());
    const now = [...root.querySelectorAll(".notice.ok, .notice.error")];
    // this save's notices: text the screen did not have before, or the same "Saved." the last save also produced
    const fresh = now.filter((n) => n === firstOk || !noticesBefore.has(n.textContent) || lastFresh.has(n.textContent));
    lastFresh = new Set(fresh.map((n) => n.textContent));
    // the box that had the focus went with its form: the focus goes to this save's notice when it can be read (forms N1)
    const readable = (n) => n.isConnected && !place.inShutFold(n) && n.getClientRects().length > 0 && place.seenEnough(n.getBoundingClientRect(), topbarH(), window.innerHeight);
    // none on the screen: still this save's line (the bottom note shows its words), so the next Tab goes on from where the
    // person was, not from the top of the app (forms1 K4)
    if (put.focusLost) { const n = fresh.find((x) => readable(x) && x.classList.contains("ok")) ?? fresh.find(readable) ?? fresh.find((x) => x.isConnected && x.classList.contains("ok")) ?? fresh.find((x) => x.isConnected); if (n) { n.setAttribute("tabindex", "-1"); try { n.focus({ preventScroll: true }); } catch { } } }
    // the bottom note: decided one frame after the draw (a page that brings its line into view in its next frame wins),
    // and again once a scroll the page made has stopped
    const decide = () => {
      if (seq !== renderSeq || !fresh.length || fresh.some(readable)) return;
      const n0 = fresh.find((n) => n.isConnected) ?? fresh[0];
      const copy = n0.cloneNode(true); copy.querySelectorAll("a, button, .notice-actions").forEach((x) => x.remove());
      const own = n0.isConnected ? n0.querySelector("button.notice-action") ?? n0.querySelector("a[href], button") : null;
      const home = route.query?.from === "review" ? root.querySelector("nav.gb-compact a[data-back]") : root.querySelector("a.gb-ci");   // opened from the check-in (or one page further): its way back
      const note = echo(copy.textContent.replace(/\s+/g, " ").trim(), n0.classList.contains("error") ? "bad" : "ok", [own, home !== own ? home : null].filter(Boolean).map(wayOf), place.tappedRect(root));
      // said once: when the page's own line comes into view after all (the room under the page let go, a late scroll),
      // the copy goes (forms1 NP1 "Pay added." twice, tapmenu NP3 "Dr Lee added." twice)
      const t0 = performance.now();
      const check = () => { if (!note?.isConnected || seq !== renderSeq || performance.now() - t0 > 2500) return; if (fresh.some(readable)) { note.remove(); return; } setTimeout(check, 100); };
      setTimeout(check, 100);
    };
    const s1 = place.scrolls();
    // two frames: the room lent under the page while it drew is let go one frame after the draw (place.hold), and the
    // screen a person reads is the one after that
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => {
      if (seq !== renderSeq) return;
      if (place.scrolls() === s1 && !pageScrolled) return decide();
      let t = null; const t0 = performance.now();
      const quiet = () => { clearTimeout(t); if (performance.now() - t0 > 1000) { removeEventListener("scroll", quiet); decide(); return; } t = setTimeout(() => { removeEventListener("scroll", quiet); decide(); }, 150); };
      addEventListener("scroll", quiet, { passive: true }); quiet();
    }, 0)));
  } else {
    lastFresh = new Set(); moved = 0;   // a new page: an earlier save's moved guesses are old news
    const guessed = entry && entry.kind !== "new" ? putWaysBack(entry.n, page) : [];   // before the place is put back: the page as it was left
    place.afterArrive(root, rec);
    // a line that could not go back where it was (the page is drawn another way) went to the top of the page: when it
    // cannot be read there, the bottom note says it once, with its button
    if (guessed.length) requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => {
      const n = guessed[0];
      if (seq !== renderSeq || !n.isConnected || place.seenEnough(n.getBoundingClientRect(), topbarH(), window.innerHeight)) return;
      const copy = n.cloneNode(true); copy.querySelectorAll("a, button, .notice-actions").forEach((x) => x.remove());
      const b = n.querySelector("button");
      echo(copy.textContent.replace(/\s+/g, " ").trim(), "ok", b ? [wayOf(b)] : []);
    }, 0)));
    if (entry) place.note(entry.n);
  }
  } finally { place.idle(seq); removeEventListener("planner:reveal", onReveal); }
}
/**
 * A one-tap change's way back stays with its history entry (forms2 new problem 1). A green line with its own button
 * ("Monthly amounts set on 4 goals." + "Put back my amounts", the kit's Undo, "Put it back: ...") is drawn once by its
 * page, so a look at another page and Back used to lose it, with the old amounts shown nowhere. When an entry is left,
 * such lines are kept here (in memory: a reload is a new visit) with the plan as it was; Back or Forward onto that entry
 * puts the same line, with the same button, back where it was, while the plan is still that plan (any change since, here
 * or from another device, and it is not offered again: the line lives until the next change, docs/CONVENTIONS.md).
 */
const waysKept = new Map();   // entry number -> [{ el, path, i, next, plan }]
const lineText = (el) => (el?.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
function keepWays(n, root) {
  waysKept.delete(n);
  const page = root.querySelector(":scope > [data-page]");
  if (!page) return;
  const got = [...page.querySelectorAll(".notice.ok")].filter((el) => el.querySelector("button") && el.getClientRects().length && !place.inShutFold(el)).map((el) => {
    const path = []; for (let x = el.parentElement; x && x !== page; x = x.parentElement) path.unshift([...x.parentElement.children].indexOf(x));
    return { el, path, i: [...el.parentElement.children].indexOf(el), next: el.nextElementSibling ? lineText(el.nextElementSibling) : null, plan: store.get() };
  });
  if (got.length) { waysKept.set(n, got); if (waysKept.size > 30) waysKept.delete(waysKept.keys().next().value); }
}
/** Put the kept lines back on the page just drawn for entry n. Returns those that went to the top of the page (their
 * spot is not there any more). */
function putWaysBack(n, page) {
  const kept = waysKept.get(n); waysKept.delete(n);
  const guessed = [];
  if (!kept) return guessed;
  const shown = new Set([...page.querySelectorAll(".notice")].map((x) => lineText(x)));
  for (const w of kept) {
    if (store.get() !== w.plan || shown.has(lineText(w.el))) continue;   // the plan changed since, or the page said it again itself
    let parent = page; for (const k of w.path) parent = parent?.children?.[k] ?? null;
    const at = parent?.children?.[w.i] ?? null;
    const fits = parent && (w.next === null ? w.i === parent.children.length : at && lineText(at) === w.next);
    if (fits) parent.insertBefore(w.el, at);
    else { page.prepend(w.el); guessed.push(w.el); }
  }
  return guessed;
}
/**
 * The one muted row a page that rests on a big guess shows (docs/CONVENTIONS.md "Guesses": opt-in with `restsOn:
 * [plan sections]` in the manifest; never on Get started or the guesses page). Names the two biggest, then "and N more".
 */
function guessNote(m, plan) {
  if (!Array.isArray(m?.restsOn) || !m.restsOn.length || (m.group === "overview" && (m.id === "setup" || m.id === "guesses"))) return null;
  let big = [];
  try { big = guessesTouching(plan, m.restsOn, { weights: GUESS.weights }).filter((e) => GUESS.weights[e.k] === "big"); } catch { big = []; }
  if (!big.length) return null;
  const names = [...new Set(big.map((e) => (GUESS.estimators[e.k]?.label ?? "a figure we filled in").toLowerCase()))];
  const shown = names.slice(0, 2).join(" and ") + (names.length > 2 ? `, and ${names.length - 2} more` : "");
  return ui.h("ul", { class: "page-list" }, ui.h("li", {}, ui.h("a", { class: "muted", href: "#/overview/guesses" }, `Some of this uses our guesses: ${shown}. ›`)));
}
const currencySign = (code) => { try { return new Intl.NumberFormat("en-US", { style: "currency", currency: code || "USD" }).formatToParts(0).find((p) => p.type === "currency")?.value ?? "$"; } catch { return "$"; } };
let lastFresh = new Set();          // the notices the last save's redraw produced (a second "Saved." is still news)
const topbarH = () => document.getElementById("topbar")?.getBoundingClientRect().bottom ?? 0;
/**
 * A short note at the bottom of the screen: a save's confirmation that cannot be read where the page drew it, or kept
 * typing (kind "info", no tick). It leaves by itself (core/place.js echoStay: 4 to 10 s by its length) and when the page
 * changes, and never moves the page. A tap on its words closes it and goes on to what is under it (the box the person
 * reached for gets the cursor, the button its press: place NP2), so the note never costs a tap. Its ways on (at most two:
 * the notice's own button or link, and the check-in's way back) are 44 px rows that take their own taps. When at the
 * bottom it would cover the thing just tapped (`near`), it sits just above that thing; with the keyboard up, above it.
 */
function echo(text, kind = "ok", ways = [], near = null) {
  if (kind === true) kind = "bad"; else if (kind !== "bad" && kind !== "info") kind = "ok";
  document.querySelector(".save-echo")?.remove();
  const words = ui.h("div", { class: "save-echo-words" }, ui.h("span", {}, text));
  const el = ui.h("div", { class: `save-echo ${kind}` },
    ui.h("span", { class: "save-echo-mark", "aria-hidden": "true" }, kind === "bad" ? "!" : kind === "info" ? "i" : "✓"), words);
  // the note lets taps through (pointer-events: none, its ways excepted); a finger put down on it closes it
  const through = (e) => {
    if (!el.isConnected) { document.removeEventListener("pointerdown", through, true); return; }
    if (e.target?.closest?.(".save-echo-way")) return;
    const r = el.getBoundingClientRect();
    if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { el.remove(); document.removeEventListener("pointerdown", through, true); }
  };
  document.addEventListener("pointerdown", through, true);
  for (const w of (ways ?? []).filter(Boolean).slice(0, 2)) {
    words.append(w.href
      ? ui.h("a", { class: "save-echo-way", href: w.href, dataset: w.back !== null && w.back !== undefined && w.back !== false ? { back: w.back === true ? "" : String(w.back) } : {}, onClick: () => el.remove() }, w.label)
      : ui.h("button", { type: "button", class: "save-echo-way", onClick: () => { el.remove(); w.run?.(); } }, w.label));
  }
  const vv = window.visualViewport, kb = vv && window.innerHeight - vv.height > 80 ? Math.max(0, window.innerHeight - (vv.offsetTop + vv.height)) : 0;
  if (kb) el.style.bottom = `${kb + 8}px`;   // the keyboard is up: above it
  document.body.append(el);
  const r = el.getBoundingClientRect();
  if (near && near.bottom > r.top - 8 && near.top < r.bottom + 8) { el.classList.add("above"); el.style.top = `${Math.max(Math.round(topbarH()) + 8, Math.round(near.top - r.height - 12))}px`; }
  if (kind !== "bad") announce(text);
  const stay = place.echoStay(text.length, (ways ?? []).filter(Boolean).length, kind === "bad");
  setTimeout(() => el.classList.add("leaving"), stay);
  setTimeout(() => el.remove(), stay + 400);
  return el;
}
/** A way on for the bottom note, from a link or button of the page: a link stays a link (a way back keeps data-back, so
 * it goes Back); a button presses the page's own button while it is still there (the kit's Undo). */
const wayOf = (el) => el.tagName === "A"
  ? { label: el.textContent.replace(/\s+/g, " ").trim(), href: el.getAttribute("href"), back: el.getAttribute("data-back") }   // null, "" or "1" (a page between)
  : { label: el.textContent.replace(/\s+/g, " ").trim(), run: () => { if (el.isConnected) el.click(); } };

let aiState = "off";
async function refreshStatus() {
  // the sandbox never reaches out: no AI check (the pill says Sandbox and does not name the AI)
  // what answers decides what the household is offered (core/view.js): the AI helper only counts through the PC
  const pc = store.backend() === "server";
  // (the household's view asks only through the PC: with none, nothing reaches out to look for an AI service)
  if (!store.sandbox() && (pc || !userView())) { try { aiState = await ai.status(); } catch { aiState = "off"; } }
  reach.set({ pc, ai: pc && !store.sandbox() && String(aiState).startsWith("on") });
  showPill();
}
/**
 * The pill says where the latest change really is (design log 2026-09-15 words): "Saved on PC" only when the PC has it.
 * A change that could not reach the PC yet, or two versions waiting for a choice, read "Phone only" (amber).
 */
function showPill() {
  const el = document.getElementById("status");
  if (store.sandbox()) {
    el.textContent = "Sandbox";
    el.className = "warn";
    el.title = "Pretend plan, kept in this browser only. Nothing here touches your real plan. Remove ?sandbox=1 from the address to leave.";
    return;
  }
  const server = store.backend() === "server";
  // the household's view: no PC set up on this device means nothing to connect to, so the pill just says where it is kept
  if (userView() && !server && !conn.load().serverUrl) {
    el.textContent = "Saved on this phone";
    el.className = "ok";
    el.title = "Your plan is kept in this browser on this device. Download a copy from Settings to keep one somewhere else. Tap for settings.";
    return;
  }
  const { late, conflict } = store.syncState();   // a save on its way for a moment still reads Saved on PC (no flicker)
  const onPc = server && !late && !conflict;
  el.textContent = onPc ? (userView() ? "Saved on your computer" : "Saved on PC") : "Phone only";
  el.className = onPc ? "ok" : "warn";
  if (userView()) {   // plain words, no machine names (a PC that was set up but cannot be reached is the one case worth a flag)
    el.title = (conflict ? "Your plan was changed in two places: choose which version to keep, at the top of the page"
      : late ? "Your latest changes are saved on this device only. They are sent on by themselves as soon as the connection is back"
      : "Your plan is saved") + ". Tap for settings.";
    return;
  }
  el.title = (conflict ? "Your plan was changed in two places: choose which version to keep, at the top of the page"
    : late ? `Your latest changes are saved on this device only. They go to ${userView() ? "your computer" : "the PC"} by themselves as soon as it can be reached`
    : server ? `Your plan is saved on ${userView() ? "your computer" : "the PC"} (${api.base()})` : `${userView() ? "Your computer" : "The PC"} cannot be reached: your plan is saved in this browser only`) + `. AI: ${aiState}. Tap for settings.`;
}
/** Two versions (this device's changes and another device's): a bar above every page asks which one to keep. */
function showConflict() {
  let bar = document.getElementById("sync-bar");
  const { conflict } = store.syncState();
  if (!conflict) { bar?.remove(); return; }
  const fresh = !bar;
  if (!bar) { bar = ui.h("div", { id: "sync-bar", role: "alert" }); document.getElementById("content").before(bar); }
  const when = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? "earlier" : d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); };
  bar.replaceChildren(ui.h("section", { class: "card notice warn sync-card" },
    ui.h("h2", {}, "Your plan was changed in two places"),
    conflict.from === "tab"
      ? ui.h("p", {}, `This window has changes (last at ${when(conflict.mineAt)}), and the plan was also changed in another window or tab on this device (${when(conflict.theirsAt)}). Nothing has been overwritten. Which version do you want to keep?`)
      : ui.h("p", {}, `This device has changes (last at ${when(conflict.mineAt)}) that your computer does not have, and your computer's copy was changed on another device (${when(conflict.theirsAt)}). Nothing has been overwritten. Which version do you want to keep?`),
    ui.h("div", { class: "row" },
      ui.button(conflict.from === "tab" ? "Keep this window's version" : "Keep this device's version", () => { const tab = store.syncState().conflict?.from === "tab"; store.resolve("mine"); echo(tab ? "Kept this window's version." : "Kept this device's version. Your computer's earlier copy is in its backups."); }),
      ui.button(conflict.from === "tab" ? "Use the other window's version" : "Use your computer's version", () => { const tab = store.syncState().conflict?.from === "tab"; if (ui.confirm(tab ? "Use the other window's version? The changes made in this window will be dropped." : "Use your computer's version? The changes made on this device will be dropped.")) { store.resolve("theirs"); echo(tab ? "Now showing the other window's version." : "Now showing your computer's version."); } }, { class: "secondary" })),
    ui.h("p", { class: "muted small" }, `This screen shows this ${conflict.from === "tab" ? "window" : "device"}'s version until you choose.`)));
  // a choice that matters: bring it into view once, unless someone is typing (it waits at the top for them)
  const typingNow = (() => { const a = document.activeElement; return !!a?.closest?.("#content") && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName); })();
  if (fresh && !typingNow) { document.querySelector(".save-echo")?.remove(); place.cancelHold(); window.scrollTo(0, 0); }
}
let toldFull = false;
function onSync() {
  const { conflict, localFull, late } = store.syncState();
  if (store.takeSent() && !conflict) echo("Your changes are now saved on your computer.");
  // the browser's storage is full and the PC cannot take the change either: say so once, in plain words
  if (localFull && late && !toldFull) { toldFull = true; echo(userView() && !conn.load().serverUrl && store.backend() !== "server" ? "This device is out of space for your plan, so the latest change is only on screen. Download a copy from Settings before closing the app." : "This device is out of space for your plan, so the latest change is only on screen. Connect to your computer before closing the app.", true); }
  if (!localFull) toldFull = false;
  // a change marked as waiting was not on this device at open (it did not fit, or this device's copy was erased)
  if (store.takeLost()) echo("Your last change on this device could not be found when the app opened, so it did not reach your computer. Please check it and enter it again if it is missing.", true);
  showPill(); showConflict();
}

async function boot() {
  await loadModules();
  if (broken.length && heal()) return;   // pages that do not fit the shell: one reload first (core/heal.js)
  // untouched guesses follow each change inside store.update (never on load, adopt, replace, resolve or another tab's save)
  store.settleWith((draft) => settle(draft, { estimators: GUESS.estimators, tables: GUESS.tables, today: fmt.today() }));
  await features.init();
  await store.load();
  reach.set({ pc: store.backend() === "server" });   // the PC is known after the plan loads; the AI helper's answer follows (refreshStatus)
  buildNav();
  const live = document.createElement("div");   // ctx.announce()'s live region, visually hidden
  live.id = "announce"; live.setAttribute("aria-live", "polite");
  Object.assign(live.style, { position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" });
  document.body.append(live);
  document.getElementById("nav-toggle").addEventListener("click", toggleDrawer);
  document.getElementById("scrim").addEventListener("click", closeDrawer);
  document.getElementById("status").addEventListener("click", () => router.go("system", "settings"));
  store.subscribe(() => {
    moved += store.takeSettled()?.changed?.length ?? 0;
    clearTimeout(rerender); rerender = setTimeout(() => { if (current) show(current, { keepScroll: true }); }, 50);
  });
  // place (core/place.js): what the last act saved is no longer "typed and not saved" (only when the plan really changed)
  let sig = place.planSig(store.get());
  store.subscribe(() => { const now = place.planSig(store.get()); place.saved(now !== sig); sig = now; });
  // the place of the entry on screen, written when the scroll stops, a section is set and the app is hidden, and only
  // once the page has finished drawing (never per scroll event)
  const noteNow = () => { const e = router.entry(); if (e && drawnSeq === renderSeq) { router.touch(); place.note(e.n); } };
  place.start({ root: () => document.getElementById("content"), changed: noteNow, echo: (t, way) => echo(t, "info", way ? [way] : []) });
  let still = null;
  addEventListener("scroll", () => { clearTimeout(still); still = setTimeout(noteNow, 200); }, { passive: true });
  addEventListener("pagehide", noteNow);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState !== "visible") noteNow(); });
  // an on-screen way back (a[data-back] on the page, in the guide frame or in the bottom note) is the phone's Back when
  // the page it names is just behind; otherwise the link is followed. Bubble phase: page handlers run first.
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const a = e.target?.closest?.("a[data-back]"), href = a?.getAttribute("href");
    if (href?.startsWith("#/") && router.back(href, Math.max(0, Math.min(3, Number(a.dataset.back) || 0)))) { e.preventDefault(); document.querySelector(".save-echo")?.remove(); }   // data-back="1": one page between
  });
  // A tab left open on another device: when it comes back into view, take the PC's plan if it is newer, so a tap here
  // never saves an old copy over today's changes; changes made here while the PC was out of reach go to it now (and
  // are retried every 30 seconds and when the network returns). Never redraw over what someone is typing.
  const typing = () => { const a = document.activeElement; return !!a?.closest?.("#content") && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName); };
  addEventListener("planner:sync", onSync);
  // leaving the app (switching apps, locking the phone, closing the tab): the change is already on this device; send it now
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") store.resync({ takeNewer: !typing() }); else store.flush(); });
  addEventListener("pagehide", () => store.flush());
  addEventListener("online", () => store.resync({ takeNewer: !typing() }));
  setInterval(() => { if (store.syncState().pending || store.backend() !== "server") store.resync({ takeNewer: !typing() }); }, 30000);
  onSync();
  addEventListener("planner:features", () => buildNav());
  // the view switch (Settings, ?view=) or what answers changed: the menu and the page on screen follow it, unless someone is typing
  const follow = () => { buildNav(document.querySelector("#sidebar .nav-search")?.value ?? ""); if (current && !typing()) show(current, { keepScroll: true }); };
  addEventListener("planner:view", follow);
  addEventListener("planner:live", follow);
  addEventListener("planner:connection", () => { store.reconnect().then(() => { refreshStatus(); onSync(); if (current) show(current, { keepScroll: true }); }); });
  // First visit (an empty plan, "look around" never chosen) or a guide still followed before any account: an address
  // that names no page opens Get started instead of the dashboard. Any address naming a page always wins.
  const sm = modules.get("overview/start");
  if (sm && isReady(sm) && features.enabled(sm) && /^#?\/?$/.test(location.hash) && safeCompute(sm, store.get(), { today: fmt.today() })?.opensHere) { try { history.replaceState(null, "", "#/overview/start"); } catch { location.hash = "#/overview/start"; } }
  router.start((route, entry) => show(route, { entry }));
  refreshStatus();
  setInterval(refreshStatus, 30000);
}
/**
 * A page shown inside a frame (a preview pane, the single-file demo in a sandboxed frame) may be sandboxed without
 * "allow-forms": the browser then drops every form submit and logs an error, so no Save button would do anything.
 * Inside a frame a submit button's tap is sent straight to the form's own submit handler (the pages' handlers all
 * preventDefault; nothing is navigated). No probe is made, so nothing is logged. A normal tab is left alone.
 */
function mendBlockedForms() {
  let framed = false;
  try { framed = window.top !== window.self; } catch { framed = true; }
  if (!framed) return;
  document.addEventListener("click", (e) => {
    const b = e.target?.closest?.("button, input[type=submit]");
    const form = b?.form;
    if (!form || (b.type ?? "submit") !== "submit" || b.disabled) return;
    e.preventDefault();
    if (!form.noValidate && !b.formNoValidate && typeof form.reportValidity === "function" && !form.reportValidity()) return;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  }, true);
}
boot().then(() => { announceOpened(); mendBlockedForms(); }).catch((e) => {
  console.error(e);
  if (heal()) return;
  document.getElementById("content").replaceChildren(failNotice(bootWords(servedByPc()), [String(e)]));
});

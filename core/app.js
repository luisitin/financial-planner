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
import { matchScore, closeShare, cleanQuery, words as queryWords, hasWords } from "./search.js";
import { install as installTaps } from "./taps.js";
import { missing, fixCase } from "./address.js";
import { estimate, settle, mergeEstimators, guessesTouching } from "./estimate/index.js";
import { view, reach, shown as offeredPage } from "./view.js";
import { healOnce, brokenWords, bootWords, PAGE_WORDS, NEWER_PLAN_WORDS, failNotice as healNotice, announceOpened } from "./heal.js";
import * as place from "./place.js";
import { detail } from "./ui/more.js";
import { look, HIDE_WORDS } from "./look.js";
import { showDemoBar, takeLeft } from "./demo/bar.js";
import { leftWords } from "./demo/names.js";

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
// wave 1 (taps): the tap guard (core/taps.js). A second tap on a spot whose screen just changed does nothing, and a tap
// made while a page was being worked out is not carried out later on whatever it drew; taps on the top bar always land.
let planRev = 0;                    // counts plan changes (store.subscribe): the guard asks whether a tap changed the plan
let navStale = true;                // the menu's list is out of date (on a phone it is drawn again when the menu opens)
const taps = installTaps({ rev: () => planRev, inPage: (el) => !Element.prototype.closest.call(el, "#topbar"), log: store.sandbox() ? (x) => { (window.__swallowed ??= []).push(x); } : null });
const $ = (id) => document.getElementById(id);
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
look.start();   // how this phone looks (core/look.js): amounts hidden on screen when this phone asked for it; never the plan

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
// wave 1 (taps, the touch stress test of 2026-11-11): Find a page is made once and kept, so typing, the caret, the phone's
// keyboard and its suggestions are never thrown away; only the list under it is drawn again. Enter (the keyboard's Go)
// opens the first page listed; Escape with a word clears it (the next Escape closes the menu).
function searchBox(side) {
  let s = side.querySelector(":scope > .nav-search");
  if (s) return s;
  s = ui.h("input", { type: "search", class: "nav-search", placeholder: "Find a page...", "aria-label": "Find a page", enterkeyhint: "go", autocomplete: "off", autocapitalize: "none" });
  s.addEventListener("input", () => buildNav(s.value));
  s.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.isComposing) {
      e.preventDefault();
      const a = s.value.trim() ? side.querySelector(".nav-list a.nav-link[href]") : null;
      if (a) openFromMenu(a.getAttribute("href"));
    } else if (e.key === "Escape" && s.value) { e.preventDefault(); e.stopPropagation(); s.value = ""; buildNav(""); }
  });
  side.prepend(s);
  return s;
}
/** The menu's list for the word in Find a page; `filter` left out keeps the word that is there. */
function buildNav(filter) {
  const side = $("sidebar");
  const search = searchBox(side);
  if (filter === undefined || filter === null) filter = search.value;
  else if (search.value !== filter) search.value = filter;
  let list = side.querySelector(":scope > .nav-list");
  if (!list) { list = ui.h("div", { class: "nav-list" }); side.append(list); }
  const out = [];
  const q = filter.trim().toLowerCase();

  // a row picked in the menu (data-via): it takes the open menu's place in the history (core/router.js)
  const link = (m, extraClass = "") => ui.h("a", { href: `#/${m.group}/${m.id}`, class: `nav-link${isReady(m) ? "" : " planned"}${extraClass}`, dataset: { key: `${m.group}/${m.id}`, via: "menu" } },
    extraClass ? ui.h("span", { class: "ic" }, m.icon ?? "") : null, ui.h("span", {}, m.title), isReady(m) ? null : ui.h("span", { class: "soon" }, "soon"));

  // Search ranking (design log 2026-09-15): page name hit = 0, topic name hit = 1,
  // description-only hit = 2. Topics are ordered by their best hit, pages inside a topic too.
  // core/search.js also understands the owner's own words ("what I owe" -> Net worth) and manifest aliases; inside each
  // level the page named for the word comes first (matchScore, 2026-11-11: "budget" lists Budget first, "car" Vehicles).
  // the household's first names are left out of the query ("college for Cy" finds the college page)
  const people = store.get()?.household?.people;
  const ignore = (Array.isArray(people) ? people : []).map((p) => p?.name).filter((n) => n && n !== "Me");
  const rank = (m, g) => matchScore(m, g.title, q, { ignore });

  if (!q) {
    out.push(hideRow());   // first, right under Find a page: on the first screen of the menu on any phone
    const ready = [...modules.values()].filter((m) => isReady(m) && features.enabled(m) && isShown(m)).sort((a, b) => GROUPS.findIndex((g) => g.id === a.group) - GROUPS.findIndex((g) => g.id === b.group) || (a.order ?? 100) - (b.order ?? 100));
    // "Recent": the 8 ready pages opened last on this device, Dashboard always first; before
    // anything has been opened, the first ready pages in topic order (design log 2026-09-15, pass 2).
    const READY_MAX = 8;
    const recent = (nav.recent ?? []).map((k) => modules.get(k)).filter((m) => m && isReady(m) && features.enabled(m) && isShown(m));
    const dash = modules.get("overview/dashboard");
    const shown = [];
    for (const m of [dash, ...recent, ...ready]) if (m && !shown.includes(m) && shown.length < READY_MAX) shown.push(m);
    out.push(ui.h("div", { class: "nav-section" }, (recent.length > 2 || (recent.length && !userView())) ? "Recent" : userView() ? "Start with" : "Ready now"));
    for (const m of shown) out.push(link(m, " ready-link"));
    if (ready.length > READY_MAX) out.push(ui.h("a", { href: userView() ? "#/overview/pages" : "#/overview/pages/ready", class: "nav-link ready-link nav-more" }, ui.h("span", { class: "ic" }, ""), ui.h("span", {}, userView() ? `All ${ready.length} pages ›` : `All ${ready.length} ready pages ›`)));
    // The hide/show toggle sits on the topics header, not at the bottom of 18 topics.
    // (the household's view has no "coming soon" pages to hide: the toggle is for the build view)
    const toggle = userView() ? null : ui.h("button", { type: "button", class: "nav-soon-toggle", onClick: () => { nav.showSoon = !nav.showSoon; saveNav(); buildNav(); } }, nav.showSoon ? "Hide coming soon" : "Show coming soon");
    out.push(ui.h("div", { class: "nav-section nav-section-row" }, ui.h("span", {}, "By topic"), toggle));
  }
  const groups = [];
  for (const g of GROUPS) {
    let pages = pagesInGroup(g.id).map((m) => ({ m, r: rank(m, g) })).filter((x) => x.r >= 0);
    if (!nav.showSoon && !q && !userView()) pages = pages.filter((x) => isReady(x.m));
    if (!pages.length) continue;
    if (q) pages.sort((a, b) => a.r - b.r);
    groups.push({ g, pages: pages.map((x) => x.m), best: Math.min(...pages.map((x) => x.r)), hits: pages.length, named: q && hasWords(g.title, q) ? 0 : 1, total: pagesInGroup(g.id).length });
  }
  if (q) groups.sort((a, b) => a.best - b.best || a.named - b.named || b.hits - a.hits);
  for (const { g, pages, total } of groups) {
    const readyN = pages.filter(isReady).length;
    const open = q ? true : !!nav.open[g.id];
    const grp = ui.h("div", { class: `nav-group${open ? " open" : ""}` });
    const count = userView() ? `${pages.length}` : q ? (readyN ? `${readyN} ready` : `${pages.length} soon`) : (readyN ? `${readyN} of ${total} ready` : `${pages.length} soon`);
    // a topic says whether it is open (a screen reader hears "expanded"); the chevron is a picture
    const head = ui.h("button", { type: "button", class: "nav-group-head", "aria-expanded": String(open), onClick: () => { nav.open[g.id] = !grp.classList.contains("open"); saveNav(); grp.classList.toggle("open"); head.setAttribute("aria-expanded", String(grp.classList.contains("open"))); } },
      ui.h("span", { class: "ic" }, g.icon), ui.h("span", { class: "t" }, g.title),
      ui.h("span", { class: "n" }, count), ui.h("span", { class: "chev", "aria-hidden": "true" }, "▶"));
    grp.append(head, ui.h("div", { class: "nav-group-body" }, pages.map((m) => link(m))));
    out.push(grp);
  }
  let closest = false;
  if (q && !groups.length) {
    // no page has every word: the closest few (two or more meaningful words, at least half of them found), ready pages first
    if (queryWords(cleanQuery(q, ignore)).length >= 2) {
      const close = [...modules.values()].filter((m) => features.enabled(m) && isReady(m) && isShown(m))
        .map((m) => ({ m, s: closeShare(m, GROUPS.find((g) => g.id === m.group)?.title ?? "", q, { ignore }) })).filter((x) => x.s >= 0.5)
        .sort((a, b) => b.s - a.s || (a.m.order ?? 100) - (b.m.order ?? 100)).slice(0, 5);
      if (close.length) { out.push(ui.h("div", { class: "nav-section" }, "Closest pages")); for (const { m } of close) out.push(link(m, " ready-link")); }
      closest = close.length > 0;
    }
    out.push(ui.h("div", { class: "nav-empty", role: "status" }, ui.h("div", {}, closest ? `No page has every word of “${filter.trim()}”.` : `No page matches “${filter.trim()}”.`),
      ui.h("div", {}, "Try another word, or ", ui.h("a", { href: "#/overview/pages" }, "browse All pages"), ".")));
  }
  if (!userView()) out.push(ui.h("div", { class: "nav-foot" }, ui.h("div", {}, `${[...modules.values()].filter(isReady).length} of ${modules.size} pages ready`)));
  list.replaceChildren(...out);
  navStale = false;
  markActive();
}
/**
 * The menu's first row, under Find a page, "Hide amounts" / "Show amounts": two taps from any page, with no scrolling (core/look.js; the same choice as the tick
 * in Settings > Screen). On this phone only, never the plan. On a phone the menu closes, so the page is
 * seen with its amounts as dots, and the bottom note says so in green; nothing is drawn again but Settings' own tick.
 */
function hideRow() {
  const on = look.now.hide;
  const tap = () => {
    look.set({ hide: !on });
    navStale = true;
    if (phoneNav()) closeDrawer(); else buildNav();
    if (current && `${current.group}/${current.id}` === "system/settings") show(current, { keepScroll: true });
    echo(on ? HIDE_WORDS.off : HIDE_WORDS.on);
  };
  return ui.h("div", { class: "nav-look" }, ui.h("button", { type: "button", class: "nav-look-btn", dataset: { look: "hide" }, onClick: tap },
    ui.h("span", { class: "ic", "aria-hidden": "true" }, on ? "👁" : "🙈"), ui.h("span", { class: "t" }, on ? "Show amounts" : "Hide amounts")));
}
function markActive() {
  for (const a of document.querySelectorAll("#sidebar .nav-link")) {
    const on = !!current && a.dataset.key === `${current.group}/${current.id}`;
    a.classList.toggle("active", on);
    if (on) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  }
}
function setToggleIcon(open) {
  const b = document.getElementById("nav-toggle");
  if (!b) return;
  b.textContent = open ? "✕" : "☰";
  b.setAttribute("aria-label", open ? "Close menu" : "Menu"); b.title = open ? "Close menu" : "Menu";
}
/** The menu closes (the cross, the dim side, Escape, a new page). `toButton`: the focus goes back to the menu button. */
function closeDrawer({ toButton = false } = {}) {
  const wasOpen = drawerIsOpen();
  if (wasOpen) paintDrawer(false);
  const release = releaseDrawer; releaseDrawer = null;
  release?.();   // steps off the menu's entry in the history (nothing when the router already closed it)
  if (wasOpen && toButton) { try { $("nav-toggle").focus({ preventScroll: true }); } catch { } }
}
function openSearch() {   // ctx.openSearch(): the menu with the cursor in its search box (on a phone the drawer opens)
  if (phoneNav() && !drawerIsOpen()) openDrawer();
  $("sidebar").querySelector(".nav-search")?.focus();
}
function toggleDrawer() { if (drawerIsOpen()) closeDrawer({ toButton: true }); else openDrawer(); }
// wave 1 (taps): the drawer on a phone. The open menu is one step of the phone's Back (core/router.js layer: Back closes
// it and stays on the page); Escape closes it too; while it is open the page behind takes no taps, keys or swipes, and a
// page chosen in it takes the menu's place in the history, so Back from that page returns to the page it was opened on.
const phoneNav = () => !matchMedia("(min-width: 960px)").matches;
const drawerIsOpen = () => !!$("sidebar")?.classList.contains("open");
let releaseDrawer = null;           // the menu's step of the phone's Back: called when the menu closes itself
function paintDrawer(open) {
  $("sidebar").classList.toggle("open", open); $("scrim").classList.toggle("show", open); setToggleIcon(open);
  $("nav-toggle")?.setAttribute("aria-expanded", String(open));
  const cover = open && phoneNav();
  document.documentElement.classList.toggle("drawer-open", cover);
  for (const id of ["content", "sync-bar", "demo-bar"]) { const el = $(id); if (el) el.inert = cover; }
  if (cover) document.querySelector(".save-echo")?.remove();   // the bottom copy of a save never sits over the open menu
  updateBack();
}
function openDrawer() {
  if (drawerIsOpen()) return;
  if (navStale) buildNav();
  paintDrawer(true);
  if (!phoneNav()) return;
  releaseDrawer = typeof router.layer === "function" ? router.layer(() => { releaseDrawer = null; paintDrawer(false); }) : null;
  focusQuietly($("sidebar"));   // the next Tab is Find a page; a screen reader is in the menu; no keyboard pops up
}
/** A page picked in the menu (a row, Go in Find a page, the pill): opened as the menu's own pick ("via menu"). */
function openFromMenu(href) {
  if (href === location.hash) { closeDrawer(); return; }   // the page already shown: just close the menu
  if (typeof router.open === "function") router.open(href, { via: "menu" }); else location.hash = href;
}

// wave 1 (taps): the "‹" in the top bar, the phone's Back on screen. The history's entries are numbered by core/router.js
// (the place track); this is the one place that reads them.
const keyOf = (href) => { const h = String(href ?? ""); const i = h.indexOf("#"); const r = router.parse(i < 0 ? h : h.slice(i)); return `${r.group}/${r.id}`; };
/** The entry on screen: { n, first, prevKey, via } (null before the router numbers entries). */
function entryNow() {
  const e = typeof router.entry === "function" ? router.entry() : null;
  if (!e) return null;
  const me = router.at?.(e.n) ?? null;
  const prev = me?.p !== null && me?.p !== undefined ? router.at(me.p) : null;
  return { n: e.n, first: e.first, prevKey: prev?.href ? keyOf(prev.href) : null, via: me?.via ?? null };
}
// pages that draw their own "‹" at the top and lead the way back themselves: the questions of Set up my plan
// (#/overview/setup/<question>); its first screen ("Let's build your plan") and its last draw none, so they keep the bar's
// "‹" (topways x-5: the first screen had no way back at all)
const OWN_BACK = new Set(["overview/setup"]);
const ownBack = (key, route) => OWN_BACK.has(key) && !!route?.rest?.length && !["welcome", "done"].includes(route.rest[0]);
function updateBack() {
  const b = $("nav-back");
  if (!b) return;
  const e = entryNow();
  const here = current ? `${current.group}/${current.id}` : "";
  let len = 2; try { len = history.length; } catch { }
  const can = !!e && e.n > e.first && len > 1 && !ownBack(here, current);
  b.hidden = !can;
  b.classList.toggle("covered", can && drawerIsOpen() && phoneNav());   // kept in its place while the menu is open, so the name does not jump
  if (!can) return;
  // its spoken name says where it goes: the page's own "‹ Back to ..." row for that page, else the page before
  const prev = e.prevKey && e.prevKey !== here ? e.prevKey : null;
  const row = prev ? [...($("content")?.querySelectorAll("nav.gb-compact a[data-back]") ?? [])].find((a) => keyOf(a.getAttribute("href")) === prev) : null;
  const own = row?.textContent.replace(/^‹\s*/, "").replace(/\s+/g, " ").trim();
  const words = own ? (/^back\b/i.test(own) ? own : `Back to ${own.charAt(0).toLowerCase()}${own.slice(1)}`) : prev && modules.get(prev) ? `Back to ${modules.get(prev).title}` : "Back";
  b.setAttribute("aria-label", words); b.title = words;
}

// wave 1 (taps): focus and read-outs
/** After a new page the focus is at the top of the page (the next Tab is its first control, a screen reader hears its name), unless the page put it on its own heading. */
function landFocus(root) {
  const a = document.activeElement;
  if (a && a !== document.body && root.contains(a)) return;
  focusQuietly(root);
}
/** Focus an element that is not a control (the page, the menu) for this moment only: a later tap on its text does not focus it. */
function focusQuietly(el) {
  if (!el) return;
  if (!el.hasAttribute("tabindex")) { el.setAttribute("tabindex", "-1"); el.addEventListener("blur", () => el.removeAttribute("tabindex"), { once: true }); }
  try { el.focus({ preventScroll: true }); } catch { }
}
/** A notice's words as a screen reader should hear them (its buttons and links left out). */
const noticeWords = (n) => { const c = n.cloneNode(true); c.querySelectorAll("a, button, .notice-actions").forEach((x) => x.remove()); return c.textContent.replace(/\s+/g, " ").trim(); };
/** After a save: this save's green lines are read out once (a red one is read by the form kit: role="alert"). */
function announceFresh(fresh) {
  const ok = fresh.filter((n) => n.isConnected && n.classList.contains("ok"));
  if (ok.length) announce(ok.map(noticeWords).join(" "));
}

// wave 1 (taps): paint first. A new page's name, the closed menu and the frame's top row are on the screen one frame
// before the page is worked out, so a tap answers at once even on a slow page.
/** Resolves after the browser has painted what is on the screen now (one frame, then a task). */
const afterPaint = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
let busyN = 0;   // calculations still being worked out (#content says aria-busy meanwhile)
const busy = (d) => { busyN = Math.max(0, busyN + d); $("content")?.setAttribute("aria-busy", String(busyN > 0)); };
/** A page known to be slow (m.heavy): one painted frame that says "Working it out…" in the empty page (and to a screen
 * reader); false when another page took over meanwhile. A quicker page holds the page before instead (show()). */
async function paintFirst(page, m, seq) {
  const wait = ui.h("p", { class: "muted", role: "status" }, "Working it out…");
  wait.style.margin = "24px 4px";
  page.append(wait);
  const lift = topbarH() + 24 - wait.getBoundingClientRect().top;   // Back to a place further down: the words where the person looks
  if (lift > 0) wait.style.marginTop = `${24 + Math.round(lift)}px`;
  busy(1);
  try { await afterPaint(); } finally { busy(-1); }
  if (seq !== renderSeq) return false;
  wait.remove();
  return true;
}

// wave 1 (taps): an address that names no page (core/address.js) gets a plain card instead of the Dashboard
let onAgain = null;                 // "Emergency fund is on again.", shown at the top of the page it opens
function missingCard(miss) {
  if (miss.kind === "off") {
    const m = modules.get(miss.key);
    // switched off in Settings › Pages here can be turned on here; switched off in the computer's settings cannot
    const here = miss.by === "device";
    return ui.h("section", { class: "card" }, ui.h("h1", {}, `${m.title} is switched off`),
      ui.h("p", {}, here ? "It is switched off in Settings › Pages, so it is not in the menu." : "It is switched off in the settings on your computer, so it is not in the menu."),
      ui.h("div", { class: "row" },
        here ? ui.button("Turn it back on", () => { onAgain = `${m.title} is on again.`; features.set(miss.key, true); if (current) show(current); }) : null,
        ui.h("a", { class: here ? "btn secondary" : "btn", href: "#/overview/dashboard" }, "Go to the Dashboard")));
  }
  const pages = miss.group ? pagesInGroup(miss.group.id).filter(isReady).slice(0, 8) : [];
  return ui.h("section", { class: "card" }, ui.h("h1", {}, "Page not found"),
    ui.h("p", {}, "This link leads to a page that is not in the app."),
    pages.length ? ui.h("div", {}, ui.h("p", { class: "muted" }, `Pages about ${miss.group.title}:`),
      ui.h("ul", { class: "page-list" }, pages.map((m) => ui.h("li", {}, ui.h("a", { class: "row-link", href: `#/${m.group}/${m.id}` },
        ui.h("span", { class: "ic ic-sm" }, m.icon ?? miss.group.icon), ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, m.title))))))) : null,
    ui.h("div", { class: "row" }, ui.button("Find a page", () => openSearch()), ui.h("a", { class: "btn secondary", href: "#/overview/dashboard" }, "Go to the Dashboard")));
}

// ---------------------------------------------------------------- pages
function safeCompute(m, plan, params) {
  if (typeof m.compute !== "function") return null;
  try { return m.compute(plan, params ?? {}); } catch (e) { console.error(`[planner] compute failed in ${m.group}/${m.id}`, e); return { error: String(e) }; }
}
/**
 * ctx.announce(text): read a confirmation out to screen readers (one live region outside #content, which is rebuilt on
 * every render). Each thing is said once: the same words again within 2 seconds, or words that were part of what was read
 * within 2 seconds, are not repeated, and words the focus already sits on (a notice the shell focused) are not read twice.
 */
let said = { text: "", at: -1e9 };
function announce(text) {
  const words = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!words) return;
  const now = performance.now();
  // the same words, or words that were part of what was just read (a save's green lines, then the bottom note that
  // repeats one of them: tapmenu K5), are not read again within 2 s
  if (now - said.at < 2000 && said.text.includes(words)) return;
  said = { text: words, at: now };
  const el = document.getElementById("announce");
  if (!el) return;
  el.textContent = "";
  setTimeout(() => {
    const f = document.activeElement;
    const holder = f && f !== document.body && !["content", "sidebar"].includes(f.id) ? f : null;
    if (holder && String(holder.textContent ?? "").replace(/\s+/g, " ").includes(words)) return;
    el.textContent = words;
  }, 60);
}
function makeCtx(route, seq = renderSeq) {
  const plan = store.get();
  return {
    route, plan, store, api, ai, ui, fmt, features, modules, GROUPS, isReady,
    view, live: reach, shown: isShown,   // the household's view and what answers (core/view.js); pages follow them, see docs/CONVENTIONS.md "View"
    computeOf: (key, params) => { const m = modules.get(key); return m ? safeCompute(m, store.get(), params) : null; },
    computeRemote: async (key, params) => {
      const m = modules.get(key); if (!m) return null;
      busy(1);   // #content says aria-busy while a page's own answer is worked out
      try {
        // the PC works on this device's plan, sent along: its own copy may not have the latest change yet
        if (m.heavy && store.backend() === "server") { try { const r = await api.compute(key, params, store.get()); taps.drawn(); return r; } catch (e) { console.warn("[planner] remote compute failed, running locally", e); } }
        await afterPaint();   // the page's own "Working it out..." words are on the screen first
        if (seq !== renderSeq) return new Promise(() => { });   // the page was left (or drawn again) meanwhile: nothing waits for this answer
        const r = safeCompute(m, store.get(), params);
        taps.drawn();   // a tap made while this was worked out was aimed at the screen before it: the guard drops it
        return r;
      } finally { busy(-1); }
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
    // wave 1 (taps): the page this one was opened from, when the phone's Back returns to it ({ key, menu: picked in the
    // menu }), or null; and an address that replaces this one (the entry keeps its place in the history)
    cameFrom: () => { const e = entryNow(); return e?.prevKey ? { key: e.prevKey, menu: e.via === "menu" } : null; },
    replace: (href) => (typeof router.replace === "function" ? router.replace(href) : location.replace(href)),
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
  // wave 1 (taps): an address in the wrong case is the page it names; one that names no page (or a page this view does
  // not offer, or one switched off) gets a card that says so (core/address.js); a page that only waits for your computer
  // still opens and says so itself
  const fixed = fixCase(route, (k) => modules.has(k));
  if (fixed) { route = fixed; try { history.replaceState({ ...(history.state ?? {}) }, "", router.href(route.group, route.id, route.rest, route.query)); } catch { } }
  const miss = missing(route, { modules, groups: GROUPS, userView: userView(), enabled: (x) => features.enabled(x), offered: isShown, sourceOf: (x) => features.sourceOf(x), ready: isReady });
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
  detail.init(ui);   // Settings > How much to show, on this phone: the forms tick opens the kit's "More details (optional)" (docs/OPTIONAL.md)
  const keepY = keepScroll ? window.scrollY : rec ? rec.y : 0;
  const noticesBefore = keepScroll ? new Set([...root.querySelectorAll(".notice.ok, .notice.error")].map((n) => n.textContent)) : null;
  root.style.minHeight = keepScroll ? `${root.offsetHeight}px` : rec ? `${rec.y + window.innerHeight}px` : "";   // room while the page draws (place.hold lets it go)
  if (!keepScroll) place.releaseFocus(root);   // a new page: the box with the cursor goes quietly (its typing is written down)
  // a page that is not known to be slow: the page before stays on the screen, inert, under the new name and the closed
  // menu for the frame that paints them, and goes as this page draws (no blank page between two pages; tapmenu new
  // problem 2). A slow page clears at once and says "Working it out…" (paintFirst).
  const held = !keepScroll && m && !m.heavy && !miss && !tooNew(store.get()) ? [...root.childNodes] : [];
  if (held.length) for (const n of held) { if (n.nodeType === 1) { n.inert = true; n.setAttribute("aria-hidden", "true"); } }
  else root.innerHTML = "";
  const title = miss ? (miss.kind === "off" ? modules.get(miss.key).title : "Page not found") : m ? m.title : "Planner";
  document.getElementById("page-title").textContent = title;
  document.title = `${title} - Planner`;
  root.setAttribute("aria-label", title);   // the page is a named region: a screen reader landing on it hears the name
  // a new page starts the menu afresh: the word searched for the last page is gone (B8)
  const word = document.querySelector("#sidebar > .nav-search");
  if (!keepScroll && word?.value) { word.value = ""; navStale = true; }
  if (!miss && m && isReady(m)) {   // remember for the drawer's "Recent" list
    const key = `${m.group}/${m.id}`;
    if (nav.recent?.[0] !== key) { nav.recent = [key, ...(nav.recent ?? []).filter((k) => k !== key)].slice(0, 12); saveNav(); navStale = true; }
  }
  if (navStale && !phoneNav()) buildNav();   // a wide screen shows the menu all the time; a phone draws it when it opens, never while it closes under the finger
  updateBack();
  markActive();
  if (!keepScroll) closeDrawer();
  if (!held.length) place.scrollTo(0, keepY);   // the page held on the screen stays where it is until it goes
  if (!m) { root.append(ui.notice("error", "No modules are registered. Run `npm run registry`.")); return; }
  // an older app (a saved copy, another tab) never edits a plan a newer one saved: the words and a Reload button, no page
  // (no room is borrowed for it and it is shown from the top: Back, a reload or a redraw must not leave it off the screen)
  if (tooNew(store.get())) { root.style.minHeight = ""; place.scrollTo(0, 0); root.append(failNotice(NEWER_PLAN_WORDS, [`The plan is version ${store.get().schemaVersion}; this app reads up to version ${SCHEMA_VERSION}.`])); showPill(); taps.drawn(); if (!keepScroll) landFocus(root); return; }
  if (miss) { root.style.minHeight = ""; window.scrollTo(0, 0); root.append(missingCard(miss)); taps.drawn(); if (!keepScroll) landFocus(root); return; }
  // Plain words first; the technical list sits behind a tap (design log 2026-09-15). Shown only when the one reload
  // at boot did not mend it (boot() below).
  if (broken.length) root.append(failNotice(brokenWords(broken.length, servedByPc()), broken));
  const ctx = makeCtx(route, seq);
  if (onAgain) { if (!keepScroll) { root.append(ui.notice("ok", onAgain)); announce(onAgain); } onAgain = null; }   // a page just turned back on (its card)
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
  { let got = false, val = null; Object.defineProperty(ctx, "derived", { configurable: true, enumerable: true, get: () => { if (!got) { got = true; val = safeCompute(m, ctx.plan); } return val; }, set: (v) => { got = true; val = v; } }); }   // worked out when the page reads it (8 pages do)
  // a new address: its name and the closed menu are painted before the page is worked out
  if (held.length) {
    await afterPaint();
    if (seq !== renderSeq) return;   // a newer page took over (it holds or clears what is here)
    for (const n of held) n.remove();
    place.scrollTo(0, keepY);
  } else if (!keepScroll && m.heavy && !(await paintFirst(page, m, seq))) return;
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
  taps.drawn(); if (!keepScroll) landFocus(root); updateBack();   // from here a tap is aimed at this screen; a new page: the focus at its top
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
    announceFresh(fresh);   // this save's green lines, read out once (seams I5)
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
  showDemoBar(store);   // a pretend family on screen (?sandbox=1&demo=...): the line under the top bar, with the way out
  // just left one ("Leave"): the first page says so in a green line, where the eye is (shown by show(), as onAgain is)
  if (!store.sandbox() && takeLeft()) { const p = store.get(); onAgain = leftWords(!!(p.accounts?.length || p.income?.length || p.expenses?.length || p.household?.people?.length)); }
  reach.set({ pc: store.backend() === "server" });   // the PC is known after the plan loads; the AI helper's answer follows (refreshStatus)
  buildNav();
  const live = document.createElement("div");   // ctx.announce()'s live region, visually hidden
  live.id = "announce"; live.setAttribute("aria-live", "polite");
  Object.assign(live.style, { position: "absolute", width: "1px", height: "1px", overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap" });
  document.body.append(live);
  document.getElementById("nav-toggle").addEventListener("click", toggleDrawer);
  document.getElementById("scrim").addEventListener("click", () => closeDrawer());
  document.getElementById("status").addEventListener("click", () => openFromMenu(router.href("system", "settings")));
  // wave 1 (taps): a row of the open menu (and its "browse All pages" link) is the menu's pick; Escape closes the menu;
  // "Skip to the page" (the first Tab stop); the top bar's "‹" is the phone's Back
  $("sidebar").addEventListener("click", (e) => {
    const a = e.target.closest?.('a[href^="#/"]');
    if (!a || e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault(); openFromMenu(a.getAttribute("href"));
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && drawerIsOpen() && phoneNav() && !e.defaultPrevented) { e.preventDefault(); closeDrawer({ toButton: true }); } });
  document.querySelector("#topbar .nav-skip")?.addEventListener("click", () => focusQuietly($("content")));
  $("nav-back")?.addEventListener("click", () => { const e = entryNow(); if (e && e.n > e.first) history.back(); });
  store.subscribe(() => { planRev++; });   // first, before the redraw below: the guard knows the plan changed
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
  const follow = () => { buildNav(); if (current && !typing()) show(current, { keepScroll: true }); };
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

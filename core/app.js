// core/app.js -- boots the shell: loads every module in modules/registry.js, builds the
// sidebar (search, "Ready now", collapsible groups), routes #/group/id to a module's
// render(), and keeps the status pill fresh.
//
// Modules never import this file. They get everything through the `ctx` object passed to
// render() and compute() -- see docs/CONVENTIONS.md "The ctx object".
import { GROUPS } from "./groups.js";
import registry from "../modules/registry.js";
import { store } from "./store.js";
import { api } from "./api.js";
import { ai } from "./ai.js";
import { router } from "./router.js";
import { features } from "./features.js";
import * as ui from "./ui/dom.js";
import * as fmt from "./format.js";
import { matchRank, closeShare, cleanQuery, words as queryWords } from "./search.js";
import { estimate, settle, mergeEstimators, guessesTouching } from "./estimate/index.js";

const modules = new Map();          // "group/id" -> manifest
const broken = [];                  // modules that failed to import (shown on the dashboard)
let cleanup = null;                 // the current page's cleanup function
let current = null;                 // current route
let renderSeq = 0;                  // a newer show() wins over a slow one still rendering
let rerender = null;                // the re-render a store update schedules (show() cancels it: it would be redundant)
const NAV_KEY = "planner.nav";      // { open: {groupId: bool}, showSoon: bool }
const nav = (() => { try { return { open: {}, showSoon: true, ...JSON.parse(localStorage.getItem(NAV_KEY) || "{}") }; } catch { return { open: {}, showSoon: true }; } })();
const saveNav = () => { try { localStorage.setItem(NAV_KEY, JSON.stringify(nav)); } catch { } };
// Guesses (docs/CONVENTIONS.md "Guesses"): every loaded manifest's `estimators` and `guessTables`, merged once at boot
// whatever the per-device page toggles, so a guess keeps following the answers even when its page is switched off.
let GUESS = { estimators: {}, tables: {}, weights: {} };
let moved = 0;                      // how many guesses the last save moved (store.takeSettled), said once with its notice
export const isReady = (m) => m.status !== "planned";

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
  return [...modules.values()].filter((m) => m.group === groupId && features.enabled(m)).sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
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
    const ready = [...modules.values()].filter((m) => isReady(m) && features.enabled(m)).sort((a, b) => GROUPS.findIndex((g) => g.id === a.group) - GROUPS.findIndex((g) => g.id === b.group) || (a.order ?? 100) - (b.order ?? 100));
    // "Recent": the 8 ready pages opened last on this device, Dashboard always first; before
    // anything has been opened, the first ready pages in topic order (design log 2026-09-15, pass 2).
    const READY_MAX = 8;
    const recent = (nav.recent ?? []).map((k) => modules.get(k)).filter((m) => m && isReady(m) && features.enabled(m));
    const dash = modules.get("overview/dashboard");
    const shown = [];
    for (const m of [dash, ...recent, ...ready]) if (m && !shown.includes(m) && shown.length < READY_MAX) shown.push(m);
    side.append(ui.h("div", { class: "nav-section" }, recent.length ? "Recent" : "Ready now"));
    for (const m of shown) side.append(link(m, " ready-link"));
    if (ready.length > READY_MAX) side.append(ui.h("a", { href: "#/overview/pages/ready", class: "nav-link ready-link nav-more" }, ui.h("span", { class: "ic" }, ""), ui.h("span", {}, `All ${ready.length} ready pages ›`)));
    // The hide/show toggle sits on the topics header, not at the bottom of 18 topics.
    const toggle = ui.h("button", { type: "button", class: "nav-soon-toggle", onClick: () => { nav.showSoon = !nav.showSoon; saveNav(); buildNav(); } }, nav.showSoon ? "Hide coming soon" : "Show coming soon");
    side.append(ui.h("div", { class: "nav-section nav-section-row" }, ui.h("span", {}, "By topic"), toggle));
  }
  const groups = [];
  for (const g of GROUPS) {
    let pages = pagesInGroup(g.id).map((m) => ({ m, r: rank(m, g) })).filter((x) => x.r >= 0);
    if (!nav.showSoon && !q) pages = pages.filter((x) => isReady(x.m));
    if (!pages.length) continue;
    if (q) pages.sort((a, b) => a.r - b.r);
    groups.push({ g, pages: pages.map((x) => x.m), best: Math.min(...pages.map((x) => x.r)), hits: pages.length, named: q && g.title.toLowerCase().includes(q) ? 0 : 1, total: pagesInGroup(g.id).length });
  }
  if (q) groups.sort((a, b) => a.best - b.best || a.named - b.named || b.hits - a.hits);
  for (const { g, pages, total } of groups) {
    const readyN = pages.filter(isReady).length;
    const open = q ? true : !!nav.open[g.id];
    const grp = ui.h("div", { class: `nav-group${open ? " open" : ""}` });
    const count = q ? (readyN ? `${readyN} ready` : `${pages.length} soon`) : (readyN ? `${readyN} of ${total} ready` : `${pages.length} soon`);
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
      const close = [...modules.values()].filter((m) => features.enabled(m) && isReady(m))
        .map((m) => ({ m, s: closeShare(m, GROUPS.find((g) => g.id === m.group)?.title ?? "", q, { ignore }) })).filter((x) => x.s >= 0.5)
        .sort((a, b) => b.s - a.s || (a.m.order ?? 100) - (b.m.order ?? 100)).slice(0, 5);
      if (close.length) { side.append(ui.h("div", { class: "nav-section" }, "Closest pages")); for (const { m } of close) side.append(link(m, " ready-link")); }
      closest = close.length > 0;
    }
    side.append(ui.h("div", { class: "nav-empty" }, ui.h("div", {}, closest ? `No page has every word of “${filter.trim()}”.` : `No page matches “${filter.trim()}”.`),
      ui.h("div", {}, "Try another word, or ", ui.h("a", { href: "#/overview/pages" }, "browse All pages"), ".")));
  }
  side.append(ui.h("div", { class: "nav-foot" }, ui.h("div", {}, `${[...modules.values()].filter(isReady).length} of ${modules.size} pages ready`)));
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
    computeOf: (key, params) => { const m = modules.get(key); return m ? safeCompute(m, store.get(), params) : null; },
    computeRemote: async (key, params) => {
      const m = modules.get(key); if (!m) return null;
      // the PC works on this device's plan, sent along: its own copy may not have the latest change yet
      if (m.heavy && store.backend() === "server") { try { return await api.compute(key, params, store.get()); } catch (e) { console.warn("[planner] remote compute failed, running locally", e); } }
      return safeCompute(m, store.get(), params);
    },
    go: (group, id, rest, query) => router.go(group, id, rest, query),
    // our guess for one field: an Estimate (value, why, ...) or null; opts: { path, rec, args } (core/estimate estimate)
    guess: (key, opts = {}) => { try { return estimate(store.get(), key, { estimators: GUESS.estimators, tables: GUESS.tables, today: fmt.today(), ...opts }); } catch (e) { console.error(`[planner] guess ${key} failed`, e); return null; } },
    openSearch,
    announce,
  };
}
/**
 * Draw a page. A new address starts at the top. The redraw after a save (store.update, an adopted plan) passes
 * keepScroll: the screen stays where it was (the old height is held while the page redraws, so nothing collapses)
 * and a page that scrolls itself while drawing still wins. When the green "Saved." (or red error) the save produced
 * sits off screen, a short copy of it shows at the bottom for a few seconds, so you keep your place AND see it.
 */
async function show(route, { keepScroll = false } = {}) {
  clearTimeout(rerender);
  const seq = ++renderSeq;
  current = route;
  let m = modules.get(`${route.group}/${route.id}`);
  if (!m || !features.enabled(m)) m = modules.get("overview/dashboard") ?? [...modules.values()][0];
  if (cleanup) { try { cleanup(); } catch (e) { console.warn(e); } cleanup = null; }
  const root = document.getElementById("content");
  ui.setMoneySign(currencySign(store.get()?.meta?.currency));
  const keepY = keepScroll ? window.scrollY : 0;
  const noticesBefore = keepScroll ? new Set([...root.querySelectorAll(".notice.ok, .notice.error")].map((n) => n.textContent)) : null;
  if (keepScroll) root.style.minHeight = `${root.offsetHeight}px`;
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
  window.scrollTo(0, keepY);
  if (!m) { root.append(ui.notice("error", "No modules are registered. Run `npm run registry`.")); return; }
  if (broken.length) {
    // Plain words first; the technical list sits behind a tap (design log 2026-09-15).
    const n = broken.length;
    root.append(ui.h("div", { class: "notice error" },
      ui.h("div", {}, `${n === 1 ? "One page" : `${n} pages`} could not load right now. Reload the page; if it keeps happening, restart the app on the PC.`),
      ui.h("details", { class: "notice-details" }, ui.h("summary", {}, "Show details"), ui.h("ul", {}, broken.map((b) => ui.h("li", {}, b))))));
  }
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
  try { c = (await m.render(page, ctx)) ?? null; }
  catch (e) { console.error(e); page.append(ui.notice("error", `This page failed to render: ${e}`)); }
  if (seq !== renderSeq) { try { c?.(); } catch { } return; }   // a newer page took over while this one rendered
  cleanup = c;
  if (frame?.after) root.append(frame.after);
  if (keepScroll) {
    const pageScrolled = Math.abs(window.scrollY - keepY) > 2;
    root.style.minHeight = "";
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
    const inView = (n) => { const r = n.getBoundingClientRect(); return r.bottom > topbarH() && r.top < window.innerHeight; };
    if (!pageScrolled && fresh.length && !fresh.some(inView)) {
      const words = fresh[0].cloneNode(true); words.querySelectorAll("a, button").forEach((x) => x.remove());
      echo(words.textContent.trim(), fresh[0].classList.contains("error"));
    }
  } else { lastFresh = new Set(); moved = 0; }   // a new page: an earlier save's moved guesses are old news
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
/** A short note at the bottom of the screen (a save's off-screen confirmation); it never takes a tap and leaves by itself. */
function echo(text, bad = false) {
  document.querySelector(".save-echo")?.remove();
  const el = ui.h("div", { class: `save-echo ${bad ? "bad" : "ok"}`, role: "status" }, ui.h("span", { class: "save-echo-mark", "aria-hidden": "true" }, bad ? "!" : "✓"), ui.h("span", {}, text));
  document.body.append(el);
  setTimeout(() => el.classList.add("leaving"), bad ? 6000 : 3200);
  setTimeout(() => el.remove(), bad ? 6400 : 3600);
}

let aiState = "off";
async function refreshStatus() {
  // the sandbox never reaches out: no AI check (the pill says Sandbox and does not name the AI)
  if (!store.sandbox()) { try { aiState = await ai.status(); } catch { aiState = "off"; } }
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
  const { late, conflict } = store.syncState();   // a save on its way for a moment still reads Saved on PC (no flicker)
  const onPc = server && !late && !conflict;
  el.textContent = onPc ? "Saved on PC" : "Phone only";
  el.className = onPc ? "ok" : "warn";
  el.title = (conflict ? "Your plan was changed in two places: choose which version to keep, at the top of the page"
    : late ? "Your latest changes are saved on this device only. They go to the PC by themselves as soon as it can be reached"
    : server ? `Your plan is saved on the PC (${api.base()})` : "The PC cannot be reached: your plan is saved in this browser only") + `. AI: ${aiState}. Tap for settings.`;
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
      : ui.h("p", {}, `This device has changes (last at ${when(conflict.mineAt)}) that the PC does not have, and the PC's copy was changed on another device (${when(conflict.theirsAt)}). Nothing has been overwritten. Which version do you want to keep?`),
    ui.h("div", { class: "row" },
      ui.button(conflict.from === "tab" ? "Keep this window's version" : "Keep this device's version", () => { const tab = store.syncState().conflict?.from === "tab"; store.resolve("mine"); echo(tab ? "Kept this window's version." : "Kept this device's version. The PC's earlier copy is in its backups."); }),
      ui.button(conflict.from === "tab" ? "Use the other window's version" : "Use the PC's version", () => { const tab = store.syncState().conflict?.from === "tab"; if (ui.confirm(tab ? "Use the other window's version? The changes made in this window will be dropped." : "Use the PC's version? The changes made on this device will be dropped.")) { store.resolve("theirs"); echo(tab ? "Now showing the other window's version." : "Now showing the PC's version."); } }, { class: "secondary" })),
    ui.h("p", { class: "muted small" }, `This screen shows this ${conflict.from === "tab" ? "window" : "device"}'s version until you choose.`)));
  // a choice that matters: bring it into view once, unless someone is typing (it waits at the top for them)
  const typingNow = (() => { const a = document.activeElement; return !!a?.closest?.("#content") && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName); })();
  if (fresh && !typingNow) { document.querySelector(".save-echo")?.remove(); window.scrollTo(0, 0); }
}
let toldFull = false;
function onSync() {
  const { conflict, localFull, late } = store.syncState();
  if (store.takeSent() && !conflict) echo("Your changes are now saved on the PC.");
  // the browser's storage is full and the PC cannot take the change either: say so once, in plain words
  if (localFull && late && !toldFull) { toldFull = true; echo("This device is out of space for your plan, so the latest change is only on screen. Connect to your PC before closing the app.", true); }
  if (!localFull) toldFull = false;
  // a change marked as waiting was not on this device at open (it did not fit, or this device's copy was erased)
  if (store.takeLost()) echo("Your last change on this device could not be found when the app opened, so it did not reach the PC. Please check it and enter it again if it is missing.", true);
  showPill(); showConflict();
}

async function boot() {
  await loadModules();
  // untouched guesses follow each change inside store.update (never on load, adopt, replace, resolve or another tab's save)
  store.settleWith((draft) => settle(draft, { estimators: GUESS.estimators, tables: GUESS.tables, today: fmt.today() }));
  await features.init();
  await store.load();
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
  addEventListener("planner:connection", () => { store.reconnect().then(() => { refreshStatus(); onSync(); if (current) show(current, { keepScroll: true }); }); });
  // First visit (an empty plan, "look around" never chosen) or a guide still followed before any account: an address
  // that names no page opens Get started instead of the dashboard. Any address naming a page always wins.
  const sm = modules.get("overview/start");
  if (sm && isReady(sm) && features.enabled(sm) && /^#?\/?$/.test(location.hash) && safeCompute(sm, store.get(), { today: fmt.today() })?.opensHere) history.replaceState(null, "", "#/overview/start");
  router.start(show);
  refreshStatus();
  setInterval(refreshStatus, 30000);
}
boot().catch((e) => { console.error(e); document.getElementById("content").textContent = `Boot failed: ${e}`; });

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
import { matchRank } from "./search.js";

const modules = new Map();          // "group/id" -> manifest
const broken = [];                  // modules that failed to import (shown on the dashboard)
let cleanup = null;                 // the current page's cleanup function
let current = null;                 // current route
const NAV_KEY = "planner.nav";      // { open: {groupId: bool}, showSoon: bool }
const nav = (() => { try { return { open: {}, showSoon: true, ...JSON.parse(localStorage.getItem(NAV_KEY) || "{}") }; } catch { return { open: {}, showSoon: true }; } })();
const saveNav = () => { try { localStorage.setItem(NAV_KEY, JSON.stringify(nav)); } catch { } };
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
  const rank = (m, g) => matchRank(m, g.title, q);

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
  if (q && !groups.length) {
    side.append(ui.h("div", { class: "nav-empty" }, ui.h("div", {}, `No page matches “${filter.trim()}”.`),
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
function toggleDrawer() { const open = document.getElementById("sidebar").classList.toggle("open"); document.getElementById("scrim").classList.toggle("show", open); setToggleIcon(open); }

// ---------------------------------------------------------------- pages
function safeCompute(m, plan, params) {
  if (typeof m.compute !== "function") return null;
  try { return m.compute(plan, params ?? {}); } catch (e) { console.error(`[planner] compute failed in ${m.group}/${m.id}`, e); return { error: String(e) }; }
}
function makeCtx(route) {
  const plan = store.get();
  return {
    route, plan, store, api, ai, ui, fmt, features, modules, GROUPS, isReady,
    computeOf: (key, params) => { const m = modules.get(key); return m ? safeCompute(m, store.get(), params) : null; },
    computeRemote: async (key, params) => {
      const m = modules.get(key); if (!m) return null;
      if (m.heavy && store.backend() === "server") { try { return await api.compute(key, params); } catch (e) { console.warn("[planner] remote compute failed, running locally", e); } }
      return safeCompute(m, store.get(), params);
    },
    go: (group, id, rest) => router.go(group, id, rest),
  };
}
async function show(route) {
  current = route;
  let m = modules.get(`${route.group}/${route.id}`);
  if (!m || !features.enabled(m)) m = modules.get("overview/dashboard") ?? [...modules.values()][0];
  if (cleanup) { try { cleanup(); } catch (e) { console.warn(e); } cleanup = null; }
  const root = document.getElementById("content");
  root.innerHTML = "";
  document.getElementById("page-title").textContent = m ? m.title : "Planner";
  document.title = `${m ? m.title : "Planner"} - Planner`;
  if (m && isReady(m)) {   // remember for the drawer's "Recent" list
    const key = `${m.group}/${m.id}`;
    nav.recent = [key, ...(nav.recent ?? []).filter((k) => k !== key)].slice(0, 12);
    saveNav(); buildNav();
  }
  markActive();
  closeDrawer();
  window.scrollTo(0, 0);
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
  ctx.derived = safeCompute(m, ctx.plan);
  try { cleanup = (await m.render(root, ctx)) ?? null; }
  catch (e) { console.error(e); root.append(ui.notice("error", `This page failed to render: ${e}`)); }
}

async function refreshStatus() {
  const el = document.getElementById("status");
  if (store.sandbox()) {
    el.textContent = "Sandbox";
    el.className = "warn";
    el.title = "Pretend plan, kept in this browser only. Nothing here touches your real plan. Remove ?sandbox=1 from the address to leave.";
    return;
  }
  const server = store.backend() === "server";
  let aiState = "off";
  try { aiState = await ai.status(); } catch { aiState = "off"; }
  // Plain words (design log 2026-09-15): where the plan is saved right now.
  el.textContent = server ? "Saved on PC" : "Phone only";
  el.className = server ? "ok" : "warn";
  el.title = (server ? `Your plan is saved on the PC (${api.base()})` : "The PC cannot be reached: your plan is saved in this browser only") + `. AI: ${aiState}. Tap for settings.`;
}

async function boot() {
  await loadModules();
  await features.init();
  await store.load();
  buildNav();
  document.getElementById("nav-toggle").addEventListener("click", toggleDrawer);
  document.getElementById("scrim").addEventListener("click", closeDrawer);
  document.getElementById("status").addEventListener("click", () => router.go("system", "settings"));
  let t = null;
  store.subscribe(() => { clearTimeout(t); t = setTimeout(() => { if (current) show(current); }, 50); });
  addEventListener("planner:features", () => buildNav());
  addEventListener("planner:connection", () => { store.reconnect().then(() => { refreshStatus(); if (current) show(current); }); });
  router.start(show);
  refreshStatus();
  setInterval(refreshStatus, 30000);
}
boot().catch((e) => { console.error(e); document.getElementById("content").textContent = `Boot failed: ${e}`; });

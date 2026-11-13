// qa/first-view-lib.mjs -- the first-view check (docs/OPTIONAL.md, check N): every usable page's view.js drawn in Node with
// the real UI kit on the stand-in DOM (qa/fixtures/fake-dom.mjs), for four invented households, and what a person meets
// before any tap counted: everything outside a shut <details>, in the phone markup. Budgets per kind of page and the
// pages' kinds live in tests/first-view.kinds.mjs; the counts a page may not rise above in tests/first-view.known.json.
//
//   tests/first-view/1..6.test.mjs   six shards of `npm test` (defineShard below), run side by side by node --test
//   node qa/first-view-node.mjs      every page in one run: a table, the totals, and --write to rewrite the counts file
//
// What it draws: the page as it opens for someone who has opened nothing (planner.more empty, every switch off, the
// route's query empty), for `family`, `renterDebt`, `retiredCouple` (qa/fixtures) and the empty plan; the path's steps
// once more with ?guide=plan; the steps that open a section once more with their guide in the address. The clock is
// held at TODAY so a count never rises because the calendar moved.
//
// What it counts, outside every shut <details> (.only-wide, .vh, [hidden], aria-hidden, display:none, option, style,
// script skipped): words; money and percent figures; boxes a person types in or picks from (not ticks, files or
// buttons); .stat tiles; filled buttons (a button, a.btn or submit whose background is the accent once core/ui/base.css,
// the page's own <style> and its inline style are applied, as qa/first-view.mjs reads it in a browser; a chip is not one);
// sections that open (parts; wave 1's form line "More details (optional)" counted apart); list rows; and, reported
// only, the words behind shut sections (proof that nothing was deleted).
//
// The structure checks (S1..S16, docs/OPTIONAL.md section 13): structure(root, ...) for one drawing; S8, S9, S13, S14, S16 need
// more than one drawing and run in measurePage.
//
// Each node --test file is its own process: the globals set here (the stand-in DOM, a held clock, location) never reach
// another file's tests.
import { FakeElement, fullSelectors, specificity } from "./fixtures/fake-dom.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// every element knows real selectors here: a page's own querySelector(".form-actions button[type=submit]") finds what a
// browser finds (the stand-in alone matches only ".a", [k="v"] and a tag)
fullSelectors();
export const TODAY = "2026-11-13";
export const HOUSEHOLDS = ["family", "renterDebt", "retiredCouple", "empty"];
export const PLAN_HOUSEHOLDS = ["family", "renterDebt", "retiredCouple"];
const KNOWN_FILE = path.join(ROOT, "tests", "first-view.known.json");

// ---------------------------------------------------------------- the stand-in browser around a page
{
  const Real = Date, AT = new Real(`${TODAY}T12:00:00`).getTime();
  // new Date() and Date.now() say TODAY at noon; a date with arguments is a real date
  class HeldDate extends Real { constructor(...a) { if (a.length) super(...a); else super(AT); } static now() { return AT; } }
  globalThis.Date = HeldDate;
  const loc = { hash: "", search: "", href: "http://localhost/", pathname: "/", origin: "http://localhost", host: "localhost", replace() { }, assign() { }, reload() { } };
  globalThis.location = globalThis.location ?? loc;
  const g = globalThis;
  Object.assign(g.window, { location: g.location, scrollTo() { }, scrollBy() { }, innerHeight: 844, innerWidth: 390, scrollY: 0, matchMedia: () => ({ matches: false, addEventListener() { }, removeEventListener() { } }) });
  g.matchMedia = g.matchMedia ?? g.window.matchMedia;
  g.scrollTo = g.scrollTo ?? (() => { }); g.scrollY = g.scrollY ?? 0; g.innerHeight = g.innerHeight ?? 844; g.innerWidth = g.innerWidth ?? 390;
  g.addEventListener = g.addEventListener ?? (() => { }); g.removeEventListener = g.removeEventListener ?? (() => { });
  g.requestAnimationFrame = g.requestAnimationFrame ?? ((f) => setTimeout(f, 0));
  Object.assign(g.document, { getElementById: () => null, addEventListener() { }, removeEventListener() { }, querySelectorAll: () => [], activeElement: null });
}

// ---------------------------------------------------------------- the app, loaded once per process
let APP = null;
const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
export async function loadApp() {
  if (APP) return APP;
  const [ui, fmt, { migrate, emptyPlan }, { GROUPS }, viewMod, est, registry, { familyPlan }, { renterDebtPlan }, { retiredCouplePlan }, journeys] = await Promise.all([
    imp("core/ui/dom.js"), imp("core/format.js"), imp("core/schema/migrate.js"), imp("core/groups.js"), imp("core/view.js"), imp("core/estimate/index.js"),
    imp("modules/registry.js").then((m) => m.default), imp("qa/fixtures/family-plan.mjs"), imp("qa/fixtures/renter-debt-plan.mjs"), imp("qa/fixtures/retired-couple-plan.mjs"),
    imp("modules/overview/guide/journeys.js")]);
  const modules = new Map();
  const loadErrors = {};
  for (const e of registry) {
    try { const m = (await e.load()).default; m.id = e.id; m.group = e.group; modules.set(`${e.group}/${e.id}`, m); }
    catch (err) { loadErrors[`${e.group}/${e.id}`] = String(err.message); }
  }
  const usable = [...modules.values()].filter((m) => m.status !== "planned" && !m.placeholder).map((m) => `${m.group}/${m.id}`).sort();
  const GUESS = est.mergeEstimators([...modules.values()].map((m) => ({ from: `${m.group}/${m.id}`, estimators: m.estimators, tables: m.guessTables })));
  const raw = { family: () => familyPlan(TODAY), renterDebt: () => renterDebtPlan(), retiredCouple: () => retiredCouplePlan(), empty: () => emptyPlan() };
  const plans = Object.fromEntries(Object.entries(raw).map(([k, f]) => [k, migrate(structuredClone(f()))]));
  APP = { ui, fmt, migrate, GROUPS, viewMod, est, GUESS, modules, usable, loadErrors, plans, journeys: journeys.JOURNEYS, PATH_ID: journeys.PATH_ID };
  return APP;
}
export const planOf = (who) => structuredClone(APP.plans[who]);

// a page's error after its draw (a promise it did not wait for) is said against the page being drawn; one that comes
// later still is kept in `lateAfter` with the last page drawn (the shard prints them)
let drawing = null, lastKey = "";
export const lateAfter = [];
const late = (e) => { const msg = String(e?.message ?? e).slice(0, 160); if (drawing) drawing.late.push(msg); else lateAfter.push(`${lastKey}: ${msg}`); };
process.on("unhandledRejection", late);
process.on("uncaughtException", late);
// A page may fill itself in a moment after its first paint (a timer of a few milliseconds: Diagnostics runs every
// page's sums 30 ms later). While a page draws, its short timers (600 ms or less, and the ones they set) are kept in
// `timers`, and the drawing is counted once they have all run, at most SETTLE_MS later. A longer one (a green line
// taken away after 4 s) is the page's own business and not waited for.
const realSetTimeout = globalThis.setTimeout, realClearTimeout = globalThis.clearTimeout;
let timers = null;
const owner = new Map();
globalThis.setTimeout = function (fn, ms = 0, ...a) {
  if (!timers || typeof fn !== "function" || !(Number(ms) <= 600)) return realSetTimeout(fn, ms, ...a);
  const set = timers;
  const id = realSetTimeout((...x) => { set.delete(id); owner.delete(id); fn(...x); }, ms, ...a);
  set.add(id); owner.set(id, set);
  return id;
};
globalThis.clearTimeout = function (id) { owner.get(id)?.delete(id); owner.delete(id); return realClearTimeout(id); };
export const SETTLE_MS = 3000;
const tick = (ms = 0) => new Promise((r) => realSetTimeout(r, ms));
const AI_DEFAULTS = { provider: "ollama", host: "127.0.0.1", port: 11434, model: "", baseUrl: "", apiKey: "", source: "defaults" };

/**
 * draw(key, who, { query, boxes }) -> { root, ctx, calls, late, error, ms }: the page's render(root, ctx) with a ctx built
 * as the shell builds it (core/app.js makeCtx), the plan migrated as the store holds it, store.update recorded (never
 * applied, never redrawn), ctx.computeRemote answered after the page's first paint as the shell does, and the drawing
 * awaited until every answer it asked for has been drawn. `boxes`: every form's "More details (optional)" open (the
 * kit's setMoreOpen, the switch "Show every box in forms").
 */
export async function draw(key, who, { query = {}, boxes = false } = {}) {
  const app = await loadApp();
  const m = app.modules.get(key);
  const t0 = performance.now();
  const plan = planOf(who);
  const calls = { update: 0, redraw: 0, go: 0, saved: [] };
  const waits = new Set();
  const safe = (mm, params) => { if (typeof mm?.compute !== "function") return null; try { return mm.compute(plan, params ?? {}); } catch (e) { return { error: String(e) }; } };
  const store = {
    get: () => plan, update: (fn) => { calls.update++; const d = structuredClone(plan); try { fn(d); } catch { } calls.saved.push(JSON.stringify(d)); },
    backend: () => "local", sandbox: () => true, replace() { }, syncState: () => ({ state: "local" }), eraseDevice() { },
  };
  const ctx = {
    route: { group: m.group, id: m.id, rest: [], query: { ...query } }, plan, store, ui: app.ui, fmt: app.fmt, GROUPS: app.GROUPS, modules: app.modules,
    api: { base: () => "", health: null, ready: () => Promise.resolve(false), headers: () => ({}) },
    // the AI helper as a phone with no computer finds it (core/ai.js): nothing set up, nothing reached
    ai: { settings: async () => ({ ...AI_DEFAULTS }), status: async () => "unreachable", models: async () => { throw new Error("No AI helper is set up on this device."); },
      chat: async () => { throw new Error("No AI helper is set up on this device."); }, set() { }, planSummary: () => "" },
    // every page as its manifest has it (core/features.js with nothing switched on this device or the computer)
    features: { key: (x) => `${x.group}/${x.id}`, enabled: (x) => x.enabledByDefault !== false, set() { }, sourceOf: () => "default", overrides: {} }, isReady: (x) => x.status !== "planned",
    view: app.viewMod.view, live: app.viewMod.reach, shown: (x) => app.viewMod.shown(x, (y) => y.status !== "planned"),
    computeOf: (k, params) => { const mm = app.modules.get(k); return mm ? safe(mm, params) : null; },
    computeRemote: (k, params) => {
      const mm = app.modules.get(k);
      const p = (async () => { await tick(); return mm ? safe(mm, params) : null; })();
      waits.add(p); p.finally(() => waits.delete(p)).catch(() => { });
      return p;
    },
    go: () => { calls.go++; }, layer: () => () => { }, back: () => false, redraw: () => { calls.redraw++; },
    guess: (k, opts = {}) => { try { return app.est.estimate(plan, k, { estimators: app.GUESS.estimators, tables: app.GUESS.tables, today: app.fmt.today(), ...opts }); } catch { return null; } },
    openSearch() { }, cameFrom: () => null, replace() { }, announce() { }, module: m,
  };
  { let got = false, val = null; Object.defineProperty(ctx, "derived", { configurable: true, enumerable: true, get: () => { if (!got) { got = true; val = safe(m); } return val; }, set: (v) => { got = true; val = v; } }); }
  const root = new FakeElement("div");
  root.dataset.page = key;
  const me = { late: [] };
  drawing = me; lastKey = key;
  app.ui.setMoreOpen?.(!!boxes);
  let error = null, unsettled = false;
  const mine = (timers = new Set());
  try {
    await m.render(root, ctx);
    const until = performance.now() + SETTLE_MS;
    for (let i = 0; ; i++) {
      if (waits.size) await Promise.allSettled([...waits]);
      if (!waits.size && !mine.size && i >= 1) break;   // one turn of the event loop has run every promise the draw started
      if (performance.now() > until) { unsettled = true; break; }
      await tick(mine.size ? 2 : 0);
    }
  } catch (e) { error = String(e?.message ?? e).slice(0, 160); }
  finally { app.ui.setMoreOpen?.(false); if (timers === mine) timers = null; }
  if (drawing === me) drawing = null;
  return { root, ctx, calls, late: me.late, error, unsettled, ms: performance.now() - t0 };
}

// ---------------------------------------------------------------- what a person meets before any tap
const classes = (el) => String(el.className ?? "").split(/\s+/).filter(Boolean);
const has = (el, c) => !!el && classes(el).includes(c);
const isEl = (n) => n instanceof FakeElement;
const isOpen = (el) => el.hasAttribute("open");
/** Not drawn on a phone, or never seen: skipped with everything inside. */
export function unseen(el) {
  if (el.hidden || el.hasAttribute("hidden") || /^(OPTION|STYLE|SCRIPT|TEMPLATE|NOSCRIPT)$/.test(el.tagName)) return true;
  if (has(el, "only-wide") || has(el, "vh")) return true;
  if (el.getAttribute("aria-hidden") === "true") return true;
  return el.style?.display === "none";
}
const BOX_TYPES_NOT = new Set(["checkbox", "radio", "hidden", "file", "submit", "button", "reset", "image"]);
export const isBox = (el) => (el.tagName === "INPUT" && !BOX_TYPES_NOT.has(el.getAttribute("type") ?? "text")) || el.tagName === "SELECT" || el.tagName === "TEXTAREA";
// ---- filled buttons, as a person sees them: a button, a.btn or submit whose background after the cascade (core/ui/base.css,
// then the page's own <style>, then its inline style) is the accent; a chip that is on is a choice, not an action
const BASE_CSS = (() => { try { return fs.readFileSync(path.join(ROOT, "core", "ui", "base.css"), "utf8"); } catch { return ""; } })();
/** Does an @media condition hold on a phone 390 px wide, light, touch? */
const onPhone = (cond) => cond.split(/\s*,\s*/).some((one) => one.split(/\s+and\s+/i).every((c) => {
  const t = c.trim().toLowerCase();
  if (t === "screen" || t === "all" || t === "only screen") return true;
  let m = /\(\s*min-width\s*:\s*([\d.]+)px\s*\)/.exec(t); if (m) return 390 >= Number(m[1]);
  m = /\(\s*max-width\s*:\s*([\d.]+)px\s*\)/.exec(t); if (m) return 390 <= Number(m[1]);
  if (/\(\s*pointer\s*:\s*coarse\s*\)|\(\s*hover\s*:\s*none\s*\)|\(\s*prefers-color-scheme\s*:\s*light\s*\)/.test(t)) return true;
  return false;   // print, dark, reduced motion, a fine pointer ...
}));
/** The rules of a style sheet that set a background: [{ sel, spec, bg }], in order; @media kept when it holds on a phone. */
export function backgroundRules(css) {
  const out = [];
  const text = String(css).replace(/\/\*[\s\S]*?\*\//g, "");
  const walk = (src, on) => {
    let i = 0;
    while (i < src.length) {
      const open = src.indexOf("{", i); if (open < 0) break;
      const head = src.slice(i, open).trim();
      let depth = 1, j = open + 1; for (; j < src.length && depth; j++) { if (src[j] === "{") depth++; else if (src[j] === "}") depth--; }
      const body = src.slice(open + 1, j - 1);
      if (head.startsWith("@media")) walk(body, on && onPhone(head.slice(6)));
      else if (head.startsWith("@supports")) walk(body, on);
      else if (!head.startsWith("@") && on) {
        let bg = null;
        for (const d of body.split(";")) { const m = /^\s*(background(?:-color)?)\s*:\s*(.+?)\s*$/i.exec(d); if (m) bg = m[2].replace(/\s*!important$/, ""); }
        if (bg !== null) for (const sel of head.split(",")) out.push({ sel: sel.trim(), spec: specificity(sel.trim()), bg });
      }
      i = j;
    }
  };
  walk(text, true);
  return out;
}
const BASE_RULES = backgroundRules(BASE_CSS);
const rulesOf = new WeakMap();
const topOf = (el) => { let e = el; while (e.parentNode) e = e.parentNode; return e; };
/** The background a browser would give el, as the CSS value ("var(--accent)", "none", "var(--panel)" ...), or "". */
export function backgroundOf(el) {
  const inline = el.style?.background ?? el.style?.backgroundColor;
  if (inline !== undefined && inline !== null && inline !== "") return String(inline);
  const top = topOf(el);
  let rules = rulesOf.get(top);
  if (!rules) { rules = [...BASE_RULES]; for (const st of [top, ...top.all()].filter((e) => e.tagName === "STYLE")) rules.push(...backgroundRules(st.textContent)); rulesOf.set(top, rules); }
  let best = null, bestAt = -1;
  rules.forEach((r, at) => {
    if (!el.matches(r.sel)) return;
    if (!best || r.spec[0] > best.spec[0] || (r.spec[0] === best.spec[0] && (r.spec[1] > best.spec[1] || (r.spec[1] === best.spec[1] && (r.spec[2] > best.spec[2] || (r.spec[2] === best.spec[2] && at > bestAt)))))) { best = r; bestAt = at; }
  });
  return best ? best.bg : "";
}
export const isFilled = (el) => (el.tagName === "BUTTON" || (el.tagName === "A" && has(el, "btn")) || (el.tagName === "INPUT" && el.getAttribute("type") === "submit"))
  && !el.disabled && !has(el, "chip") && !el.closest(".chips") && /^var\(--accent\)$/.test(backgroundOf(el).trim());
export const FIG = /(\$\s?\d[\d,]*(\.\d+)?|\d[\d,.]*\s?%)/g;
const wordsIn = (t) => t.split(" ").filter((x) => /[A-Za-z0-9]/.test(x)).length;
const squeeze = (s) => String(s).replace(/\s+/g, " ").trim();
/** The text nodes and elements under root in order, with whether each sits behind a shut section. */
function walk(root, fn) {
  const go = (n, shut) => {
    if (!isEl(n)) { fn(n, shut, true); return; }
    if (unseen(n)) return;
    fn(n, shut, false);
    if (n.tagName === "DETAILS") { const open = isOpen(n); for (const k of n.childNodes) go(k, shut || (!open && !(isEl(k) && k.tagName === "SUMMARY"))); return; }
    for (const k of n.childNodes) go(k, shut);
  };
  for (const k of root.childNodes) go(k, false);
}
/** The counts of one drawing (see the header). */
export function count(root) {
  const c = { words: 0, figs: 0, boxes: 0, tiles: 0, filled: 0, parts: 0, moreLines: 0, rows: 0, behind: 0 };
  walk(root, (n, shut, text) => {
    if (text) {
      const t = squeeze(n.data ?? "");
      if (!t) return;
      if (shut) c.behind += wordsIn(t);
      else { c.words += wordsIn(t); c.figs += (t.match(FIG) ?? []).length; }
      return;
    }
    if (shut) return;
    if (isBox(n)) c.boxes++;
    if (isFilled(n)) c.filled++;
    if (has(n, "stat")) c.tiles++;
    if (n.tagName === "DETAILS") { if (has(n, "form-more")) c.moreLines++; else c.parts++; }
    if ((n.tagName === "LI" && has(n.parentNode, "records") && !has(n, "rec-form")) || (n.tagName === "TR" && n.parentNode?.tagName === "TBODY")) c.rows++;
  });
  return c;
}
/** Every text node under root (shut sections and hidden ones included), squeezed; for S12 and S13. */
const allText = (root) => { const out = []; const go = (n) => { if (!isEl(n)) { const t = squeeze(n.data ?? ""); if (t) out.push(t); return; } if (/^(STYLE|SCRIPT)$/.test(n.tagName)) return; for (const k of n.childNodes) go(k); }; go(root); return out; };
const all = (root, pred) => root.all().filter(pred);
const inShut = (el, stop) => { for (let p = el.parentNode; p && p !== stop; p = p.parentNode) if (isEl(p) && p.tagName === "DETAILS" && !isOpen(p) && !(el.closest?.("summary") && el.closest("summary").parentNode === p)) return p; return null; };
/** The nearest shut part (details[data-part]) around el, or null. */
const partAround = (el, stop) => { for (let p = el.parentNode; p && p !== stop; p = p.parentNode) if (isEl(p) && p.tagName === "DETAILS" && p.dataset?.part !== undefined && !isOpen(p)) return p; return null; };
const summaryOf = (d) => d.children.find((k) => k.tagName === "SUMMARY") ?? null;
const titleOf = (d) => squeeze(summaryOf(d)?.querySelector(".fold-title")?.textContent ?? summaryOf(d)?.textContent ?? "");

// ---------------------------------------------------------------- the structure checks on one drawing
/** The vocabulary (docs/OPTIONAL.md "The vocabulary") and the titles a test, a guide step or the owner pins (R24). */
export const VOCABULARY = ["How this is worked out", "Set my own numbers", "The figures", "More details (optional)", "More on this", "Show details"];
export const PINNED_TITLES = ["Figures the plan cannot see", "Retirement settings", "The split to aim for", "What a paycheck withholds", "See or change each bill",
  "Where these numbers come from", "Advanced", "What is still being built", "Show details", "How this is done"];
const NEVER_TITLES = /^(more|details|other|more options|expert|simple mode|go deeper)$/i;
const STATE_WORDS = /\b(set|guess|guesses|guessed|fix|filled)\b/i;
const STATE_OK = /^(\d+ to fix|not set yet|set by you|\d+ set by you|our guess|\d+ our guesses|\d+ filled in)$/;
const ORDER = { more: 0, own: 1, figures: 1, how: 2, item: 3, tech: 4, links: 5 };
/**
 * structure(root, { key, moved }) -> [{ id, what }]: the checks one drawing can answer. Parts (drawn by core/ui/more.js:
 * details[data-part]) answer S1 to S4, S6, S7 and S15; every shut <details> answers S5 (nothing that must be seen is
 * folded away); every text answers S12. `moved` lists notices a page may keep in a part (MOVED_NOTICES, with a reason).
 */
export function structure(root, { key = "", moved = [] } = {}) {
  const out = [];
  const say = (id, what) => out.push({ id, what: what.slice(0, 160) });
  const partsAll = all(root, (e) => e.tagName === "DETAILS" && e.dataset?.part !== undefined);
  // S1: no part inside a part (a part's rows may open: kind "item"; a form's "More details (optional)" is not a part)
  for (const p of partsAll) for (let a = p.parentNode; a && a !== root; a = a.parentNode) if (isEl(a) && a.tagName === "DETAILS" && a.dataset?.part !== undefined && p.dataset.kind !== "item") { say("S1", `"${titleOf(p)}" sits inside "${titleOf(a)}"`); break; }
  // S2: at most five parts; three or more in one card; the order more, own/figures, how
  const counted = partsAll.filter((p) => !["item", "links"].includes(p.dataset.kind));
  if (counted.length > 5) say("S2", `${counted.length} parts on one page (at most 5)`);
  const loose = counted.filter((p) => !p.closest?.("[data-parts]") && !all(root, (e) => e.dataset?.parts !== undefined).some((c) => c.all().includes(p)));
  if (counted.length >= 3 && loose.length > 2) say("S2", `${loose.length} parts outside the one parts card`);
  for (const card of all(root, (e) => e.dataset?.parts !== undefined)) {
    const kinds = card.all().filter((e) => e.tagName === "DETAILS" && e.dataset?.part !== undefined).map((e) => e.dataset.kind);
    for (let i = 1; i < kinds.length; i++) if ((ORDER[kinds[i]] ?? 9) < (ORDER[kinds[i - 1]] ?? 9)) { say("S2", `parts out of order: ${kinds.join(", ")}`); break; }
  }
  const ownCount = partsAll.filter((p) => p.dataset.kind === "own").length;
  for (const p of partsAll) {
    const s = summaryOf(p), title = titleOf(p), kind = p.dataset.kind;
    const status = squeeze(s?.querySelector(".fold-status")?.textContent ?? "");
    // S3: a status of at most 20 characters, never cut, in the four spellings for the person's state
    if (status.length > 20) say("S3", `"${title}": status "${status}" is ${status.length} characters (at most 20)`);
    if (/…|\.\.\./.test(status)) say("S3", `"${title}": status "${status}" is cut`);
    const state = status.split(" · ")[0];
    if (STATE_WORDS.test(state) && !STATE_OK.test(state)) say("S3", `"${title}": status "${status}" spells the person's state its own way`);
    // S4: a title from the vocabulary, a pinned one, an item's own name, or a named "own" part on a page with several
    const ok = kind === "item" || VOCABULARY.includes(title) || PINNED_TITLES.includes(title) || /^\d+ more \S/.test(title)
      || (kind === "own" && ownCount > 1 && title.split(" ").length >= 2 && title.split(" ").length <= 4);
    if (NEVER_TITLES.test(title) || (title === "Advanced" && key !== "system/settings") || !ok) say("S4", `"${title}" (kind ${kind}) is not a title of the vocabulary`);
    const body = p.children.find((k) => has(k, "fold-body")) ?? p;
    // S6: inside a part, a filled button only as its own form's Save
    for (const b of body.all().filter(isFilled)) if (!(b.getAttribute("type") === "submit" && b.closest("form"))) say("S6", `"${title}" holds a filled button "${squeeze(b.textContent)}" that is not its form's Save`);
    // S7: a part is worth a tap: two figures, three rows or forty words (a body built later is checked once built; the
    // links card folded on a step is R6's, not a part of the page's own)
    if (body.childNodes.length && kind !== "links") {
      const text = allText(body).join(" "), figs = (text.match(FIG) ?? []).length, w = wordsIn(text);
      const rows = body.all().filter((e) => e.tagName === "LI" || e.tagName === "TR" || has(e, "field") || has(e, "stat")).length;
      if (figs < 2 && rows < 3 && w < 40) say("S7", `"${title}" holds ${figs} figures, ${rows} rows, ${w} words: show it instead`);
    }
  }
  // S5: nothing that must be seen is behind a shut section: a notice, a guess mark or a hint worth money behind any shut
  // <details>; a required box behind a shut part (an add form behind "+ Add another ..." keeps its required boxes, R20)
  for (const el of all(root, (e) => has(e, "notice") || has(e, "guess") || e.dataset?.guess !== undefined || e.dataset?.worth !== undefined || (isBox(e) && e.hasAttribute("required")))) {
    const d = inShut(el, root);
    if (!d) continue;
    if (isBox(el) && !has(el, "guess") && el.dataset?.guess === undefined && !partAround(el, root)) continue;
    const words = squeeze(el.textContent).slice(0, 60);
    if (moved.some((m) => words.startsWith(m))) continue;
    const what = has(el, "notice") ? `a ${classes(el).filter((c) => c !== "notice").join(" ") || "plain"} notice "${words}"` : isBox(el) ? `a required box "${el.getAttribute("name")}"` : `a marked line "${words}"`;
    say("S5", `${what} is inside the shut "${titleOf(d)}"`);
  }
  // S9 (one drawing): a folded box of a form is never required and never shows our guess
  for (const fm of all(root, (e) => e.tagName === "DETAILS" && has(e, "form-more"))) for (const b of fm.all().filter((e) => (isBox(e) && e.hasAttribute("required")) || has(e, "guess") || e.dataset?.guess !== undefined)) say("S9", `"More details (optional)" folds ${isBox(b) ? `the required box "${b.getAttribute("name")}"` : "a guess"}`);
  // S12: no text reads null, undefined, NaN or [object Object]
  for (const t of allText(root)) if (/\bundefined\b|\bNaN\b|\[object Object\]|\bnull\b/.test(t)) say("S12", `text reads "${t.slice(0, 80)}"`);
  // S15: no box of the helper's own inside the parts card, outside a form
  for (const card of all(root, (e) => e.dataset?.parts !== undefined)) for (const b of card.all().filter((e) => /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName))) if (!b.closest("form")) say("S15", `a ${b.tagName.toLowerCase()} in the parts card outside a form`);
  return out;
}
/** S10: an adopted view draws no <details> by hand (every one is a part or wave 1's form line). */
export function handWritten(root) {
  return all(root, (e) => e.tagName === "DETAILS" && e.dataset?.part === undefined && !has(e, "form-more")).map((d) => ({ id: "S10", what: `a <details> by hand: "${titleOf(d)}"` }));
}

// ---------------------------------------------------------------- a page, every household and every check
const srcOf = (key, file) => { try { return fs.readFileSync(path.join(ROOT, "modules", key, file), "utf8"); } catch { return ""; } };
export const adoptedSource = (key) => /core\/ui\/more\.js/.test(srcOf(key, "view.js"));
/** Every step of every guide that opens a section of its page: [{ journey, step, page, opens, ask }]. */
export function opensSteps() {
  const out = [];
  for (const j of journeyList()) for (const s of j.steps ?? []) {
    if (s.opens) out.push({ journey: j.id, step: s.key, page: s.page, opens: s.opens, ask: s.ask ?? "" });
    if (s.alt?.opens) out.push({ journey: j.id, step: s.key, page: s.alt.page, opens: s.alt.opens, ask: s.alt.ask ?? "" });
  }
  return out;
}
const journeyList = () => (Array.isArray(APP.journeys) ? APP.journeys : Object.values(APP.journeys ?? {}));
export const pathPages = () => [...new Set((journeyList().find((j) => j.id === APP.PATH_ID)?.steps ?? []).map((s) => s.page))];
const labelOf = (b) => squeeze(b.closest("label")?.querySelector(".field-label")?.textContent ?? b.getAttribute("aria-label") ?? b.getAttribute("name") ?? "");
const flip = (d) => { const s = summaryOf(d); try { s?.dispatch("click", { isTrusted: false }); } catch { } d.open = !isOpen(d); try { d.dispatch("toggle", { newState: isOpen(d) ? "open" : "closed" }); } catch { } };

/**
 * measurePage(key, { moved }) -> { key, households: { who: counts | { error } }, checks: [{ id, who, what }], late, guide,
 * notes, adopted, ms }. Draws the page for the empty plan, renterDebt and retiredCouple (counts and the one-drawing
 * checks); then on a step of the path with ?guide=plan (S16: no open "More on this" card); on a step that opens a section,
 * with its guide (S14); an adopted view twice more, as it is and with every part and form line open (S13); then for the
 * family last, whose drawing is then opened and shut section by section (S8): opening changes a page's own state (a page
 * keeps what was opened), so nothing is drawn after it but the forms with a "More details (optional)", each submitted
 * shut and open on fresh drawings (S9).
 */
export async function measurePage(key, { moved = [] } = {}) {
  const app = await loadApp();
  const t0 = performance.now();
  const r = { key, households: {}, checks: [], late: [], notes: [], ms: 0 };
  const add = (who, list) => { for (const c of list) r.checks.push({ ...c, who }); };
  let adopted = adoptedSource(key);
  const take = (who, d) => {
    if (d.late.length) r.late.push(...d.late.map((x) => `${who}: ${x}`));
    if (d.unsettled) r.notes.push(`${who}: still drawing ${SETTLE_MS / 1000} s after the first paint (counted as it stood then)`);
    if (d.error) { r.households[who] = { error: d.error }; return; }
    r.households[who] = count(d.root);
    if (all(d.root, (e) => e.dataset?.part !== undefined).length) adopted = true;
    add(who, structure(d.root, { key, moved }));
    if (adopted) add(who, handWritten(d.root));
  };
  for (const who of ["empty", "renterDebt", "retiredCouple"]) take(who, await draw(key, who));
  // S16: on a step of the path the "More on this" card is one shut row
  if (pathPages().includes(key)) {
    const d = await draw(key, "family", { query: { guide: APP.PATH_ID } });
    if (!d.error) {
      r.guide = count(d.root);
      for (const el of all(d.root, (e) => e.dataset?.links !== undefined || (e.tagName === "H2" && squeeze(e.textContent) === "More on this"))) {
        if (inShut(el, d.root) || unseen(el)) continue;
        add("family", [{ id: "S16", what: "the \"More on this\" card is open on a step of the path (one shut row there)" }]);
        break;
      }
    }
  }
  // S14: a section a guide step opens is drawn, holds a box, and the box the step names is its first
  for (const s of opensSteps().filter((x) => x.page === key)) {
    const d = await draw(key, "family", { query: { guide: s.journey, step: s.step } });
    if (d.error) { add("family", [{ id: "S14", what: `${s.journey}/${s.step}: the page cannot draw (${d.error})` }]); continue; }
    const fold = all(d.root, (e) => e.tagName === "DETAILS" && squeeze(summaryOf(e)?.textContent ?? "").includes(s.opens))[0];
    if (!fold) { add("family", [{ id: "S14", what: `${s.journey}/${s.step}: no section "${s.opens}" on the page` }]); continue; }
    const boxes = fold.all().filter((e) => isBox(e) || (e.tagName === "BUTTON" && has(e, "chip")));
    const named = boxes.filter((b) => isBox(b) && labelOf(b) && s.ask.toLowerCase().includes(labelOf(b).toLowerCase()));
    if (!boxes.length) add("family", [{ id: "S14", what: `${s.journey}/${s.step}: "${s.opens}" holds no box` }]);
    else if (named.length && boxes[0] !== named[0]) add("family", [{ id: "S14", what: `${s.journey}/${s.step}: the box the step names, "${labelOf(named[0])}", is not the first in "${s.opens}"` }]);
  }
  // S13: an adopted view holds the same words, figures and box names with every part and form line open
  const drewOne = ["renterDebt", "retiredCouple"].find((w) => !r.households[w]?.error) ?? "family";
  if (adopted) {
    const { openAll } = await imp("core/ui/more.js");
    const words = (root) => { openAll(root); return JSON.stringify([allText(root), root.all().filter(isBox).map((b) => b.getAttribute("name"))]); };
    const a = await draw(key, drewOne), b = await draw(key, drewOne, { boxes: true });
    if (!a.error && !b.error && words(a.root) !== words(b.root)) add(drewOne, [{ id: "S13", what: "the words differ with every part and form line open (the switches change what a page says)" }]);
    // S7 once every lazy body is built
    for (const c of structure(a.root, { key, moved }).filter((x) => x.id === "S7")) add(drewOne, [c]);
  }
  // the family, then S8 on its drawing (or a fresh one of another household when the family cannot be drawn)
  const fam = await draw(key, "family");
  take("family", fam);
  const drew = !fam.error ? "family" : PLAN_HOUSEHOLDS.find((w) => !r.households[w]?.error) ?? null;
  const d = !fam.error ? fam : drew ? await draw(key, drew) : null;
  if (d && !d.error) {
    const before = d.calls.update;
    for (const det of all(d.root, (e) => e.tagName === "DETAILS")) { flip(det); flip(det); }
    await tick();
    if (d.calls.update > before) add(drew, [{ id: "S8", what: `opening and shutting its sections saved the plan ${d.calls.update - before} time(s)` }]);
    if (d.calls.redraw || d.calls.go) r.notes.push(`opening and shutting its sections asked for ${d.calls.redraw} redraw(s) and ${d.calls.go} move(s)`);
    // S9: what Save writes does not depend on whether "More details (optional)" is open
    const formsOf = (root) => all(root, (x) => x.tagName === "FORM" && x.all().some((y) => y.tagName === "DETAILS" && has(y, "form-more")));
    for (let i = 0; i < formsOf(d.root).length; i++) {
      const send = async (open) => {
        const e = await draw(key, drew);
        const f = formsOf(e.root)[i];
        if (!f) return "gone";
        f.all().find((y) => y.tagName === "DETAILS" && has(y, "form-more")).open = open;
        try { f.dispatch("submit"); } catch { }
        await tick();
        return JSON.stringify(e.calls.saved);
      };
      if (await send(false) !== await send(true)) add(drew, [{ id: "S9", what: `form ${i + 1}: Save writes a different plan with "More details (optional)" open` }]);
    }
  }
  r.adopted = adopted;
  // S11 lives in the page's own module test (it has the page's save handler): an adopted page must have one, named "S11"
  if (adopted && !/(test|it)\(\s*["'`][^"'`]*\bS11\b/.test(srcOf(key, "module.test.mjs"))) r.checks.push({ id: "S11", who: "-", what: "the page uses the helper but its module.test.mjs has no test named \"S11\" (after a save only the saved part changes)" });
  for (const x of r.late) r.checks.push({ id: "L", who: x.split(":")[0], what: `an error after the draw: ${x}` });
  r.ms = performance.now() - t0;
  return r;
}

// ---------------------------------------------------------------- the rule: within budget, or not above the page's entry
export const ceil10 = (n) => Math.ceil(n / 10) * 10;
const FIELDS = ["words", "figs", "boxes", "tiles", "filled", "parts"];
const NAMES = { words: "words", figs: "money and % figures", boxes: "boxes", tiles: "tiles", filled: "filled buttons", parts: "sections that open" };
/** The worst of the plan households (and the empty plan) for one page: { plan: { field: [n, who] }, empty: {...} }. */
export function worst(r) {
  const out = { plan: {}, empty: {} };
  for (const f of [...FIELDS, "rows"]) for (const who of PLAN_HOUSEHOLDS) { const c = r.households[who]; if (!c || c.error) continue; if (!out.plan[f] || c[f] > out.plan[f][0]) out.plan[f] = [c[f], who]; }
  const e = r.households.empty;
  if (e && !e.error) for (const f of FIELDS) out.empty[f] = [e[f], "empty"];
  return out;
}
/** The budget a page's kind gives one field (a list with no rows on the screen is an empty list: its add form may show). */
export function budgetFor(kind, BUDGETS, f, c) {
  const b = BUDGETS[kind] ?? {};
  if (f === "boxes" && kind === "list" && c && !c.rows) return b.boxesEmptyList ?? b.boxes;
  return b[f] ?? null;
}
/** What the counts file would hold for this page now (for --write), or null when it meets every budget. */
export function entryFor(r, kind, { BUDGETS, EMPTY_BUDGET }) {
  const w = worst(r), e = {};
  const over = (scope, budgetOf) => {
    const o = {};
    for (const f of FIELDS) { const v = w[scope][f]; if (!v) continue; const b = budgetOf(f, r.households[v[1]]); if (b !== null && b !== undefined && v[0] > b) o[f] = f === "words" ? ceil10(v[0]) : v[0]; }
    return Object.keys(o).length ? o : null;
  };
  const plan = over("plan", (f, c) => budgetFor(kind, BUDGETS, f, c));
  if (plan) e.plan = plan;
  const empty = over("empty", (f) => EMPTY_BUDGET[f] ?? null);
  if (empty) e.empty = empty;
  const checks = {};
  for (const c of r.checks) checks[c.id] = (checks[c.id] ?? 0) + 1;
  if (Object.keys(checks).length) e.checks = checks;
  const cannot = HOUSEHOLDS.filter((who) => r.households[who]?.error);
  if (cannot.length) e.cannotDraw = cannot;
  return Object.keys(e).length ? e : null;
}
/**
 * judge(r, kind, entry, budgets) -> { fails: [...], notes: [...] }: a count above its budget with no entry, or above
 * its entry, fails; a count below its entry is a note ("lower me"), never a failure. Drawing errors and structure checks
 * the same: a household that cannot draw, or a check that fails more often than the entry says, fails.
 */
export function judge(r, kind, entry, { BUDGETS, EMPTY_BUDGET }) {
  const fails = [], notes = [];
  const w = worst(r), ent = entry ?? {};
  const field = (scope, f, b) => {
    const v = w[scope][f]; if (!v || b === null || b === undefined) return;
    const allowed = ent[scope]?.[f];
    const [n, who] = v, where = scope === "empty" ? "on the empty plan" : `(${who})`;
    if (allowed === undefined) { if (n > b) fails.push(`${NAMES[f]}: ${n} on the first view ${where}; the ${scope === "empty" ? "empty plan's" : `${kind} page's`} budget is ${b}`); return; }
    if (n > allowed) fails.push(`${NAMES[f]}: ${n} on the first view ${where}, above this page's entry ${allowed} in tests/first-view.known.json (budget ${b}): a count there may only go down`);
    else if (n <= b) notes.push(`lower me: ${NAMES[f]} ${n} ${where} is within the budget ${b} now: delete "${f}" from this page's "${scope}" entry`);
    else if ((f === "words" ? ceil10(n) : n) < allowed) notes.push(`lower me: ${NAMES[f]} ${n} ${where}, the entry says ${allowed}: lower "${scope}.${f}" to ${f === "words" ? ceil10(n) : n}`);
  };
  for (const f of FIELDS) field("plan", f, budgetFor(kind, BUDGETS, f, w.plan[f] ? r.households[w.plan[f][1]] : null));
  for (const f of FIELDS) field("empty", f, EMPTY_BUDGET[f] ?? null);
  for (const scope of ["plan", "empty"]) for (const f of Object.keys(ent[scope] ?? {})) if (!w[scope][f] && !HOUSEHOLDS.some((who) => r.households[who]?.error)) notes.push(`lower me: "${scope}.${f}" has an entry but nothing to count`);
  // drawing
  for (const who of HOUSEHOLDS) {
    const err = r.households[who]?.error;
    if (err && !(ent.cannotDraw ?? []).includes(who)) fails.push(`cannot draw for ${who}: ${err}`);
    if (!err && (ent.cannotDraw ?? []).includes(who)) notes.push(`draws now for ${who}: take "${who}" off this page's "cannotDraw" (node qa/first-view-node.mjs --write)`);
  }
  // structure
  const by = {};
  for (const c of r.checks) (by[c.id] ??= []).push(c);
  for (const [id, list] of Object.entries(by)) {
    const allowed = ent.checks?.[id] ?? 0;
    if (list.length > allowed) fails.push(`${id}: ${list.length} time(s)${allowed ? `, the entry allows ${allowed}` : ""}. ${list.slice(0, 3).map((c) => `${c.who}: ${c.what}`).join("; ")}`);
  }
  for (const [id, n] of Object.entries(ent.checks ?? {})) { const now = by[id]?.length ?? 0; if (now < n) notes.push(`lower me: ${id} happens ${now} time(s), the entry says ${n}${now ? "" : " (delete it)"}`); }
  for (const x of r.notes) notes.push(x);
  return { fails, notes };
}

// ---------------------------------------------------------------- the counts file
export function readKnown() { try { return JSON.parse(fs.readFileSync(KNOWN_FILE, "utf8")); } catch { return {}; } }
export function writeKnown(entries) {
  const keys = Object.keys(entries).filter((k) => !k.startsWith("_")).sort();
  const lines = keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(entries[k])}`);
  const head = `  "_read": ${JSON.stringify(entries._read ?? "")}`;
  fs.writeFileSync(KNOWN_FILE, `{\n${[head, ...lines].join(",\n")}\n}\n`);
  return KNOWN_FILE;
}

// ---------------------------------------------------------------- one shard of npm test
/**
 * defineShard(test, n, kindsFile): one node:test test per page of shard n (tests/first-view.kinds.mjs), each drawing
 * the page for every household and failing on a count above its budget or entry; claude-a's folders print their to-do
 * lines and never fail; a last test prints the shard's time (at most 15 s on the builders' 4-core machine: split a shard
 * that passes it).
 */
export async function defineShard(test, n, K) {
  const t0 = performance.now(), c0 = process.cpuUsage();
  await loadApp();
  const known = readKnown();
  const pages = Object.entries(K.KINDS).filter(([, [, s]]) => s === n).map(([k]) => k).sort();
  const totals = { pages: 0, over: 0, lane: 0 };
  for (const key of pages) {
    const [kind] = K.KINDS[key];
    const lane = K.CLAUDE_A_LANE.includes(key);
    test(`${key} (${kind})${lane ? " claude-a's folder: to-do lines only" : ""}`, async (t) => {
      const r = await measurePage(key, { moved: K.MOVED_NOTICES[key] ?? [] });
      const v = judge(r, kind, lane ? null : known[key], K);
      totals.pages++;
      if (lane) { totals.lane++; for (const x of [...v.fails, ...v.notes]) t.diagnostic(`to-do (claude-a's folder): ${x}`); return; }
      if (known[key]) totals.over++;
      for (const x of v.notes) t.diagnostic(x);
      if (v.fails.length) throw new Error(`${key}: ${v.fails.length} problem(s) on the first view:\n  ${v.fails.join("\n  ")}\nA deliberate change: node qa/first-view-node.mjs --write, then read the diff of tests/first-view.known.json like code.`);
    });
  }
  test(`shard ${n}: ${pages.length} pages, its time`, (t) => {
    const s = (performance.now() - t0) / 1000, c = process.cpuUsage(c0), cpu = (c.user + c.system) / 1e6;
    for (const x of lateAfter) t.diagnostic(`an error well after a page's draw: ${x}`);
    t.diagnostic(`shard ${n}: ${pages.length} pages (${totals.over} with an entry in the counts file, ${totals.lane} in claude-a's folders) in ${s.toFixed(1)} s (${cpu.toFixed(1)} s of processor time); at most 15 s on the builders' 4-core machine, else split it`);
  });
}

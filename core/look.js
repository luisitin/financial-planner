// core/look.js -- how this phone looks (Settings > "Screen"; the menu's "Hide amounts" row).
//
//   import { look } from "./look.js";
//   look.start();                         // the shell, once at boot: text size, light or dark, and the hiding
//   look.set({ hide: true });             // a tick, a chip or the menu's row: kept on this phone, acts at once
//   look.chosen                           // { hide, text: "usual" | "larger" | "largest", theme: "phone" | "light" | "dark" }
//
// Three choices of this device, never of the plan, in ONE localStorage key, planner.look (planner.look.sandbox in the
// sandbox): { fmt: 1, hide?: 1, text?: "larger" | "largest", theme?: "light" | "dark" }. Nothing stored means the app
// looks as it always did. Never sent to the computer, never in a downloaded copy; it holds no figure and no name.
//   hide   every money amount drawn on screen reads "$•••" (core/format.js maskAmounts): the text under <body> is masked
//          as it is drawn (a MutationObserver, so an answer that arrives later, a green line and the bottom note are
//          covered before they are painted), and so are the words a screen reader says for a thing (aria-label,
//          title: SAID_ATTRS). A chart keeps its shape; the figures along its side go. Boxes a person types in are left alone, and a printout shows the amounts
//          (they are put back while the browser prints). The plan and core/format.js money() are untouched.
//   text   <html data-text="larger" | "largest">: core/ui/base.css steps every --fs-* token up (17 px and 19 px base).
//   theme  <html data-theme="light" | "dark">: core/ui/base.css; the color-scheme and theme-color metas follow.
// index.html sets data-text and data-theme itself before the first paint (its <script id="look">, the same key and the
// same reading); start() says the same again and adds what needs the app.
// ?look=largest | larger | light | dark | hide (commas between) in the address: for this visit only, never stored
// (screenshots and checks). Imports core/format.js only; safe to import in Node (nothing runs without a document).
import { maskAmounts, maskAxisLabel, setHidden } from "./format.js";

const SANDBOX = (() => { try { return new URLSearchParams(globalThis.location?.search ?? "").has("sandbox"); } catch { return false; } })();
export const LOOK_KEY = SANDBOX ? "planner.look.sandbox" : "planner.look";
export const TEXTS = Object.freeze(["usual", "larger", "largest"]);
export const THEMES = Object.freeze(["phone", "light", "dark"]);
/** The top bar's colour for a chosen theme (--panel in core/ui/base.css), for the browser's own bar. */
export const BAR = Object.freeze({ light: "#ffffff", dark: "#181c22" });

const storage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
let mem = null;                    // the copy in memory (a private window keeps only this, for the visit)
function load() {
  if (mem) return mem;
  mem = { hide: false, text: "usual", theme: "phone" };
  let raw = null;
  try { raw = JSON.parse(storage()?.getItem(LOOK_KEY) ?? "null"); } catch { raw = null; }
  if (!raw || typeof raw !== "object" || raw.fmt !== 1) return mem;   // nothing, or not ours: read as nothing stored
  mem.hide = raw.hide === 1;
  if (raw.text === "larger" || raw.text === "largest") mem.text = raw.text;
  if (raw.theme === "light" || raw.theme === "dark") mem.theme = raw.theme;
  return mem;
}
function save() {
  const m = mem;
  try {
    const s = storage(); if (!s) return;
    if (!m.hide && m.text === "usual" && m.theme === "phone") { s.removeItem(LOOK_KEY); return; }
    const out = { fmt: 1 };
    if (m.hide) out.hide = 1;
    if (m.text !== "usual") out.text = m.text;
    if (m.theme !== "phone") out.theme = m.theme;
    s.setItem(LOOK_KEY, JSON.stringify(out));
  } catch { /* full or blocked: the copy in memory serves this visit */ }
}
/** What the address asks for this visit: { hide?, text?, theme? }; never stored. */
function visitAsk() {
  try {
    const words = String(new URLSearchParams(globalThis.location?.search ?? "").get("look") ?? "").split(",");
    const out = {};
    if (words.includes("hide")) out.hide = true;
    for (const t of ["larger", "largest"]) if (words.includes(t)) out.text = t;
    for (const t of ["light", "dark"]) if (words.includes(t)) out.theme = t;
    return out;
  } catch { return {}; }
}

/** What is said in green when the amounts are hidden or shown again (the menu's row and Settings' tick say the same). */
export const HIDE_WORDS = Object.freeze({
  on: "Done. Amounts on this phone now read as dots. \"Show amounts\" in the menu brings them back.",
  off: "Done. Amounts show again.",
});

// ---------------------------------------------------------------- the amounts on screen
const SKIP = new Set(["INPUT", "TEXTAREA", "SELECT", "OPTION", "SCRIPT", "STYLE"]);
// what a screen reader says for a thing and what a long press or a pointer shows: covered like the text, so a hidden
// amount is not read out loud either (a tile's "Left over each month: $3,884" name)
export const SAID_ATTRS = Object.freeze(["aria-label", "title", "aria-description", "aria-valuetext", "alt"]);
const SAID_SEL = SAID_ATTRS.map((a) => `[${a}]`).join(",");
const covered = new WeakMap();     // a text node -> { was, now }: what it said, and the dots put in its place
const coveredSaid = new WeakMap(); // an element -> { [attribute]: { was, now } }: the same for its spoken words
let watcher = null, printing = false;
/** Inside a box a person types in or picks from: left as it is (a form opened on purpose shows its own boxes). */
function inBox(node) {
  for (let p = node.parentNode; p && p.nodeType === 1; p = p.parentNode) if (SKIP.has(String(p.tagName).toUpperCase()) || p.isContentEditable) return true;
  return false;
}
function cover(node) {
  const said = node.nodeValue ?? "", rec = covered.get(node);
  if (rec && rec.now === said) return;            // already dots
  // a chart keeps its shape; the figures along its side ("418k", "1.3M": no currency sign) go too
  const inChart = /^(text|tspan)$/i.test(String(node.parentNode?.tagName ?? ""));
  const dots = inChart ? maskAxisLabel(maskAmounts(said)) : maskAmounts(said);
  if (dots === said) { if (rec) covered.delete(node); return; }
  if (inBox(node)) return;
  covered.set(node, { was: said, now: dots });
  node.nodeValue = dots;
}
/** One element's spoken words (SAID_ATTRS): an amount in them reads as dots too. `only`: the one attribute that changed. */
function coverSaid(el, only = null) {
  if (typeof el?.getAttribute !== "function") return;
  const recs = coveredSaid.get(el);
  for (const name of only ? [only] : SAID_ATTRS) {
    const said = el.getAttribute(name), rec = recs?.[name];
    if (said === null || said === undefined) { if (rec) delete recs[name]; continue; }
    if (rec && rec.now === said) continue;        // already dots
    const dots = maskAmounts(said);
    if (dots === said) { if (rec) delete recs[name]; continue; }
    const mine = coveredSaid.get(el) ?? {}; coveredSaid.set(el, mine);
    mine[name] = { was: said, now: dots };
    el.setAttribute(name, dots);
  }
}
function uncoverSaid(el) {
  const recs = coveredSaid.get(el); if (!recs) return;
  coveredSaid.delete(el);
  for (const [name, rec] of Object.entries(recs)) if (el.getAttribute(name) === rec.now) el.setAttribute(name, rec.was);
}
function eachText(root, fn) {
  if (!root) return;
  if (root.nodeType === 3) { fn(root); return; }
  if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
  const doc = root.ownerDocument ?? root;
  const walk = doc.createTreeWalker?.(root, 4 /* NodeFilter.SHOW_TEXT */);
  if (!walk) return;
  const all = [];
  for (let n = walk.nextNode(); n; n = walk.nextNode()) all.push(n);
  for (const n of all) fn(n);
}
/** Every element under root (root too) that has spoken words. */
function eachSaid(root, fn) {
  if (!root || root.nodeType === 3) return;
  if (root.nodeType === 1 && typeof root.getAttribute === "function" && SAID_ATTRS.some((a) => root.getAttribute(a) !== null && root.getAttribute(a) !== undefined)) fn(root);
  for (const el of root.querySelectorAll?.(SAID_SEL) ?? []) fn(el);
}
const coverUnder = (n) => { eachText(n, cover); eachSaid(n, (el) => coverSaid(el)); };
/** Cover every amount drawn under root (the page body): its text, and the words a screen reader says for a thing. */
export function coverAll(root = globalThis.document?.body) { coverUnder(root); }
/** Put back every amount this file covered under root (the hiding turned off; a printout). */
export function uncoverAll(root = globalThis.document?.body) {
  eachText(root, (n) => { const rec = covered.get(n); if (!rec) return; covered.delete(n); if (n.nodeValue === rec.now) n.nodeValue = rec.was; });
  eachSaid(root, uncoverSaid);
}
function watch(on) {
  const body = globalThis.document?.body;
  if (!body || typeof MutationObserver !== "function") return;
  if (!on) { watcher?.disconnect(); watcher = null; uncoverAll(body); return; }
  if (watcher) return;
  // before the next paint: what a page draws (now or when an answer arrives) is covered before a person can read it
  watcher = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === "characterData") cover(m.target);
      else if (m.type === "attributes") coverSaid(m.target, m.attributeName);
      else for (const n of m.addedNodes) coverUnder(n);
    }
  });
  watcher.observe(body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...SAID_ATTRS] });
  coverAll(body);
}

// ---------------------------------------------------------------- the three choices
function apply() {
  const now = look.now;
  setHidden(now.hide);
  watch(now.hide && !printing);
  const doc = globalThis.document, root = doc?.documentElement;
  if (!root?.dataset) return;
  if (now.text === "usual") delete root.dataset.text; else root.dataset.text = now.text;
  if (now.theme === "phone") delete root.dataset.theme; else root.dataset.theme = now.theme;
  try {
    // the browser's own parts (the boxes' pickers, the scroll bar, the bar above the page) follow the choice
    const scheme = doc.querySelector('meta[name="color-scheme"]');
    if (scheme) scheme.setAttribute("content", now.theme === "phone" ? "light dark" : now.theme);
    for (const meta of doc.querySelectorAll('meta[name="theme-color"]')) {
      const own = meta.dataset.own ?? (meta.dataset.own = meta.getAttribute("content"));
      meta.setAttribute("content", now.theme === "phone" ? own : BAR[now.theme]);
    }
  } catch { /* no metas here (the single-file copy in a frame): the page's own colours still follow */ }
}

export const look = {
  /** The person's own choices on this phone (what Settings shows). */
  get chosen() { const m = load(); return { hide: m.hide, text: m.text, theme: m.theme }; },
  /** What is in force now: the choices, with what the address asks for this visit on top. */
  get now() { return { ...look.chosen, ...visitAsk() }; },
  /** A tick, a chip or the menu's row. Only the keys given change; kept on this phone and in force at once. Returns `chosen`. */
  set({ hide, text, theme } = {}) {
    const m = load();
    if (hide !== undefined) m.hide = !!hide;
    if (text !== undefined && TEXTS.includes(text)) m.text = text;
    if (theme !== undefined && THEMES.includes(theme)) m.theme = theme;
    save(); apply();
    return look.chosen;
  },
  /** Settings' "Erase the copy on this device": the phone looks as it did on the first day. */
  forget() { mem = { hide: false, text: "usual", theme: "phone" }; save(); apply(); },
  /** The shell, once at boot: puts the choices in force, and shows the amounts while the browser prints. */
  start() {
    apply();
    if (typeof addEventListener !== "function" || !globalThis.document?.documentElement || document.documentElement.dataset.lookPrint) return look;
    document.documentElement.dataset.lookPrint = "1";   // a second copy of this module installs nothing
    // printing is deliberate: the paper shows the amounts, and the screen hides them again after
    addEventListener("beforeprint", () => { printing = true; watch(false); });
    addEventListener("afterprint", () => { printing = false; watch(look.now.hide); });
    return look;
  },
};

/** For tests only: read the key again on next use. */
export const _test = { reset() { mem = null; watcher?.disconnect(); watcher = null; printing = false; setHidden(false); } };

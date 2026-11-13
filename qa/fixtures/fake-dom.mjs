// qa/fixtures/fake-dom.mjs -- just enough of a DOM to run a page's view.js in a Node test with the real UI kit
// (core/ui/dom.js) and read what it says, or type into a box and read it again. Importing it puts a stand-in
// `document`, `Node` and `window` on globalThis; `node --test` runs each test file in its own process, so it never
// leaks into another file's tests. Not a browser: no layout, no CSS, no events beyond what a test dispatches.
class FakeNode { constructor() { this.parentNode = null; this.childNodes = []; } }
class FakeText extends FakeNode { constructor(t) { super(); this.data = String(t); this.raw = t === null || t === undefined; } get textContent() { return this.data; } set textContent(v) { this.data = String(v); } }
class FakeElement extends FakeNode {
  constructor(tag) { super(); this.tagName = String(tag).toUpperCase(); this.attrs = {}; this.listeners = {}; this.style = {}; this.dataset = {}; this.hidden = false; this.validity = ""; }
  get className() { return this.attrs.class ?? ""; } set className(v) { this.attrs.class = String(v); }
  get classList() { const el = this; const list = () => el.className.split(/\s+/).filter(Boolean); return { add: (...c) => { el.className = [...new Set([...list(), ...c])].join(" "); }, remove: (...c) => { el.className = list().filter((x) => !c.includes(x)).join(" "); }, contains: (c) => list().includes(c), toggle: (c, on) => { const has = list().includes(c); if (on ?? !has) { if (!has) el.className = [...list(), c].join(" "); } else el.className = list().filter((x) => x !== c).join(" "); } }; }
  setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return this.attrs[k] ?? null; } hasAttribute(k) { return k in this.attrs; } removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, f) { (this.listeners[t] ??= []).push(f); } removeEventListener(t, f) { this.listeners[t] = (this.listeners[t] ?? []).filter((x) => x !== f); }
  dispatch(t, ev = {}) { for (const f of this.listeners[t] ?? []) f({ target: this, currentTarget: this, preventDefault() {}, stopPropagation() {}, ...ev }); }
  click() { if (!this.disabled) this.dispatch("click"); }
  setCustomValidity(why) { this.validity = why; } reportValidity() { return !this.validity; } checkValidity() { return !this.validity; }
  focus() {} blur() {} scrollIntoView() {}
  // a null or undefined handed to append / prepend / before / after is written as the word, as a browser does ("null" on the
  // screen; ui.h leaves them out itself, so only a direct call shows it), and textOf refuses to read past it (review
  // 2026-11-13, F1: a "null" under the tax answers on Contributions that no test could see)
  append(...ns) { for (const n of ns.flat(Infinity)) { const c = n instanceof FakeNode ? n : new FakeText(n); if (c.parentNode) c.remove(); c.parentNode = this; this.childNodes.push(c); } }
  prepend(...ns) { const keep = this.childNodes; this.childNodes = []; this.append(...ns); for (const c of keep) this.childNodes.push(c); }
  replaceChildren(...ns) { for (const c of this.childNodes) c.parentNode = null; this.childNodes = []; this.append(...ns); }
  replaceWith(n) { const p = this.parentNode; if (!p) return; const i = p.childNodes.indexOf(this); const c = n instanceof FakeNode ? n : new FakeText(n); if (c.parentNode) c.remove(); c.parentNode = p; p.childNodes[i] = c; this.parentNode = null; }
  remove() { if (this.parentNode) { this.parentNode.childNodes = this.parentNode.childNodes.filter((c) => c !== this); this.parentNode = null; } }
  // siblings put in before or after this one (Element.before / after)
  before(...ns) { this.#beside(0, ns); } after(...ns) { this.#beside(1, ns); }
  #beside(off, ns) { const p = this.parentNode; if (!p) return; const add = ns.flat(Infinity).map((n) => (n instanceof FakeNode ? n : new FakeText(n))); for (const c of add) if (c.parentNode) c.remove(); const i = p.childNodes.indexOf(this) + off; for (const c of add) c.parentNode = p; p.childNodes.splice(i, 0, ...add); }
  get children() { return this.childNodes.filter((c) => c instanceof FakeElement); }
  get firstChild() { return this.childNodes[0] ?? null; }
  get textContent() { return this.childNodes.map((c) => c.textContent).join(""); }
  set textContent(v) { this.replaceChildren(); if (v !== "" && v !== null && v !== undefined) this.append(String(v)); }
  set innerHTML(v) { this.replaceChildren(); } get innerHTML() { return ""; }
  get disabled() { return this.hasAttribute("disabled"); } set disabled(v) { if (v) this.setAttribute("disabled", ""); else this.removeAttribute("disabled"); }
  get checked() { return this.hasAttribute("checked"); } set checked(v) { if (v) this.setAttribute("checked", ""); else this.removeAttribute("checked"); }
  get value() { if (this.tagName === "SELECT") { const opts = this.all().filter((e) => e.tagName === "OPTION"); const s = opts.find((o) => o._sel ?? o.hasAttribute("selected")) ?? opts[0]; return s ? s.getAttribute("value") : ""; } return this.attrs.value ?? ""; }
  set value(v) { if (this.tagName === "SELECT") { for (const o of this.all().filter((e) => e.tagName === "OPTION")) o._sel = o.getAttribute("value") === String(v); } else this.attrs.value = String(v); }
  all() { const out = []; const walk = (e) => { for (const c of e.children) { out.push(c); walk(c); } }; walk(this); return out; }
  matches(sel) { if (sel.startsWith(".")) return sel.slice(1).split(".").every((c) => this.classList.contains(c)); const m = /^\[([\w-]+)="([^"]*)"\]$/.exec(sel); if (m) return this.getAttribute(m[1]) === m[2]; return this.tagName === sel.toUpperCase(); }
  closest(sel) { let e = this; while (e && !(e instanceof FakeElement && e.matches(sel))) e = e.parentNode; return e ?? null; }
  querySelector(sel) { return this.all().find((e) => e.matches(sel)) ?? null; }
  querySelectorAll(sel) { return this.all().filter((e) => e.matches(sel)); }
  get isConnected() { return true; }
  // Added for the first-view check (qa/first-view-lib.mjs draws every page): the few calls the pages make that a stand-in
  // lacked. Each does what a browser does with the same call; nothing above changed.
  /** A <details> (or <dialog>) says open as a browser does: the attribute, both ways. No toggle event is sent. */
  get open() { return /^(DETAILS|DIALOG)$/.test(this.tagName) ? this.hasAttribute("open") : this._open; }
  set open(v) { if (/^(DETAILS|DIALOG)$/.test(this.tagName)) { if (v) this.setAttribute("open", ""); else this.removeAttribute("open"); } else this._open = v; }
  get firstElementChild() { return this.children[0] ?? null; }
  get lastElementChild() { const c = this.children; return c[c.length - 1] ?? null; }
  /** A form's named boxes (form.elements.deductible), and by number. Other elements have none, as in a browser. */
  get elements() {
    if (this.tagName !== "FORM") return undefined;
    const list = this.all().filter((e) => /^(INPUT|SELECT|TEXTAREA|BUTTON|FIELDSET)$/.test(e.tagName));
    const out = { length: list.length };
    list.forEach((e, i) => { out[i] = e; const n = e.getAttribute("name"); if (n && !(n in out)) out[n] = e; });
    return out;
  }
  insertBefore(n, ref) {
    if (!ref) { this.append(n); return n; }
    const c = n instanceof FakeNode ? n : new FakeText(n);
    if (c.parentNode) c.remove();
    const i = this.childNodes.indexOf(ref);
    c.parentNode = this;
    if (i < 0) this.childNodes.push(c); else this.childNodes.splice(i, 0, c);
    return c;
  }
  before(...ns) { const p = this.parentNode; if (!p) return; for (const n of ns.flat(Infinity)) if (n !== null && n !== undefined) p.insertBefore(n, this); }
  after(...ns) { const p = this.parentNode; if (!p) return; const i = p.childNodes.indexOf(this); const next = p.childNodes[i + 1] ?? null; for (const n of ns.flat(Infinity)) if (n !== null && n !== undefined) p.insertBefore(n, next); }
}
globalThis.Node = FakeNode;
// CSS.escape for a selector built from an id (a browser has it; Node does not)
globalThis.CSS = globalThis.CSS ?? { escape: (s) => String(s).replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`) };
globalThis.document = { createElement: (t) => new FakeElement(t), createElementNS: (ns, t) => new FakeElement(t), createTextNode: (t) => new FakeText(t), querySelector: () => null, body: new FakeElement("body") };
globalThis.window = globalThis.window ?? { confirm: () => true, addEventListener() {}, location: { hash: "" } };
export { FakeElement };

// ---------------------------------------------------------------- real selectors, for a test that asks for them
// The stand-in above matches ".a.b", [k="v"] and a bare tag, which is what most tests need. fullSelectors() teaches every
// element the selectors a browser knows, for the rest of the calling process: lists (a, b), the combinators (space, >, +,
// ~), tag, *, #id, .class, [k], [k=v], [k="v"], [k^= $= *= ~= |=], :not(), :first-child, :last-child, :only-child,
// :first-of-type, :last-of-type, :checked, :disabled, :empty, :scope. A pseudo-class a still page cannot be in (:hover,
// :focus, ::before) matches nothing. data-* attributes are read from dataset as well. Used by the first-view check
// (qa/first-view-lib.mjs), which draws every page and must see what each page's own querySelector would find.
const SEL = new Map();
const splitTop = (s, sep) => { const out = []; let depth = 0, q = null, cur = ""; for (const ch of s) { if (q) { if (ch === q) q = null; } else if (ch === '"' || ch === "'") q = ch; else if (ch === "(" || ch === "[") depth++; else if (ch === ")" || ch === "]") depth--; else if (depth === 0 && sep.test(ch)) { out.push(cur); cur = ""; continue; } cur += ch; } out.push(cur); return out; };
function parseCompound(src) {
  const c = { tag: null, ids: [], classes: [], attrs: [], pseudos: [] };
  const re = /^(\*|[a-zA-Z][\w-]*)|#([\w-]+)|\.([\w-]+)|\[\s*([\w-]+)\s*(?:([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]*)))?\s*\]|::?([\w-]+)(?:\(((?:[^()]|\([^()]*\))*)\))?/y;
  let i = 0;
  while (i < src.length) {
    re.lastIndex = i; const m = re.exec(src);
    if (!m) return null;
    if (m[1]) c.tag = m[1] === "*" ? null : m[1].toUpperCase();
    else if (m[2]) c.ids.push(m[2]);
    else if (m[3]) c.classes.push(m[3]);
    else if (m[4]) c.attrs.push({ k: m[4], op: m[5] ?? null, v: m[6] ?? m[7] ?? m[8] ?? "" });
    else if (m[9]) c.pseudos.push({ name: m[9].toLowerCase(), arg: m[10] ?? null, el: src.slice(i).startsWith("::") });
    i = re.lastIndex;
  }
  return c;
}
/** A selector list as [[compound, combinator, compound, ...], ...]; null parts never match. */
export function parseSelector(sel) {
  if (SEL.has(sel)) return SEL.get(sel);
  const list = splitTop(String(sel), /,/).map((one) => {
    const parts = [];
    const toks = one.trim().replace(/\s*([>+~])\s*/g, " $1 ").split(/\s+/).filter(Boolean);
    for (const t of toks) { if (/^[>+~]$/.test(t)) parts.push(t); else { if (parts.length && typeof parts[parts.length - 1] !== "string") parts.push(" "); parts.push(parseCompound(t)); } }
    return parts;
  });
  SEL.set(sel, list);
  return list;
}
const attrOf = (e, k) => { if (k.startsWith("data-")) { const d = e.dataset?.[k.slice(5).replace(/-([a-z])/g, (_, x) => x.toUpperCase())]; if (d !== undefined) return String(d); } if (k === "id" && e.id !== undefined && !e.hasAttribute("id")) return String(e.id); if (k === "hidden" && e.hidden) return ""; return e.getAttribute(k); };
const sibs = (e) => (e.parentNode ? e.parentNode.childNodes.filter((x) => x instanceof FakeElement) : [e]);
function matchCompound(e, c, scope) {
  if (!c || !(e instanceof FakeElement)) return false;
  if (c.tag && e.tagName !== c.tag) return false;
  for (const id of c.ids) if (attrOf(e, "id") !== id) return false;
  for (const cl of c.classes) if (!e.classList.contains(cl)) return false;
  for (const a of c.attrs) {
    const v = attrOf(e, a.k);
    if (v === null || v === undefined) return false;
    const w = a.v;
    if (a.op === "=" && v !== w) return false;
    if (a.op === "~=" && !v.split(/\s+/).includes(w)) return false;
    if (a.op === "|=" && v !== w && !v.startsWith(w + "-")) return false;
    if (a.op === "^=" && !(w && v.startsWith(w))) return false;
    if (a.op === "$=" && !(w && v.endsWith(w))) return false;
    if (a.op === "*=" && !(w && v.includes(w))) return false;
  }
  for (const p of c.pseudos) {
    const s = sibs(e), same = s.filter((x) => x.tagName === e.tagName);
    if (p.el) return false;
    if (p.name === "not") { if (matchList(e, parseSelector(p.arg ?? ""), scope)) return false; continue; }
    if (p.name === "scope") { if (e !== scope) return false; continue; }
    if (p.name === "first-child") { if (s[0] !== e) return false; continue; }
    if (p.name === "last-child") { if (s[s.length - 1] !== e) return false; continue; }
    if (p.name === "only-child") { if (s.length !== 1) return false; continue; }
    if (p.name === "first-of-type") { if (same[0] !== e) return false; continue; }
    if (p.name === "last-of-type") { if (same[same.length - 1] !== e) return false; continue; }
    if (p.name === "checked") { if (!e.checked) return false; continue; }
    if (p.name === "disabled") { if (!e.disabled) return false; continue; }
    if (p.name === "empty") { if (e.childNodes.length) return false; continue; }
    return false;   // :hover, :focus, :focus-visible, :active ... a page standing still is in none of them
  }
  return true;
}
function matchParts(e, parts, i, scope) {
  if (!matchCompound(e, parts[i], scope)) return false;
  if (i === 0) return true;
  const comb = parts[i - 1];
  if (comb === ">") return e.parentNode instanceof FakeElement && matchParts(e.parentNode, parts, i - 2, scope);
  if (comb === " ") { for (let a = e.parentNode; a instanceof FakeElement; a = a.parentNode) if (matchParts(a, parts, i - 2, scope)) return true; return false; }
  const s = sibs(e), k = s.indexOf(e);
  if (comb === "+") return k > 0 && matchParts(s[k - 1], parts, i - 2, scope);
  if (comb === "~") { for (let j = k - 1; j >= 0; j--) if (matchParts(s[j], parts, i - 2, scope)) return true; return false; }
  return false;
}
function matchList(e, list, scope) { return list.some((parts) => parts.length && !parts.includes(null) && matchParts(e, parts, parts.length - 1, scope)); }
/** How specific a selector (one, not a list) is, as CSS counts it: [ids, classes and attributes and pseudo-classes, tags]. */
export function specificity(sel) {
  const out = [0, 0, 0];
  for (const part of parseSelector(sel)[0] ?? []) {
    if (!part || typeof part === "string") continue;
    out[0] += part.ids.length; out[1] += part.classes.length + part.attrs.length; out[2] += part.tag ? 1 : 0;
    for (const p of part.pseudos) { if (p.name === "not") { const n = specificity(p.arg ?? ""); out[0] += n[0]; out[1] += n[1]; out[2] += n[2]; } else if (p.el) out[2]++; else out[1]++; }
  }
  return out;
}
/** Every element knows real selectors from now on, in this process (see above). */
export function fullSelectors() {
  const P = FakeElement.prototype;
  if (P.fullSelectors) return;
  P.fullSelectors = true;
  P.matches = function (sel) { return matchList(this, parseSelector(sel), null); };
  P.closest = function (sel) { const list = parseSelector(sel); let e = this; while (e && !(e instanceof FakeElement && matchList(e, list, null))) e = e.parentNode; return e ?? null; };
  P.querySelectorAll = function (sel) { const list = parseSelector(sel); return this.all().filter((e) => matchList(e, list, this)); };
  P.querySelector = function (sel) { const list = parseSelector(sel); return this.all().find((e) => matchList(e, list, this)) ?? null; };
}

/** The visible words under an element, spaces squeezed (hidden elements left out, as a browser shows them); throws on a
 * visible "null" or "undefined" that came from a null handed to the DOM (see append). */
export function textOf(el) {
  if (!el) return "";
  const raw = (n) => { throw new Error(`the page shows the word "${n.data}": a ${n.data} was handed to append, before or after (a browser writes it as text; leave it out instead)`); };
  const walk = (n) => (n instanceof FakeText ? (n.raw ? raw(n) : n.data) : n.hidden ? "" : n.childNodes.map(walk).join(" "));
  return walk(el).replace(/\s+/g, " ").trim();
}

/**
 * renderPage(viewUrl, plan, today, { computeOf, computeRemote, route }) -> { root, text(), saved, remote }: the page's
 * render(root, ctx) with the real UI kit and formatting, the plan migrated as the store holds it, `store.update` recorded
 * in `saved` (the draft after each update) and never re-rendered. `computeOf` maps "group/id" to a compute function for
 * pages that read another page's figures through ctx.computeOf; `computeRemote` does the same for pages that ask the PC
 * (ctx.computeRemote: each call is recorded in `remote` as { key, params }, and the page's promise has settled before
 * this returns). `route` is ctx.route ({ rest, query }).
 */
export async function renderPage(viewUrl, plan, today, { computeOf = {}, computeRemote = {}, route = { rest: [] } } = {}) {
  const ui = await import("../../core/ui/dom.js");
  const fmt = await import("../../core/format.js");
  const { migrate } = await import("../../core/schema/migrate.js");
  const { render } = await import(viewUrl);
  const p = migrate(structuredClone(plan));
  const saved = [], remote = [];
  const root = new FakeElement("main");
  const ctx = { ui, fmt: { ...fmt, today: () => today }, plan: p, route, store: { get: () => p, update: (fn) => { const d = structuredClone(p); fn(d); saved.push(d); } },
    computeOf: (key, params = {}) => (computeOf[key] ? computeOf[key](p, { today, ...params }) : null),
    computeRemote: async (key, params = {}) => { remote.push({ key, params }); return computeRemote[key] ? computeRemote[key](p, { today, ...params }) : null; } };
  render(root, ctx);
  await new Promise((r) => setTimeout(r, 0));
  return { root, text: () => textOf(root), saved, remote };
}
/** The words a page shows for a plan on a day. */
export async function pageText(viewUrl, plan, today, opts) { return (await renderPage(viewUrl, plan, today, opts)).text(); }

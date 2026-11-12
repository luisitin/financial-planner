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
}
globalThis.Node = FakeNode;
globalThis.document = { createElement: (t) => new FakeElement(t), createElementNS: (ns, t) => new FakeElement(t), createTextNode: (t) => new FakeText(t), querySelector: () => null, body: new FakeElement("body") };
globalThis.window = globalThis.window ?? { confirm: () => true, addEventListener() {}, location: { hash: "" } };
export { FakeElement };

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

// The form kit's page helpers (wave 1, forms; docs/CONVENTIONS.md "Forms: asking, checking, answering"): ui.reveal,
// ui.spanOf, ui.openUnder, ui.fieldError and ui.numberBox, run on the browser's path (not the no-document one) in a small
// stand-in screen: a top bar 56 px tall, a phone screen 844 px tall and a scroll position. Each element's place on the
// screen is set by the test (`rect`); the stand-in reads only the selectors the kit asks for, and says so otherwise.
import test from "node:test";
import assert from "node:assert/strict";

const SCREEN = 844, BAR = 56, MARGIN = 8;
const log = [];                     // what the kit did to the screen, in order: "planner:reveal", "scroll <y>"
let frames = [];                    // requestAnimationFrame callbacks waiting

class N {
  constructor() { this.parentNode = null; this.childNodes = []; }
  get isConnected() { let n = this; while (n.parentNode) n = n.parentNode; return n === doc.body; }
  get parentElement() { return this.parentNode instanceof E ? this.parentNode : null; }
  contains(x) { for (let n = x; n; n = n.parentNode) if (n === this) return true; return false; }
  remove() { const p = this.parentNode; if (p) { p.childNodes.splice(p.childNodes.indexOf(this), 1); this.parentNode = null; } }
  after(n) { const p = this.parentNode; if (n.parentNode) n.remove(); p.childNodes.splice(p.childNodes.indexOf(this) + 1, 0, n); n.parentNode = p; }
  before(n) { const p = this.parentNode; if (n.parentNode) n.remove(); p.childNodes.splice(p.childNodes.indexOf(this), 0, n); n.parentNode = p; }
}
class T extends N { constructor(t) { super(); this.data = String(t); } get textContent() { return this.data; } }
/** One compound selector: tag, .class, [attr], [attr="v"], :not([attr]) (all the kit's helpers ask for). */
function one(el, s) {
  const m = /^([a-z0-9]*)((?:\.[\w-]+)*)((?:\[[\w-]+(?:="[^"]*")?\])*)((?::not\(\[[\w-]+\]\))*)$/i.exec(s.trim());
  if (!m) throw new Error(`the stand-in does not read the selector "${s}"`);
  const [, tag, cls, attrs, nots] = m;
  if (tag && el.tagName !== tag.toUpperCase()) return false;
  const have = el.className.split(/\s+/);
  for (const c of cls.split(".").filter(Boolean)) if (!have.includes(c)) return false;
  for (const [, k, v] of attrs.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) if (!el.hasAttribute(k) || (v !== undefined && el.getAttribute(k) !== v)) return false;
  for (const [, k] of nots.matchAll(/:not\(\[([\w-]+)\]\)/g)) if (el.hasAttribute(k)) return false;
  return true;
}
class E extends N {
  constructor(tag) { super(); this.tagName = String(tag).toUpperCase(); this.attrs = {}; this.dataset = {}; this.style = {}; this.listeners = {}; this.rect = null; this.validationMessage = ""; }
  setAttribute(k, v) { this.attrs[k] = String(v); } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  hasAttribute(k) { return k in this.attrs; } removeAttribute(k) { delete this.attrs[k]; }
  get className() { return this.attrs.class ?? ""; } set className(v) { this.attrs.class = String(v); }
  get id() { return this.attrs.id ?? ""; }
  get open() { return this.hasAttribute("open"); } set open(v) { if (v) this.setAttribute("open", ""); else this.removeAttribute("open"); }
  get value() { return this.attrs.value ?? ""; } set value(v) { this.attrs.value = String(v); }
  get children() { return this.childNodes.filter((c) => c instanceof E); }
  get textContent() { return this.childNodes.map((c) => c.textContent).join(""); }
  set textContent(v) { for (const c of [...this.childNodes]) c.remove(); this.append(String(v)); }
  addEventListener(t, f) { (this.listeners[t] ??= []).push(f); }
  dispatch(t) { for (const f of this.listeners[t] ?? []) f({ type: t, target: this }); }
  append(...ns) { for (const n of ns) { const c = n instanceof N ? n : new T(n); if (c.parentNode) c.remove(); c.parentNode = this; this.childNodes.push(c); } }
  all() { const out = []; const walk = (e) => { for (const c of e.children) { out.push(c); walk(c); } }; walk(this); return out; }
  matches(sel) { return sel.split(",").some((s) => one(this, s)); }
  closest(sel) { for (let e = this; e instanceof E; e = e.parentNode) if (e.matches(sel)) return e; return null; }
  querySelector(sel) { return this.all().find((e) => e.matches(sel)) ?? null; }
  querySelectorAll(sel) { return this.all().filter((e) => e.matches(sel)); }
  getBoundingClientRect() { const r = this.rect ?? { top: 0, bottom: 0 }; return { top: r.top, bottom: r.bottom, height: r.bottom - r.top, width: r.width ?? (this.rect ? 358 : 0) }; }
  getClientRects() { return this.rect ? [this.getBoundingClientRect()] : []; }
  setCustomValidity(w) { this.validationMessage = String(w); }
  focus() { doc.activeElement = this; }
}
const doc = {
  body: null, activeElement: null, documentElement: { dataset: {} },
  createElement: (t) => new E(t), createTextNode: (t) => new T(t),
  getElementById: (id) => (id === "topbar" ? { getBoundingClientRect: () => ({ top: 0, bottom: BAR }) } : null),
  addEventListener() { }, querySelectorAll: () => [],
};
doc.body = new E("body");
let y = 0;
Object.assign(globalThis, {
  Node: N, Element: E, document: doc, location: { hash: "#/test/helpers" },
  window: { innerHeight: SCREEN, visualViewport: undefined, get scrollY() { return y; }, scrollTo: (x, to) => { y = to; log.push(`scroll ${to}`); }, dispatchEvent: (e) => { log.push(e.type); } },
  addEventListener() { }, requestAnimationFrame: (f) => { frames.push(f); },
});
const ui = await import("../core/ui/dom.js");
const at = (el, top, bottom) => { el.rect = { top, bottom }; return el; };
const onPage = (...els) => { for (const e of els) doc.body.append(e); return els[0]; };
const fresh = (scrollY = 0) => { log.length = 0; frames = []; y = scrollY; doc.activeElement = null; for (const c of [...doc.body.childNodes]) c.remove(); };

test("reveal: nothing moves for something already on the screen (under the top bar, above the bottom edge)", () => {
  fresh(300);
  const el = onPage(at(new E("section"), 100, 500));
  assert.equal(ui.reveal(el), false);
  assert.deepEqual(log, [], "no scroll and no word to the shell");
});
test("reveal: start puts the top just under the top bar, and tells the shell before it scrolls", () => {
  fresh(200);
  const below = onPage(at(new E("section"), 1000, 1100));
  assert.equal(ui.reveal(below), true);
  assert.deepEqual(log, ["planner:reveal", `scroll ${200 + 1000 - (BAR + MARGIN)}`], "planner:reveal first, then the one scroll");
  fresh(500);
  ui.reveal(onPage(at(new E("section"), -200, -100)));
  assert.deepEqual(log, ["planner:reveal", `scroll ${500 - 200 - (BAR + MARGIN)}`], "an answer above the screen comes down to the same line");
});
test("reveal: nearest is the least scroll, center puts a row mid-screen, a tall one starts at the top", () => {
  fresh(0);
  ui.reveal(onPage(at(new E("li"), 900, 1000)), { block: "nearest" });
  assert.deepEqual(log, ["planner:reveal", `scroll ${1000 - (SCREEN - MARGIN)}`], "its bottom just above the screen's edge");
  fresh(0);
  const room = SCREEN - MARGIN - (BAR + MARGIN);
  ui.reveal(onPage(at(new E("li"), 1000, 1100)), { block: "center" });
  assert.deepEqual(log, ["planner:reveal", `scroll ${1000 - (BAR + MARGIN) - (room - 100) / 2}`]);
  fresh(0);
  ui.reveal(onPage(at(new E("section"), 1000, 1000 + room + 50)), { block: "center" });
  assert.deepEqual(log, ["planner:reveal", `scroll ${1000 - (BAR + MARGIN)}`], "taller than the screen: its top, never its middle");
  fresh(0);
  assert.equal(ui.reveal(onPage(new E("div"))), false, "a part with no size (hidden) is left alone");
  assert.deepEqual(log, []);
});
test("reveal: something not on the page yet is waited for (a page still drawing), then brought into view", () => {
  fresh(0);
  const later = at(new E("section"), 1200, 1300);
  assert.equal(ui.reveal(later), false);
  assert.deepEqual(log, [], "nothing yet");
  assert.equal(frames.length, 1, "it looks again on the next frame");
  onPage(later);
  frames.shift()();
  assert.deepEqual(log, ["planner:reveal", `scroll ${1200 - (BAR + MARGIN)}`]);
});
test("spanOf: the stretch from one part to another (a red line and the buttons under it), on the page only while both are", () => {
  fresh(0);
  const line = onPage(at(new E("div"), 600, 640)), buttons = onPage(at(new E("div"), 700, 744));
  const span = ui.spanOf(line, buttons);
  assert.deepEqual([span.getBoundingClientRect().top, span.getBoundingClientRect().bottom, span.getBoundingClientRect().height], [600, 744, 144]);
  assert.equal(span.isConnected, true);
  ui.reveal(span, { block: "nearest" });
  assert.deepEqual(log, [], "both on the screen: nothing moves");
  buttons.remove();
  assert.equal(span.isConnected, false);
});
test("openUnder: a row's form opens in its own holder right under the row; close() takes it away and the focus goes back to the row's button", () => {
  fresh(0);
  const list = onPage(new E("ul"));
  const rows = ["Checking", "Savings", "Car loan"].map((t) => { const li = new E("li"); const b = new E("button"); b.append("Edit"); li.append(t, b); list.append(li); return li; });
  at(rows[1], 700, 760);
  let built = null;
  const close = ui.openUnder(rows[1], (holder) => {
    built = holder;
    const field = at(new E("label"), 770, 900); field.className = "field";
    const box = new E("input"); field.append(box); holder.append(field);
  });
  assert.equal(built.tagName, "LI", "a list row gets a list item as its holder");
  assert.equal(built.className, "rec-form");
  assert.equal(list.children.indexOf(built), 2, "right under the row it edits, above the next row");
  assert.deepEqual(log, ["planner:reveal", `scroll ${900 - (SCREEN - MARGIN)}`], "the row and the first box are brought on screen together (the least scroll)");
  close();
  assert.equal(built.isConnected, false);
  assert.equal(list.children.length, 3);
  assert.equal(doc.activeElement, rows[1].querySelector("button"), "the focus is back on the row's own button");
});
test("openUnder: a table row's holder is a row with one cell across; any other row gets a div; a row not on a page opens nothing", () => {
  fresh(0);
  const table = onPage(new E("tbody"));
  const tr = new E("tr"); for (let i = 0; i < 4; i++) tr.append(new E("td")); table.append(tr);
  let cell = null;
  ui.openUnder(tr, (c) => { cell = c; });
  assert.equal(cell.tagName, "TD");
  assert.equal(cell.getAttribute("colspan"), "4");
  assert.equal(cell.parentNode.className, "rec-form");
  assert.equal(table.children[1], cell.parentNode);
  const box = onPage(new E("div")); const row = new E("div"); box.append(row);
  let holder = null; ui.openUnder(row, (hd) => { holder = hd; });
  assert.equal(holder.tagName, "DIV");
  let called = false;
  const close = ui.openUnder(new E("li"), () => { called = true; });
  assert.equal(called, false, "nothing is built for a row that is not in a list");
  assert.doesNotThrow(close);
});
test("fieldError: a page's own 'no' about one box is said under that box like the kit's, the box is marked and gets the cursor, and the form is kept", () => {
  fresh(0);
  const fold = onPage(new E("details"));
  const field = at(new E("label"), 1500, 1580); field.className = "field";
  const name = new E("span"); name.className = "field-label"; name.append("Year bought");
  const box = new E("input"); box.setAttribute("name", "year");
  const help = new E("small"); help.className = "help"; help.append("The year on the deed.");
  field.append(name, box, help); fold.append(field);
  assert.equal(ui.fieldError(box, "Use a year after 1900."), false, "false: a submit handler returns it and the form stays as typed");
  const words = field.querySelector(".field-error");
  assert.equal(words.textContent, "Use a year after 1900.");
  assert.equal(field.children.indexOf(words), field.children.indexOf(box) + 1, "right under the box, above its help line");
  assert.equal(box.getAttribute("aria-invalid"), "true");
  assert.ok(box.getAttribute("aria-describedby").split(" ").includes(words.id), "the words are the box's description");
  assert.equal(words.hasAttribute("data-kit"), true, "a kit node");
  assert.equal(fold.open, true, "a shut section holding the box opens: a hidden box cannot be fixed");
  assert.equal(doc.activeElement, box, "the cursor is in the box");
  assert.deepEqual(log, ["planner:reveal", `scroll ${1500 - (BAR + MARGIN)}`], "its label comes up under the top bar");
  ui.fieldError(box, "Use a year before 2100.");
  assert.equal(field.querySelectorAll(".field-error").length, 1, "a second 'no' replaces the words in place");
  assert.equal(field.querySelector(".field-error").textContent, "Use a year before 2100.");
});
test("numberBox: a text box the kit reads, with the number pad, its range written on it, a % inside a percent box", () => {
  fresh(0);
  const { box, input } = ui.numberBox({ name: "raise", value: 0.07, percent: true, min: 0, max: 100, label: "Yearly raise" });
  assert.equal(input.value, "7", "a stored 0.07 shows as 7");
  assert.deepEqual([input.getAttribute("type"), input.getAttribute("inputmode"), input.dataset.kind], ["text", "decimal", "percent"]);
  assert.deepEqual([input.getAttribute("min"), input.getAttribute("max")], ["0", "100"]);
  assert.equal(box.className, "unit-in");
  assert.equal(box.querySelector(".unit").textContent, "%");
  input.value = "150"; input.dispatch("input");
  assert.equal(input.validationMessage, "Use a number from 0% to 100%.", "words in the box's own validity, read at the box");
  input.value = "7.5%"; input.dispatch("input"); input.dispatch("change");
  assert.equal(input.validationMessage, "", "right again: no words left behind");
  assert.equal(input.value, "7.5", "leaving it writes the plain number back");
  const n = ui.numberBox({ name: "miles", value: 12000, whole: true });
  assert.equal(n.box, n.input, "a plain number box is the box itself");
  n.input.value = "11,200"; n.input.dispatch("change");
  assert.equal(n.input.value, "11200", "Number(box.value) works after a change");
  n.input.value = "12..5"; n.input.dispatch("input"); n.input.dispatch("change");
  assert.equal(n.input.value, "12..5", "what cannot be read stays as typed");
  assert.equal(n.input.validationMessage, "Type a number, like 12.");
  n.input.value = "2.5"; n.input.dispatch("input");
  assert.equal(n.input.validationMessage, "Use a whole number, like 12.");
  assert.equal(ui.readNumber("11,200"), 11200);
});
test("wordsFor: the kit's words for a box the browser holds back, read off the element's own validity", () => {
  const t = new Date(), today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  const box = (o) => ({ tagName: "INPUT", type: "text", dataset: {}, validity: { valid: false }, ...o });
  assert.equal(ui.wordsFor(box({ validity: { valid: true } })), "", "a box that can go through has no words");
  assert.equal(ui.wordsFor(box({ validity: { valueMissing: true } })), "Fill this in first.");
  assert.equal(ui.wordsFor(box({ dataset: { missing: "Type the amount of the gift." }, validity: { valueMissing: true } })), "Type the amount of the gift.", "the field's own missing words");
  assert.equal(ui.wordsFor(box({ tagName: "SELECT", validity: { valueMissing: true } })), "Choose one first.");
  assert.equal(ui.wordsFor(box({ dataset: { kind: "percent" }, min: "0", max: "100", validity: { rangeOverflow: true } })), "Use a number from 0% to 100%.");
  assert.equal(ui.wordsFor(box({ type: "date", max: today, validity: { rangeOverflow: true } })), "Pick a date that is not in the future.", "a date's max of today, worked out at the box");
  assert.equal(ui.wordsFor(box({ validationMessage: "That is more than a billion: check for an extra digit.", validity: { customError: true } })), "That is more than a billion: check for an extra digit.", "the kit's own words win");
});

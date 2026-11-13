// tests/more.test.mjs -- the helper for optional parts (core/ui/more.js; the rules in docs/OPTIONAL.md): one markup; the
// open-or-shut order (a reason, the person's own last tap, the switch, shut); memory for the reading parts only, on this
// phone, 90 days unseen; the two switches and the address's ?more= for one visit; ?show= once per arrival; lazy bodies;
// the status line; rest(), parts(), links(), choice(). Drawings run with the real UI kit on qa/fixtures/fake-dom.mjs, and
// again with the text-only stand-in three module tests use (nodes that only append and say their text): the helper may
// not call a DOM method such a stand-in lacks. How the memory meets wave 1's record of each screen: tests/place.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const store = new Map();
const memStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.localStorage = memStorage;
const { textOf } = await import("../qa/fixtures/fake-dom.mjs");
const ui = await import("../core/ui/dom.js");
const fmt = await import("../core/format.js");
const M = await import("../core/ui/more.js");
const { part, parts, rest, choice, links, statusOf, detail, kept, openAll, forgetAll, _test, MORE_KEY, KEEP_DAYS, KEPT_KINDS, WORKING_KINDS, STATUS_MAX, MAX_PARTS, FIRST_ROWS, MAX_ENTRIES, TITLES } = M;

const DAY = 864e5;
const T0 = Date.UTC(2026, 10, 13, 12);
const D0 = Math.floor(T0 / DAY);
const tick = () => new Promise((r) => setTimeout(r, 0));
const ctxOf = (query = {}, kit = ui) => ({ ui: kit, fmt, module: { group: "taxes", id: "federal" }, route: { group: "taxes", id: "federal", rest: [], query } });
const isOpen = (d) => (typeof d.open === "boolean" ? d.open : d.hasAttribute("open"));
const raw = () => (store.has(MORE_KEY) ? JSON.parse(store.get(MORE_KEY)) : null);
const marks = () => Object.fromEntries(Object.entries(raw()?.parts ?? {}).map(([k, v]) => [k, v[0]]));
function fresh() {
  store.clear(); _test.clock(() => T0); _test.reset();
  delete globalThis.location;
  globalThis.localStorage = memStorage;
}
/** A person's tap on the summary: the click (trusted), then the browser's own toggle, then the helper's next tick. */
async function tap(d) {
  d.querySelector("summary").dispatch("click", { isTrusted: true });
  d.open = !isOpen(d);
  await tick();
}
const words = (s) => String(s).replace(/\s+/g, "");
/** The text-only stand-in of modules/taxes/federal/module.test.mjs and modules/cashflow/expenses/module.test.mjs, at its
 * strictest: a node can append and say its text, nothing else (no listeners, no attributes, no remove, no queries). */
function stubUi() {
  const node = (tag, kids = []) => {
    const x = { tag, kids: [], style: {}, append(...k) { for (const c of k.flat(Infinity)) if (c !== null && c !== undefined && c !== false) x.kids.push(c); }, get textContent() { return x.kids.map((c) => (typeof c === "object" ? c.textContent : String(c))).join(" "); } };
    x.append(...kids);
    return x;
  };
  const isAttrs = (a) => a && typeof a === "object" && !Array.isArray(a) && !("kids" in a);
  return { h: (tag, a, ...k) => node(tag, isAttrs(a) ? k : [a, ...k]), card: (t, ...k) => node("card", [t, ...k]), button: (l) => node("button", [l]), notice: (lv, t) => node("notice", [t]), row: (...k) => node("row", k), stat: (l, v, s) => node("stat", [l, v, s]), form: () => node("form"), field: (l, c) => node("field", [l, c]) };
}
const NUMBERS = { id: "numbers", kind: "more", n: 4, noun: "numbers", body: () => ["$1,200", "$3,400"] };
const HOW = { id: "how", kind: "how", says: "11 steps", body: () => ["Your pay, less the standard deduction"] };
const OWN = { id: "itemized", kind: "own", title: "Itemized deductions", body: ["Gifts to charity"] };

// ---------------------------------------------------------------- one markup
test("a part draws shut, with one markup: the title wave 1 names it by, the status beside it, the marker hidden", () => {
  fresh();
  const d = part(ctxOf(), { ...NUMBERS, set: 2 });
  assert.equal(d.tagName, "DETAILS"); assert.equal(isOpen(d), false);
  assert.equal(d.className, "fold", "a row by default"); assert.deepEqual([d.dataset.part, d.dataset.kind], ["numbers", "more"]);
  const sum = d.children[0];
  assert.equal(sum.tagName, "SUMMARY"); assert.equal(sum.style.display, "block", "the summary stays a block (VoiceOver keeps 'collapsed')");
  const row = sum.children[0];
  assert.deepEqual([row.style.display, row.style.minHeight], ["flex", "32px"]);
  assert.equal(d.querySelector(".fold-title").textContent, "4 more numbers");
  assert.equal(d.querySelector(".fold-status").textContent, "2 set by you");
  const chev = d.querySelector(".fold-chev");
  assert.deepEqual([chev.getAttribute("aria-hidden"), chev.textContent], ["true", "›"]);
  assert.equal(textOf(sum), "4 more numbers 2 set by you ›", "a space between title and status");
  for (const tag of ["h1", "h2", "h3", "h4", "a", "button", "input"]) assert.equal(sum.querySelector(tag), null, `no ${tag} inside the summary`);
  const body = d.children[1];
  assert.deepEqual([body.className, body.style.display, body.style.gap], ["fold-body", "grid", "12px"]);
  assert.equal(textOf(body), "$1,200 $3,400");
  assert.equal(part(ctxOf(), { ...HOW, card: true }).className, "card fold fold-card", "card: true is a folded card of its own");
  assert.equal(part(ctxOf(), { ...HOW }).querySelector(".fold-title").textContent, TITLES.how);
  assert.equal(part(ctxOf(), { id: "x", kind: "own", body: [] }).querySelector(".fold-title").textContent, "Set my own numbers");
  assert.equal(part(ctxOf(), { id: "f", kind: "figures", says: "$400,000", body: [] }).querySelector(".fold-status").textContent, "$400,000");
  assert.equal(part(ctxOf(), { id: "x", kind: "how", title: "Where these numbers come from", body: [] }).querySelector(".fold-title").textContent, "Where these numbers come from", "a pinned title");
  assert.equal(part(ctxOf(), { id: "one", kind: "more", n: 1, noun: "numbers", one: "number", body: [] }).querySelector(".fold-title").textContent, "1 more number");
  assert.equal(part(ctxOf(), { id: "x", kind: "how", body: [] }).querySelector(".fold-status"), null, "no status, no empty span");
});
test("a part that breaks a rule is refused in a test (a person's page would still draw it)", () => {
  assert.throws(() => part(ctxOf(), { kind: "how", body: [] }), /needs an id/);
  assert.throws(() => part(ctxOf(), { id: "x", kind: "wall", body: [] }), /unknown kind/);
  assert.throws(() => part(ctxOf(), { id: "x", kind: "item", body: [] }), /needs a title/);
  assert.throws(() => part(ctxOf(), { id: "x", kind: "more", noun: "numbers", body: [] }), /needs n and noun/);
  assert.throws(() => part(ctxOf(), { id: "x", kind: "more", n: 1, noun: "numbers", body: [] }), /needs one/);
});

// ---------------------------------------------------------------- memory: reading parts only, the person's own tap only
test("the person's tap on a reading part is kept on this phone, only while it differs from how the page draws it", async () => {
  fresh();
  const d = part(ctxOf(), NUMBERS);
  await tap(d);
  assert.deepEqual(raw(), { fmt: 1, parts: { "taxes/federal#numbers": [1, D0] } }, "one key, fmt 1, a switch only when on, the day it was last drawn");
  assert.equal(isOpen(part(ctxOf(), NUMBERS)), true, "drawn open again (a redraw, Back, a reload, a new visit)");
  assert.equal(isOpen(part(ctxOf(), HOW)), false, "another part is untouched");
  assert.equal(isOpen(part({ ...ctxOf(), module: { group: "taxes", id: "estimated" } }, NUMBERS)), false, "the same id on another page is another part");
  assert.equal(kept.count(), 1);
  const again = part(ctxOf(), NUMBERS);
  await tap(again);
  assert.equal(isOpen(again), false);
  assert.equal(store.has(MORE_KEY), false, "shut again = as the page draws it = nothing kept; the key goes when it holds nothing");
});
test("only the reading parts are kept: a part with boxes, an item, technical details and the links row are not", async () => {
  fresh();
  assert.deepEqual([...KEPT_KINDS], ["more", "how"]); assert.deepEqual([...WORKING_KINDS], ["more", "how"]);
  for (const o of [OWN, { id: "figs", kind: "figures", body: [] }, { id: "ana", kind: "item", title: "Ana", body: [] }, { id: "tech", kind: "tech", body: [] }, { id: "links", kind: "links", body: [] }]) {
    const d = part(ctxOf(), o);
    await tap(d);
    assert.equal(isOpen(d), true, `${o.kind} opens by a tap`);
    assert.equal(store.has(MORE_KEY), false, `${o.kind}: nothing kept (wave 1 keeps it for the visit)`);
    assert.equal(isOpen(part(ctxOf(), o)), false, `${o.kind}: a new visit draws it shut`);
  }
});
test("only a person's own tap counts: a script's click, find-in-page, a guide step, wave 1 and the printer are not kept", async () => {
  fresh();
  const d = part(ctxOf(), HOW);
  d.querySelector("summary").dispatch("click", { isTrusted: false }); d.open = true; await tick();
  assert.equal(store.has(MORE_KEY), false, "el.click() from a script");
  d.open = false; d.dispatch("toggle"); d.open = true; d.dispatch("toggle"); await tick();
  assert.equal(store.has(MORE_KEY), false, "opened without a tap (find-in-page, a guide step's opens:, wave 1 putting typing back)");
  const host = ui.h("div", {}, parts(ctxOf(), NUMBERS, HOW));
  const shutAgain = openAll(host);
  assert.deepEqual(host.querySelectorAll("details").map(isOpen), [true, true], "printing opens every shut section");
  shutAgain();
  assert.deepEqual(host.querySelectorAll("details").map(isOpen), [false, false], "and shuts the same ones after");
  assert.equal(store.has(MORE_KEY), false);
});
test("a part not drawn for 90 days is forgotten; a drawn part's day is refreshed at most once a day", () => {
  fresh();
  store.set(MORE_KEY, JSON.stringify({ fmt: 1, parts: { "taxes/federal#how": [1, D0 - (KEEP_DAYS - 1)], "taxes/federal#numbers": [1, D0 - KEEP_DAYS], "taxes/federal#odd": [7, D0], "no-hash": [1, D0] } }));
  _test.reset();
  assert.equal(kept.get("taxes/federal", "numbers"), null, "90 days unseen: forgotten");
  assert.deepEqual(Object.keys(raw().parts), ["taxes/federal#how"], "and dropped from the key on that read (with anything that is not an entry)");
  assert.equal(kept.get("taxes/federal", "how"), true, "89 days: still kept");
  assert.equal(raw().parts["taxes/federal#how"][1], D0, "drawn today: its day is today");
  let writes = 0;
  globalThis.localStorage = { ...memStorage, setItem: (k, v) => { writes++; memStorage.setItem(k, v); } };
  for (let i = 0; i < 5; i++) kept.get("taxes/federal", "how");
  assert.equal(writes, 0, "seen again the same day: no write");
  _test.clock(() => T0 + DAY);
  kept.get("taxes/federal", "how"); kept.get("taxes/federal", "how");
  assert.equal(writes, 1, "the next day: one write");
});
test("the key: at most 300 parts, oldest first out; unreadable reads as nothing; storage that throws keeps a copy for the visit", () => {
  fresh();
  for (let i = 0; i <= MAX_ENTRIES; i++) { _test.clock(() => T0 + i * DAY); kept.set("taxes/federal", `p${i}`, true); }
  assert.equal(Object.keys(raw().parts).length, MAX_ENTRIES);
  assert.equal(raw().parts["taxes/federal#p0"], undefined, "the oldest went");
  assert.ok(raw().parts[`taxes/federal#p${MAX_ENTRIES}`]);
  for (const junk of ["{not json", JSON.stringify({ fmt: 2, parts: { "taxes/federal#how": [1, D0] } }), JSON.stringify([1, 2]), "null"]) {
    fresh(); store.set(MORE_KEY, junk); _test.reset();
    assert.equal(kept.count(), 0, junk); assert.equal(detail.working, false);
    kept.set("taxes/federal", "how", true);
    assert.deepEqual(raw(), { fmt: 1, parts: { "taxes/federal#how": [1, D0] } }, "overwritten on the next write");
  }
  fresh();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("blocked"); } });
  try {
    _test.reset();
    kept.set("taxes/federal", "how", true);
    assert.equal(kept.get("taxes/federal", "how"), true, "a private window or a sandboxed frame: the memory lives for the visit");
    assert.equal(isOpen(part(ctxOf(), HOW)), true);
  } finally { Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: memStorage }); }
});
test("the key holds page and part names only: never a figure, a name or anything from an account", async () => {
  fresh();
  detail.set({ working: true, boxes: true });
  const c = ctxOf();
  for (const o of [{ ...NUMBERS, says: "$1,234,567" }, { ...HOW, says: "Ana's pay" }]) { const d = part(c, o); await tap(d); }
  await tap(part(c, { id: "acct", kind: "more", n: 3, noun: "accounts", body: ["Checking 4417"] }));
  const r = raw();
  assert.deepEqual(Object.keys(r).sort(), ["boxes", "fmt", "parts", "working"]);
  for (const [k, v] of Object.entries(r.parts)) { assert.match(k, /^[a-z-]+\/[a-z-]+#[A-Za-z0-9_-]+$/); assert.ok((v[0] === 0 || v[0] === 1) && Number.isInteger(v[1])); }
  assert.ok(!/\$|Ana|Checking|4417/.test(store.get(MORE_KEY)));
  forgetAll();
  assert.equal(store.has(MORE_KEY), false, "Erase the copy on this device: everything goes");
});

// ---------------------------------------------------------------- the order: a reason, the person's last tap, the switch, shut
test("a reason opens a part and is never kept: open: true, something to fix", () => {
  fresh();
  assert.equal(isOpen(part(ctxOf(), { ...OWN, open: true })), true, "the page's reason (just saved, an empty list's form)");
  const d = part(ctxOf(), { ...OWN, fix: 1 });
  assert.equal(isOpen(d), true); assert.equal(d.querySelector(".fold-status").textContent, "1 to fix");
  assert.equal(store.has(MORE_KEY), false);
  assert.equal(isOpen(part(ctxOf(), OWN)), false, "the next draw without the reason: shut");
});
test("?show= opens the part it names, by its id or by a box it holds, once per arrival (a route object)", () => {
  fresh();
  const arrive = (show) => ctxOf({ show });
  let c = arrive("how");
  assert.equal(isOpen(part(c, HOW)), true);
  assert.equal(isOpen(part(c, HOW)), false, "the redraw after a save (the same route object) does not land again");
  assert.equal(isOpen(part(arrive("how"), HOW)), true, "a new arrival (Back to that entry, a link) lands again");
  c = arrive("withheld");
  const figures = { id: "figures", kind: "own", title: "Figures the plan cannot see", holds: ["withheld", "otherIncome"], body: [] };
  const card = parts(c, HOW, figures, { id: "itemized", kind: "own", title: "Itemized deductions", holds: ["withheld"], body: [] });
  assert.deepEqual(card.querySelectorAll("details").map((d) => [d.dataset.part, isOpen(d)]), [["figures", true], ["itemized", false], ["how", false]], "one landing per arrival: the first part that holds the box");
  assert.equal(isOpen(part(arrive("nothing-here"), HOW)), false);
  assert.equal(store.has(MORE_KEY), false, "a landing is never kept");
});
test("open or shut in one order: a stored shut beats the switch; the switch opens 'more' and 'how' and nothing else", async () => {
  fresh();
  detail.set({ working: true });
  const c = ctxOf();
  const all = [NUMBERS, HOW, OWN, { id: "figs", kind: "figures", body: [] }, { id: "ana", kind: "item", title: "Ana", body: [] }, { id: "tech", kind: "tech", body: [] }, { id: "links", kind: "links", body: [] }];
  assert.deepEqual(all.map((o) => [o.kind, isOpen(part(c, o))]), [["more", true], ["how", true], ["own", false], ["figures", false], ["item", false], ["tech", false], ["links", false]]);
  const how = part(c, HOW);
  await tap(how);
  assert.deepEqual(marks(), { "taxes/federal#how": 0 }, "shut against the switch: kept as 0");
  assert.equal(isOpen(part(c, HOW)), false, "the hand beats the switch, on every later draw");
  assert.equal(isOpen(part(c, { ...HOW, open: true })), true, "a reason beats the hand");
  assert.equal(isOpen(part(c, NUMBERS)), true, "other parts still follow the switch");
  detail.set({ working: true });
  assert.deepEqual(marks(), {}, "checking the switch again (either way) forgets the parts shut against it");
  assert.equal(isOpen(part(c, HOW)), true);
  detail.set({ working: false });
  const n = part(c, NUMBERS);
  await tap(n);
  assert.deepEqual(marks(), { "taxes/federal#numbers": 1 }, "opened by hand with the switch off: kept as 1");
  detail.set({ working: true }); detail.set({ working: false });
  assert.deepEqual(marks(), { "taxes/federal#numbers": 1 }, "the switch never forgets what they opened");
  assert.equal(kept.count(), 1);
  assert.equal(kept.clear(), 1, "Shut them all");
  assert.equal(store.has(MORE_KEY), false);
  assert.equal(isOpen(part(c, NUMBERS)), false);
});
test("kept.clear: 'open' forgets the parts opened by hand, 'shut' the ones shut against the switch, 'all' both", () => {
  fresh();
  kept.set("a/b", "x", true); kept.set("a/b", "y", false, true); kept.set("a/c", "z", true);
  assert.equal(kept.count(), 2);
  assert.equal(kept.clear("shut"), 1); assert.deepEqual(marks(), { "a/b#x": 1, "a/c#z": 1 });
  kept.set("a/b", "y", false, true);
  assert.equal(kept.clear("all"), 3); assert.equal(store.has(MORE_KEY), false);
});

// ---------------------------------------------------------------- the two switches
test("both switches are off unless the person checks them; ?more= turns them on for this visit only and is never stored", async () => {
  fresh();
  assert.deepEqual([detail.working, detail.boxes, detail.chosen, detail.forVisit], [false, false, { working: false, boxes: false }, null]);
  for (const [search, want] of [["?more=all", [true, true]], ["?sandbox=1&more=working", [true, false]], ["?more=boxes", [false, true]], ["?more=everything", [false, false]], ["", [false, false]]]) {
    globalThis.location = { search, hash: "" };
    assert.deepEqual([detail.working, detail.boxes], want, search);
  }
  globalThis.location = { search: "?more=all", hash: "" };
  assert.equal(isOpen(part(ctxOf(), HOW)), true, "the switch, for this visit");
  assert.equal(isOpen(part(ctxOf(), OWN)), false);
  assert.deepEqual(detail.chosen, { working: false, boxes: false });
  assert.equal(store.has(MORE_KEY), false, "the address is never stored");
  delete globalThis.location;
  assert.equal(isOpen(part(ctxOf(), HOW)), false, "the next visit, without it: shut");
});
test("detail.init hands the forms switch to the kit; set({ boxes }) tells it at once; both are stored only when on", () => {
  fresh();
  const said = [];
  const kit = { setMoreOpen: (on) => said.push(on) };
  detail.init(kit);
  assert.deepEqual(said, [false]);
  assert.deepEqual(detail.set({ boxes: true }), { working: false, boxes: true });
  assert.deepEqual(said, [false, true]); assert.deepEqual(raw(), { fmt: 1, boxes: 1, parts: {} });
  detail.set({ working: true });
  assert.deepEqual(said, [false, true], "the working switch is the parts' business, not the kit's");
  assert.deepEqual(raw(), { fmt: 1, working: 1, boxes: 1, parts: {} });
  detail.set({ boxes: false, working: false });
  assert.deepEqual(said, [false, true, false]); assert.equal(store.has(MORE_KEY), false);
  globalThis.location = { search: "?more=boxes", hash: "" };
  detail.init(kit);
  assert.equal(said.at(-1), true, "a visit with ?more=boxes opens every form's line");
  delete globalThis.location;
  detail.set({ boxes: true }); forgetAll();
  assert.equal(said.at(-1), false, "erasing tells the kit too");
  detail.init(null);
});
test("the sandbox keeps its own key, so a test run never touches the owner's phone", async () => {
  fresh();
  globalThis.location = { search: "?sandbox=1", hash: "" };
  const S = await import("../core/ui/more.js?sandbox");
  delete globalThis.location;
  assert.equal(S.MORE_KEY, "planner.more.sandbox"); assert.equal(MORE_KEY, "planner.more");
  S.kept.set("taxes/federal", "how", true);
  assert.deepEqual([...store.keys()], ["planner.more.sandbox"]);
});

// ---------------------------------------------------------------- bodies, errors
test("a heavy body is built once: when first opened, at once when a reason or the memory opens it, and for printing", async () => {
  fresh();
  let n = 0;
  const years = { id: "years", kind: "more", n: 26, noun: "years", lazy: true, body: () => { n++; return ["2027 $1", "2028 $2"]; } };
  const d = part(ctxOf(), years);
  assert.equal(n, 0); assert.equal(textOf(d).includes("2027"), false);
  d.open = true; d.dispatch("toggle"); d.dispatch("toggle");
  assert.equal(n, 1); assert.ok(textOf(d).includes("2027 $1"));
  part(ctxOf(), { ...years, open: true }); assert.equal(n, 2, "a reason opens it: built at the draw");
  await tap(part(ctxOf(), years)); assert.equal(n, 3, "the tap that opened it built it");
  part(ctxOf(), years); assert.equal(n, 4, "kept open: built at the draw");
  fresh();
  const host = ui.h("div", {}, part(ctxOf(), years));
  const shutAgain = openAll(host);
  assert.equal(n, 5, "built for printing"); shutAgain(); openAll(host); assert.equal(n, 5, "once");
  let m = 0;
  part(ctxOf(), { ...HOW, body: () => { m++; return ["walk"]; } });
  assert.equal(m, 1, "a function body is not lazy unless asked: the words stay in the page for find-in-page");
});
test("a box held back at Save opens its part; a silent check does not", () => {
  fresh();
  const d = part(ctxOf(), OWN);
  d.dispatch("invalid", { defaultPrevented: true });
  assert.equal(isOpen(d), true);
  const kit = globalThis.document.documentElement;
  globalThis.document.documentElement = { dataset: { formsKit: "1" } };   // the form kit is on the page
  try {
    const e = part(ctxOf(), OWN);
    e.dispatch("invalid", { defaultPrevented: false });
    assert.equal(isOpen(e), false, "checkValidity() is silent: nothing opens");
    e.dispatch("invalid", { defaultPrevented: true });
    assert.equal(isOpen(e), true, "the kit answered a held Save: the part opens");
  } finally { globalThis.document.documentElement = kit; }
  assert.equal(store.has(MORE_KEY), false);
});

// ---------------------------------------------------------------- the status line
test("statuses: the person's state first, in four spellings, never longer than 20 characters, never cut", () => {
  assert.equal(statusOf({ fix: 2, set: 3 }), "2 to fix");
  assert.equal(statusOf({ missing: true, set: 1 }), "not set yet");
  assert.equal(statusOf({ set: 4, guess: 2 }), "4 set by you");
  assert.equal(statusOf({ set: true }), "set by you", "one figure");
  assert.equal(statusOf({ guess: 1 }), "our guess"); assert.equal(statusOf({ guess: true }), "our guess"); assert.equal(statusOf({ guess: 3 }), "3 our guesses");
  assert.equal(statusOf({ says: "2026", set: 1 }), "1 set by you · 2026");
  assert.equal(statusOf({ says: "standard is better", set: 4 }), "4 set by you", "both do not fit: the person's state replaces the words");
  assert.equal(statusOf({ says: "11 steps" }), "11 steps"); assert.equal(statusOf({}), ""); assert.equal(statusOf(), "");
  assert.equal(statusOf({ says: "  $400,000,\n $2,200 rent " }), "$400,000, $2,200 rent");
  for (const st of [{ fix: 12 }, { missing: true }, { set: 99 }, { set: true }, { guess: 1 }, { guess: 14 }]) for (const says of ["", "2026", "11 steps", "$400,000", "standard is better", "x".repeat(STATUS_MAX)]) {
    const s = statusOf({ ...st, says });
    assert.ok(s.length <= STATUS_MAX, `${JSON.stringify(st)} ${says}: "${s}"`);
    assert.match(s, /^(\d+ to fix|not set yet|(\d+ )?set by you|our guess|\d+ our guesses)( · .+)?$/);
    assert.ok(!s.includes("…") && !s.includes("..."));
  }
});

// ---------------------------------------------------------------- rest(), parts(), links(), choice()
test("rest(): six rows, then 'N more <things>'; never hides fewer than three rows, never a row to keep", () => {
  fresh();
  const row = (x) => ui.h("li", {}, x);
  const list = (n) => Array.from({ length: n }, (_, i) => `r${i}`);
  assert.equal(FIRST_ROWS, 6);
  let out = rest(ctxOf(), { id: "accts", items: list(8), row, noun: "accounts" });
  assert.equal(out.length, 1); assert.equal(out[0].children.length, 8, "a list of eight shows eight");
  out = rest(ctxOf(), { id: "accts", items: list(9), row, noun: "accounts" });
  assert.equal(out[0].children.length, 6); assert.equal(out[0].className, "records");
  assert.equal(out[1].querySelector(".fold-title").textContent, "3 more accounts"); assert.equal(out[1].dataset.kind, "more");
  out = rest(ctxOf(), { id: "accts", items: list(10), row, noun: "accounts", keep: (x) => x === "r8" });
  assert.deepEqual(out[0].children.map(textOf), ["r0", "r1", "r2", "r3", "r4", "r5", "r8"], "a row to keep stays among the rows shown, in its place");
  assert.equal(out[1].querySelector(".fold-title").textContent, "3 more accounts");
  out = rest(ctxOf(), { id: "accts", items: list(10), row, noun: "accounts", keep: (x) => x === "r8" || x === "r9" });
  assert.equal(out.length, 1, "two left to hide: everything shows");
  out = rest(ctxOf(), { id: "bills", items: list(10), row, noun: "bills", first: 4 });
  assert.equal(out[0].children.length, 4, "first: 4 for a list in groups");
  out = rest(ctxOf(), { id: "years", items: list(50), row, noun: "years" });
  assert.equal(out[1].querySelector(".fold-title").textContent, "44 more years");
  assert.equal(out[1].querySelector(".fold-body").children.length, 0, "over 40 hidden rows: built when opened");
  out[1].open = true; out[1].dispatch("toggle");
  assert.equal(out[1].querySelector("ul").children.length, 44);
  assert.equal(rest(ctxOf(), { id: "none", items: [], row, noun: "x" })[0].children.length, 0);
});
test("parts(): one card of rows in the fixed order more, own and figures, how; falsy entries skipped; a sixth refused", () => {
  fresh();
  const card = parts(ctxOf(), HOW, false, { id: "figures", kind: "figures", body: [] }, null, { ...NUMBERS, card: true }, OWN);
  assert.equal(card.tagName, "SECTION"); assert.equal(card.className, "card"); assert.equal(card.dataset.parts, "");
  assert.equal(card.children[0].className, "folds");
  assert.deepEqual(card.querySelectorAll("details").map((d) => d.dataset.part), ["numbers", "figures", "itemized", "how"], "own and figures keep the order given");
  assert.deepEqual(card.querySelectorAll("details").map((d) => d.className), ["fold", "fold", "fold", "fold"], "rows, never folded cards");
  assert.equal(parts(ctxOf()), null); assert.equal(parts(ctxOf(), false, null, undefined), null);
  assert.equal(MAX_PARTS, 5);
  const six = Array.from({ length: 6 }, (_, i) => ({ id: `p${i}`, kind: "how", title: `Part ${i}`, body: [] }));
  assert.throws(() => parts(ctxOf(), ...six), /at most 5/);
  assert.doesNotThrow(() => parts(ctxOf(), ...six.slice(0, 5)));
});
test("links(): 'More on this', each row a question with its answer under it; one shut row on a step of a guide", async () => {
  fresh();
  const rows = [{ href: "#/taxes/brackets", ask: "What would more income cost?", says: "22% on the next dollar" }, { href: "#/taxes/projection", ask: "What is the tax in later years?" }];
  const card = links(ctxOf(), rows);
  assert.equal(card.tagName, "SECTION"); assert.equal(card.dataset.links, "");
  assert.equal(card.querySelector("h2").textContent, "More on this");
  const as = card.querySelectorAll("a");
  assert.deepEqual(as.map((a) => [a.getAttribute("href"), a.className]), [["#/taxes/brackets", "row-link"], ["#/taxes/projection", "row-link"]]);
  assert.deepEqual(as.map((a) => textOf(a)), ["What would more income cost? 22% on the next dollar ›", "What is the tax in later years? ›"]);
  assert.equal(card.querySelector("details"), null);
  assert.equal(links(ctxOf(), []), null);
  assert.throws(() => links(ctxOf(), Array.from({ length: 6 }, (_, i) => ({ href: `#/a/b${i}`, ask: `Q${i}?` }))), /at most 5/);
  detail.set({ working: true });
  const step = links(ctxOf({ guide: "plan", step: "tax" }), rows);
  assert.equal(step.tagName, "DETAILS"); assert.equal(isOpen(step), false, "on a step: one shut row, so Next stays near the top (the switch never opens it)");
  assert.deepEqual([step.className, step.dataset.kind, step.querySelector(".fold-title").textContent], ["card fold fold-card", "links", "More on this"]);
  assert.equal(step.querySelectorAll("a").length, 2, "the rows are inside it");
  await tap(step);
  assert.deepEqual(marks(), {}, "never kept");
});
test("choice(): the plan's value is the chip that is on, 'Yours: 5.5%' when it is none of ours; Type my own shows one box; a pick commits once", () => {
  fresh();
  const picks = [];
  const make = (value, own = { type: "percent", label: "Your own return" }) => choice(ctxOf(), { id: "ret", label: "Return a year", presets: [{ value: 0.04, label: "Careful 4%" }, { value: 0.06, label: "Middle 6%" }, { value: 0.08, label: "Hopeful 8%" }], value, own, onPick: (v) => picks.push(v) });
  const chipsOf = (c) => c.querySelectorAll("button").map((b) => [textOf(b), b.className, b.getAttribute("aria-pressed")]);
  let c = make(0.06);
  assert.deepEqual(chipsOf(c), [["Careful 4%", "chip", "false"], ["Middle 6%", "chip on", "true"], ["Hopeful 8%", "chip", "false"], ["Type my own", "chip", "false"]]);
  assert.equal(c.children[0].className, "chips"); assert.equal(c.children[0].getAttribute("aria-label"), "Return a year");
  c = make(0.055);
  assert.deepEqual(chipsOf(c).map((x) => x.slice(0, 2)), [["Careful 4%", "chip"], ["Middle 6%", "chip"], ["Hopeful 8%", "chip"], ["Yours: 5.5%", "chip on"], ["Type my own", "chip"]]);
  c.querySelectorAll("button")[0].click();
  c.querySelectorAll("button")[3].click();
  assert.deepEqual(picks, [0.04], "a chip commits its value; the chip already on does nothing");
  assert.equal(c.querySelector("input"), null, "no box until Type my own");
  const typeMine = c.querySelectorAll("button")[4];
  typeMine.click();
  const box = c.querySelector("input");
  assert.ok(box, "one box, in place (not a part)"); assert.equal(c.querySelectorAll("input").length, 1); assert.equal(c.querySelector("details"), null);
  assert.equal(typeMine.getAttribute("aria-expanded"), "true");
  assert.equal(box.value, "5.5", "the box starts at the plan's figure");
  box.value = "7"; box.dispatch("input"); assert.deepEqual(picks, [0.04], "never per keystroke");
  box.dispatch("change"); assert.deepEqual(picks, [0.04, 0.07], "on the box's change");
  box.value = "abc"; box.dispatch("input"); box.dispatch("change"); assert.deepEqual(picks, [0.04, 0.07], "the kit holds what is not a number");
  typeMine.click(); assert.equal(c.querySelector("input"), null, "the same chip puts the box away");
  const money = choice(ctxOf(), { id: "rent", label: "Rent", presets: [{ value: 1000, label: "$1,000" }], value: 1250, own: { type: "money", label: "Your rent" }, onPick: (v) => picks.push(v) });
  assert.ok(textOf(money).includes("Yours: $1,250"));
  money.querySelectorAll("button")[2].click();
  const m = money.querySelector("input"); m.value = "1,400"; m.dispatch("change");
  assert.equal(picks.at(-1), 1400);
  assert.equal(textOf(choice(ctxOf(), { id: "x", label: "X", presets: [{ value: "a", label: "A" }], value: null, onPick() {} })), "A", "no plan value: nothing on, no Yours, no Type my own without own");
});
test("the helper draws no box of its own: parts, lists, links and a choice's first draw hold no input, select or textarea", () => {
  fresh();
  const host = ui.h("div", {}, parts(ctxOf(), NUMBERS, HOW, OWN), ...rest(ctxOf(), { id: "r", items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], row: (x) => ui.h("li", {}, String(x)), noun: "rows" }),
    links(ctxOf(), [{ href: "#/a/b", ask: "Q?" }]), links(ctxOf({ guide: "plan" }), [{ href: "#/a/b", ask: "Q?" }]),
    choice(ctxOf(), { id: "c", label: "C", presets: [{ value: 1, label: "One" }], value: 2, own: { type: "number", label: "Own" }, onPick() {} }));
  for (const tag of ["input", "select", "textarea"]) assert.equal(host.querySelector(tag), null, tag);
});

// ---------------------------------------------------------------- the text-only stand-in
test("every drawing works under the text-only stand-in and says the same words as with the real kit", () => {
  const draws = {
    part: (c) => part(c, { ...NUMBERS, set: 2 }),
    "a lazy part": (c) => part(c, { id: "y", kind: "more", n: 30, noun: "years", lazy: true, body: () => ["never drawn"] }),
    "a landing": (c) => part({ ...c, route: { ...c.route, query: { show: "how" } } }, HOW),
    parts: (c) => parts(c, HOW, OWN, NUMBERS),
    rest: (c) => c.ui.h("div", {}, ...rest(c, { id: "r", items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], row: (x) => c.ui.h("li", {}, `row ${x}`), noun: "rows" })),
    links: (c) => links(c, [{ href: "#/a/b", ask: "What would more income cost?", says: "22% on the next dollar" }]),
    "links on a step": (c) => links({ ...c, route: { ...c.route, query: { guide: "plan" } } }, [{ href: "#/a/b", ask: "Q?", says: "A" }]),
    choice: (c) => choice(c, { id: "c", label: "Return", presets: [{ value: 0.04, label: "Careful 4%" }], value: 0.055, own: { type: "percent", label: "Own" }, onPick() {} }),
  };
  for (const [name, draw] of Object.entries(draws)) {
    fresh();
    const real = textOf(draw(ctxOf()));
    fresh();
    const stub = stubUi();
    let node;
    assert.doesNotThrow(() => { node = draw(ctxOf({}, stub)); }, name);
    assert.equal(words(node.textContent), words(real), name);
    assert.equal(/null|undefined|NaN|\[object Object\]/.test(node.textContent), false, `${name}: ${node.textContent}`);
  }
});

// ---------------------------------------------------------------- the template adopts it
test("the template page draws its answer, then one parts card and one 'More on this' card, and nothing reads 'null'", async () => {
  const src = fs.readFileSync(path.join(ROOT, "modules/_template/view.js"), "utf8");
  assert.ok(src.includes('from "../../core/ui/more.js"') && src.includes('"../../../core/ui/more.js"'), "the import where it is, and the one it takes once copied");
  const { render } = await import("../modules/_template/view.js");
  fresh();
  const root = ui.h("main", {});
  render(root, { ...ctxOf(), derived: { example: 2 }, plan: {}, module: { group: "system", id: "template" } });
  const kids = root.children;
  assert.equal(kids.length, 3);
  assert.equal(kids[1].dataset.parts, ""); assert.equal(kids[2].dataset.links, "");
  assert.ok(!/null|undefined/.test(textOf(root)), textOf(root));
});

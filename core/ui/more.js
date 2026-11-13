// core/ui/more.js -- optional parts, drawn one way (docs/OPTIONAL.md; design log 2026-11-12: simple first, more detail
// is there for whoever wants it).
//
//   import { part, parts, rest, choice, links, statusOf } from "../../../core/ui/more.js";
//   root.append(ui.h("div", {}, parts(ctx,
//     { id: "numbers", kind: "more", n: 4, noun: "numbers", body: () => ui.row(tiles) },
//     { id: "how", kind: "how", says: "11 steps", body: () => [walk, sources] })));
//
// A PART is a piece of a page that starts shut and opens in place: a native <details> with a fixed title (.fold-title),
// a short status (.fold-status) and a body. A view lists its parts as { id, kind, ... } and never writes <details> by
// hand. What it does for every part, so no view has to:
//   - one markup: the title wave 1's place memory names a section by, the status beside it, the marker aria-hidden, the
//     summary a block with a flex row inside (the shape that keeps VoiceOver saying "collapsed" / "expanded");
//   - one order for open or shut (docs/OPTIONAL.md "Open or shut"): a reason now (something to fix, a box held back at
//     Save, the page's `open: true`, the address's ?show=<part or box>), then the person's own last tap on a reading
//     part on this phone, then the switch "Show how answers are worked out", then shut;
//   - memory narrowed to the reading parts (kinds "more" and "how"): only a person's own tap is kept, on this phone, for
//     90 days unseen; parts with boxes are kept for the visit by core/place.js and come back shut saying "1 set by you";
//   - a heavy body built when first opened (`lazy: true`), and every shut section opened while the page prints.
//
// The device's two switches (`detail`) and the per-part memory (`kept`) live in ONE localStorage key, planner.more
// (planner.more.sandbox in the sandbox). Never in the plan, never sent to the computer, never in a downloaded copy; it
// holds page and part names only, never a figure, a name or anything from an account.
//
// The stand-in discipline (tests/more.test.mjs runs every drawing under qa/fixtures/fake-dom.mjs AND under the text-only
// stand-in three module tests use): nodes are built with ctx.ui.h and filled with append only; every other DOM call is
// optional (`?.`), never replaceChildren or querySelectorAll on a view's nodes. Imports nothing; safe to import in Node.
// The helper draws no box of its own (choice() builds its one box with the kit's own moneyBox or numberBox, for a figure
// of the plan, and only after "Type my own" is tapped).

const DOC = typeof document !== "undefined" && typeof document.addEventListener === "function" && !!document.documentElement;
/** Outside a browser (a test) a broken rule throws; a person's page never breaks for it (a warning, and it draws). */
const STRICT = !DOC;
const strict = (msg) => {
  if (STRICT) throw new Error(`core/ui/more.js: ${msg}`);
  try { console.warn(`[planner] ${msg}`); } catch { /* no console */ }
};
const SANDBOX = (() => { try { return new URLSearchParams(globalThis.location?.search ?? "").has("sandbox"); } catch { return false; } })();

export const MORE_KEY = SANDBOX ? "planner.more.sandbox" : "planner.more";
/** A remembered part not drawn for this many days is forgotten (it opens as the page draws it again). */
export const KEEP_DAYS = 90;
/** The kinds whose open or shut a person's tap is remembered on this phone: the reading parts (figures and words, no box). */
export const KEPT_KINDS = Object.freeze(["more", "how"]);
/** The kinds "Show how answers are worked out" opens. Never own / figures (they hold a Save), item, tech or links. */
export const WORKING_KINDS = Object.freeze(["more", "how"]);
export const KINDS = Object.freeze(["more", "how", "own", "figures", "item", "tech", "links"]);
/** The fixed titles (docs/OPTIONAL.md "The vocabulary"); "more" is "N more <things>" from n and noun. */
export const TITLES = Object.freeze({ how: "How this is worked out", own: "Set my own numbers", figures: "The figures", tech: "Show details", links: "More on this" });
export const STATUS_MAX = 20;      // characters: one line beside the title at 320 px, never cut with an ellipsis
export const MAX_PARTS = 5;        // parts on one page, as rows of one card
export const MAX_LINKS = 5;        // rows of "More on this"
export const FIRST_ROWS = 6;       // rows a list shows before "N more <things>"
export const MAX_ENTRIES = 300;    // parts remembered on one phone, oldest first out

// ---------------------------------------------------------------- the one key: { fmt: 1, working?: 1, boxes?: 1, parts: { "group/id#part": [1 | 0, day] } }
let clock = () => Date.now();
const today = () => Math.floor(clock() / 864e5);
const storage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
let mem = null;                    // the copy in memory (a private window or a sandboxed frame keeps only this, for the visit)
function load() {
  if (mem) return mem;
  mem = { working: false, boxes: false, parts: {} };
  let raw = null;
  try { raw = JSON.parse(storage()?.getItem(MORE_KEY) ?? "null"); } catch { raw = null; }
  if (!raw || typeof raw !== "object" || raw.fmt !== 1) return mem;   // nothing, or not ours: read as nothing stored
  mem.working = raw.working === 1;
  mem.boxes = raw.boxes === 1;
  const now = today();
  let dropped = false;
  for (const [k, v] of Object.entries(raw.parts && typeof raw.parts === "object" ? raw.parts : {})) {
    if (k.includes("#") && Array.isArray(v) && (v[0] === 0 || v[0] === 1) && Number.isFinite(v[1]) && now - v[1] < KEEP_DAYS) mem.parts[k] = [v[0], v[1]];
    else dropped = true;           // 90 days unseen (or not an entry): forgotten, and the key says so from now on
  }
  if (dropped) save();
  return mem;
}
function save() {
  const m = mem, keys = Object.keys(m.parts);
  if (keys.length > MAX_ENTRIES) for (const k of keys.sort((a, b) => m.parts[a][1] - m.parts[b][1]).slice(0, keys.length - MAX_ENTRIES)) delete m.parts[k];
  const any = m.working || m.boxes || Object.keys(m.parts).length > 0;
  try {
    const s = storage(); if (!s) return;
    if (!any) { s.removeItem(MORE_KEY); return; }
    const out = { fmt: 1 };
    if (m.working) out.working = 1;
    if (m.boxes) out.boxes = 1;
    out.parts = m.parts;
    s.setItem(MORE_KEY, JSON.stringify(out));
  } catch { /* full or blocked: the copy in memory serves this visit */ }
}

/** What this phone remembers of the reading parts a person opened (1) or shut against the switch (0). Never in the plan. */
export const kept = {
  /** true (they opened it), false (they shut it) or null (nothing kept: drawn as the page draws it). Reading it counts as
   * the part being drawn today (its day is refreshed at most once a day). */
  get(page, id) {
    const v = load().parts[`${page}#${id}`];
    if (!v) return null;
    const t = today();
    if (v[1] !== t) { v[1] = t; save(); }
    return v[0] === 1;
  },
  /** The person's own tap. The same as the page draws it by default (`designed`) is not worth keeping: the entry goes. */
  set(page, id, open, designed = false) {
    const m = load(), k = `${page}#${id}`;
    if (!!open === !!designed) delete m.parts[k]; else m.parts[k] = [open ? 1 : 0, today()];
    save();
  },
  /** How many parts this phone keeps open because the person opened them (Settings: "You keep N parts open"). */
  count() { return Object.values(load().parts).filter((v) => v[0] === 1).length; },
  /** "open" (Shut them all: the parts they opened), "shut" (the parts they shut against the switch) or "all". Returns how many went. */
  clear(which = "open") {
    const m = load(); let n = 0;
    for (const [k, v] of Object.entries(m.parts)) if (which === "all" || v[0] === (which === "shut" ? 0 : 1)) { delete m.parts[k]; n++; }
    save();
    return n;
  },
};

// ---------------------------------------------------------------- the two switches (Settings > How much to show)
let kit = null;                    // the UI kit, once the shell calls detail.init(ui)
/** ?more=all | working | boxes in the address (before the #): switches on for this visit only, never stored (tools/shot.mjs --more). */
function visitAsk() {
  try {
    const v = new URLSearchParams(globalThis.location?.search ?? "").get("more");
    return v === "all" ? { working: true, boxes: true } : v === "working" ? { working: true, boxes: false } : v === "boxes" ? { working: false, boxes: true } : null;
  } catch { return null; }
}
export const detail = {
  /** At boot, beside ui.setMoneySign: keeps the kit and tells it whether every form opens its "More details (optional)". */
  init(ui) { kit = ui ?? null; kit?.setMoreOpen?.(detail.boxes); return detail; },
  /** What the address asks for this visit ({ working, boxes }), or null. */
  get forVisit() { return visitAsk(); },
  /** The person's own choices on this phone (what Settings' two boxes show). */
  get chosen() { const m = load(); return { working: m.working, boxes: m.boxes }; },
  /** "Show how answers are worked out": every "N more ..." and "How this is worked out" starts open. */
  get working() { return load().working || !!visitAsk()?.working; },
  /** "Show every box in forms": every form's "More details (optional)" starts open (the kit's setMoreOpen). */
  get boxes() { return load().boxes || !!visitAsk()?.boxes; },
  /** The person checked or unchecked a switch in Settings. A change to `working` either way forgets the parts they shut
   * against it (they have just said how pages should open); `boxes` goes to the kit at once. Returns `chosen`. */
  set({ working, boxes } = {}) {
    const m = load();
    if (working !== undefined) { m.working = !!working; for (const [k, v] of Object.entries(m.parts)) if (v[0] === 0) delete m.parts[k]; }
    if (boxes !== undefined) m.boxes = !!boxes;
    save();
    if (boxes !== undefined) kit?.setMoreOpen?.(detail.boxes);
    return detail.chosen;
  },
};
/** Forget everything this phone keeps here (Settings' "Erase the copy on this device"): both switches and every part. */
export function forgetAll() {
  mem = { working: false, boxes: false, parts: {} };
  save();
  kit?.setMoreOpen?.(detail.boxes);
}

// ---------------------------------------------------------------- the status line
const count = (x) => (x === true ? 1 : Number.isFinite(Number(x)) ? Number(x) : 0);
/**
 * The one status of a part: the person's state first ("2 to fix", "not set yet", "4 set by you" / "set by you" for one
 * figure, "our guess" / "3 our guesses"), then what it holds in plain words (`says`: "11 steps", "$400,000") when both fit
 * in 20 characters; otherwise the person's state alone. Pure.
 */
export function statusOf({ says = "", set = 0, guess = 0, missing = false, fix = 0 } = {}) {
  let state = "";
  if (count(fix) > 0) state = `${count(fix)} to fix`;
  else if (missing) state = "not set yet";
  else if (set === true) state = "set by you";
  else if (count(set) > 0) state = `${count(set)} set by you`;
  else if (count(guess) === 1) state = "our guess";
  else if (count(guess) > 1) state = `${count(guess)} our guesses`;
  const s = String(says ?? "").replace(/\s+/g, " ").trim();
  if (!state) return s;
  if (!s) return state;
  const both = `${state} · ${s}`;
  return both.length <= STATUS_MAX ? both : state;
}

// ---------------------------------------------------------------- one part
const pageOf = (ctx) => (ctx?.module ? `${ctx.module.group}/${ctx.module.id}` : ctx?.route?.group ? `${ctx.route.group}/${ctx.route.id}` : "page");
const openNow = (el) => (typeof el?.open === "boolean" ? el.open : !!el?.hasAttribute?.("open"));
const kitOn = () => { try { return document.documentElement?.dataset?.formsKit === "1"; } catch { return false; } };
const shown = (x) => x !== null && x !== undefined && x !== false;
const landed = new WeakSet();      // route objects whose ?show= has been used: once per arrival, not on the redraw after a save
const LAZY = new WeakMap();        // a part -> the function that builds its body (print and openAll build it first)
/** Run fn once el is on the page (a page draws into a root the shell may attach a moment later). */
function onPage(el, fn, n = 0) {
  if (el?.isConnected === false && n < 30) {
    const next = () => onPage(el, fn, n + 1);
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(next); else setTimeout(next, 16);
    return;
  }
  fn();
}
function titleOf(o, kind) {
  if (o.title) return o.title;
  if (kind === "more") {
    if (!(o.n > 0) || !o.noun) strict(`part "${o.id}": a "more" part needs n and noun ("4 more numbers")`);
    if (o.n === 1 && !o.one) strict(`part "${o.id}": "1 more ..." needs one: the word for one ("number")`);
    return `${o.n > 0 ? o.n : ""} more ${(o.n === 1 ? o.one : null) ?? o.noun ?? ""}`.trim();
  }
  if (!TITLES[kind]) strict(`part "${o.id}": kind "${kind}" needs a title`);
  return TITLES[kind] ?? "";
}

/**
 * part(ctx, { id, kind, title?, n?, noun?, one?, says?, set?, guess?, missing?, fix?, open?, holds?, card?, lazy?, body })
 *   id     the part's stable name on its page ("numbers", "how", "itemized"): the memory's key and the landing's name.
 *          Never built from a title or a count.
 *   kind   "more" ("N more <noun>": pass n and noun; `one` for n = 1) | "how" | "own" | "figures" | "item" | "tech" | "links"
 *   title  only for "item", "tech", a pinned title ("Where these numbers come from") or an "own" part on a page with several
 *   says, set, guess, missing, fix   the status (statusOf); fix > 0 also opens the part
 *   open   true: the page needs it open on this draw (just saved, an empty list's add form). Never remembered
 *   holds  the box names inside, so ?show=<box> finds the part
 *   card   true: a folded card of its own; default: a row (inside parts(), or a card's .folds)
 *   lazy   true: the body is built when first opened (more than 40 rows, or one that needs ctx.computeRemote)
 *   body   nodes, or a function returning them (called at once unless lazy)
 */
export function part(ctx, o) {
  const ui = ctx.ui, h = ui.h, kind = o.kind ?? "more", page = pageOf(ctx);
  if (!o.id) strict("a part needs an id");
  if (!KINDS.includes(kind)) strict(`part "${o.id}": unknown kind "${kind}" (one of ${KINDS.join(", ")})`);
  const title = titleOf(o, kind), status = statusOf(o);
  // 1. a reason now: never remembered
  const show = ctx.route?.query?.show;
  const route = ctx.route && typeof ctx.route === "object" ? ctx.route : null;
  const asked = !!route && !!show && !landed.has(route) && (show === o.id || (o.holds ?? []).includes(show));
  if (asked) landed.add(route);
  const reason = o.open === true || count(o.fix) > 0 || asked;
  // 2. the person's own last tap (reading parts), 3. the switch, 4. shut
  const keeps = KEPT_KINDS.includes(kind);
  const designed = WORKING_KINDS.includes(kind) && detail.working;   // how the page draws it with no reason and no memory
  const mine = keeps ? kept.get(page, o.id) : null;                   // read on every draw: a drawn part is a seen part
  const isOpen = reason || (mine ?? designed);

  const bodyEl = h("div", { class: "fold-body", style: { display: "grid", gap: "12px" } });
  let built = false;
  const build = () => {
    if (built) return;
    built = true;
    const b = typeof o.body === "function" ? o.body() : o.body;
    bodyEl.append(...[b].flat(Infinity).filter(shown));
  };
  if (!o.lazy || isOpen) build();
  const sum = h("summary", { style: { display: "block" } },
    h("span", { style: { display: "flex", alignItems: "center", gap: "10px", minHeight: "32px" } },
      h("span", { class: "fold-title" }, title), status ? " " : null, status ? h("span", { class: "fold-status" }, status) : null,
      h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")));
  const el = h("details", { class: o.card === true ? "card fold fold-card" : "fold", open: isOpen ? true : null, dataset: { part: o.id, kind } }, sum, bodyEl);
  LAZY.set(el, build);
  // Only the person's own tap (or Enter / Space on the summary) is a choice. A script, the printer, find-in-page, a guide
  // step, wave 1 putting typing back and a box held back at Save open parts too, and are never remembered.
  sum.addEventListener?.("click", (e) => {
    if (!e?.isTrusted) return;
    setTimeout(() => { const now = openNow(el); if (now) build(); if (keeps) kept.set(page, o.id, now, designed); }, 0);
  });
  el.addEventListener?.("toggle", () => { if (openNow(el)) build(); });
  // A box inside held back at Save opens the part (the kit also opens every shut section around the box). A silent
  // checkValidity() fires "invalid" too: only a check the form kit answers (it prevents the browser's bubble) counts.
  el.addEventListener?.("invalid", (e) => { if (e?.defaultPrevented || !kitOn()) { build(); el.open = true; } }, true);
  // A landing: under the top bar with the focus on its summary, on a new arrival only (the page at its top). On Back,
  // Forward or a reload the part is open and wave 1 puts back the spot the person left.
  if (asked) onPage(el, () => setTimeout(() => {
    if ((globalThis.scrollY ?? 0) > 0) return;
    ui.reveal?.(el, { block: "start" });
    try { sum.focus?.({ preventScroll: true }); } catch { /* not focusable here */ }
  }, 0));
  return el;
}

// ---------------------------------------------------------------- the page's parts: rows of one card
const ORDER = { more: 0, own: 1, figures: 1, how: 2, item: 3, tech: 4, links: 5 };
/**
 * parts(ctx, ...list): the page's optional parts as quiet rows of ONE card (hairlines between), in the fixed order "more",
 * then "own" and "figures", then "how" (then "item", "tech"); the order given is kept inside a kind. Each entry is what
 * part() takes; falsy entries are skipped (`cond && {...}`); nothing to draw returns null (ui.h skips it as a child).
 */
export function parts(ctx, ...list) {
  const items = list.flat(Infinity).filter(Boolean);
  if (!items.length) return null;
  if (items.length > MAX_PARTS) strict(`${items.length} parts on one page; at most ${MAX_PARTS} (docs/OPTIONAL.md R12): a third level is a page, linked from "More on this"`);
  const sorted = items.map((o, i) => [o, i]).sort((a, b) => (ORDER[a[0].kind ?? "more"] ?? 9) - (ORDER[b[0].kind ?? "more"] ?? 9) || a[1] - b[1]).map(([o]) => o);
  const h = ctx.ui.h;
  return h("section", { class: "card", dataset: { parts: "" } }, h("div", { class: "folds" }, sorted.map((o) => part(ctx, { ...o, card: false }))));
}

// ---------------------------------------------------------------- a long list: six rows, then "N more <things>"
/**
 * rest(ctx, { id, items, row, first = 6, noun, one?, keep?, list = "records" }) -> [ul] or [ul, part]
 * The first rows, then one "N more <noun>" part (kind "more") with the others. Never hides fewer than three rows (a list of
 * eight shows eight), never a row keep(item) says to keep (a guess mark, a warning, an overdue date): those stay among
 * the rows shown, in their place. row(item, index) returns an <li>. Above 40 hidden rows the part is built when opened.
 */
export function rest(ctx, { id, items = [], row, first = FIRST_ROWS, noun, one, keep = null, list = "records", card = false }) {
  const h = ctx.ui.h;
  const all = items.map((x, i) => [x, i]);
  const stays = ([x, i]) => i < first || !!keep?.(x, i);
  const ul = (rows) => h("ul", { class: list }, rows.map(([x, i]) => row(x, i)));
  const tail = all.filter((r) => !stays(r));
  if (tail.length < 3) return [ul(all)];
  return [ul(all.filter(stays)), part(ctx, { id, kind: "more", n: tail.length, noun, one, card, lazy: tail.length > 40, body: () => ul(tail) })];
}

// ---------------------------------------------------------------- a simple choice before an exact figure
const sameValue = (a, b) => shown(a) && shown(b) && a !== "" && b !== "" && (typeof a === "number" || typeof b === "number" ? Math.abs(Number(a) - Number(b)) < 1e-9 : String(a) === String(b));
/**
 * choice(ctx, { id, label, presets: [{ value, label }], value, own: { type: "money" | "percent" | "number", label, min?, max?, whole?, show? }, onPick })
 * Three or four chips from real reference points, low to high; the chip that is on comes from the plan (`value`), also
 * when it is none of the presets ("Yours: 5.5%"). "Type my own" shows one box in place, built by the kit (moneyBox or
 * numberBox). onPick(value) runs on a chip tap or on the box's change, never per keystroke: the page commits it through
 * ctx.store.update. A chip already on does nothing.
 */
export function choice(ctx, { id, label, presets = [], value, own = null, onPick }) {
  const ui = ctx.ui, h = ui.h;
  const hit = presets.find((p) => sameValue(p.value, value));
  const yours = !hit && shown(value) && value !== "";
  const pick = (v) => { if (!sameValue(v, value)) onPick?.(v); };
  const kind = own?.type ?? "number";
  const said = (v) => (own?.show ? own.show(v)
    : kind === "percent" ? `${Number((Number(v) * 100).toPrecision(12))}%`
    : kind === "money" ? (ctx.fmt?.money ? ctx.fmt.money(v) : `$${Math.round(Number(v)).toLocaleString("en-US")}`)
    : String(v));
  const chip = (text, on, run, extra = {}) => h("button", { type: "button", class: on ? "chip on" : "chip", "aria-pressed": on ? "true" : "false", onClick: run, ...extra }, text);
  const holder = h("div", {});
  let box = null, typeBtn = null;
  const openBox = (e) => {
    if (box) { box.remove?.(); box = null; typeBtn?.setAttribute?.("aria-expanded", "false"); return; }
    const name = own.name ?? id;
    const made = kind === "money" ? ui.moneyBox?.({ name, value: value ?? "", min: own.min, max: own.max, label: own.label })
      : ui.numberBox?.({ name, value: value ?? "", min: own.min, max: own.max, whole: own.whole, percent: kind === "percent", label: own.label });
    if (!made) return;
    const input = made.input;
    input.addEventListener?.("change", () => {
      if (input.checkValidity && !input.checkValidity()) { input.reportValidity?.(); return; }   // the kit's words at the box
      const n = kind === "money" ? ui.moneyValue?.(input) : ui.readNumber?.(input.value, { percent: kind === "percent" });
      if (n === null || n === undefined) return;
      pick(kind === "percent" ? Number((n / 100).toPrecision(12)) : n);
    });
    box = ui.field ? ui.field(own.label, made.box) : h("label", {}, own.label, made.box);
    holder.append(box);
    typeBtn?.setAttribute?.("aria-expanded", "true");
    if (e && e.detail === 0) input.focus?.();   // from the keyboard the cursor goes in; a touch opens no keyboard by itself
  };
  if (own) typeBtn = chip("Type my own", false, openBox, { "aria-expanded": "false" });
  return h("div", { dataset: { choice: id } },
    h("div", { class: "chips", role: "group", "aria-label": label }, presets.map((p) => chip(p.label, p === hit, () => pick(p.value))),
      yours ? chip(`Yours: ${said(value)}`, true, () => { }) : null, typeBtn),
    holder);
}

// ---------------------------------------------------------------- "More on this": the deeper pages, as questions
/**
 * links(ctx, [{ href, ask, says? }]) -> the "More on this" card (owner, 2026-11-06), each row the question it answers
 * ("What would more income cost?") with its answer under it ("22% on the next dollar"), at most five rows. On a step of
 * a guide (?guide=...) it is one shut row instead, so the way on stays near the top. Nothing to link returns null.
 */
export function links(ctx, rows = []) {
  const h = ctx.ui.h;
  const list = rows.filter(Boolean);
  if (!list.length) return null;
  if (list.length > MAX_LINKS) strict(`"More on this" holds ${list.length} rows; at most ${MAX_LINKS}`);
  const ul = h("ul", { class: "page-list" }, list.map((r) => h("li", {}, h("a", { href: r.href, class: "row-link" },
    h("span", { class: "body" }, h("div", { class: "t" }, r.ask), r.says ? h("div", { class: "d" }, r.says) : null),
    h("span", { "aria-hidden": "true", style: { color: "var(--muted)", fontSize: "22px", lineHeight: "1", alignSelf: "center" } }, "›")))));
  if (ctx.route?.query?.guide) return part(ctx, { id: "links", kind: "links", card: true, body: ul });
  return h("section", { class: "card", dataset: { links: "" } }, h("h2", {}, TITLES.links), ul);
}

// ---------------------------------------------------------------- everything open at once (printing; the same-markup check)
/** Open every shut section under root (lazy bodies built first); returns the function that shuts the same ones again.
 * Nothing here is a tap, so nothing is remembered. */
export function openAll(root) {
  const shut = [...(root?.querySelectorAll?.("details") ?? [])].filter((d) => !openNow(d));
  for (const d of shut) { LAZY.get(d)?.(); d.open = true; }
  return () => { for (const d of shut) d.open = false; };
}
// A shut <details> does not print: every section of the page opens while the browser prints (wave 1's form folds and
// pages not yet adopted included), and the same ones shut after.
if (DOC && typeof addEventListener === "function" && !document.documentElement.dataset.morePrint) {
  document.documentElement.dataset.morePrint = "1";   // a second copy of this module installs nothing
  let shutAgain = null;
  addEventListener("beforeprint", () => { shutAgain?.(); shutAgain = openAll(document.getElementById("content")); });
  addEventListener("afterprint", () => { shutAgain?.(); shutAgain = null; });
}

/** For tests only: read the key again on next use, and set the clock (a function returning milliseconds). */
export const _test = {
  reset() { mem = null; },
  clock(fn) { clock = fn ?? (() => Date.now()); },
};

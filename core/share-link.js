// core/share-link.js -- share a calculator by a link that carries only its own figures (gap list, next 60, item 33).
//
// A calculator page (House down payment, Rent vs buy, Refinance) lists the boxes a link may carry, by a short name each:
//   export const SHARE_SPEC = defineShare({ page: "goals/house", path: ["whatIfs", "house"], fields: [
//     { key: "price", as: "price", unit: "money", min: 0, max: 1e8 }, { key: "rate", as: "rate", unit: "percent", min: 0, max: 1 }, ...] });
// "Share these figures" builds   <the app's address>#/goals/house?share=price:420000,rate:6.25
// and opening that address on another phone fills the page with those figures for that visit only: the plan is not
// touched until the person taps "Keep these" (asked first, with Undo), which writes those figures and nothing else. A box
// the link leaves out keeps that phone's own figure (or its gray guess when it has none), so the visit shows exactly
// what "Keep these" would keep (critic F1: Keep had blanked the visitor's own rate). Everything else in the address is
// the page's own.
//
// What the link never holds: anything outside the page's own key in the plan (no name, account, balance, income, person,
// goal, debt or note), a figure the page did not list (the household's own savings, dates and tax choices stay home),
// a blank box (the other phone counts its own gray guess), or `?sandbox` / `?view` (the other phone opens its own plan).
// What the link never does: go to a server. The figures sit after "#", which a browser keeps to itself (RFC 3986 section
// 3.5; the Fetch standard drops it from every request), and nothing here makes a request or stores anything.
// What a link is refused for, pair by pair (and counted, so the page can say how many were left out): a name that is not
// the page's own (looked up in a Map, so "__proto__" or "constructor" is just unknown), a value that is not plain digits
// with an optional point (no sign, exponent, hex, comma, space, Infinity or NaN), more decimals than the kind allows, a
// figure outside the page's own range, a name given twice (the first counts), a number with a leading zero ("07"). A
// text over MAX_TEXT characters, or anything that is not one text (a list), is refused whole; pairs past MAX_PAIRS are
// refused. "name:" with nothing after the colon is a box left empty on purpose (the page's own button writes it while a
// link shows): blank, neither filled nor refused.
//
// The top half is pure (Node tests read it with no page). The view half builds with ctx.ui only and guards every browser
// call, so it runs under the test DOM too. Imports nothing.

export const SHARE_PARAM = "share";
export const MAX_TEXT = 400;
export const MAX_PAIRS = 24;
const UNITS = Object.freeze({
  // the written form of each kind of figure, in the link: digits, then at most this many decimals
  money: { digits: 9, decimals: 2 },
  percent: { digits: 3, decimals: 6 },
  whole: { digits: 2, decimals: 0 },
});
const NAME = /^[a-z]{1,12}$/;
const has = (o, k) => !!o && typeof o === "object" && Object.prototype.hasOwnProperty.call(o, k);

/**
 * A page's list of what its link may carry. page: "group/id"; path: where its figures live in the plan
 * (["whatIfs", "house"]); fields: [{ key (in the plan), as (in the link), unit: money | percent | whole, min, max, name }],
 * min and max in the plan's own units (a percent as a share: 0.3 for 30%), name the figure in plain words ("the price",
 * said after a share and before Keep). stays: the keys of the page's own object a link never carries but the page counts
 * (the household's own savings or tax choices), so the banner can say they are the visitor's own. rest: the banner's
 * sentence for the boxes a link left out, { none, mixed } (default: "The rest are our guesses for you." / "The rest are
 * your own figures and our guesses."). note: one more sentence after a share (Refinance: the other phone's own
 * mortgage). Throws on a bad list (a builder's slip).
 */
export function defineShare({ page, path, fields, stays = [], rest = {}, note = "" }) {
  if (!/^[a-z0-9-]+\/[a-z0-9-]+$/.test(String(page ?? ""))) throw new Error(`share-link: bad page ${page}`);
  if (!Array.isArray(path) || !path.length || path.some((p) => typeof p !== "string" || !p)) throw new Error("share-link: bad path");
  const byAs = new Map(), byKey = new Set();
  const list = (fields ?? []).map((f) => {
    if (!f || !NAME.test(f.as ?? "") || typeof f.key !== "string" || !f.key) throw new Error(`share-link: bad field ${JSON.stringify(f)}`);
    if (!UNITS[f.unit]) throw new Error(`share-link: ${f.as}: unknown unit ${f.unit}`);
    if (!(Number.isFinite(f.min) && Number.isFinite(f.max) && f.min >= 0 && f.max >= f.min)) throw new Error(`share-link: ${f.as}: bad range`);
    if (byAs.has(f.as) || byKey.has(f.key)) throw new Error(`share-link: ${f.as} twice`);
    if (f.name !== undefined && (typeof f.name !== "string" || !f.name.trim())) throw new Error(`share-link: ${f.as}: bad name`);
    const x = Object.freeze({ key: f.key, as: f.as, unit: f.unit, min: f.min, max: f.max, name: f.name ?? `the ${f.as}` });
    byAs.set(f.as, x); byKey.add(f.key);
    return x;
  });
  if (!list.length || list.length > MAX_PAIRS) throw new Error("share-link: 1 to 24 fields");
  if (!Array.isArray(stays) || stays.some((k) => typeof k !== "string" || !k || byKey.has(k))) throw new Error("share-link: bad stays");
  const words = Object.freeze({ none: rest?.none ?? REST_NONE, mixed: rest?.mixed ?? REST_MIXED });
  return Object.freeze({ page, path: Object.freeze([...path]), fields: Object.freeze(list), byAs, stays: Object.freeze([...stays]), rest: words, note: String(note ?? "") });
}

const blank = (y) => y === null || y === undefined || y === "" || typeof y === "boolean" || typeof y === "object";
/** A figure the person typed and the page counts: a number, a yes, a date or other text (not empty, not "no"). */
const typed = (y) => y === true || (typeof y === "number" && Number.isFinite(y)) || (typeof y === "string" && y.trim() !== "");
/** A figure as the link writes it ("420000", "6.25", "30"), or null when it cannot travel (not a number, out of range). */
function textOf(f, y) {
  if (blank(y)) return null;
  const n = Number(y);
  if (!Number.isFinite(n)) return null;
  let t;
  if (f.unit === "percent") t = String(Number(Number((n * 100).toPrecision(12)).toFixed(UNITS.percent.decimals)));
  else if (f.unit === "money") t = String(Math.round(n * 100) / 100);
  else t = Number.isInteger(n) ? String(n) : null;
  return t !== null && valueOf(f, t) !== null ? t : null;
}
/** A figure the link wrote, read back in the plan's units, or null when it is refused (its shape or its range). */
function valueOf(f, t) {
  const u = UNITS[f.unit];
  // digits with no leading zero ("0", "0.5" and "10" are fine; "07" and "007" are not what the app writes)
  const re = new RegExp(`^(0|[1-9]\\d{0,${u.digits - 1}})${u.decimals ? `(\\.\\d{1,${u.decimals}})?` : ""}$`);
  if (typeof t !== "string" || !re.test(t)) return null;
  const n = Number(t);
  const v = f.unit === "percent" ? Number((n / 100).toPrecision(12)) : n;
  return Number.isFinite(v) && v >= f.min && v <= f.max ? v : null;
}

/** The figures a link can carry from `saved` (the page's own object in the plan): typed, finite, in range; in list order. */
export function sharedFigures(spec, saved) {
  const s = saved && typeof saved === "object" ? saved : {};
  const out = [];
  for (const f of spec.fields) {
    if (!Object.prototype.hasOwnProperty.call(s, f.key)) continue;
    const text = textOf(f, s[f.key]);
    if (text !== null) out.push({ key: f.key, as: f.as, text, value: valueOf(f, text) });
  }
  return out;
}
/** "price:420000,down:10,rate:6.25", or "" when there is nothing to carry. */
export const shareText = (spec, saved) => sharedFigures(spec, saved).map((x) => `${x.as}:${x.text}`).join(",");

/**
 * What a link holds for this page. text: the address's `share` (undefined or null: no link). -> null, or
 * { figures: { [plan key]: value or null (a box left empty on purpose) }, used, refused } (used + refused may be 0 for an
 * empty text).
 */
export function readShare(spec, text) {
  if (text === undefined || text === null) return null;
  const out = { figures: {}, used: 0, refused: 0 };
  // the router keeps one text per name; anything else (a list, an object) did not come from an address
  if (typeof text !== "string" || text.length > MAX_TEXT) { out.refused = 1; return out; }
  const s = text;
  const pairs = s.split(",").filter((p) => p !== "");   // a stray comma (a message app may add one at the end) is nothing
  // a piece with no name is a link mangled on its way (or a figure typed with a comma, "price:5,000"): none of it is used,
  // rather than a $5 home
  if (pairs.some((p) => !p.includes(":"))) { out.refused = pairs.length; return out; }
  const seen = new Set();
  let n = 0;
  for (const pair of pairs) {
    if (++n > MAX_PAIRS) { out.refused++; continue; }
    const i = pair.indexOf(":");
    const name = i < 0 ? "" : pair.slice(0, i);
    const f = NAME.test(name) ? spec.byAs.get(name) : undefined;
    const raw = pair.slice(i + 1);
    // "rate:" is a box emptied on purpose (written by the page's own button while a link shows): blank, not counted
    if (f && !seen.has(f.as) && raw === "") { seen.add(f.as); out.figures[f.key] = null; continue; }
    const v = f && !seen.has(f.as) ? valueOf(f, raw) : null;
    if (v === null) { out.refused++; continue; }
    seen.add(f.as);
    out.figures[f.key] = v;
    out.used++;
  }
  return out;
}

/** The page's own object with the link's figures in it: a key the link holds is the link's figure (null for a box it
 * emptied on purpose); every other key of `own` as it was, so a box the link leaves out keeps this phone's own figure.
 * A new object; nothing is changed. */
export function withShared(own, figures, spec) {
  const out = own && typeof own === "object" && !Array.isArray(own) ? { ...own } : {};
  for (const f of spec.fields) if (has(figures, f.key)) out[f.key] = figures[f.key];
  return out;
}
/**
 * The boxes a link left to this phone: { mine, guess }. mine: those holding this phone's own figure (a listed box the link
 * leaves out, and the page's own `stays`: savings, tax choices); guess: the listed boxes left empty (our gray guess or the
 * page's usual figure). A box the link emptied on purpose is a guess.
 */
export function restOf(spec, own, figures) {
  let mine = 0, guess = 0;
  for (const f of spec.fields) {
    if (has(figures, f.key) && figures[f.key] !== null) continue;
    if (!has(figures, f.key) && has(own, f.key) && typed(own[f.key])) mine++; else guess++;
  }
  for (const k of spec.stays) if (has(own, k) && typed(own[k])) mine++;
  return { mine, guess };
}
/** What the plan holds at the page's path (or undefined). */
export function getAt(plan, spec) {
  let x = plan;
  for (const k of spec.path) { if (!x || typeof x !== "object") return undefined; x = x[k]; }
  return x;
}
/** A shallow copy of the plan with `obj` at the page's path, for drawing only; the plan itself when obj is null. */
export function planWith(plan, spec, obj) {
  if (obj === null || obj === undefined) return plan;
  const put = (x, i) => {
    const k = spec.path[i];
    const here = x && typeof x === "object" && !Array.isArray(x) ? x : {};
    return { ...here, [k]: i === spec.path.length - 1 ? obj : put(here[k], i + 1) };
  };
  return put(plan, 0);
}
/** In a store.update draft: put `obj` at the page's path (making the objects on the way). */
function setAt(draft, spec, obj) {
  let x = draft;
  spec.path.forEach((k, i) => {
    if (i === spec.path.length - 1) { x[k] = obj; return; }
    if (!x[k] || typeof x[k] !== "object" || Array.isArray(x[k])) x[k] = {};
    x = x[k];
  });
}

/** The page's own address with its other query keys kept and `share` set to text (dropped when text is ""). */
export function shareHref(page, query, text) {
  const rest = Object.entries(query && typeof query === "object" ? query : {})
    .filter(([k, v]) => k !== SHARE_PARAM && v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  if (text) rest.push(`${SHARE_PARAM}=${text}`);
  return `#/${page}${rest.length ? `?${rest.join("&")}` : ""}`;
}
/** The link to send: the app's address (no ?sandbox, no ?view: the other phone opens its own plan), the page, the figures. */
export const shareLink = (base, page, text) => `${String(base ?? "").replace(/[?#].*$/, "")}#/${page}?${SHARE_PARAM}=${text}`;

/** Copy to the phone's clipboard: true when it took it. No clipboard (an http address on the home network) is false. */
export async function copyText(text, nav = globalThis.navigator) {
  try {
    const c = nav?.clipboard;
    if (!c || typeof c.writeText !== "function") return false;
    await c.writeText(String(text));
    return true;
  } catch { return false; }
}
/** The older way to copy, for an address with no clipboard (http on the home network): select a hidden box, "copy". */
function copyOld(text, doc) {
  try {
    if (!doc || typeof doc.execCommand !== "function" || typeof doc.createElement !== "function" || !doc.body) return false;
    const t = doc.createElement("textarea");
    t.value = String(text);
    Object.assign(t.style, { position: "fixed", top: "0", left: "0", opacity: "0", fontSize: "16px" });
    doc.body.append(t);
    t.select?.(); t.setSelectionRange?.(0, t.value.length);
    const ok = doc.execCommand("copy");
    t.remove();
    return ok === true;
  } catch { return false; }
}
/**
 * Hand the link on, the way the phone allows: its share menu (the person picks the app and the person sends it), else the
 * clipboard, else the older copy. -> "shared" | "copied" | "hand" (to be copied by hand from the link shown). Closing the
 * share menu without sharing falls back to copying. Nothing here sends anything anywhere.
 */
export async function sendLink(text, nav = globalThis.navigator, doc = globalThis.document) {
  try {
    if (typeof nav?.share === "function" && (typeof nav.canShare !== "function" || nav.canShare({ url: String(text) }))) {
      await nav.share({ url: String(text) });
      return "shared";
    }
  } catch { /* closed, or not allowed here: copy it instead */ }
  if (await copyText(text, nav)) return "copied";
  return copyOld(text, doc) ? "copied" : "hand";
}
/** Where a link to this address opens: "" (anywhere), "here" (this device only: localhost or a file), "home" (the home
 * network only: a private address, a .local or single-word name, a tailnet). */
export function reachOf(href) {
  let u;
  try { u = new URL(String(href ?? "")); } catch { return ""; }
  if (u.protocol === "file:") return "here";
  const h = u.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || /^127\./.test(h) || h === "::1") return "here";
  const v4 = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(h);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127)) return "home";
    return "";
  }
  if (h.includes(":")) return /^f[cd]|^fe80/.test(h) ? "home" : "";
  if (!h.includes(".") || /\.(local|lan|home|internal|ts\.net)$/.test(h)) return "home";
  return "";
}

// ---------------------------------------------------------------- the words (one sentence per case, each tested)
const figures = (n) => `${n} figure${n === 1 ? "" : "s"}`;
const cap = (t) => `${t[0].toUpperCase()}${t.slice(1)}`;
/** "the price", "the price and the rent", "the price, the rent and the rate" (a list of fields, by their plain names). */
export function namesOf(list) {
  const n = list.map((f) => f.name);
  return n.length <= 1 ? (n[0] ?? "") : `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`;
}
/** Up to three figures by name, more as "the price, the down payment and 7 more figures". */
const whichOf = (list) => (list.length <= 3 ? namesOf(list) : `${list[0].name}, ${list[1].name} and ${list.length - 2} more figures`);
export const BANNER = "Figures from a shared link: nothing in your plan has changed.";
export const SHARE_LINE = "Only these figures go in the link; nothing is sent until you send it.";
const REST_NONE = "The rest are our guesses for you.";
const REST_MIXED = "The rest are your own figures and our guesses.";
export const REST_MINE = "The rest are your own figures.";
export const REST_DIFFERS = "The other phone fills in the rest with its own figures, so its answer can differ.";
/** At a box whose figure a link cannot hold (over the page's top), when the page's own button is tapped while a link shows. */
export const NO_LINK = "A shared link cannot hold this figure.";
export const REACH = Object.freeze({ here: "It opens only on this device.", home: "It opens only on phones on your home network." });
export const UNREAD = "This link's figures could not be read, so the page shows your own.";
export const OWN_AGAIN = "Your own figures again. Nothing from the link was kept.";
export const BACK_WORDS = "Back to your own figures, as before.";
export const ALREADY = "Your plan already has these figures.";
export const VISIT_TAIL = "Nothing in your plan has changed.";
export const KEEP_BUTTON = "Keep these";
export const BACK_BUTTON = "Back to my own figures";
export const SHARE_BUTTON = "Share these figures";
/** Under the banner: how many figures the link filled in, and how many it could not use. */
export function filledWords(used, refused = 0) {
  const head = `The link filled in ${figures(used)} on this page`;
  return refused > 0 ? `${head}; ${refused} could not be read and ${refused === 1 ? "was" : "were"} left out.` : `${head}.`;
}
/** Under the banner, after filledWords: whose the boxes the link left out are (critic F2, P1: the two phones' answers can
 * differ, and the visitor is told why). rest: restOf(...); words: the page's own spec.rest. "" when the link filled all. */
export function restWords(rest, words = {}) {
  const mine = rest?.mine ?? 0, guess = rest?.guess ?? 0;
  if (mine + guess === 0) return "";
  if (mine === 0) return words.none ?? REST_NONE;
  return guess === 0 ? REST_MINE : (words.mixed ?? REST_MIXED);
}
/**
 * After "Share these figures" (critic P1, P2: say which figures go and that the other phone works the rest out itself; no
 * "any phone" for an address only this device or the home network can open):
 *   how: "shared" (the phone's share menu took it) | "copied" | "hand" (copy it from the link shown);
 *   figs: the fields that go; left: the fields holding a figure a link cannot take; differs: the other phone fills in some
 *   of this page's figures itself; note: the page's own sentence; reach: reachOf(the address).
 */
export function sentWords({ how, figs = [], left = [], differs = false, note = "", reach = "" }) {
  const head = how === "shared" ? "Shared." : how === "copied" ? "Link copied: paste it into a message." : "Copy this link and paste it into a message.";
  return [
    head,
    `It carries ${whichOf(figs)}, nothing else.`,
    left.length ? `${cap(namesOf(left))} could not go in the link.` : "",
    note,
    differs ? REST_DIFFERS : "",
    REACH[reach] ?? "",
  ].filter(Boolean).join(" ");
}
/** The question before "Keep these" writes the plan: which figures, and that the others stay (critic F1). */
export function keepAsk(spec, read) {
  const figs = spec.fields.filter((f) => has(read?.figures, f.key) && read.figures[f.key] !== null);
  const others = figs.length < spec.fields.length || spec.stays.length > 0;
  const what = figs.length > 3 ? `these ${figs.length} figures` : namesOf(figs);
  return `Keep ${what} in your plan? ${figs.length === 1 ? "It takes" : "They take"} the place of yours on this page${others ? "; your other figures stay as they are" : ""}. Undo puts yours back.`;
}

// ---------------------------------------------------------------- the view half (ctx.ui only; browser calls guarded)
const settled = new WeakSet();   // the arrivals (route objects) whose link was kept or put aside: drawn from the plan again
const told = new Map();          // page -> the line to show on its next draw: { kind: kept | visit | plain, text, undo, tone }

/**
 * Where the page stands: { live, read, unread, own, merged, plan, rest }. live: the address has a link with at least one
 * figure this page can use, not yet kept or put aside on this arrival; plan: the plan to draw from (with the link's figures
 * over this phone's own in the page's own object while live; the plan itself otherwise); rest: restOf(...) while live.
 * Nothing is written.
 */
export function visitOf(ctx, spec) {
  const plan = ctx?.plan, own = getAt(plan, spec), route = ctx?.route;
  const q = route?.query && typeof route.query === "object" ? route.query : {};
  const off = { live: false, read: null, unread: false, own, merged: own, plan, rest: null };
  if (!has(q, SHARE_PARAM) || (route && typeof route === "object" && settled.has(route))) return off;
  const read = readShare(spec, q[SHARE_PARAM]);
  if (!read || read.used === 0) return { ...off, read, unread: true };
  const merged = withShared(own, read.figures, spec);
  return { live: true, read, unread: false, own, merged, plan: planWith(plan, spec, merged), rest: restOf(spec, own, read.figures) };
}

/** This arrival's link is done with (kept or put aside): drawn from the plan from now on, and `share` leaves the address
 * in place (no new Back step; a reload then shows the plan). */
function settle(ctx, spec) {
  if (ctx?.route && typeof ctx.route === "object") settled.add(ctx.route);
  try {
    const L = globalThis.location, H = globalThis.history;
    if (L && H?.replaceState) H.replaceState(H.state, "", `${L.pathname}${L.search}${shareHref(spec.page, ctx?.route?.query, "")}`);
  } catch { /* no address bar (a test, a file) */ }
}

/**
 * The top of the page: the line kept from the last tap (kept with Undo, worked out for this visit, own again), the line
 * for a link nothing could be read from, and, while a link shows, the banner with "Keep these" and "Back to my own
 * figures" (both outlined: the page's own filled button keeps its place).
 * words.kept: the green line after Keep, naming the answer it keeps ("Kept. A $420,000 home: about $3,040 a month.").
 * words.worked: the green line after the page's own button while a link shows ("Worked out for this visit: ...").
 */
export function sharedTop(ctx, spec, v, words = {}) {
  const { ui } = ctx;
  const out = [];
  const t = told.get(spec.page);
  told.delete(spec.page);
  if (t?.kind === "kept") out.push(ui.notice("ok", t.text, t.undo ? { undo: t.undo, undone: (r) => { told.set(spec.page, { kind: "plain", tone: "ok", text: ui.undoneWords(r, BACK_WORDS) }); } } : {}));
  else if (t?.kind === "visit" && v.live && words.worked) out.push(ui.notice("ok", `${words.worked} ${VISIT_TAIL}`));
  else if (t?.kind === "plain") out.push(ui.notice(t.tone ?? "info", t.text));
  if (v.unread) out.push(ui.notice("info", UNREAD));
  if (v.live) {
    const keep = ui.button(KEEP_BUTTON, () => keepIt(ctx, spec, v, words.kept), { class: "secondary" });
    const back = ui.button(BACK_BUTTON, () => { settle(ctx, spec); told.set(spec.page, { kind: "plain", tone: "info", text: OWN_AGAIN }); ctx.redraw?.(); }, { class: "secondary" });
    out.push(ui.h("section", { class: "card", dataset: { shared: "" } },
      ui.h("p", { style: { margin: "0 0 6px" } }, ui.h("strong", {}, BANNER)),
      ui.h("p", { class: "muted small", style: { margin: "0 0 10px" } }, [filledWords(v.read.used, v.read.refused), restWords(v.rest, spec.rest)].filter(Boolean).join(" ")),
      ui.row(keep, back)));
  }
  return out;
}

/** "Keep these": asked first; one change (the page's own object, the keys the link holds only: the other boxes keep this
 * phone's own figures, as the visit showed them), which Undo takes back. */
function keepIt(ctx, spec, v, kept) {
  const { ui } = ctx;
  if (typeof ui.confirm !== "function" || !ui.confirm(keepAsk(spec, v.read))) return;
  const entry = { kind: "kept", text: kept || "Kept." };
  told.set(spec.page, entry);
  settle(ctx, spec);
  // the plan already holds these figures (a blank is a blank, absent or null): nothing to write, and the page says so
  const own = getAt(typeof ctx.store?.get === "function" ? ctx.store.get() : ctx.plan, spec);
  if (Object.keys(v.read.figures).every((k) => (own?.[k] ?? null) === v.read.figures[k])) {
    entry.text = ALREADY; ctx.redraw?.(); return;   // nothing changed, so the shell draws nothing: the page draws itself
  }
  const undo = ui.undoable(ctx.store, (d) => { setAt(d, spec, withShared(getAt(d, spec), v.read.figures, spec)); });
  if (undo) entry.undo = undo;
  else { entry.text = ALREADY; ctx.redraw?.(); }
}

/**
 * The page's own button while a link shows: the boxes go into the address as they stand (no new Back step), a box emptied
 * where this phone has its own figure as "name:" so that figure does not come back into it, and the page is drawn from them with a green
 * line, still for this visit only. values: the form's values by plan key (a key the form does not hold is left out).
 * Returns true; false (changing nothing) when no box holds a figure; or the key of a box whose figure a link cannot hold
 * (over the page's own top): the page says so at that box.
 */
export function visitGo(ctx, spec, values) {
  const own = getAt(ctx?.plan, spec);
  const pairs = [];
  let any = false;
  for (const f of spec.fields) {
    if (!has(values, f.key)) continue;
    const y = values[f.key];
    // an empty box is said only where this phone has its own figure (else the box is empty anyway)
    if (blank(y)) { if (has(own, f.key) && typed(own[f.key])) pairs.push(`${f.as}:`); continue; }
    const t = textOf(f, y);
    if (t === null) return f.key;
    pairs.push(`${f.as}:${t}`);
    any = true;
  }
  if (!any) return false;
  const text = pairs.join(",");
  told.set(spec.page, { kind: "visit" });
  const href = shareHref(spec.page, ctx?.route?.query, text);
  if (typeof ctx?.replace === "function") ctx.replace(href);
  else { try { globalThis.location.replace(href); } catch { /* no address bar */ } }
  return true;
}

/**
 * "Share these figures", inside the page's "The figures": one short line, one outlined button, and after the tap the link
 * (handed to the phone's share menu, or copied, when the phone lets us) with a line saying which figures it carries, that
 * the other phone works the rest out itself, and where it opens. [] when nothing typed can travel.
 * saved: the page's own object as it is drawn (the plan's, or the link's while one shows).
 */
export function shareBlock(ctx, spec, saved) {
  const { ui } = ctx;
  const figs = sharedFigures(spec, saved);
  if (!figs.length) return [];
  const text = figs.map((x) => `${x.as}:${x.text}`).join(",");
  const going = spec.fields.filter((f) => figs.some((x) => x.key === f.key));
  // a figure the plan holds that a link cannot (over the page's top, from an import): named, never dropped in silence (F3)
  const left = spec.fields.filter((f) => !going.includes(f) && has(saved, f.key) && !blank(saved[f.key]));
  const differs = going.length < spec.fields.length || spec.stays.some((k) => has(saved, k) && typed(saved[k]));
  const out = ui.h("div", { style: { display: "grid", gap: "8px" }, dataset: { shareOut: "" } });
  const base = (() => { try { return String(globalThis.location?.href ?? ""); } catch { return ""; } })();
  const link = shareLink(base, spec.page, text);
  const tap = async () => {
    const how = await sendLink(link);
    out.replaceChildren(ui.notice(how === "hand" ? "info" : "ok", sentWords({ how, figs: going, left, differs, note: spec.note, reach: reachOf(base) })),
      ui.h("p", { class: "small", dataset: { shareLink: "" }, style: { margin: "0", wordBreak: "break-all", userSelect: "all", webkitUserSelect: "all" } }, link));
  };
  return [ui.h("p", { class: "muted small", style: { margin: "4px 0 0" } }, SHARE_LINE), ui.row(ui.button(SHARE_BUTTON, tap, { class: "secondary" })), out];
}

/** For tests only: forget the lines kept for the next draw and the arrivals put aside. */
export const _reset = () => { told.clear(); };

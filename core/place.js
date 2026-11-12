// core/place.js -- place and typing memory for the shell. The shell draws a page again on a new address, Back, Forward,
// a reload and after a save; this keeps what a person would lose and puts it back once the page has drawn: typing not
// saved (per page and form: title, section, button and boxes, never values), one record per history entry (scroll, open
// sections, what was under the thumb), the carry across a save's redraw (sections, typing, focus, the tapped thing held),
// the hold (room borrowed only while a page draws or works out its answer), notices removed only by a person's tap, and
// one scroll wrapper (the page's own scrolling wins; calm under reduced motion). Only core/app.js imports it. Never read a
// method or property off a form element (a box named `contains` or `target` shadows it): use the helpers below.
import { parse, hashOf, router } from "./router.js";

// ---------------------------------------------------------------- pure rules (tests/place.test.mjs)
export const DAY = 24 * 3600 * 1000;
export const norm = (s, n = 80) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, n);
/** Words without their figures ("Store card $1,201" and "Store card $1,202" are the same row). */
export const shape = (s, n = 40) => norm(String(s ?? "").replace(/[$€£]?\d[\d,.]*%?/g, "#").replace(/[›‹▸▾]/g, ""), n);
export const splitCamel = (s) => String(s ?? "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
const SECRET = /\b(api ?keys?|keys?|tokens?|passwords?|passcodes?|pass ?codes?|passphrases?|secrets?|pins?)\b/i;
/** A box for a password, key, token, secret or PIN (by name, label, aria-label, placeholder or id): never kept. */
export const secretText = (...texts) => texts.some((t) => !!t && SECRET.test(splitCamel(t)));
/** Query keys that only say how a page was reached or what it highlights, not what it holds. */
export const PRESENTATION = ["from", "guide", "step", "review", "q", "add", "show", "sandbox", "view", "back"];
/** The key typing is kept under: the page and only the query keys that change what it draws (a month, a year). */
export function pageKeyOf(hash) {
  const r = parse(hashOf(hash));
  const q = Object.keys(r.query).filter((k) => !PRESENTATION.includes(k)).sort().map((k) => `${k}=${r.query[k]}`).join("&");
  return `#/${r.group}/${r.id}${r.rest.length ? "/" + r.rest.join("/") : ""}${q ? "?" + q : ""}`;
}
/** Typing is never kept on these pages (Settings holds connection keys and device choices). */
export const neverKept = (key) => /^#\/system\//.test(key);
/** One box drawn again: d = what it showed before the person typed, v = what they typed, now = what the page drew this
 * time. "same": the page put the typing back itself (Get started, People); "fill": put it back; "changed": the saved
 * figure moved meanwhile, so the typing is let go (the plan wins). */
export const boxVerdict = (d, v, now) => (now === v ? "same" : now === d ? "fill" : "changed");
/** The same, for a box that may be the one the person is typing in on the page now shown (`typingHere`): that box is
 * theirs, never written into and never let go (a page redrawing a live line mid-typing must not undo a correction). */
export const refillVerdict = (typingHere, d, v, now) => (typingHere ? "same" : boxVerdict(d, v, now));
/** Which drawn form a record names (fks: the identities of the forms drawn, in page order). Twins count only while there
 * are as many as before, at the same index; otherwise none (never a guess). */
export function pickForm(rec, fks) {
  const same = []; fks.forEach((k, j) => { if (k === rec.fk) same.push(j); });
  if (same.length === 1 && (rec.of ?? 1) === 1) return same[0];
  if (same.length > 1 && same.length === rec.of && same[rec.i] !== undefined) return same[rec.i];
  return -1;
}
/** A notice can be read: its first line is not under the top bar (6 px of slack), and at least 60% of it (or 48 px of
 * it) is between the top bar and the bottom edge. A line half under the bar is not read (place NP4). */
export function seenEnough(r, top, bottom) {
  const vis = Math.min(r.bottom, bottom) - Math.max(r.top, top);
  return vis > 0 && r.top >= top - 6 && (vis >= 0.6 * (r.bottom - r.top) - 0.5 || vis >= 48);
}
/** How long the bottom note stays: by its length, longer with a way on, longer for an error; 4 to 10 s. */
export const echoStay = (chars, ways = 0, bad = false) => Math.round(Math.min(10000, Math.max(bad ? 6000 : 4000, 2000 + 55 * chars + (ways ? 2000 : 0))));
export const fresh = (at, now, ms = DAY) => typeof at === "number" && now - at >= 0 && now - at < ms;
/** The newest `max` numbered records. */
export function prune(obj, max) { const ks = Object.keys(obj).map(Number).sort((a, b) => a - b); while (ks.length > max) delete obj[ks.shift()]; return obj; }
/** Typing older than a day goes, and a page whose typing is over 20 KB is not kept (a huge paste). */
export function pruneTyping(t, now, max = 20000) {
  for (const [k, r] of Object.entries(t ?? {})) {
    for (const [id, f] of Object.entries(r.forms ?? {})) if (!fresh(f.at, now)) delete r.forms[id];
    r.forms ??= {}; r.loose = (r.loose ?? []).filter((x) => fresh(x.at, now));
    if ((!Object.keys(r.forms).length && !r.loose.length) || JSON.stringify(r).length > max) delete t[k];
  }
  return t;
}
/** A 32-bit signature of a plan without its `meta` stamp: did a store update change anything? (core/app.js) */
export function planSig(plan) {
  let s = ""; try { s = JSON.stringify(plan, (k, v) => (k === "meta" ? undefined : v)) ?? ""; } catch { return Math.random(); }
  let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
/** The save-and-leave rule: the tap that saved the plan also left the page (no newer touch, within 1.5 s). */
export const usedOnLeave = (used, now, actMark) => !!used && now - used.at >= 0 && now - used.at < 1500 && used.mark === actMark;
/** Room borrowed under a page goes `grace` ms after the page last grew, never while it says its answer is being worked out. */
export const roomDue = (sinceGrowth, working, grace = 600) => !working && sinceGrowth > grace;
/** Reduced motion: a smooth scroll call becomes an instant one (the wrapper passes every call through this). */
export function calmArgs(name, args, reduce) {
  if (!reduce) return args;
  const o = args[0];
  if (o && typeof o === "object" && o.behavior === "smooth") return [{ ...o, behavior: "auto" }, ...args.slice(1)];
  return args;
}

// ---------------------------------------------------------------- DOM helpers that a named box cannot shadow
const $$ = (e, s) => (e ? [...Element.prototype.querySelectorAll.call(e, s)] : []);
const $1 = (e, s) => (e ? Element.prototype.querySelector.call(e, s) : null);
const has = (a, b) => !!a && !!b && Node.prototype.contains.call(a, b);
const isEl = (e) => typeof Element !== "undefined" && e instanceof Element;
const is = (e, s) => isEl(e) && Element.prototype.matches.call(e, s);
const up = (e, s) => (isEl(e) ? Element.prototype.closest.call(e, s) : null);
const attr = (e, k) => Element.prototype.getAttribute.call(e, k);
const getter = (C, k) => Object.getOwnPropertyDescriptor(C.prototype, k).get;
const textOf = (e) => (e ? getter(Node, "textContent").call(e) ?? "" : "");
const parentOf = (e) => (e ? getter(Node, "parentElement").call(e) : null);
const tagOf = (e) => (isEl(e) ? getter(Element, "tagName").call(e) : "");
const conn = (e) => getter(Node, "isConnected").call(e);
const rectOf = (e) => Element.prototype.getBoundingClientRect.call(e);
const isForm = (e) => typeof HTMLFormElement !== "undefined" && e instanceof HTMLFormElement;
const topbarH = () => document.getElementById("topbar")?.getBoundingClientRect().bottom ?? 0;
const now = () => performance.now();

// ---------------------------------------------------------------- the locator
const CONTROL = "input, select, textarea";
const SKIP_TYPE = /^(hidden|file|password|submit|button|reset|image|search)$/;
/** A box's own name: its visible label first (pages rewrite aria-label as you type), then aria-label, then placeholder. */
export const boxName = (visible, aria, placeholder) => norm(visible || aria || placeholder);
function labelOf(c) {
  const l = c.labels?.[0] ?? up(c, "label");
  let v = "";
  if (l) { const fl = $1(l, ".field-label"); if (fl) v = textOf(fl); else { const k = l.cloneNode(true); $$(k, "input, select, textarea, .help, small, [data-place]").forEach((x) => x.remove()); v = textOf(k); } }
  return boxName(v, attr(c, "aria-label"), attr(c, "placeholder"));
}
const inPlace = (e) => !!up(e, "[data-place]");
/** A box whose typing is kept: not hidden, a file, a password, a search; not marked data-no-keep; never a secret. */
export const isControl = (el) => is(el, CONTROL) && !SKIP_TYPE.test(el.type || "") && !up(el, "[data-no-keep], [data-place]")
  && !secretText(attr(el, "name"), attr(el, "aria-label"), labelOf(el), attr(el, "placeholder"), el.id);
const valOf = (c) => (c.type === "checkbox" || c.type === "radio" ? (c.checked ? "1" : "0") : c.tagName === "SELECT" && c.multiple ? [...c.selectedOptions].map((o) => o.value).join("\u0001") : String(c.value ?? ""));
const drawnVal = (c) => (c.type === "checkbox" || c.type === "radio" ? (c.defaultChecked ? "1" : "0") : c.tagName === "SELECT" ? ([...c.options].find((o) => o.defaultSelected)?.value ?? c.options[0]?.value ?? "") : (c.defaultValue ?? ""));
const setVal = (c, v) => { if (c.type === "checkbox" || c.type === "radio") c.checked = v === "1"; else if (c.tagName === "SELECT" && c.multiple) { const want = new Set(v.split("\u0001")); for (const o of c.options) o.selected = want.has(o.value); } else c.value = v; };
/** Inside a section that is shut (its summary excepted). Safari may give a zero box there: the section itself counts. */
export const inShutFold = (el) => { for (let d = up(el, "details:not([open])"); d; d = up(parentOf(d), "details:not([open])")) if (!has($1(d, ":scope > summary"), el)) return d; return null; };
/** On the page at all: laid out and not inside a shut section. */
export const drawn = (el) => !!el && el.isConnected && el.getClientRects().length > 0 && !inShutFold(el);
/** A section's own words (its title, never its status: "$640 biweekly", the chevron, a pill). */
function foldWords(d) {
  const s = $1(d, ":scope > summary");
  if (!s) return "";
  const t = $1(s, ".fold-title, h1, h2, h3, h4, b, strong");
  if (t) return textOf(t).replace(/\s+/g, " ").trim();
  const c = s.cloneNode(true);
  $$(c, ".fold-status, .fold-chev, .pill, small, .muted, .chev, [data-place]").forEach((x) => x.remove());
  return textOf(c).replace(/[›▸▾]/g, "").replace(/\s+/g, " ").trim();
}
const foldTitle = (d) => shape(foldWords(d), 60);
function sectOf(el) {
  const p = parentOf(el);
  if (!p) return "";
  const d = up(p, "details"), card = up(p, "section, .card, fieldset");
  const host = d && card ? (has(card, d) ? d : card) : (d ?? card);
  if (!host) return "";
  if (tagOf(host) === "DETAILS") return "f:" + foldTitle(host);
  return "c:" + shape(attr(host, "aria-label") || textOf($1(host, "h1, h2, h3, h4, legend")), 60);
}
function rowOf(el) { const r = up(parentOf(el), "li, tr, .rec, [data-key]"); return r ? "r:" + (r.dataset?.key ? "k" + r.dataset.key : shape(textOf(r)).slice(0, 24)) : ""; }
const kindOfEl = (el) => (tagOf(el) === "DETAILS" ? "D" : is(el, CONTROL) ? "C" : "A");
const SEL = { D: "details", C: CONTROL, A: "button, a[href], summary, [role=button], label, li, tr, h1, h2, h3, h4, p, form" };
export function keyOf(el) {
  const k = kindOfEl(el), t = tagOf(el);
  if (k === "D") return "D|" + foldTitle(el);
  if (k === "C") return `C|${t}|${el.type || ""}|${attr(el, "name") || ""}|${labelOf(el)}${el.type === "radio" ? "|" + el.value : ""}`;
  return `A|${t}|${shape(/^(LI|TR|P|FORM)$/.test(t) ? textOf(el).slice(0, 60) : textOf(el))}`;
}
/** A row's words with their figures (what tells twins apart: "At the 10% rate" from "At the 12% rate"). */
const rowText = (el) => { const r = up(el, "li, tr, .rec, [data-key]"); return r ? norm(textOf(r), 120) : ""; };
/** Which of a control's twins (alike but for their figures) is the one meant: `before` the twins' row words when it was
 * tapped, `now` after the page drew again, `i` its place. The same words at the same place, or once elsewhere; or, when
 * only its own row's words changed (a row edited in place), the same place. Else -1: another row moved into its place
 * (an option that lost its button while the next one kept its own). */
export function pickTwin(i, before, now) {
  const t = before?.[i];
  if (t === undefined || !Array.isArray(now)) return -1;
  if (now[i] === t) return i;
  const j = now.indexOf(t);
  if (j >= 0 && now.indexOf(t, j + 1) < 0) return j;
  if (now.length === before.length && now.every((x, k) => k === i || x === before[k])) return i;
  return -1;
}
/** The figures of a text in order ("10%|$3,105|$13,308"): a row's identity when its words change. */
export const figuresOf = (t) => (String(t ?? "").match(/[$€£]?\d[\d,.]*%?/g) ?? []).join("|");
export function locOf(root, el) {
  const k = keyOf(el), s = sectOf(el), r = rowOf(el);
  const all = $$(root, SEL[k[0]]).filter((e) => !inPlace(e) && keyOf(e) === k);
  const near = all.filter((e) => sectOf(e) === s && rowOf(e) === r);
  const ts = near.length > 1 && near.length <= 30 ? near.map(rowText) : undefined;
  // a row's figures, kept only while no other row of its card has the same ones
  let fig = /^(LI|TR)$/.test(tagOf(el)) ? figuresOf(textOf(el)) || undefined : undefined;
  if (fig && $$(root, tagOf(el)).some((e) => e !== el && !inPlace(e) && sectOf(e) === s && figuresOf(textOf(e)) === fig)) fig = undefined;
  return { k, s, r, i: near.indexOf(el), of: near.length, ts, fig, sn: all.filter((e) => sectOf(e) === s).length, gi: all.indexOf(el), gof: all.length };
}
/** The element a locator names, or null when it is not certain (the caller falls back; it never guesses). */
export function locate(root, loc) {
  if (!loc || !root) return null;
  const all = $$(root, SEL[loc.k[0]]).filter((e) => !inPlace(e) && keyOf(e) === loc.k);
  return locateIn(root, loc, all) ?? byFigures(root, loc);
}
/** A row whose words changed (an option now marked "yours") is still the row with the same figures, when exactly one
 * row of its card has them ("At the 10% rate $3,105 more ... $13,308"). */
function byFigures(root, loc) {
  if (!loc.fig) return null;
  const t = loc.k.split("|")[1];
  const hit = $$(root, t).filter((e) => !inPlace(e) && sectOf(e) === loc.s && figuresOf(textOf(e)) === loc.fig);
  return hit.length === 1 ? hit[0] : null;
}
function locateIn(root, loc, all) {
  if (!all.length) return null;
  const near = all.filter((e) => sectOf(e) === loc.s && rowOf(e) === loc.r);
  if (loc.of > 1 && loc.ts) { const j = pickTwin(loc.i, loc.ts, near.map(rowText)); if (j >= 0) return near[j]; }
  else if (near.length === loc.of && near[loc.i]) return near[loc.i];
  if (near.length === 1 && loc.of === 1) return near[0];
  // gone from its own row or card: never a twin from another row or card ("At the 10% rate" and "At the 12% rate" read
  // the same without their figures; after "Use this one" the chosen option loses its button and the other one keeps
  // its own): the section only when it held this one control of the kind, the whole page only when the control had no
  // row or card at all. Else null: the caller falls back to the row, the card, or the scroll.
  const sect = all.filter((e) => sectOf(e) === loc.s);
  if (sect.length === 1 && loc.sn === 1) return sect[0];
  if (loc.s || loc.r) return null;
  if (all.length === loc.gof && all[loc.gi]) return all[loc.gi];
  return all.length === 1 && loc.gof === 1 ? all[0] : null;
}

// ---------------------------------------------------------------- forms: their words and identity
const formControls = (f) => $$(f, CONTROL).filter(isControl);
const submitOf = (f) => $1(f, "button[type=submit], button:not([type]), input[type=submit]");
const clip = (s) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, 60);
/** The words that name a form: its own heading, else the nearest heading above it in its row, card or section. */
export function formTitle(f) {
  const own = $1(f, "h1, h2, h3, h4, legend");
  if (own) return clip(textOf(own));
  for (let e = f; e && !is(e, "[data-page], #content"); e = parentOf(e)) {
    for (let s = e.previousElementSibling; s; s = s.previousElementSibling) {
      if (is(s, "[data-place]")) continue;
      const h = is(s, "h1, h2, h3, h4, legend") ? s : $$(s, "h1, h2, h3, h4").pop();
      if (h) return clip(textOf(h));
    }
    const p = parentOf(e);
    if (tagOf(p) === "DETAILS") return clip(foldWords(p));
    if (is(p, "section, .card, fieldset") && attr(p, "aria-label")) return clip(attr(p, "aria-label"));
  }
  const b = submitOf(f); return clip(textOf(b) || b?.value);
}
/** A form is the same form when its title, its section, its button's words and its boxes are the same (never its values). */
export const fkOf = (f) => [shape(formTitle(f), 60), sectOf(f), shape(textOf(submitOf(f)) || submitOf(f)?.value, 30), formControls(f).map(keyOf).join(",")].join("§");

// ---------------------------------------------------------------- what the person did (taps, toggles, typing)
const base = new WeakMap();        // box -> the value it showed before the person changed it
const where = new WeakMap();       // box -> the page key it was typed on (taken at the first keystroke)
const metaOf = new WeakMap();      // form -> { fk, i, of, title, key }: its identity while it was on the page
const dirty = new Set();           // boxes the person changed
const touchedForms = new WeakSet();
const foldBy = new WeakMap();      // details -> { by: "open" | "shut", drew }: set by the person's own tap on its summary
const openerOf = new WeakMap();    // form -> the locator of what the person tapped just before it appeared
let restoring = false;
let lastTap = null;                // { el, at, chain: [{ loc, top }] }: the last trusted click in the page
let lastAct = null;                // { kind: "submit" | "click" | "change", el, form, at, ev }
let actMark = 0, actScrolls = 0, revealAt = -1;   // trusted pointerdown/keydown count; page scroll calls at that moment
let sentForm = null;               // the form whose submit led to the coming redraw (until that redraw is drawn)
let used = null;                   // { act, at, mark }: the plan was saved by that act (the save-and-leave rule)
let touchDown = 0;
let pageRoot = () => document.getElementById("content");
let shownKey = "";                 // the page key of the page drawn in #content
const keyNow = () => pageKeyOf(location.hash);
const mark = (c) => { if (isControl(c) && !base.has(c)) base.set(c, valOf(c)); };

function chainOf(root, el) {
  const out = [];
  for (let e = el, n = 0; e && e !== root && n < 5; e = parentOf(e)) {
    if (!is(e, "button, a[href], summary, label, input, select, textarea, li, tr, details, section, .card, form")) continue;
    const t = tagOf(e) === "DETAILS" ? e : is(e, "section, .card, form") ? $1(e, "h1, h2, h3, h4") : e;
    if (!t || inPlace(t)) continue;
    out.push({ loc: locOf(root, t), top: Math.round(rectOf(t).top) });
    n++;
    // an edit form's button: the row that opened the form comes next (it is what was saved)
    const f = n === 1 ? el.form ?? up(el, "form") : null;
    if (f && openerOf.get(f)) { const o = locate(root, openerOf.get(f)); if (o) { out.push({ loc: openerOf.get(f), top: Math.round(rectOf(o).top), opener: true }); n++; } }
  }
  return out;
}
const TAPPED = "button, a[href], summary, label, input, select, textarea, li, tr, [role=button]";
function onAct(e) {
  if (!e.isTrusted) return;
  actMark++; actScrolls = selfScrolls;
  if (e.type !== "pointerdown") return;
  const root = pageRoot(), t = up(e.target, TAPPED);
  if (!t || !has(root, t)) return;
  if (dirty.size) { clearTimeout(noteTimer); remember(); }   // a tap that may swap the form away: write the typing down first
  mark(is(t, CONTROL) ? t : t.control ?? $1(t, CONTROL));
}
function onClick(e) {
  const root = pageRoot(), t = e.target;
  if (!e.isTrusted || !has(root, t) || inPlace(t)) return;
  const tt = up(t, TAPPED);
  if (tt) { try { lastTap = { el: tt, at: now(), chain: chainOf(root, tt) }; } catch { lastTap = null; } }
  const sum = up(t, "summary"), d = parentOf(sum);
  if (sum && tagOf(d) === "DETAILS") {
    const drew = foldBy.get(d)?.drew ?? (d.open ? "open" : "shut");
    setTimeout(() => { const by = d.open ? "open" : "shut"; if (by === drew) foldBy.delete(d); else foldBy.set(d, { by, drew }); hooks.changed?.(); }, 0);
    return;
  }
  const b = up(t, "button, input[type=submit], input[type=button], [role=button]");
  if (!b) return;
  const f = b.form ?? up(b, "form");
  lastAct = { kind: "click", el: b, form: f, at: now(), ev: e };
  // Cancel throws the typing away on purpose (a non-submit button of the form named so)
  if (f && (b.type || "submit") !== "submit" && /^(cancel|close|never mind|discard)\b/i.test(textOf(b).trim())) forget(f);
}
function onSubmit(e) { if (has(pageRoot(), e.target)) { sentForm = e.target; lastAct = { kind: "submit", el: e.target, form: e.target, at: now(), ev: e }; } }
function onInput(e) {
  const c = e.target;
  if (restoring || !e.isTrusted || !isControl(c) || !has(pageRoot(), c)) return;
  if (!base.has(c)) base.set(c, c.type === "checkbox" || c.type === "radio" ? (c.checked ? "0" : "1") : drawnVal(c));
  if (!where.has(c)) { const k = keyNow(); where.set(c, k.split("?")[0] === shownKey.split("?")[0] ? k : shownKey); }
  dirty.add(c); if (c.form) { touchedForms.add(c.form); if (!metaOf.has(c.form)) metaOf.set(c.form, identity(c.form)); }
  if (sentForm && has(sentForm, c)) sentForm = null;   // typing again after a Save that kept the form
  $1(up(c, "label"), ":scope > .place-cue")?.remove();
  clearTimeout(noteTimer);
  if (e.type === "change") { lastAct = { kind: "change", el: c, form: null, at: now(), ev: e }; remember(); return; }
  noteTimer = setTimeout(remember, 300);
}
let noteTimer = null;
const hooks = { changed: null, echo: null };

// ---------------------------------------------------------------- typing memory (per page key, per form)
const sandboxed = () => /[?&]sandbox(=|&|$)/.test(location.search);
const TYKEY = () => "planner.typing" + (sandboxed() ? ".sandbox" : "");
let typing = {};   // { [pageKey]: { forms: { [fk#i]: { fk, i, of, title, opener, at, boxes: [{ k, j, v, d }] } }, loose: [{ loc, v, d, at }] } }
const loadTyping = () => { try { const t = JSON.parse(sessionStorage.getItem(TYKEY()) || "null"); typing = t?.fmt === 1 ? pruneTyping(t.pages ?? {}, Date.now()) : {}; } catch { typing = {}; } };
const saveTyping = () => { try { pruneTyping(typing, Date.now()); sessionStorage.setItem(TYKEY(), JSON.stringify({ fmt: 1, pages: typing })); } catch { /* memory only */ } };
const formsOn = (root) => $$(root, "form").filter((f) => !inPlace(f));
function identity(f) {
  const here = formsOn(pageRoot()), fks = here.map(fkOf), j = here.indexOf(f), fk = j >= 0 ? fks[j] : fkOf(f);
  return { fk, i: fks.slice(0, Math.max(0, j)).filter((k) => k === fk).length, of: Math.max(1, fks.filter((k) => k === fk).length), title: formTitle(f) };
}
const pageRec = (key) => typing[key] ?? (typing[key] = { forms: {}, loose: [] });
const tidy = (key) => { const r = typing[key]; if (r && !Object.keys(r.forms).length && !r.loose.length) delete typing[key]; };
/** Write down what is typed and not saved, each box under the page it was typed on. */
export function remember() {
  const root = pageRoot(); if (!root) return;
  const at = Date.now(), forms = new Map(), loose = new Map();
  for (const c of [...dirty]) {
    const f = c.form, gone = !c.isConnected;
    if (gone && !(f && metaOf.has(f))) continue;   // gone with its page: written down when it was last remembered
    if (!gone && !has(root, c)) continue;
    const key = where.get(c) ?? shownKey;
    if (!key || neverKept(key)) continue;
    if (f) { if (!forms.has(f)) forms.set(f, { key, cs: [] }); if (valOf(c) !== base.get(c)) forms.get(f).cs.push(c); }
    else if (valOf(c) !== base.get(c)) { if (!loose.has(key)) loose.set(key, []); loose.get(key).push(c); }
  }
  for (const [f, { key, cs }] of forms) {
    const m = conn(f) ? identity(f) : metaOf.get(f), id = `${m.fk}#${m.i}`;
    metaOf.set(f, m);
    const rec = pageRec(key), was = rec.forms[id], all = formControls(f);
    const spot = (c) => { const k = keyOf(c); return { k, j: all.filter((x) => keyOf(x) === k).indexOf(c) }; };
    // the boxes looked at now replace their entries; a box written down before and not looked at now stays (a change event
    // that fires as the page goes away must not drop the other boxes of its form)
    const now_ = new Set([...dirty].filter((c) => c.form === f).map((c) => { const x = spot(c); return `${x.k}#${x.j}`; }));
    const boxes = cs.map((c) => ({ ...spot(c), v: valOf(c), d: base.get(c) })).concat((was?.boxes ?? []).filter((b) => !now_.has(`${b.k}#${b.j}`)));
    if (!boxes.length) { if (touchedForms.has(f)) delete rec.forms[id]; tidy(key); continue; }   // typed, then put back as drawn
    rec.forms[id] = { fk: m.fk, i: m.i, of: m.of, title: m.title, opener: openerOf.get(f) ?? was?.opener ?? null, open: conn(f), at, boxes };
  }
  // loose boxes: the ones changed now replace their entries; entries not drawn this time stay
  for (const [key, cs] of loose) { const rec = pageRec(key); rec.loose = rec.loose.filter((x) => !cs.some((c) => keyOf(c) === x.loc.k)).concat(cs.map((c) => ({ loc: locOf(root, c), v: valOf(c), d: base.get(c), at }))); }
  for (const c of dirty) if (!c.form && c.isConnected && valOf(c) === base.get(c) && typing[where.get(c)]) { const r = typing[where.get(c)]; r.loose = r.loose.filter((x) => x.loc.k !== keyOf(c)); }
  for (const k of Object.keys(typing)) tidy(k);
  for (const c of [...dirty]) if (!c.isConnected) dirty.delete(c);   // a box taken away is written down once
  saveTyping();
}
/** Forget a form's typing (Save, its Cancel, "Undo my typing"). */
export function forget(f) {
  const cs = formControls(f), keys = new Set([shownKey, ...cs.map((c) => where.get(c)).filter(Boolean)]);
  for (const c of cs) dirty.delete(c);
  $$(f, "[data-place]").forEach((x) => x.remove());
  const m = conn(f) ? identity(f) : metaOf.get(f); if (!m) return;
  for (const key of keys) if (typing[key]) { delete typing[key].forms[`${m.fk}#${m.i}`]; tidy(key); }
  saveTyping();
}
/** The plan changed (`changed`: something besides its stamp). What the last act saved is no longer "typed and not saved":
 * the form submitted; or the button's own form; or, for a button in no form, its own card or section, never wider. A box
 * that saves itself when it changes counts only when the plan changed inside its own change event. */
export function saved(changed) {
  const a = lastAct;
  if (!changed || !a || now() - a.at > 1500) return;
  if (a.kind === "change") { if (typeof window !== "undefined" && window.event === a.ev) { base.set(a.el, valOf(a.el)); remember(); dirty.delete(a.el); } return; }
  used = { act: a, at: now(), mark: actMark };
  const scope = a.form ?? up(a.el, "form") ?? up(a.el, ".card, section, details, fieldset");
  if (!scope) return;
  if (isForm(scope)) { forget(scope); return; }
  for (const c of [...dirty]) if (has(scope, c)) dirty.delete(c);
  for (const f of $$(scope, "form")) forget(f);
  remember();
}
// ---------------------------------------------------------------- cues: "Not saved yet"
function undoBtn(run) { const b = document.createElement("button"); b.type = "button"; b.className = "place-undo"; b.dataset.place = "undo"; b.textContent = "Undo my typing"; b.addEventListener("click", run); return b; }
function cueBox(c, undo) {
  const host = up(c, "label") ?? parentOf(c);
  if (!host || $1(host, ":scope > .place-cue")) return;
  const s = document.createElement("small"); s.className = "help place-cue"; s.dataset.place = "cue"; s.textContent = "Not saved yet";
  if (undo) {   // a box in no form (a note, a what-if box): its own way to put back what the page showed
    s.className = "help place-hint place-cue"; s.textContent = "Not saved yet. ";
    s.append(undoBtn(() => { quietly(() => { if (base.has(c)) { setVal(c, base.get(c)); c.dispatchEvent(new Event("input", { bubbles: true })); } }); s.remove(); remember(); dirty.delete(c); }));
  }
  Element.prototype.append.call(host, s);
}
function hint(f) {
  if ($1(f, "[data-place=hint]")) return;
  const host = $1(f, ".form-actions") ?? f;
  const s = document.createElement("small"); s.className = "help place-hint"; s.dataset.place = "hint"; s.textContent = "Not saved yet. ";
  s.append(undoBtn(() => undoTyping(f))); Element.prototype.append.call(host, s);
}
const quietly = (fn) => { restoring = true; try { fn(); } finally { restoring = false; } };
const fire = (c) => { c.dispatchEvent(new Event("input", { bubbles: true })); if (c.tagName === "SELECT" || c.type === "checkbox" || c.type === "radio") c.dispatchEvent(new Event("change", { bubbles: true })); };
/** "Undo my typing": every box of the form goes back to what the page drew (as input, so pages that track their boxes follow). */
function undoTyping(f) {
  quietly(() => { for (const c of formControls(f)) if (dirty.has(c) && base.has(c) && valOf(c) !== base.get(c)) { setVal(c, base.get(c)); fire(c); } });
  forget(f);
}
// ---------------------------------------------------------------- putting typing back
const seenForms = new WeakSet();
let letGo = 0, letGoTitle = "";
/** Put back what was typed into the same forms and boxes, quietly (`.value` and input/change; never reportValidity).
 * Shut sections holding a filled box are opened. Returns how many boxes were filled. */
export function refill(root = pageRoot()) {
  const rec = typing[shownKey]; if (!rec || !root) return 0;
  let n = 0, changed = false;
  const fill = (c, x) => {
    const verdict = refillVerdict(dirty.has(c), x.d, x.v, valOf(c));   // a box typed in on the page now shown is left alone
    if (verdict === "changed") { changed = true; return verdict; }
    if (dirty.has(c)) return verdict;
    base.set(c, x.d); where.set(c, shownKey); dirty.add(c); if (c.form) touchedForms.add(c.form);
    if (verdict === "same") return verdict;
    quietly(() => { setVal(c, x.v); fire(c); });
    for (let d = inShutFold(c); d; d = inShutFold(c)) d.open = true;
    n++;
    return verdict;
  };
  const here = formsOn(root), fks = here.map(fkOf);
  for (const [id, r] of Object.entries(rec.forms)) {
    const j = pickForm(r, fks); if (j < 0) continue;
    const f = here[j]; if (seenForms.has(f)) continue; seenForms.add(f);
    // the form is on the page again (its row tapped again): a bottom note offering to open it is stale
    for (const n of document.querySelectorAll(".save-echo.info")) if (r.title && textOf(n).includes(`“${r.title}”`)) n.remove();
    const all = formControls(f), filled = [];
    if (r.opener && !openerOf.has(f)) openerOf.set(f, r.opener);
    r.boxes = r.boxes.filter((x) => { const c = all.filter((y) => keyOf(y) === x.k)[x.j]; if (!c) return true; const v = fill(c, x); if (v === "fill") filled.push(c); if (v === "changed") { letGo++; letGoTitle = r.title; return false; } return true; });
    if (!r.boxes.length) delete rec.forms[id];
    if (filled.length) { hint(f); const b = submitOf(f), far = b && filled.find((c) => Math.abs(rectOf(c).top - rectOf(b).top) > 320); if (far) cueBox(far, false); }   // by the button; once more by the first far box
    $1(root, `[data-place=kept][data-for="${CSS.escape(id)}"]`)?.remove();
  }
  rec.loose = rec.loose.filter((x) => { const c = locate(root, x.loc); if (!c || !isControl(c) || c.form || seenForms.has(c)) return true; seenForms.add(c); const v = fill(c, x); if (v === "fill") cueBox(c, true); if (v === "changed") { letGo++; return false; } return true; });
  if (changed || !Object.keys(rec.forms).length) { tidy(shownKey); saveTyping(); }
  return n;
}
/** Back, Forward or a reload onto a page left with a typed form open: that form opens again the way the person opened it
 * (what they tapped is pressed once, quietly: no history entry, no keyboard), and refill puts the typing in it, so the page
 * is as it was left (SH-DRAFT: FF2, B1, CF-2, INV-4, goals x-3). Only the form open when the page was left (the newest),
 * only a button, a summary or a row (never a link), only when what opened it is found for certain, and never once the
 * person has touched the page. Else the kept line offers "Open it" (tell). */
function reopen(root) {
  const rec = typing[shownKey]; if (!rec) return;
  const fks = formsOn(root).map(fkOf);
  const r = Object.values(rec.forms).filter((x) => x.open && x.opener && pickForm(x, fks) < 0 && !fks.includes(x.fk)).sort((a, b) => b.at - a.at)[0];
  if (!r) return;
  const mark0 = actMark;
  const press = () => {
    const o = locate(root, r.opener);
    if (!o || !drawn(o) || !is(o, "button, summary, [role=button], li, tr, .rec") || up(o, "a[href]")) return false;
    r.open = false;   // once: a form the person then shuts stays shut
    lastTap = { el: o, at: now(), chain: chainOf(root, o) };
    try { router.quietLayers?.(250); } catch { }   // the form it opens takes no step on Back (only this tap: a person's own tap a moment later does)
    o.click();
    return true;
  };
  if (press()) return;
  // a page that draws its buttons once its answer is worked out: pressed when they are there, unless the person acted
  let k = 0; const t = setInterval(() => { if (actMark !== mark0 || ++k > 20 || !root.isConnected) { clearInterval(t); return; } if (press()) clearInterval(t); }, 100);
}
/** Kept typing whose form is not on the page: one line where it lives, with "Open it" (the tap that opened it) and
 * "Undo my typing". Said at the bottom too only when that line cannot be read once the screen is still (`say`), or at
 * once (`now`: a stray tap took the form away). Typing let go because its saved figures changed is said once. */
const told = new Set();
export function tell(root = pageRoot(), { now: atOnce = false, quiet = false } = {}) {
  if (!root) return;
  if (letGo) { hooks.echo?.(`Some of what you typed${letGoTitle ? ` in “${letGoTitle}”` : ""} was not put back: those figures were changed since.`, null); letGo = 0; letGoTitle = ""; }
  const rec = typing[shownKey]; if (!rec) return;
  const here = formsOn(root), fks = here.map(fkOf), titles = here.map(formTitle);
  let gone = "";
  for (const [id, r] of Object.entries(rec.forms)) {
    if (pickForm(r, fks) >= 0 || fks.includes(r.fk) || $1(root, `[data-place=kept][data-for="${CSS.escape(id)}"]`)) continue;   // on the page (filled, or a twin not guessed), or said
    // the form is on the page, drawn another way (its boxes are not the ones typed in): never a line above it naming the
    // form the person sees, without that typing; the typing goes, said once (regress-break 3)
    if (r.title && titles.includes(r.title)) { delete rec.forms[id]; gone = r.title; continue; }
    // what opened the form, found when it is needed: a page that draws its buttons once its answer is worked out (Compare
    // what-ifs) has them a moment after this line (place NP3)
    const find = () => (r.opener ? locate(root, r.opener) : null);
    const opener = find();
    const words = `Not saved yet: what you typed in “${r.title || "a form on this page"}”.`;
    const open = () => { const o = find(); if (!o) return; line.remove(); lastTap = { el: o, at: now(), chain: chainOf(root, o) }; o.click(); };
    const host = up(opener, "li, .rec") ?? up(opener, "section, .card"), inRow = is(host, "li, .rec");
    const line = document.createElement(tagOf(host) === "LI" ? "li" : "div"); line.className = "notice info place-kept"; line.dataset.place = "kept"; line.dataset.for = id;
    line.append(document.createTextNode(words + " "));
    const row = document.createElement("div"); row.className = "row place-kept-ways";
    const addOpen = () => { if ($1(row, ".place-open")) return; const b = document.createElement("button"); b.type = "button"; b.className = "secondary place-open"; b.textContent = "Open it"; b.addEventListener("click", open); Element.prototype.prepend.call(row, b); };
    if (opener) addOpen();
    else if (r.opener) { let k = 0; const t = setInterval(() => { if (!line.isConnected || ++k > 40) { clearInterval(t); return; } if (find()) { clearInterval(t); addOpen(); } }, 100); }
    row.append(undoBtn(() => { delete rec.forms[id]; tidy(shownKey); saveTyping(); line.remove(); })); line.append(row);   // the quiet way, as beside a form
    const page = $1(root, "[data-page]") ?? root;
    still(() => { if (inRow) Element.prototype.after.call(host, line); else if (host) { const h = $1(host, ":scope > h2, :scope > h3"); Node.prototype.insertBefore.call(host, line, h ? h.nextSibling : getter(Node, "firstChild").call(host)); } else page.prepend(line); });
    if (told.has(id)) continue;
    told.add(id);
    const way = () => (find() ? { label: "Open it", run: open } : null);
    const say = () => { if (line.isConnected && !seenEnough(rectOf(line), topbarH(), innerHeight)) hooks.echo?.(words, way()); };
    if (atOnce) hooks.echo?.(words, way()); else if (!quiet) whenStill(say);   // after a save the note is the save's
  }
  if (gone) { tidy(shownKey); saveTyping(); hooks.echo?.(`What you typed in “${gone}” was not put back: that form has changed since.`, null); }
}
/** The plan was erased or put back from a copy (Settings): the typing kept for the old plan and the places of this
 * visit go with it, in memory and in the tab (regress-break 3). The shell calls it on "planner:erased". */
export function forgetAll() {
  typing = {}; dirty.clear(); told.clear(); records = {};
  try { sessionStorage.removeItem(TYKEY()); sessionStorage.removeItem(RKEY()); } catch { /* nothing kept */ }
}
/** Change the page without moving what is on the screen (a line drawn above it): the last tap stays where it was. */
function still(fn) {
  const el = lastTap?.el?.isConnected ? lastTap.el : null, t0 = el ? rectOf(el).top : 0;
  fn();
  if (el && el.isConnected && !holdingNow && selfScrolls === actScrolls) { const dy = rectOf(el).top - t0; if (Math.abs(dy) > 1) scrollTo(0, scrollY + dy); }
}
/** Run fn once the place is put back and the screen has been still for 200 ms (at most 2.5 s). */
function whenStill(fn) {
  const t0 = now(); let y = scrollY, at = t0;
  const id = setInterval(() => { if (Math.abs(scrollY - y) > 1) { y = scrollY; at = now(); } if ((now() - at >= 200 && !holdingNow) || now() - t0 > 2500) { clearInterval(id); fn(); } }, 50);
}
export const hasTyping = () => !!typing[shownKey];

// ---------------------------------------------------------------- open sections
export function foldsOf(root = pageRoot()) {
  const out = [];
  for (const d of $$(root, "details")) { const f = foldBy.get(d); if (f && (f.by === "open") === d.open && !inPlace(d)) out.push({ loc: locOf(root, d), ...f }); }
  return out;
}
/** Sections the person set go back the same way, only where the page drew them as it did before (else the page wins). */
export function applyFolds(root, folds) {
  for (const f of folds ?? []) { const d = locate(root, f.loc); if (d && !foldBy.has(d) && d.open === (f.drew === "open")) { d.open = f.by === "open"; foldBy.set(d, { by: f.by, drew: f.drew }); } }
}

// ---------------------------------------------------------------- one record per history entry
const RKEY = () => "planner.place" + (sandboxed() ? ".sandbox" : "");
let records = {}, visitId = null;   // { [n]: { href, y, folds, tap, top, at } } of this visit
const loadRecords = (v) => { try { const t = JSON.parse(sessionStorage.getItem(RKEY()) || "null"); records = t?.fmt === 1 && t.v === v ? t.r ?? {} : {}; } catch { records = {}; } visitId = v; };
const saveRecords = () => { try { prune(records, 60); sessionStorage.setItem(RKEY(), JSON.stringify({ fmt: 1, v: visitId, r: records })); } catch { /* memory only */ } };
export const recordOf = (n, href) => { const r = records[n]; return r && (!href || r.href === href) ? r : null; };
const menuOpen = () => document.documentElement.classList.contains("drawer-open");
/** What is at the top of the screen (by geometry, so an open menu does not hide it): a chain to put back on Back. */
function topThing(root) {
  const bar = topbarH();
  for (const e of $$(root, "h1, h2, h3, h4, summary, li, tr, label, button, a[href], p")) {
    if (inPlace(e)) continue;
    const r = rectOf(e);
    if (r.height < 1 || r.bottom <= bar + 4) continue;
    if (r.top > innerHeight * 0.6) break;
    if (drawn(e)) return [{ loc: locOf(root, e), top: Math.round(r.top) }];
  }
  return null;
}
/** Write the record of entry n from the page on screen (when the scroll stops, a section is set, the app is hidden). */
export function note(n, { tap = undefined } = {}) {
  const root = pageRoot(); if (!root || n === null || n === undefined || (menuOpen() && records[n])) return;
  records[n] = { href: location.href, y: Math.round(scrollY), folds: foldsOf(root), tap: tap === undefined ? records[n]?.tap ?? null : tap, top: topThing(root), at: Date.now() };
  saveRecords();
}
/** The record of the entry being left, with the address it had (the address bar already shows the next one), and the
 * typing written down. The save-and-leave rule: what the tap that saved the plan and left could read is used. */
export function leave(n, href) {
  const root = pageRoot(); if (!root || n === null || n === undefined) return;
  if (usedOnLeave(used, now(), actMark)) {
    const own = used.act.form ?? up(used.act.el, "form"), rec = typing[shownKey];
    for (const c of [...dirty]) if (c.isConnected && has(root, c) && (!c.form || c.form === own)) dirty.delete(c);
    if (rec) { rec.loose = []; if (own) forget(own); tidy(shownKey); }
  }
  used = null;
  remember(); dirty.clear();   // the page is about to go: its typing is written down
  const tap = lastTap && lastTap.el.isConnected && now() - lastTap.at < 3000 ? lastTap.chain.slice(0, 3) : null;
  if (menuOpen() && records[n]) { records[n] = { ...records[n], href, tap: tap ?? records[n].tap }; saveRecords(); return; }
  records[n] = { href, y: Math.round(scrollY), folds: foldsOf(root), tap, top: topThing(root), at: Date.now() };
  saveRecords();
}
export function forgetAfter(n) { for (const k of Object.keys(records)) if (Number(k) > n) delete records[k]; saveRecords(); }

// ---------------------------------------------------------------- the hold
/** Stand at want() and stay there while the page finishes drawing. Room (#content min-height) is borrowed only while the
 * page is still drawing: the caller sets it before the draw; here it is dropped as soon as the page reaches the place by
 * itself, or one frame after the draw when the page is not growing, or 600 ms after its last growth (never while the page
 * says its answer is being worked out, `working`), never under a finger (then at the lift). The place is put back after
 * each growth; that stops at the first touch, wheel, key or mouse press, a scroll the page makes itself (on a redraw),
 * `planner:reveal`, another page, 700 ms of stillness, or 8 s (then the room goes even under a finger). */
const QUIET = 700, CAP = 8000;
let holding = null, holdingNow = false, holdPageWins = false, lastH = 0;   // lastH: #content's height when it last stood by itself
const working = (root) => attr(root, "aria-busy") === "true";   // the page's answer is being worked out (the shell says so around ctx.computeRemote)
const contentH = (root) => { const l = root.lastElementChild; return l ? Math.round(rectOf(l).bottom - rectOf(root).top) : 0; };
export function hold(root, want, { onGrow = null, pageWins = false } = {}) {
  holding?.("replaced");
  const t0 = now();
  let stopped = false, ro = null, mo = null, tick = null, still = t0, grew = 0, room = !!root.style.minHeight, h0 = contentH(root), anchoring = true, pendingDrop = false;
  holdPageWins = pageWins;
  const dropRoom = () => { if (!room) return; if (touchDown) { pendingDrop = true; return; } room = false; root.style.minHeight = ""; };
  const put = () => { if (!anchoring) return; const y = Math.min(want(), Math.max(0, document.documentElement.scrollHeight - innerHeight)); if (Math.abs(scrollY - y) > 1) scrollTo(0, y); };
  const end = () => { anchoring = false; if (!room) stop(); };
  const stop = () => {
    if (stopped) return; stopped = true; anchoring = false; holdingNow = false;
    if (holding === stop) holding = null;
    clearInterval(tick); ro?.disconnect(); mo?.disconnect();
    if (room) { if (touchDown) waitLift(root); else { room = false; root.style.minHeight = ""; } }
    for (const ev of ["touchstart", "pointerdown", "wheel", "keydown", "mousedown"]) removeEventListener(ev, end, true);
    removeEventListener("planner:reveal", end);
  };
  const again = () => {
    if (stopped) return;
    const h = contentH(root);
    if (Math.abs(h - h0) > 1) { grew = now(); h0 = h; still = grew; }
    try { onGrow?.(); } catch { }
    // the page reached the place by itself: the borrowed room is not needed (dropping it moves nothing)
    const end_ = rectOf(root).top + scrollY + h + 1;
    if (room && scrollY + innerHeight <= end_ && want() + innerHeight <= end_) dropRoom();
    put();
  };
  holdingNow = true; put(); holding = stop;
  // a size change: the place is put back in the same frame (a scroll resizes nothing), and the rest (the room let go, the
  // folds opened again) one frame later, outside the observer's own callback: a size changed inside it is the window
  // error "ResizeObserver loop completed with undelivered notifications" (forms2 new problem 2)
  let queued = false;
  const resized = () => { put(); if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; again(); }); };
  try { ro = new ResizeObserver(resized); ro.observe(root); for (const c of root.children) ro.observe(c); mo = new MutationObserver(again); mo.observe(root, { childList: true, subtree: true }); } catch { }
  for (const ev of ["touchstart", "pointerdown", "wheel", "keydown", "mousedown"]) addEventListener(ev, end, { capture: true, passive: true });
  addEventListener("planner:reveal", end);
  requestAnimationFrame(() => requestAnimationFrame(() => { if (!grew && !working(root)) { dropRoom(); put(); } }));   // a page not growing needs no room
  tick = setInterval(() => {
    const t = now();
    if (pendingDrop && !touchDown) { pendingDrop = false; room = false; root.style.minHeight = ""; }
    if (room && roomDue(t - Math.max(grew, t0), working(root))) { dropRoom(); put(); }
    if (!anchoring && !room) return stop();
    if (anchoring && !room && Math.abs(scrollY - Math.min(want(), Math.max(0, document.documentElement.scrollHeight - innerHeight))) <= 2 && t - still > QUIET) stop();
    else if (t - t0 > CAP) { anchoring = false; pendingDrop = false; room = false; root.style.minHeight = ""; stop(); }   // the cap lets the room go whatever the fingers say
  }, 100);
  return stop;
}
/** Borrowed room left under a finger goes at the lift. */
function waitLift(root) { const off = (e) => { if ((e?.touches?.length ?? 0) > 0) return; removeEventListener("touchend", off, true); removeEventListener("touchcancel", off, true); root.style.minHeight = ""; }; addEventListener("touchend", off, true); addEventListener("touchcancel", off, true); }
/** Stop holding the place (the "changed in two places" bar asks to be seen; a new page). */
export const cancelHold = () => holding?.("cancel");

// ---------------------------------------------------------------- arriving (a new address, Back, Forward, Reload)
let curN = null;
/** A new visit to a page: the shell calls it before the draw. `entry` is the router's ({ v, n }). */
export function visit(entry, key) {
  if (entry?.v && entry.v !== visitId) loadRecords(entry.v);
  curN = entry?.n ?? null; shownKey = key; told.clear(); holding?.("replaced"); sentForm = null;
  for (const c of [...dirty]) if (!c.isConnected) dirty.delete(c);
}
/** The shell is about to clear the page: the box with the cursor lets go of it quietly, so the change it fires as it goes
 * is not taken for new typing (its typing was written down already; a stale entry would mark its form shut). */
export function releaseFocus(root = pageRoot()) {
  const a = document.activeElement;
  if (a && is(a, CONTROL) && has(root, a)) quietly(() => { try { a.blur(); } catch { } });
}
/** The page key of the page drawn again in place (after a save, a choice). */
export const shown = (key) => { shownKey = key; };
/** After a return is drawn: open sections, typing, then the place (what was under the thumb, else what was at the top,
 * else the scroll); the tapped control gets the focus back when it is on the screen. A new page: typing, then told. */
export function afterArrive(root, rec) {
  if (!rec) { root.style.minHeight = ""; refill(root); tell(root); return; }
  applyFolds(root, rec.folds); refill(root); reopen(root); tell(root);   // the kept line is part of the page the place is held on
  const chain = [...(rec.tap ?? []), ...(rec.top ?? [])];
  const want = () => { for (const t of chain) { const el = locate(root, t.loc); if (el && drawn(el)) return Math.max(0, Math.round(scrollY + rectOf(el).top - t.top)); } return rec.y; };
  hold(root, want, { onGrow: () => { applyFolds(root, rec.folds); refill(root); } });
  const t = rec.tap?.[0] ? locate(root, rec.tap[0].loc) : null;
  if (t && is(t, "a[href], button, summary") && drawn(t)) { const r = rectOf(t); if (r.top >= topbarH() && r.bottom <= innerHeight) { try { t.focus({ preventScroll: true }); } catch { } } }
}

// ---------------------------------------------------------------- across a redraw of the same page (after a save)
export function before(root = pageRoot()) {
  remember();
  const a = document.activeElement, scope = sentForm;
  const focus = a && a !== document.body && has(root, a) && is(a, "input, select, textarea, button, a[href], summary, [tabindex]") && !(isControl(a) && has(scope, a))
    ? { loc: locOf(root, a), a: a.selectionStart ?? null, b: a.selectionEnd ?? null } : null;
  const hadFocus = !!(a && a !== document.body && has(root, a));
  const tap = lastTap && now() - lastTap.at < 5000 && lastTap.el.isConnected ? lastTap.chain : focus ? [{ loc: focus.loc, top: Math.round(rectOf(a).top) }] : null;
  return { folds: foldsOf(root), focus, hadFocus, tap };
}
/** After the page has drawn again: folds, typing and focus back; then, unless the page brought something into view
 * itself (`scroll: false`), the thing tapped stays where it was on the screen if it is still drawn. A section the page
 * shut that held it: that section's summary stands where it was. Else the next drawn part around it where it was (the
 * row an edit form saved: under the top bar, never above it). Nothing found: nothing moves, and the room goes one frame
 * after the draw. Returns { focusLost }. */
export function afterSave(root, snap, { scroll = true } = {}) {
  sentForm = null;
  applyFolds(root, snap.folds); refill(root); tell(root, { quiet: true });   // a form the save shut: its typing is said by the line
  if (snap.focus) { const c = locate(root, snap.focus.loc); if (c && drawn(c)) { try { c.focus({ preventScroll: true }); if (snap.focus.a !== null) c.setSelectionRange(snap.focus.a, snap.focus.b); } catch { } } }
  const out = { focusLost: snap.hadFocus && (!document.activeElement || document.activeElement === document.body) };
  const find = () => {
    for (const t of scroll ? snap.tap ?? [] : []) {
      let el = locate(root, t.loc), fold = false;
      if (el && !drawn(el)) { const s = $1(inShutFold(el), ":scope > summary"); el = s && drawn(s) ? s : null; fold = !!el; }
      // the row an edit form saved comes back into view under the top bar; anything else around the tapped thing (its row,
      // its card's heading) stays exactly where it was, so the rest of the card does not move under the thumb
      if (el) return { el, at: t.opener && !fold ? Math.max(t.top, Math.round(topbarH()) + 8) : t.top };
    }
    return null;
  };
  // a page that works its answer out after it is drawn (ctx.computeRemote: "Running your plan...", #content aria-busy)
  // draws the tapped thing later: it is looked for again as the page grows, and the sections the person opened open
  // again as they come (place new problem 8: Long-term care's Save moved 64 px down under the thumb)
  const late = working(root);
  let pick = find();
  const want = () => { if (!pick?.el.isConnected && late) pick = find(); return pick?.el.isConnected ? Math.max(0, Math.round(scrollY + rectOf(pick.el).top - pick.at)) : scrollY; };
  hold(root, want, { pageWins: true, onGrow: late ? () => { applyFolds(root, snap.folds); refill(root); } : null });
  return out;
}
/** The tapped thing's rectangle now (for placing the bottom note), or null. */
export function tappedRect(root = pageRoot()) {
  const t = lastTap; if (!t || now() - t.at > 5000) return null;
  const el = t.el.isConnected ? t.el : locate(root, t.chain?.[0]?.loc);
  return el && drawn(el) ? rectOf(el) : null;
}

// ---------------------------------------------------------------- confirmations stay until the person acts
/** A green or red notice in the page is removed only inside a person's own event (its close or Undo button) or by the
 * form kit (`data-moved`, `data-kit`). A page's timer (`setTimeout(() => n.remove(), 4000)`) leaves it, so nothing moves
 * by itself; the next draw replaces it. */
const keepNotice = (n) => {
  if (n.__placeKept || !is(n, ".notice.ok, .notice.error")) return;
  n.__placeKept = true;
  const own = n.remove;
  n.remove = function () { if (globalThis.event?.isTrusted || is(this, "[data-moved], [data-kit]")) return own.call(this); };
};

// ---------------------------------------------------------------- one wrapper of the scroll calls
const ORIG = {};
let drawing = new Set(), selfScrolls = 0, mo = null;
/** Place's own scrolling, never counted as the page's. */
export function scrollTo(x, y) { return (ORIG.winscrollTo ?? window.scrollTo).call(window, x, y); }
/** How many times the page scrolled itself (or moved the focus with scrolling) so far. */
export const scrolls = () => selfScrolls;
/** Did the page bring something into view during this draw (since `s0`) or since the person's last act? */
export const pageMoved = (s0) => selfScrolls > s0 || selfScrolls > actScrolls || revealAt > actMark - 1;
/** Wrap the scroll and focus calls once (`win`, `el`, `html`: window, Element.prototype, HTMLElement.prototype; stubs in the
 * tests): each call keeps its `this`, its arguments (smooth becomes instant under reduced motion) and its return value. */
export function wrapScrolls({ win = globalThis.window, el = globalThis.Element?.prototype, html = globalThis.HTMLElement?.prototype, reduce = (() => { try { return matchMedia("(prefers-reduced-motion: reduce)"); } catch { return null; } })() } = {}) {
  const wrap = (obj, name, key, counts = () => true) => {
    const o = obj?.[name]; if (typeof o !== "function" || o.__place) return; ORIG[key] = o;
    obj[name] = function (...a) {
      a = calmArgs(name, a, !!reduce?.matches);
      if (counts(a)) { selfScrolls++; if (holdingNow && !drawing.size && holdPageWins) holding?.("page"); }
      return o.apply(this, a);
    };
    obj[name].__place = true;
  };
  for (const n of ["scrollTo", "scrollBy", "scroll"]) wrap(win, n, "win" + n);
  for (const n of ["scrollTo", "scrollBy", "scroll", "scrollIntoView"]) wrap(el, n, "el" + n);
  wrap(html, "focus", "focus", (a) => !a[0]?.preventScroll);
}
/** The shell starts clearing and drawing a page (`id`: its draw); what it removes is not the page taking a form away. */
export const busy = (id) => { drawing.add(id); };
/** The shell finished that draw (idempotent); the observer's queued records of the shell's own changes are read as such. */
export const idle = (id) => { if (mo) watchPage(mo.takeRecords(), true); drawing.delete(id); };

// ---------------------------------------------------------------- the page's own changes after it is drawn
let fillTimer = null;
function watchPage(recs, shell = !!drawing.size) {
  let forms = false, folds = false, lost = false; const gone = [];
  for (const r of recs) {
    for (const n of r.addedNodes) {
      if (!isEl(n) || inPlace(n)) continue;
      for (const x of [n, ...$$(n, ".notice.ok, .notice.error")]) keepNotice(x);
      if (shell) continue;
      const fs = isForm(n) ? [n] : $$(n, "form");
      if (fs.length) { forms = true; const t = lastTap && now() - lastTap.at < 1500 ? lastTap : null; if (t) for (const f of fs) if (!openerOf.has(f) && !has(f, t.el)) openerOf.set(f, t.chain[0]?.loc ?? null); }
      if (tagOf(n) === "DETAILS" || $1(n, "details")) folds = true;
    }
    if (!shell) for (const n of r.removedNodes) if (isEl(n) && !conn(n)) { lost = true; for (const c of [n, ...$$(n, CONTROL)]) if (dirty.has(c) && valOf(c) !== base.get(c)) gone.push(c); }
  }
  if (shell || restoring) return;
  // the page took its own content away while it works out its answer (a chip on a page that says "Working it out..."):
  // the room it stood on is lent until the answer is drawn, so the screen stays where it was instead of falling to the top
  const pr = lost && lastH && !holdingNow ? pageRoot() : null;
  if (pr && !pr.style.minHeight && working(pr)) { pr.style.minHeight = `${lastH}px`; const y = scrollY; if (y > 0) hold(pr, () => y, { pageWins: true }); else pr.style.minHeight = ""; }
  // a typed form the page took away: its own button (Save, Cancel, Next) or its submit used it; else it is kept
  const own = (c) => { const f = c.form, b = lastTap && now() - lastTap.at < 1500 ? up(lastTap.el, "button, [role=button], input[type=submit]") : null; return !!f && ((b && has(f, b)) || f === sentForm || (lastAct?.kind === "submit" && lastAct.form === f && now() - lastAct.at < 1500)); };
  const stray = gone.filter((c) => !own(c));
  for (const c of gone) if (own(c)) dirty.delete(c);
  if (gone.length > stray.length) { const fs = new Set(gone.filter(own).map((c) => c.form)); for (const f of fs) forget(f); }
  if (stray.length) remember();
  if (folds && curN !== null) applyFolds(pageRoot(), records[curN]?.folds ?? []);
  if (!forms && !stray.length && !hasTyping()) return;
  clearTimeout(fillTimer);
  const strayHere = stray.some((c) => (where.get(c) ?? shownKey) === shownKey);
  const go = () => { if (drawing.size) return; refill(); if (strayHere) tell(pageRoot(), { now: true }); };
  if (strayHere) go(); else fillTimer = setTimeout(go, 0);
}

// ---------------------------------------------------------------- start
let started = false;
export function start({ root, changed, echo } = {}) {
  if (started) return; started = true;
  if (root) pageRoot = root;
  hooks.changed = changed ?? null; hooks.echo = echo ?? null;
  loadTyping();
  wrapScrolls();
  for (const ev of ["pointerdown", "keydown"]) document.addEventListener(ev, onAct, true);
  // the fingers on the screen, from each touch event itself: a touchend sent to an element a redraw removed never reaches
  // the document, so a count kept by hand would stay up (regress-break 4); the next touch heals it
  document.addEventListener("touchstart", (e) => { touchDown = e.touches?.length ?? touchDown + 1; }, { capture: true, passive: true });
  for (const ev of ["touchend", "touchcancel"]) document.addEventListener(ev, (e) => { touchDown = e.touches?.length ?? 0; }, { capture: true, passive: true });
  document.addEventListener("focusin", (e) => mark(e.target), true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("submit", onSubmit, true);
  document.addEventListener("input", onInput, true);
  document.addEventListener("change", onInput, true);
  addEventListener("planner:erased", forgetAll);   // Settings erased the plan or put it back from a copy
  addEventListener("planner:reveal", () => { revealAt = actMark; });
  const el = pageRoot();
  if (el) { try { mo = new MutationObserver((recs) => watchPage(recs)); mo.observe(el, { childList: true, subtree: true }); new ResizeObserver(() => { if (!el.style.minHeight) lastH = el.offsetHeight; }).observe(el); } catch { } }
  addEventListener("pagehide", remember);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState !== "visible") remember(); });
}

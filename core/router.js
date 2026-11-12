// core/router.js -- hash routing. #/<group>/<id>[/<rest...>][?key=value&...]
// Deep links work on the phone and survive a reload; the shell maps them to modules.
// The optional query rides inside the hash (location.search holds ?sandbox=1 and changing it
// reloads the page), e.g. #/balance/liabilities?guide=debt&step=rates for a step-by-step guide.
//
// History entries: each carries { v, n, l } in history.state (v this tab's visit, n the entry's number, l what is open
// over the page: Back closes it). A numbered entry is a return (Back, Forward, or a reload at the first draw). The trail
// (sessionStorage) keeps per entry { h, p, via }: its address, the entry before it, how it was opened. Pages spread
// history.state when they write it (docs/CONVENTIONS.md); a replaceState(null, ...) keeps the number all the same.

// ---------------------------------------------------------------- pure (tests/place.test.mjs, tests/router-replace.test.mjs)
const decode = (s) => { try { return decodeURIComponent(s.replace(/\+/g, " ")); } catch { return s; } };
export function parse(hash) {
  const raw = String(hash || "").replace(/^#\/?/, "");
  const q = raw.indexOf("?");
  const path = q < 0 ? raw : raw.slice(0, q);
  const query = {};
  if (q >= 0) {
    for (const part of raw.slice(q + 1).split("&")) {
      if (!part) continue;
      const eq = part.indexOf("=");
      const k = decode(eq < 0 ? part : part.slice(0, eq)), v = eq < 0 ? "" : decode(part.slice(eq + 1));
      if (k) query[k] = v;
    }
  }
  const parts = path.split("/").filter(Boolean);
  return { group: parts[0] || "overview", id: parts[1] || "dashboard", rest: parts.slice(2), query };
}
export const hashOf = (href) => { const s = String(href ?? ""); const i = s.indexOf("#"); return i < 0 ? s : s.slice(i); };
/** Does the entry at `had` show the page the link `want` names? Same page and rest, every query key of the link the same,
 *  except `from` and a `month` the entry lacks (the check-in opened without ?month showed that month). */
export function sameEntry(want, had) {
  const a = parse(hashOf(want)), b = parse(hashOf(had));
  if (a.group !== b.group || a.id !== b.id || a.rest.join("/") !== b.rest.join("/")) return false;
  return Object.keys(a.query).every((k) => k === "from" || (k in b.query ? String(a.query[k]) === String(b.query[k]) : k === "month"));
}
/** Steps back to the page a link names, or 0 (the link is followed): the entry just before, or further back while every
 *  entry walked over has this one's `from` (Your plan's "Next result" walk); at most 10. `over`: entries the link may walk
 *  over whatever they are (a way back carried one page further, as the check-in's: `data-back="1"`). */
export function backSteps(trail, n, href, over = 0) {
  let at = trail?.[n];
  if (!at) return 0;
  const from = parse(at.h).query.from || "";
  for (let k = 1; k <= 10; k++) {
    const prev = at.p === null || at.p === undefined ? null : trail[at.p];
    if (!prev) return 0;
    if (sameEntry(href, prev.h)) return k;
    if (k > over && (!from || (parse(prev.h).query.from || "") !== from)) return 0;
    at = prev;
  }
  return 0;
}
/** The kind of a return: a numbered entry at the first draw is a reload; a smaller number is Back. */
export const kindOf = (first, n, curN) => (first ? "reload" : curN === null || curN === undefined ? "new" : n < curN ? "back" : "forward");
/** Is an unnumbered entry a replace of the one on screen? open()'s mark decides; else only when nothing was stepped
 *  through, the history did not grow, and it is under the browser's cap (after a Back the length cannot tell). */
export function isReplace({ had, mark, traversed, len, lenRef, cap = 50 }) {
  if (!had) return false;
  if (mark) return mark === "replace";
  return !traversed && len === lenRef && len < cap;
}
/** The stamp of an arrival: an entry of this visit keeps its number; any other gets the replaced entry's, the next after
 *  the one on screen (a link), or after every number known (a first draw; `away`: another visit's entry, nothing before
 *  it). The state is spread: a page's own keys (Get started's suFrom) stay. */
export function stampOf(state, { v, cur = null, top = 0, first = false, replaced = false, away = false } = {}) {
  const st = state && typeof state === "object" ? state : {};
  if (st.v === v && Number.isFinite(st.n)) return { state: st, n: st.n, kind: kindOf(first, st.n, cur?.n), stamped: false };
  const n = replaced && cur ? cur.n : cur && !away ? cur.n + 1 : Math.max(top, cur?.n ?? 0) + 1;
  return { state: { ...st, v, n, l: 0 }, n, kind: "new", stamped: true, replaced: !!(replaced && cur), p: replaced || away || !cur ? null : cur.n };
}

// ---------------------------------------------------------------- the trail (sessionStorage, pretend plan apart)
const TKEY = () => { try { return "planner.trail" + (/[?&]sandbox(=|&|$)/.test(location.search) ? ".sandbox" : ""); } catch { return "planner.trail"; } };
let trail = {}, visit = null;   // { [n]: { h, p, via } } and this tab's visit id
const loadTrail = () => { try { const t = JSON.parse(sessionStorage.getItem(TKEY()) || "null"); if (t?.fmt === 1 && t.v) { visit = t.v; trail = t.e ?? {}; } } catch { } if (!visit) { visit = Date.now().toString(36) + Math.random().toString(36).slice(2, 7); trail = {}; } };
const saveTrail = () => { try { const ks = Object.keys(trail).map(Number).sort((a, b) => a - b); while (ks.length > 60) delete trail[ks.shift()]; sessionStorage.setItem(TKEY(), JSON.stringify({ fmt: 1, v: visit, e: trail })); } catch { /* memory only */ } };

let cur = null, firstN = null, lastKind = null;   // the entry on screen { n, l, hash, href }; this visit's first entry
const layers = [];       // what is open over the page, bottom first: [{ close }]
let stepping = 0;        // steps the router took itself (release(), a stale layer entry): no closing, no redraw
let handler = null;
let nextVia = null, mark = null, traversed = false, lenRef = 0, quietUntil = 0;
const now = () => (globalThis.performance?.now?.() ?? Date.now());
const st = () => { try { return history.state ?? {}; } catch { return {}; } };
const len = () => { try { return history.length; } catch { return 0; } };

function sync(first = false, pop = false) {
  const s = st(), mine = s.v === visit && Number.isFinite(s.n), l = mine ? s.l ?? 0 : 0;
  if (pop && mine) traversed = true;   // a Back or Forward onto a numbered or layer entry
  // the same entry, only what is open over the page changed. The address must be the one on screen too: two entries can
  // carry one number (an entry stamped by a visit whose number was lost: storage blocked, or the version before), and a
  // Forward onto the other one is drawn, never skipped (regress-break 1)
  if (!first && cur && mine && s.n === cur.n && location.hash === cur.hash) {
    if (l === cur.l) return;
    if (stepping) stepping--;
    else if (l < layers.length) { for (const x of layers.splice(l).reverse()) { try { x.close(); } catch (e) { console.warn(e); } } }
    cur.l = l;
    if (l > layers.length) { stepping++; history.back(); }   // an entry for something no longer open
    return;
  }
  // an entry another visit numbered, reached by Back or Forward, is never a replace of the one on screen (a link's new
  // entry has no number yet): it gets a number of its own
  const away = pop && Number.isFinite(s.n);
  const replaced = !mine && !first && !away && isReplace({ had: !!cur, mark, traversed, len: len(), lenRef });
  const top = Math.max(0, ...Object.keys(trail).map(Number));
  const stamp = stampOf(s, { v: visit, cur, top, first, replaced, away });
  const n = stamp.n, hash = location.hash;
  if (stamp.stamped) {
    try { history.replaceState(stamp.state, ""); } catch { /* Safari's rate limit: the entry stays unnumbered */ }
    if (stamp.replaced) trail[n] = { ...trail[n], h: hash };   // the same entry, a new address: keeps its number and the entry before
    else {
      if (stamp.p !== null) for (const k of Object.keys(trail)) if (Number(k) > stamp.p) delete trail[k];   // Forward can no longer reach them
      trail[n] = { h: hash, p: stamp.p, ...(nextVia ? { via: nextVia } : {}) };
    }
    traversed = false; mark = null; nextVia = null;
  } else trail[n] = { ...(trail[n] ?? { p: null }), h: hash };
  lenRef = len();
  saveTrail();
  if (firstN === null) firstN = Math.min(n, ...Object.keys(trail).map(Number));
  const from = cur ? { n: cur.n, href: cur.href } : null;
  for (const x of layers.splice(0).reverse()) { try { x.close(); } catch (e) { console.warn(e); } }   // leaving the page closes what was open over it
  cur = { n, l, hash, href: location.href };
  lastKind = stamp.kind;
  handler?.(parse(hash), { ...router.entry(), from, replaced: !!stamp.replaced, away: stamp.stamped && away });
  if (l > 0) { stepping++; history.back(); }   // arrived on an entry that stood for something open (a reload with the menu open)
}
// a page's own history.replaceState keeps the entry's number (state null or without it) and the trail follows the address
function keepNumbers() {
  const H = globalThis.History?.prototype, own = H?.replaceState; if (!own || own.__planner) return;
  H.replaceState = function (state, ...rest) {
    const was = st();
    if (was.v === visit && Number.isFinite(was.n) && !(state && typeof state === "object" && "n" in state)) state = { ...(state && typeof state === "object" ? state : {}), v: was.v, n: was.n, l: was.l ?? 0 };
    const r = own.call(this, state, ...rest); if (cur && rest.length > 1) router.touch(); return r;
  };
  H.replaceState.__planner = true;
}

export const router = {
  parse,
  /** "#/group/id[/rest...][?k=v&...]"; empty, null and undefined query values are left out. */
  href(group, id, rest = [], query = {}) {
    const qs = Object.entries(query ?? {}).filter(([, v]) => v !== "" && v !== null && v !== undefined)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&");
    return `#/${group}/${id}${rest?.length ? "/" + rest.join("/") : ""}${qs ? "?" + qs : ""}`;
  },
  go(group, id, rest = [], query = {}) { this.open(this.href(group, id, rest, query)); },
  /** A new entry, or with `replace` the entry on screen (its number kept); over a layer, the layer's entry. */
  open(href, { via = null, replace = false } = {}) {
    if (hashOf(href) === location.hash) { if (cur?.l) history.go(-cur.l); return; }   // the page already shown: close what is open
    nextVia = via; mark = replace && !layers.length ? "replace" : "new";
    if (replace || layers.length) location.replace(href); else location.hash = href;
  },
  replace(href) { this.open(href, { replace: true }); },
  /** The entry on screen: { v, n, href, kind: "new" | "back" | "forward" | "reload", first }. */
  entry() { return cur ? { v: visit, n: cur.n, href: cur.href, kind: lastKind, first: firstN } : null; },
  first() { return firstN; },
  /** What the trail knows of entry n: { href, p, via } or null. */
  at(n) { const t = trail[n]; return t ? { href: t.h, p: t.p ?? null, via: t.via ?? null } : null; },
  /** The address the entry on screen has now (a page may have changed it with history.replaceState). */
  touch() { if (!cur) return; cur.hash = location.hash; cur.href = location.href; if (trail[cur.n] && trail[cur.n].h !== cur.hash) { trail[cur.n].h = cur.hash; saveTrail(); } },
  /** Go Back when the page `href` names is just behind, or `over` entries further (see backSteps). Returns true when it went back. */
  back(href, over = 0) {
    if (!cur) return false;
    this.touch(); const k = backSteps(trail, cur.n, href, over);
    if (k) history.go(-(k + (cur.l || 0)));
    return !!k;
  },
  /** Something opened over the page. The phone's Back calls close(); call the returned release() when it closes itself. */
  layer(close) {
    if (!cur) return () => { };
    this.touch(); const me = { close }; layers.push(me);
    // opened again by the shell on a return (core/place.js reopen): no entry, so Forward still reaches the pages after this one
    if (now() < quietUntil) return () => { const i = layers.indexOf(me); if (i >= 0) layers.splice(i); };
    try { history.pushState({ ...st(), v: visit, n: cur.n, l: layers.length }, ""); cur.l = layers.length; lenRef = len(); } catch { /* no entry: Back leaves the page as before */ }
    return () => {
      const i = layers.indexOf(me); if (i < 0) return;
      layers.splice(i); const over = (st().l ?? 0) - i;
      if (st().n === cur.n && over > 0) { stepping++; history.go(-over); }
    };
  },
  layersOpen() { return layers.length; },
  /** For the next `ms`, something opened over the page takes no history entry (the shell reopening a form on a return). */
  quietLayers(ms = 1500) { quietUntil = now() + ms; },
  start(onChange) {
    handler = onChange; loadTrail(); keepNumbers();
    try { history.scrollRestoration = "manual"; } catch { /* an old browser restores by itself */ }   // the shell puts the place back (core/place.js)
    addEventListener("hashchange", () => sync());
    addEventListener("popstate", () => sync(false, true));
    // a link over a layer (a menu row) takes the layer's entry; data-via ("menu") is kept with the new entry
    document.addEventListener("click", (e) => {
      if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
      const a = e.target?.closest?.('a[href^="#/"]');
      if (!a || a.target) return;
      const href = a.getAttribute("href");
      if (href !== location.hash) nextVia = a.dataset.via || null;
      if (layers.length) { e.preventDefault(); this.open(href, { via: a.dataset.via || null }); }
    });
    sync(true);
  },
};

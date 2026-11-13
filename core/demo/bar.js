// core/demo/bar.js -- the line under the top bar while a pretend family is on screen: who this is, that nothing here
// touches the person's plan, and the way out. DOM only; the shell (core/app.js boot) calls it once after the plan loads.
// In the flow of the page (it scrolls away with it; nothing is fixed to the screen), on every page of the visit.
// "Leave" erases the pretend copy on this device and opens the app without the sandbox: the real plan, which was never
// read or written here (core/store.js keeps the pretend family under its own key). It leaves a note for this tab
// (names.js LEFT_KEY) so the first page afterwards can say the pretend family is closed.
// When the family's plan could not be fetched (store.demoMissing()), the line says so instead, in the attention colour.
import { demoLine, leaveHref, LEFT_KEY } from "./names.js";

const STYLE = `
#demo-bar { background: var(--panel-2); border-bottom: 1px solid var(--line); }
#demo-bar .demo-in { display: flex; align-items: center; gap: 10px; max-width: 1080px; margin: 0 auto; padding: 4px 14px; }
#demo-bar .demo-say { flex: 1; min-width: 0; font-size: var(--fs-sm); color: var(--text-2); line-height: 1.3; }
#demo-bar.missing { border-bottom-color: var(--bad); background: var(--bad-soft); }
#demo-bar.missing .demo-say { color: var(--text); }
#demo-bar button { flex: none; white-space: nowrap; }
@media (min-width: 960px) { #demo-bar { margin-left: var(--sidebar); } #demo-bar .demo-in { padding: 4px 28px; } }
@media print { #demo-bar { display: none; } }
`;

/**
 * Draw the line when `store.demo()` names a pretend family; nothing otherwise. Returns the element or null.
 * `go`: how to open an address (the browser's own by default; a test passes its own).
 */
export function showDemoBar(store, { doc = globalThis.document, loc = globalThis.location, go = (href) => loc.assign(href), tab = () => globalThis.sessionStorage } = {}) {
  const id = store?.demo?.();
  if (!id || !doc || doc.getElementById("demo-bar")) return null;
  const el = (tag, cls, text) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const missing = !!store.demoMissing?.();
  const bar = el("div", missing ? "missing" : ""); bar.id = "demo-bar"; bar.setAttribute("role", missing ? "alert" : "note");
  const leave = el("button", "secondary small", "Leave ›"); leave.type = "button";
  leave.setAttribute("aria-label", "Leave the pretend plan and go back to yours");
  leave.addEventListener("click", () => {
    try { store.eraseDevice(); } catch { /* the way out still works */ }
    if (!missing) try { tab().setItem(LEFT_KEY, id); } catch { /* no note: the page opens without its green line */ }   // nothing was opened: nothing to say closed
    go(leaveHref({ pathname: loc?.pathname ?? "", search: loc?.search ?? "" }));
  });
  const inner = el("div", "demo-in");
  inner.append(el("span", "demo-say", demoLine(id, { missing })), leave);
  bar.append(el("style", "", STYLE), inner);
  const before = doc.getElementById("sync-bar") ?? doc.getElementById("content");
  if (!before?.before) return null;
  before.before(bar);
  return bar;
}

/** Take the note "Leave" left in this tab, once: true when a pretend family was just closed. Never throws. */
export function takeLeft(tab = () => globalThis.sessionStorage) {
  try { const ss = tab(); if (ss.getItem(LEFT_KEY) === null) return false; ss.removeItem(LEFT_KEY); return true; } catch { return false; }
}

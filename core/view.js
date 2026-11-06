// core/view.js -- which view of the app this device shows, and what is really reachable right now.
//
// USER VIEW (the default): only pages that work, no build progress, no "soon", no developer pages, and nothing that
// needs the PC or the AI helper unless that thing answers. BUILD VIEW: everything, as the builders see it.
// Set with the address `?view=build` / `?view=user` (remembered on this device) or the switch at the end of Settings.
// Dependency-free and import-safe in Node (tests): every browser call is guarded, storage may throw (a sandboxed
// iframe, a private window) and then the choice lives in memory for the session.
export const VIEW_KEY = "planner.view";

/** "build" | "user" | null from an address search string ("?view=build"); anything else is no choice. */
export function parseView(search) {
  try { const v = new URLSearchParams(String(search ?? "")).get("view"); return v === "build" || v === "user" ? v : null; } catch { return null; }
}

let build = false;                 // the current choice (memory copy: storage may be unavailable)
const live = { pc: false, ai: false };

const store = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
const tell = (name) => { try { if (typeof dispatchEvent === "function" && typeof Event === "function") dispatchEvent(new Event(name)); } catch { } };

export const view = {
  /** Read the address first (and remember what it says), then the device's remembered choice. Call once at boot. */
  init(search = (() => { try { return globalThis.location?.search ?? ""; } catch { return ""; } })()) {
    const asked = parseView(search);
    if (asked) { this.set(asked === "build", { quiet: true }); return build; }
    try { build = store()?.getItem(VIEW_KEY) === "build"; } catch { build = false; }
    return build;
  },
  get build() { return build; },
  set(on, { quiet = false } = {}) {
    build = !!on;
    try { if (build) store()?.setItem(VIEW_KEY, "build"); else store()?.removeItem(VIEW_KEY); } catch { }
    if (!quiet) tell("planner:view");
  },
};

/** What answers right now: `pc` (the PC server holds the plan) and `ai` (the AI helper answers through it). */
export const reach = {
  get pc() { return live.pc; },
  get ai() { return live.ai; },
  /** Returns true when something changed. The AI cannot answer without the PC. */
  set({ pc = live.pc, ai = live.ai } = {}) {
    const next = { pc: !!pc, ai: !!pc && !!ai };
    if (next.pc === live.pc && next.ai === live.ai) return false;
    Object.assign(live, next); tell("planner:live"); return true;
  },
};

/**
 * Is this page offered in the menu, search, lists and links? (a page opened by its address always works.)
 * Build view: every page, as before. User view: a ready page that is not a builder's page, and whose `requires` ("pc",
 * "ai") is answering. `state` is { build, pc, ai }; the default is the live state above.
 */
export function offered(m, state = { build, pc: live.pc, ai: live.ai }, ready = (x) => x.status !== "planned") {
  if (!m) return false;
  if (state.build) return true;
  if (!ready(m) || m.builderOnly) return false;
  if (m.requires === "ai") return !!state.pc && !!state.ai;
  if (m.requires === "pc") return !!state.pc;
  return true;
}
export const shown = (m, ready) => offered(m, { build, pc: live.pc, ai: live.ai }, ready);

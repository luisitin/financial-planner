// accept-taps/_lib.mjs -- shared helpers for the wave 1 "taps" acceptance scripts B1..B17.
// Every script: node B<n>.mjs <app base url> <root of the tree that url serves>   (exit 0: the behavior holds, 1: it does not)
// Phone 390 x 844 with touch, the sandbox, real touches at coordinates, real touch drags for swipes, key-by-key typing.
export * from "$SP/ux/kit.mjs";
import { households, open, sleep, settle } from "$SP/ux/kit.mjs";

export const BASE = process.argv[2];
export const ROOT = process.argv[3];
if (!BASE || !ROOT) { console.error("usage: node B<n>.mjs <app base url> <root of the served tree>"); process.exit(2); }
export const H = await households(ROOT);

export const rows = [];
/** One measured check: printed at once, counted at the end. */
export const say = (id, ok, note) => { rows.push({ id, ok, note }); console.log(`${ok ? "ok  " : "FAIL"} ${id}: ${note}`); };
/** Exit 0 when every check held. */
export function done(name) {
  const bad = rows.filter((r) => !r.ok);
  console.log(`\n${name}: ${rows.length - bad.length} of ${rows.length} checks hold${bad.length ? ` (failed: ${bad.map((r) => r.id).join(", ")})` : ""}`);
  process.exit(bad.length || !rows.length ? 1 : 0);
}
/** Open a household on a page and run fn(page, session); an error is a failed check. */
export async function run(id, who, route, fn, opts = {}) {
  const s = await open({ base: BASE, plan: typeof who === "function" ? who() : who ? H[who]() : null, route, ...opts });
  s.page.setDefaultTimeout(opts.timeout ?? 8000);
  try { await sleep(400); await settle(s.page); await fn(s.page, s); }
  catch (e) { say(id, false, "ERR " + String(e.message).split("\n")[0]); }
  finally { await s.close(); }
}
/** The middle of a control on the screen, after it was brought into view the way a page scroll would. */
export async function mid(loc) { await loc.scrollIntoViewIfNeeded(); await sleep(250); const b = await loc.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2, b]; }
/** A real touch on a control (on its middle). */
export async function tapEl(p, loc, wait = 900) { const [x, y] = await mid(loc); await p.touchscreen.tap(x, y); await sleep(wait); await settle(p); return [x, y]; }
/** A real touch on the top bar's buttons (never scrolled: the bar is sticky). */
export async function tapBar(p, sel, wait = 450) { const b = await p.locator(sel).boundingBox(); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await sleep(wait); }
/** What a person would call the control under a point. */
export const under = (p, x, y) => p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); const c = e?.closest("a,button,summary,label,input,select,textarea,li"); return c ? c.tagName.toLowerCase() + ' "' + (c.textContent || c.name || c.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 50) + '"' : (e ? e.tagName.toLowerCase() : null); }, [x, y]);
/** Bring a control to a height on the screen (set-up only; checks about scrolling use swipe). */
export const bringTo = async (p, loc, at = 600) => { const abs = await loc.evaluate((e) => e.getBoundingClientRect().top + scrollY); await p.evaluate(([y, a]) => scrollTo(0, Math.max(0, y - a)), [abs, at]); await sleep(300); };
/** A real swipe (touch drag) like a thumb, from y0 to y1 at x. */
export async function swipe(p, x, y0, y1, { steps = 12, ms = 180 } = {}) {
  const cdp = p.__cdp ?? (p.__cdp = await p.context().newCDPSession(p));
  const pt = (y) => [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }];
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pt(y0) });
  for (let i = 1; i <= steps; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pt(y0 + (y1 - y0) * i / steps) }); await sleep(ms / steps); }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(450);
}
/** The scroll position once it stopped moving. */
export const still = async (p) => { let a = -1; for (let i = 0; i < 40; i++) { const b = await p.evaluate(() => Math.round(scrollY)); if (b === a) return b; a = b; await sleep(150); } return a; };
/** Where things stand in the shell: address, menu, focus, the top bar's "‹" and its name, the named ways back on the page. */
export const shell = (p) => p.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; };
  const nb = document.getElementById("nav-back"); const a = document.activeElement;
  return {
    hash: location.hash, len: history.length, title: document.getElementById("page-title")?.textContent ?? "",
    open: !!document.getElementById("sidebar")?.classList.contains("open"), y: Math.round(scrollY),
    focus: !a || a === document.body ? "body" : (a.id || a.className || a.tagName),
    back: nb && !nb.hidden && vis(nb) ? nb.getAttribute("aria-label") : null,
    ways: [...document.querySelectorAll("#content a")].filter(vis).map((e) => e.textContent.replace(/\s+/g, " ").trim()).filter((t) => /^‹/.test(t)),
    text: (document.querySelector("#content")?.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 160),
  };
});
/** The phone's Back, at a person's pace. */
export const BACK = async (p) => { await p.evaluate(() => history.back()); await sleep(900); await settle(p).catch(() => {}); return shell(p).catch(() => ({ hash: "LEFT THE APP" })); };
/** The saved plan in the sandbox (what a tap really changed). */
export const planOf = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("planner.plan.sandbox") || "null"));
/** The taps the guard swallowed (the sandbox keeps a list; information only, never what a check decides on). */
export const swallowed = (p) => p.evaluate(() => (window.__swallowed ?? []).map((x) => x.why)).catch(() => []);

// accept-forms/_lib.mjs -- shared helpers for the wave 1 "forms" acceptance scripts B1..B15.
// Every script: node B<n>.mjs <app base url> <root of the tree that url serves>   (exit 0: the behavior holds, 1: it does not)
// A person's pace on a phone (390 x 844, touch, Chromium with an iPhone's user agent), always the sandbox: real finger
// drags to find a control, a touch at its centre, typing key by key (70 ms), about 450 ms between actions. Adapted from
// the forms judge's jlib.mjs. Nothing here writes to the served tree.
import fs from "node:fs";
import path from "node:path";
export * from "$SP/ux/kit.mjs";
import { households, open, sleep, settle } from "$SP/ux/kit.mjs";

export const BASE = process.argv[2];
export const ROOT = process.argv[3] ? path.resolve(process.argv[3]) : null;
if (!BASE || !ROOT) { console.error("usage: node B<n>.mjs <app base url> <root of the served tree>"); process.exit(2); }
export const H = await households(ROOT);
export const HERE = path.dirname(new URL(import.meta.url).pathname);
export const PACE = 450;

export const rows = [];
/** One measured check: printed at once, counted at the end. */
export const say = (id, ok, note) => { rows.push({ id, ok, note }); console.log(`${ok ? "ok  " : "FAIL"} ${id}: ${note}`); };
/** Exit 0 when every check held (and at least one ran). */
export function done(name) {
  const bad = rows.filter((r) => !r.ok);
  console.log(`\n${name}: ${rows.length - bad.length} of ${rows.length} checks hold${bad.length ? ` (failed: ${bad.map((r) => r.id).join(", ")})` : ""}`);
  process.exit(bad.length || !rows.length ? 1 : 0);
}

/**
 * Open a household on a page and run fn(s); an error is a failed check. opts: viewport, touch (false: a keyboard user
 * with a mouse), swap: { "group/id": "<file under accept-forms/pages>" } serves a page copy that adopts the kit (only
 * when the served page has not adopted it yet: `marker` is the call the adopted page makes).
 */
export async function run(id, hh, route, fn, opts = {}) {
  const plan = typeof hh === "function" ? hh() : hh ? H[hh]() : null;
  const s = await open({ base: BASE, plan, route, ...opts });
  s.page.setDefaultTimeout(opts.timeout ?? 10000);
  s.cdp = await s.ctx.newCDPSession(s.page);
  s.errors = [];
  s.page.on("pageerror", (e) => s.errors.push(String(e.message).slice(0, 160)));
  try {
    if (opts.swap) s.swapped = await swapPages(s, opts.swap);
    await s.page.evaluate(() => {
      window.__j = { invalid: [], confirms: [], focus: [], confirmAnswer: true };
      // registered after the kit's own capture listener on the same node: sees whether the kit cancelled the browser's bubble
      document.addEventListener("invalid", (e) => { window.__j.invalid.push({ name: e.target.name || e.target.getAttribute("aria-label") || "", bubble: !e.defaultPrevented, msg: e.target.validationMessage }); }, true);
      document.addEventListener("focusin", (e) => { window.__j.focus.push(e.target.name || e.target.getAttribute("aria-label") || e.target.textContent?.trim().slice(0, 30) || e.target.tagName); }, true);
      window.confirm = (t) => { window.__j.confirms.push(String(t)); return window.__j.confirmAnswer; };
    });
    await sleep(500); await settle(s.page);
    await fn(s);
    if (s.errors.length) say(`${id}-page-errors`, false, s.errors.slice(0, 3).join(" | "));
  } catch (e) { say(id, false, "ERR " + String(e.message).split("\n")[0].slice(0, 220)); }
  finally { await s.close(); }
}
/** Serve the adopted copy of a page's view.js when the served one has not adopted the kit call yet (then reload). */
async function swapPages(s, swap) {
  const used = [];
  await s.cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  for (const [key, { file, marker }] of Object.entries(swap)) {
    const served = await (await fetch(`${BASE}/modules/${key}/view.js`)).text();
    if (served.includes(marker)) { used.push(`${key}: the served page (it calls ${marker})`); continue; }
    const body = fs.readFileSync(path.join(HERE, "pages", file), "utf8");
    await s.page.route(`**/modules/${key}/view.js*`, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body }));
    used.push(`${key}: the adopted copy accept-forms/pages/${file} (the served page does not call ${marker} yet)`);
  }
  await s.page.reload({ waitUntil: "load" });
  await s.page.waitForSelector("#content [data-page], #content .notice", { timeout: 15000 }).catch(() => { });
  await settle(s.page);
  return used;
}
/** A real finger drag on the page (dy > 0 moves the page up, like a thumb pushing it). */
export async function drag(s, dy) {
  const x = 195, h = await s.page.evaluate(() => innerHeight), y0 = dy > 0 ? h - 84 : 120, n = Math.max(8, Math.round(Math.abs(dy) / 12));
  await s.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= n; i++) { await s.cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y0 - (dy + Math.sign(dy) * 15) * i / n }] }); await sleep(14); }
  await sleep(80);
  await s.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(350);
}
/** Swipe until the control is on screen (at about `at` of the screen's height). */
export async function swipeInto(s, loc, { at = 0.7 } = {}) {
  for (let i = 0; i < 24; i++) {
    const r = await loc.evaluate((e) => { const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, h: innerHeight }; });
    if (r.top >= 64 && r.bottom <= r.h - 16) return;
    const d = Math.round(r.top - (r.h * at - (r.bottom - r.top) / 2));
    await drag(s, Math.max(-600, Math.min(600, d)));
  }
}
/** A touch at the control's centre (no scrolling by the tool). */
export async function tap(s, loc, wait = PACE) { const b = await loc.boundingBox(); await s.page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await sleep(wait); }
export async function swipeTap(s, loc, wait = PACE) { await swipeInto(s, loc); await tap(s, loc, wait); }
/** Find the box, tap it, empty it, type key by key. */
export async function typeIn(s, loc, text) { await swipeTap(s, loc); await loc.evaluate((e) => { e.value = ""; }); await s.page.keyboard.type(String(text), { delay: 70 }); await sleep(PACE); }
export const typeKeys = async (s, text) => { await s.page.keyboard.type(String(text), { delay: 70 }); await sleep(PACE); };
export const box = (s, label) => s.page.locator("#content").getByLabel(label, { exact: false }).first();
export const btn = (s, text) => s.page.locator("#content").getByRole("button", { name: text, exact: true }).first();
export const byText = (s, re) => s.page.locator("#content button, #content summary, #content a").filter({ hasText: re }).first();
export const planOf = (s) => s.page.evaluate(() => JSON.parse(localStorage.getItem("planner.plan.sandbox")));
export const focusText = (s) => s.page.evaluate(() => { const a = document.activeElement; return a && a !== document.body ? `${a.tagName} ${a.name || a.getAttribute("aria-label") || a.textContent.trim().slice(0, 30)}` : "nothing"; });
export const topOf = (loc) => loc.evaluate((e) => Math.round(e.getBoundingClientRect().top)).catch(() => null);
export const rect = (loc) => loc.evaluate((e) => { const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), w: Math.round(b.width) }; });
/** On the screen a person sees: under the top bar, above the bottom (or the keyboard). */
export const inViewNow = (loc) => loc.evaluate((e) => { const tb = document.getElementById("topbar").getBoundingClientRect().bottom; const vb = window.visualViewport ? visualViewport.offsetTop + visualViewport.height : innerHeight; const b = e.getBoundingClientRect(); return b.height > 0 && b.top >= tb - 1 && b.bottom <= vb + 1; });
export const valueOf = (loc) => loc.inputValue().catch(() => null);
export const resetLog = (s) => s.page.evaluate(() => { window.__j.invalid = []; window.__j.confirms = []; window.__j.focus = []; });
/** What the person sees now: the focus, the words at boxes, red lines, the browser's bubbles, green lines on screen. */
export const look = (s) => s.page.evaluate(() => {
  const tb = document.getElementById("topbar").getBoundingClientRect().bottom;
  const vb = window.visualViewport ? visualViewport.offsetTop + visualViewport.height : innerHeight;
  const inView = (el) => { if (!el?.isConnected) return false; const r = el.getBoundingClientRect(); return r.top >= tb - 1 && r.bottom <= vb + 1 && r.height > 0; };
  const a = document.activeElement;
  const lab = (a?.closest?.(".field") ?? a?.closest?.("label"))?.querySelector(".field-label") ?? null;
  return {
    y: Math.round(scrollY),
    focus: a && a !== document.body ? { tag: a.tagName, name: a.name || a.getAttribute("aria-label") || a.textContent.trim().slice(0, 40), inView: inView(a), invalid: a.getAttribute("aria-invalid") === "true" } : null,
    labelShown: lab ? lab.getBoundingClientRect().top >= tb - 1 : null,
    fieldErrors: [...document.querySelectorAll("#content .field-error")].map((e) => ({ text: e.textContent, inView: inView(e), red: getComputedStyle(e).color === "rgb(185, 28, 28)", bold: getComputedStyle(e).fontWeight === "600" })),
    formErrors: [...document.querySelectorAll("#content .form-error, #content .notice.error")].map((e) => ({ text: e.textContent.trim().slice(0, 160), inView: inView(e), top: Math.round(e.getBoundingClientRect().top), bottom: Math.round(e.getBoundingClientRect().bottom), role: e.getAttribute("role") })),
    bubbles: window.__j.invalid.filter((x) => x.bubble).map((x) => x.msg),
    okInView: [...document.querySelectorAll("#content .notice.ok")].filter(inView).map((e) => e.textContent.trim().slice(0, 120)),
  };
});
export const short = (l) => JSON.stringify({ y: l.y, focus: l.focus && `${l.focus.tag} ${l.focus.name}${l.focus.inView ? "" : " (off screen)"}`, labelShown: l.labelShown, words: l.fieldErrors.map((x) => `${x.text}${x.inView ? "" : " (off)"}`), lines: l.formErrors.map((x) => `${x.text.slice(0, 70)} @${x.top}${x.inView ? "" : " (off)"}`), bubbles: l.bubbles.length });
export const keyWalk = async (s, max = 8, onBox = null) => {
  const walk = [];
  for (let i = 0; i < max; i++) {
    const st = await s.page.evaluate(() => ({ n: document.activeElement?.name || document.activeElement?.tagName, hint: document.activeElement?.enterKeyHint, tag: document.activeElement?.tagName }));
    walk.push(`${st.n}:${st.hint || "-"}`);
    if (st.tag === "TEXTAREA" || st.tag === "SELECT" || st.tag === "BODY" || st.tag === "BUTTON") break;
    if (onBox) await onBox(st);
    await s.page.keyboard.press("Enter"); await sleep(PACE);
  }
  return walk;
};
export { sleep, settle };

// judge-forms/jlib.mjs -- the judge's helpers: one script, three servers built from ee09f6e (today, A, B), the same
// journeys at a person's pace (real touch taps at a control's centre, real finger drags, typing key by key at 70 ms,
// 450 ms between actions). Adapted from the architects' flib.mjs; nothing here writes to the repo. Always the sandbox.
import { households, open, state, settle, sleep, shot, PHONE } from "$SP/ux/kit.mjs";
export { households, state, settle, sleep, shot, PHONE };
export const J = "$SP/w1/bf";
export const ROOT = `${J}/tip`;
export const PORT = { build: 9431, tip: 9432 };
export const PACE = 450;
export async function openT(target, plan, route, more = {}) {
  const s = await open({ base: `http://127.0.0.1:${PORT[target]}`, plan, route, ...more });
  s.cdp = await s.ctx.newCDPSession(s.page);
  s.errors = [];
  s.page.on("pageerror", (e) => s.errors.push(String(e.message).slice(0, 160)));
  await s.page.evaluate(() => {
    window.__j = { invalid: [], confirms: [], focus: [] };
    // registered after the kit's own capture listener on the same node: sees whether the kit cancelled the browser's bubble
    document.addEventListener("invalid", (e) => { window.__j.invalid.push({ name: e.target.name || e.target.getAttribute("aria-label") || "", bubble: !e.defaultPrevented, msg: e.target.validationMessage }); }, true);
    document.addEventListener("focusin", (e) => { window.__j.focus.push(e.target.name || e.target.getAttribute("aria-label") || e.target.textContent?.trim().slice(0, 30) || e.target.tagName); }, true);
    window.confirm = (t) => { window.__j.confirms.push(String(t)); return true; };
  });
  await sleep(200);
  return s;
}
export async function drag(s, dy) {
  const x = 195, h = await s.page.evaluate(() => innerHeight), y0 = dy > 0 ? h - 84 : 120, n = Math.max(8, Math.round(Math.abs(dy) / 12));
  await s.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
  for (let i = 1; i <= n; i++) { await s.cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y0 - (dy + Math.sign(dy) * 15) * i / n }] }); await sleep(14); }
  await sleep(80);
  await s.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(350);
}
export async function swipeInto(s, loc, { at = 0.7 } = {}) {
  for (let i = 0; i < 24; i++) {
    const r = await loc.evaluate((e) => { const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, h: innerHeight }; });
    if (r.top >= 64 && r.bottom <= r.h - 16) return;
    const d = Math.round(r.top - (r.h * at - (r.bottom - r.top) / 2));
    await drag(s, Math.max(-600, Math.min(600, d)));
  }
}
export async function tap(s, loc) { const b = await loc.boundingBox(); await s.page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await sleep(PACE); }
export async function swipeTap(s, loc) { await swipeInto(s, loc); await tap(s, loc); }
export async function typeIn(s, loc, text) { await swipeTap(s, loc); await loc.evaluate((e) => { e.value = ""; }); await s.page.keyboard.type(String(text), { delay: 70 }); await sleep(PACE); }
export const box = (s, label) => s.page.locator("#content").getByLabel(label, { exact: false }).first();
export const btn = (s, text) => s.page.locator("#content").getByRole("button", { name: text, exact: true }).first();
export const byText = (s, re) => s.page.locator("#content button, #content summary, #content a").filter({ hasText: re }).first();
export const planOf = (s) => s.page.evaluate(() => JSON.parse(localStorage.getItem("planner.plan.sandbox")));
export const focusText = (s) => s.page.evaluate(() => { const a = document.activeElement; return a && a !== document.body ? `${a.tagName} ${a.name || a.getAttribute("aria-label") || a.textContent.trim().slice(0, 30)}` : "nothing"; });
export const topOf = (loc) => loc.evaluate((e) => Math.round(e.getBoundingClientRect().top)).catch(() => null);
/** What the person sees now. */
export const look = (s) => s.page.evaluate(() => {
  const tb = document.getElementById("topbar").getBoundingClientRect().bottom;
  const vb = window.visualViewport ? visualViewport.offsetTop + visualViewport.height : innerHeight;
  const inView = (el) => { if (!el?.isConnected) return false; const r = el.getBoundingClientRect(); return r.top >= tb - 1 && r.bottom <= vb + 1 && r.height > 0; };
  const a = document.activeElement;
  const fieldOf = (el) => el?.closest?.(".field") ?? el?.closest?.("label");
  const lab = fieldOf(a)?.querySelector(".field-label") ?? null;
  return {
    y: Math.round(scrollY),
    focus: a && a !== document.body ? { tag: a.tagName, name: a.name || a.getAttribute("aria-label") || a.textContent.trim().slice(0, 40), inView: inView(a), invalid: a.getAttribute("aria-invalid") === "true" } : null,
    labelShown: lab ? lab.getBoundingClientRect().top >= tb - 1 : null,
    fieldErrors: [...document.querySelectorAll("#content .field-error")].map((e) => ({ text: e.textContent, inView: inView(e), color: getComputedStyle(e).color })),
    formErrors: [...document.querySelectorAll("#content .form-error, #content .notice.error")].map((e) => ({ text: e.textContent.trim().slice(0, 140), inView: inView(e), top: Math.round(e.getBoundingClientRect().top) })),
    bubbles: window.__j.invalid.filter((x) => x.bubble).map((x) => x.msg),
    invalidEvents: window.__j.invalid.length,
    echo: [...document.querySelectorAll(".save-echo")].map((e) => e.textContent.trim().slice(0, 100)),
    okInView: [...document.querySelectorAll("#content .notice.ok")].filter(inView).map((e) => e.textContent.trim().slice(0, 100)),
  };
});
export const resetLog = (s) => s.page.evaluate(() => { window.__j.invalid = []; window.__j.confirms = []; window.__j.focus = []; });

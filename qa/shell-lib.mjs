// qa/shell-lib.mjs -- what the qa/shell-*.mjs checks share: a phone (Playwright, real touch), the sandbox seeded with the
// invented family of qa/fixtures/family-plan.mjs, and a few plain measurements of the shell (address, menu, the top bar's
// "‹", the named ways back). Everything runs in the sandbox (?sandbox=1); nothing touches a real plan.
//   node qa/shell-<name>.mjs [base URL]      (default http://127.0.0.1:8787; start the app with npm run serve first)
// Needs Playwright (/opt/node22/lib/node_modules/playwright, or the PLAYWRIGHT environment variable).
import { familyPlan } from "./fixtures/family-plan.mjs";

export const BASE = (process.argv[2] ?? "http://127.0.0.1:8787").replace(/\/$/, "");
export const TODAY = "2026-11-11";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { chromium } = await import(process.env.PLAYWRIGHT ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
export const PHONE = { width: 390, height: 844 }, SMALL_PHONE = { width: 320, height: 568 };
export const family = () => familyPlan(TODAY);

const rows = [];
export const say = (id, ok, note) => { rows.push({ id, ok }); console.log(`${ok ? "ok  " : "FAIL"} ${id}: ${note}`); };
export function done(name) {
  const bad = rows.filter((r) => !r.ok);
  console.log(`\n${name}: ${rows.length - bad.length} of ${rows.length} checks hold${bad.length ? ` (failed: ${bad.map((r) => r.id).join(", ")})` : ""}`);
  process.exit(bad.length || !rows.length ? 1 : 0);
}

/** The page has drawn and nothing changed on it for `quiet` ms (at most `max`). */
export const settle = (p, quiet = 250, max = 6000) => p.evaluate(([quiet, max]) => new Promise((res) => {
  const start = performance.now(); let last = start;
  const mo = new MutationObserver(() => { last = performance.now(); });
  mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  const tick = () => { const now = performance.now(); if (now - last >= quiet || now - start >= max) { mo.disconnect(); res(); } else setTimeout(tick, 50); };
  setTimeout(tick, 50);
}), [quiet, max]).catch(() => {});

/** Open the app on a phone at a page, with a plan in the sandbox; run fn(page); an error is a failed check. */
export async function run(id, plan, route, fn, { viewport = PHONE, touch = true, reducedMotion = false } = {}) {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: touch, hasTouch: touch, userAgent: touch ? UA : undefined, reducedMotion: reducedMotion ? "reduce" : "no-preference" });
    if (plan) await ctx.addInitScript((p) => { try { if (!sessionStorage.getItem("qa.seeded")) { localStorage.setItem("planner.plan.sandbox", p); sessionStorage.setItem("qa.seeded", "1"); } } catch { } }, JSON.stringify(plan));
    const p = await ctx.newPage(); p.setDefaultTimeout(8000);
    await p.goto(`${BASE}/?sandbox=1#/${route}`, { waitUntil: "load" });
    await p.waitForSelector("#content [data-page], #content section.card", { timeout: 15000 }).catch(() => {});
    await sleep(400); await settle(p);
    await fn(p);
  } catch (e) { say(id, false, "ERR " + String(e.message).split("\n")[0]); }
  finally { await browser.close(); }
}
/** A real touch on the middle of a control, after it was brought into view. */
export async function tap(p, loc, wait = 900) {
  await loc.scrollIntoViewIfNeeded(); await sleep(250);
  const b = await loc.boundingBox(); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  await sleep(wait); await settle(p);
}
/** A real touch on a top-bar button (the bar is sticky: never scrolled). */
export async function tapBar(p, sel, wait = 500) { const b = await p.locator(sel).boundingBox(); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await sleep(wait); }
/** A thumb's swipe (touch drag) from y0 to y1 at x. */
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
/** Where the shell stands: address, history length, menu, focus, the top bar's "‹" (its name), the "‹ ..." links on the page. */
export const shell = (p) => p.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; };
  const nb = document.getElementById("nav-back"); const a = document.activeElement;
  return {
    hash: location.hash, len: history.length, title: document.getElementById("page-title")?.textContent ?? "",
    open: !!document.getElementById("sidebar")?.classList.contains("open"), y: Math.round(scrollY),
    focus: !a || a === document.body ? "body" : (a.id || a.className || a.tagName),
    back: nb && !nb.hidden && vis(nb) ? nb.getAttribute("aria-label") : null,
    ways: [...document.querySelectorAll("#content a")].filter(vis).map((e) => e.textContent.replace(/\s+/g, " ").trim()).filter((t) => /^‹/.test(t)),
  };
});
/** The phone's Back, at a person's pace. */
export const back = async (p) => { await p.evaluate(() => history.back()); await sleep(900); await settle(p); return shell(p); };
/** The plan saved in the sandbox. */
export const planOf = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("planner.plan.sandbox") || "null"));

// judge lib: one thumb for both prototypes. It reads only what a person sees (scroll, open sections, the values in the
// boxes, words on the screen, history length), never a design's own classes or storage, so A and B are measured alike.
//   A = place  (9401), B = place2 (9402), T = today (ee09f6e untouched, 9403). Always ?sandbox=1.
import { households, open, state, settle, sleep, shot } from "$SP/ux/kit.mjs";
export { households, open, state, settle, sleep, shot };
export const J = "$SP/w1/judge-place";
export const BASES = { A: "http://127.0.0.1:9401", B: "http://127.0.0.1:9402", T: "http://127.0.0.1:9403" };
export const H = await households(`${J}/T`);
export const start = (who, plan, route, { slow = 1, viewport } = {}) => open({ base: BASES[who], plan, route, slow, viewport });
export const Y = (page) => page.evaluate(() => Math.round(scrollY));
/** A finger drag (CDP touch, about 0.4 s a swipe, no fling): moves the page down by about dy px (up when negative). */
export async function swipe(s, dy, { x = 195 } = {}) {
  const cdp = s.__cdp ?? (s.__cdp = await s.ctx.newCDPSession(s.page));
  let left = dy;
  while (Math.abs(left) > 1) {
    const step = Math.sign(left) * Math.min(Math.abs(left), 440);
    const y0 = step > 0 ? 680 : 220, y1 = y0 - step;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y0 }] });
    for (let i = 1; i <= 12; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y0 + (y1 - y0) * i / 12 }] }); await sleep(16); }
    await sleep(120);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await sleep(260);
    left -= step;
  }
  await sleep(250);
  return Y(s.page);
}
/** Where an element is now ({x, y centre, top, bottom, text}); only drawn elements (not inside a shut section). */
export async function seen(page, sel, { text = null, nth = 0, within = "#content" } = {}) {
  return page.evaluate(([sel, text, nth, within]) => {
    const vis = (e) => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let d = e.closest("details:not([open])"); d; d = d.parentElement?.closest("details:not([open])")) if (!d.querySelector(":scope > summary")?.contains(e)) return false; return true; };
    const all = [...document.querySelectorAll(within ? `${within} ${sel}` : sel)].filter((e) => vis(e) && (text === null || e.textContent.replace(/\s+/g, " ").trim().includes(text)));
    const e = all[nth]; if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: Math.round(r.left + Math.min(r.width / 2, 160)), y: Math.round(r.top + r.height / 2), top: Math.round(r.top), bottom: Math.round(r.bottom), text: e.textContent.replace(/\s+/g, " ").trim().slice(0, 60) };
  }, [sel, text, nth, within]);
}
/** Drag until the element is comfortably on the screen, like a person looking for it. */
export async function bring(s, sel, opts = {}) {
  for (let i = 0; i < 40; i++) {
    const e = await seen(s.page, sel, opts);
    if (!e) return null;
    if (e.top >= 140 && e.bottom <= 640) return e;
    const before = await Y(s.page);
    await swipe(s, Math.max(-440, Math.min(440, e.y - 400)));
    if (Math.abs((await Y(s.page)) - before) < 2) return seen(s.page, sel, opts);
  }
  return seen(s.page, sel, opts);
}
export async function thumb(s, sel, opts = {}) {
  const e = await bring(s, sel, opts);
  if (!e) throw new Error(`not on the page: ${sel} ${opts.text ?? ""}`);
  await s.page.touchscreen.tap(e.x, e.y);
  return e;
}
/** Tap a box and type key by key (80 ms a key, trap 6). */
export async function type(s, sel, text, opts = {}) {
  const e = await thumb(s, sel, opts);
  await sleep(200);
  if (opts.clear) { await s.page.keyboard.press("Control+A"); await s.page.keyboard.press("Delete"); }
  await s.page.keyboard.type(String(text), { delay: 80 });
  await sleep(150);
  return e;
}
export async function phoneBack(s, wait = 1500) { await s.page.goBack().catch(() => { }); await sleep(wait); await settle(s.page); }
export async function phoneForward(s, wait = 1500) { await s.page.goForward().catch(() => { }); await sleep(wait); await settle(s.page); }
export async function reload(s) { await s.page.reload({ waitUntil: "load" }); await s.page.waitForSelector("#content [data-page]", { timeout: 15000 }).catch(() => { }); await sleep(1800); await settle(s.page); }
export const openFolds = (page) => page.evaluate(() => [...document.querySelectorAll("#content details[open] > summary")].map((x) => (x.querySelector(".fold-title") ?? x).textContent.replace(/\s+/g, " ").trim().slice(0, 40)));
export const vals = (p, sel) => p.evaluate((sel) => [...document.querySelectorAll(sel)].filter((c) => c.getClientRects().length).map((c) => (c.type === "checkbox" ? String(c.checked) : c.value)), sel);
/** What a person reads about kept typing and confirmations: words on the page and in the bottom note. */
export const look = (p) => p.evaluate(() => {
  const vis = (e) => e.getClientRects().length > 0 && !e.closest("details:not([open])");
  const onScreen = (e) => { const r = e.getBoundingClientRect(); const top = document.getElementById("topbar")?.getBoundingClientRect().bottom ?? 0; return r.bottom > top + 10 && r.top < innerHeight - 10; };
  const words = [...document.querySelectorAll("#content *")].filter((e) => e.children.length < 4 && vis(e) && /not saved yet/i.test(e.textContent) && e.textContent.length < 260);
  const leaf = words.filter((e) => !words.some((o) => o !== e && e.contains(o)));
  const note = document.querySelector(".save-echo");
  return {
    notSaved: leaf.length, notSavedOnScreen: leaf.filter(onScreen).length, kept: leaf.map((e) => e.textContent.replace(/\s+/g, " ").trim().slice(0, 90)).slice(0, 3),
    note: note ? note.textContent.replace(/\s+/g, " ").trim().slice(0, 140) : null,
    hash: location.hash, y: Math.round(scrollY), hist: history.length,
  };
});
export const tapMenu = async (s) => { const b = await s.page.locator("#nav-toggle").boundingBox(); await s.page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await sleep(500); };
export async function menuTo(s, title) { await tapMenu(s); const e = await seen(s.page, ".nav-link", { text: title, within: "#sidebar" }); if (!e) throw new Error("menu row not on screen: " + title); await s.page.touchscreen.tap(e.x, e.y); await sleep(900); await settle(s.page); }
export const planOf = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("planner.plan.sandbox") || "null"));
/** Sample the scroll and the page's height every 50 ms for ms: did anything move by itself? */
export async function watch(page, ms = 4000) {
  return page.evaluate((ms) => new Promise((res) => { const out = []; const t0 = performance.now(); const id = setInterval(() => { out.push([Math.round(performance.now() - t0), Math.round(scrollY), document.documentElement.scrollHeight]); if (performance.now() - t0 > ms) { clearInterval(id); res(out); } }, 50); }), ms);
}
export const moves = (samples) => { let m = 0; for (let i = 1; i < samples.length; i++) m = Math.max(m, Math.abs(samples[i][1] - samples[0][1])); return m; };
/** Blank under the page: how far the screen's bottom is below the last drawn thing of #content (positive = grey). */
export const blank = (page) => page.evaluate(() => { const c = document.getElementById("content"); const kids = [...c.querySelectorAll(":scope > *")].filter((e) => e.getClientRects().length); const last = kids.length ? Math.max(...kids.map((k) => k.getBoundingClientRect().bottom)) : 0; return Math.round(innerHeight - last); });
export async function run(name, who, fn, rows, opts = {}) {
  const t0 = Date.now();
  let s = null;
  try { s = await fn(); rows.push({ name, who, ...(s.result ?? {}), err: s.pageErrors?.length ? s.pageErrors[0].slice(0, 90) : 0, ms: Date.now() - t0 }); }
  catch (e) { rows.push({ name, who, error: String(e.message).split("\n")[0].slice(0, 160) }); }
  try { await s?.close?.(); } catch { }
}

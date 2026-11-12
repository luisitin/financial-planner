// accept-place/_lib.mjs -- the one thumb the place track's acceptance scripts share (B1.mjs ... B19.mjs).
//   node B<n>.mjs <base URL of the served app> <root of the served tree (for the invented households)>
// Every script exits 0 when its behavior holds and 1 when it does not, and prints what it measured. It reads only what a
// person sees: the scroll, open sections, the values in the boxes, words on the page and in the bottom note, the address
// and the history's length. Phone 390 x 844 with touch, always ?sandbox=1. Fingers are CDP touch drags (about 0.4 s a
// swipe), taps land at screen points, keys are typed one at a time (80 ms), Back is waited on like a person (1.5 s).
import { households, open, state, settle, sleep, shot } from "$SP/ux/kit.mjs";
export { state, settle, sleep, shot };
export const BASE = process.argv[2], ROOT = process.argv[3];
if (!BASE || !ROOT) { console.error("usage: node B<n>.mjs <base URL> <served tree root>"); process.exit(2); }
export const H = await households(ROOT);
export const start = (plan, route, { slow = 1, viewport, dark = false } = {}) => open({ base: BASE, plan, route, slow, viewport, dark });
export const Y = (page) => page.evaluate(() => Math.round(scrollY));
/** A finger drag: moves the page down by about dy px (up when negative). */
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
/** Where a drawn element is now ({ x, y centre, top, bottom, text }), or null. */
export async function seen(page, sel, { text = null, nth = 0, within = "#content" } = {}) {
  return page.evaluate(([sel, text, nth, within]) => {
    const vis = (e) => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; for (let d = e.closest("details:not([open])"); d; d = d.parentElement?.closest("details:not([open])")) if (!d.querySelector(":scope > summary")?.contains(e)) return false; return true; };
    const all = [...document.querySelectorAll(within ? `${within} ${sel}` : sel)].filter((e) => vis(e) && !e.closest(".only-wide") && (text === null || e.textContent.replace(/\s+/g, " ").trim().includes(text)));
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
/** Tap a box and type key by key (80 ms a key). */
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
export const vals = (p, sel) => p.evaluate((sel) => [...document.querySelectorAll(sel)].filter((c) => c.getClientRects().length && !c.closest("details:not([open])")).map((c) => (c.type === "checkbox" ? String(c.checked) : c.value)), sel);
/** What a person reads about kept typing and confirmations: words on the page and in the bottom note. */
export const look = (p) => p.evaluate(() => {
  const vis = (e) => e.getClientRects().length > 0 && !e.closest("details:not([open])");
  const onScreen = (e) => { const r = e.getBoundingClientRect(); const top = document.getElementById("topbar")?.getBoundingClientRect().bottom ?? 0; return r.bottom > top + 10 && r.top < innerHeight - 10; };
  const words = [...document.querySelectorAll("#content *")].filter((e) => e.children.length < 4 && vis(e) && /not saved yet/i.test(e.textContent) && e.textContent.length < 260);
  const leaf = words.filter((e) => !words.some((o) => o !== e && e.contains(o)));
  const note = document.querySelector(".save-echo");
  return { notSaved: leaf.length, notSavedOnScreen: leaf.filter(onScreen).length, kept: leaf.map((e) => e.textContent.replace(/\s+/g, " ").trim().slice(0, 90)).slice(0, 3), note: note ? note.textContent.replace(/\s+/g, " ").trim().slice(0, 140) : null, hash: location.hash, y: Math.round(scrollY), hist: history.length };
});
export const tapMenu = async (s) => { const b = await s.page.locator("#nav-toggle").boundingBox(); await s.page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await sleep(500); };
export async function menuTo(s, title) { await tapMenu(s); const e = await seen(s.page, ".nav-link", { text: title, within: "#sidebar" }); if (!e) throw new Error("menu row not on screen: " + title); await s.page.touchscreen.tap(e.x, e.y); await sleep(900); await settle(s.page); }
export const planOf = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("planner.plan.sandbox") || "null"));
/** Sample the scroll and the page's height every 50 ms for ms: did anything move by itself? */
export const watch = (page, ms = 4000) => page.evaluate((ms) => new Promise((res) => { const out = []; const t0 = performance.now(); const id = setInterval(() => { out.push([Math.round(performance.now() - t0), Math.round(scrollY), document.documentElement.scrollHeight]); if (performance.now() - t0 > ms) { clearInterval(id); res(out); } }, 50); }), ms);
export const moves = (samples) => { let m = 0; for (let i = 1; i < samples.length; i++) m = Math.max(m, Math.abs(samples[i][1] - samples[0][1])); return m; };
/** Grey under the page: how far the screen's bottom is below the last drawn thing of #content (positive = grey). */
export const blank = (page) => page.evaluate(() => { const c = document.getElementById("content"); const kids = [...c.querySelectorAll(":scope > *")].filter((e) => e.getClientRects().length); const last = kids.length ? Math.max(...kids.map((k) => k.getBoundingClientRect().bottom)) : 0; return Math.round(innerHeight - last); });
/** Grey under the page: blank space on screen below the last drawn thing that the page itself does not have below its last
 *  thing at its own end (a page shown at its real end has its own bottom margin; room borrowed by the shell is all grey). */
export const grey = (page) => page.evaluate(() => { const c = document.getElementById("content"); const kids = [...c.querySelectorAll(":scope > *")].filter((e) => e.getClientRects().length); const last = kids.length ? Math.max(...kids.map((k) => k.getBoundingClientRect().bottom)) : 0; const onScreen = Math.round(innerHeight - last); const own = c.style.minHeight ? 0 : Math.round(document.documentElement.scrollHeight - (last + scrollY)); return Math.max(0, onScreen - Math.max(0, own)); });
export const hist = (p) => p.evaluate(() => history.length);
export const tapRow = async (s, text) => { const e = await thumb(s, "li, [role=button], .rec, tr, a, button", { text }); await sleep(800); await settle(s.page); return e; };
export const tapBtn = async (s, text, sel = "button, a") => { const e = await thumb(s, sel, { text }); await sleep(800); await settle(s.page); return e; };
export const openFold = async (s, text) => { if (await seen(s.page, "details:not([open]) > summary", { text })) { await thumb(s, "details:not([open]) > summary", { text }); await sleep(500); } };
/** Top of the n-th drawn element matching sel (and text) on the screen, or null. */
export const topOf = (p, sel, text = null, nth = 0) => p.evaluate(([sel, text, nth]) => { const e = [...document.querySelectorAll("#content " + sel)].filter((e) => e.getClientRects().length && !e.closest("details:not([open])") && !e.closest(".only-wide") && (text === null || e.textContent.replace(/\s+/g, " ").trim().includes(text)))[nth]; return e ? Math.round(e.getBoundingClientRect().top) : null; }, [sel, text, nth]);
/** Can a confirmation be read now: the page's own green/red line (60% of it, or 48 px, between the top bar and the bottom), or the bottom note. */
export const confirm = (p) => p.evaluate(() => {
  const tb = document.getElementById("topbar")?.getBoundingClientRect().bottom ?? 0;
  const own = [...document.querySelectorAll("#content .notice.ok, #content .notice.error")].filter((n) => n.getClientRects().length && !n.closest("details:not([open])")).map((n) => { const r = n.getBoundingClientRect(); const inn = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, tb)); return { t: n.textContent.replace(/\s+/g, " ").trim().slice(0, 70), read: inn >= Math.min(48, 0.6 * r.height) }; });
  const e = document.querySelector(".save-echo"); const er = e?.getBoundingClientRect();
  const note = e && er.height > 0 && er.bottom > 0 && er.top < innerHeight ? { t: e.textContent.replace(/\s+/g, " ").trim().slice(0, 90), at: er.top < innerHeight / 2 ? "top" : "bottom", ways: [...e.querySelectorAll("a, button")].map((w) => w.textContent.replace(/\s+/g, " ").trim().slice(0, 40)) } : null;
  return { own, ownReadable: own.some((n) => n.read), note, readable: own.some((n) => n.read) || !!note };
});
/** Run journeys and report: each returns { ok, ...measured }; the script exits 0 only when every journey held. */
export async function journeys(name, list) {
  const rows = [];
  for (const [label, hh, route, fn, opts = {}] of list) {
    let s = null;
    try {
      s = await start(opts.plan ?? H[hh](), route, opts);
      await sleep(800);
      const r = await fn(s, s.page);
      const errors = s.pageErrors.length;
      rows.push({ journey: label, ...r, pageErrors: errors, ok: !!r.ok && errors === 0 });
    } catch (e) { rows.push({ journey: label, ok: false, error: String(e.message).split("\n")[0].slice(0, 200), pageErrors: s?.pageErrors?.length ?? null }); }
    try { await s?.close(); } catch { }
  }
  for (const r of rows) console.log(JSON.stringify(r));
  const held = rows.filter((r) => r.ok).length;
  console.log(`${name}: ${held} of ${rows.length} journeys hold`);
  process.exit(held === rows.length ? 0 : 1);
}

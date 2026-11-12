import { households, open, state, go, settle, sleep } from "../ux/kit.mjs";
const ROOT = "$SP/wtouch";
const base = "http://127.0.0.1:9320";
const H = await households(ROOT);
const s = await open({ base, plan: H.family(), route: "cashflow/income" });
const page = s.page;
// 1. same store instance?
const r1 = await page.evaluate(async () => {
  const { store } = await import("/core/store.js");
  const p = store.get();
  return { people: p?.household?.people?.length, income: p?.income?.length, sandbox: store.sandbox(), same: JSON.stringify(p).length === (localStorage.getItem("planner.plan.sandbox") || "").length };
});
console.log("store", r1);
// 2. event timing + tap
await page.evaluate(() => { window.__ev = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__ev.push({ n: e.name, d: e.duration, id: e.interactionId, s: Math.round(e.startTime) }); }).observe({ type: "event", durationThreshold: 16, buffered: true }); });
const b = await page.locator("#content button", { hasText: "Add another income" }).first();
const box = await b.boundingBox(); console.log("button box", box);
await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
await sleep(400);
console.log("after tap: form?", await page.evaluate(() => !!document.querySelector("#content form")), await page.evaluate(() => window.__ev));
// 3. replace plan in page
const r3 = await page.evaluate(async () => { const { store } = await import("/core/store.js"); const p = JSON.parse(JSON.stringify(store.get())); p.income = []; store.replace(p); await new Promise((r) => setTimeout(r, 200)); return document.querySelector("#content h1")?.textContent; });
console.log("after replace", r3);
await s.close();

// where does a fresh start spend its time? (uses my running server on 9320)
import { createRequire } from "node:module";
import { inPage } from "../wtouch/qa/touch-page.mjs";
import { domLib, households, RULES, DAY } from "../wtouch/qa/touch-lib.mjs";
const { chromium } = createRequire("/opt/node22/lib/node_modules/")("playwright");
const base = "http://127.0.0.1:9320";
const hh = await households();
const plan = JSON.stringify(hh.find((h) => h.id === "family").plan());
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block" });
await ctx.addInitScript(inPage, { day: DAY, topBar: 56, height: 844, keyboard: 336, lib: domLib.toString(), planKey: "planner.plan.sandbox" });
const page = await ctx.newPage();
await page.goto(`${base}/__touch-blank`).catch(() => {});
await page.evaluate((p) => { localStorage.clear(); localStorage.setItem("planner.plan.sandbox", p); }, plan);
let t = Date.now();
await page.goto(`${base}/?sandbox=1#/cashflow/income`, { waitUntil: "load" });
await page.waitForSelector("#content [data-page]");
console.log("load ms", Date.now() - t);
const pj = await page.evaluate(() => window.__touch.attach());
for (let i = 0; i < 6; i++) {
  t = Date.now();
  const r = await page.evaluate(async ([plan, hash]) => { const t0 = performance.now(); const T = window.__touch; const a = await T.reset(plan, hash); const t1 = performance.now(); const c = T.census(); const t2 = performance.now(); return { reset: Math.round(t1 - t0), settle: a.ms, census: Math.round(t2 - t1), n: c.length, busy: T.busy() }; }, [pj, "#/cashflow/income"]);
  const rt = Date.now() - t;
  t = Date.now(); await page.evaluate(() => 1); const ping = Date.now() - t;
  t = Date.now(); const c = await page.evaluate(() => window.__touch.census()); const cen = Date.now() - t;
  console.log(JSON.stringify(r), "round trip", rt, "ping", ping, "census rt", cen, "bytes", JSON.stringify(c).length);
}
// a settle with nothing going on
for (let i = 0; i < 3; i++) console.log("idle settle", await page.evaluate(async () => { const t0 = performance.now(); const s = await window.__touch.settle(); return [s, Math.round(performance.now() - t0)]; }));
await browser.close();

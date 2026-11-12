// which class sets are filled in the browser? (calibrates the Node half's "looks filled")
import { createRequire } from "node:module";
import { inPage } from "../wtouch/qa/touch-page.mjs";
import { domLib, households, manifests, pageList, DAY } from "../wtouch/qa/touch-lib.mjs";
const { chromium } = createRequire("/opt/node22/lib/node_modules/")("playwright");
const base = "http://127.0.0.1:9320";
const hh = await households(); const pages = pageList(await manifests());
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block" });
await ctx.addInitScript(inPage, { day: DAY, topBar: 56, height: 844, keyboard: 336, lib: domLib.toString(), planKey: "planner.plan.sandbox" });
const page = await ctx.newPage();
const seen = new Map();
for (const h of [hh[1], hh[0]]) {
  await page.goto(`${base}/__touch-blank`).catch(() => {});
  await page.evaluate((p) => { localStorage.clear(); if (p) localStorage.setItem("planner.plan.sandbox", p); }, h.plan() ? JSON.stringify(h.plan()) : null);
  await page.goto(`${base}/?sandbox=1#/overview/dashboard`, { waitUntil: "load" });
  await page.waitForSelector("#content [data-page]");
  for (const pg of pages) {
    const list = await page.evaluate(async (hash) => { location.hash = hash; await new Promise((r) => setTimeout(r, 30)); await window.__touch.settle(); await window.__touch.openFolds(); return window.__touch.census().filter((c) => c.tag === "button" || /\bbtn\b/.test(c.cls) || (c.tag === "input" && c.type === "submit")).map((c) => ({ cls: c.cls, filled: c.filled, tag: c.tag, name: c.name.slice(0, 30) })); }, `#/${pg.key}`);
    for (const b of list) { const k = `${b.tag}|${b.cls}`; const e = seen.get(k) ?? { filled: 0, not: 0, ex: `${pg.key}: ${b.name}` }; if (b.filled) e.filled++; else e.not++; seen.set(k, e); }
  }
}
for (const [k, e] of [...seen.entries()].sort((a, b) => b[1].filled - a[1].filled)) console.log(k.padEnd(46), "filled", String(e.filled).padStart(4), "not", String(e.not).padStart(4), " e.g.", e.ex);
await browser.close();

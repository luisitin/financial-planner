// Back after a link tapped far down the page: where does the scroll end up, and when?
import { createRequire } from "node:module";
import { inPage } from "../wtouch/qa/touch-page.mjs";
import { domLib, households, DAY } from "../wtouch/qa/touch-lib.mjs";
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
await page.goto(`${base}/?sandbox=1#/property/home`, { waitUntil: "load" });
await page.waitForSelector("#content [data-page]");
const pj = await page.evaluate(() => window.__touch.attach());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 12; i++) {
  await page.evaluate(([p, h]) => window.__touch.reset(p, h), [pj, "#/property/home"]);
  const links = await page.evaluate(() => window.__touch.census().filter((c) => c.kind === "link" && c.href.startsWith("#/")).map((c) => [c.key, Math.round(c.y)]));
  const key = links[links.length - 1][0];
  const loc = await page.evaluate((k) => { const T = window.__touch; const l = T.locate(k); T.mark(k); return l; }, key);
  await page.touchscreen.tap(loc.x, loc.y);
  const out = await page.evaluate(() => window.__touch.finish());
  await page.evaluate(() => { window.__log = []; const t0 = performance.now(); const log = (w) => window.__log.push(`${w}@${Math.round(performance.now() - t0)} y=${Math.round(scrollY)}`); addEventListener("popstate", () => log("pop"), { once: true }); addEventListener("hashchange", () => { log("hash"); setTimeout(() => log("hash+0"), 0); }, { once: true }); addEventListener("scroll", () => log("scroll")); history.back(); });
  await sleep(600);
  const r = await page.evaluate(() => ({ log: window.__log.join(" "), y: Math.round(scrollY), hash: location.hash }));
  console.log(i, key.slice(0, 40), "tap at y", out.before.scrollY, "->", JSON.stringify(r));
}
await browser.close();

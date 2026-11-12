// property/home, family: fill the form, tap Save, read the notices and the echo, many times
import { createRequire } from "node:module";
import { inPage } from "../wtouch/qa/touch-page.mjs";
import { domLib, households, DAY } from "../wtouch/qa/touch-lib.mjs";
const { chromium } = createRequire("/opt/node22/lib/node_modules/")("playwright");
const base = "http://127.0.0.1:9320";
const hh = await households();
const plan = JSON.stringify(hh.find((h) => h.id === "family").plan());
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "block", timezoneId: "America/New_York", locale: "en-US" });
await ctx.addInitScript(inPage, { day: DAY, topBar: 56, height: 844, keyboard: 336, lib: domLib.toString(), planKey: "planner.plan.sandbox" });
const page = await ctx.newPage();
await page.goto(`${base}/__touch-blank`).catch(() => {});
await page.evaluate((p) => { localStorage.clear(); localStorage.setItem("planner.plan.sandbox", p); }, plan);
await page.goto(`${base}/?sandbox=1#/property/home`, { waitUntil: "load" });
await page.waitForSelector("#content [data-page]");
const pj = await page.evaluate(() => window.__touch.attach());
for (let i = 0; i < 10; i++) {
  await page.evaluate(([p, h]) => window.__touch.reset(p, h), [pj, "#/property/home"]);
  const key = await page.evaluate(() => window.__touch.census().find((x) => x.submit && x.name === "Save")?.key);
  if (i === 0) console.log("key", key);
  await page.evaluate((k) => { const T = window.__touch; const c = T.census().find((x) => x.key === k); const form = c.el.closest("form"); for (const el of form.querySelectorAll("input[type=text]")) { el.value = "1234"; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); } }, key);
  const loc = await page.evaluate((k) => { const T = window.__touch; const l = T.locate(k); T.mark(k); window.__echoLog = []; const mo = new MutationObserver((l) => { for (const r of l) for (const n of r.addedNodes) if (n.classList?.contains("save-echo")) window.__echoLog.push("echo added at " + Math.round(performance.now() - T.m.t)); }); mo.observe(document.body, { childList: true }); return l; }, key);
  await page.touchscreen.tap(loc.x, loc.y);
  const out = await page.evaluate(() => { const T = window.__touch; const t = T.m.t; return T.settle().then((s) => { const at = Math.round(performance.now() - t); const d = T.done(s); return { at, ms: d.ms, scrollBefore: d.before.scrollY, scrollAfter: d.after.scrollY, docH: [d.before.docH, d.after.docH], notices: d.notices.map((n) => [n.kind, n.inView, n.text.slice(0, 20)]), echoLog: window.__echoLog, echoNow: !!document.querySelector(".save-echo"), noticeTop: Math.round(document.querySelector("#content .notice.ok")?.getBoundingClientRect().top ?? -1) }; }); });
  console.log(JSON.stringify(out));
}
await browser.close();

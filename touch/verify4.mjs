import { households, open, sleep, shot } from "../ux/kit.mjs";
const ROOT = "$SP/wtouch";
const H = await households(ROOT);
const s = await open({ base: "http://127.0.0.1:9320", plan: H.family(), route: "overview/dashboard" });
const page = s.page;
await page.locator("#nav-toggle").tap(); await sleep(400);
const box = page.locator("#sidebar .nav-search");
await box.tap(); await sleep(200);
for (const ch of "retire") { await page.keyboard.type(ch); await sleep(120); }
console.log("typed r,e,t,i,r,e one key at a time -> the box holds:", JSON.stringify(await page.evaluate(() => document.querySelector("#sidebar .nav-search").value)), "caret", await page.evaluate(() => document.querySelector("#sidebar .nav-search").selectionStart));
await shot(page, "$SP/touch/v4-search.png");
await s.close();

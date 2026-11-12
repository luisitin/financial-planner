import { households, open, state, go, settle, shot, sleep } from "../ux/kit.mjs";
const ROOT = "$SP/wtouch";
const DIR = "$SP/touch/";
const H = await households(ROOT);
const s = await open({ base: "http://127.0.0.1:9320", plan: H.family(), route: "property/home" });
const page = s.page;
// 1. property/home: the fold "The home's details"
const sum = page.locator("#content summary", { hasText: "The home's details" }).first();
await sum.scrollIntoViewIfNeeded(); await page.evaluate(() => scrollBy(0, 200)); await sleep(200);
let b0 = await sum.boundingBox(); let y0 = await page.evaluate(() => scrollY);
await sum.tap(); await sleep(700);
let b1 = await sum.boundingBox(); let y1 = await page.evaluate(() => scrollY);
console.log("1. fold: top before", Math.round(b0.y), "after", Math.round(b1.y), "scrollY", y0, "->", y1, "active", await page.evaluate(() => document.activeElement?.tagName + ":" + (document.activeElement?.name || document.activeElement?.textContent?.slice(0, 30))));
await shot(page, DIR + "v2-fold.png");
// 2. emergency fund -> "Cash and how fast": document.title
await go(page, "goals/emergency-fund");
const link = page.locator("#content a", { hasText: "Cash and how fast" }).first();
console.log("2. link href", await link.getAttribute("href"), "title before", await page.title());
await link.scrollIntoViewIfNeeded(); await link.tap(); await sleep(800);
console.log("   after: hash", await page.evaluate(() => location.hash), "doc title", await page.title(), "| bar", await page.textContent("#page-title"));
await sleep(1500); console.log("   later doc title", await page.title());
// 3. projection: Retirement settings fold -> Save settings
await go(page, "retirement/projection");
const rs = page.locator("#content summary", { hasText: "Retirement settings" }).first();
await rs.scrollIntoViewIfNeeded(); await rs.tap(); await sleep(500);
const save = page.locator("#content button", { hasText: "Save settings" }).first();
await save.scrollIntoViewIfNeeded(); await sleep(200);
const box = page.locator("#content details[open] input[type=text], #content details[open] input[type=number]").first();
await box.fill("4321"); 
let st0 = await state(page);
await save.tap(); await sleep(900);
let st1 = await state(page);
console.log("3. save settings: scrollY", st0.scrollY, "->", st1.scrollY, "docH", st0.docH, "->", st1.docH, "notices", JSON.stringify(st1.notices.map((n) => [n.kind, n.inView, n.text.slice(0, 60)])), "echo?", await page.evaluate(() => document.querySelector(".save-echo")?.textContent ?? null));
await shot(page, DIR + "v2-proj.png");
// 4. expenses: the checking box
await go(page, "cashflow/expenses");
console.log("4.", await page.evaluate(() => [...document.querySelectorAll("#content input")].filter((i) => /checking go up/i.test(i.closest("label")?.textContent ?? i.getAttribute("aria-label") ?? "")).map((i) => ({ type: i.type, inputmode: i.inputMode, ph: i.placeholder, label: (i.closest("label")?.textContent ?? i.getAttribute("aria-label")).slice(0, 80), cls: i.parentElement.className }))));
await s.close();

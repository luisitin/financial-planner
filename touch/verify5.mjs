// by hand (the walkers' kit, real taps and keys): five kinds of break the sweep reported for the family
import { households, open, state, go, sleep, shot } from "../ux/kit.mjs";
const ROOT = "$SP/wtouch";
const DIR = "$SP/touch/";
const H = await households(ROOT);
const s = await open({ base: "http://127.0.0.1:9320", plan: H.family(), route: "investments/crypto" });
const page = s.page;
const plan = () => page.evaluate(() => JSON.parse(localStorage.getItem("planner.plan.sandbox")));
// 1. D-TWICE: Add coin, two taps in a row
{
  const before = (await plan()).holdings?.length ?? 0;
  const f = page.locator("#content form").first();
  for (const el of await f.locator("input[type=text]").all()) await el.fill("1234");
  for (const el of await f.locator("input[type=number]").all()) await el.fill("3");
  for (const el of await f.locator("input[type=date]").all()) await el.fill("2021-06-15");
  const btn = f.locator("button[type=submit]"); await btn.scrollIntoViewIfNeeded(); const b = await btn.boundingBox();
  await Promise.all([page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2), page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2)]);
  await sleep(700);
  console.log("1. Add coin, two taps in a row: holdings", before, "->", (await plan()).holdings?.length);
}
// 2. D-FOCUS-KEPT: debt/mortgage
{
  await go(page, "debt/mortgage");
  const boxes = page.locator("#content input[type=number], #content input[type=text]");
  const a = boxes.nth(0), b = boxes.nth(1);
  console.log("2. boxes:", await a.getAttribute("aria-label") ?? await a.evaluate((e) => e.closest("label")?.textContent.slice(0, 30)), "|", await b.getAttribute("aria-label") ?? await b.evaluate((e) => e.closest("label")?.textContent.slice(0, 30)));
  await a.scrollIntoViewIfNeeded(); await a.tap(); await a.fill(""); await page.keyboard.type("250");
  await b.tap(); await sleep(500); await page.keyboard.type("777"); await sleep(300);
  console.log("   after typing 250, tapping the next box and typing 777: focus is on", await page.evaluate(() => document.activeElement?.tagName + ":" + (document.activeElement?.getAttribute?.("aria-label") ?? "")), "| box 2 holds", JSON.stringify(await page.locator("#content input[type=number], #content input[type=text]").nth(1).inputValue()));
}
// 3. D-WRONG: income, edit, Starts = 0026-03-15
{
  await go(page, "cashflow/income");
  await page.locator("#content li[role=button]").first().tap(); await sleep(500);
  await page.locator("#content input[name=startDate]").fill("0026-03-15");
  const save = page.locator("#content button", { hasText: "Save changes" }); await save.scrollIntoViewIfNeeded(); await save.tap(); await sleep(700);
  const st = await state(page);
  console.log("3. Starts 0026-03-15 saved:", (await plan()).income[0].startDate, "| notices:", JSON.stringify(st.notices.map((n) => [n.kind, n.text.slice(0, 70)])));
}
// 4. D-ENTER: debt/payoff Extra each month
{
  await go(page, "debt/payoff");
  const box = page.locator("#content input").first(); await box.scrollIntoViewIfNeeded(); await box.tap(); await box.fill(""); await page.keyboard.type("125");
  const before = JSON.stringify((await plan()).debtPlan ?? null), t0 = await state(page);
  await page.keyboard.press("Enter"); await sleep(600);
  const t1 = await state(page);
  console.log("4. Enter in", await box.getAttribute("aria-label") ?? "the first box", ": plan changed", before !== JSON.stringify((await plan()).debtPlan ?? null), "| text changed", t0.textLen !== t1.textLen || t0.firstWords !== t1.firstWords, "| focus", t1.focus?.name);
}
// 5. D-SCROLL-KEPT: household/documents "Write where it is"
{
  await go(page, "household/documents");
  const btn = page.locator("#content button", { hasText: "Write where it is" }).first(); await btn.scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollBy(0, 150)); await sleep(200);
  const y0 = (await btn.boundingBox()).y; await btn.tap(); await sleep(600);
  const again = page.locator("#content button", { hasText: "Write where it is" }).first();
  console.log("5. Write where it is: button top", Math.round(y0), "->", Math.round((await again.boundingBox())?.y ?? -1), "| focus", await page.evaluate(() => document.activeElement?.tagName));
  await shot(page, DIR + "v5-docs.png");
}
await s.close();

// B12. Nothing the kit draws moves anything between my finger going down and its click. A finger rests 350 ms on the
// next box after a wrong one (Income: raise 150, then Starts; Pay off debts: "50.." in Extra, then Order): during the
// press nothing is drawn and nothing moves; the words come only after the click, and the box I pressed stays put.
// usage: node B12.mjs <base> <root>
import { run, say, done, sleep, settle, swipeTap, swipeInto, typeIn, byText, topOf } from "./_lib.mjs";

async function press(s, loc, hold = 350) {
  await s.page.evaluate(() => {
    const t = (window.__t = { marks: [], words: null });
    for (const k of ["pointerdown", "pointerup", "click"]) document.addEventListener(k, () => t.marks.push([k, performance.now()]), { capture: true, once: true });
    const mo = new MutationObserver(() => { if (t.words === null && document.querySelector("#content .field-error")) { t.words = performance.now(); mo.disconnect(); } });
    mo.observe(document.getElementById("content"), { childList: true, subtree: true });
  });
  const b = await loc.boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
  const top0 = await topOf(loc);
  await s.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await sleep(hold);
  const during = { words: await s.page.evaluate(() => document.querySelectorAll("#content .field-error").length), top: await topOf(loc) };
  await s.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await sleep(700);
  const t = await s.page.evaluate(() => window.__t);
  const at = Object.fromEntries(t.marks.map(([k, v]) => [k, v]));
  return { top0, during, after: { words: await s.page.evaluate(() => document.querySelectorAll("#content .field-error").length), top: await topOf(loc) }, wordsAfterClick: t.words !== null && at.click !== undefined && t.words >= at.click, gap: t.words !== null && at.click ? Math.round(t.words - at.click) : null, marks: t.marks.map(([k]) => k).join(",") };
}

await run("B12-income", "family", "cashflow/income", async (s) => {
  await swipeTap(s, byText(s, /^\+ Add another income$/)); await settle(s.page); await sleep(300);
  const f = s.page.locator("#content form").filter({ has: s.page.locator("[name=growth]") }).first();
  await typeIn(s, f.locator("[name=growth]"), "150");
  const next = f.locator("[name=startDate]"); await swipeInto(s, next);
  const r = await press(s, next);
  say("B12-income", r.during.words === 0 && r.during.top === r.top0 && r.after.words === 1 && r.wordsAfterClick && Math.abs(r.after.top - r.top0) <= 1,
    `finger on Starts for 350 ms: words during the press ${r.during.words}, Starts ${r.top0} -> ${r.during.top} (pressed) -> ${r.after.top} (after); words after the click ${r.wordsAfterClick} (+${r.gap} ms; events ${r.marks})`);
});
await run("B12-payoff", "renterDebt", "debt/payoff", async (s) => {
  await typeIn(s, s.page.locator("#content").getByLabel("Extra each month").first(), "50..");
  const order = s.page.locator("#content").getByLabel("Order").first(); await swipeInto(s, order);
  const r = await press(s, order);
  await s.page.keyboard.press("Escape").catch(() => { });
  say("B12-payoff", r.during.words === 0 && r.during.top === r.top0 && r.after.words === 1 && r.wordsAfterClick && Math.abs(r.after.top - r.top0) <= 1,
    `finger on Order for 350 ms: words during the press ${r.during.words}, Order ${r.top0} -> ${r.during.top} -> ${r.after.top}; words after the click ${r.wordsAfterClick} (+${r.gap} ms; events ${r.marks})`);
});
done("B12 nothing moves under a finger");

// B17 -- The "changed in two places" bar stays where I can see it: a Back while the bar is up, or a fresh conflict that
// arrives while the place is being put back (after a Back, after a reload), never scrolls the bar away.
import { H, Y, sleep, settle, swipe, reload, journeys } from "./_lib.mjs";
const addBar = (p) => p.evaluate(() => { const bar = document.createElement("div"); bar.id = "sync-bar"; bar.style.height = "120px"; bar.textContent = "Your plan was changed in two places"; document.getElementById("content").before(bar); });
const barAt = (p) => p.evaluate(() => ({ y: Math.round(scrollY), barTop: Math.round(document.getElementById("sync-bar")?.getBoundingClientRect().top ?? -9999) }));
// the shell's own reaction to a fresh conflict (showConflict): stop holding the place, then bring the bar into view
const freshConflict = (p) => p.evaluate(async () => { const bar = document.createElement("div"); bar.id = "sync-bar"; bar.style.height = "120px"; bar.textContent = "Your plan was changed in two places"; document.getElementById("content").before(bar); const place = await import("/core/place.js"); place.cancelHold?.(); window.scrollTo(0, 0); });
await journeys("B17 the conflict bar stays in view", [
  ["the bar is up when Back arrives", "family", "overview/dashboard", async (s, p) => {
    await p.evaluate(() => { location.hash = "#/overview/pages"; }); await sleep(1200); await settle(p); await swipe(s, 2400); const left = await Y(p);
    await p.evaluate(() => { location.hash = "#/cashflow/expenses"; }); await sleep(1200); await settle(p);
    await addBar(p);
    await p.goBack(); await p.waitForSelector("#content [data-page]"); await sleep(2800);
    const r = await barAt(p);
    return { left, ...r, ok: r.barTop > -60 && r.barTop < 300 };
  }],
  ["a fresh conflict 300 ms after a Back", "family", "overview/dashboard", async (s, p) => {
    await p.evaluate(() => { location.hash = "#/overview/pages"; }); await sleep(1200); await settle(p); await swipe(s, 2400);
    await p.evaluate(() => { location.hash = "#/cashflow/expenses"; }); await sleep(1200); await settle(p);
    await p.goBack(); await p.waitForSelector("#content [data-page]"); await sleep(300);
    await freshConflict(p); await sleep(2600);
    const r = await barAt(p);
    return { ...r, ok: r.barTop > -60 && r.barTop < 300 };
  }],
  ["a fresh conflict 300 ms after a reload", "family", "overview/dashboard", async (s, p) => {
    await p.evaluate(() => { location.hash = "#/overview/pages"; }); await sleep(1200); await settle(p); await swipe(s, 2400);
    await p.reload({ waitUntil: "load" }); await p.waitForSelector("#content [data-page]"); await sleep(300);
    await freshConflict(p); await sleep(2600);
    const r = await barAt(p);
    return { ...r, ok: r.barTop > -60 && r.barTop < 300 };
  }],
]);

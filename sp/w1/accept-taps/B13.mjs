// B13. Reduce motion is honoured: the menu appears and closes at once (no frame with it part-way), the topics' chevrons turn
// at once. (A page that brings a form into view jumping instead of gliding is the place track's scroll wrapper, seams C7:
// measured here and printed, not counted.)
// usage: node B13.mjs <base> <root>
import { run, say, done, sleep, tapBar } from "./_lib.mjs";
const frames = (p) => p.evaluate(() => { window.__xs = []; const s = document.getElementById("sidebar"); const loop = () => { window.__xs.push(Math.round(s.getBoundingClientRect().left)); if (window.__xs.length < 40) requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
await run("menu opens and closes at once", "family", "overview/dashboard", async (p) => {
  await frames(p); await tapBar(p, "#nav-toggle", 900); const open = await p.evaluate(() => window.__xs);
  await frames(p); await tapBar(p, "#nav-toggle", 900); const close = await p.evaluate(() => window.__xs);
  const part = (xs) => xs.filter((x) => x > -270 && x < 0).length;
  say("menu opens and closes at once", part(open) === 0 && part(close) === 0 && open.at(-1) === 0, `reduce motion: ${part(open)} frames part-way while opening, ${part(close)} while closing (left edge ${open[0]} -> ${open.at(-1)})`);
}, { reducedMotion: true });
await run("chevrons turn at once", "family", "overview/dashboard", async (p) => {
  await tapBar(p, "#nav-toggle", 600);
  const t = await p.evaluate(() => { const c = document.querySelector("#sidebar .nav-group-head .chev"); const s = getComputedStyle(c); return { dur: s.transitionDuration, prop: s.transitionProperty }; });
  const side = await p.evaluate(() => getComputedStyle(document.getElementById("sidebar")).transitionDuration);
  say("chevrons turn at once", /^0s(, 0s)*$/.test(t.dur) && /^0s(, 0s)*$/.test(side), `reduce motion: chevron transition ${t.dur}, menu transition ${side}`);
}, { reducedMotion: true });
await run("(info) a page's own glide", "family", "goals/goals", async (p) => {
  const row = p.locator("#content li button, #content li[role=button], #content .records li, #content li a").first();
  await row.scrollIntoViewIfNeeded().catch(() => {});
  await p.evaluate(() => { window.__ys = []; const loop = () => { window.__ys.push(Math.round(scrollY)); if (window.__ys.length < 60) requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
  await row.tap().catch(() => {}); await sleep(1200);
  const ys = await p.evaluate(() => window.__ys);
  console.log(`info (place track's, not counted): a goal row tapped with reduce motion: ${new Set(ys).size} scroll positions (${ys[0]} -> ${ys.at(-1)})`);
}, { reducedMotion: true });
done("B13 reduce motion is honoured (the menu and its chevrons)");

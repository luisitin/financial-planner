// B11. (pages that adopt it, A5) After Compare the answer is on my screen: the answer card comes just under the top bar
// with "Saved." inside it, the figures stay open below it for the next try, and when the answer is already on screen
// nothing moves. Rent or buy, renterDebt, Compare at 350,000 then 420,000. Until property/rent-vs-buy adopts ui.reveal
// (A5, after the kit is on main), this serves accept-forms/pages/rent-vs-buy.view.js in its place.
// usage: node B11.mjs <base> <root>
import { run, say, done, sleep, settle, swipeTap, typeIn, drag, topOf, planOf } from "./_lib.mjs";

await run("B11-rent-vs-buy", "renterDebt", "property/rent-vs-buy", async (s) => {
  console.log(`     page: ${s.swapped.join("; ")}`);
  const f = s.page.locator("#content form").filter({ has: s.page.locator("[name=price]") }).first();
  const fold = s.page.locator("#content details.fold").filter({ has: s.page.locator("[name=price]") }).first();
  for (const price of ["350000", "420000"]) {
    if (!(await fold.evaluate((d) => d.open))) { await swipeTap(s, fold.locator("summary")); await sleep(400); }
    await typeIn(s, f.locator("[name=price]"), price);
    await swipeTap(s, f.locator("[type=submit]"), 1500); await settle(s.page);
    const card = s.page.locator("#content section.card").filter({ hasText: /^After \d+ years/ }).first();
    const top = await topOf(card), bar = await s.page.evaluate(() => Math.round(document.getElementById("topbar").getBoundingClientRect().bottom));
    const savedIn = (await card.textContent()).includes("Saved."), open = await fold.evaluate((d) => d.open);
    say(`B11-${price}`, top >= bar && top <= bar + 24 && savedIn && open, `Compare at ${price}: the answer card's top at ${top} px (top bar ends at ${bar}), "Saved." inside ${savedIn}, figures open ${open}`);
    await drag(s, 500);
  }
  const p = (await planOf(s)).whatIfs?.rentVsBuy?.price;
  say("B11-saved", p === 420000, `the price saved: ${p}`);
  // the answer already on screen: a second Compare with nothing changed does not move the page
  const card = s.page.locator("#content section.card").filter({ hasText: /^After \d+ years/ }).first();
  await s.page.evaluate(() => { const c = [...document.querySelectorAll("#content section.card")].find((x) => /^After \d+ years/.test(x.textContent)); scrollTo(0, c.getBoundingClientRect().top + scrollY - 80); }); await sleep(400);
  if (!(await fold.evaluate((d) => d.open))) { await swipeTap(s, fold.locator("summary")); await sleep(400); }
  const y0 = await s.page.evaluate(() => scrollY), c0 = await topOf(card);
  const sub = f.locator("[type=submit]"); const b = await sub.boundingBox();
  if (b && b.y > 70 && b.y + b.height < (await s.page.evaluate(() => innerHeight))) {
    await s.page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await sleep(1500); await settle(s.page);
    const y1 = await s.page.evaluate(() => scrollY), c1 = await topOf(card);
    say("B11-still", Math.abs(y1 - y0) <= 1, `Compare with the answer card on screen (card ${c0} -> ${c1} px): page scroll ${y0} -> ${y1}`);
  } else console.log(`     (skipped "nothing moves": the card and Compare are not both on one screen here)`);
}, { swap: { "property/rent-vs-buy": { file: "rent-vs-buy.view.js", marker: "ui.reveal" } } });
done("B11 the answer on screen");

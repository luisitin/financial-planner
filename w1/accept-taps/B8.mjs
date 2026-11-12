// B8. A new page starts the menu afresh. After I found Social Security by typing "social" (on Income), the next time I
// open the menu (two pages later) the box is empty and Recent, the Dashboard and the topics are there.
// usage: node B8.mjs <base> <root>
import { run, say, done, sleep, settle, mid, tapEl } from "./_lib.mjs";
await run("menu afresh", "family", "cashflow/income", async (p) => {
  const menu = async () => { const b = await p.locator("#nav-toggle").boundingBox(); await p.touchscreen.tap(b.x + 22, b.y + 22); await sleep(500); };
  await menu();
  const sb = await p.locator("#sidebar .nav-search").boundingBox(); await p.touchscreen.tap(sb.x + 60, sb.y + sb.height / 2); await sleep(150);
  await p.keyboard.type("social", { delay: 90 }); await sleep(300);
  const row = p.locator("#sidebar a.nav-link:visible").filter({ hasText: "Social Security" }).first();
  const [x, y] = await mid(row); await p.touchscreen.tap(x, y); await sleep(1000); await settle(p);
  const on = await p.evaluate(() => location.hash);
  // two pages later: a link on the page, then the menu
  await p.evaluate(() => { location.hash = "#/balance/net-worth"; }); await sleep(1000); await settle(p);
  await menu();
  const r = await p.evaluate(() => ({ box: document.querySelector("#sidebar .nav-search")?.value, first: [...document.querySelectorAll("#sidebar .nav-section, #sidebar a.nav-link")].slice(0, 4).map((e) => e.textContent.replace(/\s+/g, " ").trim()), topics: document.querySelectorAll("#sidebar .nav-group").length }));
  const ok = on === "#/retirement/social-security" && r.box === "" && /Recent|Start with|Ready now/.test(r.first[0]) && /Dashboard/.test(r.first[1]) && r.topics >= 10;
  say("menu afresh", ok, `searched "social" and opened ${on}; on Net worth the menu opens with box ${JSON.stringify(r.box)}, first rows ${JSON.stringify(r.first)}, ${r.topics} topics`);
});
done("B8 a new page starts the menu afresh");

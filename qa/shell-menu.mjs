// qa/shell-menu.mjs -- the menu on a phone (core/app.js paintDrawer, openDrawer, closeDrawer). Real touches, in the sandbox:
//   the phone's Back closes the open menu and stays on the page (also on the first page of a visit); after a page picked
//   in the menu, Back returns to the page the menu was opened on; Escape closes it and puts the focus on the menu button;
//   swipes behind the open menu do not move the page; Tab from the top meets "Skip to the page" first and never the
//   closed menu; the menu button and the topics say whether they are open.
//   node qa/shell-menu.mjs [base URL]
import { run, say, done, sleep, settle, tap, tapBar, swipe, still, family, shell, back } from "./shell-lib.mjs";
const menu = (p) => tapBar(p, "#nav-toggle", 500);
await run("Back closes the menu", family(), "cashflow/income", async (p) => {
  await menu(p); const o = await shell(p); const a = await back(p);
  say("Back closes the menu", o.open && !a.open && a.hash === "#/cashflow/income", `first page, menu ${o.open ? "open" : "NOT OPEN"}; Back -> ${a.hash}, menu ${a.open ? "OPEN" : "closed"}`);
});
await run("a row, then Back", family(), "overview/dashboard", async (p) => {
  await tap(p, p.locator("#content a.stat-link").first()); const from = (await shell(p)).hash;
  await menu(p);
  const b = await p.locator("#sidebar .nav-search").boundingBox(); await p.touchscreen.tap(b.x + 60, b.y + b.height / 2); await sleep(150);
  await p.keyboard.type("income", { delay: 70 }); await sleep(300); await p.evaluate(() => document.activeElement.blur()); await sleep(200);
  await tap(p, p.locator("#sidebar a.nav-link:visible").filter({ hasText: /^Income$/ }).first());
  const on = await shell(p); const a = await back(p);
  say("a row, then Back", on.hash === "#/cashflow/income" && a.hash === from && !a.open, `menu row -> ${on.hash}; Back -> ${a.hash} (the page the menu was opened on: ${from}), menu ${a.open ? "OPEN" : "closed"}`);
});
await run("Escape", family(), "cashflow/income", async (p) => {
  await menu(p); await p.keyboard.press("Escape"); await sleep(400); const a = await shell(p);
  say("Escape", !a.open && a.focus === "nav-toggle", `Escape -> menu ${a.open ? "OPEN" : "closed"}, focus on ${a.focus}`);
});
await run("swipes behind the menu", family(), "balance/net-worth", async (p) => {
  await swipe(p, 200, 650, 350); const y0 = await still(p); await menu(p);
  const ys = [];
  await swipe(p, 350, 700, 250); ys.push(await still(p));
  await swipe(p, 350, 250, 700); ys.push(await still(p));
  for (let i = 0; i < 3; i++) await swipe(p, 130, 750, 200); ys.push(await still(p));
  await menu(p); const y1 = await still(p);
  say("swipes behind the menu", y0 > 100 && ys.every((y) => y === y0) && y1 === y0, `page at ${y0}; with the menu open ${ys.join(", ")}; closed ${y1}`);
});
await run("Tab from the top", family(), "cashflow/income", async (p) => {
  await p.mouse.click(2, 2); await sleep(200);
  const stops = [];
  for (let i = 0; i < 10; i++) {
    await p.keyboard.press("Tab");
    const w = await p.evaluate(() => { const a = document.activeElement; return { zone: a.closest("#content") ? "page" : a.closest("#sidebar") ? "menu" : "bar", name: (a.textContent || a.getAttribute("aria-label") || "").trim().slice(0, 24) }; });
    stops.push(w); if (w.zone === "page") break;
  }
  say("Tab from the top", stops[0]?.name === "Skip to the page" && stops.some((w) => w.zone === "page") && !stops.some((w) => w.zone === "menu"), stops.map((w) => `${w.zone}:"${w.name}"`).join(" > "));
}, { touch: false });
await run("says whether it is open", family(), "cashflow/income", async (p) => {
  const e0 = await p.locator("#nav-toggle").getAttribute("aria-expanded");
  await p.locator("#nav-toggle").click(); await sleep(500);
  const r = await p.evaluate(() => ({ e: document.getElementById("nav-toggle").getAttribute("aria-expanded"), cur: document.querySelectorAll('#sidebar [aria-current="page"]').length, heads: [...document.querySelectorAll("#sidebar .nav-group-head")].every((h) => /^(true|false)$/.test(h.getAttribute("aria-expanded") ?? "")) }));
  say("says whether it is open", e0 === "false" && r.e === "true" && r.cur > 0 && r.heads, `menu button ${e0} -> ${r.e}; current page marked ${r.cur}; every topic says open or not: ${r.heads}`);
}, { touch: false });
done("shell-menu: the menu on a phone");

// B9. Back closes the menu. With the menu open, the phone's Back closes it and leaves me on the same page, also on the first
// page of a visit. Closing it with the cross or the dim side, then Back, goes to the page before (no dead Back). After I
// pick a page in the menu, Back from that page returns to the page I opened the menu on. Escape closes it and puts the
// focus back on the menu button. Five quick taps on the menu button leave no dead Back either.
// usage: node B9.mjs <base> <root>
import { run, say, done, sleep, tapEl, tapBar, shell, BACK } from "./_lib.mjs";
const menu = (p) => tapBar(p, "#nav-toggle", 500);
const toNetWorth = async (p) => { await tapEl(p, p.locator("#content a.stat-link").first()); return (await shell(p)).hash; };
await run("Back on the first page", "family", "cashflow/income", async (p) => {
  await menu(p); const o = await shell(p); const a = await BACK(p);
  say("Back on the first page", o.open && a.hash === "#/cashflow/income" && !a.open, `Income is the first page; menu ${o.open ? "open" : "NOT OPEN"}; the phone's Back -> ${a.hash}, menu ${a.open ? "OPEN" : "closed"}`);
});
await run("Back closes, then goes back", "family", "overview/dashboard", async (p) => {
  const from = await toNetWorth(p); await menu(p);
  const a = await BACK(p); const b = await BACK(p);
  say("Back closes, then goes back", a.hash === from && !a.open && b.hash === "#/overview/dashboard", `on ${from} with the menu open: Back -> ${a.hash} menu ${a.open ? "OPEN" : "closed"}; Back again -> ${b.hash}`);
});
await run("a row, then Back", "family", "overview/dashboard", async (p) => {
  const from = await toNetWorth(p); await menu(p);
  const sb = await p.locator("#sidebar .nav-search").boundingBox(); await p.touchscreen.tap(sb.x + 60, sb.y + sb.height / 2); await sleep(150);
  await p.keyboard.type("income", { delay: 80 }); await sleep(300); await p.evaluate(() => document.activeElement.blur()); await sleep(200);
  await tapEl(p, p.locator("#sidebar a.nav-link:visible").filter({ hasText: /^Income$/ }).first());
  const on = await shell(p); const a = await BACK(p); const b = await BACK(p);
  say("a row, then Back", on.hash === "#/cashflow/income" && a.hash === from && !a.open && b.hash === "#/overview/dashboard", `menu row Income -> ${on.hash}; Back -> ${a.hash} (menu ${a.open ? "OPEN" : "closed"}); Back -> ${b.hash}`);
});
await run("cross, then Back", "family", "overview/dashboard", async (p) => {
  const from = await toNetWorth(p); await menu(p); await menu(p);
  const a = await shell(p); const b = await BACK(p);
  say("cross, then Back", !a.open && a.hash === from && b.hash === "#/overview/dashboard", `opened and closed with the cross on ${from}: menu ${a.open ? "OPEN" : "closed"}; Back -> ${b.hash}`);
});
await run("dim side, then Back", "family", "overview/dashboard", async (p) => {
  const from = await toNetWorth(p); await menu(p); await p.touchscreen.tap(360, 500); await sleep(500);
  const a = await shell(p); const b = await BACK(p);
  say("dim side, then Back", !a.open && a.hash === from && b.hash === "#/overview/dashboard", `closed by tapping the dim side: menu ${a.open ? "OPEN" : "closed"}; Back -> ${b.hash}`);
});
await run("five quick taps on the menu button", "family", "overview/dashboard", async (p) => {
  const from = await toNetWorth(p);
  const bb = await p.locator("#nav-toggle").boundingBox(); for (let i = 0; i < 5; i++) { await p.touchscreen.tap(bb.x + 22, bb.y + 22); await sleep(160); }
  await sleep(700); const a = await shell(p); const b = await BACK(p); const c = await BACK(p);
  // five taps leave it open (odd count): Back closes it on the page, the next Back goes to the Dashboard
  say("five quick taps on the menu button", a.open && b.hash === from && !b.open && c.hash === "#/overview/dashboard", `5 taps 160 ms apart: menu ${a.open ? "open" : "closed"}; Back -> ${b.hash} menu ${b.open ? "OPEN" : "closed"}; Back -> ${c.hash}`);
});
await run("Escape", "family", "cashflow/income", async (p) => {
  await menu(p); await p.keyboard.press("Escape"); await sleep(400); const a = await shell(p); const b = await BACK(p).catch(() => null);
  say("Escape", !a.open && a.focus === "nav-toggle" && a.hash === "#/cashflow/income", `Escape -> menu ${a.open ? "OPEN" : "closed"}, focus on ${a.focus}, still on ${a.hash}`);
});
done("B9 Back closes the menu");

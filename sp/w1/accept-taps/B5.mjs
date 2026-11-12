// B5. The keyboard's Go opens the first page listed and closes the menu; the key says "Go". With nothing found, Go does
// nothing (the "No page matches" line is there).
// usage: node B5.mjs <base> <root>
import { run, say, done, sleep, settle, shell } from "./_lib.mjs";
const openMenuAndType = async (p, word) => {
  const tb = await p.locator("#nav-toggle").boundingBox(); await p.touchscreen.tap(tb.x + 22, tb.y + 22); await sleep(500);
  const sb = await p.locator("#sidebar .nav-search").boundingBox(); await p.touchscreen.tap(sb.x + 60, sb.y + sb.height / 2); await sleep(200);
  await p.keyboard.type(word, { delay: 80 }); await sleep(400);
};
for (const word of ["social", "net worth", "budget"]) await run(`Go after "${word}"`, "family", "cashflow/income", async (p) => {
  await openMenuAndType(p, word);
  const hint = await p.evaluate(() => document.querySelector("#sidebar .nav-search").getAttribute("enterkeyhint"));
  const first = await p.evaluate(() => { const a = document.querySelector("#sidebar a.nav-link"); return { href: a?.getAttribute("href"), name: a?.textContent.trim() }; });
  await p.keyboard.press("Enter"); await sleep(900); await settle(p);
  const a = await shell(p);
  say(`Go after "${word}"`, hint === "go" && a.hash === first.href && !a.open, `key says "${hint}"; first listed "${first.name}" (${first.href}); after Go: ${a.hash} "${a.title}", menu ${a.open ? "OPEN" : "closed"}`);
});
await run("Go with nothing found", "family", "cashflow/income", async (p) => {
  await openMenuAndType(p, "zzqx");
  const none = await p.evaluate(() => document.querySelector("#sidebar .nav-empty")?.textContent.replace(/\s+/g, " ").trim() ?? null);
  await p.keyboard.press("Enter"); await sleep(700);
  const a = await shell(p);
  say("Go with nothing found", !!none && /No page/.test(none) && a.hash === "#/cashflow/income" && a.open, `"${none}"; after Go: ${a.hash}, menu ${a.open ? "still open" : "CLOSED"}`);
});
done("B5 Go opens the first page listed");

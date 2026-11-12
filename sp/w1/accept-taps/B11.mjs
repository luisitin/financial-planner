// B11. Keys and screen readers meet only what is on screen. With the menu closed (phone width) Tab never walks the hidden
// menu; "Skip to the page" is the first stop. With it open, Tab stays in the menu and the top bar. The menu button says
// whether the menu is open; the current page's row is marked current; each topic says whether it is open.
// usage: node B11.mjs <base> <root>        (a keyboard on a phone-sized window: no touch)
import { run, say, done, sleep } from "./_lib.mjs";
const where = (p) => p.evaluate(() => { const a = document.activeElement; const r = a.getBoundingClientRect(); return { zone: a.closest("#content") ? "page" : a.closest("#sidebar") ? "menu" : a.closest("#topbar") ? "bar" : a.tagName, seen: r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight && getComputedStyle(a).visibility !== "hidden", name: (a.textContent || a.getAttribute("aria-label") || "").trim().slice(0, 30) }; });
await run("menu closed: Tab", "family", "cashflow/income", async (p) => {
  // a keyboard that starts at the top of the document (here: a click on the bar's empty corner, which is where Tab starts from)
  const at = await p.evaluate(() => document.elementFromPoint(2, 2)?.id);
  await p.mouse.click(2, 2); await sleep(200);
  const stops = [];
  for (let i = 0; i < 12; i++) { await p.keyboard.press("Tab"); const w = await where(p); stops.push(w); if (w.zone === "page") break; }
  const back = [];   // and back up from the page's first control with Shift+Tab: the bar, never the hidden menu
  for (let i = 0; i < 6; i++) { await p.keyboard.press("Shift+Tab"); const w = await where(p); back.push(w); if (w.name === "Skip to the page") break; }
  const hidden = [...stops, ...back].filter((w) => w.zone === "menu" || !w.seen);
  say("menu closed: Tab", at === "topbar" && stops[0]?.name === "Skip to the page" && stops.some((w) => w.zone === "page") && back.at(-1)?.name === "Skip to the page" && hidden.length === 0,
    `from the top (${at}): ${stops.map((w) => `${w.zone}:"${w.name}"${w.seen ? "" : "(not on screen)"}`).join(" > ")}; Shift+Tab back: ${back.map((w) => `${w.zone}:"${w.name}"${w.seen ? "" : "(not on screen)"}`).join(" > ")}`);
});
await run("skip to the page", "family", "cashflow/income", async (p) => {
  const first = await p.evaluate(() => { const c = [...document.querySelectorAll("#content a[href], #content button, #content input, #content select, #content textarea, #content summary, #content [tabindex='0']")].find((e) => !e.disabled && e.getClientRects().length); return (c?.textContent || c?.getAttribute("aria-label") || "").trim().slice(0, 30); });
  await p.mouse.click(2, 2); await sleep(200);
  await p.keyboard.press("Tab"); const s = await where(p); await p.keyboard.press("Enter"); await sleep(200); await p.keyboard.press("Tab");
  const w = await where(p);
  say("skip to the page", s.name === "Skip to the page" && w.zone === "page" && w.name === first, `from the top: Tab -> "${s.name}", Enter, Tab -> ${w.zone}: "${w.name}" (the page's first control: "${first}")`);
});
await run("menu open: Tab stays", "family", "cashflow/income", async (p) => {
  await p.locator("#nav-toggle").click(); await sleep(500);
  const zones = new Set(); let behind = 0;
  for (let i = 0; i < 45; i++) { await p.keyboard.press("Tab"); const w = await where(p); zones.add(w.zone); if (w.zone === "page") behind++; }
  say("menu open: Tab stays", behind === 0 && zones.has("menu"), `45 Tabs with the menu open: ${behind} on the page behind it (went to ${[...zones].join(", ")})`);
});
await run("names and states", "family", "cashflow/income", async (p) => {
  const closed = await p.evaluate(() => document.getElementById("nav-toggle").getAttribute("aria-expanded"));
  await p.locator("#nav-toggle").click(); await sleep(500);
  const r = await p.evaluate(() => ({ exp: document.getElementById("nav-toggle").getAttribute("aria-expanded"), label: document.getElementById("nav-toggle").getAttribute("aria-label"), cur: [...document.querySelectorAll('#sidebar [aria-current="page"]')].map((a) => a.textContent.trim()), heads: [...document.querySelectorAll("#sidebar .nav-group-head")].map((h) => h.getAttribute("aria-expanded")) }));
  const head = p.locator("#sidebar .nav-group-head").first(); const e0 = await head.getAttribute("aria-expanded"); await head.click(); await sleep(200); const e1 = await head.getAttribute("aria-expanded");
  say("names and states", closed === "false" && r.exp === "true" && r.cur.some((t) => /Income/.test(t)) && r.heads.every((x) => x === "true" || x === "false") && e0 !== e1, `menu button aria-expanded ${closed} -> ${r.exp} ("${r.label}"); current row ${JSON.stringify(r.cur)}; ${r.heads.length} topics carry aria-expanded; a topic tapped: ${e0} -> ${e1}`);
});
done("B11 keys and screen readers meet only what is on screen");

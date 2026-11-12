// opt/look.mjs -- one page for one household: the first screen (and the full page with --full) as a PNG.
//   node look.mjs family debt/credit-cards [--full] [--open]      -> opt/look/<household>-<group>-<id>[-full][-open].png
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve, households, open, settle, sleep, shot } from "$SP/ux/kit.mjs";
import { HOUSEHOLDS } from "./census.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.join(HERE, "app");
const a = process.argv.slice(2); const full = a.includes("--full"), openAll = a.includes("--open"); const [h, ...routes] = a.filter((x) => !x.startsWith("--"));
const port = Number(process.env.PORT || 9801);
const srv = await serve(ROOT, port);
try {
  const H = await households(ROOT, "2026-11-12"); const hk = HOUSEHOLDS.find((x) => x[1] === h || x[0] === h)[0];
  for (const route of routes) {
    const s = await open({ base: srv.base, plan: H[hk](), route });
    for (let i = 0; i < 40 && await s.page.evaluate(() => /(Working (out|it out)|Running (your|each)|Checking (your|what|that|the)|Loading)[^.\n]{0,80}(\.\.\.|…)/.test(document.getElementById("content")?.innerText ?? "")); i++) await sleep(250);
    if (openAll) { for (let r = 0; r < 5; r++) { const n = await s.page.evaluate(() => { let n = 0; for (const d of document.querySelectorAll("#content details:not([open])")) { d.open = true; n++; } return n; }); if (!n) break; await settle(s.page, 150); } }
    await s.page.evaluate(() => scrollTo(0, 0)); await sleep(80);
    const f = path.join(HERE, "look", `${h}-${route.replace("/", "-")}${full ? "-full" : ""}${openAll ? "-open" : ""}.png`);
    await shot(s.page, f, { full }); console.log(f);
    await s.close();
  }
} finally { await srv.stop(); }

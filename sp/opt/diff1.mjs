// opt/diff1.mjs -- one page opened first (fresh) and opened after another page: what differs on the screen?
import path from "node:path"; import { fileURLToPath } from "node:url";
import { serve, households, open, go, sleep } from "$SP/ux/kit.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.join(HERE, "app");
const route = process.argv[2] ?? "scenarios/compare";
const srv = await serve(ROOT, 9801);
try {
  const H = await households(ROOT, "2026-11-12");
  const text = (s) => s.page.evaluate(() => document.getElementById("content").innerText);
  const a = await open({ base: srv.base, plan: H.family(), route }); await sleep(600); const ta = await text(a); await a.close();
  const b = await open({ base: srv.base, plan: H.family(), route: "overview/dashboard" }); await go(b.page, route); await sleep(600); const tb = await text(b);
  await go(b.page, "overview/start"); await go(b.page, route); await sleep(600); const tc = await text(b); await b.close();
  const la = ta.split("\n").filter(Boolean), lb = tb.split("\n").filter(Boolean);
  console.log("fresh only:", la.filter((l) => !lb.includes(l))); console.log("after-navigation only:", lb.filter((l) => !la.includes(l))); console.log("second visit same as first visit by navigation:", tb === tc);
} finally { await srv.stop(); }

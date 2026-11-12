// opt/late.mjs -- does the census measure a page before it is finished? For every usable page: the page's height and text
// at the moment the census would measure (after settle and the waiting markers), and again 2.5 s later.
//   node late.mjs family,retired        (all pages)        node late.mjs family retirement/fire scenarios/compare
import path from "node:path"; import { fileURLToPath } from "node:url";
import { serve, households, open, go, sleep } from "$SP/ux/kit.mjs";
import { HOUSEHOLDS, install, waitWork } from "./census.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.join(HERE, "app");
const [hs, ...routes] = process.argv.slice(2);
const { default: registry } = await import(path.join(ROOT, "modules/registry.js"));
const all = []; for (const r of registry) { const m = (await r.load()).default; if (m.status === "usable" || m.status === "complete") all.push(`${r.group}/${r.id}`); }
const list = routes.length ? routes : all;
const srv = await serve(ROOT, 9801);
try {
  const H = await households(ROOT, "2026-11-12");
  await Promise.all(hs.split(",").map(async (h) => {
    const hk = HOUSEHOLDS.find((x) => x[1] === h)[0];
    const s = await open({ base: srv.base, plan: H[hk](), route: "overview/dashboard" });
    const snap = () => s.page.evaluate(() => ({ h: document.documentElement.scrollHeight, t: document.getElementById("content").innerText.length }));
    let late = 0;
    for (const r of list) { await go(s.page, r); await install(s.page); const w = await waitWork(s.page); const a = await snap(); await sleep(2500); const c = await snap(); if (a.h !== c.h || a.t !== c.t) { late++; console.log(`LATE ${h} ${r} waited ${w} ms: ${JSON.stringify(a)} -> ${JSON.stringify(c)}`); } }
    console.log(`${h}: ${list.length} pages, ${late} still changing after the census would have measured`);
    await s.close();
  }));
} finally { await srv.stop(); }

import { manifests, pageList, screenList } from "$SP/wtouch/qa/touch-lib.mjs";
import fs from "node:fs";
const mods = await manifests();
const pl = pageList(mods), sl = await screenList(mods);
const prev = JSON.parse(fs.readFileSync("$SP/touch/sweep-first.json","utf8"));
const t = {}; for (const x of prev.times) t[x.page] = (t[x.page]||0)+x.s;
const g = {};
for (const p of pl) { const k = (p.page??p.key); const grp = k.split("/")[0]; (g[grp] ??= {n:0,s:0,pages:[]}); g[grp].n++; g[grp].s += t[k]||60; g[grp].pages.push(k); }
console.log(sl.map(s=>[s.key,s.page]));
for (const [k,v] of Object.entries(g).sort((a,b)=>b[1].s-a[1].s)) console.log(k, v.n, Math.round(v.s));
console.log(pl.length, sl.length);

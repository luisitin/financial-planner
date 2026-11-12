import { loadApp, drawPage, census, judgePage } from "../wtouch/qa/touch-static.mjs";
import { households } from "../wtouch/qa/touch-lib.mjs";
const c0 = process.cpuUsage();
const a = await loadApp();
const c1 = process.cpuUsage(c0);
console.log("load app cpu ms", Math.round((c1.user + c1.system) / 1000));
const hh = await households();
const times = {}; let judge = 0;
for (const h of hh) { const memo = new Map(); for (const pg of a.pages) { const t = process.cpuUsage(); const d = await drawPage(a, pg.key, h.plan(), { memo }); const u = process.cpuUsage(t); times[pg.key] = (times[pg.key] ?? 0) + (u.user + u.system) / 1000; const t2 = process.cpuUsage(); if (!d.error) judgePage(a, pg.key, d); const u2 = process.cpuUsage(t2); judge += (u2.user + u2.system) / 1000; } }
console.log(Object.entries(times).sort((x, y) => y[1] - x[1]).slice(0, 22).map(([k, v]) => `${k} ${Math.round(v)}`).join("\n"));
console.log("draw cpu total", Math.round(Object.values(times).reduce((s, v) => s + v, 0)), "judge cpu", Math.round(judge));

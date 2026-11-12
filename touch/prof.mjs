import { loadApp, drawPage } from "../wtouch/qa/touch-static.mjs";
import { households } from "../wtouch/qa/touch-lib.mjs";
const a = await loadApp();
const hh = await households();
const times = {};
for (const h of hh) { const memo = new Map(); for (const pg of a.pages) { const t = performance.now(); await drawPage(a, pg.key, h.plan(), { memo }); times[pg.key] = (times[pg.key] ?? 0) + performance.now() - t; } }
console.log(Object.entries(times).sort((x, y) => y[1] - x[1]).slice(0, 25).map(([k, v]) => `${k} ${Math.round(v)}ms`).join("\n"));
console.log("total", Math.round(Object.values(times).reduce((s, v) => s + v, 0)));

import { loadApp, drawPage } from "../wtouch/qa/touch-static.mjs";
import { households } from "../wtouch/qa/touch-lib.mjs";
const a = await loadApp();
const hh = await households();
const gm = a.mods.get("overview/guide");
const realFrame = gm.frame; let fr = 0, n = 0;
gm.frame = (ctx, page) => { const t = process.cpuUsage(); try { return realFrame(ctx, page); } finally { const u = process.cpuUsage(t); fr += (u.user + u.system) / 1000; n++; } };
const t0 = process.cpuUsage();
for (const h of hh) { const memo = new Map(); const plan = a.migrate(structuredClone(h.plan() ?? a.emptyPlan())); for (const pg of a.pages) await drawPage(a, pg.key, plan, { memo, migrated: true }); }
const u = process.cpuUsage(t0);
console.log("total cpu", Math.round((u.user + u.system) / 1000), "frame cpu", Math.round(fr), "calls", n);

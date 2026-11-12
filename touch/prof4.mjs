import { loadApp, drawPage } from "../wtouch/qa/touch-static.mjs";
import { households } from "../wtouch/qa/touch-lib.mjs";
const a = await loadApp();
const hh = await households();
for (const h of hh) { const t0 = process.cpuUsage(); const memo = new Map(); const plan = a.migrate(structuredClone(h.plan() ?? a.emptyPlan())); let heavy = 0; for (const pg of a.pages) { const t = process.cpuUsage(); await drawPage(a, pg.key, plan, { memo, migrated: true }); const u = process.cpuUsage(t); if (a.mods.get(pg.key).heavy || pg.key.startsWith("reports/") || pg.key.startsWith("scenarios/")) heavy += (u.user + u.system) / 1000; } const u = process.cpuUsage(t0); console.log(h.id.padEnd(12), "cpu", Math.round((u.user + u.system) / 1000), "of which heavy/reports/scenarios", Math.round(heavy)); }

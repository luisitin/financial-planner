import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/")("playwright");
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto("http://127.0.0.1:9320/?sandbox=1#/overview/dashboard");
const cdp = await ctx.newCDPSession(page);
await cdp.send("Performance.enable", { timeDomain: "threadTicks" });
const get = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
for (const ms of [0, 150, 400]) {
  const a = await get(); const t0 = Date.now();
  await page.evaluate((ms) => { const t = performance.now(); while (performance.now() - t < ms); }, ms);
  const b = await get();
  console.log("busy", ms, "wall", Date.now() - t0, "TaskDuration", Math.round((b.TaskDuration - a.TaskDuration) * 1000), "ScriptDuration", Math.round((b.ScriptDuration - a.ScriptDuration) * 1000), "Thread", b.ThreadTime !== undefined ? Math.round((b.ThreadTime - a.ThreadTime) * 1000) : "n/a");
}
// idle wait 500 ms: CPU should be near 0
{ const a = await get(); await new Promise((r) => setTimeout(r, 500)); const b = await get(); console.log("idle 500", "TaskDuration", Math.round((b.TaskDuration - a.TaskDuration) * 1000)); }
console.log(Object.keys(await get()).join(" "));
await browser.close();

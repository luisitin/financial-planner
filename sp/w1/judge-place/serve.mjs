// serve.mjs -- the judge's three servers: A (place) on 9401, B (place2) on 9402, today (ee09f6e untouched) on 9403.
// Runs until the file ./stop exists, then stops only the servers it started.
import fs from "node:fs";
import { serve, sleep } from "$SP/ux/kit.mjs";
const J = "$SP/w1/judge-place";
try { fs.unlinkSync(`${J}/stop`); } catch { }
const s = [await serve(`${J}/A`, 9401), await serve(`${J}/B`, 9402), await serve(`${J}/T`, 9403)];
fs.writeFileSync(`${J}/servers.pid`, s.map((x) => x.pid).join("\n") + "\n" + process.pid + "\n");
console.log("up", s.map((x) => `${x.base} pid ${x.pid}`).join(", "));
while (!fs.existsSync(`${J}/stop`)) await sleep(1000);
for (const x of s) await x.stop();
console.log("stopped");

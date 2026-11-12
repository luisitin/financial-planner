// serve.mjs -- the forms build (9431) and the tip ee09f6e (9432). Runs until ./stop exists; stops only the servers it started.
import fs from "node:fs";
import { serve, sleep } from "$SP/ux/kit.mjs";
const J = "$SP/w1/bf";
try { fs.unlinkSync(`${J}/stop`); } catch { }
const s = [await serve("$SP/w1/build-forms", 9431), await serve(`${J}/tip`, 9432)];
fs.writeFileSync(`${J}/servers.pid`, s.map((x) => x.pid).join("\n") + "\n" + process.pid + "\n");
console.log("up", s.map((x) => `${x.base} pid ${x.pid}`).join(", "));
while (!fs.existsSync(`${J}/stop`)) await sleep(1000);
for (const x of s) await x.stop();
console.log("stopped");

import { H, start, sleep, settle } from "./lib.mjs";
const [route, hh = "family"] = process.argv.slice(2);
const s = await start("T", H[hh](), route); await sleep(1200);
console.log(await s.page.evaluate(() => ({ hash: location.hash, inputs: [...document.querySelectorAll("#content input, #content textarea, #content select")].map((c) => `${c.tagName}:${c.type}:${c.name}:${c.id}:${c.getAttribute("aria-label")}:${(c.closest("label")?.textContent ?? "").replace(/\s+/g," ").trim().slice(0,40)}:${c.closest("details") ? (c.closest("details").open ? "open" : "shut") : "-"}:${c.getClientRects().length}`).filter((x)=>!x.includes("checkbox")).slice(0, 40), btns: [...document.querySelectorAll("#content button, #content a")].map((b) => b.textContent.replace(/\s+/g, " ").trim().slice(0, 40)).filter(Boolean).slice(0, 40) })));
await s.close();

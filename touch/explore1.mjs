// exploration: boot time, census counts per page (family household)
import { households, open, census, state, go, settle, pages, sleep } from "../ux/kit.mjs";
const ROOT = "$SP/wtouch";
const base = "http://127.0.0.1:9320";
const H = await households(ROOT);
const P = (await pages(ROOT)).filter((p) => !p.builderOnly && !p.requires);
const t0 = Date.now();
const s = await open({ base, plan: H.family(), route: "overview/dashboard" });
console.log("boot ms", Date.now() - t0, "errors", s.pageErrors.length);
// clock test
const tot = {}; let n = 0; const rows = [];
for (const p of P) {
  const t = Date.now();
  await go(s.page, p.key);
  const c = await census(s.page);
  const inPage = c.filter((x) => x.where === "page" || x.where === "shell");
  const kinds = {};
  for (const x of inPage) { const k = x.tag === "input" ? `input:${x.type || "text"}` : x.tag; kinds[k] = (kinds[k] ?? 0) + 1; tot[k] = (tot[k] ?? 0) + 1; }
  const st = await state(s.page);
  rows.push(`${p.key.padEnd(34)} ${String(inPage.length).padStart(4)} ctl  ${String(st.docH).padStart(6)}px  ${Date.now() - t}ms  ${JSON.stringify(kinds)}`);
  n += inPage.length;
}
console.log(rows.join("\n"));
console.log("total controls", n, JSON.stringify(tot), "elapsed s", Math.round((Date.now() - t0) / 1000), "pageErrors", s.pageErrors.slice(0, 5));
await s.close();

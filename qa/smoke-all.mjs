// qa/smoke-all.mjs -- open every usable page in the sandbox with the sample household, its holdings and a bank
// import loaded, and report JavaScript errors, anything wider than the phone screen, and tap
// targets under 44 px. The builder runs it at the start of every phase (docs/TEAM.md); anyone can.
//   node qa/smoke-all.mjs                 every usable page, phone
//   node qa/smoke-all.mjs --desktop       desktop width
//   node qa/smoke-all.mjs debt cashflow   only these groups
// Needs the server on 127.0.0.1:8787 (Start-Planner.bat). Screenshots land in shots/qa-smoke-*.png.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const desktop = args.includes("--desktop");
const groups = args.filter((a) => !a.startsWith("--"));
const pages = [];
for (const g of fs.readdirSync(path.join(ROOT, "modules"), { withFileTypes: true })) {
  if (!g.isDirectory() || g.name.startsWith("_")) continue;
  if (groups.length && !groups.includes(g.name)) continue;
  for (const m of fs.readdirSync(path.join(ROOT, "modules", g.name), { withFileTypes: true })) {
    if (!m.isDirectory()) continue;
    const src = fs.readFileSync(path.join(ROOT, "modules", g.name, m.name, "module.js"), "utf8");
    if (/status:\s*"(usable|complete|stub)"/.test(src)) pages.push(`${g.name}/${m.name}`);
  }
}
console.log(`${pages.length} pages, ${desktop ? "desktop" : "phone"}\n`);
const bad = [];
const t0 = Date.now();
for (const page of pages) {
  const name = page.replace("/", "-");
  const evalJs = `await qa.go(${JSON.stringify(page)}, 900); return { title: qa.pageTitle(), overflow: qa.overflow(), small: qa.smallTargets().filter((t) => !(t.tag === "a" && t.w > 200)), text: qa.pageText().length };`;
  const r = spawnSync(process.execPath, ["tools/drive.mjs", "transactions/import", "--script", "qa/flows/seed-sample.js", "--script", "qa/flows/seed-holdings.js", "--script", "qa/flows/import-csv.js", "--eval", evalJs, "--shot", `smoke-${name}`, ...(desktop ? ["--desktop"] : [])], { cwd: ROOT, encoding: "utf8", timeout: 120000 });
  let out; try { out = JSON.parse(r.stdout); } catch { bad.push(page); console.log(`${page.padEnd(32)} DRIVER FAILED ${(r.stderr || r.stdout).slice(0, 200)}`); continue; }
  const last = out.results[out.results.length - 1] ?? {};
  const res = last.result ?? {};
  const problems = [];
  if (out.errors.length) problems.push(`${out.errors.length} JS error(s): ${out.errors[0].text.slice(0, 120)}`);
  if (last.threw) problems.push(`threw: ${last.threw.slice(0, 120)}`);
  if ((res.overflow ?? []).length) problems.push(`overflow: ${res.overflow.map((o) => o.tag + (o.class ? "." + String(o.class).split(" ")[0] : "")).slice(0, 4).join(", ")}`);
  if ((res.small ?? []).length) problems.push(`small targets: ${res.small.map((s) => `${s.tag} "${s.text}" ${s.h}px`).slice(0, 3).join("; ")}`);
  if (out.badResponses.length) problems.push(`bad responses: ${out.badResponses.map((b) => b.status).join(",")}`);
  if ((res.text ?? 0) < 40) problems.push("almost no text on the page");
  if (problems.length) bad.push(page);
  console.log(`${page.padEnd(32)} ${problems.length ? "!! " + problems.join(" | ") : "ok  " + (res.title ?? "")}`);
}
console.log(`\n${pages.length - bad.length} of ${pages.length} pages clean in ${Math.round((Date.now() - t0) / 1000)} s${bad.length ? `; look at: ${bad.join(", ")}` : ""}`);
process.exit(bad.length ? 1 : 0);

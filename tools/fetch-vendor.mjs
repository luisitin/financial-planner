// tools/fetch-vendor.mjs -- clone/download everything in vendor/sources.json.
//   node tools/fetch-vendor.mjs            fetch what is missing, update what exists
//   node tools/fetch-vendor.mjs --only actual,fi-calc
// Shallow clones (--depth 1). Writes vendor/MANIFEST.json (commit per repo, size, date)
// so the copies are reproducible. Never deletes anything.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VENDOR = path.join(ROOT, "vendor");
const DATA = path.join(VENDOR, "data");
fs.mkdirSync(DATA, { recursive: true });
const sources = JSON.parse(fs.readFileSync(path.join(VENDOR, "sources.json"), "utf8"));
const only = (process.argv.find((a) => a.startsWith("--only")) ? (process.argv[process.argv.indexOf(process.argv.find((a) => a.startsWith("--only"))) + 1] || "") : "").split(",").filter(Boolean);
const want = (name) => !only.length || only.includes(name);
const manifest = fs.existsSync(path.join(VENDOR, "MANIFEST.json")) ? JSON.parse(fs.readFileSync(path.join(VENDOR, "MANIFEST.json"), "utf8")) : { git: {}, files: {} };
// Network git commands run with stdio ignored (no pipes for grandchild processes to
// inherit -- a stalled git-remote-https once kept the whole script waiting) and a
// hard 6-minute cap; a stalled clone is logged as FAILED and the script moves on.
const git = (args, cwd) => execFileSync("git", args, { cwd, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", timeout: 60 * 1000 }).trim();
const gitNet = (args, cwd) => execFileSync("git", args, { cwd, stdio: "ignore", timeout: 6 * 60 * 1000, killSignal: "SIGKILL" });
const dirSize = (d) => { let n = 0; for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== ".git") n += dirSize(p); } else n += fs.statSync(p).size; } return n; };

for (const s of sources.git) {
  if (!want(s.name)) continue;
  const dest = path.join(VENDOR, s.name);
  try {
    if (fs.existsSync(path.join(dest, ".git")) && fs.existsSync(path.join(dest, "HEAD_OK"))) { process.stdout.write(`update ${s.name} ... `); try { gitNet(["pull", "--ff-only", "--depth", "1"], dest); } catch { gitNet(["fetch", "--depth", "1"], dest); git(["reset", "--hard", "origin/HEAD"], dest); } }
    else { process.stdout.write(`clone  ${s.name} ... `); fs.rmSync(dest, { recursive: true, force: true }); gitNet(["clone", "--depth", "1", "--quiet", s.url, dest], VENDOR); fs.writeFileSync(path.join(dest, "HEAD_OK"), "clone completed by tools/fetch-vendor.mjs\n"); }
    const commit = git(["rev-parse", "--short", "HEAD"], dest);
    const date = git(["log", "-1", "--format=%cs"], dest);
    manifest.git[s.name] = { url: s.url, commit, commitDate: date, fetchedAt: new Date().toISOString().slice(0, 10), sizeMB: Math.round(dirSize(dest) / 1048576), license: s.license, seeds: s.seeds };
    console.log(`ok ${commit} (${date}) ${manifest.git[s.name].sizeMB} MB`);
  } catch (e) { console.log(`FAILED: ${String(e.message || e).split("\n")[0]}`); manifest.git[s.name] = { url: s.url, error: String(e.message || e).split("\n")[0] }; }
}
for (const f of sources.files) {
  if (!want(f.name)) continue;
  const dest = path.join(DATA, f.name);
  process.stdout.write(`file   ${f.name} ... `);
  try {
    const r = await fetch(f.url, { headers: { "User-Agent": "Mozilla/5.0 (FinancialPlanner vendor fetch)" }, redirect: "follow" });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(dest, buf);
    manifest.files[f.name] = { url: f.url, bytes: buf.length, fetchedAt: new Date().toISOString().slice(0, 10), seeds: f.seeds };
    console.log(`ok ${Math.round(buf.length / 1024)} KB`);
  } catch (e) { console.log(`FAILED: ${e.message}`); manifest.files[f.name] = { url: f.url, error: e.message }; }
}
fs.writeFileSync(path.join(VENDOR, "MANIFEST.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`\nmanifest: ${Object.keys(manifest.git).length} repos, ${Object.keys(manifest.files).length} files -> vendor/MANIFEST.json`);
console.log("manual downloads still needed (see sources.json \"manual\"):");
for (const m of sources.manual) console.log(`  - ${m.name}: ${m.url}`);

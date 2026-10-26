// tools/sync-responses.mjs -- files what the Planner Prompt Board holds into ai-responses/ on this PC.
// The board (an Artifact) keeps one status document per prompt in its database and the answers as
// uploaded files. A Claude session pulls both into a folder, then runs:
//   node tools/sync-responses.mjs <pulled folder>
// <pulled folder>/db/status/<prompt-id>.json   one per prompt (ArtifactData list ... out_dir)
// <pulled folder>/assets/<asset-id>.<ext>       the uploaded answers (Artifact read path=<asset id>)
// Result: ai-responses/<prompt-id>/{status.json, notes.md, <date>-<tool>-<name>} plus
// ai-responses/index.json and INDEX.md. ai-responses/ is git-ignored: answers stay private until the
// owner says otherwise. Prints what is new since the last sync (the triage queue), and the asset ids
// still missing from the pulled folder.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "ai-responses");
const pulled = process.argv[2];
if (!pulled || !fs.existsSync(pulled)) { console.error("usage: node tools/sync-responses.mjs <pulled folder>"); process.exit(2); }

const prompts = new Map(JSON.parse(fs.readFileSync(path.join(ROOT, "prompts", "index.json"), "utf8")).prompts.map((p) => [p.id, p]));
const slug = (s) => String(s || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "unknown";
const stamp = (iso) => String(iso || "").replace(/[-:]/g, "").replace("T", "-").slice(0, 13);
const previous = fs.existsSync(path.join(OUT, "index.json")) ? JSON.parse(fs.readFileSync(path.join(OUT, "index.json"), "utf8")) : { prompts: [] };
const seenFiles = new Set(previous.prompts.flatMap((p) => p.responses.map((r) => `${p.id}/${r.file}`)));

// documents: accept both a bare body and a { data, version, ... } wrapper
const docsDir = path.join(pulled, "db", "status");
const docs = fs.existsSync(docsDir) ? fs.readdirSync(docsDir).filter((f) => f.endsWith(".json")).map((f) => {
  const raw = JSON.parse(fs.readFileSync(path.join(docsDir, f), "utf8"));
  const body = raw && typeof raw.data === "object" && raw.data && !Array.isArray(raw.data) ? raw.data : raw;
  return { id: raw.id ?? raw.doc_id ?? f.replace(/\.json$/, ""), body };
}) : [];
const assetsDir = path.join(pulled, "assets");
const assetFiles = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir) : [];
const assetPath = (id) => { const f = assetFiles.find((n) => n === id || n.startsWith(id + ".")); return f ? path.join(assetsDir, f) : null; };

fs.mkdirSync(OUT, { recursive: true });
const index = [], fresh = [], missing = [];
for (const { id, body } of docs.sort((a, b) => a.id.localeCompare(b.id))) {
  const p = prompts.get(id);
  const sent = Object.keys(body.sent || {});
  const responses = body.responses || [];
  if (!sent.length && !body.done && !body.notes && !responses.length) continue;
  const dir = path.join(OUT, id);
  fs.mkdirSync(dir, { recursive: true });
  const filed = [];
  for (const r of responses) {
    const ext = path.extname(r.name || "") || (r.type === "text/markdown" ? ".md" : r.type === "application/pdf" ? ".pdf" : ".txt");
    const file = `${stamp(r.addedAt)}-${slug(r.from)}-${slug(path.basename(r.name || "answer", ext))}${ext}`;
    const dest = path.join(dir, file);
    if (r.asset) {
      const src = assetPath(r.asset);
      if (src) fs.copyFileSync(src, dest);
      else if (!fs.existsSync(dest)) { missing.push(r.asset); continue; }
    } else if (typeof r.text === "string") fs.writeFileSync(dest, r.text);
    filed.push({ file, from: r.from || "", addedAt: r.addedAt || "", source: r.source || "", asset: r.asset || null, size: fs.statSync(dest).size });
    if (!seenFiles.has(`${id}/${file}`)) fresh.push(`${id}/${file}`);
  }
  if (body.notes) fs.writeFileSync(path.join(dir, "notes.md"), body.notes + "\n");
  const entry = { id, title: p?.title ?? id, category: p?.category ?? "", sent: body.sent || {}, done: !!body.done, doneAt: body.doneAt || null, notes: !!body.notes, updatedAt: body.updatedAt || null, triaged: fs.existsSync(path.join(dir, "triage.md")), responses: filed };
  fs.writeFileSync(path.join(dir, "status.json"), JSON.stringify(entry, null, 2) + "\n");
  index.push(entry);
}
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ syncedAt: new Date().toISOString(), prompts: index }, null, 2) + "\n");
const md = ["# AI responses (synced from the Planner Prompt Board)", "", `Synced ${new Date().toISOString()}. Private: this folder is git-ignored.`, "",
  "| prompt | sent to | answers | done | triaged |", "|---|---|---|---|---|",
  ...index.map((e) => `| \`${e.id}\` ${e.title} | ${Object.keys(e.sent).join(", ") || "-"} | ${e.responses.length} | ${e.done ? "yes" : "-"} | ${e.triaged ? "yes" : "-"} |`)];
fs.writeFileSync(path.join(OUT, "INDEX.md"), md.join("\n") + "\n");
const counts = { prompts: index.length, sent: index.filter((e) => Object.keys(e.sent).length).length, answers: index.reduce((n, e) => n + e.responses.length, 0), done: index.filter((e) => e.done).length };
console.log(`sync: ${counts.prompts} prompts touched, ${counts.sent} sent, ${counts.answers} answers, ${counts.done} done -> ai-responses/`);
if (fresh.length) { console.log(`new since the last sync (${fresh.length}):`); for (const f of fresh) console.log("  " + f); }
else console.log("nothing new since the last sync");
if (missing.length) { console.log(`asset files not in the pulled folder (${missing.length}); pull them and run again:`); for (const m of missing) console.log("  " + m); process.exitCode = 3; }

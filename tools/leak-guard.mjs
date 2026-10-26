// tools/leak-guard.mjs -- refuses to let personal data into git. The repo is public, so this runs
// from the pre-commit hook on what is staged and from the pre-push hook on every commit leaving the PC.
//   node tools/leak-guard.mjs                staged files (what the next commit adds or changes)
//   node tools/leak-guard.mjs --all          every file in the index (the whole next commit)
//   node tools/leak-guard.mjs --worktree     every file git would pick up from this folder
//   node tools/leak-guard.mjs --commits A..B the files each commit in the range adds or changes,
//                                            plus the commits' messages and author/committer emails
//   node tools/leak-guard.mjs --learn-from-plan   (owner only) see learnFromPlan() below
// Hooks: `npm run hooks` once per clone (git config core.hooksPath .githooks).
//
// Rules: the private scrub list (private/scrub-list.txt and private/scrub-from-plan.txt, git-ignored:
// one term per line, `#` comments, plain = case-insensitive text, `re:` = case-insensitive regex,
// `RE:` = case-sensitive regex) plus generic shapes: emails, phone numbers, SSNs, long digit runs,
// IP addresses, Windows/home user folders, tailnet names, keys and tokens, private paths, and binary
// files. Known-safe hits go in .leakguard-allow (committed): `<rule> <path glob> <exact text>`;
// a line containing `leak-guard: ok` is skipped.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PRIVATE = path.join(ROOT, "private");
const args = process.argv.slice(2);
const NOREPLY = /^(\d+\+)?[A-Za-z0-9-]+@users\.noreply\.github\.com$|^noreply@anthropic\.com$/i;

function git(argv, input) {
  const r = spawnSync("git", argv, { cwd: ROOT, input, maxBuffer: 1 << 30 });
  if (r.status !== 0) throw new Error(`git ${argv.join(" ")}: ${r.stderr.toString().trim()}`);
  return r.stdout;
}
const nulSplit = (buf) => buf.toString("utf8").split("\0").filter(Boolean);

// ---- what to scan -------------------------------------------------------------------------------
// Each item: { path, sha } (content from git) or { path, file } (content from disk).
function stagedItems(all) {
  const index = new Map();
  for (const rec of nulSplit(git(["ls-files", "-s", "-z"]))) {
    const [meta, p] = rec.split("\t");
    index.set(p, meta.split(" ")[1]);
  }
  const paths = all ? [...index.keys()] : nulSplit(git(["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"]));
  return paths.filter((p) => index.has(p)).map((p) => ({ path: p, sha: index.get(p) }));
}
function worktreeItems() {
  return nulSplit(git(["ls-files", "-z", "--cached", "--others", "--exclude-standard"]))
    .filter((p) => fs.existsSync(path.join(ROOT, p))).map((p) => ({ path: p, file: path.join(ROOT, p) }));
}
function commitItems(range) {
  const commits = git(["rev-list", ...range.split(" ")]).toString().split("\n").filter(Boolean);
  const items = new Map();
  for (const c of commits) {
    const out = nulSplit(git(["diff-tree", "--no-commit-id", "-r", "-z", "--root", "--diff-filter=ACMR", c]));
    for (let i = 0; i < out.length; i += 2) items.set(`${out[i + 1]}@${out[i].split(" ")[3]}`, { path: out[i + 1], sha: out[i].split(" ")[3], commit: c.slice(0, 8) });
  }
  return { commits, items: [...items.values()] };
}
function readBlobs(items) {
  const want = items.filter((it) => it.sha);
  if (!want.length) return;
  const out = git(["cat-file", "--batch"], want.map((it) => it.sha).join("\n") + "\n");
  let pos = 0;
  for (const it of want) {
    const nl = out.indexOf(10, pos);
    const size = Number(out.subarray(pos, nl).toString().split(" ")[2]);
    it.buf = out.subarray(nl + 1, nl + 1 + size);
    pos = nl + 1 + size + 1;
  }
}

// ---- rules ----------------------------------------------------------------------------------------
function loadScrub() {
  const terms = [];
  for (const f of ["scrub-list.txt", "scrub-from-plan.txt"]) {
    const file = path.join(PRIVATE, f);
    if (!fs.existsSync(file)) continue;
    for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      if (line.startsWith("re:")) terms.push(new RegExp(line.slice(3), "gi"));
      else if (line.startsWith("RE:")) terms.push(new RegExp(line.slice(3), "g"));
      else terms.push(new RegExp(line.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"));
    }
  }
  return terms;
}
const octetsOk = (ip) => ip.split(".").every((o) => Number(o) <= 255);
const RULES = [
  { name: "email", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    skip: (m) => /@(example\.(com|org|net)|users\.noreply\.github\.com)$/i.test(m) || /^(git@github\.com|noreply@anthropic\.com)$/i.test(m) },
  { name: "phone", re: /(?<![\d-])(?:\+?1[-. ])?\(?[2-9]\d{2}\)?[-. ]\d{3}[-. ]\d{4}(?![\d-])/g },
  { name: "ssn", re: /(?<![\d-])\d{3}-\d{2}-\d{4}(?![\d-])/g },
  { name: "digits", re: /(?<![\d.])\d{9,}(?!\d)/g, skip: (m) => /^(\d)\1*$/.test(m) || /^[1-9]0+$/.test(m) },
  { name: "ip", re: /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d.])/g, skip: (m) => !octetsOk(m) || /^(127\.|0\.0\.0\.0$|255\.)/.test(m) },
  { name: "user-folder", re: /(?:[A-Za-z]:[\\/]+Users[\\/]+|(?<![\w.])\/(?:home|Users)\/)([^\\/\s"'`<>%$)]+)/gi,
    skip: (m) => /[\\/](public|default|you|your-?name|username|user|me|runner|name)$/i.test(m) },
  { name: "tailnet", re: /\btail[0-9a-f]{4,}\.ts\.net\b/gi },
  { name: "key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}|\bsk-[A-Za-z0-9_-]{20,}|\bAKIA[0-9A-Z]{16}\b|\bxox[abprs]-[A-Za-z0-9-]{10,}/g },
  { name: "secret", re: /\b(?:api[_-]?key|secret|passw(?:or)?d|token)\b["']?\s*[:=]\s*["']([^"'\s]{12,})["']|^\s*(?:auth\.token|ai\.apiKey)\s*=\s*\S{6,}/gim },
];
const PRIVATE_PATH = /^(data|vendor|dist|shots|private|ai-responses|node_modules)\/|(^|\/)planner\.properties$|(^|\/)\.env(\.|$)|\.(pem|key|p12|pfx|kdbx)$/i;

function loadAllow() {
  const file = path.join(ROOT, ".leakguard-allow");
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, "utf8").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#")).map((l) => {
    const [rule, glob, ...rest] = l.split(/\s+/);
    const g = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\0").replace(/\*/g, "[^/]*").replace(/\?/g, ".").replace(/\0/g, ".*");
    return { rule, glob: new RegExp(`^${g}$`), text: rest.join(" ") };
  });
}

// ---- scan -----------------------------------------------------------------------------------------
function scanText(where, text, scrub, allow, hits) {
  const allowed = (rule, m) => allow.some((a) => (a.rule === "*" || a.rule === rule) && a.glob.test(where.path) && (a.text === "*" || a.text === m));
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.includes("leak-guard: ok")) return;
    const check = (rule, re, skip) => {
      re.lastIndex = 0;
      for (const m of line.matchAll(re)) {
        if ((skip && skip(m[0])) || allowed(rule, m[0])) continue;
        hits.push({ ...where, line: i + 1, rule, text: m[0], context: line.trim().slice(0, 160) });
      }
    };
    for (const re of scrub) check("scrub", re);
    if (where.path === ".leakguard-allow") return; // it lists the safe literals; the scrub list still applies
    for (const r of RULES) check(r.name, r.re, r.skip);
  });
}
function scan(items, scrub, allow) {
  const hits = [];
  for (const it of items) {
    const where = { path: it.path, commit: it.commit };
    if (PRIVATE_PATH.test(it.path)) { hits.push({ ...where, line: 0, rule: "private-path", text: it.path, context: "this path must never be committed" }); continue; }
    const buf = it.buf ?? fs.readFileSync(it.file);
    if (buf.subarray(0, 8000).includes(0)) {
      if (!allow.some((a) => (a.rule === "binary" || a.rule === "*") && a.glob.test(it.path))) hits.push({ ...where, line: 0, rule: "binary", text: it.path, context: "binary file not on .leakguard-allow (screenshot? statement?)" });
      continue;
    }
    scanText(where, buf.toString("utf8"), scrub, allow, hits);
  }
  return hits;
}
function identityHits(commits) {
  const hits = [];
  if (commits && !commits.length) return hits;
  const ident = (v) => { try { return (git(["var", v]).toString().match(/<([^>]*)>/) ?? [])[1] ?? ""; } catch { return "(no identity set: git config user.email)"; } };
  const idents = commits ? git(["log", "--no-walk=unsorted", "--format=%h%x00%ae%x00%ce", ...commits]).toString().split("\n").filter(Boolean).map((l) => l.split("\0"))
    : [["(next commit)", ident("GIT_AUTHOR_IDENT"), ident("GIT_COMMITTER_IDENT")]];
  for (const [c, ...emails] of idents) for (const e of emails) if (!NOREPLY.test(e)) hits.push({ path: "(commit identity)", commit: c, line: 0, rule: "identity", text: e, context: "author/committer email must be a GitHub noreply address" });
  return hits;
}

// ---- learn from the plan (owner only) -------------------------------------------------------------
// Reads the real plan on this PC and writes the names in it (people, plan name, and capitalised words
// from income and account names that are not common words or big banks) to private/scrub-from-plan.txt.
// Only the count is printed, so the names never show up in a terminal or a session log.
function learnFromPlan() {
  const props = fs.existsSync(path.join(ROOT, "planner.properties")) ? fs.readFileSync(path.join(ROOT, "planner.properties"), "utf8") : "";
  const dir = (props.match(/^\s*data\.dir\s*=\s*(.+)$/m) ?? [])[1]?.trim() || "data";
  const plan = JSON.parse(fs.readFileSync(path.resolve(ROOT, dir, "plan.json"), "utf8"));
  const common = new Set("the and for from with checking savings account card credit debit loan mortgage auto car student salary paycheck pay bonus income social security pension rental business side gig other joint brokerage roth ira hsa fsa trust cash money market fund bank chase schwab vanguard fidelity wells fargo america amex american express discover capital one ally citi citibank synchrony usaa navy federal union credit tiaa merrill edward jones etrade robinhood coinbase paypal venmo apple google amazon visa mastercard".split(" "));
  const terms = new Set();
  const add = (s, all) => String(s ?? "").split(/[^\p{L}\p{N}'-]+/u).forEach((w) => {
    if (w.length >= 3 && !common.has(w.toLowerCase()) && (all || /^\p{Lu}/u.test(w)) && !/^\d+$/.test(w)) terms.add(w);
  });
  for (const p of plan.household?.people ?? []) add(p.name, true);
  add(plan.meta?.name, true);
  for (const i of plan.income ?? []) add(i.name, false);
  for (const a of plan.accounts ?? []) add(a.name, false);
  fs.mkdirSync(PRIVATE, { recursive: true });
  fs.writeFileSync(path.join(PRIVATE, "scrub-from-plan.txt"), "# written by tools/leak-guard.mjs --learn-from-plan; edit freely\n" + [...terms].map((t) => `re:\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).join("\n") + "\n");
  console.log(`leak-guard: learned ${terms.size} names from the plan into private/scrub-from-plan.txt (not shown)`);
}

// ---- main -----------------------------------------------------------------------------------------
if (args.includes("--learn-from-plan")) { learnFromPlan(); process.exit(0); }
const scrub = loadScrub(), allow = loadAllow();
let items, commits = null, mode;
if (args.includes("--commits")) {
  mode = `commits ${args[args.indexOf("--commits") + 1]}`;
  ({ commits, items } = commitItems(args[args.indexOf("--commits") + 1]));
} else if (args.includes("--worktree")) { mode = "worktree"; items = worktreeItems(); }
else { mode = args.includes("--all") ? "index" : "staged"; items = stagedItems(args.includes("--all")); }
readBlobs(items);
const hits = [...scan(items, scrub, allow), ...identityHits(commits)];
if (commits) for (const c of commits) scanText({ path: "(commit message)", commit: c.slice(0, 8) }, git(["log", "-1", "--format=%B", c]).toString(), scrub, allow, hits);
const note = scrub.length ? "" : " (no private/scrub-list.txt: generic rules only)";
if (!hits.length) { console.log(`leak-guard: OK, ${items.length} files (${mode})${note}`); process.exit(0); }
console.log(`leak-guard: ${hits.length} possible leak${hits.length > 1 ? "s" : ""} in ${mode}${note}`);
for (const h of hits.slice(0, 200)) console.log(`  ${h.commit ? h.commit + " " : ""}${h.path}${h.line ? ":" + h.line : ""}  [${h.rule}] ${h.text}${h.line ? "\n      " + h.context : ""}`);
if (hits.length > 200) console.log(`  ... and ${hits.length - 200} more`);
console.log("Fix the text, or if it is safe add `<rule> <path glob> <exact text>` to .leakguard-allow.");
process.exit(1);

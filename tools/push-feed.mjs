// tools/push-feed.mjs -- the Prompt Board's "Recent pushes" feed: the last 30 commits on origin/main, the open pull
// requests (when the gh CLI is signed in) and the other branches with commits that are not on main yet, each tagged
// with the prompt ids its messages name (a `Prompt: <id>` line, or the id anywhere in the message). The lead's loop
// writes the result into the board's database (collection `repo`, document `pushes`), so the Results tab shows what
// was pushed and for which prompt.
//   node tools/push-feed.mjs [out.json] [--compare board-copy.json]
// No out file: print the JSON. --compare says whether anything was pushed since that copy (the board's document,
// pulled with ArtifactData get ... out_dir): a new head on main, a pull request opened or updated, a branch moved.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const index = JSON.parse(fs.readFileSync(path.join(ROOT, "prompts", "index.json"), "utf8"));
const REPO = index.repo;
const slug = REPO.replace(/^https:\/\/github\.com\//, "");
const ids = index.prompts.map((p) => p.id);
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
const mentions = (text) => ids.filter((id) => new RegExp(`(^|[^a-z0-9-])${id}($|[^a-z0-9-])`).test(text));

try { git("fetch", "-q", "--prune", "origin"); } catch { console.error("push-feed: git fetch failed; using what is already fetched"); }
const SEP = "\x1f", END = "\x1e";
const commits = git("log", "origin/main", "-30", `--format=%H${SEP}%h${SEP}%cI${SEP}%s${SEP}%b${END}`)
  .split(END).map((r) => r.trim()).filter(Boolean).map((r) => {
    const [sha, short, date, title, body = ""] = r.split(SEP);
    return { sha, short, date, title, url: `${REPO}/commit/${sha}`, prompts: mentions(`${title}\n${body}`) };
  });
let pulls = [];
try {
  pulls = JSON.parse(execFileSync("gh", ["pr", "list", "--repo", slug, "--state", "open", "--json", "number,title,headRefName,url,updatedAt,body"], { encoding: "utf8" }))
    .map((pr) => ({ number: pr.number, title: pr.title, branch: pr.headRefName, url: pr.url, updatedAt: pr.updatedAt, prompts: mentions(`${pr.title}\n${pr.body || ""}`) }));
} catch { /* no gh, or not signed in: the feed just has no pull requests */ }
// branches an agent pushed without a pull request: newest first, only those with commits main does not have
const inPull = new Set(pulls.map((pr) => pr.branch));
const branches = git("for-each-ref", "--sort=-committerdate", `--format=%(refname:short)${SEP}%(objectname)${SEP}%(committerdate:iso-strict)${SEP}%(subject)`, "refs/remotes/origin")
  .split("\n").filter(Boolean).map((l) => l.split(SEP))
  .filter(([ref]) => ref.startsWith("origin/") && ref !== "origin/main" && ref !== "origin/HEAD" && !inPull.has(ref.slice(7)))
  .map(([ref, sha, date, title]) => {
    const name = ref.slice(7), ahead = Number(git("rev-list", "--count", `origin/main..${ref}`).trim());
    return { name, sha, short: sha.slice(0, 7), date, title, ahead, url: `${REPO}/tree/${name.split("/").map(encodeURIComponent).join("/")}`,
      prompts: ahead ? mentions(git("log", `origin/main..${ref}`, "--format=%s%n%b")) : [] };
  })
  .filter((b) => b.ahead > 0).slice(0, 10);

const feed = { repo: REPO, branch: "main", head: commits[0]?.sha ?? null, checkedAt: new Date().toISOString(), commits, pulls, branches };
const argv = process.argv.slice(2), ci = argv.indexOf("--compare");
const against = ci >= 0 ? argv.splice(ci, 2)[1] : null, out = argv[0];
if (out) { fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true }); fs.writeFileSync(out, JSON.stringify(feed, null, 2) + "\n"); console.log(`push-feed: ${commits.length} commits (head ${commits[0]?.short ?? "-"}), ${pulls.length} open pull requests, ${branches.length} other branches -> ${out}`); }
else process.stdout.write(JSON.stringify(feed, null, 2) + "\n");
if (against) {
  const sig = (f) => [f.head, ...(f.pulls || []).map((p) => `#${p.number}@${p.updatedAt}`), ...(f.branches || []).map((b) => `${b.name}@${b.sha}`)].join(" ");
  let old = null;
  try { old = JSON.parse(fs.readFileSync(against, "utf8")); } catch { /* no copy yet: everything is new */ }
  console.log(old && sig(old) === sig(feed) ? "push-feed: unchanged since the board's copy" : "push-feed: CHANGED since the board's copy");
}

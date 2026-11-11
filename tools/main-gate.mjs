// tools/main-gate.mjs -- the gate before `main` moves. GitHub Pages serves `main`; the owner's phone opens it. Run by
// .githooks/pre-push for every push to refs/heads/main (`npm run hooks` once per clone), and by hand as `npm run skew`.
// docs/PLAN.md "On a static host (GitHub Pages)".
//
//   node tools/main-gate.mjs <what main is now> <what you push>    (the hook passes the two commits)
//   node tools/main-gate.mjs                                       (npm run skew: origin/main, if known, -> this working tree)
//
// Runs qa/flows/static-skew.mjs --check twice, in a phone-sized Chromium, the way the 2026-11-07 deploy reached the
// owner's phone (some files fresh in the phone's cache, the rest new from the site):
//   1. the real pair: <what main is now> opened first, then <what you push> deployed and the app opened again from the
//      home screen (--how reopen). This is the push itself; it would have failed with the owner's screen on 2026-11-07.
//      When main has no sw.js yet (the one push that ships it) the old shell running is a warning, not a failure; any
//      other file that ran old next to new ones fails it: ship sw.js alone, wait 10 minutes, then push the rest.
//   2. the mechanism: <what you push> against itself plus a synthetic change of every shape that can mix (--how reload).
// Before it looks at anything it checks the wait (waitProblem): main is not moved again within 11 minutes of the last
// push that changed the app. GitHub Pages tells a phone to keep each file for 10 minutes, so a phone that opened the site
// just before that push still holds some of its files; a second push inside that time can show it old and new files
// together. The wait is read from what git knows: the last commit's date on origin/main, and when this clone last
// pushed it (the "update by push" line in the reflog of origin/main). Override, when you know no phone opened the site
// in between: `PLANNER_MAIN_WAIT=skip git push` (or `node tools/main-gate.mjs --no-wait <from> <to>`).
// Exits 1 when either fails (the hook then refuses the push), 0 when both pass. Never skip it with --no-verify.
// Without Playwright and its Chromium it cannot look: it says so loudly and lets the push through (exit 0), because the
// gate must not lock out a machine that cannot run it; run it where Playwright is (claude-b's environment has it).
// Takes about a minute and four copies of the tree (~300 MB) in the system's temporary folder, deleted afterwards.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { touchesApp } from "./live-check.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ZERO = /^0+$/;

/**
 * The two runs for a push from `from` (what main is now; null or all zeros for a new main) to `to` (what is pushed, a
 * commit or "worktree"). Each run: { name, args } for node, `out` its report folder.
 */
export function runsFor(from, to, out) {
  const runs = [], trees = ["--trees", path.join(out, "trees")];   // one export of each commit, shared by the two runs
  if (from && !ZERO.test(from)) runs.push({ name: `the push itself (${short(from)} -> ${short(to)}, reopened from the home screen)`, args: ["qa/flows/static-skew.mjs", "--check", "--a", from, "--b", to, "--how", "reopen", "--out", path.join(out, "pair"), ...trees] });
  runs.push({ name: `every shape that can mix (${short(to)} + a synthetic change)`, args: ["qa/flows/static-skew.mjs", "--check", "--a", to, "--out", path.join(out, "synthetic"), ...trees] });
  return runs;
}
const short = (rev) => (/^[0-9a-f]{40}$/.test(rev) ? rev.slice(0, 7) : rev);

/** How long a phone may keep a file the site sent: Cache-Control max-age=600 on GitHub Pages, plus a minute. */
export const WAIT_MINUTES = 11;
const ago = (ms) => { const m = Math.floor(Math.max(0, ms) / 60000); return m < 1 ? "less than a minute ago" : `${m} minute${m === 1 ? "" : "s"} ago`; };
const clock = (ms) => new Date(ms).toISOString().slice(11, 16) + " UTC";

/**
 * Is it too soon to move main again? `lastMoved`: when main last moved, as ms since 1970 (the later of the last commit's
 * date and this clone's last push), or null when unknown; `changed`: the files this push changes. Returns the words to
 * show (plain, with what to do) or null. A push that changes no app file (notes, tests, tools) never waits: no phone
 * runs those. `now`: ms since 1970.
 */
export function waitProblem({ now, lastMoved, changed = [], minutes = WAIT_MINUTES, from = "" }) {
  if (!Number.isFinite(lastMoved) || !touchesApp(changed)) return null;
  const since = now - lastMoved;
  if (since < 0 || since >= minutes * 60000) return null;                    // a clock set back does not block for ever
  const left = Math.ceil((minutes * 60000 - since) / 60000);
  return `main-gate: wait ${left} more minute${left === 1 ? "" : "s"}. main last moved ${ago(since)}${from ? ` (${short(from)})` : ""}, and this push changes the app.\n`
    + `A phone that opened the site just before that push still holds some of its files for up to 10 minutes, so a push now can show it old and new files together (docs/PLAN.md "On a static host").\n`
    + `Push again at ${clock(lastMoved + minutes * 60000)} or later. If you know no phone opened the site since: PLANNER_MAIN_WAIT=skip git push`;
}

/** When main last moved, from git: the later of the commit's date and this clone's last push of that commit. ms, or null. */
export function lastMovedAt(from, git = (args) => spawnSync("git", ["-C", ROOT, ...args], { encoding: "utf8" })) {
  const times = [];
  const c = git(["log", "-1", "--format=%ct", from]);
  if (c.status === 0 && /^\d+$/.test(String(c.stdout).trim())) times.push(Number(String(c.stdout).trim()) * 1000);
  const r = git(["reflog", "show", "--format=%H%x09%ct%x09%gs", "refs/remotes/origin/main"]);
  if (r.status === 0) {
    for (const line of String(r.stdout).split("\n")) {
      const [sha, ct, why] = line.split("\t");
      if (sha === from && /^update by push/.test(why ?? "") && /^\d+$/.test(ct ?? "")) { times.push(Number(ct) * 1000); break; }   // newest first
    }
  }
  return times.length ? Math.max(...times) : null;
}

/** Can this machine run the check (Playwright with its Chromium)? null when it can, else why not. */
export function cannotRun(load = () => createRequire(import.meta.url)("playwright")) {
  let pw;
  try { pw = load(); } catch { return "Playwright is not installed (npm i -D playwright, then npx playwright install chromium)"; }
  const chromium = (pw.default?.chromium ? pw.default : pw).chromium;
  try { if (!fs.existsSync(chromium.executablePath())) return "Playwright's Chromium is not installed (npx playwright install chromium)"; } catch { return "Playwright's Chromium is not installed (npx playwright install chromium)"; }
  return null;
}

function main(argv) {
  const noWait = argv.includes("--no-wait") || process.env.PLANNER_MAIN_WAIT === "skip";
  let [from, to] = argv.filter((a) => !a.startsWith("--"));
  if (!to) {
    to = "worktree";
    const r = spawnSync("git", ["-C", ROOT, "rev-parse", "--verify", "--quiet", "origin/main"], { encoding: "utf8" });
    from = r.status === 0 ? r.stdout.trim() : null;
  }
  for (const rev of [from, to]) {
    if (!rev || ZERO.test(rev) || rev === "worktree") continue;
    if (spawnSync("git", ["-C", ROOT, "cat-file", "-e", `${rev}^{commit}`]).status !== 0) {
      console.error(`main-gate: commit ${rev} is not in this clone. Run \`git fetch origin main\`, then push again.`);
      return 1;
    }
  }
  if (from && !ZERO.test(from) && to && to !== "worktree" && !noWait) {      // only a real push (the hook), not `npm run skew` by hand
    const diff = spawnSync("git", ["-C", ROOT, "diff", "--name-only", from, to], { encoding: "utf8", maxBuffer: 1 << 26 });
    const sooner = waitProblem({ now: Date.now(), lastMoved: lastMovedAt(from), changed: diff.status === 0 ? diff.stdout.split("\n").filter(Boolean) : ["core/app.js"], from });
    if (sooner) { console.error(sooner); return 1; }
  }
  const why = cannotRun();
  if (why) {
    const bar = "!".repeat(100);
    console.error(`${bar}\nmain-gate: NOT CHECKED. ${why}.\nThe phone may now run old and new files together after this push. Run \`npm run skew\` on a machine with Playwright.\n${bar}`);
    return 0;
  }
  const out = fs.mkdtempSync(path.join(os.tmpdir(), "planner-main-gate-"));
  let failed = 0;
  try {
    for (const run of runsFor(from, to, out)) {
      console.log(`main-gate: ${run.name}`);
      const r = spawnSync(process.execPath, run.args, { cwd: ROOT, stdio: "inherit" });
      if (r.status !== 0) failed++;
    }
  } finally {
    fs.rmSync(path.join(out, "trees"), { recursive: true, force: true });   // keep the reports (small), drop the exported trees
  }
  console.log(failed ? `main-gate: FAILED: do not move main (reports in ${out})` : `main-gate: OK, main may move (reports in ${out})`);
  return failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));

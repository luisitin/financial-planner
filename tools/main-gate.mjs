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

/** Can this machine run the check (Playwright with its Chromium)? null when it can, else why not. */
export function cannotRun(load = () => createRequire(import.meta.url)("playwright")) {
  let pw;
  try { pw = load(); } catch { return "Playwright is not installed (npm i -D playwright, then npx playwright install chromium)"; }
  const chromium = (pw.default?.chromium ? pw.default : pw).chromium;
  try { if (!fs.existsSync(chromium.executablePath())) return "Playwright's Chromium is not installed (npx playwright install chromium)"; } catch { return "Playwright's Chromium is not installed (npx playwright install chromium)"; }
  return null;
}

function main(argv) {
  let [from, to] = argv;
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

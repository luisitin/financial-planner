// tools/install-hooks.mjs -- `npm run hooks`, once per clone: points git at .githooks/ and makes sure the hooks can run.
//
// git runs a hook only when its file is executable (mode 100755 in the repository): a hook committed as 100644 is
// skipped with one easily missed line of advice, so for a while the pre-push hook (the gate before main moves: the
// leak guard and tools/main-gate.mjs) never ran at all. This tool sets the mode on the files, and `hookProblems` (also
// run by `npm run check` and tests/main-gate.test.mjs) fails when the repository records a hook as anything else.
// On Windows the file mode is not kept and Git for Windows runs hooks whatever it says, so only the repository's own
// record is checked there.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const HOOKS_DIR = ".githooks";

/** What the repository records for each hook: { name, mode } from `git ls-files -s`, or null when this is no git checkout. */
export function recordedModes(root = ROOT, run = (args) => spawnSync("git", ["-C", root, ...args], { encoding: "utf8" })) {
  const r = run(["ls-files", "-s", "--", HOOKS_DIR]);
  if (!r || r.status !== 0) return null;
  return String(r.stdout).split("\n").filter(Boolean).map((line) => {
    const m = /^(\d+) [0-9a-f]+ \d+\t(.+)$/.exec(line);
    return m ? { name: m[2], mode: m[1] } : null;
  }).filter(Boolean);
}

/** The problems with the hooks: a hook not recorded as executable (100755), or (not on Windows) not executable on disk. [] when fine. */
export function hookProblems(root = ROOT, modes = recordedModes(root), platform = process.platform) {
  const out = [];
  if (!modes) return out;                                                    // no git checkout (an exported copy): nothing to enforce
  for (const { name, mode } of modes) {
    if (mode !== "100755") out.push(`${name}: recorded as ${mode}, so git never runs it. Fix: git update-index --chmod=+x ${name}`);
    else if (platform !== "win32") {
      try { if (!(fs.statSync(path.join(root, name)).mode & 0o111)) out.push(`${name}: not executable on disk (chmod +x ${name}, or npm run hooks)`); } catch { }
    }
  }
  return out;
}

function main() {
  const set = spawnSync("git", ["-C", ROOT, "config", "core.hooksPath", HOOKS_DIR], { encoding: "utf8" });
  if (set.status !== 0) { console.error("hooks: git config failed: " + String(set.stderr).trim()); return 1; }
  for (const f of fs.readdirSync(path.join(ROOT, HOOKS_DIR))) { try { fs.chmodSync(path.join(ROOT, HOOKS_DIR, f), 0o755); } catch { } }
  const problems = hookProblems(ROOT);
  if (problems.length) { console.error("hooks: git is pointed at .githooks, but\n  " + problems.join("\n  ")); return 1; }
  console.log("hooks: on (core.hooksPath = .githooks; pre-commit and pre-push are executable)");
  return 0;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main();

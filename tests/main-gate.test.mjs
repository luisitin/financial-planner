// tests/main-gate.test.mjs -- the gate before main moves (tools/main-gate.mjs, run by .githooks/pre-push): which checks
// it runs for a push, that the hook calls it for main only, and what it does on a machine that cannot run a browser.
// The checks themselves are browser runs (qa/flows/static-skew.mjs; tests/static-skew.test.mjs covers their parts).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { runsFor, cannotRun, waitProblem, lastMovedAt, WAIT_MINUTES } from "../tools/main-gate.mjs";
import { hookProblems, recordedModes } from "../tools/install-hooks.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OLD = "a2b9adc".padEnd(40, "0"), NEW = "5fb5363".padEnd(40, "1");

test("a push to main: the real pair (reopened from the home screen), then every synthetic shape on what is pushed", () => {
  const runs = runsFor(OLD, NEW, "/tmp/gate");
  assert.equal(runs.length, 2);
  assert.deepEqual(runs[0].args, ["qa/flows/static-skew.mjs", "--check", "--a", OLD, "--b", NEW, "--how", "reopen", "--out", path.join("/tmp/gate", "pair"), "--trees", path.join("/tmp/gate", "trees")]);
  assert.deepEqual(runs[1].args, ["qa/flows/static-skew.mjs", "--check", "--a", NEW, "--out", path.join("/tmp/gate", "synthetic"), "--trees", path.join("/tmp/gate", "trees")]);
  assert.match(runs[0].name, /a2b9adc -> 5fb5363/);
  // a new main (nothing before it): only the synthetic check; npm run skew with no origin/main: the working tree
  assert.equal(runsFor("0".repeat(40), NEW, "/tmp/gate").length, 1);
  assert.deepEqual(runsFor(null, "worktree", "/tmp/gate").map((r) => r.args.slice(0, 4)), [["qa/flows/static-skew.mjs", "--check", "--a", "worktree"]]);
});

test("the pre-push hook runs the gate for main only, after the leak guard, and refuses the push when it fails", () => {
  const hook = fs.readFileSync(path.join(REPO, ".githooks", "pre-push"), "utf8");
  assert.match(hook, /node tools\/leak-guard\.mjs --commits "\$range" \|\| exit 1/);
  assert.match(hook, /if \[ "\$remote_ref" = "refs\/heads\/main" \]; then\n\s+node tools\/main-gate\.mjs "\$remote_sha" "\$local_sha" <\/dev\/null \|\| exit 1/);
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO, "package.json"), "utf8"));
  assert.equal(pkg.scripts.skew, "node tools/main-gate.mjs");
  assert.equal(pkg.scripts.hooks, "node tools/install-hooks.mjs", "npm run hooks turns it on (and makes sure git can run the hooks)");
});

test("a machine without Playwright or its Chromium is told so (the gate then cannot look)", () => {
  assert.match(cannotRun(() => { throw new Error("Cannot find module 'playwright'"); }), /Playwright is not installed/);
  assert.match(cannotRun(() => ({ chromium: { executablePath: () => "/nowhere/chrome" } })), /Chromium is not installed/);
  assert.equal(cannotRun(() => ({ chromium: { executablePath: () => process.execPath } })), null, "a browser that is there");
});

test("the rule is written where every builder reads it before main moves", () => {
  const agents = fs.readFileSync(path.join(REPO, "AGENTS.md"), "utf8");
  assert.match(agents, /npm run skew/);
  assert.match(agents, /tools\/main-gate\.mjs/);
  const plan = fs.readFileSync(path.join(REPO, "docs", "PLAN.md"), "utf8");
  assert.match(plan, /tools\/main-gate\.mjs/);
});

// ---- 2026-11-07 follow-up R3: main does not move again within 11 minutes of the last push that changed the app
test("the wait: a push that changes the app is refused for 11 minutes after main last moved, with plain words and the way round", () => {
  assert.equal(WAIT_MINUTES, 11, "Pages' max-age is 10 minutes, plus one");
  const now = Date.UTC(2026, 10, 7, 12, 0, 0), min = 60000;
  const sha = "5fb5363".padEnd(40, "0");
  const words = waitProblem({ now, lastMoved: now - 4 * min, changed: ["docs/PLAN.md", "core/app.js"], from: sha });
  assert.match(words, /^main-gate: wait 7 more minutes\./);
  assert.match(words, /main last moved 4 minutes ago \(5fb5363\), and this push changes the app/);
  assert.match(words, /Push again at 12:07 UTC or later/);
  assert.match(waitProblem({ now, lastMoved: now - 20000, changed: ["sw.js"] }), /moved less than a minute ago/);
  assert.match(waitProblem({ now, lastMoved: now - 90000, changed: ["sw.js"] }), /moved 1 minute ago/);
  assert.match(waitProblem({ now, lastMoved: now - 20000, changed: ["sw.js"] }), /moved less than a minute ago/);
  assert.match(waitProblem({ now, lastMoved: now - 90000, changed: ["sw.js"] }), /moved 1 minute ago/);
  assert.match(words, /PLANNER_MAIN_WAIT=skip git push/, "the way round is written in the message");
  assert.match(waitProblem({ now, lastMoved: now - 10.5 * min, changed: ["sw.js"] }), /wait 1 more minute\./, "singular");
  assert.equal(waitProblem({ now, lastMoved: now - 11 * min, changed: ["core/app.js"] }), null, "11 minutes: free");
  assert.equal(waitProblem({ now, lastMoved: now - 11 * min + 1, changed: ["core/app.js"] }) === null, false, "one second short: still waits");
  // not the app: notes, tests and tools run on no phone
  assert.equal(waitProblem({ now, lastMoved: now - min, changed: ["docs/PLAN.md", "tests/a.test.mjs", "tools/x.mjs", "qa/flows/y.mjs", "CHANGELOG.md"] }), null);
  // a page file, the manifest and an icon are the app
  for (const rel of ["modules/overview/pages/view.js", "index.html", "manifest.webmanifest", "icon-180.png", "core/ui/base.css"]) assert.ok(waitProblem({ now, lastMoved: now - min, changed: [rel] }), rel);
  // unknown time (no clone history) and a clock set back never block
  assert.equal(waitProblem({ now, lastMoved: null, changed: ["core/app.js"] }), null);
  assert.equal(waitProblem({ now, lastMoved: now + 5 * min, changed: ["core/app.js"] }), null);
});

test("the wait reads git: the later of the commit's date and this clone's last push of it", () => {
  const sha = "a".repeat(40), other = "b".repeat(40);
  const answer = (log, reflog) => (args) => args[0] === "log" ? { status: 0, stdout: log } : { status: 0, stdout: reflog };
  // commit made at 1000 s, pushed from this clone at 5000 s: the push is what the phone could have seen
  assert.equal(lastMovedAt(sha, answer("1000\n", `${sha}\t5000\tupdate by push\n${other}\t900\tupdate by push\n`)), 5000 * 1000);
  // a fetch is not a push (pulling an old push must not block anyone for 11 minutes)
  assert.equal(lastMovedAt(sha, answer("1000\n", `${sha}\t5000\tfetch origin: fast-forward\n`)), 1000 * 1000);
  // a push of some other commit does not count for this one
  assert.equal(lastMovedAt(sha, answer("1000\n", `${other}\t5000\tupdate by push\n`)), 1000 * 1000);
  assert.equal(lastMovedAt(sha, () => ({ status: 128, stdout: "" })), null, "git cannot tell: no wait rather than a wrong one");
});

test("the wait runs in the hook path only, before the browser check, and has a documented override", () => {
  const src = fs.readFileSync(path.join(REPO, "tools", "main-gate.mjs"), "utf8");
  assert.match(src, /PLANNER_MAIN_WAIT === "skip"/);
  assert.match(src, /argv\.includes\("--no-wait"\)/);
  assert.ok(src.indexOf("waitProblem({ now") < src.indexOf("const why = cannotRun()"), "a wait costs nothing, so it comes first");
  assert.match(src, /to !== "worktree"/, "npm run skew by hand only checks, it moves nothing");
  const plan = fs.readFileSync(path.join(REPO, "docs", "PLAN.md"), "utf8");
  assert.match(plan, /PLANNER_MAIN_WAIT=skip/, "docs/PLAN.md names the override");
});

// ---- 2026-11-07 follow-up: git runs a hook only when it is executable, so the repository must record 100755
test("the hooks are executable in the repository (mode 100755): a 100644 hook is skipped and the gate never runs", () => {
  const modes = recordedModes(REPO);
  if (modes) {
    assert.deepEqual(modes.map((m) => m.name).sort(), [".githooks/pre-commit", ".githooks/pre-push"]);
    for (const m of modes) assert.equal(m.mode, "100755", `${m.name} must be recorded executable (git update-index --chmod=+x ${m.name})`);
  }
  assert.deepEqual(hookProblems(REPO), [], "nothing for npm run check to complain about");
  // the check itself: it names the fix, and it checks the disk too (not on Windows)
  const bad = hookProblems("/nowhere", [{ name: ".githooks/pre-push", mode: "100644" }, { name: ".githooks/pre-commit", mode: "100755" }], "linux");
  assert.equal(bad.length, 1, "only the 100644 one (a hook that cannot be read from disk is not reported)");
  assert.match(bad[0], /pre-push: recorded as 100644, so git never runs it\. Fix: git update-index --chmod=\+x \.githooks\/pre-push/);
  assert.deepEqual(hookProblems("/nowhere", [{ name: ".githooks/pre-commit", mode: "100755" }], "win32"), [], "Windows keeps no file mode: only the record counts");
  assert.deepEqual(hookProblems("/nowhere", null), [], "an exported copy (no git): nothing to enforce");
  assert.equal(recordedModes("/nowhere", () => ({ status: 128, stdout: "" })), null);
});

test("npm run hooks sets the path, makes the hooks executable and says when git still cannot run them", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(REPO, "package.json"), "utf8"));
  assert.equal(pkg.scripts.hooks, "node tools/install-hooks.mjs");
  assert.match(fs.readFileSync(path.join(REPO, "tools", "check.mjs"), "utf8"), /hookProblems\(ROOT\)/, "npm run check fails on a hook git would skip");
  // in a scratch repository: the right mode passes, 100644 is named
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || "/tmp"), "planner-hooks-"));
  try {
    const git = (...a) => spawnSync("git", ["-C", dir, ...a], { encoding: "utf8" });
    git("init", "-q"); fs.mkdirSync(path.join(dir, ".githooks")); fs.writeFileSync(path.join(dir, ".githooks", "pre-push"), "#!/bin/sh\nexit 0\n");
    git("add", ".githooks/pre-push");
    assert.match(hookProblems(dir)[0], /recorded as 100644/);
    git("update-index", "--chmod=+x", ".githooks/pre-push"); fs.chmodSync(path.join(dir, ".githooks", "pre-push"), 0o755);
    assert.deepEqual(hookProblems(dir), []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

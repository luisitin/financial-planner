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
  assert.match(words, /The app on main last changed 4 minutes ago \(main is at 5fb5363\), and this push changes it again/);
  assert.match(words, /Push again at \d\d:\d\d \(12:07 UTC\) or later/);
  assert.match(waitProblem({ now, lastMoved: now - 20000, changed: ["sw.js"] }), /changed less than a minute ago/);
  assert.match(waitProblem({ now, lastMoved: now - 90000, changed: ["sw.js"] }), /changed 1 minute ago/);
  assert.match(waitProblem({ now, lastMoved: now - 20000, changed: ["sw.js"] }), /changed less than a minute ago/);
  assert.match(waitProblem({ now, lastMoved: now - 90000, changed: ["sw.js"] }), /changed 1 minute ago/);
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

/** A scratch remote and a clone of it, with real git. `commit(file, minutesAgo)` makes a commit dated then; returns its id. */
function scratchRepos() {
  const dir = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || "/tmp"), "planner-gate-"));
  const remote = path.join(dir, "remote.git"), clone = path.join(dir, "clone");
  const env = { ...process.env, GIT_AUTHOR_NAME: "Tester", GIT_AUTHOR_EMAIL: "tester@example.com", GIT_COMMITTER_NAME: "Tester", GIT_COMMITTER_EMAIL: "tester@example.com", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null" };
  const run = (cwd, args, more = {}) => { const r = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8", env: { ...env, ...more } }); assert.equal(r.status, 0, `git ${args.join(" ")}: ${r.stderr}`); return r.stdout.trim(); };
  fs.mkdirSync(remote); run(remote, ["init", "-q", "--bare", "-b", "main"]);
  fs.mkdirSync(clone); run(clone, ["init", "-q", "-b", "main"]); run(clone, ["remote", "add", "origin", remote]);
  const commit = (rel, minutesAgo) => {
    const when = `${Math.floor(Date.now() / 1000) - minutesAgo * 60} +0000`;
    fs.mkdirSync(path.dirname(path.join(clone, rel)), { recursive: true });
    fs.appendFileSync(path.join(clone, rel), `${rel} ${minutesAgo}\n`);
    run(clone, ["add", "-A"]); run(clone, ["commit", "-q", "-m", `change ${rel}`], { GIT_AUTHOR_DATE: when, GIT_COMMITTER_DATE: when });
    return run(clone, ["rev-parse", "HEAD"]);
  };
  return { clone, commit, push: () => run(clone, ["push", "-q", "origin", "main"]), git: (args) => spawnSync("git", ["-C", clone, ...args], { encoding: "utf8", env }), done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

test("the wait reads when main was PUSHED, not when the commit was made: a commit two hours old, pushed just now, starts the wait (real git)", () => {
  const r = scratchRepos();
  try {
    const c1 = r.commit("core/app.js", 120);
    r.push();
    const now = Date.now(), moved = lastMovedAt(c1, r.git);
    assert.ok(Math.abs(now - moved) < 60000, `pushed seconds ago, read as ${Math.round((now - moved) / 60000)} minutes ago`);
    assert.match(waitProblem({ now, lastMoved: moved, changed: ["core/app.js"], from: c1 }), /^main-gate: wait 11 more minutes\./);
    // a notes-only push right after it changes nothing on the phone: the time that counts stays the app push
    const c2 = r.commit("docs/PLAN.md", 100);
    r.push();
    assert.ok(Math.abs(Date.now() - lastMovedAt(c2, r.git)) < 60000, "still the app push of a moment ago");
  } finally { r.done(); }
});

test("the wait counts from the last push that changed the APP: a notes-only push does not start it again", () => {
  const app = "a".repeat(40), notes = "b".repeat(40), first = "c".repeat(40);
  // newest first, as git prints the reflog of origin/main with --date=unix
  const reflog = [`${notes}\torigin/main@{9000}\tupdate by push`, `${app}\torigin/main@{5000}\tupdate by push`, `${first}\torigin/main@{100}\tfetch origin: storing head`].join("\n") + "\n";
  const files = { [`${app} ${notes}`]: "docs/PLAN.md\n", [`${first} ${app}`]: "core/app.js\ndocs/PLAN.md\n" };
  const git = (log) => (args) => args[0] === "log" ? { status: 0, stdout: log } : args[0] === "reflog" ? { status: 0, stdout: reflog } : args[0] === "diff" ? { status: 0, stdout: files[`${args[2]} ${args[3]}`] ?? "" } : { status: 1, stdout: "" };
  // the commits' own dates are old (1000 s and 900 s): only the pushes tell when the phone could first see them
  const log = "\x011000\ndocs/PLAN.md\n\x01900\ncore/app.js\n";
  assert.equal(lastMovedAt(notes, git(log)), 5000 * 1000, "the push of the app change (5000 s), not the notes push after it (9000 s)");
  // a fetch is not a push: an app change that came from another clone is known only by its commit's date
  const fetched = [`${app}\torigin/main@{7000}\tfetch origin: fast-forward`, `${first}\torigin/main@{100}\tupdate by push`].join("\n") + "\n";
  const git2 = (args) => args[0] === "log" ? { status: 0, stdout: "\x013000\ncore/app.js\n" } : args[0] === "reflog" ? { status: 0, stdout: fetched } : args[0] === "diff" ? { status: 0, stdout: "docs/x.md\n" } : { status: 1, stdout: "" };
  assert.equal(lastMovedAt(app, git2), 3000 * 1000);
  assert.equal(lastMovedAt(app, () => ({ status: 128, stdout: "" })), null, "git cannot tell: no wait rather than a wrong one");
});

test("the refusal can be acted on in any terminal: local time next to UTC, and the way round for Git Bash, PowerShell and the Command Prompt", () => {
  const now = Date.UTC(2026, 10, 7, 12, 0, 0);
  const words = waitProblem({ now, lastMoved: now - 4 * 60000, changed: ["core/app.js"], local: () => "07:07" });
  assert.match(words, /Push again at 07:07 \(12:07 UTC\) or later/);
  assert.match(words, /PLANNER_MAIN_WAIT=skip git push/);
  assert.match(words, /PowerShell: +\$env:PLANNER_MAIN_WAIT="skip"; git push; \$env:PLANNER_MAIN_WAIT=""/);
  assert.match(words, /Command Prompt: +set PLANNER_MAIN_WAIT=skip& git push& set PLANNER_MAIN_WAIT=/);
  assert.match(words, /node tools\/main-gate\.mjs --no-wait/);
});

test("a push that changes the worker, the page or the shell also runs the saved-copy scenarios (qa/flows/static-stall.mjs)", () => {
  for (const rel of ["sw.js", "index.html", "core/heal.js", "core/app.js"]) {
    const runs = runsFor(OLD, NEW, "/tmp/gate", ["docs/PLAN.md", rel]);
    assert.equal(runs.length, 3, rel);
    assert.deepEqual(runs[2].args, ["qa/flows/static-stall.mjs", "--out", path.join("/tmp/gate", "stall"), "--a", NEW]);
  }
  assert.equal(runsFor(OLD, NEW, "/tmp/gate", ["modules/overview/pages/view.js", "core/store.js"]).length, 2, "any other change: the two skew checks only");
  assert.equal(runsFor(null, "worktree", "/tmp/gate", ["sw.js"]).length, 2, "by hand on the working tree: the synthetic check and the saved-copy scenarios");
  const src = fs.readFileSync(path.join(REPO, "tools", "main-gate.mjs"), "utf8");
  assert.match(src, /runsFor\(from, to, out, changed\)/, "the gate passes what the push changes");
});

test("npm run check says when the hooks are not switched on in this clone, or the gate's hook is missing", () => {
  const both = [{ name: ".githooks/pre-commit", mode: "100755" }, { name: ".githooks/pre-push", mode: "100755" }];
  assert.deepEqual(hookProblems("/nowhere", both, "win32", ".githooks"), []);
  assert.match(hookProblems("/nowhere", both, "win32", "")[0], /git is not pointed at \.githooks in this clone.*npm run hooks/);
  assert.match(hookProblems("/nowhere", both, "win32", ".git/hooks")[0], /npm run hooks/);
  assert.match(hookProblems("/nowhere", [both[0]], "win32", ".githooks")[0], /\.githooks\/pre-push is missing/);
  assert.match(hookProblems("/nowhere", [], "win32", ".githooks").join("\n"), /pre-push is missing/);
  assert.deepEqual(hookProblems("/nowhere", null, "win32", ""), [], "an exported copy (no git): nothing to enforce");
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
  assert.deepEqual(hookProblems(REPO, modes, process.platform, ".githooks"), [], "nothing for npm run check to complain about (once npm run hooks was run in this clone)");
  // the check itself: it names the fix, and it checks the disk too (not on Windows)
  const bad = hookProblems("/nowhere", [{ name: ".githooks/pre-push", mode: "100644" }, { name: ".githooks/pre-commit", mode: "100755" }], "linux");
  assert.equal(bad.length, 1, "only the 100644 one (a hook that cannot be read from disk is not reported)");
  assert.match(bad[0], /pre-push: recorded as 100644, so git never runs it\. Fix: git update-index --chmod=\+x \.githooks\/pre-push/);
  assert.deepEqual(hookProblems("/nowhere", [{ name: ".githooks/pre-commit", mode: "100755" }, { name: ".githooks/pre-push", mode: "100755" }], "win32", ".githooks"), [], "Windows keeps no file mode: only the record counts");
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
    assert.match(hookProblems(dir).join("\n"), /recorded as 100644/);
    git("update-index", "--chmod=+x", ".githooks/pre-push"); fs.chmodSync(path.join(dir, ".githooks", "pre-push"), 0o755);
    assert.match(hookProblems(dir).join("\n"), /git is not pointed at \.githooks in this clone/, "a fresh clone: git runs no hook until npm run hooks");
    git("config", "core.hooksPath", ".githooks");
    assert.deepEqual(hookProblems(dir), []);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// tests/main-gate.test.mjs -- the gate before main moves (tools/main-gate.mjs, run by .githooks/pre-push): which checks
// it runs for a push, that the hook calls it for main only, and what it does on a machine that cannot run a browser.
// The checks themselves are browser runs (qa/flows/static-skew.mjs; tests/static-skew.test.mjs covers their parts).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runsFor, cannotRun } from "../tools/main-gate.mjs";

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
  assert.equal(pkg.scripts.hooks, "git config core.hooksPath .githooks", "npm run hooks turns it on");
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

// tests/live-check.test.mjs -- tools/live-check.mjs's pure parts: the arguments (the kept profile must live outside the
// app's folder), which bytes the site should serve, the comparison with the site, the pages to visit and the one-line
// verdict. No browser and no network: the site is a pretend fetch.
import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { parseArgs, differences, pagesOf, verdict, expected, walk, DEFAULT_URL, ALWAYS, touchesApp, isPcApi, secureUrl } from "../tools/live-check.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha1 = (s) => crypto.createHash("sha1").update(s).digest("hex");

test("arguments: the live site by default; a kept profile outside the app's folder; a dry run needs none", () => {
  assert.equal(DEFAULT_URL, "https://luisitin.github.io/financial-planner/");
  const o = parseArgs(["--profile", "/tmp/lc-profile", "--from", "abc123"]);
  assert.equal(o.url, DEFAULT_URL);
  assert.equal(o.profile, path.resolve("/tmp/lc-profile"));
  assert.equal(o.from, "abc123");
  assert.equal(o.ref, "HEAD");
  assert.equal(o.timeout, 15, "gives up after 15 minutes");
  assert.equal(parseArgs(["--dry-run", "--from", "abc123"]).dryRun, true);
  assert.equal(parseArgs(["--dry-run", "--from", "abc123", "--url", "http://127.0.0.1:9020/financial-planner"]).url, "http://127.0.0.1:9020/financial-planner/");
  assert.throws(() => parseArgs([]), /--profile <dir> is required/);
  // main moves by several commits per push: "the commit before" (<ref>~1) would miss files, so --from has no default
  assert.throws(() => parseArgs(["--profile", "/tmp/lc-profile"]), /--from <rev> is required/);
  assert.throws(() => parseArgs(["--dry-run"]), /--from <rev> is required/);
  assert.throws(() => expected({ ref: "HEAD" }), /--from <rev> is required/);
  // right before the push: only the kept profile opens the site as it is now; nothing to compare
  const prime = parseArgs(["--profile", "/tmp/lc-profile", "--prime"]);
  assert.equal(prime.prime, true);
  assert.equal(prime.from, null);
  assert.equal(parseArgs(["--profile", "/tmp/p", "--from", "x", "--walk"]).walk, true);
  assert.throws(() => parseArgs(["--profile", path.join(REPO, "shots", "p")]), /outside the app's folder/);
  assert.throws(() => parseArgs(["--profile", "/tmp/p", "--url", "ftp://x/"]), /http\(s\)/);
  assert.throws(() => parseArgs(["--profile", "/tmp/p", "--timeout", "-1"]), /minutes/);
  assert.throws(() => parseArgs(["--profile"]), /needs a value/);
  assert.throws(() => parseArgs(["--nope"]), /unknown option/);
});

test("what the site should serve: the shell, page list, worker, manifest and styles, and every changed file", () => {
  assert.deepEqual(ALWAYS, ["core/app.js", "modules/registry.js", "index.html", "sw.js", "manifest.webmanifest", "core/ui/base.css"]);
  const head = expected({ ref: "HEAD", from: "HEAD" });
  const have = ALWAYS.filter((rel) => spawnSync("git", ["-C", REPO, "cat-file", "-e", `HEAD:${rel}`]).status === 0);
  assert.deepEqual(head.map((f) => f.rel), have, "nothing changed between HEAD and HEAD: the files that always count (those HEAD has)");
  for (const f of head) { assert.match(f.sha, /^[0-9a-f]{40}$/); assert.equal(f.changed, false); }
  // the working tree against HEAD: whatever is new or edited is compared too, never a dotfile (the app loads none)
  const work = expected({ ref: "worktree", from: "HEAD" });
  assert.ok(work.every((f) => !f.rel.split("/").some((seg) => seg.startsWith("."))), "no .nojekyll, .githooks/..., .claude/...");
  assert.throws(() => expected({ ref: "/no/such/folder", from: "HEAD" }), /no such folder/);
});

test("the comparison: same bytes, another version, missing, gone as it should be, no answer", async () => {
  const site = { "core/app.js": "new app", "modules/registry.js": "old registry", "docs/x.md": null, "gone.js": null, "sw.js": "worker", "README.md": "# hi" };
  const JS = { "Content-Type": "application/javascript; charset=utf-8" };
  const fetchImpl = async (u) => {
    const rel = new URL(u).pathname.replace(/^\/financial-planner\//, "");
    if (rel === "down.js") throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } });
    if (rel === "error.js") return new Response("x", { status: 503 });
    if (rel === "sw.js") return new Response(site[rel], { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });   // a host's error page, say
    const body = site[rel];
    return body == null ? new Response("404", { status: 404 }) : new Response(body, { status: 200, headers: /\.js$/.test(rel) ? JS : { "Content-Type": "text/markdown" } });
  };
  const want = [
    { rel: "core/app.js", sha: sha1("new app") }, { rel: "modules/registry.js", sha: sha1("new registry") },
    { rel: "docs/x.md", sha: sha1("doc") }, { rel: "gone.js", sha: null }, { rel: "down.js", sha: sha1("x") }, { rel: "error.js", sha: sha1("x") },
    { rel: "sw.js", sha: sha1("worker") }, { rel: "README.md", sha: sha1("# hi") },
  ];
  const diff = await differences("https://example.test/financial-planner/", want, { fetchImpl });
  assert.deepEqual(diff, [
    { rel: "docs/x.md", want: "this version", got: "missing (404)" },
    { rel: "down.js", want: "this version", got: "no answer (ECONNRESET)" },
    { rel: "error.js", want: "this version", got: "HTTP 503" },
    { rel: "modules/registry.js", want: "this version", got: "another version" },
    { rel: "sw.js", want: "this version", got: "the wrong type (text/html; charset=utf-8): a browser will not run it" },
  ]);
});

test("what counts: pages are opened only when the push changed the app; /api/ only at the root; secure addresses", () => {
  assert.equal(touchesApp(["docs/PLAN.md", "CHANGELOG.md", "qa/flows/x.mjs", "tests/a.test.mjs"]), false, "a docs-only push: nothing a page shows changed");
  for (const rel of ["core/app.js", "modules/overview/pages/view.js", "index.html", "sw.js", "manifest.webmanifest", "core/ui/base.css", "icon-180.png"]) assert.equal(touchesApp(["docs/PLAN.md", rel]), true, rel);
  assert.equal(isPcApi("/api/health"), true);
  assert.equal(isPcApi("/financial-planner/modules/x/api/y.js"), false, "a folder called api inside the app: a real failure");
  assert.equal(secureUrl("https://someone.github.io/financial-planner/"), true);
  assert.equal(secureUrl("http://127.0.0.1:9020/financial-planner/"), true, "this machine: a secure context");
  assert.equal(secureUrl("http://the-pc.local:8787/"), false, "the PC by its name on the home network, over http: no service worker possible");
});

test("the pages: every entry of the registry", () => {
  const src = fs.readFileSync(path.join(REPO, "modules", "registry.js"), "utf8");
  const pages = pagesOf(src);
  assert.equal(pages.length, (src.match(/load: \(\) => import\(/g) ?? []).length);
  assert.ok(pages.includes("overview/pages") && pages.includes("system/settings") && pages.includes("system/docs"));
  assert.ok(pages.every((p) => /^[a-z0-9-]+\/[a-z0-9-]+$/.test(p)));
});

test("the verdict: one line, OK or FAIL, then the problems by profile", () => {
  const ok = verdict({ url: "https://x/", pages: 161, runs: [{ name: "kept profile", problems: [], apiMisses: 12 }, { name: "fresh profile", problems: [], apiMisses: 12 }] });
  assert.equal(ok.ok, true);
  assert.equal(ok.line, "live-check: OK https://x/: 161 pages x 2 profile(s) (kept profile, then fresh profile): no red notice, no page error, no failed request (24 PC-address 404s, expected with no PC)");
  // --prime opens the kept profile only, and says so
  const prime = verdict({ url: "https://x/", pages: 161, runs: [{ name: "kept profile (before the push)", problems: [], apiMisses: 0 }] });
  assert.equal(prime.line, "live-check: OK https://x/: 161 pages x 1 profile(s) (kept profile (before the push)): no red notice, no page error, no failed request");
  const bad = verdict({ url: "https://x/", pages: 161, runs: [{ name: "kept profile", problems: ["overview/pages: red notice \"This page could not open.\""], apiMisses: 0 }, { name: "fresh profile", problems: [], apiMisses: 0 }] });
  assert.equal(bad.ok, false);
  assert.match(bad.line, /^live-check: FAIL https:\/\/x\/: 1 problem\(s\) over 161 pages x 2 profiles$/);
  assert.deepEqual(bad.problems, ["kept profile: overview/pages: red notice \"This page could not open.\""]);
});

/** A pretend Playwright: one page whose screen is `state(n)` on the n-th look, and whether the worker controls it. */
function pretendBrowser({ state = () => ({ red: [], stuck: false, empty: false, worker: false }), throwOn = null } = {}) {
  const seen = { closed: 0, goto: [], reloads: 0, looks: 0 };
  const page = {
    on() { }, async goto(u) { seen.goto.push(u); }, async reload() { seen.reloads++; },
    async waitForFunction() { }, async waitForLoadState() { }, async waitForTimeout() { },
    async evaluate(fn, arg) {
      if (arg !== undefined) { if (throwOn && arg === throwOn) throw new Error("the browser crashed"); return undefined; }   // location.hash = ...
      return state(seen.looks++, seen);
    },
  };
  const ctx = { pages: () => [page], async newPage() { return page; }, async close() { seen.closed++; } };
  return { chromium: { async launchPersistentContext() { return ctx; } }, seen };
}

test("the walk: every page, then one reload that must be under the worker; the browser is always closed", async () => {
  const opts = { name: "kept profile", profile: "/tmp/lc-x", url: "https://x/financial-planner/", pages: ["overview/dashboard", "system/settings"], query: "" };
  // first open uncontrolled (sw.js never claims), the reload controlled: OK
  const good = pretendBrowser({ state: (n, seen) => ({ red: [], stuck: false, empty: false, worker: seen.reloads > 0 }) });
  const r1 = await walk(good.chromium, { ...opts, expectWorker: true });
  assert.deepEqual(r1.problems, []);
  assert.equal(r1.worker, true);
  assert.equal(good.seen.reloads, 1);
  assert.equal(good.seen.closed, 1, "the browser is closed: an open one kept live-check --prime running for ever (2026-11-07)");
  // never under the worker: a problem where one is expected (https and the site has sw.js), none elsewhere
  const none = pretendBrowser();
  assert.match((await walk(none.chromium, { ...opts, expectWorker: true })).problems.join(" "), /service worker \(sw\.js\) is not answering/);
  assert.deepEqual((await walk(pretendBrowser().chromium, opts)).problems, []);
  // what the reload shows counts too
  const redAfter = pretendBrowser({ state: (n, seen) => ({ red: seen.reloads ? ["Some pages could not open. Reload to try again."] : [], stuck: false, empty: false, worker: true }) });
  assert.match((await walk(redAfter.chromium, opts)).problems.join(" "), /\(reload\): red notice "Some pages could not open/);
  // a page that draws nothing, one stuck on the opening screen
  const empty = pretendBrowser({ state: (n) => ({ red: [], stuck: n === 0, empty: n === 1, worker: true }) });
  const pe = (await walk(empty.chromium, opts)).problems;
  assert.ok(pe.includes('overview/dashboard: the app never drew (still "Opening your plan...")'), pe.join("; "));
  assert.ok(pe.includes("system/settings: the page drew nothing"), pe.join("; "));
  // the browser is closed even when the walk fails half-way
  const crash = pretendBrowser({ state: () => { throw new Error("the browser crashed"); } });
  await assert.rejects(walk(crash.chromium, opts), /crashed/);
  assert.equal(crash.seen.closed, 1);
});

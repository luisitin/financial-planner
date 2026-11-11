// tests/static-skew.test.mjs -- the GitHub-Pages-like server in qa/flows/static-skew.mjs behaves like the real one, so its
// reproduction of the phone running old and new files at once (the owner, 2026-11-07) can be trusted: files under the
// /financial-planner/ subpath, max-age + ETag + Last-Modified, 304 when unchanged, 404 for what Jekyll drops (unless
// .nojekyll), no import map, a deploy changes every ETag, and the CDN's Age header follows the configured ages and the purge.
// Also the --check mode's pure parts: the synthetic deploy (both shapes of the 2026-11-07 failure) and the verdict.
// Runs on tiny trees in a temporary folder; no browser.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pagesServer, BASE, syntheticShellChange, syntheticOld, shapesOf, SHAPES, CHECK_CDN, checkVerdict, isPcApi, TRANSITION_OLD_OK } from "../qa/flows/static-skew.mjs";

function tree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "planner-skew-"));
  for (const [rel, text] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); }
  return root;
}
const INDEX = '<!doctype html><script type="module" src="./core/app.js"></script>\n';

test("static skew server: subpath, caching headers, 304, Jekyll drops, a deploy, no import map", async () => {
  const a = tree({ "index.html": INDEX, "core/app.js": "export const v = 'A';\n", "modules/_template/view.js": "x", "README.md": "# hi\n" });
  const b = tree({ "index.html": INDEX, "core/app.js": "export const v = 'B', added = 1;\n", "modules/_template/view.js": "x", ".nojekyll": "" });
  const srv = pagesServer({ trees: [{ dir: a, label: "A" }, { dir: b, label: "B" }], maxAge: 600 });
  const port = await srv.listen(0);
  const get = (p, headers = {}) => fetch(`http://127.0.0.1:${port}${p}`, { headers, redirect: "manual" });
  try {
    assert.equal((await get("/financial-planner")).status, 301);
    assert.equal((await get("/README.md")).status, 404, "the domain root is not the site: only the subpath is served");
    const index = await get(BASE);
    assert.equal(index.status, 200);
    assert.equal(await index.text(), INDEX, "index.html is sent as it is: no import map");
    const app = await get(`${BASE}core/app.js`);
    assert.equal(app.headers.get("cache-control"), "max-age=600");
    assert.match(app.headers.get("content-type"), /javascript/);
    const etag = app.headers.get("etag");
    assert.match(etag, /^"[0-9a-f]+-[0-9a-f]+"$/);
    assert.ok(app.headers.get("last-modified"));
    assert.equal(app.headers.get("age"), null, "no CDN model: no Age header");
    assert.equal(app.headers.get("access-control-allow-origin"), "*", "like GitHub Pages: a sandboxed frame (origin null) can load the modules");
    assert.equal((await get(`${BASE}core/app.js`, { "If-None-Match": etag })).status, 304);
    assert.equal((await get(`${BASE}modules/_template/view.js`)).status, 404, "Jekyll drops names starting with _");
    assert.equal((await get(`${BASE}README.md`)).status, 200);
    assert.equal(srv.deploy().label, "B");
    const after = await get(`${BASE}core/app.js`, { "If-None-Match": etag });
    assert.equal(after.status, 200, "a deploy rewrites every file: the old ETag no longer matches");
    assert.match(await after.text(), /'B'/);
    assert.notEqual(after.headers.get("etag"), etag);
    assert.equal((await get(`${BASE}modules/_template/view.js`)).status, 200, "with .nojekyll nothing is dropped");
  } finally { await srv.close(); fs.rmSync(a, { recursive: true, force: true }); fs.rmSync(b, { recursive: true, force: true }); }
});

test("static skew server: CDN ages by path prefix, Expires to match, purge on deploy", async () => {
  const a = tree({ "index.html": INDEX, "core/app.js": "A\n", "modules/x/view.js": "A\n" });
  const b = tree({ "index.html": INDEX, "core/app.js": "B\n", "modules/x/view.js": "B\n" });
  const srv = pagesServer({ trees: [{ dir: a, label: "A" }, { dir: b, label: "B" }], maxAge: 600, cdn: "*=0,modules/=590" });
  const port = await srv.listen(0);
  const get = (p) => fetch(`http://127.0.0.1:${port}${BASE}${p}`);
  try {
    const core = await get("core/app.js"), page = await get("modules/x/view.js");
    assert.ok(Number(core.headers.get("age")) <= 1);
    assert.ok(Number(page.headers.get("age")) >= 590, "a file the edge cached long ago reaches the browser with little freshness left");
    const left = (Date.parse(page.headers.get("expires")) - Date.now()) / 1000;
    assert.ok(left > 0 && left <= 11, `Expires follows the edge copy (${left}s left)`);
    srv.deploy();
    const fresh = await get("modules/x/view.js");
    assert.ok(Number(fresh.headers.get("age")) <= 1, "the deploy purges the edge");
    assert.equal(await fresh.text(), "B\n");
  } finally { await srv.close(); fs.rmSync(a, { recursive: true, force: true }); fs.rmSync(b, { recursive: true, force: true }); }
});

test("static skew server: without the purge, the edge keeps serving the old copy until it expires", async () => {
  const a = tree({ "index.html": INDEX, "core/app.js": "A\n" });
  const b = tree({ "index.html": INDEX, "core/app.js": "B\n" });
  const srv = pagesServer({ trees: [{ dir: a, label: "A" }, { dir: b, label: "B" }], maxAge: 600, cdn: "*=0", purge: false });
  const port = await srv.listen(0);
  try {
    assert.equal(await (await fetch(`http://127.0.0.1:${port}${BASE}core/app.js`)).text(), "A\n");
    srv.deploy();
    assert.equal(await (await fetch(`http://127.0.0.1:${port}${BASE}core/app.js`)).text(), "A\n");
  } finally { await srv.close(); fs.rmSync(a, { recursive: true, force: true }); fs.rmSync(b, { recursive: true, force: true }); }
});

test("static skew server: --flaky drops the connection for the files named, with no answer, from the moment it is set", async () => {
  const a = tree({ "index.html": INDEX, "core/app.js": "A\n", "core/format.js": "A\n" });
  const log = [];
  const srv = pagesServer({ trees: [{ dir: a, label: "A" }], maxAge: 600, log });
  const port = await srv.listen(0);
  const get = (p) => fetch(`http://127.0.0.1:${port}${BASE}${p}`);
  try {
    assert.equal((await get("core/app.js")).status, 200, "answered until it is set");
    srv.drop = ["core/app.js"];
    await assert.rejects(get("core/app.js"), /fetch failed/, "a patchy network: the connection closes with no answer");
    assert.equal((await get("core/format.js")).status, 200, "the other files are answered");
    assert.equal(log.find((l) => l.status === "dropped")?.path, `${BASE}core/app.js`, "the log says which files got no answer");
    srv.drop = [];
    assert.equal((await get("core/app.js")).status, 200);
  } finally { await srv.close(); fs.rmSync(a, { recursive: true, force: true }); }
});

test("check: the synthetic deploy changes the shell, a core file and All pages, in the shapes that broke the phone", () => {
  const app = "function makeCtx(route) {\n  return {\n    route,\n    openSearch,\n    announce,\n  };\n}\n";
  const pages = 'import { PHASES, phaseOf } from "../../../core/phases.js";\nimport { matches } from "../../../core/search.js";\n\nexport function render(root, ctx) {\n  const build = ctx.view.build;\n}\n';
  const tax = "export const FILING_STATUSES = [];\n";
  const a = tree({ "core/app.js": app, "modules/overview/pages/view.js": pages, "core/math/tax.js": tax, "index.html": INDEX });
  const into = `${a}-synthetic`;
  try {
    const b = syntheticShellChange(a, into, "both");
    assert.equal(b.dir, into);
    const read = (rel) => fs.readFileSync(path.join(into, rel), "utf8");
    assert.match(read("core/app.js"), /skewProbe: \{ build: true \}/, "the shell gives every page a new ctx field");
    assert.match(read("core/math/tax.js"), /export const SKEW_PROBE = true;/, "a core file pages import gains an export");
    assert.match(read("modules/overview/pages/view.js"), /import \{ SKEW_PROBE \} from "..\/..\/..\/core\/math\/tax.js";/);
    assert.match(read("modules/overview/pages/view.js"), /const probe = ctx\.skewProbe\.build && SKEW_PROBE;/, "All pages needs both");
    assert.equal(fs.readFileSync(path.join(a, "core/app.js"), "utf8"), app, "A is left as it is");
    assert.equal(read("index.html"), INDEX, "everything else is the same");
    // one shape at a time
    syntheticShellChange(a, into, "ctx");
    assert.doesNotMatch(read("modules/overview/pages/view.js"), /SKEW_PROBE/);
    assert.match(read("modules/overview/pages/view.js"), /const probe = ctx\.skewProbe\.build;/);
    assert.equal(read("core/math/tax.js"), tax);
    syntheticShellChange(a, into, "export");
    assert.equal(read("core/app.js"), app);
    assert.throws(() => syntheticShellChange(a, into, "nope"), /--shape is all, both, or any of/);
    // the check must never pass by changing nothing: files that no longer look as expected stop it
    fs.writeFileSync(path.join(a, "core/app.js"), "export {};\n");
    assert.throws(() => syntheticShellChange(a, into, "both"), /core\/app\.js has no single/);
  } finally { fs.rmSync(a, { recursive: true, force: true }); fs.rmSync(into, { recursive: true, force: true }); }
});

test("check: every shape that can mix, by default -- the reverse (an export dropped), a style, worker and page change", () => {
  assert.deepEqual(SHAPES, ["ctx", "export", "reverse", "css", "sw", "index"]);
  assert.deepEqual(shapesOf(), SHAPES, "the check runs them all");
  assert.deepEqual(shapesOf("both"), ["ctx", "export"]);
  assert.deepEqual(shapesOf("ctx,reverse"), ["ctx", "reverse"]);
  assert.throws(() => shapesOf("nope"), /--shape is all, both, or any of/);
  assert.throws(() => shapesOf(""), /--shape/);
  const app = "function makeCtx(route) {\n  return {\n    openSearch,\n  };\n}\n";
  const pages = 'import { matches } from "../../../core/search.js";\nexport function render(root, ctx) {\n  const build = ctx.view.build;\n}\n';
  const settings = 'import { conn } from "../../../core/api.js";\nexport function render() {}\n';
  const format = "export const money = (n) => String(n);\n";
  const a = tree({ "core/app.js": app, "modules/overview/pages/view.js": pages, "core/math/tax.js": "export const FILING_STATUSES = [];\n", "core/format.js": format,
    "modules/system/settings/view.js": settings, "core/ui/base.css": "body { margin: 0 }\n", "sw.js": "self.addEventListener('install', () => {});\n", "index.html": `${INDEX}<body></body>\n` });
  const intoB = `${a}-b`, intoA = `${a}-a`;
  try {
    const b = syntheticShellChange(a, intoB);
    const old = syntheticOld(a, intoA);
    const rb = (rel) => fs.readFileSync(path.join(b.dir, rel), "utf8"), ra = (rel) => fs.readFileSync(path.join(old.dir, rel), "utf8");
    // reverse: A' has an export Settings imports; B' has neither (an old Settings next to a new core/format.js cannot link)
    assert.match(ra("core/format.js"), /^export const SKEW_GONE = true;/m);
    assert.match(ra("modules/system/settings/view.js"), /import \{ SKEW_GONE \} from "..\/..\/..\/core\/format.js";/);
    assert.equal(rb("core/format.js"), format);
    assert.equal(rb("modules/system/settings/view.js"), settings);
    assert.equal(ra("core/app.js"), app, "A' changes nothing else");
    // the style and the worker change too, with nothing else in them
    assert.equal(rb("core/ui/base.css"), "body { margin: 0 }\n/* synthetic change (qa/flows/static-skew.mjs --check) */\n");
    assert.match(rb("sw.js"), /\n\/\/ synthetic change/);
    assert.equal(rb("index.html"), `${INDEX}<body><!-- synthetic change (qa/flows/static-skew.mjs --check) -->\n</body>\n`, "the page itself, nothing else in it");
    assert.match(rb("core/app.js"), /skewProbe/);
    assert.match(rb("modules/overview/pages/view.js"), /ctx\.skewProbe\.build && SKEW_PROBE/);
    // the ages that make each shape bite without the worker: the reverse pair the other way round from the rest
    assert.equal(CHECK_CDN, "*=0,modules/=590,core/format.js=590,modules/system/settings/=0");
    // a tree whose files moved on: stop rather than pass by changing nothing
    fs.writeFileSync(path.join(a, "modules/system/settings/view.js"), "export function render() {}\n");
    assert.throws(() => syntheticOld(a, intoA), /settings\/view\.js has no single/);
    assert.throws(() => syntheticShellChange(a, intoB, "reverse"), /settings\/view\.js has no single/);
    fs.writeFileSync(path.join(a, "index.html"), INDEX);
    assert.throws(() => syntheticShellChange(a, intoB, "index"), /index\.html has no single <\/body>/);
    fs.rmSync(path.join(a, "sw.js"));
    assert.throws(() => syntheticShellChange(a, intoB, "sw"), /there is no sw\.js \(never delete it/);
  } finally { for (const d of [a, intoA, intoB]) fs.rmSync(d, { recursive: true, force: true }); }
});

test("check: only /api/ at the domain root is the PC's (the app asks for none on a static site); a folder called api inside the app is not", () => {
  assert.equal(isPcApi("/api/health"), true);
  assert.equal(isPcApi("https://someone.github.io/api/plan?x=1"), true);
  assert.equal(isPcApi("/financial-planner/modules/x/api/y.js"), false, "one of the app's files: a 404 is a real failure");
  assert.equal(isPcApi("/financial-planner/api/plan"), false);
  assert.equal(isPcApi("/financial-planner/core/app.js"), false);
});

test("check: the verdict fails on a red notice, a page error, a failed request or B not running whole", () => {
  const visit = (route, more = {}) => ({ route, notices: [], stuck: false, bootFailed: false, ...more });
  const report = (over = {}) => ({
    phaseA: { visits: [visit("(open)")] },
    phaseB: { visits: [visit("(reload)"), visit("overview/pages")], changedRanOld: 0, sample: { old: [] }, shell: "network (B)" },
    again: [], pageerrors: [], failed: [], ...over,
  });
  assert.deepEqual(checkVerdict(report()), { ok: true, problems: [], warnings: [] });
  const red = report(); red.phaseB.visits[1].notices.push({ text: "This page could not open." });
  assert.match(checkVerdict(red).problems[0], /red notice \(after the deploy, overview\/pages\): This page could not open\./);
  const firstVisit = report(); firstVisit.phaseA.visits[0].notices.push({ text: "Some pages could not open. Reload to try again." });
  assert.equal(checkVerdict(firstVisit).ok, false, "a red notice before the deploy counts too");
  assert.equal(checkVerdict(report({ pageerrors: [{ visit: "B (reload)", text: "SyntaxError: x" }] })).ok, false);
  assert.equal(checkVerdict(report({ failed: [{ visit: "B (reload)", url: "/financial-planner/core/app.js", why: "HTTP 500" }] })).ok, false);
  // 2026-11-07: the app asks for no PC address on a static site; the version being checked (B) must not, an old A may
  const api = checkVerdict(report({ failedApiList: [{ visit: "B (open)", url: "/api/health", why: "HTTP 404" }] }));
  assert.equal(api.ok, false);
  assert.match(api.problems[0], /the app asked the site for a PC address \(B \(open\)\): \/api\/health HTTP 404/);
  const oldApi = checkVerdict(report({ failedApiList: [{ visit: "A (open)", url: "/api/health", why: "HTTP 404" }] }));
  assert.equal(oldApi.ok, true, "the old version being replaced may still ask");
  assert.match(oldApi.warnings[0], /asked the site for a PC address/);
  const old = report(); old.phaseB.changedRanOld = 2; old.phaseB.sample.old = ["core/app.js", "core/math/tax.js"]; old.phaseB.shell = "cache (A)";
  assert.match(checkVerdict(old).problems[0], /^B-not-running: 2 changed file\(s\) ran their old copy \(core\/app\.js, core\/math\/tax\.js\)/);
  const stuck = report(); stuck.phaseB.visits[0].stuck = true;
  assert.match(checkVerdict(stuck).problems[0], /B-not-running .*stuck on the opening screen/);
  const again = report({ again: [{ wait: 0, visits: [visit("system/settings", { bootFailed: true })] }] });
  assert.match(checkVerdict(again).problems[0], /reload after 0s.*the app could not open/);
  // the push that ships the worker (A has no sw.js): old files that ran are warnings, anything the household sees fails
  const transition = report({ config: { transition: true } }); transition.phaseB.changedRanOld = 1; transition.phaseB.sample.old = ["core/app.js"];
  const tv = checkVerdict(transition);
  assert.equal(tv.ok, true);
  assert.match(tv.warnings[0], /^B-not-running: 1 changed file\(s\) ran their old copy \(core\/app\.js\)/);
  assert.match(tv.warnings[1], /push nothing else for 10 minutes/);
  // ... but only the old shell may run old: another file that ran old next to new ones fails it, red notice or not
  // (5fb5363 -> the working branch with sw.js: old core/math/tax.js and retirement.js under new pages, no red notice)
  const carried = report({ config: { transition: true } });
  Object.assign(carried.phaseB, { changedRanOld: 4, changedRanNew: 39, oldFiles: ["index.html", "core/app.js", "core/math/tax.js", "core/math/retirement.js"], sample: { old: ["index.html", "core/app.js", "core/math/tax.js", "core/math/retirement.js"] } });
  const cv = checkVerdict(carried);
  assert.equal(cv.ok, false);
  assert.match(cv.problems[0], /^MIXED on the push that ships sw\.js: 2 file\(s\) besides the old shell ran their old copy \(core\/math\/tax\.js, core\/math\/retirement\.js\) next to 39 new one\(s\)\. Push sw\.js alone/);
  const shellOnly = report({ config: { transition: true } });
  Object.assign(shellOnly.phaseB, { changedRanOld: 2, changedRanNew: 2, oldFiles: [...TRANSITION_OLD_OK], sample: { old: [...TRANSITION_OLD_OK] } });
  assert.equal(checkVerdict(shellOnly).ok, true, "the push of sw.js alone: only the old shell ran old (5fb5363 -> this fix)");
  const oldWhole = report({ config: { transition: true } });
  Object.assign(oldWhole.phaseB, { changedRanOld: 3, changedRanNew: 0, oldFiles: ["index.html", "core/app.js", "core/math/tax.js"], sample: { old: ["index.html", "core/app.js", "core/math/tax.js"] } });
  assert.equal(checkVerdict(oldWhole).ok, true, "the old version whole (nothing new ran yet) is not a mix");
  const notTransition = report(); Object.assign(notTransition.phaseB, { changedRanOld: 1, changedRanNew: 1, oldFiles: ["index.html"], sample: { old: ["index.html"] } });
  assert.match(checkVerdict(notTransition).problems[0], /^B-not-running/, "with the worker in place even an old index.html fails");
  const transitionRed = report({ config: { transition: true } }); transitionRed.phaseB.visits[1].notices.push({ text: "This page could not open." });
  assert.equal(checkVerdict(transitionRed).ok, false, "a red notice still fails the transition");
  assert.deepEqual(checkVerdict(report()).warnings, [], "no warnings on an ordinary push");
  // --flaky (the site stops answering some files after the deploy): only a mix of old and new, or a screen stuck on
  // "Opening your plan..." for ever, fails it; the honest failure that follows is what the household should see
  const flaky = (over = {}) => { const r = report({ config: { flaky: ["core/app.js"] }, ...over }); return r; };
  const honest = flaky({ pageerrors: [{ visit: "B (reload)", text: "SyntaxError: x" }], failed: [{ visit: "B (reload)", url: "/financial-planner/core/app.js", why: "net::ERR_EMPTY_RESPONSE" }] });
  honest.phaseB.visits[0].notices.push({ text: "The app could not open. Reload to try again." }); honest.phaseB.visits[0].bootFailed = true;
  const hv = checkVerdict(honest);
  assert.equal(hv.ok, true, hv.problems.join("; "));
  assert.ok(hv.warnings.some((w) => /red notice \(after the deploy, \(reload\)\): The app could not open/.test(w)));
  assert.ok(hv.warnings.some((w) => /failed request .*core\/app\.js/.test(w)));
  assert.ok(hv.warnings.some((w) => /did not answer core\/app\.js/.test(w)));
  const mixed = flaky(); mixed.phaseB.changedRanOld = 1; mixed.phaseB.changedRanNew = 3; mixed.phaseB.sample = { old: ["core/app.js"], new: ["modules/overview/pages/view.js"] };
  const mv = checkVerdict(mixed);
  assert.equal(mv.ok, false);
  assert.match(mv.problems[0], /^MIXED: 1 changed file\(s\) ran their old copy \(core\/app\.js\).*next to 3 new one\(s\) \(modules\/overview\/pages\/view\.js\)/);
  const wholeOld = flaky(); wholeOld.phaseB.changedRanOld = 4; wholeOld.phaseB.changedRanNew = 0; wholeOld.phaseB.sample = { old: ["core/app.js"], new: [] };
  assert.equal(checkVerdict(wholeOld).ok, true, "one version (the browser's copy, whole) is not a mix");
  const stuckFlaky = flaky(); stuckFlaky.phaseB.visits[0].stuck = true;
  assert.match(checkVerdict(stuckFlaky).problems[0], /stuck on the opening screen/, "never \"Opening your plan...\" for ever");
  const otherFile = flaky({ failed: [{ visit: "B (reload)", url: "/financial-planner/core/format.js", why: "HTTP 404" }] });
  assert.equal(checkVerdict(otherFile).ok, false, "a file that was not dropped must still load");
  const firstVisit2 = flaky(); firstVisit2.phaseA.visits[0].notices.push({ text: "x" });
  assert.equal(checkVerdict(firstVisit2).ok, false, "before the deploy nothing is excused");
});

test("a stalled network: requests are accepted and never answered, from now on or after some number of requests; answers return", async () => {
  const a = tree({ "index.html": INDEX, "core/app.js": "export const v = 'A';\n" });
  const srv = pagesServer({ trees: [{ dir: a, label: "A" }], maxAge: 600 });
  const port = await srv.listen(0);
  const get = (p) => fetch(`http://127.0.0.1:${port}${p}`, { signal: AbortSignal.timeout(300) }).then((r) => r.status, (e) => e.name);
  try {
    assert.equal(await get(`${BASE}core/app.js`), 200);
    srv.stall = true;
    assert.equal(await get(`${BASE}core/app.js`), "TimeoutError", "no answer, no close: the phone on a dead connection");
    assert.equal(srv.held, 1);
    srv.stall = false;
    assert.equal(await get(`${BASE}core/app.js`), 200, "and it answers again");
    srv.stallAfter(2);
    assert.deepEqual([await get(`${BASE}index.html`), await get(`${BASE}core/app.js`), await get(`${BASE}index.html`)], [200, 200, "TimeoutError"], "the first two are answered, then silence");
  } finally { await srv.close(); }
});

// qa/flows/static-skew.mjs -- the phone on the static site (GitHub Pages) running OLD and NEW files at once, reproduced.
//
// GitHub Pages has no import map (server/server.mjs gives the PC's copy one, see docs/PLAN.md "Quick to open"): every
// file keeps its plain address and is cached for `max-age` seconds on its own. A phone that loaded version A keeps
// using each cached A file until that file's own freshness runs out, and fetches the rest from version B. This script
// is a small GitHub-Pages-like server whose served tree can be swapped while it runs, plus a Playwright run that opens
// A on a phone-sized Chromium, swaps to B (a deploy), opens the app again and records what the household would see.
//
//   node qa/flows/static-skew.mjs --check --out <dir>                         THE CHECK (one command; exit 0 = safe to deploy)
//     A = this working tree as it is (committed or not), B' = the same tree plus a synthetic change of every shape that
//     can mix (syntheticShellChange below): core/app.js gives every page a new ctx field that All pages reads
//     (ctx.skewProbe.build), core/math/tax.js gains an export All pages imports (SKEW_PROBE) -- the two shapes that broke
//     the phone on 2026-11-07 --, the reverse (A' has an export in core/format.js that Settings imports, B' drops both),
//     a changed core/ui/base.css, a changed sw.js and a changed index.html (the page itself). Served the way the 2026-11-07 deploy reached the owner's phone:
//     core files still fresh in the phone's cache, page files expired, and the reverse pair the other way round
//     (--cdn "*=0,modules/=590,core/format.js=590,modules/system/settings/=0" --wait 11). Exits 1 on any red notice,
//     page error, failed request to the site (other than the PC's /api/ at the domain root) or B' not running whole
//     after the deploy ("B-not-running": a changed file ran old, or the shell never drew). With the service worker
//     (sw.js) this passes; add --no-sw (the browser blocks service workers) and the same pair FAILS: that proves the
//     check catches the bug.
//   node qa/flows/static-skew.mjs --check --a <what main is now> --b <what you push> --how reopen --out <dir>
//     the real pair, the way the owner opens it (tools/main-gate.mjs runs both before main moves). When A has no sw.js
//     and B has (the one push that ships the worker), the old shell running (index.html, core/app.js) is a warning:
//     nothing on the phone can stop that one open from taking it from the cache. Any other file that ran old next to
//     new ones fails it (pages on old core code, no red notice to say so: push sw.js alone first), and so does a red
//     notice or page error.
//   node qa/flows/static-skew.mjs --check --flaky core/app.js --out <dir>
//     a patchy network right after the deploy: the site drops the connection for these files (comma-separated) from the
//     deploy on. Then the check asks only that old and new never run together (a file that fails may fail: one reload,
//     then plain words; that is the honest outcome and is reported as a warning). Run it with --no-sw to see the mix.
//   node qa/flows/static-skew.mjs --a a2b9adc --b 5fb5363 --out <dir>         the 2026-11-07 scenario
//     --max-age 600      Cache-Control: max-age (GitHub Pages sends 600)
//     --wait 0           seconds between the deploy and opening the app again
//     --how reload       reload | reopen (close the tab, open the address again, like the home-screen icon)
//     --cut 40           instead of deploying between two visits, deploy in the middle of the first one, after this many
//                        files were sent (GitHub Pages switches while a phone is still loading the ~500 files)
//     --again 0,600      after that, reload again after each of these waits (seconds) and look at All pages and Settings:
//                        does a reload fix it, and when?
//     --cdn off          off | random | <prefix>=<seconds>,...  the Age a CDN reports for each file at the first visit.
//                        GitHub Pages is served by Fastly, which sends `Age`: a file the edge cached 450 s ago reaches
//                        the browser with only 150 s of its 600 s left, so files fetched together expire at different
//                        times. `random` gives each path a seeded age in [0, max-age); `core/=0,modules/=590` sets it by
//                        path prefix (longest prefix wins; `*=` is the rest). A deploy purges the edge (--no-purge keeps it).
//     --seed 1           seed for --cdn random
//     --pages a/b,c/d    pages visited after the deploy besides All pages and Settings (default: five common ones)
//     --port 0           0 = any free port
//     --trees <dir>      where revisions are exported (default <out>/trees; reused when already there)
//     --profile <dir>    Chromium profile (default <out>/profile, wiped first; deleted at the end unless --keep-profile)
//     --no-sw            block service workers in the browser (the app as it was before sw.js)
//     --check            the check's exit code (see above); with --a/--b/--cdn/--wait it checks any pair you name
//     --flaky <files>    after the deploy, drop the connection for these files (see above)
//     --shape all        the synthetic change: all (default), or any of ctx, export, reverse, css, sw joined by commas
//                        (both = ctx,export, the two 2026-11-07 shapes)
//   node qa/flows/static-skew.mjs --serve <dirA>[,<dirB>...] [--port 9020] [--max-age 600] [--cdn ...]
//     just the server, on 127.0.0.1 (drive it with any browser); `curl -X POST 127.0.0.1:<port>/__skew/next` deploys the next tree.
//
// --a / --b take a git revision (exported with `git archive` into <out>/trees, like a Pages deploy of that commit), a
// directory, `worktree` (this working tree's files as git sees them, committed or not) or `synthetic` (--b only: A plus
// the synthetic shell change above; the reverse shape also changes A, as A'). Writes <out>/report.json and screenshots (390x844, deviceScaleFactor 2). Needs Playwright with Chromium
// (`require("playwright")`, or PLAYWRIGHT=<path to playwright/index.js>). Writes nothing in the repo; no plan is used
// (an empty phone, Get started), so nothing touches anyone's data.
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export const BASE = "/financial-planner/";
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".csv": "text/csv; charset=utf-8", ".pdf": "application/pdf",
};
// Jekyll (on unless the tree has a .nojekyll file) drops names starting with _ . # and ending with ~, and its default excludes.
const JEKYLL_DROPS = (rel) => rel.split("/").some((s) => /^[_.#]/.test(s) || s.endsWith("~") || s === "node_modules")
  || /^(Gemfile(\.lock)?$|vendor\/(bundle|cache|gems|ruby)\/)/.test(rel);

const hash01 = (s) => crypto.createHash("sha1").update(s).digest().readUInt32BE(0) / 2 ** 32;

/**
 * Is this failed request one of the PC's own addresses (the plan, AI, compute), which a static site answers with 404?
 * Only /api/ at the domain root (api.base() is the origin): a page folder or file called "api" inside the app is one of
 * the app's files and a 404 there is a real failure. `url`: a full address or a path.
 */
export function isPcApi(url) {
  let p;
  try { p = new URL(url, "http://x").pathname; } catch { return false; }
  return p.startsWith("/api/");
}

/**
 * A GitHub-Pages-like static server. `trees`: [{ dir, label }]; the first is served until `deploy()`.
 * Headers per file: Cache-Control max-age, ETag "<deploy time hex>-<size hex>" and Last-Modified = deploy time (a Pages
 * deploy rewrites every file, so every ETag changes), 304 on If-None-Match / If-Modified-Since, Age and Expires from an
 * optional CDN model. No import map, no rewriting: files are sent as they are.
 */
export function pagesServer({ trees, maxAge = 600, cdn = "off", seed = 1, purge = true, log = [], cutAfter = 0 } = {}) {
  let drop = new Set();   // files whose connection is cut without an answer (a patchy network: --flaky)
  let served = 0;   // cutAfter: the deploy lands after this many files were sent (a deploy in the middle of a page load)
  let i = 0, deployedAt = Math.floor(Date.now() / 1000), phase = "start";
  const edge = new Map();   // rel -> { fill: ms, tree: index }: what the CDN edge holds and since when
  let warm = cdn !== "off";  // the first fill of each path uses the configured ages; after a purge the edge starts at 0
  const rules = cdn === "off" || cdn === "random" ? null : String(cdn).split(",").map((r) => r.split("=")).map(([p, s]) => [p.trim(), Number(s)]);
  const startAge = (rel) => {
    if (cdn === "random") return Math.floor(hash01(`${seed}:${rel}`) * maxAge);
    let best = null;
    for (const [p, s] of rules) if ((p === "*" && !best) || (p !== "*" && rel.startsWith(p) && (!best || best[0] === "*" || p.length > best[0].length))) best = [p, s];
    return Math.min(maxAge - 1, Math.max(0, best ? best[1] : 0));
  };
  const nojekyll = () => fs.existsSync(path.join(trees[i].dir, ".nojekyll"));
  const server = http.createServer((req, res) => {
    const now = Date.now();
    const u = new URL(req.url, "http://x");
    if (u.pathname === "/__skew/next" && req.method === "POST" && /^(::ffff:)?127\.0\.0\.1$|^::1$/.test(req.socket.remoteAddress)) {
      api.deploy(); res.end(`now serving ${trees[i].label}\n`); return;
    }
    const entry = { t: now, phase, path: u.pathname, status: 0, tree: null, age: null };
    log.push(entry);
    const send = (status, headers = {}, body = "") => {
      entry.status = status; res.writeHead(status, headers); res.end(req.method === "HEAD" ? undefined : body);
      if (cutAfter && ++served === cutAfter) { api.deploy(); entry.cut = true; }
    };
    if (u.pathname === BASE.slice(0, -1)) return send(301, { Location: BASE });
    if (!u.pathname.startsWith(BASE)) return send(404, { "Content-Type": "text/html; charset=utf-8" }, "<h1>404</h1>");
    let rel;
    try { rel = decodeURIComponent(u.pathname.slice(BASE.length)); } catch { return send(400); }
    if (rel === "" || rel.endsWith("/")) rel += "index.html";
    rel = path.posix.normalize(rel);
    if (rel.startsWith("..") || path.isAbsolute(rel)) return send(404);
    if (drop.has(rel)) { entry.status = "dropped"; entry.tree = trees[i].label; req.socket.destroy(); return; }   // no answer at all
    // the CDN: a fresh edge copy is served from the tree it was filled from (only differs from the live tree with --no-purge)
    let e = edge.get(rel);
    if (!e || now - e.fill >= maxAge * 1000) { e = { fill: now - (warm ? startAge(rel) * 1000 : 0), tree: i }; edge.set(rel, e); }
    const t = cdn === "off" ? i : e.tree;
    const tree = trees[t];
    entry.tree = tree.label;
    if (!nojekyll() && JEKYLL_DROPS(rel)) return send(404, { "Content-Type": "text/html; charset=utf-8" }, "<h1>404</h1>");
    const file = path.join(tree.dir, rel);
    let st;
    try { st = fs.statSync(file); } catch { return send(404, { "Content-Type": "text/html; charset=utf-8" }, "<h1>404</h1>"); }
    if (st.isDirectory()) return send(301, { Location: `${u.pathname}/` });
    const dep = tree.deployedAt;
    const etag = `"${dep.toString(16)}-${st.size.toString(16)}"`;
    const headers = {
      "Content-Type": TYPES[path.extname(rel).toLowerCase()] ?? "application/octet-stream",
      "Cache-Control": `max-age=${maxAge}`, ETag: etag, "Last-Modified": new Date(dep * 1000).toUTCString(), Vary: "Accept-Encoding",
      "Access-Control-Allow-Origin": "*",   // GitHub Pages sends it (a sandboxed frame, origin "null", can load the modules)
    };
    if (cdn !== "off") {
      const age = Math.max(0, Math.floor((now - e.fill) / 1000));
      headers.Age = String(age); entry.age = age;
      headers.Expires = new Date(e.fill + maxAge * 1000).toUTCString();
    }
    const inm = req.headers["if-none-match"], ims = req.headers["if-modified-since"];
    if ((inm && inm.split(",").map((s) => s.trim().replace(/^W\//, "")).includes(etag)) || (!inm && ims && Date.parse(ims) >= dep * 1000)) return send(304, headers);
    send(200, { ...headers, "Content-Length": st.size }, fs.readFileSync(file));
  });
  trees.forEach((t) => { t.deployedAt = t.deployedAt ?? deployedAt; });
  const api = {
    server, log, edge,
    get tree() { return trees[i]; },
    set phase(p) { phase = p; },
    /** Files (relative to the site, "core/app.js") whose connection is cut from now on, with no answer. */
    set drop(rels) { drop = new Set(rels ?? []); },
    listen: (port = 0) => new Promise((ok) => server.listen(port, "127.0.0.1", () => ok(server.address().port))),
    /** A deploy: the next tree goes live with a new deploy time (so new ETags); the CDN is purged unless purge=false. */
    deploy() {
      i = (i + 1) % trees.length;
      deployedAt = Math.max(deployedAt + 1, Math.floor(Date.now() / 1000));
      trees[i].deployedAt = deployedAt;
      warm = false;   // the configured ages describe the edge before the first deploy; later fills start at 0
      if (purge) edge.clear();
      return trees[i];
    },
    close: () => new Promise((ok) => { server.closeAllConnections?.(); server.close(() => ok()); }),
  };
  return api;
}

// ---------------------------------------------------------------- scenario
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const argv = process.argv.slice(2);
const opt = (n, d) => { const k = argv.indexOf(`--${n}`); return k >= 0 ? argv[k + 1] : d; };
const flag = (n) => argv.includes(`--${n}`);

function exportTree(spec, into) {
  if (spec === "worktree") {   // the working tree as it is: tracked and new files, minus what .gitignore keeps out
    const dir = path.join(into, "work");
    const list = spawnSync("git", ["-C", REPO, "ls-files", "-z", "-co", "--exclude-standard"], { encoding: "utf8", maxBuffer: 1 << 28 });
    if (list.status !== 0) throw new Error("git ls-files failed");
    fs.rmSync(dir, { recursive: true, force: true });
    for (const rel of list.stdout.split("\0").filter(Boolean)) {
      const from = path.join(REPO, rel);
      if (!fs.existsSync(from) || !fs.statSync(from).isFile()) continue;   // deleted but still tracked
      fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
      fs.copyFileSync(from, path.join(dir, rel));
    }
    return { dir, label: "work" };
  }
  if (fs.existsSync(spec) && fs.statSync(spec).isDirectory()) return { dir: path.resolve(spec), label: path.basename(spec) };
  const rev = spawnSync("git", ["-C", REPO, "rev-parse", "--short", spec], { encoding: "utf8" });
  if (rev.status !== 0) throw new Error(`not a directory or git revision: ${spec}`);
  const label = rev.stdout.trim(), dir = path.join(into, label);
  if (!fs.existsSync(path.join(dir, "index.html"))) {
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    const tar = spawnSync("sh", ["-c", `git -C "${REPO}" archive "${label}" | tar -x -C "${dir}"`], { stdio: "inherit" });
    if (tar.status !== 0) throw new Error(`git archive ${label} failed`);
  }
  return { dir, label };
}
/**
 * The synthetic deploy: `from` plus changes of the two shapes that broke the owner's phone on 2026-11-07. (1) The shell
 * gives every page a new ctx field (e7a0259 added `view`, All pages read ctx.view.build): core/app.js's makeCtx gains
 * ctx.skewProbe and All pages reads ctx.skewProbe.build; an old core/app.js with the new page throws "Cannot read
 * properties of undefined". (2) A core file pages import gains an export (the 99 pages: core/math/tax.js's
 * SEPARATE_FIELDS): core/math/tax.js gains SKEW_PROBE and All pages imports it; an old tax.js with the new page fails to
 * link ("does not provide an export named"). core/math/tax.js is only imported by pages, so on the first visit it is
 * fetched after the service worker took over: the case a browser's memory cache could otherwise answer by itself.
 * Throws when the files no longer look as expected (the check must never pass by not changing anything).
 */
export const SHAPES = ["ctx", "export", "reverse", "css", "sw", "index"];
/** "all" | "both" | "ctx,reverse" ... -> the list of shapes; throws on an unknown one. */
export function shapesOf(spec = "all") {
  const list = String(spec).split(",").map((x) => x.trim()).filter(Boolean).flatMap((x) => (x === "all" ? SHAPES : x === "both" ? ["ctx", "export"] : [x]));
  const bad = list.filter((x) => !SHAPES.includes(x));
  if (bad.length || !list.length) throw new Error(`--shape is all, both, or any of ${SHAPES.join(", ")} joined by commas, not ${spec}`);
  return [...new Set(list)];
}
/** The CDN ages the check serves A with: each shape's files where they can mix (see the header). */
export const CHECK_CDN = "*=0,modules/=590,core/format.js=590,modules/system/settings/=0";
const editIn = (into) => (rel, find, add) => {
  const f = path.join(into, rel), src = fs.readFileSync(f, "utf8");
  if (src.split(find).length !== 2) throw new Error(`synthetic change: ${rel} has no single "${find.trim()}" to change`);
  fs.writeFileSync(f, src.replace(find, () => add));
};
const GONE_IMPORT = 'import { SKEW_GONE } from "../../../core/format.js";   // synthetic: an export the next version drops\n';
/**
 * The old side of the reverse shape (A'): `from` plus an export in core/format.js that Settings imports. B' (made from
 * `from`, not from A') has neither, so an old Settings from the phone's cache next to a new core/format.js from the
 * site cannot link ("does not provide an export named SKEW_GONE"): a removed or renamed export, the mirror image of
 * 2026-11-07. Throws when the files no longer look as expected.
 */
export function syntheticOld(from, into) {
  fs.rmSync(into, { recursive: true, force: true });
  fs.cpSync(from, into, { recursive: true });
  const edit = editIn(into);
  edit("core/format.js", "export const money = ", "export const SKEW_GONE = true;   // synthetic (qa/flows/static-skew.mjs --check)\nexport const money = ");
  edit("modules/system/settings/view.js", 'import { conn } from "../../../core/api.js";\n', `import { conn } from "../../../core/api.js";\n${GONE_IMPORT}`);
  return { dir: into, label: `${path.basename(from)}+old` };
}
export function syntheticShellChange(from, into, shape = "all") {
  const shapes = shapesOf(shape);
  fs.rmSync(into, { recursive: true, force: true });
  fs.cpSync(from, into, { recursive: true });
  const edit = editIn(into);
  const ctxShape = shapes.includes("ctx"), exportShape = shapes.includes("export");
  if (ctxShape) edit("core/app.js", "    openSearch,\n", "    openSearch,\n    skewProbe: { build: true },   // synthetic shell change (qa/flows/static-skew.mjs --check)\n");
  if (exportShape) {
    edit("core/math/tax.js", "export const FILING_STATUSES", "export const SKEW_PROBE = true;   // synthetic: a new export pages need\nexport const FILING_STATUSES");
    edit("modules/overview/pages/view.js", 'import { matches } from "../../../core/search.js";\n', 'import { matches } from "../../../core/search.js";\nimport { SKEW_PROBE } from "../../../core/math/tax.js";   // synthetic\n');
  }
  const reads = [ctxShape && "ctx.skewProbe.build", exportShape && "SKEW_PROBE"].filter(Boolean).join(" && ");
  if (reads) edit("modules/overview/pages/view.js", "  const build = ctx.view.build;", `  const probe = ${reads};   // synthetic: a page that needs the new shell\n  const build = ctx.view.build && probe;`);
  // reverse: B' is `from` itself there (A' = syntheticOld(from) has the export and the import); the anchors must exist
  if (shapes.includes("reverse")) {
    for (const [rel, find] of [["core/format.js", "export const money = "], ["modules/system/settings/view.js", 'import { conn } from "../../../core/api.js";\n']]) {
      if (fs.readFileSync(path.join(into, rel), "utf8").split(find).length !== 2) throw new Error(`synthetic change: ${rel} has no single "${find.trim()}" to change`);
    }
  }
  // a style change and a worker change: each must reach the phone with the rest (a plain comment, nothing else differs)
  if (shapes.includes("index")) {
    const f = path.join(into, "index.html"), src = fs.readFileSync(f, "utf8");
    if (src.split("</body>").length !== 2) throw new Error("synthetic change: index.html has no single </body> to change");
    fs.writeFileSync(f, src.replace("</body>", "<!-- synthetic change (qa/flows/static-skew.mjs --check) -->\n</body>"));
  }
  if (shapes.includes("css")) fs.appendFileSync(path.join(into, "core/ui/base.css"), "/* synthetic change (qa/flows/static-skew.mjs --check) */\n");
  if (shapes.includes("sw")) {
    if (!fs.existsSync(path.join(into, "sw.js"))) throw new Error("synthetic change: there is no sw.js (never delete it: docs/PLAN.md \"On a static host\")");
    fs.appendFileSync(path.join(into, "sw.js"), "// synthetic change (qa/flows/static-skew.mjs --check)\n");
  }
  return { dir: into, label: `${path.basename(from)}+${shape === "both" ? "shell" : shapes.join("+")}` };
}
const sha = (f) => { try { return crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex"); } catch { return null; } };

async function scenario() {
  const OUT = path.resolve(opt("out", "shots/static-skew"));
  const CHECK = flag("check"), NO_SW = flag("no-sw");
  // the check: the incident's shape (core files fresh in the phone's cache for 600 s, page files expired 10 s after
  // they were fetched; the 11 s wait makes sure every page file has expired before the second open)
  const MAX_AGE = Number(opt("max-age", "600")), WAIT = Number(opt("wait", CHECK ? "11" : "0")), HOW = opt("how", "reload");
  const CDN = opt("cdn", CHECK ? CHECK_CDN : "off"), SEED = Number(opt("seed", "1"));
  const FLAKY = String(opt("flaky", "")).split(",").map((x) => x.trim()).filter(Boolean);
  const PAGES = opt("pages", "overview/dashboard,overview/start,balance/net-worth,cashflow/expenses,retirement/projection").split(",").filter(Boolean);
  fs.mkdirSync(OUT, { recursive: true });
  const TREES = path.resolve(opt("trees", path.join(OUT, "trees")));
  const A0 = exportTree(opt("a", CHECK ? "worktree" : "HEAD~1"), TREES);
  const bSpec = opt("b", CHECK ? "synthetic" : "HEAD");
  const SHAPE = opt("shape", "all");
  const B = bSpec === "synthetic" ? syntheticShellChange(A0.dir, path.join(TREES, `${A0.label}+synthetic`), SHAPE) : exportTree(bSpec, TREES);
  // the reverse shape: the old side carries the export the new side drops
  const A = bSpec === "synthetic" && shapesOf(SHAPE).includes("reverse") ? syntheticOld(A0.dir, path.join(TREES, `${A0.label}+old`)) : A0;
  const PROFILE = path.resolve(opt("profile", path.join(OUT, "profile")));
  fs.rmSync(PROFILE, { recursive: true, force: true });
  const log = [];
  const srv = pagesServer({ trees: [{ ...A }, { ...B, label: B.label === A.label ? `${B.label}'` : B.label }], maxAge: MAX_AGE, cdn: CDN, seed: SEED, purge: !flag("no-purge"), log, cutAfter: Number(opt("cut", "0")) });
  const port = await srv.listen(Number(opt("port", "0")));
  const origin = `http://127.0.0.1:${port}`, home = `${origin}${BASE}`;
  let pw;
  try { pw = process.env.PLAYWRIGHT ? await import(process.env.PLAYWRIGHT) : createRequire(import.meta.url)("playwright"); }
  catch { pw = await import("/opt/node22/lib/node_modules/playwright/index.mjs"); }
  const { chromium } = pw.default?.chromium ? pw.default : pw;
  const context = await chromium.launchPersistentContext(PROFILE, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: NO_SW ? "block" : "allow" });
  // every resource the document loads stays in the timing buffer (the app loads ~500 files; the default keeps 250)
  await context.addInitScript(() => { try { performance.setResourceTimingBufferSize(5000); } catch { } });
  const rec = { pageerrors: [], consoleErrors: [], failed: [] };
  let visit = null;
  let loads = 0;   // full page loads (the harness's own and the app's self-heal reloads)
  const watch = (page) => {
    page.on("load", () => { loads++; });
    page.on("pageerror", (e) => rec.pageerrors.push({ visit, text: String(e) }));
    page.on("console", (m) => { if (m.type() === "error") rec.consoleErrors.push({ visit, text: m.text().slice(0, 400) }); });
    page.on("requestfailed", (r) => rec.failed.push({ visit, url: r.url().replace(origin, ""), why: r.failure()?.errorText }));
    page.on("response", (r) => { if (r.status() >= 400) rec.failed.push({ visit, url: r.url().replace(origin, ""), why: `HTTP ${r.status()}` }); });
  };
  // settled: the shell drew, the network is quiet, and no reload (the app mending itself, core/heal.js) started meanwhile
  const settle = async (page) => {
    for (let i = 0; i < 4; i++) {
      const before = loads;
      await page.waitForFunction(() => !document.querySelector("#content .booting") && document.getElementById("content")?.children.length, null, { timeout: 20000 }).catch(() => { });
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => { });
      await page.waitForTimeout(700);
      if (loads === before) return;
    }
  };
  const evaluate = async (page, fn, arg) => {
    for (let i = 0; ; i++) {
      try { return await page.evaluate(fn, arg); }
      catch (e) { if (i >= 3 || !/context was destroyed|navigat/i.test(String(e))) throw e; await settle(page); }
    }
  };
  const look = async (page, phaseName, route, n) => {
    visit = `${phaseName} ${route}`;
    const before = { pe: rec.pageerrors.length };
    if (route !== "(reload)" && route !== "(open)") { await evaluate(page, (h) => { location.hash = h; }, `#/${route}`); }
    await settle(page);
    const shot = path.join(OUT, `${phaseName}-${String(n).padStart(2, "0")}-${route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}.png`);
    await page.screenshot({ path: shot });
    const seen = await evaluate(page, () => ({
      hash: location.hash, title: document.getElementById("page-title")?.textContent,
      newShell: !!document.querySelector("#content [data-page]"),   // B's app.js draws each page into <div data-page>; A's did not
      stuck: !!document.querySelector("#content .booting"),          // still "Opening your plan…": the shell itself did not load
      bootFailed: /Boot failed|The app could not open/.test(document.getElementById("content")?.innerText ?? ""),
      healedAt: (() => { try { return sessionStorage.getItem("planner.healAt"); } catch { return null; } })(),   // core/heal.js: the last self-reload
      worker: !!navigator.serviceWorker?.controller,                 // sw.js answered this page's requests
      notices: [...document.querySelectorAll("#content .notice.error")].map((n) => ({ text: (n.firstElementChild?.textContent ?? n.textContent).trim(), details: [...n.querySelectorAll("li")].map((li) => li.textContent) })),
      text: document.getElementById("content")?.innerText.slice(0, 300),
    }));
    const notFound = seen.notices.map((n) => /(\d+|One) pages? could not load/.exec(n.text)).find(Boolean);
    return { route, shot: path.basename(shot), ...seen, couldNotLoad: notFound ? (notFound[1] === "One" ? 1 : Number(notFound[1])) : 0, pageerrors: rec.pageerrors.slice(before.pe).map((e) => e.text) };
  };
  const resources = (page) => evaluate(page, () => performance.getEntriesByType("resource").map((e) => ({ url: e.name, transfer: e.transferSize, body: e.encodedBodySize, delivery: e.deliveryType ?? null, status: e.responseStatus ?? null })));

  // ---- phase 1: version A, the household opens the app and looks around (every module loads at boot, so all of A is cached)
  // the one push that ships the worker: the phone's cached files have none yet, so that open can mix whatever is done
  const transition = !fs.existsSync(path.join(A.dir, "sw.js")) && fs.existsSync(path.join(B.dir, "sw.js"));
  const report = { config: { a: A.label, b: B.label, maxAge: MAX_AGE, wait: WAIT, how: HOW, cdn: CDN, seed: CDN === "random" ? SEED : undefined, purge: !flag("no-purge"), serviceWorkers: NO_SW ? "blocked" : "allowed", check: CHECK, shape: bSpec === "synthetic" ? shapesOf(SHAPE) : undefined, transition, flaky: FLAKY.length ? FLAKY : undefined, engine: null } };
  srv.phase = "A";
  let page = await context.newPage(); watch(page);
  await page.goto(home); visit = "A (open)";
  report.config.engine = (await page.evaluate(() => navigator.userAgent)).match(/(Headless)?Chrome\/[\d.]+/)?.[0] ?? "chromium";
  const p1 = [await look(page, "A", "(open)", 0)];
  let n = 1;
  for (const r of ["overview/start", "overview/dashboard", "overview/pages", "system/settings"]) p1.push(await look(page, "A", r, n++));
  report.phaseA = { visits: p1, requests: log.filter((l) => l.phase === "A").length, ages: summariseAges(log.filter((l) => l.phase === "A")) };

  // ---- the deploy
  let t0 = Date.now();
  if (opt("cut", null)) { const c = log.find((l) => l.cut); t0 = c ? c.t : t0; report.config.cutAt = c ? c.path : "never (fewer files were sent)"; }
  else srv.deploy();
  if (WAIT > 0) await new Promise((ok) => setTimeout(ok, WAIT * 1000));
  srv.phase = "B";
  srv.drop = FLAKY;   // --flaky: from the deploy on, these files get no answer
  visit = `B ${HOW === "reopen" ? "(open)" : "(reload)"}`;   // what happens while it opens is the new phase's, not A's last page
  if (HOW === "reopen") { await page.close(); page = await context.newPage(); watch(page); await page.goto(`${home}#/overview/pages`); }
  else await page.reload();
  const p2 = [await look(page, "B", HOW === "reopen" ? "(open)" : "(reload)", 0)];
  n = 1;
  for (const r of ["overview/pages", "system/settings", ...PAGES]) p2.push(await look(page, "B", r, n++));
  // which copy of each file the page ran: fetched after the deploy = B; not fetched = the cached A copy
  // (a dropped file was not fetched: when it ran at all, it ran the copy the browser held)
  const fetched = new Map(log.filter((l) => l.phase === "B" && l.status !== "dropped").map((l) => [l.path, l]));
  const pathOf = (url) => url.slice(origin.length).split("#")[0].split("?")[0];
  const failedDrop = (r) => r.status === 0 && FLAKY.includes(pathOf(r.url).slice(BASE.length));   // a dropped file that did not run
  const used = (await resources(page)).filter((r) => r.url.startsWith(home) && !failedDrop(r)).map((r) => pathOf(r.url));
  const files = [...new Set([BASE, ...used, ...[...fetched.keys()]])].filter((p) => p.startsWith(BASE));
  // the copy in the cache is the one the last 200 before this phase sent (with --cut, part of the first visit was already B)
  const cachedTree = new Map(); for (const l of log) if (l.phase !== "B" && l.status === 200) cachedTree.set(l.path, l.tree);
  const rows = files.map((p) => {
    const rel = p.slice(BASE.length) || "index.html", f = fetched.get(p);
    const same = sha(path.join(A.dir, rel)) === sha(path.join(B.dir, rel));
    const tree = f ? f.tree : cachedTree.get(p) ?? A.label;
    const from = f ? (f.status === 304 ? `304 (${tree})` : f.status >= 400 ? `HTTP ${f.status}` : `network (${tree})`) : `cache (${tree})`;
    return { rel, from, same, old: tree === A.label };
  });
  const ranOld = rows.filter((r) => r.old && !r.same).map((r) => r.rel), ranNew = rows.filter((r) => !r.old && !r.same).map((r) => r.rel);
  const appRow = rows.find((r) => r.rel === "core/app.js");
  if (appRow?.same) appRow.from += " (same file in A and B)";
  // B's app.js draws each page into <div data-page>; when A's does too (any tree after 2026-11-06), the shell that ran is
  // told by where core/app.js came from instead
  if (appRow && !appRow.same && /dataset: \{ page:/.test(fs.readFileSync(path.join(A.dir, "core/app.js"), "utf8"))) for (const v of p2) v.newShell = !appRow.old;
  report.phaseB = {
    secondsAfterDeploy: Math.round((Date.now() - t0) / 100) / 10,
    shell: appRow ? appRow.from : "?", running: drawnBy(p2),
    files: rows.length, fromCache: rows.filter((r) => r.from.startsWith("cache")).length, fromNetwork: rows.filter((r) => r.from.startsWith("network")).length,
    changedRanOld: ranOld.length, changedRanNew: ranNew.length,
    mixed: ranOld.length > 0 && ranNew.length > 0,
    coreRanOld: ranOld.filter((r) => r.startsWith("core/")), oldFiles: ranOld, sample: { old: ranOld.slice(0, 12), new: ranNew.slice(0, 12) },
    cachedSample: rows.filter((r) => r.from.startsWith("cache")).map((r) => r.rel).slice(0, 20),
    shellRequests: log.filter((l) => l.phase === "B" && l.path === `${BASE}core/app.js`).map((l) => `${l.status} (${l.tree})`),
    worker: p2.some((v) => v.worker),
    selfReloads: new Set(p2.map((v) => v.healedAt).filter(Boolean)).size,
    visits: p2,
  };
  // ---- reload again (what the red notice tells the household to do), after each wait
  report.again = [];
  for (const w of opt("again", "").split(",").filter((x) => x !== "").map(Number)) {
    if (w > 0) await new Promise((ok) => setTimeout(ok, w * 1000));
    const phaseName = `R${report.again.length + 1}`;
    srv.phase = phaseName;
    visit = `${phaseName} ${HOW === "reopen" ? "(open)" : "(reload)"}`;
    if (HOW === "reopen") { await page.close(); page = await context.newPage(); watch(page); await page.goto(`${home}#/overview/pages`); }
    else await page.reload();
    const vs = [await look(page, phaseName, HOW === "reopen" ? "(open)" : "(reload)", 0), await look(page, phaseName, "overview/pages", 1), await look(page, phaseName, "system/settings", 2)];
    const got = new Set(log.filter((l) => l.phase === phaseName && l.status === 200).map((l) => l.path));
    // as after the deploy: when A's app.js draws <div data-page> too, the shell that ran is the copy of core/app.js the
    // site sent last (a reopen within max-age asks the site nothing and runs the cached copy)
    if (appRow && !appRow.same && /dataset: \{ page:/.test(fs.readFileSync(path.join(A.dir, "core/app.js"), "utf8"))) {
      const last = log.filter((l) => l.path === `${BASE}core/app.js` && l.status === 200).at(-1);
      for (const v of vs) v.newShell = !!last && last.tree !== A.label;
    }
    report.again.push({ wait: w, secondsAfterDeploy: Math.round((Date.now() - t0) / 100) / 10, fetched: got.size, shellFetched: got.has(`${BASE}core/app.js`),
      newShell: vs.every((v) => v.newShell), drawnBy: drawnBy(vs), couldNotLoad: Math.max(...vs.map((v) => v.couldNotLoad)), notices: [...new Set(vs.flatMap((v) => v.notices.map((x) => x.text)))], visits: vs });
  }
  report.pageerrors = rec.pageerrors;
  report.consoleErrors = rec.consoleErrors.slice(0, 60);
  report.consoleErrorCount = rec.consoleErrors.length;
  report.failed = rec.failed.filter((f) => !isPcApi(f.url));
  report.failedApi = rec.failed.filter((f) => isPcApi(f.url)).length;   // the PC's address answers 404 on a static site: expected
  report.verdict = checkVerdict(report);
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
  // every request the site answered, in order: [ms since the first, phase, status, tree, path, age]
  fs.writeFileSync(path.join(OUT, "requests.json"), JSON.stringify(log.map((l) => [l.t - log[0].t, l.phase, l.status, l.tree, l.path, l.age])).replace(/\],\[/g, "],\n["));
  await context.close();
  await srv.close();
  if (!flag("keep-profile")) fs.rmSync(PROFILE, { recursive: true, force: true });
  printSummary(report, OUT);
  return report;
}

/**
 * The check's verdict on a report: { ok, problems[], warnings[] }. A problem is any red notice (before or after the
 * deploy), a page error, a failed request to the site other than the PC's /api/, or B not running whole after the
 * deploy: a file that differs between A and B ran its A copy, or the shell never drew (stuck on the opening screen,
 * boot failed). On the transition (A has no sw.js, B has: r.config.transition) the old shell that ran is a warning: the
 * phone's cached files came without the worker, so nothing can stop that one open from mixing; the check then says
 * whether this particular mix shows the household anything.
 * With --flaky (r.config.flaky: files the site stopped answering after the deploy) the only question is whether old and
 * new ran together: a mix, or a screen stuck on "Opening your plan..." for ever, fails it; the honest failure (red
 * notice, "could not open", the dropped files' failed requests, the page errors they cause) is a warning.
 */
/** On the push that ships sw.js, the files that may run old (the old shell, which the phone's cache still holds). */
export const TRANSITION_OLD_OK = ["index.html", "core/app.js"];
export function checkVerdict(r) {
  const problems = [], warnings = [];
  const flaky = r.config?.flaky?.length ? r.config.flaky : null;
  const honest = flaky ? warnings : problems;   // with --flaky a file that fails may say so
  const visits = [...r.phaseA.visits.map((v) => ["first visit", v]), ...r.phaseB.visits.map((v) => ["after the deploy", v]), ...(r.again ?? []).flatMap((a) => a.visits.map((v) => [`reload after ${a.wait}s`, v]))];
  for (const [when, v] of visits) {
    for (const n of v.notices) (when === "first visit" ? problems : honest).push(`red notice (${when}, ${v.route}): ${n.text.slice(0, 140)}`);
    if (v.stuck) problems.push(`B-not-running (${when}, ${v.route}): stuck on the opening screen`);
    if (v.bootFailed) (when === "first visit" ? problems : honest).push(`B-not-running (${when}, ${v.route}): the app could not open`);
  }
  for (const e of r.pageerrors) (flaky && !/^A /.test(e.visit ?? "") ? warnings : problems).push(`page error (${e.visit}): ${e.text.slice(0, 140)}`);
  const dropped = (url) => !!flaky && flaky.some((rel) => String(url).split("?")[0].endsWith(`/${rel}`));
  for (const f of r.failed) (dropped(f.url) ? warnings : problems).push(`failed request (${f.visit}): ${f.url} ${f.why}`);
  const b = r.phaseB;
  const ranOld = `${b.changedRanOld} changed file(s) ran their old copy (${b.sample.old.slice(0, 4).join(", ")}); shell core/app.js from ${b.shell}`;
  if (flaky) {
    if (b.changedRanOld > 0 && b.changedRanNew > 0) problems.push(`MIXED: ${ranOld}, next to ${b.changedRanNew} new one(s) (${b.sample.new.slice(0, 4).join(", ")})`);
    else if (b.changedRanOld > 0) warnings.push(`the open ran the old version whole (the browser's copy): ${ranOld}`);
    warnings.push(`the site did not answer ${flaky.join(", ")} after the deploy`);
  } else if (b.changedRanOld > 0 && r.config?.transition) {
    // the old shell itself (index.html, core/app.js) may run old on that one open; anything else that ran old next to
    // new files means pages ran on old code with no red notice to say so (5fb5363 -> the branch with sw.js, 2026-11-07:
    // old core/math/tax.js and retirement.js under new pages). So the push that ships sw.js must carry nothing else.
    const others = (b.oldFiles ?? b.sample.old).filter((f) => !TRANSITION_OLD_OK.includes(f));
    if (others.length && b.changedRanNew > 0) problems.push(`MIXED on the push that ships sw.js: ${others.length} file(s) besides the old shell ran their old copy (${others.slice(0, 4).join(", ")}) next to ${b.changedRanNew} new one(s). Push sw.js alone on top of what main is now, wait 10 minutes after it is live, then push the rest (docs/PLAN.md "On a static host")`);
    else warnings.push(`B-not-running: ${ranOld}`);
  } else if (b.changedRanOld > 0) problems.push(`B-not-running: ${ranOld}`);
  if (r.config?.transition) warnings.push("the push that ships sw.js: phones that opened the site in the last 10 minutes keep their old files until they expire; push nothing else for 10 minutes after it is live");
  return { ok: problems.length === 0, problems, warnings };
}

function drawnBy(visits) {
  if (visits.some((v) => v.stuck)) return "nothing (stuck on the opening screen: the shell did not load)";
  if (visits.some((v) => v.bootFailed)) return "nothing (\"Boot failed\")";
  return visits.every((v) => v.newShell) ? "B (new shell)" : visits.every((v) => !v.newShell) ? "A (old shell)" : "mixed";
}
const broken = (v) => v.notices.length > 0 || v.stuck || v.bootFailed;

function summariseAges(rows) {
  const ages = rows.map((r) => r.age).filter((a) => a != null);
  if (!ages.length) return null;
  ages.sort((a, b) => a - b);
  return { files: ages.length, min: ages[0], median: ages[Math.floor(ages.length / 2)], max: ages[ages.length - 1] };
}

function printSummary(r, out) {
  const b = r.phaseB;
  console.log(`A=${r.config.a} B=${r.config.b} max-age=${r.config.maxAge} wait=${r.config.wait}s how=${r.config.how} cdn=${r.config.cdn}${r.config.seed != null ? ` seed=${r.config.seed}` : ""}${r.config.cutAt ? ` deploy during the first visit, after ${r.config.cutAt}` : ""}`);
  for (const v of r.phaseA.visits.filter((x) => x.notices.length)) console.log(`  first visit ${v.route.padEnd(18)} RED: ${v.notices.map((x) => x.text).join(" | ").slice(0, 160)}`);
  console.log(`  after the deploy: shell core/app.js from ${b.shell}; pages drawn by ${b.running}; ${b.files} files: ${b.fromCache} from cache, ${b.fromNetwork} from the network; files that differ between A and B ran old: ${b.changedRanOld}, new: ${b.changedRanNew}${b.mixed ? "  => MIXED" : ""}`);
  for (const v of b.visits) {
    const red = v.notices.map((x) => x.text).join(" | ");
    const shell = v.stuck ? "no shell " : v.bootFailed ? "boot failed" : v.newShell ? "new shell" : "old shell";
    console.log(`  ${v.route.padEnd(22)} ${shell}  ${red ? `RED: ${red.slice(0, 160)}` : v.stuck || v.bootFailed ? JSON.stringify(v.text.slice(0, 80)) : "no red notice"}`);
  }
  for (const a of r.again ?? []) console.log(`  reload again after ${a.wait}s (${a.secondsAfterDeploy}s after the deploy): ${a.fetched} files fetched, pages drawn by ${a.drawnBy}, ${a.notices.length ? `RED: ${a.notices.join(" | ").slice(0, 200)}` : "no red notice"}`);
  console.log(`  page errors ${r.pageerrors.length}, console errors ${r.consoleErrorCount}, failed requests ${r.failed.length} (+${r.failedApi} PC address 404s); service worker ${r.config.serviceWorkers}${b.worker ? ", answered after the deploy" : ""}; the app reloaded itself ${b.selfReloads} time(s) after the deploy`);
  if (r.config.check) {
    const v = r.verdict;
    console.log(!v.ok ? `  CHECK FAILED (${v.problems.length}):` : r.config.flaky ? "  CHECK PASSED: old and new never ran together (what the household saw: see the warnings)"
      : `  CHECK PASSED: no red notice, no page error, no failed request${r.config.transition ? " (the transition: see the warnings)" : ", B ran whole"}`);
    for (const p of v.problems.slice(0, 12)) console.log(`    - ${p}`);
    for (const w of v.warnings ?? []) console.log(`    warning: ${w}`);
  }
  console.log(`  report: ${path.join(out, "report.json")}`);
}

async function serveOnly() {
  const dirs = opt("serve", "").split(",").filter(Boolean).map((d) => exportTree(d, path.resolve(opt("out", "shots/static-skew"), "trees")));
  const srv = pagesServer({ trees: dirs, maxAge: Number(opt("max-age", "600")), cdn: opt("cdn", "off"), seed: Number(opt("seed", "1")), purge: !flag("no-purge") });
  const port = await srv.listen(Number(opt("port", "9020")));
  console.log(`serving ${srv.tree.label} at http://127.0.0.1:${port}${BASE}  (POST /__skew/next deploys the next tree)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (opt("serve", null)) await serveOnly();
  else {
    const r = await scenario();
    process.exitCode = r.config.check ? (r.verdict.ok ? 0 : 1) : r.phaseB.visits.some(broken) || r.pageerrors.length ? 1 : 0;
  }
}

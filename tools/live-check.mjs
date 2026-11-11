// tools/live-check.mjs -- after a push to main, is the live site (GitHub Pages) whole and working on a phone?
// docs/PLAN.md "On a static host (GitHub Pages)".
//
//   node tools/live-check.mjs --profile <dir> --prime              RIGHT BEFORE the push: open the site as it is now
//   node tools/live-check.mjs --profile <dir> --from <what main was before the push>     AFTER the push
//     --url <address>      the live site (default https://luisitin.github.io/financial-planner/)
//     --profile <dir>      a Chromium profile KEPT between runs, outside this folder (required)
//     --prime              only open every page in the kept profile, now (no comparing, no waiting). Run it right
//                          before you push, so that profile holds the version the phone holds, opened minutes ago.
//     --from <rev>         what main was before the push (required: main moves by several commits at once): every file
//                          `git diff --name-only <rev>..<ref>` lists is compared, and always core/app.js,
//                          modules/registry.js, index.html, sw.js, manifest.webmanifest and core/ui/base.css
//     --ref HEAD           what the site should serve: a git revision, `worktree` (files on disk) or a folder
//     --timeout 15         minutes to wait for the site to serve those bytes before giving up
//     --walk               open the pages even when the push changed none of the app's files (only docs, say)
//     --dry-run            step 1 once (no waiting, no browser): what differs now, and what step 2 would open
//
// 1. Waits until the site serves the same bytes as <ref> for those files (a deleted file must be gone, a .js file must
//    come as JavaScript); gives up after --timeout minutes and says what to look at (the push, the Pages build).
// 2. Opens the site at 390x844 (phone, deviceScaleFactor 2) in the kept profile, then in a fresh one, and visits every
//    page in the registry: the kept profile in the household's view (the owner's case), the fresh one with ?view=build
//    (so builder pages such as Docs draw too). Then reloads once in each: where the site has sw.js and the page is
//    secure (https), the reloaded page must be under the service worker (sw.js answers it).
// 3. Prints one line, "live-check: OK ..." or "live-check: FAIL ...", then the problems, and exits 1 on any red notice,
//    page error, app that never drew or drew nothing, missing service worker, or failed request to the site other than
//    any request for the PC's /api/ addresses at the domain root (the app asks for none on a static site: core/api.js)
//    and aborted requests (a navigation cancelling them).
// What it proves: the live bytes load whole on a phone-sized browser under the site's subpath, with the worker. It is
// not the proof that no phone can mix old and new files (qa/flows/static-skew.mjs --check is, before main moves): a kept
// profile that last opened the site an hour ago has nothing fresh left to mix, hence --prime right before the push.
// Reads the site only: no plan is written anywhere but the two profiles' own browser storage.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DEFAULT_URL = "https://luisitin.github.io/financial-planner/";

/** Read the arguments; throws with the usage when something is wrong. */
export function parseArgs(argv) {
  const o = { url: DEFAULT_URL, profile: null, from: null, ref: "HEAD", timeout: 15, dryRun: false, prime: false, walk: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], v = () => { const x = argv[++i]; if (x == null || x.startsWith("--")) throw new Error(`${a} needs a value`); return x; };
    if (a === "--url") o.url = v();
    else if (a === "--profile") o.profile = path.resolve(v());
    else if (a === "--from") o.from = v();
    else if (a === "--ref") o.ref = v();
    else if (a === "--timeout") o.timeout = Number(v());
    else if (a === "--dry-run") o.dryRun = true;
    else if (a === "--prime") o.prime = true;
    else if (a === "--walk") o.walk = true;
    else throw new Error(`unknown option ${a}`);
  }
  if (!/^https?:\/\//.test(o.url)) throw new Error("--url must be an http(s) address");
  if (!o.url.endsWith("/")) o.url += "/";
  if (!o.dryRun && !o.profile) throw new Error("--profile <dir> is required: a folder outside this one, kept between runs");
  if (o.profile && (o.profile + path.sep).startsWith(ROOT + path.sep)) throw new Error("--profile must be outside the app's folder (it holds a browser's data)");
  if (!(o.timeout >= 0)) throw new Error("--timeout is minutes, 0 or more");
  if (!o.prime && !o.from) throw new Error("--from <rev> is required: what main was before the push (it moves by several commits at once)");
  return o;
}

/** Files every push is checked for, whatever it changed: the shell, the page list, the worker, the manifest, the styles. */
export const ALWAYS = ["core/app.js", "modules/registry.js", "index.html", "sw.js", "manifest.webmanifest", "core/ui/base.css"];
/** A push that changed any of these can change what a page shows: the pages are opened. Anything else (docs) cannot. */
export const touchesApp = (rels) => rels.some((r) => ALWAYS.includes(r) || /^(core|modules)\//.test(r) || /^[^/]+\.(html|js|css|webmanifest|png)$/.test(r));
/** Never compared: names with a segment starting with "." (the app loads none, and a host may not serve them). */
const dotted = (rel) => rel.split("/").some((seg) => seg.startsWith("."));
/**
 * The PC's own addresses (the plan, AI, compute) sit at the domain root. A static site has no PC, and since 2026-11-07
 * (core/api.js: api.base() is blank unless the PC served the page) the app asks for none: any request there is a problem.
 */
export const isPcApi = (pathname) => String(pathname).startsWith("/api/");
/** The problem line for a request to the PC's address on a static site. */
export const pcAddressProblem = (at, rel, why) => `the app asked the site for a PC address on ${at}: ${rel} ${why} (core/api.js asks none unless the PC served the page)`;

const git = (args, enc = "utf8") => { const r = spawnSync("git", ["-C", ROOT, ...args], { encoding: enc, maxBuffer: 1 << 28 }); if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${String(r.stderr).trim()}`); return r.stdout; };
const sha1 = (buf) => crypto.createHash("sha1").update(buf).digest("hex");

/** The files to compare and the bytes <ref> has for each (null: the file must be gone). */
export function expected({ ref, from }) {
  const isDir = ref !== "worktree" && fs.existsSync(ref) && fs.statSync(ref).isDirectory();
  if (!isDir && /[\\/]/.test(ref) && !/^[\w.-]+\/[\w./-]+$/.test(ref)) throw new Error(`--ref ${ref}: no such folder`);
  const rev = ref === "worktree" || isDir ? "HEAD" : ref;
  if (!from) throw new Error("--from <rev> is required: what main was before the push");
  const since = from;
  // worktree: what differs on disk from <from>, new files included; otherwise what the commits changed
  const changed = ref === "worktree"
    ? [...git(["diff", "--name-only", "--no-renames", since]).split("\n"), ...git(["ls-files", "-o", "--exclude-standard"]).split("\n")].filter(Boolean)
    : git(["diff", "--name-only", "--no-renames", `${since}..${rev}`]).split("\n").filter(Boolean);
  const files = [...new Set([...ALWAYS, ...changed])].filter((rel) => !dotted(rel));
  const read = (rel) => {
    if (ref === "worktree" || isDir) { const f = path.join(isDir ? ref : ROOT, rel); return fs.existsSync(f) ? fs.readFileSync(f) : null; }
    const r = spawnSync("git", ["-C", ROOT, "show", `${rev}:${rel}`], { maxBuffer: 1 << 28 });
    return r.status === 0 ? r.stdout : null;
  };
  // without .nojekyll the site drops names starting with _ (Jekyll): nothing to compare there
  const jekyll = read(".nojekyll") === null;
  const out = files.filter((rel) => !(jekyll && rel.split("/").some((s) => s.startsWith("_")))).map((rel) => { const b = read(rel); return { rel, sha: b ? sha1(b) : null, changed: changed.includes(rel) }; });
  // the files of ALWAYS that neither side has (an older ref with no sw.js, say) are not worth a request
  return out.filter((f) => f.sha !== null || f.changed);
}

/** Compare the site with what it should serve: the files that still differ. */
export async function differences(url, want, { fetchImpl = fetch, parallel = 8 } = {}) {
  const out = [];
  for (let i = 0; i < want.length; i += parallel) {
    await Promise.all(want.slice(i, i + parallel).map(async ({ rel, sha }) => {
      let got;
      try {
        const r = await fetchImpl(new URL(rel, url), { redirect: "manual" });   // (Node's fetch keeps no cache)
        const type = r.headers?.get?.("content-type") ?? "";
        got = r.status === 404 ? null : !r.ok ? `HTTP ${r.status}` : /\.m?js$/.test(rel) && !/javascript|ecmascript/i.test(type) ? `the wrong type (${type || "none"}): a browser will not run it`
          : sha1(Buffer.from(await r.arrayBuffer()));
      } catch (e) { got = `no answer (${e.cause?.code ?? e.message})`; }
      if (got !== sha) out.push({ rel, want: sha ? "this version" : "gone", got: got === null ? "missing (404)" : /^[0-9a-f]{40}$/.test(got) ? "another version" : got });
    }));
  }
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

/** Every page in the registry <ref> has: ["group/id", ...]. */
export function pagesOf(registrySource) {
  return [...String(registrySource).matchAll(/\{\s*group:\s*"([a-z0-9-]+)",\s*id:\s*"([a-z0-9-]+)"/g)].map((m) => `${m[1]}/${m[2]}`);
}

/** The one-line verdict and the problems under it. */
export function verdict({ url, pages, runs }) {
  const problems = runs.flatMap((r) => r.problems.map((p) => `${r.name}: ${p}`));
  const api = runs.reduce((n, r) => n + r.apiMisses, 0);
  const line = problems.length
    ? `live-check: FAIL ${url}: ${problems.length} problem(s) over ${pages} pages x ${runs.length} profiles`
    : `live-check: OK ${url}: ${pages} pages x ${runs.length} profile(s) (${runs.map((r) => r.name).join(", then ")}): no red notice, no page error, no failed request, no request for a PC address${api ? ` (${api} seen)` : ""}`;
  return { ok: !problems.length, line, problems };
}

/**
 * Open every page in one browser profile and collect the problems: { name, problems[], apiMisses, worker }. Closes the
 * browser whatever happens (an open one keeps the process running for ever and holds the profile).
 */
export async function walk(chromium, opts) {
  const ctx = await chromium.launchPersistentContext(opts.profile, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  try { return await walkIn(ctx, opts); } finally { await ctx.close().catch(() => { }); }
}
async function walkIn(ctx, { name, url, pages, query, expectWorker = false }) {
  const page = ctx.pages()[0] ?? await ctx.newPage();
  const origin = new URL(url).origin;
  const problems = [];
  let apiMisses = 0, at = "(open)";
  page.on("pageerror", (e) => problems.push(`page error on ${at}: ${String(e).slice(0, 200)}`));
  const failed = (u, why) => {
    if (!u.startsWith(origin)) return;
    if (isPcApi(new URL(u).pathname)) { apiMisses++; problems.push(pcAddressProblem(at, u.slice(origin.length), why)); return; }
    if (/ERR_ABORTED/.test(why)) return;
    problems.push(`failed request on ${at}: ${u.slice(origin.length)} ${why}`);
  };
  page.on("requestfailed", (r) => failed(r.url(), r.failure()?.errorText ?? "failed"));
  page.on("response", (r) => { if (r.status() >= 400) failed(r.url(), `HTTP ${r.status()}`); });
  let loads = 0; page.on("load", () => loads++);
  const settle = async () => {
    for (let i = 0; i < 4; i++) {
      const before = loads;
      await page.waitForFunction(() => !document.querySelector("#content .booting") && document.getElementById("content")?.children.length, null, { timeout: 20000 }).catch(() => { });
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => { });
      await page.waitForTimeout(400);
      if (loads === before) return;
    }
  };
  const look = async () => {
    for (let i = 0; ; i++) {
      try {
        return await page.evaluate(() => ({
          red: [...document.querySelectorAll("#content .notice.error")].map((n) => (n.firstElementChild?.textContent ?? n.textContent).trim()),
          stuck: !!document.querySelector("#content .booting"),
          empty: !document.getElementById("content")?.children.length,
          worker: !!navigator.serviceWorker?.controller,
        }));
      } catch (e) { if (i >= 3) throw e; await settle(); }
    }
  };
  await page.goto(`${url}${query}`, { waitUntil: "domcontentloaded" });
  await settle();
  let worker = false;
  for (const key of pages) {
    at = key;
    await page.evaluate((h) => { location.hash = h; }, `#/${key}`).catch(() => { });
    await settle();
    const s = await look();
    worker ||= s.worker;
    if (s.stuck) problems.push(`${key}: the app never drew (still "Opening your plan...")`);
    else if (s.empty) problems.push(`${key}: the page drew nothing`);
    for (const t of s.red) problems.push(`${key}: red notice "${t.slice(0, 140)}"`);
  }
  // the next open goes through the worker (a first open in a fresh profile does not: sw.js never claims a page)
  at = "(reload)";
  await page.reload({ waitUntil: "domcontentloaded" }).catch(() => { });
  await settle();
  const after = await look();
  worker ||= after.worker;
  if (after.stuck) problems.push("(reload): the app never drew (still \"Opening your plan...\")");
  for (const t of after.red) problems.push(`(reload): red notice "${t.slice(0, 140)}"`);
  if (expectWorker && !after.worker) problems.push("the service worker (sw.js) is not answering the page after a reload: old and new files can mix again");
  return { name, problems: [...new Set(problems)], apiMisses, worker };
}

async function browser() {
  let pw;
  try { pw = createRequire(import.meta.url)("playwright"); } catch { pw = await import(process.env.PLAYWRIGHT ?? "playwright"); }
  return (pw.default?.chromium ? pw.default : pw).chromium;
}
const readRegistry = (ref) => (ref === "worktree" ? fs.readFileSync(path.join(ROOT, "modules/registry.js"), "utf8")
  : fs.existsSync(ref) && fs.statSync(ref).isDirectory() ? fs.readFileSync(path.join(ref, "modules/registry.js"), "utf8")
    : git(["show", `${ref}:modules/registry.js`]));
/** Can a service worker work at this address (a secure page: https, or http on this machine)? */
export const secureUrl = (url) => { try { const u = new URL(url); return u.protocol === "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname); } catch { return false; } };

async function main() {
  const o = parseArgs(process.argv.slice(2));
  if (o.prime) {
    // right before a push: the kept profile opens what the site serves now, as the phone did a few minutes ago
    const pages = pagesOf(readRegistry(o.ref));
    fs.mkdirSync(o.profile, { recursive: true });
    const run = await walk(await browser(), { name: "kept profile (before the push)", profile: o.profile, url: o.url, pages, query: "" });
    const v = verdict({ url: o.url, pages: pages.length, runs: [run] });
    console.log(`${v.line.replace(/^live-check: (OK|FAIL)/, "live-check --prime: $1")}`);
    for (const p of v.problems.slice(0, 40)) console.log(`  - ${p}`);
    console.log("  now push, then run live-check with --from <what main was> and this --profile within 10 minutes");
    process.exitCode = v.ok ? 0 : 1;
    return;
  }
  const want = expected(o);
  const deadline = Date.now() + o.timeout * 60000;
  console.log(`comparing ${want.length} file(s) with ${o.ref}${o.from ? ` (changed since ${o.from})` : ""} at ${o.url}`);
  let diff = await differences(o.url, want);
  while (diff.length && !o.dryRun && Date.now() < deadline) {
    console.log(`  waiting: ${diff.length} file(s) not live yet (${diff.slice(0, 3).map((d) => d.rel).join(", ")}${diff.length > 3 ? ", ..." : ""})`);
    await new Promise((r) => setTimeout(r, 20000));
    diff = await differences(o.url, want);
  }
  const pages = pagesOf(readRegistry(o.ref));
  const hasWorker = want.some((f) => f.rel === "sw.js" && f.sha);
  const changedApp = touchesApp(want.filter((f) => f.changed).map((f) => f.rel));
  if (o.dryRun) {
    console.log(diff.length ? `dry run: ${diff.length} file(s) differ now:` : `dry run: the site serves ${o.ref}'s bytes for all ${want.length} file(s)`);
    for (const d of diff.slice(0, 30)) console.log(`  ${d.rel}: want ${d.want}, got ${d.got}`);
    console.log(changedApp || o.walk ? `dry run: step 2 would open ${pages.length} pages at ${o.url}, in ${o.profile ?? "<--profile>"} then in a fresh profile (no browser started)`
      : "dry run: the push changed none of the app's files: step 2 would open no page (--walk opens them anyway)");
    process.exitCode = diff.length ? 1 : 0;
    return;
  }
  if (diff.length) {
    console.log(`live-check: FAIL ${o.url} still serves ${diff.length} file(s) that differ from ${o.ref} after ${o.timeout} minutes. Is the push on main? Did the Pages build finish (the repository's Actions tab, "pages build and deployment")?`);
    for (const d of diff.slice(0, 30)) console.log(`  ${d.rel}: want ${d.want}, got ${d.got}`);
    process.exitCode = 1;
    return;
  }
  if (!changedApp && !o.walk) {
    console.log(`live-check: OK ${o.url}: the site serves ${o.ref}'s bytes; the push changed none of the app's files, so no page was opened (--walk opens them anyway)`);
    process.exitCode = 0;
    return;
  }
  console.log(`  the site serves ${o.ref}'s bytes; opening ${pages.length} pages`);
  const chromium = await browser();
  fs.mkdirSync(o.profile, { recursive: true });
  const fresh = fs.mkdtempSync(path.join(os.tmpdir(), "live-check-"));
  const runs = [];
  const expectWorker = hasWorker && secureUrl(o.url);
  try {
    runs.push(await walk(chromium, { name: "kept profile", profile: o.profile, url: o.url, pages, query: "", expectWorker }));
    runs.push(await walk(chromium, { name: "fresh profile", profile: fresh, url: o.url, pages, query: "?view=build", expectWorker }));
  } finally { fs.rmSync(fresh, { recursive: true, force: true }); }
  const v = verdict({ url: o.url, pages: pages.length, runs });
  console.log(v.line);
  for (const p of v.problems.slice(0, 40)) console.log(`  - ${p}`);
  if (v.problems.length > 40) console.log(`  ... and ${v.problems.length - 40} more`);
  process.exitCode = v.ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(`live-check: ${e.message}`); process.exitCode = 2; });
}

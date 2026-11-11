// qa/flows/static-stall.mjs -- the phone on a weak or stalled connection, on the static site (GitHub Pages), reproduced.
// sw.js keeps the last whole set of files (docs/PLAN.md "On a static host", "The saved whole copy"); this proves in a
// phone-sized Chromium that an open when the site does not answer uses that set whole, never a mix of two versions.
//
//   node qa/flows/static-stall.mjs --out <dir> [--scenario all|stalled|unchanged|transition|old-whole|mid-open|flaky] [--a worktree] [--port 0]
//
// A = the tree under test (default: this working tree), B' = A plus a synthetic change of the shapes that broke the phone on
// 2026-11-07 (a new ctx field every page reads, a new export): pages of B' crash on A's shell and the other way round, so a
// mix shows at once as a red notice, and the files that ran are compared byte by byte with A and B'. Every scenario starts
// the same way: the phone opens the site (the worker registers; it never claims that page), opens it again (controlled: the
// open is taken as the saved copy), then:
//   unchanged     the site is healthy and unchanged: the open asks the site for one file and nothing else
//   stalled       the site accepts requests and never answers: the open uses the saved copy after the wait (4 s)
//   transition    a deploy, a healthy site: the open is B' whole, then it is the saved copy and a stalled open is B' whole
//   old-whole     a deploy, then a stalled site: the open is A whole (the last whole set), not a mix
//   mid-open      a deploy; the site answers 30 requests and goes silent: "Opening your plan..." is mended by the guard's one
//                 reload after 30 s, which opens the saved copy (A) whole
//   flaky         a deploy; the site drops core/app.js: honest words, never A files under B' files
// Exit 0 when every chosen scenario passes. Writes <out>/report.json and a screenshot per scenario (390x844, deviceScaleFactor 2).
// No plan is used (an empty phone on its own throw-away profile and address), nothing outside <out> is written. It opens the
// site without ?sandbox=1 on purpose: the sandbox switches the self-heal reload off (core/heal.js), and that reload is under test.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { pagesServer, exportTree, syntheticShellChange, BASE } from "./static-skew.mjs";

const argv = process.argv.slice(2);
const opt = (n, d) => { const k = argv.indexOf(`--${n}`); return k >= 0 ? argv[k + 1] : d; };
export const SCENARIOS = ["unchanged", "stalled", "transition", "old-whole", "mid-open", "flaky"];
const CHECK_FILES = ["core/app.js", "core/ui/base.css", "modules/registry.js", "core/math/tax.js", "core/format.js", "modules/overview/pages/view.js", "index.html"];
const sha = (b) => crypto.createHash("sha1").update(b).digest("hex");

export async function run({ out, a = "worktree", scenarios = SCENARIOS, port = 0, log = console.log } = {}) {
  fs.mkdirSync(out, { recursive: true });
  const TREES = path.join(out, "trees");
  const A = exportTree(a, TREES);
  const B = syntheticShellChange(A.dir, path.join(TREES, `${A.label}+synthetic`), "ctx,export");
  const bytes = (dir) => Object.fromEntries(CHECK_FILES.map((f) => [f, fs.existsSync(path.join(dir, f)) ? sha(fs.readFileSync(path.join(dir, f))) : null]));
  const SHA = { A: bytes(A.dir), B: bytes(B.dir) };
  let pw;
  try { pw = process.env.PLAYWRIGHT ? await import(process.env.PLAYWRIGHT) : createRequire(import.meta.url)("playwright"); }
  catch { pw = await import("/opt/node22/lib/node_modules/playwright/index.mjs"); }
  const { chromium } = pw.default?.chromium ? pw.default : pw;
  const results = [];
  for (const name of scenarios) results.push(await one(name));
  fs.writeFileSync(path.join(out, "report.json"), JSON.stringify({ a: A.label, results }, null, 2));
  return results;

  async function one(name) {
    const reqLog = [];
    const srv = pagesServer({ trees: [{ ...A }, { ...B, label: `${B.label}'` }], maxAge: 600, cdn: "off", log: reqLog });
    const p = await srv.listen(port);
    const home = `http://127.0.0.1:${p}${BASE}`;
    const profile = path.join(out, `profile-${name}`);
    fs.rmSync(profile, { recursive: true, force: true });
    const ctx = await chromium.launchPersistentContext(profile, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: "allow" });
    const errors = [];
    const t = { start: Date.now() };
    const problems = [], notes = [];
    try {
      /** Open the app like the home-screen icon: a new tab. Returns how long it took to draw, what it shows and which version ran. */
      const openApp = async (label, { wait = 90000 } = {}) => {
        const page = await ctx.newPage();
        page.on("pageerror", (e) => errors.push(`${label}: ${String(e).slice(0, 160)}`));
        const t0 = Date.now(), before = reqLog.length;
        await page.goto(home, { waitUntil: "commit", timeout: wait }).catch((e) => errors.push(`${label}: goto ${String(e).slice(0, 100)}`));
        let drew = false;
        try { await page.waitForFunction(() => !document.querySelector("#content .booting") && document.getElementById("content")?.children.length, null, { timeout: wait, polling: 200 }); drew = true; } catch { }
        const ms = Date.now() - t0;
        await page.waitForTimeout(800);
        const seen = await page.evaluate(async (files) => {
          const out = {};
          for (const f of files) {
            try { const r = await fetch(`./${f}`, { signal: AbortSignal.timeout(6000) }); out[f] = r.status === 200 ? await r.text() : `HTTP ${r.status}`; } catch (e) { out[f] = null; }
          }
          return {
            red: [...document.querySelectorAll("#content .notice.error")].map((n) => (n.firstElementChild?.textContent ?? n.textContent).trim()),
            booting: !!document.querySelector("#content .booting"),
            worker: !!navigator.serviceWorker?.controller,
            text: document.getElementById("content")?.innerText.slice(0, 120) ?? "",
            healedAt: (() => { try { return sessionStorage.getItem("planner.healAt"); } catch { return null; } })(),
            files: out,
          };
        }, CHECK_FILES).catch(() => ({ red: [], booting: true, worker: false, text: "(page gone)", files: {}, healedAt: null }));
        const hashes = Object.fromEntries(Object.entries(seen.files).map(([f, v]) => [f, typeof v === "string" && !/^HTTP /.test(v) ? sha(Buffer.from(v)) : null]));
        const side = (S) => CHECK_FILES.filter((f) => hashes[f] && hashes[f] === SHA[S][f]);
        const onlyA = CHECK_FILES.filter((f) => hashes[f] && hashes[f] === SHA.A[f] && SHA.A[f] !== SHA.B[f]);
        const onlyB = CHECK_FILES.filter((f) => hashes[f] && hashes[f] === SHA.B[f] && SHA.A[f] !== SHA.B[f]);
        const version = onlyA.length && onlyB.length ? "MIXED" : onlyA.length ? "A" : onlyB.length ? "B" : "unknown";
        const shot = path.join(out, `${name}-${label.replace(/[^a-z0-9]+/gi, "-")}.png`);
        await page.screenshot({ path: shot }).catch(() => { });
        const requests = reqLog.slice(before).filter((r) => r.path.startsWith(BASE));
        return { label, page, drew, ms, ...seen, files: undefined, version, onlyA, onlyB, requests: requests.length, answered: requests.filter((r) => r.status !== "stalled").length, shot: path.basename(shot), side };
      };
      const savedCopy = async (page) => page.evaluate(async () => { const r = await (await caches.open("planner-current-1")).match("current"); return r ? await r.json() : null; }).catch(() => null);
      // the saved copy once it exists and (when `not` is given) is another deploy's than that stamp
      const waitSaved = async (page, not) => { for (let i = 0; i < 60; i++) { const c = await savedCopy(page); if (c && c.n > 50 && c.stamp !== not) return c; await page.waitForTimeout(500); } return null; };
      // warm: version A is open twice; the second (controlled) open becomes the saved copy
      srv.phase = "warm";
      const o1 = await openApp("first open"); await o1.page.close();
      const o2 = await openApp("second open");
      const saved = await waitSaved(o2.page);
      if (!saved) problems.push("the second open did not become the saved copy");
      else notes.push(`saved copy after the second open: ${saved.n} files`);
      await o2.page.close();
      const r = {};
      const expect = (cond, why) => { if (!cond) problems.push(why); };
      const check = (o, version, { under = 20000, red = true } = {}) => {
        expect(o.drew, `${o.label}: the app never drew`);
        expect(o.version === version, `${o.label}: ran ${o.version} (A only: ${o.onlyA.length}, B only: ${o.onlyB.length}), wanted ${version} whole`);
        if (red) expect(!o.red.length, `${o.label}: red notice "${o.red[0]}"`);
        expect(o.ms < under, `${o.label}: took ${o.ms} ms (limit ${under})`);
        expect(o.worker, `${o.label}: not under the worker`);
      };
      if (name === "unchanged") {
        srv.phase = "unchanged";
        const o = await openApp("third open"); r.third = o;
        check(o, "A", { under: 8000 });
        expect(o.requests <= 3, `the open made ${o.requests} requests to the site (wanted the page and at most 2 more)`);
        notes.push(`${o.requests} requests, ${o.ms} ms (the second open made ${reqLog.filter((q) => q.phase === "warm").length - 0} requests in all, warm phase)`);
        await o.page.close();
      }
      if (name === "stalled") {
        srv.stall = true; srv.phase = "stalled";
        const o = await openApp("stalled open"); r.stalled = o;
        check(o, "A", { under: 15000 });
        expect(o.answered === 0, `the site answered ${o.answered} request(s) although it was stalled`);
        expect(o.ms >= 3500, `opened in ${o.ms} ms: before the wait (the worker should ask the site first)`);
        notes.push(`${o.ms} ms with the site silent; ${o.requests} requests held`);
        await o.page.close();
      }
      if (name === "transition") {
        srv.deploy(); srv.phase = "deployed";
        const o = await openApp("open after the deploy"); r.after = o;
        check(o, "B", { under: 30000 });
        expect(o.onlyA.length === 0, `${o.label}: A files ran: ${o.onlyA.join(", ")}`);
        const c = await waitSaved(o.page, saved?.stamp);
        expect(!!c, "the open after the deploy did not become the saved copy");
        await o.page.close();
        srv.stall = true; srv.phase = "stalled";
        const s = await openApp("stalled open after"); r.stalled = s;
        check(s, "B", { under: 15000 });
        await s.page.close();
      }
      if (name === "old-whole") {
        srv.deploy(); srv.stall = true; srv.phase = "stalled";
        const o = await openApp("stalled open after a deploy"); r.stalled = o;
        check(o, "A", { under: 15000 });
        notes.push("the last whole set (A) opened; B' was never partly used");
        await o.page.close();
      }
      if (name === "mid-open") {
        srv.deploy(); srv.stallAfter(30); srv.phase = "mid";
        const o = await openApp("open, then silence", { wait: 120000 }); r.mid = o;
        check(o, "A", { under: 100000 });
        expect(!!o.healedAt, "the guard's one reload did not happen");
        notes.push(`${o.ms} ms in all, healed at ${o.healedAt ? "yes" : "no"}`);
        await o.page.close();
      }
      if (name === "flaky") {
        srv.deploy(); srv.drop = ["core/app.js"]; srv.phase = "flaky";
        const o = await openApp("open with core/app.js dropped"); r.flaky = o;
        expect(o.onlyA.length === 0 || o.onlyB.length === 0, `${o.label}: MIXED (A: ${o.onlyA.join(", ")}; B': ${o.onlyB.join(", ")})`);
        expect(!o.onlyA.length || !errors.length, "A files ran with errors");
        notes.push(`shows: ${JSON.stringify(o.text)}, red: ${JSON.stringify(o.red)}`);
        await o.page.close();
      }
      const ordered = Object.values(r).map((o) => ({ label: o.label, drew: o.drew, ms: o.ms, version: o.version, red: o.red, requests: o.requests, answered: o.answered, healedAt: o.healedAt, worker: o.worker, shot: o.shot }));
      return { name, ok: problems.length === 0, problems, notes, errors, opens: ordered };
    } finally {
      await ctx.close().catch(() => { });
      await srv.close();
      fs.rmSync(profile, { recursive: true, force: true });
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const chosen = opt("scenario", "all");
  const list = chosen === "all" ? SCENARIOS : chosen.split(",");
  for (const s of list) if (!SCENARIOS.includes(s)) { console.error(`unknown scenario ${s}`); process.exit(2); }
  const results = await run({ out: path.resolve(opt("out", "shots/static-stall")), a: opt("a", "worktree"), scenarios: list, port: Number(opt("port", "0")) });
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"} ${r.name}`);
    for (const o of r.opens) console.log(`  ${o.label}: drew=${o.drew} ${o.ms} ms, ran ${o.version}, requests ${o.requests} (answered ${o.answered}), red ${JSON.stringify(o.red)}`);
    for (const n of r.notes) console.log(`  note: ${n}`);
    for (const p of r.problems) console.log(`  PROBLEM: ${p}`);
    if (r.errors.length) console.log(`  page errors: ${r.errors.slice(0, 3).join(" | ")}`);
  }
  process.exitCode = results.every((r) => r.ok) ? 0 : 1;
}

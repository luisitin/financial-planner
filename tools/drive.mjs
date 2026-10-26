// tools/drive.mjs -- drive the app like a person would, from the command line, and report
// what happened. Built for the tester role (docs/TEAM.md) but anyone can use it.
//
//   node tools/drive.mjs balance/net-worth --eval "return qa.pageText()"
//   node tools/drive.mjs balance/net-worth --script qa/flows/add-account.js --shot after-add
//   node tools/drive.mjs balance/net-worth --script a.js --script b.js      (full reload between scripts)
//   node tools/drive.mjs overview/dashboard --desktop --dark --shot dash
//   node tools/drive.mjs overview/dashboard --profile mine --script seed.js  (profile is kept for later runs)
//   node tools/drive.mjs overview/dashboard --real ...                        (the REAL plan; default is the sandbox)
//
// Each script is the body of an async function running inside the page. `return` a value and
// it is printed as JSON. Helpers live on `qa` (defined below): qa.go, qa.fill, qa.type,
// qa.click, qa.clickText, qa.submit, qa.waitFor, qa.waitText, qa.text, qa.texts,
// qa.pageText, qa.plan, qa.status, qa.smallTargets, qa.overflow, qa.rect, qa.sleep.
//
// Output (JSON on stdout): { url, size, results: [...], console: [...], errors: [...],
// badResponses: [...], shots: [...] }. Exit code 1 when a script threw or the page had a
// JavaScript error, so a tester cannot miss it. With no script at all it reports the page
// title, the status pill, tap targets under 44 px and anything wider than the screen.
//
// Safety: by default the page is opened with ?sandbox=1, a pretend plan that lives only in
// the browser profile this tool creates (see core/store.js). The owner's real plan on the PC
// is never touched unless you pass --real. Profiles are temporary unless --profile <name>.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "shots");
fs.mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); if (i >= 0) { args.splice(i, 1); return true; } return false; };
const opt = (n, d) => { const i = args.indexOf(n); if (i >= 0) { const v = args[i + 1]; args.splice(i, 2); return v; } return d; };
const opts = (n) => { const out = []; let i; while ((i = args.indexOf(n)) >= 0) { out.push(args[i + 1]); args.splice(i, 2); } return out; };
const desktop = flag("--desktop"), dark = flag("--dark"), real = flag("--real");
const base = opt("--url", "http://127.0.0.1:8787").replace(/\/+$/, "");
const settle = Number(opt("--settle", "1200"));
const timeout = Number(opt("--timeout", "60000"));
const maxH = Number(opt("--max-height", "6000"));
const profileName = opt("--profile", "");
const shotName = opt("--shot", "");
const scripts = opts("--script").map((f) => ({ name: f, code: fs.readFileSync(path.resolve(ROOT, f), "utf8") }));
for (const e of opts("--eval")) scripts.push({ name: "--eval", code: e });
const page = args[0] ?? "overview/dashboard";
if (args.length > 1) { console.error("one page per run; got: " + args.join(" ")); process.exit(2); }
const isUrl = /^[a-z]+:/i.test(page);
const url = isUrl ? page : `${base}/${real ? "" : "?sandbox=1"}#/${page}`;
const size = desktop ? { name: "desktop", w: 1280, h: 900, scale: 1, mobile: false } : { name: "phone", w: 390, h: 844, scale: 2, mobile: true };

const browsers = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"];
const browser = browsers.find((b) => fs.existsSync(b));
if (!browser) { console.error("no Chrome/Edge found"); process.exit(1); }
const profile = profileName ? path.join(OUT, `.qa-${profileName.replace(/[^a-z0-9-]+/gi, "-")}`) : fs.mkdtempSync(path.join(OUT, ".drive-"));
fs.mkdirSync(profile, { recursive: true });
try { fs.rmSync(path.join(profile, "DevToolsActivePort"), { force: true }); } catch { }
const chrome = spawn(browser, ["--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-sync", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wsUrl = await (async () => {
  const f = path.join(profile, "DevToolsActivePort");
  for (let i = 0; i < 100; i++) {
    if (fs.existsSync(f)) {
      const lines = fs.readFileSync(f, "utf8").split(/\r?\n/);
      if (lines[0] && lines[1]) return `ws://127.0.0.1:${lines[0]}${lines[1]}`;
    }
    await sleep(200);
  }
  throw new Error("browser did not write DevToolsActivePort");
})();
const ws = new WebSocket(wsUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let nextId = 1; const pending = new Map(); const listeners = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const { res, rej } = pending.get(m.id); pending.delete(m.id); m.error ? rej(new Error(m.error.message)) : res(m.result); }
  else if (m.method) for (const l of [...listeners]) l(m);
};
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = nextId++; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params, sessionId })); });
const waitEvent = (method, sessionId, ms = 15000) => new Promise((res) => {
  const l = (m) => { if (m.method === method && m.sessionId === sessionId) { clearTimeout(t); listeners.splice(listeners.indexOf(l), 1); res(m.params); } };
  const t = setTimeout(() => { listeners.splice(listeners.indexOf(l), 1); res(null); }, ms);
  listeners.push(l);
});
async function killBrowser() {
  try { await send("Browser.close"); } catch { }
  try { ws.close(); } catch { }
  try { chrome.kill(); } catch { }
  if (!profileName) for (let i = 0; i < 20; i++) { await sleep(250); try { fs.rmSync(profile, { recursive: true, force: true }); break; } catch { } }
}

// Helpers injected into every document (they survive reloads). Plain script, no modules.
const PRELUDE = `
window.qa = {
  $: (s) => document.querySelector(s),
  $$: (s) => Array.from(document.querySelectorAll(s)),
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  el(x) { const e = typeof x === "string" ? document.querySelector(x) : x; if (!e) throw new Error("no element: " + x); return e; },
  async waitFor(sel, ms = 5000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const e = document.querySelector(sel); if (e) return e; await qa.sleep(100); } throw new Error("timeout waiting for " + sel); },
  async waitText(text, ms = 5000) { const t0 = Date.now(); const want = text.toLowerCase(); while (Date.now() - t0 < ms) { if ((document.body.innerText || "").toLowerCase().includes(want)) return true; await qa.sleep(100); } throw new Error("timeout waiting for text: " + text); },
  async go(hash, ms = 700) { location.hash = hash.startsWith("#") ? hash : "#/" + hash.replace(/^\\/+/, ""); await qa.sleep(ms); return qa.pageTitle(); },
  click(x) { const e = qa.el(x); e.click(); return e; },
  clickText(text, within = "button, a, .chip, .nav-link, [role=button]") { const want = text.toLowerCase(); const e = qa.$$(within).find((el) => el.textContent.trim().toLowerCase().includes(want)); if (!e) throw new Error("nothing clickable says: " + text); e.click(); return e; },
  type(x, value) { const e = qa.el(x); e.focus(); if (e.type === "checkbox") { e.checked = !!value; } else { e.value = value; } e.dispatchEvent(new Event("input", { bubbles: true })); e.dispatchEvent(new Event("change", { bubbles: true })); e.blur(); return e; },
  fill(label, value) { const want = label.toLowerCase(); const lab = qa.$$("label").find((l) => ((l.querySelector(".field-label") || l).textContent || "").trim().toLowerCase().startsWith(want)); if (!lab) throw new Error("no field labelled: " + label); const c = lab.querySelector("input, select, textarea") || (lab.htmlFor && document.getElementById(lab.htmlFor)); if (!c) throw new Error("label has no input: " + label); return qa.type(c, value); },
  submit(formSel) { const f = formSel ? qa.el(formSel) : document.querySelector("#content form"); if (!f) throw new Error("no form on the page"); if (f.requestSubmit) f.requestSubmit(); else f.submit(); return true; },
  text: (sel) => ((document.querySelector(sel) || {}).textContent || "").trim(),
  texts: (sel) => Array.from(document.querySelectorAll(sel)).map((e) => e.textContent.trim()),
  pageTitle: () => ((document.getElementById("page-title") || {}).textContent || "").trim(),
  pageText: () => ((document.getElementById("content") || {}).innerText || "").trim(),
  status: () => { const s = document.getElementById("status"); return s ? { text: s.textContent.trim(), kind: s.className, title: s.title } : null; },
  plan() { const key = new URLSearchParams(location.search).has("sandbox") ? "planner.plan.sandbox" : "planner.plan"; try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } },
  rect(x) { const r = qa.el(x).getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; },
  smallTargets(min = 44) { return qa.$$("#content button, #content a, #content input:not([type=checkbox]), #content select, #topbar button, #sidebar a, #sidebar button").filter((e) => e.offsetParent !== null).map((e) => ({ tag: e.tagName.toLowerCase(), text: (e.textContent || e.value || e.getAttribute("aria-label") || "").trim().slice(0, 40), h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width) })).filter((t) => t.h > 0 && t.h < min); },
  overflow() {
    // elements that stick out past the right edge of the screen, except those that live inside a box
    // that scrolls sideways on purpose (a table in .table-wrap) as long as that box itself fits
    const W = document.documentElement.clientWidth;
    const scrollsInside = (e) => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if ((o === "auto" || o === "scroll") && a.getBoundingClientRect().right <= W + 1) return true; } return false; };
    return qa.$$("body *").filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > W + 1 && getComputedStyle(e).position !== "fixed" && !scrollsInside(e); }).slice(0, 20).map((e) => ({ tag: e.tagName.toLowerCase(), class: e.className && String(e.className).slice(0, 60), right: Math.round(e.getBoundingClientRect().right), viewport: W }));
  },
};`;

const report = { url, size: size.name, dark, sandbox: !real && !isUrl, results: [], console: [], errors: [], badResponses: [], shots: [] };
let failed = false;
try {
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  await send("Network.enable", {}, sessionId);
  listeners.push((m) => {
    if (m.sessionId !== sessionId) return;
    if (m.method === "Runtime.consoleAPICalled") report.console.push({ type: m.params.type, text: m.params.args.map((a) => a.value ?? a.description ?? a.type).join(" ").slice(0, 400) });
    if (m.method === "Runtime.exceptionThrown") { const d = m.params.exceptionDetails; report.errors.push({ text: (d.exception?.description ?? d.text ?? "").slice(0, 600), url: d.url, line: d.lineNumber }); }
    if (m.method === "Network.responseReceived" && m.params.response.status >= 400) report.badResponses.push({ status: m.params.response.status, url: m.params.response.url });
    if (m.method === "Network.loadingFailed" && !m.params.canceled) report.badResponses.push({ status: "failed", url: m.params.errorText });
  });
  await send("Page.addScriptToEvaluateOnNewDocument", { source: PRELUDE }, sessionId);
  await send("Emulation.setDeviceMetricsOverride", { width: size.w, height: size.h, deviceScaleFactor: size.scale, mobile: size.mobile }, sessionId);
  if (size.mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true }, sessionId);
  if (dark) await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] }, sessionId);

  // Navigating to the same URL again only moves the #hash (no reload), so later scripts use Page.reload.
  const load = async (reload = false) => { const loaded = waitEvent("Page.loadEventFired", sessionId); await send(reload ? "Page.reload" : "Page.navigate", reload ? {} : { url }, sessionId); await loaded; await sleep(settle); };
  await load();
  const runs = scripts.length ? scripts : [{ name: "(none)", code: "return { title: qa.pageTitle(), status: qa.status(), smallTargets: qa.smallTargets(), overflow: qa.overflow() };" }];
  for (let i = 0; i < runs.length; i++) {
    if (i > 0) await load(true);   // full reload between scripts, same profile => same localStorage
    const r = await send("Runtime.evaluate", { expression: `(async () => { "use strict";\n${runs[i].code}\n})()`, awaitPromise: true, returnByValue: true, timeout }, sessionId);
    if (r.exceptionDetails) { failed = true; report.results.push({ script: runs[i].name, threw: (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text ?? "").slice(0, 800) }); }
    else report.results.push({ script: runs[i].name, result: r.result.value ?? null });
  }
  if (shotName) {
    await sleep(300);
    const { contentSize } = await send("Page.getLayoutMetrics", {}, sessionId);
    const fullH = Math.max(Math.min(size.h, maxH), Math.min(Math.ceil(contentSize.height), maxH));
    await send("Emulation.setDeviceMetricsOverride", { width: size.w, height: fullH, deviceScaleFactor: size.scale, mobile: size.mobile }, sessionId);
    await sleep(150);
    const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: size.w, height: fullH, scale: 1 } }, sessionId);
    const file = path.join(OUT, `qa-${shotName.replace(/[^a-z0-9-]+/gi, "-")}-${size.name}${dark ? "-dark" : ""}.png`);
    fs.writeFileSync(file, Buffer.from(data, "base64"));
    report.shots.push(file);
  }
  await send("Target.closeTarget", { targetId });
} catch (e) {
  failed = true;
  report.errors.push({ text: "driver: " + (e.stack ?? e.message ?? String(e)) });
} finally {
  await killBrowser();
}
if (report.errors.length) failed = true;
console.log(JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);

// tools/shot.mjs -- full-page screenshots through the Chrome DevTools protocol, with real
// phone emulation (390 CSS px, 2x, touch) and a desktop size. LOOK at a design change
// instead of guessing at it.
//
//   node tools/shot.mjs                          dashboard, phone + desktop
//   node tools/shot.mjs overview/dashboard balance/net-worth retirement/monte-carlo
//   node tools/shot.mjs --phone-only ...         (or --desktop-only)
//   node tools/shot.mjs --url http://<pc-lan-ip>:8787
//   node tools/shot.mjs file:///C:/x/page.html   (any URL works)
//   node tools/shot.mjs --dark ...               dark colour scheme
//   node tools/shot.mjs --max-height 1400 ...    only the top of a long page
//   node tools/shot.mjs --eval "document.getElementById('nav-toggle').click()"   open the drawer first
//   node tools/shot.mjs --pdf --desktop-only file:///C:/x/page.html            also print it to shots/<name>.pdf
//
// Output: shots/<name>-<phone|desktop>.png (git-ignored). Then Read the PNG.
//
// Why CDP and not --screenshot: on Windows Chrome refuses a window narrower than 500 CSS
// px, and Edge keeps a background process that swallows every screenshot after the first.
// Emulation.setDeviceMetricsOverride has neither problem. On Windows the launcher process
// exits at once while a child keeps running, so the DevTools address is read from the
// DevToolsActivePort file in the profile, not from stderr. No dependencies: Node 22+ has
// a global WebSocket.
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
const phoneOnly = flag("--phone-only"), desktopOnly = flag("--desktop-only"), dark = flag("--dark");
const base = opt("--url", "http://127.0.0.1:8787").replace(/\/+$/, "");
const settle = Number(opt("--settle", "1500"));
const maxH = Number(opt("--max-height", "6000"));   // cap for very long pages
const evalJs = opt("--eval", "");                     // run in the page before capture, e.g. "document.getElementById('nav-toggle').click()"
const wantPdf = flag("--pdf");                        // also print the page to shots/<name>.pdf (a real text-layer PDF; used to test the statement reader)
const pages = args.length ? args : ["overview/dashboard"];
const sizes = [];
if (!desktopOnly) sizes.push({ name: "phone", w: 390, h: 844, scale: 2, mobile: true });
if (!phoneOnly) sizes.push({ name: "desktop", w: 1280, h: 900, scale: 1, mobile: false });

const browsers = [process.env.CHROME, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/opt/pw-browsers/chromium", "/usr/bin/chromium", "/usr/bin/google-chrome"].filter(Boolean);
const browser = browsers.find((b) => fs.existsSync(b));
if (!browser) { console.error("no Chrome/Edge found"); process.exit(1); }
const profile = fs.mkdtempSync(path.join(OUT, ".profile-"));
const chrome = spawn(browser, ["--headless=new", "--disable-gpu", ...(process.platform === "linux" ? ["--no-sandbox"] : []), "--no-first-run", "--no-default-browser-check", "--disable-extensions", "--disable-sync", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });

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
  for (let i = 0; i < 20; i++) { await sleep(250); try { fs.rmSync(profile, { recursive: true, force: true }); break; } catch { } }
}

try {
  for (const page of pages) {
    const isUrl = /^[a-z]+:/i.test(page);
    const name = isUrl ? path.basename(page).replace(/\.[a-z]+$/i, "").replace(/[^a-z0-9-]+/gi, "-") : page.replace("/", "-");
    const url = isUrl ? page : `${base}/#/${page}`;
    for (const s of sizes) {
      const file = path.join(OUT, `${name}-${s.name}${dark ? "-dark" : ""}.png`);
      const { targetId } = await send("Target.createTarget", { url: "about:blank" });
      const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
      await send("Page.enable", {}, sessionId);
      await send("Emulation.setDeviceMetricsOverride", { width: s.w, height: s.h, deviceScaleFactor: s.scale, mobile: s.mobile }, sessionId);
      if (s.mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true }, sessionId);
      if (dark) await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: "dark" }] }, sessionId);
      const loaded = waitEvent("Page.loadEventFired", sessionId);
      await send("Page.navigate", { url }, sessionId);
      await loaded; await sleep(settle);
      if (evalJs) { await send("Runtime.evaluate", { expression: evalJs, awaitPromise: true }, sessionId); await sleep(400); }
      const { contentSize } = await send("Page.getLayoutMetrics", {}, sessionId);
      const fullH = Math.max(Math.min(s.h, maxH), Math.min(Math.ceil(contentSize.height), maxH));
      await send("Emulation.setDeviceMetricsOverride", { width: s.w, height: fullH, deviceScaleFactor: s.scale, mobile: s.mobile }, sessionId);
      await sleep(150);
      const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: s.w, height: fullH, scale: 1 } }, sessionId);
      fs.writeFileSync(file, Buffer.from(data, "base64"));
      if (wantPdf && !s.mobile) {
        const pdf = await send("Page.printToPDF", { printBackground: true, preferCSSPageSize: true }, sessionId);
        const pdfFile = path.join(OUT, `${name}.pdf`);
        fs.writeFileSync(pdfFile, Buffer.from(pdf.data, "base64"));
        console.log(pdfFile);
      }
      await send("Target.closeTarget", { targetId });
      console.log(`${file}  (${s.w}x${fullH} css px @${s.scale}x)`);
    }
  }
} finally {
  await killBrowser();
}

// ux/kit.mjs -- the shared browser kit for the touch-and-input stress test (2026-11-11).
// Every walker measures the same things the same way: what a tap changed, where the focus went, whether the screen
// jumped, whether a notice showed where the eye is, how long it took, and whether Back brings you back.
//
//   import { serve, households, open, census, state, act, tapText, fillBox, back, kb, shot, PHONE } from "<this file>";
//   const srv = await serve(ROOT, 9311);                       // your worktree, your port; srv.stop() when done
//   const H = await households(ROOT);                           // { empty, family, sam, jordan, patLee, ruth, freelancer, retiredCouple, demo }
//   const s = await open({ base: srv.base, plan: H.family(), route: "overview/dashboard" });   // phone, touch, sandbox
//   console.table(await census(s.page));                        // every control on the screen, with its problems
//   const r = await act(s.page, () => tapText(s.page, "Save"), "save income");   // before/after record
//   await shot(s.page, "/abs/path/x.png");                      // then Read the PNG
//   await s.close(); await srv.stop();
//
// Nothing here writes to the repo. Always the sandbox (?sandbox=1): a pretend plan in this browser only.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire("/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");

export const PHONE = { width: 390, height: 844 };
export const SMALL_PHONE = { width: 320, height: 568 };
export const LANDSCAPE = { width: 844, height: 390 };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Start the app's own server from a worktree on 127.0.0.1:port (writes a git-ignored planner.properties there). */
export async function serve(root, port) {
  const props = path.join(root, "planner.properties");
  // a port that already answers belongs to another agent's copy of the app: never test someone else's code by accident
  let taken = false;
  try { taken = (await fetch(`http://127.0.0.1:${port}/index.html`)).ok; } catch { }
  if (taken) throw new Error(`port ${port} is already serving another copy of the app: pick another port`);
  fs.writeFileSync(props, `server.port=${port}\nserver.bind=127.0.0.1\n`);
  const child = spawn("node", ["server/server.mjs"], { cwd: root, stdio: ["ignore", "pipe", "pipe"], detached: false });
  let log = ""; child.stdout.on("data", (d) => { log += d; }); child.stderr.on("data", (d) => { log += d; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`${base}/index.html`); if (r.ok) return { base, pid: child.pid, log: () => log, stop: async () => { try { child.kill(); } catch { } await sleep(200); } }; } catch { }
    await sleep(250);
  }
  try { child.kill(); } catch { }
  throw new Error(`server did not start on ${port}: ${log.slice(-600)}`);
}

/** The shared app every walker uses (read-only code, one server): returns its address, starting it if it is not up. */
export const APP_ROOT = "$SP/ux/app";
export async function ensure(port = 9300, root = APP_ROOT) {
  const base = `http://127.0.0.1:${port}`;
  const up = async () => { try { return (await fetch(`${base}/index.html`)).ok; } catch { return false; } };
  if (await up()) return base;
  fs.writeFileSync(path.join(root, "planner.properties"), `server.port=${port}\nserver.bind=127.0.0.1\n`);
  const child = spawn("node", ["server/server.mjs"], { cwd: root, stdio: "ignore", detached: true });
  child.unref();
  for (let i = 0; i < 60; i++) { if (await up()) return base; await sleep(250); }
  throw new Error(`the shared app did not start on ${port}`);
}

/** The invented households, built by the repo's own fixtures (functions: call one to get a fresh plan). */
export async function households(root = APP_ROOT, today = "2026-11-11") {
  const imp = (p) => import(path.join(root, p));
  const { emptyPlan, migrate } = await imp("core/schema/migrate.js");
  const out = { empty: () => null, blank: () => migrate(emptyPlan()) };
  const tryAdd = async (name, fn) => { try { out[name] = await fn(); } catch (e) { out[name] = null; out.__missing = [...(out.__missing ?? []), `${name}: ${e.message}`]; } };
  await tryAdd("family", async () => { const { familyPlan } = await imp("qa/fixtures/family-plan.mjs"); return () => familyPlan(today); });
  const P = await imp("qa/fixtures/setup-personas.mjs").catch(() => null);
  if (P) for (const n of ["sam", "jordan", "patLee", "ruth"]) await tryAdd(n, async () => () => (P.finishSetup ? P.finishSetup(n, P[n](today), today) : P[n](today)));
  if (P) for (const n of ["sam", "jordan", "patLee", "ruth"]) await tryAdd(`${n}MidSetup`, async () => () => P[n](today));   // stopped at the debts question
  await tryAdd("freelancer", async () => { const m = await imp("qa/fixtures/round8-households.mjs"); return () => m.freelancerPlan(); });
  await tryAdd("retiredCouple", async () => { const m = await imp("qa/fixtures/retired-couple-plan.mjs"); const f = m.retiredCouplePlan ?? m.default ?? Object.values(m).find((v) => typeof v === "function"); return () => f(today); });
  await tryAdd("demo", async () => { const m = await imp("qa/fixtures/demo-household.mjs"); const f = m.demoHousehold ?? m.demoPlan ?? m.default ?? Object.values(m).find((v) => typeof v === "function"); return () => f(today); });
  await tryAdd("renterDebt", async () => { const m = await imp("qa/fixtures/renter-debt-plan.mjs"); const f = m.renterDebtPlan ?? m.default ?? Object.values(m).find((v) => typeof v === "function"); return () => f(today); });
  return out;
}

// ---- what runs inside the page -------------------------------------------------------------------------------------------
const IN_PAGE = () => {
  if (window.__ux) return;
  const ux = (window.__ux = { cls: 0, shifts: [], long: 0, errors: [], t0: performance.now() });
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput || true) { ux.cls += e.value; ux.shifts.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4) }); } }).observe({ type: "layout-shift", buffered: true }); } catch { }
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) ux.long += e.duration; }).observe({ type: "longtask", buffered: true }); } catch { }
  addEventListener("error", (e) => ux.errors.push(String(e.message || e.error || e)));
  addEventListener("unhandledrejection", (e) => ux.errors.push("unhandled: " + String(e.reason?.message ?? e.reason)));
  const vis = (el) => {
    if (!el.isConnected) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0 || e.hidden) return false;
      if (e.tagName === "DETAILS" && !e.open && !(el.closest("summary")?.parentElement === e)) return false;
    }
    return true;
  };
  const nameOf = (el) => {
    const al = el.getAttribute("aria-label"); if (al) return al.trim();
    const lb = el.getAttribute("aria-labelledby"); if (lb) { const t = lb.split(/\s+/).map((id) => document.getElementById(id)?.textContent ?? "").join(" ").trim(); if (t) return t; }
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
      const l = el.labels?.[0] ?? (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null) ?? el.closest("label");
      if (l) { const c = l.cloneNode(true); c.querySelectorAll("input,select,textarea,.help").forEach((x) => x.remove()); const t = c.textContent.replace(/\s+/g, " ").trim(); if (t) return t; }
      const fl = el.closest(".field")?.querySelector(".field-label"); if (fl) return fl.textContent.replace(/\s+/g, " ").trim() + " (not tied to the box)";
      return el.placeholder ? `(placeholder only) ${el.placeholder}` : (el.title || "");
    }
    return (el.textContent || el.value || el.title || "").replace(/\s+/g, " ").trim().slice(0, 90);
  };
  const desc = (el) => {
    if (!el || el === document.body || el === document.documentElement) return null;
    const r = el.getBoundingClientRect();
    return { tag: el.tagName.toLowerCase(), type: el.getAttribute("type") || "", name: nameOf(el).slice(0, 80), id: el.id || "", top: Math.round(r.top), inView: r.bottom > 0 && r.top < innerHeight };
  };
  const SEL = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [tabindex]:not([tabindex="-1"]), label[for], [onclick], [contenteditable="true"]';
  ux.census = (opts = {}) => {
    const out = [];
    const all = [...document.querySelectorAll(SEL)];
    const topbar = document.getElementById("topbar")?.getBoundingClientRect().bottom ?? 0;
    for (const el of all) {
      if (!opts.hidden && !vis(el)) continue;
      const r = el.getBoundingClientRect();
      if (el.closest("#sidebar") && (r.right <= 0 || r.left >= innerWidth)) continue;   // the closed menu
      const cs = getComputedStyle(el);
      const cx = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), cy = r.top + r.height / 2;
      let covered = null;
      if (cy >= 0 && cy < innerHeight) { const hit = document.elementFromPoint(cx, cy); if (hit && hit !== el && !el.contains(hit) && !hit.contains(el) && !(el.tagName === "LABEL" || hit.closest("label")?.contains(el))) covered = (hit.tagName.toLowerCase() + (hit.id ? "#" + hit.id : "") + (hit.className && typeof hit.className === "string" ? "." + hit.className.split(" ")[0] : "")); }
      const isField = /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName);
      const name = nameOf(el);
      const filled = el.tagName === "BUTTON" || el.classList.contains("btn") ? !(el.classList.contains("secondary") || el.classList.contains("link") || el.classList.contains("ghost") || cs.backgroundColor === "rgba(0, 0, 0, 0)" || cs.backgroundColor === getComputedStyle(document.body).backgroundColor) : false;
      const problems = [];
      const tapW = r.width, tapH = r.height;
      const isInlineLink = el.tagName === "A" && cs.display.startsWith("inline") && !el.classList.contains("btn");
      if (el.tagName !== "LABEL" && !(isField && /^(checkbox|radio)$/.test(el.type) && el.closest("label")) && (tapH < 43.5 || tapW < 43.5) && !(isInlineLink && tapH >= 20 && false)) problems.push(`small target ${Math.round(tapW)}x${Math.round(tapH)}${isInlineLink ? " (inline link)" : ""}`);
      if (!name) problems.push("no name");
      if (r.right > innerWidth + 1 || r.left < -1) problems.push(`off the side (${Math.round(r.left)}..${Math.round(r.right)} of ${innerWidth})`);
      if (covered) problems.push(`covered by ${covered}`);
      if (isField && !/^(checkbox|radio|range|file|color)$/.test(el.type) && parseFloat(cs.fontSize) < 16) problems.push(`font ${cs.fontSize} (iPhone zooms under 16px)`);
      if (isField && name.includes("(not tied to the box)")) problems.push("label not tied to the box");
      if (isField && name.startsWith("(placeholder only)")) problems.push("placeholder is the only label");
      if (el.tagName === "INPUT" && /^(text|)$/.test(el.type) && !el.inputMode && /\$|amount|balance|payment|rate|year|age|%|price|income|pay\b|cost/i.test(name)) problems.push("number-like box with no numeric keyboard (inputmode)");
      if (el.tagName === "A" && (el.getAttribute("href") === "#" || el.getAttribute("href") === "")) problems.push("link to nowhere");
      if (cy >= 0 && cy < topbar && !el.closest("#topbar") && !el.closest("#sidebar")) problems.push("under the top bar");
      out.push({
        i: out.length, tag: el.tagName.toLowerCase(), type: el.getAttribute("type") || "", name: name.slice(0, 70),
        x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height),
        firstScreen: r.top + scrollY < innerHeight, filled, disabled: !!el.disabled || el.getAttribute("aria-disabled") === "true",
        inputmode: el.inputMode || "", autocomplete: el.getAttribute("autocomplete") || "", enterkeyhint: el.enterKeyHint || "",
        href: el.tagName === "A" ? el.getAttribute("href") : "", where: el.closest("#topbar") ? "topbar" : el.closest("#sidebar") ? "menu" : el.closest("[data-page]") ? "page" : "shell",
        value: isField ? String(el.type === "checkbox" || el.type === "radio" ? el.checked : el.value).slice(0, 30) : "",
        problems: problems.join("; "),
      });
    }
    return out;
  };
  ux.state = () => {
    const root = document.getElementById("content");
    const notices = [...document.querySelectorAll(".notice, .save-echo")].filter(vis).map((n) => { const r = n.getBoundingClientRect(); return { kind: (n.className.match(/\b(ok|error|warn|info|bad)\b/) || ["plain"])[0] + (n.classList.contains("save-echo") ? " echo" : ""), text: n.textContent.replace(/\s+/g, " ").trim().slice(0, 160), inView: r.bottom > 0 && r.top < innerHeight }; });
    const topbar = document.getElementById("topbar")?.getBoundingClientRect().bottom ?? 0;
    const filledNow = ux.census().filter((c) => c.filled && !c.disabled && c.where === "page" && c.y - scrollY >= topbar && c.y - scrollY < innerHeight).map((c) => c.name);
    const heads = [...(root?.querySelectorAll("h1,h2,h3") ?? [])].filter(vis).map((h) => h.tagName + ": " + h.textContent.replace(/\s+/g, " ").trim().slice(0, 60));
    const stepLine = (root?.textContent.match(/Step \d+ of \d+/) || [null])[0];
    return {
      hash: location.hash, title: document.getElementById("page-title")?.textContent ?? document.title, scrollY: Math.round(scrollY), docH: document.documentElement.scrollHeight, viewH: innerHeight,
      focus: desc(document.activeElement), notices, filledOnScreen: filledNow, headings: heads.slice(0, 8), step: stepLine,
      openFolds: document.querySelectorAll("details[open]").length, drawerOpen: (() => { const r = document.getElementById("sidebar")?.getBoundingClientRect(); return !!r && r.right > 10 && r.left < innerWidth - 10 && innerWidth < 900; })(),
      overflowX: document.documentElement.scrollWidth > innerWidth + 1, cls: +ux.cls.toFixed(4), long: Math.round(ux.long), errors: ux.errors.slice(-5),
      textLen: (root?.textContent ?? "").length, firstWords: (root?.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 140),
    };
  };
  // wait until the page stops changing (two quiet animation frames and no DOM mutation for `quiet` ms)
  ux.settle = (quiet = 250, max = 6000) => new Promise((res) => {
    const start = performance.now(); let last = performance.now();
    const mo = new MutationObserver(() => { last = performance.now(); });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    const tick = () => { const now = performance.now(); if (now - last >= quiet || now - start >= max) { mo.disconnect(); res(Math.round(last - start)); } else setTimeout(tick, 50); };
    setTimeout(tick, 50);
  });
};

/** Open the app on a phone (touch, 2x) in the sandbox, with a plan already in it (or none: first open). */
export async function open({ base, plan = null, route = "overview/dashboard", viewport = PHONE, dark = false, reducedMotion = false, slow = 1, query = "", touch = true } = {}) {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, isMobile: touch, hasTouch: touch, userAgent: touch ? UA : undefined, colorScheme: dark ? "dark" : "light", reducedMotion: reducedMotion ? "reduce" : "no-preference" });
  if (plan) await ctx.addInitScript((p) => { try { if (!sessionStorage.getItem("__seeded")) { localStorage.setItem("planner.plan.sandbox", p); sessionStorage.setItem("__seeded", "1"); } } catch { } }, JSON.stringify(plan));
  await ctx.addInitScript(IN_PAGE);
  const page = await ctx.newPage();
  const pageErrors = [], consoleErrors = [], failed = [];
  page.on("pageerror", (e) => pageErrors.push(String(e.message)));
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200)); });
  page.on("requestfailed", (r) => failed.push(r.url()));
  if (slow > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send("Emulation.setCPUThrottlingRate", { rate: slow }); }
  await page.goto(`${base}/?sandbox=1${query ? "&" + query : ""}#/${route}`, { waitUntil: "load" });
  await page.waitForSelector("#content [data-page], #content .notice", { timeout: 15000 }).catch(() => { });
  await settle(page);
  return { browser, ctx, page, pageErrors, consoleErrors, failed, close: () => browser.close() };
}

export const settle = (page, quiet = 250, max = 6000) => page.evaluate(([q, m]) => window.__ux?.settle(q, m), [quiet, max]).catch(() => null);
/** Every control a finger could touch on the screen as it is now (closed folds are not listed: open them first). */
export const census = (page, opts = {}) => page.evaluate((o) => window.__ux.census(o), opts);
/** Where things stand: address, scroll, focus, notices and whether they are in view, filled buttons on screen, layout shift so far. */
export const state = (page) => page.evaluate(() => window.__ux.state());
export async function go(page, route) { await page.evaluate((r) => { location.hash = "#/" + r; }, route); await sleep(60); await settle(page); return state(page); }

/**
 * Do one thing a person does and record what it changed. `doIt` is an async function that taps or types.
 * Returns { label, ms, before, after, moved: {navigated, scrollBy, focus, focusLost, newNotices, noticeOutOfView, shift, long, grew} }.
 */
export async function act(page, doIt, label = "") {
  const before = await state(page);
  const t0 = Date.now();
  let threw = null;
  try { await doIt(); } catch (e) { threw = String(e.message).split("\n")[0]; }
  const settleMs = await settle(page);
  const ms = Date.now() - t0;
  const after = await state(page);
  const seen = new Set(before.notices.map((n) => n.kind + n.text));
  const newNotices = after.notices.filter((n) => !seen.has(n.kind + n.text));
  const f = (x) => (x ? `${x.tag}${x.type ? ":" + x.type : ""} "${x.name}"${x.inView ? "" : " (off screen)"}` : "nothing (the page body)");
  return {
    label, ms, settleMs, threw, before, after,
    moved: {
      navigated: before.hash !== after.hash ? `${before.hash} -> ${after.hash}` : null,
      scrollBy: after.scrollY - before.scrollY,
      focus: `${f(before.focus)} -> ${f(after.focus)}`,
      focusLost: !!before.focus && !after.focus,
      focusOffScreen: !!after.focus && !after.focus.inView,
      newNotices, noticeOutOfView: newNotices.filter((n) => !n.inView).map((n) => n.text),
      shift: +(after.cls - before.cls).toFixed(4), long: after.long - before.long,
      grew: after.docH - before.docH, textChanged: after.textLen !== before.textLen || after.firstWords !== before.firstWords,
      filledOnScreen: after.filledOnScreen, errors: after.errors,
      nothingHappened: before.hash === after.hash && after.docH === before.docH && after.textLen === before.textLen && !newNotices.length && after.openFolds === before.openFolds && after.drawerOpen === before.drawerOpen && (before.focus?.name ?? "") === (after.focus?.name ?? ""),
    },
  };
}

/** Tap the visible control whose text or name matches (exact first, then contains), with a real touch. */
export async function tapText(page, text, { nth = 0, scope = "#content, #topbar, #sidebar" } = {}) {
  const loc = page.locator(scope).locator(`:is(button, a, summary, label, [role="button"], input[type="submit"], input[type="button"])`).filter({ hasText: text });
  const exact = page.locator(scope).getByRole("button", { name: text, exact: true });
  const use = (await exact.count()) > nth ? exact.nth(nth) : loc.nth(nth);
  await use.scrollIntoViewIfNeeded({ timeout: 4000 });
  await use.tap({ timeout: 4000 });
}
/** Tap the i-th control of the census (as listed now). */
export async function tapAt(page, c) { await page.evaluate((y) => scrollTo(0, Math.max(0, y - 300)), c.y); const y = await page.evaluate(() => scrollY); await page.touchscreen.tap(c.x + c.w / 2, c.y - y + c.h / 2); }
/** Type into the box with this label the way a thumb does: tap it, clear, type, and (by default) leave the box. */
export async function fillBox(page, label, value, { leave = true, enter = false, nth = 0 } = {}) {
  const box = page.getByLabel(label, { exact: false }).nth(nth);
  await box.scrollIntoViewIfNeeded({ timeout: 4000 });
  await box.tap({ timeout: 4000 });
  await box.fill("");
  await box.pressSequentially(String(value), { delay: 15 });
  if (enter) await page.keyboard.press("Enter");
  else if (leave) await box.evaluate((el) => el.blur());
}
/** The phone's Back (and Forward): did it bring you back to the same place? */
export async function back(page, dir = "back") {
  const before = await state(page);
  await page.evaluate((d) => (d === "back" ? history.back() : history.forward()), dir);
  await sleep(120); await settle(page);
  const after = await state(page);
  return { dir, from: before.hash, to: after.hash, scrollY: after.scrollY, focus: after.focus, title: after.title, firstWords: after.firstWords, after };
}
/** Pretend the on-screen keyboard is up (it takes about 336 px of an iPhone's 844): is the box you type in, and its button, still on screen? */
export async function kb(page, up = true) {
  const vp = page.viewportSize();
  await page.setViewportSize({ width: vp.width, height: up ? Math.max(300, vp.height - 336) : vp.height + 336 });
  await sleep(150);
  return page.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return { focused: null }; const r = a.getBoundingClientRect(); const form = a.closest("form, .form, .card"); const btn = form && [...form.querySelectorAll("button")].find((b) => !b.classList.contains("secondary")); const br = btn?.getBoundingClientRect(); return { focused: a.tagName, boxInView: r.top >= 0 && r.bottom <= innerHeight, boxTop: Math.round(r.top), viewH: innerHeight, button: btn?.textContent.trim().slice(0, 40) ?? null, buttonInView: br ? br.top >= 0 && br.bottom <= innerHeight : null }; });
}
export async function shot(page, file, { full = false } = {}) { fs.mkdirSync(path.dirname(file), { recursive: true }); await page.screenshot({ path: file, fullPage: full }); return file; }
/** The usable pages a household sees (the registry's manifests), as "group/id". */
export async function pages(root = APP_ROOT) {
  const { default: registry } = await import(path.join(root, "modules/registry.js"));
  const out = [];
  for (const r of registry) { const m = (await r.load()).default; if (m.status !== "planned" && !m.placeholder) out.push({ key: `${r.group}/${r.id}`, title: m.title, group: r.group, builderOnly: !!m.builderOnly, requires: m.requires || "", heavy: !!m.heavy }); }
  return out;
}

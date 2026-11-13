// qa/first-view.mjs -- the first screen in a browser (docs/OPTIONAL.md, check B): every usable page in each invented
// household's menu, on a phone (Playwright, real touch), in the sandbox, with the clock held at TODAY, measured as a
// person meets it, against the budgets of its kind of page (tests/first-view.kinds.mjs). Not part of `npm test` (it
// needs a browser and a few minutes); run it at the start of every phase beside qa/smoke-all.mjs, and before a push that
// touches a view. The Node check (tests/first-view/, qa/first-view-node.mjs) counts the whole first view; this one
// measures what only a browser can: where things land on the screen, what a tap moves, what is stored.
//
//   node qa/first-view.mjs                        every page, the four households (needs the app on 127.0.0.1:8787)
//   node qa/first-view.mjs --url http://127.0.0.1:9620   another copy of the app (any static server of this folder works)
//   node qa/first-view.mjs taxes/federal debt     some pages (a group name: every page in it)
//   node qa/first-view.mjs --only family,empty    some households       --jobs 2   browsers at once (default 4)
//   node qa/first-view.mjs --quick                the 390 px pass only (no 320 px pass, no ?more=all pass)
//   node qa/first-view.mjs --write                rewrite qa/first-view.known.json from what is measured now (the pages
//                                                 measured only); read its diff like code: a count may only go down
//   node qa/first-view.mjs --json after.json      the raw measurements too
//   node qa/first-view.mjs --compare before.json  a table of every page whose worst counts moved, before -> after
//   node qa/first-view.mjs --from run.json        judge (or --write) a run saved with --json, without measuring again
// Exit code 1 when a page fails (claude-a's folders never do: to-do lines only).
//
// Per household (family, renterDebt, retiredCouple from qa/fixtures, and the empty plan), three passes:
//  1. 390 x 844, touch: the first screen (what lies above 844 px): words and money or % figures (an answer page: at most
//     110 and 8); the headline (the page's h1, else its first tile) wholly above the bottom edge; on an answer or form page
//     the first filled button wholly above it; on a settings page the first card whole; on the empty plan a filled way to
//     start on the first screen. Then every shut section on the page is opened and shut by a real tap: the row stays where
//     it was (0 px), the row is at least 44 px tall, an open part (details[data-part]) is at most 1,300 px, and the plan
//     and every stored key outside the shell's own records of this tab (planner.more, planner.place, planner.trail,
//     planner.nav) are byte-identical afterwards. One reading part (kind more or how) makes the round trip of the memory:
//     open, reload, still open; shut, reload, shut; nothing kept for the page in planner.more afterwards. On a step of the
//     path (?guide=plan) the path's Next lies within 1,688 px of the top (two screens).
//  2. 320 x 568: nothing runs off the right edge.
//  3. ?more=all at 390 (both switches on for the visit): nothing runs off the side, no tap target under 44 px, at most
//     one filled button on the whole view.
// A JavaScript error on the page fails it in every pass.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const TODAY = "2026-11-13";
export const KNOWN_FILE = path.join(ROOT, "qa", "first-view.known.json");
export const PHONE = { width: 390, height: 844 }, SMALL_PHONE = { width: 320, height: 568 };
export const NEXT_WITHIN = 1688;        // two screens at 390 x 844 (R6)
export const PART_MAX = 1300;           // an open part, at most a screen and a half (R15)
export const TAPS_PER_PAGE = 12;        // shut sections tapped per page and household, in page order
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// the shell's own records of this tab and this phone, which a tap may change by design (core/place.js, core/router.js,
// core/app.js, core/ui/more.js); every other stored key must not move
const PRESENTATION = /^[LS]:planner\.(more|place|trail|nav)(\.sandbox)?$/;

/** The fields this check judges, with what each means; the budget of each per kind of page is in budgetOf(). */
export const FIELDS = {
  fsWords: "words on the first screen", fsFigs: "money and % figures on the first screen",
  headCut: "headline not wholly above the bottom edge", actCut: "first filled button not wholly above the bottom edge",
  cardCut: "first card not whole on the first screen", noStart: "no filled way to start on the first screen (empty plan)",
  nextFar: "the path's Next further than two screens down", wide320: "things running off the right edge at 320 px",
  tapMoved: "sections whose tap moved the page", rowShort: "section rows under 44 px", partTall: "open parts over 1,300 px",
  tapStored: "taps that changed the plan or a stored key", memory: "memory round trips that went wrong",
  moreWide: "things off the edge with ?more=all", moreSmall: "tap targets under 44 px with ?more=all",
  moreFilled: "filled buttons with ?more=all", errors: "JavaScript errors",
};
/** The budget of one field for a kind of page (R1's last column and the structure rules); null: not judged. */
export function budgetOf(kind, field, scope, K) {
  const fsb = K.FIRST_SCREEN?.[kind] ?? {};
  if (field === "fsWords") return fsb.words ?? null;
  if (field === "fsFigs") return fsb.figs ?? null;
  if (field === "headCut") return ["answer", "list", "form"].includes(kind) ? 0 : null;
  if (field === "actCut") return ["answer", "form"].includes(kind) ? 0 : null;
  if (field === "cardCut") return kind === "settings" ? 0 : null;
  if (field === "noStart") return scope === "empty" ? 0 : null;
  if (field === "moreFilled") return 1;
  return 0;
}

// ---------------------------------------------------------------- what runs inside the page
// (a plain function: Playwright sends its source to the page)
/* c8 ignore start */
function inPage() {
  if (window.__fv) return;
  const fv = (window.__fv = {});
  const FIG = /(\$\s?\d[\d,]*(\.\d+)?|\d[\d,.]*\s?%)/g;
  const squeeze = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
  const accent = () => { const p = document.createElement("span"); p.style.cssText = "background:var(--accent);position:absolute;visibility:hidden"; document.body.append(p); const c = getComputedStyle(p).backgroundColor; p.remove(); return c; };
  const content = () => document.getElementById("content");
  /** Seen on the phone: not inside a shut <details> (its summary excepted), not display:none, not hidden, not a read-out-only line, not aria-hidden. */
  fv.seen = (el, root = content()) => {
    for (let e = el; e && e !== root.parentElement; e = e.parentElement) {
      const p = e.parentElement;
      if (p && p.tagName === "DETAILS" && !p.open && p.querySelector(":scope > summary") !== e) return false;
      if (e.hidden || e.getAttribute?.("aria-hidden") === "true") return false;
      const cs = getComputedStyle(e);
      if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) return false;
      if (cs.position === "absolute" && /hidden|clip/.test(cs.overflow) && parseFloat(cs.width) <= 2 && parseFloat(cs.height) <= 2) return false;
    }
    return true;
  };
  const isBox = (el) => (el.tagName === "INPUT" && !/^(checkbox|radio|hidden|file|submit|button|reset|image)$/.test(el.type)) || el.tagName === "SELECT" || el.tagName === "TEXTAREA";
  // a filled button: the accent's own fill, as a person sees it (a chip that is on is a choice, not an action)
  fv.filledIn = (root, acc = accent()) => [...root.querySelectorAll("button, a.btn, input[type=submit]")].filter((b) => fv.seen(b) && b.getBoundingClientRect().height > 2 && getComputedStyle(b).backgroundColor === acc && !b.disabled && !b.closest(".chip, .chips"));
  /** A page that draws first and fills its answer in after the first paint says so (as opt/census.mjs reads it). */
  fv.waiting = () => {
    const root = content(); if (!root) return false;
    if (root.querySelector('[aria-busy="true"]')) return true;
    return /(Working (out|it out|\.)|Running (your|each)|Checking (your|what|that|the)|Loading|Thinking)[^.\n…]{0,80}(\.\.\.|…)/.test(root.innerText);
  };
  /** The measurements of the page as it stands, scrolled to the top. */
  fv.measure = () => {
    const root = content(), page = root.querySelector("[data-page]") ?? root;
    const H = innerHeight, W = document.documentElement.clientWidth, acc = accent();
    const out = { shown: root.querySelector("[data-page]")?.dataset.page ?? null, view: { words: 0, figs: 0, boxes: 0, tiles: 0, filled: 0, parts: 0, rows: 0 }, fs: { words: 0, figs: 0, filled: 0 } };
    const range = document.createRange();
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      const t = squeeze(n.data); if (!t) continue;
      const p = n.parentElement; if (!p || p.closest("select, option, script, style, textarea, template") || !fv.seen(p)) continue;
      const words = t.split(" ").filter((x) => /[A-Za-z0-9]/.test(x)).length, figs = (t.match(FIG) ?? []).length;
      out.view.words += words; out.view.figs += figs;
      range.selectNodeContents(n);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
      if (!rects.length) continue;
      const above = rects.filter((r) => r.top + r.height / 2 < H).length;
      if (above === rects.length) { out.fs.words += words; out.fs.figs += figs; }
      else if (above) {   // a text that runs over the edge: word by word
        const re = /\S+/g; for (let m; (m = re.exec(n.data));) { if (!/[A-Za-z0-9]/.test(m[0])) continue; range.setStart(n, m.index); range.setEnd(n, m.index + m[0].length); const r = range.getBoundingClientRect(); if (r.top + r.height / 2 < H) out.fs.words++; }
        FIG.lastIndex = 0; for (let m; (m = FIG.exec(n.data));) { range.setStart(n, m.index); range.setEnd(n, m.index + m[0].length); const r = range.getBoundingClientRect(); if (r.top + r.height / 2 < H) out.fs.figs++; }
      }
    }
    for (const el of root.querySelectorAll("input, select, textarea")) if (isBox(el) && fv.seen(el)) out.view.boxes++;
    for (const el of root.querySelectorAll(".stat")) if (fv.seen(el)) out.view.tiles++;
    for (const el of root.querySelectorAll("details")) if (!el.classList.contains("form-more") && fv.seen(el)) out.view.parts++;
    for (const el of root.querySelectorAll(".records > li:not(.rec-form), tbody > tr")) if (fv.seen(el)) out.view.rows++;
    const filled = fv.filledIn(root, acc);
    out.view.filled = filled.length;
    out.fs.filled = filled.filter((b) => b.getBoundingClientRect().bottom <= H).length;
    const box = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { text: squeeze(el.innerText ?? el.textContent).slice(0, 80), top: Math.round(r.top + scrollY), bottom: Math.round(r.bottom + scrollY) }; };
    const firstSeen = (sel) => [...page.querySelectorAll(sel)].find((e) => fv.seen(e) && e.getBoundingClientRect().height > 0) ?? null;
    out.head = box(firstSeen("h1") ?? firstSeen(".stat"));
    out.act = box(filled[0] ?? null);
    out.card = box(firstSeen(".card"));
    out.wide = fv.wide();
    out.docW = document.documentElement.scrollWidth; out.vw = W;
    // the shut sections a person can tap, in page order (marked so the runner can find each again)
    out.sections = [...root.querySelectorAll("details")].filter((d) => !d.open && fv.seen(d)).map((d, i) => {
      d.setAttribute("data-fv", String(i));
      const s = d.querySelector(":scope > summary"), r = (s ?? d).getBoundingClientRect();
      const title = squeeze(s?.querySelector(".fold-title")?.textContent ?? s?.textContent ?? "").slice(0, 60);
      return { i, title, part: d.dataset.part ?? null, kind: d.dataset.kind ?? null, h: Math.round(r.height), top: Math.round(r.top + scrollY) };
    });
    const next = document.querySelector("section.gn-root .gn-main a");
    out.next = next && fv.seen(next, document.body) ? box(next) : null;
    return out;
  };
  /** Things that stick out past the right edge (tools/drive.mjs qa.overflow: a box that scrolls sideways on purpose and fits is fine). */
  fv.wide = () => {
    const W = document.documentElement.clientWidth;
    const inside = (e) => { for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if ((o === "auto" || o === "scroll" || o === "hidden" || o === "clip") && a.getBoundingClientRect().right <= W + 1) return true; } return false; };
    const list = [...document.querySelectorAll("#content *, #topbar *")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > W + 1 && getComputedStyle(e).position !== "fixed" && !inside(e); });
    // count the outermost ones only (a wide card's children are not more problems)
    const top = list.filter((e) => !list.some((o) => o !== e && o.contains(e)));
    return { n: top.length + (document.documentElement.scrollWidth > W + 1 && !top.length ? 1 : 0), what: top.slice(0, 4).map((e) => `${e.tagName.toLowerCase()}${e.className ? "." + String(e.className).split(" ")[0] : ""} to ${Math.round(e.getBoundingClientRect().right)} px`) };
  };
  /** Tap targets under 44 px in the page (an inline link inside a sentence is exempt, as in WCAG 2.5.8). */
  fv.small = (min = 44) => [...content().querySelectorAll("button, a, input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, summary, [role=button]")]
    .filter((e) => fv.seen(e) && !(e.tagName === "A" && !e.classList.contains("btn") && getComputedStyle(e).display === "inline"))
    .map((e) => ({ e, r: e.getBoundingClientRect() })).filter(({ r }) => r.height > 0 && r.height < min - 0.5)
    .map(({ e, r }) => `${e.tagName.toLowerCase()} "${squeeze(e.textContent || e.value || e.getAttribute("aria-label")).slice(0, 30)}" ${Math.round(r.height)} px`);
  fv.storage = () => { const o = {}; try { for (const k of Object.keys(localStorage)) o["L:" + k] = localStorage.getItem(k); for (const k of Object.keys(sessionStorage)) o["S:" + k] = sessionStorage.getItem(k); } catch { } return o; };
  fv.restore = (b) => {
    for (const k of Object.keys(localStorage)) if (!("L:" + k in b)) localStorage.removeItem(k);
    for (const k of Object.keys(sessionStorage)) if (!("S:" + k in b)) sessionStorage.removeItem(k);
    for (const [k, v] of Object.entries(b)) (k.startsWith("L:") ? localStorage : sessionStorage).setItem(k.slice(2), v);
  };
  fv.section = (i) => document.querySelector(`#content details[data-fv="${i}"]`);
  fv.at = (i) => {
    const d = fv.section(i); if (!d) return null;
    const s = d.querySelector(":scope > summary") ?? d, r = s.getBoundingClientRect();
    const under = document.elementFromPoint(r.left + Math.min(40, r.width / 2), r.top + r.height / 2);
    const atEnd = Math.abs(scrollY - (document.documentElement.scrollHeight - innerHeight)) <= 1;
    return { open: d.open, y: Math.round(scrollY), top: Math.round(r.top), x: r.left, w: r.width, h: r.height, partH: Math.round(d.getBoundingClientRect().height - r.height), covered: !!under && !s.contains(under), atEnd };
  };
}
/* c8 ignore stop */

// ---------------------------------------------------------------- the runner
const settle = (p, quiet = 250, max = 6000) => p.evaluate(([q, m]) => new Promise((res) => {
  const start = performance.now(); let last = start;
  const mo = new MutationObserver(() => { last = performance.now(); });
  mo.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
  const tick = () => { const now = performance.now(); if (now - last >= q || now - start >= m) { mo.disconnect(); res(); } else setTimeout(tick, 50); };
  setTimeout(tick, 50);
}), [quiet, max]).catch(() => { });
async function drawn(p, max = 15000) {
  await p.waitForSelector("#content [data-page], #content .notice", { timeout: max }).catch(() => { });
  await settle(p);
  await p.evaluate(inPage);
  for (const t0 = Date.now(); Date.now() - t0 < max && await p.evaluate(() => window.__fv.waiting()).catch(() => false);) await sleep(150);
  await settle(p, 200);
  await p.evaluate(() => scrollTo(0, 0)); await sleep(60);
}
/** Go to a page inside the running app (a hash change, as the menu does) and wait until it has drawn. */
async function goTo(p, route) {
  await p.evaluate((r) => { location.hash = "#/" + r; }, route);
  await sleep(80);
  await drawn(p);
}
/**
 * A real tap on section i's row once the page is still; { a, b }: where it was before and after (b null: gone). The shell's
 * tap guard (core/taps.js) swallows a tap on the spot of the last one soon after the screen changed under it: the check
 * taps like a person who aims, so each tap lands at least 60 px from the last one (the left of the row, else its middle),
 * and a tap the guard still swallowed (the sandbox logs it in window.__swallowed) is made again once, a moment later.
 */
async function tapEl(p, i) {
  await p.evaluate((k) => window.__fv.section(k)?.querySelector(":scope > summary")?.scrollIntoView({ block: "center" }), i);
  let a = null;
  for (let n = 0; n < 12; n++) { await sleep(80); const x = await p.evaluate((k) => window.__fv.at(k), i); if (a && x && x.top === a.top && x.y === a.y) break; a = x; }
  if (!a) return null;
  const once = async (retry) => {
    const last = p.__lastTap ?? { t: 0, x: -999, y: -999 };   // per phone: households run side by side
    const y = a.top + a.h / 2;
    let x = a.x + Math.min(40, a.w / 2);
    if (Math.hypot(x - last.x, y - last.y) < 60) x = a.x + Math.min(a.w - 50, 220);
    const wait = (retry || Math.hypot(x - last.x, y - last.y) < 60 ? 900 : 250) - (Date.now() - last.t); if (wait > 0) await sleep(wait);
    // the tap's click comes a moment after the touch: wait for the section's own toggle (at most 1.2 s), then for stillness
    const swallowed = await p.evaluate((k) => { const d = window.__fv.section(k); window.__fv.toggled = new Promise((res) => { d?.addEventListener("toggle", () => res(true), { once: true }); setTimeout(() => res(false), 1200); }); return (window.__swallowed ?? []).length; }, i);
    await p.touchscreen.tap(x, y);
    p.__lastTap = { t: Date.now(), x, y };
    const toggled = await p.evaluate(() => window.__fv.toggled).catch(() => false);
    return toggled || (await p.evaluate(() => (window.__swallowed ?? []).length)) === swallowed;
  };
  if (!(await once(false))) { a = (await p.evaluate((k) => window.__fv.at(k), i)) ?? a; await once(true); }
  await settle(p, 150, 3000);
  const b = await p.evaluate((k) => window.__fv?.at(k) ?? null, i);
  return { a, b };
}

/** One household: open the app on a phone with its plan in the sandbox and measure every page (see the header). */
export async function runHousehold({ base, who, plan, pages, quick = false, log = () => { }, afterDraw = null }) {
  const { chromium } = await import(process.env.PLAYWRIGHT ?? "/opt/node22/lib/node_modules/playwright/index.mjs");
  const browser = await chromium.launch();
  const out = {};
  const errs = [];
  let current = null;
  try {
    const context = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: UA });
    await context.clock.setFixedTime(new Date(`${TODAY}T12:00:00`)).catch(() => { });
    await context.addInitScript((p) => { try { if (!sessionStorage.getItem("qa.seeded")) { if (p) localStorage.setItem("planner.plan.sandbox", p); sessionStorage.setItem("qa.seeded", "1"); } } catch { } }, plan ? JSON.stringify(plan) : "");
    const p = await context.newPage();
    p.setDefaultTimeout(10000);
    p.on("pageerror", (e) => errs.push({ at: current, what: String(e.message).split("\n")[0].slice(0, 160) }));
    const after = async () => { if (afterDraw) { await p.evaluate(afterDraw); await settle(p); await p.evaluate(inPage); } };
    const load = async (search, route) => { await p.goto(`${base}/?${search}#/${route}`, { waitUntil: "load" }); await drawn(p); await after(); };
    const reload = async () => { await p.reload({ waitUntil: "load" }); await drawn(p); await after(); };
    await load("sandbox=1", "overview/dashboard");
    const menu = new Set(await p.evaluate(() => [...document.querySelectorAll("#sidebar a[href^='#/']")].map((a) => a.getAttribute("href").slice(2).split("?")[0])));
    const mine = afterDraw ? pages : pages.filter((x) => menu.has(x.key));
    const skipped = pages.filter((x) => !mine.includes(x)).map((x) => x.key);
    const baseline = await p.evaluate(() => window.__fv.storage());
    const errorsOf = (key) => errs.filter((e) => e.at === key).length;
    const visit = async (key) => { current = key; if (afterDraw) await load("sandbox=1", key); else await goTo(p, key); };
    // pass 1: 390 x 844
    for (const { key, path: onPath } of mine) {
      const t0 = Date.now();
      const r = (out[key] = { who, key });
      try {
        await visit(key);
        const m = await p.evaluate(() => window.__fv.measure());
        Object.assign(r, { shown: m.shown, view: m.view, fs: m.fs, head: m.head, act: m.act, card: m.card });
        r.f = { fsWords: m.fs.words, fsFigs: m.fs.figs, headCut: m.head && m.head.bottom > PHONE.height ? 1 : 0, actCut: m.act && m.act.bottom > PHONE.height ? 1 : 0,
          cardCut: m.card && m.card.bottom > PHONE.height ? 1 : 0, noStart: plan ? 0 : (m.fs.filled ? 0 : 1) };
        // every shut section, opened and shut by a tap
        const before = await p.evaluate(() => window.__fv.storage());
        const taps = (r.taps = []);
        for (const s of m.sections.slice(0, TAPS_PER_PAGE)) {
          const open = await tapEl(p, s.i);
          if (!open || !open.b) { taps.push({ ...s, gone: true }); continue; }
          const shut = open.b.open ? await tapEl(p, s.i) : null;
          // how far the row moved under the finger; a shut that leaves the page shorter than where it was scrolled makes
          // the browser pull the page back to its new end: that is the browser's, not the page's
          const moved = (x, shutting) => (!x || !x.b || (shutting && x.b.atEnd && x.b.y < x.a.y) ? 0 : Math.max(Math.abs(x.b.top - x.a.top), Math.abs(x.b.y - x.a.y)));
          taps.push({ ...s, opened: open.b.open, covered: open.a.covered, moved: Math.max(moved(open, false), moved(shut, true)), partH: open.b.partH, shutAgain: shut?.b ? !shut.b.open : null });
        }
        const tapped = await p.evaluate(() => window.__fv.storage());
        const changed = Object.keys({ ...before, ...tapped }).filter((k) => before[k] !== tapped[k] && !PRESENTATION.test(k));
        r.storedChanged = changed;
        Object.assign(r.f, { tapMoved: taps.filter((t) => t.moved > 1).length, rowShort: m.sections.filter((s) => s.h < 43.5).length,
          partTall: taps.filter((t) => t.part && t.partH > PART_MAX).length, tapStored: changed.length ? 1 : 0, memory: 0 });
        // the memory's round trip, on the first reading part
        const reading = taps.find((t) => t.part && (t.kind === "more" || t.kind === "how") && !t.gone);
        if (!quick && reading) {
          const keyOf = `${key}#${reading.part}`;
          const sel = `#content details[data-part="${reading.part}"]`;
          const tapPart = async () => { await p.evaluate((s) => document.querySelector(s)?.setAttribute("data-fv", "memory"), sel); await tapEl(p, "memory"); await sleep(150); };
          const isOpen = () => p.evaluate((s) => !!document.querySelector(s)?.open, sel);
          const stored = () => p.evaluate((k) => { try { return JSON.parse(localStorage.getItem("planner.more.sandbox") ?? "null")?.parts?.[k] ?? null; } catch { return "unreadable"; } }, keyOf);
          let bad = 0;
          await p.evaluate((b) => window.__fv.restore(b), before);
          await visit("overview/dashboard"); await visit(key);
          await tapPart();
          if (!(await isOpen())) bad++;
          await reload();
          if (!(await isOpen())) bad++;
          await tapPart();
          await reload();
          if (await isOpen()) bad++;
          if ((await stored()) !== null) bad++;
          r.f.memory = bad;
          r.memoryPart = reading.part;
        }
        // back to where this page started, so the next page starts from the same phone
        const now = await p.evaluate(() => window.__fv.storage());
        if (Object.keys({ ...now, ...baseline }).some((k) => now[k] !== baseline[k] && !/^S:planner\.(place|trail)/.test(k))) await p.evaluate((b) => window.__fv.restore(b), baseline);
        // on a step of the path: Next within two screens
        r.f.nextFar = 0;
        if (onPath && plan) {
          await visit(`${key}?guide=plan`);
          const g = await p.evaluate(() => window.__fv.measure());
          r.next = g.next;
          if (g.next && g.next.top > NEXT_WITHIN) r.f.nextFar = 1;
          await p.evaluate((b) => window.__fv.restore(b), baseline);
        }
      } catch (e) { r.failed = String(e.message).split("\n")[0].slice(0, 160); }
      r.ms = Date.now() - t0;
    }
    if (!quick) {
      // pass 2: 320 x 568
      await p.setViewportSize(SMALL_PHONE);
      await load("sandbox=1", "overview/dashboard");
      for (const { key } of mine) {
        const r = out[key]; if (r.failed) continue;
        try { await visit(key); const w = await p.evaluate(() => window.__fv.wide()); r.f.wide320 = w.n; r.wide320 = w.what; } catch (e) { r.failed = `320 px: ${String(e.message).split("\n")[0].slice(0, 140)}`; }
      }
      // pass 3: both switches on for the visit
      await p.setViewportSize(PHONE);
      await load("sandbox=1&more=all", "overview/dashboard");
      for (const { key } of mine) {
        const r = out[key]; if (r.failed) continue;
        try {
          await visit(key);
          const w = await p.evaluate(() => window.__fv.wide()), small = await p.evaluate(() => window.__fv.small());
          const filled = await p.evaluate(() => window.__fv.filledIn(document.getElementById("content")).length);
          Object.assign(r.f, { moreWide: w.n, moreSmall: small.length, moreFilled: filled });
          r.moreSmall = small.slice(0, 4); r.moreWideWhat = w.what;
        } catch (e) { r.failed = `?more=all: ${String(e.message).split("\n")[0].slice(0, 140)}`; }
      }
    }
    for (const key of Object.keys(out)) { out[key].f = { ...(out[key].f ?? {}), errors: errorsOf(key) }; out[key].errorText = errs.filter((e) => e.at === key).map((e) => e.what).slice(0, 2); }
    log(`  ${who}: ${mine.length} pages${skipped.length ? ` (${skipped.length} not in this household's menu)` : ""}`);
    return { pages: out, skipped };
  } finally { await browser.close(); }
}

// ---------------------------------------------------------------- the rule
/** The worst of the plan households, and the empty plan, for one page: { plan: { field: [n, who] }, empty: {...} }. */
export function worst(rows) {
  const out = { plan: {}, empty: {} };
  for (const r of rows) {
    if (r.failed || !r.f) continue;
    const scope = r.who === "empty" ? "empty" : "plan";
    for (const [f, n] of Object.entries(r.f)) if (typeof n === "number" && (!out[scope][f] || n > out[scope][f][0])) out[scope][f] = [n, r.who];
  }
  return out;
}
/** judge(rows, kind, entry, K) -> { fails, notes }: the same only-down rule as the Node check. */
export function judge(rows, kind, entry, K) {
  const fails = [], notes = [], w = worst(rows), ent = entry ?? {};
  for (const r of rows) if (r.failed) fails.push(`${r.who}: could not be measured: ${r.failed}`);
  for (const scope of ["plan", "empty"]) for (const f of Object.keys(FIELDS)) {
    const v = w[scope][f], b = budgetOf(kind, f, scope, K);
    if (!v || b === null) continue;
    const [n, who] = v, allowed = ent[scope]?.[f], where = scope === "empty" ? "on the empty plan" : `(${who})`;
    if (allowed === undefined) { if (n > b) fails.push(`${FIELDS[f]}: ${n} ${where}; the budget is ${b}`); continue; }
    if (n > allowed) fails.push(`${FIELDS[f]}: ${n} ${where}, above this page's entry ${allowed} in qa/first-view.known.json (budget ${b}): a count there may only go down`);
    else if (n <= b) notes.push(`lower me: ${FIELDS[f]} ${n} ${where} is within the budget ${b}: delete "${scope}.${f}"`);
    else if ((f === "fsWords" ? Math.ceil(n / 10) * 10 : n) < allowed) notes.push(`lower me: ${FIELDS[f]} ${n} ${where}, the entry says ${allowed}: lower "${scope}.${f}" to ${f === "fsWords" ? Math.ceil(n / 10) * 10 : n}`);
  }
  return { fails, notes };
}
/** What the known file would hold for this page now, or null when it meets every budget. Words rounded up to ten. */
export function entryFor(rows, kind, K) {
  const w = worst(rows), e = {};
  for (const scope of ["plan", "empty"]) {
    const o = {};
    for (const f of Object.keys(FIELDS)) { const v = w[scope][f], b = budgetOf(kind, f, scope, K); if (v && b !== null && v[0] > b) o[f] = f === "fsWords" ? Math.ceil(v[0] / 10) * 10 : v[0]; }
    if (Object.keys(o).length) e[scope] = o;
  }
  return Object.keys(e).length ? e : null;
}
export function readKnown() { try { return JSON.parse(fs.readFileSync(KNOWN_FILE, "utf8")); } catch { return {}; } }
function writeKnown(entries) {
  const keys = Object.keys(entries).filter((k) => !k.startsWith("_")).sort();
  fs.writeFileSync(KNOWN_FILE, `{\n${[`  "_read": ${JSON.stringify(entries._read ?? "")}`, ...keys.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(entries[k])}`)].join(",\n")}\n}\n`);
}

// ---------------------------------------------------------------- the command
async function main() {
  const args = process.argv.slice(2);
  const flag = (n) => { const i = args.indexOf(n); if (i < 0) return false; args.splice(i, 1); return true; };
  const opt = (n, d = null) => { const i = args.indexOf(n); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
  const write = flag("--write"), quick = flag("--quick");
  const base = opt("--url", "http://127.0.0.1:8787").replace(/\/+$/, ""), jsonOut = opt("--json"), compare = opt("--compare"), from = opt("--from");
  const only = opt("--only"), jobs = Math.max(1, Number(opt("--jobs", 4)));
  const imp = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
  const K = await imp("tests/first-view.kinds.mjs");
  if (!from) try { const r = await fetch(`${base}/index.html`); if (!r.ok) throw new Error(String(r.status)); } catch (e) { console.error(`The app does not answer at ${base} (${e.message}). Start it first (npm run serve), or pass --url.`); process.exit(2); }
  const [{ default: registry }, { familyPlan }, { renterDebtPlan }, { retiredCouplePlan }, journeys] = await Promise.all([
    imp("modules/registry.js"), imp("qa/fixtures/family-plan.mjs"), imp("qa/fixtures/renter-debt-plan.mjs"), imp("qa/fixtures/retired-couple-plan.mjs"), imp("modules/overview/guide/journeys.js")]);
  const onPath = new Set((journeys.JOURNEYS.find?.((j) => j.id === journeys.PATH_ID) ?? Object.values(journeys.JOURNEYS).find((j) => j.id === journeys.PATH_ID))?.steps.map((s) => s.page) ?? []);
  const all = [];
  for (const e of registry) { const m = (await e.load()).default; if (m.status !== "planned" && !m.placeholder) all.push({ key: `${e.group}/${e.id}`, path: onPath.has(`${e.group}/${e.id}`) }); }
  const pages = args.length ? all.filter((x) => args.some((a) => x.key === a || x.key.split("/")[0] === a)) : all;
  const HOUSEHOLDS = { family: () => familyPlan(TODAY), renterDebt: () => renterDebtPlan(), retiredCouple: () => retiredCouplePlan(), empty: () => null };
  const saved = from ? JSON.parse(fs.readFileSync(path.resolve(from), "utf8")) : null;
  const hs = saved ? saved.households.filter((h) => !only || only.split(",").includes(h)) : Object.keys(HOUSEHOLDS).filter((h) => !only || only.split(",").includes(h));
  const t0 = Date.now();
  const byPage = {};
  if (saved) for (const { key } of pages) { const list = (saved.pages[key] ?? []).filter((r) => hs.includes(r.who)); if (list.length) byPage[key] = list; }
  else {
    console.error(`first view in a browser: ${hs.length} households x ${pages.length} pages at ${base}${quick ? " (390 px only)" : ""}`);
    const queue = [...hs], results = {};
    await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => {
      for (let who; (who = queue.shift());) results[who] = await runHousehold({ base, who, plan: HOUSEHOLDS[who](), pages, quick, log: (s) => console.error(s) });
    }));
    for (const who of hs) for (const [key, r] of Object.entries(results[who].pages)) (byPage[key] ??= []).push(r);
  }
  const known = readKnown(), rows = [], fails = [];
  const show = (o) => Object.entries(o ?? {}).map(([f, v]) => `${f} ${Array.isArray(v) ? v[0] : v}`).join(", ");
  for (const { key } of pages) {
    const list = byPage[key] ?? [];
    if (!list.length) { rows.push(`${key.padEnd(32)} -      in no household's menu`); continue; }
    const kind = K.KINDS[key]?.[0] ?? "answer", lane = K.CLAUDE_A_LANE.includes(key);
    const v = judge(list, kind, lane ? null : known[key], K);
    const w = worst(list);
    const over = entryFor(list, kind, K);
    const state = lane ? (v.fails.length ? "to-do" : "ok") : v.fails.length ? "FAIL" : known[key] ? "entry" : "ok";
    rows.push(`${key.padEnd(32)} ${kind.padEnd(9)} ${state.padEnd(6)} ${over ? `over: ${show(over.plan)}${over.empty ? ` | empty: ${show(over.empty)}` : ""}` : "within every budget"}${v.notes.filter((x) => x.startsWith("lower me")).length ? "  (lower me)" : ""}`);
    if (!lane && v.fails.length) fails.push(`${key}:\n    ${v.fails.join("\n    ")}`);
    void w;
  }
  console.log(rows.join("\n"));
  const secs = Math.round((Date.now() - t0) / 1000);
  console.log(`\n${pages.length} pages, ${hs.length} households, ${secs} s. ${fails.length} page(s) fail.`);
  if (jsonOut) fs.writeFileSync(path.resolve(jsonOut), JSON.stringify({ today: TODAY, households: hs, quick, pages: byPage }));
  if (compare) {
    const before = JSON.parse(fs.readFileSync(path.resolve(compare), "utf8")).pages ?? {};
    const lines = [];
    for (const key of Object.keys(byPage).sort()) {
      const a = worst(before[key] ?? []), b = worst(byPage[key]);
      const moved = [];
      for (const scope of ["plan", "empty"]) for (const f of Object.keys(FIELDS)) { const x = a[scope][f]?.[0], y = b[scope][f]?.[0]; if (x !== undefined && y !== undefined && x !== y) moved.push(`${scope === "empty" ? "empty " : ""}${f} ${x} -> ${y}`); }
      if (moved.length) lines.push(`${key.padEnd(32)} ${moved.join(", ")}`);
    }
    console.log(`\nBefore (${compare}) and after, the pages whose worst counts moved:\n${lines.join("\n") || "(none)"}`);
  }
  if (write && (hs.length < 4 || quick || saved?.quick)) { console.log("\n--write needs all four households and every pass (no --only, no --quick): the counts file was not written."); process.exitCode = 1; }
  else if (write) {
    const next = { ...known, _read: "Counts the first screen in a browser may not rise above (qa/first-view.mjs measures them; tests/first-view.kinds.mjs has the kinds and the first-screen budgets). Only pages over a budget are here: plan = the worst of family, renterDebt, retiredCouple, empty = the empty plan; each field is named in qa/first-view.mjs FIELDS. A count may only go down: lower it in the same commit as the change that brought it down. Rewritten by node qa/first-view.mjs --write; read the diff like code." };
    for (const { key } of pages) {
      if (K.CLAUDE_A_LANE.includes(key) || !byPage[key]) { delete next[key]; continue; }
      const e = entryFor(byPage[key], K.KINDS[key]?.[0] ?? "answer", K);
      if (e) next[key] = e; else delete next[key];
    }
    writeKnown(next);
    console.log(`wrote ${path.relative(ROOT, KNOWN_FILE)}${fails.length ? ": the counts below are written down now" : ""}`);
  }
  if (fails.length) { console.log(`\n${fails.length} page(s) fail the rule:\n  ${fails.join("\n  ")}`); if (!write || process.exitCode) process.exitCode = 1; }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(e); process.exitCode = 1; });

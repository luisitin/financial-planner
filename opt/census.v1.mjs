// opt/census.mjs -- the OPTIONALITY census (owner's rule 2026-11-12: "Default to less is more and allow more complexity or toggles").
// For 6 invented households x every usable page at 390x844 it records what a person meets WITHOUT a tap (first screen and
// whole page), what sits one tap away (every fold, chip row, toggle, "show more"), and whether the page leads with one
// answer and one filled action. Read-only: the sandbox plan, no file of the app is written (the kit's serve() writes a
// git-ignored planner.properties in the worktree copy).
//
//   node census.mjs                       full run: census.json, then the 40 heaviest first views into shots/
//   node census.mjs --only family,empty   some households        --pages debt/credit-cards,overview/dashboard   some pages
//   node census.mjs --jobs 3              browsers at once (default 4)      --no-probe   do not tap "show more" controls
//   node census.mjs --fresh               reload the app for every page (slower; proves hash navigation measures the same)
//   node census.mjs --out x.json          write somewhere else (a partial run never overwrites census.json unless asked)
//   node census.mjs shots                 only retake the 40 screenshots from census.json
//   node census.mjs report                only rebuild census-tables.md from census.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve, households, open, go, settle, sleep, shot, PHONE } from "$SP/ux/kit.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "app");
const PORT = 9801;
const TODAY = "2026-11-12";
const args = process.argv.slice(2);
const cmd = args[0] && !args[0].startsWith("--") ? args[0] : "run";
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const OUT = path.resolve(HERE, opt("out", "census.json"));
const SHOTS = path.join(HERE, "shots");

// the six households (kit households(root)): key in the kit, the name used in the report
export const HOUSEHOLDS = [
  ["empty", "empty", "no plan yet: the first open"],
  ["family", "family", "two earners, a child, a home, a mortgage, 10 accounts, 3 debts"],
  ["renterDebt", "renter", "single renter of 24 on $39,000 with three cards and a car loan"],
  ["retiredCouple", "retired", "a retired couple: pensions, Social Security, 6 accounts, no debts"],
  ["freelancer", "freelancer", "one self-employed person, 2 accounts"],
  ["jordanMidSetup", "midsetup", "one parent of two, stopped at the debts question of Get started"],
];

// ---------------------------------------------------------------- the load score (see census.md "The load score")
export const WEIGHTS = { word: 0.25, figure: 1, box: 4, picker: 4, check: 2, slider: 3, file: 3, chip: 0.5, button: 1, extraFilled: 3, chart: 4, table: 3, card: 1, smallLine: 0.5 };
export function load(c, W = WEIGHTS) {
  if (!c) return 0;
  const filled = c.filled ?? 0;
  const p = W.word * c.words + W.figure * (c.figMoney + c.figPct) + W.box * c.boxes + W.picker * c.pickers + W.check * c.checks + W.slider * c.sliders + W.file * c.files
    + W.chip * c.chips + W.button * (c.outlined + c.danger + Math.min(1, filled)) + W.extraFilled * Math.max(0, filled - 1)
    + W.chart * c.charts + W.table * (c.tables + c.records) + W.card * c.cards + W.smallLine * c.smallLines;
  return Math.round(p * 10) / 10;
}

// ---------------------------------------------------------------- what runs inside the page
const CX = () => {
  if (window.__cx) return;
  const cx = (window.__cx = {});
  const MONEY = /[-−–+]?\(?(?:US)?[$€£¥]\s?\d[\d,​]*(?:\.\d+)?(?:\s?(?:k|K|M|bn|million|billion|thousand)\b)?\)?/g;
  const PCT = /[-−–+]?\d[\d,​]*(?:\.\d+)?\s?%/g;
  const NUM = /\d[\d,​]*(?:\.\d+)?/g;
  const clean = (s, n = 120) => String(s ?? "").replace(/[​›‹▸▾▼▲]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
  const KEYS = ["boxes", "pickers", "checks", "sliders", "files", "readonly", "offBoxes", "filled", "outlined", "danger", "linkBtns", "offBtns", "chips", "links", "tiles",
    "figMoney", "figPct", "nums", "cards", "stats", "notices", "pills", "headings", "words", "wordsSmall", "wordsCtl", "smallLines", "charts", "bars", "tables", "tableRows", "records", "recordRows", "listItems", "folds", "foldsOpen"];
  const mk = () => Object.fromEntries(KEYS.map((k) => [k, 0]));
  const SMALL = ".help, .muted, small, .stat-sub, .rec-sub, .fold-status, .page-list .d, .action .d, .phase .d, figcaption";
  const NEVER_SMALL = "button, .btn, .chip, .pill, summary, th, h1, h2, h3";
  const NOT_SMALL_BY_SIZE = ".field-label, td, label, .stat-label, .rec-title, .rec-value, .num, .t";
  const MORE = /^(show|see|view|hide|open|close|expand|collapse)\b[^.]{0,40}\b(more|all|less|fewer|every|everything|rest|details?|math|how|why|steps|list|full|breakdown|numbers?|assumptions?)\b|^\W*more\b|\bmore\W*$|^(and |\+ ?)?\d+ more\b|\bmore (options|detail|details|choices|numbers|settings)\b/i;
  const ADD = /^\s*\+|\badd another\b|\banother\b/i;
  const OWN = /\b(set|type|use|enter|pick|choose) my own\b|\bmy own\b|\bfine.?tune\b|\badvanced\b|\bexact\b|\bcustom\b/i;
  const DEEP = /\bgo deeper\b|\bdeeper\b|\bmore on this\b|\bsee all\b|\bthe full\b|\bfull (list|page|picture|plan|story)\b/i;
  const nameOf = (el) => {
    const al = el.getAttribute("aria-label"); if (al) return clean(al, 80);
    const l = el.labels?.[0] ?? el.closest("label");
    if (l) { const c = l.cloneNode(true); c.querySelectorAll("input,select,textarea,.help,small").forEach((x) => x.remove()); const t = clean(c.textContent, 80); if (t) return t; }
    return clean(el.placeholder || el.title || el.name || "", 80);
  };

  cx.openAll = () => { let n = 0; for (const d of document.querySelectorAll("#content details:not([open])")) { d.open = true; n++; } return n; };
  cx.waiting = () => { const t = document.getElementById("content")?.innerText ?? ""; return /(Working (out|it out|\.)|Running (your|each)|Checking (your|what|that|the)|Loading|Thinking)[^.\n…]{0,80}(\.\.\.|…)/.test(t); };
  cx.storage = () => { const o = {}; try { for (const k of Object.keys(localStorage)) o["L:" + k] = localStorage.getItem(k); for (const k of Object.keys(sessionStorage)) o["S:" + k] = sessionStorage.getItem(k); } catch { } return o; };

  /** Count what is on the screen as it stands. pass "A": as loaded (marks every fold's state). pass "B": after every fold was opened. */
  cx.measure = (pass = "A") => {
    const root = document.getElementById("content");
    const VH = innerHeight, sy = scrollY, FOLD = VH;
    const vis = new Map();
    const isVis = (el) => {
      if (!el || el === document.body || el === document.documentElement) return true;
      let v = vis.get(el); if (v !== undefined) return v;
      v = isVis(el.parentElement);
      if (v) {
        const p = el.parentElement;
        if (p && p.tagName === "DETAILS" && !p.open && p.querySelector(":scope > summary") !== el) v = false;
        else {
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden" || cs.visibility === "collapse" || el.hidden || +cs.opacity === 0) v = false;
          else if (cs.position === "absolute" && /hidden|clip/.test(cs.overflow) && parseFloat(cs.width) <= 2 && parseFloat(cs.height) <= 2) v = false;   // read-out-only text
        }
      }
      vis.set(el, v); return v;
    };
    const accent = (() => { const p = document.createElement("span"); p.style.cssText = "background:var(--accent);position:absolute;visibility:hidden"; document.body.append(p); const c = getComputedStyle(p).backgroundColor; p.remove(); return c; })();
    const first = mk(), whole = mk();
    const details = [...root.querySelectorAll("details")];
    const acc = new Map(details.map((d) => [d, { boxes: 0, pickers: 0, checks: 0, btns: 0, chips: 0, links: 0, figs: 0, words: 0, charts: 0, tables: 0, smallLines: 0, nested: 0 }]));
    const FK = { boxes: "boxes", pickers: "pickers", sliders: "pickers", files: "pickers", checks: "checks", filled: "btns", outlined: "btns", danger: "btns", chips: "chips", links: "links", tiles: "links", figMoney: "figs", figPct: "figs", words: "words", charts: "charts", tables: "tables", records: "tables", smallLines: "smallLines" };
    // the hero card: the kit's .hero, else the first accent card, else the first card that carries the page's h1
    const heroEl = [...root.querySelectorAll(".hero")].find((e) => isVis(e)) ?? [...root.querySelectorAll(".card.accent")].find((e) => isVis(e)) ?? [...root.querySelectorAll(".card")].find((e) => isVis(e) && e.querySelector("h1") && isVis(e.querySelector("h1"))) ?? null;
    const hero = heroEl ? { cls: heroEl.className, top: 0, h: 0, words: 0, figs: 0, boxes: 0, filled: 0, outlined: 0, links: 0 } : null;
    const HK = { boxes: "boxes", pickers: "boxes", figMoney: "figs", figPct: "figs", words: "words", filled: "filled", outlined: "outlined", danger: "outlined", links: "links" };
    const credit = (el, key, n) => {
      if (FK[key]) for (let d = el.closest("details"); d; d = d.parentElement?.closest("details") ?? null) { const s = d.querySelector(":scope > summary"); if (s && s.contains(el)) continue; const a = acc.get(d); if (a) a[FK[key]] += n; }
      if (hero && HK[key] && heroEl.contains(el)) hero[HK[key]] += n;
    };
    const put = (key, el, isFirst, n = 1) => { whole[key] += n; if (isFirst) first[key] += n; credit(el, key, n); };
    const rectOf = (el) => { const r = el.getBoundingClientRect(); return r.width >= 2 && r.height >= 2 ? r : null; };
    const midFirst = (r) => r.top + sy + r.height / 2 < FOLD;
    const topFirst = (r) => r.top + sy < FOLD - 24;

    // ---- boxes, pickers, ticks
    const toggles = [];
    for (const el of root.querySelectorAll("input, select, textarea")) {
      if (!isVis(el)) continue; const r = rectOf(el); if (!r) continue;
      const t = el.tagName === "SELECT" ? "select" : el.tagName === "TEXTAREA" ? "textarea" : (el.getAttribute("type") || "text").toLowerCase();
      if (t === "hidden" || t === "submit" || t === "button" || t === "reset") continue;
      const f = midFirst(r);
      if (el.disabled) { put("offBoxes", el, f); continue; }
      if (t === "checkbox" || t === "radio") { put("checks", el, f); toggles.push({ kind: t, label: nameOf(el), on: !!el.checked, name: el.name || "", top: Math.round(r.top + sy), first: f, el }); continue; }
      if (el.readOnly) { put("readonly", el, f); continue; }
      if (t === "range") put("sliders", el, f);
      else if (t === "file") put("files", el, f);
      else if (t === "select" || /^(date|month|time|datetime-local|week|color)$/.test(t)) put("pickers", el, f);
      else put("boxes", el, f);
    }
    for (const el of root.querySelectorAll('[role="switch"], [role="checkbox"]')) { if (!isVis(el)) continue; const r = rectOf(el); if (!r) continue; put("checks", el, midFirst(r)); toggles.push({ kind: el.getAttribute("role"), label: clean(el.getAttribute("aria-label") || el.textContent, 80), on: el.getAttribute("aria-checked") === "true", name: "", top: Math.round(r.top + sy), first: midFirst(r), el }); }

    // ---- buttons, chips, links
    const more = [], chipEls = [];
    for (const el of root.querySelectorAll('button, a.btn, [role="button"], input[type="submit"], input[type="button"]')) {
      if (!isVis(el)) continue; const r = rectOf(el); if (!r) continue;
      const f = midFirst(r);
      const text = clean(el.textContent || el.value || el.getAttribute("aria-label") || "", 90);
      if (el.classList.contains("chip") || el.closest(".chips") || el.hasAttribute("aria-pressed") || /^(tab|radio)$/.test(el.getAttribute("role") || "")) { put("chips", el, f); chipEls.push(el); continue; }
      if (el.disabled || el.getAttribute("aria-disabled") === "true") { put("offBtns", el, f); continue; }
      const cs = getComputedStyle(el);
      const filled = cs.backgroundColor === accent;
      const danger = !filled && el.classList.contains("danger");
      put(filled ? "filled" : danger ? "danger" : "outlined", el, f);
      if (el.tagName === "A") put("linkBtns", el, f);
      const short = text.length <= 80; const kind = short && MORE.test(text) ? "more" : short && ADD.test(text) ? "add" : short && OWN.test(text) ? "own" : short && DEEP.test(text) ? "deeper" : el.hasAttribute("aria-expanded") ? "expander" : null;
      if (kind) more.push({ kind, text, tag: el.tagName.toLowerCase(), href: el.tagName === "A" ? el.getAttribute("href") : "", filled, inForm: !!el.closest("form"), type: el.getAttribute("type") || "", expanded: el.getAttribute("aria-expanded"), top: Math.round(r.top + sy), first: f, el });
    }
    for (const el of root.querySelectorAll("a[href]:not(.btn)")) {
      if (!isVis(el)) continue; const r = rectOf(el); if (!r) continue;
      const f = midFirst(r); const text = clean(el.textContent, 90);
      put(el.matches(".action, .stat-link") ? "tiles" : "links", el, f);
      const kind = text.length > 80 ? null : DEEP.test(text) ? "deeper" : MORE.test(text) ? "more" : ADD.test(text) ? "add" : null;
      if (kind) more.push({ kind, text, tag: "a", href: el.getAttribute("href"), filled: false, inForm: false, type: "", expanded: null, top: Math.round(r.top + sy), first: f, el });
    }

    // ---- blocks
    const blocks = [];
    for (const el of root.querySelectorAll(".card")) { if (!isVis(el)) continue; const r = rectOf(el); if (!r) continue; put("cards", el, topFirst(r)); if (!el.parentElement.closest(".card") && blocks.length < 40) blocks.push({ t: clean(el.querySelector("h1, h2, summary, h3")?.textContent ?? "", 60), top: Math.round(r.top + sy), h: Math.round(r.height), fold: el.tagName === "DETAILS" ? (el.open ? "open" : "shut") : "", hero: el === heroEl }); }
    for (const [sel, key] of [[".stat", "stats"], [".notice", "notices"], [".pill", "pills"], ["h1, h2, h3", "headings"], [".records", "records"], [".records > li", "recordRows"], ["table", "tables"], ["tbody tr", "tableRows"], ["li", "listItems"], ["canvas", "charts"]])
      for (const el of root.querySelectorAll(sel)) { if (!isVis(el)) continue; const r = rectOf(el); if (!r) continue; put(key, el, key === "stats" || key === "pills" || key === "recordRows" || key === "tableRows" || key === "listItems" || key === "headings" ? midFirst(r) : topFirst(r)); }
    const charts = [];
    for (const el of root.querySelectorAll("svg")) { if (!isVis(el)) continue; const r = rectOf(el); if (!r || r.width < 120 || r.height < 50) continue; put("charts", el, topFirst(r)); charts.push({ w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top + sy), label: clean(el.getAttribute("aria-label") || el.querySelector("title")?.textContent || "", 70) }); }
    for (const el of root.querySelectorAll('.progress, [class*="-bar"], [class*="meter"], [class*="-bars"]')) { if (!isVis(el) || el.closest("svg")) continue; const r = rectOf(el); if (!r || r.width < 80) continue; put("bars", el, topFirst(r)); }
    const tables = [...root.querySelectorAll("table")].filter((t) => isVis(t) && rectOf(t)).map((t) => { const w = t.closest(".table-wrap") ?? t.parentElement; return { rows: t.querySelectorAll("tbody tr").length, cols: t.querySelectorAll("thead th").length || t.rows[0]?.cells.length || 0, sideways: w.scrollWidth > w.clientWidth + 1 || t.getBoundingClientRect().right > innerWidth + 1, top: Math.round(t.getBoundingClientRect().top + sy) }; });

    // ---- text: words, figures, small print, big text
    const fsOf = new Map(); const fontSize = (el) => { let v = fsOf.get(el); if (v === undefined) { v = parseFloat(getComputedStyle(el).fontSize) || 15; fsOf.set(el, v); } return v; };
    const blockIds = new Map(); const blockOf = (el) => { let e = el; while (e && e !== root && /^inline/.test(getComputedStyle(e).display)) e = e.parentElement; if (!blockIds.has(e)) blockIds.set(e, blockIds.size); return e; };
    const lines = new Map();     // block element -> [{ c, w, small, first }]
    const big = new Map();
    const range = document.createRange();
    const countIn = (node, re, allFirst, noneFirst) => {
      let n = 0, nf = 0; re.lastIndex = 0;
      for (let m; (m = re.exec(node.data));) {
        n++;
        if (allFirst) nf++;
        else if (!noneFirst) { range.setStart(node, m.index); range.setEnd(node, m.index + m[0].length); const r = range.getBoundingClientRect(); if (r.top + sy + r.height / 2 < FOLD) nf++; }
        if (m.index === re.lastIndex) re.lastIndex++;
      }
      return [n, nf];
    };
    let svgWords = 0;
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!/\S/.test(n.data)) continue;
      const p = n.parentElement; if (!p || !isVis(p)) continue;
      if (p.closest("select, option, script, style, textarea, datalist, template, noscript")) continue;
      const wordsHere = (n.data.match(/\S+/g) ?? []).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
      if (p.closest("svg")) { svgWords += wordsHere; continue; }
      range.selectNodeContents(n);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0.5 && r.height > 0.5);
      if (!rects.length) continue;
      const fl = rects.map((r) => r.top + sy + r.height / 2 < FOLD);
      const allFirst = fl.every(Boolean), noneFirst = !fl.some(Boolean);
      let wf = allFirst ? wordsHere : 0;
      if (!allFirst && !noneFirst) { const re = /\S+/g; for (let m; (m = re.exec(n.data));) { if (!/[\p{L}\p{N}]/u.test(m[0])) continue; range.setStart(n, m.index); range.setEnd(n, m.index + m[0].length); const r = range.getBoundingClientRect(); if (r.top + sy + r.height / 2 < FOLD) wf++; } }
      whole.words += wordsHere; first.words += wf; credit(p, "words", wordsHere);
      const ctl = !!p.closest("button, .btn, .chip, summary, .field-label, label, a[href]");
      if (ctl) { whole.wordsCtl += wordsHere; first.wordsCtl += wf; }
      const fs = fontSize(p);
      const small = !p.closest(NEVER_SMALL) && (!!p.closest(SMALL) || (fs < 14.5 && !p.closest(NOT_SMALL_BY_SIZE)));
      if (small) { whole.wordsSmall += wordsHere; first.wordsSmall += wf; }
      const blk = blockOf(p); let arr = lines.get(blk); if (!arr) lines.set(blk, (arr = []));
      rects.forEach((r, i) => arr.push({ c: r.top + sy + r.height / 2, w: r.width, small, first: fl[i] }));
      const [m, mf] = countIn(n, MONEY, allFirst, noneFirst); if (m) { whole.figMoney += m; first.figMoney += mf; credit(p, "figMoney", m); }
      const rest = n.data.replace(MONEY, (x) => " ".repeat(x.length));
      const holder = { data: rest }; let pc = 0, pcf = 0, nu = 0;
      PCT.lastIndex = 0; for (let x; (x = PCT.exec(rest));) { pc++; if (allFirst) pcf++; else if (!noneFirst) { range.setStart(n, x.index); range.setEnd(n, x.index + x[0].length); const r = range.getBoundingClientRect(); if (r.top + sy + r.height / 2 < FOLD) pcf++; } }
      if (pc) { whole.figPct += pc; first.figPct += pcf; credit(p, "figPct", pc); }
      nu = (rest.replace(PCT, " ").match(NUM) ?? []).length; whole.nums += nu; if (allFirst) first.nums += nu; else if (!noneFirst) first.nums += Math.round(nu * fl.filter(Boolean).length / fl.length);
      if (fs >= 22 && !big.has(p) && /[\p{L}\p{N}]{2}/u.test(p.textContent) && !p.closest(".ic, .fold-chev, .stat-chev, .chev")) big.set(p, { fs, text: clean(p.textContent, 80), top: Math.round(rects[0].top + sy), fig: /\d/.test(p.textContent.replace(/\b(19|20)\d\d\b/g, "")), first: fl[0], inHero: !!heroEl && heroEl.contains(p) });
      void holder;
    }
    // a small-print line: a rendered line whose text is mostly small or muted helper text
    for (const [blk, arr] of lines) {
      arr.sort((a, b) => a.c - b.c);
      let cur = null; const flush = () => { if (cur && cur.sw > cur.w * 0.5) { whole.smallLines++; if (cur.first) first.smallLines++; credit(blk, "smallLines", 1); } };
      for (const x of arr) { if (!cur || x.c - cur.c > 7) { flush(); cur = { c: x.c, w: 0, sw: 0, first: x.first }; } cur.w += x.w; if (x.small) cur.sw += x.w; cur.c = Math.max(cur.c, x.c); }
      flush();
    }

    // ---- folds
    const folds = details.map((d, i) => {
      const s = d.querySelector(":scope > summary");
      const shown = isVis(d) && (!s || isVis(s));
      const r = (s ?? d).getBoundingClientRect();
      if (pass === "A") d.setAttribute("data-cx0", d.open ? "1" : "0");
      let depth = 0; for (let e = d.parentElement?.closest("details"); e; e = e.parentElement?.closest("details")) depth++;
      const st = s?.querySelector(".fold-status");
      const a = acc.get(d);
      for (let e = d.parentElement?.closest("details"); e; e = e.parentElement?.closest("details")) acc.get(e).nested++;
      if (shown) { whole.folds++; if (d.open) whole.foldsOpen++; if (r.top + sy + r.height / 2 < FOLD) { first.folds++; if (d.open) first.foldsOpen++; } }
      const kind = d.classList.contains("fold-card") || d.classList.contains("card") ? "card" : d.classList.contains("notice-details") ? "notice" : d.classList.contains("fold") ? "row" : "plain";
      const sumText = (() => { if (!s) return "(no summary)"; const c = s.cloneNode(true); c.querySelectorAll(".fold-status, .fold-chev").forEach((x) => x.remove()); return clean(c.textContent, 110); })();
      return { i, sum: sumText, status: st ? clean(st.textContent, 60) : "", kind, cls: clean(d.className, 50), open: d.open, open0: d.getAttribute("data-cx0") === null ? null : d.getAttribute("data-cx0") === "1", shown, depth, top: shown ? Math.round(r.top + sy) : null, first: shown && r.top + sy + r.height / 2 < FOLD, h: d.open ? Math.round(d.getBoundingClientRect().height - (s ? s.getBoundingClientRect().height : 0)) : 0, ...a };
    });
    details.forEach((d, i) => { folds[i].nested = acc.get(d).nested; });

    // ---- chip rows and toggles
    const hidden0 = (el) => { for (let d = el.closest("details"); d; d = d.parentElement?.closest("details") ?? null) { const s = d.querySelector(":scope > summary"); if (s && s.contains(el)) continue; const v = d.getAttribute("data-cx0"); if (v === "0") return true; if (v === null) return null; } return false; };
    const inFold = (el) => { for (let d = el.closest("details"); d; d = d.parentElement?.closest("details") ?? null) { const s = d.querySelector(":scope > summary"); if (s && !s.contains(el)) return clean(s.textContent, 60); } return ""; };
    const groups = new Map();
    for (const el of chipEls) { const g = el.closest(".chips") ?? el.parentElement; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(el); }
    const labelFor = (g) => { const al = g.getAttribute("aria-label"); if (al) return clean(al, 70); const lb = g.getAttribute("aria-labelledby"); if (lb) return clean(document.getElementById(lb)?.textContent, 70); let e = g.previousElementSibling; while (e && !clean(e.textContent)) e = e.previousElementSibling; if (e && /^(H2|H3|P|LABEL|SPAN|DIV|LEGEND|STRONG|B)$/.test(e.tagName) && clean(e.textContent).length < 90) return clean(e.textContent, 70); const lg = g.closest("fieldset")?.querySelector("legend"); if (lg) return clean(lg.textContent, 70); return clean(g.closest(".card, section")?.querySelector("h1, h2, h3, summary")?.textContent, 70); };
    const chipRows = [...groups].map(([g, els]) => { const r = g.getBoundingClientRect(); const on = (e) => e.classList.contains("on") || e.getAttribute("aria-pressed") === "true" || e.getAttribute("aria-selected") === "true" || e.getAttribute("aria-checked") === "true"; return { label: labelFor(g), chips: els.map((e) => clean(e.textContent, 40)), on: els.filter(on).map((e) => clean(e.textContent, 40)), n: els.length, cls: clean(g.className, 40), top: Math.round(r.top + sy), first: r.top + sy + Math.min(r.height, 44) / 2 < FOLD, hidden0: hidden0(g), inFold: inFold(g) }; });
    const tg = toggles.map(({ el, ...t }) => ({ ...t, row: !!el.closest(".toggle-row"), hidden0: hidden0(el), inFold: inFold(el) }));
    const mr = more.map(({ el, ...m }) => ({ ...m, hidden0: hidden0(el), inFold: inFold(el) }));
    cx.moreEls = more.map((m) => m.el);

    if (hero) { const r = heroEl.getBoundingClientRect(); hero.top = Math.round(r.top + sy); hero.h = Math.round(r.height); hero.title = clean(heroEl.querySelector("h1, h2")?.textContent ?? "", 80); hero.words = Math.round(hero.words); }
    const bigTexts = [...big.values()].sort((a, b) => a.top - b.top);
    const bigFirst = bigTexts.filter((b) => b.first);
    // the hero: the page's first accent card when it is on the first screen; else the first big text
    const FIG = { test: (t) => /\d/.test(String(t ?? "").replace(/\b(19|20)\d\d\b/g, "")) };   // a figure, not a year
    let heroKind = "none", heroText = "";
    if (hero && hero.top < FOLD - 60) {
      const inHero = bigTexts.filter((b) => b.first && b.inHero);
      heroText = hero.title || inHero[0]?.text || "";
      heroKind = FIG.test(hero.title) || inHero.some((b) => b.fig) ? "figure" : "words";
      if (!FIG.test(hero.title) && inHero.find((b) => b.fig)) heroText = `${heroText} / ${inHero.find((b) => b.fig).text}`;
    } else if (bigFirst.length) { const a = bigFirst[0]; heroKind = a.fig ? "bare figure" : "bare words"; heroText = a.text; }
    return {
      pass, docH: document.documentElement.scrollHeight, contentH: Math.round(root.getBoundingClientRect().height), vh: VH, scrollY: Math.round(sy), shown: root.querySelector("[data-page]")?.dataset.page ?? null,
      title: document.getElementById("page-title")?.textContent ?? "", first, whole, svgWords, folds, chipRows, toggles: tg, more: mr, hero, charts, tables, blocks,
      big: bigTexts.slice(0, 8), heroKind, heroText: clean(heroText, 120),
      bigFirst: bigFirst.length, bigFigFirst: bigFirst.filter((b) => b.fig).length,
      errorNotice: [...root.querySelectorAll(".notice.error")].filter((e) => isVis(e)).map((e) => clean(e.textContent, 120)).slice(0, 3),
      firstWords: clean(root.innerText, 160),
    };
  };
  /** Tap one "show more" control found by the last measure (index in its list). */
  cx.tapMore = (i) => { const el = cx.moreEls?.[i]; if (!el || !el.isConnected) return false; el.click(); return true; };
};

// ---------------------------------------------------------------- the runner
const install = async (page) => { await page.evaluate(CX); };
const measure = async (page, pass) => { await install(page); return page.evaluate((p) => window.__cx.measure(p), pass); };
async function waitWork(page, max = 15000) { const t0 = Date.now(); let waited = false; while (Date.now() - t0 < max && await page.evaluate(() => window.__cx.waiting()).catch(() => false)) { waited = true; await sleep(200); } if (waited) await settle(page, 200); return Date.now() - t0; }
const slim = (c) => c;
const totals = (c) => ({ boxes: c.boxes, pickers: c.pickers, checks: c.checks, btns: c.filled + c.outlined + c.danger, chips: c.chips, figs: c.figMoney + c.figPct, words: c.words });

async function censusPage(s, base, route, baseline, { probe = true, fresh = false } = {}) {
  const { page } = s;
  const t0 = Date.now();
  s.pageErrors.length = 0; s.consoleErrors.length = 0;
  if (fresh) { await page.goto("about:blank"); await page.goto(`${base}/?sandbox=1#/${route}`, { waitUntil: "load" }); await page.waitForSelector("#content [data-page], #content .notice", { timeout: 15000 }).catch(() => { }); await settle(page, 200); }
  else await go(page, route);
  await install(page);
  const workMs = await waitWork(page);
  const y0 = await page.evaluate(() => { const y = scrollY; scrollTo(0, 0); return y; });
  if (y0) await sleep(50);
  const A = await measure(page, "A");
  // everything open: what the folds hold
  let opened = 0;
  for (let round = 0; round < 5; round++) { const n = await page.evaluate(() => window.__cx.openAll()); if (!n) break; opened += n; await sleep(40); await settle(page, 150, 3000); await waitWork(page, 8000); }
  await page.evaluate(() => scrollTo(0, 0));
  const B = opened ? await measure(page, "B") : { ...A, pass: "B" };
  // match the folds of the two passes
  const foldsA = A.folds; const used = new Set();
  const folds = B.folds.map((f) => {
    let a = f.open0 !== null && foldsA[f.i] && foldsA[f.i].sum === f.sum ? foldsA[f.i] : null;
    if (!a) { const j = foldsA.findIndex((x, k) => !used.has(k) && x.sum === f.sum && x.depth === f.depth); if (j >= 0) a = foldsA[j]; }
    if (a) used.add(foldsA.indexOf(a));
    return { sum: f.sum, status: f.status, kind: f.kind, depth: f.depth, open0: a ? a.open : null, shown0: a ? a.shown : false, top0: a ? a.top : null, first0: a ? a.first : false, h: f.h, boxes: f.boxes, pickers: f.pickers, checks: f.checks, btns: f.btns, chips: f.chips, links: f.links, figs: f.figs, words: f.words, charts: f.charts, tables: f.tables, smallLines: f.smallLines, nested: f.nested };
  });
  // "show more" controls: tap the ones that are plain buttons outside a form and see what they add
  const probes = [];
  if (probe) {
    const seen = new Set();
    const pick = (m) => m.tag === "button" && !m.inForm && m.type !== "submit" && (m.kind === "more" || m.kind === "add" || m.kind === "own" || m.kind === "expander");
    const cands = B.more.filter((m) => pick(m) && !seen.has(m.text) && seen.add(m.text)).slice(0, 3);
    let before = opened ? await page.evaluate(() => window.__cx.measure("C")) : B;   // a fresh list of the controls as they stand
    for (const c of cands) {
      const i = before.more.findIndex((m) => pick(m) && m.text === c.text);
      if (i < 0) { probes.push({ text: c.text, kind: c.kind, gone: true }); continue; }
      const hash0 = await page.evaluate(() => location.hash);
      const ok = await page.evaluate((k) => window.__cx.tapMore(k), i).catch(() => false);
      if (!ok) { probes.push({ text: c.text, kind: c.kind, gone: true }); continue; }
      await sleep(40); await settle(page, 150, 3000);
      const hash1 = await page.evaluate(() => location.hash);
      if (hash1 !== hash0) { probes.push({ text: c.text, kind: c.kind, navigates: hash1 }); await go(page, route); break; }
      await install(page);
      const after = await page.evaluate(() => window.__cx.measure("C"));
      const d = (k) => after.whole[k] - before.whole[k];
      probes.push({ text: c.text, kind: c.kind, hidden0: c.hidden0, dH: after.docH - before.docH, dBoxes: d("boxes") + d("pickers"), dChecks: d("checks"), dBtns: d("filled") + d("outlined") + d("danger"), dFigs: d("figMoney") + d("figPct"), dWords: d("words"), dRows: d("recordRows") + d("tableRows") + d("listItems"), now: after.more.find((m) => m.top === before.more[i].top)?.text ?? "" });
      before = after;
    }
  }
  // did looking change anything it should not?
  const now = await page.evaluate(() => window.__cx.storage());
  const changed = Object.keys({ ...now, ...baseline }).filter((k) => now[k] !== baseline[k] && k !== "L:planner.nav");
  const planChanged = changed.some((k) => k.startsWith("L:planner.plan"));
  if (changed.length) {
    await page.evaluate((b) => { for (const k of Object.keys(localStorage)) if (k !== "planner.nav" && !("L:" + k in b)) localStorage.removeItem(k); for (const k of Object.keys(sessionStorage)) if (!("S:" + k in b)) sessionStorage.removeItem(k); for (const [k, v] of Object.entries(b)) { if (k === "L:planner.nav") continue; (k.startsWith("L:") ? localStorage : sessionStorage).setItem(k.slice(2), v); } }, baseline);
    await page.reload({ waitUntil: "load" }); await page.waitForSelector("#content [data-page], #content .notice", { timeout: 15000 }).catch(() => { }); await settle(page, 200);
  }
  const hidden = Object.fromEntries(Object.entries(totals(B.whole)).map(([k, v]) => [k, v - totals(A.whole)[k]]));
  return {
    page: route, title: A.title, shown: A.shown, redirected: A.shown !== route, px: A.docH, screens: +(A.docH / A.vh).toFixed(2), pxOpen: B.docH, screensOpen: +(B.docH / B.vh).toFixed(2), scrolledItself: y0,
    first: slim(A.first), whole: slim(A.whole), open: slim(B.whole), hidden,
    loadFirst: load(A.first), loadWhole: load(A.whole), loadOpen: load(B.whole),
    hero: A.hero, heroKind: A.heroKind, heroText: A.heroText, bigFirst: A.bigFirst, bigFigFirst: A.bigFigFirst, big: A.big, filledFirst: A.first.filled, filledWhole: A.whole.filled, oneFilledFirst: A.first.filled === 1,
    folds, chipRows: B.chipRows, toggles: B.toggles, more: B.more, probes, charts: A.charts, tables: A.tables, blocks: A.blocks, svgWords: A.svgWords,
    errorNotice: A.errorNotice, pageErrors: s.pageErrors.slice(0, 3), consoleErrors: s.consoleErrors.slice(0, 3), storageChanged: changed, planChanged, firstWords: A.firstWords, workMs, ms: Date.now() - t0,
  };
}

async function listPages() {
  const { default: registry } = await import(path.join(ROOT, "modules/registry.js"));
  const out = [];
  for (const r of registry) { const m = (await r.load()).default; if (m.status === "usable" || m.status === "complete") out.push({ key: `${r.group}/${r.id}`, title: m.title, group: r.group, order: m.order ?? 0, builderOnly: !!m.builderOnly, requires: m.requires || "", heavy: !!m.heavy }); }
  return out;
}

async function runHousehold(base, H, [key, name, what], pages, o) {
  const t0 = Date.now();
  const plan = H[key]();
  let s = await open({ base, plan, route: "overview/dashboard" });
  await install(s.page);
  let baseline = await s.page.evaluate(() => window.__cx.storage());
  const menu = new Set(await s.page.evaluate(() => [...document.querySelectorAll("#sidebar a[href^='#/']")].map((a) => a.getAttribute("href").slice(2))));
  const rows = [];
  for (const p of pages) {
    let row = null;
    for (let attempt = 0; attempt < 2 && !row; attempt++) {
      try { row = await censusPage(s, base, p.key, baseline, o); }
      catch (e) { console.error(`  ! ${name} ${p.key}: ${String(e.message).split("\n")[0]}${attempt ? " (gave up)" : " (retrying in a new browser)"}`); try { await s.close(); } catch { } s = await open({ base, plan, route: "overview/dashboard" }); await install(s.page); baseline = await s.page.evaluate(() => window.__cx.storage()); if (attempt) row = { page: p.key, failed: String(e.message).split("\n")[0] }; }
    }
    rows.push({ household: name, group: p.group, inMenu: menu.has(p.key), builderOnly: p.builderOnly, requires: p.requires, heavy: p.heavy, ...row });
  }
  await s.close();
  console.error(`  ${name}: ${rows.length} pages in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  return rows;
}

// ---------------------------------------------------------------- ranking, shots, tables
const usable = (r) => !r.failed;
const byPage = (rows) => { const m = new Map(); for (const r of rows) { if (!m.has(r.page)) m.set(r.page, []); m.get(r.page).push(r); } return m; };
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
export function rank(rows, key = "loadFirst") {
  const out = [];
  for (const [page, rs] of byPage(rows.filter(usable))) {
    const withPlan = rs.filter((r) => r.household !== "empty");
    const pool = withPlan.length ? withPlan : rs;
    const worst = pool.reduce((a, b) => (b[key] > a[key] ? b : a));
    out.push({ page, title: rs[0].title, med: median(pool.map((r) => r[key])), max: worst[key], worst, empty: rs.find((r) => r.household === "empty") ?? null, rows: rs, inMenu: rs.some((r) => r.inMenu) });
  }
  return out.sort((a, b) => b.med - a.med || b.max - a.max);
}

async function takeShots(rows, base, H, n = 40) {
  fs.rmSync(SHOTS, { recursive: true, force: true }); fs.mkdirSync(SHOTS, { recursive: true });
  const top = rank(rows.filter((r) => r.inMenu !== false)).sort((a, b) => b.max - a.max).slice(0, n);
  const byHouse = new Map();
  top.forEach((t, i) => { const h = t.worst.household; if (!byHouse.has(h)) byHouse.set(h, []); byHouse.get(h).push({ ...t, n: i + 1 }); });
  const index = [];
  for (const [h, list] of byHouse) {
    const hk = HOUSEHOLDS.find((x) => x[1] === h)[0];
    const s = await open({ base, plan: H[hk](), route: "overview/dashboard" });
    await install(s.page);
    for (const t of list) {
      await go(s.page, t.page); await install(s.page); await waitWork(s.page); await s.page.evaluate(() => scrollTo(0, 0)); await sleep(80);
      const file = path.join(SHOTS, `${String(t.n).padStart(2, "0")}-${t.page.replace("/", "-")}--${h}.png`);
      await shot(s.page, file);
      index.push({ n: t.n, page: t.page, title: t.title, household: h, loadFirst: t.max, file });
    }
    await s.close();
  }
  index.sort((a, b) => a.n - b.n);
  fs.writeFileSync(path.join(SHOTS, "index.json"), JSON.stringify(index, null, 1));
  return index;
}

async function main() {
  if (cmd === "report") { const { report } = await import("./census-report.mjs"); report(JSON.parse(fs.readFileSync(OUT, "utf8"))); return; }
  const srv = await serve(ROOT, PORT);
  const t0 = Date.now();
  try {
    const H = await households(ROOT, TODAY);
    if (H.__missing) console.error("missing households:", H.__missing);
    if (cmd === "shots") { const data = JSON.parse(fs.readFileSync(OUT, "utf8")); const idx = await takeShots(data.rows, srv.base, H); console.error(`${idx.length} shots in ${SHOTS}`); return; }
    const only = opt("only", ""); const pick = opt("pages", "");
    const hs = HOUSEHOLDS.filter((h) => !only || only.split(",").includes(h[1]) || only.split(",").includes(h[0]));
    const all = await listPages();
    const pages = pick ? all.filter((p) => pick.split(",").includes(p.key)) : all;
    const partial = !!only || !!pick;
    if (partial && OUT.endsWith("census.json") && !flag("force")) throw new Error("a partial run would overwrite census.json: pass --out other.json (or --force)");
    console.error(`census: ${hs.length} households x ${pages.length} pages at ${PHONE.width}x${PHONE.height}${flag("fresh") ? " (fresh load per page)" : ""}`);
    const jobs = Math.max(1, Number(opt("jobs", 4)));
    const queue = [...hs]; const rows = [];
    await Promise.all(Array.from({ length: Math.min(jobs, queue.length) }, async () => { for (let h; (h = queue.shift());) rows.push(...await runHousehold(srv.base, H, h, pages, { probe: !flag("no-probe"), fresh: flag("fresh") })); }));
    const order = new Map(HOUSEHOLDS.map((h, i) => [h[1], i])); const po = new Map(all.map((p, i) => [p.key, i]));
    rows.sort((a, b) => po.get(a.page) - po.get(b.page) || order.get(a.household) - order.get(b.household));
    const secs = Math.round((Date.now() - t0) / 1000);
    const data = { made: new Date().toISOString(), tip: "737fb6a", viewport: PHONE, today: TODAY, households: HOUSEHOLDS.map(([k, n, w]) => ({ key: k, name: n, what: w })), weights: WEIGHTS, pages: pages.length, censusSeconds: secs, rows };
    fs.writeFileSync(OUT, JSON.stringify(data));
    console.error(`wrote ${OUT}: ${rows.length} rows, ${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB, ${secs} s`);
    if (!flag("no-shots") && !partial) { const ts = Date.now(); const idx = await takeShots(rows, srv.base, H); console.error(`${idx.length} shots in ${SHOTS} (${Math.round((Date.now() - ts) / 1000)} s)`); }
    console.error(`whole run: ${Math.round((Date.now() - t0) / 1000)} s`);
  } finally { await srv.stop(); }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

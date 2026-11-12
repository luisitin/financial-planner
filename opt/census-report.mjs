// opt/census-report.mjs -- turns census.json into the tables of the report (node census.mjs report -> census-tables.md).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rank, load, WEIGHTS } from "./census.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLAUDE_A = new Set(["goals/emergency-fund", "goals/vehicle", "goals/travel", "goals/charitable", "debt/student-loans", "debt/consolidation", "taxes/state", "taxes/self-employment", "taxes/filing-status", "taxes/documents", "balance/projection", "balance/statement", "cashflow/statement"]);
const HS = ["empty", "family", "renter", "retired", "freelancer", "midsetup"];
const figs = (c) => c.figMoney + c.figPct, inp = (c) => c.boxes + c.pickers, btn = (c) => c.filled + c.outlined + c.danger + (c.quiet ?? 0);
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
const r1 = (n) => (Math.round(n * 10) / 10).toString();
const esc = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
const cut = (s, n) => { s = String(s ?? ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const tbl = (head, rows) => [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.map(esc).join(" | ")} |`)].join("\n");
const pg = (p) => `${p}${CLAUDE_A.has(p) ? " †" : ""}`;
const optional = (r) => ({ shut: r.folds.filter((f) => f.open0 === false).length, open: r.folds.filter((f) => f.open0 === true).length, chips: r.chipRows.length, toggles: r.toggles.filter((t) => t.row).length, more: r.more.filter((m) => m.kind !== "deeper").length });
const optCount = (r) => { const o = optional(r); return o.shut + o.chips + o.toggles + o.more; };
const spearman = (a, b) => { const rk = (v) => { const idx = v.map((x, i) => [x, i]).sort((p, q) => p[0] - q[0]); const out = Array(v.length); for (let i = 0; i < idx.length;) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) out[idx[k][1]] = (i + j) / 2; i = j + 1; } return out; }; const x = rk(a), y = rk(b), n = a.length, mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n; let num = 0, dx = 0, dy = 0; for (let i = 0; i < n; i++) { num += (x[i] - mx) * (y[i] - my); dx += (x[i] - mx) ** 2; dy += (y[i] - my) ** 2; } return num / Math.sqrt(dx * dy); };

export function report(data, { out = path.join(HERE, "census-tables.md"), shotsIndex = path.join(HERE, "shots", "index.json") } = {}) {
  const all = data.rows.filter((r) => !r.failed);
  const R = all.filter((r) => r.inMenu);                       // what a household is offered
  const P = R.filter((r) => r.household !== "empty");          // households with a plan
  const E = R.filter((r) => r.household === "empty");
  const pages = [...new Set(R.map((r) => r.page))];
  const shots = fs.existsSync(shotsIndex) ? JSON.parse(fs.readFileSync(shotsIndex, "utf8")) : [];
  const shotOf = new Map(shots.map((s) => [s.page, s]));
  const L = [];
  const say = (...x) => L.push(...x, "");
  // does the page lead with an answer drawn from the plan? Its big first line is a figure, or differs from the line the
  // empty plan gets on the same page (that one is the page's standing title or its "start here" line)
  const emptyHero = new Map(E.map((r) => [r.page, r.heroText]));
  const answers = (r) => r.heroKind !== "none" && (r.heroKind === "figure" || r.heroKind === "bare figure" || (r.heroText && r.heroText !== emptyHero.get(r.page)));
  const behind = (r) => Math.max(0, r.loadOpen - r.loadWhole);

  // ---------------------------------------------------------------- 1
  say("## 1. The numbers at a glance");
  say(`${data.rows.length} rows: ${data.households.length} households x ${data.pages} usable pages, ${data.viewport.width}x${data.viewport.height}, tip ${data.tip}, plan date ${data.today}. ${new Set(all.filter((r) => !r.inMenu).map((r) => r.page)).size} pages are not offered in the household's menu in the sandbox (builder pages, pages that need the AI helper or the PC): they are in census.json but not in the rankings. That leaves ${pages.length} pages x 6 = ${R.length} rows.`);
  say(tbl(["household", "pages over 1 screen", "over 2", "over 3", "screens: half / 9 in 10 / longest", "first-view load: half / 9 in 10 / top", "words on first screen (half / 9 in 10)", "figures on first screen (half / 9 in 10)", "pages with boxes on first screen", "pages with a filled button on first screen: 0 / 1 / 2+"],
    HS.map((h) => { const X = R.filter((r) => r.household === h); const f = (k, ps = [0.5, 0.9]) => ps.map((p) => r1(pct(X.map(k), p))).join(" / "); return [h, X.filter((r) => r.screens > 1.05).length, X.filter((r) => r.screens > 2).length, X.filter((r) => r.screens > 3).length, f((r) => r.screens, [0.5, 0.9, 1]), f((r) => r.loadFirst, [0.5, 0.9, 1]), f((r) => r.first.words), f((r) => figs(r.first)), X.filter((r) => inp(r.first) > 0).length, `${X.filter((r) => r.first.filled === 0).length} / ${X.filter((r) => r.first.filled === 1).length} / ${X.filter((r) => r.first.filled > 1).length}`]; })));
  const F = R.flatMap((r) => r.folds.map((f) => ({ ...f, page: r.page, household: r.household })));
  say(`Optional parts found (all ${R.length} rows): ${F.length} folds (${F.filter((f) => f.open0 === false).length} shut, ${F.filter((f) => f.open0 === true).length} open when the page opens), ${R.reduce((n, r) => n + r.chipRows.length, 0)} chip rows on ${new Set(R.filter((r) => r.chipRows.length).map((r) => r.page)).size} pages, ${R.reduce((n, r) => n + r.toggles.filter((t) => t.row).length, 0)} on/off switches on ${new Set(R.filter((r) => r.toggles.some((t) => t.row)).map((r) => r.page)).size} page(s), ${R.reduce((n, r) => n + r.toggles.filter((t) => !t.row).length, 0)} tick boxes inside forms, ${R.reduce((n, r) => n + r.more.filter((m) => m.kind === "add").length, 0)} "+ Add ..." openers, ${R.reduce((n, r) => n + r.more.filter((m) => m.kind === "expander").length, 0)} rows that open in place, ${R.reduce((n, r) => n + r.more.filter((m) => m.kind === "more").length, 0)} "show more/all" controls, ${R.reduce((n, r) => n + r.more.filter((m) => m.kind === "deeper").length, 0)} "go deeper/see all" links, ${R.reduce((n, r) => n + r.more.filter((m) => m.kind === "own").length, 0)} "my own" openers.`);
  const noOpt = pages.filter((p) => P.filter((r) => r.page === p).every((r) => optCount(r) === 0));
  say(`Pages with no optional part at all for any household with a plan: ${noOpt.length} of ${pages.length}. Pages with at least one shut fold for some household: ${pages.filter((p) => P.some((r) => r.page === p && optional(r).shut > 0)).length}.`);
  const sumP = (f) => P.reduce((n, r) => n + f(r), 0);
  say(`How much is optional today (the five households with a plan, ${P.length} rows): the pages show ${Math.round(sumP((r) => r.loadWhole))} load points without a tap and hold ${Math.round(sumP(behind))} more behind shut folds, so ${Math.round(100 * sumP(behind) / (sumP((r) => r.loadWhole) + sumP(behind)))}% of what the app can show is opt-in (${Math.round(100 * sumP((r) => (r.page === "ai/glossary" || r.page === "system/help" || r.page === "system/settings" || r.page === "overview/guesses" ? 0 : behind(r))) / (sumP((r) => (r.page === "ai/glossary" || r.page === "system/help" || r.page === "system/settings" || r.page === "overview/guesses" ? 0 : r.loadWhole + behind(r)))))}% leaving out the Glossary, Help, Settings and Our guesses, which are lists of folds). Boxes: ${sumP((r) => inp(r.whole))} show without a tap, ${sumP((r) => inp(r.open) - inp(r.whole))} more sit behind folds.`);
  say(`Looking never changed anything: across all ${data.rows.length} rows, opening every fold (${data.rows.reduce((n, r) => n + r.folds.filter((f) => f.open0 === false).length, 0)} of them) and tapping ${data.rows.reduce((n, r) => n + r.probes.length, 0)} openers left the saved plan and the browser's storage exactly as they were (${data.rows.filter((r) => r.storageChanged?.length).length} rows changed). ${data.rows.filter((r) => r.pageErrors?.length || r.errorNotice?.length || r.failed).length} rows had a page error; ${data.rows.filter((r) => r.redirected).length} were sent to another page.`);

  // ---------------------------------------------------------------- 2
  const rk = rank(R).sort((a, b) => b.max - a.max);
  say("## 2. The heaviest first views (what the first 390x844 screen holds, no tap)");
  say("Ranked by the worst first view any household with a plan meets (the screenshot is of that household); `half` is the median over the five households with a plan. † = one of claude-a's 13 pages (hand-over, not ours to edit).");
  say(tbl(["#", "page", "worst for", "load", "half", "words", "figures", "boxes", "buttons filled+outlined+plain", "cards", "small-print lines", "charts+tables", "leads with", "screens", "shot"],
    rk.slice(0, 40).map((t, i) => { const w = t.worst, c = w.first; return [i + 1, `${pg(t.page)} (${t.title})`, w.household, r1(t.max), r1(t.med), c.words, figs(c), inp(c), `${c.filled}+${c.outlined + c.danger}+${c.quiet}`, c.cards, c.smallLines, c.charts + c.tables + c.records, `${w.heroKind}: ${cut(w.heroText, 34)}`, w.screens, shotOf.has(t.page) ? path.basename(shotOf.get(t.page).file) : ""]; })));

  // ---------------------------------------------------------------- 3
  const rw = rank(R, "loadWhole").sort((a, b) => b.max - a.max);
  say("## 3. The heaviest pages (the whole page as it opens, every scroll, no tap)");
  say("`behind folds` is the load that shows only after opening every fold; `optional share` = behind folds / (shown + behind folds). A long page with a low share has nothing a person can leave shut.");
  say(tbl(["#", "page", "worst for", "screens", "load", "half", "words", "figures", "boxes", "buttons", "cards", "rows in lists/tables", "folds shut/open", "behind folds", "optional share", "screens with all open"],
    rw.slice(0, 40).map((t, i) => { const w = t.worst, c = w.whole, o = optional(w); const behind = Math.max(0, w.loadOpen - w.loadWhole); return [i + 1, `${pg(t.page)} (${t.title})`, w.household, w.screens, r1(t.max), r1(t.med), c.words, figs(c), inp(c), btn(c), c.cards, c.recordRows + c.tableRows, `${o.shut}/${o.open}`, r1(behind), `${Math.round(100 * behind / Math.max(1, w.loadOpen))}%`, w.screensOpen]; })));

  // ---------------------------------------------------------------- 4
  say("## 4. The lightest good examples (simple first, detail on request, already)");
  say("A row qualifies when a household with a plan gets ALL of: an answer drawn from the plan in the big first line; at most one filled button and no box on the first screen; a first-screen load of 50 or less; the page as it opens no longer than 2.2 screens; and real depth one tap away (15 or more load points behind shut folds, a chip row, or an opener). One line per page: the household with the most behind the folds.");
  const good = P.filter((r) => answers(r) && r.first.filled <= 1 && inp(r.first) === 0 && r.loadFirst <= 50 && r.screens <= 2.2 && (behind(r) >= 15 || r.chipRows.some((c) => c.hidden0 === false) || r.more.some((m) => m.kind !== "deeper" && m.hidden0 === false)));
  const gBy = new Map(); for (const r of good) { const x = gBy.get(r.page); if (!x || behind(r) > behind(x)) gBy.set(r.page, r); }
  const goodList = [...gBy.values()].sort((a, b) => a.loadFirst - b.loadFirst);
  say(tbl(["page", "household", "first-view load", "screens (all open)", "leads with", "filled on first screen", "words / figures on first screen", "one tap away", "load behind folds", "households that qualify"],
    goodList.map((r) => [`${pg(r.page)} (${r.title})`, r.household, r1(r.loadFirst), `${r.screens} (${r.screensOpen})`, cut(r.heroText, 50), r.first.filled, `${r.first.words} / ${figs(r.first)}`, cut([...r.folds.filter((f) => f.open0 === false && f.depth === 0).map((f) => `fold "${cut(f.sum, 34)}"${f.status ? ` [${cut(f.status, 24)}]` : ""}`), ...r.chipRows.filter((c) => !c.hidden0).map((c) => `chips: ${cut(c.chips.join(" / "), 50)}`), ...r.more.filter((m) => m.kind !== "deeper" && !m.hidden0 && m.kind !== "expander").map((m) => `"${cut(m.text, 30)}"`)].join("; "), 200), r1(behind(r)), good.filter((x) => x.page === r.page).map((x) => x.household).join(", ")])));
  say(`${goodList.length} of ${pages.length} pages qualify for at least one household with a plan; ${[...gBy.keys()].filter((p) => good.filter((x) => x.page === p).length >= 3).length} qualify for three or more.`);

  // ---------------------------------------------------------------- 5
  say("## 5. Boxes with no way to leave them shut");
  say("A 390x844 screen holds about 9 labelled boxes (label 20 px + box 44 px + gap 17 px, under the 56 px top bar). `optional parts` counts shut folds, chip rows, on/off switches and \"+ Add\" / \"show more\" openers on the page.");
  say("### 5a. Zero optional parts and 6 or more boxes showing (9+ is more than a screen of boxes)");
  const z = R.filter((r) => optCount(r) === 0 && inp(r.whole) >= 6).sort((a, b) => inp(b.whole) - inp(a.whole));
  const zBy = new Map(); for (const r of z) { if (!zBy.has(r.page)) zBy.set(r.page, []); zBy.get(r.page).push(r); }
  say(tbl(["page", "boxes showing (most)", "households", "must-fill boxes", "already filled", "forms (boxes each)", "screens", "the boxes"],
    [...zBy.entries()].map(([p, rs]) => { const w = rs[0]; return [`${pg(p)} (${w.title})`, inp(w.whole), rs.map((r) => `${r.household} ${inp(r.whole)}`).join(", "), w.whole.boxesReq, w.whole.boxesFilled, w.forms.map((f) => f.n).join(", ") || "none (loose boxes)", w.screens, cut(w.forms.flatMap((f) => f.labels).join(" · "), 150)]; })));
  say("### 5b. The most boxes showing without a tap, any page (whole page as it opens)");
  const bx = rank(R, "loadWhole").map((t) => { const w = t.rows.filter((r) => r.inMenu).reduce((a, b) => (inp(b.whole) > inp(a.whole) ? b : a)); return { t, w }; }).filter((x) => inp(x.w.whole) >= 6).sort((a, b) => inp(b.w.whole) - inp(a.w.whole));
  say(tbl(["page", "boxes showing (most)", "for", "on first screen", "must-fill", "already filled", "more boxes behind folds", "optional parts (shut folds / chips / openers)", "forms open (boxes each)"],
    bx.slice(0, 40).map(({ t, w }) => { const o = optional(w); return [`${pg(t.page)} (${t.title})`, inp(w.whole), w.household, inp(w.first), w.whole.boxesReq, w.whole.boxesFilled, inp(w.open) - inp(w.whole), `${o.shut} / ${o.chips} / ${o.more}`, w.forms.map((f) => f.n).join(", ")]; })));
  say("### 5c. Boxes on the first screen for a household that already has data (4 or more)");
  const b1 = P.filter((r) => inp(r.first) >= 4).sort((a, b) => inp(b.first) - inp(a.first));
  const b1By = new Map(); for (const r of b1) { if (!b1By.has(r.page)) b1By.set(r.page, []); b1By.get(r.page).push(r); }
  say(tbl(["page", "boxes on first screen", "households", "leads with", "first form's button"], [...b1By.entries()].map(([p, rs]) => [`${pg(p)} (${rs[0].title})`, inp(rs[0].first), rs.map((r) => `${r.household} ${inp(r.first)}`).join(", "), cut(rs[0].heroText, 40), rs[0].forms[0]?.submit ?? ""])));
  say("### 5d. Open forms on a page that already has data: how much of each form is must-fill");
  const fr = P.flatMap((r) => r.forms.map((f) => ({ ...f, page: r.page, title: r.title, household: r.household }))).filter((f) => f.n >= 5);
  const frBy = new Map(); for (const f of fr) { const k = `${f.page}|${f.submit}`; const x = frBy.get(k); if (!x || f.n > x.n) frBy.set(k, { ...f, hs: [...(x?.hs ?? []), f.household] }); else x.hs.push(f.household); }
  say(tbl(["page", "form (its button)", "boxes", "must-fill", "already filled", "help lines", "px tall", "households", "labels"], [...frBy.values()].sort((a, b) => b.n - a.n).slice(0, 45).map((f) => [pg(f.page), f.submit, f.n, f.req, f.filled, f.help, f.h, [...new Set(f.hs)].join(", "), cut(f.labels.join(" · "), 130)])));

  // ---------------------------------------------------------------- 6
  say("## 6. Folds that open open");
  const op = F.filter((f) => f.open0 === true);
  const opBy = new Map(); for (const f of op) { const k = `${f.page}|${f.sum.replace(/\d[\d,.]*/g, "N")}`; if (!opBy.has(k)) opBy.set(k, { ...f, hs: new Set() }); opBy.get(k).hs.add(f.household); }
  say(`${op.length} folds (of ${F.length}) are open when the page opens, on ${new Set(op.map((f) => f.page)).size} pages. Each one is a fold that hides nothing by default: either it should be shut, or it is not a fold.`);
  say(tbl(["page", "fold (summary)", "its status line", "kind", "households", "on first screen", "holds: boxes / figures / words / px"], [...opBy.values()].sort((a, b) => a.page.localeCompare(b.page)).map((f) => [pg(f.page), cut(f.sum, 60), cut(f.status, 30), f.kind, [...f.hs].join(", "), f.first0 ? "yes" : "", `${f.boxes + f.pickers} / ${f.figs} / ${f.words} / ${f.h}`])));

  // ---------------------------------------------------------------- 7
  say("## 7. Every fold: what the shut ones hold");
  const shut = F.filter((f) => f.open0 === false);
  const kinds = {}; for (const f of F) kinds[f.kind] = (kinds[f.kind] ?? 0) + 1;
  say(`By kind: ${Object.entries(kinds).map(([k, v]) => `${v} ${k === "card" ? "folded cards" : k === "row" ? "fold rows inside a card" : k === "notice" ? "notice details" : "bare <details>"}`).join(", ")}. Of the ${shut.length} shut folds: ${shut.filter((f) => f.boxes + f.pickers > 0).length} hold boxes (${shut.reduce((n, f) => n + (f.depth === 0 ? f.boxes + f.pickers : 0), 0)} boxes in all), ${shut.filter((f) => f.boxes + f.pickers > 0 && !f.status).length} of those say nothing in a status line, ${shut.filter((f) => f.prefilled > 0).length} hold a box that already has a value, ${shut.filter((f) => f.words >= 150).length} hold 150 words or more, ${shut.filter((f) => f.words < 15 && f.boxes + f.pickers === 0 && f.figs === 0).length} hold under 15 words and nothing else, ${F.filter((f) => f.depth > 0).length} sit inside another fold.`);
  say("### 7a. Folds per page (pages with 3 or more shut folds; the richest household)");
  const fp = pages.map((p) => { const rs = R.filter((r) => r.page === p); const w = rs.reduce((a, b) => (optional(b).shut > optional(a).shut ? b : a)); return { p, w, o: optional(w) }; }).filter((x) => x.o.shut >= 3).sort((a, b) => b.o.shut - a.o.shut);
  say(tbl(["page", "shut folds", "open", "for", "boxes behind them", "words behind them", "summaries"], fp.map(({ p, w, o }) => [`${pg(p)} (${w.title})`, o.shut, o.open, w.household, w.folds.filter((f) => f.open0 === false && f.depth === 0).reduce((n, f) => n + f.boxes + f.pickers, 0), w.folds.filter((f) => f.open0 === false && f.depth === 0).reduce((n, f) => n + f.words, 0), cut(w.folds.filter((f) => f.open0 === false).map((f) => f.sum).join(" · "), 220)])));
  say("### 7b. The folds that hold the most boxes (a form one tap away)");
  const fb = new Map(); for (const f of shut.filter((x) => x.boxes + x.pickers >= 3)) { const k = `${f.page}|${f.sum.replace(/\d[\d,.]*/g, "N")}`; const x = fb.get(k); if (!x || f.boxes + f.pickers > x.boxes + x.pickers) fb.set(k, { ...f, hs: new Set([...(x?.hs ?? []), f.household]) }); else x.hs.add(f.household); }
  say(tbl(["page", "fold (summary)", "status line", "boxes", "must-fill", "already filled", "words", "px when open", "households"], [...fb.values()].sort((a, b) => b.boxes + b.pickers - (a.boxes + a.pickers)).slice(0, 45).map((f) => [pg(f.page), cut(f.sum, 56), cut(f.status, 34), f.boxes + f.pickers, f.req, f.prefilled, f.words, f.h, [...f.hs].join(", ")])));
  say("### 7c. The folds that hold the most words (a wall one tap away)");
  const fw = new Map(); for (const f of shut.filter((x) => x.words >= 150)) { const k = `${f.page}|${f.sum.replace(/\d[\d,.]*/g, "N")}`; const x = fw.get(k); if (!x || f.words > x.words) fw.set(k, { ...f, hs: new Set([...(x?.hs ?? []), f.household]) }); else x.hs.add(f.household); }
  say(tbl(["page", "fold (summary)", "words", "figures", "boxes", "tables", "px when open (screens)", "folds inside", "households"], [...fw.values()].sort((a, b) => b.words - a.words).slice(0, 35).map((f) => [pg(f.page), cut(f.sum, 56), f.words, f.figs, f.boxes + f.pickers, f.tables, `${f.h} (${r1(f.h / 844)})`, f.nested, [...f.hs].join(", ")])));
  say("### 7d. What the summaries say (the most used wordings, numbers folded to N; Glossary, Help and Settings left out)");
  const sw = {}; for (const f of F.filter((x) => !["ai/glossary", "system/help", "system/settings"].includes(x.page))) { const k = f.sum.replace(/\d[\d,.]*/g, "N"); sw[k] = sw[k] ?? { n: 0, pages: new Set(), open: 0 }; sw[k].n++; sw[k].pages.add(f.page); if (f.open0) sw[k].open++; }
  say(tbl(["summary", "times", "pages", "open at load"], Object.entries(sw).sort((a, b) => b[1].pages.size - a[1].pages.size || b[1].n - a[1].n).slice(0, 40).map(([k, v]) => [cut(k, 80), v.n, v.pages.size, v.open])));

  // ---------------------------------------------------------------- 8
  say("## 8. Chip rows, switches, openers: the opt-in controls that exist today");
  say("### 8a. Chip rows (the choice before the exact box)");
  const cr = new Map(); for (const r of R) for (const c of r.chipRows) { const k = `${r.page}|${c.label}|${c.chips.join(",").replace(/\d[\d,.]*/g, "N")}`; if (!cr.has(k)) cr.set(k, { ...c, page: r.page, hs: new Set() }); cr.get(k).hs.add(r.household); }
  say(tbl(["page", "what it is for", "chips (on)", "n", "on first screen", "inside a fold", "households"], [...cr.values()].sort((a, b) => a.page.localeCompare(b.page)).map((c) => [pg(c.page), cut(c.label, 46), cut(c.chips.map((x) => (c.on.includes(x) ? `**${x}**` : x)).join(" · "), 150), c.n, c.first ? "yes" : "", c.hidden0 ? cut(c.inFold, 30) : "", [...c.hs].join(", ")])));
  say("### 8b. On/off switches and tick boxes");
  const tg = new Map(); for (const r of R) for (const t of r.toggles) { const k = `${r.page}|${t.row ? "switch" : t.kind}`; if (!tg.has(k)) tg.set(k, { page: r.page, kind: t.row ? "switch" : t.kind, labels: new Set(), hs: new Set(), n: 0, hidden: 0 }); const x = tg.get(k); x.labels.add(t.label); x.hs.add(r.household); x.n++; if (t.hidden0) x.hidden++; }
  say(tbl(["page", "kind", "count (all households)", "of them inside a shut fold", "labels"], [...tg.values()].sort((a, b) => a.page.localeCompare(b.page)).map((t) => [pg(t.page), t.kind === "switch" ? "on/off row" : t.kind === "checkbox" ? "tick box" : t.kind === "press" ? "done / not done button" : t.kind, t.n, t.hidden, cut([...t.labels].join(" · "), 170)])));
  say("### 8c. Openers (\"+ Add ...\", rows that open in place, \"show more\") and what one tap added");
  const mo = new Map(); for (const r of R) for (const m of r.more) { const k = `${r.page}|${m.kind}|${m.kind === "expander" ? "" : m.text.replace(/\d[\d,.]*/g, "N")}`; if (!mo.has(k)) mo.set(k, { ...m, page: r.page, hs: new Set(), n: 0, probe: null }); const x = mo.get(k); x.hs.add(r.household); x.n++; const pr = r.probes.find((p) => p.text === m.text && !p.gone && !p.navigates); if (pr && (!x.probe || pr.dH > x.probe.dH)) x.probe = pr; }
  say(tbl(["page", "kind", "control", "tag", "times", "one tap added", "households"], [...mo.values()].sort((a, b) => a.page.localeCompare(b.page)).map((m) => [pg(m.page), m.kind, m.kind === "expander" ? `${m.n} rows such as "${cut(m.text, 40)}"` : cut(m.text, 50), m.tag === "a" ? `link to ${cut(m.href, 40)}` : "button", m.n, m.probe ? `${m.probe.dH} px, ${m.probe.dBoxes} boxes, ${m.probe.dWords} words, ${m.probe.dFigs} figures${m.probe.dFilled ? `, ${m.probe.dFilled} filled button` : ""}` : m.tag === "a" ? "(goes to another page)" : "", [...m.hs].join(", ")])));
  say("### 8d. What the buttons say (outlined and filled, outside forms, numbers and names folded)");
  const bt = {}; for (const r of R) for (const b of r.buttons ?? []) { if (b.submit) continue; const k = `${b.look}: ${b.text.replace(/\d[\d,.]*/g, "N")}`; bt[k] = bt[k] ?? { n: 0, pages: new Set() }; bt[k].n++; bt[k].pages.add(r.page); }
  say(tbl(["button", "pages", "times"], Object.entries(bt).sort((a, b) => b[1].pages.size - a[1].pages.size || b[1].n - a[1].n).slice(0, 45).map(([k, v]) => [cut(k, 70), v.pages.size, v.n])));

  // ---------------------------------------------------------------- 9
  say("## 9. A hero answer and one filled action");
  say("`leads with`: figure = the page's first accent card carries a figure in big type; words = a hero card whose big line has no figure (a verdict in words, or a title); bare = big text but no hero card; none = neither on the first screen.");
  say("`answer from the plan`: the big first line is a figure, or differs from the line the empty plan gets on the same page (which is the page's title or its start-here line). `answer and one filled` is the rule's first view: both on the first screen.");
  say(tbl(["household", "answer from the plan", "answer and exactly one filled button", "hero with a figure", "hero in words", "bare figure", "bare words", "none", "filled on first screen: 0", "exactly 1", "2+", "filled on whole page: 0", "1", "2", "3+"],
    HS.map((h) => { const X = R.filter((r) => r.household === h); const n = (f) => X.filter(f).length; return [h, h === "empty" ? "" : n(answers), h === "empty" ? "" : n((r) => answers(r) && r.first.filled === 1), n((r) => r.heroKind === "figure"), n((r) => r.heroKind === "words"), n((r) => r.heroKind === "bare figure"), n((r) => r.heroKind === "bare words"), n((r) => r.heroKind === "none"), n((r) => r.first.filled === 0), n((r) => r.first.filled === 1), n((r) => r.first.filled > 1), n((r) => r.whole.filled === 0), n((r) => r.whole.filled === 1), n((r) => r.whole.filled === 2), n((r) => r.whole.filled > 2)]; })));
  const titled = pages.map((p) => ({ p, rs: P.filter((r) => r.page === p && !answers(r) && figs(r.whole) >= 5) })).filter((x) => x.rs.length >= 2).sort((a, b) => b.rs.length - a.rs.length || Math.max(...b.rs.map((r) => figs(r.whole))) - Math.max(...a.rs.map((r) => figs(r.whole))));
  say("### 9e. Pages that have numbers but lead with their title (5 or more figures on the page, the big first line is not an answer; two or more households)");
  say(tbl(["page", "households", "the big first line", "figures on the page (most)", "screens (most)"], titled.map((x) => [`${pg(x.p)} (${x.rs[0].title})`, x.rs.map((r) => r.household).join(", "), cut(x.rs[0].heroText || `(none) ${x.rs[0].firstWords}`, 60), Math.max(...x.rs.map((r) => figs(r.whole))), Math.max(...x.rs.map((r) => r.screens))])));
  say("### 9a. More than one filled button showing (whole page as it opens)");
  const mf = new Map(); for (const r of R.filter((x) => x.whole.filled >= 2)) { const x = mf.get(r.page); if (!x || r.whole.filled > x.whole.filled) mf.set(r.page, { ...r, hs: [...(x?.hs ?? []), `${r.household} ${r.whole.filled}`] }); else x.hs.push(`${r.household} ${r.whole.filled}`); }
  say(tbl(["page", "filled (most)", "on first screen", "households", "the filled buttons"], [...mf.values()].sort((a, b) => b.whole.filled - a.whole.filled).map((r) => [`${pg(r.page)} (${r.title})`, r.whole.filled, r.first.filled, r.hs.join(", "), cut((r.buttons ?? []).filter((b) => b.look === "filled").map((b) => `${b.text}${b.submit ? " (form)" : ""}`).join(" · "), 170)])));
  say("### 9b. No filled button anywhere, for a household with a plan (the page has no primary action)");
  const nf = pages.map((p) => ({ p, rs: P.filter((r) => r.page === p && r.whole.filled === 0) })).filter((x) => x.rs.length >= 3);
  say(`${nf.length} pages show no filled button to at least three of the five households with a plan: ${nf.map((x) => `${pg(x.p)} (${x.rs.length})`).join(", ")}.`);
  say("### 9c. No hero and no big line on the first screen");
  const nh = pages.map((p) => ({ p, rs: R.filter((r) => r.page === p && r.heroKind === "none") })).filter((x) => x.rs.length);
  say(tbl(["page", "households", "the first words instead"], nh.map((x) => [`${pg(x.p)} (${x.rs[0].title})`, x.rs.map((r) => r.household).join(", "), cut(x.rs[0].firstWords, 110)])));
  say("### 9d. Heavy heroes: the answer card itself is a screenful");
  const hh = new Map(); for (const r of P.filter((x) => x.hero && (x.hero.h >= 480 || x.hero.words >= 110 || x.hero.figs >= 7))) { const x = hh.get(r.page); if (!x || r.hero.h > x.hero.h) hh.set(r.page, { ...r, hs: [...(x?.hs ?? []), r.household] }); else x.hs.push(r.household); }
  say(tbl(["page", "hero px tall", "words", "figures", "boxes", "buttons filled+outlined", "leads with", "households"], [...hh.values()].sort((a, b) => b.hero.h - a.hero.h).slice(0, 40).map((r) => [`${pg(r.page)} (${r.title})`, r.hero.h, r.hero.words, r.hero.figs, r.hero.boxes, `${r.hero.filled}+${r.hero.outlined}`, cut(r.heroText, 44), r.hs.join(", ")])));

  // ---------------------------------------------------------------- 10
  say("## 10. The empty plan (first open): what each page shows before anything is typed");
  say(tbl(["#", "page", "first-view load", "screens", "boxes on first screen", "boxes on page", "figures", "filled", "leads with"], E.slice().sort((a, b) => b.loadFirst - a.loadFirst).slice(0, 25).map((r, i) => [i + 1, `${pg(r.page)} (${r.title})`, r1(r.loadFirst), r.screens, inp(r.first), inp(r.whole), figs(r.whole), r.whole.filled, cut(r.heroText, 44)])));
  say(`Empty plan: ${E.filter((r) => inp(r.first) > 0).length} pages open with boxes on the first screen, ${E.filter((r) => inp(r.whole) >= 6).length} with 6 or more boxes on the page, ${E.filter((r) => figs(r.whole) >= 5).length} show 5 or more money or percent figures before anything is typed, ${E.filter((r) => r.whole.filled === 0).length} have no filled button, ${E.filter((r) => r.screens <= 1.05).length} fit one screen.`);

  // ---------------------------------------------------------------- 11
  say("## 11. By topic");
  const groups = [...new Set(R.map((r) => r.group))];
  say(tbl(["topic", "pages", "screens (half, with a plan)", "first-view load (half)", "whole-page load (half)", "longest page", "shut folds per page", "pages with no optional part", "boxes showing per page"],
    groups.map((g) => { const X = P.filter((r) => r.group === g); const ps = [...new Set(X.map((r) => r.page))]; const long = X.reduce((a, b) => (b.screens > a.screens ? b : a)); return [g, ps.length, r1(med(X.map((r) => r.screens))), r1(med(X.map((r) => r.loadFirst))), r1(med(X.map((r) => r.loadWhole))), `${long.page} ${long.screens}`, r1(X.reduce((n, r) => n + optional(r).shut, 0) / X.length), ps.filter((p) => X.filter((r) => r.page === p).every((r) => optCount(r) === 0)).length, r1(X.reduce((n, r) => n + inp(r.whole), 0) / X.length)]; }).sort((a, b) => Number(b[4]) - Number(a[4]))));

  // ---------------------------------------------------------------- 12
  say("## 12. Is the ranking an accident of the weights?");
  const alt = { "every item counts 1 (words / 10)": (c) => c.words / 10 + figs(c) + inp(c) + c.checks + c.chips + btn(c) + c.cards + c.charts + c.tables + c.records + c.smallLines, "words only": (c) => c.words, "no words (controls, figures, blocks)": (c) => load(c) - WEIGHTS.word * c.words, "boxes weigh double": (c) => load(c, { ...WEIGHTS, box: 8, picker: 8 }), "figures weigh triple": (c) => load(c, { ...WEIGHTS, figure: 3 }) };
  say(tbl(["other way to score", "rank agreement with the load score, first views (Spearman, 1 = same order)", "whole pages", "of the top 40 first views, how many stay in the top 40"],
    Object.entries(alt).map(([k, f]) => { const a = P.map((r) => r.loadFirst), b = P.map((r) => f(r.first)); const top = (score) => new Set(rank(R.map((r) => ({ ...r, loadFirst: score(r) }))).sort((x, y) => y.max - x.max).slice(0, 40).map((t) => t.page)); const t0 = top((r) => r.loadFirst), t1 = top((r) => f(r.first)); return [k, spearman(a, b).toFixed(2), spearman(P.map((r) => r.loadWhole), P.map((r) => f(r.whole))).toFixed(2), [...t0].filter((p) => t1.has(p)).length]; })));

  // ---------------------------------------------------------------- 13
  say("## 13. Every page (households with a plan: half = median of the five; e = the empty plan)");
  say(tbl(["page", "screens half / most / e", "first-view load half / most / e", "page load half / most", "all-open load (most)", "boxes: first screen / page / all open (most)", "figures first screen (half)", "words first screen (half)", "folds shut / open (most)", "chips", "openers", "leads with (richest)", "filled on first screen (households 0 / 1 / 2+)"],
    pages.map((p) => { const X = P.filter((r) => r.page === p), e = E.find((r) => r.page === p); const mx = (k) => Math.max(...X.map(k)); const w = X.reduce((a, b) => (b.loadOpen > a.loadOpen ? b : a));
      return [pg(p), `${r1(med(X.map((r) => r.screens)))} / ${mx((r) => r.screens)} / ${e?.screens ?? ""}`, `${r1(med(X.map((r) => r.loadFirst)))} / ${r1(mx((r) => r.loadFirst))} / ${e ? r1(e.loadFirst) : ""}`, `${r1(med(X.map((r) => r.loadWhole)))} / ${r1(mx((r) => r.loadWhole))}`, r1(mx((r) => r.loadOpen)), `${mx((r) => inp(r.first))} / ${mx((r) => inp(r.whole))} / ${mx((r) => inp(r.open))}`, r1(med(X.map((r) => figs(r.first)))), r1(med(X.map((r) => r.first.words))), `${mx((r) => optional(r).shut)} / ${mx((r) => optional(r).open)}`, mx((r) => r.chipRows.length), mx((r) => optional(r).more), `${w.heroKind}: ${cut(w.heroText, 30)}`, `${X.filter((r) => r.first.filled === 0).length} / ${X.filter((r) => r.first.filled === 1).length} / ${X.filter((r) => r.first.filled > 1).length}`]; })));

  fs.writeFileSync(out, L.join("\n"));
  console.error(`wrote ${out} (${L.length} lines)`);
  return L.join("\n");
}

// modules/reports/report-kit.js -- DOM only, shared by the report pages. A report is drawn on screen
// as a sheet of paper inside the app, and "Print or save as PDF" prints it in the same tab: print rules
// in the report's own <style> (inside the page's root, so nothing global) hide the app around the sheet
// and give it light colours. Closing the print sheet leaves the person on the report (stress test x-4,
// 2026-11-11: a second tab opened with a desktop-width sheet and nothing to tap). Charts are inline SVG.

export const REPORT_CSS = `
.rp-sheet { background: var(--panel); color: var(--text); border: 1px solid var(--line); border-radius: var(--radius); padding: 22px 20px; box-shadow: var(--shadow); line-height: 1.5; }
.rp-sheet h1 { font-size: 26px; margin: 0 0 2px; letter-spacing: -.01em; }
.rp-sheet h2 { font-size: 17px; margin: 22px 0 8px; padding-bottom: 6px; border-bottom: 2px solid var(--accent); }
.rp-sheet h3 { font-size: 15px; margin: 14px 0 4px; }
.rp-sheet p { margin: 0 0 8px; }
.rp-sheet .rp-sub { color: var(--muted); font-size: 13px; }
.rp-sheet .rp-lead { font-size: 16px; color: var(--text-2); }
.rp-sheet .rp-figs { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin: 10px 0; }
.rp-sheet .rp-fig { border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; background: var(--panel-2); break-inside: avoid; }
.rp-sheet .rp-fig b { display: block; font-size: 20px; letter-spacing: -.01em; }
.rp-sheet .rp-fig span { color: var(--text-2); font-size: 13px; }
.rp-sheet .rp-fig.good b { color: var(--ok); } .rp-sheet .rp-fig.bad b { color: var(--bad); }
.rp-sheet table { width: 100%; border-collapse: collapse; font-size: 13px; margin: 6px 0 10px; }
.rp-sheet th, .rp-sheet td { text-align: left; padding: 7px 6px; border-bottom: 1px solid var(--line); vertical-align: top; white-space: normal; }
.rp-sheet th { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.rp-sheet td.num, .rp-sheet th.num { text-align: right; white-space: nowrap; }
.rp-sheet ul.rp-list { margin: 4px 0 10px; padding-left: 18px; }
.rp-sheet ul.rp-list li { margin: 3px 0; }
.rp-sheet .rp-ok { color: var(--ok); font-weight: 650; } .rp-sheet .rp-bad { color: var(--bad); font-weight: 650; } .rp-sheet .rp-warn { color: var(--warn); font-weight: 650; }
.rp-sheet .rp-foot { margin-top: 24px; padding-top: 10px; border-top: 1px solid var(--line); color: var(--muted); font-size: 12px; }
.rp-sheet section { break-inside: avoid-page; }
.rp-sheet .rp-recs { list-style: none; margin: 6px 0 10px; padding: 0; }
.rp-sheet .rp-recs li { padding: 8px 0; border-bottom: 1px solid var(--line); font-size: 13px; }
.rp-sheet .rp-recs .rp-rh { display: flex; justify-content: space-between; gap: 10px; font-weight: 650; }
.rp-sheet .rp-recs .rp-rs { color: var(--text-2); }
`;

// the print document's own palette (light, whatever the app's theme) and page setup
const PRINT_DOC_CSS = `
:root { --bg: #fff; --panel: #fff; --panel-2: #f7f8fa; --text: #111; --text-2: #3d4450; --muted: #687080; --line: #dfe2e7; --line-2: #c9ced6; --accent: #2563eb; --accent-soft: #e8efff; --accent-ink: #1d4ed8; --ok: #15803d; --ok-soft: #e6f4ea; --warn: #b45309; --warn-soft: #fdf1e0; --bad: #b91c1c; --bad-soft: #fde8e8; --radius: 10px; --shadow: none; }
* { box-sizing: border-box; }
html, body { margin: 0; background: #fff; color: #111; font: 13px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
@page { size: letter; margin: 16mm 14mm; }
.rp-sheet { border: 0; box-shadow: none; padding: 0; max-width: 760px; margin: 0 auto; }
.rp-sheet h2 { break-after: avoid; }
svg { max-width: 100%; height: auto; }
.only-narrow { display: none !important; } .only-wide { display: block !important; }
`;

// Print only, and only while a report is on the page: everything but the sheet is hidden, the sheet gets the print palette.
const PRINT_VARS = PRINT_DOC_CSS.match(/:root \{([^}]*)\}/)[1].split(";").map((d) => d.trim()).filter(Boolean).map((d) => `${d} !important;`).join(" ");
const PRINT_RULES = PRINT_DOC_CSS.replace(/:root \{[^}]*\}/, "").replace(/^html, body \{/m, "html, body, #app, #content {").replace(/^\.only-narrow.*$/m, "");
const PRINT_IN_PLACE = `
@media print {
  :root { ${PRINT_VARS} }
  body > *:not(#app), #topbar, #sidebar, #scrim, .rp-root > .row { display: none !important; }
  #content *:not(:has(.rp-sheet)):not(.rp-sheet):not(.rp-sheet *) { display: none !important; }
  #content, #content * { animation: none !important; transition: none !important; }
  #app, #content { display: block !important; padding: 0 !important; margin: 0 !important; max-width: none !important; min-height: 0 !important; }
  ${PRINT_RULES}
  .rp-sheet .only-narrow { display: none !important; } .rp-sheet .only-wide { display: block !important; }
}`;

/** The page's wrapper: scoped styles, a print button row, and the sheet the report is drawn into. */
export function reportFrame(ui, { title, onPrint }) {
  const sheet = ui.h("article", { class: "rp-sheet", "aria-label": title });
  const wrap = ui.h("div", { class: "rp-root" }, ui.h("style", {}, REPORT_CSS + PRINT_IN_PLACE),
    ui.h("div", { class: "row", style: { marginBottom: "12px" } }, ui.button("Print or save as PDF", () => (onPrint ? onPrint(sheet) : printSheet(title, sheet)))),
    sheet);
  return { wrap, sheet };
}

/** The standalone document a sheet prints as: its own light palette and page setup, no app around it. */
export function sheetDocument(title, sheet) {
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${REPORT_CSS}${PRINT_DOC_CSS}</style></head><body>${sheet.outerHTML}</body></html>`;
}

/** Print the drawn sheet in this tab (the browser's print sheet also saves a PDF, named after the report's title). */
export function printSheet(title, sheet) {
  const was = document.title;
  document.title = title;
  const back = () => { document.title = was; window.removeEventListener("afterprint", back); };
  window.addEventListener("afterprint", back);
  try { window.print(); } finally { setTimeout(back, 1000); }
}

/**
 * What a report says when its figures could not be worked out (the compute failed, `d.error`) or drawing them failed, so the
 * page never stays on "Putting the ... together" (Review 2026-11-06: the Tax report hung for 17 qa households; three
 * reports read "The review needs ." or "It needs:" with nothing after it when the plan's figures could not be worked out).
 */
export const failedNotice = (ui, what) => ui.notice("error", `The ${what} could not be put together from this plan: something in it stopped the figures being worked out. Check the birth dates and the ages on the People page, then reload the page.`);
/** True when the page's compute failed (the shell's safeCompute answers { error }). */
export const computeFailed = (d) => !!(d && typeof d === "object" && d.error && !d.ready);
/**
 * Run a report's drawing on its compute's answer, and on any failure show `failedNotice` in `host` instead: a compute that
 * failed, a drawing that throws, a remote call that rejects. -> the settled promise.
 */
export function settleReport(promise, host, ui, what, draw) {
  return Promise.resolve(promise).then((d) => {
    if (computeFailed(d)) { host.replaceChildren(failedNotice(ui, what)); return; }
    draw(d);
  }).catch((e) => { console.error(`[planner] the ${what} failed`, e); host.replaceChildren(failedNotice(ui, what)); });
}

/** Small builders for report content. */
export const figs = (ui, items) => ui.h("div", { class: "rp-figs" }, items.filter(Boolean).map(([label, value, tone]) => ui.h("div", { class: `rp-fig${tone ? ` ${tone}` : ""}` }, ui.h("b", {}, value), ui.h("span", {}, label))));
/** A wide table that becomes records on a phone: the first column is the record's title, the last its value, the rest a line under. The print copy always uses the table. */
export const wideTable = (ui, cols, rows) => {
  const mid = cols.slice(1, -1), last = cols[cols.length - 1];
  const text = (v) => (v instanceof Node ? v.textContent : String(v ?? ""));
  return ui.h("div", {}, ui.h("div", { class: "only-wide" }, rtable(ui, cols, rows)),
    ui.h("ul", { class: "rp-recs only-narrow" }, rows.map((r) => ui.h("li", {}, ui.h("div", { class: "rp-rh" }, ui.h("span", {}, cols[0].get(r)), ui.h("span", {}, last.get(r))), ui.h("div", { class: "rp-rs" }, mid.map((c) => `${c.label ? `${c.label} ` : ""}${text(c.get(r))}`).filter((t) => t.trim() && !t.endsWith(" -")).join(" · "))))));
};
export const rtable = (ui, cols, rows) => ui.h("table", {}, ui.h("thead", {}, ui.h("tr", {}, cols.map((c) => ui.h("th", { class: c.num ? "num" : null }, c.label)))), ui.h("tbody", {}, rows.map((r) => ui.h("tr", {}, cols.map((c) => ui.h("td", { class: c.num ? "num" : null }, c.get(r)))))));
export const section = (ui, title, ...body) => ui.h("section", {}, ui.h("h2", {}, title), ...body);
export const list = (ui, items) => ui.h("ul", { class: "rp-list" }, items.filter(Boolean).map((t) => ui.h("li", {}, t)));

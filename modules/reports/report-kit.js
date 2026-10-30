// modules/reports/report-kit.js -- DOM only, shared by the report pages. A report is drawn on screen
// as a sheet of paper inside the app, and "Print or save as PDF" copies that sheet into a clean
// document of its own (its own styles, light colours, no app around it) and prints it, so no global
// print styles are needed. Charts are inline SVG and travel with it.

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
`;

/** The page's wrapper: scoped styles, a print button row, and the sheet the report is drawn into. */
export function reportFrame(ui, { title, onPrint }) {
  const sheet = ui.h("article", { class: "rp-sheet", "aria-label": title });
  const wrap = ui.h("div", { class: "rp-root" }, ui.h("style", {}, REPORT_CSS),
    ui.h("div", { class: "row", style: { marginBottom: "12px" } }, ui.button("Print or save as PDF", () => (onPrint ? onPrint(sheet) : printSheet(title, sheet)))),
    sheet);
  return { wrap, sheet };
}

/** The standalone document a sheet prints as: its own light palette and page setup, no app around it. */
export function sheetDocument(title, sheet) {
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${REPORT_CSS}${PRINT_DOC_CSS}</style></head><body>${sheet.outerHTML}</body></html>`;
}

/** Copy a drawn sheet into a document of its own and print it (the browser's dialog also saves a PDF). */
export function printSheet(title, sheet) {
  const w = window.open("", "_blank");
  if (!w) { window.alert("The print window was blocked. Allow pop-ups for this page, or use the browser's own Print."); return; }
  w.document.open();
  w.document.write(sheetDocument(title, sheet));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}

/** Small builders for report content. */
export const figs = (ui, items) => ui.h("div", { class: "rp-figs" }, items.filter(Boolean).map(([label, value, tone]) => ui.h("div", { class: `rp-fig${tone ? ` ${tone}` : ""}` }, ui.h("b", {}, value), ui.h("span", {}, label))));
export const rtable = (ui, cols, rows) => ui.h("table", {}, ui.h("thead", {}, ui.h("tr", {}, cols.map((c) => ui.h("th", { class: c.num ? "num" : null }, c.label)))), ui.h("tbody", {}, rows.map((r) => ui.h("tr", {}, cols.map((c) => ui.h("td", { class: c.num ? "num" : null }, c.get(r)))))));
export const section = (ui, title, ...body) => ui.h("section", {}, ui.h("h2", {}, title), ...body);
export const list = (ui, items) => ui.h("ul", { class: "rp-list" }, items.filter(Boolean).map((t) => ui.h("li", {}, t)));

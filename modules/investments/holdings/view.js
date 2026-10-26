// modules/investments/holdings/view.js -- DOM only. What you hold and what it is worth first,
// then the holdings by account (tap a row to edit), one folded form to add, and a folded
// importer for a brokerage positions file (paste or choose the file).
import { compute, parsePositions, mergePositions, CLASS_OPTIONS, ASSET_CLASSES } from "./compute.js";

let pending = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  const signed = (n) => n < 0 ? `−${money(-n)}` : `+${money(n)}`;
  let editing = null;
  const accounts = d.investedAccounts;
  const FIELDS = [
    { key: "accountId", label: "In which account", type: "select", options: accounts.map((a) => ({ value: a.id, label: a.name })) },
    { key: "symbol", label: "Symbol", type: "text", required: true, placeholder: "e.g. VTI, FXAIX, AAPL" },
    { key: "name", label: "Name", type: "text", placeholder: "filled in for common funds" },
    { key: "shares", label: "Shares", type: "number", required: true, min: 0, step: "any" },
    { key: "price", label: "Price a share", type: "money", min: 0, help: "the latest you have; blank uses what you paid" },
    { key: "costBasis", label: "What you paid in all", type: "money", min: 0, help: "the cost basis on the statement" },
    { key: "assetClass", label: "Asset class", type: "select", options: [{ value: "", label: "Work it out from the symbol" }, ...CLASS_OPTIONS.filter((o) => o.value !== "unknown")] },
    { key: "expenseRatio", label: "Expense ratio", type: "percent", min: 0, max: 5, help: "yearly fund fee; blank uses the table for common funds" },
    { key: "yield", label: "Yield", type: "percent", min: 0, max: 20, help: "dividends and interest a year; blank uses a typical figure" },
  ];
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.hasData ? `${money(d.total)} invested` : "What you hold"),
    ui.h("p", { class: "lede" }, d.hasData
      ? `${d.items.length} holding${d.items.length === 1 ? "" : "s"} in ${d.byAccount.filter((a) => a.count).length} account${d.byAccount.filter((a) => a.count).length === 1 ? "" : "s"}, ${d.costTotal > 0 ? `${signed(d.gain)} against what you paid` : "cost not entered yet"}; ${fmt.pct(d.stockShare, 0)} in stocks. Allocation, Fees, Dividends and the tax pages all read this list.`
      : "The funds and stocks in each investment account: symbol, shares, price, what you paid. Type them in or import the positions file your brokerage exports; common funds classify themselves."),
    !accounts.length ? ui.h("p", { class: "muted small" }, "First add the investment accounts themselves on the ", ui.h("a", { href: "#/balance/net-worth" }, "Net worth page"), " (brokerage, 401(k), IRA, Roth, HSA, 529).") : null,
  ));
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 5000); pending = null; }
  root.append(out);
  for (const w of d.warnings) root.append(ui.notice("warn", w));
  if (d.hasData) root.append(ui.card(null, ui.row(
    ui.stat("Worth", money(d.total), d.unpriced ? `${d.unpriced} at cost` : "at the prices on file"),
    ui.stat("Paid", money(d.costTotal), "cost basis"),
    ui.stat("Gain", signed(d.gain), d.costTotal > 0 ? `${fmt.pct(d.gain / d.costTotal, 1)}` : ""),
    ui.stat("In stocks", fmt.pct(d.stockShare, 0), "of what is classified"),
  )));

  // the form (add or edit)
  const formCard = ui.card(null);
  const formHost = ui.h("div");
  let showForm = !d.hasData && accounts.length > 0;
  const drawForm = () => {
    formHost.innerHTML = "";
    if (!accounts.length) return;
    if (!showForm && !editing) { formHost.append(ui.button("+ Add a holding", () => { showForm = true; drawForm(); }, { class: "secondary" })); return; }
    const values = editing ? { ...editing, assetClass: editing.assetClass ?? "" } : { accountId: accounts[0]?.id, assetClass: "" };
    formHost.append(ui.h("div", {},
      ui.h("h2", {}, editing ? `Edit: ${editing.symbol}` : "Add a holding"),
      ui.form(FIELDS, values, (v) => {
        const clean = { accountId: v.accountId, symbol: v.symbol.trim().toUpperCase(), name: v.name.trim(), shares: v.shares ?? 0, price: v.price ?? null, priceAsOf: v.price !== null ? fmt.today() : null, costBasis: v.costBasis ?? null, assetClass: v.assetClass || "", expenseRatio: v.expenseRatio ?? null, yield: v.yield ?? null };
        pending = editing ? `${clean.symbol} saved.` : `${clean.symbol} added.`;
        store.update((p) => { p.holdings = p.holdings ?? []; if (editing) { const i = p.holdings.findIndex((h) => h.id === editing.id); if (i >= 0) p.holdings[i] = { ...p.holdings[i], ...clean }; } else p.holdings.push({ id: ui.uid(), lots: [], ...clean }); });
        editing = null;
      }, { submitLabel: editing ? "Save changes" : "Add holding", resetAfter: !editing, onCancel: (editing || d.hasData) ? () => { editing = null; showForm = false; drawForm(); } : null }),
      editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button("Remove this holding", () => { const id = editing.id; const sym = editing.symbol; editing = null; pending = `${sym} removed.`; store.update((p) => { p.holdings = (p.holdings ?? []).filter((h) => h.id !== id); }); }, { class: "danger" })) : null,
    ));
  };
  drawForm();
  // holdings by account
  for (const a of d.byAccount.filter((x) => x.count)) {
    const mine = d.items.filter((h) => h.accountId === a.accountId).sort((x, y) => y.value - x.value);
    root.append(ui.card(a.name,
      ui.h("p", { class: "muted small" }, `${a.typeLabel} · ${money(a.value)} in ${a.count} holding${a.count === 1 ? "" : "s"}${Math.abs(a.gap) > 1 ? ` · Net worth balance ${money(a.balance)}` : ""}`),
      ui.h("ul", { class: "page-list" }, mine.map((h) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer" },
        onClick: () => { editing = { ...plan.holdings.find((x) => x.id === h.id) }; showForm = true; drawForm(); formCard.scrollIntoView({ behavior: "smooth", block: "start" }); },
        onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
        ui.h("span", { class: "ic" }, ASSET_CLASSES[h.cls].icon || ""),
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, h.symbol, " ", ui.h("span", { class: h.cls === "unknown" ? "pill warn" : "pill" }, h.cls === "unknown" ? "pick a class" : h.clsLabel)), ui.h("div", { class: "d" }, `${h.name ? `${h.name} · ` : ""}${fmt.num(h.shares, 3)} shares${h.priced ? ` at ${money(h.price)}` : ""}${h.costBasis ? ` · paid ${money(h.costBasis)}` : ""}`)),
        ui.h("span", { class: "st amount" }, ui.h("div", {}, money(h.value)), h.costBasis > 0 ? ui.h("div", { class: "muted small", style: h.gain < 0 ? { color: "var(--bad)" } : null }, signed(h.gain)) : null)))),
    ));
  }
  formCard.append(formHost);
  root.append(formCard);
  root.append(importFold(ctx, d));
}

function importFold(ctx, d) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const accounts = d.investedAccounts;
  if (!accounts.length) return ui.h("div");
  let text = "", parsed = null, fileAccount = "", accountId = accounts[0].id;
  const host = ui.h("div");
  const file = ui.h("input", { type: "file", accept: ".csv,.txt,.tsv,text/csv,text/plain", "aria-label": "Positions file", style: { display: "none" } });
  const chosen = ui.h("span", { class: "muted small", style: { alignSelf: "center" } }, "No file chosen yet");
  const paste = ui.h("textarea", { rows: 4, placeholder: "...or paste the positions CSV here", "aria-label": "Pasted positions" });
  const drawPreview = () => {
    host.innerHTML = "";
    if (!parsed) return;
    for (const w of parsed.warnings) host.append(ui.notice("warn", w));
    if (!parsed.rows.length) return;
    const fileAccounts = [...new Set(parsed.rows.map((r) => r.account).filter(Boolean))];
    const rows = fileAccount ? parsed.rows.filter((r) => r.account === fileAccount) : parsed.rows;
    const total = rows.reduce((s, r) => s + (r.value ?? 0), 0);
    const acctSel = ui.select(accounts.map((a) => ({ value: a.id, label: a.name })), accountId, { "aria-label": "Into which account", onChange: (e) => { accountId = e.target.value; } });
    const fileSel = fileAccounts.length > 1 ? ui.select([{ value: "", label: "all of them" }, ...fileAccounts.map((a) => ({ value: a, label: a }))], fileAccount, { "aria-label": "Rows from", onChange: (e) => { fileAccount = e.target.value; drawPreview(); } }) : null;
    host.append(
      ui.h("p", { class: "small" }, `${rows.length} position${rows.length === 1 ? "" : "s"} found, ${fmt.money(total, cur)} in all.`),
      ui.h("div", { class: "form" }, fileSel ? ui.field("The file lists several accounts; import rows from", fileSel) : null, ui.field("Into which account", acctSel)),
      ui.h("ul", { class: "records" }, rows.slice(0, 40).map((r) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, r.symbol), ui.h("span", { class: "rec-value" }, r.value !== null ? fmt.money(r.value, cur) : "-")), ui.h("div", { class: "rec-sub" }, `${r.name || ""}${r.shares ? ` · ${r.shares} shares` : ""}${r.price !== null && !r.cash ? ` at ${fmt.money(r.price, cur)}` : ""}${r.costBasis !== null ? ` · paid ${fmt.money(r.costBasis, cur)}` : ""}`)))),
      rows.length > 40 ? ui.h("p", { class: "muted small" }, `...and ${rows.length - 40} more.`) : null,
      ui.row(ui.button(`Import ${rows.length} position${rows.length === 1 ? "" : "s"}`, () => {
        const r = mergePositions(plan.holdings, rows, accountId, { today: fmt.today(), uid: ui.uid });
        pending = `${r.added} added, ${r.updated} updated in ${accounts.find((a) => a.id === accountId)?.name ?? "the account"}. Holdings already on file that the file did not list were left alone.`;
        store.update((p) => { p.holdings = r.holdings; });
      })),
    );
  };
  const prepare = () => { parsed = parsePositions(text); fileAccount = ""; drawPreview(); };
  file.addEventListener("change", () => {
    const f = file.files?.[0]; if (!f) return;
    chosen.textContent = `${f.name} (${Math.max(1, Math.round(f.size / 1024))} KB)`;
    const reader = new FileReader();
    reader.onload = () => { text = String(reader.result ?? ""); prepare(); };
    reader.readAsText(f);
  });
  return ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Import a positions file"), ui.h("span", { class: "fold-status" }, "Fidelity, Schwab, Vanguard..."), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" },
      ui.h("p", { class: "muted small" }, "Every brokerage's positions (holdings) page has a download or export button; the CSV it gives is read here. Nothing leaves this device. Matching symbols in the chosen account are updated, new ones added."),
      ui.row(ui.button("Choose the file", () => file.click(), { class: "secondary" }), chosen), file,
      ui.h("div", { class: "form", style: { marginTop: "12px" } }, ui.field("Or paste", paste)), ui.row(ui.button("Use the pasted text", () => { text = paste.value; prepare(); }, { class: "secondary" })),
      host));
}

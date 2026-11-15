// modules/investments/holdings/view.js -- DOM only. What you hold and what it is worth first,
// then the holdings by account (tap a row to edit), one folded form to add, and a folded
// importer for a brokerage positions file (paste or choose the file).
// Simple first (opt spec 6.1, done with gap next-60 #8): the form asks five boxes (account, symbol, shares, price, what
// you paid); the rest wait under "More details (optional)"; the importer is one quiet card drawn by the helper.
import { compute, parsePositions, mergePositions, CLASS_OPTIONS, ASSET_CLASSES, holdingLabels, byLabel } from "./compute.js";
import { labelsOf, hasLabel, planLabels, labelChange, labelWords, sameLabel } from "../../balance/net-worth/labels.js";
import { LABELS_FIELD, labelPicks, readLabels, labelChips } from "../../balance/net-worth/labels-view.js";
import { costFromLots } from "../tax-lots/compute.js";
import { part } from "../../../core/ui/more.js";
import { PAYS } from "../dividends/compute.js";

/** How often a holding pays, in the green line's words ("" = as usual for its kind). */
export const PAYS_WORDS = { "": "as usual for its kind", month: "every month", quarter: "every 3 months", half: "twice a year", year: "once a year" };
/**
 * The line under the label chips: how many holdings carry the label (or sit in an account that does) and their worth,
 * and, when some are listed only for their account's label, that they are (critic P1: a holding with no pill of its own
 * must not look labeled by mistake). One sentence per case: all their own; all by their account; some of each.
 */
export function labelLine(t, money) {
  const n = `${t.count} holding${t.count === 1 ? "" : "s"}`;
  const own = t.own ?? t.count, by = t.count - own;
  const where = t.accounts > 1 ? `accounts labeled ${t.label}` : `an account labeled ${t.label}`;
  if (!by) return `${n} labeled ${t.label}: ${money(t.value)}.`;
  if (!own) return `${n} in ${where}: ${money(t.value)}.`;
  return `${n} labeled ${t.label}: ${money(t.value)}. ${by} of them ${by === 1 ? "is" : "are"} listed because ${by === 1 ? "its account is" : t.accounts > 1 ? "their accounts are" : "their account is"} labeled ${t.label}.`;
}
/** The importer's title (pinned in qa/first-view-lib.mjs PINNED_TITLES: the opt spec's own words for this page). */
export const IMPORT_TITLE = "Import a positions file";

let pending = null;
let shownLabel = null;      // the label the list is narrowed to by its chips (gap next-60 #44): this visit's choice, never the plan's
let pendingAt = null;       // "import": the green line goes inside the importer, which stays open after its save (R17)
let lastAccountId = null;   // the account the last holding went into: the next add starts there (a second fund landed on the first account)
let editId = null;          // the holding open for editing: its form opens under its row, inside its account card
let showId = null;          // the row to bring into view on the next render (a new holding, or the one just saved or closed)
let routeSeen = null;
let openedByLink = false;  // opened from another page on this holding: its row goes to the top, its form under it       // ?edit=<id> (from Crypto's "Change or remove") is read once per address

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  const signed = (n) => n < 0 ? `−${money(-n)}` : `+${money(n)}`;
  const accounts = d.investedAccounts;
  if (ctx.route !== routeSeen) { routeSeen = ctx.route; const q = ctx.route?.query?.edit; if (q && (plan.holdings ?? []).some((x) => x.id === q)) { editId = q; showId = q; openedByLink = true; } }
  if (editId && !(plan.holdings ?? []).some((x) => x.id === editId)) editId = null;
  if (lastAccountId && !accounts.some((a) => a.id === lastAccountId)) lastAccountId = null;
  const redraw = () => { root.replaceChildren(); render(root, ctx); };
  const nameOfAccount = (id) => accounts.find((a) => a.id === id)?.name ?? "the account";
  // with several accounts and none chosen yet this visit, the add form asks which one instead of starting on the first
  const pickFirst = accounts.length > 1 && !lastAccountId;
  const FIELDS = [
    { key: "accountId", label: "In which account", type: "select", required: true, options: [...(pickFirst ? [{ value: "", label: "Pick the account" }] : []), ...accounts.map((a) => ({ value: a.id, label: a.name }))] },
    { key: "symbol", label: "Symbol", type: "text", required: true, placeholder: "e.g. VTI, FXAIX, AAPL" },
    { key: "name", label: "Name", type: "text", placeholder: "filled in for common funds", more: true },
    { key: "shares", label: "Shares", type: "number", required: true, min: 0, max: 1e9, step: "any" },
    { key: "price", label: "Price a share", type: "money", min: 0, help: "the latest you have; leave blank to use what you paid" },
    { key: "costBasis", label: "What you paid in all", type: "money", min: 0, help: "what you paid (the statement calls it \"cost basis\")" },
    { key: "assetClass", label: "Kind of investment (US stocks, bonds ...)", type: "select", more: true, options: [{ value: "", label: "Work it out from the symbol" }, ...CLASS_OPTIONS.filter((o) => o.value !== "unknown")] },
    { key: "expenseRatio", label: "Expense ratio", type: "percent", min: 0, max: 5, more: true, help: "yearly fund fee; leave blank to use the table for common funds" },
    { key: "yield", label: "Yield", type: "percent", min: 0, max: 20, more: true, help: "dividends and interest a year; leave blank to use a typical figure" },
    // how often it pays: Dividends' "Month by month" spreads the year by it (gap next-60 #8); left as usual, by its kind
    { key: "paysEvery", label: "How often it pays", type: "select", more: true, options: [{ value: "", label: "As usual for its kind" }, { value: "month", label: "Every month" }, { value: "quarter", label: "Every 3 months" }, { value: "half", label: "Twice a year" }, { value: "year", label: "Once a year" }],
      help: "left as usual, we count bond funds and cash as paying every month and the rest every 3 months; the fund's own page says which" },
    LABELS_FIELD,
  ];
  const known = planLabels(plan);
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.hasData ? `${money(d.total)} invested` : "What you hold"),
    ui.h("p", { class: "lede" }, d.hasData
      ? `${d.items.length} holding${d.items.length === 1 ? "" : "s"} in ${d.byAccount.filter((a) => a.count).length} account${d.byAccount.filter((a) => a.count).length === 1 ? "" : "s"}, ${d.costTotal > 0 ? `${signed(d.gain)} against what you paid` : "cost not entered yet"}; ${fmt.pct(d.stockShare, 0)} in stocks. Allocation, Fees, Dividends and the tax pages all read this list.`
      : "The funds and stocks in each investment account: symbol, shares, price, what you paid. Type them in or import the positions file your brokerage exports; the app fills in the type for common funds."),
    // no investment account yet: six pages send people here with "Add holdings", and there was nothing to add to
    !accounts.length ? ui.h("p", {}, "First add the account itself (a brokerage account, 401(k), IRA, Roth, HSA or 529), then come back and list the funds in it.") : null,
    !accounts.length ? ui.row(ui.h("a", { class: "btn", href: "#/balance/net-worth?add=investment" }, "Add an investment account")) : null,
  ));
  const out = ui.h("div");
  if (pending && pendingAt !== "import") { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 5000); pending = null; }
  root.append(out);
  for (const w of d.warnings) root.append(ui.notice("warn", w));
  if (d.hasData) root.append(ui.card(null, ui.row(
    ui.stat("Worth", money(d.total), d.unpriced ? `${d.unpriced} at cost` : "at the prices on file"),
    ui.stat("Paid", money(d.costTotal), "cost basis"),
    ui.stat("Gain", signed(d.gain), d.costTotal > 0 ? `${fmt.pct(d.gain / d.costTotal, 1)}` : ""),
    ui.stat("In stocks", fmt.pct(d.stockShare, 0), "of what is classified"),
  )));

  // one form for a holding: to add (at the foot of the page, folded once there is data) or to edit (under its row)
  const holdingForm = (editing) => {
    const values = editing ? { ...editing, assetClass: editing.assetClass ?? "", labelsText: labelsOf(editing).join(", ") } : { accountId: pickFirst ? "" : (lastAccountId ?? accounts[0]?.id), assetClass: "" };
    const inLots = editing ? (editing.lots ?? []).reduce((t, l) => t + (Number(l.shares) || 0), 0) : 0;
    // one lot holding every share (Crypto makes it from the purchase date): it is the holding's own purchase. Fewer shares
    // (a typo, 0.5 for 0.05) and a new "What you paid in all" follow into it; more shares do not (their purchase date is not
    // known: they stay outside the lot, as Tax lots says), and 0 is refused (Remove is the way). Review N1 and its check.
    const oneLot = editing && (editing.lots ?? []).length === 1 && Math.abs((Number(editing.lots[0].shares) || 0) - (Number(editing.shares) || 0)) < 1e-9 ? editing.lots[0] : null;
    // every share in two or more purchases on Tax lots: the cost is theirs, and is changed there (review N9)
    const locked = editing ? costFromLots(editing) : null;
    const fields = locked ? FIELDS.map((fd) => fd.key === "costBasis" ? { ...fd, help: `the total of its ${locked.count} purchases on Tax lots, ${fmt.money(locked.total, cur)}. To change one, remove it on Tax lots and add it again with the right cost` } : fd) : FIELDS;
    const f = ui.form(fields, values, (v) => {
      if (!v.accountId) return false;
      // your own labels (gap next-60 #44): written as `labels` only when there are some, taken off when the box is emptied
      const lab = readLabels(v.labelsText, known);
      if (lab.error) { const b = f.elements.labelsText; b.setCustomValidity(lab.error); b.reportValidity(); b.addEventListener("input", () => b.setCustomValidity(""), { once: true }); return false; }
      // judged on the shares as typed: more shares than the lots hold take their cost here; the lots' own total is always fine
      const lockedNow = editing ? costFromLots({ ...editing, shares: v.shares ?? 0 }) : null;
      if (lockedNow && Math.abs((v.costBasis ?? 0) - (Number(editing.costBasis) || 0)) > 0.005 && Math.abs((v.costBasis ?? 0) - lockedNow.total) > 0.005) { const b = f.elements.costBasis; b.setCustomValidity(`${editing.symbol}'s cost is its ${lockedNow.count} purchases on Tax lots, ${fmt.money(lockedNow.total, cur)} in all. Type ${fmt.money(lockedNow.total, cur)}, or remove a purchase on Tax lots and add it again with the right cost.`); b.reportValidity(); b.addEventListener("input", () => b.setCustomValidity(""), { once: true }); return false; }
      const held = (msg) => { const b = f.elements.shares; b.setCustomValidity(msg); b.reportValidity(); b.addEventListener("input", () => b.setCustomValidity(""), { once: true }); return false; };
      if (editing && inLots > 0 && !((v.shares ?? 0) > 0)) return held(`To take ${editing.symbol} off, use "Remove this holding" below. Otherwise type how many you hold.`);
      // fewer shares than its lots hold would leave Tax lots counting purchases the fund no longer has
      if (editing && !oneLot && inLots > 0 && (v.shares ?? 0) < inLots - 1e-6) { return held(`${fmt.num(inLots, 3)} shares of ${editing.symbol} are in lots on Tax lots. Remove or change those lots first, or type at least ${fmt.num(inLots, 3)}.`); }
      const clean = { accountId: v.accountId, symbol: v.symbol.trim().toUpperCase(), name: v.name.trim(), shares: v.shares ?? 0, price: v.price ?? null, priceAsOf: v.price !== null ? fmt.today() : null, costBasis: v.costBasis ?? null, assetClass: v.assetClass || "", expenseRatio: v.expenseRatio ?? null, yield: v.yield ?? null };
      // optional, written only when chosen (left as usual: the record is what it was before this box existed)
      const pays = Object.prototype.hasOwnProperty.call(PAYS, v.paysEvery ?? "") ? v.paysEvery : "";
      if (pays) clean.paysEvery = pays;
      if (lab.list.length) clean.labels = lab.list;
      if (!clean.symbol) return false;
      const id = editing?.id ?? ui.uid();
      lastAccountId = clean.accountId;
      const newShares = v.shares ?? 0, oldShares = Number(oneLot?.shares) || 0;
      const fewer = !!oneLot && newShares < oldShares - 1e-9;
      const costTo = oneLot && newShares <= oldShares + 1e-9 && clean.costBasis !== null && Math.abs(clean.costBasis - (Number(oneLot.cost) || 0)) > 0.005 ? clean.costBasis : null;
      const follow = fewer || costTo !== null;
      const more = !!oneLot && newShares > oldShares + 1e-9;   // the extra shares' purchase is not known: say where to add it
      const sharesWord = (n) => `${fmt.num(n, 8)} share${Math.abs(n - 1) < 1e-12 ? "" : "s"}`;
      pending = editing ? `${clean.symbol} saved.${more ? ` The other ${sharesWord(newShares - oldShares)} ${Math.abs(newShares - oldShares - 1) < 1e-12 ? "is" : "are"} in no purchase yet: on Tax lots, add when you bought them and what they cost, and "What you paid in all" goes up by that cost.` : ""}${follow ? ` Its purchase${oneLot.date ? ` on ${fmt.date(oneLot.date)}` : ""} now has ${sharesWord(fewer ? newShares : oldShares)}, cost ${fmt.money(costTo ?? (Number(oneLot.cost) || 0), cur)}.` : ""}${editing && !oneLot && newShares > (Number(editing.shares) || 0) + 1e-9 && clean.costBasis !== null && Math.abs(clean.costBasis - (Number(editing.costBasis) || 0)) < 0.005 ? ` If you bought more, add what the new shares cost to "What you paid in all", so the gain stays right.` : ""}${editing && newShares < (Number(editing.shares) || 0) - 1e-9 && costTo === null && clean.costBasis !== null && Math.abs(clean.costBasis - (Number(editing.costBasis) || 0)) < 0.005 ? ` If you sold some, lower "What you paid in all" by what those shares cost, so the gain stays right.` : ""}` : `${clean.symbol} added to ${nameOfAccount(clean.accountId)}.`;
      // how often it pays changes no figure here: the green line says where it shows (Dividends' Month by month)
      if (pays !== (Object.prototype.hasOwnProperty.call(PAYS, editing?.paysEvery ?? "") ? editing.paysEvery : "")) pending += ` Dividends now counts it as paying ${PAYS_WORDS[pays]}.`;
      const relabel = labelChange(editing ? labelsOf(editing) : [], lab.list);
      if (relabel) pending += ` ${labelWords(relabel)}`;
      // the list stays narrowed only when what was saved still shows under that label (else it would vanish from view)
      if (shownLabel && !lab.list.some((l) => sameLabel(l, shownLabel)) && !hasLabel(plan.accounts.find((a) => a.id === clean.accountId), shownLabel)) shownLabel = null;
      editId = null; showId = id;
      store.update((p) => { p.holdings = p.holdings ?? []; if (editing) { const i = p.holdings.findIndex((h) => h.id === editing.id); if (i >= 0) { p.holdings[i] = { ...p.holdings[i], ...clean }; if (!pays) delete p.holdings[i].paysEvery; if (!lab.list.length) delete p.holdings[i].labels; if (follow) { const old = Number(oneLot.shares) || 0; p.holdings[i].lots = (p.holdings[i].lots ?? []).map((l) => l.id === oneLot.id ? { ...l, shares: fewer ? newShares : l.shares, cost: costTo ?? l.cost } : l); } } } else p.holdings.push({ id, lots: [], ...clean }); syncCrypto(p, fmt.today(), editing); });
    }, { submitLabel: editing ? "Save changes" : "Add holding", resetAfter: !editing,
      // a holding with no kind yet is tapped to pick one ("pick a class"): its box is in view, not folded away
      moreOpen: editing && classify0(editing) === "unknown" ? true : undefined, onCancel: editing ? () => { editId = null; showId = editing.id; redraw(); } : d.hasData ? () => { showForm = false; drawForm(); } : null });
    labelPicks(ui, f, known);
    return f;
  };
  function classify0(h) { return d.items.find((x) => x.id === h.id)?.cls ?? ""; }
  const removeButton = (editing) => ui.button("Remove this holding", () => {
    const lots = (editing.lots ?? []).length;
    if (!ui.confirm(`Remove ${editing.symbol}${lots ? ` and its ${lots} lot${lots === 1 ? "" : "s"}` : ""} from ${nameOfAccount(editing.accountId)}?`)) return;
    const id = editing.id; editId = null; pending = `${editing.symbol} removed from ${nameOfAccount(editing.accountId)}.`;
    store.update((p) => { p.holdings = (p.holdings ?? []).filter((h) => h.id !== id); syncCrypto(p, fmt.today(), editing); });
  }, { class: "danger" });

  const formCard = ui.card(null);
  const formHost = ui.h("div");
  let showForm = !d.hasData && accounts.length > 0;
  const drawForm = () => {
    formHost.innerHTML = "";
    if (!accounts.length) return;
    if (!showForm) { formHost.append(ui.button("+ Add a holding", () => { showForm = true; drawForm(); formHost.querySelector("select, input")?.focus({ preventScroll: true }); }, { class: "secondary" })); return; }
    formHost.append(ui.h("div", {}, ui.h("h2", {}, "Add a holding"), holdingForm(null)));
  };
  drawForm();
  // your own labels (gap next-60 #44): chips narrow the list to one label (a holding's own, or its account's) and say its
  // worth; the figures above stay the whole list's
  const ownLabels = holdingLabels(plan);
  if (shownLabel && !ownLabels.some((l) => sameLabel(l, shownLabel))) shownLabel = null;
  const shown = shownLabel ? byLabel(plan, d.items, shownLabel) : null;
  // (a card of its own: the chips' own bottom margin goes, the line keeps its distance)
  if (ownLabels.length) root.append(ui.card(null, labelChips(ui, ownLabels, shownLabel, (l) => { shownLabel = l; redraw(); }, "All holdings", { marginBottom: "0" }),
    shown ? ui.h("p", { class: "small", style: { margin: "10px 0 0" } }, labelLine(shown, money)) : null));
  // holdings by account; the one being edited opens its form under its row
  let showRow = null, editBox = null;
  for (const a of d.byAccount.filter((x) => x.count)) {
    const mine = d.items.filter((h) => h.accountId === a.accountId && (!shown || shown.items.includes(h))).sort((x, y) => y.value - x.value);
    if (!mine.length) continue;
    const rowOf = (h) => {
      const li = ui.h("li", { role: "button", tabindex: "0", "data-id": h.id, "aria-expanded": editId === h.id ? "true" : "false", style: { cursor: "pointer" },
        onClick: () => { if (editId === h.id) return; editId = h.id; showId = h.id; redraw(); },
        onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
        ui.h("span", { class: "ic" }, ASSET_CLASSES[h.cls].icon || ""),
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, h.symbol, " ", ui.h("span", { class: h.cls === "unknown" ? "pill warn" : "pill" }, h.cls === "unknown" ? "pick a class" : h.clsLabel)), ui.h("div", { class: "d" }, `${h.name ? `${h.name} · ` : ""}${fmt.num(h.shares, 3)} shares${h.priced ? ` at ${money(h.price)}` : ""}${h.costBasis ? ` · paid ${money(h.costBasis)}` : ""}`, ...labelsOf(h).map((l) => ui.h("span", { class: "pill" }, l)))),
        ui.h("span", { class: "st amount" }, ui.h("div", {}, money(h.value)), h.costBasis > 0 ? ui.h("div", { class: "muted small", style: h.gain < 0 ? { color: "var(--bad)" } : null }, signed(h.gain)) : null));
      if (h.id === showId) showRow = li;
      return li;
    };
    const at = mine.findIndex((h) => h.id === editId);
    // the account's own labels as pills on its line, so a holding listed under a label for its account's sake shows why
    const parts = [ui.h("p", { class: "muted small" }, `${a.typeLabel} · ${money(a.value)} in ${a.count} holding${a.count === 1 ? "" : "s"}${Math.abs(a.gap) > 1 ? ` · Net worth balance ${money(a.balance)}` : ""}`, ...labelsOf((plan.accounts ?? []).find((x) => x.id === a.accountId)).map((l) => ui.h("span", { class: "pill" }, l)))];
    if (at < 0) parts.push(ui.h("ul", { class: "page-list" }, mine.map(rowOf)));
    else {
      const editing = { ...plan.holdings.find((x) => x.id === editId) };
      editBox = ui.h("div", { style: { margin: "4px 0 16px" } }, ui.h("h2", {}, `Edit: ${editing.symbol}`), holdingForm(editing), ui.h("p", { style: { marginTop: "12px" } }, removeButton(editing)));
      parts.push(ui.h("ul", { class: "page-list" }, mine.slice(0, at + 1).map(rowOf)), editBox);
      if (at + 1 < mine.length) parts.push(ui.h("ul", { class: "page-list" }, mine.slice(at + 1).map(rowOf)));
    }
    root.append(ui.card(a.name, ...parts));
  }
  if (accounts.length) { formCard.append(formHost); root.append(formCard); }
  root.append(importFold(ctx, d));
  // after an add, a save or a Cancel, bring that row back into view; an edit form puts the cursor in its first box
  const firstBox = editBox?.querySelector("input");
  firstBox?.focus({ preventScroll: true });
  if (showRow && (openedByLink || (firstBox && firstBox.getBoundingClientRect().bottom > window.innerHeight))) showRow.scrollIntoView({ block: "start" });
  else if (showRow) { const r = showRow.getBoundingClientRect(); if (r.top < 70 || r.bottom > window.innerHeight) showRow.scrollIntoView({ block: "center" }); }
  openedByLink = false;
  showId = null;
}

function importFold(ctx, d) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const accounts = d.investedAccounts;
  if (!accounts.length) return ui.h("div");
  // with several accounts the importer asks which one (a brokerage file was preselected into the first account, a 401(k))
  let text = "", parsed = null, fileAccount = "", accountId = accounts.length === 1 ? accounts[0].id : (lastAccountId ?? "");
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
    const acctSel = ui.select([...(accounts.length > 1 ? [{ value: "", label: "Pick the account" }] : []), ...accounts.map((a) => ({ value: a.id, label: a.name }))], accountId, { "aria-label": "Into which account", onChange: (e) => { accountId = e.target.value; e.target.setCustomValidity(""); } });
    const fileSel = fileAccounts.length > 1 ? ui.select([{ value: "", label: "all of them" }, ...fileAccounts.map((a) => ({ value: a, label: a }))], fileAccount, { "aria-label": "Rows from", onChange: (e) => { fileAccount = e.target.value; drawPreview(); } }) : null;
    host.append(
      ui.h("p", { class: "small" }, `${rows.length} position${rows.length === 1 ? "" : "s"} found, ${fmt.money(total, cur)} in all.`),
      ui.h("div", { class: "form" }, fileSel ? ui.field("The file lists several accounts; import rows from", fileSel) : null, ui.field("Into which account", acctSel)),
      ui.h("ul", { class: "records" }, rows.slice(0, 40).map((r) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, r.symbol), ui.h("span", { class: "rec-value" }, r.value !== null ? fmt.money(r.value, cur) : "-")), ui.h("div", { class: "rec-sub" }, `${r.name || ""}${r.shares ? ` · ${r.shares} shares` : ""}${r.price !== null && !r.cash ? ` at ${fmt.money(r.price, cur)}` : ""}${r.costBasis !== null ? ` · paid ${fmt.money(r.costBasis, cur)}` : ""}`)))),
      rows.length > 40 ? ui.h("p", { class: "muted small" }, `...and ${rows.length - 40} more.`) : null,
      ui.row(ui.button(`Import ${rows.length} position${rows.length === 1 ? "" : "s"}`, () => {
        if (!accountId) { acctSel.setCustomValidity("Pick the account these positions are in."); acctSel.reportValidity(); acctSel.focus(); return; }
        lastAccountId = accountId;
        const r = mergePositions(plan.holdings, rows, accountId, { today: fmt.today(), uid: ui.uid });
        pending = `${r.added} added, ${r.updated} updated in ${accounts.find((a) => a.id === accountId)?.name ?? "the account"}. Holdings already on file that the file did not list were left alone.`;
        pendingAt = "import";
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
  // one quiet card of its own (kind "own": it holds boxes and is never opened by a switch); a part's body sits in a grid
  // with a 12 px gap, so the rows keep their own spacing
  // after an import the importer stays open with its green line at its top, where the thumb is (R17)
  const done = pendingAt === "import" && pending ? ui.notice("ok", pending) : null;
  if (pendingAt === "import") { pending = null; pendingAt = null; }
  return part(ctx, { id: "import", kind: "own", title: IMPORT_TITLE, card: true, says: "from your brokerage", open: done ? true : undefined, body: [
    done,
    ui.h("p", { class: "muted small" }, "Every brokerage's positions (holdings) page has a download or export button; the CSV it gives is read here, from Fidelity, Schwab, Vanguard and the like. Nothing leaves this device. Matching symbols in the chosen account are updated, new ones added."),
    ui.row(ui.button("Choose the file", () => file.click(), { class: "secondary" }), chosen), file,
    ui.h("div", { class: "form" }, ui.field("Or paste", paste)), ui.row(ui.button("Use the pasted text", () => { text = paste.value; prepare(); }, { class: "secondary" })),
    host] });
}

// A crypto account's balance follows its coins, as on the Crypto page (a coin changed or removed here left the wallet at
// its old balance): with coins listed, the sum of shares x price; the last coin removed takes its value off.
function syncCrypto(p, today, gone) {
  for (const a of (p.accounts ?? []).filter((x) => x.type === "crypto")) {
    const mine = (p.holdings ?? []).filter((h) => h.accountId === a.id);
    if (mine.length) { a.balance = Math.round(mine.reduce((s, h) => s + (Number(h.shares) || 0) * (Number(h.price) || 0), 0) * 100) / 100; a.asOf = today; }
    else if (gone && gone.accountId === a.id && !(p.holdings ?? []).some((h) => h.id === gone.id && h.accountId === a.id)) { a.balance = Math.max(0, Math.round(((Number(a.balance) || 0) - (Number(gone.shares) || 0) * (Number(gone.price) || 0)) * 100) / 100); a.asOf = today; }
  }
}

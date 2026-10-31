// modules/transactions/ledger/view.js -- DOM only. Filters on top, totals, the list (tap a row
// to edit), "show more", and one form for adding or editing a transaction by hand.
import { compute, txKey } from "./compute.js";
import { categoriesOf } from "../categories/compute.js";

// filter state survives the re-render the shell does after every save
const state = { month: "", accountId: "", category: "", q: "", limit: 100 };

const FIELDS = (plan) => [
  { key: "date", label: "Date", type: "date", required: true },
  { key: "payee", label: "Who or what", type: "text", required: true, placeholder: "e.g. Kroger" },
  { key: "amount", label: "Amount", type: "money", required: true, help: "money in is positive, money out is negative (-45.20)" },
  { key: "accountId", label: "Account", type: "select", options: (plan.accounts ?? []).map((a) => ({ value: a.id, label: a.name })) },
  { key: "category", label: "Category", type: "select", options: [{ value: "", label: "Uncategorised" }, ...categoriesOf(plan).map((c) => ({ value: c.id, label: `${c.icon} ${c.label}` }))] },
  { key: "note", label: "Note", type: "text" },
  { key: "tagsText", label: "Tags", type: "text", placeholder: "comma separated, e.g. vacation, kids" },
];

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  // deep links set the filters once, then the address goes back to the bare page so the
  // filters the person picks afterwards are not overridden on the next render
  const rest = ctx.route.rest ?? [];
  if (rest.length) {
    if (rest[0] === "uncategorised") { state.category = "none"; state.month = ""; }
    if (rest[0] === "month" && rest[1]) { state.month = rest[1]; }
    if (rest[0] === "account" && rest[1]) { state.accountId = rest[1]; }
    ctx.go("transactions", "ledger");
    return;
  }
  const d = compute(plan, state);
  let editing = null;

  if (d.total === 0) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Your transactions"),
      ui.h("p", { class: "lede" }, "Nothing here yet. The quickest way in is a file from your bank: download the last three months as CSV and bring it to the Import page. You can also add a transaction by hand below."),
      ui.row(ui.h("a", { class: "btn", href: "#/transactions/import" }, "Import a bank file"), (plan.accounts ?? []).length ? null : ui.h("a", { class: "btn secondary", href: "#/balance/net-worth" }, "Add an account first")),
    ));
  } else {
    const monthSel = ui.select([{ value: "", label: "All months" }, ...d.months.map((m) => ({ value: m.ym, label: `${m.label} (${m.count})` }))], state.month, { "aria-label": "Month", onChange: (e) => { state.month = e.target.value; redraw(); } });
    const acctSel = ui.select([{ value: "", label: "All accounts" }, ...d.accounts.map((a) => ({ value: a.id, label: `${a.name} (${a.count})` }))], state.accountId, { "aria-label": "Account", onChange: (e) => { state.accountId = e.target.value; redraw(); } });
    const catSel = ui.select([{ value: "", label: "All categories" }, { value: "none", label: `Uncategorised (${d.uncategorisedAll})` }, ...categoriesOf(plan).map((c) => ({ value: c.id, label: `${c.icon} ${c.label}` }))], state.category, { "aria-label": "Category", onChange: (e) => { state.category = e.target.value; redraw(); } });
    const search = ui.h("input", { type: "search", placeholder: "Search payee or note", value: state.q, "aria-label": "Search", onInput: (e) => { state.q = e.target.value; clearTimeout(search._t); search._t = setTimeout(redraw, 250); } });
    // Totals first; the four filters fold behind one row that says what is showing
    // (design log 2026-09-15).
    root.append(ui.card(null, ui.row(
      ui.stat("Money in", fmt.money(d.in, cur), state.month ? "this month" : "all time"),
      ui.stat("Money out", fmt.money(d.out, cur), "transfers between your accounts not counted"),
      ui.stat(d.net >= 0 ? "Kept" : "Short", fmt.money(Math.abs(d.net), cur), `${d.matched} transaction${d.matched === 1 ? "" : "s"}${d.uncategorised ? `, ${d.uncategorised} uncategorised` : ""}`),
    )));
    const showing = [
      state.month ? (d.months.find((m) => m.ym === state.month)?.label ?? state.month) : "all months",
      state.accountId ? (d.accounts.find((a) => a.id === state.accountId)?.name ?? "one account") : "all accounts",
      state.category === "none" ? "uncategorised" : state.category ? (categoriesOf(plan).find((c) => c.id === state.category)?.label ?? "one category") : "all categories",
      state.q ? `“${state.q}”` : null,
    ].filter(Boolean).join(" · ");
    const filtered = !!(state.month || state.accountId || state.category || state.q);
    root.append(ui.h("details", { class: "card fold fold-card", open: filtered ? true : null },
      ui.h("summary", {}, ui.h("h2", {}, "Showing"), ui.h("span", { class: "fold-status" }, showing), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
      ui.h("div", { class: "fold-body" }, ui.h("div", { class: "form" }, ui.field("Month", monthSel), ui.field("Account", acctSel), ui.field("Category", catSel), ui.field("Search", search)))));
    // the way to Categorise is a full-size button, not a link inside the sentence (44 px to tap)
    if (d.uncategorisedAll && state.category !== "none") root.append(ui.notice("info", [ui.h("div", {}, `${d.uncategorisedAll} transaction${d.uncategorisedAll === 1 ? " has" : "s have"} no category yet.`), ui.row(ui.h("a", { class: "btn secondary", href: "#/transactions/categorize" }, "File them in a few taps"))]));
  }

  const formCard = ui.card(null);
  const formHost = ui.h("div");
  const drawForm = () => {
    formHost.innerHTML = "";
    if (!editing) { formHost.append(ui.row(ui.button("Add a transaction by hand", () => { editing = { date: fmt.today(), accountId: (plan.accounts ?? [])[0]?.id ?? "", category: "", amount: null }; drawForm(); }, { class: d.total ? "secondary" : "" }))); return; }
    const isNew = !editing.id;
    const values = { ...editing, tagsText: (editing.tags ?? []).join(", ") };
    formHost.append(ui.h("div", {},
      ui.h("h2", {}, isNew ? "New transaction" : `Edit: ${editing.payee}`),
      editing.rawPayee && editing.rawPayee !== editing.payee ? ui.h("p", { class: "muted small" }, `The bank wrote: ${editing.rawPayee}`) : null,
      ui.form(FIELDS(plan), values, (v) => {
        const clean = { date: v.date, payee: v.payee.trim(), amount: v.amount ?? 0, accountId: v.accountId, category: v.category, note: (v.note || "").trim(), tags: (v.tagsText || "").split(",").map((s) => s.trim()).filter(Boolean) };
        if (!clean.payee || !clean.date) return;
        store.update((p) => {
          p.transactions = p.transactions ?? [];
          if (isNew) { const t = { id: ui.uid(), ...clean, rawPayee: clean.payee }; t.key = txKey(t); p.transactions.push(t); }
          else { const i = p.transactions.findIndex((t) => t.id === editing.id); if (i >= 0) { p.transactions[i] = { ...p.transactions[i], ...clean }; p.transactions[i].key = txKey(p.transactions[i]); } }
        });
        editing = null;
      }, { submitLabel: isNew ? "Add transaction" : "Save changes", onCancel: () => { editing = null; drawForm(); } }),
      isNew ? null : ui.h("p", { style: { marginTop: "12px" } }, ui.button("Delete this transaction", () => {
        if (!ui.confirm(`Delete "${editing.payee}" on ${fmt.date(editing.date)}?`)) return;
        const id = editing.id; editing = null;
        store.update((p) => { p.transactions = (p.transactions ?? []).filter((t) => t.id !== id); });
      }, { class: "danger" })),
    ));
  };

  const list = ui.h("div");
  const drawList = () => {
    list.innerHTML = "";
    if (!d.total) return;
    if (!d.rows.length) { list.append(ui.card(null, ui.muted("No transactions match these filters."))); return; }
    let lastMonth = "";
    const items = [];
    for (const t of d.rows) {
      const m = String(t.date).slice(0, 7);
      if (m !== lastMonth && !state.month) { items.push(ui.h("li", { class: "muted small", style: { minHeight: "auto", padding: "10px 0 2px", borderBottom: "0", fontWeight: "600" } }, d.months.find((x) => x.ym === m)?.label ?? m)); lastMonth = m; }
      const a = Number(t.amount) || 0;
      items.push(ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer" },
        onClick: () => { editing = plan.transactions.find((x) => x.id === t.id); drawForm(); formCard.scrollIntoView({ behavior: "smooth", block: "start" }); },
        onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
        ui.h("span", { class: "ic" }, t.transfer ? "🔁" : t.icon),
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, t.payee, t.category ? null : ui.h("span", { class: "pill warn" }, "no category")),
          ui.h("div", { class: "d" }, [fmt.date(t.date), t.transfer ? "transfer" : (t.category ? t.categoryLabel : null), d.accounts.length > 1 ? t.accountName : null, t.note || null].filter(Boolean).join(" · "))),
        ui.h("span", { class: "st", style: { fontWeight: "600", color: a > 0 && !t.transfer ? "var(--ok)" : "inherit" } }, (a > 0 ? "+" : "-") + fmt.money(Math.abs(a), cur, undefined, 2)),
      ));
    }
    list.append(ui.card(null, ui.h("ul", { class: "page-list" }, items),
      d.hasMore ? ui.row(ui.button(`Show more (${d.matched - d.shown} left)`, () => { state.limit += 100; redraw(); }, { class: "secondary" })) : null,
      ui.h("p", { class: "muted small" }, "Tap a transaction to change its category, name or note.")));
  };
  const redraw = () => { root.innerHTML = ""; render(root, ctx); };   // same plan, new filters

  drawForm();
  formCard.append(formHost);
  root.append(formCard);
  drawList();
  root.append(list);
}

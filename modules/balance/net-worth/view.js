// modules/balance/net-worth/view.js -- DOM only.
import { ACCOUNT_TYPES, isLiability, countedBalance } from "./compute.js";

// The shell re-renders after store.update, so a confirmation waits here for the next render.
let pending = null;

const FIELDS = [
  { key: "name", label: "Account name", type: "text", required: true, placeholder: "e.g. Chase checking" },
  { key: "type", label: "Type", type: "select", options: Object.entries(ACCOUNT_TYPES).map(([value, t]) => ({ value, label: t.label })) },
  { key: "institution", label: "Institution", type: "text" },
  { key: "balance", label: "Current balance", type: "money", required: true, help: "for a loan or card, the amount still owed" },
  { key: "asOf", label: "Balance as of", type: "date" },
  { key: "ownerId", label: "Whose account", type: "text", help: "a name, or leave blank if it is joint" },
];

export function render(root, ctx) {
  const { ui, fmt, store, derived: d, plan } = ctx;
  const cur = plan.meta.currency;
  let editing = null;

  const empty = plan.accounts.length === 0;
  if (empty) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Net worth"),
      ui.h("p", { class: "lede" }, "Add each account with its current balance. Net worth is simply what you own minus what you owe, and this page tracks it over time."),
      ui.h("p", { class: "muted small" }, "Start with the big ones: checking, savings, retirement accounts, the mortgage, credit cards. You can add the rest later."),
    ));
  } else {
    root.append(ui.card(null, ui.row(
      ui.stat("Net worth", fmt.money(d.netWorth, cur), d.change ? (d.change.since === fmt.today() ? "saved today" : `${fmt.signed(d.change.sinceLast, cur)} since ${fmt.date(d.change.since)}`) : "what you own minus what you owe"),
      ui.stat("You own", fmt.money(d.assets, cur), `${fmt.money(d.liquid, cur)} is cash or easy to sell`),
      ui.stat("You owe", fmt.money(d.liabilities, cur), d.liabilities ? "loans, cards, mortgage" : "nothing on file"),
      ui.stat("Invested for later", fmt.money(d.investable, cur), investedLine(d, fmt, cur)),
    )));
  }

  // The form stays open on the first visit; once accounts exist it folds behind a button
  // (design log 2026-09-15). Edit opens it filled in.
  let showForm = empty;
  const formHost = ui.h("div");
  const drawForm = () => {
    formHost.innerHTML = "";
    if (!showForm && !editing) {
      formHost.append(ui.h("div", { style: { marginTop: "12px" } }, ui.button("+ Add another account", () => { showForm = true; drawForm(); }, { class: "secondary" })));
      return;
    }
    const values = editing ? { ...editing } : { type: "checking", asOf: fmt.today() };
    formHost.append(ui.h("h2", {}, editing ? `Edit ${editing.name}` : "Add an account"));
    formHost.append(ui.form(FIELDS, values, (v) => {
      store.update((p) => {
        if (editing) { const i = p.accounts.findIndex((a) => a.id === editing.id); if (i >= 0) p.accounts[i] = { ...p.accounts[i], ...v }; }
        else p.accounts.push({ id: ui.uid(), ...v, history: [] });
      });
      editing = null;
    }, { submitLabel: editing ? "Save changes" : "Add account", resetAfter: !editing, onCancel: (editing || !empty) ? () => { editing = null; showForm = false; drawForm(); } : null }));
  };
  drawForm();

  const edit = (a) => { editing = a; showForm = true; drawForm(); formHost.scrollIntoView({ behavior: "smooth" }); };
  const del = (a) => { if (ui.confirm(`Delete ${a.name}?`)) store.update((p) => { p.accounts = p.accounts.filter((x) => x.id !== a.id); }); };
  const typeLabel = (a) => (ACCOUNT_TYPES[a.type] ?? ACCOUNT_TYPES.other_asset).label;
  // Anything that counts against you (a loan, or an overdrawn asset) shows a minus in red (F-008).
  const balance = (a) => { const against = isLiability(a.type) || countedBalance(a) < 0; return ui.h("span", { class: against ? "bad" : "" }, (against ? "-" : "") + fmt.money(Math.abs(countedBalance(a)), cur)); };
  const rows = [...plan.accounts].sort((a, b) => Number(isLiability(a.type)) - Number(isLiability(b.type)) || Math.abs(b.balance) - Math.abs(a.balance));
  // Desktop: a table. Phone: one stacked record per account (tester F-002).
  const table = ui.h("div", { class: "only-wide" }, ui.table([
    { key: "name", label: "Account" },
    { key: "type", label: "Type", render: typeLabel },
    { key: "institution", label: "Institution" },
    { key: "balance", label: "Balance", align: "right", render: balance },
    { key: "asOf", label: "Balance as of", render: (a) => fmt.date(a.asOf) },
    { key: "actions", label: "", render: (a) => ui.h("span", {},
      ui.button("Edit", () => edit(a), { class: "secondary small" }), " ",
      ui.button("Delete", () => del(a), { class: "danger small" })) },
  ], rows, { empty: "No accounts yet. Add your first one below." }));
  // Phone record: name + Edit/Delete on the first line, type and balance on the second,
  // "as of" on the third (design log 2026-09-15, pass 2).
  const records = ui.h("ul", { class: "records only-narrow" }, rows.map((a) => ui.h("li", {},
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, a.name),
      ui.h("span", { class: "rec-actions" }, ui.button("Edit", () => edit(a), { class: "secondary small" }), ui.button("Delete", () => del(a), { class: "danger small" }))),
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-sub" }, [typeLabel(a), a.institution].filter(Boolean).join(" \u00b7 ")), ui.h("span", { class: "rec-value" }, balance(a))),
    ui.h("div", { class: "rec-sub" }, a.asOf ? `as of ${fmt.date(a.asOf)}` : ""))));
  root.append(ui.card(empty ? null : "Accounts",
    empty ? null : table, empty ? null : records,
    formHost,
  ));

  const histOut = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); histOut.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  if (!empty) root.append(ui.card("Over time",
    ui.h("p", { class: "muted small" }, "Save today's totals now and then (monthly is plenty). Each save becomes a point on your history; saving twice in one day just updates that day."),
    ui.row(ui.button("Save today's totals", () => { pending = "Today's totals saved."; store.update((p) => {
      p.netWorthHistory = (p.netWorthHistory ?? []).filter((h) => h.date !== fmt.today());
      p.netWorthHistory.push({ date: fmt.today(), assets: d.assets, liabilities: d.liabilities, netWorth: d.netWorth });
      for (const a of p.accounts ?? []) { a.history = (a.history ?? []).filter((h) => h.date !== fmt.today()); a.history.push({ date: fmt.today(), balance: Number(a.balance) || 0 }); }   // per-account points feed investments/performance
    }); })),
    histOut,
    d.history.length === 0 ? null : ui.table([
      { key: "date", label: "Date", render: (h) => fmt.date(h.date) },
      { key: "assets", label: "You own", align: "right", render: (h) => fmt.money(h.assets, cur) },
      { key: "liabilities", label: "You owe", align: "right", render: (h) => fmt.money(h.liabilities, cur) },
      { key: "netWorth", label: "Net worth", align: "right", render: (h) => fmt.money(h.netWorth, cur) },
    ], [...d.history].reverse()),
  ));
}

// Small line under "Invested for later": plain words at zero, no $0 parts otherwise.
function investedLine(d, fmt, cur) {
  if (!d.investable) return "nothing yet: retirement and investment accounts count here";
  const b = d.byTaxBucket;
  const parts = [];
  if (b.deferred) parts.push(`${fmt.money(b.deferred, cur)} in retirement accounts (pre-tax)`);
  if (b.free) parts.push(`${fmt.money(b.free, cur)} tax-free`);
  if (b.taxable) parts.push(`${fmt.money(b.taxable, cur)} taxable`);
  return parts.join(", ");
}

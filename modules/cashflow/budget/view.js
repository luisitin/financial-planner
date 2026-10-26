// modules/cashflow/budget/view.js -- DOM only. Envelopes with progress, suggestions from the
// last months, one form to add or edit an envelope.
import { compute } from "./compute.js";
import { categoriesOf } from "../../transactions/categories/compute.js";

const state = { month: "" };

let pending = null;   // confirmation kept across the shell re-render

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const today = fmt.today();
  const d = compute(plan, { today, month: state.month || undefined });
  let editing = null;
  const redraw = () => { root.innerHTML = ""; render(root, ctx); };
  const cats = categoriesOf(plan).filter((c) => c.kind === "expense");
  const FIELDS = [
    { key: "category", label: "Category", type: "select", options: cats.map((c) => ({ value: c.id, label: `${c.icon} ${c.label}` })) },
    { key: "amount", label: "Amount each month", type: "money", required: true, min: 0 },
    { key: "rollover", label: "Unspent money rolls into next month", type: "checkbox" },
  ];

  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.hasBudget ? `Budget for ${d.label}` : "Budget"),
    ui.h("p", { class: "lede" }, d.hasBudget
      ? (d.totals.left >= 0 ? `${fmt.money(d.totals.left, cur)} left in your envelopes with ${d.daysLeft} day${d.daysLeft === 1 ? "" : "s"} to go.` : `Your envelopes are ${fmt.money(-d.totals.left, cur)} over with ${d.daysLeft} day${d.daysLeft === 1 ? "" : "s"} to go.`)
      : "Give each kind of spending an envelope: an amount for the month. The page shows what is spent so far from your transactions, what is left, and whether the pace is right."),
    d.hasBudget ? null : ui.h("p", { class: "muted small" }, d.hasData ? "Suggestions below come from your last months of real spending." : "Import a bank file first and the page will suggest amounts from what you actually spend."),
  ));
  const months = []; for (let k = 0; k < 6; k++) { const dt = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 - k, 1); months.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`); }
  root.append(ui.card(null, ui.h("div", { class: "form" }, ui.field("Month", ui.select(months.map((m) => ({ value: m, label: compute(plan, { today, month: m }).label })), d.month, { onChange: (e) => { state.month = e.target.value; redraw(); } })))));

  const formCard = ui.card(null);
  const formHost = ui.h("div");
  let showForm = d.envelopes.length === 0;
  const drawForm = (prefill) => {
    formHost.innerHTML = "";
    if (prefill) showForm = true;
    if (!showForm && !editing) { formHost.append(ui.button("+ Add another envelope", () => { showForm = true; drawForm(); }, { class: "secondary" })); return; }
    const values = editing ? { ...editing } : { rollover: false, ...(prefill ?? {}) };
    formHost.append(ui.h("div", {},
      ui.h("h2", {}, editing ? `Edit ${editing.label}` : "Add an envelope"),
      ui.form(FIELDS, values, (v) => {
        pending = editing ? "Envelope saved." : "Envelope added.";
        store.update((p) => {
          p.budgets = p.budgets ?? [];
          if (editing) { const i = p.budgets.findIndex((b) => b.id === editing.id); if (i >= 0) p.budgets[i] = { ...p.budgets[i], category: v.category, amount: v.amount ?? 0, rollover: !!v.rollover }; }
          else { const i = p.budgets.findIndex((b) => b.category === v.category); if (i >= 0) p.budgets[i] = { ...p.budgets[i], amount: v.amount ?? 0, rollover: !!v.rollover }; else p.budgets.push({ id: ui.uid(), category: v.category, amount: v.amount ?? 0, period: "monthly", rollover: !!v.rollover }); }
        });
        editing = null;
      }, { submitLabel: editing ? "Save changes" : "Add envelope", resetAfter: !editing, onCancel: (editing || d.envelopes.length) ? () => { editing = null; showForm = false; drawForm(); } : null }),
      editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button(`Remove the ${editing.label} envelope`, () => { const id = editing.id; editing = null; pending = "Envelope removed."; store.update((p) => { p.budgets = (p.budgets ?? []).filter((b) => b.id !== id); }); }, { class: "danger" })) : null,
    ));
  };
  drawForm();

  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  if (d.envelopes.length) root.append(ui.card("Envelopes",
    ui.h("ul", { class: "page-list" }, d.envelopes.map((e) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer" },
      onClick: () => { editing = plan.budgets.find((b) => b.id === e.id); editing = { ...editing, label: e.label }; showForm = true; drawForm(); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); },
      onKeydown: (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); ev.currentTarget.click(); } } },
      ui.h("span", { class: "ic" }, e.icon),
      ui.h("span", { class: "body" },
        ui.h("div", { class: "t" }, e.label, " ", e.pace === "over" ? ui.h("span", { class: "pill warn" }, "over") : e.pace === "ahead" ? ui.h("span", { class: "pill warn" }, "spending fast") : ui.h("span", { class: "pill ok" }, "on track")),
        ui.h("div", { class: "progress", style: { margin: "6px 0 2px" } }, ui.h("span", { style: { width: `${Math.round(e.share * 100)}%`, background: e.pace === "over" ? "var(--bad)" : e.pace === "ahead" ? "var(--warn)" : "var(--ok)" } })),
        ui.h("div", { class: "d" }, `${fmt.money(e.spent, cur)} of ${fmt.money(e.available, cur)}${e.carried ? ` (${fmt.money(e.carried, cur)} rolled over)` : ""}${e.rollover ? " · rolls over" : ""}`)),
      ui.h("span", { class: "st", style: { fontWeight: "600", color: e.left < 0 ? "var(--bad)" : "inherit" } }, `${e.left < 0 ? "-" : ""}${fmt.money(Math.abs(e.left), cur)} left`)))),
    ui.h("p", { class: "muted small" }, `Day ${d.dayOfMonth} of ${d.daysInMonth}. "Spending fast" means more than the share of the month that has passed. Tap an envelope to change it.`),
    out, formHost,
  ));
  if (d.unbudgeted.length) root.append(ui.card("Spent this month with no envelope",
    ui.h("ul", { class: "page-list" }, d.unbudgeted.slice(0, 12).map((u) => ui.h("li", {},
      ui.h("span", { class: "ic" }, u.icon), ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, u.label)),
      ui.h("span", { class: "st" }, fmt.money(u.spent, cur), " ", u.category ? ui.button("Add envelope", () => { editing = null; drawForm({ category: u.category, amount: Math.round(u.spent) }); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); }, { class: "secondary small" }) : null))))));
  const useIt = (sg) => { pending = `Envelope added for ${sg.label}.`; store.update((p) => { p.budgets = p.budgets ?? []; if (!p.budgets.some((b) => b.category === sg.category)) p.budgets.push({ id: ui.uid(), category: sg.category, amount: sg.average, period: "monthly", rollover: false }); }); };
  const suggestionRow = (sg) => ui.h("li", {},
    ui.h("span", { class: "ic" }, sg.icon),
    ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, sg.label), ui.h("div", { class: "d" }, `average of ${sg.months} month${sg.months === 1 ? "" : "s"}`)),
    ui.h("span", { class: "st" }, fmt.money(sg.average, cur), " ", ui.button("Use it", () => useIt(sg), { class: "secondary small" })));
  if (d.suggestions.length) root.append(ui.card("Suggested from your last months", ui.h("ul", { class: "page-list" }, d.suggestions.slice(0, 12).map(suggestionRow))));
  if (!d.envelopes.length) { formCard.append(out, formHost); root.append(formCard); }
}

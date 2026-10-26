// modules/cashflow/expenses/view.js -- DOM only. Totals, a breakdown by category with bars,
// a tappable list of expenses, one form to add or edit.
import { compute, CATEGORIES } from "./compute.js";
import { PERIOD_OPTIONS } from "../../../core/math/periods.js";

const FIELDS = [
  { key: "name", label: "What is it", type: "text", required: true, placeholder: "e.g. Rent" },
  { key: "category", label: "Category", type: "select", options: Object.entries(CATEGORIES).map(([value, c]) => ({ value, label: c.label })) },
  { key: "amount", label: "Amount", type: "money", required: true, min: 0, help: "what you pay each time" },
  { key: "period", label: "How often", type: "select", options: PERIOD_OPTIONS },
  { key: "essential", label: "I must pay this (not optional)", type: "checkbox" },
  { key: "inflates", label: "Goes up with prices over the years", type: "checkbox" },
  { key: "startDate", label: "Starts", type: "date", help: "blank if it already has" },
  { key: "endDate", label: "Ends", type: "date", help: "blank if it does not end" },
];

// The shell re-renders after store.update, so a confirmation waits here for the next render.
let pending = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  let editing = null;
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  if (d.count === 0) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "What goes out?"),
      ui.h("p", { class: "lede" }, "Add your regular expenses: rent or mortgage, utilities, groceries, insurance, the car, subscriptions. Rough numbers are fine to start."),
      ui.h("p", { class: "muted small" }, "Mark each one as something you must pay or something that is nice to have. That split is what the emergency-fund and retirement pages use."),
    ));
  } else {
    root.append(ui.card(null, ui.row(
      ui.stat("Per month", fmt.money(d.monthly, cur), `${fmt.money(d.yearly, cur)} a year`),
      ui.stat("Must pay", fmt.money(d.essentialMonthly, cur), "per month, the bills that cannot wait"),
      ui.stat("Nice to have", fmt.money(d.optionalMonthly, cur), "per month, could be cut in a pinch"),
      d.income ? ui.stat(d.leftOver >= 0 ? "Left over" : "Short", fmt.money(Math.abs(d.leftOver), cur), d.leftOver >= 0 ? `each month, ${fmt.pct(d.savingsRate, 0)} of income` : "each month; spending is above income") : null,
    ),
    // Next year and one-time amounts as one sentence under the tiles (design log 2026-09-16, pass 3).
    ui.h("p", { class: "muted small", style: { marginTop: "10px" } },
      `Next year about ${fmt.money(d.nextYear, cur)} after inflation${d.income ? ` (${d.leftOverNextYear >= 0 ? "leaving" : "short by"} ${fmt.money(Math.abs(d.leftOverNextYear), cur)} a year)` : ""}.` +
      (d.oneTime ? ` One-time costs coming up: ${fmt.money(d.oneTime, cur)}, not in the monthly total.` : "")),
    ));
    if (d.byCategory.length) root.append(ui.card("Where it goes",
      ui.h("ul", { class: "page-list" }, d.byCategory.map((c) => ui.h("li", {},
        ui.h("span", { class: "ic" }, c.icon),
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, c.label), ui.h("div", { class: "progress", style: { margin: "6px 0 0" } }, ui.h("span", { style: { width: `${Math.round(c.share * 100)}%` } }))),
        ui.h("span", { class: "st amount" }, ui.h("div", {}, fmt.money(c.monthly, cur)), ui.h("div", { class: "muted small" }, `a month \u00b7 ${c.percent}%`)),
      ))),
    ));
  }
  for (const w of d.warnings) root.append(ui.notice("warn", w));

  const formCard = ui.card(null);
  const formHost = ui.h("div");
  let showForm = d.count === 0;
  const drawForm = () => {
    formHost.innerHTML = "";
    if (!showForm && !editing) {
      formHost.append(ui.button("+ Add another expense", () => { showForm = true; drawForm(); }, { class: "secondary" }));
      return;
    }
    const values = editing ? { ...editing, inflates: editing.inflates !== false } : { category: "housing", period: "monthly", essential: true, inflates: true };
    const f = ui.form(FIELDS, values, (v) => {
      const clean = { name: v.name.trim(), category: v.category, amount: v.amount ?? 0, period: v.period, essential: !!v.essential, inflates: !!v.inflates, startDate: v.startDate || "", endDate: v.endDate || "" };
      if (!clean.name) return;
      pending = editing ? "Changes saved." : `${clean.name} added.`;
      store.update((p) => {
        p.expenses = p.expenses ?? [];
        if (editing) { const i = p.expenses.findIndex((x) => x.id === editing.id); if (i >= 0) p.expenses[i] = { ...p.expenses[i], ...clean }; }
        else p.expenses.push({ id: ui.uid(), ...clean });
      });
      editing = null;
    }, { submitLabel: editing ? "Save changes" : "Add expense", resetAfter: !editing, onCancel: (editing || d.count > 0) ? () => { editing = null; showForm = false; drawForm(); } : null });
    // picking a category suggests whether it is a must-pay
    const catSel = f.querySelector("select[name=category]"), essBox = f.querySelector("input[name=essential]");
    if (catSel && essBox && !editing) catSel.addEventListener("change", () => { essBox.checked = (CATEGORIES[catSel.value] ?? CATEGORIES.other).essential; });
    formHost.append(ui.h("div", {},
      ui.h("h2", {}, editing ? `Edit ${editing.name}` : "Add an expense"),
      f,
      editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button(`Remove ${editing.name}`, () => {
        if (!ui.confirm(`Remove ${editing.name}?`)) return;
        const id = editing.id; const name = editing.name; editing = null;
        pending = `${name} removed.`;
        store.update((p) => { p.expenses = (p.expenses ?? []).filter((x) => x.id !== id); });
      }, { class: "danger" })) : null,
    ));
  };
  drawForm();

  if (d.count > 0) {
    const sub = (x) => {
      const bits = [`${fmt.money(x.amount, cur)} ${x.periodLabel.toLowerCase()}`, x.categoryLabel, x.essential ? "must pay" : "nice to have"];
      if (x.upcoming) bits.push(`starts ${fmt.date(x.startDate)}`);
      if (x.ended) bits.push(`ended ${fmt.date(x.endDate)}`);
      else if (x.endDate) bits.push(`until ${fmt.date(x.endDate)}`);
      return bits.join(" · ");
    };
    const rows = [...d.items].sort((a, b) => Number(b.active) - Number(a.active) || b.monthly - a.monthly);
    root.append(ui.card("Expenses",
      ui.h("ul", { class: "page-list" }, rows.map((x) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer", opacity: x.active ? 1 : 0.6 },
        onClick: () => { editing = plan.expenses.find((y) => y.id === x.id); showForm = true; drawForm(); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); },
        onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
        ui.h("span", { class: "ic" }, x.icon),
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, x.name, x.active ? null : ui.h("span", { class: "pill" }, x.upcoming ? "not yet" : "ended")), ui.h("div", { class: "d" }, sub(x))),
        ui.h("span", { class: "st amount" }, !x.active ? ui.h("div", { class: "muted" }, x.upcoming ? "not yet" : "ended") : ui.h("div", {}, x.period === "once" ? fmt.money(x.amount, cur) : fmt.money(x.monthly, cur)), !x.active ? null : ui.h("div", { class: "muted small" }, x.period === "once" ? "one time" : "a month"), ui.h("div", { class: "muted small" }, "Edit \u203a")),
      ))),
      ui.h("p", { class: "muted small" }, "Tap an expense to change it."),
      out, formHost,
    ));
  } else {
    formCard.append(out, formHost);
    root.append(formCard);
  }
  root.append(ui.h("style", {}, ".st.amount { text-align: right; }"));
}

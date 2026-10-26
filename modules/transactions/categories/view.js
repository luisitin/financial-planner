// modules/transactions/categories/view.js -- DOM only. The category list grouped by kind,
// tap to rename / change icon / hide, add your own, and a count of how many transactions use each.
import { compute, KINDS, slug } from "./compute.js";

const ICONS = ["📦", "🏠", "💡", "🛒", "🚗", "🛡️", "🩺", "💳", "🧒", "📱", "🧾", "📺", "🍽️", "🎉", "🛍️", "✈️", "🎁", "💇", "🐾", "💼", "🎯", "🛠️", "🏘️", "🏛️", "📈", "💵", "🔁", "🎓", "🏋️", "🍺", "☕", "🚌", "🏥", "🧴", "🎮", "📚", "🌳", "🏦"];
const FIELDS = (editing) => [
  { key: "label", label: "Name", type: "text", required: true, placeholder: "e.g. Coffee" },
  { key: "icon", label: "Icon", type: "select", options: ICONS },
  { key: "kind", label: "Kind", type: "select", options: Object.entries(KINDS).map(([value, label]) => ({ value, label })) },
  { key: "essential", label: "Counts as a must-pay bill", type: "checkbox", help: "for the emergency-fund target; spending only" },
];

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan);
  let editing = null;

  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Categories"),
    ui.h("p", { class: "lede" }, "Every transaction gets one category. The list starts with the same categories as the Expenses and Income pages; rename or hide the ones you do not use and add your own."),
    d.total ? ui.h("p", { class: "muted small" }, `${d.total} transactions on file, ${d.uncategorised} still uncategorised.`) : null,
  ));

  const formCard = ui.card(null);
  const formHost = ui.h("div");
  // The add form folds behind a button; tapping a category opens it filled in (design log 2026-09-15).
  let showForm = false;
  const drawForm = () => {
    formHost.innerHTML = "";
    if (!showForm && !editing) { formHost.append(ui.button("+ Add a category", () => { showForm = true; drawForm(); }, { class: "secondary" })); return; }
    const values = editing ? { ...editing } : { icon: "📦", kind: "expense", essential: false };
    formHost.append(ui.h("div", {},
      ui.h("h2", {}, editing ? `Edit ${editing.label}` : "Add a category"),
      ui.form(FIELDS(editing), values, (v) => {
        const label = v.label.trim(); if (!label) return;
        store.update((p) => {
          p.categories = p.categories ?? [];
          if (editing) {
            const i = p.categories.findIndex((c) => c.id === editing.id);
            const patch = { id: editing.id, label, icon: v.icon, kind: v.kind, essential: !!v.essential };
            if (i >= 0) p.categories[i] = { ...p.categories[i], ...patch }; else p.categories.push(patch);
          } else {
            let id = slug(label); const taken = new Set(compute(p).categories.map((c) => c.id)); let n = 2; while (taken.has(id)) id = `${slug(label)}-${n++}`;
            p.categories.push({ id, label, icon: v.icon, kind: v.kind, essential: !!v.essential });
          }
        });
        editing = null;
      }, { submitLabel: editing ? "Save changes" : "Add category", resetAfter: !editing, onCancel: () => { editing = null; showForm = false; drawForm(); } }),
      editing ? ui.h("p", { style: { marginTop: "12px" } },
        editing.hidden
          ? ui.button("Show it again", () => { const id = editing.id; editing = null; store.update((p) => { const c = (p.categories ?? []).find((x) => x.id === id); if (c) delete c.hidden; }); }, { class: "secondary" })
          : ui.button(editing.builtIn ? `Hide ${editing.label}` : `Remove ${editing.label}`, () => {
            if (editing.count && !ui.confirm(`${editing.count} transactions use ${editing.label}. They will become uncategorised. Continue?`)) return;
            const id = editing.id, builtIn = editing.builtIn; editing = null;
            store.update((p) => {
              p.categories = p.categories ?? [];
              for (const t of p.transactions ?? []) if (t.category === id) t.category = "";
              if (builtIn) { const c = p.categories.find((x) => x.id === id); if (c) c.hidden = true; else p.categories.push({ id, hidden: true }); }
              else p.categories = p.categories.filter((x) => x.id !== id);
            });
          }, { class: "danger" })) : null,
    ));
  };
  drawForm();

  for (const [kind, title] of Object.entries(KINDS)) {
    const rows = d.categories.filter((c) => c.kind === kind && !c.hidden);
    if (!rows.length) continue;
    root.append(ui.card(title,
      ui.h("ul", { class: "page-list" }, rows.map((c) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer" },
        onClick: () => { editing = c; showForm = true; drawForm(); formCard.scrollIntoView({ behavior: "smooth", block: "start" }); },
        onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
        ui.h("span", { class: "ic" }, c.icon),
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, c.label, c.builtIn ? null : ui.h("span", { class: "pill" }, "yours"), c.essential && kind === "expense" ? ui.h("span", { class: "pill" }, "must pay") : null),
          c.count ? ui.h("div", { class: "d" }, `${c.count} transaction${c.count === 1 ? "" : "s"}, ${fmt.money(Math.abs(c.total), cur)}`) : null),
        ui.h("span", { class: "st muted" }, "Edit ›"),
      ))),
    ));
  }
  const hidden = d.categories.filter((c) => c.hidden);
  if (hidden.length) root.append(ui.card("Hidden",
    ui.h("ul", { class: "page-list" }, hidden.map((c) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer", opacity: 0.6 },
      onClick: () => { editing = c; showForm = true; drawForm(); formCard.scrollIntoView({ behavior: "smooth", block: "start" }); } },
      ui.h("span", { class: "ic" }, c.icon), ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, c.label)), ui.h("span", { class: "st muted" }, "Show ›")))),
  ));

  formCard.append(formHost);
  root.append(formCard);
}

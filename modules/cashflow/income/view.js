// modules/cashflow/income/view.js -- DOM only. Totals up top, a tappable list of income
// sources, one form to add or edit.
import { compute, INCOME_TYPES } from "./compute.js";
import { PERIOD_OPTIONS } from "../../../core/math/periods.js";

// The shell re-renders after store.update, so a confirmation waits here for the next render.
let pending = null;

const FIELDS = (people) => [
  { key: "name", label: "What is it", type: "text", required: true, placeholder: "e.g. Ana's salary" },
  { key: "type", label: "Kind of income", type: "select", options: Object.entries(INCOME_TYPES).map(([value, t]) => ({ value, label: t.label })) },
  { key: "personId", label: "Whose", type: "select", options: [{ value: "", label: "Household / joint" }, ...people.map((p) => ({ value: p.id, label: p.name }))] },
  { key: "amount", label: "Amount", type: "money", required: true, min: 0, help: "what arrives each time, before taxes if you know it" },
  { key: "period", label: "How often", type: "select", options: PERIOD_OPTIONS },
  { key: "growth", label: "Yearly raise", type: "percent", min: 0, max: 100, help: "type 3 for 3% a year; blank for none" },
  { key: "startDate", label: "Starts", type: "date", help: "blank if it already has" },
  { key: "endDate", label: "Ends", type: "date", help: "blank if it does not end" },
  { key: "taxable", label: "Income tax applies to it", type: "checkbox" },
];

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const today = fmt.today();
  const d = compute(plan, { today });
  const people = plan.household?.people ?? [];
  let editing = null;

  if (d.count === 0) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "What comes in?"),
      ui.h("p", { class: "lede" }, "Add each source of money: your pay, a partner's pay, side work, rent you collect, a pension. The plan puts them all on a monthly footing whatever the pay schedule."),
      ui.h("p", { class: "muted small" }, people.length ? "Tip: use the amount on the pay stub before taxes; the tax pages will work out the rest." : "Tip: add the people first (Household > People) so each income can be tied to who earns it. It works without that too."),
    ));
  } else {
    root.append(ui.card(null, ui.row(
      ui.stat("Per month", fmt.money(d.monthly, cur), `${fmt.money(d.yearly, cur)} a year`),
      ui.stat("Next year", fmt.money(d.nextYear, cur), d.nextYear > d.yearly ? "after the raises you entered" : "no raises entered"),
      d.untaxedYearly ? ui.stat("Not taxed", fmt.money(d.untaxedYearly, cur), "a year") : null,
      d.oneTime ? ui.stat("One-time amounts", fmt.money(d.oneTime, cur), "not in the monthly total") : null,
    )));
    if (d.byPerson.length > 1) root.append(ui.card("Who brings in what",
      ui.h("ul", { class: "page-list" }, d.byPerson.map((p) => ui.h("li", {},
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, p.name), ui.h("div", { class: "d" }, `${Math.round(d.yearly ? (p.yearly / d.yearly) * 100 : 0)}% of the total`)),
        ui.h("span", { class: "st amount" }, ui.h("div", {}, fmt.money(p.monthly, cur)), ui.h("div", { class: "muted small" }, "a month"))))),
    ));
  }
  for (const w of d.warnings) root.append(ui.notice("warn", w));

  const formCard = ui.card(null);
  const formHost = ui.h("div");
  let showForm = d.count === 0;
  const drawForm = () => {
    formHost.innerHTML = "";
    if (!showForm && !editing) {
      formHost.append(ui.button("+ Add another income", () => { showForm = true; drawForm(); }, { class: "secondary" }));
      return;
    }
    const values = editing ? { ...editing, taxable: editing.taxable !== false } : { type: "salary", period: "monthly", taxable: true, personId: people.find((p) => p.role === "self")?.id ?? "" };
    formHost.append(ui.h("div", {},
      ui.h("h2", {}, editing ? `Edit ${editing.name}` : "Add an income"),
      ui.form(FIELDS(people), values, (v) => {
        const clean = { name: v.name.trim(), type: v.type, personId: v.personId || "", amount: v.amount ?? 0, period: v.period, growth: v.growth ?? 0, startDate: v.startDate || "", endDate: v.endDate || "", taxable: !!v.taxable };
        if (!clean.name) return;
        pending = editing ? "Changes saved." : `${clean.name} added.`;
        store.update((p) => {
          p.income = p.income ?? [];
          if (editing) { const i = p.income.findIndex((x) => x.id === editing.id); if (i >= 0) p.income[i] = { ...p.income[i], ...clean }; }
          else p.income.push({ id: ui.uid(), ...clean });
        });
        editing = null;
      }, { submitLabel: editing ? "Save changes" : "Add income", resetAfter: !editing, onCancel: (editing || d.count > 0) ? () => { editing = null; showForm = false; drawForm(); } : null }),
      editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button(`Remove ${editing.name}`, () => {
        if (!ui.confirm(`Remove ${editing.name}?`)) return;
        const id = editing.id; const name = editing.name; editing = null;
        pending = `${name} removed.`;
        store.update((p) => { p.income = (p.income ?? []).filter((x) => x.id !== id); });
      }, { class: "danger" })) : null,
    ));
  };
  drawForm();

  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  if (d.count > 0) {
    const sub = (x) => {
      const bits = [`${fmt.money(x.amount, cur)} ${x.periodLabel.toLowerCase()}`, x.personName];
      if (Number(x.growth) > 0) bits.push(`+${fmt.pct(x.growth, 1)} a year`);
      if (x.upcoming) bits.push(`starts ${fmt.date(x.startDate)}`);
      if (x.ended) bits.push(`ended ${fmt.date(x.endDate)}`);
      else if (x.endDate) bits.push(`until ${fmt.date(x.endDate)}`);
      if (x.taxable === false) bits.push("not taxed");
      return bits.join(" · ");
    };
    const rows = [...d.items].sort((a, b) => Number(b.active) - Number(a.active) || b.monthly - a.monthly);
    root.append(ui.card("Income sources",
      ui.h("ul", { class: "page-list" }, rows.map((x) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer", opacity: x.active ? 1 : 0.6 },
        onClick: () => { editing = plan.income.find((y) => y.id === x.id); showForm = true; drawForm(); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); },
        onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
        ui.h("span", { class: "ic" }, x.icon),
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, x.name, x.active ? null : ui.h("span", { class: "pill" }, x.upcoming ? "not yet" : "ended")), ui.h("div", { class: "d" }, sub(x))),
        ui.h("span", { class: "st amount" }, !x.active ? ui.h("div", { class: "muted" }, x.upcoming ? "not yet" : "ended") : ui.h("div", {}, x.period === "once" ? fmt.money(x.amount, cur) : fmt.money(x.monthly, cur)), !x.active ? null : ui.h("div", { class: "muted small" }, x.period === "once" ? "one time" : "a month"), ui.h("div", { class: "muted small" }, "Edit \u203a")),
      ))),
      ui.h("p", { class: "muted small" }, "Tap an income to change it."),
      out, formHost,
    ));
  } else {
    formCard.append(out, formHost);
    root.append(formCard);
  }
  root.append(ui.h("style", {}, ".st.amount { text-align: right; }"));
}

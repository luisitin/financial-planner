// modules/cashflow/sinking-funds/view.js -- DOM only. The monthly set-aside total, then each
// irregular cost with its next date.
import { compute } from "./compute.js";

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const periodWord = { quarterly: "every three months", annual: "once a year", once: "one time" };

  if (!d.hasData) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Irregular expenses"),
      ui.h("p", { class: "lede" }, "The costs that do not come every month: yearly insurance, quarterly taxes, gifts, the summer trip, a repair with a date. Each becomes a monthly amount to set aside so the money is there when the bill lands."),
      ui.h("p", { class: "muted small" }, "Add them on the Expenses page with \"every three months\", \"once a year\" or \"one time only\" and a date. Yearly payments found in your transactions show up here on their own."),
      ui.row(ui.h("a", { class: "btn", href: "#/cashflow/expenses" }, "Add an irregular expense"))));
    return;
  }
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, `Set aside ${fmt.money(d.monthly, cur)} a month`),
    ui.h("p", { class: "lede" }, `That covers ${d.funds.length} irregular cost${d.funds.length === 1 ? "" : "s"} (${fmt.money(d.yearly, cur)} a year plus the one-time ones) without a scramble when they land. A savings account of its own for this works best.`),
  ));
  const dueRow = (f) => ui.h("li", {},
    ui.h("span", { class: "ic" }, f.icon),
    ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, f.name), ui.h("div", { class: "d" }, `${fmt.date(f.next)} · ${f.monthsToNext === 0 ? "this month" : `in ${f.monthsToNext} month${f.monthsToNext === 1 ? "" : "s"}`}`)),
    ui.h("span", { class: "st" }, fmt.money(f.amount, cur)));
  if (d.dueNext.length) root.append(ui.card("Coming up in the next three months", ui.h("ul", { class: "page-list" }, d.dueNext.map(dueRow))));
  root.append(ui.card("Every irregular cost",
    ui.h("ul", { class: "page-list" }, d.funds.map((f) => ui.h("li", {},
      ui.h("span", { class: "ic" }, f.icon),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, f.name, f.source === "found" ? ui.h("span", { class: "pill" }, "found in transactions") : null), ui.h("div", { class: "d" }, `${fmt.money(f.amount, cur)} ${periodWord[f.period] ?? f.period}${f.next ? ` · next ${fmt.date(f.next)}` : " · date unknown"}`)),
      ui.h("span", { class: "st amount" }, ui.h("div", {}, fmt.money(f.monthly, cur)), ui.h("div", { class: "muted small" }, "a month"))))),
    ui.h("p", { class: "muted small" }, "Right column: what to put aside each month. One-time costs are spread over the months until their date."),
    ui.h("style", {}, ".st.amount { text-align: right; }"),
  ));
}

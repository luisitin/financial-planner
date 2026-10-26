// modules/cashflow/spending/view.js -- DOM only. Pick a month; see the total against last
// month, the categories with bars and change, the payees that took the most, the biggest single lines.
import { compute } from "./compute.js";

const state = { month: "" };

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { month: state.month, today: fmt.today() });

  if (!d.hasData) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Where the money goes"),
      ui.h("p", { class: "lede" }, "Spending by category, by payee and against last month, from your real transactions. Import a bank file and this page fills in."),
      ui.row(ui.h("a", { class: "btn", href: "#/transactions/import" }, "Import a bank file"))));
    return;
  }
  const monthSel = ui.select(d.months.map((m) => ({ value: m.ym, label: m.label })), d.month, { "aria-label": "Month", onChange: (e) => { state.month = e.target.value; root.innerHTML = ""; render(root, ctx); } });
  root.append(ui.card(null, ui.h("div", { class: "form" }, ui.field("Month", monthSel))));
  root.append(ui.card(null, ui.row(
    ui.stat(`Spent in ${d.label}`, fmt.money(d.total, cur), `${d.count} transaction${d.count === 1 ? "" : "s"}`),
    d.previous ? ui.stat(d.change !== null && d.change > 0 ? "More than last month" : "Less than last month", d.change === null ? "-" : fmt.pct(Math.abs(d.change), 0), `${d.previous.label}: ${fmt.money(d.previous.total, cur)}`) : null,
    ui.stat("A day on average", fmt.money(d.total / new Date(Number(d.month.slice(0, 4)), Number(d.month.slice(5, 7)), 0).getDate(), cur), "over the whole month"),
  )));
  root.append(ui.card("By category",
    ui.h("ul", { class: "page-list" }, d.byCategory.map((c) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer" }, onClick: () => ctx.go("transactions", "ledger", ["month", d.month]) },
      ui.h("span", { class: "ic" }, c.icon),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, c.label, c.category ? null : ui.h("span", { class: "pill warn" }, "unfiled")),
        ui.h("div", { class: "progress", style: { margin: "6px 0 2px" } }, ui.h("span", { style: { width: `${Math.round(c.share * 100)}%` } })),
        ui.h("div", { class: "d" }, `${fmt.pct(c.share, 0)} · ${c.count} transaction${c.count === 1 ? "" : "s"}${c.change !== null ? ` · ${c.change >= 0 ? "up" : "down"} ${fmt.pct(Math.abs(c.change), 0)} from ${d.previous?.label ?? "last month"}` : c.previous === 0 && d.previous ? " · new this month" : ""}`)),
      ui.h("span", { class: "st" }, fmt.money(c.total, cur))))),
  ));
  root.append(ui.row(
    ui.h("section", { class: "card", style: { flex: "1 1 300px" } }, ui.h("h2", {}, "Who got the most"),
      ui.h("ul", { class: "page-list" }, d.topPayees.map((p) => ui.h("li", {}, ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, p.payee), ui.h("div", { class: "d" }, `${p.count} transaction${p.count === 1 ? "" : "s"}`)), ui.h("span", { class: "st" }, fmt.money(p.total, cur)))))),
    ui.h("section", { class: "card", style: { flex: "1 1 300px" } }, ui.h("h2", {}, "Biggest single lines"),
      ui.h("ul", { class: "page-list" }, d.biggest.map((t) => ui.h("li", {}, ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, t.payee), ui.h("div", { class: "d" }, `${fmt.date(t.date)} · ${t.categoryLabel}`)), ui.h("span", { class: "st" }, fmt.money(Math.abs(Number(t.amount)), cur, undefined, 2)))))),
  ));
}

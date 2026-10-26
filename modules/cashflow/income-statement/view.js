// modules/cashflow/income-statement/view.js -- DOM only. Totals, the plan-vs-real comparison,
// a month-by-month list with bars, and the categories behind the numbers.
import { compute } from "./compute.js";

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { months: 12, today: fmt.today() });

  if (!d.hasData) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Income statement"),
      ui.h("p", { class: "lede" }, "What came in, what went out and what you kept, month by month, from your real transactions. It fills in as soon as a bank file is imported."),
      ui.row(ui.h("a", { class: "btn", href: "#/transactions/import" }, "Import a bank file")),
      d.planned ? ui.h("p", { class: "muted small" }, `From what you entered on the Income and Expenses pages: ${fmt.money(d.planned.in, cur)} in, ${fmt.money(d.planned.out, cur)} out, ${fmt.money(d.planned.net, cur)} kept each month.`) : null,
    ));
    return;
  }
  const latest = d.rows[0];
  root.append(ui.card(null, ui.row(
    ui.stat("Came in", fmt.money(d.totals.in, cur), `over ${d.rows.length} month${d.rows.length === 1 ? "" : "s"}`),
    ui.stat("Went out", fmt.money(d.totals.out, cur), "transfers not counted"),
    ui.stat(d.totals.net >= 0 ? "Kept" : "Short", fmt.money(Math.abs(d.totals.net), cur), d.totals.rate !== null ? `${fmt.pct(d.totals.rate, 0)} of what came in` : null),
    d.average ? ui.stat("A typical month", fmt.money(d.average.net, cur), `kept, from ${d.average.months} full month${d.average.months === 1 ? "" : "s"}: ${fmt.money(d.average.in, cur)} in, ${fmt.money(d.average.out, cur)} out`) : null,
  )));
  if (d.planned && d.average) {
    const diffIn = d.average.in - d.planned.in, diffOut = d.average.out - d.planned.out;
    root.append(ui.card("Plan versus real",
      ui.h("ul", { class: "page-list" },
        ui.h("li", {}, ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, "Money in"), ui.h("div", { class: "d" }, `Income page says ${fmt.money(d.planned.in, cur)} a month; the bank shows ${fmt.money(d.average.in, cur)}`)), ui.h("span", { class: `st ${diffIn < -50 ? "bad" : ""}` }, `${diffIn >= 0 ? "+" : "-"}${fmt.money(Math.abs(diffIn), cur)}`)),
        ui.h("li", {}, ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, "Money out"), ui.h("div", { class: "d" }, `Expenses page says ${fmt.money(d.planned.out, cur)} a month; the bank shows ${fmt.money(d.average.out, cur)}`)), ui.h("span", { class: `st ${diffOut > 50 ? "bad" : ""}` }, `${diffOut >= 0 ? "+" : "-"}${fmt.money(Math.abs(diffOut), cur)}`)),
      ),
      ui.h("p", { class: "muted small" }, "A big gap usually means an expense that was never listed, or income the pages do not know about. Fix whichever is wrong."),
    ));
  }
  const maxBar = Math.max(1, ...d.rows.map((r) => Math.max(r.in, r.out)));
  root.append(ui.card("Month by month",
    ui.h("ul", { class: "page-list" }, d.rows.map((r) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer", alignItems: "flex-start" }, onClick: () => ctx.go("transactions", "ledger", ["month", r.ym]) },
      ui.h("span", { class: "body" },
        ui.h("div", { class: "t" }, r.label, r.complete ? null : ui.h("span", { class: "pill" }, "so far"), r.uncategorised ? ui.h("span", { class: "pill warn" }, `${r.uncategorised} unfiled`) : null),
        ui.h("div", { class: "d" }, `in ${fmt.money(r.in, cur)} · out ${fmt.money(r.out, cur)} · ${r.count} transactions`),
        ui.h("div", { class: "progress", style: { margin: "6px 0 2px", background: "var(--ok-soft)" } }, ui.h("span", { style: { width: `${Math.round((r.in / maxBar) * 100)}%`, background: "var(--ok)" } })),
        ui.h("div", { class: "progress", style: { margin: "0", background: "var(--bad-soft)" } }, ui.h("span", { style: { width: `${Math.round((r.out / maxBar) * 100)}%`, background: "var(--bad)" } }))),
      ui.h("span", { class: "st", style: { fontWeight: "600", color: r.net >= 0 ? "var(--ok)" : "var(--bad)" } }, `${r.net >= 0 ? "+" : "-"}${fmt.money(Math.abs(r.net), cur)}`)))),
    ui.h("p", { class: "muted small" }, "Green bar: money in. Red bar: money out. Tap a month to see its transactions."),
  ));
  const catList = (list, side) => ui.h("ul", { class: "page-list" }, list.slice(0, 12).map((c) => ui.h("li", {},
    ui.h("span", { class: "ic" }, c.icon), ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, c.label), ui.h("div", { class: "d" }, `${c.count} transaction${c.count === 1 ? "" : "s"}`)),
    ui.h("span", { class: "st" }, fmt.money(c.total, cur)))));
  root.append(ui.row(
    ui.h("section", { class: "card", style: { flex: "1 1 300px" } }, ui.h("h2", {}, "Where it came from"), catList(d.byCategory.in, "in")),
    ui.h("section", { class: "card", style: { flex: "1 1 300px" } }, ui.h("h2", {}, "Where it went"), catList(d.byCategory.out, "out")),
  ));
}

// modules/cashflow/income-statement/view.js -- DOM only. Totals, the plan-vs-real comparison,
// a month-by-month list with bars, and the categories behind the numbers.
import { compute } from "./compute.js";

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { months: 12, today: fmt.today() });
  // what the plan keeps each month is the figure the Dashboard shows (after tax, spending and saving), never pay before tax minus spending
  const nba = d.planned ? ctx.computeOf?.("overview/next-best-action", { today: fmt.today() }) : null;
  // one sentence that adds up: in - tax - spending - saving = left (all Next best action's own figures, the Dashboard's). It names
  // the tax rather than an "after tax" amount, which would sit next to the Income page's take-home (that one also takes out the
  // 401(k) and health cover) and read as a second figure for the same thing.
  const plannedLine = () => {
    if (!nba?.ready) return `From the Income and Expenses pages: ${fmt.money(d.planned.in, cur)} a month comes in before tax and ${fmt.money(d.planned.out, cur)} goes out.`;
    const s = nba.spare, tax = s.federalTax + s.payrollTax, saving = s.retirementSaving + s.goalSaving;
    const parts = [tax >= 1 ? [tax, "tax"] : null, [s.spending, "spending"], saving >= 1 ? [saving, "saving"] : null].filter(Boolean).map(([v, w], i) => `${fmt.money(v, cur)}${i ? "" : " goes"} to ${w}`);
    const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : parts[0];
    return `From the Income and Expenses pages: ${fmt.money(s.gross, cur)} a month comes in before tax; about ${list}, so about ${fmt.money(Math.abs(s.monthly), cur)} a month is ${s.monthly >= 0 ? "left" : "short"}.`;
  };

  if (!d.hasData) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Income statement"),
      ui.h("p", { class: "lede" }, "What came in, what went out and what you kept, month by month, from your real transactions. It fills in as soon as a bank file is imported."),
      ui.row(ui.h("a", { class: "btn", href: "#/transactions/import" }, "Import a bank file")),
      d.planned ? ui.h("p", { class: "muted small" }, plannedLine()) : null,
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
    const diffIn = d.inGap ?? (d.average.in - d.planned.takeHomeIn), diffOut = d.average.out - d.planned.out;
    const inSays = d.planned.takeHome ? `Income page says ${fmt.money(d.planned.in, cur)} a month before tax, about ${fmt.money(d.planned.takeHomeIn, cur)} after tax; the bank shows ${fmt.money(d.average.in, cur)}` : `Income page says ${fmt.money(d.planned.in, cur)} a month; the bank shows ${fmt.money(d.average.in, cur)}`;
    root.append(ui.card("Plan versus real",
      ui.h("ul", { class: "page-list" },
        ui.h("li", {}, ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, "Money in"), ui.h("div", { class: "d" }, inSays)), ui.h("span", { class: `st ${d.inShort ? "bad" : ""}` }, `${diffIn >= 0 ? "+" : "-"}${fmt.money(Math.abs(diffIn), cur)}`)),
        ui.h("li", {}, ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, "Money out"), ui.h("div", { class: "d" }, `Expenses page says ${fmt.money(d.planned.out, cur)} a month; the bank shows ${fmt.money(d.average.out, cur)}`)), ui.h("span", { class: `st ${diffOut > 50 ? "bad" : ""}` }, `${diffOut >= 0 ? "+" : "-"}${fmt.money(Math.abs(diffOut), cur)}`)),
      ),
      ui.h("p", { class: "muted small" }, d.planned.takeHome
        ? "Pay is typed before tax and the bank sees it after tax, so money in is compared after tax (from the Paycheck page). A month with a third paycheck shows more. A big gap in money out usually means an expense that was never listed."
        : "A big gap usually means an expense that was never listed, or income the pages do not know about."),
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

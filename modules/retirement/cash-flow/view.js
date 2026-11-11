// modules/retirement/cash-flow/view.js -- DOM only. The year-by-year ledger: a toggle between
// today's dollars and the dollars of each year, one record per year on a phone, a table on desktop.
import { needButtons } from "../needs.js";
import { needItem } from "../../../core/words.js";
import { compute } from "./compute.js";

const state = { real: true, from: "retirement" };

// the plan's own withdrawal order, not a fixed one (stress test 2026-11-11: the key named one order whatever Withdrawal order chose)
// the same names as Which account to draw from first: taxable, pre-tax, Roth (review of the cash-flow key)
const PART = { taxable: "taxable savings", deferred: "pre-tax accounts (taxed as it comes out)", free: "Roth (tax-free)" };
export function orderSaid(order) {
  const parts = (order ?? []).map((k) => PART[k]).filter(Boolean);
  return parts.length ? `Money comes out of cash first, then ${parts.join(", then ")}.` : "Money comes out of cash first, then in the order set on Withdrawal order.";
}

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today(), real: state.real });
  const money = (n) => fmt.money(n, cur);
  const redraw = () => { root.innerHTML = ""; render(root, ctx); };

  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Year by year"), ui.h("p", { class: "lede" }, "Every year of the plan in one table: ages, what comes in, what goes out, what is taken from which account and what is left. It needs the same answers as the Will the money last? page:"), ui.h("ul", {}, d.missing.map((m) => ui.h("li", {}, needItem(m)))), (needButtons(ui, d.missing) ?? ui.row(ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Open Will the money last?")))));
    return;
  }
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Year by year"),
    ui.h("p", { class: "lede" }, `${d.rows.length} years, from ${d.rows[0].year} to ${d.rows[d.rows.length - 1].year}. ${d.verdict === "short" ? `The money runs out in ${d.shortYear}.` : "The money lasts to the end."} Over the whole plan: ${money(d.totals.income)} of guaranteed income, ${money(d.totals.withdrawn)} taken from savings, ${money(d.totals.taxes)} of tax on withdrawals.`),
  ));
  const realSel = ui.select([{ value: "real", label: "today's dollars" }, { value: "nominal", label: "each year's dollars" }], state.real ? "real" : "nominal", { "aria-label": "Dollars", onChange: (e) => { state.real = e.target.value === "real"; redraw(); } });
  const fromSel = ui.select([{ value: "retirement", label: "from retirement on" }, { value: "all", label: "every year" }], state.from, { "aria-label": "Years", onChange: (e) => { state.from = e.target.value; redraw(); } });
  root.append(ui.card(null, ui.h("div", { class: "form" }, ui.field("Show amounts in", realSel), ui.field("Years", fromSel))));
  const rowsAll = state.from === "all" ? d.rows : d.rows.filter((r) => r.retired);
  const taken = (r) => r.from.cash + r.from.taxable + r.from.deferred + r.from.free;
  // Once the money is gone every later year reads the same: collapse them into one row
  // (design log 2026-09-16, pass 4).
  let firstEmpty = rowsAll.findIndex((r, i) => r.end.total <= 0 && r.shortfall && i > 0 && rowsAll[i - 1].end.total <= 0);
  if (firstEmpty > 0 && !rowsAll.slice(firstEmpty).every((r) => r.end.total <= 0 && r.shortfall)) firstEmpty = -1;
  const rows = firstEmpty > 0 ? rowsAll.slice(0, firstEmpty) : rowsAll;
  const tail = firstEmpty > 0 ? rowsAll.slice(firstEmpty) : [];
  const tailRow = tail.length ? { first: tail[0].year, last: tail[tail.length - 1].year, short: Math.max(...tail.map((r) => r.shortfall)) } : null;
  root.append(ui.card(null,
    ui.h("div", { class: "only-wide" }, ui.table([
      { key: "year", label: "Year" }, { key: "age", label: d.people.length > 1 ? "Ages" : "Age", render: (r) => r.ages.join(" / ") },
      { key: "in", label: "In", align: "right", render: (r) => money(r.in.income + r.in.contributions) },
      { key: "spending", label: "Spending", align: "right", render: (r) => money(r.out.spending) },
      { key: "taken", label: "From savings", align: "right", render: (r) => money(taken(r)) },
      { key: "taxes", label: "Tax", align: "right", render: (r) => money(r.out.taxes) },
      { key: "end", label: "Left", align: "right", render: (r) => ui.h("span", { class: r.shortfall ? "bad" : "" }, money(r.end.total)) },
    ], rows), tailRow ? ui.h("p", { class: "bad small", style: { margin: "10px 0 0" } }, `${tailRow.first} to ${tailRow.last}: nothing left; about ${money(tailRow.short)} short every year.`) : null),
    ui.h("p", { class: "muted small", style: { margin: "0 0 8px" } }, `Left: every retirement account together at the end of that year. ${orderSaid(d.order)}`),
    ui.h("ul", { class: "records only-narrow" }, rows.map((r) => ui.h("li", {},
      // the bold figure says what it is (stress test 2026-11-11, RB4: "$450,880" with its meaning 3,000 px below)
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${r.year} · ${d.people.length > 1 ? "ages " + r.ages.join(" and ") : "age " + r.age}`), ui.h("span", { class: `rec-value ${r.shortfall ? "bad" : ""}` }, `${money(r.end.total)} left`)),
      ui.h("div", { class: "rec-sub" }, r.retired ? `${money(r.out.spending)} spent${r.out.health > 0.5 ? ` (${money(r.out.health)} health insurance)` : ""} · ${money(r.in.income)} guaranteed income${r.in.lines.length ? ` (${r.in.lines.map((l) => l.name).join(", ")})` : ""} · ${money(taken(r))} from savings${r.rmd ? ` (${money(r.rmd)} required)` : ""} · ${money(r.out.taxes)} tax` : `${money(r.in.contributions)} added · growing`),
      r.shortfall ? ui.h("div", { class: "rec-sub bad" }, `${money(r.shortfall)} short this year`) : null)),
      tailRow ? ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title bad" }, `${tailRow.first} to ${tailRow.last}`), ui.h("span", { class: "rec-value bad" }, `${money(0)} left`)), ui.h("div", { class: "rec-sub bad" }, `nothing left; about ${money(tailRow.short)} short every year`)) : null),
  ));
}

// modules/cashflow/spending/view.js -- DOM only. Pick a month; see the total against last
// month, the categories with bars and change, the payees that took the most, the biggest single lines.
import { compute } from "./compute.js";

const state = { month: "", query: null };   // query: the ?month= the page was last opened with (the Monthly review's link)
const ord = (n) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  // opened from the Monthly review with ?month=2026-10: that month, until a month is picked here
  const qm = /^\d{4}-\d{2}$/.test(ctx.route?.query?.month ?? "") ? ctx.route.query.month : null;
  if (qm && qm !== state.query) { state.month = qm; }
  state.query = qm;
  const d = compute(plan, { month: state.month, today: fmt.today() });

  if (!d.hasData) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Where the money goes"),
      ui.h("p", { class: "lede" }, "Spending by category, by payee and against last month, from your real transactions. Import a bank file and this page fills in."),
      ui.row(ui.h("a", { class: "btn", href: "#/transactions/import" }, "Import a bank file"))));
    return;
  }
  // a month the bank file only partly covers (downloaded mid-month) says so, and is compared with the same days of the month before
  const mon = (label) => label.slice(0, 3);
  const span = (label, a, b) => (a === b ? `${mon(label)} ${a}` : `${mon(label)} ${a} to ${b}`);
  const monthSel = ui.select(d.months.map((m) => ({ value: m.ym, label: m.full || !m.firstDay ? m.label : `${m.label} (${m.firstDay === 1 ? `to the ${ord(m.lastDay)}` : `from the ${ord(m.firstDay)}`})` })), d.month, { "aria-label": "Month", onChange: (e) => { state.month = e.target.value; root.innerHTML = ""; render(root, ctx); } });
  const today = fmt.today();
  const prevLabel = d.previous?.label ?? "";
  const coverNote = !d.cover ? null
    : !d.cover.full && d.cover.to === today ? `So far this month: ${span(d.label, d.cover.firstDay, d.cover.lastDay)}.${d.sameDays && d.previous ? ` Compared with ${span(prevLabel, d.sameDays.lo, d.sameDays.hi)}.` : ""}`
    : !d.cover.full ? `Your bank file covers ${span(d.label, d.cover.firstDay, d.cover.lastDay)} only (it ${d.cover.firstDay > 1 ? `starts on ${fmt.date(d.cover.from)}` : `stops on ${fmt.date(d.cover.to)}`}).${d.sameDays && d.previous ? ` Compared with ${span(prevLabel, d.sameDays.lo, d.sameDays.hi)}, the same days.` : d.noOverlap ? " Last month's days in the file are not the same days, so there is no change to show." : ""} Import a longer file to see the whole month.`
    : d.sameDays && d.previous ? `Your bank file starts partway through ${prevLabel}, so this month is compared on the same days: ${span(d.label, d.sameDays.lo, d.sameDays.hi)} against ${span(prevLabel, d.sameDays.lo, d.sameDays.hi)}.`
    : null;
  root.append(ui.card(null, ui.h("div", { class: "form" }, ui.field("Month", monthSel)), coverNote ? ui.h("p", { class: "muted small", style: { marginTop: "10px" } }, coverNote) : null));
  root.append(ui.card(null, ui.row(
    ui.stat(`Spent in ${d.label}`, fmt.money(d.total, cur), `${d.count} transaction${d.count === 1 ? "" : "s"}${d.cover && !d.cover.full ? `, ${span(d.label, d.cover.firstDay, d.cover.lastDay)} only` : ""}`),
    d.previous ? ui.stat(d.change !== null && d.change > 0 ? "More than last month" : "Less than last month", d.change === null ? "-" : fmt.pct(Math.abs(d.change), 0), d.sameDays ? `${span(prevLabel, d.sameDays.lo, d.sameDays.hi)}: ${fmt.money(d.previous.total, cur)}` : `${d.previous.label}: ${fmt.money(d.previous.total, cur)}`) : null,
    ui.stat("A day on average", fmt.money(d.perDay, cur), d.cover && !d.cover.full ? `over the ${d.cover.days} day${d.cover.days === 1 ? "" : "s"} in your bank file` : "over the whole month"),
  )));
  root.append(ui.card("By category",
    ui.h("ul", { class: "page-list" }, d.byCategory.map((c) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer" }, onClick: () => ctx.go("transactions", "ledger", ["month", d.month]) },
      ui.h("span", { class: "ic" }, c.icon),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, c.label, c.category ? null : ui.h("span", { class: "pill warn" }, "unfiled")),
        ui.h("div", { class: "progress", style: { margin: "6px 0 2px" } }, ui.h("span", { style: { width: `${Math.round(c.share * 100)}%` } })),
        ui.h("div", { class: "d" }, `${fmt.pct(c.share, 0)} · ${c.count} transaction${c.count === 1 ? "" : "s"}${c.change !== null ? ` · ${c.change >= 0 ? "up" : "down"} ${fmt.pct(Math.abs(c.change), 0)} ${d.sameDays ? `on the same days of ${mon(prevLabel)}` : `from ${d.previous?.label ?? "last month"}`}` : c.previous === 0 && d.previous ? (d.sameDays ? ` · none on the same days of ${mon(prevLabel)}` : " · new this month") : ""}`)),
      ui.h("span", { class: "st" }, fmt.money(c.total, cur))))),
  ));
  root.append(ui.row(
    ui.h("section", { class: "card", style: { flex: "1 1 300px" } }, ui.h("h2", {}, "Who got the most"),
      ui.h("ul", { class: "page-list" }, d.topPayees.map((p) => ui.h("li", {}, ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, p.payee), ui.h("div", { class: "d" }, `${p.count} transaction${p.count === 1 ? "" : "s"}`)), ui.h("span", { class: "st" }, fmt.money(p.total, cur)))))),
    ui.h("section", { class: "card", style: { flex: "1 1 300px" } }, ui.h("h2", {}, "Biggest single lines"),
      ui.h("ul", { class: "page-list" }, d.biggest.map((t) => ui.h("li", {}, ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, t.payee), ui.h("div", { class: "d" }, `${fmt.date(t.date)} · ${t.categoryLabel}`)), ui.h("span", { class: "st" }, fmt.money(Math.abs(Number(t.amount)), cur, undefined, 2)))))),
  ));
}

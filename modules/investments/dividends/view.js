// modules/investments/dividends/view.js -- DOM only. The yearly income first, what it covers,
// then each holding's share and the accounts it lands in.
import { compute } from "./compute.js";

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Dividends and interest"), ui.h("p", { class: "lede" }, "What your holdings pay out each year, by fund and by account, and what it covers of your spending. It needs your holdings first."), ui.row(ui.h("a", { class: "btn", href: "#/investments/holdings" }, "Add holdings"))));
    return;
  }
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, `About ${money(d.total)} a year in dividends and interest`),
    ui.h("p", { class: "lede" }, `${money(d.monthly)} a month, a ${fmt.pct(d.yieldOverall, 2)} yield on ${money(d.portfolio)}.${d.coversShare !== null ? ` That covers ${fmt.pct(d.coversShare, 0)} of your monthly spending.` : ""}${d.sheltered > 0 ? ` ${money(d.sheltered)} of it grows untaxed inside retirement accounts.` : ""}`),
    ui.h("p", { class: "muted small" }, "Yields are typical figures for each fund's class unless you typed the fund's own; distributions vary quarter to quarter. Income you reinvest still counts as income, and is still taxed in a taxable account."),
  ));
  for (const n of d.notes) root.append(ui.notice("info", n));
  root.append(ui.card(null, ui.row(
    ui.stat("A year", money(d.total), `${fmt.pct(d.yieldOverall, 2)} yield`),
    ui.stat("A month", money(d.monthly), d.coversShare !== null ? `${fmt.pct(d.coversShare, 0)} of spending` : ""),
    ui.stat("In taxable accounts", money(d.taxable), "taxed each year"),
    ui.stat("Sheltered", money(d.sheltered), "401(k), IRA, Roth, HSA"),
  )));
  root.append(ui.card("By holding",
    ui.h("ul", { class: "records" }, d.items.map((x) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, x.symbol), ui.h("span", { class: "rec-value" }, x.known ? `${money(x.income)} a year` : "yield unknown")),
      ui.h("div", { class: "rec-sub" }, `${x.name ? `${x.name} · ` : ""}${x.account} · ${money(x.value)}${x.known ? ` at ${fmt.pct(x.yield, 2)}` : ""}`)))),
  ));
  if (d.byAccount.length > 1) root.append(ui.card("By account",
    ui.h("ul", { class: "records" }, d.byAccount.map((a) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, a.name), ui.h("span", { class: "rec-value" }, `${money(a.income)} a year`))))),
  ));
}

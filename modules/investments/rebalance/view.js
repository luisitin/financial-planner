// modules/investments/rebalance/view.js -- DOM only. Whether a rebalance is due, what new money
// alone would fix, then the full list of sells and buys with the tax note on each.
import { compute } from "./compute.js";

let pending = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Rebalance"), ui.h("p", { class: "lede" }, "The trades that bring your mix back to its target, selling where it costs no tax and buying with the cash that frees. It needs your holdings and a target first."), ui.row(ui.h("a", { class: "btn", href: "#/investments/holdings" }, "Holdings"), ui.h("a", { class: "btn secondary", href: "#/investments/allocation" }, "Allocation"))));
    return;
  }
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.needed ? (d.newMoneyEnough ? "New money alone puts you back on target" : "Time to rebalance") : "No rebalance needed"),
    ui.h("p", { class: "lede" }, d.needed
      ? `${d.flaggedCount === 1 ? "One class is" : `${d.flaggedCount} classes are`} past the ${Math.round(d.band * 100)}-point band${d.worst ? `; the biggest gap is ${d.worst.label}, ${d.worst.move > 0 ? "short" : "over"} by ${money(Math.abs(d.worst.move))}` : ""}. ${d.newMoney > 0 ? d.newMoneyEnough ? `Putting the ${money(d.newMoney)} of new money into the underweight classes is enough: nothing has to be sold.` : `The ${money(d.newMoney)} of new money helps but does not close the gap; the full list below sells ${money(d.sells.reduce((s, t) => s + t.amount, 0))} and buys the same.` : `With no new money, the full rebalance sells ${money(d.sells.reduce((s, t) => s + t.amount, 0))} and buys the same${d.taxableSells > 0 ? `, ${money(d.taxableSells)} of it in taxable accounts` : ", all inside tax-advantaged accounts"}.`}`
      : `Every class is within ${Math.round(d.band * 100)} points of its target. Check again after a big market move or when new money arrives; the buys below show where new money should go.`),
    ui.h("p", { class: "muted small" }, "Sells come first from 401(k)s, IRAs and Roths, where a sale costs nothing, and in taxable accounts from the holdings with the smallest gain. Buys use the cash freed in the same account, so no money has to move between accounts."),
  ));
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);
  for (const n of d.notes) root.append(ui.notice("info", n));
  const nm = ui.form([{ key: "newMoney", label: "New money to invest", type: "money", min: 0, help: "cash you are about to put in; blank for none" }], { newMoney: d.newMoney || null }, (v) => { pending = "Saved."; store.update((p) => { p.investments.newMoney = v.newMoney ?? 0; }); }, { submitLabel: "Use this amount" });
  root.append(ui.card("With new money first",
    ui.h("p", { class: "muted small" }, "The cheapest rebalance is to buy what is underweight with money you were going to invest anyway."),
    nm,
    d.newMoneyBuys.length ? ui.h("ul", { class: "records" }, d.newMoneyBuys.map((b) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `Buy ${b.label}`), ui.h("span", { class: "rec-value" }, money(b.amount)))))) : d.newMoney > 0 ? ui.h("p", { class: "small" }, "Nothing is underweight; spread it by the target.") : null,
  ));
  if (d.needed || d.trades.length) root.append(ui.card("The full rebalance",
    d.trades.length ? ui.h("ul", { class: "records" }, [...d.sells, ...d.buys].map((t) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t.kind === "sell" ? `Sell ${t.symbol}` : `Buy ${t.label}`, " ", ui.h("span", { class: t.kind === "sell" ? "pill warn" : "pill ok" }, t.kind)), ui.h("span", { class: "rec-value" }, money(t.amount))),
      ui.h("div", { class: "rec-sub" }, `${t.account}${t.kind === "sell" ? ` · ${t.label}` : " · a fund in that class"}${t.taxNote ? ` · ${t.taxNote}` : ""}`)))) : ui.h("p", { class: "small" }, "Nothing to trade."),
    d.leftover.length ? ui.h("p", { class: "small" }, `Still to buy somewhere: ${d.leftover.map((l) => `${money(l.amount)} of ${l.label}`).join(", ")}.`) : null,
  ));
  root.append(ui.card("Rules of thumb",
    ui.h("ul", { class: "records" }, [
      ["Bands, not calendars", "Rebalancing on a schedule trades too often in calm years and too little in a crash. The 5/25 rule (five points, or a quarter of a small target) fires when it matters."],
      ["Sell where it is free", "A sale inside a 401(k), IRA or Roth has no tax. In a taxable account every sale of a winner is a tax bill, so rebalance there with new money and dividends first."],
      ["One fund can do it", "A balanced or target-date fund rebalances itself every day. If this page keeps finding work to do, that is the simpler answer."],
    ].map(([t, s]) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t)), ui.h("div", { class: "rec-sub" }, s)))),
  ));
}

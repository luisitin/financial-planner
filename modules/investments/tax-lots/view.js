// modules/investments/tax-lots/view.js -- DOM only. Losses worth harvesting first, the order to
// sell in, each holding's lots, and one folded form to add a lot.
import { compute } from "./compute.js";

let pending = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  const signed = (n) => n < 0 ? `−${money(-n)}` : `+${money(n)}`;
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Tax lots and harvesting"), ui.h("p", { class: "lede" }, "Every purchase is a lot with its own cost and date. Selling the right lot turns a taxable sale into a small gain or a useful loss. It needs your holdings first."), ui.row(ui.h("a", { class: "btn", href: "#/investments/holdings" }, "Add holdings"))));
    return;
  }
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.harvest.length ? `${money(d.harvestTotal)} of losses could be harvested` : d.taxableCount ? "No losses to harvest right now" : "Tax lots"),
    ui.h("p", { class: "lede" }, d.harvest.length
      ? `Selling the ${d.harvest.length} losing lot${d.harvest.length === 1 ? "" : "s"} in your taxable accounts books ${money(d.harvestTotal)} of losses (${money(d.shortLosses)} short-term, ${money(d.longLosses)} long-term), worth about ${money(d.taxSavedTotal)} of tax against gains and up to 3,000 a year of income; the rest carries forward. Buy something similar the same day and the mix does not change.`
      : d.taxableCount ? "Every lot in a taxable account sits above its cost. Come back after a fall: that is when harvesting pays." : "All your holdings are in retirement accounts, where lots do not matter for tax: sales there are never taxed on their own."),
    ui.h("p", { class: "muted small" }, `Short-term losses (held a year or less) offset gains taxed at your ${fmt.pct(d.marginal, 0)} rate; long-term ones offset gains at ${fmt.pct(d.gainsRate, 0)}. Lots without a date count as long-term.`),
  ));
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);
  for (const n of d.notes) root.append(ui.notice("info", n));
  if (d.harvest.length) root.append(ui.card("Worth harvesting",
    ui.h("ul", { class: "records" }, d.harvest.map((x) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${x.symbol} · ${x.lot.shares} shares`, ui.h("span", { class: x.lot.term === "short" ? "pill warn" : "pill" }, x.lot.term)), ui.h("span", { class: "rec-value" }, `−${money(x.loss)}`)),
      ui.h("div", { class: "rec-sub" }, `${x.account} · bought ${x.lot.date ? fmt.date(x.lot.date) : "date unknown"} at ${money(x.lot.costPerShare)} a share · saves about ${money(x.taxSaved)} of tax`)))),
  ));
  if (d.sellFirst.length) root.append(ui.card("If you need cash, sell these first",
    ui.h("p", { class: "muted small" }, "Highest cost first: the smallest gain (or the biggest loss) per share. Tell the brokerage which lot when you sell (\"specific identification\"), or it sells the oldest."),
    ui.h("ul", { class: "records" }, d.sellFirst.map((x) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${x.symbol} · ${x.lot.shares} shares`, ui.h("span", { class: "pill" }, x.lot.term)), ui.h("span", { class: "rec-value" }, signed(x.lot.gain))),
      ui.h("div", { class: "rec-sub" }, `${x.account} · ${x.lot.date ? `bought ${fmt.date(x.lot.date)}` : "date unknown"} at ${money(x.lot.costPerShare)} a share${x.lot.term === "short" && x.lot.daysToLong > 0 && x.lot.gain > 0 ? ` · long-term in ${x.lot.daysToLong} days` : ""}`)))),
  ));
  // lots per holding, with the add form
  const holdingsWithPrice = d.holdings;
  const FIELDS = [
    { key: "holdingId", label: "Holding", type: "select", options: holdingsWithPrice.map((x) => ({ value: x.id, label: `${x.symbol} · ${x.account}` })) },
    { key: "date", label: "Bought on", type: "date" },
    { key: "shares", label: "Shares", type: "number", required: true, min: 0, step: "any" },
    { key: "cost", label: "Total cost", type: "money", required: true, min: 0, help: "for the whole lot, fees included" },
  ];
  const formCard = ui.card(null);
  const formHost = ui.h("div");
  let showForm = false;
  const drawForm = () => {
    formHost.innerHTML = "";
    if (!showForm) { formHost.append(ui.button("+ Add a lot", () => { showForm = true; drawForm(); }, { class: "secondary" })); return; }
    formHost.append(ui.h("h2", {}, "Add a lot"), ui.form(FIELDS, { holdingId: holdingsWithPrice[0]?.id }, (v) => {
      pending = "Lot added.";
      store.update((p) => { const hh = (p.holdings ?? []).find((x) => x.id === v.holdingId); if (hh) { hh.lots = hh.lots ?? []; hh.lots.push({ id: ui.uid(), date: v.date || null, shares: v.shares ?? 0, cost: v.cost ?? 0 }); } });
    }, { submitLabel: "Add lot", resetAfter: true, onCancel: () => { showForm = false; drawForm(); } }));
  };
  drawForm();
  for (const x of d.holdings) root.append(ui.card(`${x.symbol} · ${x.account}`,
    ui.h("p", { class: "muted small" }, `${x.name ? `${x.name} · ` : ""}${x.priced ? `${money(x.price)} a share` : "no price on file"}${x.bucket !== "taxable" ? " · retirement account: lots do not affect tax" : ""}`),
    ui.h("ul", { class: "records" }, x.lots.map((l) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, l.assigned ? `${l.shares} shares, ${l.date ? fmt.date(l.date) : "no date"}` : `${fmt.num(l.shares, 3)} shares not in a lot`, ui.h("span", { class: "pill" }, l.term)), ui.h("span", { class: "rec-value", style: l.gain < 0 ? { color: "var(--bad)" } : null }, signed(l.gain))),
      ui.h("div", { class: "rec-sub" }, `cost ${money(l.cost)} (${money(l.costPerShare)} a share) · worth ${money(l.value)}`),
      l.assigned ? ui.h("div", { style: { marginTop: "6px" } }, ui.button("Remove lot", () => { pending = "Lot removed."; store.update((p) => { const hh = (p.holdings ?? []).find((y) => y.id === x.id); if (hh) hh.lots = (hh.lots ?? []).filter((z) => z.id !== l.id); }); }, { class: "secondary" })) : null))),
  ));
  formCard.append(formHost);
  root.append(formCard);
}

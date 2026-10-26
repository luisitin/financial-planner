// modules/investments/fees/view.js -- DOM only. The lifetime cost first, this year's fees and the
// average rate, the priciest holdings, and the advisory fee (folded).
import { compute } from "./compute.js";

let pending = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  const bp = (x) => `${(x * 100).toFixed(2)}%`;
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "What your investments cost"), ui.h("p", { class: "lede" }, "Fund expense ratios and advisory fees look tiny and cost a fortune: a 1% fee takes about a quarter of a lifetime's growth. This page adds yours up once the holdings are in."), ui.row(ui.h("a", { class: "btn", href: "#/investments/holdings" }, "Add holdings"))));
    root.append(advisoryFold(ctx, d));
    return;
  }
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.feesYearly > 0 ? `Fees cost you about ${money(d.lifetimeCost)} over the plan` : "Your investments cost almost nothing to hold"),
    ui.h("p", { class: "lede" }, d.feesYearly > 0
      ? `${money(d.feesYearly)} a year today: ${bp(d.allIn)} of ${money(d.total)}${d.advisoryYearly > 0 ? ` (${money(d.fundFees)} in fund fees at ${bp(d.weightedEr)} on average, ${money(d.advisoryYearly)} to an advisor at ${bp(d.advisoryFee)})` : ` (fund fees at ${bp(d.weightedEr)} on average)`}. Grown at ${fmt.pct(d.rate, 1)} for ${d.years} years${d.contributions.yearly > 0 ? ` with your contributions` : ""}, the money ends at ${money(d.withFees)} instead of ${money(d.withoutFees)}.${d.cheapSaves > 1000 ? ` In broad index funds at 0.05% it would end at ${money(d.withCheap)}: ${money(d.cheapSaves)} more.` : ""}`
      : `${bp(d.weightedEr)} on average across ${money(d.total)}: index-fund territory. Nothing to change here.`),
    ui.h("p", { class: "muted small" }, `Fees compound like returns do, in reverse. The plan's blended return and the ages on the People page set the ${d.years}-year horizon; today's dollars are not adjusted.`),
  ));
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);
  for (const n of d.notes) root.append(ui.notice("info", n));
  root.append(ui.card(null, ui.row(
    ui.stat("A year", money(d.feesYearly), `${bp(d.allIn)} of the portfolio`),
    ui.stat("Average fund fee", bp(d.weightedEr), "weighted by what you hold"),
    ui.stat("Over the plan", money(d.lifetimeCost), `${d.years} years of compounding`),
    d.cheapSaves > 0 ? ui.stat("Index funds would keep", money(d.cheapSaves), "at 0.05% a year") : null,
  )));
  root.append(ui.card("Each holding",
    ui.h("ul", { class: "records" }, d.items.map((x) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, x.symbol, x.er !== null && x.er > 0.005 ? ui.h("span", { class: "pill warn" }, "pricey") : null), ui.h("span", { class: "rec-value" }, x.er !== null ? `${money(x.feeYearly)} a year` : "unknown")),
      ui.h("div", { class: "rec-sub" }, `${x.name ? `${x.name} · ` : ""}${x.account} · ${money(x.value)}${x.er !== null ? ` at ${bp(x.er)}` : " · expense ratio not on file"}`)))),
    ui.h("p", { class: "muted small" }, "Expense ratios come from a table of common funds or what you typed on the Holdings page. Sales loads, 12b-1 fees and trading spreads are not counted."),
  ));
  root.append(advisoryFold(ctx, d));
}

function advisoryFold(ctx, d) {
  const { ui, store, plan } = ctx;
  const form = ui.form([{ key: "advisoryFee", label: "Advisory fee a year", type: "percent", min: 0, max: 5, help: "what an advisor or robo-advisor charges on the whole portfolio; 1 for 1%, blank for none" }], { advisoryFee: plan.investments?.advisoryFee || null }, (v) => { pending = "Advisory fee saved."; store.update((p) => { p.investments.advisoryFee = v.advisoryFee ?? 0; }); }, { submitLabel: "Save" });
  return ui.h("details", { class: "card fold fold-card", open: d.ready ? null : true },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Advisory fee"), ui.h("span", { class: "fold-status" }, d.advisoryFee > 0 ? `${(d.advisoryFee * 100).toFixed(2)}% a year` : "none"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" }, ui.h("p", { class: "muted small" }, "An advisor charging 1% of assets takes 1% every year, in good years and bad, on top of the funds' own fees. Enter it to see the lifetime figure; flat-fee advice is not a percentage and does not belong here."), form));
}

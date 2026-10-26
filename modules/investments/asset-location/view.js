// modules/investments/asset-location/view.js -- DOM only. The yearly tax drag and the saving
// first, the swaps that get there, then what sits where and the rules behind it.
import { compute, BUCKETS } from "./compute.js";
import { ASSET_CLASSES } from "../holdings/compute.js";

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Which investments belong in which account"), ui.h("p", { class: "lede" }, "Bonds and REITs pay income taxed like wages every year, so they belong in 401(k)s and IRAs; stock index funds pay little and belong in taxable accounts. This page measures the tax you lose to the current placement once the holdings are in."), ui.row(ui.h("a", { class: "btn", href: "#/investments/holdings" }, "Add holdings"))));
    return;
  }
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.score === "good" ? "Your investments are in the right accounts" : d.score === "fair" ? `About ${money(d.saving)} a year could be saved with a few swaps` : `Placement costs you about ${money(d.saving)} a year in tax`),
    ui.h("p", { class: "lede" }, `Holding what you hold where you hold it costs about ${money(d.dragNow)} a year in tax on dividends and interest in taxable accounts; the same mix placed as well as your accounts allow would cost ${money(d.dragIdeal)}. ${d.swaps.length ? `${d.swaps.length} swap${d.swaps.length === 1 ? "" : "s"} below, each inside one kind of account, so the overall mix does not change.` : "No swap would improve it."}`),
    ui.h("p", { class: "muted small" }, `Yearly tax drag = income x the rate it is taxed at: ${fmt.pct(d.marginal, 0)} on interest and non-qualified dividends (your marginal rate), ${fmt.pct(d.gainsRate, 0)} on qualified dividends, nothing inside retirement accounts. Growth and the tax on selling are not in this figure.`),
  ));
  for (const n of d.notes) root.append(ui.notice("info", n));
  if (d.swaps.length) root.append(ui.card("The swaps",
    ui.h("ul", { class: "records" }, d.swaps.map((s) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${s.bucketLabel}: ${s.sellLabel} → ${s.buyLabel}`), ui.h("span", { class: "rec-value" }, money(s.amount))),
      ui.h("div", { class: "rec-sub" }, `Sell ${money(s.amount)} of ${s.sellLabel.toLowerCase()} and buy ${s.buyLabel.toLowerCase()} for the same amount, inside ${s.accounts.join(" or ")}.${s.bucket === "taxable" ? " Selling in a taxable account can realise a gain: check the Capital gains page first." : " No tax on this trade."}`)))),
    ui.h("p", { class: "muted small" }, "Do the taxable side with new money and dividends where you can, so no gain is realised."),
  ));
  root.append(ui.card("What sits where",
    ui.h("ul", { class: "records" }, d.buckets.filter((b) => b.value > 0).map((b) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, b.label), ui.h("span", { class: "rec-value" }, money(b.value))),
      ui.h("div", { class: "rec-sub" }, Object.entries(b.classes).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]).map(([cls, v]) => `${ASSET_CLASSES[cls].label} ${Math.round(v / b.value * 100)}%`).join(" · ")),
      ui.h("div", { class: "rec-sub" }, `Ideal: ${Object.entries(d.ideal[b.key]).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]).map(([cls, v]) => `${ASSET_CLASSES[cls].label} ${Math.round(v / b.value * 100)}%`).join(" · ") || "-"}`)))),
  ));
  root.append(ui.card("The rules behind it",
    ui.h("ul", { class: "records" }, [
      ["Pre-tax accounts take the tax-hungry assets", "Bonds, REITs and cash pay interest and non-qualified dividends taxed at your full rate. Inside a 401(k) or IRA that income is untaxed until withdrawal, so the bonds go there first."],
      ["Taxable accounts take broad stock funds", "Index funds pay small, mostly qualified dividends taxed at the gains rate, and their growth is untaxed until you sell. International funds also earn the foreign tax credit there."],
      ["Roth takes the fastest growers", "Nothing that grows in a Roth is ever taxed, so the assets expected to grow most (stocks) do the most good there."],
      ["Same mix, different drawers", "Placement never changes how much stock or bond you own overall; it only changes which account holds which. The Allocation page keeps the mix; this page keeps the tax bill down."],
    ].map(([t, s]) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t)), ui.h("div", { class: "rec-sub" }, s)))),
  ));
}

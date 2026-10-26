// modules/retirement/withdrawal-order/view.js -- DOM only. Which order wins for this plan and
// by how much, the four orders side by side, and one tap to make an order the plan's.
import { compute } from "./compute.js";

let pending = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Which account to draw from first"), ui.h("p", { class: "lede" }, "Taxable, pre-tax or Roth first: the order changes the tax you pay over a lifetime. It needs the same things as the Projection page:"), ui.h("ul", {}, d.missing.map((m) => ui.h("li", {}, m))), ui.row(ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Set up the projection"))));
    return;
  }
  const best = d.options.find((o) => o.best), current = d.options.find((o) => o.current);
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, best.current ? `Your order is the best one for this plan` : `"${best.label}" works best for you`),
    ui.h("p", { class: "lede" }, best.success
      ? `${best.label}: ${money(best.endAfterTaxReal)} left at the end after the tax still owed on pre-tax money (today's dollars), with ${money(best.taxesReal)} of federal tax paid over the plan. ${d.gainVsWorst > 500 ? `The worst order leaves ${money(d.gainVsWorst)} less${d.taxSpread > 0 ? ` and pays ${money(d.taxSpread)} more tax` : ""}.` : "For this plan the order barely matters."}${current && !best.current ? ` Yours, "${current.label}", leaves ${money(current.endAfterTaxReal)}.` : ""}`
      : `The money runs out under every order; "${best.label}" lasts longest, to ${best.failYear}. The Projection page is the place to fix that first.`),
    ui.h("p", { class: "muted small" }, "Everyday cash always goes first. Each order is run through the federal brackets year by year, so the difference is real tax: what required withdrawals and Social Security do to it. What is left is valued after tax, because pre-tax money still owes it."),
  ));
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);
  for (const n of d.notes) root.append(ui.notice("info", n));
  root.append(ui.card("The four orders",
    ui.h("ul", { class: "records" }, d.options.map((o) => ui.h("li", { style: o.best ? { background: "var(--accent-soft)", borderRadius: "8px" } : null },
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, o.label, o.best ? ui.h("span", { class: "pill accent" }, "best") : null, o.current ? ui.h("span", { class: "pill ok" }, "your plan") : null), ui.h("span", { class: "rec-value" }, o.success ? money(o.endAfterTaxReal) : `runs out ${o.failYear}`)),
      ui.h("div", { class: "rec-sub" }, `${o.note}. ${o.success ? `Left at the end after tax; ${money(o.endBalanceReal)} before it. ` : ""}Tax over the plan ${money(o.taxesReal)}; ${money(o.rmdReal)} of required withdrawals. Today's dollars.`),
      o.current ? null : ui.h("div", { style: { marginTop: "8px" } }, ui.button(`Use this order`, () => { pending = `The plan now draws ${o.label.toLowerCase()}.`; store.update((p) => { p.retirement.withdrawalOrder = [...o.order]; }); }, { class: "secondary" }))))),
  ));
  root.append(ui.card("Why it matters",
    ui.h("ul", { class: "records" }, [
      ["Pre-tax money is a tax bill waiting", "Every dollar in a 401(k) or IRA is taxed when it comes out, and from 73 or 75 the IRS makes you take it. Drawing some of it early, in the low-income years before Social Security and required withdrawals, uses up the cheap brackets that would otherwise go unused."],
      ["Taxable money has a hidden bonus", "Only the gain is taxed when you sell, at the lower gains rates, and gains left at death are wiped out (the step-up). That argues for spending it in the middle, not first."],
      ["Roth money last", "Nothing is ever taxed and nothing is required: the best money to leave growing, and the best to leave behind."],
      ["A mix beats a pure order", "The real answer is usually to take from pre-tax up to the top of a low bracket every year and the rest from taxable: that is what the Roth conversions page does."],
    ].map(([t, s]) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t)), ui.h("div", { class: "rec-sub" }, s)))),
  ));
}

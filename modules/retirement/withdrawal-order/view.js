// modules/retirement/withdrawal-order/view.js -- DOM only. Which order wins for this plan and
// by how much, the four orders side by side, and one tap to make an order the plan's.
import { needButtons } from "../needs.js";
import { needItem } from "../../../core/words.js";
import { compute } from "./compute.js";

let pending = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Which account to draw from first"), ui.h("p", { class: "lede" }, "Taxable, pre-tax or Roth first: the order changes the tax you pay over a lifetime. It needs the same answers as the Will the money last? page:"), ui.h("ul", {}, d.missing.map((m) => ui.h("li", {}, needItem(m)))), (needButtons(ui, d.missing) ?? ui.row(ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Open Will the money last?")))));
    return;
  }
  const best = d.options.find((o) => o.best), current = d.options.find((o) => o.current);
  // an order said in a sentence: only its first letter lower-cased ("pre-tax, then taxable, then Roth", never "roth")
  const said = (o) => o.label.replace(/^./, (c) => c.toLowerCase());
  // choosing an order on a flat-rate plan changes nothing until tax is worked out at the real rates, which moves every retirement
  // figure, often more than the order does. So the rows' buttons set the order only and say so, and the first card's filled button
  // on such a plan names both changes ("... with the real tax rates") and its green line says every page's figures change (stress
  // test 2026-11-11, x-4, and two reviews of it)
  const choose = (o, withRates = false) => {
    pending = d.bracketsOn ? `The plan now draws ${said(o)}.`
      : withRates ? `The plan now draws ${said(o)} and works out tax at the real rates, so the order counts. Every retirement page's figures change with it; to go back, pick the flat rate under Retirement settings on Will the money last?`
      : `The plan now draws ${said(o)}. It changes nothing until tax is worked out at the real rates (the button below).`;
    store.update((p) => { p.retirement = p.retirement ?? {}; p.retirement.withdrawalOrder = [...o.order]; if (withRates) p.retirement.taxMode = "brackets"; });
  };
  const realRates = () => { pending = "Your plan now works out tax at the real rates (the federal brackets), so the order counts. Every retirement page's figures change with it; to go back, pick the flat rate under Retirement settings on Will the money last?"; store.update((p) => { p.retirement = p.retirement ?? {}; p.retirement.taxMode = "brackets"; }); };
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, best.current ? `Your order is the best one for this plan` : `"${best.label}" works best for you`),
    ui.h("p", { class: "lede" }, best.success
      ? `${best.label}: ${money(best.endAfterTaxReal)} left at the end after the tax still owed on pre-tax money (today's dollars), with ${money(best.taxesReal)} of federal tax paid over the plan. ${d.gainVsWorst > 500 ? `The worst order leaves ${money(d.gainVsWorst)} less${d.taxSpread > 0 ? ` and pays ${money(d.taxSpread)} more tax` : ""}.` : "For this plan the order barely matters."}${current && !best.current ? ` Yours, "${current.label}", leaves ${money(current.endAfterTaxReal)}.` : ""}`
      : `The money runs out under every order; "${best.label}" lasts longest, to ${best.failYear}. Will the money last? is the place to fix that first.`),
    // the best order, one tap away on the first screen (x-4: the three buttons were a screen and more below)
    !best.current ? ui.row(ui.button(d.bracketsOn ? `Use "${best.label}"` : `Use "${best.label}" with the real tax rates`, () => choose(best, !d.bracketsOn))) : null,
    ui.h("p", { class: "muted small" }, "Everyday cash always goes first. The page works each order through the federal tax brackets year by year, so the difference is actual tax, including the effect of required withdrawals and Social Security. What is left is counted after tax, because tax is still owed on pre-tax money."),
  ));
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);
  for (const n of d.notes) root.append(ui.notice("info", n));
  // the plan works out tax at one flat rate: said plainly, with the switch here (x-4)
  if (!d.bracketsOn) root.append(ui.h("div", { class: "notice info" },
    ui.h("p", { style: { margin: "0 0 8px" } }, best.current ? "Your plan works out tax at one flat rate, so the order changes nothing yet. With the real rates, this order is the best one; they also change the figures on every retirement page." : "Your plan works out tax at one flat rate, so the order changes nothing yet. Working tax out at the real rates makes it count, and changes the figures on every retirement page."),
    ui.row(ui.button("Work out tax at the real rates", realRates, { class: "secondary" }))));
  root.append(ui.card("The four orders",
    ui.h("ul", { class: "records" }, d.options.map((o) => ui.h("li", { style: o.best ? { background: "var(--accent-soft)", borderRadius: "8px" } : null },
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, o.label, o.best ? ui.h("span", { class: "pill accent" }, "best") : null, o.current ? ui.h("span", { class: "pill ok" }, "your plan") : null), ui.h("span", { class: "rec-value" }, o.success ? money(o.endAfterTaxReal) : `runs out ${o.failYear}`)),
      ui.h("div", { class: "rec-sub" }, `${o.note}. ${o.success ? `Left at the end after tax; ${money(o.endBalanceReal)} before it. ` : ""}Tax over the plan ${money(o.taxesReal)}; ${money(o.rmdReal)} of required withdrawals. Today's dollars.`),
      o.current ? null : ui.h("div", { style: { marginTop: "8px" } }, ui.button(`Use this order`, () => choose(o), { class: "secondary" }))))),
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

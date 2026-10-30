// modules/property/purchase/view.js -- DOM only. A big purchase three ways: save up by the date you want it,
// finance it now, or pay cash now; each against the money left each month, and the goals that would give way;
// the purchase in a fold.
import { compute } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.pu-root .pu-list { list-style: none; margin: 0; padding: 0; }
.pu-root .pu-list li { padding: 11px 0; border-bottom: 1px solid var(--line); }
.pu-root .pu-list li:last-child { border-bottom: 0; }
.pu-root .pu-head { display: flex; justify-content: space-between; gap: 12px; font-weight: 650; }
.pu-root .pu-head span:last-child { white-space: nowrap; }
.pu-root .pu-d { color: var(--text-2); font-size: var(--fs-sm); }
.pu-root .pu-warn { color: var(--warn); font-size: var(--fs-sm); }
.pu-root .pu-ok { color: var(--ok); font-size: var(--fs-sm); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const today = fmt.today();
  const d = compute(plan, { today });
  const root = ui.h("div", { class: "pu-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const s = plan.whatIfs?.purchase ?? {};
  const name = d.inputs.name || "the purchase";
  const monthYear = (iso) => new Date(`${iso.slice(0, 7)}-15T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  if (!s.price) root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "A big purchase"),
    ui.h("p", { class: "lede" }, "A sofa, a laptop, a ring, a boat: save up for it, put it on a payment plan, or pay now. This page shows what each costs and what it does to your other goals."),
    ui.h("p", { class: "muted small" }, "Tell it what you want to buy below. Until then it shows a $3,000 example.")));

  root.append(ui.card(null, ui.row(
    ui.stat(d.inputs.name || "Price", money(d.total), d.saved ? `${money(d.saved)} already set aside` : d.inputs.salesTax ? "with sales tax" : "nothing set aside yet"),
    ui.stat("Money left each month", money(Math.max(0, d.spare)), d.spare < 0 ? `already ${money(-d.spare)} short` : "after spending and saving"),
  )));

  const effect = (e, amount) => {
    if (!e) return null;
    if (!e.list.length) return ui.h("div", { class: "pu-ok" }, `Fits in the money left each month: ${money(Math.max(0, d.spare - amount))} still spare.`);
    return ui.h("div", { class: "pu-warn" }, `Needs ${money(e.list.reduce((t, g) => t + g.from, 0))} a month from your goals: ${e.list.map((g) => `${g.name} ${g.paused ? "paused" : g.monthsLater > 0 ? `${g.monthsLater} month${g.monthsLater === 1 ? "" : "s"} later` : "slower"}`).join(", ")}${e.uncovered > 0.5 ? `, and ${money(e.uncovered)} a month more than you have` : ""}.`);
  };
  const ways = [];
  if (d.save) ways.push(ui.h("li", {}, ui.h("div", { class: "pu-head" }, ui.h("span", {}, `Save up by ${monthYear(d.inputs.when)}`), ui.h("span", {}, `${money(d.save.monthly)} a month`)),
    ui.h("div", { class: "pu-d" }, `${d.save.months} month${d.save.months === 1 ? "" : "s"} of saving; the savings earn about ${money(d.save.earned)} on the way. No interest to pay.`), effect(d.effect.save, d.save.monthly)));
  else ways.push(ui.h("li", {}, ui.h("div", { class: "pu-head" }, ui.h("span", {}, "Save up"), ui.h("span", {}, "—")), ui.h("div", { class: "pu-d" }, "Choose when you want it, below, to see the monthly saving.")));
  const f = d.finance;
  ways.push(ui.h("li", {}, ui.h("div", { class: "pu-head" }, ui.h("span", {}, "Finance it now"), ui.h("span", {}, `${money(f.payment)} a month`)),
    ui.h("div", { class: "pu-d" }, `${f.months} months${f.promo ? `, ${f.promo === f.months ? "all at 0%" : `0% for the first ${f.promo}, then ${(d.inputs.apr * 100).toFixed(1).replace(/\.0$/, "")}%`}` : ` at ${(d.inputs.apr * 100).toFixed(1).replace(/\.0$/, "")}%`}: ${f.interest > 0.5 ? `${money(f.interest)} of interest, so it costs ${money(d.total + f.interest)}` : "no interest if every payment is on time"}.`),
    f.promo && f.promo < f.months ? ui.h("div", { class: "pu-warn" }, "Many 0% offers charge all the interest from day one if anything is left when the free months end: read the terms.") : null,
    effect(d.effect.finance, f.payment)));
  ways.push(ui.h("li", {}, ui.h("div", { class: "pu-head" }, ui.h("span", {}, "Pay cash now"), ui.h("span", {}, money(d.total - d.saved))),
    ui.h("div", { class: d.cash.fits && (!d.cash.target || d.cash.after >= d.cash.target) ? "pu-d" : "pu-warn" }, !d.cash.fits ? "There is not this much usable cash: the rest is set aside for goals or is your cushion." : d.cash.target && d.cash.after < d.cash.target ? `Leaves ${money(d.cash.after)} of usable cash, under your emergency target of ${money(d.cash.target)}.` : `Leaves ${money(d.cash.after)} of usable cash.`)));
  root.append(ui.card("Three ways to buy it", ui.h("ul", { class: "pu-list" }, ways),
    ui.h("p", { class: "muted small" }, "Goals give way least important first (Nice to have, then Want, then Must have), the ones due latest first.")));

  root.append(ui.h("details", { class: "card fold fold-card", open: s.price ? null : true }, ui.h("summary", {}, ui.h("h2", {}, "The purchase"), ui.h("span", { class: "fold-status" }, s.price ? `${name}, ${money(d.total)}` : "what and when"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.form([
      { key: "name", label: "What it is", type: "text", placeholder: "e.g. New sofa" },
      { key: "price", label: "Price", type: "money", min: 0 },
      { key: "salesTax", label: "Sales tax", type: "percent", min: 0, max: 15 },
      { key: "when", label: "When you want it", type: "date" },
      { key: "saved", label: "Already set aside for it", type: "money", min: 0 },
      { key: "apr", label: "The payment plan's rate", type: "percent", min: 0, max: 40, help: "store cards often charge 25% to 30%" },
      { key: "termMonths", label: "Payment plan length (months)", type: "number", min: 1, max: 120, step: "1" },
      { key: "promoMonths", label: "Months at 0%, if offered", type: "number", min: 0, max: 60, step: "1" },
    ], { ...d.inputs, name: s.name ?? "", price: s.price ?? "", when: s.when ?? "" }, (v) => {
      if (!(v.price > 0)) return;
      pending = "Saved.";
      store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.purchase = { name: String(v.name ?? "").trim(), price: v.price, salesTax: v.salesTax ?? 0, when: v.when || "", saved: v.saved ?? 0, apr: v.apr ?? null, termMonths: v.termMonths ?? null, promoMonths: v.promoMonths ?? 0 }; });
    }, { submitLabel: "Compare" })));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/goals/goals" }, "Goals"), ui.h("a", { class: "btn secondary", href: "#/goals/prioritizer" }, "What to save for first"))));
}

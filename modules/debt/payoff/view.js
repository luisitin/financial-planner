// modules/debt/payoff/view.js -- DOM only. Pick the extra and the order; see when each debt
// ends, the interest, and the three orders side by side.
import { compute } from "./compute.js";
import { ORDERS } from "../../../core/math/payoff.js";

const monthYear = (iso) => { const dt = new Date(`${String(iso).slice(0, 10)}T12:00:00`); return Number.isNaN(dt.getTime()) ? String(iso) : dt.toLocaleDateString(undefined, { month: "long", year: "numeric" }); };
let pending = null;   // confirmation kept across the shell re-render

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const monthsText = (m) => !Number.isFinite(m) ? "never" : m < 12 ? `${m} month${m === 1 ? "" : "s"}` : `${Math.floor(m / 12)} year${Math.floor(m / 12) === 1 ? "" : "s"}${m % 12 ? ` ${m % 12} month${m % 12 === 1 ? "" : "s"}` : ""}`;

  if (!d.hasData) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Pay off your debts"),
      ui.h("p", { class: "lede" }, "Put every loan and card on one plan: the same money each month, the smallest balance or the highest rate first, and the date each one is gone. It needs each debt's interest rate and required payment."),
      d.missing.length ? ui.h("p", { class: "muted small" }, `Missing rate or payment: ${d.missing.join(", ")}.`) : null,
      ui.row(ui.h("a", { class: "btn", href: "#/balance/liabilities" }, d.missing.length ? "Add the rates and payments" : "Add your debts"))));
    return;
  }
  const c = d.chosen;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, Number.isFinite(c.months) ? `Debt-free ${c.endDate ? `by ${monthYear(c.endDate)}` : `in ${monthsText(c.months)}`}` : "This plan never ends"),
    ui.h("p", { class: "lede" }, Number.isFinite(c.months) ? `${fmt.money(d.budget, cur)} a month (${fmt.money(d.budget - d.extra, cur)} required plus ${fmt.money(d.extra, cur)} extra), ${ORDERS[d.order].toLowerCase()}: ${monthsText(c.months)} and ${fmt.money(c.totalInterest, cur)} of interest.` : "The payments do not cover the interest on every debt. Add an extra amount below."),
    d.plus100 ? ui.h("p", { class: "muted small" }, `${fmt.money(100, cur)} more a month would end it ${d.plus100.months} month${d.plus100.months === 1 ? "" : "s"} sooner and save ${fmt.money(d.plus100.interest, cur)} of interest.`) : null,
    d.missing.length ? ui.h("p", { class: "muted small" }, `Not in the plan (no rate or payment yet): ${d.missing.join(", ")}.`) : null,
  ));
  const extraIn = ui.input({ type: "number", value: d.extra, min: 0, step: "10", inputmode: "decimal", "aria-label": "Extra each month" });
  const orderSel = ui.select(Object.entries(ORDERS).map(([value, label]) => ({ value, label })), d.order, { "aria-label": "Order" });
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(ui.card("Your plan", ui.h("div", { class: "form" },
    ui.field("Extra each month, on top of the required payments", extraIn, "any amount; the freed payment of each finished debt rolls onto the next"),
    ui.field("Order", orderSel, "highest rate first costs the least; smallest balance first gives quick wins")),
    ui.row(ui.button("Save plan", () => { pending = "Plan saved."; store.update((p) => { p.debtPlan = { ...(p.debtPlan ?? {}), extra: Math.max(0, Number(extraIn.value) || 0), order: orderSel.value }; }); })),
    out,
  ));
  if (d.order === "custom") root.append(ui.card("My own order",
    ui.h("p", { class: "muted small" }, "Top gets the extra first. Move a debt up with the arrow."),
    ui.h("ul", { class: "page-list" }, c.debts.map((x, i) => ui.h("li", {},
      ui.h("span", { class: "ic" }, String(i + 1)), ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, x.name)),
      ui.h("span", { class: "st" }, i > 0 ? ui.button("Up", () => store.update((p) => { const ids = c.debts.map((y) => y.id); [ids[i - 1], ids[i]] = [ids[i], ids[i - 1]]; p.debtPlan = { ...(p.debtPlan ?? {}), customOrder: ids }; }), { class: "secondary small" }) : null))))));
  root.append(ui.card("When each debt ends",
    ui.h("ul", { class: "page-list" }, c.debts.map((x) => { const src = d.debts.find((y) => y.id === x.id); return ui.h("li", {},
      ui.h("span", { class: "ic" }, Number.isFinite(x.months) ? "✅" : "⚠️"),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, x.name), ui.h("div", { class: "d" }, `${fmt.money(src.balance, cur)} at ${fmt.pct(src.rate, 1)} · ${fmt.money(src.minPayment, cur)} a month required · ${fmt.money(x.interest, cur)} interest to come`)),
      ui.h("span", { class: "st", style: { textAlign: "right" } }, ui.h("div", { style: { fontWeight: "600" } }, x.endDate ? monthYear(x.endDate) : monthsText(x.months)), ui.h("div", { class: "muted small" }, monthsText(x.months)))); })),
  ));
  const rowFor = (k) => { const p = d.plans[k]; return ui.h("li", {},
    ui.h("span", { class: "ic" }, k === d.best ? "🏆" : ""),
    ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, ORDERS[k], k === d.order ? ui.h("span", { class: "pill accent" }, "chosen") : null, k === d.best ? ui.h("span", { class: "pill ok" }, "least interest") : null), ui.h("div", { class: "d" }, `${monthsText(p.months)}${p.endDate ? `, by ${monthYear(p.endDate)}` : ""}`)),
    ui.h("span", { class: "st" }, `${fmt.money(p.totalInterest, cur)} interest`)); };
  root.append(ui.card("The three orders, same money",
    ui.h("ul", { class: "page-list" }, ["avalanche", "snowball", "custom"].map(rowFor)),
    d.baseline ? ui.h("p", { class: "muted small" }, `With the required payments only: ${monthsText(d.baseline.months)} and ${fmt.money(d.baseline.totalInterest, cur)} of interest.`) : null,
  ));
}

// modules/debt/credit-cards/view.js -- DOM only. Cards with their limit use, the cost of
// minimum payments, and whether a balance transfer pays.
import { compute } from "./compute.js";

let pending = null;   // confirmation kept across the shell re-render

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const monthsText = (m) => !Number.isFinite(m) ? "never" : m < 12 ? `${m} month${m === 1 ? "" : "s"}` : `${Math.floor(m / 12)} year${Math.floor(m / 12) === 1 ? "" : "s"}${m % 12 ? ` ${m % 12} month${m % 12 === 1 ? "" : "s"}` : ""}`;

  if (!d.hasData) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Credit cards"),
      ui.h("p", { class: "lede" }, "Add your cards as accounts (type Credit card) on the Net worth page with what you owe, then their rate, minimum payment and credit limit on the Debts page. This page then shows how much of your limits you use, what paying the minimum would cost, and whether a balance transfer helps."),
      ui.row(ui.h("a", { class: "btn", href: "#/balance/net-worth" }, "Add a card"))));
    return;
  }
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, `${fmt.money(d.totalBalance, cur)} on ${d.count} card${d.count === 1 ? "" : "s"}`),
    ui.h("p", { class: "lede" }, `${d.interestMonthly ? `About ${fmt.money(d.interestMonthly, cur)} a month goes to interest. ` : ""}${d.utilisation !== null ? `You use ${fmt.pct(d.utilisation, 0)} of your combined limits; under 30% is what lenders like to see.` : "Add each card's credit limit on the Debts page to see how much of it you use."}`),
    d.missing.length ? ui.h("p", { class: "muted small" }, `No rate or payment yet: ${d.missing.join(", ")}.`) : null,
  ));
  root.append(ui.card("Each card",
    ui.h("ul", { class: "page-list" }, d.cards.map((c) => ui.h("li", { style: { alignItems: "flex-start" } },
      ui.h("span", { class: "ic" }, "💳"),
      ui.h("span", { class: "body" },
        ui.h("div", { class: "t" }, c.name, " ", c.utilisation !== null ? ui.h("span", { class: `pill ${c.utilisation > 0.3 ? "warn" : "ok"}` }, `${fmt.pct(c.utilisation, 0)} of limit`) : null, c.rate !== null && c.rate >= 0.2 ? ui.h("span", { class: "pill warn" }, `${fmt.pct(c.rate, 1)}`) : null),
        c.utilisation !== null ? ui.h("div", { class: "progress", style: { margin: "6px 0 2px" } }, ui.h("span", { style: { width: `${Math.min(100, Math.round(c.utilisation * 100))}%`, background: c.utilisation > 0.3 ? "var(--warn)" : "var(--ok)" } })) : null,
        ui.h("div", { class: "d" }, c.hasDetail ? `${fmt.pct(c.rate, 1)} · ${fmt.money(c.minPayment, cur)} a month required${c.limit ? ` · limit ${fmt.money(c.limit, cur)}` : ""}` : "add the rate and payment on the Debts page"),
        c.trap ? ui.h("div", { class: "d" }, `Paying only the ${c.minPayment > 0 ? "required amount" : "usual minimum (2%, at least 25)"}: ${Number.isFinite(c.trap.months) ? `${monthsText(c.trap.months)} and ${fmt.money(c.trap.interest, cur)} of interest` : "it never ends"}.`) : null,
        c.transfer ? ui.h("div", { class: "d" }, `Balance transfer at 0% for ${c.transfer.promoMonths} months with a ${fmt.pct(c.transfer.feePct, 0)} fee (${fmt.money(c.transfer.fee, cur)}): ${c.transfer.saves > 0 ? `saves about ${fmt.money(c.transfer.saves, cur)} against ${fmt.money(c.transfer.interestNow, cur)} of interest, if you pay ${fmt.money(c.transfer.payToClear, cur)} a month to clear it in time.` : `does not pay: the fee is more than the ${fmt.money(c.transfer.interestNow, cur)} of interest.`}`) : null),
      ui.h("span", { class: "st", style: { fontWeight: "600" } }, fmt.money(c.balance, cur))))),
  ));
  const monthsIn = ui.input({ type: "number", value: d.promoMonths, min: 1, max: 36, step: "1", "aria-label": "Promo months" });
  const feeIn = ui.input({ type: "number", value: Math.round(d.feePct * 100 * 10) / 10, min: 0, max: 10, step: "0.5", "aria-label": "Transfer fee percent" });
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(ui.card("Balance transfer offer to compare", ui.h("div", { class: "form" }, ui.field("Promotional 0% months", monthsIn, "typical offers: 12 to 21"), ui.field("Transfer fee, percent", feeIn, "typical: 3 to 5")),
    ui.row(ui.button("Use these numbers", () => { pending = "Using these numbers."; store.update((p) => { p.debtPlan = { ...(p.debtPlan ?? {}), transfer: { months: Math.max(1, Number(monthsIn.value) || 15), feePct: Math.max(0, Number(feeIn.value) || 0) / 100 } }; }); })), out));
}

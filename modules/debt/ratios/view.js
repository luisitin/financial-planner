// modules/debt/ratios/view.js -- DOM only. Four numbers a lender looks at, each with a plain
// explanation and where the usual lines are.
import { compute } from "./compute.js";

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const monthYear = (iso) => { const t = new Date(`${String(iso).slice(0, 10)}T12:00:00`); return Number.isNaN(t.getTime()) ? String(iso) : t.toLocaleDateString(ctx.plan.meta.locale, { month: "long", year: "numeric" }); };
  const d = compute(plan, { today: fmt.today() });

  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "What lenders see"),
    ui.h("p", { class: "lede" }, "When you apply for a mortgage, a car loan or a card, the lender works out a few ratios from your income and your debts. Here they are, with the lines lenders usually draw."),
    // with no income there is nothing to work out yet: what to do first, as buttons, and no $0 tiles or dashes (DP-7)
    !d.hasIncome ? ui.h("p", {}, d.hasDebts ? "Most of these need your income." : "Most of these need your income first, then your debts.") : null,
    !d.hasIncome ? ui.row(ui.h("a", { class: "btn", href: "#/cashflow/income" }, "Add your income"), !d.hasDebts ? ui.h("a", { class: "btn secondary", href: "#/balance/net-worth?add=debt&back=debt/ratios" }, "Add your debts") : null) : null,
    d.hasIncome && !d.hasDebts ? ui.h("p", { class: "muted small" }, "No debts on file. If you have any, add them; if not, every ratio here is zero, which is the best it gets.") : null,
    d.hasIncome && !d.hasDebts ? ui.row(ui.h("a", { class: "btn secondary", href: "#/balance/net-worth?add=debt&back=debt/ratios" }, "Add your debts")) : null,
  ));
  if (!d.hasIncome) return;
  root.append(ui.card(null, ui.row(
    d.hasIncome ? ui.stat("Income a month", fmt.money(d.incomeMonthly, cur), "before tax, from the Income page") : null,
    ui.stat("Debt payments a month", fmt.money(d.payments, cur), d.minimums !== null && d.payments > d.minimums + 0.5 ? `what you pay, from the Debts page; ${fmt.money(d.minimums, cur)} of it is required` : "required payments, from the Debts page"),
    ui.stat("You owe in total", fmt.money(d.owed, cur), d.monthsOfIncomeOwed !== null ? `${fmt.monthsWords(d.monthsOfIncomeOwed)} of income` : null),
  )));
  root.append(ui.card("The ratios",
    ui.h("ul", { class: "page-list" }, d.rows.map((r) => ui.h("li", { style: { alignItems: "flex-start" } },
      ui.h("span", { class: "ic" }, r.grade ? { ok: "✅", warn: "⚠️", bad: "🛑" }[r.grade.level] : ""),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, r.label, " ", r.grade ? ui.h("span", { class: `pill ${r.grade.level === "ok" ? "ok" : "warn"}` }, r.grade.label) : null), ui.h("div", { class: "d" }, r.why),
        // card use over 30%: how much less, and about when at what you pay now (Credit cards' own answer; round 4, 2026-11-02)
        // a renter's figure with a housing payment like the rent added, as a home lender counts it (round 8, 2026-11-06)
        r.note ? ui.h("div", { class: "d", style: { color: "var(--text)" } }, r.note) : null,
        r.key === "utilisation" && d.under && d.under.less30 > 0.5 ? ui.h("div", { class: "d", style: { color: "var(--text)" } }, `${fmt.money(d.under.less30, cur)} less on the cards gets you under 30%${d.under.date30 ? `: about ${monthYear(d.under.date30)} at what you pay now` : ""}.`) : null,
        // its own 44 px button under the sentence (FF8: a 16 px link)
        r.key === "utilisation" && d.under && d.under.less30 > 0.5 ? ui.row(ui.h("a", { class: "btn secondary", href: "#/debt/payoff" }, "Open my payoff plan")) : null),
      ui.h("span", { class: "st", style: { fontWeight: "600" } }, r.value === null ? "-" : r.kind === "pct" ? fmt.pct(r.value, 0) : fmt.monthsWords(r.value))))),
    ui.h("p", { class: "muted small" }, "These are rules of thumb from US lending, not a decision. A lender also looks at your credit history and what you have saved."),
  ));
}

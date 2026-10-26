// modules/debt/refinance/view.js -- DOM only. Type the offer, see the payment, the break-even
// month and the interest both ways over the years you plan to stay.
import { compute } from "./compute.js";

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });

  if (!d.hasData) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Refinance"),
      ui.h("p", { class: "lede" }, "Type a refinance offer (rate, term, closing costs) and see whether it pays: the new payment, how many months until the closing costs are paid back, and the interest both ways over the years you plan to stay. It needs your mortgage with its rate and payment first."),
      ui.row(ui.h("a", { class: "btn", href: d.missing === "mortgage" ? "#/balance/net-worth" : "#/balance/liabilities" }, d.missing === "mortgage" ? "Add the mortgage" : "Add its rate and payment"))));
    return;
  }
  const rf = plan.debtPlan?.refinance ?? {};
  const FIELDS = [
    { key: "rate", label: "Offered rate per year", type: "percent", required: true, min: 0, max: 30, help: "e.g. 5.5 for 5.5%" },
    { key: "termYears", label: "New term in years", type: "number", required: true, min: 1, max: 40, step: "1" },
    { key: "closingCosts", label: "Closing costs", type: "money", min: 0, help: "fees, points, appraisal; usually 2 to 5% of the loan" },
    { key: "yearsStaying", label: "Years you expect to keep this home", type: "number", min: 1, max: 40, step: "1", help: "the comparison only counts interest over these years" },
  ];
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.needsOffer ? "Refinance" : d.verdict === "worth it" ? "Worth it" : d.verdict === "close call" ? "A close call" : "Not worth it"),
    ui.h("p", { class: "lede" }, d.needsOffer
      ? `Your mortgage: ${fmt.money(d.current.balance, cur)} at ${fmt.pct(d.current.rate, 2)}, ${fmt.money(d.current.payment, cur)} a month. Type an offer below.`
      : `${fmt.money(d.current.balance, cur)} at ${fmt.pct(d.offer.rate, 2)} over ${d.offer.termYears} years: ${fmt.money(d.offer.payment, cur)} a month, ${d.monthlySaving > 0 ? `${fmt.money(d.monthlySaving, cur)} less than now` : `${fmt.money(-d.monthlySaving, cur)} more than now`}. Over the ${d.yearsStaying} years you plan to stay, ${d.netWhileStaying >= 0 ? `you come out ${fmt.money(d.netWhileStaying, cur)} ahead after the closing costs` : `you come out ${fmt.money(-d.netWhileStaying, cur)} behind once the closing costs are counted`}.`),
  ));
  root.append(ui.card("The offer", ui.form(FIELDS, { rate: rf.rate ?? null, termYears: rf.termYears ?? 30, closingCosts: rf.closingCosts ?? null, yearsStaying: rf.yearsStaying ?? 7 }, (v) => {
    store.update((p) => { p.debtPlan = { ...(p.debtPlan ?? {}), refinance: { rate: v.rate ?? null, termYears: v.termYears ?? 30, closingCosts: v.closingCosts ?? 0, yearsStaying: v.yearsStaying ?? 7 } }; });
  }, { submitLabel: "Compare" })));
  if (!d.needsOffer) root.append(ui.card(null, ui.row(
    ui.stat("New payment", fmt.money(d.offer.payment, cur), `now ${fmt.money(d.current.payment, cur)}`),
    ui.stat("Costs paid back in", d.breakEvenMonths === null ? "never" : `${d.breakEvenMonths} month${d.breakEvenMonths === 1 ? "" : "s"}`, d.breakEvenMonths === null ? "the payment does not go down" : `${fmt.money(d.offer.closingCosts, cur)} of closing costs`),
    ui.stat(`Interest over ${d.yearsStaying} years`, fmt.money(d.interestWhileStaying.offer, cur), `now: ${fmt.money(d.interestWhileStaying.current, cur)}`),
    ui.stat("Whole loan", fmt.money(d.offer.totalInterest, cur), `interest over ${d.offer.termYears} years; the current loan has ${fmt.money(d.current.totalInterest, cur)} left${d.extraYears > 0 ? ` and ends ${d.extraYears} years sooner` : ""}`),
  ), ui.h("p", { class: "muted small" }, "A lower payment over a longer term can cost more in total even when it saves money each month. The years-you-stay figure is the one that matters if you will move before the loan ends.")));
}

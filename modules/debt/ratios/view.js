// modules/debt/ratios/view.js -- DOM only. Simple first (docs/OPTIONAL.md): the answer is the share of income a lender
// would see going to debts, with one sentence per case; the card-use line and its way on stay in sight (a hint worth
// money). One tap away (core/ui/more.js): "3 more numbers" (income, debt payments, everything owed) and "How this is worked
// out" (the four ratios, each with the line lenders draw). "More on this": Your credit score.
import { compute } from "./compute.js";
import { parts, links } from "../../../core/ui/more.js";

/** The headline, per case: "Lenders would see 20% of your income going to debts: usually fine". Exported for the test. */
export function headlineOf(d, pct) {
  if (!d.hasIncome) return "What lenders see";
  if (!d.hasDebts) return "Lenders would see no debts on your income";
  const level = d.grades.dti?.level ?? "ok";
  return `Lenders would see ${pct(d.renter ? d.dtiRequired : d.dti, 0)} of your income going to debts: ${level === "ok" ? "usually fine" : level === "warn" ? "on the high side" : "high"}`;
}
/** The one sentence under it, written out for every case (R5). Exported for the test. */
export function sentenceOf(d) {
  if (!d.hasIncome) return d.hasDebts ? "Most of these need your income." : "Most of these need your income first, then your debts.";
  if (!d.hasDebts) return "No debts on file. If you have any, add them; if not, every ratio here is zero, which is the best it gets.";
  const level = d.grades.dti?.level ?? "ok";
  if (d.renter) return level === "ok" ? "Your debt payments, not counting rent, are within the 15 to 20% guideline for renters."
    : level === "warn" ? "Your debt payments, not counting rent, are over the 15 to 20% guideline for renters."
    : "Your debt payments alone, not counting rent, are more than the 36% lenders like for everything, a home payment included.";
  return level === "ok" ? "That is under the 36% most lenders like to see."
    : level === "warn" ? "That is over the 36% most lenders like; many still approve up to 43%, but the payments get tight."
    : "That is more than most lenders accept: some go to 45 or 50%, and only with a strong credit score and savings.";
}

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const monthYear = (iso) => { const t = new Date(`${String(iso).slice(0, 10)}T12:00:00`); return Number.isNaN(t.getTime()) ? String(iso) : t.toLocaleDateString(ctx.plan.meta.locale, { month: "long", year: "numeric" }); };
  const d = compute(plan, { today: fmt.today() });

  // card use over 30%: how much less, and about when at what you pay now (Credit cards' own answer; round 4, 2026-11-02)
  const cardsLine = d.hasIncome && d.under && d.under.less30 > 0.5 ? `${fmt.money(d.under.less30, cur)} less on the cards gets you under 30%${d.under.date30 ? `: about ${monthYear(d.under.date30)} at what you pay now` : ""}.` : null;
  // housing over the line lenders call high: an alarm, never folded
  const housing = d.rows.find((r) => r.key === "housing");
  const housingLine = d.hasIncome && housing?.grade?.level === "bad" ? `Housing takes ${fmt.pct(housing.value, 0)} of your income before tax: more than the 35% lenders call high.` : null;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, headlineOf(d, fmt.pct)),
    ui.h("p", { class: d.hasIncome && d.hasDebts ? "lede" : null }, sentenceOf(d)),
    // with no income there is nothing to work out yet: what to do first, as buttons, and no $0 tiles or dashes (DP-7)
    !d.hasIncome ? ui.row(ui.h("a", { class: "btn", href: "#/cashflow/income" }, "Add your income"), !d.hasDebts ? ui.h("a", { class: "btn secondary", href: "#/balance/net-worth?add=debt&back=debt/ratios" }, "Add your debts") : null) : null,
    d.hasIncome && !d.hasDebts ? ui.row(ui.h("a", { class: "btn secondary", href: "#/balance/net-worth?add=debt&back=debt/ratios" }, "Add your debts")) : null,
    housingLine ? ui.h("p", {}, housingLine) : null,
    cardsLine ? ui.h("p", {}, cardsLine) : null,
    // its own 44 px button under the sentence (FF8: a 16 px link)
    cardsLine ? ui.row(ui.h("a", { class: "btn secondary", href: "#/debt/payoff" }, "Open my payoff plan")) : null,
  ));
  if (!d.hasIncome) return;

  const tiles = [
    ui.stat("Income a month", fmt.money(d.incomeMonthly, cur), "before tax, from the Income page"),
    ui.stat("Debt payments a month", fmt.money(d.payments, cur), d.minimums !== null && d.payments > d.minimums + 0.5 ? `what you pay, from the Debts page; ${fmt.money(d.minimums, cur)} of it is required` : "required payments, from the Debts page"),
    ui.stat("You owe in total", fmt.money(d.owed, cur), d.monthsOfIncomeOwed !== null ? `${fmt.monthsWords(d.monthsOfIncomeOwed)} of income` : null),
  ];
  const ratios = ui.h("ul", { class: "page-list" }, d.rows.map((r) => ui.h("li", { style: { alignItems: "flex-start" } },
    ui.h("span", { class: "ic" }, r.grade ? { ok: "✅", warn: "⚠️", bad: "🛑" }[r.grade.level] : ""),
    ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, r.label, " ", r.grade ? ui.h("span", { class: `pill ${r.grade.level === "ok" ? "ok" : "warn"}` }, r.grade.label) : null), ui.h("div", { class: "d" }, r.why),
      // a renter's figure with a housing payment like the rent added, as a home lender counts it (round 8, 2026-11-06)
      r.note ? ui.h("div", { class: "d", style: { color: "var(--text)" } }, r.note) : null),
    ui.h("span", { class: "st", style: { fontWeight: "600" } }, r.value === null ? "-" : r.kind === "pct" ? fmt.pct(r.value, 0) : fmt.monthsWords(r.value)))));
  const more = parts(ctx,
    { id: "numbers", kind: "more", n: tiles.length, noun: "numbers", body: () => ui.row(...tiles) },
    { id: "how", kind: "how", says: `${d.rows.length} ratios`, body: () => [ratios,
      ui.h("p", { class: "muted small" }, "These are rules of thumb from US lending, not a decision. A lender also looks at your credit history and what you have saved.")] });
  if (more) root.append(more);
  const deeper = links(ctx, [{ href: "#/debt/credit-score", ask: "What is my credit score?", says: "Your credit score" }]);
  if (deeper) root.append(deeper);
}

// modules/goals/vehicle/view.js -- DOM only. The next car paid in cash or financed: the saving a month for
// cash, the loan if you finance what is not saved by then, the 20/4/10 checks, the figures in a fold.
import { compute, DEFAULTS, RULE } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.vh-root .vh-list { list-style: none; margin: 0; padding: 0; }
.vh-root .vh-list li { display: flex; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); }
.vh-root .vh-list li:last-child { border-bottom: 0; }
.vh-root .vh-list .vh-ic { flex: none; width: 22px; text-align: center; }
.vh-root .vh-d { color: var(--text-2); font-size: var(--fs-sm); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n / 10) * 10, cur);
  const pct = (x) => `${Math.round(x * 100)}%`;
  const d = compute(plan, { today: fmt.today() });
  const x = d.inputs, f = d.finance;
  const root = ui.h("div", { class: "vh-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const saved = !!plan.whatIfs?.vehicle;

  if (!saved && !d.goal) root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "The next car"),
    ui.h("p", { class: "lede" }, "Save up and pay cash, or finance it? Saving costs nothing but time; a loan costs interest. Most people do some of each: save what they can, borrow the rest for a short time. The figures below are an example: change them to the car you have in mind.")));
  for (const w of d.warnings) root.append(ui.notice("warn", w));

  root.append(ui.card(`${money(x.price)} car${x.date ? `, by ${x.date}` : ""}`, ui.row(
    ui.stat("To pay cash", money(d.cash.neededMonthly), `a month for ${d.monthsToDate} months`),
    ui.stat("Saved by then", money(d.savedByDate), `at ${money(d.monthly)} a month${d.goal ? ` ("${d.goal.name}")` : ""}`),
  ), ui.h("p", { class: "vh-d" }, `With sales tax${x.tradeIn ? " and less the trade-in" : ""} it takes ${money(d.net)}. ${f.loan > 0 ? `If you keep saving ${money(d.monthly)} a month, you would borrow about ${money(f.loan)}.` : "What you save covers it: no loan needed."}`),
  d.goal && d.cash.neededMonthly > d.monthly + 1 ? ui.row(ui.button(`Save ${money(d.cash.neededMonthly)} a month`, () => {
    pending = "Goal's monthly amount set.";
    store.update((p) => { const g = (p.goals ?? []).find((y) => y.id === d.goal.id); if (g) g.monthly = Math.round(d.cash.neededMonthly); });
  }, { class: "secondary" })) : null));

  if (f.loan > 0) root.append(ui.card("Financing the rest", ui.row(
    ui.stat("Payment", money(f.payment), `a month for ${f.months} months at ${(x.rate * 100).toFixed(1)}%`),
    ui.stat("Interest", money(f.totalInterest), "the cost of borrowing"),
  ), ui.h("p", { class: "vh-d" }, `Saving the whole amount instead would cost nothing in interest and earn about ${money(d.cash.interestEarned)}. After the loan, keep paying yourself the same ${money(f.payment)} a month: the next car is then paid in cash.`)));

  const r = d.rule;
  const item = (ok, text) => ui.h("li", {}, ui.h("span", { class: "vh-ic" }, ok === null ? "•" : ok ? "✅" : "⚠️"), ui.h("span", {}, text));
  root.append(ui.card("The 20/4/10 rule", ui.h("p", { class: "vh-d" }, "A common rule of thumb for affording a car:"), ui.h("ul", { class: "vh-list" },
    item(r.downOk, `At least ${pct(RULE.down)} down: ${f.loan > 0 ? `${pct(r.downShare)} down` : "paid in full"}.`),
    item(r.termOk, `A loan of at most ${RULE.months / 12} years: ${f.loan > 0 ? `${f.months / 12} years` : "no loan"}.`),
    item(r.shareOk, r.share === null ? "Car costs under 10% of gross income: add your pay on Income to check." : `Car costs under ${pct(RULE.share)} of gross income: ${money(r.carCostsMonthly)} a month (the payment and the transport costs on Expenses) is ${pct(r.share)}.`))));

  const s = plan.whatIfs?.vehicle ?? {};
  const fields = [
    { key: "price", label: "Price", type: "money", min: 0, help: d.goal ? `empty: the "${d.goal.name}" goal's target by its date` : undefined },
    { key: "salesTax", label: "Sales tax and fees", type: "percent", min: 0, max: 20 },
    { key: "tradeIn", label: "Trade-in or sale of the old car", type: "money", min: 0 },
    { key: "date", label: "Buy by", type: "date" },
    { key: "rate", label: "Loan rate a year", type: "percent", min: 0, max: 30 },
    { key: "termMonths", label: "Loan length (months)", type: "number", min: 12, max: 96, step: "12" },
    { key: "saved", label: "Saved so far", type: "money", min: 0, help: "empty: the car goal on Goals" },
    { key: "monthly", label: "Saved toward it a month", type: "money", min: 0, help: "empty: the car goal's monthly amount" },
  ];
  root.append(ui.h("details", { class: "card fold fold-card", open: saved || d.goal ? null : true }, ui.h("summary", {}, ui.h("h2", {}, "The figures"), ui.h("span", { class: "fold-status" }, money(x.price)), ui.h("span", { class: "fold-chev" }, "›")),
    ui.form(fields, Object.fromEntries(fields.map((f2) => [f2.key, s[f2.key] ?? (["saved", "monthly", "price", "date"].includes(f2.key) ? (f2.key === "date" ? "" : null) : DEFAULTS[f2.key])])), (v) => {
      pending = "Saved.";
      store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.vehicle = Object.fromEntries(fields.map((f2) => [f2.key, f2.type === "date" ? v[f2.key] || "" : v[f2.key] ?? null])); });
    }, { submitLabel: "Work it out" })));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/goals/goals" }, "Goals"), ui.h("a", { class: "btn secondary", href: "#/goals/prioritizer" }, "Which goal first?"))));
}

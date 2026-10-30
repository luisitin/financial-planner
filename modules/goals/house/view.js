// modules/goals/house/view.js -- DOM only. How much home the income supports, the home you have in mind a
// month, the cash it takes and when you get there; the figures in one form, and a button that puts the
// cash target on the Goals page.
import { compute, DEFAULTS, FRONT, BACK } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.hs-root .hs-list { list-style: none; margin: 0; padding: 0; }
.hs-root .hs-list li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); }
.hs-root .hs-list li:last-child { border-bottom: 0; }
.hs-root .hs-list b { white-space: nowrap; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n / 10) * 10, cur);
  const pct = (x) => `${Math.round(x * 100)}%`;
  const today = fmt.today();
  const d = compute(plan, { today });
  const x = d.inputs;
  const root = ui.h("div", { class: "hs-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const saved = !!plan.whatIfs?.house;

  if (!saved) root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Saving for a home"),
    ui.h("p", { class: "lede" }, "How much home your income supports, what a home would cost a month, the cash you need on the day, and when you will have it. The figures below are an example: put in the home you have in mind.")));
  for (const w of d.warnings) root.append(ui.notice("warn", w));

  if (d.maxPrice !== null) root.append(ui.card("What your income supports", ui.row(
    ui.stat("Up to about", money(d.maxPrice), `with ${pct(x.downShare)} down at ${(x.rate * 100).toFixed(2)}%`),
    ui.stat("This home a month", money(d.monthly), `${pct(d.frontShare)} of gross income; ${pct(FRONT)} is the usual most`),
  ), ui.h("p", { class: "muted small" }, `Lenders like housing under ${pct(FRONT)} of gross income (${money(d.maxFront)} a month for you) and all debt payments under ${pct(BACK)} (${money(d.maxBack)} left after your other loans and cards). The ${d.rule === "front" ? "first" : "second"} is the tighter one for you. "Supports" is not "comfortable": check the budget on Expenses.`)));
  else root.append(ui.card(null, ui.h("p", { class: "muted" }, "Add your pay on the Income page to see what it supports."), ui.row(ui.h("a", { class: "btn secondary", href: "#/cashflow/income" }, "Income"))));

  root.append(ui.card(`A ${money(x.price)} home`, ui.h("ul", { class: "hs-list" },
    ui.h("li", {}, ui.h("span", {}, "Mortgage (principal and interest)"), ui.h("b", {}, money(d.parts.principalInterest))),
    ui.h("li", {}, ui.h("span", {}, "Property tax and insurance"), ui.h("b", {}, money(d.parts.taxInsurance))),
    d.parts.hoa ? ui.h("li", {}, ui.h("span", {}, "HOA"), ui.h("b", {}, money(d.parts.hoa))) : null,
    ui.h("li", {}, ui.h("span", {}, ui.h("b", {}, "A month")), ui.h("b", {}, money(d.monthly)))),
    ui.h("h3", { style: { margin: "14px 0 4px" } }, "Cash on the day"),
    ui.h("ul", { class: "hs-list" },
      ui.h("li", {}, ui.h("span", {}, `Down payment (${pct(x.downShare)})`), ui.h("b", {}, money(d.cash.down))),
      ui.h("li", {}, ui.h("span", {}, `Closing costs (about ${pct(x.closingShare)})`), ui.h("b", {}, money(d.cash.closing))),
      ui.h("li", {}, ui.h("span", {}, `Reserves (${x.reserveMonths} months of the payment)`), ui.h("b", {}, money(d.cash.reserves))),
      ui.h("li", {}, ui.h("span", {}, ui.h("b", {}, "Cash needed")), ui.h("b", {}, money(d.cash.total))))));

  // when
  const when = ui.card("When you get there");
  const have = `${money(d.saved)} set aside${d.goal ? ` (the "${d.goal.name}" goal)` : ""}`;
  if (d.monthsToGo === 0) when.append(ui.h("p", {}, `You have it: ${have}.`));
  else if (d.monthsToGo !== null) when.append(ui.h("p", {}, Number.isFinite(d.monthsToGo) ? `With ${have} and ${money(d.monthlySaving)} a month, you have it in about ${Math.ceil(d.monthsToGo / 12 * 10) / 10} years (${d.readyDate}).` : `At ${money(d.monthlySaving)} a month it is not reached in 100 years.`));
  else when.append(ui.h("p", {}, `${have[0].toUpperCase()}${have.slice(1)}; enter what you save a month below to see when.`));
  if (d.neededMonthly !== null) when.append(ui.h("p", {}, `To have it by ${d.target}: about ${money(d.neededMonthly)} a month.`));
  when.append(ui.row(ui.button(d.goal ? `Update the "${d.goal.name}" goal` : "Make it a goal", () => {
    pending = d.goal ? "Goal updated." : "Goal added on the Goals page.";
    store.update((p) => {
      p.goals = p.goals ?? [];
      const g = d.goal ? p.goals.find((y) => y.id === d.goal.id) : null;
      const target = Math.round(d.cash.total / 100) * 100;
      if (g) Object.assign(g, { target, targetDate: d.target || g.targetDate, monthly: x.monthly ?? g.monthly });
      else p.goals.push({ id: ui.uid(), name: "House down payment", icon: "🏠", target, targetDate: d.target || "", priority: 2, saved: x.saved ?? 0, fundedBy: [], monthly: x.monthly ?? 0, rate: null, inflates: true });
    });
  }), ui.h("a", { class: "btn secondary", href: "#/goals/goals" }, "Goals")));
  root.append(when);

  const s = plan.whatIfs?.house ?? {};
  const pctField = (key, label, help) => ({ key, label, type: "percent", min: 0, max: 100, help });
  const fields = [
    { key: "price", label: "Home price", type: "money", min: 0 },
    pctField("downShare", "Down payment", "20% avoids mortgage insurance"),
    pctField("closingShare", "Closing costs, share of price", "usually 2% to 5%"),
    pctField("rate", "Mortgage rate a year"),
    { key: "termYears", label: "Mortgage length (years)", type: "number", min: 5, max: 40, step: "1" },
    pctField("taxRate", "Property tax a year, share of value"),
    pctField("insuranceRate", "Home insurance a year, share of value"),
    { key: "hoaMonthly", label: "HOA a month", type: "money", min: 0 },
    { key: "reserveMonths", label: "Months of payments kept in reserve", type: "number", min: 0, max: 12, step: "1" },
    { key: "saved", label: "Set aside so far", type: "money", min: 0, help: "empty: the house goal on the Goals page" },
    { key: "monthly", label: "Saved toward it a month", type: "money", min: 0, help: "empty: the house goal's monthly amount" },
    { key: "targetDate", label: "Buy by", type: "date" },
  ];
  const values = Object.fromEntries(fields.map((f) => [f.key, s[f.key] ?? (["saved", "monthly"].includes(f.key) ? null : DEFAULTS[f.key])]));
  root.append(ui.h("details", { class: "card fold fold-card", open: saved ? null : true }, ui.h("summary", {}, ui.h("h2", {}, "The figures"), ui.h("span", { class: "fold-status" }, money(x.price)), ui.h("span", { class: "fold-chev" }, "›")),
    ui.form(fields, values, (v) => {
      pending = "Saved.";
      store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.house = Object.fromEntries(fields.map((f) => [f.key, f.type === "date" ? v[f.key] || "" : v[f.key] ?? null])); });
    }, { submitLabel: "Work it out" })));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/property/rent-vs-buy" }, "Rent or buy?"), ui.h("a", { class: "btn secondary", href: "#/debt/ratios" }, "Debt ratios"))));
}

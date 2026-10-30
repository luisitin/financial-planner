// modules/property/rent-vs-buy/view.js -- DOM only. Who comes out ahead after the years you choose, the
// year buying pulls ahead, the rent at which they are even, both households' money year by year as a
// chart, the first year's monthly costs side by side, and every figure in one form.
import { compute, simulate, DEFAULTS } from "./compute.js";
import { lineChart } from "../../retirement/charts.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.rb-root .rb-list { list-style: none; margin: 0; padding: 0; }
.rb-root .rb-list li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); }
.rb-root .rb-list li:last-child { border-bottom: 0; }
.rb-root .rb-list b { white-space: nowrap; }
.rb-root .rb-key { display: flex; gap: 14px; flex-wrap: wrap; font-size: var(--fs-xs); color: var(--muted); margin: 6px 0; }
.rb-root .rb-key i { display: inline-block; width: 18px; height: 0; border-top: 3px solid; vertical-align: middle; margin-right: 6px; }
.rb-root .rb-verdict { font-weight: 650; margin: 8px 0; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n / 10) * 10, cur);
  const d = compute(plan);
  const x = d.inputs;
  const root = ui.h("div", { class: "rb-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const saved = !!plan.whatIfs?.rentVsBuy;

  root.append(ui.h("section", { class: saved ? "card" : "card accent hero" },
    saved ? null : ui.h("h1", {}, "Rent or buy?"),
    ui.h("p", { class: saved ? "" : "lede" }, `A ${money(x.price)} home with ${Math.round(x.downShare * 100)}% down, against renting a similar one for ${money(x.rentMonthly)} a month and investing what buying would have cost up front (${money(d.upfront)}) and each year at ${(x.investReturn * 100).toFixed(1)}%.`),
    saved ? null : ui.h("p", { class: "muted small" }, "These are example figures: change them below to the home and the rent you are weighing.")));

  const e = d.atEnd;
  root.append(ui.card(`After ${e.year} years`, ui.row(
    ui.stat(e.winner === "buy" ? "Buying ahead by" : "Renting ahead by", money(Math.abs(e.ahead)), `buyer ${money(e.buyerWealth)}, renter ${money(e.renterWealth)}`),
    ui.stat("Buying pulls ahead", d.breakevenYear ? `after ${d.breakevenYear} year${d.breakevenYear === 1 ? "" : "s"}` : "not in 40 years", d.breakevenYear ? "if you stay that long" : "renting stays cheaper"),
  ), ui.h("p", { class: "rb-verdict" }, d.rentEven !== null ? `Over ${e.year} years the two are even at a rent of about ${money(d.rentEven)} a month: ${x.rentMonthly > d.rentEven ? "the rent is above it, so buying wins" : "the rent is below it, so renting wins"}.` : ""),
  ui.h("p", { class: "muted small" }, "Each side's money if the home were sold that year: the home's value less selling costs and what is still owed, plus the investments; the renter's investments. Dollars of each year, not adjusted for inflation.")));

  // both households' money, 40 years
  const long = simulate(x, 40).rows;
  root.append(ui.card("Year by year", ui.h("div", { class: "rb-key" }, ui.h("span", {}, ui.h("i", { style: { borderColor: "var(--accent)" } }), "buy"), ui.h("span", {}, ui.h("i", { style: { borderColor: "var(--muted)" } }), "rent and invest")),
    lineChart({ years: long.map((r) => r.year), series: [{ values: long.map((r) => r.renterWealth), color: "var(--muted)", width: 2 }, { values: long.map((r) => r.buyerWealth), color: "var(--accent)" }], marks: d.breakevenYear ? [{ year: d.breakevenYear, label: "even" }] : [], height: 180, label: "Money if sold, buying against renting, by year" })));

  // the first year, a month
  const r1 = d.rows[0];
  root.append(ui.card("The first year, a month", ui.h("ul", { class: "rb-list" },
    ui.h("li", {}, ui.h("span", {}, "Mortgage (interest and principal)"), ui.h("b", {}, money(d.monthlyPI))),
    ui.h("li", {}, ui.h("span", {}, "Property tax, insurance, upkeep" + (x.hoaMonthly ? ", HOA" : "")), ui.h("b", {}, money((r1.propertyTax + r1.insurance + r1.upkeep + r1.hoa) / 12))),
    x.itemize ? ui.h("li", {}, ui.h("span", {}, "Less the tax saved by itemizing"), ui.h("b", {}, `−${money(r1.taxSaving / 12)}`)) : null,
    ui.h("li", {}, ui.h("span", {}, ui.h("b", {}, "Buying")), ui.h("b", {}, money(d.firstYear.buyMonthly))),
    ui.h("li", {}, ui.h("span", {}, ui.h("b", {}, "Renting")), ui.h("b", {}, money(d.firstYear.rentMonthly)))),
    ui.h("p", { class: "muted small" }, `Of the mortgage, about ${money(r1.principal / 12)} a month is principal: it is not a cost, it builds the share of the home you own.`)));

  // the figures
  const s = plan.whatIfs?.rentVsBuy ?? {};
  const pctField = (key, label, help) => ({ key, label, type: "percent", min: 0, max: 100, help });
  const fields = [
    { key: "price", label: "Home price", type: "money", min: 0 },
    pctField("downShare", "Down payment", "20% avoids mortgage insurance"),
    pctField("rate", "Mortgage rate a year"),
    { key: "termYears", label: "Mortgage length (years)", type: "number", min: 5, max: 40, step: "1" },
    pctField("taxRate", "Property tax a year, share of value", "about 1.1% on average; your county lists it"),
    pctField("insuranceRate", "Home insurance a year, share of value"),
    pctField("maintenanceRate", "Upkeep a year, share of value", "1% is the usual rule"),
    { key: "hoaMonthly", label: "HOA a month", type: "money", min: 0 },
    pctField("buyCosts", "Closing costs to buy, share of price"),
    pctField("sellCosts", "Costs to sell, share of value", "agent and fees, about 6%"),
    pctField("appreciation", "Home value growth a year"),
    { key: "rentMonthly", label: "Rent for a similar home, a month", type: "money", min: 0 },
    pctField("rentGrowth", "Rent growth a year"),
    { key: "rentersInsurance", label: "Renters insurance a year", type: "money", min: 0 },
    pctField("investReturn", "Return on invested money a year", "empty: your plan's own mix, less tax along the way"),
    { key: "years", label: "Years you would stay", type: "number", min: 1, max: 40, step: "1" },
    { key: "itemize", label: "We itemize deductions (mortgage interest lowers our tax)", type: "checkbox", help: "most households take the standard deduction instead" },
    pctField("marginalRate", "Our top tax rate", "for the itemized saving"),
  ];
  const values = Object.fromEntries(fields.map((f) => [f.key, s[f.key] ?? (f.key === "investReturn" ? null : DEFAULTS[f.key])]));
  root.append(ui.h("details", { class: "card fold fold-card", open: saved ? null : true }, ui.h("summary", {}, ui.h("h2", {}, "The figures"), ui.h("span", { class: "fold-status" }, `${money(x.price)}, ${money(x.rentMonthly)} rent`), ui.h("span", { class: "fold-chev" }, "›")),
    ui.form(fields, values, (v) => {
      pending = "Saved.";
      store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.rentVsBuy = Object.fromEntries(fields.map((f) => [f.key, f.type === "checkbox" ? !!v[f.key] : v[f.key] ?? null])); });
    }, { submitLabel: "Compare" })));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/goals/house" }, "Saving for a home"), ui.h("a", { class: "btn secondary", href: "#/debt/mortgage" }, "Mortgage"))));
}

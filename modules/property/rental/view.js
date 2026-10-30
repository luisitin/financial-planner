// modules/property/rental/view.js -- DOM only. Each rental from rent to cash in hand: the headline figures,
// the year line by line, the checks a lender makes, the tax with depreciation, the whole return; editing in a
// fold; adding another behind an outlined button.
import { compute, DEFAULTS, DSCR_MIN, RECOVERY_YEARS } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.rn-root .rn-lines { list-style: none; margin: 0; padding: 0; }
.rn-root .rn-lines li { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid var(--line); }
.rn-root .rn-lines li:last-child { border-bottom: 0; }
.rn-root .rn-lines li span:last-child { white-space: nowrap; font-variant-numeric: tabular-nums; }
.rn-root .rn-lines .rn-sub span:first-child { padding-left: 14px; color: var(--text-2); }
.rn-root .rn-lines .rn-tot { font-weight: 700; }
.rn-root .rn-ok { color: var(--ok); } .rn-root .rn-warn { color: var(--warn); } .rn-root .rn-bad { color: var(--bad); }
.rn-root .rn-d { color: var(--text-2); font-size: var(--fs-sm); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const signed = (n) => (n < -0.5 ? `−${money(-n)}` : money(n));
  const pct = (x, dp = 1) => `${(x * 100).toFixed(dp).replace(/\.0$/, "")}%`;
  const today = fmt.today();
  const d = compute(plan, { today });
  const root = ui.h("div", { class: "rn-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Rental property"),
      ui.h("p", { class: "lede" }, "What a rental really earns: rent less empty months and running costs, less the loan, less tax, and what it adds to your wealth as the loan shrinks and the value grows."),
      ui.h("p", { class: "muted small" }, "Add the property below: its value, the rent and the main costs are enough to start.")));
    root.append(editor(null, true));
    return;
  }

  if (d.rentals.length > 1) root.append(ui.card(null, ui.row(
    ui.stat("Rent a year", money(d.totals.rent), `${d.rentals.length} properties`),
    ui.stat("Cash flow a year", signed(d.totals.cashFlow), `${signed(d.totals.afterTax)} after tax`),
    ui.stat("Equity", money(d.totals.equity), `in ${money(d.totals.value)} of property`),
  )));

  for (const r of d.rentals) {
    const src = (plan.property ?? []).find((x) => x.id === r.id) ?? {};
    root.append(ui.card(r.name, ui.row(
      ui.stat("Cash flow a year", signed(r.cashFlow), `${signed(r.cashFlow / 12)} a month, before tax`),
      ui.stat("Cap rate", r.capRate === null ? "—" : pct(r.capRate), "income after costs ÷ value"),
      r.cashOnCash !== null ? ui.stat("Cash-on-cash", pct(r.cashOnCash), `cash flow ÷ ${money(r.cashIn)} put in`) : null,
    )));
    const lines = [
      ["Rent", r.rent], [`Empty months (${pct(src.vacancy ?? DEFAULTS.vacancy, 0)})`, -r.vacancy, true],
      ...r.costs.map((c) => [c.label, -c.amount, true]),
      ["Income after running costs", r.noi, false, true],
      r.debtService ? ["Loan payments", -r.debtService, true] : null,
      ["Cash flow", r.cashFlow, false, true],
      [r.tax >= 0 ? "Tax on it" : "Tax it saves", -r.tax, true],
      ["After tax", r.afterTax, false, true],
    ].filter(Boolean);
    root.append(ui.card(`The year, line by line`, ui.h("ul", { class: "rn-lines" }, lines.map(([label, amount, sub, tot]) => ui.h("li", { class: tot ? "rn-tot" : sub ? "rn-sub" : null }, ui.h("span", {}, label), ui.h("span", {}, signed(amount)))))));

    const checks = [];
    if (r.dscr !== null) checks.push(ui.h("li", {}, ui.h("span", { class: r.dscr >= DSCR_MIN ? "rn-ok" : r.dscr >= 1 ? "rn-warn" : "rn-bad" }, `Income covers the loan ${r.dscr.toFixed(2)} times. `), `Lenders usually want ${DSCR_MIN.toFixed(2)} or more${r.dscr < 1 ? "; below 1 the rent does not pay the loan" : ""}.`));
    if (r.breakEven !== null) checks.push(ui.h("li", {}, ui.h("span", { class: r.breakEven <= 0.85 ? "rn-ok" : r.breakEven <= 1 ? "rn-warn" : "rn-bad" }, `It breaks even rented ${pct(r.breakEven, 0)} of the year. `), r.breakEven < 1 ? `It can stand about ${((1 - r.breakEven) * 12).toFixed(1)} empty months a year before costing you money.` : "Even full, the rent does not cover costs and the loan."));
    if (r.onePercent !== null) checks.push(ui.h("li", {}, `Monthly rent is ${pct(r.onePercent, 2)} of the price paid. `, ui.h("span", { class: "rn-d" }, "Investors' quick screen asks for about 1%; few homes in costly areas reach it.")));
    root.append(ui.card("The checks a lender makes", ui.h("ul", {}, checks)));

    root.append(ui.card("Tax", ui.h("p", {}, `Depreciation: the building (${money(r.basis)}, the price less the land) is written off over ${RECOVERY_YEARS} years: ${money(r.depreciation)} this year. It lowers the tax without costing cash.`),
      ui.h("p", {}, r.taxable >= 0 ? `Taxable rent after costs, interest (${money(r.interest)}) and depreciation: ${money(r.taxable)}, about ${money(r.tax)} of tax at ${pct(d.rates.marginal + d.rates.state, 0)}.`
        : `A tax loss of ${money(-r.taxable)} after costs, interest (${money(r.interest)}) and depreciation. ${r.lossUsable > 0 ? `${money(r.lossUsable)} of it lowers your other tax this year (about ${money(-r.tax)} saved)` : "None of it lowers your other tax this year: the allowance is gone at your income"}${r.lossCarried > 0 ? `; ${money(r.lossCarried)} waits for a year with rental profit, or the sale` : ""}.`),
      ui.h("p", { class: "rn-d" }, "When you sell, the depreciation taken is taxed back at up to 25%. If Income also lists this rent, the federal estimate already counts it once.")));

    root.append(ui.card("What it adds to your wealth", ui.h("p", {}, `${signed(r.cashFlow)} of cash, ${money(r.principal)} of loan paid down and about ${money(r.growth)} of growth in value (${pct(src.appreciation ?? DEFAULTS.appreciation)} a year): ${money(r.totalReturn)}${r.returnOnEquity !== null ? `, ${pct(r.returnOnEquity)} on your ${money(r.equity)} of equity` : ""}.`)));
    root.append(editor(src, false));
  }
  root.append(editor(null, false));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/balance/net-worth" }, "Net worth"), ui.h("a", { class: "btn secondary", href: "#/taxes/federal" }, "Federal tax"))));

  // add or edit one rental
  function editor(r, open) {
    const mortgages = (plan.accounts ?? []).filter((a) => a.type === "mortgage");
    const pctOf = (v) => (v === null || v === undefined || v === "" ? "" : v);
    const values = r ? { ...r, loanAccountId: r.loanAccountId ?? "" } : { vacancy: DEFAULTS.vacancy, maintenance: DEFAULTS.maintenance, landShare: DEFAULTS.landShare, appreciation: DEFAULTS.appreciation, loanAccountId: "" };
    const form = ui.form([
      { key: "name", label: "Name", type: "text", placeholder: "e.g. Duplex on Elm" },
      { key: "value", label: "What it is worth today", type: "money", min: 0 },
      { key: "purchasePrice", label: "What you paid", type: "money", min: 0 },
      { key: "purchaseDate", label: "When it was first rented out", type: "date", help: "depreciation starts then" },
      { key: "rentMonthly", label: "Rent a month", type: "money", min: 0 },
      { key: "vacancy", label: "Allowance for empty months", type: "percent", min: 0, max: 50 },
      { key: "propertyTax", label: "Property tax a year", type: "money", min: 0 },
      { key: "insurance", label: "Insurance a year", type: "money", min: 0 },
      { key: "hoaMonthly", label: "Association dues a month", type: "money", min: 0 },
      { key: "maintenance", label: "Repairs and upkeep, a year, as a share of the value", type: "percent", min: 0, max: 10 },
      { key: "management", label: "Property manager, as a share of rent", type: "percent", min: 0, max: 20 },
      { key: "utilitiesMonthly", label: "Utilities you pay, a month", type: "money", min: 0 },
      { key: "otherMonthly", label: "Other costs a month", type: "money", min: 0 },
      { key: "cashIn", label: "Cash you put in (down payment, closing, repairs)", type: "money", min: 0 },
      { key: "loanAccountId", label: "Its mortgage", type: "select", options: [{ value: "", label: mortgages.length ? "Not one of my accounts (type it below)" : "Type it below" }, ...mortgages.map((a) => ({ value: a.id, label: a.name }))] },
      { key: "loanBalance", label: "Loan owed", type: "money", min: 0 },
      { key: "loanRate", label: "Loan rate", type: "percent", min: 0, max: 20 },
      { key: "loanPayment", label: "Loan payment a month (principal and interest)", type: "money", min: 0 },
      { key: "landShare", label: "Land's share of the price (not depreciated)", type: "percent", min: 0, max: 90, help: "the county's assessment splits land and building" },
      { key: "appreciation", label: "Value grows each year", type: "percent", min: -10, max: 15 },
    ], { ...values, vacancy: pctOf(values.vacancy), maintenance: pctOf(values.maintenance), management: pctOf(values.management) }, (v) => {
      if (!(v.value > 0) || !(v.rentMonthly > 0)) { form.prepend(ui.notice("error", "Type what it is worth and the monthly rent first.")); return; }
      pending = r ? "Saved." : `${v.name || "Rental"} added.`;
      store.update((p) => {
        p.property = p.property ?? [];
        const item = { ...(r ?? { id: ui.uid(), kind: "rental" }), ...v, name: String(v.name ?? "").trim() };
        p.property = r ? p.property.map((x) => (x.id === r.id ? item : x)) : [...p.property, item];
      });
    }, { submitLabel: r ? "Save" : "Add rental" });
    const remove = r ? ui.row(ui.button("Remove this rental", () => {
      if (!ui.confirm(`Remove ${r.name || "this rental"}?`)) return;
      pending = `${r.name || "Rental"} removed.`;
      store.update((p) => { p.property = (p.property ?? []).filter((x) => x.id !== r.id); });
    }, { class: "secondary" })) : null;
    const title = r ? `Change ${r.name || "this rental"}` : d.ready ? "+ Add another rental" : "Add a rental";
    return ui.h("details", { class: "card fold fold-card", open: open ? true : null }, ui.h("summary", {}, ui.h("h2", {}, title), ui.h("span", { class: "fold-chev" }, "›")), form, remove);
  }
}

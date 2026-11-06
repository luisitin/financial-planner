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

  const P = d.passive, many = d.rentals.length > 1;
  const niitLine = d.rates.niitLine;
  const R = d.rule, shrink = `the allowance starts at ${money(R.max)}, shrinks by 50 cents for each dollar over ${money(R.from)} and ends at ${money(R.to)}`;
  const niitText = d.tax.niit > 0.5 ? ` That includes ${money(d.tax.niit)} of the 3.8% extra tax on investment income: rent counts once your income passes ${money(niitLine)}.` : "";
  if (many) root.append(ui.card(null, ui.row(
    ui.stat("Rent a year", money(d.totals.rent), `${d.rentals.length} properties`),
    ui.stat("Cash flow a year", signed(d.totals.cashFlow), `${signed(d.totals.afterTax)} after tax`),
    ui.stat("Equity", money(d.totals.equity), `in ${money(d.totals.value)} of property`),
  ), ui.h("p", {}, `${Math.abs(d.tax.total) < 0.5 ? `Together your rentals do not change this year's tax${P.losses > 0.5 && P.profits > 0.5 ? ": the losses cancel the profits" : ""}` : `Together your rentals ${d.tax.total > 0 ? "add" : "take"} about ${money(Math.abs(d.tax.total))} ${d.tax.total > 0 ? "to" : "off"} this year's tax${P.losses > 0.5 && P.profits > 0.5 ? `, after the profitable ones absorb the others' losses` : ""}`}${P.suspended > 0.5 ? `; ${money(P.suspended)} of loss waits for a later year` : ""}.${niitText}`)));

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
      [r.tax >= -0.5 ? "Tax on it" : "Tax it saves", Math.abs(r.tax) < 0.5 ? 0 : -r.tax, true],
      ["After tax", r.afterTax, false, true],
    ].filter(Boolean);
    root.append(ui.card(`The year, line by line`, ui.h("ul", { class: "rn-lines" }, lines.map(([label, amount, sub, tot]) => ui.h("li", { class: tot ? "rn-tot" : sub ? "rn-sub" : null }, ui.h("span", {}, label), ui.h("span", {}, signed(amount)))))));

    const checks = [];
    if (r.dscr !== null) checks.push(ui.h("li", {}, ui.h("span", { class: r.dscr >= DSCR_MIN ? "rn-ok" : r.dscr >= 1 ? "rn-warn" : "rn-bad" }, `Income covers the loan ${r.dscr.toFixed(2)} times. `), `Lenders usually want ${DSCR_MIN.toFixed(2)} or more${r.dscr < 1 ? "; below 1 the rent does not pay the loan" : ""}.`));
    if (r.breakEven !== null) checks.push(ui.h("li", {}, ui.h("span", { class: r.breakEven <= 0.85 ? "rn-ok" : r.breakEven <= 1 ? "rn-warn" : "rn-bad" }, `It breaks even rented ${pct(r.breakEven, 0)} of the year. `), r.breakEven < 1 ? `It can stand about ${((1 - r.breakEven) * 12).toFixed(1)} empty months a year before costing you money.` : "Even full, the rent does not cover costs and the loan."));
    if (r.onePercent !== null) checks.push(ui.h("li", {}, `Monthly rent is ${pct(r.onePercent, 2)} of the price paid. `, ui.h("span", { class: "rn-d" }, "Investors' quick screen asks for about 1%; few homes in costly areas reach it.")));
    root.append(ui.card("The checks a lender makes", ui.h("ul", {}, checks)));

    const lossText = () => {
      const intro = `A tax loss of ${money(-r.taxable)} after costs, interest (${money(r.interest)}) and depreciation.`;
      const saving = -r.tax > 0.5 ? `, saving about ${money(-r.tax)}` : P.profits > 0.5 ? ", against your other rentals' profit" : "";
      if (r.lossUsable > 0.5 && r.lossCarried <= 0.5) return `${intro} All of it counts this year${P.profits > 0.5 && P.againstOther > 0.5 ? `: your other rentals' profit absorbs part of it and the rest lowers your other income` : P.profits > 0.5 ? `: your other rentals' profit absorbs it` : ": it lowers your other income"}${-r.tax > 0.5 ? `, saving about ${money(-r.tax)}` : ""}.`;
      if (r.lossUsable > 0.5) return `${intro} ${money(r.lossUsable)} of it counts this year${saving}${many ? ": its share of what your rentals' profits and the allowance can take, split by the size of each rental's loss" : ""}. ${money(r.lossCarried)} waits for a year with rental profit, or the sale. ${d.lossRoom > 0.5 ? `At your income up to ${money(d.lossRoom)} of rental losses can come off other income this year (${shrink}${d.rates.separate ? " filing separately" : ""}).` : d.separateTogether ? "Filing separately while living with your spouse, none of it can come off other income this year (if you lived apart all year, tick that on the Federal estimate)." : `At your income the allowance that lets rental losses come off other income is gone (it ends at ${money(R.to)}${d.rates.separate ? " filing separately" : ""}).`}`;
      if (d.separateTogether) return `${intro} You file separately and lived with your spouse during the year, so a rental loss cannot lower your other income this year${P.profits > 0.5 ? ` (only your rentals' profit can absorb it)` : ""}: ${money(r.lossCarried)} waits for a year with rental profit, or the sale. If you lived apart all year, tick that on the Federal estimate.`;
      return `${intro} At your income (${money(d.rates.magi)}${d.rates.onReturn ? ` on ${d.rates.onReturn}'s return` : ""}) the allowance that lets rental losses come off other income is gone: ${shrink}${d.rates.separate ? " filing separately" : ""}. ${money(r.lossCarried)} waits for a year with rental profit, or the sale.`;
    };
    root.append(ui.card("Tax", ui.h("p", {}, `Depreciation: the building (${money(r.basis)}, the price less the land) is written off over ${RECOVERY_YEARS} years: ${money(r.depreciation)} this year. It lowers the tax without costing cash.`),
      ui.h("p", {}, r.taxable >= 0 ? `Taxable rent after costs, interest (${money(r.interest)}) and depreciation: ${money(r.taxable)}. ${many ? (r.tax > 0.5 ? `On its own it adds about ${money(r.tax)} to this year's tax${P.losses > 0.5 ? `; your other rentals' losses are counted on their own lines${Math.abs(d.tax.total) < 0.5 ? ", and together they cancel" : ""}` : ""}.` : "It adds no tax this year.") : `Added to your other income it raises this year's tax by about ${money(r.tax)}.${niitText}`}` : lossText()),
      ui.h("p", { class: "rn-d" }, `When you sell, the depreciation taken is taxed back at up to 25%, and any loss still waiting can then be used. The federal estimate counts your rentals as they are worked here, after costs, interest and depreciation${d.incomeRent > 0 ? `, in place of the ${money(d.incomeRent)} of rent the Income page lists` : ""}.`)));

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

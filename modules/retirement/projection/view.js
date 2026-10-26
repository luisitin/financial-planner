// modules/retirement/projection/view.js -- DOM only. The verdict, the money over time, what the
// plan assumes, and the settings that every retirement page shares (folded, saved with a green line).
import { compute } from "./compute.js";
import { STRATEGIES } from "../../../core/math/retirement.js";
import { lineChart } from "../charts.js";

let pending = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const rt = plan.retirement ?? {};
  const money = (n) => fmt.money(n, cur);

  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Will the money last?"),
      ui.h("p", { class: "lede" }, "This page runs your plan year by year to the end: what you have, what you add, what Social Security and pensions bring in, what you spend, and what is left each year. It needs a few things first:"),
      ui.h("ul", {}, d.missing.map((m) => ui.h("li", {}, m))),
      ui.row(ui.h("a", { class: "btn", href: "#/household/people" }, "People"), ui.h("a", { class: "btn secondary", href: "#/balance/net-worth" }, "Accounts"), ui.h("a", { class: "btn secondary", href: "#/cashflow/expenses" }, "Expenses")),
    ));
    root.append(settingsCard(ctx, d));
    return;
  }
  const verdictText = { "on track": `On track. The plan carries ${money(d.affordable)} a year of spending in today's dollars; you plan on ${money(d.spendingYearly)}.`, tight: `Tight. The plan carries about ${money(d.affordable)} a year; you plan on ${money(d.spendingYearly)}. Small changes matter here.`, short: `Short. At ${money(d.spendingYearly)} a year the money runs out in ${d.shortYear} (age ${d.shortAge}). The plan carries about ${money(d.affordable)} a year.` }[d.verdict];
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.verdict === "on track" ? "The money lasts" : d.verdict === "tight" ? "It lasts, just" : `Runs out in ${d.shortYear}`),
    ui.h("p", { class: "lede" }, verdictText),
    ui.h("p", { class: "muted small" }, `Retirement starts in ${d.atRetirement.year} (${d.people[0].name} at ${d.atRetirement.age}); the plan runs to ${d.atEnd.year}. Expected returns, ${STRATEGIES[d.strategy].toLowerCase()}.${d.notes.length ? " " + d.notes.join(" ") : ""}`),
  ));
  root.append(ui.card(null, ui.row(
    ui.stat("At retirement", money(d.atRetirement.totalReal), `${d.atRetirement.year}, in today's dollars`),
    ui.stat("Spending it can carry", money(d.affordable), "a year, today's dollars, to the end"),
    ui.stat("Guaranteed income", d.coverage !== null ? fmt.pct(d.coverage, 0) : "-", "of the first retirement year's spending: Social Security, pensions, a partner's pay"),
    ui.stat(`Left in ${d.atEnd.year}`, money(Math.max(0, d.atEnd.totalReal)), d.atEnd.totalReal > 0 ? "today's dollars" : "nothing"),
  )));
  const years = d.rows.map((r) => r.year);
  root.append(ui.card("Money over the years, in today's dollars",
    lineChart({ years, series: [{ values: d.rows.map((r) => r.totalReal) }], marks: [{ year: d.atRetirement.year, label: "retire" }], label: "balance over the years" }),
    ui.h("p", { class: "muted small" }, "One line, expected returns. The Monte Carlo and History pages show the range around it."),
  ));
  root.append(ui.card("What goes into this",
    ui.h("ul", { class: "records" }, [
      ["People", d.people.map((p) => `${p.name}: retires at ${p.retireAge}, plan to ${p.endAge}`).join("; ")],
      ["Retirement money today", `${money(d.inputs.balances.cash + d.inputs.balances.taxable + d.inputs.balances.deferred + d.inputs.balances.free)}: ${money(d.inputs.balances.cash)} cash, ${money(d.inputs.balances.taxable)} taxable, ${money(d.inputs.balances.deferred)} pre-tax, ${money(d.inputs.balances.free)} tax-free`],
      ["Added each year until retirement", d.inputs.contributions.length ? `${money(d.inputs.contributions.reduce((s, c) => s + c.yearly, 0))}, rising with pay (Contributions page)` : "nothing entered (Contributions page)"],
      ["Guaranteed income", d.inputs.incomes.length ? d.inputs.incomes.map((i) => `${i.name}: ${money(i.yearly)} a year from ${i.startAge}`).join("; ") : "none entered (Social Security page)"],
      ["Spending in retirement", `${money(d.spendingYearly)} a year in today's dollars${d.spendingSource === "expenses" ? " (today's expenses)" : ""}`],
      ["Growth and inflation", `${fmt.pct(d.inputs.returns.stocks, 1)} stocks, ${fmt.pct(d.inputs.returns.bonds, 1)} bonds, ${fmt.pct(d.inputs.rates.inflation, 1)} inflation (Assumptions page); ${Math.round(d.inputs.rates.stocksNow * 100)}% in stocks now, ${Math.round(d.inputs.rates.stocksRetired * 100)}% in retirement`],
      ["Taxes", d.inputs.tax?.mode === "brackets" ? `the federal brackets on each year's income, filing ${d.inputs.tax.filingStatus.replace(/_/g, " ").replace("married joint", "jointly").replace("married separate", "separately")} (Taxes pages); withdrawals ${d.orderLabel.toLowerCase()}${d.inputs.rothConversion ? `; Roth conversions fill the ${fmt.pct(d.inputs.rothConversion.fillRate, 0)} bracket before required withdrawals` : ""}; required withdrawals from ${d.inputs.rmd.startAge}` : `${fmt.pct(d.inputs.rates.taxRate, 0)} on money taken from pre-tax accounts; withdrawals ${d.orderLabel.toLowerCase()}; required withdrawals from ${d.inputs.rmd.startAge}`],
    ].map(([k, v]) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, k)), ui.h("div", { class: "rec-sub" }, v)))),
  ));
  root.append(settingsCard(ctx, d));
}

function settingsCard(ctx, d) {
  const { ui, fmt, store, plan } = ctx;
  const rt = plan.retirement ?? {};
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const FIELDS = [
    { key: "spendingMonthly", label: "Spending in retirement, a month", type: "money", min: 0, help: "today's dollars; blank uses today's expenses" },
    { key: "stocksNow", label: "Share in stocks now", type: "percent", min: 0, max: 100, help: "the rest counts as bonds" },
    { key: "stocksRetired", label: "Share in stocks once retired", type: "percent", min: 0, max: 100 },
    { key: "taxMode", label: "How tax is worked out", type: "select", options: [{ value: "flat", label: "A flat rate on pre-tax withdrawals (quick)" }, { value: "brackets", label: "The federal brackets on each year's income" }], help: "the brackets use the filing status from the People page and the rules on the Taxes pages" },
    { key: "taxRate", label: "Flat rate on money taken from pre-tax accounts", type: "percent", min: 0, max: 60, help: "used by the flat setting only" },
    { key: "strategy", label: "How much to take out each year", type: "select", options: Object.entries(STRATEGIES).map(([value, label]) => ({ value, label })) },
    { key: "withdrawalRate", label: "Starting withdrawal rate", type: "percent", min: 1, max: 15, help: "for the percentage and guardrail methods; 4 is the classic figure" },
  ];
  const values = { spendingMonthly: rt.spendingMonthly ?? null, stocksNow: rt.stocksNow ?? 0.7, stocksRetired: rt.stocksRetired ?? 0.5, taxMode: rt.taxMode ?? "flat", taxRate: rt.taxRate ?? 0.15, strategy: rt.strategy ?? "fixed-real", withdrawalRate: rt.withdrawalRate ?? 0.04 };
  const form = ui.form(FIELDS, values, (v) => {
    pending = "Retirement settings saved.";
    store.update((p) => { p.retirement = { ...(p.retirement ?? {}), spendingMonthly: v.spendingMonthly ?? null, stocksNow: v.stocksNow ?? 0.7, stocksRetired: v.stocksRetired ?? 0.5, taxMode: v.taxMode === "brackets" ? "brackets" : "flat", taxRate: v.taxRate ?? 0.15, strategy: v.strategy, withdrawalRate: v.withdrawalRate ?? 0.04 }; });
  }, { submitLabel: "Save settings" });
  const details = ui.h("details", { class: "card fold fold-card", open: d.ready ? null : true },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Retirement settings"), ui.h("span", { class: "fold-status" }, rt.spendingMonthly ? `${fmt.money(rt.spendingMonthly, plan.meta.currency)} a month` : "spending = today's expenses"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" }, ui.h("p", { class: "muted small" }, "Shared by every retirement page. Ages and how long the plan runs come from the People page; growth and inflation from Assumptions."), out, form));
  return details;
}

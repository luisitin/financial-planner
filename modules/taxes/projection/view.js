// modules/taxes/projection/view.js -- DOM only. Lifetime tax and the worst year first, the tax
// line over the years, then the year-by-year table (a list on the phone).
import { compute } from "./compute.js";
import { lineChart } from "../../retirement/charts.js";
import { statusLabel } from "../../../core/math/tax.js";

const state = { real: true };

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today(), real: state.real });
  const money = (n) => fmt.money(n, cur);
  const redraw = () => { root.innerHTML = ""; render(root, ctx); };
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Tax, year by year"), ui.h("p", { class: "lede" }, "Federal tax in every year of the retirement plan, through the real brackets. It needs the same things as the Projection page:"), ui.h("ul", {}, d.missing.map((m) => ui.h("li", {}, m))), ui.row(ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Set up the projection"))));
    return;
  }
  const first = d.rows[0], last = d.rows[d.rows.length - 1];
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, `About ${money(d.totals.taxes)} of federal tax over retirement`),
    ui.h("p", { class: "lede" }, `${d.rows.length} years from ${first.year} to ${last.year}, ${d.real ? "in today's dollars" : "in the dollars of each year"}: ${money(d.average)} a year on average, filing ${statusLabel(d.filingStatus).toLowerCase()}. ${d.peak ? `The biggest year is ${d.peak.year} at ${money(d.peak.taxes)}, driven by ${d.peak.why}.` : ""} ${d.zeroYears ? `${d.zeroYears} year${d.zeroYears === 1 ? "" : "s"} owe nothing at all.` : ""}${d.totals.taxableSocialSecurity > 0 ? ` ${fmt.pct(d.totals.taxableSocialSecurity / d.totals.socialSecurity, 0)} of Social Security ends up taxed.` : ""}${!d.success ? ` The money runs out in ${d.failYear}: the years after it show no tax because there is nothing left to tax.` : ""}`),
    ui.h("p", { class: "muted small" }, "Brackets and deductions inflate with the plan's inflation rate; the Social Security thresholds do not, as in the law, so more of the benefit gets taxed over time. State tax is not included."),
  ));
  for (const n of d.notes) root.append(ui.notice("info", n));
  root.append(ui.card(null, ui.row(
    ui.stat("Over the plan", money(d.totals.taxes), d.real ? "today's dollars" : "nominal"),
    ui.stat("A year", money(d.average), "on average"),
    ui.stat("Flat setting would say", money(d.flatTaxes), `${Math.round((plan.retirement?.taxRate ?? 0.15) * 100)}% on pre-tax withdrawals only`),
    d.byBracket.length ? ui.stat("Years by bracket", d.byBracket.map((x) => `${x.years} in ${fmt.pct(x.rate, 0)}`).join(", "), "where each year ends") : null,
  )));
  const years = d.rows.map((r) => r.year);
  root.append(ui.card("Tax each year",
    lineChart({ years, series: [{ values: d.rows.map((r) => r.taxes) }], marks: d.peak ? [{ year: d.peak.year, label: "peak" }] : [], label: "federal tax by year" }),
    ui.h("div", { class: "form" }, ui.field("Show amounts in", ui.select([{ value: "real", label: "today's dollars" }, { value: "nominal", label: "the dollars of each year" }], state.real ? "real" : "nominal", { "aria-label": "Dollars", onChange: (e) => { state.real = e.target.value === "real"; redraw(); } }))),
  ));
  root.append(ui.card("Year by year",
    ui.h("div", { class: "only-wide" }, ui.table([
      { key: "year", label: "Year" }, { key: "ages", label: d.people.length > 1 ? "Ages" : "Age", render: (r) => r.ages.join(" / ") },
      { key: "ordinary", label: "Ordinary income", align: "right", render: (r) => money(r.ordinary) },
      { key: "socialSecurity", label: "Social Security", align: "right", render: (r) => r.socialSecurity > 0 ? `${money(r.socialSecurity)} (${money(r.taxableSocialSecurity)} taxed)` : "-" },
      { key: "qualified", label: "Gains, dividends", align: "right", render: (r) => r.qualified > 0 ? money(r.qualified) : "-" },
      { key: "taxableIncome", label: "Taxable", align: "right", render: (r) => money(r.taxableIncome) },
      { key: "bracketRate", label: "Bracket", align: "right", render: (r) => r.bracketRate !== null ? fmt.pct(r.bracketRate, 0) : "-" },
      { key: "taxes", label: "Tax", align: "right", render: (r) => money(r.taxes) },
    ], d.rows)),
    ui.h("ul", { class: "records only-narrow" }, d.rows.map((r) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${r.year} · ${d.people.length > 1 ? "ages" : "age"} ${r.ages.join(" / ")}`), ui.h("span", { class: "rec-value" }, money(r.taxes))),
      ui.h("div", { class: "rec-sub" }, `${money(r.ordinary)} ordinary${r.socialSecurity > 0 ? ` · ${money(r.socialSecurity)} Social Security (${money(r.taxableSocialSecurity)} taxed)` : ""}${r.qualified > 0 ? ` · ${money(r.qualified)} gains and dividends` : ""} · ${money(r.taxableIncome)} taxable${r.bracketRate !== null ? ` · ${fmt.pct(r.bracketRate, 0)} bracket` : ""}${r.conversion > 0 ? ` · ${money(r.conversion)} converted` : ""}${r.rmd > 0 ? ` · ${money(r.rmd)} required` : ""}`)))),
  ));
}

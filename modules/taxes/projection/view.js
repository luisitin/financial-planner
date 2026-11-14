// modules/taxes/projection/view.js -- DOM only. Lifetime tax and the worst year first, the tax
// line over the years, then the year-by-year table (a list on the phone: six years, then "N more years"). Simple first
// (core/ui/more.js, docs/OPTIONAL.md): how the tax is worked out, the state's rules among it (gap design #40), is one
// quiet part; "More on this" links the pages that go deeper.
import { needItem } from "../../../core/words.js";
import { part, rest, links } from "../../../core/ui/more.js";
import { compute, stateLine, stateNames, stateNameOf } from "./compute.js";
import { lineChart } from "../../retirement/charts.js";
import { statusLabel } from "../../../core/math/tax.js";

const state = { real: true };

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today(), real: state.real });
  const money = (n) => fmt.money(n, cur);
  const redraw = () => { root.innerHTML = ""; render(root, ctx); };
  if (!d.ready && !d.noYears) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Tax, year by year"), ui.h("p", { class: "lede" }, "Federal tax in every year of your retirement plan, worked out with the actual tax brackets. It needs the same answers as the Will the money last? page:"), ui.h("ul", {}, d.missing.map((m) => ui.h("li", {}, needItem(m)))), ui.row(ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Open Will the money last?"))));
    return;
  }
  // no retirement year inside the plan (it ends first, or everyone is past its end age): say why, not "failed to render"
  // (Review 2026-11-06)
  if (!d.rows.length) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Tax, year by year"),
      ui.h("p", { class: "lede" }, `There are no retirement years to tax: ${d.noYears.why}. Check ${d.noYears.check} on the People page, and this page shows the federal tax in each year after work stops.`),
      ui.row(ui.h("a", { class: "btn", href: "#/household/people" }, "People"))));
    return;
  }
  const first = d.rows[0], last = d.rows[d.rows.length - 1];
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, `About ${money(d.totals.taxes)} of federal tax over retirement`),
    // one retirement year: "1 year, 2026", with no average and no biggest year (Review 2026-11-06, verifier: "1 years from 2026
    // to 2026 ... $813 a year on average ... The biggest year is 2026", as the Tax report read before this round)
    ui.h("p", { class: "lede" }, `${d.rows.length === 1 ? `1 year, ${first.year}` : `${d.rows.length} years from ${first.year} to ${last.year}`}, ${d.real ? "in today's dollars" : "in each year's dollars"}${d.rows.length === 1 ? "" : `: ${money(d.average)} a year on average`}, filing ${statusLabel(d.filingStatus).toLowerCase()}. ${d.peak && d.rows.length > 1 ? `The biggest year is ${d.peak.year} at ${money(d.peak.taxes)}, driven by ${d.peak.why}.` : ""} ${d.zeroYears ? `${d.zeroYears} year${d.zeroYears === 1 ? "" : "s"} owe nothing at all.` : ""}${d.totals.taxableSocialSecurity > 0 ? ` ${fmt.pct(d.totals.taxableSocialSecurity / d.totals.socialSecurity, 0)} of Social Security ends up taxed.` : ""}${!d.success ? ` The money runs out in ${d.failYear}: the years after it show no tax because there is nothing left to tax.` : ""}`),
    ui.h("p", { class: "muted small" }, `Brackets and deductions rise with the plan's inflation rate. By law the Social Security thresholds do not, so more of the benefit gets taxed over time. ${stateLine(d.state, money, d.rows.length === 1, d.state ? null : stateNameOf(plan.household?.state))}`),
  ));
  for (const n of d.notes) root.append(ui.notice("info", n));
  // the state's tax as a second line on the chart and a tile of its own when there is some (gap #40); the tile takes the place
  // of "A year" (the hero already gives the yearly average), so the page keeps four tiles
  const st = d.state && !d.state.none && d.state.total >= 1 ? d.state : null;
  root.append(ui.card(null, ui.row(
    ui.stat(st ? "Federal tax" : "Over the plan", money(d.totals.taxes), st ? `over the plan, ${d.real ? "today's dollars" : "nominal"}` : d.real ? "today's dollars" : "nominal"),
    st ? ui.stat(`${st.name} tax`, money(st.total), `over the plan, ${money(st.average)} a year`) : ui.stat("A year", money(d.average), "on average"),
    ui.stat("Flat setting would say", money(d.flatTaxes), `${Math.round((plan.retirement?.taxRate ?? 0.15) * 100)}% on pre-tax withdrawals only`),
    d.byBracket.length ? ui.stat("Years by bracket", d.byBracket.map((x, i) => `${x.years}${i === 0 ? ` year${x.years === 1 ? "" : "s"}` : ""} in the ${fmt.pct(x.rate, 0)} bracket`).join(", "), "the top bracket each year reaches") : null,
  )));
  const years = d.rows.map((r) => r.year);
  // a key under the chart for the two lines: a short sample of each beside its name (inline, scoped to these two spans)
  const sample = (style) => ui.h("span", { "aria-hidden": "true", style: `display:inline-block; width:24px; margin-right:6px; vertical-align:middle; border-top:2px ${style}` });
  root.append(ui.card("Tax each year",
    lineChart({ years, series: [{ values: d.rows.map((r) => r.taxes) }, ...(st ? [{ values: d.rows.map((r) => r.state), color: "var(--muted)", dash: "5 4" }] : [])], marks: d.peak ? [{ year: d.peak.year, label: "peak" }] : [], label: st ? `federal and ${st.name} tax by year` : "federal tax by year" }),
    st ? ui.h("p", { class: "muted small" }, ui.h("span", { style: "margin-right:16px; white-space:nowrap" }, sample("solid var(--accent)"), "Federal tax"), " ", ui.h("span", { style: "white-space:nowrap" }, sample("dashed var(--muted)"), `${st.name} income tax`)) : null,
    ui.h("div", { class: "form" }, ui.field("Show amounts in", ui.select([{ value: "real", label: "today's dollars" }, { value: "nominal", label: "each year's dollars" }], state.real ? "real" : "nominal", { "aria-label": "Dollars", onChange: (e) => { state.real = e.target.value === "real"; redraw(); } }))),
  ));
  const stateCol = d.state && !d.state.none;
  const recordRow = (r) => ui.h("li", {},
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${r.year} · ${d.people.length > 1 ? "ages" : "age"} ${r.ages.join(" / ")}`), ui.h("span", { class: "rec-value" }, money(r.taxes))),
    ui.h("div", { class: "rec-sub" }, `${money(r.ordinary)} ordinary${r.socialSecurity > 0 ? ` · ${money(r.socialSecurity)} Social Security (${money(r.taxableSocialSecurity)} taxed)` : ""}${r.qualified > 0 ? ` · ${money(r.qualified)} gains and dividends` : ""} · ${money(r.taxableIncome)} taxable${r.bracketRate !== null ? ` · ${fmt.pct(r.bracketRate, 0)} bracket` : ""}${r.conversion > 0 ? ` · ${money(r.conversion)} converted` : ""}${r.rmd > 0 ? ` · ${money(r.rmd)} required` : ""}${stateCol ? ` · ${money(r.state)} ${d.state.name} tax` : ""}`));
  root.append(ui.card("Year by year",
    ui.h("div", { class: "only-wide" }, ui.table([
      { key: "year", label: "Year" }, { key: "ages", label: d.people.length > 1 ? "Ages" : "Age", render: (r) => r.ages.join(" / ") },
      { key: "ordinary", label: "Ordinary income", align: "right", render: (r) => money(r.ordinary) },
      { key: "socialSecurity", label: "Social Security", align: "right", render: (r) => r.socialSecurity > 0 ? `${money(r.socialSecurity)} (${money(r.taxableSocialSecurity)} taxed)` : "-" },
      { key: "qualified", label: "Gains, dividends", align: "right", render: (r) => r.qualified > 0 ? money(r.qualified) : "-" },
      { key: "taxableIncome", label: "Taxable", align: "right", render: (r) => money(r.taxableIncome) },
      { key: "bracketRate", label: "Bracket", align: "right", render: (r) => r.bracketRate !== null ? fmt.pct(r.bracketRate, 0) : "-" },
      { key: "taxes", label: "Tax", align: "right", render: (r) => money(r.taxes) },
      ...(stateCol ? [{ key: "state", label: `${d.state.name} tax`, align: "right", render: (r) => money(r.state) }] : []),
    ], d.rows)),
    ui.h("div", { class: "only-narrow" }, ...rest(ctx, { id: "years", items: d.rows, row: recordRow, noun: "years", one: "year" })),
  ));
  // how this is worked out: the federal steps, then the state's rules (gap #40, "New York: ...") or why there are none
  root.append(part(ctx, { id: "how", kind: "how", card: true, says: d.state && !d.state.none ? d.state.name : "", body: () => howBody(ui, d, plan) }));
  root.append(ui.h("div", {}, links(ctx, [
    { href: "#/taxes/state", ask: "What is my state's income tax this year?" },
    { href: "#/retirement/roth-conversions", ask: "Would moving money to a Roth lower these taxes?" },
    { href: "#/retirement/projection", ask: "Will the money last?" },
  ])));
}

const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);
/** The words inside "How this is worked out": what each year taxes, then the state's rules or why it has none here. */
export function howBody(ui, d, plan) {
  const s = d.state;
  const out = [
    ui.h("p", { class: "small" }, "Each year of retirement goes through that year's federal brackets: pensions, a partner's pay, money taken out of pre-tax accounts and Roth conversions as ordinary income; part of what is taken from taxable accounts as gains, with their dividends; and the part of Social Security the law taxes. The tax is paid from your savings in the plan's withdrawal order, so it counts the tax on the money taken out to pay it."),
  ];
  if (!s) {
    const code = String(plan.household?.state ?? "").toUpperCase();
    // the states in the table, the three of the ten largest still to come (their tax pages could not be read yet: README), and
    // where this year's tax for the plan's own state is worked out
    const names = stateNames();
    out.push(ui.h("p", { class: "small" }, code
      ? `The app has the income tax rules of ${names.slice(0, -1).join(", ")} and ${names.at(-1)}, and of the states with no income tax. Pennsylvania, Ohio and Michigan come next. For ${stateNameOf(code) ?? "your state"}, the State tax page works out this year's tax from your own figures.`
      : "Pick your state on the State tax page, and this page adds its income tax when the app has its rules."));
  } else if (s.none) {
    out.push(ui.h("p", { class: "small" }, `${s.name}: ${s.rules[0]}.`));
  } else {
    // the state's rules, one plain line each
    out.push(ui.h("div", { class: "small" }, `${s.name}:`, ui.h("ul", { style: "margin:4px 0 12px; padding-left:20px" }, s.rules.map((x) => ui.h("li", {}, `${cap(x)}.`)))));
    if (s.yearWords) out.push(ui.h("p", { class: "small" }, `${cap(s.yearWords)}.`));
    out.push(ui.h("p", { class: "small" }, s.indexed ? `In later years ${s.name}'s brackets and deductions rise with the plan's inflation rate.` : `In later years ${s.name}'s figures stay as written in its law, so as prices rise more of the same income is taxed.`));
    if (s.local) out.push(ui.h("p", { class: "small" }, `${cap(s.local)} are not counted.`));
    // the federal tax is paid from the plan's savings; the state's is shown beside it only (README: Builder's choices)
    out.push(ui.h("p", { class: "small" }, `${s.name}'s tax is shown here only: Will the money last? does not take it out of your savings yet.`));
  }
  out.push(ui.h("p", { class: "muted small" }, s && !s.none ? "Federal brackets from the IRS; the state's from its own tax department, read in November 2026." : "Federal brackets from the IRS."));
  return out;
}

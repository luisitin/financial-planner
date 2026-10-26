// modules/investments/glide-path/view.js -- DOM only. Where you stand against the path first,
// the three paths drawn over the ages, the milestones, and the rule choice (folded).
import { compute, RULES } from "./compute.js";
import { lineChart } from "../../retirement/charts.js";

let pending = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const d = compute(plan, { today: fmt.today() });
  const pts = (x) => x === null || x === undefined ? "-" : `${Math.round(x * 100)}%`;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.verdict === "on path" ? "Your stock share is on the path" : d.verdict === "unknown" ? "How much in stocks, at each age" : `You hold ${d.verdict}`),
    ui.h("p", { class: "lede" }, d.actual !== null
      ? `${pts(d.actual)} of your holdings are stocks; ${d.ruleLabel.toLowerCase()} says ${pts(d.suggested)} at ${d.ageNow}${d.person ? ` (${d.person})` : ""}. ${Math.abs(d.gap) <= 0.05 ? "Within five points: fine." : d.gap > 0 ? `That is ${Math.round(d.gap * 100)} points more stock than the path; a bad year would bite harder than the plan assumes.` : `That is ${Math.round(-d.gap * 100)} points less stock than the path; growth will lag what the plan assumes.`} The path glides to ${pts(d.rows[d.rows.length - 1]?.[d.key])} by ${d.endAge}.`
      : `A glide path is the stock share falling as the money gets closer to being spent: ${pts(d.stocksNow)} now and ${pts(d.stocksRetired)} in retirement on the Projection page, ${pts(d.rows[0]?.age110)} by the 110-minus-age rule at ${d.ageNow}. Add holdings to see where you stand.`),
    ui.h("p", { class: "muted small" }, "Stocks: US, international and real-estate funds, plus the stock part of balanced and target-date funds. The Projection page's path is what the retirement pages assume; the other two are for comparison."),
  ));
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);
  for (const n of d.notes) root.append(ui.notice("info", n));
  const years = d.rows.map((r) => r.age);
  root.append(ui.card("Stock share by age",
    lineChart({ years, series: [{ values: d.rows.map((r) => r.plan * 100), width: 2.5 }, { values: d.rows.map((r) => r.age110 * 100), color: "var(--muted)", dash: "4 3" }, { values: d.rows.map((r) => r.targetDate * 100), color: "#d6a06b", dash: "2 3" }, ...(d.actual !== null ? [{ values: d.rows.map((r, i) => i <= 1 ? d.actual * 100 : NaN), color: "var(--bad)", width: 6 }] : [])], marks: [{ year: d.retireAge, label: "retire" }], label: "stock share by age, percent" }),
    ui.h("p", { class: "muted small" }, `Solid: the plan's path. Dashed: 110 minus age. Dotted: a target-date fund. ${d.actual !== null ? "The red mark is where you are now." : ""} Percent of the portfolio in stocks, by age.`),
  ));
  root.append(ui.card("Milestones",
    ui.h("div", { class: "only-wide" }, ui.table([
      { key: "age", label: "Age" }, { key: "year", label: "Year" },
      { key: "plan", label: "Plan's path", align: "right", render: (r) => pts(r.plan) },
      { key: "age110", label: "110 minus age", align: "right", render: (r) => pts(r.age110) },
      { key: "targetDate", label: "Target-date", align: "right", render: (r) => pts(r.targetDate) },
    ], d.milestones)),
    ui.h("ul", { class: "records only-narrow" }, d.milestones.map((r) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `Age ${r.age} · ${r.year}${r.age === d.retireAge ? " · retire" : ""}`), ui.h("span", { class: "rec-value" }, pts(r.plan))), ui.h("div", { class: "rec-sub" }, `110 minus age ${pts(r.age110)} · target-date ${pts(r.targetDate)}`)))),
  ));
  const sel = ui.select(Object.entries(RULES).map(([value, r]) => ({ value, label: r.label })), d.rule, { "aria-label": "Rule", onChange: (e) => { pending = "Saved."; store.update((p) => { p.investments.glide = e.target.value; }); } });
  root.append(ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Which path to measure against"), ui.h("span", { class: "fold-status" }, d.ruleLabel), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" }, ui.h("div", { class: "form" }, ui.field("Path", sel, RULES[d.rule].note)), ui.h("p", { class: "muted small" }, "The plan's own path is set on the Projection page (stock share now and in retirement). The rules of thumb are only for comparison; the retirement pages always use the plan's."))));
}

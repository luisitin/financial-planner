// modules/career/human-capital/view.js -- DOM only. What your future pay is worth today, per earner; the pay
// still to come against your savings over the years (the two lines cross); what it means for insurance and
// investing; how steady each job is in a fold.
import { compute, RISK } from "./compute.js";
import { lineChart } from "../../retirement/charts.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.hc-root .hc-key { display: flex; gap: 16px; flex-wrap: wrap; font-size: var(--fs-sm); color: var(--text-2); margin-top: 6px; }
.hc-root .hc-key span::before { content: ""; display: inline-block; width: 18px; height: 0; border-top: 2px solid var(--accent); vertical-align: middle; margin-right: 6px; }
.hc-root .hc-key span.hc-h::before { border-top: 2px dashed var(--text-2); }
.hc-root .hc-warn { color: var(--warn); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const pct = (x) => `${Math.round(x * 100)}%`;
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "hc-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "What your future pay is worth"),
      ui.h("p", { class: "lede" }, "Early in a career, the pay you have not earned yet is usually your biggest asset by far. This page puts a value on it, and shows what that means for insurance and investing."),
      ui.h("p", { class: "muted small" }, "It needs each earner's birth date on People and their pay on Income."),
      ui.row(ui.h("a", { class: "btn", href: "#/cashflow/income" }, "Income"), ui.h("a", { class: "btn secondary", href: "#/household/people" }, "People"))));
    return;
  }

  root.append(ui.card(null, ui.row(
    ui.stat("Your future pay, in today's money", money(d.total), `${money(d.totalAfterTax)} after tax`),
    d.share !== null ? ui.stat("Of everything you have", pct(d.share), `is pay still to come; ${money(d.financial)} is saved`) : null,
  )));

  root.append(ui.card("Each earner", ui.h("ul", { class: "records" }, d.people.map((p) => ui.h("li", {},
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${p.name}, ${p.age}`), ui.h("span", { class: "rec-value" }, money(p.value))),
    ui.h("div", { class: "rec-sub" }, `${money(p.pay)} a year for ${p.years} more year${p.years === 1 ? "" : "s"} (to ${p.retireAge}); ${{ steady: "a steady", average: "an average", volatile: "a volatile" }[p.risk]} job, valued at ${(p.rate * 100).toFixed(1)}% a year. ${money(p.afterTax)} after tax.`),
    ui.h("div", { class: `rec-sub${p.coverShare !== null && p.coverShare < 0.5 ? " hc-warn" : ""}` }, p.cover > 0 ? `Life insurance on ${p.name}: ${money(p.cover)}, ${pct(p.coverShare)} of it.` : `No life insurance on ${p.name}: the household would lose this pay if ${p.name} died.`))))));

  const marks = d.crossYear ? [{ year: d.crossYear, label: "savings pass it" }] : [];
  const years = d.path.map((x) => x.year);
  root.append(ui.card("Pay still to come against savings", lineChart({ years, series: [{ values: d.path.map((x) => x.financial ?? NaN) }, { values: d.path.map((x) => x.human), color: "var(--text-2)", dash: "5 4" }], marks, label: "the value of pay still to come falling and savings rising, in today's money" }),
    ui.h("div", { class: "hc-key" }, ui.h("span", {}, "Savings"), ui.h("span", { class: "hc-h" }, "Pay still to come")),
    ui.h("p", {}, d.crossYear ? `Each year of work turns some future pay into savings. Around ${d.crossYear} your savings become worth more than the pay you still have to earn.` : "Each year of work turns some future pay into savings; at today's pace, savings stay below the pay still to come until retirement."),
    ui.h("p", { class: "muted small" }, `In today's money: pay ${Math.abs(d.real.growth) < 0.0005 ? "keeping pace with prices" : `rising ${(d.real.growth * 100).toFixed(1)}% a year ${d.real.growth > 0 ? "above" : "below"} prices`}, savings as the retirement projection grows them.`)));

  const steady = d.people.every((p) => p.risk !== "volatile");
  root.append(ui.card("What it means", ui.h("ul", {},
    ui.h("li", {}, ui.h("b", {}, "Protect it. "), "Insurance on your life and your ability to work is how this value reaches your family if you cannot earn it. ", ui.h("a", { href: "#/insurance/life-needs" }, "Life cover"), " · ", ui.h("a", { href: "#/insurance/disability" }, "disability")),
    ui.h("li", {}, ui.h("b", {}, "Invest around it. "), steady ? "Steady pay behaves like a bond: it lets your savings take more stock risk while you work." : "Volatile pay behaves like a stock: keep more of your savings steady, and avoid piling into your own employer's shares."),
    ui.h("li", {}, ui.h("b", {}, "Grow it. "), `Raises one point bigger every year would add about ${money(d.raiseGain)} of pay over your careers, in today's money: skills and job moves are often your best investment.`))));

  const s = plan.whatIfs?.humanCapital ?? {};
  root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "How steady is each job?"), ui.h("span", { class: "fold-status" }, d.people.map((p) => p.risk).join(", ")), ui.h("span", { class: "fold-chev" }, "›")),
    ui.form(d.people.map((p) => ({ key: p.id, label: p.name, type: "select", options: Object.entries(RISK).map(([value, r]) => ({ value, label: r.label })) })), Object.fromEntries(d.people.map((p) => [p.id, s[p.id] ?? "average"])), (v) => {
      pending = "Saved.";
      store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.humanCapital = { ...(p.whatIfs.humanCapital ?? {}), ...v }; });
    }, { submitLabel: "Save" }),
    ui.h("p", { class: "muted small" }, "The steadier the pay, the more it is worth today: steady pay is valued at the plan's bond return, average pay two points above it, volatile pay at the stock return.")));
}

// modules/insurance/term-vs-permanent/view.js -- DOM only. The figures from the whole-life illustration
// in one small form, then the answer: which way is ahead at the end of the term, the return that
// decides it, and what the family would get along the way.
import { compute, scenarioOf, planReturn, TAX_DRAG } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.tp-root .tp-verdict { font-weight: 650; margin: 8px 0 4px; }
.tp-root .tp-verdict.ok { color: var(--ok); } .tp-root .tp-verdict.warn { color: var(--warn); }
.tp-root .tp-d { color: var(--text-2); }
.tp-root .tp-steps { list-style: none; margin: 4px 0 0; padding: 0; }
.tp-root .tp-steps li { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--line); }
.tp-root .tp-steps li:last-child { border-bottom: 0; }
.tp-root .tp-steps .tp-v { text-align: right; white-space: nowrap; }
.tp-root .tp-steps .tp-s { display: block; color: var(--muted); font-size: var(--fs-xs); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const pct = (x) => `${(Math.round(x * 1000) / 10).toFixed(1)}%`;
  const rate = (x) => (x < -0.0005 ? `−${pct(-x)} (a loss)` : pct(x));
  const d = compute(plan);
  const s = d.scenario;
  const root = ui.h("div", { class: "tp-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  if (!d.ready) root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Whole life, or term and invest the rest?"),
    ui.h("p", { class: "lede" }, "Whole life insurance costs many times what term costs for the same cover, because part of each premium builds a cash value. The usual alternative: buy term, and invest what you save each year. This page compares the two with the numbers from the whole-life illustration (the table the agent gives you)."),
    ui.h("p", { class: "muted small" }, `To compare, fill in: ${d.missing.join("; ")}.`)));
  else {
    const e = d.atEnd, N = s.termYears;
    root.append(ui.card(`After ${N} years`, ui.row(
      ui.stat("Term and invest", money(e.sideFund), `${money(d.difference)} a year invested at ${pct(s.returnRate)}`),
      ui.stat("Whole life cash value", money(e.cashValue), e.cashValueGuaranteed ? `${money(e.cashValueGuaranteed)} guaranteed` : "as illustrated"),
    ),
    ui.h("p", { class: `tp-verdict ${d.verdict === "term" ? "ok" : "warn"}` }, d.verdict === "term" ? `Term and invest is ahead by about ${money(e.ahead)}.` : d.verdict === "whole" ? `Whole life is ahead by about ${money(-e.ahead)}.` : "The two come out about even."),
    ui.h("p", { class: "tp-d" }, d.breakeven === null ? "The illustrated cash value is so low that any return on the invested difference beats it." : `Whole life only comes out ahead if the invested difference earns less than ${rate(d.breakeven)} a year${d.breakevenGuaranteed !== null ? `; against the guaranteed cash value, less than ${rate(d.breakevenGuaranteed)}` : ""}. You are assuming ${pct(s.returnRate)}.`),
    d.wholeReturn !== null ? ui.h("p", { class: "tp-d" }, `Counted as an investment, every premium paid in becomes the cash value at ${rate(d.wholeReturn)} a year${d.wholeReturnGuaranteed !== null ? `, or ${rate(d.wholeReturnGuaranteed)} on the guaranteed figures` : ""}; part of each premium pays for the insurance itself.`) : null));

    // what the family gets along the way
    const marks = d.rows.filter((r) => r.year === 1 || r.year % 5 === 0 || r.year === N);
    root.append(ui.card("If you died along the way", ui.h("p", { class: "muted small" }, "What the family would get each way, for the years of the term."),
      ui.h("ul", { class: "tp-steps" }, marks.map((r) => ui.h("li", {}, ui.h("span", {}, `Year ${r.year}`), ui.h("span", { class: "tp-v" }, `${money(r.deathTerm)}`, ui.h("span", { class: "tp-s" }, `term and invest; whole life ${money(r.deathWhole)}`))))),
      ui.h("p", { class: "tp-d", style: { marginTop: "10px" } }, `After year ${N} the term ends: the family would have the investments (${money(e.sideFund)}, still growing) instead of a death benefit, while whole life keeps paying ${money(s.deathBenefit)} for as long as its premiums are paid. If cover is still needed then, a new term costs much more at an older age.`)));
    root.append(ui.card("What this leaves out", ui.h("ul", {},
      ui.h("li", {}, "Taxes on the way out: cash value taken above the premiums paid is taxed as income; investments pay tax on their gains when sold."),
      ui.h("li", {}, "The discipline: the comparison only holds if the difference really is invested every year."),
      ui.h("li", {}, "Dividends on whole life are not guaranteed; the illustrated (non-guaranteed) cash value depends on them."),
      ui.h("li", {}, "Whole life can suit a lifelong need: an estate tax bill, a dependent who will always need support."))));
  }

  // the inputs
  const c = plan.insurance?.compare ?? {};
  const form = ui.form([
    { key: "deathBenefit", label: "Death benefit", type: "money", min: 0, help: s.fromPolicy && s.deathBenefit ? "from your whole-life policy on Policies" : "the same for both" },
    { key: "wholePremium", label: "Whole-life premium a year", type: "money", min: 0 },
    { key: "termPremium", label: "Term premium a year for the same cover", type: "money", min: 0, help: "a quote for a level term of the length below" },
    { key: "termYears", label: "Length of the term (years)", type: "number", min: 1, max: 40, step: "1" },
    { key: "cashValue", label: "Illustrated cash value at the end of the term", type: "money", min: 0, help: "the non-guaranteed (projected) column of the illustration, in that year" },
    { key: "cashValueGuaranteed", label: "Guaranteed cash value then (optional)", type: "money", min: 0 },
    { key: "taxed", label: "The difference goes into an ordinary investment account (taxed along the way)", type: "checkbox", help: "untick if it would go into a Roth or a 401(k)" },
    { key: "returnRate", label: "Return on the invested difference", type: "percent", help: `empty: your plan's ${pct(planReturn(plan))}${s.taxed ? `, less ${pct(TAX_DRAG)} for taxes along the way` : ""}` },
  ], { deathBenefit: s.deathBenefit || "", wholePremium: s.wholePremium || "", termPremium: c.termPremium ?? "", termYears: s.termYears, cashValue: c.cashValue ?? "", cashValueGuaranteed: c.cashValueGuaranteed ?? "", taxed: s.taxed, returnRate: c.returnRate ?? null }, (v) => {
    pending = "Comparison saved.";
    store.update((p) => { p.insurance = p.insurance ?? { policies: [] }; p.insurance.compare = { deathBenefit: v.deathBenefit ?? null, wholePremium: v.wholePremium ?? null, termPremium: v.termPremium ?? null, termYears: v.termYears ?? null, cashValue: v.cashValue ?? null, cashValueGuaranteed: v.cashValueGuaranteed ?? null, taxed: !!v.taxed, returnRate: v.returnRate ?? null }; });
  }, { submitLabel: d.ready ? "Save changes" : "Compare" });
  if (d.ready) root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "The figures"), ui.h("span", { class: "fold-status" }, `${money(s.deathBenefit)}, ${s.termYears} years`), ui.h("span", { class: "fold-chev" }, "›")), form));
  else root.append(ui.card("From the illustration", form));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/insurance/cash-value" }, "A policy you already have"), ui.h("a", { class: "btn secondary", href: "#/insurance/life-needs" }, "How much cover"))));
}

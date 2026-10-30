// modules/taxes/state/view.js -- DOM only. The year's state income tax: the state chosen, the estimate and
// how it was worked out, what it is worth on the federal return, what is left after withholding, the same
// income in other states, and your own figures in a fold.
import { compute, STATE_NAMES } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.st-root .st-list { list-style: none; margin: 0; padding: 0; }
.st-root .st-list li { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--line); }
.st-root .st-list li:last-child { border-bottom: 0; }
.st-root .st-list li span:last-child { white-space: nowrap; font-variant-numeric: tabular-nums; }
.st-root .st-you { font-weight: 650; }
.st-root .st-d { color: var(--text-2); font-size: var(--fs-sm); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const pct = (x) => `${(x * 100).toFixed(2).replace(/\.?0+$/, "")}%`;
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "st-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  const chooseState = () => ui.select([{ value: "", label: "Choose a state" }, ...Object.entries(STATE_NAMES).map(([value, label]) => ({ value, label }))], d.code, {
    "aria-label": "State you live in",
    onChange: (e) => { pending = "Saved."; store.update((p) => { p.household = p.household ?? { people: [], filingStatus: "single", state: "" }; p.household.state = e.target.value; }); },
  });

  if (!d.code) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "State income tax"),
      ui.h("p", { class: "lede" }, "Most states tax income as well; nine do not tax wages at all. Choose where you live to see this year's estimate."),
      ui.field("State you live in", chooseState())));
    return;
  }

  // the estimate
  if (d.method === "unknown") {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, `${d.name} income tax`),
      ui.h("p", { class: "lede" }, `${d.name} taxes income in steps that rise with income, so the quickest good estimate comes from last year's state return.`),
      ui.h("p", { class: "muted small" }, "Type the state tax on last year's return and the adjusted gross income on last year's federal return below; or your state's rate if you know it.")));
  } else {
    root.append(ui.card(null, ui.row(
      ui.stat(`${d.name} income tax, ${d.year}`, money(d.tax), d.method === "none" ? "no tax on wages" : `${pct(d.effective)} of your income`),
      ui.stat("A month", money(d.monthly), d.method === "none" ? "nothing to set aside" : "to set aside or have withheld"),
    )));
    const how = {
      none: `${d.name} has ${d.note}.`,
      typed: `Your rate: ${pct(d.rate)} × (adjusted gross income ${money(d.agi)}${d.allowance ? ` − deductions ${money(d.allowance)}` : ""}).`,
      prior: `From last year's return: the state took ${pct(d.rate)} of your adjusted gross income; the same share of this year's ${money(d.agi)}.`,
      flat: `${d.name} taxes income at a flat ${pct(d.rate)}${d.note ? `, ${d.note}` : ""}: ${pct(d.rate)} × (adjusted gross income ${money(d.agi)} − about ${money(d.allowance)} of deductions and exemptions).`,
    }[d.method];
    root.append(ui.card("How it is worked out", ui.h("p", {}, how),
      d.local && d.method !== "none" ? ui.h("p", { class: "st-d" }, `Some cities and counties in ${d.name} add an income tax of their own; if yours does, put the two rates together under "Your figures".`) : null,
      d.method === "flat" ? ui.h("p", { class: "st-d" }, "Credits and phase-outs are left out. Last year's return, under \"Your figures\", gives a closer estimate.") : null));
  }

  // on the federal return
  if (d.tax > 0) {
    const counted = Math.abs(d.federal.counted - d.tax) < 1;
    const fedCard = ui.card("On your federal return", ui.h("p", {}, `State income tax is a deduction on the federal return if you itemize, together with property tax, up to ${money(d.federal.cap)} a year.`));
    if (counted) fedCard.append(ui.h("p", { class: "st-d" }, "It is already counted on Federal."));
    else if (d.federal.saving >= 1) fedCard.append(ui.h("p", {}, `Counting it would lower your federal tax by about ${money(d.federal.saving)}.`),
      ui.row(ui.button(`Use ${money(d.tax)} on Federal`, () => {
        pending = `Counted ${money(d.tax)} of state tax on Federal.`;
        store.update((p) => { p.taxes = p.taxes ?? {}; p.taxes.itemized = { ...(p.taxes.itemized ?? {}), stateTax: Math.round(d.tax) }; });
      })));
    else fedCard.append(ui.h("p", { class: "st-d" }, `It changes nothing this year: the standard deduction is larger than everything you could itemize${d.federal.counted ? ` (Federal counts ${money(d.federal.counted)} now)` : ""}.`));
    root.append(fedCard);
  }

  // withholding
  if (d.balance !== null && d.method !== "none") {
    root.append(ui.card("Paid so far", ui.h("p", {}, d.balance > 0.5 ? `About ${money(d.balance)} still to pay: ${money(d.withheld)} withheld or paid against ${money(d.tax)}.` : d.balance < -0.5 ? `A refund of about ${money(-d.balance)}: ${money(d.withheld)} withheld or paid against ${money(d.tax)}.` : "Withholding covers it.")));
  }

  // the same income elsewhere
  if (d.agi > 0 && d.others.length) {
    const here = d.tax ?? null;
    const top = d.others.filter((o) => o.tax > 0);
    root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "The same income in other states"), ui.h("span", { class: "fold-status" }, here > 0 ? `${money(here)} less with no income tax` : "flat-rate states"), ui.h("span", { class: "fold-chev" }, "›")),
      ui.h("p", { class: "st-d" }, `Nine states have no tax on wages: ${d.others.filter((o) => o.tax === 0).map((o) => o.name).join(", ")}. The flat-rate states, on your ${money(d.agi)}:`),
      ui.h("ul", { class: "st-list" }, top.map((o) => ui.h("li", { class: o.code === d.code ? "st-you" : null }, ui.h("span", {}, `${o.name}${o.code === d.code ? " (you)" : ""}`), ui.h("span", {}, money(o.tax))))),
      ui.h("p", { class: "muted small" }, "Income tax only: property tax, sales tax and the cost of living differ too, often by more. States with stepped rates are not listed.")));
  }

  // your figures
  const s = plan.taxes?.state ?? {};
  const form = ui.form([
    { key: "priorTax", label: "State tax on last year's return", type: "money", min: 0, help: "the total tax line on the state return, before withholding" },
    { key: "priorAgi", label: "Adjusted gross income on last year's federal return", type: "money", min: 0, help: "line 11 of Form 1040" },
    { key: "rate", label: "Or your rate (overrides the rest)", type: "percent", min: 0, max: 20, help: "state and local together; empty to work it out" },
    { key: "deduction", label: "Deductions and exemptions", type: "money", min: 0, help: "taken off income before the rate; empty for the usual ones" },
    { key: "withheld", label: "State tax withheld or paid this year", type: "money", min: 0, help: "the total expected by December, from pay stubs and payments" },
  ], { priorTax: s.priorTax ?? "", priorAgi: s.priorAgi ?? "", rate: s.rate ?? "", deduction: s.deduction ?? "", withheld: s.withheld ?? "" }, (v) => {
    pending = "Saved.";
    store.update((p) => { p.taxes = p.taxes ?? {}; p.taxes.state = { priorTax: v.priorTax ?? null, priorAgi: v.priorAgi ?? null, rate: v.rate ?? null, deduction: v.deduction ?? null, withheld: v.withheld ?? null }; });
  }, { submitLabel: "Save" });
  const label = { none: "no wage tax", typed: "your rate", prior: "from last year", flat: "flat rate", unknown: "nothing yet" }[d.method];
  root.append(ui.h("details", { class: "card fold fold-card", open: d.method === "unknown" ? true : null }, ui.h("summary", {}, ui.h("h2", {}, "Your figures"), ui.h("span", { class: "fold-status" }, label), ui.h("span", { class: "fold-chev" }, "›")),
    ui.field("State you live in", chooseState()), form));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/taxes/federal" }, "Federal tax estimate"), ui.h("a", { class: "btn secondary", href: "#/taxes/withholding" }, "Withholding"))));
}

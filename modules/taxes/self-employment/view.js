// modules/taxes/self-employment/view.js -- DOM only. The tax a business adds (self-employment tax and
// income tax, after half the SE tax and the business deduction), what each extra $100 keeps, what a SEP or a
// solo 401(k) could shelter, the quarterly payments, and the expenses in a fold.
import { compute } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.se-root .se-list { list-style: none; margin: 0; padding: 0; }
.se-root .se-list li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); }
.se-root .se-list li:last-child { border-bottom: 0; }
.se-root .se-list b { white-space: nowrap; }
.se-root .se-d { color: var(--text-2); font-size: var(--fs-sm); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "se-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Working for yourself"),
      ui.h("p", { class: "lede" }, "Freelance, a side business, gig work: on top of income tax you pay both halves of Social Security and Medicare (the self-employment tax), and no one withholds it. This page works out what it comes to and how to lower it."),
      ui.h("p", { class: "muted small" }, "Add the business on the Income page as \"Business or self-employment\"."),
      ui.row(ui.h("a", { class: "btn", href: "#/cashflow/income" }, "Income"))));
    return;
  }
  for (const w of d.warnings) root.append(ui.notice("info", w));
  root.append(ui.card(`A profit of ${money(d.net)} in ${d.year}`, ui.row(
    ui.stat("Tax it adds", money(d.businessTax), `${Math.round(d.effectiveRate * 100)}% of the profit`),
    ui.stat("Of each extra $100", money(d.keepPer100), "you keep, after every tax"),
  ), ui.h("ul", { class: "se-list" },
    ui.h("li", {}, ui.h("span", {}, "Self-employment tax (Social Security and Medicare, both halves)"), ui.h("b", {}, money(d.seTotal))),
    ui.h("li", {}, ui.h("span", {}, "Half of it comes off your income"), ui.h("b", {}, `−${money(d.half)}`)),
    ui.h("li", {}, ui.h("span", {}, "Business deduction (20% of the profit after that half)"), ui.h("b", {}, `−${money(d.qbi)}`)),
    d.addlMedicare > 0.5 ? ui.h("li", {}, ui.h("span", {}, "Extra Medicare tax (0.9% over the line)"), ui.h("b", {}, money(d.addlMedicare))) : null,
    ui.h("li", {}, ui.h("span", {}, "Income tax on the rest, at your rate"), ui.h("b", {}, money(d.businessTax - d.seTotal - d.addlMedicare)))),
    ui.h("p", { class: "se-d", style: { marginTop: "8px" } }, `Social Security counts only up to ${money(d.wageBase)} of pay and profit together; Medicare has no limit.`)));

  root.append(ui.card("Pay it during the year", ui.h("p", {}, `No one withholds tax on a business. About ${money(d.quarterly)} a quarter covers it (April 15, June 15, September 15, January 15), or raise the withholding at a day job by ${money(d.businessTax / 26)} a paycheck.`), ui.row(ui.h("a", { class: "btn secondary", href: "#/taxes/estimated" }, "Estimated payments"), ui.h("a", { class: "btn secondary", href: "#/taxes/withholding" }, "Withholding check"))));

  root.append(ui.card("Shelter some of it for retirement", ui.h("ul", { class: "se-list" }, d.people.map((p) => ui.h("li", {}, ui.h("span", {}, `${p.name}: SEP-IRA up to ${money(p.sepRoom)}`), ui.h("b", {}, `solo 401(k) up to ${money(p.soloRoom)}`)))),
    ui.h("p", { class: "se-d", style: { marginTop: "8px" } }, `A SEP-IRA takes 20% of the profit after half the self-employment tax. A solo 401(k) adds your own contribution on top (what is left of the $24,500 yearly limit after any 401(k) at work), up to ${money(d.total415)} in all. Both lower this year's income tax, not the self-employment tax.`)));

  const s = plan.whatIfs?.selfEmployment ?? {};
  root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "Business expenses"), ui.h("span", { class: "fold-status" }, d.expenses ? money(d.expenses) : "none entered"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.form([{ key: "expenses", label: "Business expenses a year", type: "money", min: 0, help: "supplies, software, mileage, a home office, fees: they come off the Income page's amount before tax" }], { expenses: s.expenses ?? "" }, (v) => {
      pending = "Saved.";
      store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.selfEmployment = { expenses: v.expenses ?? null }; });
    }, { submitLabel: "Save" })));
}

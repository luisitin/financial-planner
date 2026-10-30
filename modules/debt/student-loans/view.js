// modules/debt/student-loans/view.js -- DOM only. The federal student loans under each way to repay them:
// the first payment, how long, what is paid and forgiven, the cost in today's money, the cheapest marked;
// public service and the income to use in a fold; the rules as of 2026.
import { compute } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.sl-root .sl-list { list-style: none; margin: 0; padding: 0; }
.sl-root .sl-list li { padding: 11px 0; border-bottom: 1px solid var(--line); }
.sl-root .sl-list li:last-child { border-bottom: 0; }
.sl-root .sl-head { display: flex; justify-content: space-between; gap: 12px; font-weight: 650; }
.sl-root .sl-head span:last-child { white-space: nowrap; }
.sl-root .sl-best .sl-head span:last-child { color: var(--ok); }
.sl-root .sl-d { color: var(--text-2); font-size: var(--fs-sm); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "sl-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Student loans"),
      ui.h("p", { class: "lede" }, "Federal student loans can be repaid on a fixed 10-year plan or on a plan that follows your income, and some are forgiven. This page compares them on your own income."),
      ui.h("p", { class: "muted small" }, "Add the loans on Accounts as \"Student loan\" with the balance, and the rate on Debts. studentaid.gov lists them."),
      ui.row(ui.h("a", { class: "btn", href: "#/balance/accounts" }, "Accounts"))));
    return;
  }
  const best = d.plans.find((p) => p.id === d.best);
  root.append(ui.card(null, ui.row(
    ui.stat("Federal loans", money(d.balance), `${d.loans.length} loan${d.loans.length === 1 ? "" : "s"} at about ${(d.rate * 100).toFixed(2)}%`),
    ui.stat("Cheapest way", best.label.replace(/ \(.*\)$/, ""), `${money(best.today)} in today's money`),
  ), ui.h("p", { class: "sl-d" }, `On an income of ${money(d.agi)} a year (adjusted gross income, growing with pay) for a household of ${d.size}.`)));

  root.append(ui.card("Each way to repay", ui.h("ul", { class: "sl-list" }, d.plans.map((p) => ui.h("li", { class: p.id === d.best ? "sl-best" : null },
    ui.h("div", { class: "sl-head" }, ui.h("span", {}, p.label), ui.h("span", {}, `${money(p.monthly)} a month`)),
    ui.h("div", { class: "sl-d" }, `${p.note}. ${p.years >= 0.95 ? `${Math.round(p.years * 10) / 10} years` : `${Math.round(p.years * 12)} months`}; ${money(p.paid)} paid${p.forgiven > 1 ? `, ${money(p.forgiven)} forgiven${p.taxOnForgiven > 0 ? ` (about ${money(p.taxOnForgiven)} of tax on it)` : " tax-free"}` : ""}; ${money(p.today)} in today's money.`)))),
    ui.h("p", { class: "muted small" }, `"In today's money" counts that money paid later could earn ${(d.discount * 100).toFixed(1)}% a year meanwhile: a slower plan is cheaper than its total looks. Income-driven payments are worked out on next year's income each year.`)));

  root.append(ui.card("The rules as of 2026", ui.h("ul", {},
    ui.h("li", {}, "The SAVE plan has ended. The Repayment Assistance Plan opens for new loans from July 1, 2026; borrowers on the older income-driven plans other than IBR move by July 1, 2028."),
    ui.h("li", {}, "Debt forgiven after 20 or 30 years of payments is taxed as income again from 2026; Public Service Loan Forgiveness stays tax-free."),
    ui.h("li", {}, "Public Service Loan Forgiveness needs 120 qualifying payments while working full time for government or a nonprofit; certify the employer every year."),
    ui.h("li", {}, "Refinancing with a private lender can lower the rate but ends every federal protection: income-driven plans, forgiveness, pauses.")),
    ui.h("p", { class: "muted small" }, "Rules change: check studentaid.gov's loan simulator before switching plans.")));

  const s = plan.whatIfs?.studentLoans ?? {};
  root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "Your situation"), ui.h("span", { class: "fold-status" }, d.pslf ? "public service" : "private sector"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.form([
      { key: "pslf", label: "I work full time for government or a nonprofit (public service)", type: "checkbox" },
      { key: "agi", label: "Income to use (adjusted gross income)", type: "money", min: 0, help: `empty: the Federal estimate's ${money(d.agi)}` },
    ], { pslf: !!s.pslf, agi: s.agi ?? "" }, (v) => {
      pending = "Saved.";
      store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.studentLoans = { pslf: !!v.pslf, agi: v.agi ?? null }; });
    }, { submitLabel: "Save" })));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/debt/payoff" }, "Pay off debt"), ui.h("a", { class: "btn secondary", href: "#/taxes/filing-status" }, "Filing status"))));
}

// modules/goals/emergency-fund/view.js -- DOM only. The cushion against its target as a bar, the months
// this household should aim for and why, when it is full, the emergency goal as the fund itself (an opt-in
// tick), and where the money should sit.
import { compute } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.ef-root .ef-bar { height: 14px; border-radius: 8px; background: var(--panel-2); border: 1px solid var(--line); overflow: hidden; margin: 8px 0 4px; }
.ef-root .ef-bar span { display: block; height: 100%; background: var(--accent); }
.ef-root .ef-d { color: var(--text-2); font-size: var(--fs-sm); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n / 10) * 10, cur);
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "ef-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  if (!(d.essentialMonthly > 0)) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "An emergency fund"),
      ui.h("p", { class: "lede" }, "Cash you can reach in a day, enough to pay the bills you cannot skip for a few months if the pay stops or something big breaks. It comes before investing."),
      ui.h("p", { class: "muted small" }, "Add your expenses and mark the must-pay ones (rent or mortgage, food, utilities, insurance, loan payments) to size it."),
      ui.row(ui.h("a", { class: "btn", href: "#/cashflow/expenses" }, "Expenses"))));
    return;
  }
  for (const w of d.warnings) root.append(ui.notice("warn", w));
  const share = d.target > 0 ? Math.min(1, d.now / d.target) : 0;
  root.append(ui.card(null, ui.row(
    ui.stat("Cash you can use", money(d.now), d.runwayMonths !== null ? `${(Math.round(d.runwayMonths * 10) / 10).toFixed(1)} months of must-pay bills` : ""),
    ui.stat("Target", money(d.target), `${d.months} months of ${money(d.essentialMonthly)}`),
  ), ui.h("div", { class: "ef-bar", role: "img", "aria-label": `${Math.round(share * 100)}% of the target` }, ui.h("span", { style: { width: `${share * 100}%` } })),
  ui.h("p", { class: "ef-d" }, d.gap <= 0 ? "Full. Money above it can go to the next goal or to investing." : d.monthsToGo !== null && Number.isFinite(d.monthsToGo) ? `${money(d.gap)} to go: at ${money(d.monthly)} a month, full in about ${d.monthsToGo} months (${d.readyDate}).` : `${money(d.gap)} to go. Set a monthly amount on the emergency goal (Goals) to see when it is full.`)));

  // how many months, for this household
  const sug = d.suggested;
  root.append(ui.card("How many months for you", ui.h("p", {}, `${sug.months} months is the usual advice for your household:`), ui.h("ul", {}, sug.reasons.map((r) => ui.h("li", {}, r[0].toUpperCase() + r.slice(1) + "."))),
    d.months !== sug.months ? ui.row(ui.button(`Aim for ${sug.months} months`, () => {
      pending = `Target set to ${sug.months} months.`;
      store.update((p) => { p.assumptions = { ...(p.assumptions ?? {}), emergencyMonths: sug.months }; });
    }, { class: "secondary" }), ui.h("a", { class: "btn secondary", href: "#/system/assumptions" }, "Assumptions")) : ui.h("p", { class: "muted small" }, `Your target already is ${d.months} months (Assumptions).`)));

  // the emergency goal as the fund itself (F-034, opt-in)
  if (d.goal) root.append(ui.card(`The "${d.goal.name}" goal`, ui.h("p", { class: "ef-d" }, d.goal.isEmergencyFund ? "Counted as your emergency fund: its money is part of the cash above, not set aside from it." : "Money saved for this goal is set aside from the cash above, as for any goal. If this goal is the emergency fund itself, tick it: its money then counts as the cushion."),
    ui.form([{ key: "isEmergencyFund", label: "This goal is my emergency fund", type: "checkbox" }], { isEmergencyFund: d.goal.isEmergencyFund }, (v) => {
      pending = v.isEmergencyFund ? "The goal now counts as your emergency fund." : "The goal is set aside again.";
      store.update((p) => { const g = (p.goals ?? []).find((y) => y.id === d.goal.id); if (g) g.isEmergencyFund = !!v.isEmergencyFund; });
    }, { submitLabel: "Save" })));

  // where it should sit
  root.append(ui.card("Where to keep it", ui.h("ul", {},
    ui.h("li", {}, "A high-yield savings or money-market account at an insured bank: reachable in a day, earning interest."),
    ui.h("li", {}, "Not in stocks: a market fall and a job loss often come together."),
    ui.h("li", {}, "A larger fund can be split: one month in savings, the rest in Treasury bills or a money-market fund.")),
    d.checking.spare > 0 ? ui.h("p", { class: "ef-d" }, `Checking holds ${money(d.checking.balance)}, about ${money(d.checking.spare)} more than a month of spending. In savings at ${(d.cashRate * 100).toFixed(1)}% that would earn about ${money(d.spareInterest)} a year.`) : null,
    ui.row(ui.h("a", { class: "btn secondary", href: "#/balance/liquidity" }, "Cash and how fast"), ui.h("a", { class: "btn secondary", href: "#/goals/prioritizer" }, "Which goal first?"))));
}

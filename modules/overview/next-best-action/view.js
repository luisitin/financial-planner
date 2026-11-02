// modules/overview/next-best-action/view.js -- DOM only. The next step for the next spare dollar as the
// hero, where each month's money goes now, then the whole order with what is left on each step and
// about when the spare money gets it done.
import { compute, HIGH_RATE, MODERATE_RATE } from "./compute.js";

const STYLE = `
.nb-root .nb-bar { display: flex; height: 14px; border-radius: 999px; overflow: hidden; background: var(--line); margin: 10px 0 12px; }
.nb-root .nb-bar span { display: block; height: 100%; }
.nb-root .nb-key { list-style: none; margin: 0; padding: 0; }
.nb-root .nb-key li { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); }
.nb-root .nb-key li:last-child { border-bottom: 0; font-weight: 700; font-size: var(--fs); }
.nb-root .nb-key i { flex: none; width: 12px; height: 12px; border-radius: 3px; }
.nb-root .nb-key .t { flex: 1; min-width: 0; }
.nb-root .nb-steps { list-style: none; margin: 0; padding: 0; }
.nb-root .nb-step > a, .nb-root .nb-step > div { display: flex; gap: 12px; align-items: flex-start; padding: 12px 0; border-bottom: 1px solid var(--line); color: inherit; text-decoration: none; min-height: 44px; }
.nb-root .nb-step:last-child > a, .nb-root .nb-step:last-child > div { border-bottom: 0; }
.nb-root .nb-num { flex: none; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; font-size: var(--fs-sm); font-weight: 700; background: var(--panel-2); color: var(--muted); border: 1px solid var(--line-2); }
.nb-root .done .nb-num { background: var(--ok-soft); color: var(--ok); border-color: var(--ok); }
.nb-root .now .nb-num { background: var(--accent); color: var(--on-accent); border-color: var(--accent); }
.nb-root .check .nb-num { background: var(--warn-soft); color: var(--warn); border-color: var(--warn); }
.nb-root .underway .nb-num { background: var(--ok-soft); color: var(--ok); border-color: var(--ok); border-style: dashed; }
.nb-root .nb-body { flex: 1; min-width: 0; }
.nb-root .nb-t { font-weight: 650; }
.nb-root .done .nb-t { color: var(--muted); }
.nb-root .nb-d { color: var(--text-2); font-size: var(--fs-sm); margin-top: 2px; }
.nb-root .nb-when { font-size: var(--fs-sm); font-weight: 600; color: var(--accent-ink); margin-top: 4px; }
.nb-root .nb-why { color: var(--muted); font-size: var(--fs-xs); margin-top: 4px; }
.nb-root .nb-chev { flex: none; color: var(--muted); font-size: 22px; line-height: 1; align-self: center; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n / 10) * 10, cur);
  const month = (iso) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "nb-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Next best action"),
      ui.h("p", { class: "lede" }, "What to do with your next spare dollar, in the order most planners agree on: the bills, a small cash cushion, the employer match, expensive debt, a full emergency fund, then the tax-sheltered accounts. It needs:"),
      ui.h("ul", {}, d.missing.map((m) => ui.h("li", {}, m))), ui.row(ui.h("a", { class: "btn", href: "#/cashflow/income" }, "Income"), ui.h("a", { class: "btn secondary", href: "#/cashflow/expenses" }, "Expenses"))));
    return;
  }
  const n = d.next;
  // the saved debt plan's extra joins the spare money once its debts are gone: a date reached with it says so
  const freed = d.debtPlan?.until ? ` with the ${money(d.debtPlan.extra)} a month that frees up after ${month(d.debtPlan.until)}` : "";
  // the tax step paid from the cash already kept apart for tax: today, not "at $X a month" of spare money
  const when = (s) => s.fromSavings > 0 && !s.gap ? "From savings, today." : s.id === "tax" && !s.gap && s.doneDate ? "From the cash kept apart for tax, today." : s.doneDate ? `Done by about ${month(s.doneDate)}${d.spare.monthly >= 5 ? ` at ${money(d.spare.monthly)} a month` : ""}${freed && s.doneDate > d.debtPlan.until ? `${d.spare.monthly >= 5 ? ", then more" : ""}${freed}` : ""}.` : s.startDate ? `From ${month(s.startDate)}: about ${money(s.monthly)} a month${s.monthly < s.roomYearly / 12 - 5 ? ` of the ${money(s.roomYearly / 12)} it could take` : ""}.` : null;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("p", { class: "muted small", style: { margin: "0 0 4px" } }, n ? "Your next step" : "Every step is done"),
    ui.h("h1", {}, n ? n.title : d.drawing ? "Living on your savings, as planned" : "Your choice from here"),
    // retired and drawing as planned: say that, not "the tax-sheltered accounts full"
    ui.h("p", { class: "lede" }, n ? n.detail : d.drawing ? `About ${money(-d.spare.monthly)} a month comes from savings, and the plan can carry about ${money(d.drawing.affordableMonthly)} a month of spending: the money lasts. Check it once a year, or after a big fall in the markets.` : "Bills covered, cushion full, debt handled, the tax-sheltered accounts full. From here it is priorities, not rules."),
    n && when(n) ? ui.h("p", {}, when(n)) : null,
    n ? ui.row(ui.h("a", { class: "btn", href: `#/${n.go[0]}/${n.go[1]}` }, "Open the page")) : null));

  // each month's money
  const s = d.spare;
  const parts = [...(s.businessCosts > 0.5 ? [["Business costs (Self-employment page)", s.businessCosts, "var(--panel-2)"]] : []), ["Federal income tax", s.federalTax, "var(--muted)"], ["Social Security and Medicare tax", s.payrollTax, "var(--line-2)"],
    ...(s.stateTax > 0.5 ? [["State income tax", s.stateTax, "repeating-linear-gradient(135deg, var(--muted) 0 3px, var(--line-2) 3px 6px)"]] : []), ["Spending", s.spending, "var(--text-2)"], ["Retirement saving", s.retirementSaving, "var(--ok)"], ["Saving for goals", s.goalSaving, "var(--accent)"],
    // the saved debt plan's extra (Pay off debts) is already spoken for, so it is not spare
    ...(s.debtExtra > 0 ? [[`Extra on ${d.debtPlan?.names?.length && d.debtPlan.names.length <= 2 ? d.debtPlan.names.join(" and ") : "debts"} (Pay off debts)`, s.debtExtra, "repeating-linear-gradient(45deg, var(--accent) 0 3px, var(--accent-soft) 3px 6px)"]] : []),
    // uneven pay above what you count on (Side income): in the pay above, not in the spare, so the lines add up (review 2026-11-02)
    ...(s.held > 0.5 ? [["Side income above what you count on, after its tax", s.held, "var(--line)"]] : [])];
  const total = Math.max(s.gross, parts.reduce((t, p) => t + p[1], 0));
  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "Each month's money"),
    ui.h("div", { class: "nb-bar", role: "img", "aria-label": "Where each month's pay goes" }, [...parts, ["Spare", Math.max(0, s.monthly), "var(--accent-soft)"]].map(([, v, c]) => ui.h("span", { style: { width: `${(Math.max(0, v) / total) * 100}%`, background: c } }))),
    ui.h("ul", { class: "nb-key" },
      ui.h("li", {}, ui.h("i", { style: { background: "transparent" } }), ui.h("span", { class: "t" }, d.drawing ? "Income before tax" : "Pay and other income, before tax"), ui.h("span", {}, money(s.gross))),
      // a federal tax below zero is a refund from credits (the child tax credit's refundable part): it adds, so it reads "+"
      parts.map(([t, v, c]) => ui.h("li", {}, ui.h("i", { style: { background: c } }), ui.h("span", { class: "t" }, v < 0 && t === "Federal income tax" ? "Federal income tax: credits pay back more than the tax" : t), ui.h("span", {}, v < 0 ? `+ ${money(-v)}` : `- ${money(v)}`))),
      ui.h("li", {}, ui.h("i", { style: { background: "var(--accent-soft)", border: "1px solid var(--accent)" } }), ui.h("span", { class: "t" }, s.monthly >= 0 ? "Spare each month" : d.drawing ? "From savings each month, as planned" : "Short each month"), ui.h("span", { class: s.monthly < 0 && !d.drawing ? "bad" : null }, d.drawing ? money(-s.monthly) : money(s.monthly)))),
    ui.h("p", { class: "muted small" }, `${s.stateTax > 0.5 ? "State income tax is the State page's rate on this income; local taxes are not counted." : s.stateKnown ? "" : "Your state's income tax is not counted yet: type its rate on the State page."} Spending is the Expenses page's monthly total; saving is what the Contributions and Goals pages already put away${s.held > 0.5 ? "; side income above the careful figure you count on (Side income) is left out of the spare: a bonus to save when it comes" : ""}${s.debtExtra > 0 ? `; the extra on debts is the plan saved on Pay off debts${d.debtPlan?.until ? `, until about ${month(d.debtPlan.until)}, then it is spare again` : ""}` : ""}.`.trim())));

  // the order
  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "The order"),
    ui.h("ol", { class: "nb-steps" }, d.steps.map((st, i) => {
      const body = [ui.h("span", { class: "nb-num", "aria-hidden": "true" }, st.status === "done" ? "✓" : st.status === "check" ? "?" : String(i)), ui.h("span", { class: "nb-body" },
        ui.h("div", { class: "nb-t" }, st.title, st.status === "check" ? ui.h("span", { class: "pill warn" }, "check") : st.status === "underway" ? ui.h("span", { class: "pill ok" }, "under way") : st === n ? ui.h("span", { class: "pill accent" }, "next") : null),
        ui.h("div", { class: "nb-d" }, st.detail),
        st.status !== "done" && when(st) ? ui.h("div", { class: "nb-when" }, when(st)) : null,
        ui.h("div", { class: "nb-why" }, st.why)), ui.h("span", { class: "nb-chev", "aria-hidden": "true" }, "›")];
      return ui.h("li", { class: `nb-step ${st === n ? "now" : st.status}` }, ui.h("a", { href: `#/${st.go[0]}/${st.go[1]}` }, ...body));
    }))));
  root.append(ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Why this order"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" }, ui.h("ul", {},
      ui.h("li", {}, "It follows the order most planners agree on: the r/personalfinance wiki's \"prime directive\" and the Bogleheads' \"prioritizing investments\". Each step earns more, or protects more, than the ones after it."),
      ui.h("li", {}, `Expensive debt is anything at ${Math.round(HIGH_RATE * 100)}% or more; middling debt ${Math.round(MODERATE_RATE * 100)}% up to that. The mortgage is left to the last step: paying it early is a fine choice, not a must.`),
      ui.h("li", {}, "The dates assume every spare dollar goes to the steps in order, one-off amounts first, then this year's room in each account; interest on the debts and next year's new limits are left out, so they are about right, not exact."),
      ui.h("li", {}, "Spare money is pay after federal income tax (the Federal estimate page), Social Security and Medicare tax (7.65% of pay, 15.3% of 92.35% of self-employment profit), spending, and the saving already set up."),
    ))));
}

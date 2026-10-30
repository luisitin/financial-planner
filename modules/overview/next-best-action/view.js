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
  const when = (s) => s.doneDate ? `Done by about ${month(s.doneDate)} at ${money(Math.max(0, d.spare.monthly))} a month.` : s.startDate ? `From ${month(s.startDate)}: about ${money(s.monthly)} a month${s.monthly < s.roomYearly / 12 - 5 ? ` of the ${money(s.roomYearly / 12)} it could take` : ""}.` : null;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("p", { class: "muted small", style: { margin: "0 0 4px" } }, n ? "Your next step" : "Every step is done"),
    ui.h("h1", {}, n ? n.title : "Your choice from here"),
    ui.h("p", { class: "lede" }, n ? n.detail : "Bills covered, cushion full, debt handled, the tax-sheltered accounts full. From here it is priorities, not rules."),
    n && when(n) ? ui.h("p", {}, when(n)) : null,
    n ? ui.row(ui.h("a", { class: "btn", href: `#/${n.go[0]}/${n.go[1]}` }, "Open the page")) : null));

  // each month's money
  const s = d.spare;
  const parts = [["Federal income tax", s.federalTax, "var(--muted)"], ["Social Security and Medicare tax", s.payrollTax, "var(--line-2)"], ["Spending", s.spending, "var(--text-2)"], ["Retirement saving", s.retirementSaving, "var(--ok)"], ["Saving for goals", s.goalSaving, "var(--accent)"]];
  const total = Math.max(s.gross, parts.reduce((t, p) => t + p[1], 0));
  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "Each month's money"),
    ui.h("div", { class: "nb-bar", role: "img", "aria-label": "Where each month's pay goes" }, [...parts, ["Spare", Math.max(0, s.monthly), "var(--accent-soft)"]].map(([, v, c]) => ui.h("span", { style: { width: `${(v / total) * 100}%`, background: c } }))),
    ui.h("ul", { class: "nb-key" },
      ui.h("li", {}, ui.h("i", { style: { background: "transparent" } }), ui.h("span", { class: "t" }, "Pay and other income, before tax"), ui.h("span", {}, money(s.gross))),
      parts.map(([t, v, c]) => ui.h("li", {}, ui.h("i", { style: { background: c } }), ui.h("span", { class: "t" }, t), ui.h("span", {}, `- ${money(v)}`))),
      ui.h("li", {}, ui.h("i", { style: { background: "var(--accent-soft)", border: "1px solid var(--accent)" } }), ui.h("span", { class: "t" }, s.monthly >= 0 ? "Spare each month" : "Short each month"), ui.h("span", { class: s.monthly < 0 ? "bad" : null }, money(s.monthly)))),
    ui.h("p", { class: "muted small" }, "State and local income tax is not counted yet. Spending is the Expenses page's monthly total; saving is what the Contributions and Goals pages already put away.")));

  // the order
  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "The order"),
    ui.h("ol", { class: "nb-steps" }, d.steps.map((st, i) => {
      const body = [ui.h("span", { class: "nb-num", "aria-hidden": "true" }, st.status === "done" ? "✓" : st.status === "check" ? "?" : String(i)), ui.h("span", { class: "nb-body" },
        ui.h("div", { class: "nb-t" }, st.title, st.status === "check" ? ui.h("span", { class: "pill warn" }, "check") : st === n ? ui.h("span", { class: "pill accent" }, "next") : null),
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

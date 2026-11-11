// modules/overview/next-best-action/view.js -- DOM only. The next step for the next spare dollar as the
// hero, where each month's money goes now, then the whole order with what is left on each step and
// about when the spare money gets it done.
import { compute, monthLines, HIGH_RATE, MODERATE_RATE } from "./compute.js";

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
  // the month's own figures (left over, spending, saving, pay): to the dollar as the Dashboard says them, also with uneven pay held back
  // (wording follow-up n01, review D1). Goal amounts stay at the $10 their own pages show.
  const mo = (n) => fmt.money(Math.round(n), cur);
  const month = (iso) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "nb-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Next best action"),
      ui.h("p", { class: "lede" }, "What to do with your next spare dollar, in the order most planners agree on: the bills, a starter emergency fund, the employer match, expensive debt, a full emergency fund, then the tax-sheltered accounts. It needs:"),
      ui.h("ul", {}, d.missing.map((m) => ui.h("li", {}, m))), ui.row(ui.h("a", { class: "btn", href: "#/cashflow/income" }, "Income"), ui.h("a", { class: "btn secondary", href: "#/cashflow/expenses" }, "Expenses"))));
    return;
  }
  const n = d.next;
  // the saved debt plan's extra joins the spare money once its debts are gone: a date reached with it says so
  const freed = d.debtPlan?.until ? ` with the ${mo(d.debtPlan.extra)} a month that frees up after ${month(d.debtPlan.until)}` : "";
  // the tax step paid from the cash already kept apart for tax: today, not "at $X a month" of spare money
  // a step after the goals step (round 8 item 3: the goals now come before the full cushion) gets what is left once the
  // goals have their monthly, not the whole spare money: "at $3,530 a month" read as if a $20,580 cushion took 6 months
  const gs = d.steps.find((x) => x.id === "goals" && x.startDate && x.monthly > 0);
  const afterGoals = (s) => !!gs && s.n > gs.n && s.gap > 0 && !!s.doneDate && s.doneDate.slice(0, 7) > gs.startDate.slice(0, 7);
  // (the match: its detail says what it takes from take-home pay and where that comes from; a "From ...: about $X a month of the
  // $83 it could take" line beside it would read as a choice of how much, review D2)
  const when = (s) => s.id === "match" ? null : s.fromSavings > 0 && !s.gap ? "From savings, today." : s.id === "tax" && !s.gap && s.doneDate ? "From the cash kept apart for tax, today." : s.doneDate ? `Done by about ${month(s.doneDate)}${afterGoals(s) ? " with what is left each month once the goals have theirs" : d.spare.monthly >= 5 ? ` at ${mo(d.spare.monthly)} a month` : ""}${freed && s.doneDate > d.debtPlan.until ? `${d.spare.monthly >= 5 ? ", then more" : ""}${freed}` : ""}.` : s.startDate ? `From ${month(s.startDate)}: about ${money(s.monthly)} a month${s.monthly < s.roomYearly / 12 - 5 ? ` of the ${money(s.roomYearly / 12)} it could take` : ""}.` : null;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("p", { class: "muted small", style: { margin: "0 0 4px" } }, n ? "Your next step" : "Every step is done"),
    ui.h("h1", {}, n ? n.title : d.drawing ? "Living on your savings, as planned" : "Your choice from here"),
    // retired and drawing as planned: say that, not "the tax-sheltered accounts full"
    ui.h("p", { class: "lede" }, n ? n.detail : d.drawing ? `About ${mo(-d.spare.monthly)} a month comes from savings. If markets do as well as average, the plan can pay for about ${money(d.drawing.affordableMonthly)} a month of spending and the money lasts; less in a bad run of years (Will the money last? shows how much less). Check it once a year, or after a big fall in the markets.` : "Bills covered, emergency fund full, debt handled, the tax-sheltered accounts full. From here it is priorities, not rules."),
    n && when(n) ? ui.h("p", {}, when(n)) : null,
    n ? ui.row(ui.h("a", { class: "btn", href: `#/${n.go[0]}/${n.go[1]}` }, "Open the page")) : null));

  // each month's money
  const s = d.spare;
  // the lines between the pay and the spare money (monthLines: they add up, the child care account's lost money a line of
  // its own, Review 2026-11-06), each with its colour in the bar
  const COLOURS = { businessCosts: "var(--panel-2)", federalTax: "var(--muted)", payrollTax: "var(--line-2)", stateTax: "repeating-linear-gradient(135deg, var(--muted) 0 3px, var(--line-2) 3px 6px)",
    careLost: "repeating-linear-gradient(45deg, var(--warn) 0 3px, var(--line-2) 3px 6px)", spending: "var(--text-2)", retirementSaving: "var(--ok)", goalSaving: "var(--accent)",
    debtExtra: "repeating-linear-gradient(45deg, var(--accent) 0 3px, var(--accent-soft) 3px 6px)", held: "var(--line)" };
  // most of the spending is our guesses (spare.waits, spec 8.1): the Spending line says how much is ours, and the last line is
  // what our guesses give, in the calm colour, never red (P7)
  const waits = s.waits === true;
  const parts = monthLines(s, d.debtPlan).map((x) => [x.key === "spending" && waits ? `Spending (${s.spending - s.guessedMonthly < 5 ? "all" : `about ${mo(s.guessedMonthly)}`} of it our guesses)` : x.label, x.amount, COLOURS[x.key] ?? "var(--line)"]);
  const total = Math.max(s.gross, parts.reduce((t, p) => t + p[1], 0));
  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "Each month's money"),
    ui.h("div", { class: "nb-bar", role: "img", "aria-label": "Where each month's pay goes" }, [...parts, ["Left over", Math.max(0, s.monthly), "var(--accent-soft)"]].map(([, v, c]) => ui.h("span", { style: { width: `${(Math.max(0, v) / total) * 100}%`, background: c } }))),
    ui.h("ul", { class: "nb-key" },
      ui.h("li", {}, ui.h("i", { style: { background: "transparent" } }), ui.h("span", { class: "t" }, d.drawing ? "Income before tax" : "Pay and other income, before tax"), ui.h("span", {}, mo(s.gross))),
      // a federal tax below zero is a refund from credits (the child tax credit's refundable part): it adds, so it reads "+"
      parts.map(([t, v, c]) => ui.h("li", {}, ui.h("i", { style: { background: c } }), ui.h("span", { class: "t" }, v < 0 && t === "Federal income tax" ? "Federal income tax: credits pay back more than the tax" : t), ui.h("span", {}, v < 0 ? `+ ${mo(-v)}` : `- ${mo(v)}`))),
      waits ? ui.h("li", {}, ui.h("i", { style: { background: "var(--accent-soft)", border: "1px solid var(--accent)" } }), ui.h("span", { class: "t" }, "With our guesses"), ui.h("span", { class: "muted" }, `about ${mo(Math.abs(s.monthly))} ${s.monthly < 0 ? "short" : "spare"}`))
        : ui.h("li", {}, ui.h("i", { style: { background: "var(--accent-soft)", border: "1px solid var(--accent)" } }), ui.h("span", { class: "t" }, s.monthly >= 0 ? "Left over each month" : d.drawing ? "From savings each month, as planned" : "Short each month"), ui.h("span", { class: s.monthly < 0 && !d.drawing ? "bad" : null }, d.drawing ? mo(-s.monthly) : mo(s.monthly)))),
    waits ? ui.h("p", {}, "Type what you really spend and this becomes your real figure.") : null,
    waits ? ui.row(ui.h("a", { class: "btn secondary", href: "#/overview/setup/spend?back=done" }, "Type what you spend \u203a")) : null,
    ui.h("p", { class: "muted small" }, `${s.stateTax > 0.5 ? "State income tax is the State tax page's rate on this income; local taxes are not counted." : s.stateKnown ? "" : "Your state's income tax is not counted yet: type its rate on the State tax page."} Spending is the Expenses page's monthly total; saving is what the Contributions and Goals pages already put away${s.held > 0.5 ? "; side income above the careful figure you count on (Side income) is left out of the spare: a bonus to save when it comes" : ""}${s.debtExtra > 0 ? `; the extra on debts is the plan saved on Pay off debts${d.debtPlan?.until ? `, until about ${month(d.debtPlan.until)}, then it is spare again` : ""}` : ""}.`.trim())));

  // the order
  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "The order"),
    ui.h("ol", { class: "nb-steps" }, d.steps.map((st, i) => {
      // a step resting on our guesses is never ticked (a cushion counted on guessed bills), and "type what you spend" is ✎
      const ticked = st.status === "done" && !st.waits;
      const body = [ui.h("span", { class: "nb-num", "aria-hidden": "true" }, ticked ? "✓" : st.id === "bills" && st.waits ? "✎" : st.status === "check" ? "?" : String(i)), ui.h("span", { class: "nb-body" },
        ui.h("div", { class: "nb-t" }, st.title, st.status === "check" ? ui.h("span", { class: "pill warn" }, "check") : st.status === "underway" ? ui.h("span", { class: "pill ok" }, "under way") : st === n ? ui.h("span", { class: "pill accent" }, "next") : null),
        ui.h("div", { class: "nb-d" }, st.detail),
        st.status !== "done" && when(st) ? ui.h("div", { class: "nb-when" }, when(st)) : null,
        ui.h("div", { class: "nb-why" }, st.why)), ui.h("span", { class: "nb-chev", "aria-hidden": "true" }, "›")];
      return ui.h("li", { class: `nb-step ${st === n ? "now" : st.status === "done" && !ticked ? "waits" : st.status}` }, ui.h("a", { href: `#/${st.go[0]}/${st.go[1]}` }, ...body));
    }))));
  root.append(ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Why this order"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" }, ui.h("ul", {},
      ui.h("li", {}, "It follows the order most planners agree on: the r/personalfinance wiki's \"prime directive\" and the Bogleheads' \"prioritizing investments\". Each step earns more, or protects more, than the ones after it."),
      ui.h("li", {}, `Expensive debt is anything at ${Math.round(HIGH_RATE * 100)}% or more; middling debt ${Math.round(MODERATE_RATE * 100)}% up to that. The mortgage is left to the last step: paying it early is a fine choice, not a must.`),
      ui.h("li", {}, "The dates assume every spare dollar goes to the steps in order, one-time amounts first, then this year's room in each account; interest on the debts and next year's new limits are left out, so they are about right, not exact."),
      ui.h("li", {}, "Spare money is pay after federal income tax (the Federal estimate page), Social Security and Medicare tax (7.65% of pay, 15.3% of 92.35% of self-employment profit), spending, and the saving already set up."),
    ))));
}

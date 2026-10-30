// modules/career/business/view.js -- DOM only. A small business from its owner's side: the year's profit and loss, the
// tax as a sole proprietor and what the owner can safely take out, an S corporation compared, the retirement plans for
// the self-employed with the tax each saves; the business's figures, its expenses and the S corporation's in folds.
import { compute, CATEGORIES } from "./compute.js";
import { PERIOD_OPTIONS } from "../../../core/math/periods.js";

let pending = null;   // the confirmation shown on the next render
let openFold = null;  // the fold just saved stays open

const STYLE = `
.bz-root .bz-lines { list-style: none; margin: 0; padding: 0; }
.bz-root .bz-lines li { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); }
.bz-root .bz-lines li:last-child { border-bottom: 0; }
.bz-root .bz-lines li span:last-child { white-space: nowrap; font-variant-numeric: tabular-nums; }
.bz-root .bz-lines .bz-tot { font-weight: 700; }
.bz-root .bz-say { margin: 8px 0; }
.bz-root .bz-add { margin-top: 10px; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const pct = (x) => `${Math.round(x * 100)}%`;
  const today = fmt.today();
  const d = compute(plan, { today });
  const s = plan.whatIfs?.business ?? {};
  const root = ui.h("div", { class: "bz-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const save = (msg, fn) => { pending = msg; store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.business = p.whatIfs.business ?? {}; fn(p.whatIfs.business, p); }); };
  const line = (label, amount, opts = {}) => ui.h("li", { class: opts.total ? "bz-tot" : null }, ui.h("span", {}, label), ui.h("span", {}, `${opts.minus ? "−" : ""}${money(amount)}`));

  if (!d.ready || !Object.keys(s).length) root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Your small business"),
    ui.h("p", { class: "lede" }, "The year's profit after expenses, the tax it brings and what you can safely pay yourself, whether an S corporation would save tax, and the retirement plans a business owner can open."),
    ui.h("p", { class: "muted small" }, d.ready ? "It starts from the business on the Income page. Add the revenue and the expenses below for the real profit." : "Add the business on the Income page as \"Self-employment / business\", or type the year's revenue below."),
    d.ready ? null : ui.row(ui.h("a", { class: "btn", href: "#/cashflow/income" }, "Add it on Income"))));
  for (const n of d.notes ?? []) root.append(ui.notice("info", n));

  if (d.ready) {
    // the profit and loss
    root.append(ui.card(`${d.name}, a year`, ui.row(
      ui.stat("Profit", money(d.profit), d.margin !== null ? `${pct(d.margin)} of what comes in` : "a year"),
      ui.stat("Costs a month", money(d.breakEvenMonthly), "what must come in each month to break even"),
    ), ui.h("ul", { class: "bz-lines" },
      line(d.revenueFrom === "typed" ? "What customers paid" : "What customers paid (the Income page)", d.revenue),
      ...d.expenses.map((e) => line(e.name, e.yearly, { minus: true })),
      d.miles.amount > 0 ? line(`Business miles (${Math.round(d.miles.miles).toLocaleString("en-US")} at ${Math.round(d.miles.rate * 1000) / 10}¢)`, d.miles.amount, { minus: true }) : null,
      d.homeOffice > 0 ? line("Home office ($5 a square foot)", d.homeOffice, { minus: true }) : null,
      line("Profit", d.profit, { total: true }))));

    // the tax as it runs now, and what the owner can take out
    const t = d.tax;
    const tax = ui.card("The tax, as a sole proprietor", ui.h("ul", { class: "bz-lines" },
      line("Self-employment tax (Social Security and Medicare)", t.se),
      line("Federal income tax", t.income),
      t.extra > 0.5 ? line("Extra Medicare tax", t.extra) : null,
      t.state > 0.5 ? line("State tax", t.state) : null,
      line(`In all${t.rate !== null ? `, ${pct(t.rate)} of profit` : ""}`, t.total, { total: true })),
    ui.h("p", { class: "muted small" }, `Half the self-employment tax${t.health > 0 ? ", the health insurance you pay" : ""} and the 20% business deduction (${money(t.qbi)}) come off income first.${d.qbiLimited ? ` Above ${money(d.qbiLine)} of taxable income the 20% deduction can be limited: check it with a tax preparer.` : ""}`),
    ui.h("p", { class: "bz-say" }, ui.h("b", {}, `After tax the business leaves you about ${money(d.keepMonthly)} a month.`)),
    d.draw === "over" ? ui.notice("warn", `You take out ${money(d.drawMonthly)} a month, ${money(d.drawMonthly - d.keepMonthly)} more than it leaves after tax: the difference comes from savings or the tax money.`)
      : d.draw === "ok" ? ui.h("p", {}, `You take out ${money(d.drawMonthly)} a month: within it, with ${money(d.keepMonthly - d.drawMonthly)} a month left in the business.`) : null);
    if (d.incomeId && d.singleBusiness) tax.append(ui.row(ui.button("Use these on Income and Self-employment", () => {
      pending = "The Income page now has what customers pay, and the Self-employment page the expenses.";
      store.update((p) => {
        const x = (p.income ?? []).find((y) => y.id === d.incomeId);
        if (x) { x.amount = Math.round(d.revenue / 12); x.period = "monthly"; }
        p.whatIfs = p.whatIfs ?? {}; p.whatIfs.selfEmployment = { ...(p.whatIfs.selfEmployment ?? {}), expenses: Math.round(d.expensesTotal) };
      });
    })), ui.h("p", { class: "muted small" }, "So the tax pages, the budget and the retirement plan count the same business."));
    root.append(tax);

    // an S corporation
    if (d.scorp) {
      const c = d.scorp;
      root.append(ui.card("As an S corporation", ui.row(
        ui.stat(c.saving > 0 ? "Would save" : "Would cost", money(Math.abs(c.saving)), "a year, after its own costs"),
        ui.stat("Your salary from it", money(c.salary), c.salaryFrom === "example" ? "60% of profit: only an example" : "as you typed it"),
      ), ui.h("ul", { class: "bz-lines" },
        line("Social Security and Medicare on the salary (both halves)", c.employee + c.employer),
        line("Federal income tax", c.federal),
        c.state > 0.5 ? line("State tax", c.state) : null,
        line(`Running costs${c.costsFrom === "example" ? " (an example)" : ""}`, c.costs),
        line("In all", c.total + c.costs, { total: true })),
      ui.h("p", { class: "muted small" }, `An S corporation pays Social Security and Medicare only on the salary, not on the profit passed to you. The IRS requires a reasonable salary for the work you do before you take the rest, so a low salary to save tax is not allowed; ${c.costsFrom === "example" ? `the ${money(c.costs)} of yearly costs (payroll, the corporate return, state fees) is an example too.` : "set the costs below to your quotes."}`)));
    }

    // the retirement plans
    const best = [...d.plans].sort((a, b) => b.room - a.room)[0];
    root.append(ui.card("Retirement plans for the business", ui.h("ul", { class: "records" }, d.plans.map((p) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, p.label), ui.h("span", { class: "rec-value" }, `up to ${money(p.room)}`)),
      ui.h("div", { class: "rec-sub" }, [p.saved > 0.5 ? `Putting in the most saves about ${money(p.saved)} in tax this year.` : null, {
        sep: "Only the business puts in: 20% of your earnings after half the self-employment tax. Can be opened and filled up to the tax-filing deadline, extensions included.",
        solo: "You put in as the employee (the yearly limit, shared with any 401(k) at a job) and as the employer (20%). Usually the most room for a one-person business.",
        simple: "You put in up to the SIMPLE limit, the business adds 3%. Usually opened by October 1 for that year.",
      }[p.key]].filter(Boolean).join(" "))))),
    ui.h("p", { class: "muted small" }, `Earnings for these plans: profit less half the self-employment tax, ${money(d.earned)}. ${best ? `${best.label} has the most room here.` : ""} The money is invested like a 401(k) or IRA and taxed when taken out.`),
    ui.row(ui.h("a", { class: "btn secondary", href: "#/taxes/self-employment" }, "Self-employment tax"), ui.h("a", { class: "btn secondary", href: "#/retirement/contributions" }, "Contributions"))));
  }

  // the business's figures
  const items = (plan.income ?? []).filter((x) => x.type === "business");
  const bizFields = [
    { key: "name", label: "Name of the business", type: "text" },
    items.length > 1 ? { key: "incomeId", label: "Which one on the Income page", type: "select", options: items.map((x) => ({ value: x.id, label: x.name || "Business" })) } : null,
    { key: "revenue", label: "What customers pay a year", type: "money", min: 0, help: d.ready && d.incomeYearly !== null ? `empty: the Income page's ${money(d.incomeYearly)}` : "before any expenses" },
    { key: "drawMonthly", label: "What you take out for yourself a month", type: "money", min: 0 },
    { key: "healthPremiums", label: "Health insurance you pay for yourself a year", type: "money", min: 0, help: "when no employer plan covers you; it comes off income" },
    { key: "homeOfficeSqft", label: "Home office, square feet", type: "number", min: 0, max: 2000, step: "1", help: "a room used only and regularly for the business; up to 300 count" },
    { key: "miles", label: "Business miles a year", type: "number", min: 0, step: "1", help: "not the drive from home to a regular workplace; keep a log" },
  ].filter(Boolean);
  root.append(ui.h("details", { class: "card fold fold-card", open: !Object.keys(s).length || openFold === "biz" || null }, ui.h("summary", {}, ui.h("h2", {}, "The business"), ui.h("span", { class: "fold-status" }, d.ready ? `${money(d.revenue)} a year` : "not set"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.form(bizFields, { name: s.name ?? "", incomeId: d.incomeId ?? "", revenue: s.revenue ?? null, drawMonthly: s.drawMonthly ?? null, healthPremiums: s.healthPremiums ?? null, homeOfficeSqft: s.homeOfficeSqft ?? null, miles: s.miles ?? null }, (v) => {
      openFold = "biz"; save("Saved.", (w) => { Object.assign(w, { ...v, name: String(v.name ?? "").trim() }); });
    }, { submitLabel: "Save" })));

  // expenses
  const expenses = s.expenses ?? [];
  const expFields = [
    { key: "name", label: "What it is", type: "text", placeholder: "e.g. camera lens" },
    { key: "category", label: "Kind", type: "select", options: Object.entries(CATEGORIES).map(([value, label]) => ({ value, label })) },
    { key: "amount", label: "Amount", type: "money", min: 0, required: true },
    { key: "period", label: "How often", type: "select", options: PERIOD_OPTIONS.filter((o) => o.value !== "once") },
  ];
  const expBody = ui.h("div", {});
  const expForm = () => ui.form(expFields, { category: "supplies", period: "monthly" }, (v) => {
    openFold = "exp"; save(`${v.name || CATEGORIES[v.category]} added.`, (w) => { w.expenses = [...(w.expenses ?? []), { id: ui.uid(), name: String(v.name ?? "").trim(), category: v.category, amount: v.amount ?? 0, period: v.period }]; });
  }, { submitLabel: "Add the expense" });
  if (expenses.length) {
    expBody.append(ui.h("ul", { class: "records" }, (d.expenses ?? []).map((e) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, e.name), ui.h("span", { class: "rec-value" }, `${money(e.yearly)} a year`)),
      ui.h("div", { class: "rec-sub" }, e.label),
      ui.h("div", { class: "rec-foot" }, ui.button("Remove", () => { openFold = "exp"; save(`${e.name} removed.`, (w) => { w.expenses = (w.expenses ?? []).filter((x) => x.id !== e.id); }); }, { class: "secondary small" }))))));
    const box = ui.h("div", { class: "bz-add" });
    const b = ui.button("+ Add another expense", () => { b.remove(); box.append(expForm()); }, { class: "secondary" });
    box.append(ui.row(b));
    expBody.append(box);
  } else expBody.append(expForm());
  root.append(ui.h("details", { class: "card fold fold-card", open: openFold === "exp" || (d.ready && !expenses.length && !!Object.keys(s).length) || null }, ui.h("summary", {}, ui.h("h2", {}, "Expenses"), ui.h("span", { class: "fold-status" }, expenses.length ? `${money(d.typedTotal ?? 0)} a year` : "none yet"), ui.h("span", { class: "fold-chev" }, "›")), expBody));

  // the S corporation's figures
  if (d.ready && d.scorp) root.append(ui.h("details", { class: "card fold fold-card", open: openFold === "scorp" || null }, ui.h("summary", {}, ui.h("h2", {}, "S corporation figures"), ui.h("span", { class: "fold-status" }, d.scorp.salaryFrom === "example" ? "examples" : "yours"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.form([
      { key: "salary", label: "A reasonable salary for your work, a year", type: "money", min: 0, help: "what you would pay someone else to do it; empty: 60% of profit, an example" },
      { key: "scorpCosts", label: "Its running costs a year", type: "money", min: 0, help: "payroll service, the corporate return, state fees; empty: $2,000, an example" },
    ], { salary: s.salary ?? null, scorpCosts: s.scorpCosts ?? null }, (v) => { openFold = "scorp"; save("Saved.", (w) => { w.salary = v.salary; w.scorpCosts = v.scorpCosts; }); }, { submitLabel: "Compare" })));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/career/side-income" }, "Side income"), ui.h("a", { class: "btn secondary", href: "#/taxes/estimated" }, "Quarterly payments"))));
}

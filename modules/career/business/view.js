// modules/career/business/view.js -- DOM only. A small business from its owner's side: the year's profit and loss, the
// tax as a sole proprietor and what the owner can safely take out, an S corporation compared, the retirement plans for
// the self-employed with the tax each saves; the business's figures, its expenses and the S corporation's in folds.
import { compute, CATEGORIES } from "./compute.js";
import { HOME_OFFICE, SCORP_COSTS_EXAMPLE } from "./data/business.js";
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
      ui.stat(d.loss ? "Loss" : "Profit", money(Math.abs(d.profit)), d.loss ? "a year: more went out than came in" : d.margin !== null ? `${pct(d.margin)} of what comes in` : "a year"),
      ui.stat("Costs a month", money(d.breakEvenMonthly), "what must come in each month to break even"),
    ), ui.h("ul", { class: "bz-lines" },
      line(d.revenueFrom === "typed" ? "What customers paid" : "What customers paid (the Income page)", d.revenue),
      ...d.expenses.map((e) => line(e.deductible < e.yearly - 0.5 ? `${e.name} (half of ${money(e.yearly)} counts)` : e.name, e.deductible, { minus: true })),
      d.miles.amount > 0 ? line(`Business miles (${Math.round(d.miles.miles).toLocaleString("en-US")} at ${Math.round(d.miles.rate * 1000) / 10}¢)`, d.miles.amount, { minus: true }) : null,
      d.homeOffice > 0 ? line(`Home office (${money(HOME_OFFICE.perSqft)} a square foot)`, d.homeOffice, { minus: true }) : null,
      line(d.loss ? "Loss" : "Profit", Math.abs(d.profit), { total: true, minus: d.loss }))));

    // the tax as it runs now, and what the owner can take out
    const t = d.tax;
    const off = [t.se > 0.5 ? "half the self-employment tax" : null, t.health > 0.5 ? "the health insurance you pay" : null].filter(Boolean);
    const tax = d.loss ? ui.card("The tax", ui.h("p", {}, t.total < -0.5
      ? `A loss comes off the household's other income: it lowers this year's tax by about ${money(-t.total)}. There is no self-employment tax on a loss.`
      : "A loss brings no self-employment tax, and there is no other income for it to come off this year."),
    ui.h("p", { class: "bz-say" }, ui.h("b", {}, `After that the business costs you about ${money(-d.keepMonthly)} a month.`)),
    d.drawMonthly > 0 ? ui.notice("warn", `You take out ${money(d.drawMonthly)} a month as well: all of it comes from savings while the business loses money.`) : null)
      : ui.card("The tax, run in your own name (a sole proprietor)", ui.h("ul", { class: "bz-lines" },
        line("Self-employment tax (Social Security and Medicare)", t.se),
        line("Federal income tax", t.income),
        t.extra > 0.5 ? line("Extra Medicare tax", t.extra) : null,
        t.state > 0.5 ? line("State tax", t.state) : null,
        line(`In all${t.rate !== null ? `, ${pct(t.rate)} of profit` : ""}`, t.total, { total: true })),
      off.length || t.qbi > 0.5 ? ui.h("p", { class: "muted small" }, [off.length ? `${off.join(" and ").replace(/^./, (c) => c.toUpperCase())} come${off.length > 1 ? "" : "s"} off income.` : null, t.qbi > 0.5 ? `The 20% business deduction takes ${money(t.qbi)} off taxable income.` : null, d.qbiLimited ? `Above ${money(d.qbiLine)} of taxable income the 20% deduction can be limited: check it with a tax preparer.` : null].filter(Boolean).join(" ")) : null,
      ui.h("p", { class: "bz-say" }, ui.h("b", {}, d.keepMonthly >= 0 ? `After tax the business leaves you about ${money(d.keepMonthly)} a month.` : `After tax the business costs you about ${money(-d.keepMonthly)} a month.`)),
      d.draw === "over" ? ui.notice("warn", `You take out ${money(d.drawMonthly)} a month, ${money(d.drawMonthly - d.keepMonthly)} more than it leaves after tax: the difference comes from savings or from the money you should keep for tax.`)
        : d.draw === "ok" ? ui.h("p", {}, `You take out ${money(d.drawMonthly)} a month; that leaves ${money(d.keepMonthly - d.drawMonthly)} a month in the business.`) : null);
    // put this profit on Income (what the federal estimate, the budget and the retirement plan count) and fold the
    // Self-employment page's expenses in here, so every page counts the same profit
    const synced = d.incomeYearly !== null && Math.abs(d.incomeYearly - d.profit) < 12 && !(d.seExpenses > 0);
    if (synced && d.typedHere) tax.append(ui.h("p", { class: "muted small" }, "The Income page counts this profit, so the other pages agree with this one."));
    else if (d.incomeId && d.singleBusiness && d.typedHere && d.profit > 0) tax.append(ui.row(ui.button("Use this profit on Income", () => {
      pending = `The Income page now counts the profit, ${money(d.profit / 12)} a month.${d.seExpenses > 0 ? " The Self-employment page's expenses are part of it now, so that page shows none." : ""}`;
      store.update((p) => {
        const x = (p.income ?? []).find((y) => y.id === d.incomeId);
        if (x) { x.amount = Math.round(d.profit / 12); x.period = "monthly"; }
        p.whatIfs = p.whatIfs ?? {}; p.whatIfs.business = p.whatIfs.business ?? {};
        const w = p.whatIfs.business;
        w.revenue = Math.round(d.revenue);   // kept here, since Income now holds the profit
        if (!(w.expenses ?? []).length && d.seExpenses > 0) w.expenses = [{ id: ui.uid(), name: "Expenses from the Self-employment page", category: "other", amount: d.seExpenses, period: "annual" }];
        p.whatIfs.selfEmployment = { ...(p.whatIfs.selfEmployment ?? {}), expenses: 0 };
      });
    })), ui.h("p", { class: "muted small" }, `Income then holds the profit, ${money(d.profit / 12)} a month, so the federal estimate, the Self-employment page, the budget and the retirement plan all count the same business. This page keeps what customers pay and the expenses.`));
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
    const links = ui.row(ui.h("a", { class: "btn secondary", href: "#/taxes/self-employment" }, "Self-employment tax"), ui.h("a", { class: "btn secondary", href: "#/retirement/contributions" }, "Contributions"));
    const thisYear = d.year === Number(today.slice(0, 4)) ? "this year" : `for ${d.year}`;
    if (d.earned < 0.5) root.append(ui.card("Retirement plans for the business", ui.h("p", {}, "No earnings from the business this year, so nothing can go into a business retirement plan. A plan at a job, or an IRA, still can."), links));
    else {
      const best = d.plans.find((p) => p.key === d.best);
      root.append(ui.card("Retirement plans for the business", ui.h("ul", { class: "records" }, d.plans.map((p) => ui.h("li", {},
        ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, p.label), ui.h("span", { class: "rec-value" }, p.late ? "too late now" : `up to ${money(p.room)}`)),
        ui.h("div", { class: "rec-sub" }, [p.saved > 0.5 ? `Putting in the most saves about ${money(p.saved)} in tax ${thisYear}.` : null, {
          sep: "Only the business puts in: 20% of your earnings after half the self-employment tax. Can be opened and filled up to the tax-filing deadline, extensions included.",
          solo: "You put in as the employee (the yearly limit, shared with any 401(k) at a job, more from age 50) and as the business (20%). Often the most room for a one-person business. A new one can still be set up for this year until the April tax-filing deadline.",
          simple: p.late ? `A new SIMPLE IRA must be set up by October 1 to count for that year, so it is too late for ${d.year}; you could open one for ${d.year + 1}. It would allow about ${money(p.room)}.`
            : `You put in up to ${money(d.simpleLimit)} a year (more from age 50), and the business adds the same, up to 3% of your pay. A new one must be set up by October 1 to count for that year.`,
        }[p.key]].filter(Boolean).join(" "))))),
      d.job401k ? ui.h("p", { class: "muted small" }, `A 401(k) at a job already uses ${money(d.job401k.used)} of the ${money(d.job401k.limit)} a person may put in a year, so the solo 401(k) and the SIMPLE IRA have less room.`) : null,
      ui.h("p", { class: "muted small" }, `Earnings for these plans: profit less half the self-employment tax, ${money(d.earned)} (the SIMPLE IRA counts 92.35% of profit, ${money(d.simpleComp)}). ${best ? `${best.label} has the most room here.` : ""} The money is invested like a 401(k) or IRA and taxed when taken out.`),
      links));
    }
  }

  // the business's figures
  const items = (plan.income ?? []).filter((x) => x.type === "business");
  const bizFields = [
    { key: "name", label: "Name of the business", type: "text" },
    items.length > 1 ? { key: "incomeId", label: "Which one on the Income page", type: "select", options: items.map((x) => ({ value: x.id, label: x.name || "Business" })) } : null,
    { key: "revenue", label: "What customers pay a year", type: "money", min: 0, help: d.ready && d.incomeYearly !== null ? `before any expenses; leave empty to use the Income page's ${money(d.incomeYearly)}` : "before any expenses" },
    { key: "drawMonthly", label: "What you take out for yourself a month", type: "money", min: 0 },
    { key: "healthPremiums", label: "Health insurance you pay for yourself a year", type: "money", min: 0, help: "when no employer plan covers you; it comes off income" },
    { key: "homeOfficeSqft", label: "Home office, square feet", type: "number", min: 0, max: 2000, step: "1", help: "a room used only and regularly for the business; up to 300 count" },
    { key: "miles", label: "Business miles a year", type: "number", min: 0, step: "1", help: "not the drive from home to a regular workplace; keep a log" },
  ].filter(Boolean);
  root.append(ui.h("details", { class: "card fold fold-card", open: !Object.keys(s).length || !d.ready || openFold === "biz" || null }, ui.h("summary", {}, ui.h("h2", {}, "The business"), ui.h("span", { class: "fold-status" }, d.ready ? `${money(d.revenue)} a year` : "not set"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.form(bizFields, { name: s.name ?? "", incomeId: d.incomeId ?? "", revenue: s.revenue ?? null, drawMonthly: s.drawMonthly ?? null, healthPremiums: s.healthPremiums ?? null, homeOfficeSqft: s.homeOfficeSqft ?? null, miles: s.miles ?? null }, (v) => {
      openFold = "biz"; save("Saved.", (w) => { Object.assign(w, { ...v, name: String(v.name ?? "").trim() }); });
    }, { submitLabel: "Save" })));

  // expenses
  const expenses = d.expenses ?? [];
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
    expBody.append(ui.h("ul", { class: "records" }, expenses.map((e) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, e.name), ui.h("span", { class: "rec-value" }, `${money(e.yearly)} a year`)),
      e.fromSelfEmployment ? ui.h("div", { class: "rec-sub" }, "Typed there as one figure. Add your expenses here one by one to replace it.")
        : e.deductible < e.yearly - 0.5 ? ui.h("div", { class: "rec-sub" }, `${e.name === e.label ? "" : `${e.label}: `}half of it counts for tax (${money(e.deductible)})`)
        : e.name !== e.label ? ui.h("div", { class: "rec-sub" }, e.label) : null,
      e.fromSelfEmployment ? null : ui.h("div", { class: "rec-foot" }, ui.button("Remove", () => { openFold = "exp"; save(`${e.name} removed.`, (w) => { w.expenses = (w.expenses ?? []).filter((x) => x.id !== e.id); }); }, { class: "secondary small" }))))));
    const box = ui.h("div", { class: "bz-add" });
    const b = ui.button("+ Add another expense", () => { b.remove(); box.append(expForm()); }, { class: "secondary" });
    box.append(ui.row(b));
    expBody.append(box);
  } else expBody.append(expForm());
  root.append(ui.h("details", { class: "card fold fold-card", open: openFold === "exp" || (d.ready && !expenses.length && !!Object.keys(s).length) || null }, ui.h("summary", {}, ui.h("h2", {}, "Expenses"), ui.h("span", { class: "fold-status" }, expenses.length ? `${money(d.typedTotal ?? 0)} a year` : "none yet"), ui.h("span", { class: "fold-chev" }, "›")), expBody));

  // the S corporation's figures
  if (d.ready && d.scorp) root.append(ui.h("details", { class: "card fold fold-card", open: openFold === "scorp" || null }, ui.h("summary", {}, ui.h("h2", {}, "S corporation figures"), ui.h("span", { class: "fold-status" }, d.scorp.salaryFrom === "example" ? "examples" : "yours"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.form([
      { key: "salary", label: "A reasonable salary for your work, a year", type: "money", min: 0, help: "what you would pay someone else to do the work; leave empty to use 60% of profit, an example" },
      { key: "scorpCosts", label: "Its running costs a year", type: "money", min: 0, help: `payroll service, the corporate return, state fees; leave empty to use ${money(SCORP_COSTS_EXAMPLE)}, an example` },
    ], { salary: s.salary ?? null, scorpCosts: s.scorpCosts ?? null }, (v) => { openFold = "scorp"; save("Saved.", (w) => { w.salary = v.salary; w.scorpCosts = v.scorpCosts; }); }, { submitLabel: "Compare" })));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/career/side-income" }, "Side income"), ui.h("a", { class: "btn secondary", href: "#/taxes/estimated" }, "Quarterly payments"))));
}

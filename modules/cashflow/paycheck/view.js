// modules/cashflow/paycheck/view.js -- DOM only. Each earner's paycheck as a pay stub in plain words: pay, what comes out
// before tax, the taxes, what comes out after, the take-home; where each $100 goes, when Social Security stops and the
// extra Medicare starts, what the employer adds; the W-4 and the deductions in a fold.
import { compute, W4_STATUSES } from "./compute.js";

let pending = null;   // the confirmation shown on the next render
let openFold = null;  // the person whose fold was just saved stays open

const STYLE = `
.pc-root .pc-lines { list-style: none; margin: 0; padding: 0; }
.pc-root .pc-lines li { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); }
.pc-root .pc-lines li:last-child { border-bottom: 0; }
.pc-root .pc-lines li span:last-child { white-space: nowrap; font-variant-numeric: tabular-nums; }
.pc-root .pc-lines .pc-tot { font-weight: 700; }
.pc-root .pc-lines .pc-head { color: var(--muted); font-size: var(--fs-xs, 12px); text-transform: uppercase; letter-spacing: .04em; padding-top: 12px; }
.pc-root .pc-say { margin: 8px 0; }
`;
const EVERY = { 52: "every week", 26: "every two weeks", 24: "twice a month", 12: "every month" };

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const cents = (n) => fmt.money(Math.round(n * 100) / 100, cur);
  const today = fmt.today();
  const d = compute(plan, { today });
  const root = ui.h("div", { class: "pc-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Your paycheck, from pay to take-home"),
      ui.h("p", { class: "lede" }, "What comes out of each paycheck and why: savings and benefits before tax, federal and state income tax, Social Security and Medicare, and what is left for you."),
      ui.h("p", { class: "muted small" }, d.why === "no-person" ? "Your pay is on the Income page, but not as anyone's: open it there and set Whose to the person paid." : "Add your pay on the Income page as a salary, with how often you are paid."),
      ui.row(ui.h("a", { class: "btn", href: "#/cashflow/income" }, "Open Income"))));
    return;
  }
  for (const n of d.notes) root.append(ui.notice("info", n));

  for (const p of d.people) {
    const line = (label, amount, opts = {}) => ui.h("li", { class: opts.total ? "pc-tot" : null }, ui.h("span", {}, label), ui.h("span", {}, `${opts.minus ? "−" : ""}${cents(amount)}`));
    const head = (label) => ui.h("li", { class: "pc-head" }, ui.h("span", {}, label));
    const every = EVERY[p.paychecks] ?? `${p.paychecks} times a year`;
    const fedLabel = p.federal.from === "estimate" ? "Federal income tax (estimate)" : p.federal.from === "withholding" ? "Federal income tax (Withholding page)" : "Federal income tax";
    const stateLine = p.state.from === "typed" ? line("State income tax", p.state.amount, { minus: true })
      : p.state.from === "rate" && p.state.amount > 0.005 ? line("State income tax (about)", p.state.amount, { minus: true })
      : p.state.from === "no-tax" ? line("State income tax (none in your state)", 0) : null;
    const card = ui.card(`${p.name}'s paycheck`, ui.row(
      ui.stat("Take-home", money(p.net), `a paycheck, ${every}; about ${money(p.monthly)} a month`),
      ui.stat("Pay", money(p.gross), `a paycheck before anything comes out${p.jobs > 1 ? ` (${p.jobs} jobs together)` : ""}`),
    ), ui.h("ul", { class: "pc-lines" },
      line("Pay", p.gross),
      p.pretax.length ? head("Before tax") : null,
      ...p.pretax.map((x) => line(x.label, x.amount, { minus: true })),
      head("Taxes"),
      line(fedLabel, p.federal.amount, { minus: true }),
      line("Social Security", p.ss, { minus: true }),
      line("Medicare", p.medicare, { minus: true }),
      stateLine,
      p.aftertax.length ? head("After tax") : null,
      ...p.aftertax.map((x) => line(x.label, x.amount, { minus: true })),
      line("Take-home", p.net, { total: true })),
    ui.h("p", { class: "pc-say" }, `Of every $100 of pay: $${Math.round(p.shares.taxes)} goes in tax${p.shares.saved >= 0.5 ? `, $${Math.round(p.shares.saved)} into savings` : ""}${p.shares.benefits >= 0.5 ? `, $${Math.round(p.shares.benefits)} to benefits` : ""}, and $${Math.round(p.shares.net)} reaches your account.`));
    const year = [];
    if (p.ssStopsAfter && p.ssStopsAfter < p.paychecks) year.push(`Social Security stops after paycheck ${p.ssStopsAfter} of the year, once this job's pay reaches the year's limit, so the last ${p.paychecks - p.ssStopsAfter} take home about ${money(p.ss)} more.`);
    if (p.extraMedicareFrom && p.extraMedicareFrom <= p.paychecks) year.push(`From paycheck ${p.extraMedicareFrom}, Medicare takes 0.9% more: pay above $200,000 in a year.`);
    if (p.employer.match > 0.5 || p.employer.hsa > 0.5) year.push(`On top of this, the employer puts ${[p.employer.match > 0.5 ? `${money(p.employer.match)} into the 401(k)` : null, p.employer.hsa > 0.5 ? `${money(p.employer.hsa)} into the HSA` : null].filter(Boolean).join(" and ")} each paycheck, and pays its own ${money(p.employer.payroll)} of Social Security and Medicare.`);
    else year.push(`The employer also pays its own ${money(p.employer.payroll)} of Social Security and Medicare for you each paycheck.`);
    card.append(ui.h("p", { class: "muted small" }, year.join(" ")));
    const w4Name = W4_STATUSES[p.federal.w4.status];
    card.append(ui.h("p", { class: "muted small" }, p.federal.from === "estimate"
      ? `The federal tax is worked the way payroll does it (IRS Publication 15-T) for a W-4 marked "${w4Name}"${p.federal.w4.step2 ? " with the two-jobs box ticked" : ""}${p.federal.w4.credits || p.federal.w4.otherIncome || p.federal.w4.deductions || p.federal.w4.extra ? " and the amounts you typed" : ", nothing else filled in"}. Type the figure from your pay stub below to make it exact.`
      : p.federal.from === "withholding" ? "The federal tax is the figure typed on the Withholding page." : `The federal tax is the figure from your pay stub; the IRS method gives ${cents(p.federal.estimate)} for the W-4 below.`));
    const onPage = plan.taxes?.withholding?.[p.key];
    if (p.federal.from !== "withholding" && Math.abs((Number(onPage?.perPaycheck) || 0) - p.federal.amount) > 0.5) {
      card.append(ui.row(ui.button(`Use ${cents(p.federal.amount)} on the Withholding page`, () => {
        pending = `The Withholding page now counts ${cents(p.federal.amount)} of federal tax from each of ${p.name}'s paychecks.`;
        store.update((q) => { q.taxes = q.taxes ?? {}; q.taxes.withholding = q.taxes.withholding ?? {}; q.taxes.withholding[p.key] = { perPaycheck: Math.round(p.federal.amount * 100) / 100, period: p.period }; });
      }, { class: "secondary" })), ui.h("p", { class: "muted small" }, "So the Withholding page can say whether the year's paychecks cover the year's tax."));
    }
    root.append(card);

    // the W-4 and the deductions
    const s = plan.whatIfs?.paycheck?.[p.id] ?? {};
    const fields = [
      { key: "paychecks", label: "Paychecks a year", type: "select", options: [{ value: "", label: `As on Income (${p.paychecksFrom === "assumed" ? "26 assumed" : p.paychecks})` }, { value: "52", label: "52: every week" }, { value: "26", label: "26: every two weeks" }, { value: "24", label: "24: twice a month" }, { value: "12", label: "12: every month" }] },
      { key: "federal", label: "Federal income tax on your pay stub, a paycheck", type: "money", min: 0, help: "leave empty to work it out from the W-4 below" },
      { key: "w4Status", label: "W-4: filing status (Step 1c)", type: "select", options: Object.entries(W4_STATUSES).map(([value, label]) => ({ value, label })) },
      { key: "step2", label: "W-4: the two-jobs box in Step 2 is ticked", type: "checkbox" },
      { key: "credits", label: "W-4 Step 3: credits for children and others, a year", type: "money", min: 0 },
      { key: "otherIncome", label: "W-4 Step 4(a): other income, a year", type: "money", min: 0 },
      { key: "deductions", label: "W-4 Step 4(b): deductions, a year", type: "money", min: 0 },
      { key: "extra", label: "W-4 Step 4(c): extra withheld, a paycheck", type: "money", min: 0 },
      { key: "health", label: "Health, dental and vision cover, a paycheck", type: "money", min: 0, help: "what your pay stub takes before tax" },
      { key: "hsa", label: "Health savings account (HSA), a paycheck", type: "money", min: 0, help: "leave empty to use the plan's HSA saving or the Benefits page" },
      { key: "fsa", label: "Health spending account (FSA), a paycheck", type: "money", min: 0, help: "leave empty to use the Benefits page" },
      { key: "dcfsa", label: "Child care spending account, a paycheck", type: "money", min: 0, help: "leave empty to use the Benefits page" },
      { key: "commuter", label: "Transit and parking, a paycheck", type: "money", min: 0, help: "leave empty to use the Benefits page" },
      { key: "roth", label: "Roth 401(k), a paycheck", type: "money", min: 0, help: "taken after tax" },
      { key: "afterTax", label: "Other deductions after tax, a paycheck", type: "money", min: 0, help: "union dues, life cover above $50,000, a loan from the 401(k)" },
      { key: "state", label: "State income tax on your pay stub, a paycheck", type: "money", min: 0, help: p.state.from === "rate" ? `leave empty to use the State tax page's rate${p.state.rate ? `, ${(p.state.rate * 100).toFixed(2)}%` : ""}` : "leave empty to use the State tax page" },
    ];
    const values = { ...s, paychecks: s.paychecks ? String(s.paychecks) : "", w4Status: p.federal.w4.status, step2: !!s.step2 };
    const typed = Object.keys(s).some((k) => s[k] !== null && s[k] !== "" && s[k] !== false);
    root.append(ui.h("details", { class: "card fold fold-card", open: openFold === p.id || null }, ui.h("summary", {}, ui.h("h2", {}, `${p.name}: W-4 and deductions`), ui.h("span", { class: "fold-status" }, typed ? "yours" : "from the plan"), ui.h("span", { class: "fold-chev" }, "›")),
      ui.h("p", { class: "muted small" }, "Copy these from the pay stub and the W-4 you gave your employer. Anything left empty comes from the rest of the plan."),
      ui.form(fields, values, (v) => {
        openFold = p.id; pending = `${p.name}'s paycheck saved.`;
        store.update((q) => {
          q.whatIfs = q.whatIfs ?? {}; q.whatIfs.paycheck = q.whatIfs.paycheck ?? {};
          q.whatIfs.paycheck[p.id] = { ...v, paychecks: v.paychecks ? Number(v.paychecks) : null, step2: !!v.step2 };
        });
      }, { submitLabel: "Save" })));
  }
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/taxes/withholding" }, "Withholding"), ui.h("a", { class: "btn secondary", href: "#/career/benefits" }, "Benefits"), ui.h("a", { class: "btn secondary", href: "#/cashflow/budget" }, "Budget"))));
}

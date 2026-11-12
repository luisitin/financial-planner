// modules/reports/statements/view.js -- DOM only. The three statements as a printable sheet: the
// balance sheet (by kind and by owner), the income statement (a year from the plan, and the last
// twelve months from the bank files), and the cash-flow statement.
import { reportFrame, rtable, section, list, settleReport } from "../report-kit.js";

export function render(page, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const neg = (n) => `(${money(Math.abs(n))})`;
  const longDate = (iso) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const monthYear = (ym) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const host = ui.h("div", {}, ui.notice("info", "Drawing up the statements..."));
  page.append(host);
  settleReport(ctx.computeRemote("reports/statements", { today: fmt.today() }), host, ui, "financial statements", (d) => {
    host.replaceChildren();
    if (!d || !d.ready) {
      host.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Financial statements"),
        ui.h("p", { class: "lede" }, "Your household's three statements, the way a business keeps them: a balance sheet (what you own and owe), an income statement (a year of income, tax, spending and saving) and a cash-flow statement (where a year's money goes). It needs:"),
        ui.h("ul", {}, (d?.missing ?? []).map((m) => ui.h("li", {}, m))), ui.row(ui.h("a", { class: "btn", href: "#/balance/net-worth" }, "Net worth"))));
      return;
    }
    const { wrap, sheet } = reportFrame(ui, { title: "Financial statements" });
    host.append(wrap);
    const b = d.balance;
    const line = (label, amount, opts = {}) => ({ label, amount, ...opts });
    const stmt = (rows) => rtable(ui, [{ label: "", get: (r) => (r.bold ? ui.h("b", {}, r.label) : r.indent ? ui.h("span", { style: { paddingLeft: "14px", display: "inline-block" } }, r.label) : r.label) }, { label: "", num: true, get: (r) => (r.amount === null ? "" : r.bold ? ui.h("b", {}, r.paren ? neg(r.amount) : money(r.amount)) : r.paren ? neg(r.amount) : money(r.amount)) }], rows);
    sheet.append(ui.h("h1", {}, "Financial statements"), ui.h("p", { class: "rp-sub" }, `${plan.meta?.name ? `${plan.meta.name} · ` : ""}prepared ${longDate(d.today)}`));

    // the balance sheet
    const bs = [];
    for (const g of b.groups) { bs.push(line(g.label, null, { bold: true })); for (const a of g.accounts) bs.push(line(`${a.name}${a.owner !== "Joint" ? ` (${a.owner})` : ""}`, a.balance, { indent: true })); }
    bs.push(line("Total you own", b.assets, { bold: true }));
    if (b.short.accounts.length) { bs.push(line("Owed within a year (cards)", null, { bold: true })); for (const a of b.short.accounts) bs.push(line(a.name, a.balance, { indent: true, paren: true })); }
    if (b.long.accounts.length) { bs.push(line("Owed over years (loans)", null, { bold: true })); for (const a of b.long.accounts) bs.push(line(a.name, a.balance, { indent: true, paren: true })); }
    bs.push(line("Total you owe", b.liabilities, { bold: true, paren: true }), line("Net worth", b.netWorth, { bold: true }));
    sheet.append(section(ui, `Balance sheet, ${longDate(d.today)}`, stmt(bs),
      b.byOwner.length > 1 ? rtable(ui, [{ label: "By owner", get: (o) => o.name }, { label: "Own", num: true, get: (o) => money(o.assets) }, { label: "Owe", num: true, get: (o) => (o.liabilities ? neg(o.liabilities) : "-") }, { label: "Net", num: true, get: (o) => money(o.netWorth) }], b.byOwner) : null));

    // the income statement
    if (d.income) {
      const i = d.income, is = [line("Income", null, { bold: true }), ...i.lines.map((l) => line(l.label, l.yearly, { indent: true })), line("Total income", i.total, { bold: true }),
        i.businessCosts > 0.5 ? line("Business costs", i.businessCosts, { paren: true }) : null,
        i.careLost > 0.5 ? line("Child care account money it would lose", i.careLost, { paren: true }) : null,
        i.rentCosts > 0.5 ? line("Rental running costs (Rental analysis)", i.rentCosts, { paren: true }) : null,
        i.rentLoan > 0.5 ? line("Rental loan payment (Rental analysis)", i.rentLoan, { paren: true }) : null,
        line("Taxes", null, { bold: true }), line("Federal income tax", i.federalTax, { indent: true, paren: true }), line("Social Security and Medicare", i.payrollTax, { indent: true, paren: true }),
        i.stateTax > 0.5 ? line("State income tax", i.stateTax, { indent: true, paren: true }) : null,
        line("Spending", null, { bold: true }), ...i.expenses.map((e) => line(e.label, e.yearly, { indent: true, paren: true })), line("Total spending", i.expensesTotal, { bold: true, paren: true }),
        line("Saved for retirement", i.retirementSaving, { paren: true }), line("Saved for goals", i.goalSaving, { paren: true }),
        i.debtExtra > 0.5 ? line("Extra on debts (Pay off debts)", i.debtExtra, { paren: true }) : null,
        i.held > 0.5 ? line("Uneven pay not counted on, after its tax (Side income)", i.held, { paren: true }) : null,
        line(i.net >= 0 ? "Left over" : "Short", i.net, { bold: true })].filter(Boolean);
      sheet.append(section(ui, "Income statement, a year (from the plan)", stmt(is), ui.h("p", { class: "rp-sub" }, "From the Income, Expenses, Contributions and Goals pages, at today's amounts: the same month as the Dashboard's leftover figure, a year of it. Local income tax is not included.")));
    }
    if (d.actual) sheet.append(section(ui, `The bank files: ${monthYear(d.actual.from)} to ${monthYear(d.actual.to)}`,
      stmt([line("Money in", d.actual.in), line("Money out", d.actual.out, { paren: true }), line(d.actual.net >= 0 ? "Kept" : "Short", d.actual.net, { bold: true })]),
      ui.h("p", { class: "rp-sub" }, `${d.actual.months} complete month${d.actual.months === 1 ? "" : "s"} of transactions${d.actual.rate !== null ? `: ${fmt.pct(d.actual.rate, 0)} of what came in was kept` : ""}. Transfers between your own accounts are left out.`)));

    // the cash-flow statement
    if (d.cashflow) {
      const c = d.cashflow;
      sheet.append(section(ui, "Cash-flow statement, a year",
        stmt([line("Everyday money", null, { bold: true }), line("Income", c.income, { indent: true }), line("Taxes", c.taxes, { indent: true, paren: true }), line("Spending, loan payments as typed", c.living, { indent: true, paren: true }),
          c.businessCosts > 0.5 ? line("Business costs", c.businessCosts, { indent: true, paren: true }) : null,
          c.held > 0.5 ? line("Uneven pay not counted on, after its tax", c.held, { indent: true, paren: true }) : null,
          c.careLost > 0.5 ? line("Child care account money it would lose", c.careLost, { indent: true, paren: true }) : null,
          c.rentCosts > 0.5 ? line("Rental running costs (Rental analysis)", c.rentCosts, { indent: true, paren: true }) : null,
          c.rentLoan > 0.5 ? line("Rental loan payment (Rental analysis)", c.rentLoan, { indent: true, paren: true }) : null,
          line("Everyday cash (pay in, bills out)", c.fromLiving, { bold: true }),
          line("Put to work", null, { bold: true }), line("Retirement accounts", c.retirement, { indent: true, paren: true }), line("Goals", c.goals, { indent: true, paren: true }),
          c.debtExtra > 0.5 ? line("Extra on debts", c.debtExtra, { indent: true, paren: true }) : null,
          line(c.net >= 0 ? "Left in cash" : "Taken from cash", c.net, { bold: true })].filter(Boolean)),
        c.debt.payments > 0 ? ui.h("p", {}, `Of the ${money(c.debt.payments)} a year of loan and card payments on the Debts page, about ${money(c.debt.interest)} is interest and ${money(c.debt.principal)} pays down what you owe.`) : null,
        list(ui, [c.netWorthGrowth >= 0 ? `Net worth grows by about ${money(c.netWorthGrowth)} a year from saving and paying down debt, before investment returns and changes in what the house is worth.` : `Net worth shrinks by about ${money(-c.netWorthGrowth)} a year: more goes out than comes in, so savings are used up, before investment returns and changes in what the house is worth.`])));
    }
    sheet.append(ui.h("p", { class: "rp-foot" }, `Prepared with Financial Planner on ${longDate(d.today)} from the balances and amounts in the plan. Amounts in parentheses are money owed or going out.`));
  });
}

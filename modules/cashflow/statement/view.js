// modules/cashflow/statement/view.js -- DOM only. The cash-flow statement as a printable sheet: the four
// headline figures, the year from the plan in three parts (living, investing, debts) adding to the change in
// cash, what sits outside it, and the last twelve months from the bank files.
import { compute } from "./compute.js";
import { reportFrame, figs, rtable, section, list } from "../../reports/report-kit.js";

export function render(page, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const signed = (n) => (n < -0.5 ? `(${money(-n)})` : money(n));
  const today = fmt.today();
  const d = compute(plan, { today });
  if (!d.ready) {
    page.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Cash-flow statement"),
      ui.h("p", { class: "lede" }, "A year of your money the way a business reports it: what living brings in after tax and costs, what goes into investments, what goes to debts, and what is left in cash."),
      ui.h("p", { class: "muted small" }, `It needs ${d.missing.join("; ")}.`),
      ui.row(ui.h("a", { class: "btn", href: "#/cashflow/income" }, "Income"), ui.h("a", { class: "btn secondary", href: "#/cashflow/expenses" }, "Expenses"))));
    return;
  }
  const longDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const monthYear = (ym) => new Date(`${ym}-15T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const { wrap, sheet } = reportFrame(ui, { title: "Cash-flow statement" });
  page.append(wrap);
  sheet.append(ui.h("h1", {}, "Cash-flow statement"), ui.h("p", { class: "rp-sub" }, `${d.year ? "A year from your plan's figures" : "From your bank files"} · prepared ${longDate(today)}`));
  const y = d.year;
  const stmt = (rows) => rtable(ui, [
    { label: "", get: (r) => (r.bold ? ui.h("b", {}, r.label) : ui.h("span", { style: { paddingLeft: "14px", display: "inline-block" } }, r.label)) },
    { label: "", num: true, get: (r) => (r.amount === null ? "" : r.bold ? ui.h("b", {}, signed(r.amount)) : signed(r.amount)) },
  ], rows);

  if (y) {
    sheet.append(figs(ui, [
      ["From living, after tax", money(y.operating.total), y.operating.total < 0 ? "bad" : null],
      ["Into investments", money(-y.investing.total)],
      ["To loans and cards", money(-y.financing.total)],
      ["Left in cash", money(y.net), y.net < 0 ? "bad" : null],
    ]));
    const rows = [];
    const part = (title, p, totalLabel) => { rows.push({ label: title, amount: null, bold: true }); for (const l of p.lines) rows.push(l); rows.push({ label: totalLabel, amount: p.total, bold: true }); };
    part("Living", y.operating, "Cash from living");
    if (y.investing.lines.length) part("Investing", y.investing, "Cash into investing");
    if (y.financing.lines.length) part("Debts", y.financing, "Cash to debts");
    rows.push({ label: y.net >= 0 ? "Left in cash over the year" : "Cash short over the year", amount: y.net, bold: true });
    sheet.append(section(ui, "A year from the plan", stmt(rows), list(ui, [
      y.goals > 0 ? `Of the ${money(Math.max(0, y.net))} left, ${money(y.goals)} is set aside for goals: it stays in your savings accounts, so it is still cash.` : null,
      y.investing.match > 0 ? `Employers also put ${money(y.investing.match)} straight into retirement accounts; it never passes through your bank, so it is not above.` : null,
      y.matched.length ? `${y.matched.join(" and ")} on Expenses ${y.matched.length === 1 ? "is a loan payment" : "are loan payments"}: counted under Debts, not living costs.` : null,
      y.principal > 0 ? `Paying down ${money(y.principal)} of debt is not spent: it raises your net worth as much as saving would.` : null,
      "Interest sits with the debts here so the whole cost of borrowing reads in one place (a business would usually count it with its running costs).",
    ])));
  }

  const a = d.actual;
  if (a) sheet.append(section(ui, `The last ${a.months === 1 ? "month" : `${a.months} months`} from your bank files`,
    ui.h("p", { class: "rp-sub" }, `${monthYear(a.from)}${a.months > 1 ? ` to ${monthYear(a.to)}` : ""}`),
    stmt([
      { label: "Money in", amount: a.operating.in },
      { label: "Spent on living", amount: a.operating.out },
      { label: "Cash from living", amount: a.operating.total, bold: true },
      a.financing.total ? { label: "Loan and card payments", amount: a.financing.total } : null,
      { label: a.net >= 0 ? "Kept" : "Short", amount: a.net, bold: true },
    ].filter(Boolean)),
    ui.h("p", { class: "rp-sub" }, "Transfers between your own accounts, including into investment accounts, are left out; loan and card payments are the ones categorised as such.")));
  sheet.append(ui.h("p", { class: "rp-foot" }, "From the Income, Expenses, Contributions and Debts pages; tax from the federal and state estimates. Amounts in brackets go out."));
}

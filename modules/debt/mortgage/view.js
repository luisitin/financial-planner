// modules/debt/mortgage/view.js -- DOM only. The mortgage today, what extra or biweekly
// payments would save, a recast, when mortgage insurance can go, the year-by-year balance.
import { compute } from "./compute.js";

const state = { extra: null, lump: 0 };

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today(), extra: state.extra ?? undefined, lump: state.lump });
  const redraw = () => { root.innerHTML = ""; render(root, ctx); };
  const monthsText = (m) => !Number.isFinite(m) ? "never" : `${Math.floor(m / 12)} yr ${m % 12} mo`;

  if (!d.hasData) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Mortgage"),
      ui.h("p", { class: "lede" }, d.mortgage ? `${d.mortgage.name} is on file but needs its interest rate and required payment before this page can work out the schedule.` : "Add the mortgage as an account on the Net worth page (type Mortgage) and give it a rate and payment on the Debts page. Then this page shows what extra payments, paying every two weeks or a recast would do."),
      ui.row(ui.h("a", { class: "btn", href: d.mortgage ? "#/balance/liabilities" : "#/balance/net-worth" }, d.mortgage ? "Add the rate and payment" : "Add the mortgage"))));
    return;
  }
  const m = d.mortgage;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, m.name),
    ui.h("p", { class: "lede" }, `${fmt.money(m.balance, cur)} left at ${fmt.pct(m.rate, 2)}, ${fmt.money(m.payment, cur)} a month. At that pace it ends ${d.base.endDate ? `in ${fmt.date(d.base.endDate)}` : `in ${monthsText(d.base.months)}`} after ${fmt.money(d.base.totalInterest, cur)} more interest.`),
  ));
  const extraIn = ui.input({ type: "number", value: d.withExtra.extra, min: 0, step: "25", inputmode: "decimal", "aria-label": "Extra each month", onChange: (e) => { state.extra = Math.max(0, Number(e.target.value) || 0); redraw(); } });
  const lumpIn = ui.input({ type: "number", value: state.lump || "", min: 0, step: "1000", inputmode: "decimal", placeholder: "e.g. 20000", "aria-label": "Lump sum", onChange: (e) => { state.lump = Math.max(0, Number(e.target.value) || 0); redraw(); } });
  root.append(ui.card("What if", ui.h("div", { class: "form" },
    ui.field("Extra each month", extraIn, "on top of the required payment; the Debts page keeps the extra you really pay"),
    ui.field("One lump sum (for a recast)", lumpIn, "a recast keeps the end date and lowers the payment; lenders charge a small fee")),
  ));
  root.append(ui.card(null, ui.row(
    ui.stat(`Extra ${fmt.money(d.withExtra.extra, cur)} a month`, d.withExtra.monthsSaved ? `${monthsText(d.withExtra.monthsSaved)} sooner` : "no change", d.withExtra.interestSaved ? `saves ${fmt.money(d.withExtra.interestSaved, cur)} of interest; ends ${d.withExtra.endDate ? fmt.date(d.withExtra.endDate) : monthsText(d.withExtra.months)}` : "type an extra amount above"),
    ui.stat("Half a payment every two weeks", d.biweekly.monthsSaved ? `${monthsText(d.biweekly.monthsSaved)} sooner` : "-", `26 half-payments a year is one extra payment; saves ${fmt.money(d.biweekly.interestSaved, cur)}`),
    d.recast ? ui.stat(`Recast with ${fmt.money(d.recast.lump, cur)}`, `${fmt.money(d.recast.newPayment, cur)}/mo`, `${fmt.money(d.recast.monthlySaving, cur)} a month less, same end date`) : null,
    d.pmi ? ui.stat("Mortgage insurance", d.pmi.monthsUntilDrop === 0 ? "you can ask to end it" : `${monthsText(d.pmi.monthsUntilDrop)} to go`, d.pmi.basis === "price"
      ? `you owe ${fmt.pct(d.pmi.ltv, 0)} of the ${fmt.money(d.pmi.basisValue, cur)} you paid. You can ask the lender to end it at 80% (${fmt.money(d.pmi.dropAtBalance, cur)})${d.pmi.dateDrop && d.pmi.monthsUntilDrop ? `, around ${fmt.date(d.pmi.dateDrop)}` : ""}; it ends by itself at 78%${d.pmi.dateAuto && d.pmi.monthsUntilAuto ? `, around ${fmt.date(d.pmi.dateAuto)}` : ""}`
      : `you owe ${fmt.pct(d.pmi.ltv, 0)} of the home's ${fmt.money(d.pmi.homeValue, cur)} today. The law counts from the price you paid: enter it on Your home for the dates. A lender may also drop it on a new appraisal`) : null,
  )));
  if (d.schedule.length) root.append(ui.card("Year by year, with the extra above",
    ui.h("ul", { class: "page-list" }, d.schedule.map((y) => ui.h("li", {},
      ui.h("span", { class: "ic" }, String(y.year)),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, `Year ${y.year}`), ui.h("div", { class: "d" }, `${fmt.money(y.principalPaid, cur)} paid off · ${fmt.money(y.interestPaid, cur)} interest`)),
      ui.h("span", { class: "st" }, `${fmt.money(y.endBalance, cur)} left`)))),
  ));
  if (!d.home) root.append(ui.notice("info", "Add the house as an account (type Real estate) with its value to see when mortgage insurance can end."));
}

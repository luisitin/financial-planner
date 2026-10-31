// modules/retirement/fire/view.js -- DOM only. The financial-independence number, how far along
// you are, the years to get there at the current pace, and the coast figure.
import { compute } from "./compute.js";

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Financial independence"), ui.h("p", { class: "lede" }, "The pot that could pay for your life without a paycheck, and how far you are from it. It needs what you spend:"), ui.h("ul", {}, d.missing.map((m) => ui.h("li", {}, m))), ui.row(ui.h("a", { class: "btn", href: "#/cashflow/expenses" }, "Expenses"))));
    return;
  }
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.progress >= 1 ? "You are financially independent" : d.yearsToFi !== null ? `Financially independent in about ${d.yearsToFi} year${d.yearsToFi === 1 ? "" : "s"}` : "Financial independence"),
    ui.h("p", { class: "lede" }, `Spending ${money(d.spendingYearly)} a year needs a pot of about ${money(d.fiNumber)} to live on for good (a ${fmt.pct(d.withdrawalRate, 0)} withdrawal rate). You have ${money(d.invested)} invested: ${fmt.pct(d.progress, 0)} of the way.${d.yearsToFi !== null && d.yearsToFi > 0 ? ` At ${money(d.savingYearly)} a year of saving and ${fmt.pct(d.realReturn, 1)} real growth, you get there around ${d.fiYear}${d.fiAge ? ` (age ${d.fiAge})` : ""}.` : ""}`),
    ui.h("div", { class: "progress" }, ui.h("span", { style: { width: `${Math.round(d.progress * 100)}%` } })),
  ));
  root.append(ui.card(null, ui.row(
    ui.stat("The number", money(d.fiNumber), `${Math.round(1 / d.withdrawalRate)} times yearly spending`),
    ui.stat("Still to go", money(d.gap), "today's dollars"),
    ui.stat("Saving a year", money(d.savingYearly), d.savingsRate !== null ? `${fmt.pct(d.savingsRate, 0)} of income: contributions plus what is left over` : "contributions plus what is left over"),
    d.coast ? ui.stat("Coast figure", money(d.coast.number), d.coast.reached ? `you have it: with no more saving, growth alone reaches the number by ${d.retireAge}` : `enough today to reach the number by ${d.retireAge} with no more saving`) : null,
  )));
  root.append(ui.card("What moves it",
    ui.h("ul", { class: "records" }, [
      ["Spend less", "Every dollar a year you no longer need cuts the number by 25. That works on both ends: less to save for, and more saved."],
      ["Save more", `The years-to-go figure is driven by your saving rate far more than by returns. Starting from nothing, at ${fmt.pct(d.realReturn, 1)} growth and drawing ${fmt.pct(d.withdrawalRate, 1)} a year: saving half of income takes about ${d.fromZero.half ?? "over 100"} years; saving a tenth, ${d.fromZero.tenth ? `about ${d.fromZero.tenth}` : "over 100"}.`],
      ["Coast", "Once the coast figure is reached, contributions can stop and the pot still grows into the number by the retirement age; the paycheck only has to cover today."],
      ["Growth", `The estimate uses ${fmt.pct(d.realReturn, 1)} a year above inflation (your stock and bond assumptions blended). History pages show how uneven that really is.`],
    ].map(([t, s]) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t)), ui.h("div", { class: "rec-sub" }, s)))),
  ));
}

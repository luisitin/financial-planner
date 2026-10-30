// modules/balance/statement/view.js -- DOM only. The balance sheet as a printable sheet: the headline
// figures, what you own by how fast it turns into cash (with what each would bring today), what you owe
// within a year and later, by owner, and the ratios with what each means.
import { compute } from "./compute.js";
import { reportFrame, figs, wideTable, section, list } from "../../reports/report-kit.js";

export function render(page, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const today = fmt.today();
  const d = compute(plan, { today });
  if (!d.ready) {
    page.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Balance sheet"),
      ui.h("p", { class: "lede" }, "Everything you own and owe on one printable page, sorted by how quickly each could become cash, with what it would really bring if you had to."),
      ui.h("p", { class: "muted small" }, "Add your accounts, home, cars and debts first."),
      ui.row(ui.h("a", { class: "btn", href: "#/balance/accounts" }, "Accounts"))));
    return;
  }
  const longDate = new Date(`${today}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const { wrap, sheet } = reportFrame(ui, { title: "Balance sheet" });
  page.append(wrap);
  const many = d.owners.length > 1;
  const names = (plan.household?.people ?? []).filter((p) => p.role !== "dependent").map((p) => p.name).join(" and ");
  sheet.append(ui.h("h1", {}, "Balance sheet"), ui.h("p", { class: "rp-sub" }, `${names ? `${names} · ` : ""}as of ${longDate}`));
  sheet.append(figs(ui, [
    ["Net worth", money(d.netWorth), d.netWorth >= 0 ? null : "bad"],
    ["What you own", money(d.assets)],
    ["What you owe", money(d.liabilities)],
    ["If everything were sold today", money(d.netWorthCashed)],
  ]));

  // what you own
  const own = section(ui, "What you own, by how fast it turns into cash");
  for (const t of d.tiers) {
    own.append(ui.h("h3", {}, `${t.label}: ${money(t.total)}`));
    own.append(wideTable(ui, [
      { label: "Account", get: (a) => a.name },
      many ? { label: "Owner", get: (a) => a.owner } : null,
      { label: "If cashed in", num: true, get: (a) => (Math.abs(a.cashIn - a.value) >= 1 ? `${money(a.cashIn)} (${a.note})` : a.note ? `${money(a.cashIn)}, ${a.note}` : "-") },
      { label: "Value", num: true, get: (a) => money(a.value) },
    ].filter(Boolean), t.accounts));
  }
  own.append(ui.h("p", {}, ui.h("b", {}, `Total: ${money(d.assets)}`), ` · ${money(d.cashIn)} if cashed in today`));
  sheet.append(own);

  // what you owe
  if (d.debts.length) sheet.append(section(ui, "What you owe",
    wideTable(ui, [
      { label: "Debt", get: (x) => x.name },
      many ? { label: "Owner", get: (x) => x.owner } : null,
      { label: "Due within a year", num: true, get: (x) => money(x.dueSoon) },
      { label: "Later", num: true, get: (x) => (x.dueLater >= 0.5 ? money(x.dueLater) : "-") },
      { label: "Owed", num: true, get: (x) => money(x.owed) },
    ].filter(Boolean), d.debts),
    ui.h("p", {}, ui.h("b", {}, `Total: ${money(d.liabilities)}`), ` · ${money(d.dueSoon)} within a year, ${money(d.dueLater)} later`),
    ui.h("p", { class: "rp-sub" }, "Within a year: a card's whole balance, and the part of each loan the next twelve payments pay off.")));
  else sheet.append(section(ui, "What you owe", ui.h("p", {}, "Nothing.")));

  // by owner
  if (many) sheet.append(section(ui, "By owner",
    wideTable(ui, [
      { label: "Owner", get: (o) => o.name },
      { label: "Own", num: true, get: (o) => money(o.assets) },
      { label: "Owe", num: true, get: (o) => money(o.liabilities) },
      { label: "Net worth", num: true, get: (o) => money(o.netWorth) },
    ], d.byOwner),
    ui.h("p", { class: "rp-sub" }, "Joint: accounts with no single owner on the Accounts page. Retirement accounts always belong to one person.")));

  // the ratios
  const r = d.ratios, pct = (x) => `${Math.round(x * 100)}%`;
  sheet.append(section(ui, "What the numbers say", list(ui, [
    r.monthsOfCash !== null ? `Cash covers ${r.monthsOfCash.toFixed(1)} months of spending (${money(r.monthlySpending)} a month). Three to six months is the usual cushion.` : "Add your spending on Expenses to see how many months your cash covers.",
    r.quick !== null ? `Cash and investments you can sell in days are ${r.quick.toFixed(1)} times what falls due within a year. Above 1, you could pay it all without touching retirement money.` : "Nothing falls due within a year.",
    r.debtToAssets !== null ? `You owe ${pct(r.debtToAssets)} of what you own. Under 50% is comfortable; it falls as loans are paid down.` : null,
    r.investedShare !== null ? `${pct(r.investedShare)} of your net worth is invested (savings that can grow, outside the home). It usually rises toward retirement.` : null,
  ])));
  sheet.append(ui.h("p", { class: "rp-foot" }, `Values as entered on Accounts. "If cashed in" takes ${Math.round(d.taxRate * 100)}% income tax off pre-tax accounts (your federal top rate plus your state's share), the 10% penalty before age 59½, and about 6% off a home for selling it; it leaves out tax on investment gains.`));
}

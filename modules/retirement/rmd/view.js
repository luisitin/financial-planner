// modules/retirement/rmd/view.js -- DOM only. When required withdrawals start, how big the
// first ones look, and the year-by-year schedule from the projection.
import { compute } from "./compute.js";

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Required withdrawals"),
    ui.h("p", { class: "lede" }, "From a certain age the tax rules make you take money out of pre-tax accounts (401(k), traditional IRA) every year, and pay income tax on it, whether you need it or not. This page says when that starts for you and how big it looks."),
    ui.h("p", { class: "muted small" }, "Roth IRAs and, since 2024, Roth 401(k)s have no required withdrawals while you are alive. Rules from IRS Publication 590-B and the SECURE 2.0 Act."),
  ));
  if (!d.people.length) { root.append(ui.notice("warn", ui.h("span", {}, "Add the adults with birth dates on the ", ui.h("a", { href: "#/household/people" }, "People page"), "."))); return; }
  root.append(ui.card(null, ui.row(
    ...d.people.map((p) => ui.stat(`${p.name} starts at ${p.startAge}`, String(p.startYear), p.yearsUntil ? `in ${p.yearsUntil} year${p.yearsUntil === 1 ? "" : "s"}` : "already")),
    ui.stat("Pre-tax money today", money(d.deferredNow), d.deferredAccounts.map((a) => a.name).join(", ") || "none on file"),
  )));
  if (!d.hasDeferred) { root.append(ui.notice("info", "No pre-tax retirement accounts on file, so no required withdrawals. If you have a 401(k) or traditional IRA, add it on the Net worth page.")); return; }
  if (!d.ready) { root.append(ui.notice("info", ui.h("span", {}, "The size of the withdrawals comes from the projection, which needs a few more inputs: ", ui.h("a", { href: "#/retirement/projection" }, "Projection page"), "."))); }
  else if (d.schedule.length) root.append(ui.card("What they look like, from the projection",
    ui.h("p", { class: "muted small" }, `Each year's required amount is the pre-tax balance divided by the IRS factor for your age (${d.schedule[0].factor} at ${d.schedule[0].age}). Taxed at the plan's ${fmt.pct(d.taxRate, 0)}. In today's dollars.`),
    ui.h("ul", { class: "records" }, d.schedule.slice(0, 12).map((r) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${r.year} · age ${r.age}`), ui.h("span", { class: "rec-value" }, money(r.rmdReal))),
      ui.h("div", { class: "rec-sub" }, `factor ${r.factor} · about ${money(r.taxes / (r.rmd / r.rmdReal || 1))} of tax`)))),
    d.schedule.length > 12 ? ui.h("p", { class: "muted small" }, `...and ${d.schedule.length - 12} more years. Over the plan: ${money(d.totalRmdReal)} required in total.`) : null,
    ui.h("p", { class: "small" }, "Big required withdrawals push you into higher tax brackets. Moving money to a Roth in the low-income years before they start (a Roth conversion) is the usual fix; the tax pages cover that."),
  ));
  root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "The IRS table"), ui.h("span", { class: "fold-status" }, "ages 72 to 100"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" }, ui.h("p", { class: "muted small" }, "Divide the balance at the end of the previous year by the factor for the age you reach this year."), ui.h("div", { class: "chips" }, d.table.map((t) => ui.h("span", { class: "chip", style: { cursor: "default" } }, `${t.age}: ${t.factor}`))))));
}

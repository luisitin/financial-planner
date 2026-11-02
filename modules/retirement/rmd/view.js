// modules/retirement/rmd/view.js -- DOM only. When required withdrawals start, how big the
// first ones look, and the year-by-year schedule from the projection.
import { compute, thisYear, markTaken } from "./compute.js";
import { rmdFactor } from "../../../core/math/rmd.js";

// The shell re-renders after store.update, so a confirmation waits here for the next render.
let pending = null;

export function render(root, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const today = fmt.today();
  const d = compute(plan, { today });
  const money = (n) => fmt.money(n, cur);
  const long = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  // this year's withdrawal first: the one deadline here with a penalty (IRS, Retirement topics: RMDs, reviewed 2026-04-08)
  const ty = thisYear(plan, { today });
  const now = [];   // shown right under the intro
  if (pending) { const n = ui.notice("ok", pending); now.push(n); setTimeout(() => n.remove(), 4000); pending = null; }
  for (const r of ty.people) {
    const from = r.accounts.map((a) => a.name).join(" and ");
    const k401 = r.accounts.filter((a) => a.type === "401k").length;
    if (r.taken) {
      now.push(ui.card(null, ui.h("p", { style: { margin: 0 } }, `${r.name}'s ${ty.year} withdrawal is taken (marked ${long(r.taken)}). `,
        ui.button("Not yet", () => { pending = `${r.name}'s ${ty.year} withdrawal is back on the list.`; store.update((p) => markTaken(p, ty.year, r.id, null)); }, { class: "secondary small" }))));
      continue;
    }
    const lastDec = `December 31, ${ty.year - 1}`;
    now.push(ui.h("section", { class: "card" },
      ui.h("p", { class: "muted small", style: { margin: "0 0 4px" } }, `This year, ${r.name} (${r.age})`),
      ui.h("h2", { style: { marginTop: 0 } }, `Take at least ${money(r.amount)} from ${from} by ${long(r.deadline)}`),
      ui.h("p", {}, r.accounts.length === 1
        ? `${r.accounts[0].estimated ? `Worked out from today's balance: ${from} holds ${money(r.accounts[0].balance)}` : `${from} held ${money(r.accounts[0].balance)} on ${lastDec}`}, divided by ${rmdFactor(r.age)}, the IRS factor at ${r.age}.`
        : `Each account's ${r.estimated ? "balance today" : `balance on ${lastDec}`} divided by ${rmdFactor(r.age)}, the IRS factor at ${r.age}: ${r.accounts.map((a) => `${a.name} ${money(a.balance / rmdFactor(r.age))}`).join(", ")}.`),
      r.estimated ? ui.h("p", { class: "muted small" }, `The exact figure uses the balance on ${lastDec}: it is on the year-end statement. Type it as that day's balance on the account's page and this updates.`) : null,
      r.first ? ui.h("p", { class: "small" }, `This is ${r.name}'s first year: it can wait until April 1, ${ty.year + 1}, but then ${ty.year + 1} has two withdrawals, both taxed that year. Taking it by December 31, ${ty.year} spreads the tax.`) : null,
      k401 && r.accounts.length > 1 ? ui.h("p", { class: "small" }, "Each 401(k)'s share comes out of that 401(k). IRAs can be added together and taken from any one of them.") : null,
      k401 && r.working ? ui.h("p", { class: "small" }, `Still working? A 401(k) at ${r.name === "You" ? "your" : `${r.name}'s`} current job can usually wait until retiring (check the plan's rules); IRAs cannot.`) : null,
      ui.h("p", { class: "muted small" }, "Missing it costs 25% of what was not taken (10% if it is taken within two years). Your bank or broker can set it up; ask them to hold back tax if you like."),
      ui.row(ui.button("I've taken it", () => { pending = `Marked: ${r.name}'s ${ty.year} withdrawal is taken.`; store.update((p) => markTaken(p, ty.year, r.id, today)); }, { class: "secondary" })),
    ));
  }
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Required withdrawals"),
    ui.h("p", { class: "lede" }, "From a certain age the tax rules make you take money out of pre-tax accounts (401(k), traditional IRA) every year, and pay income tax on it, whether you need it or not. This page says when that starts for you and how big it looks."),
    ui.h("p", { class: "muted small" }, "Roth IRAs and, since 2024, Roth 401(k)s have no required withdrawals while you are alive. Rules from IRS Publication 590-B and the SECURE 2.0 Act."),
  ), ...now);
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

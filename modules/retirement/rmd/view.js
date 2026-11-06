// modules/retirement/rmd/view.js -- DOM only. When required withdrawals start, how big the
// first ones look, and the year-by-year schedule from the projection.
import { compute, thisYear, thisYearTax, markTaken } from "./compute.js";
import { rmdFactor } from "../../../core/math/rmd.js";
// "you" and "your" for the first adult Get started left unnamed ("Me"), with the verb to match (round 7); thisYear names
// someone with no name "You", which reads the same
import { isYou, nameIn, NameIn, nameOf, NameOf, verbFor } from "../../../core/words.js";
// the states with no income tax (taxes/state's own list): there the hold-back is the federal tax only (round 8 review D5)
import { NO_WAGE_TAX } from "../../taxes/state/compute.js";
// the Roth sentence and the source line, in the IRS-table fold and under the "none on file" notice (they are not on the first screen)
const ROTH_SOURCE = "Rules from IRS Publication 590-B and the SECURE 2.0 Act. Roth accounts (money you already paid tax on) have no required withdrawals while you are alive.";
const unnamed = (n) => (n === "You" ? "" : n);

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
  // what each withdrawal adds to this year's federal tax, at the brackets (round 8, widow-2: the page said nothing, and the
  // schedule priced it at the plan's quick 15%); null while the first adult still works
  const tt = ty.people.length ? thisYearTax(plan, { today, thisYear: ty }) : null;
  const addsOf = (r) => (tt && tt.byPerson[r.id] >= 0.5 ? tt.byPerson[r.id] : null);
  // filing separately each withdrawal is on its owner's own return (round 8 review D1); jointly it is the household's
  const whoseTax = (r) => (tt?.separate && ty.people.length > 1 ? nameOf(unnamed(r.name)) : "your");
  const stateToo = NO_WAGE_TAX[String(plan.household?.state ?? "").toUpperCase()] ? "" : " (your state may tax it too)";
  const now = [];   // shown right under the intro
  if (pending) { const n = ui.notice("ok", pending); now.push(n); setTimeout(() => n.remove(), 4000); pending = null; }
  for (const r of ty.people) {
    const from = r.accounts.map((a) => a.name).join(" and ");
    const k401 = r.accounts.filter((a) => a.type === "401k").length;
    if (r.taken) {
      now.push(ui.card(null, ui.h("p", { style: { margin: 0 } }, `${NameOf(unnamed(r.name))} ${ty.year} withdrawal is taken (marked ${long(r.taken)}). `,
        ui.button("Not yet", () => { pending = `${NameOf(unnamed(r.name))} ${ty.year} withdrawal is back on the list.`; store.update((p) => markTaken(p, ty.year, r.id, null)); }, { class: "secondary small" })),
        // what it adds to the year's tax stays said once it is out (round 8 review UX 11): taken with nothing held back, it is still owed
        addsOf(r) !== null ? ui.h("p", { class: "small", style: { margin: "8px 0 0" } }, `It adds about ${money(addsOf(r))} to ${whoseTax(r)} ${ty.year} federal income tax; if none was held back, `, ui.h("a", { href: "#/taxes/estimated" }, "Estimated payments"), " says how to cover it.") : null));
      continue;
    }
    const lastDec = `December 31, ${ty.year - 1}`;
    now.push(ui.h("section", { class: "card" },
      ui.h("p", { class: "muted small", style: { margin: "0 0 4px" } }, isYou(unnamed(r.name)) ? `Yours this year, at ${r.age}` : `This year, ${nameIn(r.name)} (${r.age})`),
      ui.h("h2", { style: { marginTop: 0 } }, `Take at least ${money(r.amount)} from ${from} by ${long(r.deadline)}`),
      ui.h("p", {}, r.accounts.length === 1
        ? `${r.accounts[0].estimated ? `Worked out from today's balance: ${from} holds ${money(r.accounts[0].balance)}` : `${from} held ${money(r.accounts[0].balance)} on ${lastDec}`}, divided by ${rmdFactor(r.age)}, the IRS factor at ${r.age}.`
        : `Each account's ${r.estimated ? "balance today" : `balance on ${lastDec}`} divided by ${rmdFactor(r.age)}, the IRS factor at ${r.age}: ${r.accounts.map((a) => `${a.name} ${money(a.balance / rmdFactor(r.age))}`).join(", ")}.`),
      r.estimated ? ui.h("p", { class: "muted small" }, `The exact figure uses the balance on ${lastDec}: it is on the year-end statement. Type it as that day's balance on the account's page and this updates.`) : null,
      addsOf(r) !== null ? ui.h("p", {}, `Taking it adds about ${money(addsOf(r))} to ${whoseTax(r)} federal income tax for ${ty.year}${ty.people.filter((x) => x.amount >= 1).length === 1 && tt.socialMore >= 1 ? `: it is taxed as income, and it makes ${money(tt.socialMore)} more of Social Security taxable` : ""}.`) : null,
      r.first ? ui.h("p", { class: "small" }, `This is ${nameOf(unnamed(r.name))} first year: it can wait until April 1, ${ty.year + 1}, but then ${ty.year + 1} has two withdrawals, both taxed that year. Taking it by December 31, ${ty.year} spreads the tax.`) : null,
      k401 && r.accounts.length > 1 ? ui.h("p", { class: "small" }, "Each 401(k)'s share comes out of that 401(k). IRAs can be added together and taken from any one of them.") : null,
      k401 && r.working ? ui.h("p", { class: "small" }, `Still working? A 401(k) at ${nameOf(unnamed(r.name))} current job can usually wait until retiring (check the plan's rules); IRAs cannot.`) : null,
      // the federal figure, said as such (round 8 review D5), and not "if you like" (UX 5)
      ui.h("p", { class: "muted small" }, `Missing it costs 25% of what was not taken (10% if it is taken within two years). Your bank or broker can set it up; ${addsOf(r) !== null ? `ask them to hold back about ${money(addsOf(r))} for the federal tax${stateToo}` : "they can hold back tax from it too"}.`),
      ui.row(ui.button("I've taken it", () => { pending = `Marked: ${nameOf(unnamed(r.name))} ${ty.year} withdrawal is taken.`; store.update((p) => markTaken(p, ty.year, r.id, today)); }, { class: "secondary" })),
    ));
  }
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Required withdrawals"),
    ui.h("p", { class: "lede" }, "From a certain age the tax rules make you take money out of accounts you haven't paid tax on yet (like a 401(k) or a traditional IRA) every year, and pay income tax on it, whether you need it or not. This page says when that starts for you and how big it looks."),
  ), ...now);
  if (!d.people.length) { root.append(ui.notice("warn", ui.h("span", {}, "Add the adults with birth dates on the ", ui.h("a", { href: "#/household/people" }, "People page"), "."))); return; }
  root.append(ui.card(null, ui.row(
    ...d.people.map((p) => ui.stat(`${NameIn(p.name)} ${verbFor(p.name, "starts", "start")} at ${p.startAge}`, String(p.startYear), p.yearsUntil ? `in ${p.yearsUntil} year${p.yearsUntil === 1 ? "" : "s"}` : "already")),
    ui.stat("Not taxed yet, today", money(d.deferredNow), d.deferredAccounts.map((a) => a.name).join(", ") || "none on file"),
  )));
  // started for someone who has pre-tax money (round 8 review D3: a 75-year-old with none read that conversions now come after
  // "this year's required withdrawal" while the IRA was a 66-year-old's, with none due until 2035)
  const started = d.people.some((p) => p.yearsUntil === 0 && p.deferredNow > 0);
  if (!d.hasDeferred) { root.append(ui.notice("info", ui.h("span", {}, "No accounts you haven't paid tax on yet are on file, so no required withdrawals. If you have a 401(k) or a traditional IRA, add it on ", ui.h("a", { href: "#/balance/net-worth" }, "What you own"), ".")), ui.h("p", { class: "muted small" }, ROTH_SOURCE)); return; }
  // each year's withdrawals at their owners' own ages and factors (a younger spouse's IRA read "age 84, factor 16.8" at 75)
  const couple = d.people.length > 1;
  const owned = (r) => (r.owners?.length ? r.owners : [{ name: d.people[0]?.name, age: r.age, factor: r.factor }]);
  const whoAges = (r) => (owned(r).length > 1 ? `ages ${owned(r).map((o) => o.age).join(" / ")}` : `${couple ? `${NameIn(owned(r)[0].name)}, ` : ""}age ${owned(r)[0].age}`);
  const factors = (r) => (owned(r).length > 1 ? `factors ${owned(r).map((o) => o.factor).join(" / ")}` : `factor ${owned(r)[0].factor}`);
  const first0 = d.schedule.length ? owned(d.schedule[0])[0] : null;
  if (!d.ready) { root.append(ui.notice("info", ui.h("span", {}, "The size of the withdrawals comes from the projection, which needs a few more inputs: ", ui.h("a", { href: "#/retirement/projection" }, "Projection page"), "."))); }
  else if (d.schedule.length) root.append(ui.card("What they look like, from the projection",
    ui.h("p", { class: "muted small" }, `Each year's required amount is the balance in those accounts divided by the IRS factor for ${first0 ? `${nameOf(first0.name)} age (${first0.factor} at ${first0.age})` : "the owner's age"}. The tax is what each one adds to that year's federal income tax, on top of the plan's other income, Social Security included. In today's dollars.`),
    ui.h("ul", { class: "records" }, d.schedule.slice(0, 12).map((r) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${r.year} · ${whoAges(r)}`), ui.h("span", { class: "rec-value" }, money(r.rmdReal))),
      ui.h("div", { class: "rec-sub" }, r.extraTaxReal !== null ? `${factors(r)} · adds about ${money(r.extraTaxReal)} of federal tax` : `${factors(r)} · about ${money(r.taxes / (r.rmd / r.rmdReal || 1))} of tax (the plan's ${fmt.pct(d.taxRate, 0)}, while you still work)`)))),
    d.schedule.length > 12 ? ui.h("p", { class: "muted small" }, `...and ${d.schedule.length - 12} more years. Over the plan: ${money(d.totalRmdReal)} required in total.`) : null,
    // once they have started (round 8, widow-3): a conversion is still allowed, after each year's required amount
    started
      ? ui.h("p", { class: "small" }, "Once this year's required withdrawal is out, you can still move more to a Roth (a conversion). The required amount itself cannot be converted; what you convert is taxed as income that year, then has no required withdrawals and, once the Roth has been open five years, comes out tax-free for you and for your heirs.")
      : ui.h("p", { class: "small" }, "Big required withdrawals push you into higher tax brackets. Moving money to a Roth in the low-income years before they start (a Roth conversion) is the usual fix; the Roth conversions page works it out."),
  ));
  root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "The IRS table"), ui.h("span", { class: "fold-status" }, "ages 72 to 100"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" }, ui.h("p", { class: "muted small" }, "Divide the balance at the end of the previous year by the factor for the age you reach this year. " + ROTH_SOURCE), ui.h("div", { class: "chips" }, d.table.map((t) => ui.h("span", { class: "chip", style: { cursor: "default" } }, `${t.age}: ${t.factor}`))))));
}

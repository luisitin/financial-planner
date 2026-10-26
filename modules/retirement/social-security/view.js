// modules/retirement/social-security/view.js -- DOM only. Per adult: paste the ssa.gov earnings
// record (or type the statement's figure), pick a claiming age, see the monthly benefit at
// each age. Saved with a green line; the projection picks it up.
import { compute, parseRecord } from "./compute.js";

let pending = null;
let openFor = null;   // the person whose fold stays open after a save

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.hasData ? `${fmt.money(d.householdYearly, cur)} a year from Social Security` : "Social Security"),
    ui.h("p", { class: "lede" }, d.hasData ? "In today's dollars, at the claiming ages chosen below. The projection counts it from those ages, rising with inflation." : "Your benefit depends on your best 35 years of earnings and the age you claim. Paste the earnings table from your ssa.gov account, or type the monthly figure your Social Security statement shows at full retirement age."),
    ui.h("p", { class: "muted small" }, "ssa.gov > my Social Security > Earnings Record: copy the year and earnings columns and paste them below. Nothing is sent anywhere; the sums are done on this device with the SSA's own formula."),
  ));
  root.append(out);
  if (!d.people.length) { root.append(ui.notice("warn", ui.h("span", {}, "Add the adults with their birth dates on the ", ui.h("a", { href: "#/household/people" }, "People page"), " first."))); return; }

  // One fold per person; the first opens by default, the one just saved stays open
  // (design log 2026-09-16, pass 4).
  d.people.forEach((p, idx) => {
    const s = plan.retirement?.socialSecurity?.[p.id] ?? {};
    const status = p.source === "record" ? `${fmt.money(p.monthly, cur)} a month at ${p.claimAge}` : p.source === "typed" ? `${fmt.money(p.monthly, cur)} a month at ${p.claimAge}` : "nothing yet";
    const claimSel = ui.select([62, 63, 64, 65, 66, 67, 68, 69, 70].map((a) => ({ value: String(a), label: a === (p.fra?.years ?? 67) && !(p.fra?.months) ? `${a} (full retirement age)` : String(a) })), String(Math.round(p.claimAge)), { "aria-label": "Claiming age" });
    const recordBox = ui.h("textarea", { rows: 5, placeholder: "2024\t$69,000\n2023\t$66,500\n...", "aria-label": "Earnings record" }, (p.record ?? []).map((r) => `${r.year}\t${r.earnings}`).join("\n"));
    const typedIn = ui.input({ type: "number", value: p.monthlyAtFRA ?? "", min: 0, step: "10", inputmode: "decimal", placeholder: "e.g. 2800", "aria-label": "Monthly benefit at full retirement age" });
    const futureSel = ui.select([{ value: "same", label: "keep earning about the same until I retire" }, { value: "none", label: "no more earnings from now" }], p.futureEarnings, { "aria-label": "Future earnings" });
    const save = () => {
      const record = parseRecord(recordBox.value);
      const monthlyAtFRA = Number(typedIn.value) || null;
      pending = `${p.name}'s Social Security saved.`; openFor = p.id;
      store.update((pl) => { pl.retirement.socialSecurity = pl.retirement.socialSecurity ?? {}; pl.retirement.socialSecurity[p.id] = { claimAge: Number(claimSel.value), record, monthlyAtFRA, futureEarnings: futureSel.value }; });
    };
    const est = p.estimate;
    root.append(ui.h("details", { class: "card fold fold-card", open: (openFor ? openFor === p.id : idx === 0) ? true : null },
      ui.h("summary", {}, ui.h("h2", {}, `${p.name}${p.age !== null ? `, ${p.age}` : ""}`), ui.h("span", { class: "fold-status" }, status), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
      ui.h("div", { class: "fold-body" },
      ui.h("p", { class: "muted small" }, `Full retirement age ${p.fra ? `${p.fra.years}${p.fra.months ? ` and ${p.fra.months} months` : ""}` : "unknown"}. Now: ${status}.`),
      p.options.length && (p.source !== "none") ? ui.h("ul", { class: "records" }, p.options.map((o) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `Claim at ${Number.isInteger(o.claimAge) ? o.claimAge : `${Math.floor(o.claimAge)} and ${Math.round((o.claimAge % 1) * 12)} months`}${Math.abs(o.claimAge - p.claimAge) < 0.01 ? " (chosen)" : ""}`), ui.h("span", { class: "rec-value" }, `${fmt.money(o.monthly, cur)} a month`)), ui.h("div", { class: "rec-sub" }, `${Math.round(o.factor * 100)}% of the full-age amount`)))) : null,
      est ? ui.h("p", { class: "muted small" }, `From the record: ${est.yearsInRecord} years${est.projectedYears ? ` (${est.projectedYears} assumed)` : ""}, ${est.credits} of 40 credits${est.eligible ? "" : ": not yet eligible"}; average indexed monthly earnings ${fmt.money(est.aime, cur)}; full-age benefit ${fmt.money(est.pia, cur)} a month.`) : null,
      ui.h("div", { class: "form" },
        ui.field("Claim at age", claimSel, "62 is the earliest, 70 the latest; each year of waiting adds about 6-8%"),
        ui.field("Earnings record from ssa.gov", recordBox, "one year per line: year and earnings"),
        ui.field("If you have no record: monthly benefit at full retirement age", typedIn, "the figure on your Social Security statement"),
        ui.field("Future earnings", futureSel)),
      ui.row(ui.button(`Save ${p.name}'s Social Security`, save)),
    )));
  });
  root.append(ui.h("p", { class: "muted small" }, "The formula: earnings indexed to wages in the year you turn 60, the best 35 years averaged, bend points for the year you turn 62, cost-of-living increases from 62, then reduced or raised for the claiming age. Tables from the Social Security Administration via ssa.tools."));
}

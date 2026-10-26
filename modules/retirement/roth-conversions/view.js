// modules/retirement/roth-conversions/view.js -- DOM only. Whether conversions help this plan
// and which bracket to fill, the options side by side, the year-by-year window, and the
// switch that puts the chosen setting into the projection.
import { compute } from "./compute.js";
import { FILL_RATES } from "./compute.js";

let pending = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Roth conversions"), ui.h("p", { class: "lede" }, "Moving pre-tax money into a Roth in the cheap years before required withdrawals, paying a low rate now instead of a higher one later. It needs the same things as the Projection page:"), ui.h("ul", {}, d.missing.map((m) => ui.h("li", {}, m))), ui.row(ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Set up the projection"))));
    return;
  }
  const best = d.options.find((o) => o.best), none = d.none;
  const helps = best.fillRate !== null && best.success && best.endAfterTaxReal > none.endAfterTaxReal + 1000;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, !none.success ? "The money runs out with or without conversions" : helps ? `Filling the ${Math.round(best.fillRate * 100)}% bracket helps this plan` : "Conversions do not help this plan much"),
    ui.h("p", { class: "lede" }, !none.success
      ? `With no conversions it runs out in ${none.failYear}${best.fillRate !== null && best.failYear !== none.failYear ? `; filling the ${Math.round(best.fillRate * 100)}% bracket moves that to ${best.failYear}` : "; no conversion setting changes that year"}. Conversions rearrange tax, they do not add money: the Projection page is the place to fix the plan first.`
      : helps
      ? `Converting up to the top of the ${Math.round(best.fillRate * 100)}% bracket each year${d.span ? ` from ${d.span.from} to ${d.span.to}` : ""} moves about ${money(best.totalConvertedReal)} into the Roth, cuts lifetime federal tax from ${money(none.taxesReal)} to ${money(best.taxesReal)} and leaves ${money(best.endAfterTaxReal - none.endAfterTaxReal)} more at the end after tax (${money(best.endAfterTaxReal)} against ${money(none.endAfterTaxReal)}, today's dollars). Required withdrawals drop from ${money(none.rmdReal)} to ${money(best.rmdReal)}.`
      : `Run with each bracket filled, the plan ends with no more money after tax than with no conversions (${money(none.endAfterTaxReal)}): the tax you would pay now is about what the money would be taxed at later, and conversions drag more of Social Security into tax. ${d.span ? "Worth another look if income in retirement turns out lower than planned." : ""}`),
    ui.h("p", { class: "muted small" }, `A conversion is taxed as ordinary income in the year it happens and the money is then never taxed again. The window is retirement to the required-withdrawal age (${d.rmdStartAge}); the tax on it is paid from cash and taxable money, which is why the pot dips before it gains. What is left is compared after the tax still owed on pre-tax money.`),
  ));
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);
  for (const n of d.notes) root.append(ui.notice("info", n));
  root.append(ui.card("Fill which bracket?",
    ui.h("ul", { class: "records" }, d.options.map((o) => ui.h("li", { style: o.best ? { background: "var(--accent-soft)", borderRadius: "8px" } : null },
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, o.label, o.best ? ui.h("span", { class: "pill accent" }, "best") : null, o.chosen ? ui.h("span", { class: "pill ok" }, "your plan") : null), ui.h("span", { class: "rec-value" }, o.success ? money(o.endAfterTaxReal) : `runs out ${o.failYear}`)),
      ui.h("div", { class: "rec-sub" }, `${o.success ? "Left at the end after tax. " : ""}${o.fillRate ? `${money(o.totalConvertedReal)} converted; ` : ""}tax over the plan ${money(o.taxesReal)}; required withdrawals ${money(o.rmdReal)}. Today's dollars.`),
      o.chosen ? null : ui.h("div", { style: { marginTop: "8px" } }, ui.button(o.fillRate ? `Use this` : "Turn conversions off", () => {
        pending = o.fillRate ? `The projection now fills the ${Math.round(o.fillRate * 100)}% bracket with conversions (and uses the federal brackets).` : "Conversions turned off.";
        store.update((p) => { p.retirement.rothConversion = { ...(p.retirement.rothConversion ?? {}), on: !!o.fillRate, fillRate: o.fillRate ?? p.retirement.rothConversion?.fillRate ?? 0.22 }; if (o.fillRate) p.retirement.taxMode = "brackets"; });
      }, { class: "secondary" }))))),
  ));
  if (d.table.length) root.append(ui.card(`Year by year, filling the ${Math.round(d.shown * 100)}% bracket`,
    ui.h("p", { class: "muted small" }, "Income before the conversion is what the plan already has that year (pensions, a partner's pay, pre-tax withdrawals for spending); the conversion is what still fits under the bracket's top after deductions, and the tax is the whole year's. Amounts in the dollars of each year."),
    ui.h("div", { class: "only-wide" }, ui.table([
      { key: "year", label: "Year" }, { key: "ages", label: d.people.length > 1 ? "Ages" : "Age", render: (r) => r.ages.join(" / ") },
      { key: "incomeBefore", label: "Income before", align: "right", render: (r) => money(r.incomeBefore) },
      { key: "conversion", label: "Convert", align: "right", render: (r) => money(r.conversion) },
      { key: "taxes", label: "Tax that year", align: "right", render: (r) => money(r.taxes) },
      { key: "bracketRate", label: "Ends in", align: "right", render: (r) => r.bracketRate !== null ? fmt.pct(r.bracketRate, 0) : "-" },
      { key: "irmaa", label: "Medicare", render: (r) => r.irmaa ? "surcharge line crossed" : "" },
    ], d.table)),
    ui.h("ul", { class: "records only-narrow" }, d.table.map((r) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${r.year} · ${d.people.length > 1 ? "ages" : "age"} ${r.ages.join(" / ")}`), ui.h("span", { class: "rec-value" }, money(r.conversion))), ui.h("div", { class: "rec-sub" }, `${money(r.incomeBefore)} of income before · ${money(r.taxes)} of tax that year${r.bracketRate !== null ? ` · ends in the ${fmt.pct(r.bracketRate, 0)} bracket` : ""}${r.irmaa ? " · crosses the Medicare surcharge line" : ""}`)))),
    d.table.some((r) => r.irmaa) ? ui.h("p", { class: "small" }, "Medicare surcharge (IRMAA): from 65, premiums rise once income two years earlier passed about 109,000 (218,000 filing jointly, 2026). Conversions in the years from 63 on can trip it; the years before are cleaner.") : null,
  ));
  const untilSel = ui.select([{ value: "", label: `until required withdrawals begin (${d.rmdStartAge})` }, ...[60, 62, 63, 65, 67, 70, 72].map((a) => ({ value: String(a), label: `until age ${a}` }))], d.untilAge ? String(d.untilAge) : "", { "aria-label": "Convert until", onChange: (e) => { pending = "Saved."; store.update((p) => { p.retirement.rothConversion = { ...(p.retirement.rothConversion ?? {}), untilAge: e.target.value ? Number(e.target.value) : null }; }); } });
  root.append(ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Conversion settings"), ui.h("span", { class: "fold-status" }, d.on ? `on, ${Math.round(d.fillRate * 100)}% bracket` : "off"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" },
      ui.h("div", { class: "form" }, ui.field("Convert each year", untilSel, "stop early to keep the years from 63 clear of the Medicare surcharge")),
      ui.h("ul", { class: "records" }, [
        ["What is converted", "Pre-tax money (401(k), IRA) moves to the Roth bucket; the projection assumes the tax is paid from cash and taxable accounts, which is the way that works. Paying it out of the conversion itself is worse and, before 59½, penalised."],
        ["Marketplace health insurance", "Before 65, a conversion counts as income for the premium subsidy, and in 2026 the subsidy cliff is back at four times the poverty line. Check the year's income before converting."],
        ["Five-year rule", "Each conversion's principal must sit in the Roth five years before it can come out penalty-free (if you are under 59½). Earnings wait for 59½ and five years from the first Roth."],
      ].map(([t, s]) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t)), ui.h("div", { class: "rec-sub" }, s)))))));
}

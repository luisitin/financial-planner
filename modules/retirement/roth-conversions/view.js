// modules/retirement/roth-conversions/view.js -- DOM only. Whether conversions help this plan
// and which bracket to fill, the options side by side, the year-by-year window, and the
// switch that puts the chosen setting into the projection.
import { compute } from "./compute.js";
import { FILL_RATES } from "./compute.js";
// "you" for the first adult Get started left unnamed ("Me"), with the verb to match (round 7)
import { nameIn, NameOf, nameOf, verbFor } from "../../../core/words.js";

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
  const helps = d.helps;
  const pct = (r) => `${Math.round(r * 100)}%`;
  const years = (ys) => (ys.length > 1 ? `${ys[0]} to ${ys.at(-1)}` : String(ys[0]));
  // the help with marketplace cover before 65 (the premium tax credit), said in the hero when the plan has those years (round 8,
  // equity-1: "fill the 12% bracket" was called best while it wiped the credit out, and the note sat in the fold): what the
  // best setting gives up, and the lowest setting whose income passes the line where it stops
  const market = d.options.some((o) => o.creditReal > 0 || o.cliffYears.length);
  const lossy = d.options.find((o) => o.fillRate !== null && o.cliffYears.length && o.creditLostReal >= 1);
  const line = d.options.find((o) => o.cliffIncome)?.cliffIncome;
  const marketWords = market ? [
    `Before 65, what you convert counts as income for the help with marketplace health insurance (the premium tax credit), which stops altogether once income passes four times the poverty line${line ? ` (about ${money(line)} a year for your household)` : ""}.`,
    helps && best.creditLostReal >= 1 && best !== lossy ? ` Filling the ${pct(best.fillRate)} bracket gives up about ${money(best.creditLostReal)} of it, against no conversions.` : "",
    // what each figure is compared with (round 8 review UX 4: Health cover's figure for the same years is against income just under the line)
    lossy ? ` From the ${pct(lossy.fillRate)} bracket up, income in ${years(lossy.cliffYears)} passes that line: about ${money(lossy.creditLostReal)} less help than with no conversions.` : "",
    " Every figure here counts it.",
  ].join("") : null;
  // no years to convert in (round 8, widow-3): say why and what still works, never "conversions do not help"
  const nw = d.noWindow, who = nw ? nw.name : null;
  // another adult's own pre-tax money, still before their own required withdrawals (round 8 review D3): any part of it can be converted
  const youngerWords = (nw?.younger ?? []).map((y) => `${NameOf(y.name)} ${money(y.deferredNow)} has no required withdrawals until ${y.startYear}, so ${nameIn(y.name)} can convert any part of it each year before then; each conversion is taxed as income that year.`).join(" ");
  const heirs = "Why converting can still be worth it: pre-tax money you leave is taxed when your heirs take it out, and most heirs other than a husband or wife must empty an inherited IRA within 10 years, often in their own working years. A Roth they inherit comes out tax-free once it has been open five years.";
  const title = d.verdict === "no-pretax" ? "Nothing to convert"
    : d.verdict === "no-years" ? (nw.reason === "started" ? "Converting once required withdrawals have started" : nw.reason === "owner-younger" ? `Converting ${nameOf(nw.younger[0].name)} pre-tax money` : "No years to convert in before required withdrawals")
    : !none.success ? "The money runs out with or without conversions" : helps ? `Filling the ${pct(best.fillRate)} bracket helps this plan` : "Conversions do not help this plan much";
  const lede = d.verdict === "no-pretax" ? "A conversion moves pre-tax money (a 401(k) or traditional IRA) into a Roth. There is none on file; if you have some, add it on the Net worth page."
    : d.verdict === "no-years" ? (nw.reason === "started"
      ? `This page only works out conversions before ${d.rmdStartAge}, the age required withdrawals start, and ${nameIn(who)} ${verbFor(who, "is", "are")} ${nw.age}. After that you can still convert what is above each year's required withdrawal: take that year's required amount first (it cannot be converted), then anything more moved to a Roth is taxed as income that year and never again.${youngerWords ? ` ${youngerWords}` : ""}`
      : nw.reason === "owner-younger" ? `This page works out conversions by ${nameOf(who)} age only, and ${nameIn(who)} ${verbFor(who, "is", "are")} ${nw.age}, past the age required withdrawals start. ${youngerWords}`
      : nw.reason === "until" ? `You chose to stop converting at ${d.untilAge}, and retirement starts at ${nw.retireAge}, so no years are left to convert in. Change "Convert each year" below.`
      : `Required withdrawals start at ${d.rmdStartAge}, and ${nameIn(who)} ${verbFor(who, "retires", "retire")} at ${nw.retireAge}, so the plan has no years between retiring and them to convert in. Once they start you can still convert what is above each year's required withdrawal.`)
    : !none.success
      ? `With no conversions it runs out in ${none.failYear}${best.fillRate !== null && best.failYear !== none.failYear ? `; filling the ${pct(best.fillRate)} bracket moves that to ${best.failYear}` : "; no conversion setting changes that year"}. Conversions rearrange tax, they do not add money: the Projection page is the place to fix the plan first.`
    : helps
      ? `Converting up to the top of the ${pct(best.fillRate)} bracket each year${d.span ? ` from ${d.span.from} to ${d.span.to}` : ""} moves about ${money(best.totalConvertedReal)} into the Roth, cuts lifetime federal tax from ${money(none.taxesReal)} to ${money(best.taxesReal)} and leaves ${money(best.endAfterTaxReal - none.endAfterTaxReal)} more at the end after tax (${money(best.endAfterTaxReal)} against ${money(none.endAfterTaxReal)}, today's dollars). Required withdrawals drop from ${money(none.rmdReal)} to ${money(best.rmdReal)}.`
      : `Run with each bracket filled, the plan ends with no more money after tax than with no conversions (${money(none.endAfterTaxReal)}): the tax you would pay now is about what the money would be taxed at later, and conversions drag more of Social Security into tax. ${d.span ? "Worth another look if income in retirement turns out lower than planned." : ""}`;
  const canConvert = d.verdict !== "no-pretax" && d.verdict !== "no-years";
  // the plan's own setting leaves at least $1,000 less than the best, or runs out while the best lasts (round 8 review UX 3: a green
  // "your plan" pill on 12% while it left $100,620 less than 10%, and the projection and every page after it used it): said, with the switch
  const behind = d.behind ? d.options.find((o) => o.chosen) : null;
  const switchTo = () => {
    pending = best.fillRate ? `The projection now fills the ${pct(best.fillRate)} bracket with conversions.` : "Conversions turned off.";
    store.update((p) => { p.retirement.rothConversion = { ...(p.retirement.rothConversion ?? {}), on: !!best.fillRate, fillRate: best.fillRate ?? p.retirement.rothConversion?.fillRate ?? 0.22 }; if (best.fillRate) p.retirement.taxMode = "brackets"; });
  };
  const bb = d.behind, bestName = best.fillRate ? `the ${pct(best.fillRate)} bracket` : "not converting";
  const behindWords = bb ? (bb.fails
    ? `Your plan is set to fill the ${pct(bb.fillRate)} bracket, and with it the money runs out in ${bb.failYear}; with ${bestName} it lasts to the end.`
    : `Your plan is set to fill the ${pct(bb.fillRate)} bracket. That leaves about ${money(bb.byBest)} less than ${bestName}${bb.byNone !== null ? `, and ${money(bb.byNone)} less than not converting` : ""}${bb.creditMore >= bb.byBest / 2 ? ", mostly because it gives up more of the help with health insurance before 65" : ""}.`) : null;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, title),
    ui.h("p", { class: "lede" }, lede),
    behind ? ui.h("p", {}, ui.h("strong", {}, behindWords)) : null,
    behind ? ui.row(ui.button(best.fillRate ? `Switch to the ${pct(best.fillRate)} bracket` : "Turn conversions off", switchTo)) : null,
    canConvert && marketWords ? ui.h("p", {}, marketWords) : null,
    d.verdict === "no-years" && nw.reason !== "until" ? ui.h("p", {}, heirs) : null,
    d.verdict === "no-years" && nw.reason === "started" ? ui.row(ui.h("a", { class: "btn secondary", href: "#/retirement/rmd" }, "This year's required withdrawal")) : null,
    canConvert ? ui.h("p", { class: "muted small" }, `A conversion is taxed as ordinary income in the year it happens and the money is then never taxed again. The window is retirement to the required-withdrawal age (${d.rmdStartAge}); the tax on it is paid from cash and taxable money, which is why the pot dips before it gains. What is left is compared after the tax still owed on pre-tax money.`) : null,
    d.verdict === "no-years" && d.on ? ui.row(ui.button("Turn conversions off", () => { pending = "Conversions turned off."; store.update((p) => { p.retirement.rothConversion = { ...(p.retirement.rothConversion ?? {}), on: false }; }); }, { class: "secondary" })) : null,
  ));
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);
  // with nothing to try, the projection's notes are about settings this page no longer shows (round 8 review UX 9: "set your own
  // figure on this page" sat alone under the answer, meaning the Projection page)
  // and the projection's "on this page" means the Projection page here (its own words are in projection/compute.js)
  if (canConvert) for (const n of d.notes) root.append(ui.notice("info", n.replace(/ on this page\b/, " on the Projection page")));
  // with no years to convert in, the settings below would compare five identical runs: the page stops here, with the settings
  // fold only when the until-age is what closed the window
  if (!canConvert && !(d.noWindow?.reason === "until")) return;
  if (canConvert) root.append(ui.card("Fill which bracket?",
    ui.h("ul", { class: "records" }, d.options.map((o) => ui.h("li", { style: o.best ? { background: "var(--accent-soft)", borderRadius: "8px" } : null },
      // green only means good: the plan's setting well behind the best is amber, plain when it is merely not the best (round 8 review UX 3)
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, o.label, o.best ? ui.h("span", { class: "pill accent" }, "best") : null, o.chosen ? ui.h("span", { class: o === behind ? "pill warn" : o.best ? "pill ok" : "pill" }, "your plan") : null), ui.h("span", { class: "rec-value" }, o.success ? money(o.endAfterTaxReal) : `runs out ${o.failYear}`)),
      ui.h("div", { class: "rec-sub" }, `${o.success ? "Left at the end after tax. " : ""}${o.fillRate ? `${money(o.totalConvertedReal)} converted; tax` : "Tax"} over the plan ${money(o.taxesReal)}; required withdrawals ${money(o.rmdReal)}${o.creditLostReal >= 1 ? `; ${money(o.creditLostReal)} less help with health insurance before 65 than with no conversions` : ""}. Today's dollars.`),
      !o.offer ? null : ui.h("div", { style: { marginTop: "8px" } }, ui.button(o.fillRate ? `Use this` : "Turn conversions off", () => {
        pending = o.fillRate ? `The projection now fills the ${Math.round(o.fillRate * 100)}% bracket with conversions (and uses the federal brackets).` : "Conversions turned off.";
        store.update((p) => { p.retirement.rothConversion = { ...(p.retirement.rothConversion ?? {}), on: !!o.fillRate, fillRate: o.fillRate ?? p.retirement.rothConversion?.fillRate ?? 0.22 }; if (o.fillRate) p.retirement.taxMode = "brackets"; });
      }, { class: "secondary" }))))),
  ));
  // the plan's own setting when conversions are on (it is what the projection uses), else the best one
  if (canConvert && d.table.length) root.append(ui.card(d.on ? `Your plan's setting, the ${Math.round(d.shown * 100)}% bracket, year by year` : `Year by year, filling the ${Math.round(d.shown * 100)}% bracket`,
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
        ...(market ? [] : [["Marketplace health insurance", "Before 65, a conversion counts as income for the help with marketplace premiums (the premium tax credit), and under the law now that help stops altogether at four times the poverty line. Check the year's income before converting."]]),
        ["Five-year rule", "Each conversion's principal must sit in the Roth five years before it can come out penalty-free (if you are under 59½). Earnings wait for 59½ and five years from the first Roth."],
      ].map(([t, s]) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t)), ui.h("div", { class: "rec-sub" }, s)))))));
}

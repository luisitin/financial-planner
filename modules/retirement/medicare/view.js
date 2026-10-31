// modules/retirement/medicare/view.js -- DOM only. When each of you signs up, what Medicare costs over
// retirement, the income surcharge (IRMAA) year by year from the plan's own income, the tiers with yours
// marked, and the drug-plan and supplement premiums to plan for.
import { tiersFor, YEAR, PART_D_BASE, PART_D_BASE_NEXT } from "./data/medicare.js";
import { compute } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.mc-root .mc-list { list-style: none; margin: 0; padding: 0; }
.mc-root .mc-list li { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); }
.mc-root .mc-list li:last-child { border-bottom: 0; }
.mc-root .mc-list .mc-s { display: block; color: var(--muted); font-size: var(--fs-xs); }
.mc-root .mc-list b { white-space: nowrap; text-align: right; }
.mc-root .mc-list li.on { font-weight: 650; color: var(--accent-ink, var(--accent)); }
.mc-root .mc-warn { color: var(--warn); }
`;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthName = (ym) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const cents = (n) => fmt.money(n, cur);
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "mc-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Medicare at 65"),
    ui.h("p", { class: "lede" }, `Medicare starts at 65 for nearly everyone. Hospital cover (Part A) is free for most people; doctors' cover (Part B) costs ${cents(d.partB)} a month in ${d.year}, and a drug plan (Part D) about ${cents(d.partD)}. With a higher income both cost more: the income surcharge, called IRMAA.`),
    d.people.length ? ui.h("ul", {}, d.people.map((p) => ui.h("li", {}, `${p.name}: sign up between ${monthName(p.signup.from)} and ${monthName(p.signup.to)}, around the 65th birthday (${monthName(p.signup.month)}).`))) : ui.h("p", { class: "muted small" }, "Add birth dates on People to see when each of you signs up."),
    ui.h("p", { class: "muted small" }, `Still working with cover from a large employer? You can wait without a penalty. Otherwise signing up late adds ${Math.round(d.latePenalty * 100)}% to Part B for every full year missed, for life.`)));
  if (!d.ready) { root.append(ui.card(null, ui.h("p", { class: "muted" }, `To work out the costs year by year, the plan needs: ${d.missing.join("; ")}.`))); return; }

  root.append(ui.card("What it costs", ui.row(
    ui.stat("Over retirement", money(d.lifetime), "all premiums, today's dollars"),
    ui.stat("Income surcharge", d.surcharge > 0 ? money(d.surcharge) : "None", d.surcharge > 0 ? `in ${d.surchargeYears} year${d.surchargeYears === 1 ? "" : "s"}` : "on the plan's income"),
  ), ui.h("p", { class: "muted small" }, `Each person: Part B ${cents(d.partB)}, a drug plan ${cents(d.partD)}${d.supplement ? `, a supplement or Advantage plan ${cents(d.supplement)}` : ""} a month, plus the Part B deductible of ${money(d.deductible)} a year when used.`)));

  // the surcharge: what sets it and the years it bites
  const surcharge = ui.card("The income surcharge (IRMAA)");
  surcharge.append(ui.h("p", {}, "Each year's premiums follow your income on the tax return from two years before: 2026's premiums follow 2024's income. A Roth conversion, a large required withdrawal or selling something big can push you over a line for one year."));
  if (d.roomNow) surcharge.append(ui.h("p", {}, d.roomNow.room > 0 ? `In ${d.roomNow.year} (the income that sets ${d.roomNow.premiumYear}'s premiums) the plan's income is about ${money(d.roomNow.room > 0 ? tiersFor(d.status)[0][0] - d.roomNow.room : 0)}: ${money(d.roomNow.room)} under the first line.` : `In ${d.roomNow.year} the plan's income is already over the first line.`));
  if (d.firstSurcharge) surcharge.append(ui.h("p", { class: "mc-warn" }, `The first surcharge is in ${d.firstSurcharge.year}, from ${d.firstSurcharge.magiYear}'s income: about ${money(d.firstSurcharge.over)} over the first line${d.firstSurcharge.conversion > 1 ? `, with a Roth conversion of about ${money(d.firstSurcharge.conversion)} that year` : ""}.`));
  // the tiers, the household's own marked
  const used = new Set(d.years.map((y) => y.tier));
  const t = tiersFor(d.status);
  surcharge.append(ui.h("h3", { style: { margin: "12px 0 4px" } }, `The lines for ${d.status === "married_joint" ? "a joint return" : d.status === "married_separate" ? "married filing separately" : "a single return"} (${d.year})`),
    ui.h("ul", { class: "mc-list" }, t.map(([upTo, b, dAdd], i) => ui.h("li", { class: used.has(i) ? "on" : null }, ui.h("span", {}, i === 0 ? `Up to ${money(upTo)}` : upTo === Infinity ? `Over ${money(t[i - 1][0])}` : `${money(t[i - 1][0])} to ${money(upTo)}`, ui.h("span", { class: "mc-s" }, used.has(i) ? "your plan reaches this" : "")), ui.h("b", {}, `${cents(b)} + ${cents(dAdd)}`, ui.h("span", { class: "mc-s" }, "Part B + drug surcharge")))) ),
    ui.h("p", { class: "muted small" }, "Income here is modified adjusted gross income: the adjusted gross income on the return plus tax-free interest. The lines rise with prices every year, except the top one ($500,000; $750,000 joint), which starts rising in 2028; the plan keeps them in today's dollars. A life-changing event (retiring, a spouse's death) lets you ask Social Security to use a more recent year: form SSA-44."));
  root.append(surcharge);

  // the first years, one line each
  const first = d.years.slice(0, 12);
  root.append(ui.card("Year by year", ui.h("ul", { class: "mc-list" }, first.map((y) => ui.h("li", {}, ui.h("span", {}, `${y.year}`, ui.h("span", { class: "mc-s" }, `${y.enrolled} on Medicare; ${y.magiYear} income ${money(y.magiReal)}`)), ui.h("b", { class: y.tier > 0 ? "mc-warn" : null }, money(y.totalYearly), ui.h("span", { class: "mc-s" }, y.tier > 0 ? `+${money(y.surchargeYearly)} surcharge` : "a year"))))),
    d.years.length > first.length ? ui.h("p", { class: "muted small" }, `And ${d.years.length - first.length} more years to the end of the plan.`) : null,
    d.taxMode !== "brackets" ? ui.h("p", { class: "muted small" }, "The income is worked out through the federal brackets for this page, even though your plan uses a flat tax rate.") : null));

  // the premiums to plan for
  const m = plan.retirement?.medicare ?? {};
  root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "Your plans' premiums"), ui.h("span", { class: "fold-status" }, `drug ${cents(d.partD)}${d.supplement ? `, supplement ${cents(d.supplement)}` : ""}`), ui.h("span", { class: "fold-chev" }, "›")),
    ui.form([
      { key: "partDPremium", label: "Drug plan (Part D) premium a month", type: "money", min: 0, help: `empty: the national base premium, ${cents(PART_D_BASE)} in ${YEAR} (${cents(PART_D_BASE_NEXT.amount)} in ${PART_D_BASE_NEXT.year})` },
      { key: "supplementPremium", label: "Supplement (Medigap) or Advantage plan premium a month", type: "money", min: 0, help: "a supplement covers what Medicare does not; an Advantage plan replaces Parts A and B" },
    ], { partDPremium: m.partDPremium ?? "", supplementPremium: m.supplementPremium ?? "" }, (v) => {
      pending = "Saved.";
      store.update((p) => { p.retirement = p.retirement ?? {}; p.retirement.medicare = { partDPremium: v.partDPremium ?? null, supplementPremium: v.supplementPremium ?? null }; });
    }, { submitLabel: "Save" })));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/retirement/roth-conversions" }, "Roth conversions"), ui.h("a", { class: "btn secondary", href: "#/retirement/healthcare" }, "Before 65"))));
}

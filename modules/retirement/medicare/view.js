// modules/retirement/medicare/view.js -- DOM only. When each of you signs up, what Medicare costs over
// retirement, the income surcharge (IRMAA) year by year from the plan's own income, the tiers with yours
// marked, and the drug-plan and supplement premiums to plan for.
import { tiersFor, YEAR, PART_D_BASE, PART_D_BASE_NEXT, MEDIGAP_G } from "./data/medicare.js";
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
    // past 65 the sign-up is done: a fact, not a window that closed years ago (round 4, 2026-11-02); the window, the
    // employer-cover note and the late penalty are for those who have not reached 65
    d.people.length ? ui.h("ul", {}, d.people.map((p) => ui.h("li", {}, p.age !== null && p.age >= 65
      ? `${p.name}: Medicare age since ${monthName(p.signup.month)}. This page works out what it costs each year.`
      : `${p.name}: sign up between ${monthName(p.signup.from)} and ${monthName(p.signup.to)}, around the 65th birthday (${monthName(p.signup.month)}).`))) : ui.h("p", { class: "muted small" }, "Add birth dates on People to see when each of you signs up."),
    d.people.some((p) => p.age === null || p.age < 65) ? ui.h("p", { class: "muted small" }, `Still working with cover from a large employer? You can wait without a penalty. Otherwise signing up late adds ${Math.round(d.latePenalty * 100)}% to Part B for every full year missed, for life.`) : null));
  if (!d.ready) { root.append(ui.card(null, ui.h("p", { class: "muted" }, `To work out the costs year by year, the plan needs: ${d.missing.join("; ")}.`))); return; }

  root.append(ui.card("What it costs", ui.row(
    ui.stat("Over retirement", money(d.lifetime), "all premiums, today's dollars"),
    ui.stat("Income surcharge", d.surcharge > 0 ? money(d.surcharge) : "None", d.surcharge > 0 ? `in ${d.surchargeYears} year${d.surchargeYears === 1 ? "" : "s"}` : "on the plan's income"),
  ), ui.h("p", { class: "muted small" }, `Each person: Part B ${cents(d.partB)}, a drug plan ${cents(d.partD)}${d.supplement ? ` and a supplement ${cents(d.supplement)}` : ""} a month${d.supplementDefault ? ` (no supplement entered: the national average for Medigap Plan G in ${d.supplementYear}; yours may differ, below)` : d.supplement ? "" : " (no supplement: you entered $0)"}, plus the Part B deductible of ${money(d.deductible)} a year when used.`),
    // what is not counted, in one plain sentence (seventh pass)
    ui.h("p", { class: "muted small" }, "Not counted: what you pay at the pharmacy, dental care, glasses, hearing aids and long-term care.")));

  // a husband or wife 65 or over who has stopped while the other still works: their Medicare is counted unless a plan through
  // that job covers them (retirement.medicare.jobCoversSpouse; review 2026-11-06, seventh pass: it was taken for granted)
  // (verify 2026-11-06: not when Will the money last? adds no health cover at all, "my spending figure already includes health
  // cover": it said that page counts their Medicare; still shown while the tick is on, so it can be taken off)
  const sy = d.spouseYears ?? [];
  if ((sy.length && !d.healthIncluded) || d.jobCoversSpouse) {
    const list = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
    const names = [...new Set(sy.flatMap((y) => y.names))], worker = sy[0]?.worker ?? null;
    // the years as the projection says them (spouseWords): "2029", "2053 and 2054", "2026 to 2029"; years apart are listed
    const ys = sy.map((y) => y.year), apart = ys.some((y, i) => i > 0 && y !== ys[i - 1] + 1);
    const yrs = !ys.length ? "" : apart ? list(ys.map(String)) : ys.length === 1 ? `${ys[0]}` : ys.length === 2 ? `${ys[0]} and ${ys[1]}` : `${ys[0]} to ${ys.at(-1)}`;
    const box = ui.h("input", { type: "checkbox", checked: d.jobCoversSpouse ? true : null, onChange: (e) => {
      const on = e.target.checked;
      const whose = names.length ? `${list(names)}'s Medicare` : "Medicare";
      pending = on ? `Saved: ${whose} is left out while ${worker ?? "a husband or wife"} still works.` : `Saved: ${whose} is counted from 65.`;
      store.update((p) => { p.retirement = p.retirement ?? {}; p.retirement.medicare = { ...(p.retirement.medicare ?? {}) }; if (on) p.retirement.medicare.jobCoversSpouse = true; else delete p.retirement.medicare.jobCoversSpouse; });
    } });
    root.append(ui.card("Cover through a job",
      sy.length ? ui.h("p", {}, `In ${yrs} ${list(names)} ${names.length > 1 ? "are" : "is"} 65 or over while ${worker} still works. ${d.healthIncluded ? "Will the money last? adds no health cover now: you said your spending figure already includes it." : d.jobCoversSpouse ? `You said a plan through ${worker}'s job covers ${names.length > 1 ? "them" : names[0]}, so Will the money last? leaves ${names.length > 1 ? "their" : `${names[0]}'s`} Medicare out ${ys.length === 1 ? "that year" : "in those years"}.` : `Will the money last? counts ${names.length > 1 ? "their" : `${names[0]}'s`} Medicare ${ys.length === 1 ? "that year" : "in those years"} unless you say a plan through ${worker}'s job covers ${names.length > 1 ? "them" : names[0]}.`}`) : ui.h("p", {}, "Nobody is 65 or over while a husband or wife still works in your plan now."),
      ui.h("label", { style: { display: "flex", gap: "10px", alignItems: "center", minHeight: "44px", fontSize: "var(--fs-sm)" } }, box, ui.h("span", {}, sy.length ? `A plan through ${worker}'s job covers ${list(names)}` : "A plan through a husband's or wife's job covers the one who is 65 or over")),
      ui.h("p", { class: "muted small" }, "Check with the plan first: when the employer has fewer than 20 workers, Medicare usually has to pay first.")));
  }

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
  root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "Your plans' premiums"), ui.h("span", { class: "fold-status" }, `drug ${cents(d.partD)}, supplement ${cents(d.supplement)}`), ui.h("span", { class: "fold-chev" }, "›")),
    ui.form([
      { key: "partDPremium", label: "Drug plan (Part D) premium a month", type: "money", min: 0, help: `empty: the national base premium, ${cents(PART_D_BASE)} in ${YEAR} (${cents(PART_D_BASE_NEXT.amount)} in ${PART_D_BASE_NEXT.year})` },
      { key: "supplementPremium", label: "Supplement (Medigap) or Advantage plan premium a month", type: "money", min: 0, help: `a supplement covers what Medicare does not; an Advantage plan replaces Parts A and B. Empty: ${cents(MEDIGAP_G.monthly)}, the national average for Medigap Plan G in ${MEDIGAP_G.year}; 0 if you pay none` },
    ], { partDPremium: m.partDPremium ?? "", supplementPremium: m.supplementPremium ?? "" }, (v) => {
      pending = "Saved.";
      store.update((p) => { p.retirement = p.retirement ?? {}; p.retirement.medicare = { ...(p.retirement.medicare ?? {}), partDPremium: v.partDPremium ?? null, supplementPremium: v.supplementPremium ?? null }; });
    }, { submitLabel: "Save" })));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/retirement/roth-conversions" }, "Roth conversions"), ui.h("a", { class: "btn secondary", href: "#/retirement/healthcare" }, "Before 65"))));
}

// modules/insurance/ltc/view.js -- DOM only. The odds and the costs first, then for each adult: the
// care dropped into the plan (does the money still last, how many years of care it could carry, what
// a policy on file changes), and the care to plan for as a small form. Runs on the PC when connected.
import { CARE, COST_YEAR, CHANCE_AFTER_65, AVERAGE_YEARS, DEFAULTS, DEFAULT_WAIT_DAYS, DEFAULT_BENEFIT_YEARS, MAX_YEARS } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.ltc-root .ltc-costs { list-style: none; margin: 4px 0 0; padding: 0; }
.ltc-root .ltc-costs li { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--line); }
.ltc-root .ltc-costs li:last-child { border-bottom: 0; }
.ltc-root .ltc-costs li.on { font-weight: 650; }
.ltc-root .ltc-costs .ltc-v { white-space: nowrap; }
.ltc-root .ltc-verdict { font-weight: 650; margin: 8px 0 4px; }
.ltc-root .ltc-verdict.ok { color: var(--ok); } .ltc-root .ltc-verdict.bad { color: var(--bad); }
.ltc-root .ltc-d { color: var(--text-2); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n / 10) * 10, cur);
  const yrs = (n) => { const r = Math.round(n * 2) / 2; return `${r % 1 ? `${Math.floor(r)}½` : r} year${r === 1 ? "" : "s"}`; };
  const root = ui.h("div", { class: "ltc-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const host = ui.h("div");
  root.append(host);
  host.append(ui.notice("info", "Running your plan with years of care in it..."));
  ctx.computeRemote("insurance/ltc", { today: fmt.today() }).then(draw, (e) => host.replaceChildren(ui.notice("error", `Long-term care could not be worked out: ${e}. Reload the page; if it keeps happening, check Will the money last? first.`)));

  function draw(d) {
    host.replaceChildren();
    host.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Care in later life"),
      ui.h("p", { class: "lede" }, `Almost ${Math.round(CHANCE_AFTER_65 * 10)} in 10 people turning 65 will need help with daily life at some point: at home, in assisted living or in a nursing home. Women need it for ${AVERAGE_YEARS.female} years on average, men for ${AVERAGE_YEARS.male}. Medicare pays for very little of it.`),
      ui.h("p", { class: "muted small" }, "Figures: US Administration for Community Living; care costs from the CareScout (Genworth) Cost of Care Survey.")));
    if (!d || !d.ready) {
      host.append(ui.card(null, ui.h("p", {}, "To see whether your plan could pay for care, it needs the basics first:"), ui.h("ul", {}, (d?.missing ?? []).map((m) => ui.h("li", {}, m))), ui.row(ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Will the money last?"))));
      return;
    }
    // what care costs
    const costs = ui.h("ul", { class: "ltc-costs" }, Object.entries(CARE).map(([key, c]) => ui.h("li", { class: key === d.care.key ? "on" : null }, ui.h("span", {}, c.label), ui.h("span", { class: "ltc-v" }, `${fmt.money(Math.round(c.yearly * d.settings.costFactor), cur)} a year`))));
    host.append(ui.card("What care costs", ui.h("p", { class: "muted small" }, `The middle price across the country in ${COST_YEAR}${d.settings.costFactor !== 1 ? `, times ${Math.round(d.settings.costFactor * 100)}% for where you live` : ""}. Prices differ a lot by state: the survey's site has yours.`), costs));

    for (const p of d.people) host.append(personCard(p, d));
    host.append(settingsCard(d));
    host.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/insurance/policies" }, "Your policies"), ui.h("a", { class: "btn secondary", href: "#/retirement/longevity" }, "How long to plan for"))));
  }

  function personCard(p, d) {
    const card = ui.card(`If ${p.name} needed care`);
    const what = `${yrs(p.years)} of ${d.care.short} from ${p.startAge}`;
    card.append(ui.row(
      ui.stat("Care would cost", money(p.costTotal), `${what}, today's prices`),
      ui.stat("Chance of reaching " + p.startAge, `${Math.round(p.reachChance * 100)}%`, "from How long to plan for"),
    ));
    if (!d.base.success) {
      card.append(ui.h("p", { class: "ltc-verdict bad" }, "The plan runs short even without care."), ui.h("p", { class: "ltc-d" }, `Fix that first on Will the money last?; care would only bring the day forward${p.self.failAge ? ` (the money would run out when ${d.primary} is ${p.self.failAge})` : ""}.`));
    } else if (p.self.success) {
      card.append(ui.h("p", { class: "ltc-verdict ok" }, `Your plan can pay for it and still last.`),
        ui.h("p", { class: "ltc-d" }, `The savings could carry ${p.maxYears >= MAX_YEARS ? `${MAX_YEARS} years or more` : `up to about ${yrs(p.maxYears)}`} of ${d.care.short} from ${p.startAge}; after ${what} about ${money(p.self.endReal)} is still left at the end. Paying for care from savings like this is called self-insuring.`));
    } else {
      card.append(ui.h("p", { class: "ltc-verdict bad" }, p.self.failAge ? `The money would run out when ${d.primary} is ${p.self.failAge}.` : "The money would run out before the end of the plan."),
        ui.h("p", { class: "ltc-d" }, `The savings could carry about ${yrs(p.maxYears ?? 0)} of ${d.care.short}. About ${money(p.shortToday)} more saved today would pay for ${what}; a long-term care policy is the other way to cover it. When savings run out, Medicaid pays for nursing-home care, in most states once savings are down to about $2,000.`));
    }
    if (p.policy) {
      const pol = p.policy;
      const lost = !pol.inflationProtected;
      card.append(ui.h("h3", { style: { margin: "14px 0 4px" } }, `With ${pol.names.join(" and ")}`),
        ui.h("p", {}, `It pays up to ${money(pol.monthly)} a month for ${pol.years} years after ${pol.waitDays} days. ${lost ? `It has no inflation protection, so by ${p.fromYear} that ${money(pol.monthly)} would buy what about ${money(pol.monthlyThenReal)} buys today.` : "Its benefit rises with prices."} For ${what} it would pay about ${money(pol.paysTotal)} in today's money; the premiums until then come to about ${money(pol.premiumsToStart)} in today's money${pol.premiumsToStart > pol.paysTotal ? ", more than it would pay out" : ""}.`),
        p.withPolicy ? ui.h("p", { class: "ltc-d" }, p.withPolicy.success ? `Paying the premiums from savings and counting what it pays, the plan ends with about ${money(p.withPolicy.endReal)}${p.self.success ? ` instead of ${money(p.self.endReal)} without the policy: ${p.withPolicy.endReal >= p.self.endReal ? "the policy comes out ahead" : "the policy costs the plan more than it pays back"}` : ""}.` : `Even with the policy the money would run out when ${d.primary} is ${p.withPolicy.failAge}.`) : null);
      card.append(policyTerms(p));
    }
    return card;
  }

  // the policy terms the Policies form does not ask
  function policyTerms(p) {
    const fold = ui.h("details", { class: "fold", style: { marginTop: "8px" } }, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Policy terms"), ui.h("span", { class: "fold-status" }, `${p.policy.waitDays} days, ${p.policy.years} years`), ui.h("span", { class: "fold-chev" }, "›")));
    for (const x of plan.insurance.policies.filter((y) => y.kind === "ltc" && y.personId === p.id)) {
      fold.append(ui.h("h3", { style: { margin: "10px 0 4px" } }, x.name), ui.form([
        { key: "waitDays", label: "Waiting period (days)", type: "number", min: 0, step: "1", help: `${DEFAULT_WAIT_DAYS} if you leave it empty` },
        { key: "benefitYears", label: "Years of benefits", type: "number", min: 0.5, step: "0.5", help: `${DEFAULT_BENEFIT_YEARS} if you leave it empty` },
        { key: "inflationProtected", label: "The benefit rises with prices (an inflation rider)", type: "checkbox" },
      ], { waitDays: x.waitDays ?? "", benefitYears: x.benefitYears ?? "", inflationProtected: !!x.inflationProtected }, (v) => {
        pending = `${x.name} saved.`;
        store.update((pl) => { const t = pl.insurance.policies.find((y) => y.id === x.id); if (t) Object.assign(t, { waitDays: v.waitDays ?? null, benefitYears: v.benefitYears ?? null, inflationProtected: !!v.inflationProtected }); });
      }, { submitLabel: "Save" }));
    }
    return fold;
  }

  function settingsCard(d) {
    const s = plan.insurance?.ltc ?? {};
    const card = ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "The care to plan for"), ui.h("span", { class: "fold-status" }, `${CARE[d.settings.care].short}, from ${d.settings.startAge}`), ui.h("span", { class: "fold-chev" }, "›")));
    card.append(ui.form([
      { key: "care", label: "Kind of care", type: "select", options: Object.entries(CARE).map(([value, c]) => ({ value, label: c.label })) },
      { key: "startAge", label: "From age", type: "number", min: 50, max: 110, step: "1", help: `${DEFAULTS.startAge} if you leave it empty` },
      { key: "years", label: "For how many years", type: "number", min: 0.5, max: MAX_YEARS, step: "0.5", help: `empty: the average, ${AVERAGE_YEARS.female} for women and ${AVERAGE_YEARS.male} for men (set on How long to plan for), 3 otherwise` },
      { key: "costFactor", label: "Costs where you live", type: "percent", min: 10, max: 400, help: "100% = the national middle price; 130% if your state costs 30% more" },
    ], { care: d.settings.care, startAge: s.startAge ?? "", years: s.years ?? "", costFactor: s.costFactor ?? 1 }, (v) => {
      pending = "Care settings saved.";
      store.update((pl) => { pl.insurance = pl.insurance ?? { policies: [] }; pl.insurance.ltc = { care: v.care, startAge: v.startAge ?? null, years: v.years ?? null, costFactor: v.costFactor ?? 1 }; });
    }, { submitLabel: "Save" }));
    return card;
  }
}

// modules/insurance/policies/compute.js -- PURE. Every insurance policy the household holds, on one
// footing: what it pays out, what it costs a year, whom it covers, when it ends or renews, and the
// things worth a second look (cover through work that ends with the job, term life ending while
// someone still depends on it, a renewal coming up). The other insurance pages and the stress tests
// read this list.
import { perYear, periodLabel } from "../../../core/math/periods.js";
import { daysBetween } from "../../../core/math/dates.js";

/** The kinds of policy, what their benefit means and which part of the household's protection they are. */
export const KINDS = {
  term:       { label: "Term life", icon: "🕊️", benefit: "Death benefit", group: "life", ends: true },
  whole:      { label: "Whole or universal life", icon: "🏛️", benefit: "Death benefit", group: "life", cashValue: true },
  disability: { label: "Disability", icon: "🦽", benefit: "Monthly benefit", group: "income" },
  ltc:        { label: "Long-term care", icon: "🏥", benefit: "Monthly benefit", group: "care" },
  health:     { label: "Health", icon: "🩺", benefit: "Out-of-pocket maximum", group: "health" },
  home:       { label: "Home or renters", icon: "🏠", benefit: "Dwelling or contents cover", group: "property" },
  auto:       { label: "Auto", icon: "🚗", benefit: "Liability limit (per accident)", group: "property" },
  umbrella:   { label: "Umbrella", icon: "☂️", benefit: "Liability limit", group: "property" },
  other:      { label: "Other", icon: "📄", benefit: "Benefit", group: "other" },
};
export const GROUPS = { life: "Life", income: "Income if you cannot work", care: "Care", health: "Health", property: "Home, car and liability", other: "Other" };
/** How far ahead a renewal or an end date is flagged. */
export const SOON_DAYS = 60;

/**
 * compute(plan, { today }) -> {
 *   items: [{ ...policy, kindLabel, icon, group, benefitLabel, personName, premiumYearly, periodLabel, endsSoon, renewsSoon, ended, flags: [text] }],
 *   count, premiumYearly, premiumMonthly,
 *   byPerson: [{ personId, name, life, disabilityMonthly, ltcMonthly }],
 *   byGroup: [{ group, label, count, premiumYearly }], warnings: [text]
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const people = plan.household?.people ?? [];
  const nameOf = (id) => people.find((p) => p.id === id)?.name ?? (id ? "Someone" : "Household");
  const dependents = people.some((p) => p.role === "dependent") || people.filter((p) => p.role !== "dependent").length > 1;
  const items = (plan.insurance?.policies ?? []).map((x) => {
    const k = KINDS[x.kind] ?? KINDS.other;
    const premiumYearly = perYear(x.premium, x.period ?? "monthly");
    const endsIn = today && x.endDate ? daysBetween(today, x.endDate) : null;
    const renewsIn = today && x.renewalDate ? daysBetween(today, x.renewalDate) : null;
    const flags = [];
    if (x.throughWork && (k.group === "life" || k.group === "income")) flags.push("through work: it ends if the job does");
    if (k.ends && endsIn !== null && endsIn >= 0 && dependents) flags.push(`ends ${x.endDate.slice(0, 4)}: is anyone still depending on it then?`);
    if (renewsIn !== null && renewsIn >= 0 && renewsIn <= SOON_DAYS) flags.push(`renews in ${renewsIn} day${renewsIn === 1 ? "" : "s"}: a good moment to compare prices`);
    if (!(Number(x.benefit) > 0)) flags.push(`no ${k.benefit.toLowerCase()} entered`);
    return { ...x, kindLabel: k.label, icon: k.icon, group: k.group, benefitLabel: k.benefit, personName: nameOf(x.personId), premiumYearly, periodLabel: periodLabel(x.period ?? "monthly"),
      ended: endsIn !== null && endsIn < 0, endsSoon: endsIn !== null && endsIn >= 0 && endsIn <= SOON_DAYS, renewsSoon: renewsIn !== null && renewsIn >= 0 && renewsIn <= SOON_DAYS, flags };
  });
  const active = items.filter((x) => !x.ended);
  const sumBy = (list, f) => list.reduce((s, x) => s + (Number(f(x)) || 0), 0);
  const byPerson = people.filter((p) => p.role !== "dependent").map((p) => {
    const mine = active.filter((x) => x.personId === p.id);
    return { personId: p.id, name: p.name, life: sumBy(mine.filter((x) => x.group === "life"), (x) => x.benefit), disabilityMonthly: sumBy(mine.filter((x) => x.kind === "disability"), (x) => x.benefit), ltcMonthly: sumBy(mine.filter((x) => x.kind === "ltc"), (x) => x.benefit) };
  });
  const byGroup = Object.entries(GROUPS).map(([group, label]) => { const g = active.filter((x) => x.group === group); return { group, label, count: g.length, premiumYearly: sumBy(g, (x) => x.premiumYearly) }; }).filter((g) => g.count);
  const warnings = [];
  for (const x of items) if (x.ended) warnings.push(`${x.name || x.kindLabel} ended on ${x.endDate}: remove it or enter the new policy.`);
  return { items, count: items.length, premiumYearly: sumBy(active, (x) => x.premiumYearly), premiumMonthly: sumBy(active, (x) => x.premiumYearly) / 12, byPerson, byGroup, warnings };
}

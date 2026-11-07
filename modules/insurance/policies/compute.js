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
  landlord:   { label: "Landlord (a home you rent out)", icon: "🏘️", benefit: "Dwelling cover", group: "property" },
  auto:       { label: "Auto", icon: "🚗", benefit: "Liability limit (per accident)", group: "property" },
  umbrella:   { label: "Umbrella", icon: "☂️", benefit: "Liability limit", group: "property" },
  other:      { label: "Other", icon: "📄", benefit: "Benefit", group: "other" },
};
export const GROUPS = { life: "Life", income: "Income if you cannot work", care: "Care", health: "Health", property: "Home, car and liability", other: "Other" };
/** The kinds that insure a home's building: a homeowners, condo or renters policy, and a landlord policy for a home rented out. */
export const HOME_KINDS = ["home", "landlord"];

const words = (v) => String(v ?? "").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
/** namesHome(policy, name) -> true when the policy's name holds the home's name as whole words, three letters or more ("Condo landlord policy", "Condo"). */
export function namesHome(policy, name) {
  const w = words(name).join(" ");
  return w.length >= 3 && ` ${words(policy?.name).join(" ")} `.includes(` ${w} `);
}

/**
 * pairHomes(homes, policies, { lone }) -> [policy | null] for each home ({ accountId, name, rental }), one policy to one home (round 8
 * batch 6, landlord-2 and landlord-7: the pages paired by list order, so the condo could take the main home's policy):
 * 1. the policy tied to the home (`accountId`, "Which home" on Policies);
 * 2. by name: a policy whose name holds the home's name as whole words ("Condo landlord policy" for "Condo"), when it is the
 *    only policy left that names this home and no other home left (repeated while it pairs, so "Home policy" going to Home
 *    leaves "Condo home insurance" naming only Condo);
 * 2b. by kind, when a landlord policy is left: landlord policies with the homes rented out (`rental: true`), homeowners ones
 *    with the others, one to one in order within each group whose counts match (review 2026-11-06, money 6);
 * 3. what is left (a policy named for a home that already has one is not), one to one in list order when as many homes as
 *    policies are left; else a single home left with a single policy left, or (`lone: "first"`) with the first of several
 *    (insurance/property's rule before this change).
 * Pages pass the homes and policies they check; the order rules are each page's own from before, so a plan with neither a
 * tie nor names is paired as it was.
 */
export function pairHomes(homes, policies, { lone = "only" } = {}) {
  const out = homes.map(() => null), used = new Set();
  homes.forEach((h, i) => { const p = h.accountId ? policies.find((x) => x.accountId === h.accountId && !used.has(x)) : null; if (p) { out[i] = p; used.add(p); } });
  const holds = (p, h) => namesHome(p, h.name);
  // tie-break (follow-up C7): two homes of the same name, a landlord policy that names both: it goes with the one rented out, so the
  // other keeps the policy that is left (before, neither was paired and "No home insurance on file" showed for a home that has one)
  let tieBroke = false;
  for (const p of policies) {
    if (used.has(p) || p.kind !== "landlord" || (p.accountId && homes.some((o) => o.accountId === p.accountId))) continue;
    const named = homes.map((_, i) => i).filter((i) => !out[i] && holds(p, homes[i]));
    const rented = named.filter((i) => homes[i].rental);
    if (named.length > 1 && rented.length === 1) { out[rented[0]] = p; used.add(p); tieBroke = true; }
  }
  // by name, again and again while it pairs: a policy that names only this home of those left, and the only such policy
  for (let more = true; more;) {
    more = false;
    homes.forEach((h, i) => {
      if (out[i]) return;
      const free = policies.filter((p) => !used.has(p) && !(p.accountId && homes.some((o) => o.accountId === p.accountId)));
      const hit = free.filter((p) => holds(p, h) && !homes.some((o, k) => k !== i && !out[k] && holds(p, o)));
      if (hit.length !== 1) return;
      out[i] = hit[0]; used.add(hit[0]); more = true;
    });
  }
  // left over: not used, not tied to another home, and not named for a home that already has its policy
  const free = () => policies.filter((p) => !used.has(p) && !(p.accountId && homes.some((o) => o.accountId === p.accountId)) && !homes.some((o, k) => out[k] && namesHome(p, o.name) && !homes.some((q, j) => j !== k && !out[j] && namesHome(p, q.name))));
  // by kind, when a landlord policy is left (review 2026-11-06, money 6: "Rental dwelling policy" listed first went to the home
  // lived in): landlord policies with the homes rented out (`rental`), homeowners policies with the others, one to one in order
  // within each group when its counts match. With no landlord policy nothing tells them apart, and the order rule is as before
  if (tieBroke || free().some((p) => p.kind === "landlord")) {
    for (const [rental, kind] of [[true, "landlord"], [false, "home"]]) {
      const hs = homes.map((_, i) => i).filter((i) => !out[i] && !!homes[i].rental === rental), ps = free().filter((p) => p.kind === kind);
      if (hs.length && hs.length === ps.length) hs.forEach((i, k) => { out[i] = ps[k]; used.add(ps[k]); });
    }
  }
  const leftH = homes.map((_, i) => i).filter((i) => !out[i]);
  const leftP = free();
  if (leftH.length && leftH.length === leftP.length) leftH.forEach((i, k) => { out[i] = leftP[k]; });
  else if (leftH.length === 1 && leftP.length && (leftP.length === 1 || lone === "first")) out[leftH[0]] = leftP[0];
  return out;
}

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

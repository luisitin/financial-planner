// modules/estate/estate-tax/compute.js -- PURE. Whether the estate could owe federal (or state) estate
// tax: what each of you owns, life insurance included; the exemption left after taxable gifts; for a
// couple, nothing at the first death (everything to the spouse) and the second death with and without
// the first one's unused exemption carried over (portability); the same at the end of the plan; and a
// rough state figure where the state has its own estate tax.
import { compute as computeNetWorth, ACCOUNT_TYPES, countedBalance } from "../../balance/net-worth/compute.js";
import { compute as computeGifting } from "../gifting/compute.js";
import { compute as computePolicies } from "../../insurance/policies/compute.js";
import { buildInputs } from "../../retirement/projection/compute.js";
import { project } from "../../../core/math/retirement.js";
import { exclusionFor, tentativeTax, STATE_ESTATE_TAX, STATE_INHERITANCE_TAX } from "../gifting/data/transfer-tax.js";

/** The federal estate tax on a taxable estate, with lifetime taxable gifts added back, less the credit for an exemption: IRC 2001(b) and 2010. */
export function estateTax(taxable, gifts, exemption) {
  return Math.max(0, tentativeTax(Math.max(0, taxable) + Math.max(0, gifts)) - tentativeTax(exemption));
}

/**
 * compute(plan, { today }) -> {
 *   year, exclusion, couple, people: [{ id, name, estate, lifeCover, gifts, exemptionLeft }],
 *   estateToday (net worth + life cover), lifeCover, charity,
 *   single: { taxable, tax } | null,
 *   pair: { firstDeath: { tax: 0, dsue: [per person] }, secondDeath: { estate, exemption, exemptionWithout, tax, taxWithout } } | null,
 *   end: { year, estate, tax } | null (at the end of the plan, today's dollars),
 *   headroom (exemption(s) - estate today), state: { code, estateTax, inheritanceTax, exemption, rate, tax } , warnings
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const year = today ? Number(String(today).slice(0, 4)) : 2026;
  const exclusion = exclusionFor(year);
  const people = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const couple = people.length >= 2;
  const nw = computeNetWorth(plan, { today });
  const pol = computePolicies(plan, { today });
  const life = pol.items.filter((x) => !x.ended && x.group === "life");
  const lifeCover = life.reduce((s, x) => s + (Number(x.benefit) || 0), 0);
  const gifting = computeGifting(plan, { today });
  const charity = (plan.estate?.legacy?.bequests ?? []).filter((b) => b.kind === "charity").reduce((s, b) => s + (Number(b.amount) || 0), 0);
  // each person's estate: what they own, half of what has no owner, and the life insurance on them (owned by them)
  const share = (a) => (a.ownerId && people.some((p) => p.id === a.ownerId) ? (a.ownerId) : null);
  const byPerson = people.map((p) => {
    let estate = 0;
    for (const a of plan.accounts ?? []) {
      const sign = (ACCOUNT_TYPES[a.type] ?? ACCOUNT_TYPES.other_asset).side === "liability" ? -1 : 1;
      const v = countedBalance(a) * sign;
      const owner = share(a);
      estate += owner === p.id ? v : owner === null ? v / Math.max(1, people.length) : 0;
    }
    const cover = life.filter((x) => x.personId === p.id).reduce((s, x) => s + (Number(x.benefit) || 0), 0);
    const gifts = gifting.lifetimeUsed[p.id] ?? 0;
    return { id: p.id, name: p.name, estate: estate + cover, lifeCover: cover, gifts, exemptionLeft: Math.max(0, exclusion - gifts) };
  });
  const estateToday = nw.netWorth + lifeCover;
  let single = null, pair = null;
  if (!couple) {
    const g = byPerson[0]?.gifts ?? 0;
    const taxable = Math.max(0, estateToday - charity);
    single = { taxable, tax: estateTax(taxable, g, exclusion) };
  } else {
    // first death: everything to the spouse (the unlimited marital deduction), no tax; the unused exemption can carry over
    const dsue = byPerson.map((p) => Math.max(0, exclusion - p.gifts));
    // second death: the whole estate in one; the survivor's own exemption plus the first's unused one (the smaller carry-over, to be safe)
    const carry = Math.min(...dsue);
    const survivorGifts = Math.max(...byPerson.map((p) => p.gifts));
    const taxable = Math.max(0, estateToday - charity);
    pair = { firstDeath: { tax: 0, dsue }, secondDeath: { estate: estateToday, taxable, exemption: exclusion + carry, exemptionWithout: exclusion, tax: estateTax(taxable, survivorGifts, exclusion + carry), taxWithout: estateTax(taxable, survivorGifts, exclusion) } };
  }
  // at the end of the plan: the investments the projection leaves (today's dollars) plus the homes and other things it does not spend
  let end = null;
  const b = buildInputs(plan, { today });
  if (b.inputs) {
    const r = project(b.inputs);
    const kept = (plan.accounts ?? []).filter((a) => ["property", "vehicle", "other_asset"].includes(a.type)).reduce((s, a) => s + countedBalance(a), 0);
    const estate = Math.max(0, r.endBalanceReal) + kept + life.filter((x) => x.kind === "whole").reduce((s, x) => s + (Number(x.benefit) || 0), 0);
    const exemption = couple ? exclusion * 2 : exclusion;
    end = { year: b.inputs.endYear, estate, tax: estateTax(Math.max(0, estate - charity), 0, exemption) };
  }
  const headroom = (couple ? exclusion * 2 : exclusion) - estateToday;
  // the state
  const code = String(plan.household?.state ?? "").toUpperCase();
  const st = plan.estate?.stateTax ?? {};
  const stateExemption = Number(st.exemption) > 0 ? Number(st.exemption) : null, stateRate = Number(st.rate) > 0 ? Number(st.rate) : null;
  const state = { code, estateTax: STATE_ESTATE_TAX.includes(code), inheritanceTax: STATE_INHERITANCE_TAX.includes(code), exemption: stateExemption, rate: stateRate, tax: stateExemption !== null && stateRate !== null ? stateRate * Math.max(0, estateToday - charity - stateExemption) : null };
  const warnings = [];
  if (couple && headroom < exclusion) warnings.push("At the first death, file an estate tax return (Form 706) even though no tax is due: it is how the unused exemption carries over to the survivor (portability). Without it, the survivor has only their own.");
  return { year, exclusion, couple, people: byPerson, estateToday, lifeCover, charity, single, pair, end, headroom, state, warnings };
}

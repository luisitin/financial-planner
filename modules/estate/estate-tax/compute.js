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

/**
 * The federal estate tax: the tentative tax on the taxable estate plus lifetime taxable gifts, less the gift tax payable
 * on those gifts (IRC 2001(b)(1)-(2)), less the credit for the exemption, never below zero (IRC 2010(a), (d)).
 */
export function estateTax(taxable, gifts, exemption, giftTax = 0) {
  const before = Math.max(0, tentativeTax(Math.max(0, taxable) + Math.max(0, gifts)) - Math.max(0, giftTax));
  return Math.max(0, before - tentativeTax(exemption));
}
/** The gift tax payable on lifetime taxable gifts against the giver's own exemption, at today's rates (IRC 2001(b)(2) and (g); 2502, 2505): 0 until the gifts pass the exemption. */
export const giftTaxOn = (gifts, exemption) => Math.max(0, tentativeTax(Math.max(0, gifts)) - tentativeTax(exemption));

/**
 * compute(plan, { today }) -> {
 *   year, exclusion, couple, people: [{ id, name, estate, lifeCover, gifts, exemptionLeft }],
 *   estateToday (net worth + life cover), lifeCover, charity,
 *   single: { taxable, giftTax, tax } | null,
 *   pair: { firstDeath: { tax: 0, dsue: [per person] }, secondDeath: { estate, taxable, exemption (the survivor's own + the first to die's unused one, in the
 *     costlier order), exemptionWithout, tax, taxWithout (the costlier of the two orders of death, with and without portability), firstToDie (that order's first, by index) } } | null,
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
    const giftTax = giftTaxOn(g, exclusion);
    single = { taxable, giftTax, tax: estateTax(taxable, g, exclusion, giftTax) };
  } else {
    // first death: everything to the spouse (the unlimited marital deduction), no tax; the unused exemption can carry over
    // (portability): the exemption less that person's lifetime taxable gifts (IRC 2010(c)(4); 26 CFR 20.2010-2(c))
    const dsue = byPerson.map((p) => Math.max(0, exclusion - p.gifts));
    // second death: the whole estate in one, with the survivor's own gifts added back and their gift tax subtracted,
    // against the survivor's exemption plus the first to die's unused one. Who dies first is not known: both orders are
    // worked and the costlier one is shown (with portability, and again without it).
    const taxable = Math.max(0, estateToday - charity);
    const orders = [[0, 1], [1, 0]].slice(0, byPerson.length).map(([first, last]) => {
      const gifts = byPerson[last].gifts, giftTax = giftTaxOn(gifts, exclusion);
      return { first, exemption: exclusion + dsue[first], tax: estateTax(taxable, gifts, exclusion + dsue[first], giftTax), taxWithout: estateTax(taxable, gifts, exclusion, giftTax) };
    });
    // with portability the two orders often cost the same (40% x (estate + both people's gifts - 2 exemptions)): then the
    // order carrying the smaller unused exemption is the one shown
    const worst = orders.reduce((a, b) => (b.tax > a.tax + 0.005 || (Math.abs(b.tax - a.tax) <= 0.005 && b.exemption < a.exemption) ? b : a));
    pair = { firstDeath: { tax: 0, dsue }, secondDeath: { estate: estateToday, taxable, exemption: worst.exemption, exemptionWithout: exclusion, tax: worst.tax, taxWithout: Math.max(...orders.map((o) => o.taxWithout)), firstToDie: worst.first } };
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

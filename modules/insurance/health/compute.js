// modules/insurance/health/compute.js -- PURE. Health plans side by side on what they really cost a
// year: the premiums, plus what you would pay for care (the deductible, then your share, up to the
// out-of-pocket maximum), less the employer's HSA money and the tax a health savings account saves,
// in a quiet year, your usual year and a bad year. Which plan wins at which level of bills, and which
// plans can have an HSA.
import { limitsFor } from "../../retirement/contributions/compute.js";
import { taxView, known } from "../../taxes/federal/known.js";
import { compute as computeFederal, addIncome } from "../../taxes/federal/compute.js";
import { maximumEarnings } from "../../retirement/social-security/compute.js";
import { federalTax } from "../../../core/math/tax.js";
import { adultMedicare } from "../../taxes/federal/hsa-medicare.js";
import { nameIn, verbFor } from "../../../core/words.js";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** A quiet year (a check-up, a prescription) and a bad year (a hospital stay or surgery), in the bills the plan is charged. */
export const QUIET = 1000, BAD = 100000;
/** Payroll tax an HSA contribution through the paycheck also saves (Social Security 6.2% + Medicare 1.45%). */
export const FICA = 0.0765;
/**
 * A plan can have an HSA only with at least this deductible and at most this out-of-pocket maximum (26 U.S.C.
 * 223(c)(2)), and this much can go into the account in a year (223(b)): 2026 IRS Rev. Proc. 2025-19 section 2.01,
 * 2027 Rev. Proc. 2026-24 section 3.01 (read 2026-10-31). A year after the newest holds the newest.
 */
export const HDHP_BY_YEAR = {
  2026: { self: { minDeductible: 1700, maxOop: 8500, hsa: 4400 }, family: { minDeductible: 3400, maxOop: 17000, hsa: 8750 } },
  2027: { self: { minDeductible: 1750, maxOop: 8700, hsa: 4500 }, family: { minDeductible: 3500, maxOop: 17400, hsa: 9000 } },
};
/** The year whose rules apply: the year itself when published, else the nearest before it (the first before any). */
export const hdhpYear = (year) => { const ys = Object.keys(HDHP_BY_YEAR).map(Number).sort((a, b) => a - b); return ys.filter((y) => y <= Number(year)).at(-1) ?? ys[0]; };
/** The 2026 rules, kept for older readers. */
export const HDHP = HDHP_BY_YEAR[2026];
/**
 * Whether a plan's figures allow an HSA under `rules` (HDHP_BY_YEAR[year][tier]): "yes", "no", or "unknown" when no
 * out-of-pocket maximum is entered and the plan has a share after the deductible (its most out of pocket is not
 * known); with no share, the deductible is the most out of pocket.
 */
export function hsaEligible(p, rules) {
  const ded = Number(p.deductible) || 0, cap = Number(p.oopMax) > 0 ? Number(p.oopMax) : null, share = Math.max(0, Number(p.coinsurance) || 0);
  if (ded < rules.minDeductible) return "no";
  const most = cap ?? (share > 0 ? null : ded);
  if (most === null) return "unknown";
  return most <= rules.maxOop ? "yes" : "no";
}
/** The steps the crossover search takes through the bills. */
const STEP = 250, SEARCH_TO = 200000;

/** What you pay for care with bills of `m` a year: everything up to the deductible, then your share, never past the out-of-pocket maximum. */
export function outOfPocket(p, m) {
  const ded = Math.max(0, Number(p.deductible) || 0), share = Math.min(1, Math.max(0, Number(p.coinsurance) || 0)), cap = Number(p.oopMax) > 0 ? Number(p.oopMax) : Infinity;
  return Math.min(cap, Math.min(m, ded) + share * Math.max(0, m - ded));
}

/** A plan's cost for a year with bills of `m`: premiums - employer HSA money + out of pocket - the tax saved paying that out of pocket through an HSA. */
export function yearCost(p, m, { hsaRoom, taxRate }) {
  const premiums = (Number(p.premium) || 0) * 12;
  const employer = p.hsa ? Math.max(0, Number(p.employerHsa) || 0) : 0;
  const oop = outOfPocket(p, m);
  const through = p.hsa ? Math.min(oop, Math.max(0, hsaRoom - employer)) : 0;
  const taxSaved = through * taxRate;
  return { premiums, employer, oop, taxSaved, total: premiums - employer + oop - taxSaved };
}

/**
 * compute(plan, { today }) -> {
 *   tier, expected, taxRate, hsaLimit, year (the year whose HSA rules apply), hdhp (those rules for the tier: minDeductible, maxOop, hsa),
 *   plans: [{ id, name, hsa, eligible (the figures allow an HSA), premiumsYearly, quiet, usual, bad (each { premiums, employer, oop, taxSaved, total }), worst, best (cheapest in the usual year) }],
 *   best: id | null, crossovers: [{ id, name, ranges: [{ from, to | null (and up) }] }] (the yearly bills at which each other plan is the cheaper one), count, warnings
 * }
 */
export function compute(plan, params = {}) {
  const h = plan.insurance?.health ?? {};
  const tier = h.tier === "family" ? "family" : "self";
  const expected = Number(h.expected) >= 0 && h.expected !== null && h.expected !== "" && h.expected !== undefined ? Number(h.expected) : 5000;
  const b = taxView(plan, params);
  // the year's rules: the HSA plan limits and how much can go in (the contributions page's table when it has the year)
  const limitsYear = hdhpYear(b.year);
  const rules = HDHP_BY_YEAR[limitsYear][tier];
  const L = limitsFor(limitsYear).kinds.hsa;
  const hsaFull = L ? (tier === "family" ? L.family : L.limit) : rules.hsa;
  // on Medicare (65 or older and getting Social Security) nobody can add to an HSA: the limit is 0 from the first month, so
  // 1/12 of it for each month before (IRC 223(b)(7); Pub. 969). Self-only: the adult the plan covers (the HSA page's choice, else the adult marked "Me"); family: while any adult is not on it
  const adults = (plan.household?.people ?? []).filter((q) => q.role !== "dependent");
  // self-only cover: the adult the HSA page says the plan covers (b.hsa.picture), when that page is on self-only cover, else the adult marked "Me"
  const pic = b.hsa.picture;
  const holderPerson = (pic.coverage === "self" && pic.coveredId ? adults.find((q) => q.id === pic.coveredId) : null) ?? adults.find((q) => q.role === "self") ?? adults[0] ?? null;
  const monthsOn = (tier === "family" ? adults : holderPerson ? [holderPerson] : []).map((q) => adultMedicare(plan, q, b.year).months);
  const medicareMonths = monthsOn.length ? (tier === "family" ? Math.min(...monthsOn) : monthsOn[0]) : 0;
  // the HSA page's own limit (money review M7: this page left out the catch-up from 55, so a household read $4,400 here and $5,400 there):
  // the covered adult's limit on self-only cover, the household's on family cover; otherwise the cover's limit with the holder's catch-up
  const hp = holderPerson ? pic.people.find((x) => x.id === holderPerson.id) : null;
  let hsaLimit = (hsaFull + (hp?.catchUp ?? 0)) * (12 - medicareMonths) / 12;
  if (tier === "family" && pic.coverage === "family" && Number.isFinite(pic.household?.limit)) hsaLimit = pic.household.limit;
  else if (tier === "self" && pic.coverage === "self" && hp?.eligible && Number.isFinite(hp.limit)) hsaLimit = hp.limit;
  // the marginal rate: the federal tax the year's HSA limit taken off income saves, per dollar, plus payroll tax for
  // contributions from pay. Worked over the limit, not over $1,000, since a credit that falls in steps of income (the
  // child care credit: a point per 4,000 over 150,000 joint) would make a small probe land on a step or miss it
  const probe = hsaFull > 0 ? hsaFull : 1000;   // the cover's full limit, even when Medicare lowers what can go in
  const t0 = b.result.totalTax;
  // the deduction works the Federal estimate's steps again (known(): a rental loss the allowance frees, the IRA deduction's
  // limits, the student loan interest), as the HSA page does: the HSA deduction is not added back in the rental allowance's
  // modified AGI (IRC 469(i)(3)(F)). Without a day there is no year to work, so the return alone gets the probe
  let t1 = federalTax({ ...b.inputs, adjustments: (b.inputs.adjustments ?? 0) + probe }, b.params).totalTax;
  if (params.today) {
    const f = computeFederal(plan, params);
    const f1 = { ...f, inputs: addIncome(f.inputs, f.inputs.separateTo ?? null, { adjustments: probe }) };
    f1.result = federalTax(f1.inputs, f.params);
    t1 = known(plan, params, f1).result.totalTax;
  }
  const marginal = Math.max(0, (t0 - t1) / probe);
  // payroll tax the HSA money saves when it comes from pay: 6.2% only under the Social Security base, 1.45% Medicare; nothing for
  // someone self-employed with no pay (Schedule SE is not lowered by the HSA deduction). The holder: the adult marked "Me",
  // or the best paid when "Me" has no pay on file
  const kp = b.k401?.people ?? [];
  const holder = kp.find((x) => x.id === (plan.household?.people ?? []).find((q) => q.role === "self")?.id) ?? kp[0] ?? null;
  const top = kp.reduce((a, x) => (x.pay > (a?.pay ?? 0) ? x : a), null);
  const earner = holder && holder.pay > 0 ? holder : top;
  const baseOf = maximumEarnings(limitsYear);
  const noWages = !(earner && earner.pay > 0) && !b.wagesTyped && (plan.income ?? []).length > 0;   // a retiree or a spouse at home: HSA money saves no payroll tax
  const payroll = earner && earner.pay > 0
    ? (0.062 * Math.max(0, Math.min(earner.pay, baseOf) - Math.min(Math.max(0, earner.pay - probe), baseOf)) + 0.0145 * probe) / probe
    : kp.some((x) => x.compensation - x.pay > 0) || noWages ? 0 : FICA;
  const taxRate = marginal + payroll;
  const opts = { hsaRoom: hsaLimit, taxRate };
  const warnings = [];
  // all year: nothing can go in; part of the year: the months before still count, so the plan saves tax on that much (never "saves no tax")
  const onIt = tier === "family" ? "every adult the plan covers is" : `${nameIn(holderPerson?.name)} ${verbFor(holderPerson?.name, "is", "are")}`;
  if (medicareMonths > 0 && (h.plans ?? []).some((p) => p.hsa)) warnings.push(medicareMonths >= 12
    ? `Once you're on Medicare you can't add to an HSA, so an HSA plan saves no tax on what you pay out of pocket${tier === "family" ? " once everyone covered is on it" : ""}. You can still spend what is in an HSA on medical bills, tax-free.`
    : `Once you're on Medicare you can't add to an HSA. From ${MONTH_NAMES[12 - medicareMonths]} ${onIt} on Medicare, so this year only $${Math.round(hsaLimit).toLocaleString("en-US")} can go in (for the months before) and save tax on what you pay out of pocket. You can still spend what is in an HSA on medical bills, tax-free.`);
  const $ = (n) => `$${n.toLocaleString("en-US")}`;
  const cover = `${tier === "family" ? "family" : "self-only"} coverage, ${limitsYear} rules`;
  const plans = (h.plans ?? []).map((p) => {
    const can = hsaEligible(p, rules), eligible = can === "yes";
    if (p.hsa && can === "unknown") warnings.push(`${p.name}: enter its out-of-pocket maximum to check that it can have an HSA (at most ${$(rules.maxOop)}, ${cover}).`);
    else if (p.hsa && !eligible) warnings.push(`${p.name}: a plan with a ${Number(p.deductible) < rules.minDeductible ? `deductible under ${$(rules.minDeductible)}` : `most out of pocket over ${$(rules.maxOop)}`} cannot have an HSA (${cover}). Check the figures, or uncheck the HSA box.`);
    const usual = yearCost(p, expected, opts), quiet = yearCost(p, QUIET, opts), bad = yearCost(p, BAD, opts);
    return { id: p.id, name: p.name, hsa: !!p.hsa, eligible, premiumsYearly: usual.premiums, quiet, usual, bad, worst: bad.total };
  });
  const best = plans.length ? plans.reduce((a, x) => (x.usual.total < a.usual.total ? x : a)) : null;
  for (const x of plans) x.best = best && x.id === best.id;
  // where each other plan would be the cheaper one: the ranges of yearly bills (on a $250 grid to $200,000) at which it beats the usual year's best
  const crossovers = [];
  if (best && plans.length > 1) {
    const raw = h.plans ?? [];
    const pb = raw.find((p) => p.id === best.id);
    for (const x of plans.filter((y) => !y.best)) {
      const px = raw.find((p) => p.id === x.id);
      const ranges = [];
      let open = null;
      for (let m = 0; m <= SEARCH_TO; m += STEP) {
        const wins = yearCost(px, m, opts).total < yearCost(pb, m, opts).total - 0.5;
        if (wins && open === null) open = m;
        if (!wins && open !== null) { ranges.push({ from: open, to: m - STEP }); open = null; }
      }
      if (open !== null) ranges.push({ from: open, to: null });
      crossovers.push({ id: x.id, name: x.name, ranges });
    }
  }
  return { tier, expected, medicareMonths, marginal, payrollRate: payroll, taxRate, hsaLimit, year: limitsYear, hdhp: rules, plans, best: best?.id ?? null, crossovers, count: plans.length, warnings };
}

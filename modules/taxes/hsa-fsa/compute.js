// modules/taxes/hsa-fsa/compute.js -- PURE. The health savings account: the limit for your
// cover and ages, the room left this year, the tax the money from pay saves (the federal return
// without it against with it, and the payroll tax per person, Social Security only up to its pay
// limit), and what the money grows into untaxed. The flexible spending account: the election
// against its limit, what is unspent, and the use-it-or-lose-it deadline.
import { limitsFor } from "../../retirement/contributions/compute.js";
import { maximumEarnings } from "../../retirement/social-security/compute.js";
import { taxInputs } from "../federal/compute.js";
import { federalTax } from "../../../core/math/tax.js";
import { daysBetween } from "../../../core/math/dates.js";

/** Employee payroll tax: Social Security 6.2% up to the year's pay limit (IRC 3101(a), 3121(a)(1)), Medicare 1.45% on all pay (3101(b)(1)). */
export const PAYROLL = { ss: 0.062, medicare: 0.0145 };
const FICA = PAYROLL.ss + PAYROLL.medicare;   // the FSA's own saving keeps the flat 7.65%

/**
 * payrollTaxSaved(without, withIt, wageBase) -> { socialSecurity, medicare, total }: what one person's payroll tax falls by
 * when their payroll-tax wages go from `without` to `withIt`: 6.2% x (min(base, without) - min(base, with)) + 1.45% x
 * (without - with), each figure from 0 up (3101(a), (b)(1); 3121(a)(1)). Above the base only the Medicare part is saved.
 */
export function payrollTaxSaved(without, withIt, wageBase = Infinity) {
  const w0 = Math.max(0, Number(without) || 0), w1 = Math.max(0, Number(withIt) || 0);
  const base = Number.isFinite(Number(wageBase)) ? Number(wageBase) : Infinity;
  const socialSecurity = PAYROLL.ss * (Math.min(base, w0) - Math.min(base, w1));
  const medicare = PAYROLL.medicare * (w0 - w1);
  return { socialSecurity, medicare, total: socialSecurity + medicare };
}

/**
 * withoutHsaPayroll(plan, { wagesAddBack }) -> a copy of the plan with none of the household's own HSA money taken from pay:
 * the HSA rows' amounts on the Contributions page and the HSA page's contribution set to 0, the employer's money kept, and
 * typed wages raised by `wagesAddBack` (they are box 1, which left the money out). The plan itself is not changed.
 */
export function withoutHsaPayroll(plan, { wagesAddBack = 0 } = {}) {
  const hsaAccounts = new Set((plan.accounts ?? []).filter((a) => a.type === "hsa").map((a) => a.id));
  const contributions = (plan.retirement?.contributions ?? []).map((c) => (hsaAccounts.has(c.accountId) ? { ...c, amount: 0 } : c));
  const taxes = { ...(plan.taxes ?? {}), hsa: { ...(plan.taxes?.hsa ?? {}), contribution: 0 } };
  // typed wages are W-2 box 1, from which the HSA money was left out: without it they are that much higher
  if (wagesAddBack && taxes.thisYear && taxes.thisYear.wages !== null && taxes.thisYear.wages !== undefined && taxes.thisYear.wages !== "") taxes.thisYear = { ...taxes.thisYear, wages: Number(taxes.thisYear.wages) + wagesAddBack };
  return { ...plan, retirement: { ...(plan.retirement ?? {}), contributions }, taxes };
}

const fmtInt = (n) => Math.round(n).toLocaleString("en-US");

/**
 * compute(plan, { today }) -> {
 *   year, limitsYear (the HSA figures' year), fsaYear (the FSA figures' year), wageBase (the Social Security pay limit),
 *   hsa: { coverage ("none"|"self"|"family"), coverageChosen, coveredId, base (the cover's amount), catchUpAmount, catchUpAge, limit, catchUp, contribution
 *     (the household's own money from pay), employer, total, room, over, excess (taxed as pay), deducted (kept out of income),
 *     taxSaved, ficaSaved, socialSecuritySaved, medicareSaved, savedTotal, marginal, years, growthRate, kept (the money within the limit), futureValue,
 *     futureContributions, balance, balanceGrown, atSixtyFive, aboveWageBase: [names],
 *     people: [{ id, name, role, age, eligible, catchUp, limit, payroll, employer, used, room, over, excess, pay, ficaWith,
 *       ficaWithout, socialSecuritySaved, medicareSaved, ficaSaved, aboveWageBase }] },
 *   fsa: { election, limit, spent, unspent, daysLeft, carryover, taxSaved, over },
 *   hasHsa, hasFsa, notes, selfName
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const b = taxInputs(plan, params);
  const year = b.year;
  // each kind from the newest year that has it: a 2027 date has 2027's HSA limits and 2026's FSA ones
  const LF = limitsFor(year), L = LF.kinds;
  const limitsYear = LF.kindYear.hsa, fsaYear = LF.kindYear.fsa;
  const h = plan.taxes?.hsa ?? {};
  // who is covered, each adult's money, limit and excess (Contributions page, hsaPicture: IRC 223(b), 106(d)(1))
  const pic = b.hsa.picture, hh = pic.household;
  const coverage = pic.coverage;
  const contribution = hh.payroll, employer = hh.employer, total = hh.used;
  const limit = hh.limit, catchUp = hh.catchUp, room = hh.room, over = hh.over, excess = hh.excess;
  // the tax saved: the federal return without the household's own HSA money against the plan's own. Without it the money is
  // back in pay, in income and in Medicare wages (so the 0.9% additional Medicare tax is in the saving), and the cover's
  // excess is worked again on the employer's money alone; only money within the limit was kept out of income (106(d)(1))
  // typed wages (W-2 box 1) already leave the money out: without it box 1 is higher by the own money kept out (payroll less
  // the excess) plus any employer excess that the own money's absence changes
  let b0 = taxInputs(withoutHsaPayroll(plan), params);
  if (b.wagesTyped) b0 = taxInputs(withoutHsaPayroll(plan, { wagesAddBack: Math.max(0, hh.payroll - hh.excess) + b0.hsa.picture.household.excess }), params);
  const withIt = federalTax(b.inputs, b.params).totalTax;
  const without = federalTax(b0.inputs, b0.params).totalTax;
  const taxSaved = Math.max(0, without - withIt);
  // payroll tax, per person: payroll-tax wages = pay - the health FSA (on the pay of the adult marked "Me") - own HSA money
  // from pay + own HSA money over the limit (3121(a)(5)(G); Pub. 15-B "Up to specified dollar limits"); 401(k) money stays in
  const wageBase = maximumEarnings(year);
  const payOf = new Map(b.k401.people.map((x) => [x.id, x.pay]));
  const knownPay = b.payTotal > 0;
  const me = pic.people.find((p) => p.role === "self") ?? pic.people[0] ?? null;
  const people = pic.people.map((p, i) => {
    const p0 = b0.hsa.picture.people[i];
    const pay = payOf.get(p.id) ?? 0, fsaOff = p === me ? b.fsa.excluded : 0;
    const ficaWith = pay - fsaOff - p.payroll + p.excess, ficaWithout = pay - fsaOff + (p0?.excess ?? 0);
    // no pay on the Income page: where the pay sits against the Social Security limit is not known, so the money within the
    // limit saves the full 7.65%
    const s = knownPay ? payrollTaxSaved(ficaWithout, ficaWith, wageBase) : { socialSecurity: PAYROLL.ss * Math.max(0, ficaWithout - ficaWith), medicare: PAYROLL.medicare * Math.max(0, ficaWithout - ficaWith) };
    const aboveWageBase = knownPay && ficaWithout > wageBase && ficaWithout - ficaWith > 0;
    return { id: p.id, name: p.name, role: p.role, age: p.age, eligible: p.eligible, catchUp: p.catchUp, limit: p.limit, payroll: p.payroll, employer: p.employer, used: p.used, room: p.room, over: p.over, excess: p.excess,
      pay, ficaWith, ficaWithout, socialSecuritySaved: s.socialSecurity, medicareSaved: s.medicare, ficaSaved: s.socialSecurity + s.medicare, aboveWageBase };
  });
  const socialSecuritySaved = people.reduce((s, p) => s + p.socialSecuritySaved, 0), medicareSaved = people.reduce((s, p) => s + p.medicareSaved, 0);
  const ficaSaved = socialSecuritySaved + medicareSaved;
  const deducted = b.hsa.deducted;
  const marginal = deducted > 0 ? taxSaved / deducted : 0;
  // growth to 65: the age of the adult the account is for (self-only: the covered adult; otherwise the one marked "Me")
  const owner = pic.people.find((p) => p.id !== null && p.id === pic.coveredId) ?? me;
  const a = plan.assumptions ?? {}, rt = plan.retirement ?? {};
  const stocks = Number(rt.stocksNow ?? 0.7);
  const growthRate = stocks * Number(a.returnStocks ?? 0.07) + (1 - stocks) * Number(a.returnBonds ?? 0.04);
  const years = owner && owner.age !== null && owner.age !== undefined ? Math.max(0, 65 - owner.age) : 20;
  // only money within the limit stays in the account (the excess has to come out), so only that grows
  const kept = Math.max(0, total - excess);
  const futureValue = kept > 0 && years > 0 ? (growthRate > 0 ? kept * (Math.pow(1 + growthRate, years) - 1) / growthRate : kept * years) : 0;
  const hsaBalance = (plan.accounts ?? []).filter((x) => x.type === "hsa").reduce((s, x) => s + (Number(x.balance) || 0), 0);
  const balanceGrown = hsaBalance * Math.pow(1 + growthRate, years);
  const hsa = {
    coverage, coverageChosen: pic.coverageChosen, coveredId: pic.coveredId, base: pic.base, catchUpAmount: pic.catchUpAmount, catchUpAge: pic.catchUpAge, limit, catchUp, contribution, employer, total, room, over, excess, deducted,
    taxSaved, ficaSaved, socialSecuritySaved, medicareSaved, savedTotal: taxSaved + ficaSaved, marginal, years, growthRate, kept, futureValue, futureContributions: kept * years,
    balance: hsaBalance, balanceGrown, atSixtyFive: futureValue + balanceGrown, aboveWageBase: people.filter((p) => p.aboveWageBase).map((p) => p.name), people,
  };
  const election = Math.max(0, Number(h.fsa) || 0), spent = Math.max(0, Number(h.fsaSpent) || 0);
  const fsaLimit = L.fsa?.limit ?? 3300;
  const daysLeft = today ? Math.max(0, daysBetween(today, `${year}-12-31`)) : null;
  // the Federal estimate already takes the FSA off wages: put it back for the return without it
  const noFsa = { ...b.inputs, wages: b.inputs.wages + (b.fsa?.offWages ?? 0), medicareWages: (b.inputs.medicareWages ?? b.inputs.wages) + (b.fsa?.offWages ?? 0) };
  const fsaWithout = federalTax(noFsa, b.params).totalTax, fsaWith = federalTax({ ...noFsa, wages: Math.max(0, noFsa.wages - election) }, b.params).totalTax;
  const fsa = { election, limit: fsaLimit, spent, unspent: Math.max(0, election - spent), daysLeft, carryover: L.fsa?.carryover ?? 660, taxSaved: election > 0 ? Math.max(0, fsaWithout - fsaWith) + election * FICA : 0, over: Math.max(0, election - fsaLimit) };
  const notes = [];
  if (coverage === "none" && total > 0) notes.push(`${fmtInt(total)} is going into an HSA, but you said you have no high-deductible health plan. Only someone covered by one can put money in an HSA, so all of it is taxed as pay and charged 6% a year until it is taken out. Take it out before the tax filing deadline, or change the cover below if you do have such a plan.`);
  else {
    const outside = people.filter((p) => !p.eligible && p.used > 0);
    const insideExcess = people.filter((p) => p.eligible).reduce((s, p) => s + p.excess, 0);
    for (const p of outside) notes.push(`${p.name} is not on the self-only health plan, so the ${fmtInt(p.used)} going into ${p.name}'s HSA is not allowed: it is taxed as pay and charged 6% a year until taken out. Only the person the plan covers can have an HSA.`);
    if (outside.length) { if (insideExcess > 0) notes.push(`The covered person's own HSA is over the ${limitsYear} limit by ${fmtInt(insideExcess)}: excess contributions are taxed 6% a year until withdrawn.`); }
    else if (over > 0) notes.push(`The HSA is over the ${limitsYear} limit by ${fmtInt(over)}: excess contributions are taxed 6% a year until withdrawn.`);
    // a spouse 55 or over who does not use their own catch-up cannot hand it to the other (223(b)(3); Pub. 969)
    if (!outside.length && insideExcess > over + 0.005) notes.push(`In all ${fmtInt(insideExcess)} is over the limit: the extra ${fmtInt(pic.catchUpAmount)} from age ${pic.catchUpAge} can go only into that person's own HSA, not the other's.`);
  }
  if (election > 0 && total > 0) notes.push("A general-purpose health FSA and an HSA cannot run in the same year; with an HSA the FSA has to be the limited-purpose kind (dental and vision only).");
  if (fsa.over > 0) notes.push(`The FSA election is over the ${fsaYear} limit of ${fsaLimit.toLocaleString("en-US")}.`);
  return { year, limitsYear, fsaYear, wageBase, hsa, fsa, hasHsa: total > 0 || hsaBalance > 0, hasFsa: election > 0, notes, selfName: owner && owner.id !== null ? owner.name : "you" };
}

// modules/taxes/federal/compute.js -- PURE. This year's federal income tax from what the plan
// already knows (pay, pensions, Social Security, pre-tax contributions, who is in the household)
// plus the figures only the owner knows (typed on the page: dividends, interest, withholding,
// itemized deductions). Every other tax page starts from taxInputs() so they all agree.
import { FEDERAL, TAX_YEARS } from "./data/federal.js";
import { federalTax, marginalRate, paramsFor, standardDeduction } from "../../../core/math/tax.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { perYear } from "../../../core/math/periods.js";

export { TAX_YEARS };
const fmtInt = (n) => Math.round(n).toLocaleString("en-US");

/**
 * The itemized deductions that count, after the state-and-local cap, the medical floor and (from 2026)
 * the charity floor of 0.5% of income. On a separate return the cap, its floor and the income where
 * it starts shrinking are halved, and it shrinks at the full 30% (IRC §164(b)(7)).
 */
export function itemizedTotal(itemized, agi, status, params) {
  const it = itemized ?? {};
  const n = (k) => Math.max(0, Number(it[k]) || 0);
  const salt = params.saltCap ?? { cap: 10000 };
  const share = status === "married_separate" ? 0.5 : 1;
  let cap = salt.cap * share;
  if (salt.phaseOutStart) cap = Math.max((salt.floor ?? 0) * share, cap - Math.max(0, agi - salt.phaseOutStart * share) * (salt.phaseOutRate ?? 0.3));
  const stateAndLocal = Math.min(n("propertyTax") + n("stateTax"), cap);
  const medical = Math.max(0, n("medical") - 0.075 * Math.max(0, agi));
  const charityFloor = (params.charity?.floorRate ?? 0) * Math.max(0, agi);
  const charitable = Math.max(0, n("charitable") - charityFloor);
  const lines = [
    { key: "mortgageInterest", label: "Mortgage interest", amount: n("mortgageInterest") },
    { key: "salt", label: "State and local taxes", amount: stateAndLocal, note: n("propertyTax") + n("stateTax") > cap ? `capped at ${fmtInt(cap)}` : null },
    { key: "charitable", label: "Charitable gifts", amount: charitable, note: charityFloor > 0 && n("charitable") > 0 ? `over ${fmtInt(charityFloor)} (0.5% of income)` : null },
    { key: "medical", label: "Medical over 7.5% of income", amount: medical, note: n("medical") > 0 && medical === 0 ? "under the floor" : null },
    { key: "other", label: "Other", amount: n("other") },
  ];
  return { total: lines.reduce((s, l) => s + l.amount, 0), lines: lines.filter((l) => l.amount > 0 || l.note), saltCap: cap };
}

/** Net the year's sales the way Schedule D does: short and long offset each other; a net loss takes up to 3,000 off ordinary income. */
export function netGains(gains, filingStatus) {
  const rows = (gains ?? []).map((g) => ({ ...g, gain: (Number(g.proceeds) || 0) - (Number(g.basis) || 0) }));
  const shortTotal = rows.filter((g) => g.held !== "long").reduce((s, g) => s + g.gain, 0);
  const longTotal = rows.filter((g) => g.held === "long").reduce((s, g) => s + g.gain, 0);
  let netShort = shortTotal, netLong = longTotal;
  if (netShort < 0 && netLong > 0) { const use = Math.min(-netShort, netLong); netShort += use; netLong -= use; }
  else if (netLong < 0 && netShort > 0) { const use = Math.min(-netLong, netShort); netLong += use; netShort -= use; }
  const netLoss = Math.min(0, netShort + netLong);
  const lossAllowed = Math.max(netLoss, filingStatus === "married_separate" ? -1500 : -3000);
  return { rows, shortTotal, longTotal, netShort: Math.max(0, netShort), netLong: Math.max(0, netLong), netLoss, lossAllowed, carryForward: netLoss - lossAllowed };
}

/**
 * taxInputs(plan, { today }) -> { year, params, filingStatus, inputs (for federalTax), sources: [{ key, label, amount, from: "plan" | "typed", detail }],
 *   notes: [text], itemized: { total, lines, saltCap }, people: { ages65plus, dependentsUnder17, otherDependents, adults }, pretax401k, standard, gains }
 * `inputs.itemized` is the total after caps, worked out against the AGI the plan implies.
 */
export function taxInputs(plan, params = {}) {
  const today = params.today ?? null;
  const t = plan.taxes ?? {}, ty = t.thisYear ?? {};
  const year = Number(t.year) || (today ? Number(String(today).slice(0, 4)) : new Date().getFullYear());
  const P = paramsFor(FEDERAL, year, { inflation: Number(plan.assumptions?.inflation ?? 0.03) });
  const filingStatus = P.status[plan.household?.filingStatus] ? plan.household.filingStatus : "single";
  const inc = computeIncome(plan, { today });
  const active = inc.active.filter((x) => x.taxable !== false);
  const sumType = (...types) => active.filter((x) => types.includes(x.type)).reduce((s, x) => s + x.yearly, 0);
  const accounts = plan.accounts ?? [];
  const typeOf = (id) => accounts.find((a) => a.id === id)?.type;
  const contribs = (plan.retirement?.contributions ?? []).map((c) => ({ ...c, yearly: perYear(c.amount, c.period), accountType: typeOf(c.accountId) }));
  const pretax401k = contribs.filter((c) => c.accountType === "401k").reduce((s, c) => s + c.yearly, 0);
  const iraDeductible = contribs.filter((c) => c.accountType === "ira").reduce((s, c) => s + c.yearly, 0);
  const hsaContrib = Math.max(0, Number(t.hsa?.contribution) || 0) || contribs.filter((c) => c.accountType === "hsa").reduce((s, c) => s + c.yearly, 0);
  const notes = [], sources = [];
  const typed = (k) => ty[k] !== null && ty[k] !== undefined && ty[k] !== "";
  const wagesAuto = Math.max(0, sumType("salary", "bonus") - pretax401k);
  const wages = typed("wages") ? Number(ty.wages) : wagesAuto;
  sources.push({ key: "wages", label: "Wages", amount: wages, from: typed("wages") ? "typed" : "plan", detail: typed("wages") ? "as typed" : pretax401k > 0 ? `pay and bonuses on the Income page, less ${fmtInt(pretax401k)} of pre-tax 401(k) contributions` : "pay and bonuses on the Income page" });
  const business = sumType("business"), rental = sumType("rental"), pension = sumType("pension"), investment = sumType("investment"), other = sumType("other");
  const gains = netGains(t.gains, filingStatus);
  const otherTyped = Number(ty.otherOrdinary) || 0;
  const otherOrdinary = Math.max(0, business + rental + pension + investment + other + otherTyped + gains.netShort);
  if (pension) sources.push({ key: "pension", label: "Pensions", amount: pension, from: "plan", detail: "Income page" });
  if (business) { sources.push({ key: "business", label: "Self-employment", amount: business, from: "plan", detail: "Income page; self-employment tax is not included" }); notes.push("Self-employment income is taxed here as ordinary income; the 15.3% self-employment tax on it is not included yet."); }
  if (rental) sources.push({ key: "rental", label: "Rent", amount: rental, from: "plan", detail: "Income page, before expenses" });
  if (investment) sources.push({ key: "investment", label: "Dividends and interest", amount: investment, from: "plan", detail: "Income page, counted as ordinary; type the qualified part below" });
  if (other) sources.push({ key: "other", label: "Other income", amount: other, from: "plan", detail: "Income page" });
  if (otherTyped) sources.push({ key: "otherTyped", label: "Other ordinary income", amount: otherTyped, from: "typed", detail: "interest, IRA withdrawals, conversions" });
  if (gains.netShort > 0) sources.push({ key: "shortGains", label: "Short-term gains", amount: gains.netShort, from: "plan", detail: "Capital gains page" });
  if (gains.netLoss < 0) sources.push({ key: "loss", label: "Capital loss allowed", amount: gains.lossAllowed, from: "plan", detail: gains.carryForward < 0 ? `${fmtInt(-gains.netLoss)} lost in all; ${fmtInt(-gains.carryForward)} carries forward` : "Capital gains page" });
  const qualifiedTyped = Number(ty.qualifiedIncome) || 0;
  const qualifiedIncome = Math.max(0, qualifiedTyped + gains.netLong);
  if (qualifiedTyped) sources.push({ key: "qualified", label: "Qualified dividends", amount: qualifiedTyped, from: "typed" });
  if (gains.netLong > 0) sources.push({ key: "longGains", label: "Long-term gains", amount: gains.netLong, from: "plan", detail: "Capital gains page" });
  const ssAuto = sumType("social");
  const socialSecurity = typed("socialSecurity") ? Number(ty.socialSecurity) : ssAuto;
  if (socialSecurity) sources.push({ key: "social", label: "Social Security", amount: socialSecurity, from: typed("socialSecurity") ? "typed" : "plan", detail: typed("socialSecurity") ? "as typed" : "Income page; only part of it is taxed" });
  const taxExemptInterest = Number(ty.taxExemptInterest) || 0;
  const adjustmentsTyped = Number(ty.adjustments) || 0;
  const adjustments = adjustmentsTyped + iraDeductible + hsaContrib;
  if (iraDeductible) sources.push({ key: "ira", label: "IRA contributions", amount: -iraDeductible, from: "plan", detail: "Contributions page; assumed deductible" });
  if (hsaContrib) sources.push({ key: "hsa", label: "HSA contributions", amount: -hsaContrib, from: "plan", detail: "HSA page or Contributions page" });
  if (adjustmentsTyped) sources.push({ key: "adjustments", label: "Other adjustments", amount: -adjustmentsTyped, from: "typed" });
  // the people: age allowances and dependents by age at the end of the tax year
  const people = plan.household?.people ?? [];
  const ageAtYearEnd = (p) => p.birthDate ? year - Number(String(p.birthDate).slice(0, 4)) : null;
  const adults = people.filter((p) => p.role !== "dependent");
  const ages65plus = adults.filter((p) => ageAtYearEnd(p) !== null && ageAtYearEnd(p) >= 65).length;
  const deps = people.filter((p) => p.role === "dependent");
  const under17Auto = deps.filter((p) => ageAtYearEnd(p) === null || ageAtYearEnd(p) < 17).length;
  const given = (v) => v !== null && v !== undefined && v !== "";
  const dependentsUnder17 = given(t.dependentsUnder17) ? Number(t.dependentsUnder17) : under17Auto;
  const otherDependents = given(t.otherDependents) ? Number(t.otherDependents) : deps.length - under17Auto;
  const paid = (Number(ty.paid) || 0) + (t.estimated?.paid ?? []).reduce((s, x) => s + (Number(x) || 0), 0);
  // net investment income for the 3.8% tax (Form 8960): dividends and interest, the typed qualified dividends and the year's net gain or allowed loss; rent is left out (only its gross is known)
  const investmentIncome = Math.max(0, investment + qualifiedTyped + gains.netShort + gains.netLong + gains.lossAllowed);
  // Medicare wages for the 0.9% additional Medicare tax: pay before pre-tax 401(k) saving (typed wages are taken as they are)
  const medicareWages = typed("wages") ? wages : sumType("salary", "bonus");
  const base = { filingStatus, wages, medicareWages, otherOrdinary, qualifiedIncome, capitalLoss: gains.lossAllowed, socialSecurity, taxExemptInterest, adjustments, ages65plus, blind: Number(t.blind) || 0, dependentsUnder17, otherDependents, withheld: Number(ty.withheld) || 0, paid, selfEmployment: business, investmentIncome, charitableCash: Math.max(0, Number(t.itemized?.charitable) || 0) };
  const agi = federalTax({ ...base, itemized: 0 }, P).agi;
  const itemized = itemizedTotal(t.itemized, agi, filingStatus, P);
  const inputs = { ...base, itemized: itemized.total };
  if (!active.length && !typed("wages")) notes.push("Nothing on the Income page yet: the estimate is built from what you type below.");
  if (adults.length >= 2 && filingStatus === "single") notes.push("Two adults but the filing status is Single (People page). Married couples usually file together.");
  return { year, params: P, filingStatus, inputs, sources, notes, itemized, people: { ages65plus, dependentsUnder17, otherDependents, adults: adults.length }, pretax401k, standard: standardDeduction(filingStatus, P, { ages65plus, blind: inputs.blind }), gains };
}

/**
 * compute(plan, { today }) -> {
 *   ...taxInputs, years (with tables), result (federalTax), marginal, steps: [{ label, amount, sub }] the walk from income to tax,
 *   isIndexed (a year past the last table, figures inflated), hasIncome
 * }
 */
export function compute(plan, params = {}) {
  const b = taxInputs(plan, params);
  const result = federalTax(b.inputs, b.params);
  const marginal = marginalRate(b.inputs, b.params);
  const r = result;
  const steps = [{ label: "Income", amount: r.income.gross, sub: [r.income.wages > 0 ? `wages ${fmtInt(r.income.wages)}` : null, r.income.ordinary - r.income.wages > 0 ? `other ordinary ${fmtInt(r.income.ordinary - r.income.wages)}` : null, r.income.qualified > 0 ? `dividends and gains ${fmtInt(r.income.qualified)}` : null, r.income.socialSecurity > 0 ? `Social Security ${fmtInt(r.income.socialSecurity)}` : null].filter(Boolean).join(", ") }];
  if (r.income.socialSecurity > 0) steps.push({ label: "Social Security that is taxed", amount: r.income.taxableSocialSecurity, sub: `${Math.round(r.income.taxableSocialSecurity / r.income.socialSecurity * 100)}% of the benefits, by the IRS worksheet; the rest is not income` });
  if (r.income.capitalLoss < 0) steps.push({ label: "Capital loss", amount: r.income.capitalLoss, sub: `a net loss on sales comes off any income, up to ${fmtInt(b.filingStatus === "married_separate" ? 1500 : 3000)} a year${b.gains.carryForward < 0 ? `; ${fmtInt(-b.gains.carryForward)} carries to next year` : ""}` });
  if (r.adjustments > 0) steps.push({ label: "Adjustments", amount: -r.adjustments, sub: "IRA, HSA and other above-the-line deductions" });
  steps.push({ label: "Adjusted gross income", amount: r.agi, sub: "" });
  const dsub = r.deduction.used === "itemized"
    ? `more than the ${fmtInt(r.deduction.standard)} standard deduction${r.deduction.itemizedLimit > 0 ? `; ${fmtInt(r.deduction.itemizedLimit)} less for income in the top bracket` : ""}`
    : [r.deduction.charity > 0 ? `includes ${fmtInt(r.deduction.charity)} of gifts to charity, allowed without itemizing from 2026` : null, b.itemized.total > 0 ? `your itemized ${fmtInt(b.itemized.total)} is less` : null, !b.itemized.total && b.people.ages65plus ? "includes the extra allowance for age" : null].filter(Boolean).join("; ");
  steps.push({ label: r.deduction.used === "itemized" ? "Itemized deductions" : "Standard deduction", amount: -(r.deduction.amount - r.deduction.senior), sub: dsub });
  if (r.deduction.senior > 0) steps.push({ label: "Senior deduction", amount: -r.deduction.senior, sub: "6,000 a person 65 or over, tax years 2025 to 2028, less as income rises" });
  steps.push({ label: "Taxable income", amount: r.taxableIncome, sub: r.qualifiedTaxable > 0 ? `${fmtInt(r.ordinaryTaxable)} ordinary, ${fmtInt(r.qualifiedTaxable)} at the gains rates` : "" });
  steps.push({ label: "Income tax", amount: r.incomeTax, sub: r.qualifiedTax > 0 ? `${fmtInt(r.ordinaryTax)} through the brackets, ${fmtInt(r.qualifiedTax)} on dividends and gains` : "through the brackets" });
  if (r.credits.childTaxCredit > 0 || r.credits.refundable > 0) steps.push({ label: "Child tax credit", amount: -(r.credits.childTaxCredit + r.credits.refundable), sub: r.credits.refundable > 0 ? `${fmtInt(r.credits.refundable)} of it comes back as a refund` : `${b.people.dependentsUnder17} under 17` });
  if (r.niit > 0) steps.push({ label: "Net investment income tax", amount: r.niit, sub: "3.8% on investment income over the threshold" });
  if (r.additionalMedicare > 0) steps.push({ label: "Additional Medicare tax", amount: r.additionalMedicare, sub: "0.9% on wages over the threshold" });
  steps.push({ label: "Federal tax", amount: r.totalTax, sub: `${(r.effectiveRate * 100).toFixed(1)}% of income; the next dollar costs ${(marginal * 100).toFixed(0)}¢` });
  if (r.withheld > 0 || r.paid > 0) steps.push({ label: "Already paid", amount: -(r.withheld + r.paid), sub: [r.withheld > 0 ? `${fmtInt(r.withheld)} withheld` : null, r.paid > 0 ? `${fmtInt(r.paid)} estimated payments` : null].filter(Boolean).join(", ") });
  return { ...b, years: TAX_YEARS, result, marginal, steps, isIndexed: !!b.params.indexed, hasIncome: r.income.gross > 0 };
}

// modules/cashflow/paycheck/compute.js -- PURE. Each earner's paycheck from gross to take-home: what comes out before
// tax (the 401(k), health premiums, the HSA, the flexible spending accounts, commuting), the federal income tax withheld
// (the figure from the pay stub, or the IRS percentage method for a 2020-or-later W-4: Publication 15-T, Worksheet 1A),
// Social Security and Medicare (and where they stop or rise in the year), the state's tax, what comes out after tax, and
// what the employer adds on top.
import { compute as computeIncome } from "../income/compute.js";
import { compute as computeState, LOCAL_TAX } from "../../taxes/state/compute.js";
import { taxInputs } from "../../taxes/federal/compute.js";
import { maximumEarnings } from "../../retirement/social-security/compute.js";
import { PAYCHECKS, K401_TAXED_STATES, HSA_TAXED_STATES } from "../../career/benefits/compute.js";
import { perYear } from "../../../core/math/periods.js";
import { PCT_METHOD, forYear } from "./data/withholding.js";

/** The employee's payroll taxes (IRC 3101): Social Security to the wage base, Medicare, and the 0.9% an employer withholds on pay over $200,000 in the year (IRC 3102(f)). */
export const PAYROLL = { ss: 0.062, medicare: 0.0145, extraMedicare: 0.009, extraOver: 200000 };
export const W4_STATUSES = { single: "Single or married filing separately", married_joint: "Married filing jointly", head_of_household: "Head of household" };
export const DEFAULT_PAYCHECKS = 26;

const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const pos = (v) => Math.max(0, num(v) ?? 0);

/** The W-4 filing status the household's filing status suggests (a W-4 has three). */
export const w4StatusFor = (filingStatus) => (filingStatus === "married_joint" || filingStatus === "qualifying_surviving" ? "married_joint" : filingStatus === "head_of_household" ? "head_of_household" : "single");

/**
 * Federal income tax withheld from one paycheck, IRS Publication 15-T Worksheet 1A (percentage method for automated
 * payroll, W-4 from 2020 or later): annual wages = the paycheck's taxable wages x paychecks + Step 4(a); less Step 4(b)
 * and, when Step 2 is not ticked, the amount in step 1(g); the year's tentative withholding from the annual table for
 * the W-4 status (Step 2 ticked: the other table); a paycheck's share; less Step 3's credits a paycheck (not below 0);
 * plus Step 4(c).
 */
export function withholdFederal(wages, paychecks, w4 = {}, year) {
  const T = forYear(PCT_METHOD, year);
  const status = W4_STATUSES[w4.status] ? w4.status : "single";
  const n = Math.max(1, paychecks);
  const annual = Math.max(0, wages) * n + pos(w4.otherIncome);
  const adjusted = Math.max(0, annual - pos(w4.deductions) - (w4.step2 ? 0 : T.step1g[status === "married_joint" ? "married_joint" : "other"]));
  const rows = (w4.step2 ? T.checkbox : T.standard)[status];
  const row = rows.reduce((found, r) => (adjusted >= r.from ? r : found), rows[0]);
  const tentative = row.base + row.rate * (adjusted - row.from);
  const perCheck = Math.max(0, tentative / n - pos(w4.credits) / n) + pos(w4.extra);
  return { adjusted, tentative, perCheck, rate: row.rate, tableYear: T.year };
}

/**
 * compute(plan, { today }) -> {
 *   ready, why ("no-pay"|"no-person"), year, people: [{
 *     id, name, key ("self"|"partner"), jobName, period, paychecks, paychecksFrom ("period"|"typed"|"assumed"), gross (a paycheck),
 *     pretax: [{ key, label, amount, from }], pretaxTotal, wages: { federal, fica, state },
 *     federal: { amount, from ("typed"|"withholding"|"estimate"), w4, tableYear, rate }, ss, medicare, state: { amount, from ("typed"|"rate"|"no-tax" (a state without income tax)|"none" (rate unknown)), rate },
 *     aftertax: [{ key, label, amount, from }], aftertaxTotal, taxesTotal, net, monthly (take-home a month over the year), yearly: { gross, net, federal, ss, medicare, state },
 *     ssStopsAfter (paycheck number) | null, extraMedicareFrom (paycheck number) | null, employer: { match, hsa, payroll } (a paycheck), shares: { taxes, saved, benefits, net } (of each $100)
 *   }], notes
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? `${new Date().getFullYear()}-01-01`;
  const ti = taxInputs(plan, { today });
  const year = ti.year;
  const people = plan.household?.people ?? [];
  const adults = people.filter((p) => p.role !== "dependent");
  const inc = computeIncome(plan, { today });
  const salaryOf = (id) => inc.active.filter((x) => x.personId === id && x.type === "salary" && x.period !== "once" && x.yearly > 0);
  const earners = adults.filter((p) => salaryOf(p.id).length);
  if (!earners.length) {
    const unlinked = inc.active.some((x) => x.type === "salary" && !x.personId && x.yearly > 0);
    return { ready: false, why: unlinked ? "no-person" : "no-pay", year, people: [], notes: [] };
  }
  const all = plan.whatIfs?.paycheck ?? {};
  const benefits = plan.whatIfs?.benefits ?? {};
  const accounts = plan.accounts ?? [];
  const typeOf = (id) => accounts.find((a) => a.id === id)?.type ?? null;
  const contribs = (plan.retirement?.contributions ?? []).map((c) => ({ ...c, yearly: perYear(pos(c.amount), c.period ?? "monthly"), type: typeOf(c.accountId) }));
  const st = computeState(plan, { today });
  const code = String(plan.household?.state ?? "").toUpperCase();
  const wageBase = maximumEarnings(year);
  const w4Default = w4StatusFor(ti.filingStatus);
  const withholding = plan.taxes?.withholding ?? {};
  const notes = [];
  if (LOCAL_TAX.includes(code)) notes.push("Cities or counties in your state may take their own income tax from pay too; it is not counted here.");
  const bonus = inc.active.filter((x) => x.type === "bonus" && x.period !== "once" && x.yearly > 0);
  if (bonus.length) notes.push("Bonuses are paid on their own: employers usually withhold a flat 22% of federal tax from them (37% above $1 million in a year), on top of Social Security and Medicare.");

  const out = earners.map((p) => {
    const s = all[p.id] ?? {};
    const b = benefits[p.id] ?? {};
    const jobs = salaryOf(p.id);
    const main = [...jobs].sort((x, y) => y.yearly - x.yearly)[0];
    const grossYear = jobs.reduce((t, x) => t + x.yearly, 0);
    const fromPeriod = PAYCHECKS[main.period] ?? null;
    const paychecks = num(s.paychecks) ?? fromPeriod ?? DEFAULT_PAYCHECKS;
    const paychecksFrom = num(s.paychecks) !== null ? "typed" : fromPeriod ? "period" : "assumed";
    const per = (yearly) => yearly / paychecks;
    const gross = per(grossYear);

    // before tax: the 401(k) from the plan's contributions; the cafeteria-plan items typed here, else the Benefits page's elections
    const mine = contribs.filter((c) => c.personId === p.id);
    const k401 = mine.filter((c) => c.type === "401k").reduce((t, c) => t + c.yearly, 0);
    const hsaContrib = mine.filter((c) => c.type === "hsa").reduce((t, c) => t + c.yearly, 0);
    const pick = (typedPerCheck, fallbackYearly) => (num(typedPerCheck) !== null ? { amount: pos(typedPerCheck), from: "typed" } : fallbackYearly > 0 ? { amount: per(fallbackYearly), from: "plan" } : { amount: 0, from: null });
    const hsa = pick(s.hsa, hsaContrib || pos(b.hsaElect));
    const fsa = pick(s.fsa, pos(b.fsaElect));
    const dcfsa = pick(s.dcfsa, pos(b.dcfsaElect));
    const commuter = pick(s.commuter, (pos(b.transitMonthly) + pos(b.parkingMonthly)) * 12);
    const health = pick(s.health, 0);
    const pretax = [
      { key: "k401", label: "401(k), before tax", amount: per(k401), from: k401 > 0 ? "plan" : null },
      { key: "health", label: "Health, dental and vision cover", ...health },
      { key: "hsa", label: "Health savings account (HSA)", ...hsa },
      { key: "fsa", label: "Health spending account (FSA)", ...fsa },
      { key: "dcfsa", label: "Child care spending account", ...dcfsa },
      { key: "commuter", label: "Transit and parking", ...commuter },
    ].filter((x) => x.amount > 0.005);
    const amt = (key) => pretax.find((x) => x.key === key)?.amount ?? 0;
    const pretaxTotal = pretax.reduce((t, x) => t + x.amount, 0);
    // a 401(k) still pays Social Security and Medicare; cafeteria-plan items and commuting pay neither (IRC 125, 132(f), 3121(a)(5)(D), 3121(v)(1)(A))
    const cafeteria = pretaxTotal - amt("k401");
    const wages = {
      federal: Math.max(0, gross - pretaxTotal),
      fica: Math.max(0, gross - cafeteria),
      state: Math.max(0, gross - pretaxTotal + (K401_TAXED_STATES.includes(code) ? amt("k401") : 0) + (HSA_TAXED_STATES.includes(code) ? amt("hsa") : 0)),
    };

    // federal income tax: the pay stub's figure, else the Withholding page's, else the IRS method on the W-4 typed here
    const key = p.role === "self" ? "self" : "partner";
    const w4 = { status: W4_STATUSES[s.w4Status] ? s.w4Status : w4Default, step2: !!s.step2, credits: pos(s.credits), otherIncome: pos(s.otherIncome), deductions: pos(s.deductions), extra: pos(s.extra) };
    const est = withholdFederal(wages.federal, paychecks, w4, year);
    const fromPage = num(withholding[key]?.perPaycheck);
    const federal = num(s.federal) !== null ? { amount: pos(s.federal), from: "typed" }
      : fromPage !== null && fromPage > 0 && (withholding[key]?.period ?? main.period) === main.period ? { amount: fromPage, from: "withholding" }
      : { amount: est.perCheck, from: "estimate" };
    Object.assign(federal, { w4, estimate: est.perCheck, tableYear: est.tableYear, rate: est.rate });

    // Social Security to the wage base (this employer's pay; a second job's excess comes back on the return), Medicare, the 0.9% over $200,000
    const ficaYear = wages.fica * paychecks;
    const ss = PAYROLL.ss * wages.fica, medicare = PAYROLL.medicare * wages.fica;
    const ssStopsAfter = ficaYear > wageBase && wages.fica > 0 ? Math.ceil(wageBase / wages.fica) : null;
    const extraMedicareFrom = ficaYear > PAYROLL.extraOver && wages.fica > 0 ? Math.floor(PAYROLL.extraOver / wages.fica) + 1 : null;
    const stateTax = num(s.state) !== null ? { amount: pos(s.state), from: "typed", rate: null }
      : st.method === "none" ? { amount: 0, from: "no-tax", rate: 0 }
      : st.rate !== null ? { amount: st.rate * wages.state, from: "rate", rate: st.rate } : { amount: 0, from: "none", rate: null };

    // after tax: a Roth 401(k) and other deductions typed here; the stock purchase plan from the Benefits page
    const aftertax = [
      { key: "roth", label: "Roth 401(k), after tax", ...pick(s.roth, 0) },
      { key: "espp", label: "Stock purchase plan", ...pick(s.espp, b.esppOffered ? pos(b.esppPct) * grossYear : 0) },
      { key: "other", label: "Other deductions after tax", ...pick(s.afterTax, 0) },
    ].filter((x) => x.amount > 0.005);
    const aftertaxTotal = aftertax.reduce((t, x) => t + x.amount, 0);
    const taxesTotal = federal.amount + ss + medicare + stateTax.amount;
    const net = gross - pretaxTotal - taxesTotal - aftertaxTotal;
    // over the year: Social Security stops at the wage base, the 0.9% starts above $200,000
    const ssYear = PAYROLL.ss * Math.min(ficaYear, wageBase);
    const medicareYear = PAYROLL.medicare * ficaYear + PAYROLL.extraMedicare * Math.max(0, ficaYear - PAYROLL.extraOver);
    const netYear = net * paychecks + (ss * paychecks - ssYear) - (medicareYear - medicare * paychecks);
    const yearly = { gross: grossYear, net: netYear, federal: federal.amount * paychecks, ss: ssYear, medicare: medicareYear, state: stateTax.amount * paychecks };

    // the employer's part, on top of the paycheck
    const match = mine.reduce((t, c) => t + pos(c.employerMatch), 0);
    const employer = { match: per(match), hsa: per(pos(b.hsaEmployer) || (p.role === "self" ? pos(plan.taxes?.hsa?.employer) : 0)), payroll: ss + medicare };   // the employer matches Social Security and Medicare (not the 0.9%)
    const saved = amt("k401") + amt("hsa") + (aftertax.find((x) => x.key === "roth")?.amount ?? 0);
    const share = (x) => (gross > 0 ? (100 * x) / gross : 0);
    return {
      id: p.id, name: p.name ?? "You", key, jobName: main.name || "Pay", period: main.period, paychecks, paychecksFrom, gross,
      pretax, pretaxTotal, wages, federal, ss, medicare, state: stateTax, aftertax, aftertaxTotal, taxesTotal, net,
      monthly: netYear / 12, yearly, ssStopsAfter, extraMedicareFrom, employer,
      shares: { taxes: share(taxesTotal), saved: share(saved), benefits: share(pretaxTotal + aftertaxTotal - saved), net: share(net) },
      jobs: jobs.length,
    };
  });
  if (out.filter((x) => x.federal.from === "estimate" && x.federal.w4.status === "married_joint" && !x.federal.w4.step2).length > 1) notes.push("You both have \"Married filing jointly\" on the W-4 without the box in Step 2 ticked: each paycheck is withheld as if it were the household's only pay, which usually leaves too little withheld. The Withholding page checks the year.");
  if (st.rate === null) notes.push("Your state's income tax is not counted: set its rate on the State tax page, or type the figure from your pay stub.");
  return { ready: true, year, people: out, notes, stateMethod: st.method ?? null };
}

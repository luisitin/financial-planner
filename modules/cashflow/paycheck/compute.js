// modules/cashflow/paycheck/compute.js -- PURE. Each earner's paycheck from gross to take-home: what comes out before
// tax (the 401(k), health premiums, the HSA, the flexible spending accounts, commuting), the federal income tax withheld
// (the figure from the pay stub, or the IRS percentage method for a 2020-or-later W-4: Publication 15-T, Worksheet 1A),
// Social Security and Medicare (and where they stop or rise in the year), the state's tax, what comes out after tax, and
// what the employer adds on top.
import { compute as computeIncome } from "../income/compute.js";
import { compute as computeState, LOCAL_TAX } from "../../taxes/state/compute.js";
import { taxInputs } from "../../taxes/federal/compute.js";
import { maximumEarnings } from "../../retirement/social-security/compute.js";
import { compute as computeBenefits, PAYCHECKS, K401_TAXED_STATES, HSA_TAXED_STATES } from "../../career/benefits/compute.js";
import { perYear, PERIODS } from "../../../core/math/periods.js";
import { PCT_METHOD, forYear } from "./data/withholding.js";

/** The employee's payroll taxes (IRC 3101): Social Security to the wage base, Medicare, and the 0.9% an employer withholds on pay over $200,000 in the year (IRC 3102(f)). */
export const PAYROLL = { ss: 0.062, medicare: 0.0145, extraMedicare: 0.009, extraOver: 200000 };
export const W4_STATUSES = { single: "Single or married filing separately", married_joint: "Married filing jointly", head_of_household: "Head of household" };
export const DEFAULT_PAYCHECKS = 26;
/** The pay period named by a number of paychecks a year (what the Withholding check page stores). */
export const PERIOD_OF = { 52: "weekly", 26: "biweekly", 24: "semimonthly", 12: "monthly" };

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
    // pay on Income that belongs to no adult (household pay, or a person removed or a child)
    const unlinked = inc.active.some((x) => x.type === "salary" && x.yearly > 0 && !adults.some((a) => a.id === x.personId));
    return { ready: false, why: unlinked ? "no-person" : "no-pay", year, people: [], notes: [] };
  }
  const all = plan.whatIfs?.paycheck ?? {};
  const accounts = plan.accounts ?? [];
  const typeOf = (id) => accounts.find((a) => a.id === id)?.type ?? null;
  const contribs = (plan.retirement?.contributions ?? []).map((c) => ({ ...c, yearly: perYear(pos(c.amount), c.period ?? "monthly"), type: typeOf(c.accountId) }));
  const hs = plan.taxes?.hsa ?? {};
  const st = computeState(plan, { today });
  // the state's tax as a share of income (after its allowances and deductions), not its top rate
  const stateRate = st.method === "none" ? 0 : st.rate === null || st.rate === undefined ? null : st.agi > 0 ? Math.max(0, st.tax) / st.agi : st.rate;
  const code = String(plan.household?.state ?? "").toUpperCase();
  const wageBase = maximumEarnings(year);
  const w4Default = w4StatusFor(ti.filingStatus);
  const withholding = plan.taxes?.withholding ?? {};
  const notes = [];
  if (LOCAL_TAX.includes(code)) notes.push("Cities or counties in your state may take their own income tax from pay too; it is not counted here.");
  const bonus = inc.active.filter((x) => x.type === "bonus" && x.period !== "once" && x.yearly > 0);
  if (bonus.length) notes.push("Bonuses are paid on their own: employers usually withhold a flat 22% of federal tax from them (37% above $1 million in a year), on top of Social Security and Medicare.");
  let benefitsLater = false;

  const out = earners.map((p) => {
    const s = all[p.id] ?? {};
    const jobs = salaryOf(p.id);
    const main = [...jobs].sort((x, y) => y.yearly - x.yearly)[0];
    const grossYear = jobs.reduce((t, x) => t + x.yearly, 0);
    const fromPeriod = PAYCHECKS[main.period] ?? null;
    const paychecks = num(s.paychecks) ?? fromPeriod ?? DEFAULT_PAYCHECKS;
    const paychecksFrom = num(s.paychecks) !== null ? "typed" : fromPeriod ? "period" : "assumed";
    const per = (yearly) => yearly / paychecks;
    const gross = per(grossYear);

    // the Benefits elections page's choices for this person, capped by its limits, when they are for this year
    // (from October that page plans next year's)
    const ben = computeBenefits({ ...plan, whatIfs: { ...(plan.whatIfs ?? {}), benefits: { ...(plan.whatIfs?.benefits ?? {}), personId: p.id } } }, { today });
    const benOk = ben.ready && ben.person?.id === p.id && ben.planYear === year;
    const typedBen = plan.whatIfs?.benefits?.[p.id];
    if (!benOk && ben.ready && ben.person?.id === p.id && typedBen && Object.keys(typedBen).length) benefitsLater = true;
    const B = benOk ? { hsa: ben.hsa?.elect ?? 0, hsaEmployer: ben.hsa?.employer ?? 0, fsa: ben.fsa?.elect ?? 0, dcfsa: ben.dependentCare?.elect ?? 0, commuter: ((ben.commuter?.transit ?? 0) + (ben.commuter?.parking ?? 0)) * 12, espp: ben.espp?.yearly ?? 0 } : { hsa: 0, hsaEmployer: 0, fsa: 0, dcfsa: 0, commuter: 0, espp: 0 };

    // before tax: the 401(k) from the plan's contributions; the rest typed here, else the HSA and FSA page's figures (the
    // household's, for the first adult), the plan's HSA saving, the Benefits elections
    const mine = contribs.filter((c) => c.personId === p.id);
    const k401 = mine.filter((c) => c.type === "401k").reduce((t, c) => t + c.yearly, 0);
    const hsaContrib = mine.filter((c) => c.type === "hsa").reduce((t, c) => t + c.yearly, 0);
    const isSelf = p.role === "self" || (!adults.some((a) => a.role === "self") && p.id === adults[0]?.id);
    const pick = (typedPerCheck, ...fallbacks) => { if (num(typedPerCheck) !== null) return { amount: pos(typedPerCheck), from: "typed" }; const y = fallbacks.find((f) => f > 0); return y ? { amount: per(y), from: "plan" } : { amount: 0, from: null }; };
    const hsa = pick(s.hsa, isSelf ? pos(hs.contribution) : 0, hsaContrib, B.hsa);
    const fsa = pick(s.fsa, isSelf ? pos(hs.fsa) : 0, B.fsa);
    const dcfsa = pick(s.dcfsa, B.dcfsa);
    const commuter = pick(s.commuter, B.commuter);
    const health = pick(s.health);
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
    // a 401(k) still pays Social Security and Medicare; cafeteria-plan items and commuting pay neither (IRC 125, 132(f), 3121(a)(5)(G), 3121(v)(1)(A))
    const cafeteria = pretaxTotal - amt("k401");
    const wages = {
      federal: Math.max(0, gross - pretaxTotal),
      fica: Math.max(0, gross - cafeteria),
      state: Math.max(0, gross - pretaxTotal + (K401_TAXED_STATES.includes(code) ? amt("k401") : 0) + (HSA_TAXED_STATES.includes(code) ? amt("hsa") : 0)),
    };

    // federal income tax: the pay stub's figure; else the W-4 typed here; else the Withholding check page's figure when it
    // is for the same number of paychecks; else the W-4 the household's filing status suggests
    const key = p.role === "self" ? "self" : "partner";
    const w4Typed = !!W4_STATUSES[s.w4Status] || !!s.step2 || ["credits", "otherIncome", "deductions", "extra"].some((k) => pos(s[k]) > 0);
    const w4 = { status: W4_STATUSES[s.w4Status] ? s.w4Status : w4Default, step2: !!s.step2, credits: pos(s.credits), otherIncome: pos(s.otherIncome), deductions: pos(s.deductions), extra: pos(s.extra), typed: w4Typed };
    const est = withholdFederal(wages.federal, paychecks, w4, year);
    const onPage = withholding[key];
    const fromPage = num(onPage?.perPaycheck);
    const pageMatches = fromPage !== null && fromPage > 0 && (PERIODS[onPage?.period ?? main.period]?.perYear ?? 0) === paychecks;
    const federal = num(s.federal) !== null ? { amount: pos(s.federal), from: "typed" }
      : !w4Typed && pageMatches ? { amount: fromPage, from: "withholding" }
      : { amount: est.perCheck, from: "estimate" };
    Object.assign(federal, { w4, estimate: est.perCheck, tableYear: est.tableYear, rate: est.rate, onPage: fromPage, onPageMatches: pageMatches, period: PERIOD_OF[paychecks] ?? null });

    // Social Security to the wage base and the 0.9% over $200,000, each counted by each employer on its own pay (a second
    // job's extra Social Security comes back on the tax return)
    const ficaShare = gross > 0 ? wages.fica / gross : 0;
    const jobFica = jobs.map((j) => j.yearly * ficaShare);
    const ficaYear = wages.fica * paychecks;
    const ss = PAYROLL.ss * wages.fica, medicare = PAYROLL.medicare * wages.fica;
    const one = jobs.length === 1;
    const ssStopsAfter = one && ficaYear > wageBase && wages.fica > 0 ? Math.ceil(wageBase / wages.fica) : null;
    const extraMedicareFrom = one && ficaYear > PAYROLL.extraOver && wages.fica > 0 ? Math.floor(PAYROLL.extraOver / wages.fica) + 1 : null;
    const stateTax = num(s.state) !== null ? { amount: pos(s.state), from: "typed", rate: null }
      : st.method === "none" ? { amount: 0, from: "no-tax", rate: 0 }
      : stateRate !== null ? { amount: stateRate * wages.state, from: "rate", rate: stateRate } : { amount: 0, from: "none", rate: null };

    // after tax: a Roth 401(k) and other deductions typed here; the stock purchase plan from the Benefits elections page
    const aftertax = [
      { key: "roth", label: "Roth 401(k), after tax", ...pick(s.roth) },
      { key: "espp", label: "Stock purchase plan", ...pick(null, B.espp) },
      { key: "other", label: "Other deductions after tax", ...pick(s.afterTax) },
    ].filter((x) => x.amount > 0.005);
    const after = (key) => aftertax.find((x) => x.key === key)?.amount ?? 0;
    const aftertaxTotal = aftertax.reduce((t, x) => t + x.amount, 0);
    const taxesTotal = federal.amount + ss + medicare + stateTax.amount;
    const net = gross - pretaxTotal - taxesTotal - aftertaxTotal;
    // over the year: Social Security stops at each employer's wage base, the 0.9% starts above $200,000 from each
    const ssYear = jobFica.reduce((t, f) => t + PAYROLL.ss * Math.min(f, wageBase), 0);
    const medicareYear = jobFica.reduce((t, f) => t + PAYROLL.medicare * f + PAYROLL.extraMedicare * Math.max(0, f - PAYROLL.extraOver), 0);
    const netYear = net * paychecks + (ss * paychecks - ssYear) - (medicareYear - medicare * paychecks);
    const yearly = { gross: grossYear, net: netYear, federal: federal.amount * paychecks, ss: ssYear, medicare: medicareYear, state: stateTax.amount * paychecks };

    // the employer's part, on top of the paycheck: the match, its HSA money, its own Social Security and Medicare (not the 0.9%)
    const match = mine.reduce((t, c) => t + pos(c.employerMatch), 0);
    const employer = { match: per(match), hsa: per(B.hsaEmployer || (isSelf ? pos(hs.employer) : 0)), payroll: ss + medicare };
    // where each $100 goes: the parts rounded so they add up to 100 (largest remainder)
    const saved = amt("k401") + amt("hsa") + after("roth") + after("espp");
    const parts = { taxes: taxesTotal, saved, benefits: pretaxTotal + aftertaxTotal - saved, net };
    return {
      id: p.id, name: p.name ?? "You", key, jobName: main.name || "Pay", period: main.period, paychecks, paychecksFrom, gross,
      pretax, pretaxTotal, wages, federal, ss, medicare, state: stateTax, aftertax, aftertaxTotal, taxesTotal, net,
      monthly: netYear / 12, yearly, ssStopsAfter, extraMedicareFrom, employer,
      shares: gross > 0 ? hundred(parts, gross) : { taxes: 0, saved: 0, benefits: 0, net: 0 },
      jobs: jobs.length,
    };
  });
  for (const x of out.filter((y) => y.paychecksFrom === "assumed")) notes.push(`${x.name}'s pay is entered as a ${x.period === "annual" ? "yearly" : x.period === "quarterly" ? "quarterly" : "single"} figure on Income, so ${DEFAULT_PAYCHECKS} paychecks a year are assumed: set how often ${x.name} is paid under "${x.name}: W-4 and deductions".`);
  const both = out.filter((x) => x.federal.from === "estimate" && x.federal.w4.status === "married_joint" && !x.federal.w4.step2);
  if (both.length > 1) notes.push(both.every((x) => x.federal.w4.typed)
    ? "You both have \"Married filing jointly\" on the W-4 without the box in Step 2 ticked: each paycheck is withheld as if it were the household's only pay, which usually leaves too little withheld. The Withholding check page checks the year."
    : "These paychecks assume both W-4s say \"Married filing jointly\" with the box in Step 2 empty. If so, each is withheld as if it were the household's only pay, which usually leaves too little withheld: the Withholding check page checks the year. Set each W-4 in its fold below.");
  if (benefitsLater) notes.push(`The Benefits elections page is choosing next year's benefits, so this year's paycheck leaves them out: type this year's amounts in each person's fold.`);
  if (out.some((x) => x.state.from === "none")) notes.push("Your state's income tax is not counted: set it on the State page under Taxes, or type the figure from your pay stub.");
  return { ready: true, year, people: out, notes, stateMethod: st.method ?? null, w4Default };
}

/** Whole-dollar shares of $100 that add up to 100: each part's floor, then the largest remainders take the dollars left. */
export function hundred(parts, total) {
  const keys = Object.keys(parts);
  const raw = keys.map((k) => Math.max(0, (100 * parts[k]) / total));
  const scale = raw.reduce((a, b) => a + b, 0) || 1;
  const exact = raw.map((x) => (x * 100) / scale);
  const floor = exact.map(Math.floor);
  let left = 100 - floor.reduce((a, b) => a + b, 0);
  exact.map((x, i) => [x - floor[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { floor[i] += 1; left -= 1; } });
  return Object.fromEntries(keys.map((k, i) => [k, floor[i]]));
}

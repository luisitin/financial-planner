// modules/career/benefits/compute.js -- PURE. Open enrollment for one earner: the 401(k) percentage that gets the whole
// match and the one that reaches the year's limit, what each costs in take-home pay a paycheck, and the match left
// behind now; the health savings account's room after the employer's money; the health and child care flexible
// spending accounts and commuter benefits with the tax each saves; the employer stock purchase plan's discount after
// tax; and the tax on life cover through work above $50,000. The limits are the plan year's (next year from October).
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { careInputsWith, addIncome } from "../../taxes/federal/compute.js";
import { taxView } from "../../taxes/federal/known.js";
import { compute as computePaycheck, w4StatusFor } from "../../cashflow/paycheck/compute.js";
import { compute as computeState } from "../../taxes/state/compute.js";
import { maximumEarnings } from "../../retirement/social-security/compute.js";
import { limitsFor } from "../../retirement/contributions/compute.js";
import { BENEFITS, GROUP_LIFE, ESPP, ROTH_CATCHUP_FROM } from "./data/benefits.js";
import { federalTax } from "../../../core/math/tax.js";
import { perYear } from "../../../core/math/periods.js";
import { ageOn } from "../../../core/math/dates.js";

export const PAYROLL = { ss: 0.062, medicare: 0.0145 };
/** States whose income tax does not exempt HSA contributions (California, New Jersey). */
export const HSA_TAXED_STATES = ["CA", "NJ"];
/** States whose income tax does not exempt 401(k) deferrals (Pennsylvania taxes them as pay; PA Department of Revenue, Personal Income Tax Guide, Compensation). */
export const K401_TAXED_STATES = ["PA"];
/** The match the page assumes until you type yours: 50 cents a dollar on the first 6% of pay, the most common formula (Vanguard, How America Saves 2026). */
export const DEFAULT_TIERS = [{ rate: 0.5, upTo: 0.06 }];
/** Paychecks a year by pay period; anything else (a yearly or quarterly figure) assumes 26. */
export const PAYCHECKS = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 };
export const DEFAULTS = { paychecks: 26, esppDiscount: 0.15, esppLookback: true, lifeAge: 40, enrollFromMonth: 10 };

const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
const pos = (v) => Math.max(0, num(v) ?? 0);
const yearTable = (T, year) => T[year] ?? T[Math.max(...Object.keys(T).map(Number).filter((y) => y <= year))] ?? T[Math.min(...Object.keys(T).map(Number))];

/** The match as a share of pay for putting in `pct` of pay: tiers [{ rate, upTo }], each `upTo` the top of its band (cumulative share of pay). */
export function matchAt(pct, tiers) {
  let prev = 0, m = 0;
  for (const t of [...(tiers ?? [])].filter((x) => x.upTo > 0).sort((a, b) => a.upTo - b.upTo)) {
    m += Math.max(0, Math.min(pct, t.upTo) - prev) * (t.rate || 0);
    prev = Math.max(prev, t.upTo);
  }
  return m;
}
/** The least you put in (share of pay) to get the whole match; 0 when there is no match. */
export const fullMatchAt = (tiers) => Math.max(0, ...(tiers ?? []).filter((t) => t.rate > 0).map((t) => t.upTo || 0));
/**
 * The employer's match in dollars for putting in `yearly`: figured as a share of pay counted only up to the
 * compensation limit (IRC 401(a)(17)), what you put in being at most the deferral limit.
 */
export function matchDollars(yearly, pay, tiers, { compLimit = Infinity, limit = Infinity } = {}) {
  const payC = Math.min(pay, compLimit);
  if (!(payC > 0)) return 0;
  return matchAt(Math.min(yearly, limit) / payC, tiers) * payC;
}

/** The 401(k) limit for the age reached in the plan year: the base, plus the catch-up from 50, or the larger one from 60 to 63. */
export function limit401k(L, age) {
  const k = L["401k"];
  if (age === null || !Number.isFinite(age) || age < k.catchUpAge) return { limit: k.limit, catchUp: 0 };
  const catchUp = k.superCatchUp && age >= k.superCatchUp.from && age <= k.superCatchUp.to ? k.superCatchUp.amount : k.catchUp;
  return { limit: k.limit + catchUp, catchUp };
}
/** Group-term life: the yearly cost that is taxable pay for cover above $50,000 (Table I by age; 40 when unknown), less what the employee pays. */
export function groupLifeImputed(cover, age, paid = 0) {
  const a = Number.isFinite(age) ? age : DEFAULTS.lifeAge;
  const rate = GROUP_LIFE.table.find(([under]) => a < under)[1];
  return Math.max(0, Math.max(0, cover - GROUP_LIFE.free) / 1000 * rate * 12 - paid);
}

/**
 * The tax a pre-tax payroll deduction of `amount` saves. Federal: the household's income tax with wages lowered by it
 * (the 0.9% extra Medicare tax goes in `payroll`: cafeteria-plan money comes off Medicare wages). Payroll (`fica`): Social Security on
 * the part under the wage base and Medicare 1.45%, when it comes out of the paycheck before payroll tax (not a
 * 401(k), IRC 3121(v)(1)(A)). State: its rate unless `state` is false (a state that taxes it).
 */
export function taxSaved(amount, { inputs, params, personPay, wageBase, stateRate, fica = true, state = true, personId = null }) {
  if (!(amount > 0)) return { federal: 0, payroll: 0, state: 0, total: 0 };
  // cafeteria-plan money (not a 401(k)) is out of Medicare wages too (IRC 3121(a)(2)(B), (a)(5)(G); W-2 box 5), so it lowers the
  // household's 0.9% extra Medicare tax (Form 8959) once its Medicare wages pass the threshold
  // filing separately it comes off its holder's own return (Pub. 501), at that return's bracket and its own 0.9% threshold
  const a = federalTax(inputs, params), b = federalTax(addIncome(inputs, personId, { wages: -Math.min(amount, Number(inputs.wages) || 0), ...(fica ? { medicareWages: -amount } : {}) }), params);
  const federal = (a.totalTax - a.additionalMedicare) - (b.totalTax - b.additionalMedicare);
  const ssPart = Math.max(0, Math.min(personPay, wageBase) - Math.min(Math.max(0, personPay - amount), wageBase));
  const payroll = fica ? ssPart * PAYROLL.ss + amount * PAYROLL.medicare + (a.additionalMedicare - b.additionalMedicare) : 0;
  const st = state ? amount * (stateRate || 0) : 0;
  return { federal, payroll, state: st, total: federal + payroll + st };
}

/**
 * The child care account's worth for `person`: the plan's own federal tax for the plan year (taxInputs and federalTax, the
 * Federal estimate's one rule for the account: careAccountRule) with this election and with none, everything else as the
 * plan has it: the other adult's account counted once, a separate return with its own 3,750, care too small for the
 * account shown as money lost. federal = the tax without - the tax with (the 0.9% extra Medicare tax left out), the child
 * care credit the account costs counted in it; payroll = Social Security (to the wage base) and Medicare on the whole
 * election, up to a plan's own limit (IRC 3121(a)(18): out of Social Security and Medicare wages; W-2 box 10 instructions:
 * only an amount over the plan's limit goes in boxes 3 and 5; the part over the household's limit is added back for income
 * tax only, Form 2441 line 26; the Paycheck page takes all of it out); state = the state's rate on the change in income (AGI).
 * saved = federal + payroll + state - the money the accounts would lose (forfeited: pay you never get back).
 * -> { saved, taxSaved, federal, payroll, state, creditLost, care, forfeited (the household's, what this election adds),
 * excluded, taxedAsPay (what this election adds), own: { elected, forfeited, excluded, taxedAsPay } (this adult's share, as
 * every page splits the household's excess: by the elections), householdTaxed (the household's part taxed as pay), others
 * (the other adults' accounts for the plan year), separate, limit, overLimit, earnedCapped, low }
 */
export function dcWorth(plan, { today, planYear, person, settings = {}, elect = 0, stateRate = 0, wageBase = Infinity }) {
  const all = plan.whatIfs?.benefits ?? {};
  const at = (amount) => {
    const p = { ...plan, taxes: { ...(plan.taxes ?? {}), year: planYear }, whatIfs: { ...(plan.whatIfs ?? {}), benefits: { ...all, [person.id]: { ...settings, dcfsaElect: amount, planYear } } } };
    const t = taxView(p, { today });
    // the Federal estimate's own return (taxView: known()), which has a business at its profit on its owner's return, half its
    // self-employment tax and its 20% deduction off, as Budget does (Review 2026-11-06: Bo's separate return counted his
    // photography in full, across the 12%/22% line, so his 3,750 looked worth 760 of federal tax, not 575.31), and this
    // year's withdrawals, stock pay and rentals
    return { t, r: t.result, a: t.care?.account ?? null };
  };
  const W = at(elect), O = at(0);
  const fed = (x) => x.r.totalTax - x.r.additionalMedicare;
  const federal = fed(O) - fed(W);
  const creditLost = Math.max(0, (O.r.credits.careCredit || 0) - (W.r.credits.careCredit || 0));
  // Social Security and Medicare: the whole election leaves payroll wages (3121(a)(18)), as the paycheck takes it out
  let payroll = 0;
  for (const x of W.a?.people ?? []) {
    const o = O.a?.people.find((y) => y.id === x.id) ?? { elected: 0 };
    const d = x.elected - o.elected;
    if (Math.abs(d) < 0.005) continue;
    const gross = W.t.k401?.people?.find((y) => y.id === x.id)?.pay ?? 0;
    payroll += PAYROLL.ss * (Math.min(Math.max(0, gross - o.elected), wageBase) - Math.min(Math.max(0, gross - x.elected), wageBase)) + PAYROLL.medicare * d;
  }
  const state = (stateRate || 0) * ((O.r.agi || 0) - (W.r.agi || 0));
  const A = W.a, A0 = O.a;
  // the money the account would lose (elected beyond the care it can pay back) is pay you never get: it counts against it
  const lost = Math.max(0, (A?.forfeited ?? 0) - (A0?.forfeited ?? 0));
  const me = A?.people.find((y) => y.id === person.id) ?? null;
  const care = A ? A.care : 0;
  const low = A?.earnedCapped ? (A.separate || A.joint ? Math.min(...A.people.map((y) => y.earned18)) : me?.earned18 ?? null) : null;
  return {
    saved: federal + payroll + state - lost, taxSaved: federal + payroll + state, federal, payroll, state, creditLost, care,
    forfeited: lost, excluded: Math.max(0, (A?.excluded ?? 0) - (A0?.excluded ?? 0)), taxedAsPay: Math.max(0, (A?.taxedAsPay ?? 0) - (A0?.taxedAsPay ?? 0)),
    own: { elected: me?.elected ?? 0, forfeited: me?.forfeited ?? 0, excluded: me?.excluded ?? 0, taxedAsPay: me?.taxedAsPay ?? 0 }, householdTaxed: A?.taxedAsPay ?? 0,
    split: (A?.people ?? []).filter((y) => y.taxedAsPay > 0.5).map((y) => ({ id: y.id, name: y.name, taxedAsPay: y.taxedAsPay })), separate: !!A?.separate, limit: A?.limit ?? null,
    others: (A?.people ?? []).filter((y) => y.id !== person.id).reduce((t, y) => t + y.elected, 0), joint: !!A?.joint,
    overLimit: !!A?.overLimit && (A?.taxedAsPay ?? 0) > (A0?.taxedAsPay ?? 0) + 0.5, earnedCapped: !!A?.earnedCapped && (A?.taxedAsPay ?? 0) > (A0?.taxedAsPay ?? 0) + 0.5, low,
  };
}

/**
 * What take-home falls by each paycheck, from the Paycheck page's own figures (cashflow/paycheck compute): `person`'s
 * paycheck with these yearly choices ({ hsa, fsa, dcfsa, commuter, espp }) typed in as a paycheck's amounts, against the same
 * paycheck with none of them and no 401(k) (the 401(k) now is part of "taken from each paycheck"), and against all of them
 * but the child care account. The withholding is the IRS table's on the W-4 (the household's filing status unless one is
 * typed there), so it moves with the choices; a typed stub figure would not. `k401` (optional, [{ key, yearly, roth }]): each
 * 401(k) choice alone (pre-tax `yearly - roth`, the Roth catch-up after tax) against no 401(k) and none of the other choices,
 * so a 401(k) choice's "takes X from take-home pay" is the same figure as "taken from each paycheck" when it is all there is.
 * -> { all, dcfsa, k401: { [key]: a paycheck } } | null when the Paycheck page does not see this person's pay.
 */
export function paycheckChange(plan, { today, person, paychecks, filingStatus, taxYear, yearly, k401 = [] }) {
  const pw = plan.whatIfs?.paycheck?.[person.id] ?? {};
  const n = Math.max(1, paychecks);
  const base = { ...pw, federal: null, state: null, w4Status: pw.w4Status ?? w4StatusFor(filingStatus), paychecks: n };
  const s = plan.whatIfs?.benefits?.[person.id] ?? {};
  const isK = (c) => c.personId === person.id && (plan.accounts ?? []).find((a) => a.id === c.accountId)?.type === "401k";
  const at = (typed, no401k = false, k401Yearly = null) => {
    // the child care election in force for the Paycheck page's year when its amount is in, else none, so the tax and the
    // state's share that page works from follow it as they would on the real paycheck
    const ben = { ...s, esppOffered: false, dcfsaElect: typed.dcfsa > 0 ? yearly.dcfsa : 0, planYear: taxYear ?? s.planYear ?? null };
    // a 401(k) choice: this person's 401(k) as one yearly amount (an account made up for it when there is none yet)
    const kAcct = (plan.accounts ?? []).find((a) => a.type === "401k" && a.ownerId === person.id) ?? { id: "__benefits-401k", name: "401(k)", type: "401k", ownerId: person.id, balance: 0 };
    const others = (plan.retirement?.contributions ?? []).filter((c) => !isK(c));
    const contributions = no401k ? others : k401Yearly !== null ? [...others, ...(k401Yearly > 0 ? [{ id: "__benefits-401k-c", personId: person.id, accountId: kAcct.id, amount: k401Yearly, period: "annual" }] : [])] : plan.retirement?.contributions ?? [];
    const p = {
      ...plan,
      accounts: k401Yearly !== null && !(plan.accounts ?? []).includes(kAcct) ? [...(plan.accounts ?? []), kAcct] : plan.accounts,
      retirement: { ...(plan.retirement ?? {}), contributions },
      whatIfs: { ...(plan.whatIfs ?? {}), benefits: { ...(plan.whatIfs?.benefits ?? {}), [person.id]: ben }, paycheck: { ...(plan.whatIfs?.paycheck ?? {}), [person.id]: { ...base, ...typed } } },
    };
    let pc = null;
    try { pc = computePaycheck(p, { today }); } catch { pc = null; }
    return pc?.ready ? pc.people.find((x) => x.id === person.id) ?? null : null;
  };
  const per = (v) => (Number(v) || 0) / n;
  const choices = { hsa: per(yearly.hsa), fsa: per(yearly.fsa), dcfsa: per(yearly.dcfsa), commuter: per(yearly.commuter), afterTax: (Number(pw.afterTax) || 0) + per(yearly.espp) };
  const zero = { hsa: 0, fsa: 0, dcfsa: 0, commuter: 0, afterTax: Number(pw.afterTax) || 0 };
  const withAll = at(choices), none = at(zero, true), noDc = at({ ...choices, dcfsa: 0 });
  if (!withAll || !none || !noDc) return null;
  // each 401(k) choice alone: the 401(k) now exactly as the plan has it (so with nothing else chosen it is `all`), the
  // others at their yearly amount, the Roth catch-up taken after tax
  const kOut = {};
  for (const o of k401 ?? []) {
    const roth = Math.max(0, Number(o.roth) || 0);
    const one = o.key === "now" ? at(zero) : at({ ...zero, roth: (Number(pw.roth) || 0) + roth / n }, false, Math.max(0, (Number(o.yearly) || 0) - roth));
    if (one) kOut[o.key] = none.net - one.net;
  }
  return { all: none.net - withAll.net, dcfsa: noDc.net - withAll.net, k401: kOut };
}

/**
 * compute(plan, { today }) -> {
 *   ready, why ("no-pay"|"no-person"), year, planYear, limitsYear, person: { id, name, age }, people (adults with pay), pay, paychecks, settings, notes,
 *   k401: { tiers, tiersAssumed, nowPct, nowYearly, nowMatch, nowMatchPlan, fullPct, fullMatch, leftBehind, limit, baseLimit, catchUp, maxPct, hasAccount,
 *     options: [{ key: "now"|"match"|"max", pct, yearly, perCheck, match, roth, cost, costPerCheck (the Paycheck page's change when
 *     it sees the pay: costFrom "paycheck"), saved }], rothCatchUp, rothCatchUpWages, stateTaxed },
 *   hsa: { eligible, coverage, limit, employer, room, typed, elect, saved, maxSaved, stateTaxed } | null,
 *   fsa: { limit, typed, elect, saved, carryover, withHsa },
 *   dependentCare: { kids, limit (the household's, or each separate return's), planMax, separate, others, typed, elect, care (the care for the
 *     plan year), saved (federal + payroll + state: the plan's tax for the plan year without the account less with it, the
 *     credit it costs counted), federal, payroll, state, creditLost, savedBeforeCredit, forfeited, excluded, taxedAsPay (what this
 *     election adds to each), overLimit, earnedCapped, low (the earned income that caps it), perCheck (the paycheck's own change),
 *     own ({ elected, forfeited, excluded, taxedAsPay }: this adult's share), householdTaxed, split (each adult's part taxed as pay),
 *     best ({ elect, saved } | null: the amount the account is worth most at, when this one costs more than it saves) },
 *   commuter: { typed, transit, parking, limit, parkingLimit, saved },
 *   espp: { offered, pct, discount, lookback, yearly, perCheck, cap, capped, gain, taxOnGain, afterTax } | null,
 *   life: { cover, imputed, tax, ageKnown } | null,
 *   total: { pretaxYearly, savedYearly (worked together, the 401(k) first; the child care account's own difference), perCheck (what
 *     take-home falls by each paycheck, from the Paycheck page's own figures with and without the choices), perCheckFrom ("paycheck" | "tax") }
 * }
 * `{ paycheck: false }` (the Paycheck page's own call) leaves out the parts that run the Paycheck page and the child care
 * account's tax runs, which that page does not read.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? `${new Date().getFullYear()}-01-01`;
  const year = Number(today.slice(0, 4)), month = Number(today.slice(5, 7));
  const all = plan.whatIfs?.benefits ?? {};
  const people = plan.household?.people ?? [];
  const adults = people.filter((p) => p.role !== "dependent");
  const inc = computeIncome(plan, { today });
  const salaryOf = (id) => inc.active.filter((x) => x.personId === id && x.type === "salary" && x.period !== "once");
  const withPay = adults.filter((p) => salaryOf(p.id).reduce((t, x) => t + x.yearly, 0) > 0);
  const chosen = adults.find((p) => p.id === all.personId);
  const person = (chosen && withPay.includes(chosen) ? chosen : null) ?? withPay.find((p) => p.role === "self") ?? withPay[0] ?? null;
  if (!person) {
    const unlinked = inc.active.some((x) => x.type === "salary" && !x.personId && x.yearly > 0);
    return { ready: false, why: unlinked ? "no-person" : "no-pay", year, person: null, people: [] };
  }
  const s = all[person.id] ?? {};
  // open enrollment in the autumn picks next year's benefits
  const planYear = num(s.planYear) ?? (month >= DEFAULTS.enrollFromMonth ? year + 1 : year);
  // each kind of limit from the newest year that has it (the HSA's come out in the spring, the others in the autumn)
  const LF = limitsFor(planYear);
  const limitsYear = LF.fullYear;
  const birthYear = /^\d{4}-\d{2}-\d{2}$/.test(String(person.birthDate ?? "")) ? Number(person.birthDate.slice(0, 4)) : null;
  const age = birthYear !== null ? planYear - birthYear : null;   // the age reached in the plan year (the catch-up rules)
  const salaries = salaryOf(person.id);
  const bonus = inc.active.filter((x) => x.personId === person.id && x.type === "bonus" && x.period !== "once").reduce((t, x) => t + x.yearly, 0);
  const pay = num(s.pay) ?? salaries.reduce((t, x) => t + x.yearly, 0) + bonus;
  const notes = [];
  const fromPeriod = PAYCHECKS[salaries[0].period];
  const paychecks = num(s.paychecks) ?? fromPeriod ?? DEFAULTS.paychecks;
  if (num(s.paychecks) === null && !fromPeriod) notes.push(`You entered your pay as a ${salaries[0].period === "annual" ? "yearly" : "quarterly"} amount, so the page assumes ${DEFAULTS.paychecks} paychecks a year: set yours under "Your employer's match".`);
  // the HSA limits come out in the spring, the others in October and November
  const hsaAhead = limitsYear !== planYear && LF.kindYear.hsa === planYear;
  if (limitsYear !== planYear) notes.push(`The ${planYear} limits${hsaAhead ? " for the 401(k), the flexible spending accounts and commuting" : ""} are not in the app yet, so ${limitsYear}'s are shown; the IRS publishes them in October and November.${hsaAhead ? ` The health savings account's ${planYear} limits are in.` : ""}`);

  const ti = taxView(plan, { today });
  const st = computeState(plan, { today });
  const stateRate = st.rate ?? 0;
  const code = String(plan.household?.state ?? "").toUpperCase();
  if (st.rate === null) notes.push("Your state's income tax is not counted in the savings: set its rate on the State tax page.");
  const wageBase = maximumEarnings(year);
  // the plan's tax position with the health FSA and the child care account put back in wages: each choice below is worked
  // from no election. The Federal estimate takes the child care account chosen here for its tax year off wages and off the
  // child care credit's limit; here the credit is worked with no account (benefits 0), each adult's earned income with it back
  // the base for the choices below (the health FSA, the HSA, commuting, the 401(k)): the plan's tax with the health FSA and
  // the child care account put back in wages and no child care account (careInputsWith with no elections), so each choice is
  // worked from none; the child care account itself is worked on its own (`dcWorth`)
  const careT = careInputsWith(ti, {}, {});
  const T = { inputs: { ...ti.inputs, wages: (Number(ti.inputs.wages) || 0) + (ti.fsa?.offWages ?? 0) + (ti.wagesTyped ? 0 : ti.care?.offWages ?? 0), ...(careT ? { care: careT } : {}) }, params: ti.params, personPay: pay, wageBase, stateRate, personId: person.id };
  const light = params.paycheck === false;
  const L = LF.kinds;
  const B = yearTable(BENEFITS, planYear);

  // the 401(k)
  const accounts = plan.accounts ?? [];
  const mine = (plan.retirement?.contributions ?? []).filter((c) => c.personId === person.id && accounts.find((a) => a.id === c.accountId)?.type === "401k");
  const nowYearly = mine.reduce((t, c) => t + perYear(c.amount, c.period), 0);
  const nowMatchPlan = mine.reduce((t, c) => t + (Number(c.employerMatch) || 0), 0);
  // "No match at this job" answered on Retirement contributions (`retirement.workPlans[id].match === false`) is the same answer
  // as no match tiers here, unless tiers were typed on this page since (2026-11-02: the two used to disagree)
  const noMatch = !Array.isArray(s.matchTiers) && plan.retirement?.workPlans?.[person.id]?.match === false;
  const tiersAssumed = !Array.isArray(s.matchTiers) && !noMatch;
  const tiers = noMatch ? [] : tiersAssumed ? DEFAULT_TIERS : s.matchTiers.map((t) => ({ rate: pos(t.rate), upTo: pos(t.upTo) })).filter((t) => t.upTo > 0 && t.rate > 0);
  const lim = limit401k(L, age);
  const caps = { compLimit: B.compLimit, limit: lim.limit };
  const payC = Math.min(pay, B.compLimit);
  const nowPct = pay > 0 ? nowYearly / pay : 0;
  const fullYearly = Math.min(lim.limit, fullMatchAt(tiers) * payC);
  const fullPct = pay > 0 ? fullYearly / pay : 0;
  const maxPct = pay > 0 ? Math.min(1, lim.limit / pay) : 0;
  const stateTaxed401k = K401_TAXED_STATES.includes(code);
  const rothCatchUp = planYear >= ROTH_CATCHUP_FROM && lim.catchUp > 0 && pay > B.rothCatchUpWages;
  // what a choice costs: the plan's wages already have today's 401(k) taken off; compare each choice with no 401(k)
  const kOff = ti.k401?.people?.find((x) => x.id === person.id)?.excluded ?? nowYearly;   // what the Federal estimate took off wages for it
  const base = { ...T, inputs: { ...T.inputs, wages: (Number(T.inputs.wages) || 0) + kOff } };
  const option = (key, pct) => {
    const yearly = Math.min(lim.limit, pct * pay);
    const roth = rothCatchUp ? Math.max(0, yearly - L["401k"].limit) : 0;   // the catch-up part goes in after tax
    const saved = taxSaved(yearly - roth, { ...base, fica: false, state: !stateTaxed401k });
    const cost = yearly - saved.total;
    return { key, pct, yearly, perCheck: yearly / paychecks, match: matchDollars(yearly, pay, tiers, caps), roth, cost, costPerCheck: cost / paychecks, saved: saved.total };
  };
  const options = [];
  if (nowYearly > 0) options.push(option("now", nowPct));
  if (fullYearly > 0 && Math.abs(fullYearly - nowYearly) > 0.5) options.push(option("match", fullPct));
  if (lim.limit - Math.max(nowYearly, fullYearly) > 0.5) options.push(option("max", maxPct));
  options.sort((a, b) => a.pct - b.pct);
  const nowMatch = matchDollars(nowYearly, pay, tiers, caps), fullMatch = matchDollars(fullYearly, pay, tiers, caps);
  const k401 = {
    tiers, tiersAssumed, nowPct, nowYearly, nowMatch, nowMatchPlan, fullPct, fullMatch, leftBehind: Math.max(0, fullMatch - nowMatch),
    limit: lim.limit, baseLimit: L["401k"].limit, catchUp: lim.catchUp, maxPct, options, hasAccount: mine.length > 0,
    // from 2026 the catch-up of someone paid over the line by the employer the year before goes in as Roth (IRC 414(v)(7); final rules from 2027)
    rothCatchUp, rothCatchUpWages: B.rothCatchUpWages, stateTaxed: stateTaxed401k, compLimit: B.compLimit, overCompLimit: pay > B.compLimit,
  };

  // the cafeteria-plan choices (through the paycheck: no income tax, no Social Security or Medicare)
  const hs = plan.taxes?.hsa ?? {};
  const eligible = s.hsaEligible ?? (Number(hs.contribution) > 0 || Number(hs.employer) > 0);
  const hsaBase = { ...T, inputs: { ...T.inputs, adjustments: Math.max(0, (Number(ti.inputs.adjustments) || 0) - Math.min(pos(hs.contribution), ti.hsa?.deducted ?? pos(hs.contribution))) } };
  let hsa = null;
  if (eligible) {
    const coverage = (s.hsaCoverage ?? hs.coverage) === "family" ? "family" : "self";
    const H = L.hsa;
    const limit = (coverage === "family" ? H.family : H.limit) + (age !== null && age >= H.catchUpAge ? H.catchUp : 0);
    const employer = num(s.hsaEmployer) ?? pos(hs.employer);
    const room = Math.max(0, limit - employer);
    const typed = num(s.hsaElect) ?? pos(hs.contribution);
    const elect = Math.min(room, typed);
    const stateTaxed = HSA_TAXED_STATES.includes(code);
    hsa = { eligible: true, coverage, limit, employer, room, typed, elect, saved: taxSaved(elect, { ...hsaBase, state: !stateTaxed }).total, stateTaxed, maxSaved: taxSaved(room, { ...hsaBase, state: !stateTaxed }).total };
  }
  const fsaTyped = num(s.fsaElect) ?? pos(hs.fsa);
  const fsaElect = Math.min(L.fsa.limit, fsaTyped);
  const fsa = { limit: L.fsa.limit, typed: fsaTyped, carryover: L.fsa.carryover, elect: fsaElect, saved: taxSaved(fsaElect, T).total, withHsa: !!hsa && fsaElect > 0 };
  // child care: each employee's own account, up to a plan's limit (7,500 from 2026); the household's limit (or each separate
  // return's) is the Federal estimate's one rule, so the account's worth is the plan's own tax for the plan year with this
  // election and without it, everything else as the plan has it (the other adult's account, the filing status, the care)
  const kids = people.filter((p) => p.role === "dependent" && p.birthDate && (ageOn(p.birthDate, today) ?? 99) < B.dependentCare.childUnder);
  const separate = ti.filingStatus === "married_separate";
  const dcLimit = separate ? B.dependentCare.separate : B.dependentCare.limit;
  const planMax = B.dependentCare.limit;
  const dcTyped = pos(s.dcfsaElect);
  const dcElect = Math.min(planMax, dcTyped);
  const dcW = light ? null : dcWorth(plan, { today, planYear, person, settings: s, elect: dcElect, stateRate, wageBase });
  const others = dcW ? dcW.others : adults.filter((p) => p.id !== person.id && (num(all[p.id]?.planYear) ?? planYear) === planYear).reduce((t, p) => t + Math.min(planMax, pos(all[p.id]?.dcfsaElect)), 0);
  // the amount the account is worth most at (the room left under the limit, at most the care no other account pays): worked
  // only when this amount costs more than it saves for the credit it costs, so the page says "think about skipping the
  // account" only when no amount is worth it, and names the amount that is otherwise (care fourth pass)
  let best = null;
  if (dcW && dcElect > 0 && dcW.saved <= -0.5 && dcW.creditLost > 0.5 && !(dcW.forfeited > 0.5)) {
    const room = Math.max(0, Math.min(planMax, separate ? dcLimit : dcLimit - others, (dcW.care ?? 0) - (separate ? 0 : others)));
    if (room > 0.5 && Math.abs(room - dcElect) > 0.5) { const b = dcWorth(plan, { today, planYear, person, settings: s, elect: room, stateRate, wageBase }); best = { elect: room, saved: b.saved }; }
  }
  const dependentCare = {
    kids: kids.map((k) => k.name), limit: dcLimit, planMax, separate, others, typed: dcTyped, elect: dcElect,
    saved: dcW?.saved ?? 0, taxSaved: dcW?.taxSaved ?? 0, federal: dcW?.federal ?? 0, payroll: dcW?.payroll ?? 0, state: dcW?.state ?? 0, creditLost: dcW?.creditLost ?? 0, savedBeforeCredit: (dcW?.saved ?? 0) + (dcW?.creditLost ?? 0),
    care: dcW?.care ?? null, forfeited: dcW?.forfeited ?? 0, excluded: dcW?.excluded ?? 0, taxedAsPay: dcW?.taxedAsPay ?? 0, overLimit: !!dcW?.overLimit, earnedCapped: !!dcW?.earnedCapped, low: dcW?.low ?? null, joint: !!dcW?.joint,
    own: dcW?.own ?? { elected: dcElect, forfeited: 0, excluded: 0, taxedAsPay: 0 }, householdTaxed: dcW?.householdTaxed ?? 0, split: dcW?.split ?? [], best,
    perCheck: null,
  };
  const transitTyped = pos(s.transitMonthly), parkingTyped = pos(s.parkingMonthly);
  const transit = Math.min(B.commuter.transitMonthly, transitTyped), parking = Math.min(B.commuter.parkingMonthly, parkingTyped);
  const commuter = { typed: { transit: transitTyped, parking: parkingTyped }, transit, parking, limit: B.commuter.transitMonthly, parkingLimit: B.commuter.parkingMonthly, saved: taxSaved((transit + parking) * 12, T).total };

  // the employer stock purchase plan: buying at a discount; sold at once, the discount is pay (no Social Security or Medicare)
  let espp = null;
  if (s.esppOffered) {
    const discount = Math.min(ESPP.maxDiscount, num(s.esppDiscount) ?? DEFAULTS.esppDiscount);
    const pct = pos(s.esppPct);
    const cap = ESPP.yearlyStock * (1 - discount);   // the most that buys $25,000 of stock at the offering price, prices flat
    const yearly = Math.min(pct * pay, cap);
    const gain = yearly * (1 / (1 - discount) - 1);
    const fed = federalTax({ ...T.inputs, otherOrdinary: (Number(T.inputs.otherOrdinary) || 0) + gain }, ti.params).totalTax - federalTax(T.inputs, ti.params).totalTax;
    const taxOnGain = fed + gain * stateRate;
    espp = { offered: true, pct, discount, lookback: s.esppLookback ?? DEFAULTS.esppLookback, yearly, perCheck: yearly / paychecks, cap, capped: pct * pay > cap, gain, taxOnGain, afterTax: gain - taxOnGain };
  }

  // life cover through work above $50,000: taxable pay, with Social Security only under the wage base
  let life = null;
  const cover = pos(s.lifeCover);
  if (cover > GROUP_LIFE.free) {
    const imputed = groupLifeImputed(cover, age, pos(s.lifePaid));
    const a = federalTax(T.inputs, ti.params), b = federalTax({ ...T.inputs, wages: (Number(T.inputs.wages) || 0) + imputed }, ti.params);
    const ss = PAYROLL.ss * Math.max(0, Math.min(pay + imputed, wageBase) - Math.min(pay, wageBase));
    life = { cover, imputed, tax: (b.totalTax - b.additionalMedicare) - (a.totalTax - a.additionalMedicare) + ss + imputed * (PAYROLL.medicare + stateRate), ageKnown: age !== null };
  }

  // the paycheck: the 401(k) now first, then the cafeteria-plan choices together on the wages it leaves; the child care
  // account by its own difference (dcWorth), the credit it costs counted there
  const k = options.find((o) => o.key === "now");
  const cafeteriaNoDc = (hsa?.elect ?? 0) + fsaElect + (transit + parking) * 12;
  const cafeteria = cafeteriaNoDc + dcElect;
  const afterK = { ...hsaBase, inputs: { ...hsaBase.inputs, wages: Math.max(0, (Number(T.inputs.wages) || 0) + kOff - (k ? k.yearly - k.roth : 0)) } };
  const together = taxSaved(cafeteriaNoDc, { ...afterK, state: false });
  const cafeteriaState = (cafeteriaNoDc - (hsa?.stateTaxed ? hsa.elect : 0)) * stateRate;
  const pretaxYearly = (k?.yearly ?? 0) + cafeteria;
  const savedYearly = (k?.saved ?? 0) + together.total + cafeteriaState + dependentCare.saved;
  // what each paycheck loses: the Paycheck page's own take-home with these choices against without them (its withholding
  // table, Social Security and Medicare, the state's share), so it is what the pay stub will show; the child care credit the
  // account costs is not in it (it shows as a smaller refund when you file). Worked out from the tax only when the Paycheck
  // page cannot say (pay it does not see).
  let perCheck = (pretaxYearly - savedYearly + (espp?.yearly ?? 0)) / paychecks, perCheckFrom = "tax";
  if (!light) {
    const pc = paycheckChange(plan, { today, person, paychecks, filingStatus: ti.filingStatus, taxYear: ti.year, yearly: { hsa: hsa?.elect ?? 0, fsa: fsaElect, dcfsa: dcElect, commuter: (transit + parking) * 12, espp: espp?.yearly ?? 0 }, k401: options.map((o) => ({ key: o.key, yearly: o.yearly, roth: o.roth })) });
    if (pc) {
      perCheck = pc.all; perCheckFrom = "paycheck"; dependentCare.perCheck = pc.dcfsa;
      // one take-home figure for a 401(k) choice: the Paycheck page's, as "taken from each paycheck" is (care fourth pass:
      // the family's 12.1% said 363 on its row and 414 a paycheck below)
      for (const o of options) if (Number.isFinite(pc.k401?.[o.key])) { o.costPerCheck = pc.k401[o.key]; o.costFrom = "paycheck"; }
    }
  }
  return {
    ready: true, year, planYear, limitsYear, person: { id: person.id, name: person.name, age }, people: withPay.map((p) => ({ id: p.id, name: p.name })),
    pay, paychecks, settings: s, notes,
    k401, hsa, fsa, dependentCare, commuter, espp, life,
    total: { pretaxYearly, savedYearly, perCheck, perCheckFrom, any: pretaxYearly + (espp?.yearly ?? 0) > 0 },
  };
}

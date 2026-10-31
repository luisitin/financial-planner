// modules/taxes/federal/compute.js -- PURE. This year's federal income tax from what the plan
// already knows (pay, pensions, Social Security, pre-tax contributions, who is in the household)
// plus the figures only the owner knows (typed on the page: dividends, interest, withholding,
// itemized deductions). Every other tax page starts from taxInputs() so they all agree.
import { FEDERAL, TAX_YEARS } from "./data/federal.js";
import { MAXIMUM_EARNINGS } from "../../retirement/social-security/data/ssa.js";
import { federalTax, marginalRate, paramsFor, standardDeduction, SEPARATE_FIELDS } from "../../../core/math/tax.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { perYear } from "../../../core/math/periods.js";
import { limitsFor, catchUpFor, hsaPicture, limitKind } from "../../retirement/contributions/compute.js";

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
  const P0 = paramsFor(FEDERAL, year, { inflation: Number(plan.assumptions?.inflation ?? 0.03) });
  // a year past the last tax table inflates the wage base; SSA publishes next year's every October (2027: $192,300), so a published one wins
  const P1 = MAXIMUM_EARNINGS[year] ? { ...P0, ssWageBase: MAXIMUM_EARNINGS[year] } : P0;
  const filingStatus = P1.status[plan.household?.filingStatus] ? plan.household.filingStatus : "single";
  // filing separately, Social Security is taxed from the first dollar (base 0) unless the spouses lived apart all year,
  // when the single figures apply (IRC 86(c)(1)(C)(ii) and (c)(2)(C); the tables hold the living-together zero)
  const livedApart = filingStatus === "married_separate" && t.livedApart === true;
  const P = livedApart ? { ...P1, ssTaxation: { ...P1.ssTaxation, married_separate: P1.ssTaxation.single } } : P1;
  const inc = computeIncome(plan, { today });
  const active = inc.active.filter((x) => x.taxable !== false);
  const sumType = (...types) => active.filter((x) => types.includes(x.type)).reduce((s, x) => s + x.yearly, 0);
  const accounts = plan.accounts ?? [];
  const notes = [], sources = [];
  const typed = (k) => ty[k] !== null && ty[k] !== undefined && ty[k] !== "";
  const L = limitsFor(year);
  // the people: each adult's pay and contributions, for the limits that are per person (401(k), IRA)
  const people = plan.household?.people ?? [];
  const ageAtYearEnd = (p) => p?.birthDate ? year - Number(String(p.birthDate).slice(0, 4)) : null;
  const adults = people.filter((p) => p.role !== "dependent");
  const me = adults.find((p) => p.role === "self") ?? adults[0] ?? null;
  const adultOf = (id) => adults.find((p) => p.id === id) ?? null;
  // a row or pay that names no adult is the household's: it goes on the adult marked "Me"
  const contribs = (plan.retirement?.contributions ?? []).map((c) => {
    const acct = accounts.find((a) => a.id === c.accountId);
    return { ...c, yearly: perYear(c.amount, c.period), accountType: acct?.type, kind: limitKind(acct?.type, acct?.name, Number(c.employerMatch) || 0), owner: adultOf(c.personId) ?? adultOf(acct?.ownerId) ?? me };
  });
  const payItems = active.filter((x) => x.type === "salary" || x.type === "bonus");
  const payTotal = payItems.reduce((s, x) => s + x.yearly, 0);
  const businessItems = active.filter((x) => x.type === "business");
  const sumOf = (rows) => rows.reduce((s, c) => s + c.yearly, 0);
  const K = L.kinds["401k"], I = L.kinds.ira;
  const k401People = (adults.length ? adults : [null]).map((p) => {
    const mine = contribs.filter((c) => c.owner === p);
    const pretax = sumOf(mine.filter((c) => c.accountType === "401k")), roth = sumOf(mine.filter((c) => c.accountType === "roth" && c.kind === "401k"));
    const ownOf = (items) => (p ? items.filter((x) => (adultOf(x.personId) ?? me) === p) : items).reduce((s, x) => s + x.yearly, 0);
    const pay = ownOf(payItems);
    // compensation for the catch-up cap is 415(c)(3)'s: the pay, and for someone self-employed the earned income
    // (415(c)(3)(B), 401(c)(2)), here the Income page's business figure, so a solo 401(k) keeps its catch-up
    const compensation = pay + ownOf(businessItems);
    // the catch-up is at most the compensation left after the other deferrals (IRC 414(v)(2)(A)(ii)); pre-tax money over
    // the limit plus the catch-up is pay this year, Roth money counting as the excess first (402(g)(1)(A), last sentence)
    const catchUp = Math.min(catchUpFor(K, ageAtYearEnd(p)), Math.max(0, compensation - Math.min(pretax + roth, K.limit)));
    const limit = K.limit + catchUp, excluded = Math.min(pretax, limit);
    return { id: p?.id ?? null, name: p?.name ?? "You", age: ageAtYearEnd(p), pay, compensation, pretax, roth, limit, catchUp, excluded, inIncome: pretax - excluded };
  });
  const pretax401k = k401People.reduce((s, x) => s + x.excluded, 0);
  const k401Over = k401People.reduce((s, x) => s + x.inIncome, 0);
  // the traditional IRA: deducted (assumed deductible) up to each person's IRA limit plus catch-up (219(b)(1), (b)(5))
  const iraPeople = (adults.length ? adults : [null]).map((p) => {
    const traditional = sumOf(contribs.filter((c) => c.owner === p && c.accountType === "ira"));
    const limit = I.limit + catchUpFor(I, ageAtYearEnd(p));
    return { id: p?.id ?? null, name: p?.name ?? "You", traditional, limit, deductible: Math.min(traditional, limit) };
  });
  const iraDeductible = iraPeople.reduce((s, x) => s + x.deductible, 0);
  const iraOver = iraPeople.reduce((s, x) => s + x.traditional - x.deductible, 0);
  // the health FSA election is a cafeteria-plan salary reduction, not wages, up to the year's limit (IRC 125(i), 3121(a)(5)(G))
  const fsaElection = Math.max(0, Number(t.hsa?.fsa) || 0), fsaLimit = L.kinds.fsa?.limit ?? Infinity;
  const fsaExcluded = Math.min(fsaElection, fsaLimit);
  // HSA money through pay is kept out of income and payroll tax only up to the household's limit for its cover (106(d)(1),
  // 223(b); none without a high-deductible plan); the excess is pay, the employer's part of it included (Pub. 969)
  const hsa = hsaPicture(plan, year);
  const hsaPayroll = hsa.household.payroll, hsaExcess = hsa.household.excess;
  const hsaContrib = Math.max(0, hsaPayroll - hsaExcess), hsaEmployerTaxed = Math.max(0, hsaExcess - hsaPayroll);
  const wagesTyped = typed("wages");
  const wagesAuto = Math.max(0, payTotal - pretax401k - fsaExcluded) + hsaEmployerTaxed;
  const wages = wagesTyped ? Number(ty.wages) : wagesAuto;
  const wageParts = [pretax401k > 0 ? `less ${fmtInt(pretax401k)} of pre-tax 401(k) contributions` : null, fsaExcluded > 0 ? `less the ${fmtInt(fsaExcluded)} health FSA` : null, hsaEmployerTaxed > 0 ? `plus ${fmtInt(hsaEmployerTaxed)} of employer HSA money over the limit` : null].filter(Boolean);
  sources.push({ key: "wages", label: "Wages", amount: wages, from: wagesTyped ? "typed" : "plan", detail: wagesTyped ? "as typed" : `pay and bonuses on the Income page${wageParts.length ? `, ${wageParts.join(", ")}` : ""}` });
  if (!wagesTyped && k401Over > 0) notes.push(`${fmtInt(k401Over)} of pre-tax 401(k) money is over this year's limit, so it is taxed as pay. Ask the plan to pay it back by April 15, or it is taxed again when it comes out.`);
  if (!wagesTyped && fsaElection > fsaExcluded) notes.push(`The health FSA election is over this year's limit of ${fmtInt(fsaLimit)}: only ${fmtInt(fsaExcluded)} comes off your pay before tax.`);
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
  if (iraDeductible) sources.push({ key: "ira", label: "IRA contributions", amount: -iraDeductible, from: "plan", detail: `Contributions page; assumed deductible${iraOver > 0 ? `; ${fmtInt(iraOver)} over the IRA limit is not deducted` : ""}` });
  if (iraOver > 0) notes.push(`${fmtInt(iraOver)} of traditional IRA money is over this year's limit, so it is not deducted. Take it out (with what it earned) before the filing deadline to avoid a 6% tax each year it stays.`);
  if (hsaContrib) sources.push({ key: "hsa", label: "HSA contributions", amount: -hsaContrib, from: "plan", detail: `HSA page or Contributions page${hsaExcess > 0 ? `; ${fmtInt(hsaExcess)} over the limit for your cover is taxed as pay` : ""}` });
  if (hsaExcess > 0) notes.push(hsa.household.limit === 0 && hsa.coverage === "none"
    ? `${fmtInt(hsaExcess)} goes into an HSA, but the HSA page says you have no high-deductible health plan, so it is taxed as pay.`
    : `${fmtInt(hsaExcess)} of HSA money is over the limit for your cover, so it is taxed as pay. The HSA and FSA page shows who is over.`);
  if (adjustmentsTyped) sources.push({ key: "adjustments", label: "Other adjustments", amount: -adjustmentsTyped, from: "typed" });
  // the people: age allowances and dependents by age at the end of the tax year
  const ages65plus = adults.filter((p) => ageAtYearEnd(p) !== null && ageAtYearEnd(p) >= 65).length;
  const deps = people.filter((p) => p.role === "dependent");
  const under17Auto = deps.filter((p) => ageAtYearEnd(p) === null || ageAtYearEnd(p) < 17).length;
  const given = (v) => v !== null && v !== undefined && v !== "";
  const dependentsUnder17 = given(t.dependentsUnder17) ? Number(t.dependentsUnder17) : under17Auto;
  const otherDependents = given(t.otherDependents) ? Number(t.otherDependents) : deps.length - under17Auto;
  const paid = (Number(ty.paid) || 0) + (t.estimated?.paid ?? []).reduce((s, x) => s + (Number(x) || 0), 0);
  // net investment income for the 3.8% tax (Form 8960): dividends and interest, the typed qualified dividends and the year's net gain or allowed loss; rent is left out (only its gross is known)
  const investmentIncome = Math.max(0, investment + qualifiedTyped + gains.netShort + gains.netLong + gains.lossAllowed);
  // Medicare wages for the 0.9% additional Medicare tax: pay before pre-tax 401(k) saving (IRC 3121(v)(1)(A)), less the
  // health FSA and the HSA payroll money within the limit (3121(a)(5)(G)); typed wages are taken as they are
  const medicareWages = wagesTyped ? wages : Math.max(0, payTotal - fsaExcluded - hsaPayroll + hsaExcess);
  const base = { filingStatus, wages, medicareWages, otherOrdinary, qualifiedIncome, capitalLoss: gains.lossAllowed, socialSecurity, taxExemptInterest, adjustments, ages65plus, blind: Number(t.blind) || 0, dependentsUnder17, otherDependents, withheld: Number(ty.withheld) || 0, paid, selfEmployment: business, investmentIncome, charitableCash: Math.max(0, Number(t.itemized?.charitable) || 0) };
  const agi = federalTax({ ...base, itemized: 0 }, P).agi;
  const itemized = itemizedTotal(t.itemized, agi, filingStatus, P);
  let inputs = { ...base, itemized: itemized.total };
  // married filing separately is two returns, one per spouse (IRS Pub. 501: each reports their own income, credits and
  // deductions): each spouse's own pay, 401(k), IRA and HSA money and the income in their name; the household's income
  // with no one named, the typed figures, the gains and the itemized amounts split in half (a sale's half on each return,
  // so each has its own $1,500 loss limit, IRC 1211(b)); pay with no one named and the health FSA on the adult marked
  // "Me"; the children on the higher earner's return (the Which way to file page's convention). The engine adds the two
  // returns up (core/math/tax.js separateTax); `separate` holds each spouse's inputs.
  let separate = null;
  if (filingStatus === "married_separate" && adults.length >= 2) {
    const two = adults.slice(0, 2);
    const shareOf = (x, p, payLike) => { const o = adultOf(x.personId); return o ? (o === p ? 1 : 0) : payLike ? (p === me ? 1 : 0) : 0.5; };
    const sumFor = (p, types, payLike = false) => active.filter((x) => types.includes(x.type)).reduce((s, x) => s + x.yearly * shareOf(x, p, payLike), 0);
    const halfGains = netGains((t.gains ?? []).map((g) => ({ ...g, proceeds: (Number(g.proceeds) || 0) / 2, basis: (Number(g.basis) || 0) / 2 })), filingStatus);
    const halfItemized = Object.fromEntries(Object.entries(t.itemized ?? {}).map(([k, v]) => [k, typeof v === "number" ? v / 2 : v]));
    const payOf = (p) => sumFor(p, ["salary", "bonus"], true);
    const carrier = [...two].sort((a, b) => payOf(b) - payOf(a))[0];
    const blindAll = Math.max(0, Math.round(Number(t.blind) || 0));
    separate = two.map((p) => {
      const i = adults.indexOf(p), k = k401People[i], ira = iraPeople[i], h = hsa.people[i];
      const fsaOwn = p === me ? fsaExcluded : 0;
      const hsaDeducted = Math.max(0, h.payroll - h.excess), hsaTaxed = Math.max(0, h.excess - h.payroll);
      const ownWages = wagesTyped ? wages * (payTotal > 0 ? k.pay / payTotal : 1 / two.length) : Math.max(0, k.pay - k.excluded - fsaOwn) + hsaTaxed;
      const ownBusiness = sumFor(p, ["business"]);
      const part = {
        filingStatus, wages: ownWages, medicareWages: wagesTyped ? ownWages : Math.max(0, k.pay - fsaOwn - h.payroll + h.excess),
        otherOrdinary: Math.max(0, ownBusiness + sumFor(p, ["rental", "pension", "investment", "other"]) + otherTyped / 2 + halfGains.netShort),
        qualifiedIncome: Math.max(0, qualifiedTyped / 2 + halfGains.netLong), capitalLoss: halfGains.lossAllowed,
        socialSecurity: typed("socialSecurity") ? socialSecurity / 2 : sumFor(p, ["social"]), taxExemptInterest: taxExemptInterest / 2,
        adjustments: adjustmentsTyped / 2 + ira.deductible + hsaDeducted,
        ages65plus: ageAtYearEnd(p) !== null && ageAtYearEnd(p) >= 65 ? 1 : 0, blind: p === me ? Math.min(1, blindAll) : Math.max(0, blindAll - 1),
        dependentsUnder17: p === carrier ? dependentsUnder17 : 0, otherDependents: p === carrier ? otherDependents : 0,
        withheld: base.withheld / 2, paid: paid / 2, selfEmployment: ownBusiness,
        investmentIncome: Math.max(0, sumFor(p, ["investment"]) + qualifiedTyped / 2 + halfGains.netShort + halfGains.netLong + halfGains.lossAllowed),
        charitableCash: base.charitableCash / 2,
      };
      const partAgi = federalTax({ ...part, itemized: 0 }, P).agi;
      return { personId: p.id, name: p.name, ...part, itemized: itemizedTotal(halfItemized, partAgi, filingStatus, P).total };
    });
    const sums = Object.fromEntries(SEPARATE_FIELDS.map((f) => [f, separate.reduce((s, x) => s + (Number(x[f]) || 0), 0)]));
    inputs = { ...inputs, ...sums, separate, separateTo: me ? me.id : separate[0].personId };   // an amount another page adds lands on Me's return
    notes.push(`Filing separately is two returns: ${separate.map((x) => x.name).join("'s and ")}'s, each with their own pay, saving and income; income in neither name and the figures typed here are split in half${dependentsUnder17 + otherDependents > 0 ? `, and ${dependentsUnder17 + otherDependents === 1 ? "the child is" : "the children are"} on ${carrier.name}'s return` : ""}.`);
  }
  if (!active.length && !typed("wages")) notes.push("Nothing on the Income page yet: the estimate is built from what you type below.");
  if (adults.length >= 2 && filingStatus === "single") notes.push("Two adults but the filing status is Single (People page). Married couples usually file together.");
  if (filingStatus === "married_separate" && socialSecurity > 0 && !livedApart) notes.push("Filing separately while living together, up to 85% of Social Security is taxed from the first dollar. If you and your spouse lived apart all year, tick that under Year and people.");
  return {
    year, params: P, filingStatus, livedApart, inputs, sources, notes, itemized, people: { ages65plus, dependentsUnder17, otherDependents, adults: adults.length }, pretax401k, gains, separate,
    standard: separate ? separate.reduce((s, x) => s + standardDeduction(filingStatus, P, { ages65plus: x.ages65plus, blind: x.blind }), 0) : standardDeduction(filingStatus, P, { ages65plus, blind: inputs.blind }),
    k401: { people: k401People, excluded: pretax401k, inIncome: k401Over, year: L.kindYear["401k"] },
    ira: { people: iraPeople, deductible: iraDeductible, over: iraOver, year: L.kindYear.ira },
    fsa: { election: fsaElection, limit: Number.isFinite(fsaLimit) ? fsaLimit : null, excluded: fsaExcluded, over: Math.max(0, fsaElection - fsaExcluded), offWages: wagesTyped ? 0 : fsaExcluded, year: L.kindYear.fsa ?? null },
    hsa: { picture: hsa, payroll: hsaPayroll, employer: hsa.household.employer, excess: hsaExcess, deducted: hsaContrib, employerTaxed: wagesTyped ? 0 : hsaEmployerTaxed },
    payTotal, wagesTyped,
  };
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

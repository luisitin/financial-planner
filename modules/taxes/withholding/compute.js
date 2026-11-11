// modules/taxes/withholding/compute.js -- PURE. Whether this year's paychecks are taking out
// enough federal tax: what has been withheld so far plus what the rest of the year's paychecks
// will take, against the year's estimated tax; the refund or bill at filing time; the W-4
// change that would land it near zero; and the safe-harbour rule that avoids a penalty.
import { compute as computeFederal, ratePct, businessOn } from "../federal/compute.js";
import { compute as computeSelfEmployment, seTax, SE, QBI } from "../self-employment/compute.js";
import { compute as computePaycheck } from "../../cashflow/paycheck/compute.js";
import { QBI_MINIMUM, forYear } from "../../career/business/data/business.js";
import { federalTax } from "../../../core/math/tax.js";
import { PERIODS } from "../../../core/math/periods.js";
import { daysBetween } from "../../../core/math/dates.js";
import { known } from "../federal/known.js";

/**
 * The smallest amount of withholding plus estimated payments that avoids the underpayment penalty:
 * 90% of this year's tax, or 100% of last year's (110% when last year's income was over 150,000; 75,000 filing separately), whichever is less.
 * Nothing is owed at all when the balance after withholding is under 1,000.
 */
export function safeHarbour(thisYearTax, priorTax, priorAgi, filingStatus) {
  const ninety = 0.9 * Math.max(0, thisYearTax);
  const priorShare = (Number(priorAgi) || 0) > (filingStatus === "married_separate" ? 75000 : 150000) ? 1.1 : 1;   // IRC 6654(d)(1)(C)
  const prior = priorTax !== null && priorTax !== undefined && priorTax !== "" ? Math.max(0, Number(priorTax)) * priorShare : null;
  const required = prior === null ? ninety : Math.min(ninety, prior);
  return { required, ninety, prior, priorShare, basis: prior !== null && prior <= ninety ? "last year" : "this year", label: prior !== null && prior <= ninety ? `${Math.round(priorShare * 100)}% of last year's tax` : "90% of this year's" };
}

/**
 * Paychecks left in `year` after `today` for a pay period: a whole year before the year starts, none once it is over
 * (January's paychecks count for the next year: tax withheld in a calendar year is a credit for the year beginning in it, IRC 31(a)(2)).
 */
export function paychecksLeft(period, today, year) {
  const perYear = (PERIODS[period] ?? PERIODS.biweekly).perYear || 12;
  const todayYear = today ? Number(String(today).slice(0, 4)) : null;
  if (!today || todayYear < year) return perYear;
  if (todayYear > year) return 0;
  const daysLeft = Math.max(0, daysBetween(today, `${year}-12-31`));
  return Math.max(0, Math.min(perYear, Math.floor(daysLeft / 365.25 * perYear)));
}

/**
 * projectedWithholding(plan, { today }) -> { projected, soFar, rest, people: [{ key, personId, name, perPaycheck, period, left, rest, yearly }], hasSetup }
 * "So far" is the figure typed on the Federal estimate page; when it is blank, the whole year runs at the per-paycheck rate.
 * A typed 0 counts as typed (`taxes.thisYear.withheldTyped`, set when the field is saved with a figure; plans from before
 * the flag only count a figure above 0).
 */
export function projectedWithholding(plan, params = {}) {
  const today = params.today ?? null;
  const t = plan.taxes ?? {};
  const year = Number(t.year) || (today ? Number(String(today).slice(0, 4)) : new Date().getFullYear());
  const soFar = Math.max(0, Number(t.thisYear?.withheld) || 0);
  const soFarTyped = t.thisYear?.withheldTyped === true || soFar > 0;
  const w = t.withholding ?? {};
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const people = [];
  for (const key of ["self", "partner"]) {
    const cfg = w[key]; if (!cfg || !(Number(cfg.perPaycheck) > 0)) continue;
    const period = PERIODS[cfg.period] ? cfg.period : "biweekly";
    const left = paychecksLeft(period, today, year);
    const perYear = PERIODS[period].perYear;
    const who = key === "self" ? adults.find((p) => p.role === "self") ?? adults[0] : adults.find((p) => p.role !== "self");
    people.push({ key, personId: who?.id ?? null, name: who?.name ?? (key === "self" ? "You" : "Partner"), perPaycheck: Number(cfg.perPaycheck), period, left, rest: Number(cfg.perPaycheck) * left, yearly: Number(cfg.perPaycheck) * perYear });
  }
  const rest = people.reduce((s, p) => s + p.rest, 0);
  const projected = soFarTyped ? soFar + rest : people.reduce((s, p) => s + p.yearly, 0);
  return { projected, soFar, soFarTyped, rest, people, hasSetup: people.length > 0 || soFar > 0, year };
}

/**
 * withholdingEstimate(plan, { today }) -> { projected, from: "typed"|"paycheck"|"mixed"|"none", people: [{ key, personId, name, perPaycheck,
 * period, paychecks, yearly, left, estimated }], detail (projectedWithholding, with `projected` replaced when anything is estimated) }
 * The one figure every tax page uses for "what the paychecks take out this year", earner by earner: the per-paycheck figure
 * typed on this page for anyone who has one; for an earner with none, the Paycheck page's federal withholding worked out
 * from pay the way payroll does (IRS Pub. 15-T percentage method). With the year so far typed, the estimated earners add
 * their paychecks left to it (the so-far figure is the household's); without it, a whole year each. Estimated payments,
 * the Federal estimate, Quick answers and Needs attention read it, so "refund or owe" is one answer everywhere. (Until a
 * review on 2026-11-02 one typed earner made the other's withholding $0, and a typed year so far alone counted no more
 * paychecks.)
 */
export function withholdingEstimate(plan, params = {}, k = null) {
  const out = withholdingFromPay(plan, params);
  // stock vesting this year (the Federal estimate's figures, known.js stockStep): the employer holds back 22% and the 0.9%
  // Medicare tax from it; with the year so far typed (from pay stubs, which show the vests already paid) only the vests still
  // to come are added (round 8, equity-2)
  let kk = k;
  if (!kk && (plan.equity?.grants ?? []).length) { try { kk = known(plan, params); } catch { kk = null; } }
  const st = kk?.stock ?? null;
  if (!st || !(st.withheld > 0)) return out;
  const stock = out.detail.soFarTyped ? st.withheldAfter : st.withheld;
  if (!(stock > 0)) return out;
  const projected = out.projected + stock;
  return { ...out, projected, from: out.from === "none" ? "paycheck" : out.from, stock, detail: { ...out.detail, projected } };
}

/** withholdingEstimate before stock vesting: the paychecks alone. */
function withholdingFromPay(plan, params = {}) {
  const wh = projectedWithholding(plan, params);
  let pc = null;
  try { pc = computePaycheck(plan, params); } catch { pc = null; }
  const BY_COUNT = { 52: "weekly", 26: "biweekly", 24: "semimonthly", 12: "monthly" };
  const typed = new Set(wh.people.map((p) => p.key));
  const est = (pc?.ready ? pc.people : []).filter((p) => Number(p.yearly?.federal) > 0 && !typed.has(p.key)).map((p) => {
    const period = PERIODS[p.period]?.perYear === p.paychecks ? p.period : BY_COUNT[p.paychecks] ?? "biweekly";
    const left = paychecksLeft(period, params.today ?? null, wh.year);
    return { key: p.key, personId: p.id ?? null, name: p.name, perPaycheck: Number(p.federal?.amount) || 0, period, paychecks: p.paychecks, yearly: Number(p.yearly.federal), left, estimated: true };
  });
  const typedPeople = wh.people.map((p) => ({ key: p.key, personId: p.personId, name: p.name, perPaycheck: p.perPaycheck, period: p.period, paychecks: PERIODS[p.period]?.perYear ?? null, yearly: p.yearly, left: p.left, estimated: false }));
  if (!est.length) return { projected: wh.projected, from: wh.hasSetup ? "typed" : "none", people: typedPeople, detail: wh };
  // nothing typed at all: the whole year from pay, earner by earner
  if (!wh.hasSetup) { const yearly = est.reduce((t, p) => t + p.yearly, 0); return { projected: yearly, from: "paycheck", people: est, detail: { ...wh, projected: yearly } }; }
  const projected = wh.soFarTyped ? wh.soFar + wh.rest + est.reduce((t, p) => t + p.perPaycheck * p.left, 0) : wh.people.reduce((t, p) => t + p.yearly, 0) + est.reduce((t, p) => t + p.yearly, 0);
  return { projected, from: "mixed", people: [...typedPeople, ...est], detail: { ...wh, projected } };
}

/**
 * businessOwners(s, year, scale = 1) -> [{ personId, profit, half, qbi, qbiMinimum, se }]: the Self-employment page's rows
 * (`s`, computeSelfEmployment) as federal businessOn takes them: each owner's profit (times `scale`), half its self-employment
 * tax (IRC 164(f)), 20% of the profit less that half before the engine's taxable-income limit (IRC 199A) and 199A(i)'s floor
 * for `year`, and the self-employment tax itself (`se`, seTax). [] without a business. Withholding check, the Federal
 * estimate's two returns, Benefits and Offer compare all put the business on its owner's return with these (Review
 * 2026-11-06: Benefits and Offer compare counted it in full as ordinary income).
 */
export function businessOwners(s, year, scale = 1) {
  if (!s?.ready) return [];
  const M = forYear(QBI_MINIMUM, year);
  return s.people.map((r) => {
    const net = r.net * scale, t = seTax(net, { wages: r.wages, wageBase: s.wageBase }), qb = Math.max(0, net - t.half);
    return { personId: r.id, profit: net, half: t.half, qbi: QBI.rate * qb, qbiMinimum: qb >= M.from ? M.amount : 0, se: t };
  });
}

/**
 * withBusiness(plan, inputs, { today, year }) -> `inputs` (the Federal estimate's, taxInputs) with the Income page's business
 * at its profit on its owner's return, half its self-employment tax and its 20% deduction off (federal businessOn with
 * businessOwners), for a page that works the federal tax on its own: unchanged without a business.
 */
export function withBusiness(plan, inputs, { today = null, year = null } = {}) {
  const y = Number(year) || null;
  const p = y && Number(plan?.taxes?.year) !== y ? { ...plan, taxes: { ...(plan.taxes ?? {}), year: y } } : plan;
  let s = null;
  try { s = computeSelfEmployment(p, { today }); } catch { s = null; }
  const owners = businessOwners(s, y ?? s?.year);
  return owners.length ? businessOn(inputs, owners) : inputs;
}

/**
 * separateBusiness(plan, fed, params) -> the Self-employment page's figures (computeSelfEmployment) worked on separate
 * returns, each owner's business on their own return (IRS Pub. 501): the profit (the page's expenses shared by gross),
 * half its self-employment tax off that return's income (IRC 164(f)) and its 20% deduction after that return's AGI (IRC
 * 199A, with 199A(i)'s floor), through the Federal estimate's two returns (federal businessOn); the 0.9% Additional Medicare
 * tax on each return's own Medicare wages and self-employment earnings against the separate threshold (Form 8959 Part II).
 * `taxWith` is the returns added up with the self-employment tax; `returns` each return's own ({ personId, name, incomeTax,
 * se, addl, total }), so "the two added up" is exact. Not filing separately (or no business): the Self-employment page's own
 * figures. (That page works one household return; its gap on separate returns is the other builder's: care fourth pass.)
 */
export function separateBusiness(plan, fed, params = {}) {
  const s = computeSelfEmployment(plan, params);
  const parts = fed?.inputs?.separate;
  if (!s.ready || fed?.filingStatus !== "married_separate" || !Array.isArray(parts) || !parts.length) return s;
  const P = fed.params;
  const th = P.additionalMedicareThreshold?.married_separate ?? 125000;
  const ids = parts.map((x) => x.personId);
  const to = Math.max(0, parts.findIndex((x) => x.personId != null && x.personId === fed.inputs.separateTo));
  const at = (id) => (ids.includes(id) ? ids.indexOf(id) : to);
  const work = (scale) => {
    const owners = businessOwners(s, fed.year, scale);
    const r = federalTax(businessOn(fed.inputs, owners), P);
    const returns = (r.separate ?? []).map((x, i) => {
      const mine = owners.filter((o) => at(o.personId) === i);
      const se = mine.reduce((t, o) => t + o.se.total, 0), base = mine.reduce((t, o) => t + o.se.base, 0);
      const mw = Number(parts[i].medicareWages ?? parts[i].wages) || 0;
      const addl = SE.addlMedicare * (Math.max(0, mw + base - th) - Math.max(0, mw - th));
      return { personId: x.personId, name: x.name, incomeTax: x.totalTax, se, addl, total: x.totalTax + se + addl, half: mine.reduce((t, o) => t + o.half, 0), qbi: x.deduction.qbi,
        gross: x.income?.gross ?? null, taxableIncome: x.taxableIncome, bracketRate: x.bracketRate, deduction: x.deduction };
    });
    return { returns, total: returns.reduce((t, x) => t + x.total, 0) };
  };
  const now = work(1), plus = s.net > 0 ? work((s.net + 100) / s.net) : null;
  const taxWithout = federalTax(businessOn(fed.inputs, []), P).totalTax;
  const add = (k) => now.returns.reduce((t, x) => t + x[k], 0);
  const businessTax = now.total - taxWithout;
  return {
    ...s, separate: true, returns: now.returns, taxWithout, taxWith: now.total, businessTax, seTotal: add("se"), addlMedicare: add("addl"), half: add("half"), qbi: add("qbi"),
    effectiveRate: s.net > 0 ? businessTax / s.net : 0, keepPer100: plus ? 100 - (plus.total - now.total) : s.keepPer100, quarterly: businessTax / 4,
  };
}

/**
 * yearTax(plan, fed, { today }) -> { total, income, se, seOwn, owed, back }: the year's federal tax to pay. `income` is the Federal
 * estimate's total (income tax only; it counts business income as ordinary income); with business income on the Income page,
 * `total` is the Self-employment page's figure instead: the same tax with the 15.3% self-employment tax (IRC 1401) and its
 * two deductions (half of it, IRC 164(f); 20% of qualified business income, IRC 199A), and `se` the difference. Safe harbour
 * and Form 2210 count self-employment tax as part of the year's tax. Both are below zero when refundable credits (the
 * refundable child tax credit) are more than the tax, as the walk's last line has it: the refund counts them (review
 * 2026-11-02: it used to stop at 0, so a refund left them out). `owed` is the tax, at least 0; `back` the credits past it.
 */
export function yearTax(plan, fed, params = {}, k = null) {
  const income = Number(fed?.result?.totalTax) || 0;
  // the year's tax as the Federal estimate shows it (known.js): the answer keys' return with what the plan knows put in (the
  // business at its profit with its self-employment tax, rentals after costs, this year's required withdrawal, stock pay,
  // the IRA and student loan deductions as the law allows them). Without any of those it is the keys' total itself.
  const kk = k ?? known(plan, params, fed);
  const total = kk.total;
  // the self-employment tax itself (with its Additional Medicare tax), as the Federal estimate's walk says it: `se` is the
  // business's whole effect on the tax, its deductions taken off (total less the same with the business at its gross),
  // which alerts and the answer keys read (Review 2026-11-06: Withholding check said "$796 of it self-employment tax"
  // against the Federal estimate's $1,017)
  const seOwn = kk.se ? kk.seTax : 0;
  const se = kk.se ? total - kk.totalAtGross : 0;
  return { total, income, se, seOwn, owed: Math.max(0, total), back: Math.max(0, -total), known: kk };
}

/**
 * How much more one earner could take home per paycheck from a W-4 change, when the year ends in a refund: only what the
 * paychecks (and payments) take out beyond the year's tax, `over` (refundable credits are left out: they come back whatever
 * the W-4 says), spread over the paychecks left, and never more than each paycheck withholds (`person.perPaycheck`): a W-4
 * can only take withholding down to nothing.
 *   step3    that cut as a W-4 Step 3 amount, a yearly figure (the paychecks a year at it; IRS Pub. 15-T divides Step 3 by
 *            the pay periods): right for the paychecks left this year only.
 *   january  the Step 3 amount for a whole year. A W-4 stays in force until it is changed, so the rest-of-year figure would
 *            leave next year short (Review 2026-11-06: 4,186 in Step 3 for Jo's 4 paychecks left would take next year's
 *            withholding down to 938 less than her tax): the smallest of `over`, `full` (what a whole year of paychecks at
 *            today's rates takes out beyond the year's tax; estimated payments are left out, next year's are not known;
 *            `over` when not given) and a year of this paycheck's withholding, never below 0, whole dollars down. Next
 *            year's tax is taken as this year's, so it is "about".
 *   one      January's amount, used for the paychecks left, already leaves less than 500 of refund this year (the page's
 *            "about right"): the page gives that one figure, for this year and next.
 * -> { perPaycheck, step3, january, one, all (the whole of what each paycheck withholds) } | null when there is nothing to cut.
 */
export function takeHomeMore(over, person, full = over) {
  const left = Number(person?.left) || 0, each = Math.max(0, Number(person?.perPaycheck) || 0);
  if (!(left > 0) || !(over > 0)) return null;
  const perPaycheck = Math.floor(Math.min(over / left, each));
  if (!(perPaycheck >= 1)) return null;
  const perYear = PERIODS[person.period]?.perYear ?? (Number(person.paychecks) || left);
  const fullYear = Number.isFinite(Number(full)) ? Number(full) : over;
  const january = Math.max(0, Math.floor(Math.min(over, fullYear, each * perYear)));
  const one = over - Math.min(each, january / perYear) * left < 500;
  return { perPaycheck, step3: Math.round(perPaycheck * perYear), january, one, all: over / left >= each - 0.5 };
}

/**
 * step3Words(cut, left, { year, typed, whose }) -> the W-4 words for a cut (takeHomeMore's figures), in plain words.
 * One figure (`one`): January's Step 3 amount, for this year and next. Otherwise two: the rest-of-year amount for the `left`
 * paychecks, and the whole-year amount to change it to in January of the next year (`year` + 1), so next year is not left
 * short (Review 2026-11-06). `typed`: the typed-paycheck sentence (with "or the matching amount in Step 4(b)"). `whose` names
 * the earner ("Bo's") for "a new W-4".
 */
export function step3Words(x, left, { year = null, typed = false, whose = null } = {}) {
  const n = (v) => `$${Math.round(v).toLocaleString("en-US")}`;
  const form = whose ? `${whose} new W-4` : "a new W-4";
  const alt = typed ? " (credits), or the matching amount in Step 4(b) (deductions)," : "";
  if (x.one) return `About ${n(x.january)} in Step 3 of ${form}${alt} brings your take-home pay up and the refund down, this year and next.`;
  const later = x.january >= 1 ? `change Step 3 to about ${n(x.january)}` : "set Step 3 back to 0";
  return `For the ${left} paycheck${left === 1 ? "" : "s"} left this year, about ${n(x.step3)} in Step 3 of ${form}${alt} brings your take-home pay up and the refund down. In January${year ? ` ${Number(year) + 1}` : ""}, ${later}, or next year's paychecks would take out too little (a W-4 stays until you change it).`;
}

/**
 * addJanuary(short, person, perPaycheck) -> the Step 4(c) extra a paycheck for a whole year, for when a W-4 asks for
 * `perPaycheck` more for the paychecks left: a W-4 stays until it is changed, so the rest-of-year extra would keep coming out
 * next year (Review 2026-11-06, the same root as the Step 3 figure). `short` is what a whole year of paychecks at today's
 * rates leaves of the year's tax: ceil(short / the paychecks a year), 0 when they cover it. null when that is within 500 a
 * year of `perPaycheck` (the page's "about right"): the one figure does for both years.
 */
export function addJanuary(short, person, perPaycheck) {
  const perYear = PERIODS[person?.period]?.perYear ?? (Number(person?.paychecks) || 0);
  if (!(perYear > 0)) return null;
  const january = short > 0 ? Math.ceil(short / perYear) : 0;
  return Math.abs((Number(perPaycheck) || 0) - january) * perYear < 500 ? null : january;
}

/** The January words for an extra asked for the paychecks left (addJanuary's figure), money as `n` writes it; "" for null. */
export const addJanuaryWords = (january, year, n = (v) => `$${Math.round(v).toLocaleString("en-US")}`) => january === null || january === undefined ? ""
  : `In January${year ? ` ${Number(year) + 1}` : ""}, ${january >= 1 ? `change the extra to about ${n(january)} a paycheck` : "take the extra off again"}: a W-4 stays until you change it.`;

/**
 * byReturn(plan, fed, est, { paid, priorTax, priorAgi, hasSetup, params }) -> null | [{ personId, name, tax, owed, back,
 * withheld, paid, balance, verdict, balanceAfterWithholding, harbour, toPayByEstimates, needsEstimates, penaltyRisk, people,
 * suggestion }]
 * Filing separately, each return settles on its own (Review 2026-11-06: the pages added the two returns up, so Ana's 2,200
 * refund hid Bo's 1,660 bill and his own penalty test). A return's tax is its own (fullSteps `returns`: a business, its
 * self-employment tax and deductions on its owner's; below 0 when refundable credits are more than it). Withholding is a
 * credit on the return of the person it was withheld from (IRC 31(a); Pub. 505, "Separate returns"): each earner's own
 * paychecks (`est.people`, withholdingEstimate), the household's typed "so far" shared by each earner's paycheck rate (the
 * page keeps one figure for the household: "about"). Estimated and other payments (`paid`, the household's) are divided as
 * the couple may agree (Pub. 505: "One of you can claim all of the estimated tax paid and the other none, or you can divide
 * it in any other way you agree on"): to the returns that owe, by what each owes, any beyond that by each return's tax.
 * Each return's safe amount is its own (safeHarbour on its tax, last year's tax shared by this year's: Pub. 505's share of a
 * joint return's tax, with this year's returns standing in for last year's), with the $1,000 test on its own withholding.
 * The household's figures (compute's balance, verdict, estimate; Estimated payments' schedule) stay as the answer key has
 * them (tests/golden/estimated RULES.md section 1: it keeps withholding and estimates the household's); the pages say
 * these. null unless filing separately with two returns.
 *   suggestion: the W-4 change on that return's main earner (the largest paychecks with some left): { kind: "add", name,
 *   perPaycheck, paychecks } when it owes, { kind: "cut", name, takeHome, paychecks, step3, january, one, all } when it gets
 *   money back (takeHomeMore on its own over-withholding), { kind: "estimates" } owing with no paycheck left, else "none".
 */
export function byReturn(plan, fed, est, { paid = 0, priorTax = null, priorAgi = null, hasSetup = true, params = {}, k = null } = {}) {
  if (fed?.filingStatus !== "married_separate" || !est) return null;
  const rets = fullSteps(plan, fed, params, k).returns;
  if (!Array.isArray(rets) || rets.length < 2) return null;
  const ids = rets.map((r) => r.personId);
  const me = Math.max(0, ids.indexOf(fed.inputs?.separateTo));
  const at = (id) => (id != null && ids.includes(id) ? ids.indexOf(id) : me);
  const det = est.detail ?? {};
  const people = est.people ?? [];
  const sumYearly = people.reduce((t, p) => t + (Number(p.yearly) || 0), 0);
  const soFar = det.soFarTyped ? Math.max(0, Number(det.soFar) || 0) : 0;
  const ownOf = (p) => (est.from === "paycheck" || !det.soFarTyped ? Number(p.yearly) || 0 : (sumYearly > 0 ? soFar * p.yearly / sumYearly : 0) + (Number(p.perPaycheck) || 0) * (Number(p.left) || 0));
  const owedOf = rets.map((r) => Math.max(0, Number(r.total) || 0));
  const owedAll = owedOf.reduce((t, x) => t + x, 0);
  const withheld = rets.map(() => 0);
  for (const p of people) withheld[at(p.personId)] += ownOf(p);
  // what is withheld but cannot be put on an earner (a "so far" typed with no paycheck figure): by each return's tax
  const rest = (Number(est.projected) || 0) - withheld.reduce((t, x) => t + x, 0);
  if (Math.abs(rest) > 0.005) rets.forEach((r, i) => { withheld[i] += rest * (owedAll > 0 ? owedOf[i] / owedAll : 1 / rets.length); });
  // payments: to the returns that owe, by what each owes; any beyond that by each return's tax
  const short = rets.map((r, i) => Math.max(0, (Number(r.total) || 0) - withheld[i]));
  const shortAll = short.reduce((t, x) => t + x, 0);
  const P = Math.max(0, Number(paid) || 0);
  const toShort = Math.min(P, shortAll);
  const pay = short.map((x, i) => (shortAll > 0 ? toShort * x / shortAll : 0) + (P - toShort) * (owedAll > 0 ? owedOf[i] / owedAll : 1 / rets.length));
  const prior = priorTax !== null && priorTax !== undefined && priorTax !== "" ? Math.max(0, Number(priorTax) || 0) : null;
  return rets.map((r, i) => {
    const tax = Number(r.total) || 0, owed = owedOf[i];
    const balance = tax - withheld[i] - pay[i];
    const harbour = safeHarbour(owed, prior === null ? null : prior * (owedAll > 0 ? owed / owedAll : 1 / rets.length), priorAgi, "married_separate");
    const toPayByEstimates = Math.max(0, harbour.required - withheld[i]);
    const mine = people.filter((p) => at(p.personId) === i);
    const lead = [...mine].filter((p) => p.left > 0).sort((a, b) => b.yearly - a.yearly)[0] ?? null;
    const verdict = !hasSetup && !mine.length ? "unknown" : Math.abs(balance) < 500 ? "about right" : balance > 0 ? "owe" : "refund";
    let suggestion = { kind: "none" };
    if (verdict === "owe") suggestion = lead ? { kind: "add", name: lead.name, perPaycheck: Math.ceil(balance / lead.left), paychecks: lead.left, january: addJanuary(owed - mine.reduce((t, p) => t + (Number(p.yearly) || 0), 0), lead, Math.ceil(balance / lead.left)) } : { kind: "estimates", noPay: !mine.length };
    else if (verdict === "refund" && lead) {
      const cut = takeHomeMore(withheld[i] + pay[i] - owed, lead, mine.reduce((t, p) => t + (Number(p.yearly) || 0), 0) - owed);
      if (cut) suggestion = { kind: "cut", name: lead.name, perPaycheck: cut.perPaycheck, takeHome: cut.perPaycheck, paychecks: lead.left, step3: cut.step3, january: cut.january, one: cut.one, all: cut.all };
    }
    return {
      personId: r.personId, name: r.name, tax, owed, back: Math.max(0, -tax), withheld: withheld[i], paid: pay[i], balance, verdict, balanceAfterWithholding: tax - withheld[i],
      harbour, toPayByEstimates, needsEstimates: tax - withheld[i] >= 1000 && toPayByEstimates > 0,
      penaltyRisk: hasSetup && owed - withheld[i] >= 1000 && withheld[i] + pay[i] < harbour.required, people: mine.map((p) => p.name), suggestion,
    };
  });
}

/**
 * compute(plan, { today }) -> {
 *   year, totalTax (yearTax: self-employment tax included; at least 0), creditsBack (refundable credits past the tax), incomeTax, seTax
 *   (the business's whole effect on the tax), seOwn (its self-employment tax: what the page says),
 *   withholding: projectedWithholding, estimatedPaid, balance (tax - withholding - estimates, the credits past the tax included; + owe, - refund),
 *   verdict: "about right" | "refund" | "owe" | "unknown", harbour, penaltyRisk,
 *   suggestion: { kind: "add" | "cut" | "none", perPaycheck, paychecks, text } for the main earner's W-4,
 *   notes, hasIncome, estimate: withholdingEstimate plus { balance, verdict, suggestion, returns (filing separately: byReturn) } (the typed figures, else estimated from pay)
 * }
 */
export function compute(plan, params = {}) {
  const fed = computeFederal(plan, params);
  const wh = projectedWithholding(plan, params);
  const t = plan.taxes ?? {};
  const yt = yearTax(plan, fed, params);
  // the balances count the refundable credits past the tax (yt.total below 0); the figure said as "the tax" is at least 0
  const signedTax = yt.total, totalTax = yt.owed;
  const estimatedPaid = (t.estimated?.paid ?? []).reduce((s, x) => s + (Math.max(0, Number(x)) || 0), 0);
  const balance = signedTax - wh.projected - estimatedPaid;
  const harbour = safeHarbour(totalTax, t.priorYear?.tax, t.priorYear?.agi, fed.filingStatus);
  // the $1,000 test counts withholding only, not estimated payments (IRC 6654(e)(1); Form 2210 line 6); nothing to say until a paycheck figure is in
  const penaltyRisk = wh.hasSetup && totalTax - wh.projected >= 1000 && wh.projected + estimatedPaid < harbour.required;
  const verdict = !wh.hasSetup ? "unknown" : Math.abs(balance) < 500 ? "about right" : balance > 0 ? "owe" : "refund";
  const main = wh.people[0] ?? null;
  let suggestion = { kind: "none", perPaycheck: 0, paychecks: 0, text: "" };
  // a whole year of the typed paychecks at today's rate, against the year's tax: January's W-4 figure (takeHomeMore `full`)
  const fullTyped = wh.people.reduce((t, p) => t + p.yearly, 0) - totalTax;
  const cutTyped = main && main.left > 0 && verdict === "refund" ? takeHomeMore(wh.projected + estimatedPaid - totalTax, main, fullTyped) : null;
  if (main && main.left > 0 && verdict === "owe") {
    const january = addJanuary(totalTax - wh.people.reduce((t, p) => t + p.yearly, 0), main, Math.ceil(balance / main.left));
    suggestion = { kind: "add", perPaycheck: Math.ceil(balance / main.left), paychecks: main.left, january, text: `Ask for $${Math.ceil(balance / main.left).toLocaleString("en-US")} more per paycheck on a new W-4 (Step 4(c), "extra withholding") for the ${main.left} paychecks left, and the bill disappears.${january === null ? "" : ` ${addJanuaryWords(january, fed.year)}`}` };
  }
  // `perPaycheck` stays the refund over the paychecks left (the answer key's figure, tests/golden: it has no cap); what the page
  // says is `takeHome` (takeHomeMore: the credits left out, never more than a paycheck withholds; care fourth pass)
  else if (main && main.left > 0 && verdict === "refund") suggestion = { kind: "cut", perPaycheck: Math.floor(-balance / main.left), paychecks: main.left, takeHome: cutTyped?.perPaycheck ?? 0, step3: cutTyped?.step3 ?? 0, january: cutTyped?.january ?? 0, one: !!cutTyped?.one, all: !!cutTyped?.all,
    text: cutTyped ? `You are lending the IRS about $${cutTyped.perPaycheck.toLocaleString("en-US")} a paycheck${cutTyped.all ? ", all of what each paycheck takes out" : ""}. ${step3Words(cutTyped, main.left, { typed: true, year: fed.year })}` : "The refund is credits that come back whatever the W-4 says: nothing to change on it." };
  else if (verdict === "owe" && !main) suggestion = { kind: "estimates", perPaycheck: 0, paychecks: 0, text: "No paycheck figure is typed yet, so the rest of the year counts nothing withheld. If tax comes out of your pay, type one paycheck's tax under What a paycheck withholds; if not, the Estimated payments page splits the bill into the four quarterly payments." };
  const notes = [];
  // any income counted, this year's withdrawals from the plan included (known.js), not the Income page alone (round 8 review:
  // a retiree living on IRA withdrawals read "No income on file" beside 6,953 of tax)
  const hasIncome = yt.known.hasIncome;
  if (!hasIncome) notes.push("No income on file yet: add it on the Income page or type it on the Federal estimate page.");
  if (!wh.hasSetup && hasIncome) notes.push("Type the federal tax taken from one paycheck (the \"Federal income tax\" line on the stub) below, and what has been withheld so far this year on the Federal estimate page.");
  // the best answer the plan has: the typed figures, else withholding estimated from pay (`estimate`); `balance` and `verdict`
  // above stay on the typed figures only (the answer key checks them), the page leads with `estimate`
  const est = withholdingEstimate(plan, params, yt.known);
  // other payments typed on the Federal estimate (an extension payment, last year's overpayment applied) count as paid too,
  // as the Federal estimate's own walk counts them
  const otherPaid = Math.max(0, Number(t.thisYear?.paid) || 0);
  const estBalance = signedTax - est.projected - estimatedPaid - otherPaid;
  const estimate = { ...est, otherPaid, balance: estBalance, verdict: est.from === "none" ? "unknown" : Math.abs(estBalance) < 500 ? "about right" : estBalance > 0 ? "owe" : "refund" };
  // the W-4 change on the estimate: the extra per paycheck on the main earner's paychecks left (as the typed suggestion does)
  const lead = [...est.people].filter((p) => p.left > 0).sort((a, b) => b.yearly - a.yearly)[0] ?? null;
  const cutEst = lead && estimate.verdict === "refund" ? takeHomeMore(est.projected + estimatedPaid + otherPaid - totalTax, lead, est.people.reduce((t, p) => t + p.yearly, 0) - totalTax) : null;
  estimate.suggestion = lead && estimate.verdict === "owe" ? { kind: "add", name: lead.name, perPaycheck: Math.ceil(estBalance / lead.left), paychecks: lead.left, january: addJanuary(totalTax - est.people.reduce((t, p) => t + p.yearly, 0), lead, Math.ceil(estBalance / lead.left)) }
    : cutEst ? { kind: "cut", name: lead.name, perPaycheck: cutEst.perPaycheck, takeHome: cutEst.perPaycheck, paychecks: lead.left, step3: cutEst.step3, january: cutEst.january, one: cutEst.one, all: cutEst.all } : { kind: "none" };
  // filing separately: each return's own balance, safe amount and W-4 change (byReturn; the household figures above stay)
  estimate.returns = byReturn(plan, fed, est, { paid: estimatedPaid + otherPaid, priorTax: t.priorYear?.tax ?? null, priorAgi: t.priorYear?.agi ?? null, hasSetup: est.from !== "none", params, k: yt.known });
  return { year: fed.year, totalTax, creditsBack: yt.back, incomeTax: yt.income, seTax: yt.se, seOwn: yt.seOwn, withholding: wh, estimatedPaid, balance, verdict, harbour, penaltyRisk, suggestion, notes, hasIncome,
    // the share of income the year's tax is, as the Federal estimate says it (known.js `rate`: with what the plan knows, the
    // self-employment tax in it), not the answer keys' return (round 8 review: the widow's "1.1% of income" beside 6.0%)
    effectiveRate: yt.known.rate, wages: yt.known.result.income.wages, estimate };
}

/**
 * fullSteps(plan, fed, params) -> { steps, total, rate (total / income), returns (filing separately: each return's own tax,
 * self-employment tax on its owner's: { personId, name, incomeTax, se, addl, total }; else null), se: { tax (self-employment tax, Additional Medicare
 * on it included), half, qbi, expenses, nextDollar (what the next dollar of business profit costs in all, a fraction) } | null }. The Federal estimate's walk from income to tax (`fed.steps`), and with
 * self-employment income the business rows before its "Federal tax" line, so the walk ends at the year's whole federal
 * tax (yearTax: what Withholding check, Quick answers and Needs attention say): the business counted at its profit with
 * half the self-employment tax and the 20% business deduction off income, then the self-employment tax itself.
 * fed.result is not touched (the answer keys check it).
 */
export function fullSteps(plan, fed, params = {}, k = null) {
  const kk = k ?? known(plan, params, fed);
  if (!kk.se) return { steps: kk.steps.map((x) => ({ ...x })), total: kk.total, rate: kk.rate, se: null, returns: kk.returns };
  // the next dollar of business profit: 100 less what is kept of each 100 more (the Self-employment page's figure; filing
  // separately, worked on the owner's return)
  const sb = separateBusiness(plan, fed, params);
  return { steps: kk.steps.map((x) => ({ ...x })), total: kk.total, rate: kk.rate, returns: kk.returns,
    se: { tax: kk.seTax, half: kk.se.half, qbi: Number(kk.result.deduction?.qbi) || 0, expenses: kk.se.expenses, nextDollar: Math.max(0, 100 - (sb.keepPer100 ?? 100)) / 100 } };
}

/**
 * taxAnswer(plan, { today }) -> { year, totalTax (at least 0), creditsBack, seTax, seOwn (the self-employment tax itself, for words), projected, from, paid (estimated and other payments), balance (+ owe, - back), verdict, effectiveRate, people, returns (filing separately: byReturn, each return's own balance; else null) } | null
 * "Will we owe or get a refund?" in one place for the Federal estimate, Quick answers and Needs attention: the year's tax
 * against what the paychecks take out by December (withholdingEstimate) and the estimated payments made. null without income.
 */
export function taxAnswer(plan, params = {}) {
  const d = compute(plan, params);
  if (!d.hasIncome) return null;
  return { year: d.year, totalTax: d.totalTax, creditsBack: d.creditsBack, seTax: d.seTax, seOwn: d.seOwn, projected: d.estimate.projected, from: d.estimate.from, paid: d.estimatedPaid + d.estimate.otherPaid, balance: d.estimate.balance, verdict: d.estimate.verdict, effectiveRate: d.effectiveRate, people: d.estimate.people, returns: d.estimate.returns ?? null,
    // stock vesting this year: what the employer holds back from it, inside `projected` (withholdingEstimate; round 8)
    ...(d.estimate.stock > 0 ? { stock: d.estimate.stock } : {}) };
}

/** The IRS page for Form W-4 (the form and its instructions). */
export const W4_URL = "https://www.irs.gov/forms-pubs/about-form-w-4";

/**
 * The one thing to do first, for the hero's filled button (stress test MR-7: Needs attention sent people here and the first
 * screen had no button; the only filled one, Save, was 1.6 screens down). In order:
 * - a W-4 change that clears a bill or frees a refund ("add", or a "cut" worth at least $1 a paycheck): get the form;
 *   with withholding estimated from pay, typing the pay stub figure is offered beside it (`also: "stub"`);
 * - no paycheck left to change, or no tax taken from pay: the Estimated payments page;
 * - nothing to change but the figure is estimated, or no paycheck figure typed: type the pay stub figure;
 * - otherwise null (about right on typed figures: nothing to do).
 * Filing separately, the first return that owes, else the first with a refund, gives the change.
 * @param {{hasIncome:boolean, guessed:boolean, verdict:string, suggestion:object, returns?:object[]|null}} a
 */
export function firstMove({ hasIncome, guessed, verdict, suggestion, returns = null }) {
  if (!hasIncome) return null;
  const ret = returns ? (returns.find((x) => x.verdict === "owe") ?? returns.find((x) => x.verdict === "refund")) : null;
  const sg = returns ? ret?.suggestion ?? { kind: "none" } : suggestion ?? { kind: "none" };
  const changes = returns ? !!ret : verdict === "owe" || verdict === "refund";
  if (changes && (sg.kind === "add" || (sg.kind === "cut" && (sg.takeHome ?? sg.perPaycheck) >= 1)))
    return { kind: "w4", label: "Get a new W-4 form", href: W4_URL, also: guessed ? "stub" : null };
  if (changes && sg.kind === "estimates") return { kind: "estimates", label: "Work out the payments", href: "#/taxes/estimated", also: null };
  if (guessed || verdict === "unknown") return { kind: "stub", label: "Type your pay stub figure", href: null, also: null };
  return null;
}

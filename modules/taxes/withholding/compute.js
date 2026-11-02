// modules/taxes/withholding/compute.js -- PURE. Whether this year's paychecks are taking out
// enough federal tax: what has been withheld so far plus what the rest of the year's paychecks
// will take, against the year's estimated tax; the refund or bill at filing time; the W-4
// change that would land it near zero; and the safe-harbour rule that avoids a penalty.
import { compute as computeFederal } from "../federal/compute.js";
import { compute as computeSelfEmployment } from "../self-employment/compute.js";
import { compute as computePaycheck } from "../../cashflow/paycheck/compute.js";
import { PERIODS } from "../../../core/math/periods.js";
import { daysBetween } from "../../../core/math/dates.js";

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
 * projectedWithholding(plan, { today }) -> { projected, soFar, rest, people: [{ key, name, perPaycheck, period, left, rest, yearly }], hasSetup }
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
    people.push({ key, name: who?.name ?? (key === "self" ? "You" : "Partner"), perPaycheck: Number(cfg.perPaycheck), period, left, rest: Number(cfg.perPaycheck) * left, yearly: Number(cfg.perPaycheck) * perYear });
  }
  const rest = people.reduce((s, p) => s + p.rest, 0);
  const projected = soFarTyped ? soFar + rest : people.reduce((s, p) => s + p.yearly, 0);
  return { projected, soFar, soFarTyped, rest, people, hasSetup: people.length > 0 || soFar > 0, year };
}

/**
 * withholdingEstimate(plan, { today }) -> { projected, from: "typed"|"paycheck"|"mixed"|"none", people: [{ key, name, perPaycheck,
 * period, paychecks, yearly, left, estimated }], detail (projectedWithholding, with `projected` replaced when anything is estimated) }
 * The one figure every tax page uses for "what the paychecks take out this year", earner by earner: the per-paycheck figure
 * typed on this page for anyone who has one; for an earner with none, the Paycheck page's federal withholding worked out
 * from pay the way payroll does (IRS Pub. 15-T percentage method). With the year so far typed, the estimated earners add
 * their paychecks left to it (the so-far figure is the household's); without it, a whole year each. Estimated payments,
 * the Federal estimate, Quick answers and Needs attention read it, so "refund or owe" is one answer everywhere. (Until a
 * review on 2026-11-02 one typed earner made the other's withholding $0, and a typed year so far alone counted no more
 * paychecks.)
 */
export function withholdingEstimate(plan, params = {}) {
  const wh = projectedWithholding(plan, params);
  let pc = null;
  try { pc = computePaycheck(plan, params); } catch { pc = null; }
  const BY_COUNT = { 52: "weekly", 26: "biweekly", 24: "semimonthly", 12: "monthly" };
  const typed = new Set(wh.people.map((p) => p.key));
  const est = (pc?.ready ? pc.people : []).filter((p) => Number(p.yearly?.federal) > 0 && !typed.has(p.key)).map((p) => {
    const period = PERIODS[p.period]?.perYear === p.paychecks ? p.period : BY_COUNT[p.paychecks] ?? "biweekly";
    const left = paychecksLeft(period, params.today ?? null, wh.year);
    return { key: p.key, name: p.name, perPaycheck: Number(p.federal?.amount) || 0, period, paychecks: p.paychecks, yearly: Number(p.yearly.federal), left, estimated: true };
  });
  const typedPeople = wh.people.map((p) => ({ key: p.key, name: p.name, perPaycheck: p.perPaycheck, period: p.period, paychecks: PERIODS[p.period]?.perYear ?? null, yearly: p.yearly, left: p.left, estimated: false }));
  if (!est.length) return { projected: wh.projected, from: wh.hasSetup ? "typed" : "none", people: typedPeople, detail: wh };
  // nothing typed at all: the whole year from pay, earner by earner
  if (!wh.hasSetup) { const yearly = est.reduce((t, p) => t + p.yearly, 0); return { projected: yearly, from: "paycheck", people: est, detail: { ...wh, projected: yearly } }; }
  const projected = wh.soFarTyped ? wh.soFar + wh.rest + est.reduce((t, p) => t + p.perPaycheck * p.left, 0) : wh.people.reduce((t, p) => t + p.yearly, 0) + est.reduce((t, p) => t + p.yearly, 0);
  return { projected, from: "mixed", people: [...typedPeople, ...est], detail: { ...wh, projected } };
}

/**
 * yearTax(plan, fed, { today }) -> { total, income, se }: the year's federal tax to pay. `income` is the Federal estimate's
 * total (income tax only; it counts business income as ordinary income); with business income on the Income page, `total`
 * is the Self-employment page's figure instead: the same tax with the 15.3% self-employment tax (IRC 1401) and its two
 * deductions (half of it, IRC 164(f); 20% of qualified business income, IRC 199A), and `se` the difference. Safe harbour and
 * Form 2210 count self-employment tax as part of the year's tax.
 */
export function yearTax(plan, fed, params = {}) {
  const income = Math.max(0, Number(fed?.result?.totalTax) || 0);
  const s = computeSelfEmployment(plan, params);
  const total = s.ready ? Math.max(0, s.taxWith) : income;
  return { total, income, se: total - income };
}

/**
 * compute(plan, { today }) -> {
 *   year, totalTax (yearTax: self-employment tax included), incomeTax, seTax, withholding: projectedWithholding, estimatedPaid, balance (tax - withholding - estimates; + owe, - refund),
 *   verdict: "about right" | "refund" | "owe" | "unknown", harbour, penaltyRisk,
 *   suggestion: { kind: "add" | "cut" | "none", perPaycheck, paychecks, text } for the main earner's W-4,
 *   notes, hasIncome, estimate: withholdingEstimate plus { balance, verdict } (the typed figures, else estimated from pay)
 * }
 */
export function compute(plan, params = {}) {
  const fed = computeFederal(plan, params);
  const wh = projectedWithholding(plan, params);
  const t = plan.taxes ?? {};
  const yt = yearTax(plan, fed, params);
  const totalTax = yt.total;
  const estimatedPaid = (t.estimated?.paid ?? []).reduce((s, x) => s + (Math.max(0, Number(x)) || 0), 0);
  const balance = totalTax - wh.projected - estimatedPaid;
  const harbour = safeHarbour(totalTax, t.priorYear?.tax, t.priorYear?.agi, fed.filingStatus);
  // the $1,000 test counts withholding only, not estimated payments (IRC 6654(e)(1); Form 2210 line 6); nothing to say until a paycheck figure is in
  const penaltyRisk = wh.hasSetup && totalTax - wh.projected >= 1000 && wh.projected + estimatedPaid < harbour.required;
  const verdict = !wh.hasSetup ? "unknown" : Math.abs(balance) < 500 ? "about right" : balance > 0 ? "owe" : "refund";
  const main = wh.people[0] ?? null;
  let suggestion = { kind: "none", perPaycheck: 0, paychecks: 0, text: "" };
  if (main && main.left > 0 && verdict === "owe") suggestion = { kind: "add", perPaycheck: Math.ceil(balance / main.left), paychecks: main.left, text: `Ask for ${Math.ceil(balance / main.left).toLocaleString("en-US")} more per paycheck on a new W-4 (Step 4(c), "extra withholding") for the ${main.left} paychecks left, and the bill disappears.` };
  else if (main && main.left > 0 && verdict === "refund") suggestion = { kind: "cut", perPaycheck: Math.floor(-balance / main.left), paychecks: main.left, text: `You are lending the IRS about ${Math.floor(-balance / main.left).toLocaleString("en-US")} a paycheck. On a new W-4, entering ${Math.round(-balance).toLocaleString("en-US")} in Step 3 (credits) or the matching amount in Step 4(b) (deductions) brings the take-home up and the refund down.` };
  else if (verdict === "owe" && !main) suggestion = { kind: "estimates", perPaycheck: 0, paychecks: 0, text: "No paycheck figure is typed yet, so the rest of the year counts nothing withheld. If tax comes out of your pay, type one paycheck's tax under What a paycheck withholds; if not, the Estimated payments page splits the bill into the four quarterly payments." };
  const notes = [];
  if (!fed.hasIncome) notes.push("No income on file yet: add it on the Income page or type it on the Federal estimate page.");
  if (!wh.hasSetup && fed.hasIncome) notes.push("Type the federal tax taken from one paycheck (the \"Federal income tax\" line on the stub) below, and what has been withheld so far this year on the Federal estimate page.");
  // the best answer the plan has: the typed figures, else withholding estimated from pay (`estimate`); `balance` and `verdict`
  // above stay on the typed figures only (the answer key checks them), the page leads with `estimate`
  const est = withholdingEstimate(plan, params);
  // other payments typed on the Federal estimate (an extension payment, last year's overpayment applied) count as paid too,
  // as the Federal estimate's own walk counts them
  const otherPaid = Math.max(0, Number(t.thisYear?.paid) || 0);
  const estBalance = totalTax - est.projected - estimatedPaid - otherPaid;
  const estimate = { ...est, otherPaid, balance: estBalance, verdict: est.from === "none" ? "unknown" : Math.abs(estBalance) < 500 ? "about right" : estBalance > 0 ? "owe" : "refund" };
  // the W-4 change on the estimate: the extra per paycheck on the main earner's paychecks left (as the typed suggestion does)
  const lead = [...est.people].filter((p) => p.left > 0).sort((a, b) => b.yearly - a.yearly)[0] ?? null;
  estimate.suggestion = lead && estimate.verdict === "owe" ? { kind: "add", name: lead.name, perPaycheck: Math.ceil(estBalance / lead.left), paychecks: lead.left }
    : lead && estimate.verdict === "refund" ? { kind: "cut", name: lead.name, perPaycheck: Math.floor(-estBalance / lead.left), paychecks: lead.left } : { kind: "none" };
  return { year: fed.year, totalTax, incomeTax: yt.income, seTax: yt.se, withholding: wh, estimatedPaid, balance, verdict, harbour, penaltyRisk, suggestion, notes, hasIncome: fed.hasIncome, effectiveRate: fed.result.effectiveRate, wages: fed.result.income.wages, estimate };
}

/**
 * fullSteps(plan, fed, params) -> { steps, total, rate (total / income), se: { tax (self-employment tax, Additional Medicare
 * on it included), half, qbi, expenses, nextDollar (what the next dollar of business profit costs in all, a fraction) } | null }. The Federal estimate's walk from income to tax (`fed.steps`), and with
 * self-employment income the business rows before its "Federal tax" line, so the walk ends at the year's whole federal
 * tax (yearTax: what Withholding check, Quick answers and Needs attention say): the business counted at its profit with
 * half the self-employment tax and the 20% business deduction off income, then the self-employment tax itself.
 * fed.result is not touched (the answer keys check it).
 */
export function fullSteps(plan, fed, params = {}) {
  const steps = (fed?.steps ?? []).map((x) => ({ ...x }));
  const r = fed?.result ?? {};
  const gross = Number(r.income?.gross) || 0;
  const s = computeSelfEmployment(plan, params);
  const at = steps.findIndex((x) => x.label === "Federal tax");
  if (!s.ready || at < 0) return { steps, total: Math.max(0, Number(r.totalTax) || 0), rate: Number(r.effectiveRate) || 0, se: null };
  const total = Math.max(0, s.taxWith);
  const seAll = s.seTotal + s.addlMedicare;
  const incomeAfter = total - seAll;
  const n = (x) => Math.round(x).toLocaleString("en-US");
  const rows = [];
  const change = incomeAfter - (Number(r.totalTax) || 0);
  const offs = [s.half >= 1 ? `half the self-employment tax (${n(s.half)})` : null, s.qbi >= 1 ? `the 20% business deduction (${n(s.qbi)})` : null].filter(Boolean);
  if (Math.abs(change) >= 1) rows.push({ label: change < 0 ? `Tax saved by business ${s.expenses > 0 ? "costs and " : ""}deductions` : "Business taxed on its profit", amount: change, sub: [s.expenses > 0 ? `the business taxed on its profit, after ${n(s.expenses)} of costs` : null, offs.length ? `${offs.join(" and ")} come${offs.length === 1 ? "s" : ""} off income` : null].filter(Boolean).join("; ") || "the business counted at its profit" });
  rows.push({ label: "Self-employment tax", amount: seAll, sub: `Social Security and Medicare for the self-employed: 15.3% of 92.35% of the profit${s.addlMedicare >= 1 ? `, plus ${n(s.addlMedicare)} of Additional Medicare tax` : ""}` });
  const rate = gross > 0 ? total / gross : 0;
  steps.splice(at, 1, ...rows, { ...steps[at], amount: total, sub: `income tax and self-employment tax: ${(rate * 100).toFixed(1)}% of income` });
  return { steps, total, rate, se: { tax: seAll, half: s.half, qbi: s.qbi, expenses: s.expenses, nextDollar: Math.max(0, 100 - s.keepPer100) / 100 } };
}

/**
 * taxAnswer(plan, { today }) -> { year, totalTax, seTax, projected, from, paid (estimated and other payments), balance (+ owe, - back), verdict, effectiveRate, people } | null
 * "Will we owe or get a refund?" in one place for the Federal estimate, Quick answers and Needs attention: the year's tax
 * against what the paychecks take out by December (withholdingEstimate) and the estimated payments made. null without income.
 */
export function taxAnswer(plan, params = {}) {
  const d = compute(plan, params);
  if (!d.hasIncome) return null;
  return { year: d.year, totalTax: d.totalTax, seTax: d.seTax, projected: d.estimate.projected, from: d.estimate.from, paid: d.estimatedPaid + d.estimate.otherPaid, balance: d.estimate.balance, verdict: d.estimate.verdict, effectiveRate: d.effectiveRate, people: d.estimate.people };
}

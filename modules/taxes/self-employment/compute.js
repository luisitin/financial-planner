// modules/taxes/self-employment/compute.js -- PURE. Working for yourself: the self-employment tax (Social
// Security and Medicare for both halves, 15.3% of 92.35% of profit, Social Security only up to the year's
// wage base after any pay), half of it taken off income, the 20% qualified business income deduction, what
// a SEP-IRA or a solo 401(k) could shelter, the whole tax the business adds, what each extra $100 of profit
// keeps, and the quarterly payments it calls for.
import { taxInputs } from "../federal/compute.js";
import { federalTax } from "../../../core/math/tax.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeContributions } from "../../retirement/contributions/compute.js";
import { maximumEarnings } from "../../retirement/social-security/compute.js";
import { LIMITS } from "../../retirement/contributions/data/limits.js";

/** Self-employment tax (IRC 1401, 1402): 92.35% of net profit is taxed at 12.4% (Social Security, up to the wage base less wages) and 2.9% (Medicare); nothing under $400. */
export const SE = { base: 0.9235, ss: 0.124, medicare: 0.029, floor: 400, addlMedicare: 0.009 };
/** The qualified business income deduction (IRC 199A, permanent from 2026): 20%, at most 20% of taxable income; above about $200,000 single / $400,000 joint it can be limited. */
export const QBI = { rate: 0.2, limitAround: { single: 200000, married_joint: 400000 } };
/** The most that can go into a SEP-IRA, or a solo 401(k) in all (IRC 415(c)): $72,000 in 2026 (Notice 2025-67). The employer part is 20% of net earnings after half the SE tax. */
export const TOTAL_ADDITIONS = { 2025: 70000, 2026: 72000 };

/** The self-employment tax on a net profit for someone with `wages` already under Social Security that year. */
export function seTax(net, { wages = 0, wageBase }) {
  const base = Math.max(0, net) * SE.base;
  if (base < SE.floor) return { base, ss: 0, medicare: 0, total: 0, half: 0 };
  const ss = SE.ss * Math.min(base, Math.max(0, wageBase - wages));
  const medicare = SE.medicare * base;
  return { base, ss, medicare, total: ss + medicare, half: (ss + medicare) / 2 };
}

/**
 * compute(plan, { today }) -> {
 *   ready, year, people: [{ id, name, net, wages, se: { base, ss, medicare, total, half }, qbi, sepRoom, soloRoom, deferralLeft }],
 *   net, seTotal, addlMedicare, qbi, taxWithout, taxWith, businessTax, effectiveRate, keepPer100, quarterly, qbiMayBeLimited, expenses, warnings
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const s = plan.whatIfs?.selfEmployment ?? {};
  const expenses = Math.max(0, Number(s.expenses) || 0);
  const b = taxInputs(plan, { today });
  const year = b.year;
  const status = b.inputs.filingStatus;
  const inc = computeIncome(plan, { today });
  const con = computeContributions(plan, { today });
  const people = plan.household?.people ?? [];
  const biz = inc.active.filter((x) => x.type === "business" && x.taxable !== false);
  if (!biz.length) return { ready: false, year, people: [], warnings: [] };
  const wageBase = maximumEarnings(year);
  const owners = [...new Set(biz.map((x) => x.personId || people.find((p) => p.role === "self")?.id || ""))];
  const grossAll = biz.reduce((t, x) => t + x.yearly, 0);
  const L = (LIMITS[year] ?? LIMITS[Math.max(...Object.keys(LIMITS).map(Number))]).kinds;
  const total415 = TOTAL_ADDITIONS[year] ?? TOTAL_ADDITIONS[2026];
  const rows = owners.map((id) => {
    const gross = biz.filter((x) => (x.personId || owners[0]) === id).reduce((t, x) => t + x.yearly, 0);
    const net = Math.max(0, gross - expenses * (grossAll > 0 ? gross / grossAll : 0));
    const wages = inc.active.filter((x) => x.personId === id && ["salary", "bonus"].includes(x.type)).reduce((t, x) => t + x.yearly, 0);
    const se = seTax(net, { wages, wageBase });
    const earned = Math.max(0, net - se.half);
    const deferred = (con.items ?? []).filter((c) => c.personId === id && c.accountType === "401k").reduce((t, c) => t + c.yearly, 0);
    const deferralLeft = Math.max(0, L["401k"].limit - deferred);
    const employer = 0.2 * earned;
    return { id, name: people.find((p) => p.id === id)?.name ?? "You", net, wages, se, sepRoom: Math.min(total415, employer), soloRoom: Math.min(total415, employer + Math.min(deferralLeft, earned)), deferralLeft };
  });
  const net = rows.reduce((t, r) => t + r.net, 0);
  const seTotal = rows.reduce((t, r) => t + r.se.total, 0);
  const half = rows.reduce((t, r) => t + r.se.half, 0);
  const wagesAll = b.inputs.wages ?? 0;
  const medTh = b.params.additionalMedicareThreshold?.[status] ?? 200000;
  const seBaseAll = rows.reduce((t, r) => t + r.se.base, 0);
  const addlMedicare = SE.addlMedicare * (Math.max(0, wagesAll + seBaseAll - medTh) - Math.max(0, wagesAll - medTh));
  // the federal estimate counts the Income page's business amount; here it is the profit after expenses
  const withProfit = (profit) => ({ ...b.inputs, otherOrdinary: Math.max(0, b.inputs.otherOrdinary - grossAll + profit) });
  const taxWithout = federalTax(withProfit(0), b.params).totalTax;
  const taxFor = (profit) => {
    const scale = net > 0 ? profit / net : 0;
    const seT = rows.reduce((t, r) => t + seTax(r.net * scale, { wages: r.wages, wageBase }).total, 0), halfT = seT / 2;
    const pre = federalTax({ ...withProfit(profit), adjustments: (b.inputs.adjustments ?? 0) + halfT }, b.params);
    // the QBI deduction: 20% of profit less half the SE tax, at most 20% of taxable income before it (taken here as a reduction of income)
    const qbi = Math.max(0, Math.min(QBI.rate * Math.max(0, profit - halfT), QBI.rate * Math.max(0, pre.taxableIncome)));
    const after = federalTax({ ...withProfit(profit), adjustments: (b.inputs.adjustments ?? 0) + halfT + qbi }, b.params);
    const addl = SE.addlMedicare * (Math.max(0, wagesAll + profit * SE.base - medTh) - Math.max(0, wagesAll - medTh));
    return { total: after.totalTax + seT + addl, qbi, taxable: pre.taxableIncome };
  };
  const now = taxFor(net), plus = taxFor(net + 100);
  const businessTax = now.total - taxWithout;
  const warnings = [];
  const limitAt = QBI.limitAround[status] ?? QBI.limitAround.single;
  if (now.taxable > limitAt) warnings.push(`Taxable income is over about ${limitAt.toLocaleString("en-US")}: the 20% business deduction can be limited (by the kind of business, wages paid and property). Check it with a tax preparer.`);
  if (!expenses) warnings.push("The Income page's amount is treated as profit. If it is what customers paid, enter the business expenses below.");
  return {
    ready: true, year, status, people: rows.map((r) => ({ ...r, qbi: net > 0 ? now.qbi * r.net / net : 0 })), net, seTotal, half, addlMedicare, qbi: now.qbi,
    taxWithout, taxWith: taxWithout + businessTax, businessTax, effectiveRate: net > 0 ? businessTax / net : 0, keepPer100: 100 - (plus.total - now.total), quarterly: businessTax / 4,
    qbiMayBeLimited: now.taxable > limitAt, expenses, wageBase, total415, warnings,
  };
}

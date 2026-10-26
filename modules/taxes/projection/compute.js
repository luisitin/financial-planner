// modules/taxes/projection/compute.js -- PURE. Federal tax in every year of the retirement
// plan, through the brackets: what is taxed each year (pensions, pay, withdrawals, the taxable
// part of Social Security, gains and dividends), the bracket the year ends in, the tax and
// the rate; totals in today's dollars; the years that hurt most; and how the flat-rate
// setting compares.
import { project } from "../../../core/math/retirement.js";
import { buildInputs, taxSettings } from "../../retirement/projection/compute.js";

/**
 * compute(plan, { today, real }) -> {
 *   ready, missing, rows: [{ year, ages, retired, ordinary, qualified, socialSecurity, taxableSocialSecurity, taxableIncome, deduction, bracketRate, taxes, effectiveRate, conversion, rmd, withdrawnDeferred, priceLevel }] (retired years; money real unless real=false),
 *   totals: { taxes, ordinary, socialSecurity, taxableSocialSecurity, conversions, rmd }, average (yearly tax), peak: { year, taxes, why }, byBracket: [{ rate, years }],
 *   flatTaxes (what the flat setting would charge over the same years), bracketsOn, notes, people, filingStatus, firstZero (years with no tax)
 * }
 */
export function compute(plan, params = {}) {
  const b = buildInputs(plan, params);
  if (!b.inputs) return { ready: false, missing: b.missing, notes: b.notes, rows: [] };
  const real = params.real !== false;
  const tax = taxSettings(plan, { mode: "brackets" });
  const r = project({ ...b.inputs, tax });
  const flat = project({ ...b.inputs, tax: { mode: "flat" } });
  const k = (row, n) => real ? n / row.priceLevel : n;
  const rows = r.rows.filter((x) => x.retired).map((x) => {
    const i = x.taxInfo ?? {};
    return { year: x.year, ages: x.ages, retired: x.retired, ordinary: k(x, i.ordinary ?? 0), qualified: k(x, i.qualified ?? 0), socialSecurity: k(x, i.socialSecurity ?? 0), taxableSocialSecurity: k(x, i.taxableSocialSecurity ?? 0), taxableIncome: k(x, i.taxableIncome ?? 0), deduction: k(x, i.deduction ?? 0), bracketRate: i.bracketRate ?? null, taxes: k(x, x.taxes), effectiveRate: i.effectiveRate ?? 0, conversion: k(x, x.conversion), rmd: k(x, x.rmd), withdrawnDeferred: k(x, x.withdrawn.deferred), priceLevel: x.priceLevel };
  });
  const sum = (f) => rows.reduce((s, x) => s + f(x), 0);
  const totals = { taxes: sum((x) => x.taxes), ordinary: sum((x) => x.ordinary), socialSecurity: sum((x) => x.socialSecurity), taxableSocialSecurity: sum((x) => x.taxableSocialSecurity), conversions: sum((x) => x.conversion), rmd: sum((x) => x.rmd), qualified: sum((x) => x.qualified) };
  const peak = rows.reduce((a, x) => x.taxes > (a?.taxes ?? -1) ? x : a, null);
  const peakWhy = peak ? peak.conversion > 0 ? "a Roth conversion" : peak.rmd > 0 && peak.rmd >= peak.withdrawnDeferred * 0.9 ? "required withdrawals" : peak.withdrawnDeferred > 0 ? "pre-tax withdrawals" : "income" : "";
  const byBracketMap = new Map();
  for (const x of rows) if (x.bracketRate !== null) byBracketMap.set(x.bracketRate, (byBracketMap.get(x.bracketRate) ?? 0) + 1);
  const byBracket = [...byBracketMap.entries()].sort((a, b) => a[0] - b[0]).map(([rate, years]) => ({ rate, years }));
  const flatTaxes = flat.rows.filter((x) => x.retired).reduce((s, x) => s + (real ? x.taxes / x.priceLevel : x.taxes), 0);
  const notes = [...b.notes];
  if ((plan.retirement?.taxMode ?? "flat") !== "brackets") notes.push(`The projection pages still use the flat ${Math.round((plan.retirement?.taxRate ?? 0.15) * 100)}% setting, which comes to ${Math.round(flatTaxes).toLocaleString("en-US")} over the same years; switch the Projection page to the federal brackets to use these figures.`);
  return { ready: true, missing: [], rows, totals, average: rows.length ? totals.taxes / rows.length : 0, peak: peak ? { year: peak.year, taxes: peak.taxes, why: peakWhy } : null, byBracket, flatTaxes, bracketsOn: (plan.retirement?.taxMode ?? "flat") === "brackets", notes, people: b.people, filingStatus: tax.filingStatus, zeroYears: rows.filter((x) => x.taxes < 1).length, real, retireYear: b.inputs.retireYear, success: r.success, failYear: r.failYear };
}

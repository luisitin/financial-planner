// modules/goals/charitable/compute.js -- PURE. Giving to charity and what it does to the year's federal
// tax, worked out by the real tax engine with different gifts: what a year's giving saves and really costs;
// "bunching" several years of gifts into one year (often through a donor-advised fund) so they clear the
// standard deduction; giving shares that have grown instead of cash (no capital gains tax on the growth);
// and, from age 70 and a half, giving straight from an IRA.
import { taxInputs } from "../../taxes/federal/compute.js";
import { federalTax } from "../../../core/math/tax.js";

export const DEFAULTS = { yearly: null, bunchYears: 3, gainShare: 0.5 };
/** Qualified charitable distributions from an IRA: from age 70 1/2, up to about $108,000 a year in 2025 (indexed), never taxed and counted toward required withdrawals (IRC 408(d)(8)). */
export const QCD_AGE = 70.5;

/** The year's federal tax with these gifts (and extra long-term gains), from the plan's own tax inputs. */
export function taxWith(plan, { gift = 0, gains = 0, today } = {}) {
  const p = JSON.parse(JSON.stringify(plan));
  p.taxes = p.taxes ?? {};
  p.taxes.itemized = { ...(p.taxes.itemized ?? {}), charitable: gift };
  p.taxes.thisYear = { ...(p.taxes.thisYear ?? {}), qualifiedIncome: (Number(p.taxes.thisYear?.qualifiedIncome) || 0) + gains };
  const b = taxInputs(p, { today });
  const r = federalTax({ ...b.inputs, charitableCash: gift }, b.params);
  return { tax: r.totalTax, used: r.deduction.used, standard: r.deduction.standard, itemized: r.deduction.itemizedBeforeLimit, agi: r.agi };
}

/**
 * compute(plan, { today }) -> {
 *   yearly, bunchYears, gainShare, none (tax without gifts), withGift, saved, netCost, savedShare,
 *   bunch: { years, gift (all in one year), eachYear (giving the same every year: total tax), bunched (total tax), saving (< 0 when bunching costs more), bigUsed },
 *   stock: { gain, taxAvoided }, qcd: { ages: [names], eligible }, shareOfIncome, warnings
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const s = plan.whatIfs?.charitable ?? {};
  const fromTaxes = Number(plan.taxes?.itemized?.charitable) || 0;
  const yearly = Number(s.yearly) > 0 ? Number(s.yearly) : fromTaxes > 0 ? fromTaxes : 3000;
  const bunchYears = Math.max(2, Math.min(5, Math.round(Number(s.bunchYears) || DEFAULTS.bunchYears)));
  const gainShare = Number.isFinite(Number(s.gainShare)) && s.gainShare !== null && s.gainShare !== "" && s.gainShare !== undefined ? Math.min(1, Math.max(0, Number(s.gainShare))) : DEFAULTS.gainShare;
  // the plan's own gift on the tax page is replaced by the one tested here
  const base = { ...plan, taxes: { ...(plan.taxes ?? {}), itemized: { ...(plan.taxes?.itemized ?? {}), charitable: 0 } } };
  const none = taxWith(base, { today }), withGift = taxWith(base, { gift: yearly, today });
  const saved = Math.max(0, none.tax - withGift.tax);
  const big = taxWith(base, { gift: yearly * bunchYears, today });
  const eachYear = withGift.tax * bunchYears, bunched = big.tax + none.tax * (bunchYears - 1);
  // shares that have grown: selling them first would tax the gain; giving them does not
  const gain = yearly * gainShare;
  const stockTaxAvoided = Math.max(0, taxWith(base, { gift: yearly, gains: gain, today }).tax - withGift.tax);
  const year = today ? Number(String(today).slice(0, 4)) : 2026;
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent" && p.birthDate);
  const qcdNames = adults.filter((p) => year - Number(p.birthDate.slice(0, 4)) >= QCD_AGE).map((p) => p.name);
  const hasIra = (plan.accounts ?? []).some((a) => ["ira", "401k"].includes(a.type) && Number(a.balance) > 0);
  const warnings = [];
  if (withGift.used === "standard" && big.used === "itemized") warnings.push(`Giving ${bunchYears} years at once lifts your deductions over the standard deduction that year: bunching saves tax.`);
  return {
    yearly, bunchYears, gainShare, none, withGift, saved, netCost: yearly - saved, savedShare: yearly > 0 ? saved / yearly : 0,
    bunch: { years: bunchYears, gift: yearly * bunchYears, eachYear, bunched, saving: eachYear - bunched, bigUsed: big.used },   // saving < 0: bunching costs more
    stock: { gain, taxAvoided: stockTaxAvoided }, qcd: { names: qcdNames, eligible: qcdNames.length > 0 && hasIra },
    shareOfIncome: none.agi > 0 ? yearly / none.agi : null, fromTaxes, warnings,
  };
}

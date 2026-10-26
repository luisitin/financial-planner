// modules/retirement/roth-conversions/compute.js -- PURE. Moving pre-tax money into a Roth in
// the low-income years between retirement and required withdrawals, filling a chosen bracket
// each year. The plan is run with no conversions and with each bracket filled (always through
// the federal brackets), and the chosen setting gets a year-by-year table with the room in the
// bracket, the conversion, its tax and the Medicare surcharge line it might cross.
import { project } from "../../../core/math/retirement.js";
import { buildInputs, taxSettings } from "../projection/compute.js";
import { bracketTop } from "../../../core/math/tax.js";

/** Medicare's first income-related surcharge line (IRMAA), 2026, from income two years earlier; indexed with inflation after. */
export const IRMAA_FIRST_TIER = { year: 2026, single: 109000, married_joint: 218000, married_separate: 109000, head_of_household: 109000, qualifying_surviving: 109000 };
export const FILL_RATES = [0.10, 0.12, 0.22, 0.24];

/**
 * compute(plan, { today }) -> {
 *   ready, missing, on, fillRate, untilAge, options: [{ fillRate | null, label, totalConvertedReal, taxesReal, endBalanceReal, endAfterTaxReal, rmdReal, success, failYear, chosen, best }],
 *   (options ranked by what is left at the end after the tax still owed on pre-tax money; a failing plan ranks by how late it fails)
 *   best, table: [{ year, ages, incomeBefore, bracketTop, conversion, conversionReal, taxes, taxesReal, bracketRate, taxableIncome, irmaa }] the years with a conversion under the chosen setting,
 *   span: { from, to, years } the conversion years, rmdStartAge, notes, bracketsOn
 * }
 */
export function compute(plan, params = {}) {
  const b = buildInputs(plan, params);
  if (!b.inputs) return { ready: false, missing: b.missing, notes: b.notes, options: [] };
  const rt = plan.retirement ?? {};
  const rc = rt.rothConversion ?? {};
  const on = !!rc.on;
  const fillRate = FILL_RATES.includes(Number(rc.fillRate)) ? Number(rc.fillRate) : 0.22;
  const untilAge = rc.untilAge ? Number(rc.untilAge) : null;
  const tax = taxSettings(plan, { mode: "brackets" });
  const run = (rate) => {
    const inputs = { ...b.inputs, tax, rothConversion: rate ? { fillRate: rate, untilAge } : null };
    const r = project(inputs);
    return { r, inputs, taxesReal: r.rows.reduce((s, x) => s + x.taxes / x.priceLevel, 0), rmdReal: r.rows.reduce((s, x) => s + x.rmd / x.priceLevel, 0), convertedReal: r.rows.reduce((s, x) => s + x.conversion / x.priceLevel, 0) };
  };
  const options = [null, ...FILL_RATES].map((rate) => {
    const { r, inputs, taxesReal, rmdReal, convertedReal } = run(rate);
    return { fillRate: rate, label: rate ? `Fill the ${Math.round(rate * 100)}% bracket` : "No conversions", totalConvertedReal: convertedReal, taxesReal, endBalanceReal: r.endBalanceReal, endAfterTaxReal: r.endAfterTaxReal, endTaxRate: r.endTaxRate, rmdReal, success: r.success, failYear: r.failYear, chosen: on ? rate === fillRate : rate === null };
  });
  const score = (x) => x.success ? x.endAfterTaxReal : -1e12 + x.failYear;
  const best = options.reduce((a, x) => score(x) > score(a) ? x : a, options[0]);
  for (const o of options) o.best = o === best;
  const none = options[0];
  // the year-by-year table for the chosen (or, when off, the best non-zero) setting
  const shown = on ? fillRate : (best.fillRate ?? 0.22);
  const chosenRun = run(shown);
  const inflation = Number(plan.assumptions?.inflation ?? 0.03);
  const irmaaLine = (year) => (IRMAA_FIRST_TIER[tax.filingStatus] ?? IRMAA_FIRST_TIER.single) * Math.pow(1 + inflation, Math.max(0, year - IRMAA_FIRST_TIER.year));
  const rmdStartAge = b.inputs.rmd?.startAge ?? 75;
  const table = chosenRun.r.rows.filter((x) => x.retired && x.ages[0] < rmdStartAge && (untilAge === null || x.ages[0] < untilAge)).map((x) => {
    const params = tax.paramsFor(x.year);
    const top = bracketTop(shown, tax.filingStatus, params);
    const info = x.taxInfo ?? {};
    const magi = (info.taxableIncome ?? 0) + (info.deduction ?? 0);
    return { year: x.year, ages: x.ages, incomeBefore: (info.ordinary ?? 0) - x.conversion, bracketTop: top, conversion: x.conversion, conversionReal: x.conversion / x.priceLevel, taxes: x.taxes, taxesReal: x.taxes / x.priceLevel, bracketRate: info.bracketRate ?? null, taxableIncome: info.taxableIncome ?? 0, irmaa: x.ages[0] >= 63 && magi > irmaaLine(x.year), priceLevel: x.priceLevel };
  });
  const span = table.length ? { from: table[0].year, to: table[table.length - 1].year, years: table.length } : null;
  const rows = table.filter((r) => r.conversion > 0);   // the years something is actually converted (the pot can run dry before the last possible year)
  const notes = [...b.notes];
  if (!b.inputs.balances.deferred) notes.push("No pre-tax retirement money on file (401(k), IRA on the Net worth page), so there is nothing to convert.");
  if (!span) notes.push(`No years to convert in: the first person reaches the required-withdrawal age (${rmdStartAge}) before or at retirement.`);
  if (on && (rt.taxMode ?? "flat") !== "brackets") notes.push("Conversions only run when the projection uses the federal brackets; turning them on here switches the projection to the brackets.");
  return { ready: true, missing: [], on, fillRate, untilAge, options, best: best.fillRate, shown, table: rows, span, rmdStartAge, notes, bracketsOn: (rt.taxMode ?? "flat") === "brackets", none, chosenSummary: options.find((o) => o.chosen) ?? none, deferredNow: b.inputs.balances.deferred, people: b.people, filingStatus: tax.filingStatus };
}

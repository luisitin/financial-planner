// modules/retirement/withdrawal-order/compute.js -- PURE. The same plan run under each order
// of drawing down the accounts (after cash), always with the federal brackets so the tax
// timing shows: lifetime tax in today's dollars, what is left at the end, the spending each
// order can carry, and the year the money runs out if it does.
import { project } from "../../../core/math/retirement.js";
import { buildInputs, taxSettings, WITHDRAWAL_ORDERS, orderKey } from "../projection/compute.js";

/**
 * compute(plan, { today }) -> {
 *   ready, missing, current (key), options: [{ key, label, note, order, success, failYear, endBalanceReal, endAfterTaxReal, endTaxRate, taxesReal, rmdReal, current, best }],
 *   best (key), gainVsWorst (after-tax end balance difference), taxSpread, bracketsOn (the projection itself uses the brackets), notes
 * }
 * Orders are ranked by what is left at the end after the tax still owed on pre-tax money (a plan that runs out ranks by how late).
 */
export function compute(plan, params = {}) {
  const b = buildInputs(plan, params);
  if (!b.inputs) return { ready: false, missing: b.missing, notes: b.notes, options: [] };
  const tax = taxSettings(plan, { mode: "brackets" });
  const current = orderKey(b.inputs.withdrawalOrder);
  const options = Object.entries(WITHDRAWAL_ORDERS).map(([key, def]) => {
    // on the plan's own spending, the same every year (round 8, Batch 5b): the share, years-left and guardrail ways spend what an
    // order saves in tax instead of keeping it, so "left at the end" would not show it
    const inputs = { ...b.inputs, strategy: "fixed-real", withdrawalOrder: def.order, tax };
    const r = project(inputs);
    const taxesReal = r.rows.reduce((s, x) => s + x.taxes / x.priceLevel, 0);
    const rmdReal = r.rows.reduce((s, x) => s + x.rmd / x.priceLevel, 0);
    return { key, label: def.label, note: def.note, order: def.order, success: r.success, failYear: r.failYear, endBalanceReal: r.endBalanceReal, endAfterTaxReal: r.endAfterTaxReal, endTaxRate: r.endTaxRate, taxesReal, rmdReal, current: key === current };
  });
  const score = (x) => x.success ? x.endAfterTaxReal : -1e12 + x.failYear;
  const best = options.reduce((a, x) => score(x) > score(a) ? x : a, options[0]);
  for (const o of options) o.best = o.key === best.key;
  const worst = options.reduce((a, x) => score(x) < score(a) ? x : a, options[0]);
  const notes = [...b.notes];
  // the flat-rate note is no longer a line of text here: the page says it in plain words with its own button (`bracketsOn`; stress
  // test 2026-11-11, x-4: "the projection", "federal brackets" and a setting on another page, with no way to act)
  return { ready: true, missing: [], current, options, best: best.key, gainVsWorst: best.success && worst.success ? best.endAfterTaxReal - worst.endAfterTaxReal : 0, taxSpread: worst.taxesReal - best.taxesReal, allFail: !options.some((o) => o.success), bracketsOn: (plan.retirement?.taxMode ?? "flat") === "brackets", notes, people: b.people, hasDeferred: b.inputs.balances.deferred > 0, hasFree: b.inputs.balances.free > 0, hasTaxable: b.inputs.balances.taxable > 0 };
}

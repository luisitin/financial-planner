// modules/retirement/withdrawal-order/compute.js -- PURE. The same plan run under each order
// of drawing down the accounts (after cash), always with the federal brackets so the tax
// timing shows: lifetime tax in today's dollars, what is left at the end, the spending each
// order can carry, and the year the money runs out if it does. A fifth way beside the four
// orders takes a share from every account (gap list, next 60, item 22).
import { project } from "../../../core/math/retirement.js";
import { buildInputs, taxSettings, WITHDRAWAL_ORDERS, WITHDRAWAL_SHARE, orderKey, sharesWithdrawals } from "../projection/compute.js";

const score = (x) => (x.success ? x.endAfterTaxReal : -1e12 + x.failYear);
/** The best and the worst of a list of options, ties to the first listed; and what separates them. */
function rank(list) {
  const best = list.reduce((a, x) => (score(x) > score(a) ? x : a), list[0]);
  const worst = list.reduce((a, x) => (score(x) < score(a) ? x : a), list[0]);
  return { best, worst, gainVsWorst: best.success && worst.success ? best.endAfterTaxReal - worst.endAfterTaxReal : 0, taxSpread: worst.taxesReal - best.taxesReal, allFail: !list.some((o) => o.success) };
}

/**
 * compute(plan, { today }) -> {
 *   ready, missing, current (key: one of the four, "custom", or "proportional"), options: [{ key, label, note, order, success, failYear, endBalanceReal, endAfterTaxReal, endTaxRate, taxesReal, rmdReal, current, best }],
 *   best (key), gainVsWorst (after-tax end balance difference), taxSpread, bracketsOn (the projection itself uses the brackets), notes,
 *   share: { key: "proportional", split: "proportional", label, note, order (the plan's own, kept for money that comes in during a year), ...the same figures, current, best },
 *   five: { best (key), gainVsWorst, taxSpread, allFail }
 * }
 * Orders are ranked by what is left at the end after the tax still owed on pre-tax money (a plan that runs out ranks by how late).
 * `options`, `best`, `gainVsWorst` and `taxSpread` are the four orders' (the golden key and the tax pages' tests hold them);
 * `share` is the fifth, a share from every account, and `five` the ranking over all five (a tie goes to the four, so the share is
 * best only when it leaves more). `options[i].best` is the best of the four; `share.best` is true when the share is the best of five.
 */
export function compute(plan, params = {}) {
  const b = buildInputs(plan, params);
  if (!b.inputs) return { ready: false, missing: b.missing, notes: b.notes, options: [] };
  const tax = taxSettings(plan, { mode: "brackets" });
  const shared = sharesWithdrawals(plan.retirement);
  const current = shared ? WITHDRAWAL_SHARE.key : orderKey(b.inputs.withdrawalOrder);
  // on the plan's own spending, the same every year (round 8, Batch 5b): the share, years-left and guardrail ways spend what an
  // order saves in tax instead of keeping it, so "left at the end" would not show it
  const runOf = (order, split) => {
    const { withdrawalSplit, ...rest } = b.inputs;
    const r = project({ ...rest, strategy: "fixed-real", withdrawalOrder: order, tax, ...(split ? { withdrawalSplit: WITHDRAWAL_SHARE.key } : {}) });
    const taxesReal = r.rows.reduce((s, x) => s + x.taxes / x.priceLevel, 0);
    const rmdReal = r.rows.reduce((s, x) => s + x.rmd / x.priceLevel, 0);
    return { success: r.success, failYear: r.failYear, endBalanceReal: r.endBalanceReal, endAfterTaxReal: r.endAfterTaxReal, endTaxRate: r.endTaxRate, taxesReal, rmdReal };
  };
  const options = Object.entries(WITHDRAWAL_ORDERS).map(([key, def]) => ({ key, label: def.label, note: def.note, order: def.order, ...runOf(def.order, false), current: key === current }));
  const four = rank(options);
  for (const o of options) o.best = o.key === four.best.key;
  // the fifth: a share from every account, with the plan's own order for money that comes in during a year (what the plan runs once
  // it is saved: "Use this order" keeps that order)
  const share = { key: WITHDRAWAL_SHARE.key, split: WITHDRAWAL_SHARE.key, label: WITHDRAWAL_SHARE.label, note: WITHDRAWAL_SHARE.note, order: [...b.inputs.withdrawalOrder], ...runOf(b.inputs.withdrawalOrder, true), current: shared };
  const all = rank([...options, share]);
  share.best = all.best === share;
  const notes = [...b.notes];
  // the flat-rate note is no longer a line of text here: the page says it in plain words with its own button (`bracketsOn`; stress
  // test 2026-11-11, x-4: "the projection", "federal brackets" and a setting on another page, with no way to act)
  return { ready: true, missing: [], current, options, best: four.best.key, gainVsWorst: four.gainVsWorst, taxSpread: four.taxSpread, allFail: four.allFail, bracketsOn: (plan.retirement?.taxMode ?? "flat") === "brackets", notes, people: b.people, hasDeferred: b.inputs.balances.deferred > 0, hasFree: b.inputs.balances.free > 0, hasTaxable: b.inputs.balances.taxable > 0,
    share, five: { best: all.best.key, gainVsWorst: all.gainVsWorst, taxSpread: all.taxSpread, allFail: all.allFail } };
}

/**
 * agesIn(year, people) -> [{ name, age }] for the first two people with a birth year: their age in that year, as the engine
 * counts it (year - birth year; core/math/retirement.js gives the first person's as `failAge`). Pure; compute() does not call
 * it, so its output is what it was (tests/withdrawal-ways-invariance.test.mjs).
 */
export function agesIn(year, people = []) {
  if (year === null || year === undefined || year === "" || !Number.isFinite(Number(year))) return [];
  return (people ?? []).slice(0, 2).filter((p) => Number.isFinite(Number(p?.birthYear))).map((p) => ({ name: String(p.name ?? "").trim(), age: Number(year) - Number(p.birthYear) }));
}

/**
 * chooseOrder(draft, option): what "Use this order" writes. One of the four: `withdrawalOrder` = its order, and the share taken off.
 * The share: `withdrawalSplit` = "proportional", the order kept as it is. withRates: the tax worked out at the real rates too.
 */
export function chooseOrder(draft, o, { withRates = false } = {}) {
  draft.retirement = draft.retirement ?? {};
  if (o.split === WITHDRAWAL_SHARE.key) draft.retirement.withdrawalSplit = WITHDRAWAL_SHARE.key;
  else { draft.retirement.withdrawalOrder = [...o.order]; delete draft.retirement.withdrawalSplit; }
  if (withRates) draft.retirement.taxMode = "brackets";
}

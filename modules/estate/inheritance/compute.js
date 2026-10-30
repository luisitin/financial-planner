// modules/estate/inheritance/compute.js -- PURE and heavy. An inheritance you might receive, as a
// what-if beside the plan, never inside it: what arrives after tax and costs (an inherited traditional
// IRA is taxed as it is emptied, a house costs money to sell), what it would change if it came (the
// money left at the end, the spending the plan could carry), and the same if it were half as much or
// ten years later. The main plan never counts it.
import { project, affordableSpending, copyInputs } from "../../../core/math/retirement.js";
import { buildInputs } from "../../retirement/projection/compute.js";

/** What each kind leaves after tax and costs: an inherited traditional IRA is taxed as income when it is emptied (within 10 years, SECURE Act); a house sold soon after costs about 6% to sell, with no gains tax on the stepped-up value (IRC 1014); cash and Roth money arrive whole. */
export const KINDS = {
  cash: { label: "Money or investments", net: () => 1 },
  home: { label: "A house (to sell)", net: () => 1 - 0.06 },
  ira: { label: "A traditional IRA or 401(k)", net: (taxRate) => 1 - taxRate },
  roth: { label: "A Roth IRA", net: () => 1 },
};
export const LATER_YEARS = 10;

/** What an item adds to savings, in today's dollars, after tax and costs. */
export const netOf = (item, taxRate) => Math.max(0, Number(item.amount) || 0) * (KINDS[item.kind] ?? KINDS.cash).net(taxRate);

/**
 * compute(plan, { today }) -> {
 *   ready, missing, items: [{ ...item, kindLabel, net }], total, net, taxRate,
 *   base: { success, endReal, affordableMonthly }, withIt: same | null, half: same | null, later: same | null,
 *   extraMonthly (with it, the spending the plan could carry in addition), endGain, spendingMonthly
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const b = buildInputs(plan, { today });
  const raw = plan.estate?.inheritance?.items ?? [];
  const taxRate = b.inputs ? Number(b.inputs.rates?.taxRate ?? 0.15) : 0.15;
  const startYear = b.inputs?.startYear ?? (today ? Number(String(today).slice(0, 4)) : 2026);
  const items = raw.map((x) => ({ ...x, amount: Math.max(0, Number(x.amount) || 0), year: Math.max(startYear, Number(x.year) || startYear), kind: KINDS[x.kind] ? x.kind : "cash", kindLabel: (KINDS[x.kind] ?? KINDS.cash).label, net: netOf(x, taxRate) }));
  const total = items.reduce((s, x) => s + x.amount, 0), net = items.reduce((s, x) => s + x.net, 0);
  if (!b.inputs) return { ready: false, missing: b.missing ?? [], items, total, net, taxRate };
  const I = b.inputs;
  const run = (events) => {
    const T = copyInputs(I); T.events.push(...events);
    const r = project(T);
    return { success: r.success, failYear: r.failYear ?? null, endReal: r.endBalanceReal, affordableMonthly: affordableSpending(T) / 12 };
  };
  const ev = (scale = 1, shift = 0) => items.filter((x) => x.net > 0).map((x) => ({ year: Math.min(I.endYear, x.year + shift), amount: -x.net * scale, label: `inheritance from ${x.from || "family"}` }));
  const base = run([]);
  const withIt = items.length ? run(ev()) : null;
  const half = items.length ? run(ev(0.5)) : null;
  const later = items.length ? run(ev(1, LATER_YEARS)) : null;
  return {
    ready: true, missing: [], items, total, net, taxRate, base, withIt, half, later,
    spendingMonthly: I.spending.yearly / 12,
    extraMonthly: withIt ? withIt.affordableMonthly - base.affordableMonthly : 0,
    endGain: withIt ? withIt.endReal - base.endReal : 0,
  };
}

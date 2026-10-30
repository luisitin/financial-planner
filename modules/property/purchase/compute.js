// modules/property/purchase/compute.js -- PURE. Any big purchase, three ways: save up for it by the date you
// want it (and the interest that earns), finance it now (the payment and the interest it costs), or pay now from
// cash. Each against the money left over each month, and when that is not enough, which goals give way (the
// least important first) and how many months later they arrive.
import { pmt, pmtToReach } from "../../../core/math/finance.js";
import { monthsBetween } from "../../../core/math/dates.js";
import { compute as computeNext } from "../../overview/next-best-action/compute.js";
import { compute as computeGoals } from "../../goals/goals/compute.js";
import { compute as computeLiquidity } from "../../balance/liquidity/compute.js";
import { solveMonths } from "../../goals/house/compute.js";

export const DEFAULTS = { name: "", price: 3000, salesTax: 0, when: "", saved: 0, apr: 0.22, termMonths: 24, promoMonths: 0 };

/** Take `need` a month from goals, the least important first (then the latest due): { list: [{ id, name, from, was, now, paused, monthsLater (null when paused) }], uncovered }. */
export function giveWay(goals, need) {
  const order = goals.filter((g) => g.status !== "done" && (Number(g.monthly) || 0) > 0)
    .sort((a, b) => (Number(b.priority) || 2) - (Number(a.priority) || 2) || String(b.targetDate ?? "9999").localeCompare(String(a.targetDate ?? "9999")));
  const out = [];
  let left = need;
  for (const g of order) {
    if (left <= 0.005) break;
    const was = Number(g.monthly), take = Math.min(was, left), now = was - take;
    const r = (g.rate ?? 0) / 12, goal = g.targetThen ?? g.target, start = g.funded ?? 0;
    const before = solveMonths(r, start, was, goal), after = solveMonths(r, start, now, goal);
    out.push({ id: g.id, name: g.name, from: take, was, now, paused: now <= 0.005, monthsLater: now <= 0.005 || !Number.isFinite(after) ? null : after - (Number.isFinite(before) ? before : 0) });
    left -= take;
  }
  return { list: out, uncovered: Math.max(0, left) };
}

/**
 * compute(plan, { today }) -> {
 *   inputs, total (price with sales tax), months (to the date wanted; null without one), spare (a month, after saving and goals),
 *   save: { monthly, months, earned } | null, finance: { principal, payment, months, interest, promo } , cash: { fits, after, target },
 *   effect: { save: giveWay | null, finance: giveWay }
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const s = plan.whatIfs?.purchase ?? {};
  const x = {};
  for (const [k, v] of Object.entries(DEFAULTS)) x[k] = s[k] === null || s[k] === undefined || s[k] === "" ? v : typeof v === "number" ? Number(s[k]) : s[k];
  const total = Math.max(0, x.price) * (1 + Math.max(0, x.salesTax));
  const saved = Math.min(total, Math.max(0, x.saved));
  const months = x.when && today ? Math.max(1, monthsBetween(today, x.when)) : null;
  const cashRate = Number(plan.assumptions?.returnCash ?? 0.02);
  const nb = computeNext(plan, { today });
  const spare = nb.ready ? nb.spare.monthly : 0;
  const gl = computeGoals(plan, { today });

  // save up: a monthly amount that, with the saved money and interest, reaches the total by the date
  const save = months ? (() => { const monthly = Math.max(0, pmtToReach(cashRate / 12, months, total, saved)); return { monthly, months, earned: Math.max(0, total - saved - monthly * months) }; })() : null;
  // finance now: what is not saved, over the term; a 0% offer for its first months
  const principal = total - saved, n = Math.max(1, Math.round(x.termMonths)), promo = Math.min(n, Math.max(0, Math.round(x.promoMonths)));
  let payment, interest;
  if (promo >= n) { payment = principal / n; interest = 0; }
  else if (promo > 0) {
    // equal payments that clear it by the end, nothing charged in the free months
    const r = x.apr / 12;
    const f = (p) => { let b = principal; for (let m = 0; m < n; m++) b = (m < promo ? b : b * (1 + r)) - p; return b; };
    let lo = 0, hi = principal; while (f(hi) > 0) hi *= 2;
    for (let k = 0; k < 80; k++) { const mid = (lo + hi) / 2; if (f(mid) > 0) lo = mid; else hi = mid; }
    payment = hi; interest = payment * n - principal;
  } else { payment = x.apr > 0 ? pmt(x.apr / 12, n, principal) : principal / n; interest = payment * n - principal; }
  const finance = { principal, payment, months: n, interest, promo };
  const liq = computeLiquidity(plan, { today });
  const cash = { fits: (liq.now ?? 0) >= total, after: (liq.now ?? 0) - total, target: liq.target ?? null };
  const effect = {
    save: save ? giveWay(gl.goals, Math.max(0, save.monthly - Math.max(0, spare))) : null,
    finance: giveWay(gl.goals, Math.max(0, payment - Math.max(0, spare))),
  };
  return { inputs: x, total, saved, months, spare, save, finance, cash, effect, ready: total > 0 };
}

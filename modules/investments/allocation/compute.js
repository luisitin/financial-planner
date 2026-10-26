// modules/investments/allocation/compute.js -- PURE. Your actual mix by asset class across every
// investment account (from the holdings, with balanced and target-date funds split up) against
// the mix you aim for, how far each class has drifted, and whether the drift crosses the band
// that calls for a rebalance (the 5/25 rule: 5 points absolute, or a quarter of the target).
import { compute as computeHoldings, ASSET_CLASSES } from "../holdings/compute.js";

export const TARGET_CLASSES = ["us_stocks", "intl_stocks", "bonds", "cash", "real_estate", "other"];

/** The plan's target mix as fractions over TARGET_CLASSES: the owner's, or one built from the retirement stock share (60/40 US/international, the rest bonds). */
export function targetMix(plan) {
  const t = plan.investments?.target;
  if (t && typeof t === "object" && Object.values(t).some((v) => Number(v) > 0)) {
    const sum = TARGET_CLASSES.reduce((s, c) => s + (Number(t[c]) || 0), 0) || 1;
    return { mix: Object.fromEntries(TARGET_CLASSES.map((c) => [c, (Number(t[c]) || 0) / sum])), source: "own" };
  }
  const stocks = Math.min(1, Math.max(0, Number(plan.retirement?.stocksNow ?? 0.7)));
  return { mix: { us_stocks: stocks * 0.6, intl_stocks: stocks * 0.4, bonds: 1 - stocks, cash: 0, real_estate: 0, other: 0 }, source: "plan" };
}

/**
 * compute(plan, { today }) -> {
 *   ready, total, rows: [{ cls, label, icon, actual (fraction), target, drift, value, targetValue, move (dollars to reach target), flagged, reason }],
 *   band, flaggedCount, worst (the biggest drift), stockShareActual, stockShareTarget, target (mix), targetSource,
 *   unknownValue (not classified), coverage: { holdingsValue, investedBalance, share }, byAccountClass: [{ account, classes: { cls: value } }], notes
 * }
 */
export function compute(plan, params = {}) {
  const h = computeHoldings(plan, params);
  const { mix: target, source } = targetMix(plan);
  const band = Math.min(0.5, Math.max(0.01, Number(plan.investments?.band ?? 0.05)));
  const classified = h.byClass.filter((c) => c.cls !== "unknown");
  const total = classified.reduce((s, c) => s + c.value, 0);
  const unknownValue = h.byClass.find((c) => c.cls === "unknown")?.value ?? 0;
  const rows = TARGET_CLASSES.map((cls) => {
    const value = classified.find((c) => c.cls === cls)?.value ?? 0;
    const actual = total > 0 ? value / total : 0;
    const t = target[cls] ?? 0;
    const drift = actual - t;
    const flagged = t > 0 || actual > 0 ? Math.abs(drift) > band || (t > 0 && Math.abs(drift) > 0.25 * t) : false;
    return { cls, label: ASSET_CLASSES[cls].label, icon: ASSET_CLASSES[cls].icon, actual, target: t, drift, value, targetValue: t * total, move: t * total - value, flagged, reason: flagged ? (Math.abs(drift) > band ? `${Math.round(Math.abs(drift) * 100)} points off` : `more than a quarter off its ${Math.round(t * 100)}%`) : "" };
  }).filter((r) => r.actual > 0 || r.target > 0);
  const stocksOf = (m) => TARGET_CLASSES.filter((c) => ASSET_CLASSES[c].kind === "stocks").reduce((s, c) => s + (m[c] ?? 0), 0);
  const actualMix = Object.fromEntries(rows.map((r) => [r.cls, r.actual]));
  const worst = rows.reduce((a, r) => !a || Math.abs(r.drift) > Math.abs(a.drift) ? r : a, null);
  const investedBalance = h.byAccount.reduce((s, a) => s + a.balance, 0);
  const byAccountClass = h.byAccount.filter((a) => a.count).map((a) => {
    const classes = {};
    for (const x of h.items.filter((i) => i.accountId === a.accountId)) for (const [cls, w] of Object.entries(x.mix)) classes[cls] = (classes[cls] ?? 0) + x.value * w;
    return { account: a.name, accountId: a.accountId, bucket: a.bucket, value: a.value, classes };
  });
  const notes = [];
  if (unknownValue > 0) notes.push(`${Math.round(unknownValue).toLocaleString("en-US")} of holdings have no asset class yet and are left out; pick classes on the Holdings page.`);
  if (investedBalance > h.total * 1.05 && h.total > 0) notes.push(`The holdings cover ${Math.round(h.total / investedBalance * 100)}% of the ${Math.round(investedBalance).toLocaleString("en-US")} in your investment accounts (Net worth); the rest is not broken down yet.`);
  if (source === "plan") notes.push(`No target of your own yet: the target is built from the ${Math.round(Number(plan.retirement?.stocksNow ?? 0.7) * 100)}% stock share on the Projection page (60/40 US/international, the rest bonds). Set your own below.`);
  return {
    ready: h.hasData && total > 0, total, rows, band, flaggedCount: rows.filter((r) => r.flagged).length, worst,
    stockShareActual: stocksOf(actualMix), stockShareTarget: stocksOf(target), target, targetSource: source, unknownValue,
    coverage: { holdingsValue: h.total, investedBalance, share: investedBalance > 0 ? h.total / investedBalance : 1 }, byAccountClass, notes, holdings: h,
  };
}

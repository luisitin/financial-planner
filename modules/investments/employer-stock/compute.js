// modules/investments/employer-stock/compute.js -- PURE. How much of your wealth rides on the company you
// work for: its shares you hold (brokerage, 401(k)), options already vested, and grants still to vest (RSUs
// and options, on their vesting schedule); the share of your invested wealth that makes, what a halving of
// the price would take while your pay depends on the same company, the tax the next year's vests bring
// against the 22% withheld, and how much to sell to get under 10%, with what that costs in tax.
import { addMonths } from "../../../core/math/dates.js";
import { compute as computeHoldings } from "../holdings/compute.js";
import { compute as computeNetWorth } from "../../balance/net-worth/compute.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeState } from "../../taxes/state/compute.js";
import { taxInputs } from "../../taxes/federal/compute.js";
import { marginalRate, federalTax } from "../../../core/math/tax.js";

/** Share of invested wealth in one company: up to 10% is the usual ceiling for a single stock; above 25% is a large bet. */
export const LIMIT = { ok: 0.10, large: 0.25 };
/** Federal withholding on supplemental wages such as vesting RSUs: 22% flat, 37% on the part above $1 million in a year (IRS Publication 15). */
export const SUPPLEMENTAL = { rate: 0.22, over: 1e6, high: 0.37 };
export const STRESS_DROP = 0.5;
export const DEFAULT_GRANT = { vestMonths: 48, cliffMonths: 12, every: 3 };

/** A grant's vesting: [{ date, shares, cumulative }], whole shares, the cliff's share first, then every `every` months to `vestMonths`. */
export function vestSchedule(g) {
  const shares = Math.max(0, Math.floor(Number(g.shares) || 0));
  const total = Math.max(1, Number(g.vestMonths) || DEFAULT_GRANT.vestMonths);
  const cliff = Math.min(total, Math.max(0, Number(g.cliffMonths ?? DEFAULT_GRANT.cliffMonths)));
  const every = Math.max(1, Number(g.every) || DEFAULT_GRANT.every);
  const start = g.vestStart || g.granted;
  if (!start || !shares) return [];
  const months = [];
  for (let m = cliff > 0 ? cliff : every; m < total; m += every) months.push(m);
  if (months[months.length - 1] !== total) months.push(total);
  const out = [];
  let prev = 0;
  for (const m of months) {
    const cum = Math.floor(shares * m / total + 1e-9);
    if (cum > prev) out.push({ date: addMonths(start, m), shares: cum - prev, cumulative: cum });
    prev = cum;
  }
  return out;
}

/**
 * compute(plan, { today }) -> {
 *   ready, symbol, price, priceAsOf, held: [{ account, bucket, shares, value, cost, gain }], heldValue,
 *   grants: [{ id, kind, name, shares, strike, vested, unvested, vestedValue, unvestedValue, next, expires, schedule }],
 *   owned (held + vested options' value), unvested, exposure, invested, share (exposure of invested wealth incl. unvested), level,
 *   pay (yearly salary at the company), stress: { drop, loss, payAtRisk },
 *   vests: [{ date, grant, shares, value, withheld, owed, gap }] (RSUs, the next 12 months), vestGap,
 *   diversify: { sell, fromTaxable, fromPlans, tax, after } | null, rates: { marginal, state, gains }
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const eq = plan.equity ?? {};
  const symbol = String(eq.symbol ?? "").trim().toUpperCase();
  const grantsIn = (eq.grants ?? []).filter((g) => Number(g.shares) > 0);
  if (!symbol && !grantsIn.length) return { ready: false };
  const ho = computeHoldings(plan, { today });
  const mine = ho.items.filter((h) => symbol && h.symbol === symbol);
  const priced = mine.filter((h) => h.priced).sort((a, b) => String(b.priceAsOf ?? "").localeCompare(String(a.priceAsOf ?? "")));
  const typed = Number(eq.price) > 0 ? Number(eq.price) : null;
  const price = typed !== null && (!priced.length || String(eq.priceAsOf ?? "") >= String(priced[0].priceAsOf ?? "")) ? typed : priced[0]?.price ?? typed ?? 0;
  const priceAsOf = price === typed ? eq.priceAsOf ?? null : priced[0]?.priceAsOf ?? null;
  const held = mine.map((h) => ({ id: h.id, account: h.accountName, bucket: h.bucket, shares: h.shares, value: h.shares * price, cost: h.costBasis, gain: h.shares * price - h.costBasis }));
  const heldValue = held.reduce((s, h) => s + h.value, 0);
  const at = (p) => (g) => (g.kind === "option" ? Math.max(0, p - (Number(g.strike) || 0)) : p);
  const grants = grantsIn.map((g) => {
    const schedule = vestSchedule(g);
    const vested = schedule.filter((e) => !today || e.date <= today).reduce((s, e) => s + e.shares, 0);
    const unvested = schedule.reduce((s, e) => s + e.shares, 0) - vested;
    const each = at(price)(g);
    const expires = g.kind === "option" && g.granted ? addMonths(g.granted, 120) : null;
    return { id: g.id, kind: g.kind === "option" ? "option" : "rsu", name: g.name || (g.kind === "option" ? "Stock options" : "Restricted stock units"), shares: Math.floor(Number(g.shares)), strike: g.kind === "option" ? Number(g.strike) || 0 : null, vested, unvested, vestedValue: g.kind === "option" ? vested * each : 0, unvestedValue: unvested * each, next: schedule.find((e) => !today || e.date > today) ?? null, expires, schedule };
  });
  const options = grants.filter((g) => g.kind === "option");
  const owned = heldValue + options.reduce((s, g) => s + g.vestedValue, 0);
  const unvested = grants.reduce((s, g) => s + g.unvestedValue, 0);
  const exposure = owned + unvested;
  const nw = computeNetWorth(plan, { today });
  const invested = nw.investable + options.reduce((s, g) => s + g.vestedValue, 0) + unvested;
  const share = invested > 0 ? exposure / invested : null;
  const level = share === null ? "large" : share <= LIMIT.ok ? "ok" : share <= LIMIT.large ? "medium" : "large";

  // the pay that depends on the same company
  const people = plan.household?.people ?? [];
  const inc = (plan.income ?? []).length ? computeIncome(plan, { today }) : null;
  const who = eq.personId || inc?.active.find((x) => x.type === "salary")?.personId || null;
  const pay = inc ? inc.active.filter((x) => ["salary", "bonus"].includes(x.type) && (!who || x.personId === who)).reduce((s, x) => s + x.yearly, 0) : 0;
  const optionsAt = (p) => options.reduce((s, g) => s + (g.vested + g.unvested) * at(p)(g), 0);
  const rsuAndHeld = heldValue + grants.filter((g) => g.kind === "rsu").reduce((s, g) => s + g.unvestedValue, 0);
  const loss = rsuAndHeld * STRESS_DROP + (optionsAt(price) - optionsAt(price * (1 - STRESS_DROP)));

  // tax: vesting RSUs are pay; 22% is withheld federally
  const ti = taxInputs(plan, { today });
  const marginal = Math.max(0.1, marginalRate(ti.inputs, ti.params) || 0.22);
  const base = federalTax(ti.inputs, ti.params).totalTax;
  const gains = Math.max(0, (federalTax({ ...ti.inputs, qualifiedIncome: (ti.inputs.qualifiedIncome ?? 0) + 1000 }, ti.params).totalTax - base) / 1000);
  const st = computeState(plan, { today });
  const stateRate = st.effective ?? 0;
  const horizon = today ? addMonths(today, 12) : null;
  const vests = [];
  for (const g of grants.filter((x) => x.kind === "rsu")) for (const e of g.schedule) if (today && e.date > today && e.date <= horizon) {
    const value = e.shares * price, withheld = value * SUPPLEMENTAL.rate, owed = value * marginal;
    vests.push({ date: e.date, grant: g.name, shares: e.shares, value, withheld, owed, gap: owed - withheld, stateOwed: value * stateRate });
  }
  vests.sort((a, b) => a.date.localeCompare(b.date));

  // getting under the ceiling: sell inside retirement plans first (no tax), then taxable shares (gains tax on the gain)
  let diversify = null;
  if (share !== null && share > LIMIT.ok && heldValue > 0) {
    const need = Math.min(heldValue, exposure - LIMIT.ok * invested);
    const plans = held.filter((h) => h.bucket !== "taxable").reduce((s, h) => s + h.value, 0);
    const fromPlans = Math.min(need, plans), fromTaxable = need - fromPlans;
    const taxable = held.filter((h) => h.bucket === "taxable");
    const tv = taxable.reduce((s, h) => s + h.value, 0), tg = taxable.reduce((s, h) => s + Math.max(0, h.gain), 0);
    const tax = tv > 0 ? fromTaxable * (tg / tv) * gains : 0;
    diversify = { sell: need, fromPlans, fromTaxable, tax, after: invested > 0 ? (exposure - need) / invested : null, stillOver: need < exposure - LIMIT.ok * invested - 0.5 };
  }
  return {
    ready: true, symbol, price, priceAsOf, held, heldValue, grants, owned, unvested, exposure, invested, share, level,
    person: people.find((p) => p.id === who)?.name ?? null, pay, stress: { drop: STRESS_DROP, loss, payAtRisk: pay },
    vests, vestGap: vests.reduce((s, v) => s + v.gap, 0), diversify, rates: { marginal, state: stateRate, gains },
    expiringSoon: options.filter((g) => g.expires && today && g.expires <= addMonths(today, 12) && g.vested > 0),
  };
}

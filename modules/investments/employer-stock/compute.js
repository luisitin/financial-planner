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
import { taxInputs, todaysReturn, addIncome, lossCarryover } from "../../taxes/federal/compute.js";
export { addIncome };   // it lived here first; the federal estimate keeps it now
import { marginalRate, federalTax } from "../../../core/math/tax.js";

/** Share of invested wealth in one company: up to 10% is the usual ceiling for a single stock; above 25% is a large bet. */
export const LIMIT = { ok: 0.10, large: 0.25 };
/** Federal withholding on supplemental wages such as vesting RSUs: 22% flat, 37% on the part of the year's supplemental wages above $1 million (IRS Publication 15; 26 CFR 31.3402(g)-1). */
export const SUPPLEMENTAL = { rate: 0.22, over: 1e6, high: 0.37 };
/** The employer withholds the 0.9% Additional Medicare Tax on an employee's wages above $200,000 in a calendar year, whatever the filing status (IRC 3102(f)). */
export const ADDITIONAL_MEDICARE = { rate: 0.009, over: 200000 };

/** Federal income tax withheld on supplemental wages `value` when `before` of the year's supplemental wages came earlier: 22%, and 37% on the part past $1 million. */
export function supplementalWithholding(value, before = 0) {
  const low = Math.max(0, Math.min(value, SUPPLEMENTAL.over - before));
  return low * SUPPLEMENTAL.rate + (value - low) * SUPPLEMENTAL.high;
}
/** The state tax `extra` income adds, from the state estimate (`taxes/state`): its rate on the part above its allowance, last year's share of income, or nothing where there is no rate. */
export function stateExtra(st, extra) {
  if (!st || !(st.rate > 0) || !(extra > 0)) return 0;
  if (st.method === "prior") return st.rate * extra;
  const agi = Number(st.agi) || 0, allowance = Number(st.allowance) || 0;
  return st.rate * (Math.max(0, agi + extra - allowance) - Math.max(0, agi - allowance));
}

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
 *   owned (held + vested options' value), unvested, exposure, invested, share (exposure of invested wealth incl. unvested), level
 *   ("ok" | "medium" | "large", null with no share and no stake), pay (yearly salary at the company), payOnFile, stress: { drop, loss, payAtRisk },
 *   vests: [{ date, grant, shares, value, withheld, owed, gap, stateOwed }] (RSUs, the next 12 months), vestYears: [{ year, value,
 *   earlier, owed, withheld, gap, state, over1m, medicare, estimated (that year's tax tables are not published yet) }],
 *   wholeYear: { year (today's tax year), value (every vest dated in it, earlier ones too), vests, earlier, owed, withheld, medicare, gap } | null,
 *   wholeYears: [the same for each year in vestYears, every vest dated in it] (the set-aside the page says per year), vestGap,
 *   diversify: { sell, fromTaxable, fromPlans, gain (negative for a loss), tax (negative when the sale lowers it), carry (the
 *   loss it adds to next year's carryover), after, stillOver } | null,
 *   rates: { marginal, state, gains }, year, otherYear
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
  const accounts = plan.accounts ?? [];
  const held = mine.map((h) => ({ id: h.id, accountId: h.accountId, account: h.accountName, bucket: h.bucket, shares: h.shares, value: h.shares * price, cost: h.costBasis, gain: h.shares * price - h.costBasis }));
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
  // no level without a share: nothing invested and no stake is not a bet (the share is shown as "—" then)
  const level = share === null ? (exposure > 0 ? "large" : null) : share <= LIMIT.ok ? "ok" : share <= LIMIT.large ? "medium" : "large";

  // the pay that depends on the same company. Who works there is an adult: the one named, else the first adult with a salary,
  // else the adult marked Me; pay that names no adult counts as Me's (the federal estimate's rule, taxes/federal taxInputs)
  const people = plan.household?.people ?? [];
  const adults = people.filter((p) => p.role !== "dependent");
  const me = adults.find((p) => p.role === "self") ?? adults[0] ?? null;
  const adultOf = (id) => (id ? adults.find((p) => p.id === id) ?? null : null);
  const inc = (plan.income ?? []).length ? computeIncome(plan, { today }) : null;
  const payRows = inc ? inc.active.filter((x) => ["salary", "bonus"].includes(x.type)) : [];
  const worker = adultOf(eq.personId) ?? adultOf(payRows.find((x) => x.type === "salary" && adultOf(x.personId))?.personId) ?? me;
  const who = worker?.id ?? null;
  const pay = payRows.filter((x) => !worker || (adultOf(x.personId) ?? me) === worker).reduce((s, x) => s + x.yearly, 0);
  const optionsAt = (p) => options.reduce((s, g) => s + (g.vested + g.unvested) * at(p)(g), 0);
  const rsuAndHeld = heldValue + grants.filter((g) => g.kind === "rsu").reduce((s, g) => s + g.unvestedValue, 0);
  const loss = rsuAndHeld * STRESS_DROP + (optionsAt(price) - optionsAt(price * (1 - STRESS_DROP)));

  // tax: vesting units are wages at their value when the shares are delivered, normally the vest date (IRC 83(a); IRS Pub.
  // 525). A calendar year's tax: the federal estimate for that year (today's through todaysReturn; the year set on the Federal
  // estimate with its typed sales; any other year without them) with the year's earlier vests (dated up to today, at today's
  // price) already in the employee's wages and Medicare wages, then the vests in view added, less without them: so it crosses
  // brackets, phase-outs and the 0.9% Additional Medicare Tax. Each vest takes its share by value. Withheld = 22% federal, 37%
  // on the year's supplemental wages past $1 million counting the earlier vests (IRS Pub. 15 (2026), section 7; 26 CFR
  // 31.3402(g)-1), plus the employer's 0.9% on its wages to the employee past $200,000 in the calendar year (IRC 3102(f)(1)).
  const yr = todaysReturn(plan, today);
  const setYear = Number(plan.taxes?.year) || null;
  const inputsFor = (year) => year === yr.year ? taxInputs(yr.plan, { today })
    : year === setYear ? taxInputs(plan, { today })
    : taxInputs({ ...plan, taxes: { ...(plan.taxes ?? {}), year, gains: [] } }, { today });
  const ti = inputsFor(yr.year);
  const marginal = Math.max(0, marginalRate(ti.inputs, ti.params) || 0);
  const gains = Math.max(0, (federalTax({ ...ti.inputs, qualifiedIncome: (ti.inputs.qualifiedIncome ?? 0) + 1000, investmentIncome: (Number(ti.inputs.investmentIncome) || 0) + 1000 }, ti.params).totalTax - federalTax(ti.inputs, ti.params).totalTax) / 1000);
  const st = computeState(plan, { today });
  const stateRate = st.effective ?? 0;
  // filing separately the vests are on the employee's own state return too (Illinois: 35 ILCS 5/502(c)(1)(C), each spouse with
  // their own income and exemption), so the state share starts from that return's income, not both returns added up
  const ownReturn = ti.inputs.separate ? federalTax(ti.inputs, ti.params).separate?.find((x) => x.personId != null && x.personId === who) : null;
  const stOwn = ownReturn ? { ...st, agi: Math.max(0, Number(ownReturn.agi) || 0) } : st;
  // the employer's wages to the employee, for the 0.9% it withholds past $200,000: their pay on Income; without any, the wages
  // typed on the Federal estimate (their own return's when filing separately, else split evenly between the adults on it)
  const wagesOf = (t) => {
    if (pay > 0 || payRows.length) return pay;
    const part = t.separate?.find((x) => x.personId === who);
    if (part) return Number(part.medicareWages ?? part.wages) || 0;
    const filers = t.filingStatus === "married_joint" ? Math.max(1, Math.min(2, adults.length)) : 1;
    return (Number(t.inputs.medicareWages ?? t.inputs.wages) || 0) / filers;
  };
  const horizon = today ? addMonths(today, 12) : null;
  const rsus = grants.filter((x) => x.kind === "rsu");
  const vests = [];
  for (const g of rsus) for (const e of g.schedule) if (today && e.date > today && e.date <= horizon) vests.push({ date: e.date, grant: g.name, shares: e.shares, value: e.shares * price });
  vests.sort((a, b) => a.date.localeCompare(b.date));
  const earlierIn = (y) => today ? rsus.reduce((s, g) => s + g.schedule.filter((e) => e.date <= today && Number(e.date.slice(0, 4)) === y).reduce((t, e) => t + e.shares * price, 0), 0) : 0;
  const wagesAdd = (x) => ({ wages: x, medicareWages: x });
  const vestYears = [];
  for (const y of [...new Set(vests.map((v) => Number(v.date.slice(0, 4))))]) {
    const inYear = vests.filter((v) => Number(v.date.slice(0, 4)) === y), total = inYear.reduce((s, v) => s + v.value, 0);
    const earlier = earlierIn(y);
    const t = inputsFor(y), beforeInputs = addIncome(t.inputs, who, wagesAdd(earlier));
    const owedYear = Math.max(0, federalTax(addIncome(beforeInputs, who, wagesAdd(total)), t.params).totalTax - federalTax(beforeInputs, t.params).totalTax);
    const paid = wagesOf(t) + earlier;
    const medicareHeld = ADDITIONAL_MEDICARE.rate * (Math.max(0, paid + total - ADDITIONAL_MEDICARE.over) - Math.max(0, paid - ADDITIONAL_MEDICARE.over));
    // the state's share: its rate on the vests above today's income (and this year's earlier vests), from the state estimate
    const stateYear = stateExtra(stOwn, total + (y === yr.year ? earlier : 0)) - stateExtra(stOwn, y === yr.year ? earlier : 0);
    let supplementalSoFar = earlier;
    for (const v of inYear) {
      const income = supplementalWithholding(v.value, supplementalSoFar);
      supplementalSoFar += v.value;
      v.withheld = income + (total > 0 ? medicareHeld * v.value / total : 0);
      v.owed = total > 0 ? owedYear * v.value / total : 0;
      v.gap = v.owed - v.withheld;
      v.stateOwed = total > 0 ? stateYear * v.value / total : 0;
    }
    const withheld = inYear.reduce((s, v) => s + v.withheld, 0);
    vestYears.push({ year: y, value: total, earlier, owed: owedYear, withheld, gap: owedYear - withheld, state: stateYear, over1m: supplementalSoFar > SUPPLEMENTAL.over, medicare: medicareHeld, estimated: !!t.params.indexed });
  }

  // the whole of today's tax year (round 8, equity-2): every vest dated in it, the earlier ones too, against the return without
  // any of them, so the set-aside covers the year's return as Equity compensation's does ($1,398, where `vestYears` holds
  // only the vests still to come: $300). `vestYears` stays as the answer key checks it.
  // each later year in view the same way (round 8 review: "For 2027: set aside about $52" counted only the 2027 vests inside
  // the next 12 months, March to September, where Equity compensation counts all four): `wholeYears`, one per vestYears row
  const wholeOf = (year) => {
    if (!today || !rsus.length) return null;
    const all = rsus.flatMap((g) => g.schedule.filter((e) => Number(e.date.slice(0, 4)) === year).map((e) => ({ date: e.date, value: e.shares * price })));
    const total = all.reduce((s, v) => s + v.value, 0);
    if (!(total > 0)) return null;
    const t = year === yr.year ? ti : inputsFor(year), owed = Math.max(0, federalTax(addIncome(t.inputs, who, wagesAdd(total)), t.params).totalTax - federalTax(t.inputs, t.params).totalTax);
    const paid = wagesOf(t);
    const medicare = ADDITIONAL_MEDICARE.rate * (Math.max(0, paid + total - ADDITIONAL_MEDICARE.over) - Math.max(0, paid - ADDITIONAL_MEDICARE.over));
    const withheld = supplementalWithholding(total) + medicare;
    return { year, value: total, vests: all.length, earlier: all.filter((v) => v.date <= today).reduce((s, v) => s + v.value, 0), owed, withheld, medicare, gap: owed - withheld };
  };
  const wholeYear = wholeOf(yr.year);
  const wholeYears = vestYears.map((y) => (y.year === yr.year ? wholeYear : wholeOf(y.year))).filter(Boolean);

  // getting under the ceiling: sell inside retirement plans first (no tax), then taxable shares (gains tax on the gain)
  let diversify = null;
  if (share !== null && share > LIMIT.ok && heldValue > 0) {
    const need = Math.min(heldValue, exposure - LIMIT.ok * invested);
    const plans = held.filter((h) => h.bucket !== "taxable").reduce((s, h) => s + h.value, 0);
    const fromPlans = Math.min(need, plans), fromTaxable = need - fromPlans;
    const taxable = held.filter((h) => h.bucket === "taxable");
    const tv = taxable.reduce((s, h) => s + h.value, 0), tg = taxable.reduce((s, h) => s + h.gain, 0);
    // the gain or loss on what is sold (the brokerage shares' average result), as long-term sales added to today's tax year on
    // the Federal estimate, with this year's vests in the employee's wages (the earlier ones and those in view); the tax with
    // them less without. So a gain is stacked through the 0/15/20% bands and the 3.8% (IRC 1(h), 1411), and a loss nets with
    // the year's other sales, comes off other income up to $3,000 ($1,500 filing separately) and carries over the rest (IRC
    // 1211(b), 1212(b)). Filing separately each account's share is on its owner's return (Pub. 501), half on each when the
    // account names neither spouse (taxes/federal taxInputs).
    const gain = tv > 0 ? fromTaxable * (tg / tv) : 0;
    let tax = 0, carry = 0;
    if (Math.abs(gain) > 0.005) {
      const yearVests = earlierIn(yr.year) + vests.filter((v) => Number(v.date.slice(0, 4)) === yr.year).reduce((s, v) => s + v.value, 0);
      const rows = taxable.map((h, n) => {
        const sold = fromTaxable * h.value / tv, g = gain * h.value / tv, owner = adultOf(accounts.find((a) => a.id === h.accountId)?.ownerId)?.id ?? null;
        return { id: `employer-stock-${n}`, description: "Employer stock", proceeds: Math.max(0, sold), basis: Math.max(0, sold - g), held: "long", ...(owner ? { personId: owner } : {}) };
      });
      const run = (extra) => {
        const t = extra.length ? taxInputs({ ...yr.plan, taxes: { ...(yr.plan.taxes ?? {}), gains: [...(yr.plan.taxes?.gains ?? []), ...extra] } }, { today }) : ti;
        const r = federalTax(addIncome(t.inputs, who, wagesAdd(yearVests)), t.params);
        return { r, carry: lossCarryover(t, r).total };
      };
      const without = run([]), withSale = run(rows);
      tax = withSale.r.totalTax - without.r.totalTax;
      carry = Math.max(0, withSale.carry - without.carry);
    }
    diversify = { sell: need, fromPlans, fromTaxable, gain, tax, carry, after: invested > 0 ? (exposure - need) / invested : null, stillOver: need < exposure - LIMIT.ok * invested - 0.5 };
  }
  return {
    ready: true, symbol, price, priceAsOf, held, heldValue, grants, owned, unvested, exposure, invested, share, level,
    person: worker?.name ?? null, pay, payOnFile: pay > 0, stress: { drop: STRESS_DROP, loss, payAtRisk: pay },
    vests, vestYears, ...(wholeYear ? { wholeYear } : {}), wholeYears, vestGap: vests.reduce((s, v) => s + v.gap, 0), diversify, rates: { marginal, state: stateRate, gains }, year: yr.year, otherYear: yr.other,
    expiringSoon: options.filter((g) => g.expires && today && g.expires <= addMonths(today, 12) && g.vested > 0),
  };
}

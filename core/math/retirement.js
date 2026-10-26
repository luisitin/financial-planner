// core/math/retirement.js -- the year-by-year retirement projection. PURE, plan-agnostic:
// modules/retirement/projection/compute.js turns the plan into an `inputs` object; this file
// runs it under any return sequence, so the same engine serves the expected-return projection,
// the Monte Carlo paths, the historical backtest and the withdrawal-strategy comparisons.
//
// Money is in nominal dollars year by year (inflation applied), and every row also carries the
// real (today's-dollars) view. Balances sit in four buckets: cash (everyday accounts, earns the
// cash rate), taxable, deferred (pre-tax: 401(k), IRA), free (Roth, HSA). Contributions go in
// while a person works; in retirement the gap between spending and guaranteed income is taken
// from the buckets in the chosen order (default cash -> taxable -> deferred -> free), the year's
// tax is settled from the same buckets, and required minimum distributions force deferred money
// out (the excess lands in taxable). Tax is either a flat rate on pre-tax withdrawals (the quick
// setting) or the federal brackets on the year's whole taxable income (income, withdrawals, the
// taxable part of Social Security, gains and dividends from the taxable bucket), with optional
// Roth conversions that fill a bracket before required withdrawals begin. The plan "fails" in
// the first year the buckets cannot cover the gap.
import { pmt } from "./finance.js";
import { rmdFactor } from "./rmd.js";
import { federalTax, roomUnder, bracketTop } from "./tax.js";

export const STRATEGIES = {
  "fixed-real": "The same spending every year, adjusted for inflation",
  "percent": "A fixed percentage of what is left each year",
  "guardrails": "Inflation-adjusted, cut 10% after a bad stretch, raise 10% after a good one",
  "vpw": "Spend what the remaining years can afford (variable percentage)",
};

/**
 * project(inputs, options) -> { rows, success, failYear, failAge, endBalance, endBalanceReal, endAfterTax, endAfterTaxReal, endTaxRate, totalWithdrawn, totalTaxes, totalConverted, years, taxMode, withdrawalOrder }
 * inputs: {
 *   startYear, endYear,                             // calendar years, inclusive
 *   people: [{ name, birthYear, retireAge, endAge }],// adults; the first is the primary
 *   balances: { cash, taxable, deferred, free },
 *   contributions: [{ bucket, yearly, personIndex, untilAge? }],  // today's dollars, grow with salaryGrowth until that person retires
 *   incomes: [{ name, yearly, personIndex, startAge, endAge?, cola: bool, taxable: bool }], // pensions, Social Security, part-time; today's dollars unless cola=false
 *   spending: { yearly },                            // today's dollars, in retirement (fixed-real base)
 *   retireYear,                                     // first year of retirement for the household (spending starts)
 *   rates: { inflation, cash, salaryGrowth, taxRate, stocksNow, stocksRetired },
 *   returns: { stocks, bonds } (expected, used when no sequence is given),
 *   rmd: { birthYear, startAge } | null,
 *   strategy: "fixed-real" | "percent" | "guardrails" | "vpw", withdrawalRate (for percent/guardrails, e.g. 0.04),
 *   withdrawalOrder: ["cash", "taxable", "deferred", "free"] (default; cash is always first),
 *   tax: { mode: "flat" } (rates.taxRate on pre-tax withdrawals, the default) |
 *        { mode: "brackets", filingStatus, paramsFor: (year) => federal params, gainShare (part of a taxable withdrawal that is gain, 0.5),
 *          dividendYield (yearly qualified dividends on the taxable bucket, 0.02), itemized }; income lines with kind "social" go through the benefits worksheet,
 *   rothConversion: { fillRate: 0.22, untilAge } | null   // brackets mode: convert deferred -> free up to the top of that bracket each retirement year before RMDs
 * }
 * options: { sequence: [{ stocks, bonds, cash?, inflation? }] one per year from startYear } for Monte Carlo / history.
 */
export function project(inputs, options = {}) {
  const I = inputs;
  const seq = options.sequence ?? null;
  const people = I.people ?? [];
  const primary = people[0];
  const r = I.rates;
  const buckets = { cash: +I.balances.cash || 0, taxable: +I.balances.taxable || 0, deferred: +I.balances.deferred || 0, free: +I.balances.free || 0 };
  const rows = [];
  let priceLevel = 1, success = true, failYear = null, failAge = null, totalWithdrawn = 0, totalTaxes = 0, totalConverted = 0;
  const tax = I.tax ?? { mode: "flat" };
  const brackets = tax.mode === "brackets" && typeof tax.paramsFor === "function";
  const flatRate = r.taxRate ?? 0;
  const gainShare = tax.gainShare ?? 0.5, dividendYield = tax.dividendYield ?? 0.02;
  const order = ["cash", ...(Array.isArray(I.withdrawalOrder) ? I.withdrawalOrder.filter((b) => b !== "cash" && b in buckets) : ["taxable", "deferred", "free"])];
  for (const b of ["taxable", "deferred", "free"]) if (!order.includes(b)) order.push(b);
  let baseSpend = I.spending?.yearly ?? 0;                // fixed-real base, in the year's dollars
  let guardSpend = null, lastReal = null;
  const strategy = STRATEGIES[I.strategy] ? I.strategy : "fixed-real";
  const wr = I.withdrawalRate ?? 0.04;
  for (let year = I.startYear, i = 0; year <= I.endYear; year++, i++) {
    const ages = people.map((p) => year - p.birthYear);
    const retired = year >= I.retireYear;
    const step = seq?.[i] ?? null;
    const infl = step?.inflation ?? r.inflation;
    if (i > 0) priceLevel *= 1 + infl;
    // asset mix: glide from stocksNow at the start to stocksRetired by the retirement year, flat after
    const t = I.retireYear > I.startYear ? Math.min(1, Math.max(0, (year - I.startYear) / (I.retireYear - I.startYear))) : 1;
    const stockShare = r.stocksNow + (r.stocksRetired - r.stocksNow) * t;
    const retStocks = step?.stocks ?? I.returns.stocks, retBonds = step?.bonds ?? I.returns.bonds, retCash = step?.cash ?? r.cash;
    const portfolioReturn = stockShare * retStocks + (1 - stockShare) * retBonds;
    // 1. contributions while working (each person's own until their retirement)
    let contrib = 0;
    for (const c of I.contributions ?? []) {
      const p = people[c.personIndex ?? 0]; const age = ages[c.personIndex ?? 0];
      const stopAge = c.untilAge ?? p?.retireAge ?? 65;
      if (age >= stopAge) continue;
      const amt = c.yearly * Math.pow(1 + r.salaryGrowth, i);
      buckets[c.bucket] = (buckets[c.bucket] ?? 0) + amt; contrib += amt;
    }
    // 2. guaranteed income this year (nominal)
    let income = 0, incomeTaxable = 0, incomeSocial = 0;
    const incomeLines = [];
    for (const inc of I.incomes ?? []) {
      const age = ages[inc.personIndex ?? 0];
      if (age < inc.startAge || (inc.endAge !== undefined && inc.endAge !== null && age > inc.endAge)) continue;
      const amt = inc.yearly * (inc.cola === false ? 1 : priceLevel);
      income += amt; incomeLines.push({ name: inc.name, amount: amt });
      if (inc.taxable === false) continue;
      if (inc.kind === "social") incomeSocial += amt; else incomeTaxable += amt;
    }
    // 3. spending in retirement (nominal), by strategy
    let spending = 0;
    const total = buckets.cash + buckets.taxable + buckets.deferred + buckets.free;
    if (retired) {
      const yearsLeft = Math.max(1, I.endYear - year + 1);
      if (strategy === "fixed-real") spending = baseSpend * priceLevel;
      else if (strategy === "percent") spending = Math.max(0, total * wr) + 0;
      else if (strategy === "vpw") { const realRet = (1 + portfolioReturn) / (1 + infl) - 1; spending = Math.max(0, pmt(Math.max(-0.5, realRet), yearsLeft, total)); }
      else if (strategy === "guardrails") {
        if (guardSpend === null) guardSpend = baseSpend * priceLevel;
        else {
          const rateNow = total > 0 ? guardSpend / total : 1;
          if (rateNow > wr * 1.2) guardSpend *= 0.9; else if (rateNow < wr * 0.8) guardSpend *= 1.1;
          else if (lastReal !== null && lastReal >= 0) guardSpend *= 1 + infl;   // skip the inflation raise after a losing year
        }
        spending = guardSpend;
      }
    }
    // 4. the gap, required withdrawals, Roth conversions, then withdrawals in order until spending and the year's tax are covered
    const need = Math.max(0, spending - income);
    const withdrawn = { cash: 0, taxable: 0, deferred: 0, free: 0 };
    const rmdAge = I.rmd?.startAge ?? null;
    let rmd = 0, conversion = 0, taxes = 0, taxInfo = null;
    const taxableStart = buckets.taxable;
    if (rmdAge && ages[0] >= rmdAge && buckets.deferred > 0) { rmd = Math.min(buckets.deferred, buckets.deferred / rmdFactor(ages[0])); buckets.deferred -= rmd; withdrawn.deferred += rmd; }
    const params = brackets ? tax.paramsFor(year) : null;
    const ages65plus = people.slice(0, 2).filter((p, k) => ages[k] >= 65).length;
    const taxFor = () => {
      if (!brackets) return flatRate * withdrawn.deferred;
      const r = federalTax({ filingStatus: tax.filingStatus, otherOrdinary: incomeTaxable + withdrawn.deferred + conversion, qualifiedIncome: withdrawn.taxable * gainShare + (retired ? taxableStart * dividendYield : 0), socialSecurity: incomeSocial, itemized: tax.itemized ?? 0, ages65plus }, params);
      taxInfo = { ordinary: r.income.ordinary, qualified: r.income.qualified, socialSecurity: incomeSocial, taxableSocialSecurity: r.income.taxableSocialSecurity, taxableIncome: r.taxableIncome, bracketRate: r.bracketRate, effectiveRate: r.effectiveRate, deduction: r.deduction.amount };
      return Math.max(0, r.totalTax);
    };
    // proceeds so far (the RMD) count against what has to come out; iterate because the tax on a withdrawal is itself something to cover
    let netOut = rmd, shortfall = 0;
    const settle = () => {
      for (let round = 0; round < 60; round++) {
        taxes = taxFor();
        const want = need + taxes - netOut;
        if (want <= 0.0005) { shortfall = 0; return; }
        let got = 0;
        for (const b of order) {
          if (got >= want - 0.0005) break;
          if (buckets[b] <= 0) continue;
          const take = Math.min(want - got, buckets[b]);
          buckets[b] -= take; withdrawn[b] += take; got += take;
        }
        netOut += got;
        if (got < want - 0.0005) { taxes = taxFor(); shortfall = need + taxes - netOut; return; }
      }
    };
    settle();
    // Roth conversions: once the year's spending withdrawals are known, convert what fits under the chosen bracket's top, tax included
    // (when the tax on the conversion has to come from pre-tax money it is itself income, so the amount is trimmed until the year ends at the top)
    if (brackets && I.rothConversion && retired && rmd === 0 && buckets.deferred > 0 && shortfall <= 0.005 && (!rmdAge || ages[0] < rmdAge) && (I.rothConversion.untilAge === undefined || I.rothConversion.untilAge === null || ages[0] < I.rothConversion.untilAge)) {
      const top = bracketTop(I.rothConversion.fillRate ?? 0.22, tax.filingStatus, params);
      if (Number.isFinite(top)) {
        const base = { b: { ...buckets }, w: { ...withdrawn }, netOut, taxes, shortfall };
        const restore = () => { Object.assign(buckets, base.b); Object.assign(withdrawn, base.w); netOut = base.netOut; taxes = base.taxes; shortfall = base.shortfall; conversion = 0; };
        let c = Math.min(buckets.deferred, roomUnder({ filingStatus: tax.filingStatus, otherOrdinary: incomeTaxable + withdrawn.deferred, qualifiedIncome: withdrawn.taxable * gainShare + (retired ? taxableStart * dividendYield : 0), socialSecurity: incomeSocial, itemized: tax.itemized ?? 0, ages65plus }, params, top));
        for (let k = 0; k < 4; k++) {
          restore();
          if (c < 1) break;
          conversion = c; buckets.deferred -= c; buckets.free += c;
          settle();
          if (shortfall > 0.005) { c = 0; continue; }
          const diff = (taxInfo?.taxableIncome ?? 0) - top;   // over the top: trim; under it (the tax's own withdrawal changed the picture): add
          if (Math.abs(diff) <= 1 || (diff < 0 && c >= buckets.deferred + c - 0.5)) break;
          c = Math.max(0, Math.min(base.b.deferred, c - diff));
        }
        if (c < 1) { restore(); taxes = taxFor(); }
      }
    }
    if (shortfall > 0.005 && success) { success = false; failYear = year; failAge = ages[0]; }
    if (shortfall <= 0.005) shortfall = 0;
    const surplus = Math.max(0, netOut - need - taxes);
    if (surplus > 0) buckets.taxable += surplus;   // the required withdrawal beyond what the year needed
    totalWithdrawn += withdrawn.cash + withdrawn.taxable + withdrawn.deferred + withdrawn.free; totalTaxes += taxes; totalConverted += conversion;
    // 5. growth on what is left (contributions and withdrawals mid-year would be finer; end-of-year is the common simple choice)
    buckets.cash *= 1 + retCash;
    for (const b of ["taxable", "deferred", "free"]) buckets[b] *= 1 + portfolioReturn;
    const endTotal = buckets.cash + buckets.taxable + buckets.deferred + buckets.free;
    lastReal = (1 + portfolioReturn) / (1 + infl) - 1;
    rows.push({
      year, ages, retired, priceLevel, stockShare, portfolioReturn, inflation: infl,
      contributions: contrib, income, incomeLines, spending, withdrawn, rmd, conversion, taxes, taxInfo, shortfall,
      balances: { ...buckets }, total: endTotal, totalReal: endTotal / priceLevel, spendingReal: spending / priceLevel, incomeReal: income / priceLevel,
    });
  }
  const last = rows[rows.length - 1];
  // what is left, valued after the tax still owed on pre-tax money (at the last year's bracket, or the flat rate): the fair way to compare orders and conversions
  const endRate = brackets ? (last?.taxInfo?.bracketRate ?? flatRate) : flatRate;
  const endAfterTax = last ? last.balances.cash + last.balances.taxable + last.balances.free + last.balances.deferred * (1 - endRate) : 0;
  return { rows, success, failYear, failAge, endBalance: last?.total ?? 0, endBalanceReal: last?.totalReal ?? 0, endAfterTax, endAfterTaxReal: last ? endAfterTax / last.priceLevel : 0, endTaxRate: endRate, totalWithdrawn, totalTaxes, totalConverted, years: rows.length, strategy, taxMode: brackets ? "brackets" : "flat", withdrawalOrder: order };
}

/** Real (today's-dollar) yearly spending the plan could afford: the largest fixed-real spending that still succeeds (bisection). */
export function affordableSpending(inputs, options = {}, { lo = 0, hi = null, steps = 30 } = {}) {
  const start = (inputs.balances.cash + inputs.balances.taxable + inputs.balances.deferred + inputs.balances.free);
  let high = hi ?? Math.max(10000, start * 0.5 + (inputs.spending?.yearly ?? 0) * 4), low = lo;
  const ok = (s) => project({ ...inputs, strategy: "fixed-real", spending: { yearly: s } }, options).success;
  if (!ok(low)) return 0;
  for (let k = 0; k < steps; k++) { const mid = (low + high) / 2; if (ok(mid)) low = mid; else high = mid; }
  return Math.round(low);
}

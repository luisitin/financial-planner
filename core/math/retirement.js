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
//
// The ways other than the same spending every year set the year's WITHDRAWAL from savings, and guaranteed income comes on top
// (round 8, widow-1; the owner, 2026-11-06: "You can do as you please. Just make sure a layman can easily understand and use the
// page"): a share of what is left takes savings x the rate, the years-left way takes pmt(savings) over the years left, and
// guardrails takes what the year's spending target needs once income has paid what it can (max(0, target + health cover + tax -
// income)), testing that withdrawal against savings. Guaranteed income pays the year's tax and health cover first; whatever of
// them it cannot pay comes out of savings on top of the share (review D1: with no income, the share is what is spent, as before).
// So spending + health cover + tax = guaranteed income + everything taken out of savings. Before, the rate set all of the year's
// spending and income only reduced the withdrawal afterwards, so a widow with $50,400 of pension and Social Security was planned
// on $16,880.
import { pmt } from "./finance.js";
import { rmdFactor } from "./rmd.js";
import { federalTax, roomUnder, bracketTop, largestAtOrUnder } from "./tax.js";

export const STRATEGIES = {
  "fixed-real": "The same spending every year, adjusted for inflation",
  "percent": "A fixed percentage of what is left each year, on top of income",
  // batch 5b UX review 8: one plain name ("Trim after bad years", How much to take out), and the report's "Spending:" line says it
  "guardrails": "What you plan, trimmed by a tenth after bad years and raised back after good ones",
  "vpw": "Spend what the remaining years can afford, on top of income",
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
 *   loans: [{ yearly, inBase, untilYear?, lastMonths? }] | undefined   // loan payments the spending figure holds (2026-11-07): `inBase`
 *                                                   // (today's dollars) leaves the figure, and `yearly` is spent instead as a FIXED amount (never
 *                                                   // raised for prices: a loan's payment does not rise) in each retired year up to `untilYear`, the
 *                                                   // payoff year for `lastMonths` of 12; none after it (no untilYear: to the end). Fixed-real and
 *                                                   // guardrails spend it on top of the rest (never trimmed); a share of savings (percent, vpw)
 *                                                   // sets the year's spending whatever it holds
 *   retireYear,                                     // first year of retirement for the household (spending starts)
 *   rates: { inflation, cash, salaryGrowth, taxRate, stocksNow, stocksRetired },
 *   returns: { stocks, bonds } (expected, used when no sequence is given),
 *   rmd: { birthYear, startAge, owners? } | null,     // owners: [{ personIndex, share, startAge }]: each adult's share of the pre-tax bucket, withdrawn at their own age;
 *                                                   // what no owner holds (life-insurance cash value) has none. Without owners the primary owns it all.
 *   contributions[].rmdExempt: true adds to the part with no required withdrawals,
 *   contributions[].untilYear / skipYears, incomes[].fromYear / untilYear: calendar-year bounds on top of the ages (what-if pages),
 *   events: [{ year, amount, label, spending? }] | undefined   // today's dollars that year: > 0 comes out of savings on top of spending (in the
 *                                                   // withdrawal order, working years too); < 0 goes into the taxable bucket at the start of the year;
 *                                                   // spending: true (health cover) counts with the year's spending, so guaranteed income pays it
 *                                                   // first and only the rest comes out of savings (rows: eventOut has it, eventSpending is that part)
 *   spendingChanges: [{ fromYear, factor }] | undefined   // fixed-real and guardrail spending times the factor from that year on (a survivor, say),
 *   strategy: "fixed-real" | "percent" | "guardrails" | "vpw", withdrawalRate (for percent/guardrails, e.g. 0.04),
 *     fixed-real: spending = spending.yearly x inflation; savings pay max(0, spending + health cover - income) + one-offs + tax.
 *     percent / vpw: the year's share W = savings x rate / pmt(expected real return, years left, savings) (start of year; the
 *       expected return even in a market sequence, as Bogleheads' VPW uses a set return: UX review 14); savings pay W + one-offs
 *       + whatever of the year's tax and health cover income cannot pay (max(0, tax + health cover - income)); spending =
 *       W + max(0, income - tax - health cover) (review D1).
 *     guardrails: a spending target G, the plan's figure in the first retired year. Each later year, the withdrawal G would need
 *       this year (max(0, G + health cover + tax - income), worked out with this year's income and tax) is tested against savings:
 *       above 1.2 x rate, G x 0.9; below 0.8 x rate, G x 1.1 but never above the plan's figure grown with inflation, also when that
 *       withdrawal is $0 because income pays for the whole target and savings could pay the raised target without a trim (follow-up 2026-11-07, 5b R3 and money review M1: a target trimmed while savings paid was
 *       never raised back once Social Security covered it: $38,000 to $43,500 on a $60,000 plan for 29 years); otherwise G follows prices, except that after a losing year it does not rise with them while it
 *       needs a withdrawal (it still falls with them: review D4; with nothing drawn it follows prices: verify R1); G is never above
 *       the plan's figure at the year's prices. Savings pay max(0, G + health cover + tax - income) + one-offs; spending = max(G, income - tax
 *       - health cover). (Rows: spending is that year's spending.)
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
  const loans = Array.isArray(I.loans) ? I.loans : [];
  // the figure less the loan payments it holds (they are spent as fixed amounts until each payoff, `loanIn`)
  let baseSpend = Math.max(0, (I.spending?.yearly ?? 0) - loans.reduce((t, l) => t + (Number(l.inBase) || 0), 0));   // fixed-real base, in the year's dollars
  const loanIn = (year) => loans.reduce((t, l) => (l.untilYear !== undefined && l.untilYear !== null && year > l.untilYear ? t : t + (Number(l.yearly) || 0) * (l.untilYear === year && l.lastMonths ? Math.min(12, l.lastMonths) / 12 : 1)), 0);
  let guardSpend = null, lastReal = null;
  const strategy = STRATEGIES[I.strategy] ? I.strategy : "fixed-real";
  const wr = I.withdrawalRate ?? 0.04;
  // required withdrawals: each owner's slice of the pre-tax bucket, kept in dollars; contributions add to their owner's slice,
  // the year's RMD comes off it, every other move in or out of the bucket (spending, conversions, growth) moves all slices alike
  const owners = !I.rmd ? [] : Array.isArray(I.rmd.owners) ? I.rmd.owners : [{ personIndex: 0, share: 1, startAge: I.rmd.startAge }];
  const slices = owners.map((o) => (Number(o.share) || 0) * buckets.deferred);
  const rmdAge = I.rmd ? (I.rmd.startAge ?? owners.find((o) => o.personIndex === 0)?.startAge ?? null) : null;
  // the events by year, once per run (the health line puts one in every retirement year; Monte Carlo runs this thousands of times)
  const eventsIn = new Map();
  for (const e of I.events ?? []) { if (!eventsIn.has(e.year)) eventsIn.set(e.year, []); eventsIn.get(e.year).push(e); }
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
      if ((c.untilYear !== undefined && c.untilYear !== null && year > c.untilYear) || c.skipYears?.includes(year)) continue;
      const amt = c.yearly * Math.pow(1 + r.salaryGrowth, i);
      buckets[c.bucket] = (buckets[c.bucket] ?? 0) + amt; contrib += amt;
      if (c.bucket === "deferred" && !c.rmdExempt) { const k = owners.length === 1 && !Array.isArray(I.rmd.owners) ? 0 : owners.findIndex((o) => o.personIndex === (c.personIndex ?? 0)); if (k >= 0) slices[k] += amt; }
    }
    // 2. guaranteed income this year (nominal)
    let income = 0, incomeTaxable = 0, incomeSocial = 0;
    const incomeLines = [];
    for (const inc of I.incomes ?? []) {
      const age = ages[inc.personIndex ?? 0];
      if (age < inc.startAge || (inc.endAge !== undefined && inc.endAge !== null && age > inc.endAge)) continue;
      if ((inc.fromYear !== undefined && inc.fromYear !== null && year < inc.fromYear) || (inc.untilYear !== undefined && inc.untilYear !== null && year > inc.untilYear)) continue;
      const amt = inc.yearly * (inc.cola === false ? 1 : priceLevel);
      income += amt; incomeLines.push({ name: inc.name, amount: amt });
      if (inc.taxable === false) continue;
      if (inc.kind === "social") incomeSocial += amt; else incomeTaxable += amt;
    }
    // 3. spending in retirement (nominal), by strategy. The same spending every year sets spending; the other ways set the
    // year's withdrawal (draw) or, for guardrails, a spending target (floor) whose withdrawal is worked out with the year's tax below
    let spending = 0, draw = 0, floor = 0;
    const loanNow = retired && loans.length ? loanIn(year) : 0;
    const drawMode = retired && strategy !== "fixed-real";
    const total = buckets.cash + buckets.taxable + buckets.deferred + buckets.free;
    if (retired) {
      const yearsLeft = Math.max(1, I.endYear - year + 1);
      if (strategy === "fixed-real") spending = baseSpend * priceLevel;
      else if (strategy === "percent") draw = Math.max(0, total * wr);
      else if (strategy === "vpw") {
        // paid at the start of the year, before that year's return (Bogleheads VPW), priced at the plan's EXPECTED real return:
        // that year's own return (a crash, a boom) swung the payment between $0 and twice the plan (UX review 14)
        const expected = stockShare * I.returns.stocks + (1 - stockShare) * I.returns.bonds;
        const realRet = (1 + expected) / (1 + r.inflation) - 1;
        draw = Math.max(0, pmt(Math.max(-0.5, realRet), yearsLeft, total, 0, true));
      }
    }
    // what-if hooks: a spending change from a year on (fixed-real and guardrails), one-off money out of or into savings
    const factor = (I.spendingChanges ?? []).reduce((f, s) => (year >= s.fromYear ? f * s.factor : f), 1);
    if (factor !== 1 && strategy === "fixed-real") spending *= factor;
    if (loanNow && strategy === "fixed-real") spending += loanNow;
    // an event marked `spending` (health cover) is part of the year's spending: guaranteed income pays it first, like the rest
    let eventOut = 0, eventSpending = 0;
    for (const e of eventsIn.get(year) ?? []) { const amt = (Number(e.amount) || 0) * priceLevel; if (amt >= 0) { eventOut += amt; if (e.spending) eventSpending += amt; } else buckets.taxable += -amt; }
    // 4. the gap, required withdrawals, Roth conversions, then withdrawals in order until spending and the year's tax are covered
    const need = Math.max(0, spending + eventSpending - income) + (eventOut - eventSpending);
    const other = eventOut - eventSpending;
    const withdrawn = { cash: 0, taxable: 0, deferred: 0, free: 0 };
    let rmd = 0, conversion = 0, taxes = 0, taxInfo = null, gainsMoved = 0;
    const taxableStart = buckets.taxable;
    const rmdBy = people.map(() => 0);
    owners.forEach((o, k) => {
      const age = ages[o.personIndex ?? 0];
      if (!o.startAge || age === undefined || age < o.startAge || slices[k] <= 0) return;
      const amt = Math.min(slices[k], buckets.deferred - rmd, slices[k] / rmdFactor(age));
      if (!(amt > 0)) return;
      slices[k] -= amt; rmd += amt; rmdBy[o.personIndex ?? 0] += amt;
    });
    if (rmd > 0) { buckets.deferred -= rmd; withdrawn.deferred += rmd; }
    const deferredAfterRmd = buckets.deferred;
    const params = brackets ? tax.paramsFor(year) : null;
    const ages65plus = people.slice(0, 2).filter((p, k) => ages[k] >= 65).length;
    const taxFor = () => {
      if (!brackets) return flatRate * withdrawn.deferred;
      const r = federalTax({ filingStatus: tax.filingStatus, otherOrdinary: incomeTaxable + withdrawn.deferred + conversion, qualifiedIncome: withdrawn.taxable * gainShare + (retired ? taxableStart * dividendYield : 0), socialSecurity: incomeSocial, itemized: tax.itemized ?? 0, ages65plus }, params);
      taxInfo = { ordinary: r.income.ordinary, qualified: r.income.qualified, socialSecurity: incomeSocial, taxableSocialSecurity: r.income.taxableSocialSecurity, taxableIncome: r.taxableIncome, ordinaryTaxable: r.ordinaryTaxable, bracketRate: r.bracketRate, effectiveRate: r.effectiveRate, deduction: r.deduction.amount };
      return Math.max(0, r.totalTax);
    };
    // proceeds so far (the RMD) count against what has to come out; iterate because the tax on a withdrawal is itself something to cover
    let netOut = rmd, shortfall = 0;
    // the ways that set a withdrawal: what savings pay this year. The share (or, for guardrails, what the target needs once income has
    // paid what it can) and the one-offs; guaranteed income pays the year's tax and health cover first, and savings pay whatever of them
    // it cannot, on top of the share (review D1). A Roth conversion's own tax comes from savings on top (taxSpend: the year's tax before
    // any conversion), so it does not cut spending
    let taxSpend = null;
    const wantTotal = () => { const t = taxSpend ?? taxes; return other + (strategy === "guardrails" ? Math.max(0, floor + eventSpending + t - income) : draw + Math.max(0, eventSpending + t - income)) + (taxes - t); };
    // the ways that set a withdrawal settle to a ten-thousandth of a cent: tax that income cannot pay is grossed up here (review D1),
    // and a looser stop compounds to more than a cent over decades; the same spending every year keeps its own $0.0005, to the bit
    const tol = drawMode ? 1e-6 : 0.0005;
    const settle = () => {
      for (let round = 0; round < 60; round++) {
        taxes = taxFor();
        const want = (drawMode ? wantTotal() : need + taxes) - netOut;
        if (want <= tol) { shortfall = 0; return; }
        let got = 0;
        for (const b of order) {
          if (got >= want - tol) break;
          if (buckets[b] <= 0) continue;
          const take = Math.min(want - got, buckets[b]);
          buckets[b] -= take; withdrawn[b] += take; got += take;
        }
        netOut += got;
        if (got < want - tol) { taxes = taxFor(); shortfall = (drawMode ? wantTotal() : need + taxes) - netOut; return; }
      }
    };
    // guardrails: the first retired year spends the plan's figure; each later year tests the withdrawal last year's target would need
    // now (this year's income, health cover and tax: a trial settle, undone) against savings, then moves the target
    if (drawMode && strategy === "guardrails") {
      if (guardSpend === null) guardSpend = baseSpend * priceLevel;
      else {
        const keep = { b: { ...buckets }, w: { ...withdrawn }, netOut, taxes, shortfall, taxInfo };
        floor = guardSpend * factor + loanNow;
        settle();
        const trial = Math.max(0, wantTotal() - other);
        Object.assign(buckets, keep.b); Object.assign(withdrawn, keep.w); ({ netOut, taxes, shortfall, taxInfo } = keep);
        const rateNow = total > 0 ? trial / total : trial > 0 ? 1 : 0;
        // with nothing drawn the raise waits until savings could pay what the raised target needs without a trim (money review M1: with
        // savings empty or tiny the raise would be paid by money that is not there, then trimmed, then raised again)
        const raisedFits = () => {
          if (trial > 0) return true;
          floor = Math.min(guardSpend * 1.1, baseSpend * priceLevel) * factor + loanNow; settle();
          const need = Math.max(0, wantTotal() - other);
          Object.assign(buckets, keep.b); Object.assign(withdrawn, keep.w); ({ netOut, taxes, shortfall, taxInfo } = keep);
          return need <= 0 || (total > 0 && need / total <= wr * 1.2);
        };
        if (rateNow > wr * 1.2) guardSpend *= 0.9;
        else if (rateNow < wr * 0.8 && raisedFits()) guardSpend = Math.min(guardSpend * 1.1, baseSpend * priceLevel);   // back up, never past the plan's own figure; also when income pays for the whole target and savings could pay the raised one (nothing drawn: 5b R3, M1)
        // after a losing year: no rise with prices, but a fall still applies (review D4); only while savings pay toward the target:
        // while income pays for everything nothing is drawn, so the target follows prices (verify R1: frozen a year at a time
        // with nothing drawn, it sank below the plan unseen and, never drawn on, was never raised back)
        else if (lastReal !== null) guardSpend *= lastReal >= 0 || trial <= 0 ? 1 + infl : Math.min(1, 1 + infl);
        // never past the plan's own figure at this year's prices: a cut of a tenth in a year prices fall by more than that would be one
        guardSpend = Math.min(guardSpend, baseSpend * priceLevel);
      }
      floor = guardSpend * factor + loanNow;
    }
    settle();
    if (drawMode) taxSpend = taxes;
    // Roth conversions: once the year's spending withdrawals are known, convert what fits under the chosen bracket's top, tax included
    // (when the tax on the conversion has to come from pre-tax money it is itself income, so the amount is trimmed until the year ends at the top)
    if (brackets && I.rothConversion && retired && rmd === 0 && buckets.deferred > 0 && shortfall <= 0.005 && (!rmdAge || ages[0] < rmdAge) && (I.rothConversion.untilAge === undefined || I.rothConversion.untilAge === null || ages[0] < I.rothConversion.untilAge)) {
      const top = bracketTop(I.rothConversion.fillRate ?? 0.22, tax.filingStatus, params);
      if (Number.isFinite(top)) {
        const base = { b: { ...buckets }, w: { ...withdrawn }, netOut, taxes, shortfall };
        const pre = taxInfo ? { t: taxInfo.taxableIncome, q: Math.max(0, taxInfo.taxableIncome - taxInfo.ordinaryTaxable) } : null;   // before converting: taxable income and the dividends and gains stacked in it
        const restore = () => { Object.assign(buckets, base.b); Object.assign(withdrawn, base.w); netOut = base.netOut; taxes = base.taxes; shortfall = base.shortfall; conversion = 0; };
        // how far over the top the year ends after converting c and settling its tax (Infinity: the year would come up short)
        let last = null, lastF = 0;
        const over = (c) => { last = c; restore(); conversion = c; buckets.deferred -= c; buckets.free += c; settle(); lastF = shortfall > 0.005 ? Infinity : (taxInfo?.ordinaryTaxable ?? 0) - top; return lastF; };
        const most = base.b.deferred;
        const guess = Math.min(most, roomUnder({ filingStatus: tax.filingStatus, otherOrdinary: incomeTaxable + withdrawn.deferred, qualifiedIncome: withdrawn.taxable * gainShare + (retired ? taxableStart * dividendYield : 0), socialSecurity: incomeSocial, itemized: tax.itemized ?? 0, ages65plus }, params, top));
        // taxable income rises at least a dollar for each dollar converted, so one probe brackets the answer and a secant step finishes it
        let c = 0;
        const TOL = 1e-3;   // a tenth of a cent of taxable income: the tax gross-up itself settles to $0.0005
        if (guess > 0) {
          const fg = over(guess);
          // on the top to a tenth of a cent, EITHER side: ordinary taxable income is taxable income less the qualified part (5b R4), and
          // that subtraction can leave the guess a hair (1e-11) over the top; read as "over" it fell to the branch below, whose step back by
          // the same hair was still over, and the year converted $0 (verify 2026-11-07: the equity couple skipped 2032 and 2034 at 12%)
          if (fg < TOL && fg > -TOL) c = guess;
          else if (fg <= 0) { const hi = Math.min(most, guess - fg), fh = hi > guess ? over(hi) : fg; c = fh <= 0 ? hi : largestAtOrUnder(over, guess, fg, hi, fh, TOL, TOL); }
          else if (!Number.isFinite(fg)) c = largestAtOrUnder(over, 0, -1, guess, fg, TOL, TOL);
          else { const lo = Math.max(0, guess - fg), fl = over(lo); c = fl >= TOL ? 0 : fl > -TOL ? lo : largestAtOrUnder(over, lo, fl, guess, fg, TOL, TOL); }
        }
        if (c > 0) {
          if (last !== c) over(c);
          for (let k = 0; k < 4 && c > 0 && lastF > 0; k++) { c = Math.max(0, c - lastF - TOL); over(c); }   // a hair over the top: step back under it, so the year never ends in the next bracket
        }
        if (c <= 0) { restore(); taxes = taxFor(); }
        // gains and dividends the conversion pushed past a gains-rate top (0% to 15%, 15% to 20%): each of those dollars costs the gains rate
        // difference on top of the bracket's rate, so "taxed at 10%" is a little low for the year (money review M4); told, not capped
        else if (pre && pre.q > 0 && taxInfo) for (const t of params.status[tax.filingStatus]?.ltcgBrackets ?? []) if (pre.t < t && taxInfo.taxableIncome > t) gainsMoved += Math.min(pre.q, taxInfo.taxableIncome - t);
      }
    }
    if (shortfall > 0.005 && success) { success = false; failYear = year; failAge = ages[0]; }
    if (shortfall <= 0.005) shortfall = 0;
    // the ways that set a withdrawal spend the share, and what income leaves after the year's tax (before any conversion) and health
    // cover (review D1); guardrails spend their target, or all of an income that pays for more
    if (drawMode) spending = strategy === "guardrails" ? Math.max(floor, income - taxSpend - eventSpending) : draw + Math.max(0, income - taxSpend - eventSpending);
    // (the same spending every year keeps its own expression, netOut - need - taxes, so its figures stay identical to the bit)
    const surplus = Math.max(0, drawMode ? netOut - wantTotal() : netOut - need - taxes);
    if (surplus > 0) buckets.taxable += surplus;   // the required withdrawal beyond what the year needed
    totalWithdrawn += withdrawn.cash + withdrawn.taxable + withdrawn.deferred + withdrawn.free; totalTaxes += taxes; totalConverted += conversion;
    // 5. growth on what is left (contributions and withdrawals mid-year would be finer; end-of-year is the common simple choice)
    const kept = deferredAfterRmd > 0 ? buckets.deferred / deferredAfterRmd : 0;
    for (let k = 0; k < slices.length; k++) slices[k] *= kept * (1 + portfolioReturn);
    buckets.cash *= 1 + retCash;
    for (const b of ["taxable", "deferred", "free"]) buckets[b] *= 1 + portfolioReturn;
    const endTotal = buckets.cash + buckets.taxable + buckets.deferred + buckets.free;
    lastReal = (1 + portfolioReturn) / (1 + infl) - 1;
    rows.push({
      year, ages, retired, priceLevel, stockShare, portfolioReturn, inflation: infl,
      contributions: contrib, income, incomeLines, spending, eventOut, eventSpending, withdrawn, rmd, rmdBy, conversion, gainsMoved, taxes, taxInfo, shortfall,
      balances: { ...buckets }, total: endTotal, totalReal: endTotal / priceLevel, spendingReal: spending / priceLevel, incomeReal: income / priceLevel,
    });
  }
  const last = rows[rows.length - 1];
  // what is left, valued after the tax still owed on pre-tax money (at the last year's bracket, or the flat rate): the fair way to compare orders and conversions
  const endRate = brackets ? (last?.taxInfo?.bracketRate ?? flatRate) : flatRate;
  const endAfterTax = last ? last.balances.cash + last.balances.taxable + last.balances.free + last.balances.deferred * (1 - endRate) : 0;
  return { rows, success, failYear, failAge, endBalance: last?.total ?? 0, endBalanceReal: last?.totalReal ?? 0, endAfterTax, endAfterTaxReal: last ? endAfterTax / last.priceLevel : 0, endTaxRate: endRate, totalWithdrawn, totalTaxes, totalConverted, years: rows.length, strategy, taxMode: brackets ? "brackets" : "flat", withdrawalOrder: order };
}

/** A copy of `inputs` that a what-if can change without touching the original (the tax settings' functions are shared, not copied). */
export function copyInputs(I) {
  return { ...I, ...(I.loans ? { loans: I.loans.map((l) => ({ ...l })) } : {}), people: I.people.map((p) => ({ ...p })), balances: { ...I.balances }, contributions: (I.contributions ?? []).map((c) => ({ ...c, skipYears: c.skipYears ? [...c.skipYears] : undefined })), incomes: (I.incomes ?? []).map((x) => ({ ...x })), spending: { ...I.spending }, rates: { ...I.rates }, returns: { ...I.returns }, stdev: I.stdev ? { ...I.stdev } : I.stdev, rmd: I.rmd ? { ...I.rmd, owners: I.rmd.owners ? I.rmd.owners.map((o) => ({ ...o })) : undefined } : I.rmd, events: [...(I.events ?? [])], spendingChanges: [...(I.spendingChanges ?? [])] };
}

/**
 * Real (today's-dollar) yearly spending the plan could afford: the largest fixed-real spending that still
 * succeeds, to the dollar. The ceiling doubles until it fails (so a first guess that is too low cannot cap
 * the answer), then bisection narrows the bracket until both ends round to the same dollar (down to a
 * millionth of a dollar when the answer sits on a half dollar); `steps` caps the bisection rounds.
 */
export function affordableSpending(inputs, options = {}, { lo = 0, hi = null, steps = 200 } = {}) {
  const start = (inputs.balances.cash + inputs.balances.taxable + inputs.balances.deferred + inputs.balances.free);
  let high = hi ?? Math.max(10000, start * 0.5 + (inputs.spending?.yearly ?? 0) * 4), low = lo;
  const ok = (s) => project({ ...inputs, strategy: "fixed-real", spending: { yearly: s } }, options).success;
  if (!ok(low)) return 0;
  for (let k = 0; k < 64 && ok(high); k++) { low = high; high *= 2; }
  // stop once both ends round to the same dollar (the answer lies between them), or the bracket is negligibly narrow
  for (let k = 0; k < steps && Math.round(low) !== Math.round(high) && high - low > Math.max(1e-6, high * 1e-12); k++) { const mid = (low + high) / 2; if (ok(mid)) low = mid; else high = mid; }
  return Math.round(low);
}

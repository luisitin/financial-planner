// modules/retirement/roth-conversions/compute.js -- PURE. Moving pre-tax money into a Roth in
// the low-income years between retirement and required withdrawals, filling a chosen bracket
// each year. The plan is run with no conversions and with each bracket filled (always through
// the federal brackets), and the chosen setting gets a year-by-year table with the room in the
// bracket, the conversion, its tax and the Medicare surcharge line it might cross.
import { project } from "../../../core/math/retirement.js";
import { buildInputs, taxSettings } from "../projection/compute.js";
import { bracketTop } from "../../../core/math/tax.js";
import { rmdStartYear } from "../../../core/math/rmd.js";
import { YEAR as MEDICARE_YEAR } from "../medicare/data/medicare.js";
// "Stop sooner" (gap design #26): an income line a year's conversion also stops at; the lines and their words live in ceiling.js
import { CEILINGS, ceilingOf, medicareLine, medicareYears, marketplaceLines, topShare } from "./ceiling.js";

/** Medicare's first income-related surcharge line (IRMAA), 2026, from income two years earlier; indexed with inflation after. */
// (read from the Medicare page's own table since 2026-11-14, so the two never drift apart: retirement/medicare/data/medicare.js)
export const IRMAA_FIRST_TIER = { year: MEDICARE_YEAR, ...Object.fromEntries(["single", "married_joint", "married_separate", "head_of_household", "qualifying_surviving"].map((s) => [s, medicareLine(s)])) };
export const FILL_RATES = [0.10, 0.12, 0.22, 0.24];

/**
 * compute(plan, { today }) -> {
 *   ready, missing, on, fillRate, untilAge, options: [{ fillRate | null, label, totalConvertedReal, taxesReal, endBalanceReal, endAfterTaxReal, rmdReal, success, failYear, chosen, best,
 *     healthReal (the plan's health cover with this setting: marketplace to 65, then Medicare, today's dollars), creditReal (the help with
 *     marketplace cover before 65, the premium tax credit), creditLostReal (what this setting gives up of it against no conversions),
 *     cliffYears (years its income passes the line where that help stops), moves: [{ year, real }] (each year it converts $1 or more,
 *     today's dollars: the amounts a person tells their 401(k) or IRA firm; batch 5b UX review 4) }],
 *   (options ranked by what is left at the end after the tax still owed on pre-tax money; a failing plan ranks by how late it fails)
 *   best, table: [{ year, ages, incomeBefore, bracketTop, conversion, gainsMoved (gains and dividends it pushed to a higher gains rate), conversionReal, taxes, taxesReal, bracketRate, taxableIncome, irmaa }] the years with a conversion under the chosen setting,
 *   span: { from, to, years } the conversion years, rmdStartAge, notes, bracketsOn,
 *   verdict: "no-pretax" | "no-years" | "fails" | "helps" | "no-help", helps, options[].offer ("Use this" / "Turn conversions off"),
 *   noWindow: { reason: "started" | "owner-younger" | "late" | "until" | "none", age (this year), retireAge, rmdStartAge, name,
 *     younger: [{ name, startYear, startAge, deferredNow }] (another adult's own pre-tax money, before their own required withdrawals
 *     start: they can convert any part of it each year until then) } | null (why there are no years to convert in),
 *   behind: null | { fillRate, byBest, byNone (null when not converting leaves no more, or runs out), creditMore, fails, failYear }: the
 *     plan's own setting when it leaves $1,000 or more less after tax than the best (or runs out while the best lasts): what it gives
 *     up against the best and against no conversions, and how much more of the help with health insurance before 65 it loses,
 *   ceiling: "bracket" | "medicare" | "marketplace" (the plan's `retirement.conversionCeiling`, gap design #26: an income line each
 *     year's conversion also stops at; every option above is run with it),
 *   stops: [] when no line applies and none is chosen, else one entry for "bracket" and one for each line that applies (or is the
 *     plan's choice), all at the rate `shown`: { key, chosen, applies, years (the conversion years the line acts in), turns63 (Medicare: someone turns 63 in the first of them), line (the
 *     first of them, today's dollars), noCliff + share (marketplace under the larger-credit rules: nothing to stop at, and the
 *     most each extra dollar costs), totalConvertedReal, taxesReal (lifetime tax), healthReal (lifetime health insurance:
 *     marketplace cover before 65 and Medicare after), healthPriced (false when no choice has a health bill worked out from income:
 *     it is inside the plan's spending or an Expenses line pays it), endAfterTaxReal, success, failYear, sameAsBracket (it changes no year) }
 * }
 * Each setting is run on the plan as it would be with that setting saved (round 8, equity-1): the health line (the marketplace's
 * premium and its tax credit before 65, Medicare's income surcharge after) is priced on the plan's own income, conversions
 * included, so a setting that pushes income over the credit's line pays for that in its own run. One build of the inputs per
 * setting, kept for the year-by-year table.
 */
export function compute(plan, params = {}) {
  const rt = plan.retirement ?? {};
  const rc = rt.rothConversion ?? {};
  const on = !!rc.on;
  const fillRate = FILL_RATES.includes(Number(rc.fillRate)) ? Number(rc.fillRate) : 0.22;
  const untilAge = rc.untilAge ? Number(rc.untilAge) : null;
  // the plan with one setting saved: conversions on at that bracket (off for none), on the brackets they need
  // (kind: the income line it also stops at; the plan's own unless a "Stop sooner" comparison asks for another)
  const ceiling = ceilingOf(plan);
  const planFor = (rate, kind = ceiling) => ({ ...plan, retirement: { ...(kind === ceiling ? rt : { ...rt, conversionCeiling: kind }), taxMode: "brackets", rothConversion: { ...rc, on: rate !== null, fillRate: rate ?? rc.fillRate ?? 0.22, untilAge } } });
  const builds = new Map();
  const buildFor = (rate, kind = ceiling) => { const k = kind === ceiling ? rate : `${rate}|${kind}`; if (!builds.has(k)) builds.set(k, buildInputs(planFor(rate, kind), params)); return builds.get(k); };
  const b = buildFor(null);
  if (!b.inputs) return { ready: false, missing: b.missing, notes: b.notes, options: [] };
  const tax = taxSettings(plan, { mode: "brackets" });
  const run = (rate, kind = ceiling) => {
    const bi = buildFor(rate, kind);
    // on the plan's own spending, the same every year (round 8, Batch 5b): the share, years-left and guardrail ways spend the tax a
    // conversion saves later instead of keeping it, so "left at the end" would not show it
    const inputs = { ...bi.inputs, strategy: "fixed-real", tax, rothConversion: rate ? { fillRate: rate, untilAge } : null };
    const r = project(inputs);
    return { r, inputs, health: bi.health, taxesReal: r.rows.reduce((s, x) => s + x.taxes / x.priceLevel, 0), rmdReal: r.rows.reduce((s, x) => s + x.rmd / x.priceLevel, 0), convertedReal: r.rows.reduce((s, x) => s + x.conversion / x.priceLevel, 0),
      moves: r.rows.filter((x) => x.conversion / x.priceLevel >= 1).map((x) => ({ year: x.year, real: x.conversion / x.priceLevel })) };
  };
  const options = [null, ...FILL_RATES].map((rate) => {
    const { r, health, taxesReal, rmdReal, convertedReal, moves } = run(rate);
    const bridge = health?.bridge ?? null;
    return { fillRate: rate, label: rate ? `Fill the ${Math.round(rate * 100)}% bracket` : "No conversions", totalConvertedReal: convertedReal, taxesReal, endBalanceReal: r.endBalanceReal, endAfterTaxReal: r.endAfterTaxReal, endTaxRate: r.endTaxRate, rmdReal, success: r.success, failYear: r.failYear, chosen: on ? rate === fillRate : rate === null,
      healthReal: health && !health.included ? health.total : 0, creditReal: bridge?.credit ?? 0, cliffYears: bridge?.cliff?.yearsList ?? [], cliffIncome: bridge?.cliff?.income ?? null, moves };
  });
  for (const o of options) o.creditLostReal = Math.max(0, options[0].creditReal - o.creditReal);
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
    return { year: x.year, ages: x.ages, incomeBefore: (info.ordinary ?? 0) - x.conversion, bracketTop: top, conversion: x.conversion, gainsMoved: x.gainsMoved ?? 0, conversionReal: x.conversion / x.priceLevel, taxes: x.taxes, taxesReal: x.taxes / x.priceLevel, bracketRate: info.bracketRate ?? null, taxableIncome: info.taxableIncome ?? 0, ordinaryTaxable: info.ordinaryTaxable ?? info.taxableIncome ?? 0, irmaa: x.ages[0] >= 63 && magi > irmaaLine(x.year), priceLevel: x.priceLevel };
  });
  const span = table.length ? { from: table[0].year, to: table[table.length - 1].year, years: table.length } : null;
  // "Stop sooner" (gap design #26): the tax rate alone against each income line that has years to act in, at the rate shown
  const stops = [];
  if (span && b.inputs.balances.deferred > 0) {
    const inWindow = new Set(table.map((x) => x.year));
    const medYears = medicareYears(b.inputs).filter((y) => inWindow.has(y));
    const mk = marketplaceLines(plan, b.inputs, { today: params.today ?? null });
    const mkYears = mk.separate ? [] : mk.years.filter((y) => inWindow.has(y.year) && (mk.noCliff || y.cliff > 0));
    const facts = {
      bracket: { applies: true, years: [], line: null },
      medicare: { applies: medYears.length > 0, years: medYears, line: medicareLine(plan.household?.filingStatus), turns63: (b.inputs.people ?? []).some((p) => p.birthYear + 63 === medYears[0]) },
      marketplace: { applies: mkYears.length > 0, years: mkYears.map((y) => y.year), line: mk.noCliff ? null : mkYears[0]?.cliff ?? null, ...(mk.noCliff ? { noCliff: true, share: topShare(mk.rules) } : {}) },
    };
    if (ceiling !== "bracket" || facts.medicare.applies || facts.marketplace.applies) {
      for (const key of CEILINGS) {
        if (!facts[key].applies && key !== ceiling) continue;
        const x = run(shown, key);
        stops.push({ key, chosen: key === ceiling, ...facts[key], totalConvertedReal: x.convertedReal, taxesReal: x.taxesReal, healthReal: x.health && !x.health.included ? x.health.total : 0, endAfterTaxReal: x.r.endAfterTaxReal, success: x.r.success, failYear: x.r.failYear });
      }
      // no choice has a health bill worked out from income (it is inside the plan's spending, or an Expenses line pays it): said, not shown as $0
      const priced = stops.some((st) => st.healthReal > 0);
      for (const st of stops) st.healthPriced = priced;
      for (const st of stops) st.sameAsBracket = st.key !== "bracket" && Math.abs(st.totalConvertedReal - stops[0].totalConvertedReal) < 1 && Math.abs(st.endAfterTaxReal - stops[0].endAfterTaxReal) < 0.5 && st.success === stops[0].success;
    }
  }
  const rows = table.filter((r) => r.conversion > 0);   // the years something is actually converted (the pot can run dry before the last possible year)
  const notes = [...b.notes];
  if (!b.inputs.balances.deferred) notes.push("No pre-tax retirement money on file (401(k), IRA on the Net worth page), so there is nothing to convert.");
  if (!span) notes.push(`No years to convert in: the first person reaches the required-withdrawal age (${rmdStartAge}) before or at retirement.`);
  if (on && (rt.taxMode ?? "flat") !== "brackets") notes.push("Conversions only run when Will the money last? uses the federal brackets; turning them on here switches Will the money last? to the brackets.");
  // why there are no years to try (round 8, widow-3: a widow of 74 read "Conversions do not help this plan much" and was offered
  // "Use this" for conversions that never happen): the first person's required withdrawals have already started ("started"), they
  // retire at or after that age ("late"), or the chosen until-age comes before retirement ("until"). The engine converts by the
  // first person's age only; when the pre-tax money is another adult's who is still under their own start age, say that instead
  // ("owner-younger", round 8 review D3: Bea, 66, with a $600,000 IRA, read that "required withdrawals have started" because Al is 75)
  const p0 = b.inputs.people[0];
  const ageNow = b.inputs.startYear - p0.birthYear, retireAge = Math.max(b.inputs.startYear, b.inputs.retireYear) - p0.birthYear;
  const owners = b.inputs.rmd?.owners ?? [];
  const ownsPretax = (k) => (owners[k]?.share ?? (k === 0 ? 1 : 0)) > 0 && b.inputs.balances.deferred > 0;
  const adults = (plan.household?.people ?? []).filter((x) => x.role !== "dependent" && x.birthDate);
  const younger = b.inputs.people.map((x, k) => [x, k]).filter(([x, k]) => k > 0 && ownsPretax(k) && owners[k]?.startAge && b.inputs.startYear - x.birthYear < owners[k].startAge)
    .map(([x, k]) => ({ name: x.name, startYear: rmdStartYear(adults.find((a) => a.id === x.id)?.birthDate ?? x.birthYear), startAge: owners[k].startAge, deferredNow: owners[k].share * b.inputs.balances.deferred }));
  const reason = ageNow >= rmdStartAge ? (ownsPretax(0) || !younger.length ? "started" : "owner-younger") : retireAge >= rmdStartAge ? "late" : untilAge !== null && retireAge >= untilAge ? "until" : "none";
  const noWindow = span ? null : { reason, age: ageNow, retireAge, rmdStartAge, name: p0.name, younger };
  // the page's one answer: nothing to convert; no years to convert in; the money runs out either way; a setting helps (more than
  // $1,000 left after tax); or none does much
  const helps = best.fillRate !== null && best.success && best.endAfterTaxReal > none.endAfterTaxReal + 1000;
  const verdict = !b.inputs.balances.deferred ? "no-pretax" : !span ? "no-years" : !none.success ? "fails" : helps ? "helps" : "no-help";
  // "Use this" only where conversions happen: years to convert in and at least $1 converted on this plan (round 8 review UX 10: a
  // pension that fills the 10% bracket left "fill the 10% bracket" converting $0, and "Use this" switched the tax setting for
  // nothing); turning them off is always offered while they are on
  for (const o of options) o.offer = !o.chosen && (o.fillRate === null || (!!span && b.inputs.balances.deferred > 0 && o.totalConvertedReal >= 1));
  // the plan's own setting, when it is well behind the best (round 8 review UX 3: saved on 12% when the page called it best, it then
  // left $100,620 less than 10% and $15,863 less than not converting, and the projection and every page after it used it)
  const mine = on ? options.find((o) => o.chosen) : null;
  const behind = verdict === "helps" || verdict === "no-help" ? (mine && !mine.best && best.success && (!mine.success || best.endAfterTaxReal - mine.endAfterTaxReal >= 1000)
    ? { fillRate: mine.fillRate, fails: !mine.success, failYear: mine.success ? null : mine.failYear, byBest: mine.success ? best.endAfterTaxReal - mine.endAfterTaxReal : null,
      byNone: best.fillRate !== null && mine.success && none.success && none.endAfterTaxReal - mine.endAfterTaxReal >= 1000 ? none.endAfterTaxReal - mine.endAfterTaxReal : null, creditMore: Math.max(0, mine.creditLostReal - best.creditLostReal) }
    : null) : null;
  return { ready: true, missing: [], on, fillRate, untilAge, options, best: best.fillRate, behind, shown, table: rows, span, rmdStartAge, notes, bracketsOn: (rt.taxMode ?? "flat") === "brackets", none, chosenSummary: options.find((o) => o.chosen) ?? none, deferredNow: b.inputs.balances.deferred, people: b.people, filingStatus: tax.filingStatus, verdict, helps, noWindow, ceiling, stops };
}

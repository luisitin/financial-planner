// modules/retirement/fire/compute.js -- PURE. Financial independence: the pot that could pay
// for your spending for good, how far you are, how many years at the current saving pace, and
// the "coast" figure (what would be enough now if you stopped adding and let it grow to the
// retirement age). Everything in today's dollars.
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeExpenses } from "../../cashflow/expenses/compute.js";
import { compute as computeContributions } from "../contributions/compute.js";
import { buildInputs } from "../projection/compute.js";
import { realRate } from "../../../core/math/finance.js";
import { project } from "../../../core/math/retirement.js";
import { earliestRetireAge } from "../../scenarios/goal-seek/compute.js";
import { legacyTarget } from "../../estate/legacy/compute.js";
import { drawSequences, CAREFUL_CHANCE, CAREFUL_SETTLE_PATHS } from "../monte-carlo/compute.js";
import { ageOn } from "../../../core/math/dates.js";

/**
 * Years from nothing saved to financial independence when a share `rate` of income is saved each year (added at the year's
 * end) and grows at `realReturn` a year after inflation, until the pot pays the rest of income (1 - rate) at
 * `withdrawalRate`. Income itself drops out. null past 100 years.
 */
export function yearsFromZero(rate, realReturn, withdrawalRate) {
  if (!(rate > 0) || !(withdrawalRate > 0)) return null;
  const target = (1 - rate) / withdrawalRate;
  let pot = 0;
  for (let y = 1; y <= 100; y++) { pot = pot * (1 + realReturn) + rate; if (pot >= target - 1e-12) return y; }
  return null;
}

/**
 * compute(plan, { today, withdrawalRate = 0.04, withIncome = true, careful = false }) -> {
 *   ready, spendingYearly, withdrawalRate, fiNumber, invested (retirement money today), progress, gap,
 *   savingYearly (contributions + what is left over each month), savingsRate (of income), realReturn,
 *   yearsToFi, fiAge, fiYear, coast: { number, reached }, retireAge, yearsToRetire, hasIncome,
 *   fromZero: { half, tenth } (years from nothing saved at half and a tenth of income saved, at this growth and withdrawal rate),
 *   withIncome: incomeAnswer() below | null (withIncome: false); with careful: true it also holds `careful` (carefulAge below)
 * }
 * Every field but withIncome is the 25-times rule as before (the frozen key tests/golden/retirement/fire.csv checks them).
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const year = today ? Number(String(today).slice(0, 4)) : new Date().getFullYear();
  const wr = Number(params.withdrawalRate ?? plan.retirement?.withdrawalRate ?? 0.04);
  const b = buildInputs(plan, params);
  const inc = (plan.income ?? []).length ? computeIncome(plan, { today }) : null;
  const ex = (plan.expenses ?? []).length ? computeExpenses(plan, { today }) : null;
  const spendingYearly = b.inputs ? b.inputs.spending.yearly : (ex ? ex.monthly * 12 : 0);
  if (!spendingYearly) return { ready: false, missing: ["what you spend (Expenses page, or the retirement spending figure on the Projection page)"] };
  const a = plan.assumptions ?? {}, rt = plan.retirement ?? {};
  const stocks = Number(rt.stocksNow ?? 0.7);
  const nominal = stocks * Number(a.returnStocks ?? 0.07) + (1 - stocks) * Number(a.returnBonds ?? 0.04);
  const realReturn = realRate(nominal, Number(a.inflation ?? 0.03));
  const invested = b.inputs ? b.inputs.balances.taxable + b.inputs.balances.deferred + b.inputs.balances.free : 0;
  const fiNumber = spendingYearly / wr;
  const contrib = computeContributions(plan, { today });
  const leftOver = ex && inc ? Math.max(0, (inc.monthly - ex.monthly) * 12) : 0;
  const savingYearly = contrib.totalYearly + Math.max(0, leftOver - contrib.yearly);   // what is left over already includes the contributions typed as expenses? no: contributions are not expenses, so count both but never twice
  const income = inc ? inc.yearly : 0;
  const savingsRate = income > 0 ? Math.min(1, savingYearly / income) : null;
  let yearsToFi = null, pot = invested;
  if (pot >= fiNumber) yearsToFi = 0;
  else if (savingYearly > 0 || realReturn > 0) { for (let y = 1; y <= 80; y++) { pot = pot * (1 + realReturn) + savingYearly; if (pot >= fiNumber) { yearsToFi = y; break; } } }
  const primary = b.people?.[0] ?? null;
  const age = primary ? year - primary.birthYear : null;
  const retireAge = primary ? primary.retireAge : Number(a.retirementAge ?? 65);
  const yearsToRetire = age !== null ? Math.max(0, retireAge - age) : null;
  const coastNumber = yearsToRetire !== null ? fiNumber / Math.pow(1 + realReturn, yearsToRetire) : null;
  return {
    ready: true, spendingYearly, withdrawalRate: wr, fiNumber, invested, progress: Math.min(1, invested / fiNumber), gap: Math.max(0, fiNumber - invested),
    savingYearly, savingsRate, realReturn, yearsToFi, fiAge: yearsToFi !== null && age !== null ? age + yearsToFi : null, fiYear: yearsToFi !== null ? year + yearsToFi : null,
    coast: coastNumber !== null ? { number: coastNumber, reached: invested >= coastNumber } : null, retireAge, yearsToRetire, age, hasIncome: !!income,
    fromZero: { half: yearsFromZero(0.5, realReturn, wr), tenth: yearsFromZero(0.1, realReturn, wr) },
    withIncome: params.withIncome === false ? null : withCareful(plan, today, params.careful === true),
  };
}

/** incomeAnswer, and with careful: true (the page asks after it is drawn; heavy, so on the PC when connected) the age at which
 * the money lasts in 9 of 10 markets as `careful` (carefulAge), searched from the average-market age up. */
function withCareful(plan, today, careful) {
  const w = incomeAnswer(plan, today);
  if (!careful || !w || w.retired || w.earliestAge === null) return w;
  return { ...w, careful: carefulAge(plan, { today, legacy: w.legacy, personId: w.personId, from: w.earliestAge, upTo: w.upTo }) };
}

/**
 * The answer that counts Social Security and pensions (round 5, 2026-11-02): the 25-times rule asks for a pot that pays all
 * the spending for good, so a couple whose Social Security will cover nearly all of it read "not until 65" while Will the
 * money last? says stopping at 62 works. This is the projection's own answer (goal seek's earliestRetireAge with the plan's
 * legacy goal, so both pages agree): markets doing exactly as well as average every year. The page adds the age at which the
 * money lasts in 9 of 10 markets (carefulAge below), worked out after it is drawn.
 * incomeAnswer(plan, today) -> null (no adult with a birth date, no date, or no projection) | {
 *   retired (true: everyone has stopped work, by exact age today; then only `lasts`, `failYear` and the income figures are set),
 *   earliestAge (null: not by upTo), now (they could stop this year), upTo, plannedAge, ageNow, personId, name, legacy,
 *   stopYear (the year they stop at that age), plannedStopYear, yearsSooner (counted by stop year), atAgeReal (the projection's
 *   total at retirement, today's dollars: the row of the stop year, as Will the money last? shows it), atNow (stopping this year),
 *   startYear, ssFrom (the first year any Social Security is paid, or null when the plan has none), ssFullFrom (the year all of
 *   it is), ssYearly (all of it a year, today's dollars), ssShare (ssYearly / retirement spending), ssNone (every adult said
 *   they get none), otherYearly (pensions, rent, dividends and other income a year, not anyone's pay), otherKinds (["pension",
 *   "rent", "dividends", "other"], the kinds in otherYearly), spendingYearly,
 *   others: [{ name, retireAge, retired }] (the other adults, stopping as planned), lasts, failYear (the plan as it stands)
 * }
 */
export function incomeAnswer(plan, today) {
  if (!today) return null;
  const b = buildInputs(plan, { today });
  if (!b.inputs) return null;
  const I = b.inputs;
  const startOf = (x) => (I.people[x.personIndex ?? 0]?.birthYear ?? I.startYear) + (x.startAge ?? 0);
  const social = I.incomes.filter((x) => x.kind === "social" && x.yearly > 0);
  // a partner still working when the household retires comes in as "<name>'s pay": pay, not a pension
  const other = I.incomes.filter((x) => x.kind !== "social" && x.yearly > 0 && !/'s pay$/.test(String(x.name ?? "")));
  const KIND = { rental: "rent", investment: "dividends", support: "other", other: "other" };
  const said = plan.guide?.setup?.ss ?? {};
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  // who still works: by exact age today, as goal seek searches (review 2026-11-02: by calendar year, someone turning the
  // planned age later this year was told "You have stopped work")
  const birth = Object.fromEntries(adults.map((p) => [p.id, p.birthDate]));
  const stillWorks = (q) => (ageOn(birth[q.id], today) ?? I.startYear - q.birthYear) < q.retireAge;
  const base = project(I);
  const out = {
    retired: false, earliestAge: null, now: false, upTo: null, plannedAge: null, ageNow: null, personId: null, name: null, legacy: legacyTarget(plan).target,
    stopYear: null, plannedStopYear: null, yearsSooner: null, atAgeReal: null, atNow: false, startYear: I.startYear,
    ssFrom: social.length ? Math.min(...social.map(startOf)) : null, ssFullFrom: social.length ? Math.max(...social.map(startOf)) : null,
    ssYearly: social.reduce((s, x) => s + x.yearly, 0), ssNone: adults.length > 0 && adults.every((p) => said[p.id] === "none"),
    otherYearly: other.reduce((s, x) => s + x.yearly, 0), otherKinds: [...new Set(other.map((x) => (x.source === "income" && x.type ? KIND[x.type] ?? "other" : "pension")))],
    spendingYearly: I.spending.yearly, others: [],
    lasts: !!base.success, failYear: base.failYear ?? null,
  };
  out.ssShare = out.spendingYearly > 0 ? out.ssYearly / out.spendingYearly : null;
  // who the question is about: the adult marked self while they still work, else the next adult who still works
  const working = I.people.filter(stillWorks);
  const self = I.people[0];
  const who = working.find((q) => q.id === self.id) ?? working[0] ?? null;
  if (!who) { out.retired = true; return out; }
  let e = null;
  try { e = earliestRetireAge(plan, { today, legacy: out.legacy, personId: who.id }); } catch { e = null; }
  if (!e) return { ...out, retired: true };
  Object.assign(out, { earliestAge: e.age, now: e.now, upTo: e.upTo, plannedAge: e.planned, ageNow: e.ageNow, personId: e.personId, name: e.name, plannedStopYear: e.plannedStopYear, others: I.people.filter((q) => q.id !== e.personId).map((q) => ({ name: q.name, retireAge: q.retireAge, retired: !stillWorks(q) })) });
  if (e.age === null) return out;
  Object.assign(out, atRetirement(plan, today, e.personId, e.age) ?? {}, { yearsSooner: e.yearsSooner });
  return out;
}

/**
 * atRetirement(plan, today, personId, age) -> { stopYear, atAgeReal, atNow } | null: the year that adult stops at that age
 * (never before this year) and the projection's total that year, in today's dollars: the same row Will the money last? shows
 * as "At retirement" (review 2026-11-02: this page took the year before, and today's balance when stopping now).
 */
export function atRetirement(plan, today, personId, age) {
  const p2 = JSON.parse(JSON.stringify(plan));
  const person = p2.household?.people?.find((q) => q.id === personId);
  if (!person) return null;
  person.retirementAge = age;
  const J = buildInputs(p2, { today }).inputs;
  const k = J ? J.people.findIndex((q) => q.id === personId) : -1;
  if (!J || k < 0) return null;
  const stopYear = Math.max(J.startYear, J.people[k].birthYear + age);
  const row = project(J).rows.find((r) => r.year === stopYear);
  return { stopYear, atAgeReal: row ? row.totalReal : null, atNow: stopYear === J.startYear };
}

/**
 * carefulAgeSteps(plan, { today, legacy, personId, from, upTo, chance = 0.9, seed = 1, paths = 2000, slice = 40 }): the earliest
 * whole age, from `from` (the average-market age) to `upTo`, at which that adult can stop work and the money lasts to the end
 * (leaving `legacy`) in at least 9 of 10 of the market paths Will the money last? uses for its careful figure (the seed's
 * 2,000 paths), spending the plan's amount the same every year (steady spending, as the careful figure's planned share).
 * A generator, so the page can work it out a slice at a time; carefulAge() runs it through. Returns
 * { age (null: not even at upTo), share (the paths that last at that age, or at upTo), from, upTo, chance, paths, runs,
 *   stopYear, atAgeReal, atNow (atRetirement() at that age) }.
 * A path that lasts when stopping at one age lasts when stopping later, so each age reruns only the paths that fell short.
 */
export function* carefulAgeSteps(plan, { today, legacy = 0, personId, from, upTo, chance = CAREFUL_CHANCE, seed = 1, paths = CAREFUL_SETTLE_PATHS, slice = 40 } = {}) {
  const withAge = (a) => { const p2 = JSON.parse(JSON.stringify(plan)); const q = p2.household?.people?.find((x) => x.id === personId); if (!q) return null; q.retirementAge = a; return buildInputs(p2, { today }).inputs; };
  const first = withAge(from);
  if (!first) return null;
  const seqs = drawSequences(paths, first.endYear - first.startYear + 1, { stocks: first.returns.stocks, bonds: first.returns.bonds, stdevStocks: first.stdev.stocks, stdevBonds: first.stdev.bonds, seed });
  yield 0;
  const need = Math.ceil(chance * paths - 1e-9);
  const ok = new Array(paths).fill(false);
  let runs = 0, next = slice, share = 0, found = null;
  for (let a = from; a <= upTo; a++) {
    const I = a === from ? first : withAge(a);
    if (!I) break;
    const J = { ...I, strategy: "fixed-real" };
    let n = 0;
    for (let k = 0; k < paths; k++) {
      if (!ok[k]) {
        runs++;
        const r = project(J, { sequence: seqs[k] });
        ok[k] = r.success && (legacy <= 0 || r.endBalanceReal >= legacy - 0.5);
        if (runs >= next) { next = runs + slice; yield runs; }
      }
      if (ok[k]) n++;
    }
    share = n / paths;
    if (n >= need) { found = a; break; }
  }
  const at = found === null ? null : atRetirement(plan, today, personId, found);
  return { age: found, share, from, upTo, chance, paths, runs, stopYear: at?.stopYear ?? null, atAgeReal: at?.atAgeReal ?? null, atNow: at?.atNow ?? false };
}

/** carefulAgeSteps run through in one go (the PC, tests). */
export function carefulAge(plan, options = {}) {
  const it = carefulAgeSteps(plan, options);
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}

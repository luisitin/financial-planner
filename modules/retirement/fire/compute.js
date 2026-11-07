// modules/retirement/fire/compute.js -- PURE. Financial independence: the pot that could pay
// for your spending for good, how far you are, how many years at the current saving pace, and
// the "coast" figure (what would be enough now if you stopped adding and let it grow to the
// retirement age). Everything in today's dollars.
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { compute as computeExpenses } from "../../cashflow/expenses/compute.js";
import { compute as computeContributions } from "../contributions/compute.js";
import { buildInputs, healthAdded, workingNow, withStops, STOP_NOW_FROM_AGE } from "../projection/compute.js";
import { realRate } from "../../../core/math/finance.js";
import { project } from "../../../core/math/retirement.js";
import { earliestRetireAge } from "../../scenarios/goal-seek/compute.js";
import { legacyTarget } from "../../estate/legacy/compute.js";
import { drawSequences, CAREFUL_CHANCE, CAREFUL_SETTLE_PATHS } from "../monte-carlo/compute.js";

/**
 * The fold's line on why the rule of thumb differs from the answer above (fifth pass, 2026-11-02: with the projection's health
 * line, the answer above counts health cover before Medicare, and the rule does not; the line said so before the health line
 * existed and was taken out while nothing counted it). ruleWords(times, healthAdded) -> text
 */
export function ruleWords(times, health = false) {
  return `A quick rule: savings of ${times} times what you spend a year pay for life without a paycheck. It counts everything left over each month as saved and leaves out Social Security, pensions${health ? ", taxes and health insurance before Medicare, which the answer above counts" : " and taxes"}, so it can come out sooner or later than the answer above. The answer above, worked out year by year from your plan, is the one to go by.`;
}

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
 *   healthAdded (the plan's answer above counts health cover on top of spending: the fold says the rule leaves it out),
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
  // the engine's spending figure leaves out a health premium on Expenses (the projection's health line pays cover from
  // retirement on, and this page has no health line): it goes back in, so the FI number is still on all of today's spending
  const spendingYearly = b.inputs ? b.inputs.spending.yearly + (b.health?.removedMonthly ?? 0) * 12 : (ex ? ex.monthly * 12 : 0);
  if (!spendingYearly) return { ready: false, missing: ["what you spend (Expenses page, or the retirement spending figure on Will the money last?)"] };
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
    fromZero: { half: yearsFromZero(0.5, realReturn, wr), tenth: yearsFromZero(0.1, realReturn, wr) }, healthAdded: healthAdded(b.health),
    withIncome: params.withIncome === false ? null : withCareful(plan, today, params.careful === true),
  };
}

/** incomeAnswer, and with careful: true (the page asks after it is drawn; heavy, so on the PC when connected) the age at which
 * the money lasts in 9 of 10 markets as `careful` (carefulAge), searched from the average-market age up. */
function withCareful(plan, today, careful) {
  const w = incomeAnswer(plan, today);
  if (!careful || !w || w.retired || w.earliestAge === null) return w;
  return { ...w, careful: carefulAge(plan, { today, legacy: w.legacy, personId: w.personId, from: w.earliestAge, upTo: w.upTo, stopNow: w.stopNow }) };
}

/**
 * The words under the answer when it counts the first adult as stopped now while the plan still has them stopping later
 * (`plannedStop`, review 2026-11-06), up to the link to the People page ("... on the "): what this page counts, why Will the
 * money last? starts spending savings later (their age on file; or, with `by`, review 2026-11-06 sixth pass, the household
 * living on another adult's pay until that adult stops: the projection's household retirement year), and what to change.
 * "Not working now" (`notWorking`) reads "not working" and "does not go back to work". sayName(name) -> the name as the page
 * says it ("you" for "Me"). A parent at home under 55 (`by`, `notWorking`, age under STOP_NOW_FROM_AGE: the household is a
 * one-earner family, verify of the seventh pass) is not told to set a retirement age of 35: setting it would count the household
 * as retired now; the words end "Who works, and until what age, is on the ". plannedStopWords(plannedStop, sayName) -> text ("" with none)
 */
export function plannedStopWords(ps, sayName = (n) => (n === "Me" || !n ? "you" : String(n))) {
  if (!ps) return "";
  const who = sayName(ps.name), you = who === "you";
  const why = ps.by ? `Will the money last? counts the household as living on ${sayName(ps.by.name)}'s pay until ${sayName(ps.by.name)} stops work at ${ps.by.age}, so it starts spending savings only in ${ps.plannedYear}.`
    : ps.notWorking ? `Your plan still has ${who} working until ${ps.plannedAge}, so Will the money last? starts spending savings only in ${ps.plannedYear}.`
    : `Your plan still has ${who} stopping work at ${ps.plannedAge}, so Will the money last? starts spending savings only in ${ps.plannedYear}.`;
  if (ps.by && ps.notWorking && ps.age < STOP_NOW_FROM_AGE) return `This counts ${who} as not working now. ${why} Who works, and until what age, is on the `;
  return ps.notWorking
    ? `This counts ${who} as not working from this year on. ${why} If ${who} ${you ? "do" : "does"} not go back to work, set ${you ? "your" : `${who}'s`} retirement age to ${ps.age} on the `
    : `This counts ${who} as stopped from this year. ${why} If ${who} ${you ? "have" : "has"} stopped, set ${you ? "your" : `${who}'s`} retirement age to ${ps.age} on the `;
}

/**
 * What of the other income stops, and when, in words after its total (review 2026-11-06, seventh pass: each step, not one year
 * for all of it): all of it stopping, " until 2030, then $14,400 until 2034"; part of it, " ($18,000 of it only until 2030 and
 * $14,400 only until 2034)". otherEndWords(otherEnding, total, money) -> text ("" with none)
 */
export function otherEndWords(ends, total, money = (n) => `$${Math.round(n).toLocaleString("en-US")}`) {
  if (!ends) return "";
  const steps = ends.steps?.length ? ends.steps : [{ until: ends.by, yearly: ends.yearly }];
  if (ends.all) {
    let left = total;
    return steps.map((st, i) => { const t = i === 0 ? ` until ${st.until}` : `, then ${money(left)} until ${st.until}`; left -= st.yearly; return t; }).join("");
  }
  const parts = steps.map((st, i) => `${money(st.yearly)}${i === 0 ? " of it" : ""} only until ${st.until}`);
  return ` (${parts.length < 2 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`})`;
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
 *   they get none), ssPaidNow (some of it is paid already: claimed before this year, or typed on the Income page and started),
 *   otherYearly (pensions, rent and other income the projection counts after work stops a year: not anyone's pay, nor support
 *   counted only while its owner works), otherKinds (["pension", "rent", "other"], the kinds in otherYearly),
 *   left (buildInputs' otherLeft: [{ name, yearly, why: "work" | "growth" | "accounts" }], income not counted after work stops),
 *   strategy (the plan's withdrawal rule; both ages spend the plan's amount the same every year whatever it is), spendingYearly,
 *   others: [{ name, retireAge, retired, notWorking, stoppingNow? }] (the other adults: stopping as planned, already retired, or
 *   under their retirement age with no pay and not said retired: "not working", a parent at home; stoppingNow: at work by the
 *   plan and reaching their planned age this year, seventh pass), lasts, failYear (the plan as it
 *   stands; when everyone has stopped, with each who stopped before their planned age stopping this year),
 *   stopNow: [{ personId, age }] (the adults this answer has stopping now rather than at the age on file: see below; [] for
 *   most plans; carefulAgeSteps takes it so the 9-in-10 age is searched on the same plan),
 *   plannedStop: { personId, name, age, plannedAge, plannedYear, notWorking? } | null (review 2026-11-06: the first adult is in
 *   stopNow while the plan still has them stopping at plannedAge, in plannedYear, the year Will the money last? starts spending
 *   savings; notWorking: true when they said "Not working now" rather than "retired"; by: { name, age } when that year is
 *   another adult's stop, the projection's retireBy: review 2026-11-06, the household lives on that adult's pay until then),
 *   otherEnding: { yearly, by, all, steps: [{ until, yearly }] } | null (review 2026-11-06: the part of otherYearly that stops, the
 *   last year any of it is paid, and whether all of it stops; seventh pass: `steps`, each last year a part is paid and how much
 *   of it stops after that year, earliest first; otherEndWords says them)
 * }
 * Who still works (recheck 2026-11-05): an adult under their retirement age by exact age today, with pay coming in (salary,
 * bonus or business on the Income page; one with no owner is the first adult's) or a retirement contribution, or who said
 * "work" in Get started. A plan with nothing on the Income page and no contribution goes by age alone, as before (nothing
 * says anyone stopped). The retired couple's Sam (69, retirement age 70, salary ended in 2025) has stopped.
 * The first adult is the exception (second pass, same day): their planned age sets the year the plan starts spending from
 * savings (projection retireYear), so while that year is ahead they still work unless they said "retired" or "not working
 * now" in Get started. Someone between jobs, with a new job starting next month or with gig pay typed as other income is
 * asked about, as Goal seek is; "no pay line" read as "stopped" said "The money lasts" for a 45-year-old whose money,
 * stopping now, runs out in 2040, and told a working partner "could stop work now".
 * An adult who has stopped before the age on file stops now in what this page works out (stopNow): everyone, when nobody
 * works (the retired answer: `lasts` and `failYear`); the first adult, when they said they stopped and a partner is asked
 * about (that partner's age, and the 9-in-10 age, are searched with the plan spending from savings from this year).
 * Review 2026-11-06 (sixth pass): who works is now the projection's one work rule (workRule, through workingNow), the health
 * line's and Goal seek's, with the exact-age test kept: as above, except that a contribution counts when it goes to a plan at
 * work (a 401(k), or one with a match) or nobody else has pay (a spousal IRA does not make Lee work while Sam does), Get
 * started's "retired" or "Not working now" wins over pay and saving, and a plan with nothing typed no longer has everyone
 * under their age working: the first adult is presumed at work while the plan's retirement year is ahead (as before), a
 * partner with no pay, saving or answer is not (defect 2 of the health line's fifth-pass verify: Bo, 63, no pay, read
 * "Even working to 75 ... Bo works until 75" while his age moves nothing). stopNow only when the partner asked about has pay
 * on Income (else their age is searched on the plan as it is, where it moves the household's retirement year).
 */
export function incomeAnswer(plan, today) {
  if (!today) return null;
  const b = buildInputs(plan, { today });
  if (!b.inputs) return null;
  const I = b.inputs;
  const startOf = (x) => (I.people[x.personIndex ?? 0]?.birthYear ?? I.startYear) + (x.startAge ?? 0);
  const social = I.incomes.filter((x) => x.kind === "social" && x.yearly > 0);
  // a partner still working when the household retires comes in as "<name>'s pay": pay, not a pension; support with no end date
  // counts only while its owner works (projection otherIncome), so it is not income after work either
  // (round 8 batch 6 verify: a rental's loan payment that the spending gives back once the loan is paid off, projection
  // rentalLines "loan back", is spending no longer needed from that year, not rent: it read "$21,452 a year of rent")
  const other = I.incomes.filter((x) => x.kind !== "social" && x.yearly > 0 && x.type !== "pay" && !x.whileWorking && x.part !== "loan back");
  const KIND = { pension: "pension", rental: "rent", investment: "dividends", support: "other", other: "other" };
  const said = plan.guide?.setup?.ss ?? {};
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  // who still works: by exact age today, as goal seek searches (review 2026-11-02: by calendar year, someone turning the
  // planned age later this year was told "You have stopped work")
  // one work rule with the health line and Goal seek (review 2026-11-06; projection workingNow on workRule): an adult under their
  // retirement age by exact age today who has pay, a retirement contribution at work (or any, when nobody else has pay) or said
  // "work" in Get started, or the first adult while the plan's retirement year is ahead and they did not say they stopped (second
  // pass: someone between jobs); never someone Get started says is retired or not working now, and no longer everyone by age
  // when nothing is typed (a partner with no pay and no answer, whose age moves nothing in the plan, was asked about)
  const wn = workingNow(plan, I, today);
  const status = plan.guide?.setup?.status ?? {};
  const ageNow = wn.ageNow, underAge = wn.underAge, works = wn.holds, stillWorks = wn.stillWorks;
  // the plan with these adults stopping this year instead of at the age on file
  const stopping = (qs) => qs.map((q) => ({ personId: q.id, age: ageNow(q) }));
  const base = project(I);
  const out = {
    retired: false, earliestAge: null, now: false, upTo: null, plannedAge: null, ageNow: null, personId: null, name: null, legacy: legacyTarget(plan).target,
    stopYear: null, plannedStopYear: null, yearsSooner: null, atAgeReal: null, atNow: false, startYear: I.startYear,
    ssFrom: social.length ? Math.min(...social.map(startOf)) : null, ssFullFrom: social.length ? Math.max(...social.map(startOf)) : null,
    ssYearly: social.reduce((s, x) => s + x.yearly, 0), ssNone: adults.length > 0 && adults.every((p) => said[p.id] === "none"),
    // Social Security typed on the Income page is being paid now (incomeSocial starts it this year), as is one claimed before
    // this year (recheck 2026-11-05: Ruth, paid for years, read "It counts Social Security from 2026")
    // (second pass: one typed with a start date later this year is not paid yet: incomeSocial's startsOn)
    ssPaidNow: social.some((x) => startOf(x) < I.startYear || (x.source === "income" && !x.startsOn && startOf(x) <= I.startYear)),
    otherYearly: other.reduce((s, x) => s + x.yearly, 0), otherKinds: [...new Set(other.map((x) => KIND[x.type] ?? "pension"))],
    left: (b.otherLeft ?? []).map((x) => ({ name: x.name, yearly: x.yearly, why: x.why })), strategy: I.strategy,
    spendingYearly: I.spending.yearly, others: [],
    lasts: !!base.success, failYear: base.failYear ?? null, stopNow: [], plannedStop: null,
  };
  out.ssShare = out.spendingYearly > 0 ? out.ssYearly / out.spendingYearly : null;
  // the part of otherYearly that stops (an end date, or child support at the child's 18th) and the last year any of it is
  // paid (review 2026-11-06: "plus $14,400 a year of other income" for child support that ends in 2034)
  const endOf = (x) => (x.endAge === undefined || x.endAge === null ? null : (I.people[x.personIndex ?? 0]?.birthYear ?? I.startYear) + x.endAge);
  const ending = other.filter((x) => endOf(x) !== null);
  // each year a part stops, with what stops then (review 2026-11-06, seventh pass: child support to 2034 with alimony to 2030 read
  // "$32,400 a year of other income until 2034", while from 2031 only $14,400 is paid)
  const steps = [];
  for (const x of ending) { const y = endOf(x), st = steps.find((t) => t.until === y); if (st) st.yearly += x.yearly; else steps.push({ until: y, yearly: x.yearly }); }
  steps.sort((a, b) => a.until - b.until);
  out.otherEnding = ending.length ? { yearly: ending.reduce((s, x) => s + x.yearly, 0), by: Math.max(...ending.map(endOf)), all: ending.length === other.length, steps } : null;
  // who the question is about: the adult marked self while they still work, else the next adult who still works (wn.lead)
  const self = I.people[0];
  // the first adult is counted as stopped now while the plan still has them stopping later: Will the money last? starts
  // spending savings in that later year (review 2026-11-06: "The money runs short in 2052" here, "It lasts, just" there)
  // (verify 2026-11-06: one who said "Not working now", a parent at home, is notWorking: the page says "not working", not "stopped")
  const plannedStop = (stops) => (stops.some((s) => s.personId === self.id) && I.retireYear > I.startYear ? { personId: self.id, name: self.name, age: ageNow(self), plannedAge: self.retireAge, plannedYear: I.retireYear, ...(status[self.id] === "none" ? { notWorking: true } : {}), ...(b.retireBy && !b.retireBy.first && !b.retireBy.nobody ? { by: { name: b.retireBy.name, age: b.retireBy.age } } : {}) } : null);
  const who = wn.lead;
  if (!who) {
    // everyone has stopped: an adult who stopped before their planned age spends from savings from this year, not from that age
    // (seventh pass: not one whose job starts later, a pay line from next year: the plan counts that pay, so their age stays)
    const early = I.people.filter(underAge).filter((q) => !wn.payLines(q).some((r) => r.from > I.startYear));
    if (early.length) {
      const J = buildInputs(withStops(plan, stopping(early)), { today }).inputs;
      if (J) { const r = project(J); Object.assign(out, { lasts: !!r.success, failYear: r.failYear ?? null, stopNow: stopping(early), plannedStop: plannedStop(stopping(early)) }); }
    }
    out.retired = true; return out;
  }
  // a partner is asked about while the first adult said they stopped before the age on file: the partner's age moves no
  // year in the plan as it stands, so it is searched with the first adult stopping now
  const stopNow = wn.stopNow;
  const P = withStops(plan, stopNow);
  let e = null;
  try { e = earliestRetireAge(P, { today, legacy: out.legacy, personId: who.id }); } catch { e = null; }
  if (!e) return { ...out, retired: true };
  Object.assign(out, { stopNow, plannedStop: plannedStop(stopNow), earliestAge: e.age, now: e.now, upTo: e.upTo, plannedAge: e.planned, ageNow: e.ageNow, personId: e.personId, name: e.name, plannedStopYear: e.plannedStopYear, others: I.people.filter((q) => q.id !== e.personId).map((q) => ({ name: q.name, retireAge: q.retireAge, retired: !stillWorks(q), notWorking: underAge(q) && !works(q) && status[q.id] !== "retired",
    // reaching their planned age this year while still at work by the plan (pay, an answer): stopping this year, not "already
    // retired" (fire-ver8b: Ray, 64, on salary, with 64 on file; seventh pass)
    ...(!underAge(q) && works(q) && q.birthYear + q.retireAge === I.startYear ? { stoppingNow: true } : {}) })) });
  if (e.age === null) return out;
  Object.assign(out, atRetirement(P, today, e.personId, e.age) ?? {}, { yearsSooner: e.yearsSooner });
  return out;
}

/** withStops: the projection's (Goal seek searches the same plan); exported here as before. */
export { withStops };

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
 * carefulAgeSteps(plan, { today, legacy, personId, from, upTo, chance = 0.9, seed = 1, paths = 2000, slice = 40, stopNow = [] }): the earliest
 * whole age, from `from` (the average-market age) to `upTo`, at which that adult can stop work and the money lasts to the end
 * (leaving `legacy`) in at least 9 of 10 of the market paths Will the money last? uses for its careful figure (the seed's
 * 2,000 paths), spending the plan's amount the same every year (steady spending, as the careful figure's planned share).
 * A generator, so the page can work it out a slice at a time; carefulAge() runs it through. Returns
 * { age (null: not even at upTo), share (the paths that last at that age, or at upTo), from, upTo, chance, paths, runs,
 *   stopYear, atAgeReal, atNow (atRetirement() at that age) }.
 * A path that lasts when stopping at one age lasts when stopping later, so each age reruns only the paths that fell short.
 * stopNow (incomeAnswer's): adults who stop this year in the search instead of at the age on file (withStops).
 */
export function* carefulAgeSteps(plan0, { today, legacy = 0, personId, from, upTo, chance = CAREFUL_CHANCE, seed = 1, paths = CAREFUL_SETTLE_PATHS, slice = 40, stopNow = [] } = {}) {
  const plan = withStops(plan0, stopNow);   // the plan incomeAnswer searched (its stopNow)
  // steady spending in the plan too, so the health line is priced on the same withdrawals (as earliestRetireAge, review 2026-11-06)
  const withAge = (a) => { const p2 = JSON.parse(JSON.stringify(plan)); const q = p2.household?.people?.find((x) => x.id === personId); if (!q) return null; q.retirementAge = a; p2.retirement = { ...(p2.retirement ?? {}), strategy: "fixed-real" }; return buildInputs(p2, { today }).inputs; };
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

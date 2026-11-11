// modules/retirement/social-security/compute.js -- PURE. The retirement benefit from a pasted
// ssa.gov earnings record, the way the Social Security Administration works it out: index each
// year's earnings to the wage level of the year you turn 60, average the best 35 years, apply
// the bend-point formula for the year you turn 62, then adjust for the age you claim. Tables
// come from ssa.tools (data/ssa.js). A typed "monthly at full retirement age" from a Social
// Security statement works instead of a record.
import { perYear } from "../../../core/math/periods.js";
import { isGuess, guessAt } from "../../../core/estimate/index.js";
import { nameIn, NameIn, nameOf, verbFor, isYou } from "../../../core/words.js";
import { WAGE_INDICES, COLA, MAXIMUM_EARNINGS, EARNINGS_PER_CREDIT, EARNINGS_PER_CREDIT_BEFORE_1978, MAX_CREDITS, SSA_EARNINGS_YEARS, FULL_RETIREMENT_AGE, BENDPOINT1_IN_1977, BENDPOINT2_IN_1977, BEFORE_BENDPOINT1_MULTIPLIER, BEFORE_BENDPOINT2_MULTIPLIER, AFTER_BENDPOINT2_MULTIPLIER } from "./data/ssa.js";

const awiYears = Object.keys(WAGE_INDICES).map(Number);
export const LAST_AWI_YEAR = Math.max(...awiYears);
const awi = (year) => WAGE_INDICES[Math.min(year, LAST_AWI_YEAR)] ?? WAGE_INDICES[Math.max(Math.min(...awiYears), year)];
const LAST_MAX_YEAR = Math.max(...Object.keys(MAXIMUM_EARNINGS).map(Number));
/** The taxable maximum for a year; a year past the last published one keeps the last (wages are not projected either: the wage index is frozen too). */
export const maximumEarnings = (year) => MAXIMUM_EARNINGS[Math.min(year, LAST_MAX_YEAR)] ?? Infinity;
/**
 * How far below the full-age amount a benefit already paid from 62 must be to count as a reduced early claim: more than
 * 0.5% (one month early takes 5/9 of 1% off). Paid about the full amount, it is a disability benefit, which is unreduced.
 */
export const EARLY_TOLERANCE = 0.005;
/** Round down to the dime, the way SSA does, without binary floating point flooring an exact $x.x0 a dime low ($2,315.50 is stored as 2315.4999...). */
export const floorDime = (x) => Math.floor(x * 10 + 1e-8) / 10;

/** Full retirement age for a birth year: { years, months, delayedIncreaseAnnual }. Born on Jan 1 counts as the year before (SSA rule). */
export function fullRetirementAge(birthYear) {
  const row = FULL_RETIREMENT_AGE.find((r) => birthYear >= r.minYear && birthYear <= r.maxYear) ?? FULL_RETIREMENT_AGE[FULL_RETIREMENT_AGE.length - 1];
  return { years: row.ageYears, months: row.ageMonths, delayedIncreaseAnnual: row.delayedIncreaseAnnual, asYears: row.ageYears + row.ageMonths / 12 };
}
/** Benefit as a share of the primary insurance amount when claiming at `claimAge` (62 to 70, fractional years allowed). */
export function claimFactor(birthYear, claimAge) {
  const fra = fullRetirementAge(birthYear);
  const claimMonths = Math.round(Math.min(70, Math.max(62, claimAge)) * 12);
  const fraMonths = Math.round(fra.asYears * 12);
  if (claimMonths < fraMonths) {
    const early = fraMonths - claimMonths;
    const first = Math.min(36, early), rest = Math.max(0, early - 36);
    return 1 - first * (5 / 9) / 100 - rest * (5 / 12) / 100;
  }
  const late = Math.min(claimMonths - fraMonths, Math.max(0, 70 * 12 - fraMonths));
  return 1 + late * (fra.delayedIncreaseAnnual / 12);
}
/**
 * A spouse's benefit as a share of the worker's primary insurance amount, claimed at `claimAge` against the spouse's
 * own full retirement age (from their birth year): half, less 25/36 of 1% a month for the first 36 months early and
 * 5/12 of 1% for each month beyond; no credits for waiting past full retirement age (SSA, benefits for a spouse).
 * The points come off the 50% here, as the answer key (tests/golden/retirement/ss-benefits.csv) reads it; SSA applies
 * them to the 50% (`spousalEarlyFactor` below, which the couple's top-up uses). Kept for `spousalAtSameAge` only.
 */
export function spousalFactor(birthYear, claimAge) {
  const fraMonths = Math.round(fullRetirementAge(birthYear).asYears * 12);
  const early = Math.max(0, fraMonths - Math.round(Math.min(70, Math.max(62, claimAge)) * 12));
  return Math.max(0, 0.5 - Math.min(36, early) * (25 / 36) / 100 - Math.max(0, early - 36) * (5 / 12) / 100);
}
/**
 * A spouse's benefit started at `age` as a share of its full amount (half the worker's primary insurance amount): 1 less
 * 25/36 of 1% for each of the first 36 months before the spouse's own full retirement age and 5/12 of 1% for each month
 * beyond; nothing added for waiting (SSA Handbook 724.1 and 724.4; https://www.ssa.gov/oact/quickcalc/spouse.html: "this
 * reduction factor is applied to the base spousal benefit, which is 50 percent of the worker's primary insurance amount",
 * so 62 with a full age of 67 is 65% of it, 32.5% of the worker's amount). The months are counted from the month the
 * spouse's benefit starts (Handbook 725), which is never before the worker's own (oact/quickcalc/spouse.html). Used for a
 * couple's top-up (recheck 2026-11-05); `spousalFactor` above keeps the answer key's reading for `spousalAtSameAge`.
 */
export function spousalEarlyFactor(birthYear, age) {
  const fraMonths = Math.round(fullRetirementAge(birthYear).asYears * 12);
  const early = Math.max(0, fraMonths - Math.round(Math.min(70, Math.max(62, age)) * 12));
  return 1 - Math.min(36, early) * (25 / 36) / 100 - Math.max(0, early - 36) * (5 / 12) / 100;
}
/**
 * What a surviving spouse at their own full retirement age receives on a worker's record: the worker's benefit
 * (with any credits for waiting), but when the worker claimed early, never less than 82.5% of the worker's primary
 * insurance amount (the widow(er)'s limit, SSA POMS RS 00615.320).
 */
export function survivorAmount(pia, workerMonthly, claimedEarly) {
  return claimedEarly ? Math.max(workerMonthly, floorDime(pia * 0.825)) : workerMonthly;
}
/** Parse text pasted from ssa.gov's earnings table: lines with a year and a dollar amount (readRecord's `record`). */
export function parseRecord(text) {
  return readRecord(text).record;
}

/**
 * readRecord(text, { thisYear }) -> { record, read, unread, later, empty }: what a pasted earnings table holds, and what could not
 * be used, so Save can say so (stress test 2026-11-11, R-A3: a paste the page could not read was answered "Nothing to save", and a
 * mistyped line was dropped under a green "saved").
 * - A line "2024 $69,000" (year, then amount; more columns after are ignored) is a row; so is "$69,000 2024" (amount, then year).
 *   A row that covers several years ("1981-1990 $120,000") cannot be split by year: it is `unread`.
 * - A phone often copies a table one cell per line ("2024" / "$69,000" / "$69,000"): a line that is only a year takes the next
 *   line that is only an amount, and a second amount-only line under it (ssa.gov's Medicare column) belongs to the same row.
 * - The same year twice keeps the larger amount. A year after `thisYear` has not happened: left out, listed in `later`.
 * - `unread`: lines holding a digit that are none of these (a mistyped year: "203 66500"); lines of words only (the table's
 *   headings) are skipped without a word. `empty`: nothing but spaces was pasted.
 */
export function readRecord(text, { thisYear = null } = {}) {
  const YEAR = /^(?:19\d{2}|20\d{2})$/;
  // cents are one or two digits: "69.000" (a dot as the thousands mark) is not $69 (review round 1, N1)
  const amountOf = (t) => { const m = /^\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/.exec(t.trim()); return m ? Number(m[1].replace(/,/g, "")) : null; };
  const lines = String(text ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = new Map(), unread = [], later = [];
  let year = null, took = false;   // a year waiting for its amount on the next line; whether the last year-only line got one
  const add = (y, amount) => {
    if (thisYear !== null && y > thisYear) { if (!later.includes(y)) later.push(y); return; }
    out.set(y, Math.max(out.get(y) ?? 0, amount));
  };
  for (const line of lines) {
    if (YEAR.test(line)) { if (year !== null && !took) unread.push(String(year)); year = Number(line); took = false; continue; }
    // a year-only line followed by words ("2025" / "Not yet recorded"): that year has no figure yet; nothing wrong
    if (year !== null && !took && !/\d/.test(line)) { year = null; continue; }
    const alone = amountOf(line);
    if (alone !== null && year !== null) { if (!took) { add(year, alone); took = true; } continue; }   // the second column: same row
    if (year !== null && !took) unread.push(String(year));
    year = null; took = false;
    // a row for several years together ("1981-1990 $120,000") cannot be split into years: said as unread
    if (/^(?:19|20)\d{2}\s*[-\u2013\u2014]\s*(?:19|20)\d{2}/.test(line)) { unread.push(line); continue; }
    // a year anywhere in the line, then its amount ("2024 $69,000", "|2023|$66,500|", "1. 2024 $69,000", "Year 2024: $69,000")
    const m = /(?:^|[^\d])(19\d{2}|20\d{2})[^\d$]+\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2}(?!\d))?/.exec(line);
    // an amount in thousands ("69k") is not read as $69: listed as unread
    if (m && /^\s*k\b/i.test(line.slice(m.index + m[0].length))) { unread.push(line); continue; }
    // a space or a dot as the thousands mark ("69 000", "69.000") is not read as $69 either: listed as unread, so a
    // green "saved" never drops the benefit to $0 (review round 1, N1)
    // the same for an apostrophe ("69'000", Swiss style) or a comma set apart ("69 , 000"); a minus stuck to the amount
    // ("2024 -500") is not read as +500 (breaker on N1). Two columns ("69,000 69,000") still read: a space and digits is a column
    if (m && /^(?:[\s.]\d{3}(?!\d)|\s*['\u2019]\s*\d|\s+,\s*\d)/.test(line.slice(m.index + m[0].length))) { unread.push(line); continue; }
    if (m && /\s[-\u2212]\$?\d[\d,]*(?:\.\d{1,2})?$/.test(m[0])) { unread.push(line); continue; }
    if (m) { add(Number(m[1]), Number(m[2].replace(/,/g, ""))); continue; }
    // a year with words and no amount ("2026  Not yet recorded"): nothing to read, and nothing wrong
    if (/^(?:19|20)\d{2}\b[^\d]*$/.test(line)) continue;
    // amount first, then the year (two cells only)
    const cells = line.split(/\s+/);
    if (cells.length === 2 && YEAR.test(cells[1]) && amountOf(cells[0]) !== null && !YEAR.test(cells[0])) { add(Number(cells[1]), amountOf(cells[0])); continue; }
    if (/\d/.test(line)) unread.push(line);
  }
  if (year !== null && !took) unread.push(String(year));
  const record = [...out.entries()].sort((a, b) => a[0] - b[0]).map(([y, earnings]) => ({ year: y, earnings }));
  return { record, read: record.length, unread, later: later.sort((a, b) => a - b), empty: lines.length === 0 };
}
/** Credits earned from a record (4 a year at most; 40 needed). */
export function credits(record) {
  let n = 0;
  for (const r of record ?? []) { const per = r.year < 1978 ? EARNINGS_PER_CREDIT_BEFORE_1978 : (EARNINGS_PER_CREDIT[r.year] ?? EARNINGS_PER_CREDIT[Math.max(...Object.keys(EARNINGS_PER_CREDIT).map(Number))]); n += Math.min(4, Math.floor((Number(r.earnings) || 0) / per)); }
  return Math.min(n, MAX_CREDITS);
}
/**
 * estimateBenefit(record, { birthYear, claimAge = FRA, futureEarnings = "same", stopYear, today }) -> {
 *   eligible, credits, indexingYear, aime, bendPoints: [bp1, bp2], pia (monthly, in the dollars of the year you turn 62, then COLA'd to today when past 62),
 *   fra: { years, months }, claimFactor, monthly (at claimAge), yearly, top35: [{ year, earnings, indexed }], projectedYears: n
 * }
 * A year past the last published taxable maximum is capped at that last maximum.
 * futureEarnings "same": the last year's earnings repeat every year until `stopYear` (the year before claiming, or before retiring); "none": nothing more.
 */
export function estimateBenefit(record, { birthYear, claimAge = null, futureEarnings = "same", stopYear = null, today = null } = {}) {
  const fra = fullRetirementAge(birthYear);
  const claim = claimAge ?? fra.asYears;
  const rec = [...(record ?? [])].filter((r) => r.year && Number(r.earnings) >= 0).map((r) => ({ year: Number(r.year), earnings: Math.min(Number(r.earnings) || 0, maximumEarnings(Number(r.year))) }));
  const thisYear = today ? Number(String(today).slice(0, 4)) : (rec.length ? Math.max(...rec.map((r) => r.year)) : birthYear + 62);
  const lastYear = rec.length ? Math.max(...rec.map((r) => r.year)) : null;
  const last = rec.find((r) => r.year === lastYear);
  let projectedYears = 0;
  if (futureEarnings === "same" && last && last.earnings > 0) {
    const until = stopYear ?? (birthYear + Math.floor(claim) - 1);
    for (let y = lastYear + 1; y <= until; y++) { rec.push({ year: y, earnings: Math.min(last.earnings, maximumEarnings(y)) }); projectedYears++; }
  }
  const year62 = birthYear + 62, indexingYear = year62 - 2;
  const indexed = rec.map((r) => ({ ...r, indexed: r.year < indexingYear ? r.earnings * awi(indexingYear) / awi(r.year) : r.earnings }));
  const top35 = [...indexed].sort((a, b) => b.indexed - a.indexed).slice(0, SSA_EARNINGS_YEARS);
  const aime = Math.floor(top35.reduce((s, r) => s + r.indexed, 0) / (SSA_EARNINGS_YEARS * 12));
  const scale = awi(indexingYear) / awi(1977);
  const bp1 = Math.round(BENDPOINT1_IN_1977 * scale), bp2 = Math.round(BENDPOINT2_IN_1977 * scale);
  let pia = BEFORE_BENDPOINT1_MULTIPLIER * Math.min(aime, bp1) + BEFORE_BENDPOINT2_MULTIPLIER * Math.max(0, Math.min(aime, bp2) - bp1) + AFTER_BENDPOINT2_MULTIPLIER * Math.max(0, aime - bp2);
  pia = floorDime(pia);
  // cost-of-living increases apply from the year you turn 62 (published COLAs only; each one is paid from January of the next year)
  for (let y = year62; y < thisYear; y++) if (COLA[y] !== undefined) pia = floorDime(pia * (1 + COLA[y]));
  const factor = claimFactor(birthYear, claim);
  const monthly = floorDime(pia * factor);
  const cr = credits(rec);
  return { eligible: cr >= MAX_CREDITS, credits: cr, indexingYear, aime, bendPoints: [bp1, bp2], pia, fra: { years: fra.years, months: fra.months }, claimAge: claim, claimFactor: factor, monthly, yearly: monthly * 12, top35: top35.sort((a, b) => a.year - b.year), projectedYears, yearsInRecord: rec.length };
}

/**
 * compute(plan, { today }) -> {
 *   people: [{ id, name, birthYear, age, ageNow (exact, in years), fra, claimAge (the age the benefit is valued at: the one on
 *     file (with none saved: the full retirement age, or 70 from 70 on); for a benefit paid before the claim age on file,
 *     never later than full retirement age: the full retirement age when it is unreduced (marked `paidUnreduced`, paid
 *     before 62, or the Income line pays about the full-age amount), else today's age to the month, as a reduced claim),
 *     claimAgeOnFile, source: "record"|"typed"|"none", estimate, pia (the full-age amount, always from the record or the
 *     statement's figure), monthly (for anyone already paid by a Social Security line on Income, what that line pays,
 *     at every date), fromAge (the age, whole years, the projection counts it from), birthMonth,
 *     startedEarly (paid before the claim age on file, marked `paidUnreduced`, or paid clearly less than the full-age
 *     amount with a claim age on file at or past full retirement age), reducedEarly (that, as a reduced claim),
 *     unreduced (that, at the full-age amount), paidLine,
 *     options: [{ claimAge, monthly, factor }] (62 to 70; past 62 and not claimed, only from today's age to 70),
 *     claimed (already gets it: setup's "getting" or Social Security on Income), claimedYear, pastClaimAge (not claimed and the
 *     claim age on file has passed), wait: { nowAge, nowMonthly, at70Monthly, at70 ("YYYY-MM"), breakEven (age) } | null,
 *     spousalAtSameAge (a spouse with no benefit of their own, the same age, claiming at the same age, on this record),
 *     survivor (what a surviving spouse at their full retirement age would get on this record) }],
 *   couple: null | { spousal: { [personId]: monthly top-up on the partner's record }, spousalCounted, spousalFromAge (see couple()),
 *     survivorMonthly: { [personId who survives]: monthly }, bothMonthly, survivorYearly (the larger benefit, kept by whoever outlives the other) },
 *   householdYearly (each one's own and the counted top-ups, a year), hasData
 * }
 * plan.retirement.socialSecurity[personId] = { claimAge, record: [{ year, earnings }], monthlyAtFRA, futureEarnings,
 *   paidUnreduced (optional: setup's "I get it now" before 62, a disability or survivor benefit paid at the full-age amount) }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const ss = plan.retirement?.socialSecurity ?? {};
  const year = today ? Number(String(today).slice(0, 4)) : null;
  const people = (plan.household?.people ?? []).filter((p) => p.role !== "dependent").map((p) => {
    const birthYear = p.birthDate ? Number(String(p.birthDate).slice(0, 4)) : null;
    const s = ss[p.id] ?? {};
    const fra = birthYear ? fullRetirementAge(birthYear) : null;
    // decisions already made (round 4, 2026-11-02): someone who already gets it (setup's "I already get it", or Social
    // Security on the Income page) is shown a fact, not a choice of claiming ages; someone past 62 who has not claimed
    // chooses only from today's age to 70, with "now or at 70" answered directly
    const exact = p.birthDate && today ? ((Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7))) - (birthYear * 12 + Number(String(p.birthDate).slice(5, 7)))) / 12 : null;
    // Social Security on Income counts as claimed only while it is being paid: going, not a one-off, not ended, not starting
    // later (review 2026-11-02: a 2030 start date or an ended survivor benefit read as "already gets it")
    const paidLine = (plan.income ?? []).find((x) => x.type === "social" && x.personId === p.id && x.period !== "once" && Number(x.amount) > 0 && !(x.endDate && today && String(x.endDate) < today) && !(x.startDate && today && String(x.startDate) > today)) ?? null;
    const claimed = plan.guide?.setup?.ss?.[p.id] === "getting" || !!paidLine;
    // the claim age on file; with none saved, the full retirement age, or 70 for someone 70 or over who has not claimed (the
    // only age still open: waiting adds nothing after 70, review 2026-11-02, round 5). A saved age is kept as it is, as
    // under 70, and once passed it is flagged (`pastClaimAge`), so the page asks rather than silently re-valuing it
    const over70 = !claimed && exact !== null && exact >= 70 - 1 / 24;
    const onFile = Number(s.claimAge) || (over70 ? 70 : fra ? fra.asYears : 67);
    // a claim age Get started set to the age a retired person was when their blank figure was guessed (overview/setup
    // `guide.setup.ssClaimWrote`, fix round 2 on the Social Security lane, ssg-B-2) is the plan's own claim from then: never
    // asked about as an age that has passed (a 63-year-old was told "claiming at 63, which has passed" at 63 and 8 months)
    const claimOurs = plan.guide?.setup?.ssClaimWrote?.[p.id] !== undefined && Number(s.claimAge) === Number(plan.guide.setup.ssClaimWrote[p.id]);
    // the month it started: birth month + the claim age; only a month already gone is said ("since 2016"). Someone who gets
    // it before the claim age on file is getting it now, not from that age
    const claimMonth = birthYear && p.birthDate ? birthYear * 12 + (Number(String(p.birthDate).slice(5, 7)) - 1) + Math.round(onFile * 12) : null;
    const todayMonth = today ? Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7)) - 1 : null;
    const hasRecord = !!birthYear && Array.isArray(s.record) && s.record.length > 0;
    const source = hasRecord ? "record" : birthYear && Number(s.monthlyAtFRA) > 0 ? "typed" : "none";
    const retireYear = birthYear ? birthYear + (Number(p.retirementAge) || Number(plan.assumptions?.retirementAge) || 65) - 1 : null;
    const estimateAt = (age) => estimateBenefit(s.record, { birthYear, claimAge: age, futureEarnings: s.futureEarnings ?? "same", stopYear: Math.min(retireYear, birthYear + Math.floor(age) - 1), today });
    // the full-age amount always comes from its source: the record's primary insurance amount, or the statement's figure
    // (review 2026-11-02, round 5, second pass: it was worked back from the Income line, which turned a disability
    // benefit paid at the full figure past 62 into a reduced one and moved the survivor and spouse's figures)
    let estimate = hasRecord ? estimateAt(onFile) : null;
    const fullAge = source === "record" ? (estimate.eligible ? estimate.pia : null) : source === "typed" ? Number(s.monthlyAtFRA) : null;
    // what arrives, for anyone already paid by a Social Security line on Income: that line, for life (recheck 2026-11-05:
    // it counted only while paid before the claim age on file, so once that age passed the page and the projection switched
    // to the claim age's figure, $2,100 "since 67" for a $1,950 line). Only a line being paid now counts (`paidLine` above)
    const paidMonthly = paidLine && source !== "none" ? perYear(paidLine.amount, paidLine.period) / 12 : null;
    // paid clearly less than the full-age amount (more than 0.5% less): a reduced benefit, one claimed before full age
    const paidReduced = paidMonthly !== null && fullAge !== null && paidMonthly < fullAge * (1 - EARLY_TOLERANCE);
    // setup's "I get it now" before 62 (a disability or survivor benefit) marks the entry `paidUnreduced`: paid since before
    // any claim age, so it is paid "now", never "since" the claim age on file (review 2026-11-02, round 5, third pass).
    // Started before the claim age on file too: a claim month still to come, or (recheck 2026-11-05) a reduced line with a
    // claim age on file at or past full retirement age, which cannot have been claimed at that age, so it started earlier,
    // when is not known: "now", not "since 67", and still valued as an early claim once the age on file has gone by
    const marked = claimed && !!s.paidUnreduced && !!fra;
    const startedEarly = claimed && (marked || (claimMonth !== null && todayMonth !== null && claimMonth > todayMonth) || (paidReduced && !!fra && Math.round(onFile * 12) >= Math.round(fra.asYears * 12)));
    // a benefit already paid before the claim age on file is never valued with delayed credits: that claim age (later than
    // today, perhaps past full retirement age) is not used for it (third pass: a saved 70 counted $2,976 a month from 64
    // for someone who said "I already get it"). It is unreduced, the full-age amount, only when setup marked it
    // (`paidUnreduced`), when it is paid before 62 (only a disability or survivor benefit can be), or when the Income line
    // pays about the full-age amount (not more than 0.5% less: one month early already takes 0.56% off). Otherwise it is a
    // reduced early claim, valued as claimed at today's age (to the month), or at full retirement age once past it, from today
    const unreduced = startedEarly && (marked || (exact !== null && exact < 62) || (paidMonthly !== null && fullAge !== null && paidMonthly >= fullAge * (1 - EARLY_TOLERANCE)));
    const claimAge = !startedEarly || !fra ? onFile : unreduced || exact === null ? fra.asYears : Math.min(fra.asYears, Math.round(exact * 12) / 12);
    const reducedEarly = startedEarly && !unreduced && Math.round(claimAge * 12) < Math.round(fra.asYears * 12);
    if (hasRecord && claimAge !== onFile) estimate = estimateAt(claimAge);
    let monthly = source === "record" ? (estimate.eligible ? estimate.monthly : 0) : source === "typed" ? floorDime(Number(s.monthlyAtFRA) * claimFactor(birthYear, claimAge)) : 0;
    if (paidMonthly) monthly = paidMonthly;
    const eligible = !!paidMonthly || source === "typed" || (source === "record" && estimate.eligible);
    // a record short of 40 credits that is being paid anyway: the full-age amount that pays what arrives
    const baseAtFra = !eligible ? 0 : source === "record" ? (estimate.eligible ? estimate.pia : paidMonthly / claimFactor(birthYear, claimAge)) : Number(s.monthlyAtFRA);
    const options = birthYear ? [62, 64, fra.asYears, 68, 70].filter((a, i, arr) => arr.indexOf(a) === i).sort((a, b) => a - b).map((a) => ({ claimAge: a, factor: claimFactor(birthYear, a), monthly: floorDime(baseAtFra * claimFactor(birthYear, a)) })) : [];
    const spousalAtSameAge = birthYear ? floorDime(baseAtFra * spousalFactor(birthYear, claimAge)) : 0;
    // the widow(er)'s floor applies to a benefit claimed early: valued before full age, or (not marked as a disability
    // benefit) paid clearly less than the full-age amount (recheck 2026-11-05: valued at full age once that age passed,
    // the floor went and the figure dropped, $1,732.50 to $1,500 for a $1,500 early claim on a $2,100 full-age amount)
    const survivor = birthYear ? survivorAmount(baseAtFra, monthly, Math.round(claimAge * 12) < Math.round(fra.asYears * 12) || (paidReduced && !marked)) : 0;
    const choose = !claimed && exact !== null && exact > 62 ? (() => {
      const now = Math.min(70, Math.ceil(exact * 12) / 12);
      const ages = [now, ...[63, 64, 65, 66, 67, 68, 69].filter((a) => a > now + 1 / 24), ...(fra && fra.asYears > now + 1 / 24 && !Number.isInteger(fra.asYears) ? [fra.asYears] : []), ...(now < 70 ? [70] : [])];
      return [...new Set(ages)].sort((a, b) => a - b).map((a) => ({ claimAge: a, factor: claimFactor(birthYear, a), monthly: floorDime(baseAtFra * claimFactor(birthYear, a)) }));
    })() : null;
    // claiming now against waiting to 70, in today's dollars (both rise with inflation alike): waiting pays back at the age
    // t where the sums are equal, nowMonthly x (t - now) = at70 x (t - 70)
    const wait = choose && choose.length > 1 && eligible ? (() => {
      const first = choose[0], last = choose[choose.length - 1];
      if (last.monthly <= first.monthly) return null;
      const breakEven = (last.monthly * last.claimAge - first.monthly * first.claimAge) / (last.monthly - first.monthly);
      const at70 = `${birthYear + 70}-${String(p.birthDate).slice(5, 7)}`;
      return { nowAge: first.claimAge, nowMonthly: first.monthly, at70Monthly: last.monthly, at70, breakEven: Math.round(breakEven * 10) / 10 };
    })() : null;
    return { id: p.id, name: p.name, birthYear, birthMonth: p.birthDate ? Number(String(p.birthDate).slice(5, 7)) : null, age: birthYear && year ? year - birthYear : null, ageNow: exact, fra: fra ? { years: fra.years, months: fra.months } : null, claimAge, claimAgeOnFile: onFile, source, estimate, pia: baseAtFra, monthly, yearly: monthly * 12,
      // the age (whole years) the projection counts it from: today's for a benefit started before the claim age on file
      fromAge: startedEarly && exact !== null ? Math.floor(exact) : Math.floor(claimAge),
      options: choose ?? options, claimed, startedEarly, reducedEarly, unreduced, paidLine: paidLine ? { id: paidLine.id, amount: Number(paidLine.amount) || 0, period: paidLine.period, name: paidLine.name } : null,
      // the amount is our guess (Get started left it blank: the Income line, or with none the full-age amount, in the ledger;
      // fixer round 1, ssg-L-6): the page says so instead of stating it as a fact
      guessed: paidLine ? isGuess(plan, `income[${paidLine.id}].amount`) : (() => { const e = guessAt(plan, `retirement.socialSecurity.${p.id}.monthlyAtFRA`); return !!e && !e.legacy; })(),
      claimedYear: claimed && birthYear && !startedEarly ? birthYear + Math.floor(claimAge) : null,
      // a saved claim age gone by without a claim: only when there are figures to claim with and "won't get it" was not said;
      // from 70 on, a saved 70 is up to date (review 2026-11-02)
      pastClaimAge: !claimed && source !== "none" && plan.guide?.setup?.ss?.[p.id] !== "none" && Number(s.claimAge) > 0 && exact !== null && onFile < Math.min(exact, 70) - 1 / 24 && !claimOurs, wait,
      spousalAtSameAge, survivor, futureEarnings: s.futureEarnings ?? "same", record: s.record ?? [], monthlyAtFRA: s.monthlyAtFRA ?? null };
  });
  // the household's Social Security a year: each one's own, and a spouse's top-up the plan counts (recheck 2026-11-05: the
  // hero's yearly figure left it out while "you get together" had it, and the projection never counted it)
  // a spouse's benefit is paid only to a husband or wife (SSA: married at least a year, or divorced after ten years), not
  // to a partner Get started was told is not a spouse (relation "partner", who also files single)
  const married = !(plan.household?.people ?? []).some((p) => p.role !== "dependent" && p.relation === "partner");
  const pair = couple(people, { married });
  const topUps = pair ? Object.values(pair.spousalCounted).reduce((s, x) => s + x, 0) : 0;
  return { people, couple: pair, householdYearly: people.reduce((s, p) => s + p.yearly, 0) + topUps * 12, hasData: people.some((p) => p.source !== "none") };
}

/**
 * A couple's two records together. Each one's spousal top-up: half the partner's primary insurance amount less their own
 * (at least 0), reduced the SSA way for the age it starts (`spousalEarlyFactor`), to the dime; it starts at the later of
 * their own claim age (as valued) and their age when the partner's benefit starts (a partner already paid adds no wait),
 * never before 62 (recheck 2026-11-05: it was reduced as 50% less the percentage points, 15% of the partner's amount at
 * 62 where SSA pays 32.5%, and from their own claim age alone). And what the one who outlives the other keeps: the larger
 * of their own benefit and the survivor amount on the partner's record. `survivorYearly` is the larger of the two
 * outcomes: the household's Social Security after the first death, at best.
 * -> { spousal: { [id]: monthly top-up }, spousalCounted: { [id]: the part the plan adds on top of what the person gets:
 *   the top-up when the person has a figure of their own (with none, their own amount and so the top-up are not known)
 *   and it is not already in the Income line that pays them (SSA pays it with their own once the partner has claimed),
 *   else 0 }, spousalFromAge: { [id]: the age (whole years) the projection counts it from: the later of the two people's
 *   own start years, never before 62 }, spousalStartAge: { [id]: the age, with months, it starts at and is reduced for (the
 *   later of their own claim age and their age at the partner's claim, never before 62; the Timeline's date) },
 *   survivorMonthly, bothMonthly (both own benefits and the counted top-ups),
 *   survivorYearly }
 */
export function couple(people, { married = true } = {}) {
  const adults = people.filter((p) => p.birthYear);
  if (adults.length < 2 || adults.every((p) => p.source === "none")) return null;
  const [a, b] = adults;
  const born = (p) => p.birthYear * 12 + (p.birthMonth || 7) - 1;
  const startAge = (me, other) => Math.max(62, me.claimAge, other.claimed ? 0 : (born(other) + Math.round(other.claimAge * 12) - born(me)) / 12);
  const topUp = (me, other) => floorDime(Math.max(0, other.pia / 2 - me.pia) * spousalEarlyFactor(me.birthYear, startAge(me, other)));
  const spousal = married ? { [a.id]: topUp(a, b), [b.id]: topUp(b, a) } : { [a.id]: 0, [b.id]: 0 };
  const counts = (me, other) => me.source !== "none" && !(me.paidLine && other.claimed);
  const spousalCounted = { [a.id]: counts(a, b) ? spousal[a.id] : 0, [b.id]: counts(b, a) ? spousal[b.id] : 0 };
  const fromAge = (me, other) => Math.max(62, me.fromAge, other.birthYear + other.fromAge - me.birthYear);
  const spousalFromAge = { [a.id]: fromAge(a, b), [b.id]: fromAge(b, a) };
  // the age (years, months as a fraction) the top-up starts at, as it is reduced for: the Timeline dates its start by it
  const spousalStartAge = { [a.id]: startAge(a, b), [b.id]: startAge(b, a) };
  // the spousal top-up stops when the partner dies; the survivor amount on their record takes its place when it is larger
  const survivorMonthly = { [a.id]: Math.max(a.monthly, b.survivor), [b.id]: Math.max(b.monthly, a.survivor) };
  const bothMonthly = a.monthly + b.monthly + spousalCounted[a.id] + spousalCounted[b.id];
  return { spousal, spousalCounted, spousalFromAge, spousalStartAge, survivorMonthly, bothMonthly, survivorYearly: Math.max(survivorMonthly[a.id], survivorMonthly[b.id]) * 12 };
}

/** This year, from a person of compute's people (their birth year and age this year), or null without today. */
const yearOf = (p) => (p.age !== null && p.age !== undefined ? p.birthYear + p.age : null);
/**
 * The page's sentence on a spouse's top-up for `person` on `partner`'s record (`d`: compute's result, `money` formats an
 * amount), "" when there is none (recheck 2026-11-05): counted ("also gets about $X a month more ... The plan counts
 * it."), already in the Income line that pays them, or what they could get while it is not counted (no figure of their
 * own, or `none`: they said they won't get Social Security).
 */
export function spousalWords(person, partner, d, money, { none = false } = {}) {
  const c = d?.couple;
  if (!c || !partner || !(c.spousal[person.id] > 0.5)) return "";
  // the unnamed first adult ("Me") reads "you", "your" (review 2026-11-06, round 7)
  const who = nameIn(person.name), whose = nameOf(person.name), on = nameOf(partner.name);
  if (person.paidLine && partner.claimed) return `Any spouse's benefit ${who} ${verbFor(person.name, "gets", "get")} on ${on} record is paid with ${whose} own, so the ${money(person.paidLine.period === "monthly" ? person.paidLine.amount : person.monthly)} a month on the Income page already holds it.`;
  if (c.spousalCounted[person.id] > 0.5) {
    const from = person.birthYear + c.spousalFromAge[person.id], now = yearOf(person);
    return `On ${on} record, ${who} also ${verbFor(person.name, "gets", "get")} about ${money(c.spousalCounted[person.id])} a month more (a spouse's benefit)${now !== null && from > now ? ` from ${from}, once both have claimed` : ""}. The plan counts it.`;
  }
  return `On ${on} record, ${who} could get up to about ${money(c.spousal[person.id])} a month (a spouse's benefit) once both have claimed. ${none ? `The plan leaves it out, as ${who} won't get Social Security.` : `The plan does not count it until ${whose} own figure is added below.`}`;
}
/** The hero's word on a top-up inside its yearly figure (householdYearly counts it), or "" (recheck 2026-11-05). */
export function heroTopUpWords(d, money) {
  const c = d?.couple;
  const p = c ? d.people.find((x) => c.spousalCounted[x.id] > 0.5) : null;
  if (!p) return "";
  const w = d.people.find((x) => x.id !== p.id && x.birthYear);
  const from = p.birthYear + c.spousalFromAge[p.id], now = yearOf(p);
  return `The ${money(d.householdYearly)} a year includes about ${money(c.spousalCounted[p.id])} a month ${nameIn(p.name)} ${verbFor(p.name, "gets", "get")} on ${nameOf(w.name)} record (a spouse's benefit)${now !== null && from > now ? ` from ${from}` : ""}.`;
}

/** "64 and 6 months", "67": an age in years and months, as the page says it. */
export const ageWords = (a) => { const y = Math.floor(a + 1e-9), m = Math.round((a - y) * 12); return m ? `${y} and ${m} month${m === 1 ? "" : "s"}` : String(y); };
/**
 * The page's sentence on what `person` keeps if `partner` dies first (couple's survivorMonthly[person.id] is `keeps`), with
 * `money` formatting an amount. When the widow(er)'s benefit is more than the partner gets (they claimed early, and it is at
 * least 82.5% of their full-age amount), it says so and why (review 2026-11-02, round 5, third pass: "$1,733 ... Ruth's
 * benefit" beside the $1,500 Ruth gets read as a mistake).
 */
export function survivorWords(person, partner, keeps, money) {
  // the unnamed first adult ("Me") reads "you", "your" (review 2026-11-06, round 7): "If you die first, your spouse keeps ..."
  const dies = `If ${nameIn(partner.name)} ${verbFor(partner.name, "dies", "die")} first`, who = nameIn(person.name), theirs = isYou(person.name) ? "your" : "their";
  if (!(keeps > person.monthly + 0.5)) return `${dies}, ${who} ${verbFor(person.name, "keeps", "keep")} ${theirs} own ${money(person.monthly)} a month, and ${nameOf(partner.name)} ${money(partner.monthly)} stops.`;
  const own = person.monthly > 0.5 ? `${nameOf(person.name)} own ${money(person.monthly)}` : `none of ${theirs} own`;
  if (!(keeps > partner.monthly + 0.5)) return `${dies}, ${who} ${verbFor(person.name, "keeps", "keep")} about ${money(keeps)} a month: ${nameOf(partner.name)} benefit in place of ${own}.`;
  return `${dies}, ${who} would get a widow's or widower's benefit on ${nameOf(partner.name)} record: about ${money(keeps)} a month in place of ${own}. `
    + `That is more than the ${money(partner.monthly)} ${nameIn(partner.name)} ${partner.claimed ? `${verbFor(partner.name, "gets", "get")} now` : `would get at ${ageWords(partner.claimAge)}`}, because it is worked out from ${nameOf(partner.name)} full-age amount.`;
}

/**
 * What "Save <name>'s Social Security" stores, decided here so each choice is tested (review 2026-11-02, round 5).
 * saveFigures(person (one of compute's people), saved (plan.retirement.socialSecurity[id], or {}), form: { claimAge,
 *   record (parsed from the box), typed (the amount box: a number, or null when empty), futureEarnings }) -> {
 *   entry (the next saved entry: only what changed is replaced, the rest kept as it was), changed,
 *   line: null | { id, amount (a month) } (the Social Security line on Income that pays it, set to this amount),
 *   addLine: null | amount (paid before the claim age on file and no Income line pays it: setup's own line is added),
 *   recordRemoved (a corrected amount set the saved earnings record aside, so the amount counts),
 *   recordPasted (a corrected amount set aside a record pasted in this same Save, which is not kept)
 * }
 * Not claimed: the claim age, record, statement figure and future earnings as typed. Already paid: the claim age on file
 * is kept, and an amount equal to the one shown changes nothing. A different amount goes on the Income line that pays
 * it. For someone paid before the claim age on file, a line is added when there is none, and the full-age amount stays
 * (it is only worked out from what arrives when there was no figure at all), unless the benefit is paid unreduced
 * (`unreduced`): a typed full-age amount then becomes what arrives (recheck 2026-11-05). For someone paid since that age, it also
 * becomes the full-age amount that pays it at that age, and an earnings record (saved, or pasted in the same Save) is set
 * aside so the amount counts.
 */
export function saveFigures(person, saved = {}, form = {}) {
  const s = saved ?? {};
  const num = (x) => (Number(x) > 0 ? Number(x) : null);
  const rec = (r) => JSON.stringify((r ?? []).map((x) => [Number(x.year), Number(x.earnings)]));
  const same = { claimAge: (a, b) => num(a) === num(b) || (num(a) !== null && num(b) !== null && Math.abs(a - b) < 1e-9), record: (a, b) => rec(a) === rec(b), monthlyAtFRA: (a, b) => num(a) === num(b), futureEarnings: (a, b) => (a ?? "same") === (b ?? "same") };
  const entry = { ...s };
  const put = (k, v) => { if (!same[k](s[k], v)) entry[k] = v; };
  const typed = num(form.typed);
  let line = null, addLine = null, recordRemoved = false, recordPasted = false;
  put("record", form.record ?? []);
  put("futureEarnings", form.futureEarnings ?? s.futureEarnings ?? "same");
  if (!person.claimed) {
    put("claimAge", Number(form.claimAge));
    put("monthlyAtFRA", typed);
  } else if (typed === null) {
    // the box emptied: the figure is taken off, as before
    put("monthlyAtFRA", null);
  } else if (Math.abs(typed - (Number(person.monthly) || 0)) >= 0.5) {
    if (person.startedEarly) {
      // what arrives now is the Income line's; the full-age amount and the claim age on file stay as they are (an
      // unreduced benefit's full-age amount is what arrives; a reduced one's is worked back from today's age)
      if (person.paidLine) line = { id: person.paidLine.id, amount: typed }; else addLine = typed;
      if (person.source === "none" && person.birthYear) put("monthlyAtFRA", person.reducedEarly ? fraFromMonthly(person.birthYear, person.claimAge, typed) : typed);
      // paid unreduced (a disability benefit, marked or read so): what arrives is the full-age amount, as Get started takes
      // a new amount (recheck 2026-11-05: the statement's figure stayed, so a yearly rise left the spouse's top-up behind)
      else if (person.unreduced && person.source === "typed") put("monthlyAtFRA", typed);
    } else {
      put("monthlyAtFRA", person.birthYear ? fraFromMonthly(person.birthYear, person.claimAge, typed) : typed);
      // the amount typed wins over an earnings record, the one saved or one pasted in this same Save (review 2026-11-02,
      // round 5, third pass: a record pasted with a new amount decided, and Income said the amount): it is set aside
      if ((entry.record ?? []).length) {
        if ((s.record ?? []).length) recordRemoved = true; else recordPasted = true;
        entry.record = [];
      }
      if (person.paidLine) line = { id: person.paidLine.id, amount: typed };
    }
  }
  const changed = !!line || addLine !== null || Object.keys({ ...s, ...entry }).some((k) => !(same[k] ?? ((a, b) => a === b))(s[k], entry[k]));
  // a figure was on file and this Save leaves neither a record nor an amount (the boxes emptied): said as removed, never "saved"
  // (stress test 2026-11-11, R-A3); a line on the Income page that pays it still counts, so that is not "none"
  const hasFigure = (e) => (e?.record ?? []).length > 0 || num(e?.monthlyAtFRA) !== null;
  const removed = changed && hasFigure(s) && !hasFigure(entry) && !line && addLine === null && !person.paidLine;
  return { entry, changed, line, addLine, recordRemoved, recordPasted, removed };
}

/** The full-retirement-age amount that pays `monthly` at `claimAge` (the box "What <name> gets a month now" stores this), to the dime. */
export function fraFromMonthly(birthYear, claimAge, monthly) {
  const f = claimFactor(birthYear, claimAge);
  return f > 0 ? Math.round((Number(monthly) / f) * 10) / 10 : Number(monthly);
}

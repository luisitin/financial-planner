// modules/retirement/social-security/cases.js -- PURE. Three things Social Security pays or holds back that the page's own
// sum leaves out (gap design #27): a divorced spouse's benefit, money held back from someone who works while collecting
// (the "earnings test"), and a child's benefit on a parent's record. Each is worked out from what the person typed under
// "More details (optional)" (the children from People), said in one written sentence per case, and shown on the Social
// Security page only: compute() and the projection do not read these fields (README, "Divorced, still working, children").
// A file of its own because insurance/life-needs/compute.js (the earnings limits and the family maximum) imports this
// page's compute.js: importing it back from there would be a circle.
import { fullRetirementAge, spousalEarlyFactor, claimFactor, floorDime } from "./compute.js";
import { COLA } from "./data/ssa.js";
import { perYear } from "../../../core/math/periods.js";
import { familyMaximum, earningsTestExempt, earningsTestHigherExempt } from "../../insurance/life-needs/compute.js";
import { nameIn, NameIn, nameOf, NameOf, verbFor, isYou } from "../../../core/words.js";

/** The fields this design adds to plan.retirement.socialSecurity[personId], all optional (docs/DATA_MODEL.md). */
export const CASE_FIELDS = ["exPia", "exMarriedYears", "exBirthYear", "exDivorcedOn", "workingEarnings"];
/** A marriage must have lasted this long before the divorce; the ex and the person must both be this old; this long divorced when the ex has not started. */
export const MARRIED_YEARS_NEEDED = 10, SPOUSE_AGE_NEEDED = 62, DIVORCED_YEARS_NEEDED = 2;
/** A child's share of the parent's full-age amount while the parent is alive, and the age it stops at. */
export const CHILD_OF_RETIRED_SHARE = 0.5, CHILD_UNTIL = 18;
/** The hint that an earlier start would add a child's benefit is given only when the child would get it this many months or more. */
export const EARLY_HINT_MONTHS = 12;
/**
 * About twice the largest monthly Social Security payment (someone with the maximum taxed pay every year, claiming at 70:
 * ssa.gov "Workers with maximum-taxable earnings"). A monthly figure over it is a slip of extra digits, not a benefit: the
 * Save box refuses it, and a stored one (an import, a file edited by hand) is never worked from or shown as money.
 */
export const SS_MONTHLY_CEILING = 10000;

const pos = (x) => (Number(x) > 0 ? Number(x) : null);
/** A month as one number (year x 12 + month - 1). */
const monthOf = (iso) => Number(String(iso).slice(0, 4)) * 12 + Number(String(iso).slice(5, 7)) - 1;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthWords = (m) => `${MONTHS[((m % 12) + 12) % 12]} ${Math.floor(m / 12)}`;
const born = (p) => p.birthYear * 12 + (p.birthMonth || 7) - 1;
/** The month a person's own benefit starts: now for someone already paid, else the birth month plus the claim age, never before today. */
/**
 * ownOf(person) -> { monthly, pia }: what the person gets a month of their own and their full-age amount, as the page has
 * them. Someone already paid whose amount is only on the Income page (no figure or record here) has neither in compute():
 * the Income line is what they get, and their full-age amount is taken back from it with the cut or the raise of the age
 * on file (the amount itself when that age is their full retirement age, which is the page's default).
 */
export function ownOf(person) {
  const monthly = Number(person?.monthly) || 0, pia = Number(person?.pia) || 0;
  if (monthly > 0 || pia > 0 || !person?.claimed || !person?.paidLine) return { monthly, pia };
  const paid = perYear(Number(person.paidLine.amount) || 0, person.paidLine.period) / 12;
  if (!(paid > 0)) return { monthly: 0, pia: 0 };
  const f = person.birthYear && Number.isFinite(person.claimAge) ? claimFactor(person.birthYear, person.claimAge) : 1;
  return { monthly: paid, pia: f > 0 ? floorDime(paid / f) : paid };
}
/** Married now: a husband or wife in People (a partner not marked as an unmarried partner, `relation: "partner"`). */
export function marriedNow(person, plan) {
  const people = plan?.household?.people ?? [];
  const me = people.find((x) => x.id === person?.id);
  return !!me && me.role !== "dependent" && people.some((x) => x.role === "partner" && x.relation !== "partner");
}
const startMonth = (p, today) => {
  const now = today ? monthOf(today) : null;
  if (p.claimed && now !== null) return now;
  const at = born(p) + Math.round(p.claimAge * 12);
  return now === null ? at : Math.max(at, now);
};

/**
 * saveCases(saved, form) -> { entry, changed }: the saved entry with the five optional fields set from the form. A box left
 * empty (null, "", 0) takes its field off, so an entry nobody filled in stays exactly as it was. Nothing else is touched.
 * form: { exPia, exMarriedYears, exBirthYear, workingEarnings (numbers or null), exDivorcedOn ("YYYY-MM-DD" or "") }.
 */
export function saveCases(saved = {}, form = {}) {
  const entry = { ...(saved ?? {}) };
  let changed = false;
  for (const k of CASE_FIELDS) {
    const v = k === "exDivorcedOn" ? (/^\d{4}-\d{2}-\d{2}$/.test(String(form[k] ?? "")) ? String(form[k]) : null) : pos(form[k]);
    const was = entry[k] ?? null;
    if (v === null) { if (k in entry) { delete entry[k]; if (was !== null && was !== "" && was !== 0) changed = true; } } else if (was !== v) { entry[k] = v; changed = true; }
  }
  return { entry, changed };
}

/**
 * earningsTest(person (one of compute()'s people), saved, { today }) -> null (no earnings typed, or no birth date) | {
 *   kind: "past" (the benefit starts at or after full retirement age, or they are paid and past it: nothing is ever held
 *     back, whatever the figure; `claimed`: already paid; `late`: it starts after, not at, full retirement age) |
 *     "nofigure" (no benefit of their own on the page or on Income) | "under" (the whole year is before full retirement age) | "reaching" (the year they reach it),
 *   year (the calendar year looked at: the one the benefit starts in; this year for someone already paid),
 *   earnings (a year, as typed), counted (the part the test looks at: all of it, or in the year of reaching full retirement
 *     age the months before that month, earnings taken as even through the year), exempt (that year's limit),
 *   withheld (dollars held back that year), all (every check of that year is held back), months (the months a check is due
 *     that year before full retirement age), monthly }.
 * Under full retirement age all year: (earnings - lower limit) / 2. The year of reaching it: (earnings in the months
 * before - higher limit) / 3. Never more than the checks due in those months. The limits are insurance/life-needs's tables
 * (2026 and 2027; a later year holds the newest, the plan being in today's dollars).
 */
export function earningsTest(person, saved, { today = null } = {}) {
  const earnings = pos(saved?.workingEarnings);
  if (earnings === null || !person?.birthYear) return null;
  // what they get: the page's figure, or the Income line of someone already paid (ownOf)
  const monthly = ownOf(person).monthly;
  const fra = born(person) + Math.round(fullRetirementAge(person.birthYear).asYears * 12);
  const start = startMonth(person, today);
  const year = Math.floor(start / 12), jan = year * 12;
  // from full retirement age on nothing is held back: true with or without a figure, so it is said before one is asked for
  if (fra <= start) return { kind: "past", year, earnings, counted: 0, exempt: null, withheld: 0, all: false, months: 0, monthly, claimed: !!person.claimed, late: start > fra };
  if (!(monthly > 0)) return { kind: "nofigure", earnings };
  const whole = fra > jan + 11;
  // someone already paid is taken as paid all this year; a benefit starting this year, from its first month
  const from = person.claimed ? jan : start;
  const months = (whole ? jan + 12 : fra) - from;
  const counted = whole ? earnings : earnings * (fra - jan) / 12;
  const exempt = whole ? earningsTestExempt(year) : earningsTestHigherExempt(year);
  const due = monthly * months;
  const raw = Math.max(0, counted - exempt) / (whole ? 2 : 3);
  const withheld = Math.round(Math.min(raw, due));
  return { kind: whole ? "under" : "reaching", year, earnings, counted, exempt, withheld, all: raw >= due - 0.5 && due > 0, months, monthly };
}
/** The page's sentence for earningsTest()'s result, one written out per case; "" for null. `money` formats an amount. */
export function workingWords(t, person, money) {
  if (!t) return "";
  const who = nameIn(person.name), Who = NameIn(person.name), whose = nameOf(person.name), collects = verbFor(person.name, "collects", "collect"), earns = verbFor(person.name, "earns", "earn"), reaches = verbFor(person.name, "reaches", "reach");
  if (t.kind === "nofigure") return `Working while ${who} ${collects}: add ${whose} own Social Security figure to see how much would be held back.`;
  // from full retirement age on: said as the plain fact about this person, not as a promise about the future
  if (t.kind === "past") return t.claimed
    ? `${Who} ${verbFor(person.name, "is", "are")} past full retirement age, so nothing is held back, however much ${who} ${earns}.`
    : `${Who} ${verbFor(person.name, "starts", "start")} ${t.late ? "after" : "at"} full retirement age, so nothing is held back, however much ${who} ${earns}.`;
  if (t.all) return `Working while ${who} ${collects}: every check of ${t.year} before full retirement age would be held back, about ${money(t.withheld)}; it comes back as a higher check from full retirement age.`;
  if (t.withheld > 0) return `Working while ${who} ${collects}: about ${money(t.withheld)} held back in ${t.year}; it comes back as a higher check from full retirement age.`;
  if (t.kind === "reaching") return `Working while ${who} ${collects}: nothing held back in ${t.year}, the year ${who} ${reaches} full retirement age; the limit for the months before is ${money(t.exempt)}.`;
  return `Working while ${who} ${collects}: nothing held back in ${t.year}; ${money(t.earnings)} a year is under the ${money(t.exempt)} limit.`;
}

/**
 * divorcedSpouse(person, saved, plan, { today }) -> null (nothing typed about an ex) | {
 *   kind: "check" (the stored amount is over SS_MONTHLY_CEILING: not a benefit, nothing is worked from it) |
 *     "needAmount" (years typed, no amount) | "needYears" (an amount, no years) | "short" (married under 10 years) |
 *     "remarried" (a husband or wife in the plan now) | "notMore" (half the ex's full-age amount is not more than their own) |
 *     "exYoung" (the ex is not 62 when the person's own benefit starts: it waits for that year) | "wait" (divorced under two
 *     years at the start: only once the ex has started, or from `waitUntil`) | "ok",
 *   years, half (half the ex's full-age amount), own (their own full-age amount), ownMonthly (what their own pays at the
 *   claim age), extra (the monthly amount on top of their own), total (ownMonthly + extra), startAge, exAt62 (year),
 *   waitUntil (a month number), totalLater ("wait": the total when it starts at `waitUntil` instead, a smaller cut), hasOwn }.
 * extra = max(0, exPia / 2 - own full-age amount) x the share for the age it starts at (spousalEarlyFactor: 25/36 of 1% off
 * for each of the first 36 months before the person's own full retirement age, 5/12 of 1% for each month beyond; nothing
 * added for waiting), to the dime. It starts at the later of the person's own start and the year the ex is 62.
 */
export function divorcedSpouse(person, saved, plan, { today = null } = {}) {
  const exPia = pos(saved?.exPia), years = pos(saved?.exMarriedYears);
  if ((exPia === null && years === null) || !person?.birthYear) return null;
  if (exPia !== null && exPia > SS_MONTHLY_CEILING) return { kind: "check", years };
  if (exPia === null) return { kind: "needAmount", years };
  if (years === null) return { kind: "needYears" };
  if (years < MARRIED_YEARS_NEEDED) return { kind: "short", years };
  // married now: a partner in People who was not marked as an unmarried partner (relation "partner")
  if (marriedNow(person, plan)) return { kind: "remarried", years };
  const { pia: own, monthly: ownMonthly } = ownOf(person), half = exPia / 2;
  const hasOwn = ownMonthly > 0.5 || own > 0.5;
  if (!(half > own + 0.5)) return { kind: "notMore", years, half, own, ownMonthly, extra: 0, total: ownMonthly, hasOwn };
  // their own start: the claim age, or today's age for someone already paid who asks now; never before 62
  const base = Math.max(SPOUSE_AGE_NEEDED, person.claimAge, person.claimed && Number.isFinite(person.ageNow) ? person.ageNow : 0);
  const exBirthYear = pos(saved?.exBirthYear);
  const exAt62 = exBirthYear ? exBirthYear + SPOUSE_AGE_NEEDED : null;
  const startAge = exAt62 !== null ? Math.max(base, exAt62 - person.birthYear) : base;
  const extra = floorDime((half - own) * spousalEarlyFactor(person.birthYear, startAge));
  const out = { years, half, own, ownMonthly, extra, total: ownMonthly + extra, startAge, exAt62, hasOwn };
  if (startAge > base + 1e-9) return { kind: "exYoung", ...out };
  // divorced under two years when it would start: only if the ex has started their own by then
  const start = Math.max(born(person) + Math.round(startAge * 12), today ? monthOf(today) : -Infinity);
  const waitUntil = /^\d{4}-\d{2}/.test(String(saved?.exDivorcedOn ?? "")) ? monthOf(saved.exDivorcedOn) + DIVORCED_YEARS_NEEDED * 12 : null;
  if (waitUntil !== null && start < waitUntil) {
    // the later start is an older age, so the cut is smaller: the "or from" half of the sentence has its own amount
    const later = floorDime((half - own) * spousalEarlyFactor(person.birthYear, (waitUntil - born(person)) / 12));
    return { kind: "wait", ...out, waitUntil, totalLater: ownMonthly + Math.max(extra, later) };
  }
  return { kind: "ok", ...out };
}
/** The page's sentence for divorcedSpouse()'s result, one written out per case; "" for null. */
export function divorcedWords(x, person, money) {
  if (!x) return "";
  const who = nameIn(person.name), whose = nameOf(person.name), Whose = NameOf(person.name), you = isYou(person.name);
  const is = verbFor(person.name, "is", "are");
  if (x.kind === "check") return `Check what ${whose} ex gets a month: the figure saved is more than Social Security pays anyone, so nothing is worked out from it. Type it again below.`;
  if (x.kind === "needAmount") return `To see a divorced spouse's benefit, add what ${whose} ex gets a month at full retirement age; a best guess is fine.`;
  if (x.kind === "needYears") return `To see a divorced spouse's benefit, add the years ${who} ${verbFor(person.name, "was", "were")} married: it takes 10 or more.`;
  if (x.kind === "short") return `No divorced spouse's benefit: the marriage has to have lasted 10 years or more, and ${you ? "yours" : whose} lasted ${x.years}.`;
  if (x.kind === "remarried") return `No divorced spouse's benefit while ${who} ${is} married: it is only for someone who has not married again.`;
  if (x.kind === "notMore") return x.hasOwn
    ? `Nothing extra as a divorced spouse: half of what ${whose} ex gets is ${money(x.half)} a month, not more than ${whose} own full amount of ${money(x.own)}.`
    : `Nothing extra as a divorced spouse: half of what ${whose} ex gets comes to ${money(x.half)} a month.`;
  if (x.kind === "exYoung") return x.hasOwn
    ? `${Whose} ex has to be 62 first, in ${x.exAt62}. From then, as a divorced spouse ${who} could get up to ${money(x.total)} a month, more than ${whose} own ${money(x.ownMonthly)}.`
    : `${Whose} ex has to be 62 first, in ${x.exAt62}. From then, as a divorced spouse ${who} could get up to ${money(x.total)} a month on ${whose} ex's record.`;
  if (x.kind === "wait") {
    // starting later is a smaller cut: the second half names its own amount when it differs by a dollar or more
    const orFrom = Math.round(x.totalLater ?? x.total) > Math.round(x.total) ? `or up to ${money(x.totalLater)} from ${monthWords(x.waitUntil)}` : `or from ${monthWords(x.waitUntil)}`;
    return x.hasOwn
      ? `As a divorced spouse ${who} could get up to ${money(x.total)} a month, more than ${whose} own ${money(x.ownMonthly)}, once ${whose} ex has started theirs, ${orFrom}, two years after the divorce.`
      : `As a divorced spouse ${who} could get up to ${money(x.total)} a month on ${whose} ex's record, once ${whose} ex has started theirs, ${orFrom}, two years after the divorce.`;
  }
  return x.hasOwn
    ? `As a divorced spouse ${who} could get up to ${money(x.total)} a month, more than ${whose} own ${money(x.ownMonthly)}.`
    : `As a divorced spouse ${who} could get up to ${money(x.total)} a month on ${whose} ex's record.`;
}

/**
 * familyMaximumFor(pia (the full-age amount in today's dollars), birthYear, today) -> the most one family can get on this
 * worker's record a month, in today's dollars. Social Security fixes the family maximum with the bend points of the year
 * the worker turns 62 (not the year the benefit starts), on the full-age amount of that year, and then raises it with the
 * same cost-of-living increases as the worker's own amount. So: take the published increases since 62 back out of the
 * amount, run insurance/life-needs's familyMaximum() for the year of 62, and put the increases back. Someone not yet 62
 * has no increases, and a year past the newest table holds the newest (today's dollars).
 */
export function familyMaximumFor(pia, birthYear, today = null) {
  const year62 = birthYear + 62, thisYear = today ? Number(String(today).slice(0, 4)) : null;
  let rises = 1;
  if (thisYear !== null) for (let y = year62; y < thisYear; y++) if (COLA[y] !== undefined) rises *= 1 + COLA[y];
  return floorDime(familyMaximum(pia / rises, year62) * rises);
}
/**
 * childrenOnRecord(person, plan, { today }) -> null (no child in People under 18 at any start this person still has) | {
 *   kind: "nofigure" (no benefit of their own on the page) | "ok" | "early" (not yet claimed, and every child is 18 before
 *     the chosen start, but one is still under 18 for a year or more from the earliest start left: 62, or now),
 *   n (children), each (a month, each child, whole dollars), capped (the family limit cut it below half), familyMax,
 *   room (familyMax - their full-age amount), lastYear (the year the youngest turns 18), until ("early": the month number
 *   the last of them turns 18) }.
 * each = min(half the full-age amount, (family maximum - the full-age amount) / n). The family maximum is
 * familyMaximumFor(): the bend points of the year the person turns 62.
 */
export function childrenOnRecord(person, plan, { today = null } = {}) {
  if (!person?.birthYear) return null;
  const start = startMonth(person, today);
  const all = (plan?.household?.people ?? []).filter((c) => c.role === "dependent" && /^\d{4}-\d{2}/.test(String(c.birthDate ?? "")))
    .map((c) => monthOf(c.birthDate) + CHILD_UNTIL * 12);
  const underAt = (m) => all.filter((until) => until > m && until - CHILD_UNTIL * 12 <= m);
  let kids = underAt(start), kind = "ok";
  if (!kids.length && !person.claimed) {
    // the chosen age is too late for every child: the earliest start left (62, or now) may not be
    const now = today ? monthOf(today) : null, at62 = born(person) + SPOUSE_AGE_NEEDED * 12;
    const first = now === null ? at62 : Math.max(at62, now);
    // ... worth a word only when a child would then be paid for a year or more
    if (first < start) { kids = underAt(first).filter((until) => until - first >= EARLY_HINT_MONTHS); kind = "early"; }
  }
  if (!kids.length) return null;
  const n = kids.length, until = Math.max(...kids), lastYear = Math.floor(until / 12);
  const pia = ownOf(person).pia;
  if (!(pia > 0)) return kind === "early" ? null : { kind: "nofigure", n, lastYear };
  const familyMax = familyMaximumFor(pia, person.birthYear, today);
  const room = Math.max(0, familyMax - pia), half = CHILD_OF_RETIRED_SHARE * pia;
  // the limit cuts a child's half only when it is short by 50 cents or more: less than that is the dimes lost taking the
  // increases out and putting them back (150% of $1,200 comes to $1,799.90), not the limit
  const share = room / n, capped = share < half - 0.5;
  const each = Math.floor((capped ? share : half) + 1e-8);
  return { kind, n, each, capped, familyMax, room, lastYear, ...(kind === "early" ? { until } : {}) };
}
const COUNT = ["", "", "two", "three", "four", "five", "six"];
/** The page's sentence for childrenOnRecord()'s result, one written out per case; "" for null. */
export function childrenWords(x, person, money) {
  if (!x) return "";
  const whose = nameOf(person.name), Whose = NameOf(person.name), many = COUNT[x.n] ?? String(x.n);
  const who = nameIn(person.name);
  // every child is 18 before the age chosen: said, with what an earlier start would add and what it costs
  if (x.kind === "early") return x.each > 0
    ? `Nothing for ${x.n === 1 ? "a child" : "the children"} at the age chosen: ${whose} ${x.n === 1 ? "child" : `${many} children`} will be 18 by then. If ${who} started before ${monthWords(x.until)}, ${x.n === 1 ? "the child" : "each child"} could get up to ${money(x.each)} a month until 18, and ${whose} own check would be smaller for life.`
    : "";
  if (x.kind === "nofigure") return x.n === 1
    ? `${Whose} child could get up to half ${whose} full benefit while under 18. Add ${whose} own Social Security figure to see the amount.`
    : `${Whose} ${many} children could each get up to half ${whose} full benefit while under 18. Add ${whose} own Social Security figure to see the amount.`;
  if (x.n === 1) return x.capped
    ? `${Whose} child could get up to ${money(x.each)} a month while under 18: less than half ${whose} full benefit, because of the limit on what one family can get.`
    : `${Whose} child could get up to ${money(x.each)} a month while under 18: half ${whose} full benefit, on top of ${whose} own.`;
  return x.capped
    ? `${Whose} ${many} children could each get up to ${money(x.each)} a month while under 18: less than half ${whose} full benefit, because of the limit on what one family can get.`
    : `${Whose} ${many} children could each get up to ${money(x.each)} a month while under 18: half ${whose} full benefit, on top of ${whose} own.`;
}

/** What all the children together could get a month on this person's record; 0 when there is no amount to compare. */
const childrenWorth = (x) => (x && x.kind !== "nofigure" ? x.each * x.n : 0);
/**
 * linesFor(person, plan, { today, money, people }) -> [{ id: "divorced" | "working" | "children", text, worth }]: this
 * person's lines, in that order, only the ones that apply. `worth`: the line names money they could claim (a hint worth
 * money, never folded). `people` (compute()'s people): a child is paid on one parent's record, not on both, so with two
 * adults the children's line is said once, for the one whose record gives the children more (the first of two equals).
 */
export function linesFor(person, plan, { today = null, money = (n) => `$${Math.round(n)}`, people = null } = {}) {
  const saved = plan?.retirement?.socialSecurity?.[person.id] ?? {};
  const dv = divorcedSpouse(person, saved, plan, { today }), wk = earningsTest(person, saved, { today });
  let ch = childrenOnRecord(person, plan, { today });
  if (ch && people) {
    const mine = childrenWorth(ch), at = people.findIndex((x) => x.id === person.id);
    people.forEach((other, i) => {
      if (!ch || other.id === person.id) return;
      const theirs = childrenOnRecord(other, plan, { today });
      if (theirs && (childrenWorth(theirs) > mine || (childrenWorth(theirs) === mine && i < at))) ch = null;
    });
  }
  const chText = ch ? childrenWords(ch, person, money) : "";
  return [
    dv ? { id: "divorced", text: divorcedWords(dv, person, money), worth: ["ok", "wait", "exYoung"].includes(dv.kind) } : null,
    wk ? { id: "working", text: workingWords(wk, person, money), worth: false } : null,
    chText ? { id: "children", text: chText, worth: ch.kind !== "nofigure" && ch.each > 0 } : null,
  ].filter(Boolean);
}
/** The line under them: these are for the person to know, and not in the plan's totals (a reason to doubt a total is never folded). */
export const NOT_COUNTED = "The plan's totals do not count these: each has to be applied for, and Social Security decides.";

// modules/taxes/federal/hsa-medicare.js -- PURE. The HSA picture (Contributions page, hsaPicture) with Medicare worked in:
// from the month someone 65 or older who receives Social Security is on Medicare Part A their HSA limit is 0 (IRC 223(b)(7);
// Pub. 969), prorated by month in the year they turn 65. Money over the lowered limit is excess (taxed as pay, 6% a year).
import { hsaPicture } from "../../retirement/contributions/compute.js";
import { medicareFrom } from "../../../core/math/medicare.js";

const ageIn = (p, year) => (/^\d{4}/.test(String(p?.birthDate ?? "")) ? Number(year) - Number(String(p.birthDate).slice(0, 4)) : null);

/**
 * The first of an adult's Social Security items (monthly or yearly, amount over 0) that matters for `year`: its start ("" when always), else null.
 * Part A goes back six months from the month benefits begin (core/math/medicare.js), so a start up to June of the next year counts.
 * A one-time payment (the $255 death payment) is not a benefit, and a dependent's line is not an adult's (as the Social Security page reads them).
 * With no line of their own, Get started's "I get it now" (`guide.setup.ss[id] === "getting"`, saved with no amount) counts as received,
 * as the Social Security page counts it. With no adult's item on the Income page, Social Security typed on the Federal estimate counts as
 * received (the return counts it): by the one adult, or by a 65+ adult when the other is under 62; with two adults and no way to tell whose
 * it is, `unclear` is set (the HSA page asks).
 */
const isBenefit = (x) => x.type === "social" && x.period !== "once" && Number(x.amount) > 0;
const dependentIds = (plan) => new Set((plan.household?.people ?? []).filter((p) => p.role === "dependent").map((p) => p.id));

function socialSecurityStart(plan, person, year, adults) {
  let best = null, anyItem = false, own = false;
  const deps = dependentIds(plan);
  for (const x of plan.income ?? []) {
    if (!isBenefit(x) || (x.personId && deps.has(x.personId))) continue;
    anyItem = true;
    const mine = x.personId ? x.personId === person.id : adults.length === 1;
    if (!mine) continue;
    own = true;
    let s = String(x.startDate ?? "");
    if (/^\d{4}$/.test(s)) s += "-01";
    if (s && s >= `${Number(year) + 1}-07`) continue;
    if (x.endDate && String(x.endDate).slice(0, 4) < String(year)) continue;
    if (best === null || s < best) best = s;
  }
  if (best === null && !own && plan.guide?.setup?.ss?.[person.id] === "getting") return "";
  if (best === null && !anyItem && Number(plan.taxes?.thisYear?.socialSecurity) > 0) {
    if (adults.length === 1) return "";
    const other = adults.find((a) => a !== person && a.id !== person.id);
    const mineAge = ageIn(person, year), otherAge = ageIn(other, year);
    if (mineAge !== null && mineAge >= 65 && otherAge !== null && otherAge < 62) return "";
  }
  return best;
}

/** True when Social Security is typed on the Federal estimate, nothing on the Income page says whose, and an adult 65 or older could be the one. */
export function socialSecurityUnclear(plan, year) {
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  if (adults.length < 2 || !(Number(plan.taxes?.thisYear?.socialSecurity) > 0)) return false;
  const deps = dependentIds(plan);
  if ((plan.income ?? []).some((x) => isBenefit(x) && !(x.personId && deps.has(x.personId)))) return false;
  if (adults.some((a) => socialSecurityStart(plan, a, year, adults) === "")) return false;
  return adults.some((a) => ageIn(a, year) !== null && ageIn(a, year) >= 65);
}

/**
 * Months of `year` a household adult is on Medicare Part A by default: { firstMonth, months, backdatedFrom } (see core/math/medicare.js).
 * `backdatedFrom` is the Social Security start ("YYYY-MM") when it, not the 65th birthday, sets the first month (Part A goes back six
 * months from it), else null: the HSA page says why the month is what it is.
 */
export function adultMedicare(plan, person, year) {
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const ss = person ? socialSecurityStart(plan, person, year, adults) : null;
  const m = medicareFrom(year, { birthDate: person?.birthDate, socialSecurityStart: ss });
  const at65 = ss ? medicareFrom(year, { birthDate: person?.birthDate, socialSecurityStart: "" }) : m;
  return { ...m, backdatedFrom: ss && m.months < at65.months ? String(ss).slice(0, 7) : null };
}

/** hsaPicture(plan, year) with each person's `medicareMonths` and `firstMedicareMonth`, the limits, room, over and excess lowered. */
export function hsaPictureMedicare(plan, year, opts) {
  const pic = hsaPicture(plan, year, opts);
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  for (const p of pic.people) {
    const m = adultMedicare(plan, adults.find((a) => a.id === p.id) ?? null, pic.year);
    p.medicareMonths = p.id === null ? 0 : m.months; p.firstMedicareMonth = p.id === null ? null : m.firstMonth; p.medicareBackdatedFrom = p.id === null ? null : m.backdatedFrom;
  }
  pic.socialSecurityUnclear = socialSecurityUnclear(plan, pic.year);
  if (!pic.people.some((p) => p.eligible && p.medicareMonths > 0)) return pic;
  const base = pic.base, elig = pic.people.filter((p) => p.eligible);
  const f = (p) => (12 - p.medicareMonths) / 12;
  const shared = pic.shared;
  if (!shared) {
    for (const p of elig) {
      if (p.medicareMonths > 0) p.limit = p.limit * f(p);   // 1/12 of the limit for each month before Medicare (Pub. 969)
      p.room = Math.max(0, p.limit - p.used); p.over = Math.max(0, p.used - p.limit); p.excess = p.over;
    }
  } else {
    // Married, both eligible at the start of the year: the family limit is shared (223(b)(5)). The months each is eligible set how
    // much of it each can use (Form 8889 line 6: family x months eligible / 12), the family limit for the months either is eligible
    // is the most the two can use together, and each one's catch-up is $1,000 x months eligible / 12 (line 7), only into their own HSA.
    const [x, y] = elig, other = (p) => (p === x ? y : x);
    const cu = (p) => p.catchUp * f(p), cap = (p) => base * f(p), need = (p) => Math.max(0, p.used - cu(p));
    const joint = base * Math.max(f(x), f(y));
    for (const p of elig) {
      p.limit = cu(p) + Math.min(cap(p), joint - Math.min(need(other(p)), cap(other(p))));
      p.room = Math.max(0, p.limit - p.used); p.over = Math.max(0, p.used - p.limit);
    }
    // money beyond a person's own part of the family limit is excess; the two parts together beyond the joint limit are divided
    // as near equal halves as each one's money allows (223(b)(5)(B)(ii)), the rest of the excess falling on whoever has more in
    const own = (p) => Math.min(need(p), cap(p));
    const lo = Math.max(0, joint - own(y)), hi = Math.min(own(x), joint);
    let shareX = own(x), shareY = own(y);
    if (own(x) + own(y) > joint && lo <= hi) { shareX = Math.min(Math.max(joint / 2, lo), hi); shareY = joint - shareX; }
    x.excess = Math.max(0, need(x) - shareX); y.excess = Math.max(0, need(y) - shareY);
  }
  const h = pic.household;
  if (shared) {
    const least = Math.min(...elig.map((p) => p.medicareMonths));
    h.limit = base * (12 - least) / 12 + elig.reduce((s, p) => s + p.catchUp * f(p), 0);
  } else h.limit = elig.reduce((s, p) => s + p.limit, 0);
  h.catchUp = elig.reduce((s, p) => s + p.catchUp * f(p), 0);
  h.room = Math.max(0, h.limit - h.used); h.over = Math.max(0, h.used - h.limit);
  h.excess = pic.people.reduce((s, p) => s + p.excess, 0);
  return pic;
}

// modules/retirement/contributions/compute.js -- PURE. What goes into retirement accounts each
// year, per person and per account, with the employer match, against this year's IRS limits.
// Limits live in data/limits.js with the year they apply to; check them every January. Every page
// reads them through limitsFor(year), and the HSA position through hsaPicture(plan, year).
import { perYear, periodLabel } from "../../../core/math/periods.js";
import { ACCOUNT_TYPES } from "../../balance/net-worth/compute.js";
import { LIMITS } from "./data/limits.js";

const LIMIT_KIND = { "401k": "401k", ira: "ira", roth: "ira", hsa: "hsa" };   // Roth and traditional IRA share one limit; Roth 401(k) counts with the 401(k)
const TABLE_YEARS = Object.keys(LIMITS).map(Number).sort((a, b) => a - b);
const KIND_NAMES = [...new Set(TABLE_YEARS.flatMap((y) => Object.keys(LIMITS[y].kinds ?? {})))];

/**
 * Which yearly limit a contribution counts against. The Roth account type covers a Roth IRA and a Roth 401(k)/403(b): it is
 * a Roth 401(k) (the employee's limit, shared with pre-tax deferrals, IRC 402A(c)(2)) when it has an employer match or its
 * name says 401(k), 403(b), 457 or TSP, and otherwise a Roth IRA (the IRA limit, 408A(c)(2)).
 */
export function limitKind(accountType, accountName = "", match = 0) {
  if (accountType === "roth") return Number(match) > 0 || /\b(?:401\s*\(?k\)?|403\s*\(?b\)?|457|tsp|thrift)/i.test(String(accountName ?? "")) ? "401k" : "ira";
  return LIMIT_KIND[accountType] ?? null;
}

/**
 * limitsFor(year) -> { year, kinds: { "401k", ira, hsa, fsa }, kindYear: { [kind]: the table year it comes from },
 *   rothPhaseOut, rothPhaseOutYear, giftExclusion, giftExclusionYear, fullYear (the newest year with every kind), complete }
 * Each kind comes from the newest table year at or before `year` that has it (a year before the first table: the first
 * year that has it), so a year the IRS has published only in part (2027: the HSA) mixes its own figures with the year
 * before's for the rest. The Roth IRA income range and the gift exclusion come from the newest such year that has them.
 */
export function limitsFor(year) {
  const y = Number(year);
  const pick = (has) => { const ys = TABLE_YEARS.filter((t) => has(LIMITS[t])); return ys.filter((t) => t <= y).at(-1) ?? ys[0] ?? null; };
  const kinds = {}, kindYear = {};
  for (const k of KIND_NAMES) { const ky = pick((T) => T.kinds?.[k]); kinds[k] = LIMITS[ky].kinds[k]; kindYear[k] = ky; }
  const rothPhaseOutYear = pick((T) => T.rothPhaseOut), giftExclusionYear = pick((T) => T.giftExclusion !== undefined && T.giftExclusion !== null);
  const fullYear = pick((T) => KIND_NAMES.every((k) => T.kinds?.[k]));
  return {
    year: y, kinds, kindYear,
    rothPhaseOut: rothPhaseOutYear === null ? null : LIMITS[rothPhaseOutYear].rothPhaseOut, rothPhaseOutYear,
    giftExclusion: giftExclusionYear === null ? null : LIMITS[giftExclusionYear].giftExclusion, giftExclusionYear,
    fullYear, complete: KIND_NAMES.every((k) => kindYear[k] === y) && rothPhaseOutYear === y && giftExclusionYear === y,
  };
}

/**
 * The catch-up a person may add for the age reached in the year (`def` is one kind of limitsFor(year).kinds): the
 * kind's catch-up from its catch-up age (401(k) 50, IRC 414(v)(5)(A); IRA 50, 219(b)(5)(B); HSA 55, 223(b)(3)(A)); for
 * the 401(k) the larger amount for the years a person reaches 60, 61, 62 or 63 replaces it (414(v)(2)(E)(i)). 0 when the
 * age is not known or the kind has none (the health FSA).
 */
export function catchUpFor(def, age) {
  const a = age === null || age === undefined || age === "" ? NaN : Number(age);
  if (!def || !def.catchUpAge || !Number.isFinite(a) || a < def.catchUpAge) return 0;
  const s = def.superCatchUp;
  return s && a >= s.from && a <= s.to ? s.amount : def.catchUp;
}

/** The plan's contribution rows, each with its account, person, limit kind and yearly amounts (the page's `items`). */
function contributionItems(plan) {
  const people = plan.household?.people ?? [];
  const accounts = plan.accounts ?? [];
  return (plan.retirement?.contributions ?? []).map((c) => {
    const acct = accounts.find((a) => a.id === c.accountId);
    const person = people.find((p) => p.id === c.personId);
    const yearly = perYear(c.amount, c.period), matchYearly = Number(c.employerMatch) || 0;
    return { ...c, accountName: acct?.name ?? "account no longer on file", accountType: acct?.type ?? null, limitKind: limitKind(acct?.type, acct?.name, matchYearly), typeLabel: acct ? (ACCOUNT_TYPES[acct.type]?.label ?? acct.type) : "", personName: person?.name ?? "Household", yearly, matchYearly, totalYearly: yearly + matchYearly, periodLabel: periodLabel(c.period) };
  });
}

const COVERAGES = ["none", "self", "family"];
const pos = (v) => Math.max(0, Number(v) || 0);

/**
 * hsaPicture(plan, year, { contributions }) -> the household's HSA cover and money for the year, per adult (IRC 223):
 * {
 *   year, kindYear (the year of the HSA figures), coverage: "none"|"self"|"family", coverageChosen (false: taxes.hsa.coverage
 *   left out or unknown, read as self-only as before), coveredId (self-only: the covered adult), shared (married, family
 *   cover: one family limit for both), base (the self-only or family amount; 0 without cover), catchUpAmount, catchUpAge,
 *   typed: { contribution, employer } (taxes.hsa), rows: { payroll, employer } (the HSA Contributions rows),
 *   people: [{ id, name, role, age, eligible, catchUp, rowsPayroll, rowsEmployer, payroll, employer, used, limit, room, over, excess }],
 *   household: { limit, catchUp, payroll, employer, used, room, over, excess }
 * }
 * `contributions`: the Contributions page's items (or its compute() result); left out, they are read from the plan.
 * Cover (taxes.hsa.coverage): "none" no high-deductible plan, nobody can put money in (223(b)(1), (c)(1)(A)); "self" only
 *   the covered adult (taxes.hsa.coveredId; not chosen, the one adult whose HSA rows hold money, else the adult marked "Me",
 *   else the first adult); "family" every adult.
 * Money: an adult's own HSA rows (amount + employer match: the employer's money counts, 223(b)(4)(B), Pub. 969), and the
 *   HSA page's typed contribution and employer money where they are more than all the rows, on the covered adult (or "Me").
 * Limit: eligible adults get the self-only or family amount + their own catch-up from 55 (223(b)(2), (b)(3)); others 0.
 *   Married with family cover, the two share one family limit (223(b)(5)): each may have their own catch-up + max(0,
 *   family - max(0, the other's money - the other's catch-up)). room = max(0, limit - used), over = max(0, used - limit).
 * Excess: the money that is really over (taxed as pay, 106(d)(1)): `over`, except for spouses sharing the family limit,
 *   who split it as near equal halves as their money allows (223(b)(5)(B)(ii)); it can exceed the household's `over` when
 *   a spouse 55 or over does not use their own catch-up, which cannot go into the other's account.
 * Household: limit = the cover amount + the catch-ups of the eligible adults (0 without cover); used = all the money.
 */
export function hsaPicture(plan, year, { contributions } = {}) {
  const L = limitsFor(year), def = L.kinds.hsa;
  const h = plan.taxes?.hsa ?? {};
  const coverageChosen = COVERAGES.includes(h.coverage);
  const coverage = coverageChosen ? h.coverage : "self";
  const listed = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  // no one on the People page yet: the household is one adult, so a plan that types only the HSA page still works
  const adults = listed.length ? listed : [{ id: null, name: "You", role: "self", birthDate: null }];
  const me = adults.find((p) => p.role === "self") ?? adults[0];
  const accounts = plan.accounts ?? [];
  const all = Array.isArray(contributions) ? contributions : contributions?.items ?? contributionItems(plan);
  const rowsOf = all.filter((i) => (i.limitKind ?? limitKind(i.accountType, i.accountName, i.matchYearly)) === "hsa");
  const rowOwner = (i) => adults.find((p) => p.id !== null && p.id === i.personId) ?? adults.find((p) => p.id !== null && p.id === accounts.find((a) => a.id === i.accountId)?.ownerId) ?? null;
  // self-only cover: the adult chosen on the HSA page; not chosen, the one adult whose HSA rows have money (a plan saved
  // before the choice existed keeps its partner's HSA untaxed), else the adult marked "Me", else the first
  const withMoney = [...new Set(rowsOf.filter((i) => (Number(i.yearly) || 0) + (Number(i.matchYearly) || 0) > 0).map(rowOwner).filter(Boolean))];
  const chosen = adults.find((p) => p.id !== null && p.id === h.coveredId);
  const covered = coverage === "self" ? (chosen ?? (withMoney.length === 1 ? withMoney[0] : me)) : null;
  const holder = covered ?? me;
  const ageOf = (p) => (/^\d{4}/.test(String(p.birthDate ?? "")) ? Number(L.year) - Number(String(p.birthDate).slice(0, 4)) : null);
  const ownerOf = (i) => rowOwner(i) ?? holder;
  const typed = { contribution: pos(h.contribution), employer: pos(h.employer) };
  const amt = (v) => Number(v) || 0;   // the rows as typed (the page's own sums), the HSA page's figures from 0 up
  const rows = { payroll: rowsOf.reduce((s, i) => s + amt(i.yearly), 0), employer: rowsOf.reduce((s, i) => s + amt(i.matchYearly), 0) };
  const extra = { payroll: Math.max(0, typed.contribution - Math.max(0, rows.payroll)), employer: Math.max(0, typed.employer - Math.max(0, rows.employer)) };
  const base = coverage === "family" ? def.family : coverage === "self" ? def.limit : 0;
  const people = adults.map((p) => {
    const mine = rowsOf.filter((i) => ownerOf(i) === p);
    const rowsPayroll = mine.reduce((s, i) => s + amt(i.yearly), 0), rowsEmployer = mine.reduce((s, i) => s + amt(i.matchYearly), 0);
    const payroll = rowsPayroll + (p === holder ? extra.payroll : 0), employer = rowsEmployer + (p === holder ? extra.employer : 0);
    const eligible = coverage === "family" || (coverage === "self" && p === covered);
    const age = ageOf(p);
    return { id: p.id, name: p.name, role: p.role, age, eligible, catchUp: eligible ? catchUpFor(def, age) : 0, rowsPayroll, rowsEmployer, payroll, employer, used: payroll + employer };
  });
  const status = plan.household?.filingStatus;
  const elig = people.filter((p) => p.eligible);
  const shared = coverage === "family" && (status === "married_joint" || status === "married_separate") && elig.length === 2;
  for (const p of people) {
    const q = shared && p.eligible ? elig.find((x) => x !== p) : null;
    p.limit = !p.eligible ? 0 : q ? p.catchUp + Math.max(0, base - Math.max(0, q.used - q.catchUp)) : base + p.catchUp;
    p.room = Math.max(0, p.limit - p.used);
    p.over = Math.max(0, p.used - p.limit);
    p.excess = p.over;
  }
  if (shared) {
    // the division of the family limit that leaves the least money over, as near equal halves as that allows
    const [a, b] = elig, needA = Math.max(0, a.used - a.catchUp), needB = Math.max(0, b.used - b.catchUp);
    const lo = Math.max(0, base - needB), hi = Math.min(needA, base);
    if (lo <= hi) { const shareA = Math.min(Math.max(base / 2, lo), hi); a.excess = Math.max(0, needA - shareA); b.excess = Math.max(0, needB - (base - shareA)); }
    else a.excess = b.excess = 0;
  }
  const sum = (k) => people.reduce((s, p) => s + p[k], 0);
  const catchUp = elig.reduce((s, p) => s + p.catchUp, 0);
  const limit = elig.length ? base + catchUp : 0, used = sum("used");
  return {
    year: L.year, kindYear: L.kindYear.hsa, coverage, coverageChosen, coveredId: covered?.id ?? null, shared, base,
    catchUpAmount: def.catchUp, catchUpAge: def.catchUpAge, typed, rows, people,
    household: { limit, catchUp, payroll: sum("payroll"), employer: sum("employer"), used, room: Math.max(0, limit - used), over: Math.max(0, used - limit), excess: sum("excess") },
  };
}

const HSA_LABEL = { none: "HSA (no high-deductible plan)", self: "HSA (self-only coverage)", family: "HSA (family coverage)" };

/**
 * compute(plan, { today }) -> {
 *   items: [{ ...contribution, accountName, accountType, limitKind, personName, yearly, matchYearly, totalYearly, periodLabel }],
 *   yearly (everyone's own money), matchYearly, totalYearly, byPerson: [{ personId, name, age, yearly, match, limits: [{ kind, label, limit, used, over, catchUp, year }] }],
 *   limitsYear (the newest year with every kind), kindYear, limits (limitsFor(year)), hsa (hsaPicture), warnings: [text], hasData
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const year = today ? Number(String(today).slice(0, 4)) : new Date().getFullYear();
  const L = limitsFor(year);
  const people = plan.household?.people ?? [];
  const items = contributionItems(plan);
  const hsa = hsaPicture(plan, year, { contributions: items });
  const warnings = [];
  const byPerson = people.filter((p) => p.role !== "dependent").map((p) => {
    const mine = items.filter((i) => i.personId === p.id);
    const age = today && p.birthDate ? year - Number(String(p.birthDate).slice(0, 4)) : null;   // the age reached this year is what the catch-up rules use
    const limits = [];
    for (const [kind, def] of Object.entries(L.kinds)) {
      if (kind === "hsa") {
        // the HSA: the household's cover decides who may have one and how a family limit is shared (hsaPicture)
        const hp = hsa.people.find((x) => x.id === p.id);
        if (!hp || !hp.used) continue;
        limits.push({ kind, label: HSA_LABEL[hsa.coverage], limit: hp.limit, used: hp.used, over: hp.over, catchUp: hp.catchUp, year: L.kindYear.hsa });
        if (hp.over > 0) warnings.push(!hp.eligible
          ? `${p.name}: ${Math.round(hp.used).toLocaleString("en-US")} goes into an HSA, but ${hsa.coverage === "none" ? "the HSA page says there is no high-deductible health plan" : "only the person on the self-only high-deductible plan can have one"}. If the cover is different, change it on the HSA page.`
          : `${p.name}: HSA contributions of ${Math.round(hp.used).toLocaleString("en-US")} are over the ${L.kindYear.hsa} limit of ${hp.limit.toLocaleString("en-US")}${hp.catchUp ? " (with catch-up)" : ""}${hsa.shared ? ", the share of the family limit left by the other spouse's money" : ""}.`);
        continue;
      }
      // a 401(k) match has its own, much higher, overall limit
      const used = mine.filter((i) => i.limitKind === kind).reduce((s, i) => s + i.yearly, 0);
      if (!used) continue;
      const catchUp = catchUpFor(def, age), limit = def.limit + catchUp;
      limits.push({ kind, label: def.label, limit, used, over: Math.max(0, used - limit), catchUp, year: L.kindYear[kind] });
      if (used > limit) warnings.push(`${p.name}: ${def.label} contributions of ${Math.round(used).toLocaleString("en-US")} are over the ${L.kindYear[kind]} limit of ${limit.toLocaleString("en-US")}${catchUp ? " (with catch-up)" : ""}.`);
    }
    return { personId: p.id, name: p.name, age, yearly: mine.reduce((s, i) => s + i.yearly, 0), match: mine.reduce((s, i) => s + i.matchYearly, 0), limits };
  });
  for (const i of items) if (!i.accountType) warnings.push(`A contribution points to an account that is no longer on file.`);
  return { items, yearly: items.reduce((s, i) => s + i.yearly, 0), matchYearly: items.reduce((s, i) => s + i.matchYearly, 0), totalYearly: items.reduce((s, i) => s + i.totalYearly, 0), byPerson, limitsYear: L.fullYear, kindYear: L.kindYear, limits: L, hsa, warnings, hasData: items.length > 0 };
}

// modules/retirement/contributions/compute.js -- PURE. What goes into retirement accounts each
// year, per person and per account, with the employer match, against this year's IRS limits.
// Limits live in data/limits.js with the year they apply to; check them every January. Every page
// reads them through limitsFor(year), and the HSA position through hsaPicture(plan, year).
import { perYear, periodLabel } from "../../../core/math/periods.js";
import { ACCOUNT_TYPES } from "../../balance/net-worth/compute.js";
import { LIMITS } from "./data/limits.js";
import { BENEFITS, ROTH_CATCHUP_FROM } from "../../career/benefits/data/benefits.js";
// (a cycle with hsa-medicare.js, which reads hsaPicture from here: both only call each other at run time)
import { hsaPictureMedicare } from "../../taxes/federal/hsa-medicare.js";

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

/**
 * A checking, savings or cash account (the projection's cash bucket: BUCKET_OF[type] === "cash"; the test in module.test.mjs
 * holds the two lists together). A row into one is money that stays in the bank (the answer "It stays in the bank" on Will the
 * money last?, the only way such a row is made): the projection counts it for later, but it is not saving out of pay, so it is in
 * no sum below (review 2026-11-12, M3: the Dashboard said it "goes into retirement" and the month had nothing left for the
 * emergency fund, though the money sits in the very savings account that is the cushion).
 */
export const isBankAccount = (acct) => !!acct && (acct.type === "checking" || acct.type === "savings" || acct.type === "cash");

/** The plan's contribution rows, each with its account, person, limit kind and yearly amounts (the page's `items`); `bank`: a row into a checking or savings account. */
function contributionItems(plan) {
  const people = plan.household?.people ?? [];
  const accounts = plan.accounts ?? [];
  return (plan.retirement?.contributions ?? []).map((c) => {
    const acct = accounts.find((a) => a.id === c.accountId);
    const person = people.find((p) => p.id === c.personId);
    const yearly = perYear(c.amount, c.period), matchYearly = Number(c.employerMatch) || 0;
    return { ...c, accountName: acct?.name ?? "account no longer on file", accountType: acct?.type ?? null, limitKind: limitKind(acct?.type, acct?.name, matchYearly), bank: isBankAccount(acct), typeLabel: acct ? (ACCOUNT_TYPES[acct.type]?.label ?? acct.type) : "", personName: person?.name ?? "Household", yearly, matchYearly, totalYearly: yearly + matchYearly, periodLabel: periodLabel(c.period) };
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

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const HSA_LABEL = { none: "HSA (no high-deductible plan)", self: "HSA (self-only coverage)", family: "HSA (family coverage)" };

/**
 * compute(plan, { today }) -> {
 *   items: [{ ...contribution, accountName, accountType, limitKind, bank, personName, yearly, matchYearly, totalYearly, periodLabel }],
 *   yearly (everyone's own money into retirement and investment accounts), matchYearly, totalYearly, bankYearly (rows into a
 *   checking or savings account: money that stays in the bank, in none of the three sums before it, M3), byPerson: [{ personId, name, age, yearly, match, limits: [{ kind, label, limit, used, over, catchUp, year }] }],
 *   limitsYear (the newest year with every kind), kindYear, limits (limitsFor(year)), hsa (hsaPicture), warnings: [text], hasData
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const year = today ? Number(String(today).slice(0, 4)) : new Date().getFullYear();
  const L = limitsFor(year);
  const people = plan.household?.people ?? [];
  const items = contributionItems(plan);
  // what goes into retirement and investment accounts: every row but the ones into a checking or savings account (M3)
  const saving = items.filter((i) => !i.bank);
  // the Medicare-aware picture, the one the HSA page and the tax return read (follow-up 2026-11-07, HSA R1): someone on Medicare has a limit of 0
  const hsa = hsaPictureMedicare(plan, year, { contributions: items });
  const warnings = [];
  const byPerson = people.filter((p) => p.role !== "dependent").map((p) => {
    const mine = saving.filter((i) => i.personId === p.id);
    const age = today && p.birthDate ? year - Number(String(p.birthDate).slice(0, 4)) : null;   // the age reached this year is what the catch-up rules use
    const limits = [];
    for (const [kind, def] of Object.entries(L.kinds)) {
      if (kind === "hsa") {
        // the HSA: the household's cover decides who may have one and how a family limit is shared (hsaPicture)
        const hp = hsa.people.find((x) => x.id === p.id);
        if (!hp || !hp.used) continue;
        limits.push({ kind, label: HSA_LABEL[hsa.coverage], limit: hp.limit, used: hp.used, over: hp.over, catchUp: hp.catchUp, year: L.kindYear.hsa });
        if (hp.over > 0) warnings.push(hp.eligible && hp.medicareMonths > 0
          ? `${p.name}: ${hp.medicareMonths >= 12 ? "on Medicare all year" : `on Medicare from ${MONTH_NAMES[(hp.firstMedicareMonth ?? 1) - 1]}`}, and once you are on Medicare you cannot add to an HSA. ${Math.round(hp.used).toLocaleString("en-US")} goes in, this year's limit is ${hp.limit.toLocaleString("en-US")}${hp.medicareMonths >= 12 ? "" : " (only the months before Medicare count)"}. Change it on the HSA and FSA page.`
          : !hp.eligible
          ? `${p.name}: ${Math.round(hp.used).toLocaleString("en-US")} goes into an HSA, but ${hsa.coverage === "none" ? "the HSA and FSA page says there is no high-deductible health plan" : "only the person on the self-only high-deductible plan can have one"}. If your coverage is different, change it on the HSA and FSA page.`
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
  return { items, yearly: saving.reduce((s, i) => s + i.yearly, 0), matchYearly: saving.reduce((s, i) => s + i.matchYearly, 0), totalYearly: saving.reduce((s, i) => s + i.totalYearly, 0),
    bankYearly: items.filter((i) => i.bank).reduce((s, i) => s + i.yearly, 0), byPerson, limitsYear: L.fullYear, kindYear: L.kindYear, limits: L, hsa, warnings, hasData: items.length > 0 };
}

// ---- pay the tax later or now, per row at work (owner's request 2026-11-11, spec part C, option C1, L6) -----------------------
// Two rows, never a share on one row (C2 is not built): the row into the 401(k) is "pay the tax later" and keeps the whole match;
// a row into the person's Roth 401(k) (a Roth account whose name says 401(k), so limitKind counts it against the 401(k) limit) is
// "pay the tax now". An IRA is never split: a traditional and a Roth IRA are separate accounts by law (IRC 408, 408A).
const OLD_JOB = /\b(old|former|previous|prior|rollover)\b/i;
const atJob = (acct) => !!acct && !acct.formerJob && !OLD_JOB.test(acct.name ?? "");
/** A pay-the-tax-later account at work: a 401(k) of a job the person still has. */
export const isLaterAccount = (acct) => atJob(acct) && acct.type === "401k";
/** A pay-the-tax-now account at work: a Roth account that counts against the 401(k) limit (its name, or a match on its row). */
export const isNowAccount = (acct, match = 0) => atJob(acct) && acct.type === "roth" && limitKind("roth", acct.name, match) === "401k";
/** The name a Roth 401(k) the split makes is given: "Roth 401(k) at <employer>", or "at work" when the job has no name on file. */
export const rothAccountName = (employer) => `Roth 401(k) at ${String(employer ?? "").trim() || "work"}`;
const r2 = (n) => Math.round(n * 100) / 100;

const NAMES_401K = /\b(?:401\s*\(?k\)?|403\s*\(?b\)?|457|tsp|thrift)/i;
/** The name of the Roth 401(k) the split makes beside one of several jobs' plans: the plan's own name, so the two read as one job. */
export const rothPartName = (laterName) => { const n = String(laterName ?? "").trim(); return !n ? rothAccountName(null) : NAMES_401K.test(n) ? `${n} (Roth part)` : `${n} (Roth 401(k) part)`; };
/**
 * A Roth account that counts against the 401(k) limit only because its row carries a match (its name does not say 401(k)): the
 * name it gets when the split moves that match to the pay-the-tax-later row, so it stays a Roth 401(k) (review 2026-11-12, N2:
 * its money was then counted against the IRA limit and Paycheck lost its Roth 401(k) line). null when the name already says it.
 */
export const rothRenameOf = (acct) => (acct?.type === "roth" && limitKind("roth", acct.name, 0) !== "401k" ? `${String(acct.name ?? "Roth").trim() || "Roth"} (Roth 401(k))` : null);

/**
 * taxPairOf(plan, rowId) -> null (not a row at work: an IRA, a brokerage, a job left; or a row this question cannot place, below) | {
 *   pid, row, later (the pay-the-tax-later row at this job), now (the pay-the-tax-now row at this job), laterAccount, nowAccount
 *   (the rows' accounts; with no row, the account the part would go into, or null: a new one), jobs (how many pay-the-tax-later
 *   accounts at work the person has), choice: "later" | "now" | "some", period (the own money's), laterEach, nowEach (each time,
 *   in `period`), laterYearly, nowYearly, ownYearly, match (a year, both rows)
 * }
 * One job, one pair (review 2026-11-12, B1: with two jobs, editing one job's row took over the Roth 401(k) row of the other and
 * "Pay the tax later" deleted it). A job is a pay-the-tax-later account at work. A Roth 401(k) row belongs to the job its
 * `pairOf` names (the account id the split wrote on it); a Roth 401(k) row with no `pairOf` (typed by hand, or saved before
 * this) belongs to the person's job only when the person has exactly one. The pay-the-tax-later row of a job is the one with the
 * match, else the biggest; another row into the same account is not asked (null), and neither is a Roth 401(k) row tied to no
 * job when the person has several.
 */
export function taxPairOf(plan, rowId) {
  const rows = plan?.retirement?.contributions ?? [], accounts = plan?.accounts ?? [];
  const at = (c) => accounts.find((a) => a.id === c?.accountId) ?? null;
  const r = rows.find((c) => c.id === rowId);
  const acct = at(r);
  const isLater = !!r && isLaterAccount(acct), isNow = !!r && !isLater && isNowAccount(acct, r.employerMatch);
  if (!isLater && !isNow) return null;
  const pid = r.personId || acct.ownerId || null;
  const whose = (c) => (c.personId || at(c)?.ownerId || null) === pid;
  const own = (c) => (c ? perYear(Number(c.amount) || 0, c.period) : 0);
  const bySize = (a, b) => own(b) - own(a);
  // the person's jobs: the pay-the-tax-later accounts at work they own or put money into
  const jobs = accounts.filter((a) => isLaterAccount(a) && ((pid && a.ownerId === pid) || rows.some((c) => c.accountId === a.id && whose(c))));
  const tiedTo = (c) => (c?.pairOf && jobs.some((a) => a.id === c.pairOf) ? c.pairOf : null);
  const nows = rows.filter((c) => whose(c) && isNowAccount(at(c), c.employerMatch));
  const leadIn = (a) => rows.filter((c) => whose(c) && c.accountId === a?.id).sort((x, y) => (Number(y.employerMatch) || 0) - (Number(x.employerMatch) || 0) || bySize(x, y))[0] ?? null;
  let later = null, now = null, laterAccount = null;
  if (isLater) {
    if (leadIn(acct)?.id !== r.id) return null;
    later = r; laterAccount = acct;
    now = nows.filter((c) => tiedTo(c) === acct.id).sort(bySize)[0] ?? (jobs.length === 1 ? nows.filter((c) => !tiedTo(c)).sort(bySize)[0] : null) ?? null;
  } else {
    const t = tiedTo(r);
    if (!t && jobs.length > 1) return null;
    now = r;
    laterAccount = t ? jobs.find((a) => a.id === t) : jobs[0] ?? null;
    later = laterAccount ? leadIn(laterAccount) : null;
  }
  // where a pay-the-tax-now part would go with no row yet: one job, the person's own Roth 401(k) on file that no other job's
  // row uses; several, the one named for this job
  const free = (a) => isNowAccount(a) && a.ownerId === pid && !rows.some((c) => c.accountId === a.id && whose(c) && tiedTo(c) && tiedTo(c) !== laterAccount?.id);
  const nowAccount = now ? at(now) : (jobs.length > 1 ? accounts.find((a) => free(a) && a.name === rothPartName(laterAccount?.name)) : accounts.find(free)) ?? null;
  const laterYearly = own(later), nowYearly = own(now);
  const period = (laterYearly > 0 ? later.period : nowYearly > 0 ? now.period : r.period) ?? "monthly";
  const each = (y) => r2(y / perYear(1, period));
  return {
    pid, row: r, later, now, laterAccount, nowAccount, jobs: jobs.length,
    choice: laterYearly > 0 && nowYearly > 0 ? "some" : nowYearly > 0 ? "now" : "later", period, laterEach: each(laterYearly), nowEach: each(nowYearly),
    laterYearly, nowYearly, ownYearly: laterYearly + nowYearly, match: (Number(later?.employerMatch) || 0) + (Number(now?.employerMatch) || 0),
  };
}

/**
 * applyTaxChoice(draft, rowId, { choice, laterEach, nowEach, period, match, laterPct, nowPct, today, ids: { nowRow, laterRow,
 * nowAccount, laterAccount }, accountName }) -- "When do you pay the tax on it?" answered (spec C1, D-C2):
 *   later: all of the own money on the pay-the-tax-later row, the pay-the-tax-now row taken out;
 *   now:   all of it on the pay-the-tax-now row; the match stays on a $0 pay-the-tax-later row (no such row when there is no match);
 *   some:  `laterEach` on the pay-the-tax-later row with the whole match, `nowEach` on the pay-the-tax-now row.
 * The match is never put on a Roth row (until L9's `matchRoth`). A Roth 401(k) is made when there is none ($0, `asOf` today, the
 * person's, named `accountName`; beside one of several jobs' plans, named for that plan: rothPartName), and a 401(k) "401(k) at
 * work" when a later part has nowhere to go. `period` is the own money's (both rows); `laterPct` / `nowPct` keep "4%" typed as a
 * share of pay beside the dollars (`pctOfPay`). Returns the pair after.
 * Review 2026-11-12: the Roth 401(k) row carries `pairOf`, the id of the pay-the-tax-later account of its job (B1; the account,
 * not the row: "Pay the tax now" with no match takes that row out, and the answer must still be taken back). The row asked about
 * is never the last one taken out: with nothing going in and no match it stays at $0 (N3; "Remove this contribution" is the one
 * way to remove a row). A Roth account that was a Roth 401(k) only by the match on its row is renamed when the match leaves it,
 * so it still counts against the 401(k) limit (N2, rothRenameOf). No row outside the pair is read or written.
 */
export function applyTaxChoice(draft, rowId, opts = {}) {
  const pair = taxPairOf(draft, rowId);
  if (!pair) return null;
  const choice = ["later", "now", "some"].includes(opts.choice) ? opts.choice : pair.choice;
  const period = opts.period ?? pair.period;
  const laterEach = choice === "now" ? 0 : Math.max(0, Number(opts.laterEach) || 0);
  const nowEach = choice === "later" ? 0 : Math.max(0, Number(opts.nowEach) || 0);
  const match = Math.max(0, opts.match === undefined || opts.match === null ? pair.match : Number(opts.match) || 0);
  const ids = opts.ids ?? {};
  draft.accounts = draft.accounts ?? [];
  draft.retirement.contributions = draft.retirement.contributions ?? [];
  const rows = draft.retirement.contributions;
  const pid = pair.pid ?? "";
  const newAccount = (id, name, type) => { const a = { id, name, type, balance: 0, asOf: opts.today ?? null, ownerId: pid, history: [] }; draft.accounts.push(a); return a; };
  const setRow = (row, amount, pct) => { row.amount = r2(amount); row.period = period; if (pct !== undefined && pct !== null) row.pctOfPay = pct; else delete row.pctOfPay; };
  const takeOut = (row) => { const i = rows.indexOf(row); if (i >= 0) rows.splice(i, 1); };
  // nothing going in and no match: the row asked about stays, at $0 (N3)
  const nothing = !(laterEach > 0) && !(nowEach > 0) && !(match > 0);
  const kept = nothing ? rows.find((c) => c.id === rowId) : null;
  // pay the tax later: the own money's later part and the whole match
  let later = pair.later ? rows.find((c) => c.id === pair.later.id) : null;
  if (kept && kept === later) { setRow(later, 0, null); later.employerMatch = 0; }
  else if (laterEach > 0 || match > 0) {
    if (!later) {
      const acct = pair.laterAccount ?? newAccount(ids.laterAccount ?? "later-401k", "401(k) at work", "401k");
      later = { id: ids.laterRow ?? "later-row", accountId: acct.id, personId: pid, amount: 0, period, employerMatch: 0 };
      rows.push(later);
    }
    setRow(later, laterEach, laterEach > 0 ? opts.laterPct : null);
    later.employerMatch = match;
  } else if (later) takeOut(later);
  // pay the tax now: the rest, into the Roth 401(k), never a match on it
  let now = pair.now ? rows.find((c) => c.id === pair.now.id) : null;
  const job = (later ? draft.accounts.find((a) => a.id === later.accountId) : null) ?? pair.laterAccount ?? null;
  if (kept && kept === now) { setRow(now, 0, null); keepRoth401k(draft, now); now.employerMatch = 0; }
  else if (nowEach > 0) {
    if (!now) {
      const acct = pair.nowAccount ?? newAccount(ids.nowAccount ?? "now-roth401k", pair.jobs > 1 ? rothPartName(pair.laterAccount?.name) : opts.accountName ?? rothAccountName(null), "roth");
      now = { id: ids.nowRow ?? "now-row", accountId: acct.id, personId: pid, amount: 0, period, employerMatch: 0 };
      rows.push(now);
    }
    setRow(now, nowEach, opts.nowPct);
    keepRoth401k(draft, now);
    now.employerMatch = 0;
    if (job) now.pairOf = job.id;
  } else if (now) takeOut(now);
  return taxPairOf(draft, [later, now].find((c) => c && rows.includes(c))?.id ?? rowId);
}

/** A Roth row about to lose its match: its account keeps counting as a Roth 401(k), by name (N2). */
function keepRoth401k(draft, row) {
  if (!(Number(row?.employerMatch) > 0)) return;
  const acct = (draft.accounts ?? []).find((a) => a.id === row.accountId);
  const name = rothRenameOf(acct);
  if (name) acct.name = name;
}

/**
 * applyMatchAtWork(draft, rowId, match, { today, ids: { laterRow, laterAccount } }) -- what the employer adds a year, written
 * where it belongs: on the row itself, unless that row is the pay-the-tax-now one (a Roth 401(k)): then on the pay-the-tax-later
 * row of the same job, made at $0 when there is none (D-C2; review 2026-11-12, B5: after "Pay the tax now" the card's match
 * change and "Check the match" put the employer's money on the Roth 401(k) row, a year rosier than it is). The own money on both
 * rows is left exactly as it is. A row that is not at work just gets the figure.
 */
export function applyMatchAtWork(draft, rowId, match, { today = null, ids = {} } = {}) {
  const rows = draft?.retirement?.contributions ?? [];
  const row = rows.find((c) => c.id === rowId);
  if (!row) return;
  const m = Math.max(0, Number(match) || 0);
  const pair = taxPairOf(draft, rowId);
  if (!pair || pair.now?.id !== rowId) { row.employerMatch = m; return; }
  let later = pair.later ? rows.find((c) => c.id === pair.later.id) : null;
  if (!later && m > 0) {
    let acct = pair.laterAccount;
    if (!acct) { acct = { id: ids.laterAccount ?? "later-401k", name: "401(k) at work", type: "401k", balance: 0, asOf: today, ownerId: pair.pid ?? "", history: [] }; draft.accounts = draft.accounts ?? []; draft.accounts.push(acct); }
    later = { id: ids.laterRow ?? "later-row", accountId: acct.id, personId: pair.pid ?? "", amount: 0, period: row.period ?? "monthly", employerMatch: 0 };
    rows.push(later);
  }
  if (later) later.employerMatch = m;
  keepRoth401k(draft, row);
  row.employerMatch = 0;
  const job = later ? (draft.accounts ?? []).find((a) => a.id === later.accountId) : pair.laterAccount;
  if (job) row.pairOf = job.id;
  // a $0 pay-the-tax-later row that no longer carries a match has nothing to say
  if (later && !(m > 0) && !(perYear(Number(later.amount) || 0, later.period) > 0)) rows.splice(rows.indexOf(later), 1);
}

/**
 * The catch-up said, not asked (spec D-C5; Vanguard, How America Saves 2026; IRC 414(v)(7)): from 2026, someone 50 or over whose
 * pay from this job last year was over the line (BENEFITS rothCatchUpWages, $150,000 for 2026) puts catch-up money in as Roth.
 * Today's pay stands in for last year's. -> the sentence, or null.
 */
export function catchUpRothWords(age, pay, year) {
  const y = Number(year);
  const years = Object.keys(BENEFITS).map(Number);
  const line = (BENEFITS[y] ?? BENEFITS[Math.max(...years)]).rothCatchUpWages;
  if (!(y >= ROTH_CATCHUP_FROM) || !(Number(age) >= 50) || !(Number(pay) > line)) return null;
  return `From ${ROTH_CATCHUP_FROM}, catch-up money above the usual limit must go in as Roth if last year's pay from this job was over $${line.toLocaleString("en-US")}.`;
}
/** The rule of thumb (spec D-C3b): Brown, Cederburg and O'Doherty, Journal of Financial Economics (2017), a mix under tax uncertainty. */
export const TAX_RULE_OF_THUMB = "If you expect a lower tax rate in retirement, later usually wins; higher, now wins. Not sure? Some of each is a sound choice.";
/** A match typed by hand on a pay-the-tax-now row (spec D-C2). */
export const ROTH_MATCH_WORDS = "Most plans add the employer's money as pay-the-tax-later.";

// modules/investments/limits/compute.js -- PURE. This year's contribution limits for each
// person and account kind (401(k), IRA, HSA, health FSA, 529 gifts) against what is going
// in, the room left, the catch-ups that apply, the Roth IRA income limit per person (and the
// amount each adult may put in a Roth IRA directly), and the deadlines.
import { compute as computeContributions, limitsFor, catchUpFor, limitKind, isLaterAccount, isNowAccount } from "../../retirement/contributions/compute.js";
import { LIMITS } from "../../retirement/contributions/data/limits.js";
import { taxInputs, compute as computeFederal } from "../../taxes/federal/compute.js";
import { known } from "../../taxes/federal/known.js";
import { federalTax } from "../../../core/math/tax.js";
import { dueDay } from "../../household/calendar/compute.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";
import { nameIn, NameIn, nameOf, NameOf, verbFor } from "../../../core/words.js";

const HSA_LABEL = { none: "HSA (no high-deductible plan)", self: "HSA (self-only coverage)", family: "HSA (family coverage)" };
const STATUS_RANK = { ok: 0, partial: 1, over: 2 };
const OTHER_TYPES = ["business", "rental", "pension", "investment", "other"];   // the Income page's kinds the Federal estimate taxes as ordinary income
const cents = (n) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * The Roth IRA income range for one return (IRC 408A(c)(3)(B)(ii)): the joint range for a joint return (and a qualifying
 * surviving spouse), the single range for single and head of household, and for married people filing separately the
 * $0 to $10,000 range, unless they lived apart all year: then they are not treated as married and use the single range
 * (408A(c)(3)(C) applying 219(g)(4); Pub. 590-A Table 2-1).
 */
export function rothRange(phaseOut, filingStatus, livedApart = false) {
  if (!phaseOut) return null;
  if (filingStatus === "married_separate" && livedApart) return phaseOut.single ?? null;
  return phaseOut[filingStatus] ?? phaseOut.single ?? null;
}

/**
 * Pub. 590-A Table 2-1's bands: "ok" below the start (and at exactly 0 on the $0 start of the separate range: "zero (-0-)"
 * allows the full amount), "partial" from the start up to the end ("at least $242,000 but less than $252,000"; "more than
 * zero (-0-) but less than $10,000"), "over" at or above the end.
 */
export function rothStatus(magi, [start, end]) {
  if (magi < start || (start === 0 && magi <= 0)) return "ok";
  return magi >= end ? "over" : "partial";
}

/**
 * The reduced Roth IRA dollar limit (IRC 408A(c)(3)(A)): the IRA limit with catch-up (`full`), less full x (MAGI - start) /
 * (end - start) rounded down to $10 (219(g)(2)(C)); a result above $0 but below $200 becomes $200 (219(g)(2)(B)); the full
 * amount at or below the start, 0 at or above the end.
 */
export function rothReduced(full, magi, [start, end]) {
  if (magi <= start) return full;
  if (magi >= end) return 0;
  const cut = Math.floor((full * (magi - start)) / (end - start) / 10 + 1e-9) * 10;
  const out = full - cut;
  return out > 0 ? Math.max(200, out) : 0;
}

/**
 * The traditional IRA deduction's income ranges for `year` (IRC 219(g)(3)(B), (g)(7); `iraDeductPhaseOut` in
 * retirement/contributions/data/limits.js): the newest table year at or before it that has them (a later year takes the
 * last published ones). -> { year, covered: { single, married_joint, married_separate }, spouse: { married_joint, married_separate } } | null
 */
export function iraDeductRanges(year) {
  const ys = Object.keys(LIMITS).map(Number).filter((y) => LIMITS[y].iraDeductPhaseOut).sort((a, b) => a - b);
  if (!ys.length) return null;
  const y = ys.filter((x) => x <= Number(year)).pop() ?? ys[0];
  return { year: y, ...LIMITS[y].iraDeductPhaseOut };
}

/**
 * How much of a traditional IRA contribution comes off income (IRC 219(g)). Someone covered by a plan at work (an "active
 * participant", 219(g)(5): here, any 401(k) or 403(b) money of their own or their employer's this year) deducts the IRA
 * limit (`full`, the catch-up included) less a share of it as modified AGI goes through their range (219(g)(2)(A)); the
 * limit left is rounded up to $10 (the reduction "rounded to the next lowest $10", 219(g)(2)(C); Pub. 590-A Worksheet 1-2
 * line 7) and is at least $200 until the range's end (219(g)(2)(B)). Someone not covered whose spouse is takes the spouse
 * range (219(g)(7)); nobody covered: all of it. The ranges: single and head of household the single one; a joint return and
 * a qualifying surviving spouse the joint one (Pub. 590-A Table 1-2); a separate return $0 to $10,000 unless the spouses
 * lived apart all year, who are then not treated as married (219(g)(4)): the single range. `magi`: the return's AGI
 * without the IRA deduction and the student loan interest deduction (219(g)(3)(A)).
 * -> { deductible (min of the contribution and the limit), limit, rule: "none" | "covered" | "spouse", range: [start, end] | null, reduced (the range cut it) }
 */
export function iraDeduction({ traditional = 0, full = 0, magi = 0, covered = false, spouseCovered = false, filingStatus = "single", livedApart = false, year = null } = {}) {
  const t = Math.max(0, Number(traditional) || 0);
  const married = filingStatus === "married_joint" || (filingStatus === "married_separate" && !livedApart);
  const rule = covered ? "covered" : married && spouseCovered ? "spouse" : "none";
  if (rule === "none") return { deductible: t, limit: full, rule, range: null, reduced: false };
  const R = iraDeductRanges(year ?? new Date().getFullYear());
  const col = filingStatus === "married_joint" || filingStatus === "qualifying_surviving" ? "married_joint" : filingStatus === "married_separate" && !livedApart ? "married_separate" : "single";
  const range = R ? (rule === "spouse" ? R.spouse[col] : R.covered[col]) ?? null : null;
  if (!range) return { deductible: t, limit: full, rule, range: null, reduced: false };
  const limit = rothReduced(full, Number(magi) || 0, range);
  return { deductible: Math.min(t, limit), limit, rule, range, reduced: limit < full };
}

/**
 * Whether `personId` is covered by a plan at work this year (an active participant, 219(g)(5)): a Contributions row of
 * theirs (or on an account they own) that goes into a 401(k), a 403(b) or a Roth 401(k), from pay or from the employer's
 * match. A pension plan at work counts in the law too; the plan cannot see one, so it is not counted (README).
 */
export function coveredAtWork(plan, personId) {
  const accounts = plan.accounts ?? [];
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const me = adults.find((p) => p.role === "self") ?? adults[0] ?? null;
  return (plan.retirement?.contributions ?? []).some((c) => {
    const a = accounts.find((x) => x.id === c.accountId);
    if (!a || !(Number(c.amount) > 0 || Number(c.employerMatch) > 0)) return false;
    if (limitKind(a.type, a.name, Number(c.employerMatch) || 0) !== "401k") return false;
    const owner = adults.find((p) => p.id === c.personId) ?? adults.find((p) => p.id === a.ownerId) ?? me;
    return (owner?.id ?? null) === (personId ?? null);
  });
}

/** What may go into a Roth IRA directly: the reduced limit, but never more than the IRA limit left after traditional IRA money (408A(c)(2)). */
export const rothAllowed = (full, reduced, traditional) => Math.max(0, Math.min(reduced, full - (Number(traditional) || 0)));

/**
 * compute(plan, { today }) -> {
 *   year, limitsYear (the newest year with every kind), kindYear ({ kind: the year its figures are from }),
 *   base: { "401k", ira, hsa, hsaFamily } (the limits before catch-ups), payKnown (the Income page has pay),
 *   people: [{ id, name, age, rows: [{ kind, label, year, limit, catchUp, catchUpFull, catchUpCapped, used, room, over,
 *     accounts: [names], hasAccount, catchUpAge, eligible (HSA), shared (HSA), deduct (IRA: { deductible, traditional, rule,
 *     range, magi } from the Federal estimate's figures, or null without traditional IRA money) }] }],
 *   hsa: { coverage, coveredName, shared } (the cover the HSA page set),
 *   fsa: { limit }, gift: { exclusion, superfund },
 *   roth: { filingStatus, livedApart, separate, year, phaseOut: [lo, hi], magi (one return: its MAGI; separate: null),
 *     status (one return: its status; separate: the more limited spouse's),
 *     people: [{ id, name, age, magi, status, full, reduced, traditional, roth, allowed, over }] } | null,
 *   deadlines: [{ label, date, note }], totals: { used, limit }, notes: [text], warnings: [text], hasContributions
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const year = today ? Number(String(today).slice(0, 4)) : new Date().getFullYear();
  // each kind from the newest year that has it: a 2027 date has 2027's HSA figures and 2026's others
  const L = limitsFor(year);
  const limitsYear = L.fullYear;
  const c = computeContributions(plan, { today });
  const ti = taxInputs(plan, { today });
  // the Federal estimate as its page shows it (known.js): the IRA deduction the income limits allow (219(g)), and the income
  // the plan knows beyond the Income page (stock pay, this year's required withdrawal, rentals after costs) in the Roth IRA's MAGI
  let k = null;
  try { k = known(plan, { today }, computeFederal(plan, { today })); } catch { k = null; }
  const accounts = plan.accounts ?? [];
  const contributions = plan.retirement?.contributions ?? [];
  // the kind of limit an account counts against: a Roth account is a Roth 401(k) when it has a match or says 401(k) in its name
  const matchOn = (id) => contributions.filter((x) => x.accountId === id).reduce((m, x) => Math.max(m, Number(x.employerMatch) || 0), 0);
  const kindOfAccount = (a) => limitKind(a.type, a.name, matchOn(a.id));
  // the 401(k) catch-up is at most the compensation left after the other deferrals (414(v)(2)(A)(ii)): pay, and business
  // income for someone self-employed (415(c)(3)(B)); with neither on the Income page, the page cannot know it and shows
  // the whole catch-up
  const payKnown = ti.k401.people.some((x) => x.compensation > 0);
  const hp = ti.hsa.picture;   // the Federal estimate's picture: Medicare worked in (an HSA limit of 0 once on Medicare)
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const coveredName = hp.coverage === "self" ? (adults.find((p) => p.id === hp.coveredId)?.name ?? null) : null;
  const sum = (xs) => xs.reduce((s, i) => s + i.yearly, 0);
  const people = adults.map((p) => {
    const age = p.birthDate ? year - Number(String(p.birthDate).slice(0, 4)) : null;
    const mine = c.items.filter((i) => i.personId === p.id);
    const hasAccountOf = (kind) => accounts.some((a) => kindOfAccount(a) === kind && (a.ownerId === p.id || !a.ownerId));
    const namesOf = (items) => [...new Set(items.map((i) => i.accountName))];
    const rows = ["401k", "ira"].map((kind) => {
      const def = L.kinds[kind];
      const items = mine.filter((i) => i.limitKind === kind);
      const used = sum(items);
      const catchUpFull = catchUpFor(def, age);
      const pay = ti.k401.people.find((x) => x.id === p.id)?.compensation ?? 0;
      const catchUp = kind === "401k" && payKnown ? Math.min(catchUpFull, Math.max(0, pay - Math.min(used, def.limit))) : catchUpFull;
      const limit = def.limit + catchUp;
      // the traditional IRA money that comes off this year's income (IRC 219(g): less for someone with a plan at work as
      // income rises), from the Federal estimate's figures; the rest goes in after tax (round 8, equity-3)
      const ira = kind === "ira" ? (k?.ira?.people ?? []).find((x) => x.id === p.id) ?? null : null;
      const deduct = kind === "ira" ? (ira ? { deductible: ira.deductible, traditional: ira.traditional, rule: ira.rule, range: ira.range, magi: ira.magi } : null) : undefined;
      return { kind, label: def.label, year: L.kindYear[kind], limit, catchUp, catchUpFull, catchUpCapped: catchUp < catchUpFull, used, room: Math.max(0, limit - used), over: Math.max(0, used - limit), accounts: namesOf(items), hasAccount: hasAccountOf(kind), catchUpAge: def.catchUpAge, ...(deduct ? { deduct } : {}) };
    });
    // the HSA: the household's cover decides who may have one, each adult's own money (theirs and their employer's)
    // counts, and married people with family cover share one family limit (hsaPicture, IRC 223(b))
    const h = hp.people.find((x) => x.id === p.id);
    const hsaItems = mine.filter((i) => i.limitKind === "hsa");
    rows.push({ kind: "hsa", label: HSA_LABEL[hp.coverage], year: L.kindYear.hsa, limit: h.limit, catchUp: h.catchUp, catchUpFull: h.catchUp, catchUpCapped: false, used: h.used, room: h.room, over: h.over, accounts: namesOf(hsaItems), hasAccount: hasAccountOf("hsa"), catchUpAge: L.kinds.hsa.catchUpAge, eligible: h.eligible, shared: hp.shared && h.eligible, payroll: h.payroll, employer: h.employer });
    return { id: p.id, name: p.name, age, rows };
  });

  // the Roth IRA income limit, per person, on modified AGI: the Federal estimate's AGI with the traditional IRA deduction
  // it took added back (219(g)(3)(A), 408A(c)(3)(B)(i))
  let roth = null;
  const separate = ti.filingStatus === "married_separate";
  const range = rothRange(L.rothPhaseOut, ti.filingStatus, ti.livedApart);
  if (range) {
    // with figures the Income page leaves out (k.changed: stock pay, a required withdrawal, rentals after costs), their AGI,
    // the IRA and student loan interest deductions added back (219(g)(3)(A)(ii)); else as before
    const baseR = federalTax(ti.inputs, ti.params);
    const magiBase = cents(baseR.agi + ti.ira.deductible);
    const magiAll = k?.changed ? cents(k.result.agi + (k.ira ? k.ira.deductible : ti.ira.deductible) + (k.loan?.deduction ?? 0)) : magiBase;
    const who = adults.length ? adults : [{ id: null, name: "You", birthDate: null }];
    const me = who.find((p) => p.role === "self") ?? who[0];
    // filing separately, each spouse's own: their pay less the pre-tax 401(k) kept out of income, their own health FSA,
    // their HSA payroll money within the limit, and the other income on the Income page that names
    // them (business, rent, pension, dividends, other); the household's other income (typed, gains, unnamed) split in half
    const own = new Map();
    if (separate && who.length === 2) {
      const named = computeIncome(plan, { today }).active.filter((x) => x.taxable !== false && OTHER_TYPES.includes(x.type));
      const share = (p) => (ti.payTotal > 0 ? (ti.k401.people.find((x) => x.id === p.id)?.pay ?? 0) / ti.payTotal : 0.5);
      for (const p of who) {
        const k = ti.k401.people.find((x) => x.id === p.id), h = ti.hsa.picture.people.find((x) => x.id === p.id);
        // ... and their own child care account, which the Federal estimate takes off their wages (IRC 129; its care section)
        const dcOwn = ti.wagesTyped || !(ti.care?.offWages > 0) ? 0 : (() => { const e = ti.care.earnedPeople?.find((x) => x.id !== null && x.id === p.id); return (e?.excluded ?? 0) + (e?.forfeited ?? 0); })();   // excluded + forfeited: the one rule (careAccountRule)
        const wages = ti.wagesTyped ? ti.inputs.wages * share(p) : (k?.pay ?? 0) - (k?.excluded ?? 0) - (ti.fsa.people?.find((x) => x.id !== null && x.id === p.id)?.offWages ?? (p === me ? ti.fsa.offWages : 0)) - dcOwn;
        const income = named.filter((x) => x.personId === p.id).reduce((s, x) => s + x.yearly, 0);
        own.set(p, wages - (ti.wagesTyped ? 0 : (h?.payroll ?? 0) - (h?.excess ?? 0)) + income);   // typed wages are box 1: the HSA money is already out
      }
      const other = magiBase - [...own.values()].reduce((s, x) => s + x, 0);
      for (const p of who) own.set(p, own.get(p) + other / 2);
      // what the plan knows beyond that (a business at its profit, stock pay, a required withdrawal: known.js) on the return
      // it is on: each return's MAGI with it less without it (round 8)
      if (k?.changed && baseR.separate && k.result.separate) for (const p of who) {
        const i = baseR.separate.findIndex((x) => x.personId === p.id), j = k.result.separate.findIndex((x) => x.personId === p.id);
        if (i < 0 || j < 0) continue;
        const dedK = (k.ira?.people ?? []).find((x) => x.id === p.id)?.deductible ?? ti.ira.people.find((x) => x.id === p.id)?.deductible ?? 0;
        const dedB = ti.ira.people.find((x) => x.id === p.id)?.deductible ?? 0;
        own.set(p, own.get(p) + (k.result.separate[j].agi + dedK) - (baseR.separate[i].agi + dedB));
      }
    }
    const rothPeople = who.map((p) => {
      const age = p.birthDate ? year - Number(String(p.birthDate).slice(0, 4)) : null;
      const magi = own.has(p) ? cents(own.get(p)) : magiAll;
      const I = L.kinds.ira, full = I.limit + catchUpFor(I, age);
      const mine = c.items.filter((i) => (p.id === null ? true : i.personId === p.id) && i.limitKind === "ira");
      const traditional = sum(mine.filter((i) => i.accountType === "ira")), rothMoney = sum(mine.filter((i) => i.accountType === "roth"));
      const reduced = rothReduced(full, magi, range), allowed = rothAllowed(full, reduced, traditional);
      return { id: p.id, name: p.name, age, magi, status: rothStatus(magi, range), full, reduced, traditional, roth: rothMoney, allowed, over: Math.max(0, rothMoney - allowed) };
    });
    const worst = rothPeople.reduce((w, x) => (STATUS_RANK[x.status] > STATUS_RANK[w] ? x.status : w), "ok");
    roth = { filingStatus: ti.filingStatus, livedApart: ti.livedApart, separate: own.size > 0, year: L.rothPhaseOutYear, phaseOut: range, magi: own.size ? null : magiAll, status: own.size ? worst : rothStatus(magiAll, range), people: rothPeople };
  }

  // IRA and HSA money for a year can go in until the filing date, April 15 moved off a weekend or a D.C. holiday
  // (219(f)(3), 223(d)(4)(B), 7503)
  const deadlines = [
    { label: `${year} IRA and HSA contributions`, date: dueDay(`${year + 1}-04-15`), note: "can be made until the tax filing deadline the next spring" },
    { label: `${year} 401(k) contributions`, date: `${year}-12-31`, note: "through payroll only; last paycheck of the year" },
    { label: `${year} 529 gifts`, date: `${year}-12-31`, note: "some states allow the state deduction until the state's filing date" },
  ];
  const totals = { used: people.reduce((s, p) => s + p.rows.reduce((t, r) => t + r.used, 0), 0), limit: people.reduce((s, p) => s + p.rows.filter((r) => r.hasAccount || r.used > 0).reduce((t, r) => t + r.limit, 0), 0) };
  const notes = [], warnings = [];
  const money = (n) => Math.round(n).toLocaleString("en-US");
  if (!people.length) notes.push("Add the adults on the People page; limits are per person.");
  if (!c.items.length) notes.push("Nothing on the Retirement contributions page yet, so every limit shows its full room.");
  // the unnamed first adult reads "Your 8,000 is going ...", the partner Get started named "Your spouse's 8,000"; a typed name
  // keeps "Ana: 8,000 is going ..." (Review 2026-11-06 round 7)
  const whose = (name) => (nameIn(name) !== String(name ?? "") ? NameOf(name) : `${name}:`);
  for (const r of roth?.people ?? []) if (r.over > 0) warnings.push(`${whose(r.name)} ${money(r.roth)} is going into a Roth IRA, ${r.allowed > 0 ? `${money(r.over)} more than the ${money(r.allowed)} allowed directly this year` : "but none is allowed directly this year"}. Move the extra to a traditional IRA or take it out before the filing deadline, or it is taxed 6% for each year it stays.`);
  return {
    year, limitsYear, kindYear: L.kindYear, base: { "401k": L.kinds["401k"].limit, ira: L.kinds.ira.limit, hsa: L.kinds.hsa.limit, hsaFamily: L.kinds.hsa.family }, payKnown,
    people, hsa: { coverage: hp.coverage, coveredName, shared: hp.shared }, fsa: { limit: L.kinds.fsa?.limit ?? null }, gift: { exclusion: L.giftExclusion ?? 19000, superfund: (L.giftExclusion ?? 19000) * 5 },
    roth, deadlines, totals, notes, warnings, hasContributions: c.items.length > 0,
  };
}

// ---------------------------------------------------------------- after-tax money into Roth (gap list, next 60, item 28)
// Some 401(k) and 403(b) plans take money after tax on top of the pre-tax and Roth money, up to the yearly limit on all
// money going into the person's accounts in the plan (IRC 415(c)), and let it be moved to Roth inside the plan or taken
// out while the person still works. Nothing here is counted in the plan: compute() above is unchanged, and the view asks
// for this only when the person opens its part (README "After-tax money into Roth").

/** A 457(b) plan or the Thrift Savings Plan: not a 401(k) or 403(b), so not offered this route here (README). */
const NOT_401K = /\b(?:457|tsp|thrift)\b/i;
/** The two answers kept on `retirement.workPlans[personId]` (DATA_MODEL): absent is "not sure". */
export const AFTER_TAX_KEYS = Object.freeze(["afterTax", "afterTaxToRoth"]);

/**
 * The yearly limit on all money going into one person's accounts in a work plan (IRC 415(c)(1)(A): $72,000 for 2026,
 * Notice 2025-67), from the newest table year at or before `year` that has it (a year before the table: the first).
 * -> { limit, year } | null
 */
export function annualAdditionsFor(year) {
  const ys = Object.keys(LIMITS).map(Number).filter((y) => Number.isFinite(LIMITS[y].annualAdditions)).sort((a, b) => a - b);
  if (!ys.length) return null;
  const y = ys.filter((x) => x <= Number(year)).pop() ?? ys[0];
  return { limit: LIMITS[y].annualAdditions, year: y };
}

/** The two answers about a person's plan at work: { afterTax, toRoth }, each true, false or null (not sure). */
export function afterTaxAnswer(plan, personId) {
  const w = plan?.retirement?.workPlans?.[personId] ?? {};
  const yn = (v) => (v === true ? true : v === false ? false : null);
  return { afterTax: yn(w.afterTax), toRoth: yn(w.afterTaxToRoth) };
}

/**
 * Write one answer on the draft: "yes" -> true, "no" -> false, anything else ("unsure") -> removed. An entry left with
 * nothing goes, and `workPlans` with it, as Get started's own write does; the entry's other answers (match, plan) stay.
 */
export function setAfterTaxAnswer(draft, personId, key, value) {
  if (!AFTER_TAX_KEYS.includes(key) || !personId) return draft;
  draft.retirement = draft.retirement ?? {};
  // a hand-edited entry that is not a plain object (a string, a list) is read as nothing, never spread into keys "0", "1" ...
  const plain = (v) => (v !== null && typeof v === "object" && !Array.isArray(v) ? v : {});
  const all = plain(draft.retirement.workPlans);
  const wp = { ...plain(all[personId]) };
  if (value === "yes") wp[key] = true;
  else if (value === "no") wp[key] = false;
  else delete wp[key];
  draft.retirement.workPlans = { ...all, [personId]: wp };
  if (!Object.keys(wp).length) delete draft.retirement.workPlans[personId];
  if (!Object.keys(draft.retirement.workPlans).length) delete draft.retirement.workPlans;
  return draft;
}

/**
 * Whether `personId` has a 401(k) or 403(b) at work this year: a row of theirs (or on an account they own) into a 401(k)
 * or Roth 401(k) at the current job, from pay or from the employer (as coveredAtWork, without an old job's account,
 * a 457 or the TSP); else Get started's answer "Retirement plan at work?" (`workPlans[id].plan`: No closes it, Yes opens
 * it); else pay on file (`pay`) and a 401(k) or Roth 401(k) of their own at the current job (Retirement contributions'
 * isLaterAccount / isNowAccount: not marked from a job left, and no "old", "former", "previous", "prior" or "rollover"
 * in its name). An account that names no adult is the first adult's ("Me"), as everywhere on this page.
 */
export function atWorkPlan(plan, personId, pay = 0) {
  const accounts = plan.accounts ?? [];
  const rows = plan.retirement?.contributions ?? [];
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const me = adults.find((p) => p.role === "self") ?? adults[0] ?? null;
  const matchOn = (id) => rows.filter((x) => x.accountId === id).reduce((m, x) => Math.max(m, Number(x.employerMatch) || 0), 0);
  const work = (a) => !!a && !NOT_401K.test(String(a.name ?? "")) && (isLaterAccount(a) || isNowAccount(a, matchOn(a.id)));
  const ownerOf = (a) => adults.find((p) => p.id === a.ownerId) ?? me;
  const isMe = (p) => (p?.id ?? null) === (personId ?? null);
  const going = rows.some((c) => {
    const a = accounts.find((x) => x.id === c.accountId);
    return work(a) && (Number(c.amount) > 0 || Number(c.employerMatch) > 0) && isMe(adults.find((p) => p.id === c.personId) ?? ownerOf(a));
  });
  if (going) return true;
  const said = plan.retirement?.workPlans?.[personId]?.plan;
  if (said === false) return false;
  if (said === true) return true;
  return Number(pay) > 0 && accounts.some((a) => work(a) && isMe(ownerOf(a)));
}

/**
 * afterTaxRoom(plan, params, d = compute(plan, params)) -> {
 *   year, limit (the 415(c) amount), limitYear (the year it is from),
 *   people: [{ id, name, age, pay, compensation, payKnown, cap, capByPay, base (the 402(g) amount), used, own, catchUp, catchUpIn,
 *     employer, room, regularLeft, afterTax, toRoth, verdict: "ok" | "ask" | "no" | "stuck" | "full", asks: ["afterTax" |
 *     "toRoth"], set }],
 *   total (the room of the adults whose way in is not closed), set (answers given)
 * }
 * For each adult with a 401(k) or 403(b) at work (atWorkPlan): the room for after-tax money this year
 *   cap = the 415(c) amount, or the person's compensation when that is less (415(c)(1)(B); the pay and business income
 *         on the Income page, as the catch-up cap reads it; none on file: the amount, and `payKnown` false);
 *   own = min(the 401(k) row's pre-tax and Roth money, the 402(g) amount): catch-up money does not count (414(v)(3)(A));
 *   employer = the employer's money a year on the person's 401(k) rows;
 *   a row's person: the adult it names, else the account's owner, else the first adult (as atWorkPlan, Retirement
 *   contributions' own list per person and the Federal estimate read it), so a row marked "Household" is counted;
 *   room = max(0, cap - own - employer); regularLeft = max(0, the 402(g) amount - the 401(k) row's money).
 * verdict: "full" with no room; "no" when the plan does not take after-tax money; "stuck" when it cannot be moved to Roth
 * or taken out while working; "ok" when both answers are yes; "ask" otherwise (`asks`: what to ask the plan).
 */
export function afterTaxRoom(plan, params = {}, d = null) {
  const today = params.today ?? null;
  const D = d ?? compute(plan, params);
  const A = annualAdditionsFor(D.year);
  if (!A) return { year: D.year, limit: null, limitYear: null, people: [], total: 0, set: 0 };
  const ti = taxInputs(plan, { today });
  const items = computeContributions(plan, { today }).items;
  const accounts = plan.accounts ?? [];
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const me = adults.find((p) => p.role === "self") ?? adults[0] ?? null;
  const ownerOf = (i) => adults.find((p) => p.id === i.personId) ?? adults.find((p) => p.id === accounts.find((a) => a.id === i.accountId)?.ownerId) ?? me;
  const k401 = items.filter((i) => i.limitKind === "401k");
  const people = D.people.map((p) => {
    const k = ti.k401.people.find((x) => x.id === p.id);
    if (!atWorkPlan(plan, p.id, k?.pay ?? 0)) return null;
    const r = p.rows.find((x) => x.kind === "401k");
    const base = r.limit - r.catchUp;
    const compensation = k?.compensation ?? 0;
    const cap = compensation > 0 ? Math.min(A.limit, compensation) : A.limit;
    // the person's 401(k) rows, a "Household" row on their account included (compute()'s row counts only rows naming them)
    const mine = k401.filter((i) => (ownerOf(i)?.id ?? null) === p.id);
    const used = mine.reduce((s, i) => s + i.yearly, 0);
    // the catch-up as compute() works it (414(v)(2)(A)(ii)), on these rows: the same figure whenever every row names its person
    const catchUp = D.payKnown ? Math.min(r.catchUpFull, Math.max(0, compensation - Math.min(used, base))) : r.catchUpFull;
    const own = Math.min(used, base);
    const catchUpIn = Math.min(catchUp, Math.max(0, used - base));
    const employer = mine.reduce((s, i) => s + (Number(i.matchYearly) || 0), 0);
    const room = Math.max(0, cap - own - employer);
    const { afterTax, toRoth } = afterTaxAnswer(plan, p.id);
    const verdict = room <= 0 ? "full" : afterTax === false ? "no" : toRoth === false ? "stuck" : afterTax && toRoth ? "ok" : "ask";
    const asks = verdict === "ask" ? [afterTax === null ? "afterTax" : null, toRoth === null ? "toRoth" : null].filter(Boolean) : [];
    return {
      id: p.id, name: p.name, age: p.age, pay: k?.pay ?? 0, compensation, payKnown: compensation > 0, cap, capByPay: cap < A.limit, base, used, own,
      catchUp, catchUpIn, employer, room, regularLeft: Math.max(0, base - used), afterTax, toRoth, verdict, asks,
      set: (afterTax === null ? 0 : 1) + (toRoth === null ? 0 : 1),
    };
  }).filter(Boolean);
  return {
    year: D.year, limit: A.limit, limitYear: A.year, people,
    total: people.filter((x) => x.verdict === "ok" || x.verdict === "ask").reduce((s, x) => s + x.room, 0),
    set: people.reduce((s, x) => s + x.set, 0),
  };
}

/**
 * The words for one adult of afterTaxRoom (`x`), one written sentence per case (docs/OPTIONAL.md R5), so the tests read
 * what the page says: { line (the answer), next (the second sentence: where to find out, with the words the plan's papers
 * use, or why the way is closed), pay (no pay on file: the full limit is used), sum (how the room is worked out), regular
 * (the usual 401(k) room left), catchUp, q1, q2 (the two questions) }.
 * `money` formats a figure; `year`, `limit` and `limitYear` come from afterTaxRoom.
 */
export function afterTaxWords(x, { money = (n) => `$${Math.round(n).toLocaleString("en-US")}`, year, limit, limitYear = year } = {}) {
  const Who = NameIn(x.name), who = nameIn(x.name), Whose = NameOf(x.name), whose = nameOf(x.name);
  const works = verbFor(x.name, "works", "work"), has = verbFor(x.name, "has", "have"), earns = verbFor(x.name, "earns", "earn");
  const open = x.verdict === "ok" || x.verdict === "ask";
  const m = (n) => money(n);
  const room = m(x.room);
  let line, next = null;
  if (x.verdict === "full") {
    line = x.capByPay
      ? `${Whose} work plan is already at its ${limitYear} limit, which is all of ${whose} pay (${m(x.cap)}), so no after-tax money fits this year.`
      : `${Whose} work plan is already at its ${m(x.cap)} limit for ${limitYear}, so no after-tax money fits this year.`;
  } else if (x.verdict === "no") {
    line = `${Whose} plan does not take after-tax money, so this way into Roth is closed.`;
  } else if (x.verdict === "stuck") {
    // the first answer still "Not sure": the sentence does not take for granted that the plan takes after-tax money
    line = x.afterTax === true
      ? `${Whose} plan cannot move after-tax money to Roth while ${who} ${works}, so this way into Roth is closed.`
      : `If ${whose} plan takes after-tax money, that money cannot be moved to Roth while ${who} ${works}, so this way into Roth is closed.`;
    next = "After-tax money left in the plan grows, and the growth is taxed as pay when it comes out.";
  } else if (x.verdict === "ok") {
    line = `${Who} could put up to ${room} more into the plan after tax this year and move it to Roth.`;
  } else if (x.asks.length === 2) {
    line = `${Who} could put up to ${room} more into the plan after tax this year, if the plan allows it.`;
    next = 'Not sure? Ask HR, or look on the plan\'s website for "after-tax contributions" and "in-plan Roth conversion".';
  } else if (x.asks[0] === "toRoth") {
    line = `${Whose} plan takes after-tax money: up to ${room} more could go in this year.`;
    next = 'Not sure? Ask HR, or look on the plan\'s website for "in-plan Roth conversion" or "in-service withdrawal".';
  } else {
    line = `${Who} could put up to ${room} more into the plan after tax this year, if the plan takes after-tax money.`;
    next = 'Not sure? Ask HR, or look on the plan\'s website for "after-tax contributions".';
  }
  // how the room is worked out: the limit, then what goes in
  // a later year than the table: the newest limit, "not out yet"; an earlier one (a phone's clock set back): the first kept
  const whichLimit = limitYear < year ? `${limitYear} limit (${year}'s is not out yet)` : limitYear > year ? `${limitYear} limit (the earliest this app has)` : `${limitYear} limit`;
  const limitIs = x.capByPay
    ? `The ${whichLimit} on all money into ${whose} work plan is ${m(x.cap)}, all of ${whose} pay: it is the pay when that is less than ${m(limit)}.`
    : `The ${whichLimit} on all money into ${whose} work plan is ${m(x.cap)}.`;
  const leaves = x.room > 0 ? `which leaves ${room}` : "which leaves nothing";
  const goesIn = x.own > 0 && x.employer > 0 ? `${m(x.own)} goes in from ${whose} pay, before tax or as Roth, and ${m(x.employer)} from the employer, ${leaves}.`
    : x.own > 0 ? `${m(x.own)} goes in from ${whose} pay, before tax or as Roth, ${leaves}.`
    : x.employer > 0 ? `${m(x.employer)} goes in from the employer, ${leaves}.`
    : "Nothing goes in yet, so all of it is room.";
  // the usual room is part of the same limit: said as such, so it does not read as room on top of the figure above
  const regular = x.regularLeft > 0 && x.verdict !== "full"
    ? `${Who} also ${has} ${m(x.regularLeft)} of usual 401(k) room left this year.${open ? ` It counts toward the same ${m(x.cap)}: what goes in there comes off the ${room}.` : ""}`
    : null;
  // no pay on the Income page: the limit cannot be checked against the pay, so the screen says so and where to add it
  const pay = x.payKnown === false
    ? `${Whose} pay is not on the Income page, so this uses the full ${m(x.cap)}. If ${who} ${earns} less than that, the limit is all of ${whose} pay.`
    : null;
  const catchUp = x.catchUpIn > 0
    ? `Of what goes in from ${whose} pay, ${m(x.catchUpIn)} is catch-up money: it is on top of this limit and does not use it.`
    : x.catchUp > 0 ? `The ${m(x.catchUp)} catch-up from ${x.age >= 60 && x.age <= 63 ? "60 to 63" : "50"} is on top of this limit and does not use it.` : null;
  return {
    line, next, pay, sum: `${limitIs} ${goesIn}`, regular, catchUp,
    q1: `Does ${whose} work plan take after-tax money, on top of the usual 401(k) money?`,
    q2: `Can that money be moved to Roth while ${who} still ${works} there?`,
  };
}

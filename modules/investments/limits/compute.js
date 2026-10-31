// modules/investments/limits/compute.js -- PURE. This year's contribution limits for each
// person and account kind (401(k), IRA, HSA, health FSA, 529 gifts) against what is going
// in, the room left, the catch-ups that apply, the Roth IRA income limit per person (and the
// amount each adult may put in a Roth IRA directly), and the deadlines.
import { compute as computeContributions, limitsFor, catchUpFor, limitKind } from "../../retirement/contributions/compute.js";
import { taxInputs } from "../../taxes/federal/compute.js";
import { federalTax } from "../../../core/math/tax.js";
import { dueDay } from "../../household/calendar/compute.js";
import { compute as computeIncome } from "../../cashflow/income/compute.js";

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

/** What may go into a Roth IRA directly: the reduced limit, but never more than the IRA limit left after traditional IRA money (408A(c)(2)). */
export const rothAllowed = (full, reduced, traditional) => Math.max(0, Math.min(reduced, full - (Number(traditional) || 0)));

/**
 * compute(plan, { today }) -> {
 *   year, limitsYear (the newest year with every kind), kindYear ({ kind: the year its figures are from }),
 *   base: { "401k", ira, hsa, hsaFamily } (the limits before catch-ups), payKnown (the Income page has pay),
 *   people: [{ id, name, age, rows: [{ kind, label, year, limit, catchUp, catchUpFull, catchUpCapped, used, room, over,
 *     accounts: [names], hasAccount, catchUpAge, eligible (HSA), shared (HSA) }] }],
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
  const accounts = plan.accounts ?? [];
  const contributions = plan.retirement?.contributions ?? [];
  // the kind of limit an account counts against: a Roth account is a Roth 401(k) when it has a match or says 401(k) in its name
  const matchOn = (id) => contributions.filter((x) => x.accountId === id).reduce((m, x) => Math.max(m, Number(x.employerMatch) || 0), 0);
  const kindOfAccount = (a) => limitKind(a.type, a.name, matchOn(a.id));
  // the 401(k) catch-up is at most the compensation left after the other deferrals (414(v)(2)(A)(ii)): pay, and business
  // income for someone self-employed (415(c)(3)(B)); with neither on the Income page, the page cannot know it and shows
  // the whole catch-up
  const payKnown = ti.k401.people.some((x) => x.compensation > 0);
  const hp = c.hsa;
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
      return { kind, label: def.label, year: L.kindYear[kind], limit, catchUp, catchUpFull, catchUpCapped: catchUp < catchUpFull, used, room: Math.max(0, limit - used), over: Math.max(0, used - limit), accounts: namesOf(items), hasAccount: hasAccountOf(kind), catchUpAge: def.catchUpAge };
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
    const magiAll = cents(federalTax(ti.inputs, ti.params).agi + ti.ira.deductible);
    const who = adults.length ? adults : [{ id: null, name: "You", birthDate: null }];
    const me = who.find((p) => p.role === "self") ?? who[0];
    // filing separately, each spouse's own: their pay less the pre-tax 401(k) kept out of income, the health FSA (on the
    // adult marked "Me"), their HSA payroll money within the limit, and the other income on the Income page that names
    // them (business, rent, pension, dividends, other); the household's other income (typed, gains, unnamed) split in half
    const own = new Map();
    if (separate && who.length === 2) {
      const named = computeIncome(plan, { today }).active.filter((x) => x.taxable !== false && OTHER_TYPES.includes(x.type));
      const share = (p) => (ti.payTotal > 0 ? (ti.k401.people.find((x) => x.id === p.id)?.pay ?? 0) / ti.payTotal : 0.5);
      for (const p of who) {
        const k = ti.k401.people.find((x) => x.id === p.id), h = ti.hsa.picture.people.find((x) => x.id === p.id);
        const wages = ti.wagesTyped ? ti.inputs.wages * share(p) : (k?.pay ?? 0) - (k?.excluded ?? 0) - (p === me ? ti.fsa.offWages : 0);
        const income = named.filter((x) => x.personId === p.id).reduce((s, x) => s + x.yearly, 0);
        own.set(p, wages - (h?.payroll ?? 0) + (h?.excess ?? 0) + income);
      }
      const other = magiAll - [...own.values()].reduce((s, x) => s + x, 0);
      for (const p of who) own.set(p, own.get(p) + other / 2);
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
  if (!c.items.length) notes.push("Nothing on the Contributions page yet, so every limit shows its full room.");
  for (const r of roth?.people ?? []) if (r.over > 0) warnings.push(`${r.name}: ${money(r.roth)} is going into a Roth IRA, ${r.allowed > 0 ? `${money(r.over)} more than the ${money(r.allowed)} allowed directly this year` : "but none is allowed directly this year"}. Move the extra to a traditional IRA or take it out before the filing deadline, or it is taxed 6% for each year it stays.`);
  return {
    year, limitsYear, kindYear: L.kindYear, base: { "401k": L.kinds["401k"].limit, ira: L.kinds.ira.limit, hsa: L.kinds.hsa.limit, hsaFamily: L.kinds.hsa.family }, payKnown,
    people, hsa: { coverage: hp.coverage, coveredName, shared: hp.shared }, fsa: { limit: L.kinds.fsa?.limit ?? null }, gift: { exclusion: L.giftExclusion ?? 19000, superfund: (L.giftExclusion ?? 19000) * 5 },
    roth, deadlines, totals, notes, warnings, hasContributions: c.items.length > 0,
  };
}

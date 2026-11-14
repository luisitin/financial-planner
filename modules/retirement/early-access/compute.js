// modules/retirement/early-access/compute.js -- Money before 59½ (gap design #38, 2026-11-14). PURE.
//
// What the plan takes out of a 401(k) or traditional IRA before its owner is 59½, what the extra 10% tax on it comes to, and
// three ways around it: leaving a job in or after the year you turn 55, a Roth conversion ladder, and equal yearly payments
// (the tax code's 72(t) payments), which a person can count in the plan here (`retirement.early.sepp`). The 10% itself is
// charged by the year-by-year engine (core/math/retirement.js, `early`), so every page that runs the plan counts it; this page
// reads those rows and says them. Formulas, sources and read dates: README.md.
import { project } from "../../../core/math/retirement.js";
import { RMD_ACCOUNT_TYPES, singleLife } from "../../../core/math/rmd.js";
import { halfYear, leftAt55Year, seppLastYear, SEPP_RATE_FLOOR, SEPP_METHODS, SEPP_YEARLY_CHECK, EARLY_RATE } from "../../../core/math/early.js";
import { countedBalance } from "../../balance/net-worth/compute.js";
import { buildInputs, seppOf, SEPP_RATE_MAX } from "../projection/compute.js";
import { isYou, nameIn, NameIn, nameOf, verbFor } from "../../../core/words.js";

export { SEPP_RATE_MAX };
/** The rate chips: low to high, the last one the most the rule allows whatever the federal rates are. */
export const RATE_CHIPS = Object.freeze([{ value: 0.03, label: "3%" }, { value: 0.04, label: "4%" }, { value: SEPP_RATE_FLOOR, label: "5%, the usual most" }]);
export const METHOD_CHIPS = Object.freeze([{ value: "amortization", label: "Same each year" }, { value: "rmd", label: "Recalculated each year" }]);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const list = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const cap = (s) => String(s).replace(/^./, (c) => c.toUpperCase());
/** An account by its name inside a sentence: "your IRA", "Kim's 401(k)" (a name that already says whose stays as it is). */
export const acctWords = (name) => (/(^(my|our|your)\b|'s\b|’s\b)/i.test(String(name).trim()) ? String(name).trim().replace(/^(my|our)\b/i, "your") : `your ${String(name).trim()}`);
const usd = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
/** "August 2035": the month a person reaches 59½. */
export function halfMonth(birthDate) {
  const b = String(birthDate ?? "");
  if (!/^\d{4}-\d{2}/.test(b)) return null;
  const m = Number(b.slice(5, 7)) + 6, y = Number(b.slice(0, 4)) + 59 + (m > 12 ? 1 : 0);
  return `${MONTHS[(m > 12 ? m - 12 : m) - 1]} ${y}`;
}

/** The plan with equal payments set (or taken away with `sepp: null`), for a run that changes nothing saved. */
const withSepp = (plan, sepp) => {
  const p = { ...plan, retirement: { ...(plan.retirement ?? {}) } };
  const rest = { ...(p.retirement.early ?? {}) };
  delete rest.sepp;
  if (sepp) rest.sepp = sepp;
  if (Object.keys(rest).length) p.retirement.early = rest; else delete p.retirement.early;
  return p;
};
/** Write the equal payments (the page's Save): only the five fields, each checked. A yearly amount larger than the account
 * holds is a slip and is not written (the page's box refuses it with its own words first). */
export function setSepp(draft, { accountId, startYear, method, rate, yearly = null }) {
  draft.retirement = draft.retirement ?? {};
  const r = Number(rate);
  const sepp = { accountId: String(accountId), startYear: Math.round(Number(startYear)), method: SEPP_METHODS.includes(method) ? method : "amortization", rate: Number.isFinite(r) && r > 0 && r <= SEPP_RATE_MAX ? r : SEPP_RATE_FLOOR };
  const acct = (draft.accounts ?? []).find((a) => a.id === sepp.accountId);
  if (Number(yearly) > 0 && (!acct || Number(yearly) <= countedBalance(acct))) sepp.yearly = Math.round(Number(yearly) * 100) / 100;
  draft.retirement.early = { ...(draft.retirement.early ?? {}), sepp };
  return draft;
}
/** Take the equal payments away; an `early` left empty goes too, so the plan is as it was before the page. */
export function clearSepp(draft) {
  if (!draft.retirement?.early) return draft;
  delete draft.retirement.early.sepp;
  if (!Object.keys(draft.retirement.early).length) delete draft.retirement.early;
  return draft;
}

/** One run of the plan, read for the years before 59½. Amounts in today's dollars. */
function early(plan, today) {
  const b = buildInputs(plan, { today });
  if (!b.inputs) return { ready: false, missing: b.missing ?? [] };
  const I = b.inputs, res = project(I);
  const owners = I.early?.owners ?? [];
  const lastHalf = owners.length ? Math.max(...owners.map((o) => o.halfYear)) : null;
  const years = [];
  let tax = 0, charged = 0, spared = 0, sepp = 0, roth = 0, firstCharged = null;
  for (const r of res.rows) {
    const inWindow = lastHalf !== null && r.year <= lastHalf;
    const s = (r.sepp ?? 0) / r.priceLevel;
    if (!inWindow && !(s > 0)) continue;
    const row = { year: r.year, ages: r.ages, retired: r.retired, tax: (r.earlyTax ?? 0) / r.priceLevel, charged: (r.earlyDrawn ?? 0) / r.priceLevel, spared: (r.early55 ?? 0) / r.priceLevel, sepp: s, short: r.shortfall > 0 };
    tax += row.tax; charged += row.charged; spared += row.spared; sepp += row.sepp;
    if (inWindow && r.retired) roth += r.withdrawn.free / r.priceLevel;
    if (row.tax > 0.5 && firstCharged === null) firstCharged = r.year;
    if (r.retired || row.tax > 0.5 || row.sepp > 0.5 || row.spared > 0.5) years.push(row);
  }
  const first = res.rows.find((r) => r.sepp > 0);
  return { ready: true, inputs: I, people: b.people, owners, lastHalf, years, tax, charged, spared, sepp, roth: roth > 0.5, firstCharged, failYear: res.failYear,
    seppFirst: first ? { year: first.year, yearly: first.sepp, yearlyReal: first.sepp / first.priceLevel } : null };
}

/**
 * compute(plan, { today }) -> {
 *   kind: "unknown" (the plan cannot run yet: `missing`) | "none" (no 401(k) or IRA) | "past" (every owner is past 59½)
 *       | "after" (work stops after 59½ and nothing comes out early) | "bridge" (work stops before 59½; cash and taxable
 *       savings carry the years) | "free" (pre-tax money comes out early and none of it owes the 10%) | "charged",
 *   year, retireYear, lastHalf (the last year anyone who owns pre-tax money has days before 59½),
 *   people: [{ id, index (in the run's ages), name, age, half, halfWords, retireAge, ownAge (their own age is on People), leftYear, in401, inIra }]
 *       (the adults under 59½ who own a 401(k) or IRA),
 *   tax, charged, spared (by the age-55 rule), seppPaid (paid as equal payments), all before 59½ and in today's dollars,
 *   firstCharged (year), failYear, roth (Roth money is spent in those years), kinds ("your 401(k) and IRA"),
 *   years: [{ year, ages, tax, charged, spared, sepp }],
 *   accounts: [{ id, name, balance, ownerId, ownerName, lastStart }] (those equal payments could come from),
 *   sepp: null | { accountId, name, ownerName, startYear, lastYear, method, rate, yearly (what was typed) | null, balance,
 *                  first: { year, yearly, yearlyReal } | null, past (began before this year), over5 (the rate is above 5%),
 *                  workedYear (the first year the plan pays one: the later of startYear and this year), ageAtStart and factor
 *                  (the owner's age that year and the Single Life Table's figure at it: what the plan's own sum uses),
 *                  yearlyHigh (the typed amount is more than a fifth of the account: worth a second look) },
 *   suggest: null | { accountId, name, startYear, lastYear, method, rate, yearlyReal, taxAfter } (the row's "about $X a year"),
 *   without: { tax } | null (with equal payments set: the 10% without them),
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const year = today ? Number(String(today).slice(0, 4)) : new Date().getFullYear();
  const now = early(plan, today);
  if (!now.ready) return { kind: "unknown", missing: now.missing, year, people: [], accounts: [], years: [], sepp: null, suggest: null, without: null, tax: 0, charged: 0, spared: 0 };
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent" && p.birthDate);
  const firstAdult = adults.find((p) => p.role === "self") ?? adults[0];
  const ownerOf = (a) => adults.find((p) => p.id === a.ownerId) ?? firstAdult;
  const pretax = (plan.accounts ?? []).filter((a) => RMD_ACCOUNT_TYPES.includes(a.type) && countedBalance(a) > 0);
  const I = now.inputs, retireYear = I.retireYear;
  const people = now.owners.map((o) => {
    const p = now.people[o.personIndex], adult = adults.find((a) => a.id === p.id);
    const own = pretax.filter((a) => ownerOf(a)?.id === p.id);
    return { id: p.id, index: o.personIndex, name: p.name, age: year - p.birthYear, half: { year: o.halfYear, share: o.halfShare }, halfWords: halfMonth(adult?.birthDate), retireAge: p.retireAge,
      ownAge: adult?.retirementAge != null && adult?.retirementAge !== "", leftYear: leftAt55Year(adult), at55Part: o.at55Part, year55: p.birthYear + 55,
      in401: own.filter((a) => a.type === "401k").reduce((s, a) => s + countedBalance(a), 0), inIra: own.filter((a) => a.type === "ira").reduce((s, a) => s + countedBalance(a), 0) };
  });
  const n401 = pretax.filter((a) => a.type === "401k" && people.some((p) => p.id === ownerOf(a)?.id)).length, nIra = pretax.filter((a) => a.type === "ira" && people.some((p) => p.id === ownerOf(a)?.id)).length;
  const kinds = `your ${list([n401 ? (n401 > 1 ? "401(k)s" : "401(k)") : null, nIra ? (nIra > 1 ? "IRAs" : "IRA") : null].filter(Boolean)) || "401(k) or IRA"}`;
  // the accounts equal payments could come from: a 401(k) or IRA whose owner still has a year before 59½
  const accounts = pretax.map((a) => { const o = ownerOf(a), h = halfYear(o?.birthDate); return h && h.year >= year ? { id: a.id, name: a.name || "Account", type: a.type, balance: countedBalance(a), ownerId: o.id, ownerName: o.name, lastStart: h.year, birthYear: Number(String(o.birthDate).slice(0, 4)) } : null; }).filter(Boolean);
  const set = seppOf(plan, { year });
  // the plan's own sum starts in the first year it pays one: a series that began earlier is worked from today's balance and age
  const worked = set ? Math.max(set.startYear, year) : null, ageWorked = set ? worked - Number(String(set.owner.birthDate).slice(0, 4)) : null;
  const sepp = set ? { accountId: set.accountId, name: set.account.name || "Account", ownerName: set.owner.name, startYear: set.startYear, lastYear: set.lastYear, method: set.method, rate: set.rate, yearly: set.yearly, balance: countedBalance(set.account),
    first: now.seppFirst, past: set.startYear < year, over5: set.rate > SEPP_RATE_FLOOR + 1e-9, workedYear: worked, ageAtStart: ageWorked, factor: singleLife(ageWorked),
    yearlyHigh: set.method !== "rmd" && set.startYear < year && set.yearly !== null && set.yearly > SEPP_YEARLY_CHECK * countedBalance(set.account) } : null;
  const base = { year, retireYear, lastHalf: now.lastHalf, people, kinds, tax: now.tax, charged: now.charged, spared: now.spared, seppPaid: now.sepp, firstCharged: now.firstCharged, failYear: now.failYear, roth: now.roth, years: now.years, accounts, sepp,
    retired: retireYear <= year, starter: now.people.find((p) => p.birthYear + p.retireAge === retireYear) ?? null, missing: [] };
  // with equal payments set: what the 10% would be without them (the green line and the part's own words)
  let without = null;
  if (sepp) { const w = early(withSepp(plan, null), today); if (w.ready) without = { tax: w.tax }; }
  // not set: what they would pay from the biggest account that can start by the time work stops, at 5%, the same each year
  let suggest = null;
  if (!sepp && accounts.length && people.length) {
    const startOf = (a) => Math.min(a.lastStart, Math.max(year, retireYear));
    const fits = accounts.filter((a) => retireYear <= a.lastStart).sort((a, b) => (a.type === "ira" ? 0 : 1) - (b.type === "ira" ? 0 : 1) || b.balance - a.balance);   // an IRA first: a 401(k) pays them only once that job has ended
    const a = fits[0] ?? null;
    if (a) {
      const s = { accountId: a.id, startYear: startOf(a), method: "amortization", rate: SEPP_RATE_FLOOR };
      const w = early(withSepp(plan, s), today);
      if (w.ready && w.seppFirst) suggest = { ...s, name: a.name, lastYear: seppLastYear(s.startYear, { year: a.lastStart }), yearlyReal: w.seppFirst.yearlyReal, taxAfter: w.tax };
    }
  }
  const kind = !pretax.length && !people.length ? "none" : !people.length && !sepp ? "past"
    : now.tax > 0.5 ? "charged" : now.spared + now.sepp > 0.5 ? "free" : now.lastHalf !== null && retireYear <= now.lastHalf ? "bridge" : "after";
  return { kind, ...base, without, suggest };
}

// ---- the words (docs/OPTIONAL.md R5: one written sentence per case, each with a test) ---------------------------------------
const reach = (d) => {
  const last = d.people.filter((p) => p.half.year === d.lastHalf);
  if (d.people.length === 1) return `${nameIn(d.people[0].name)} ${verbFor(d.people[0].name, "reaches", "reach")} 59½ in ${d.lastHalf}`;
  return last.length === d.people.length ? `you both reach 59½ in ${d.lastHalf}` : `${nameIn(last[0].name)} ${verbFor(last[0].name, "reaches", "reach")} 59½ in ${d.lastHalf}`;
};
const stopLead = (d) => {
  const s = d.starter;
  if (d.retired) return "Work has already stopped";
  return s ? `${NameIn(s.name)} ${verbFor(s.name, "stops", "stop")} work at ${s.retireAge}` : `Work stops in ${d.retireYear}`;
};
/** Why pre-tax money that comes out before 59½ owes no 10%: which of the two ways the plan counts spared it. */
const freeWhy = (d) => (d.spared > 0.5 && d.seppPaid > 0.5 ? "part comes as equal yearly payments, and the rest is from the 401(k) of a job left at 55 or later"
  : d.seppPaid > 0.5 ? "it comes as equal yearly payments" : "it is from the 401(k) of a job left at 55 or later");
/**
 * answerWords(d, money) -> { head, lede, also: [text] }: the headline, the one sentence under it and what follows, for the
 * case the plan is in. Amounts in today's dollars.
 */
export function answerWords(d, money = usd) {
  switch (d.kind) {
    case "unknown": return { head: "Money before 59½", lede: "Taking money out of a 401(k) or IRA before 59½ usually costs an extra 10% in tax. Once your plan can run, this page says what that comes to for you and how to avoid it.", also: [] };
    case "none": return { head: "Nothing to take out early", lede: "No 401(k) or traditional IRA is on file, so there is nothing that would owe the extra 10% tax before 59½.", also: ["If you have one, add it on Net worth."] };
    case "past": return { head: "No extra tax: past 59½", lede: "Everyone here who owns a 401(k) or IRA is past 59½, so money comes out of them with no extra 10% tax.", also: [] };
    case "after": return { head: "Nothing comes out before 59½", lede: `${stopLead(d)}, after 59½, and the plan takes nothing from ${d.kinds} before then. No extra 10% tax.`, also: [] };
    case "bridge": return { head: "No extra tax before 59½",
      lede: d.failYear !== null && d.failYear <= d.lastHalf
        ? `${stopLead(d)}. Until ${reach(d)}, the plan lives on cash and taxable savings${d.roth ? " and Roth money" : ""}, but the money runs short in ${d.failYear}.`
        : `${stopLead(d)}. Until ${reach(d)}, the plan lives on cash and taxable savings${d.roth ? " and Roth money" : ""}, and they last. No extra 10% tax.`, also: [] };
    case "free": {
      const why = freeWhy(d);
      return { head: "No extra tax before 59½", lede: `${stopLead(d)}. The plan takes ${money(d.spared + d.seppPaid)} from ${d.kinds} before 59½, and none of it owes the extra 10% tax: ${why}.`, also: ["In today's dollars."] };
    }
    default: {
      const also = [];
      if (d.firstCharged !== null && d.firstCharged > Math.max(d.year, d.retireYear)) also.push(`Cash and taxable savings last until ${d.firstCharged}.`);
      if (d.spared + d.seppPaid > 0.5) also.push(`Another ${money(d.spared + d.seppPaid)} comes out of ${d.kinds} with no extra tax: ${freeWhy(d)}.`);
      also.push("In today's dollars.");
      return { head: `About ${money(d.tax)} of extra tax before 59½`, lede: `The plan takes ${money(d.charged)} from ${d.kinds} before 59½; the extra 10% tax costs about ${money(d.tax)}.`, also };
    }
  }
}

/** The row "Leave your job in or after the year you turn 55": what it means for the first person it could help. */
export function at55Words(d, money = usd) {
  const p = d.people.find((x) => x.in401 > 0) ?? null;
  if (!p) return "No 401(k) is on file for anyone under 59½. It never covers an IRA.";
  if (d.kind === "after") return "That job's 401(k) then owes no extra tax. It never covers an IRA.";
  const whose = nameOf(p.name);
  if (p.leftYear !== null && p.at55Part > 0) return `Counted: ${nameIn(p.name)} ${verbFor(p.name, "stops", "stop")} work at ${p.retireAge}, so ${whose} 401(k) owes none of it. It never covers an IRA.`;
  if (!p.ownAge) return `Not counted yet: put ${whose} own retirement age on People, and the plan spares ${whose} 401(k) when it is 55 or more.`;
  if (p.retireAge >= 55) return "That job's 401(k) then owes no extra tax. It never covers an IRA.";
  // work stops before the year they turn 55: the rule does not reach this job's 401(k) at any later age (IRC 72(t)(2)(A)(v))
  return `No help as planned: ${nameIn(p.name)} ${verbFor(p.name, "stops", "stop")} work at ${p.retireAge}, before ${p.year55}, the year ${nameIn(p.name)} ${verbFor(p.name, "turns", "turn")} 55. Stopping in ${p.year55} or later would spare ${whose} 401(k) (${money(p.in401)} today). It never covers an IRA.`;
}
/** The row "Equal yearly payments": the figure, or what it is while there is none to show. */
export function equalWords(d, money = usd) {
  if (d.sepp) return d.sepp.first ? `Counted: about ${money(d.sepp.first.yearlyReal)} a year from ${acctWords(d.sepp.name)}, ${d.sepp.first.year} to ${d.sepp.lastYear}.` : `Counted from ${acctWords(d.sepp.name)}, ${d.sepp.startYear} to ${d.sepp.lastYear}.`;
  if (d.suggest) return `About ${money(d.suggest.yearlyReal)} a year from ${acctWords(d.suggest.name)}, with no extra tax. Not counted yet.`;
  return "A set amount out of one 401(k) or IRA every year, with no extra tax.";
}
/**
 * The rule that the payments must go on (IRC 72(t)(4)): to the later of five years from the first one and 59½; changed or
 * stopped sooner, the 10% comes back on every payment already made, with interest.
 */
export function ruleWords(sp) {
  const who = isYou(sp.ownerName) ? "you reach" : `${nameIn(sp.ownerName)} reaches`;
  const how = sp.method === "rmd" ? "worked out the same way every year" : "the same amount every year";
  return `Once they start, the payments must go on, ${how}, through ${sp.lastYear}: the later of five years and the day ${who} 59½. Stop or change them sooner and the extra 10% comes back on every payment already made, with interest.`;
}
/**
 * How one year's payment is worked out, with the person's own figures. The age and the years of life left are those of the
 * first year the plan pays one (`workedYear`): for a series that began in an earlier year with no amount typed, that is this
 * year, and the words say the plan's figure is its own, not the one fixed back then.
 */
export function methodWords(sp, money = usd) {
  const pay = sp.first ? ` ${money(sp.first.yearly)} in ${sp.first.year}.` : "";
  const sum = `the yearly amount that would use the account up over ${sp.factor} years (the tax tables' years of life left at ${sp.ageAtStart}) if it earned ${Number((sp.rate * 100).toFixed(2))}% a year`;
  if (sp.method === "rmd") return `Each year: what the account holds, divided by the tax tables' years of life left at that age (${sp.factor} at ${sp.ageAtStart}). It moves with the account.${pay}`;
  if (sp.past && sp.yearly) return `The same every year: the ${money(sp.yearly)} you typed.`;
  if (sp.past) return `These payments began in ${sp.startYear}, and the amount fixed then is not on file. Until you type it below, the plan uses its own figure from what the account holds today: ${sum}.${pay}`;
  return `Set once, in ${sp.startYear}, and never changed: ${sum}.${pay}`;
}
/** A typed yearly amount above a fifth of the account (compute `yearlyHigh`): what to check, or null. */
export const yearlyCheckWords = (sp, money = usd) => (sp?.yearlyHigh ? `${money(sp.yearly)} a year is more than a fifth of the ${money(sp.balance)} this account holds, so it would be empty in about ${Math.max(1, Math.round(sp.balance / sp.yearly))} years. Check the figure against your own records.` : null);
const taxMove = (was, now, money) => (was > 0.5 && now > 0.5 ? (Math.abs(was - now) < 0.5 ? `The extra 10% tax before 59½ stays about ${money(now)}.` : `The extra 10% tax before 59½ ${now < was ? "falls" : "rises"} from about ${money(was)} to about ${money(now)}.`)
  : was > 0.5 ? `The extra 10% tax before 59½ falls from about ${money(was)} to nothing.` : now > 0.5 ? `The extra 10% tax before 59½ is now about ${money(now)}.` : "No extra 10% tax before 59½ either way.");
/** The green line after a save (R7): what the plan now counts, and what it did to the 10% (`before`, `after`: compute()). */
export function savedWords(before, after, money = usd) {
  const sp = after.sepp;
  if (!sp) return `Removed. The plan no longer counts equal payments. ${taxMove(before.tax, after.tax, money)}`;
  const pay = sp.first ? `about ${money(sp.first.yearlyReal)} a year from ${acctWords(sp.name)}, ${sp.first.year} to ${sp.lastYear}` : `equal payments from ${acctWords(sp.name)}, ${sp.startYear} to ${sp.lastYear}`;
  return `Saved. The plan now takes ${pay}. ${taxMove(before.tax, after.tax, money)}`;
}
export { EARLY_RATE, cap };

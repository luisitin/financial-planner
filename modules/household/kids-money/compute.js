// modules/household/kids-money/compute.js -- PURE. Children's money (gap list, next 60, item 57; map U10): each child's
// allowance and what it is meant to cover, the money the child holds of their own (a jar, a kids' bank account, a custodial
// account in the child's name), what that could become by 18, and the lines "Add allowances to spending" writes on Expenses.
// Formulas and sources: README.md. Every sentence the page says is written here, one per case, so a test can read it.
//
// The child's figures are optional fields on the person (`household.people[].childMoney`), read by no other page: they are
// the child's, never in Net worth or the budget. Only "Add allowances to spending" (asked first, with Undo) puts the
// allowances on Expenses, as ordinary bills with the id `kids-money-<child id>`.
import { ageOn, dateAtAge, monthsBetween } from "../../../core/math/dates.js";
import { perMonth } from "../../../core/math/periods.js";
import { yearsMonthsWords } from "../../../core/format.js";

/** How often an allowance can be paid (core/math/periods.js keys) and how a sentence says it. */
export const PERIODS = ["weekly", "biweekly", "monthly"];
export const EVERY = { weekly: "every week", biweekly: "every two weeks", monthly: "a month" };
/** The three places a child's own money can be, in the order the form asks. */
export const PLACES = [
  { key: "jar", label: "In a savings jar or piggy bank", short: "in a jar" },
  { key: "bank", label: "In a kids' bank account", short: "in a bank account" },
  { key: "custodial", label: "In a custodial account", short: "in a custodial account" },
];
/** "Growing it": the share of the allowance saved (chips) and what the savings earn (chips; the two rates are the plan's
 * own Assumptions, so no current figure is claimed here). Absent: half, a savings account. */
export const SHARES = [{ value: 0, label: "None" }, { value: 0.25, label: "A quarter" }, { value: 0.5, label: "Half" }, { value: 1, label: "All of it" }];
export const SHARE_WORDS = { 0: "none", 0.25: "a quarter", 0.5: "half", 1: "all" };
export const GROWS = ["jar", "savings", "stocks"];
export const DEFAULT_PICK = { share: 0.5, grow: "savings" };
/** The kiddie tax for 2026, read at irs.gov on 2026-11-16: the amount in IRC 1(g)(4)(A)(ii)(I) is $1,350 (Rev. Proc. 2025-32,
 * section 4.02), and a child's unearned income over twice that, $2,700, is taxed on Form 8615 (IRS Topic 553). The amount
 * is the standard deduction's figure for a dependent "as adjusted for inflation", so it is compared in today's dollars. */
export const KIDDIE = {
  year: 2026, amount: 1350, threshold: 2700, readOn: "2026-11-16",
  sources: [
    { title: "Rev. Proc. 2025-32, section 4.02 (unearned income of minor children subject to the kiddie tax)", url: "https://www.irs.gov/pub/irs-drop/rp-25-32.pdf" },
    { title: "Topic no. 553, Tax on a child's investment and other unearned income (kiddie tax)", url: "https://www.irs.gov/taxtopics/tc553" },
  ],
};
/** The Expenses line "Add allowances to spending" writes for a child. */
export const EXPENSE_PREFIX = "kids-money-";
export const COVERS_MAX = 120;
export const ADULT_AGE = 18;

const isObj = (x) => !!x && typeof x === "object" && !Array.isArray(x);
const amount = (v) => { if (v === null || v === undefined || v === "") return 0; const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
const finite = (v, dflt) => (v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : dflt);
/** A yearly rate read from Assumptions: a number above -100% (at or below it, money or prices would vanish), else the default. */
const rateOf = (v, dflt) => { const n = finite(v, dflt); return n > -1 ? n : dflt; };
const nameOfKid = (p) => String(p?.name ?? "").trim() || "Your child";
const poss = (name) => `${name}'s`;
/** "Leo", "Leo and Ana", "Leo, Ana and Sam". */
export const listWords = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const pctWords = (x) => `${Number((x * 100).toFixed(1))}%`;
const lowerFirst = (s) => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

/** A child's stored money, read with defaults: every amount a number of 0 or more, the period one of PERIODS (monthly when
 * missing or unknown), what it covers as typed (trimmed, at most COVERS_MAX characters). */
export function moneyOf(person) {
  const m = isObj(person?.childMoney) ? person.childMoney : {};
  const allowance = amount(m.allowance);
  const period = PERIODS.includes(m.period) ? m.period : "monthly";
  const covers = typeof m.covers === "string" ? m.covers.replace(/\s+/g, " ").trim().slice(0, COVERS_MAX) : "";
  return { allowance, period, covers, jar: amount(m.jar), bank: amount(m.bank), custodial: amount(m.custodial) };
}
/** The allowance a month: amount x times a year / 12 (core/math/periods.js). */
export const monthlyOf = (money) => (money.allowance > 0 ? perMonth(money.allowance, money.period) : 0);
/** What the child holds: jar + bank + custodial. */
export const ownOf = (money) => money.jar + money.bank + money.custodial;
/** Whole months from today to the 18th birthday, never below 0; null without a birth date or a day. */
export function monthsTo18(birthDate, today) {
  if (!birthDate || !today) return null;
  const d18 = dateAtAge(birthDate, ADULT_AGE);
  const m = d18 ? monthsBetween(today, d18) : null;
  return m === null ? null : Math.max(0, m);
}

/**
 * childrenOf(plan, today) -> { kids: [{ id, name, birthDate, age }], older: [{ id, name, age }] }: the dependents on People
 * under 18 or with no birth date (a child), and those 18 or over (not listed here). Adults (Me, Partner) are never children.
 */
export function childrenOf(plan, today = null) {
  const people = Array.isArray(plan?.household?.people) ? plan.household.people : [];
  const kids = [], older = [];
  for (const p of people) {
    if (!isObj(p) || p.role !== "dependent") continue;
    const birthDate = typeof p.birthDate === "string" && p.birthDate ? p.birthDate : null;
    const age = today && birthDate ? ageOn(birthDate, today) : null;
    const x = { id: p.id, name: nameOfKid(p), birthDate, age };
    if (age !== null && age >= ADULT_AGE) older.push(x); else kids.push(x);
  }
  return { kids, older };
}

/**
 * grow({ now, monthly, share, rate, inflation, months }) -> { value, monthlyIn, realRate, monthlyRate }: what the child's
 * money becomes in `months`, in today's dollars. The yearly rate counted is the rate picked less the rise in prices,
 * rr = (1 + rate) / (1 + inflation) - 1, monthly rm = (1 + rr)^(1/12) - 1; the share of the allowance saved, S = monthly x
 * share, goes in at the end of each month (it rises with prices, so it is the same in today's dollars):
 *   V = now (1 + rm)^n + S ((1 + rm)^n - 1) / rm,   or now + S n when rm = 0.
 */
export function grow({ now = 0, monthly = 0, share = 0, rate = 0, inflation = 0, months = 0 } = {}) {
  const realRate = (1 + rate) / (1 + inflation) - 1;
  const monthlyRate = Math.pow(1 + realRate, 1 / 12) - 1;
  const monthlyIn = monthly * share;
  const n = Math.max(0, months);
  const g = Math.pow(1 + monthlyRate, n);
  const value = Math.abs(monthlyRate) < 1e-12 ? now + monthlyIn * n : now * g + monthlyIn * (g - 1) / monthlyRate;
  return { value, monthlyIn, realRate, monthlyRate };
}

/**
 * kiddieAge({ custodial, rate, inflation, age, months }) -> { age, now } | null: the first age at which a custodial account,
 * growing at the rate picked less the rise in prices with nothing added, earns `KIDDIE.threshold` in a year (its value at the
 * start of that year times the rate), in the years before 18. Null when it never does (or nothing earns).
 */
export function kiddieAge({ custodial = 0, rate = 0, inflation = 0, age = null, months = null } = {}) {
  if (!(custodial > 0) || !(rate > 0) || age === null || months === null) return null;
  const rr = (1 + rate) / (1 + inflation) - 1;
  const from = Math.max(0, age);
  for (let k = 0; k * 12 < Math.max(months, 1); k++) {
    if (custodial * Math.pow(1 + rr, k) * rate >= KIDDIE.threshold) return { age: from + k, now: k === 0 };
  }
  return null;
}

/** The "Growing it" picks (whatIfs.kidsMoney), read with defaults, and the rates they mean in this plan. picked: the person
 * tapped a chip (the picks are stored); else both are our guess (half, a savings account). A rate or a rise in prices at or
 * below -100% (only an imported plan can hold one: Assumptions refuses it) reads as the default. */
export function pickOf(plan) {
  const w = isObj(plan?.whatIfs?.kidsMoney) ? plan.whatIfs.kidsMoney : {};
  const okShare = SHARES.some((s) => s.value === w.share), okGrow = GROWS.includes(w.grow);
  const share = okShare ? w.share : DEFAULT_PICK.share;
  const growKey = okGrow ? w.grow : DEFAULT_PICK.grow;
  const a = isObj(plan?.assumptions) ? plan.assumptions : {};
  const rates = { jar: 0, savings: rateOf(a.returnCash, 0.02), stocks: rateOf(a.returnStocks, 0.07) };
  return { share, grow: growKey, rate: rates[growKey], rates, inflation: rateOf(a.inflation, 0.03), picked: okShare || okGrow };
}

/** Words in a bill's name that say it is an allowance (a line typed by hand on Expenses, not one this page wrote). */
export const ALLOWANCE_WORDS = /\b(allowances?|pocket[ -]?money)\b/i;

/**
 * spendingOf(plan, kids, today) -> { rows, todo, monthly, allNew, onlyEnds, lookalike }: the Expenses lines "Add allowances to
 * spending" would write. rows: one per listed child with an allowance ({ state: "new" } with no line yet, "same" when the
 * line's amount and period are the allowance's and, when the 18th birthday is known, it ends on it; "differs" when not, with
 * `why` "amount" or "end") and one per listed child with no allowance whose line is still there ("remove"). todo: the rows that
 * are not "same". monthly: the allowances a month once written. onlyEnds: every row to do differs only in its end date.
 * lookalike: the other bills on Expenses (typed by hand, not ended before today) whose name says allowance or pocket money,
 * [{ id, name }]: if one is the same money, adding this page's line would count it twice, so the page says so first. A child
 * no longer listed (18, or taken off People) keeps their line: it is the household's bill now.
 */
export function spendingOf(plan, kids, today = null) {
  const all = (Array.isArray(plan?.expenses) ? plan.expenses : []).filter((x) => isObj(x));
  const lines = new Map(all.filter((x) => typeof x.id === "string").map((x) => [x.id, x]));
  const rows = [];
  for (const k of kids) {
    const expenseId = `${EXPENSE_PREFIX}${k.id}`;
    const line = lines.get(expenseId) ?? null;
    if (k.money.allowance > 0) {
      const endDate = k.birthDate ? dateAtAge(k.birthDate, ADULT_AGE) : null;
      const sameAmount = !!line && Number(line.amount) === k.money.allowance && line.period === k.money.period;
      const sameEnd = !line || !endDate || line.endDate === endDate;   // no birth date: the page has no better day, the line keeps its own
      rows.push({ childId: k.id, childName: k.name, expenseId, name: `${poss(k.name)} allowance`, amount: k.money.allowance, period: k.money.period, monthly: k.monthly,
        endDate, state: !line ? "new" : sameAmount && sameEnd ? "same" : "differs", ...(line && !(sameAmount && sameEnd) ? { why: sameAmount ? "end" : "amount" } : {}) });
    } else if (line) rows.push({ childId: k.id, childName: k.name, expenseId, name: line.name ?? `${poss(k.name)} allowance`, amount: 0, period: k.money.period, monthly: 0, endDate: null, state: "remove" });
  }
  const todo = rows.filter((r) => r.state !== "same");
  const lookalike = rows.some((r) => r.state !== "remove")
    ? all.filter((x) => !String(x.id ?? "").startsWith(EXPENSE_PREFIX) && ALLOWANCE_WORDS.test(String(x.name ?? "")) && !(today && typeof x.endDate === "string" && x.endDate && x.endDate < today))
      .map((x) => ({ id: x.id ?? null, name: String(x.name).replace(/\s+/g, " ").trim() }))
    : [];
  return { rows, todo, monthly: rows.reduce((t, r) => t + r.monthly, 0), allNew: todo.length > 0 && todo.every((r) => r.state === "new"),
    onlyEnds: todo.length > 0 && todo.every((r) => r.why === "end"), lookalike };
}

/**
 * applySpending(draft, spending): writes the `todo` rows on Expenses: a new line (category "other", not a must-pay bill,
 * rising with prices, ending at the 18th birthday when known), a changed amount and period on a line that is there, a line
 * taken off for a child whose allowance was cleared. Mutates the draft; the view calls it inside ui.undoable.
 */
export function applySpending(draft, spending) {
  draft.expenses = Array.isArray(draft.expenses) ? draft.expenses : [];
  for (const r of spending.todo) {
    const i = draft.expenses.findIndex((x) => isObj(x) && x.id === r.expenseId);
    if (r.state === "remove") { if (i >= 0) draft.expenses.splice(i, 1); continue; }
    if (i < 0) {
      draft.expenses.push({ id: r.expenseId, name: r.name, category: "other", amount: r.amount, period: r.period, inflates: true, essential: false, ...(r.endDate ? { endDate: r.endDate } : {}) });
    } else {
      const x = draft.expenses[i];
      x.amount = r.amount; x.period = r.period;
      if (r.endDate) x.endDate = r.endDate;   // the 18th birthday when known; with no birth date the line keeps its own end
    }
  }
}

/**
 * cleanMoney(values) -> the `childMoney` to store, or null when nothing is left: amounts above 0 kept (an empty box or 0
 * removes its key), the period kept with an allowance (monthly when missing, as moneyOf reads it, so a stored allowance with
 * no period cleans to what the form shows), what it covers trimmed to COVERS_MAX.
 */
export function cleanMoney(v = {}) {
  const out = {};
  const allowance = amount(v.allowance);
  if (allowance > 0) { out.allowance = allowance; out.period = PERIODS.includes(v.period) ? v.period : "monthly"; }
  const covers = typeof v.covers === "string" ? v.covers.replace(/\s+/g, " ").trim().slice(0, COVERS_MAX) : "";
  if (covers) out.covers = covers;
  for (const p of PLACES) { const n = amount(v[p.key]); if (n > 0) out[p.key] = n; }
  return Object.keys(out).length ? out : null;
}

/**
 * compute(plan, { today }) -> {
 *   case: "none" (no dependent) | "older" (dependents, all 18 or over) | "start" (children, nothing typed) | "set",
 *   kids: [{ id, name, birthDate, age, money, monthly, own, hasAny, hasMoney, months18, grow: { value, monthlyIn, realRate } | null, kiddie }],
 *   older: [{ id, name, age }], totals: { monthly, own, custodial, withAllowance, withSaved },
 *   pick: { share, grow, rate, rates, inflation, picked }, spending: spendingOf(), growing, kiddie: [{ name, age, now }], kiddieRule: KIDDIE
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const { kids: listed, older } = childrenOf(plan, today);
  const people = Array.isArray(plan?.household?.people) ? plan.household.people : [];
  const pick = pickOf(plan);
  const kids = listed.map((k) => {
    const money = moneyOf(people.find((p) => isObj(p) && p.id === k.id));
    const monthly = monthlyOf(money), own = ownOf(money);
    const months18 = monthsTo18(k.birthDate, today);
    const g = months18 === null ? null : grow({ now: own, monthly, share: pick.share, rate: pick.rate, inflation: pick.inflation, months: months18 });
    const kiddie = months18 === null ? null : kiddieAge({ custodial: money.custodial, rate: pick.rate, inflation: pick.inflation, age: k.age, months: months18 });
    return { ...k, money, monthly, own, hasAny: monthly > 0 || own > 0 || !!money.covers, hasMoney: monthly > 0 || own > 0, months18,
      grow: g ? { value: g.value, monthlyIn: g.monthlyIn, realRate: g.realRate } : null, kiddie };
  });
  const sum = (f) => kids.reduce((t, k) => t + f(k), 0);
  const totals = { monthly: sum((k) => k.monthly), own: sum((k) => k.own), custodial: sum((k) => k.money.custodial),
    withAllowance: kids.filter((k) => k.monthly > 0).length, withSaved: kids.filter((k) => k.own > 0).length };
  const c = !kids.length ? (older.length ? "older" : "none") : kids.some((k) => k.hasAny) ? "set" : "start";
  return {
    case: c, kids, older, totals, pick, spending: spendingOf(plan, kids, today),
    // "Growing it" shows once a child with a birth date has an allowance or money of their own (not only what it covers)
    growing: kids.some((k) => k.grow && k.hasMoney),
    kiddie: kids.filter((k) => k.kiddie).map((k) => ({ name: k.name, age: k.kiddie.age, now: k.kiddie.now })), kiddieRule: KIDDIE,
  };
}

// ---------------------------------------------------------------- the words, one sentence per case (R5)
export const HEAD = "Children's money";
/** The sentence under the page's name, for each case. */
export function answerFor(d, money) {
  if (d.case === "none") return { head: HEAD, say: "This page is for families with children: each child's allowance and the money they have of their own. First add your child on People: where it asks “Who is this”, choose “Dependent”, the choice for a child you support." };
  if (d.case === "older") return { head: HEAD, say: "This page is for children under 18, and everyone in your plan is 18 or older. To add your child, go to People and choose “Dependent” where it asks “Who is this”." };
  if (d.case === "start") {
    const [first, ...rest] = d.kids.map((k) => k.name);
    return { head: HEAD, say: `Start with ${poss(first)} allowance: how much, how often and what it is meant to cover. What ${first} has saved goes in the same place.${rest.length ? ` Then the same for ${listWords(rest)}.` : ""}` };
  }
  const t = d.totals;
  const withA = d.kids.filter((k) => k.monthly > 0), withS = d.kids.filter((k) => k.own > 0);
  const allow = withA.length === 1 ? `${poss(withA[0].name)} allowance comes to ${money(t.monthly)} a month` : `Allowances come to ${money(t.monthly)} a month`;
  const saved = withS.length === 1 ? `${withS[0].name} has ${money(t.own)} saved` : `the children have ${money(t.own)} saved`;
  if (withA.length && withS.length) return { head: HEAD, say: `${allow}, and ${saved}.` };
  if (withA.length) return { head: HEAD, say: `${allow}.` };
  if (withS.length) return { head: HEAD, say: `${saved[0].toUpperCase()}${saved.slice(1)}. No allowance is set.` };
  return { head: HEAD, say: "No allowance is set and nothing saved is typed yet. Tap a child to add it." };   // only what it covers typed
}
/** The quiet line for dependents not listed (18 or over), or null. */
export function olderLine(d) {
  if (!d.older.length || !d.kids.length) return null;
  return `Not listed: ${listWords(d.older.map((o) => `${o.name} (${o.age})`))}. This page is for children under 18.`;
}
/** One child's row: { title, value, lines: [text], action }. */
export function rowWords(k, money) {
  const title = k.age === null ? `${k.name}, age not known` : k.age < 0 ? `${k.name}, not born yet` : `${k.name}, ${k.age}`;
  const m = k.money;
  const value = k.monthly > 0 ? `${money(k.monthly)} a month` : "No allowance";
  const lines = [];
  const paid = k.monthly > 0 && m.period !== "monthly" ? `${money(m.allowance)} ${EVERY[m.period]}` : null;
  const covers = m.covers ? `for ${lowerFirst(m.covers)}` : null;
  if (paid || covers) lines.push([paid, covers].filter(Boolean).join(" · "));
  lines.push(savedWords(m, k.own, money));
  // one word for one job: "Set allowance" (the start button's words) until something is typed, then "Change"
  return { title, value, lines, action: k.hasAny ? "Change" : "Set allowance", aria: k.hasAny ? `Change ${poss(k.name)} money` : `Set ${poss(k.name)} allowance` };
}
/** "$340 saved: $40 in a jar, $300 in a bank account", "$300 saved in a bank account", "Nothing saved yet". */
export function savedWords(m, own, money) {
  if (!(own > 0)) return "Nothing saved yet";
  const parts = PLACES.filter((p) => m[p.key] > 0).map((p) => `${money(m[p.key])} ${p.short}`);
  return parts.length === 1 ? `${money(own)} saved ${PLACES.find((p) => m[p.key] > 0).short}` : `${money(own)} saved: ${parts.join(", ")}`;
}
/** The green line after a child's form is saved (R7: it names what the row now says). */
export function savedLine(k, money) {
  if (!k || !k.hasAny) return `Saved. Nothing is set for ${k?.name ?? "this child"} now.`;
  const allow = `${poss(k.name)} allowance comes to ${money(k.monthly)} a month`;
  if (k.monthly > 0 && k.own > 0) return `Saved. ${allow}, and ${k.name} has ${money(k.own)} saved.`;
  if (k.monthly > 0) return `Saved. ${allow}. No savings entered yet.`;
  if (k.own > 0) return `Saved. ${k.name} has ${money(k.own)} saved. No allowance entered yet.`;
  return `Saved: what ${poss(k.name)} allowance is meant to cover. No amount entered yet.`;
}
export const undoneLine = (name) => `${poss(name)} money is back as it was.`;
/** The one line on who owns a custodial account (shown when any child has one). */
export const CUSTODIAL_LINE = "Money in a custodial account belongs to the child: you manage it for them until the age your state sets, and then it is theirs.";
export const CUSTODIAL_HELP = (name) => `It belongs to ${name}: you manage it until the age your state sets, then it is ${poss(name)}.`;

/** The bills typed by hand on Expenses that look like an allowance, by name: “A”, “A” and “B”, “A”, “B” and 2 more. */
const lookalikeWords = (xs) => (xs.length <= 2 ? listWords(xs.map((x) => `“${x.name}”`)) : `${xs.slice(0, 2).map((x) => `“${x.name}”`).join(", ")} and ${xs.length - 2} more`);
/** When Expenses already has a bill that looks like an allowance (never count one allowance twice), the words that say so:
 * before adding ("Expenses already has “Allowance”. If that is this allowance, ..."), or once this page's lines are there
 * ("Expenses also has ..."); "" when there is none. */
function twiceWords(s, added) {
  if (!s.lookalike?.length) return "";
  const these = lookalikeWords(s.lookalike), one = s.lookalike.length === 1;
  if (added) return `Expenses also has ${these}: if ${one ? "that is" : "those are"} the same money, your budget counts it twice.`;
  const partial = s.rows.some((r) => r.state === "same"), names = s.todo.map((r) => r.childName);
  const what = names.length === 1 ? (partial ? `${poss(names[0])} allowance` : "this allowance") : (partial ? `${listWords(names.map(poss))} allowances` : "these allowances");
  return `Expenses already has ${these}. If ${one ? "that is" : "those are"} ${what}, your budget counts ${names.length === 1 ? "it" : "them"} already, and adding ${names.length === 1 ? "it" : "them"} here would count ${names.length === 1 ? "it" : "them"} twice.`;
}
const plus = (a, b) => (b ? `${a} ${b}` : a);
/** The spending line and its button: { text, button | null } or null when no allowance is set or was added. */
export function spendLine(d) {
  const s = d.spending;
  if (!s.rows.length) return null;
  if (!s.todo.length) return { text: plus(s.rows.length === 1 ? "This allowance is counted in your spending (Expenses)." : "These allowances are counted in your spending (Expenses).", twiceWords(s, true)), button: null };
  const button = s.allNew ? (s.todo.length === 1 ? "Add the allowance to spending" : "Add allowances to spending") : "Update allowances in spending";
  // a bill that looks like the same allowance: its words take the place of "does not count", which may not be true then
  if (s.allNew && s.lookalike?.length) return { text: twiceWords(s, false), button };
  if (s.allNew && s.rows.some((r) => r.state === "same")) {
    const names = s.todo.map((r) => poss(r.childName));
    return { text: `Your budget does not count ${listWords(names)} allowance${names.length === 1 ? "" : "s"} yet.`, button };
  }
  if (s.allNew) return { text: s.todo.length === 1 ? "Your budget does not count this allowance until you add it." : "Your budget does not count these allowances until you add them.", button };
  if (s.onlyEnds) return { text: plus(`${s.todo.length === 1 ? `${poss(s.todo[0].childName)} allowance on Expenses ends` : "The allowances on Expenses end"} on another day than the 18th birthday.`, twiceWords(s, true)), button };
  return { text: plus("Your spending on Expenses has other allowance amounts than these.", twiceWords(s, true)), button };
}
/** What the confirm asks before the lines are written. */
export function spendConfirm(d, money) {
  const s = d.spending;
  const adds = s.todo.filter((r) => r.state !== "remove");
  const ends = adds.length && adds.every((r) => r.endDate) ? ` ${adds.length === 1 ? "It stops" : "Each stops"} at the 18th birthday.` : "";
  // a bill on Expenses that looks like the same allowance is named first, before the question (M1)
  const warn = s.allNew && s.lookalike?.length ? `${twiceWords(s, false)} ` : "";
  if (s.allNew && adds.length === 1) return `${warn}Add ${adds[0].name}, ${money(adds[0].monthly)} a month, to your spending on Expenses? Your budget and the other pages will count it from now on.${ends}`;
  if (s.allNew) return `${warn}Add ${adds.length} allowances, ${money(adds.reduce((t, r) => t + r.monthly, 0))} a month in all, to your spending on Expenses? Your budget and the other pages will count them from now on.${ends}`;
  if (s.onlyEnds) return `Make ${listWords(s.todo.map((r) => poss(r.childName)))} allowance${s.todo.length === 1 ? "" : "s"} on Expenses stop at the 18th birthday?`;
  const gone = s.todo.filter((r) => r.state === "remove").map((r) => r.name);
  return `Update the allowances on Expenses to ${money(s.monthly)} a month in all?${gone.length ? ` ${listWords(gone)} ${gone.length === 1 ? "comes" : "come"} off.` : ""}`;
}
/** The green line after they are written. */
export function spendDone(d, money) {
  const s = d.spending;
  const adds = s.todo.filter((r) => r.state !== "remove");
  if (s.allNew && adds.length === 1) return `Added to your spending on Expenses: ${adds[0].name}, ${money(adds[0].monthly)} a month.`;
  if (s.allNew) return `Added to your spending on Expenses: ${adds.length} allowances, ${money(adds.reduce((t, r) => t + r.monthly, 0))} a month in all.`;
  if (s.onlyEnds) return `Updated on Expenses: ${listWords(s.todo.map((r) => poss(r.childName)))} allowance${s.todo.length === 1 ? " now stops" : "s now stop"} at the 18th birthday.`;
  return `Updated on Expenses: allowances now come to ${money(s.monthly)} a month.`;
}
export const SPEND_UNDONE = "Taken back: your spending is as it was.";

/** "Growing it"'s status: the two picks, "half, at 7%" once the person tapped a chip; before that "half, 2%", which the view
 * passes with `guess: 1`, so the part reads "our guess · half, 2%" (R26; only "our guess" when both do not fit 20 characters). */
export const growStatus = (pick) => `${SHARE_WORDS[pick.share] ?? "half"}, ${pick.picked ? "at " : ""}${pctWords(pick.rate)}`;
/** The rate chips' labels, with the plan's own figures. */
export const growLabels = (pick) => ({ jar: "A jar: 0%", savings: `A savings account: ${pctWords(pick.rates.savings)}`, stocks: `A stock fund: ${pctWords(pick.rates.stocks)}` });
export const GROW_INTRO = "What each child's money could become by 18 if they save part of their allowance, in today's dollars.";
export const GROW_EXAMPLE = "For example only: the savings and stock figures are the ones on Assumptions, and a stock fund can fall as well as rise.";
/** One child's line under "Growing it": { title, sub }. */
export function growLine(k, money) {
  if (!k.grow) return { title: `${k.name}: add a birth date on People to see this.`, sub: null };
  if (!(k.monthly > 0 || k.own > 0)) return { title: `${k.name}: no allowance or savings entered yet.`, sub: null };
  if (k.months18 === 0) return { title: `${k.name}: about ${money(k.grow.value)} at 18`, sub: `18 this month: ${money(k.own)} now` };
  const when = `in ${yearsMonthsWords(k.months18)}`;
  const parts = [k.own > 0 ? `${money(k.own)} now` : null, k.grow.monthlyIn > 0 ? `${money(k.grow.monthlyIn)} a month saved` : null].filter(Boolean);
  return { title: `${k.name}: about ${money(k.grow.value)} by 18`, sub: `${when}: ${parts.length ? parts.join(" and ") : "nothing now and nothing saved"}, in today's dollars` };
}
/** The kiddie tax line, only when a custodial account could earn the 2026 threshold in a year before 18; else null. */
export function kiddieLine(d, money) {
  if (!d.kiddie.length) return null;
  const fact = `The kiddie tax: in ${KIDDIE.year}, a child's interest, dividends and gains over ${money(KIDDIE.threshold)} a year can be taxed at your rate instead of the child's (IRS).`;
  if (d.kiddie.length === 1) {
    const x = d.kiddie[0];
    return `${fact} ${poss(x.name)} custodial account ${x.now ? "could earn that much this year" : `could earn that much by age ${x.age}`}, at the rate picked.`;
  }
  return `${fact} ${listWords(d.kiddie.map((x) => poss(x.name)))} custodial accounts could earn that much before 18, at the rate picked.`;
}
/** "How this is worked out": the sums with the household's own numbers, and where the tax figure comes from. */
export function howSteps(d, money) {
  const p = d.pick;
  const out = [];
  const weekly = d.kids.find((k) => k.monthly > 0 && k.money.period !== "monthly");
  out.push(`An allowance a month: one paid every week is times 52 and divided by 12, one every two weeks times 26 and divided by 12.${weekly ? ` ${weekly.name}: ${money(weekly.money.allowance)} × ${weekly.money.period === "weekly" ? 52 : 26} ÷ 12 = ${money(weekly.monthly)}.` : ""}`);
  const ex = d.kids.find((k) => k.grow && (k.monthly > 0 || k.own > 0) && k.months18 > 0);
  out.push(`By 18: what a child has now grows each month at the rate picked, ${pctWords(p.rate)} a year, and ${SHARE_WORDS[p.share]} of the allowance is saved at the end of each month until the 18th birthday.${ex ? ` ${ex.name}: ${money(ex.own)} now and ${money(ex.grow.monthlyIn)} a month for ${yearsMonthsWords(ex.months18)} comes to about ${money(ex.grow.value)}.` : ""}`);
  const rr = (1 + p.rate) / (1 + p.inflation) - 1;
  out.push(`In today's dollars: prices are taken to rise ${pctWords(p.inflation)} a year (Assumptions), so ${rr >= 0 ? `the growth counted is about ${pctWords(rr)} a year after prices` : `money that earns ${pctWords(p.rate)} buys about ${pctWords(-rr)} less each year`}. The allowance is taken to rise with prices.`);
  out.push(`The kiddie tax line: the IRS sets ${money(KIDDIE.amount)} for ${KIDDIE.year}, and a child's interest, dividends and gains over twice that, ${money(KIDDIE.threshold)} a year, are taxed on Form 8615 (IRS Topic 553 and Rev. Proc. 2025-32, read November 2026). It shows when a custodial account, growing at the rate picked with nothing added, could earn that much in a year before 18.`);
  out.push("This money is the child's, so no total in your plan counts it: not Net worth, and not your budget until you add the allowances to spending.");
  return out;
}

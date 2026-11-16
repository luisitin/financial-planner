// modules/property/rental/books.js -- PURE. A rental's books for one tax year from the person's own bank lines, laid out like
// Schedule E (Form 1040) Part I, for a tax preparer (gap list, next 60, item 20; map V1). Information, not a filing.
//   - A line is the rental's when it carries the rental's name as a tag (transactions[].tags, gap #24: "condo" for Condo,
//     "unit 1" for Unit #1; letter case, spaces and dashes aside; two rentals whose names give one tag get "unit 1" and
//     "unit 1 2"). With one rental, the tag "rental" and the category "Rent you collect" (income-rental) tie a line to it
//     too. No new plan field: tags already exist, and a rule can add one.
//   - Each tied line goes to a line of the form by its category (LINES, lineFor): money in under an income category (or none)
//     is rent (line 3); money out is a cost on its line; money back under a cost's category (a refund) takes off that line;
//     moves between your own accounts and lines left out of the totals are not counted; a loan payment is not on the form
//     (only its interest is, line 12).
//   - Depreciation (line 18) from the page's own figures (compute.js depreciation: 27.5 years, mid-month), only when what was
//     paid and the month first rented are typed; mortgage interest (line 12) from tied lines in a "mortgage interest"
//     category, else for the current year about a year of the page's own loan, else Form 1098.
// compute() in compute.js is not changed by any of this: the page calls books() beside it, and it writes nothing.
import { allLines, tagsOf, cleanTags } from "../../transactions/ledger/compute.js";
import { categoriesOf } from "../../transactions/categories/compute.js";
import { depreciation, rentalsFor, RECOVERY_YEARS } from "./compute.js";
import { DEFAULTS } from "./running.js";
import { csvText } from "../../investments/tax-lots/sell.js";
import { toCsv } from "../../../core/csv.js";

/**
 * Schedule E (Form 1040) 2025, Part I, the income and expense lines (https://www.irs.gov/pub/irs-pdf/f1040se.pdf, read
 * 2026-11-16): `form` is the form's own wording (the CSV and the printout), `label` the plain words on the phone.
 */
export const LINES = Object.freeze([
  { key: "rents", line: "3", form: "Rents received", label: "Rent received" },
  { key: "advertising", line: "5", form: "Advertising", label: "Advertising" },
  { key: "auto", line: "6", form: "Auto and travel", label: "Car and travel" },
  { key: "cleaning", line: "7", form: "Cleaning and maintenance", label: "Cleaning and upkeep" },
  { key: "commissions", line: "8", form: "Commissions", label: "Commissions" },
  { key: "insurance", line: "9", form: "Insurance", label: "Insurance" },
  { key: "legal", line: "10", form: "Legal and other professional fees", label: "Legal and tax help" },
  { key: "management", line: "11", form: "Management fees", label: "Property manager" },
  { key: "mortgage", line: "12", form: "Mortgage interest paid to banks, etc.", label: "Mortgage interest" },
  { key: "interest", line: "13", form: "Other interest", label: "Other interest" },
  { key: "repairs", line: "14", form: "Repairs", label: "Repairs" },
  { key: "supplies", line: "15", form: "Supplies", label: "Supplies" },
  { key: "taxes", line: "16", form: "Taxes", label: "Taxes" },
  { key: "utilities", line: "17", form: "Utilities", label: "Utilities" },
  { key: "depreciation", line: "18", form: "Depreciation expense or depletion", label: "Depreciation" },
  { key: "other", line: "19", form: "Other (list)", label: "Other costs" },
]);
const COSTS = LINES.filter((l) => l.key !== "rents").map((l) => l.key);
/** Lines 20 and 21 of the form. */
export const TOTALS = Object.freeze({ expenses: { line: "20", form: "Total expenses", label: "Costs in all" }, net: { line: "21", form: "Income or (loss)", label: "Profit or loss" } });

/**
 * The words in a category's name that send it to a line (the person's own categories, and a built-in one they renamed), in
 * this order: the first that matches wins (interest on a car, a card or a student loan is other interest; any other name
 * with interest and mortgage or loan in it, "Mortgage interest", "Loan interest", "Interest on mortgage", is mortgage
 * interest, before "mortgage" or "loan" alone, a loan payment; "Electrician" a repair before "electric" a utility, "Tax
 * prep" a professional fee before "tax"). A name with none of them goes by its built-in id (BUILT_IN), else to "Other"
 * (line 19).
 */
export const WORDS = Object.freeze([
  [/^(?=.*interest)(?=.*(?:\bcar\b|\bauto|vehicle|\bcards?\b|student))/, "interest"],
  [/^(?=.*interest)(?=.*(?:mortgage|\bloans?\b|heloc))/, "mortgage"],
  [/mortgage|\bloans?\b/, "loan"],
  [/advertis|listing|marketing/, "advertising"],
  [/clean|maint|lawn|landscap|garden|pest|snow/, "cleaning"],
  [/commission/, "commissions"],
  [/insur/, "insurance"],
  [/legal|lawyer|attorney|accountant|accounting|bookkeep|tax prep|professional/, "legal"],
  [/manag/, "management"],
  [/interest/, "interest"],
  [/repair|plumb|electrician|handyman|roof/, "repairs"],
  [/suppl/, "supplies"],
  [/\btax/, "taxes"],
  [/utilit|water|sewer|trash|garbage|electric|internet/, "utilities"],
  [/travel|mileage|\bauto\b|\bcar\b/, "auto"],
]);
/** The built-in spending categories (cashflow/expenses CATEGORIES) whose names say nothing the words above read. */
export const BUILT_IN = Object.freeze({ housing: "loan", debt: "loan", utilities: "utilities", phone: "utilities", insurance: "insurance", taxes: "taxes", transport: "auto", travel: "auto", shopping: "supplies" });

const num = (v, d = 0) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? d : Number(v));
const ISO = /^\d{4}-\d{2}/;
const yearOfLine = (t) => (ISO.test(String(t?.date ?? "")) ? Number(String(t.date).slice(0, 4)) : null);
const dollars = (x) => `$${Math.round(Math.abs(Number(x) || 0)).toLocaleString("en-US")}`;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * A tag compared the lenient way: letters, marks and digits only, in any script, lower case ("Duplex on Elm", "duplex-on-elm"
 * and "duplexonelm" are one; "アパート" keeps its letters).
 */
export const tagKey = (s) => String(s ?? "").normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, "");
/**
 * The tag that ties a bank line to a rental: its whole name as Transactions keeps a tag (lower case; a "#" or a comma, which
 * Transactions reads as the start of another tag, becomes a space: "Unit #1" is "unit 1"), or "rental" when the name has no
 * letter or digit to compare ("", "🏠").
 */
export const rentalTag = (r) => {
  const t = cleanTags([String(r?.name ?? "").replace(/[#,]+/g, " ")])[0] ?? "";
  return tagKey(t) ? t : "rental";
};
/**
 * rentalTags(rentals) -> each rental's tag (rentalTag), never two alike: a rental whose name gives the tag an earlier one
 * has ("Condo" and "condo", two rentals with no name) gets the first free "<tag> 2", "<tag> 3"... that no other rental's
 * name gives. The page shows each one, so the person types what ties.
 */
export function rentalTags(rentals) {
  const base = rentals.map(rentalTag), keys = base.map(tagKey), taken = new Set();
  return base.map((t, i) => {
    let tag = t;
    if (keys.indexOf(keys[i]) !== i) for (let n = 2; ; n++) { tag = `${t} ${n}`; const k = tagKey(tag); if (!keys.includes(k) && !taken.has(k)) break; }
    taken.add(tagKey(tag));
    return tag;
  });
}

/**
 * lineFor(category, amount) -> the key of the form's line a tied bank line goes to: "rents" (line 3), a cost's key (LINES),
 * "loan" (a loan payment: not on the form, only its interest is) or null (a move between your own accounts: not counted).
 * category: the category object (categoriesOf) or null for none. Money in under a loan category is rent (a rent payment
 * filed under "Rent or mortgage").
 */
export function lineFor(category, amount) {
  const a = Number(amount) || 0;
  if (!category) return a > 0 ? "rents" : "other";
  if (category.kind === "transfer") return null;
  if (category.kind === "income") return "rents";
  const label = String(category.label ?? "").toLowerCase();
  let key = null;
  for (const [re, k] of WORDS) if (re.test(label)) { key = k; break; }
  key = key ?? BUILT_IN[category.id] ?? "other";
  return key === "loan" && a > 0 ? "rents" : key;
}

/**
 * tieOf(rentals) -> (line) => the index of the rental a bank line is tied to, or -1. A tag whose key (tagKey) is a rental's
 * tag's (rentalTags: each rental its own); with exactly one rental, also the tags "rental" / "rentals" and the category
 * income-rental.
 */
export function tieOf(rentals) {
  const keys = rentalTags(rentals).map(tagKey);
  const one = rentals.length === 1;
  return (t) => {
    const tags = tagsOf(t).map(tagKey).filter(Boolean);
    for (const k of tags) { const i = keys.indexOf(k); if (i >= 0) return i; }
    if (one && (tags.includes("rental") || tags.includes("rentals") || t?.category === "income-rental")) return 0;
    return -1;
  };
}
const rentLike = (t) => t?.category === "income-rental" || tagsOf(t).some((g) => ["rental", "rentals"].includes(tagKey(g)));

/** The depreciation of one rental for a tax year, from its own figures: { state, amount, basis?, from? }. */
export function depOf(r, year) {
  const price = num(r?.purchasePrice);
  if (!(price > 0)) return { state: "noPrice", amount: 0 };
  const date = String(r?.purchaseDate ?? "");
  if (!ISO.test(date) || !(Number(date.slice(5, 7)) >= 1 && Number(date.slice(5, 7)) <= 12)) return { state: "noDate", amount: 0 };
  // the land's share kept between none and all of the price (the form allows 0 to 90%; a stray 1.5 is not a negative building)
  const land = Math.min(1, Math.max(0, num(r?.landShare, DEFAULTS.landShare)));
  const basis = price * (1 - land) + num(r?.improvements);
  const y0 = Number(date.slice(0, 4)), m0 = Number(date.slice(5, 7));
  const from = { year: y0, month: m0 };
  if (year < y0) return { state: "notYet", amount: 0, basis, from };
  const amount = depreciation(basis, date, year);
  if (!(amount > 0.005)) return { state: "done", amount: 0, basis, from };
  return { state: year === y0 ? "first" : "counted", amount, basis, from };
}

/**
 * books(plan, { today, year }) -> { ready, year, years, thisYear, case, lines, rentals: [...], untied: { count, total } }
 *   year: the tax year shown: `year` when given, else today's, or last year's when nothing is tied to this one and something
 *     is to last year (January to April, a preparer asks for last year). years: every year with a tied line, newest first.
 *   case: "noLines" (no bank lines in the plan), "noneTied" (none tied to a rental in that year), "some".
 *   rentals[i]: { id, name, tag, count (bank lines, a split purchase once), rows: [{ key, line, form, label, amount, count,
 *     from (category names), about? }], rents (line 3), expenses (line 20), net (line 21), loanPaid (loan payments, not on the
 *     form), dep (depOf), mortgage: { state: "lines" | "loan" | "noLoan" | "form1098" | "none", amount }, months (the months
 *     of the year, 1 to 12, with a bank line tied to it), start (the first month it was rented that year: its month first
 *     rented in that year, else 1), whole (a year that is over with a tied line in every month from start to December) }
 *   untied: the bank lines for a rental that no single rental holds (several rentals, the category or the tag "rental") in
 *     that year: { count, total } money in, { outCount, out } money out.
 * A line of $0.00 (or no number) is not a line: it ties nothing and counts nowhere. Reads only: it never writes the plan.
 */
export function books(plan, { today = null, year = null } = {}) {
  const list = (Array.isArray(plan?.property) ? plan.property : []).filter((x) => x?.kind === "rental");
  if (!list.length) return { ready: false, rentals: [] };
  const txs = Array.isArray(plan?.transactions) ? plan.transactions : [];
  const thisYear = Number(String(today ?? "").slice(0, 4)) || new Date().getFullYear();
  const cats = new Map(categoriesOf(plan, { all: true }).map((c) => [c.id, c]));
  const moved = (t) => !!t?.transferId || t?.category === "transfer" || cats.get(t?.category)?.kind === "transfer";
  const tie = tieOf(list), tags = rentalTags(list);
  const tied = [], untied = new Map(), years = new Set();
  for (const t of allLines(txs === plan.transactions ? plan : { ...plan, transactions: txs })) {
    const y = yearOfLine(t), amt = Number(t?.amount);
    if (!y || moved(t) || !(Math.abs(amt) >= 0.005)) continue;
    const i = tie(t);
    if (i < 0) {
      // money for a rental that no one rental holds, in or out (several rentals: the category or the tag "rental")
      if (rentLike(t)) {
        const u = untied.get(y) ?? { count: 0, total: 0, outCount: 0, out: 0 };
        if (amt > 0) { u.count++; u.total += amt; } else { u.outCount++; u.out -= amt; }
        untied.set(y, u);
      }
      continue;
    }
    tied.push({ t, i, y });
    years.add(y);
  }
  const yr = Number.isInteger(year) && year > 1900 ? year : !years.has(thisYear) && years.has(thisYear - 1) ? thisYear - 1 : thisYear;
  const inYear = tied.filter((x) => x.y === yr);
  const anyLines = txs.length > 0;
  // the page's own loan figures for the year (its interest), worked only when something is tied
  const worked = inYear.length ? rentalsFor(plan.property.some((x) => !x) ? { ...plan, property: plan.property.filter(Boolean) } : plan, { today, year: yr }) : [];
  const rentals = list.map((r, i) => {
    const sums = Object.fromEntries(COSTS.map((k) => [k, 0])), counts = {}, from = {}, ids = new Set(), seen = new Set();
    let rents = 0, loanPaid = 0;
    for (const { t } of inYear.filter((x) => x.i === i)) {
      const a = Number(t.amount) || 0;
      const cat = t.category ? cats.get(t.category) ?? null : null;
      const key = lineFor(cat, a);
      if (!key) continue;
      ids.add(t.splitOf ?? t.id ?? `${t.date}|${t.amount}|${t.payee}`);
      seen.add(Number(String(t.date).slice(5, 7)));
      if (key === "rents") rents += a;
      else if (key === "loan") loanPaid -= a;
      else sums[key] -= a;
      counts[key] = (counts[key] ?? 0) + 1;
      (from[key] ??= new Set()).add(cat?.label ?? "Uncategorized");
    }
    const count = ids.size;
    const dep = depOf(r, yr);
    // the months with a line: a year that is over is whole when every month it was rented has one (from its first month
    // rented, when that was in this year); the year still running is never whole ("so far")
    const months = [...seen].filter((m) => m >= 1 && m <= 12).sort((x, y) => x - y);
    const start = dep.from?.year === yr ? dep.from.month : 1;
    const whole = yr < thisYear && months.filter((m) => m >= start).length === 13 - start;
    if (count && (dep.state === "counted" || dep.state === "first")) sums.depreciation += dep.amount;
    // line 12: the lines filed as mortgage interest; else about a year of the page's own loan (this year only); else Form 1098
    const a = worked[i] ?? null, interest = a?.loan ? Number(a.interest) || 0 : 0;
    let mortgage;
    if (counts.mortgage) mortgage = { state: "lines", amount: sums.mortgage };
    else if (count && yr === thisYear && interest > 0.005) { mortgage = { state: "loan", amount: interest }; sums.mortgage = interest; }
    else if (count && (a?.loan || loanPaid > 0.005)) mortgage = { state: yr === thisYear && !a?.loan ? "noLoan" : "form1098", amount: 0 };
    else mortgage = { state: "none", amount: 0 };
    const rows = [];
    if (Math.abs(rents) >= 0.005) rows.push({ ...LINES[0], amount: rents, count: counts.rents ?? 0, from: [...(from.rents ?? [])] });
    for (const l of LINES.slice(1)) {
      if (!(Math.abs(sums[l.key]) >= 0.005)) continue;
      rows.push({ ...l, amount: sums[l.key], count: counts[l.key] ?? 0, from: [...(from[l.key] ?? [])], ...(l.key === "mortgage" && mortgage.state === "loan" ? { about: true } : {}) });
    }
    const expenses = COSTS.reduce((s, k) => s + sums[k], 0);
    return { id: r.id, name: String(r.name ?? "").trim() || "Rental", tag: tags[i], count, rows, rents, expenses, net: rents - expenses, loanPaid, dep, mortgage, months, start, whole };
  });
  const lines = new Set(inYear.map(({ t }) => t.splitOf ?? t.id ?? `${t.date}|${t.amount}|${t.payee}`)).size;
  const u = untied.get(yr) ?? { count: 0, total: 0, outCount: 0, out: 0 };
  return {
    ready: true, year: yr, thisYear, years: [...years].sort((x, y) => y - x),
    case: !anyLines ? "noLines" : inYear.length ? "some" : "noneTied",
    lines, rentals, untied: { count: u.count, total: u.total, outCount: u.outCount, out: u.out },
  };
}

// ---------------------------------------------------------------- the words (one written sentence per case, R5)
const q = (tag) => `“${tag}”`;
const tagList = (b) => b.rentals.slice(0, 3).map((r) => q(r.tag)).join(", ");
const FOR_FORM = "ready for the tax form for rental income";
/**
 * The part's first sentence when nothing is tied yet (case noLines or noneTied); null once something is. It says the two
 * steps in the words Transactions shows: add the bank lines there, then type the rental's word in each line's Tags box.
 */
export function booksSentence(b) {
  const one = b.rentals.length === 1, r = b.rentals[0];
  if (b.case === "noLines") return one
    ? `No bank lines are in the plan yet. Add them on Transactions, then type ${q(r.tag)} in the Tags box of ${r.name}'s lines: its rent and costs add up here, ${FOR_FORM}.`
    : `No bank lines are in the plan yet. Add them on Transactions, then type each rental's word in the Tags box of its lines (${tagList(b)}): their rent and costs add up here, ${FOR_FORM}.`;
  if (b.case === "noneTied") return one
    ? `No bank lines are tied to ${r.name} for ${b.year} yet. On Transactions, type ${q(r.tag)} in the Tags box of its rent and bills (a rule can do it for you): they then add up here, ${FOR_FORM}.`
    : `No bank lines are tied to your rentals for ${b.year} yet. On Transactions, type each rental's word in the Tags box of its rent and bills (${tagList(b)}): they then add up here, ${FOR_FORM}.`;
  return null;
}
/** The months with lines in words: "March", "November and December", "January to October", "January to October, with gaps". */
export function monthWords(months) {
  const ms = [...(months ?? [])].sort((x, y) => x - y), name = (m) => MONTHS[m - 1];
  if (!ms.length) return "";
  if (ms.length === 1) return name(ms[0]);
  if (ms.length === 2 && ms[1] === ms[0] + 1) return `${name(ms[0])} and ${name(ms[1])}`;
  return `${name(ms[0])} to ${name(ms.at(-1))}${ms.at(-1) - ms[0] + 1 === ms.length ? "" : ", with gaps"}`;
}
/** What the costs hold for the whole year whatever months the bank lines cover: ", among them all of 2026's depreciation". */
function wholeYearOf(r, year) {
  const w = [["counted", "first"].includes(r.dep?.state) ? "depreciation" : null, r.mortgage?.state === "loan" ? "loan interest" : null].filter(Boolean);
  return w.length ? `, among them all of ${year}'s ${w.join(" and ")}` : "";
}
/**
 * One rental's verdict for the year, one sentence per case:
 *   - a year that is over, every month with bank lines (`r.whole`): a profit, a loss or even;
 *   - a year that is over with months missing: how many months have lines and that these are not the whole year's books,
 *     then the rent and the costs (no profit or loss is called: the missing months' rent would change it);
 *   - the year still running (`thisYear`): "so far", the months the lines cover, a profit, a loss or even;
 *   and with either of the last two, that depreciation and the interest from the loan are the whole year's while the lines
 *   are not (F5, P1). Or nothing tied to it yet (several rentals).
 */
export function rentalSentence(r, year, money = dollars, thisYear = null) {
  const now = thisYear !== null && year >= thisYear;
  if (!r.count) return `No bank lines are tied to ${r.name} for ${year} yet: type ${q(r.tag)} in the Tags box of its lines on Transactions.`;
  const rent = money(r.rents), costs = money(r.expenses), tail = wholeYearOf(r, year);
  if (now) {
    const head = `${r.name}'s books for ${year} so far (bank lines for ${monthWords(r.months)})`;
    if (r.net >= 0.5) return `${head} show a profit of ${money(r.net)}: ${rent} of rent less ${costs} of costs${tail}.`;
    if (r.net <= -0.5) return `${head} show a loss of ${money(-r.net)}: ${rent} of rent less ${costs} of costs${tail}.`;
    return `${head} break even: ${rent} of rent and ${costs} of costs${tail}.`;
  }
  if (r.whole === false) {
    const n = (r.months ?? []).length;
    return `Only ${n === 1 ? "one month" : `${n} months`} of ${year} ${n === 1 ? "has" : "have"} bank lines for ${r.name} (${monthWords(r.months)}), so these are not the whole year's books: ${rent} of rent less ${costs} of costs${tail}.`;
  }
  if (r.net >= 0.5) return `${r.name}'s books for ${year} show a profit of ${money(r.net)}: ${rent} of rent less ${costs} of costs.`;
  if (r.net <= -0.5) return `${r.name}'s books for ${year} show a loss of ${money(-r.net)}: ${rent} of rent less ${costs} of costs.`;
  return `${r.name}'s books for ${year} break even: ${rent} of rent and ${costs} of costs.`;
}
/** Depreciation (line 18): counted (a full year or the first), or why not. */
export function depSentence(r, year, money = dollars) {
  const d = r.dep, yrs = String(RECOVERY_YEARS);
  switch (d.state) {
    case "counted": return `Depreciation (line 18): ${money(d.amount)} for ${year}, the building's ${money(d.basis)} over ${yrs} years.`;
    case "first": return `Depreciation (line 18): ${money(d.amount)} for ${year}, its first year: ${12 - d.from.month + 0.5} of 12 months, from the middle of ${MONTHS[d.from.month - 1]}.`;
    case "noPrice": return `Depreciation (line 18) is not counted: it needs what you paid for ${r.name}, under Change ${r.name}.`;
    case "noDate": return `Depreciation (line 18) is not counted: it needs the month ${r.name} was first rented out, under Change ${r.name}.`;
    case "notYet": return `No depreciation for ${year}: ${r.name} was first rented out in ${d.from.year}.`;
    default: return `No depreciation for ${year}: the building's cost was written off over ${yrs} years.`;
  }
}
/** Mortgage interest (line 12): from tied lines, about from the page's loan, from Form 1098, or nothing to say (null). */
export function mortgageSentence(r, year, money = dollars) {
  const m = r.mortgage;
  if (m.state === "lines") return `Mortgage interest (line 12): ${money(m.amount)}, from your lines filed as mortgage interest.`;
  if (m.state === "loan") return `Mortgage interest (line 12): about ${money(m.amount)}, a year of payments on the loan as it stands; the lender's Form 1098 (box 1) has the exact figure.`;
  if (m.state === "noLoan") return `Mortgage interest is not counted: this page has no loan for ${r.name}. Add it under Change ${r.name}, or copy the interest from box 1 of the lender's Form 1098.`;
  if (m.state === "form1098") return `Mortgage interest for ${year} is not counted here: copy it from box 1 of the lender's Form 1098 for ${year}.`;
  return null;
}
/** Loan payments tied to the rental: not a cost on the form (principal is not an expense), or null. */
export const loanSentence = (r, money = dollars) => (r.loanPaid > 0.5 ? `Loan payments of ${money(r.loanPaid)} are not on the form: only their interest counts (line 12).` : null);
/** The passive activity rules, named and not worked out (a loss only). */
export const PASSIVE_LINE = "A rental loss may not all count this year: the passive activity rules (Form 8582) can hold part of it back. The Tax card above works out this year's share; these books do not.";
/** Bank lines for a rental that no single rental holds (several rentals): rent, costs or both, or null (F4: costs too). */
export function untiedSentence(b, money = dollars) {
  const u = b.untied, nIn = u.count > 0 ? u.count : 0, nOut = u.outCount > 0 ? u.outCount : 0, n = nIn + nOut;
  if (!n) return null;
  const what = nIn && nOut ? `${n} bank lines for ${b.year} (${money(u.total)} in, ${money(u.out)} out)`
    : nIn ? `${nIn === 1 ? "One rent line" : `${nIn} rent lines`} for ${b.year} (${money(u.total)})`
      : `${nOut === 1 ? "One cost line" : `${nOut} cost lines`} for ${b.year} (${money(u.out)})`;
  return `${what} ${n === 1 ? "is" : "are"} not tied to one rental: type the rental's word in ${n === 1 ? "its" : "their"} Tags box (${tagList(b)}).`;
}
/** The part's title (one quiet row on the page): what it holds in plain words, for any year shown. */
export const BOOKS_TITLE = "The year's rent and costs";
/** What the printout says the plan does not hold. */
export const NOT_IN_PLAN = "Lines 1 and 2 of the form (the address, the kind of property, the days rented and the days you used it) are not in the plan.";
/** What the part is, said once inside it. */
export const PREPARER_LINE = "For your tax preparer: the lines you tied, laid out like Schedule E (Form 1040), Part I. It is not a filing.";
/** How lines are sorted, and the two things a bank line cannot say (Schedule E instructions 2025, lines 14 and 12). */
export const SORT_LINES = Object.freeze([
  "Each line goes to the form by its category. A category of your own named like a line of the form (Repairs, Cleaning, Property management, Advertising) goes to that line; Utilities, Insurance, Car, gas, transit and Taxes go to theirs; anything else is listed under Other.",
  "A repair keeps the place as it was; an improvement (a new roof, a remodel) is not counted in one year but depreciated: file it under a category such as Improvements and tell your preparer.",
  "If the lender pays the property tax and insurance from the loan payment, its year-end statement lists them: they belong on lines 9 and 16.",
]);
/** The row's status: the year and how many bank lines, or that none is tied yet. */
export const booksStatus = (b) => (b.case === "some" ? `${b.year} · ${b.lines} ${b.lines === 1 ? "line" : "lines"}` : "none tied yet");
/** The file's name. */
export const booksFile = (b) => `rental-books-${b.year}.csv`;

// ---------------------------------------------------------------- the file and the printout for a tax preparer
const n2 = (v) => (Math.round((Number(v) || 0) * 100) / 100).toFixed(2);
const blank0 = (v) => (Math.abs(Number(v) || 0) < 0.005 ? "" : n2(v));
/** The months the bank lines cover, for the file's notes on line 3 ("the year so far: bank lines 01/2026 to 10/2026"), or null. */
function coverNote(r, b) {
  const ms = r.months ?? [], mm = (m) => `${String(m).padStart(2, "0")}/${b.year}`;
  if (!ms.length) return null;
  const span = `${ms.length === 1 ? mm(ms[0]) : `${mm(ms[0])} to ${mm(ms.at(-1))}`}${ms.length > 1 && ms.at(-1) - ms[0] + 1 !== ms.length ? ", with gaps" : ""}`;
  if (b.year >= b.thisYear) return `the year so far: bank lines ${span}`;
  if (r.whole === false) return `not the whole year: bank lines in ${ms.length} of its months only, ${span}`;
  return null;
}
/** The rentals a file or printout lists: those with a bank line tied in the year. */
export const shownRentals = (b) => b.rentals.filter((r) => r.count > 0);
/** One row of the form for every rental shown: { line, form, label, amounts: [..], notes: [..] }, lines 3, 5 to 19, 20, 21. */
export function formRows(b) {
  const rs = shownRentals(b), many = rs.length > 1;
  const note = (r, text) => (text ? (many ? `${r.name}: ${text}` : text) : null);
  const amountOf = (r, key) => (key === "rents" ? r.rents : r.rows.find((x) => x.key === key)?.amount ?? 0);
  const notesFor = (key) => rs.map((r) => {
    if (key === "mortgage") return note(r, r.mortgage.state === "loan" ? "about: a year of payments on the loan typed on Rental analysis; the lender's Form 1098 (box 1) has the exact figure"
      : r.mortgage.state === "form1098" || r.mortgage.state === "noLoan" ? "not counted: copy box 1 of the lender's Form 1098" : null);
    if (key === "depreciation") {
      const d = r.dep;
      if (d.state === "counted" || d.state === "first") return note(r, `${RECOVERY_YEARS} years straight line, mid-month, from ${String(d.from.month).padStart(2, "0")}/${d.from.year}; basis ${n2(d.basis)}`);
      return note(r, d.state === "noPrice" ? "not counted: the price paid is not in the plan" : d.state === "noDate" ? "not counted: the month first rented is not in the plan" : null);
    }
    if (key === "other") { const f = r.rows.find((x) => x.key === "other")?.from ?? []; return f.length ? note(r, f.join(", ")) : null; }
    if (key === "rents") return note(r, coverNote(r, b));
    return null;
  }).filter(Boolean);
  const out = LINES.map((l) => ({ line: l.line, form: l.form, label: l.label, key: l.key, amounts: rs.map((r) => amountOf(r, l.key)), notes: notesFor(l.key) }));
  out.push({ line: TOTALS.expenses.line, form: TOTALS.expenses.form, label: TOTALS.expenses.label, key: "expenses", amounts: rs.map((r) => r.expenses), notes: [], total: true });
  out.push({ line: TOTALS.net.line, form: TOTALS.net.form, label: TOTALS.net.label, key: "net", amounts: rs.map((r) => r.net), notes: [], total: true });
  return out;
}
/**
 * booksCsv(b) -> CSV text (core/csv.js toCsv): a column per rental with lines tied in the year, the form's lines 3 and 5 to 21
 * in its own words, money with two decimals and no $ sign (blank where the form would be empty; lines 20 and 21 always), a
 * loss with a minus; the names guarded by Tax lots' csvText (a name a spreadsheet would run as a formula gets an apostrophe).
 */
export function booksCsv(b) {
  const rs = shownRentals(b);
  const headers = ["Line", `Schedule E for ${b.year}`, ...rs.map((r) => csvText(r.name)), "Notes"];
  const rows = formRows(b).map((x) => [x.line, x.form, ...x.amounts.map((v) => (x.total ? n2(v) : blank0(v))), csvText(x.notes.join("; "))]);
  return toCsv(headers, rows);
}

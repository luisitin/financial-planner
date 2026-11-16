// modules/career/business/costs.js -- PURE. Two quiet rows of Small business (gap list, next 60, item 6; map P10, P11):
//   - Costs a self-employed person often forgets to count: nine rows, each saying what counts in one line, and whether
//     the page already counts it (with the figure) or where it goes (the box or the kind of expense, one tap away).
//     Nothing here is counted: it reads compute()'s result and the page's own boxes. The rules are read from the IRS
//     (README, "Costs you may be missing"), 2026-11-16.
//   - Costs from your bank lines: the ledger lines the person ties to the business (the tag "business" or the
//     business's own name, as Rental analysis ties a line to a rental, or a category of their own with "business" in its
//     name) added up for the year by the page's own kinds of expense, beside what is typed; useBank() copies the totals
//     into the page's expenses when the person taps "Use these". Only useBank() writes, and only the draft it is given.
import { allLines, tagsOf, cleanTags } from "../../transactions/ledger/compute.js";
import { categoriesOf } from "../../transactions/categories/compute.js";
import { tagKey } from "../../property/rental/books.js";
import { CATEGORIES as SPENDING } from "../../cashflow/expenses/compute.js";
import { CATEGORIES, homeOffice } from "./compute.js";
import { HOME_OFFICE } from "./data/business.js";

// the built-in spending categories' own names: one still called that is read by its id (BUILT_IN_KIND), a renamed one by
// its new name's words (KIND_WORDS)
const DEFAULT_LABELS = Object.freeze(Object.fromEntries(Object.entries(SPENDING).map(([k, v]) => [k, v.label])));

// "Costs you may be missing" keeps to one line beside its status at 390 px ("Costs people often forget to count" took
// two; person critic P6, 2026-11-16)
export const MISSED_TITLE = "Costs you may be missing";
export const MISSED_INTRO = "Costs a self-employed person may count and often leaves out. Tap Add on one that applies: nothing counts until you save it there.";
export const MISSED_SOURCES = "From the IRS's tax guide for small business (Publication 334, 2025, which replaced Publication 535) and its guides to the home office, cars, education and health insurance.";

/**
 * The rows, in the order a person meets them. `counts`: what counts, in one line. `go`: where the person puts it: a box
 * of "The business" (`box`), a kind of expense (`kind`, its add form opens with that kind picked), another page
 * (`href`), or nothing (counted by itself). `label`: the button's words.
 */
export const CHECKLIST = Object.freeze([
  { key: "office", title: "Home office", counts: "A space used only and regularly for the business: $5 a square foot, up to 300 square feet.", go: { box: "homeOfficeSqft" }, label: "Type the square feet" },
  { key: "miles", title: "Business miles", counts: "Driving for the work at the IRS rate a mile, not to a regular workplace; parking and tolls count too.", go: { box: "miles" }, label: "Type the miles" },
  { key: "health", title: "Health insurance you pay", counts: "Medical, dental and long-term care insurance for your family, when no employer's plan could cover you.", go: { box: "healthPremiums" }, label: "Type what you pay" },
  { key: "retire", title: "Retirement savings", counts: "What you put into a SEP-IRA, a solo 401(k) or a SIMPLE IRA for yourself.", go: { href: "#/retirement/contributions" }, label: "Retirement contributions" },
  { key: "seHalf", title: "Half the self-employment tax", counts: "Half of the Social Security and Medicare tax on the profit; there is nothing to do.", go: null, label: "" },
  { key: "phone", title: "Phone and internet", counts: "The business share of your phone and internet bills; never the base rate of a home's first landline.", go: { kind: "phone" }, label: "Add the bill" },
  { key: "supplies", title: "Supplies and software", counts: "Supplies, materials and postage used up in the year, and software or subscriptions for the work.", go: { kind: "supplies" }, label: "Add supplies" },
  { key: "professional", title: "Accountant and lawyer", counts: "Fees for an accountant, a lawyer or tax advice for the business, and for your return's business part.", go: { kind: "professional" }, label: "Add the fees" },
  { key: "education", title: "Courses for your work", counts: "Courses that keep up or improve a skill for the work you do now; not training for a new line of work.", go: { kind: "education" }, label: "Add a course" },
]);
/** The expense kinds each row reads (what is typed under them is what the row counts). */
export const ROW_KINDS = Object.freeze({ phone: ["phone"], supplies: ["supplies", "software"], professional: ["professional"], education: ["education"] });

const pos = (v) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };
const whole = (n) => Math.round(n).toLocaleString("en-US");

/** What is typed on the page a year for each kind of expense (the Self-employment page's one figure is not a kind). */
export function typedByKind(d) {
  const out = {};
  for (const e of d?.expenses ?? []) if (!e.fromSelfEmployment) out[e.category] = (out[e.category] ?? 0) + (Number(e.yearly) || 0);
  return out;
}

/**
 * checklist(d, s) -> { items: [{ key, title, counts, state, amount, said, go, label }], missing }
 *   d: compute()'s result; s: plan.whatIfs.business (the boxes as typed).
 *   state: "counted" (the page counts it; amount is the figure), "limited" (typed, counted only up to the profit: the
 *   home office or the health insurance, with what was typed allowed beside it),
 *   "typedNone" (typed, none counts this year: no profit for it), "add" (not counted yet: the button), "elsewhere" (not
 *   part of the profit: it comes off income on another page), "auto" (counted by itself), "none" (nothing to count).
 *   missing: how many rows are "add"; ready: the page has a business (missedStatus counts nothing before it has).
 */
export function checklist(d, s = {}, money = (n) => `$${whole(n)}`) {
  const ready = !!d?.ready;
  const typed = typedByKind(d);
  const items = CHECKLIST.map((row) => {
    let state = "add", amount = 0, said = "Not counted yet.";
    if (row.key === "office") {
      // the square feet that count (300 at most) and what they would allow; the profit can cut it (money critic F5)
      const sq = Math.min(pos(s.homeOfficeSqft), HOME_OFFICE.maxSqft), full = homeOffice(sq);
      if (ready && d.homeOffice > 0.5 && d.homeOffice < full - 0.5) { state = "limited"; amount = d.homeOffice; said = `Counted: ${money(amount)} of the ${money(full)} for ${whole(sq)} square feet: it counts only up to the profit.`; }
      else if (ready && d.homeOffice > 0.5) { state = "counted"; amount = d.homeOffice; said = `Counted: ${money(amount)} for ${whole(sq)} square feet.`; }
      else if (pos(s.homeOfficeSqft) > 0) { state = "typedNone"; said = "It counts only up to the profit, so none this year."; }
    } else if (row.key === "miles") {
      if (ready && d.miles?.amount > 0.5) { state = "counted"; amount = d.miles.amount; said = `Counted: ${money(amount)} for ${whole(d.miles.miles)} miles.`; }
    } else if (row.key === "health") {
      const paid = pos(s.healthPremiums), off = ready ? pos(d.tax?.health) : 0;
      if (off > 0.5 && off < paid - 0.5) { state = "limited"; amount = off; said = `Counted: ${money(off)} of the ${money(paid)}: it counts only up to the profit.`; }
      else if (off > 0.5) { state = "counted"; amount = off; said = `Counted: ${money(off)} off the income you pay tax on.`; }
      else if (paid > 0) { state = "typedNone"; said = "It counts only up to the profit, so none this year."; }
    } else if (row.key === "retire") {
      if (ready && d.earned > 0.5) { state = "elsewhere"; said = "This lowers the income you pay tax on; it is not a business cost. The plans and the tax each saves are above."; }
      else { state = "none"; said = "No earnings from the business this year, so nothing can go in from it."; }
    } else if (row.key === "seHalf") {
      if (ready && d.tax?.se > 0.5) { state = "auto"; amount = d.tax.se / 2; said = `The page already takes ${money(amount)} off the income you pay tax on.`; }
      else { state = "none"; said = "No self-employment tax this year, so nothing to take off."; }
    } else {
      const sum = ROW_KINDS[row.key].reduce((t, k) => t + (typed[k] ?? 0), 0);
      if (sum > 0.5) { state = "counted"; amount = sum; said = `Counted: ${money(sum)} a year.`; }
    }
    return { key: row.key, title: row.title, counts: row.counts, state, amount, said, go: state === "add" || state === "elsewhere" ? row.go : null, label: row.label };
  });
  return { items, missing: items.filter((x) => x.state === "add").length, ready };
}

/**
 * The row's status (at most 20 characters): how many are not counted yet; with no business yet, nothing is "not counted"
 * (person critic P2: someone with no business was told 7 costs were missed).
 */
export const missedStatus = (c) => (!c.ready ? "a short list" : c.missing > 0 ? `${c.missing} not counted yet` : "nothing missing");

// ---------------------------------------------------------------- costs from your bank lines
export const BANK_TITLE = "Costs from your bank lines";
export const BANK_TAG = "business";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ISO = /^\d{4}-\d{2}/;
const yearOf = (t) => (ISO.test(String(t?.date ?? "")) ? Number(String(t.date).slice(0, 4)) : null);
/** Lines the page sets apart, never copied into its expenses: each has its own sentence (apartLine). */
export const APART = Object.freeze(["car", "loan", "tax", "health", "income"]);

/**
 * The business's own name as Transactions keeps a tag ("Weekend photography" is "weekend photography"; a "#" or a comma,
 * which Transactions reads as the start of another tag, becomes a space), or null when it has no letter or digit or is
 * "business" itself.
 */
export function bizTag(name) {
  const t = cleanTags([String(name ?? "").replace(/[#,]+/g, " ")])[0] ?? "";
  const k = tagKey(t);
  return k && k !== BANK_TAG ? t : null;
}
/** The business's name: the one typed on this page, else the Income page's line the page reads. */
export function bizName(plan, incomeId = null) {
  const typed = String(plan?.whatIfs?.business?.name ?? "").trim();
  return typed || String((plan?.income ?? []).find((x) => x?.id === incomeId)?.name ?? "").trim();
}

/**
 * bizTie(plan, { incomeId }) -> (line) => true for a bank line tied to the business: a tag whose letters and digits are
 * "business" or the business's own name's (Rental analysis's tagKey: "Weekend-Photography" and "weekend photography" are
 * one), or a spending category (the person's own, or one they renamed) with the word "business" in its name.
 */
export function bizTie(plan, { incomeId = null } = {}) {
  const own = bizTag(bizName(plan, incomeId));
  const keys = new Set([BANK_TAG, ...(own ? [tagKey(own)] : [])]);
  const cats = new Map(categoriesOf(plan, { all: true }).map((c) => [c.id, c]));
  return (t) => {
    if (tagsOf(t).some((g) => keys.has(tagKey(g)))) return true;
    const c = t?.category ? cats.get(t.category) : null;
    return !!c && c.kind === "expense" && /\bbusiness\b/i.test(String(c.label ?? ""));
  };
}

/**
 * The words in a category's name that send a business's line to one of the page's kinds of expense (or set it apart),
 * the first that matches: "Tax prep" is an accountant before "tax"; "Business tax software" is software and "Medical
 * supplies" or "Dental supplies" a practice's supplies before "tax" and "medical" set them apart (money critic F4,
 * 2026-11-16); "Health insurance" is health and "Car insurance" a car before "insur"; "Loan interest" is a cost (other)
 * before "loan"; "Gas and electric" a utility before "gas"; "Car lease" a car, "Office rent" a workspace's rent (other)
 * before "office".
 */
export const KIND_WORDS = Object.freeze([
  [/tax prep|accountant|accounting|bookkeep|lawyer|attorney|legal|professional/, "professional"],
  [/software|subscri|\bapps?\b|hosting|domain|cloud/, "software"],
  [/^(?!.*\b(?:cars?|auto|vehicle)\b).*(?:suppl|material)/, "supplies"],   // "Car supplies" stays a car's cost
  [/health|medical|dental/, "health"],
  [/interest/, "other"],
  [/\bloans?\b|mortgage/, "loan"],
  [/\btax(es)?\b/, "tax"],
  [/utilit|electric|water|sewer|trash/, "other"],
  [/parking|\btolls?\b/, "other"],
  [/\bcars?\b|\bauto\b|vehicle|fuel|\bgas\b|gasoline|transit|mileage/, "car"],
  [/\brent\b|\blease\b/, "other"],
  [/course|class|training|tuition|seminar|conference|workshop|education/, "education"],
  [/meal|dining|restaurant|lunch|dinner|coffee/, "meals"],
  [/phone|internet|mobile|\bcell/, "phone"],
  [/advertis|marketing|promot|\bads\b/, "marketing"],
  [/travel|hotel|flight|airfare|airline|lodging/, "travel"],
  [/equipment|computer|camera|laptop|\btools?\b|hardware/, "equipment"],
  [/insur/, "insurance"],
  [/contract|freelanc|assistant|payroll|wages/, "contractors"],
  [/postage|office|shipping/, "supplies"],
  [/\bfees?\b|licen|permit|\bdues\b/, "fees"],
]);
/**
 * The built-in spending categories (cashflow/expenses), by id, while they keep their own name: rent for a workspace and
 * utilities are other costs, a car is set apart (the page counts business miles), as are loan payments, taxes and health.
 */
export const BUILT_IN_KIND = Object.freeze({ housing: "other", utilities: "other", groceries: "other", transport: "car", insurance: "insurance", health: "health", debt: "loan", childcare: "other", phone: "phone", taxes: "tax", subscriptions: "software", dining: "meals", fun: "other", shopping: "supplies", travel: "travel", giving: "other", personal: "other", pets: "other", other: "other" });

/**
 * kindFor(category, amount) -> the page's kind of expense a tied line goes to (a key of CATEGORIES), a key of APART, or
 * null (not a cost: a move between your own accounts, or money in under an income category or none).
 * category: the category object (categoriesOf), or null for none.
 */
export function kindFor(category, amount) {
  const a = Number(amount) || 0;
  if (!category) return a < 0 ? "other" : null;
  if (category.kind === "transfer") return null;
  if (category.kind === "income") return a < 0 ? "income" : null;
  const label = String(category.label ?? "").toLowerCase();
  const own = DEFAULT_LABELS[category.id];
  if (own && own.toLowerCase() === label && BUILT_IN_KIND[category.id]) return BUILT_IN_KIND[category.id];
  for (const [re, k] of KIND_WORDS) if (re.test(label)) return k;
  return BUILT_IN_KIND[category.id] ?? "other";
}

/**
 * bankCosts(plan, { year, today, incomeId }) -> {
 *   case: "noLines" (no bank lines in the plan) | "noneTied" (none tied to the business in that year) | "some" (some)
 *     | "noCosts" (tied lines, none a cost this page counts),
 *   year (the year asked, or the year before when nothing is tied to it and something is to that one), thisYear, years
 *   (the years with a tied line, none after this one),
 *   lines (bank lines that year that went to one of the page's kinds, a split purchase once; the lines set apart have
 *   their own sentences and are not counted here, money critic F6; with none, every tied line that year), months (1 to
 *   12 with such a line), sofar (the year is still running), partial (those months do not run January to December: the
 *   totals are part of a year), tag (the business's own name as a tag, or null),
 *   kinds: [{ key, label, amount (spent less money back, for the year), count, from (category names) }] in CATEGORIES' order,
 *   total (the kinds added up), apart: [{ key, amount, count }] in APART's order
 * }
 * A line is counted once: allLines() gives a split purchase's parts and drops lines left out of the totals; moves between
 * your own accounts and lines of $0.00 count nowhere. Money in under a cost's category (a refund) takes off its kind.
 * Reads only.
 */
export function bankCosts(plan, { year = null, today = null, incomeId = null } = {}) {
  const txs = Array.isArray(plan?.transactions) ? plan.transactions.filter(Boolean) : [];
  const thisYear = Number(String(today ?? "").slice(0, 4)) || new Date().getFullYear();
  const asked = Number.isInteger(year) && year > 1900 ? year : thisYear;
  const tag = bizTag(bizName(plan, incomeId));
  if (!txs.length) return { case: "noLines", year: asked, thisYear, years: [], lines: 0, months: [], sofar: asked >= thisYear, partial: false, tag, kinds: [], total: 0, apart: [] };
  const cats = new Map(categoriesOf(plan, { all: true }).map((c) => [c.id, c]));
  const tie = bizTie(plan, { incomeId });
  const moved = (t) => !!t?.transferId || t?.category === "transfer" || cats.get(t?.category)?.kind === "transfer";
  const tied = [], years = new Set();
  for (const t of allLines({ ...plan, transactions: txs })) {
    const y = yearOf(t), amt = Number(t?.amount);
    if (!y || moved(t) || !(Math.abs(amt) >= 0.005) || !tie(t)) continue;
    tied.push({ t, y }); years.add(y);
  }
  const yr = !years.has(asked) && years.has(asked - 1) ? asked - 1 : asked;
  const inYear = tied.filter((x) => x.y === yr);
  // the lines (and months) said: those that went to a kind; with none (every line set apart), every tied line
  const sums = {}, counts = {}, from = {}, ids = { kind: new Set(), all: new Set() }, seen = { kind: new Set(), all: new Set() };
  for (const { t } of inYear) {
    const a = Number(t.amount) || 0;
    const cat = t.category ? cats.get(t.category) ?? null : null;
    const k = kindFor(cat, a);
    if (!k) continue;
    const id = t.splitOf ?? t.id ?? `${t.date}|${t.amount}|${t.payee}`, m = Number(String(t.date).slice(5, 7));
    for (const w of APART.includes(k) ? ["all"] : ["kind", "all"]) { ids[w].add(id); seen[w].add(m); }
    sums[k] = (sums[k] ?? 0) - a;
    counts[k] = (counts[k] ?? 0) + 1;
    (from[k] ??= new Set()).add(cat?.label ?? "Uncategorized");
  }
  const kinds = Object.keys(CATEGORIES).filter((k) => Math.abs(sums[k] ?? 0) >= 0.005).map((k) => ({ key: k, label: CATEGORIES[k], amount: sums[k], count: counts[k], from: [...from[k]] }));
  const apart = APART.filter((k) => (sums[k] ?? 0) >= 0.005).map((k) => ({ key: k, amount: sums[k], count: counts[k] }));
  const total = kinds.reduce((x, k) => x + k.amount, 0);
  const w = ids.kind.size ? "kind" : "all";
  const months = [...seen[w]].filter((m) => m >= 1 && m <= 12).sort((x, y) => x - y);
  return {
    case: !inYear.length ? "noneTied" : kinds.some((k) => k.amount > 0.005) ? "some" : "noCosts",
    // a line dated after this year (a typo, or a payment set up ahead) is not offered as a year (money critic F7)
    year: yr, thisYear, years: [...years].filter((y) => y <= thisYear).sort((x, y) => y - x), lines: ids[w].size, months,
    sofar: yr >= thisYear, partial: months.length > 0 && !(months[0] === 1 && months.at(-1) === 12), tag, kinds, total, apart,
  };
}

/** The months the year's lines cover, in words: "March", "January to October". */
export function monthsWords(months) {
  if (!months?.length) return "";
  const a = MONTHS[months[0] - 1], b = MONTHS[months.at(-1) - 1];
  return a === b ? a : `${a} to ${b}`;
}
const quote = (t) => `“${t}”`;
const tagsSaid = (b) => (b.tag ? `${quote(BANK_TAG)} or ${quote(b.tag)}` : quote(BANK_TAG));
const kindList = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** The row's sentence, one per case (R5). */
export function bankSentence(b, money) {
  if (b.case === "noLines") return `No bank lines are in the plan yet. Add them on Transactions, then type ${tagsSaid(b)} in the Tags box of each line that was for the business.`;
  if (b.case === "noneTied") return `No bank lines are tied to the business for ${b.year} yet. On Transactions, type ${tagsSaid(b)} in the Tags box of its lines (a rule can do it for you), or file them under a category with “business” in its name.`;
  const n = `${b.lines} bank line${b.lines === 1 ? "" : "s"}`, when = b.sofar ? `in ${b.year} so far (${monthsWords(b.months)})` : `in ${b.year}`;
  if (b.case === "noCosts") return `${n} tied to the business ${when} hold${b.lines === 1 ? "s" : ""} no cost this page counts.`;
  return `${n} tied to the business ${when} come${b.lines === 1 ? "s" : ""} to ${money(b.total)} of costs, by the kinds this page uses:`;
}
/** What the row does, said while no line is tied yet. */
export const BANK_THEN = "Then their costs add up here for the year by the kinds this page uses, beside what you typed, and one tap puts the totals in your expenses.";
/** A line set apart, one sentence per kind (and for a car, whether miles are typed). */
export function apartLine(a, money, { miles = 0 } = {}) {
  const m = money(a.amount);
  return {
    car: miles > 0 ? `Car costs of ${m} are not counted: the page counts your business miles at the IRS rate, and a car counts one way or the other, not both.`
      : `Car costs of ${m} are not counted: type your business miles under “The business” instead; the page counts them at the IRS rate, and a car counts one way or the other, not both.`,
    loan: `Loan payments of ${m} are left out: paying back a loan is not a cost.`,
    tax: `Tax payments of ${m} are left out: income and self-employment tax are not business costs.`,
    health: `Health costs of ${m} are left out: health insurance you pay for yourself has its own box under “The business”.`,
    income: `${m} paid out under an income category is left out: it lowers what customers paid, not the costs.`,
  }[a.key] ?? "";
}
/** The row's status, at most 20 characters. */
export function bankStatus(b, money) {
  if (b.case === "noLines") return "no bank lines yet";
  if (b.case === "noneTied") return "none tied yet";
  if (b.case === "noCosts") return `no costs in ${b.year}`;
  return `${money(b.total)} in ${b.year}`;
}
/** The kinds "Use these" would copy: those whose year comes to more than nothing. */
export const usable = (b) => (b?.kinds ?? []).filter((k) => k.amount > 0.005);
/** True when what is typed for every kind already is the bank lines' total (to the dollar): nothing for "Use these" to do. */
export function inUse(b, typed) {
  const ks = usable(b);
  return ks.length > 0 && ks.every((k) => Math.abs((typed?.[k.key] ?? 0) - k.amount) < 0.5);
}
/**
 * The question before "Use these" (ui.confirm). seFigure: the Self-employment page's one figure standing in here, if any;
 * typed: what is typed a year for each kind (typedByKind). A kind whose typed figure is more than the bank lines' total
 * is named with both figures, since a part-year total can replace a whole year's (money critic F3, 2026-11-16).
 */
export function bankAsk(b, money, { seFigure = 0, typed = {} } = {}) {
  const ks = usable(b);
  const down = ks.filter((k) => (typed?.[k.key] ?? 0) > k.amount + 0.5)
    .map((k, i) => `${k.label}${i === 0 ? " would go down from the" : " from"} ${money(typed[k.key])}${i === 0 ? " a year typed here" : ""} to ${money(k.amount)}`);
  return `Use your bank lines' totals for ${b.year} as the year's expenses for ${kindList(ks.map((k) => k.label))}? ${ks.length === 1 ? "They replace what is typed for that kind" : "They replace what is typed for those kinds"}; the other kinds stay as typed.${b.partial ? ` They cover ${monthsWords(b.months)} only.` : ""}${down.length ? ` ${kindList(down)}.` : ""}${seFigure > 0.5 ? ` The ${money(seFigure)} typed as one figure on the Self-employment page stops counting here.` : ""}`;
}
/** The green line's lead after "Use these" (the page adds the new answer, words.js savedLine). */
export function bankSaid(b, money) {
  const ks = usable(b), sum = ks.reduce((x, k) => x + k.amount, 0);
  return `Your bank lines' costs for ${b.year} are in: ${money(sum)} in ${ks.length} kind${ks.length === 1 ? "" : "s"}.`;
}
export const BANK_UNDONE = "Undone. The expenses are back as they were.";

/**
 * useBank(w, b, uid) -> how many kinds it wrote. On the draft of plan.whatIfs.business it is given: for each kind whose
 * year comes to more than nothing, the expenses typed under that kind go and one takes their place, { id, name: "",
 * category, amount (to the cent), period: "annual", bank: the year, bankMonths: [first, last] when the lines cover part
 * of the year only }; every other expense stays as it was.
 */
export function useBank(w, b, uid) {
  const ks = usable(b);
  if (!ks.length) return 0;
  const keys = new Set(ks.map((k) => k.key));
  const kept = (Array.isArray(w.expenses) ? w.expenses : []).filter((e) => !keys.has(CATEGORIES[e?.category] ? e.category : "other"));
  const part = b.partial ? { bankMonths: [b.months[0], b.months.at(-1)] } : {};
  w.expenses = [...kept, ...ks.map((k) => ({ id: uid(), name: "", category: k.key, amount: Math.round(k.amount * 100) / 100, period: "annual", bank: b.year, ...part }))];
  return ks.length;
}

// ---------------------------------------------------------------- an expense put in from the bank lines, said on the page
const monthsOf = (e) => (Array.isArray(e?.bankMonths) && e.bankMonths.length === 2 && e.bankMonths.every((m) => Number.isInteger(m) && m >= 1 && m <= 12) ? e.bankMonths : null);
const yearOfBank = (e) => (Number.isInteger(e?.bank) && e.bank > 1900 ? e.bank : null);
/** Where an expense came from, under it in the list: "From your bank lines, March to April 2026 only" / "for 2025"; null if typed. */
export function bankFrom(e) {
  const y = yearOfBank(e);
  if (!y) return null;
  const m = monthsOf(e);
  return m ? `From your bank lines, ${monthsWords(m)} ${y} only` : `From your bank lines for ${y}`;
}
/**
 * fromBank(expenses) -> { [kind]: words } for each kind whose every expense with an amount came from the bank lines: what
 * "Costs from your bank lines" says beside the kind instead of "a year typed here" (person critic P1).
 */
export function fromBank(expenses) {
  const by = {};
  for (const e of Array.isArray(expenses) ? expenses : []) {
    if (!e || !(Number(e.amount) > 0)) continue;
    const k = CATEGORIES[e.category] ? e.category : "other";
    (by[k] ??= []).push(e);
  }
  const out = {};
  for (const [k, es] of Object.entries(by)) if (es.every((e) => yearOfBank(e))) out[k] = bankFrom(es[0]).replace(/^From your bank lines/, "from your bank lines");
  return out;
}
/**
 * The notice under the answer while expenses put in from the bank lines cover part of a year (person critic P1, R9: a
 * reason to doubt a figure is never folded): the narrowest such span, or null.
 */
export function partNote(expenses) {
  const part = (Array.isArray(expenses) ? expenses : []).filter((e) => e && Number(e.amount) > 0 && yearOfBank(e) && monthsOf(e));
  if (!part.length) return null;
  const e = part.reduce((a, x) => (monthsOf(x)[1] - monthsOf(x)[0] < monthsOf(a)[1] - monthsOf(a)[0] ? x : a));
  return `The costs from your bank lines cover ${monthsWords(monthsOf(e))} ${yearOfBank(e)} only, so the profit leaves out the other months' costs. Use these again under “${BANK_TITLE}” once more lines are in.`;
}

// modules/transactions/categories/compute.js -- PURE. The one list of categories every
// transaction page uses. Defaults come from the Expenses page's categories (kind "expense")
// and the Income page's kinds (kind "income"), plus "transfer". plan.categories holds only
// what the owner changed: renamed or hidden defaults (same id) and categories they added.
// Gap list next 60 #16 (2026-11-16): a category may sit inside another one (`parent`, one level only, the same kind);
// every page that adds money up by category counts it inside that one (rollUp), so every total stays the same.
import { CATEGORIES as EXPENSE } from "../../cashflow/expenses/compute.js";
import { INCOME_TYPES } from "../../cashflow/income/compute.js";
import { partsOf } from "../splits.js";   // where a category is used: a line left out of the totals (gap #32) still carries its category

export const KINDS = { expense: "Spending", income: "Income", transfer: "Transfer between my accounts" };
export const UNCATEGORISED = "";   // a transaction with category "" is waiting for one

export function defaultCategories() {
  return [
    ...Object.entries(EXPENSE).map(([id, c]) => ({ id, label: c.label, icon: c.icon, kind: "expense", essential: c.essential })),
    ...Object.entries(INCOME_TYPES).map(([id, t]) => ({ id: `income-${id}`, label: t.label, icon: t.icon, kind: "income" })),
    { id: "transfer", label: "Transfer between my accounts", icon: "🔁", kind: "transfer" },
  ];
}
/** Every category with the owner's edits applied, hidden ones too, by id (what categoriesOf sorts and filters). */
function merged(plan) {
  const custom = plan.categories ?? [];
  const byId = new Map(defaultCategories().map((c) => [c.id, { ...c, builtIn: true }]));
  for (const c of custom) {
    const base = byId.get(c.id);
    byId.set(c.id, base ? { ...base, ...c, builtIn: true } : { kind: "expense", icon: "📦", ...c, builtIn: false });
  }
  return byId;
}
// ---------------------------------------------------------------- one category inside another (gap list next 60 #16)
const NO_LINKS = new Map();
const parentField = (c) => (typeof c?.parent === "string" && c.parent !== "" ? c.parent : "");
/** True when some entry of plan.categories names a parent: without one, every reader takes its old path (invariance). */
const anyParent = (plan) => Array.isArray(plan?.categories) && plan.categories.some((c) => parentField(c) !== "");
/**
 * The links that count, child id -> parent id. A category's `parent` counts when that category is on the list (known
 * and not hidden), is another one, is of the same kind, and does not itself sit inside another (one level only; of a
 * chain a <- b <- c, b is inside a and c stands on its own). Any other `parent` is read as none.
 */
function linksOf(byId) {
  const fits = new Map();
  for (const c of byId.values()) {
    const p = byId.get(parentField(c));
    if (p && p.id !== c.id && !p.hidden && p.kind === c.kind) fits.set(c.id, p.id);
  }
  const out = new Map();
  for (const [child, parent] of fits) if (!fits.has(parent)) out.set(child, parent);
  return out;
}
/** parentsOf(plan) -> Map(child id -> parent id) of the links that count; the same empty Map when no category has a parent. */
export const parentsOf = (plan) => (anyParent(plan) ? linksOf(merged(plan)) : NO_LINKS);
/** rollUp(plan) -> (id) => the id of the category it sits inside, else the id itself. What a page that adds up by category
 * counts a line under; with no parent set anywhere it gives every id back as it is. */
export function rollUp(plan) {
  const links = parentsOf(plan);
  return links.size ? (id) => links.get(id) ?? id : (id) => id;
}
/** rollUpInto(plan, known) -> (id) => the id when known(id), else the category it sits inside when that one is known, else the
 * id: for a page with a list of its own (Expenses' kinds), so a category of the person's own inside one of them counts
 * there, and one of its own kinds stays itself whatever it sits inside. */
export function rollUpInto(plan, known) {
  const up = rollUp(plan);
  return (id) => (known(id) ? id : known(up(id)) ? up(id) : id);
}
/** childrenOf(plan, id) -> the categories on the list that sit inside `id`, in the list's order. */
export function childrenOf(plan, id) {
  const links = parentsOf(plan);
  return links.size ? categoriesOf(plan).filter((c) => links.get(c.id) === id) : [];
}
/** Every category the plan knows: defaults with the owner's edits applied, plus custom ones; hidden ones excluded unless
 * `all`. Spending, then income, then transfer; alphabetical, a category inside another right under it (gap next-60 #16). */
export function categoriesOf(plan, { all = false } = {}) {
  const byId = merged(plan);
  const list = [...byId.values()].filter((c) => all || !c.hidden);
  const order = { expense: 0, income: 1, transfer: 2 };
  const links = anyParent(plan) ? linksOf(byId) : NO_LINKS;
  if (!links.size) return list.sort((a, b) => order[a.kind] - order[b.kind] || a.label.localeCompare(b.label));
  const top = (c) => byId.get(links.get(c.id)) ?? c;
  return list.sort((a, b) => order[a.kind] - order[b.kind] || top(a).label.localeCompare(top(b).label) || top(a).id.localeCompare(top(b).id)
    || links.has(a.id) - links.has(b.id) || a.label.localeCompare(b.label));
}
export const categoryById = (plan, id) => categoriesOf(plan, { all: true }).find((c) => c.id === id) ?? null;
export const categoryLabel = (plan, id) => id ? (categoryById(plan, id)?.label ?? id) : "Uncategorized";
export const categoryIcon = (plan, id) => id ? (categoryById(plan, id)?.icon ?? "📦") : "❔";
export const slug = (label) => String(label ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "category";

const transferKind = (plan, t) => !!t.category && categoryById(plan, t.category)?.kind === "transfer";
/**
 * compute(plan) -> { categories: [{ ...category, count, total }], byKind: { expense, income, transfer }, uncategorised, custom }
 * count/total are over plan.transactions (total is the sum of amounts, sign as stored).
 */
export function compute(plan) {
  const txs = plan.transactions ?? [];
  const use = new Map();
  let uncategorised = 0;
  // a purchase split across categories (gap #24) counts in each of its parts' categories, for that part's amount
  for (const t of txs.some((x) => x?.splits) ? txs.flatMap((x) => (x?.splits && !transferKind(plan, x) ? partsOf(x) : [x])) : txs) { if (!t.category) { if (t.splitOf === undefined) uncategorised++; continue; } const u = use.get(t.category) ?? { count: 0, total: 0 }; u.count++; u.total += Number(t.amount) || 0; use.set(t.category, u); }
  // `inside`: the category it sits inside, only for a link that counts (parentsOf); none with no parent set (gap next-60 #16)
  const links = parentsOf(plan);
  const categories = categoriesOf(plan, { all: true }).map((c) => ({ ...c, count: use.get(c.id)?.count ?? 0, total: use.get(c.id)?.total ?? 0, ...(links.has(c.id) ? { inside: links.get(c.id) } : {}) }));
  const byKind = { expense: 0, income: 0, transfer: 0 };
  for (const c of categories) if (!c.hidden) byKind[c.kind] = (byKind[c.kind] ?? 0) + 1;
  return { categories, byKind, uncategorised, custom: categories.filter((c) => !c.builtIn).length, total: txs.length };
}

// ---------------------------------------------------------------- the words for one category inside another (gap list next 60 #16)
/** A kind of category in a sentence ("Food is spending and this one is income"). */
export const KIND_WORDS = { expense: "spending", income: "income", transfer: "a transfer between your accounts" };
/** "Groceries", "Groceries and Snacks", "Groceries, Snacks and Eating out". */
export const listOf = (names) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`);
/** The help under the box "Inside another category" (no promise about totals: the question before a save says what changes). */
export const INSIDE_HELP = "Pages that add up your money by category count it inside that one.";
/** The box's first choice. */
export const ON_ITS_OWN = "No, it stands on its own";
/**
 * The categories a category may be put inside: on the list, of `kind`, standing on their own (one level only), and not
 * the category itself. [] for a category that has others inside it (it stays on its own).
 */
export function parentChoices(plan, { id = null, kind = "expense" } = {}) {
  const links = parentsOf(plan);
  if (id && [...links.values()].includes(id)) return [];
  return categoriesOf(plan).filter((c) => c.kind === kind && c.id !== id && !links.has(c.id));
}
/**
 * nestRefused(plan, { id, parent, kind }) -> null, or the one sentence that says why `id` (null for a new category) of
 * `kind` can't be put inside `parent`. A blank parent ("" or none) is always fine: the category stands on its own.
 */
export function nestRefused(plan, { id = null, parent = "", kind = null } = {}) {
  if (!parent) return null;
  if (id && parent === id) return "A category can't be inside itself.";
  const all = categoriesOf(plan, { all: true }), byId = new Map(all.map((c) => [c.id, c]));
  const p = byId.get(parent), me = id ? byId.get(id) : null;
  const k = kind ?? me?.kind ?? "expense";
  if (!p || p.hidden) return `${p?.label ?? parent} is not on your list: pick another, or none.`;
  if (p.kind !== k) return `${p.label} is ${KIND_WORDS[p.kind] ?? p.kind} and this one is ${KIND_WORDS[k] ?? k}: pick one of the same kind, or none.`;
  const links = parentsOf(plan);
  if (links.has(p.id)) return `${p.label} is itself inside ${byId.get(links.get(p.id))?.label ?? links.get(p.id)}: pick one that stands on its own.`;
  if (me && [...links.values()].includes(me.id)) return `${me.label} has categories inside it, so it stays on its own.`;
  return null;
}
/**
 * The categories a page reads by their id for a job of its own, and what that page then does with a category of yours put
 * inside one: there every total does not stay the same, so the question says this instead (critic M4, 2026-11-16). The
 * spending guesses read Expenses' kinds through rollUpInto (overview/guesses/estimators/spend.js: taxes and debt left out of
 * spending, a housing line like the mortgage payment counted from Debts); Dividends counts a category inside a dividend one.
 */
export const READ_AS = Object.freeze({
  taxes: "the spending guesses will leave it out of your spending, as they do taxes you pay yourself",
  debt: "the spending guesses will read it as paying off a loan or card, not as spending",
  housing: "the spending guesses will read a payment in it that looks like your mortgage as that payment, not as spending",
  "income-investment": "the Dividends page will count it as money your investments paid",
});
/**
 * readAs(plan, id, parent) -> what changes besides the sums when `id` goes inside `parent` (a READ_AS clause), else "". One of
 * Expenses' own kinds stays itself on the spending guesses whatever it sits inside (rollUpInto), so only one of yours changes
 * there; any income category inside "Dividends and interest" or one whose name says "dividend" counts on Dividends.
 */
export function readAs(plan, id, parent) {
  if (!parent) return "";
  const p = categoryById(plan, parent);
  if (p?.kind === "income") return parent === "income-investment" || /dividend/i.test(String(p.label ?? "")) ? READ_AS["income-investment"] : "";
  return READ_AS[parent] && !EXPENSE[id] ? READ_AS[parent] : "";
}
/**
 * nestWords(name, was, now, reads = "") -> { ask, done, undone } for a category put inside another, taken out, or moved (was
 * and now are the labels, "" for none; reads: readAs(...) for the new one): the question before the save, the green line
 * after it, the line after its Undo.
 */
export function nestWords(name, was, now, reads = "") {
  const ask = !was ? (reads ? `Put ${name} inside ${now}? Pages that add up your money by category will count it in ${now}, and ${reads}.`
      : `Put ${name} inside ${now}? Pages that add up your money by category will count it in ${now}; every total stays the same.`)
    : !now ? `Take ${name} out of ${was}? It will count on its own again.`
    : `Move ${name} from ${was} into ${now}?${reads ? ` Then ${reads}.` : ""}`;
  return { ask, done: now ? `${name} is now inside ${now}.` : `${name} stands on its own again.`, undone: was ? `Undone: ${name} is inside ${was} again.` : `Undone: ${name} stands on its own again.` };
}
/** The green line after adding a category inside another. */
export const addedInsideWords = (name, parent) => `${name} added, inside ${parent}.`;
/** What happens to the categories inside one that is hidden or removed ("" with none): "Groceries, which is inside it, will
 * stand on its own." (the question starts "Hide Food?", critic P3). */
export const onTheirOwnWords = (names) => (names.length ? `${listOf(names)}, which ${names.length === 1 ? "is" : "are"} inside it, will stand on ${names.length === 1 ? "its" : "their"} own.` : "");
/** Why a category that holds others has no box "Inside another category" (one level only; critic P5). */
export const holdsOthersWords = (name, names) => `${name} can't go inside another category while ${listOf(names)} ${names.length === 1 ? "is" : "are"} inside it.`;
/** The green line's second sentence once they do. */
export const nowOnTheirOwnWords = (names) => (names.length ? `${listOf(names)} ${names.length === 1 ? "stands" : "stand"} on ${names.length === 1 ? "its" : "their"} own now.` : "");
/** unnest(draft, id) -> the ids of the categories that sat inside `id`, now on their own (their `parent` removed). */
export function unnest(draft, id) {
  const out = [];
  for (const c of Array.isArray(draft.categories) ? draft.categories : []) if (c && c.parent === id) { delete c.parent; out.push(c.id); }
  return out;
}

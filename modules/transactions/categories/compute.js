// modules/transactions/categories/compute.js -- PURE. The one list of categories every
// transaction page uses. Defaults come from the Expenses page's categories (kind "expense")
// and the Income page's kinds (kind "income"), plus "transfer". plan.categories holds only
// what the owner changed: renamed or hidden defaults (same id) and categories they added.
// Gap list next 60 #16 (2026-11-16): a category may sit inside another one (`parent`, one level only, the same kind);
// every page that adds money up by category counts it inside that one (rollUp), so every total stays the same.
import { CATEGORIES as EXPENSE } from "../../cashflow/expenses/compute.js";
import { INCOME_TYPES } from "../../cashflow/income/compute.js";
import { partsOf, splitsOf } from "../splits.js";   // where a category is used: a line left out of the totals (gap #32) still carries its category

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

// ---------------------------------------------------------------- combine two categories into one (gap list next 60 #16)
/** The built-in categories the plan reads by name for a job of their own: each can be kept in a combine, never moved into
 * another (the rest of the plan would lose what it finds with it). The bank lines' readers by id (critic M3, 2026-11-16):
 * Dividends (`income-investment`, dividends/compute.js dividendCategories), Rental analysis (`income-rental`,
 * property/rental/books.js), Forecast and the Transactions page's paycheck (`income-salary`), Subscriptions (`subscriptions`). */
export const KEEPS_ITS_JOB = Object.freeze({
  transfer: "it is how the plan tells money you moved apart from money you spent",
  debt: "the plan matches those payments to your debts with it",
  housing: "the plan finds your mortgage payment with it",
  taxes: "the plan keeps taxes you pay yourself apart from your bills with it",
  childcare: "the plan leaves it out of your spending in retirement with it",
  subscriptions: "the Subscriptions page finds your subscriptions with it",
  "income-salary": "the plan finds your paychecks with it",
  "income-investment": "the Dividends page finds what your investments paid with it",
  "income-rental": "the Rental analysis page finds the rent you collect with it",
});
/** The part's words above its two picks (critic P2: no page names, no "envelope"). */
export const MERGE_LEAD = "Everything filed under the first one moves to the second: its transactions, sorting rules, budget and bills. Undo puts it all back.";
/**
 * mergeRefused(plan, from, to) -> null, or the one sentence that says why everything under `from` can't move into `to`.
 */
export function mergeRefused(plan, from, to) {
  if (!from || !to) return "Pick the category to move from and the one to move into.";
  if (from === to) return "Pick two different categories.";
  const byId = new Map(categoriesOf(plan, { all: true }).map((c) => [c.id, c]));
  const a = byId.get(from), b = byId.get(to);
  if (!a || a.hidden) return `${a?.label ?? from} is not on your list any more.`;
  if (!b || b.hidden) return `${b?.label ?? to} is not on your list any more.`;
  if (a.kind !== b.kind) return `${a.label} is ${KIND_WORDS[a.kind] ?? a.kind} and ${b.label} is ${KIND_WORDS[b.kind] ?? b.kind}: pick two of the same kind.`;
  if (a.builtIn && KEEPS_ITS_JOB[a.id]) return `${a.label} can't be moved into another category: ${KEEPS_ITS_JOB[a.id]}. Move the other one into it instead.`;
  const links = parentsOf(plan);
  if (links.get(to) === from) return `${a.label} can't move into ${b.label}: ${b.label} is inside ${a.label}. Move ${b.label} into ${a.label} instead, or take it out of ${a.label} first.`;
  if (links.has(to) && [...links.values()].includes(from)) return `${a.label} has categories inside it, and ${b.label} is inside ${byId.get(links.get(to))?.label ?? links.get(to)}: pick one that stands on its own.`;
  return null;
}
const centsSum = (a, b) => Math.round(((Number(a) || 0) + (Number(b) || 0)) * 100) / 100;
/** Envelopes for `from` join `to`'s (its amount added; the kept one's other settings stay, its rollover too), or become
 * `to`'s. -> { n: how many, rollover: "" | "from" | "to" (the one of the two joined that carried what was left into the next
 * month when the other did not: the joined one carries as the kept one did, and the words say so, critic M2) }. */
function mergeEnvelopes(list, from, to) {
  if (!Array.isArray(list)) return { n: 0, rollover: "" };
  let n = 0, rollover = "", kept = list.find((b) => b?.category === to) ?? null;
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (b?.category !== from) continue;
    n++;
    if (kept) { if (!!b.rollover !== !!kept.rollover) rollover = b.rollover ? "from" : "to"; kept.amount = centsSum(kept.amount, b.amount); list.splice(i, 1); i--; }
    else { b.category = to; kept = b; }
  }
  return { n, rollover };
}
/** Moves between envelopes from or to `from` now name `to`; a move from one envelope to the same one goes. */
function mergeMoves(list, from, to) {
  if (!Array.isArray(list)) return;
  for (const m of list) { if (m?.from === from) m.from = to; if (m?.to === from) m.to = to; }
  for (let i = list.length - 1; i >= 0; i--) if (list[i] && list[i].from === list[i].to) list.splice(i, 1);
}
/**
 * mergeCategories(draft, { from, to }) -> { transactions, rules, envelopes, bills, billsStay, inside, builtIn }: moves
 * everything filed under `from` to `to`, in the draft (one store.update; ui.undoable takes it back exactly):
 *   transactions (and each part of a split purchase; a split whose parts all end in one category is one line again),
 *   rules, budget envelopes (joined: the amounts added; also in kept budgets and in moves between envelopes), bills on
 *   Expenses (only when Expenses' own list has both), the categories inside `from` (now inside `to`), a watched `from`,
 *   a bank file's remembered choice of `from`; then `from` is removed (yours) or hidden (built-in).
 * Call it only when mergeRefused(plan, from, to) is null.
 */
export function mergeCategories(draft, { from, to } = {}) {
  const n = { transactions: 0, rules: 0, envelopes: 0, rollover: "", bills: 0, billsStay: 0, inside: 0, builtIn: defaultCategories().some((c) => c.id === from) };
  for (const t of Array.isArray(draft.transactions) ? draft.transactions : []) {
    if (!t) continue;
    let hit = false;
    if (Array.isArray(t.splits)) {
      // the parts move too; only a split that is used (splitsOf: it adds up) counts here or becomes one line again. One that
      // does not add up counts whole under its own category, which stays as it is unless it is `from` (critic M1)
      const used = !!splitsOf(t);
      for (const s of t.splits) if (s && s.category === from) { s.category = to; if (used) hit = true; }
      if (used && hit && t.splits.every((s) => s?.category === to)) { delete t.splits; t.category = to; }
    }
    if (t.category === from) { t.category = to; hit = true; }
    if (hit) n.transactions++;
  }
  for (const r of Array.isArray(draft.rules) ? draft.rules : []) if (r && r.category === from) { r.category = to; n.rules++; }
  ({ n: n.envelopes, rollover: n.rollover } = mergeEnvelopes(draft.budgets, from, to));
  if (draft.budgetPlan && typeof draft.budgetPlan === "object") mergeMoves(draft.budgetPlan.moves, from, to);
  for (const h of Array.isArray(draft.budgetHistory) ? draft.budgetHistory : []) { if (!h || typeof h !== "object") continue; mergeEnvelopes(h.lines, from, to); mergeMoves(h.moves, from, to); }
  const bills = (Array.isArray(draft.expenses) ? draft.expenses : []).filter((x) => x && x.category === from);
  if (EXPENSE[from] && EXPENSE[to]) { for (const x of bills) x.category = to; n.bills = bills.length; } else n.billsStay = bills.length;
  draft.categories = Array.isArray(draft.categories) ? draft.categories : [];
  for (const c of draft.categories) if (c && c.parent === from) { c.parent = to; n.inside++; }
  if (Array.isArray(draft.spendingWatch)) {
    const watched = draft.spendingWatch.some((w) => w?.kind === "category" && w.key === to);
    draft.spendingWatch = draft.spendingWatch.filter((w) => !(watched && w?.kind === "category" && w.key === from));
    for (const w of draft.spendingWatch) if (w?.kind === "category" && w.key === from) w.key = to;
  }
  for (const prof of Object.values(draft.importProfiles && typeof draft.importProfiles === "object" ? draft.importProfiles : {})) {
    const ch = prof?.categories;
    if (ch && typeof ch === "object") for (const k of Object.keys(ch)) if (ch[k] === from) ch[k] = to;
  }
  const i = draft.categories.findIndex((c) => c?.id === from);
  if (n.builtIn) { if (i >= 0) { draft.categories[i].hidden = true; delete draft.categories[i].parent; } else draft.categories.push({ id: from, hidden: true }); }
  else if (i >= 0) draft.categories.splice(i, 1);
  return n;
}
/** mergeCount(plan, from, to) -> what mergeCategories would move (worked on a copy: the count is the move). */
export const mergeCount = (plan, from, to) => mergeCategories(structuredClone(plan), { from, to });
const counted = (k, one, many) => `${k} ${k === 1 ? one : many}`;
/**
 * mergeWords(plan, from, to, n = mergeCount(...)) -> { line, ask, done, undone }: the count under the two picks, the
 * question before the save, the green line after it and the line after its Undo.
 */
export function mergeWords(plan, from, to, n = mergeCount(plan, from, to)) {
  const all = categoriesOf(plan, { all: true });
  const a = all.find((c) => c.id === from)?.label ?? from, b = all.find((c) => c.id === to)?.label ?? to;
  const items = [n.transactions ? counted(n.transactions, "transaction", "transactions") : "", n.rules ? counted(n.rules, "sorting rule", "sorting rules") : "",
    n.envelopes ? counted(n.envelopes, "budget", "budgets") : "", n.bills ? counted(n.bills, "bill", "bills") : "",
    n.inside ? counted(n.inside, "category inside it", "categories inside it") : ""].filter(Boolean);
  const what = listOf(items), one = items.length === 1 && /^1 /.test(items[0]);
  // the joined budget carries what is left into the next month as the kept one did: said when the two differed (critic M2)
  const roll = n.rollover === "from" ? ` The budget for ${a} carries what is left into the next month and the one for ${b} does not, so the joined budget will not.`
    : n.rollover === "to" ? ` The budget for ${b} carries what is left into the next month, so the joined budget will carry what is left of both.` : "";
  const stay = (n.billsStay ? ` ${n.billsStay === 1 ? "The bill" : `The ${n.billsStay} bills`} filed under ${a} on your Expenses page ${n.billsStay === 1 ? "stays" : "stay"} there: that page keeps its own list.` : "") + roll;
  const after = `${a} is then ${n.builtIn ? "hidden" : "removed"}.`;
  if (!items.length) return { line: `Nothing is filed under ${a} yet; it just leaves your list.${stay}`, ask: `Combine ${a} into ${b}? Nothing is filed under ${a} yet. ${after}${stay}`,
    done: `Done: ${a} is ${n.builtIn ? "hidden" : "removed"}.`, undone: `Undone: ${a} is back.` };
  return { line: `${what} ${one ? "moves" : "move"} from ${a} into ${b}.${stay}`, ask: `Move ${what} from ${a} into ${b}? ${after}${stay}`,
    done: `Done: ${what} moved from ${a} into ${b}.`, undone: `Undone: ${a} is back with everything that was filed under it.` };
}

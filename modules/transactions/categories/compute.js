// modules/transactions/categories/compute.js -- PURE. The one list of categories every
// transaction page uses. Defaults come from the Expenses page's categories (kind "expense")
// and the Income page's kinds (kind "income"), plus "transfer". plan.categories holds only
// what the owner changed: renamed or hidden defaults (same id) and categories they added.
import { CATEGORIES as EXPENSE } from "../../cashflow/expenses/compute.js";
import { INCOME_TYPES } from "../../cashflow/income/compute.js";

export const KINDS = { expense: "Spending", income: "Income", transfer: "Transfer between my accounts" };
export const UNCATEGORISED = "";   // a transaction with category "" is waiting for one

export function defaultCategories() {
  return [
    ...Object.entries(EXPENSE).map(([id, c]) => ({ id, label: c.label, icon: c.icon, kind: "expense", essential: c.essential })),
    ...Object.entries(INCOME_TYPES).map(([id, t]) => ({ id: `income-${id}`, label: t.label, icon: t.icon, kind: "income" })),
    { id: "transfer", label: "Transfer between my accounts", icon: "🔁", kind: "transfer" },
  ];
}
/** Every category the plan knows: defaults with the owner's edits applied, plus custom ones; hidden ones excluded unless `all`. */
export function categoriesOf(plan, { all = false } = {}) {
  const custom = plan.categories ?? [];
  const byId = new Map(defaultCategories().map((c) => [c.id, { ...c, builtIn: true }]));
  for (const c of custom) {
    const base = byId.get(c.id);
    byId.set(c.id, base ? { ...base, ...c, builtIn: true } : { kind: "expense", icon: "📦", ...c, builtIn: false });
  }
  const list = [...byId.values()].filter((c) => all || !c.hidden);
  const order = { expense: 0, income: 1, transfer: 2 };
  return list.sort((a, b) => order[a.kind] - order[b.kind] || a.label.localeCompare(b.label));
}
export const categoryById = (plan, id) => categoriesOf(plan, { all: true }).find((c) => c.id === id) ?? null;
export const categoryLabel = (plan, id) => id ? (categoryById(plan, id)?.label ?? id) : "Uncategorised";
export const categoryIcon = (plan, id) => id ? (categoryById(plan, id)?.icon ?? "📦") : "❔";
export const slug = (label) => String(label ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "category";

/**
 * compute(plan) -> { categories: [{ ...category, count, total }], byKind: { expense, income, transfer }, uncategorised, custom }
 * count/total are over plan.transactions (total is the sum of amounts, sign as stored).
 */
export function compute(plan) {
  const txs = plan.transactions ?? [];
  const use = new Map();
  let uncategorised = 0;
  for (const t of txs) { if (!t.category) { uncategorised++; continue; } const u = use.get(t.category) ?? { count: 0, total: 0 }; u.count++; u.total += Number(t.amount) || 0; use.set(t.category, u); }
  const categories = categoriesOf(plan, { all: true }).map((c) => ({ ...c, count: use.get(c.id)?.count ?? 0, total: use.get(c.id)?.total ?? 0 }));
  const byKind = { expense: 0, income: 0, transfer: 0 };
  for (const c of categories) if (!c.hidden) byKind[c.kind] = (byKind[c.kind] ?? 0) + 1;
  return { categories, byKind, uncategorised, custom: categories.filter((c) => !c.builtIn).length, total: txs.length };
}

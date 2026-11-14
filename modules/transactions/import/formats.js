// modules/transactions/import/formats.js -- PURE. The history other budgeting apps let a person download (gap #33,
// 2026-11-14): YNAB's register, Monarch's transactions and Mint's (Mint closed in 2024; old exports still sit on phones).
// A file whose header names every column one of them must have is read with that app's columns: no guessing, and its
// own categories, notes, tags and account names come along. Anything else (and anything unsure) is read as before by
// compute.js detectMapping. The header sets come from public descriptions of these exports (the gap spec's, read
// 2026-11-13 from third-party converters and parsers), not from a real export: the README says so, the matching is
// tolerant (case, spacing, punctuation, column order, extra columns) and a file that does not read cleanly falls back.
// compute.js reads the rows (it owns the date and money readers); this file holds the tables and the category and
// account helpers, and imports nothing from compute.js.
import { cleanTags, mainCategory, centsOf } from "../splits.js";
import { categoriesOf, slug } from "../categories/compute.js";
import { lineId } from "../../../core/ofx.js";

/** A header or a name as it is compared: lower case, letters and digits, single spaces (the byte-order mark goes too). */
export const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * The three apps' columns. `must`: the roles a header has to name for the file to be that app's; `cols`: for each role, the
 * column names it may carry (first that is there wins). Roles: account, date, payee (the app's own clean name), raw (the
 * bank's text), amount (signed), outflow / inflow (YNAB: both positive, the amount is inflow - outflow), type (Mint:
 * debit / credit gives the sign), category, group (YNAB's category group), note, tags.
 * YNAB 4 (the desktop app) wrote "Master Category" and "Sub Category" beside "Category" ("Master: Sub"): the leaf is read.
 */
export const FORMATS = Object.freeze([
  Object.freeze({ id: "ynab", name: "YNAB", must: ["account", "date", "payee", "outflow", "inflow"],
    cols: { account: ["account"], date: ["date"], payee: ["payee"], outflow: ["outflow"], inflow: ["inflow"], category: ["sub category", "category"], group: ["category group", "master category"], note: ["memo"] } }),
  Object.freeze({ id: "monarch", name: "Monarch", must: ["date", "payee", "raw", "amount", "category", "account"],
    cols: { date: ["date"], payee: ["merchant"], raw: ["original statement"], amount: ["amount"], category: ["category"], account: ["account"], note: ["notes"], tags: ["tags"] } }),
  Object.freeze({ id: "mint", name: "Mint", must: ["date", "payee", "raw", "amount", "type", "category", "account"],
    cols: { date: ["date"], payee: ["description"], raw: ["original description"], amount: ["amount"], type: ["transaction type"], category: ["category"], account: ["account name"], note: ["notes"], tags: ["labels"] } }),
]);

/**
 * matchHeaders(headers) -> { format, at: { role: column index } } | null. Exactly one app's must-have columns, each named
 * once (a header that names a must-have column twice is not sure: null). Order, case, spacing and extra columns do not
 * matter. Two apps matching at once is not sure either: null, and the file is read as any bank file.
 */
export function matchHeaders(headers) {
  const names = (headers ?? []).map(norm);
  const found = [];
  for (const f of FORMATS) {
    const at = {};
    let twice = false;
    for (const [role, list] of Object.entries(f.cols)) {
      for (const n of list) {
        const hits = names.map((x, i) => (x === n ? i : -1)).filter((i) => i >= 0);
        if (!hits.length) continue;
        if (hits.length > 1 && f.must.includes(role)) twice = true;
        at[role] = hits[0];
        break;
      }
    }
    if (!twice && f.must.every((r) => at[r] !== undefined)) found.push({ format: f, at });
  }
  return found.length === 1 ? found[0] : null;
}

// ---------------------------------------------------------------- accounts
/** A file's account name without a masked number at its end ("Checking (...6789)", "Visa x1234", "Card ending 1234"). */
export const plainName = (name) => String(name ?? "").replace(/\s*[(\[]?\s*(?:\.{2,}|…|x+|\*+|#|ending(?: in)?)?\s*\d{3,}\s*[)\]]?\s*$/i, "").trim();
/** A file's account name as the page writes it: one written all in capitals ("CHECKING", Mint's way) in ordinary case ("Checking"). */
export const tidyName = (name) => {
  const s = String(name ?? "").trim();
  return /[a-z]/.test(s) || !/[A-Z]/.test(s) ? s : s.toLowerCase().replace(/(^|[\s(\-/&.])([a-z])/g, (m, a, b) => a + b.toUpperCase());
};
/**
 * accountKey(name) -> a short one-way id of a file's account name, the key importProfiles[].accounts keeps (core/ofx lineId:
 * two FNV-1a sums). An app's account name can carry its last digits ("Checking (...6789)"): the plan never keeps the name.
 */
export const accountKey = (name) => lineId(`acct:${norm(name)}`) ?? "";
/**
 * pickAccount(plan, profile, name) -> { accountId, why } | null: the plan account a file's account most likely is.
 *   why "before": the account its lines went to last time (importProfiles[headerKey].accounts[accountKey(name)]);
 *   why "name": the only plan account with the same name (letters and digits, case and a masked number at its end aside).
 * null: the person picks (never "the first account in the list").
 */
export function pickAccount(plan, profile, name) {
  const accounts = (Array.isArray(plan?.accounts) ? plan.accounts : []).filter((a) => a && typeof a === "object");
  const was = profile?.accounts?.[accountKey(name)];
  if (was && accounts.some((a) => a.id === was)) return { accountId: was, why: "before" };
  const k = norm(plainName(name));
  if (!k) return null;
  const same = accounts.filter((a) => norm(plainName(a.name)) === k);
  return same.length === 1 ? { accountId: same[0].id, why: "name" } : null;
}
/**
 * The plan accounts an app's file account is offered among: a bank or card account (a budgeting app's history is spending).
 * The page adds any other the person would mean: one it picked (last time, the same name), one opened for, one with lines.
 */
export const APP_ACCOUNT_TYPES = Object.freeze(["checking", "savings", "cash", "credit"]);
/** The kind of account to add for a file's account name, for Net worth's add form ("credit", "savings" or "checking"). */
export const addKindFor = (name) => (/\b(card|visa|master ?card|amex|american express|discover|credit)\b/i.test(String(name ?? "")) ? "credit" : /\bsav(ings?)?\b/i.test(String(name ?? "")) ? "savings" : "checking");

// ---------------------------------------------------------------- categories
/** A category name as it is compared: norm, "and" dropped, a plural dropped ("Gifts & Giving" = "gift giving", "Groceries" = "grocery"). */
const one = (w) => (w.length > 4 && w.endsWith("ies") ? `${w.slice(0, -3)}y` : w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
export const catKey = (s) => norm(s).split(" ").filter((w) => w && w !== "and").map(one).join(" ");
/** Names that mean a transfer between your own accounts (a card payment from checking is one: never spending twice). */
const TRANSFER_NAMES = /^(transfers?|credit card payments?|card payments?|balance adjustments?)$/;
/** YNAB's money waiting for a job ("Inflow: Ready to Assign"; "To be Budgeted" before 2022) and "Uncategorized": no category. */
const NO_CATEGORY = /^(ready to assign|to be budgeted|inflow ready to assign|inflow to be budgeted|uncategori[sz]ed)$/;
/**
 * The plan's list of categories (categories/compute.js categoriesOf), safe to read: a `categories` that is not a list reads as
 * the built-in list, and an entry that is not a category is left out (the old path never reads the list, so an app's file
 * must not stop at it either).
 */
const listOf = (plan, opts) => categoriesOf({ categories: (Array.isArray(plan?.categories) ? plan.categories : []).filter((c) => c && typeof c === "object" && c.id) }, opts);
/** true when a file's category says nothing the plan can use: the line waits on Categorize, as any bank line. */
export const noCategory = (name, group = "") => !norm(name) || NO_CATEGORY.test(norm(name)) || norm(group) === "inflow";
/**
 * categoryByName(plan, name, { moneyIn }) -> a category id of the plan's list, or null. Mapped by name: the same name as a
 * category's label, its id, or one part of its label split at commas, slashes, "and" and "or" ("Rent" is "Rent or
 * mortgage", "Interest" is "Dividends and interest", "Gas" is "Car, gas, transit"), compared by catKey. A transfer's own
 * names ("Transfer", "Credit Card Payment", "Balance Adjustments") are the plan's "Transfer between my accounts". Two hits:
 * the one of the lines' own kind (money in: income), else none. Hidden categories are never picked.
 */
export function categoryByName(plan, name, { moneyIn = false } = {}) {
  const k = catKey(name);
  if (!k) return null;
  if (TRANSFER_NAMES.test(norm(name))) return "transfer";
  const hits = listOf(plan).filter((c) => [c.label, c.id, ...String(c.label ?? "").split(/,|\/|\band\b|\bor\b/i)].some((x) => catKey(x) === k));
  if (hits.length === 1) return hits[0].id;
  const same = hits.filter((c) => c.kind === (moneyIn ? "income" : "expense"));
  return same.length === 1 ? same[0].id : null;
}
/** YNAB's own mark of a transfer between two accounts: the payee "Transfer : Savings". */
export const isTransferPayee = (payee) => /^transfer\s*:/i.test(String(payee ?? "").trim());

/**
 * fileCategories(plan, { txs, meta, choices, saved }) -> { txs, rows, newCategories, fromFile }
 * The file's own categories on its lines, before the rules run (the rules then file what is left; applyRules leaves a line
 * with a category alone).
 *   rows: one per category name on these lines (catKey), in order of first use: { key, name, count, moneyIn, auto (the
 *     name match, or null), choice: a category id, "+new" (add it as a new category) or "" (leave the lines for
 *     Categorize) }. The choice is the person's on this visit (`choices[key]`), else the one saved for this file layout
 *     (`saved[key]`, while that category is still on the list, or ""), else the name match, else "". A "+new" choice for a
 *     name the list already has (a label with the same catKey: added by this file's import for another of its accounts, which
 *     carries the person's choices on) is that category: the list never gets the same name twice.
 *   newCategories: [{ id, label, icon, kind, essential }] for "+new" choices whose lines come in: a free id (slug), kind
 *     income when half or more of its lines are money in, else expense.
 *   Never offered: YNAB's "Ready to Assign" and its Inflow group, "Uncategorized" (noCategory). A YNAB line with no
 *   category whose payee is "Transfer : <account>" is a transfer.
 *   fromFile: the ids of the lines that got a category here.
 */
export function fileCategories(plan, { txs, meta, choices = null, saved = null }) {
  const rows = [], byKey = new Map();
  meta.forEach((m, i) => {
    if (noCategory(m.category, m.group)) return;
    const key = catKey(m.category);
    if (!key) return;
    let r = byKey.get(key);
    if (!r) { r = { key, name: m.category, count: 0, in: 0 }; byKey.set(key, r); rows.push(r); }
    r.count++;
    if (Number(txs[i].amount) > 0) r.in++;
  });
  const known = new Set(listOf(plan, { all: true }).map((c) => c.id));
  const shown = listOf(plan), visible = new Set(shown.map((c) => c.id));
  const taken = new Set(known), newCategories = [], newId = new Map();
  for (const r of rows) {
    r.moneyIn = r.in >= r.count / 2;
    r.auto = categoryByName(plan, r.name, { moneyIn: r.moneyIn });
    const mine = choices?.[r.key], kept = saved?.[r.key];
    const ok = (v) => v === "" || v === "+new" || visible.has(v);
    r.choice = mine !== undefined && ok(mine) ? mine : kept !== undefined && (kept === "" || visible.has(kept)) ? kept : r.auto ?? "";
    if (r.choice === "+new") { const there = shown.find((c) => catKey(c.label) === r.key); if (there) r.choice = there.id; }
    delete r.in;
    if (r.choice === "+new") {
      let id = slug(r.name), n = 2;
      while (taken.has(id)) id = `${slug(r.name)}-${n++}`;
      taken.add(id);
      newId.set(r.key, id);
      newCategories.push({ id, label: String(r.name).trim().slice(0, 60), icon: "📦", kind: r.moneyIn ? "income" : "expense", essential: false });
    }
  }
  const fromFile = new Set();
  const out = txs.map((t, i) => {
    const m = meta[i];
    let category = "";
    if (!noCategory(m.category, m.group)) { const r = byKey.get(catKey(m.category)); category = r ? (r.choice === "+new" ? newId.get(r.key) : r.choice) : ""; }
    else if (!norm(m.category) && isTransferPayee(m.payee)) category = "transfer";
    if (!category) return t;
    fromFile.add(t.id);
    return { ...t, category };
  });
  return { txs: out, rows, newCategories, fromFile };
}

/**
 * mergeSplits(txs, meta, txKey) -> { txs, meta, merged }: YNAB writes a purchase split across categories as one row per part,
 * each memo starting "(Split 1/3)". The parts of one purchase (in a row, the same day and payee, numbered 1 to n) become one
 * transaction: the amount is their sum, `splits` holds the parts ({ category, amount }, splits.js), and `category` the
 * biggest part's (mainCategory). Parts that all carry one category need no splits. Anything that does not add up to a
 * whole purchase (a part missing, out of order) stays as rows, as before. `merged`: how many purchases were put back together.
 * `partKeys`: Map(merged transaction's id -> its parts' own keys), so a purchase brought in part by part before (the file read as
 * any bank file, before 2026-11-14) is known to be on file already.
 */
export function mergeSplits(txs, meta, txKey) {
  const outT = [], outM = [], partKeys = new Map();
  let merged = 0;
  for (let i = 0; i < txs.length; i++) {
    const s = meta[i]?.split;
    if (!s || s.i !== 1 || s.n < 2) { outT.push(txs[i]); outM.push(meta[i]); continue; }
    const group = [i];
    for (let j = i + 1; j < txs.length && group.length < s.n; j++) {
      const q = meta[j]?.split;
      if (!q || q.n !== s.n || q.i !== group.length + 1 || txs[j].date !== txs[i].date || txs[j].rawPayee !== txs[i].rawPayee) break;
      group.push(j);
    }
    if (group.length !== s.n) { outT.push(txs[i]); outM.push(meta[i]); continue; }
    const parts = group.map((j) => ({ category: txs[j].category ?? "", amount: centsOf(txs[j].amount) / 100 }));
    const total = parts.reduce((a, p) => a + centsOf(p.amount), 0) / 100;
    const cats = [...new Set(parts.map((p) => p.category))];
    const usable = parts.every((p) => centsOf(p.amount) !== 0 && Math.sign(centsOf(p.amount)) === Math.sign(centsOf(total))) && centsOf(total) !== 0;
    const notes = [...new Set(group.map((j) => txs[j].note).filter(Boolean))].join("; ");
    const tags = cleanTags(group.flatMap((j) => txs[j].tags ?? []));
    const t = { ...txs[i], amount: total, category: cats.length === 1 ? cats[0] : mainCategory(parts), tags, note: notes, ...(cats.length > 1 && usable ? { splits: parts } : {}) };
    t.key = txKey(t);
    partKeys.set(t.id, group.map((j) => txs[j].key ?? txKey(txs[j])));
    outT.push(t); outM.push({ ...meta[i], split: null });
    merged++;
    i = group[group.length - 1];
  }
  return { txs: outT, meta: outM, merged, partKeys };
}

/**
 * profileFor(prev, prep, { accountId, mapping, flipSign }) -> what importProfiles[headerKey] keeps after an import.
 * Any file but the three apps': { accountId, mapping, flipSign }, exactly as before. One of theirs also keeps, beside what it
 * kept before, `accounts` ({ [accountKey(name)]: accountId }: where each of the file's accounts went) and `categories`
 * ({ [catKey]: id | "" }: only the choices that differ from the name match, a new category by its new id). Never a name.
 */
export function profileFor(prev, prep, { accountId, mapping, flipSign }) {
  const base = { accountId, mapping, flipSign };
  if (!prep?.format) return base;
  const accounts = { ...(prev?.accounts ?? {}) };
  if (prep.fileAccount !== null && prep.fileAccount !== undefined && accountId) accounts[accountKey(prep.fileAccount)] = accountId;
  const categories = { ...(prev?.categories ?? {}) };
  const ids = new Map((prep.newCategories ?? []).map((c) => [catKey(c.label), c.id]));
  for (const r of prep.categoryRows ?? []) {
    const v = r.choice === "+new" ? ids.get(r.key) ?? "" : r.choice;
    if (v === (r.auto ?? "") || (r.choice === "+new" && !ids.has(r.key))) delete categories[r.key]; else categories[r.key] = v;
  }
  return { ...base, ...(Object.keys(accounts).length ? { accounts } : {}), ...(Object.keys(categories).length ? { categories } : {}) };
}

/**
 * undoCategories(draft, im) -> the labels taken off the list: the categories an import added (imports[].categories) that
 * nothing uses any more once its lines are gone (no transaction or split part, rule or budget). Run after the lines are removed.
 */
export function undoCategories(draft, im) {
  const ids = im?.categories ?? [];
  if (!ids.length || !Array.isArray(draft.categories)) return [];
  const used = new Set();
  for (const t of draft.transactions ?? []) { if (t?.category) used.add(t.category); for (const p of Array.isArray(t?.splits) ? t.splits : []) if (p?.category) used.add(p.category); }
  for (const r of draft.rules ?? []) if (r?.category) used.add(r.category);
  for (const b of draft.budgets ?? []) if (b?.category) used.add(b.category);
  const gone = [];
  draft.categories = draft.categories.filter((c) => { if (ids.includes(c?.id) && !used.has(c.id)) { gone.push(c.label ?? c.id); return false; } return true; });
  return gone;
}

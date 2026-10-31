// modules/system/audit/compute.js -- PURE. A change log built from the copies the PC keeps (server/server.mjs copies
// data/plan.json to data/backups/plan-<time>.json before every save). A copy is the plan just before a save, so the
// copy made at one save and the next copy (or the plan now, for the newest) hold the plan before and after that save:
// comparing them in order says what each save changed, and when. Records are named (an account, a goal, a payee), so
// a person can recognise their own change.
import { SECTIONS, sectionLabel, unstamped, whenOf, listOf, asPlan } from "../backups/compute.js";
import { PAPERS } from "../../household/documents/compute.js";
import { KINDS as DOC_KINDS } from "../../estate/documents/compute.js";
import { categoryLabel } from "../../transactions/categories/compute.js";
import { migrate } from "../../../core/schema/migrate.js";

export { whenOf, listOf, asPlan };

/** Lists inside a section that hold records of their own, in plain words. Others: "<section>, <field in words>". */
export const NESTED = {
  "household.people": "People", "insurance.policies": "Insurance policies", "estate.documents": "Will and estate papers",
  "estate.beneficiaries": "Beneficiaries", "estate.gifts": "Gifts", "estate.digital": "Digital accounts",
  "retirement.pensions": "Pensions", "retirement.contributions": "Retirement saving", "retirement.annuities": "Annuities",
  "taxes.gains": "Investment sales", "taxes.extraDocuments": "Extra tax forms",
  "equity.grants": "Work stock grants", "equity.espp": "Employee stock purchase plan",
};
/**
 * Details whose name in the plan reads badly as words; "<section>.<detail>" for a word that depends on where it is (a
 * loan's rate is its interest rate, a goal's is how fast its savings grow). Others: the name split at its capitals
 * ("filingStatus" -> "filing status").
 */
export const FIELD_WORDS = {
  returnStocks: "stock returns", returnBonds: "bond returns", returnCash: "cash returns", salaryGrowth: "pay growth",
  stdevStocks: "how much stocks swing", stdevBonds: "how much bonds swing", planEndAge: "age the plan runs to",
  emergencyMonths: "months of emergency savings", spendingMonthly: "monthly spending", stocksNow: "stocks now",
  stocksRetired: "stocks once retired", dependentsUnder17: "children under 17", thisYear: "this year's figures",
  priorYear: "last year's figures", hsa: "health savings account", ownerId: "owner", accountId: "account", personId: "person",
  extra: "extra payment", minPayment: "minimum payment", asOf: "balance date", fundedBy: "accounts it is saved in",
  inflates: "grows with prices", termMonths: "loan length", period: "how often", costBasis: "what you paid",
  monthlyAtFRA: "monthly benefit at full retirement age", creditLimit: "credit limit",
  "debts.rate": "interest rate", "goals.rate": "growth per year", "goals.monthly": "monthly saving",
  "meta.name": "plan name", "meta.currency": "currency", "meta.locale": "language and number format",
};
const IGNORE = new Set(["schemaVersion"]);
/** Sections that are lookups kept by the app (one entry per bank file layout): one "changed", never their keys. */
const LOOKUPS = new Set(["importProfiles"]);
/** Kinds of record in plain words, for records with no name; they follow "added", "removed" or "changed". */
const KIND_WORDS = {
  marriage: "getting married", baby: "a baby or adoption", job: "a new job", move: "a move", inheritance: "an inheritance", divorce: "a divorce",
  term: "a term life policy", whole: "a permanent life policy", disability: "a disability policy", ltc: "a long-term care policy", health: "a health plan",
  home: "a home", auto: "a car policy", umbrella: "an umbrella policy", rental: "a rental", vehicle: "a vehicle", purchase: "a planned purchase",
};

/** Nothing in it: missing, null, an empty list, an empty object or empty text (a section the app has not filled yet). */
const blank = (v) => v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length) || (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length);
const same = (a, b) => (blank(a) && blank(b)) || JSON.stringify(a) === JSON.stringify(b);
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
/** A record's own key: its id, else key, month (monthly reviews) or date (net worth history). */
const idOf = (x) => (isObj(x) ? x.id ?? x.key ?? x.month ?? x.date ?? null : null);
const keyed = (list) => Array.isArray(list) && list.length > 0 && list.every((x) => idOf(x) !== null && idOf(x) !== undefined);
const listy = (x) => x === undefined || x === null || Array.isArray(x);

/** "filingStatus" -> "filing status"; FIELD_WORDS first, the section's own word before the general one. */
export const words = (f, section = "") => FIELD_WORDS[`${section}.${f}`] ?? FIELD_WORDS[f] ?? String(f).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();

/** A plan as the app sees it: brought up to date by core/schema/migrate.js (on a clone), so a default the app filled in later is no change. */
export const prepare = (plan) => migrate(structuredClone(plan));

/**
 * A record's name as shown: { text, amount?, date? }. Its own name (name, payee, label, title, term); else what the
 * section says it is about: the account (a loan's details, a checked statement), the policy, the paper (household
 * documents' checklist), the will or other legal paper (estate documents' names, with the person), the budget's
 * category, the gift's receiver, the tax form, the shares' purchase day; else its kind, month or day. Never a key the
 * app made up ("policy:k3x9"). A transaction also carries its amount and day, so "Coffee" on two days can be told apart.
 */
export function labelOf(rec, plan, section = "") {
  if (!isObj(rec)) return { text: "an item" };
  const acct = (id) => (plan?.accounts ?? []).find((a) => a?.id === id)?.name ?? null;
  const person = (id) => (plan?.household?.people ?? []).find((x) => x?.id === id)?.name ?? null;
  const policy = (id) => { const p = (plan?.insurance?.policies ?? []).find((x) => x?.id === id); return p ? (String(p.name ?? "").trim() || KIND_WORDS[p.kind] || "a policy") : null; };
  const own = [rec.name, rec.payee, rec.label, rec.title, rec.term].find((x) => typeof x === "string" && x.trim());
  let text = own ? own.trim() : null;
  // where a paper is kept: its row key names the paper ("birth:<personId>", "policy:<policyId>")
  if (!text && section === "papers" && typeof rec.key === "string") {
    const [k, id] = rec.key.split(":");
    if (k === "policy") text = policy(id) ? `Papers for ${policy(id)}` : "Insurance policy papers";
    else { const paper = PAPERS.find((x) => x.key === k); if (paper) text = person(id) ? `${paper.label} (${person(id)})` : paper.label; }
  }
  if (!text && section === "estate.documents" && DOC_KINDS[rec.kind]) text = person(rec.personId) ? `${DOC_KINDS[rec.kind].label} (${person(rec.personId)})` : DOC_KINDS[rec.kind].label;
  if (!text && section === "budgets" && rec.category !== undefined) text = `Envelope for ${categoryLabel(plan ?? {}, rec.category)}`;
  if (!text && section === "estate.gifts" && typeof rec.to === "string" && rec.to.trim()) text = `Gift to ${rec.to.trim()}`;
  if (!text && section === "taxes.extraDocuments" && typeof rec.form === "string" && rec.form.trim()) text = rec.form.trim();
  if (!text && section === "equity.espp" && rec.purchaseDate) text = `Shares bought ${rec.purchaseDate}`;
  if (!text && rec.accountId && acct(rec.accountId)) text = section === "reconciliations" ? `Statement for ${acct(rec.accountId)}` : acct(rec.accountId);
  if (!text && rec.policyId && policy(rec.policyId)) text = policy(rec.policyId);
  if (!text && KIND_WORDS[rec.kind]) text = KIND_WORDS[rec.kind];
  if (!text) text = rec.month ?? rec.date ?? (typeof rec.key === "string" && !rec.key.includes(":") ? rec.key : null) ?? "an item";
  const out = { text };
  if (section === "transactions") { if (Number.isFinite(Number(rec.amount))) out.amount = Number(rec.amount); if (rec.date) out.date = rec.date; }
  if (section === "reconciliations" && rec.to) out.date = rec.to;
  return out;
}

/** Records added, removed and changed between two lists, named from the plan they are in. */
function records(x, y, older, newer, section) {
  const before = new Map((x ?? []).map((r) => [String(idOf(r)), r])), after = new Map((y ?? []).map((r) => [String(idOf(r)), r]));
  const added = [], removed = [], changed = [];
  for (const [id, r] of after) {
    if (!before.has(id)) { added.push(labelOf(r, newer, section)); continue; }
    const was = before.get(id);
    if (same(was, r)) continue;
    // which of its details changed, in words ("balance", "target")
    const fields = isObj(was) && isObj(r) ? [...new Set([...Object.keys(was), ...Object.keys(r)])].filter((f) => !same(was[f], r[f])).map((f) => words(f, section)) : [];
    changed.push({ ...labelOf(r, newer, section), fields });
  }
  for (const [id, r] of before) if (!after.has(id)) removed.push(labelOf(r, older, section));
  return { added, removed, changed };
}

/**
 * What one save changed, section by section, in the order of the app's sections:
 * [{ key, label, added: [label], removed: [label], changed: [label], details: [words], count, pages? }]
 * - a list of records (each with an id, key, month or date): the records added, removed and changed, by name (a
 *   changed one with `fields`, its details that differ, in words);
 * - a section that is an object (household, insurance, retirement...): its details that differ, in words, and any list
 *   of records inside it (people, policies) as an entry of its own ("Insurance policies");
 * - page notes: the pages whose note changed, by address (`pages: true`; the view names them); a lookup the app keeps
 *   (bank file layouts): "changed";
 * - anything else (a list without ids, a note): one detail, "changed".
 * A missing section and an empty one are the same. `meta` counts without its save stamps (the plan's name, currency
 * and language do count); `schemaVersion` never. `count` = records + details. Pass plans through prepare() first, so a
 * default the app filled in later is no change.
 */
export function changesBetween(older, newer) {
  const a = isObj(older) ? unstamped(older) : {}, b = isObj(newer) ? unstamped(newer) : {};
  const order = Object.keys(SECTIONS);
  const rank = (k) => (order.includes(k) ? order.indexOf(k) : 999);
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !IGNORE.has(k)).sort((x, y) => rank(x) - rank(y) || x.localeCompare(y));
  const out = [];
  const push = (key, label, parts, extra = {}) => {
    const e = { key, label, added: parts.added ?? [], removed: parts.removed ?? [], changed: parts.changed ?? [], details: parts.details ?? [], ...extra };
    e.count = e.added.length + e.removed.length + e.changed.length + e.details.length;
    if (e.count) out.push(e);
  };
  for (const k of keys) {
    const x = a[k], y = b[k];
    if (same(x, y)) continue;
    const label = sectionLabel(k);
    if (LOOKUPS.has(k)) { push(k, label, { details: ["changed"] }); continue; }
    if ((keyed(x) || keyed(y)) && listy(x) && listy(y)) { push(k, label, records(x, y, a, b, k)); continue; }
    if ((isObj(x) || blank(x)) && (isObj(y) || blank(y))) {
      const fx0 = isObj(x) ? x : {}, fy0 = isObj(y) ? y : {};
      const details = [], inner = [];
      for (const f of [...new Set([...Object.keys(fx0), ...Object.keys(fy0)])]) {
        const fx = fx0[f], fy = fy0[f];
        if (same(fx, fy)) continue;
        if (k !== "pageNotes" && (keyed(fx) || keyed(fy)) && listy(fx) && listy(fy)) inner.push([f, records(fx, fy, a, b, `${k}.${f}`)]);
        else details.push(k === "pageNotes" ? f : words(f, k));
      }
      push(k, label, { details }, k === "pageNotes" ? { pages: true } : {});
      for (const [f, parts] of inner) push(`${k}.${f}`, NESTED[`${k}.${f}`] ?? `${label}, ${words(f, k)}`, parts);
      continue;
    }
    push(k, label, { details: ["changed"] });
  }
  return out;
}

/**
 * One save: { when, by, changes, count, unreadable } from the copy made at it (`from`: { when, plan }) and the next
 * copy or the plan now (`to`: { plan }). A plan that is null (a damaged copy) makes it unreadable. `by` = the device
 * the newer side records as having saved it (`meta.updatedBy`), when the plan records one.
 */
export function entryFor(from, to) {
  const by = typeof to?.plan?.meta?.updatedBy === "string" && to.plan.meta.updatedBy.trim() ? to.plan.meta.updatedBy.trim() : null;
  if (!from?.plan || !to?.plan) return { when: from?.when ?? null, by, changes: [], count: 0, unreadable: true };
  const changes = changesBetween(from.plan, to.plan);
  return { when: from.when ?? null, by, changes, count: changes.reduce((s, c) => s + c.count, 0), unreadable: false };
}

/**
 * The change log, newest first, from `steps`: the copies oldest first [{ name, when, plan }] (plan null when the copy
 * is damaged), then the plan now { plan }. Save i (at copy i's time) changed copy i into copy i + 1. Each plan is
 * brought up to date first (prepare) unless `prepared`.
 * -> { entries: [{ when, by, changes, count, unreadable }], quiet (saves where nothing you can see changed) }
 */
export function timeline(steps, { prepared = false } = {}) {
  const list = (steps ?? []).map((s) => (prepared || !s?.plan ? s : { ...s, plan: prepare(s.plan) }));
  const entries = [];
  let quiet = 0;
  for (let i = list.length - 2; i >= 0; i--) {
    const e = entryFor(list[i], list[i + 1]);
    if (!e.unreadable && !e.count) { quiet++; continue; }
    entries.push(e);
  }
  return { entries, quiet };
}

/** The labels of one change, the first `max` then how many more: { shown, more }. */
export function firstOf(labels, max = 3) {
  const l = labels ?? [];
  return { shown: l.slice(0, max), more: Math.max(0, l.length - max) };
}

/** compute(plan) -> { savedAt, by } (the change log itself comes from the PC's copies; see view.js). */
export function compute(plan) {
  return { savedAt: plan?.meta?.updatedAt ?? null, by: typeof plan?.meta?.updatedBy === "string" && plan.meta.updatedBy.trim() ? plan.meta.updatedBy.trim() : null };
}

// modules/system/audit/compute.js -- PURE. A change log built from the copies the PC keeps (server/server.mjs copies
// data/plan.json to data/backups/plan-<time>.json before every save). A copy is the plan just before a save, so the
// copy made at one save and the next copy (or the plan now, for the newest) hold the plan before and after that save:
// comparing them in order says what each save changed, and when. Records are named (an account, a goal, a payee), so
// a person can recognise their own change.
import { SECTIONS, whenOf, listOf } from "../backups/compute.js";
import { PAPERS } from "../../household/documents/compute.js";

export { whenOf, listOf };

/** Lists inside a section that hold records of their own, in plain words. Others: "<section>: <field in words>". */
export const NESTED = {
  "household.people": "People", "insurance.policies": "Insurance policies", "estate.documents": "Will and estate papers",
  "estate.beneficiaries": "Beneficiaries", "retirement.pensions": "Pensions", "retirement.contributions": "Retirement saving",
  "equity.grants": "Work stock grants", "equity.espp": "Employee stock purchase plan",
};
/** Details whose name in the plan reads badly as words. Others: the name split at its capitals ("filingStatus" -> "filing status"). */
export const FIELD_WORDS = {
  returnStocks: "stock returns", returnBonds: "bond returns", returnCash: "cash returns", salaryGrowth: "pay growth",
  stdevStocks: "how much stocks swing", stdevBonds: "how much bonds swing", planEndAge: "age the plan runs to",
  emergencyMonths: "months of emergency savings", spendingMonthly: "monthly spending", stocksNow: "stocks now",
  stocksRetired: "stocks once retired", dependentsUnder17: "children under 17", thisYear: "this year's figures",
  priorYear: "last year's figures", hsa: "health savings account", ownerId: "owner", accountId: "account", personId: "person",
};
const IGNORE = new Set(["meta", "schemaVersion"]);
/** Kinds of record in plain words, for records with no name (a life event, an insurance policy without one). */
const KIND_WORDS = {
  marriage: "Getting married", baby: "A baby or adoption", job: "A new job", move: "A move", inheritance: "An inheritance", divorce: "A divorce",
  term: "Term life policy", whole: "Permanent life policy", disability: "Disability policy", ltc: "Long-term care policy", health: "Health plan",
  home: "Home", auto: "Car policy", umbrella: "Umbrella policy", rental: "Rental", vehicle: "Vehicle", purchase: "Planned purchase",
};

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
/** A record's own key: its id, else key, month (monthly reviews) or date (net worth history). */
const idOf = (x) => (isObj(x) ? x.id ?? x.key ?? x.month ?? x.date ?? null : null);
const keyed = (list) => Array.isArray(list) && list.length > 0 && list.every((x) => idOf(x) !== null && idOf(x) !== undefined);
const listy = (x) => x === undefined || x === null || Array.isArray(x);

/** "filingStatus" -> "filing status" (or FIELD_WORDS). */
export const words = (f) => FIELD_WORDS[f] ?? String(f).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();

/**
 * A record's name as shown: { text, amount?, date? }. Its own name (name, payee, label, title, term), else the
 * account it is about (a loan's details, a checked statement), else its kind or its month or day. A transaction also
 * carries its amount and day, so "Coffee" on two days can be told apart.
 */
export function labelOf(rec, plan, section = "") {
  if (!isObj(rec)) return { text: String(rec ?? "an item") };
  const acct = (id) => (plan?.accounts ?? []).find((a) => a?.id === id)?.name ?? null;
  const own = [rec.name, rec.payee, rec.label, rec.title, rec.term].find((x) => typeof x === "string" && x.trim());
  let text = own ? own.trim() : null;
  // where a paper is kept: its row key names the paper ("birth:<personId>", "policy:<policyId>")
  if (!text && section === "papers" && typeof rec.key === "string") {
    const [k, id] = rec.key.split(":");
    if (k === "policy") text = (plan?.insurance?.policies ?? []).find((x) => x?.id === id)?.name ?? "Insurance policy papers";
    else { const paper = PAPERS.find((x) => x.key === k); const who = (plan?.household?.people ?? []).find((x) => x?.id === id)?.name; if (paper) text = who ? `${paper.label} (${who})` : paper.label; }
  }
  if (!text && rec.accountId && acct(rec.accountId)) text = section === "reconciliations" ? `Statement for ${acct(rec.accountId)}` : acct(rec.accountId);
  if (!text && KIND_WORDS[rec.kind]) text = KIND_WORDS[rec.kind];
  if (!text) text = rec.month ?? rec.date ?? (typeof rec.key === "string" ? rec.key : null) ?? "an item";
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
    const fields = isObj(was) && isObj(r) ? [...new Set([...Object.keys(was), ...Object.keys(r)])].filter((f) => !same(was[f], r[f])).map(words) : [];
    changed.push({ ...labelOf(r, newer, section), fields });
  }
  for (const [id, r] of before) if (!after.has(id)) removed.push(labelOf(r, older, section));
  return { added, removed, changed };
}

/**
 * What one save changed, section by section, in the order of the app's sections:
 * [{ key, label, added: [label], removed: [label], changed: [label], details: [words], count }]
 * - a list of records (each with an id, key, month or date): the records added, removed and changed, by name (a
 *   changed one with `fields`, its details that differ, in words);
 * - a section that is an object (household, insurance, retirement...): its details that differ, in words, and any list
 *   of records inside it (people, policies) as an entry of its own ("Insurance policies");
 * - anything else (a list without ids, a note): one detail, "changed".
 * `meta` and `schemaVersion` never count (they differ on every save). `count` = records + details.
 */
export function changesBetween(older, newer) {
  const a = isObj(older) ? older : {}, b = isObj(newer) ? newer : {};
  const order = Object.keys(SECTIONS);
  const rank = (k) => (order.includes(k) ? order.indexOf(k) : 999);
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !IGNORE.has(k)).sort((x, y) => rank(x) - rank(y) || x.localeCompare(y));
  const out = [];
  const push = (key, label, parts) => {
    const e = { key, label, added: parts.added ?? [], removed: parts.removed ?? [], changed: parts.changed ?? [], details: parts.details ?? [] };
    e.count = e.added.length + e.removed.length + e.changed.length + e.details.length;
    if (e.count) out.push(e);
  };
  for (const k of keys) {
    const x = a[k], y = b[k];
    if (same(x, y)) continue;
    const label = SECTIONS[k] ?? words(k);
    if ((keyed(x) || keyed(y)) && listy(x) && listy(y)) { push(k, label, records(x, y, a, b, k)); continue; }
    if ((isObj(x) || x === undefined) && (isObj(y) || y === undefined)) {
      const details = [], inner = [];
      for (const f of [...new Set([...Object.keys(x ?? {}), ...Object.keys(y ?? {})])]) {
        const fx = x?.[f], fy = y?.[f];
        if (same(fx, fy)) continue;
        if ((keyed(fx) || keyed(fy)) && listy(fx) && listy(fy)) inner.push([f, records(fx, fy, a, b, `${k}.${f}`)]);
        else details.push(words(f));
      }
      push(k, label, { details });
      for (const [f, parts] of inner) push(`${k}.${f}`, NESTED[`${k}.${f}`] ?? `${label}: ${words(f)}`, parts);
      continue;
    }
    push(k, label, { details: ["changed"] });
  }
  return out;
}

/**
 * The change log, newest first, from `steps`: the copies oldest first [{ name, when, plan }] (plan null when the copy
 * could not be read), then the plan now { plan }. Save i (at copy i's time) changed copy i into copy i + 1.
 * -> { entries: [{ when, by, changes, count, unreadable }], quiet (saves where nothing you can see changed) }
 * `by` = the device the newer side records as having saved it (`meta.updatedBy`), when the plan records one.
 */
export function timeline(steps) {
  const list = steps ?? [];
  const entries = [];
  let quiet = 0;
  for (let i = list.length - 2; i >= 0; i--) {
    const from = list[i], to = list[i + 1];
    const by = typeof to?.plan?.meta?.updatedBy === "string" && to.plan.meta.updatedBy.trim() ? to.plan.meta.updatedBy.trim() : null;
    if (!from?.plan || !to?.plan) { entries.push({ when: from?.when ?? null, by, changes: [], count: 0, unreadable: true }); continue; }
    const changes = changesBetween(from.plan, to.plan);
    const count = changes.reduce((s, c) => s + c.count, 0);
    if (!count) { quiet++; continue; }
    entries.push({ when: from.when, by, changes, count, unreadable: false });
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

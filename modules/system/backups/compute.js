// modules/system/backups/compute.js -- PURE. The PC keeps a copy of the plan before every save (server/server.mjs,
// data/backups/plan-<time>.json). This reads a copy's time from its name, and compares two plans section by section in
// plain words (what was added, removed or changed between a copy and now), so a restore is a choice you can see.

/** The plan's sections in plain words, in the order shown. Sections not listed keep their own name. */
export const SECTIONS = {
  household: "People and household", accounts: "Accounts", transactions: "Transactions", income: "Income", expenses: "Spending",
  budgets: "Budgets", rules: "Filing rules", categories: "Categories", goals: "Goals", debts: "Loan details", holdings: "Investments",
  retirement: "Retirement", insurance: "Insurance", estate: "Will and estate", taxes: "Taxes", property: "Home and cars",
  belongings: "Belongings", papers: "Where papers are", contacts: "Contacts", reminders: "Reminders", lifeEvents: "Life events",
  reconciliations: "Checked statements", netWorthHistory: "Net worth history", assumptions: "Assumptions", whatIfs: "Calculator inputs",
  scenarios: "Scenarios", events: "Trips and big days", equity: "Work stock", investments: "Investment targets", pageNotes: "Page notes",
  reviews: "Monthly reviews", notes: "Notes",
};
/** Always differ between saves, so never counted as a change. */
const IGNORE = new Set(["meta", "schemaVersion"]);

/** "plan-2026-10-31T09-30-00.json" -> "2026-10-31T09:30:00Z" (the server stamps UTC), or null for another name. */
export function whenOf(name) {
  const m = /^plan-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})\.json$/.exec(String(name ?? ""));
  return m ? `${m[1]}T${m[2]}:${m[3]}:${m[4]}Z` : null;
}

/** The backups listed by the server, newest first, with their time: [{ name, when }] (names that are not copies left out). */
export function listOf(names) {
  return (names ?? []).map((name) => ({ name, when: whenOf(name) })).filter((b) => b.when).sort((a, b) => b.when.localeCompare(a.when));
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const keyed = (list) => Array.isArray(list) && list.length > 0 && list.every((x) => x && typeof x === "object" && ("id" in x || "key" in x));
const idOf = (x) => String(x.id ?? x.key);
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/**
 * What changed from `older` to `newer`, by section: [{ key, label, kind, added, removed, changed }] (only sections that
 * changed). A list of records with ids counts records added, removed and changed; anything else counts as one change
 * (a list without ids, a value) or as the number of its top-level fields that differ (an object such as household).
 */
export function diffPlans(older, newer) {
  const a = older ?? {}, b = newer ?? {};
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !IGNORE.has(k));
  const order = Object.keys(SECTIONS);
  keys.sort((x, y) => (order.includes(x) ? order.indexOf(x) : 999) - (order.includes(y) ? order.indexOf(y) : 999) || x.localeCompare(y));
  const out = [];
  for (const k of keys) {
    const x = a[k], y = b[k];
    if (same(x, y)) continue;
    let added = 0, removed = 0, changed = 0, kind = "value";
    if ((keyed(x) || keyed(y)) && (Array.isArray(x) || x === undefined) && (Array.isArray(y) || y === undefined)) {
      kind = "records";
      const before = new Map((x ?? []).map((r) => [idOf(r), r])), after = new Map((y ?? []).map((r) => [idOf(r), r]));
      for (const [id, r] of after) { if (!before.has(id)) added++; else if (!same(before.get(id), r)) changed++; }
      for (const id of before.keys()) if (!after.has(id)) removed++;
    } else if ((isObj(x) || x === undefined) && (isObj(y) || y === undefined)) {
      kind = "fields";
      changed = [...new Set([...Object.keys(x ?? {}), ...Object.keys(y ?? {})])].filter((f) => !same(x?.[f], y?.[f])).length;
    } else changed = 1;
    if (added || removed || changed) out.push({ key: k, label: SECTIONS[k] ?? k, kind, added, removed, changed });
  }
  return out;
}

/** A plan's size at a glance: { people, accounts, transactions, goals, savedAt }. */
export function sizeOf(plan) {
  return { people: plan?.household?.people?.length ?? 0, accounts: plan?.accounts?.length ?? 0, transactions: plan?.transactions?.length ?? 0, goals: plan?.goals?.length ?? 0, savedAt: plan?.meta?.updatedAt ?? null };
}

/** One section's change in words: records "3 added, 1 removed, 2 changed"; fields "2 details changed"; a value "changed". */
export function changeWords(d) {
  if (d.kind === "records") return [d.added ? `${d.added} added` : null, d.removed ? `${d.removed} removed` : null, d.changed ? `${d.changed} changed` : null].filter(Boolean).join(", ");
  if (d.kind === "fields") return `${d.changed} ${d.changed === 1 ? "detail" : "details"} changed`;
  return "changed";
}

/** compute(plan) -> { size } (the backups themselves come from the server; see view.js). */
export function compute(plan) {
  return { size: sizeOf(plan) };
}

// modules/ai/categorizer/compute.js -- PURE. Bulk sorting with the AI: the transactions' payees grouped (the ones not
// filed yet, or every payee to recheck what is filed), the batches the AI is asked in, its answers read back into a
// review list with how sure it is and whether it differs from what is filed, and the change the person accepts
// (categories on the transactions plus a rule per payee for future imports). The prompt and the answer parser are the
// Categorise page's, so the AI sees only payee names and the category list, never amounts, dates or accounts.
import { normalizePayee, ruleFor } from "../../transactions/rules/compute.js";
import { categoriesOf, categoryLabel } from "../../transactions/categories/compute.js";
import { buildPrompt, parseSuggestions } from "../../transactions/categorize/compute.js";

/** Payees per question to the AI (the Categorise page's prompt takes at most 40). */
export const BATCH = 40;
/** How sure the AI says it is, in words: at least 0.8 "sure", at least 0.5 "fairly sure", else "unsure" (the app's own cut-offs). */
export const BANDS = { sure: 0.8, fairly: 0.5 };
export const SCOPES = { open: "Not filed yet", all: "Recheck everything" };

const isTransfer = (t) => !!t.transferId || t.category === "transfer";
export const keyOf = (t) => normalizePayee(t.rawPayee ?? t.payee) || String(t.payee ?? "").trim().toLowerCase();
export const band = (c) => (c >= BANDS.sure ? "sure" : c >= BANDS.fairly ? "fairly" : "unsure");

/**
 * The payees to ask about: scope "open" = transactions with no category yet; "all" = every transaction. Transfers
 * between your own accounts are left out (linked, or filed as a transfer). One group per payee (the bank's text with
 * its card codes and dates taken off), most transactions first:
 * { key, payee, rawPayee, count, total, in (money in), ids, filed (the category most of them have, "" if none), mixed (filed more than one way,
 * or some not filed), unfiled (how many have no category), ways (how many categories) }
 */
export function groupsFor(plan, scope = "open") {
  const groups = new Map();
  for (const t of plan.transactions ?? []) {
    if (isTransfer(t) || (scope === "open" && t.category)) continue;
    const k = keyOf(t);
    if (!k) continue;
    const g = groups.get(k) ?? { key: k, payee: t.payee, rawPayee: t.rawPayee ?? t.payee, count: 0, total: 0, ids: [], counts: {} };
    g.count++; g.total += Number(t.amount) || 0; g.ids.push(t.id);
    g.counts[t.category || ""] = (g.counts[t.category || ""] ?? 0) + 1;
    groups.set(k, g);
  }
  return [...groups.values()].map(({ counts, ...g }) => {
    const filedAs = Object.entries(counts).filter(([c]) => c).sort((a, b) => b[1] - a[1]);
    return { ...g, in: g.total >= 0, filed: filedAs[0]?.[0] ?? "", mixed: Object.keys(counts).length > 1, unfiled: counts[""] ?? 0, ways: filedAs.length };
  }).sort((a, b) => b.count - a.count || Math.abs(b.total) - Math.abs(a.total) || a.key.localeCompare(b.key));
}

/** The groups cut into questions of BATCH payees each, in order. */
export const batches = (groups, size = BATCH) => Array.from({ length: Math.ceil(groups.length / size) }, (_, i) => groups.slice(i * size, (i + 1) * size));

/** The question for one batch ({ system, user }), the Categorise page's prompt: payee names (and "money in") only. */
export const promptFor = (plan, batch) => buildPrompt(plan, batch);

/** The AI's answer for a batch read back: { [payee key]: { category, confidence (0 to 1) } }; unknown categories dropped. */
export function readAnswer(plan, text) {
  const out = {};
  for (const [k, v] of Object.entries(parseSuggestions(plan, text))) out[k] = { category: v.category, confidence: Math.min(1, Math.max(0, v.confidence)) };
  return out;
}

/**
 * The review list: each group the AI answered, with its suggestion, how sure it is ("sure" | "fairly" | "unsure"),
 * whether it agrees with what is filed, and whether the group is filed at all. Sorted: the ones that would change
 * something first (not filed, or filed differently), the surest first; agreements last.
 * -> { rows: [{ ...group, suggested, label, confidence, band, agrees, isNew }], summary: { asked, answered, sure, fairly,
 *    unsure, differ (filed differently), isNew (not filed), agree, unanswered, sureNew (sure answers for payees not filed yet) } }
 */
export function review(plan, groups, answers = {}) {
  const rows = [];
  for (const g of groups) {
    const a = answers[g.key];
    if (!a) continue;
    const b = band(a.confidence);
    rows.push({ ...g, suggested: a.category, label: categoryLabel(plan, a.category), confidence: a.confidence, band: b, agrees: !!g.filed && g.filed === a.category && !g.mixed, isNew: !g.filed });
  }
  const changes = (r) => !r.agrees;
  rows.sort((a, b) => Number(changes(b)) - Number(changes(a)) || b.confidence - a.confidence || b.count - a.count || a.key.localeCompare(b.key));
  const n = (f) => rows.filter(f).length;
  return {
    rows,
    summary: {
      asked: groups.length, answered: rows.length, unanswered: groups.length - rows.length,
      sure: n((r) => r.band === "sure"), fairly: n((r) => r.band === "fairly"), unsure: n((r) => r.band === "unsure"),
      isNew: n((r) => r.isNew), differ: n((r) => !r.isNew && !r.agrees), agree: n((r) => r.agrees),
      sureNew: n((r) => r.band === "sure" && r.isNew),
    },
  };
}

/**
 * Accept choices on the plan draft (changes `draft` in place): for each { ids, rawPayee, category }, every one of those
 * transactions gets the category (its bank text kept in rawPayee, the payee given its clean name), and a rule files
 * the payee's future imports: a rule with the same text and category gains hits; one with the same text and another
 * category is changed to this one (the person has just said what it is); otherwise a new rule is added.
 * `uid` makes rule ids; `today` dates them. -> { transactions, payees, rulesAdded, rulesChanged }
 */
export function applyChoices(draft, choices, { uid, today } = {}) {
  const known = new Set(categoriesOf(draft, { all: true }).map((c) => c.id));
  const out = { transactions: 0, payees: 0, rulesAdded: 0, rulesChanged: 0 };
  draft.rules = draft.rules ?? [];
  for (const ch of choices ?? []) {
    if (!ch?.category || !known.has(ch.category)) continue;
    const ids = new Set(ch.ids ?? []);
    const rule = ruleFor(ch.rawPayee, ch.category);
    let n = 0;
    for (const t of draft.transactions ?? []) {
      if (!ids.has(t.id)) continue;
      t.rawPayee = t.rawPayee ?? t.payee;
      if (rule.payee) t.payee = rule.payee;
      if (t.category !== ch.category) { t.category = ch.category; n++; }
    }
    if (!ids.size) continue;
    out.transactions += n; out.payees++;
    if (!rule.contains) continue;
    const same = draft.rules.find((r) => r.contains === rule.contains && !r.accountId && (r.direction ?? "any") === "any");
    if (same && same.category === ch.category) same.hits = (same.hits ?? 0) + ids.size;
    else if (same) { same.category = ch.category; same.hits = (same.hits ?? 0) + ids.size; out.rulesChanged++; }
    else { draft.rules.push({ id: uid ? uid() : `r-${draft.rules.length + 1}`, ...rule, hits: ids.size, createdAt: today ?? null }); out.rulesAdded++; }
  }
  return out;
}

/**
 * compute(plan) -> { total (transactions), transfers, open (not filed, not transfers), scopes: { open: payees, all: payees },
 *   questions: { open, all } (how many questions each would take) }
 */
export function compute(plan) {
  const txs = plan.transactions ?? [];
  const open = groupsFor(plan, "open"), all = groupsFor(plan, "all");
  return {
    total: txs.length, transfers: txs.filter(isTransfer).length, open: txs.filter((t) => !t.category && !isTransfer(t)).length,
    scopes: { open: open.length, all: all.length },
    questions: { open: Math.ceil(open.length / BATCH), all: Math.ceil(all.length / BATCH) },
  };
}

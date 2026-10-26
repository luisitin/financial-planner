// modules/transactions/categorize/compute.js -- PURE. The review queue: uncategorised
// transactions grouped by payee, most frequent first, each with the best guess the plan can
// make on its own (a rule, or what the same payee got last time). Also the prompt for the
// optional AI suggestion, kept here so it is testable and visible. The model only ever sees
// payee names and the category list, never amounts, dates or account names.
import { normalizePayee, matchRule } from "../rules/compute.js";
import { categoriesOf, categoryLabel } from "../categories/compute.js";

/**
 * compute(plan) -> {
 *   groups: [{ key, payee, rawPayee, count, total, ids: [txId], first, last, suggestion: { category, label, why } | null }],
 *   uncategorised, total, done (categorised count), share (done / total)
 * }
 */
export function compute(plan) {
  const txs = plan.transactions ?? [];
  const open = txs.filter((t) => !t.category);
  const known = new Map();   // normalized payee -> { category, n } from categorised transactions
  for (const t of txs) {
    if (!t.category) continue;
    const k = normalizePayee(t.rawPayee ?? t.payee);
    const e = known.get(k) ?? { counts: {} };
    e.counts[t.category] = (e.counts[t.category] ?? 0) + 1;
    known.set(k, e);
  }
  const groups = new Map();
  for (const t of open) {
    const k = normalizePayee(t.rawPayee ?? t.payee) || String(t.payee ?? "").toLowerCase();
    const g = groups.get(k) ?? { key: k, payee: t.payee, rawPayee: t.rawPayee ?? t.payee, count: 0, total: 0, ids: [], first: t.date, last: t.date };
    g.count++; g.total += Number(t.amount) || 0; g.ids.push(t.id);
    if (String(t.date) < String(g.first)) g.first = t.date;
    if (String(t.date) > String(g.last)) g.last = t.date;
    groups.set(k, g);
  }
  const rules = plan.rules ?? [];
  const list = [...groups.values()].map((g) => {
    const sample = open.find((t) => t.id === g.ids[0]);
    const rule = rules.find((r) => matchRule(r, sample));
    let suggestion = null;
    if (rule) suggestion = { category: rule.category, label: categoryLabel(plan, rule.category), why: "a rule matches" };
    else if (known.has(g.key)) { const c = Object.entries(known.get(g.key).counts).sort((a, b) => b[1] - a[1])[0]; suggestion = { category: c[0], label: categoryLabel(plan, c[0]), why: `${c[1]} earlier ${c[1] === 1 ? "one was" : "were"} filed there` }; }
    return { ...g, suggestion, in: g.total >= 0 };
  }).sort((a, b) => b.count - a.count || Math.abs(b.total) - Math.abs(a.total));
  return { groups: list, uncategorised: open.length, total: txs.length, done: txs.length - open.length, share: txs.length ? (txs.length - open.length) / txs.length : 1 };
}

/** The AI prompt: payee names in, a JSON list of { payee, category } out. Pure so it can be tested and read. */
export function buildPrompt(plan, groups) {
  const cats = categoriesOf(plan).filter((c) => c.kind !== "transfer");
  const lines = groups.slice(0, 40).map((g) => `- ${g.rawPayee || g.payee}${g.in ? " (money in)" : ""}`);
  return {
    system: "You sort bank transaction descriptions into spending or income categories. Answer with JSON only: an array of objects {\"payee\": <the description exactly as given>, \"category\": <one id from the list>, \"confidence\": <0 to 1>}. Use \"other\" when unsure. No prose.",
    user: `Categories (id: meaning):\n${cats.map((c) => `${c.id}: ${c.label}`).join("\n")}\n\nDescriptions:\n${lines.join("\n")}`,
    max: Math.min(40, groups.length),
  };
}
/** Read the model's answer back into { payee -> { category, confidence } }; anything not in the category list is dropped. */
export function parseSuggestions(plan, text) {
  const ids = new Set(categoriesOf(plan).map((c) => c.id));
  const m = /\[[\s\S]*\]/.exec(String(text ?? ""));
  if (!m) return {};
  let arr; try { arr = JSON.parse(m[0]); } catch { return {}; }
  const out = {};
  for (const x of Array.isArray(arr) ? arr : []) if (x && typeof x.payee === "string" && ids.has(x.category)) out[normalizePayee(x.payee)] = { category: x.category, confidence: Number(x.confidence) || 0.5 };
  return out;
}

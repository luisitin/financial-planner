// modules/ai/explain/compute.js -- PURE. "Explain this page": a page's own numbers (its compute() run on a copy of the
// plan with people and accounts renamed, see ai/critic's anonymise) turned into a short list of lines the AI reads,
// the question asked, and the answer read back with the real names put back. The AI explains; it never works out a
// number the app shows (AGENTS.md rule 5), and its answer is labelled as not checked.
import { anonymise, restore, hide, hideTerms, aliases, accountAliases, cut } from "../critic/compute.js";

export { anonymise, restore };

/** Pages never offered: the app's own machinery, the AI pages, and pages that hold other people's details or where papers are kept. */
export const NOT_OFFERED = new Set(["household/contacts", "household/documents"]);
const NOT_GROUPS = new Set(["system", "ai"]);
/** Keys never sent: ids and links (no meaning to the AI), free text and contact details (could say anything about anyone). */
export const SKIP = new Set([
  "id", "ids", "key", "keys", "accountId", "accountIds", "personId", "policyId", "goalId", "policyIds", "importId", "transferId", "rawPayee",
  "go", "href", "url", "sourceUrl", "icon", "color", "class", "css", "dataset", "error", "seeds",
  "note", "notes", "phone", "email", "address", "last4", "where", "who", "copy",
]);
export const MAX_LINES = 80, MAX_CHARS = 6000, MAX_ITEMS = 6, MAX_DEPTH = 4, MAX_TEXT = 160, MAX_QUESTION = 300, MAX_ANSWER = 3000;

/** "netWorth" -> "net worth", "dti_ratio" -> "dti ratio". */
export const words = (k) => String(k).replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").toLowerCase();
const num = (n) => String(Math.round(n * 100) / 100);
const scalar = (v) => {
  if (typeof v === "number") return Number.isFinite(v) ? num(v) : null;
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "string") { const t = v.replace(/\s+/g, " ").trim(); return t ? cut(t, MAX_TEXT) : null; }
  return null;
};
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);

/** One record as one line: its plain fields "name Visa card; balance 640", one level of nested fields "rate.apr 0.2". */
function recordLine(x) {
  const parts = [];
  for (const [k, v] of Object.entries(x)) {
    if (SKIP.has(k) || `${k}Label` in x) continue;   // "type salary" adds nothing next to "type label Pay from a job"
    const s = scalar(v);
    if (s !== null) { parts.push(`${words(k)} ${s}`); continue; }
    if (isObj(v)) for (const [k2, v2] of Object.entries(v)) { if (SKIP.has(k2)) continue; const s2 = scalar(v2); if (s2 !== null) parts.push(`${words(k)} ${words(k2)} ${s2}`); }
  }
  return parts.join("; ");
}

/**
 * A page's compute() result as lines the AI reads: "net worth: 257000", "accounts (10 in all): 1. name the checking
 * account; balance 4200 ...". Each part's own numbers come first, then short lists of values, inner parts, lists of
 * records. Numbers rounded to the cent; yes/no; text cut to MAX_TEXT. Lists of records: how many, then the first
 * MAX_ITEMS one per line (a field with a "<field>Label" beside it gives way to the label); a list sent once is named,
 * not repeated; a long list of numbers: how many, first, last, lowest and highest. Keys in SKIP are left out, and so
 * is anything deeper than MAX_DEPTH. At most MAX_LINES lines and MAX_CHARS characters, then a line saying more was
 * left out. -> { lines, cut (true when something was left out) }
 */
export function digest(derived) {
  const lines = [];
  const seen = new Map();   // a list already sent (as JSON) -> where, so a second copy is named, not repeated
  let chars = 0, over = false;
  const add = (l) => {
    if (over) return;
    if (lines.length >= MAX_LINES || chars + l.length > MAX_CHARS) { over = true; return; }
    lines.push(l); chars += l.length + 1;
  };
  const walk = (v, path, depth) => {
    if (over || v === null || v === undefined) return;
    const label = path.map(words).join(" › ");
    const s = scalar(v);
    if (s !== null) { if (label) add(`${label}: ${s}`); return; }
    if (depth > MAX_DEPTH) return;
    if (Array.isArray(v)) {
      const items = v.filter((x) => x !== null && x !== undefined);
      if (!items.length) return;
      if (items.every((x) => typeof x === "number" && Number.isFinite(x))) {
        if (items.length <= 10) add(`${label}: ${items.map(num).join(", ")}`);
        else add(`${label}: ${items.length} values, first ${num(items[0])}, last ${num(items[items.length - 1])}, lowest ${num(Math.min(...items))}, highest ${num(Math.max(...items))}`);
        return;
      }
      if (items.every((x) => scalar(x) !== null)) { add(`${label}: ${items.slice(0, 10).map(scalar).join(", ")}${items.length > 10 ? ` and ${items.length - 10} more` : ""}`); return; }
      const json = JSON.stringify(items);
      if (seen.has(json)) { add(`${label}: the same ${items.length} as ${seen.get(json)}`); return; }
      seen.set(json, label);
      add(`${label} (${items.length} in all):`);
      items.slice(0, MAX_ITEMS).forEach((x, i) => {
        if (isObj(x)) { const r = recordLine(x); if (r) add(`  ${i + 1}. ${r}`); }
        else if (Array.isArray(x)) add(`  ${i + 1}. a list of ${x.length}`);
        else { const t = scalar(x); if (t !== null) add(`  ${i + 1}. ${t}`); }
      });
      if (items.length > MAX_ITEMS) add(`  and ${items.length - MAX_ITEMS} more`);
      return;
    }
    // a part's own numbers first, then short lists of values, then inner parts, then lists of records, so the
    // headline figures are never the ones cut
    if (isObj(v)) {
      const rank = (x) => (scalar(x) !== null ? 0 : Array.isArray(x) && x.every((y) => y === null || y === undefined || scalar(y) !== null) ? 1 : isObj(x) ? 2 : 3);
      const keys = Object.keys(v).filter((k) => !SKIP.has(k));
      for (const k of keys.map((k, i) => [k, i]).sort((a, b) => rank(v[a[0]]) - rank(v[b[0]]) || a[1] - b[1]).map(([k]) => k)) walk(v[k], [...path, k], depth + 1);
    }
  };
  walk(derived, [], 0);
  if (over) lines.push("(more numbers on the page were left out)");
  return { lines, cut: over };
}

/**
 * Everything the AI reads for one page, worked out on the renamed copy: { lines, names, terms, ok, why }.
 * `run(copy)` runs the page's compute (the view passes the module's compute with today's date). Every line also goes
 * through hide() with the household's names and account names, in case a page repeats one in its own text.
 * why: "error" (the page's compute failed), "empty" (no numbers to explain yet).
 */
export function sheetFor(plan, run, { today } = {}) {
  const { plan: copy, names } = anonymise(plan, { today });
  const terms = hideTerms(aliases(plan, { today }), accountAliases(plan).filter(Boolean));
  let derived;
  try { derived = run(copy); } catch { return { lines: [], names, terms, ok: false, why: "error" }; }
  if (derived && typeof derived === "object" && !Array.isArray(derived) && typeof derived.error === "string" && Object.keys(derived).length === 1) return { lines: [], names, terms, ok: false, why: "error" };
  const d = digest(derived);
  const lines = d.lines.map((l) => hide(l, terms));
  const numbers = lines.filter((l) => /\d/.test(l)).length;
  return { lines, names, terms, ok: numbers > 0, why: numbers > 0 ? null : "empty", cut: d.cut };
}

/** The pages that can be explained: built (usable or partly built), with a compute, not system or AI pages, not NOT_OFFERED. pages: [{ key, group, title, purpose, status, hasCompute }] */
export const explainable = (pages) => (pages ?? []).filter((m) => m && m.hasCompute && (m.status === "usable" || m.status === "stub") && !NOT_GROUPS.has(m.group) && !NOT_OFFERED.has(m.key));

/**
 * The messages for the AI: the page's title and purpose, its numbers, and the person's own question (names in it
 * hidden, cut to MAX_QUESTION characters) or the default: what the page shows, what the main numbers mean, what is
 * worth noticing. -> [{ role, content }]
 */
export function buildMessages({ title, purpose, lines, question = "", terms = [] }) {
  const q = cut(hide(String(question ?? "").replace(/\s+/g, " ").trim(), terms), MAX_QUESTION);
  return [
    { role: "system", content: "You explain one page of a household's money app to someone who is not a finance person. Use only the numbers given and never invent any; do not work out new totals, rates or projections, and say so if a question needs one. Money amounts are in dollars; fractions such as 0.05 are rates (5%). People are called Adult 1, Adult 2, Child 1 and so on, and accounts by their kind; use those names. Write in plain words, short sentences, no jargon left unexplained, no product recommendations, at most 200 words. Start with what the page shows, then what the main numbers mean for this household, then one or two things worth noticing." },
    { role: "user", content: `PAGE: ${title}${purpose ? ` (${purpose})` : ""}\nNUMBERS ON THE PAGE:\n${(lines ?? []).map((l) => `- ${l}`).join("\n")}\n\nQUESTION: ${q || "What does this page tell me about my money?"}` },
  ];
}

/** The answer as shown: a reasoning model's <think> part dropped, the real names put back, spaces tidied, cut to MAX_ANSWER. "" when there is nothing. */
export function readAnswer(text, names = []) {
  let s = String(text ?? "").replace(/<think>[\s\S]*?<\/think>/gi, "");
  const end = s.toLowerCase().lastIndexOf("</think>");
  if (end >= 0) s = s.slice(end + 8);
  s = s.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return s ? cut(restore(s, names), MAX_ANSWER) : "";
}

/** compute(plan) -> { ready (anything in the plan to explain: people, accounts, income or expenses) }. */
export function compute(plan) {
  const n = (plan?.household?.people ?? []).length + (plan?.accounts ?? []).length + (plan?.income ?? []).length + (plan?.expenses ?? []).length;
  return { ready: n > 0 };
}

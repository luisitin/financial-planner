// core/search.js -- finding a page in the owner's own words. Shared by the sidebar search
// (core/app.js) and the All pages directory (modules/overview/pages). PURE.
//
// A person types "what I owe"; the page says "what you owe". So both sides are normalised
// (first person -> second person, punctuation dropped) before matching, and a manifest may
// list `aliases`: the plain phrases people use for that page ("how much am I worth").
// When no phrase matches as a whole, every meaningful word of the query must appear
// somewhere in the page's words (so "how much debt do I have" still finds Debts).

const PRONOUNS = [
  [/\bi am\b/g, "you are"], [/\bi'm\b/g, "you are"], [/\bam i\b/g, "are you"], [/\bdo i\b/g, "do you"], [/\bcan i\b/g, "can you"],
  [/\bi\b/g, "you"], [/\bme\b/g, "you"], [/\bmy\b/g, "your"], [/\bmine\b/g, "yours"], [/\bmyself\b/g, "yourself"],
  [/\bwe\b/g, "you"], [/\bour\b/g, "your"], [/\bus\b/g, "you"],
];
export function normalize(s) {
  let t = String(s ?? "").toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9'\s]+/g, " ").replace(/\s+/g, " ").trim();
  for (const [re, to] of PRONOUNS) t = t.replace(re, to);
  return t.replace(/'/g, "").replace(/\s+/g, " ").trim();
}
// words that carry no meaning for finding a page
export const STOPWORDS = new Set(["a", "an", "the", "of", "to", "in", "on", "for", "and", "or", "is", "are", "am", "be", "do", "does", "did", "have", "has", "had", "can", "could", "should", "would", "will", "what", "which", "where", "when", "how", "much", "many", "you", "your", "yours", "yourself", "it", "its", "this", "that", "there", "with", "about", "from", "page", "pages", "see", "show", "find", "look", "at", "up", "all", "get", "my", "me", "i"]);
export const words = (s) => normalize(s).split(" ").filter((w) => w && !STOPWORDS.has(w));

/**
 * How well page `m` (a manifest) in topic `groupTitle` matches `query`.
 * -1 no match; 0 page name or alias; 1 topic name; 2 purpose sentence; 3 every meaningful word found somewhere.
 * Lower is better. Callers keep their own ordering rules on top of this.
 */
export function matchRank(m, groupTitle, query) {
  const q = normalize(query);
  if (!q) return 0;
  const title = normalize(m.title), group = normalize(groupTitle), purpose = normalize(m.purpose);
  const aliases = (m.aliases ?? []).map(normalize);
  if (title.includes(q) || aliases.some((a) => a.includes(q) || q.includes(a))) return 0;
  if (group.includes(q)) return 1;
  if (purpose.includes(q)) return 2;
  const hay = [title, group, purpose, ...aliases].join(" ");
  const qs = words(q);
  if (qs.length && qs.every((w) => hay.includes(w))) return 3;
  return -1;
}
export const matches = (m, groupTitle, query) => matchRank(m, groupTitle, query) >= 0;

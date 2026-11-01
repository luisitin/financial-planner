// core/search.js -- finding a page in the owner's own words. Shared by the sidebar search
// (core/app.js) and the All pages directory (modules/overview/pages). PURE.
//
// A person types "what I owe"; the page says "what you owe". So both sides are normalised
// (first person -> second person, punctuation dropped) before matching, and a manifest may
// list `aliases`: the plain phrases people use for that page ("how much am I worth").
// When no phrase matches as a whole, every meaningful word of the query must appear
// somewhere in the page's words (so "how much debt do I have" still finds Debts), compared
// on their stems ("saving", "savings" and "save" are one word) with a few everyday synonyms
// ("house" finds pages that say "home").
//
// PLAIN below adds the phrases people use for pages whose names do not say them ("safety
// cushion", "next move", "can we afford a house", "are we saving enough"), kept here in one
// place so no page's manifest needs touching (2026-11-01, from a phone walk-through where
// those searches found nothing). A phrase of two or more words also matches inside a longer
// question; a one-word alias only matches what it starts with, so "home" (the Dashboard's
// alias) no longer pulls the Dashboard to the top of "buy a home".

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

/** The phrases people use for a page, beyond its name and its manifest's aliases (page key -> phrases). */
export const PLAIN = {
  "balance/liquidity": ["safety cushion", "cushion", "cash I can reach", "how long could we last", "lose my job", "job loss", "laid off"],
  "goals/emergency-fund": ["safety cushion", "cushion", "rainy day", "emergency savings", "how much cash should I keep", "lose my job", "job loss", "laid off"],
  "overview/next-best-action": ["next move", "what next", "what should I do next", "what to do with my money", "spare money", "extra money", "where should my money go", "what to do with a bonus"],
  "overview/dashboard": ["where I stand", "left over each month"],
  "goals/house": ["afford a house", "afford a home", "buy a house", "buy a home", "how much house", "how much home", "down payment", "first home"],
  "property/rent-vs-buy": ["rent or buy", "renting or buying", "buy a house", "buy a home", "should I buy"],
  "property/home": ["my house", "home value", "what my home is worth", "sell my house", "sell the house"],
  "retirement/projection": ["will the money last", "money last", "saving enough", "enough to retire", "can I retire", "run out of money", "on track for retirement"],
  "retirement/monte-carlo": ["will the money last", "money last", "run out of money", "chance of success"],
  "overview/benchmarks": ["how am I doing", "on track", "saving enough", "compared to others", "am I behind"],
  "retirement/fire": ["retire early", "stop working", "never work again"],
  "cashflow/expenses": ["left over", "how much is left", "what is left each month", "money left"],
  "cashflow/budget": ["afford to spend", "spending money"],
  "property/purchase": ["afford", "can I afford", "big purchase", "buy something", "save up for", "pay cash or finance"],
  "goals/vehicle": ["new car", "buy a car", "afford a car", "next car"],
  "property/vehicles": ["car costs", "lease or buy", "keep my car", "my car"],
  "insurance/disability": ["can't work", "cannot work", "injured", "too sick to work", "lose my income"],
  "insurance/life-needs": ["if I die", "if something happens to me", "protect my family", "how much life insurance"],
  "career/equity": ["stock from work", "company stock", "shares from work", "stock options", "vesting"],
  "investments/employer-stock": ["stock from work", "company stock", "too much company stock"],
  "retirement/medicare": ["medicare at 65", "health insurance at 65", "irmaa"],
  "retirement/healthcare": ["health insurance before 65", "retire before 65", "marketplace", "obamacare", "aca"],
  "investments/asset-location": ["what goes where", "which account should hold"],
  "investments/glide-path": ["stocks by age", "how much in stocks at my age"],
  "scenarios/goal-seek": ["what would it take", "how much more should I save", "what do I need to change"],
  "scenarios/stress-tests": ["what if the market crashes", "market crash", "recession", "lose my job", "job loss"],
  "scenarios/compare": ["what if", "what happens if", "try a change"],
  "taxes/federal": ["how much tax", "tax bill", "what will I owe", "tax refund"],
  "overview/monthly-review": ["monthly check in", "check in", "once a month", "review the month", "monthly routine"],
  "overview/alerts": ["what is wrong", "needs attention", "anything to fix", "what needs fixing"],
  "overview/health-score": ["how healthy", "financial health", "grade my finances", "score"],
  "household/people": ["add my partner", "add a child", "new baby", "my family"],
  "household/life-events": ["having a baby", "getting married", "divorce", "moving house", "new job", "inheritance"],
  "estate/documents": ["will", "power of attorney", "living will", "guardian for my kids"],
  "goals/education": ["college", "university", "school fees", "529", "save for college"],
  "estate/beneficiaries": ["beneficiary", "who gets my accounts"],
  "cashflow/paycheck": ["take home pay", "net pay", "pay stub", "what comes out of my paycheck"],
  "cashflow/income": ["how much do we make", "household income"],
  "retirement/social-security": ["when to claim", "social security"],
  "debt/payoff": ["pay off debt", "pay off my loans", "which debt first"],
  "investments/fees": ["am I paying too much", "hidden fees"],
};

// a few everyday words and the word the pages use for them
const SYNONYMS = { house: "home", houses: "home", job: "work", jobs: "work", kid: "child", kids: "child", children: "child", car: "vehicle", cars: "vehicle", auto: "vehicle", taxes: "tax", wage: "pay", wages: "pay", salary: "pay", retiring: "retire", retirement: "retire" };
/** A word's stem: "savings", "saving" and "save" all become "sav"; plurals and -ed/-ing endings dropped. */
export function stem(w) {
  let t = SYNONYMS[w] ?? w;
  if (t.length > 4 && t.endsWith("ies")) t = t.slice(0, -3) + "y";
  else if (t.length > 3 && t.endsWith("s") && !/(ss|us|is)$/.test(t)) t = t.slice(0, -1);
  if (t.length > 5 && t.endsWith("ing")) t = t.slice(0, -3);
  else if (t.length > 4 && t.endsWith("ed")) t = t.slice(0, -2);
  if (t.length > 3 && t.endsWith("e")) t = t.slice(0, -1);
  return t;
}
const stems = (s) => normalize(s).split(" ").filter(Boolean).map(stem);
/** The phrase `a` is in `q`: a phrase of two or more words anywhere in it, word by word; a one-word phrase only when it starts with `q`. */
const phraseIn = (q, a) => !!a && (a.includes(q) || (a.includes(" ") && ` ${q} `.includes(` ${a} `)));

/**
 * How well page `m` (a manifest) in topic `groupTitle` matches `query`.
 * -1 no match; 0 page name or alias; 1 topic name; 2 purpose sentence; 3 every meaningful word found somewhere.
 * Lower is better. Callers keep their own ordering rules on top of this.
 */
export function matchRank(m, groupTitle, query) {
  const q = normalize(query);
  if (!q) return 0;
  const title = normalize(m.title), group = normalize(groupTitle), purpose = normalize(m.purpose);
  const aliases = [...(m.aliases ?? []), ...(PLAIN[`${m.group}/${m.id}`] ?? [])].map(normalize);
  if (title.includes(q) || aliases.some((a) => phraseIn(q, a))) return 0;
  if (group.includes(q)) return 1;
  if (purpose.includes(q)) return 2;
  const hay = ` ${stems([title, group, purpose, ...aliases].join(" ")).join(" ")}`;
  const qs = words(q).map(stem);
  if (qs.length && qs.every((w) => hay.includes(` ${w}`))) return 3;
  return -1;
}
export const matches = (m, groupTitle, query) => matchRank(m, groupTitle, query) >= 0;

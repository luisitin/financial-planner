// modules/ai/glossary/compute.js -- PURE. The glossary: every money word the app uses, in plain words, with a search
// that ranks the closest names first, the words that matter for this household (from what its plan holds), and the
// topics to browse by.
import { TERMS, TOPICS } from "./data/terms.js";

/** Lower case, accents, apostrophes and punctuation off (but "401(k)" and "50/30/20" keep their marks), single spaces. */
export const norm = (s) => String(s ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/['’]/g, "").replace(/[^a-z0-9%()/]+/g, " ").trim();
const names = (t) => [t.term, ...(t.aka ?? [])].map(norm);

/** The short other names worth showing next to a word (abbreviations such as "FICA"), at most two, none already in its name. */
export function shortNames(t) {
  const bare = (x) => ` ${norm(x).replace(/[()]/g, "")} `;   // "401(k)" and "401k" alike; whole words only
  return (t.aka ?? []).filter((a) => /^[A-Z][A-Z0-9]{1,6}$/.test(a) && !bare(t.term).includes(bare(a))).slice(0, 2);
}

/** The entry whose name or other name is exactly `name` (any case), or null. */
export function find(name, terms = TERMS) {
  const q = norm(name);
  return terms.find((t) => names(t).includes(q)) ?? null;
}

/** A simple plural made singular: "annuities" -> "annuity", "taxes" -> "tax", "trusts" -> "trust" (words over 3 letters). */
const stem = (w) => (w.length > 3 ? w.replace(/ies$/, "y").replace(/(x|ch|sh|ss)es$/, "$1").replace(/([^s])s$/, "$1") : w);
/** `w` starts a word of `text`: at the start, or after a space, "(" or "/". */
const at = (text, w) => ` ${text}`.includes(` ${w}`) || text.includes(`(${w}`) || text.includes(`/${w}`);

/**
 * Search: every entry matching what was typed, best first. 100 its own name exactly, 95 an other name exactly, 85 its
 * own name starts with it, 80 an other name starts with it, 60 a word in a name starts with it, 40 every word typed
 * starts a word of one name (in any order), 20 every word typed starts a word of the definition or example (a one-letter
 * word: the whole phrase must; a single letter alone searches names only). The query as typed and its simple singular
 * are both tried. Ties go A to Z. Nothing typed (or only punctuation): every entry, A to Z.
 */
export function search(query, terms = TERMS) {
  const q = norm(query);
  const abc = (a, b) => a.term.localeCompare(b.term, "en", { sensitivity: "base" });
  if (!q) return [...terms].sort(abc);
  const qs = [...new Set([q, q.split(" ").map(stem).join(" ")])];
  const scored = [];
  for (const t of terms) {
    const ns = names(t), own = ns[0];
    let score = 0;
    for (const x of qs) {
      const words = x.split(" ");
      const s = own === x ? 100 : ns.includes(x) ? 95 : own.startsWith(x) ? 85 : ns.some((n) => n.startsWith(x)) ? 80
        : ns.some((n) => at(n, x)) ? 60 : ns.some((n) => words.every((w) => at(n, w))) ? 40 : 0;
      score = Math.max(score, s);
    }
    if (!score) {
      const text = norm(`${t.term} ${(t.aka ?? []).join(" ")} ${t.plain} ${t.example ?? ""}`);
      const inText = (x) => { const words = x.split(" "); return x.replace(/ /g, "").length >= 2 && (words.some((w) => w.length < 2) ? at(text, x) : words.every((w) => at(text, w))); };
      if (qs.some(inText)) score = 20;
    }
    if (score) scored.push({ t, score });
  }
  return scored.sort((a, b) => b.score - a.score || abc(a.t, b.t)).map((x) => x.t);
}

/**
 * The words that matter for this household, by what its plan holds: each account type, a business on the Income page,
 * shares from an employer (each kind of grant its own words), children, someone 50 or over this year (catch-up saving),
 * 60 or over (Medicare, Social Security's full retirement age, required withdrawals). Names that the glossary does not
 * have are skipped.
 */
export const PLAN_WORDS = {
  account: {
    "401k": ["401(k)"], ira: ["IRA"], roth: ["Roth IRA"], hsa: ["HSA"], "529": ["529 plan"], brokerage: ["Cost basis", "Capital gains"],
    crypto: ["Crypto"], cash_value_life: ["Cash value"], credit: ["APR", "Credit utilization"], loan: ["APR", "Amortization"],
    mortgage: ["Escrow", "Amortization"], student_loan: ["Income-driven repayment"],
  },
  business: ["Self-employment tax"],
  equity: { any: ["Vesting"], rsu: ["RSU"], option: ["Stock option"], iso: ["ISO"], nso: ["NSO"], espp: ["ESPP"] },
  children: ["Child tax credit"],
  age50: ["Catch-up contribution"],
  age60: ["Medicare", "Full retirement age", "Required minimum distribution"],
};

export function forPlan(plan, { today = null, terms = TERMS } = {}) {
  const want = [];
  const types = new Set((plan.accounts ?? []).map((a) => a?.type));
  for (const [type, ws] of Object.entries(PLAN_WORDS.account)) if (types.has(type)) want.push(...ws);
  if ((plan.income ?? []).some((x) => x?.type === "business")) want.push(...PLAN_WORDS.business);
  // equity: grants [{ kind: "rsu" | "option", optionType?: "nso" | "iso" }] (a grant with no kind counts as shares), espp [...]
  const grants = plan.equity?.grants ?? [];
  if (grants.length) want.push(...PLAN_WORDS.equity.any);
  if (grants.some((g) => g?.kind !== "option")) want.push(...PLAN_WORDS.equity.rsu);
  const opts = grants.filter((g) => g?.kind === "option");
  if (opts.length) want.push(...PLAN_WORDS.equity.option);
  if (opts.some((g) => g?.optionType === "iso")) want.push(...PLAN_WORDS.equity.iso);
  if (opts.some((g) => g?.optionType !== "iso")) want.push(...PLAN_WORDS.equity.nso);
  if ((plan.equity?.espp ?? []).length) want.push(...PLAN_WORDS.equity.espp);
  const people = plan.household?.people ?? [];
  if (people.some((p) => p?.role === "dependent")) want.push(...PLAN_WORDS.children);
  const year = Number(String(today ?? "").slice(0, 4)) || null;
  const ages = year ? people.filter((p) => p?.role !== "dependent" && p?.birthDate).map((p) => year - Number(String(p.birthDate).slice(0, 4))) : [];
  if (ages.some((a) => a >= 50)) want.push(...PLAN_WORDS.age50);
  if (ages.some((a) => a >= 60)) want.push(...PLAN_WORDS.age60);
  const out = [];
  for (const w of want) { const t = find(w, terms); if (t && !out.includes(t)) out.push(t); }
  return out;
}

/**
 * The question sent to the AI helper for a word the glossary does not have: the word only (cut to 80 characters),
 * never anything from the plan, and an instruction to answer plainly with no yearly dollar limits.
 */
export const askMessages = (word) => [
  { role: "system", content: "You explain US personal finance words to someone who is not a finance person. Answer in two or three plain sentences, with one short example using round invented numbers. No advice, no current-year dollar limits, no jargon left unexplained. If the word is not a money word, say so in one sentence." },
  { role: "user", content: `What does "${String(word ?? "").trim().slice(0, 80)}" mean?` },
];

/** Agency short forms at the start of a source's name, in words a layperson knows. */
const AGENCY = {
  CFPB: "Consumer Financial Protection Bureau", FINRA: "FINRA (the brokers' watchdog)", "SSA POMS": "Social Security staff manual",
  SSA: "Social Security", "LII Wex": "Cornell Law School's legal dictionary", LII: "Cornell Law School",
  SEC: "Securities and Exchange Commission", BLS: "Bureau of Labor Statistics", FDIC: "Federal Deposit Insurance Corporation",
  DOL: "Department of Labor",
};
/** A source's name as shown: the agency spelled out, one dash instead of a second colon ("CFPB: What is..." -> "Consumer Financial Protection Bureau – What is..."). */
export const sourceLabel = (name) => String(name ?? "")
  .replace(/^(?:Cornell Law School )?(CFPB|FINRA|SSA POMS|SSA|LII Wex|LII|SEC|BLS|FDIC|DOL)\b/, (_, m) => AGENCY[m])
  .replace(": ", " – ");

/**
 * compute(plan, { today }) -> { count, topics: [{ key, label, count }], mine: [entries for this household] }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const topics = TOPICS.map((x) => ({ ...x, count: TERMS.filter((t) => t.topic === x.key).length })).filter((x) => x.count);
  return { count: TERMS.length, topics, mine: forPlan(plan, { today }) };
}

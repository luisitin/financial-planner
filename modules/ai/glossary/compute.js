// modules/ai/glossary/compute.js -- PURE. The glossary: every money word the app uses, in plain words, with a search
// that ranks the closest names first, the words that matter for this household (from what its plan holds), and the
// topics to browse by.
import { TERMS, TOPICS } from "./data/terms.js";

/** Lower case, accents and punctuation off (but "401(k)" and "50/30/20" keep their marks), single spaces. */
export const norm = (s) => String(s ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9%()/]+/g, " ").trim();
const names = (t) => [t.term, ...(t.aka ?? [])].map(norm);

/** The short other names worth showing next to a word (abbreviations such as "FICA"), at most two, none already in its name. */
export function shortNames(t) {
  const bare = (x) => ` ${norm(x).replace(/[()]/g, "")} `;   // "401(k)" and "401k" alike; whole words only
  return (t.aka ?? []).filter((a) => /^[A-Z0-9][A-Z0-9()/-]{1,7}$/.test(a) && !bare(t.term).includes(bare(a))).slice(0, 2);
}

/** The entry whose name or other name is exactly `name` (any case), or null. */
export function find(name, terms = TERMS) {
  const q = norm(name);
  return terms.find((t) => names(t).includes(q)) ?? null;
}

/**
 * Search: every entry matching all the words typed, best first: 100 a name exactly, 80 a name starting with it, 60 a
 * word in a name starting with it, 50 a name containing it, 20 the definition or example containing every word.
 * Ties go alphabetically. Nothing typed: every entry, alphabetically.
 */
export function search(query, terms = TERMS) {
  const q = norm(query);
  const abc = (a, b) => a.term.localeCompare(b.term, "en", { sensitivity: "base" });
  if (!q) return [...terms].sort(abc);
  const words = q.split(" ");
  const scored = [];
  for (const t of terms) {
    const ns = names(t);
    let score = 0;
    if (ns.includes(q)) score = 100;
    else if (ns.some((n) => n.startsWith(q))) score = 80;
    else if (ns.some((n) => n.split(" ").some((w) => w.startsWith(q)))) score = 60;
    else if (ns.some((n) => n.includes(q))) score = 50;
    else { const text = norm(`${t.term} ${(t.aka ?? []).join(" ")} ${t.plain} ${t.example ?? ""}`); if (words.every((w) => text.includes(w))) score = 20; }
    if (score) scored.push({ t, score });
  }
  return scored.sort((a, b) => b.score - a.score || abc(a.t, b.t)).map((x) => x.t);
}

/**
 * The words that matter for this household, by what its plan holds: each account type, a business on the Income page,
 * shares from an employer, children, someone 50 or over (catch-up saving), 60 or over (Medicare, Social Security's full
 * retirement age, required withdrawals). Names that the glossary does not have are skipped.
 */
export const PLAN_WORDS = {
  account: {
    "401k": ["401(k)"], ira: ["IRA"], roth: ["Roth IRA"], hsa: ["HSA"], "529": ["529 plan"], brokerage: ["Cost basis", "Capital gains"],
    crypto: ["Crypto"], cash_value_life: ["Cash value"], credit: ["APR", "Credit utilization"], loan: ["APR", "Amortization"],
    mortgage: ["Escrow", "Amortization"], student_loan: ["Income-driven repayment"],
  },
  business: ["Self-employment tax"],
  equity: ["Vesting", "RSU"],
  children: ["Child tax credit"],
  age50: ["Catch-up contribution"],
  age60: ["Medicare", "Full retirement age", "Required minimum distribution"],
};

export function forPlan(plan, { today = null, terms = TERMS } = {}) {
  const want = [];
  const types = new Set((plan.accounts ?? []).map((a) => a?.type));
  for (const [type, ws] of Object.entries(PLAN_WORDS.account)) if (types.has(type)) want.push(...ws);
  if ((plan.income ?? []).some((x) => x?.type === "business")) want.push(...PLAN_WORDS.business);
  if ((plan.equity?.grants ?? []).length) want.push(...PLAN_WORDS.equity);
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
 * compute(plan, { today }) -> { count, topics: [{ key, label, count }], mine: [entries for this household] }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const topics = TOPICS.map((x) => ({ ...x, count: TERMS.filter((t) => t.topic === x.key).length })).filter((x) => x.count);
  return { count: TERMS.length, topics, mine: forPlan(plan, { today }) };
}

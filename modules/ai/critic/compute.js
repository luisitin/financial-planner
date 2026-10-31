// modules/ai/critic/compute.js -- PURE. The plan critic: a fact sheet of what the plan's own pages already work out
// (the health score's seven parts, the next-best-action steps, the estate papers), with people's names swapped for
// "Adult 1", "Child 1" and account names for their kind; the question that asks the AI for the gaps and risks it sees,
// each tied to one of the app's pages; and its answer read back, names put back, pages that do not exist dropped.
// The AI explains; nothing it says is saved in the plan or changes a number (AGENTS.md rule 5).
import { compute as computeHealth } from "../../overview/health-score/compute.js";
import { compute as computeNext } from "../../overview/next-best-action/compute.js";
import { compute as computeDocs } from "../../estate/documents/compute.js";
import { ACCOUNT_TYPES } from "../../balance/net-worth/compute.js";

/** At most this many points from the AI. */
export const MAX_POINTS = 8;
export const LEVELS = { high: "Fix first", medium: "Worth doing", low: "When you can" };

const STATUS_WORDS = { single: "single", married_joint: "married filing jointly", married_separate: "married filing separately", head_of_household: "head of household", qualifying_surviving: "qualifying surviving spouse" };
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** People's names to stand-ins: adults "Adult 1", "Adult 2"... in household order, children "Child 1"... */
export function aliases(plan) {
  const out = [];
  let a = 0, c = 0;
  for (const p of plan.household?.people ?? []) {
    const name = String(p?.name ?? "").trim();
    if (!name) continue;
    out.push({ name, alias: p.role === "dependent" ? `Child ${++c}` : `Adult ${++a}` });
  }
  return out;
}

/** A text with each person's name (whole word, also "Ana's") swapped for the stand-in, and each account's name for its kind. */
export function hide(text, plan, names = aliases(plan)) {
  let s = String(text ?? "");
  const accounts = [...(plan.accounts ?? [])].filter((x) => String(x?.name ?? "").trim().length > 1).sort((x, y) => y.name.length - x.name.length);
  for (const acc of accounts) s = s.replace(new RegExp(`(?<![\\w])${esc(acc.name.trim())}(?![\\w])`, "g"), `the ${(ACCOUNT_TYPES[acc.type]?.label ?? "account").toLowerCase()}`);
  for (const n of [...names].sort((x, y) => y.name.length - x.name.length)) s = s.replace(new RegExp(`(?<![\\w])${esc(n.name)}(?![\\w])`, "g"), n.alias);
  return s;
}
/** The stand-ins put back ("Adult 1" -> the person's name) in what the AI wrote. */
export function restore(text, names) {
  let s = String(text ?? "");
  for (const n of [...names].sort((x, y) => y.alias.length - x.alias.length)) s = s.replace(new RegExp(`\\b${esc(n.alias)}\\b`, "g"), n.name);
  return s;
}

/**
 * The fact sheet: plain lines the AI reads, nothing else from the plan. Each line comes from a page that works it out:
 * the household (counts and ages only), the health score's parts (status, what it found, what would fix it), the
 * next-best-action steps not done, and the estate papers. -> { lines: [string], names: [{ name, alias }], ready }
 */
export function factSheet(plan, { today } = {}) {
  const names = aliases(plan);
  const people = plan.household?.people ?? [];
  const year = Number(String(today ?? "").slice(0, 4)) || null;
  const age = (p) => (year && /^\d{4}/.test(String(p.birthDate ?? "")) ? year - Number(String(p.birthDate).slice(0, 4)) : null);
  const lines = [];
  const adults = people.filter((p) => p.role !== "dependent"), kids = people.filter((p) => p.role === "dependent");
  if (!adults.length) return { lines, names, ready: false };
  const who = (p) => names.find((n) => n.name === String(p.name ?? "").trim())?.alias ?? (p.role === "dependent" ? "a child" : "an adult");
  lines.push(`Household: ${[...adults, ...kids].map((p) => `${who(p)}${age(p) !== null ? ` (age ${age(p)})` : ""}`).join(", ")}${STATUS_WORDS[plan.household?.filingStatus] ? `; files taxes as ${STATUS_WORDS[plan.household.filingStatus]}` : ""}${plan.household?.state ? `; lives in ${plan.household.state}` : ""}.`);
  const safe = (f) => { try { return f(); } catch { return null; } };
  const h = safe(() => computeHealth(plan, { today }));
  if (h?.ready) {
    lines.push(`Plan health score: ${h.score} of 100 (${h.band}).`);
    for (const p of h.parts) lines.push(`${p.title} (${p.status === "ok" ? "fine" : p.status === "warn" ? "needs attention" : p.status === "bad" ? "a problem" : "not known yet"}): ${p.detail}${p.fix ? ` To fix: ${p.fix}` : ""}`);
  }
  const n = safe(() => computeNext(plan, { today }));
  if (n?.steps) for (const s of n.steps.filter((x) => x.status === "now" || x.status === "check")) lines.push(`Next step (${s.status === "now" ? "do now" : "check"}): ${s.title}. ${s.detail}`);
  const d = safe(() => computeDocs(plan, { today }));
  if (d && d.required) {
    const missing = [...new Set(d.items.filter((x) => !x.optional && x.status !== "done").map((x) => x.label))];
    lines.push(`Estate papers: ${d.done} of ${d.required} done${missing.length ? `; missing: ${missing.join(", ")}` : ""}.`);
    for (const w of d.warnings ?? []) lines.push(`Estate warning: ${w}`);
  }
  return { lines: lines.map((l) => hide(l, plan, names)), names, ready: true };
}

/** The pages the AI may point to: built ones (usable or partly built), not this one. pages: [{ key, title, purpose, status }]. */
export const allowedPages = (pages) => (pages ?? []).filter((m) => m && m.key !== "ai/critic" && (m.status === "usable" || m.status === "stub"));

/** The question: the fact sheet and the allowed pages in, a JSON list of points out. -> { system, user } */
export function buildPrompt(lines, pages) {
  return {
    system: `You review a household's financial plan for gaps and risks, for someone who is not a finance person. Use only the facts given; never invent numbers or facts. Answer with JSON only: an array of at most ${MAX_POINTS} objects {"title": <a short plain sentence naming the gap>, "why": <one or two plain sentences on why it matters, using the facts>, "page": <one page key from the PAGES list where it can be fixed>, "level": "high" | "medium" | "low"}, most important first. No advice to buy a named product. No prose outside the JSON.`,
    user: `FACTS:\n${lines.map((l) => `- ${l}`).join("\n")}\n\nPAGES (key: title, what it does):\n${pages.map((p) => `${p.key}: ${p.title}, ${p.purpose ?? ""}`).join("\n")}`,
  };
}

/**
 * The answer read back: at most MAX_POINTS points with a title, in the order given; "why" optional; a page that is
 * not in the allowed list becomes null; a level other than high/medium/low becomes "medium"; stand-ins put back.
 * -> [{ title, why, page, level }]
 */
export function readAnswer(text, pages, names = []) {
  const m = /\[[\s\S]*\]/.exec(String(text ?? ""));
  if (!m) return [];
  let arr; try { arr = JSON.parse(m[0]); } catch { return []; }
  const keys = new Set((pages ?? []).map((p) => p.key));
  const clean = (v, max) => restore(String(v ?? "").replace(/\s+/g, " ").trim(), names).slice(0, max);
  const out = [], seen = new Set();
  for (const x of Array.isArray(arr) ? arr : []) {
    if (!x || typeof x !== "object") continue;
    const title = clean(x.title, 200), key = String(x.title ?? "").replace(/\s+/g, " ").trim().toLowerCase();
    if (!title || seen.has(key)) continue;   // a repeat, any case, as the AI wrote it
    seen.add(key);
    out.push({ title, why: clean(x.why, 600), page: keys.has(x.page) ? x.page : null, level: LEVELS[x.level] ? x.level : "medium" });
    if (out.length >= MAX_POINTS) break;
  }
  return out;
}

/** compute(plan) -> { ready (someone in the household), people, adults }. The fact sheet is built only when asked (it runs the health score). */
export function compute(plan) {
  const people = plan.household?.people ?? [];
  const adults = people.filter((p) => p.role !== "dependent").length;
  return { ready: adults > 0, people: people.length, adults };
}

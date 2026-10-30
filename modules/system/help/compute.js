// modules/system/help/compute.js -- PURE. The help page's content: the first steps of a plan and which are
// done (from the plan itself), every page grouped by section with what it is for (from the page manifests the
// view passes in), a search over them, and the questions people ask most.
import { matchRank } from "../../../core/search.js";

/** The first steps, in order, with how to tell each is done. */
export function startSteps(plan) {
  const people = plan.household?.people ?? [];
  const has = (k) => (plan[k] ?? []).length > 0;
  const debts = (plan.accounts ?? []).filter((a) => ["credit", "loan", "mortgage", "student_loan", "other_liability"].includes(a.type) && Number(a.balance) !== 0);
  const debtDetail = new Set((plan.debts ?? []).filter((d) => Number(d.rate) > 0 && Number(d.minPayment) > 0).map((d) => d.accountId));
  return [
    { id: "people", title: "Who is in the household", why: "Ages drive retirement, Social Security, Medicare and tax.", done: people.some((p) => p.role !== "dependent" && p.birthDate), go: ["household", "people"] },
    { id: "accounts", title: "What you own and owe", why: "Every account, the home and each debt, with today's balance.", done: has("accounts"), go: ["balance", "accounts"] },
    { id: "income", title: "What comes in", why: "Pay, a business, rent, pensions: the starting point for tax and saving.", done: has("income"), go: ["cashflow", "income"] },
    { id: "expenses", title: "What goes out", why: "Bills and spending; a bank file can fill it for you.", done: has("expenses") || has("transactions"), go: ["cashflow", "expenses"] },
    { id: "debts", title: "Each debt's rate and payment", why: "So payoff dates and interest are real.", done: debts.length === 0 || debts.every((a) => debtDetail.has(a.id)), go: ["debt", "payoff"] },
    { id: "goals", title: "What you are saving for", why: "An emergency fund, a home, college, a trip.", done: has("goals"), go: ["goals", "goals"] },
    { id: "retirement", title: "Retirement saving", why: "What goes into the 401(k) and IRA, so the projection can grow it.", done: (plan.retirement?.contributions ?? []).length > 0, go: ["retirement", "contributions"] },
  ];
}

/**
 * The page directory: sections in sidebar order, each page with its title, what it is for and whether it is
 * ready. `manifests`: [{ group, id, title, purpose, status, placeholder, enabled }]; `groups`: [{ id, title, icon }].
 * With a query, only matching pages, best first, in one list.
 */
export function directory(manifests, groups, query = "") {
  const q = String(query ?? "").trim();
  const entry = (m) => ({ key: `${m.group}/${m.id}`, group: m.group, id: m.id, title: m.title, purpose: m.purpose ?? "", ready: m.status === "usable" || m.status === "stub", planned: m.status === "planned" || !!m.placeholder, enabled: m.enabled !== false });
  const list = manifests.filter((m) => m.group && m.id && m.enabled !== false);
  if (q) {
    const title = (g) => groups.find((x) => x.id === g)?.title ?? g;
    return { query: q, results: list.map((m) => ({ m, r: matchRank(m, title(m.group), q) })).filter((x) => x.r >= 0).sort((a, b) => a.r - b.r || a.m.title.localeCompare(b.m.title)).map((x) => entry(x.m)), sections: [] };
  }
  const sections = groups.map((g) => {
    const pages = list.filter((m) => m.group === g.id).sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.title.localeCompare(b.title)).map(entry);
    return { id: g.id, title: g.title, icon: g.icon, pages, ready: pages.filter((p) => p.ready).length };
  }).filter((s) => s.pages.length);
  return { query: "", results: [], sections };
}

/** The questions people ask most, in plain words. */
export const FAQ = [
  { q: "Where is my plan kept?", a: "In one file on the computer that runs the app. Phones and laptops at home open that same plan through it. Nothing is sent to a company; there is no account to sign up for." },
  { q: "How are the numbers worked out?", a: "By formulas written into each page, from published tax tables, Social Security's rules and the figures you type. Each page's notes say which formula and where it comes from." },
  { q: "What does the AI helper do?", a: "It reads, sorts and explains: it can put bank lines into categories, pull figures out of a statement, or answer a question about your plan. It never changes a number on its own: nothing it suggests reaches your plan until you press apply. It runs on your own computer unless you set it up otherwise." },
  { q: "Can I try something without changing my plan?", a: "Yes: open the app with ?sandbox=1 at the end of the address. An orange Sandbox badge shows at the top; that pretend plan lives only in this browser. For a single what-if, the What-if scenarios pages copy your plan and change one thing." },
  { q: "When are my changes saved?", a: "When you press Save, Add or a similar button, or tick a box. Each page says so in a green line at the top. Typing alone does not save." },
  { q: "Why does a balance differ from my bank's?", a: "The plan uses the balance you typed and the date you typed it. Update it on Accounts, or import a bank file on Transactions." },
  { q: "What does \"in today's money\" mean?", a: "A future amount with rising prices taken out, so it buys what that amount would buy today. $100 in 20 years at 3% inflation is about $55 in today's money." },
  { q: "How do I keep a copy of my plan?", a: "System > Settings has a \"Download a copy\" button: the whole plan as one file, which the same page can restore. Keep it somewhere safe; it holds your whole financial picture." },
  { q: "Some pages say \"Coming soon\"", a: "They are planned and not built yet. Each says what it will do; you can leave a note on it saying what you want from it." },
];

export function compute(plan) {
  const steps = startSteps(plan);
  return { steps, done: steps.filter((s) => s.done).length, total: steps.length, faq: FAQ };
}

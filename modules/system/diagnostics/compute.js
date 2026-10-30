// modules/system/diagnostics/compute.js -- PURE. A check of the plan itself: links between its parts that point at
// something no longer there (a person, an account, a goal), the same id used twice, dates that are not dates, amounts
// that are not numbers, "how often" values the app does not know, rates typed as whole numbers, the people's roles, the
// plan's version and size; with a fix for the ones that have a safe one. Also every page's own sums run on the plan.
import { SCHEMA_VERSION } from "../../../core/schema/migrate.js";
import { PERIODS } from "../../../core/math/periods.js";

/** What a browser keeps for one site in its local storage, in characters (MDN, "Storage quotas and eviction criteria": 5 MiB per origin). */
export const STORAGE_LIMIT = 5 * 1024 * 1024;
/** Warn when the plan takes this share of it: the offline copy stops saving when it is full. */
export const STORAGE_WARN = 0.8;

const list = (v) => (Array.isArray(v) ? v : []);
const isDate = (s) => {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const days = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return m >= 1 && m <= 12 && d >= 1 && d <= days[m - 1];
};
const given = (v) => v !== null && v !== undefined && v !== "";
const isNum = (v) => typeof v === "number" ? Number.isFinite(v) : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v));
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const PROPERTY_PAGE = { home: "property/home", rental: "property/rental", vehicle: "property/vehicles", purchase: "property/purchase" };

/**
 * The links in the plan: a list, its field, what it points at, whether it must be set (else blank is the household, or
 * no link), the page that edits it, the words for one and for several, and the fix: "clear" (blank the link: the item becomes the household's, or loses its goal or account),
 * "drop" (take the missing ids out of a list of ids), or null (the item needs its owner page).
 */
export const LINKS = [
  { key: "income.person", get: (p) => p.income, field: "personId", to: "people", what: ["income item", "income items"], page: "cashflow/income", fix: "clear", say: ["belongs to someone no longer on the People page", "belong to someone no longer on the People page"], fixLabel: ["Make it the household's", "Make them the household's"] },
  { key: "accounts.owner", get: (p) => p.accounts, field: "ownerId", to: "people", what: ["account", "accounts"], page: "balance/net-worth", fix: "clear", say: ["belongs to someone no longer on the People page", "belong to someone no longer on the People page"], fixLabel: ["Make it the household's", "Make them the household's"] },
  { key: "contributions.person", get: (p) => p.retirement?.contributions, field: "personId", to: "people", what: ["retirement saving", "retirement savings"], page: "retirement/contributions", fix: "clear", say: ["belongs to someone no longer on the People page", "belong to someone no longer on the People page"], fixLabel: ["Make it the household's", "Make them the household's"] },
  { key: "contributions.account", get: (p) => p.retirement?.contributions, field: "accountId", to: "accounts", required: true, what: ["retirement saving", "retirement savings"], page: "retirement/contributions", fix: null, say: ["goes into an account that no longer exists", "go into an account that no longer exists"] },
  { key: "goals.fundedBy", get: (p) => p.goals, field: "fundedBy", many: true, to: "accounts", what: ["goal", "goals"], page: "goals/goals", fix: "drop", say: ["counts an account that no longer exists", "count an account that no longer exists"], fixLabel: ["Take the missing account off", "Take the missing accounts off"] },
  { key: "debts.account", get: (p) => p.debts, field: "accountId", to: "accounts", required: true, what: ["loan detail", "loan details"], page: "balance/liabilities", fix: null, say: ["belongs to an account that no longer exists", "belong to an account that no longer exists"] },
  { key: "transactions.account", get: (p) => p.transactions, field: "accountId", to: "accounts", what: ["transaction", "transactions"], page: "transactions/ledger", fix: null, say: ["is in an account that no longer exists", "are in an account that no longer exists"] },
  { key: "holdings.account", get: (p) => p.holdings, field: "accountId", to: "accounts", required: true, what: ["investment", "investments"], page: "investments/holdings", fix: null, say: ["is in an account that no longer exists", "are in an account that no longer exists"] },
  { key: "rules.account", get: (p) => p.rules, field: "accountId", to: "accounts", what: ["sorting rule", "sorting rules"], page: "transactions/rules", fix: "clear", say: ["is for an account that no longer exists", "are for an account that no longer exists"], fixLabel: ["Make it work for every account", "Make them work for every account"] },
  { key: "insurance.person", get: (p) => p.insurance?.policies, field: "personId", to: "people", what: ["insurance policy", "insurance policies"], page: "insurance/policies", fix: "clear", say: ["covers someone no longer on the People page", "cover someone no longer on the People page"], fixLabel: ["Make it the household's", "Make them the household's"] },
  { key: "estate.person", get: (p) => p.estate?.documents, field: "personId", to: "people", what: ["estate paper (a will, a power of attorney)", "estate papers"], page: "estate/documents", fix: "clear", say: ["belongs to someone no longer on the People page", "belong to someone no longer on the People page"], fixLabel: ["Make it the household's", "Make them the household's"] },
  { key: "events.goal", get: (p) => p.events, field: "goalId", to: "goals", what: ["trip or event", "trips and events"], page: "goals/travel", fix: "clear", say: ["saves toward a goal that no longer exists", "save toward a goal that no longer exists"], fixLabel: ["Unlink the missing goal", "Unlink the missing goals"] },
  { key: "property.account", get: (p) => p.property, field: "accountId", to: "accounts", what: ["property", "properties"], page: (x) => PROPERTY_PAGE[x?.kind] ?? "property/home", fix: "clear", say: ["points at an account that no longer exists", "point at an account that no longer exists"], fixLabel: ["Unlink the missing account", "Unlink the missing accounts"] },
];

/** The lists whose items each need their own id (the app finds, changes and removes items by it). */
export const ID_LISTS = [
  { key: "people", get: (p) => p.household?.people, what: "people", page: "household/people" },
  { key: "accounts", get: (p) => p.accounts, what: "accounts", page: "balance/net-worth" },
  { key: "income", get: (p) => p.income, what: "income items", page: "cashflow/income" },
  { key: "expenses", get: (p) => p.expenses, what: "expenses", page: "cashflow/expenses" },
  { key: "goals", get: (p) => p.goals, what: "goals", page: "goals/goals" },
  { key: "debts", get: (p) => p.debts, what: "loan details", page: "balance/liabilities" },
  { key: "contributions", get: (p) => p.retirement?.contributions, what: "retirement savings", page: "retirement/contributions" },
  { key: "holdings", get: (p) => p.holdings, what: "investments", page: "investments/holdings" },
  { key: "transactions", get: (p) => p.transactions, what: "transactions", page: "transactions/ledger" },
  { key: "policies", get: (p) => p.insurance?.policies, what: "insurance policies", page: "insurance/policies" },
  { key: "property", get: (p) => p.property, what: "properties", page: "property/home" },
  { key: "events", get: (p) => p.events, what: "trips and events", page: "goals/travel" },
];

/** Amounts with a "how often": the list, the page, the words. */
const PERIOD_LISTS = [
  { key: "income", get: (p) => p.income, what: ["income item", "income items"], page: "cashflow/income" },
  { key: "expenses", get: (p) => p.expenses, what: ["expense", "expenses"], page: "cashflow/expenses" },
  { key: "contributions", get: (p) => p.retirement?.contributions, what: ["retirement saving", "retirement savings"], page: "retirement/contributions" },
];

/** Rates kept as fractions (6% is 0.06): above 1 means 100%, almost surely typed as a whole number. */
const RATE_FIELDS = [
  { key: "debts.rate", get: (p) => p.debts, field: "rate", what: ["loan", "loans"], label: "interest rate", page: "balance/liabilities" },
  { key: "goals.rate", get: (p) => p.goals, field: "rate", what: ["goal", "goals"], label: "growth rate", page: "goals/goals" },
];
const ASSUMPTION_RATES = ["inflation", "returnStocks", "returnBonds", "returnCash", "salaryGrowth"];

const ids = (plan, to) => new Set((to === "people" ? list(plan.household?.people) : to === "accounts" ? list(plan.accounts) : list(plan.goals)).map((x) => x?.id));

/**
 * compute(plan, { today }) -> {
 *   issues: [{ key, level: "bad"|"warn", page, text, count, fix: null|{ label }, names }],
 *   counts: { people, accounts, transactions, income, expenses, goals, debts, holdings },
 *   size: { chars, share (of STORAGE_LIMIT), warn },
 *   schema: { plan, app, newer }
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  // items are named by their name, else (a loan detail, a saving) their account's, else their id
  const accountNames = new Map(list(plan.accounts).filter((a) => a && given(a.id) && a.name).map((a) => [a.id, a.name]));
  const nameOf = (x) => x?.name || x?.payee || x?.symbol || accountNames.get(x?.accountId) || x?.id || "(no name)";
  const some = (xs, n = 3) => xs.slice(0, n).map(nameOf).join(", ") + (xs.length > n ? ` and ${xs.length - n} more` : "");
  const issues = [];
  const add = (x) => issues.push({ fix: null, names: "", ...x });

  // links that point at nothing
  for (const L of LINKS) {
    const targets = ids(plan, L.to);
    const broken = list(L.get(plan)).filter((x) => {
      if (!x || typeof x !== "object") return false;
      if (L.many) return list(x[L.field]).some((id) => given(id) && !targets.has(id));
      const v = x[L.field];
      if (!given(v)) return !!L.required;
      return !targets.has(v);
    });
    if (!broken.length) continue;
    const page = typeof L.page === "function" ? L.page(broken[0]) : L.page;
    add({ key: `link:${L.key}`, level: L.required ? "bad" : "warn", page, count: broken.length, names: some(broken),
      text: `${plural(broken.length, ...L.what)} ${L.say[broken.length === 1 ? 0 : 1]}`,
      fix: L.fix ? { label: L.fixLabel[broken.length === 1 ? 0 : 1] } : null });
  }

  // the same id twice in one list
  for (const D of ID_LISTS) {
    const seen = new Set(), dup = [], none = [];
    for (const x of list(D.get(plan))) {
      if (!x || typeof x !== "object") continue;
      if (!given(x.id)) { none.push(x); continue; }
      if (seen.has(x.id)) dup.push(x); else seen.add(x.id);
    }
    if (dup.length || none.length) add({ key: `ids:${D.key}`, level: "bad", page: D.page, count: dup.length + none.length, names: some([...dup, ...none]),
      text: `${dup.length + none.length} of your ${D.what} ${dup.length ? "share an id with another" : "have no id"}${dup.length && none.length ? " or have none" : ""}, so changing or removing one can touch the wrong one`,
      fix: { label: dup.length + none.length === 1 ? "Give it its own id" : "Give each its own id" } });
  }

  // "how often" the app does not know (counted as every month), and amounts that are not numbers
  for (const L of PERIOD_LISTS) {
    const items = list(L.get(plan)).filter((x) => x && typeof x === "object");
    const odd = items.filter((x) => given(x.period) && !PERIODS[x.period]);
    if (odd.length) add({ key: `period:${L.key}`, level: "warn", page: L.page, count: odd.length, names: some(odd),
      text: `${plural(odd.length, ...L.what)} ${odd.length === 1 ? "has" : "have"} a "how often" the app does not know ("${odd[0].period}"), so ${odd.length === 1 ? "it is" : "they are"} counted as every month` });
    const bad = items.filter((x) => !isNum(x.amount) || Number(x.amount) < 0);
    if (bad.length) add({ key: `amount:${L.key}`, level: "bad", page: L.page, count: bad.length, names: some(bad),
      text: `${plural(bad.length, ...L.what)} ${bad.length === 1 ? "has an amount that is" : "have amounts that are"} not a number of 0 or more, so ${bad.length === 1 ? "it counts" : "they count"} as 0` });
  }
  const balances = list(plan.accounts).filter((x) => x && typeof x === "object" && !isNum(x.balance));
  if (balances.length) add({ key: "amount:accounts", level: "bad", page: "balance/net-worth", count: balances.length, names: some(balances),
    text: `${plural(balances.length, "account")} ${balances.length === 1 ? "has a balance that is" : "have balances that are"} not a number, so ${balances.length === 1 ? "it counts" : "they count"} as 0` });

  // dates that are not real dates, ends before starts, dates still to come that cannot be
  const DATES = [
    { key: "people.birth", get: (p) => p.household?.people, field: "birthDate", what: ["person's birth date", "people's birth dates"], page: "household/people", future: "is after today" },
    { key: "accounts.asOf", get: (p) => p.accounts, field: "asOf", what: ["account's balance date", "accounts' balance dates"], page: "balance/net-worth", future: "is after today" },
    { key: "goals.date", get: (p) => p.goals, field: "targetDate", what: ["goal's date", "goals' dates"], page: "goals/goals" },
    { key: "income.start", get: (p) => p.income, field: "startDate", what: ["income item's start", "income items' starts"], page: "cashflow/income" },
    { key: "income.end", get: (p) => p.income, field: "endDate", what: ["income item's end", "income items' ends"], page: "cashflow/income" },
    { key: "expenses.start", get: (p) => p.expenses, field: "startDate", what: ["expense's start", "expenses' starts"], page: "cashflow/expenses" },
    { key: "expenses.end", get: (p) => p.expenses, field: "endDate", what: ["expense's end", "expenses' ends"], page: "cashflow/expenses" },
    { key: "transactions.date", get: (p) => p.transactions, field: "date", what: ["transaction's date", "transactions' dates"], page: "transactions/ledger" },
  ];
  for (const D of DATES) {
    const items = list(D.get(plan)).filter((x) => x && typeof x === "object" && given(x[D.field]));
    const bad = items.filter((x) => !isDate(x[D.field]));
    if (bad.length) add({ key: `date:${D.key}`, level: "bad", page: D.page, count: bad.length, names: some(bad),
      text: `${plural(bad.length, ...D.what)} ${bad.length === 1 ? "is not a real date" : "are not real dates"} (for example "${bad[0][D.field]}")` });
    if (D.future && today) {
      const later = items.filter((x) => isDate(x[D.field]) && x[D.field] > today);
      if (later.length) add({ key: `future:${D.key}`, level: "warn", page: D.page, count: later.length, names: some(later),
        text: `${plural(later.length, ...D.what)} ${D.future}` });
    }
  }
  for (const L of [{ key: "income", get: (p) => p.income, what: ["income item", "income items"], page: "cashflow/income" }, { key: "expenses", get: (p) => p.expenses, what: ["expense", "expenses"], page: "cashflow/expenses" }]) {
    const back = list(L.get(plan)).filter((x) => x && isDate(x.startDate) && isDate(x.endDate) && x.endDate < x.startDate);
    if (back.length) add({ key: `order:${L.key}`, level: "warn", page: L.page, count: back.length, names: some(back),
      text: `${plural(back.length, ...L.what)} ${back.length === 1 ? "ends" : "end"} before ${back.length === 1 ? "it starts" : "they start"}, so ${back.length === 1 ? "it never counts" : "they never count"}` });
  }

  // rates typed as whole numbers (6 for 6% is 600%)
  for (const R of RATE_FIELDS) {
    const high = list(R.get(plan)).filter((x) => x && isNum(x[R.field]) && Number(x[R.field]) > 1);
    if (high.length) add({ key: `rate:${R.key}`, level: "bad", page: R.page, count: high.length, names: some(high),
      text: `${plural(high.length, ...R.what)} ${high.length === 1 ? "has an" : "have an"} ${R.label} over 100% (for example ${Math.round(Number(high[0][R.field]) * 100)}%): probably ${high[0][R.field]}% was meant`,
      fix: { label: high.length === 1 ? "Read it as a percentage" : "Read them as percentages" } });
  }
  const a = plan.assumptions ?? {};
  const highA = ASSUMPTION_RATES.filter((k) => isNum(a[k]) && Number(a[k]) > 1);
  if (highA.length) add({ key: "rate:assumptions", level: "bad", page: "system/assumptions", count: highA.length, names: highA.join(", "),
    text: `${plural(highA.length, "assumption")} ${highA.length === 1 ? "is" : "are"} over 100% a year (for example ${Math.round(Number(a[highA[0]]) * 100)}%): probably ${a[highA[0]]}% was meant`,
    fix: { label: highA.length === 1 ? "Read it as a percentage" : "Read them as percentages" } });

  // the people: one "you"
  const people = list(plan.household?.people).filter((x) => x && typeof x === "object");
  const selves = people.filter((x) => x.role === "self");
  if (people.length && selves.length !== 1) add({ key: "people.self", level: "warn", page: "household/people", count: selves.length,
    text: selves.length ? `${selves.length} people are marked as "you"; pages that ask whose plan it is take the first` : "Nobody is marked as \"you\" on the People page; pages that need your age take the first adult" });

  // the plan's version and size
  const planVersion = Number(plan.schemaVersion) || 0;
  const newer = planVersion > SCHEMA_VERSION;
  if (newer) add({ key: "schema", level: "warn", page: "system/settings", count: 1,
    text: `This plan was saved by a newer version of the app (plan version ${planVersion}, this app ${SCHEMA_VERSION}): update the app before changing it here` });
  const chars = JSON.stringify(plan).length;
  const share = chars / STORAGE_LIMIT;
  if (share >= STORAGE_WARN) add({ key: "size", level: share >= 1 ? "bad" : "warn", page: "system/settings", count: 1,
    text: `The plan takes ${Math.round(share * 100)}% of the space a browser keeps for one site: ${share >= 1 ? "this device's offline copy no longer saves" : "near the limit, this device's offline copy stops saving"}. Old transactions are usually most of it` });

  issues.sort((x, y) => (x.level === y.level ? 0 : x.level === "bad" ? -1 : 1));
  const counts = { people: people.length, accounts: list(plan.accounts).length, transactions: list(plan.transactions).length, income: list(plan.income).length, expenses: list(plan.expenses).length, goals: list(plan.goals).length, debts: list(plan.debts).length, holdings: list(plan.holdings).length };
  return { issues, counts, size: { chars, share, warn: share >= STORAGE_WARN }, schema: { plan: planVersion, app: SCHEMA_VERSION, newer } };
}

/**
 * The fix for one issue, applied to a draft of the plan (the view passes `store.update`'s draft). Returns how many items
 * changed. Links: blank the field, or take the missing ids out of the list; ids: the second and later copies (and items
 * with none) get the id with "-2", "-3"... added until it is free (links keep pointing at the first); rates: ÷ 100.
 */
export function applyFix(draft, key) {
  let changed = 0;
  if (key.startsWith("link:")) {
    const L = LINKS.find((x) => `link:${x.key}` === key);
    if (!L?.fix) return 0;
    const targets = ids(draft, L.to);
    for (const x of list(L.get(draft))) {
      if (!x || typeof x !== "object") continue;
      if (L.many) {
        const kept = list(x[L.field]).filter((id) => !given(id) || targets.has(id));
        if (kept.length !== list(x[L.field]).length) { x[L.field] = kept; changed++; }
      } else if (given(x[L.field]) && !targets.has(x[L.field])) { x[L.field] = ""; changed++; }
    }
  } else if (key.startsWith("ids:")) {
    const D = ID_LISTS.find((x) => `ids:${x.key}` === key);
    const items = list(D?.get(draft)).filter((x) => x && typeof x === "object");
    const taken = new Set(items.map((x) => x.id).filter(given));
    const seen = new Set();
    for (const x of items) {
      if (given(x.id) && !seen.has(x.id)) { seen.add(x.id); continue; }
      const base = given(x.id) ? String(x.id) : `${D.key}`;
      let n = 2; while (taken.has(`${base}-${n}`)) n++;
      x.id = `${base}-${n}`; taken.add(x.id); seen.add(x.id); changed++;
    }
  } else if (key.startsWith("rate:")) {
    if (key === "rate:assumptions") {
      const a = draft.assumptions ?? {};
      for (const k of ASSUMPTION_RATES) if (isNum(a[k]) && Number(a[k]) > 1) { a[k] = Number(a[k]) / 100; changed++; }
    } else {
      const R = RATE_FIELDS.find((x) => `rate:${x.key}` === key);
      for (const x of list(R?.get(draft))) if (x && isNum(x[R.field]) && Number(x[R.field]) > 1) { x[R.field] = Number(x[R.field]) / 100; changed++; }
    }
  }
  return changed;
}

/**
 * Every page's own sums on the plan: `pages` = [{ key, title, compute, heavy, status }]. Placeholders and heavy pages
 * (simulations, left to their own page) are skipped. -> { ran, skipped, failed: [{ key, title, error }] }
 */
export function checkPages(pages, plan, today) {
  const failed = [];
  let ran = 0, skipped = 0;
  for (const m of pages) {
    if (typeof m.compute !== "function" || m.status === "planned" || m.heavy) { skipped++; continue; }
    ran++;
    try {
      const r = m.compute(structuredClone(plan), { today });
      if (r && typeof r === "object" && typeof r.error === "string") failed.push({ key: m.key, title: m.title, error: r.error });
    } catch (e) { failed.push({ key: m.key, title: m.title, error: String(e?.message ?? e) }); }
  }
  return { ran, skipped, failed };
}

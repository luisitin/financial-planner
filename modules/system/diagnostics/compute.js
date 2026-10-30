// modules/system/diagnostics/compute.js -- PURE. A check of the plan itself: links between its parts that point at
// something no longer there (a person, an account, a goal, a policy), two items with the same hidden label (id), dates
// that are not dates, amounts that are not numbers or below 0, "how often" values missing or unknown, rates typed as
// whole numbers, the people's roles, the plan's version and size; with a fix for the ones that have a safe one. Also
// every page's own sums run on the plan.
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
const GONE_PERSON = ["belongs to someone no longer on the People page", "belong to someone no longer on the People page"];
const HOUSEHOLD = ["Make it the household's", "Make them the household's"];

/**
 * The links in the plan: a list (`get` returns the plan's own array, or a one-item array for a single object), its
 * field, what it points at, whether it must be set (else blank means the household, or no link), the page that edits
 * it, the words for one and for several, and the fix: "clear" (blank the link: the item becomes the household's, or
 * loses its goal or account), "drop" (take the missing ids out of a list of ids), "remove" (take out a leftover that
 * no page can show any more), or null (the item's own page sets it right).
 * Not checked: accounts' "whose account" on Net worth, which is typed text (a name), not a link.
 */
export const LINKS = [
  { key: "income.person", get: (p) => p.income, field: "personId", to: "people", what: ["income item", "income items"], page: "cashflow/income", fix: "clear", say: GONE_PERSON, fixLabel: HOUSEHOLD },
  { key: "contributions.person", get: (p) => p.retirement?.contributions, field: "personId", to: "people", what: ["retirement saving", "retirement savings"], page: "retirement/contributions", fix: "clear", say: GONE_PERSON, fixLabel: HOUSEHOLD },
  { key: "contributions.account", get: (p) => p.retirement?.contributions, field: "accountId", to: "accounts", required: true, what: ["retirement saving", "retirement savings"], page: "retirement/contributions", fix: null, say: ["goes into an account that no longer exists", "go into an account that no longer exists"] },
  { key: "pensions.person", get: (p) => p.retirement?.pensions, field: "personId", to: "people", what: ["pension", "pensions"], page: "retirement/pensions", fix: "clear", say: GONE_PERSON, fixLabel: HOUSEHOLD },
  { key: "annuities.person", get: (p) => p.retirement?.annuities, field: "personId", to: "people", what: ["annuity", "annuities"], page: "retirement/annuities", fix: "clear", say: GONE_PERSON, fixLabel: HOUSEHOLD },
  { key: "equity.person", get: (p) => (p.equity && typeof p.equity === "object" ? [p.equity] : []), field: "personId", to: "people", what: ["employer's shares setting", "employer's shares settings"], page: "investments/employer-stock", fix: "clear", say: ["belongs to someone no longer on the People page", "belong to someone no longer on the People page"], fixLabel: ["Let the app pick whoever has a salary", "Let the app pick whoever has a salary"] },
  { key: "goals.fundedBy", get: (p) => p.goals, field: "fundedBy", many: true, to: "accounts", what: ["goal", "goals"], page: "goals/goals", fix: "drop", say: ["counts an account that no longer exists", "count an account that no longer exists"], fixLabel: ["Take the missing account off", "Take the missing accounts off"] },
  { key: "debts.account", get: (p) => p.debts, field: "accountId", to: "accounts", required: true, what: ["loan detail", "loan details"], page: "balance/liabilities", fix: "remove", say: ["is left from an account that no longer exists (no page shows it)", "are left from accounts that no longer exist (no page shows them)"], fixLabel: ["Remove the leftover loan detail", "Remove the leftover loan details"] },
  { key: "debtPlan.mortgage", get: (p) => (p.debtPlan && typeof p.debtPlan === "object" ? [p.debtPlan] : []), field: "mortgageAccountId", to: "accounts", what: ["mortgage choice on the Debts page", "mortgage choices on the Debts page"], page: "debt/mortgage", fix: "clear", say: ["points at an account that no longer exists", "point at an account that no longer exists"], fixLabel: ["Forget the missing mortgage", "Forget the missing mortgages"] },
  { key: "debtPlan.order", get: (p) => (p.debtPlan && typeof p.debtPlan === "object" ? [p.debtPlan] : []), field: "customOrder", many: true, to: "accounts", what: ["payoff order", "payoff orders"], page: "debt/payoff", fix: "drop", say: ["lists an account that no longer exists", "list an account that no longer exists"], fixLabel: ["Take the missing account off", "Take the missing accounts off"] },
  { key: "transactions.account", get: (p) => p.transactions, field: "accountId", to: "accounts", what: ["transaction", "transactions"], page: "transactions/ledger", fix: null, say: ["is in an account that no longer exists", "are in an account that no longer exists"] },
  { key: "holdings.account", get: (p) => p.holdings, field: "accountId", to: "accounts", required: true, what: ["investment", "investments"], page: "investments/holdings", fix: "remove", say: ["is left from an account that no longer exists (no page can change it)", "are left from accounts that no longer exist (no page can change them)"], fixLabel: ["Remove the leftover investment", "Remove the leftover investments"] },
  { key: "rules.account", get: (p) => p.rules, field: "accountId", to: "accounts", what: ["sorting rule", "sorting rules"], page: "transactions/rules", fix: "clear", say: ["is for an account that no longer exists", "are for an account that no longer exists"], fixLabel: ["Make it work for every account", "Make them work for every account"] },
  { key: "insurance.person", get: (p) => p.insurance?.policies, field: "personId", to: "people", what: ["insurance policy", "insurance policies"], page: "insurance/policies", fix: "clear", say: ["covers someone no longer on the People page", "cover someone no longer on the People page"], fixLabel: HOUSEHOLD },
  { key: "insurance.account", get: (p) => p.insurance?.policies, field: "accountId", to: "accounts", what: ["insurance policy", "insurance policies"], page: "insurance/policies", fix: "clear", say: ["insures something no longer on Net worth", "insure something no longer on Net worth"], fixLabel: ["Unlink the missing home or car", "Unlink the missing homes or cars"] },
  { key: "estate.person", get: (p) => p.estate?.documents, field: "personId", to: "people", what: ["estate paper (a will, a power of attorney)", "estate papers"], page: "estate/documents", fix: "clear", say: GONE_PERSON, fixLabel: HOUSEHOLD },
  { key: "beneficiaries.account", get: (p) => p.estate?.beneficiaries, field: "accountId", to: "accounts", what: ["beneficiary list", "beneficiary lists"], page: "estate/beneficiaries", fix: "remove", say: ["is left from an account that no longer exists (no page shows it)", "are left from accounts that no longer exist (no page shows them)"], fixLabel: ["Remove the leftover list", "Remove the leftover lists"] },
  { key: "beneficiaries.policy", get: (p) => p.estate?.beneficiaries, field: "policyId", to: "policies", what: ["beneficiary list", "beneficiary lists"], page: "estate/beneficiaries", fix: "remove", say: ["is left from a policy that no longer exists (no page shows it)", "are left from policies that no longer exist (no page shows them)"], fixLabel: ["Remove the leftover list", "Remove the leftover lists"] },
  { key: "events.goal", get: (p) => p.events, field: "goalId", to: "goals", what: ["trip or event", "trips and events"], page: "goals/travel", fix: "clear", say: ["saves toward a goal that no longer exists", "save toward a goal that no longer exists"], fixLabel: ["Unlink the missing goal", "Unlink the missing goals"] },
  { key: "property.account", get: (p) => p.property, field: "accountId", to: "accounts", what: ["property", "properties"], page: (x) => PROPERTY_PAGE[x?.kind] ?? "property/home", fix: "clear", say: ["points at an account that no longer exists", "point at an account that no longer exists"], fixLabel: ["Unlink the missing account", "Unlink the missing accounts"] },
  { key: "property.loan", get: (p) => p.property, field: "loanAccountId", to: "accounts", what: ["property", "properties"], page: (x) => PROPERTY_PAGE[x?.kind] ?? "property/home", fix: "clear", say: ["points at a loan that no longer exists", "point at loans that no longer exist"], fixLabel: ["Unlink the missing loan", "Unlink the missing loans"] },
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
  { key: "debts.rate", get: (p) => p.debts, field: "rate", what: ["loan", "loans"], label: "an interest rate", page: "balance/liabilities" },
  { key: "goals.rate", get: (p) => p.goals, field: "rate", what: ["goal", "goals"], label: "a growth rate", page: "goals/goals" },
];
/** The assumptions kept as fractions, with their plain names. */
export const ASSUMPTION_RATES = { inflation: "inflation", returnStocks: "stock returns", returnBonds: "bond returns", returnCash: "cash returns", salaryGrowth: "pay growth" };
/** Estate papers have no name of their own, only a kind. */
const ESTATE_KINDS = { will: "Will", guardian: "Guardian for the children", poaFinance: "Power of attorney for money", poaHealth: "Power of attorney for health care", livingWill: "Living will", hipaa: "Medical privacy release", trust: "Trust", letter: "Letter of instruction" };

const ids = (plan, to) => new Set((to === "people" ? list(plan.household?.people) : to === "accounts" ? list(plan.accounts) : to === "policies" ? list(plan.insurance?.policies) : list(plan.goals)).map((x) => x?.id));
const pctText = (v) => `${Number((Number(v) * 100).toFixed(1))}%`;
const isPeriod = (v) => typeof v === "string" && Object.hasOwn(PERIODS, v);

/**
 * compute(plan, { today }) -> {
 *   issues: [{ key, level: "bad"|"warn", page, text, count, fix: null|{ label }, names (plain words, never an id) }],
 *   counts: { people, accounts, transactions, income, expenses, goals, debts, holdings },
 *   size: { chars, share (of STORAGE_LIMIT), warn },
 *   schema: { plan, app, newer }
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  // items are named in plain words: their name, the payee or symbol, a rule's text, an estate paper's kind, their
  // account's name, their amount and how often; never their id
  const accountNames = new Map(list(plan.accounts).filter((a) => a && given(a.id) && a.name).map((a) => [a.id, a.name]));
  let money = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
  try { const f = new Intl.NumberFormat("en-US", { style: "currency", currency: plan.meta?.currency || "USD", maximumFractionDigits: 0 }); money = (n) => f.format(n); } catch { /* an unknown currency code: dollars */ }
  const nameOf = (x) => {
    if (!x || typeof x !== "object") return "one without a name";
    const own = x.name || x.payee || x.symbol || (x.contains ? `the rule for "${x.contains}"` : "") || ESTATE_KINDS[x.kind] || accountNames.get(x.accountId) || accountNames.get(x.loanAccountId);
    if (own) return String(own);
    if (isNum(x.amount)) return `one of ${money(Number(x.amount))}${isPeriod(x.period) && x.period !== "once" ? ` ${PERIODS[x.period].label.toLowerCase()}` : ""}`;
    if (isNum(x.rate)) return `one at ${pctText(x.rate)}`;
    if (isNum(x.shares)) return `one of ${Number(x.shares)} shares`;
    if (isDate(x.date)) return `one on ${x.date}`;
    return "one without a name";
  };
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
  // Social Security details (claiming age, earnings record) kept for someone no longer on the People page: no page shows them
  const people0 = ids(plan, "people");
  const ssGone = Object.keys(plan.retirement?.socialSecurity ?? {}).filter((k) => !people0.has(k));
  if (ssGone.length) add({ key: "link:socialSecurity.person", level: "warn", page: "retirement/social-security", count: ssGone.length,
    text: `Social Security details (claiming age, earnings record) are kept for ${ssGone.length === 1 ? "someone" : `${ssGone.length} people`} no longer on the People page; no page shows them`,
    fix: { label: "Remove the leftover details" } });

  // items that share a hidden label (the id pages find, change and remove items by), or have none
  for (const D of ID_LISTS) {
    const items = list(D.get(plan)).filter((x) => x && typeof x === "object");
    const times = new Map();
    for (const x of items) if (given(x.id)) times.set(x.id, (times.get(x.id) ?? 0) + 1);
    const shared = items.filter((x) => given(x.id) && times.get(x.id) > 1), none = items.filter((x) => !given(x.id));
    const n = shared.length + none.length;
    if (!n) continue;
    const verb = n === 1 ? "has" : "have";
    add({ key: `ids:${D.key}`, level: "bad", page: D.page, count: n, names: some([...shared, ...none]),
      text: shared.length && none.length ? `${n} of your ${D.what} have the same hidden label as another, or none, so changing or removing one can change the wrong one`
        : shared.length ? `${n} of your ${D.what} have the same hidden label, so changing or removing one can change the other`
        : `${n} of your ${D.what} ${verb} no hidden label, so the app cannot safely change or remove ${n === 1 ? "it" : "them"}`,
      fix: { label: shared.length ? "Tell them apart" : n === 1 ? "Give it a label" : "Give them labels" } });
  }

  // "how often" missing or unknown (counted as every month), amounts that are not numbers (0) or below 0 (taken off)
  for (const L of PERIOD_LISTS) {
    const items = list(L.get(plan)).filter((x) => x && typeof x === "object");
    const odd = items.filter((x) => given(x.period) && !isPeriod(x.period)), blank = items.filter((x) => !given(x.period));
    if (odd.length) add({ key: `period:${L.key}`, level: "warn", page: L.page, count: odd.length, names: some(odd),
      text: `${plural(odd.length, ...L.what)} ${odd.length === 1 ? "has" : "have"} a "how often" the app does not know ("${odd[0].period}"), so ${odd.length === 1 ? "it is" : "they are"} counted as every month` });
    if (blank.length) add({ key: `period-blank:${L.key}`, level: "warn", page: L.page, count: blank.length, names: some(blank),
      text: `${plural(blank.length, ...L.what)} ${blank.length === 1 ? "has" : "have"} no "how often", so ${blank.length === 1 ? "it is" : "they are"} counted as every month` });
    const notNum = items.filter((x) => !isNum(x.amount));
    if (notNum.length) add({ key: `amount:${L.key}`, level: "bad", page: L.page, count: notNum.length, names: some(notNum),
      text: `${plural(notNum.length, ...L.what)} ${notNum.length === 1 ? "has an amount that is" : "have amounts that are"} not a number, so ${notNum.length === 1 ? "it counts" : "they count"} as 0` });
    const below = items.filter((x) => isNum(x.amount) && Number(x.amount) < 0);
    if (below.length) add({ key: `negative:${L.key}`, level: "bad", page: L.page, count: below.length, names: some(below),
      text: `${plural(below.length, ...L.what)} ${below.length === 1 ? "has an amount" : "have amounts"} below 0, so ${below.length === 1 ? "it is" : "they are"} taken off your totals instead of added` });
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
        text: `${plural(later.length, ...D.what)} ${later.length === 1 ? D.future : D.future.replace(/^is /, "are ")}` });
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
      text: `${plural(high.length, ...R.what)} ${high.length === 1 ? "has" : "have"} ${R.label} over 100% (for example ${pctText(high[0][R.field])}): probably ${Number(high[0][R.field])}% was meant`,
      fix: { label: high.length === 1 ? "Read it as a percentage" : "Read them as percentages" } });
  }
  const a = plan.assumptions ?? {};
  const highA = Object.keys(ASSUMPTION_RATES).filter((k) => isNum(a[k]) && Number(a[k]) > 1);
  if (highA.length) add({ key: "rate:assumptions", level: "bad", page: "system/assumptions", count: highA.length, names: highA.map((k) => ASSUMPTION_RATES[k]).join(", "),
    text: `${plural(highA.length, "assumption")} ${highA.length === 1 ? "is" : "are"} over 100% a year (for example ${ASSUMPTION_RATES[highA[0]]} at ${pctText(a[highA[0]])}): probably ${Number(a[highA[0]])}% was meant`,
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
 * changed. Links: blank the field, take the missing ids out of a list, or remove the leftover item from its list (and
 * leftover Social Security details); labels: the first keeps its own, the others (and items with none) get it with
 * "-2", "-3"... added until it is free (links keep pointing at the first); rates: ÷ 100.
 */
export function applyFix(draft, key) {
  let changed = 0;
  if (key === "link:socialSecurity.person") {
    const ss = draft.retirement?.socialSecurity ?? {}, people = ids(draft, "people");
    for (const k of Object.keys(ss)) if (!people.has(k)) { delete ss[k]; changed++; }
  } else if (key.startsWith("link:")) {
    const L = LINKS.find((x) => `link:${x.key}` === key);
    if (!L?.fix) return 0;
    const targets = ids(draft, L.to);
    const arr = L.get(draft);
    if (L.fix === "remove") {
      if (!Array.isArray(arr)) return 0;
      for (let i = arr.length - 1; i >= 0; i--) {
        const x = arr[i];
        if (!x || typeof x !== "object") continue;
        const v = x[L.field];
        if ((!given(v) && L.required) || (given(v) && !targets.has(v))) { arr.splice(i, 1); changed++; }
      }
      return changed;
    }
    for (const x of list(arr)) {
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
      for (const k of Object.keys(ASSUMPTION_RATES)) if (isNum(a[k]) && Number(a[k]) > 1) { a[k] = Number(a[k]) / 100; changed++; }
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

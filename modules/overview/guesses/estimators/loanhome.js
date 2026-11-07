// modules/overview/guesses/estimators/loanhome.js -- PURE. The home a mortgage is on, for the guesses and the pages that read them
// (self-contained: the guesses import only core/*, their own data and estimators). Debt/mortgage's homeOf is the page's
// older, more lenient rule (first home with a value); this one is stricter so a second loan never takes the main home's year.
const SETUP_LOAN = "setup-owe-mortgage", SETUP_HOME = "setup-have-home";
/**
 * The home THIS loan is on, for the guesses (stricter than homeOf, which falls back to the first home on the plan): the
 * property entry that names the loan (a rental's), else -- only when the loan is Get started's own, or the plan has one
 * mortgage -- the home account (Get started's own first), else null: a second loan with nothing linking it to a home is not
 * worked from the main home's year, value or tax (review 2026-11-07, D2). -> homeOf's answer | null
 */
export function homeOfLoan(plan, loanId) {
  const accounts = Array.isArray(plan?.accounts) ? plan.accounts : [], props = Array.isArray(plan?.property) ? plan.property : [];
  const own = loanId ? props.find((e) => e && e.loanAccountId === loanId && (e.kind === "rental" || e.kind === "home")) : null;
  const byId = (id) => (id ? accounts.find((a) => a?.id === id) ?? null : null);
  if (own) { const a = byId(own.accountId); return { account: a, entry: own, value: a ? Number(a.balance) || 0 : Number(own.value) || 0, rental: own.kind === "rental", name: own.name || a?.name || "the home" }; }
  const mortgages = accounts.filter((a) => a?.type === "mortgage");
  const setup = !loanId || loanId === SETUP_LOAN;
  if (!setup && mortgages.length > 1) return null;
  if (setup) {
    const a = accounts.find((x) => x?.id === SETUP_HOME && Number(x.balance) > 0);
    if (a) return { account: a, entry: homeEntryFor(plan, a.id), value: Number(a.balance) || 0, rental: false, name: a.name };
  }
  // the first Real estate account with a value that is no rental's nor another loan's home
  const claimed = new Set(props.filter((e) => e && (e.kind === "rental" || (e.loanAccountId && e.loanAccountId !== loanId && accounts.some((a) => a?.id === e.loanAccountId)))).map((e) => e.accountId).filter(Boolean));
  const a = accounts.find((x) => x?.type === "property" && Number(x.balance) > 0 && !claimed.has(x.id)) ?? null;
  return a ? { account: a, entry: homeEntryFor(plan, a.id), value: Number(a.balance) || 0, rental: false, name: a.name } : null;
}
/**
 * The Home page's entry for a home account (kind home, accountId): the one with a purchase date when there are two (a plan
 * saved by an earlier build may hold the page's and Get started's), else the first. One helper for every reader and writer
 * of "the year you bought it" (review D5).
 */
export function homeEntryFor(plan, accountId) {
  const list = (Array.isArray(plan?.property) ? plan.property : []).filter((e) => e && (e.kind ?? "home") === "home" && accountId && e.accountId === accountId);
  return list.find((e) => typeof e.purchaseDate === "string" && /^\d{4}/.test(e.purchaseDate)) ?? list[0] ?? null;
}

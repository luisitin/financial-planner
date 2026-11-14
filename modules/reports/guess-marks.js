// modules/reports/guess-marks.js -- PURE. Which figures of a report rest on our guesses (smart guesses C8, spec 15 C8: "reports
// and exports print guesses as facts"). A report's compute asks `marksOf(plan)` and puts the marks it prints in an additive
// `ours` key, only when one applies, so a plan with no guess computes exactly as before; the view (and the printed sheet)
// writes them with report-kit's `marked`: "(our guess)" after a figure that is one, "(partly our guesses)" after a sum with
// one in it, "(our estimate)" after one the plan worked out where nothing was typed (spec 8.4).
import { guessesInUse, parsePath } from "../../core/estimate/index.js";

export const GUESS = "guess", PARTLY = "partly", ESTIMATE = "estimate";
/** The words a mark prints as, in brackets after the figure or its label. */
export const MARK_WORDS = { [GUESS]: "our guess", [PARTLY]: "partly our guesses", [ESTIMATE]: "our estimate" };

const seg = (path) => { try { return parsePath(path); } catch { return []; } };
const isLiab = (a) => ["credit", "loan", "mortgage", "student_loan", "other_liability"].includes(a?.type);

/**
 * marksOf(plan) -> null when no guess is in use (ledger or Get started's older flags), else {
 *   accounts: Set(ids whose balance is ours), assets / liabilities: true when one of them is, income: Set(ids), expenses:
 *   Set(ids), debts: { [debt id]: Set("rate" | "minPayment") }, goals: Set(ids whose amount is ours), retireSpend (the figure
 *   for spending once work stops is ours), socialSecurity: Set(person ids), contributions: Set(ids whose amount is ours),
 *   paths: Set(every path) }
 */
export function marksOf(plan) {
  let inUse = [];
  try { inUse = guessesInUse(plan); } catch { inUse = []; }
  if (!inUse.length) return null;
  const m = { accounts: new Set(), assets: false, liabilities: false, income: new Set(), expenses: new Set(), debts: {}, goals: new Set(), retireSpend: false, socialSecurity: new Set(), contributions: new Set(), paths: new Set() };
  const accountsById = new Map((plan.accounts ?? []).map((a) => [a.id, a]));
  for (const e of inUse) {
    m.paths.add(e.path);
    const s = seg(e.path);
    const head = s[0]?.name, id = s[0]?.id, field = s[s.length - 1]?.name;
    if (head === "accounts" && field === "balance") { m.accounts.add(id); if (isLiab(accountsById.get(id))) m.liabilities = true; else m.assets = true; }
    else if (head === "income" && field === "amount") m.income.add(id);
    else if (head === "expenses" && field === "amount") m.expenses.add(id);
    else if (head === "debts") (m.debts[id] ??= new Set()).add(field);
    else if (head === "goals" && field === "target") m.goals.add(id);
    else if (e.path === "retirement.spendingMonthly") m.retireSpend = true;
    else if (head === "retirement" && s[1]?.name === "socialSecurity") m.socialSecurity.add(s[2]?.name);
    else if (head === "retirement" && s[1]?.name === "contributions" && field === "amount") m.contributions.add(s[1].id);
  }
  return m;
}

/** A sum's mark: every part ours -> GUESS, some -> PARTLY, none -> null. parts: [{ ours: boolean, amount }]. */
export function sumMark(parts) {
  const some = parts.filter((p) => Math.abs(Number(p.amount) || 0) > 0.005);
  const ours = some.filter((p) => p.ours);
  return !ours.length ? null : ours.length === some.length ? GUESS : PARTLY;
}

/** A debt row's three marks (owed, rate, payment) for its account id and debt id. */
export function debtMarks(m, accountId, debtId) {
  if (!m) return {};
  const f = m.debts[debtId] ?? new Set();
  const out = {};
  if (m.accounts.has(accountId)) out.owed = GUESS;
  if (f.has("rate")) out.rate = GUESS;
  if (f.has("minPayment")) out.payment = GUESS;
  return out;
}

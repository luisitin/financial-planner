// modules/property/rental/running.js -- PURE, and a leaf: it imports nothing but Net worth's countedBalance, so the month
// (Income), the retirement plan (Will the money last?) and the Federal estimate can all read it without loading Rental
// analysis's tax pages. What one rental brings in before its loan and tax: the rent less empty months and the costs of
// running it (tax, insurance, dues, upkeep, a manager, utilities, other); which Net worth account holds its value and loan;
// whether Net worth already lists it under its name; and which of the Income page's rent lines are its rent, so each page
// counts the same rent once (round 8 batch 6: "a rental is entered once and counted once").
import { countedBalance } from "../../balance/net-worth/compute.js";

/** Defaults for what is not typed: vacancy 5% of rent, maintenance 1% of the value a year, land 20% of the price (not depreciated), appreciation 3.5%. */
export const DEFAULTS = { vacancy: 0.05, maintenance: 0.01, management: 0, landShare: 0.2, appreciation: 0.035 };

const n = (v, d = 0) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? d : Number(v));
const lc = (v) => String(v ?? "").trim().toLowerCase();

/** The rentals on Rental analysis (`property[]` entries of kind "rental"). */
export const rentalsOf = (plan) => (Array.isArray(plan?.property) ? plan.property : []).filter((x) => x && x.kind === "rental");

/**
 * runningOf(r, value = r.value) -> { rent, vacancy, income, costs: [{ key, label, amount }], opex, noi }, a year: rent x 12,
 * less the empty months (vacancy, default 5%), is `income`; the running costs are property tax + insurance + dues x 12 + upkeep
 * (value x maintenance, default 1%) + a manager (income x management) + utilities x 12 + other x 12 (`opex`); income less
 * them is `noi`, what it brings in after running costs and before the loan and tax (Rental analysis's "Income after running
 * costs"). `value` is what the upkeep share is taken of: the Net worth account's value when the rental names one.
 */
export function runningOf(r, value = r?.value) {
  const v = n(value);
  const rent = n(r?.rentMonthly) * 12;
  const vacancy = rent * n(r?.vacancy, DEFAULTS.vacancy);
  const income = rent - vacancy;
  const costs = [
    { key: "tax", label: "Property tax", amount: n(r?.propertyTax) },
    { key: "insurance", label: "Insurance", amount: n(r?.insurance) },
    { key: "hoa", label: "Association dues", amount: n(r?.hoaMonthly) * 12 },
    { key: "maintenance", label: "Repairs and upkeep", amount: v * n(r?.maintenance, DEFAULTS.maintenance) },
    { key: "management", label: "Property manager", amount: income * n(r?.management, DEFAULTS.management) },
    { key: "utilities", label: "Utilities you pay", amount: n(r?.utilitiesMonthly) * 12 },
    { key: "other", label: "Other costs", amount: n(r?.otherMonthly) * 12 },
  ].filter((c) => c.amount > 0);
  const opex = costs.reduce((s, c) => s + c.amount, 0);
  return { rent, vacancy, income, costs, opex, noi: income - opex };
}

/** The Net worth account a rental names for its value (`accountId`, a Real estate account), when it is still there; else null. */
export function valueAccountOf(plan, r) {
  if (!r?.accountId) return null;
  return (plan?.accounts ?? []).find((a) => a.id === r.accountId) ?? null;
}

/** What a rental is worth: its Net worth account's value when it names one (countedBalance), else the value typed here (as typed). */
export function rentalValue(plan, r) {
  const a = valueAccountOf(plan, r);
  return a ? countedBalance(a) : r?.value;
}

/**
 * twinAccount(plan, r) -> the Real estate account on Net worth that is probably this rental, or null: only for a rental that
 * names no account of its own, an account no property entry names, whose name is the rental's (letter case and spaces
 * aside). Rental analysis and What you own ask "Is it this rental?" with it; nothing links them until that is answered.
 */
export function twinAccount(plan, r) {
  if (!r || valueAccountOf(plan, r)) return null;
  const name = lc(r.name);
  if (!name) return null;
  const taken = new Set((plan?.property ?? []).map((e) => e?.accountId).filter(Boolean));
  const same = (plan?.accounts ?? []).filter((a) => a.type === "property" && !taken.has(a.id) && lc(a.name) === name);
  return same.length === 1 ? same[0] : null;
}

/**
 * livedIn(plan) -> Set of the Net worth accounts that are the home you live in (review 2026-11-06, UX 3: "Its value on Net
 * worth" offered Home, and picking it made the home you live in the rental): Get started's home account (`setup-have-home`),
 * any Real estate account named "Home" (or "My home", "Our home", "The home"), and any account a Your home entry names.
 */
export function livedIn(plan) {
  const ids = new Set();
  for (const a of plan?.accounts ?? []) if (a?.type === "property" && (String(a.id).startsWith("setup-have-home") || /^(my |our |the )?home$/i.test(String(a.name ?? "").trim()))) ids.add(a.id);
  for (const e of plan?.property ?? []) if (e?.kind === "home" && e.accountId) ids.add(e.accountId);
  return ids;
}

/**
 * candidateAccounts(plan, r) -> [{ id, name, value, likely }]: the Real estate accounts on Net worth that could be this rental
 * when it names none (review 2026-11-06, UX 2: one named "Rental condo on Elm" was called "only on this page", and the filled
 * button added the condo a second time): every one no other property entry names that is not the home you live in
 * (livedIn), those whose value is within 10% of the rental's (`likely`) first. Rental analysis asks "Is one of these this
 * rental?" with them; nothing is linked without a tap.
 */
export function candidateAccounts(plan, r) {
  if (!r || valueAccountOf(plan, r)) return [];
  const taken = new Set((plan?.property ?? []).filter((e) => e && e.id !== r.id).map((e) => e.accountId).filter(Boolean));
  const home = livedIn(plan), v = n(r.value);
  return (plan?.accounts ?? []).filter((a) => a?.type === "property" && !taken.has(a.id) && !home.has(a.id))
    .map((a) => { const value = countedBalance(a); return { id: a.id, name: a.name || "Real estate", value, likely: v > 0 && Math.abs(value - v) <= 0.1 * v }; })
    .sort((x, y) => Number(y.likely) - Number(x.likely));
}

/**
 * matchRent(rows, rentals) -> { takes: [[amount for rental i] for each row], removed: [per row], left: [per row] }: which of
 * the Income page's rent lines (`rows`: [{ name, yearly }]) are the rent of the rentals here (`rentals`: [{ name, rent (a
 * year, before empty months) }]). A line is matched to a rental by its name (one holds the other), then by its amount
 * (within 2%), each taking at most what the rental still collects; what the rentals still collect then comes off the other
 * lines in proportion, shared among those rentals by what each still collects. What a line keeps (`left`) is rent for a
 * place that is not on Rental analysis. The Federal estimate's rule (taxes/federal known.js withoutIncomeRent, round 8
 * review), shared so Income and the retirement plan read the same match.
 */
export function matchRent(rows, rentals) {
  const props = rentals.map((r) => ({ name: lc(r.name), rent: Math.max(0, n(r.rent)) }));
  const takes = rows.map(() => props.map(() => 0)), removed = rows.map(() => 0), used = new Set();
  const match = (test) => {
    props.forEach((pr, i) => {
      if (!(pr.rent > 0.005)) return;
      const j = rows.findIndex((x, k) => !used.has(k) && test(x, pr));
      if (j < 0) return;
      used.add(j); removed[j] = takes[j][i] = Math.min(n(rows[j].yearly), pr.rent); pr.rent -= takes[j][i];
    });
  };
  match((x, pr) => pr.name.length > 0 && lc(x.name).length > 0 && (lc(x.name).includes(pr.name) || pr.name.includes(lc(x.name))));
  match((x, pr) => Math.abs(n(x.yearly) - pr.rent) <= Math.max(1, 0.02 * pr.rent));
  const still = props.reduce((t, pr) => t + pr.rent, 0), rest = rows.reduce((t, x, j) => t + (used.has(j) ? 0 : n(x.yearly)), 0);
  if (still > 0.005 && rest > 0) {
    const k = Math.min(1, still / rest);
    rows.forEach((x, j) => { if (!used.has(j)) { removed[j] = n(x.yearly) * k; props.forEach((pr, i) => { takes[j][i] = removed[j] * pr.rent / still; }); } });
  }
  return { takes, removed, left: rows.map((x, j) => Math.max(0, n(x.yearly) - removed[j])) };
}

/**
 * rentAfterCosts(plan, rows) -> [{ removed (the rent of rentals here a line stands for, a year), afterCosts (that rent after
 * those rentals' empty months and running costs, a year), left (the rest of the line, rent for a place not here), names,
 * parts: [{ index, name, take, rent, noi, only }] }]
 * per Income rent line (`rows`: [{ name, yearly }]): each rental's `noi` shared over the lines that hold its rent by the
 * share of its rent each holds. [] entries all 0 with no rental here.
 */
export function rentAfterCosts(plan, rows) {
  const list = rentalsOf(plan);
  if (!list.length || !rows.length) return rows.map((x) => ({ removed: 0, afterCosts: 0, left: n(x.yearly), names: [], parts: [] }));
  const run = list.map((r) => ({ name: r.name || "Rental", ...runningOf(r, rentalValue(plan, r)) }));
  const m = matchRent(rows, run);
  return rows.map((x, j) => ({
    removed: m.removed[j], left: m.left[j],
    afterCosts: m.takes[j].reduce((s, t, i) => s + (run[i].rent > 0 ? t * run[i].noi / run[i].rent : 0), 0),
    names: run.filter((_, i) => m.takes[j][i] > 0.005).map((r) => r.name),
    // each rental this line holds rent of: its index on Rental analysis, the share taken, its rent and figure (a year), and
    // whether this line is the only one holding its rent (review 2026-11-06, money 10)
    parts: run.map((r, i) => ({ index: i, name: r.name, take: m.takes[j][i], rent: r.rent, noi: r.noi, only: m.takes.every((t, k) => k === j || !(t[i] > 0.005)) })).filter((p) => p.take > 0.005),
  }));
}

/**
 * loanPaymentOf(plan, r) -> { monthly, inDebts } | null: what a rental's loan costs a month, as loanOf reads it without the
 * Debts page's worked rows (Income's line, review 2026-11-06, UX 5): the Mortgage account it names, with its payment and extra
 * from Debts, or the payment typed here when Debts has none; else the loan typed here. null with nothing owed or no payment.
 */
export function loanPaymentOf(plan, r) {
  const acct = r?.loanAccountId ? (plan?.accounts ?? []).find((a) => a.id === r.loanAccountId) : null;
  if (acct) {
    if (!(Math.abs(n(acct.balance)) > 0)) return null;
    const d = (plan?.debts ?? []).find((x) => x.accountId === acct.id);
    const has = !!d && n(d.minPayment) > 0, monthly = has ? n(d.minPayment) + n(d.extra) : n(r.loanPayment);
    return monthly > 0 ? { monthly, inDebts: has } : null;
  }
  return n(r?.loanBalance) > 0 && n(r.loanPayment) > 0 ? { monthly: n(r.loanPayment), inDebts: false } : null;
}

/**
 * loanOf(r, rows) -> the rental's loan { name, balance, rate, payment, accountId (the Mortgage account, or null), inDebts (its
 * rate and payment are on the Debts page) } | null. The Mortgage account it names (`loanAccountId`; `rows`: the Debts page's,
 * balance/liabilities compute) with its rate and payment from Debts; when that account has no rate or payment on Debts yet,
 * the rate and payment typed here (round 8 batch 6, landlord-2: linking a mortgage with no Debts details dropped the loan:
 * no interest, no payment). Without a named account: the loan typed here (`loanBalance`, `loanRate`, `loanPayment`).
 */
export function loanOf(r, rows) {
  const row = r?.loanAccountId ? (rows ?? []).find((x) => x.id === r.loanAccountId) : null;
  if (row) {
    const has = !!row.detail && (n(row.detail.minPayment) > 0 || row.paidOff);
    return { name: row.name, balance: row.owed, rate: has ? row.rate ?? 0 : n(r.loanRate), payment: has ? row.payment || 0 : n(r.loanPayment), accountId: row.id, inDebts: has };
  }
  return n(r?.loanBalance) > 0 ? { name: "Loan", balance: n(r.loanBalance), rate: n(r.loanRate), payment: n(r.loanPayment), accountId: null, inDebts: false } : null;
}

/**
 * keepLoanDetails(draft, item) -> true when it wrote: a rental saved with "Its mortgage" set to a Mortgage account that has no
 * rate or payment on Debts gets the rate and payment typed for it here, on a Debts row for that account (round 8 batch 6,
 * landlord-2: the loan was dropped, and Debts said "needs details"). A row with a payment already is left as it is. Changes
 * `draft` in place; `uid` names a new row.
 */
export function keepLoanDetails(draft, item, uid) {
  const id = item?.loanAccountId;
  if (!id || !(draft.accounts ?? []).some((a) => a.id === id)) return false;
  const rate = Number(item.loanRate), pay = Number(item.loanPayment);
  if (!(pay > 0)) return false;
  draft.debts = draft.debts ?? [];
  const row = draft.debts.find((x) => x.accountId === id);
  if (row && Number(row.minPayment) > 0) return false;
  if (row) { row.minPayment = pay; if (!(Number(row.rate) > 0) && Number.isFinite(rate)) row.rate = rate; return true; }
  draft.debts.push({ id: uid(), accountId: id, rate: Number.isFinite(rate) ? rate : 0, minPayment: pay, extra: 0, termMonths: null, startDate: "", securedBy: "", creditLimit: null });
  return true;
}

/**
 * addToNetWorth(draft, rentalId, { today, uid }) -> { accountId, loanAccountId, made: ["value", "loan"] } | null: Rental analysis's
 * "Add it to net worth" (round 8 batch 6, landlord-2: a rental added on its own page never reached net worth). A Real estate
 * account named for the rental at the value typed here, and, when a loan is typed and it names no Mortgage account, a Mortgage
 * account ("<name> mortgage") owing the typed balance with a Debts row of the typed rate and payment; the rental then names
 * both (`accountId`, `loanAccountId`), so its value and loan are on Net worth once and read from there. A value or loan
 * account it already names is kept. Changes `draft` in place.
 */
export function addToNetWorth(draft, rentalId, { today = "", uid } = {}) {
  const r = (draft.property ?? []).find((x) => x.id === rentalId && x.kind === "rental");
  if (!r) return null;
  draft.accounts = draft.accounts ?? [];
  const made = [];
  const has = (id) => !!id && draft.accounts.some((a) => a.id === id);
  const name = String(r.name ?? "").trim() || "Rental";
  if (!has(r.accountId)) {
    const id = uid();
    draft.accounts.push({ id, name, type: "property", institution: "", balance: Number(r.value) || 0, asOf: today, ownerId: "", history: [], notes: "" });
    r.accountId = id; made.push("value");
  }
  if (!has(r.loanAccountId) && Number(r.loanBalance) > 0) {
    const id = uid();
    draft.accounts.push({ id, name: `${name} mortgage`, type: "mortgage", institution: "", balance: Number(r.loanBalance), asOf: today, ownerId: "", history: [], notes: "" });
    r.loanAccountId = id; made.push("loan");
    keepLoanDetails(draft, r, uid);
  }
  return { accountId: r.accountId, loanAccountId: r.loanAccountId ?? null, made };
}

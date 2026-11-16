// modules/balance/net-worth/compute.js -- PURE.
// Account types are defined HERE because this is the module that owns the balance
// sheet; other modules import ACCOUNT_TYPES from this file.
// liquid: cash or sellable within days.  invested: money put away for later (counts in "Invested
// for later"); everyday cash is liquid but not invested.  taxBucket: how growth is taxed.
// label: the kind's name as other pages, the AI pages, the export file and their tests read it (kept as it was).
// plain: the words this page and Emergency fund show for a kind whose label is a hard word (plain-words pass C10,
// 2026-11-13; SPEC 13.1); typeName() gives them, falling back to the label.
import { isGuess } from "../../../core/estimate/index.js";
import { hasLabel } from "./labels.js";
import { isMetal, metalOf } from "./metals.js";
import { isPrivate, privatesOf } from "./private-fund.js";

export const ACCOUNT_TYPES = {
  checking:        { label: "Checking",            side: "asset",     liquid: true,  invested: false, taxBucket: "taxable" },
  savings:         { label: "Savings or money market", side: "asset", liquid: true,  invested: false, taxBucket: "taxable" },
  cash:            { label: "Cash",                side: "asset",     liquid: true,  invested: false, taxBucket: "taxable" },
  brokerage:       { label: "Brokerage (taxable)", plain: "Investments outside retirement", side: "asset", liquid: true, invested: true, taxBucket: "taxable" },
  "401k":          { label: "401(k) / 403(b)",     side: "asset",     liquid: false, invested: true,  taxBucket: "deferred" },
  ira:             { label: "Traditional IRA",     plain: "Traditional IRA (taxed when taken out)", side: "asset", liquid: false, invested: true, taxBucket: "deferred" },
  roth:            { label: "Roth IRA / 401(k)",   plain: "Roth (tax-free later)", side: "asset", liquid: false, invested: true, taxBucket: "free" },
  hsa:             { label: "HSA",                 plain: "Health savings account (HSA)", side: "asset", liquid: false, invested: true, taxBucket: "free" },
  "529":           { label: "529 plan",            plain: "College savings (529)", side: "asset", liquid: false, invested: true, taxBucket: "free" },
  crypto:          { label: "Crypto",              side: "asset",     liquid: true,  invested: true,  taxBucket: "taxable" },
  property:        { label: "Real estate",         plain: "A home or land", side: "asset", liquid: false, invested: false, taxBucket: "none" },
  vehicle:         { label: "Vehicle",             side: "asset",     liquid: false, invested: false, taxBucket: "none" },
  cash_value_life: { label: "Life insurance cash value", plain: "Savings inside a life insurance policy", side: "asset", liquid: false, invested: false, taxBucket: "deferred" },
  other_asset:     { label: "Other asset",         plain: "Something else I own", side: "asset", liquid: false, invested: false, taxBucket: "none" },
  credit:          { label: "Credit card",         side: "liability" },
  loan:            { label: "Personal / auto loan", plain: "Car or personal loan", side: "liability" },
  mortgage:        { label: "Mortgage",            side: "liability" },
  student_loan:    { label: "Student loan",        side: "liability" },
  other_liability: { label: "Other liability",     plain: "Something else I owe", side: "liability" },
};
/** The words a page shows for a kind of account: its plain words, else its label; an unknown kind reads as `fallback` does
 * (something else you own, as compute counts it). typeName("brokerage") -> "Investments outside retirement". */
export const typeName = (type, fallback = "other_asset") => { const t = ACCOUNT_TYPES[type] ?? ACCOUNT_TYPES[fallback] ?? ACCOUNT_TYPES.other_asset; return t.plain ?? t.label; };
export const isLiability = (type) => (ACCOUNT_TYPES[type] ?? ACCOUNT_TYPES.other_asset).side === "liability";
/** The balance as the plan counts it: assets keep their sign (an overdraft is negative), debts are what is owed. */
export const countedBalance = (a) => isLiability(a.type) ? Math.abs(Number(a.balance) || 0) : (Number(a.balance) || 0);

// ---- our guess for a balance left empty, by kind of account (smart guesses C6, spec 12.1; README "Our guess for a balance")
/** The estimator for each kind of account that has a sourced table (modules/overview/guesses). Others have none: no guess. */
export const BALANCE_GUESS = {
  checking: "account.cash", savings: "account.cash", cash: "account.cash", "401k": "account.retire.balance", ira: "account.ira.balance",
  roth: "account.ira.balance", brokerage: "account.invest.balance", property: "home.value", vehicle: "account.car.value",
  credit: "debt.credit.owed", loan: "debt.loan.owed", mortgage: "debt.mortgage.owed", student_loan: "debt.student.owed",
};
/** The kinds a household-wide table stands for as one figure: a second account of the same group would be counted twice (a car is
 * worth what a car is worth, so cars are never grouped). */
const ONE_FIGURE = [["checking", "savings", "cash"], ["401k"], ["ira", "roth"], ["brokerage"], ["property"], ["credit"], ["loan"], ["mortgage"], ["student_loan"]];
/**
 * balanceGuessKey(plan, type, id) -> the estimator key for an account of `type` whose balance box is left empty, or null: a kind
 * with no table; another account of the same group already on file (any, Get started's included: the table is the household's
 * whole figure for it); bank accounts when Get started was told of both checking and savings (it shares one figure between them).
 * `id`: the account being edited (it is not "another").
 */
export function balanceGuessKey(plan, type, id = null) {
  const key = BALANCE_GUESS[type];
  if (!key) return null;
  const group = ONE_FIGURE.find((g) => g.includes(type));
  if (group && (Array.isArray(plan?.accounts) ? plan.accounts : []).some((a) => a?.id !== id && group.includes(a?.type))) return null;
  const have = plan?.guide?.setup?.picks?.have;
  if (key === "account.cash" && Array.isArray(have) && have.includes("checking") && have.includes("savings")) return null;
  return key;
}
/**
 * balanceGuessPath(plan, type, id, ownerId) -> the path the guess is worked out for: the account's own, except a retirement
 * account, which is guessed for its owner (the person chosen under "Whose account", else the first adult), as Get started's are.
 */
export function balanceGuessPath(plan, type, id, ownerId = "") {
  if (!["401k", "ira", "roth"].includes(type)) return `accounts[${id}].balance`;
  // (stored data may hold anything: a list that is not one, a person that is null, an id that is not a word; F6)
  const people = Array.isArray(plan?.household?.people) ? plan.household.people : [];
  const adults = people.filter((p) => p && typeof p === "object" && p.role !== "dependent");
  const pid = ownerId && adults.some((p) => p.id === ownerId) ? ownerId : adults.find((p) => p.role === "self")?.id ?? adults[0]?.id ?? null;
  return typeof pid === "string" && pid && !/[.[\]]/.test(pid) ? `accounts[setup-have-retire-${pid}].balance` : `accounts[${id}].balance`;
}

/**
 * compute(plan) -> {
 *   assets, liabilities, netWorth, liquid, cash (checking + savings + cash), investable (invested types only),
 *   byType: { [type]: total }, bySide: { asset, liability },
 *   byTaxBucket: { taxable, deferred, free, none } (invested money only, so the three buckets add up to investable),
 *   count, history: [{ date, assets, liabilities, netWorth }], change: { sinceLast, sinceLastPct } | null,
 *   guessedAssets?, guessedLiabilities?, partlyGuessed?   (only when a balance is one of our guesses: docs/CONVENTIONS.md
 *   "Guesses"; partlyGuessed when the guessed balances are half or more of what you own, or of what you owe, so the
 *   figure is said as "partly our guesses" and never praised as "a solid base"),
 *   metals?   (only with gold or silver held by weight: metals.js metalOf for each: { id, name, kind, weight, unit, ounces,
 *   price, typed, value, asOf }), privates?, keepReady? (only with a private investment: private-fund.js privateOf for
 *   each, and what they can still ask for in all; never in net worth)
 * }
 * Asset balances keep their sign (an overdrawn checking account is negative and lowers what you own);
 * debts count as positive amounts owed whatever sign was typed.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const accounts = plan.accounts ?? [];
  let assets = 0, liabilities = 0, liquid = 0, investable = 0, cash = 0;
  const byType = {}, byTaxBucket = { taxable: 0, deferred: 0, free: 0, none: 0 };
  // balances that are our guesses (a ledger entry the balance still equals); a plan with no ledger is never looked at
  const led = plan.guesses && typeof plan.guesses === "object" && Object.keys(plan.guesses).length > 0;
  let guessedAssets = 0, guessedLiabilities = 0;
  for (const a of accounts) {
    const t = ACCOUNT_TYPES[a.type] ?? ACCOUNT_TYPES.other_asset;
    const bal = countedBalance(a);
    byType[a.type] = (byType[a.type] ?? 0) + bal;
    const guessed = led && typeof a.id === "string" && isGuess(plan, `accounts[${a.id}].balance`);
    if (t.side === "liability") { liabilities += bal; if (guessed) guessedLiabilities += bal; continue; }
    if (guessed) guessedAssets += bal;
    assets += bal;
    if (t.liquid) liquid += bal;
    if (t.liquid && !t.invested) cash += bal;
    if (t.invested) { investable += bal; byTaxBucket[t.taxBucket] += bal; } else byTaxBucket.none += bal;
  }
  const history = [...(plan.netWorthHistory ?? [])].sort((x, y) => String(x.date).localeCompare(String(y.date)));
  // "since last time" compares with the last saved point before today (today's own point would always say +0)
  const earlier = today ? history.filter((h) => String(h.date) < today) : history;
  const last = earlier[earlier.length - 1];
  const netWorth = assets - liabilities;
  const change = last ? { sinceLast: netWorth - last.netWorth, sinceLastPct: last.netWorth ? (netWorth - last.netWorth) / Math.abs(last.netWorth) : null, since: last.date } : null;
  const guesses = guessedAssets || guessedLiabilities ? {
    guessedAssets, guessedLiabilities,
    partlyGuessed: (assets > 0 && guessedAssets / assets >= 0.5) || (liabilities > 0 && guessedLiabilities / liabilities >= 0.5),
  } : {};
  return { assets, liabilities, netWorth, liquid, cash, investable, byType, bySide: { asset: assets, liability: liabilities }, byTaxBucket, count: accounts.length, history, change, ...guesses, ...specialsOf(plan, today) };
}

/** Gold and silver by weight and the private investments (gap list, next 60, item 45), only when the plan holds one: a plan
 *  without them gives the very output it gave before. Neither moves a total: both are read from the balances above. */
function specialsOf(plan, today) {
  const list = Array.isArray(plan.accounts) ? plan.accounts : [];
  const metals = list.filter(isMetal).map(metalOf);
  const pv = list.some(isPrivate) ? privatesOf(plan, { today }) : null;
  return { ...(metals.length ? { metals } : {}), ...(pv ? { privates: pv.list, keepReady: pv.keepReady } : {}) };
}

/**
 * labelTotals(plan, label) -> { label, count, ids, assets, liabilities, net, hasAssets, hasDebts }: the accounts carrying the
 * person's own label (labels.js hasLabel; gap next-60 #44) and their subtotal, counted as compute() counts each balance
 * (countedBalance: an asset keeps its sign, a debt is what is owed). What the label filter lists and says; never the plan's
 * own totals, which compute() gives unchanged.
 */
export function labelTotals(plan, label) {
  const mine = (Array.isArray(plan?.accounts) ? plan.accounts : []).filter((a) => hasLabel(a, label));
  let assets = 0, liabilities = 0;
  for (const a of mine) { if (isLiability(a.type)) liabilities += countedBalance(a); else assets += countedBalance(a); }
  return { label, count: mine.length, ids: mine.map((a) => a.id), assets, liabilities, net: assets - liabilities, hasAssets: mine.some((a) => !isLiability(a.type)), hasDebts: mine.some((a) => isLiability(a.type)) };
}

// modules/balance/net-worth/compute.js -- PURE.
// Account types are defined HERE because this is the module that owns the balance
// sheet; other modules import ACCOUNT_TYPES from this file.
// liquid: cash or sellable within days.  invested: money put away for later (counts in "Invested
// for later"); everyday cash is liquid but not invested.  taxBucket: how growth is taxed.
export const ACCOUNT_TYPES = {
  checking:        { label: "Checking",            side: "asset",     liquid: true,  invested: false, taxBucket: "taxable" },
  savings:         { label: "Savings or money market", side: "asset", liquid: true,  invested: false, taxBucket: "taxable" },
  cash:            { label: "Cash",                side: "asset",     liquid: true,  invested: false, taxBucket: "taxable" },
  brokerage:       { label: "Brokerage (taxable)", side: "asset",     liquid: true,  invested: true,  taxBucket: "taxable" },
  "401k":          { label: "401(k) / 403(b)",     side: "asset",     liquid: false, invested: true,  taxBucket: "deferred" },
  ira:             { label: "Traditional IRA",     side: "asset",     liquid: false, invested: true,  taxBucket: "deferred" },
  roth:            { label: "Roth IRA / 401(k)",   side: "asset",     liquid: false, invested: true,  taxBucket: "free" },
  hsa:             { label: "HSA",                 side: "asset",     liquid: false, invested: true,  taxBucket: "free" },
  "529":           { label: "529 plan",            side: "asset",     liquid: false, invested: true,  taxBucket: "free" },
  crypto:          { label: "Crypto",              side: "asset",     liquid: true,  invested: true,  taxBucket: "taxable" },
  property:        { label: "Real estate",         side: "asset",     liquid: false, invested: false, taxBucket: "none" },
  vehicle:         { label: "Vehicle",             side: "asset",     liquid: false, invested: false, taxBucket: "none" },
  cash_value_life: { label: "Life insurance cash value", side: "asset", liquid: false, invested: false, taxBucket: "deferred" },
  other_asset:     { label: "Other asset",         side: "asset",     liquid: false, invested: false, taxBucket: "none" },
  credit:          { label: "Credit card",         side: "liability" },
  loan:            { label: "Personal / auto loan", side: "liability" },
  mortgage:        { label: "Mortgage",            side: "liability" },
  student_loan:    { label: "Student loan",        side: "liability" },
  other_liability: { label: "Other liability",     side: "liability" },
};
export const isLiability = (type) => (ACCOUNT_TYPES[type] ?? ACCOUNT_TYPES.other_asset).side === "liability";
/** The balance as the plan counts it: assets keep their sign (an overdraft is negative), debts are what is owed. */
export const countedBalance = (a) => isLiability(a.type) ? Math.abs(Number(a.balance) || 0) : (Number(a.balance) || 0);

/**
 * compute(plan) -> {
 *   assets, liabilities, netWorth, liquid, cash (checking + savings + cash), investable (invested types only),
 *   byType: { [type]: total }, bySide: { asset, liability },
 *   byTaxBucket: { taxable, deferred, free, none } (invested money only, so the three buckets add up to investable),
 *   count, history: [{ date, assets, liabilities, netWorth }], change: { sinceLast, sinceLastPct } | null
 * }
 * Asset balances keep their sign (an overdrawn checking account is negative and lowers what you own);
 * debts count as positive amounts owed whatever sign was typed.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const accounts = plan.accounts ?? [];
  let assets = 0, liabilities = 0, liquid = 0, investable = 0, cash = 0;
  const byType = {}, byTaxBucket = { taxable: 0, deferred: 0, free: 0, none: 0 };
  for (const a of accounts) {
    const t = ACCOUNT_TYPES[a.type] ?? ACCOUNT_TYPES.other_asset;
    const bal = countedBalance(a);
    byType[a.type] = (byType[a.type] ?? 0) + bal;
    if (t.side === "liability") { liabilities += bal; continue; }
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
  return { assets, liabilities, netWorth, liquid, cash, investable, byType, bySide: { asset: assets, liability: liabilities }, byTaxBucket, count: accounts.length, history, change };
}

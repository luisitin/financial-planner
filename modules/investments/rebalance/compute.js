// modules/investments/rebalance/compute.js -- PURE. The trades that bring the mix back to the
// target: first with new money only (buy the most underweight classes, sell nothing), then a
// full rebalance that sells inside tax-advantaged accounts first (no tax there), takes losses
// before gains in taxable accounts, and buys the underweight classes with the cash freed in
// the same account, so nothing has to move between accounts.
import { compute as computeAllocation } from "../allocation/compute.js";
import { ASSET_CLASSES } from "../holdings/compute.js";

const BUCKET_RANK = { deferred: 0, free: 1, taxable: 2, none: 3 };
const round = (n) => Math.round(n);

/** Spread `amount` of new money over the underweight classes, most underweight (in dollars) first, until each reaches target. */
export function allocateNewMoney(rows, amount) {
  let left = Math.max(0, amount);
  const buys = [];
  const under = rows.filter((r) => r.move > 1).sort((a, b) => b.move - a.move);
  for (const r of under) { if (left <= 0) break; const buy = Math.min(r.move, left); buys.push({ cls: r.cls, label: r.label, amount: buy }); left -= buy; }
  // anything left over goes in by target weights
  if (left > 0) { const tw = rows.filter((r) => r.target > 0); const sum = tw.reduce((s, r) => s + r.target, 0) || 1; for (const r of tw) { const b = left * r.target / sum; const ex = buys.find((x) => x.cls === r.cls); if (ex) ex.amount += b; else buys.push({ cls: r.cls, label: r.label, amount: b }); } left = 0; }
  return buys.filter((b) => b.amount >= 1);
}

/**
 * compute(plan, { today }) -> {
 *   ready, needed (any class flagged), rows (allocation rows), newMoney, newMoneyBuys: [{ cls, label, amount }], afterNewMoney: [{ cls, actual }],
 *   trades: [{ kind: "sell"|"buy", account, accountId, bucket, symbol, cls, label, amount, taxNote }], sells, buys, taxableSells (dollars sold in taxable accounts),
 *   gainRealised (estimated gain sold in taxable), leftover: [{ cls, amount }] (buys that no account could host), notes
 * }
 */
export function compute(plan, params = {}) {
  const a = computeAllocation(plan, params);
  if (!a.ready) return { ready: false, needed: false, rows: [], trades: [], newMoneyBuys: [], notes: a.notes };
  const newMoney = Math.max(0, Number(plan.investments?.newMoney) || 0);
  const newMoneyBuys = allocateNewMoney(a.rows, newMoney);
  const totalAfter = a.total + newMoney;
  const afterNewMoney = a.rows.map((r) => ({ cls: r.cls, label: r.label, actual: totalAfter > 0 ? (r.value + (newMoneyBuys.find((b) => b.cls === r.cls)?.amount ?? 0)) / totalAfter : 0, target: r.target }));
  const stillOff = afterNewMoney.filter((r) => Math.abs(r.actual - r.target) > a.band || (r.target > 0 && Math.abs(r.actual - r.target) > 0.25 * r.target));
  // full rebalance: sells by class, taken from holdings in the friendliest order
  const trades = [];
  const cashByAccount = new Map();
  let taxableSells = 0, gainRealised = 0;
  const holdings = a.holdings.items.filter((h) => h.cls !== "unknown");
  for (const r of a.rows.filter((x) => x.move < -1)) {
    let toSell = -r.move;
    const candidates = holdings.filter((h) => (h.mix[r.cls] ?? 0) > 0.5).sort((x, y) => (BUCKET_RANK[x.bucket] - BUCKET_RANK[y.bucket]) || ((x.gainPct ?? 0) - (y.gainPct ?? 0)));
    for (const h of candidates) {
      if (toSell < 1) break;
      const amount = Math.min(toSell, h.value);
      if (amount < 1) continue;
      const gain = h.costBasis > 0 ? amount * (h.gain / h.value) : 0;
      const taxable = h.bucket === "taxable";
      trades.push({ kind: "sell", account: h.accountName, accountId: h.accountId, bucket: h.bucket, symbol: h.symbol, cls: r.cls, label: r.label, amount, taxNote: taxable ? (gain > 0 ? `realises about ${round(gain).toLocaleString("en-US")} of gain` : gain < 0 ? `books a ${round(-gain).toLocaleString("en-US")} loss` : "") : "no tax inside this account" });
      if (taxable) { taxableSells += amount; gainRealised += gain; }
      cashByAccount.set(h.accountId, (cashByAccount.get(h.accountId) ?? 0) + amount);
      toSell -= amount;
    }
  }
  // buys: the underweight classes, from the cash freed in each account (the account with the most cash first)
  const buysNeeded = a.rows.filter((x) => x.move > 1).map((x) => ({ cls: x.cls, label: x.label, amount: x.move }));
  const accountsWithCash = [...cashByAccount.entries()].sort((x, y) => y[1] - x[1]);
  const leftover = [];
  for (const b of buysNeeded) {
    let need = b.amount;
    for (const entry of accountsWithCash) {
      if (need < 1) break;
      const cash = entry[1]; if (cash < 1) continue;
      const amount = Math.min(cash, need);
      const acct = a.holdings.byAccount.find((x) => x.accountId === entry[0]);
      trades.push({ kind: "buy", account: acct?.name ?? "", accountId: entry[0], bucket: acct?.bucket ?? "none", symbol: null, cls: b.cls, label: b.label, amount, taxNote: "" });
      entry[1] -= amount; need -= amount;
    }
    if (need >= 1) leftover.push({ cls: b.cls, label: b.label, amount: need });
  }
  const notes = [...a.notes];
  if (leftover.length) notes.push("Part of the buying could not be placed inside an account where something was sold; use new money for it, or sell in another account.");
  if (gainRealised > 0) notes.push(`The full rebalance sells ${round(taxableSells).toLocaleString("en-US")} in taxable accounts and realises about ${round(gainRealised).toLocaleString("en-US")} of gain; the Capital gains page shows what that costs this year.`);
  return { ready: true, needed: a.flaggedCount > 0, rows: a.rows, band: a.band, total: a.total, newMoney, newMoneyBuys, afterNewMoney, newMoneyEnough: newMoney > 0 && stillOff.length === 0, trades, sells: trades.filter((t) => t.kind === "sell"), buys: trades.filter((t) => t.kind === "buy"), taxableSells, gainRealised, leftover, notes, flaggedCount: a.flaggedCount, worst: a.worst };
}

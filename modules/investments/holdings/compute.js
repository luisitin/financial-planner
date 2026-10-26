// modules/investments/holdings/compute.js -- PURE. What you hold in each investment account:
// each holding valued (shares x price), classified (from a table of common funds, a target-date
// name, or the class the owner picked), with its cost, gain, expense ratio and yield; totals
// by account and by asset class; and the reader for a brokerage "positions" export. Every
// other investments page starts from compute() here so they all agree.
import { FUNDS, TARGET_DATE_PATTERNS } from "./data/funds.js";
import { ACCOUNT_TYPES } from "../../balance/net-worth/compute.js";
import { parseCsv } from "../../../core/csv.js";

export const ASSET_CLASSES = {
  us_stocks:   { label: "US stocks",                      kind: "stocks", icon: "📈" },
  intl_stocks: { label: "International stocks",           kind: "stocks", icon: "🌍" },
  bonds:       { label: "Bonds",                          kind: "bonds",  icon: "📜" },
  cash:        { label: "Cash",                           kind: "cash",   icon: "💵" },
  real_estate: { label: "Real estate (REITs)",            kind: "stocks", icon: "🏢" },
  other:       { label: "Other (gold, commodities, crypto)", kind: "other", icon: "🪙" },
  balanced:    { label: "Balanced or target-date fund",   kind: "mixed",  icon: "⚖️" },
  unknown:     { label: "Not classified yet",             kind: "unknown", icon: "" },
};
export const CLASS_OPTIONS = Object.entries(ASSET_CLASSES).map(([value, c]) => ({ value, label: c.label }));
export const INVESTED_TYPES = Object.keys(ACCOUNT_TYPES).filter((t) => ACCOUNT_TYPES[t].invested);

const num = (v) => { if (v === null || v === undefined) return null; const s = String(v).replace(/[$,%\s]/g, "").replace(/^\((.*)\)$/, "-$1"); if (s === "" || s === "--" || s === "n/a") return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
const cleanSymbol = (s) => String(s ?? "").trim().replace(/\*+$/, "").toUpperCase();

/** The stock/bond split a target-date fund is likely to hold: 90% stocks 25+ years out, gliding to 50% at the target year and 30% seven years past it (the common industry shape). */
export function targetDateMix(targetYear, thisYear) {
  const t = Number(targetYear) - Number(thisYear);
  let stocks;
  if (t >= 25) stocks = 0.9;
  else if (t >= 0) stocks = 0.5 + 0.4 * (t / 25);
  else stocks = Math.max(0.3, 0.5 + (t / 7) * 0.2);
  return { us_stocks: Math.round(stocks * 0.6 * 100) / 100, intl_stocks: Math.round(stocks * 0.4 * 100) / 100, bonds: Math.round((1 - stocks) * 100) / 100 };
}

/** What a symbol (or a fund name) is: { cls, mix, er, yield, name, known, targetYear }. The owner's own class wins when set. */
export function classify(symbol, name = "", thisYear = new Date().getFullYear(), ownClass = "") {
  const sym = cleanSymbol(symbol);
  const f = FUNDS[sym] ?? null;
  const text = `${name ?? ""} ${f?.name ?? ""}`;
  let targetYear = null;
  for (const re of TARGET_DATE_PATTERNS) { const m = re.exec(text); if (m) { targetYear = Number(m[1]); break; } }
  const cls = ownClass && ASSET_CLASSES[ownClass] ? ownClass : targetYear ? "balanced" : f ? f.cls : /cash|money market|sweep|settlement/i.test(text) ? "cash" : "unknown";
  let mix;
  if (cls === "balanced") mix = f?.mix ?? (targetYear ? targetDateMix(targetYear, thisYear) : { us_stocks: 0.36, intl_stocks: 0.24, bonds: 0.40 });
  else if (f?.mix && !ownClass) mix = f.mix;
  else mix = { [cls]: 1 };
  return { cls, mix, er: f?.er ?? null, yield: f?.yield ?? null, name: f?.name ?? (name || sym), known: !!f || !!targetYear, targetYear };
}

/** One holding with everything the pages need (value, class, mix, cost, gain, fees, yield, account). */
export function enrich(h, plan, thisYear) {
  const acct = (plan.accounts ?? []).find((a) => a.id === h.accountId) ?? null;
  const type = ACCOUNT_TYPES[acct?.type] ?? null;
  const info = classify(h.symbol, h.name, thisYear, h.assetClass);
  const shares = Number(h.shares) || 0;
  const price = h.price === null || h.price === undefined || h.price === "" ? null : Number(h.price);
  const costBasis = Number(h.costBasis) || 0;
  const value = price !== null ? shares * price : costBasis;
  const er = h.expenseRatio !== null && h.expenseRatio !== undefined && h.expenseRatio !== "" ? Number(h.expenseRatio) : info.er;
  const yld = h.yield !== null && h.yield !== undefined && h.yield !== "" ? Number(h.yield) : info.yield;
  return {
    ...h, shares, price, costBasis, value, priced: price !== null, symbol: cleanSymbol(h.symbol), name: h.name || info.name, cls: info.cls, clsLabel: ASSET_CLASSES[info.cls].label, mix: info.mix, known: info.known, targetYear: info.targetYear,
    er: er ?? null, yield: yld ?? null, feeYearly: er ? value * er : 0, incomeYearly: yld ? value * yld : 0,
    gain: value - costBasis, gainPct: costBasis > 0 ? (value - costBasis) / costBasis : null,
    accountName: acct?.name ?? "No account", accountType: acct?.type ?? null, bucket: type?.taxBucket ?? "none", lots: Array.isArray(h.lots) ? h.lots : [],
  };
}

/**
 * compute(plan, { today }) -> {
 *   items[] (enrich), total, costTotal, gain, byAccount: [{ accountId, name, type, bucket, value, balance, gap, count }],
 *   byClass: [{ cls, label, value, share }], stockShare, unknown (count), unpriced (count), feeYearly, incomeYearly,
 *   investedAccounts: the plan's invested accounts (for forms), hasData, warnings
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const thisYear = today ? Number(String(today).slice(0, 4)) : new Date().getFullYear();
  const items = (plan.holdings ?? []).map((h) => enrich(h, plan, thisYear));
  const total = items.reduce((s, h) => s + h.value, 0);
  const costTotal = items.reduce((s, h) => s + h.costBasis, 0);
  const investedAccounts = (plan.accounts ?? []).filter((a) => ACCOUNT_TYPES[a.type]?.invested);
  const byAccount = investedAccounts.map((a) => {
    const mine = items.filter((h) => h.accountId === a.id);
    const value = mine.reduce((s, h) => s + h.value, 0);
    const balance = Number(a.balance) || 0;
    return { accountId: a.id, name: a.name, type: a.type, typeLabel: ACCOUNT_TYPES[a.type].label, bucket: ACCOUNT_TYPES[a.type].taxBucket, value, balance, gap: balance - value, count: mine.length };
  });
  const orphans = items.filter((h) => !investedAccounts.some((a) => a.id === h.accountId));
  const classTotals = {};
  for (const h of items) for (const [cls, w] of Object.entries(h.mix)) classTotals[cls] = (classTotals[cls] ?? 0) + h.value * w;
  const byClass = Object.keys(ASSET_CLASSES).filter((c) => c !== "balanced" && (classTotals[c] ?? 0) > 0).map((cls) => ({ cls, label: ASSET_CLASSES[cls].label, icon: ASSET_CLASSES[cls].icon, value: classTotals[cls], share: total > 0 ? classTotals[cls] / total : 0 }));
  const stocksValue = byClass.filter((c) => ASSET_CLASSES[c.cls].kind === "stocks").reduce((s, c) => s + c.value, 0);
  const classified = total - (classTotals.unknown ?? 0);
  const warnings = [];
  const unknown = items.filter((h) => h.cls === "unknown").length;
  const unpriced = items.filter((h) => !h.priced).length;
  if (unknown) warnings.push(`${unknown} holding${unknown === 1 ? "" : "s"} ${unknown === 1 ? "has" : "have"} no asset class yet: tap ${unknown === 1 ? "it" : "each"} and pick one, so Allocation can count ${unknown === 1 ? "it" : "them"}.`);
  if (unpriced) warnings.push(`${unpriced} holding${unpriced === 1 ? " has" : "s have"} no price, so ${unpriced === 1 ? "its" : "their"} cost stands in for ${unpriced === 1 ? "its" : "their"} value.`);
  for (const a of byAccount) if (a.count && Math.abs(a.gap) > Math.max(500, a.balance * 0.02)) warnings.push(`${a.name}: the holdings add up to ${Math.round(a.value).toLocaleString("en-US")} but the account balance on Net worth says ${Math.round(a.balance).toLocaleString("en-US")}.`);
  if (orphans.length) warnings.push(`${orphans.length} holding${orphans.length === 1 ? "" : "s"} point${orphans.length === 1 ? "s" : ""} to an account that is no longer an investment account.`);
  return {
    items, total, costTotal, gain: total - costTotal, byAccount, orphans, byClass, stockShare: total > 0 ? stocksValue / classified || 0 : 0, classifiedShare: total > 0 ? classified / total : 1,
    unknown, unpriced, feeYearly: items.reduce((s, h) => s + h.feeYearly, 0), incomeYearly: items.reduce((s, h) => s + h.incomeYearly, 0),
    investedAccounts, hasData: items.length > 0, warnings, thisYear,
  };
}

/**
 * parsePositions(text) -> { rows: [{ symbol, name, shares, price, value, costBasis, account }], mapping, skipped, warnings }
 * Reads a brokerage "positions" export (Fidelity, Schwab, Vanguard and the like): finds the symbol, name,
 * quantity, price, value, cost and account columns by their names, drops total and pending rows, and
 * treats the sweep/cash line as a cash holding.
 */
export function parsePositions(text) {
  const { headers, rows, skipped } = parseCsv(String(text ?? ""));
  const H = headers.map((h) => h.toLowerCase().trim());
  const find = (...res) => { for (const re of res) { const i = H.findIndex((h) => re.test(h)); if (i >= 0) return i; } return -1; };
  const mapping = {
    symbol: find(/^symbol$/, /^ticker$/, /symbol/),
    name: find(/^description$/, /investment name/, /^security/, /^name$/, /description|name/),
    shares: find(/^quantity$/, /^shares$/, /quantity|shares|units/),
    price: find(/^last price$/, /^price$/, /share price/, /last price|^price\b/),
    value: find(/current value/, /market value/, /total value/, /^value$/, /value/),
    cost: find(/cost basis total/, /^cost basis$/, /total cost/, /cost basis/, /^cost$/),
    account: find(/^account name$/, /^account number$/, /^account$/, /^account/),
  };
  const warnings = [];
  if (mapping.symbol < 0 && mapping.name < 0) return { rows: [], mapping, skipped, warnings: ["No symbol or description column found. Export the positions (holdings) page of the brokerage as CSV and try again."] };
  const cell = (r, i) => i >= 0 ? String(r[i] ?? "").trim() : "";
  const out = [];
  for (const r of rows) {
    const rawSymbol = cell(r, mapping.symbol);
    const symbol = cleanSymbol(rawSymbol);
    const nameCell = cell(r, mapping.name);
    const name = nameCell && nameCell !== "--" ? nameCell : /cash/i.test(rawSymbol) ? rawSymbol : nameCell === "--" ? "" : nameCell;
    const text = `${symbol} ${name}`.toLowerCase();
    if (!symbol && !name) continue;
    if (/^(account total|total|pending activity|grand total|subtotal)/i.test(symbol) || /^(account total|total|pending activity|grand total)/i.test(name)) continue;
    const shares = num(cell(r, mapping.shares)), price = num(cell(r, mapping.price)), value = num(cell(r, mapping.value)), cost = num(cell(r, mapping.cost));
    const isCash = /cash & cash investments|cash and cash|money market|sweep|core position|settlement fund|cash balance/i.test(text) && (shares === null || price === null);
    if (isCash) { if (value) out.push({ symbol: symbol && !/cash/i.test(symbol) ? symbol : "CASH", name: name || "Cash", shares: value, price: 1, value, costBasis: value, account: cell(r, mapping.account), cash: true }); continue; }
    if (shares === null && value === null) continue;
    const qty = shares ?? (value !== null && price ? value / price : null);
    const px = price ?? (qty && value !== null ? value / qty : null);
    out.push({ symbol: symbol || name.slice(0, 12).toUpperCase(), name, shares: qty ?? 0, price: px, value: value ?? (qty !== null && px !== null ? qty * px : null), costBasis: cost, account: cell(r, mapping.account) });
  }
  if (!out.length) warnings.push("No positions found in the file.");
  if (mapping.cost < 0) warnings.push("No cost-basis column: gains will show once you type what you paid.");
  return { rows: out, mapping, skipped, warnings };
}

/** Apply parsed positions to the plan's holdings for one account: matching symbols are updated (shares, price, cost, name), new ones added, missing ones left alone. Returns the new holdings list and counts. */
export function mergePositions(holdings, rows, accountId, { today, uid } = {}) {
  const next = [...(holdings ?? [])];
  let added = 0, updated = 0;
  for (const r of rows) {
    const sym = cleanSymbol(r.symbol);
    const i = next.findIndex((h) => h.accountId === accountId && cleanSymbol(h.symbol) === sym);
    const patch = { symbol: sym, name: r.name || undefined, shares: r.shares, price: r.price, priceAsOf: today ?? null, costBasis: r.costBasis ?? (i >= 0 ? next[i].costBasis : null) };
    if (i >= 0) { next[i] = { ...next[i], ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) }; updated++; }
    else { next.push({ id: uid ? uid() : `h${Date.now().toString(36)}${added}`, accountId, assetClass: r.cash ? "cash" : "", expenseRatio: null, yield: null, lots: [], ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) }); added++; }
  }
  return { holdings: next, added, updated };
}

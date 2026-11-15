// modules/investments/allocation/compute.js -- PURE. Your actual mix by asset class across every
// investment account (from the holdings, with balanced and target-date funds split up) against
// the mix you aim for, how far each class has drifted, and whether the drift crosses the band
// that calls for a rebalance (the 5/25 rule: 5 points absolute, or a quarter of the target).
//
// Gap list, next 60, item 49 (2026-11-15): a holding may carry the person's own split of its stocks by region
// (`regions`: United States, other rich countries, emerging countries) and by kind of business (`sectors`), typed from a
// fund's own page on this page. A region split re-splits that holding's stocks into US and international here (rows,
// the mix per account, the one-tap mixes, and so Rebalance's trades and which fund it sells); a sector split changes no row. `params.splits` adds what the page's row
// "Regions and sectors" reads. Nothing typed and nothing asked: the output is byte for byte what it was.
import { compute as computeHoldings, ASSET_CLASSES, targetDateMix } from "../holdings/compute.js";

// ---------------------------------------------------------------- regions and sectors, typed by the person
/** Where a fund's stocks are: the three regions a fact sheet's map adds up to. */
export const REGIONS = Object.freeze([
  { key: "us", label: "United States", words: "in the United States" },
  { key: "rich", label: "Other rich countries", help: "Europe, Japan, Canada, Australia and the like", words: "in other rich countries" },
  { key: "emerging", label: "Emerging countries", help: "China, India, Brazil and the like", words: "in emerging countries" },
]);
/** What kind of business a fund's stocks are in: five groups of the eleven sectors a fact sheet lists (README). */
export const SECTORS = Object.freeze([
  { key: "tech", label: "Technology and communication", help: "software, chips, phone and internet companies", words: "technology and communication" },
  { key: "health", label: "Health care", help: "drug makers, hospitals, medical devices", words: "health care" },
  { key: "money", label: "Banks and insurance", help: "banks, insurers, investment firms", words: "banks and insurance" },
  { key: "shops", label: "Shops and brands", help: "stores, carmakers, food and household brands", words: "shops and brands" },
  { key: "rest", label: "Everything else", help: "factories, energy, materials, power companies, property", words: "everything else" },
]);
const KINDS = { region: { field: "regions", list: REGIONS }, sector: { field: "sectors", list: SECTORS } };
/** The part of a holding's mix that is stocks with a country: US plus international (REITs and the rest have no region here). */
export const stockPart = (mix) => (Number(mix?.us_stocks) || 0) + (Number(mix?.intl_stocks) || 0);
/** A holding's own split of one kind as fractions adding to 1, or null (absent, or not adding to 100%). */
export function splitOf(h, kind) {
  const k = KINDS[kind], v = h?.[k.field];
  if (!v || typeof v !== "object") return null;
  const parts = k.list.map((x) => (v[x.key] === undefined || v[x.key] === null || v[x.key] === "" ? 0 : Number(v[x.key])));
  if (!parts.every((x) => Number.isFinite(x) && x >= 0)) return null;
  const sum = parts.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 0.005) return null;
  const by = Math.abs(sum - 1) < 1e-9 ? 1 : sum;   // 0.6 + 0.3 + 0.1 is 0.9999999999999999: kept as typed
  return Object.fromEntries(k.list.map((x, i) => [x.key, parts[i] / by]));
}
/** A holding's mix with its own region split: its stocks re-split into US (us) and international (rich + emerging). */
export function regionMix(item) {
  const r = splitOf(item, "region"), part = stockPart(item.mix);
  if (!r || !(part > 0)) return item.mix;
  return { ...item.mix, us_stocks: part * r.us, intl_stocks: part * (r.rich + r.emerging) };
}
/**
 * checkSplit(kind, typed) -> { ok, sum, shares, error }: the shares typed in the form (percent, blank = 0) must come to
 * 100 (within half a point). shares: fractions adding to 1, as saved.
 */
export function checkSplit(kind, typed) {
  const list = KINDS[kind].list;
  const v = list.map((x) => { const n = typed?.[x.key]; return n === null || n === undefined || n === "" ? 0 : Number(n); });
  const sum = v.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
  if (!v.every((x) => Number.isFinite(x))) return { ok: false, sum, shares: null, error: "Type a number in each box, or leave it blank." };
  if (!v.every((x) => x >= 0)) return { ok: false, sum, shares: null, error: "A share cannot be below 0." };
  if (!(sum > 0)) return { ok: false, sum, shares: null, error: "Type a share in at least one box, or tap Cancel." };
  if (Math.abs(sum - 100) > 0.5) return { ok: false, sum, shares: null, error: `These add up to ${Math.round(sum * 10) / 10}%. Make them come to 100%, so all of the fund's stocks are counted.` };
  return { ok: true, sum, shares: Object.fromEntries(list.map((x, i) => [x.key, v[i] / sum])), error: null };
}
/** The class totals as holdings' compute() adds them (the same loop and order), with each item's own mix. */
function classesWith(h, mixOf) {
  const totals = {};
  for (const x of h.items) for (const [cls, w] of Object.entries(mixOf(x))) totals[cls] = (totals[cls] ?? 0) + x.value * w;
  return Object.keys(ASSET_CLASSES).filter((c) => c !== "balanced" && (totals[c] ?? 0) > 0).map((cls) => ({ cls, label: ASSET_CLASSES[cls].label, icon: ASSET_CLASSES[cls].icon, value: totals[cls], share: h.total > 0 ? totals[cls] / h.total : 0 }));
}
/** What the row "Regions and sectors" shows: each holding with stocks, the stocks by region and by kind of business. */
function splitsOf(h) {
  const holdings = h.items.map((x) => {
    const part = stockPart(x.mix), regions = splitOf(x, "region"), sectors = splitOf(x, "sector");
    return { id: x.id, symbol: x.symbol || x.name || "A holding", name: x.name, account: x.accountName, value: x.value, stockValue: x.value * part,
      table: { us: part > 0 ? (Number(x.mix.us_stocks) || 0) / part : 0, intl: part > 0 ? (Number(x.mix.intl_stocks) || 0) / part : 0 }, regions, sectors };
  }).filter((x) => x.stockValue > 0).sort((a, b) => b.stockValue - a.stockValue);
  const stockValue = holdings.reduce((s, x) => s + x.stockValue, 0);
  const add = (o, k, v) => { o[k] = (o[k] ?? 0) + v; };
  const reg = {}, sec = {};
  let split = 0;
  for (const x of holdings) {
    if (x.regions) for (const r of REGIONS) add(reg, r.key, x.stockValue * x.regions[r.key]);
    else { add(reg, "us", x.stockValue * x.table.us); add(reg, "outside", x.stockValue * x.table.intl); }
    if (x.sectors) { split += x.stockValue; for (const r of SECTORS) add(sec, r.key, x.stockValue * x.sectors[r.key]); }
  }
  const rowsOf = (list, o, over) => list.map((r) => ({ key: r.key, label: r.label, value: o[r.key] ?? 0, share: over > 0 ? (o[r.key] ?? 0) / over : 0 }));
  const regionRows = rowsOf([...REGIONS, { key: "outside", label: "Outside the US, not split" }], reg, stockValue).filter((r) => r.value > 0.005);
  return {
    stockValue, holdings, typed: holdings.filter((x) => x.regions || x.sectors).length,
    regions: { rows: regionRows, typed: holdings.filter((x) => x.regions).length, table: holdings.filter((x) => !x.regions && x.table.intl > 0.0005).map((x) => x.symbol) },
    sectors: { rows: rowsOf(SECTORS, sec, split), typed: holdings.filter((x) => x.sectors).length, split, notSplit: stockValue - split, table: holdings.filter((x) => !x.sectors).map((x) => x.symbol) },
  };
}

export const TARGET_CLASSES = ["us_stocks", "intl_stocks", "bonds", "cash", "real_estate", "other"];

/** The plan's target mix as fractions over TARGET_CLASSES: the owner's, or one built from the retirement stock share (60/40 US/international, the rest bonds). */
export function targetMix(plan) {
  const t = plan.investments?.target;
  if (t && typeof t === "object" && Object.values(t).some((v) => Number(v) > 0)) {
    const sum = TARGET_CLASSES.reduce((s, c) => s + (Number(t[c]) || 0), 0) || 1;
    return { mix: Object.fromEntries(TARGET_CLASSES.map((c) => [c, (Number(t[c]) || 0) / sum])), source: "own" };
  }
  const stocks = Math.min(1, Math.max(0, Number(plan.retirement?.stocksNow ?? 0.7)));
  return { mix: { us_stocks: stocks * 0.6, intl_stocks: stocks * 0.4, bonds: 1 - stocks, cash: 0, real_estate: 0, other: 0 }, source: "plan" };
}

/**
 * compute(plan, { today }) -> {
 *   ready, total, rows: [{ cls, label, icon, actual (fraction), target, drift, value, targetValue, move (dollars to reach target), flagged, reason }],
 *   band, flaggedCount, worst (the biggest drift), stockShareActual, stockShareTarget, target (mix), targetSource,
 *   unknownValue (not classified), coverage: { holdingsValue, investedBalance, share }, byAccountClass: [{ account, classes: { cls: value } }], notes,
 *   known (classified holdings as a share of the money invested), verdict: "partial" (under KNOWN_ENOUGH of the money is
 *   classified: no mix to pick, no drift, whatever the target) | "pick" (no target of your own: no drift is called) | "drift" | "ok",
 *   choices: [{ key, label, stocks, mix }], restWords (what is held outside stocks, in words)
 * }
 */
/** Below this share of the invested money classified, no drift verdict is given: the mix would be a guess. */
export const KNOWN_ENOUGH = 0.8;

/** A whole-percent mix over TARGET_CLASSES that adds to 1. */
const tidy = (m) => {
  const r = Object.fromEntries(TARGET_CLASSES.map((c) => [c, Math.round((m[c] ?? 0) * 100)]));
  const sum = TARGET_CLASSES.reduce((t, c) => t + r[c], 0) || 1;
  return Object.fromEntries(TARGET_CLASSES.map((c) => [c, r[c] / sum]));
};

export function compute(plan, params = {}) {
  const h = computeHoldings(plan, params);
  const { mix: target, source } = targetMix(plan);
  const band = Math.min(0.5, Math.max(0.01, Number(plan.investments?.band ?? 0.05)));
  // a region typed on a fund with stocks re-splits them; with none typed, holdings' own sums as they were
  const typed = h.items.some((x) => stockPart(x.mix) > 0 && splitOf(x, "region"));
  const mixOf = typed ? regionMix : (x) => x.mix;
  const byClass = typed ? classesWith(h, mixOf) : h.byClass;
  const classified = byClass.filter((c) => c.cls !== "unknown");
  const total = classified.reduce((s, c) => s + c.value, 0);
  const unknownValue = byClass.find((c) => c.cls === "unknown")?.value ?? 0;
  const rows = TARGET_CLASSES.map((cls) => {
    const value = classified.find((c) => c.cls === cls)?.value ?? 0;
    const actual = total > 0 ? value / total : 0;
    const t = target[cls] ?? 0;
    const drift = actual - t;
    const flagged = t > 0 || actual > 0 ? Math.abs(drift) > band || (t > 0 && Math.abs(drift) > 0.25 * t) : false;
    return { cls, label: ASSET_CLASSES[cls].label, icon: ASSET_CLASSES[cls].icon, actual, target: t, drift, value, targetValue: t * total, move: t * total - value, flagged, reason: flagged ? (Math.abs(drift) > band ? `${Math.round(Math.abs(drift) * 100)} points off` : `more than a quarter off its ${Math.round(t * 100)}%`) : "" };
  }).filter((r) => r.actual > 0 || r.target > 0);
  const stocksOf = (m) => TARGET_CLASSES.filter((c) => ASSET_CLASSES[c].kind === "stocks").reduce((s, c) => s + (m[c] ?? 0), 0);
  const actualMix = Object.fromEntries(rows.map((r) => [r.cls, r.actual]));
  const worst = rows.reduce((a, r) => !a || Math.abs(r.drift) > Math.abs(a.drift) ? r : a, null);
  const investedBalance = h.byAccount.reduce((s, a) => s + a.balance, 0);
  const byAccountClass = h.byAccount.filter((a) => a.count).map((a) => {
    const classes = {};
    for (const x of h.items.filter((i) => i.accountId === a.accountId)) for (const [cls, w] of Object.entries(mixOf(x))) classes[cls] = (classes[cls] ?? 0) + x.value * w;
    return { account: a.name, accountId: a.accountId, bucket: a.bucket, value: a.value, classes };
  });
  // one-tap targets to pick from while none is set: what you hold now, what your target-date fund holds, the plan's share
  const thisYear = Number(String(params.today ?? "").slice(0, 4)) || null;
  const dated = h.items.filter((x) => x.cls === "balanced" && x.targetYear).sort((x, y) => y.value - x.value)[0] ?? null;
  const planStocks = Math.min(1, Math.max(0, Number(plan.retirement?.stocksNow ?? 0.7)));
  // a choice changes only how much is in stocks. The stock part goes to US and international funds in the split you hold
  // (60/40 when you hold neither), REITs keep no more than what you hold; the rest goes to bonds (to bonds and cash in the
  // split you hold when you hold bonds), gold and other keep no more than what you hold. So picking 90% when you hold 92%
  // is not a call to trade between US and international, and "the plan's mix" never becomes 70% REITs or 30% gold.
  const held = (c) => actualMix[c] ?? 0;
  const shaped = (S) => {
    const re = Math.min(held("real_estate"), S), oth = Math.min(held("other"), 1 - S);
    const st = S - re, safe = 1 - S - oth;
    const us = held("us_stocks") + held("intl_stocks") > 0 ? held("us_stocks") / (held("us_stocks") + held("intl_stocks")) : 0.6;
    const b = held("bonds") > 0 ? held("bonds") / (held("bonds") + held("cash")) : 1;
    return { us_stocks: st * us, intl_stocks: st * (1 - us), real_estate: re, bonds: safe * b, cash: safe * (1 - b), other: oth };
  };
  const choices = total > 0 ? [
    { key: "now", label: "What I hold now", mix: tidy(actualMix) },
    dated && thisYear ? { key: "fund", year: dated.targetYear, label: `What a ${dated.targetYear} target-date fund holds`, mix: tidy(shaped(stocksOf(targetDateMix(dated.targetYear, thisYear)))) } : null,
    { key: "plan", label: "The plan's mix", mix: tidy(shaped(planStocks)) },
  ].filter(Boolean).map((c) => ({ ...c, stocks: stocksOf(c.mix) })) : [];
  const known = total > 0 ? total / Math.max(total + unknownValue, investedBalance, total) : 0;
  // a guess of the mix comes first: no mix to pick, no drift, until most of the money is classified
  const verdict = known < KNOWN_ENOUGH ? "partial" : source !== "own" ? "pick" : rows.some((r) => r.flagged) ? "drift" : "ok";
  // what the part outside stocks is, in words: "bonds and cash", "gold and other", "bonds, cash and gold and other"
  const REST_WORDS = { bonds: "bonds", cash: "cash", other: "gold and other" };
  const restParts = Object.keys(REST_WORDS).filter((c) => (actualMix[c] ?? 0) > 0.0005).map((c) => REST_WORDS[c]);
  const restWords = restParts.length ? restParts.length === 1 ? restParts[0] : `${restParts.slice(0, -1).join(", ")} and ${restParts.at(-1)}` : "";
  const notes = [];
  if (unknownValue > 0) notes.push(`$${Math.round(unknownValue).toLocaleString("en-US")} of holdings have no asset class yet and are left out; pick classes on the Holdings page.`);
  if (investedBalance > h.total * 1.05 && h.total > 0) notes.push(`The holdings cover ${Math.round(h.total / investedBalance * 100)}% of the $${Math.round(investedBalance).toLocaleString("en-US")} in your investment accounts (Net worth); the rest is not broken down yet.`);
  const out = {
    ready: h.hasData && total > 0, total, rows, band, flaggedCount: rows.filter((r) => r.flagged).length, worst,
    stockShareActual: stocksOf(actualMix), stockShareTarget: stocksOf(target), target, targetSource: source, unknownValue,
    coverage: { holdingsValue: h.total, investedBalance, share: investedBalance > 0 ? h.total / investedBalance : 1 }, byAccountClass, notes, holdings: h,
    known, verdict, choices, restWords,
  };
  if (params.splits) out.splits = splitsOf(h);
  return out;
}

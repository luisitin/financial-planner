// modules/transactions/transfers/compute.js -- PURE. Money moved between your own accounts
// shows up twice: out of one, into the other. Linked as a transfer, neither side counts as
// income or spending. This finds the likely pairs (same amount, opposite sign, different
// accounts, within a few days) and lists what is already linked.
import { daysBetween } from "../../../core/math/dates.js";

export const WINDOW_DAYS = 4;

/**
 * findPairs(txs, { days }) -> [{ out, in, gap (days), score }] not yet linked; each transaction used at most once.
 * Score: closer dates and payee text mentioning "transfer"/"payment" rank higher.
 */
export function findPairs(txs, { days = WINDOW_DAYS } = {}) {
  const free = (txs ?? []).filter((t) => !t.transferId && t.category !== "transfer" && Number(t.amount));
  const outs = free.filter((t) => Number(t.amount) < 0), ins = free.filter((t) => Number(t.amount) > 0);
  const byAmt = new Map();
  for (const t of ins) { const k = Math.round(Number(t.amount) * 100); (byAmt.get(k) ?? byAmt.set(k, []).get(k)).push(t); }
  const wordy = (t) => /transfer|xfer|payment|pymt|autopay|to |from |deposit|zelle|venmo|ach/i.test(`${t.rawPayee ?? ""} ${t.payee ?? ""}`) ? 1 : 0;
  const cands = [];
  for (const o of outs) {
    for (const i of byAmt.get(Math.round(-Number(o.amount) * 100)) ?? []) {
      if (i.accountId === o.accountId) continue;
      const gap = Math.abs(daysBetween(o.date, i.date) ?? 99);
      if (gap > days) continue;
      cands.push({ out: o, in: i, gap, score: (days - gap) + 3 * (wordy(o) + wordy(i)) });   // a "transfer"/"payment" wording outranks a day or two of distance
    }
  }
  cands.sort((a, b) => b.score - a.score || String(b.out.date).localeCompare(String(a.out.date)));
  const used = new Set(), pairs = [];
  for (const c of cands) { if (used.has(c.out.id) || used.has(c.in.id)) continue; used.add(c.out.id); used.add(c.in.id); pairs.push(c); }
  return pairs;
}

/**
 * compute(plan) -> { pairs (suggested), linked: [{ transferId, out, in }], count (linked), suggested, total }
 */
export function compute(plan) {
  const txs = plan.transactions ?? [];
  const accounts = plan.accounts ?? [];
  const name = (id) => accounts.find((a) => a.id === id)?.name ?? "account";
  const deco = (t) => ({ ...t, accountName: name(t.accountId) });
  const pairs = findPairs(txs).map((p) => ({ ...p, out: deco(p.out), in: deco(p.in) }));
  const groups = new Map();
  for (const t of txs) if (t.transferId) (groups.get(t.transferId) ?? groups.set(t.transferId, []).get(t.transferId)).push(t);
  const linked = [...groups.entries()].map(([transferId, ts]) => ({ transferId, out: deco(ts.find((t) => Number(t.amount) < 0) ?? ts[0]), in: deco(ts.find((t) => Number(t.amount) > 0) ?? ts[1] ?? ts[0]), n: ts.length }))
    .sort((a, b) => String(b.out.date).localeCompare(String(a.out.date)));
  return { pairs, linked, count: linked.length, suggested: pairs.length, total: txs.length };
}

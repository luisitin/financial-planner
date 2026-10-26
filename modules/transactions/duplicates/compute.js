// modules/transactions/duplicates/compute.js -- PURE. Lines that were probably imported
// twice: same account, same amount, dates at most a day apart, and the same (or nearly the
// same) description. Exact repeats are already refused at import by their key; this catches
// the near misses, e.g. a pending line that posted a day later with a slightly different text.
import { normalizePayee } from "../rules/compute.js";
import { daysBetween } from "../../../core/math/dates.js";

const similar = (a, b) => { const x = normalizePayee(a), y = normalizePayee(b); if (!x || !y) return x === y; if (x === y || x.includes(y) || y.includes(x)) return true; const wa = new Set(x.split(" ")), wb = y.split(" "); const common = wb.filter((w) => wa.has(w)).length; return common >= 2 && common / Math.min(wa.size, wb.length) >= 0.6; };

/** findDuplicates(txs) -> [{ keep, drop, why }] each transaction in at most one pair; the earlier import (or lower id) is kept. */
export function findDuplicates(txs) {
  const list = [...(txs ?? [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const used = new Set(), out = [];
  for (let i = 0; i < list.length; i++) {
    const a = list[i]; if (used.has(a.id)) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j]; if (used.has(b.id)) continue;
      const gap = daysBetween(a.date, b.date); if (gap === null || gap > 1) break;
      if (a.accountId !== b.accountId || Math.round(Number(a.amount) * 100) !== Math.round(Number(b.amount) * 100)) continue;
      if (!similar(a.rawPayee ?? a.payee, b.rawPayee ?? b.payee)) continue;
      used.add(a.id); used.add(b.id);
      out.push({ keep: a, drop: b, why: gap === 0 ? "same day, same amount, same description" : "a day apart, same amount, same description" });
      break;
    }
  }
  return out;
}
export function compute(plan) {
  const accounts = plan.accounts ?? [];
  const name = (id) => accounts.find((a) => a.id === id)?.name ?? "account";
  const pairs = findDuplicates(plan.transactions ?? []).map((p) => ({ ...p, accountName: name(p.keep.accountId) }));
  return { pairs, count: pairs.length, total: (plan.transactions ?? []).length };
}

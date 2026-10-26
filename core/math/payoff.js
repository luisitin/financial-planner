// core/math/payoff.js -- paying several debts down month by month. PURE.
// Every debt gets its required payment; the extra (plus every payment freed when a debt is
// gone) goes to one target debt at a time: the highest rate first ("avalanche", least
// interest), the smallest balance first ("snowball", quickest wins), or the owner's order.
// Interest is charged monthly on the opening balance (rate / 12), the usual card and loan
// convention. Balances are positive amounts owed.

export const ORDERS = { avalanche: "Highest interest rate first", snowball: "Smallest balance first", custom: "My own order" };

/**
 * payoffPlan(debts, { extra = 0, order = "avalanche", customOrder = [], maxMonths = 600 }) -> {
 *   months, totalInterest, totalPaid, budget (required payments + extra at the start),
 *   debts: [{ id, name, months, interest, paidOff (month index, 1-based) }],
 *   timeline: [{ month, balances: { [id]: balance }, paid, interest, total }]  (one row per month),
 *   neverPaysOff: [ids whose payment does not cover their interest even with the extra]
 * }
 * debts: [{ id, name, balance, rate (yearly fraction), minPayment }]. Debts with balance 0 are skipped.
 */
export function payoffPlan(debts, { extra = 0, order = "avalanche", customOrder = [], maxMonths = 600 } = {}) {
  const list = (debts ?? []).filter((d) => Number(d.balance) > 0).map((d) => ({ id: d.id, name: d.name ?? d.id, balance: Number(d.balance), rate: Number(d.rate) || 0, minPayment: Math.max(0, Number(d.minPayment) || 0) }));
  const rank = (d) => order === "snowball" ? d.balance : order === "custom" ? (customOrder.indexOf(d.id) >= 0 ? customOrder.indexOf(d.id) : 1e9) : -d.rate;
  const targetOrder = [...list].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)).map((d) => d.id);
  const bal = Object.fromEntries(list.map((d) => [d.id, d.balance]));
  const result = Object.fromEntries(list.map((d) => [d.id, { id: d.id, name: d.name, months: 0, interest: 0, paidOff: null }]));
  const budget = list.reduce((s, d) => s + d.minPayment, 0) + Math.max(0, Number(extra) || 0);
  const timeline = [];
  let totalInterest = 0, totalPaid = 0, month = 0;
  // a debt whose required payment does not cover its interest never ends unless the extra reaches it
  const neverPaysOff = list.filter((d) => d.minPayment <= d.balance * d.rate / 12 && budget <= list.reduce((s, x) => s + x.balance * x.rate / 12, 0)).map((d) => d.id);
  while (month < maxMonths && Object.values(bal).some((b) => b > 0.005)) {
    month++;
    let free = budget, interestThisMonth = 0, paidThisMonth = 0;
    // interest first, then required payments
    for (const d of list) {
      if (bal[d.id] <= 0.005) continue;
      const i = bal[d.id] * d.rate / 12;
      bal[d.id] += i; interestThisMonth += i; result[d.id].interest += i;
      const pay = Math.min(d.minPayment, bal[d.id]);
      bal[d.id] -= pay; free -= pay; paidThisMonth += pay;
    }
    // everything left goes to the target debts in order
    for (const id of targetOrder) {
      if (free <= 0.005) break;
      if (bal[id] <= 0.005) continue;
      const pay = Math.min(free, bal[id]);
      bal[id] -= pay; free -= pay; paidThisMonth += pay;
    }
    for (const d of list) if (bal[d.id] <= 0.005 && result[d.id].paidOff === null) { bal[d.id] = 0; result[d.id].paidOff = month; result[d.id].months = month; }
    totalInterest += interestThisMonth; totalPaid += paidThisMonth;
    timeline.push({ month, balances: Object.fromEntries(list.map((d) => [d.id, Math.round(bal[d.id] * 100) / 100])), paid: Math.round(paidThisMonth * 100) / 100, interest: Math.round(interestThisMonth * 100) / 100, total: Math.round(Object.values(bal).reduce((s, b) => s + b, 0) * 100) / 100 });
  }
  const done = Object.values(bal).every((b) => b <= 0.005);
  return {
    months: done ? month : Infinity, totalInterest: Math.round(totalInterest * 100) / 100, totalPaid: Math.round(totalPaid * 100) / 100, budget,
    debts: targetOrder.map((id) => ({ ...result[id], interest: Math.round(result[id].interest * 100) / 100, months: result[id].paidOff ?? Infinity })),
    timeline, neverPaysOff: done ? [] : list.filter((d) => bal[d.id] > 0.005).map((d) => d.id),
  };
}
/** Months and interest when only the required payment is ever made on one debt (the "minimum payment trap"). */
export function minimumOnly(balance, rate, minPayment, { floor = 25, percentOfBalance = null, maxMonths = 1200 } = {}) {
  let b = Number(balance) || 0, months = 0, interest = 0;
  while (b > 0.005 && months < maxMonths) {
    months++;
    const i = b * (Number(rate) || 0) / 12; b += i; interest += i;
    const pay = Math.min(b, percentOfBalance ? Math.max(floor, b * percentOfBalance) : Math.max(0, Number(minPayment) || 0));
    if (pay <= i && percentOfBalance === null && pay < b) return { months: Infinity, interest: Infinity };
    b -= pay;
  }
  return { months: b > 0.005 ? Infinity : months, interest: Math.round(interest * 100) / 100 };
}

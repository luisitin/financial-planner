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
 * debts: [{ id, name, balance, rate (yearly fraction), minPayment, escrow?, takesExtra? }]. Debts with balance 0 are skipped.
 * escrow (optional, a mortgage's tax and insurance inside its payment): not paid toward the loan, so only minPayment less escrow
 * pays interest and principal, and only that much rolls on to the next debt when the loan is gone.
 * takesExtra (2026-11-01): when any debt has it, the extra goes only to those debts, in the order, and stops once they are all
 * paid off (an extra aimed at the costly debts, as Next best action counts it); freed payments still roll on to the next debt.
 * With no debt marked, nothing changes.
 */
export function payoffPlan(debts, { extra = 0, order = "avalanche", customOrder = [], maxMonths = 600 } = {}) {
  const list = (debts ?? []).filter((d) => Number(d.balance) > 0).map((d) => ({ id: d.id, name: d.name ?? d.id, balance: Number(d.balance), rate: Number(d.rate) || 0, minPayment: Math.max(0, (Number(d.minPayment) || 0) - Math.min(Math.max(0, Number(d.escrow) || 0), Number(d.minPayment) || 0)), takesExtra: d.takesExtra === true }));
  // aimed extra: when some debts are marked takesExtra, the extra goes to them only (in the order) and stops once they are paid off;
  // the payments of finished debts still roll on to the next debt in the order, as always
  const aimed = list.some((d) => d.takesExtra);
  const extraAmount = Math.max(0, Number(extra) || 0), minimums = list.reduce((s, d) => s + d.minPayment, 0);
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
    const aimedLeft = aimed && list.some((d) => d.takesExtra && bal[d.id] > 0.005);
    let free = aimed ? minimums + (aimedLeft ? extraAmount : 0) : budget, interestThisMonth = 0, paidThisMonth = 0;
    // interest first, then required payments
    for (const d of list) {
      if (bal[d.id] <= 0.005) continue;
      const i = bal[d.id] * d.rate / 12;
      bal[d.id] += i; interestThisMonth += i; result[d.id].interest += i;
      const pay = Math.min(d.minPayment, bal[d.id]);
      bal[d.id] -= pay; free -= pay; paidThisMonth += pay;
    }
    // an aimed extra goes to its own debts first
    if (aimedLeft) {
      let ex = Math.min(extraAmount, free);
      for (const d of targetOrder.map((id) => list.find((x) => x.id === id))) {
        if (ex <= 0.005) break;
        if (!d.takesExtra || bal[d.id] <= 0.005) continue;
        const pay = Math.min(ex, bal[d.id]);
        bal[d.id] -= pay; ex -= pay; free -= pay; paidThisMonth += pay;
      }
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
/**
 * Months and interest when only the required payment is ever made on one debt (the "minimum payment trap"). A
 * percentage minimum is worked from the month's opening (statement) balance, before that month's interest, and again
 * every month (Regulation Z, 12 CFR 1026 Appendix M1 (b)(1) and (b)(3), and the loop in Appendix M2). A payment at or
 * below the month's interest never pays the debt off (1026.7(b)(12)(ii)); `maxMonths` only stops a runaway loop.
 * `interestPlus` (round 8, 2026-11-06): the bank's own kind of minimum, worked again every month: that share of the
 * month's opening balance plus the month's interest, at least `floor`, never more than is owed (CFPB, The Consumer
 * Credit Card Market, December 2025, section 4.1.1: "Most issuers set minimum payment at 1 percent of the balance";
 * "Issuers typically add the sum of finance charges, fees, and past due amounts"). It always pays something off, so it
 * always ends.
 */
export function minimumOnly(balance, rate, minPayment, { floor = 25, percentOfBalance = null, interestPlus = null, maxMonths = 6000 } = {}) {
  let b = Number(balance) || 0, months = 0, interest = 0;
  while (b > 0.005 && months < maxMonths) {
    months++;
    const open = b;
    const i = open * (Number(rate) || 0) / 12; b += i; interest += i;
    const pay = Math.min(b, interestPlus ? Math.max(floor, i + open * interestPlus) : percentOfBalance ? Math.max(floor, open * percentOfBalance) : Math.max(0, Number(minPayment) || 0));
    if (pay <= i && pay < b) return { months: Infinity, interest: Infinity };
    b -= pay;
  }
  return { months: b > 0.005 ? Infinity : months, interest: Math.round(interest * 100) / 100 };
}

/** Most card issuers' minimum: 1% of the balance plus the month's interest (CFPB, The Consumer Credit Card Market, Dec 2025, 4.1.1). */
export const ISSUER_SHARE = 0.01;
/**
 * The dollar floor under it, which no statement figure reveals: $25 (the most common floor in 2015) to $40 (the most
 * common in the 2025 review of card agreements, "a $15 increase since 2015"; floors ran from $15 to $50). Same report, 4.1.1.
 */
export const ISSUER_FLOORS = { low: 25, high: 40 };

/**
 * issuerShare(balance, rate, typedMin) -> { share, fromTyped }: the share of the balance the bank's minimum takes on top of
 * the month's interest, read from the minimum typed for the card: (minimum - balance x rate / 12) / balance, rounded to
 * the nearest quarter point (bank formulas use round shares, and a typed minimum is usually rounded to the dollar). Used
 * when it is 0.5% to 2%; otherwise (nothing typed, a minimum at or below the interest, or one that is mostly the floor)
 * the usual 1%, and `fromTyped` false.
 */
export function issuerShare(balance, rate, typedMin) {
  const b = Number(balance) || 0, m = Number(typedMin) || 0;
  if (b > 0 && m > 0) {
    const p = Math.round(((m - b * (Number(rate) || 0) / 12) / b) * 400) / 400;
    if (p >= 0.005 - 1e-12 && p <= 0.02 + 1e-12) return { share: p, fromTyped: true };
  }
  return { share: ISSUER_SHARE, fromTyped: false };
}

/** The floors the CFPB found in card agreements: "floors varied from $15 to $50" (same report, 4.1.1). A typed minimum in
 * this range that is more than interest + 2% of the balance is that card's floor (bankMinimum's "floor"). */
export const ISSUER_FLOOR_RANGE = { low: 15, high: 50 };

/**
 * bankMinimum(balance, rate, typedMin) -> { kind, share, fromTyped, first, quick, slow, floors } | null: paying only what the
 * bank asks each month, as it shrinks with the balance (round 8, 2026-11-06: the Credit cards page held the typed $150 level
 * and said 4 years 7 months, where the bank's own minimum takes 16 to 19 years). `quick` is with the higher floor ($40: the
 * last small payments are bigger, so it ends sooner), `slow` with the lower ($25); each { months, interest } from
 * minimumOnly's `interestPlus`. `first` = this month's payment at the higher floor. null with nothing owed.
 * `kind` says what the typed minimum told us (round 8 review, 2026-11-06: a floor or the full balance read as "no minimum
 * typed", and gave a 21-year cost for a card paid in full):
 *   "typed"   interest + a share of 0.5% to 2% (issuerShare): that share, floors $25 / $40, each at most the typed amount
 *             (it is this month's figure, so the card's floor is no more than it; verify 2026-11-06);
 *   "floor"   more than interest + 2%, and $15 to $50 (ISSUER_FLOOR_RANGE; or less): the card's own floor, so the bank asks
 *             max(that amount, interest + 1%) each month, the typed amount until the balance is under it. One figure:
 *             quick = slow, floors { low, high } = the typed amount;
 *   "full"    the whole balance (a charge card, or one paid in full each month): nothing is carried, so no interest while it is
 *             paid in full (a card's grace period); quick = slow = { months: 1, interest: 0 };
 *   "below-interest"  at or under the month's interest, which no bank asks; "unmatched"  any other amount; "assumed"  nothing
 *             typed: in these three, most banks' minimum (1%, floors $25 / $40) and `fromTyped` false.
 */
export function bankMinimum(balance, rate, typedMin = 0) {
  const b = Number(balance) || 0, r = Number(rate) || 0, m = Math.max(0, Number(typedMin) || 0);
  if (!(b > 0)) return null;
  if (m > 0 && m >= b - 0.005) return { kind: "full", share: null, fromTyped: true, first: Math.round(b * 100) / 100, quick: { months: 1, interest: 0 }, slow: { months: 1, interest: 0 }, floors: { low: b, high: b } };
  const interest = b * r / 12;
  const { share, fromTyped } = issuerShare(b, r, m);
  if (!fromTyped && m > interest && (m - interest) / b > 0.02 && m <= ISSUER_FLOOR_RANGE.high) {
    const run = minimumOnly(b, r, 0, { interestPlus: ISSUER_SHARE, floor: m });
    return { kind: "floor", share: ISSUER_SHARE, fromTyped: true, first: m, quick: run, slow: run, floors: { low: m, high: m } };
  }
  const kind = fromTyped ? "typed" : m <= 0 ? "assumed" : m <= interest + 1e-9 ? "below-interest" : "unmatched";
  // a typed minimum under the usual floors is this month's figure, so the card's floor is at most that amount (verify,
  // 2026-11-06: $30 typed on $900 at 26.9% read "about 3 to 6 years": the $40 end, 32 months, sooner than keeping $30 level, 51)
  const floors = kind === "typed" ? { low: Math.min(ISSUER_FLOORS.low, m), high: Math.min(ISSUER_FLOORS.high, m) } : { ...ISSUER_FLOORS };
  const quick = minimumOnly(b, r, 0, { interestPlus: share, floor: floors.high });
  const slow = minimumOnly(b, r, 0, { interestPlus: share, floor: floors.low });
  const first = Math.round(Math.min(b * (1 + r / 12), Math.max(floors.high, interest + b * share)) * 100) / 100;
  return { kind, share, fromTyped, first, quick, slow, floors };
}

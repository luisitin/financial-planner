// modules/debt/refinance/compute.js -- PURE. The mortgage you have against the one you could
// get: new payment, monthly saving, how many months until the closing costs are paid back,
// and the total interest either way over the years you expect to stay. Inputs live in
// plan.debtPlan.refinance = { rate, termYears, closingCosts, yearsStaying }.
import { pmt, nper, amortization, round2 } from "../../../core/math/finance.js";
import { compute as computeMortgage } from "../mortgage/compute.js";

/**
 * compute(plan, { today, rate, termYears, closingCosts, yearsStaying }) -> {
 *   current: { balance, rate, payment, toLoan, escrow, months, totalInterest }, offer: { rate, termYears, closingCosts, payment, toLoan,
 *   months, totalInterest } (payment: the whole a month, the tax and insurance in today's kept on the offer; toLoan: the part that pays the loan),
 *   monthlySaving, breakEvenMonths, yearsStaying, interestWhileStaying: { current, offer }, netWhileStaying (saved minus costs),
 *   verdict: "worth it" | "close call" | "not worth it" | null, hasData, missing,
 *   costsMissing?: true (only when the closing-cost box is blank: the sums run with no costs, breakEvenMonths is null and the
 *   verdict null unless it is "not worth it" even with no costs; netWhileStaying is then the interest saved, the most the
 *   costs can be for the offer to pay for itself)
 * }
 */
/** A closing-cost box left blank (absent, null, "" or not a number): not typed yet, which is not $0. */
export const blankCost = (x) => x === null || x === undefined || x === "" || !Number.isFinite(Number(x));

export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const m = computeMortgage(plan, { today });
  const rf = plan.debtPlan?.refinance ?? {};
  const rate = Number(params.rate ?? rf.rate ?? NaN);
  const termYears = Math.max(1, Number(params.termYears ?? rf.termYears ?? 30));
  // a blank box is not $0 (fix round r2): the sums run with no costs, so every figure stays, but the page says what is missing
  // and does not count the costs as paid back; a typed 0 still means no costs
  const typedCosts = params.closingCosts ?? rf.closingCosts;
  const costsMissing = blankCost(typedCosts);
  const closingCosts = costsMissing ? 0 : Math.max(0, Number(typedCosts));
  const yearsStaying = Math.max(1, Number(params.yearsStaying ?? rf.yearsStaying ?? 7));
  if (!m.hasData) return { hasData: false, missing: m.mortgage ? "rate or payment" : "mortgage", mortgageId: m.mortgage?.id ?? null, current: null, offer: null };
  const balance = m.mortgage.balance;
  // the tax and insurance inside the payment (debt/mortgage's escrow, while the balance or payment is our guess) stay on the new
  // loan's payment too: the two payments are compared whole, and only the loan part pays interest and principal (verify 2026-11-07:
  // a guessed $1,900 with $384 of tax and insurance was set against the offer's bare $1,379, "$521 less than now")
  const escrow = Math.max(0, Number(m.mortgage.escrow) || 0), toLoan = m.mortgage.toLoan ?? m.mortgage.payment;
  const current = { balance, rate: m.mortgage.rate, payment: m.mortgage.payment, toLoan, escrow, months: m.base.months, totalInterest: m.base.totalInterest };
  if (!Number.isFinite(rate)) return { hasData: true, needsOffer: true, current, offer: null, termYears, closingCosts, yearsStaying };
  const n = Math.round(termYears * 12), r = rate / 12;
  const pi = Math.round(pmt(r, n, balance) * 100) / 100, payment = Math.round((pi + escrow) * 100) / 100;
  const offerInterest = amortization({ principal: balance, annualRate: rate, years: termYears, payment: pi }).totalInterest;
  const offer = { rate, termYears, closingCosts, payment, toLoan: pi, months: n, totalInterest: offerInterest };
  const monthlySaving = Math.round((current.payment - payment) * 100) / 100;
  const breakEvenMonths = monthlySaving > 0 && !costsMissing ? Math.ceil(closingCosts / monthlySaving) : null;
  // interest paid over the years you expect to stay, both ways
  const stayMonths = Math.min(Math.round(yearsStaying * 12), 600);
  const interestOver = (principal, annualRate, pay, months) => { let b = principal, total = 0; const rr = annualRate / 12; for (let i = 0; i < months && b > 0.005; i++) { const it = b * rr; total += it; b = Math.max(0, b + it - pay); } return Math.round(total * 100) / 100; };
  const interestWhileStaying = { current: interestOver(balance, current.rate, toLoan, stayMonths), offer: interestOver(balance, rate, pi, stayMonths) };
  const netWhileStaying = Math.round((interestWhileStaying.current - interestWhileStaying.offer - closingCosts) * 100) / 100;
  // with the costs blank only "not worth it" is known (any cost makes it worse); otherwise the costs decide (null)
  const verdict = costsMissing ? (netWhileStaying > 0 ? null : "not worth it")
    : netWhileStaying > closingCosts * 0.5 && netWhileStaying > 500 ? "worth it" : netWhileStaying > 0 ? "close call" : "not worth it";
  return { hasData: true, needsOffer: false, current, offer, monthlySaving, breakEvenMonths, yearsStaying, interestWhileStaying, netWhileStaying, verdict, extraYears: Number.isFinite(current.months) ? Math.round((n - current.months) / 12 * 10) / 10 : null, ...(costsMissing ? { costsMissing: true } : {}) };
}

// ---------------------------------------------------------------- two offers side by side (gap list, next 60, item 1)
// Points, a lender credit, the costs paid at closing or added to the loan, against keeping today's loan, over the years
// the person expects to keep it. Read only by the part "Compare two offers"; compute() above does not call it, so a plan
// without `debtPlan.refinance.offers` gives compute() exactly what it gave before. Every formula is in the README.

/** The years-kept chips: 5, 7, 10 years or until the loans are paid off. */
export const KEEP_CHIPS = Object.freeze([5, 7, 10, "payoff"]);
/** The length chips of an offer, in years. */
export const TERM_CHIPS = Object.freeze([15, 20, 30]);
/** The points chips (each point is 1% of the new loan). */
export const POINT_CHIPS = Object.freeze([0, 1, 2]);
/** Two totals within this many dollars of each other are "about the same" (builder's line, README). */
export const TIE = 100;
/** The longest run the comparison looks at, in months (50 years), as compute() caps the stay. */
export const MAX_MONTHS = 600;

const clampNum = (x, lo, hi, dflt) => { const n = Number(x); return x === null || x === undefined || x === "" || !Number.isFinite(n) ? dflt : Math.min(hi, Math.max(lo, n)); };

/** One offer as stored ({ rate, termYears, points, credit, costs, rollIn }), each piece read with its default; costsMissing: true
 * when its other closing costs are blank (null or absent: not typed yet; a typed 0 is no costs). */
export function offerInputs(o) {
  const r = o?.rate === null || o?.rate === undefined || o?.rate === "" ? NaN : Number(o.rate);
  const ready = Number.isFinite(r) && r >= 0 && r <= 0.3;
  return {
    ready, rate: ready ? r : null,
    termYears: Math.round(clampNum(o?.termYears, 1, 40, 30)),
    points: clampNum(o?.points, 0, 5, 0),
    credit: clampNum(o?.credit, 0, 1e9, 0),
    costs: clampNum(o?.costs, 0, 1e9, 0),
    rollIn: o?.rollIn === true,
    // the other closing costs left blank (fix round r2): counted as nothing, and said
    ...(blankCost(o?.costs) ? { costsMissing: true } : {}),
  };
}

/** The years kept: a whole number of years (1 to 40) or "payoff"; absent, the single offer's yearsStaying, else 7. */
export function keepOf(keep, rf = {}) {
  if (keep === "payoff") return "payoff";
  if (keep !== null && keep !== undefined && keep !== "" && Number.isFinite(Number(keep))) return Math.round(clampNum(keep, 1, 40, 7));
  return Math.round(clampNum(rf?.yearsStaying, 1, 40, 7));
}

/**
 * Interest month by month on a loan paid `payment` a month, as compute()'s own loop: i = b x rate / 12,
 * b = max(0, b + i - payment), until it is paid off.
 * -> { cum: [I(0) = 0, I(1), ... I(months)], bal: [b(0) = principal, b(1), ... b(months)] (still owed), paidOff: month | null }
 */
export function interestRun(principal, annualRate, payment, months) {
  const cum = new Array(months + 1), bal = new Array(months + 1); cum[0] = 0; bal[0] = principal;
  const r = annualRate / 12;
  let b = principal, total = 0, paidOff = principal <= 0.005 ? 0 : null;
  for (let i = 1; i <= months; i++) {
    if (b > 0.005) { const it = b * r; total += it; b = Math.max(0, b + it - payment); if (b <= 0.005) paidOff = i; }
    cum[i] = total; bal[i] = b <= 0.005 ? 0 : b;
  }
  return { cum, bal, paidOff: b <= 0.005 ? paidOff : null };
}

/**
 * What one offer costs: the new loan, the points, the cash at closing, the payment. B is today's balance.
 *   points: each point is 1% of the new loan. Paid at closing they are on B; added to the loan they are on the bigger
 *   loan itself, L = (B + costs - credit) / (1 - points%). A credit above the fees is not paid out: creditLeft is the
 *   part of it that is not counted (the page says so).
 */
export function offerCosts(B, o) {
  const p = o.points / 100;
  if (o.rollIn) {
    const L = (B + o.costs - o.credit) / (1 - p);
    if (L > B + 0.005) {
      const loan = round2(L), pointsCost = round2(p * L), fees = round2(pointsCost + o.costs);
      return { loan, pointsCost, fees, creditUsed: round2(o.credit), creditLeft: 0, net: round2(L - B), cashAtClosing: 0, rolled: round2(L - B) };
    }
  }
  const pointsCost = round2(p * B), fees = round2(pointsCost + o.costs), creditUsed = round2(Math.min(o.credit, fees)), net = round2(fees - creditUsed);
  return { loan: B, pointsCost, fees, creditUsed, creditLeft: round2(Math.max(0, o.credit - creditUsed)), net, cashAtClosing: o.rollIn ? 0 : net, rolled: 0 };
}

/**
 * twoOffers(plan, { today, offers, keep }) -> {
 *   hasData, missing?, mortgageId?, current: { balance, rate, payment, toLoan, escrow, months },
 *   keep (years | "payoff"), months (the horizon H), longest (the longest of the three loans, at most 600 months),
 *   keeping: { cost, owed } (today's loan: the interest over H, and what is still owed at H),
 *   offers: [{ n, ready, rate, termYears, points, credit, costs, rollIn, loan, pointsCost, fees, creditUsed, creditLeft,
 *     net, cashAtClosing, rolled, toLoan, payment, saving, breakEven (month | 0 with noCosts | null: never), noCosts,
 *     cost (net + interest over H), owed (still owed at H: paid when the person moves or sells, counted in cost's
 *     identity, shown so a longer loan's lower payment is seen with the bigger balance it leaves),
 *     vsKeeping (keeping's cost less this one's: above 0 it saves) }],
 *   ready (offers with a rate), cheaper (1 | 2 | null), diff (cost of offer 1 less offer 2 over H), tie,
 *   otherWins: { within: the last month before H where the other offer costs at least $1 less | null,
 *                from: the first month after H where it does | null },
 *   case: "none" | "one" | "keep" | "tie" | "two"
 * }
 * offers and keep come from params, else plan.debtPlan.refinance.offers / .keep. Pure.
 */
export function twoOffers(plan, params = {}) {
  const m = computeMortgage(plan, { today: params.today ?? null });
  const rf = plan.debtPlan?.refinance ?? {};
  const keep = keepOf(params.keep !== undefined ? params.keep : rf.keep, rf);
  if (!m.hasData) return { hasData: false, missing: m.mortgage ? "rate or payment" : "mortgage", mortgageId: m.mortgage?.id ?? null, keep, offers: [], ready: 0, case: "none" };
  const B = m.mortgage.balance, escrow = Math.max(0, Number(m.mortgage.escrow) || 0), P0 = m.mortgage.toLoan ?? m.mortgage.payment;
  const current = { balance: B, rate: m.mortgage.rate, payment: m.mortgage.payment, toLoan: P0, escrow, months: m.base.months };
  const given = Array.isArray(params.offers) ? params.offers : Array.isArray(rf.offers) ? rf.offers : [];
  const inputs = [0, 1].map((i) => offerInputs(given[i]));
  const kept = interestRun(B, current.rate, P0, MAX_MONTHS);
  const runs = inputs.map((o) => {
    if (!o.ready) return null;
    const c = offerCosts(B, o), n = o.termYears * 12;
    const toLoan = round2(pmt(o.rate / 12, n, c.loan));
    return { c, toLoan, run: interestRun(c.loan, o.rate, toLoan, MAX_MONTHS), n };
  });
  const longest = Math.min(MAX_MONTHS, Math.max(kept.paidOff ?? MAX_MONTHS, ...runs.filter(Boolean).map((x) => x.run.paidOff ?? MAX_MONTHS)));
  const H = keep === "payoff" ? longest : Math.min(MAX_MONTHS, keep * 12);
  const keepCost = (k) => kept.cum[k];
  const costAt = (x, k) => x.c.net + x.run.cum[k];
  const offers = inputs.map((o, i) => {
    const x = runs[i];
    if (!x) return { n: i + 1, ...o };
    const payment = round2(x.toLoan + escrow);
    const noCosts = x.c.net < 0.005;
    let breakEven = noCosts ? 0 : null;
    if (!noCosts) for (let k = 1; k <= longest; k++) if (keepCost(k) - x.run.cum[k] - x.c.net >= -1e-9) { breakEven = k; break; }
    const cost = round2(costAt(x, H));
    return { n: i + 1, ...o, ...x.c, toLoan: x.toLoan, payment, saving: round2(current.payment - payment), breakEven, noCosts, cost, owed: round2(x.run.bal[H]), vsKeeping: round2(keepCost(H) - costAt(x, H)) };
  });
  const ready = offers.filter((o) => o.ready).length;
  const out = { hasData: true, current, keep, months: H, longest, keeping: { cost: round2(keepCost(H)), owed: round2(kept.bal[H]) }, offers, ready, cheaper: null, diff: null, tie: false, otherWins: { within: null, from: null } };
  if (ready === 0) return { ...out, case: "none" };
  if (ready === 1) return { ...out, case: "one" };
  const diffAt = (k) => costAt(runs[0], k) - costAt(runs[1], k);
  const diff = round2(diffAt(H)), tie = Math.abs(diff) < TIE, cheaper = tie ? null : diff < 0 ? 1 : 2;
  const otherWins = { within: null, from: null };
  if (cheaper) {
    const otherLess = (k) => (cheaper === 1 ? diffAt(k) >= 1 : diffAt(k) <= -1);
    for (let k = H - 1; k >= 1; k--) if (otherLess(k)) { otherWins.within = k; break; }
    for (let k = H + 1; k <= longest; k++) if (otherLess(k)) { otherWins.from = k; break; }
  }
  const worse = Math.max(offers[0].vsKeeping, offers[1].vsKeeping) < 0;
  return { ...out, cheaper, diff, tie, otherWins, case: worse ? "keep" : tie ? "tie" : "two" };
}

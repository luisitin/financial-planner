// modules/goals/goals/compute.js -- PURE. Each goal is an amount by a date. For every goal:
// how much is set aside, what it will cost by then, what to put in each month to get there,
// and whether the current monthly amount is enough.
import { pmtToReach, fv, inflate } from "../../../core/math/finance.js";
import { monthsBetween, addMonths } from "../../../core/math/dates.js";
import { mulberry32, normal } from "../../../core/math/montecarlo.js";
import { money as moneyText } from "../../../core/format.js";
import { countedBalance } from "../../balance/net-worth/compute.js";
import { isHouseGoal } from "../house/compute.js";

export const PRIORITIES = { 1: "Must have", 2: "Want", 3: "Nice to have" };
export const GOAL_ICONS = ["🎯", "🛟", "🏠", "🚗", "✈️", "🎓", "💍", "👶", "💻", "🛋️", "🐶", "🎁", "🏖️", "💼"];

/**
 * compute(plan, { today }) -> {
 *   goals: [{ ...goal, priorityLabel, monthsLeft, yearsLeft, rate, targetThen, funded, remaining, neededMonthly,
 *             projected, shortfall, progress, status: "done"|"on track"|"behind"|"no date"|"past due"|"no amount",
 *             dueNow (a goal whose date has passed: what it still needs, due now; its neededMonthly is null),
 *             fundedFrom: [account names], sizeLabel }],
 *   count, done, totalTarget, totalFunded, neededMonthly (sum for open dated goals still ahead), dueNow? (sum for goals
 *   whose date has passed; only when there is one), contributing (sum of monthly),
 *   warnings: [text]
 * }
 * Money set aside = goal.saved + balances of the accounts in goal.fundedBy. Growth rate =
 * goal.rate if set, else the plan's cash return for goals under 3 years away and the bond
 * return beyond that (documented in README). Inflating goals grow the target at the
 * plan's inflation until the target date. Without `today` dates are ignored.
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const a = plan.assumptions ?? {};
  const accounts = plan.accounts ?? [];
  const warnings = [];
  // F-013: an account linked to several goals is shared out, never counted twice: by priority, then by date,
  // each goal takes what it still needs and passes the rest on.
  const pool = new Map((plan.accounts ?? []).map((a) => [a.id, countedBalance(a)]));
  const order = [...(plan.goals ?? [])].map((g, i) => ({ g, i })).sort((a, b) => (Number(a.g.priority) || 2) - (Number(b.g.priority) || 2) || String(a.g.targetDate || "9999").localeCompare(String(b.g.targetDate || "9999")) || a.i - b.i);
  const fromAccounts = new Map();   // goal id -> money taken from linked accounts
  const sharedWith = new Map();     // goal id -> names of other goals on the same accounts
  for (const { g } of order) {
    const target = Math.max(0, Number(g.target) || 0);
    const need = Math.max(0, target - (Number(g.saved) || 0));
    let taken = 0;
    for (const id of Array.isArray(g.fundedBy) ? g.fundedBy : []) {
      const avail = pool.get(id); if (avail === undefined) continue;
      const take = Math.max(0, Math.min(avail, need - taken));
      pool.set(id, avail - take); taken += take;
      const others = (plan.goals ?? []).filter((o) => o.id !== g.id && Array.isArray(o.fundedBy) && o.fundedBy.includes(id)).map((o) => o.name);
      if (others.length) sharedWith.set(g.id, [...new Set([...(sharedWith.get(g.id) ?? []), ...others])]);
    }
    fromAccounts.set(g.id, taken);
  }
  const goals = (plan.goals ?? []).map((g) => {
    const target = Math.max(0, Number(g.target) || 0);   // F-014: a negative amount is "no amount"
    const monthsLeft = today && g.targetDate ? monthsBetween(today, g.targetDate) : null;
    const yearsLeft = monthsLeft === null ? null : Math.max(0, monthsLeft) / 12;
    const rate = g.rate !== undefined && g.rate !== null && g.rate !== "" ? Number(g.rate) : (yearsLeft !== null && yearsLeft >= 3 ? Number(a.returnBonds ?? 0.04) : Number(a.returnCash ?? 0.02));
    const targetThen = g.inflates && yearsLeft ? inflate(target, Number(a.inflation ?? 0.03), yearsLeft) : target;
    const fundedBy = Array.isArray(g.fundedBy) ? g.fundedBy : [];
    const accts = fundedBy.map((id) => accounts.find((x) => x.id === id)).filter(Boolean);
    if (fundedBy.length && accts.length < fundedBy.length) warnings.push(`${g.name || "A goal"} points to an account that no longer exists.`);
    const funded = (Number(g.saved) || 0) + (fromAccounts.get(g.id) ?? 0);
    const remaining = Math.max(0, targetThen - funded);
    const monthly = Number(g.monthly) || 0;
    const n = monthsLeft === null ? null : Math.max(0, monthsLeft);
    const neededMonthly = n === null ? null : (remaining <= 0 ? 0 : (n === 0 ? remaining : Math.max(0, pmtToReach(rate / 12, n, targetThen, funded))));
    const projected = n === null ? null : fv(rate / 12, n, monthly, funded);
    const shortfall = projected === null ? null : Math.max(0, targetThen - projected);
    let status;
    if (!target) status = "no amount";
    else if (funded >= targetThen) status = "done";
    else if (monthsLeft === null) status = "no date";
    else if (monthsLeft < 0) status = "past due";
    else if (monthly > 0 && projected >= targetThen - 0.5) status = "on track";
    else status = "behind";
    if (Number(g.target) < 0) warnings.push(`${g.name || "A goal"} has a negative amount. It is left out of the totals until it is fixed.`);
    // a date that has passed: what is left is due now, not a month's saving (round 8 item 18: one college goal dated 2023
    // added its whole $103,000 to "Needed each month")
    const dueNow = status === "past due" ? remaining : undefined;
    if (today && g.targetDate && String(g.targetDate) < today && status !== "done") warnings.push(`The date for ${g.name || "a goal"} has passed. Set a new date, or lower its amount to what is still needed.`);
    return {
      ...g, target, priorityLabel: PRIORITIES[g.priority] ?? PRIORITIES[2], monthsLeft, yearsLeft, rate, targetThen, funded, remaining,
      neededMonthly: status === "past due" ? null : neededMonthly, ...(dueNow !== undefined ? { dueNow } : {}), projected, shortfall, progress: targetThen > 0 ? Math.min(1, funded / targetThen) : 0, status, monthly,
      fundedFrom: accts.map((x) => x.name), sharedWith: sharedWith.get(g.id) ?? [],
    };
  });
  const counted = goals.filter((g) => g.status !== "no amount");
  const open = counted.filter((g) => g.status !== "done");
  const sum = (arr, k) => arr.reduce((s, x) => s + (Number(x[k]) || 0), 0);
  return {
    goals, count: goals.length, done: counted.filter((g) => g.status === "done").length,
    totalTarget: sum(counted, "targetThen"), totalFunded: counted.reduce((s, g) => s + Math.max(0, Math.min(g.funded, g.targetThen)), 0),
    neededMonthly: sum(open.filter((g) => g.neededMonthly !== null), "neededMonthly"),
    // (only when there is one, so a plan without a passed date reads exactly as before)
    ...(open.some((g) => g.status === "past due") ? { dueNow: sum(open.filter((g) => g.status === "past due"), "dueNow") } : {}),
    contributing: sum(open, "monthly"),
    warnings,
  };
}

// Each kind of goal has a page that works out what it costs; a goal leads to it, and says when that page's figure differs.
// Travel is tested before House ("Trip home" is a trip); House uses the House page's own test, which turns away a roof,
// repairs or an office; a car loan, its insurance or repairs are not a car to buy.
const NOT_A_CAR = /\bloans?\b|pay ?-?off|payoff|insur|repair|registration|mainten|\btires?\b|\bgas\b/i;
const PLANNERS = [
  { page: "goals/education", label: "Education", test: (g) => g.icon === "🎓" || /college|education|school|tuition|529/i.test(g.name ?? "") },
  { page: "goals/vehicle", label: "Vehicle", test: (g) => !NOT_A_CAR.test(g.name ?? "") && (g.icon === "🚗" || /\b(car|vehicle|truck|suv)\b/i.test(g.name ?? "")) },
  { page: "goals/emergency-fund", label: "Emergency fund", test: (g) => g.icon === "🛟" || g.isEmergencyFund || /emergency|rainy day|cushion/i.test(g.name ?? "") },
  { page: "goals/travel", label: "Travel", test: (g) => g.icon === "✈️" || /trip|travel|vacation|holiday/i.test(g.name ?? "") },
  { page: "goals/house", label: "House down payment", test: (g) => isHouseGoal(g) },
];
export const plannerFor = (g) => PLANNERS.find((x) => x.test(g)) ?? null;

/**
 * plannerFigure(goal, goalRow, page, result, plan?) -> { amount, shown?, words, monthly } | { amount: null, note } | null:
 * what the goal's own page (its compute `result`) works out for this goal, in the goal's own dollars (today's when it
 * grows with inflation, else the dollars of its date). null when the page works out nothing for this goal, or its figure
 * would not settle: review fixes 2026-11-02 (README "Each goal leads to its page").
 * - Education: the child's cost for the share chosen there (`totalToday x share`, rounded to $1,000 as Education's own
 *   Update button rounds it), or the dollars of those years (`total x share`) for a goal that does not grow. Only for a
 *   goal naming the child, or the 🎓 goal naming no adult (a grown-up's degree is not the child's college).
 * - Vehicle: only once the Vehicle page has a price of its own; with none it takes the goal's amount and would add sales
 *   tax to it on every tap. Price + sales tax - trade-in is in the dollars of the day it is bought, so amount = target x
 *   net / targetThen for a growing goal, the net itself for one that does not grow; `shown` is the net.
 * - Emergency fund: only for the goal ticked as the emergency fund (otherwise its money never counts there, and a `note`
 *   says to tick it); the cushion's target less the other cash that counts (`target - (now - funded)`).
 * - House: the cash to close (down payment, closing costs, reserves).
 */
export function plannerFigure(g, gr, page, r, plan = null) {
  if (!g || !r) return null;
  const grows = g.inflates !== false;
  if (page === "goals/education") {
    const c = (r.children ?? []).find((x) => (x.goal?.id ?? x.goal) === g.id);
    // a child already in college (review UX 4): the next bill, as Education's own Update button writes it (to the $10, in the
    // dollars of its date), not four years "in the dollars of those years" ($103,000 beside a $25,850 goal)
    if (c?.started && c.left?.length) {
      const first = c.left[0], day = (iso) => { const [y, m, dd] = String(iso).split("-").map(Number); return `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m - 1]} ${dd}, ${y}`; };
      return { amount: Math.round((Number(c.nextYearCost) || 0) / 10) * 10, words: `for its next bill (${first.part === "spring" ? `the spring half of ${first.label}` : first.label}, ${day(c.nextBill)})`, monthly: null };
    }
    if (!c || !(c.totalToday > 0)) return null;
    const name = String(g.name ?? "").toLowerCase();
    const adults = (plan?.household?.people ?? []).filter((p) => p.role !== "dependent" && p.name).map((p) => p.name.toLowerCase());
    const namesChild = name.includes(String(c.name ?? "").toLowerCase());
    if (!namesChild && (g.icon !== "🎓" || adults.some((a) => name.includes(a)))) return null;
    const share = Math.min(1, Math.max(0, Number(c.share ?? 1)));
    const part = share < 1 ? ` for ${Math.round(share * 100)}% of it` : "";
    return grows
      ? { amount: Math.round((c.totalToday * share) / 1000) * 1000, words: `in today's dollars${part}`, monthly: c.neededMonthly ?? null }
      : { amount: Math.round(((c.total ?? 0) * share) / 1000) * 1000, words: `in the dollars of those years${part}`, monthly: c.neededMonthly ?? null };
  }
  if (page === "goals/vehicle") {
    if (r.goal?.id !== g.id || !(r.net > 0) || r.priceFromGoal) return null;
    if (!grows) return { amount: r.net, shown: r.net, words: "with sales tax", monthly: r.cash?.neededMonthly ?? null };
    return gr?.targetThen > 0 ? { amount: (Number(g.target) || 0) * r.net / gr.targetThen, shown: r.net, words: "with sales tax", monthly: r.cash?.neededMonthly ?? null } : null;
  }
  if (page === "goals/emergency-fund") {
    if (r.goal?.id !== g.id || !(r.target > 0)) return null;
    if (!r.goal.isEmergencyFund) return { amount: null, note: "Its money counts toward your emergency fund only once it is checked off as your emergency fund on that page." };
    const other = Math.max(0, (Number(r.now) || 0) - (Number(gr?.funded) || 0));
    const amount = Math.max(0, r.target - other);
    return amount > 0 ? { amount, words: `for ${r.months} months of the bills you have to pay${other > 0 ? `, less the $${Math.round(other).toLocaleString("en-US")} of other cash that counts` : ""}`, monthly: null } : null;
  }
  if (page === "goals/house") return r.goal?.id === g.id && r.cash?.total > 0 ? { amount: r.cash.total, words: "down payment, closing and reserves", monthly: r.neededMonthly ?? null } : null;
  return null;
}

/** The page's figure is worth mentioning when it is 5% or more away from the goal's amount. */
export const plannerDiffers = (g, f) => !!f && f.amount !== null && f.amount !== undefined && Math.abs(f.amount - (Number(g.target) || 0)) >= 0.05 * Math.max(1, Number(g.target) || 0);

// ---- the chance of reaching each goal on time (gap list, next 60, item 12; map G7; README "The chance of reaching each goal")
// compute() above is not touched: chances() reads its rows and adds nothing to them, so every page that reads compute() sees
// the same bytes as before.

/** The pretend futures behind each goal's chance: how many (1,000: a share good to about 1.6 points), the seed (fixed, so a
 * visit tomorrow says what today's did while the plan is the same), the share the second line aims for (9 in 10), how far
 * past its date a later date is looked for (10 years), how closely stocks and bonds move together (0.1, as Chance the money
 * lasts draws them), the years from which the page counts a goal's money as bonds rather than cash (3, compute() above), and
 * the furthest date worked out (80 years: a date typed as 9999 would walk 8,000 years of months on every draw). */
export const CHANCE = Object.freeze({ runs: 1000, seed: 1, aim: 0.9, laterMonths: 120, corr: 0.1, bondMonths: 36, farMonths: 960 });

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** "2029-06-01" -> "June 2029" ("" for anything else). */
export const monthYear = (iso) => { const m = /^(\d{4})-(\d{2})/.exec(String(iso ?? "")); return m && Number(m[2]) >= 1 && Number(m[2]) <= 12 ? `${MONTH_NAMES[Number(m[2]) - 1]} ${m[1]}` : ""; };
const ownRateOf = (g) => (g?.rate !== undefined && g?.rate !== null && g?.rate !== "" ? Number(g.rate) : null);

/**
 * goalMix(ownRate, months, assumptions) -> { rate, swing, kind: "cash" | "bonds" | "own" }: what a goal's money is counted to
 * grow at in a year, and how much that swings in a typical year (a standard deviation, a fraction).
 * - No own rate (null): the page's own rule (compute() above): under 36 months away it is cash, `returnCash` with no swing;
 *   from 36 months it is bonds, `returnBonds` with `stdevBonds`.
 * - An own rate r: the cash, bond and stock mix that grows at r, with that mix's swing. r at or under cash: none (steady).
 *   Between cash and bonds: a share w = (r - cash) / (bonds - cash) in bonds, swing w x stdevBonds (cash does not swing).
 *   Between bonds and stocks: w = (r - bonds) / (stocks - bonds) in stocks, the rest in bonds, swing
 *   sqrt((w sS)^2 + ((1 - w) sB)^2 + 2 w (1 - w) 0.1 sS sB) (the variance of two assets with correlation 0.1). Above the
 *   stock return: the stock swing (no riskier mix is made up).
 */
export function goalMix(ownRate, months, a = {}) {
  const c = Number(a.returnCash ?? 0.02), b = Number(a.returnBonds ?? 0.04), s = Number(a.returnStocks ?? 0.07);
  const sB = Math.max(0, Number(a.stdevBonds ?? 0.05) || 0), sS = Math.max(0, Number(a.stdevStocks ?? 0.15) || 0);
  if (ownRate === null || ownRate === undefined || ownRate === "") return Number(months) >= CHANCE.bondMonths ? { rate: b, swing: sB, kind: "bonds" } : { rate: c, swing: 0, kind: "cash" };
  const r = Number(ownRate);
  if (!(r > c)) return { rate: r, swing: 0, kind: "own" };
  if (r <= b) return { rate: r, swing: (b > c ? (r - c) / (b - c) : 1) * sB, kind: "own" };
  if (r <= s) {
    const w = s > b ? (r - b) / (s - b) : 1;
    return { rate: r, swing: Math.sqrt((w * sS) ** 2 + ((1 - w) * sB) ** 2 + 2 * w * (1 - w) * CHANCE.corr * sS * sB), kind: "own" };
  }
  return { rate: r, swing: sS, kind: "own" };
}

/** The luck of each pretend year: year y holds one standard normal draw per path, drawn year by year from one seeded stream, so
 * year y reads the same whichever goals ask and however far they look (a goal's answer never moves when another is added). */
export function drawLuck(runs, seed) {
  const rand = mulberry32(seed), years = [];
  return (y) => { while (years.length <= y) { const z = new Float64Array(runs); for (let p = 0; p < runs; p++) z[p] = normal(rand); years.push(z); } return years[y]; };
}

/**
 * walker(luck, mix, { runs, start, monthly, targetAt, snap }) -> { share(t), P, A }: the pretend futures of one mix, walked
 * month by month only as far as asked. share(t): the share of paths whose money at the end of month t is at least
 * targetAt(t) - 0.5; P and A: each path's P_snap and A_snap, once month `snap` is walked.
 * Month t of pretend year y = floor((t - 1) / 12) grows by F = (1 + r/12) exp(sqrt(v) z / 12 - v / 24), v = ln(1 + (swing /
 * (1 + r))^2): a year's twelve months multiply to a lognormal with mean (1 + r/12)^12 (the page's own monthly compounding)
 * and log spread sqrt(v) (the moment match of Chance the money lasts, Aitchison and Brown 1957). The money: B_t = start P_t +
 * monthly A_t, P_t = P_(t-1) F_t, A_t = A_(t-1) F_t + 1 (a month's money goes in at its end, as fv()).
 */
export function walker(luck, mix, { runs, start, monthly, targetAt, snap = 0 }) {
  const n = mix.swing > 0 ? runs : 1, g = 1 + mix.rate / 12;
  const v = mix.swing > 0 ? Math.log(1 + (mix.swing / (1 + mix.rate)) ** 2) : 0, sd = Math.sqrt(v);
  const P = new Float64Array(n).fill(1), A = new Float64Array(n), F = new Float64Array(n).fill(g);
  const shares = [0];
  const self = { P: null, A: null, share(t) {
    for (let m = shares.length; m <= t; m++) {
      if (sd > 0 && (m - 1) % 12 === 0) { const z = luck((m - 1) / 12); for (let p = 0; p < n; p++) F[p] = g * Math.exp((sd * z[p]) / 12 - v / 24); }
      const goal = targetAt(m) - 0.5;
      let hit = 0;
      for (let p = 0; p < n; p++) { P[p] *= F[p]; A[p] = A[p] * F[p] + 1; if (start * P[p] + monthly * A[p] >= goal) hit++; }
      shares.push(hit / n);
      if (m === snap) { self.P = Float64Array.from(P); self.A = Float64Array.from(A); }
    }
    return shares[t];
  } };
  return self;
}

/** The first day of the first calendar month whose first day is at least t months after today (what monthsBetween counts),
 * so a date typed anywhere in that month gives the page at least t months. */
export function monthAtLeast(today, t) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(today ?? ""));
  if (!m) return null;
  return addMonths(`${m[1]}-${m[2]}-01`, t + (Number(m[3]) > 1 ? 1 : 0));
}

/**
 * chances(plan, { today, rows?, runs?, seed? }) -> { runs, seed, goals: [goal] }: for each goal, in the order of
 * compute(plan).goals (pass `rows` to reuse that result), the chance it has its amount by its date with the money set aside
 * for it and what goes in each month, the returns drawn at random around the plan's growth for its mix (goalMix).
 * goal: { id, name, kind: "reached" | "no amount" | "no date" | "date passed" | "due now" | "too far" | "run", target, grows (its amount
 * rises with prices to a later date: said "in today's dollars"), targetThen, when (its date), monthsLeft, monthly, funded,
 * remaining, neededMonthly, runs } and, for "run": { chance (0 to 1), steady (no swing at its date: cash), rate, swing,
 * mixKind } and, when chance < 9 in 10: { aimMonthly (the monthly that makes it 9 in 10: the page's own neededMonthly when
 * steady; else the 900th smallest per-path need, rounded up to $10; null when a figure in the plan is not a number), aimDate
 * (the first month, within 10 years after its date, by which today's monthly makes it 9 in 10 with the mix the page would
 * give that date; null when none), aimSwing (that date's mix has ups and downs) }. "too far": more than 80 years away.
 * Each row's own goal is the plan's goal at the same place (two goals with one id each keep their own growth figure).
 * Pure: reads the plan, never writes it; the same answer for the same plan, today and seed.
 */
export function chances(plan, params = {}) {
  const today = params.today ?? null;
  const runs = Math.max(1, Math.round(Number(params.runs ?? CHANCE.runs)) || CHANCE.runs);
  const seed = Number.isFinite(Number(params.seed)) ? Number(params.seed) : CHANCE.seed;
  const a = plan?.assumptions ?? {};
  const infl = Number(a.inflation ?? 0.03);
  const rows = params.rows ?? compute(plan, { today }).goals;
  const list = plan?.goals ?? [];
  const byId = new Map(list.filter(Boolean).map((g) => [g.id, g]));
  const luck = drawLuck(runs, seed);
  const goals = rows.map((row, i) => {
    const g = (list[i] && list[i].id === row.id ? list[i] : byId.get(row.id)) ?? row;
    const out = { id: row.id, name: row.name, kind: "run", target: row.target, grows: !!row.inflates && row.targetThen > row.target, targetThen: row.targetThen,
      when: row.targetDate || "", monthsLeft: row.monthsLeft, monthly: row.monthly, funded: row.funded, remaining: row.remaining, neededMonthly: row.neededMonthly, runs };
    if (row.status === "no amount") return { ...out, kind: "no amount" };
    if (row.status === "done") return { ...out, kind: "reached" };
    if (row.status === "no date") return { ...out, kind: "no date" };
    if (row.status === "past due") return { ...out, kind: "date passed" };
    const n = row.monthsLeft;
    if (!(n >= 1)) return { ...out, kind: "due now" };
    if (n > CHANCE.farMonths) return { ...out, kind: "too far" };
    const own = ownRateOf(g);
    const mixAt = (t) => goalMix(own, t, a);
    const targetAt = (t) => (row.inflates && t > 0 ? inflate(row.target, infl, t / 12) : row.target);
    const start = Number(row.funded) || 0, monthly = Number(row.monthly) || 0;
    const upTo = n + CHANCE.laterMonths;
    // the share at month t with the mix the page would give a goal t months away: steady (cash) in closed form (the page's
    // own fv(), so "Sure" is exactly its "on track"); with ups and downs from one walker per mix, walked only as far as asked
    const walkers = new Map();
    const shareAt = (t) => {
      const mix = mixAt(t);
      if (!(mix.swing > 0)) return fv(mix.rate / 12, t, monthly, start) >= targetAt(t) - 0.5 ? 1 : 0;
      const key = `${mix.rate}|${mix.swing}`;
      if (!walkers.has(key)) walkers.set(key, walker(luck, mix, { runs, start, monthly, targetAt, snap: n }));
      return walkers.get(key).share(t);
    };
    const mix = mixAt(n), steady = !(mix.swing > 0);
    const chance = shareAt(n);
    const res = { ...out, chance, steady, rate: mix.rate, swing: mix.swing, mixKind: mix.kind };
    if (chance >= CHANCE.aim) return res;
    let aimMonthly;
    if (steady) aimMonthly = row.neededMonthly;
    else {
      const w = walkers.get(`${mix.rate}|${mix.swing}`), need = new Float64Array(runs);
      for (let p = 0; p < runs; p++) need[p] = Math.max(0, (row.targetThen - 0.5 - start * w.P[p]) / w.A[p]);
      need.sort();
      aimMonthly = Math.ceil(need[Math.ceil(CHANCE.aim * runs) - 1] / 10) * 10;
    }
    if (!Number.isFinite(Number(aimMonthly)) || aimMonthly === null) aimMonthly = null;   // a rate typed as text: no figure to say
    let aimDate = null, aimSwing = false;
    if (today) for (let t = n + 1; t <= upTo; t++) if (shareAt(t) >= CHANCE.aim) { aimDate = monthAtLeast(today, t); aimSwing = mixAt(t).swing > 0; break; }
    return { ...res, aimMonthly, aimDate, aimSwing };
  });
  return { runs, seed, goals };
}

/**
 * chanceWords(goal, { money, fromSavings }) -> { value, says, aim }: the words for one goal of chances(), one written sentence
 * per case (docs/OPTIONAL.md R5; README "The chance of reaching each goal" lists them): `value` the short answer on the
 * record's first line, on one scale ("On pace" / "Not at this pace" for money that does not go up and down, "N in 10" for
 * money that does), `says` the sentence, `aim` the line on what would make it 9 in 10 ("" when there is none). Facts, never
 * advice. `money` formats an amount (the page's fmt.money with its currency); `fromSavings`: Next best action pays this goal
 * from savings when it is due (the page's "from savings" row). A goal that gets there with nothing going in each month says
 * so: the page's own row calls it "behind" (its "on track" needs money going in), and "needs $0 a month".
 * The chance in tenths is rounded down, as every chance in the app (modules/retirement/odds.js): never 9 under 90%.
 */
export function chanceWords(x, { money = (n) => moneyText(n), fromSavings = false } = {}) {
  const amount = `${money(x.target)}${x.grows ? " in today's dollars" : ""}`, when = monthYear(x.when);
  const tried = Number(x.runs ?? CHANCE.runs).toLocaleString("en-US");
  const none = (value, says) => ({ value, says, aim: "" });
  if (x.kind === "reached") return none("Reached", `The money set aside already covers its ${amount}.`);
  if (x.kind === "no amount") return none("No amount", "Add an amount to see its chance.");
  if (x.kind === "no date") return none("No date", "Add a date to see its chance of being on time.");
  if (x.kind === "date passed") return none("Date passed", "Its date has passed: set a new date to see its chance.");
  if (fromSavings) return none("From savings", "It is paid from savings when it is due, so there is no chance to work out.");
  if (x.kind === "due now") return none("Due now", `It is due this month, and ${money(x.remaining)} is still needed.`);
  if (x.kind === "too far") return none("Too far off", "Its date is more than 80 years away: too far off to say.");
  const p = Number(x.chance) || 0, still = !(Number(x.monthly) > 0);
  let value, says;
  if (x.steady) {
    if (p < 1) [value, says] = ["Not at this pace", `It falls short of ${amount} by ${when}.`];
    else if (still) [value, says] = ["On pace", `It reaches ${amount} by ${when} with nothing more put in.`];
    else [value, says] = ["On pace", `It reaches ${amount} by ${when} at this pace.`];
  } else if (p >= 1) [value, says] = still
    ? ["10 in 10", `It reaches ${amount} by ${when} with nothing more put in, in all ${tried} pretend futures we tried.`]
    : ["10 in 10", `It reaches ${amount} by ${when} in all ${tried} pretend futures we tried.`];
  else if (p >= CHANCE.aim) [value, says] = still
    ? ["9 in 10", `At least 9 in 10 that it reaches ${amount} by ${when} with nothing more put in.`]
    : ["9 in 10", `At least 9 in 10 that it reaches ${amount} by ${when}.`];
  else if (p >= 0.1) { const k = Math.min(8, Math.floor(p * 10)); [value, says] = [`${k} in 10`, `About ${k} in 10 that it reaches ${amount} by ${when}.`]; }
  else if (p > 0) [value, says] = ["Under 1 in 10", `Unlikely at this pace: fewer than 1 in 10 that it reaches ${amount} by ${when}.`];
  else [value, says] = ["Under 1 in 10", `Very unlikely at this pace to reach ${amount} by ${when}.`];
  let aim = "";
  if (p < CHANCE.aim && x.aimMonthly !== undefined && x.aimMonthly !== null && Number.isFinite(Number(x.aimMonthly))) {
    const later = x.aimDate ? monthYear(x.aimDate) : "";
    if (!x.steady) aim = later ? `It would be 9 in 10 with about ${money(x.aimMonthly)} a month, or with the date moved to ${later}.` : `It would be 9 in 10 with about ${money(x.aimMonthly)} a month.`;
    else if (!later) aim = `It would get there with ${money(x.aimMonthly)} a month.`;
    else aim = x.aimSwing
      ? `It would get there with ${money(x.aimMonthly)} a month, or be 9 in 10 with the date moved to ${later}.`
      : `It would get there with ${money(x.aimMonthly)} a month, or with the date moved to ${later}.`;
  }
  return { value, says, aim };
}

/** Whether a goal of chances() may miss its date: under 9 in 10 at today's pace, its date passed, or due this month with money
 * still needed (a goal Next best action pays from savings is not). */
export const mayBeLate = (x, fromSavings = false) => !fromSavings && (x.kind === "date passed" || x.kind === "due now" || (x.kind === "run" && !((Number(x.chance) || 0) >= CHANCE.aim)));

/**
 * chanceStatus(goals, { fromSavings, money }) -> the status beside the shut row "Chance of reaching each goal" (at most 20
 * characters, core/ui/more.js STATUS_MAX), so the answer shows without a tap: one goal, its own short answer ("7 in 10",
 * "On pace"); some that may miss their date, "2 of 4 may be late" ("All 4 may be late"); none, "None look late" once one
 * has a chance or is reached; else the count ("3 goals"). `fromSavings(id)`: Next best action pays it from savings.
 */
export function chanceStatus(goals, { fromSavings = () => false, money } = {}) {
  const n = goals.length;
  if (n === 1) return chanceWords(goals[0], { fromSavings: fromSavings(goals[0].id), ...(money ? { money } : {}) }).value;
  const late = goals.filter((x) => mayBeLate(x, fromSavings(x.id))).length;
  if (late) return late === n ? `All ${n} may be late` : `${late} of ${n} may be late`;
  if (goals.some((x) => x.kind === "reached" || (x.kind === "run" && !fromSavings(x.id)))) return "None look late";
  return `${n} goals`;
}

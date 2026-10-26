// qa/households/lib/expect.mjs -- the tester's OWN recomputation of what the pages should show
// for a plan. Written from the documented rules (module READMEs and compute.js comments), not
// imported from the app, so a wrong number in the app cannot hide behind the same bug here.
// Every helper is plain arithmetic; today is always passed in.

export const PER_YEAR = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12, quarterly: 4, annual: 1, once: 0 };
const times = (p) => PER_YEAR[p] ?? 12;
export const perYear = (amt, p) => (Number(amt) || 0) * times(p);
export const perMonth = (amt, p) => perYear(amt, p) / 12;

const parse = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? "").trim()); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; };
const pad = (n) => String(n).padStart(2, "0");
export const isoOf = (y, m, d) => { const dt = new Date(y, m - 1, d); return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`; };
export function ageOn(birth, today) { const b = parse(birth), t = parse(today); if (!b || !t) return null; let a = t.y - b.y; if (t.m < b.m || (t.m === b.m && t.d < b.d)) a--; return a; }
export function monthsBetween(from, to) { const a = parse(from), b = parse(to); if (!a || !b) return null; let m = (b.y - a.y) * 12 + (b.m - a.m); if (b.d < a.d) m--; return m; }
export function daysBetween(from, to) { const a = parse(from), b = parse(to); if (!a || !b) return null; return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000); }
export function addMonths(iso, n) { const p = parse(iso); if (!p) return null; const first = new Date(p.y, p.m - 1 + n, 1); const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(); return isoOf(first.getFullYear(), first.getMonth() + 1, Math.min(p.d, last)); }
export const dateAtAge = (birth, age) => { const p = parse(birth); return p ? isoOf(p.y + Number(age), p.m, p.d) : null; };
const activeOn = (x, today) => !(x?.startDate && String(x.startDate) > today) && !(x?.endDate && String(x.endDate) < today);

// ---- account types (side / liquid / invested / tax bucket), as documented on the Net worth README
export const ACCOUNT_TYPES = {
  checking: { side: "asset", liquid: true, invested: false, bucket: "taxable", tier: "now" },
  savings: { side: "asset", liquid: true, invested: false, bucket: "taxable", tier: "now" },
  cash: { side: "asset", liquid: true, invested: false, bucket: "taxable", tier: "now" },
  brokerage: { side: "asset", liquid: true, invested: true, bucket: "taxable", tier: "week" },
  "401k": { side: "asset", liquid: false, invested: true, bucket: "deferred", tier: "later" },
  ira: { side: "asset", liquid: false, invested: true, bucket: "deferred", tier: "later" },
  roth: { side: "asset", liquid: false, invested: true, bucket: "free", tier: "later" },
  hsa: { side: "asset", liquid: false, invested: true, bucket: "free", tier: "later" },
  "529": { side: "asset", liquid: false, invested: true, bucket: "free", tier: "later" },
  crypto: { side: "asset", liquid: true, invested: true, bucket: "taxable", tier: "week" },
  property: { side: "asset", liquid: false, invested: false, bucket: "none", tier: "later" },
  vehicle: { side: "asset", liquid: false, invested: false, bucket: "none", tier: "later" },
  cash_value_life: { side: "asset", liquid: false, invested: false, bucket: "deferred", tier: "later" },
  other_asset: { side: "asset", liquid: false, invested: false, bucket: "none", tier: "later" },
  credit: { side: "liability" }, loan: { side: "liability" }, mortgage: { side: "liability" }, student_loan: { side: "liability" }, other_liability: { side: "liability" },
};
const typeOf = (a) => ACCOUNT_TYPES[a.type] ?? ACCOUNT_TYPES.other_asset;
export const isLiability = (a) => typeOf(a).side === "liability";
export const countedBalance = (a) => isLiability(a) ? Math.abs(Number(a.balance) || 0) : (Number(a.balance) || 0);

export const CATEGORY_ESSENTIAL = { housing: true, utilities: true, groceries: true, transport: true, insurance: true, health: true, debt: true, childcare: true, phone: true, taxes: true, subscriptions: false, dining: false, fun: false, shopping: false, travel: false, giving: false, personal: false, pets: false, other: false };

export function expectPeople(plan, today) {
  const a = plan.assumptions ?? {};
  const raw = plan.household?.people ?? [];
  const people = raw.map((p) => {
    const age = p.birthDate ? ageOn(p.birthDate, today) : null;
    const isAdult = p.role !== "dependent";
    const retirementAge = isAdult ? Number(p.retirementAge ?? a.retirementAge ?? 65) : null;
    const planEndAge = Number(p.lifeExpectancy ?? a.planEndAge ?? 95);
    return { name: p.name, role: p.role, age, isAdult, retirementAge, planEndAge,
      retirementYear: isAdult && p.birthDate ? Number(dateAtAge(p.birthDate, retirementAge).slice(0, 4)) : null,
      yearsToRetirement: isAdult && age !== null ? Math.max(0, retirementAge - age) : null,
      retired: isAdult && age !== null ? age >= retirementAge : null,
      yearsLeft: age !== null ? Math.max(0, planEndAge - age) : null };
  });
  const adults = people.filter((p) => p.isAdult), dependents = people.filter((p) => !p.isAdult);
  const horizons = adults.map((p) => p.yearsLeft).filter((y) => y !== null);
  const warnings = [];
  if (people.length && !raw.some((p) => p.role === "self")) warnings.push("nobody marked as Me");
  if (raw.filter((p) => p.role === "self").length > 1) warnings.push("more than one Me");
  if (adults.length >= 2 && (plan.household?.filingStatus ?? "single") === "single") warnings.push("two adults but filing Single");
  for (const p of people) {
    if (p.age !== null && p.age < 0) warnings.push(`${p.name} birth date in the future`);
    if (p.age !== null && p.age > 120) warnings.push(`${p.name} would be ${p.age}`);
    if (p.isAdult && p.age !== null && p.retirementAge > p.planEndAge) warnings.push(`${p.name} retirement age past plan end`);
  }
  const me = people.find((p) => p.role === "self") ?? people.find((p) => p.isAdult) ?? people[0] ?? null;
  return { count: people.length, adults: adults.length, dependents: dependents.length, people, me, horizonYears: horizons.length ? Math.max(...horizons) : null, warnings };
}

export function expectIncome(plan, today) {
  const items = (plan.income ?? []).map((x) => ({ ...x, active: activeOn(x, today), monthly: perMonth(x.amount, x.period), yearly: perYear(x.amount, x.period), nextYear: perYear(x.amount, x.period) * (1 + (Number(x.growth) || 0)), oneTime: x.period === "once" ? Number(x.amount) || 0 : 0 }));
  const active = items.filter((x) => x.active);
  const sum = (arr, k) => arr.reduce((s, x) => s + x[k], 0);
  const warnings = [];
  for (const x of items) {
    if (!(Number(x.amount) > 0)) warnings.push(`${x.name} has no amount`);
    if (x.startDate && x.endDate && String(x.endDate) < String(x.startDate)) warnings.push(`${x.name} ends before it starts`);
    if (Number(x.growth) > 0.25) warnings.push(`${x.name} grows ${Math.round(Number(x.growth) * 100)}% a year`);
  }
  const byPerson = {};
  for (const x of active) { const k = x.personId || "Household"; byPerson[k] = (byPerson[k] ?? 0) + x.monthly; }
  return { count: items.length, activeCount: active.length, monthly: sum(active, "monthly"), yearly: sum(active, "yearly"), nextYear: sum(active, "nextYear"), oneTime: sum(active, "oneTime"), byPerson, warnings };
}

export function expectExpenses(plan, today, income, debts) {
  const items = (plan.expenses ?? []).map((x) => ({ ...x, active: activeOn(x, today), monthly: perMonth(x.amount, x.period), yearly: perYear(x.amount, x.period), essential: x.essential ?? CATEGORY_ESSENTIAL[x.category] ?? false, inflates: x.inflates !== false, oneTime: x.period === "once" ? Number(x.amount) || 0 : 0 }));
  const active = items.filter((x) => x.active);
  const sum = (arr, k) => arr.reduce((s, x) => s + x[k], 0);
  // F-019: required payments from the Debts page count as a must-pay line when nothing is filed under "debt"
  const debtPayments = debts ? debts.payments : 0;
  const filedDebt = sum(active.filter((x) => x.category === "debt"), "monthly");
  const debtFromDebts = debtPayments > 0 && filedDebt === 0 ? debtPayments : 0;
  const monthly = sum(active, "monthly") + debtFromDebts;
  const byCategory = {};
  for (const x of active) { const k = CATEGORY_ESSENTIAL[x.category] === undefined ? "other" : x.category; byCategory[k] = (byCategory[k] ?? 0) + x.monthly; }
  const hasIncome = (plan.income ?? []).length > 0;
  const leftOver = hasIncome ? income.monthly - monthly : null;
  const warnings = [];
  for (const x of items) {
    if (!(Number(x.amount) > 0)) warnings.push(`${x.name} has no amount`);
    if (x.startDate && x.endDate && String(x.endDate) < String(x.startDate)) warnings.push(`${x.name} ends before it starts`);
  }
  if (leftOver !== null && leftOver < 0) warnings.push(`spend ${Math.round(-leftOver)} more than comes in`);
  if (debtPayments > 0 && filedDebt > 0 && Math.abs(filedDebt - debtPayments) / debtPayments > 0.1) warnings.push(`loan and card payments here (${Math.round(filedDebt)}) differ from Debts (${Math.round(debtPayments)})`);
  return { count: items.length, monthly, yearly: sum(active, "yearly") + debtFromDebts * 12, debtFromDebts, essentialMonthly: sum(active.filter((x) => x.essential), "monthly") + debtFromDebts, optionalMonthly: sum(active.filter((x) => !x.essential), "monthly"), oneTime: sum(active, "oneTime"), byCategory, leftOver, savingsRatePct: leftOver !== null && income.monthly > 0 ? Math.round(100 * leftOver / income.monthly) : null, warnings };
}

export function expectNetWorth(plan) {
  let assets = 0, liabilities = 0, liquid = 0, cash = 0, investable = 0;
  const buckets = { taxable: 0, deferred: 0, free: 0, none: 0 };
  for (const a of plan.accounts ?? []) {
    const t = typeOf(a), bal = countedBalance(a);
    if (t.side === "liability") { liabilities += bal; continue; }
    assets += bal;
    if (t.liquid) liquid += bal;
    if (t.liquid && !t.invested) cash += bal;
    if (t.invested) { investable += bal; buckets[t.bucket] += bal; } else buckets.none += bal;
  }
  return { count: (plan.accounts ?? []).length, assets, liabilities, netWorth: assets - liabilities, liquid, cash, investable, buckets };
}

export function expectLiquidity(plan, expenses, goals, income) {
  const assets = (plan.accounts ?? []).filter((a) => !isLiability(a));
  const tier = (t) => assets.filter((a) => typeOf(a).tier === t).reduce((s, a) => s + countedBalance(a), 0);
  const nowAll = tier("now"), week = tier("week"), later = tier("later");
  // F-020: money in a usable-today account that a goal has claimed is set aside
  const nowIds = new Set(assets.filter((a) => typeOf(a).tier === "now").map((a) => a.id));
  let earmarked = 0;
  for (const g of goals?.goals ?? []) if ((g.fundedBy ?? []).some((id) => nowIds.has(id)) && g.status !== "no amount") earmarked += Math.max(0, Math.min(g.funded - g.saved, g.targetThen));
  earmarked = Math.min(earmarked, nowAll);
  const now = nowAll - earmarked;
  // F-017: one-time costs on the books (one-time income counts the other way)
  const oneOffs = (expenses?.oneTime ?? 0) - (income?.oneTime ?? 0);
  const hasExp = (plan.expenses ?? []).length > 0;
  const essential = hasExp ? expenses.essentialMonthly : 0;
  const targetMonths = Number(plan.assumptions?.emergencyMonths ?? 6);
  const target = essential * targetMonths;
  const runwayMonths = essential > 0 ? now / essential : null;
  const fullRunwayMonths = hasExp && expenses.monthly > 0 ? now / expenses.monthly : null;
  const fundedShare = target > 0 ? Math.min(1, now / target) : null;
  const status = fundedShare === null ? "unknown" : fundedShare >= 1 ? "ok" : fundedShare >= 0.5 ? "warn" : "bad";
  return { now, nowAll, earmarked, oneOffs, nowAfterOneOffs: now - oneOffs, runwayAfterOneOffs: essential > 0 && oneOffs ? (now - oneOffs) / essential : null, week, later, target, targetMonths, gap: target > 0 ? Math.max(0, target - now) : 0, runwayMonths, fullRunwayMonths, status };
}

export function nper(rate, payment, principal) { if (payment <= 0) return Infinity; if (rate === 0) return principal / payment; const x = 1 - (principal * rate) / payment; if (x <= 0) return Infinity; return -Math.log(x) / Math.log(1 + rate); }
function scheduleInterest(principal, r, payment, cap) { let bal = principal, tot = 0, n = 0; while (bal > 0.005 && n < cap) { n++; const i = bal * r; const p = Math.min(payment, bal + i); bal -= p - i; tot += i; } return Math.round(tot * 100) / 100; }

export function expectDebts(plan, today, income) {
  const rows = (plan.accounts ?? []).filter(isLiability).map((a) => {
    const d = (plan.debts ?? []).find((x) => x.accountId === a.id) ?? null;
    const owed = Math.abs(Number(a.balance) || 0);
    const rate = d ? Number(d.rate) || 0 : null;
    const minPayment = d ? Number(d.minPayment) || 0 : 0, extra = d ? Number(d.extra) || 0 : 0, payment = minPayment + extra;
    let months = null, totalInterest = null;
    if (d && payment > 0 && owed > 0) { months = nper(rate / 12, payment, owed); if (Number.isFinite(months)) { months = Math.ceil(months - 1e-9); totalInterest = scheduleInterest(owed, rate / 12, payment, (months + 12) * 4); } }
    else if (d && owed === 0) { months = 0; totalInterest = 0; }
    return { name: a.name, type: a.type, owed, hasDetail: !!d, rate, payment, minPayment, extra, interestMonthly: rate !== null ? owed * rate / 12 : null, months, payoffDate: Number.isFinite(months) && months !== null ? addMonths(today, months) : null, totalInterest, expensive: rate !== null && rate >= 0.15 && owed > 0, neverPaysOff: months === Infinity };
  });
  const rated = rows.filter((r) => r.rate !== null && r.owed > 0);
  const owed = rows.reduce((s, r) => s + r.owed, 0), payments = rows.reduce((s, r) => s + r.payment, 0);
  const inc = (plan.income ?? []).length && income.monthly > 0 ? income.monthly : null;
  return { count: rows.length, withDetail: rows.filter((r) => r.hasDetail).length, owed, minimums: rows.reduce((s, r) => s + r.minPayment, 0), payments, interestMonthly: rows.reduce((s, r) => s + (r.interestMonthly ?? 0), 0), avgRate: rated.length ? rated.reduce((s, r) => s + r.rate * r.owed, 0) / rated.reduce((s, r) => s + r.owed, 0) : null, dti: inc ? payments / inc : null, rows };
}

export function pmtToReach(rate, n, target, start) { if (n <= 0) return Math.max(0, target - start); if (rate === 0) return (target - start) / n; const g = Math.pow(1 + rate, n); return (target - start * g) * rate / (g - 1); }
export function fv(rate, n, pmt, pv) { if (rate === 0) return pv + pmt * n; const g = Math.pow(1 + rate, n); return pv * g + pmt * (g - 1) / rate; }

export function expectGoals(plan, today) {
  const a = plan.assumptions ?? {};
  const accounts = plan.accounts ?? [];
  const warnings = [];
  // F-013: an account linked to several goals is shared out (priority, then date, then order); each goal takes what it still needs
  const pool = new Map(accounts.map((x) => [x.id, countedBalance(x)]));
  const order = (plan.goals ?? []).map((g, i) => ({ g, i })).sort((x, y) => (Number(x.g.priority) || 2) - (Number(y.g.priority) || 2) || String(x.g.targetDate || "9999").localeCompare(String(y.g.targetDate || "9999")) || x.i - y.i);
  const fromAccounts = new Map();
  for (const { g } of order) {
    const tgt = Math.max(0, Number(g.target) || 0), need = Math.max(0, tgt - (Number(g.saved) || 0));
    let taken = 0;
    for (const id of Array.isArray(g.fundedBy) ? g.fundedBy : []) { const avail = pool.get(id); if (avail === undefined) continue; const take = Math.max(0, Math.min(avail, need - taken)); pool.set(id, avail - take); taken += take; }
    fromAccounts.set(g.id ?? g.name, taken);
  }
  const goals = (plan.goals ?? []).map((g) => {
    const target = Math.max(0, Number(g.target) || 0);   // F-014: a negative amount is "no amount"
    const monthsLeft = g.targetDate ? monthsBetween(today, g.targetDate) : null;
    const yearsLeft = monthsLeft === null ? null : Math.max(0, monthsLeft) / 12;
    const rate = g.rate !== undefined && g.rate !== null && g.rate !== "" ? Number(g.rate) : (yearsLeft !== null && yearsLeft >= 3 ? Number(a.returnBonds ?? 0.04) : Number(a.returnCash ?? 0.02));
    const targetThen = g.inflates && yearsLeft ? target * Math.pow(1 + Number(a.inflation ?? 0.03), yearsLeft) : target;
    const fundedBy = Array.isArray(g.fundedBy) ? g.fundedBy : [];
    const accts = fundedBy.map((id) => accounts.find((x) => x.id === id)).filter(Boolean);
    if (fundedBy.length && accts.length < fundedBy.length) warnings.push(`${g.name} points to a missing account`);
    const funded = (Number(g.saved) || 0) + (fromAccounts.get(g.id ?? g.name) ?? 0);
    const remaining = Math.max(0, targetThen - funded);
    const monthly = Number(g.monthly) || 0;
    const n = monthsLeft === null ? null : Math.max(0, monthsLeft);
    const neededMonthly = n === null ? null : (remaining <= 0 ? 0 : (n === 0 ? remaining : Math.max(0, pmtToReach(rate / 12, n, targetThen, funded))));
    const projected = n === null ? null : fv(rate / 12, n, monthly, funded);
    let status;
    // target <= 0 is "no amount" on purpose (F-014): the app currently marks a negative goal "done"
    // and lets it pull "Saved so far" below zero. Cases with a negative goal fail until that is fixed.
    if (!(target > 0)) status = "no amount"; else if (funded >= targetThen) status = "done"; else if (monthsLeft === null) status = "no date"; else if (monthsLeft < 0) status = "past due"; else if (monthly > 0 && projected >= targetThen - 0.5) status = "on track"; else status = "behind";
    if ((Number(g.target) || 0) < 0) warnings.push(`${g.name} has a negative amount`);
    if (g.targetDate && String(g.targetDate) < today && status !== "done") warnings.push(`${g.name} date has passed`);
    return { name: g.name, fundedBy: Array.isArray(g.fundedBy) ? g.fundedBy : [], saved: Number(g.saved) || 0, target, targetThen, monthsLeft, rate, funded, remaining, monthly, neededMonthly, projected, status };
  });
  const open = goals.filter((g) => g.status !== "done" && g.status !== "no amount");
  const counted = goals.filter((g) => g.status !== "no amount");
  return { count: goals.length, done: goals.filter((g) => g.status === "done").length, totalTarget: counted.reduce((s, g) => s + g.targetThen, 0), totalFunded: counted.reduce((s, g) => s + Math.min(g.funded, g.targetThen), 0), neededMonthly: open.filter((g) => g.neededMonthly !== null).reduce((s, g) => s + g.neededMonthly, 0), contributing: open.reduce((s, g) => s + g.monthly, 0), goals, warnings };
}

/** Everything the runner compares, plus the "expected" section of a case file. */
export function expectAll(plan, today) {
  const people = expectPeople(plan, today);
  const income = expectIncome(plan, today);
  const debts = expectDebts(plan, today, income);
  const expenses = expectExpenses(plan, today, income, debts);
  const netWorth = expectNetWorth(plan);
  const goals = expectGoals(plan, today);
  const liquidity = expectLiquidity(plan, expenses, goals, income);
  const stale = (plan.accounts ?? []).filter((a) => !a.asOf || daysBetween(a.asOf, today) > 90).map((a) => a.name);
  return { today, people, income, expenses, netWorth, liquidity, debts, goals, staleBalances: stale };
}

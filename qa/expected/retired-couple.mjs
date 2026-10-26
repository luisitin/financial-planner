// qa/expected/retired-couple.mjs -- independent recomputation (no app imports) of what the
// pages should show for qa/flows/seed-retired-couple.js on 2026-09-15.
const TODAY = "2026-09-15";
const per = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12, quarterly: 4, annual: 1, once: 0 };
const mo = (amt, p) => amt * per[p] / 12;
const yr = (amt, p) => amt * per[p];
const active = (x) => !(x.startDate && x.startDate > TODAY) && !(x.endDate && x.endDate < TODAY);

// ---- people
const age = (b) => { const [y, m, d] = b.split("-").map(Number); const [ty, tm, td] = TODAY.split("-").map(Number); let a = ty - y; if (tm < m || (tm === m && td < d)) a--; return a; };
const ruth = { age: age("1954-03-10"), ret: 62, end: 100 }, sam = { age: age("1957-06-20"), ret: 70, end: 90 };
const people = {
  ruthAge: ruth.age, samAge: sam.age,
  ruthRetired: ruth.age >= ruth.ret, samYearsToRetire: Math.max(0, sam.ret - sam.age), samRetireYear: 1957 + sam.ret,
  horizonYears: Math.max(ruth.end - ruth.age, sam.end - sam.age),
};

// ---- income
const inc = [
  { n: "ss", amt: 2100, p: "monthly", g: 0, who: "Ruth" },
  { n: "pen", amt: 750, p: "semimonthly", g: 0, who: "Sam" },
  { n: "div", amt: 1200, p: "quarterly", g: 0, who: "Household" },
  { n: "rent", amt: 2000, p: "monthly", g: 0.02, who: "Sam" },
  { n: "inh", amt: 15000, p: "once", g: 0, who: "Ruth" },
  { n: "old", amt: 6000, p: "monthly", g: 0, who: "Sam", endDate: "2025-12-31" },
  { n: "next", amt: 900, p: "monthly", g: 0, who: "Ruth", startDate: "2027-01-01" },
].filter(active);
const income = {
  monthly: inc.reduce((s, x) => s + mo(x.amt, x.p), 0),
  yearly: inc.reduce((s, x) => s + yr(x.amt, x.p), 0),
  nextYear: inc.reduce((s, x) => s + yr(x.amt, x.p) * (1 + x.g), 0),
  oneTime: inc.filter((x) => x.p === "once").reduce((s, x) => s + x.amt, 0),
  byPerson: {},
};
for (const x of inc) income.byPerson[x.who] = (income.byPerson[x.who] ?? 0) + mo(x.amt, x.p);
for (const k of Object.keys(income.byPerson)) income.byPerson[k] = { monthly: income.byPerson[k], share: Math.round(100 * income.byPerson[k] / income.monthly) };

// ---- expenses
const exp = [
  { n: "tax", amt: 4800, p: "annual", ess: true },
  { n: "groc", amt: 150, p: "weekly", ess: true },
  { n: "med", amt: 370, p: "monthly", ess: true },
  { n: "util", amt: 210, p: "monthly", ess: true },
  { n: "ins", amt: 1200, p: "quarterly", ess: true },
  { n: "trav", amt: 6000, p: "annual", ess: false },
  { n: "din", amt: 250, p: "monthly", ess: false },
  { n: "gift", amt: 100, p: "monthly", ess: false },
  { n: "roof", amt: 8000, p: "once", ess: false },
  { n: "mort", amt: 1500, p: "monthly", ess: true, endDate: "2024-06-30" },
].filter(active);
const expenses = {
  monthly: exp.reduce((s, x) => s + mo(x.amt, x.p), 0),
  essential: exp.filter((x) => x.ess).reduce((s, x) => s + mo(x.amt, x.p), 0),
  optional: exp.filter((x) => !x.ess).reduce((s, x) => s + mo(x.amt, x.p), 0),
  oneTime: exp.filter((x) => x.p === "once").reduce((s, x) => s + x.amt, 0),
};
expenses.leftOver = income.monthly - expenses.monthly;
expenses.savingsRatePct = Math.round(100 * expenses.leftOver / income.monthly);

// ---- net worth / liquidity
const assets = 8000 + 45000 + 120000 + 310000 + 60000 + 520000 + 12000;
const liabilities = 2300;
const liquidity = { now: 8000 + 45000, week: 120000, later: 310000 + 60000 + 520000 + 12000 };
liquidity.runwayMonths = liquidity.now / expenses.essential;
liquidity.fullRunwayMonths = liquidity.now / expenses.monthly;
liquidity.target = 6 * expenses.essential;
liquidity.gap = Math.max(0, liquidity.target - liquidity.now);

// ---- debt
const r = 0.219 / 12, owed = 2300, pay = 75;
const nper = -Math.log(1 - owed * r / pay) / Math.log(1 + r);
let bal = owed, totInt = 0, n = 0;
while (bal > 0.005 && n < 1000) { n++; const i = bal * r; const p = Math.min(pay, bal + i); bal -= p - i; totInt += i; }
const debt = { owed, interestMonthly: owed * r, months: Math.ceil(nper - 1e-9), scheduleMonths: n, totalInterest: Math.round(totInt * 100) / 100, dtiPct: Math.round(100 * pay / income.monthly), avgRate: 0.219 };

// ---- goals (rate: cash 2% under 3 years)
const monthsBetween = (a, b) => { const [ay, am, ad] = a.split("-").map(Number), [by, bm, bd] = b.split("-").map(Number); let m = (by - ay) * 12 + (bm - am); if (bd < ad) m--; return m; };
const pmtToReach = (rate, n, target, start) => { const g = Math.pow(1 + rate, n); return (target - start * g) * rate / (g - 1); };
const fv = (rate, n, pmt, pv) => { const g = Math.pow(1 + rate, n); return pv * g + pmt * (g - 1) / rate; };
const nTrip = monthsBetween(TODAY, "2027-06-01");
const goals = {
  trip: { monthsLeft: nTrip, needed: pmtToReach(0.02 / 12, nTrip, 12000, 3000), projected: fv(0.02 / 12, nTrip, 500, 3000) },
  totalTarget: 12000 + 20000 + 50000 + 10000,
  totalFunded: Math.min(3000, 12000) + Math.min(20000, 20000) + 0 + 0,
  ghost: { monthsLeft: monthsBetween(TODAY, "2027-03-01") },
};
goals.trip.shortfall = 12000 - goals.trip.projected;
goals.ghost.needed = pmtToReach(0.02 / 12, goals.ghost.monthsLeft, 10000, 0);

console.log(JSON.stringify({ people, income, expenses, netWorth: { assets, liabilities, net: assets - liabilities }, liquidity, debt, goals }, null, 2));

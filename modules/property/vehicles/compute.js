// modules/property/vehicles/compute.js -- PURE. What each car really costs a year: the value it loses, fuel,
// insurance, upkeep, registration and the loan's interest, and so per mile. Then, for one car, keep it, buy a new
// one or lease, over the same years: the money that goes out, less what comes back (a trade-in, the car you
// still own at the end), so the three compare like for like.
import { pmt } from "../../../core/math/finance.js";
import { compute as computeLiabilities } from "../../balance/liabilities/compute.js";
import { countedBalance } from "../../balance/net-worth/compute.js";
import { yearOfPayments } from "../../cashflow/statement/compute.js";

/** Rough averages, to be replaced by your own: an older car loses about 12% of its value a year; a new one about 20% in the first year and 15% a year after; upkeep on a car you keep rises about 10% a year. */
export const DEFAULTS = {
  car: { milesYear: 12000, mpg: 28, fuelPrice: 3.5, insuranceYear: 1500, maintenanceYear: 900, registrationYear: 200, loss: 0.12 },
  compare: { years: 5, newPrice: 35000, newSalesTax: 0.06, newMpg: 32, newRate: 0.07, newTermMonths: 60, newDown: 0, newInsuranceShare: 1.25, newMaintenanceYear: 500, leaseMonthly: 450, leaseDue: 3000, leaseMonths: 36, leaseMiles: 12000, leaseExcess: 0.25, upkeepRise: 0.10 },
  newLoss: [0.20, 0.15],
};

const num = (v, d) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? d : Number(v));

/** A car's value after `years`: a new one loses `first` in year one and `after` a year from then; a used one `loss` every year. */
export function valueAfter(value, years, { first = null, after, loss }) {
  if (first === null) return value * Math.pow(1 - loss, years);
  if (years <= 0) return value;
  return value * (1 - first) * Math.pow(1 - after, Math.max(0, years - 1));
}

/** One car's year: { lines: [{ key, label, amount }], total, perMile, monthly }. */
export function yearCost(car, loan) {
  const c = { ...DEFAULTS.car, ...Object.fromEntries(Object.entries(car).filter(([, v]) => v !== null && v !== undefined && v !== "")) };
  const miles = num(c.milesYear, 0), value = num(c.value, 0);
  const pay = loan ? yearOfPayments(loan.balance, loan.rate, loan.payment) : { interest: 0 };
  const lines = [
    { key: "loss", label: "Value it loses", amount: value * num(c.loss, DEFAULTS.car.loss) },
    { key: "fuel", label: c.electric ? "Charging" : "Fuel", amount: c.electric ? miles * num(c.kwhPerMile, 0.3) * num(c.kwhPrice, 0.17) : num(c.mpg, 0) > 0 ? miles / num(c.mpg) * num(c.fuelPrice, 0) : 0 },
    { key: "insurance", label: "Insurance", amount: num(c.insuranceYear, 0) },
    { key: "maintenance", label: "Upkeep and repairs", amount: num(c.maintenanceYear, 0) },
    { key: "registration", label: "Registration and fees", amount: num(c.registrationYear, 0) },
    { key: "interest", label: "Loan interest", amount: pay.interest },
  ].filter((l) => l.amount > 0.5);
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return { lines, total, monthly: total / 12, perMile: miles > 0 ? total / miles : null };
}

/** Keep, buy new or lease over `years` (whole years): { years, tradeIn, loanLeft, newPayment, financed, options: [{ id, label, out (money paid), back (what you own at the end, less any loan), cost (out − back), monthly, endValue, owedAtEnd, terms }] }. */
export function compare(car, loan, x) {
  const c = { ...DEFAULTS.car, ...Object.fromEntries(Object.entries(car).filter(([, v]) => v !== null && v !== undefined && v !== "")) };
  const years = Math.max(1, Math.round(num(x.years, 5))), months = years * 12;
  const miles = num(c.milesYear, 0), fuel = (mpg) => (c.electric ? miles * num(c.kwhPerMile, 0.3) * num(c.kwhPrice, 0.17) : mpg > 0 ? miles / mpg * num(c.fuelPrice, 0) : 0);
  const value = num(c.value, 0), ins = num(c.insuranceYear, 0), reg = num(c.registrationYear, 0), upkeep = num(c.maintenanceYear, 0);
  // the old loan: kept, its payments run on; replaced, it is paid off from the trade-in
  const loanLeft = loan?.balance ?? 0;
  let loanPaid = 0;
  if (loan) { let b = loan.balance; for (let m = 0; m < months && b > 0.005; m++) { const i = b * loan.rate / 12, p = Math.min(loan.payment, b + i); loanPaid += p; b = b + i - p; } }
  // keep: running costs with upkeep rising, the loan's payments; the car is still yours at the end
  let keepOut = loanPaid;
  for (let t = 0; t < years; t++) keepOut += fuel(num(c.mpg, 0)) + ins + reg + upkeep * Math.pow(1 + x.upkeepRise, t);
  const keepEnd = valueAfter(value, years, { loss: num(c.loss, DEFAULTS.car.loss) });
  // buy new: the trade-in pays the old loan off first; the rest goes down on the new car, with any cash down
  const price = x.newPrice * (1 + x.newSalesTax);
  const tradeIn = value - loanLeft;
  const financed = Math.max(0, price - Math.max(0, tradeIn) - x.newDown);
  const payment = financed > 0 ? (x.newRate > 0 ? pmt(x.newRate / 12, x.newTermMonths, financed) : financed / x.newTermMonths) : 0;
  let buyOut = x.newDown + Math.max(0, -tradeIn) + payment * Math.min(months, x.newTermMonths);
  for (let t = 0; t < years; t++) buyOut += fuel(x.newMpg) + ins * x.newInsuranceShare + reg + x.newMaintenanceYear;
  const buyEnd = valueAfter(x.newPrice, years, { first: DEFAULTS.newLoss[0], after: DEFAULTS.newLoss[1] });
  let owedAtEnd = 0;
  if (financed > 0 && months < x.newTermMonths) { let b = financed; for (let m = 0; m < months; m++) b = b * (1 + x.newRate / 12) - payment; owedAtEnd = Math.max(0, b); }
  // lease: due at signing each term, the payments, miles over the allowance; nothing owned at the end
  const terms = Math.ceil(months / x.leaseMonths);
  let leaseOut = Math.max(0, -tradeIn) + x.leaseDue * terms + x.leaseMonthly * months + Math.max(0, miles - x.leaseMiles) * years * x.leaseExcess;
  for (let t = 0; t < years; t++) leaseOut += fuel(x.newMpg) + ins * x.newInsuranceShare + reg + x.newMaintenanceYear * 0.5;
  const row = (id, label, out, back, extra) => ({ id, label, out, back, cost: out - back, monthly: (out - back) / months, ...extra });
  return {
    years, tradeIn, loanLeft, newPayment: payment, financed,
    options: [
      row("keep", "Keep it", keepOut, keepEnd, { endValue: keepEnd, owedAtEnd: 0 }),
      row("buy", "Buy a new one", buyOut, buyEnd - owedAtEnd, { endValue: buyEnd, owedAtEnd }),
      row("lease", "Lease a new one", leaseOut, 0, { endValue: 0, owedAtEnd: 0, terms }),
    ],
  };
}

/**
 * compute(plan, { today }) -> {
 *   ready, cars: [{ id, accountId, name, value, details (the stored entry), loan, year: yearCost }], total (a year, every car), monthly,
 *   chosen (the car compared), comparison: compare(...) | null, inputs (the comparison's), best
 * }
 */
export function compute(plan, params = {}) {
  const today = params.today ?? null;
  const accounts = plan.accounts ?? [];
  const entries = (plan.property ?? []).filter((x) => x.kind === "vehicle");
  const li = computeLiabilities(plan, { today });
  const loanOf = (id) => { const r = id ? li.rows.find((x) => x.id === id) : null; return r && r.owed > 0 ? { name: r.name, balance: r.owed, rate: r.rate ?? 0, payment: r.payment || 0 } : null; };
  // every vehicle account, with its details if any; plus entries without an account
  const cars = [
    ...accounts.filter((a) => a.type === "vehicle").map((a) => { const e = entries.find((x) => x.accountId === a.id) ?? {}; return { id: e.id ?? null, accountId: a.id, name: e.name || a.name, value: countedBalance(a), details: e, loanAccountId: e.loanAccountId ?? null }; }),
    ...entries.filter((e) => !e.accountId || !accounts.some((a) => a.id === e.accountId)).map((e) => ({ id: e.id, accountId: null, name: e.name || "Car", value: num(e.value, 0), details: e, loanAccountId: e.loanAccountId ?? null })),
  ].map((c) => { const loan = loanOf(c.loanAccountId); return { ...c, loan, year: yearCost({ ...c.details, value: c.value }, loan) }; });
  if (!cars.length) return { ready: false, cars: [] };
  const s = plan.whatIfs?.vehicles ?? {};
  const x = Object.fromEntries(Object.entries(DEFAULTS.compare).map(([k, v]) => [k, num(s[k], v)]));
  const chosen = cars.find((c) => (c.accountId ?? c.id) === s.car) ?? cars[0];
  const comparison = compare({ ...chosen.details, value: chosen.value }, chosen.loan, x);
  const best = comparison.options.reduce((a, o) => (o.cost < a.cost - 1 ? o : a)).id;
  const total = cars.reduce((t, c) => t + c.year.total, 0);
  return { ready: true, cars, total, monthly: total / 12, chosen: chosen.accountId ?? chosen.id, comparison, inputs: x, best };
}

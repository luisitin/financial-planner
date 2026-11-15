// modules/property/vehicles/compute.js -- PURE. What each car really costs a year: the value it loses, fuel,
// insurance, upkeep, registration and the loan's interest, and so per mile. Then, for one car, keep it, buy a new
// one or lease, over the same years: the money that goes out, less what comes back (a trade-in, the car you
// still own at the end), so the three compare like for like.
import { pmt } from "../../../core/math/finance.js";
import { compute as computeLiabilities } from "../../balance/liabilities/compute.js";
import { countedBalance } from "../../balance/net-worth/compute.js";
import { yearOfPayments } from "../../cashflow/statement/compute.js";
// the sourced table behind our guess for a new-car loan's rate (data only: docs/CONVENTIONS.md "Guesses"; README "Our guess in
// the rate box")
import { T as DEBTS } from "../../overview/guesses/data/debts.js";

/** Rough averages, to be replaced by your own: an older car loses about 12% of its value a year; a new one about 20% in the first year and 15% a year after; upkeep on a car you keep rises about 10% a year. */
export const DEFAULTS = {
  car: { milesYear: 12000, mpg: 28, fuelPrice: 3.5, insuranceYear: 1500, maintenanceYear: 900, registrationYear: 200, loss: 0.12 },
  compare: { years: 5, newPrice: 35000, newSalesTax: 0.06, newMpg: 32, newRate: 0.07, newTermMonths: 60, newDown: 0, newInsuranceShare: 1.25, newMaintenanceYear: 500, leaseMonthly: 450, leaseDue: 3000, leaseMonths: 36, leaseMiles: 12000, leaseExcess: 0.25, upkeepRise: 0.10 },
  newLoss: [0.20, 0.15],
};

const num = (v, d) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? d : Number(v));
/**
 * The comparison's box that can show our guess in gray while it is empty (smart guesses C9, spec 12.1 "K3 previews"): the new
 * car's loan rate, the estimator `property/vehicles:newRate` below. The page asks for it (ctx.guess) and passes it in
 * `params.previews`; it is counted only while the box is empty and is never saved. Without `params.previews` the page works
 * exactly as before (DEFAULTS.compare).
 */
export const PREVIEWED = ["newRate"];

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

/** Keep, buy new or lease over `years` (whole years): { years, tradeIn, loanLeft, oldOwedAtEnd, newPayment, financed, cashBack, leaseCredit, options: [{ id, label, out (money paid), back (what you own at the end, less any loan), cost (out − back), monthly, endValue, owedAtEnd, terms }] }. */
export function compare(car, loan, x) {
  const c = { ...DEFAULTS.car, ...Object.fromEntries(Object.entries(car).filter(([, v]) => v !== null && v !== undefined && v !== "")) };
  const years = Math.max(1, Math.round(num(x.years, 5))), months = years * 12;
  const miles = num(c.milesYear, 0), fuel = (mpg) => (c.electric ? miles * num(c.kwhPerMile, 0.3) * num(c.kwhPrice, 0.17) : mpg > 0 ? miles / mpg * num(c.fuelPrice, 0) : 0);
  const value = num(c.value, 0), ins = num(c.insuranceYear, 0), reg = num(c.registrationYear, 0), upkeep = num(c.maintenanceYear, 0);
  // the old loan: kept, its payments run on; replaced, it is paid off from the trade-in
  const loanLeft = loan?.balance ?? 0;
  let loanPaid = 0, oldOwedAtEnd = 0;
  if (loan) { let b = loan.balance; for (let m = 0; m < months && b > 0.005; m++) { const i = b * loan.rate / 12, p = Math.min(loan.payment, b + i); loanPaid += p; b = b + i - p; } oldOwedAtEnd = b > 0.005 ? b : 0; }
  // keep: fuel, insurance and registration at today's prices, upkeep rising as the car ages, the loan's payments; the car is
  // still yours at the end, less what its loan still owes then (buy and lease pay that loan off at the start, so like for like)
  let keepOut = loanPaid;
  for (let t = 0; t < years; t++) keepOut += fuel(num(c.mpg, 0)) + ins + reg + upkeep * Math.pow(1 + x.upkeepRise, t);
  const keepEnd = valueAfter(value, years, { loss: num(c.loss, DEFAULTS.car.loss) });
  // buy new: the trade-in pays the old loan off first; the rest goes down on the new car, with any cash down
  const price = x.newPrice * (1 + x.newSalesTax);
  const tradeIn = value - loanLeft;
  const financed = Math.max(0, price - Math.max(0, tradeIn) - x.newDown);
  // a trade-in (with any cash down) worth more than the new car: the rest comes back as cash, as the lease credits it all
  const cashBack = Math.max(0, Math.max(0, tradeIn) + x.newDown - price);
  const payment = financed > 0 ? (x.newRate > 0 ? pmt(x.newRate / 12, x.newTermMonths, financed) : financed / x.newTermMonths) : 0;
  let buyOut = x.newDown + Math.max(0, -tradeIn) - cashBack + payment * Math.min(months, x.newTermMonths);
  for (let t = 0; t < years; t++) buyOut += fuel(x.newMpg) + ins * x.newInsuranceShare + reg + x.newMaintenanceYear;
  const buyEnd = valueAfter(x.newPrice, years, { first: DEFAULTS.newLoss[0], after: DEFAULTS.newLoss[1] });
  let owedAtEnd = 0;
  if (financed > 0 && months < x.newTermMonths) { let b = financed; for (let m = 0; m < months; m++) b = b * (1 + x.newRate / 12) - payment; owedAtEnd = Math.max(0, b); }
  // lease: the old car goes at the start, so its equity comes back as cash (a negative trade-in is paid off); due at signing
  // each term, the payments, miles over the allowance; nothing owned at the end. A new car's running costs are at today's prices.
  const terms = Math.ceil(months / x.leaseMonths), leaseCredit = Math.max(0, tradeIn);
  let leaseOut = Math.max(0, -tradeIn) - leaseCredit + x.leaseDue * terms + x.leaseMonthly * months + Math.max(0, miles - x.leaseMiles) * years * x.leaseExcess;
  for (let t = 0; t < years; t++) leaseOut += fuel(x.newMpg) + ins * x.newInsuranceShare + reg + x.newMaintenanceYear * 0.5;
  const row = (id, label, out, back, extra) => ({ id, label, out, back, cost: out - back, monthly: (out - back) / months, ...extra });
  return {
    years, tradeIn, loanLeft, oldOwedAtEnd, newPayment: payment, financed, cashBack, leaseCredit,
    options: [
      row("keep", "Keep it", keepOut, keepEnd - oldOwedAtEnd, { endValue: keepEnd, owedAtEnd: oldOwedAtEnd }),
      row("buy", "Buy a new one", buyOut, buyEnd - owedAtEnd, { endValue: buyEnd, owedAtEnd }),
      row("lease", "Lease a new one", leaseOut, 0, { endValue: 0, owedAtEnd: 0, terms }),
    ],
  };
}

/**
 * compute(plan, { today, previews? }) -> {
 *   ready, cars: [{ id, accountId, name, value, details (the stored entry), loan, year: yearCost }], total (a year, every car), monthly,
 *   chosen (the car compared), comparison: compare(...) | null, inputs (the comparison's), best,
 *   previewed: the PREVIEWED keys whose gray figure is counted (only when params.previews is given)
 * }
 * params.previews: { newRate? } our guess (a number) for a comparison box the person left empty
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
  // our gray figure (the page's own preview): only for a box left empty, only when the page passes it
  const pv = params.previews && typeof params.previews === "object" ? params.previews : null;
  const previewed = [];
  if (pv) for (const k of PREVIEWED) if (num(s[k], null) === null && typeof pv[k] === "number" && Number.isFinite(pv[k])) { x[k] = pv[k]; previewed.push(k); }
  const chosen = cars.find((c) => (c.accountId ?? c.id) === s.car) ?? cars[0];
  const comparison = compare({ ...chosen.details, value: chosen.value }, chosen.loan, x);
  const best = comparison.options.reduce((a, o) => (o.cost < a.cost - 1 ? o : a)).id;
  const total = cars.reduce((t, c) => t + c.year.total, 0);
  return { ready: true, cars, total, monthly: total / 12, chosen: chosen.accountId ?? chosen.id, comparison, inputs: x, best, ...(pv ? { previewed } : {}) };
}

// ---------------------------------------------------------------- our guess for the rate box (smart guesses C9, spec 12.1 K3)
// A population figure from a bundled, sourced table (modules/overview/guesses/data/debts.js, with its publisher and read date),
// the same one the guesses module's debt.car-loan.rate gives a new car's loan. A preview only: the page shows it gray and
// counts it while the box is empty; nothing here writes the plan or makes a guess entry.
const G19 = "auto_personal_rate_fed_g19", NEW_CAR = "New car loan, 72-month (commercial banks)";
/** The rate on a new-car loan: the Federal Reserve's average at banks on a 72-month loan (G.19), as a fraction; null without the table. */
export function newCarRate() {
  const v = DEBTS[G19]?.rows?.[NEW_CAR]?.[0];
  return typeof v === "number" && Number.isFinite(v) ? v / 100 : null;
}
export const estimators = {
  "property/vehicles:newRate": {
    tier: 4, order: 25, label: "Rate on a new-car loan", unit: "rate", weight: "small", page: () => "#/property/vehicles", reads: [],
    fn() {
      const r = newCarRate();
      return r === null ? null : { value: r, sigma: null, measured: false, why: "the average bank rate on a new-car loan", uses: {}, sharperWith: [], tables: [G19] };
    },
  },
};

// ---------------------------------------------------------------- "Electric or gas for your miles" (gap list, next 60, item 56; map V9)
// A calculator one tap away: what a gas car and an electric car each cost a year to run for the miles you drive, and how many
// years the cheaper running cost takes to make up a higher price. Its figures live in whatIfs.vehicles.ev (a calculator's,
// never counted in the plan); compute() above never reads them, so its output is the same with or without them.

/** The boxes, in the form's order (the first five show; the rest are under "More details (optional)"). */
export const EV_KEYS = Object.freeze(["priceGap", "stateCredit", "miles", "gasPrice", "kwhPrice", "mpg", "kwh100", "gasUpkeep", "evUpkeep"]);
/**
 * The labelled examples an empty box counts when the plan has no figure of its own (each said in its box's help as "an
 * example"): the page's own figures for a car's gas price ($3.50 a gallon), a new car's miles per gallon (32) and upkeep
 * ($500 a year), and the charging figures the page counts for an electric car (0.3 kWh a mile = 30 per 100 miles, $0.17 a
 * kWh). The electric car's upkeep is the same $500: no source was read for a difference, so the example favours neither.
 */
export const EV_EXAMPLES = Object.freeze({ gasPrice: DEFAULTS.car.fuelPrice, kwhPrice: 0.17, mpg: DEFAULTS.compare.newMpg, kwh100: 30, gasUpkeep: DEFAULTS.compare.newMaintenanceYear, evUpkeep: DEFAULTS.compare.newMaintenanceYear });
/**
 * The federal credits, read at irs.gov on 2026-11-15: "Credits for new clean vehicles purchased in 2023 or after" and "Used clean
 * vehicle credit" (both "Page Last Reviewed or Updated: 13-Jul-2026"): not available for vehicles acquired after Sept. 30, 2025
 * (acquired: a binding written contract and a payment by then); "Alternative fuel vehicle refueling property credit" (26-May-2026):
 * a home charger only when placed in service from January 1, 2023, to June 30, 2026. None is counted (README).
 */
export const FEDERAL_EV = Object.freeze({ carsAcquiredBy: "2025-09-30", chargersInServiceBy: "2026-06-30", read: "2026-11-15" });
export const FEDERAL_LINE = "Federal tax credits for electric cars ended for cars bought after September 30, 2025, and for home chargers put in after June 30, 2026, so none is counted.";
export const EV_NOTE = "Counts fuel or charging and upkeep at today's prices, in today's dollars; insurance and the value each car loses are left out. Information, not advice.";
/** More years than this to make up a price reads "in more than 30 years". */
export const PAYBACK_MAX = 30;

/** A year of running each: energy (miles / mpg x gas price; miles x kWh per 100 / 100 x electricity price) plus upkeep; saving = gas - electric. */
export function running({ miles, gasPrice, mpg, kwhPrice, kwh100, gasUpkeep, evUpkeep }) {
  const gasEnergy = mpg > 0 ? (miles / mpg) * gasPrice : 0;
  const evEnergy = miles * (kwh100 / 100) * kwhPrice;
  const gas = { energy: gasEnergy, upkeep: gasUpkeep, total: gasEnergy + gasUpkeep };
  const ev = { energy: evEnergy, upkeep: evUpkeep, total: evEnergy + evUpkeep };
  return { gas, ev, saving: gas.total - ev.total };
}

/**
 * payback({ saving, priceGap, stateCredit }) -> { net (what more the electric car costs after the credit; null while no price
 * is typed), years (null when nothing is made up), case }. The federal credit is $0 (FEDERAL_EV).
 * case: "same" (running costs within $1) | "ev-ask" (electric cheaper to run, no price typed) | "ev-back" (it costs more:
 * years = net / saving) | "ev-now" (it costs no more) | "gas" (gas cheaper to run, the electric car no cheaper to buy) |
 * "gas-back" (the electric car cheaper to buy: the gas car makes that up in -net / -saving years).
 */
export function payback({ saving, priceGap = null, stateCredit = 0 }) {
  const net = priceGap === null || priceGap === undefined ? null : priceGap - (stateCredit || 0);
  if (Math.abs(saving) < 1) return { net, years: null, case: "same" };
  if (saving > 0) {
    if (net === null) return { net, years: null, case: "ev-ask" };
    return net > 0 ? { net, years: net / saving, case: "ev-back" } : { net, years: null, case: "ev-now" };
  }
  return net !== null && net < 0 ? { net, years: net / saving, case: "gas-back" } : { net, years: null, case: "gas" };
}

/**
 * evOrGas(plan, d) -> { inputs, from, set, car (the name), differs, gas, ev, saving, net, years, case }, for d = compute(plan) (ready).
 * Each box: what the person typed here (whatIfs.vehicles.ev), else the plan's own figure, else a labelled example; `from[key]`
 * says which ("typed" | "car" (the compared car's own) | "page" (the 12,000 miles the page counts for it) | "figures" (the new
 * car's miles per gallon in The figures) | "example" | "none" (the price: unknown; the state credit: $0)). `set`: boxes typed.
 * `differs`: the new car of the compared car's own kind (gas, or electric when it is) costs $1 or more a year more or less in
 * fuel or charging, or in upkeep, than that car's own card above says (the basis line then says why: these are new cars).
 */
export function evOrGas(plan, d) {
  const s = plan?.whatIfs?.vehicles?.ev && typeof plan.whatIfs.vehicles.ev === "object" ? plan.whatIfs.vehicles.ev : {};
  const car = d.cars.find((c) => (c.accountId ?? c.id) === d.chosen) ?? d.cars[0];
  const e = car?.details ?? {};
  const pos = (v) => { const n = num(v, null); return n !== null && n > 0 ? n : null; };
  const zeroOk = (v) => { const n = num(v, null); return n !== null && n >= 0 ? n : null; };
  const typedOf = { priceGap: num(s.priceGap, null), stateCredit: zeroOk(s.stateCredit), miles: zeroOk(s.miles), gasPrice: zeroOk(s.gasPrice), kwhPrice: zeroOk(s.kwhPrice), mpg: pos(s.mpg), kwh100: pos(s.kwh100), gasUpkeep: zeroOk(s.gasUpkeep), evUpkeep: zeroOk(s.evUpkeep) };
  const plain = !e.electric, w = plan?.whatIfs?.vehicles ?? {};
  const own = {
    miles: zeroOk(e.milesYear) !== null ? [zeroOk(e.milesYear), "car"] : [DEFAULTS.car.milesYear, "page"],
    gasPrice: plain && zeroOk(e.fuelPrice) !== null ? [zeroOk(e.fuelPrice), "car"] : [EV_EXAMPLES.gasPrice, "example"],
    kwhPrice: !plain && zeroOk(e.kwhPrice) !== null ? [zeroOk(e.kwhPrice), "car"] : [EV_EXAMPLES.kwhPrice, "example"],
    mpg: pos(w.newMpg) !== null ? [pos(w.newMpg), "figures"] : [EV_EXAMPLES.mpg, "example"],
    kwh100: !plain && pos(e.kwhPerMile) !== null ? [pos(e.kwhPerMile) * 100, "car"] : [EV_EXAMPLES.kwh100, "example"],
    gasUpkeep: [EV_EXAMPLES.gasUpkeep, "example"],
    evUpkeep: [EV_EXAMPLES.evUpkeep, "example"],
    priceGap: [null, "none"],
    stateCredit: [0, "none"],
  };
  const inputs = {}, from = {}, fallback = {};
  for (const k of EV_KEYS) { fallback[k] = own[k][0]; if (typedOf[k] !== null) { inputs[k] = typedOf[k]; from[k] = "typed"; } else { [inputs[k], from[k]] = own[k]; } }
  const r = running(inputs);
  const p = payback({ saving: r.saving, priceGap: inputs.priceGap, stateCredit: inputs.stateCredit });
  const fellBack = Object.fromEntries(EV_KEYS.map((k) => [k, own[k][1]]));
  const card = Object.fromEntries((car?.year?.lines ?? []).map((l) => [l.key, l.amount]));
  const same = plain ? r.gas : r.ev;
  const differs = !!car && (Math.abs((card.fuel ?? 0) - same.energy) >= 1 || Math.abs((card.maintenance ?? 0) - same.upkeep) >= 1);
  return { inputs, from, fallback, fellBack, set: EV_KEYS.filter((k) => from[k] === "typed").length, car: car?.name ?? "your car", differs, ...r, ...p };
}

/** "within a year" | "in about 7.1 years" (one decimal under 10, whole from 10) | "in more than 30 years". */
export function yearsPhrase(y) {
  if (!(y >= 1)) return "within a year";
  if (y > PAYBACK_MAX) return `in more than ${PAYBACK_MAX} years`;
  const n = y < 10 ? Number(y.toFixed(1)) : Math.round(y);
  return `in about ${n} year${n === 1 ? "" : "s"}`;
}
/** The answer, one written sentence per case (docs/OPTIONAL.md R5). `money` writes an amount ("$5,000"). */
export function evLine(r, money) {
  const s = money(Math.abs(r.saving));
  switch (r.case) {
    case "ev-back": return `The electric car costs ${s} a year less to run, so it makes up the ${money(r.net)} more it costs ${yearsPhrase(r.years)}.`;
    case "ev-now": return `The electric car costs ${s} a year less to run and no more to buy, so it is cheaper from the start.`;
    case "ev-ask": return `The electric car costs ${s} a year less to run. Type how much more it costs to buy to see how long it takes to make that up.`;
    case "gas": return `At these prices the gas car costs ${s} a year less to run, so an electric car that costs more to buy never makes that up.`;
    case "gas-back": return `The electric car costs ${money(-r.net)} less to buy, and the gas car makes that up ${yearsPhrase(r.years)} with its ${s} a year lower running cost.`;
    default: return `At these prices both cost about ${money(r.gas.total)} a year to run, so the one that costs less to buy costs less overall.`;
  }
}
/** A car's name as the help and the basis line say it: "your Family car"; "Bo's truck" (a name that says whose already); "your car". */
export function carPhrase(name) {
  const n = String(name ?? "").trim();
  if (!n || /^(a |an |your )?car$/i.test(n)) return "your car";
  if (/^(the|my|our|your|his|her|their)\s/i.test(n) || /['\u2019]s\b/.test(n)) return n;
  return `your ${n}`;
}
/**
 * The line under the two cars: they are new cars, driven the compared car's miles ("like your Family car"; "like yours" for a
 * car with no name of its own) or the miles typed, that they are not that car's own costs when they differ (`differs`), and
 * whether an example stands in for a box left empty. One written sentence per case (docs/OPTIONAL.md R5).
 */
export function evBasis(r) {
  const m = Number(r.inputs.miles).toLocaleString("en-US"), car = carPhrase(r.car);
  const like = car === "your car" ? "yours" : car;
  const some = ["gasPrice", "kwhPrice", "mpg", "kwh100", "gasUpkeep", "evUpkeep"].some((k) => r.from[k] === "example");
  const kase = `${r.from.miles === "typed" ? "typed" : r.differs ? "car-differs" : "car"}${some ? "-examples" : ""}`;
  switch (kase) {
    case "car-differs-examples": return `Both are new cars driven ${m} miles a year, like ${like}. They are not your own car's costs. Boxes you leave empty use examples: type yours to replace them.`;
    case "car-differs": return `Both are new cars driven ${m} miles a year, like ${like}. They are not your own car's costs.`;
    case "car-examples": return `Both are new cars driven ${m} miles a year, like ${like}. Boxes you leave empty use examples: type yours to replace them.`;
    case "car": return `Both are new cars driven ${m} miles a year, like ${like}.`;
    case "typed-examples": return `Both are new cars driven ${m} miles a year. Boxes you leave empty use examples: type yours to replace them.`;
    default: return `Both are new cars driven ${m} miles a year.`;
  }
}
/** What an empty box counts, in its help line: the plan's own figure or a labelled example. `money2` writes cents ("$0.17"). */
export function evHelp(key, r, { money, money2 }) {
  const v = r.fallback[key], how = r.fellBack[key], car = carPhrase(r.car);
  const n = (x) => Number(x).toLocaleString("en-US", { maximumFractionDigits: 2 });
  switch (key) {
    case "priceGap": return "The difference in price, with a home charger if you need one, for example $5,000. Leave it empty if you do not know yet.";
    case "stateCredit": return "Some states and power companies pay part of an electric car's price, for example $1,000. Left empty, we count none.";
    case "miles": return how === "car" ? `Left empty, we count the ${n(v)} miles you typed for ${car}.` : `Left empty, we count the ${n(v)} miles used for ${car}.`;
    case "gasPrice": return how === "car" ? `Left empty, we count the ${money2(v)} you typed for ${car}.` : `Left empty, we count ${money2(v)}, an example: type what you pay.`;
    case "kwhPrice": return how === "car" ? `On your power bill. Left empty, we count the ${money2(v)} you typed for ${car}.` : `On your power bill. Left empty, we count ${money2(v)}, an example: type what you pay.`;
    case "mpg": return how === "figures" ? `Left empty, we count ${n(v)}, the new car's in The figures.` : `Left empty, we count ${n(v)}, an example: a new car's fuel economy label has its own.`;
    case "kwh100": return how === "car" ? `Left empty, we count the ${n(v)} you typed for ${car}.` : `Left empty, we count ${n(v)}, an example: a new car's fuel economy label has its own.`;
    case "gasUpkeep": return `Left empty, we count ${money(v)} a year, an example.`;
    case "evUpkeep": return `Left empty, we count ${money(v)} a year, an example, the same as gas.`;
    default: return "";
  }
}

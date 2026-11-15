import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, yearCost, compare, valueAfter, DEFAULTS } from "./compute.js";
import { pmt } from "../../../core/math/finance.js";
import { yearOfPayments } from "../../cashflow/statement/compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";

const TODAY = "2026-10-30";
const near = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);
const SEDAN = { milesYear: 11000, mpg: 27, fuelPrice: 3.4, insuranceYear: 1300, maintenanceYear: 1400, registrationYear: 180, loss: 0.12 };
const withCar = () => {
  const p = familyPlan(TODAY);
  p.accounts.push({ id: "a-veh", name: "Sedan", type: "vehicle", balance: 9000, history: [] });
  p.property = [{ id: "v1", kind: "vehicle", accountId: "a-veh", ...SEDAN, loanAccountId: "a-car" }];
  return p;
};

test("valueAfter: a used car at a steady rate; a new one steeper in its first year", () => {
  near(valueAfter(10000, 2, { loss: 0.1 }), 8100);
  near(valueAfter(40000, 1, { first: 0.2, after: 0.15 }), 32000);
  near(valueAfter(40000, 3, { first: 0.2, after: 0.15 }), 40000 * 0.8 * 0.85 * 0.85);
  assert.equal(valueAfter(40000, 0, { first: 0.2, after: 0.15 }), 40000);
});

test("yearCost: every line by hand, and per mile", () => {
  const loan = { balance: 14200, rate: 0.059, payment: 410 };
  const y = yearCost({ ...SEDAN, value: 9000 }, loan);
  const get = (k) => y.lines.find((l) => l.key === k).amount;
  near(get("loss"), 1080); near(get("fuel"), 11000 / 27 * 3.4); near(get("interest"), yearOfPayments(14200, 0.059, 410).interest);
  near(y.total, 1080 + 11000 / 27 * 3.4 + 1300 + 1400 + 180 + get("interest"));
  near(y.perMile, y.total / 11000); near(y.monthly, y.total / 12);
  const ev = yearCost({ value: 20000, electric: true, milesYear: 10000, kwhPerMile: 0.3, kwhPrice: 0.2, insuranceYear: 0, maintenanceYear: 0, registrationYear: 0 }, null);
  near(ev.lines.find((l) => l.key === "fuel").amount, 600);
});

test("no cars: not ready", () => {
  assert.equal(compute(familyPlan(TODAY), { today: TODAY }).ready, false);
});

test("the family's sedan: its loan from Debts; keep, buy and lease over five years", () => {
  const d = compute(withCar(), { today: TODAY });
  assert.equal(d.cars.length, 1); assert.equal(d.cars[0].loan.balance, 14200);
  const c = d.comparison, x = d.inputs;
  assert.equal(c.years, 5); near(c.tradeIn, 9000 - 14200);
  const price = x.newPrice * (1 + x.newSalesTax);
  near(c.financed, price - x.newDown); near(c.newPayment, pmt(x.newRate / 12, x.newTermMonths, c.financed));
  const keep = c.options.find((o) => o.id === "keep"), buy = c.options.find((o) => o.id === "buy"), lease = c.options.find((o) => o.id === "lease");
  near(keep.back, 9000 * Math.pow(0.88, 5)); near(buy.back, valueAfter(x.newPrice, 5, { first: 0.2, after: 0.15 }));
  assert.equal(lease.back, 0); assert.equal(lease.terms, 2);
  // the keep side by hand: loan payments for 5 years (it is paid off sooner), running costs with upkeep rising
  let b = 14200, paid = 0; for (let m = 0; m < 60 && b > 0.005; m++) { const i = b * 0.059 / 12, p = Math.min(410, b + i); paid += p; b = b + i - p; }
  let run = 0; for (let t = 0; t < 5; t++) run += 11000 / 27 * 3.4 + 1300 + 180 + 1400 * Math.pow(1.1, t);
  near(keep.out, paid + run);
  for (const o of c.options) { near(o.cost, o.out - o.back); near(o.monthly, o.cost / 60); }
  assert.equal(d.best, "keep");
});

test("a short comparison leaves part of the new loan owed, taken off what the new car is worth", () => {
  const p = withCar(); p.whatIfs = { vehicles: { years: 2 } };
  const buy = compute(p, { today: TODAY }).comparison.options.find((o) => o.id === "buy");
  assert.ok(buy.owedAtEnd > 0); near(buy.back, buy.endValue - buy.owedAtEnd);
});

test("a car with no account, typed on its own", () => {
  const p = familyPlan(TODAY); p.property = [{ id: "v2", kind: "vehicle", name: "Old truck", value: 6000, ...SEDAN }];
  const d = compute(p, { today: TODAY });
  assert.equal(d.cars[0].name, "Old truck"); assert.equal(d.cars[0].value, 6000); assert.equal(d.cars[0].loan, null);
});

test("keep: what the old loan still owes at the end comes off the car's value; the lease credits the car's equity", () => {
  // the sedan, worth 9,000, with a 0% loan of 6,000 at 250 a month, over 1 year: 3,000 paid, 3,000 still owed at the end
  const x = { ...DEFAULTS.compare, years: 1 };
  const c = compare({ ...SEDAN, value: 9000 }, { balance: 6000, rate: 0, payment: 250 }, x);
  const keep = c.options[0];
  near(c.oldOwedAtEnd, 3000); near(keep.owedAtEnd, 3000); near(keep.back, 9000 * 0.88 - 3000); near(keep.cost, keep.out - keep.back);
  // buy and lease pay that loan off from the trade-in at the start: 9,000 - 6,000 = 3,000 of equity, credited on the lease
  near(c.tradeIn, 3000); near(c.leaseCredit, 3000);
  const lease = c.options[2];
  // one 36-month lease started, 12 payments, 11,000 miles inside the 12,000 allowed; a new car's running costs at today's prices
  const run = 11000 / x.newMpg * 3.4 + 1300 * x.newInsuranceShare + 180 + x.newMaintenanceYear * 0.5;
  near(lease.out, x.leaseDue + x.leaseMonthly * 12 + run - 3000);
  // worth less than its loan: nothing to credit, the shortfall is paid at the start instead
  const under = compare({ ...SEDAN, value: 5000 }, { balance: 6000, rate: 0, payment: 250 }, x);
  near(under.leaseCredit, 0); near(under.options[2].out, 1000 + x.leaseDue + x.leaseMonthly * 12 + run);
});

test("buy: a trade-in worth more than the new car comes back as cash (the lease credits all of it too)", () => {
  // a 40,000 car with no loan against a 20,000 new car with 6% tax (21,200): nothing to borrow, 18,800 back
  const x = { ...DEFAULTS.compare, years: 1, newPrice: 20000, newSalesTax: 0.06, newDown: 0 };
  const c = compare({ ...SEDAN, value: 40000 }, null, x);
  const run = 11000 / x.newMpg * 3.4 + 1300 * x.newInsuranceShare + 180 + x.newMaintenanceYear;
  near(c.financed, 0); near(c.cashBack, 18800); near(c.options[1].out, -18800 + run); near(c.leaseCredit, 40000);
});

test("buy and lease: a new car's running costs are flat over the years; only the kept car's upkeep rises", () => {
  const x = { ...DEFAULTS.compare, years: 3, newPrice: 30000, newSalesTax: 0, newDown: 30000 };
  const c = compare({ ...SEDAN, value: 0 }, null, x);
  const buy = c.options[1], run = 11000 / x.newMpg * 3.4 + 1300 * x.newInsuranceShare + 180 + x.newMaintenanceYear;
  near(c.financed, 0); near(buy.out, 30000 + 3 * run);
  let keepRun = 0; for (let t = 0; t < 3; t++) keepRun += 11000 / 27 * 3.4 + 1300 + 180 + 1400 * Math.pow(1.1, t);
  near(c.options[0].out, keepRun);
});

// ---- our guess in the new-car loan's rate box (smart guesses C9, spec 12.1 K3): a gray figure counted while the box is empty, never saved
import { PREVIEWED, estimators, newCarRate } from "./compute.js";
import { estimate, checkEstimators } from "../../../core/estimate/index.js";
import { estimators as GUESSES, TABLES } from "../../overview/guesses/compute.js";
import { T as DEBTS_T } from "../../overview/guesses/data/debts.js";
import { renterDebtPlan } from "../../../qa/fixtures/renter-debt-plan.mjs";
import { retiredCouplePlan } from "../../../qa/fixtures/retired-couple-plan.mjs";
import { migrate, emptyPlan } from "../../../core/schema/migrate.js";
import manifest from "./module.js";

const T14 = "2026-11-14";
const OPTS = { estimators: { ...GUESSES, ...estimators }, tables: TABLES, today: T14 };

test("C9 property/vehicles:newRate: the Federal Reserve's bank rate on a 72-month new-car loan (G.19), the figure Debts guesses for a new car", () => {
  assert.deepEqual(PREVIEWED, ["newRate"]);
  assert.deepEqual(checkEstimators(OPTS.estimators), []);
  assert.equal(manifest.estimators, estimators, "the manifest hands them to the shell (core/app.js merges them)");
  assert.equal(DEBTS_T.auto_personal_rate_fed_g19.rows["New car loan, 72-month (commercial banks)"][0], 7.17);
  near(newCarRate(), 0.0717, 1e-12);
  const e = estimate(renterDebtPlan(), "property/vehicles:newRate", OPTS);
  assert.deepEqual([e.value, e.why, e.tables], [0.072, "the average bank rate on a new-car loan", ["auto_personal_rate_fed_g19"]], "to a tenth of a point (R11)");
  assert.ok(e.why.length <= 70);
  for (const id of e.tables) assert.ok(TABLES[id], id);
  const eur = renterDebtPlan(); eur.meta.currency = "EUR";
  assert.equal(estimate(eur, "property/vehicles:newRate", OPTS), null, "no U.S. figure for a plan in another currency");
  const away = renterDebtPlan(); away.guide = { ...(away.guide ?? {}), setup: { ...(away.guide?.setup ?? {}), outsideUS: true } };
  assert.equal(estimate(away, "property/vehicles:newRate", OPTS), null, "nor for someone outside the U.S.");
});
test("C9 compute: without previews nothing changes; with them the gray rate counts only while the box is empty", () => {
  const withRate = (r) => { const p = withCar(); p.whatIfs = { vehicles: { newRate: r } }; return p; };
  for (const p of [withCar(), familyPlan(TODAY), renterDebtPlan(), retiredCouplePlan(TODAY), migrate(emptyPlan()), withRate(null)]) {
    const a = compute(p, { today: TODAY });
    assert.equal(a.previewed, undefined, "no new key without previews");
    assert.deepEqual(compute(p, { today: TODAY, previews: null }), a);
    if (!a.ready) continue;
    const { previewed, ...b } = compute(p, { today: TODAY, previews: {} });
    assert.deepEqual(previewed, []); assert.deepEqual(b, a, "an empty previews object changes nothing");
  }
  const blank = compute(withRate(null), { today: TODAY, previews: { newRate: 0.072 } });
  assert.deepEqual(blank.previewed, ["newRate"]); assert.equal(blank.inputs.newRate, 0.072);
  near(blank.comparison.newPayment, pmt(0.072 / 12, DEFAULTS.compare.newTermMonths, blank.comparison.financed));
  const typed = compute(withRate(0.05), { today: TODAY, previews: { newRate: 0.072 } });
  assert.deepEqual(typed.previewed, [], "a typed rate is the person's"); assert.equal(typed.inputs.newRate, 0.05);
  assert.deepEqual(compute(withRate(null), { today: TODAY, previews: { newRate: NaN } }).previewed, []);
});

// ---- the page (drawn on the stand-in DOM, with ctx.guess as the shell gives it)
async function drawCars(plan0, { guess = true } = {}) {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js"); const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  const p = migrate(structuredClone(plan0)); const saved = []; const root = new FakeElement("main");
  const ctx = { ui: { ...ui, uid: () => "new-car" }, fmt: { ...fmt, today: () => T14 }, plan: p, route: { rest: [], query: {} }, module: { group: "property", id: "vehicles" }, computeOf: () => null,
    store: { get: () => p, update: (fn) => { const d = structuredClone(p); fn(d); saved.push(d); } },
    ...(guess ? { guess: (k, o = {}) => estimate(p, k, { ...OPTS, ...o }) } : {}) };
  render(root, ctx);
  return { root, saved, textOf, plan: p };
}
const boxOf = (root, name) => root.querySelector(`[name="${name}"]`);
const openParts = (root) => Object.fromEntries(root.querySelectorAll("details").filter((x) => x.dataset.part).map((x) => [x.dataset.part, x.hasAttribute("open")]));
const outsideShut = (el) => { for (let a = el.parentNode; a; a = a.parentNode) if (a.tagName === "DETAILS" && !a.hasAttribute("open")) return false; return true; };
const buttonOf = (root, words) => root.querySelectorAll("button").find((b) => b.textContent === words);
const statusText = (root, textOf) => { const el = root.querySelectorAll("span").find((x) => x.classList.contains("fold-status")); return el ? textOf(el).trim() : null; };

test("C9 the page: the empty rate box shows our gray figure, the comparison counts it and says so, and opening writes nothing", async () => {
  const { root, saved, textOf } = await drawCars(renterDebtPlan());
  assert.equal(saved.length, 0, "opening the page writes nothing");
  assert.equal(boxOf(root, "newRate").value ?? "", "");
  assert.equal(boxOf(root, "newRate").getAttribute("placeholder"), "7.2");
  for (const k of ["years", "newPrice", "newTermMonths", "leaseMonthly", "newSalesTax"]) assert.equal(boxOf(root, k).value ?? "", "", `${k}: no example in a box`);
  const t = textOf(root);
  assert.match(t, /Our guess: the average bank rate on a new-car loan\./);
  assert.match(t, /Left empty, we count 60 months\./);
  assert.match(t, /Left empty, we count \$35,000\./);
  const line = root.querySelectorAll("div").find((x) => /borrowed for 60 months at 7\.2% \(our guess\)\./.test(textOf(x)));
  assert.ok(line && outsideShut(line), "the comparison says the rate is our guess, outside any fold (R9 #5)");
  assert.deepEqual(openParts(root), { figures: false, ev: false }, "a list page: the comparison's figures wait folded");
  assert.equal(statusText(root, textOf), "our guess", "the shut part names no price beside \"our guess\": the stated $35,000 is not ours");
  assert.equal(root.querySelectorAll("details").filter((x) => !x.dataset.part && !x.className.includes("form-more")).length, 0, "no fold by hand (R10)");
});
test("C9 S11 (R17): Compare with the rate left empty saves no guess, and only The figures stays open", async () => {
  const a = await drawCars(renterDebtPlan());
  boxOf(a.root, "newPrice").value = "30000";
  boxOf(a.root, "newPrice").closest("form").dispatch("submit");
  assert.equal(a.saved.length, 1);
  const w = a.saved[0].whatIfs.vehicles;
  assert.equal(w.newPrice, 30000);
  assert.deepEqual([w.newRate, w.newTermMonths, w.years, w.leaseMonthly], [null, null, null, null], "an empty box saves nothing: our figure is never written");
  assert.equal(a.saved[0].guesses, undefined, "no guess entry either");
  assert.deepEqual(a.saved[0].property, a.plan.property, "the cars are untouched");
  const b = await drawCars(a.saved[0]);
  assert.deepEqual(openParts(b.root), { figures: true, ev: false }, "the part just saved stays open, no other moves");
  assert.match(b.textOf(b.root), /Saved\. Cheapest over 5 years: keep it, \$\d+ a month\./);
  assert.equal(boxOf(b.root, "newRate").getAttribute("placeholder"), "7.2", "reopened: still empty and gray");
  assert.equal(boxOf(b.root, "newPrice").value, "30,000");
  assert.equal(statusText(b.root, b.textOf), "our guess · $30,000", "a price the person typed is named");
  const c = await drawCars(a.saved[0]);
  assert.deepEqual(openParts(c.root), { figures: false, ev: false }, "the next visit opens on the answer, the figures folded");
  boxOf(c.root, "newRate").value = "5.9";
  boxOf(c.root, "newRate").closest("form").dispatch("submit");
  assert.equal(c.saved[0].whatIfs.vehicles.newRate, 0.059);
  const e = await drawCars(c.saved[0]);
  assert.equal(boxOf(e.root, "newRate").value, "5.9");
  assert.equal(boxOf(e.root, "newRate").getAttribute("placeholder") ?? "", "");
  assert.doesNotMatch(e.textOf(e.root), /our guess/i);
});
test("C9 no guesses (another country, or the shell without ctx.guess): the rate box is empty and says what it counts", async () => {
  const eur = renterDebtPlan(); eur.meta.currency = "EUR";
  for (const { root, textOf } of [await drawCars(eur), await drawCars(renterDebtPlan(), { guess: false })]) {
    assert.equal(boxOf(root, "newRate").getAttribute("placeholder"), "");
    assert.match(textOf(root), /Left empty, we count 7% a year\./);
    assert.match(textOf(root), /borrowed for 60 months\. /);
    assert.doesNotMatch(textOf(root), /our guess/i);
  }
});
test("a car's details: open in place with empty boxes, Cancel shuts them, a save writes nothing for an empty box and costs the same", async () => {
  const a = await drawCars(withCar());
  assert.equal(boxOf(a.root, "milesYear"), null, "shut until asked");
  buttonOf(a.root, "Change its details").click();
  assert.equal(a.saved.length, 0, "opening writes nothing");
  assert.equal(boxOf(a.root, "milesYear").value, "11000", "what was saved shows");
  assert.equal(boxOf(a.root, "insuranceYear").value, "1,300");
  const opener = buttonOf(a.root, "Change its details");
  assert.ok(opener, "the button stays above its form (Cancel has it to go back to)");
  assert.equal(opener.getAttribute("aria-expanded"), "true");
  buttonOf(a.root, "Cancel").click();
  assert.equal(boxOf(a.root, "milesYear"), null, "Cancel shuts them");
  assert.equal(opener.getAttribute("aria-expanded"), "false");
  opener.click(); assert.ok(boxOf(a.root, "milesYear"), "a tap opens them again");
  opener.click(); assert.equal(boxOf(a.root, "milesYear"), null, "and a second tap on the button shuts them");
  // another car: its form opens under "+ Add another car", which stays
  buttonOf(a.root, "+ Add another car").click();
  assert.ok(boxOf(a.root, "name") && buttonOf(a.root, "+ Add another car"), "the add form opens under its button");
  assert.equal(a.saved.length, 0, "opening writes nothing");
  // a car with nothing typed yet: every box empty, its help says what it counts, and a save keeps the year's cost
  const p = renterDebtPlan(); const before = compute(p, { today: T14 }).cars[0].year;
  const b = await drawCars(p);
  buttonOf(b.root, "Change its details").click();
  for (const k of ["milesYear", "insuranceYear", "mpg", "fuelPrice", "maintenanceYear", "registrationYear", "loss"]) assert.equal(boxOf(b.root, k).value ?? "", "", `${k}: no example in a box`);
  assert.match(b.textOf(b.root), /Left empty, we count 12,000 miles\./);
  assert.match(b.textOf(b.root), /Left empty, we count 12% of its value a year\./);
  boxOf(b.root, "milesYear").closest("form").dispatch("submit");
  assert.equal(b.saved.length, 1);
  const entry = b.saved[0].property.find((x) => x.kind === "vehicle");
  assert.deepEqual([entry.milesYear, entry.loss, entry.insuranceYear], [null, null, null], "an empty box saves nothing");
  assert.deepEqual(compute(b.saved[0], { today: T14 }).cars[0].year, before, "and the car costs what it did");
});
test("no car yet: the add form is open at five boxes; a car with no value is refused at its box", async () => {
  const { root, saved, textOf } = await drawCars(migrate(emptyPlan()));
  const form = boxOf(root, "value").closest("form");
  const visible = form.all().filter((x) => (x.tagName === "INPUT" || x.tagName === "SELECT") && !x.closest("details"));
  assert.deepEqual(visible.map((x) => x.getAttribute("name")), ["name", "value", "milesYear", "insuranceYear", "loanAccountId"]);
  assert.match(textOf(root), /More details \(optional\)/);
  boxOf(root, "name").value = "Hatchback"; boxOf(root, "value").value = "8000";
  form.dispatch("submit");
  assert.equal(saved.length, 1);
  const car = saved[0].property.find((x) => x.kind === "vehicle");
  assert.deepEqual([car.name, car.value, car.milesYear], ["Hatchback", 8000, null]);
});

// ---- "Electric or gas for your miles" (gap list, next 60, item 56; map V9): running costs, the years to make up a price, the credits
import { EV_KEYS, EV_EXAMPLES, FEDERAL_EV, FEDERAL_LINE, EV_NOTE, PAYBACK_MAX, running, payback, evOrGas, yearsPhrase, evLine, evHelp, evBasis, carPhrase } from "./compute.js";
const $ = (n) => `$${Math.round(n).toLocaleString("en-US")}`;
const $2 = (n) => `$${Number(n).toFixed(2)}`;
const T15 = "2026-11-15";
const withEv = (ev, plan = renterDebtPlan()) => { const p = structuredClone(plan); p.whatIfs = { ...(p.whatIfs ?? {}), vehicles: { ...(p.whatIfs?.vehicles ?? {}), ev } }; return p; };
const evOf = (p) => evOrGas(p, compute(p, { today: T15 }));

test("running costs by hand: 12,000 miles at 32 miles a gallon and $3.50 against 30 kWh per 100 miles at $0.17, $500 of upkeep each", () => {
  const r = running({ miles: 12000, gasPrice: 3.5, mpg: 32, kwhPrice: 0.17, kwh100: 30, gasUpkeep: 500, evUpkeep: 500 });
  near(r.gas.energy, 12000 / 32 * 3.5); near(r.gas.energy, 1312.5);
  near(r.ev.energy, 12000 * 0.30 * 0.17); near(r.ev.energy, 612);
  near(r.gas.total, 1812.5); near(r.ev.total, 1112); near(r.saving, 700.5);
  // the payback: $5,000 more, less a $1,000 state credit, at $700.50 a year
  const p = payback({ saving: r.saving, priceGap: 5000, stateCredit: 1000 });
  assert.equal(p.case, "ev-back"); assert.equal(p.net, 4000); near(p.years, 4000 / 700.5, 1e-12);
  assert.equal(yearsPhrase(p.years), "in about 5.7 years");
  // no federal credit is counted: the net price is the price less the state's credit only
  assert.equal(payback({ saving: 700.5, priceGap: 5000 }).net, 5000);
});

test("the federal credits: ended for cars bought after September 30, 2025 and home chargers put in after June 30, 2026 (irs.gov, read 2026-11-15)", () => {
  assert.deepEqual({ ...FEDERAL_EV }, { carsAcquiredBy: "2025-09-30", chargersInServiceBy: "2026-06-30", read: "2026-11-15" });
  assert.equal(FEDERAL_LINE, "Federal tax credits for electric cars ended for cars bought after September 30, 2025, and for home chargers put in after June 30, 2026, so none is counted.");
  assert.equal(EV_NOTE, "Counts fuel or charging and upkeep at today's prices, in today's dollars; insurance and the value each car loses are left out. Information, not advice.");
});

test("every case of the answer, one written sentence each, and the years in words", () => {
  const r0 = running({ miles: 12000, gasPrice: 3.5, mpg: 32, kwhPrice: 0.17, kwh100: 30, gasUpkeep: 500, evUpkeep: 500 });
  const say = (r, price, credit = 0) => { const p = payback({ saving: r.saving, priceGap: price, stateCredit: credit }); return [p.case, evLine({ ...r, ...p }, $)]; };
  assert.deepEqual(say(r0, 5000), ["ev-back", "The electric car costs $701 a year less to run, so it makes up the $5,000 more it costs in about 7.1 years."]);
  assert.deepEqual(say(r0, 3000, 3000), ["ev-now", "The electric car costs $701 a year less to run and no more to buy, so it is cheaper from the start."]);
  assert.deepEqual(say(r0, null), ["ev-ask", "The electric car costs $701 a year less to run. Type how much more it costs to buy to see how long it takes to make that up."]);
  const dearPower = running({ miles: 8000, gasPrice: 3, mpg: 40, kwhPrice: 0.45, kwh100: 35, gasUpkeep: 500, evUpkeep: 500 });   // gas 600, charging 1,260
  near(dearPower.saving, 600 - 1260);
  assert.deepEqual(say(dearPower, 4000), ["gas", "At these prices the gas car costs $660 a year less to run, so an electric car that costs more to buy never makes that up."]);
  assert.deepEqual(say(dearPower, null), ["gas", "At these prices the gas car costs $660 a year less to run, so an electric car that costs more to buy never makes that up."]);
  assert.deepEqual(say(dearPower, 1000, 3000), ["gas-back", "The electric car costs $2,000 less to buy, and the gas car makes that up in about 3 years with its $660 a year lower running cost."]);
  const even = running({ miles: 10000, gasPrice: 3, mpg: 30, kwhPrice: 0.2, kwh100: 50, gasUpkeep: 500, evUpkeep: 500 });   // 1,000 and 1,000
  assert.deepEqual(say(even, 4000), ["same", "At these prices both cost about $1,500 a year to run, so the one that costs less to buy costs less overall."]);
  assert.equal(yearsPhrase(0.4), "within a year");
  assert.equal(yearsPhrase(1), "in about 1 year");
  assert.equal(yearsPhrase(12.6), "in about 13 years");
  assert.equal(yearsPhrase(30), "in about 30 years");
  assert.equal(yearsPhrase(30.2), `in more than ${PAYBACK_MAX} years`);
  assert.deepEqual(say(r0, 700), ["ev-back", "The electric car costs $701 a year less to run, so it makes up the $700 more it costs within a year."]);
  assert.deepEqual(say(r0, 30000), ["ev-back", "The electric car costs $701 a year less to run, so it makes up the $30,000 more it costs in more than 30 years."]);
});

test("each box counts what was typed here, else the plan's own figure, else a labelled example, and its help says which", () => {
  // Riley's car with nothing typed: the 12,000 miles the page counts, and the examples
  const blank = evOf(renterDebtPlan());
  assert.deepEqual(blank.inputs, { priceGap: null, stateCredit: 0, miles: 12000, gasPrice: 3.5, kwhPrice: 0.17, mpg: 32, kwh100: 30, gasUpkeep: 500, evUpkeep: 500 });
  assert.deepEqual(blank.from, { priceGap: "none", stateCredit: "none", miles: "page", gasPrice: "example", kwhPrice: "example", mpg: "example", kwh100: "example", gasUpkeep: "example", evUpkeep: "example" });
  assert.equal(blank.set, 0); assert.equal(blank.case, "ev-ask"); assert.deepEqual(EV_KEYS, ["priceGap", "stateCredit", "miles", "gasPrice", "kwhPrice", "mpg", "kwh100", "gasUpkeep", "evUpkeep"]);
  assert.deepEqual({ ...EV_EXAMPLES }, { gasPrice: DEFAULTS.car.fuelPrice, kwhPrice: 0.17, mpg: DEFAULTS.compare.newMpg, kwh100: 30, gasUpkeep: DEFAULTS.compare.newMaintenanceYear, evUpkeep: DEFAULTS.compare.newMaintenanceYear });
  const help = (r, k) => evHelp(k, r, { money: $, money2: $2 });
  assert.equal(help(blank, "miles"), "Left empty, we count the 12,000 miles used for your car.");
  assert.equal(help(blank, "gasPrice"), "Left empty, we count $3.50, an example: type what you pay.");
  assert.equal(help(blank, "kwhPrice"), "On your power bill. Left empty, we count $0.17, an example: type what you pay.");
  assert.equal(help(blank, "mpg"), "Left empty, we count 32, an example: a new car's fuel economy label has its own.");
  assert.equal(help(blank, "kwh100"), "Left empty, we count 30, an example: a new car's fuel economy label has its own.");
  assert.equal(help(blank, "gasUpkeep"), "Left empty, we count $500 a year, an example.");
  assert.equal(help(blank, "evUpkeep"), "Left empty, we count $500 a year, an example, the same as gas.");
  assert.equal(help(blank, "priceGap"), "The difference in price, with a home charger if you need one, for example $5,000. Leave it empty if you do not know yet.");
  assert.equal(evBasis(blank), "Both are new cars driven 12,000 miles a year, like yours. They are not your own car's costs. Boxes you leave empty use examples: type yours to replace them.");
  assert.equal(evBasis(evOf(withEv({ gasPrice: 3.2, kwhPrice: 0.15, mpg: 30, kwh100: 28, gasUpkeep: 700, evUpkeep: 400, miles: 9500 }))), "Both are new cars driven 9,500 miles a year.", "no example left: the plain line");
  assert.equal(help(blank, "stateCredit"), "Some states and power companies pay part of an electric car's price, for example $1,000. Left empty, we count none.");
  // the family's sedan with its own miles and gas price, and the new car's miles per gallon typed in The figures
  const p = withCar(); p.whatIfs = { vehicles: { newMpg: 36 } };
  const own = evOf(p);
  assert.deepEqual([own.inputs.miles, own.from.miles, own.inputs.gasPrice, own.from.gasPrice, own.inputs.mpg, own.from.mpg], [11000, "car", 3.4, "car", 36, "figures"]);
  assert.equal(help(own, "miles"), "Left empty, we count the 11,000 miles you typed for your Sedan.");
  assert.equal(help(own, "gasPrice"), "Left empty, we count the $3.40 you typed for your Sedan.");
  assert.equal(help(own, "mpg"), "Left empty, we count 36, the new car's in The figures.");
  // an electric car's own charging figures
  const e = withCar(); e.property[0] = { ...e.property[0], electric: true, kwhPerMile: 0.28, kwhPrice: 0.21 };
  const evCar = evOf(e);
  assert.deepEqual([evCar.inputs.kwh100, evCar.from.kwh100, evCar.inputs.kwhPrice, evCar.from.kwhPrice, evCar.from.gasPrice], [28.000000000000004, "car", 0.21, "car", "example"]);
  assert.equal(help(evCar, "kwhPrice"), "On your power bill. Left empty, we count the $0.21 you typed for your Sedan.");
  assert.equal(help(evCar, "kwh100"), "Left empty, we count the 28 you typed for your Sedan.");
  // typed here wins; a 0 mpg or 0 kWh is not a figure (the boxes allow 1 and up); a typed 0 credit is the person's
  const typed = evOf(withEv({ priceGap: 6000, stateCredit: 0, miles: 15000, gasPrice: 3.1, kwhPrice: 0.14, mpg: 0, kwh100: null, gasUpkeep: 800, evUpkeep: 400 }));
  assert.deepEqual(typed.inputs, { priceGap: 6000, stateCredit: 0, miles: 15000, gasPrice: 3.1, kwhPrice: 0.14, mpg: 32, kwh100: 30, gasUpkeep: 800, evUpkeep: 400 });
  assert.equal(typed.set, 7);
  const r = running(typed.inputs);
  near(r.gas.total, 15000 / 32 * 3.1 + 800); near(r.ev.total, 15000 * 0.3 * 0.14 + 400);
  near(typed.years, 6000 / (r.gas.total - r.ev.total), 1e-12);
});

test("gap next-60 #56 invariance: over the four fixture plans and the invented households, compute() is byte-identical with the electric figures typed or not", async () => {
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  const plans = [["family", familyPlan(T15)], ["renterDebt", renterDebtPlan()], ["retiredCouple", retiredCouplePlan(T15)], ["empty", emptyPlan()], ["withCar", withCar()], ...ARCHETYPES.map((a) => [a.id, a.build()])];
  assert.ok(plans.length >= 19);
  let cars = 0;
  const EV = { priceGap: 6000, stateCredit: 1000, miles: 15000, gasPrice: 3.1, kwhPrice: 0.14, mpg: 30, kwh100: 28, gasUpkeep: 800, evUpkeep: 400 };
  for (const [name, p0] of plans) {
    const p = migrate(structuredClone(p0));
    const a = compute(p, { today: T15 });
    assert.equal(JSON.stringify(compute(withEv(EV, p), { today: T15 })), JSON.stringify(a), `${name}: typed`);
    assert.equal(JSON.stringify(compute(withEv(Object.fromEntries(EV_KEYS.map((k) => [k, null])), p), { today: T15 })), JSON.stringify(a), `${name}: saved empty`);
    if (a.ready) { cars++; const r = evOrGas(p, a); assert.equal(r.set, 0, name); assert.ok(Number.isFinite(r.saving), name); }
  }
  assert.ok(cars >= 10, `${cars} households with a car`);
});

const partOf = (root, id) => root.querySelectorAll("details").find((x) => x.dataset.part === id);
test("the page: one quiet row beside The figures, shut, no status until something is typed; opening writes nothing", async () => {
  const { root, saved, textOf } = await drawCars(renterDebtPlan());
  const ev = partOf(root, "ev");
  assert.ok(ev);
  assert.equal(textOf(ev.querySelector(".fold-title")).trim(), "Electric or gas for your miles");
  assert.equal(ev.querySelector(".fold-status"), null);
  assert.equal(ev.hasAttribute("open"), false);
  assert.equal(saved.length, 0);
  const t = textOf(ev);
  assert.match(t, /The electric car costs \$701 a year less to run\. Type how much more it costs to buy to see how long it takes to make that up\./);
  assert.match(t, /A new gas car \$1,813 a year gas \$1,313, upkeep \$500/);
  assert.match(t, /A new electric car \$1,112 a year charging \$612, upkeep \$500/);
  assert.match(t, /Both are new cars driven 12,000 miles a year, like yours\. They are not your own car's costs\. Boxes you leave empty use examples: type yours to replace them\./);
  assert.ok(t.includes(FEDERAL_LINE)); assert.ok(t.includes(EV_NOTE));
  const form = boxOf(ev, "priceGap").closest("form");
  const shown = form.all().filter((x) => x.tagName === "INPUT" && !x.closest(".form-more")).map((x) => x.getAttribute("name"));
  assert.deepEqual(shown, ["priceGap", "stateCredit", "miles", "gasPrice", "kwhPrice"], "five boxes first (the form budget)");
  for (const k of EV_KEYS) assert.equal(boxOf(ev, k).value ?? "", "", `${k}: no example in a box`);
  assert.equal(form.all().filter((x) => x.hasAttribute?.("required")).length, 0, "a shut part holds no required box");
});

test("S11 (R17): Work it out saves only whatIfs.vehicles.ev, keeps only that part open, and the green line is the new answer", async () => {
  const a = await drawCars(renterDebtPlan());
  const ev = partOf(a.root, "ev");
  boxOf(ev, "priceGap").value = "5000"; boxOf(ev, "stateCredit").value = "1000";
  boxOf(ev, "priceGap").closest("form").dispatch("submit");
  assert.equal(a.saved.length, 1);
  assert.deepEqual(a.saved[0].whatIfs.vehicles, { ev: { priceGap: 5000, stateCredit: 1000, miles: null, gasPrice: null, kwhPrice: null, mpg: null, kwh100: null, gasUpkeep: null, evUpkeep: null } }, "an empty box saves null; The figures' keys are not written");
  assert.deepEqual(a.saved[0].property, a.plan.property); assert.deepEqual(a.saved[0].accounts, a.plan.accounts);
  assert.deepEqual(compute(a.saved[0], { today: T14 }), compute(a.plan, { today: T14 }), "the page's own answers do not move");
  const b = await drawCars(a.saved[0]);
  assert.deepEqual(openParts(b.root), { figures: false, ev: true }, "the part just saved stays open, no other moves");
  const t = b.textOf(partOf(b.root, "ev"));
  assert.match(t, /Saved\. The electric car costs \$701 a year less to run, so it makes up the \$4,000 more it costs in about 5\.7 years\./);
  assert.equal((t.match(/makes up the \$4,000/g) ?? []).length, 1, "the answer once, as the green line");
  assert.equal(b.textOf(partOf(b.root, "ev").querySelector(".fold-status")).trim(), "2 set by you");
  assert.equal(boxOf(partOf(b.root, "ev"), "priceGap").value, "5,000");
  const c = await drawCars(a.saved[0]);
  assert.deepEqual(openParts(c.root), { figures: false, ev: false }, "the next visit opens shut");
  // The figures' Compare keeps the electric figures
  boxOf(c.root, "newPrice").value = "31000";
  boxOf(c.root, "newPrice").closest("form").dispatch("submit");
  assert.deepEqual(c.saved[0].whatIfs.vehicles.ev, a.saved[0].whatIfs.vehicles.ev);
  assert.equal(c.saved[0].whatIfs.vehicles.newPrice, 31000);
});

// ---- s3 fix (critics' findings P2, P3, P5)
test("s3 fix P2, P3: the line under the two cars names the car whose miles they use and says why they are not its card's figures", async () => {
  const { demoHousehold } = await import("../../../qa/fixtures/demo-household.mjs");
  const demo = migrate(demoHousehold(T15));
  const d = compute(demo, { today: T15 });
  assert.deepEqual(d.cars.map((c) => c.name), ["Family car", "Bo's truck"]);
  const card = Object.fromEntries(d.cars[0].year.lines.map((l) => [l.key, Math.round(l.amount)]));
  assert.deepEqual([card.fuel, card.maintenance], [1500, 900], "the Family car's own card: 12,000 / 28 x $3.50 and $900");
  const r = evOrGas(demo, d);
  assert.equal(r.car, "Family car", "the car The figures compares (the first)");
  assert.deepEqual([Math.round(r.gas.energy), r.gas.upkeep], [1313, 500], "a new gas car: 12,000 / 32 x $3.50 and $500");
  assert.equal(r.differs, true);
  assert.equal(evBasis(r), "Both are new cars driven 12,000 miles a year, like your Family car. They are not your own car's costs. Boxes you leave empty use examples: type yours to replace them.");
  assert.equal(evHelp("miles", r, { money: $, money2: $2 }), "Left empty, we count the 12,000 miles used for your Family car.");
  // Compare for the truck: it is named instead
  const truck = structuredClone(demo); truck.whatIfs = { ...(truck.whatIfs ?? {}), vehicles: { ...(truck.whatIfs?.vehicles ?? {}), car: d.cars[1].accountId ?? d.cars[1].id } };
  const rt = evOrGas(truck, compute(truck, { today: T15 }));
  assert.equal(rt.car, "Bo's truck");
  assert.match(evBasis(rt), /^Both are new cars driven 12,000 miles a year, like Bo's truck\. They are not your own car's costs\./);
  // a car whose card matches a new gas car (32 miles a gallon, $500 upkeep): nothing to explain
  const p = withCar(); p.property[0] = { ...p.property[0], mpg: 32, maintenanceYear: 500 };
  const same = evOf(p);
  assert.equal(same.differs, false);
  assert.equal(evBasis(same), "Both are new cars driven 11,000 miles a year, like your Sedan. Boxes you leave empty use examples: type yours to replace them.");
  // every box typed but the miles (the miles per gallon too: left empty it is an example, s3 fix round 2 F4): no example left
  const allTyped = evOf(withEv({ gasUpkeep: 500, evUpkeep: 500, kwhPrice: 0.15, kwh100: 30, mpg: 32 }, p));
  assert.equal(allTyped.from.mpg, "typed"); assert.equal(allTyped.differs, false);
  assert.equal(evBasis(allTyped), "Both are new cars driven 11,000 miles a year, like your Sedan.");
  assert.equal(evOf(withEv({ gasUpkeep: 500, evUpkeep: 500, kwhPrice: 0.15, kwh100: 30 }, p)).from.mpg, "example", "the mpg box left empty is an example");
  assert.equal(evBasis(evOf(withEv({ miles: 15000 }, p))), "Both are new cars driven 15,000 miles a year. Boxes you leave empty use examples: type yours to replace them.");
  // an electric car is compared with a new electric car's charging and upkeep
  const e = withCar(); e.property[0] = { ...e.property[0], electric: true, kwhPerMile: 0.3, kwhPrice: 0.17, maintenanceYear: 500 };
  assert.equal(evOf(e).differs, false, "its own charging figures and $500 upkeep: the same as the new electric car");
  assert.deepEqual(["Family car", "Bo's truck", "Car", "car", "", "The Subaru", "Honda Civic"].map(carPhrase),
    ["your Family car", "Bo's truck", "your car", "your car", "your car", "The Subaru", "your Honda Civic"]);
});

test("s3 fix round 2 P2: the line under the two cars says it in plain words, every case, never \"card\"", () => {
  const p = withCar(); p.property[0] = { ...p.property[0], mpg: 32, maintenanceYear: 500 };
  const all = { gasUpkeep: 500, evUpkeep: 500, kwhPrice: 0.15, kwh100: 30, mpg: 32 };
  const cases = [
    [evOf(renterDebtPlan()), "Both are new cars driven 12,000 miles a year, like yours. They are not your own car's costs. Boxes you leave empty use examples: type yours to replace them."],
    [evOf(withEv({ ...all, gasPrice: 3.5 })), "Both are new cars driven 12,000 miles a year, like yours. They are not your own car's costs."],
    [evOf(p), "Both are new cars driven 11,000 miles a year, like your Sedan. Boxes you leave empty use examples: type yours to replace them."],
    [evOf(withEv(all, p)), "Both are new cars driven 11,000 miles a year, like your Sedan."],
    [evOf(withEv({ miles: 15000 }, p)), "Both are new cars driven 15,000 miles a year. Boxes you leave empty use examples: type yours to replace them."],
    [evOf(withEv({ ...all, miles: 15000 }, p)), "Both are new cars driven 15,000 miles a year."],
  ];
  for (const [r, words] of cases) { assert.equal(evBasis(r), words); assert.doesNotMatch(evBasis(r), /card|figures on/); }
});

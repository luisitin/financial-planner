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
  assert.deepEqual(openParts(root), { figures: false }, "a list page: the comparison's figures wait folded");
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
  assert.deepEqual(openParts(b.root), { figures: true }, "the part just saved stays open, no other moves");
  assert.match(b.textOf(b.root), /Saved\. Cheapest over 5 years: keep it, \$\d+ a month\./);
  assert.equal(boxOf(b.root, "newRate").getAttribute("placeholder"), "7.2", "reopened: still empty and gray");
  assert.equal(boxOf(b.root, "newPrice").value, "30,000");
  assert.equal(statusText(b.root, b.textOf), "our guess · $30,000", "a price the person typed is named");
  const c = await drawCars(a.saved[0]);
  assert.deepEqual(openParts(c.root), { figures: false }, "the next visit opens on the answer, the figures folded");
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

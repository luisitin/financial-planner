import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, plannedDates } from "./compute.js";
import { recurringPlan } from "../recurring/module.test.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-09-15";
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.01, `${a} != ${b}`);

test("plannedDates: monthly bills on the 1st, pay on the 15th, start dates respected", () => {
  assert.deepEqual(plannedDates({ kind: "expense", period: "monthly" }, "2026-09-15", "2026-12-14"), ["2026-10-01", "2026-11-01", "2026-12-01"]);
  assert.deepEqual(plannedDates({ kind: "income", period: "monthly" }, "2026-09-15", "2026-11-20"), ["2026-09-15", "2026-10-15", "2026-11-15"]);
  assert.deepEqual(plannedDates({ kind: "expense", period: "monthly", startDate: "2026-09-20" }, "2026-09-15", "2026-11-25"), ["2026-09-20", "2026-10-20", "2026-11-20"]);
  assert.deepEqual(plannedDates({ kind: "expense", period: "monthly", startDate: "2026-08-20", endDate: "2026-10-01" }, "2026-09-15", "2026-11-25"), ["2026-09-20"]);
  assert.deepEqual(plannedDates({ kind: "expense", period: "once" }, "2026-09-15", "2026-11-25"), []);
  assert.deepEqual(plannedDates({ kind: "expense", period: "annual", startDate: "2027-09-01" }, "2026-09-15", "2026-12-14"), []);
});
test("no everyday account or no today: no data", () => {
  assert.equal(compute(emptyPlan(), { today: TODAY }).hasData, false);
  assert.equal(compute(recurringPlan()).hasData, false);
});
test("90 days from the sample: found payments and typed bills, the lowest day, totals", () => {
  const p = recurringPlan();
  const d = compute(p, { today: TODAY, days: 90 });
  assert.equal(d.hasData, true); assert.equal(d.start, 4000); assert.equal(d.days.length, 91);
  assert.equal(d.days[0].date, TODAY); assert.equal(d.days[90].date, "2026-12-14");
  assert.equal(d.sources.found, 4, "Netflix, payroll, insurance, gym (missed) are on the checking account");
  assert.equal(d.sources.skipped, 1, "the typed 'Pay' (1950 every two weeks) is the found payroll; Rent is not covered");
  const rent = d.days.find((x) => x.date === "2026-10-01");
  assert.ok(rent.events.some((e) => e.name === "Rent" && e.amount === -1500), "typed rent lands on the 1st");
  const pay = d.days.find((x) => x.date === "2026-09-25");
  assert.ok(pay.events.some((e) => e.name === "Acme Corp Payroll" && e.amount === 1950), "found payroll every two weeks from the last one");
  const gym = d.days.find((x) => x.events.some((e) => e.name === "Gym Membership"));
  assert.ok(gym && gym.date >= TODAY, "a missed payment is expected again from its next date");
  near(d.income, 1950 * d.days.flatMap((x) => x.events).filter((e) => e.name === "Acme Corp Payroll").length);
  assert.ok(d.lowest.balance <= d.start);
  assert.equal(d.shortfallDate, null);
  near(d.end, d.start + d.income - d.spending);
});
test("a shortfall is dated", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "c", name: "Checking", type: "checking", balance: 500 });
  p.expenses.push({ id: "r", name: "Rent", category: "housing", amount: 1500, period: "monthly" });
  const d = compute(p, { today: TODAY, days: 30 });
  assert.equal(d.shortfallDate, "2026-10-01"); assert.equal(d.lowest.balance, -1000);
});

// pay is typed before tax; the bank sees take-home (Paycheck page), and a payroll deposit covers one typed salary
function earners() {
  const p = emptyPlan();
  p.household.people.push({ id: "a", name: "Ana", role: "self", birthDate: "1988-05-01" }, { id: "b", name: "Bo", role: "partner", birthDate: "1987-03-01" });
  p.household.filingStatus = "married_joint";
  p.accounts.push({ id: "c", name: "Checking", type: "checking", balance: 5000 });
  p.income.push({ id: "ia", name: "Ana's salary", type: "salary", personId: "a", amount: 3900, period: "biweekly", taxable: true },
    { id: "ib", name: "Bo's salary", type: "salary", personId: "b", amount: 5200, period: "monthly", taxable: true },
    { id: "is", name: "Weekend photography", type: "business", personId: "a", amount: 600, period: "monthly", taxable: true });
  p.expenses.push({ id: "r", name: "Rent", category: "housing", amount: 2000, period: "monthly", essential: true });
  return p;
}
test("typed salaries land at take-home (the Paycheck page's share); other income as typed", async () => {
  const { takeHome } = await import("../paycheck/compute.js");
  const p = earners();
  const th = takeHome(p, { today: TODAY });
  const d = compute(p, { today: TODAY, days: 60 });
  assert.equal(d.takeHome, true);
  const evs = d.days.flatMap((x) => x.events);
  const ana = evs.find((e) => e.name === "Ana's salary"), bo = evs.find((e) => e.name === "Bo's salary"), side = evs.find((e) => e.name === "Weekend photography");
  near(ana.amount, 3900 * th.ratio.ia); assert.equal(ana.beforeTax, 3900);
  near(bo.amount, 5200 * th.ratio.ib); assert.equal(bo.beforeTax, 5200);
  assert.ok(th.ratio.ia > 0.5 && th.ratio.ia < 0.95, `a take-home share, not all of the pay: ${th.ratio.ia}`);
  assert.equal(side.amount, 600); assert.equal(side.beforeTax, undefined, "side income is not withheld: left as typed");
  near(d.income, evs.filter((e) => e.amount > 0).reduce((t, e) => t + e.amount, 0));
});
test("takeHome: each salary at its earner's yearly take-home over pay; monthly = income with salaries at take-home", async () => {
  const { takeHome, compute: paycheck } = await import("../paycheck/compute.js");
  const p = earners();
  const pc = paycheck(p, { today: TODAY }), th = takeHome(p, { today: TODAY });
  const ana = pc.people.find((x) => x.id === "a");
  near(th.ratio.ia, ana.yearly.net / ana.yearly.gross);
  near(th.grossMonthly, 3900 * 26 / 12 + 5200 + 600);
  near(th.monthly, 3900 * 26 / 12 * th.ratio.ia + 5200 * th.ratio.ib + 600);
  assert.equal(th.ratio.is, undefined);
  const none = takeHome(emptyPlan(), { today: TODAY });
  assert.equal(none.ready, false); assert.equal(none.monthly, 0);
});
test("after an import, a payroll deposit covers the one typed salary it is closest to; the other still lands", async () => {
  const { takeHome } = await import("../paycheck/compute.js");
  const p = earners();
  const th = takeHome(p, { today: TODAY });
  const anaNet = Math.round(3900 * th.ratio.ia * 100) / 100;
  // Ana's employer pays her take-home every two weeks; the bank calls it "ACME CORP PAYROLL", nothing like "Ana's salary"
  ["2026-07-10", "2026-07-24", "2026-08-07", "2026-08-21", "2026-09-04"].forEach((date, k) => p.transactions.push({ id: `t${k}`, date, amount: anaNet + 7, payee: "Acme Corp", rawPayee: "ACME CORP PAYROLL PPD", accountId: "c", category: "" }));
  const d = compute(p, { today: TODAY, days: 60 });
  const evs = d.days.flatMap((x) => x.events);
  assert.ok(evs.some((e) => e.source === "found" && e.amount > 0), "the found pay is expected again");
  assert.ok(!evs.some((e) => e.name === "Ana's salary"), "and Ana's typed salary is not counted a second time");
  assert.ok(evs.some((e) => e.name === "Bo's salary"), "Bo's pay has no deposit of its own: it still lands");
  assert.equal(d.sources.skipped, 1);
});
test("a deposit far from any salary's take-home covers nothing (no payroll match beyond the band)", () => {
  const p = earners();
  ["2026-07-10", "2026-07-24", "2026-08-07", "2026-08-21", "2026-09-04"].forEach((date, k) => p.transactions.push({ id: `t${k}`, date, amount: 300, payee: "Acme Corp", rawPayee: "ACME CORP PAYROLL", accountId: "c", category: "" }));
  const evs = compute(p, { today: TODAY, days: 60 }).days.flatMap((x) => x.events);
  assert.ok(evs.some((e) => e.name === "Ana's salary") && evs.some((e) => e.name === "Bo's salary"));
});
test("loan and card payments kept only on Debts are paid on the 1st, as the Expenses page counts them; filed ones are not added again", () => {
  const p = earners();
  p.accounts.push({ id: "v", name: "Visa", type: "credit", balance: -4000 }, { id: "car", name: "Car loan", type: "loan", balance: -9000 });
  p.debts = [{ accountId: "v", rate: 0.24, minPayment: 120, extra: 30 }, { accountId: "car", rate: 0.07, minPayment: 410 }];
  const d = compute(p, { today: TODAY, days: 40 });
  const oct1 = d.days.find((x) => x.date === "2026-10-01").events;
  assert.ok(oct1.some((e) => e.name === "Visa payment" && e.amount === -150 && e.fromDebts));
  assert.ok(oct1.some((e) => e.name === "Car loan payment" && e.amount === -410));
  assert.equal(d.debtFromDebts, 560);
  p.expenses.push({ id: "cl", name: "Car loan", category: "debt", amount: 410, period: "monthly", essential: true });
  const filed = compute(p, { today: TODAY, days: 40 });
  // the car loan's payment is filed: only the Visa's comes from Debts (each debt matched to its own expense, 2026-11-02)
  assert.equal(filed.debtFromDebts, 150);
  const ev = filed.days.flatMap((x) => x.events).filter((e) => e.fromDebts);
  assert.ok(ev.length && ev.every((e) => e.name === "Visa payment"), "the filed car loan is not added again");
  p.expenses.push({ id: "vp", name: "Visa", category: "debt", amount: 150, period: "monthly", essential: true });
  const both = compute(p, { today: TODAY, days: 40 });
  assert.equal(both.debtFromDebts, 0);
  assert.ok(!both.days.flatMap((x) => x.events).some((e) => e.fromDebts), "both filed: nothing from Debts (F-019)");
});

// review findings (2026-11-01): each reproduction from the adversarial review, kept as a test
const deposits = (p, raw, amount, days, account = "c") => days.forEach((date, k) => p.transactions.push({ id: `${raw}-${k}`, date, amount, payee: raw, rawPayee: raw, accountId: account, category: "" }));
const BIWEEKLY = ["2026-07-10", "2026-07-24", "2026-08-07", "2026-08-21", "2026-09-04"];
const MONTHLY = ["2026-06-03", "2026-07-03", "2026-08-03", "2026-09-03"];
const names = (d) => d.days.flatMap((x) => x.events).map((e) => e.name);
test("review: a DIRECT DEPOSIT line is pay, and covers the salary it is closest to", async () => {
  const { takeHome, PAYROLL } = await import("../paycheck/compute.js"); void PAYROLL;
  const p = earners();
  const net = 3900 * takeHome(p, { today: TODAY }).ratio.ia;
  deposits(p, "ACME CORP DIRECT DEPOSIT", Math.round(net * 1.08), BIWEEKLY);
  const n = names(compute(p, { today: TODAY, days: 60 }));
  assert.ok(!n.includes("Ana's salary") && n.includes("Bo's salary"));
});
test("review: a deposit near one earner's take-home covers that earner, not the other whose pay before tax is near it", async () => {
  const { takeHome } = await import("../paycheck/compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const p = familyPlan("2026-11-01");
  const th = takeHome(p, { today: "2026-11-01" });
  // 2,500 every two weeks = $65,000 a year: 4% from Bo's $62,400 before tax, but nearer Ana's take-home than Bo's
  assert.ok(Math.abs(65000 - 3900 * 26 * th.ratio["i-ana"]) < Math.abs(65000 - 5200 * 12 * th.ratio["i-bo"]));
  deposits(p, "ACME CORP PAYROLL", 2500, ["2026-08-07", "2026-08-21", "2026-09-04", "2026-09-18", "2026-10-02", "2026-10-16"], "a-chk");
  const n = names(compute(p, { today: "2026-11-01", days: 60 }));
  assert.ok(!n.includes("Ana's salary"), "Ana's pay is the deposit");
  assert.ok(n.includes("Bo's salary"), "Bo is still paid");
});
test("review: one SALARY deposit does not cover every typed salary through the word 'salary'", () => {
  const p = earners();
  deposits(p, "GLOBEX SALARY", 4300, MONTHLY);
  const n = names(compute(p, { today: TODAY, days: 60 }));
  assert.ok(n.includes("Ana's salary"), "Ana's pay stays");
  assert.ok(!n.includes("Bo's salary"), "Bo's pay is the Globex deposit");
});
test("review: without a take-home share, a payroll deposit up to half below the typed pay still covers it (no double count)", () => {
  const p = earners();
  p.household.people = [];
  deposits(p, "ACME PAYROLL", 2888, BIWEEKLY);
  const d = compute(p, { today: TODAY, days: 60 });
  assert.ok(!names(d).includes("Ana's salary"));
  assert.ok(d.days.flatMap((x) => x.events).some((e) => e.name === "Bo's salary" && e.payBeforeTax), "pay with no share is marked as before tax");
  assert.equal(d.payBeforeTax, true);
});
test("review: a Debts line is covered by the bank's payment under the lender's name; 'loan' alone ties nothing", () => {
  const p = earners();
  p.accounts.push({ id: "v", name: "Visa card", institution: "Chase", type: "credit", balance: -4000 }, { id: "car", name: "Car loan", institution: "Ford Credit", type: "loan", balance: -9000 }, { id: "sl", name: "Student loan", institution: "Navient", type: "student_loan", balance: -22000 });
  p.debts = [{ accountId: "v", rate: 0.24, minPayment: 150 }, { accountId: "car", rate: 0.07, minPayment: 410 }, { accountId: "sl", rate: 0.05, minPayment: 280 }];
  deposits(p, "CHASE CREDIT CRD AUTOPAY", -650, MONTHLY.map((x) => x.replace(/-03$/, "-20")));
  deposits(p, "NAVIENT STUDENT LOAN PMT", -280, MONTHLY.map((x) => x.replace(/-03$/, "-12")));
  const n = names(compute(p, { today: TODAY, days: 40 }));
  assert.ok(!n.includes("Visa card payment"), "the card is paid by the bank's autopay line");
  assert.ok(!n.includes("Student loan payment"), "Navient's line pays the student loan");
  assert.ok(n.includes("Car loan payment"), "the car loan is still paid");
});
test("review: Debts lines stop at the payoff and skip a debt paid off", () => {
  const p = earners();
  p.accounts.push({ id: "v", name: "Visa", type: "credit", balance: 0 }, { id: "car", name: "Car loan", type: "loan", balance: -600 });
  p.debts = [{ accountId: "v", rate: 0.24, minPayment: 190, extra: 210 }, { accountId: "car", rate: 0.07, minPayment: 410 }];
  const evs = compute(p, { today: TODAY, days: 120 }).days.flatMap((x) => x.events);
  assert.ok(!evs.some((e) => e.name === "Visa payment"), "nothing owed");
  assert.equal(evs.filter((e) => e.name === "Car loan payment").length, 2, "$600 at $410 a month: two payments");
});
test("review: a new job starting inside the window, a bonus and pay tied to nobody land after tax", async () => {
  const { takeHome, SUPPLEMENTAL, PAYROLL } = await import("../paycheck/compute.js");
  const p = earners();
  p.income.find((x) => x.id === "ib").endDate = "2026-10-31";
  p.income.push({ id: "ib2", name: "Bo's new job", type: "salary", personId: "b", amount: 5600, period: "monthly", startDate: "2026-11-01", taxable: true },
    { id: "bon", name: "Ana's bonus", type: "bonus", personId: "a", amount: 12000, period: "annual", startDate: "2026-10-15", taxable: true },
    { id: "hh", name: "Household pay", type: "salary", personId: "", amount: 2000, period: "monthly", taxable: true });
  const th = takeHome(p, { today: TODAY });
  assert.ok(th.ratio.ib2 > 0 && th.ratio.ib2 < 1, "the new job takes Bo's share");
  assert.ok(Math.abs(th.ratio.bon - (1 - SUPPLEMENTAL - PAYROLL.ss - PAYROLL.medicare)) < 0.05, "a bonus: 22% federal, Social Security and Medicare (and any state share)");
  assert.equal(th.ratio.hh, th.household, "pay tied to nobody: the household's share");
  const evs = compute(p, { today: TODAY, days: 75 }).days.flatMap((x) => x.events);
  const nj = evs.find((e) => e.name === "Bo's new job"), bon = evs.find((e) => e.name === "Ana's bonus"), hh = evs.find((e) => e.name === "Household pay");
  near(nj.amount, 5600 * th.ratio.ib2); assert.equal(nj.beforeTax, 5600);
  near(bon.amount, 12000 * th.ratio.bon); near(hh.amount, 2000 * th.household);
});
test("review: an ended job never takes the new job's deposit (both would land otherwise)", async () => {
  const { takeHome } = await import("../paycheck/compute.js");
  const p = earners();
  p.income.find((x) => x.id === "ib").endDate = "2026-08-31";
  p.income.push({ id: "ib2", name: "Bo's new job", type: "salary", personId: "b", amount: 6000, period: "monthly", startDate: "2026-09-01", taxable: true });
  const net = 6000 * takeHome(p, { today: TODAY }).ratio.ib2;
  deposits(p, "NEWCO PAYROLL", Math.round(net), ["2026-07-01", "2026-08-01", "2026-09-01"]);
  const n = names(compute(p, { today: TODAY, days: 60 }));
  assert.ok(!n.includes("Bo's new job"), "the deposit is the new job's pay: it is not counted a second time");
});
test("review: a found payday due today is in the forecast", () => {
  const p = earners();
  p.income = [];
  deposits(p, "ACME PAYROLL", 3000, ["2026-06-15", "2026-07-15", "2026-08-15"]);
  const d = compute(p, { today: TODAY, days: 40 });
  assert.ok(d.days[0].events.some((e) => e.name === "ACME PAYROLL" && e.amount === 3000), "Sep 15 pay lands on Sep 15");
  assert.ok(d.days.find((x) => x.date === "2026-10-15").events.some((e) => e.name === "ACME PAYROLL"));
});
test("review: an adult whose only job starts later lands at take-home, not before tax", async () => {
  const p = earners();
  p.income = p.income.filter((x) => x.id !== "ib");
  p.income.push({ id: "ib2", name: "Bo's new job", type: "salary", personId: "b", amount: 6000, period: "monthly", startDate: "2026-10-01", taxable: true });
  const d = compute(p, { today: TODAY, days: 40 });
  const nj = d.days.flatMap((x) => x.events).find((e) => e.name === "Bo's new job");
  assert.ok(nj.amount < 6000 && nj.beforeTax === 6000, `take-home: ${nj.amount}`);
  assert.equal(d.payBeforeTax, false);
});

test("round 4: a salary typed as a yearly figure (the setup's default) lands as paychecks, not one deposit a year", async () => {
  const { payRhythm } = await import("../../../core/math/periods.js");
  const { compute: recurring } = await import("../recurring/compute.js");
  const p = emptyPlan();
  p.household.people.push({ id: "me", name: "Jordan", role: "self", birthDate: "1994-05-01" });
  p.accounts.push({ id: "chk", name: "Checking", type: "checking", balance: 8000 });
  p.income.push({ id: "pay", name: "Jordan's pay", type: "salary", personId: "me", amount: 55000, period: "annual" });
  p.expenses.push({ id: "rent", name: "Rent", category: "housing", amount: 1600, period: "monthly", essential: true });
  for (const today of ["2026-11-02", "2026-11-20"]) {
    const pays = compute(p, { today }).days.flatMap((x) => x.events).filter((e) => e.name === "Jordan's pay");
    assert.ok(pays.length >= 6 && pays.length <= 7, `${today}: ${pays.length} paydays in 90 days`);
    assert.ok(pays.every((e) => e.amount > 1000 && e.amount < 55000 / 26), "each at the take-home share of one paycheck");
  }
  assert.deepEqual(payRhythm(p.income[0], p), { period: "biweekly", count: 26, perPay: 55000 / 26, words: "paid every two weeks" });
  p.whatIfs = { ...(p.whatIfs ?? {}), paycheck: { me: { paychecks: 24 } } };
  assert.equal(payRhythm(p.income[0], p).words, "paid twice a month", "the Paycheck page's count wins");
  assert.equal(recurring(p, { today: "2026-11-02" }).planned.find((x) => x.id === "pay").periodLabel, "A year, paid twice a month");
  assert.equal(payRhythm({ ...p.income[0], type: "bonus" }, p), null, "a bonus is once a year");
});

test("the saved debt plan's extra is paid on the 1st until its debts are gone, as Next best action counts it (round 4)", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { compute: payoff } = await import("../../debt/payoff/compute.js");
  const T = "2026-11-02";
  const p = familyPlan(T);
  const base = compute(p, { today: T, days: 365 });
  p.debtPlan = { extra: 1000, order: "avalanche", targets: ["a-visa"] };
  const d = compute(p, { today: T, days: 365 });
  const ev = d.days.flatMap((x) => x.events.map((e) => ({ ...e, date: x.date }))).filter((e) => e.name === "Extra on Visa card (Pay off debts)");
  const end = payoff(p, { today: T }).chosen.debts.find((x) => x.id === "a-visa").endDate;
  assert.ok(ev.length >= 2 && ev.every((e) => e.amount === -1000 && e.date.endsWith("-01") && e.date <= end), JSON.stringify(ev.map((e) => e.date)));
  assert.ok(Math.abs(base.end - d.end - 1000 * ev.length) < 0.01);
  p.debtPlan = { extra: 1000, order: "avalanche", targets: ["a-gone"] };
  assert.ok(!compute(p, { today: T, days: 90 }).days.some((x) => x.events.some((e) => /Pay off debts/.test(e.name))), "aimed at debts already paid off: the extra has stopped");
});

test("business income typed as a year lands a month at a time, not in one deposit (round 4)", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const T = "2026-11-02";
  // setup's own record ("a typical year", asked of someone paid by their own business)
  const p = familyPlan(T); p.income.push({ id: "setup-pay-p-ana", name: "My business", type: "business", personId: "p-ana", amount: 60000, period: "annual", growth: 0, startDate: "", endDate: "", taxable: true });
  const d = compute(p, { today: T });
  const hits = JSON.stringify(d).match(/"name":"My business","amount":([\d.]+)/g) ?? [];
  assert.ok(hits.length >= 2, `${hits.length} deposits in the forecast`);
  for (const h of hits) assert.equal(Number(h.split(":").pop()), 5000);
  // a once-a-year payment typed on Income (a retainer) still lands once, on its date (review 2026-11-02)
  const q = familyPlan(T); q.income.push({ id: "i-ret", name: "Year-end retainer", type: "business", personId: "p-ana", amount: 12000, period: "annual", growth: 0, startDate: "2025-12-20", endDate: "", taxable: true });
  const once = JSON.stringify(compute(q, { today: T })).match(/"name":"Year-end retainer","amount":([\d.]+)/g) ?? [];
  assert.equal(once.length, 1); assert.equal(Number(once[0].split(":").pop()), 12000);
});

test("estimated tax goes out on the quarters' due dates; 'if not paid yet' when nothing is typed (review 2026-11-02)", async () => {
  const { estimatedLines } = await import("./compute.js");
  const { compute: estimated } = await import("../../taxes/estimated/compute.js");
  const T = "2026-11-02";
  const plan = () => {
    const p = emptyPlan();
    p.household = { ...(p.household ?? {}), people: [{ id: "dee", name: "Dee", role: "self", birthDate: "1990-04-01" }], state: "TX", filingStatus: "single" };
    p.income = [{ id: "setup-pay-dee", name: "Dee's business", type: "business", personId: "dee", amount: 78000, period: "annual", growth: 0, startDate: "", endDate: "", taxable: true }];
    p.accounts = [{ id: "chk", name: "Checking", type: "checking", balance: 8000 }];
    return p;
  };
  const p = plan(); const e = estimated(p, { today: T });
  assert.ok(e.needsEstimates && e.overdue && e.nextDue, "a freelancer with nothing paid needs quarterly payments");
  const lines = estimatedLines(p, T, "2027-01-31");
  assert.equal(lines.length, 2);
  assert.equal(lines[0].date, T); assert.match(lines[0].name, /if not paid yet/); assert.ok(Math.abs(-lines[0].amount - e.overdue.amount) < 0.01);
  assert.equal(lines[1].date, e.nextDue.due); assert.ok(Math.abs(-lines[1].amount - e.nextDue.amount) < 0.01);
  // the forecast carries them, so it no longer runs the whole business income in untaxed
  const d = compute(p, { today: T, days: 90 });
  const taxOut = d.days.flatMap((x) => x.events).filter((x) => x.tax).reduce((t, x) => t - x.amount, 0);
  assert.ok(Math.abs(taxOut - e.overdue.amount - e.nextDue.amount) < 0.02);
  // typed payments: the past-due part is named as such; all paid: nothing past due
  const typed = plan(); typed.taxes = { ...(typed.taxes ?? {}), estimated: { paid: [1000, 0, 0, 0] } };
  assert.match(estimatedLines(typed, T, "2027-01-31")[0].name, /^Estimated tax past due/);
  // the bank's own IRS payment ahead (found on its rhythm) is the forecast's already: it pays these lines, the latest first
  const ahead = estimatedLines(p, T, "2027-01-31", [{ date: "2026-12-15", amount: -2500, rawPayee: "IRS USATAXPYMT", payee: "IRS" }]);
  assert.equal(ahead.length, 2); assert.ok(Math.abs(-ahead[1].amount - (e.nextDue.amount - 2500)) < 0.01); assert.ok(Math.abs(-ahead[0].amount - e.overdue.amount) < 0.01);
  // no business income: nothing
  const w = plan(); w.income[0].type = "salary"; assert.deepEqual(estimatedLines(w, T, "2027-01-31"), []);
});

// round 5 review (2026-11-02): who the quarters are for, and what already pays them
function freelancer() {
  const p = emptyPlan();
  p.household = { ...(p.household ?? {}), people: [{ id: "dee", name: "Dee", role: "self", birthDate: "1990-04-01" }], state: "TX", filingStatus: "single" };
  p.income = [{ id: "setup-pay-dee", name: "Dee's business", type: "business", personId: "dee", amount: 78000, period: "annual", growth: 0, startDate: "", endDate: "", taxable: true }];
  p.accounts = [{ id: "chk", name: "Checking", type: "checking", balance: 8000 }];
  p.transactions = [];
  return p;
}
// the same freelancer with last year's tax on file ($11,200, so $2,800 a quarter) and three quarters typed as paid
function paidFreelancer() {
  const p = freelancer();
  p.taxes = { ...(p.taxes ?? {}), priorYear: { tax: 11200, agi: 71000 }, estimated: { paid: [2800, 2800, 2800, 0] } };
  return p;
}
const taxEvents = (d) => d.days.flatMap((x) => x.events.filter((e) => e.tax).map((e) => ({ ...e, date: x.date })));
const bankLine = (p, date, payee, amount) => p.transactions.push({ id: `t${p.transactions.length + 1}`, date, amount, payee, rawPayee: payee, accountId: "chk", category: "", tags: [], note: "" });

test("pay that withholds most of the tax: no quarterly lines, as Needs attention and Next best action (round 5)", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { compute: estimated, taxOwedNow } = await import("../../taxes/estimated/compute.js");
  const { estimatedLines } = await import("./compute.js");
  const T = "2026-11-02";
  const p = familyPlan(T);
  const e = estimated(p, { today: T });
  assert.ok(e.needsEstimates && e.withholding >= e.totalTax / 2, "two salaries withhold most of the tax; the photography is a little on top");
  assert.equal(taxOwedNow(p, { today: T }), null);
  assert.deepEqual(estimatedLines(p, T, "2027-01-31"), [], "the shortfall is the April bill or a W-4 change, not a payment today");
  assert.deepEqual(taxEvents(compute(p, { today: T })), []);
});

test("only federal bank payments count against the quarters, and only what they pay (round 5)", async () => {
  const { compute: estimated } = await import("../../taxes/estimated/compute.js");
  const T = "2026-11-02";
  const base = freelancer(), e = estimated(base, { today: T });
  const want = e.overdue.amount + e.nextDue.amount;
  const total = (d) => taxEvents(d).reduce((t, x) => t - x.amount, 0);
  assert.ok(Math.abs(total(compute(base, { today: T })) - want) < 0.02);
  // a state's fee or tax never pays the federal 1040-ES: the quarters stay
  const ftb = freelancer(); bankLine(ftb, "2025-04-15", "FRANCHISE TAX BOARD PAYMENTS", -800); bankLine(ftb, "2026-04-15", "FRANCHISE TAX BOARD PAYMENTS", -800);
  assert.ok(Math.abs(total(compute(ftb, { today: T })) - want) < 0.02, "an $800 franchise tax does not erase the federal estimates");
  const dor = freelancer(); for (const m of ["07", "08", "09", "10"]) bankLine(dor, `2026-${m}-20`, "CO DEPT OF REVENUE", -140);
  assert.ok(Math.abs(total(compute(dor, { today: T })) - want) < 0.02);
  // a small monthly IRS payment: what it paid this year and what it will pay in the window come off, nothing more
  const irs = freelancer(); for (const m of ["07", "08", "09", "10"]) bankLine(irs, `2026-${m}-05`, "IRS USATAXPYMT", -250);
  const d = compute(irs, { today: T });
  const found = d.days.flatMap((x) => x.events).filter((x) => x.name === "IRS USATAXPYMT" && x.source === "found");
  assert.equal(found.length, 3);
  assert.ok(Math.abs(total(d) - (want - 1000 - 750)) < 0.02, `${total(d)}: $1,000 paid since January and $750 ahead come off`);
});

test("estimated payments the bank shows (April, June, September) count as paid when none are typed (round 5)", async () => {
  const { taxPaidInBank } = await import("./compute.js");
  const { compute: estimated } = await import("../../taxes/estimated/compute.js");
  const T = "2026-11-02";
  const p = freelancer();
  bankLine(p, "2026-01-15", "IRS USATAXPYMT", -3000); // last year's 4th quarter
  for (const d of ["2026-04-15", "2026-06-15", "2026-09-15"]) bankLine(p, d, "IRS USATAXPYMT", -3000);
  bankLine(p, "2026-08-01", "IRS USATAXPYMT", 400); // a refund is not a payment
  p.transactions.push({ id: "tx", date: "2026-05-01", amount: -500, payee: "IRS", rawPayee: "IRS", accountId: "chk", category: "", tags: [], note: "", transferId: "x" });
  assert.equal(taxPaidInBank(p, 2026, T), 9000, "this tax year's three payments; January 15 paid last year");
  assert.equal(taxPaidInBank(p, 2025, T), 3000);
  const e = estimated(p, { today: T });
  assert.equal(e.paidTyped, false);
  const ev = taxEvents(compute(p, { today: T }));
  assert.equal(ev.length, 2);
  assert.ok(Math.abs(-ev[0].amount - (e.behind - 9000)) < 0.02, "only the part the bank does not show paid, today");
  assert.match(ev[0].name, /if not paid yet/);
  assert.ok(Math.abs(-ev[1].amount - e.nextDue.amount) < 0.02);
  // typed on Estimated payments: the typed figures are the record, the bank lines are the same payments
  p.taxes = { ...(p.taxes ?? {}), estimated: { paid: [3000, 3000, 3000, 0], typedAt: T } };
  assert.ok(Math.abs(-taxEvents(compute(p, { today: T }))[0].amount - (estimated(p, { today: T }).behind)) < 0.02);
});

test("last year's balance paid in April counts at most as the 1st quarter; a catch-up payment counts in full (round 5)", async () => {
  const { taxPaidInBank } = await import("./compute.js");
  const { compute: estimated } = await import("../../taxes/estimated/compute.js");
  const T = "2026-11-02";
  const e = estimated(freelancer(), { today: T }), share = e.perQuarter; // 3,641.95 a quarter
  // $6,000 to the IRS on April 15: the 2025 return's balance (and maybe the 1st quarter)
  const p = freelancer(); bankLine(p, "2026-04-15", "IRS USATAXPYMT", -6000);
  near(taxPaidInBank(p, 2026, T, e.quarters), share);
  assert.equal(taxPaidInBank(p, 2026, T), 6000, "without the quarters: every line in full");
  const ev = taxEvents(compute(p, { today: T }));
  assert.match(ev[0].name, /if not paid yet/); near(-ev[0].amount, e.behind - share);
  near(-ev[1].amount, e.nextDue.amount);
  // a balance in February, then the 1st quarter on April 15: together still at most the 1st quarter
  const feb = freelancer(); bankLine(feb, "2026-02-20", "IRS USATAXPYMT", -2500); bankLine(feb, "2026-04-15", "IRS USATAXPYMT", -3641.95);
  near(taxPaidInBank(feb, 2026, T, e.quarters), share);
  // behind, then catching up two quarters at once in September: up to what is due by September 15, so all of it
  const cu = freelancer(); bankLine(cu, "2026-04-15", "IRS USATAXPYMT", -3641.95); bankLine(cu, "2026-09-10", "IRS USATAXPYMT", -7283.9);
  near(taxPaidInBank(cu, 2026, T, e.quarters), 3 * share);
  assert.deepEqual(taxEvents(compute(cu, { today: T })).map((x) => x.date), ["2027-01-15"], "nothing past due");
  // paid on time each quarter: each in full
  const ok = freelancer(); for (const d of ["2026-04-15", "2026-06-15", "2026-09-15"]) bankLine(ok, d, "IRS USATAXPYMT", -3641.95);
  near(taxPaidInBank(ok, 2026, T, e.quarters), 3 * share);
});

test("a tax bill typed on Expenses is the person's own plan for the quarters: what it pays in the window comes off them, once (round 5)", async () => {
  const { compute: estimated } = await import("../../taxes/estimated/compute.js");
  const T = "2026-11-02";
  const base = freelancer(), e = estimated(base, { today: T });
  const want = e.behind + e.nextDue.amount; // 10,925.85 behind today and 3,641.95 on January 15
  const p = freelancer();
  p.expenses.push({ id: "e-qt", name: "Quarterly estimated tax", category: "taxes", amount: 4000, period: "quarterly", startDate: "2026-01-15", essential: true });
  const d = compute(p, { today: T });
  const typedOut = d.days.flatMap((x) => x.events.filter((ev) => ev.name === "Quarterly estimated tax").map((ev) => `${x.date} ${ev.amount}`));
  assert.deepEqual(typedOut, ["2027-01-15 -4000"], "the typed bill once, on its date");
  // its $4,000 pays January's quarter line: nothing is taken twice. It is paid on January 15, so it cannot pay what is past
  // due today: that stays as Estimated payments says it (third pass: it took $358.05 off it, so the line read less than owed)
  const ev = taxEvents(d);
  assert.deepEqual(ev.map((x) => x.date), [T], "no second January 15 line");
  assert.match(ev[0].name, /if not paid yet/);
  near(-ev[0].amount, e.behind);
  assert.ok(-ev[0].amount + 4000 >= want, "together at least what is due by January 15");
  // a smaller bill pays part of the quarter: the rest of the quarter stays on its date
  p.expenses[0].amount = 3000;
  const part = taxEvents(compute(p, { today: T }));
  assert.equal(part.length, 2); near(-part[0].amount, e.behind); near(-part[1].amount, e.nextDue.amount - 3000);
  // ended before today: the quarters are back in full
  p.expenses[0].endDate = "2026-06-30";
  near(taxEvents(compute(p, { today: T })).reduce((t, x) => t - x.amount, 0), want);
  // property tax filed under "Taxes not withheld" leaves the quarters in
  const q = freelancer(); q.expenses.push({ id: "e-pt", name: "Property tax", category: "taxes", amount: 4800, period: "annual", essential: true });
  assert.equal(taxEvents(compute(q, { today: T })).length, 2);
  // one dated in the window: the same
  const once = freelancer(); once.expenses.push({ id: "e-q4", name: "Q4 estimated tax", category: "taxes", amount: 3641.95, period: "once", startDate: "2027-01-15", essential: true });
  const o = taxEvents(compute(once, { today: T }));
  assert.equal(o.length, 1); near(-o[0].amount, e.behind);
});

test("which typed bills are the federal estimates: not a payment plan, back taxes, a penalty, a state's tax or another tax (round 5)", async () => {
  const { typedIncomeTax } = await import("./compute.js");
  const typed = (x) => typedIncomeTax({ amount: 100, period: "quarterly", ...x });
  for (const x of [{ name: "Quarterly estimated taxes", category: "taxes" }, { name: "Estimated tax", category: "other" }, { name: "Est. tax", category: "other" }, { name: "1040-ES payment", category: "other" },
    { name: "IRS payment", category: "other" }, { name: "Federal tax", category: "taxes" }, { name: "Taxes", category: "taxes" }, { name: "Self-employment tax", category: "taxes" },
    { name: "Auto-pay estimated tax", category: "taxes" }, { name: "Federal estimated tax (home business)", category: "taxes" }, { name: "Tax estimate", category: "taxes", period: "annual" },
    { name: "Income tax", category: "taxes", period: "monthly" }, { name: "Federal and state estimated tax", category: "taxes" }, { name: "Internal Revenue Service estimated tax", category: "other" },
    { name: "Estimated federal income tax", category: "other", period: "annual" }, { name: "SE tax", category: "other" },
    { name: "IRS", category: "taxes", period: "monthly" }])
    assert.equal(typed(x), true, x.name);
  for (const x of [{ name: "Property tax", category: "taxes" }, { name: "Property tax (quarterly)", category: "taxes" }, { name: "Car registration and tax", category: "taxes" }, { name: "Car tax", category: "taxes" },
    { name: "Tax preparer", category: "taxes" }, { name: "Tax software", category: "taxes" }, { name: "State estimated tax", category: "taxes" }, { name: "Gym", category: "fun" },
    // a debt to the IRS, not this year's estimates
    { name: "IRS payment plan", category: "debt", period: "monthly" }, { name: "IRS installment agreement", category: "taxes", period: "monthly" }, { name: "Payment plan with the IRS", category: "other" },
    { name: "Back taxes (IRS)", category: "other", period: "monthly" }, { name: "IRS penalty", category: "other" }, { name: "Last year's taxes", category: "taxes" }, { name: "IRS", category: "other", period: "monthly" },
    // a state's or a city's tax
    { name: "California estimated tax", category: "taxes" }, { name: "NY estimated tax", category: "taxes" }, { name: "CA FTB estimated tax", category: "taxes" }, { name: "Colorado quarterly tax", category: "taxes" },
    { name: "CO Dept of Revenue", category: "taxes" }, { name: "City income tax", category: "taxes" }, { name: "Franchise tax", category: "taxes" },
    // another tax, or the April bill for last year
    { name: "Quarterly payroll tax", category: "taxes" }, { name: "Quarterly sales tax", category: "taxes" }, { name: "Income tax", category: "taxes", period: "annual" }, { name: "Tax savings", category: "taxes" }])
    assert.equal(typed(x), false, x.name);
  assert.equal(typedIncomeTax({ name: "Estimated tax", amount: 0, period: "quarterly" }), false, "nothing to pay");
  assert.equal(typed({ name: "Estimated tax paid in quarters", category: "taxes" }), true, "'in' is a word, not Indiana");
});

test("names that say estimated win over the softer debt words; an agreement, a penalty or interest never counts (round 5, third pass)", async () => {
  const { typedIncomeTax, irsDueDay } = await import("./compute.js");
  const typed = (x) => typedIncomeTax({ amount: 100, period: "quarterly", ...x });
  // installment is the IRS's own word for the 1040-ES payments; owed, plan, balance and "revenue" yield to "estimated"
  for (const x of [{ name: "Estimated tax installments", category: "taxes" }, { name: "Quarterly installment - estimated tax", category: "taxes" }, { name: "Estimated taxes owed", category: "taxes" },
    { name: "Estimated tax on revenue", category: "taxes" }, { name: "Estimated tax plan", category: "taxes" }, { name: "Estimated tax instalment", category: "taxes" }, { name: "Est. tax installment", category: "other" },
    { name: "Estimated tax (balance of year)", category: "taxes" }, { name: "1040-ES installment", category: "other" },
    // a yearly or one-time federal bill on the 2nd, 3rd or 4th quarter's due date is that quarter
    { name: "IRS Q4 payment", category: "other", period: "once", startDate: "2027-01-15" }, { name: "Federal tax", category: "taxes", period: "once", startDate: "2027-01-15" },
    { name: "IRS payment", category: "taxes", period: "once", startDate: "2027-01-15" }, { name: "IRS payment", category: "other", period: "once", startDate: "2027-06-15" },
    { name: "Federal income tax", category: "taxes", period: "annual", startDate: "2026-09-15" }, { name: "Income tax", category: "taxes", period: "once", startDate: "2028-01-18" }])
    assert.equal(typed(x), true, `${x.name} ${x.period ?? "quarterly"} ${x.startDate ?? ""}`);
  for (const x of [
    // always a debt to the tax office, whatever else the name says
    { name: "Estimated tax installment agreement", category: "taxes" }, { name: "Estimated back taxes", category: "taxes" }, { name: "Estimated tax penalty", category: "taxes" },
    { name: "Estimated tax incl. interest", category: "taxes" }, { name: "IRS lien", category: "taxes", period: "monthly" }, { name: "IRS levy (estimated)", category: "taxes" },
    { name: "Last year's estimated tax", category: "taxes" }, { name: "IRS penalty", category: "other", period: "once", startDate: "2027-01-15" },
    // the softer words without "estimated": a debt
    { name: "IRS payment plan", category: "taxes", period: "quarterly" }, { name: "Taxes owed to the IRS", category: "taxes" }, { name: "IRS balance", category: "taxes" },
    // a department of revenue is a state's; "revenue" alone is one when the name does not say estimated
    { name: "Dept of Revenue estimated tax", category: "taxes" }, { name: "Revenue quarterly tax", category: "taxes" }, { name: "Colorado revenue estimated tax", category: "taxes" },
    // on April 15 a one-time or yearly federal bill may be last year's balance; another day is no quarter
    { name: "IRS payment", category: "taxes", period: "once", startDate: "2027-04-15" }, { name: "Federal tax", category: "taxes", period: "annual", startDate: "2026-04-15" },
    { name: "Federal tax", category: "taxes", period: "once", startDate: "2026-12-01" }, { name: "IRS payment", category: "taxes", period: "once" }])
    assert.equal(typed(x), false, `${x.name} ${x.period ?? "quarterly"} ${x.startDate ?? ""}`);
  assert.equal(irsDueDay("2028-01-18", true), true, "January 15, 2028 is a Saturday and the 17th a holiday: due the 18th");
  assert.equal(irsDueDay("2027-04-15", true), false); assert.equal(irsDueDay("2027-04-15"), true); assert.equal(irsDueDay("2027-02-01"), false);
  // in the forecast: the typed bill is January's quarter, so the quarter goes out once (second pass: twice, $2,800 lower)
  const T = "2026-11-02";
  for (const x of [{ name: "Estimated tax installments", category: "taxes", period: "quarterly", startDate: "2026-01-15" }, { name: "Estimated taxes owed", category: "taxes", period: "quarterly", startDate: "2026-01-15" },
    { name: "Estimated tax on revenue", category: "taxes", period: "quarterly", startDate: "2026-01-15" }, { name: "IRS payment", category: "taxes", period: "once", startDate: "2027-01-15" }]) {
    const p = paidFreelancer(); p.expenses.push({ id: "e-x", amount: 2800, essential: true, ...x });
    assert.deepEqual(taxEvents(compute(p, { today: T })), [], `${x.name}: no quarter line of its own`);
    const d = compute(p, { today: T });
    assert.deepEqual(d.days.flatMap((day) => day.events.filter((ev) => ev.name === x.name).map((ev) => [day.date, ev.amount])), [["2027-01-15", -2800]]);
  }
});

test("an IRS payment plan, back taxes, a penalty or a state's estimated tax typed on Expenses leaves every federal quarter in (round 5)", async () => {
  const { compute: estimated } = await import("../../taxes/estimated/compute.js");
  const T = "2026-11-02";
  const e = estimated(freelancer(), { today: T }), want = e.behind + e.nextDue.amount;
  const total = (d) => taxEvents(d).reduce((t, x) => t - x.amount, 0);
  for (const x of [{ name: "IRS payment plan", category: "debt", amount: 250, period: "monthly" }, { name: "Back taxes (IRS)", category: "other", amount: 150, period: "monthly" },
    { name: "IRS penalty", category: "other", amount: 300, period: "once", startDate: "2026-12-01" }, { name: "California estimated tax", category: "taxes", amount: 400, period: "quarterly", startDate: "2026-01-15" },
    { name: "CA FTB estimated tax", category: "taxes", amount: 400, period: "quarterly", startDate: "2026-01-15" }, { name: "Colorado quarterly tax", category: "taxes", amount: 300, period: "quarterly", startDate: "2026-01-15" }]) {
    const p = freelancer(); p.expenses.push({ id: "e-x", essential: true, ...x });
    const d = compute(p, { today: T });
    near(total(d), want);
    assert.ok(d.days.some((day) => day.events.some((ev) => ev.name === x.name)), `${x.name} is still paid as typed`);
  }
});

test("a typed tax bill with no payment date in the window takes nothing off (round 5)", async () => {
  const { compute: estimated } = await import("../../taxes/estimated/compute.js");
  const T = "2026-11-02";
  const e = estimated(freelancer(), { today: T }), want = e.behind + e.nextDue.amount;
  const total = (d) => taxEvents(d).reduce((t, x) => t - x.amount, 0);
  for (const x of [
    { name: "Estimated taxes", amount: 11200, period: "annual", startDate: "2026-04-15" }, // next on April 15, 2027
    { name: "Quarterly estimated taxes", amount: 4200, period: "quarterly", startDate: "2026-02-01" }, // every three months from February 1: next February 1, after the window
    { name: "Quarterly estimated taxes", amount: 4200, period: "quarterly", startDate: "2027-02-15" }, // starts after the window
    { name: "Q1 estimated tax", amount: 3600, period: "once", startDate: "2027-04-15" }]) {
    const p = freelancer(); p.expenses.push({ id: "e-x", category: "taxes", essential: true, ...x });
    const d = compute(p, { today: T });
    assert.ok(!d.days.some((day) => day.events.some((ev) => ev.name === x.name)), `${x.name}: not in the 90 days`);
    near(total(d), want);
  }
});

test("a payment pays only the quarter lines due on or after its own date; a quarterly tax bill with no date is paid on the IRS's dates (round 5, third pass)", async () => {
  const { estimatedLines } = await import("./compute.js");
  const { compute: estimated } = await import("../../taxes/estimated/compute.js");
  const { ARCHETYPES } = await import("../../../qa/households/lib/catalog.mjs");
  // a payment after January 15 never pays January's quarter: the money would leave later than it is due
  const f = freelancer(), T0 = "2026-11-20", e0 = estimated(f, { today: T0 });
  const late = estimatedLines(f, T0, "2027-02-18", [{ date: "2027-02-01", amount: -4200, payee: "Quarterly estimated taxes", typedTax: true }]);
  assert.deepEqual(late.map((x) => x.date), [T0, "2027-01-15"]); near(-late[0].amount, e0.behind); near(-late[1].amount, e0.nextDue.amount);
  // one on January 15 pays it, and only it: what is past due today stays
  const onTime = estimatedLines(f, T0, "2027-02-18", [{ date: "2027-01-15", amount: -4200, payee: "Quarterly estimated taxes", typedTax: true }]);
  assert.deepEqual(onTime.map((x) => x.date), [T0]); near(-onTime[0].amount, e0.behind);
  // the qa self-employed household ("Quarterly estimated taxes" $4,200, no date; dated January 15 in the other case),
  // on days other than November 2: the past-due line is what Estimated payments says is behind, and the bill is paid
  // on January 15 or September 15 and pays that quarter, never February 1 or December 1 (second pass: on November 20
  // the line read $4,748.60 against $6,711.45 behind, and on September 15 the 3rd quarter moved to a December 1 bill)
  const hh = () => ARCHETYPES.find((a) => a.id === "11-self-employed").build();
  for (const dated of [false, true]) for (const [T, billDay] of [["2026-11-20", "2027-01-15"], ["2027-01-05", "2027-01-15"], ["2027-09-15", "2027-09-15"]]) {
    const p = hh(); if (dated) p.expenses.find((x) => x.id === "e-tax").startDate = "2026-01-15";
    const d = compute(p, { today: T });
    const bill = d.days.flatMap((x) => x.events.filter((ev) => ev.name === "Quarterly estimated taxes").map((ev) => [x.date, ev.amount]));
    assert.deepEqual(bill, [[billDay, -4200]], `${T} ${dated ? "dated" : "no date"}: the bill on the IRS's day`);
    const ev = taxEvents(d);
    assert.deepEqual(ev.map((x) => x.date), [T], `${T}: only the past-due line; the quarter is the typed bill`);
    if (T === "2027-09-15") {
      // the 3rd quarter is due today with the bill: the bill pays it, and the rest of the bill part of what is past due
      const e = estimated(p, { today: T });
      near(-ev[0].amount, e.behind + e.nextDue.amount - 4200);
    } else {
      const e = estimated(T.startsWith("2027-01") ? { ...p, taxes: { ...(p.taxes ?? {}), year: 2026 } } : p, { today: T });
      near(-ev[0].amount, e.behind);
      assert.ok(e.behind > 6700 && e.nextDue.due === "2027-01-15");
    }
  }
  // the freelancer with three quarters paid and an undated $2,800 quarterly bill, on January 5: one January 15 payment,
  // the typed bill (second pass: the bill fell on April 1 and January's quarter went out as well)
  const p = paidFreelancer(); p.expenses.push({ id: "e-q", name: "Quarterly estimated tax", category: "taxes", amount: 2800, period: "quarterly", essential: true });
  const d = compute(p, { today: "2027-01-05" });
  assert.deepEqual(taxEvents(d), []);
  const jan15 = d.days.find((x) => x.date === "2027-01-15").events.filter((ev) => /tax/i.test(ev.name));
  assert.deepEqual(jan15.map((ev) => [ev.name, ev.amount]), [["Quarterly estimated tax", -2800]]);
  assert.ok(!d.days.some((x) => x.date !== "2027-01-15" && x.events.some((ev) => /tax/i.test(ev.name))), "nothing on April 1");
});

test("bank payments: January 16 to April 15 count at most as the 1st quarter, later ones in full (round 5, third pass)", async () => {
  const { taxPaidInBank } = await import("./compute.js");
  const { compute: estimated } = await import("../../taxes/estimated/compute.js");
  const T = "2026-11-02";
  const base = () => { const p = paidFreelancer(); delete p.taxes.estimated; return p; };
  const e = estimated(base(), { today: T });
  assert.equal(e.perQuarter, 2800);
  // paying more than the minimum each quarter: $3,500 three times counts $10,500, as the same three typed on Estimated
  // payments (second pass: $8,400, and January's line read $2,800 instead of $700)
  const p = base(); for (const day of ["2026-04-15", "2026-06-15", "2026-09-15"]) bankLine(p, day, "IRS USATAXPYMT", -3500);
  assert.equal(taxPaidInBank(p, 2026, T, e.quarters), 10500);
  const bank = taxEvents(compute(p, { today: T }));
  const typed = base(); typed.taxes.estimated = { paid: [3500, 3500, 3500, 0] };
  assert.deepEqual(bank.map((x) => [x.date, x.amount]), [["2027-01-15", -700]]);
  assert.deepEqual(taxEvents(compute(typed, { today: T })).map((x) => [x.date, x.amount]), [["2027-01-15", -700]]);
  // last year's balance with the 1st quarter in April, then the regular $2,800: April counts as $2,800
  const bal = base(); bankLine(bal, "2026-04-15", "IRS USATAXPYMT", -6000); bankLine(bal, "2026-06-15", "IRS USATAXPYMT", -2800); bankLine(bal, "2026-09-15", "IRS USATAXPYMT", -2800);
  assert.equal(taxPaidInBank(bal, 2026, T, e.quarters), 8400);
  // April's balance and a September catch-up of two quarters: June shows nothing paid, so April still counts as one quarter
  const cu = base(); bankLine(cu, "2026-04-15", "IRS USATAXPYMT", -6000); bankLine(cu, "2026-09-10", "IRS USATAXPYMT", -5600);
  assert.equal(taxPaidInBank(cu, 2026, T, e.quarters), 8400);
  // only April so far (May 1): its 1st-quarter share
  const may = base(); bankLine(may, "2026-04-15", "IRS USATAXPYMT", -3500);
  assert.equal(taxPaidInBank(may, 2026, "2026-05-01", e.quarters), 2800);
  // a payment after April 15 that is bigger than a quarter counts in full
  const big = base(); bankLine(big, "2026-04-15", "IRS USATAXPYMT", -2800); bankLine(big, "2026-06-15", "IRS USATAXPYMT", -5000);
  assert.equal(taxPaidInBank(big, 2026, T, e.quarters), 7800);
});

test("last year's 4th quarter comes only from business income in that tax year (round 5, third pass)", () => {
  // other income that needs estimates (rent), and business income that starts January 1: no 2026 quarters on January 5
  const p = freelancer();
  p.income[0].startDate = "2027-01-01";
  p.income.push({ id: "i-rent", name: "Rent from the flat", type: "rental", personId: "dee", amount: 3000, period: "monthly", growth: 0, startDate: "", endDate: "", taxable: true });
  assert.deepEqual(taxEvents(compute(p, { today: "2027-01-05" })).filter((x) => /2026/.test(x.name)), [], "consulting from January 1 brings no quarters of the year before");
  // business income in 2026 that goes on (from the start of the year, or from June): its 4th quarter is still due January 15
  for (const start of ["", "2026-06-01"]) {
    const q = freelancer(); q.income[0].startDate = start;
    q.income.push({ id: "i-rent", name: "Rent from the flat", type: "rental", personId: "dee", amount: 3000, period: "monthly", growth: 0, startDate: "", endDate: "", taxable: true });
    const ev = taxEvents(compute(q, { today: "2027-01-05" }));
    assert.ok(ev.some((x) => x.date === "2027-01-15" && /4th quarter of 2026/.test(x.name)), `from "${start}": January 15's quarter of 2026`);
  }
});

test("only business income coming in today brings the quarters: not one that starts next year or has ended (round 5)", () => {
  const T = "2026-11-02";
  const later = freelancer(); later.income[0].startDate = "2027-01-01";
  assert.deepEqual(taxEvents(compute(later, { today: T })), []);
  const ended = freelancer(); ended.income[0].endDate = "2026-06-30";
  assert.deepEqual(taxEvents(compute(ended, { today: T })), []);
  assert.equal(taxEvents(compute(freelancer(), { today: T })).length, 2);
});

test("January 1 to 15: last year's 4th quarter, due January 15, stays in the forecast (round 5)", async () => {
  const { compute: estimated } = await import("../../taxes/estimated/compute.js");
  const p = freelancer();
  p.taxes = { ...(p.taxes ?? {}), estimated: { paid: [3000, 3000, 3000, 0], typedAt: "2026-10-01" } };
  const last = estimated({ ...p, taxes: { ...p.taxes, year: 2026 } }, { today: "2027-01-05" });
  const ev = taxEvents(compute(p, { today: "2027-01-05" }));
  assert.deepEqual(ev.map((x) => [x.date, x.name]), [["2027-01-05", "Estimated tax for 2026 past due (Estimated payments)"], ["2027-01-15", "Estimated tax, 4th quarter of 2026 (Estimated payments)"]]);
  assert.ok(Math.abs(-ev[0].amount - last.behind) < 0.02);
  assert.ok(Math.abs(-ev[0].amount - ev[1].amount - (last.remaining)) < 0.02, "together: what 2026 still needs");
  // after its due date it is the April bill, not a quarter; the year set on the Federal estimate is that year alone
  assert.ok(!taxEvents(compute(p, { today: "2027-01-16" })).some((x) => /2026/.test(x.name)));
  p.taxes.year = 2027;
  assert.ok(!taxEvents(compute(p, { today: "2027-01-05" })).some((x) => /2026/.test(x.name)));
});

test("business income typed as a typical year stays spread after an edit that starts a new amount later (round 5)", () => {
  const T = "2026-11-02";
  const p = freelancer();
  p.income = [{ ...p.income[0], endDate: "2026-11-30" }, { id: "x7k2", name: "Dee's business", type: "business", personId: "dee", amount: 90000, period: "annual", growth: 0, startDate: "2026-12-01", endDate: "", taxable: true, typicalYear: true }];
  const dep = compute(p, { today: T }).days.flatMap((x) => x.events.filter((e) => e.name === "Dee's business").map((e) => [x.date, e.amount]));
  assert.deepEqual(dep, [["2026-11-15", 6500], ["2026-12-01", 7500], ["2027-01-01", 7500]]);
  // without the marker, a business income typed a year on Income is a once-a-year payment and lands once
  delete p.income[1].typicalYear;
  assert.ok(compute(p, { today: T }).days.some((x) => x.events.some((e) => e.name === "Dee's business" && e.amount === 90000)));
});

test("a bank line covers a typed item only going the same way, and not by a word every bank line shares (review 2026-11-02)", () => {
  const T = "2026-11-02";
  const p = emptyPlan();
  p.household = { ...(p.household ?? {}), people: [{ id: "dee", name: "Dee", role: "self", birthDate: "1990-04-01" }], state: "TX", filingStatus: "single" };
  p.accounts = [{ id: "chk", name: "Checking", type: "checking", balance: 8000 }];
  p.income = [{ id: "i-biz", name: "Dee's business", type: "business", personId: "dee", amount: 6500, period: "monthly", growth: 0, startDate: "", endDate: "", taxable: true }];
  p.transactions = [];
  let n = 0;
  for (const m of ["2026-07", "2026-08", "2026-09", "2026-10"]) p.transactions.push({ id: `t${++n}`, date: `${m}-05`, amount: -89.99, payee: "Comcast Business", rawPayee: "COMCAST BUSINESS", accountId: "chk", category: "utilities", tags: [], note: "" });
  const d = compute(p, { today: T, days: 90 });
  const biz = d.days.flatMap((x) => x.events).filter((x) => x.name === "Dee's business");
  assert.ok(biz.length >= 2, "the business income still lands though a bill says 'business'");
});

test("a payment pays the earliest quarter it may: '1040-ES Q1' on April 1 pays April 15, June 15 stays (round 5 recheck)", () => {
  const T = "2027-03-20";
  const quarters = (d) => taxEvents(d).map((x) => [x.date, Math.round(x.amount)]);
  const before = quarters(compute(freelancer(), { today: T }));
  const apr = before.find(([date]) => date === "2027-04-15"), jun = before.find(([date]) => date === "2027-06-15");
  assert.ok(apr && jun, "both quarters are in the 90 days");
  const p = freelancer(); p.expenses.push({ id: "e-q1", name: "1040-ES Q1", category: "taxes", amount: -apr[1], period: "once", startDate: "2027-04-01", essential: true });
  const after = quarters(compute(p, { today: T }));
  assert.deepEqual(after, [jun], "the 1st quarter is paid on April 1; the 2nd is still due June 15");
});

test("a quarter word wins over 'owe'; NYS and a school district are not the federal quarters (round 5 recheck)", async () => {
  const { typedIncomeTax } = await import("./compute.js");
  const typed = (x) => typedIncomeTax({ amount: 100, period: "quarterly", category: "taxes", ...x });
  for (const name of ["Quarterly tax I owe", "Taxes owed (quarterly)", "Taxes I owe each quarter"]) assert.equal(typed({ name }), true, name);
  for (const name of ["NYS estimated tax", "School district income tax", "IRS payment plan", "Taxes owed to the IRS"]) assert.equal(typed({ name }), false, name);
});

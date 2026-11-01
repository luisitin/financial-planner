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
  assert.equal(filed.debtFromDebts, 0);
  assert.ok(!filed.days.flatMap((x) => x.events).some((e) => e.fromDebts), "something is filed under loan and card payments: the Debts page is not added (F-019)");
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

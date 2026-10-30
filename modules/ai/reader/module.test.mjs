import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, firstMoney, firstPercent, firstDate, lastDate, detectKind, readFields, buildPrompt, parseAnswer, applyProposal } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";

const TODAY = "2026-10-30";
const STUB = "EARNINGS STATEMENT\nPay Date: 10/24/2026\nPay Period: 10/04/2026 - 10/17/2026\n  Current  YTD\nGross Pay 4,050.00 81,000.00\nFederal Income Tax 412.18 8,243.60\n401(k) 486.00 9,720.00\nNet Pay 2,842.00 56,840.00";
const STATEMENT = "Statement Period: 09/01/2026 to 09/30/2026\nAccount Number: XXXX1234\nBeginning Balance $10,950.11\nEnding Balance $11,812.40";
const SSA = "Your Social Security Statement\nAt age 62 your payment would be about $1,840 a month\nAt your full retirement age (67) $2,710 a month\nAt age 70 $3,360 a month";
const ADVISOR = "Key assumptions\nEquity return: 8.0% per year\nFixed income return 4.5%\nInflation: 2.5%\nAdvisory fee 1.00% of assets\nRetirement age 62\nRetirement spending $90,000 per year\nProbability of success: 91%";

test("money, percents and dates in text", () => {
  assert.equal(firstMoney("Total 2026 $1,234"), 1234, "the year is skipped");
  assert.equal(firstMoney("Net Pay 2,842.00 56,840.00"), 2842);
  assert.equal(firstMoney("(45.10)"), -45.1); assert.equal(firstMoney("-$12.00"), -12); assert.equal(firstMoney("$90"), 90);
  assert.equal(firstMoney("age 67 in 2026"), null);
  assert.equal(firstPercent("return 6.5% a year"), 0.065);
  assert.equal(firstDate("10/24/2026"), "2026-10-24"); assert.equal(firstDate("3/5/26"), "2026-03-05"); assert.equal(firstDate("March 5, 2026"), "2026-03-05"); assert.equal(firstDate("5 Mar 2026"), "2026-03-05"); assert.equal(firstDate("2026-1-2"), "2026-01-02");
  assert.equal(lastDate("09/01/2026 to 09/30/2026"), "2026-09-30"); assert.equal(lastDate("10/04/2026 - 10/17/2026"), "2026-10-17");
});

test("the kind of document from its words", () => {
  assert.equal(detectKind(STUB), "paystub"); assert.equal(detectKind(STATEMENT), "statement"); assert.equal(detectKind(SSA), "ssa"); assert.equal(detectKind(ADVISOR), "advisor");
  assert.equal(detectKind("hello"), null);
});

test("a pay stub: the current column, the period from its dates", () => {
  const f = readFields("paystub", STUB);
  assert.deepEqual(f, { gross: 4050, net: 2842, federal: 412.18, k401: 486, payDate: "2026-10-24", periodStart: "2026-10-04", periodEnd: "2026-10-17", period: "biweekly" });
  assert.equal(readFields("paystub", "Gross pay 2,000.00\nPay period 01/01/2026 - 01/31/2026").period, "monthly");
});

test("a statement, a Social Security statement, an advisor's plan (a yearly spending figure becomes a month)", () => {
  assert.deepEqual(readFields("statement", STATEMENT), { balance: 11812.4, date: "2026-09-30" });
  assert.deepEqual(readFields("ssa", SSA), { monthlyAtFRA: 2710, at70: 3360, at62: 1840 });
  assert.deepEqual(readFields("advisor", ADVISOR), { returnStocks: 0.08, returnBonds: 0.045, inflation: 0.025, fee: 0.01, quotedChance: 0.91, retireAge: 62, spendingMonthly: 7500 });
});

test("proposals against the plan, and applying them", () => {
  const p = familyPlan(TODAY);
  const d = compute(p, { text: STUB, personId: "p-ana", today: TODAY });
  assert.deepEqual(d.proposals.map((x) => x.op), ["income", "withholding", "contribution"]);
  assert.deepEqual(d.proposals[0].before, { amount: 3900, period: "biweekly", yearly: 101400 });
  for (const x of d.proposals) applyProposal(p, x);
  assert.equal(p.income.find((i) => i.id === "i-ana").amount, 4050);
  assert.deepEqual(p.taxes.withholding.self, { perPaycheck: 412.18, period: "biweekly" });
  assert.equal(p.retirement.contributions.find((c) => c.id === "c-ana").amount, 486);

  const s = compute(p, { text: STATEMENT, accountId: "a-sav", today: TODAY });
  applyProposal(p, s.proposals[0]);
  const a = p.accounts.find((x) => x.id === "a-sav");
  assert.equal(a.balance, 11812.4); assert.equal(a.asOf, "2026-09-30"); assert.deepEqual(a.history.at(-1), { date: "2026-09-30", balance: 11812.4 });
  assert.equal(compute(p, { text: STATEMENT, today: TODAY }).proposals.length, 0, "no account chosen, no change");

  applyProposal(p, compute(p, { text: SSA, personId: "p-bo" }).proposals[0]);
  assert.equal(p.retirement.socialSecurity["p-bo"].monthlyAtFRA, 2710); assert.equal(p.retirement.socialSecurity["p-bo"].claimAge, 67, "the rest kept");

  applyProposal(p, compute(p, { text: ADVISOR, personId: "p-ana" }).proposals[0]);
  assert.deepEqual(p.advisor.changes, { returnStocks: 0.08, returnBonds: 0.045, inflation: 0.025, spendingMonthly: 7500, "retireAge:p-ana": 62 });
  assert.equal(p.advisor.fee, 0.01); assert.equal(p.advisor.quotedChance, 0.91);

  const fresh = familyPlan(TODAY); fresh.income = [];
  applyProposal(fresh, compute(fresh, { text: STUB, personId: "p-bo" }).proposals[0], { newId: () => "new" });
  assert.deepEqual(fresh.income[0], { id: "new", name: "Bo's pay", type: "salary", personId: "p-bo", amount: 4050, period: "biweekly", growth: 0.03, taxable: true });
});

test("the AI's answer: only known keys, numbers checked, percents as fractions, never trusted blindly", () => {
  const msgs = buildPrompt("ssa", SSA);
  assert.equal(msgs[0].role, "system"); assert.match(msgs[1].content, /monthlyAtFRA/);
  assert.deepEqual(parseAnswer("advisor", 'Here: {"returnStocks": "7.5%", "fee": 0.008, "bogus": 3, "inflation": null}'), { returnStocks: 0.075, fee: 0.008 });
  assert.deepEqual(parseAnswer("statement", '{"balance": "$1,200.50", "date": "Sept 30, 2026"}'), { balance: 1200.5, date: "2026-09-30" });
  assert.deepEqual(parseAnswer("paystub", "no json here"), {});
  const d = compute(familyPlan(TODAY), { text: "Gross pay 1,000.00", kind: "paystub", extra: { net: 800 } });
  assert.equal(d.fields.net, 800); assert.ok(d.found.some((f) => f.key === "net"));
});

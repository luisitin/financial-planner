import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, dueDay, taxHolidays, periodDates, toIcs, saveReminder, removeReminder, RANGES } from "./compute.js";
import { MARKETPLACE, MEDICARE_OPEN } from "./data/dates.js";
import { samplePlan } from "../../../qa/fixtures/sample-plan.mjs";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

test("tax due dates move off weekends and the two holidays that can land on them (IRC 7503)", () => {
  assert.equal(dueDay("2027-04-15"), "2027-04-15", "a Thursday");
  assert.equal(dueDay("2028-04-15"), "2028-04-18", "a Saturday; Monday the 17th is Emancipation Day observed (April 16 a Sunday)");
  assert.equal(dueDay("2026-06-13"), "2026-06-15", "a plain Saturday moves to Monday");
  assert.equal(dueDay("2022-04-15"), "2022-04-18", "Friday April 15, 2022 was Emancipation Day observed (April 16 a Saturday): due Monday the 18th");
  assert.equal(dueDay("2023-04-15"), "2023-04-18", "Saturday; Monday the 17th was Emancipation Day observed (April 16 a Sunday): due the 18th");
  assert.equal(dueDay("2029-01-15"), "2029-01-16", "January 15, 2029 is Martin Luther King Jr. Day");
  assert.equal(dueDay("2027-01-31"), "2027-02-01", "a Sunday");
  assert.deepEqual([...taxHolidays(2026)].sort(), ["2026-01-19", "2026-04-16"]);
  assert.deepEqual([...taxHolidays(2026, "MA")].sort(), ["2026-01-19", "2026-04-16", "2026-04-20"], "Patriots' Day, the third Monday of April, in Maine and Massachusetts");
  assert.equal(dueDay("2024-04-15", "ME"), "2024-04-17"); assert.equal(dueDay("2026-04-15", "MA"), "2026-04-15", "Patriots' Day 2026 is the 20th: no change");
});

test("dates on a period: weekly, every two weeks, monthly (the day kept, short months clamped), twice a month", () => {
  assert.deepEqual(periodDates("2026-10-02", "biweekly", "2026-10-31", "2026-11-30"), ["2026-11-13", "2026-11-27"]);
  assert.deepEqual(periodDates("2026-01-31", "monthly", "2026-10-31", "2026-12-31"), ["2026-10-31", "2026-11-30", "2026-12-31"]);
  assert.deepEqual(periodDates("2026-01-01", "semimonthly", "2026-10-31", "2026-11-30"), ["2026-10-31", "2026-11-15", "2026-11-30"]);
  assert.deepEqual(periodDates("2026-11-03", "weekly", "2026-10-31", "2026-11-20"), ["2026-11-03", "2026-11-10", "2026-11-17"], "nothing before the start");
  assert.deepEqual(periodDates("2026-01-01", "once", "2026-10-31", "2026-11-30"), []);
  assert.deepEqual(periodDates("bad", "weekly", "2026-10-31", "2026-11-30"), []);
});

test("bills from the repeating bank lines; tax dates for a household with pay and an IRA", () => {
  const p = samplePlan();   // the rent repeats monthly (the only steady series in the sample)
  const d = compute(p, { today: "2026-09-16", range: "month" });
  assert.deepEqual(d.events.filter((e) => e.kind === "bill").map((e) => [e.date, e.title, e.amount, e.go.join("/")]), [["2026-10-01", "Oak Street Apartments", -1500, "cashflow/recurring"]]);
  assert.equal(d.to, "2026-10-16"); assert.equal(RANGES.month, 31);
  assert.ok(d.events.every((e, i, a) => !i || a[i - 1].date <= e.date), "in date order");
  // a year ahead from October 31, 2026 for a household with a salary and an IRA
  const q = emptyPlan();
  q.income = [{ id: "s", name: "Pay", type: "salary", amount: 5000, period: "monthly" }];
  q.accounts = [{ id: "ira", name: "IRA", type: "ira", balance: 1000 }];
  const f = compute(q, { today: "2026-10-31", range: "year" });
  const titles = f.events.map((e) => `${e.date} ${e.title}`);
  assert.ok(titles.includes("2027-02-01 W-2 pay forms due from employers"), "January 31, 2027 is a Sunday");
  assert.ok(titles.includes("2027-04-15 Tax return for 2026 due"));
  assert.ok(titles.includes("2027-04-15 Last day to put money in an IRA or health savings account for 2026"));
  assert.ok(titles.includes("2027-10-15 Tax return for 2026 due if you asked for more time"));
  assert.ok(!f.events.some((e) => /Estimated tax/.test(e.title)), "no estimated payments without business or rental income or payments made");
  // business or rental income brings them
  q.income.push({ id: "r", name: "Rent", type: "rental", amount: 900, period: "monthly" });
  assert.deepEqual(compute(q, { today: "2026-10-31", range: "year" }).events.filter((e) => /Estimated tax/.test(e.title)).map((e) => e.date), ["2027-01-15", "2027-04-15", "2027-06-15", "2027-09-15"]);
});

test("estimated payments, Medicare and Marketplace open enrollment, required withdrawals", () => {
  const p = familyPlan("2026-10-31");
  p.taxes = { ...(p.taxes ?? {}), estimated: { paid: [500, 0, 0, 0] } };
  p.household.people[0].birthDate = "1952-03-10";   // Ana: 74, required withdrawals began 2025 (age 73)
  p.insurance = { policies: [{ id: "h", kind: "health", name: "Own plan", throughWork: false }, { id: "car", kind: "auto", name: "Car policy", renewalDate: "2026-03-01" }, { id: "t", kind: "term", name: "Term life", endDate: "2027-06-30" }] };
  p.goals = [{ id: "g", name: "New roof", targetDate: "2027-05-01" }];
  const d = compute(p, { today: "2026-10-31", range: "year" });
  const t = (re) => d.events.filter((e) => re.test(e.title)).map((e) => e.date);
  assert.deepEqual(t(/Estimated tax payment/), ["2027-01-15", "2027-04-15", "2027-06-15", "2027-09-15"]);
  assert.deepEqual(t(/Medicare open enrollment opens/), ["2027-10-15"], "this year's opened before today");
  assert.deepEqual(MEDICARE_OPEN, { from: [10, 15], to: [12, 7] });
  assert.deepEqual(t(/Medicare open enrollment ends/), ["2026-12-07"]);
  assert.deepEqual(t(/Marketplace open enrollment for 2027 opens/), ["2026-11-01"]);
  assert.deepEqual(t(/Last day to choose a Marketplace plan/), [MARKETPLACE[2027].forJanuary]);
  assert.deepEqual(t(/required withdrawal for/), ["2026-12-31"], "Ana owns the 401(k) a-401");
  assert.deepEqual(t(/first required withdrawal/), []);
  assert.deepEqual(t(/Car policy renews/), ["2027-03-01"], "a past renewal day comes round again");
  assert.deepEqual(t(/Term life ends/), ["2027-06-30"]); assert.deepEqual(t(/Goal date: New roof/), ["2027-05-01"]);
  // someone reaching the starting age gets the April 1 deadline the next year
  p.household.people[0].birthDate = "1953-06-01";   // 73 in 2026: first deadline April 1, 2027
  assert.deepEqual(compute(p, { today: "2026-10-31", range: "year" }).events.filter((e) => /first required withdrawal/.test(e.title)).map((e) => e.date), ["2027-04-01"]);
  // filtering by kind and the counts
  const h = compute(p, { today: "2026-10-31", range: "year", kinds: ["health"] });
  assert.ok(h.events.every((e) => e.kind === "health")); assert.equal(h.counts.health, h.events.length);
});

test("paydays from the Income page when the bank lines show none, and your own reminders", () => {
  const p = emptyPlan();
  p.income = [{ id: "i1", name: "Pay", type: "salary", amount: 2000, period: "biweekly", startDate: "2026-10-23" }, { id: "i2", name: "Side pay", type: "salary", amount: 100, period: "monthly" }];
  saveReminder(p, { id: "r1", name: "Open enrollment at work", date: "2025-11-10", repeat: "yearly" });
  saveReminder(p, { id: "r2", name: "Property tax", date: "2026-12-01", repeat: "none", amount: "1800" });
  const d = compute(p, { today: "2026-10-31", range: "quarter" });
  assert.deepEqual(d.events.filter((e) => e.kind === "pay").map((e) => e.date), ["2026-11-06", "2026-11-20", "2026-12-04", "2026-12-18", "2027-01-01", "2027-01-15", "2027-01-29"]);
  assert.match(d.notes[0], /Add the first payday to "Side pay"/);
  assert.deepEqual(d.events.filter((e) => e.kind === "mine").map((e) => [e.date, e.title, e.amount]), [["2026-11-10", "Open enrollment at work", null], ["2026-12-01", "Property tax", 1800]]);
  assert.deepEqual(d.months.map((m) => m.month), ["2026-11", "2026-12", "2027-01"]);
  assert.equal(removeReminder(p, "r2"), true); assert.equal(removeReminder(p, "r2"), false);
  assert.deepEqual(compute(p, {}).events, [], "no date, no list");
});

test("the calendar file: one all-day event each, escaped and folded (RFC 5545)", () => {
  const ics = toIcs([{ date: "2027-04-15", kind: "tax", title: "Tax return for 2026 due, or ask; for more", detail: "Line one\nline two" }, { date: "2027-12-31", kind: "retire", title: "x".repeat(100) }], { stamp: "20261031T000000Z" });
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")); assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20270415\r\nDTEND;VALUE=DATE:20270416"));
  assert.ok(ics.includes("SUMMARY:Tax return for 2026 due\\, or ask\\; for more"));
  assert.ok(ics.includes("DESCRIPTION:Line one\\nline two"));
  assert.ok(ics.split("\r\n").every((l) => l.length <= 75), "folded at 75");
  assert.equal(ics.match(/BEGIN:VEVENT/g).length, 2);
  assert.ok(ics.includes("DTEND;VALUE=DATE:20280101"), "the day after December 31");
});

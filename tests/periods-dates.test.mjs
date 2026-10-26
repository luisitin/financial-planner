// tests/periods-dates.test.mjs -- core/math/periods.js and core/math/dates.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PERIODS, perYear, perMonth, activeOn, periodLabel } from "../core/math/periods.js";
import { ageOn, monthsBetween, yearsBetween, addMonths, dateAtAge, daysBetween, isValidDate, isoOf } from "../core/math/dates.js";

test("periods: per year and per month", () => {
  assert.equal(perYear(100, "monthly"), 1200);
  assert.equal(perYear(100, "biweekly"), 2600);
  assert.equal(perYear(100, "weekly"), 5200);
  assert.equal(perYear(100, "semimonthly"), 2400);
  assert.equal(perYear(100, "quarterly"), 400);
  assert.equal(perYear(100, "annual"), 100);
  assert.equal(perYear(100, "once"), 0);
  assert.equal(perMonth(1200, "annual"), 100);
  assert.equal(Math.round(perMonth(1000, "biweekly") * 100) / 100, 2166.67);
  assert.equal(perMonth("abc", "monthly"), 0);
  assert.equal(perYear(50, "not-a-period"), 600, "unknown period is treated as monthly");
  assert.equal(periodLabel("biweekly"), PERIODS.biweekly.label);
});
test("activeOn: start and end dates", () => {
  assert.equal(activeOn({}, "2026-09-15"), true);
  assert.equal(activeOn({ startDate: "2026-10-01" }, "2026-09-15"), false);
  assert.equal(activeOn({ startDate: "2026-09-15" }, "2026-09-15"), true);
  assert.equal(activeOn({ endDate: "2026-09-14" }, "2026-09-15"), false);
  assert.equal(activeOn({ endDate: "2026-09-15" }, "2026-09-15"), true);
});
test("ageOn is birthday-aware", () => {
  assert.equal(ageOn("2000-06-15", "2026-06-14"), 25);
  assert.equal(ageOn("2000-06-15", "2026-06-15"), 26);
  assert.equal(ageOn("2000-06-15", "2026-09-15"), 26);
  assert.equal(ageOn("2000-02-29", "2026-02-28"), 25);
  assert.equal(ageOn("", "2026-09-15"), null);
  assert.equal(ageOn("bad", "2026-09-15"), null);
});
test("monthsBetween / yearsBetween / addMonths / dateAtAge / daysBetween", () => {
  assert.equal(monthsBetween("2026-09-15", "2027-09-15"), 12);
  assert.equal(monthsBetween("2026-09-15", "2027-09-14"), 11);
  assert.equal(monthsBetween("2026-09-15", "2026-03-15"), -6);
  assert.equal(yearsBetween("2026-01-01", "2028-07-01"), 2.5);
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-09-15", 12), "2027-09-15");
  assert.equal(addMonths("2026-09-15", -9), "2025-12-15");
  assert.equal(dateAtAge("1990-05-20", 65), "2055-05-20");
  assert.equal(daysBetween("2026-09-01", "2026-09-15"), 14);
  assert.equal(daysBetween("2026-09-15", "2026-09-01"), -14);
  assert.equal(isValidDate("2026-02-30"), false);
  assert.equal(isValidDate("2026-02-28"), true);
  assert.equal(isoOf(2026, 13, 1), "2027-01-01");
});

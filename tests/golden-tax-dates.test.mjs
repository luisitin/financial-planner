// tests/golden-tax-dates.test.mjs -- household/calendar's federal due-date rule (IRC 7503: a Saturday, Sunday or legal
// holiday moves a due date to the next business day) against due dates the IRS itself published, never against this
// repo's code. Each row names the IRS document that states the date. Read 2026-10-31.
import test from "node:test";
import assert from "node:assert/strict";
import { dueDay } from "../modules/household/calendar/compute.js";

const KEY = [
  // [the nominal day, the household's state, the published due day, why it moved, the IRS source]
  ["2018-04-15", "", "2018-04-17", "April 15 a Sunday, April 16 Emancipation Day (a Monday)", "2017 Form 1040 instructions: \"File Form 1040 by April 17, 2018\""],
  ["2023-04-15", "", "2023-04-18", "April 15 a Saturday, Emancipation Day observed Monday April 17", "Publication 509 (2023); Publication 17 (2022): \"by April 18, 2023\""],
  ["2023-01-15", "", "2023-01-17", "January 15 a Sunday, Martin Luther King Jr. Day Monday the 16th", "Publication 509 (2023): the 2022 estimated tax by January 17"],
  ["2024-01-15", "", "2024-01-16", "January 15 was Martin Luther King Jr. Day", "Publication 509 (2024): the 2023 estimated tax by January 16, 2024"],
  ["2024-04-15", "", "2024-04-15", "a Monday, no holiday", "Publication 509 (2024): April 15"],
  ["2024-04-15", "MA", "2024-04-17", "Patriots' Day April 15, then Emancipation Day April 16", "Publication 509 (2024): \"April 15 (April 17 in Maine or Massachusetts)\""],
  ["2024-04-15", "ME", "2024-04-17", "the same in Maine", "Publication 509 (2024)"],
];

for (const [nominal, state, published, why, source] of KEY) {
  test(`${nominal}${state ? ` in ${state}` : ""} is due ${published} (${why})`, () => {
    assert.equal(dueDay(nominal, state), published, source);
  });
}

test("the rule from IRS Notice 2011-17 for Emancipation Day: a Saturday April 16 is kept on Friday the 15th, a Sunday on Monday the 17th", () => {
  assert.equal(dueDay("2022-04-15"), "2022-04-18", "2022: April 16 a Saturday, so Friday the 15th is the holiday and the deadline is Monday the 18th");
  assert.equal(dueDay("2028-04-15"), "2028-04-18", "2028: April 15 a Saturday, April 16 a Sunday, so Monday the 17th is the holiday");
});

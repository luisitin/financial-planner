// tests/format.test.mjs -- display formatting. Dates are the important part: a plan date is a
// calendar day with no time zone, and must never show as the day before.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as fmt from "../core/format.js";

test("date-only strings show the same calendar day in any time zone", () => {
  assert.equal(fmt.date("2026-09-15"), "9/15/2026");
  assert.equal(fmt.date("2026-01-01"), "1/1/2026");
  assert.equal(fmt.date(""), "-");
  assert.equal(fmt.date("not a date"), "not a date");
});
test("today is the local calendar day", () => {
  const d = new Date();
  assert.equal(fmt.today(), `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
});
test("money, pct, num, signed", () => {
  assert.equal(fmt.money(1234.5), "$1,235");
  assert.equal(fmt.money(-20), "-$20");
  assert.equal(fmt.money("x"), "-");
  assert.equal(fmt.pct(0.0725), "7.3%");
  assert.equal(fmt.num(1234567.891, 1), "1,234,567.9");
  assert.equal(fmt.signed(-5), "-$5");
  assert.equal(fmt.signed(5), "+$5");
});

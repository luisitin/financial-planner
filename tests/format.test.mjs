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

test("a money box reads what people type: commas, a dollar sign, k and m, spaces; nonsense and blank are null", () => {
  assert.equal(fmt.readAmount("$4,500"), 4500);
  assert.equal(fmt.readAmount("4500.50"), 4500.5);
  assert.equal(fmt.readAmount("72k"), 72000);
  assert.equal(fmt.readAmount("1.2M"), 1200000);
  assert.equal(fmt.readAmount("-500"), -500);
  assert.equal(fmt.readAmount("-$500"), -500);
  assert.equal(fmt.readAmount(" 950 "), 950);
  assert.equal(fmt.readAmount("4 500"), 4500);
  assert.equal(fmt.readAmount("5."), 5);
  assert.equal(fmt.readAmount(".5"), 0.5);
  assert.equal(fmt.readAmount("US$12"), 12);
  assert.equal(fmt.readAmount(1250), 1250);
  assert.equal(fmt.readAmount(""), null);
  assert.equal(fmt.readAmount("   "), null);
  assert.equal(fmt.readAmount("abc"), null);
  assert.equal(fmt.readAmount("4,500 a month"), null);
  assert.equal(fmt.readAmount("1.2.3"), null);
  assert.equal(fmt.readAmount(null), null);
  assert.equal(fmt.readAmount(NaN), null);
});

test("a money box shows commas and up to two decimals, and nothing for blank", () => {
  assert.equal(fmt.amountText(380000), "380,000");
  assert.equal(fmt.amountText(1234.5), "1,234.5");
  assert.equal(fmt.amountText(1234.567), "1,234.57");
  assert.equal(fmt.amountText(0), "0");
  assert.equal(fmt.amountText(-500), "-500");
  assert.equal(fmt.amountText(null), "");
  assert.equal(fmt.amountText(""), "");
  assert.equal(fmt.amountText(undefined), "");
});

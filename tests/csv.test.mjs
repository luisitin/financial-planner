// tests/csv.test.mjs -- core/csv.js against the shapes banks really export.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, splitCsv, detectSeparator, toObjects, toCsv } from "../core/csv.js";

test("plain rows, CRLF, BOM, trailing newline", () => {
  const r = parseCsv("﻿Date,Description,Amount\r\n09/01/2026,COFFEE,-4.50\r\n09/02/2026,PAYROLL,2500.00\r\n");
  assert.deepEqual(r.headers, ["Date", "Description", "Amount"]);
  assert.deepEqual(r.rows, [["09/01/2026", "COFFEE", "-4.50"], ["09/02/2026", "PAYROLL", "2500.00"]]);
  assert.equal(r.separator, ",");
  assert.equal(r.skipped, 0);
});
test("quoted fields with commas, doubled quotes and newlines inside", () => {
  const r = splitCsv('a,"b, c","say ""hi""","line1\nline2"\n');
  assert.deepEqual(r, [["a", "b, c", 'say "hi"', "line1\nline2"]]);
});
test("a title line above the header is skipped; ragged short rows dropped, long rows cut", () => {
  const r = parseCsv("Account: Chase Checking ...1234\nDate,Description,Amount\n09/01/2026,COFFEE,-4.50\nTotal\n09/02/2026,PAYROLL,2500.00,extra\n");
  assert.equal(r.skipped, 1);
  assert.deepEqual(r.headers, ["Date", "Description", "Amount"]);
  assert.deepEqual(r.rows, [["09/01/2026", "COFFEE", "-4.50"], ["09/02/2026", "PAYROLL", "2500.00"]]);
});
test("semicolon and tab separators are detected", () => {
  assert.equal(detectSeparator("Datum;Betrag;Text\n01.09.2026;-4,50;Kaffee\n"), ";");
  assert.equal(detectSeparator("Date\tAmount\n2026-09-01\t-4.5\n"), "\t");
  const r = parseCsv("Datum;Betrag\n01.09.2026;-4,50\n");
  assert.deepEqual(r.rows, [["01.09.2026", "-4,50"]]);
});
test("blank lines are ignored; empty headers get names; toObjects; toCsv round trip", () => {
  const r = parseCsv("Date,,Amount\n\n2026-09-01,x,1\n\n");
  assert.deepEqual(r.headers, ["Date", "Column 2", "Amount"]);
  assert.deepEqual(toObjects(r), [{ Date: "2026-09-01", "Column 2": "x", Amount: "1" }]);
  const text = toCsv(["a", "b"], [["1", 'q"uote'], { a: "x, y", b: "" }]);
  assert.equal(text, 'a,b\r\n1,"q""uote"\r\n"x, y",\r\n');
  assert.deepEqual(parseCsv(text).rows, [["1", 'q"uote'], ["x, y", ""]]);
});
test("empty input", () => {
  assert.deepEqual(parseCsv(""), { headers: [], rows: [], separator: ",", skipped: 0 });
});

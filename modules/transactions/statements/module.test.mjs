import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseStatementText, findPeriod, findClosingBalance, dateWithYear, parseModelRows, buildTextPrompt, buildVisionPrompt, rowsToImport, compute } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (f) => fs.readFileSync(path.join(ROOT, "qa/fixtures", f), "utf8");
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `${a} != ${b}`);

test("period, closing balance and year-less dates", () => {
  assert.deepEqual(findPeriod("Statement Period 08/13/2026 - 09/12/2026"), { from: "2026-08-13", to: "2026-09-12" });
  assert.deepEqual(findPeriod("Closing Date 09/12/2026"), { from: "2026-08-12", to: "2026-09-12" });
  assert.deepEqual(findPeriod("Your statement for September 2026"), { from: "2026-09-01", to: "2026-09-30" });
  assert.deepEqual(findPeriod("nothing"), { from: null, to: null });
  assert.equal(findClosingBalance("New Balance $1,254.68"), 1254.68);
  assert.equal(findClosingBalance("Ending balance on 01/15/2027 $3,988.49"), 3988.49);
  const p = { from: "2026-12-16", to: "2027-01-15" };
  assert.equal(dateWithYear("12/18", p), "2026-12-18", "December on a January statement is last year");
  assert.equal(dateWithYear("01/02", p), "2027-01-02");
  assert.equal(dateWithYear("Sep 2", { to: "2026-09-12" }), "2026-09-02");
  assert.equal(dateWithYear("09/02/2026", null), "2026-09-02");
  assert.equal(dateWithYear("09/02", null), null, "no period, no year");
  assert.equal(dateWithYear("13/45", p), null);
});
test("a card statement: charges out, payment and refund in, wrapped description joined, totals and summary skipped", () => {
  const r = parseStatementText(read("statement-card.txt"), { kind: "card" });
  assert.deepEqual(r.period, { from: "2026-08-13", to: "2026-09-12" });
  assert.equal(r.closingBalance, 1254.68);
  assert.equal(r.rows.length, 10, r.rows.map((x) => x.line).join("\n"));
  const by = (t) => r.rows.find((x) => x.description.toUpperCase().includes(t));
  near(by("AUTOPAY").amount, 640.22); assert.equal(by("AUTOPAY").date, "2026-08-14");
  near(by("KROGER").amount, -54.12);
  near(by("UNITED").amount, -412.60); assert.ok(by("UNITED").description.includes("CHICAGO IL"), "the wrapped second line is part of the description");
  near(by("REFUND").amount, 129.90);
  near(by("TARGET").amount, -466);
  assert.ok(!r.rows.some((x) => /total|previous balance|purchases  /i.test(x.description)));
  const out = r.rows.filter((x) => x.amount < 0).reduce((s, x) => s - x.amount, 0);
  near(out, 1254.68, "all charges, the refunded one included (the refund is a separate credit)");
  assert.ok(r.confidence >= 0.9);
});
test("a checking statement: sections give the sign, checks included, ledger balances and totals ignored, years roll over", () => {
  const r = parseStatementText(read("statement-checking.txt"), { kind: "bank" });
  assert.deepEqual(r.period, { from: "2026-12-16", to: "2027-01-15" });
  assert.equal(r.closingBalance, 3988.49);
  assert.equal(r.rows.length, 8, r.rows.map((x) => x.line).join("\n"));
  const by = (t) => r.rows.find((x) => x.description.toUpperCase().includes(t));
  near(by("PAYROLL").amount, 1950); assert.equal(by("PAYROLL").date, "2026-12-18");
  near(by("ZELLE").amount, -120);
  near(by("RENT").amount, -1500); assert.equal(by("RENT").date, "2027-01-02");
  near(by("1042").amount, -125, "a check line: DATE CHECK# AMOUNT");
  assert.ok(r.sections >= 3);
  const inn = r.rows.filter((x) => x.amount > 0).reduce((s, x) => s + x.amount, 0);
  near(inn, 3900);
});
test("model answers: JSON extracted from prose, bad rows dropped, years filled from the period", () => {
  const got = parseModelRows('Here you go:\n{"period":{"from":"2026-08-13","to":"2026-09-12"},"closingBalance":1254.68,"rows":[{"date":"2026-09-02","description":"AMAZON","amount":-42.17},{"date":"09/05","description":"ZARA","amount":"-129.90"},{"date":"nope","description":"x","amount":1},{"date":"2026-09-08","description":"","amount":1}]}');
  assert.equal(got.rows.length, 2); assert.equal(got.dropped, 2);
  assert.equal(got.rows[1].date, "2026-09-05"); near(got.rows[1].amount, -129.90);
  assert.equal(got.closingBalance, 1254.68);
  // what qwen3.5 actually returned for the scanned card statement: a copied minus on the payment. Card wording settles the sign.
  const card = parseModelRows('{"period":{"from":"2026-08-13","to":"2026-09-12"},"closingBalance":1254.68,"rows":[{"date":"2026-08-14","description":"AUTOPAY PAYMENT - THANK YOU","amount":-640.22},{"date":"2026-08-16","description":"KROGER #0421 DAYTON OH","amount":54.12},{"date":"2026-09-08","description":"REFUND ZARA USA NEW YORK NY","amount":129.90}]}', { kind: "card" });
  assert.deepEqual(card.rows.map((r) => r.amount), [640.22, -54.12, 129.90]);
  const bank = parseModelRows('{"rows":[{"date":"2026-08-14","description":"AUTOPAY PAYMENT","amount":-640.22}]}', { kind: "bank" });
  assert.equal(bank.rows[0].amount, -640.22, "bank statements keep the model's sign");
  assert.deepEqual(parseModelRows("no json").rows, []);
  assert.deepEqual(parseModelRows("{broken").rows, []);
});
test("prompts and the import shape", () => {
  const tp = buildTextPrompt("hello", { kind: "bank" });
  assert.ok(tp.system.includes("bank statements") && tp.system.includes("NEGATIVE") && tp.user.includes("hello"));
  const vp = buildVisionPrompt({ kind: "card", page: 2, pages: 3 });
  assert.ok(vp.system.includes("credit card") && vp.user.includes("page 2 of 3"));
  const rows = rowsToImport([{ date: "2026-09-02", description: "AMAZON MKTPL*2K3AB1 AMZN.COM/BILL WA", amount: -42.17 }]);
  assert.deepEqual(rows, [{ date: "2026-09-02", rawPayee: "AMAZON MKTPL*2K3AB1 AMZN.COM/BILL WA", payee: "Amazon Mktpl Amzn", amount: -42.17 }]);
  const p = emptyPlan(); p.accounts.push({ id: "a", name: "Card", type: "credit", balance: 1 });
  p.imports.push({ id: "x", at: "2026-09-15T00:00:00Z", accountId: "a", fileName: "s.pdf", method: "text", added: 3 }, { id: "y", at: "2026-09-15T00:00:00Z", accountId: "a", fileName: "c.csv", added: 3 });
  const d = compute(p);
  assert.equal(d.accounts.length, 1); assert.equal(d.imports.length, 1, "only statement imports");
});

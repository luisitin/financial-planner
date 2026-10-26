// tests/import-banks.test.mjs -- one fake export per bank style (qa/fixtures/*.csv) through
// the whole import path. Each fixture reproduces a real quirk: Amex/Discover list charges as
// positive; Bank of America prints a summary block above the header and quotes thousands;
// Wells Fargo has no header row; Capital One splits Debit/Credit and adds a Category column;
// a European bank uses semicolons, day.month.year and comma decimals; Ally gives positive
// amounts with a Type column. Add a fixture and a case here whenever a new bank misbehaves.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prepareImport, parseBankCsv } from "../modules/transactions/import/compute.js";
import { emptyPlan } from "../core/schema/migrate.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => fs.readFileSync(path.join(ROOT, "qa/fixtures", f), "utf8");
const run = (file, type) => { const p = emptyPlan(); p.accounts.push({ id: "a", name: file, type, balance: 0 }); return prepareImport(p, read(file), { accountId: "a" }); };
const by = (r, text) => r.add.find((t) => t.rawPayee.toUpperCase().includes(text));
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `${a} != ${b}`);

test("Amex card: charges positive in the file become money out; the payment becomes money in", () => {
  const r = run("amex-card.csv", "credit");
  assert.equal(r.add.length, 6); assert.equal(r.bad.length, 0);
  assert.equal(r.flipSign, true); assert.equal(r.flipAuto, true);
  near(by(r, "AMAZON").amount, -42.17); near(by(r, "AUTOPAY").amount, 640.22); near(by(r, "UNITED").amount, -412.60);
  assert.equal(by(r, "AMAZON").date, "2026-09-02");
  assert.equal(r.parsed.headers[r.mapping.payee], "Description", "not Card Member or Account #");
  near(r.outTotal, 42.17 + 86.40 + 15.49 + 48 + 412.60); near(r.inTotal, 640.22);
});
test("Bank of America checking: summary block skipped, quoted thousands read, the balance line reported as unreadable", () => {
  const r = run("bofa-checking.csv", "checking");
  assert.equal(r.parsed.headers[0], "Date"); assert.ok(r.parsed.skipped >= 5, "the summary lines above the header are skipped");
  assert.equal(r.add.length, 7);
  assert.deepEqual(r.bad, [{ row: 1, why: "no amount" }], "the 'Beginning balance' line has no amount");
  near(by(r, "PAYROLL").amount, 1950); near(by(r, "ZELLE").amount, -120);
  assert.equal(r.flipSign, false);
  assert.equal(r.parsed.headers[r.mapping.amount], "Amount", "not Running Bal.");
});
test("Wells Fargo checking: no header row, five columns, nothing lost", () => {
  const p = parseBankCsv(read("wellsfargo-checking.csv"));
  assert.equal(p.headerless, true); assert.deepEqual(p.headers, ["Column 1", "Column 2", "Column 3", "Column 4", "Column 5"]); assert.equal(p.rows.length, 5);
  const r = run("wellsfargo-checking.csv", "checking");
  assert.equal(r.add.length, 5);
  assert.equal(r.mapping.date, 0); assert.equal(r.mapping.amount, 1); assert.equal(r.mapping.payee, 4);
  near(by(r, "AMAZON").amount, -42.17); assert.equal(by(r, "AMAZON").date, "2026-09-02");
  near(by(r, "CHECK").amount, -1500);
  assert.equal(by(r, "KROGER").payee.startsWith("Authorized"), false, "'purchase' is noise; the payee is the merchant");
});
test("Capital One card: Debit/Credit columns give the sign; ISO dates; the Category column is not the description", () => {
  const r = run("capitalone-card.csv", "credit");
  assert.equal(r.add.length, 5); assert.equal(r.flipSign, false, "no flip needed with two columns");
  assert.equal(r.parsed.headers[r.mapping.debit], "Debit"); assert.equal(r.parsed.headers[r.mapping.credit], "Credit"); assert.equal(r.parsed.headers[r.mapping.payee], "Description");
  near(by(r, "AMAZON").amount, -42.17); near(by(r, "AUTOPAY").amount, 640.22);
  assert.equal(by(r, "AMAZON").date, "2026-09-02", "the transaction date, not the posted date");
});
test("Discover card: two date columns, charges positive, payment negative -> flipped", () => {
  const r = run("discover-card.csv", "credit");
  assert.equal(r.add.length, 5); assert.equal(r.flipAuto, true);
  assert.equal(r.parsed.headers[r.mapping.date], "Trans. Date");
  near(by(r, "AMAZON").amount, -42.17); near(by(r, "INTERNET PAYMENT").amount, 500);
});
test("European bank: BOM, semicolons, day.month.year, comma decimals, dotted thousands", () => {
  const r = run("european-bank.csv", "checking");
  assert.equal(r.parsed.separator, ";"); assert.equal(r.mapping.dateOrder, "DMY");
  assert.equal(r.add.length, 4);
  near(by(r, "KAFFEE").amount, -4.5); assert.equal(by(r, "KAFFEE").date, "2026-09-02");
  near(by(r, "GEHALT").amount, 1950); near(by(r, "MIETE").amount, -1250);
  assert.equal(by(r, "REWE").date, "2026-08-28");
});
test("Ally savings: positive amounts with a Type column; Deposit stays in, Withdrawal goes out", () => {
  const r = run("ally-savings.csv", "savings");
  assert.equal(r.add.length, 3); assert.equal(r.parsed.headers[r.mapping.type].trim(), "Type");
  near(by(r, "FROM CHASE").amount, 500); near(by(r, "INTEREST").amount, 11.23); near(by(r, "TO CHASE").amount, -300);
});
test("Chase checking (signed amounts + a Details column): the type column is ignored because the amounts carry their sign", () => {
  const r = run("chase-checking.csv", "checking");
  assert.equal(r.add.length, 10); assert.equal(r.mapping.type, null); assert.equal(r.flipSign, false);
  near(by(r, "PAYROLL").amount, 1950); near(by(r, "NETFLIX").amount, -15.49);
});
test("a card file that is already signed the plan's way is not flipped", () => {
  const p = emptyPlan(); p.accounts.push({ id: "a", name: "card", type: "credit", balance: 0 });
  const r = prepareImport(p, "Date,Description,Amount\n09/01/2026,STORE,-10.00\n09/02/2026,STORE,-12.00\n09/03/2026,PAYMENT,100.00\n", { accountId: "a" });
  assert.equal(r.flipSign, false); near(by(r, "PAYMENT").amount, 100);
});

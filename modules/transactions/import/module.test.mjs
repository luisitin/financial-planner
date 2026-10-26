import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detectMapping, parseDate, parseAmount, rowsToTransactions, dedupe, prepareImport, guessDateOrder, compute } from "./compute.js";
import { parseCsv } from "../../../core/csv.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const CHASE = fs.readFileSync(path.join(ROOT, "qa/fixtures/chase-checking.csv"), "utf8");
const planWithAccount = () => { const p = emptyPlan(); p.accounts.push({ id: "chk", name: "Chase checking", type: "checking", balance: 4200 }); return p; };

test("parseDate reads the formats banks use", () => {
  assert.equal(parseDate("09/02/2026"), "2026-09-02");
  assert.equal(parseDate("9/2/26"), "2026-09-02");
  assert.equal(parseDate("2026-09-02"), "2026-09-02");
  assert.equal(parseDate("2026-09-02T10:00:00"), "2026-09-02");
  assert.equal(parseDate("02/09/2026", "DMY"), "2026-09-02");
  assert.equal(parseDate("02.09.2026", "DMY"), "2026-09-02");
  assert.equal(parseDate("Sep 2, 2026"), "2026-09-02");
  assert.equal(parseDate("2 September 2026"), "2026-09-02");
  assert.equal(parseDate("20260902"), "2026-09-02");
  assert.equal(parseDate("13/13/2026"), null);
  assert.equal(parseDate("hello"), null);
  assert.equal(parseDate(""), null);
  assert.equal(guessDateOrder(["01/02/2026", "25/02/2026"]), "DMY");
  assert.equal(guessDateOrder(["01/02/2026", "02/25/2026"]), "MDY");
});
test("parseAmount reads money the way statements print it", () => {
  assert.equal(parseAmount("-42.17"), -42.17);
  assert.equal(parseAmount("$1,234.56"), 1234.56);
  assert.equal(parseAmount("(12.00)"), -12);
  assert.equal(parseAmount("12,34"), 12.34);
  assert.equal(parseAmount("1.234,56"), 1234.56);
  assert.equal(parseAmount("-$5.00"), -5);
  assert.equal(parseAmount("5.00-"), -5);
  assert.equal(parseAmount("+20"), 20);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("n/a"), null);
});
test("detectMapping finds date, description and a signed amount column in a Chase file", () => {
  const parsed = parseCsv(CHASE);
  const m = detectMapping(parsed.headers, parsed.rows);
  assert.equal(parsed.headers[m.date], "Posting Date");
  assert.equal(parsed.headers[m.payee], "Description");
  assert.equal(parsed.headers[m.amount], "Amount");
  assert.equal(m.debit, null); assert.equal(m.credit, null);
  assert.equal(m.dateOrder, "MDY");
});
test("detectMapping handles separate money-out / money-in columns and a type column", () => {
  const parsed = parseCsv("Date,Description,Withdrawals,Deposits\n2026-09-01,COFFEE,4.50,\n2026-09-02,PAYROLL,,2500.00\n");
  const m = detectMapping(parsed.headers, parsed.rows);
  assert.equal(parsed.headers[m.debit], "Withdrawals"); assert.equal(parsed.headers[m.credit], "Deposits"); assert.equal(m.amount, null);
  const { txs } = rowsToTransactions(parsed, m, { accountId: "a" });
  assert.deepEqual(txs.map((t) => t.amount), [-4.5, 2500]);
  const p2 = parseCsv("Date,Type,Amount,Memo\n2026-09-01,DEBIT,4.50,COFFEE\n2026-09-02,CREDIT,2500.00,PAYROLL\n");
  const m2 = detectMapping(p2.headers, p2.rows);
  assert.equal(p2.headers[m2.type], "Type"); assert.equal(p2.headers[m2.payee], "Memo");
  assert.deepEqual(rowsToTransactions(p2, m2, { accountId: "a" }).txs.map((t) => t.amount), [-4.5, 2500]);
});
test("rowsToTransactions: payees cleaned, keys set, bad rows reported, flipSign", () => {
  const parsed = parseCsv(CHASE);
  const m = detectMapping(parsed.headers, parsed.rows);
  const { txs, bad } = rowsToTransactions(parsed, m, { accountId: "chk", importId: "i1" });
  assert.equal(txs.length, 10); assert.equal(bad.length, 0);
  const amazon = txs[0];
  assert.equal(amazon.date, "2026-09-02"); assert.equal(amazon.amount, -42.17); assert.equal(amazon.payee, "Amazon Mktpl Amzn"); assert.equal(amazon.rawPayee, "AMAZON MKTPL*2K3AB1 AMZN.COM/BILL WA");
  assert.equal(amazon.category, ""); assert.equal(amazon.importId, "i1"); assert.ok(amazon.key.startsWith("chk|2026-09-02|-42.17|"));
  assert.equal(txs[1].payee, "Acme Corp Payroll");
  const flipped = rowsToTransactions(parsed, m, { accountId: "chk", flipSign: true }).txs;
  assert.equal(flipped[0].amount, 42.17);
  const broken = rowsToTransactions(parseCsv("Date,Amount,Description\nnot a date,1,x\n2026-09-01,,y\n"), { date: 0, amount: 1, payee: 2, debit: null, credit: null, type: null }, { accountId: "a" });
  assert.deepEqual(broken.bad.map((b) => b.why), ["no date", "no amount"]);
});
test("dedupe skips what is on file and repeats inside the same file", () => {
  const parsed = parseCsv(CHASE);
  const m = detectMapping(parsed.headers, parsed.rows);
  const { txs } = rowsToTransactions(parsed, m, { accountId: "chk" });
  const { add, skip } = dedupe(txs.slice(0, 3), [...txs, { ...txs[9], id: "again" }]);
  assert.equal(add.length, 7); assert.equal(skip.length, 4);
});
test("prepareImport: rules applied, saved profile reused, duplicates against the plan skipped", () => {
  const p = planWithAccount();
  p.rules.push({ id: "r1", contains: "kroger", category: "groceries", payee: "Kroger", direction: "any" }, { id: "r2", contains: "acme corp payroll", category: "income-salary", direction: "in" });
  let r = prepareImport(p, CHASE, { accountId: "chk", importId: "x" });
  assert.equal(r.add.length, 10); assert.equal(r.skip.length, 0); assert.equal(r.bad.length, 0);
  assert.equal(r.ruled, 4, "two Kroger lines and two payroll lines");
  assert.deepEqual(r.ruleHits, { r1: 2, r2: 2 });
  const kroger = r.add.find((t) => t.rawPayee.startsWith("KROGER"));
  assert.equal(kroger.category, "groceries"); assert.equal(kroger.payee, "Kroger");
  assert.equal(r.dateFrom, "2026-08-12"); assert.equal(r.dateTo, "2026-09-02");
  assert.ok(Math.abs(r.inTotal - 3900) < 1e-9); assert.ok(Math.abs(r.outTotal - 1506.4) < 1e-9);
  p.transactions.push(...r.add);
  const saved = { ...r.mapping };
  p.importProfiles[r.headerKey] = { accountId: "chk", mapping: saved };   // a saved mapping is reused as is
  r = prepareImport(p, CHASE, { accountId: "chk" });
  assert.equal(r.add.length, 0, "everything already on file"); assert.equal(r.skip.length, 10);
  assert.equal(r.mapping, saved);
});
test("compute lists imports newest first with per-account counts", () => {
  const p = planWithAccount();
  p.imports.push({ id: "a", at: "2026-09-01T00:00:00Z", accountId: "chk", fileName: "old.csv", added: 3, skipped: 0 }, { id: "b", at: "2026-09-15T00:00:00Z", accountId: "chk", fileName: "new.csv", added: 5, skipped: 1 });
  p.transactions.push({ id: "t", date: "2026-09-01", amount: -1, payee: "x", accountId: "chk", category: "" });
  const d = compute(p);
  assert.equal(d.imports[0].fileName, "new.csv"); assert.equal(d.accounts[0].count, 1); assert.equal(d.total, 1);
});

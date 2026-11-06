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
  assert.equal(r.fileFrom, "2026-08-12"); assert.equal(r.fileTo, "2026-09-02", "the file's own days, duplicates included");
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

test("the same lines already on another account are flagged (80% and at least 3), never on the same account or by chance", async () => {
  const { alsoOn, prepareImport } = await import("./compute.js");
  const { emptyPlan } = await import("../../../core/schema/migrate.js");
  const p = emptyPlan();
  p.accounts.push({ id: "chk", name: "Checking", type: "checking", balance: 0 }, { id: "visa", name: "Visa card", type: "credit", balance: 0 });
  const csv = "Date,Description,Amount\n10/02/2026,KROGER #0388,-86.40\n10/04/2026,SHELL OIL 57442,-41.00\n10/05/2026,NETFLIX.COM,-15.49\n10/09/2026,KROGER #0421,-54.10\n";
  const first = prepareImport(p, csv, { accountId: "chk", importId: "a" });
  assert.equal(first.elsewhere, null, "nothing on file yet");
  for (const t of first.add) p.transactions.push({ ...t, id: `x${p.transactions.length}` });
  const again = prepareImport(p, csv, { accountId: "visa", importId: "b" });
  assert.equal(again.add.length, 4, "duplicates are only looked for within one account");
  assert.deepEqual(again.elsewhere, { accountId: "chk", count: 4, of: 4 });
  assert.equal(prepareImport(p, csv, { accountId: "chk", importId: "c" }).add.length, 0, "the same account: all skipped as duplicates");
  // two lines matching by chance out of five: no warning
  const mixed = "Date,Description,Amount\n10/02/2026,KROGER #0388,-86.40\n10/04/2026,SHELL OIL 57442,-41.00\n11/01/2026,TARGET,-20.00\n11/02/2026,TARGET,-21.00\n11/03/2026,TARGET,-22.00\n";
  assert.equal(prepareImport(p, mixed, { accountId: "visa", importId: "d" }).elsewhere, null);
  assert.equal(alsoOn(p, []), null);
});

// ---- a file that starts days after the account's last lines: said before importing (2026-11-02)
test("gap before the file: a usual payment due in the days before it, or more than a quiet spell, named with those payments", async () => {
  const { gapBefore } = await import("./compute.js");
  const p = emptyPlan();
  p.accounts.push({ id: "chk", name: "Checking", type: "checking", balance: 1 });
  const line = (date, amount, raw) => ({ id: `${date}-${raw}`, date, amount, payee: raw, rawPayee: raw, accountId: "chk", category: "", tags: [], note: "" });
  for (let d = 1; d <= 20; d++) p.transactions.push(line(`2026-09-${String(d).padStart(2, "0")}`, -10, "KROGER"));
  for (const m of ["06", "07", "08"]) p.transactions.push(line(`2026-${m}-22`, -1000, "OAK STREET APARTMENTS RENT"));
  const file = (from) => `Date,Description,Amount\n${Array.from({ length: 31 - from }, (_, k) => `09/${String(from + k).padStart(2, "0")}/2026,SHELL OIL,-20.00`).join("\n")}\n`;
  // the file from 9/25: 5 days after 9/20, so 9/21 to 9/24 are missing; the rent (the 22nd, three months running) falls in them
  let r = prepareImport(p, file(25), { accountId: "chk", importId: "n" });
  assert.deepEqual([r.gap.last, r.gap.from, r.gap.to, r.gap.days], ["2026-09-20", "2026-09-21", "2026-09-24", 4]);
  assert.deepEqual(r.gap.usual, [{ name: "your rent", day: 22, out: true }]);
  assert.equal(r.gap.text, "Your last Checking lines end 9/20; this file starts 9/25. Anything on 9/21 to 9/24 is missing (your rent usually goes out on the 22nd). Bring in a file from 9/21, or add those by hand.");
  // slack edges: from 9/24 (4 days) still a gap of 9/21 to 9/23; from 9/23 (3 days) none
  assert.equal(prepareImport(p, file(24), { accountId: "chk", importId: "n" }).gap.text, "Your last Checking lines end 9/20; this file starts 9/24. Anything on 9/21 to 9/23 is missing (your rent usually goes out on the 22nd). Bring in a file from 9/21, or add those by hand.");
  // from 9/23 (2 quiet days): the rent of the 22nd falls in 9/21 to 9/22 and September has no rent line, so it is a hole too
  // (re-check 4: one rule for the pages and this warning, coverageByAccount)
  const short = prepareImport(p, file(23), { accountId: "chk", importId: "n" }).gap;
  assert.deepEqual([short.hole, short.from, short.to, short.days], [true, "2026-09-21", "2026-09-22", 2]);
  assert.equal(short.text, "Your last Checking lines end 9/20; this file starts 9/23. Anything on 9/21 to 9/22 is missing (your rent usually goes out on the 22nd). Bring in a file from 9/21, or add those by hand.");
  // the rent paid late, on 9/26, is in the file: nothing usual is missing, and a gap within the slack is not said
  const late = `Date,Description,Amount\n09/23/2026,SHELL OIL,-20.00\n09/26/2026,OAK STREET APARTMENTS RENT,-1000.00\n`;
  assert.equal(prepareImport(p, late, { accountId: "chk", importId: "n" }).gap, null);
  assert.equal(prepareImport(p, file(25), { accountId: "chk", importId: "n" }).gap.hole, true);
  // no usual payment in the gap: 4 quiet days are a quiet spell (records hold first and last line dates), nothing is said;
  // more than 7 (and more than 2 x the daily spacing) is a hole, with no parenthesis
  p.transactions = p.transactions.filter((t) => !/RENT/.test(t.rawPayee));
  assert.equal(prepareImport(p, file(25), { accountId: "chk", importId: "n" }).gap, null);
  assert.equal(prepareImport(p, file(23), { accountId: "chk", importId: "n" }).gap, null);
  const late9 = `Date,Description,Amount\n09/29/2026,SHELL OIL,-20.00\n09/30/2026,SHELL OIL,-20.00\n`;
  assert.equal(prepareImport(p, late9, { accountId: "chk", importId: "n" }).gap.text, "Your last Checking lines end 9/20; this file starts 9/29. Anything on 9/21 to 9/28 is missing. Bring in a file from 9/21, or add those by hand.");
  // the last import's `to` counts as well as the last line; an account with nothing on file has no gap
  p.imports = [{ id: "i", accountId: "chk", from: "2026-09-01", to: "2026-09-23" }];
  assert.equal(prepareImport(p, file(25), { accountId: "chk", importId: "n" }).gap, null, "the last file reached 9/23");
  p.accounts.push({ id: "new", name: "New card", type: "credit", balance: 0 });
  assert.equal(prepareImport(p, file(25), { accountId: "new", importId: "n" }).gap, null);
  assert.equal(gapBefore(p, { accountId: "chk", fileFrom: null }), null);
});
test("the sample family's 90-day file after July's lines: the exact warning, mortgage and paycheck named from the file's own months", async () => {
  const { cardGapPlan, ninetyDays } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const p = cardGapPlan("2026-11-02", { withFile: false });
  const csv = `Posting Date,Description,Amount\n${ninetyDays().map(([d, desc, a]) => `${d.slice(5, 7)}/${d.slice(8, 10)}/${d.slice(0, 4)},"${desc}",${a.toFixed(2)}`).join("\n")}\n`;
  const r = prepareImport(p, csv, { accountId: "a-chk", importId: "x" });
  assert.equal(r.add.length, 76); assert.equal(r.fileFrom, "2026-08-03");
  assert.equal(r.gap.text, "Your last Chase checking lines end 7/30; this file starts 8/3. Anything on 7/31 to 8/2 is missing (your mortgage usually goes out on the 2nd and a paycheck on the 1st). Bring in a file from 7/31, or add those by hand.");
});
test("a file with nothing new that spans days the account's files missed: those days are named, so they can be counted as checked (2026-11-02)", async () => {
  const { uncoveredDays } = await import("./compute.js");
  const { cardGapPlan, withVisaFile } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  // the Visa's files to 9/10 and from 9/20; nothing happened on the card from 9/11 to 9/19
  const p = withVisaFile(withVisaFile(cardGapPlan("2026-11-02"), "2026-09-01", "2026-09-10"), "2026-09-20", "2026-09-30");
  assert.deepEqual(uncoveredDays(p, "a-visa", "2026-09-01", "2026-09-30"), [{ from: "2026-09-11", to: "2026-09-19", days: 9 }]);
  assert.deepEqual(uncoveredDays(p, "a-visa", "2026-08-25", "2026-09-05"), [{ from: "2026-08-25", to: "2026-08-31", days: 7 }]);
  assert.deepEqual(uncoveredDays(p, "a-visa", "2026-09-02", "2026-09-09"), []);
  // September's whole Visa file again: every line already on file, and it fills 9/11 to 9/19
  const rows = p.transactions.filter((t) => t.accountId === "a-visa").map((t) => `${t.date.slice(5, 7)}/${t.date.slice(8, 10)}/${t.date.slice(0, 4)},"${t.rawPayee}",${t.amount.toFixed(2)}`);
  const r = prepareImport(p, `Date,Description,Amount\n${rows.join("\n")}\n`, { accountId: "a-visa", importId: "z" });
  assert.equal(r.add.length, 0); assert.equal(r.skip.length, rows.length);
  assert.deepEqual([r.fileFrom, r.fileTo, r.fills], ["2026-09-01", "2026-09-30", [{ from: "2026-09-11", to: "2026-09-19", days: 9 }]]);
});
test("pages 9 (re-check 4): plan3's checking file 7/30 to 8/3 with every line already on file: no gap, it fills 7/31 to 8/2 (one message)", async () => {
  const { cardGapPlan } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const p = cardGapPlan("2026-11-02");
  const rows = p.transactions.filter((t) => t.accountId === "a-chk" && (t.date === "2026-07-30" || t.date === "2026-08-03"))
    .map((t) => `${t.date.slice(5, 7)}/${t.date.slice(8, 10)}/${t.date.slice(0, 4)},"${t.rawPayee}",${t.amount.toFixed(2)}`);
  const r = prepareImport(p, `Date,Description,Amount\n${rows.join("\n")}\n`, { accountId: "a-chk", importId: "k1" });
  // nothing to add, nothing before the file to warn about; the page shows only "Everything in this file is already on file. It
  // covers 7/30 to 8/3, so it shows nothing happened on 7/31 to 8/2, ..." (view: fillsOnly drops the "only partly in it" line)
  assert.equal(r.add.length, 0); assert.equal(r.skip.length, rows.length); assert.equal(r.gap, null);
  assert.deepEqual([r.fileFrom, r.fileTo, r.fills], ["2026-07-30", "2026-08-03", [{ from: "2026-07-31", to: "2026-08-02", days: 3 }]]);
});

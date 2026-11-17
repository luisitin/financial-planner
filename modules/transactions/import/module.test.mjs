import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detectMapping, parseDate, parseAmount, rowsToTransactions, dedupe, prepareImport, guessDateOrder, compute, looksLikeBankFile, parseBankCsv } from "./compute.js";
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
  // commas every three digits with no point are thousands (2026-11-14): money has two decimals
  assert.equal(parseAmount("1,234"), 1234); assert.equal(parseAmount("$12,500"), 12500); assert.equal(parseAmount("-1,234,567"), -1234567);
  assert.equal(parseAmount("(1,250)"), -1250); assert.equal(parseAmount("12,5"), 12.5); assert.equal(parseAmount("1,23"), 1.23); assert.equal(parseAmount("0,500"), 0.5);
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
test("dedupe skips what is on file; a repeat inside the same file is another purchase (2026-11-14)", () => {
  const parsed = parseCsv(CHASE);
  const m = detectMapping(parsed.headers, parsed.rows);
  const { txs } = rowsToTransactions(parsed, m, { accountId: "chk" });
  const { add, skip } = dedupe(txs.slice(0, 3), [...txs, { ...txs[9], id: "again" }]);
  assert.equal(add.length, 8); assert.equal(skip.length, 3);
  // the same file again, the repeat with it: everything is on file, each line standing for one
  const all = [...txs, { ...txs[9], id: "again" }];
  assert.equal(dedupe(all, all).add.length, 0);
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

test("looksLikeBankFile: a date and an amount on one line is a bank file; words, a lone header or nothing are not (stress test T6)", () => {
  assert.equal(looksLikeBankFile(parseBankCsv(CHASE)), true);
  for (const f of ["european-bank.csv", "amex-card.csv", "wellsfargo-checking.csv"]) assert.equal(looksLikeBankFile(parseBankCsv(fs.readFileSync(path.join(ROOT, "qa/fixtures", f), "utf8"))), true, f);
  // column names nobody recognises still count: the person picks the columns
  assert.equal(looksLikeBankFile(parseBankCsv("When,Who,How much\n09/02/2026,Kroger,-86.40\n")), true);
  for (const t of ["", "hello world", "not a csv\nhello world\n", "I paid the plumber\nlast week\n", "a,b\n1,2\n"]) assert.equal(looksLikeBankFile(parseBankCsv(t)), false, JSON.stringify(t));
});

test("F4: what the file works out is kept beside a change by hand; columnChanges says what was changed and auto.bad how many rows the app's own choices leave unread", async () => {
  const { columnChanges } = await import("./compute.js");
  const csv = ["Date,Description,Amount", "10/14/2026,COFFEE,-4.50", "10/15/2026,PAYROLL,2000.00", "10/16/2026,GROCER,-80.25", "10/02/2026,GAS,-30.00"].join("\n");
  const p = { meta: { currency: "USD" }, accounts: [{ id: "chk", name: "Checking", type: "checking", balance: 1000 }, { id: "visa", name: "Visa", type: "credit", balance: 0 }], transactions: [] };
  const auto = prepareImport(p, csv, { accountId: "chk", importId: "x" });
  assert.deepEqual(columnChanges(auto), [], "nothing changed by hand");
  assert.equal(auto.auto.bad, 0); assert.equal(auto.auto.flipSign, false);
  const dmy = prepareImport(p, csv, { accountId: "chk", importId: "x", mapping: { ...auto.mapping, dateOrder: "DMY" } });
  assert.deepEqual(columnChanges(dmy), [{ key: "dateOrder", to: "DMY" }]);
  assert.equal(dmy.bad.length, 3, "the 14th, 15th and 16th are no month"); assert.equal(dmy.auto.bad, 0, "the app's own choices read every row");
  assert.deepEqual(columnChanges(prepareImport(p, csv, { accountId: "chk", importId: "x", mapping: auto.mapping, flipSign: true })), [{ key: "flip", to: true }]);
  assert.deepEqual(columnChanges(prepareImport(p, csv, { accountId: "chk", importId: "x", mapping: { ...auto.mapping, amount: null, debit: 2, credit: null } })), [{ key: "amount", to: { debit: 2, credit: null } }], "the money columns are one change");
  assert.deepEqual(columnChanges(prepareImport(p, csv, { accountId: "chk", importId: "x", mapping: { ...auto.mapping, payee: null } })), [{ key: "payee", to: null }]);
  // a card file the app turns around itself: unticking it is the change
  const card = ["Date,Description,Amount", "10/14/2026,COFFEE,4.50", "10/15/2026,GROCER,80.25", "10/16/2026,PAYMENT,-200.00"].join("\n");
  const c = prepareImport(p, card, { accountId: "visa", importId: "x" });
  assert.equal(c.auto.flipSign, true); assert.deepEqual(columnChanges(c), []);
  assert.deepEqual(columnChanges(prepareImport(p, card, { accountId: "visa", importId: "x", mapping: c.mapping, flipSign: false })), [{ key: "flip", to: false }]);
  assert.deepEqual(columnChanges(prepareImport(p, card, { accountId: "visa", importId: "x", mapping: { ...c.mapping, amount: null, debit: 2, credit: null } })), [{ key: "amount", to: { debit: 2, credit: null } }],
    "the box left alone follows the columns chosen: one change, not two");
  // a layout saved from an earlier import is what the app works out
  const saved = { ...p, importProfiles: { [auto.headerKey]: { accountId: "chk", mapping: { ...auto.mapping, dateOrder: "DMY" }, flipSign: false } } };
  assert.deepEqual(columnChanges(prepareImport(saved, csv, { accountId: "chk", importId: "x" })), []);
});

// ---------------------------------------------------------------- another app's file: YNAB, Monarch, Mint (gap #33, 2026-11-14)
// Invented files (qa/fixtures/ynab-register.csv, monarch-transactions.csv, mint-transactions.csv): the header sets of the gap
// spec, read from public descriptions of these exports, never a real export.
const fixture = (f) => fs.readFileSync(path.join(ROOT, "qa/fixtures", f), "utf8");
const YNAB = fixture("ynab-register.csv"), MONARCH = fixture("monarch-transactions.csv"), MINT = fixture("mint-transactions.csv");
const F = await import("./formats.js");
const C = await import("./compute.js");
const family = () => ({ meta: { currency: "USD" }, accounts: [
  { id: "chk", name: "Chase checking", type: "checking", balance: 3000 }, { id: "visa", name: "Visa card", type: "credit", balance: 300 },
  { id: "sav", name: "Ally savings", type: "savings", balance: 5000 }, { id: "k401", name: "Work 401(k)", type: "401k", balance: 40000 }],
  transactions: [], rules: [], categories: [], imports: [], importProfiles: {}, budgets: [] });
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `${a} != ${b}`);
const by = (r, payee) => r.add.find((t) => t.payee === payee);

test("#33 headers: each app's must-have columns in any order, case or spacing; anything else, or both at once, is no app's", () => {
  assert.equal(F.matchHeaders(parseCsv(YNAB).headers).format.id, "ynab");
  assert.equal(F.matchHeaders(parseCsv(MONARCH).headers).format.id, "monarch");
  assert.equal(F.matchHeaders(parseCsv(MINT).headers).format.id, "mint");
  // YNAB 4 (the desktop app): Master Category / Sub Category beside "Category" ("Master: Sub"); the leaf is read
  const y4 = F.matchHeaders(["Account", "Flag", "Check Number", "Date", "Payee", "Category", "Master Category", "Sub Category", "Memo", "Outflow", "Inflow", "Cleared", "Running Balance"]);
  assert.equal(y4.format.id, "ynab"); assert.equal(y4.at.category, 7); assert.equal(y4.at.group, 6);
  const shuffled = F.matchHeaders(["  INFLOW", "outflow ", "Payee", "date", "ACCOUNT", "Extra column"]);
  assert.equal(shuffled.format.id, "ynab"); assert.deepEqual([shuffled.at.inflow, shuffled.at.outflow, shuffled.at.date], [0, 1, 3]);
  assert.equal(F.matchHeaders(["Date", "Payee", "Outflow", "Inflow"]), null, "no Account column: not YNAB's register");
  assert.equal(F.matchHeaders(["Account", "Date", "Payee", "Outflow", "Inflow", "Outflow"]), null, "a must-have column twice: not sure");
  assert.equal(F.matchHeaders(["Date", "Merchant", "Category", "Account", "Original Statement", "Amount", "Description", "Original Description", "Transaction Type", "Account Name"]), null, "Monarch's and Mint's at once: not sure");
  assert.equal(F.matchHeaders(parseCsv(CHASE).headers), null);
  // a header that matches but rows that do not read with it (fewer than 9 in 10): read as any bank file
  assert.equal(C.readFormat(parseBankCsv("Account,Date,Payee,Outflow,Inflow\nA,someday,X,$1.00,$0.00\nA,09/02/2026,Y,$2.00,$0.00\n")), null);
  assert.ok(C.readFormat(parseBankCsv(YNAB)));
});

test("#33 every bank file the tests already hold is no app's file, and imports exactly as before (formats: false is the old way)", () => {
  const files = fs.readdirSync(path.join(ROOT, "qa/fixtures")).filter((f) => f.endsWith(".csv") && !["ynab-register.csv", "monarch-transactions.csv", "mint-transactions.csv"].includes(f));
  assert.ok(files.length >= 9, files.join(", "));
  for (const f of files) {
    const text = fixture(f);
    assert.equal(C.readFormat(parseBankCsv(text)), null, f);
    for (const type of ["checking", "credit"]) {
      const p = family(); p.accounts[0].type = type;
      assert.deepEqual(prepareImport(p, text, { accountId: "chk", importId: "x" }), prepareImport(p, text, { accountId: "chk", importId: "x", formats: false }), `${f} on a ${type} account`);
    }
  }
  // a header nobody knows: today's columns step
  const csv = "When,Who,How much\n09/02/2026,Kroger,-86.40\n09/03/2026,Shell,-48.00\n";
  const r = prepareImport(family(), csv, { accountId: "chk" });
  assert.equal(r.format, undefined); assert.equal(r.fileAccounts, undefined);
  assert.deepEqual(r.mapping, detectMapping(parseCsv(csv).headers, parseCsv(csv).rows));
});

test("#33 YNAB: one import per account; Inflow - Outflow; its payee as written; starting balances left out; transfers; a split purchase put back together", () => {
  const p = family();
  const look = prepareImport(p, YNAB, { accountId: null });
  assert.deepEqual(look.format, { id: "ynab", name: "YNAB" });
  assert.deepEqual(look.fileAccounts.map((x) => [x.name, x.count, x.from, x.to, x.pick?.accountId ?? null, x.pick?.why ?? null]), [
    ["Chase checking", 11, "2026-09-01", "2026-09-15", "chk", "name"], ["Visa card", 5, "2026-09-01", "2026-09-12", "visa", "name"], ["Rainy day savings", 3, "2026-09-01", "2026-09-30", null, null]]);
  assert.equal(look.fileAccount, "Chase checking", "the first account with lines to bring in");
  assert.equal(look.add.every((t) => t.accountId === null), true, "no account picked: nothing goes anywhere");
  const r = prepareImport(p, YNAB, { accountId: "chk", fileAccount: "Chase checking", importId: "x" });
  assert.equal(r.rowsIn, 11); assert.equal(r.add.length, 9); assert.equal(r.bad.length, 0);
  assert.deepEqual(r.left, [{ row: 1, why: "starting balance" }]);
  near(by(r, "Hometown Mortgage").amount, -1450); assert.equal(by(r, "Hometown Mortgage").category, "housing", "Mortgage is part of Rent or mortgage");
  near(r.add.filter((t) => t.payee === "Acme Corp")[0].amount, 1950); assert.equal(r.add.filter((t) => t.payee === "Acme Corp")[0].category, "", "Ready to Assign is no category");
  assert.equal(by(r, "Acme Corp").note, "Paycheck");
  assert.equal(by(r, "Kroger").rawPayee, "Kroger"); assert.equal(by(r, "Kroger").category, "groceries");
  assert.equal(by(r, "Transfer : Rainy day savings").category, "transfer"); near(by(r, "Transfer : Visa card").amount, -310.25);
  const target = by(r, "Target");
  near(target.amount, -65.5); assert.equal(r.merged, 1); assert.equal(target.note, "food; towels");
  assert.deepEqual(target.splits, [{ category: "groceries", amount: -40 }, { category: "", amount: -25.5 }]); assert.equal(target.category, "groceries");
  assert.equal(target.key, `chk|2026-09-05|-65.50|target`, "the purchase's own key, so a bank's line for it is the same line");
  assert.equal(r.add.every((t) => t.accountId === "chk" && t.importId === "x"), true);
  near(r.inTotal, 3900); near(r.outTotal, 1450 + 86.4 + 65.5 + 4.5 + 112.3 + 200 + 310.25);
  // a card: its outflow is money out on the card, the payment money in; the flags (Blue) are not read
  const v = prepareImport(p, YNAB, { accountId: "visa", fileAccount: "Visa card" });
  assert.equal(v.add.length, 4); near(by(v, "Pizza Palace").amount, -32.8); near(by(v, "Transfer : Chase checking").amount, 310.25);
  assert.equal(by(v, "Shell").category, "transport", "Gas is part of Car, gas, transit"); assert.equal(by(v, "Book Nook").category, "giving");
  assert.equal(v.flipSign, false, "YNAB's two money columns say which way: nothing to turn around");
  // Inflow - Outflow when a row holds both
  const both = prepareImport(p, '"Account","Date","Payee","Outflow","Inflow"\n"Chase checking","09/02/2026","Shop","$10.00","$4.00"\n', { accountId: "chk" });
  near(both.add[0].amount, -6);
});

test("#33 Monarch: Merchant as the payee, Original Statement as the bank's text, Tags and Notes kept, the sign as in the file", () => {
  const p = family();
  const look = prepareImport(p, MONARCH, { accountId: null });
  assert.deepEqual(look.fileAccounts.map((x) => [x.name, x.count, x.pick]), [["Joint Checking (...4821)", 5, null], ["Rewards Card (...3307)", 5, null]], "no plan account has those names");
  const c = prepareImport(p, MONARCH, { accountId: "chk", fileAccount: "Joint Checking (...4821)" });
  assert.equal(c.add.length, 5);
  const k = c.add.find((t) => t.payee === "Kroger");
  assert.equal(k.rawPayee, "KROGER #0421 DAYTON OH"); near(k.amount, -91.15); assert.equal(k.category, "groceries");
  near(by(c, "Acme Corp").amount, 1950); assert.equal(by(c, "Acme Corp").category, "", "Paychecks is not a name on the plan's list");
  assert.equal(by(c, "Rewards Card").category, "transfer", "a card payment is a transfer, never spending twice");
  const v = prepareImport(p, MONARCH, { accountId: "visa", fileAccount: "Rewards Card (...3307)" });
  const inn = by(v, "Sunny Inn");
  assert.deepEqual(inn.tags, ["vacation", "reimbursable"]); assert.equal(inn.note, "lake weekend"); near(inn.amount, -238.6);
  assert.equal(by(v, "Mystery Shop").category, "", "Uncategorized is no category"); assert.deepEqual(by(v, "Mystery Shop").tags, ["vacation"]);
  assert.equal(v.flipSign, false, "charges already negative on the card");
});

test("#33 Mint: Transaction Type gives the sign; Description and Original Description; Labels as tags", () => {
  const p = family();
  const c = prepareImport(p, MINT, { accountId: "chk", fileAccount: "CHECKING" });
  assert.equal(c.add.length, 5);
  near(by(c, "Acme Corp").amount, 1950); near(by(c, "Kroger").amount, -72.18); near(by(c, "Hometown Mortgage").amount, -1450);
  assert.equal(by(c, "Kroger").rawPayee, "KROGER #0421 DAYTON OH"); assert.equal(by(c, "Visa Payment").category, "transfer");
  const tax = by(c, "Tax Helper");
  assert.deepEqual(tax.tags, ["tax related"]); assert.equal(tax.note, "last year's return"); assert.equal(tax.category, "taxes");
  assert.equal(c.add[0].date, "2024-03-01");
  const v = prepareImport(p, MINT, { accountId: "visa", fileAccount: "Visa Signature" });
  near(by(v, "Shell").amount, -41); near(by(v, "Thank You").amount, 300);
});

test("#33 several accounts: the account picked by name or by last time, never the first in the list; a masked number at the end aside", () => {
  const p = family();
  assert.deepEqual(F.pickAccount(p, null, "Chase checking"), { accountId: "chk", why: "name" });
  assert.deepEqual(F.pickAccount(p, null, "  CHASE   Checking (...6789) "), { accountId: "chk", why: "name" }, "case, spacing and a masked number");
  assert.equal(F.pickAccount(p, null, "Joint Checking"), null);
  assert.equal(F.pickAccount({ accounts: [{ id: "a", name: "Checking" }, { id: "b", name: "checking" }] }, null, "Checking"), null, "two with the name: the person picks");
  assert.deepEqual(F.pickAccount(p, { accounts: { [F.accountKey("Joint Checking (...4821)")]: "sav" } }, "Joint Checking (...4821)"), { accountId: "sav", why: "before" });
  assert.equal(F.pickAccount(p, { accounts: { [F.accountKey("X")]: "gone" } }, "X"), null, "an account no longer on the plan");
  assert.equal(F.plainName("Visa x1234"), "Visa"); assert.equal(F.plainName("Card ending 1234"), "Card"); assert.equal(F.plainName("Rainy day savings"), "Rainy day savings");
  assert.equal(F.addKindFor("Rewards Card (...3307)"), "credit"); assert.equal(F.addKindFor("Rainy day savings"), "savings"); assert.equal(F.addKindFor("CHECKING"), "checking");
  assert.ok(/^[0-9a-z]+$/.test(F.accountKey("Joint Checking (...4821)")) && !F.accountKey("Joint Checking (...4821)").includes("4821"), "the plan keeps a one-way key, never the name or its digits");
  // after checking is in, the default is the next account with lines to bring in
  const r = prepareImport(p, YNAB, { accountId: "chk", fileAccount: "Chase checking", importId: "i1" });
  p.transactions.push(...r.add);
  p.imports.push(C.importRecord(r, { id: "i1", at: "2026-11-14T10:00:00Z", accountId: "chk", fileName: "register.csv" }));
  assert.equal(p.imports[0].rows, 11, "this account's rows, not the whole file's"); assert.equal(p.imports[0].added, 9);
  assert.equal(prepareImport(p, YNAB, { accountId: null }).fileAccount, "Visa card");
});

test("#33 duplicates by the usual key: the same file twice adds nothing; a longer export adds only its new days; two accounts never match each other", () => {
  const p = family();
  const r1 = prepareImport(p, YNAB, { accountId: "chk", fileAccount: "Chase checking" });
  p.transactions.push(...r1.add);
  const again = prepareImport(p, YNAB, { accountId: "chk", fileAccount: "Chase checking" });
  assert.equal(again.add.length, 0); assert.equal(again.skip.length, 9);
  const longer = `${YNAB.trimEnd()}\n"Chase checking","","09/20/2026","Kroger","Everyday: Groceries","Everyday","Groceries","","$51.00","$0.00","Cleared"\n`;
  const l = prepareImport(p, longer, { accountId: "chk", fileAccount: "Chase checking" });
  assert.deepEqual(l.add.map((t) => [t.date, t.amount]), [["2026-09-20", -51]]); assert.equal(l.skip.length, 9);
  // the checking lines are not the savings account's: brought in to savings, all of them are new there
  const s = prepareImport(p, YNAB, { accountId: "sav", fileAccount: "Chase checking" });
  assert.equal(s.add.length, 9);
  // a bank's own CSV of the same day and amount with the same payee text is the same line (the key: account, day, amount, payee)
  const bank = "Date,Description,Amount\n09/03/2026,Kroger,-86.40\n";
  assert.equal(prepareImport(p, bank, { accountId: "chk" }).skip.length, 1);
});

test("#33 categories by name: the label, its id or a part of it, a plural or & aside; transfers by their own names; the lines' kind settles two hits", () => {
  const p = family();
  const id = (n, o) => F.categoryByName(p, n, o);
  assert.equal(id("Groceries"), "groceries"); assert.equal(id("GROCERY"), "groceries"); assert.equal(id("Rent"), "housing"); assert.equal(id("Mortgage"), "housing");
  assert.equal(id("Interest", { moneyIn: true }), "income-investment"); assert.equal(id("Gift"), "giving"); assert.equal(id("Gifts & Giving"), "giving");
  assert.equal(id("Internet"), "phone"); assert.equal(id("Taxes"), "taxes"); assert.equal(id("Travel"), "travel");
  assert.equal(id("Transfer"), "transfer"); assert.equal(id("Credit Card Payment"), "transfer"); assert.equal(id("Balance Adjustments"), "transfer");
  assert.equal(id("Other"), "other"); assert.equal(id("Other", { moneyIn: true }), "income-other");
  assert.equal(id("Coffee Shops"), null); assert.equal(id("Paychecks"), null); assert.equal(id(""), null);
  p.categories.push({ id: "coffee", label: "Coffee shops", kind: "expense" }, { id: "pets", hidden: true });
  assert.equal(id("Coffee Shops"), "coffee", "a category the person added"); assert.equal(id("Pets"), null, "a hidden one is never picked");
  assert.equal(F.noCategory("Ready to Assign"), true); assert.equal(F.noCategory("To be Budgeted"), true); assert.equal(F.noCategory("Paycheck", "Inflow"), true);
  assert.equal(F.noCategory("Uncategorized"), true); assert.equal(F.noCategory("Groceries", "Everyday"), false);
  assert.equal(F.isTransferPayee("Transfer : Savings"), true); assert.equal(F.isTransferPayee("Transfers R Us"), false);
});

test("#33 the file's categories: this visit's choice, then the one saved for the layout, then the name, then none; a new one gets a free id and its lines' kind", () => {
  const p = family();
  // a category the person renamed keeps its first id: it takes the id a new "Coffee Shops" would want (and matches by it)
  p.categories.push({ id: "coffee-shops", label: "Coffee spots", kind: "expense" });
  const r = prepareImport(p, YNAB, { accountId: "chk", fileAccount: "Chase checking", categories: { "coffee shop": "+new", electric: "utilities", "household good": "" } });
  const rows = Object.fromEntries(r.categoryRows.map((x) => [x.key, [x.name, x.count, x.auto, x.choice]]));
  assert.deepEqual(rows, { mortgage: ["Mortgage", 1, "housing", "housing"], grocery: ["Groceries", 2, "groceries", "groceries"], "household good": ["Household Goods", 1, null, ""],
    "coffee shop": ["Coffee Shops", 1, "coffee-shops", "+new"], electric: ["Electric", 1, null, "utilities"] });
  assert.deepEqual(r.newCategories, [{ id: "coffee-shops-2", label: "Coffee Shops", icon: "📦", kind: "expense", essential: false }]);
  assert.equal(by(r, "Corner Cafe").category, "coffee-shops-2"); assert.equal(by(r, "Dayton Power").category, "utilities");
  assert.equal(r.fileFiled, 7, "mortgage, Kroger, Target, cafe, power and the two transfers");
  // money in: a new category is income
  const inc = prepareImport(p, MONARCH, { accountId: "chk", fileAccount: "Joint Checking (...4821)", categories: { paycheck: "+new" } });
  assert.deepEqual(inc.newCategories.map((c) => [c.label, c.kind]), [["Paychecks", "income"]]);
  // a new category whose lines are all on file already is not added
  p.transactions.push(...prepareImport(p, YNAB, { accountId: "chk", fileAccount: "Chase checking" }).add);
  assert.deepEqual(prepareImport(p, YNAB, { accountId: "chk", fileAccount: "Chase checking", categories: { "coffee shop": "+new" } }).newCategories, []);
  // what the layout keeps: only the choices that differ from the name, a new one by its id; never a name of an account
  const prof = F.profileFor({ accountId: "x", mapping: {}, flipSign: false, categories: { mortgage: "" } }, r, { accountId: "chk", mapping: r.mapping, flipSign: false });
  assert.deepEqual(prof.categories, { "coffee shop": "coffee-shops-2", electric: "utilities" }, "mortgage is back to its name match");
  assert.deepEqual(Object.values(prof.accounts), ["chk"]); assert.ok(!JSON.stringify(prof).includes("Chase checking"));
  const p2 = family(); p2.importProfiles[r.headerKey] = prof;
  assert.equal(prepareImport(p2, YNAB, { accountId: "chk", fileAccount: "Chase checking" }).categoryRows.find((x) => x.key === "electric").choice, "utilities", "next month's file maps itself");
  assert.equal(prepareImport(p2, YNAB, { accountId: "chk", fileAccount: "Chase checking" }).categoryRows.find((x) => x.key === "coffee shop").choice, "", "a saved category no longer on the list is not used");
  // any other file's layout is kept exactly as before
  assert.deepEqual(F.profileFor({ accountId: "a", mapping: {}, flipSign: true, accounts: {} }, { mapping: {} }, { accountId: "chk", mapping: { date: 0 }, flipSign: false }), { accountId: "chk", mapping: { date: 0 }, flipSign: false });
});

test("#33 Undo takes off the categories an import added, unless something else uses them", () => {
  const p = family();
  p.categories.push({ id: "coffee-shops", label: "Coffee Shops" }, { id: "dining-out", label: "Dining Out" }, { id: "kept", label: "Kept" });
  p.transactions.push({ id: "t1", category: "groceries", splits: [{ category: "dining-out", amount: -2 }, { category: "groceries", amount: -3 }] });
  p.rules.push({ id: "r", category: "kept" });
  const gone = F.undoCategories(p, { categories: ["coffee-shops", "dining-out", "kept"] });
  assert.deepEqual(gone, ["Coffee Shops"]); assert.deepEqual(p.categories.map((c) => c.id), ["dining-out", "kept"]);
  assert.deepEqual(F.undoCategories(p, {}), []);
  const r = prepareImport(family(), YNAB, { accountId: "chk", fileAccount: "Chase checking", categories: { "coffee shop": "+new" } });
  assert.deepEqual(C.importRecord(r, { id: "i", at: "t", accountId: "chk", fileName: "f" }).categories, ["coffee-shops"]);
  assert.equal(C.importRecord(r, { id: "i", at: "t", accountId: "chk", fileName: "f", checkedOnly: true }).categories, undefined);
  assert.equal(C.importRecord(prepareImport(family(), CHASE, { accountId: "chk" }), { id: "i", at: "t", accountId: "chk", fileName: "f" }).categories, undefined);
});

test("#33 split purchases: only a whole run 1 to n of one day and payee is put together; one category needs no splits", () => {
  const t = (amount, category = "", extra = {}) => ({ id: `t${amount}`, date: "2026-09-05", amount, payee: "Target", rawPayee: "Target", accountId: "chk", category, tags: [], note: "", ...extra });
  const m = (i, n) => ({ split: { i, n } });
  const key = (x) => `${x.date}|${x.amount}`;
  let r = F.mergeSplits([t(-1, "a"), t(-2, "b"), t(-3, "a")], [m(1, 3), m(2, 3), m(3, 3)], key);
  assert.equal(r.merged, 1); assert.equal(r.txs.length, 1); near(r.txs[0].amount, -6); assert.equal(r.txs[0].category, "a"); assert.equal(r.txs[0].splits.length, 3);
  r = F.mergeSplits([t(-1, "a"), t(-2, "a")], [m(1, 2), m(2, 2)], key);
  assert.equal(r.txs[0].splits, undefined); assert.equal(r.txs[0].category, "a");
  r = F.mergeSplits([t(-1, "a"), t(-2, "b")], [m(1, 3), m(2, 3)], key);
  assert.equal(r.merged, 0); assert.equal(r.txs.length, 2, "part 3 missing: the rows stay rows");
  r = F.mergeSplits([t(-1, "a"), t(-2, "b", { date: "2026-09-06" })], [m(1, 2), m(2, 2)], key);
  assert.equal(r.merged, 0, "another day is another purchase");
  r = F.mergeSplits([t(-5, "a"), t(2, "b")], [m(1, 2), m(2, 2)], key);
  near(r.txs[0].amount, -3); assert.equal(r.txs[0].splits, undefined, "a part going the other way: whole, under its biggest part's category"); assert.equal(r.txs[0].category, "a");
});

test("#33 an app's file keeps its own sign on every account: a card's month of payments is not turned around; the sign saved for the layout is not used (critic M1)", () => {
  // Monarch writes money out as minus on a card too: two payments and one purchase are +300, +250 and -20 as they stand
  const csv = ["Date,Merchant,Category,Account,Original Statement,Notes,Amount,Tags", "2026-10-01,Pay,Credit Card Payment,Card,PAY 1,,300.00,",
    "2026-10-02,Pay,Credit Card Payment,Card,PAY 2,,250.00,", "2026-10-03,Shop,Shopping,Card,SHOP,,-20.00,",
    "2026-10-01,Acme,Paychecks,Checking,ACME,,1950.00,", "2026-10-02,Rent,Rent,Checking,RENT,,-1200.00,"].join("\n");
  const p = family();
  const card = prepareImport(p, csv, { accountId: "visa", fileAccount: "Card" });
  assert.deepEqual(card.add.map((t) => t.amount), [300, 250, -20]);
  assert.equal(card.flipSign, false); assert.equal(card.flipAuto, false); assert.equal(card.auto.flipSign, false);
  // the box "Amounts look backwards" still turns them, by hand
  const byHand = prepareImport(p, csv, { accountId: "visa", fileAccount: "Card", flipSign: true });
  assert.deepEqual(byHand.add.map((t) => t.amount), [-300, -250, 20]); assert.equal(byHand.flipByHand, true);
  // the same file read as any bank file (the old way) does turn a mostly positive card around: the apps' files never are
  assert.equal(prepareImport(p, csv, { accountId: "visa", formats: false }).flipAuto, true);
  for (const [f, name] of [[YNAB, "Visa card"], [MINT, "Visa Signature"], [MONARCH, "Rewards Card (...3307)"]]) {
    const r = prepareImport(p, f, { accountId: "visa", fileAccount: name });
    assert.equal(r.flipSign, false, name); assert.equal(r.flipAuto, false, name);
  }
  const chk = prepareImport(p, csv, { accountId: "chk", fileAccount: "Checking" });
  assert.equal(chk.flipSign, false, "a checking account's lines are never turned around for it");
  p.importProfiles[chk.headerKey] = { accountId: "visa", mapping: chk.mapping, flipSign: true };
  assert.equal(prepareImport(p, csv, { accountId: "chk", fileAccount: "Checking" }).flipSign, false, "a tick saved for a card is not this account's");
  // a file with no account names: the sign saved for its layout is the person's, as for any file
  const one = "Date,Merchant,Category,Account,Original Statement,Notes,Amount,Tags\n2026-10-03,Shop,Shopping,,SHOP,,20.00,\n";
  p.importProfiles[C.headerKey(parseCsv(one).headers)] = { accountId: "visa", mapping: null, flipSign: true };
  assert.deepEqual(prepareImport(p, one, { accountId: "visa" }).add.map((t) => t.amount), [-20]);
});

test("#33 \"Add it as a new category\" for a name in two of the file's accounts adds it once (critic M2)", () => {
  const csv = "Date,Merchant,Category,Account,Original Statement,Notes,Amount,Tags\n2026-10-01,Cafe,Coffee Shops,A,CAFE 1,,-4.50,\n2026-10-02,Cafe,Coffee Shops,B,CAFE 2,,-5.50,\n";
  const p = { ...family(), accounts: [{ id: "a1", name: "A", type: "checking" }, { id: "b1", name: "B", type: "checking" }] };
  const choices = { "coffee shop": "+new" };   // kept by the page from one account of the file to the next
  const bring = (accountId, fileAccount, importId) => {
    const f = prepareImport(p, csv, { accountId, fileAccount, importId, categories: choices });
    p.categories.push(...f.newCategories);
    p.transactions.push(...f.add);
    p.imports.push(C.importRecord(f, { id: importId, at: "t", accountId, fileName: "f.csv" }));
    p.importProfiles[f.headerKey] = F.profileFor(p.importProfiles[f.headerKey], f, { accountId, mapping: f.mapping, flipSign: f.flipSign });
    return f;
  };
  const a = bring("a1", "A", "ia");
  assert.deepEqual(a.newCategories.map((c) => [c.id, c.label]), [["coffee-shops", "Coffee Shops"]]);
  const b = bring("b1", "B", "ib");
  assert.deepEqual(b.newCategories, [], "the list has it now: no second Coffee Shops");
  assert.equal(b.categoryRows[0].choice, "coffee-shops"); assert.equal(b.add[0].category, "coffee-shops");
  assert.deepEqual(p.categories.filter((c) => c.label === "Coffee Shops").map((c) => c.id), ["coffee-shops"]);
  assert.equal(C.importRecord(b, { id: "ib", at: "t", accountId: "b1", fileName: "f.csv" }).categories, undefined, "Undo of the second import takes no category off");
  assert.equal(p.importProfiles[b.headerKey].categories, undefined, "next month the name finds it");
});

test("#33 two identical lines on one day in an app's file are two purchases; the plan holding one, one comes in (critic M3)", () => {
  const csv = "Date,Merchant,Category,Account,Original Statement,Notes,Amount,Tags\n2026-10-01,Cafe,Restaurants,A,CAFE,,-4.50,\n2026-10-01,Cafe,Restaurants,A,CAFE,,-4.50,\n";
  const p = family();
  const r = prepareImport(p, csv, { accountId: "chk", importId: "x" });
  assert.equal(r.add.length, 2); assert.equal(r.skip.length, 0); near(r.outTotal, 9);
  p.transactions.push(r.add[0]);
  const again = prepareImport(p, csv, { accountId: "chk" });
  assert.equal(again.add.length, 1); assert.equal(again.skip.length, 1);
  p.transactions.push(r.add[1]);
  assert.equal(prepareImport(p, csv, { accountId: "chk" }).add.length, 0, "both on file: nothing comes in");
  // the next account in the file is the one with a line not on file yet, counted the same way
  const two = `${csv}2026-10-02,Shop,Shopping,B,SHOP,,-9.00,\n`;
  const q = { ...family(), accounts: [{ id: "a1", name: "A", type: "checking" }, { id: "b1", name: "B", type: "checking" }] };
  q.transactions.push({ ...r.add[0], accountId: "a1", key: `a1|2026-10-01|-4.50|cafe` });
  assert.equal(prepareImport(q, two, { accountId: null }).fileAccount, "A", "one of A's two coffees is still to come");
  // a bank's CSV reads the same way since 2026-11-14: two $4.50 coffees on one day are two purchases
  const bank = "Date,Description,Amount\n2026-10-01,Cafe,-4.50\n2026-10-01,Cafe,-4.50\n";
  const b = family(), first = prepareImport(b, bank, { accountId: "chk" });
  assert.equal(first.add.length, 2);
  b.transactions.push(...first.add);
  assert.equal(prepareImport(b, bank, { accountId: "chk" }).add.length, 0, "the same file again: nothing comes in");
  // dedupe: the key as a count, `counted` or not
  const t = (id) => ({ id, accountId: "chk", date: "2026-10-01", amount: -4.5, rawPayee: "CAFE" });
  assert.equal(dedupe([], [t("1"), t("2")]).add.length, 2);
  assert.equal(dedupe([], [t("1"), t("2")], { counted: true }).add.length, 2);
  assert.equal(dedupe([t("0")], [t("1"), t("2")], { counted: true }).add.length, 1);
});

test("#33 a YNAB file brought in as any bank file before: its split purchase is not added again as a whole (critic M4)", () => {
  const p = family();
  const old = prepareImport(p, YNAB, { accountId: "chk", importId: "old", formats: false });
  assert.equal(old.add.filter((t) => t.rawPayee === "Target").length, 2, "the old way: one line per part");
  p.transactions.push(...old.add);
  const r = prepareImport(p, YNAB, { accountId: "chk", fileAccount: "Chase checking" });
  assert.equal(r.add.length, 0, "every line of checking is on file, the split purchase by its parts"); assert.equal(r.skip.length, 9);
  // one part missing on file: the whole purchase comes in
  const q = family();
  q.transactions.push(...old.add.filter((t) => !(t.rawPayee === "Target" && t.amount === -25.5)));
  assert.deepEqual(prepareImport(q, YNAB, { accountId: "chk", fileAccount: "Chase checking" }).add.map((t) => [t.payee, t.amount]), [["Target", -65.5]]);
  // the parts' own keys, for that check
  const m = F.mergeSplits([{ id: "a", date: "d", amount: -1, rawPayee: "T", key: "k1" }, { id: "b", date: "d", amount: -2, rawPayee: "T", key: "k2" }], [{ split: { i: 1, n: 2 } }, { split: { i: 2, n: 2 } }], (x) => `${x.amount}`);
  assert.deepEqual([...m.partKeys.entries()], [["a", ["k1", "k2"]]]);
});

test("#33 money with a thousands comma and no cents in an app's file (critic M5)", () => {
  for (const [s, n] of [["1,234", 1234], ["$12,500", 12500], ["-1,234,567", -1234567], ["(1,234)", -1234], ["$1,234.56", 1234.56], ["12,34", 12.34], ["12,5", 12.5], ["0,123", 0.123], ["-4.50", -4.5], ["", null], ["n/a", null]])
    assert.equal(C.appAmount(s), n, s);
  const csv = "Date,Merchant,Category,Account,Original Statement,Notes,Amount,Tags\n2026-10-01,Landlord,Rent,A,RENT,,\"-1,450\",\n";
  assert.deepEqual(prepareImport(family(), csv, { accountId: "chk" }).add.map((t) => t.amount), [-1450]);
  const ynab = '"Account","Date","Payee","Outflow","Inflow"\n"Chase checking","09/02/2026","Landlord","$1,450","$0"\n';
  assert.deepEqual(prepareImport(family(), ynab, { accountId: "chk" }).add.map((t) => t.amount), [-1450]);
});

test("#33 a plan whose categories or accounts are not what they should be does not stop an app's file (critic M6)", () => {
  for (const extra of [{ categories: "junk" }, { categories: [null, 5, { label: "no id" }] }, { categories: null }, { accounts: [null, { id: "chk", name: "Chase checking", type: "checking" }] }]) {
    const p = { ...family(), ...extra };
    const r = prepareImport(p, MONARCH, { accountId: "chk", fileAccount: "Joint Checking (...4821)" });
    assert.equal(r.add.length, 5, JSON.stringify(extra));
    assert.equal(by(r, "Kroger").category, "groceries", JSON.stringify(extra));
  }
});

test("#33 the file's account names as the page writes them; the accounts it offers (critic P5, P6)", () => {
  assert.equal(F.tidyName("CHECKING"), "Checking"); assert.equal(F.tidyName("VISA SIGNATURE"), "Visa Signature");
  assert.equal(F.tidyName("AMEX GOLD (...1234)"), "Amex Gold (...1234)"); assert.equal(F.tidyName("Joint Checking (...4821)"), "Joint Checking (...4821)");
  assert.equal(F.tidyName("eBay card"), "eBay card"); assert.equal(F.tidyName(""), ""); assert.equal(F.tidyName(null), "");
  assert.deepEqual([...F.APP_ACCOUNT_TYPES], ["checking", "savings", "cash", "credit"]);
});

test("#33 the sentences, one per case", () => {
  const say = (o) => C.formatSaid({ app: "YNAB", from: "register.csv", to: "Chase checking", ...o });
  assert.equal(say({ added: 9, kept: 0 }), "Added 9 transactions from register.csv to Chase checking.");
  assert.equal(say({ added: 1, kept: 1 }), "Added 1 transaction from register.csv to Chase checking. It kept its YNAB category.");
  assert.equal(say({ added: 9, kept: 9 }), "Added 9 transactions from register.csv to Chase checking. All of them kept their YNAB category.");
  assert.equal(say({ added: 9, kept: 7, needCat: 2 }), "Added 9 transactions from register.csv to Chase checking. 7 of them kept their YNAB category. 2 still need a category.");
  assert.equal(say({ added: 9, kept: 1, needCat: 1 }), "Added 9 transactions from register.csv to Chase checking. 1 of them kept its YNAB category. 1 still needs a category.");
  assert.equal(say({ added: 9, kept: 0, needCat: 9 }), "Added 9 transactions from register.csv to Chase checking. Now give them a category.");
  assert.equal(say({ added: 9, kept: 5, needCat: 4, next: { name: "Visa card", count: 5 } }), "Added 9 transactions from register.csv to Chase checking. 5 of them kept their YNAB category. Next in this file: “Visa card” (5 lines). If you leave this page, choose the file again for the rest.");
  assert.equal(say({ added: 2, kept: 0, next: { name: "", count: 1 } }), "Added 2 transactions from register.csv to Chase checking. Next in this file: the lines with no account name (1 line). If you leave this page, choose the file again for the rest.");
  assert.equal(C.fileAccountsWords(3), "This file has 3 accounts. Choose the one to bring in now");
  assert.equal(C.pickFirstWords, "Pick which of your accounts these lines go to first, or tap “It is not on my plan yet”.");
  assert.deepEqual(C.formatNotes({ left: [{}], merged: 1 }), ["1 starting balance was left out: YNAB's opening figure for an account, not money in or out.", "1 purchase split across categories comes in whole, with its parts."]);
  assert.deepEqual(C.formatNotes({ left: [{}, {}], merged: 2 }), ["2 starting balances were left out: YNAB's opening figure for each account, not money in or out.", "2 purchases split across categories come in whole, with their parts."]);
  assert.deepEqual(C.formatNotes({ left: [], merged: 0 }), []);
  assert.equal(C.categoryLine(1, 1), "It has the same name as one on your list, so its lines come in with it.");
  assert.equal(C.categoryLine(0, 1), "It is not on your list by name. Pick one of yours, add it as a new category, or leave its lines for Categorize.");
  assert.equal(C.categoryLine(5, 5), "All 5 have the same name as one on your list, so their lines come in with them.");
  assert.equal(C.categoryLine(0, 3), "None of the 3 is on your list by name. For each, pick one of yours, add it as a new category, or leave its lines for Categorize.");
  assert.equal(C.categoryLine(2, 5), "2 of the 5 have the same name as one on your list, so their lines come in with them. For the other 3, pick one of yours, add it as a new category, or leave the lines for Categorize.");
  assert.equal(C.undoCategoryWords(0), ""); assert.equal(C.undoCategoryWords(1), " The category it added goes too, unless something else uses it.");
  assert.equal(C.undoCategoryWords(3), " The 3 categories it added go too, unless something else uses them.");
  assert.equal(C.goneWords([]), ""); assert.equal(C.goneWords(["Coffee Shops"]), " Coffee Shops is off your list of categories again."); assert.equal(C.goneWords(["A", "B"]), " The 2 categories it added are off your list again.");
});

// ---------------------------------------------------------------- #33 on the page (a stand-in DOM, qa/fixtures/fake-dom.mjs)
// The critics' phone walk (2026-11-14): P4 no filled button while nothing is picked, P5 a 401(k) or a loan offered for a bank
// file's account, P6 "holds ... Bring in" and a name in capitals, P2 the name typed again on Net worth and not picked after.
test("#33 the page for a file with several accounts: bank and card accounts only, its names in ordinary case, the Import button there before an account is picked, the name carried to Net worth and the added account picked on the way back (critics P2, P4, P5, P6)", async () => {
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmtM = await import("../../../core/format.js");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { render } = await import("./view.js");
  globalThis.requestAnimationFrame ??= (f) => setTimeout(f, 0);   // (the page brings its preview up after a frame)
  const draw = (plan) => {
    const root = new FakeElement("div"), saved = [];
    const ctx = { ui, fmt: { ...fmtM, today: () => "2026-11-14" }, plan, route: { group: "transactions", id: "import", rest: [], query: {} }, view: {}, go: () => {},
      store: { get: () => plan, update: (fn) => { const d = structuredClone(plan); fn(d); saved.push(d); } } };
    render(root, ctx);
    const all = () => root.all();
    const button = (t) => all().find((e) => e.tagName === "BUTTON" && e.textContent === t);
    return { root, saved, all, button, text: () => textOf(root), paste(csv) { all().find((e) => e.tagName === "TEXTAREA").value = csv; button("Use the pasted text").click(); } };
  };
  const plan = migrate({ ...emptyPlan(), accounts: [{ id: "chk", name: "Everyday", type: "checking", balance: 100 }, { id: "k401", name: "Work 401(k)", type: "401k", balance: 9 },
    { id: "loan", name: "Car loan", type: "loan", balance: 9 }, { id: "home", name: "Our home", type: "property", balance: 9 }, { id: "visa", name: "Visa card", type: "credit", balance: 9 }] });
  const s = draw(plan);
  s.paste(MINT);
  const t = s.text();
  assert.match(t, /This file has 2 accounts\. Choose the one to bring in now Checking \(5 lines\) Visa Signature \(3 lines\) One at a time: the file stays on this page for the next one\./);
  assert.match(t, /Which of your accounts is “Checking”\? Pick one Everyday Visa card Nothing is brought in until you pick one\./);
  for (const w of ["CHECKING", "holds", "Work 401(k)", "Car loan", "Our home"]) assert.ok(!t.includes(w), w);
  // one filled button, the Import, before anything is picked; it brings nothing in then
  const filled = s.all().filter((e) => (e.tagName === "BUTTON" && !e.classList.contains("secondary")) || (e.tagName === "A" && e.classList.contains("btn") && !e.classList.contains("secondary")));
  assert.deepEqual(filled.map((e) => e.textContent), ["Import 5 transactions"]);
  s.button("Import 5 transactions").click();
  assert.equal(s.saved.length, 0, "nothing comes in until an account is picked");
  // "It is not on my plan yet": an outlined button to Net worth's add form with the file's name, its masked number left off
  const add = s.all().find((e) => e.tagName === "A" && e.textContent === "It is not on my plan yet");
  assert.equal(add.className, "btn secondary"); assert.equal(add.getAttribute("href"), "#/balance/net-worth?add=checking&from=import&name=Checking");
  add.dispatch("click");
  // back with one account more (added on Net worth under another name): it is picked for "Checking", and says why
  const back = draw(migrate({ ...structuredClone(plan), accounts: [...plan.accounts, { id: "new1", name: "Joint", type: "checking", balance: 0 }] }));
  assert.match(back.text(), /Which of your accounts is “Checking”\? Everyday Visa card Joint Picked for you: the account you just added for it\./);
  back.button("Import 5 transactions").click();
  assert.equal(back.saved.length, 1); assert.ok(back.saved[0].transactions.length >= 5 && back.saved[0].transactions.every((t) => t.accountId === "new1"));
  // Monarch's names keep their case; the masked number stays off the name carried to Net worth
  const m = draw(plan);
  m.paste(MONARCH);
  assert.equal(m.all().find((e) => e.tagName === "A" && e.textContent === "It is not on my plan yet").getAttribute("href"), "#/balance/net-worth?add=checking&from=import&name=Joint%20Checking");
});

// ---- a bank file that sets the balance of an account in another currency or only partly yours (balance/net-worth/worked.js,
// gap next-60 #18 and #19): the file's figure is the whole, in the account's own currency, worked out through worked.js
test("worked balances: a euro file offers its balance for an account in euros (worked out at the plan's rate), never for one in dollars; a shared account's file is the whole; Undo puts back the whole too", async () => {
  const { balanceOffer, setBalanceFromFile, undoBalance } = await import("./compute.js");
  const { emptyPlan: empty } = await import("../../../core/schema/migrate.js");
  const p = empty();
  p.currencyRates = { EUR: { rate: 1.08, asOf: "2026-11-01" } };
  p.accounts.push({ id: "eu", name: "Paris savings", type: "savings", balance: 12960, asOf: "2026-11-01", currency: "EUR", fullBalance: 12000, history: [] },
    { id: "cab", name: "Joint savings with my sister", type: "savings", balance: 5000, asOf: "2026-11-01", share: 0.5, fullBalance: 10000, history: [] },
    { id: "us", name: "Savings", type: "savings", balance: 900, asOf: "2026-11-01", history: [] },
    { id: "jp", name: "Tokyo savings", type: "savings", balance: 70, asOf: "2026-11-01", currency: "JPY", fullBalance: 10000, history: [] });
  const file = (currency, balance = 12500) => ({ kind: "savings", balance, balanceDate: "2026-11-15", currency, rows: [] });
  const o = balanceOffer(p, "eu", file("EUR"), { today: "2026-11-16" });
  assert.deepEqual(o, { accountId: "eu", amount: 12500, date: "2026-11-15", was: 12000, wasAsOf: "2026-11-01", debt: false, own: { code: "EUR", share: 1, rate: 1.08, dollars: 13500 } });
  assert.deepEqual(balanceOffer(p, "eu", file(null), { today: "2026-11-16" })?.own?.dollars, 13500, "a file that names no currency: the account's own");
  assert.equal(balanceOffer(p, "eu", file("USD"), { today: "2026-11-16" }), null, "a dollar file is not this euro account's");
  assert.equal(balanceOffer(p, "us", file("EUR"), { today: "2026-11-16" }), null, "a euro figure is never saved as dollars (as before)");
  assert.equal(balanceOffer(p, "jp", file("JPY"), { today: "2026-11-16" }), null, "no yen rate yet: not offered");
  assert.equal(balanceOffer(p, "eu", file("EUR", 12000), { today: "2026-11-16" })?.amount, 12000, "the whole compared in euros: a newer day with the same figure is still offered");
  const s = balanceOffer(p, "cab", file(null, 10400), { today: "2026-11-16" });
  assert.deepEqual([s.was, s.own], [10000, { code: null, share: 0.5, rate: 1, dollars: 5200 }]);
  // set, then undo: the balance, its whole and its date as they were
  const d = structuredClone(p);
  const rec = setBalanceFromFile(d, o);
  const eu = d.accounts.find((a) => a.id === "eu");
  assert.deepEqual([eu.balance, eu.fullBalance, eu.asOf], [13500, 12500, "2026-11-15"]);
  assert.equal(rec.wasFull, 12000);
  assert.equal(undoBalance(d, { accountId: "eu", balance: rec }), true);
  assert.deepEqual([eu.balance, eu.fullBalance, eu.asOf], [12960, 12000, "2026-11-01"]);
  // a plain account's record carries no whole (as before)
  const d2 = structuredClone(p);
  const rec2 = setBalanceFromFile(d2, balanceOffer(p, "us", file(null, 950), { today: "2026-11-16" }));
  assert.ok(!("wasFull" in rec2));
  assert.equal(d2.accounts.find((a) => a.id === "us").balance, 950);
});

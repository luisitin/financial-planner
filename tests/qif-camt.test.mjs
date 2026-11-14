// tests/qif-camt.test.mjs -- Import reads a Quicken QIF file and a European bank's CAMT.053 statement (gap list, next 60,
// item 43, 2026-11-14): modules/transactions/import/qif.js, camt.js and compute.js prepareQif, prepareCamt. Every file here is
// invented and written inline (invented payees, short invented references). An account number is built from 4-digit groups
// at run time (no long digit run sits in this file: tools/leak-guard.mjs), and none of it may reach the plan.
// The last part proves nothing changed for anyone who brings in a CSV, OFX or another app's file.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isQif, qifDate, qifDateOrder, qifDateCheck, qifAmount, qifDecimalMark, parseQif, qifCategoryName } from "../modules/transactions/import/qif.js";
import { isCamt, readXml, parseCamt } from "../modules/transactions/import/camt.js";
import { prepareImport, prepareStatement, prepareQif, prepareCamt, prepareOfx, isStatement, decodeFile, qifCategory, qifNotes, camtNotes, shownName, importRecord, setBalanceFromFile, guessOfxAccount, parseBankCsv, readFormat, STATEMENT_KINDS, balanceOffer, otherCurrency } from "../modules/transactions/import/compute.js";
import { isOfx } from "../core/ofx.js";
import { txKey } from "../modules/transactions/ledger/compute.js";
import { emptyPlan, migrate } from "../core/schema/migrate.js";
import { ARCHETYPES } from "../qa/households/lib/catalog.mjs";
import * as phone from "../qa/fixtures/phone-households.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const TODAY = "2026-11-14";
const g = (...p) => p.join("");                                  // an account number in groups: no long run in the source
const IBAN1 = g("DE12", "5001", "0517", "0000", "4821");          // invented checking account at the invented Lindenbank
const IBAN2 = g("DE34", "5001", "0517", "0000", "7713");          // invented savings account
const OTHER = g("DE56", "1203", "0000", "0000", "9067");          // the other party's, written in a payment's words

// a household with a checking account, savings and a card (invented names, as in qa/)
const plan = () => migrate({ ...emptyPlan(), accounts: [
  { id: "chk", name: "Joint checking", type: "checking", balance: 2000, asOf: "2026-09-30" },
  { id: "sav", name: "Rainy day savings", type: "savings", balance: 5000, asOf: "2026-09-30" },
  { id: "visa", name: "Visa card", type: "credit", balance: 300, asOf: "2026-09-30" }] });
// the same household counting in euros (a CAMT file's balance is offered only to a plan in the file's currency)
const eurPlan = () => { const p = plan(); p.meta.currency = "EUR"; return p; };
const importInto = (p, prep, { fileName = "file", balance = false } = {}) => {
  for (const t of prep.add) { p.transactions = p.transactions ?? []; p.transactions.push({ ...t, id: `t${p.transactions.length + 1}`, key: txKey(t), importId: "im1" }); }
  const undo = balance && prep.balance ? setBalanceFromFile(p, prep.balance) : null;
  (p.imports = p.imports ?? []).push(importRecord(prep, { id: "im1", at: `${TODAY}T10:00:00Z`, accountId: prep.accountId, fileName, balance: undo }));
  return p;
};

// ---------------------------------------------------------------- QIF
// 1. a Quicken export of one bank account: its name, an opening balance, a category with a subcategory, a class, a transfer, a
//    split purchase, a check, a payee in capitals and U instead of T
const BANK = `!Account
NJoint checking
TBank
^
!Type:Bank
D10/ 1'26
T1,000.00
CX
POpening Balance
L[Joint checking]
^
D10/ 3'26
T-54.20
PKroger
LGroceries
^
D10/ 5'26
T2,310.55
PAcme Payroll
LSalary
^
D10/ 7'26
T-1,450.00
N1042
POakwood Apartments
LHousing:Rent
MOctober rent
^
D10/ 9'26
T-500.00
PTransfer to savings
L[Rainy day savings]
^
D10/12'26
T-62.40
PTarget
L--Split--
SGroceries
EFood
$-40.00
SHousehold
$-22.40
^
D10/14'26
U-4.50
PCORNER COFFEE #12
LDining/Weekend
^
D10/20'26
T-35.00
N1043
^
`;

test("QIF: known by its first line, never by its name; a CSV, an OFX file and a CAMT file are not QIF", () => {
  assert.equal(isQif(BANK), true);
  assert.equal(isQif("﻿!Type:CCard\r\nD1/2/26\r\n"), true);
  assert.equal(isQif("!Option:AutoSwitch\n!Account\n"), true);
  assert.equal(isQif("Date,Description,Amount\n1/2/26,!Type:Bank,1\n"), false);
  assert.equal(isQif("note\n!Type:Bank\n"), false, "the header must be the first line");
  assert.equal(isQif(camt053()), false);
  assert.equal(isQif("OFXHEADER:100\n<OFX>"), false);
  assert.equal(isStatement(BANK), true);
});

test("QIF dates: every spelling Quicken and banks write, the day first only when the file says so", () => {
  for (const [s, iso] of [["1/15/26", "2026-01-15"], ["1/15'26", "2026-01-15"], ["01/15/2026", "2026-01-15"], [" 6/ 1/94", "1994-06-01"], ["1/ 5' 6", "2006-01-05"],
    ["12/31'99", "2099-12-31"], ["2026-01-15", "2026-01-15"], ["20260115", "2026-01-15"], ["1-15-2026", "2026-01-15"]]) assert.equal(qifDate(s), iso, s);
  assert.equal(qifDate("15/01/2026", "DMY"), "2026-01-15");
  assert.equal(qifDate("15.01.26", "DMY"), "2026-01-15");
  assert.equal(qifDate("03/11/2026", "DMY"), "2026-11-03");
  assert.equal(qifDate("03/11/2026", "MDY"), "2026-03-11");
  for (const s of ["2/30/26", "13/45/26", "1/15/126", "", "soon", "1/1/1969"]) assert.equal(qifDate(s), null, s);
  // the order: dates with a first number above 12 against dates with a second above 12, the more win; else dots day first,
  // else month first
  assert.equal(qifDateOrder(["01/02/2026", "15/02/2026"]), "DMY");
  assert.equal(qifDateOrder(["01/02/2026", "02/15/2026", "15/02/2026"]), "MDY", "one each way: Quicken's U.S. default");
  assert.equal(qifDateOrder(["02/15/2026", "16/02/2026", "17/02/2026"]), "DMY", "the more dates win, not the first");
  assert.equal(qifDateOrder(["01.02.26", "03.02.26"]), "DMY");
  assert.equal(qifDateOrder(["01/02/26", "03/02/26"]), "MDY");
  assert.equal(qifDateOrder(["1/15'26"]), "MDY");
  const uk = parseQif("!Type:CCard\nD15/10/2026\nT-23.10\nPTesco\n^\nD03/11/2026\nT-9.99\nPStreaming Svc\n^\n");
  assert.equal(uk.dateOrder, "DMY");
  assert.deepEqual(uk.accounts[0].rows.map((r) => r.date), ["2026-10-15", "2026-11-03"]);
});

test("QIF date order the file does not settle: asked with one of its own dates, and the answer is used (fix round F1, F2)", () => {
  // F1: one stray date with a day above 12 among dates that read both ways: day first by the evidence, but not sure
  const stray = ["11/1/2026", "11/2/2026", "11/3/2026", "13/6/2026"];
  assert.deepEqual(qifDateCheck(stray), { order: "DMY", sure: false, sample: "11/1/2026" });
  // F2: every date at most 12/12 (a European file of the first days of a month): month first by default, not sure
  assert.deepEqual(qifDateCheck(["03/04/2026", "05/04/2026"]), { order: "MDY", sure: false, sample: "03/04/2026" });
  assert.deepEqual(qifDateCheck(["03.04.2026", "05.04.2026"]), { order: "DMY", sure: false, sample: "03.04.2026" }, "dots: day first, still asked");
  // the example as a person reads it: Quicken's padding spaces dropped, the year in full
  assert.deepEqual(qifDateCheck(["10/ 1'26", "10/ 3'26"]), { order: "MDY", sure: false, sample: "10/1/2026" });
  assert.deepEqual(qifDateCheck(["03.04.26"]), { order: "DMY", sure: false, sample: "03.04.2026" });
  assert.deepEqual(qifDateCheck(["5/4/126", "0/4/2026"]), { order: "MDY", sure: true, sample: null }, "a date that is no date is no example");
  // settled: two or more dates read one way only and none the other; no date that reads two ways; dates that disagree are not
  assert.deepEqual(qifDateCheck(["15/10/2026", "16/10/2026", "03/11/2026"]), { order: "DMY", sure: true, sample: null });
  assert.deepEqual(qifDateCheck(["10/15/2026", "10/16/2026", "11/3/2026"]), { order: "MDY", sure: true, sample: null });
  assert.deepEqual(qifDateCheck(["15/10/2026"]), { order: "DMY", sure: true, sample: null });
  assert.deepEqual(qifDateCheck(["1/15'26", "5/5/2026", "2026-01-15"]), { order: "MDY", sure: true, sample: null });
  assert.deepEqual(qifDateCheck(["10/15/2026", "15/10/2026", "16/10/2026"]), { order: "DMY", sure: false, sample: null }, "dates that disagree");
  // the file: read by the evidence, unless the person answered
  const file = "!Type:Bank\n" + stray.map((d, i) => `D${d}\nT-${i + 1}.00\nPShop ${i + 1}\n^\n`).join("");
  const q = parseQif(file);
  assert.equal(q.dateOrder, "DMY"); assert.equal(q.dateCheck.sure, false);
  assert.deepEqual(q.accounts[0].rows.map((r) => r.date), ["2026-01-11", "2026-02-11", "2026-03-11", "2026-06-13"]);
  const us = parseQif(file, { dateOrder: "MDY" });
  assert.equal(us.dateOrder, "MDY");
  assert.deepEqual(us.accounts[0].rows.map((r) => r.date), ["2026-11-01", "2026-11-02", "2026-11-03"]);
  assert.deepEqual(us.accounts[0].bad, [{ row: 4, why: "no date" }], "the stray date is said, not guessed");
  // prepareQif: the question with the file's own date in words, the answer used, no day-first note while asked
  const prep = prepareQif(plan(), file, { today: TODAY });
  assert.equal(prep.dateOrder, "DMY");
  assert.deepEqual(prep.dateAsk, { sample: "11/1/2026", MDY: "November 1", DMY: "January 11" });
  assert.ok(!prep.notes.some((x) => /day before the month/.test(x)));
  const answered = prepareQif(plan(), file, { today: TODAY, dateOrder: "MDY", accountId: "chk" });
  assert.equal(answered.dateOrder, "MDY"); assert.deepEqual(answered.dateAsk, prep.dateAsk, "still asked: the answer can be changed back");
  assert.deepEqual(answered.add.map((t) => t.date), ["2026-11-01", "2026-11-02", "2026-11-03"]);
  assert.equal(answered.bad.length, 1);
  assert.equal(prepareStatement(plan(), file, { today: TODAY, dateOrder: "MDY" }).dateOrder, "MDY", "prepareStatement passes the answer on");
  // a file that settles it: nothing asked
  assert.equal(prepareQif(plan(), BANK, { today: TODAY }).dateAsk, null);
  assert.deepEqual(prepareQif(plan(), "!Type:Bank\nD10/15/2026\nT-1\n^\nD15/10/2026\nT-2\n^\n", { today: TODAY }).dateAsk, { sample: null, MDY: null, DMY: null });
});

test("QIF amounts: thousands commas, a decimal comma, dots between thousands", () => {
  for (const [s, n] of [["-1,234.56", -1234.56], ["1234.56", 1234.56], ["-1.234,56", -1234.56], ["12,50", 12.5], ["1,234", 1234], ["$12.00", 12], ["+7.5", 7.5], ["-.50", -0.5]]) assert.equal(qifAmount(s), n, s);
  for (const s of ["", "abc", "1,2,3", "12.34.56"]) assert.equal(qifAmount(s), null, s);
  // fix round F3: a first group of 0 is never thousands; the file's own decimal mark reads "1.234" and "1,234"
  assert.equal(qifAmount("0,500"), 0.5); assert.equal(qifAmount("-0,50"), -0.5);
  assert.equal(qifAmount("1.234"), 1.234, "no mark: a decimal point, as before");
  assert.equal(qifAmount("1.234", ","), 1234); assert.equal(qifAmount("-12.345", ","), -12345); assert.equal(qifAmount("1,234", ","), 1.234);
  assert.equal(qifAmount("1.234", "."), 1.234); assert.equal(qifAmount("1,234", "."), 1234); assert.equal(qifAmount("1.234,56", ","), 1234.56);
  assert.equal(qifDecimalMark(["-12,50", "1.234", "300"]), ","); assert.equal(qifDecimalMark(["-12.50", "1,234"]), ".");
  assert.equal(qifDecimalMark(["12,50", "3.10"]), null); assert.equal(qifDecimalMark(["1.234", "300"]), null);
  const eu = parseQif("!Type:Bank\nD15.10.26\nT-1.234\nPMiete\n^\nD16.10.26\nT-12,50\nPBäckerei\n^\nD17.10.26\nT0,500\nPZinsen\n^\n");
  assert.deepEqual(eu.accounts[0].rows.map((r) => r.amount), [-1234, -12.5, 0.5]);
});

test("QIF and CAMT lines for 0.00 are left out and said; a tiny amount is never -0 (fix round F4)", () => {
  const q = parseQif("!Type:Bank\nD1/2/26\nT0.00\nP**VOID**City Power\n^\nD1/3/26\nT-0.004\nPTiny\n^\nD1/4/26\nT-0.006\nPCent\n^\n");
  assert.deepEqual(q.accounts[0].left, [{ row: 1, why: "no money" }, { row: 2, why: "no money" }]);
  assert.deepEqual(q.accounts[0].rows.map((r) => r.payee), ["Cent"]);
  const prep = prepareQif(plan(), "!Type:Bank\nD1/2/26\nT0.00\nPVoid\n^\nD1/3/26\nT-0.004\nPTiny\n^\nD1/4/26\nT-5\nPShop\n^\n", { today: TODAY, accountId: "chk" });
  assert.equal(prep.add.length, 1); assert.ok(prep.add.every((t) => !Object.is(t.amount, -0) && t.amount !== 0));
  assert.ok(prep.notes.includes("2 lines for 0.00 were left out: they move no money."));
  const c = prepareCamt(plan(), camt053({ stmts: [stmt({ entries: [ntry({ amt: "0.00", day: "2026-10-02", ref: "Z1", cdtr: "Bank" }), ntry({ amt: "9.00", day: "2026-10-03", ref: "Z2", cdtr: "Kiosk" })] })] }), { today: TODAY });
  assert.equal(c.add.length, 1); assert.deepEqual(c.notes, ["1 line for 0.00 was left out: it moves no money."]);
  assert.equal(parseCamt(camt053({ stmts: [stmt({ entries: [ntry({ amt: "0.00", day: "2026-10-02", ref: "Z1" })] })] })).accounts[0].zero, 1);
});

test("QIF lines: payee, memo, check number, category, class, transfer, split, opening balance, U for T", () => {
  const q = parseQif(BANK);
  assert.equal(q.ok, true); assert.equal(q.complete, true); assert.equal(q.investment, 0); assert.equal(q.dateOrder, "MDY");
  assert.equal(q.accounts.length, 1);
  const a = q.accounts[0];
  assert.equal(a.kind, "bank"); assert.equal(a.name, "Joint checking"); assert.equal(a.last4, ""); assert.equal(a.balance, null);
  assert.deepEqual(a.left, [{ row: 1, why: "opening balance" }]);
  assert.deepEqual(a.bad, []);
  assert.deepEqual(a.rows.map((r) => [r.date, r.amount, r.payee, r.category]), [
    ["2026-10-03", -54.2, "Kroger", "Groceries"], ["2026-10-05", 2310.55, "Acme Payroll", "Salary"], ["2026-10-07", -1450, "Oakwood Apartments", "Housing:Rent"],
    ["2026-10-09", -500, "Transfer to savings", "[Rainy day savings]"], ["2026-10-12", -62.4, "Target", "--Split--"], ["2026-10-14", -4.5, "CORNER COFFEE #12", "Dining"],
    ["2026-10-20", -35, "Check 1043", ""]]);
  assert.equal(a.rows[2].memo, "October rent"); assert.equal(a.rows[2].number, "1042");
  assert.deepEqual(a.rows[4].splits, [{ category: "Groceries", amount: -40, memo: "Food" }, { category: "Household", amount: -22.4, memo: "" }]);
  assert.equal(qifCategoryName("Auto:Fuel/Trip"), "Auto:Fuel");
  assert.equal(qifCategoryName("[Savings]/Joint"), "[Savings]");
  // no T or U: the split amounts add up to it
  const s = parseQif("!Type:Cash\nD1/2/26\nPMarket\nSGroceries\n$-3.00\nSDining\n$-2.50\n^\n").accounts[0];
  assert.equal(s.kind, "cash"); assert.equal(s.rows[0].amount, -5.5);
  // entities some programs write, an account number after "to" taken out
  const e = parseQif("!Type:Bank\nD1/2/26\nT-9.00\nPAT&amp;T Wireless\nMTransfer to 40281234 done\n^\n").accounts[0].rows[0];
  assert.equal(e.payee, "AT&T Wireless"); assert.equal(e.memo, "Transfer to ... done");
});

test("QIF lines that cannot be read are counted; a file cut inside a record drops that record and says so", () => {
  const q = parseQif("!Type:Bank\nDsoon\nT-1.00\nPA\n^\nD1/2/26\nTabc\nPB\n^\nD1/3/26\nT-2.00\nPC\n^\nD1/4/26\nT-14");
  assert.deepEqual(q.accounts[0].bad, [{ row: 1, why: "no date" }, { row: 2, why: "no amount" }]);
  assert.deepEqual(q.accounts[0].rows.map((r) => r.payee), ["C"]);
  assert.equal(q.complete, false);
  assert.equal(parseQif("!Type:Bank\nD1/3/26\nT-2.00\nPC\n^\n\n\n").complete, true);
});

test("QIF kinds: a bank account named for savings, a card, cash, something you own, a loan; investments said and never read", () => {
  const kinds = (t) => parseQif(t).accounts.map((a) => a.kind);
  assert.deepEqual(kinds("!Account\nNRainy day savings\nTBank\n^\n!Type:Bank\nD1/2/26\nT5.00\n^\n"), ["savings"]);
  assert.deepEqual(kinds("!Type:CCard\nD1/2/26\nT-5.00\n^\n"), ["card"]);
  assert.deepEqual(kinds("!Type:Oth A\nD1/2/26\nT5.00\n^\n!Type:Oth L\nD1/2/26\nT-5.00\n^\n"), ["other asset", "other debt"]);
  const inv = parseQif("!Type:Invst\nD8/25'26\nNBuy\nYIndex Fund\nI101.25\nQ10\nT1,012.50\n^\n");
  assert.equal(inv.ok, false); assert.equal(inv.investment, 1); assert.deepEqual(inv.accounts, []);
  const p = prepareQif(plan(), "!Type:Invst\nD8/25'26\nNBuy\nT1,012.50\n^\n", { today: TODAY });
  assert.equal(p.ok, false); assert.equal(p.kind, "qif"); assert.equal(p.investment, 1); assert.deepEqual(p.add, []); assert.deepEqual(p.notes, []);
  // lists (categories, classes, memorized payees) are passed over
  assert.equal(parseQif("!Type:Cat\nNGroceries\nE\n^\n!Type:Memorized\nKC\nPKroger\nT-50.00\n^\n").ok, false);
});

// 2. a whole Quicken file: the AutoSwitch account list, then each account with its lines, an investment account among them
const FULL = `!Option:AutoSwitch
!Account
NJoint checking
TBank
^
NVisa card
TCCard
^
NBrokerage
TInvst
^
!Clear:AutoSwitch
!Account
NJoint checking
TBank
^
!Type:Bank
D11/02'26
T-12.00
PCorner Coffee
LDining
^
!Account
NVisa card
TCCard
^
!Type:CCard
D11/03'26
T-45.00
PCity Hardware
^
D11/04'26
T200.00
PPayment, thank you
L[Joint checking]
^
!Account
NBrokerage
TInvst
^
!Type:Invst
D11/05'26
NBuy
T500.00
^
`;
test("QIF with several accounts: each named by its !Account block, the account list passed over, the investment account left out and said", () => {
  const q = parseQif(FULL);
  assert.deepEqual(q.accounts.map((a) => [a.kind, a.name, a.rows.length]), [["bank", "Joint checking", 1], ["card", "Visa card", 2]]);
  assert.equal(q.investment, 1);
  const p = plan();
  const first = prepareQif(p, FULL, { today: TODAY });
  assert.equal(first.which, 0); assert.equal(first.accountId, "chk"); assert.equal(first.guess.why, "same");
  assert.deepEqual(first.fileAccounts.map((a) => a.label), ["Joint checking", "Visa card"]);
  assert.ok(first.notes.includes("This file also holds an investment account, which is left out: bring in what you hold on the Holdings page."));
  importInto(p, first);
  const second = prepareQif(p, FULL, { today: TODAY });
  assert.equal(second.which, 1, "the next account with lines not on file"); assert.equal(second.accountId, "visa"); assert.equal(second.guess.why, "same");
  assert.deepEqual(second.add.map((t) => [t.payee, t.amount, t.category]), [["City Hardware", -45, ""], ["Payment, thank you", 200, "transfer"]]);
});

test("QIF into Import: the account by its name, Quicken's categories by the plan's own names, transfers, splits, the note, the payee", () => {
  const p = plan();
  const prep = prepareQif(p, BANK, { today: TODAY });
  assert.equal(prep.kind, "qif"); assert.equal(prep.ok, true); assert.equal(prep.complete, true);
  assert.equal(prep.accountId, "chk"); assert.equal(prep.guess.why, "same");
  assert.equal(prep.balance, null, "a QIF file holds no bank balance");
  assert.equal(prep.currency, null);
  assert.deepEqual(prep.add.map((t) => [t.date, t.amount, t.payee, t.category, t.note]), [
    ["2026-10-03", -54.2, "Kroger", "groceries", ""],
    ["2026-10-05", 2310.55, "Acme Payroll", "", ""],                       // "Salary" is not a name on the plan's list: Categorize
    ["2026-10-07", -1450, "Oakwood Apartments", "housing", "October rent; Check 1042"],
    ["2026-10-09", -500, "Transfer to savings", "transfer", ""],
    ["2026-10-12", -62.4, "Target", "", "Split: Groceries -40.00; Household -22.40"],
    ["2026-10-14", -4.5, "Corner Coffee", "dining", ""],                   // capitals through prettyPayee, the class dropped
    ["2026-10-20", -35, "Check 1043", "", ""]]);
  assert.equal(prep.add[5].rawPayee, "CORNER COFFEE #12");
  assert.ok(prep.add.every((t) => !t.extId && t.splits === undefined));
  assert.equal(prep.fileFrom, "2026-10-03"); assert.equal(prep.fileTo, "2026-10-20");
  assert.deepEqual(prep.notes, [
    "1 opening balance was left out: Quicken's starting figure for the account, not money in or out.",
    "3 of the 7 lines kept their Quicken category.",
    "1 line is a transfer between your accounts, so it counts as neither spending nor income.",
    "1 line split across categories in Quicken comes in as one line, with its parts."]);
  // the same file twice adds nothing (duplicates by the key, as a count: QIF has no bank id)
  importInto(p, prep, { fileName: "Joint checking.qif" });
  assert.equal(prepareQif(p, BANK, { today: TODAY }).add.length, 0);
  assert.equal(prepareImport(p, BANK, { accountId: "chk" }).add.length, 0, "prepareImport sends a QIF file the same way");
  assert.equal(prepareImport(p, BANK, { accountId: "chk" }).kind, "qif");
});

test("QIF splits: kept as splits when every part has one of the plan's categories, two or more, adding up", () => {
  const t = "!Type:Bank\nD10/12'26\nT-62.40\nPTarget\nL--Split--\nSGroceries\n$-40.00\nSDining\n$-22.40\n^\nD10/13'26\nT-10.00\nPMarket\nSGroceries\n$-6.00\nSGroceries\n$-4.00\n^\nD10/14'26\nT-10.00\nPOdd\nSGroceries\n$-6.00\nSDining\n$-5.00\n^\n";
  const prep = prepareQif(plan(), t, { accountId: "chk", today: TODAY });
  const [a, b, c] = prep.add;
  assert.deepEqual(a.splits, [{ category: "groceries", amount: -40 }, { category: "dining", amount: -22.4 }]); assert.equal(a.category, "groceries"); assert.equal(a.note, "");
  assert.equal(b.splits, undefined); assert.equal(b.category, "groceries"); assert.equal(b.note, "Split: Groceries -6.00; Groceries -4.00");
  assert.equal(c.splits, undefined, "parts that do not add up are only noted"); assert.equal(c.category, ""); assert.equal(c.note, "Split: Groceries -6.00; Dining -5.00");
  assert.ok(prep.notes.includes("3 lines split across categories in Quicken come in as one line each, with their parts."));
  assert.equal(prepareQif(plan(), "!Type:Bank\nD10/12'26\nT-9.00\nPA\nS[Rainy day savings]\n$-5.00\nSFees\n$-4.00\n^\n", { accountId: "chk" }).add[0].note, "Split: Rainy day savings (transfer) -5.00; Fees -4.00");
});

test("qifCategory: a transfer, the whole name, its last part, its first part, the plan's own names only", () => {
  const p = plan();
  for (const [n, id] of [["[Savings]", "transfer"], ["Groceries", "groceries"], ["Housing:Rent", "housing"], ["Utilities:Electric", "utilities"], ["Medical", "health"], ["Gifts", "giving"],
    ["Dining", "dining"], ["Transfer", "transfer"], ["Salary", ""], ["Auto:Fuel", ""], ["--Split--", ""], ["", ""]]) assert.equal(qifCategory(p, n), id, n);
  assert.equal(qifCategory(p, "Interest", { moneyIn: true }), "income-investment");
  // a category the person added to the plan is found by its name too
  const q = migrate({ ...plan(), categories: [{ id: "coffee", label: "Coffee Shops", kind: "expense" }] });
  assert.equal(qifCategory(q, "Food:Coffee Shops"), "coffee");
});

test("QIF account: by the same name, else the only one of its kind, else asked; a bank file never on a card or a home", () => {
  const one = "!Type:Bank\nD10/3'26\nT-5.00\nPA\n^\n";
  const p = plan();
  const g1 = prepareQif(p, one, { today: TODAY });
  assert.equal(g1.accountId, null, "QIF's Bank may be checking or savings: with one of each, it asks");
  assert.deepEqual(g1.guess.options, ["chk", "sav"]);
  const onlyChk = migrate({ ...emptyPlan(), accounts: [{ id: "chk", name: "Joint checking", type: "checking", balance: 0 }, { id: "home", name: "Our home", type: "property", balance: 9 }] });
  const g2 = prepareQif(onlyChk, one, { today: TODAY });
  assert.equal(g2.accountId, "chk"); assert.equal(g2.guess.why, "kind");
  assert.equal(prepareQif(p, one, { accountId: "visa", today: TODAY }).mismatch.accountId, "visa");
  assert.equal(prepareQif(p, "!Type:CCard\nD10/3'26\nT-5.00\nPA\n^\n", { today: TODAY }).accountId, "visa");
  assert.equal(guessOfxAccount(p, { kind: "bank", name: "Rainy Day Savings (...7713)", rows: [] }).accountId, "sav", "the name, case and a masked number aside");
  assert.equal(guessOfxAccount(p, { kind: "checking", rows: [] }).why, "kind", "a file account with no name: as before");
  const noDebt = prepareQif(p, "!Type:Oth L\nD10/3'26\nT-5.00\nPA\n^\n", { today: TODAY });
  assert.equal(noDebt.accountId, null); assert.deepEqual(noDebt.guess.options, []);
});

test("QIF characters: UTF-8 when the bytes are UTF-8, else windows-1252 (Quicken for Windows)", () => {
  const text = "!Type:Bank\nD10/3'26\nT-5.00\nPCafé Olé’s\n^\n";
  assert.equal(decodeFile(new TextEncoder().encode(text)), text);
  const cp = Uint8Array.from([...text].map((c) => (c === "’" ? 0x92 : c.charCodeAt(0))));
  assert.equal(decodeFile(cp), text);
  assert.equal(parseQif(decodeFile(cp.buffer)).accounts[0].rows[0].payee, "Café Olé’s");
});

// ---------------------------------------------------------------- CAMT.053
const ntry = ({ amt, ind = "DBIT", day, ref = null, nref = null, sts = "BOOK", dtTm = false, cdtr = null, dbtr = null, ustrd = [], addtl = null, txs = null, ccy = "EUR", v8 = false }) => {
  const party = (side, nm) => (nm ? (v8 ? `<${side}><Pty><Nm>${nm}</Nm></Pty></${side}>` : `<${side}><Nm>${nm}</Nm></${side}>`) : "");
  const tx = (t) => `<TxDtls><Refs><EndToEndId>NOTPROVIDED</EndToEndId></Refs>${v8 ? `<Amt Ccy="${ccy}">${t.amt}</Amt><CdtDbtInd>${t.ind ?? ind}</CdtDbtInd>` : `<AmtDtls><TxAmt><Amt Ccy="${ccy}">${t.amt}</Amt></TxAmt></AmtDtls>`}<RltdPties>${party("Dbtr", t.dbtr)}${party("Cdtr", t.cdtr)}<CdtrAcct><Id><IBAN>${OTHER}</IBAN></Id></CdtrAcct></RltdPties>${(t.ustrd ?? []).length ? `<RmtInf>${t.ustrd.map((u) => `<Ustrd>${u}</Ustrd>`).join("")}</RmtInf>` : ""}</TxDtls>`;
  const dt = (d) => (dtTm ? `<DtTm>${d}T09:30:00+01:00</DtTm>` : `<Dt>${d}</Dt>`);
  return `<Ntry>${nref ? `<NtryRef>${nref}</NtryRef>` : ""}<Amt Ccy="${ccy}">${amt}</Amt><CdtDbtInd>${ind}</CdtDbtInd>${v8 ? `<Sts><Cd>${sts}</Cd></Sts>` : `<Sts>${sts}</Sts>`}<BookgDt>${dt(day)}</BookgDt><ValDt><Dt>${day}</Dt></ValDt>${ref ? `<AcctSvcrRef>${ref}</AcctSvcrRef>` : ""}<BkTxCd><Prtry><Cd>NMSC+201</Cd><Issr>DK</Issr></Prtry></BkTxCd>`
    + `${txs ? `<NtryDtls>${txs.map(tx).join("")}</NtryDtls>` : cdtr || dbtr || ustrd.length ? `<NtryDtls>${tx({ amt, ind, cdtr, dbtr, ustrd })}</NtryDtls>` : ""}${addtl ? `<AddtlNtryInf>${addtl}</AddtlNtryInf>` : ""}</Ntry>`;
};
const bal = (cd, amt, day, ind = "CRDT", ccy = "EUR") => `<Bal><Tp><CdOrPrtry><Cd>${cd}</Cd></CdOrPrtry></Tp><Amt Ccy="${ccy}">${amt}</Amt><CdtDbtInd>${ind}</CdtDbtInd><Dt><Dt>${day}</Dt></Dt></Bal>`;
const stmt = ({ iban = IBAN1, tp = null, ccy = "EUR", bank = "Lindenbank", from = "2026-10-01", to = "2026-10-31", bals = "", entries = [] }) =>
  `<Stmt><Id>STMT-${from}</Id><CreDtTm>${to}T23:00:00</CreDtTm><FrToDt><FrDtTm>${from}T00:00:00</FrDtTm><ToDtTm>${to}T23:59:59</ToDtTm></FrToDt>`
  + `<Acct><Id><IBAN>${iban}</IBAN></Id>${tp ? `<Tp><Cd>${tp}</Cd></Tp>` : ""}<Ccy>${ccy}</Ccy><Ownr><Nm>Invented Holder</Nm></Ownr><Svcr><FinInstnId><BIC>LINDDEXX</BIC><Nm>${bank}</Nm></FinInstnId></Svcr></Acct>${bals}${entries.join("\n")}</Stmt>`;
const OCT = [
  ntry({ amt: "54.20", day: "2026-10-02", ref: "LB-1001", cdtr: "Markthalle Lindenau", ustrd: ["Kartenzahlung 01.10."] }),
  ntry({ amt: "2310.55", ind: "CRDT", day: "2026-10-05", ref: "LB-1002", dbtr: "Acme Werkzeug GmbH", ustrd: ["Gehalt Oktober"] }),
  ntry({ amt: "950.00", day: "2026-10-06", ref: "LB-1003", dtTm: true, cdtr: "Hausverwaltung Ost &amp; Partner", ustrd: ["Miete Oktober", `IBAN ${OTHER}`] }),
  ntry({ amt: "12.00", day: "2026-10-31", ref: "LB-1004", sts: "PDNG", cdtr: "Kiosk" }),
  ntry({ amt: "75.00", day: "2026-10-15", ref: "LB-1005", addtl: "SAMMEL-LASTSCHRIFT", txs: [{ amt: "40.00", cdtr: "Stadtwerke Lindenau" }, { amt: "17.50", cdtr: "Radio Abo" }, { amt: "17.50", cdtr: "Sportverein Lindenau" }] }),
  ntry({ amt: "4.50", day: "2026-10-20", nref: "7", addtl: "KARTENZAHLUNG BAECKEREI KORN" }),
];
function camt053({ stmts = [stmt({ bals: bal("OPBD", "1500.00", "2026-10-01") + bal("CLBD", "2726.85", "2026-10-31"), entries: OCT })], ns = "camt.053.001.02", root = "BkToCstmrStmt" } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- an invented statement for the tests -->
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:${ns}" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <${root}>
    <GrpHdr><MsgId>MSG-1</MsgId><CreDtTm>2026-11-01T06:00:00</CreDtTm></GrpHdr>
    ${stmts.join("\n")}
  </${root}>
</Document>
`;
}

test("CAMT: known by its message or its namespace; never a CSV, an OFX or a QIF file", () => {
  assert.equal(isCamt(camt053()), true);
  assert.equal(isCamt(camt053({ ns: "camt.052.001.02", root: "BkToCstmrAcctRpt" })), true);
  assert.equal(isCamt(`<?xml version="1.0"?><n:Document xmlns:n="urn:iso:std:iso:20022:tech:xsd:camt.054.001.02"><n:BkToCstmrDbtCdtNtfctn>`), true);
  assert.equal(isCamt("<Document><BkToCstmrStmt>"), true);
  assert.equal(isCamt("Date,Description,Amount\n1/2/26,BkToCstmrStmt,1\n"), false);
  assert.equal(isCamt(`<?xml version="1.0"?><OFX><SIGNONMSGSRSV1>`), false);
  assert.equal(isCamt(BANK), false);
  assert.equal(isOfx(camt053()), false);
  assert.equal(isStatement(camt053()), true);
});

test("the XML reader: prefixes and namespaces dropped, entities, CDATA, comments, empty elements, a file cut short", () => {
  const x = readXml(`<?xml version="1.0"?><!-- c --><ns2:A xmlns:ns2="urn:x" ns2:k="v &amp; w"><ns2:B>one &lt;two&gt; &#38; &#x41;</ns2:B><C/><D><![CDATA[Rechnung <42> & Co]]></D></ns2:A>`);
  assert.equal(x.complete, true);
  const a = x.root.kids[0];
  assert.equal(a.name, "A"); assert.equal(a.attrs.k, "v & w");
  assert.deepEqual(a.kids.map((k) => k.name), ["B", "C", "D"]);
  assert.equal(a.kids[0].text, "one &lt;two&gt; &#38; &#x41;");
  assert.equal(a.kids[1].closed, true);
  const cut = readXml("<A><B>1</B><C>2");
  assert.equal(cut.complete, false); assert.equal(cut.root.kids[0].kids[0].closed, true); assert.equal(cut.root.kids[0].kids[1].closed, false);
  const p = parseCamt(camt053({ stmts: [stmt({ entries: [ntry({ amt: "9.00", day: "2026-10-02", cdtr: "Druckerei", ustrd: ["<![CDATA[Rechnung <42> & Co]]>"] })] })] }));
  assert.equal(p.accounts[0].rows[0].note, "Rechnung <42> & Co");
});

test("CAMT entries: money in and out, booking day (date or date-time), value day, the other party, the words, a batch, not booked yet left out", () => {
  const c = parseCamt(camt053());
  assert.equal(c.ok, true); assert.equal(c.complete, true); assert.equal(c.version, "053"); assert.equal(c.org, "Lindenbank"); assert.equal(c.investment, false);
  assert.equal(c.accounts.length, 1);
  const a = c.accounts[0];
  assert.equal(a.kind, "checking"); assert.equal(a.last4, "4821"); assert.equal(a.currency, "EUR");
  assert.equal(a.balance, 2726.85); assert.equal(a.balanceDate, "2026-10-31");
  assert.equal(a.from, "2026-10-01"); assert.equal(a.to, "2026-10-31");
  assert.equal(a.pending, 1);
  assert.deepEqual(a.bad, []);
  assert.deepEqual(a.rows.map((r) => [r.date, r.amount, r.payee, r.named, r.parts]), [
    ["2026-10-02", -54.2, "Markthalle Lindenau", true, 1], ["2026-10-05", 2310.55, "Acme Werkzeug GmbH", true, 1], ["2026-10-06", -950, "Hausverwaltung Ost & Partner", true, 1],
    ["2026-10-15", -75, "SAMMEL-LASTSCHRIFT", false, 3], ["2026-10-20", -4.5, "KARTENZAHLUNG BAECKEREI KORN", false, 1]]);
  assert.equal(a.rows[0].note, "Kartenzahlung 01.10.");
  assert.equal(a.rows[2].note, "Miete Oktober IBAN ...", "the other party's account number is taken out of the words");
  assert.equal(a.rows[3].note, "3 payments: Stadtwerke Lindenau 40.00, Radio Abo 17.50, Sportverein Lindenau 17.50.");
  assert.equal(a.rows[4].note, "");
  // the bank's reference with the booking day: the same reference on another day is another line
  assert.ok(a.rows.every((r) => r.fitid && !String(r.fitid).includes("LB")));
  assert.equal(parseCamt(camt053()).accounts[0].rows[0].fitid, a.rows[0].fitid, "the same file gives the same ids");
  const moved = parseCamt(camt053().replace("<BookgDt><Dt>2026-10-02</Dt>", "<BookgDt><Dt>2026-10-03</Dt>"));
  assert.notEqual(moved.accounts[0].rows[0].fitid, a.rows[0].fitid);
  // no booking day: the value day; no amount, no direction, no day at all: counted, never guessed
  const odd = parseCamt(camt053({ stmts: [stmt({ entries: [
    ntry({ amt: "5.00", day: "2026-10-02" }).replace(/<BookgDt>.*?<\/BookgDt>/, ""),
    ntry({ amt: "-5.00", day: "2026-10-02" }), ntry({ amt: "5.00", day: "2026-10-02" }).replace("<CdtDbtInd>DBIT</CdtDbtInd>", ""),
    ntry({ amt: "5.00", day: "2026-10-02" }).replace(/<BookgDt>.*?<\/ValDt>/, "")] })] }));
  assert.deepEqual(odd.accounts[0].rows.map((r) => r.date), ["2026-10-02"]);
  assert.deepEqual(odd.accounts[0].bad, [{ row: 2, why: "no amount" }, { row: 3, why: "no amount" }, { row: 4, why: "no date" }]);
});

test("CAMT newer versions: a prefix on every element, Sts as a code, the party under Pty, the amount on each part, a savings account", () => {
  const v8 = camt053({ ns: "camt.053.001.08", stmts: [stmt({ iban: IBAN2, tp: "SVGS", bals: bal("CLBD", "5103.25", "2026-10-31"), entries: [
    ntry({ v8: true, amt: "3.25", ind: "CRDT", day: "2026-10-31", ref: "SV-1", dbtr: "Lindenbank", ustrd: ["Zinsen"] }),
    ntry({ v8: true, amt: "100.00", ind: "CRDT", day: "2026-10-28", ref: "SV-2", sts: "INFO", dbtr: "Someone" }),
    ntry({ v8: true, amt: "30.00", day: "2026-10-20", ref: "SV-3", txs: [{ amt: "20.00", cdtr: "Tierheim" }, { amt: "10.00", cdtr: "Tierheim" }] })] })] })
    .replace(/<(\/?)([A-Z])/g, "<$1c:$2").replace('xmlns="urn', 'xmlns:c="urn');
  const c = parseCamt(v8);
  assert.equal(c.complete, true);
  const a = c.accounts[0];
  assert.equal(a.kind, "savings"); assert.equal(a.last4, "7713"); assert.equal(a.balance, 5103.25); assert.equal(a.pending, 1);
  assert.deepEqual(a.rows.map((r) => [r.date, r.amount, r.payee, r.note]), [["2026-10-31", 3.25, "Lindenbank", "Zinsen"], ["2026-10-20", -30, "Tierheim", "2 payments: Tierheim 20.00, Tierheim 10.00."]]);
  const prep = prepareCamt(plan(), v8, { today: TODAY });
  assert.equal(prep.accountId, "sav"); assert.equal(prep.guess.why, "kind");
  assert.deepEqual(prep.notes, ["1 line your bank has not booked yet was left out: it comes in with a later file.", "1 bank line holds several payments; it comes in as one line, with each payment in its note."]);
});

test("CAMT with several statements: one account's daily statements are one account (its days, its latest balance); two accounts are two", () => {
  const d1 = stmt({ from: "2026-10-01", to: "2026-10-01", bals: bal("CLBD", "1445.80", "2026-10-01"), entries: [ntry({ amt: "54.20", day: "2026-10-01", ref: "D1", cdtr: "Markthalle Lindenau" })] });
  const d2 = stmt({ from: "2026-10-02", to: "2026-10-02", bals: bal("CLBD", "1440.80", "2026-10-02"), entries: [ntry({ amt: "5.00", day: "2026-10-02", nref: "1", cdtr: "Kiosk" })] });
  const d3 = stmt({ from: "2026-10-03", to: "2026-10-03", bals: bal("CLBD", "1435.80", "2026-10-03"), entries: [ntry({ amt: "5.00", day: "2026-10-03", nref: "1", cdtr: "Kiosk" })] });
  const c = parseCamt(camt053({ stmts: [d1, d3, d2] }));
  assert.equal(c.accounts.length, 1);
  const a = c.accounts[0];
  assert.equal(a.from, "2026-10-01"); assert.equal(a.to, "2026-10-03"); assert.equal(a.balance, 1435.8); assert.equal(a.balanceDate, "2026-10-03");
  assert.equal(a.rows.length, 3);
  // the running number "1" on two days: two lines, both come in
  const prep = prepareCamt(plan(), camt053({ stmts: [d1, d3, d2] }), { accountId: "chk", today: TODAY });
  assert.equal(prep.add.length, 3);
  const two = parseCamt(camt053({ stmts: [d1, stmt({ iban: IBAN2, tp: "SVGS", entries: [ntry({ amt: "1.00", ind: "CRDT", day: "2026-10-01", ref: "S1" })] })] }));
  assert.deepEqual(two.accounts.map((x) => [x.kind, x.last4]), [["checking", "4821"], ["savings", "7713"]]);
  assert.deepEqual(prepareCamt(plan(), camt053({ stmts: [d1, stmt({ iban: IBAN2, tp: "SVGS", entries: [] })] }), { today: TODAY }).fileAccounts.map((x) => x.label), ["Checking ending 4821", "Savings ending 7713"]);
});

test("CAMT into Import: the account, the payee, the note, the balance offered, the currency kept and said, duplicates by the bank's reference", () => {
  const p = eurPlan();
  const text = camt053();
  const prep = prepareCamt(p, text, { today: TODAY });
  assert.equal(prep.kind, "camt"); assert.equal(prep.version, "053"); assert.equal(prep.org, "Lindenbank");
  assert.equal(prep.accountId, "chk"); assert.equal(prep.guess.why, "kind");
  assert.equal(prep.currency, "EUR");
  assert.deepEqual(prep.add.map((t) => [t.date, t.amount, t.payee, t.rawPayee, t.note]), [
    ["2026-10-02", -54.2, "Markthalle Lindenau", "Markthalle Lindenau", "Kartenzahlung 01.10."],
    ["2026-10-05", 2310.55, "Acme Werkzeug GmbH", "Acme Werkzeug GmbH", "Gehalt Oktober"],
    ["2026-10-06", -950, "Hausverwaltung Ost & Partner", "Hausverwaltung Ost & Partner", "Miete Oktober IBAN ..."],
    ["2026-10-15", -75, "Sammel Lastschrift", "SAMMEL-LASTSCHRIFT", "3 payments: Stadtwerke Lindenau 40.00, Radio Abo 17.50, Sportverein Lindenau 17.50."],
    ["2026-10-20", -4.5, prep.add[4].payee, "KARTENZAHLUNG BAECKEREI KORN", ""]]);
  assert.ok(prep.add.every((t) => t.extId && t.category === ""));
  assert.equal(prep.fileFrom, "2026-10-01"); assert.equal(prep.fileTo, "2026-10-31");
  assert.deepEqual(prep.notes, ["1 line your bank has not booked yet was left out: it comes in with a later file.", "1 bank line holds several payments; it comes in as one line, with each payment in its note."]);
  // the bank's closing balance, as an OFX file's: "kind" is not sure enough to tick it for you
  assert.deepEqual(prep.balance, { accountId: "chk", amount: 2726.85, date: "2026-10-31", was: 2000, wasAsOf: "2026-09-30", debt: false, lump: false, tick: false });
  // a plan that counts in dollars: the lines come in as they are, the euro balance is never offered (fix round P1, F6)
  const usd = prepareCamt(plan(), text, { today: TODAY });
  assert.equal(usd.currency, "EUR"); assert.equal(usd.balance, null); assert.equal(usd.add.length, 5); assert.equal(usd.fileAccounts[0].hasBalance, true);
  assert.equal(otherCurrency(plan(), "EUR"), true); assert.equal(otherCurrency(plan(), "usd"), false); assert.equal(otherCurrency(plan(), null), false); assert.equal(otherCurrency(eurPlan(), "EUR"), false);
  assert.equal(balanceOffer(plan(), "chk", { ...parseCamt(text).accounts[0], kind: "checking" }, { today: TODAY }), null);
  // imported with the balance: the currency on the record, no account number anywhere, the file name masked
  importInto(p, prep, { fileName: `camt053_${IBAN1}_20261031.xml`, balance: true });
  const json = JSON.stringify(p);
  for (const s of [IBAN1, IBAN1.slice(-4), OTHER, OTHER.slice(-4), "LB-100", "Invented Holder"]) assert.ok(!json.includes(s), s);
  assert.equal(p.imports[0].currency, "EUR");
  assert.equal(p.imports[0].fileName, "camt053_DEXXXX_XXXX.xml");
  assert.equal(p.accounts.find((a) => a.id === "chk").balance, 2726.85);
  // the same file again: nothing new, and the reference matches even when the words changed
  assert.equal(prepareCamt(p, text, { today: TODAY }).add.length, 0);
  assert.equal(prepareCamt(p, text.replace("Markthalle Lindenau", "Markthalle Lindenau eG"), { today: TODAY }).add.length, 0);
  assert.equal(prepareImport(p, text, { accountId: "chk" }).add.length, 0, "prepareImport sends a CAMT file the same way");
  assert.equal(prepareStatement(p, text, { accountId: "chk" }).kind, "camt");
  assert.equal(prepareStatement(p, "Date,Amount\n1/2/26,1\n"), null);
});

test("CAMT: two entries of one statement with the same reference, day and amount are two lines; the file again adds none (fix round F5)", () => {
  const twins = [ntry({ amt: "7.00", day: "2026-11-06", ref: "R1", cdtr: "Kiosk" }), ntry({ amt: "7.00", day: "2026-11-06", ref: "R1", cdtr: "Kiosk" }), ntry({ amt: "7.00", day: "2026-11-06", ref: "R1", cdtr: "Kiosk" })];
  const text = camt053({ stmts: [stmt({ from: "2026-11-01", to: "2026-11-10", entries: [ntry({ amt: "50.25", day: "2026-11-02", ref: "R1", cdtr: "Markthalle" }), ...twins] })] });
  const rows = parseCamt(text).accounts[0].rows;
  assert.equal(new Set(rows.map((r) => r.fitid)).size, 4, "each its own id");
  const p = plan();
  const prep = prepareCamt(p, text, { today: TODAY });
  assert.equal(prep.add.length, 4);
  importInto(p, prep);
  assert.equal(prepareCamt(p, text, { today: TODAY }).add.length, 0);
  // the same entry in two statements of one file (a day's report, then the statement) is still one line
  const twice = camt053({ stmts: [stmt({ from: "2026-11-06", to: "2026-11-06", entries: [twins[0]] }), stmt({ from: "2026-11-06", to: "2026-11-07", entries: [twins[0]] })] });
  assert.equal(prepareCamt(plan(), twice, { today: TODAY }).add.length, 1);
});

test("CAMT: a file cut short drops the entry it stops in, says so, and ticks no balance; a report (camt.052) reads the same", () => {
  const whole = camt053();
  const cut = whole.slice(0, whole.indexOf("KARTENZAHLUNG BAECKEREI") + 8);
  const c = parseCamt(cut);
  assert.equal(c.complete, false);
  assert.equal(c.accounts[0].rows.length, 4, "the last entry, never closed, is left out");
  const prep = prepareCamt(plan(), cut, { today: TODAY });
  assert.equal(prep.complete, false); assert.equal(prep.add.length, 4);
  // cut inside the closing balance: no balance (its figure may stop in the middle: "27" of "2726.85")
  const inBal = whole.slice(0, whole.indexOf("2726.85") + 2);
  assert.equal(parseCamt(inBal).accounts[0].balance, null);
  assert.equal(prepareCamt(plan(), inBal, { today: TODAY }).balance, null);
  const rpt = camt053({ ns: "camt.052.001.02", root: "BkToCstmrAcctRpt" }).replace(/<(\/?)Stmt>/g, "<$1Rpt>");
  const r = parseCamt(rpt);
  assert.equal(r.version, "052"); assert.equal(r.accounts[0].rows.length, 5); assert.equal(r.accounts[0].pending, 1);
});

test("CAMT characters: the XML declaration's encoding (ISO-8859-1 read as browsers do), UTF-8 by default", () => {
  const t = camt053({ stmts: [stmt({ entries: [ntry({ amt: "9.00", day: "2026-10-02", cdtr: "Bäckerei Müller", ustrd: ["Brötchen €"] })] })] });
  assert.equal(parseCamt(decodeFile(new TextEncoder().encode(t))).accounts[0].rows[0].payee, "Bäckerei Müller");
  const latin = t.replace('encoding="UTF-8"', 'encoding="ISO-8859-1"');
  const bytes = Uint8Array.from([...latin].map((ch) => (ch === "€" ? 0x80 : ch.charCodeAt(0))));
  const row = parseCamt(decodeFile(bytes)).accounts[0].rows[0];
  assert.equal(row.payee, "Bäckerei Müller"); assert.equal(row.note, "Brötchen €");
});

// ---------------------------------------------------------------- the sentences, one per case
test("every sentence the page can show for a QIF or CAMT file", () => {
  assert.deepEqual(qifNotes({}), []);
  assert.deepEqual(qifNotes({ left: 1 }), ["1 opening balance was left out: Quicken's starting figure for the account, not money in or out."]);
  assert.deepEqual(qifNotes({ left: 3 }), ["3 opening balances were left out: Quicken's starting figures, not money in or out."]);
  assert.deepEqual(qifNotes({ added: 1, kept: 1 }), ["The line kept its Quicken category."]);
  assert.deepEqual(qifNotes({ added: 12, kept: 12 }), ["All 12 lines kept their Quicken category."]);
  assert.deepEqual(qifNotes({ added: 12, kept: 1 }), ["1 of the 12 lines kept its Quicken category."]);
  assert.deepEqual(qifNotes({ added: 12, kept: 5 }), ["5 of the 12 lines kept their Quicken category."]);
  assert.deepEqual(qifNotes({ added: 12, kept: 0 }), []);
  assert.deepEqual(qifNotes({ transfers: 1 }), ["1 line is a transfer between your accounts, so it counts as neither spending nor income."]);
  assert.deepEqual(qifNotes({ transfers: 4 }), ["4 lines are transfers between your accounts, so they count as neither spending nor income."]);
  assert.deepEqual(qifNotes({ splits: 1 }), ["1 line split across categories in Quicken comes in as one line, with its parts."]);
  assert.deepEqual(qifNotes({ splits: 2 }), ["2 lines split across categories in Quicken come in as one line each, with their parts."]);
  assert.deepEqual(qifNotes({ dayFirst: true }), ["This file writes the day before the month, and its dates are read that way."]);
  assert.deepEqual(qifNotes({ investment: 1 }), ["This file also holds an investment account, which is left out: bring in what you hold on the Holdings page."]);
  assert.deepEqual(qifNotes({ investment: 2 }), ["This file also holds 2 investment accounts, which are left out: bring in what you hold on the Holdings page."]);
  assert.deepEqual(camtNotes({}), []);
  assert.deepEqual(camtNotes({ pending: 1 }), ["1 line your bank has not booked yet was left out: it comes in with a later file."]);
  assert.deepEqual(camtNotes({ pending: 2 }), ["2 lines your bank has not booked yet were left out: they come in with a later file."]);
  assert.deepEqual(camtNotes({ batches: 1 }), ["1 bank line holds several payments; it comes in as one line, with each payment in its note."]);
  assert.deepEqual(camtNotes({ batches: 2 }), ["2 bank lines hold several payments each; each comes in as one line, with the payments in its note."]);
  assert.deepEqual(camtNotes({ zero: 1 }), ["1 line for 0.00 was left out: it moves no money."]);
  assert.deepEqual(camtNotes({ zero: 3 }), ["3 lines for 0.00 were left out: they move no money."]);
  assert.deepEqual(qifNotes({ zero: 1 }), ["1 line for 0.00 was left out: it moves no money."]);
  assert.deepEqual(qifNotes({ zero: 2 }), ["2 lines for 0.00 were left out: they move no money."]);
  assert.equal(shownName("Dr. Lee Dental"), "Dr. Lee Dental"); assert.equal(shownName("KROGER #412"), ""); assert.equal(shownName(""), "");
  // a day-first file says so
  assert.ok(prepareQif(plan(), "!Type:CCard\nD15/10/2026\nT-23.10\nPTesco\n^\n", { today: TODAY }).notes.includes("This file writes the day before the month, and its dates are read that way."));
});

// ---------------------------------------------------------------- on the page (a stand-in DOM, qa/fixtures/fake-dom.mjs)
test("on the page: the words name the new files, a pasted QIF and a pasted CAMT file get the Quicken preview, and Import brings their lines in", async () => {
  const { FakeElement, textOf } = await import("../qa/fixtures/fake-dom.mjs");
  const ui = await import("../core/ui/dom.js");
  const fmtM = await import("../core/format.js");
  const { render } = await import("../modules/transactions/import/view.js");
  globalThis.requestAnimationFrame ??= (f) => setTimeout(f, 0);
  const draw = (p) => {
    const root = new FakeElement("div"), saved = [];
    const ctx = { ui, fmt: { ...fmtM, today: () => TODAY }, plan: p, route: { group: "transactions", id: "import", rest: [], query: {} }, view: {}, go: () => {},
      store: { get: () => p, update: (fn) => { const d = structuredClone(p); fn(d); saved.push(d); } } };
    render(root, ctx);
    const all = () => root.all();
    const button = (t) => all().find((e) => e.tagName === "BUTTON" && e.textContent === t);
    return { root, saved, all, button, text: () => textOf(root), paste(t) { all().find((e) => e.tagName === "TEXTAREA").value = t; button("Use the pasted text").click(); } };
  };
  const s = draw(plan());
  assert.match(s.text(), /Otherwise take CSV\. Files from older Quicken \(\.qif\), European banks \(\.xml\), YNAB, Monarch or Mint work too\./);
  assert.ok(!/CAMT/.test(s.text()), "no format name a bank's download page does not show (fix round P2)");
  const input = s.all().find((e) => e.tagName === "INPUT" && e.getAttribute("type") === "file");
  for (const k of [".qif", ".xml", ".qfx", ".csv"]) assert.ok(input.getAttribute("accept").split(",").includes(k), k);
  s.paste(BANK);
  const t = s.text();
  assert.match(t, /Joint checking: 7 transactions, .+\. Nothing to set up; the account number is not kept\./);
  assert.match(t, /This goes to Joint checking, the account with the same name\./);
  assert.match(t, /3 of the 7 lines kept their Quicken category\./);
  assert.match(t, /4 Filed for you 3 will need a category/);
  // a check number shows under its row (fix round P4); a file that settles its dates asks nothing
  assert.match(t, /10\/7\/2026 · bank wrote: Oakwood Apartments · October rent; Check 1042/);
  assert.ok(!/In this file, is/.test(t));
  assert.ok(!/Columns worked out|Date column/.test(t), "no column step");
  const filled = s.all().filter((e) => e.tagName === "BUTTON" && !e.classList.contains("secondary") && !e.classList.contains("chip"));
  assert.deepEqual(filled.map((e) => e.textContent), ["Import 7 transactions"]);
  s.button("Import 7 transactions").click();
  assert.equal(s.saved.length, 1);
  const got = s.saved[0];
  assert.equal(got.transactions.length, 7); assert.ok(got.transactions.every((x) => x.accountId === "chk"));
  assert.deepEqual(got.transactions.map((x) => x.category), ["groceries", "", "housing", "transfer", "", "dining", ""]);
  assert.equal(got.imports[0].fileName, "pasted text");
  // a CAMT file in a dollar plan: the currency said, no balance offered (a euro figure is never a dollar balance), the
  // figures in euros, the notes with the lines (fix round P1)
  const c = draw(plan());
  c.paste(camt053());
  const ct = c.text();
  assert.match(ct, /Checking ending 4821 \(Lindenbank\): 5 transactions/);
  assert.match(ct, /This file is in EUR, and your plan counts in USD\. The amounts come in as they are, not converted, and the bank's balance is left alone\./);
  assert.ok(!/Also set the balance/.test(ct)); assert.ok(!c.all().some((e) => e.tagName === "INPUT" && e.getAttribute("type") === "checkbox"));
  assert.match(ct, /Money in €2,311, money out €1,084\./);
  assert.match(ct, /Markthalle Lindenau 10\/2\/2026 · bank wrote: Markthalle Lindenau · Kartenzahlung 01\.10\. -€54\.20/);
  assert.ok(!/\$/.test(ct.slice(ct.indexOf("Check and import"))), "no dollar sign on a euro file's figures");
  assert.match(ct, /1 line your bank has not booked yet was left out/);
  c.button("Import 5 transactions").click();
  assert.equal(c.saved.length, 1); assert.equal(c.saved[0].imports[0].currency, "EUR");
  assert.equal(c.saved[0].accounts.find((a) => a.id === "chk").balance, 2000, "the balance left alone");
  assert.ok(!JSON.stringify(c.saved[0]).includes(IBAN1.slice(-4)));
  // the same file in a plan that counts in euros: the bank's balance is the one box above the button
  const e = draw(eurPlan());
  e.paste(camt053());
  assert.match(e.text(), /Also set the balance of Joint checking to €2,726\.85, the bank's figure on 10\/31\/2026/);
  assert.ok(!/This file is in EUR/.test(e.text()));
});

test("on the page: a QIF file whose dates could be read two ways asks, with its own date; the answer is used on Import (fix round F1, F2, P3)", async () => {
  const { FakeElement, textOf } = await import("../qa/fixtures/fake-dom.mjs");
  const ui = await import("../core/ui/dom.js");
  const fmtM = await import("../core/format.js");
  const { render } = await import("../modules/transactions/import/view.js");
  globalThis.requestAnimationFrame ??= (f) => setTimeout(f, 0);
  const p = migrate({ ...emptyPlan(), accounts: [{ id: "chk", name: "Everyday checking", type: "checking", balance: 500, asOf: "2026-09-30" }] });
  const root = new FakeElement("div"), saved = [];
  const ctx = { ui, fmt: { ...fmtM, today: () => TODAY }, plan: p, route: { group: "transactions", id: "import", rest: [], query: {} }, view: {}, go: () => {},
    store: { get: () => p, update: (fn) => { const d = structuredClone(p); fn(d); saved.push(d); } } };
  render(root, ctx);
  const all = () => root.all(), text = () => textOf(root);
  const button = (t) => all().find((e) => e.tagName === "BUTTON" && e.textContent === t);
  all().find((e) => e.tagName === "TEXTAREA").value = "!Type:Bank\nD11/1/2026\nT-1.00\nPShop 1\n^\nD11/2/2026\nT-2.00\nPShop 2\n^\nD11/3/2026\nT-3.00\nPShop 3\n^\nD13/6/2026\nT-4.00\nPShop 4\n^\n";
  button("Use the pasted text").click();
  let t = text();
  assert.match(t, /Bank account: 4 transactions, 1\/11\/2026 to 6\/13\/2026\./);
  assert.match(t, /In this file, is 11\/1\/2026 November 1 or January 11\?/);
  const pressed = () => all().filter((e) => e.tagName === "BUTTON" && e.getAttribute("aria-pressed") === "true").map((e) => e.textContent);
  assert.deepEqual(pressed(), ["January 11"], "the file's own reading, pressed");
  assert.ok(!/day before the month/.test(t), "asked, so not also said");
  // the one-account plan: the link to add another account is a 44 px tap
  const link = all().find((e) => e.tagName === "A" && /Add the account it belongs to/.test(e.textContent));
  assert.ok(link.classList.contains("im-tap"));
  assert.match(textOf(root), /\.im-root \.im-tap \{ display: inline-flex; align-items: center; min-height: 44px; \}/);
  // tap "November 1": read again month first; the stray date is said, not guessed; nothing saved yet
  button("November 1").click();
  t = text();
  assert.deepEqual(pressed(), ["November 1"]);
  assert.match(t, /Bank account: 3 transactions, 11\/1\/2026 to 11\/3\/2026\./);
  assert.match(t, /1 line in this file could not be read \(line 4: no date\)/);
  assert.match(t, /In this file, is 11\/1\/2026 November 1 or January 11\?/, "the question stays: the answer can be changed back");
  assert.equal(saved.length, 0);
  button("Import 3 transactions").click();
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0].transactions.map((x) => x.date), ["2026-11-01", "2026-11-02", "2026-11-03"]);
});

// ---------------------------------------------------------------- nothing changes for anyone else
async function plans() {
  const out = [];
  const dir = path.join(ROOT, "qa", "fixtures");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
    const m = await import(pathToFileURL(path.join(dir, f)).href);
    for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) out.push({ name: `fixture ${f}:${name}`, plan: fn() });
  }
  for (const a of ARCHETYPES) out.push({ name: `${a.id}/base`, plan: a.build() });
  for (const [name, fn] of Object.entries(phone)) out.push({ name: `phone ${name}`, plan: fn() });
  out.push({ name: "empty plan", plan: emptyPlan() });
  return out;
}
const FILES = fs.readdirSync(path.join(ROOT, "qa", "fixtures")).filter((f) => f.endsWith(".csv")).sort();

test(`invariance: no CSV the qa folder holds is a QIF or CAMT file, and each reads exactly as without the new step on every account of every plan: ${FILES.length} files`, async () => {
  const ALL = await plans();
  assert.ok(ALL.length >= 30 && FILES.length >= 12, `${ALL.length} plans, ${FILES.length} files`);
  let compared = 0;
  for (const f of FILES) {
    const text = fs.readFileSync(path.join(ROOT, "qa", "fixtures", f), "utf8");
    assert.equal(isQif(text), false, f); assert.equal(isCamt(text), false, f); assert.equal(isStatement(text), false, f);
    // the bytes decode as the page decoded them before: UTF-8
    assert.equal(decodeFile(new Uint8Array(fs.readFileSync(path.join(ROOT, "qa", "fixtures", f)))), new TextDecoder("utf-8").decode(fs.readFileSync(path.join(ROOT, "qa", "fixtures", f))), f);
    for (const { name, plan: p } of ALL) for (const acc of [...(p.accounts ?? []).slice(0, 3), { id: "" }]) {
      const opts = { accountId: acc.id, importId: "x" };
      const now = prepareImport(structuredClone(p), text, opts), old = prepareImport(structuredClone(p), text, { ...opts, statements: false });
      assert.deepEqual(now, old, `${f} on ${name}:${acc.id}`);
      assert.equal(JSON.stringify(importRecord(now, { id: "i", at: "t", accountId: acc.id, fileName: f })), JSON.stringify(importRecord(old, { id: "i", at: "t", accountId: acc.id, fileName: f })));
      compared++;
    }
  }
  assert.ok(compared >= 400, `${compared} comparisons`);
});

test("invariance: an OFX file reads as it did (its rows carry no note, category or splits; its accounts no label of their own), and an app's file is still an app's", () => {
  const ofx = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<SIGNONMSGSRSV1><SONRS><STATUS><CODE>0<SEVERITY>INFO</STATUS><FI><ORG>Prairie Bank</FI></SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1><STMTTRNRS><TRNUID>1<STMTRS><CURDEF>USD
<BANKACCTFROM><ACCTID>${g("4028", "7351")}<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20261020<DTEND>20261103
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261021<TRNAMT>-54.20<FITID>A1<NAME>KROGER #412<MEMO>POS PURCHASE</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261024<TRNAMT>2310.55<FITID>A2<NAME>ACME PAYROLL</STMTTRN>
</BANKTRANLIST><LEDGERBAL><BALAMT>4210.55<DTASOF>20261103</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>
`;
  assert.equal(isQif(ofx), false); assert.equal(isCamt(ofx), false);
  const p = plan();
  const prep = prepareOfx(p, ofx, { today: TODAY });
  assert.equal(prep.kind, "ofx"); assert.equal(prep.notes, undefined); assert.equal(prep.version, undefined);
  assert.deepEqual(prep.fileAccounts.map((a) => a.label), ["Checking ending 7351"]);
  assert.ok(prep.add.every((t) => t.note === "" && t.category === "" && !("splits" in t)));
  assert.deepEqual(prepareStatement(p, ofx, { today: TODAY }), prep);
  assert.deepEqual(prepareImport(p, ofx, { accountId: "chk" }), prepareImport(p, ofx, { accountId: "chk", statements: false }));
  assert.deepEqual(STATEMENT_KINDS, ["ofx", "qif", "camt"]);
  const ynab = fs.readFileSync(path.join(ROOT, "qa", "fixtures", "ynab-register.csv"), "utf8");
  assert.equal(readFormat(parseBankCsv(ynab)).format.id, "ynab");
});

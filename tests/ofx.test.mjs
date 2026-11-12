// tests/ofx.test.mjs -- the "Quicken" / "QuickBooks" bank and card download (OFX, QFX, QBO) read by core/ofx.js and brought
// in by transactions/import (2026-11-11, Prompt: quick-ofx-import). Every file here is invented and written inline: an SGML
// checking export, an XML card export with charges negative, a file with two accounts, a CHARSET 1252 file, and dates with
// time zones. Account numbers are 8 digits or masked, so no long digit run sits in the source (tools/leak-guard.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { isOfx, ofxCharset, decodeOfx, ofxDate, ofxAmount, decodeEntities, lineId, scrubNumbers, parseOfx } from "../core/ofx.js";
import { prepareImport, prepareOfx, dedupe, importRecord, balanceOffer, applyBalanceOffer, setBalanceFromFile, canUndoBalance, undoBalance, guessOfxAccount, safeFileName, ofxLabel, ofxFits, ofxOwn, isCardLump } from "../modules/transactions/import/compute.js";
import { txKey } from "../modules/transactions/ledger/compute.js";
import { prettyPayee } from "../modules/transactions/rules/compute.js";
import { emptyPlan } from "../core/schema/migrate.js";

const ACCT = "40287351";                 // the invented checking account number: neither it nor its last 4 may be kept
const SAV = "40289964";
const STAMP = (d, t = "120000.000[-5:EST]") => `${d}${t}`;   // a date-time written in two parts (no long digit run in this file)

// 1. OFX 1.x SGML from a bank: header lines, leaf tags never closed, an entity, a FITID built from the account number
const SGML = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1><SONRS><STATUS><CODE>0<SEVERITY>INFO</STATUS><DTSERVER>${STAMP("20261103")}<LANGUAGE>ENG<FI><ORG>Prairie Bank<FID>10898</FI></SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1><STMTTRNRS><TRNUID>1<STATUS><CODE>0<SEVERITY>INFO</STATUS>
<STMTRS><CURDEF>USD
<BANKACCTFROM><BANKID>07100001<ACCTID>${ACCT}<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST><DTSTART>${STAMP("20261020")}<DTEND>${STAMP("20261103")}
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>${STAMP("20261021")}<TRNAMT>-54.20<FITID>${ACCT}-20261021-1<NAME>KROGER #412<MEMO>POS PURCHASE</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>${STAMP("20261024", "080000[-8:PST]")}<TRNAMT>2310.55<FITID>${ACCT}-20261024-1<NAME>ACME PAYROLL &amp; CO<MEMO></STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261029<TRNAMT>-4.50<FITID>${ACCT}-20261029-1<NAME>CORNER COFFEE</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261029<TRNAMT>-4.50<FITID>${ACCT}-20261029-2<NAME>CORNER COFFEE</STMTTRN>
<STMTTRN><TRNTYPE>CHECK<DTPOSTED>20261102<TRNAMT>-1,250.00<FITID>${ACCT}-20261102-1<CHECKNUM>1042<NAME>CHECK 1042</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL><BALAMT>4210.55<DTASOF>${STAMP("20261103")}</LEDGERBAL>
<AVAILBAL><BALAMT>4100.00<DTASOF>${STAMP("20261103")}</AVAILBAL>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>
`;

// 2. OFX 2.x XML from a card: every tag closed, the card number masked, charges negative and the payment positive
const XML = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<?OFX OFXHEADER="200" VERSION="220" SECURITY="NONE" OLDFILEUID="NONE" NEWFILEUID="NONE"?>
<OFX>
  <SIGNONMSGSRSV1><SONRS><STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS><DTSERVER>20261105</DTSERVER><LANGUAGE>ENG</LANGUAGE><FI><ORG>Maple Card Services</ORG></FI></SONRS></SIGNONMSGSRSV1>
  <CREDITCARDMSGSRSV1>
    <CCSTMTTRNRS>
      <TRNUID>0</TRNUID>
      <STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>
      <CCSTMTRS>
        <CURDEF>USD</CURDEF>
        <CCACCTFROM><ACCTID>XXXXXXXXXXXX8642</ACCTID></CCACCTFROM>
        <BANKTRANLIST>
          <DTSTART>20261001</DTSTART><DTEND>20261031</DTEND>
          <STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>${STAMP("20261003", "000000.000[0:GMT]")}</DTPOSTED><TRNAMT>-19.99</TRNAMT><FITID>C1001</FITID><NAME>STREAMING SVC</NAME></STMTTRN>
          <STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261011</DTPOSTED><TRNAMT>-86.40</TRNAMT><FITID>C1002</FITID><NAME>HOME &amp; GARDEN &lt;STORE&gt;</NAME><MEMO>Purchase</MEMO></STMTTRN>
          <STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20261020</DTPOSTED><TRNAMT>250.00</TRNAMT><FITID>C1003</FITID><NAME>PAYMENT THANK YOU</NAME></STMTTRN>
          <STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261027</DTPOSTED><TRNAMT>-12.75</TRNAMT><FITID>C1004</FITID><NAME></NAME><MEMO>PARKING GARAGE</MEMO></STMTTRN>
        </BANKTRANLIST>
        <LEDGERBAL><BALAMT>-812.40</BALAMT><DTASOF>20261031</DTASOF></LEDGERBAL>
      </CCSTMTRS>
    </CCSTMTTRNRS>
  </CREDITCARDMSGSRSV1>
</OFX>`;

// 3. one file, two accounts (checking and savings), and a line with no FITID
const TWO = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
CHARSET:1252

<OFX><BANKMSGSRSV1>
<STMTTRNRS><STMTRS><CURDEF>USD<BANKACCTFROM><BANKID>07100001<ACCTID>${ACCT}<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20261101<DTEND>20261105
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261102<TRNAMT>-30.00<FITID>T1<NAME>GAS STATION</STMTTRN>
</BANKTRANLIST><LEDGERBAL><BALAMT>1500.00<DTASOF>20261105</LEDGERBAL></STMTRS></STMTTRNRS>
<STMTTRNRS><STMTRS><CURDEF>USD<BANKACCTFROM><BANKID>07100001<ACCTID>${SAV}<ACCTTYPE>SAVINGS</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20261101<DTEND>20261105
<STMTTRN><TRNTYPE>INT<DTPOSTED>20261103<TRNAMT>3.12<NAME>INTEREST PAID</STMTTRN>
<STMTTRN><TRNTYPE>XFER<DTPOSTED>20261104<TRNAMT>200.00<FITID>S2<NAME>TRANSFER FROM CHECKING</STMTTRN>
</BANKTRANLIST><LEDGERBAL><BALAMT>9800.25<DTASOF>20261105</LEDGERBAL></STMTRS></STMTTRNRS>
</BANKMSGSRSV1></OFX>`;

const plan = (accounts) => { const p = emptyPlan(); p.accounts.push(...accounts); return p; };
const checking = (extra = {}) => ({ id: "a-chk", name: "Prairie checking", type: "checking", institution: "Prairie Bank", balance: 3900, asOf: "2026-10-15", ownerId: "", history: [], notes: "", ...extra });
const card = { id: "a-card", name: "Maple card", type: "credit", institution: "", balance: 640, asOf: "2026-10-01", ownerId: "", history: [], notes: "" };
/** what the page does on "Import": the lines with fresh ids, the import record and (when ticked) the balance */
function importInto(p, prep, { fileName = "export.qfx", balance = true } = {}) {
  let n = 0;
  for (const t of prep.add) p.transactions.push({ ...t, id: `t${++n}-${p.transactions.length}`, key: txKey(t) });
  p.imports = p.imports ?? [];
  p.imports.push(importRecord(prep, { id: `im${p.imports.length + 1}`, at: "2026-11-11T10:00:00Z", accountId: prep.accountId, fileName }));
  if (balance && prep.balance) applyBalanceOffer(p, prep.balance);
  return p;
}

test("detection is by content: OFX 1.x, OFX 2.x and a bare <OFX> are OFX; a CSV, a pay stub and nothing are not", () => {
  assert.equal(isOfx(SGML), true); assert.equal(isOfx(XML), true); assert.equal(isOfx("﻿<OFX><BANKMSGSRSV1></BANKMSGSRSV1></OFX>"), true);
  assert.equal(isOfx("Date,Description,Amount\n10/02/2026,KROGER,-54.20"), false);
  assert.equal(isOfx("Gross Pay 2,769.23\nNet Pay 1,890.12"), false); assert.equal(isOfx(""), false); assert.equal(isOfx(null), false);
});

test("dates: YYYYMMDD with or without a time, fractions and a zone; the zone is ignored; a day that does not exist is none", () => {
  assert.equal(ofxDate(STAMP("20261103")), "2026-11-03");
  assert.equal(ofxDate(STAMP("20261231", "235959.999[+9.5:ACST]")), "2026-12-31", "the bank's own day, not moved by the zone");
  assert.equal(ofxDate("20261103"), "2026-11-03"); assert.equal(ofxDate(" 20280229 "), "2028-02-29");
  assert.equal(ofxDate("20260229"), null); assert.equal(ofxDate("20261301"), null); assert.equal(ofxDate("2026-11-03"), null); assert.equal(ofxDate(""), null);
});

test("amounts keep their sign; a thousands comma and a decimal comma are both read; entities become characters", () => {
  assert.equal(ofxAmount("-54.20"), -54.2); assert.equal(ofxAmount("+2310.55"), 2310.55); assert.equal(ofxAmount("-1,250.00"), -1250);
  assert.equal(ofxAmount("12,50"), 12.5); assert.equal(ofxAmount("-.75"), -0.75); assert.equal(ofxAmount("abc"), null); assert.equal(ofxAmount(""), null);
  assert.equal(decodeEntities("ACME PAYROLL &amp; CO"), "ACME PAYROLL & CO");
  assert.equal(decodeEntities("&lt;STORE&gt; &quot;x&quot; &apos;y&apos; &#38; &#x26;"), "<STORE> \"x\" 'y' & &");
  assert.equal(decodeEntities("AT&T WIRELESS"), "AT&T WIRELESS", "a raw ampersand (SGML) stays");
});

test("an SGML checking export: account kind, last 4 only, currency, the bank's balance and date, every line signed", () => {
  const f = parseOfx(SGML);
  assert.equal(f.ok, true); assert.equal(f.org, "Prairie Bank"); assert.equal(f.accounts.length, 1); assert.equal(f.investment, false);
  const a = f.accounts[0];
  assert.deepEqual({ kind: a.kind, last4: a.last4, currency: a.currency, balance: a.balance, balanceDate: a.balanceDate, from: a.from, to: a.to }, { kind: "checking", last4: "7351", currency: "USD", balance: 4210.55, balanceDate: "2026-11-03", from: "2026-10-20", to: "2026-11-03" });
  assert.deepEqual(a.rows.map((r) => [r.date, r.amount, r.payee]), [["2026-10-21", -54.2, "KROGER #412"], ["2026-10-24", 2310.55, "ACME PAYROLL & CO"], ["2026-10-29", -4.5, "CORNER COFFEE"], ["2026-10-29", -4.5, "CORNER COFFEE"], ["2026-11-02", -1250, "CHECK 1042"]]);
  assert.equal(a.rows[0].memo, "POS PURCHASE"); assert.equal(a.rows[1].memo, "", "an empty <MEMO> is an empty leaf, not a box holding the next lines");
  assert.equal(a.rows[0].fitid, lineId(`${ACCT}-20261021-1`), "a line's id leaves as a one-way id, never the FITID a bank built from the account number");
  assert.match(a.rows[0].fitid, /^[0-9a-z]{8,14}$/); assert.notEqual(a.rows[0].fitid, a.rows[1].fitid);
  assert.deepEqual(a.bad, [], "every line was read");
  assert.ok(!JSON.stringify(f).includes(ACCT), "the account number never leaves parseOfx");
  assert.equal(ofxLabel(a), "Checking ending 7351");
});

test("an XML card export: charges negative, the payment positive, MEMO when NAME is empty, entities, the masked number", () => {
  const f = parseOfx(XML);
  const a = f.accounts[0];
  assert.equal(f.org, "Maple Card Services"); assert.equal(a.kind, "card"); assert.equal(a.last4, "8642"); assert.equal(a.balance, -812.4); assert.equal(a.balanceDate, "2026-10-31");
  assert.deepEqual(a.rows.map((r) => [r.date, r.amount, r.payee, r.fitid]), [["2026-10-03", -19.99, "STREAMING SVC", lineId("C1001")], ["2026-10-11", -86.4, "HOME & GARDEN <STORE>", lineId("C1002")], ["2026-10-20", 250, "PAYMENT THANK YOU", lineId("C1003")], ["2026-10-27", -12.75, "PARKING GARAGE", lineId("C1004")]]);
  assert.equal(f.complete, true);
  // the same file with every tag on one line reads the same
  assert.deepEqual(parseOfx(XML.replace(/\n\s*/g, "")).accounts, f.accounts);
});

test("a file with two accounts: each read on its own; a line with no FITID is kept; a missing </STMTTRN> does not nest lines", () => {
  const f = parseOfx(TWO);
  assert.deepEqual(f.accounts.map((a) => [a.kind, a.last4, a.rows.length, a.balance]), [["checking", "7351", 1, 1500], ["savings", "9964", 2, 9800.25]]);
  assert.equal(f.accounts[1].rows[0].fitid, null);
  const open = parseOfx(TWO.replace(/<\/STMTTRN>/g, ""));
  assert.deepEqual(open.accounts.map((a) => a.rows.map((r) => r.amount)), [[-30], [3.12, 200]]);
  assert.equal(parseOfx("<OFX><INVSTMTMSGSRSV1><INVSTMTTRNRS><INVSTMTRS><CURDEF>USD</INVSTMTRS></INVSTMTTRNRS></INVSTMTMSGSRSV1></OFX>").investment, true);
  assert.equal(parseOfx("no ofx here").ok, false);
});

test("CHARSET 1252: an é and a curly apostrophe come out right; UTF-8 files stay UTF-8", () => {
  const body = SGML.replace("KROGER #412", "CAFé JOE\u0092S");   // written as the bytes a 1252 file holds
  const bytes = Uint8Array.from(Buffer.from(body, "latin1"));
  assert.equal(ofxCharset(body), "windows-1252");
  const text = decodeOfx(bytes);
  assert.equal(parseOfx(text).accounts[0].rows[0].payee, "CAFÉ JOE’S".replace("É", "é"));
  assert.notEqual(new TextDecoder("utf-8").decode(bytes).includes("CAFé"), true, "read as UTF-8 the same bytes would be garbled");
  assert.equal(ofxCharset(XML), "utf-8"); assert.equal(ofxCharset("OFXHEADER:100\nENCODING:UTF-8\nCHARSET:NONE"), "utf-8");
  assert.equal(decodeOfx(new TextEncoder().encode(XML.replace("STREAMING SVC", "CAFÉ"))).includes("CAFÉ"), true);
});

test("into Import: no column step, the account guessed, the lines through prepareRows, the balance offered", () => {
  const p = plan([checking(), card]);
  const prep = prepareImport(p, SGML, {});
  assert.equal(prep.kind, "ofx"); assert.equal(prep.mapping, undefined, "no column mapping");
  assert.deepEqual(prep.guess, { accountId: "a-chk", why: "kind", options: ["a-chk"], otherBank: null, lump: false }); assert.equal(prep.accountId, "a-chk");
  assert.equal(prep.add.length, 5, "both $4.50 coffees: two lines, two FITIDs"); assert.equal(prep.skip.length, 0);
  assert.equal(prep.add[1].payee, prettyPayee("ACME PAYROLL & CO"), "the payee cleaned as a CSV's is"); assert.equal(prep.add[1].rawPayee, "ACME PAYROLL & CO"); assert.equal(prep.add[0].extId, lineId(`${ACCT}-20261021-1`));
  assert.equal(prep.fileFrom, "2026-10-20", "the file's own DTSTART, not its first line"); assert.equal(prep.fileTo, "2026-11-03", "its DTEND");
  assert.equal(Math.round(prep.inTotal * 100) / 100, 2310.55); assert.equal(Math.round(prep.outTotal * 100) / 100, 1313.2);
  assert.deepEqual(prep.balance, { accountId: "a-chk", amount: 4210.55, date: "2026-11-03", was: 3900, wasAsOf: "2026-10-15", debt: false, lump: false, tick: false });
  // the card file goes to the card; its balance is what is owed
  const c = prepareImport(p, XML, {});
  assert.equal(c.accountId, "a-card"); assert.equal(c.add.length, 4);
  assert.deepEqual(c.add.map((t) => t.amount), [-19.99, -86.4, 250, -12.75], "card charges stay money out, with no flip");
  assert.equal(c.balance.amount, 812.4); assert.equal(c.balance.debt, true);
});

test("the gap check works on an OFX file as on a CSV", () => {
  const p = plan([checking()]);
  for (let d = 1; d <= 9; d++) p.transactions.push({ id: `old${d}`, date: `2026-10-0${d}`, amount: -10, payee: "Lunch", rawPayee: "LUNCH", accountId: "a-chk", category: "", tags: [], note: "", key: "" });
  for (const t of p.transactions) t.key = txKey(t);
  const prep = prepareOfx(p, SGML, {});
  assert.ok(prep.gap, "lines end 10/9, the file starts 10/20: a hole"); assert.equal(prep.gap.last, "2026-10-09"); assert.equal(prep.gap.fileFrom, "2026-10-20");
});

test("duplicates: the same file twice adds 0 (by FITID); a renamed line with its FITID is still the same; no FITID falls back to the key", () => {
  const p = plan([checking()]);
  importInto(p, prepareOfx(p, SGML, {}));
  assert.equal(p.transactions.length, 5);
  const again = prepareOfx(p, SGML, {});
  assert.equal(again.add.length, 0); assert.equal(again.skip.length, 5);
  // the bank later sends the same line with a cleaned-up name: the key differs, the FITID does not
  const renamed = prepareOfx(p, SGML.replace("KROGER #412", "KROGER"), {});
  assert.equal(renamed.add.length, 0, "same FITID: already on file");
  // a line brought in from a CSV before (no FITID) is the same line by key, once
  const q = plan([checking()]);
  q.transactions.push({ id: "csv1", date: "2026-10-29", amount: -4.5, payee: "Corner Coffee", rawPayee: "CORNER COFFEE", accountId: "a-chk", category: "", tags: [], note: "", importId: "csv" });
  q.transactions[0].key = txKey(q.transactions[0]);
  const mixed = prepareOfx(q, SGML, {});
  assert.equal(mixed.skip.length, 1, "one coffee was on file from the CSV"); assert.equal(mixed.add.filter((t) => t.rawPayee === "CORNER COFFEE").length, 1, "the second coffee is new");
  // with no FITIDs at all the key decides, as for a CSV
  const bare = SGML.replace(/<FITID>[^<\n]*/g, "");
  const r = plan([checking()]);
  const first = prepareOfx(r, bare, {});
  assert.equal(first.add.length, 4, "two identical coffees with no id are one line by key, as a CSV import has always done");
  importInto(r, first);
  assert.equal(prepareOfx(r, bare, {}).add.length, 0);
  // dedupe on its own: an id on another account is not this account's
  const t = (acct, extId) => ({ accountId: acct, date: "2026-11-01", amount: -5, rawPayee: "X", extId, key: `${acct}|k` });
  assert.equal(dedupe([t("a", "F1")], [t("b", "F1")]).add.length, 1);
  assert.equal(dedupe([t("a", "F1")], [t("a", "F1")]).add.length, 0);
  assert.equal(dedupe([t("a", "F1")], [t("a", "F2")]).add.length, 0, "the same line downloaded again with a new id: the plan already holds one with that key");
  assert.equal(dedupe([t("a", "F1")], [t("a", "F2"), t("a", "F3")]).add.length, 1, "the plan holds one, the file two: one is new");
  assert.equal(dedupe([], [t("a", "F2"), t("a", "F3")]).add.length, 2, "two lines with the same key and two ids in one file both come in");
});

test("two accounts in one file: the first with new lines is offered; each goes to its own account; a pick by hand wins", () => {
  const sav = { id: "a-sav", name: "Prairie savings", type: "savings", institution: "", balance: 9500, asOf: "2026-10-01", ownerId: "", history: [], notes: "" };
  const p = plan([checking(), sav]);
  const one = prepareOfx(p, TWO, {});
  assert.equal(one.fileAccounts.length, 2); assert.deepEqual(one.fileAccounts.map((a) => a.label), ["Checking ending 7351", "Savings ending 9964"]);
  assert.equal(one.which, 0); assert.equal(one.accountId, "a-chk");
  importInto(p, one);
  const two = prepareOfx(p, TWO, {});
  assert.equal(two.which, 1, "the checking lines are on file: the savings account comes next"); assert.equal(two.accountId, "a-sav"); assert.equal(two.add.length, 2);
  assert.equal(two.balance.amount, 9800.25);
  assert.equal(prepareOfx(p, TWO, { which: 0, accountId: "a-sav" }).accountId, "a-sav", "the account box picked by hand is used");
});

test("the account guess: lines already held, the only one of its kind, the bank's name among several; else the person picks", () => {
  const two = plan([checking(), { ...checking(), id: "a-chk2", name: "Joint checking", institution: "Other Bank" }]);
  const fa = parseOfx(SGML).accounts[0];
  assert.deepEqual(guessOfxAccount(two, fa, "Prairie Bank"), { accountId: "a-chk", why: "name", options: ["a-chk", "a-chk2"], otherBank: null, lump: false });
  assert.equal(guessOfxAccount(two, fa, null).accountId, null, "two checking accounts and no bank name: the person picks");
  const held = plan([checking(), { ...checking(), id: "a-chk2", name: "Joint checking", institution: "" }]);
  importInto(held, prepareOfx(held, SGML, { accountId: "a-chk2" }));
  assert.deepEqual([guessOfxAccount(held, fa, "Prairie Bank").accountId, guessOfxAccount(held, fa, "Prairie Bank").why], ["a-chk2", "holds"], "where its lines already are wins");
  assert.deepEqual(guessOfxAccount(plan([card]), fa, null), { accountId: null, why: null, options: [], otherBank: null, lump: false }, "a checking file never guesses a card, and a card is not offered for it");
});

test("the balance offer: one tap keeps the old figure as a point; not offered when the plan's is newer or the same", () => {
  const p = plan([checking()]);
  const prep = prepareOfx(p, SGML, {});
  assert.equal(applyBalanceOffer(p, prep.balance), true);
  const a = p.accounts[0];
  assert.equal(a.balance, 4210.55); assert.equal(a.asOf, "2026-11-03");
  assert.deepEqual(a.history, [{ date: "2026-10-15", balance: 3900 }, { date: "2026-11-03", balance: 4210.55 }]);
  assert.equal(prepareOfx(p, SGML, {}).balance, null, "the same figure for the same day: nothing to offer");
  assert.equal(balanceOffer(plan([checking({ asOf: "2026-11-10" })]), "a-chk", parseOfx(SGML).accounts[0]), null, "a newer balance on file wins");
  // a card kept as a negative balance keeps its sign; a guess on the balance is dropped
  const c = plan([{ ...card, balance: -640 }]);
  c.guesses = { "accounts[a-card].balance": { k: "account.card.balance", v: -640, u: "total", s: 0.5, at: "2026-10-01", d: null } };
  applyBalanceOffer(c, prepareOfx(c, XML, {}).balance);
  assert.equal(c.accounts[0].balance, -812.4); assert.equal(c.guesses, undefined);
});

test("the plan after an import holds no account number (not the full one, not its last 4), and the file name loses it", () => {
  const p = plan([checking(), card]);
  importInto(p, prepareOfx(p, SGML, {}), { fileName: `Prairie${ACCT.slice(-4)}_Activity.qfx` });
  importInto(p, prepareOfx(p, XML, {}), { fileName: "Maple_8642.qbo" });
  const sav = { id: "a-sav", name: "Savings", type: "savings", balance: 1, asOf: "2026-10-01", history: [] };
  p.accounts.push(sav);
  importInto(p, prepareOfx(p, TWO, { which: 1, accountId: "a-sav" }), { fileName: "two.ofx" });
  const json = JSON.stringify(p);
  for (const digits of [ACCT, ACCT.slice(-4), SAV, SAV.slice(-4), "8642"]) assert.ok(!json.includes(digits), `${digits} is not kept`);
  assert.deepEqual(p.imports.map((im) => im.fileName), ["PrairieXXXX_Activity.qfx", "Maple_XXXX.qbo", "two.ofx"]);
  assert.deepEqual(p.imports.map((im) => [im.rows, im.added, im.currency]), [[5, 5, "USD"], [4, 4, "USD"], [2, 2, "USD"]]);
  assert.equal(safeFileName("statement.ofx", ["7351"]), "statement.ofx");
  assert.equal(lineId("  "), null); assert.equal(lineId("T-1"), lineId(" T-1 ")); assert.notEqual(lineId("T-1"), lineId("T-2"));
  assert.ok(!lineId(`${ACCT}-20261021-1`).includes(ACCT.slice(-4)), "the id does not show the digits it was made from");
});

// ---------------------------------------------------------------- round-1 review (2026-11-12): where a file may go, what counts as the same line, undo
/** an invented SGML bank file: lines are [YYYYMMDD, amount, FITID or null, NAME, MEMO?] */
function bankFile({ org = "Prairie Bank", acct = ACCT, type = "CHECKING", lines = [], bal = null, asOf = "20261112", start = "20261020", end = "20261112", close = true } = {}) {
  const trn = lines.map(([d, amt, id, name, memo]) => `<STMTTRN><TRNTYPE>${Number(amt) < 0 ? "DEBIT" : "CREDIT"}<DTPOSTED>${d}<TRNAMT>${amt}${id === null || id === undefined ? "" : `<FITID>${id}`}<NAME>${name}${memo ? `<MEMO>${memo}` : ""}</STMTTRN>`).join("\n");
  return `OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nCHARSET:1252\n\n<OFX>\n<SIGNONMSGSRSV1><SONRS><STATUS><CODE>0<SEVERITY>INFO</STATUS><DTSERVER>${asOf}<LANGUAGE>ENG${org ? `<FI><ORG>${org}<FID>10898</FI>` : ""}</SONRS></SIGNONMSGSRSV1>\n<BANKMSGSRSV1><STMTTRNRS><TRNUID>1<STATUS><CODE>0<SEVERITY>INFO</STATUS>\n<STMTRS><CURDEF>USD<BANKACCTFROM><BANKID>07100001<ACCTID>${acct}<ACCTTYPE>${type}</BANKACCTFROM>\n<BANKTRANLIST><DTSTART>${start}<DTEND>${end}\n${trn}\n</BANKTRANLIST>${bal === null ? "" : `<LEDGERBAL><BALAMT>${bal}<DTASOF>${asOf}</LEDGERBAL>`}\n</STMTRS></STMTTRNRS></BANKMSGSRSV1>\n${close ? "</OFX>\n" : ""}`;
}
/** an invented card file (XML): charges negative */
const cardFile = ({ bal = "-6522.17", asOf = "20261111", pay = "250.00" } = {}) => XML.replace("<BALAMT>-812.40</BALAMT><DTASOF>20261031</DTASOF>", `<BALAMT>${bal}</BALAMT><DTASOF>${asOf}</DTASOF>`).replace("<TRNAMT>250.00</TRNAMT>", `<TRNAMT>${pay}</TRNAMT>`);
const TEN = bankFile({ lines: [["20261020", "-54.20", "A1", "KROGER #412"], ["20261022", "-38.50", "A2", "CAFE LUNA"], ["20261024", "2310.55", "A3", "ACME PAYROLL"], ["20261027", "-1450.00", "A4", "OAKWOOD APARTMENTS RENT"], ["20261110", "-89.99", "A5", "CITY POWER"]], bal: "4512.36" });
const TODAY = "2026-11-12";
// a household as Get started leaves it: a 401(k), checking, savings and a car loan, no card (the review's Jamie)
const jamie = () => plan([
  { id: "k", name: "Jamie's plan at work", type: "401k", institution: "", balance: 30000, asOf: "2026-11-11", ownerId: "p1", history: [] },
  { id: "chk", name: "Checking", type: "checking", institution: "", balance: 3000, asOf: "2026-11-11", ownerId: "", history: [] },
  { id: "sav", name: "Savings", type: "savings", institution: "", balance: 18000, asOf: "2026-11-11", ownerId: "", history: [] },
  { id: "car", name: "Car loan", type: "loan", institution: "", balance: 14000, asOf: "2026-11-11", ownerId: "", history: [] },
]);
const chase = () => plan([{ id: "a-chk", name: "Chase checking", type: "checking", institution: "Chase", balance: 4200, asOf: "2026-11-01", ownerId: "", history: [] }, { id: "a-sav", name: "Ally savings", type: "savings", institution: "Ally", balance: 11500, asOf: "2026-11-01", ownerId: "", history: [] }, { id: "a-visa", name: "Visa card", type: "credit", institution: "", balance: 6400, asOf: "2026-11-01", ownerId: "", history: [] }]);

test("M1 / P1 / B2: a file never goes to an account of another kind: a card file with no card on the plan has no account and no offer, and the 401(k) is not touched", () => {
  const p = jamie();
  const prep = prepareOfx(p, cardFile(), { today: TODAY });
  assert.equal(prep.ok, true); assert.equal(prep.accountId, null, "no card on the plan: nothing is picked"); assert.deepEqual(prep.guess.options, [], "and no account is offered for it");
  assert.equal(prep.balance, null); assert.equal(prep.add.length, 0);
  assert.equal(p.accounts[0].balance, 30000);
  // the same file with an account given by hand (the page opened for it, or an old pick): checking, the 401(k), the loan
  for (const id of ["chk", "k", "car", "sav"]) {
    const by = prepareOfx(p, cardFile(), { accountId: id, today: TODAY });
    assert.equal(by.accountId, null, `${id}: not brought in`); assert.deepEqual(by.mismatch, { accountId: id, type: p.accounts.find((a) => a.id === id).type }); assert.equal(by.balance, null); assert.equal(by.add.length, 0);
  }
  // "bring it in anyway" (behind "It does belong on ...") brings the lines and never the balance
  const forced = prepareOfx(p, cardFile(), { accountId: "chk", today: TODAY, force: true });
  assert.equal(forced.accountId, "chk"); assert.equal(forced.forced, true); assert.equal(forced.add.length, 4); assert.equal(forced.balance, null);
  // a checking file on a plan whose only account is a 401(k): no target, no offer
  const only = plan([{ id: "k", name: "Ana's 401(k) at work", type: "401k", balance: 0, asOf: TODAY, history: [] }]);
  const none = prepareOfx(only, TEN, { today: TODAY });
  assert.equal(none.accountId, null); assert.deepEqual(none.guess.options, []); assert.equal(none.balance, null);
  // what may go where
  assert.equal(ofxFits("card", "credit"), true); assert.equal(ofxFits("card", "checking"), false); assert.equal(ofxFits("checking", "401k"), false); assert.equal(ofxFits("checking", "mortgage"), false); assert.equal(ofxFits("checking", "savings"), true);
  assert.equal(ofxOwn("checking", "savings"), false); assert.equal(ofxOwn("checking", "checking"), true);
});

test("P1c / N1: a checking file on the savings account or the card the page was opened for: said, and its balance is never offered there", () => {
  const p = chase();
  const onSavings = prepareOfx(p, TEN, { accountId: "a-sav", today: TODAY });
  assert.equal(onSavings.accountId, "a-sav", "a bank file may be brought in to another bank account by hand"); assert.equal(onSavings.otherKind, true, "and the page says the file is a checking account's");
  assert.equal(onSavings.balance, null, "a checking balance is not a savings balance");
  const onVisa = prepareOfx(p, TEN, { accountId: "a-visa", today: TODAY });
  assert.equal(onVisa.accountId, null); assert.equal(onVisa.mismatch.type, "credit"); assert.equal(onVisa.balance, null);
  assert.equal(balanceOffer(p, "a-visa", parseOfx(TEN).accounts[0], { today: TODAY }), null, "a checking figure is never what is owed on a card");
  assert.equal(balanceOffer(p, "a-chk", parseOfx(cardFile()).accounts[0], { today: TODAY }), null, "a card's figure is never a checking balance");
});

test("M4: another bank's file is not put on the plan's only account of that kind; picked by hand, its balance is not ticked", () => {
  const p = chase();
  const prep = prepareOfx(p, TEN, { today: TODAY });
  assert.equal(prep.accountId, null, "Prairie Bank's file, and the only checking account is at Chase: the person says");
  assert.deepEqual(prep.guess.otherBank, { org: "Prairie Bank", accountId: "a-chk", name: "Chase checking", at: "Chase" });
  const by = prepareOfx(p, TEN, { accountId: "a-chk", today: TODAY });
  assert.equal(by.add.length, 5); assert.equal(by.balance.amount, 4512.36); assert.equal(by.balance.tick, false);
  // an account that names no bank ("Checking", as Get started saves it) is the only one of its kind: picked, not ticked
  const j = prepareOfx(jamie(), TEN, { today: TODAY });
  assert.equal(j.accountId, "chk"); assert.equal(j.guess.why, "kind"); assert.equal(j.balance.tick, false);
  // ticked only for a sure reason: its lines are already there, or the bank's name picks it among several
  const held = jamie(); importInto(held, prepareOfx(held, TEN, { today: TODAY }), { balance: false });
  const more = bankFile({ lines: [["20261110", "-89.99", "A5", "CITY POWER"], ["20261111", "-12.00", "A6", "BAKERY"]], bal: "4500.36" });
  const again = prepareOfx(held, more, { today: TODAY });
  assert.equal(again.guess.why, "holds"); assert.equal(again.add.length, 1); assert.equal(again.balance.tick, true);
});

test("P1d: Get started's one 'Credit cards' line stands for every card: one card's file is not its balance by default", () => {
  const p = plan([{ id: "setup-owe-credit", name: "Credit cards", type: "credit", institution: "", balance: 3200, asOf: "2026-11-01", history: [] }]);
  assert.equal(isCardLump(p.accounts[0]), true); assert.equal(isCardLump({ type: "credit", name: "Visa card" }), false);
  const prep = prepareOfx(p, cardFile(), { today: TODAY });
  assert.equal(prep.accountId, "setup-owe-credit"); assert.equal(prep.guess.lump, true); assert.equal(prep.balance.lump, true); assert.equal(prep.balance.tick, false);
});

test("B3: two checking accounts in one file are not both guessed onto the plan's only checking account", () => {
  const second = bankFile({ acct: "40281234", lines: [["20261105", "-75.50", "Q2", "PHARMACY"]], bal: "310.40" });
  const both = TEN.replace("</BANKMSGSRSV1>", `${second.slice(second.indexOf("<STMTTRNRS>"), second.indexOf("</BANKMSGSRSV1>"))}</BANKMSGSRSV1>`);
  const f = parseOfx(both);
  assert.deepEqual(f.accounts.map((a) => [a.kind, a.last4]), [["checking", "7351"], ["checking", "1234"]]);
  const p = jamie();
  const prep = prepareOfx(p, both, { today: TODAY });
  assert.equal(prep.accountId, null, "which is which cannot be told: the person picks each"); assert.deepEqual(prep.guess.options, ["chk", "sav"]);
  assert.equal(prepareOfx(p, both, { which: 1, today: TODAY }).accountId, null);
});

test("B1 / M10: a line id counts only with the same amount and about the same day; ids that repeat do not hide lines or move a file to another account", () => {
  // every line of the file has the same id: all four come in, and the same file again adds none
  const same = bankFile({ lines: [["20261102", "-54.20", "0", "KROGER #412"], ["20261103", "-38.50", "0", "CAFE LUNA"], ["20261105", "2310.55", "0", "ACME PAYROLL"], ["20261106", "-1450.00", "0", "OAKWOOD APARTMENTS RENT"]], bal: "5000.00" });
  const p = jamie();
  const first = prepareOfx(p, same, { today: TODAY });
  assert.equal(first.add.length, 4); assert.equal(first.skip.length, 0);
  assert.equal(Math.round(first.inTotal * 100), 231055); assert.equal(Math.round(first.outTotal * 100), 154270);
  assert.equal(first.add.filter((t) => t.extId).length, 1, "an id the account already holds for another line is not kept");
  importInto(p, first, { balance: false });
  assert.equal(prepareOfx(p, same, { today: TODAY }).add.length, 0);
  // ids made from the day, the same in the checking and the savings file
  const chk = bankFile({ lines: [["20261104", "-200.00", "20261104", "TRANSFER TO SAVINGS"], ["20261110", "-30.00", "20261110", "GAS STATION"]], bal: "4380.00" });
  const sav = bankFile({ acct: SAV, type: "SAVINGS", lines: [["20261104", "200.00", "20261104", "TRANSFER FROM CHECKING"], ["20261110", "3.12", "20261110", "INTEREST PAID"]], bal: "11703.12" });
  const q = jamie();
  importInto(q, prepareOfx(q, chk, { today: TODAY }), { balance: false });
  const s = prepareOfx(q, sav, { today: TODAY });
  assert.equal(s.accountId, "sav", "the savings file goes to the savings account, whatever ids the checking lines carry"); assert.equal(s.add.length, 2); assert.equal(s.skip.length, 0);
  assert.equal(s.balance.accountId, "sav");
  // the same id a few days later with the same amount (posted after pending) is the same line; a month later it is not
  const t = (date, amount, extId) => ({ accountId: "a", date, amount, rawPayee: "X", extId, key: `a|${date}|${amount}|x` });
  assert.equal(dedupe([t("2026-11-01", -5, "F1")], [t("2026-11-03", -5, "F1")]).add.length, 0);
  assert.equal(dedupe([t("2026-11-01", -5, "F1")], [t("2026-12-01", -5, "F1")]).add.length, 1);
  assert.equal(dedupe([t("2026-11-01", -5, "F1")], [t("2026-11-01", -6, "F1")]).add.length, 1);
});

test("M8 / M9: lines from a CSV are not added again from the bank's file (a NAME stops at 32 characters), nor the same lines with new ids", () => {
  const p = jamie();
  const csv = (id, date, amount, raw) => { const t = { id, date, amount, payee: raw, rawPayee: raw, accountId: "chk", category: "", tags: [], note: "", importId: "csv" }; t.key = txKey(t); return t; };
  p.transactions.push(csv("c1", "2026-10-21", -42.17, "AMAZON MKTPL ORDER 77 AMZN SEATTLE WA USA"), csv("c2", "2026-10-22", -500, "ONLINE TRANSFER TO SAVINGS ACCOUNT REF PLAN"), csv("c3", "2026-10-23", -12, "BAKERY"));
  const qfx = bankFile({ lines: [["20261021", "-42.17", "B1", "AMAZON MKTPL ORDER 77 AMZN SEATT", "LE WA USA"], ["20261022", "-500.00", "B2", "ONLINE TRANSFER TO SAVINGS ACCOU", "NT REF PLAN"], ["20261023", "-12.00", "B3", "BAKERY"], ["20261024", "-9.00", "B4", "BAKERY"]] });
  assert.equal("AMAZON MKTPL ORDER 77 AMZN SEATT".length, 32);
  const prep = prepareOfx(p, qfx, { today: TODAY });
  assert.deepEqual(prep.add.map((t) => t.rawPayee), ["BAKERY"], "only the line of the 24th is new"); assert.equal(prep.skip.length, 3);
  // the other way round: the bank's file first, then the CSV of the same days
  const q = jamie();
  importInto(q, prepareOfx(q, qfx, { today: TODAY }), { balance: false });
  assert.equal(dedupe(q.transactions, p.transactions.map((t) => ({ ...t }))).add.length, 0);
  // the same file downloaded again, every id changed
  const again = qfx.replace(/<FITID>B/g, "<FITID>Z");
  assert.equal(prepareOfx(q, again, { today: TODAY }).add.length, 0);
  // EXTDNAME, when a file has it, is the whole name
  const ext = parseOfx(qfx.replace("<NAME>AMAZON MKTPL ORDER 77 AMZN SEATT", "<NAME>AMAZON MKTPL ORDER 77 AMZN SEATT<EXTDNAME>AMAZON MKTPL ORDER 77 AMZN SEATTLE WA USA"));
  assert.equal(ext.accounts[0].rows[0].payee, "AMAZON MKTPL ORDER 77 AMZN SEATTLE WA USA");
});

test("M11: a card file whose charges are negative and whose balance is positive may be a card in credit: asked, never ticked", () => {
  const p = chase(); p.accounts[2].institution = "Maple";
  const prep = prepareOfx(p, cardFile({ bal: "25.17" }), { today: TODAY });
  assert.equal(prep.accountId, "a-visa"); assert.equal(prep.balance.ask, "credit"); assert.equal(prep.balance.tick, false); assert.equal(prep.balance.amount, 25.17);
  const owed = prepareOfx(p, cardFile(), { today: TODAY });
  assert.equal(owed.balance.ask, undefined); assert.equal(owed.balance.amount, 6522.17); assert.equal(owed.balance.debt, true);
  // one charge and one payment (the critic's own file, fix round 2): half the lines are charges, so it is asked too
  const two = XML.replace(/<STMTTRN><TRNTYPE>DEBIT<\/TRNTYPE><DTPOSTED>20261011[\s\S]*?<\/STMTTRN>/, "").replace(/<STMTTRN><TRNTYPE>DEBIT<\/TRNTYPE><DTPOSTED>20261027[\s\S]*?<\/STMTTRN>/, "").replace("<BALAMT>-812.40</BALAMT><DTASOF>20261031</DTASOF>", "<BALAMT>25.17</BALAMT><DTASOF>20261111</DTASOF>");
  assert.equal(parseOfx(two).accounts[0].rows.length, 2);
  assert.equal(prepareOfx(p, two, { today: TODAY }).balance.ask, "credit");
  // charges written positive (an issuer that flips the sign): a positive figure is what is owed, not asked
  const flipped = cardFile({ bal: "812.40" }).replace(/<TRNAMT>-/g, "<TRNAMT>+").replace("<TRNAMT>250.00", "<TRNAMT>-250.00");
  assert.equal(prepareOfx(p, flipped, { today: TODAY }).balance.ask, undefined);
});

test("M15: the days a file covers are its own DTSTART and DTEND, so a quiet week at its edge is not read as missing days", () => {
  const month = (m, last, days) => bankFile({ start: `2026${m}01`, end: `2026${m}${last}`, asOf: `2026${m}${last}`, lines: days.map((d, i) => [`2026${m}${d}`, d === "02" ? "-1450.00" : "-40.00", `${m}-${i}`, d === "02" ? "OAKWOOD APARTMENTS RENT" : `SHOP ${m}${d}`]) });
  const p = jamie();
  for (const [m, last] of [["07", "31"], ["08", "31"], ["09", "30"]]) {
    const prep = prepareOfx(p, month(m, last, ["02", "09", "16", "23", "27"]), { today: TODAY });
    assert.equal(prep.fileFrom, `2026-${m}-01`); assert.equal(prep.fileTo, `2026-${m}-${last}`);
    assert.equal(prep.gap, null, `${m}: no days missing before it`);
    importInto(p, prep, { balance: false });
  }
  assert.deepEqual(p.imports.map((im) => [im.from, im.to]), [["2026-07-01", "2026-07-31"], ["2026-08-01", "2026-08-31"], ["2026-09-01", "2026-09-30"]]);
  const oct = prepareOfx(p, month("10", "31", ["09", "16", "23", "27"]), { today: TODAY });
  assert.equal(oct.gap, null, "October's first line is on the 9th, and the file says it starts on the 1st: nothing is missing");
  assert.equal(oct.fileFrom, "2026-10-01"); assert.equal(oct.dateFrom, "2026-10-09", "what is added still starts at its first line");
  // a DTEND after today is today (the lines stop there); a range that does not hold the lines is not believed
  assert.equal(prepareOfx(jamie(), bankFile({ start: "20261101", end: "20261130", lines: [["20261103", "-5.00", "N1", "COFFEE"]] }), { today: TODAY }).fileTo, TODAY);
  const wrong = prepareOfx(jamie(), bankFile({ start: "20261105", end: "20261106", lines: [["20261103", "-5.00", "N1", "COFFEE"], ["20261109", "-6.00", "N2", "COFFEE"]] }), { today: TODAY });
  assert.deepEqual([wrong.fileFrom, wrong.fileTo], ["2026-11-03", "2026-11-09"]);
});

test("N7: a balance dated tomorrow (an evening download stamped in GMT) is today's; one further ahead is not offered", () => {
  const p = jamie();
  const tomorrow = prepareOfx(p, bankFile({ lines: [["20261112", "-20.00", "T1", "LUNCH"]], bal: "4180.00", asOf: STAMP("20261113", "020000.000[0:GMT]") }), { today: TODAY });
  assert.equal(tomorrow.balance.date, TODAY); assert.equal(tomorrow.balance.amount, 4180);
  assert.equal(prepareOfx(p, bankFile({ lines: [["20261112", "-20.00", "T1", "LUNCH"]], bal: "4180.00", asOf: "20271112" }), { today: TODAY }).balance, null);
});

test("B6 / N6: a file cut short brings in no half line and says so; lines that cannot be read are counted; CDATA is text", () => {
  const cut = TEN.slice(0, TEN.indexOf("<TRNAMT>-1450.00") + "<TRNAMT>-14".length);
  const f = parseOfx(cut);
  assert.equal(f.complete, false); assert.deepEqual(f.accounts[0].rows.map((r) => r.amount), [-54.2, -38.5, 2310.55], "the line cut inside its amount (-14) is not brought in");
  assert.equal(parseOfx(TEN).complete, true);
  const prep = prepareOfx(jamie(), cut, { today: TODAY });
  assert.equal(prep.complete, false); assert.equal(prep.add.length, 3);
  // unreadable lines: an amount in brackets, a decimal comma with a thousands dot, a day that does not exist, no amount
  const odd = bankFile({ lines: [["20261020", "-54.20", "A1", "KROGER #412"], ["20261022", "(1450.00)", "A2", "RENT"], ["20261024", "1.234,56", "A3", "PAYROLL"], ["20261340", "-38.50", "A4", "CAFE"], ["20261102", "-89.99", "A6", "CITY POWER"]], bal: "2412.36" }).replace("<TRNAMT>-89.99", "").replace("<DTPOSTED>20261102<FITID>A6", "<DTPOSTED>20261102<FITID>A5<NAME>NO AMOUNT LINE</STMTTRN>\n<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261102<TRNAMT>-89.99<FITID>A6");
  const o = prepareOfx(jamie(), odd, { today: TODAY });
  assert.equal(o.add.length, 2); assert.deepEqual(o.bad, [{ row: 2, why: "no amount" }, { row: 3, why: "no amount" }, { row: 4, why: "no date" }, { row: 5, why: "no amount" }]);
  assert.equal(o.balance.tick, false, "with lines left out the bank's balance is not ticked");
  assert.equal(importRecord(o, { id: "i", at: "x", accountId: "chk", fileName: "odd.qfx" }).bad, 4);
  // CDATA, with tags and an ampersand inside
  const cd = parseOfx(XML.replace("<NAME>STREAMING SVC</NAME>", "<NAME><![CDATA[STREAMING & MORE]]></NAME>").replace("<NAME>PAYMENT THANK YOU</NAME>", "<NAME><![CDATA[HOME <GARDEN> CENTER]]></NAME>"));
  assert.deepEqual(cd.accounts[0].rows.map((r) => r.payee).filter((x) => /STREAMING|GARDEN> /.test(x)), ["STREAMING & MORE", "HOME <GARDEN> CENTER"]);
  // a file that closes nothing at all is read as far as it is whole
  const open = TEN.replace(/<\/[A-Z0-9]+>/g, "");
  const n = parseOfx(open);
  assert.equal(n.complete, false); assert.equal(n.accounts[0].rows.length, 4, "the last line, never closed, is left out");
});

test("B5 / N5: no account number is kept: not in a line's text, not in its id, not in the file's name", () => {
  const TEN_DIGITS = ["0040", "2899", "64"].join("");   // an invented account number written with dashes in the file: built from pieces here
  const dashed = bankFile({ acct: "0040-2899-64", type: "SAVINGS", lines: [["20261104", "200.00", `${TEN_DIGITS}20261104`, "XFER FROM CHK 40287351"], ["20261110", "3.12", `${TEN_DIGITS}20261110`, "INTEREST TO 0040-2899-64", "ACCT 40289964 INTEREST"]], bal: "11703.12" });
  const p = jamie();
  const prep = prepareOfx(p, dashed, { today: TODAY });
  importInto(p, prep, { fileName: "0040-2899-64_activity.qfx" });
  const json = JSON.stringify(p);
  for (const digits of ["40287351", "0040-2899-64", TEN_DIGITS, "40289964", "28996", "02873"]) assert.ok(!json.includes(digits), `${digits} is not kept`);
  assert.deepEqual(p.transactions.map((t) => t.rawPayee), ["XFER FROM CHK ...", "INTEREST TO ..."]);
  assert.equal(p.imports[0].fileName, "XXXX_activity.qfx");
  assert.deepEqual(["acct_40-2899-64.qfx", "chk 0040 2899 64 nov.qfx", `Statement ${TEN_DIGITS}.qfx`, "Chase1234_Activity.QFX", "statement.ofx"].map((n) => safeFileName(n, ["9964", "1234"])), ["acct_XXXX.qfx", "chk XXXX nov.qfx", "Statement XXXX.qfx", "ChaseXXXX_Activity.QFX", "statement.ofx"]);
  assert.equal(scrubNumbers("TO ACCT 40281234 REF 77", ["40281234"]), "TO ACCT ... REF 77");
  assert.equal(scrubNumbers("KROGER #412 CHECK 1042", [ACCT]), "KROGER #412 CHECK 1042", "store numbers and check numbers stay");
});

test("M1 / P5 / B4: Undo of an import puts back the balance it set: the figure, its date, that day's point and a guess", () => {
  // the bank's date is the date already on file: the old figure would be gone from the history
  const p = jamie(); p.accounts[1].asOf = "2026-11-12";
  const before = JSON.parse(JSON.stringify(p.accounts));
  const prep = prepareOfx(p, TEN, { today: TODAY });
  const undo = setBalanceFromFile(p, prep.balance);
  assert.deepEqual(undo, { was: 3000, wasAsOf: "2026-11-12", set: 4512.36, setAsOf: "2026-11-12" });
  p.imports.push(importRecord(prep, { id: "im1", at: "2026-11-12T10:00:00Z", accountId: "chk", fileName: "x.qfx", balance: undo }));
  assert.equal(p.accounts[1].balance, 4512.36);
  assert.deepEqual(canUndoBalance(p, p.imports[0]), { accountId: "chk", was: 3000, wasAsOf: "2026-11-12" });
  assert.equal(undoBalance(p, p.imports[0]), true);
  assert.deepEqual(p.accounts, before, "the accounts are as they were");
  // an older balance on file: kept as a point by the import, and gone again after Undo; a guess comes back
  const q = jamie();
  q.guesses = { "accounts[chk].balance": { k: "account.cash.balance", v: 3000, u: "total", s: 0.5, at: "2026-11-11", d: null } };
  const was = JSON.parse(JSON.stringify(q));
  const r = prepareOfx(q, TEN, { today: TODAY });
  const u = setBalanceFromFile(q, r.balance);
  assert.equal(u.kept, true); assert.deepEqual(q.accounts[1].history, [{ date: "2026-11-11", balance: 3000 }, { date: "2026-11-12", balance: 4512.36 }]); assert.equal(q.guesses, undefined);
  const im = importRecord(r, { id: "im1", at: "x", accountId: "chk", fileName: "x.qfx", balance: u });
  assert.equal(undoBalance(q, im), true);
  assert.deepEqual(q.accounts, was.accounts); assert.deepEqual(q.guesses, was.guesses);
  // a balance the person changed after the import is theirs: Undo leaves it
  const s = jamie(); const sr = prepareOfx(s, TEN, { today: TODAY }); const su = setBalanceFromFile(s, sr.balance);
  s.accounts[1].balance = 4000;
  const sim = importRecord(sr, { id: "im1", at: "x", accountId: "chk", fileName: "x.qfx", balance: su });
  assert.equal(canUndoBalance(s, sim), null); assert.equal(undoBalance(s, sim), false); assert.equal(s.accounts[1].balance, 4000);
  // a card: what is owed, with the stored sign
  const c = plan([{ id: "v", name: "Maple card", type: "credit", balance: -640, asOf: "2026-10-01", history: [] }]);
  const cr = prepareOfx(c, cardFile(), { today: TODAY }); const cu = setBalanceFromFile(c, cr.balance);
  assert.equal(c.accounts[0].balance, -6522.17);
  assert.deepEqual(canUndoBalance(c, { accountId: "v", balance: cu }), { accountId: "v", was: 640, wasAsOf: "2026-10-01" });
  undoBalance(c, { accountId: "v", balance: cu });
  assert.deepEqual(c.accounts[0], { id: "v", name: "Maple card", type: "credit", balance: -640, asOf: "2026-10-01", history: [] });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, txKey, monthOf, monthLabel, isTransfer, coverage, monthCover, COVER_SLACK, signedAmount, directionOf } from "./compute.js";
import { samplePlan } from "../../../qa/fixtures/sample-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `${a} != ${b}`);

test("a line typed by hand: the direction gives the sign, a typed minus is always money out (stress test T3)", () => {
  assert.equal(signedAmount("out", 4.5), -4.5);
  assert.equal(signedAmount("in", 4.5), 4.5);
  assert.equal(signedAmount("in", -45.2), -45.2);     // a typed minus wins
  assert.equal(signedAmount("out", -45.2), -45.2);
  assert.equal(signedAmount(undefined, 1200), -1200); // no choice reads as money out, the common case
  assert.equal(signedAmount("out", 0), 0); assert.equal(signedAmount("in", null), null); assert.equal(signedAmount("out", "x"), null);
  assert.equal(directionOf(15.49), "in"); assert.equal(directionOf(-15.49), "out"); assert.equal(directionOf(0), "out");
});

test("helpers: key, month, label, transfer", () => {
  assert.equal(txKey({ accountId: "chk", date: "2026-09-02", amount: -42.174, payee: "x", rawPayee: "AMAZON MKTPL*2K3 AMZN.COM/BILL WA" }), "chk|2026-09-02|-42.17|amazon mktpl amzn wa");
  assert.equal(monthOf("2026-09-15"), "2026-09"); assert.equal(monthLabel("2026-09"), "Sep 2026"); assert.equal(monthLabel("x"), "x");
  const p = samplePlan();
  assert.equal(isTransfer(p.transactions.find((t) => t.id === "t7"), p), true);
  assert.equal(isTransfer(p.transactions.find((t) => t.id === "t4"), p), false);
});
test("empty plan", () => {
  const d = compute(emptyPlan());
  assert.equal(d.total, 0); assert.equal(d.rows.length, 0); assert.equal(d.in, 0); assert.deepEqual(d.months, []);
});
test("all transactions, newest first, totals exclude transfers, months and accounts listed", () => {
  const p = samplePlan();
  const d = compute(p);
  assert.equal(d.total, 16); assert.equal(d.matched, 16); assert.equal(d.shown, 16); assert.equal(d.hasMore, false);
  assert.equal(d.rows[0].date, "2026-09-15");
  near(d.in, 1950 * 3 + 640.22);
  near(d.out, 1500 + 86.40 + 54.12 + 15.49 + 640.22 + 42.17 + 42.17 + 1500 + 48 + 60);
  assert.deepEqual(d.months.map((m) => m.ym), ["2026-09", "2026-08"]);
  assert.equal(d.months[0].count, 12);
  assert.equal(d.accounts[0].name, "Chase checking"); assert.equal(d.accounts[0].count, 12);
  assert.equal(d.uncategorisedAll, 4);
  assert.equal(d.rows.find((r) => r.id === "t4").categoryLabel, "Groceries");
  assert.equal(d.rows.find((r) => r.id === "t7").transfer, true);
});
test("filters: month, account, uncategorized, search; paging", () => {
  const p = samplePlan();
  let d = compute(p, { month: "2026-08" });
  assert.equal(d.matched, 4); near(d.in, 1950); near(d.out, 1608);
  d = compute(p, { accountId: "visa" });
  assert.equal(d.matched, 3);
  d = compute(p, { category: "none" });
  assert.equal(d.matched, 4); assert.equal(d.uncategorised, 4);
  d = compute(p, { category: "groceries" });
  assert.equal(d.matched, 3);
  d = compute(p, { q: "kroger" });
  assert.equal(d.matched, 3);
  d = compute(p, { limit: 5 });
  assert.equal(d.shown, 5); assert.equal(d.hasMore, true);
  d = compute(p, { limit: 5, offset: 15 });
  assert.equal(d.shown, 1); assert.equal(d.hasMore, false);
});
test("coverage: the days the bank files cover; a month is whole when it misses at most 3 days at either end and is over", () => {
  assert.equal(coverage(emptyPlan()), null);
  const p = emptyPlan();
  p.transactions.push({ id: "a", date: "2026-08-12", amount: -1 }, { id: "b", date: "2026-10-29", amount: -1 }, { id: "c", date: "bad", amount: -1 });
  const cov = coverage(p);
  assert.deepEqual(cov, { from: "2026-08-12", to: "2026-10-29" });
  assert.equal(COVER_SLACK, 3);
  const aug = monthCover(cov, "2026-08", "2026-11-01");
  assert.deepEqual([aug.firstDay, aug.lastDay, aug.days, aug.full], [12, 31, 20, false], "starts on the 12th");
  assert.equal(monthCover(cov, "2026-09", "2026-11-01").full, true);
  const oct = monthCover(cov, "2026-10", "2026-11-01");
  assert.deepEqual([oct.lastDay, oct.full], [29, true], "a file cut on the 29th of 31 still counts as the whole month");
  assert.equal(monthCover(cov, "2026-10", "2026-10-30").full, false, "not over yet");
  assert.equal(monthCover({ from: "2026-08-04", to: "2026-10-29" }, "2026-08", null).full, true, "the 4th is within 3 days of the 1st");
  assert.equal(monthCover({ from: "2026-08-05", to: "2026-10-29" }, "2026-08", null).full, false);
  const jul = monthCover(cov, "2026-07", "2026-11-01");
  assert.deepEqual([jul.days, jul.full, jul.from], [0, false, null], "the files do not reach July");
  assert.equal(monthCover(cov, "2026-10", "2026-10-20").lastDay, 20, "never past today");
});

// ---- coverage per account, holes between files, cards whose file is missing (2026-11-02)
import { coverageByAccount, monthHoles, monthGaps, missingCardFiles, cardPayments, unimportedCardLines, CARD_UNIMPORTED, LINE_GAP_DAYS, RHYTHM_DAYS, holeWords, cardWords,
  cardStandIns, gapIssues, markQuiet, isQuietImport, wholeMonth, monthsWords, theCard, MATCH_DAYS, SHORT_DAYS, paymentsTo, firstLineOf,
  quietTooLong, usualInDays, usualPayments, unsureCardPayments, unsureWords, beforeLabel, OWN_DAYS, allUnimportedCardLines } from "./compute.js";
import { cardGapPlan } from "../../../qa/fixtures/card-gap-plan.mjs";

const days = (from, to, step = 1) => { const out = []; for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += step * 864e5) out.push(new Date(t).toISOString().slice(0, 10)); return out; };
const line = (accountId, date, amount = -10, payee = "Kroger", category = "groceries", extra = {}) => ({ id: `${accountId}-${date}-${payee}-${amount}`, accountId, date, amount, payee, rawPayee: payee.toUpperCase(), category, tags: [], note: "", ...extra });
const daily = (accountId, from, to) => days(from, to).map((d) => line(accountId, d));

test("coverageByAccount (re-check 4): days between two files are a hole when more than a quiet spell, or a usual payment is due in them", () => {
  assert.equal(COVER_SLACK, 3); assert.equal(LINE_GAP_DAYS, 31); assert.equal(RHYTHM_DAYS, 5); assert.equal(SHORT_DAYS, 7);
  assert.deepEqual([quietTooLong(8, 1), quietTooLong(7, 1), quietTooLong(9, 5), quietTooLong(11, 5), quietTooLong(30, null)], [true, false, false, true, false]);
  const p = emptyPlan();
  // a line every day: spacing 1; records hold the first and last line dates, so 9/11 to 9/14 (4 quiet days) is no hole
  p.transactions = [...daily("c", "2026-09-01", "2026-09-10"), ...daily("c", "2026-09-15", "2026-09-30")];
  p.imports = [{ id: "a", accountId: "c", from: "2026-09-01", to: "2026-09-10" }, { id: "b", accountId: "c", from: "2026-09-15", to: "2026-09-30" }];
  const c = coverageByAccount(p).c;
  assert.equal(c.spacing, 1); assert.equal(c.slack, 3);
  assert.deepEqual([c.from, c.to], ["2026-09-01", "2026-09-30"]);
  assert.deepEqual(c.holes, []);
  // the next file from 9/19: 8 days with nothing (more than 7 and more than 2 x 1): a hole; from 9/18 (7 days): none
  p.transactions = [...daily("c", "2026-09-01", "2026-09-10"), ...daily("c", "2026-09-19", "2026-09-30")]; p.imports[1].from = "2026-09-19";
  assert.deepEqual(coverageByAccount(p).c.holes, [{ from: "2026-09-11", to: "2026-09-18", days: 8 }]);
  p.imports[1].from = "2026-09-18"; p.transactions.push(line("c", "2026-09-18"));
  assert.deepEqual(coverageByAccount(p).c.holes, []);
  // a usual payment (rent on the 12th, July to August, $1,000 each) due in 3 quiet days with none of it in September: a hole
  const q = emptyPlan();
  q.transactions = [...daily("c", "2026-07-01", "2026-09-10"), ...daily("c", "2026-09-14", "2026-09-30"), line("c", "2026-07-12", -1000, "OAK ST RENT", "housing"), line("c", "2026-08-12", -1000, "OAK ST RENT", "housing")];
  q.imports = [{ id: "a", accountId: "c", from: "2026-07-01", to: "2026-09-10" }, { id: "b", accountId: "c", from: "2026-09-14", to: "2026-09-30" }];
  assert.deepEqual(usualInDays(q, "c", "2026-09-11", "2026-09-13"), [{ name: "your rent", day: 12, out: true, amount: 1000 }]);
  assert.deepEqual(coverageByAccount(q).c.holes, [{ from: "2026-09-11", to: "2026-09-13", days: 3 }]);
  // paid on 9/9 instead (a line of it in September): nothing usual is missing, no hole
  q.transactions.push(line("c", "2026-09-09", -1000, "OAK ST RENT", "housing"));
  assert.deepEqual(coverageByAccount(q).c.holes, []);
  // overlapping or back-to-back files never leave a hole
  p.imports = [{ accountId: "c", from: "2026-09-01", to: "2026-09-20" }, { accountId: "c", from: "2026-09-21", to: "2026-09-30" }];
  assert.deepEqual(coverageByAccount(p).c.holes, []);
});

test("coverageByAccount: lines with no import record are one run until a month with nothing; next to a file the one hole rule applies", () => {
  const p = emptyPlan();
  // a quiet week inside lines with no record is not a hole (no file edge is known there)
  p.transactions = ["2026-07-01", "2026-07-02", "2026-07-06", "2026-07-10", "2026-07-21", "2026-07-27"].map((d) => line("c", d));
  assert.deepEqual(coverageByAccount(p).c.holes, []);
  // more than LINE_GAP_DAYS (31) with nothing: 7/27 -> 8/28 is 32 days, so 7/28 to 8/27 (31 days) are missing; 7/27 -> 8/27 (31) is not
  p.transactions.push(line("c", "2026-08-28"));
  assert.deepEqual(coverageByAccount(p).c.holes, [{ from: "2026-07-28", to: "2026-08-27", days: 31 }]);
  p.transactions = p.transactions.filter((t) => t.date !== "2026-08-28"); p.transactions.push(line("c", "2026-08-27"));
  assert.deepEqual(coverageByAccount(p).c.holes, []);
  // July's lines (no record) to 7/30, then a file from 8/3: 3 quiet days, a quiet spell (re-check 4)...
  const q = emptyPlan();
  q.transactions = [...daily("c", "2026-07-01", "2026-07-30"), ...daily("c", "2026-08-03", "2026-10-31").map((t) => ({ ...t, importId: "f" }))];
  q.imports = [{ id: "f", accountId: "c", from: "2026-08-03", to: "2026-10-31" }];
  assert.deepEqual(coverageByAccount(q).c.holes, []);
  // ...until the file's mortgage of the 2nd (September, October; the same amount twice is a usual payment, and a month before its
  // first line it is due too, USUAL_REACH) is due in them with none of it in August: 7/31 to 8/2 are missing
  q.transactions.push(...["2026-09-02", "2026-10-02"].map((d) => line("c", d, -1980, "HOME MTG", "housing")));
  assert.deepEqual(coverageByAccount(q).c.holes, [{ from: "2026-07-31", to: "2026-08-02", days: 3 }]);
  q.imports[0].from = "2026-08-02"; q.transactions.push(line("c", "2026-08-02", -1980, "HOME MTG", "housing"));
  assert.deepEqual(coverageByAccount(q).c.holes, [], "August's mortgage is on file");
});

test("coverageByAccount: a sparse account is judged by its own spacing; a few lines have no rhythm (a month with nothing only)", () => {
  const p = emptyPlan();
  // savings: a line on the 16th of each month (spacing about 30, slack 2 x 30 = 60): two files a month apart are not holed
  p.transactions = ["2026-01-16", "2026-02-16", "2026-03-16", "2026-04-16", "2026-05-16", "2026-06-16"].map((d) => line("s", d, 400, "Transfer from checking", "transfer"));
  p.imports = [{ accountId: "s", from: "2026-01-16", to: "2026-03-16" }, { accountId: "s", from: "2026-04-16", to: "2026-06-16" }];
  const s = coverageByAccount(p).s;
  assert.equal(s.spacing, 31, "gaps 31, 28, 31, 30, 31: the median is 31"); assert.equal(s.slack, 62);
  assert.deepEqual(s.holes, []);
  // two lines only: no rhythm, slack LINE_GAP_DAYS
  const q = emptyPlan();
  q.transactions = [line("s", "2026-09-06"), line("s", "2026-09-20")];
  q.imports = [{ accountId: "s", from: "2026-09-06", to: "2026-09-06" }, { accountId: "s", from: "2026-09-20", to: "2026-09-20" }];
  const t = coverageByAccount(q).s;
  assert.equal(t.spacing, null); assert.equal(t.slack, LINE_GAP_DAYS); assert.deepEqual(t.holes, []);
});

test("monthCover takes one account's coverage: a hole inside the month makes it not whole; monthHoles names the account", () => {
  const p = emptyPlan();
  p.accounts = [{ id: "c", name: "Checking", type: "checking", balance: 0 }];
  p.transactions = [...daily("c", "2026-09-01", "2026-09-10"), ...daily("c", "2026-09-20", "2026-10-31")];
  p.imports = [{ accountId: "c", from: "2026-09-01", to: "2026-09-10" }, { accountId: "c", from: "2026-09-20", to: "2026-10-31" }];
  const c = coverageByAccount(p).c;
  const sep = monthCover(c, "2026-09", "2026-11-02");
  assert.equal(sep.full, false); assert.deepEqual(sep.holes.map((h) => [h.from, h.to, h.days]), [["2026-09-11", "2026-09-19", 9]]);
  assert.equal(monthCover(coverage(p), "2026-09", "2026-11-02").full, true, "the span alone still reaches both ends");
  assert.equal(monthCover(c, "2026-10", "2026-11-02").full, true);
  assert.deepEqual(monthHoles(p, "2026-09", "2026-11-02").map((h) => [h.name, h.from, h.to]), [["Checking", "2026-09-11", "2026-09-19"]]);
  assert.deepEqual(monthHoles(p, "2026-10", "2026-11-02"), []);
  // a hole across two months is clipped to each, and keeps the whole span for the words
  const q = emptyPlan();
  q.accounts = [{ id: "c", name: "Chase checking", type: "checking", balance: 0 }];
  q.transactions = [...daily("c", "2026-07-01", "2026-07-25"), ...daily("c", "2026-08-03", "2026-08-31")];
  q.imports = [{ accountId: "c", from: "2026-08-03", to: "2026-08-31" }];
  const jul = monthHoles(q, "2026-07", "2026-11-02"), aug = monthHoles(q, "2026-08", "2026-11-02");
  assert.deepEqual([jul[0].from, jul[0].to, jul[0].days], ["2026-07-26", "2026-07-31", 6]);
  assert.deepEqual([aug[0].from, aug[0].to, aug[0].days], ["2026-08-01", "2026-08-02", 2]);
  assert.deepEqual(aug[0].whole, { from: "2026-07-26", to: "2026-08-02", days: 8 });
  assert.equal(holeWords(aug[0]), "Chase checking has no lines from 7/26 to 8/2: bring in a file that covers those days, or add them by hand.");
  // with the usual payments due in it (re-check 4: the Monthly review's step names them, as the Import page's warning does)
  assert.equal(holeWords(aug[0], [{ name: "your mortgage", day: 2, out: true }, { name: "a paycheck", day: 1, out: false }]),
    "Chase checking has no lines from 7/26 to 8/2 (your mortgage usually goes out on the 2nd and a paycheck on the 1st): bring in a file that covers those days, or add them by hand.");
});

function cards() {
  const p = emptyPlan();
  p.accounts = [
    { id: "chk", name: "Chase checking", type: "checking", institution: "Chase", balance: 5000 },
    { id: "sav", name: "Ally savings", type: "savings", institution: "Ally", balance: 9000 },
    { id: "visa", name: "Visa card", type: "credit", institution: "Chase", balance: 2000 },
    { id: "amex", name: "Amex Blue", type: "credit", institution: "American Express", balance: 300 },
    { id: "car", name: "Car loan", type: "loan", institution: "Toyota", balance: 9000 },
  ];
  p.transactions = [
    line("chk", "2026-10-14", -500, "CHASE CREDIT CRD AUTOPAY", "transfer"),        // to the Visa: Chase is its bank, and card words
    line("chk", "2026-10-20", -120.5, "AMEX EPAYMENT ACH PMT", "transfer"),         // to the Amex: its own name
    line("chk", "2026-10-05", -75, "CREDIT CARD PAYMENT", "transfer"),              // a card, no name: the one with no lines this month
    line("chk", "2026-10-16", -400, "Online Transfer to SAV", "transfer"),          // money to savings: not a card
    line("chk", "2026-10-25", -60, "Zelle payment to Ana", "transfer"),             // to a person: not a card
    line("chk", "2026-10-12", -410, "TOYOTA MOTOR CREDIT PMT", "transfer"),         // a loan filed as a transfer: not a card
    line("chk", "2026-10-18", -999, "CHASE CREDIT CRD AUTOPAY", "debt"),            // filed as spending already: not counted again
    line("chk", "2026-10-22", -300, "ONLINE PAYMENT", "transfer", { transferId: "x1" }), line("sav", "2026-10-22", 300, "ONLINE PAYMENT", "transfer", { transferId: "x1" }),
    line("amex", "2026-10-09", -35, "BOOKSHOP", "shopping"),
    line("chk", "2026-10-01", 3000, "PAYROLL", "income-salary"),
  ];
  return p;
}
test("missingCardFiles: a card with no lines in the month and what went to it from checking (hand-worked: $500; the unnamed $75 counts once)", () => {
  const p = cards();
  // "CHASE CREDIT CRD AUTOPAY": a card word, two cards it could be, only the Visa at Chase; "AMEX EPAYMENT": the Amex's network;
  // "CREDIT CARD PAYMENT": either card, named by none: unsure, it stands in for neither (re-check 2026-11-02, rule 3)
  const pays = cardPayments(p, "2026-10").map((x) => [x.t.payee, x.cardId, x.maybe ?? null]).sort();
  assert.deepEqual(pays, [["AMEX EPAYMENT ACH PMT", "amex", null], ["CHASE CREDIT CRD AUTOPAY", "visa", null], ["CREDIT CARD PAYMENT", null, ["visa", "amex"]]]);
  const m = missingCardFiles(p, "2026-10", { today: "2026-11-02" });
  assert.equal(m.length, 1, "the Amex has a line in October: its file is in");
  assert.deepEqual([m[0].accountId, m[0].name, m[0].paid, m[0].from, m[0].unsure], ["visa", "Visa card", 500, ["chk"], undefined]);
  assert.deepEqual(m[0].lines.map((t) => t.amount), [-500]);
  // the other side of a transferId says where it went: a payment linked to the Visa's own line means its file is in
  p.transactions.push(line("chk", "2026-10-28", -200, "PAYMENT", "transfer", { transferId: "y1" }), line("visa", "2026-10-28", 200, "PAYMENT THANK YOU", "transfer", { transferId: "y1" }));
  assert.deepEqual(missingCardFiles(p, "2026-10", { today: "2026-11-02" }), []);
  assert.deepEqual(cardPayments(p, "2026-10").filter((x) => x.t.transferId === "y1").map((x) => x.cardId), ["visa"]);
});
test("missingCardFiles: only a card money went to; a card with a few lines never 'stops early'; a daily one does, and quiet days clear it", () => {
  const p = emptyPlan();
  p.accounts = [{ id: "chk", name: "Checking", type: "checking", balance: 1 }, { id: "v", name: "Credit card", type: "credit", balance: 1 }];
  p.transactions = [line("v", "2026-09-03", -20, "CAFE", "dining"), line("chk", "2026-10-02", -5, "x", "groceries"), line("chk", "2026-11-01", -5, "x", "groceries")];
  // nothing paid to it in October: not a missing card file (its purchases are not known to be missing; review 2026-11-02)
  assert.deepEqual(missingCardFiles(p, "2026-10", { today: "2026-11-02" }), []);
  // one line: fewer than RHYTHM_DAYS days of lines, so no rhythm to judge it by, and never "lines stop early" (re-check rule 5)
  const g = monthGaps(p, "2026-10", "2026-11-02");
  assert.deepEqual([g.short, g.holes, g.whole], [[], [], true]);
  // a card with a line every day Sep 1 to Oct 10: 21 days with nothing before the 31st (more than 2 x 1 and more than 7)
  const d = emptyPlan();
  d.accounts = [{ id: "chk", name: "Checking", type: "checking", balance: 1 }, { id: "v", name: "Credit card", type: "credit", balance: 1 }];
  d.transactions = [...days("2026-09-01", "2026-10-10").map((x) => line("v", x, -20, "CAFE", "dining")), ...daily("chk", "2026-09-01", "2026-11-01")];
  const h = monthGaps(d, "2026-10", "2026-11-02");
  assert.deepEqual(h.short, [{ accountId: "v", name: "Credit card", to: "2026-10-10" }]); assert.equal(h.whole, false);
  assert.deepEqual(gapIssues(d, h, "2026-10")[0], { accountId: "v", kind: "short", text: "Credit card's lines stop on 10/10: bring in the rest of October.", why: "Credit card's lines stop on 10/10", quiet: { accountId: "v", from: "2026-10-11", to: "2026-10-31" } });
  assert.deepEqual(monthGaps(d, "2026-12", "2026-12-31").short.filter((s) => s.accountId === "v"), [], "the card is not asked about in December (nothing since October)");
  // "Nothing happened 10/11 to 10/31": an import entry with no lines covers those days
  const q = markQuiet(JSON.parse(JSON.stringify(d)), { ...gapIssues(d, h, "2026-10")[0].quiet, at: "2026-11-02T10:00:00.000Z", id: "q1" });
  assert.deepEqual(q.imports, [{ id: "q1", at: "2026-11-02T10:00:00.000Z", accountId: "v", fileName: "", rows: 0, added: 0, skipped: 0, bad: 0, from: "2026-10-11", to: "2026-10-31" }]);
  assert.ok(isQuietImport(q.imports[0]));
  assert.deepEqual(monthGaps(q, "2026-10", "2026-11-02").short, []); assert.equal(monthGaps(q, "2026-10", "2026-11-02").whole, true);
  assert.deepEqual(missingCardFiles(p, "2026-10", { today: "2026-10-20" }), [], "October still running and nothing went to it");
  p.transactions.push(line("chk", "2026-10-14", -88, "CARD PAYMENT", "transfer"));
  assert.equal(missingCardFiles(p, "2026-10", { today: "2026-10-20" })[0].paid, 88);
  assert.equal(cardWords(p, missingCardFiles(p, "2026-10", { today: "2026-11-02" })[0], "2026-10", (n) => `$${n}`), "Credit card: $88 went to it from checking in October, but its own file isn't in, so what you bought on it is missing. Bring in that card's file.");
});
test("unimportedCardLines: one stand-in spending line per payment while the card's file is missing, gone once it has lines", () => {
  const p = cards();
  const st = unimportedCardLines(p, "2026-10");
  assert.deepEqual(st.map((t) => [t.date, t.amount, t.category, t.cardId, t.payee, t.synthetic, t.before]), [
    ["2026-10-14", -500, CARD_UNIMPORTED, "visa", "Visa card, details not imported yet", true, false]]);
  assert.equal(isTransfer(st[0], p), false, "the stand-in is spending");
  assert.ok(!p.transactions.some((t) => t.category === CARD_UNIMPORTED), "never stored in the plan");
  p.transactions.push(line("visa", "2026-10-03", -42, "GROCER", "groceries"));
  assert.deepEqual(unimportedCardLines(p, "2026-10"), []);
});
test("monthGaps: an account whose lines stop early is named; one closed long ago is not", () => {
  const p = emptyPlan();
  p.accounts = [{ id: "a", name: "Checking", type: "checking", balance: 1 }, { id: "b", name: "Second checking", type: "checking", balance: 1 }, { id: "z", name: "Old account", type: "checking", balance: 1 }];
  p.transactions = [...daily("a", "2026-09-01", "2026-10-31"), ...days("2026-09-01", "2026-10-20", 2).map((d) => line("b", d)), ...days("2026-06-01", "2026-07-31", 2).map((d) => line("z", d))];
  const g = monthGaps(p, "2026-10", "2026-11-02");
  // b: a line every 2 days from 9/1 (slack 4), its last on 10/19: 12 days before the 31st
  assert.deepEqual(g.short, [{ accountId: "b", name: "Second checking", to: "2026-10-19" }]);
  assert.deepEqual(g.holes, []); assert.deepEqual(g.cards, []);
  // stopping early needs more than 2 x its spacing (4 days) and more than SHORT_DAYS (7) days (re-check rule 5)
  assert.equal(SHORT_DAYS, 7);
  assert.deepEqual(monthGaps(p, "2026-10", "2026-10-24").short, [], "October still running: 10/19 is 5 days before today, not more than 7");
  assert.deepEqual(monthGaps(p, "2026-10", "2026-10-26").short, [], "7 days: not more than 7");
  assert.deepEqual(monthGaps(p, "2026-10", "2026-10-27").short.map((s) => s.accountId), ["b"], "8 days: more than 7 and more than 4");
  // the days that can be marked "nothing happened" stop at today in the month still running, never in the future (review)
  assert.deepEqual(gapIssues(p, monthGaps(p, "2026-10", "2026-10-27"), "2026-10")[0].quiet, { accountId: "b", from: "2026-10-20", to: "2026-10-27" });
  assert.deepEqual(gapIssues(p, g, "2026-10")[0].quiet, { accountId: "b", from: "2026-10-20", to: "2026-10-31" });
});
test("the sample family back after three months: Chase has a hole 7/31 to 8/2, so August is not whole for it; the Visa's file is missing", () => {
  const T = "2026-11-02";
  const p = cardGapPlan(T);
  const chk = coverageByAccount(p)["a-chk"];
  assert.deepEqual(chk.holes, [{ from: "2026-07-31", to: "2026-08-02", days: 3 }]);
  assert.equal(monthCover(coverage(p), "2026-08", T).full, true, "the files together span August (the old check)");
  assert.equal(monthCover(chk, "2026-08", T).full, false, "Chase misses the 1st and the 2nd");
  assert.equal(monthCover(chk, "2026-09", T).full, true);
  const oct = missingCardFiles(p, "2026-10", { today: T });
  assert.deepEqual(oct.map((c) => [c.accountId, c.paid]), [["a-visa", 2610.3]]);
  assert.deepEqual(["2026-07", "2026-08", "2026-09"].map((ym) => missingCardFiles(p, ym, { today: T })[0].paid), [640.22, 2450.22, 2980.55]);
});

// ---- round-5 review of the card patch (2026-11-02): two cards at one bank, other accounts' payments, money back, partial files
test("cardPayments: two cards at one bank are told apart by the card's own line of the same amount; only the other one stands in", () => {
  // hand-worked (math review 1): Freedom's October file is in (31 x $20 and its +$2,610.30 payment on 10/15); the Sapphire has
  // no file. Checking paid -2,610.30 on 10/14 and -800 on 10/20, both "CHASE CREDIT CRD AUTOPAY". The first matches Freedom's
  // own line (same amount, 1 day): a transfer. The second matches nothing, ties on the words, goes to the Sapphire: $800.
  const T = "2026-11-02";
  const p = emptyPlan();
  p.accounts = [{ id: "chk", name: "Chase checking", type: "checking", institution: "Chase", balance: 1 }, { id: "fr", name: "Freedom card", type: "credit", institution: "Chase", balance: 1 }, { id: "sa", name: "Sapphire card", type: "credit", institution: "Chase", balance: 1 }];
  p.transactions = [...days("2026-10-01", "2026-10-31").map((d) => line("fr", d, -20, "OLIVE GARDEN", "dining")), line("fr", "2026-10-15", 2610.3, "AUTOMATIC PAYMENT - THANK", "transfer"),
    line("chk", "2026-10-14", -2610.3, "CHASE CREDIT CRD AUTOPAY", "transfer"), line("chk", "2026-10-20", -800, "CHASE CREDIT CRD AUTOPAY 2", "transfer"), line("chk", "2026-10-01", 5000, "PAYROLL", "income-salary")];
  const pays = cardPayments(p, "2026-10", { today: T });
  assert.deepEqual(pays.map((x) => [x.t.date, x.cardId, x.matched, x.standIn]), [["2026-10-14", "fr", true, false], ["2026-10-20", "sa", false, true]]);
  assert.equal(MATCH_DAYS, 7);
  assert.deepEqual(missingCardFiles(p, "2026-10", { today: T }).map((c) => [c.accountId, c.paid]), [["sa", 800]]);
  // the card's own line 8 days later is past MATCH_DAYS: no match, the tie goes to the card whose file does not cover 10/14
  p.transactions.find((t) => t.accountId === "fr" && t.amount > 0).date = "2026-10-22";
  assert.deepEqual(cardPayments(p, "2026-10", { today: T }).map((x) => x.cardId), ["sa", "sa"]);
});
test("cardPayments: money to your own 529, a loan or a mortgage servicer is never a card's, even with 'payment' in it", () => {
  const p = emptyPlan();
  p.accounts = [{ id: "chk", name: "Chase checking", type: "checking", institution: "Chase", balance: 1 }, { id: "sav", name: "Ally savings", type: "savings", institution: "Ally", balance: 1 },
    { id: "v", name: "Visa card", type: "credit", institution: "Chase", balance: 1 }, { id: "529", name: "Cy's 529", type: "529", institution: "Ohio CollegeAdvantage", balance: 1 }, { id: "car", name: "Car loan", type: "loan", institution: "Honda Financial", balance: 1 }];
  // re-check 2026-11-02 (rule 1): the line must name the card (its name's own words, last four digits, network) or use a card
  // word; a bank's name with "pmt"/"payment" is never enough ("CHASE MOBILE PMT", "JPMORGAN CHASE PAYMENT"), and a loan's or
  // another account's word rules it out ("CHASE HOME LENDING PMT", "CHASE AUTO PMT", "CHASE INVESTMENTS PMT", a 401(k))
  const lines = { "OHIO 529 COLLEGEADV PAYMENT": false, "NAVIENT PAYMENT": false, "HONDA FINANCIAL SVCS PMT": false, "FIDELITY INVESTMENTS PAYMENT": false, "ONLINE PAYMENT 12345 TO MR COOPER": false,
    "HSA BANK CONTRIBUTION PMT": false, "ALLY BANK PAYMENT TO SAVINGS": false, "Online Transfer to SAV ...5566": false, "ZELLE PAYMENT TO ANA": false,
    "CHASE MOBILE PMT": false, "CITI AUTOPAY PAYMENT": false, "JPMORGAN CHASE PAYMENT": false, "CHASE HOME LENDING PMT": false, "CHASE AUTO PMT": false, "CHASE INVESTMENTS PMT": false,
    "ONLINE TRANSFER TO CHASE SAVINGS": false, "CHASE CARD SERVICES 401(K) LOAN": false, "CHASE MORTGAGE CREDIT CARD": false,
    "CHASE CREDIT CRD AUTOPAY": true, "PAYMENT TO CHASE CARD ENDING 1234": true, "APPLECARD GSBANK PAYMENT": true, "VISA ONLINE PMT": true, "CHASE CREDIT CRD AUTO PAY": true };
  p.transactions = Object.keys(lines).map((raw, i) => line("chk", `2026-10-${String(i + 1).padStart(2, "0")}`, -100, raw, "transfer"));
  const hit = new Set(cardPayments(p, "2026-10").map((x) => x.t.payee));
  for (const [raw, card] of Object.entries(lines)) assert.equal(hit.has(raw), card, raw);
  // a card paid from savings: the checking account's name is not the card's ("Chase checking" names Chase, the Visa's bank too)
  p.transactions = [line("sav", "2026-10-14", -500, "CHASE CREDIT CRD EPAY", "transfer")];
  assert.deepEqual(missingCardFiles(p, "2026-10").map((c) => [c.accountId, c.paid, c.from]), [["v", 500, ["sav"]]]);
});
test("cardStandIns: money back from the card comes off what went to it (a returned autopay, a refund), never below 0", () => {
  const T = "2026-11-02";
  const p = emptyPlan();
  p.accounts = [{ id: "chk", name: "Chase checking", type: "checking", institution: "Chase", balance: 1 }, { id: "v", name: "Visa card", type: "credit", institution: "Chase", balance: 1 }];
  // hand-worked (math review 4): -2,610.30 on 10/14, +2,610.30 back on 10/16 (returned), -2,610.30 again on 10/20: paid 2,610.30
  p.transactions = [line("chk", "2026-10-14", -2610.3, "CHASE CREDIT CRD AUTOPAY", "transfer"), line("chk", "2026-10-16", 2610.3, "CHASE CREDIT CRD AUTOPAY RETURN", "transfer"), line("chk", "2026-10-20", -2610.3, "CHASE CREDIT CRD EPAY", "transfer")];
  let s = cardStandIns(p, "2026-10", { today: T });
  assert.deepEqual(s.map((c) => [c.accountId, c.paid, c.lines.map((t) => [t.date, t.amount])]), [["v", 2610.3, [["2026-10-20", -2610.3]]]]);
  near(unimportedCardLines(p, "2026-10", { today: T }).reduce((a, t) => a - t.amount, 0), 2610.3);
  // money in with a card word is a refund of a credit balance from the card (re-check 5, 2026-11-05: round 4 asked for the
  // card's own name words and lost it): "CHASE CARD REFUND" $50 comes off the latest payment, $2,560.30 left
  p.transactions.push(line("chk", "2026-10-25", 50, "CHASE CARD REFUND", "transfer"));
  assert.equal(cardStandIns(p, "2026-10", { today: T })[0].paid, 2560.3);
  // the card named "Visa card 4321" and the refund "CHASE CARD REFUND XXXX4321" ($50, no amount like it): off the latest
  // payment, $2,560.30 left
  p.accounts[1].name = "Visa card 4321"; p.transactions[p.transactions.length - 1] = line("chk", "2026-10-25", 50, "CHASE CARD REFUND XXXX4321", "transfer");
  s = cardStandIns(p, "2026-10", { today: T });
  assert.deepEqual(s[0].lines.map((t) => [t.date, t.amount]), [["2026-10-20", -2560.3]]); assert.equal(s[0].paid, 2560.3);
  // only money back and nothing paid: no stand-in, never negative spending
  p.transactions = [line("chk", "2026-10-25", 50, "CHASE CARD REFUND XXXX4321", "transfer")];
  assert.deepEqual(cardStandIns(p, "2026-10", { today: T }), []);
});
test("a card's file that starts late or stops early: the month is not whole; a payment stands in only before its first line or in a month with none", () => {
  const T = "2026-11-02";
  const p = emptyPlan();
  p.accounts = [{ id: "chk", name: "Chase checking", type: "checking", institution: "Chase", balance: 1 }, { id: "v", name: "Visa card", type: "credit", institution: "Chase", balance: 1 }];
  // checking every day Aug 1 to Oct 31 ($10), the Visa's file from 8/20 to 9/19 ($30 a day, its +2,980.55 payment on 9/15)
  p.transactions = [...days("2026-08-01", "2026-10-31").map((d) => line("chk", d, -10)), line("chk", "2026-08-14", -2450.22, "CHASE CREDIT CRD AUTOPAY", "transfer"), line("chk", "2026-09-14", -2980.55, "CHASE CREDIT CRD AUTOPAY", "transfer"), line("chk", "2026-10-14", -2610.3, "CHASE CREDIT CRD AUTOPAY", "transfer"),
    ...days("2026-08-20", "2026-09-19").map((d) => line("v", d, -30, "OLIVE GARDEN", "dining")), line("v", "2026-09-15", 2980.55, "AUTOMATIC PAYMENT - THANK", "transfer")];
  p.imports = [{ id: "c", accountId: "chk", from: "2026-08-01", to: "2026-10-31" }, { id: "v", accountId: "v", from: "2026-08-20", to: "2026-09-19" }];
  assert.equal(firstLineOf(p, "v"), "2026-08-20");
  // August: the Visa starts on 8/20 (late); the 8/14 payment is dated before its first line ever, so it stands in
  const aug = monthGaps(p, "2026-08", T);
  assert.deepEqual([aug.late, aug.short, aug.holes, aug.cards, aug.whole], [[{ accountId: "v", name: "Visa card", from: "2026-08-20" }], [], [], [], false]);
  assert.equal(gapIssues(p, aug, "2026-08")[0].text, "Visa card's lines start on 8/20: bring in a file from 8/1.");
  assert.deepEqual(gapIssues(p, aug, "2026-08")[0].quiet, { accountId: "v", from: "2026-08-01", to: "2026-08-19" });
  assert.deepEqual(unimportedCardLines(p, "2026-08", { today: T }).map((t) => [t.date, t.amount, t.before]), [["2026-08-14", -2450.22, true]]);
  // ...and money went to the card on 8/14, inside those days: "nothing happened" is never offered for them (rule 4)
  assert.deepEqual(paymentsTo(p, "v", "2026-08-01", "2026-08-19", { today: T }).map((t) => [t.date, t.amount]), [["2026-08-14", -2450.22]]);
  assert.deepEqual(paymentsTo(p, "v", "2026-08-15", "2026-08-19", { today: T }), []);
  // September: the Visa stops on 9/19 (short); the 9/14 payment matches its own 9/15 line: no stand-in
  const sep = monthGaps(p, "2026-09", T);
  assert.deepEqual([sep.short, sep.late, sep.whole], [[{ accountId: "v", name: "Visa card", to: "2026-09-19" }], [], false]);
  assert.deepEqual(unimportedCardLines(p, "2026-09", { today: T }), []);
  // October: no Visa lines, its $2,610.30 stands in: the card is listed (not "short"), and the month is whole
  const oct = monthGaps(p, "2026-10", T);
  assert.deepEqual([oct.cards.map((c) => c.paid), oct.short, oct.whole], [[2610.3], [], true]);
  assert.deepEqual(["2026-08", "2026-09", "2026-10"].map((ym) => wholeMonth(p, ym, T)), [false, false, true]);
  // the late start's days marked as nothing on the card by hand: August is whole, the 8/14 payment (before the first line) still stands in
  const q = markQuiet(JSON.parse(JSON.stringify(p)), { accountId: "v", from: "2026-08-01", to: "2026-08-19" });
  assert.equal(monthGaps(q, "2026-08", T).whole, true); assert.deepEqual(unimportedCardLines(q, "2026-08", { today: T }).map((t) => t.amount), [-2450.22]);
});
// ---- re-check of the card patch (2026-11-02): the findings' own inputs and figures
test("finding 1: payments to a car loan or a mortgage at the card's bank stay transfers (October $5,063.62, the Visa paid $2,610.30)", () => {
  const T = "2026-11-02";
  const p = cardGapPlan(T);
  p.accounts.find((a) => a.id === "a-car").institution = "Chase"; p.accounts.find((a) => a.id === "a-mort").institution = "Chase";
  p.transactions = p.transactions.filter((t) => !(t.date.startsWith("2026-10") && /TOYOTA|HOME MTG/.test(t.rawPayee)));
  p.transactions.push(line("a-chk", "2026-10-02", -1980, "CHASE HOME LENDING PMT", "transfer"), line("a-chk", "2026-10-12", -410, "CHASE AUTO PMT", "transfer"));
  assert.deepEqual(cardPayments(p, "2026-10", { today: T }).map((x) => [x.t.date, x.cardId]), [["2026-10-14", "a-visa"]]);
  assert.deepEqual(missingCardFiles(p, "2026-10", { today: T }).map((c) => [c.accountId, c.paid]), [["a-visa", 2610.3]]);
  // savings and the brokerage at Chase too: "CHASE INVESTMENTS PMT" -$700, "ONLINE TRANSFER TO CHASE SAVINGS", "JPMORGAN CHASE PAYMENT"
  const q = cardGapPlan(T);
  q.accounts.find((a) => a.id === "a-sav").institution = "Chase"; q.accounts.find((a) => a.id === "a-brk").institution = "Chase";
  q.transactions.push(line("a-chk", "2026-10-20", -500, "ONLINE TRANSFER TO CHASE SAVINGS", "transfer"), line("a-chk", "2026-10-21", -700, "CHASE INVESTMENTS PMT", "transfer"), line("a-chk", "2026-10-22", -150, "JPMORGAN CHASE PAYMENT", "transfer"));
  assert.deepEqual(missingCardFiles(q, "2026-10", { today: T }).map((c) => [c.accountId, c.paid]), [["a-visa", 2610.3]]);
});
test("finding 6: two cards at one bank, Freedom's own line for its 10/30 autopay not in its file: it stands in for neither (October $6,263.32)", () => {
  const T = "2026-11-02";
  const p = cardGapPlan(T);
  p.accounts.find((a) => a.id === "a-visa").name = "Freedom card";
  p.accounts.push({ id: "a-sap", name: "Sapphire card", type: "credit", institution: "Chase", balance: 800 });
  p.transactions.push(...days("2026-10-01", "2026-10-31").map((d) => line("a-visa", d, -20, "TRADER JOES", "groceries", { importId: "imp-f" })));
  p.imports.push({ id: "imp-f", accountId: "a-visa", from: "2026-10-01", to: "2026-10-31" });
  p.transactions.find((t) => t.accountId === "a-chk" && t.date === "2026-10-14" && /CRD AUTOPAY/.test(t.rawPayee)).date = "2026-10-30";
  p.transactions.push(line("a-chk", "2026-10-20", -800, "CHASE CREDIT CRD AUTOPAY PPD ID: 999", "transfer"));
  // 10/20 -$800: Freedom's file covers 10/13 to 10/27 with no +$800 on it, so only the Sapphire is left: it stands in.
  // 10/30 -$2,610.30: Freedom's file stops on 10/31, before its card side would post; either card, named by neither: unsure
  assert.deepEqual(cardPayments(p, "2026-10", { today: T }).map((x) => [x.t.date, x.cardId, x.standIn, x.maybe ?? null]),
    [["2026-10-20", "a-sap", true, null], ["2026-10-30", null, false, ["a-visa", "a-sap"]]]);
  assert.deepEqual(missingCardFiles(p, "2026-10", { today: T }).map((c) => [c.accountId, c.paid]), [["a-sap", 800]]);
  near(unimportedCardLines(p, "2026-10", { today: T }).reduce((s, t) => s - t.amount, 0), 800);
  // the Sapphire's payment gone: the unsure one stands in for nothing, keeps October from counting as whole, and is said in
  // one sentence (re-check 4, decision 3)
  p.transactions = p.transactions.filter((t) => t.amount !== -800);
  assert.deepEqual(missingCardFiles(p, "2026-10", { today: T }), []);
  const u = unsureCardPayments(p, "2026-10", { today: T });
  assert.deepEqual([u.paid, u.count, u.maybe, u.cardIds, u.bank], [2610.3, 1, ["a-visa", "a-sap"], ["a-sap"], "Chase"]);
  assert.equal(unsureWords(p, u, "2026-10"), "$2,610 went to one of your Chase cards in October; bring in the Sapphire file to see what it bought");
  const g = monthGaps(p, "2026-10", T);
  assert.deepEqual([g.unsure.paid, g.whole], [2610.3, false]);
  assert.deepEqual(gapIssues(p, g, "2026-10").map((x) => [x.kind, x.cardIds, x.text]), [["unsure", ["a-sap"], ["$2,610 went to one of your Chase cards in October; bring in the Sapphire file to see what it bought."][0]]]);
  assert.deepEqual(unimportedCardLines(p, "2026-10", { today: T }), []);
});
test("finding 4, money 3 (re-check 4): an account with lines on fewer than 5 days never gets a hole, from records or lines, and never stops early", () => {
  const T = "2026-11-02";
  const p = emptyPlan();
  p.accounts = [{ id: "s", name: "Ally savings", type: "savings", balance: 1 }];
  // quarterly interest with no record: 92 days with nothing is not a hole
  p.transactions = [line("s", "2026-07-31", 12, "INTEREST PAID", "income-interest"), line("s", "2026-10-31", 12, "INTEREST PAID", "income-interest")];
  const c = coverageByAccount(p).s;
  assert.deepEqual([c.lineDays, c.spacing, c.holes], [2, null, []]);
  assert.deepEqual(["2026-08", "2026-09", "2026-10"].map((ym) => monthGaps(p, ym, T).whole), [true, true, true]);
  // the same days as two one-line Ally files a quarter (records 7/31-7/31 and 10/31-10/31, what the Import page writes): no
  // hole either; three quarterly files the same
  p.imports = [{ accountId: "s", from: "2026-07-31", to: "2026-07-31" }, { accountId: "s", from: "2026-10-31", to: "2026-10-31" }];
  assert.deepEqual(coverageByAccount(p).s.holes, []);
  assert.deepEqual(["2026-08", "2026-09", "2026-10"].map((ym) => monthGaps(p, ym, T).whole), [true, true, true]);
  p.transactions.push(line("s", "2026-04-30", 12, "INTEREST PAID", "income-interest")); p.imports.push({ accountId: "s", from: "2026-04-30", to: "2026-04-30" });
  assert.deepEqual(coverageByAccount(p).s.holes, []);
  // a record, then a loose line: no hole (one side is a line, not a record)
  p.imports = [{ accountId: "s", from: "2026-07-31", to: "2026-07-31" }];
  assert.deepEqual(coverageByAccount(p).s.holes, []);
});
test("words: months, the card, the slack edge of a late start", () => {
  assert.deepEqual([monthsWords(["2026-07"]), monthsWords(["2026-08", "2026-07"]), monthsWords(["2026-07", "2026-08", "2026-09", "2026-10"]), monthsWords(["2026-07", "2026-08", "2026-10"]), monthsWords(["2025-12", "2026-01"])],
    ["July", "July and August", "July to October", "July, August and October", "December 2025 and January 2026"]);
  assert.deepEqual([theCard("Visa card"), theCard("Ana's Visa"), theCard("My card")], ["the Visa card", "Ana's Visa", "My card"]);
  // a daily account whose lines start on the 8th (7 quiet days) is not late; on the 9th (8 days) it is: the same quiet-spell
  // rule as a stop and a hole (re-check 4)
  const p = emptyPlan();
  p.accounts = [{ id: "c", name: "Checking", type: "checking", balance: 1 }];
  p.transactions = days("2026-10-08", "2026-10-31").map((d) => line("c", d));
  assert.deepEqual(monthGaps(p, "2026-10", "2026-11-02").late, []);
  p.transactions = days("2026-10-09", "2026-10-31").map((d) => line("c", d));
  assert.deepEqual(monthGaps(p, "2026-10", "2026-11-02").late.map((x) => x.from), ["2026-10-09"]);
});
// ---- households with no card file to miss and no real gap: every month is judged as before the card patch (dc6e73c asked
// monthCover(coverage(plan)).full only), and nothing stands in; the re-check's field-by-field comparison, as a guard
test("no card, no real gap: wholeMonth is the old whole-span test for every month, no stand-ins, no issues (the re-check's no-card households)", () => {
  const T = "2026-11-02";
  const noCard = (p) => { p.accounts = p.accounts.filter((a) => a.type !== "credit"); return p; };
  const dropAutopay = (p) => { p.transactions = p.transactions.filter((t) => !/CRD AUTOPAY|CARD AUTOPAY/i.test(t.rawPayee ?? "")); return p; };
  const fromAug = () => { const p = dropAutopay(noCard(cardGapPlan(T))); p.transactions = p.transactions.filter((t) => t.date >= "2026-08-01"); return p; };
  const loose = (id, date, amount, category, raw = "INTEREST PAID") => ({ id, date, amount, payee: raw, rawPayee: raw, accountId: "a-sav", category, tags: [], note: "" });
  const v = [];
  v.push(["90-day file only", fromAug(), T]);
  { const p = fromAug(); p.transactions.push(...["07-31", "08-31", "09-30", "10-31"].map((md, i) => loose(`i${i}`, `2026-${md}`, 4.1 + i, "income-interest")), ...["08-16", "09-16", "10-16"].map((md, i) => loose(`t${i}`, `2026-${md}`, 400, "transfer", "TRANSFER FROM CHASE"))); v.push(["monthly savings, loose lines", p, T]); }
  { const p = fromAug(); p.accounts.push({ id: "a-joint", name: "Joint checking", type: "checking", institution: "Fifth Third", balance: 900 });
    let n = 0; for (const d of days("2026-08-01", "2026-10-31")) if ((Number(d.slice(8, 10)) * 7 + Number(d.slice(5, 7))) % 12 < 5) p.transactions.push({ ...line("a-joint", d, -(5 + (++n % 40)), "CORNER STORE"), importId: "imp-j" });
    const ds = p.transactions.filter((t) => t.accountId === "a-joint").map((t) => t.date).sort(); p.imports.push({ id: "imp-j", accountId: "a-joint", from: ds[0], to: ds[ds.length - 1] }); v.push(["a second checking account every few days", p, T]); }
  v.push(["the month still running (11/20)", fromAug(), "2026-11-20"]);
  { const p = fromAug(); p.transactions.push(loose("q1", "2026-07-31", 12.3, "income-interest"), loose("q2", "2026-10-31", 12.9, "income-interest")); v.push(["quarterly interest on savings", p, T]); }
  { const p = noCard(cardGapPlan(T)); p.transactions = []; p.imports = []; let n = 0;
    for (const m of ["06", "07", "08", "09", "10"]) for (const [d, amt, pay, c] of [["01", 4542, "Payroll", "income-salary"], ["02", -1980, "Mortgage", "housing"], ["05", -150, "Power", "utilities"], ["12", -410, "Toyota", "debt"], ["15", 3900, "Payroll", "income-salary"], ["20", -600, "Kroger", "groceries"], ["27", -80, "Shell", "transport"]]) p.transactions.push({ id: `h${++n}`, date: `2026-${m}-${d}`, amount: amt, payee: pay, rawPayee: pay.toUpperCase(), accountId: "a-chk", category: c, tags: [], note: "" });
    v.push(["typed by hand, 7 lines a month", p, T]); }
  { const p = fromAug(); for (const t of p.transactions) if (/TOYOTA|HOME MTG/.test(t.rawPayee)) t.category = "transfer"; v.push(["loan and mortgage filed as transfers", p, T]); }
  { const p = dropAutopay(cardGapPlan(T)); p.transactions = p.transactions.filter((t) => t.date >= "2026-08-01"); v.push(["a card on file, nothing paid to it", p, T]); }
  { const p = cardGapPlan(T); p.transactions = p.transactions.filter((t) => t.date >= "2026-08-01"); for (const t of p.transactions) if (/CRD AUTOPAY/.test(t.rawPayee)) t.category = "debt"; v.push(["the card's autopay filed as spending", p, T]); }
  { const p = fromAug(); p.transactions.push({ ...line("a-chk", "2026-09-03", -250, "OHIO 529 COLLEGEADV PAYMENT", "transfer") }); v.push(["a 529 transfer", p, T]); }
  for (const [name, p, today] of v) {
    const cov = coverage(p);
    for (const ym of [...new Set(p.transactions.map((t) => t.date.slice(0, 7)))]) {
      assert.equal(wholeMonth(p, ym, today), monthCover(cov, ym, today).full, `${name} ${ym}`);
      // a month that is over has no gap of its own (the month still running stops where the files stop, as before)
      const g = monthGaps(p, ym, today);
      if (ym < today.slice(0, 7)) assert.deepEqual([g.holes, g.short, g.late, g.cards], [[], [], [], []], `${name} ${ym}`);
      assert.deepEqual(unimportedCardLines(p, ym, { today }), [], `${name} ${ym}`);
    }
  }
});

// ---- re-check 4 of the card patch (2026-11-02): the findings' own inputs and figures
test("money 1 (re-check 4): checking imported one file a month (8/3-8/29, 9/1-9/26, 10/1-10/31) has no hole, as one long file", async () => {
  const { noCardFromAug, oneFileAMonth } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const T = "2026-11-02";
  const one = noCardFromAug(cardGapPlan(T)); one.transactions = one.transactions.filter((t) => t.date !== "2026-09-28" && t.date !== "2026-09-30");
  const p = oneFileAMonth(JSON.parse(JSON.stringify(one)), "a-chk");
  assert.deepEqual(p.imports.map((i) => `${i.from}..${i.to}`), ["2026-08-03..2026-08-29", "2026-09-01..2026-09-26", "2026-10-01..2026-10-31", "2026-11-01..2026-11-01"]);
  // 9/27 to 9/30: 4 quiet days, nothing usual due in them (the bills fall on the 1st, 2nd, 3rd, 5th, 9th, 10th, 12th, 21st and 22nd)
  assert.deepEqual(usualInDays(p, "a-chk", "2026-09-27", "2026-09-30"), []);
  assert.deepEqual(coverageByAccount(p)["a-chk"].holes, []);
  assert.deepEqual(["2026-08", "2026-09", "2026-10"].map((ym) => wholeMonth(p, ym, T)), [true, true, true]);
  assert.deepEqual(["2026-08", "2026-09", "2026-10"].map((ym) => wholeMonth(one, ym, T)), [true, true, true]);
  // the usual payments it knows: the file's mortgage of the 2nd and paycheck of the 1st (two or three months each)
  const u = usualPayments(p, p.transactions.filter((t) => t.accountId === "a-chk")).map((x) => [x.rawPayee.slice(0, 22), x.day]).sort();
  assert.ok(u.some(([r, d]) => /HOME MTG/.test(r) && d === 2) && u.some(([r, d]) => /BRIGHTWAY/.test(r) && d === 1));
});
test("money 2 (re-check 4): your own accounts are never cards; wallet and transfer words need the card's own name", async () => {
  const { anAccount: acct, bankLine: tx } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const T = "2026-11-02";
  assert.equal(OWN_DAYS, 3);
  // Discover it card (no file) and Discover savings (its file in: +$500 each 5th): DISCOVER BANK ACH TRANSFER is to savings
  const p = cardGapPlan(T); const v = p.accounts.find((a) => a.id === "a-visa"); v.name = "Discover it card"; v.institution = "Discover";
  for (const t of p.transactions) if (/CRD AUTOPAY|CARD AUTOPAY/i.test(t.rawPayee)) { t.rawPayee = "DISCOVER E-PAYMENT 1234"; t.payee = "Discover E-payment"; }
  p.accounts.push(acct("a-dsav", "Discover savings", "savings", "Discover"));
  for (const [i, d] of ["2026-08-05", "2026-09-05", "2026-10-05"].entries()) p.transactions.push(tx(`ds${i}`, d, -500, "DISCOVER BANK ACH TRANSFER", "a-chk", "transfer"), tx(`dsi${i}`, d, 500, "TRANSFER FROM CHASE", "a-dsav", "transfer"));
  assert.deepEqual(cardPayments(p, "2026-10", { today: T }).map((f) => [f.t.date, f.t.amount, f.cardId]), [["2026-10-14", -2610.3, "a-visa"]]);
  assert.deepEqual(missingCardFiles(p, "2026-10", { today: T }).map((c) => c.paid), [2610.3]);
  near(allUnimportedCardLines(p, { today: T }).reduce((s, t) => s - t.amount, 0), 8681.29);
  // the savings file not in: "...BANK ... TRANSFER" names the bank of another of your accounts that is not a card: a transfer
  p.transactions = p.transactions.filter((t) => t.accountId !== "a-dsav");
  assert.deepEqual(missingCardFiles(p, "2026-10", { today: T }).map((c) => c.paid), [2610.3]);
  // an Amex (American Express) and American Express savings, no savings file: AMERICAN EXPRESS NATIONAL BANK TRANSFER -$500
  const a = cardGapPlan(T); const x = a.accounts.find((y) => y.id === "a-visa"); x.name = "Blue Cash card"; x.institution = "American Express";
  for (const t of a.transactions) if (/CRD AUTOPAY|CARD AUTOPAY/i.test(t.rawPayee)) { t.rawPayee = "AMERICAN EXPRESS ACH PMT W5678"; t.payee = "American Express"; }
  a.accounts.push(acct("a-axsav", "High yield savings", "savings", "American Express"));
  a.transactions.push(tx("axs", "2026-10-05", -500, "AMERICAN EXPRESS NATIONAL BANK TRANSFER", "a-chk", "transfer"));
  assert.deepEqual(missingCardFiles(a, "2026-10", { today: T }).map((c) => c.paid), [2610.3]);
  // PayPal Mastercard and a PayPal account whose file shows the $200 arriving: PAYPAL TRANSFER is to PayPal
  const q = cardGapPlan(T); q.accounts.find((y) => y.id === "a-visa").name = "PayPal Mastercard"; q.accounts.find((y) => y.id === "a-visa").institution = "Synchrony";
  q.accounts.push(acct("a-pp", "PayPal", "checking", "PayPal"));
  q.transactions.push(tx("pp1", "2026-10-08", -200, "PAYPAL TRANSFER", "a-chk", "transfer"), tx("pp2", "2026-10-08", 200, "TRANSFER FROM BANK", "a-pp", "transfer"));
  assert.deepEqual(cardPayments(q, "2026-10", { today: T }).map((f) => f.t.id), ["c64"].map(() => q.transactions.find((t) => t.date === "2026-10-14" && /CRD AUTOPAY/.test(t.rawPayee)).id));
  // Apple Card and Apple Cash (its file shows -$100 on 10/8): +$100 APPLE CASH TRANSFER on 10/9 is from Apple Cash, no refund
  const r = cardGapPlan(T); r.accounts.find((y) => y.id === "a-visa").name = "Apple Card"; r.accounts.find((y) => y.id === "a-visa").institution = "Goldman Sachs";
  r.accounts.push(acct("a-ac", "Apple Cash", "checking", "Green Dot"));
  r.transactions.push(tx("ac1", "2026-10-09", 100, "APPLE CASH TRANSFER", "a-chk", "transfer"), tx("ac2", "2026-10-08", -100, "TRANSFER TO BANK", "a-ac", "transfer"));
  assert.deepEqual(missingCardFiles(r, "2026-10", { today: T }).map((c) => c.paid), [2610.3]);
  // the Chase Visa and +$150 VISA DIRECT VENMO CASHOUT: wallet words, and "Visa" is the network, not the card's own name
  const s = cardGapPlan(T); s.accounts.push(acct("a-venmo", "Venmo", "checking", "Venmo"));
  s.transactions.push(tx("vd1", "2026-10-18", 150, "VISA DIRECT VENMO CASHOUT", "a-chk", "transfer"));
  assert.deepEqual(cardPayments(s, "2026-10", { today: T }).map((f) => f.t.id), [s.transactions.find((t) => t.date === "2026-10-14" && /CRD AUTOPAY/.test(t.rawPayee)).id]);
  assert.deepEqual(missingCardFiles(s, "2026-10", { today: T }).map((c) => c.paid), [2610.3]);
  // money in names the card's own words or last four, or it is no refund of it
  const w = cardGapPlan(T); w.accounts.find((y) => y.id === "a-visa").name = "Freedom card";
  w.transactions.push(tx("rf1", "2026-10-20", 200, "CHASE FREEDOM REFUND", "a-chk", "transfer"), tx("rf2", "2026-10-21", 75, "ZELLE FROM FREEDOM", "a-chk", "transfer"));
  assert.deepEqual(missingCardFiles(w, "2026-10", { today: T }).map((c) => c.paid), [2610.3 - 200 - 75]);
});
test("money 5 and 6 (re-check 4): a bank's name matches whole words only; last four at the end of a word after letters", async () => {
  const { anAccount: acct, bankLine: tx } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const T = "2026-11-02";
  // a Cash Rewards card (Bank of America) and an Amex (American Express), no files: "america" is not "american"
  const p = cardGapPlan(T); p.accounts = p.accounts.filter((a) => a.id !== "a-visa"); p.debts = p.debts.filter((d) => d.accountId !== "a-visa");
  p.transactions = p.transactions.filter((t) => !/CRD AUTOPAY|CARD AUTOPAY/i.test(t.rawPayee));
  p.accounts.push(acct("a-boa", "Cash Rewards card", "credit", "Bank of America"), acct("a-amex", "Amex", "credit", "American Express"));
  p.transactions.push(tx("b1", "2026-10-14", -900, "BANK OF AMERICA CREDIT CARD BILL PAYMENT", "a-chk", "transfer"), tx("b2", "2026-10-22", -300, "AMERICAN EXPRESS ACH PMT", "a-chk", "transfer"));
  assert.deepEqual(cardPayments(p, "2026-10", { today: T }).map((f) => [f.t.amount, f.cardId]), [[-900, "a-boa"], [-300, "a-amex"]]);
  // "Card 4321" at US Bank, paid with US BANK PMT XXXX4321 (also *4321, x4321); an ACH id ending in 4321 is no card's last four
  for (const raw of ["US BANK PMT XXXX4321", "US BANK PMT *4321", "US BANK PMT x4321"]) {
    const q = cardGapPlan(T); const v = q.accounts.find((a) => a.id === "a-visa"); v.name = "Card 4321"; v.institution = "US Bank";
    for (const t of q.transactions) if (/CRD AUTOPAY|CARD AUTOPAY/i.test(t.rawPayee)) { t.rawPayee = raw; t.payee = "US Bank"; }
    assert.deepEqual(missingCardFiles(q, "2026-10", { today: T }).map((c) => [c.accountId, c.paid]), [["a-visa", 2610.3]], raw);
  }
  const z = cardGapPlan(T); const v = z.accounts.find((a) => a.id === "a-visa"); v.name = "Card 9224"; v.institution = "US Bank";
  for (const t of z.transactions) if (/CRD AUTOPAY|CARD AUTOPAY/i.test(t.rawPayee)) { t.rawPayee = "US BANK PMT PPD ID: 889224"; t.payee = "US Bank"; }
  assert.deepEqual(missingCardFiles(z, "2026-10", { today: T }), []);
});
test("pages 3 (re-check 4): on plan3 the Ledger, the Income statement and the Annual review give the same money in, out and kept", async () => {
  const { compute: incomeStatement } = await import("../../cashflow/income-statement/compute.js");
  const { compute: annual } = await import("../../reports/annual-review/compute.js");
  const T = "2026-11-02";
  const p = cardGapPlan(T);
  const l = compute(p, { today: T }), s = incomeStatement(p, { today: T }), a = annual(p, { today: T, year: 2026 });
  // 17,450.25 from the bank lines and 8,681.29 that went to the Visa (its file isn't in): 26,131.54 out; 44,234 in; 18,102.46 kept
  near(l.out, 26131.54); near(l.cardsOut, 8681.29); assert.deepEqual(l.cardsOutNames, ["Visa card"]); near(l.in, 44234); near(l.net, 18102.46);
  near(s.totals.out, l.out); near(a.money.out, l.out); near(s.totals.in, l.in); near(a.money.in, l.in); near(s.totals.net, l.net);
  // a month, and one account: October's 7,453.62; the Visa alone is its stand-ins; a category filter has none
  near(compute(p, { today: T, month: "2026-10" }).out, 7453.62); near(compute(p, { today: T, accountId: "a-visa" }).out, 8681.29);
  near(compute(p, { today: T, month: "2026-10", category: "groceries" }).cardsOut, 0);
  // a refund filed under groceries takes money out down, as on the Income statement
  p.transactions.push({ id: "rf", date: "2026-10-20", amount: 20, payee: "Kroger refund", rawPayee: "KROGER REFUND", accountId: "a-chk", category: "groceries", tags: [], note: "" });
  near(compute(p, { today: T, month: "2026-10" }).out, 7433.62); near(incomeStatement(p, { today: T }).rows.find((r) => r.ym === "2026-10").out, 7433.62);
});
test("pages 4 (re-check 4): a payment before the card's first line says 'before its file starts' in any month before it", async () => {
  const { withVisaFile } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const T = "2026-11-02";
  const p = withVisaFile(cardGapPlan(T), "2026-08-01", "2026-10-31");
  const jul = missingCardFiles(p, "2026-07", { today: T });
  assert.deepEqual(jul.map((c) => [c.paid, c.first, c.before]), [[640.22, "2026-08-01", true]]);
  assert.deepEqual(unimportedCardLines(p, "2026-07", { today: T }).map((t) => [t.payee, t.before]), [["Visa card, before its file starts on 8/1", true]]);
  assert.equal(beforeLabel("Visa card", "2026-08-01"), "Visa card, before its file starts on 8/1");
  assert.equal(cardWords(p, jul[0], "2026-07"), "Visa card: $640 went to it from checking in July, before its file starts on 8/1, so what you bought on it then is missing. Bring in the Visa file for July.");
});

// --- re-check 5 (2026-11-05): "transfer to ... card" is a card's payment again; own-account mates from transfer lines only,
// card-worded lines yield; a refund of a credit balance counts; a wallet account named in the line is that account ---
const AUTOPAY = /CRE?D(IT)? (CRD|CARD) AUTOPAY/i;
const reword = (p, raw, name, institution) => {
  const v = p.accounts.find((a) => a.id === "a-visa"); v.name = name; v.institution = institution;
  for (const t of p.transactions) if (AUTOPAY.test(t.rawPayee)) { t.rawPayee = raw; t.payee = raw; }
  return p;
};
test("re-check 5, defect 1: four ways banks word paying their own card ('transfer to ... card') count as the card's payment", () => {
  const T = "2026-11-02";
  // plan3's October by hand: 4,843.32 from checking's own spending lines + 2,610.30 to the Visa (its file isn't in) = 7,453.62
  for (const [raw, name, bank] of [
    ["TRANSFER TO CREDIT CARD", "Visa card", "Navy Federal"],
    ["ONLINE TRANSFER REF #IBE7Q2 TO WELLS FARGO VISA CARD XXXXXXXXXXXX1234 ON 10/14/26", "Visa card", "Wells Fargo"],
    ["ONLINE TRANSFER TO CITI CARD", "Citi card", "Citi"],
    ["Online Banking transfer to CRD 1234 Confirmation# AB12CD", "Visa card", "Bank of America"],
    ["ONLINE TRANSFER REF #IBE7Q2 TO WELLS FARGO VISA CARD XXXXXXXXXXXX1234 ON 10/14/26", "Visa 1234", "Wells Fargo"],
  ]) {
    const p = reword(cardGapPlan(T), raw, name, bank);
    assert.deepEqual(missingCardFiles(p, "2026-10", { today: T }).map((c) => [c.accountId, c.paid]), [["a-visa", 2610.3]], `${raw} (${name}, ${bank})`);
    near(compute(p, { today: T, month: "2026-10" }).out, 7453.62);
  }
  // "transfer to" with no card word is still money to another account, never a card's ("ONLINE TRANSFER TO DISCOVER")
  const q = reword(cardGapPlan(T), "DISCOVER E-PAYMENT 1234", "Discover it card", "Discover");
  q.transactions.push({ id: "td", date: "2026-10-20", amount: -300, payee: "ONLINE TRANSFER TO DISCOVER", rawPayee: "ONLINE TRANSFER TO DISCOVER", accountId: "a-chk", category: "transfer", tags: [], note: "" });
  assert.deepEqual(missingCardFiles(q, "2026-10", { today: T }).map((c) => c.paid), [2610.3]);
});
test("re-check 5, defect 2: the other side on your own account comes from transfer lines only, and a card-worded line yields", async () => {
  const { anAccount: acct, bankLine: tx } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const T = "2026-11-02";
  // H2: a $3,000 paycheck on a second checking account the day after a $3,000 card payment: a paycheck is never the other side
  const p = cardGapPlan(T); p.accounts.push(acct("a-chk2", "Joint checking", "checking", "Ally"));
  for (const t of p.transactions) if (AUTOPAY.test(t.rawPayee) && t.date.startsWith("2026-10")) t.amount = -3000;
  p.transactions.push(tx("pay2", "2026-10-15", 3000, "ACME PAYROLL", "a-chk2", "income-salary"));
  assert.deepEqual(missingCardFiles(p, "2026-10", { today: T }).map((c) => c.paid), [3000]);
  // H3: $500 to savings and $500 to the card on the same day, savings' file showing one +$500: the savings line takes it, in
  // either order of their ids (a real import's ids are random)
  for (const id of ["s1", "zz-s1"]) {
    const q = cardGapPlan(T); q.accounts.push(acct("a-sav2", "Emergency savings", "savings", "Chase"));
    for (const t of q.transactions) if (AUTOPAY.test(t.rawPayee) && t.date.startsWith("2026-10")) t.amount = -500;
    q.transactions.push(tx(id, "2026-10-14", -500, "ONLINE TRANSFER TO SAV 5678", "a-chk", "transfer"), tx("s1b", "2026-10-14", 500, "ONLINE TRANSFER FROM CHK 1111", "a-sav2", "transfer"));
    assert.deepEqual(cardPayments(q, "2026-10", { today: T }).map((f) => [/^CHASE CREDIT CRD AUTOPAY/.test(f.t.rawPayee), f.t.amount, f.cardId]), [[true, -500, "a-visa"]], id);
    near(compute(q, { today: T, month: "2026-10" }).out, 5343.32);
  }
  // a card-worded line still takes its other side when nothing else could: a card kept as an "other debt" with no card word
  // in its name is one of your own accounts, not a card (the app does not know it as one)
  const r = cardGapPlan(T); r.accounts.push(acct("a-store", "Store account", "other_liability", "Synchrony"));
  r.transactions.push(tx("st1", "2026-10-20", -120, "SYNCHRONY STORE CARD PMT", "a-chk", "transfer"), tx("st2", "2026-10-21", 120, "PAYMENT THANK YOU", "a-store", "transfer"));
  assert.deepEqual(missingCardFiles(r, "2026-10", { today: T }).map((c) => c.paid), [2610.3]);
});
test("re-check 5, defect 3: a refund of a credit balance from the card counts again (card word, money in)", async () => {
  const { bankLine: tx } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const T = "2026-11-02";
  // October: 2,610.30 paid, 200 back: 2,410.30 stands in; 4,843.32 + 2,410.30 = 7,253.62
  const p = cardGapPlan(T); p.transactions.push(tx("r1", "2026-10-20", 200, "CHASE CREDIT CRD REFUND", "a-chk", "transfer"));
  assert.deepEqual(missingCardFiles(p, "2026-10", { today: T }).map((c) => c.paid), [2410.3]);
  near(compute(p, { today: T, month: "2026-10" }).out, 7253.62);
  // September: 2,980.55 paid, 300 back: 8,727.03 - 300 = 8,427.03
  const q = cardGapPlan(T); q.transactions.push(tx("r2", "2026-09-22", 300, "CHASE CREDIT CRD REFUND", "a-chk", "transfer"));
  near(compute(q, { today: T, month: "2026-09" }).out, 8427.03);
  // money in with no card word still needs the card's own name ("ZELLE FROM ANA" is no refund)
  q.transactions.push(tx("r3", "2026-09-23", 80, "ZELLE FROM ANA", "a-chk", "transfer"));
  near(compute(q, { today: T, month: "2026-09" }).out, 8427.03);
});
test("re-check 5, residual: a wallet account named in a transfer line is that account, even with no file of its own", async () => {
  const { anAccount: acct, bankLine: tx } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const T = "2026-11-02";
  // Apple Card and an Apple Cash account (no Apple Cash file): +$100 APPLE CASH TRANSFER is from Apple Cash, no refund
  const p = reword(cardGapPlan(T), "APPLECARD GSBANK PAYMENT", "Apple Card", "Goldman Sachs");
  p.accounts.push(acct("a-ac", "Apple Cash", "checking", "Green Dot"));
  p.transactions.push(tx("ac1", "2026-10-09", 100, "APPLE CASH TRANSFER", "a-chk", "transfer"));
  assert.deepEqual(missingCardFiles(p, "2026-10", { today: T }).map((c) => c.paid), [2610.3]);
  near(compute(p, { today: T, month: "2026-10" }).out, 7453.62);
  // PayPal Mastercard and a PayPal account (no PayPal file): -$200 PAYPAL TRANSFER is to PayPal; "PAYPAL CREDIT PAYMENT" (no
  // transfer word) is still the card's
  const q = cardGapPlan(T); q.accounts.find((a) => a.id === "a-visa").name = "PayPal Mastercard"; q.accounts.find((a) => a.id === "a-visa").institution = "Synchrony";
  q.accounts.push(acct("a-pp", "PayPal", "checking", "PayPal"));
  q.transactions.push(tx("pp1", "2026-10-08", -200, "PAYPAL TRANSFER", "a-chk", "transfer"));
  assert.deepEqual(missingCardFiles(q, "2026-10", { today: T }).map((c) => c.paid), [2610.3]);
  q.transactions.push(tx("pp2", "2026-10-25", -150, "PAYPAL CREDIT PAYMENT", "a-chk", "transfer"));
  assert.deepEqual(missingCardFiles(q, "2026-10", { today: T }).map((c) => c.paid), [2760.3]);
});
// --- verification of re-check 5 (2026-11-05): money from the card into checking is a cash advance unless it says refund; a
// "transfer to" line naming the card by its Visa or Mastercard network is the card's payment; the pairing stays fast ---
test("verify 5, A: money in from a card with no refund word (a cash advance) takes nothing off what the card's payments stand in for", async () => {
  const { bankLine: tx } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const T = "2026-11-02";
  // plan3's October by hand: 4,843.32 + 2,610.30 to the Visa = 7,453.62; a $1,000 cash advance into checking is borrowing, not a refund
  for (const raw of ["TRANSFER FROM CREDIT CARD", "Online Banking transfer from CRD 1234 Confirmation# AB12CD", "CHASE CREDIT CRD CASH ADVANCE"]) {
    const p = cardGapPlan(T); p.transactions.push(tx("adv", "2026-10-20", 1000, raw, "a-chk", "transfer"));
    assert.deepEqual(missingCardFiles(p, "2026-10", { today: T }).map((c) => c.paid), [2610.3], raw);
    near(compute(p, { today: T, month: "2026-10" }).out, 7453.62);
  }
  // a refund of a credit balance still counts: 2,610.30 - 200 = 2,410.30 stands in
  const q = cardGapPlan(T); q.transactions.push(tx("r1", "2026-10-20", 200, "CHASE CREDIT CRD REFUND", "a-chk", "transfer"));
  assert.deepEqual(missingCardFiles(q, "2026-10", { today: T }).map((c) => c.paid), [2410.3]);
});
test("verify 5, B: 'transfer to' naming the card by its Visa or Mastercard network (no card word) is the card's payment; Amex and Discover need more", () => {
  const T = "2026-11-02";
  for (const [raw, name, bank] of [["TRANSFER TO VISA 1234", "Visa card", "Navy Federal"], ["ONLINE XFER TO VISA", "Visa card", "Alliant"], ["ONLINE TRANSFER TO VISA SIGNATURE X1234", "Visa", "PenFed"]]) {
    const p = reword(cardGapPlan(T), raw, name, bank);
    assert.deepEqual(missingCardFiles(p, "2026-10", { today: T }).map((c) => c.paid), [2610.3], raw);
    near(compute(p, { today: T, month: "2026-10" }).out, 7453.62);
  }
  // Amex and Discover are banks with savings accounts too: "ONLINE TRANSFER TO DISCOVER" is still no payment
  const d = reword(cardGapPlan(T), "ONLINE TRANSFER TO DISCOVER", "Discover it", "Discover");
  assert.deepEqual(missingCardFiles(d, "2026-10", { today: T }), []);
});
test("verify 5, C: three years of daily lines: what one Income statement render asks of every month takes well under 1.5 s", async () => {
  const { bankLine: tx, anAccount: acct } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const T = "2026-11-02", p = cardGapPlan(T);
  p.accounts.push(acct("a-amex", "Gold", "credit", "American Express"));
  for (let d = Date.UTC(2023, 10, 1), n = 0; d <= Date.UTC(2026, 6, 31); d += 864e5) {
    const iso = new Date(d).toISOString().slice(0, 10);
    for (let k = 0; k < 3; k++) p.transactions.push(tx(`x${n++}`, iso, -12.5, "KROGER", "a-chk", "groceries"));
    for (let k = 0; k < 2; k++) p.transactions.push(tx(`x${n++}`, iso, -9.5, "TARGET", "a-amex", "shopping"));
    if (iso.endsWith("-14")) p.transactions.push(tx(`x${n++}`, iso, -900, "CHASE CREDIT CRD AUTOPAY", "a-chk", "transfer"));
  }
  const covBy = coverageByAccount(p), yms = [...new Set(p.transactions.map((t) => t.date.slice(0, 7)))];
  const t0 = performance.now();
  for (const ym of yms) { monthGaps(p, ym, T, covBy); monthGaps(p, ym, T, covBy); unimportedCardLines(p, ym, { today: T, covBy }); }
  const ms = performance.now() - t0;
  assert.ok(ms < 1500, `${yms.length} months took ${Math.round(ms)} ms`);
});

test("filter by direction: a spending page's count (money out) matches the Ledger it opens (review N3)", () => {
  const p = samplePlan();
  const both = compute(p, { month: "2026-08" });
  const out = compute(p, { month: "2026-08", dir: "out" }), inn = compute(p, { month: "2026-08", dir: "in" });
  assert.equal(out.matched + inn.matched, both.matched);
  assert.equal(both.matchedIn, inn.matched);
  assert.ok(out.rows.every((t) => t.amount < 0)); assert.ok(inn.rows.every((t) => t.amount > 0));
  assert.equal(out.matchedIn, 0);
  assert.equal(out.matchedOut, out.matched);
  assert.equal(both.matchedIn + both.matchedOut + both.rows.filter((t) => Number(t.amount) === 0).length, both.matched);
});

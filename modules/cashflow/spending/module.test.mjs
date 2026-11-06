import { test } from "node:test";
import assert from "node:assert/strict";
import { compute } from "./compute.js";
import { samplePlan } from "../../../qa/fixtures/sample-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `${a} != ${b}`);

test("empty plan", () => { assert.equal(compute(emptyPlan()).hasData, false); });
test("a month: spending only (no income, no transfers), categories with shares and change, top payees, biggest", () => {
  const p = samplePlan();
  const d = compute(p, { month: "2026-09" });
  assert.equal(d.month, "2026-09"); assert.equal(d.label, "Sep 2026");
  assert.deepEqual(d.months.map((m) => m.ym), ["2026-09", "2026-08"]);
  near(d.total, 1500 + 86.40 + 54.12 + 15.49 + 640.22 + 42.17 + 42.17);
  assert.equal(d.count, 7);
  // the file ends on Sep 15, so September is compared with Aug 1 to 15 only (rent, $1,500), not all of August ($1,608)
  assert.deepEqual(d.sameDays, { lo: 1, hi: 15 });
  assert.equal(d.previous.ym, "2026-08"); near(d.previous.total, 1500);
  near(d.change, (d.total - 1500) / 1500);
  assert.equal(d.byCategory[0].category, "housing"); near(d.byCategory[0].share, 1500 / d.total); near(d.byCategory[0].change, 0);
  const groc = d.byCategory.find((c) => c.category === "groceries");
  near(groc.total, 140.52); near(groc.previous, 0, "no groceries on Aug 1 to 15"); assert.equal(groc.change, null);
  near(d.perDay, d.total / 15);
  const unfiled = d.byCategory.find((c) => c.category === "");
  near(unfiled.total, 15.49 + 640.22 + 42.17);
  assert.equal(d.topPayees[0].payee, "Oak Street Apartments");
  assert.equal(d.biggest[0].payee, "Oak Street Apartments"); assert.equal(d.biggest[1].payee, "Chase Credit Crd Autopay");
  assert.equal(d.daily.length, 6, "six distinct days with spending");
});
test("opens on the latest month the bank files fully cover; an unknown month falls back to it", () => {
  const p = samplePlan();
  const d = compute(p);
  assert.equal(d.month, "2026-08", "September is only covered to the 15th");
  near(d.total, 1608); assert.equal(d.previous, null); assert.equal(d.change, null); assert.equal(d.cover.full, true);
  near(d.perDay, 1608 / 31);
  assert.equal(compute(p, { month: "2020-01" }).month, "2026-08");
  assert.deepEqual(d.months.map((m) => m.full), [false, true]);
});
test("a file cut mid-month: the same days of the month before; months covering no common days have no change", () => {
  const p = emptyPlan();
  const tx = (id, date, amount, category) => ({ id, date, amount, payee: id, accountId: "c", category });
  // a 90-day file downloaded on Oct 12, starting Jul 14: July from the 14th, October to the 12th
  p.transactions.push(tx("j", "2026-07-14", -300, "groceries"), tx("a1", "2026-08-05", -200, "groceries"), tx("a2", "2026-08-25", -400, "groceries"),
    tx("s1", "2026-09-04", -100, "groceries"), tx("s2", "2026-09-20", -900, "groceries"), tx("o1", "2026-10-03", -250, "groceries"), tx("o2", "2026-10-12", -50, "dining"));
  const oct = compute(p, { month: "2026-10", today: "2026-10-12" });
  assert.equal(oct.cover.full, false); assert.equal(oct.cover.days, 12);
  assert.deepEqual(oct.sameDays, { lo: 1, hi: 12 });
  near(oct.previous.total, 100, "Sep 1 to 12: the $100 on the 4th, not the whole $1,000");
  near(oct.change, (300 - 100) / 100);
  near(oct.perDay, 300 / 12);
  assert.equal(compute(p, { today: "2026-10-12" }).month, "2026-09", "opens on September, the latest whole month");
  // August is whole; July only from the 14th: August is compared on the 14th to the 31st
  const aug = compute(p, { month: "2026-08", today: "2026-10-12" });
  assert.deepEqual(aug.sameDays, { lo: 14, hi: 31 });
  near(aug.previous.total, 300); near(aug.previous.current, 400); near(aug.change, (400 - 300) / 300);
  // a file covering Sep 25 to Oct 3 only: October 1 to 3 and September 25 to 30 share no days
  const q = emptyPlan();
  q.transactions.push(tx("x", "2026-09-25", -80, "groceries"), tx("y", "2026-10-03", -60, "groceries"));
  const o = compute(q, { month: "2026-10", today: "2026-10-12" });
  assert.equal(o.noOverlap, true); assert.equal(o.change, null); assert.equal(o.previous, null);
});

// ---- a card whose own file is missing: its payments from checking count as one spending line (2026-11-02)
import { cardGapPlan } from "../../../qa/fixtures/card-gap-plan.mjs";
test("a card with no file this month: what went to it is one line, 'details not imported yet', and goes once its lines are in", () => {
  const p = emptyPlan();
  p.accounts.push({ id: "chk", name: "Checking", type: "checking", balance: 1 }, { id: "visa", name: "Visa card", type: "credit", institution: "Chase", balance: 1 });
  const t = (id, accountId, date, amount, payee, category) => ({ id, accountId, date, amount, payee, rawPayee: payee.toUpperCase(), category, tags: [], note: "" });
  p.transactions.push(t("r", "chk", "2026-10-01", -1500, "Oak Street Apartments", "housing"), t("g", "chk", "2026-10-31", -200, "Kroger", "groceries"),
    t("c", "chk", "2026-10-14", -640, "Chase Credit Crd Autopay", "transfer"), t("s", "chk", "2026-10-16", -400, "Online Transfer to Sav", "transfer"));
  let d = compute(p, { month: "2026-10", today: "2026-11-02" });
  // 1500 + 200 + the $640 card payment; the $400 to savings is still a transfer
  near(d.total, 2340); assert.equal(d.count, 2, "two real lines");
  const card = d.byCategory.find((c) => c.unimported);
  assert.deepEqual([card.category, card.cardId, card.label, card.icon, card.count], ["card-unimported", "visa", "Visa card, details not imported yet", "💳", 1]);
  near(card.total, 640); near(card.share, 640 / 2340);
  assert.deepEqual(d.cards.map((c) => [c.accountId, c.paid]), [["visa", 640]]);
  assert.ok(!d.topPayees.some((x) => /not imported/.test(x.payee)) && !d.biggest.some((x) => x.synthetic), "payees and biggest lines are real lines only");
  // the Visa's own file for October: its purchases count, the payment stays a transfer, the stand-in line is gone
  p.transactions.push(t("v1", "visa", "2026-10-03", -55.5, "Cafe", "dining"), t("v2", "visa", "2026-10-20", -300, "Shoes", "shopping"), t("v3", "visa", "2026-10-15", 640, "Payment Thank You", "transfer"));
  d = compute(p, { month: "2026-10", today: "2026-11-02" });
  near(d.total, 1500 + 200 + 55.5 + 300); assert.equal(d.byCategory.find((c) => c.unimported), undefined); assert.deepEqual(d.cards, []);
});
test("the sample family's October: $4,843.32 from checking plus the Visa's $2,610.30 payment; August says its missing days", () => {
  const T = "2026-11-02";
  const p = cardGapPlan(T);
  const oct = compute(p, { month: "2026-10", today: T });
  near(oct.total, 4843.32 + 2610.3);
  near(oct.byCategory.find((c) => c.unimported).total, 2610.3);
  // compared with September on the same footing: $5,746.48 plus its $2,980.55 payment
  near(oct.previous.total, 5746.48 + 2980.55);
  assert.equal(compute(p, { today: T }).month, "2026-10", "opens on October, the latest whole month with no hole");
  const aug = compute(p, { month: "2026-08", today: T });
  assert.deepEqual(aug.holes.map((h) => [h.name, h.from, h.to, h.whole.from]), [["Chase checking", "2026-08-01", "2026-08-02", "2026-07-31"]]);
  assert.equal(aug.months.find((m) => m.ym === "2026-08").holes, 1);
  assert.equal(aug.months.find((m) => m.ym === "2026-09").holes, 0);
});
// ---- round-5 review (2026-11-02): a card file that starts late; two cards at one bank
test("the Visa's file from 8/20: August keeps the 8/14 payment as its stand-in, says the Visa starts late, and is not whole", async () => {
  const { withVisaFile } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const T = "2026-11-02";
  const p = withVisaFile(cardGapPlan(T), "2026-08-20", "2026-10-31");
  // hand-worked: checking's $3,264.16, 12 Visa dinners of $30 (8/20 to 8/31), and the $2,450.22 paid on 8/14, a day the Visa's file misses
  const aug = compute(p, { month: "2026-08", today: T });
  near(aug.total, 3264.16 + 360 + 2450.22);
  near(aug.byCategory.find((c) => c.unimported).total, 2450.22);
  assert.deepEqual(aug.issues.map((x) => [x.kind, x.text]), [["hole", "Chase checking has no lines from 7/31 to 8/2 (your mortgage usually goes out on the 2nd and a paycheck on the 1st): bring in a file that covers those days, or add them by hand."], ["late", "Visa card's lines start on 8/20: bring in a file from 8/1."]]);
  assert.equal(aug.months.find((m) => m.ym === "2026-08").holes, 2);
  // September and October: the Visa's own lines, its payments matched to its own lines (no stand-in): 5,746.48 + 900, 4,843.32 + 930
  near(compute(p, { month: "2026-09", today: T }).total, 5746.48 + 900);
  const oct = compute(p, { month: "2026-10", today: T });
  near(oct.total, 4843.32 + 930); assert.equal(oct.byCategory.find((c) => c.unimported), undefined); assert.deepEqual(oct.issues, []);
  assert.equal(compute(p, { today: T }).month, "2026-10");
});
test("two cards at one bank: the payment matched to Freedom's own line is a transfer; only the Sapphire's $800 stands in (hand-worked $6,263.32)", () => {
  const T = "2026-11-02";
  const p = cardGapPlan(T);
  p.accounts.find((a) => a.id === "a-visa").name = "Freedom card";
  p.accounts.push({ id: "a-sapph", name: "Sapphire card", type: "credit", institution: "Chase", balance: 800 });
  for (let d = 1; d <= 31; d++) p.transactions.push({ id: `f${d}`, date: `2026-10-${String(d).padStart(2, "0")}`, amount: -20, payee: "Olive Garden", rawPayee: "OLIVE GARDEN 0415", accountId: "a-visa", category: "dining", tags: [], note: "" });
  p.transactions.push({ id: "fp", date: "2026-10-15", amount: 2610.3, payee: "Automatic Payment", rawPayee: "AUTOMATIC PAYMENT - THANK", accountId: "a-visa", category: "transfer", tags: [], note: "" },
    { id: "sp", date: "2026-10-20", amount: -800, payee: "Chase Credit Crd", rawPayee: "CHASE CREDIT CRD AUTOPAY PPD ID: 999", accountId: "a-chk", category: "transfer", tags: [], note: "" });
  p.imports.push({ id: "imp-f", accountId: "a-visa", from: "2026-10-01", to: "2026-10-31" });
  const oct = compute(p, { month: "2026-10", today: T });
  near(oct.total, 4843.32 + 620 + 800);
  assert.deepEqual(oct.cards.map((c) => [c.accountId, c.paid]), [["a-sapph", 800]]);
});
test("money to your own 529 and HSA with 'payment' in the line stays a transfer (hand-worked: October $7,453.62)", () => {
  const T = "2026-11-02";
  const p = cardGapPlan(T);
  p.accounts.push({ id: "a-529", name: "Cy's 529", type: "529", institution: "Ohio CollegeAdvantage", balance: 12000 });
  p.transactions.push({ id: "e1", date: "2026-10-05", amount: -250, payee: "Ohio 529 Collegeadv", rawPayee: "OHIO 529 COLLEGEADV PAYMENT", accountId: "a-chk", category: "transfer", tags: [], note: "" },
    { id: "e2", date: "2026-10-20", amount: -300, payee: "Hsa Bank", rawPayee: "HSA BANK CONTRIBUTION PMT", accountId: "a-chk", category: "transfer", tags: [], note: "" });
  const oct = compute(p, { month: "2026-10", today: T });
  near(oct.total, 7453.62); assert.deepEqual(oct.cards.map((c) => c.paid), [2610.3]);
});
// ---- re-check of the card patch (2026-11-02): the findings' own inputs and figures
test("finding 1: the car loan and mortgage at the Visa's bank, filed as transfers, stay transfers: October $5,063.62", () => {
  const T = "2026-11-02";
  const p = cardGapPlan(T);
  p.accounts.find((a) => a.id === "a-car").institution = "Chase"; p.accounts.find((a) => a.id === "a-mort").institution = "Chase";
  p.transactions = p.transactions.filter((t) => !(t.date.startsWith("2026-10") && /TOYOTA|HOME MTG/.test(t.rawPayee)));
  const tx = (id, date, amount, raw) => ({ id, date, amount, payee: raw, rawPayee: raw, accountId: "a-chk", category: "transfer", tags: [], note: "" });
  p.transactions.push(tx("y2", "2026-10-02", -1980, "CHASE HOME LENDING PMT"), tx("y1", "2026-10-12", -410, "CHASE AUTO PMT"));
  // checking's $4,843.32 less the $1,980 and $410 now filed as transfers ($2,453.32), plus the Visa's $2,610.30
  const oct = compute(p, { month: "2026-10", today: T });
  near(oct.total, 2453.32 + 2610.3); assert.deepEqual(oct.cards.map((c) => [c.accountId, c.paid]), [["a-visa", 2610.3]]);
});
test("finding 2: a payment after the card's file stops, or inside a gap in it, is never counted on top of its purchases", async () => {
  const { withVisaFile } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const T = "2026-11-02";
  // the Visa file 8/1 to 10/10: October = checking's $4,843.32 + 10 dinners of $30; the 10/14 autopay is a transfer
  const e = withVisaFile(cardGapPlan(T), "2026-08-01", "2026-10-10");
  const oct = compute(e, { month: "2026-10", today: T });
  near(oct.total, 5143.32); assert.equal(oct.byCategory.find((c) => c.unimported), undefined);
  assert.deepEqual(oct.issues.map((x) => x.text), ["Visa card's lines stop on 10/10: bring in the rest of October."]);
  // the Visa files 8/1 to 9/10 and 9/20 to 10/31: September = $5,746.48 + 21 dinners of $30, the 9/14 autopay a transfer
  const g = withVisaFile(withVisaFile(cardGapPlan(T), "2026-08-01", "2026-09-10"), "2026-09-20", "2026-10-31");
  const sep = compute(g, { month: "2026-09", today: T });
  near(sep.total, 6376.48); assert.equal(sep.byCategory.find((c) => c.unimported), undefined);
  assert.deepEqual(sep.issues.map((x) => x.kind), ["hole"]);
});
test("finding 6: two cards at one bank, Freedom's 10/30 autopay with its card side not in the file: October $6,263.32", () => {
  const T = "2026-11-02";
  const p = cardGapPlan(T);
  p.accounts.find((a) => a.id === "a-visa").name = "Freedom card";
  p.accounts.push({ id: "a-sap", name: "Sapphire card", type: "credit", institution: "Chase", balance: 800 });
  for (let d = 1; d <= 31; d++) p.transactions.push({ id: `f${d}`, date: `2026-10-${String(d).padStart(2, "0")}`, amount: -20, payee: "TRADER JOES", rawPayee: "TRADER JOES", accountId: "a-visa", category: "groceries", tags: [], note: "", importId: "imp-f" });
  p.imports.push({ id: "imp-f", at: T, accountId: "a-visa", fileName: "f.csv", rows: 31, added: 31, skipped: 0, bad: 0, from: "2026-10-01", to: "2026-10-31" });
  p.transactions.push({ id: "sp1", date: "2026-10-20", amount: -800, payee: "CHASE CREDIT CRD AUTOPAY PPD ID: 999", rawPayee: "CHASE CREDIT CRD AUTOPAY PPD ID: 999", accountId: "a-chk", category: "transfer", tags: [], note: "" });
  p.transactions.find((t) => t.accountId === "a-chk" && t.date === "2026-10-14" && /CRD AUTOPAY/.test(t.rawPayee)).date = "2026-10-30";
  const oct = compute(p, { month: "2026-10", today: T });
  near(oct.total, 6263.32); assert.deepEqual(oct.cards.map((c) => [c.accountId, c.paid]), [["a-sap", 800]]);
});
test("page review 6: September is not compared with an August that misses days (no change, no 'new this month' mortgage)", () => {
  const T = "2026-11-02";
  const sep = compute(cardGapPlan(T), { month: "2026-09", today: T });
  assert.deepEqual(sep.cmpGap, { ym: "2026-08", prev: "2026-08", card: false }); assert.equal(sep.change, null);
  assert.ok(sep.byCategory.every((c) => c.change === null));
  near(sep.previous.total, 3264.16 + 2450.22);
  const oct = compute(cardGapPlan(T), { month: "2026-10", today: T });
  assert.equal(oct.cmpGap, null); near(oct.change, (7453.62 - 8727.03) / 8727.03);
  // a single account's file from the 10th is the files' own start, compared on the same days as before (no gap of its own)
  const p = cardGapPlan(T); p.accounts = p.accounts.filter((a) => a.type !== "credit");
  p.transactions = p.transactions.filter((t) => t.date >= "2026-08-10" && !/CRD AUTOPAY/.test(t.rawPayee)); p.imports[0].from = "2026-08-10";
  const s = compute(p, { month: "2026-09", today: T });
  assert.equal(s.cmpGap, null); assert.deepEqual(s.sameDays, { lo: 10, hi: 30 }); assert.equal(s.months.find((m) => m.ym === "2026-08").holes, 0);
});
test("finding 4: a quiet savings account in a household with no card: Spending still opens on October ($4,843.32)", () => {
  const T = "2026-11-02";
  const p = cardGapPlan(T); p.accounts = p.accounts.filter((a) => a.type !== "credit");
  p.transactions = p.transactions.filter((t) => t.date >= "2026-08-01" && !/CRD AUTOPAY/.test(t.rawPayee));
  for (const [i, d] of ["2026-07-31", "2026-10-31"].entries()) p.transactions.push({ id: `iq${i}`, date: d, amount: 12, payee: "INTEREST PAID", rawPayee: "INTEREST PAID", accountId: "a-sav", category: "income-interest", tags: [], note: "" });
  const d = compute(p, { today: T });
  assert.equal(d.month, "2026-10"); near(d.total, 4843.32); assert.deepEqual(d.issues, []);
});

// --- re-check 4: one rule for holes, own accounts never cards, never count twice ---
const RC4 = "2026-11-02";
const rc4Fix = () => import("../../../qa/fixtures/card-gap-plan.mjs");
const renameCard = (p, name, institution, rawPayee, payee) => {
  const v = p.accounts.find((a) => a.id === "a-visa"); v.name = name; v.institution = institution;
  for (const t of p.transactions) if (/CRD AUTOPAY/.test(t.rawPayee)) { t.rawPayee = rawPayee; t.payee = payee; }
  return p;
};
test("money 2 (re-check 4): money to your own savings or wallet is a transfer, never a card payment (October stays $7,453.62)", async () => {
  const { cardGapPlan, bankLine, anAccount } = await rc4Fix();
  // Discover card + Discover savings: "DISCOVER BANK ACH TRANSFER" -$500 with +$500 on the savings file the same day
  const d = renameCard(cardGapPlan(RC4), "Discover it card", "Discover", "DISCOVER E-PAYMENT 1234", "Discover E-payment");
  d.accounts.push(anAccount("a-dsav", "Discover savings", "savings", "Discover"));
  for (const [i, day] of ["2026-08-05", "2026-09-05", "2026-10-05"].entries()) d.transactions.push(bankLine(`ds${i}`, day, -500, "DISCOVER BANK ACH TRANSFER", "a-chk", "transfer"), bankLine(`dsi${i}`, day, 500, "TRANSFER FROM CHASE", "a-dsav", "transfer"));
  near(compute(d, { month: "2026-10", today: RC4 }).total, 7453.62);
  // the savings file not in: the line says "transfer" and names the savings' bank (Discover Bank), not the card's own name (it)
  d.transactions = d.transactions.filter((t) => t.accountId !== "a-dsav");
  near(compute(d, { month: "2026-10", today: RC4 }).total, 7453.62);
  // Amex card + an American Express savings account: "AMERICAN EXPRESS NATIONAL BANK TRANSFER" -$500, no savings file
  const a = renameCard(cardGapPlan(RC4), "Blue Cash card", "American Express", "AMERICAN EXPRESS ACH PMT W5678", "American Express");
  a.accounts.push(anAccount("a-axsav", "High yield savings", "savings", "American Express"));
  for (const [i, day] of ["2026-08-05", "2026-09-05", "2026-10-05"].entries()) a.transactions.push(bankLine(`axs${i}`, day, -500, "AMERICAN EXPRESS NATIONAL BANK TRANSFER", "a-chk", "transfer"));
  near(compute(a, { month: "2026-10", today: RC4 }).total, 7453.62);
  // Apple Card + Apple Cash: +$100 "APPLE CASH TRANSFER" on checking, -$100 on the Apple Cash file the day before
  const c = renameCard(cardGapPlan(RC4), "Apple Card", "Goldman Sachs", "APPLECARD GSBANK PAYMENT", "Applecard Gsbank");
  c.accounts.push(anAccount("a-ac", "Apple Cash", "checking", "Green Dot"));
  c.transactions.push(bankLine("ac1", "2026-10-09", 100, "APPLE CASH TRANSFER", "a-chk", "transfer"), bankLine("ac2", "2026-10-08", -100, "TRANSFER TO BANK", "a-ac", "transfer"));
  near(compute(c, { month: "2026-10", today: RC4 }).total, 7453.62);
  // a Venmo cash-out through Visa Direct (+$150) is not a refund on the Visa card: it names no card's own words
  const v = cardGapPlan(RC4); v.accounts.push(anAccount("a-venmo", "Venmo", "checking", "Venmo"));
  v.transactions.push(bankLine("vd1", "2026-10-18", 150, "VISA DIRECT VENMO CASHOUT", "a-chk", "transfer"));
  near(compute(v, { month: "2026-10", today: RC4 }).total, 7453.62);
});
test("money 3 (re-check 4): quarterly one-line savings files are no hole, so Spending opens on October ($4,843.32)", async () => {
  const { cardGapPlan, noCardFromAug, bankLine } = await rc4Fix();
  const p = noCardFromAug(cardGapPlan(RC4));
  for (const [i, day] of ["2026-07-31", "2026-10-31"].entries()) {
    p.transactions.push(bankLine(`q${i}`, day, 12, "INTEREST PAID", "a-sav", "income-interest", { importId: `iq${i}` }));
    p.imports.push({ id: `iq${i}`, at: `${day}T12:00:00.000Z`, accountId: "a-sav", fileName: "ally.csv", rows: 1, added: 1, skipped: 0, bad: 0, from: day, to: day });
  }
  const s = compute(p, { today: RC4 });
  assert.equal(s.month, "2026-10"); near(s.total, 4843.32); assert.deepEqual(s.issues, []);
});
test("money 4 (re-check 4): a payment counted for neither of two Chase cards: one plain sentence, not averaged as whole", async () => {
  const { cardGapPlan, anAccount } = await rc4Fix();
  const p = cardGapPlan(RC4); p.accounts.find((a) => a.id === "a-visa").name = "Freedom";
  p.accounts.push(anAccount("a-sap", "Sapphire", "credit", "Chase"));
  const s = compute(p, { today: RC4 });
  assert.equal(s.month, "2026-10"); near(s.total, 4843.32);
  assert.deepEqual(s.cards, []); near(s.unsure.paid, 2610.3); assert.deepEqual(s.unsure.cardIds, ["a-visa", "a-sap"]);
  assert.deepEqual(s.issues.map((x) => x.text), ["$2,610 went to one of your Chase cards in October; bring in the card files to see what it bought."]);
  assert.equal(s.months.find((m) => m.ym === "2026-10").holes, 1); assert.equal(s.cmpGap?.card, true);
});
test("money 5 (re-check 4): two different cards' payments both reach their own card ($6,043.32 in October)", async () => {
  const { cardGapPlan, bankLine, anAccount } = await rc4Fix();
  const p = cardGapPlan(RC4); p.accounts = p.accounts.filter((a) => a.id !== "a-visa"); p.debts = p.debts.filter((d) => d.accountId !== "a-visa");
  p.transactions = p.transactions.filter((t) => !/CRD AUTOPAY/.test(t.rawPayee));
  p.accounts.push(anAccount("a-boa", "Cash Rewards card", "credit", "Bank of America"), anAccount("a-amex", "Amex", "credit", "American Express"));
  p.transactions.push(bankLine("b1", "2026-10-14", -900, "BANK OF AMERICA CREDIT CARD BILL PAYMENT", "a-chk", "transfer"), bankLine("b2", "2026-10-22", -300, "AMERICAN EXPRESS ACH PMT", "a-chk", "transfer"));
  const s = compute(p, { month: "2026-10", today: RC4 });
  near(s.total, 6043.32); assert.deepEqual(s.cards.map((c) => [c.accountId, c.paid]), [["a-boa", 900], ["a-amex", 300]]);
});
test("money 6 (re-check 4): a card named by its last four at the end of a token (XXXX4321) is found ($7,453.62)", async () => {
  const { cardGapPlan } = await rc4Fix();
  const p = renameCard(cardGapPlan(RC4), "Card 4321", "US Bank", "US BANK PMT XXXX4321", "US Bank");
  near(compute(p, { month: "2026-10", today: RC4 }).total, 7453.62);
});
test("pages 4 (re-check 4): July, before the Visa file starts on 8/1, says so on its card row", async () => {
  const { cardGapPlan, withVisaFile } = await rc4Fix();
  const s = compute(withVisaFile(cardGapPlan(RC4), "2026-08-01", "2026-10-31"), { month: "2026-07", today: RC4 });
  near(s.total, 4189.71);
  assert.deepEqual(s.byCategory.filter((c) => c.unimported).map((c) => [c.label, c.before, c.first]), [["Visa card, before its file starts on 8/1", true, "2026-08-01"]]);
  assert.deepEqual(s.cards.map((c) => [c.before, c.first]), [[true, "2026-08-01"]]);
});

// --- re-check 5 (2026-11-05): two cards at one bank, no files: the month picker says why, not "some days missing" ---
test("re-check 5, defect 4: a month whose only gap is a payment counted for neither card is 'card purchases not all in'", async () => {
  const { cardGapPlan, anAccount } = await rc4Fix();
  const fmt = await import("../../../core/format.js");
  const { render } = await import("./view.js");
  const p = cardGapPlan(RC4); p.accounts.find((a) => a.id === "a-visa").name = "Freedom";
  p.accounts.push(anAccount("a-sap", "Sapphire", "credit", "Chase"));
  const d = compute(p, { today: RC4 });
  // October and September: no day is missing, only the payment's card; August also misses 8/1-8/2, July 7/31
  assert.deepEqual(d.months.map((m) => [m.ym, m.holes, m.cardOnly]), [["2026-11", 0, false], ["2026-10", 1, true], ["2026-09", 1, true], ["2026-08", 2, false], ["2026-07", 2, false]]);
  // the picker's words, drawn with a stand-in for the UI kit that keeps the select's options
  let options = null;
  const node = () => ({ append() {}, replaceChildren() {}, set innerHTML(v) { void v; }, remove() {}, style: {} });
  const ui = new Proxy({ select: (opts) => { options = options ?? opts; return node(); } }, { get: (o, k) => o[k] ?? (() => node()) });
  render(node(), { ui, fmt: { ...fmt, today: () => RC4 }, plan: p, store: { update() {} }, route: { query: {} }, computeOf: () => null });
  assert.deepEqual(options.map((o) => o.label), ["Nov 2026 (to the 1st)", "Oct 2026 (card purchases not all in)", "Sep 2026 (card purchases not all in)", "Aug 2026 (some days missing)", "Jul 2026 (some days missing)"]);
});

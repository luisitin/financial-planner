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

// ---- gap #13 (2026-11-13): a category over twelve months; watch one shop or category ------------------------------------
import { YEAR_MONTHS, LATELY_MONTHS, JUMP_SHARE, JUMP_MONTHLY, MAX_JUMPS, MAX_WATCH, watchChoices, samePayee } from "./compute.js";
const TY = "2026-11-13";
const ymList = (from, to) => { const out = []; let y = Number(from.slice(0, 4)), m = Number(from.slice(5, 7)); for (;;) { const ym = `${y}-${String(m).padStart(2, "0")}`; if (ym > to) return out; out.push(ym); m++; if (m > 12) { m = 1; y++; } } };
const lastDay = (ym) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();
const LATE = ["2026-08", "2026-09", "2026-10"];   // the last 3 of the 12 whole months before Nov 13, 2026
/**
 * An invented checking file, Sep 2025 to Oct 2026 by default: pay on the 1st, rent on the 2nd, each line `spend(ym)` gives
 * ([category, payee, amount, day]) and the phone bill on the month's last day, so every month is covered end to end.
 * `drop(date)` leaves lines out (a gap between two files).
 */
function yearPlan(spend = () => [], { from = "2025-09", to = "2026-10", drop = () => false } = {}) {
  const p = emptyPlan();
  p.accounts.push({ id: "chk", name: "Checking", type: "checking", institution: "Credit union", balance: 1000 });
  let n = 0;
  const line = (date, amount, payee, category) => { if (!drop(date)) p.transactions.push({ id: `y${++n}`, date, amount, payee, rawPayee: payee.toUpperCase(), accountId: "chk", category, tags: [], note: "" }); };
  for (const ym of ymList(from, to)) {
    line(`${ym}-01`, 4000, "Payroll", "income-salary");
    line(`${ym}-02`, -1500, "Oak Street Apartments", "housing");
    for (const [category, payee, amount, day] of spend(ym)) line(`${ym}-${String(day).padStart(2, "0")}`, -amount, payee, category);
    line(`${ym}-${lastDay(ym)}`, -60, "Phone company", "phone");
  }
  return p;
}
/** Eating out $290 a month, then $410 in Aug to Oct 2026 (the design's figures: $320 over the year); groceries at Kroger $400. */
const eatingOut = (ym) => [["dining", "Corner Bistro", LATE.includes(ym) ? 410 : 290, 12], ["groceries", "Kroger", 250, 9], ["groceries", "Kroger #22", 150, 23]];

test("gap #13, 1: partial months are left out (the month in progress, a file that starts late, days missing, a card's purchases not in)", async () => {
  // Sep 2025 to Nov 10, 2026: November is not over, so the 12 are Nov 2025 to Oct 2026 (not Sep or Oct 2025)
  const p = yearPlan(eatingOut, { to: "2026-11" }); p.transactions = p.transactions.filter((t) => t.date <= "2026-11-10");
  const y = compute(p, { today: TY }).year;
  assert.equal(YEAR_MONTHS, 12); assert.equal(LATELY_MONTHS, 3);
  assert.deepEqual(y.months, ymList("2025-11", "2026-10").reverse());
  assert.deepEqual([y.from, y.to, y.left], ["2025-11", "2026-10", 0]);
  assert.deepEqual(y.lately, ["2026-10", "2026-09", "2026-08"]);
  // a file that starts on Nov 20, 2025: November is partly covered, so only 11 whole months: nothing over twelve months
  const q = yearPlan(eatingOut, { from: "2025-11" }); q.transactions = q.transactions.filter((t) => t.date >= "2025-11-20");
  assert.ok(!("year" in compute(q, { today: TY })), "11 whole months are not twelve");
  // no lines from Mar 1 to Apr 8, 2026 (a gap between two files): March and April are left out and the twelve reach back to Sep 2025
  const h = compute(yearPlan(eatingOut, { drop: (d) => d >= "2026-03-01" && d <= "2026-04-08" }), { today: TY }).year;
  assert.deepEqual(h.months, [...ymList("2025-09", "2026-02"), ...ymList("2026-05", "2026-10")].reverse());
  assert.equal(h.left, 2, "two months inside the twelve left out");
  // a card with no file of its own, paid from checking in October: October's purchases are not known by category, so it is left out
  const c = yearPlan(eatingOut);
  c.accounts.push({ id: "visa", name: "Visa card", type: "credit", institution: "Chase", balance: 1 });
  c.transactions.push({ id: "pay", date: "2026-10-14", amount: -640, payee: "Chase Credit Crd Autopay", rawPayee: "CHASE CREDIT CRD AUTOPAY", accountId: "chk", category: "transfer", tags: [], note: "" });
  const cy = compute(c, { today: TY }).year;
  assert.deepEqual([cy.from, cy.to, cy.left], ["2025-10", "2026-09", 0]);
});

test("gap #13, 2: the trend arithmetic (last 3 months against the 9 before; the year's average month)", () => {
  const y = compute(yearPlan(eatingOut), { today: TY }).year;
  const dining = y.rows.find((r) => r.category === "dining");
  near(dining.average, (3 * 410 + 9 * 290) / 12); near(dining.average, 320);
  near(dining.recent, 410); near(dining.before, 290); near(dining.rise, 120);
  near(dining.trend, 410 / 290 - 1);   // 41.4%: what marks it
  near(dining.up, 410 / 320 - 1);      // 28.1%: what the line says, the last 3 months against the year's average month
  assert.equal(dining.jump, true);
  const groc = y.rows.find((r) => r.category === "groceries");
  near(groc.average, 400); near(groc.trend, 0); assert.equal(groc.jump, false);
  // rows biggest first; the twelve months' total per category is the spending of those months
  assert.deepEqual(y.rows.map((r) => r.category), ["housing", "groceries", "dining", "phone"]);
  assert.deepEqual(y.jumps.map((r) => r.category), ["dining"]);
  // a month with nothing in a category counts as $0 in it (a new shop in the last 3 months: no "before", never marked)
  const n = compute(yearPlan((ym) => (LATE.includes(ym) ? [["pets", "Vet", 300, 15]] : [])), { today: TY }).year.rows.find((r) => r.category === "pets");
  near(n.average, 75); near(n.recent, 300); near(n.before, 0); assert.equal(n.trend, null); assert.equal(n.jump, false);
});

test("gap #13, 3: a category is marked when the last 3 months are at least 20% and $50 a month above the 9 before; at most two", () => {
  assert.equal(JUMP_SHARE, 0.2); assert.equal(JUMP_MONTHLY, 50); assert.equal(MAX_JUMPS, 2);
  const marked = (before, after, category = "fun") => compute(yearPlan((ym) => [[category, "Shop", LATE.includes(ym) ? after : before, 15]]), { today: TY }).year.rows.find((r) => r.category === category).jump;
  assert.equal(marked(250, 300), true, "20% and $50: both at the line");
  assert.equal(marked(250, 299), false, "19.6%");
  assert.equal(marked(100, 140), false, "40% but $40");
  assert.equal(marked(1000, 1100), false, "$100 but 10%");
  assert.equal(marked(100, 300, ""), false, "lines not filed yet are never marked");
  // three marked: the two that rose most in dollars, biggest first
  const y = compute(yearPlan((ym) => { const l = LATE.includes(ym); return [["fun", "Cinema", l ? 160 : 100, 6], ["travel", "Airline", l ? 600 : 400, 16], ["dining", "Bistro", l ? 410 : 290, 20]]; }), { today: TY }).year;
  assert.deepEqual(y.rows.filter((r) => r.jump).map((r) => r.category).sort(), ["dining", "fun", "travel"]);
  assert.deepEqual(y.jumps.map((r) => [r.category, Math.round(r.rise)]), [["travel", 200], ["dining", 120]]);
});

test("gap #13, 4: a watched shop's month total (its names as the bank writes them), a watched category's, and nothing", () => {
  assert.equal(MAX_WATCH, 5);
  assert.ok(samePayee("Kroger #22", "Kroger") && samePayee("KROGER", "kroger") && !samePayee("Kroger Fuel", "Kroger") && !samePayee("", "Kroger"));
  const p = yearPlan(eatingOut);
  p.spendingWatch = [{ kind: "payee", key: "Kroger" }, { kind: "category", key: "dining" }, { kind: "payee", key: "Garden Center" }];
  const d = compute(p, { month: "2026-10", today: TY });
  assert.deepEqual(d.watch.map((w) => [w.kind, w.at, w.key, w.label, w.total, w.count]), [["payee", 0, undefined, undefined, 400, 2], ["category", 1, "dining", "Eating out", 410, 1], ["payee", 2, undefined, undefined, 0, 0]]);
  // the usual month over the twelve, when there are twelve
  assert.deepEqual(d.watch.map((w) => w.usual), [400, 320, 0]);
  // the watched category's total is the By category row's
  near(d.watch[1].total, d.byCategory.find((c) => c.category === "dining").total);
  // a refund at the shop comes off, as on the page; another month, its own total
  p.transactions.push({ id: "ref", date: "2026-10-25", amount: 30, payee: "Kroger", rawPayee: "KROGER", accountId: "chk", category: "groceries", tags: [], note: "" });
  assert.equal(compute(p, { month: "2026-10", today: TY }).watch[0].total, 370);
  assert.equal(compute(p, { month: "2026-09", today: TY }).watch[1].total, 410);
  // fewer than twelve whole months: the month's total, and no usual month
  const short = yearPlan(eatingOut, { from: "2026-06" }); short.spendingWatch = [{ kind: "payee", key: "Kroger" }];
  const s = compute(short, { month: "2026-10", today: TY });
  assert.ok(!("year" in s)); assert.deepEqual([s.watch[0].total, s.watch[0].usual], [400, null]);
  // what the person can pick: shops by what they took (their names grouped), then spending categories, less what is watched
  const ch = watchChoices(p);
  assert.deepEqual(ch.payees.slice(0, 3).map((x) => [x.key, Math.round(x.total)]), [["Oak Street Apartments", 21000], ["Corner Bistro", 4420], ["Phone company", 840]]);
  assert.ok(!ch.payees.some((x) => samePayee(x.key, "Kroger")), "Kroger is watched already");
  assert.ok(!ch.categories.some((c) => c.key === "dining") && ch.categories.some((c) => c.key === "groceries") && !ch.categories.some((c) => c.key === "transfer" || /^income/.test(c.key)));
  const all = watchChoices(yearPlan(eatingOut));
  assert.deepEqual(all.payees.find((x) => samePayee(x.key, "Kroger")), { key: "Kroger", total: 5600, count: 28 }, "Kroger and Kroger #22 are one shop, named as most of its lines are");
});

test("gap #13, critic 1: two shops paid through one payment service (PayPal *Netflix, PayPal *Spotify) are two shops", () => {
  // the Rules page's payeeWords keeps the shop after the star; normalizePayee alone made every PayPal shop "paypal"
  assert.ok(!samePayee("PayPal *Netflix", "PayPal *Spotify") && samePayee("PayPal *Netflix", "PAYPAL *NETFLIX") && samePayee("SQ *Corner Bistro", "SQ *CORNER BISTRO"));
  assert.ok(samePayee("Kroger #22", "Kroger") && samePayee("AMAZON MKTPL*2K3", "Amazon Mktpl*9Z1"), "a store number or an order code is still the same shop");
  const p = yearPlan((ym) => [...eatingOut(ym), ["subscriptions", "PayPal *Netflix", 15, 5], ["subscriptions", "PayPal *Spotify", 11, 6]]);
  p.spendingWatch = [{ kind: "payee", key: "PayPal *Netflix" }];
  const w = compute(p, { month: "2026-10", today: TY }).watch[0];
  assert.deepEqual([w.total, w.count, w.usual], [15, 1, 15], "Netflix only, not Spotify too");
  // what the person can pick: Spotify is still there, as its own shop; before watching, both are
  assert.deepEqual(watchChoices(p).payees.filter((x) => /paypal/i.test(x.key)).map((x) => [x.key, x.total]), [["PayPal *Spotify", 154]]);
  const q = structuredClone(p); delete q.spendingWatch;
  assert.deepEqual(watchChoices(q).payees.filter((x) => /paypal/i.test(x.key)).map((x) => [x.key, x.total]), [["PayPal *Netflix", 210], ["PayPal *Spotify", 154]]);
});

test("gap #13, 5: no lines gives nothing; nothing watched and fewer than twelve months add nothing to the result", () => {
  const e = emptyPlan(); e.spendingWatch = [{ kind: "payee", key: "Kroger" }];
  const d = compute(e, { today: TY });
  assert.equal(d.hasData, false); assert.ok(!("year" in d) && !("watch" in d));
  assert.deepEqual(watchChoices(e).payees, []);
  const s = compute(samplePlan(), { today: TY });
  assert.ok(!("year" in s) && !("watch" in s));
  // a watch list with nothing usable in it is no watch list
  const p = samplePlan(); p.spendingWatch = [{ kind: "shop", key: "x" }, { kind: "payee", key: "  " }, null];
  assert.equal(JSON.stringify(compute(p, { today: TY })), JSON.stringify(s));
});

test("gap #13, invariance: with no watch list every result is the same as before over the households and the fixture plans", async () => {
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  const { renterDebtPlan } = await import("../../../qa/fixtures/renter-debt-plan.mjs");
  const { retiredCouplePlan } = await import("../../../qa/fixtures/retired-couple-plan.mjs");
  const { cardGapPlan, withVisaFile, noCardFromAug } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const { ARCHETYPES, COMMON_PACKS, SPECIAL_PACKS } = await import("../../../qa/households/lib/catalog.mjs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const plans = [familyPlan(TY), renterDebtPlan(), retiredCouplePlan(TY), samplePlan(), cardGapPlan(RC4), cardGapPlan(RC4, { withFile: false }), withVisaFile(cardGapPlan(RC4), "2026-08-20", "2026-10-31"), noCardFromAug(cardGapPlan(RC4)), emptyPlan()];
  for (const a of ARCHETYPES) {
    plans.push(a.build());
    for (const vs of Object.values({ ...COMMON_PACKS, special: SPECIAL_PACKS[a.id] ?? [] })) for (const v of vs) { const q = structuredClone(a.build()); v.apply(q); plans.push(q); }
  }
  assert.ok(plans.length > 500, `${plans.length} plans`);
  for (const p0 of plans) {
    const p = migrate(structuredClone(p0)), q = structuredClone(p);
    q.spendingWatch = [];
    for (const today of [TY, RC4]) {
      const a = compute(p, { today }), b = compute(q, { today });
      assert.ok(!("year" in a) && !("watch" in a), "no new key");
      assert.equal(JSON.stringify(b), JSON.stringify(a));
    }
  }
});

// ---- the page: what shows by default, and what one tap opens ----
const pageOf = async (plan, opts) => { const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs"); return renderPage(new URL("./view.js", import.meta.url).href, plan, TY, opts); };
const { textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
const partsOf = (root) => root.querySelectorAll("details").filter((x) => x.dataset?.part);
const outside = (root) => { const shut = new Set(partsOf(root).filter((x) => !x.hasAttribute("open"))); const walk = (n) => (n.childNodes ?? []).map((c) => (shut.has(c) ? textOf(c.childNodes[0]) : c.data !== undefined ? c.data : walk(c))).join(" "); return walk(root).replace(/\s+/g, " "); };

test("gap #13, page: the marked category is one amber line; a watched shop is one line; the twelve months and the watch form are one tap away", async () => {
  const p = yearPlan(eatingOut); p.spendingWatch = [{ kind: "payee", key: "Kroger" }];
  const r = await pageOf(p);
  const warn = r.root.querySelectorAll(".notice.warn").map((n) => textOf(n));
  assert.deepEqual(warn, ["Eating out: $410 a month from Aug to Oct, $320 a month over the year (up 28%)."]);
  const first = outside(r.root);
  assert.match(first, /What you watch 🏪 Kroger 2 times in Oct 2026 · \$400 a month over the year \$400 By category/);
  // the parts: one card at the foot, both shut, in the vocabulary's order
  const ps = partsOf(r.root);
  assert.deepEqual(ps.map((x) => [x.dataset.part, x.dataset.kind, textOf(x.querySelector(".fold-title")), textOf(x.querySelector(".fold-status")), x.hasAttribute("open")]),
    [["year", "more", "4 more categories over 12 months", "Nov 2025 to Oct 2026", false], ["watch", "own", "Watch a shop or category", "1 set by you", false]]);
  assert.ok(!/A category is marked when|What to watch|Watch it|Stop watching/.test(first), "the twelve months and the watch form are inside their parts");
  // inside "4 more categories over 12 months": each category's average month and the last 3 months', and how a line is marked
  const year = textOf(ps[0]);
  assert.match(year, /The 12 most recent whole months in your bank files: Nov 2025 to Oct 2026\./);
  assert.match(year, /Eating out \$320 a month \$410 a month from Aug to Oct · up 28% going up/);
  assert.match(year, /Groceries \$400 a month \$400 a month from Aug to Oct · no change/);
  assert.match(year, /A category is marked when Aug to Oct is at least 20% and \$50 a month above the 9 months before\./);
  // one filled button on the page at most, and none of the parts' rows is a button
  assert.ok(r.root.querySelectorAll("button").filter((b) => !/secondary/.test(b.className)).length <= 1);
});

test("gap #13, page: no watch and fewer than twelve months: nothing new on the first view, one quiet row", async () => {
  const r = await pageOf(samplePlan());
  assert.equal(r.root.querySelectorAll(".notice.warn").length, 0);
  assert.ok(!/What you watch/.test(r.text()));
  assert.deepEqual(partsOf(r.root).map((x) => [x.dataset.part, textOf(x.querySelector(".fold-title")), x.hasAttribute("open")]), [["watch", "Watch a shop or category", false]]);
  // the empty plan: the empty state as before, no parts
  const e = await pageOf(emptyPlan());
  assert.equal(partsOf(e.root).length, 0); assert.match(e.text(), /Import a bank file/);
});

test("gap #13, page: watch a shop: Save writes one entry, the green line names its total, the part stays open; Stop watching takes it off", async () => {
  const p = yearPlan(eatingOut);
  const r = await pageOf(p);
  const watchPart = partsOf(r.root).find((x) => x.dataset.part === "watch");
  const f = watchPart.querySelector("form");
  const sel = f.querySelector("select");
  const labels = sel.querySelectorAll("option").map((o) => textOf(o));
  assert.equal(labels[0], "Pick a shop or a category");
  assert.ok(labels.includes("Shop: Kroger") && labels.includes("Category: Eating out"), labels.join(" | "));
  sel.value = "payee:Kroger";
  f.dispatch("submit");
  assert.equal(r.saved.length, 1);
  assert.deepEqual(r.saved[0].spendingWatch, [{ kind: "payee", key: "Kroger" }]);
  // the shell draws the page again with the saved plan: the green line in the open part, the year part still shut
  const r2 = await pageOf(r.saved[0]);
  const parts2 = partsOf(r2.root);
  const w2 = parts2.find((x) => x.dataset.part === "watch");
  assert.equal(w2.hasAttribute("open"), true, "the part saved in stays open");
  assert.equal(parts2.find((x) => x.dataset.part === "year").hasAttribute("open"), false);
  assert.deepEqual(w2.querySelectorAll(".notice.ok").map((n) => textOf(n)), ["Saved. You now watch Kroger: $400 in Oct 2026."]);
  assert.match(outside(r2.root), /What you watch 🏪 Kroger 2 times in Oct 2026/);
  // the next draw has no green line and the part shuts again as designed
  const r3 = await pageOf(r.saved[0]);
  assert.equal(partsOf(r3.root).find((x) => x.dataset.part === "watch").hasAttribute("open"), false);
  assert.equal(r3.root.querySelectorAll(".notice.ok").length, 0);
  // Stop watching: the entry goes, and the section with it when it was the last
  r3.root.querySelectorAll("button").find((b) => /Stop watching Kroger/.test(b.getAttribute("aria-label") ?? b.textContent)).click();
  assert.equal(r3.saved.length, 1); assert.ok(!("spendingWatch" in r3.saved[0]));
  const r4 = await pageOf(r3.saved[0]);
  assert.deepEqual(r4.root.querySelectorAll(".notice.ok").map((n) => textOf(n)), ["Done. You no longer watch Kroger."]);
  assert.ok(!/What you watch/.test(r4.text()));
});

test("gap #13, page: the green line for a shop with nothing this month; five watched is the most", async () => {
  const p = yearPlan(eatingOut);
  const r = await pageOf(p);
  const f = partsOf(r.root).find((x) => x.dataset.part === "watch").querySelector("form");
  f.querySelector("select").value = "category:pets";
  f.dispatch("submit");
  const r2 = await pageOf(r.saved[0]);
  assert.deepEqual(r2.root.querySelectorAll(".notice.ok").map((n) => textOf(n)), ["Saved. You now watch Pets: nothing in Oct 2026."]);
  assert.match(outside(r2.root), /What you watch 🐾 Pets Nothing in Oct 2026 · nothing over the year None By category/);
  const full = yearPlan(eatingOut);
  full.spendingWatch = ["groceries", "dining", "housing", "phone", "pets"].map((key) => ({ kind: "category", key }));
  const r5 = await pageOf(full);
  const w = partsOf(r5.root).find((x) => x.dataset.part === "watch");
  assert.equal(w.querySelector("form"), null);
  assert.match(textOf(w), /You watch 5 things, the most this page shows\. Stop watching one to pick another\./);
  assert.equal(textOf(w.querySelector(".fold-status")), "5 set by you");
});

test("gap #13, critic 2: a shop that started lately is not 'usually' its year's average month: the row says the year", async () => {
  // $15 a month at PayPal *Netflix from Aug to Oct only: the year's average month is $3.75, which is not what it usually costs
  const p = yearPlan((ym) => [...eatingOut(ym), ...(LATE.includes(ym) ? [["subscriptions", "PayPal *Netflix", 15, 5]] : [])]);
  p.spendingWatch = [{ kind: "payee", key: "PayPal *Netflix" }];
  near(compute(p, { month: "2026-10", today: TY }).watch[0].usual, 3.75);
  const r = await pageOf(p);
  const first = outside(r.root);
  assert.match(first, /What you watch 🏪 PayPal \*Netflix 1 time in Oct 2026 · \$4 a month over the year \$15 By category/);
  assert.ok(!/usually/.test(first), first);
});

test("gap #13, privacy: a watched shop's name is not in the result, so Explain this page never sends it to the AI helper", async () => {
  const { sheetFor } = await import("../../ai/explain/compute.js");
  const p = yearPlan(eatingOut); p.spendingWatch = [{ kind: "payee", key: "Kroger" }, { kind: "category", key: "groceries" }];
  const d = compute(p, { month: "2026-10", today: TY });
  assert.ok(!JSON.stringify(d.watch).includes("Kroger"));
  const s = sheetFor(p, (c) => compute(c, { month: "2026-10", today: TY }), { today: TY });
  assert.ok(s.ok && !s.lines.some((l) => /Kroger|Corner Bistro|Oak Street/.test(l)), s.lines.filter((l) => /Kroger|Bistro|Oak/.test(l)).join(" | "));
  assert.ok(s.lines.some((l) => /^watch \(2 in all\)/.test(l)) && s.lines.some((l) => /Payee \d/.test(l)), "the shops are there as stand-ins");
});

// docs/OPTIONAL.md S11 (R17): after a save only the part saved in changes, and its green line is said once. Both saves of this
// page are inside "Watch a shop or category" (Watch it, Stop watching); picking a month is no save (it draws the page again).
test("S11: after a save only the saved part changes: Watch it and Stop watching keep Watch a shop or category open, the twelve months as they were; said once", async () => {
  const states = (root) => Object.fromEntries(partsOf(root).map((x) => [x.dataset.part, x.hasAttribute("open")]));
  const greenIn = (root) => partsOf(root).map((x) => [x.dataset.part, x.querySelectorAll(".notice.ok").map((n) => textOf(n))]).filter(([, l]) => l.length);
  const p = yearPlan(eatingOut); p.spendingWatch = [{ kind: "category", key: "groceries" }];
  await pageOf(p);   // a green line an earlier test's tap left in the view's module state is said on this draw
  const r = await pageOf(p);
  const before = states(r.root);
  assert.deepEqual(before, { year: false, watch: false });
  // Watch it, inside the part: that part opens on the next draw with its green line; the twelve months stay as drawn
  const f = partsOf(r.root).find((x) => x.dataset.part === "watch").querySelector("form");
  f.querySelector("select").value = "payee:Kroger";
  f.dispatch("submit");
  assert.equal(r.saved.length, 1);
  const r2 = await pageOf(r.saved[0]);
  assert.deepEqual(states(r2.root), { ...before, watch: true }, "only the part saved in differs");
  assert.deepEqual(greenIn(r2.root), [["watch", ["Saved. You now watch Kroger: $400 in Oct 2026."]]]);
  assert.equal(r2.root.querySelectorAll(".notice.ok").length, 1, "the green line is in the part saved in, nowhere else");
  // said once: the next draw is as designed, with no green line
  const r3 = await pageOf(r.saved[0]);
  assert.deepEqual(states(r3.root), before);
  assert.equal(r3.root.querySelectorAll(".notice.ok").length, 0);
  // Stop watching (one of two): the same part opens again, alone, and the list keeps the other
  r3.root.querySelectorAll("button").find((b) => /Stop watching Groceries/.test(b.getAttribute("aria-label") ?? "")).click();
  assert.deepEqual(r3.saved[0].spendingWatch, [{ kind: "payee", key: "Kroger" }]);
  const r4 = await pageOf(r3.saved[0]);
  assert.deepEqual(states(r4.root), { ...before, watch: true });
  assert.deepEqual(greenIn(r4.root), [["watch", ["Done. You no longer watch Groceries."]]]);
  assert.deepEqual(states((await pageOf(r3.saved[0])).root), before);
});

// R9 item 9: a required box is never folded, so the watch form's one box is not `required`; "Watch it" with nothing picked is
// held at the box with the page's own words (ui.fieldError, which in a browser also opens the part around it: the kit's own
// test, tests/ui-kit-helpers.test.mjs "fieldError: ...") and saves nothing
test("the watch box is not required: Watch it with nothing picked says 'Pick a shop or a category first.' at that box and saves nothing", async () => {
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { render } = await import("./view.js");
  const { FakeElement } = await import("../../../qa/fixtures/fake-dom.mjs");
  const said = [], saved = [];
  const plan = migrate(structuredClone(yearPlan(eatingOut)));
  const root = new FakeElement("main");
  render(root, { ui: { ...ui, fieldError: (box, text) => { said.push([box, text]); return false; } }, fmt: { ...fmt, today: () => TY }, plan, route: { rest: [], query: {} },
    store: { get: () => plan, update: (fn) => { const d = structuredClone(plan); fn(d); saved.push(d); } }, computeOf: () => null });
  const part = partsOf(root).find((x) => x.dataset.part === "watch");
  assert.equal(part.hasAttribute("open"), false, "the part is shut on the first view");
  const box = part.querySelector('[name="what"]');
  assert.equal(box.hasAttribute("required"), false);
  // the part holds no figure to type, one pick from a list (docs/OPTIONAL.md R24: why its title is pinned, not "Set my own numbers")
  assert.deepEqual(part.all().filter((e) => /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName)).map((e) => e.tagName), ["SELECT"]);
  box.value = "";
  part.querySelector("form").dispatch("submit");
  assert.equal(saved.length, 0, "nothing picked: nothing saved");
  assert.deepEqual(said.map(([b, t]) => [b === box, t]), [[true, "Pick a shop or a category first."]], "the words are said at the box inside the shut part");
});

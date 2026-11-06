import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, defaultYear } from "./compute.js";
import { familyPlan } from "../../../qa/fixtures/family-plan.mjs";
import { samplePlan } from "../../../qa/fixtures/sample-plan.mjs";
import { compute as netWorthOf } from "../../balance/net-worth/compute.js";

const TODAY = "2026-10-30";

test("the year a review is about: last year in January and February", () => {
  assert.equal(defaultYear("2027-01-15"), 2026); assert.equal(defaultYear("2027-03-01"), 2027);
});

test("net worth over the year starts from the last point before it; reviews and their notes; the year so far", () => {
  const p = familyPlan();
  p.netWorthHistory = [{ date: "2025-12-01", assets: 1, liabilities: 0, netWorth: 240000 }, { date: "2026-03-01", assets: 1, liabilities: 0, netWorth: 250000 }, { date: "2026-10-01", assets: 1, liabilities: 0, netWorth: 270000 }];
  p.reviews = [{ month: "2026-02", at: "2026-02-28", note: "a" }, { month: "2025-12", at: "2025-12-30", note: "old" }, { month: "2026-09", at: "2026-09-30", note: "" }];
  const d = compute(p, { today: TODAY, year: 2026 });
  assert.equal(d.partial, true);
  assert.equal(d.netWorth.first.netWorth, 240000, "December's point starts the year");
  // the year so far ends at today's balances (the Dashboard's figure), not the last saved total (270,000)
  const live = netWorthOf(p, { today: TODAY }).netWorth;
  assert.equal(d.netWorth.last.live, true); assert.equal(d.netWorth.last.netWorth, live); assert.equal(d.netWorth.change, live - 240000);
  assert.deepEqual(d.netWorth.points.map((x) => x.date), ["2025-12-01", "2026-03-01", "2026-10-01", TODAY]);
  assert.deepEqual(d.reviews.months.map((r) => r.month), ["2026-02", "2026-09"]);
  assert.equal(d.ahead.year, 2027); assert.ok(d.ahead.moments.every((m) => Number(String(m.date ?? "2027").slice(0, 4)) === 2027));
});

test("the bank files: the year's months and where the money went", () => {
  const d = compute(samplePlan(), { today: TODAY, year: 2026 });
  assert.ok(d.money.months.length >= 2);
  assert.ok(Math.abs(d.money.in - d.money.out - d.money.net) < 0.01);
  assert.ok(d.categories.length > 0); assert.ok(Math.abs(d.categories.reduce((s, c) => s + c.share, 0) - 1) < 1e-9);
});

test("only a January 1 total saved: the change is today's net worth against it, never 'up $0' (round 4, 2026-11-02)", () => {
  const p = familyPlan("2026-11-02");   // its one saved total is January 1
  const d = compute(p, { today: "2026-11-02", year: 2026 });
  const live = netWorthOf(p, { today: "2026-11-02" }).netWorth;
  assert.equal(d.netWorth.first.date, "2026-01-01"); assert.equal(d.netWorth.change, live - d.netWorth.first.netWorth);
  assert.ok(d.netWorth.change > 0); assert.equal(d.netWorth.lastSaved, null);
  // nothing saved at all: today's figure with no change
  p.netWorthHistory = [];
  const e = compute(p, { today: "2026-11-02", year: 2026 });
  assert.equal(e.netWorth.first, null); assert.equal(e.netWorth.change, null); assert.equal(e.netWorth.last.netWorth, live);
  // a year that is over ends at its last saved total, and says when that was when it is not from December
  p.netWorthHistory = [{ date: "2025-01-01", assets: 1, liabilities: 0, netWorth: 200000 }, { date: "2025-09-30", assets: 1, liabilities: 0, netWorth: 230000 }];
  const f = compute(p, { today: "2026-11-02", year: 2025 });
  assert.equal(f.netWorth.last.live, undefined); assert.equal(f.netWorth.change, 30000); assert.equal(f.netWorth.lastSaved, "2025-09-30");
});

test("a card whose own file is missing: its payments are in the year's money out and in where it went, the same as Spending (2026-11-02)", async () => {
  const { cardGapPlan } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const p = cardGapPlan("2026-11-02");
  const d = compute(p, { today: "2026-11-02", year: 2026 });
  const paid = 640.22 + 2450.22 + 2980.55 + 2610.3;
  assert.ok(Math.abs(d.money.cards - paid) < 0.005, String(d.money.cards));
  const visa = d.categories.find((c) => c.label === "Visa card, details not imported yet");
  assert.ok(Math.abs(visa.total - paid) < 0.005);
  assert.ok(Math.abs(d.categories.reduce((s, c) => s + c.total, 0) - d.money.out) < 0.01, "where it went adds up to what went out");
});
test("after the Visa's file from August: only July's payment stands in, and the review can name the month (2026-11-02)", async () => {
  const { cardGapPlan, withVisaFile } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const p = withVisaFile(cardGapPlan("2026-11-02"), "2026-08-01", "2026-10-31");
  const d = compute(p, { today: "2026-11-02", year: 2026 });
  assert.deepEqual(d.money.cardMonths.map((c) => [c.cardId, c.name, Math.round(c.total * 100) / 100, c.months]), [["a-visa", "Visa card", 640.22, ["2026-07"]]]);
  assert.ok(Math.abs(d.money.cards - 640.22) < 0.005);
});
// ---- re-check of the card patch (2026-11-02): the findings' own inputs and figures
const r2 = (n) => Math.round(n * 100) / 100;
test("finding 2: the Visa file stopping on 10/10: what went out in 2026 is $20,220.47, of which only July's $640.22 stands in", async () => {
  const { cardGapPlan, withVisaFile } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const p = withVisaFile(cardGapPlan("2026-11-02"), "2026-08-01", "2026-10-10");
  const d = compute(p, { today: "2026-11-02", year: 2026 });
  // the lines alone: $19,580.25; plus July's $640.22 (no Visa lines in July, and before its first line ever on 8/1)
  assert.equal(r2(d.money.out), 20220.47); assert.equal(r2(d.money.cards), 640.22);
  // the Visa file with a gap 9/11 to 9/19: $20,580.47, the same $640.22 standing in (September's autopay is a transfer)
  const g = withVisaFile(withVisaFile(cardGapPlan("2026-11-02"), "2026-08-01", "2026-09-10"), "2026-09-20", "2026-10-31");
  const e = compute(g, { today: "2026-11-02", year: 2026 });
  assert.equal(r2(e.money.out), 20580.47); assert.equal(r2(e.money.cards), 640.22);
});
test("page review 5 and 3: the year names the days an account's files miss, and a card's payments before its file starts", async () => {
  const { cardGapPlan, withVisaFile } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const d = compute(cardGapPlan("2026-11-02"), { today: "2026-11-02", year: 2026 });
  assert.deepEqual(d.money.gaps, [{ why: "Chase checking has no lines from 7/31 to 8/2", yms: ["2026-07", "2026-08"], unsure: false }]);
  assert.equal(d.money.cardMonths[0].first, null, "no Visa lines at all");
  const p = withVisaFile(cardGapPlan("2026-11-02"), "2026-08-20", "2026-10-31");
  const e = compute(p, { today: "2026-11-02", year: 2026 });
  // July (no Visa lines) and August's 8/14 payment (before its first line, 8/20): $640.22 + $2,450.22
  assert.deepEqual(e.money.cardMonths.map((c) => [r2(c.total), c.months, c.first]), [[3090.44, ["2026-07", "2026-08"], "2026-08-20"]]);
  assert.deepEqual(e.money.gaps, [{ why: "Chase checking has no lines from 7/31 to 8/2", yms: ["2026-07", "2026-08"], unsure: false }, { why: "Visa card's lines start on 8/20", yms: ["2026-08"], unsure: false }]);
});

// ---- re-check 4 (2026-11-02): own accounts never cards; a payment counted for neither card
test("money 2 (re-check 4): a Discover savings transfer is not a Discover card payment: out $26,131.54, $8,681.29 to the card", async () => {
  const { cardGapPlan, bankLine, anAccount } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const p = cardGapPlan("2026-11-02"); const v = p.accounts.find((a) => a.id === "a-visa"); v.name = "Discover it card"; v.institution = "Discover";
  for (const t of p.transactions) if (/CRD AUTOPAY/.test(t.rawPayee)) { t.rawPayee = "DISCOVER E-PAYMENT 1234"; t.payee = "Discover E-payment"; }
  p.accounts.push(anAccount("a-dsav", "Discover savings", "savings", "Discover"));
  for (const [i, day] of ["2026-08-05", "2026-09-05", "2026-10-05"].entries()) p.transactions.push(bankLine(`ds${i}`, day, -500, "DISCOVER BANK ACH TRANSFER", "a-chk", "transfer"), bankLine(`dsi${i}`, day, 500, "TRANSFER FROM CHASE", "a-dsav", "transfer"));
  const d = compute(p, { today: "2026-11-02", year: 2026 });
  assert.equal(r2(d.money.out), 26131.54); assert.equal(r2(d.money.cards), 8681.29);
});
test("money 4 (re-check 4): a payment for one of two Chase cards is in no card's total; each month's sentence is a gap", async () => {
  const { cardGapPlan, anAccount } = await import("../../../qa/fixtures/card-gap-plan.mjs");
  const p = cardGapPlan("2026-11-02"); p.accounts.find((a) => a.id === "a-visa").name = "Freedom";
  p.accounts.push(anAccount("a-sap", "Sapphire", "credit", "Chase"));
  const d = compute(p, { today: "2026-11-02", year: 2026 });
  // the lines alone: $26,131.54 less the four payments ($8,681.29) = $17,450.25
  assert.equal(r2(d.money.out), 17450.25); assert.equal(r2(d.money.cards), 0);
  assert.deepEqual(d.money.gaps.filter((g) => g.unsure).map((g) => [g.yms, g.why]), [
    [["2026-07"], "$640 went to one of your Chase cards in July; bring in the card files to see what it bought"],
    [["2026-08"], "$2,450 went to one of your Chase cards in August; bring in the card files to see what it bought"],
    [["2026-09"], "$2,981 went to one of your Chase cards in September; bring in the card files to see what it bought"],
    [["2026-10"], "$2,610 went to one of your Chase cards in October; bring in the card files to see what it bought"]]);
});

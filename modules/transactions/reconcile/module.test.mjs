import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, reconcile, recordOf, saveRecord, nextStart, digitSwaps, NEAR_DAYS, MAX_HINTS } from "./compute.js";
import { samplePlan } from "../../../qa/fixtures/sample-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

// the sample plan's checking account in September: +1950 +1950 −1500 −86.40 −54.12 −15.49 −500 −640.22 = +1103.77
const SEPT = 1950 + 1950 - 1500 - 86.40 - 54.12 - 15.49 - 500 - 640.22;
const chk = (endBalance, extra = {}) => ({ accountId: "chk", from: "2026-09-01", to: "2026-09-30", startBalance: 1000, endBalance, ...extra });
const visa = (startBalance, endBalance, extra = {}) => ({ accountId: "visa", from: "2026-09-01", to: "2026-09-30", startBalance, endBalance, ...extra });
const near = (a, b) => assert.ok(Math.abs(a - b) < 0.005, `${a} vs ${b}`);
const kinds = (r) => r.hints.map((h) => h.kind);
const line = (id, date, amount, payee, accountId = "chk") => ({ id, accountId, date, amount, payee, category: "" });

test("a matching statement: the change it shows equals the lines on file for the same days, both ends counted", () => {
  const p = samplePlan();
  const r = reconcile(p, chk(1000 + SEPT));
  assert.equal(r.ready, true); assert.equal(r.matches, true); assert.equal(r.gap, 0); assert.equal(r.fix, 0); assert.deepEqual(r.hints, []);
  near(r.statementChange, SEPT); near(r.ledgerChange, SEPT);
  assert.equal(r.startBalance, 1000); assert.equal(r.minus, false);
  assert.equal(r.lines.length, 8, "September 1 and the lines up to September 30; August's are out");
  assert.deepEqual(r.lines.map((t) => t.date), [...r.lines.map((t) => t.date)].sort(), "by date");
  near(r.lines[0].running, 1000 + r.lines[0].amount); near(r.lines.at(-1).running, 1000 + SEPT);
  // the statement ending on the 14th instead leaves out the 15th's lines
  assert.equal(reconcile(p, chk(1000 + SEPT, { to: "2026-09-14" })).lines.length, 7, "the payroll on the 15th falls out");
});

test("the balance at the end of each day: same-day lines keep the order on file, and only a day's last line closes it", () => {
  const r = reconcile(samplePlan(), chk(1000 + SEPT));
  // September 1: the payroll (t2) is on file before the rent (t3)
  assert.deepEqual(r.lines.slice(0, 2).map((t) => [t.id, t.dayEnd]), [["t2", false], ["t3", true]]);
  near(r.lines[1].running, 1000 + 1950 - 1500);
  assert.deepEqual(r.lines.filter((t) => t.dayEnd).length, new Set(r.lines.map((t) => t.date)).size, "one end of day per day");
  // stored in the other order, the day's end is the same
  const q = samplePlan(); const i2 = q.transactions.findIndex((t) => t.id === "t2"), i3 = q.transactions.findIndex((t) => t.id === "t3");
  [q.transactions[i2], q.transactions[i3]] = [q.transactions[i3], q.transactions[i2]];
  const s = reconcile(q, chk(1000 + SEPT));
  assert.deepEqual(s.lines.slice(0, 2).map((t) => t.id), ["t3", "t2"]); near(s.lines[1].running, 1000 + 1950 - 1500);
});

test("a card or loan: its balance is what you owe, so spending raises it and payments lower it", () => {
  const p = samplePlan();
  // the Visa card in September: payment +640.22, Amazon −42.17 twice: owed goes from 640.22 to 84.34
  const r = reconcile(p, visa(640.22, 84.34));
  assert.equal(r.liability, true); assert.equal(r.matches, true);
  near(r.statementChange, -555.88); near(r.ledgerChange, -555.88);
  near(r.lines.at(-1).running, 84.34);
  // a statement that owes 42.17 more: a charge of 42.17 (−42.17 on the ledger) is what would close it
  const more = reconcile(p, visa(640.22, 126.51));
  near(more.gap, 42.17); near(more.fix, -42.17);
  // a statement that owes 42.17 less: the Amazon charge posted twice is the first idea, and no copy is "near the edge"
  const less = reconcile(p, visa(640.22, 42.17));
  assert.equal(less.hints[0].kind, "twice"); assert.deepEqual(less.hints[0].ids, ["t11", "t12"]);
  assert.ok(!less.hints.some((h) => h.kind === "edge" || h.kind === "extra"), "the two copies are named once");
  assert.deepEqual(kinds(reconcile(p, visa(700, 101.95))), ["twice", "missing"]);
});

test("a card typed with the minus sign is read as what is owed, unless it agrees as typed (in credit at both ends)", () => {
  const p = samplePlan();
  const r = reconcile(p, visa(-640.22, -84.34));
  assert.equal(r.matches, true); assert.equal(r.minus, true); assert.equal(r.startBalance, 640.22); assert.equal(r.endBalance, 84.34);
  near(r.lines.at(-1).running, 84.34);
  assert.deepEqual(recordOf(r, visa(-640.22, -84.34), { id: "v1" }).endBalance, 84.34, "saved as what is owed");
  // the card owed you 20 and you paid 555.88 more than you spent, so it owes you 575.88: as typed it agrees, so it is kept
  const credit = reconcile(p, visa(-20, -575.88));
  assert.equal(credit.matches, true); assert.equal(credit.minus, false); assert.equal(credit.startBalance, -20);
  // a credit at one end only is read as typed
  assert.equal(reconcile(p, visa(-20, 535.88)).minus, false);
  // an account you own keeps its sign: an overdraft is below 0
  assert.equal(reconcile(p, chk(-1000 + SEPT, { startBalance: -1000 })).matches, true);
});

test("what could explain a gap: one line of the difference, entered twice, the wrong sign, two lines, a missing line", () => {
  const p = samplePlan();
  // the statement has 15.49 more than the ledger: Netflix (−15.49) may not be on it
  let r = reconcile(p, chk(1000 + SEPT + 15.49));
  near(r.gap, 15.49); near(r.fix, 15.49);
  assert.deepEqual(r.hints.find((h) => h.kind === "extra").ids, ["t6"]);
  assert.ok(r.hints.some((h) => h.kind === "missing" && /money in/.test(h.text)), "or money in is missing");
  // entered twice: a copy of Netflix a day later
  p.transactions.push({ ...p.transactions.find((t) => t.id === "t6"), id: "t6b", date: "2026-09-06" });
  r = reconcile(p, chk(1000 + SEPT));
  near(r.gap, 15.49);
  const twice = r.hints.find((h) => h.kind === "twice");
  assert.deepEqual(twice.ids, ["t6", "t6b"]); assert.match(twice.text, /entered twice/);
  assert.deepEqual(kinds(r), ["twice", "missing"], "neither copy is offered again as a line of the difference");
  // a pending line on the last day of the previous statement that posted again on the first day of this one
  const s = samplePlan(); s.transactions.push(line("p1", "2026-08-31", -19.99, "Spotify"), line("p2", "2026-09-01", -19.99, "Spotify"));
  r = reconcile(s, chk(1000 + SEPT));
  assert.deepEqual(r.hints[0].ids, ["p1", "p2"]); assert.equal(r.hints[0].kind, "twice");
  // the wrong sign: the 86.40 at Kroger entered as money in moves the balance by 172.80
  const q = samplePlan(); q.transactions.find((t) => t.id === "t4").amount = 86.40;
  r = reconcile(q, chk(1000 + SEPT));
  near(r.gap, -172.80);
  assert.deepEqual(r.hints.find((h) => h.kind === "sign").ids, ["t4"]); assert.match(r.hints.find((h) => h.kind === "sign").text, /half the difference/);
  // two lines that add up to the gap: Kroger 86.40 + 54.12 = 140.52
  r = reconcile(samplePlan(), chk(1000 + SEPT + 140.52));
  assert.deepEqual(r.hints.find((h) => h.kind === "pair").ids, ["t4", "t5"]);
  assert.equal(r.hints.at(-1).kind, "missing", "a missing line is always the last idea");
  // a line of 0 (a card check) makes no pair with the line that is the whole difference
  const z = samplePlan(); z.transactions.push(line("z", "2026-09-12", 0, "Card verification"));
  assert.deepEqual(kinds(reconcile(z, chk(1000 + SEPT + 15.49))), ["extra", "missing"]);
});

test("two digits swapped: in a line's amount, or in a balance typed here; not for any difference that divides by 9", () => {
  assert.deepEqual(digitSwaps(-8640), [-6840, -4680, -8460, -8046, -8604], "never a new leading 0");
  assert.deepEqual(digitSwaps(45), [405, 540, 54], "0.45 as 4.05, 5.40 or 0.54");
  assert.deepEqual(digitSwaps(0), []);
  // Kroger typed as 86.04 instead of the statement's 86.40
  const s = samplePlan(); s.transactions.find((t) => t.id === "t4").amount = -86.04;
  let r = reconcile(s, chk(1000 + SEPT));
  assert.deepEqual(r.hints.find((h) => h.kind === "swap").ids, ["t4"]); near(r.hints.find((h) => h.kind === "swap").amount, -86.04);
  // on a card: Amazon typed as 42.71
  const c = samplePlan(); c.transactions.find((t) => t.id === "t12").amount = -42.71;
  assert.deepEqual(reconcile(c, visa(640.22, 84.34)).hints.find((h) => h.kind === "swap").ids, ["t12"]);
  // the ending balance typed as 2130.77 for 2103.77
  r = reconcile(samplePlan(), chk(2130.77));
  const typed = r.hints.find((h) => h.kind === "swap");
  assert.ok(typed && !typed.ids.length, "one of the balances typed here"); near(typed.amount, r.fix);
  // differences that divide by 9 but that no swap in a line or a balance makes
  for (const gap of [-0.27, 1.17, -86.40]) assert.ok(!reconcile(samplePlan(), chk(1000 + SEPT + gap)).hints.some((h) => h.kind === "swap"), `no swap for ${gap}`);
});

test("just over the statement's edge: a line dated in the days after it or before it, or one inside it near an edge", () => {
  const p = samplePlan();
  // a −30 line on October 2 that the bank counted in September's statement
  p.transactions.push(line("o1", "2026-10-02", -30, "Gym"));
  const edge = () => reconcile(p, chk(1000 + SEPT - 30)).hints.find((h) => h.kind === "edge");
  assert.deepEqual(edge().ids, ["o1"]); assert.match(edge().text, /just after the statement ends/);
  assert.equal(NEAR_DAYS, 3);
  p.transactions.find((t) => t.id === "o1").date = "2026-10-03";
  assert.deepEqual(edge()?.ids, ["o1"], "3 days after still counts");
  p.transactions.find((t) => t.id === "o1").date = "2026-10-04";
  assert.equal(edge(), undefined, "4 days after is too far");
  // a −30 line on August 29, just before the start
  const b = samplePlan(); b.transactions.push(line("b1", "2026-08-29", -30, "Gym"));
  assert.deepEqual(reconcile(b, chk(1000 + SEPT - 30)).hints.find((h) => h.kind === "edge")?.ids, ["b1"]);
  b.transactions.find((t) => t.id === "b1").date = "2026-08-28";
  assert.ok(!reconcile(b, chk(1000 + SEPT - 30)).hints.some((h) => h.kind === "edge"), "4 days before is too far");
  // a line on file 1 day before the end that the bank put in the next statement
  const q = samplePlan(); q.transactions.push(line("e1", "2026-09-29", -12, "Late fee"));
  let r = reconcile(q, chk(1000 + SEPT));
  assert.deepEqual(r.hints.find((h) => h.kind === "edge").ids, ["e1"], "in the ledger on the 29th, counted by the bank next month");
  assert.match(r.hints.find((h) => h.kind === "edge").text, /last few days .* the next one/);
  // Kroger on the 3rd, near the start: the bank may have put it on the previous statement
  r = reconcile(samplePlan(), chk(1000 + SEPT + 86.40));
  assert.deepEqual(r.hints.find((h) => h.kind === "edge").ids, ["t4"]); assert.match(r.hints.find((h) => h.kind === "edge").text, /first few days .* the previous one/);
  // 3 days before the end is not near it: one line of the difference instead
  const e = samplePlan(); e.transactions.push(line("e4", "2026-09-27", -12, "Late fee"));
  r = reconcile(e, chk(1000 + SEPT));
  assert.ok(!r.hints.some((h) => h.kind === "edge")); assert.deepEqual(r.hints.find((h) => h.kind === "extra").ids, ["e4"]);
});

test("a statement already saved as checked: its lines were counted there, so they are not over this one's edge", () => {
  const p = samplePlan();
  p.reconciliations = [{ id: "a", accountId: "chk", from: "2026-08-01", to: "2026-08-31", startBalance: 0, endBalance: 1000, lines: 4 }];
  p.transactions.push(line("a31", "2026-08-31", -25, "Gym"));
  assert.deepEqual(kinds(reconcile(p, chk(1000 + SEPT - 25))), ["missing"], "August 31 is in the checked August");
  // and Kroger on the 3rd is not on the checked August statement either
  const r = reconcile(p, chk(1000 + SEPT + 86.40));
  assert.ok(!r.hints.some((h) => h.kind === "edge")); assert.deepEqual(r.hints.find((h) => h.kind === "extra").ids, ["t4"]);
});

test("more ideas: the same amount under another account, and a starting balance unlike where the last check ended", () => {
  const p = samplePlan();
  p.transactions.push(line("w", "2026-09-20", -33.33, "Water", "sav"));
  const r = reconcile(p, chk(1000 + SEPT - 33.33));
  const el = r.hints.find((h) => h.kind === "elsewhere");
  assert.deepEqual(el.ids, ["w"]); assert.match(el.text, /Ally savings/);
  assert.ok(!reconcile(p, chk(1000 + SEPT + 500)).hints.some((h) => h.kind === "elsewhere"), "the transfer into savings (+500) is not one");
  // August checked, ending at 1000; September's start typed as 1010
  const q = samplePlan();
  q.reconciliations = [{ id: "a", accountId: "chk", from: "2026-08-01", to: "2026-08-31", startBalance: 0, endBalance: 1000, lines: 4 }];
  const s = reconcile(q, chk(1000 + SEPT, { startBalance: 1010 }));
  assert.deepEqual(kinds(s), ["start", "missing"]); near(s.hints[0].amount, s.fix);
  assert.ok(!reconcile(q, chk(1000 + SEPT + 5, { startBalance: 1010 })).hints.some((h) => h.kind === "start"), "only when the start is the whole difference");
});

test("at most three ideas of a kind, and a line left out by the cap is still offered as another kind", () => {
  const p = samplePlan();
  for (const [i, n] of ["Bakery", "Florist", "Bookshop", "Cinema", "Garage", "Pharmacy"].entries()) p.transactions.push(line(`x${i}`, `2026-09-${String(8 + i).padStart(2, "0")}`, -7, n));
  const r = reconcile(p, chk(1000 + SEPT - 42 + 7));
  assert.equal(MAX_HINTS, 3); assert.equal(r.hints.filter((h) => h.kind === "extra").length, 3, "six candidates, three shown");
  // four lines near the end; the cap shows three as over the edge, the fourth as a line of the difference
  const q = samplePlan();
  for (const [i, d] of ["2026-09-28", "2026-09-29", "2026-09-30", "2026-09-30"].entries()) q.transactions.push(line(`n${i}`, d, -7, ["Bakery", "Florist", "Bookshop", "Cinema"][i]));
  assert.deepEqual(reconcile(q, chk(1000 + SEPT - 28 + 7)).hints.map((h) => [h.kind, h.ids.join()]), [["edge", "n0"], ["edge", "n1"], ["edge", "n2"], ["extra", "n3"], ["missing", ""]]);
});

test("the newest transaction on file, for a statement that runs past it", () => {
  const r = reconcile(samplePlan(), chk(2400, { from: "2026-10-01", to: "2026-10-31", startBalance: 1000 + SEPT }));
  assert.equal(r.lines.length, 0); assert.equal(r.newest, "2026-09-15");
  assert.equal(reconcile(samplePlan(), visa(0, 0, { from: "2026-10-01", to: "2026-10-31" })).matches, true, "nothing happened and nothing changed");
  const e = samplePlan(); e.transactions = [];
  assert.equal(reconcile(e, chk(1000, { endBalance: 1000 })).newest, null);
});

test("what it needs: the account, the two dates in order, both balances", () => {
  const p = samplePlan();
  assert.deepEqual(reconcile(p, chk(1, { accountId: "nope" })), { ready: false, why: "account" });
  assert.deepEqual(reconcile(p, chk(1, { from: "2026-10-01" })), { ready: false, why: "dates" });
  assert.deepEqual(reconcile(p, chk(1, { to: "30/09/2026" })), { ready: false, why: "dates" });
  assert.deepEqual(reconcile(p, chk(null)), { ready: false, why: "balances" });
  assert.equal(reconcile(p, chk(1000, { from: "2026-09-15", to: "2026-09-15" })).lines.length, 1, "a one-day statement");
});

test("a saved check: the record, the next statement starting the day after at its ending balance, the newest saved on a tie", () => {
  const p = samplePlan();
  const input = chk(1000 + SEPT);
  const rec = recordOf(reconcile(p, input), input, { id: "rc1", today: "2026-10-31" });
  assert.deepEqual(rec, { id: "rc1", accountId: "chk", from: "2026-09-01", to: "2026-09-30", startBalance: 1000, endBalance: 1000 + SEPT, lines: 8, at: "2026-10-31" });
  assert.equal(nextStart(p, "chk"), null);
  p.reconciliations = [rec, { ...rec, id: "rc0", from: "2026-08-01", to: "2026-08-31", endBalance: 1000 }];
  assert.deepEqual(nextStart(p, "chk"), { from: "2026-10-01", startBalance: 1000 + SEPT }, "the latest one, by its last day");
  assert.equal(nextStart(p, "visa"), null);
  const d = compute(p);
  assert.equal(d.ready, true);
  assert.equal(d.accounts.find((a) => a.id === "chk").last.id, "rc1"); assert.equal(d.accounts.find((a) => a.id === "visa").liability, true);
  assert.deepEqual(d.records.map((x) => x.id), ["rc1", "rc0"]); assert.equal(d.records[0].accountName, "Chase checking"); assert.equal(d.records[0].liability, false);
  assert.deepEqual(compute(emptyPlan()), { accounts: [], records: [], ready: false });
  // two saved with the same last day: the one saved later wins
  const t = samplePlan();
  t.reconciliations = [{ id: "old", accountId: "chk", from: "2026-09-01", to: "2026-09-30", endBalance: 1100 }, { id: "new", accountId: "chk", from: "2026-09-02", to: "2026-09-30", endBalance: 2203.77 }];
  assert.deepEqual(nextStart(t, "chk"), { from: "2026-10-01", startBalance: 2203.77 });
  assert.equal(compute(t).accounts.find((a) => a.id === "chk").last.id, "new"); assert.deepEqual(compute(t).records.map((x) => x.id), ["new", "old"]);
});

test("saving again: the same account and dates replace the saved one; other days are kept; overlaps are named", () => {
  const a = { id: "a", accountId: "chk", from: "2026-09-01", to: "2026-09-30", endBalance: 1100 };
  const b = { id: "b", accountId: "chk", from: "2026-08-01", to: "2026-08-31", endBalance: 1000 };
  const v = { id: "v", accountId: "visa", from: "2026-09-01", to: "2026-09-30", endBalance: 84.34 };
  const again = { ...a, id: "a2", endBalance: 1000 + SEPT };
  assert.deepEqual(saveRecord([a, b, v], again).map((x) => x.id), ["b", "v", "a2"], "replaced, and now the newest");
  assert.deepEqual(saveRecord(undefined, again).map((x) => x.id), ["a2"]);
  const p = samplePlan(); p.reconciliations = [a, b, v, { id: "m", accountId: "chk", from: "2026-09-16", to: "2026-10-15", endBalance: 0 }];
  const r = reconcile(p, chk(1000 + SEPT));
  assert.deepEqual(r.overlaps.map((x) => [x.id, x.same]).sort(), [["a", true], ["m", false]], "August and the card's are not overlaps");
});

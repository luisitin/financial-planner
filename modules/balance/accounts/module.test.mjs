import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, points, change, flows, sinceCheck, addPoint, saveBalance, removePoint, ticks, axisUnit, isDate, RECENT_DAYS, MONTHS } from "./compute.js";
import { samplePlan } from "../../../qa/fixtures/sample-plan.mjs";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-09-30";

test("the balance points: saved by day, plus the balance on file at its date (it wins that day); a debt's is what is owed", () => {
  const a = { type: "checking", balance: 4200, asOf: "2026-09-15", history: [{ date: "2026-07-31", balance: 3000 }, { date: "2026-09-15", balance: 4100 }, { date: "2026-08-31", balance: "3500" }, { date: "bad", balance: 1 }, { date: "2026-13-01", balance: 5 }, { date: "2026-02-30", balance: 7 }, { date: "2026-06-30", balance: null }] };
  assert.deepEqual(points(a), [{ date: "2026-07-31", balance: 3000 }, { date: "2026-08-31", balance: 3500 }, { date: "2026-09-15", balance: 4200 }], "no impossible days");
  assert.deepEqual(points({ type: "credit", balance: -640, asOf: "2026-09-15", history: [{ date: "2026-08-15", balance: -900 }] }), [{ date: "2026-08-15", balance: 900 }, { date: "2026-09-15", balance: 640 }], "a saved point of a debt too");
  assert.deepEqual(points({ type: "savings", balance: 100 }), [], "a balance with no date is not a point");
  assert.deepEqual(points({ type: "savings", balance: 100, asOf: "2026-31-08" }), [], "nor one with an impossible date");
  assert.deepEqual(points({ type: "checking", history: [{ date: "2026-08-31", balance: 1103.7700000000002 }] }), [{ date: "2026-08-31", balance: 1103.77 }], "to the cent");
  assert.deepEqual(points(null), []);
  assert.equal(isDate("2026-02-28"), true); assert.equal(isDate("2026-02-30"), false); assert.equal(isDate(" 2026-02-28"), false);
});

test("the change: first to last point, in money and as a share, over how many days", () => {
  const c = change([{ date: "2026-07-31", balance: 3000 }, { date: "2026-08-31", balance: 3500 }, { date: "2026-09-15", balance: 4200 }]);
  assert.equal(c.amount, 1200); assert.equal(c.share, 0.4); assert.equal(c.days, 46); assert.equal(c.from.date, "2026-07-31");
  assert.equal(change([{ date: "2026-01-01", balance: 0 }, { date: "2026-02-01", balance: 50 }]).share, null, "from 0 there is no share");
  assert.equal(change([{ date: "2026-01-01", balance: 10 }]), null);
});

test("money in and out: the last 30 days to today, and each of the last six months", () => {
  const p = samplePlan();
  const mine = p.transactions.filter((t) => t.accountId === "chk");
  const f = flows(mine, TODAY);
  assert.equal(RECENT_DAYS, 30); assert.equal(MONTHS, 6);
  // September 1 to 30: in 1950 + 1950, out 1500 + 86.40 + 54.12 + 15.49 + 500 + 640.22
  assert.deepEqual(f.recent, { in: 3900, out: -2796.23, net: 1103.77, count: 8 });
  assert.deepEqual(f.months.map((m) => m.month), ["2026-09", "2026-08", "2026-07", "2026-06", "2026-05", "2026-04"]);
  assert.deepEqual(f.months[1], { month: "2026-08", in: 1950, out: -1608, net: 342, count: 4 });
  assert.equal(f.months[2].count, 0);
  // a 30-day window that starts mid-month
  assert.equal(flows(mine, "2026-09-20").recent.count, 9, "August 22 to September 20: Shell on the 27th and the eight September lines to the 15th");
  assert.equal(flows([{ date: "2026-09-01", amount: 1 }, { date: "2026-08-31", amount: 1 }], TODAY).recent.count, 1, "today and the 29 days before");
  // months across a new year
  assert.deepEqual(flows([], "2026-02-10").months.map((m) => m.month), ["2026-02", "2026-01", "2025-12", "2025-11", "2025-10", "2025-09"]);
});

test("since the last checked statement: its end balance plus the lines after it, against the balance on file", () => {
  const p = samplePlan();
  const acct = p.accounts.find((a) => a.id === "chk");
  assert.equal(sinceCheck(p, acct), null);
  // the latest check is not the first in the list; a line after the balance's date is not counted
  p.reconciliations = [{ id: "r0", accountId: "chk", from: "2026-07-01", to: "2026-07-31", startBalance: 0, endBalance: 1, lines: 1 }, { id: "r1", accountId: "chk", from: "2026-08-01", to: "2026-08-31", startBalance: 0, endBalance: 3000, lines: 4, at: "2026-09-02" }];
  p.transactions.push({ id: "t17", accountId: "chk", date: "2026-09-20", amount: -25, payee: "Late" });
  // the balance on file is dated September 15: the lines from September 1 to 15 count
  const s = sinceCheck(p, acct);
  assert.equal(s.check.id, "r1"); assert.equal(s.lines, 8); assert.equal(s.onFileDate, "2026-09-15");
  assert.ok(Math.abs(s.ledgerBalance - (3000 + 1103.77)) < 1e-9); assert.equal(s.onFile, 4200);
  assert.ok(Math.abs(s.gap - (4200 - 4103.77)) < 1e-9);
  // a card: what is owed moves the other way
  const visa = p.accounts.find((a) => a.id === "visa");
  p.reconciliations.push({ id: "v1", accountId: "visa", from: "2026-08-01", to: "2026-08-31", startBalance: 0, endBalance: 640.22, lines: 0 });
  const v = sinceCheck(p, visa);
  assert.ok(Math.abs(v.ledgerBalance - (640.22 - 640.22 + 42.17 + 42.17)) < 1e-9, "the payment lowers it, the two charges raise it");
  assert.ok(Math.abs(v.gap - (640 - 84.34)) < 1e-9);
  // two checks with the same last day: the one saved later wins
  p.reconciliations.push({ id: "r2", accountId: "chk", from: "2026-08-02", to: "2026-08-31", startBalance: 0, endBalance: 3096.23, lines: 3 });
  assert.equal(sinceCheck(p, acct).check.id, "r2"); assert.equal(sinceCheck(p, acct).gap, 0);
  // a balance on file older than the check: no comparison
  acct.asOf = "2026-08-15";
  assert.equal(sinceCheck(p, acct).gap, null); assert.equal(sinceCheck(p, acct).lines, 9, "every line after August 31, the 20th's too");
});

test("the page's data: the picker, the chosen account (or the first), its points, latest lines and owner", () => {
  const p = samplePlan();
  p.household.people = [{ id: "p1", name: "Pat", role: "self" }];
  p.accounts[0].ownerId = "p1"; p.accounts[0].notes = "Fee-free";
  const d = compute(p, { today: TODAY });
  assert.deepEqual(d.accounts.map((a) => [a.id, a.lines, a.liability]), [["chk", 12, false], ["sav", 1, false], ["visa", 3, true]]);
  assert.equal(d.account.id, "chk"); assert.equal(d.account.owner, "Pat"); assert.equal(d.account.notes, "Fee-free"); assert.equal(d.account.label, "Checking");
  assert.deepEqual(d.recent.map((t) => t.id), ["t1", "t9", "t5", "t7", "t6"], "newest first, five");
  assert.equal(d.lines, 12); assert.equal(d.points.length, 1); assert.equal(d.change, null);
  assert.equal(compute(p, { today: TODAY, accountId: "visa" }).account.liability, true);
  assert.equal(compute(p, { today: TODAY, accountId: "gone" }).account.id, "chk", "an unknown id opens the first");
  assert.equal(compute(p, {}).flows, null, "no date, no flows");
  assert.deepEqual(compute(emptyPlan(), { today: TODAY }), { accounts: [], account: null });
});

test("adding and removing a balance point (one per day; the balance on file is not touched)", () => {
  const p = samplePlan();
  assert.equal(addPoint(p, "chk", "2026-08-31", 3400), true);
  assert.equal(addPoint(p, "chk", "2026-07-31", 3000), true);
  assert.equal(addPoint(p, "chk", "2026-08-31", "3450.5"), true, "the same day again replaces it");
  const a = p.accounts.find((x) => x.id === "chk");
  assert.deepEqual(a.history, [{ date: "2026-07-31", balance: 3000 }, { date: "2026-08-31", balance: 3450.5 }]);
  assert.equal(addPoint(p, "chk", "31/08/2026", 1), false); assert.equal(addPoint(p, "chk", "2026-08-01", ""), false); assert.equal(addPoint(p, "nope", "2026-08-01", 1), false);
  assert.equal(removePoint(p, "chk", "2026-07-31"), true); assert.equal(removePoint(p, "chk", "2026-07-31"), false);
  assert.deepEqual(a.history, [{ date: "2026-08-31", balance: 3450.5 }]); assert.equal(a.balance, 4200);
  assert.equal(compute(p, { today: TODAY }).change.amount, 4200 - 3450.5);
});

test("saving a balance here: a day before the balance on file is a point; that day or later moves the balance on file too", () => {
  const p = samplePlan();
  const a = p.accounts.find((x) => x.id === "chk");
  assert.deepEqual(saveBalance(p, "chk", "2026-08-31", 3500), { saved: true, onFile: false });
  assert.equal(a.balance, 4200); assert.equal(a.asOf, "2026-09-15");
  // the same day as the balance on file: it changes, so the chart and the top of the page agree
  assert.deepEqual(saveBalance(p, "chk", "2026-09-15", 4100), { saved: true, onFile: true });
  assert.equal(a.balance, 4100); assert.deepEqual(points(a).at(-1), { date: "2026-09-15", balance: 4100 });
  // a later day: the balance on file and its date move to it
  assert.deepEqual(saveBalance(p, "chk", "2026-09-30", 5000), { saved: true, onFile: true });
  assert.equal(a.balance, 5000); assert.equal(a.asOf, "2026-09-30");
  assert.equal(compute(p, { today: TODAY }).change.to.date, "2026-09-30");
  // a card stored with the minus sign keeps it; one stored as owed stays positive
  const v = p.accounts.find((x) => x.id === "visa");
  v.balance = -640; saveBalance(p, "visa", "2026-09-30", 500); assert.equal(v.balance, -500);
  v.balance = 640; saveBalance(p, "visa", "2026-10-01", -450); assert.equal(v.balance, 450);
  // no dated balance yet: the first one becomes it
  const s = p.accounts.find((x) => x.id === "sav"); s.asOf = null; s.balance = null;
  assert.deepEqual(saveBalance(p, "sav", "2026-09-01", 11000), { saved: true, onFile: true }); assert.equal(s.balance, 11000);
  assert.deepEqual(saveBalance(p, "chk", "bad", 1), { saved: false, onFile: false });
});

test("the side of the chart: clean steps over the balances, never stuck on a flat line or float noise, labelled without repeats", () => {
  const label = (lo, hi) => { const tk = ticks(lo, hi), u = axisUnit(tk); return tk.map((v) => (u.big ? `${(v / 1000).toFixed(u.digits)}K` : String(v))); };
  assert.deepEqual(ticks(3000, 4200), [3000, 3500, 4000, 4500]);
  assert.deepEqual(ticks(-500, 250), [-500, -250, 0, 250], "an overdraft");
  // float noise and a flat line: a few whole steps around it, and the loop ends
  assert.deepEqual(ticks(1103.77, 1103.7700000000002), [1090, 1100, 1110, 1120]);
  assert.deepEqual(ticks(4103.7699999999995, 4103.77), [4050, 4100, 4150]);
  assert.deepEqual(ticks(0.3, 0.30000000000000004), [-1, 0, 1, 2]);
  assert.deepEqual(label(4200, 4200), ["4150", "4200", "4250"]);
  // in thousands from 10,000, with the decimals the step needs
  assert.deepEqual(label(11500, 11500), ["11.3K", "11.4K", "11.5K", "11.6K", "11.7K"]);
  assert.deepEqual(label(10200, 11500), ["10.0K", "10.5K", "11.0K", "11.5K"]);
  assert.deepEqual(label(10000, 17000), ["10.0K", "12.5K", "15.0K", "17.5K"]);
  assert.deepEqual(label(10000, 10700), ["10.00K", "10.25K", "10.50K", "10.75K"]);
  assert.deepEqual(label(9800, 10200), ["9.8K", "10.0K", "10.2K"]);
  assert.deepEqual(label(0, 250000), ["0K", "100K", "200K", "300K"]);
  for (const [lo, hi] of [[11500, 11500], [250000, 250000], [9800, 10200], [10000, 17000], [50, 51], [100, 100.01], [999999, 1000001], [0, 0], [-640, -640]]) {
    const tk = ticks(lo, hi), l = label(lo, hi);
    assert.ok(tk[0] <= lo && tk.at(-1) >= hi && tk.length >= 2 && tk.length <= 8, `${lo}..${hi} covered`);
    assert.equal(new Set(l).size, l.length, `${lo}..${hi}: no label twice`);
  }
});

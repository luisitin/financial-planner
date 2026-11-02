import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, saveAll, keepOnFile, STALE_DAYS } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-11-01";
const plan = () => ({
  ...emptyPlan(),
  accounts: [
    { id: "chk", name: "Checking", type: "checking", balance: 3200, asOf: "2026-10-20", history: [] },
    { id: "sav", name: "Savings", type: "savings", balance: 8500, asOf: "2026-08-01", history: [{ date: "2026-08-01", balance: 8500 }] },
    { id: "401", name: "401(k)", type: "401k", balance: 41000 },
    { id: "visa", name: "Visa", type: "credit", balance: -4200, asOf: "2026-09-15" },
    { id: "car", name: "Car loan", type: "loan", balance: 9000, asOf: "2026-10-31" },
  ],
  netWorthHistory: [{ date: "2026-10-01", assets: 50000, liabilities: 14000, netWorth: 36000 }, { date: "2026-09-01", assets: 1, liabilities: 1, netWorth: 0 }],
});

test("the list: what you own first, biggest first, then what you owe as amounts owed; how old each balance is", () => {
  const d = compute(plan(), { today: TODAY });
  assert.deepEqual(d.rows.map((r) => r.id), ["401", "sav", "chk", "car", "visa"]);
  const by = Object.fromEntries(d.rows.map((r) => [r.id, r]));
  assert.equal(by.visa.balance, 4200, "a card stored as -4,200 shows 4,200 owed");
  assert.equal(by.visa.debt, true);
  assert.equal(by.chk.days, 12); assert.equal(by.chk.stale, false);
  assert.equal(by.sav.days, 92); assert.equal(by.sav.stale, true);
  assert.equal(by["401"].asOf, null); assert.equal(by["401"].days, null); assert.equal(by["401"].stale, true, "an undated balance needs a date");
  assert.equal(by.visa.days, 47); assert.equal(by.visa.stale, true);
  assert.equal(by.car.stale, false);
  assert.equal(d.count, 5); assert.equal(d.stale, 3); assert.equal(d.oldest, "2026-08-01");
  assert.equal(d.netWorth, 3200 + 8500 + 41000 - 4200 - 9000);
  assert.equal(d.lastSaved.date, "2026-10-01");
  assert.equal(STALE_DAYS, 31);
});

test("a balance exactly a month old is fine; a day more is stale; an impossible date counts as not dated", () => {
  const p = plan();
  p.accounts = [{ id: "a", name: "A", type: "checking", balance: 1, asOf: "2026-10-01" }, { id: "b", name: "B", type: "checking", balance: 1, asOf: "2026-09-30" }, { id: "c", name: "C", type: "checking", balance: 1, asOf: "2026-02-30" }];
  const by = Object.fromEntries(compute(p, { today: TODAY }).rows.map((r) => [r.id, r]));
  assert.equal(by.a.days, 31); assert.equal(by.a.stale, false);
  assert.equal(by.b.days, 32); assert.equal(by.b.stale, true);
  assert.equal(by.c.asOf, null); assert.equal(by.c.stale, true);
});

test("saving dates each typed balance today, adds a history point, and puts today's totals on the net worth history", () => {
  const p = plan();
  const r = saveAll(p, { chk: 3350.5, sav: 8500, "401": 42000, visa: 3900, car: 9000 }, TODAY);
  assert.equal(r.saved, 5);
  assert.equal(r.changed, 3, "checking, 401(k) and Visa changed; savings and the car loan are still right");
  for (const a of p.accounts) assert.equal(a.asOf, TODAY, `${a.name} dated today`);
  const by = Object.fromEntries(p.accounts.map((a) => [a.id, a]));
  assert.equal(by.chk.balance, 3350.5);
  assert.equal(by.visa.balance, -3900, "the card keeps the sign it was stored with");
  assert.equal(by.car.balance, 9000);
  assert.deepEqual(by.sav.history, [{ date: "2026-08-01", balance: 8500 }, { date: TODAY, balance: 8500 }], "still right today is a point too");
  assert.deepEqual(by["401"].history, [{ date: TODAY, balance: 42000 }]);
  assert.deepEqual(by.chk.history, [{ date: "2026-10-20", balance: 3200 }, { date: TODAY, balance: 3350.5 }], "the old balance stays a point on its own date");
  assert.deepEqual(by.visa.history, [{ date: "2026-09-15", balance: -4200 }, { date: TODAY, balance: 3900 }]);
  const nw = 3350.5 + 8500 + 42000 - 3900 - 9000;
  assert.equal(r.netWorth, nw);
  assert.deepEqual(p.netWorthHistory.find((h) => h.date === TODAY), { date: TODAY, assets: 3350.5 + 8500 + 42000, liabilities: 3900 + 9000, netWorth: nw });
  assert.equal(r.before.date, "2026-10-01", "the last point before today, whatever the order on file");
  assert.equal(compute(p, { today: TODAY }).stale, 0);
});

test("an empty box leaves that account alone; nothing typed saves nothing", () => {
  const p = plan();
  const r = saveAll(p, { chk: 3300, sav: null, visa: "" }, TODAY);
  assert.equal(r.saved, 1);
  assert.equal(p.accounts.find((a) => a.id === "sav").asOf, "2026-08-01");
  assert.equal(p.accounts.find((a) => a.id === "visa").balance, -4200);
  assert.equal(p.accounts.find((a) => a.id === "401").asOf, undefined, "not in the typed list: untouched");
  const q = plan();
  const none = saveAll(q, { chk: null, sav: undefined }, TODAY);
  assert.deepEqual(none, { saved: 0, changed: 0, corrected: 0, netWorth: null, before: { date: "2026-10-01", assets: 50000, liabilities: 14000, netWorth: 36000 } });
  assert.equal(q.netWorthHistory.length, 2, "no totals saved when nothing was");
  assert.deepEqual(saveAll(plan(), { chk: 1 }, "2026-02-30"), { saved: 0, changed: 0, corrected: 0, netWorth: null, before: null }, "a bad day saves nothing");
});

test("a second save the same day replaces that day's points; a future 'as of' (a typo) becomes today", () => {
  const p = plan();
  saveAll(p, { chk: 3300 }, TODAY);
  saveAll(p, { chk: 3310 }, TODAY);
  const chk = p.accounts.find((a) => a.id === "chk");
  assert.deepEqual(chk.history, [{ date: "2026-10-20", balance: 3200 }, { date: TODAY, balance: 3310 }], "the old point once, today's replaced");
  assert.equal(p.netWorthHistory.filter((h) => h.date === TODAY).length, 1);
  const q = plan();
  q.accounts[0].asOf = "2027-01-01";
  saveAll(q, { chk: 3400 }, TODAY);
  assert.equal(q.accounts[0].asOf, TODAY);
  assert.equal(q.accounts[0].balance, 3400);
  assert.deepEqual(q.accounts[0].history, [{ date: TODAY, balance: 3400 }], "the typo date is not kept as history");
});

test("an overdrawn checking account is typed and shown as a negative balance", () => {
  const p = plan();
  p.accounts = [{ id: "o", name: "Overdrawn", type: "checking", balance: -120, asOf: TODAY }];
  assert.equal(compute(p, { today: TODAY }).rows[0].balance, -120);
  saveAll(p, { o: -80 }, TODAY);
  assert.equal(p.accounts[0].balance, -80);
});

test("an empty plan has no rows", () => {
  const d = compute(emptyPlan(), { today: TODAY });
  assert.equal(d.count, 0); assert.equal(d.stale, 0); assert.equal(d.oldest, null); assert.equal(d.lastSaved, null);
});

test("keeping the balance on file as a point: only with a real date and when that day has none", () => {
  const p = plan();
  const chk = p.accounts[0];
  assert.equal(keepOnFile(p, chk), true); assert.deepEqual(chk.history, [{ date: "2026-10-20", balance: 3200 }]);
  assert.equal(keepOnFile(p, chk), false, "that day has one now");
  assert.equal(keepOnFile(p, p.accounts[2]), false, "no date");
  assert.equal(keepOnFile(p, { ...p.accounts[1], asOf: "2026-02-30" }), false, "an impossible date");
  assert.equal(keepOnFile(p, null), false);
  const q = plan();
  assert.equal(keepOnFile(q, q.accounts[0], "2026-10-20"), false, "not before today");
  assert.equal(keepOnFile(q, q.accounts[0], TODAY), true);
});

// ---- a typing mistake on file is fixed where it stood, not recorded as a fall (round 4, 2026-11-02)
import { looksLikeSlip, correctSlip, slipsIn } from "./compute.js";
import { familyPlan as famPlan } from "../../../qa/fixtures/family-plan.mjs";
test("looksLikeSlip: a digit added or dropped, or two neighbours swapped; not an ordinary change", () => {
  for (const [a, b] of [[115000, 11500], [11500, 115000], [6400, 640], [100000, 1000], [15000, 51000], [86000, 68000]]) assert.equal(looksLikeSlip(a, b), true, `${a} -> ${b}`);
  for (const [a, b] of [[12345, 12354], [6400, 0], [5000, 6000], [50, 500], [11500, 11500], [20000, 30000], [-6400, -640 * 2]]) assert.equal(looksLikeSlip(a, b), false, `${a} -> ${b}`);
  assert.equal(looksLikeSlip(-6400, 640), true);   // a debt typed as what is owed
  // review 2026-11-02: decided on the digits: a stray zero inside the figure is caught; an ordinary month is not
  for (const [a, b] of [[15000, 105000], [105000, 15000], [1500, 10500], [2500, 250]]) assert.equal(looksLikeSlip(a, b), true, `${a} -> ${b}`);
  for (const [a, b] of [[600, 5400], [4200, 3900], [2500, 26000], [9000, 900 * 11]]) assert.equal(looksLikeSlip(a, b), false, `${a} -> ${b}`);
});
test("fixing a mistyped balance corrects its points and the saved totals from the day it was typed", () => {
  const p = famPlan("2026-10-02");
  saveAll(p, { "a-sav": 115000 }, "2026-10-02");    // the slip: 115,000 for 11,500
  saveAll(p, { "a-chk": 4300 }, "2026-10-15");      // a later save carries it in the totals
  const wrong10 = p.netWorthHistory.find((s) => s.date === "2026-10-15").netWorth;
  assert.deepEqual(slipsIn(p, { "a-sav": 11500, "a-chk": 4300 }).map((x) => [x.id, x.was, x.now]), [["a-sav", 115000, 11500]]);
  const fixed = structuredClone(p);
  const r = saveAll(fixed, { "a-sav": 11500 }, "2026-11-02", { corrections: ["a-sav"] });
  assert.equal(r.corrected, 1); assert.equal(r.changed, 0);
  const ally = fixed.accounts.find((a) => a.id === "a-sav");
  assert.ok(ally.history.every((h) => h.balance === 11500), "no point keeps the wrong figure");
  assert.equal(fixed.netWorthHistory.find((s) => s.date === "2026-10-15").netWorth, wrong10 - 103500);
  assert.equal(fixed.netWorthHistory.find((s) => s.date === "2026-01-01").netWorth, p.netWorthHistory.find((s) => s.date === "2026-01-01").netWorth, "totals before the slip are untouched");
  assert.equal(r.netWorth - r.before.netWorth, 0, "no fall since the last save");
  // the old way, for contrast: a fall of $103,500 and the wrong figure kept as a point
  const plain = structuredClone(p);
  const q = saveAll(plain, { "a-sav": 11500 }, "2026-11-02");
  assert.equal(q.netWorth - q.before.netWorth, -103500);
  assert.ok(plain.accounts.find((a) => a.id === "a-sav").history.some((h) => h.balance === 115000));
});
test("correctSlip on a debt moves what is owed in the saved totals and keeps the stored sign", () => {
  const p = famPlan("2026-10-02");
  const visa = p.accounts.find((a) => a.id === "a-visa"); visa.balance = -64000;   // a slip for 6,400, stored negative
  p.netWorthHistory.push({ date: "2026-10-02", assets: 600000, liabilities: 349200, netWorth: 250800 });
  const r = correctSlip(p, "a-visa", 6400);
  assert.equal(visa.balance, -6400); assert.equal(r.wrong, 64000); assert.equal(r.from, "2026-10-02");
  const s = p.netWorthHistory.find((x) => x.date === "2026-10-02");
  assert.equal(s.liabilities, 349200 - 57600); assert.equal(s.netWorth, 250800 + 57600);
  assert.deepEqual(correctSlip(p, "nope", 1), { fixed: 0, wrong: null, from: null });
});

test("review 2026-11-02: a typo fix moves only the totals saved after the wrong figure was typed", async () => {
  const { markTyped, correctSlip: fix } = await import("./compute.js");
  const { saveBalance } = await import("../accounts/compute.js");
  const { compute: nwOf } = await import("../net-worth/compute.js");
  const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
  // a total saved in the morning, then Account detail types 115,000 for the same day: today's total follows it
  const p = familyPlan("2026-10-02");
  const morning = nwOf(p, { today: "2026-10-02" });
  p.netWorthHistory = [{ date: "2026-10-02", assets: morning.assets, liabilities: morning.liabilities, netWorth: morning.netWorth }];
  saveBalance(p, "a-sav", "2026-10-02", 115000); markTyped(p, "a-sav", "2026-10-02");
  assert.equal(p.netWorthHistory[0].netWorth, morning.netWorth + 103500, "today's total holds the figure typed today");
  assert.equal(p.accounts.find((a) => a.id === "a-sav").typedOn, "2026-10-02");
  // a month later the typo is fixed: the history goes back to the true figure, no dip and recovery
  saveAll(p, { "a-sav": 11500 }, "2026-11-02", { corrections: ["a-sav"] });
  assert.equal(p.netWorthHistory.find((h) => h.date === "2026-10-02").netWorth, morning.netWorth);
  // a back-dated "as of": a total saved between that day and the day it was typed never held it, so it is left alone
  const q = familyPlan("2026-10-02");
  const t = nwOf(q, { today: "2026-10-20" });
  q.netWorthHistory = [{ date: "2026-10-20", assets: t.assets, liabilities: t.liabilities, netWorth: t.netWorth }];
  saveBalance(q, "a-sav", "2026-10-15", 115000); markTyped(q, "a-sav", "2026-11-02");
  fix(q, "a-sav", 11500);
  assert.equal(q.netWorthHistory[0].netWorth, t.netWorth, "the Oct 20 total held 11,500 all along");
});

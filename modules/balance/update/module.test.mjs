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
  assert.deepEqual(none, { saved: 0, changed: 0, netWorth: null, before: { date: "2026-10-01", assets: 50000, liabilities: 14000, netWorth: 36000 } });
  assert.equal(q.netWorthHistory.length, 2, "no totals saved when nothing was");
  assert.deepEqual(saveAll(plan(), { chk: 1 }, "2026-02-30"), { saved: 0, changed: 0, netWorth: null, before: null }, "a bad day saves nothing");
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

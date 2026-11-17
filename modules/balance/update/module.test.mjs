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

// ---- an account in another currency or only partly yours (net-worth/worked.js, gap next-60 #18 and #19) ---------------------
const worldPlan = () => ({
  ...emptyPlan(),
  currencyRates: { EUR: { rate: 1.08, asOf: "2026-10-15" } },
  accounts: [
    { id: "chk", name: "Checking", type: "checking", balance: 3200, asOf: "2026-10-20", history: [] },
    { id: "eu", name: "Paris savings", type: "savings", balance: 12960, asOf: "2026-10-15", currency: "EUR", fullBalance: 12000, history: [] },
    { id: "flat", name: "Lyon flat", type: "property", balance: 216000, asOf: "2026-10-15", currency: "EUR", fullBalance: 200000, history: [] },
    { id: "cab", name: "Lake cabin", type: "property", balance: 200000, asOf: "2026-10-15", share: 0.5, fullBalance: 400000, history: [] },
  ],
  netWorthHistory: [],
});
test("the list asks the whole in its own currency for such an account, and lists the rate of each currency in use", () => {
  const d = compute(worldPlan(), { today: TODAY });
  const by = Object.fromEntries(d.rows.map((r) => [r.id, r]));
  assert.ok(!("own" in by.chk), "a plain account's row is as before");
  assert.deepEqual(by.eu.own, { code: "EUR", share: 1, rate: 1.08, full: 12000, words: "in euros at $1.08 a euro" });
  assert.deepEqual(by.cab.own, { code: null, share: 0.5, rate: 1, full: 400000, words: "the whole account; your half counts" });
  assert.equal(by.eu.balance, 12960, "the balance as counted, as before");
  assert.deepEqual(d.rates, [{ code: "EUR", rate: 1.08, asOf: "2026-10-15" }]);
  assert.ok(!("rates" in compute(plan(), { today: TODAY })), "no key for a plan with every account in dollars");
});
test("saveAll through worked.js: a new rate first (every account in it moves), then each whole typed worked into its balance; the slip check in its own currency", () => {
  const p = worldPlan();
  const r = saveAll(p, { eu: 12500, cab: 410000, chk: 3300 }, TODAY, { rates: { EUR: 1.1 } });
  const by = (id) => p.accounts.find((a) => a.id === id);
  assert.deepEqual([by("eu").balance, by("eu").fullBalance, by("flat").balance, by("cab").balance, by("cab").fullBalance, by("chk").balance], [13750, 12500, 220000, 205000, 410000, 3300]);
  assert.deepEqual(p.currencyRates.EUR, { rate: 1.1, asOf: TODAY });
  assert.deepEqual([r.saved, r.changed], [3, 3]);
  assert.deepEqual(r.rated.map((x) => [x.code, x.from, x.to, x.moved.length]), [["EUR", 1.08, 1.1, 2]]);
  assert.equal(r.netWorth, 3300 + 13750 + 220000 + 205000);
  assert.deepEqual(p.netWorthHistory.at(-1), { date: TODAY, assets: 442050, liabilities: 0, netWorth: 442050 });
  // the same rate typed again: dated today, nothing moved, no `rated`
  const q = worldPlan();
  const r2 = saveAll(q, { eu: 12000 }, TODAY, { rates: { EUR: 1.08 } });
  assert.ok(!("rated" in r2));
  assert.deepEqual([q.currencyRates.EUR, r2.changed], [{ rate: 1.08, asOf: TODAY }, 0], "EUR 12,000 again: still right today");
  // the slip check compares the whole in euros: 1,200 typed for 12,000 on file is a dropped digit; 12,960 (the dollars) is no slip
  assert.deepEqual(slipsIn(worldPlan(), { eu: 1200 }), [{ id: "eu", name: "Paris savings", was: 12000, now: 1200, code: "EUR" }]);
  assert.deepEqual(slipsIn(worldPlan(), { eu: 12500 }), []);
  assert.deepEqual(slipsIn(worldPlan(), { cab: 40000 }), [{ id: "cab", name: "Lake cabin", was: 400000, now: 40000 }], "the whole, a zero dropped");
  // "was a mistake": EUR 1,200 was right all along; what it counts ($1,296) is fixed where it stood
  const s = worldPlan();
  s.accounts[1].history = [{ date: "2026-10-15", balance: 12960 }];
  const r3 = saveAll(s, { eu: 1200 }, TODAY, { corrections: ["eu"] });
  assert.deepEqual([r3.corrected, r3.changed, s.accounts[1].balance, s.accounts[1].fullBalance, s.accounts[1].history.find((h) => h.date === "2026-10-15").balance], [1, 0, 1296, 1200, 1296]);
});
test("the page: a rate box per currency above the list, the whole in euros in its box; Save says the new rate, with Undo", async () => {
  const { renderPage } = await import("../../../qa/fixtures/fake-dom.mjs");
  const r = await renderPage(new URL("./view.js", import.meta.url), worldPlan(), TODAY, { computeOf: { "balance/update": compute } });
  const box = (n) => r.root.all().find((e) => e.getAttribute?.("name") === n);
  const t = r.text().replace(/ /g, " ");
  assert.match(t, /Currency rates 1 euro in dollars Your rate of 10\/15\/2026\. Leave it if it is still right today; every account in euros moves with it\. What you own/);
  assert.match(t, /Paris savings updated 17 days ago EUR Savings \/ MMF · in euros at \$1\.08 a euro|Paris savings updated 17 days ago EUR Savings or money market · in euros at \$1\.08 a euro/);
  assert.match(t, /Lake cabin updated 17 days ago \$ Real estate · the whole account; your half counts/);
  assert.equal(box("eu").value, "12,000");
  assert.equal(box("rate-EUR").value, "1.08");
  assert.equal(box("eu").getAttribute("aria-label"), "Paris savings: balance in euros");
  box("rate-EUR").value = "1.1";
  const form = r.root.all().find((e) => e.tagName === "FORM");
  form.dispatch("submit");
  const after = r.saved.at(-1);
  assert.deepEqual([after.currencyRates.EUR.rate, after.accounts.find((a) => a.id === "flat").balance], [1.1, 220000]);
});

// ---- the critics' findings, 2026-11-17 ------------------------------------------------------------------------------------
test("critic F1: Save all balances with nothing touched leaves a balance read back from dollars to the cent, and the rate as it was", () => {
  // every pairing of a balance in dollars and a rate: the box shows the whole read back; saved as it is, nothing moves
  let moved = 0, n = 0;
  for (const rate of [1.08, 1.37, 0.79, 7.25]) for (const share of [1, 0.5, 1 / 3]) for (let b = 100; b < 400; b += 0.37) {
    const bal = Math.round(b * 100) / 100;
    const p = { ...emptyPlan(), currencyRates: { EUR: { rate, asOf: "2026-10-15" } }, netWorthHistory: [],
      accounts: [{ id: "eu", name: "Paris savings", type: "savings", balance: bal, asOf: "2026-10-15", currency: "EUR", ...(share < 1 ? { share } : {}), history: [] }] };
    const box = compute(p, { today: TODAY }).rows[0].own.full;
    const r = saveAll(p, { eu: box }, TODAY, { rates: { EUR: rate } });
    n++;
    if (Math.abs(p.accounts[0].balance - bal) > 0.001 || r.changed || p.accounts[0].history.some((h) => Math.abs(h.balance - bal) > 0.001)) moved++;
  }
  assert.equal(moved, 0, `${moved} of ${n} balances moved with nothing touched`);
});
test("critic F2: an account in a currency with no rate: the page asks for the rate, never \"every box was empty\"", async () => {
  const p = { ...emptyPlan(), netWorthHistory: [], accounts: [{ id: "eu", name: "Paris savings", type: "savings", balance: 500, asOf: "2026-10-15", currency: "EUR", history: [] }] };
  const r = saveAll(structuredClone(p), { eu: 600 }, TODAY, {});
  assert.deepEqual([r.saved, r.noRate], [0, [{ id: "eu", name: "Paris savings", code: "EUR" }]]);
  assert.ok(!("noRate" in saveAll(worldPlan(), { eu: 12500 }, TODAY, {})), "no key when every currency has its rate");
  // the page as the shell runs it: drawn again after a save (the shell draws once the save is done); the words a box is
  // refused with, caught
  const { FakeElement, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const ui = await import("../../../core/ui/dom.js");
  const fmt = await import("../../../core/format.js");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { render } = await import("./view.js");
  const page = (plan0) => {
    const x = { plan: migrate(structuredClone(plan0)), saves: 0, refused: [] };
    const fieldError = (box, text) => { x.refused.push([box?.getAttribute("name"), text]); return false; };
    x.draw = () => { x.root = new FakeElement("main"); render(x.root, { ui: { ...ui, fieldError }, fmt: { ...fmt, today: () => TODAY }, plan: x.plan, route: { rest: [] },
      computeOf: (k, pr = {}) => (k === "balance/update" ? compute(x.plan, { today: TODAY, ...pr }) : null),
      store: { get: () => x.plan, update: (fn) => { const d = structuredClone(x.plan); fn(d); x.plan = d; x.saves++; } } }); return x; };
    x.text = () => textOf(x.root).replace(/\u00a0/g, " ");
    x.box = (nm) => x.root.all().find((e) => e.getAttribute?.("name") === nm);
    x.send = () => { x.root.all().find((e) => e.tagName === "FORM").dispatch("submit"); x.draw(); };
    return x.draw();
  };
  // a balance typed, the rate box left empty: asked at the rate box, nothing saved
  const A = page(p);
  assert.match(A.text(), /1 euro in dollars No rate on file yet: type today's, for example 1\.08 if 1 euro buys \$1\.08\./);
  A.box("eu").value = "600";
  A.send();
  assert.equal(A.saves, 0);
  assert.deepEqual(A.refused, [["rate-EUR", "Type what 1 euro is worth in dollars first: Paris savings is in euros, and its balance counts at that rate."]]);
  // left as it was (the box still holds what was on file) and nothing else to save: said with what to type
  const B = page(p);
  B.send();
  assert.match(B.text(), /Nothing was saved\. Paris savings is in euros: type what 1 euro is worth in dollars above it, then save\./);
  assert.doesNotMatch(B.text(), /every box was empty/);
  // beside a balance that saves: saved, and the one left as it was is said
  const q = structuredClone(p);
  q.accounts.push({ id: "chk", name: "Checking", type: "checking", balance: 900, asOf: "2026-10-15", history: [] });
  const C = page(q);
  C.box("chk").value = "950";
  C.send();
  assert.equal(C.plan.accounts.find((a) => a.id === "chk").balance, 950);
  assert.match(C.text(), /Balances saved for today: 1 changed\. Net worth is \$1,450\. Left as it was: Paris savings is in euros: type what 1 euro is worth in dollars above it, then save\./);
  // with the rate typed it saves
  const D = page(p);
  D.box("rate-EUR").value = "1.08"; D.box("eu").value = "600";
  D.send();
  assert.deepEqual([D.plan.accounts[0].balance, D.plan.accounts[0].fullBalance, D.refused], [648, 600, []]);
});

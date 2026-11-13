import { test } from "node:test";
import assert from "node:assert/strict";
import { compute, detectRecurring, nextAfter, addDays, wentUp, billFrom, addBill } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";

const TODAY = "2026-09-15";
const tx = (id, date, amount, payee, accountId = "chk", category = "") => ({ id, date, amount, payee, rawPayee: payee.toUpperCase(), accountId, category });
export function recurringPlan() {
  const p = emptyPlan();
  p.accounts.push({ id: "chk", name: "Checking", type: "checking", balance: 4000 });
  p.transactions.push(
    tx("n1", "2026-06-05", -15.49, "Netflix", "chk", "subscriptions"), tx("n2", "2026-07-05", -15.49, "Netflix", "chk", "subscriptions"), tx("n3", "2026-08-05", -15.49, "Netflix", "chk", "subscriptions"), tx("n4", "2026-09-05", -15.49, "Netflix", "chk", "subscriptions"),
    tx("p1", "2026-07-03", 1950, "Acme Corp Payroll", "chk", "income-salary"), tx("p2", "2026-07-17", 1950, "Acme Corp Payroll", "chk", "income-salary"), tx("p3", "2026-07-31", 1950, "Acme Corp Payroll", "chk", "income-salary"), tx("p4", "2026-08-14", 1950, "Acme Corp Payroll", "chk", "income-salary"), tx("p5", "2026-08-28", 1950, "Acme Corp Payroll", "chk", "income-salary"), tx("p6", "2026-09-11", 1950, "Acme Corp Payroll", "chk", "income-salary"),
    tx("k1", "2026-08-02", -86.40, "Kroger", "chk", "groceries"), tx("k2", "2026-08-05", -12.10, "Kroger", "chk", "groceries"), tx("k3", "2026-08-19", -140.00, "Kroger", "chk", "groceries"), tx("k4", "2026-09-01", -54.12, "Kroger", "chk", "groceries"),
    tx("i1", "2025-09-10", -540, "Allstate Insurance", "chk", "insurance"), tx("i2", "2026-09-10", -540, "Allstate Insurance", "chk", "insurance"),
    tx("g1", "2026-05-20", -49, "Gym Membership", "chk", "fun"), tx("g2", "2026-06-20", -49, "Gym Membership", "chk", "fun"), tx("g3", "2026-07-20", -49, "Gym Membership", "chk", "fun"),
    tx("x1", "2026-09-06", -500, "Online Transfer To Sav", "chk", "transfer", ), tx("x2", "2026-08-06", -500, "Online Transfer To Sav", "chk", "transfer"), tx("x3", "2026-07-06", -500, "Online Transfer To Sav", "chk", "transfer"),
  );
  p.expenses.push({ id: "e1", name: "Rent", category: "housing", amount: 1500, period: "monthly" });
  p.income.push({ id: "in1", name: "Pay", type: "salary", amount: 1950, period: "biweekly" });
  return p;
}

test("date helpers", () => {
  assert.equal(addDays("2026-01-30", 3), "2026-02-02");
  assert.equal(nextAfter("2026-09-05", "monthly", "2026-09-15"), "2026-10-05");
  assert.equal(nextAfter("2026-09-11", "biweekly", "2026-09-15"), "2026-09-25");
  assert.equal(nextAfter("2026-09-10", "annual", "2026-09-15"), "2027-09-10");
  assert.equal(nextAfter("2026-09-30", "monthly", "2026-10-15"), "2026-10-30");
});
test("finds monthly, biweekly and yearly items; not a grocery store; not transfers; flags the missed gym", () => {
  const p = recurringPlan();
  const d = compute(p, { today: TODAY });
  const by = (name) => d.detected.find((r) => r.payee === name);
  assert.equal(by("Netflix").cadence, "monthly"); assert.equal(by("Netflix").amount, -15.49); assert.equal(by("Netflix").next, "2026-10-05"); assert.equal(by("Netflix").missed, false); assert.equal(by("Netflix").count, 4);
  assert.equal(by("Acme Corp Payroll").cadence, "biweekly"); assert.equal(by("Acme Corp Payroll").amount, 1950); assert.equal(by("Acme Corp Payroll").next, "2026-09-25");
  assert.equal(by("Allstate Insurance").cadence, "annual", "two identical yearly lines are enough"); assert.equal(by("Allstate Insurance").next, "2027-09-10");
  assert.equal(by("Kroger"), undefined, "uneven amounts and gaps: a shop, not a bill");
  assert.equal(by("Online Transfer To Sav"), undefined, "transfers are not bills");
  const gym = by("Gym Membership");
  assert.equal(gym.missed, true); assert.equal(gym.next, "2026-08-20", "the expected date that never came");
  assert.equal(d.missed.length, 1);
  assert.ok(Math.abs(d.monthlyOut - (15.49 + 540 / 12 + 49)) < 0.01);
  assert.ok(Math.abs(d.monthlyIn - 1950 * 26 / 12) < 0.01);
  assert.equal(d.planned.length, 2); assert.equal(d.planned[0].amount, -1500); assert.equal(d.planned[1].kind, "income"); assert.equal(d.planned[0].state, "active");
  assert.deepEqual(d.dueSoon.map((r) => r.payee), ["Acme Corp Payroll"], "payroll on the 25th is within 14 days; Netflix on Oct 5 is 20 days out");
});
test("F-026: ended and not-yet-started typed items are flagged, not expected", () => {
  const p = recurringPlan();
  p.expenses.push({ id: "old", name: "Old mortgage", category: "housing", amount: 900, period: "monthly", endDate: "2024-06-30" }, { id: "soon", name: "New car", category: "transport", amount: 400, period: "monthly", startDate: "2027-01-01" });
  const d = compute(p, { today: TODAY });
  assert.equal(d.planned.find((x) => x.name === "Old mortgage").state, "ended");
  assert.equal(d.planned.find((x) => x.name === "New car").state, "upcoming");
  assert.equal(d.planned.filter((x) => x.state === "active").length, 2);
});
test("dismissed items stay out", () => {
  const p = recurringPlan();
  const all = detectRecurring(p.transactions, { today: TODAY, plan: p });
  p.recurringIgnored = [all.find((r) => r.payee === "Netflix").key];
  const d = compute(p, { today: TODAY });
  assert.equal(d.detected.find((r) => r.payee === "Netflix"), undefined); assert.equal(d.dismissed, 1);
});
test("empty plan", () => { const d = compute(emptyPlan(), { today: TODAY }); assert.deepEqual(d.detected, []); assert.equal(d.monthlyOut, 0); });

test("F3: a payee hidden with 'Not a bill' is listed under hidden, with its name, so it can be put back", () => {
  const p = recurringPlan();
  const all = compute(p, { today: TODAY });
  const one = all.detected[0];
  p.recurringIgnored = [one.key, "gone|payee-not-in-the-files"];
  const d = compute(p, { today: TODAY });
  assert.deepEqual(d.hidden, [{ key: one.key, payee: one.payee }]);
  assert.ok(!d.detected.some((r) => r.key === one.key));
  assert.equal(compute(recurringPlan(), { today: TODAY }).hidden.length, 0);
});

// ================================================================ gap #6 (2026-11-13): what changed, one tap to Expenses
// These run only when this file is the one under test: Forecast, Irregular expenses and Subscriptions import recurringPlan
// from here, and would otherwise run every test below again in their own processes.
import { fileURLToPath } from "node:url";
import path from "node:path";
const OWN = (() => { try { return fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? ""); } catch { return false; } })();

const NOW = "2026-11-13";
const series = (pre, payee, category, rows, accountId = "chk") => rows.map(([date, amount], i) => tx(`${pre}${i}`, date, amount, payee, accountId, category));
const charges = (...amounts) => amounts.map((amount, i) => ({ date: addDays("2026-03-05", 30 * i), amount }));
/** An invented household's checking account from May to today: pay every two weeks, Netflix up in October, a gym that
 * started in October, a 2% phone rise, and rent that is already typed on Expenses. */
export function changesPlan() {
  const p = emptyPlan();
  p.accounts.push({ id: "chk", name: "Checking", type: "checking", balance: 3000 });
  const pay = []; for (let d = "2026-05-01"; d <= "2026-11-06"; d = addDays(d, 14)) pay.push([d, 2100]);
  p.transactions.push(
    ...series("p", "Acme Corp Payroll", "income-salary", pay),
    ...series("n", "Netflix", "subscriptions", [["2026-06-05", -15.49], ["2026-07-05", -15.49], ["2026-08-05", -15.49], ["2026-09-05", -15.49], ["2026-10-05", -17.99], ["2026-11-05", -17.99]]),
    ...series("g", "Gym Co", "fun", [["2026-10-03", -39], ["2026-11-03", -39]]),
    ...series("v", "Verizon Wireless", "phone", [["2026-07-12", -50], ["2026-08-12", -50], ["2026-09-12", -50], ["2026-10-12", -51]]),
    ...series("r", "Oak Street Apartments", "housing", [["2026-07-01", -1500], ["2026-08-01", -1500], ["2026-09-01", -1500], ["2026-10-01", -1500], ["2026-11-01", -1500]]),
  );
  p.expenses.push({ id: "e-rent", name: "Rent", category: "housing", amount: 1500, period: "monthly", essential: true, inflates: true });
  return p;
}
const keyOf = (p, payee) => detectRecurring(p.transactions, { today: NOW, plan: p }).find((r) => r.payee === payee).key;

if (OWN) {
  test("went up: a 2% rise is not flagged; 5% and $1 or more is; 5% under $1 is not (a - m >= max($1, 5% of m))", () => {
    assert.equal(wentUp(charges(50, 50, 50, 51)), null, "2%, $1: under 5%");
    assert.deepEqual(wentUp(charges(100, 100, 100, 105)), { from: 100, to: 105, at: charges(100, 100, 100, 105)[3].date, mid: 100 }, "5% and $5: exactly at the line");
    assert.equal(wentUp(charges(10, 10, 10, 10.5)), null, "5% but 50 cents: under $1");
    assert.ok(wentUp(charges(10, 10, 10, 11)), "10% and $1");
    assert.equal(wentUp(charges(15.49)), null, "one charge: nothing to compare");
  });
  test("went up compares the newest only: a one-off higher charge between two usual ones is not flagged", () => {
    assert.equal(wentUp(charges(40, 40, 60, 40)), null);
    assert.equal(wentUp(charges(40, 60, 40)), null);
  });
  test("went up: the month is the first charge at the new price, from the charge before it; the middle is of up to three", () => {
    const c = charges(15.49, 15.49, 15.49, 15.49, 17.99, 17.99);
    assert.deepEqual(wentUp(c), { from: 15.49, to: 17.99, at: c[4].date, mid: 15.49 }, "the second charge at the new price still says the month it went up");
    assert.equal(wentUp(charges(15.49, 15.49, 17.99, 17.99, 17.99)), null, "three at the new price: the middle is the new price, no longer news");
  });
  test("went up (builder's rule): a bill that moves with the season is not flagged when it is higher", () => {
    assert.equal(wentUp(charges(80, 95, 70, 110)), null, "power: the three before spread over $25");
    assert.ok(wentUp(charges(64.12, 65.03, 64.5, 72)), "a phone bill with a few cents of tax each month that then rose $7 is");
  });

  test("changes: Netflix went up in October; Gym Co is new; the 2% phone rise and the typed rent are not news", () => {
    const p = changesPlan();
    const d = compute(p, { today: NOW });
    assert.deepEqual(d.changes.map((c) => [c.kind, c.payee]), [["up", "Netflix"], ["new", "Gym Co"]], "newest first: October 5, then October 3");
    const up = d.changes[0];
    assert.deepEqual([up.from, up.to, up.at, up.cadence], [15.49, 17.99, "2026-10-05", "monthly"]);
    const gym = d.changes[1];
    assert.deepEqual([gym.amount, gym.at, gym.cadence, gym.key], [39, "2026-10-03", "monthly", keyOf(p, "Gym Co")]);
    assert.equal(d.changes.some((c) => c.payee === "Acme Corp Payroll"), false, "money coming in is never a bill");
  });
  test("new: needs a bank file that goes back one gap before the first charge, a first charge in the last 70 days, not in the plan, not hidden", () => {
    const younger = changesPlan();
    younger.transactions = younger.transactions.filter((t) => t.date >= "2026-10-01");
    assert.equal(compute(younger, { today: NOW }).changes.some((c) => c.kind === "new"), false, "a file that starts October 1 makes every bill look new: none is said");
    const old = changesPlan();
    old.transactions.push(...series("g2", "Gym Co", "fun", [["2026-08-03", -39], ["2026-09-03", -39]]));
    assert.equal(compute(old, { today: NOW }).detected.find((r) => r.payee === "Gym Co").first, "2026-08-03");
    assert.equal(compute(old, { today: NOW }).changes.some((c) => c.payee === "Gym Co"), false, "first charged 102 days ago: not new");
    const added = changesPlan();
    added.expenses.push({ id: "e-gym", name: "Gym Co", category: "fun", amount: 39, period: "monthly", essential: false, inflates: true, payeeKey: keyOf(added, "Gym Co") });
    assert.equal(compute(added, { today: NOW }).changes.some((c) => c.kind === "new"), false, "added from here: on Expenses");
    const hid = changesPlan();
    hid.recurringIgnored = [keyOf(hid, "Gym Co")];
    assert.equal(compute(hid, { today: NOW }).changes.some((c) => c.kind === "new"), false, "\"Not a bill\": hidden");
    assert.equal(compute(changesPlan(), {}).changes.some((c) => c.kind === "new"), false, "no today: nothing is new");
  });
  test("in the plan: by the key it was added from, by a name word, by a loan on Debts, by the same amount a month in the same kind", () => {
    const p = changesPlan();
    p.expenses.push({ id: "e-net", name: "Netflix", category: "subscriptions", amount: 15.49, period: "monthly", essential: false, inflates: true });
    p.accounts.push({ id: "car", name: "Toyota car loan", type: "loan", balance: -9000 });
    p.debts.push({ id: "d-car", accountId: "car", rate: 0.06, minPayment: 389, extra: 0 });
    p.transactions.push(...series("t", "Toyota Financial", "debt", [["2026-08-20", -389], ["2026-09-20", -389], ["2026-10-20", -389]]));
    p.transactions.push(...series("w", "City Water", "utilities", [["2026-08-25", -1500], ["2026-09-25", -1500], ["2026-10-25", -1500]]));
    const d = compute(p, { today: NOW });
    const how = Object.fromEntries(d.inPlan.map((x) => [d.detected.find((r) => r.key === x.key).payee, [x.how, x.expenseId ?? x.debtId]]));
    assert.deepEqual(how["Netflix"], ["name", "e-net"]);
    assert.deepEqual(how["Toyota Financial"], ["debt", "d-car"]);
    assert.deepEqual(how["Oak Street Apartments"], ["amount", "e-rent"], "typed Rent $1,500 is the $1,500 to the landlord");
    assert.equal(how["City Water"], undefined, "the same $1,500 under utilities is not the rent (and the rent row is used once)");
    assert.equal(how["Gym Co"], undefined);
    assert.equal(how["Verizon Wireless"], undefined);
    const up = d.changes.find((c) => c.payee === "Netflix");
    assert.equal(up.expenseId, "e-net", "Expenses still says $15.49 a month for it: one tap can bring it to $17.99");
  });
  test("in the plan, on the card-gap household's three months of bank files: the right row or debt, never a word of another kind", async () => {
    const { cardGapPlan } = await import("../../../qa/fixtures/card-gap-plan.mjs");
    const d = compute(cardGapPlan(), { today: NOW });
    const how = Object.fromEntries(d.inPlan.map((x) => [d.detected.find((r) => r.key === x.key).payee, [x.how, x.expenseId ?? x.debtId]]));
    assert.deepEqual(how["Wells Fargo Home"], ["amount", "e-mort"], "the mortgage line, not the \"home\" in \"Car and home insurance\"");
    assert.deepEqual(how["Toyota Motor Credit"], ["debt", "d-car"], "the car loan's $410, not the card's $400 with its extra");
    assert.deepEqual(how["City Of Dayton"], ["name", "e-util"], "\"water\" in \"Electric, water, gas\"");
    assert.deepEqual(d.changes, [], "nothing new or higher in those months");
  });
  test("Add to Expenses writes one row: the payee, its usual amount (the new price after a rise), how often, its kind, payeeKey", () => {
    const p = changesPlan();
    const gym = compute(p, { today: NOW }).detected.find((r) => r.payee === "Gym Co");
    assert.deepEqual(billFrom(gym), { name: "Gym Co", category: "fun", amount: 39, period: "monthly", essential: false, inflates: true, payeeKey: gym.key });
    const draft = structuredClone(p);
    const row = addBill(draft, gym, "x1");
    assert.equal(draft.expenses.length, p.expenses.length + 1);
    assert.deepEqual(draft.expenses.at(-1), row);
    assert.equal(row.id, "x1");
    const after = compute(draft, { today: NOW });
    assert.deepEqual(after.inPlan.find((x) => x.key === gym.key), { key: gym.key, how: "added", expenseId: "x1" });
    assert.equal(after.changes.some((c) => c.kind === "new"), false, "its line is gone");
    const net = compute(p, { today: NOW }).detected.find((r) => r.payee === "Netflix");
    assert.equal(billFrom(net, wentUp([{ date: "a", amount: 15.49 }, { date: "b", amount: 15.49 }, { date: "c", amount: 17.99 }])).amount, 17.99);
    assert.equal(billFrom({ ...gym, category: "income-salary" }).category, "other", "a kind Expenses does not have");
    assert.equal(billFrom({ ...gym, category: "insurance", cadence: "annual" }).essential, true, "insurance is a must-pay, as on Expenses");
    assert.equal(billFrom({ ...gym, cadence: "annual" }).period, "annual");
  });
  test("no bank lines: no changes and nothing in the plan to match", () => {
    for (const p of [emptyPlan(), (() => { const q = changesPlan(); q.transactions = []; return q; })()]) {
      const d = compute(p, { today: NOW });
      assert.deepEqual([d.changes, d.inPlan], [[], []]);
    }
  });
}

// ---------------------------------------------------------------- the page (the real UI kit on qa/fixtures/fake-dom.mjs)
if (OWN) {
  const VIEW = new URL("./view.js", import.meta.url);
  const { renderPage, textOf } = await import("../../../qa/fixtures/fake-dom.mjs");
  const isOpen = (d) => (typeof d.open === "boolean" ? d.open : d.hasAttribute("open"));
  const partOf = (root, id) => root.all().find((e) => e.tagName === "DETAILS" && e.dataset?.part === id) ?? null;
  const shut = (root) => root.all().filter((e) => e.tagName === "DETAILS" && !isOpen(e));
  /** What is on screen before a tap: everything outside a shut part. */
  const firstView = (root) => { const skip = new Set(shut(root)); const walk = (n) => (!n.tagName ? n.data ?? "" : n.hidden ? "" : n.tagName === "DETAILS" && skip.has(n) ? textOf(n.children[0]) : n.childNodes.map(walk).join(" ")); return walk(root).replace(/\s+/g, " ").trim(); };
  const buttons = (root, label) => root.all().filter((e) => e.tagName === "BUTTON" && textOf(e) === label);
  const heroOf = (root) => root.all().find((e) => e.tagName === "SECTION" && e.className.includes("hero"));
  const { sentenceOf, changeSentence } = await import("./view.js");
  const fmt = await import("../../../core/format.js");
  const money = (n) => fmt.money(n);
  const amount = (n) => fmt.money(n, "USD", undefined, Math.round(n * 100) % 100 ? 2 : 0);

  test("one written sentence per case under the headline (R5): empty, typed, one or several found, with money in or not, none found", () => {
    const base = { detected: [], total: 0, monthlyIn: 0 };
    const out = (n) => Array.from({ length: n }, () => ({ amount: -10 }));
    assert.equal(sentenceOf(base, { money }), "Once transactions are on file, this page finds the payments that come back every week, month or year, says when the next one is due and warns when one looks missed.");
    assert.equal(sentenceOf(base, { money, typedBills: 3 }), "These are the bills you typed on Expenses. Import a bank file and this page also finds the ones you forgot, and says when each is due.");
    assert.equal(sentenceOf({ ...base, total: 40, detected: out(1) }, { money }), "Your bank files show one bill that comes back.");
    assert.equal(sentenceOf({ ...base, total: 40, detected: out(1), monthlyIn: 4550 }, { money }), "Your bank files show one bill that comes back, and $4,550 a month coming in.");
    assert.equal(sentenceOf({ ...base, total: 40, detected: out(4) }, { money }), "Your bank files show 4 bills that come back.");
    assert.equal(sentenceOf({ ...base, total: 40, detected: out(4), monthlyIn: 4550 }, { money }), "Your bank files show 4 bills that come back, and $4,550 a month coming in.");
    assert.equal(sentenceOf({ ...base, total: 40 }, { money, typedBills: 2 }), "It takes two or three charges from the same payee to be sure. Meanwhile the bills you typed on Expenses are listed below.");
    assert.equal(sentenceOf({ ...base, total: 40 }, { money }), "It takes two or three charges from the same payee to be sure. Import more months of your bank file, or type your bills on Expenses.");
  });
  test("one written sentence per case for the green line after Add to Expenses (R5, R7): no bill of that kind typed, one, two, more", async () => {
    const { addedWords } = await import("./view.js");
    const row = { amount: 15.49 };
    const o = { amount, kindLabel: "Subscriptions" };
    assert.equal(addedWords("Netflix", row, "monthly", [], o), "Added Netflix to Expenses: $15.49 a month, under Subscriptions. Change it there any time.");
    assert.equal(addedWords("Netflix", row, "monthly", ["Streaming"], o), "Added Netflix to Expenses: $15.49 a month, under Subscriptions. If \"Streaming\" already counted it, lower it on Expenses.");
    // a name with commas reads as one name (the walk: "Electric, water, gas")
    assert.equal(addedWords("Dayton Power Light", { amount: 142.1 }, "monthly", ["Electric, water, gas"], { ...o, kindLabel: "Utilities" }), "Added Dayton Power Light to Expenses: $142.10 a month, under Utilities. If \"Electric, water, gas\" already counted it, lower it on Expenses.");
    assert.equal(addedWords("Netflix", row, "monthly", ["Streaming", "Music"], o), "Added Netflix to Expenses: $15.49 a month, under Subscriptions. If \"Streaming\" or \"Music\" already counted it, lower that one on Expenses.");
    assert.equal(addedWords("Netflix", { amount: 186 }, "annual", ["A", "B", "C"], o), "Added Netflix to Expenses: $186 a year, under Subscriptions. If another bill under Subscriptions already counted it, lower that one on Expenses.");
  });
  test("one written sentence per kind of change (R5): went up (this year, another year), new, looks missed", () => {
    const say = (c) => changeSentence(c, { amount, today: NOW });
    assert.equal(say({ kind: "up", payee: "Netflix", from: 15.49, to: 17.99, at: "2026-10-05" }), "Netflix went up from $15.49 to $17.99 in October.");
    assert.equal(say({ kind: "up", payee: "Netflix", from: 15.49, to: 17.99, at: "2025-12-05" }), "Netflix went up from $15.49 to $17.99 in December 2025.");
    assert.equal(say({ kind: "new", payee: "Gym Co", amount: 39, cadence: "monthly", at: "2026-10-03" }), "New: Gym Co, $39 a month since October 3. A new bill?");
    assert.equal(say({ kind: "new", payee: "Lawn Care", amount: 45.5, cadence: "biweekly", at: "2026-09-18" }), "New: Lawn Care, $45.50 every two weeks since September 18. A new bill?");
    assert.equal(say({ kind: "missed", payee: "Gym Membership", at: "2026-08-20" }), "Gym Membership looks missed: it was expected August 20.");
  });

  test("the first view: the month's bills and the case's sentence, what changed (amber, never folded), the six biggest; the rest one tap away", async () => {
    const p = changesPlan();
    const { root } = await renderPage(VIEW, p, NOW);
    const hero = textOf(heroOf(root));
    assert.ok(hero.startsWith("$1,604 a month in regular bills and payments"), hero);   // 1,500 + 50 + 39 + 15.49: each bill's middle charge
    assert.ok(hero.includes("Your bank files show 4 bills that come back, and $4,550 a month coming in."), hero);
    const seen = firstView(root);
    assert.ok(seen.includes("What changed Netflix went up from $15.49 to $17.99 in October. New: Gym Co"), seen);
    assert.ok(seen.includes("New: Gym Co, $39 a month since October 3. A new bill? Add to Expenses Not a bill"), seen);
    assert.ok(seen.includes("How to ask for a lower price"), "a bill went up: the way to ask for less is right there");
    assert.ok(seen.includes("Biggest first 🏠 Oak Street Apartments every month · next December 1 $1,500 a month"), seen);
    for (const label of ["See or change each bill", "How this is worked out", "More on this"]) assert.ok(seen.includes(label), label);
    const outside = (b) => !shut(root).some((d) => d.all().includes(b));
    assert.equal(buttons(root, "Not a bill").filter(outside).length, 1, "outside the shut parts only the new line's (each row's is one tap away)");
    assert.equal(buttons(root, "Add to Expenses").filter(outside).length, 1, "and one Add to Expenses: the new line's");
    const filled = root.all().filter((e) => (e.tagName === "BUTTON" || (e.tagName === "A" && e.className.includes("btn"))) && !/secondary|link|chip|ghost|danger/.test(e.className) && !shut(root).some((s) => s.all().includes(e)));
    assert.equal(filled.length, 0, "no filled button once the bank file is in: nothing has to be done");
    for (const d of root.all().filter((e) => e.tagName === "DETAILS")) assert.ok(d.dataset?.part, `a fold drawn by hand: ${textOf(d.children[0])}`);
    assert.equal(partOf(root, "each").querySelector(".fold-status").textContent, "3 not on Expenses", "Netflix, Gym Co and Verizon; the rent is (typed Rent, the same $1,500)");
    // Netflix went up from $15.49 to $17.99: the total counts the usual charge, and the row says the new price (the walk)
    assert.ok(seen.includes("Netflix every month · now $17.99 · next December 5 $15.49 a month"), "bank amounts keep their cents; a bill that went up says its new price");
    assert.ok(seen.includes("Verizon Wireless every month · next") && !seen.includes("Verizon Wireless every month · now"), "a bill that did not go up ($51 once is under the line) says no new price");
  });
  test("Add to Expenses on the new line writes one row and the line and its button are gone after; the green line says what it did, with Undo", async () => {
    const p = changesPlan();
    const first = await renderPage(VIEW, p, NOW);
    const add = buttons(first.root, "Add to Expenses").find((b) => b.getAttribute("aria-label") === "Add Gym Co to Expenses");
    add.click();
    assert.equal(first.saved.length, 1, "one change");
    const after = first.saved[0];
    assert.equal(after.expenses.length, p.expenses.length + 1, "one row");
    const row = after.expenses.at(-1);
    assert.deepEqual({ ...row, id: typeof row.id }, { id: "string", name: "Gym Co", category: "fun", amount: 39, period: "monthly", essential: false, inflates: true, payeeKey: keyOf(p, "Gym Co") });
    const next = await renderPage(VIEW, after, NOW);
    const t = firstView(next.root);
    assert.ok(t.includes("Added Gym Co to Expenses: $39 a month, under Fun and hobbies. Change it there any time. Undo"), t);
    assert.ok(!t.includes("New: Gym Co"), "the line is gone");
    assert.equal(buttons(next.root, "Add to Expenses").filter((b) => b.getAttribute("aria-label") === "Add Gym Co to Expenses").length, 0, "and its button, here and in See or change each bill");
    const again = await renderPage(VIEW, after, NOW);
    assert.ok(!firstView(again.root).includes("Added Gym Co"), "said once");
  });
  test("Not a bill on the new line hides the line (asked first; the payee goes to the hidden list)", async () => {
    const p = changesPlan();
    const first = await renderPage(VIEW, p, NOW);
    buttons(first.root, "Not a bill").find((b) => b.getAttribute("aria-label") === "Gym Co is not a bill").click();
    assert.deepEqual(first.saved[0].recurringIgnored, [keyOf(p, "Gym Co")]);
    const next = await renderPage(VIEW, first.saved[0], NOW);
    const t = firstView(next.root);
    assert.ok(!t.includes("New: Gym Co"), "the line is gone");
    assert.ok(t.includes("Gym Co taken off this list (and off Subscriptions). Put it back under \"Payees you hid\" at the bottom."), t);
    assert.ok(partOf(next.root, "hidden"), "the payee is under Payees you hid, a part");
    assert.equal(partOf(next.root, "hidden").querySelector(".fold-title").textContent, "Payees you hid");
  });
  test("a bill that went up while Expenses still says the old price: one tap brings Expenses to the new price", async () => {
    const p = changesPlan();
    p.expenses.push({ id: "e-net", name: "Netflix", category: "subscriptions", amount: 15.49, period: "monthly", essential: false, inflates: true });
    const first = await renderPage(VIEW, p, NOW);
    assert.ok(firstView(first.root).includes("Netflix went up from $15.49 to $17.99 in October. Expenses still says $15.49 for it. Use $17.99 on Expenses"));
    buttons(first.root, "Use $17.99 on Expenses")[0].click();
    assert.equal(first.saved[0].expenses.find((e) => e.id === "e-net").amount, 17.99);
    const next = await renderPage(VIEW, first.saved[0], NOW);
    const t = firstView(next.root);
    assert.ok(t.includes("Netflix on Expenses is now $17.99 a month. Undo"), t);
    assert.ok(t.includes("Netflix went up from $15.49 to $17.99 in October.") && !t.includes("Use $17.99 on Expenses"), "the line stays (still news); the button goes");
  });
  test("S11 (R17): after a save only the saved part changes: Add inside See or change each bill opens that part alone; Add on the What changed line opens none; Put back keeps Payees you hid open", async () => {
    const states = (root) => Object.fromEntries(root.all().filter((e) => e.tagName === "DETAILS").map((e) => [e.dataset.part, isOpen(e)]));
    const p = changesPlan();
    const first = await renderPage(VIEW, p, NOW);
    const before = states(first.root);
    const each = partOf(first.root, "each");
    each.querySelector(".fold-body").all().find((e) => e.tagName === "BUTTON" && e.getAttribute("aria-label") === "Add Verizon Wireless to Expenses").click();
    const next = await renderPage(VIEW, first.saved[0], NOW);
    assert.deepEqual(states(next.root), { ...before, each: true }, "only the saved part is open");
    assert.ok(textOf(partOf(next.root, "each")).includes("Added Verizon Wireless to Expenses: $50 a month, under Phone and internet."), "the green line is in it");
    assert.ok(textOf(partOf(next.root, "each")).includes("On Expenses as Verizon Wireless"));
    // a save outside every part (Add on the What changed line): no part opens or shuts, the green line is in that card
    const line = await renderPage(VIEW, changesPlan(), NOW);
    const was = states(line.root);
    const add = buttons(line.root, "Add to Expenses").find((b) => b.getAttribute("aria-label") === "Add Gym Co to Expenses" && !partOf(line.root, "each").all().includes(b));
    add.click();
    const drawn = await renderPage(VIEW, line.saved[0], NOW);
    assert.deepEqual(states(drawn.root), was, "every part as it was");
    assert.ok(!partOf(drawn.root, "each").all().some((e) => /\bnotice\b/.test(e.className ?? "")), "the green line is not inside a part");
    // a save inside Payees you hid: Put back (two hidden, one put back) keeps that part open and moves no other
    const q = changesPlan();
    q.recurringIgnored = [keyOf(q, "Verizon Wireless"), keyOf(q, "Gym Co")];
    const h = await renderPage(VIEW, q, NOW);
    const hw = states(h.root);
    assert.equal(hw.hidden, false);
    const li = partOf(h.root, "hidden").all().find((e) => e.tagName === "LI" && textOf(e).startsWith("Gym Co"));
    li.all().find((e) => e.tagName === "BUTTON" && textOf(e) === "Put back").click();
    assert.deepEqual(h.saved[0].recurringIgnored, [keyOf(q, "Verizon Wireless")]);
    const h2 = await renderPage(VIEW, h.saved[0], NOW);
    assert.deepEqual(states(h2.root), { ...hw, hidden: true }, "only the part saved in is open");
    assert.ok(textOf(partOf(h2.root, "hidden")).includes("Gym Co is back on the list."), "its green line is in it");
    // said once: the next draw has every part as the page draws it
    assert.deepEqual(states((await renderPage(VIEW, h.saved[0], NOW)).root), hw);
  });
  test("no bank lines gives nothing drawn about changes; the typed bills are the list, six then the rest", async () => {
    const p = emptyPlan();
    for (let i = 0; i < 9; i++) p.expenses.push({ id: `e${i}`, name: `Bill ${i + 1}`, category: "utilities", amount: 100 + 10 * i, period: "monthly", essential: true, inflates: true });
    const { root } = await renderPage(VIEW, p, NOW);
    const t = firstView(root);
    assert.ok(!t.includes("What changed") && !t.includes("Add to Expenses") && !t.includes("Not a bill"), t);
    assert.ok(textOf(heroOf(root)).startsWith("$1,260 a month in regular bills and payments These are the bills you typed on Expenses."), textOf(heroOf(root)));
    assert.equal(partOf(root, "bills").querySelector(".fold-title").textContent, "3 more bills");
    assert.ok(t.includes("Bill 9") && !t.includes("Bill 3 "), "biggest first");
    assert.equal(buttons(root, "Import a bank file").length + root.all().filter((e) => e.tagName === "A" && textOf(e) === "Import a bank file").length, 1, "one filled way on");
    assert.equal(partOf(root, "each"), null);
    const empty = await renderPage(VIEW, emptyPlan(), NOW);
    assert.ok(textOf(empty.root).startsWith("Bills and regular payments Once transactions are on file"));
  });

  // ---------------------------------------------------------------- the critic's walk (2026-11-13): several taps on one visit
  // One visit as the shell runs it: one route object and one store; a tap's store.update redraws the page after the tap
  // (the shell waits 50 ms), with the same route. Another arrival on the page is another route object.
  const { FakeElement } = await import("../../../qa/fixtures/fake-dom.mjs");
  const kit = await import("../../../core/ui/dom.js");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { render } = await import("./view.js");
  const visitOf = (plan) => {
    let p = migrate(structuredClone(plan)), dirty = false, route = { rest: [] };
    const store = { get: () => p, update: (fn) => { const d = structuredClone(p); fn(d); p = d; dirty = true; } };
    const v = {
      root: null, plan: () => p,
      draw: () => { v.root = new FakeElement("main"); render(v.root, { ui: kit, fmt: { ...fmt, today: () => NOW }, plan: p, route, store, computeOf: () => null }); return v; },
      tap: (el) => { assert.ok(el, "the button is on the page"); el.click(); if (dirty) { dirty = false; v.draw(); } return v; },
      arrive: () => { route = { rest: [] }; return v.draw(); },
      button: (label, aria) => v.root.all().find((e) => e.tagName === "BUTTON" && textOf(e) === label && (!aria || e.getAttribute("aria-label") === aria)) ?? null,
      line: (words) => v.root.all().find((e) => e.tagName === "LI" && textOf(e).includes(words)) ?? null,
    };
    return v.draw();
  };
  const undoIn = (el) => el?.all().find((e) => e.tagName === "BUTTON" && textOf(e) === "Undo") ?? null;
  const netRow = (amount) => ({ id: "e-net", name: "Netflix", category: "subscriptions", amount, period: "monthly", essential: false, inflates: true });

  test("a bill that went up whose row on Expenses already holds the new price: the change names that row (updatedId), not as stale", () => {
    const at = (amount, period = "monthly") => { const p = changesPlan(); p.expenses.push({ ...netRow(amount), period }); return compute(p, { today: NOW }).changes.find((c) => c.payee === "Netflix"); };
    assert.deepEqual([at(15.49).expenseId, at(15.49).updatedId], ["e-net", undefined], "the old price: one tap can bring it to the new one");
    assert.deepEqual([at(17.99).expenseId, at(17.99).updatedId], [undefined, "e-net"], "the new price already");
    assert.deepEqual([at(18.4).expenseId, at(18.4).updatedId], [undefined, "e-net"], "within 50 cents of the new price");
    assert.deepEqual([at(21).expenseId, at(21).updatedId], [undefined, undefined], "another price: neither");
    assert.deepEqual([at(17.99, "annual").expenseId, at(17.99, "annual").updatedId], [undefined, undefined], "another period: neither");
  });
  test("Use $17.99 ties the row to the bill (payeeKey) and the line then says Expenses already has the new price, on every visit (critic F4, F1)", () => {
    const p = changesPlan(); p.expenses.push(netRow(15.49));
    const v = visitOf(p);
    v.tap(v.button("Use $17.99 on Expenses"));
    const row = v.plan().expenses.find((e) => e.id === "e-net");
    assert.deepEqual([row.amount, row.payeeKey], [17.99, keyOf(p, "Netflix")], "the tap said this row is that bill: it is known by its key from now on");
    assert.ok(firstView(v.root).includes("Netflix on Expenses is now $17.99 a month. Undo"), firstView(v.root));
    assert.equal(textOf(v.line("Netflix went up")), "Netflix went up from $15.49 to $17.99 in October. Expenses already says $17.99 for it.", "done, said on the line; its Undo is the green line's");
    v.arrive();
    assert.equal(textOf(v.line("Netflix went up")), "Netflix went up from $15.49 to $17.99 in October. Expenses already says $17.99 for it.", "a new visit: the same words (from the plan), no Undo");
    const typed = changesPlan(); typed.expenses.push(netRow(17.99));
    const w = visitOf(typed);
    assert.equal(textOf(w.line("Netflix went up")), "Netflix went up from $15.49 to $17.99 in October. Expenses already says $17.99 for it.", "typed by hand at the new price: the same");
    assert.equal(w.button("Use $17.99 on Expenses"), null);
    // the line says what Expenses says, not the bank's old price: a row typed at $15.30 is "still $15.30", and comes back to it
    const near = changesPlan(); near.expenses.push(netRow(15.3));
    const n = visitOf(near);
    assert.equal(textOf(n.line("Netflix went up")), "Netflix went up from $15.49 to $17.99 in October. Expenses still says $15.30 for it. Use $17.99 on Expenses");
    n.tap(n.button("Use $17.99 on Expenses"));
    n.tap(undoIn(n.root.all().find((e) => e.className?.includes("notice"))));
    assert.equal(n.plan().expenses.find((e) => e.id === "e-net").amount, 15.3);
    assert.ok(firstView(n.root).includes("Netflix is back to $15.30 on Expenses."), firstView(n.root));
  });
  test("each Add and Use keeps its Undo where its bill is for the visit: Use, Add, then Netflix's own Undo puts back Netflix alone (critic F3)", () => {
    const p = changesPlan(); p.expenses.push(netRow(15.49));
    const v = visitOf(p);
    v.tap(v.button("Use $17.99 on Expenses"));
    assert.equal(undoIn(v.line("Netflix went up")), null, "right after the tap the green line holds the Undo; the line does not repeat it");
    v.tap(v.button("Add to Expenses", "Add Gym Co to Expenses"));
    assert.ok(firstView(v.root).includes("Added Gym Co to Expenses: $39 a month, under Fun and hobbies. Change it there any time. Undo"), firstView(v.root));
    const back = undoIn(v.line("Netflix went up"));
    assert.ok(back, "Netflix's Undo stayed on its line when the green line moved on to Gym Co");
    assert.equal(back.getAttribute("aria-label"), "Undo: put Netflix back to $15.49 on Expenses");
    assert.ok(back.className.includes("secondary"), "outlined");
    v.tap(back);
    const net = v.plan().expenses.find((e) => e.id === "e-net");
    assert.deepEqual([net.amount, "payeeKey" in net], [15.49, false], "Netflix as it was");
    assert.equal(v.plan().expenses.filter((e) => e.name === "Gym Co").length, 1, "Gym Co stays added");
    assert.ok(firstView(v.root).includes("Netflix is back to $15.49 on Expenses."), firstView(v.root));
    assert.ok(v.button("Use $17.99 on Expenses"), "the line offers the new price again");
    assert.equal(v.root.all().filter((e) => e.tagName === "BUTTON" && textOf(e) === "Undo").length, 1, "Gym Co's, on its row in See or change each bill (the green line is Netflix's, done)");

    // the other way round: Add, then Use: Gym Co's Undo is on its row in See or change each bill, where its Add was
    const q = changesPlan(); q.expenses.push(netRow(15.49));
    const w = visitOf(q);
    w.tap(w.button("Add to Expenses", "Add Gym Co to Expenses"));
    w.tap(w.button("Use $17.99 on Expenses"));
    const gym = partOf(w.root, "each").all().find((e) => e.tagName === "LI" && textOf(e).startsWith("Gym Co"));
    assert.ok(textOf(gym).includes("On Expenses as Gym Co"), textOf(gym));
    assert.equal(undoIn(gym)?.getAttribute("aria-label"), "Undo: take Gym Co off Expenses");
    w.tap(undoIn(gym));
    assert.equal(w.plan().expenses.filter((e) => e.name === "Gym Co").length, 0, "Gym Co is off Expenses");
    assert.equal(w.plan().expenses.find((e) => e.id === "e-net").amount, 17.99, "Netflix keeps the new price");
    assert.ok(textOf(partOf(w.root, "each")).includes("Gym Co is off Expenses again."), "said where the tap was");
    assert.equal(isOpen(partOf(w.root, "each")), true, "that part is open on the redraw (R17)");

    // an Undo already used in the green line is not offered again; another visit forgets them all
    const r = changesPlan(); r.expenses.push(netRow(15.49));
    const x = visitOf(r);
    x.tap(x.button("Use $17.99 on Expenses"));
    x.tap(undoIn(x.root.all().find((e) => e.className?.includes("notice"))));
    assert.equal(x.plan().expenses.find((e) => e.id === "e-net").amount, 15.49);
    x.tap(x.button("Use $17.99 on Expenses"));
    x.tap(x.button("Add to Expenses", "Add Gym Co to Expenses"));
    assert.ok(undoIn(x.line("Netflix went up")), "the second Use's Undo");
    x.arrive();
    assert.equal(x.root.all().filter((e) => e.tagName === "BUTTON" && textOf(e) === "Undo").length, 0, "a new visit: none");
  });
}

// ---------------------------------------------------------------- invariance (gap spec 3.5)
// With the new field absent (no expense has a payeeKey: every plan before gap #6), every figure this page worked out
// before is byte-identical: the old keys of compute() over every qa/fixtures plan builder, this file's recurringPlan, the
// empty plan, and the 1,400 qa/households plans (one digest per household type over its plans, in catalog order). The
// digests were taken at c5779a2 (before gap #6) with today = 2026-11-13; letters stand for the digits (the leak guard
// refuses long digit runs). Refresh them only for a deliberate change: RECURRING_DIGESTS=print node --test <this file>.
const BEFORE = {
  fixtures: {
    "card-gap-plan.mjs:cardGapPlan": "eilgjeemnfchhfam",
    "debt-plan.mjs:debtPlan": "ldneklpejhnfmloi",
    "family-plan.mjs:familyPlan": "cmcpbohfghkcenam",
    "guessed-plan.mjs:guessedPlan": "pkockamofjjjdbeo",
    "held-plan.mjs:heldPlan": "cmcpbohfghkcenam",
    "investments-plan.mjs:investmentsPlan": "elfhcameckbhkgag",
    "renter-debt-plan.mjs:renterDebtPlan": "dllgjklajhledoeg",
    "renter-debt-plan.mjs:renterPayingExtraPlan": "dllgjklajhledoeg",
    "retired-couple-plan.mjs:retiredCouplePlan": "nlblhacofpkcpgbg",
    "retirement-plan.mjs:retirementPlan": "elfhcameckbhkgag",
    "sample-plan.mjs:samplePlan": "mmjeimkmghdnmjgm",
    "tax-plan.mjs:taxPlan": "elfhcameckbhkgag",
    "widow-plan.mjs:widowPlan": "godbgbpnfglgmcfo",
    "recurringPlan": "goghjijgmgggefla",
    "empty": "maicpcfoaolbfeej"
  },
  households: {
    "01-single-adult": "flchapaincfcelme",
    "02-couple-no-kids": "gnbnibnolfcdfehk",
    "03-single-parent": "fgedkoefidggnlkp",
    "04-two-parents": "cgljnbacopldjnlp",
    "05-stay-at-home-parent": "obhmbdmnjadnbjdi",
    "06-blended-family": "gdjopmbdcidpncnm",
    "07-multigenerational": "hmoekdpgkgpnpbel",
    "08-retired": "amhonbpplnhbkglc",
    "09-near-retirement": "glpbcjekodpmdddl",
    "10-student-and-starter": "iblnbdaeiaiehifp",
    "11-self-employed": "hkmfjeocmpdemhon",
    "12-high-net-worth": "cnkhocjffnaaglkb",
    "13-in-crisis": "lekkceblhbbgilde",
    "14-unusual-structures": "imehcdnnjbbopmno"
  },
};
const NEW_KEYS = ["changes", "inPlan"];
if (OWN) {
  const { createHash } = await import("node:crypto");
  const fs = await import("node:fs");
  const { migrate } = await import("../../../core/schema/migrate.js");
  const { ARCHETYPES, COMMON_PACKS, SPECIAL_PACKS } = await import("../../../qa/households/lib/catalog.mjs");
  const letters = (hex) => hex.replace(/[0-9]/g, (d) => "ghijklmnop"[d]);
  const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
  const oldKeys = (plan) => { const r = { ...compute(migrate(structuredClone(plan)), { today: NOW }) }; for (const k of NEW_KEYS) delete r[k]; return r; };
  test("invariance: with no payeeKey, every figure Bills and regular payments gave before gap #6 is byte-identical (fixtures, households, empty plan)", async () => {
    const now = { fixtures: {}, households: {} };
    const dir = new URL("../../../qa/fixtures/", import.meta.url);
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith("-plan.mjs")).sort()) {
      const m = await import(new URL(f, dir).href);
      for (const [name, fn] of Object.entries(m)) if (typeof fn === "function" && /Plan$/.test(name)) now.fixtures[`${f}:${name}`] = letters(sha(JSON.stringify(oldKeys(fn()))));
    }
    now.fixtures.recurringPlan = letters(sha(JSON.stringify(oldKeys(recurringPlan()))));
    now.fixtures.empty = letters(sha(JSON.stringify(oldKeys(emptyPlan()))));
    for (const a of ARCHETYPES) {
      const list = [sha(JSON.stringify(oldKeys(a.build())))];
      for (const [, vs] of Object.entries({ ...COMMON_PACKS, special: SPECIAL_PACKS[a.id] ?? [] })) for (const v of vs) { const p = structuredClone(a.build()); v.apply(p); list.push(sha(JSON.stringify(oldKeys(p)))); }
      now.households[a.id] = letters(sha(list.join(",")));
    }
    if (process.env.RECURRING_DIGESTS === "print") console.log(JSON.stringify(now, null, 1));
    for (const [k, v] of Object.entries(BEFORE.fixtures)) assert.equal(now.fixtures[k], v, `fixture ${k}: a figure moved`);
    for (const [k, v] of Object.entries(BEFORE.households)) assert.equal(now.households[k], v, `households ${k}: a figure moved`);
    for (const p of [emptyPlan(), recurringPlan()]) assert.deepEqual(Object.keys(compute(p, { today: NOW })).slice(-2), NEW_KEYS, "the new keys come after the old ones");
  });
  test("invariance: payeeKey is read by this page alone: every page that reads the bills or the bank lines works out the same figures with it on every bill", async () => {
    const { default: registry } = await import("../../../modules/registry.js");
    const { familyPlan } = await import("../../../qa/fixtures/family-plan.mjs");
    const { cardGapPlan } = await import("../../../qa/fixtures/card-gap-plan.mjs");
    const plans = [familyPlan(), cardGapPlan(), changesPlan()];
    const keyed = plans.map((p) => { const q = structuredClone(p); for (const e of q.expenses ?? []) e.payeeKey = `chk|${String(e.name).toLowerCase()}`; return q; });
    let pages = 0;
    for (const entry of registry) {
      const key = `${entry.group}/${entry.id}`;
      if (key === "cashflow/recurring") continue;
      const mod = (await entry.load()).default;
      // the pages that read the bills or the bank lines themselves (the overview pages read them through these)
      if (!["cashflow", "transactions", "household", "balance", "debt"].includes(entry.group)) continue;
      if (typeof mod.compute !== "function" || mod.heavy || !(mod.needs ?? []).some((n) => ["expenses", "transactions"].includes(n))) continue;
      pages++;
      plans.forEach((p, i) => {
        // a page that lists the rows as they are carries the field along (Expenses); no figure may move
        const run = (x) => { try { return JSON.stringify(mod.compute(migrate(structuredClone(x)), { today: NOW }), (k, v) => (k === "payeeKey" ? undefined : v)); } catch (e) { return `threw ${e.message}`; } };
        assert.equal(run(keyed[i]), run(p), `${key}: a figure moved with payeeKey`);
      });
    }
    assert.ok(pages >= 10, `${pages} pages read expenses or transactions`);
  });
}

// core/ui/undo.js (from the forms2 design, wave 1) -- what one change did, and taking it back without overwriting later changes.
import test from "node:test";
import assert from "node:assert/strict";
import { changesOf, takeBack, same } from "../core/ui/undo.js";

const plan = () => ({
  meta: { rev: "a", updatedAt: "x" },
  accounts: [{ id: "a1", name: "Checking", balance: 100 }, { id: "a2", name: "Savings", balance: 200 }, { id: "a3", name: "401(k)", balance: 300 }],
  goals: [{ id: "g1", name: "Car", monthly: 300 }, { id: "g2", name: "Trip", monthly: 0 }],
  recurringIgnored: ["netflix"],
  retirement: { spendingMonthly: 7000 },
  guesses: { "accounts[a2].balance": { k: "x", v: 200 } },
});
const apply = (p, fn) => { const d = structuredClone(p); fn(d); return d; };

test("a removed row comes back where it stood, with its guess entry", () => {
  const before = plan();
  const after = apply(before, (d) => { d.accounts = d.accounts.filter((a) => a.id !== "a2"); delete d.guesses["accounts[a2].balance"]; d.meta.rev = "b"; });
  const ch = changesOf(before, after);
  assert.equal(ch.length, 2);
  const back = apply(after, (d) => { const r = takeBack(d, ch); assert.deepEqual(r, { done: 2, kept: 0 }); });
  assert.deepEqual(back.accounts.map((a) => a.id), ["a1", "a2", "a3"]);
  assert.ok(same(back.guesses, before.guesses));
  assert.equal(back.meta.rev, "b");   // meta is never taken back
});
test("several fields overwritten in one tap are put back", () => {
  const before = plan();
  const after = apply(before, (d) => { d.goals[0].monthly = 836; d.goals[1].monthly = 673; d.retirement.spendingMonthly = 6600; });
  const ch = changesOf(before, after);
  assert.equal(ch.length, 3);
  const back = apply(after, (d) => takeBack(d, ch));
  assert.ok(same({ ...back, meta: null }, { ...before, meta: null }));
});
test("a field changed again since is left alone (kept), the rest is put back", () => {
  const before = plan();
  const after = apply(before, (d) => { d.goals[0].monthly = 836; d.goals[1].monthly = 673; });
  const ch = changesOf(before, after);
  const later = apply(after, (d) => { d.goals[1].monthly = 50; });   // another device, another tab
  const back = apply(later, (d) => { const r = takeBack(d, ch); assert.deepEqual(r, { done: 1, kept: 1 }); });
  assert.equal(back.goals[0].monthly, 300);
  assert.equal(back.goals[1].monthly, 50);
});
test("a list of plain values (hidden payees) is put back whole only if unchanged since", () => {
  const before = plan();
  const after = apply(before, (d) => { d.recurringIgnored.push("spotify"); });
  const ch = changesOf(before, after);
  assert.deepEqual(apply(after, (d) => takeBack(d, ch)).recurringIgnored, ["netflix"]);
  const later = apply(after, (d) => { d.recurringIgnored.push("hulu"); });
  assert.deepEqual(apply(later, (d) => takeBack(d, ch)).recurringIgnored, ["netflix", "spotify", "hulu"]);
});
test("an added row goes; a removed row whose id is back is not doubled; a new section is taken away", () => {
  const before = plan();
  const after = apply(before, (d) => { d.goals.push({ id: "g3", name: "Roof", monthly: 100 }); d.extra = { on: true }; });
  const ch = changesOf(before, after);
  const back = apply(after, (d) => takeBack(d, ch));
  assert.deepEqual(back.goals.map((g) => g.id), ["g1", "g2"]);
  assert.equal("extra" in back, false);
  const rm = changesOf(before, apply(before, (d) => { d.goals.shift(); }));
  const twice = apply(before, (d) => { const r = takeBack(d, rm); assert.deepEqual(r, { done: 0, kept: 1 }); });
  assert.equal(twice.goals.length, 2);
});
test("the last row removed from a list, and the first row, come back in place", () => {
  const before = plan();
  const ch = changesOf(before, apply(before, (d) => { d.accounts = []; }));
  assert.deepEqual(apply({ ...before, accounts: [] }, (d) => takeBack(d, ch)).accounts.map((a) => a.id), ["a1", "a2", "a3"]);
});
test("nothing changed: no changes", () => { const p = plan(); assert.deepEqual(changesOf(p, structuredClone(p)), []); });

// ---- ui.undoable (core/ui/dom.js) on a stand-in store with core/store.js's order: another tab's save first, then the change
import { undoable, undoneWords, notice } from "../core/ui/dom.js";
const storeOf = (initial) => { let plan = initial, theirs = null; return { get: () => plan, update(fn) { if (theirs) { plan = theirs; theirs = null; } const next = structuredClone(plan); fn(next); plan = next; }, theirsSaved(p) { theirs = p; } }; };
test("undoable: a tap that changed nothing gives no Undo", () => {
  const st = storeOf(plan());
  assert.equal(undoable(st, (d) => { d.retirement.spendingMonthly = 7000; }), null);
});
test("undoable: Undo takes back this change only, not another tab's save that came first (break critic 10)", () => {
  const st = storeOf(plan());
  const other = structuredClone(st.get()); other.accounts.push({ id: "a4", name: "Brokerage", balance: 80000 }); other.accounts[0].balance = 6200;
  st.theirsSaved(other);
  const undo = undoable(st, (d) => { d.recurringIgnored.push("chk|netflix"); });
  assert.deepEqual(undo(), { done: 1, kept: 0 });
  assert.deepEqual(st.get().recurringIgnored, ["netflix"]);
  assert.equal(st.get().accounts.length, 4);
  assert.equal(st.get().accounts[0].balance, 6200);
  assert.deepEqual(undo(), { done: 0, kept: 0 });   // a second tap on the same Undo does nothing
});
test("undoable: two separate taps are two Undos; taking back the second leaves the first", () => {
  const st = storeOf(plan());
  const u1 = undoable(st, (d) => { d.recurringIgnored.push("hulu"); });
  const u2 = undoable(st, (d) => { d.retirement.spendingMonthly = 6600; });
  u2();
  assert.deepEqual(st.get().recurringIgnored, ["netflix", "hulu"]);
  assert.equal(st.get().retirement.spendingMonthly, 7000);
  assert.ok(u1);
});
test("undoneWords: the page's words, and one plain line when part was changed again", () => {
  assert.equal(undoneWords({ done: 1, kept: 0 }, "Netflix is back on the list."), "Netflix is back on the list.");
  assert.match(undoneWords({ done: 1, kept: 1 }, "Netflix is back on the list."), /left as it is/);
  assert.match(undoneWords({ done: 0, kept: 1 }, "x"), /^Nothing to put back/);
});
test("notice: one Undo on its own line under the words; its tap takes the change back and tells the page", async () => {
  await import("../qa/fixtures/fake-dom.mjs");   // the view tests' stand-in document (the kit installs no listeners there)
  const st = storeOf(plan());
  const undo = undoable(st, (d) => { d.retirement.spendingMonthly = 6600; });
  let heard = null;
  const n = notice("ok", "Plan on $6,600 a month saved.", { undo, undone: (r) => { heard = r; } });
  const buttons = n.querySelectorAll("button");
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].textContent, "Undo");
  assert.ok(buttons[0].closest(".notice-actions"), "the button sits in its own line");
  assert.ok(buttons[0].classList.contains("secondary"), "outlined, not a second filled button");
  buttons[0].click();
  assert.deepEqual(heard, { done: 1, kept: 0 });
  assert.equal(st.get().retirement.spendingMonthly, 7000);
  assert.equal(notice("ok", "Saved.").querySelectorAll("button").length, 0, "a plain notice has no button");
});
test("notice: action = { label, run } is the same one outlined button on its own line, for any way on", async () => {
  await import("../qa/fixtures/fake-dom.mjs");
  let ran = 0;
  const n = notice("info", "Your balances are 40 days old.", { action: { label: "Update my balances", run: () => { ran++; } } });
  const buttons = n.querySelectorAll("button");
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].textContent, "Update my balances");
  assert.ok(buttons[0].closest(".notice-actions"), "the button sits in its own line");
  assert.ok(buttons[0].classList.contains("secondary"), "outlined, not a second filled button");
  buttons[0].click();
  assert.equal(ran, 1, "its tap runs the page's way on");
  const both = notice("ok", "Saved.", { undo: () => ({ done: 1, kept: 0 }), action: { label: "Other", run: () => { } } });
  assert.deepEqual([...both.querySelectorAll("button")].map((b) => b.textContent), ["Undo"], "Undo wins: never two buttons on one notice");
});

// ---- ui.undoable (core/ui/dom.js) on a stand-in store with core/store.js's order: another tab's save first, then the change
import { undoable, undoneWords } from "../core/ui/dom.js";
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

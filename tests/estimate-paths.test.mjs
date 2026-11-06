// tests/estimate-paths.test.mjs -- core/estimate/paths.js: where a guess lives, as a short path (docs/CONVENTIONS.md
// "Guesses"). Hand-made plans, no tables.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePath, getAt, setAt, canonical, pathOf } from "../core/estimate/index.js";

const plan = () => ({
  accounts: [{ id: "a1", balance: 1200 }, { id: "a2", balance: null }],
  debts: [{ id: "d-3", accountId: "acct-9", rate: 0.046 }],
  retirement: { spendingMonthly: 4100, socialSecurity: { p1: { monthlyAtFRA: 2210 } } },
});

test("parsePath reads names and [ids], and throws on a malformed path or an id with . [ ]", () => {
  assert.deepEqual(parsePath("accounts[a1].balance"), [{ name: "accounts", id: "a1" }, { name: "balance" }]);
  assert.deepEqual(parsePath("retirement.socialSecurity.p1.monthlyAtFRA").map((s) => s.name), ["retirement", "socialSecurity", "p1", "monthlyAtFRA"]);
  for (const bad of ["accounts[a.b].balance", "accounts[].balance", "a..b", "", "accounts[a1]x.balance", "a[b[c]].d", null]) {
    assert.throws(() => parsePath(bad), /bad guess path/, String(bad));
  }
});

test("getAt: the value, or undefined when anything on the way is missing", () => {
  const p = plan();
  assert.equal(getAt(p, "accounts[a1].balance"), 1200);
  assert.equal(getAt(p, "accounts[a2].balance"), null, "a stored null is a value");
  assert.equal(getAt(p, "retirement.socialSecurity.p1.monthlyAtFRA"), 2210);
  assert.equal(getAt(p, "accounts[nope].balance"), undefined);
  assert.equal(getAt(p, "accounts[a1].missing"), undefined);
  assert.equal(getAt(p, "retirement.socialSecurity.p9.monthlyAtFRA"), undefined);
  assert.equal(getAt(p, "goals[g1].target"), undefined, "no such list");
  assert.equal(getAt(p, "accounts[a1]"), undefined, "a path names a field, not a whole record");
  assert.equal(getAt(null, "accounts[a1].balance"), undefined);
});

test("setAt never creates a missing record or key: false, and the plan is untouched", () => {
  const p = plan(), before = JSON.stringify(p);
  assert.equal(setAt(p, "accounts[nope].balance", 5), false);
  assert.equal(setAt(p, "retirement.socialSecurity.p9.monthlyAtFRA", 5), false);
  assert.equal(setAt(p, "household.state", "OH"), false);
  assert.equal(JSON.stringify(p), before, "nothing created on the way");
  assert.equal(setAt(p, "accounts[a2].balance", 900), true);
  assert.equal(p.accounts[1].balance, 900);
});

// review of C1 (2026-11-06, plumbing 3): the last key is not created either, so a misspelled field is never written as junk
// that a guess then refreshes for good, and no path can reach an object's prototype
test("setAt never creates the last key either, and parsePath refuses __proto__, constructor and prototype", () => {
  const p = plan(), before = JSON.stringify(p);
  assert.equal(setAt(p, "accounts[a1].balanse", 5), false, "a misspelled field");
  assert.equal(setAt({ retirement: {} }, "retirement.spendingMonthly", 5), false, "an absent optional field: the caller creates it (null) first");
  assert.equal(JSON.stringify(p), before);
  const q = { retirement: { spendingMonthly: null } };
  assert.equal(setAt(q, "retirement.spendingMonthly", 4100), true, "a field that is there, even null, is written");
  assert.equal(q.retirement.spendingMonthly, 4100);
  for (const bad of ["retirement.__proto__", "retirement.constructor.x", "accounts[a1].__proto__", "prototype", "goals[__proto__].target", "a.constructor"]) {
    assert.throws(() => parsePath(bad), /bad guess path/, bad);
  }
  const r = { retirement: {} };
  assert.throws(() => setAt(r, "retirement.__proto__", { polluted: true }), /bad guess path/);
  assert.equal(Object.getPrototypeOf(r.retirement), Object.prototype, "the prototype is untouched");
  assert.equal({}.polluted, undefined);
});

test("canonical: debts[<accountId>] is stored as debts[<debt row id>]; reads accept both", () => {
  const p = plan();
  assert.equal(canonical(p, "debts[acct-9].rate"), "debts[d-3].rate");
  assert.equal(canonical(p, "debts[d-3].rate"), "debts[d-3].rate");
  assert.equal(canonical(p, "debts[unknown].rate"), "debts[unknown].rate");
  assert.equal(canonical(p, "accounts[acct-9].balance"), "accounts[acct-9].balance", "only debts are rewritten");
  assert.equal(getAt(p, "debts[acct-9].rate"), getAt(p, "debts[d-3].rate"));
  assert.equal(setAt(p, "debts[acct-9].rate", 0.05), true);
  assert.equal(p.debts[0].rate, 0.05);
  assert.equal(pathOf("debts", "d-3", "rate"), "debts[d-3].rate");
});

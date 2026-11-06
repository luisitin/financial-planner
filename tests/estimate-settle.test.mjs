// tests/estimate-settle.test.mjs -- core/estimate/engine.js with stub estimators: estimate() and its contract, settle()
// (untouched guesses follow the answers inside a change; it never creates, never moves a typed figure, is idempotent),
// the gate, mergeEstimators and checkEstimators. A fuzz run checks the one promise that matters most: a figure the
// person typed keeps its value whatever else happens.
import { test } from "node:test";
import assert from "node:assert/strict";
import { estimate, settle, applies, mergeEstimators, checkEstimators, markGuess, saveField, isGuess, getAt, rangeOf } from "../core/estimate/index.js";

const T = "2026-11-02";
const TABLES = { t1: { readOn: "2026-11-02" }, t0: { readOn: "2025-06-01" } };
const idOf = (path) => /\[([^\]]+)\]/.exec(path ?? "")?.[1] ?? null;
/** n: an answer the guesses follow (plan.meta.n). pay (tier 1) -> income[i1].amount; follow (tier 3) reads that income. */
const ESTS = {
  "t.pay": { tier: 1, order: 1, label: "Pay", unit: "month", weight: "big", reads: [], fn: (p) => ({ value: p.meta.n * 100, why: "a hundred times n", tables: ["t1"], rounded: true }) },
  "t.n": { tier: 2, order: 1, label: "n itself", unit: "month", weight: "small", reads: [], fn: (p) => (typeof p.meta.n === "number" ? { value: p.meta.n, why: "the answer n", tables: ["t1"], rounded: true } : null) },
  "t.follow": {
    tier: 3, order: 1, label: "A tenth of pay", unit: "month", weight: "small", reads: ["t.pay"],
    fn: (p) => { const pay = getAt(p, "income[i1].amount"); return typeof pay === "number" ? { value: pay / 10, why: "a tenth of the pay", tables: ["t1"], rounded: true } : null; },
  },
  "t.old": { tier: 2, order: 2, label: "Old data", unit: "month", weight: "small", reads: [], fn: (p) => ({ value: p.meta.n, why: "older tables", tables: ["t0"], rounded: true }) },
  "t.wide": { tier: 2, order: 3, label: "Measured", unit: "total", weight: "big", reads: [], fn: () => ({ value: 123456, sigma: 0.3, measured: true, why: "a measured spread", tables: ["t1"] }) },
  "t.byId": { tier: 2, order: 4, label: "By record", unit: "month", weight: "small", reads: [], fn: (p, o) => ({ value: p.meta.n * (Number(idOf(o.path)?.slice(1)) || 1), why: "n times the row number", tables: ["t1"], rounded: true }) },
};
const opts = { estimators: ESTS, tables: TABLES, today: T };
const plan = (n = 10) => ({ meta: { currency: "USD", n }, income: [{ id: "i1", amount: null }], expenses: [{ id: "e1", amount: null }, { id: "e2", amount: null }, { id: "e3", amount: null }], debts: [] });
const mark = (p, path, key) => markGuess(p, path, estimate(p, key, { ...opts, path }), T);

test("estimate(): the contract -- a sourced, rounded Estimate or null", () => {
  const p = plan();
  const e = estimate(p, "t.wide", opts);
  assert.deepEqual({ key: e.key, value: e.value, unit: e.unit, measured: e.measured, dataAsOf: e.dataAsOf, weight: e.weight, basis: e.basis }, { key: "t.wide", value: 120000, unit: "total", measured: true, dataAsOf: T, weight: "big", basis: "population" });
  assert.ok(e.low <= e.value && e.value <= e.high, "low <= value <= high when measured");
  assert.deepEqual([e.low, e.high], [100000, 150000], "the middle half, rounded the same way: 123,456 x e^(-/+0.2022)");
  assert.equal(estimate(p, "nope", opts), null);
  const bad = (r, extra = {}) => estimate(p, "x", { ...opts, estimators: { x: { tier: 2, order: 1, label: "X", unit: "month", weight: "small", fn: () => r, ...extra } } });
  assert.equal(bad({ value: NaN, why: "w", tables: ["t1"] }), null, "not finite");
  assert.equal(bad({ value: 5, why: "w", tables: ["nope"] }), null, "an unknown table");
  assert.equal(bad({ value: 5, why: "w", tables: [] }), null, "a population figure with no table");
  assert.equal(bad({ value: 5, why: "w", tables: [] }, { basis: "yours" }), null, "worked out from the plan: still needs a dataAsOf");
  assert.equal(bad({ value: 5, why: "w", tables: [], dataAsOf: T }, { basis: "yours" }).value, 10, "yours: no table, rounded to $10");
  assert.equal(bad({ value: 5, why: " ", tables: ["t1"] }), null, "no why");
  assert.equal(bad({ value: 5, why: "w", tables: ["t1"], dataAsOf: "Nov 2026" }), null, "dataAsOf is an ISO date");
  assert.equal(bad(null), null);
  assert.deepEqual(bad({ value: null, ask: { key: "hoa", kind: "hurdle" } }), { key: "x", value: null, unit: "month", ask: { key: "hoa", kind: "hurdle" } }, "a tap still to answer");
  assert.equal(bad({ value: ["a1"], why: "w", tables: ["t1"] }, { unit: "list" }).value[0], "a1", "a list of ids");
  assert.throws(() => bad(undefined, { fn: () => { throw new Error("boom"); } }), /boom/, "a throw is not swallowed here");
});

test("the gate: a non-USD plan or 'I live outside the U.S.' gets no guess; a blank currency counts as USD", () => {
  assert.equal(applies({ meta: { currency: "USD" } }), true);
  assert.equal(applies({ meta: {} }), true);
  assert.equal(applies({ meta: { currency: "EUR" } }), false);
  assert.equal(applies({ meta: { currency: "USD" }, guide: { setup: { outsideUS: true } } }), false);
  const p = plan(); p.meta.currency = "EUR";
  assert.equal(estimate(p, "t.n", opts), null);
});

test("lib.estimate reads only earlier keys (tier, then order)", () => {
  const ests = { ...ESTS, "t.reader": { tier: 2, order: 9, label: "R", unit: "month", weight: "small", fn: (p, o, lib) => ({ value: (lib.estimate("t.pay")?.value ?? 0) + (lib.estimate("t.follow")?.value ?? 0), why: "w", tables: ["t1"], rounded: true }) } };
  assert.equal(estimate(plan(), "t.reader", { ...opts, estimators: ests }).value, 1000, "pay (tier 1) is read; follow (tier 3) is not");
});

test("settle: a mark of 10 follows the answer to 14", () => {
  const p = plan(10);
  mark(p, "expenses[e1].amount", "t.n");
  assert.equal(p.expenses[0].amount, 10);
  p.meta.n = 14;
  const r = settle(p, opts);
  assert.deepEqual(r, { changed: [{ path: "expenses[e1].amount", k: "t.n", from: 10, to: 14 }], dropped: [] });
  assert.equal(p.expenses[0].amount, 14);
  assert.deepEqual(p.guesses["expenses[e1].amount"], { k: "t.n", v: 14, u: "month", s: null, at: T, d: T });
  assert.equal(isGuess(p, "expenses[e1].amount"), true);
});

test("settle: typed over -> dropped, and never comes back", () => {
  const p = plan(10);
  mark(p, "expenses[e1].amount", "t.n");
  p.expenses[0].amount = 99;                                    // typed somewhere without saveField
  assert.deepEqual(settle(p, opts).dropped, [{ path: "expenses[e1].amount", k: "t.n", why: "typed" }]);
  assert.equal(p.guesses, undefined, "the last entry gone: plan.guesses deleted");
  p.meta.n = 20;
  assert.deepEqual(settle(p, opts), { changed: [], dropped: [] });
  assert.equal(p.expenses[0].amount, 99);
});

test("settle: tier 3 sees tier 1's new value in the same pass; one pass reaches the fixed point", () => {
  const p = plan(10);
  mark(p, "income[i1].amount", "t.pay");
  mark(p, "expenses[e1].amount", "t.follow");
  assert.deepEqual([p.income[0].amount, p.expenses[0].amount], [1000, 100]);
  p.meta.n = 12;
  const r = settle(p, opts);
  assert.deepEqual(r.changed.map((c) => [c.k, c.from, c.to]), [["t.pay", 1000, 1200], ["t.follow", 100, 120]]);
  const json = JSON.stringify(p);
  assert.deepEqual(settle(p, opts), { changed: [], dropped: [] }, "idempotent");
  assert.equal(JSON.stringify(p), json);
});

test("settle: a removed record -> gone; settle leaves the same draft object, changed in place", () => {
  const p = plan(10);
  mark(p, "expenses[e2].amount", "t.n");
  mark(p, "expenses[e3].amount", "t.byId");
  const ref = p;
  p.expenses = p.expenses.filter((x) => x.id !== "e2");
  p.meta.n = 11;
  const r = settle(p, opts);
  assert.deepEqual(r.dropped, [{ path: "expenses[e2].amount", k: "t.n", why: "gone" }]);
  assert.deepEqual(r.changed, [{ path: "expenses[e3].amount", k: "t.byId", from: 30, to: 33 }]);
  assert.equal(ref, p);
  assert.deepEqual(Object.keys(p.guesses), ["expenses[e3].amount"], "settle never creates an entry");
});

test("settle: the d guard -- a fresh estimate from tables older than the entry's d is not written back", () => {
  const p = plan(10);
  mark(p, "expenses[e1].amount", "t.old");
  p.guesses["expenses[e1].amount"].d = "2027-11-01";          // written by a newer app on another phone
  p.meta.n = 14;
  assert.deepEqual(settle(p, opts), { changed: [], dropped: [] });
  assert.equal(p.expenses[0].amount, 10);
  p.guesses["expenses[e1].amount"].d = "2025-01-01";
  assert.equal(settle(p, opts).changed.length, 1, "a newer estimate is written");
});

test("settle: an estimator no module has any more stays frozen and still counts as a guess", () => {
  const p = plan(10);
  mark(p, "expenses[e1].amount", "t.n");
  p.guesses["expenses[e1].amount"].k = "gone.key";
  p.meta.n = 14;
  assert.deepEqual(settle(p, opts), { changed: [], dropped: [] });
  assert.equal(isGuess(p, "expenses[e1].amount"), true);
  assert.equal(p.expenses[0].amount, 10);
});

test("settle: the gate closed or an input gone -> the guess stays as it is", () => {
  const p = plan(10);
  mark(p, "expenses[e1].amount", "t.n");
  p.meta.currency = "EUR"; p.meta.n = 14;
  assert.deepEqual(settle(p, opts), { changed: [], dropped: [] });
  p.meta.currency = "USD"; delete p.meta.n;
  assert.deepEqual(settle(p, opts), { changed: [], dropped: [] });
  assert.equal(p.expenses[0].amount, 10);
});

test("settle: the older Get started flags are frozen (a stub mortgage estimate of 4.6% moves nothing)", () => {
  const p = {
    meta: { currency: "USD" }, accounts: [{ id: "setup-owe-mortgage", type: "mortgage", balance: 210000 }],
    debts: [{ id: "setup-debt-mortgage", accountId: "setup-owe-mortgage", rate: 0.0724, rateGuessed: 0.0724, minPayment: 1431.15, paymentGuessed: 1431.15 }],
  };
  const ests = { "debt.mortgage.rate": { tier: 2, order: 4, label: "Mortgage rate", unit: "rate", weight: "big", fn: () => ({ value: 0.046, why: "w", tables: ["t1"] }) } };
  const json = JSON.stringify(p);
  assert.deepEqual(settle(p, { ...opts, estimators: ests }), { changed: [], dropped: [] });
  assert.equal(JSON.stringify(p), json);
  p.guesses = { "debts[x].rate": { k: "debt.mortgage.rate", v: 0.05, u: "rate", s: null, at: T, d: T } };   // another entry present
  settle(p, { ...opts, estimators: ests });
  assert.deepEqual([p.debts[0].rate, p.debts[0].rateGuessed], [0.0724, 0.0724]);
});

test("settle: a throwing estimator throws (the store keeps the person's change; tests/store-settle.test.mjs)", () => {
  const p = plan(10);
  mark(p, "expenses[e1].amount", "t.n");
  p.meta.n = 11;
  assert.throws(() => settle(p, { ...opts, estimators: { ...ESTS, "t.n": { ...ESTS["t.n"], fn: () => { throw new Error("broken estimator"); } } } }), /broken estimator/);
});

test("settle on a plan with no guesses is one look and changes nothing", () => {
  const p = plan(10), json = JSON.stringify(p);
  assert.deepEqual(settle(p, opts), { changed: [], dropped: [] });
  assert.equal(JSON.stringify(p), json);
  assert.deepEqual(settle({ guesses: {} }, opts), { changed: [], dropped: [] });
});

test("checkEstimators reports a read of a later tier, a duplicate key and a missing label; mergeEstimators keeps the first", () => {
  assert.deepEqual(checkEstimators(ESTS), []);
  const later = { a: { tier: 2, order: 1, label: "A", unit: "month", weight: "big", reads: ["b"], fn() {} }, b: { tier: 3, order: 1, label: "B", unit: "month", weight: "small", reads: [], fn() {} } };
  assert.match(checkEstimators(later).join("\n"), /a: reads b, which is not earlier/);
  assert.match(checkEstimators([{ x: ESTS["t.n"] }, { x: ESTS["t.pay"] }]).join("\n"), /x: defined twice/);
  assert.match(checkEstimators({ c: { ...ESTS["t.n"], label: "" } }).join("\n"), /c: missing label/);
  assert.match(checkEstimators({ c: { ...ESTS["t.n"], unit: "weeks", weight: "huge", tier: 7 } }).join("\n"), /tier must be 1, 2, 3 or 4[\s\S]*unit must be[\s\S]*weight must be/);
  assert.match(checkEstimators({ c: { ...ESTS["t.n"], reads: ["nobody"] } }).join("\n"), /reads nobody, which no module defines/);
  const m = mergeEstimators([{ from: "a/one", estimators: { k: ESTS["t.n"] }, tables: TABLES }, { from: "b/two", estimators: { k: ESTS["t.pay"], j: ESTS["t.pay"] }, tables: { t1: { readOn: "x" } } }]);
  assert.equal(m.estimators.k, ESTS["t.n"]);
  assert.deepEqual(Object.keys(m.estimators), ["k", "j"]);
  assert.deepEqual(m.weights, { k: "small", j: "big" });
  assert.deepEqual(m.problems, ["estimator k is defined twice (a/one and b/two)", "guess table t1 is defined twice (b/two)"]);
});

test("rangeOf: a verdict at the middle-half ends of the guessed inputs, on copies", () => {
  const p = { expenses: [{ id: "e1", amount: 100 }, { id: "e2", amount: 300 }], income: [{ id: "i1", amount: 1000 }] };
  const left = (q) => q.income[0].amount - q.expenses.reduce((s, x) => s + x.amount, 0);
  const r = rangeOf(left, p, [{ paths: ["expenses[e1].amount", "expenses[e2].amount"], factorLow: 0.8, factorHigh: 1.25 }, { paths: ["income[i1].amount"], factorLow: 0.9, factorHigh: 1.1 }]);
  assert.equal(r.mid, 600);
  assert.deepEqual([r.low, r.high], [Math.min(1000 * 0.9 - 400 * 0.8, 1000 * 1.1 - 400 * 1.25), Math.max(1000 * 0.9 - 400 * 0.8, 1000 * 1.1 - 400 * 1.25, 600)]);
  assert.equal(r.decisive, 1, "the pay moves the answer by 200, the spending by 180");
  assert.equal(p.expenses[0].amount, 100, "the plan itself is untouched");
});

test("fuzz: 500 random sequences of answers, marks, typing, removals and settles -- a typed figure always keeps its value", () => {
  let seed = 2026;                                              // xorshift32: the same sequences on every run
  const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 2 ** 32; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const ROWS = ["e1", "e2", "e3"];
  for (let run = 0; run < 500; run++) {
    const p = plan(Math.floor(rnd() * 50) + 1);
    const typed = new Map();                                    // path -> the value the person typed last
    for (let step = 0; step < 25; step++) {
      const id = pick(ROWS), path = `expenses[${id}].amount`;
      const op = pick(["answer", "answer", "mark", "mark", "type", "remove", "add", "pay"]);
      if (op === "answer") p.meta.n = Math.floor(rnd() * 50) + 1;
      else if (op === "pay") { if (!isGuess(p, "income[i1].amount") && !typed.has("income[i1].amount")) mark(p, "income[i1].amount", "t.pay"); }
      else if (op === "mark") { if (p.expenses.some((x) => x.id === id) && !typed.has(path)) saveField(p, path, { value: null, guessed: true }, estimate(p, pick(["t.n", "t.follow", "t.byId"]), { ...opts, path }), T); }
      else if (op === "type") { if (p.expenses.some((x) => x.id === id)) { const v = Math.floor(rnd() * 1000); saveField(p, path, { value: v, guessed: false }, null, T); typed.set(path, v); } }
      else if (op === "remove") { p.expenses = p.expenses.filter((x) => x.id !== id); typed.delete(path); }
      else if (op === "add") { if (!p.expenses.some((x) => x.id === id)) p.expenses.push({ id, amount: null }); }
      const before = Object.keys(p.guesses ?? {});
      settle(p, opts);
      for (const [tp, v] of typed) assert.equal(getAt(p, tp), v, `run ${run} step ${step}: ${tp} kept its typed value`);
      for (const k of Object.keys(p.guesses ?? {})) assert.ok(before.includes(k), "settle never creates an entry");
      for (const [gp, e] of Object.entries(p.guesses ?? {})) assert.equal(getAt(p, gp), e.v, "every entry left equals its field");
      const json = JSON.stringify(p);
      settle(p, opts);
      assert.equal(JSON.stringify(p), json, "a second settle changes nothing");
    }
  }
});

// review of C1 (2026-11-06, plumbing 4): one malformed entry (an import, a restore or a hand edit; migrate passes `guesses`
// through untouched) must not stop every refresh: settle drops it as "bad", the rest follow, and readers skip it
test("a malformed ledger entry (null, a string, {} or no key) is dropped as bad; the rest still follow and readers skip it", async () => {
  const { guessesInUse, guessAt } = await import("../core/estimate/index.js");
  const p = plan(10);
  mark(p, "expenses[e1].amount", "t.n");
  p.guesses["expenses[e2].amount"] = null;
  p.guesses["expenses[e3].amount"] = "10";
  p.guesses["income[i1].amount"] = {};
  p.guesses["retirement.spendingMonthly"] = { v: 4100, u: "month" };
  assert.equal(guessesInUse(p).length, 1, "only the good entry is in use");
  assert.equal(guessAt(p, "expenses[e2].amount"), null);
  assert.equal(guessAt(p, "income[i1].amount"), null);
  p.meta.n = 14;
  const r = settle(p, opts);
  assert.deepEqual(r.changed, [{ path: "expenses[e1].amount", k: "t.n", from: 10, to: 14 }], "the good one still follows");
  assert.deepEqual(r.dropped.map((x) => [x.path, x.why]).sort(), [["expenses[e2].amount", "bad"], ["expenses[e3].amount", "bad"], ["income[i1].amount", "bad"], ["retirement.spendingMonthly", "bad"]]);
  assert.deepEqual(Object.keys(p.guesses), ["expenses[e1].amount"]);
  assert.deepEqual(settle(p, opts), { changed: [], dropped: [] }, "the next settle is quiet");
  const only = plan(); only.guesses = { "expenses[e1].amount": null };
  settle(only, opts);
  assert.equal("guesses" in only, false, "the ledger goes when its last entry was bad");
});

// review of C1 (2026-11-06, plumbing 5; spec 4.8): a bank file in another currency closes the gate too. The importer keeps
// the file's currency column on its import record (transactions/import importRecord)
test("the gate: an import record in another currency means no U.S. guess; USD or no currency keeps it open", () => {
  assert.equal(applies({ meta: { currency: "USD" }, imports: [{ id: "i", currency: "EUR" }] }), false);
  assert.equal(applies({ meta: { currency: "USD" }, imports: [{ id: "i", currency: "USD" }, { id: "j" }] }), true);
  assert.equal(applies({ meta: { currency: "USD" }, imports: [{ id: "j", currency: "" }] }), true);
  const p = plan(); p.imports = [{ id: "imp", currency: "EUR" }];
  assert.equal(estimate(p, "t.n", opts), null);
});

// verify step of C1 (2026-11-06): the same class as the malformed entry above, one level up and one field over. A ledger
// that is not an object, an entry whose v no save could write (null, a word), or a key named like an Object built-in.
test("a ledger that is not an object, a v that is not a figure, or a key like 'constructor': dropped or frozen, never written, the page still draws", async () => {
  const { guessesInUse, guessAt, isGuess } = await import("../core/estimate/index.js");
  const { compute } = await import("../modules/overview/guesses/compute.js");
  const legacy = (g) => { const p = plan(10); p.debts = [{ id: "setup-debt-credit", accountId: "a9", rate: 0.2236, rateGuessed: 0.2236, minPayment: 50 }]; p.guesses = g; return p; };
  for (const g of ["junk", 5, true, [{ k: "t.n", v: 10, u: "month" }]]) {
    const p = legacy(g);
    assert.equal(guessesInUse(p).length, 1, `${JSON.stringify(g)}: the older flag is still read`);
    assert.equal(isGuess(p, "debts[setup-debt-credit].rate"), true);
    assert.doesNotThrow(() => compute(p, opts), `${JSON.stringify(g)}: the page draws`);
    const r = settle(p, opts);
    assert.deepEqual(r, { changed: [], dropped: [{ path: "guesses", k: null, why: "bad" }] });
    assert.equal("guesses" in p, false, "the junk ledger goes whole");
    const q = legacy(g);
    markGuess(q, "expenses[e1].amount", estimate(q, "t.n", { ...opts, path: "expenses[e1].amount" }), T);
    assert.deepEqual(Object.keys(q.guesses), ["expenses[e1].amount"], `${JSON.stringify(g)}: a new guess replaces the junk, never spreads it`);
  }
  // v null on a blank field: never filled in; v a word: no figure is ever written into that field
  const blank = plan(10); blank.expenses[0].amount = null;
  blank.guesses = { "expenses[e1].amount": { k: "t.n", v: null, u: "month" }, "household.state": { k: "t.n", v: "OH", u: "month" } };
  blank.household = { state: "OH" };
  assert.equal(guessAt(blank, "expenses[e1].amount"), null);
  assert.equal(guessesInUse(blank).length, 0);
  const r = settle(blank, opts);
  assert.deepEqual(r.changed, []);
  assert.deepEqual(r.dropped.map((x) => x.why), ["bad", "bad"]);
  assert.equal(blank.expenses[0].amount, null);
  assert.equal(blank.household.state, "OH");
  // a key that is an Object built-in names no estimator: frozen (S6), listed with "Type the real figure", the page draws
  for (const k of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
    const p = plan(10);
    p.accounts = [{ id: "a1", name: "Checking", type: "checking", balance: 900 }];
    p.guesses = { "accounts[a1].balance": { k, v: 900, u: "total", s: null, at: "2026-11-02", d: "2026-11-02" } };
    assert.deepEqual(settle(p, opts), { changed: [], dropped: [] }, `${k}: frozen`);
    const d = compute(p, opts);
    assert.equal(d.rows.length, 1);
    assert.equal(d.rows[0].frozen, true, `${k}: frozen on the page`);
    assert.equal(d.rows[0].label, "Checking: a figure we filled in");
  }
});

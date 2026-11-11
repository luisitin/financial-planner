// tests/store-settle.test.mjs -- the guess hook in core/store.js: settle runs once inside each update() and nowhere else
// (load, adopt, replace, resolve, resync and another tab's save never call it: opening the app or taking a copy writes
// nothing), a settle that throws keeps the person's change, and the whole store-sync suite passes with a settle
// registered. The fake PC and browser are the same as tests/store-sync.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { settle } from "../core/estimate/index.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const T = "2026-11-02";
function storage() {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
const pc = { plan: null, up: true };
const listeners = [];
globalThis.location = { search: "", protocol: "http:", origin: "http://pc.test" };
globalThis.document = { querySelector: (sel) => (sel === 'script[type="importmap"]' ? {} : null) };   // the PC served this page (core/api.js pageFromPc): its import map is there
globalThis.Event = class { constructor(type) { this.type = type; } };
globalThis.addEventListener = (type, fn) => listeners.push({ type, fn });
globalThis.dispatchEvent = () => true;
globalThis.fetch = async (url, opt = {}) => {
  if (!pc.up) throw new TypeError("network down");
  const u = new URL(url), m = opt.method || "GET";
  const res = (status, body) => ({ status, ok: status < 300, json: async () => structuredClone(body), text: async () => JSON.stringify(body) });
  if (u.pathname === "/api/health") return res(200, { ok: true });
  if (u.pathname === "/api/plan" && m === "GET") return pc.plan ? res(200, structuredClone(pc.plan)) : res(404, {});
  if (u.pathname === "/api/plan" && m === "PUT") {
    const plan = JSON.parse(opt.body), base = opt.headers?.["X-Planner-Base"];
    const cur = pc.plan?.meta?.rev || pc.plan?.meta?.updatedAt || "";
    if (typeof base === "string" && base && pc.plan && cur && cur !== base && cur !== (plan.meta?.rev || plan.meta?.updatedAt)) return res(409, { plan: pc.plan });
    pc.plan = plan;
    return res(200, { ok: true });
  }
  throw new Error(`unexpected ${m} ${url}`);
};

// one stub estimator: the guess on e1 is n itself. Every plan below holds a guess that is out of date (n is 14, the
// guess still 10), so any settle that runs shows: the amount turns 14.
const ESTS = { "t.n": { tier: 2, order: 1, label: "n", unit: "month", weight: "small", reads: [], fn: (p) => ({ value: p.meta.n, why: "the answer n", tables: ["t1"], rounded: true }) } };
const OPTS = { estimators: ESTS, tables: { t1: { readOn: T } }, today: T };
let rev = 0;
const stale = (notes) => ({ schemaVersion: 1, notes, meta: { currency: "USD", n: 14, rev: `r${++rev}`, updatedAt: new Date(Date.UTC(2026, 10, 1, 8, rev)).toISOString() }, expenses: [{ id: "e1", amount: 10 }], guesses: { "expenses[e1].amount": { k: "t.n", v: 10, u: "month", s: null, at: T, d: T } } });
const amount = (s) => s.get().expenses[0].amount;

let n = 0;
async function device(ls, tab = storage()) {
  globalThis.localStorage = ls; globalThis.sessionStorage = tab;
  const { store } = await import(`../core/store.js?settle=${++n}`);
  const calls = { n: 0 };
  store.settleWith((d) => { calls.n++; return settle(d, OPTS); });
  const use = () => { globalThis.localStorage = ls; globalThis.sessionStorage = tab; };
  return { store, calls, use };
}
const storageEvent = (key = "planner.plan") => { for (const l of listeners) if (l.type === "storage") l.fn({ key }); };

test("settle runs once per update, and its result is read once; load, adopt, replace and resync never run it", async () => {
  pc.plan = stale("PC"); pc.up = true;
  const a = await device(storage());
  await a.store.load();
  assert.deepEqual([a.calls.n, amount(a.store)], [0, 10], "opening the app moves no guess");
  pc.plan = stale("adopted");                              // adopt: a newer plan read from the PC
  a.store.adopt(structuredClone(pc.plan));
  assert.deepEqual([a.calls.n, amount(a.store), a.store.get().notes], [0, 10, "adopted"]);
  a.store.replace(stale("replaced"));
  assert.deepEqual([a.calls.n, amount(a.store)], [0, 10], "a restored backup or an import is taken as it is");
  await a.store.save(); await a.store.idle();
  pc.plan = stale("newer on the PC");
  await a.store.resync();
  assert.deepEqual([a.calls.n, a.store.get().notes, amount(a.store)], [0, "newer on the PC", 10], "another device's copy is taken as it is");
  a.store.update((d) => { d.notes = "renamed"; });
  assert.deepEqual([a.calls.n, amount(a.store)], [1, 14], "the person's own change: the untouched guess follows n");
  assert.deepEqual(a.store.takeSettled(), { changed: [{ path: "expenses[e1].amount", k: "t.n", from: 10, to: 14 }], dropped: [] });
  assert.equal(a.store.takeSettled(), null, "read once");
  a.store.update((d) => { d.notes = "again"; });
  assert.equal(a.calls.n, 2);
  assert.deepEqual(a.store.takeSettled(), { changed: [], dropped: [] });
  await a.store.idle();
});

test("another tab's save is taken without a settle; this tab's next change settles once", async () => {
  pc.up = false;                                           // two tabs on one device, the PC out of reach
  const ls = storage();
  ls.setItem("planner.plan", JSON.stringify(stale("start")));
  const a = await device(ls), b = await device(ls);
  a.use(); await a.store.load(); b.use(); await b.store.load();
  b.store.update((d) => { d.notes = "B's change"; d.meta.n = 20; d.guesses = { "expenses[e1].amount": { ...d.guesses["expenses[e1].amount"], v: 10 } }; d.expenses[0].amount = 10; });
  assert.equal(b.calls.n, 1);
  a.use(); storageEvent();
  assert.equal(a.store.get().notes, "B's change", "tab A takes tab B's copy");
  assert.equal(a.calls.n, 0, "taking another tab's save settles nothing");
  a.store.update((d) => { d.notes = "A's change"; });
  assert.equal(a.calls.n, 1, "once, for A's own change (after it took B's)");
  assert.equal(amount(a.store), 20);
  pc.up = true;
});

test("resolve never settles: neither taking the other version nor keeping this one", async () => {
  pc.plan = stale("PC"); pc.up = true;
  const a = await device(storage());
  await a.store.load();
  a.store.update((d) => { d.notes = "mine"; });
  assert.equal(a.calls.n, 1);
  pc.plan = stale("someone else's");                       // saved on another device meanwhile
  await a.store.save(); await a.store.idle();
  assert.ok(a.store.syncState().conflict, "the shell asks which to keep");
  a.store.resolve("theirs");
  assert.deepEqual([a.calls.n, a.store.get().notes, amount(a.store)], [1, "someone else's", 10], "their copy, exactly as saved");
  a.store.update((d) => { d.notes = "mine again"; });
  assert.equal(a.calls.n, 2);
  pc.plan = stale("someone else's again");
  await a.store.save(); await a.store.idle();
  assert.ok(a.store.syncState().conflict);
  const before = JSON.stringify(a.store.get().expenses);
  a.store.resolve("mine");
  assert.equal(a.calls.n, 2, "keeping this version sends it as it is");
  assert.equal(JSON.stringify(a.store.get().expenses), before);
  await a.store.idle();
});

test("a settle that throws keeps the person's change and leaves no half refresh behind", async () => {
  pc.plan = stale("PC"); pc.up = true;
  const a = await device(storage());
  await a.store.load();
  const err = console.error; console.error = () => {};
  try {
    a.store.settleWith((d) => { d.expenses[0].amount = 999; throw new Error("broken estimator"); });
    a.store.update((d) => { d.notes = "kept"; });
    assert.deepEqual([a.store.get().notes, amount(a.store)], ["kept", 10], "the change is kept; the settle's partial write is not");
    assert.equal(a.store.takeSettled(), null);
    a.store.settleWith(() => { throw new Error("broken"); });
    a.store.update((d) => { delete d.guesses; d.notes = "no guesses"; });
    assert.equal(a.store.get().notes, "no guesses");
  } finally { console.error = err; }
  a.store.settleWith(null);
  a.store.update((d) => { d.notes = "no hook"; });
  assert.equal(a.store.takeSettled(), null, "unregistered: nothing runs");
  await a.store.idle();
});

test("every store-sync scenario passes with a settle registered (SETTLE_HOOK=1)", () => {
  const env = { ...process.env, SETTLE_HOOK: "1" };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, ["--test", "tests/store-sync.test.mjs"], { cwd: ROOT, env, encoding: "utf8", timeout: 120000 });
  const fail = /^# fail (\d+)/m.exec(r.stdout ?? "")?.[1];
  const pass = /^# pass (\d+)/m.exec(r.stdout ?? "")?.[1];
  assert.equal(r.status, 0, (r.stdout ?? "").slice(-3000) + (r.stderr ?? ""));
  assert.equal(fail, "0");
  assert.ok(Number(pass) >= 28, `store-sync scenarios passed with the hook: ${pass}`);
});

// tests/demo.test.mjs -- looking around with a pretend family (gap design #20, core/demo/README.md).
// What must hold: a visit to a pretend family leaves the real plan, its waiting mark and a tester's own pretend plan
// byte-identical, on a phone alone and with the home computer in reach; the pretend family lives under its own key;
// without `demo` in the address the store does exactly what it did (the invariance); each bundled plan is whole, is
// made for today, holds nothing real, and every page's compute runs on it.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { DEMOS, DEMO_IDS, DEMO_START, DEMO_KEEP_DAYS, LEFT_KEY, demoOf, demoKey, demoHref, leaveHref, demoLine, leftWords, lookNext, demoOld, bornOn, monthsFrom, localToday } from "../core/demo/names.js";
import { demoPlan } from "../core/demo/plans.js";
import { showDemoBar, takeLeft } from "../core/demo/bar.js";
import { migrate, SCHEMA_VERSION } from "../core/schema/migrate.js";
import { touchesApp } from "../tools/live-check.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const T = "2026-11-13";

// ------------------------------------------------------------------ the names and the addresses (pure)
test("demoOf: a pretend family only inside the sandbox; an unknown or missing name is the first family", () => {
  assert.equal(demoOf("?sandbox=1&demo=family"), "family");
  assert.equal(demoOf("?sandbox=1&demo=couple"), "couple");
  assert.equal(demoOf("?demo=starter&sandbox"), "starter");
  assert.equal(demoOf("?sandbox=1&demo=COUPLE"), "couple");
  assert.equal(demoOf("?sandbox=1&demo=nobody"), "family");
  assert.equal(demoOf("?sandbox=1&demo"), "family");
  assert.equal(demoOf("?sandbox=1"), null, "the plain sandbox is a tester's own pretend plan");
  assert.equal(demoOf("?demo=family"), null, "without the sandbox the word is ignored: the real plan opens as always");
  assert.equal(demoOf(""), null); assert.equal(demoOf(undefined), null);
});

test("demoKey: one key per family, never the real plan's nor the sandbox's", () => {
  const keys = DEMO_IDS.map(demoKey);
  assert.deepEqual(keys, ["planner.plan.demo.family", "planner.plan.demo.couple", "planner.plan.demo.starter"]);
  for (const k of [...keys, demoKey("../x")]) { assert.notEqual(k, "planner.plan"); assert.notEqual(k, "planner.plan.sandbox"); assert.notEqual(k, "planner.plan.sync"); }
  assert.equal(demoKey("anything else"), "planner.plan.demo.family", "the keys are a closed set");
});

test("demoHref and leaveHref: in adds the two words and keeps the others; out drops exactly those two", () => {
  assert.equal(demoHref("couple", { pathname: "/financial-planner/", search: "" }), `/financial-planner/?sandbox=1&demo=couple${DEMO_START}`);
  assert.equal(demoHref("starter", { pathname: "/", search: "?view=build" }), "/?sandbox=1&demo=starter&view=build#/overview/dashboard");
  assert.equal(demoHref("family", { pathname: "/", search: "?sandbox=1&demo=couple" }), "/?sandbox=1&demo=family#/overview/dashboard", "switching families never doubles a word");
  assert.equal(demoHref("zzz", { pathname: "/" }), "/?sandbox=1&demo=family#/overview/dashboard");
  assert.equal(leaveHref({ pathname: "/financial-planner/", search: "?sandbox=1&demo=couple" }), "/financial-planner/");
  assert.equal(leaveHref({ pathname: "/", search: "?sandbox=1&demo=family&view=build" }), "/?view=build");
  assert.equal(leaveHref({}), "./");
  for (const id of DEMO_IDS) {   // in, then out: back where the person was, with no trace of the sandbox
    const q = new URL(demoHref(id, { pathname: "/app/", search: "?view=build" }), "http://h");
    assert.equal(demoOf(q.search), id);
    assert.equal(leaveHref({ pathname: q.pathname, search: q.search }), "/app/?view=build");
    assert.equal(demoOf(new URL(leaveHref({ pathname: q.pathname, search: q.search }), "http://h").search), null);
  }
});

test("the line under the top bar: one sentence per family, in plain words", () => {
  // (P2) the line says before the tap that Leave forgets what was changed
  assert.equal(demoLine("family"), "A pretend family. Nothing here touches your plan. Changes here are forgotten when you leave.");
  assert.equal(demoLine("couple"), "A pretend couple. Nothing here touches your plan. Changes here are forgotten when you leave.");
  assert.equal(demoLine("starter"), "A pretend person. Nothing here touches your plan. Changes here are forgotten when you leave.");
  assert.equal(demoLine("nobody"), demoLine("family"));
  // (F1) the family could not be fetched: the line never claims a family is on screen
  assert.equal(demoLine("family", { missing: true }), "A pretend family could not be opened. Check your connection and open it again. Your plan is not touched.");
  assert.equal(demoLine("starter", { missing: true }), "A pretend person could not be opened. Check your connection and open it again. Your plan is not touched.");
  assert.deepEqual(DEMOS.map((d) => d.chip), ["A family with children", "A couple near retirement", "Someone starting out"]);
});

test("bornOn: the birth date of someone who is that age today, before, on and after the birthday", () => {
  assert.equal(bornOn("2026-11-13", 36, 5, 20), "1990-05-20");     // birthday passed this year
  assert.equal(bornOn("2026-11-13", 38, 12, 2), "1987-12-02");     // still to come: one year earlier
  assert.equal(bornOn("2026-05-20", 36, 5, 20), "1990-05-20");     // today is the birthday
  assert.equal(bornOn("2026-05-19", 36, 5, 20), "1989-05-20");
  const age = (birth, today) => { const [by, bm, bd] = birth.split("-").map(Number), [y, m, d] = today.split("-").map(Number); return y - by - (m > bm || (m === bm && d >= bd) ? 0 : 1); };
  for (const today of ["2026-01-01", "2026-11-13", "2027-02-28", "2028-02-29", "2031-12-31"]) for (const [a, m, d] of [[6, 3, 3], [61, 7, 14], [24, 10, 9]]) assert.equal(age(bornOn(today, a, m, d), today), a, `${today} ${a}`);
});

test("monthsFrom: months ahead or ago, across a year end, on a day every month has", () => {
  assert.equal(monthsFrom("2026-11-13", 0), "2026-11-01");
  assert.equal(monthsFrom("2026-11-13", 2, 15), "2027-01-15");
  assert.equal(monthsFrom("2026-11-13", 12), "2027-11-01");
  assert.equal(monthsFrom("2026-01-31", -1), "2025-12-01");
  assert.equal(monthsFrom("2026-11-13", -53), "2022-06-01");
  assert.equal(monthsFrom("2026-01-31", 1, 31), "2026-02-28", "never a day a month lacks");
  assert.equal(localToday(new Date(2026, 10, 3)), "2026-11-03");
});

// ------------------------------------------------------------------ the three plans
const age = (birth, today) => { const [by, bm, bd] = birth.split("-").map(Number), [y, m, d] = today.split("-").map(Number); return y - by - (m > bm || (m === bm && d >= bd) ? 0 : 1); };
const AGES = { family: [36, 38, 9, 6], couple: [61, 63], starter: [24] };

for (const id of DEMO_IDS) {
  test(`${id}: a whole plan that migrate() leaves as it is, made for today`, () => {
    const p = demoPlan(id, T);
    assert.equal(p.schemaVersion, SCHEMA_VERSION);
    const m = migrate(structuredClone(p));
    assert.deepEqual(JSON.parse(JSON.stringify(m)), JSON.parse(JSON.stringify(p)), "nothing for migrate to mend or add");
    assert.ok(p.accounts.length >= 6 && p.income.length && p.expenses.length >= 10 && p.debts.length && p.goals.length >= 2);
    for (const a of p.accounts) { assert.equal(a.asOf, T, `${a.name} is dated today`); assert.equal(a.institution, "", "no bank is named"); }
    for (const g of p.goals) assert.ok(g.targetDate > T, `${g.name} is still ahead`);
    for (const d of p.debts) { assert.ok(p.accounts.some((a) => a.id === d.accountId)); if (d.startDate) assert.ok(d.startDate < T); }
    const ids = new Set(p.household.people.map((x) => x.id));
    for (const a of p.accounts) assert.ok(a.ownerId === "" || ids.has(a.ownerId), `${a.name}: the owner is a person of the plan`);
    for (const i of p.income) assert.ok(ids.has(i.personId));
    for (const c of p.retirement.contributions) assert.ok(ids.has(c.personId) && p.accounts.some((a) => a.id === c.accountId));
    assert.match(p.meta.name, /^A pretend /, "the plan's own name says it is pretend");
  });

  test(`${id}: the same people at the same ages whenever it is opened; only dates differ`, () => {
    for (const today of ["2026-11-13", "2027-03-02", "2029-07-14", "2032-02-29"]) {
      const p = demoPlan(id, today);
      assert.deepEqual(p.household.people.map((x) => age(x.birthDate, today)), AGES[id], today);
      for (const g of p.goals) assert.ok(g.targetDate > today, `${today} ${g.name}`);
      assert.deepEqual(p.accounts.map((a) => a.balance), demoPlan(id, T).accounts.map((a) => a.balance));
    }
    assert.notEqual(demoPlan(id, T), demoPlan(id, T), "a fresh object every time");
  });
}

test("an unknown family is the first one; the default date is this device's today", () => {
  assert.deepEqual(demoPlan("nobody", T).household, demoPlan("family", T).household);
  assert.equal(demoPlan("starter").accounts[0].asOf, localToday());
});

test("every page's compute runs on every pretend family (none throws)", async () => {
  const bad = [];
  let n = 0;
  for (const g of fs.readdirSync(path.join(ROOT, "modules"), { withFileTypes: true })) {
    if (!g.isDirectory() || g.name.startsWith("_")) continue;
    for (const m of fs.readdirSync(path.join(ROOT, "modules", g.name), { withFileTypes: true })) {
      const f = path.join(ROOT, "modules", g.name, m.name, "compute.js");
      if (!m.isDirectory() || !fs.existsSync(f)) continue;
      const { compute } = await import(pathToFileURL(f).href);
      for (const id of DEMO_IDS) { n++; try { compute(migrate(demoPlan(id, T)), { today: T }); } catch (e) { bad.push(`${g.name}/${m.name} on ${id}: ${e.message}`); } }
    }
  }
  assert.ok(n > 300, `${n} runs`);
  assert.deepEqual(bad, []);
});

test("core/demo/ holds nothing real: no email, address of a machine, long number, bank or brand; the site serves it", () => {
  const dir = path.join(ROOT, "core", "demo");
  const files = fs.readdirSync(dir);
  for (const f of ["names.js", "plans.js", "family.js", "couple.js", "starter.js", "bar.js", "README.md"]) assert.ok(files.includes(f), f);
  for (const f of files) {
    const s = fs.readFileSync(path.join(dir, f), "utf8");
    assert.doesNotMatch(s, /[\w.+-]+@[\w-]+\.[a-z]{2,}/i, `${f}: an email`);
    assert.doesNotMatch(s, /\d{9,}/, `${f}: a long run of digits`);
    assert.doesNotMatch(s, /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, `${f}: an IP address`);
    if (f.endsWith(".js")) assert.doesNotMatch(s, /\b(Chase|Ally|Fidelity|Vanguard|Schwab|Empower|Wells Fargo|Toyota|Visa)\b/, `${f}: a company's name`);
    // pure files stay pure (the store and the tests import them in Node); bar.js is the one that draws
    if (f.endsWith(".js") && f !== "bar.js") assert.doesNotMatch(s, /\b(document|window|localStorage|sessionStorage|fetch)\b/, `${f} is pure`);
  }
  // a push that changes any of them is checked like the rest of the app (tools/live-check.mjs, tools/main-gate.mjs),
  // and git picks them up (nothing in .gitignore hides core/demo/)
  for (const f of files) assert.ok(touchesApp([`core/demo/${f}`]) , f);
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8"), /demo/);
});

// ------------------------------------------------------------------ the store: nothing mixes
function storage() {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
}
const fetched = [];
globalThis.location = { search: "", protocol: "http:", origin: "http://pc.test", pathname: "/" };
globalThis.document = { querySelector: (sel) => (sel === 'script[type="importmap"]' ? {} : null) };   // the home computer served this page
globalThis.Event = class { constructor(type) { this.type = type; } };
globalThis.addEventListener = () => {};
globalThis.dispatchEvent = () => true;
let pcPlan = null;
globalThis.fetch = async (url, opt = {}) => {
  fetched.push(`${opt.method || "GET"} ${new URL(url).pathname}`);
  const u = new URL(url), res = (status, body) => ({ status, ok: status < 300, json: async () => structuredClone(body), text: async () => JSON.stringify(body) });
  if (u.pathname === "/api/health") return res(200, { ok: true });
  if (u.pathname === "/api/plan" && (opt.method || "GET") === "GET") return pcPlan ? res(200, pcPlan) : res(404, {});
  if (u.pathname === "/api/plan") { pcPlan = JSON.parse(opt.body); return res(200, { ok: true }); }
  throw new Error(`unexpected ${url}`);
};
let n = 0;
async function open(ls, search, { fails = false } = {}) {
  globalThis.localStorage = ls; globalThis.sessionStorage = storage(); globalThis.location.search = search;
  const { store, demoSeam } = await import(`../core/store.js?demo-test=${++n}`);
  if (fails) demoSeam.load = async () => { throw new TypeError("Failed to fetch dynamically imported module"); };   // a weak connection
  await store.load();
  return store;
}
const REAL = JSON.stringify({ ...migrate({ schemaVersion: SCHEMA_VERSION, notes: "the real plan" }), meta: { name: "Mine", currency: "USD", locale: "en-US", createdAt: "2026-11-01T08:00:00.000Z", updatedAt: "2026-11-01T08:00:00.000Z", rev: "real-1" } });
const REAL_SYNC = JSON.stringify({ base: "real-0", pending: true, mine: "real-1", since: 1 });
const TESTER = JSON.stringify({ schemaVersion: SCHEMA_VERSION, notes: "a tester's own pretend plan", meta: { updatedAt: "2026-11-02T08:00:00.000Z" } });
const snapshot = (ls, keys) => Object.fromEntries(keys.map((k) => [k, ls.getItem(k)]));
const MINE = ["planner.plan", "planner.plan.sync", "planner.plan.sandbox"];

for (const id of DEMO_IDS) {
  test(`${id}: enter, change, reload, leave -- the real plan, its waiting mark and the tester's pretend plan are byte-identical; the home computer is never asked`, async () => {
    const ls = storage();
    ls.setItem("planner.plan", REAL); ls.setItem("planner.plan.sync", REAL_SYNC); ls.setItem("planner.plan.sandbox", TESTER);
    const before = snapshot(ls, MINE);
    pcPlan = { schemaVersion: SCHEMA_VERSION, notes: "the computer's copy", meta: { updatedAt: "2026-11-01T07:00:00.000Z", rev: "real-0" } };
    const pcBefore = JSON.stringify(pcPlan);
    fetched.length = 0;

    const store = await open(ls, `?sandbox=1&demo=${id}`);
    assert.equal(store.demo(), id); assert.equal(store.sandbox(), true); assert.equal(store.backend(), "local");
    const want = demoPlan(id);
    assert.deepEqual(store.get().household, want.household, "the pretend family is on screen");
    assert.deepEqual(store.get().accounts, want.accounts);
    assert.notEqual(store.get().notes, "the real plan");
    assert.deepEqual(JSON.parse(ls.getItem(demoKey(id))).accounts, want.accounts, "kept under the family's own key");
    assert.deepEqual(snapshot(ls, MINE), before, "opening wrote nothing of the person's");

    store.update((d) => { d.accounts[0].balance = 123456; d.notes = "changed in the pretend family"; });
    await store.save(); await store.flush(); await store.idle();
    assert.equal(JSON.parse(ls.getItem(demoKey(id))).accounts[0].balance, 123456, "the change is kept, in the pretend copy");
    assert.deepEqual(snapshot(ls, MINE), before, "a save in the pretend family wrote nothing of the person's");
    assert.deepEqual(store.syncState(), { pending: false, failed: false, localFull: false, late: false, conflict: null }, "nothing waits for the computer");
    assert.equal(await store.resync(), false);

    const again = await open(ls, `?sandbox=1&demo=${id}`);   // a reload keeps the change
    assert.equal(again.get().accounts[0].balance, 123456);
    assert.equal(again.get().notes, "changed in the pretend family");

    again.eraseDevice();                                     // "Leave" (core/demo/bar.js)
    assert.equal(ls.getItem(demoKey(id)), null, "leaving erases the pretend copy");
    assert.deepEqual(snapshot(ls, MINE), before, "and nothing else");
    assert.deepEqual([...ls.m.keys()].sort(), [...MINE].sort(), "no other key was left behind");
    assert.deepEqual(fetched, [], "no request to the home computer, at any point");
    assert.equal(JSON.stringify(pcPlan), pcBefore);

    const real = await open(ls, "");                        // back in the real plan: it is the one that was there
    assert.equal(real.demo(), null);
    assert.equal(real.get().notes, "the real plan");
    assert.equal(real.get().meta.rev, "real-1");
  });
}

test("a phone with no plan yet (the static site): a visit leaves no plan behind, and the next open is still a first open", async () => {
  const ls = storage();
  fetched.length = 0;
  const store = await open(ls, "?sandbox=1&demo=couple");
  store.update((d) => { d.goals = []; });
  assert.deepEqual([...ls.m.keys()].sort(), ["planner.plan.demo.couple", "planner.plan.demo.couple.made"]);
  assert.equal(ls.getItem("planner.plan"), null); assert.equal(ls.getItem("planner.plan.sync"), null);
  store.eraseDevice();
  assert.deepEqual([...ls.m.keys()], []);
  assert.deepEqual(fetched, []);
});

test("one family's changes never reach another family", async () => {
  const ls = storage();
  const a = await open(ls, "?sandbox=1&demo=family");
  a.update((d) => { d.notes = "family only"; });
  const b = await open(ls, "?sandbox=1&demo=starter");
  assert.equal(b.get().household.people[0].name, "Jordan");
  assert.notEqual(b.get().notes, "family only");
  assert.equal(JSON.parse(ls.getItem("planner.plan.demo.family")).notes, "family only");
});

test("invariance: without `demo` in the address the store does what it did -- the sandbox key, an empty pretend plan, no family", async () => {
  const ls = storage();
  ls.setItem("planner.plan", REAL);
  const s = await open(ls, "?sandbox=1");
  assert.equal(s.demo(), null); assert.equal(s.sandbox(), true);
  assert.deepEqual(s.get().accounts, [], "an empty sandbox stays empty: no family is poured into a tester's plan");
  assert.deepEqual(JSON.parse(ls.getItem("planner.plan.sandbox")).household.people, [], "what it keeps is that empty plan, under the sandbox key, as before");
  s.update((d) => { d.notes = "pretend"; });
  assert.equal(JSON.parse(ls.getItem("planner.plan.sandbox")).notes, "pretend");
  assert.equal(ls.getItem("planner.plan"), REAL);
  assert.deepEqual([...ls.m.keys()].filter((k) => k.includes("demo")), []);

  // `demo` without the sandbox is not a pretend family: the real plan, saved under the real key, as always
  pcPlan = null; fetched.length = 0;
  const ls2 = storage(); ls2.setItem("planner.plan", REAL);
  const r = await open(ls2, "?demo=family");
  assert.equal(r.demo(), null); assert.equal(r.sandbox(), false);
  assert.equal(r.get().notes, "the real plan");
  assert.deepEqual([...ls2.m.keys()].filter((k) => k.includes("demo")), []);
});

test("a tester's sandbox plan is never replaced by a family, and a family already open is not started over", async () => {
  const ls = storage();
  ls.setItem("planner.plan.sandbox", TESTER);
  const s = await open(ls, "?sandbox=1&demo=family");
  assert.equal(s.get().household.people[0].name, "Ana");
  assert.equal(ls.getItem("planner.plan.sandbox"), TESTER);
  const rev = s.get().meta.rev;
  const t = await open(ls, "?sandbox=1&demo=family");
  assert.equal(t.get().meta.rev, rev, "the copy this browser holds is the one shown");
});

// ------------------------------------------------------------------ the line under the top bar
function fakeDoc() {
  const byId = new Map();
  const make = (tag) => {
    const el = { tag, children: [], attrs: {}, listeners: {}, className: "", textContent: "",
      setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(t, fn) { this.listeners[t] = fn; },
      append(...c) { this.children.push(...c); }, before(x) { this.prev = x; if (x.id) byId.set(x.id, x); } };
    return el;
  };
  const content = make("main"); content.id = "content"; byId.set("content", content);
  return { byId, content, createElement: make, getElementById: (id) => byId.get(id) ?? null };
}

test("the line shows only for a pretend family; Leave erases the pretend copy and opens the app without the sandbox", () => {
  const calls = [];
  const fake = (id) => ({ demo: () => id, eraseDevice: () => calls.push("erase") });
  assert.equal(showDemoBar(fake(null), { doc: fakeDoc(), loc: {} }), null, "the real plan, or a tester's sandbox: no line");
  assert.equal(showDemoBar({}, { doc: fakeDoc(), loc: {} }), null);
  const doc = fakeDoc();
  const tab = storage();
  const bar = showDemoBar(fake("couple"), { doc, loc: { pathname: "/financial-planner/", search: "?sandbox=1&demo=couple" }, go: (href) => calls.push(href), tab: () => tab });
  assert.equal(doc.content.prev, bar, "above the page, under the top bar");
  assert.equal(bar.id, "demo-bar");
  const [, inner] = bar.children, [say, leave] = inner.children;
  assert.equal(say.textContent, demoLine("couple"));
  assert.equal(bar.attrs.role, "note"); assert.equal(bar.className, "");
  assert.equal(leave.textContent, "Leave ›"); assert.equal(leave.type, "button");
  assert.match(leave.className, /\bsecondary\b/, "never the screen's filled button");
  assert.equal(showDemoBar(fake("couple"), { doc, loc: {} }), null, "drawn once");
  assert.equal(tab.getItem(LEFT_KEY), null, "no note before the tap");
  leave.listeners.click();
  assert.deepEqual(calls, ["erase", "/financial-planner/"]);
  // (P4) Leave notes it for the next page, which reads it once
  assert.equal(tab.getItem(LEFT_KEY), "couple");
  assert.equal(takeLeft(() => tab), true); assert.equal(tab.getItem(LEFT_KEY), null); assert.equal(takeLeft(() => tab), false, "said once");
  assert.equal(takeLeft(() => { throw new Error("blocked"); }), false);
  // a tab that keeps nothing: the way out still works
  const doc2 = fakeDoc(), out = [];
  const bar2 = showDemoBar(fake("family"), { doc: doc2, loc: { pathname: "/", search: "?sandbox=1&demo=family" }, go: (h) => out.push(h), tab: () => { throw new Error("blocked"); } });
  bar2.children[1].children[1].listeners.click();
  assert.deepEqual(out, ["/"]);
});

test("after Leave: one green sentence per case", () => {
  assert.equal(leftWords(true), "Pretend family closed. This is your own plan.");
  assert.equal(leftWords(false), "Pretend family closed. Your own plan starts here.");
});

test("the family could not be fetched: the line says so, as an alert, still with Leave", () => {
  const doc = fakeDoc();
  const tab = storage(), out = [];
  const bar = showDemoBar({ demo: () => "family", demoMissing: () => true, eraseDevice() {} }, { doc, loc: { pathname: "/", search: "?sandbox=1&demo=family" }, go: (h) => out.push(h), tab: () => tab });
  const [say, leave] = bar.children[1].children;
  assert.equal(say.textContent, demoLine("family", { missing: true }));
  assert.doesNotMatch(say.textContent, /^A pretend family\./, "it never says a family is on screen");
  assert.equal(bar.attrs.role, "alert"); assert.equal(bar.className, "missing");
  assert.equal(leave.textContent, "Leave ›");
  leave.listeners.click();
  assert.deepEqual(out, ["/"]); assert.equal(tab.getItem(LEFT_KEY), null, "nothing was opened, so the next page does not say one was closed");
});

// ------------------------------------------------------------------ critic findings F1, F2 (the store)
const demoKeys = (ls) => [...ls.m.keys()].filter((k) => k.includes(".demo.")).sort();

test("F1: a family that cannot be fetched writes nothing, says so, and the next open has the family", async () => {
  const ls = storage();
  ls.setItem("planner.plan", REAL); ls.setItem("planner.plan.sync", REAL_SYNC); ls.setItem("planner.plan.sandbox", TESTER);
  const before = snapshot(ls, MINE);
  const s = await open(ls, "?sandbox=1&demo=family", { fails: true });
  assert.equal(s.demo(), "family"); assert.equal(s.demoMissing(), true);
  assert.deepEqual(s.get().accounts, [], "an empty plan is on screen, in memory");
  assert.deepEqual(demoKeys(ls), [], "opening wrote nothing under the family's key");
  s.update((d) => { d.notes = "typed into the empty page"; });
  await s.save(); await s.flush(); await s.idle();
  assert.equal(s.get().notes, "typed into the empty page", "the visit still works");
  assert.deepEqual(demoKeys(ls), [], "an edit wrote nothing either: the empty plan is not locked in");
  assert.deepEqual(snapshot(ls, MINE), before);
  const again = await open(ls, "?sandbox=1&demo=family");   // the connection is back
  assert.equal(again.demoMissing(), false);
  assert.equal(again.get().household.people[0].name, "Ana", "the family, not the empty plan");
  assert.deepEqual(demoKeys(ls), ["planner.plan.demo.family", "planner.plan.demo.family.made"]);
  assert.equal((await open(ls, "?sandbox=1")).demoMissing(), false, "never set outside a pretend family");
});

test("demoOld: made today is kept; an untouched copy from an earlier day is made again; a changed one after 30 days", () => {
  const made = { day: "2026-11-13", rev: "r1" };
  assert.equal(DEMO_KEEP_DAYS, 30);
  assert.equal(demoOld({ made, rev: "r1", today: "2026-11-13" }), false);
  assert.equal(demoOld({ made, rev: "r1", today: "2026-11-14" }), true, "untouched, a day later");
  assert.equal(demoOld({ made, rev: "r2", today: "2026-11-14" }), false, "changed: kept");
  assert.equal(demoOld({ made, rev: "r2", today: "2026-12-13" }), false, "changed, 30 days: kept");
  assert.equal(demoOld({ made, rev: "r2", today: "2026-12-14" }), true, "changed, 31 days: started over");
  assert.equal(demoOld({ made, rev: "r2", today: "2027-02-01" }), true);
  assert.equal(demoOld({ made, rev: "r1", today: "2026-11-01" }), false, "a clock set back");
  assert.equal(demoOld({ made: null, rev: "r1", today: "2027-01-01" }), false, "no mark: kept");
  assert.equal(demoOld({ made: { rev: "r1" }, rev: "r1", today: "2027-01-01" }), false);
});

test("F2: a copy left open is made again for today -- untouched the next day, changed after 30 days; never when the fetch fails", async () => {
  const at = (iso) => mock.timers.setTime(new Date(`${iso}T12:00:00`).getTime());
  mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-13T12:00:00").getTime() });
  try {
    const ls = storage();
    const first = await open(ls, "?sandbox=1&demo=family");
    assert.equal(first.get().accounts[0].asOf, "2026-11-13");
    assert.deepEqual(JSON.parse(ls.getItem("planner.plan.demo.family.made")), { day: "2026-11-13", rev: first.get().meta.rev });
    const goal = first.get().goals[0].targetDate;

    at("2026-11-13");                                           // the same day: the copy held is the one shown
    assert.equal((await open(ls, "?sandbox=1&demo=family")).get().meta.rev, first.get().meta.rev);

    at("2027-03-20");                                           // months later, never changed: made again
    const later = await open(ls, "?sandbox=1&demo=family");
    assert.equal(later.get().accounts[0].asOf, "2027-03-20");
    assert.ok(later.get().goals.every((g) => g.targetDate > "2027-03-20"), "no goal is in the past");
    assert.notEqual(later.get().goals[0].targetDate, goal);
    assert.equal(JSON.parse(ls.getItem("planner.plan.demo.family.made")).day, "2027-03-20");
    assert.deepEqual(later.get().household.people.map((p) => age(p.birthDate, "2027-03-20")), AGES.family, "and the same ages");

    later.update((d) => { d.notes = "changed"; });              // changed: kept for 30 days
    at("2027-04-19");
    const kept = await open(ls, "?sandbox=1&demo=family");
    assert.equal(kept.get().notes, "changed"); assert.equal(kept.get().accounts[0].asOf, "2027-03-20");
    at("2027-04-20");                                           // 31 days, and the fetch fails: the copy held is shown, nothing is lost
    const off = await open(ls, "?sandbox=1&demo=family", { fails: true });
    assert.equal(off.get().notes, "changed"); assert.equal(off.demoMissing(), false);
    const over = await open(ls, "?sandbox=1&demo=family");     // 31 days: started over
    assert.equal(over.get().notes, ""); assert.equal(over.get().accounts[0].asOf, "2027-04-20");

    over.eraseDevice();
    assert.deepEqual(demoKeys(ls), [], "Leave takes the mark with the copy");
  } finally { mock.timers.reset(); }
});

// ------------------------------------------------------------------ critic finding F4 (the invented loans agree with themselves)
test("F4: every pretend loan with a term has as many months left on the term as its balance, rate and payment take", () => {
  let seen = 0;
  for (const id of DEMO_IDS) for (const today of ["2026-11-13", "2027-01-31", "2028-02-29"]) {
    const p = demoPlan(id, today);
    for (const d of p.debts) {
      const bal = p.accounts.find((a) => a.id === d.accountId).balance, r = d.rate / 12;
      assert.ok(bal * r < d.minPayment, `${id} ${d.id}: the payment covers the interest`);
      if (d.termMonths == null) continue;
      const byMath = -Math.log(1 - bal * r / d.minPayment) / Math.log(1 + r);
      const [sy, sm] = d.startDate.split("-").map(Number), [y, m] = today.split("-").map(Number);
      const byTerm = d.termMonths - ((y * 12 + m) - (sy * 12 + sm));
      assert.ok(Math.abs(byMath - byTerm) <= 1, `${id} ${d.id} on ${today}: ${byMath.toFixed(1)} months by the balance, ${byTerm} by the term`);
      seen++;
    }
  }
  assert.equal(seen, 9, "the family's mortgage and car loan, the couple's mortgage, on three days");
});

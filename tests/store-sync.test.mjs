// tests/store-sync.test.mjs -- core/store.js never loses a change and never overwrites one silently. A fake PC (the same
// X-Planner-Base rule as server/server.mjs, a version named by meta.rev or meta.updatedAt) and fake browser storage; each scenario loads a fresh copy of the store.
// The scenarios are the ones an adversarial review walked through (2026-11-01): offline saves and reopening, an edit
// made while a send is on its way, a hung connection, full storage, two tabs, a lost answer, clocks that disagree,
// two devices, sandbox mode.
import { test } from "node:test";
import assert from "node:assert/strict";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const at = (min) => new Date(Date.UTC(2026, 10, 1, 8, min)).toISOString();
const P = (notes, min) => ({ schemaVersion: 1, notes, meta: { updatedAt: at(min) } });

// ---- the fake browser and PC
function storage(quota = Infinity) {
  const m = new Map();
  return { m, quota, getItem: (k) => m.has(k) ? m.get(k) : null, setItem(k, v) { let t = 0; for (const [kk, vv] of m) if (kk !== k) t += vv.length; if (t + String(v).length > this.quota) throw new Error("QuotaExceededError"); m.set(k, String(v)); }, removeItem: (k) => m.delete(k) };
}
const pc = { plan: null, up: true, hang: false, delay: 0, getDelay: 0, loseAnswer: false, calls: [] };
const listeners = [];
globalThis.location = { search: "", protocol: "http:", origin: "http://pc.test" };
globalThis.Event = class { constructor(type) { this.type = type; } };
globalThis.addEventListener = (type, fn) => listeners.push({ type, fn });
let events = 0;                                           // planner:sync events (the shell redraws the pill and the bar on each)
globalThis.dispatchEvent = (e) => { if (e?.type === "planner:sync") events++; return true; };
globalThis.fetch = async (url, opt = {}) => {
  if (!pc.up) throw new TypeError("network down");
  const u = new URL(url), m = opt.method || "GET";
  const res = (status, body) => ({ status, ok: status < 300, json: async () => structuredClone(body), text: async () => JSON.stringify(body) });
  if (u.pathname === "/api/health") return res(200, { ok: true });
  if (u.pathname === "/api/plan" && m === "GET") {   // the PC reads its file, then the answer travels
    const snap = pc.plan ? structuredClone(pc.plan) : null;
    if (pc.getDelay) await sleep(pc.getDelay);
    pc.calls.push("GET"); return snap ? res(200, snap) : res(404, {});
  }
  if (u.pathname === "/api/plan" && m === "PUT") {
    if (pc.hang) return new Promise((_, rej) => opt.signal?.addEventListener?.("abort", () => rej(new Error("aborted"))));
    if (pc.delay) await sleep(pc.delay);
    if (!pc.up) throw new TypeError("network down");
    const plan = JSON.parse(opt.body), base = opt.headers?.["X-Planner-Base"];
    const curAt = pc.plan?.meta?.rev || pc.plan?.meta?.updatedAt || "";
    pc.calls.push(`PUT ${plan.notes}`);
    if (typeof base === "string" && base && pc.plan && curAt && curAt !== base && curAt !== (plan.meta?.rev || plan.meta?.updatedAt)) return res(409, { plan: pc.plan });
    pc.plan = plan;
    if (pc.loseAnswer) { pc.loseAnswer = false; throw new TypeError("answer lost"); }
    return res(200, { ok: true });
  }
  throw new Error(`unexpected ${m} ${url}`);
};
let n = 0;
/** A device (or tab): its own copy of the store module, on the given storage. */
async function device(ls, { sandbox = false, tab = storage() } = {}) {
  globalThis.localStorage = ls; globalThis.sessionStorage = tab;
  globalThis.location.search = sandbox ? "?sandbox=1" : "";
  const { store } = await import(`../core/store.js?device=${++n}`);
  const use = () => { globalThis.localStorage = ls; globalThis.sessionStorage = tab; globalThis.location.search = sandbox ? "?sandbox=1" : ""; };
  return { store, ls, use, edit: (notes) => { use(); store.update((d) => { d.notes = notes; }); }, save: () => { use(); return store.save(); } };
}
const kept = (ls) => JSON.parse(ls.getItem("planner.plan") ?? "null")?.notes;
const record = (ls) => JSON.parse(ls.getItem("planner.plan.sync") ?? "{}");
/** The app is closed now and opened again later: the waiting change has been waiting a while. */
const later = (ls, ms = 60000) => { const r = record(ls); if (r.since) { r.since -= ms; ls.setItem("planner.plan.sync", JSON.stringify(r)); } };
const reset = (plan = P("X", 0)) => { pc.plan = plan; pc.up = true; pc.hang = false; pc.delay = 0; pc.getDelay = 0; pc.loseAnswer = false; pc.calls = []; };

test("a change saved while the PC is out of reach is kept, and reaches the PC on the next open (not replaced by the PC's older copy)", async () => {
  reset();
  const ls = storage();
  let a = await device(ls); await a.store.load();
  pc.up = false;
  a.edit("A1"); await a.save();
  assert.equal(kept(ls), "A1"); assert.equal(pc.plan.notes, "X");
  assert.equal(a.store.syncState().pending, true); assert.equal(a.store.syncState().late, true, "the pill says Phone only");
  pc.up = true; later(ls);
  a = await device(ls); await a.store.load();          // the app is opened again later
  assert.equal(a.store.get().notes, "A1", "the first screen shows the waiting change");
  await a.store.idle();                                 // sent after the first screen, not before it
  assert.equal(pc.plan.notes, "A1");
  assert.equal(a.store.syncState().pending, false);
  assert.equal(a.store.takeSent(), true, "the shell says the waiting change reached the PC");
});

test("the PC comes back while the page is open: the waiting change goes to it by itself", async () => {
  reset();
  const a = await device(storage()); await a.store.load();
  pc.up = false; a.edit("A1"); await a.save();
  pc.up = true; a.use(); await a.store.resync();
  assert.equal(pc.plan.notes, "A1"); assert.equal(a.store.syncState().pending, false);
});

test("an edit made while a waiting change is on its way to the PC is not wiped out", async () => {
  reset();
  const a = await device(storage()); await a.store.load();
  pc.up = false; a.edit("A1"); await a.save();
  pc.up = true; pc.delay = 60;
  a.use(); const r = a.store.resync();
  await sleep(15); a.edit("A2");                        // tapped while A1 is being sent
  await r; await a.save();
  assert.equal(a.store.get().notes, "A2"); assert.equal(pc.plan.notes, "A2"); assert.equal(kept(a.ls), "A2");
  assert.equal(a.store.syncState().pending, false);
});

test("an edit still waiting for its save when the PC comes back is not replaced by the PC's copy", async () => {
  reset();
  const ls = storage();
  await (await device(ls)).store.load();                // in sync with the PC once
  const a = await device(ls);
  pc.up = false; await a.store.load();                  // opened again while the PC is off: local mode
  pc.up = true; a.edit("A1");                            // the save is 400 ms away
  a.use(); await a.store.resync();
  await sleep(450);
  assert.equal(a.store.get().notes, "A1"); assert.equal(pc.plan.notes, "A1");
});

test("a hung connection: every edit is still kept on the device and marked waiting", async () => {
  reset();
  const ls = storage();
  const a = await device(ls); await a.store.load();
  pc.hang = true;
  a.edit("A1"); a.save();                                // its send hangs
  a.edit("A2"); a.save();
  a.edit("A3"); a.save();
  assert.equal(kept(ls), "A3", "the latest edit is on the device at once");
  assert.equal(JSON.parse(ls.getItem("planner.plan.sync")).pending, true);
  assert.equal(JSON.parse(ls.getItem("planner.plan.sync")).mine, a.store.get().meta.rev, "and it is marked as the waiting change");
  pc.hang = false;
  const b = await device(ls); await b.store.load(); await b.store.idle();   // reopened (the hung tab is gone)
  assert.equal(b.store.get().notes, "A3"); assert.equal(pc.plan.notes, "A3");
});

test("storage too full for the plan: a reopen never sends an older copy over the PC", async () => {
  reset(P("X", 0));
  const ls = storage();
  const a = await device(ls); await a.store.load();
  a.edit("W"); await a.save();                           // fits: stored and on the PC
  a.edit("P2"); await a.save();
  assert.equal(pc.plan.notes, "P2");
  ls.quota = ls.getItem("planner.plan").length + ls.getItem("planner.plan.sync").length + 160;   // the waiting mark fits; a bigger plan does not
  pc.up = false;
  a.edit(`A1 with a much longer note that no longer fits in the storage at all ${"x".repeat(400)}`); await a.save();
  assert.equal(a.store.syncState().localFull, true);
  pc.up = true;
  const b = await device(ls); await b.store.load(); await b.store.idle();
  assert.equal(pc.plan.notes, "P2", "the PC keeps its copy: the stored one is not the waiting change");
  assert.equal(b.store.takeLost(), true, "and the owner is told once that the waiting change could not be found");
  assert.equal(b.store.syncState().pending, false);
});

test("a second tab: a clean tab takes the other tab's change; it never wipes a change waiting on this device", async () => {
  reset();
  const ls = storage();
  const a = await device(ls), b = await device(ls);
  a.use(); await a.store.load(); b.use(); await b.store.load();
  pc.up = false;
  a.edit("A1"); await a.save();                          // tab A, offline: waiting on the device
  // tab B comes back into view (its storage event may have been missed while frozen)
  pc.up = true; b.use(); await b.store.resync();
  assert.equal(b.store.get().notes, "A1", "tab B shows tab A's change");
  assert.equal(pc.plan.notes, "A1", "and sends it");
  b.edit("B1"); await b.save();
  assert.equal(pc.plan.notes, "B1");
});

test("a lost answer: the PC took the save but the reply never came; the next save is not a false conflict", async () => {
  reset();
  const a = await device(storage()); await a.store.load();
  pc.loseAnswer = true;
  a.edit("A1"); await a.save();
  assert.equal(pc.plan.notes, "A1");
  a.edit("A2"); await a.save();
  assert.equal(a.store.syncState().conflict, null);
  assert.equal(pc.plan.notes, "A2");
});

test("two devices both change the plan: nothing is overwritten, the choice is asked, either answer works", async () => {
  reset();
  const pcBox = await device(storage()), phone = await device(storage());
  pcBox.use(); await pcBox.store.load(); phone.use(); await phone.store.load();
  pcBox.edit("on the PC"); await pcBox.save();
  phone.edit("on the phone"); await phone.save();
  assert.equal(pc.plan.notes, "on the PC", "the phone's save did not overwrite");
  const c = phone.store.syncState().conflict;
  assert.ok(c); assert.equal(c.from, "pc");
  assert.equal(phone.store.get().notes, "on the phone", "the phone keeps showing its own version");
  phone.edit("on the phone, more"); await phone.save();
  assert.equal(pc.plan.notes, "on the PC", "while the choice waits, saves stay on the device");
  phone.use(); phone.store.resolve("mine"); await phone.save();
  assert.equal(pc.plan.notes, "on the phone, more");
  // and the other answer
  pcBox.use(); await pcBox.store.resync();
  assert.equal(pcBox.store.get().notes, "on the phone, more", "the PC tab takes the newer copy when it comes back");
  pcBox.edit("PC again"); await pcBox.save();
  phone.edit("phone again"); await phone.save();
  assert.ok(phone.store.syncState().conflict);
  phone.use(); phone.store.resolve("theirs");
  assert.equal(phone.store.get().notes, "PC again"); assert.equal(phone.store.syncState().pending, false);
  phone.edit("phone after"); await phone.save();
  assert.equal(pc.plan.notes, "phone after");
});

test("clocks that disagree do not decide anything: a device with a slow clock still saves and takes newer copies", async () => {
  reset({ schemaVersion: 1, notes: "X", meta: { updatedAt: "2026-11-01T10:03:00.000Z" } });   // the PC's clock is ahead
  const a = await device(storage()); await a.store.load();
  a.edit("A1"); await a.save();                          // stamped by this device's clock (earlier than 10:03)
  assert.equal(pc.plan.notes, "A1");
  a.use(); await a.store.resync();
  assert.equal(a.store.get().notes, "A1"); assert.equal(a.store.syncState().conflict, null);
  pc.plan = { schemaVersion: 1, notes: "from another device", meta: { updatedAt: "2026-11-01T07:00:00.000Z" } };   // older clock, newer save
  a.use(); await a.store.resync();
  assert.equal(a.store.get().notes, "from another device", "a different copy is someone else's save, whatever its clock");
});

test("a device that first opened while the PC was off never sends without a base", async () => {
  reset();
  const a = await device(storage());
  pc.up = false; await a.store.load();
  pc.up = true; a.use(); await a.store.resync();       // takes the PC's copy
  pc.plan = P("another device", 30);
  a.edit("A1"); await a.save();
  assert.equal(pc.plan.notes, "another device", "refused, not overwritten");
  assert.ok(a.store.syncState().conflict);
});

test("sandbox: never talks to the PC", async () => {
  reset();
  const s = await device(storage(), { sandbox: true }); await s.store.load();
  s.edit("pretend"); await s.save();
  s.use(); await s.store.resync();
  assert.deepEqual(pc.calls, []);
  assert.equal(JSON.parse(s.ls.getItem("planner.plan.sandbox")).notes, "pretend");
  assert.equal(s.store.syncState().pending, false);
});

// ---- second review (2026-11-01): ten honesty and nine integrity findings, each reproduced by a reviewer's script

test("closing the app a moment after a save loses nothing: the change is on the device and marked waiting at once", async () => {
  reset();
  const ls = storage();
  const a = await device(ls); await a.store.load();
  a.edit("A1");                                          // no save yet: the 400 ms timer is still running
  assert.equal(kept(ls), "A1"); assert.equal(record(ls).pending, true);
  const b = await device(ls); await b.store.load(); await b.store.idle();   // the app was swiped away and opened again
  assert.equal(b.store.get().notes, "A1"); assert.equal(pc.plan.notes, "A1");
});

test("a lost answer followed by a send that never got there is still this device's own copy, not someone else's", async () => {
  reset();
  const ls = storage();
  const a = await device(ls); await a.store.load();
  pc.loseAnswer = true; a.edit("A1"); await a.save();   // the PC has A1; the device never heard back
  pc.up = false; a.edit("A2"); await a.save();           // and this one never reached the PC
  pc.up = true; a.use(); await a.store.resync();
  assert.equal(a.store.syncState().conflict, null, "no false 'changed on another device'");
  assert.equal(pc.plan.notes, "A2");
  // the same after a reopen
  reset(); const ls2 = storage();
  const c = await device(ls2); await c.store.load();
  pc.loseAnswer = true; c.edit("C1"); await c.save();
  pc.up = false; c.edit("C2"); await c.save();
  pc.up = true;
  const d = await device(ls2); await d.store.load(); await d.store.idle();
  assert.equal(d.store.syncState().conflict, null); assert.equal(pc.plan.notes, "C2");
});

test("the pill: a change waiting in another tab, or from an earlier session, reads Phone only once it has waited", async () => {
  reset();
  const ls = storage();
  const a = await device(ls), b = await device(ls);
  a.use(); await a.store.load(); b.use(); await b.store.load();
  pc.up = false; a.edit("A1"); await a.save();
  later(ls, 5000);
  b.use(); b.store.update((d) => { d.notes = d.notes; });   // tab B reads the shared record (as on its storage event)
  assert.equal(b.store.syncState().late, true, "tab B does not say Saved on PC");
  // a change from yesterday, the app opened away from home and then back home: amber until the PC has it
  reset(); const ls2 = storage();
  const c = await device(ls2); await c.store.load();
  pc.up = false; c.edit("C1"); await c.save(); later(ls2, 86400000);
  const d = await device(ls2); await d.store.load();
  pc.hang = true; pc.up = true; d.use(); const r = d.store.resync();
  await sleep(20);
  assert.equal(d.store.syncState().late, true, "still Phone only while the send is on its way");
  pc.hang = false; void r;
});

test("a fresh PC that cannot take the plan: the device keeps it waiting and tries again", async () => {
  reset();
  const ls = storage();
  const a = await device(ls); await a.store.load();
  pc.plan = null;                                        // the PC's plan file is gone
  const real = globalThis.fetch;
  globalThis.fetch = async (url, opt = {}) => (opt.method === "PUT" ? (() => { throw new TypeError("file locked"); })() : real(url, opt));
  try { a.use(); await a.store.resync(); } finally { globalThis.fetch = real; }
  assert.equal(a.store.syncState().pending, true, "not Saved on PC");
  a.use(); await a.store.resync();
  assert.equal(pc.plan?.notes, "X");
});

test("after 'Use the PC's version', a plain save does not announce that changes reached the PC", async () => {
  reset();
  const ls = storage();
  const a = await device(ls); await a.store.load();
  pc.up = false; a.edit("A1"); await a.save();           // failed
  pc.up = true; pc.plan = P("elsewhere", 20);
  a.use(); await a.store.resync();
  assert.ok(a.store.syncState().conflict);
  a.use(); a.store.resolve("theirs"); a.store.takeSent();
  a.edit("A2"); await a.save();
  assert.equal(pc.plan.notes, "A2"); assert.equal(a.store.takeSent(), false);
});

test("a change the pill showed as Phone only gets its 'now saved on the PC' note even when the app is reopened soon after", async () => {
  reset();
  const ls = storage();
  const a = await device(ls); await a.store.load();
  pc.up = false; a.edit("A1"); await a.save(); pc.up = true;   // the pill said Phone only
  const b = await device(ls); await b.store.load(); await b.store.idle();
  assert.equal(pc.plan.notes, "A1"); assert.equal(b.store.takeSent(), true);
  assert.equal(record(ls).missed, undefined, "cleared once the PC has it");
});

test("reopened after the PC already got the change: no second send, no 'now saved' note", async () => {
  reset();
  const ls = storage();
  const a = await device(ls); await a.store.load();
  pc.loseAnswer = true; a.edit("F1"); await a.save();    // reached the PC; the page went away before the answer
  pc.calls = [];
  const b = await device(ls); await b.store.load(); await b.store.idle();
  assert.deepEqual(pc.calls.filter((c) => c.startsWith("PUT")), [], "nothing sent again");
  assert.equal(b.store.syncState().pending, false); assert.equal(b.store.takeSent(), false);
});

test("the first screen does not wait for a slow save of a waiting change", async () => {
  reset();
  const ls = storage();
  const a = await device(ls); await a.store.load();
  pc.up = false; a.edit("A1"); await a.save(); pc.up = true;
  pc.delay = 3000;
  const t = Date.now();
  const b = await device(ls); await b.store.load();
  assert.ok(Date.now() - t < 1000, `opened in ${Date.now() - t} ms`);
  assert.equal(b.store.get().notes, "A1");
  pc.delay = 0; await b.store.idle();
});

test("a reconnect that finds two versions shows the choice at once", async () => {
  reset();
  const ls = storage();
  pc.up = false;
  const a = await device(ls); await a.store.load();
  a.edit("A1"); await a.save();
  pc.up = true; pc.plan = P("on the PC", 30);
  const before = events;
  a.use(); await a.store.reconnect();
  assert.ok(a.store.syncState().conflict, "the choice is set");
  assert.ok(events > before, "and the shell is told, so the bar appears");
});

test("a reconnect never wipes an edit made while it waits for the PC", async () => {
  reset();
  const ls = storage();
  const a = await device(ls); await a.store.load();
  pc.delay = 200;
  a.use(); const r = a.store.reconnect();
  a.edit("typed meanwhile");
  await r; await a.store.idle(); pc.delay = 0;
  assert.equal(a.store.get().notes, "typed meanwhile"); assert.equal(kept(ls), "typed meanwhile");
  a.use(); await a.store.resync();
  assert.equal(pc.plan.notes, "typed meanwhile");
});

test("a second tab opening while the first saves does not write the PC's older copy over that save", async () => {
  reset();
  const ls = storage();
  const a = await device(ls); a.use(); await a.store.load();
  pc.getDelay = 100;
  const b = await device(ls); b.use(); const opening = b.store.load();   // tab B waits for the PC
  await sleep(20);
  pc.up = false; a.edit("A1"); a.use(); await a.save();     // tab A saves meanwhile; its send fails
  pc.up = true;
  await opening; pc.getDelay = 0;
  assert.equal(kept(ls), "A1", "the stored copy is still tab A's change");
  assert.equal(b.store.get().notes, "A1"); assert.equal(record(ls).pending, true);
});

test("tabs: while this tab's choice is open, its version stays out of the shared copy and the other tab never sends it", async () => {
  reset(P("X", 0));
  const ls = storage();
  const a = await device(ls), b = await device(ls);
  a.use(); await a.store.load(); b.use(); await b.store.load();
  ls.quota = ls.getItem("planner.plan").length + ls.getItem("planner.plan.sync").length + 160;
  pc.up = false;
  a.edit(`A1 is a long note that does not fit in this browser's storage any more ${"x".repeat(400)}`); a.use(); await a.save();   // tab A cannot store its version
  b.edit("B1"); b.use(); await b.save(); pc.up = true;                                                      // tab B stores B1
  a.use(); await a.store.resync();
  assert.equal(a.store.syncState().conflict?.from, "tab");
  a.edit(`A2 is another long note that does not fit in the storage ${"x".repeat(400)}`); a.use(); await a.save();
  assert.equal(kept(ls), "B1", "tab A's undecided version is not in the shared copy");
  b.use(); await b.store.resync();
  assert.equal(pc.plan.notes, "B1", "tab B sends only its own change");
  a.use(); a.store.resolve("theirs");
  assert.equal(a.store.get().notes, "B1"); assert.equal(pc.plan.notes, "B1");
});

test("'Erase the copy on this device', then a reopen away from home: the PC's plan is never replaced by the empty one", async () => {
  reset(P("the real plan", 0));
  const ls = storage();
  const a = await device(ls); await a.store.load();
  a.use(); a.store.eraseDevice();
  pc.up = false;
  const b = await device(ls); await b.store.load();     // empty, away from home
  b.edit("one new thing"); await b.save();
  pc.up = true; b.use(); await b.store.resync();
  assert.equal(pc.plan.notes, "the real plan", "refused: this device's copy is not built on the PC's");
  assert.ok(b.store.syncState().conflict);
  // without an edit, back home the device takes the PC's plan
  reset(P("the real plan", 0)); const ls2 = storage();
  const c = await device(ls2); await c.store.load(); c.use(); c.store.eraseDevice();
  pc.up = false; const d = await device(ls2); await d.store.load();
  pc.up = true; d.use(); await d.store.resync();
  assert.equal(d.store.get().notes, "the real plan"); assert.equal(pc.plan.notes, "the real plan");
});

test("sandbox: erasing removes only the pretend plan, never the real copy or its waiting mark", async () => {
  reset();
  const ls = storage();
  const real = await device(ls); await real.store.load();
  pc.up = false; real.edit("real change, waiting"); await real.save(); pc.up = true;
  const s = await device(ls, { sandbox: true }); await s.store.load();
  s.edit("pretend"); await s.save();
  s.use(); s.store.eraseDevice();
  assert.equal(kept(ls), "real change, waiting"); assert.equal(record(ls).pending, true);
  assert.equal(ls.getItem("planner.plan.sandbox"), null);
});

test("full storage: a change the PC got but this device could not store never lets an older copy overwrite it", async () => {
  reset(P("X", 0));
  const ls = storage();
  const a = await device(ls); await a.store.load();
  a.edit("P1"); await a.save();
  ls.quota = ls.getItem("planner.plan").length + ls.getItem("planner.plan.sync").length + 160;
  a.edit(`N1 is a longer note that reaches the PC but does not fit here ${"x".repeat(400)}`); await a.save();
  assert.equal(pc.plan.notes.startsWith("N1"), true); assert.equal(kept(ls), "P1");
  pc.up = false;
  const b = await device(ls); await b.store.load();     // reopened away from home: the older stored copy
  b.edit("P1 edited"); await b.save();
  pc.up = true; b.use(); await b.store.resync();
  assert.equal(pc.plan.notes.startsWith("N1"), true, "the newer copy on the PC is kept");
});

test("a second tab opening while the first tab's save reaches the PC keeps the newer copy, and the next edit is no false conflict", async () => {
  reset();
  const ls = storage();
  const a = await device(ls); a.use(); await a.store.load();
  pc.getDelay = 100;
  const b = await device(ls); b.use(); const opening = b.store.load();   // tab B's answer from the PC is taken before A's save
  await sleep(20);
  a.edit("A1"); a.use(); await a.save();
  assert.equal(pc.plan.notes, "A1");
  await opening; pc.getDelay = 0;
  assert.equal(kept(ls), "A1", "the stored copy stays A1"); assert.equal(b.store.get().notes, "A1");
  b.edit("B1 built on A1"); b.use(); await b.save();
  assert.equal(b.store.syncState().conflict, null); assert.equal(pc.plan.notes, "B1 built on A1");
});

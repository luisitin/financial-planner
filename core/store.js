// core/store.js -- the ONE plan object and how it is persisted.
//
//   store.get()            current plan (treat as read-only)
//   store.update(fn)       fn(draft) mutates a clone; kept on this device at once; subscribers fire; the send is scheduled
//   store.subscribe(fn)    fn(plan) after every update; returns unsubscribe
//   store.backend()        "server" (PC holds the plan, shared by every device) or "local"
//   store.sandbox()        true when the page was opened with ?sandbox=1 (pretend plan, this browser only)
//   store.adopt(plan)      take a newer plan read from the PC, staying connected
//   store.syncState()      { pending, failed, late, conflict, localFull }: what the PC does not have yet, and why
//   store.resync()         reach the PC again: send this device's changes, or take the PC's copy
//   store.reconnect()      the connection settings changed: reach the PC with them (never reloads over edits)
//   store.resolve(which)   "mine" | "theirs": settle a conflict
//   store.flush()          send a scheduled save now (the app is being hidden or closed)
//   store.eraseDevice()    erase this device's copy (the pretend one in the sandbox) and its waiting mark
//   store.takeSent()       true once after changes that waited on this device reached the PC
//   store.takeLost()       true once when a change marked as waiting was not on this device any more at open
//   store.settleWith(fn)   register the function that refreshes untouched guesses inside every update (core/app.js, once at boot)
//   store.takeSettled()    what the last update's settle changed, once: { changed, dropped } | null
//
// Persistence: the PC server's data/plan.json when reachable, else this browser's
// localStorage (per device -- the phone and the PC would then hold different plans,
// which is why the server is the normal mode). Every change also goes to localStorage
// as an offline copy. Schema versions are handled in core/schema/migrate.js.
//
// Never lose a change, never overwrite one silently:
// - Every change is written to this device and marked waiting (`planner.plan.sync`: { base, pending, mine, since, missed, sent })
//   the moment it is made, inside update(): closing or hiding the app a moment later loses nothing. Only the send to the
//   PC waits (400 ms, so a burst of edits goes as one). `mine` is the stamp of the waiting plan and `since` when it began
//   waiting, so another tab or the next open knows its age; `missed` is set when a send failed (the pill said Phone
//   only), so the note that it reached the PC follows everywhere. Pending is cleared only when the PC has that very plan.
// - A sync record speaks only for the copy it names: a waiting mark whose plan is not on the device (it did not fit, or
//   the copy was erased) is dropped (and said once), and a base the stored copy is not is forgotten, so a save can never
//   claim to be built on a copy this device does not hold.
// - Every save to the PC names the copy it was built on (X-Planner-Base = `base`, or "none"). When another device saved
//   in between, the PC answers 409 with its copy and overwrites nothing: this device keeps showing its own version and
//   the shell asks which version to keep. A PC copy that is one of this device's own sends since the last confirmed one
//   (`sent`: an answer lost on the way) is not a conflict. Whether someone else saved is decided by stamps, never by
//   comparing two devices' clocks.
// - When nothing waits here, the PC's copy is the plan: a device whose copy differs (someone saved elsewhere, a stale
//   or erased copy) takes the PC's, and is "in sync" only when it holds the PC's very copy.
// - All sends to the PC run one after another (the `chain`).
// - A second tab on this device writes the same stored copy: this tab takes it. If this tab holds a version it could not
//   store, the shell asks which to keep, and while that choice is open this tab's version stays out of the shared copy
//   (in this tab's sessionStorage), so the other tab can neither take nor send it.
// The PC keeps a backup of every version it replaces.
//
// Sandbox: open the app with ?sandbox=1 in the address (http://127.0.0.1:8787/?sandbox=1)
// and it works on a separate pretend plan kept only in that browser under another key.
// It never reads or writes the PC's data/plan.json, so testers and demos cannot touch the
// owner's real numbers. tools/drive.mjs uses it by default.
import { api } from "./api.js";
import { emptyPlan, migrate } from "./schema/migrate.js";

const SANDBOX = (() => { try { return new URLSearchParams(location.search).has("sandbox"); } catch { return false; } })();
const LS_KEY = SANDBOX ? "planner.plan.sandbox" : "planner.plan";
const SYNC_KEY = `${LS_KEY}.sync`;
const DRAFT_KEY = `${LS_KEY}.undecided`;    // sessionStorage: this tab's version while a choice between tabs is open
const AMBER_AFTER_MS = 4000;                // a change still unsent after this long shows on the pill (no flicker on each save)
let plan = null;
let backend = "local";
let saveTimer = null;
let chain = Promise.resolve();              // every send to the PC, one after another
let conflict = null;                        // { theirs, from: "pc" | "tab" } while two versions wait (this tab's is `plan`)
let failed = false;                         // the last send did not reach the PC
let localFull = false;                      // the plan did not fit in this browser's storage
let justSent = false;
let lost = false;
let written = "";                           // the stamp this tab last read or wrote in localStorage
let settleFn = null;                        // refreshes untouched guesses inside update() only (core/estimate settle; core/app.js registers it)
let settled = null;                         // what the last update's settle changed, until takeSettled() reads it
const subs = new Set();

/** A version's identity: meta.rev, new on every change (two saves in the same millisecond share an updatedAt); plans
 * saved before rev existed fall back to updatedAt. */
const stamp = (p) => p?.meta?.rev || p?.meta?.updatedAt || "";
const when = (p) => p?.meta?.updatedAt ?? "";
const newRev = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const touch = (p) => { p.meta = p.meta ?? {}; p.meta.updatedAt = new Date().toISOString(); p.meta.rev = newRev(); return p; };
// A browser that keeps nothing between visits (a sandboxed frame, where reading storage throws): the plan then lives in
// memory for the visit, so the app works instead of failing, and nothing says the storage is full.
const keepsNothing = (() => { try { const k = "planner.__probe"; localStorage.setItem(k, "1"); localStorage.removeItem(k); return false; } catch { return true; } })();
let inMemory = null;                        // the plan (as JSON) when keepsNothing
function readLocal() {
  if (keepsNothing) return inMemory ? JSON.parse(inMemory) : null;
  try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function writeLocal(p) {
  if (keepsNothing) { inMemory = JSON.stringify(p); written = stamp(p); localFull = false; return true; }
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)); written = stamp(p); localFull = false; return true; }
  catch { localFull = !SANDBOX; return false; }
}
/** A starting plan baked into a single-file build (tools/build.mjs --demo), used only while this browser has no plan of its own. */
function startingPlan() { try { const p = globalThis.__PLANNER_START__; return p && typeof p === "object" ? JSON.parse(JSON.stringify(p)) : null; } catch { return null; } }
function readSync() {
  try { const s = JSON.parse(localStorage.getItem(SYNC_KEY) || "{}") || {}; if (typeof s.sent === "string") s.sent = [s.sent]; return s; }
  catch { return {}; }
}
/** The sync record, trusted only as far as it speaks for `at`, the copy this tab holds. */
function readSyncFor(at, { atOpen = false } = {}) {
  const s = readSync();
  if (s.pending && s.mine !== at) {                    // the waiting change is not this copy: it did not fit, or was erased
    if (atOpen && s.mine) lost = true;
    const { pending, mine, since, base, ...rest } = s; return base && base === at ? { ...rest, base } : rest;
  }
  if (!s.pending && s.base && s.base !== at) { const { base, ...rest } = s; return rest; }
  return s;
}
let sync = SANDBOX ? {} : readSync();
function writeSync(s) { sync = s; if (!SANDBOX) { try { localStorage.setItem(SYNC_KEY, JSON.stringify(s)); } catch { } } told(); }
function readDraft() { try { const raw = sessionStorage.getItem(DRAFT_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } }
function writeDraft(p) { try { if (p) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(p)); else sessionStorage.removeItem(DRAFT_KEY); } catch { } }
function notify() { for (const fn of subs) { try { fn(plan); } catch (e) { console.error("[store] subscriber failed", e); } } }
function told() { try { dispatchEvent(new Event("planner:sync")); } catch { } }
const enqueue = (job) => { const run = chain.then(job, job); chain = run.catch((e) => console.error("[store] sync step failed", e)); return run; };
const sentList = () => (Array.isArray(sync.sent) ? sync.sent : []);
/** The PC's copy is someone else's save: not the copy this device built on, and none of this device's own sends. */
const othersSaved = (server) => !!server && stamp(server) !== (sync.base ?? "") && !sentList().includes(stamp(server));
/** The waiting change has waited long enough to show (or its age is unknown, or the PC is out of reach). */
const isLate = () => !SANDBOX && !!sync.pending && (failed || !!sync.missed || backend !== "server" || !sync.since || Date.now() - sync.since > AMBER_AFTER_MS);
/** Redraw the pill when a waiting change turns late (in any tab that reads it). */
function tellWhenLate() { if (sync.pending && sync.since && !isLate()) setTimeout(told, Math.max(0, AMBER_AFTER_MS - (Date.now() - sync.since)) + 50); }

/** Mark `p` as this device's change the PC does not have yet, and keep it on the device. */
function keepHere(p) {
  if (conflict?.from === "tab") { writeDraft(p); return; }   // undecided: stays in this tab until the choice is made
  writeLocal(p);
  if (SANDBOX) return;
  writeSync({ ...sync, pending: true, mine: stamp(p), since: sync.pending && sync.since ? sync.since : Date.now() });
  tellWhenLate();
}
/**
 * Send `p` to the PC on top of the copy stamped `base`. Without a known base it says "none", which the PC refuses when
 * it already holds a plan, so even then nothing is overwritten unasked. Runs inside the chain. `waited`: this change
 * showed as waiting first (the shell then says it reached the PC). -> "sent" | "conflict" | "failed"
 */
async function send(p, base, { waited = false, depth = 0 } = {}) {
  const before = sentList();
  waited = waited || failed || !!sync.missed || (!!sync.pending && (!sync.since || Date.now() - sync.since > AMBER_AFTER_MS));
  writeSync({ ...sync, sent: [...before.filter((s) => s !== stamp(p)), stamp(p)].slice(-20) });
  try {
    await api.putPlan(p, base || "none");
  } catch (e) {
    if (e.status === 409 && e.plan) {
      const at = stamp(e.plan);
      if (at === stamp(p)) { /* the PC already has this very plan */ }
      else if (at && before.includes(at) && depth < 2) return send(p, at, { waited, depth: depth + 1 });   // our own earlier send whose answer was lost
      else { conflict = { theirs: e.plan, from: "pc" }; failed = false; writeSync({ ...sync, sent: before }); return "conflict"; }
    } else { failed = true; writeSync({ ...sync, missed: true }); return "failed"; }   // `missed`: every tab, and the next open, shows it
  }
  failed = false;
  const newer = stamp(plan) !== stamp(p);   // a change made while this one was on its way
  if (waited && !newer) justSent = true;
  writeSync({ ...sync, base: stamp(p), sent: [], pending: newer, mine: newer ? sync.mine : undefined, since: newer ? (waited ? sync.since : Date.now()) : undefined, missed: newer ? sync.missed : undefined });
  return "sent";
}

/** Another tab on this device wrote the plan: take it when this tab holds nothing it could not store, otherwise ask. */
function otherTab() {
  if (SANDBOX) return;
  const stored = readLocal();
  if (!stored) { sync = readSync(); return; }
  if (stamp(stored) === written) { if (conflict?.from !== "tab") sync = readSyncFor(stamp(plan)); tellWhenLate(); return; }
  const clean = stamp(plan) === written && conflict?.from !== "tab";
  written = stamp(stored);
  if (clean || !plan) {
    plan = migrate(stored); sync = readSyncFor(stamp(stored));
    // another tab settled the PC choice (took the PC's copy, or kept this device's and sent it on top)
    if (conflict?.from === "pc" && (!sync.pending || sync.base === stamp(conflict.theirs))) conflict = null;
    notify(); told(); tellWhenLate();
  } else if (stamp(stored) !== stamp(plan)) {
    if (conflict?.from === "tab") conflict.theirs = stored;
    else { conflict = { theirs: stored, from: "tab" }; writeDraft(plan); }
    told();
  }
}
try { addEventListener("storage", (e) => { if (e.key === LS_KEY || e.key === SYNC_KEY) otherTab(); }); } catch { }

export const store = {
  async load() {
    const before = SANDBOX ? "" : stamp(readLocal());
    let server, reached = false;
    if (!SANDBOX && await api.ready()) {
      try { server = await api.getPlan(); backend = "server"; reached = true; } catch (e) { console.warn("[store] server plan unavailable", e); }
    }
    // this device's copy is read only now: another tab may have saved while the PC answered
    let stored = readLocal();
    if (!stored && !SANDBOX) { const start = startingPlan(); if (start) { const p = touch(migrate(start)); writeLocal(p); stored = p; } }
    const local = stored ? migrate(stored) : null;
    written = stamp(stored);
    if (!SANDBOX) sync = readSyncFor(stamp(stored), { atOpen: true });
    const mine = sync.pending ? local : null;                 // this device's waiting change (readSyncFor checked it is this copy)
    const moved = !!stored && stamp(stored) !== before;       // another tab saved while the PC answered: newer than that answer
    const take = (p) => { plan = migrate(p ?? emptyPlan()); if (stamp(plan) !== written) writeLocal(plan); };
    if (!reached) take(local);
    else if (!server) {                                         // a fresh PC: seed it with what this device has
      take(local);
      if (local) enqueue(async () => { if ((await send(plan, null)) !== "sent") keepHere(plan); });
    } else if (!mine) { if (moved) take(local); else { take(server); writeSync({ base: stamp(server), pending: false }); } }
    else if (stamp(server) === stamp(mine)) { take(mine); writeSync({ base: stamp(server), pending: false }); }   // it got there; the answer was lost
    else if (!othersSaved(server)) { take(mine); enqueue(() => send(plan, stamp(server))); }   // sent after the first screen, not before
    else { take(mine); conflict = { theirs: server, from: "pc" }; }
    // this tab's undecided version from before a reload: ask again
    const draft = SANDBOX ? null : readDraft();
    if (draft && !conflict && stamp(draft) !== stamp(plan)) { conflict = { theirs: plan, from: "tab" }; plan = migrate(draft); }
    else if (draft && stamp(draft) === stamp(plan)) writeDraft(null);
    if (conflict || lost) told();
    tellWhenLate();
    return plan;
  },
  /** The connection settings changed: reach the PC with them. Uses resync (inside the chain), so nothing typed meanwhile is lost. */
  async reconnect() {
    api.health = null; api.configCache = null;
    if (backend === "server") { backend = "local"; told(); }
    await this.resync();
    notify();
  },
  /** Take a newer plan read from the PC, staying connected to it. */
  adopt(p) { plan = migrate(p); failed = false; writeLocal(plan); writeSync({ base: stamp(p), pending: false }); notify(); },
  /**
   * Reach the PC again (every 30 seconds while changes wait or the PC was out of reach, when the tab comes back, when
   * the network returns): send this device's changes, take the PC's copy when nothing waits here, or set up the
   * choice when both changed. `takeNewer: false` (someone is typing) leaves the PC's copy for the next try.
   * Returns true when the PC answered.
   */
  async resync({ takeNewer = true } = {}) {
    if (SANDBOX) return false;
    otherTab();
    if (conflict) return true;
    if (!(await api.ready())) { if (backend === "server") { backend = "local"; told(); } return false; }
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }   // the change is already kept here; this sends it
    return enqueue(async () => {
      const seen = plan;                                      // to tell whether someone edits while the PC answers
      const wasLate = isLate();
      let server;
      try { server = await api.getPlan(); } catch { return false; }
      otherTab();
      if (conflict) return true;
      const wasLocal = backend !== "server";
      backend = "server";
      if (!server) { if ((await send(plan, null, { waited: wasLate })) !== "sent") keepHere(plan); return true; }   // the PC lost or never had a plan
      if (sync.pending) {
        if (stamp(plan) !== sync.mine) { told(); return true; }   // not this tab's to send
        if (stamp(server) === stamp(plan)) { if (wasLate) justSent = true; failed = false; writeSync({ base: stamp(server), pending: false }); }   // it got there; the answer was lost
        else if (othersSaved(server)) { conflict = { theirs: server, from: "pc" }; failed = false; told(); }
        else await send(plan, stamp(server), { waited: wasLate || wasLocal });
        return true;
      }
      if (stamp(server) === stamp(plan)) { failed = false; writeSync({ ...sync, base: stamp(server), pending: false }); return true; }
      // nothing waits here and the PC has another copy: the PC's is the plan (saved elsewhere, or this copy is stale or erased)
      if (!takeNewer) { if (wasLocal) backend = "local"; told(); return true; }   // try again when nobody is typing
      if (plan !== seen || saveTimer) return true;            // an edit arrived meanwhile: its save decides next
      plan = migrate(server); failed = false; writeLocal(plan); writeSync({ base: stamp(server), pending: false }); notify();
      return true;
    });
  },
  /** What the PC does not have yet: { pending, failed, conflict: { mineAt, theirsAt, from } | null, localFull, late } */
  syncState() {
    return {
      pending: !SANDBOX && !!sync.pending, failed, localFull, late: isLate(),
      conflict: conflict ? { mineAt: when(plan), theirsAt: when(conflict.theirs), from: conflict.from } : null,
    };
  },
  takeSent() { const s = justSent; justSent = false; return s; },
  takeLost() { const s = lost; lost = false; return s; },
  /** Settle a conflict: "mine" keeps this tab's version (and sends it to the PC), "theirs" takes the other one. */
  resolve(which) {
    if (!conflict) return;
    const { theirs, from } = conflict;
    conflict = null; failed = false; writeDraft(null);
    if (which === "theirs") {
      plan = migrate(theirs);
      if (from === "pc") { writeLocal(plan); writeSync({ base: stamp(theirs), pending: false }); }
      else { written = stamp(readLocal()); sync = readSyncFor(stamp(plan)); if (written !== stamp(plan)) keepHere(plan); told(); }
      notify();
      return;
    }
    // this version replaces the other one: built on the PC's copy (a PC choice) or on what the other tab's copy was built on
    sync = from === "pc" ? { ...sync, base: stamp(theirs) } : readSync();
    sync = { ...sync, since: Date.now(), missed: undefined };   // the "Kept this device's version" note stays; no "now saved" over it
    plan = touch(structuredClone(plan));
    keepHere(plan); notify();
    if (backend === "server") enqueue(() => send(plan, sync.base));
  },
  get() { return plan; },
  backend() { return backend; },
  sandbox() { return SANDBOX; },
  /** Register the function that refreshes guesses inside every update (core/app.js does it once at boot). Load, adopt,
   * replace, resolve, resync and another tab's save never call it: opening the app or taking a copy writes nothing. */
  settleWith(fn) { settleFn = typeof fn === "function" ? fn : null; },
  /** What the last update's settle changed, once: { changed, dropped } | null. */
  takeSettled() { const s = settled; settled = null; return s; },
  update(mutator) {
    otherTab();                                   // another tab's save first, so this change builds on it
    let next = structuredClone(plan);
    mutator(next);
    // the guesses nobody has touched follow the change. It works on its own copy when the plan has guesses, so a settle
    // that fails part way never costs the person their change, nor leaves half a refresh behind
    if (settleFn) {
      const trial = next.guesses ? structuredClone(next) : next;
      try { settled = settleFn(trial) ?? null; next = trial; } catch (e) { settled = null; console.error("[store] settle failed", e); }
    }
    plan = touch(next);
    keepHere(plan);                               // on this device and marked waiting now: closing the app loses nothing
    notify();
    this.scheduleSave();
  },
  replace(next) { otherTab(); plan = touch(migrate(next)); keepHere(plan); notify(); this.scheduleSave(); },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(() => this.save(), 400); },
  /** Send the waiting change to the PC, after any send already on its way (the change itself is already on the device). */
  save() {
    clearTimeout(saveTimer); saveTimer = null;
    if (SANDBOX || backend !== "server" || conflict) return Promise.resolve();
    return enqueue(async () => { if (conflict || !sync.pending || stamp(plan) !== sync.mine) return; await send(plan, sync.base); });
  },
  /** The app is being hidden or closed: send a scheduled save now. */
  flush() { return saveTimer ? this.save() : Promise.resolve(); },
  /** Every send queued so far has finished (tests, and anything that must wait for the PC). */
  async idle() { let c; do { c = chain; await c; } while (c !== chain); },
  /** Erase this device's copy (the pretend plan in the sandbox) and its waiting mark; the PC's copy is untouched. */
  eraseDevice() {
    clearTimeout(saveTimer); saveTimer = null;
    inMemory = null;
    try { localStorage.removeItem(LS_KEY); if (!SANDBOX) localStorage.removeItem(SYNC_KEY); } catch { }
    writeDraft(null);
  },
};

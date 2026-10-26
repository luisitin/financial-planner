// core/store.js -- the ONE plan object and how it is persisted.
//
//   store.get()            current plan (treat as read-only)
//   store.update(fn)       fn(draft) mutates a clone; subscribers fire; save is scheduled
//   store.subscribe(fn)    fn(plan) after every update; returns unsubscribe
//   store.backend()        "server" (PC holds the plan, shared by every device) or "local"
//   store.sandbox()        true when the page was opened with ?sandbox=1 (pretend plan, this browser only)
//
// Persistence: the PC server's data/plan.json when reachable, else this browser's
// localStorage (per device -- the phone and the PC would then hold different plans,
// which is why the server is the normal mode). Every save also goes to localStorage
// as an offline copy. Schema versions are handled in core/schema/migrate.js.
//
// Sandbox: open the app with ?sandbox=1 in the address (http://127.0.0.1:8787/?sandbox=1)
// and it works on a separate pretend plan kept only in that browser under another key.
// It never reads or writes the PC's data/plan.json, so testers and demos cannot touch the
// owner's real numbers. tools/drive.mjs uses it by default.
import { api } from "./api.js";
import { emptyPlan, migrate } from "./schema/migrate.js";

const SANDBOX = (() => { try { return new URLSearchParams(location.search).has("sandbox"); } catch { return false; } })();
const LS_KEY = SANDBOX ? "planner.plan.sandbox" : "planner.plan";
let plan = null;
let backend = "local";
let saveTimer = null;
const subs = new Set();

function readLocal() { try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } }
function writeLocal(p) { try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch { } }
function notify() { for (const fn of subs) { try { fn(plan); } catch (e) { console.error("[store] subscriber failed", e); } } }

export const store = {
  async load() {
    let p = null;
    if (!SANDBOX && await api.ready()) {
      try { p = await api.getPlan(); backend = "server"; } catch (e) { console.warn("[store] server plan unavailable", e); }
    }
    if (backend === "server" && !p) {
      // fresh server: seed it with whatever this device already has
      p = readLocal();
      if (p) { try { await api.putPlan(p); } catch { } }
    }
    if (!p) p = readLocal();
    plan = migrate(p ?? emptyPlan());
    writeLocal(plan);
    return plan;
  },
  async reconnect() { backend = "local"; return this.load().then(() => notify()); },
  get() { return plan; },
  backend() { return backend; },
  sandbox() { return SANDBOX; },
  update(mutator) {
    const next = structuredClone(plan);
    mutator(next);
    next.meta = next.meta ?? {};
    next.meta.updatedAt = new Date().toISOString();
    plan = next;
    notify();
    this.scheduleSave();
  },
  replace(next) { plan = migrate(next); plan.meta.updatedAt = new Date().toISOString(); notify(); this.scheduleSave(); },
  subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(() => this.save(), 400); },
  async save() {
    writeLocal(plan);
    if (backend === "server") { try { await api.putPlan(plan); } catch (e) { console.warn("[store] server save failed; local copy kept", e); } }
  },
};

// modules/transactions/ledger/writer.js -- who last wrote a comment on this device (gap list next 60, item 58; X9).
//
//   import { writer } from "./writer.js";
//   writer.last          // the person id this phone last wrote a comment as, or null (nothing kept yet)
//   writer.set("p-bo")   // a save that added or changed a comment: "Who is writing" starts on them next time
//   writer.forget()      // Settings' "Erase the copy on this device"
//
// "Who is writing" starts on the person who last wrote a comment on this phone, else on the plan's "Me" (ledger compute
// writerChoices): two partners on two phones each find themselves already picked after their first comment, and nobody
// is asked to pick on every save. A choice of this device, never of the plan: ONE localStorage key, planner.writer
// (planner.writer.sandbox in the sandbox), { fmt: 1, by: "<a person's id>" }. No name, no figure; never sent to the
// computer, never in a downloaded copy. No DOM; every storage call is guarded (a private window keeps a copy in memory
// for the visit), so it imports cleanly in Node.
const SANDBOX = (() => { try { return new URLSearchParams(globalThis.location?.search ?? "").has("sandbox"); } catch { return false; } })();
export const WRITER_KEY = SANDBOX ? "planner.writer.sandbox" : "planner.writer";

const storage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
const idOf = (x) => (typeof x === "string" && x && x.length <= 80 ? x : null);
let mem;   // undefined: not read yet
function load() {
  if (mem !== undefined) return mem;
  let raw = null;
  try { raw = JSON.parse(storage()?.getItem(WRITER_KEY) ?? "null"); } catch { raw = null; }
  // nothing, or not ours (another format, a broken value): nothing kept
  mem = raw && typeof raw === "object" && raw.fmt === 1 ? idOf(raw.by) : null;
  return mem;
}

export const writer = {
  get last() { return load(); },
  /** Keep who wrote on this device (anything but an id forgets it). -> the id kept, or null. */
  set(by) {
    mem = idOf(by);
    try {
      const s = storage(); if (!s) return mem;
      if (mem === null) s.removeItem(WRITER_KEY); else s.setItem(WRITER_KEY, JSON.stringify({ fmt: 1, by: mem }));
    } catch { /* full or blocked: the copy in memory serves this visit */ }
    return mem;
  },
  /** Nothing kept: "Who is writing" starts on the plan's "Me" again (the sandbox's own key in the sandbox). */
  forget() { mem = null; try { storage()?.removeItem(WRITER_KEY); } catch { } },
  /** Tests only: read the storage again on the next call. */
  _reset() { mem = undefined; },
};

/** Settings' "Erase the copy on this device". */
export const forgetWriter = () => writer.forget();

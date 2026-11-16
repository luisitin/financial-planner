// modules/ai/assistant/tone.js -- how the helper talks to you, on this device (gap list next 60, item 58; X8).
//
//   import { tone } from "../assistant/tone.js";
//   tone.chosen          // "gentle" | "plain" | "blunt" (nothing stored: "plain", today's words)
//   tone.set("blunt")    // Settings' chip: kept on this device, used by the next question
//   tone.forget()        // "Erase the copy on this device"
//
// A choice of this device, never of the plan (README "Not in the plan"): ONE localStorage key, planner.tone
// (planner.tone.sandbox in the sandbox), { fmt: 1, tone: "gentle" | "blunt" }; Plain is stored as nothing. Never sent to the
// computer except as the words of the prompt (compute.js toneWords), never in a downloaded copy; no figure and no name.
// No DOM; every storage call is guarded (a private window or a sandboxed frame keeps a copy in memory for the visit), so it
// imports cleanly in Node.
import { toneOf, DEFAULT_TONE } from "./compute.js";

const SANDBOX = (() => { try { return new URLSearchParams(globalThis.location?.search ?? "").has("sandbox"); } catch { return false; } })();
export const TONE_KEY = SANDBOX ? "planner.tone.sandbox" : "planner.tone";

const storage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
let mem = null;   // the copy in memory, read once
function load() {
  if (mem !== null) return mem;
  let raw = null;
  try { raw = JSON.parse(storage()?.getItem(TONE_KEY) ?? "null"); } catch { raw = null; }
  // nothing, or not ours (another format, a broken value): read as nothing stored, which is Plain
  mem = raw && typeof raw === "object" && raw.fmt === 1 ? toneOf(raw.tone) : DEFAULT_TONE;
  return mem;
}

export const tone = {
  get chosen() { return load(); },
  /** Keep the tone on this device (Plain removes the key). -> the tone now. */
  set(t) {
    mem = toneOf(t);
    try {
      const s = storage(); if (!s) return mem;
      if (mem === DEFAULT_TONE) s.removeItem(TONE_KEY); else s.setItem(TONE_KEY, JSON.stringify({ fmt: 1, tone: mem }));
    } catch { /* full or blocked: the copy in memory serves this visit */ }
    return mem;
  },
  /** Back to Plain, the key gone (the sandbox's own key in the sandbox). */
  forget() { mem = DEFAULT_TONE; try { storage()?.removeItem(TONE_KEY); } catch { } },
  /** Tests only: read the storage again on the next call. */
  _reset() { mem = null; },
};

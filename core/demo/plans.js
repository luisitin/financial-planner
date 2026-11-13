// core/demo/plans.js -- the three pretend families' plans, made for today's date. PURE. Loaded only by core/store.js,
// and only when the address asks for a pretend family (core/demo/names.js demoOf), so a normal open never fetches it.
import { DEMO_IDS, localToday } from "./names.js";
import { family } from "./family.js";
import { couple } from "./couple.js";
import { starter } from "./starter.js";

const MAKERS = { family, couple, starter };

/** demoPlan(id, today = this device's date) -> a fresh, whole plan for that pretend family (an unknown id: the first). */
export function demoPlan(id, today = localToday()) {
  return (MAKERS[id] ?? MAKERS[DEMO_IDS[0]])(today);
}

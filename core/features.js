// core/features.js -- which pages are on. Precedence, highest first:
//   1. this device's toggles (System > Settings)      localStorage "planner.features"
//   2. the PC's planner.properties  `feature.<group>/<id>=false`
//   3. the module's own `enabledByDefault` (true when omitted)
import { api } from "./api.js";

const LS_KEY = "planner.features";
let fromServer = {};

export const features = {
  overrides: (() => { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; } })(),
  async init() { try { fromServer = (await api.config())?.features ?? {}; } catch { fromServer = {}; } },
  key(m) { return `${m.group}/${m.id}`; },
  enabled(m) {
    const k = this.key(m);
    if (k in this.overrides) return !!this.overrides[k];
    if (k in fromServer) return !!fromServer[k];
    return m.enabledByDefault !== false;
  },
  set(key, value) {
    if (value === null || value === undefined) delete this.overrides[key]; else this.overrides[key] = !!value;
    localStorage.setItem(LS_KEY, JSON.stringify(this.overrides));
    dispatchEvent(new Event("planner:features"));
  },
  sourceOf(m) { const k = this.key(m); return k in this.overrides ? "device" : (k in fromServer ? "properties" : "default"); },
};

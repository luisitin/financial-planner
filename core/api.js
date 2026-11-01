// core/api.js -- the browser's client for the PC server (server/server.mjs) and the
// device-side connection settings.
//
// Connection settings live in localStorage under "planner.connection":
//   { serverUrl, token, ai: { provider, host, port, model, baseUrl, apiKey } }
// serverUrl is blank when the page is served BY the server (same origin). It is set
// on a phone that opens a copy of the HTML from somewhere else, or on the
// System > Settings page.
//
// Resolution order for anything configurable (documented in docs/PLAN.md):
//   1. the PC server's planner.properties (GET /api/config)   -- the owner's box
//   2. this device's Settings page (localStorage)             -- a shared copy
//   3. built-in defaults                                       -- Ollama on localhost
const LS_KEY = "planner.connection";
// A request to the PC that hangs (the phone left the Wi-Fi mid-request, the PC went to sleep) gives up after this long,
// so a save falls back to "kept on this device, sent later" instead of waiting for minutes.
const TIMEOUT_MS = 12000;
function timed(ms = TIMEOUT_MS) {
  try { if (AbortSignal.timeout) return AbortSignal.timeout(ms); } catch { }
  const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal;
}

export const conn = {
  load() { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; } },
  save(c) { localStorage.setItem(LS_KEY, JSON.stringify(c ?? {})); dispatchEvent(new Event("planner:connection")); },
};

export const api = {
  health: null,
  configCache: null,
  base() {
    const c = conn.load();
    if (c.serverUrl) return c.serverUrl.replace(/\/+$/, "");
    return location.protocol.startsWith("http") ? location.origin : "";
  },
  headers(extra = {}) {
    const c = conn.load();
    const h = { "Content-Type": "application/json", ...extra };
    if (c.token) h["X-Planner-Token"] = c.token;
    return h;
  },
  async ready() {
    if (!this.base()) return false;
    try {
      const r = await fetch(this.base() + "/api/health", { headers: this.headers(), cache: "no-store", signal: timed(5000) });
      this.health = await r.json();
      return !!this.health?.ok;
    } catch { this.health = null; return false; }
  },
  async config() {
    if (this.configCache) return this.configCache;
    if (!this.base()) return null;
    try { const r = await fetch(this.base() + "/api/config", { headers: this.headers(), cache: "no-store", signal: timed(5000) }); this.configCache = await r.json(); return this.configCache; }
    catch { return null; }
  },
  async getPlan() {
    const r = await fetch(this.base() + "/api/plan", { headers: this.headers(), cache: "no-store", signal: timed() });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`GET /api/plan ${r.status}`);
    return r.json();
  },
  /**
   * Save the plan on the PC. `base` is the PC copy's meta.updatedAt this plan was built on: when another device saved
   * since, the PC refuses with 409 and the error carries its copy (err.status, err.plan), so nothing is overwritten.
   * "none" means "I know of no plan on the PC": refused when it has one. Without a base the PC takes the plan as it
   * always did (restores from older pages).
   */
  async putPlan(plan, base) {
    const r = await fetch(this.base() + "/api/plan", { method: "PUT", headers: this.headers(base ? { "X-Planner-Base": base } : {}), body: JSON.stringify(plan), signal: timed() });
    if (r.status === 409) { const e = new Error("PUT /api/plan 409: the PC's copy changed"); e.status = 409; try { e.plan = (await r.json()).plan ?? null; } catch { e.plan = null; } throw e; }
    if (!r.ok) { const e = new Error(`PUT /api/plan ${r.status}`); e.status = r.status; throw e; }
    return r.json();
  },
  /** Heavy compute on the PC. `plan`: this device's plan (the PC's own copy is used when it is not sent). */
  async compute(key, params, plan) {
    const r = await fetch(this.base() + "/api/compute/" + key, { method: "POST", headers: this.headers(), body: JSON.stringify({ params: params ?? {}, ...(plan ? { plan } : {}) }) });
    if (!r.ok) throw new Error(`compute ${key} ${r.status}: ${await r.text()}`);
    return r.json();
  },
  /** Statement reader (PDF/PNG/JPG -> rows). payload: { fileName, mime, dataBase64, kind, mode }. Errors carry the server's plain sentence. */
  async readStatement(payload) {
    const r = await fetch(this.base() + "/api/statement/read", { method: "POST", headers: this.headers(), body: JSON.stringify(payload) });
    if (!r.ok) { let msg = `${r.status}`; try { msg = (await r.json()).error ?? msg; } catch { } throw new Error(msg); }
    return r.json();
  },
  async readDocumentText(payload) {
    const r = await fetch(this.base() + "/api/document/text", { method: "POST", headers: this.headers(), body: JSON.stringify(payload) });
    if (!r.ok) { let msg = `${r.status}`; try { msg = (await r.json()).error ?? msg; } catch { } throw new Error(msg); }
    return r.json();
  },
  async aiChat(messages, options = {}) {
    const r = await fetch(this.base() + "/api/ai/chat", { method: "POST", headers: this.headers(), body: JSON.stringify({ messages, ...options }) });
    if (!r.ok) throw new Error(`ai chat ${r.status}: ${await r.text()}`);
    return r.json();
  },
  async aiModels() {
    const r = await fetch(this.base() + "/api/ai/models", { headers: this.headers() });
    if (!r.ok) throw new Error(`ai models ${r.status}`);
    return r.json();
  },
};

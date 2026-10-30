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
      const r = await fetch(this.base() + "/api/health", { headers: this.headers(), cache: "no-store" });
      this.health = await r.json();
      return !!this.health?.ok;
    } catch { this.health = null; return false; }
  },
  async config() {
    if (this.configCache) return this.configCache;
    if (!this.base()) return null;
    try { const r = await fetch(this.base() + "/api/config", { headers: this.headers(), cache: "no-store" }); this.configCache = await r.json(); return this.configCache; }
    catch { return null; }
  },
  async getPlan() {
    const r = await fetch(this.base() + "/api/plan", { headers: this.headers(), cache: "no-store" });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`GET /api/plan ${r.status}`);
    return r.json();
  },
  async putPlan(plan) {
    const r = await fetch(this.base() + "/api/plan", { method: "PUT", headers: this.headers(), body: JSON.stringify(plan) });
    if (!r.ok) throw new Error(`PUT /api/plan ${r.status}`);
    return r.json();
  },
  async compute(key, params) {
    const r = await fetch(this.base() + "/api/compute/" + key, { method: "POST", headers: this.headers(), body: JSON.stringify({ params: params ?? {} }) });
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

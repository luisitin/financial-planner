// core/ai.js -- the ONLY place that talks to a language model.
//
// Policy (docs/PLAN.md "AI policy"): the model does language work -- categorise,
// extract, explain, summarise, chat. It never produces a number that lands in the
// plan without a human clicking "apply", and it never replaces core/math.
//
// Routes: when a PC server is connected, calls go through it (POST /api/ai/chat),
// so the phone needs no direct line to Ollama and the properties file stays on the
// PC. Otherwise the browser calls the provider directly using the device settings
// (Ollama must then allow the origin: set OLLAMA_ORIGINS=* on the PC).
import { api, conn } from "./api.js";
import { store } from "./store.js";

const DEFAULTS = { provider: "ollama", host: "127.0.0.1", port: 11434, model: "", baseUrl: "", apiKey: "" };

export const ai = {
  async settings() {
    const cfg = (await api.config())?.ai ?? {};
    const local = conn.load().ai ?? {};
    // properties file wins over device settings wins over defaults, field by field
    const pick = (k) => cfg[k] ?? (local[k] !== undefined && local[k] !== "" ? local[k] : undefined) ?? DEFAULTS[k];
    return { provider: pick("provider"), host: pick("host"), port: Number(pick("port")), model: pick("model"), baseUrl: pick("baseUrl"), apiKey: pick("apiKey"), source: cfg.provider ? "properties" : (local.provider ? "device" : "defaults") };
  },
  async status() {
    const s = await this.settings();
    if (s.provider === "none") return "off";
    try { const models = await this.models(); return models.length ? `on (${s.model || models[0]})` : "no models"; }
    catch { return "unreachable"; }
  },
  async models() {
    if (store.backend() === "server") return (await api.aiModels()).models ?? [];
    const s = await this.settings();
    if (s.provider === "ollama") {
      const r = await fetch(`http://${s.host}:${s.port}/api/tags`); const j = await r.json();
      return (j.models ?? []).map((m) => m.name);
    }
    if (s.provider === "openai") {
      const r = await fetch(`${s.baseUrl.replace(/\/+$/, "")}/models`, { headers: { Authorization: `Bearer ${s.apiKey}` } }); const j = await r.json();
      return (j.data ?? []).map((m) => m.id);
    }
    return [];
  },
  /** messages: [{role:"system"|"user"|"assistant", content}] -> { content, model } */
  async chat(messages, options = {}) {
    const s = await this.settings();
    if (s.provider === "none") throw new Error("AI is turned off in Settings.");
    if (store.backend() === "server") { const j = await api.aiChat(messages, options); return { content: j.content, model: j.model }; }
    const model = options.model || s.model || (await this.models())[0];
    if (s.provider === "ollama") {
      const r = await fetch(`http://${s.host}:${s.port}/api/chat`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, messages, stream: false, options: options.options ?? {} }) });
      if (!r.ok) throw new Error(`Ollama ${r.status}: ${await r.text()}`);
      const j = await r.json(); return { content: j.message?.content ?? "", model };
    }
    if (s.provider === "openai") {
      const r = await fetch(`${s.baseUrl.replace(/\/+$/, "")}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.apiKey}` }, body: JSON.stringify({ model, messages }) });
      if (!r.ok) throw new Error(`API ${r.status}: ${await r.text()}`);
      const j = await r.json(); return { content: j.choices?.[0]?.message?.content ?? "", model };
    }
    throw new Error(`unknown provider ${s.provider}`);
  },
  /** A compact, number-light description of the plan for prompts. Never the raw plan. */
  planSummary(plan) {
    const people = (plan.household?.people ?? []).map((p) => `${p.name ?? "person"} (${p.age ?? "?"})`).join(", ") || "not entered";
    const accounts = (plan.accounts ?? []).length;
    const goals = (plan.goals ?? []).map((g) => g.name).join(", ") || "none entered";
    return `Household: ${people}. Accounts on file: ${accounts}. Goals: ${goals}. Currency ${plan.meta?.currency ?? "USD"}.`;
  },
};

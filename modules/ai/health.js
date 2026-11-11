// modules/ai/health.js -- shared by Ask the plan, Settings and the Dashboard's Ask tile: is the AI helper answering, and if
// not, why, in words that fit where it runs (Ollama on the PC, another service, or turned off on the PC itself). Before,
// each page said its own thing: Settings "Working" while Ask said "not answering", "open Ollama" for another service, and
// "turned off in Settings" when only the PC's planner.properties could turn it back on.

/**
 * aiHealth(ai) -> { st: "on"|"off"|"unreachable"|"no models"|"model missing", provider, model, source, baseUrl, detail? }
 * The configured model must be one the helper lists ("qwen3.5:9b", or a bare name that matches "name:latest" or "name:tag").
 */
export async function aiHealth(ai) {
  let s;
  try { s = await ai.settings(); } catch (e) { return { st: "unreachable", provider: "ollama", detail: e?.message ?? String(e) }; }
  const base = { provider: s.provider, model: s.model, source: s.source, baseUrl: s.baseUrl };
  if (s.provider === "none") return { ...base, st: "off" };
  let models;
  try { models = await ai.models(); } catch (e) { return { ...base, st: "unreachable", detail: e?.message ?? String(e) }; }
  if (!models.length) return { ...base, st: "no models" };
  const want = String(s.model || "");
  if (want && !models.some((m) => m === want || m.split(":")[0] === want)) return { ...base, st: "model missing", detail: `Installed: ${models.slice(0, 6).join(", ")}${models.length > 6 ? "..." : ""}.` };
  return { ...base, st: "on", model: want || models[0] };
}

/** One word for Settings' fold. */
export const healthWord = (h) => ({ on: "Working", off: "Off", "no models": "No model yet", "model missing": "Model missing" })[h.st] ?? "Not answering";

/** Why it is not answering and what to do, in plain words; `settingsHelp` is false when Settings cannot fix it (the PC turned it off). */
export function healthWords(h) {
  const other = h.provider === "openai";
  const where = other ? `The AI service${h.baseUrl ? ` at ${String(h.baseUrl).replace(/^https?:\/\//, "").replace(/\/.*$/, "")}` : ""}` : "The AI helper on your computer";
  if (h.st === "off") return h.source === "properties"
    ? { why: "The AI helper is turned off on the computer that runs the app (its settings file).", todo: "Whoever looks after your computer can switch it on there.", settingsHelp: false }
    : { why: "The AI helper is turned off in Settings.", todo: "Switch it on under Settings > AI assistant.", settingsHelp: true };
  if (h.st === "no models") return other
    ? { why: `${where} lists no models.`, todo: "Check its address and key in Settings, then try again.", settingsHelp: true }
    : { why: `${where} has no model to answer with yet.`, todo: "On your computer, install one in Ollama (for example: ollama pull qwen3.5:9b), then try again.", settingsHelp: false };
  if (h.st === "model missing") return other
    ? { why: `${where} has no model called "${h.model}".`, todo: "Pick one it has in Settings, then try again.", settingsHelp: true }
    : { why: `${where} cannot find the model "${h.model}".`, todo: `On your computer, install it (ollama pull ${h.model}) or choose an installed one, then try again.`, settingsHelp: false };
  return other
    ? { why: `${where} is not answering right now.`, todo: "Check its address and key in Settings, then try again.", settingsHelp: true }
    : { why: `${where} is not answering right now.`, todo: "On your computer, open Ollama and leave it running, then try again.", settingsHelp: false };
}

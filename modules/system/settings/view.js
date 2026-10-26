// modules/system/settings/view.js -- plan basics, page toggles, your data, then the
// technical parts (PC connection, AI assistant) folded at the bottom. Order, folding and
// wording per docs/DESIGN_LOG.md 2026-09-15 (Settings round 6).
import { conn } from "../../../core/api.js";

// Plain names for the plan's list sections, shown in "Your data".
const SECTION_NAMES = {
  accounts: "accounts", netWorthHistory: "net-worth snapshots", transactions: "transactions", income: "income sources",
  expenses: "expenses", budgets: "budgets", debts: "debts", goals: "goals", holdings: "holdings", property: "properties", scenarios: "scenarios",
};
const sectionName = (k) => SECTION_NAMES[k] ?? k.replace(/([A-Z])/g, " $1").toLowerCase();

// The shell re-renders the page after every store.update, which would wipe a "Saved."
// notice; so the message waits here and the next render shows it once.
let pending = null;

export function render(root, ctx) {
  const { ui, fmt, api, ai, store, features, modules, GROUPS, derived, plan } = ctx;
  const c = conn.load();

  // A notice that confirms in green or warns in red, replaced on every call. A confirmation
  // fades after a few seconds; errors stay until the next action.
  const out = () => {
    const host = ui.h("div", { class: "out" });
    host.say = (kind, text, flash = kind === "ok") => {
      host.innerHTML = "";
      if (!text) return;
      const n = ui.notice(kind, text); host.append(n);
      if (flash) setTimeout(() => { if (n.parentNode === host) n.remove(); }, 4000);
    };
    return host;
  };

  // ---- plan basics
  const basicsOut = out();
  root.append(ui.card("Plan basics", ui.form([
    { key: "name", label: "Plan name", type: "text" },
    { key: "currency", label: "Currency", type: "select", options: ["USD", "EUR", "MXN", "GBP", "CAD"] },
    { key: "locale", label: "Number and date format", type: "select", options: [{ value: "en-US", label: "English (US)" }, { value: "es-MX", label: "Español (México)" }, { value: "es-ES", label: "Español (España)" }] },
  ], plan.meta, (v) => { pending = { card: "basics", kind: "ok", text: "Saved." }; store.update((p) => Object.assign(p.meta, v)); }), basicsOut));
  if (pending?.card === "basics") { basicsOut.say(pending.kind, pending.text); pending = null; }

  // ---- pages: one fold per topic; a pill only when a page was switched by you or the PC
  const folds = [];
  for (const g of GROUPS) {
    const pages = [...modules.values()].filter((m) => m.group === g.id).sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
    if (!pages.length) continue;
    const status = ui.h("span", { class: "fold-status" });
    const setStatus = () => { const n = pages.filter((m) => features.enabled(m)).length; status.textContent = `${n} of ${pages.length} on`; };
    setStatus();
    folds.push(ui.h("details", { class: "fold" },
      ui.h("summary", {}, ui.h("span", { class: "fold-title" }, `${g.icon} ${g.title}`), status, ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
      ui.h("div", { class: "fold-body" }, pages.map((m) => {
        const key = features.key(m);
        const src = features.sourceOf(m);
        const cb = ui.h("input", { type: "checkbox", checked: features.enabled(m) ? true : null, onChange: (e) => { features.set(key, e.target.checked); setStatus(); } });
        return ui.h("label", { class: "toggle-row" }, cb, ui.h("span", { class: "toggle-text" }, `${m.icon ?? ""} ${m.title}`),
          src === "device" ? ui.h("span", { class: "pill" }, "changed on this device") : src === "properties" ? ui.h("span", { class: "pill" }, "set on the PC") : null);
      }))));
  }
  root.append(ui.card("Pages", ui.muted("Switch pages on or off for this device. Tap a topic to see its pages."), ui.h("div", { class: "folds" }, folds)));

  // ---- your data
  const dataOut = out();
  const fileIn = ui.h("input", { type: "file", accept: "application/json", style: { display: "none" } });
  const counts = derived.sections.filter((s) => s.count > 0).map((s) => `${s.count} ${sectionName(s.key)}`);
  root.append(ui.card("Your data",
    ui.muted(counts.length ? `${derived.updatedAt ? `Last changed ${fmt.date(derived.updatedAt)} · ` : ""}${counts.join(", ")} (${derived.sizeKB} KB).` : "No accounts or entries yet."),
    ui.row(
      ui.button("Download a copy", () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" })); a.download = `plan-${fmt.today()}.json`; a.click(); dataOut.say("ok", "A copy of your plan is downloading."); }, { class: "secondary" }),
      ui.button("Restore from a copy", () => fileIn.click(), { class: "secondary" }),
      ui.button("Erase the copy on this device", () => { if (ui.confirm("Erase the plan stored in this browser? The copy on the PC is untouched.")) { localStorage.removeItem("planner.plan"); location.reload(); } }, { class: "danger" }),
    ),
    fileIn, dataOut,
    ui.h("p", { class: "small muted", style: { marginTop: "10px" } }, "A copy is a plain file you can keep anywhere. Restoring replaces what is here with the file."),
  ));
  if (pending?.card === "data") { dataOut.say(pending.kind, pending.text); pending = null; }
  fileIn.addEventListener("change", async () => {
    const f = fileIn.files?.[0]; if (!f) return;
    try { const p = JSON.parse(await f.text()); if (!("schemaVersion" in p)) throw new Error("that file is not a plan copy"); if (ui.confirm(`Replace the current plan with ${f.name}?`)) { pending = { card: "data", kind: "ok", text: `Restored from ${f.name}.` }; store.replace(p); } }
    catch (e) { dataOut.say("error", `Could not restore: ${e.message}. Pick a file that was downloaded from this page.`, false); }
    fileIn.value = "";
  });

  // ---- PC connection (folded)
  const serverOut = out();
  const onPc = store.backend() === "server";
  root.append(ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("h2", {}, "PC connection"), ui.h("span", { class: "fold-status" }, onPc ? "Connected" : "Not connected"), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
    ui.h("div", { class: "fold-body" },
      ui.muted("Your plan is saved on your PC, which also does the heavy math. If you opened this page from the PC's own address, leave the address blank."),
      ui.form([
        { key: "serverUrl", label: "PC address", type: "text", placeholder: "http://192.168.1.50:8787", help: "blank = where this page came from" },
        { key: "token", label: "Access token", type: "text", help: "only if you set one up on the PC" },
      ], { serverUrl: c.serverUrl ?? "", token: c.token ?? "" }, (v) => { conn.save({ ...conn.load(), ...v }); serverOut.say("ok", "Saved. Reconnecting..."); }, { submitLabel: "Save" }),
      ui.row(ui.button("Test the connection", async () => {
        serverOut.say("info", "Testing...", false);
        const ok = await api.ready(); const h = api.health;
        if (ok) serverOut.say("ok", `Connected. Plan on the PC: ${h.plan ? "yes" : "not yet"}. AI: ${h.ai?.reachable ? "reachable" : "not reachable"}. Access token: ${h.authRequired ? "required" : "not needed"}.`, false);
        else serverOut.say("error", `Could not reach the PC at ${api.base() || "this address"}. Check the PC is on, the app is running on it, and the phone is on the same Wi-Fi.`, false);
      }, { class: "secondary" })),
      serverOut,
      ui.muted(onPc ? "Your plan is saved on the PC." : "Your plan is saved in this browser only."),
    )));

  // Once the PC answers: if it requires a token, say where to find it (design log 2026-09-15, pass 2).
  const tokenHelp = root.querySelector("input[name=token]")?.closest("label")?.querySelector(".help");
  const sayToken = () => { if (tokenHelp && api.health?.authRequired) tokenHelp.textContent = "Your PC asks for one. On the PC, run Show-Token to see it, then type it here once."; };
  sayToken(); if (!api.health) api.ready().then(sayToken).catch(() => {});

  // ---- AI assistant (folded)
  const aiOut = out();
  const aiStatus = ui.h("span", { class: "fold-status" }, "...");
  const aiBody = ui.h("div", { class: "fold-body" });
  root.append(ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("h2", {}, "AI assistant"), aiStatus, ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
    aiBody));
  ai.settings().then((s) => {
    const source = s.source === "properties" ? "Right now the PC's own AI settings are in use; these apply when the PC has none."
      : s.source === "device" ? "Right now the settings below are in use." : "Right now the built-in defaults are in use.";
    aiStatus.textContent = s.provider === "none" ? "Off" : `On${s.source === "properties" ? ", PC settings" : ""}`;
    aiBody.append(
      ui.muted(`The assistant answers questions in plain words and never does the math. ${source}`),
      ui.form([
        { key: "provider", label: "Assistant", type: "select", options: [{ value: "ollama", label: "Ollama on the PC" }, { value: "openai", label: "Another service (OpenAI-compatible)" }, { value: "none", label: "Off" }] },
        { key: "host", label: "Ollama address", type: "text", placeholder: "127.0.0.1" },
        { key: "port", label: "Ollama port", type: "number", placeholder: "11434" },
        { key: "model", label: "Model", type: "text", placeholder: "qwen3.5:9b" },
        { key: "baseUrl", label: "Service address (for another service)", type: "text", placeholder: "https://.../v1" },
        { key: "apiKey", label: "API key (for another service)", type: "text" },
      ], { ...(conn.load().ai ?? {}) }, (v) => { conn.save({ ...conn.load(), ai: v }); aiOut.say("ok", "Saved."); }, { submitLabel: "Save" }),
      ui.row(
        ui.button("Show available models", async () => { aiOut.say("info", "Asking...", false); try { const m = await ai.models(); aiOut.say(m.length ? "ok" : "warn", m.length ? `Available: ${m.join(", ")}` : "The assistant answered but has no models installed.", false); } catch (e) { aiOut.say("error", `Could not reach the assistant: ${e.message}`, false); } }, { class: "secondary" }),
        ui.button("Say hello", async () => { aiOut.say("info", "Thinking...", false); try { const r = await ai.chat([{ role: "user", content: "Reply with one short sentence confirming you are working." }]); aiOut.say("ok", `${r.model}: ${r.content}`, false); } catch (e) { aiOut.say("error", `Could not reach the assistant: ${e.message}`, false); } }, { class: "secondary" }),
      ),
      aiOut,
    );
  }).catch((e) => { aiStatus.textContent = "Unknown"; aiBody.append(ui.notice("error", `Could not read the AI settings: ${e.message}`)); });
}

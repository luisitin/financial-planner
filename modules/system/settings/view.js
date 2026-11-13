// modules/system/settings/view.js -- plan basics, how much to show, how this phone looks, page toggles, your data, then the
// technical parts (PC connection, AI assistant) folded at the bottom. Order, folding and
// wording per docs/DESIGN_LOG.md 2026-09-15 (Settings round 6); "How much to show" second, after
// Plan basics (docs/DESIGN_LOG.md 2026-11-13, docs/OPTIONAL.md "The two switches").
import { conn } from "../../../core/api.js";
import { howMuchCard, forgetShown } from "./show.js";
import { lookCard, forgetLook } from "./looks.js";
import { planShapeProblem } from "./compute.js";
import { emptyPlan } from "../../../core/schema/migrate.js";
import { aiHealth, healthWord, healthWords } from "../../ai/health.js";

// Plain names for the plan's list sections, shown in "Your data".
const SECTION_NAMES = {
  accounts: "accounts", netWorthHistory: "net-worth snapshots", transactions: "transactions", income: "income sources",
  expenses: "expenses", budgets: "budgets", debts: "debts", goals: "goals", holdings: "holdings", property: "properties", scenarios: "scenarios",
};
const SECTION_ONE = {
  accounts: "account", netWorthHistory: "net-worth snapshot", transactions: "transaction", income: "income source", expenses: "expense",
  budgets: "budget", debts: "debt", goals: "goal", holdings: "holding", property: "property", scenarios: "scenario",
};
const sectionName = (k, n = 2) => (n === 1 && SECTION_ONE[k]) || (SECTION_NAMES[k] ?? k.replace(/([A-Z])/g, " $1").toLowerCase());

// The shell re-renders the page after every store.update, which would wipe a "Saved."
// notice; so the message waits here and the next render shows it once.
let pending = null;
// the plan as it was before a restore, for the Undo on the green notice (this visit only; stress test F6)
let beforeRestore = null;

export function render(root, ctx) {
  const { ui, fmt, api, ai, store, features, modules, GROUPS, derived, plan, view } = ctx;
  const build = view.build;   // the household's view hides pages still to come and builder pages (core/view.js)
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

  // just erased (the page reloads to do it): say so once, with the way on (stress test F6, 2026-11-11)
  let erased = null;
  try { erased = sessionStorage.getItem("planner.erased"); sessionStorage.removeItem("planner.erased"); } catch { }
  if (erased === "only") root.append(ui.notice("ok", [ui.h("div", {}, "Your plan was erased from this device."), ui.row(ui.h("a", { class: "btn", href: "#/overview/start" }, "Start a new plan"))]));
  else if (erased === "sandbox") root.append(ui.notice("ok", [ui.h("div", {}, "The pretend plan was erased. Your real plan is not touched."), ui.row(ui.h("a", { class: "btn", href: "#/overview/start" }, "Start a new pretend plan"))]));
  else if (erased === "pc") root.append(ui.notice("ok", "This device's copy was erased. The plan on the PC is untouched."));

  // ---- plan basics
  const basicsOut = out();
  root.append(ui.card("Plan basics", ui.form([
    { key: "name", label: "Plan name", type: "text" },
    { key: "currency", label: "Currency", type: "select", options: ["USD", "EUR", "MXN", "GBP", "CAD"] },
    { key: "locale", label: "Number and date format", type: "select", options: [{ value: "en-US", label: "English (US)" }, { value: "es-MX", label: "Español (México)" }, { value: "es-ES", label: "Español (España)" }] },
  ], plan.meta, (v) => { pending = { card: "basics", kind: "ok", text: "Saved." }; store.update((p) => Object.assign(p.meta, v)); }), basicsOut));
  // just erased: the way on is the notice's "Start a new plan", the one filled button on the screen (review N5, 2026-11-11)
  if (erased === "only" || erased === "sandbox") root.lastElementChild.querySelector("button[type=submit]")?.classList.add("secondary");
  if (pending?.card === "basics") { basicsOut.say(pending.kind, pending.text); pending = null; }

  // ---- how much to show: second, after Plan basics; two ticks on this phone only (show.js, docs/OPTIONAL.md)
  root.append(howMuchCard(ctx));

  // ---- how this phone looks: third, one shut row; on this phone only (looks.js, core/look.js)
  root.append(lookCard(ctx));

  // ---- pages: one fold per topic; a pill only when a page was switched by you or the PC
  const folds = [];
  for (const g of GROUPS) {
    const pages = [...modules.values()].filter((m) => m.group === g.id && (build || (ctx.isReady(m) && !m.builderOnly))).sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
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
  const counts = derived.sections.filter((s) => s.count > 0).map((s) => `${s.count} ${sectionName(s.key, s.count)}`);
  root.append(ui.card("Your data",
    ui.muted(counts.length ? `${derived.updatedAt ? `Last changed ${fmt.date(derived.updatedAt)} · ` : ""}${counts.join(", ")} (${derived.sizeKB} KB).` : "No accounts or entries yet."),
    ui.row(
      ui.button("Download a copy", () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(plan, null, 2)], { type: "application/json" })); a.download = `plan-${fmt.today()}.json`; a.click(); dataOut.say("ok", "A copy of your plan is downloading."); }, { class: "secondary" }),
      ui.button("Restore from a copy", () => fileIn.click(), { class: "secondary" }),
      // through the store: in the sandbox only the pretend plan goes, and the waiting mark goes with the copy it names
      ui.button("Erase the copy on this device", () => {
        // the PC sentence only when a PC holds the plan; otherwise this is the only copy (stress test F6, design log 2026-11-06)
        const waiting = store.syncState().pending, onPc = store.backend() === "server";
        const ask = onPc
          ? (waiting ? "Erase the plan stored on this device? Your latest changes have not reached the PC yet, so they would be lost. The copy on the PC is untouched." : "Erase the plan stored on this device? The copy on the PC is untouched.")
          : store.sandbox() ? "Erase the pretend plan on this device? Your real plan is not touched."
          : "Erase your plan from this device? This is the only copy and it cannot be undone. Download a copy first if you may want it back.";
        if (!ui.confirm(ask)) return;
        try { sessionStorage.setItem("planner.erased", onPc ? "pc" : store.sandbox() ? "sandbox" : "only"); } catch { }
        forgetLook();    // how this phone looks goes too: amounts show again
        forgetShown();   // how much this phone shows goes too: both ticks and the rows kept open (the sandbox's own in the sandbox)
        store.eraseDevice(); location.reload();
      }, { class: "danger" }),
    ),
    fileIn, dataOut,
    ui.h("p", { class: "small muted", style: { marginTop: "10px" } }, "A copy is a plain file you can keep anywhere. Restoring replaces what is here with the file."),
  ));
  if (pending?.card === "data") {
    if (pending.undo && beforeRestore) {
      // the restore stays until the person leaves; Undo puts the plan back as it was
      const was = beforeRestore;
      dataOut.replaceChildren(ui.notice("ok", [ui.h("div", {}, pending.text), ui.row(ui.button("Undo", () => { beforeRestore = null; pending = { card: "data", kind: "ok", text: "Your plan is back as it was before the restore." }; store.replace(was); }, { class: "secondary" }))]));
    } else dataOut.say(pending.kind, pending.text);
    pending = null;
  }
  fileIn.addEventListener("change", async () => {
    const f = fileIn.files?.[0]; if (!f) return;
    let p = null;
    try { p = JSON.parse(await f.text()); } catch { p = null; }
    // a file with the right mark but the wrong shape (a list where a list belongs) is refused too (attack, 2026-11-11)
    if (!p || typeof p !== "object" || Array.isArray(p) || !("schemaVersion" in p) || planShapeProblem(p, emptyPlan())) { dataOut.say("error", "That file is not a copy made by this app. Pick a file you downloaded from this page (it is called plan- and a date, and ends in .json).", false); fileIn.value = ""; return; }
    const now = counts.length ? ` Your plan as it is now (${counts.slice(0, 3).join(", ")}${counts.length > 3 ? ", and more" : ""}) will be replaced.` : "";
    if (ui.confirm(`Replace your plan with ${f.name}?${now}`)) {
      beforeRestore = structuredClone(plan);
      pending = { card: "data", kind: "ok", text: `Restored from ${f.name}.`, undo: true };
      dispatchEvent(new Event("planner:erased"));   // typing kept for the plan being replaced goes with it (core/place.js forgetAll)
      store.replace(p);
    }
    fileIn.value = "";
  });

  // ---- PC connection (folded)
  const serverOut = out();
  const onPc = store.backend() === "server";
  const pcFold = ui.h("details", { class: "card fold fold-card" },
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
    ));
  root.append(pcFold);

  // Once the PC answers: if it requires a token, say where to find it (design log 2026-09-15, pass 2).
  const tokenHelp = root.querySelector("input[name=token]")?.closest("label")?.querySelector(".help");
  const sayToken = () => { if (tokenHelp && api.health?.authRequired) tokenHelp.textContent = "Your PC asks for one. On the PC, run Show-Token to see it, then type it here once."; };
  sayToken(); if (!api.health) api.ready().then(sayToken).catch(() => {});

  // ---- AI assistant (folded)
  const aiOut = out();
  const aiStatus = ui.h("span", { class: "fold-status" }, "...");
  const aiBody = ui.h("div", { class: "fold-body" });
  const aiFold = ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("h2", {}, "AI assistant"), aiStatus, ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
    aiBody);
  root.append(aiFold);
  ai.settings().then((s) => {
    const source = s.source === "properties" ? "Right now the PC's own AI settings are in use; these apply when the PC has none."
      : s.source === "device" ? "Right now the settings below are in use." : "Right now the built-in defaults are in use.";
    // the one-line status says whether it answers, not only whether it is switched on ("On" while nothing answered misled)
    const healthHost = ui.h("div");
    // the same check and words as Ask the plan (modules/ai/health.js): the model must be there, the advice fits the service
    const showHealth = (h) => {
      healthHost.innerHTML = "";
      aiStatus.textContent = healthWord(h);
      if (h.st === "on" || (h.st === "off" && h.source !== "properties")) return;
      const w = healthWords(h);
      healthHost.append(ui.notice("warn", `${w.why} ${w.todo} Everything else in the app works without it.`),
        h.st === "off" ? null : ui.row(ui.button("Try again", () => { aiStatus.textContent = "..."; aiHealth(ai).then(showHealth); }, { class: "secondary" })));
    };
    aiHealth(ai).then(showHealth);
    aiBody.append(healthHost,
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

  // ---- what is still being built (folded, last; core/view.js). Off by default: the household's view shows only what works.
  const viewStatus = ui.h("span", { class: "fold-status" }, build ? "On" : "Off");
  const viewBox = ui.h("input", { type: "checkbox", checked: build ? true : null, onChange: (e) => { view.set(e.target.checked); } });
  const viewBody = ui.h("div", { class: "fold-body" },
    ui.h("label", { class: "toggle-row" }, viewBox, ui.h("span", { class: "toggle-text" }, "Show what is still being built: coming-soon pages, build progress and developer pages")),
    ui.muted("Off is the everyday view: only pages that work. On is for whoever is building the app."));
  if (build) {
    root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "What is still being built"), viewStatus, ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")), viewBody));
  } else {
    // the household's view: the technical parts (connecting a PC, the AI helper, this switch) sit together in one fold, last
    const inner = (node) => { node.className = "fold"; return node; };
    const advanced = ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "Advanced"), ui.h("span", { class: "fold-status" }, "Not needed day to day"), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
      ui.h("div", { class: "fold-body" }, inner(pcFold), inner(aiFold),
        inner(ui.h("details", {}, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "What is still being built"), viewStatus, ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")), viewBody))));
    root.append(advanced);
  }
}

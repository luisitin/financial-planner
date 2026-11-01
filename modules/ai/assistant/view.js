// modules/ai/assistant/view.js -- DOM only. A plain chat over a short summary of the plan.
// The model never sees the raw numbers and is told not to do arithmetic (compute.js).
import { SYSTEM_PROMPT, pagesContext } from "./compute.js";
import { aiHealth, healthWords } from "../health.js";

const EXAMPLES = ["What should I do first?", "Is my emergency fund big enough?", "Which page shows what I spend?", "How do I add my mortgage?"];

// The model answers with light formatting; render bold, italic, bullet lists and paragraphs,
// nothing else (design log 2026-09-15, pass 2). Everything is escaped first.
function formatAnswer(text) {
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>");
  const out = [];
  let list = null;
  for (const raw of String(text ?? "").split(/\r?\n/)) {
    const line = raw.trim();
    const m = /^(?:[-*\u2022]|\d+[.)])\s+(.*)$/.exec(line);
    if (m) { if (!list) { list = []; out.push(list); } list.push(inline(m[1])); continue; }
    list = null;
    if (line) out.push(inline(line));
  }
  return out.map((x) => Array.isArray(x) ? `<ul>${x.map((li) => `<li>${li}</li>`).join("")}</ul>` : `<p>${x}</p>`).join("");
}

export function render(root, ctx) {
  const { ui, ai, derived } = ctx;
  const history = [];
  let busy = false;

  const log = ui.h("div", { class: "chat" });
  const box = ui.h("textarea", { rows: 2, placeholder: "Ask in your own words...", "aria-label": "Your question" });
  const sendBtn = ui.button("Send", () => send());
  const statusHost = ui.h("div");
  const add = (role, content) => {
    const el = ui.h("div", { class: `msg ${role}` });
    if (role === "assistant") el.innerHTML = formatAnswer(content); else el.textContent = content;
    log.append(el); log.scrollTop = log.scrollHeight;
    el.scrollIntoView({ behavior: "smooth", block: "nearest" });
    compact();
  };
  // After the first question the intro shrinks to one line and the suggestions fold.
  let compacted = false;
  const compact = () => {
    if (compacted) return; compacted = true;
    hero.replaceChildren(ui.h("p", { class: "muted small", style: { margin: 0 } }, "Ask the plan \u00b7 runs on your PC \u00b7 not a licensed advisor"));
    hero.classList.remove("hero");
    chipsFold.replaceChildren(ui.h("details", { class: "fold" }, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Suggestions"), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "\u203a")), ui.h("div", { class: "fold-body" }, chips)));
  };
  const setStatus = (kind, text) => { statusHost.innerHTML = ""; if (text) statusHost.append(ui.notice(kind, text)); };
  // When the AI helper is off or not answering, say so in plain words once, offer the plan's own answers, and keep the
  // question buttons from failing one by one (they used to answer "did not answer: Failed to fetch").
  let down = false;
  // h: aiHealth's answer (modules/ai/health.js), or null when the helper answers
  const setDown = (h, detail) => {
    down = !!h;
    sendBtn.disabled = down; box.disabled = down;
    // nothing to tap that cannot work: the suggestions and the question box step aside while the helper is down
    for (const el of [chipsFold, askForm, sendRow]) el.style.display = down ? "none" : "";   // .form and .row set their own display, so not [hidden]
    if (!down) { setStatus(null, ""); return; }
    const w = healthWords(h), why = detail ?? h.detail;
    statusHost.innerHTML = "";
    statusHost.append(ui.notice("warn", `${w.why} ${w.todo} Everything else in the app works without it, and your plan's own answers are one tap away.`),
      ui.row(ui.h("a", { class: "btn", href: "#/overview/quick" }, "See your plan's own answers"),
        h.st === "off" && w.settingsHelp ? ui.h("a", { class: "btn secondary", href: "#/system/settings" }, "AI settings") : h.st === "off" ? null : ui.button("Try again", () => check(), { class: "secondary" })),
      ...(why ? [ui.h("details", { class: "fold" }, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Show details"), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "\u203a")), ui.h("div", { class: "fold-body muted small" }, why))] : []));
  };
  let health = null;
  const check = () => { setStatus("info", "Checking the AI helper..."); return aiHealth(ai).then((h) => { health = h; setDown(h.st === "on" ? null : h); }); };

  async function send(question) {
    const q = (question ?? box.value).trim();
    if (!q || busy) return;
    busy = true; sendBtn.disabled = true; sendBtn.textContent = "Thinking...";
    box.value = ""; add("user", q); history.push({ role: "user", content: q });
    setStatus("info", "Thinking... the assistant runs on your PC, so this can take a few seconds.");
    try {
      const r = await ai.chat([{ role: "system", content: `${SYSTEM_PROMPT}\n\n${pagesContext(ctx.modules)}\n\nPLAN CONTEXT:\n${derived.summary}` }, ...history]);
      history.push({ role: "assistant", content: r.content }); add("assistant", r.content);
      setStatus(null, "");
    } catch (e) {
      history.pop();
      busy = false; sendBtn.textContent = "Send";
      // look again: if the helper is down, say why; if it is up and only this answer failed, keep the box and the question
      const h = await aiHealth(ai);
      if (h.st !== "on") { setDown(h, e?.message); return; }
      sendBtn.disabled = false; box.value = q;
      log.lastElementChild?.classList.contains("user") && log.lastElementChild.remove();   // the question goes back to the box, not twice in the chat
      setStatus("error", `The AI helper did not answer this one (${e?.message ?? "no reason given"}). Your question is back in the box: send it again, or try a shorter one.`);
      return;
    }
    busy = false; sendBtn.disabled = false; sendBtn.textContent = "Send";
    box.focus();
  }
  box.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });


  const hero = ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Ask the plan"),
    ui.h("p", { class: "lede" }, "Ask anything about your plan in your own words. The assistant only sees a short summary of your numbers and never does the math itself: for figures it points you to the page that has them."),
    ui.h("p", { class: "muted small" }, "It runs on your PC. It is not a licensed advisor."),
  );
  root.append(hero);
  const chips = ui.h("div", { class: "chips" }, EXAMPLES.map((q) => ui.h("button", { type: "button", class: "chip", onClick: () => send(q) }, q)));
  const chipsFold = ui.h("div", {}, ui.h("p", { class: "muted small" }, "Try one of these, or type your own:"), chips);
  const askForm = ui.h("div", { class: "form" }, ui.field("Your question", box, "Enter sends; Shift+Enter makes a new line"));
  const sendRow = ui.row(sendBtn);
  root.append(ui.card(null,
    chipsFold,
    log,
    statusHost,
    askForm,
    sendRow,
  ));
  root.append(ui.h("style", {}, ".msg p { margin: 0 0 8px; } .msg p:last-child { margin: 0; } .msg ul { margin: 0 0 8px; padding-left: 18px; }"));
  check().then(() => { if (!down) setStatus(null, ""); });
}

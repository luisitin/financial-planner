// modules/ai/assistant/view.js -- DOM only. A plain chat over a short summary of the plan.
// The model never sees the raw numbers and is told not to do arithmetic (compute.js).
import { SYSTEM_PROMPT, pagesContext } from "./compute.js";

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
      setStatus("error", `The assistant did not answer: ${e.message}. Check the AI section in Settings, then try again.`);
    }
    busy = false; sendBtn.disabled = false; sendBtn.textContent = "Send";
    box.focus();
  }
  box.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });

  ai.status().then((s) => { if (s === "off") setStatus("warn", "The AI is turned off. Turn it on in Settings (AI assistant) to ask questions."); else if (!String(s).startsWith("on")) setStatus("warn", `The AI is ${s}. Check the AI section in Settings.`); }).catch(() => { });

  const hero = ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Ask the plan"),
    ui.h("p", { class: "lede" }, "Ask anything about your plan in your own words. The assistant only sees a short summary of your numbers and never does the math itself: for figures it points you to the page that has them."),
    ui.h("p", { class: "muted small" }, "It runs on your PC. It is not a licensed advisor."),
  );
  root.append(hero);
  const chips = ui.h("div", { class: "chips" }, EXAMPLES.map((q) => ui.h("button", { type: "button", class: "chip", onClick: () => send(q) }, q)));
  const chipsFold = ui.h("div", {}, ui.h("p", { class: "muted small" }, "Try one of these, or type your own:"), chips);
  root.append(ui.card(null,
    chipsFold,
    log,
    statusHost,
    ui.h("div", { class: "form" }, ui.field("Your question", box, "Enter sends; Shift+Enter makes a new line")),
    ui.row(sendBtn),
  ));
  root.append(ui.h("style", {}, ".msg p { margin: 0 0 8px; } .msg p:last-child { margin: 0; } .msg ul { margin: 0 0 8px; padding-left: 18px; }"));
}

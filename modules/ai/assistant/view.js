// modules/ai/assistant/view.js -- DOM only. A plain chat over a short summary of the plan.
// The model never sees the raw numbers and is told not to do arithmetic (compute.js). When a reply names one change
// (gap design #39), a card under it says what the change is and what it does, both worked out by the app (compute.js
// propose); Apply (outlined) makes it in one store.update, then a green line with Undo; No thanks closes the card and writes
// nothing. A reply that names no change looks exactly as it did before. A change the app cannot try, or cannot check yet, is
// said in one quiet line with its next step and no buttons.
import { systemFor, pagesContext, changesContext, readReply, propose, applyProposal, answerFor, doneWords, TRUST_WORDS, UNDONE_WORDS, PAGES, WHERE, LATER_WORDS } from "./compute.js";
import { tone } from "./tone.js";
import { aiHealth, healthWords } from "../health.js";
import { part } from "../../../core/ui/more.js";

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
    const m = /^(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
    if (m) { if (!list) { list = []; out.push(list); } list.push(inline(m[1])); continue; }
    list = null;
    if (line) out.push(inline(line));
  }
  return out.map((x) => Array.isArray(x) ? `<ul>${x.map((li) => `<li>${li}</li>`).join("")}</ul>` : `<p>${x}</p>`).join("");
}

/**
 * This visit's chat, in memory only: the questions, the answers and each change card's state outlive the redraw the shell
 * makes after the plan changes (Apply, Undo, a save from another device), and start afresh on a new arrival at the page
 * (the shell hands the page a new route object then; a redraw keeps the same one). Never stored, never in the plan.
 */
let chat = null;
const chatFor = (route) => (chat && chat.route === route ? chat : (chat = { route, history: [], items: [], health: null, why: null, busy: false, top: null, show: null, view: null, ctx: null }));
const later = (fn) => (typeof requestAnimationFrame === "function" ? requestAnimationFrame(fn) : setTimeout(fn, 0));

/** The technical part of "Show details" when the helper is down: what it said, which helper, which model, set where. */
function techRows(ui, h, why) {
  const helper = h.provider === "openai" ? "another AI service" : h.provider === "none" ? "none: it is turned off" : "Ollama, on your computer";
  const where = h.source === "properties" ? "the settings file on the computer that runs the app" : h.source === "device" ? "Settings, on this device" : "nothing yet: the usual settings";
  const li = (label, text) => ui.h("li", {}, `${label}: ${text}`);
  return ui.h("ul", { class: "muted small", style: { margin: "0", paddingLeft: "18px", overflowWrap: "anywhere" } },
    li("What it said", why), li("Which helper", helper), li("Model", h.model || "none chosen yet"), li("Set in", where));
}

export function render(root, ctx) {
  const { ui } = ctx;
  const s = chatFor(ctx.route);
  s.ctx = ctx;
  const today = ctx.fmt?.today?.() ?? null;

  const log = ui.h("div", { class: "chat" });
  log.addEventListener?.("scroll", () => { s.top = log.scrollTop; });
  const box = ui.h("textarea", { rows: 2, placeholder: "Ask in your own words...", "aria-label": "Your question" });
  const sendBtn = ui.button(s.busy ? "Thinking..." : "Send", () => send());
  if (s.busy) sendBtn.disabled = true;
  const statusHost = ui.h("div");
  const nodes = new Map();   // item -> its card on this drawing
  const drawItem = (it) => {
    if (it.text) {
      const el = ui.h("div", { class: `msg ${it.role}` });
      if (it.role === "assistant") el.innerHTML = formatAnswer(it.text); else el.textContent = it.text;
      log.append(el);
    }
    const c = it.card ? cardFor(it) : null;
    if (c) { log.append(c); nodes.set(it, c); }
    return c;
  };
  const add = (it) => {
    s.items.push(it);
    const before = log.lastElementChild;
    drawItem(it);
    const el = log.lastElementChild;
    if (el && el !== before) { log.scrollTop = log.scrollHeight; el.scrollIntoView?.({ behavior: "smooth", block: "nearest" }); }
    compact();
  };

  // ---- the change a reply names (gap design #39): worked out again from the plan as it is at every drawing
  // a page named in a sentence is the link itself ("... on the People page ..."); otherwise the link follows the sentence
  const go = (key) => (PAGES[key] ? ui.h("a", { href: PAGES[key].href }, `${PAGES[key].title}\u00a0›`) : null);
  const linked = (text, key) => {
    const pg = PAGES[key], at = pg ? text.indexOf(pg.title) : -1;
    if (!pg) return [text];
    if (at < 0) return [text, " ", go(key)];
    return [text.slice(0, at), ui.h("a", { href: pg.href }, pg.title), text.slice(at + pg.title.length)];
  };
  const cardFor = (it) => {
    const c = it.card;
    if (c.st === "closed") return null;
    if (c.st === "applied" || c.st === "undone") {
      const opts = c.st === "applied" ? { undo: c.undo, undone: (r) => { c.st = "undone"; c.words = ui.undoneWords(r, UNDONE_WORDS); s.show = it; ctx.redraw?.(); } } : {};
      // Undo lives in this visit's memory: say so, and where the figure can be changed once it has gone
      const later = c.st === "applied" && WHERE[c.lever] ? ui.h("p", { class: "muted small", style: { margin: "4px 0 0" } }, `${LATER_WORDS} `, go(WHERE[c.lever])) : null;
      return ui.h("div", { dataset: { change: c.st } }, ui.h("p", { class: "muted small", style: { margin: "8px 0 0" } }, c.change), ui.notice("ok", c.words, opts), later);
    }
    // a plan the page cannot read (malformed data) draws no card rather than stopping the chat
    let p = null;
    try { p = propose(ctx.store.get(), c.asked, { today }); } catch { p = null; }
    if (!p) return null;
    if (p.refused || p.already) return ui.h("p", { class: "muted small", dataset: { change: p.refused ? "refused" : "already" } }, ...linked(p.refused ?? p.already, p.go));
    // the plan cannot be run yet: the change, why nothing could be checked and where to start; nothing to apply
    if (p.basics) return ui.h("div", { class: "notice ask-change", dataset: { change: "basics" } }, ui.h("p", {}, ui.h("strong", {}, p.change)), ui.h("p", {}, ...linked(p.effect, p.go)));
    const card = ui.h("div", { class: "notice ask-change", dataset: { change: "open" } },
      ui.h("p", {}, ui.h("strong", {}, p.change)),
      ui.h("p", {}, p.effect),
      p.note ? ui.h("p", { class: "small" }, p.note) : null,
      ui.h("p", { class: "muted small" }, TRUST_WORDS),
      ui.row(
        ui.button("Apply", () => apply(it, p), { class: "secondary" }),
        ui.button("No thanks", () => { c.st = "closed"; card.remove(); }, { class: "secondary" })));
    return card;
  };
  // one store.update; the green line names the new answer and carries Undo (the shell redraws after the update)
  const apply = (it, p) => {
    const c = it.card;
    const undo = ui.undoable(ctx.store, (d) => { applyProposal(d, p, { today }); });
    if (!undo) { ctx.redraw?.(); return; }   // the plan has it already (changed meanwhile elsewhere): drawn again, the card says so
    Object.assign(c, { st: "applied", undo, lever: p.lever, change: p.change, words: doneWords(answerFor(ctx.store.get(), { today })) });
    s.show = it;
    ctx.redraw?.();
  };

  // After the first question the intro shrinks to one line and the suggestions fold (design log 2026-09-15, round 7).
  const compact = () => {
    if (hero.dataset.compact) return;
    hero.dataset.compact = "1";
    hero.replaceChildren(ui.h("p", { class: "muted small", style: { margin: 0 } }, "Ask the plan · runs on your computer · not a licensed advisor"));
    hero.classList.remove("hero");
    chipsFold.replaceChildren(part(ctx, { id: "suggestions", kind: "item", title: "Suggestions", body: chips }));
  };
  const setStatus = (kind, text) => { statusHost.innerHTML = ""; if (text) statusHost.append(ui.notice(kind, text)); };
  const sending = (on) => { sendBtn.disabled = on || down; sendBtn.textContent = on ? "Thinking..." : "Send"; };
  // When the AI helper is off or not answering, say so in plain words once, offer the plan's own answers, and keep the
  // question buttons from failing one by one (they used to answer "did not answer: Failed to fetch").
  let down = false;
  // h: aiHealth's answer (modules/ai/health.js), or null when the helper answers
  const setDown = (h, detail) => {
    down = !!h;
    sendBtn.disabled = down || s.busy; box.disabled = down;
    // nothing to tap that cannot work: the suggestions and the question box step aside while the helper is down
    for (const el of [chipsFold, askForm, sendRow]) el.style.display = down ? "none" : "";   // .form and .row set their own display, so not [hidden]
    if (!down) { setStatus(null, ""); return; }
    const w = healthWords(h), why = detail ?? h.detail;
    statusHost.innerHTML = "";
    statusHost.append(ui.notice("warn", `${w.why} ${w.todo} Everything else in the app works without it, and your plan's own answers are one tap away.`),
      ui.row(ui.h("a", { class: "btn", href: "#/overview/quick" }, "See your plan's own answers"),
        h.st === "off" && w.settingsHelp ? ui.h("a", { class: "btn secondary", href: "#/system/settings" }, "AI settings") : h.st === "off" ? null : ui.button("Try again", () => check(), { class: "secondary" })));
    if (why) statusHost.append(part(ctx, { id: "why", kind: "tech", body: techRows(ui, h, why) }));
  };
  const check = () => { setStatus("info", "Checking the AI helper..."); return aiHealth(ctx.ai).then((h) => { s.health = h; s.why = null; setDown(h.st === "on" ? null : h); }); };

  async function send(question) {
    const v = s.view;
    const q = (question ?? v.box.value).trim();
    if (!q || s.busy) return;
    s.busy = true; v.sending(true);
    v.box.value = ""; v.add({ role: "user", text: q }); s.history.push({ role: "user", content: q });
    v.setStatus("info", "Thinking... the assistant runs on your computer, so this can take a few seconds.");
    let r;
    try {
      const c = s.ctx;   // the newest drawing's: its summary is of the plan as it is now (after an Apply, too)
      // the tone this device chose (Settings > How the helper talks to you): only the words the model is told; Plain adds nothing
      r = await c.ai.chat([{ role: "system", content: systemFor({ summary: c.derived.summary, changes: changesContext(c.store.get()), pages: pagesContext(c.modules), tone: tone.chosen }) }, ...s.history]);
    } catch (e) {
      s.history.pop();
      s.busy = false;
      // look again: if the helper is down, say why; if it is up and only this answer failed, keep the box and the question
      const h = await aiHealth(s.ctx.ai);
      const w = s.view;
      w.sending(false);
      if (h.st !== "on") { s.health = h; s.why = e?.message ?? null; w.setDown(h, e?.message); return; }
      w.box.value = q;
      if (s.items.at(-1)?.role === "user") { s.items.pop(); w.dropLastUser(); }   // the question goes back to the box, not twice in the chat
      w.setStatus("error", `The AI helper did not answer this one (${e?.message ?? "no reason given"}). Your question is back in the box: send it again, or try a shorter one.`);
      return;
    }
    s.history.push({ role: "assistant", content: r.content });
    const read = readReply(r.content);
    const w = s.view;
    w.add({ role: "assistant", text: read.text, card: read.asked ? { st: "open", asked: read.asked } : null });
    w.setStatus(null, "");
    s.busy = false; w.sending(false);
    w.box.focus();
  }
  box.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });


  const hero = ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Ask the plan"),
    ui.h("p", { class: "lede" }, "Ask anything about your plan in your own words. The assistant only sees a short summary of your numbers and never does the math itself: for figures it points you to the page that has them."),
    ui.h("p", { class: "muted small" }, "It runs on your computer. It is not a licensed advisor."),
  );
  root.append(hero);
  const chips = ui.h("div", { class: "chips" }, EXAMPLES.map((q) => ui.h("button", { type: "button", class: "chip", onClick: () => send(q) }, q)));
  const chipsFold = ui.h("div", {}, ui.h("p", { class: "muted small" }, "Try one of these, or type your own:"), chips);
  const askForm = ui.h("div", { class: "form" }, ui.field("Your question", box, "Enter sends; Shift+Enter makes a new line"));
  const sendRow = ui.row(sendBtn);
  root.append(ui.h("section", { class: "card", dataset: { ask: "" } },
    chipsFold,
    log,
    statusHost,
    askForm,
    sendRow,
  ));
  root.append(ui.h("style", {}, ".msg p { margin: 0 0 8px; } .msg p:last-child { margin: 0; } .msg ul { margin: 0 0 8px; padding-left: 18px; } [data-ask] .ask-change p { margin: 0 0 8px; } [data-ask] .ask-change .row { margin-top: 4px; }"));

  // this drawing is the one the chat writes to from now on (a reply that arrives after a redraw lands here)
  s.view = { box, add, setStatus, sending, setDown: (h, d) => setDown(h, d), dropLastUser: () => { if (log.lastElementChild?.classList.contains("user")) log.lastElementChild.remove(); } };
  for (const it of s.items) drawItem(it);
  if (s.items.length) compact();
  // the chat's own scroll: the card just applied or undone in sight, else where the person left it
  if (s.items.length) later(() => {
    const el = s.show ? nodes.get(s.show) : null;
    s.show = null;
    if (el) el.scrollIntoView?.({ block: "nearest" });
    else if (s.top !== null) log.scrollTop = s.top;
    else log.scrollTop = log.scrollHeight;
  });
  // a redraw (after Apply, Undo, a save elsewhere) knows the helper's state already: no "Checking..." flash
  if (s.health) setDown(s.health.st === "on" ? null : s.health, s.why ?? undefined);
  else check().then(() => { if (!down) setStatus(null, ""); });
  if (s.busy && !down) setStatus("info", "Thinking... the assistant runs on your computer, so this can take a few seconds.");
}

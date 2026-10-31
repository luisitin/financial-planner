// modules/ai/explain/view.js -- DOM only. "Explain a page": pick a page (or arrive from #/ai/explain/<group>/<id>), and
// the AI helper explains its numbers in plain words. The page's own compute runs on a copy of the plan with people
// called Adult 1, Adult 2... and accounts by their kind (every line is shown in the fold before you ask); the answer
// comes back with the real names put back, is labelled as not checked, and is never saved.
// One question at a time, about the page picked when it was asked (the page list is locked until it answers); the
// answer waits in module state and shows on the next render; a render that is no longer on screen never redraws.
import { compute, explainable, sheetFor, buildMessages, readAnswer } from "./compute.js";

let picked = null;    // the page chosen ("group/id")
let lastRoute = null; // the address seen last time: each arrival is a new route object and picks its page again
let question = "";    // kept while the app is open
let result = null;    // { key, at, text, model, question }
let pending = null;   // { kind: "off" | "no models" | "unreachable" | "error" | "blank" | "empty" | "page", detail, source }
let inflight = null;
let phase = "";       // "checking" | "reading"
let shown = 0;
let live = null;      // the render on screen: { btn, select, hint, title }
let foldOpen = false;
let fresh = false;     // an answer just came: bring it into view once

const CHAT_OPTIONS = { options: { num_ctx: 8192 } };
const WAITING = { checking: "Checking the AI helper…", reading: "Reading the page…" };
const STYLE = `
.ex-root .ex-facts { margin: 8px 0 0; padding-left: 18px; font-size: var(--fs-sm); color: var(--text-2); }
.ex-root .ex-facts li { margin: 4px 0; overflow-wrap: anywhere; }
.ex-root .ex-facts li.ex-sub { list-style: none; margin-left: 12px; }
.ex-root .ex-answer p { margin: 0 0 10px; overflow-wrap: anywhere; white-space: pre-line; }
.ex-root .ex-answer ul, .ex-root .ex-answer ol { margin: 0 0 10px; padding-left: 22px; }
.ex-root .ex-answer li { margin: 4px 0; overflow-wrap: anywhere; white-space: pre-line; }
.ex-root .ex-answer li > ul, .ex-root .ex-answer li > ol { margin: 4px 0 0; }
.ex-root .notice p { margin: 0 0 8px; overflow-wrap: anywhere; }
.ex-root .notice-details summary { min-height: 44px; }
.ex-root select { width: 100%; }
.ex-root .ex-result { scroll-margin-top: calc(var(--topbar) + 12px); }
`;

function setButton() {
  if (!live) return;
  live.btn.disabled = live.select.disabled = !!phase;   // the page asked about stays the page on screen
  live.btn.textContent = phase ? WAITING[phase] : `Explain “${live.title}”`;
  live.hint.hidden = phase !== "reading";
}

export function render(page, ctx) {
  const me = ++shown;
  const leave = () => { shown++; };
  const { ui, fmt, plan, ai, modules, features, route, GROUPS } = ctx;
  const root = ui.h("div", { class: "ex-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const d = compute(plan);

  root.append(ui.h("section", { class: "card" }, ui.h("h1", {}, "Explain a page"),
    ui.h("p", { class: "lede" }, "Pick a page and the AI helper explains its numbers in plain words: what the page shows, what the numbers mean for you, and what is worth noticing. You can also ask your own question about it.")));
  if (!d.ready) {
    live = null;
    root.append(ui.card("Nothing to explain yet", ui.h("p", { class: "muted" }, "The pages have no numbers until your plan has something in it. Start with the people in your household, then add an account or what you earn."),
      ui.row(ui.h("a", { class: "btn", href: "#/household/people" }, "Add the people"))));
    return leave;
  }

  const enabled = (m) => features?.enabled?.(m) ?? true;
  const pages = explainable([...(modules?.values?.() ?? [])].filter(enabled).map((m) => ({ key: `${m.group}/${m.id}`, group: m.group, title: m.title, purpose: m.purpose, status: m.status, hasCompute: typeof m.compute === "function" })));
  const byKey = new Map(pages.map((p) => [p.key, p]));
  // a new arrival (also Back, or the same link again) picks the page in the address; a redraw of this page keeps the pick
  if (route !== lastRoute) { lastRoute = route; const rest = (route?.rest ?? []).join("/"); if (byKey.has(rest)) picked = rest; }
  if (!byKey.has(picked)) picked = byKey.has("balance/net-worth") ? "balance/net-worth" : pages[0]?.key ?? null;
  const chosen = byKey.get(picked) ?? null;   // this render's page: the fold and the question both use it
  const at = plan.meta?.updatedAt ?? "";
  const today = fmt.today();

  // the page list, by topic in the menu's order; a pick goes into the address so Back and reload come back to it
  const groupLabel = (g) => (GROUPS ?? []).find((x) => x.id === g)?.title ?? g;
  const order = (g) => { const i = (GROUPS ?? []).findIndex((x) => x.id === g); return i < 0 ? 999 : i; };
  const groups = [...new Set(pages.map((p) => p.group))].sort((a, b) => order(a) - order(b));
  const select = ui.h("select", { "aria-label": "Which page", onChange: (e) => { picked = e.target.value; foldOpen = false; pending = null; globalThis.history?.replaceState(null, "", `#/ai/explain/${picked}`); redraw(); } },
    groups.map((g) => ui.h("optgroup", { label: groupLabel(g) }, pages.filter((p) => p.group === g).sort((a, b) => a.title.localeCompare(b.title)).map((p) => ui.h("option", { value: p.key, selected: p.key === picked || null }, p.title)))));
  const ask = ui.h("textarea", { rows: 2, placeholder: "For example: is this good for us?", "aria-label": "Your question", onInput: (e) => { question = e.target.value; } });
  ask.value = question;
  const btn = ui.button("Explain", () => go());
  const hint = ui.h("p", { class: "muted small", hidden: true }, "This can take a minute or two.");
  live = { btn, select, hint, title: chosen?.title ?? "" };
  setButton();
  const status = ui.h("div", {});

  // what the AI will read, built when the fold opens or when asking
  let sheet = null;
  const getSheet = () => (sheet ??= sheetFor(plan, (copy) => modules.get(chosen.key).compute(copy, { today }), { today }));
  const foldBody = ui.h("div", { class: "fold-body" });
  const fold = ui.h("details", { class: "fold" }, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "What the AI will read"), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")), foldBody);
  fold.addEventListener("toggle", () => {
    foldOpen = fold.open;
    if (!fold.open || foldBody.childElementCount) return;
    const s = getSheet();
    const key = s.names.filter((n) => n.kind === "person").map((n) => `${n.alias} is ${n.name}`);
    foldBody.append(
      ui.h("p", { class: "muted small" }, "This is everything the AI gets about the page, word for word, plus the page's name and short description, your question and the app's rules for the AI. It is in the app's shorthand: amounts are dollars without the $ sign, and 0.12 means 12%."),
      ui.h("p", { class: "muted small" }, "People's names are swapped for Adult 1, Adult 2, Child 1, and accounts are called by their kind and a number (“credit card 1”, “mortgage 1”). Your notes, phone numbers and where you keep papers are never sent."),
      // the one gap (README, edge cases): a name the plan does not list anywhere else cannot be spotted, so it goes as typed
      ui.h("p", { class: "muted small" }, "A name the app does not know goes as you typed it: a friend's first name or an employer in the name of a goal, an income, an expense or a category. If you see one below, rename it on its page first."),
      key.length ? ui.h("p", { class: "small" }, `In the lines below, ${key.join(", ")}. These real names are not sent.`) : null,
      // a list of records comes as "  1. ...": those lines sit under the line that names the list, without a bullet
      s.lines.length ? ui.h("ul", { class: "ex-facts" }, s.lines.map((l) => (l.startsWith("  ") ? ui.h("li", { class: "ex-sub" }, l.trim()) : ui.h("li", {}, l)))) : ui.h("p", { class: "muted small" }, "Nothing: this page has no numbers yet."));
  });
  if (foldOpen) fold.open = true;

  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "Which page?"),
    ui.field("Page", select),
    chosen?.purpose ? ui.h("p", { class: "muted small" }, chosen.purpose) : null,
    ui.field("Your question", ask, "Leave it empty to hear what the page tells you."),
    ui.row(btn), hint, status, ui.h("div", { class: "folds" }, fold)));

  const redraw = () => { if (me === shown) { root.remove(); render(page, ctx); } };
  if (inflight) inflight.finally(redraw);

  function go() {
    if (inflight || !chosen) return;
    pending = null; status.replaceChildren();
    phase = "checking"; setButton();
    const asked = chosen, q = question.trim();
    inflight = (async () => {
      let st = "unreachable";
      try { st = String(await ai.status()); } catch { /* not answering */ }
      if (!st.startsWith("on")) {
        // turned off on the PC itself (its settings win over this device's) or here: the way back on differs
        let source = "";
        if (st === "off") try { source = (await ai.settings()).source; } catch { /* the general words */ }
        pending = { kind: st === "off" || st === "no models" ? st : "unreachable", source };
        return;
      }
      phase = "reading"; setButton();
      await new Promise((r) => setTimeout(r, 0));   // let "Reading…" show before a heavy page's numbers are worked out
      const s = getSheet();
      if (!s.ok) { pending = { kind: s.why === "error" ? "page" : "empty" }; return; }
      try {
        const r = await ai.chat(buildMessages({ title: asked.title, purpose: asked.purpose, lines: s.lines, question: q, terms: s.terms }), CHAT_OPTIONS);
        const text = readAnswer(r?.content, s.names);
        if (!text) { pending = { kind: "blank" }; return; }
        result = { key: asked.key, at, text, model: r?.model ?? "", question: q };
        fresh = true;
      } catch (e) {
        console.warn("[ai/explain] the AI did not answer", e);
        pending = { kind: "error", detail: String(e?.message ?? e).slice(0, 200) };
      }
    })().finally(() => { inflight = null; phase = ""; });
    inflight.finally(redraw);
  }

  if (pending) { status.append(message(ui, pending, chosen)); pending = null; }
  if (!result || result.key !== picked) return leave;
  const title = byKey.get(result.key)?.title ?? result.key;
  // the "not checked" label comes first: an answer can run to several phone screens
  const card = ui.h("section", { class: "card ex-result" }, ui.h("h2", {}, `What the AI says about “${title}”`),
    ui.h("p", { class: "muted small" }, "Written by the AI and not checked by the app. The numbers on the page itself are the ones to trust."),
    result.at !== at ? ui.notice("info", "Your plan has changed since the AI looked. Ask again to see what it says now.") : null,
    result.question ? ui.h("p", { class: "muted small" }, `You asked: ${result.question}`) : null,
    ui.h("div", { class: "ex-answer" }, answerBlocks(ui, result.text)),
    ui.row(ui.h("a", { class: "btn secondary", href: `#/${result.key}` }, `Open “${title}”`)),
    result.model ? ui.h("details", { class: "notice-details" }, ui.h("summary", {}, "For whoever set up the AI"), ui.h("p", { class: "muted small" }, `Written by the AI model ${result.model}.`)) : null);
  root.append(card);
  if (fresh) { fresh = false; requestAnimationFrame(() => card.scrollIntoView({ block: "start", behavior: "smooth" })); }
  return leave;
}

/**
 * The answer as paragraphs and lists, the way Ask the plan shows one (design log 2026-09-15: formatting shown, not
 * left as marks): a line starting "-", "*", "•", "1." or "1)" is a list item. A numbered list starts at the number
 * written on its first item and counts up from there, as markdown does, so "1. 1. 1." and "1. 2. 3." both show
 * 1, 2, 3, and a list picked up again after a paragraph with "3." starts at 3. A blank line between items keeps the
 * list going. An item indented under another (two spaces or more) is a list inside that item, and an indented line
 * that is not an item belongs to the item above it. A blank line ends a paragraph; **bold** and *italic* are shown
 * as such; a "#" heading reads as a line of its own. Built from text nodes, never HTML.
 */
export function answerBlocks(ui, text) {
  const marks = (t, re, tag, rest) => t.split(re).map((part, i) => (i % 2 ? ui.h(tag, {}, part) : rest(part)));
  const inline = (t) => marks(t, /\*\*(.+?)\*\*/, "strong", (p) => marks(p, /\*([^*\s](?:[^*]*?[^*\s])?)\*/, "em", (x) => x.replace(/\*\*/g, ""))).flat();
  const out = [];
  let para = null;
  let levels = [];   // the lists open, outermost first: { indent, tag, list, li, host (the level it sits in), endsInList }
  for (const raw of text.split("\n")) {
    const heading = /^\s*#{1,6}\s+/.test(raw);
    const line = raw.trim().replace(/^#{1,6}\s+/, "");
    const item = heading ? null : /^(?:([-*•])|(\d{1,2})[.)])\s+(.*)$/.exec(line);
    const indent = /^[ \t]*/.exec(raw)[0].replace(/\t/g, "    ").length;
    if (item) {
      const tag = item[1] ? "ul" : "ol";
      // leave the inner lists this item is not part of; an indent a space off is still the same list
      while (levels.length > 1 && levels.at(-1).indent > indent && indent < levels.at(-2).indent + 2) levels.pop();
      let lv = levels.at(-1);
      if (!lv) levels.push(lv = { indent });
      else if (indent >= lv.indent + 2) levels.push(lv = { indent, host: lv });   // under the item above: a list inside it
      if (!lv.list || lv.tag !== tag) {
        lv.tag = tag;
        lv.list = ui.h(tag, tag === "ol" && Number(item[2]) !== 1 ? { start: Number(item[2]) } : {});
        if (lv.host) { lv.host.li.append(lv.list); lv.host.endsInList = true; } else out.push(lv.list);
      }
      lv.list.append(lv.li = ui.h("li", {}, inline(item[3])));
      lv.endsInList = false;
      para = null;
    } else if (!line) para = null;   // the lists stay open: an item after the blank line goes on with them
    else if (levels.length && !heading && indent >= 2) {
      while (levels.length > 1 && levels.at(-1).indent >= indent) levels.pop();   // the item whose text this line carries on
      const lv = levels.at(-1);
      lv.li.append(...(lv.endsInList ? [] : ["\n"]), ...inline(line));   // after a list inside the item it starts its own line anyway
      lv.endsInList = false;
    } else if (para && !heading) para.append("\n", ...inline(line));
    else { out.push(para = ui.h("p", {}, inline(line))); levels = []; }
  }
  return out;
}

/** The notice when there is no answer, in plain words, with the buttons that help. */
function message(ui, m, chosen) {
  const btn = (href, label) => ui.h("a", { class: "btn secondary small", href }, label);
  const settings = btn("#/system/settings", "Open Settings");
  const open = chosen ? btn(`#/${chosen.key}`, `Open “${chosen.title}”`) : null;
  const box = (kind, text, buttons, extra) => ui.h("div", { class: `notice ${kind}` }, ui.h("p", {}, text), buttons?.length ? ui.row(...buttons.filter(Boolean)) : null, extra ?? null);
  // the PC's own settings win over this device's (core/ai.js settings()), so Settings here cannot turn it back on
  if (m.kind === "off" && m.source === "properties") return box("warn", "The AI helper was turned off on the PC itself, so Settings in this app cannot turn it on. Whoever set up the PC can switch it back on there. The page itself still shows all its numbers without it.", [open]);
  if (m.kind === "off") return box("warn", "The AI helper is turned off. To turn it on, open Settings, then “AI assistant” at the bottom. The page itself still shows all its numbers without it.", [settings, open]);
  if (m.kind === "no models") return box("warn", "The AI helper is set up but has no AI model yet (the part that writes the answers). Whoever set up the PC needs to download one there. To check later: Settings, then “AI assistant”, then “Show available models”.", [settings]);
  if (m.kind === "unreachable") return box("warn", "The AI helper did not respond. If it runs on your PC, check that the PC is on and awake and that Ollama (the AI program) is open on it. Settings, under “AI assistant”, shows how it is set up.", [settings, open]);
  if (m.kind === "empty") return box("info", "This page has no numbers to explain yet. Open it and fill it in first, then come back.", [open]);
  if (m.kind === "page") return box("error", "This page could not work out its numbers just now, so there is nothing to send. Open the page to see what it says.", [open]);
  if (m.kind === "blank") return box("info", "The AI sent back no answer, or stopped before it finished one. Tap the Explain button to try again. If it keeps happening, the AI model may be too small for this page; whoever set up the AI can choose a bigger one.");
  // the AI answered with a problem (out of memory, model not found...) or the line dropped: a retry may or may not help
  return box("error", `The AI helper ran into a problem and could not finish the explanation. Try again in a minute; a shorter question can help. If it keeps happening, ${m.detail ? "open “Show details” below and pass it to whoever set up the AI." : "tell whoever set up the AI."}`, [],
    m.detail ? ui.h("details", { class: "notice-details" }, ui.h("summary", {}, "Show details"), ui.h("p", {}, `For whoever set up the AI helper: ${m.detail}`)) : null);
}

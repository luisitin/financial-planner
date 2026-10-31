// modules/ai/explain/view.js -- DOM only. "Explain a page": pick a page (or arrive from #/ai/explain/<group>/<id>), and
// the AI helper explains its numbers in plain words. The page's own compute runs on a copy of the plan with people
// called Adult 1, Adult 2... and accounts by their kind (every line is shown in the fold before you ask); the answer
// comes back with the real names put back, is labelled as not checked, and is never saved.
// One question at a time; the answer waits in module state and shows on the next render; a render that is no longer
// on screen never redraws.
import { compute, explainable, sheetFor, buildMessages, readAnswer } from "./compute.js";

let picked = null;    // the page chosen ("group/id")
let lastRest = null;  // the page named in the address last time, so a new address picks again
let question = "";    // kept while the app is open
let result = null;    // { key, at, text, model, question }
let pending = null;   // { kind: "off" | "no models" | "unreachable" | "error" | "empty" | "page", detail }
let inflight = null;
let phase = "";       // "checking" | "reading"
let shown = 0;
let liveBtn = null;
let foldOpen = false;
let fresh = false;     // an answer just came: bring it into view once

const CHAT_OPTIONS = { options: { num_ctx: 8192 } };
const WAITING = { checking: "Checking the AI helper…", reading: "Reading the page… this can take a minute" };
const STYLE = `
.ex-root .ex-facts { margin: 8px 0 0; padding-left: 18px; font-size: var(--fs-sm); color: var(--text-2); }
.ex-root .ex-facts li { margin: 4px 0; overflow-wrap: anywhere; white-space: pre-wrap; }
.ex-root .ex-answer p { margin: 0 0 10px; overflow-wrap: anywhere; }
.ex-root .notice p { margin: 0 0 8px; overflow-wrap: anywhere; }
.ex-root .notice-details summary { min-height: 44px; }
.ex-root select { width: 100%; }
.ex-root .ex-result { scroll-margin-top: calc(var(--topbar) + 12px); }
`;

function setButton() {
  if (!liveBtn) return;
  liveBtn.disabled = !!phase;
  liveBtn.textContent = phase ? WAITING[phase] : "Explain this page";
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
    liveBtn = null;
    root.append(ui.card("Nothing to explain yet", ui.h("p", { class: "muted" }, "The pages have no numbers until your plan has something in it. Start with the people in your household, then add an account or what you earn."),
      ui.row(ui.h("a", { class: "btn", href: "#/household/people" }, "Add the people"))));
    return leave;
  }

  const enabled = (m) => features?.enabled?.(m) ?? true;
  const pages = explainable([...(modules?.values?.() ?? [])].filter(enabled).map((m) => ({ key: `${m.group}/${m.id}`, group: m.group, title: m.title, purpose: m.purpose, status: m.status, hasCompute: typeof m.compute === "function" })));
  const byKey = new Map(pages.map((p) => [p.key, p]));
  const rest = (route?.rest ?? []).join("/");
  if (rest !== lastRest) { lastRest = rest; if (byKey.has(rest)) picked = rest; }
  if (!byKey.has(picked)) picked = byKey.has("balance/net-worth") ? "balance/net-worth" : pages[0]?.key ?? null;
  const chosen = byKey.get(picked) ?? null;
  const at = plan.meta?.updatedAt ?? "";
  const today = fmt.today();

  // the page list, by topic in the menu's order
  const groupLabel = (g) => (GROUPS ?? []).find((x) => x.id === g)?.title ?? g;
  const order = (g) => { const i = (GROUPS ?? []).findIndex((x) => x.id === g); return i < 0 ? 999 : i; };
  const groups = [...new Set(pages.map((p) => p.group))].sort((a, b) => order(a) - order(b));
  const select = ui.h("select", { "aria-label": "Which page", onChange: (e) => { picked = e.target.value; foldOpen = false; pending = null; redraw(); } },
    groups.map((g) => ui.h("optgroup", { label: groupLabel(g) }, pages.filter((p) => p.group === g).sort((a, b) => a.title.localeCompare(b.title)).map((p) => ui.h("option", { value: p.key, selected: p.key === picked || null }, p.title)))));
  const ask = ui.h("textarea", { rows: 2, placeholder: "For example: is this good for us?", "aria-label": "Your question", onInput: (e) => { question = e.target.value; } });
  ask.value = question;
  const btn = ui.button("Explain this page", () => go());
  liveBtn = btn;
  setButton();
  const status = ui.h("div", {});

  // what the AI will read, built when the fold opens or when asking
  let sheet = null;
  const getSheet = () => (sheet ??= sheetFor(plan, (copy) => modules.get(picked).compute(copy, { today }), { today }));
  const foldBody = ui.h("div", { class: "fold-body" });
  const fold = ui.h("details", { class: "fold" }, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "What the AI will read"), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")), foldBody);
  fold.addEventListener("toggle", () => {
    foldOpen = fold.open;
    if (!fold.open || foldBody.childElementCount) return;
    const s = getSheet();
    const key = s.names.filter((n) => n.kind === "person").map((n) => `${n.alias} is ${n.name}`);
    foldBody.append(
      ui.h("p", { class: "muted small" }, "This is everything the AI gets about the page, word for word, plus the page's name and your question. People's names are swapped for Adult 1, Adult 2, Child 1, and accounts are called by their kind (\"the credit card\"); your notes, phone numbers and where you keep papers are never sent."),
      key.length ? ui.h("p", { class: "small" }, `${key.join(", ")}.`) : null,
      s.lines.length ? ui.h("ul", { class: "ex-facts" }, s.lines.map((l) => ui.h("li", {}, l))) : ui.h("p", { class: "muted small" }, "Nothing: this page has no numbers yet."));
  });
  if (foldOpen) fold.open = true;

  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "Which page?"),
    ui.field("Page", select),
    chosen?.purpose ? ui.h("p", { class: "muted small" }, chosen.purpose) : null,
    ui.field("Your question", ask, "Leave it empty to hear what the page tells you."),
    ui.row(btn), status, ui.h("div", { class: "folds" }, fold)));

  const redraw = () => { if (me === shown) { root.remove(); render(page, ctx); } };
  if (inflight) inflight.finally(redraw);

  function go() {
    if (inflight || !chosen) return;
    pending = null; status.replaceChildren();
    phase = "checking"; setButton();
    const key = picked, q = question.trim();
    inflight = (async () => {
      let st = "unreachable";
      try { st = String(await ai.status()); } catch { /* not answering */ }
      if (!st.startsWith("on")) { pending = { kind: st === "off" || st === "no models" ? st : "unreachable" }; return; }
      phase = "reading"; setButton();
      await new Promise((r) => setTimeout(r, 0));   // let "Reading…" show before a heavy page's numbers are worked out
      const s = getSheet();
      if (!s.ok) { pending = { kind: s.why === "error" ? "page" : "empty" }; return; }
      try {
        const r = await ai.chat(buildMessages({ title: chosen.title, purpose: chosen.purpose, lines: s.lines, question: q, terms: s.terms }), CHAT_OPTIONS);
        const text = readAnswer(r?.content, s.names);
        if (!text) { pending = { kind: "blank" }; return; }
        result = { key, at, text, model: r?.model ?? "", question: q };
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
  const card = ui.h("section", { class: "card ex-result" }, ui.h("h2", {}, `The AI on “${title}”`),
    result.at !== at ? ui.notice("info", "Your plan has changed since the AI looked. Ask again to see what it says now.") : null,
    result.question ? ui.h("p", { class: "muted small" }, `You asked: ${result.question}`) : null,
    ui.h("div", { class: "ex-answer" }, result.text.split(/\n{2,}/).map((para) => ui.h("p", {}, para))),
    ui.h("p", { class: "muted small" }, "This is the AI's explanation and the app has not checked it: the numbers on the page itself are the ones to trust."),
    ui.row(ui.h("a", { class: "btn secondary", href: `#/${result.key}` }, `Open “${title}”`)),
    result.model ? ui.h("p", { class: "muted small" }, `Answered by the AI model ${result.model}.`) : null);
  root.append(card);
  if (fresh) { fresh = false; requestAnimationFrame(() => card.scrollIntoView({ block: "start", behavior: "smooth" })); }
  return leave;
}

/** The notice when there is no answer, in plain words, with the buttons that help. */
function message(ui, m, chosen) {
  const btn = (href, label) => ui.h("a", { class: "btn secondary small", href }, label);
  const settings = btn("#/system/settings", "Open Settings");
  const open = chosen ? btn(`#/${chosen.key}`, `Open “${chosen.title}”`) : null;
  const box = (kind, text, buttons, extra) => ui.h("div", { class: `notice ${kind}` }, ui.h("p", {}, text), buttons?.length ? ui.row(...buttons.filter(Boolean)) : null, extra ?? null);
  if (m.kind === "off") return box("warn", "The AI helper is turned off. Turn it on in Settings, then come back. The page itself still shows all its numbers without it.", [settings, open]);
  if (m.kind === "no models") return box("warn", "The AI helper is running but has no AI model to use yet. One has to be downloaded on the PC first. In Settings, 'Show available models' tells you when it is there.", [settings]);
  if (m.kind === "unreachable") return box("warn", "The AI helper did not answer. If it runs on your PC, check that the PC is on and the helper is running. Settings shows how it is set up.", [settings, open]);
  if (m.kind === "empty") return box("info", "This page has no numbers to explain yet. Open it and fill it in first, then come back.", [open]);
  if (m.kind === "page") return box("error", "This page could not work out its numbers just now, so there is nothing to send. Open the page to see what it says.", [open]);
  if (m.kind === "blank") return box("info", "The AI sent back an empty answer. Ask again. If it keeps happening, a bigger AI model (chosen in Settings) usually does better.");
  return box("error", "The AI helper did not answer this time. Try again in a minute. If it keeps failing, open Settings and check how the AI helper is set up.", [settings],
    m.detail ? ui.h("details", { class: "notice-details" }, ui.h("summary", {}, "Show details"), ui.h("p", {}, `For whoever set up the AI helper: ${m.detail}`)) : null);
}

// modules/ai/critic/view.js -- DOM only. "What could go wrong with my plan?": the AI reads a fact sheet the app's own
// pages work out, with people called "Adult 1", "Child 1"... and accounts by their kind (goal names go as typed, with
// those names swapped; every line is shown in the fold before you ask), and lists the gaps and risks it sees, each
// with a button to the page where you can fix it. Its answer is labelled as the AI's view and is never saved.
// One question at a time: the answer and any message wait in module state and show on the next render; a render
// that is no longer on screen (the shell's #content is shared by every page) never redraws.
import { compute, factSheet, allowedPages, buildPrompt, readAnswer, LEVELS } from "./compute.js";

let result = null;    // { at (the plan's updatedAt when asked), points, model } kept while the app is open
let pending = null;   // { kind: "off" | "no models" | "unreachable" | "error" | "unreadable", detail } for the next render
let inflight = null;  // the question being asked, if any
let phase = "";       // "checking" | "reading" while asking
let shown = 0;        // counts renders and leaves: a render is on screen while `shown` is still its own number
let liveBtn = null;   // the ask button of the latest render
let foldOpen = false; // "What the AI will read" stays open across redraws

/** Bigger context for a local model, so the instructions and the facts are never cut off (Ollama's default is small). */
const CHAT_OPTIONS = { options: { num_ctx: 8192 } };
const WAITING = { checking: "Checking the AI helper…", reading: "Reading your plan… this can take a minute" };
const FIRST = "Ask the AI to look over my plan", AGAIN = "Ask again";
const STYLE = `
.cr-root .cr-facts { margin: 8px 0 0; padding-left: 18px; font-size: var(--fs-sm); color: var(--text-2); }
.cr-root .cr-facts li { margin: 4px 0; overflow-wrap: anywhere; }
.cr-root .pill { margin-left: 0; white-space: nowrap; }
.cr-root .rec-title { overflow-wrap: anywhere; }
.cr-root .rec-foot { flex-wrap: wrap; justify-content: flex-start; }
.cr-root .notice p { margin: 0 0 8px; overflow-wrap: anywhere; }
.cr-root .notice .row { margin-top: 4px; }
.cr-root .notice-details summary { min-height: 44px; }
.cr-root .notice-details p { color: var(--text-2); }
`;
const LEVEL_PILL = { high: "warn", medium: "accent", low: "" };

function setButton() {
  if (!liveBtn) return;
  liveBtn.disabled = !!phase;
  liveBtn.textContent = phase ? WAITING[phase] : result ? AGAIN : FIRST;
}

export function render(page, ctx) {
  const me = ++shown;
  const leave = () => { shown++; };
  const { ui, fmt, plan, ai, modules, features } = ctx;
  const d = compute(plan);
  const root = ui.h("div", { class: "cr-root" }, ui.h("style", {}, STYLE));
  page.append(root);

  if (!d.ready) {
    liveBtn = null;
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "What could go wrong with my plan?"),
      ui.h("p", { class: "lede" }, "Start by adding the people in your household. Then the AI helper can read a summary of your plan and list what could go wrong, each with the page where you can fix it. The more you fill in (what you earn, spend and own), the more it can see."),
      ui.row(ui.h("a", { class: "btn", href: "#/household/people" }, "Add the people"))));
    return leave;
  }

  const enabled = (m) => features?.enabled?.(m) ?? true;
  const built = allowedPages([...(modules?.values?.() ?? [])].filter(enabled).map((m) => ({ key: `${m.group}/${m.id}`, title: m.title, purpose: m.purpose, status: m.status })));
  const titleOf = (key) => modules?.get?.(key)?.title ?? key;
  const at = plan.meta?.updatedAt ?? "";
  const status = ui.h("div", {});
  const askBtn = ui.button(result ? AGAIN : FIRST, () => ask(), { class: result ? "secondary" : null });
  liveBtn = askBtn;
  setButton();

  // what the AI will read, built when the fold opens or when asking
  let sheet = null;
  const getSheet = () => (sheet ??= factSheet(plan, { today: fmt.today() }));
  const foldBody = ui.h("div", { class: "fold-body" });
  const fold = ui.h("details", { class: "fold" }, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "What the AI will read"), ui.h("span", { class: "fold-chev" }, "›")), foldBody);
  fold.addEventListener("toggle", () => {
    foldOpen = fold.open;
    if (!fold.open || foldBody.childElementCount) return;
    const s = getSheet();
    const key = s.names.filter((n) => n.kind === "person" || /\d$/.test(n.alias)).map((n) => `${n.alias} is ${n.name}`);
    foldBody.append(
      ui.h("p", { class: "muted small" }, "This is everything the AI gets, word for word, plus the names of the pages it can point you to. People's names are swapped for Adult 1, Adult 2, Child 1, and accounts are called by their kind and a number (\"credit card 1\"). Your goal names are sent as you typed them, with those names swapped in them too. The AI helper runs on your PC, unless you picked an online AI service in Settings; then these lines go to that service."),
      key.length ? ui.h("p", { class: "small" }, `On this page ${key.join(", ")}. The AI only ever sees Adult 1, Adult 2 and so on.`) : null,
      ui.h("ul", { class: "cr-facts" }, s.lines.map((l) => ui.h("li", {}, l))));
  });
  if (foldOpen) fold.open = true;   // fires "toggle", which fills it

  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "What could go wrong with my plan?"),
    ui.h("p", { class: "muted small" }, "The AI helper reads a short summary of your plan (your health score, your next steps and your will and other legal papers) and lists what could go wrong, most important first, with the page where you can fix each one. It does not change your plan, and its answer is not saved."),
    ui.row(askBtn), status, ui.h("div", { class: "folds" }, fold)));

  // redraw this render when the question is answered, if it is still the one on screen
  const redrawWhenDone = () => inflight?.finally(() => { if (me === shown) { root.remove(); render(page, ctx); } });
  if (inflight) redrawWhenDone();

  function ask() {
    if (inflight) return;
    pending = null; status.replaceChildren();
    phase = "checking"; setButton();
    inflight = (async () => {
      let st = "unreachable";
      try { st = String(await ai.status()); } catch { /* not answering */ }
      if (!st.startsWith("on")) { pending = { kind: st === "off" || st === "no models" ? st : "unreachable" }; return; }
      phase = "reading"; setButton();
      try {
        const s = getSheet();
        const pages = allowedPages(built, s.related);
        const p = buildPrompt(s.lines, pages);
        const r = await ai.chat([{ role: "system", content: p.system }, { role: "user", content: p.user }], CHAT_OPTIONS);
        const points = readAnswer(r?.content, pages, s.names);
        if (points === null) { pending = { kind: "unreadable" }; return; }   // the list from before, if any, stays
        result = { at, points, model: r?.model ?? "" };
      } catch (e) {
        console.warn("[ai/critic] the AI did not answer", e);
        pending = { kind: "error", detail: String(e?.message ?? e).slice(0, 200) };
      }
    })().finally(() => { inflight = null; phase = ""; });
    redrawWhenDone();
  }

  if (pending) { status.append(message(ui, pending)); pending = null; }
  if (!result) return leave;
  const n = result.points.length;
  const list = ui.h("ul", { class: "records" }, result.points.map((x) => ui.h("li", {},
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, x.title), ui.h("span", { class: "rec-value" }, ui.h("span", { class: `pill ${LEVEL_PILL[x.level] ?? ""}` }, LEVELS[x.level] ?? LEVELS.medium))),
    x.why ? ui.h("div", { class: "rec-sub" }, x.why) : null,
    x.page ? ui.h("div", { class: "rec-foot" }, ui.h("a", { class: "btn secondary small", href: `#/${x.page}` }, `Open the “${titleOf(x.page)}” page`)) : null)));
  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "The AI's view of your plan"),
    result.at !== at ? ui.notice("info", "Your plan has changed since the AI looked. Ask again to see what it thinks now.") : null,
    n ? ui.h("p", { class: "muted small" }, `${n} ${n === 1 ? "thing" : "things"} to look at, most important first. This is the AI's opinion and the app has not checked it: the numbers on each page are the ones to trust.`)
      : ui.notice("ok", "The AI found nothing to flag in this summary. That is only its opinion: the Plan health score page checks the same facts."),
    n ? list : null,
    result.model ? ui.h("p", { class: "muted small" }, `Answered by the AI model ${result.model}.`) : null));
  return leave;
}

/** The notice for a question that got no list back, in plain words, with the buttons that help. */
function message(ui, m) {
  const btn = (href, label) => ui.h("a", { class: "btn secondary small", href }, label);
  const settings = btn("#/system/settings", "Open Settings");
  const without = [settings, btn("#/overview/health-score", "Open Plan health score"), btn("#/overview/next-best-action", "Open Next best action")];
  const box = (kind, text, buttons, extra) => ui.h("div", { class: `notice ${kind}` }, ui.h("p", {}, text), buttons ? ui.row(...buttons) : null, extra ?? null);
  if (m.kind === "off") return box("warn", "The AI helper is turned off. Turn it on in Settings, then come back. Until then, the Plan health score and Next best action pages check your plan without it.", without);
  if (m.kind === "no models") return box("warn", "The AI helper is running but has no AI model to use yet. One has to be downloaded on the PC first. In Settings, 'Show available models' tells you when it is there.", [settings]);
  if (m.kind === "unreachable") return box("warn", "The AI helper did not answer. If it runs on your PC, check that the PC is on and the helper is running. Settings shows how it is set up.", without);
  if (m.kind === "unreadable") return box("info", result
    ? "The AI's answer came back jumbled this time, so the list below is still the one from before. Ask again. If it keeps happening, a bigger AI model (chosen in Settings) usually does better."
    : "The AI's answer came back jumbled, so there is nothing to show. Ask again. If it keeps happening, a bigger AI model (chosen in Settings) usually does better.");
  return box("error", "The AI helper did not answer this time. Try again in a minute. If it keeps failing, open Settings and check how the AI helper is set up.", [settings],
    m.detail ? ui.h("details", { class: "notice-details" }, ui.h("summary", {}, "Show details"), ui.h("p", {}, `For whoever set up the AI helper: ${m.detail}`)) : null);
}

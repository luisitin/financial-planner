// modules/ai/glossary/view.js -- DOM only. Every money word the app uses, in plain words: a search box, topics to
// browse, the words for this household, and the list, each word folded to one line until tapped (its meaning, an
// example, the pages that use it and its source); behind the words met on the most pages, one more quiet row, "A
// two-minute lesson". When nothing matches and the AI helper is on, it can be asked; its answer is labelled as not
// checked. Typing filters the list without touching the plan. `#/ai/glossary/<id>` opens one word. Every row that opens
// is a part of core/ui/more.js (kind "item": opened only by a tap, never remembered, never opened by the switches).
import { compute, search, shortNames, norm, find, askMessages, sourceLabel, lessonOf, tryItOf, LESSON } from "./compute.js";
import { TERMS } from "./data/terms.js";
import { part } from "../../../core/ui/more.js";

let query = "";       // kept until the app reloads, so Back from a page an entry links to returns to the same search
let topic = "all";    // browsing only: a typed word searches every topic
let asked = null;     // { q, text } or { q, error }: the AI's last answer on this page
let lastRest = null;  // the word in the address last time (#/ai/glossary/<id>), so a new address starts fresh

const OPEN_UP_TO = 3;   // a search with this many matches or fewer shows them unfolded

const STYLE = `
.gl-root .gl-search { width: 100%; font-size: 17px; }
.gl-root .gl-plain { margin: 0 0 6px; }
.gl-root .gl-ex { margin: 0 0 6px; color: var(--text-2); font-size: var(--fs-sm); }
.gl-root .gl-where { margin: 8px 0 0; }
.gl-root .fold-title { overflow-wrap: anywhere; }
.gl-root .fold-status { white-space: normal; text-align: right; max-width: 45%; }
.gl-root .gl-src { font-size: var(--fs-xs); color: var(--muted); margin-top: 4px; overflow-wrap: anywhere; }
.gl-root .gl-src a { color: inherit; display: inline-flex; align-items: center; min-height: 44px; }
.gl-root .gl-pages { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.gl-root h3 { margin: 16px 0 6px; font-size: var(--fs); }
.gl-root .gl-count { margin-top: 12px; }
.gl-root .gl-letter { margin: 14px 0 2px; font-size: var(--fs-sm); color: var(--muted); font-weight: 600; }
.gl-root .gl-search, .gl-root .fold, .gl-root .gl-letter { scroll-margin-top: calc(var(--topbar) + 12px); }
.gl-root details[data-part^="lesson-"] { border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.gl-root details[data-part^="lesson-"] > summary .fold-title { font-weight: 500; }
.gl-root .gl-pages > [hidden] { display: none; }
.gl-root .gl-lesson h4 { margin: 0 0 4px; font-size: var(--fs); }
.gl-root .gl-lesson p { margin: 0 0 8px; }
.gl-root .gl-lesson .gl-src p { margin: 0; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, ai, modules, route } = ctx;
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "gl-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const rest = route?.rest?.[0] ?? "";
  const opened = rest ? TERMS.find((t) => t.id === rest) ?? null : null;
  if (rest !== lastRest) { query = opened ? opened.term : ""; lastRest = rest; }
  // a page that is not built yet (a placeholder), turned off or gone gets no button
  const titleOf = (key) => {
    const m = modules?.get?.(key);
    return m && (ctx.isReady ? ctx.isReady(m) : m.status !== "planned") && (ctx.features?.enabled?.(m) ?? true) && (ctx.shown ? ctx.shown(m) : true) ? m.title : null;
  };

  const box = ui.input({ type: "search", class: "gl-search", value: query, placeholder: "Type a word, like Roth", "aria-label": "Search the glossary", autocomplete: "off" });
  const count = ui.h("p", { class: "muted small gl-count", role: "status" });
  const list = ui.h("div", {});
  // browsing (nothing typed): the words for this household and the topics; hidden while a word is typed, so the
  // matches sit right under the box
  const pick = (t) => {
    query = t.term; box.value = query; draw();
    box.scrollIntoView({ block: "start" });
    globalThis.document?.getElementById?.(`gl-${t.id}`)?.querySelector("summary")?.focus({ preventScroll: true });
  };
  // the topic chips are made once and only change state, so a pressed chip keeps the focus
  const chipEls = [{ key: "all", label: "All" }, ...d.topics].map((x) => ui.h("button", { type: "button", class: "chip", dataset: { key: x.key }, onClick: () => { topic = x.key; syncChips(); draw(); } }, x.label));
  const syncChips = () => chipEls.forEach((b) => { const on = b.dataset.key === topic; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
  syncChips();
  const chips = ui.h("div", { class: "chips", role: "group", "aria-label": "Topic" }, chipEls);
  const browse = ui.h("div", {},
    d.mine.length ? ui.h("div", { class: "gl-mine" }, ui.h("h3", {}, "Words for your plan"), ui.h("p", { class: "muted small" }, "From what your plan holds: your accounts, your work, your family and your ages."),
      ui.h("div", { class: "chips", role: "group", "aria-label": "Words for your plan" }, d.mine.map((t) => ui.h("button", { type: "button", class: "chip", onClick: () => pick(t) }, t.term)))) : null,
    ui.h("h3", {}, "Browse by topic"), chips);
  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "Money words, in plain English"),
    ui.h("p", { class: "muted small" }, `${d.count} money words the app uses, each explained in a sentence or two of plain English, most with an example. Tap a word to open it.`),
    box, browse, count, list));

  // the lesson behind a word: three short parts, one page to try it on (left out when that page is off or not built;
  // Velocity banking's Mortgage page only when it works out this plan's mortgage, else a line saying what comes first:
  // compute.js tryItOf), the public sources of its rules (the word's own source is its "Read more" just below, so it is
  // not said twice); a row of its own inside the word's row, shut until tapped
  const goes = new Map();   // the lesson's page for this plan, worked out once per drawing
  const goOf = (l) => {
    if (!goes.has(l.id)) { const go = tryItOf(l, plan, { today: fmt.today() }); goes.set(l.id, go ? { ...go, title: go.page ? titleOf(go.page) : null } : null); }
    return goes.get(l.id);
  };
  const lessonPart = (t, l) => {
    const go = goOf(l);
    const sources = l.sources.filter((x) => x.url !== t.sourceUrl);
    return part(ctx, { id: `lesson-${t.id}`, kind: "item", title: LESSON.title, body: () => ui.h("div", { class: "gl-lesson" },
      ...[["what", l.what], ["why", l.why], ["example", l.example]].map(([k, ps]) => ui.h("div", { dataset: { lesson: k } }, ui.h("h4", {}, LESSON[k]), ...ps.map((x) => ui.h("p", {}, x)))),
      go?.title ? ui.h("div", { dataset: { lesson: "page" } }, ui.h("p", { class: "muted small gl-where" }, go.says),
        ui.h("div", { class: "gl-pages" }, ui.h("a", { class: "btn secondary small", href: `#/${go.page}` }, go.title)))
        : go && !go.page ? ui.h("div", { dataset: { lesson: "none" } }, ui.h("p", { class: "muted small gl-where" }, go.says)) : null,
      sources.length ? ui.h("div", { class: "gl-src", dataset: { lesson: "sources" } }, ui.h("p", {}, LESSON.sources),
        ...sources.map((x) => ui.h("div", {}, ui.h("a", { href: x.url, target: "_blank", rel: "noopener" }, sourceLabel(x.name))))) : null) });
  };
  const isOpen = (el) => (typeof el?.open === "boolean" ? el.open : !!el?.hasAttribute?.("open"));
  const entry = (t, open) => {
    const pages = (t.pages ?? []).map((k) => ({ k, title: titleOf(k) })).filter((x) => x.title).slice(0, 3);
    const lesson = lessonOf(t);
    const el = part(ctx, { id: t.id, kind: "item", title: t.term, says: shortNames(t).join(", "), open: open || undefined, body: () => {
      const lessonEl = lesson ? lessonPart(t, lesson) : null;
      const btns = pages.map((x) => ui.h("a", { class: "btn secondary small", href: `#/${x.k}` }, x.title));
      const where = pages.length ? ui.h("div", {}, ui.h("p", { class: "muted small gl-where" }, "Where you meet it in the app:"), ui.h("div", { class: "gl-pages" }, ...btns)) : null;
      // the lesson's own button goes to one of these pages: while the lesson is open, "Where you meet it" leaves that
      // page out, so no page is offered twice in a row; shut, the list is whole (a look on a phone, 2026-11-16)
      const go = lesson ? goOf(lesson) : null, twin = go?.title ? pages.findIndex((x) => x.k === go.page) : -1;
      if (lessonEl && twin >= 0) {
        const sync = () => { const on = isOpen(lessonEl); btns[twin].hidden = on; where.hidden = on && pages.length === 1; };
        sync();
        lessonEl.addEventListener?.("toggle", sync);
      }
      return [
        ui.h("p", { class: "gl-plain" }, t.plain),
        t.example ? ui.h("p", { class: "gl-ex" }, ui.h("b", {}, "For example: "), t.example) : null,
        lessonEl, where,
        ui.h("div", { class: "gl-src" }, ui.h("a", { href: t.sourceUrl, target: "_blank", rel: "noopener" }, `Read more: ${sourceLabel(t.sourceName)}`)),
      ];
    } });
    el.setAttribute?.("id", `gl-${t.id}`);   // the search scrolls to the word and puts the focus on its row
    return el;
  };

  // whether the AI helper is on: asked once per visit, not once per keystroke
  let aiOn = null;
  const aiReady = () => (aiOn ??= (ctx.view.build || ctx.live.ai) ? Promise.resolve().then(() => ai.status()).then((s) => String(s).startsWith("on")).catch(() => false) : Promise.resolve(false));   // the household's view: only while the AI helper answers (core/view.js)
  const askAi = (q, where) => {
    const btn = ui.button(asked?.error && asked.q === q ? "Try again" : `Ask the AI what "${q}" means`, async () => {
      btn.disabled = true; btn.textContent = "Asking…";
      try {
        const r = await ai.chat(askMessages(q));
        asked = { q, text: String(r?.content ?? "").trim() || "The AI gave no answer." };
      } catch { asked = { q, error: "The AI did not answer. Check the AI section in Settings, or try again." }; }
      draw();
    }, { class: "secondary" });
    const hint = ui.h("p", { class: "muted small" }, "Try another spelling or a shorter word.");
    where.append(hint);
    aiReady().then((on) => {
      if (!where.isConnected) return;
      if (on) where.append(ui.row(btn));
      else if (ctx.view.build) hint.textContent = "Try another spelling or a shorter word. When the AI helper is on (Settings), it can explain words that are not here.";
    });
  };

  function draw() {
    const q = norm(query) ? query.trim() : "";   // only punctuation ("$", "?") counts as nothing typed
    browse.hidden = !!q;
    const found = search(q).filter((t) => q || topic === "all" || t.topic === topic);
    if (!found.length) {
      count.textContent = "";
      const empty = ui.h("div", {}, ui.h("p", {}, q ? `No word here matches "${q}".` : "No words in this topic."));
      if (asked && asked.q === q && !asked.error) empty.append(ui.h("div", { class: "notice info", role: "status" }, ui.h("b", {}, "The AI's answer, not checked: "), asked.text));
      else if (q) {
        if (asked?.error && asked.q === q) { const n = ui.notice("error", asked.error); n.setAttribute("role", "alert"); empty.append(n); }
        askAi(q, empty);
      }
      list.replaceChildren(empty);
      return;
    }
    count.textContent = q ? (found.length === 1 ? "1 match." : `${found.length} matches, the closest first.`) : `${found.length} words, A to Z.`;
    const open = q && found.length <= OPEN_UP_TO;
    const exact = q ? find(q) : null;   // a word typed or tapped exactly is always open
    if (q) { list.replaceChildren(ui.h("div", { class: "folds" }, found.map((t) => entry(t, open || t === opened || t === exact)))); return; }
    // nothing typed: A to Z with a letter above each group
    const out = [];
    let letter = null, group = null;
    for (const t of found) {
      const l = /[a-z]/i.test(t.term[0]) ? t.term[0].toUpperCase() : "0-9";
      if (l !== letter) { letter = l; group = ui.h("div", { class: "folds" }); out.push(ui.h("p", { class: "gl-letter" }, l), group); }
      group.append(entry(t, false));
    }
    list.replaceChildren(...out);
  }
  box.addEventListener("input", () => { query = box.value; draw(); });
  draw();
  if (opened) setTimeout(() => globalThis.document?.getElementById?.(`gl-${opened.id}`)?.scrollIntoView({ block: "start" }), 0);
}

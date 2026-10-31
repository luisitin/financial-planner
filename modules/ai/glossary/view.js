// modules/ai/glossary/view.js -- DOM only. Every money word the app uses, in plain words: a search box, topics to
// browse, the words for this household, and the list, each word folded to one line until tapped (its meaning, an
// example, the pages that use it and its source). When nothing matches and the AI helper is on, it can be asked; its
// answer is labelled as not checked. Typing filters the list without touching the plan. `#/ai/glossary/<id>` opens
// one word.
import { compute, search, shortNames } from "./compute.js";
import { TERMS } from "./data/terms.js";

let query = "";       // kept across re-renders while the page is open
let topic = "all";    // browsing only: a typed word searches every topic
let asked = null;     // { q, text } or { q, error }: the AI's last answer on this page

const OPEN_UP_TO = 3;   // a search with this many matches or fewer shows them unfolded

const STYLE = `
.gl-root .gl-search { width: 100%; font-size: 17px; }
.gl-root .gl-plain { margin: 0 0 6px; }
.gl-root .fold-title { overflow-wrap: anywhere; }
.gl-root .fold-status { white-space: normal; text-align: right; max-width: 45%; }
.gl-root .gl-src { font-size: var(--fs-xs); color: var(--muted); margin-top: 4px; overflow-wrap: anywhere; }
.gl-root .gl-src a { color: inherit; display: inline-flex; align-items: center; min-height: 44px; }
.gl-root .gl-pages { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
.gl-root h3 { margin: 16px 0 6px; font-size: var(--fs); }
.gl-root .gl-count { margin-top: 12px; }
.gl-root .gl-letter { margin: 14px 0 2px; font-size: var(--fs-sm); color: var(--muted); font-weight: 600; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, ai, modules, route } = ctx;
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "gl-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const opened = route?.rest?.[0] ? TERMS.find((t) => t.id === route.rest[0]) : null;
  if (opened) query = opened.term;
  const titleOf = (key) => modules?.get?.(key)?.title ?? null;

  const box = ui.input({ type: "search", class: "gl-search", value: query, placeholder: "Type a word, like Roth", "aria-label": "Search the glossary", autocomplete: "off" });
  const count = ui.h("p", { class: "muted small gl-count" });
  const list = ui.h("div", {});
  // browsing (nothing typed): the words for this household and the topics; hidden while a word is typed, so the
  // matches sit right under the box
  const pick = (term) => { query = term; box.value = query; draw(); box.scrollIntoView({ block: "start" }); };
  const chips = ui.h("div", { class: "chips", role: "group", "aria-label": "Topic" });
  const drawChips = () => chips.replaceChildren(...[{ key: "all", label: "All" }, ...d.topics].map((x) => ui.h("button", { type: "button", class: `chip${topic === x.key ? " on" : ""}`, "aria-pressed": topic === x.key ? "true" : "false", onClick: () => { topic = x.key; drawChips(); draw(); } }, x.label)));
  drawChips();
  const browse = ui.h("div", {},
    d.mine.length ? ui.h("div", { class: "gl-mine" }, ui.h("h3", {}, "Words for your plan"), ui.h("p", { class: "muted small" }, "From what your plan holds: your accounts, your work, your family and your ages."),
      ui.h("div", { class: "chips", role: "group", "aria-label": "Words for your plan" }, d.mine.map((t) => ui.h("button", { type: "button", class: "chip", onClick: () => pick(t.term) }, t.term)))) : null,
    ui.h("h3", {}, "Browse by topic"), chips);
  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "Money words, in plain English"),
    ui.h("p", { class: "muted small" }, `${d.count} words the app uses, each explained in a sentence or two, with an example and the pages where you meet it. Tap a word to open it.`),
    box, browse, count, list));

  const entry = (t, open) => {
    const pages = (t.pages ?? []).map((k) => ({ k, title: titleOf(k) })).filter((x) => x.title).slice(0, 3);
    const other = shortNames(t);
    return ui.h("details", { class: "fold", id: `gl-${t.id}`, open: open || null },
      ui.h("summary", {}, ui.h("span", { class: "fold-title" }, t.term), other.length ? ui.h("span", { class: "fold-status" }, other.join(", ")) : null, ui.h("span", { class: "fold-chev" }, "›")),
      ui.h("div", { class: "fold-body" },
        ui.h("p", { class: "gl-plain" }, t.plain),
        t.example ? ui.h("div", { class: "rec-sub" }, `For example: ${t.example}`) : null,
        pages.length ? ui.h("div", { class: "gl-pages" }, ...pages.map((x) => ui.h("a", { class: "btn secondary small", href: `#/${x.k}` }, x.title))) : null,
        ui.h("div", { class: "gl-src" }, "Source: ", ui.h("a", { href: t.sourceUrl, target: "_blank", rel: "noopener" }, t.sourceName))));
  };

  const askAi = (q, where) => {
    const btn = ui.button(`Ask the AI what "${q}" means`, async () => {
      btn.disabled = true; btn.textContent = "Asking…";
      try {
        const r = await ai.chat([
          { role: "system", content: "You explain US personal finance words to someone who is not a finance person. Answer in two or three plain sentences, with one short example using round invented numbers. No advice, no current-year dollar limits, no jargon left unexplained. If the word is not a money word, say so in one sentence." },
          { role: "user", content: `What does "${q}" mean?` },
        ]);
        asked = { q, text: String(r?.content ?? "").trim() || "The AI gave no answer." };
      } catch { asked = { q, error: "The AI did not answer. Check the AI section in Settings, or try again." }; }
      draw();
    }, { class: "secondary" });
    const hint = ui.h("p", { class: "muted small" }, "Try another spelling or a shorter word.");
    where.append(hint);
    Promise.resolve(ai.status()).then((s) => {
      if (String(s).startsWith("on")) where.append(ui.row(btn));
      else hint.textContent = "Try another spelling or a shorter word. When the AI helper is on (Settings), it can explain words that are not here.";
    }).catch(() => {});
  };

  function draw() {
    const q = query.trim();
    browse.hidden = !!q;
    const found = search(q).filter((t) => q || topic === "all" || t.topic === topic);
    if (!found.length) {
      count.textContent = "";
      const empty = ui.h("div", {}, ui.h("p", {}, q ? `No word here matches "${q}".` : "No words in this topic."));
      if (asked && asked.q === q) empty.append(asked.error ? ui.notice("error", asked.error) : ui.h("div", { class: "notice info" }, ui.h("b", {}, "The AI's answer, not checked: "), asked.text));
      else if (q) askAi(q, empty);
      list.replaceChildren(empty);
      return;
    }
    count.textContent = q ? `${found.length} ${found.length === 1 ? "match" : "matches"}, the closest first.` : `${found.length} words, A to Z.`;
    const open = q && found.length <= OPEN_UP_TO;
    if (q) { list.replaceChildren(ui.h("div", { class: "folds" }, found.map((t) => entry(t, open || t === opened)))); return; }
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
  if (opened) setTimeout(() => document.getElementById(`gl-${opened.id}`)?.scrollIntoView({ block: "start" }), 0);
}

// modules/system/help/view.js -- DOM only. How the app works in a few lines, the first steps with what is
// done, a search over every page, every page by section with what it is for, and the common questions.
import { compute, directory } from "./compute.js";

const STYLE = `
.hp-root .hp-steps { list-style: none; margin: 0; padding: 0; }
.hp-root .hp-steps li { border-bottom: 1px solid var(--line); }
.hp-root .hp-steps li:last-child { border-bottom: 0; }
.hp-root .hp-steps a { display: flex; gap: 12px; align-items: flex-start; padding: 11px 0; min-height: 44px; color: inherit; text-decoration: none; }
.hp-root .hp-mark { flex: none; width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center; font-size: 13px; font-weight: 700; border: 2px solid var(--line-2); color: var(--muted); }
.hp-root .hp-done .hp-mark { background: var(--ok); border-color: var(--ok); color: var(--on-accent); }
.hp-root .hp-t { font-weight: 650; }
.hp-root .hp-d { color: var(--text-2); font-size: var(--fs-sm); }
.hp-root .hp-pages { list-style: none; margin: 0; padding: 0; }
.hp-root .hp-pages li { border-bottom: 1px solid var(--line); }
.hp-root .hp-pages li:last-child { border-bottom: 0; }
.hp-root .hp-pages a { display: block; padding: 10px 0; min-height: 44px; color: inherit; text-decoration: none; }
.hp-root .hp-pages a .hp-t { color: var(--accent); }
.hp-root .hp-soon { color: var(--muted); font-size: var(--fs-sm); font-weight: 400; }
.hp-root .hp-search { width: 100%; min-height: 44px; }
.hp-root details.hp-q summary { min-height: 44px; display: flex; align-items: center; font-weight: 650; cursor: pointer; padding: 6px 0; }
.hp-root details.hp-q { border-bottom: 1px solid var(--line); }
.hp-root details.hp-q:last-child { border-bottom: 0; }
.hp-root details.hp-q p { margin: 0 0 12px; color: var(--text-2); }
`;

export function render(page, ctx) {
  const { ui, plan, modules, GROUPS, features } = ctx;
  const d = compute(plan);
  const root = ui.h("div", { class: "hp-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const manifests = [...modules.values()].map((m) => ({ group: m.group, id: m.id, title: m.title, purpose: m.purpose, status: m.status, placeholder: m.placeholder, order: m.order, aliases: m.aliases, enabled: features.enabled(m) }));
  const link = (g, id) => `#/${g}/${id}`;

  root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "How this app works"),
    ui.h("p", { class: "lede" }, "Your whole financial plan in one place, kept on your own computer. Each page answers one question from what you have typed in, and pages share what they know: add an account once and every page that needs it uses it."),
    ui.h("p", { class: "muted small" }, "Numbers come from formulas, never from the AI. Changes save when you press a button; a green line confirms each one.")));

  // first steps
  root.append(ui.card(d.done === d.total ? "Your plan has the basics" : `Start here: ${d.done} of ${d.total} done`,
    ui.h("ol", { class: "hp-steps" }, d.steps.map((s, i) => ui.h("li", { class: s.done ? "hp-done" : null }, ui.h("a", { href: link(...s.go) },
      ui.h("span", { class: "hp-mark", "aria-hidden": "true" }, s.done ? "✓" : String(i + 1)),
      ui.h("span", {}, ui.h("div", { class: "hp-t" }, s.title), ui.h("div", { class: "hp-d" }, s.done ? `Done. ${s.why}` : s.why))))))));

  // search and directory
  const box = ui.h("input", { type: "search", class: "hp-search", placeholder: "e.g. pay off the card, Social Security, a new car", "aria-label": "Find a page" });
  const results = ui.h("div", {});
  const draw = () => {
    const dir = directory(manifests, GROUPS, box.value);
    results.replaceChildren();
    if (dir.query) {
      results.append(ui.card(dir.results.length ? `${dir.results.length} page${dir.results.length === 1 ? "" : "s"}` : null, dir.results.length
        ? ui.h("ul", { class: "hp-pages" }, dir.results.map(entry))
        : ui.h("p", { class: "muted" }, `No page matches "${dir.query}". Try one word, like "tax" or "home".`)));
      return;
    }
    for (const s of dir.sections) results.append(ui.h("details", { class: "card fold fold-card" },
      ui.h("summary", {}, ui.h("h2", {}, `${s.icon} ${s.title}`), ui.h("span", { class: "fold-status" }, s.ready === s.pages.length ? `${s.pages.length} page${s.pages.length === 1 ? "" : "s"}` : `${s.ready} of ${s.pages.length} ready`), ui.h("span", { class: "fold-chev" }, "›")),
      ui.h("ul", { class: "hp-pages" }, s.pages.map(entry))));
  };
  function entry(p) {
    return ui.h("li", {}, ui.h("a", { href: link(p.group, p.id) }, ui.h("div", { class: "hp-t" }, p.title, p.planned ? ui.h("span", { class: "hp-soon" }, " · coming soon") : null), p.purpose ? ui.h("div", { class: "hp-d" }, p.purpose) : null));
  }
  box.addEventListener("input", draw);
  root.append(ui.card("Every page", ui.field("What do you want to do?", box)), results);
  draw();

  // questions
  root.append(ui.card("Questions people ask", ...d.faq.map((f) => ui.h("details", { class: "hp-q" }, ui.h("summary", {}, f.q), ui.h("p", {}, f.a)))));
}

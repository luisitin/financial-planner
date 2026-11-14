// modules/system/methods/view.js -- DOM only. One sentence, then a short list of topics; each opens where it is to the
// method in plain words, the main sources with the day each was read, and the pages that use it. Nothing to type and
// nothing to save: opening or shutting a row changes nothing.
import { compute, NEW_TAB } from "./compute.js";
import { part, links } from "../../../core/ui/more.js";

const STYLE = `
.mt-root .mt-says { margin: 0; }
.mt-root .mt-h { margin: 6px 0 0; font-size: var(--fs-sm); color: var(--muted); font-weight: 600; }
.mt-root .mt-src { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.mt-root .mt-src .mt-name { overflow-wrap: anywhere; }
.mt-root .mt-src a.mt-name { display: inline-flex; align-items: center; min-height: 44px; }
.mt-root .mt-src .mt-read { color: var(--muted); font-size: var(--fs-sm); }
.mt-root .mt-pages { margin: 0; }
.mt-root .mt-pages a.chip { display: inline-flex; align-items: center; text-decoration: none; }
.mt-root .fold-title { overflow-wrap: anywhere; }
`;

export function render(page, ctx) {
  const { ui, modules } = ctx;
  const h = ui.h;
  const d = ctx.derived?.topics ? ctx.derived : compute(ctx.plan);
  const root = h("div", { class: "mt-root" }, h("style", {}, STYLE));
  page.append(root);
  // a page that is not built yet, switched off or not offered to this household gets no link
  const offered = (key) => {
    const m = modules?.get?.(key);
    return m && (ctx.isReady ? ctx.isReady(m) : m.status !== "planned") && (ctx.features?.enabled?.(m) ?? true) && (ctx.shown ? ctx.shown(m) : true) ? m : null;
  };

  root.append(h("section", { class: "card accent hero" }, h("h1", {}, "How we work out the answers"),
    h("p", { class: "lede" }, d.intro), h("p", { class: "muted small" }, d.promise)));

  const body = (t) => {
    const pages = t.pages.map((k) => ({ k, m: offered(k) })).filter((x) => x.m);
    return [
      ...t.says.map((s) => h("p", { class: "mt-says" }, s)),
      t.sources.length ? h("p", { class: "mt-h" }, "Where the figures come from") : null,
      t.sources.length ? h("ul", { class: "mt-src" }, t.sources.map((s) => h("li", {},
        s.url ? h("a", { class: "mt-name", href: s.url, target: "_blank", rel: "noopener" }, s.name) : h("div", { class: "mt-name" }, s.name),
        h("div", { class: "mt-read" }, s.url ? `${s.readWords}. ${NEW_TAB}` : s.readWords)))) : null,
      pages.length ? h("p", { class: "mt-h" }, "Pages that use it") : null,
      pages.length ? h("div", { class: "chips mt-pages" }, pages.map((x) => h("a", { class: "chip", href: `#/${x.k}` }, x.m.title))) : null,
    ];
  };
  root.append(h("section", { class: "card" }, h("h2", {}, "Pick a topic"),
    h("div", { class: "folds" }, d.topics.map((t) => part(ctx, { id: t.id, kind: "item", title: t.topic, says: t.status, body: body(t) })))));

  const more = links(ctx, [
    offered("overview/guesses") && { href: "#/overview/guesses", ask: "Which figures are guesses?" },
    offered("system/assumptions") && { href: "#/system/assumptions", ask: "What does the plan assume?" },
    offered("ai/glossary") && { href: "#/ai/glossary", ask: "What does a word mean?" },
  ]);
  if (more) root.append(more);
}

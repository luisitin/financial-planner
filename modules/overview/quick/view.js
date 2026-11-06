// modules/overview/quick/view.js -- DOM only. A list of questions; each row opens the page that answers it,
// with ?from=quick so the page shows a way back. No filled button: it is a list of choices, like All pages.
import { compute } from "./compute.js";

const STYLE = `
.qk-root .qk-lede { color: var(--text-2); margin: 6px 0 4px; }
.qk-root .qk-foot { color: var(--text-2); font-size: var(--fs-sm); margin: 0 0 4px; }
.qk-root h2 { margin: 18px 0 2px; }
.qk-root .card > h2:first-child, .qk-root .qk-first { margin-top: 0; }
.qk-root .qk-sub { color: var(--text-2); font-size: var(--fs-sm); margin: 0 0 4px; }
.qk-root .page-list .row-link { align-items: center; min-height: 60px; padding: 8px 4px; }
.qk-root .page-list .row-link .t { color: var(--text); }
.qk-root .page-list .d { color: var(--text-2); }
.qk-root .page-list .ic { width: 40px; height: 40px; font-size: 20px; border: 1px solid var(--line); }
.qk-root .qk-chev { flex: none; color: var(--muted); font-size: 22px; line-height: 1; padding-left: 4px; }
.qk-root .qk-search { width: 100%; margin-top: 12px; }
.qk-root .qk-answers .row-link .t { font-weight: 700; font-size: var(--fs-md); }
.qk-root .qk-answers .qk-q { display: block; color: var(--text); font-weight: 600; margin-bottom: 2px; }
@media (min-width: 720px) {
  .qk-root .qk-two { display: grid; grid-template-columns: 1fr 1fr; column-gap: 24px; }
  .qk-root .qk-two li:nth-last-child(2) { border-bottom: 0; }   /* the last row of each column */
  .qk-root .qk-search { width: auto; }
}
`;

export function render(root, ctx) {
  const { ui, modules, features, isReady } = ctx;
  const usable = (key) => { const m = modules.get(key); return !!m && isReady(m) && features.enabled(m) && (ctx.shown ? ctx.shown(m) : true); };
  const off = [...modules.keys()].filter((k) => !usable(k));
  const d = compute(ctx.plan, { off, today: ctx.fmt.today() });
  const wrap = ui.h("div", { class: "qk-root" }, ui.h("style", {}, STYLE));
  root.append(wrap);

  const row = (q, icon) => ui.h("li", {}, ui.h("a", { href: q.href, class: "row-link" },
    ui.h("span", { class: "ic", "aria-hidden": "true" }, icon ?? q.icon ?? modules.get(q.key)?.icon ?? "⚡"),
    ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, q.title), ui.h("div", { class: "d" }, q.line)),
    ui.h("span", { class: "qk-chev", "aria-hidden": "true" }, "›")));

  wrap.append(ui.h("section", { class: "card" },
    ui.h("h1", {}, "Get a quick answer"),
    ui.h("p", { class: "qk-lede" }, d.answers.length ? "Your plan already answers the first questions below. For the others, pick one and type your own numbers: nothing to set up first." : "Pick a question and type your own numbers. Each one answers on its own page, with nothing to set up first."),
    ui.h("p", { class: "qk-foot" }, "Everything stays on your own devices. Nothing goes to the cloud."),
    // the questions the plan already answers: the answer itself, in the answer page's words, first
    d.answers.length ? [
      ui.h("h2", {}, "Your plan already answers"),
      ui.h("ul", { class: "page-list qk-answers" }, d.answers.map((a) => ui.h("li", {}, ui.h("a", { href: a.href, class: "row-link" },
        ui.h("span", { class: "ic", "aria-hidden": "true" }, a.icon),
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, a.headline), ui.h("div", { class: "d" }, ui.h("span", { class: "qk-q" }, a.title), a.line)),
        ui.h("span", { class: "qk-chev", "aria-hidden": "true" }, "›"))))),
    ] : null,
    ui.h("h2", {}, d.answers.length ? "Or type your own numbers" : "Start with these"),
    ui.h("ul", { class: "page-list qk-two" }, d.mostAsked.map((q) => row(q)))));

  if (d.more.length) wrap.append(ui.h("section", { class: "card" }, ui.h("h2", { class: "qk-first" }, "More questions"), ui.h("ul", { class: "page-list qk-two" }, d.more.map((q) => row(q)))));

  const needs = d.needsFirst.filter(() => usable("overview/guide"));
  wrap.append(ui.h("section", { class: "card" },
    needs.length ? [
      ui.h("h2", { class: "qk-first" }, "Questions that need your numbers first"),
      ui.h("p", { class: "qk-sub" }, "These take a few short steps, one page at a time, then answer from your own plan."),
      ui.h("ul", { class: "page-list" }, needs.map((n) => row(n, n.icon))),
    ] : null,
    ui.h("button", { type: "button", class: "secondary qk-search", onClick: () => ctx.openSearch?.() }, "Not here? Search by a word")));
}

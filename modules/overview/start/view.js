// modules/overview/start/view.js -- DOM only. "What would you like to do?": one featured choice (the whole plan, with
// the page's filled button), a quiet list of five more, a link to the other guides, and a way to just look around.
// Every choice is a real link; tapping it remembers the choice (plan.guide.chosen) and lets the link navigate.
import { compute, setChosen } from "./compute.js";
import { startGuide } from "../guide/compute.js";
import { offKeys, usable, change } from "../guide/act.js";

const STYLE = `
.go-root .go-kicker { font-size: var(--fs-sm); font-weight: 600; color: var(--text-2); margin-bottom: 4px; }
.go-root .go-lede { color: var(--text-2); margin: 6px 0 16px; }
.go-root .go-feature { position: relative; padding: 16px; border-radius: var(--radius); background: var(--accent-soft); margin-bottom: 8px; }
.go-root .go-feature .go-fk { font-size: var(--fs-sm); font-weight: 600; color: var(--accent-ink); margin-bottom: 2px; }
.go-root .go-feature .t { font-size: var(--fs-md); font-weight: 650; color: var(--text); }
.go-root .go-feature .d { color: var(--text-2); font-size: var(--fs-sm); margin: 2px 0 12px; }
.go-root .go-feature .btn::after { content: ""; position: absolute; inset: 0; border-radius: var(--radius); }
.go-root .go-feature .btn:hover { filter: none; }
.go-root .go-feature:hover .btn:not(.secondary) { background: var(--accent-ink); border-color: var(--accent-ink); }
.go-root .page-list .row-link { align-items: center; min-height: 60px; padding: 8px 4px; }
.go-root .page-list .row-link .t { color: var(--text); }
.go-root .page-list .d { color: var(--text-2); }
.go-root .page-list .go-st { color: var(--text-2); font-size: var(--fs-sm); margin-top: 2px; font-weight: 600; }
.go-root .page-list .ic { width: 40px; height: 40px; font-size: 20px; border: 1px solid var(--line); }
.go-root .go-chev { flex: none; color: var(--muted); font-size: 22px; line-height: 1; padding-left: 4px; }
.go-root .go-link { display: inline-flex; align-items: center; min-height: 44px; margin-top: 4px; font-weight: 600; }
.go-root .go-look { width: 100%; margin-top: 12px; }
.go-root .go-foot { color: var(--text-2); font-size: var(--fs-sm); margin: 10px 0 0; }
.go-resume p { margin: 0 0 12px; }
.go-resume .go-link { display: inline-flex; align-items: center; min-height: 44px; margin-top: 4px; font-weight: 600; }
@media (min-width: 720px) {
  .go-root .page-list { display: grid; grid-template-columns: 1fr 1fr; column-gap: 24px; }
  .go-root .page-list li:nth-last-child(2) { border-bottom: 0; }   /* the last row of each column */
  .go-root .go-look { width: auto; }
}
`;

export function render(root, ctx) {
  const { ui, fmt, store } = ctx;
  const today = fmt.today();
  const d = compute(ctx.plan, { today, off: offKeys(ctx) });
  const choose = (id, alsoStart) => change(ctx, (q) => { const a = setChosen(q, id, today); const b = alsoStart ? startGuide(q, alsoStart, today) : false; return a || b; });
  const wrap = ui.h("div", {}, ui.h("style", {}, STYLE));
  root.append(wrap);

  // a guide being followed: pick up where you left off (this card then holds the page's one filled button)
  const r = d.resume;
  if (r) wrap.append(ui.h("section", { class: "card go-resume", "aria-labelledby": "go-r-h" },
    ui.h("h2", { id: "go-r-h" }, "Pick up where you left off"),
    ui.h("p", {}, `${r.icon} ${r.title}: ${r.doneCount} of ${r.total} steps done.`),
    r.next ? ui.h("a", { href: r.next.href, class: "btn", onClick: () => change(ctx, (q) => startGuide(q, r.id, today)) }, `Do step ${r.next.index}: ${r.next.short}`) : null,
    ui.h("div", {}, ui.h("a", { href: r.guideHref, class: "go-link" }, "See all its steps ›"))));

  // not connected to the PC: say where what you save goes, before anyone types for half an hour
  if (store.backend() !== "server" && !store.sandbox()) wrap.append(ui.h("div", { class: "notice info" },
    "This device is not connected to your PC, so what you save stays on this device only. To keep one plan on your phone and your PC, ",
    ui.h("a", { href: "#/system/settings" }, "connect them in Settings"), "."));

  const f = d.featured;
  const fid = "go-f-t", fdid = "go-f-d";
  const card = ui.h("section", { class: "card go-root" },
    ui.h("div", { class: "go-kicker" }, "Your financial plan"),
    ui.h("h1", {}, "What would you like to do?"),
    ui.h("p", { class: "go-lede" }, "Pick one. Each one takes you through a few short pages, one at a time. You can come back here any time: it is in the menu ☰ under Overview."),
    ui.h("div", { class: "go-feature" },
      d.empty ? ui.h("div", { class: "go-fk" }, "Not sure? Start here.") : null,
      ui.h("div", { class: "t", id: fid }, "Build my whole plan"),
      ui.h("div", { class: "d", id: fdid }, f.line),
      ui.h("a", { href: f.href, class: r ? "btn secondary" : "btn", "aria-describedby": `${fid} ${fdid}`, onClick: () => choose("whole-plan", f.state === "done" ? null : "whole-plan") }, f.label)),
    ui.h("ul", { class: "page-list" }, d.rows.filter((x) => usable(ctx, x.id === "quick" ? "overview/quick" : "overview/guide")).map((x) => ui.h("li", {},
      ui.h("a", { href: x.href, class: "row-link", onClick: () => choose(x.id) },
        ui.h("span", { class: "ic", "aria-hidden": "true" }, x.icon),
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, x.title), ui.h("div", { class: "d" }, x.line), x.status ? ui.h("div", { class: "go-st" }, x.status) : null),
        ui.h("span", { class: "go-chev", "aria-hidden": "true" }, "›"))))),
    ui.h("div", {}, ui.h("a", { href: d.more.href, class: "go-link", onClick: () => choose("more") }, d.more.label)),
    d.hasAccounts && usable(ctx, "overview/next-best-action") ? ui.h("div", {}, ui.h("a", { href: "#/overview/next-best-action", class: "go-link" }, "Not sure? See where your next spare dollar should go ›")) : null,
    ui.h("a", { href: "#/overview/dashboard", class: "btn secondary go-look", onClick: () => choose("look") }, d.empty ? "Skip this, I will look around" : "Go to my dashboard"),
    ui.h("p", { class: "go-foot" }, "Everything stays on your own computer and phone. Nothing goes to the cloud."));
  wrap.append(card);
}

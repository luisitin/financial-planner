// modules/overview/start/view.js -- DOM only. "What would you like to do?": one big card, "Set up my plan" (new: Let's
// go; started: the bar and where to pick up; done: two figures and your next move), then "Or jump straight to" as a
// grid of tiles (a quick answer, six guides, a big life change), and a quiet way to just look around.
// Every choice is a real link; tapping it remembers the choice (plan.guide.chosen) and lets the link navigate.
import { compute, setChosen } from "./compute.js";
import { startGuide } from "../guide/compute.js";
import { offKeys, usable, change } from "../guide/act.js";

const STYLE = `
.go-root { max-width: 640px; margin: 0 auto; }
.go-root h1 { text-wrap: balance; margin: 4px 0 18px; }
.go-hero { position: relative; padding: 20px 18px 18px; border-radius: calc(var(--radius) + 6px); background: var(--accent-soft); border: 1px solid var(--accent); margin: 0 0 26px; }
.go-hero .go-k { font-size: var(--fs-sm); font-weight: 650; color: var(--accent-ink); margin: 0 0 4px; }
.go-hero .go-t { font-size: var(--fs-lg); font-weight: 700; color: var(--text); margin: 0 0 4px; }
.go-hero .go-d { color: var(--text-2); margin: 0 0 14px; line-height: 1.45; }
.go-hero ul { list-style: none; padding: 0; margin: 0 0 16px; display: grid; gap: 6px; }
.go-hero li { display: flex; gap: 10px; align-items: center; color: var(--text); }
.go-hero li::before { content: "✓"; flex: none; width: 22px; height: 22px; border-radius: 50%; background: var(--accent); color: var(--on-accent); font-size: 12px; font-weight: 700; display: grid; place-items: center; }
.go-hero .btn { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 52px; font-size: var(--fs-md); }
.go-hero .btn::after { content: ""; position: absolute; inset: 0; border-radius: inherit; }
.go-hero:hover .btn { filter: brightness(1.05); }
.go-hero .go-bar { height: 8px; border-radius: 999px; background: var(--panel); overflow: hidden; margin: 4px 0 8px; }
.go-hero .go-bar > span { display: block; height: 100%; background: var(--accent); border-radius: 999px; }
.go-hero .go-figs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 6px 0 14px; }
.go-hero .go-figs .stat { background: var(--panel); }
.go-hero .go-figs > :only-child { grid-column: 1 / -1; }
.go-root h1:focus { outline: none; }
.go-hero .go-more { position: relative; z-index: 1; display: inline-flex; align-items: center; min-height: 44px; margin-top: 6px; font-weight: 600; }
.go-root h2.go-h { font-size: var(--fs-md); margin: 0 0 12px; }
.go-tiles { list-style: none; padding: 0; margin: 0 0 22px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.go-tiles a { position: relative; display: flex; flex-direction: column; gap: 4px; height: 100%; min-height: 112px; padding: 12px; border-radius: var(--radius); border: 1px solid var(--line-2); background: var(--panel); color: var(--text); text-decoration: none; }
.go-tiles a:hover { border-color: var(--accent); text-decoration: none; }
.go-tiles .ic { font-size: 26px; line-height: 1.1; }
.go-tiles .t { font-weight: 650; line-height: 1.25; }
.go-tiles .d { color: var(--text-2); font-size: var(--fs-sm); line-height: 1.35; }
.go-tiles .st { position: absolute; top: 10px; right: 10px; font-size: var(--fs-xs); font-weight: 650; padding: 2px 8px; border-radius: 999px; background: var(--accent-soft); color: var(--accent-ink); }
.go-tiles .st.done { background: var(--panel); color: var(--ok); box-shadow: inset 0 0 0 1px var(--ok); }
.go-foot { text-align: center; }
.go-foot .go-look { display: inline-flex; align-items: center; min-height: 44px; font-weight: 600; }
.go-foot p { color: var(--text-2); font-size: var(--fs-sm); margin: 6px 0 0; line-height: 1.5; }
.go-resume p { margin: 0 0 12px; }
.go-resume .go-link { display: inline-flex; align-items: center; min-height: 44px; margin-top: 4px; font-weight: 600; }
@media (max-width: 480px) { .go-hero .go-figs { grid-template-columns: 1fr; } }
@media (min-width: 720px) { .go-tiles { grid-template-columns: 1fr 1fr 1fr 1fr; } .go-hero { padding: 26px 28px 22px; } .go-hero .btn { width: auto; min-width: 280px; display: inline-flex; } }
`;

export function render(root, ctx) {
  const { ui, fmt, store } = ctx;
  const today = fmt.today();
  const d = compute(ctx.plan, { today, off: offKeys(ctx) });
  const cur = ctx.plan.meta?.currency ?? "USD";
  const money = (n) => fmt.money(Math.round(Number(n) || 0), cur);
  const choose = (id, alsoStart) => change(ctx, (q) => { const a = setChosen(q, id, today); const b = alsoStart ? startGuide(q, alsoStart, today) : false; return a || b; });
  const self = (ctx.plan.household?.people ?? []).find((p) => p.role === "self");
  const name = self && self.name && self.name !== "Me" ? self.name : null;
  const wrap = ui.h("div", { class: "go-root" }, ui.h("style", {}, STYLE));
  root.append(wrap);

  // a guide being followed: pick up where you left off
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

  const h1 = ui.h("h1", { tabindex: "-1" }, name ? `Hi ${name}. What would you like to do?` : "What would you like to do?");
  wrap.append(h1);

  // the big card: Set up my plan
  const s = d.setup;
  const btnClass = r ? "btn secondary" : "btn";
  if (usable(ctx, "overview/setup")) {
    const hero = ui.h("section", { class: "go-hero", "aria-labelledby": "go-s-t" });
    if (s.state === "new") hero.append(
      ui.h("p", { class: "go-k" }, "Start here"),
      ui.h("h2", { class: "go-t", id: "go-s-t" }, "Set up my plan"),
      ui.h("p", { class: "go-d" }, d.empty ? `${s.total} easy questions, about 5 minutes. At the end: your money on one page and your first three moves.` : `${s.total} easy questions. What your plan already has is shown, not asked again. At the end: where you stand and your first three moves.`),
      ui.h("ul", {}, ui.h("li", {}, "Rough numbers are fine"), ui.h("li", {}, "Stop any time, pick up later"), ui.h("li", {}, "No bank logins or account numbers")),
      ui.h("a", { class: btnClass, href: s.href, onClick: () => choose("setup") }, "Let's go"));
    else if (s.state === "started") hero.append(
      ui.h("p", { class: "go-k" }, `Question ${s.q} of ${s.total}`),
      ui.h("h2", { class: "go-t", id: "go-s-t" }, "Set up my plan"),
      ui.h("div", { class: "go-bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-valuenow": String(Math.round(s.share * 100)), "aria-label": "Questions answered" }, ui.h("span", { style: { width: `${Math.max(4, Math.round(s.share * 100))}%` } })),
      ui.h("p", { class: "go-d" }, s.next ? `Next: ${s.next}.` : "Pick up where you stopped."),
      ui.h("a", { class: btnClass, href: s.href, onClick: () => choose("setup") }, "Pick up where you left off"));
    else hero.append(
      ui.h("p", { class: "go-k" }, "Your plan"),
      ui.h("h2", { class: "go-t", id: "go-s-t" }, "Here's where you stand"),
      s.netWorth !== null || s.spare !== null ? ui.h("div", { class: "go-figs" },
        s.netWorth !== null ? ui.stat("What you own, minus what you owe", money(s.netWorth)) : null,
        s.spare !== null ? ui.stat("Left over each month", money(s.spare)) : null) : null,
      s.move ? ui.h("a", { class: btnClass, href: s.move.href }, `Your next move: ${s.move.title} ›`) : ui.h("a", { class: btnClass, href: "#/overview/dashboard", onClick: () => choose("look") }, "Go to my dashboard"),
      ui.h("div", {}, ui.h("a", { class: "go-more", href: s.href }, "See everything on one page ›")));
    wrap.append(hero);
  }

  // or jump straight to
  const tiles = d.tiles.filter((t) => usable(ctx, t.page));
  wrap.append(ui.h("h2", { class: "go-h" }, "Or jump straight to"),
    ui.h("ul", { class: "go-tiles" }, tiles.map((t) => ui.h("li", {},
      ui.h("a", { href: t.href, onClick: () => choose(t.id), "aria-label": t.status ? `${t.title}: ${t.status === "Done" ? "done" : `${t.status} steps done`}` : null },
        ui.h("span", { class: "ic", "aria-hidden": "true" }, t.icon),
        ui.h("span", { class: "t" }, t.title),
        ui.h("span", { class: "d" }, t.line),
        t.status ? ui.h("span", { class: `st${t.status === "Done" ? " done" : ""}`, "aria-hidden": "true" }, t.status === "Done" ? "✓ Done" : t.status) : null)))));

  // the hero already says "Go to my dashboard" once the setup is done and has no next move: no second link
  const heroDash = usable(ctx, "overview/setup") && s.state === "done" && !s.move;
  wrap.append(ui.h("div", { class: "go-foot" },
    heroDash ? null : ui.h("a", { href: "#/overview/dashboard", class: "go-look", onClick: () => choose("look") }, d.empty ? "Just exploring? Go to the dashboard ›" : "Go to my dashboard ›"),
    ui.h("p", {}, "🔒 Everything stays on your own computer and phone. No bank logins or account numbers, ever.")));
  // the first page people see: start on its heading, not behind the menu's links
  try { h1.focus({ preventScroll: true }); } catch { /* focus is a nicety */ }
}

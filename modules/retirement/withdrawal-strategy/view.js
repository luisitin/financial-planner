// modules/retirement/withdrawal-strategy/view.js -- DOM only. The four ways to take money out,
// each with what it means, and how each does on your numbers: expected returns and the worst
// stretch of history. Pick one; the Projection page uses it.
import { compute } from "./compute.js";

let pending = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  // The plan's end age, for wording only: a run that fails in the last year has lasted to the end.
  const adults = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  const endAge = Math.max(...adults.map((p) => Number(p.lifeExpectancy ?? plan.assumptions?.planEndAge ?? 95)), 0) || Number(plan.assumptions?.planEndAge ?? 95);
  const outcome = (x) => x.success ? `${money(Math.max(0, x.endReal))} left at the end` : x.failAge >= endAge ? `lasts to the end (${endAge})` : `runs out at ${x.failAge}`;
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "How much to take out each year"), ui.h("p", { class: "lede" }, "Four ways of deciding what to withdraw in retirement, compared on your own numbers. It needs the Projection page's inputs first."), ui.row(ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Set up the projection"))));
    return;
  }
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "How much to take out each year"),
    ui.h("p", { class: "lede" }, `Four ways to decide, run on your plan: with the returns you assume, and through the worst stretch of history for a plan like yours (starting in ${d.worstStartYear}). Amounts are yearly spending in today's dollars.`),
  ));
  root.append(out);
  root.append(ui.card("The four ways",
    ui.h("ul", { class: "records" }, d.rows.map((r) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, r.name, r.key === d.chosen ? ui.h("span", { class: "pill accent" }, "chosen") : null), ui.h("span", { class: "rec-value" }, `${money(r.expected.firstYear)} first year`)),
      ui.h("div", { class: "rec-sub" }, r.how),
      ui.h("div", { class: "rec-sub" }, `With your assumptions: spending between ${money(r.expected.lowest)} and ${money(r.expected.highest)}; ${outcome(r.expected)}.`),
      r.worst ? ui.h("div", { class: "rec-sub" }, `Through ${d.worstStartYear}: spending between ${money(r.worst.lowest)} and ${money(r.worst.highest)}; ${outcome(r.worst)}.`) : null,
      r.key === d.chosen ? null : ui.h("div", { class: "rec-foot" }, ui.button("Use this one", () => { pending = `Using: ${r.name}.`; store.update((p) => { p.retirement = { ...(p.retirement ?? {}), strategy: r.key }; }); }, { class: "secondary small" }))))),
    ui.h("p", { class: "muted small" }, `The percentage and guardrail methods start from ${fmt.pct(d.withdrawalRate, 1)} (Projection page settings). Steady spending is easiest to live with; the variable ones never run dry but ask you to tighten in bad years.`),
  ));
  // Where the methods come from: one fold, not a tag on every card (design log 2026-09-16, pass 4).
  root.append(ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("h2", {}, "Where these methods come from"), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
    ui.h("div", { class: "fold-body" }, d.rows.map((r) => ui.h("p", { class: "small" }, ui.h("strong", {}, `${r.name}. `), r.from)))));
}

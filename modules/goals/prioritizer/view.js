// modules/goals/prioritizer/view.js -- DOM only. The money for goals each month, shared out by priority
// and date: what each goal gets against what it needs and gets now, which arrive on time and how late the
// rest would be; one button to use these amounts on the Goals page.
import { compute } from "./compute.js";
import { PRIORITIES } from "../goals/compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.gp-root .gp-list { list-style: none; margin: 0; padding: 0; }
.gp-root .gp-list li { display: flex; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--line); }
.gp-root .gp-list li:last-child { border-bottom: 0; }
.gp-root .gp-ic { flex: none; width: 28px; text-align: center; font-size: 18px; }
.gp-root .gp-body { flex: 1; min-width: 0; }
.gp-root .gp-t { font-weight: 600; }
.gp-root .gp-d { color: var(--text-2); font-size: var(--fs-sm); }
.gp-root .gp-v { flex: none; text-align: right; white-space: nowrap; font-weight: 650; }
.gp-root .gp-v span { display: block; font-weight: 400; color: var(--muted); font-size: var(--fs-xs); }
.gp-root .gp-ok { color: var(--ok); } .gp-root .gp-late { color: var(--warn); } .gp-root .gp-none { color: var(--bad); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "gp-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const span = (m) => (m >= 12 ? `${Math.round(m / 12 * 10) / 10} years` : `${Math.round(m)} month${Math.round(m) === 1 ? "" : "s"}`);

  if (!d.count) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Which goal first?"),
      ui.h("p", { class: "lede" }, "With more than one goal, the money left each month has to be shared. This page shares it out by what matters most and what comes first, and shows which goals arrive on time."),
      ui.row(ui.h("a", { class: "btn", href: "#/goals/goals" }, "Add your goals"))));
    return;
  }
  root.append(ui.card(null, ui.row(
    ui.stat("For goals each month", money(d.available), d.override !== null ? "set by you" : "left after tax, spending and retirement saving"),
    ui.stat(d.short > 0 ? "Short of what they need" : "Left over", money(d.short > 0 ? d.short : d.leftover), d.short > 0 ? "some goals arrive late" : "every dated goal on time"),
  )));

  const list = ui.h("ul", { class: "gp-list" }, d.rows.map((r) => {
    const state = r.noDate ? (r.allocated > 0 ? ["gp-ok", "no date: gets what is left"] : ["gp-none", "no date: nothing left for it"]) : r.onTime ? ["gp-ok", `on time (${r.targetDate})`] : r.allocated <= 0.5 ? ["gp-none", "nothing left for it"] : r.slipMonths !== null ? ["gp-late", `${span(r.slipMonths)} late`] : ["gp-late", "late"];
    return ui.h("li", {}, ui.h("span", { class: "gp-ic" }, r.icon || "🎯"),
      ui.h("span", { class: "gp-body" }, ui.h("div", { class: "gp-t" }, r.name), ui.h("div", { class: "gp-d" }, `${PRIORITIES[r.priority] ?? ""}${r.needed !== null ? ` · needs ${money(r.needed)} a month` : ""} · gets ${money(r.current)} now`), ui.h("div", { class: `gp-d ${state[0]}` }, state[1])),
      ui.h("span", { class: "gp-v" }, money(r.allocated), ui.h("span", {}, "a month")));
  }));
  root.append(ui.card("Shared out", ui.h("p", { class: "muted small" }, "Must-haves first, then wants, then nice-to-haves; the nearest date first within each. Each gets what it needs to arrive on time while the money lasts."), list,
    ui.row(ui.button("Use these amounts", () => {
      pending = "Monthly amounts set on your goals.";
      store.update((p) => { for (const r of d.rows) { const g = (p.goals ?? []).find((y) => y.id === r.id); if (g) g.monthly = Math.round(r.allocated); } });
    }), ui.h("a", { class: "btn secondary", href: "#/goals/goals" }, "Goals")),
    d.leftover > 0 ? ui.h("p", { class: "muted small" }, `${money(d.leftover)} a month is left after every goal: Next best action says where it does the most good.`) : null));

  const s = plan.whatIfs?.prioritizer ?? {};
  root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "How much for goals"), ui.h("span", { class: "fold-status" }, d.override !== null ? "set by you" : "from your plan"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.form([{ key: "available", label: "Money for goals a month", type: "money", min: 0, help: d.fromPlan !== null ? `empty: your plan's ${money(d.fromPlan)}` : "empty: from your plan" }], { available: s.available ?? "" }, (v) => {
      pending = "Saved.";
      store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.prioritizer = { available: v.available ?? null }; });
    }, { submitLabel: "Save" })));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/overview/next-best-action" }, "Next best action"), ui.h("a", { class: "btn secondary", href: "#/cashflow/expenses" }, "Expenses"))));
}

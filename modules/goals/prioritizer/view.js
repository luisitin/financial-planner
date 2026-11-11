// modules/goals/prioritizer/view.js -- DOM only. The money for goals each month, shared out by priority
// and date: what each goal gets against what it needs and gets now, which arrive on time and how late the
// rest would be; one button to use these amounts on the Goals page.
import { compute } from "./compute.js";
import { PRIORITIES } from "../goals/compute.js";

let pending = null;   // the confirmation shown on the next render
let before = null;    // the monthly amounts "Use these amounts" replaced: { [goal id]: amount }, for "Put back my amounts" (x-4)

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
  // the line after "Use these amounts" stays (it carries the way back) and is drawn by the button, below; others as before
  let usedNote = null;
  if (pending && before) {
    const was = before; before = null;
    usedNote = ui.notice("ok", pending);
    usedNote.append(ui.h("div", { class: "row", style: { marginTop: "8px" } }, ui.button("Put back my amounts", () => {
      pending = "Your own monthly amounts are back.";
      store.update((p) => { for (const g of p.goals ?? []) if (g.id in was) g.monthly = was[g.id]; });
    }, { class: "secondary" })));
    pending = null;
  }
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const span = (m) => (m >= 12 ? `${Math.round(m / 12 * 10) / 10} years` : `${Math.round(m)} month${Math.round(m) === 1 ? "" : "s"}`);

  if (!d.count && !d.pastDue) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Which goal first?"),
      ui.h("p", { class: "lede" }, "With more than one goal, the money left each month has to be shared. This page divides it by what matters most and what comes first, and shows which goals arrive on time."),
      ui.row(ui.h("a", { class: "btn", href: "#/goals/goals" }, "Add your goals"))));
    return;
  }
  root.append(ui.card(null, ui.row(
    ui.stat("For goals each month", money(d.available), d.override !== null ? "set by you" : "left after tax, spending and retirement saving"),
    ui.stat(d.short > 0 ? "Short of what they need" : "Left over", money(d.short > 0 ? d.short : d.leftover), d.short > 0 ? "some goals arrive late" : "every dated goal on time"),
  )));

  const list = ui.h("ul", { class: "gp-list" }, d.rows.map((r) => {
    const state = r.noDate ? (r.allocated > 0 ? ["gp-ok", "no date: gets what is left"] : ["gp-none", "no date: nothing left for it"]) : r.onTime ? ["gp-ok", `on time (${fmt.date(r.targetDate)})`] : r.allocated <= 0.5 ? ["gp-none", "nothing left for it"] : r.slipMonths !== null ? ["gp-late", `${span(r.slipMonths)} late`] : ["gp-late", "late"];
    return ui.h("li", {}, ui.h("span", { class: "gp-ic" }, r.icon || "🎯"),
      ui.h("span", { class: "gp-body" }, ui.h("div", { class: "gp-t" }, r.name), ui.h("div", { class: "gp-d" }, `${PRIORITIES[r.priority] ?? ""}${r.needed !== null ? ` · needs ${money(r.needed)} a month` : ""} · gets ${money(r.current)} now`), ui.h("div", { class: `gp-d ${state[0]}` }, state[1])),
      ui.h("span", { class: "gp-v" }, money(r.allocated), ui.h("span", {}, "a month")));
  }));
  root.append(ui.card("How it is divided", ui.h("p", { class: "muted small" }, "Must-haves first, then wants, then nice-to-haves; the nearest date first within each. Each gets what it needs to arrive on time while the money lasts."), list,
    // asks first, naming what changes, and keeps the amounts it replaces so they can be put back (x-4: one tap rewrote every
    // goal's "Putting in each month" with no way back); once they match, a sentence instead of the button
    (() => {
      const changes = d.rows.filter((r) => Math.round(r.allocated) !== Math.round(r.current));
      if (!changes.length) return ui.h("div", {}, usedNote, ui.h("p", { class: "muted small" }, "Your goals already use these amounts."), ui.row(ui.h("a", { class: "btn secondary", href: "#/goals/goals" }, "Goals")));
      return ui.h("div", {}, usedNote, ui.row(ui.button("Use these amounts", () => {
        const names = changes.slice(0, 3).map((r) => `${r.name} ${money(r.current)} to ${money(r.allocated)}`).join(", ") + (changes.length > 3 ? `, and ${changes.length - 3} more` : "");
        if (!ui.confirm(`Change what you put in each month on ${changes.length} goal${changes.length === 1 ? "" : "s"}? ${names}. You can put your own amounts back afterwards.`)) return;
        before = Object.fromEntries((plan.goals ?? []).filter((g) => d.rows.some((r) => r.id === g.id)).map((g) => [g.id, g.monthly ?? 0]));
        pending = `Monthly amounts set on ${changes.length} goal${changes.length === 1 ? "" : "s"}.`;
        store.update((p) => { for (const r of d.rows) { const g = (p.goals ?? []).find((y) => y.id === r.id); if (g) g.monthly = Math.round(r.allocated); } });
      }), ui.h("a", { class: "btn secondary", href: "#/goals/goals" }, "Goals")));
    })(),
    d.leftover > 0 ? ui.h("p", { class: "muted small" }, `${money(d.leftover)} a month is left after every goal: Next best action says where it does the most good.`) : null,
    // a date that has passed: due now, not shared out (round 8 item 18)
    // (review UX 4: "mark it done" was said where no button does it)
    ...(d.pastDue ?? []).map((x) => ui.h("p", { class: "small" }, `${x.name}: its date has passed, with ${money(x.dueNow)} still to go. Set a new date for it on Goals, or lower its amount if less is needed.`))));

  const s = plan.whatIfs?.prioritizer ?? {};
  root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "How much for goals"), ui.h("span", { class: "fold-status" }, d.override !== null ? "set by you" : "from your plan"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.form([{ key: "available", label: "Money for goals a month", type: "money", min: 0, help: d.fromPlan !== null ? `leave blank to use your plan's ${money(d.fromPlan)}` : "leave blank to use what your plan has left each month" }], { available: s.available ?? "" }, (v) => {
      pending = "Saved.";
      store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.prioritizer = { available: v.available ?? null }; });
    }, { submitLabel: "Save" })));
  root.append(ui.card("More on this", ui.row(ui.h("a", { class: "btn secondary", href: "#/overview/next-best-action" }, "Next best action"), ui.h("a", { class: "btn secondary", href: "#/cashflow/expenses" }, "Expenses"))));
}

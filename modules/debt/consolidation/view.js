// modules/debt/consolidation/view.js -- DOM only. The debts rolled together against paying them as now: each
// way's payment, time to debt-free, interest and fees, the cheapest marked; which debts and the offers'
// terms in folds.
import { compute, DEFAULTS } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.cn-root .cn-list { list-style: none; margin: 0; padding: 0; }
.cn-root .cn-list li { padding: 11px 0; border-bottom: 1px solid var(--line); }
.cn-root .cn-list li:last-child { border-bottom: 0; }
.cn-root .cn-head { display: flex; justify-content: space-between; gap: 12px; font-weight: 650; }
.cn-root .cn-head span:last-child { white-space: nowrap; }
.cn-root .cn-best .cn-head span:last-child { color: var(--ok); }
.cn-root .cn-d { color: var(--text-2); font-size: var(--fs-sm); }
.cn-root .cn-risk { color: var(--warn); font-size: var(--fs-sm); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "cn-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const s = plan.whatIfs?.consolidation ?? {};
  const span = (m) => (!Number.isFinite(m) ? "never at this payment" : m >= 12 ? `${Math.round(m / 12 * 10) / 10} years` : `${m} months`);

  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Roll debts into one"),
      ui.h("p", { class: "lede" }, "Credit cards and loans at high rates can sometimes be moved to one cheaper debt: a personal loan, a 0% balance-transfer card, or a home-equity line. This page compares them with paying as you do now."),
      ui.h("p", { class: "muted small" }, d.candidates?.length ? "None of your debts is at 10% or more; choose any below to compare anyway." : "Add your cards and loans on Accounts, with their rates and payments on Debts."),
      ui.row(ui.h("a", { class: "btn", href: "#/debt/payoff" }, "Debts"))));
    if (d.candidates?.length) root.append(chooser());
    return;
  }
  const now = d.options[0], best = d.options.find((o) => o.id === d.best);
  root.append(ui.card(null, ui.row(
    ui.stat("Rolled together", money(d.owed), `${d.debts.length} debt${d.debts.length === 1 ? "" : "s"} at ${(d.weightedRate * 100).toFixed(1)}% on average`),
    ui.stat(best.id === "now" ? "Cheapest" : "Saves", best.id === "now" ? "Keep paying as now" : money(now.cost - best.cost), best.id === "now" ? "no offer beats it" : `${best.label.toLowerCase()} against paying as now`),
  )));
  root.append(ui.card("Each way, until debt-free", ui.h("ul", { class: "cn-list" }, d.options.map((o) => ui.h("li", { class: o.id === d.best ? "cn-best" : null },
    ui.h("div", { class: "cn-head" }, ui.h("span", {}, o.label), ui.h("span", {}, `${money(o.cost)} cost`)),
    ui.h("div", { class: "cn-d" }, `${money(o.monthly)} a month, debt-free in ${span(o.months)}: ${money(o.interest)} interest${o.fees ? ` + ${money(o.fees)} fees` : ""}. ${o.note}.`),
    o.risk ? ui.h("div", { class: "cn-risk" }, o.risk) : null))),
    ui.h("p", { class: "muted small" }, "It only works if the cards stay paid off: close nothing, but stop using them until the new debt is gone.")));
  root.append(chooser());
  root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "The offers"), ui.h("span", { class: "fold-status" }, "rates and fees"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.form([
      { key: "loanRate", label: "Personal loan rate", type: "percent", min: 0, max: 40 },
      { key: "loanMonths", label: "Personal loan length (months)", type: "number", min: 12, max: 84, step: "12" },
      { key: "loanFee", label: "Personal loan fee", type: "percent", min: 0, max: 15 },
      { key: "btFee", label: "Balance transfer fee", type: "percent", min: 0, max: 10 },
      { key: "btMonths", label: "Months at 0%", type: "number", min: 0, max: 24, step: "1" },
      { key: "btApr", label: "The card's rate after", type: "percent", min: 0, max: 40 },
      { key: "helocRate", label: "Home-equity line rate", type: "percent", min: 0, max: 20 },
      { key: "helocMonths", label: "Home-equity repayment (months)", type: "number", min: 12, max: 360, step: "12" },
    ], Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, s[k] ?? DEFAULTS[k]])), (v) => {
      pending = "Saved.";
      store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.consolidation = { ...(p.whatIfs.consolidation ?? {}), ...Object.fromEntries(Object.keys(DEFAULTS).map((k) => [k, v[k] ?? null])) }; });
    }, { submitLabel: "Compare" })));

  function chooser() {
    const chosen = new Set(Array.isArray(s.include) ? s.include : d.debts.map((x) => x.id));
    const boxes = d.candidates.map((c) => { const box = ui.h("input", { type: "checkbox", checked: chosen.has(c.id) ? true : null, "aria-label": c.name }); return { c, box, row: ui.h("label", { class: "field", style: { display: "flex", gap: "10px", alignItems: "center", minHeight: "44px" } }, box, ui.h("span", {}, `${c.name}: ${money(c.owed)} at ${(c.rate * 100).toFixed(1)}%`)) }; });
    return ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "Which debts"), ui.h("span", { class: "fold-status" }, `${d.debts?.length ?? 0} of ${d.candidates.length}`), ui.h("span", { class: "fold-chev" }, "›")),
      ...boxes.map((b) => b.row),
      ui.row(ui.button("Use these", () => {
        pending = "Saved.";
        store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.consolidation = { ...(p.whatIfs.consolidation ?? {}), include: boxes.filter((b) => b.box.checked).map((b) => b.c.id) }; });
      }, { class: "secondary" })));
  }
}

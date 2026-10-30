// modules/insurance/property/view.js -- DOM only. What a lawsuit could reach and how much cover stands
// in the way, then the checks one by one (the home's rebuild cost, the car limits, an umbrella, the
// deductibles), and the policy terms the Policies form does not ask.
import { compute } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.pr-root .pr-checks { list-style: none; margin: 0; padding: 0; }
.pr-root .pr-checks li { display: flex; gap: 10px; padding: 12px 0; border-bottom: 1px solid var(--line); }
.pr-root .pr-checks li:last-child { border-bottom: 0; }
.pr-root .pr-checks .pr-ic { flex: none; width: 22px; text-align: center; }
.pr-root .pr-checks .pr-t { font-weight: 600; }
.pr-root .pr-checks .pr-d { color: var(--text-2); font-size: var(--fs-sm); margin-top: 2px; }
.pr-root .pr-checks a { display: inline-block; margin-top: 4px; min-height: 44px; line-height: 44px; }
`;

const TERMS = {
  home: [
    { key: "rebuildCost", label: "Cost to rebuild", type: "money", min: 0, help: "the insurer's replacement-cost estimate, on the declarations page or in its app" },
    { key: "liability", label: "Liability limit", type: "money", min: 0, help: "personal liability (coverage E), often $100,000 to $500,000" },
    { key: "deductible", label: "Deductible", type: "money", min: 0, help: "what you pay first on a claim" },
  ],
  auto: [{ key: "deductible", label: "Deductible", type: "money", min: 0, help: "collision deductible, per car" }],
};

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "pr-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  if (!d.hasAny) root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Your home, your car, a lawsuit"),
    ui.h("p", { class: "lede" }, "Home and car insurance pay for damage, but their most important part is liability: what they pay if someone is hurt and sues. This page checks the cover against what you own."),
    ui.h("p", { class: "muted small" }, "Add your home or renters, car and any umbrella policies on Policies first, with the limits from the declarations page."),
    ui.row(ui.h("a", { class: "btn", href: "#/insurance/policies" }, "Add your policies"))));
  else {
    const weakest = Math.min(...[d.auto ? d.inCar : null, d.homeLiability ? d.atHome : null].filter((x) => x !== null));
    root.append(ui.card(null, ui.row(
      ui.stat("A lawsuit could reach", money(d.exposed), d.shielded > 0 ? `of ${money(d.netWorth)} net worth; retirement accounts are mostly safe` : "your net worth"),
      ui.stat("Liability cover", money(weakest), d.umbrella > 0 ? "the lower of car and home, umbrella included" : d.auto && d.homeLiability ? "the lower of car and home" : "per accident"),
    )));
  }

  if (d.checks.length) {
    const list = ui.h("ul", { class: "pr-checks" }, d.checks.map((c) => ui.h("li", {}, ui.h("span", { class: "pr-ic" }, c.ok === null ? "•" : c.ok ? "✅" : "⚠️"), ui.h("div", {},
      ui.h("div", { class: "pr-t" }, c.title), ui.h("div", { class: "pr-d" }, c.text), c.go ? ui.h("a", { href: `#/${c.go.join("/")}` }, "Go there ›") : null))));
    root.append(ui.card("The checks", list));
  }

  // the terms the Policies form does not ask
  const editable = (plan.insurance?.policies ?? []).filter((x) => TERMS[x.kind]);
  if (editable.length) {
    const missing = editable.filter((x) => x.kind === "home" && !(Number(x.rebuildCost) > 0 && Number(x.liability) > 0)).length;
    const fold = ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "Policy terms"), ui.h("span", { class: "fold-status" }, missing ? "rebuild cost or liability missing" : "all entered"), ui.h("span", { class: "fold-chev" }, "›")));
    for (const x of editable) {
      fold.append(ui.h("h3", { style: { margin: "12px 0 4px" } }, x.name), ui.form(TERMS[x.kind], Object.fromEntries(TERMS[x.kind].map((f) => [f.key, x[f.key] ?? null])), (v) => {
        pending = `${x.name} saved.`;
        store.update((p) => { const t = p.insurance.policies.find((y) => y.id === x.id); if (t) for (const f of TERMS[x.kind]) t[f.key] = v[f.key] ?? null; });
      }, { submitLabel: "Save" }));
    }
    root.append(fold);
  }
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/insurance/policies" }, "Your policies"), ui.h("a", { class: "btn secondary", href: "#/balance/net-worth" }, "Net worth"))));
}

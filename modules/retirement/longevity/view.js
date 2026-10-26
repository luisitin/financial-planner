// modules/retirement/longevity/view.js -- DOM only. Chances of reaching each age, per adult and
// for at least one of a couple, and the age the plan should run to; sex and health per person.
import { compute } from "./compute.js";

let pending = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const d = compute(plan, { today: fmt.today() });
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "How long might the money need to last?"),
    ui.h("p", { class: "lede" }, d.hasData ? d.suggestion : "Plans usually run to 95; whether that is cautious or optimistic depends on you. This page shows the chance of reaching each age, once the adults have birth dates on the People page."),
    ui.h("p", { class: "muted small" }, "A mortality curve fitted to the Social Security Administration's life tables for the general US population; a healthy non-smoker with long-lived parents sits above it, hence the health choice below. Not a prediction about you."),
  ));
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);
  if (!d.hasData) { root.append(ui.row(ui.h("a", { class: "btn", href: "#/household/people" }, "Add birth dates on People"))); return; }
  for (const p of d.people.filter((x) => x.age !== null)) {
    const sexSel = ui.select([{ value: "", label: "not said" }, { value: "f", label: "female" }, { value: "m", label: "male" }], p.sex, { "aria-label": "Sex" });
    const healthSel = ui.select([{ value: "better", label: "better than most (fit, non-smoker, long-lived family)" }, { value: "average", label: "about average" }, { value: "worse", label: "worse than most" }], p.health, { "aria-label": "Health" });
    root.append(ui.card(`${p.name}, ${p.age}`,
      ui.row(ui.stat("Life expectancy", `${Math.round(p.expectancy)}`, "the average; half live longer"), ui.stat("1 in 10 reach", `${p.planTo}`, `the plan runs to ${p.currentPlanEnd}`)),
      ui.h("ul", { class: "records" }, p.ages.map((a) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `Reaching ${a.age}`), ui.h("span", { class: "rec-value" }, fmt.pct(a.p, 0))), ui.h("div", { class: "progress", style: { margin: "6px 0 0" } }, ui.h("span", { style: { width: `${Math.round(a.p * 100)}%` } }))))),
      ui.h("div", { class: "form" }, ui.field("Sex", sexSel, "the tables differ; leave it unsaid for the average"), ui.field("Health", healthSel)),
      ui.row(ui.button("Save", () => { pending = `${p.name}'s details saved.`; store.update((pl) => { pl.retirement.longevity = pl.retirement.longevity ?? {}; pl.retirement.longevity[p.id] = { sex: sexSel.value, health: healthSel.value }; }); }, { class: "secondary" })),
    ));
  }
  if (d.either) root.append(ui.card(`At least one of ${d.either.first} and ${d.either.second}`,
    ui.h("ul", { class: "records" }, d.either.ages.map((a) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `Someone still here when ${d.either.first} would be ${a.age}`), ui.h("span", { class: "rec-value" }, fmt.pct(a.p, 0))), ui.h("div", { class: "progress", style: { margin: "6px 0 0" } }, ui.h("span", { style: { width: `${Math.round(a.p * 100)}%` } }))))),
    ui.h("p", { class: "muted small" }, `For a couple the plan must last as long as the longer life: about ${d.either.planTo} on ${d.either.first}'s clock${d.either.planToYear ? ` (${d.either.planToYear})` : ""}. Set "Plan to age" on the People page if you want the projection to use it.`),
  ));
}

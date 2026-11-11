// modules/retirement/longevity/view.js -- DOM only. Chances of reaching each age, per adult and
// for at least one of a couple, and the age the plan should run to; sex and health per person.
import { compute } from "./compute.js";
// "you" and "your" for the first adult Get started left unnamed ("Me"; round 7)
import { namesIn, nameIn, nameOf, NameOf } from "../../../core/words.js";

let pending = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const d = compute(plan, { today: fmt.today() });
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "How long might the money need to last?"),
    ui.h("p", { class: "lede" }, d.hasData ? d.suggestion : "Plans usually run to 95; whether that is cautious or optimistic depends on you. This page shows the chance of reaching each age, once the adults have birth dates on the People page."),
    ui.h("p", { class: "muted small" }, "Based on the Social Security Administration's life tables for the US population as a whole. A healthy non-smoker with long-lived parents tends to live longer, so you can pick your health below. Not a prediction about you."),
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
      ui.h("div", { class: "form" }, ui.field("Sex", sexSel, "the tables differ; leave it blank for the average"), ui.field("Health", healthSel)),
      // a single adult: the advice as a button (stress test 2026-11-11, RC-6)
      !d.either && d.apply?.ages?.[p.id] !== undefined ? ui.row(ui.button(`Plan to ${d.apply.ages[p.id]} instead of ${d.apply.from[p.id]}`, () => setAges(`Your plan now runs to ${nameOf(p.name)} age ${d.apply.ages[p.id]}${d.apply.year ? ` (${d.apply.year})` : ""}. Will the money last? uses it.`), { class: "secondary" })) : null,
    ));
    // a choice from a list is used the moment it is made (stress test 2026-11-11, RC-5: nothing changed until a separate Save, and
    // leaving dropped it): saved, the figures follow, and the green line says so
    const choose = (what) => () => {
      pending = `${NameOf(p.name)} ${what} saved: the chances above use it.`;
      store.update((pl) => { pl.retirement = pl.retirement ?? {}; pl.retirement.longevity = pl.retirement.longevity ?? {}; pl.retirement.longevity[p.id] = { sex: sexSel.value, health: healthSel.value }; });
    };
    sexSel.addEventListener("change", choose("sex"));
    healthSel.addEventListener("change", choose("health"));
  }
  if (d.either) root.append(ui.card(`At least one of ${namesIn([d.either.first, d.either.second])}`,
    ui.h("ul", { class: "records" }, d.either.ages.map((a) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `Someone still here when ${nameIn(d.either.first)} would be ${a.age}`), ui.h("span", { class: "rec-value" }, fmt.pct(a.p, 0))), ui.h("div", { class: "progress", style: { margin: "6px 0 0" } }, ui.h("span", { style: { width: `${Math.round(a.p * 100)}%` } }))))),
    ui.h("p", { class: "muted small" }, `For a couple the plan must last as long as the longer life: until ${nameIn(d.either.first)} would be about ${d.either.planTo}${d.either.planToYear ? ` (${d.either.planToYear})` : ""}.${d.apply ? ` Your plan runs to ${d.apply.fromYear} now.` : ""}`),
    // the advice as a button; the ages themselves stay on People (stress test 2026-11-11, RC-6: "Set Plan to age on the People page" was plain text)
    ui.row(d.apply ? ui.button(`Plan to ${d.apply.year} instead of ${d.apply.fromYear}`, () => setAges(`Your plan now runs to ${d.apply.year} (${d.people.filter((p) => d.apply.ages[p.id] !== undefined).map((p) => `${nameOf(p.name)} age ${d.apply.ages[p.id]}`).join(" and ")}: Plan to age on People). Will the money last? uses it.`), { class: "secondary" }) : null,
      ui.h("a", { class: "btn secondary", href: "#/household/people" }, "Change ages on People ›")),
  ));
  // write the suggested "Plan to age" for each adult it names (household.people[].lifeExpectancy, the People page's box)
  function setAges(message) {
    pending = message;
    store.update((pl) => { for (const x of pl.household?.people ?? []) if (d.apply.ages[x.id] !== undefined) x.lifeExpectancy = d.apply.ages[x.id]; });
  }
}

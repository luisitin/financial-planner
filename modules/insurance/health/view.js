// modules/insurance/health/view.js -- DOM only. The plans you can choose between, each with what it
// costs in a quiet year, your usual year and a bad year; the cheapest for your usual year first, when
// another would win, and one form to add or change a plan.
import { compute, QUIET, BAD, HDHP } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.hp-root .hp-list { list-style: none; margin: 0; padding: 0; }
.hp-root .hp-list li { padding: 12px 0; border-bottom: 1px solid var(--line); cursor: pointer; }
.hp-root .hp-list li:last-child { border-bottom: 0; }
.hp-root .hp-head { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; font-weight: 650; }
.hp-root .hp-head .hp-v { white-space: nowrap; }
.hp-root .hp-list li.hp-best .hp-v { color: var(--ok); }
.hp-root .hp-d { color: var(--text-2); font-size: var(--fs-sm); margin-top: 2px; }
.hp-root .hp-three { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 8px; }
.hp-root .hp-three div { background: var(--panel-2); border-radius: 8px; padding: 6px 8px; font-size: var(--fs-sm); }
.hp-root .hp-three b { display: block; font-size: var(--fs-md, 15px); }
.hp-root .hp-three span { color: var(--muted); font-size: var(--fs-xs); }
`;

const FIELDS = [
  { key: "name", label: "Plan name", type: "text", required: true, placeholder: "e.g. Gold PPO" },
  { key: "premium", label: "Your premium a month", type: "money", min: 0, help: "what comes out of your pay, not the employer's share" },
  { key: "deductible", label: "Deductible a year", type: "money", min: 0, help: `for the cover you choose below (family deductible for family cover)` },
  { key: "coinsurance", label: "Your share after the deductible", type: "percent", min: 0, max: 100, help: "e.g. 20 for 20%; 0 if it pays everything after the deductible" },
  { key: "oopMax", label: "Out-of-pocket maximum a year", type: "money", min: 0, help: "the most you could pay for care in a year" },
  { key: "hsa", label: "Can have a health savings account (HSA)", type: "checkbox" },
  { key: "employerHsa", label: "Employer's HSA money a year", type: "money", min: 0, help: "HSA plans only" },
];

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "hp-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  let editing = null;
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  if (!d.count) root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Which health plan?"),
    ui.h("p", { class: "lede" }, "The cheapest premium is not always the cheapest plan. Enter the plans you can choose from (open enrollment lists them) and this page adds up what each would really cost you: premiums plus your share of the bills, less any HSA money and tax savings, in a quiet year, a usual year and a bad one."),
    ui.h("p", { class: "muted small" }, "Each plan's summary of benefits has the four figures: premium, deductible, your share after it, and the out-of-pocket maximum.")));
  for (const w of d.warnings) root.append(ui.notice("warn", w));

  if (d.count) {
    const best = d.plans.find((x) => x.best);
    root.append(ui.card(null, ui.row(
      ui.stat("Cheapest for your usual year", best.name, `about ${money(best.usual.total)} all in, with ${money(d.expected)} of bills`),
      ui.stat("Its worst year", money(best.worst), "premiums plus the out-of-pocket maximum, less HSA savings"),
    )));
    const list = ui.h("ul", { class: "hp-list" }, [...d.plans].sort((a, b) => a.usual.total - b.usual.total).map((x) => ui.h("li", { class: x.best ? "hp-best" : null, role: "button", tabindex: "0",
      onClick: () => { editing = (plan.insurance.health.plans ?? []).find((y) => y.id === x.id); drawForm(true); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); },
      onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
      ui.h("div", { class: "hp-head" }, ui.h("span", {}, x.name, x.hsa ? ui.h("span", { class: "pill", style: { marginLeft: "6px" } }, "HSA") : null), ui.h("span", { class: "hp-v" }, `${money(x.usual.total)} a year`)),
      ui.h("div", { class: "hp-d" }, `${money(x.premiumsYearly)} premiums + ${money(x.usual.oop)} of care${x.hsa ? ` − ${money(x.usual.employer + x.usual.taxSaved)} HSA money and tax saved` : ""}`),
      ui.h("div", { class: "hp-three" },
        ui.h("div", {}, ui.h("span", {}, "Quiet year"), ui.h("b", {}, money(x.quiet.total))),
        ui.h("div", {}, ui.h("span", {}, "Usual year"), ui.h("b", {}, money(x.usual.total))),
        ui.h("div", {}, ui.h("span", {}, "Bad year"), ui.h("b", {}, money(x.bad.total)))))));
    const cross = d.crossovers.map((c) => c.ranges.length ? `${c.name} would be cheaper with bills ${c.ranges.map((r) => r.to === null ? `over ${money(r.from)}` : r.from === 0 ? `under ${money(r.to + 250)}` : `between ${money(r.from)} and ${money(r.to)}`).join(" or ")} a year.` : `${c.name} costs more at any level of bills.`);
    root.append(ui.card("All in, a year", ui.h("p", { class: "muted small" }, `A quiet year is ${money(QUIET)} of bills, a bad year ${money(BAD)} (a hospital stay). Tap a plan to change it.`), list,
      cross.length ? ui.h("p", { class: "hp-d", style: { marginTop: "10px" } }, cross.join(" ")) : null,
      d.plans.some((x) => x.hsa) ? ui.h("p", { class: "hp-d" }, `HSA tax savings count your care paid through the account, up to the ${money(d.hsaLimit)} ${d.tier === "family" ? "family" : "self-only"} limit, at ${Math.round(d.taxRate * 1000) / 10}% (income tax plus payroll tax). Money left in the account keeps growing tax-free.`) : null));
  }

  // add or edit a plan
  const formHost = ui.h("div");
  const drawForm = (open = !d.count) => {
    formHost.innerHTML = "";
    if (!open && !editing) { formHost.append(ui.button("+ Add another plan", () => drawForm(true), { class: "secondary" })); return; }
    const values = editing ? { ...editing } : { coinsurance: 0.2, hsa: false };
    formHost.append(ui.h("h2", {}, editing ? `Change ${editing.name}` : "Add a plan"), ui.form(FIELDS, values, (v) => {
      const clean = { name: v.name.trim(), premium: v.premium ?? 0, deductible: v.deductible ?? 0, coinsurance: v.coinsurance ?? 0, oopMax: v.oopMax ?? 0, hsa: !!v.hsa, employerHsa: v.hsa ? (v.employerHsa ?? 0) : 0 };
      if (!clean.name) return;
      pending = editing ? "Changes saved." : `${clean.name} added.`;
      const id = editing?.id;
      store.update((p) => {
        p.insurance = p.insurance ?? { policies: [] }; p.insurance.health = p.insurance.health ?? {}; p.insurance.health.plans = p.insurance.health.plans ?? [];
        if (id) { const i = p.insurance.health.plans.findIndex((x) => x.id === id); if (i >= 0) p.insurance.health.plans[i] = { ...p.insurance.health.plans[i], ...clean }; }
        else p.insurance.health.plans.push({ id: ui.uid(), ...clean });
      });
      editing = null;
    }, { submitLabel: editing ? "Save changes" : "Add plan", resetAfter: !editing, onCancel: (editing || d.count) ? () => { editing = null; drawForm(false); } : null }),
    editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button(`Remove ${editing.name}`, () => {
      if (!ui.confirm(`Remove ${editing.name}?`)) return;
      const id = editing.id, name = editing.name; editing = null;
      pending = `${name} removed.`;
      store.update((p) => { p.insurance.health.plans = (p.insurance.health.plans ?? []).filter((x) => x.id !== id); });
    }, { class: "danger" })) : null);
  };
  drawForm();
  root.append(ui.card(null, out, formHost));

  // the household's settings
  const h = plan.insurance?.health ?? {};
  root.append(ui.h("details", { class: "card fold fold-card", open: d.count ? null : true }, ui.h("summary", {}, ui.h("h2", {}, "Your cover and your bills"), ui.h("span", { class: "fold-status" }, `${d.tier === "family" ? "family" : "just you"}, ${money(d.expected)} a year`), ui.h("span", { class: "fold-chev" }, "›")),
    ui.form([
      { key: "tier", label: "Cover for", type: "select", options: [{ value: "self", label: "Just me" }, { value: "family", label: "Me and family" }] },
      { key: "expected", label: "Medical bills in a usual year", type: "money", min: 0, help: "what the plan would be charged for your visits, prescriptions and tests (not what you paid). Last year's explanation of benefits shows it; 5,000 if unsure" },
    ], { tier: d.tier, expected: h.expected ?? "" }, (v) => {
      pending = "Saved.";
      store.update((p) => { p.insurance = p.insurance ?? { policies: [] }; p.insurance.health = { ...(p.insurance.health ?? {}), tier: v.tier, expected: v.expected ?? null }; });
    }, { submitLabel: "Save" }),
    ui.h("p", { class: "muted small" }, `An HSA needs a deductible of at least ${money(HDHP[d.tier].minDeductible)} and an out-of-pocket maximum of at most ${money(HDHP[d.tier].maxOop)} (${d.tier === "family" ? "family" : "self-only"} cover, ${d.year}).`)));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/taxes/hsa-fsa" }, "HSA and FSA"), ui.h("a", { class: "btn secondary", href: "#/insurance/policies" }, "Your policies"))));
}

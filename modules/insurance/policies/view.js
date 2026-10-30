// modules/insurance/policies/view.js -- DOM only. What the policies cost and cover up top, then one
// tappable list grouped by what each protects, one form to add or edit.
import { compute, KINDS, GROUPS } from "./compute.js";
import { PERIOD_OPTIONS } from "../../../core/math/periods.js";

let pending = null;   // the confirmation shown on the next render (the shell re-renders after store.update)

const FIELDS = (people) => [
  { key: "name", label: "What is it", type: "text", required: true, placeholder: "e.g. Ana's 20-year term" },
  { key: "kind", label: "Kind of policy", type: "select", options: Object.entries(KINDS).map(([value, k]) => ({ value, label: k.label })) },
  { key: "personId", label: "Who it covers", type: "select", options: [{ value: "", label: "Household / everyone" }, ...people.map((p) => ({ value: p.id, label: p.name }))] },
  { key: "insurer", label: "Insurer", type: "text", placeholder: "the company" },
  { key: "benefit", label: "What it pays", type: "money", min: 0, help: "life: the death benefit; disability and care: the monthly benefit; auto and umbrella: the liability limit; health: the out-of-pocket maximum" },
  { key: "premium", label: "Premium", type: "money", min: 0, help: "what you pay each time" },
  { key: "period", label: "How often", type: "select", options: PERIOD_OPTIONS.filter((o) => o.value !== "once") },
  { key: "endDate", label: "Ends", type: "date", help: "term life: the last day of the term" },
  { key: "renewalDate", label: "Renews", type: "date", help: "the next renewal, for policies that renew each year" },
  { key: "cashValue", label: "Cash value", type: "money", min: 0, help: "whole or universal life only: from the latest statement" },
  { key: "throughWork", label: "Through an employer (ends with the job)", type: "checkbox" },
  { key: "notes", label: "Notes", type: "textarea", rows: 2 },
];

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(n, cur);
  const d = compute(plan, { today: fmt.today() });
  const people = plan.household?.people ?? [];
  let editing = null;

  if (d.count === 0) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "What protects you?"),
      ui.h("p", { class: "lede" }, "List every insurance policy: life, disability, long-term care, health, home, car, umbrella. With them on file the plan can tell whether a death, an illness or a lawsuit would sink it, and what each one costs you a year."),
      ui.h("p", { class: "muted small" }, "The policy's declarations page or the insurer's app has every figure the form asks for. Cover through work counts too: it is in your benefits portal."),
    ));
  } else {
    root.append(ui.card(null, ui.row(
      ui.stat("Premiums a year", money(d.premiumYearly), `${money(d.premiumMonthly)} a month`),
      ...d.byPerson.filter((p) => p.life > 0 || p.disabilityMonthly > 0).map((p) => ui.stat(`${p.name}: life cover`, money(p.life), p.disabilityMonthly ? `disability ${money(p.disabilityMonthly)} a month` : "no disability cover on file")),
    )));
  }
  for (const w of d.warnings) root.append(ui.notice("warn", w));

  const formHost = ui.h("div");
  let showForm = d.count === 0;
  const drawForm = () => {
    formHost.innerHTML = "";
    if (!showForm && !editing) { formHost.append(ui.button("+ Add another policy", () => { showForm = true; drawForm(); }, { class: "secondary" })); return; }
    const values = editing ? { ...editing } : { kind: "term", period: "monthly", personId: people.find((p) => p.role === "self")?.id ?? "" };
    formHost.append(ui.h("div", {},
      ui.h("h2", {}, editing ? `Edit ${editing.name}` : "Add a policy"),
      ui.form(FIELDS(people), values, (v) => {
        const clean = { name: v.name.trim(), kind: v.kind, personId: v.personId || "", insurer: (v.insurer ?? "").trim(), benefit: v.benefit ?? 0, premium: v.premium ?? 0, period: v.period || "monthly", endDate: v.endDate || "", renewalDate: v.renewalDate || "", cashValue: v.kind === "whole" ? (v.cashValue ?? 0) : null, throughWork: !!v.throughWork, notes: v.notes ?? "" };
        if (!clean.name) return;
        pending = editing ? "Changes saved." : `${clean.name} added.`;
        store.update((p) => {
          p.insurance = p.insurance ?? { policies: [] }; p.insurance.policies = p.insurance.policies ?? [];
          if (editing) { const i = p.insurance.policies.findIndex((x) => x.id === editing.id); if (i >= 0) p.insurance.policies[i] = { ...p.insurance.policies[i], ...clean }; }
          else p.insurance.policies.push({ id: ui.uid(), ...clean });
        });
        editing = null;
      }, { submitLabel: editing ? "Save changes" : "Add policy", resetAfter: !editing, onCancel: (editing || d.count > 0) ? () => { editing = null; showForm = false; drawForm(); } : null }),
      editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button(`Remove ${editing.name}`, () => {
        if (!ui.confirm(`Remove ${editing.name}?`)) return;
        const id = editing.id, name = editing.name; editing = null;
        pending = `${name} removed.`;
        store.update((p) => { p.insurance.policies = (p.insurance?.policies ?? []).filter((x) => x.id !== id); });
      }, { class: "danger" })) : null));
  };
  drawForm();

  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  if (d.count > 0) {
    const card = ui.card("Your policies");
    for (const [group, label] of Object.entries(GROUPS)) {
      const list = d.items.filter((x) => x.group === group);
      if (!list.length) continue;
      card.append(ui.h("h3", { style: { margin: "14px 0 2px" } }, label), ui.h("ul", { class: "page-list" }, list.map((x) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer", opacity: x.ended ? 0.6 : 1 },
        onClick: () => { editing = plan.insurance.policies.find((y) => y.id === x.id); showForm = true; drawForm(); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); },
        onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
        ui.h("span", { class: "ic" }, x.icon),
        ui.h("span", { class: "body" },
          ui.h("div", { class: "t" }, x.name, x.ended ? ui.h("span", { class: "pill" }, "ended") : x.renewsSoon ? ui.h("span", { class: "pill warn" }, "renews soon") : null),
          ui.h("div", { class: "d" }, [x.kindLabel, x.personName, x.insurer, Number(x.benefit) > 0 ? `${x.benefitLabel.toLowerCase()} ${money(x.benefit)}` : null, x.cashValue ? `cash value ${money(x.cashValue)}` : null].filter(Boolean).join(" · ")),
          x.flags.length ? ui.h("div", { class: "d", style: { color: "var(--warn)" } }, x.flags.join("; ")) : null),
        ui.h("span", { class: "st amount" }, ...(x.premiumYearly > 0 ? [ui.h("div", {}, money(x.premiumYearly)), ui.h("div", { class: "muted small" }, "a year")] : [ui.h("div", { class: "muted small" }, x.throughWork ? "paid by work" : "no premium")]), ui.h("div", { class: "muted small" }, "Edit ›"))))));
    }
    card.append(ui.h("p", { class: "muted small" }, "Tap a policy to change it."), out, formHost);
    root.append(card);
    root.append(ui.card("What the policies are for", ui.row(
      ui.h("a", { class: "btn secondary", href: "#/insurance/life-needs" }, "Life insurance needs"),
      ui.h("a", { class: "btn secondary", href: "#/scenarios/stress-tests" }, "Stress tests"))));
  } else root.append(ui.card(null, out, formHost));
  root.append(ui.h("style", {}, ".st.amount { text-align: right; }"));
}

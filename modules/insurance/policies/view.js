// modules/insurance/policies/view.js -- DOM only. What the policies cost and cover up top, then one
// tappable list grouped by what each protects, one form to add or edit.
import { compute, KINDS, GROUPS, HOME_KINDS, namesHome } from "./compute.js";
import { PERIOD_OPTIONS } from "../../../core/math/periods.js";
import { isYou } from "../../../core/words.js";

let pending = null;   // the confirmation shown on the next render (the shell re-renders after store.update)
let opened = null;    // the policy a link opened for editing (#/insurance/policies?edit=<id>), opened once (review 2026-11-06, UX 11)

const FIELDS = (people, homes) => [
  { key: "name", label: "What is it", type: "text", required: true, placeholder: "e.g. Ana's 20-year term" },
  { key: "kind", label: "Kind of policy", type: "select", options: Object.entries(KINDS).map(([value, k]) => ({ value, label: k.label })), help: "a home you rent to others needs a landlord policy, not a homeowners one" },
  // which home a home or landlord policy insures (round 8 batch 6, landlord-2 and landlord-7: the pages paired them by list order)
  homes.length ? { key: "accountId", label: "Which home", type: "select", options: [{ value: "", label: "Not tied to one home" }, ...homes.map((a) => ({ value: a.id, label: a.name || "Home" }))], help: "the home on Net worth this policy insures" } : null,
  { key: "personId", label: "Who it covers", type: "select", options: [{ value: "", label: "Household / everyone" }, ...people.map((p) => ({ value: p.id, label: p.name }))] },
  { key: "insurer", label: "Insurer", type: "text", placeholder: "the company" },
  { key: "benefit", label: "What it pays", type: "money", min: 0, help: "life: the death benefit; disability and care: the monthly benefit; home and landlord: the dwelling coverage; auto and umbrella: the liability limit; health: the out-of-pocket maximum" },
  { key: "premium", label: "Premium", type: "money", min: 0, help: "what you pay each time" },
  { key: "period", label: "How often", type: "select", options: PERIOD_OPTIONS.filter((o) => o.value !== "once") },
  { key: "endDate", label: "Ends", type: "date", help: "term life: the last day of the term" },
  { key: "renewalDate", label: "Renews", type: "date", help: "the next renewal, for policies that renew each year" },
  { key: "cashValue", label: "Cash value", type: "money", min: 0, help: "whole or universal life only: from the latest statement" },
  { key: "throughWork", label: "Through an employer (ends with the job)", type: "checkbox" },
  { key: "notes", label: "Notes", type: "textarea", rows: 2 },
].filter(Boolean);

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(n, cur);
  const d = compute(plan, { today: fmt.today() });
  const people = plan.household?.people ?? [];
  const homes = (plan.accounts ?? []).filter((a) => a.type === "property");
  let editing = null;

  if (d.count === 0) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "What protects you?"),
      ui.h("p", { class: "lede" }, "List every insurance policy: life, disability, long-term care, health, home, car, umbrella. With them on file the plan can tell whether a death, an illness or a lawsuit would sink it, and what each one costs you a year."),
      ui.h("p", { class: "muted small" }, "The policy's declarations page or the insurer's app has every figure the form asks for. Coverage through work counts too: it is in your benefits portal."),
    ));
  } else {
    root.append(ui.card(null, ui.row(
      ui.stat("Premiums a year", money(d.premiumYearly), `${money(d.premiumMonthly)} a month`),
      ...d.byPerson.filter((p) => p.life > 0 || p.disabilityMonthly > 0).map((p) => ui.stat(isYou(p.name) ? "Your life insurance" : `${p.name}: life insurance`, money(p.life), p.disabilityMonthly ? `disability ${money(p.disabilityMonthly)} a month` : "no disability insurance on file")),
    )));
  }
  for (const w of d.warnings) root.append(ui.notice("warn", w));

  const formHost = ui.h("div");
  let showForm = d.count === 0;
  const drawForm = () => {
    formHost.innerHTML = "";
    if (!showForm && !editing) { formHost.append(ui.button("+ Add another policy", () => { showForm = true; drawForm(); }, { class: "secondary" })); return; }
    const values = editing ? { ...editing } : { kind: "term", period: "monthly", personId: people.find((p) => p.role === "self")?.id ?? "" };
    // "Which home" starts on the one home a home or landlord policy's name names ("Condo landlord policy": Condo), until one is picked (UX 11)
    if (editing && HOME_KINDS.includes(editing.kind) && !editing.accountId) { const named = homes.filter((a) => namesHome(editing, a.name)); if (named.length === 1) values.accountId = named[0].id; }
    formHost.append(ui.h("div", {},
      ui.h("h2", {}, editing ? `Edit ${editing.name}` : "Add a policy"),
      (() => { const f = ui.form(FIELDS(people, homes), { accountId: "", ...values }, (v) => {
        const clean = { name: v.name.trim(), kind: v.kind, personId: v.personId || "", insurer: (v.insurer ?? "").trim(), benefit: v.benefit ?? 0, premium: v.premium ?? 0, period: v.period || "monthly", endDate: v.endDate || "", renewalDate: v.renewalDate || "", cashValue: v.kind === "whole" ? (v.cashValue ?? 0) : null, throughWork: !!v.throughWork, notes: v.notes ?? "" };
        if (!clean.name) return;
        // "Which home": kept on a home or landlord policy only, and only when one is picked
        const home = HOME_KINDS.includes(v.kind) && v.accountId ? v.accountId : null;
        const named = home ? homes.find((a) => a.id === home)?.name : null;
        pending = editing ? `Changes saved${named ? `: it insures ${named}` : ""}.` : `${clean.name} added${named ? ` for ${named}` : ""}.`;
        store.update((p) => {
          p.insurance = p.insurance ?? { policies: [] }; p.insurance.policies = p.insurance.policies ?? [];
          const put = (x) => { const y = { ...x, ...clean }; if (home) y.accountId = home; else delete y.accountId; return y; };
          if (editing) { const i = p.insurance.policies.findIndex((x) => x.id === editing.id); if (i >= 0) p.insurance.policies[i] = put(p.insurance.policies[i]); }
          else p.insurance.policies.push(put({ id: ui.uid() }));
        });
        editing = null;
      }, { submitLabel: editing ? "Save changes" : "Add policy", resetAfter: !editing, onCancel: (editing || d.count > 0) ? () => { editing = null; showForm = false; drawForm(); } : null });
        // "Which home" shows only for a home or landlord policy
        const kind = f.querySelector('[name="kind"]'), which = f.querySelector('[name="accountId"]')?.closest("label");
        const show = () => { if (which) which.style.display = HOME_KINDS.includes(kind?.value) ? "" : "none"; };
        kind?.addEventListener("change", show); show();
        return f; })(),
      editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button(`Remove ${editing.name}`, () => {
        if (!ui.confirm(`Remove ${editing.name}?`)) return;
        const id = editing.id, name = editing.name; editing = null;
        pending = `${name} removed.`;
        store.update((p) => { p.insurance.policies = (p.insurance?.policies ?? []).filter((x) => x.id !== id); });
      }, { class: "danger" })) : null));
  };
  // a link to one policy (Auto, home, umbrella's "Go there": #/insurance/policies?edit=<id>) opens its form, once (review
  // 2026-11-06, UX 11: it landed at the top of the list)
  const want = ctx.route?.query?.edit ?? null;
  let jump = false;
  if (!want) opened = null;
  else if (want !== opened) { const x = (plan.insurance?.policies ?? []).find((y) => y.id === want); if (x) { editing = x; showForm = true; jump = true; } opened = want; }
  drawForm();
  if (jump) setTimeout(() => formHost.scrollIntoView({ block: "start" }), 0);

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
          ui.h("div", { class: "d" }, [x.kindLabel, x.accountId && homes.some((a) => a.id === x.accountId) ? `insures ${homes.find((a) => a.id === x.accountId).name}` : x.personName, x.insurer, Number(x.benefit) > 0 ? `${x.benefitLabel.toLowerCase()} ${money(x.benefit)}` : null, x.cashValue ? `cash value ${money(x.cashValue)}` : null].filter(Boolean).join(" · ")),
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

// modules/retirement/contributions/view.js -- DOM only. What goes into each retirement account
// a year, with the match and the limits, and one folded form to add or edit.
import { compute } from "./compute.js";
import { PERIOD_OPTIONS } from "../../../core/math/periods.js";
import { BUCKET_OF } from "../projection/compute.js";

let pending = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const accounts = (plan.accounts ?? []).filter((a) => BUCKET_OF[a.type] && BUCKET_OF[a.type] !== "cash");
  const people = (plan.household?.people ?? []).filter((p) => p.role !== "dependent");
  let editing = null;
  const FIELDS = [
    { key: "accountId", label: "Into which account", type: "select", options: accounts.map((a) => ({ value: a.id, label: a.name })) },
    { key: "personId", label: "Whose", type: "select", options: [{ value: "", label: "Household" }, ...people.map((p) => ({ value: p.id, label: p.name }))] },
    { key: "amount", label: "Your own money", type: "money", required: true, min: 0, help: "each time it goes in" },
    { key: "period", label: "How often", type: "select", options: PERIOD_OPTIONS.filter((o) => o.value !== "once") },
    { key: "employerMatch", label: "Employer adds, a year", type: "money", min: 0, help: "the match or profit sharing, per year; blank for none" },
  ];

  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.hasData ? `${fmt.money(d.totalYearly, cur)} a year into retirement accounts` : "Retirement contributions"),
    ui.h("p", { class: "lede" }, d.hasData ? `${fmt.money(d.yearly, cur)} of your own money and ${fmt.money(d.matchYearly, cur)} from employers. The Projection page adds these every year until each person retires.` : "What you put into 401(k)s, IRAs, Roths and HSAs each pay period, plus what an employer adds. The projection needs it to know how the pot grows before retirement."),
    !accounts.length ? ui.h("p", { class: "muted small" }, "First add the retirement accounts themselves on the ", ui.h("a", { href: "#/balance/net-worth" }, "Net worth page"), " (401(k), IRA, Roth, HSA, brokerage).") : null,
  ));
  for (const w of d.warnings) root.append(ui.notice("warn", w));
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);

  if (d.byPerson.some((p) => p.limits.length)) root.append(ui.card(`Against the ${d.limitsYear} limits`,
    ui.h("ul", { class: "records" }, d.byPerson.flatMap((p) => p.limits.map((l) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${p.name}: ${l.label}`), ui.h("span", { class: "rec-value" }, `${fmt.money(l.used, cur)} of ${fmt.money(l.limit, cur)}`)),
      ui.h("div", { class: "progress", style: { margin: "6px 0 2px" } }, ui.h("span", { style: { width: `${Math.min(100, Math.round(l.used / l.limit * 100))}%`, background: l.over ? "var(--bad)" : "var(--ok)" } })),
      ui.h("div", { class: "rec-sub" }, `${l.over ? `${fmt.money(l.over, cur)} over the limit` : `${fmt.money(l.limit - l.used, cur)} of room left${l.catchUp ? `, including the catch-up allowed from ${p.age >= 60 && p.age <= 63 && l.kind === "401k" ? "60 to 63" : d.limits.kinds[l.kind]?.catchUpAge ?? 50}` : ""}`}${l.year && l.year !== d.limitsYear ? ` · ${l.year} limit` : ""}`))))),
    ui.h("p", { class: "muted small" }, "An employer's 401(k) match does not count against these; an employer's HSA money does. IRS figures; check them each January."),
  ));

  const formCard = ui.card(null);
  const formHost = ui.h("div");
  let showForm = !d.hasData;
  const drawForm = () => {
    formHost.innerHTML = "";
    if (!accounts.length) return;
    if (!showForm && !editing) { formHost.append(ui.button("+ Add another contribution", () => { showForm = true; drawForm(); }, { class: "secondary" })); return; }
    const values = editing ? { ...editing } : { period: "monthly", personId: people.find((p) => p.role === "self")?.id ?? "", accountId: accounts[0]?.id };
    formHost.append(ui.h("div", {},
      ui.h("h2", {}, editing ? `Edit: ${editing.accountName}` : "Add a contribution"),
      ui.form(FIELDS, values, (v) => {
        const clean = { accountId: v.accountId, personId: v.personId || "", amount: v.amount ?? 0, period: v.period, employerMatch: v.employerMatch ?? 0 };
        pending = editing ? "Contribution saved." : "Contribution added.";
        store.update((p) => { p.retirement.contributions = p.retirement.contributions ?? []; if (editing) { const i = p.retirement.contributions.findIndex((c) => c.id === editing.id); if (i >= 0) p.retirement.contributions[i] = { ...p.retirement.contributions[i], ...clean }; } else p.retirement.contributions.push({ id: ui.uid(), ...clean }); });
        editing = null;
      }, { submitLabel: editing ? "Save changes" : "Add contribution", resetAfter: !editing, onCancel: (editing || d.hasData) ? () => { editing = null; showForm = false; drawForm(); } : null }),
      editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button("Remove this contribution", () => { const id = editing.id; editing = null; pending = "Contribution removed."; store.update((p) => { p.retirement.contributions = (p.retirement.contributions ?? []).filter((c) => c.id !== id); }); }, { class: "danger" })) : null,
    ));
  };
  drawForm();
  if (d.items.length) root.append(ui.card("Contributions",
    ui.h("ul", { class: "page-list" }, d.items.map((c) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer" },
      onClick: () => { editing = plan.retirement.contributions.find((x) => x.id === c.id); editing = { ...editing, accountName: c.accountName }; showForm = true; drawForm(); formCard.scrollIntoView({ behavior: "smooth", block: "start" }); },
      onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
      ui.h("span", { class: "ic" }, "🏦"),
      ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, c.accountName), ui.h("div", { class: "d" }, `${c.personName} · ${fmt.money(c.amount, cur)} ${c.periodLabel.toLowerCase()}${c.matchYearly ? ` · employer adds ${fmt.money(c.matchYearly, cur)} a year` : ""}`)),
      ui.h("span", { class: "st amount" }, ui.h("div", {}, fmt.money(c.totalYearly, cur)), ui.h("div", { class: "muted small" }, "a year"))))),
  ));
  formCard.append(formHost);
  root.append(formCard);
}

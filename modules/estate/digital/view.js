// modules/estate/digital/view.js -- DOM only. The online accounts that matter and who could get into each,
// the key ones first (email, the password manager, crypto), one form to add or change one. Never a password.
import { compute, KINDS, ACCESS } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.dg-root .dg-list { list-style: none; margin: 0; padding: 0; }
.dg-root .dg-list li { display: flex; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--line); cursor: pointer; min-height: 52px; }
.dg-root .dg-list li:last-child { border-bottom: 0; }
.dg-root .dg-ic { flex: none; width: 28px; text-align: center; font-size: 18px; }
.dg-root .dg-body { flex: 1; min-width: 0; }
.dg-root .dg-t { font-weight: 600; }
.dg-root .dg-d { color: var(--text-2); font-size: var(--fs-sm); }
.dg-root .dg-st { flex: none; font-size: var(--fs-sm); }
.dg-root .dg-st.ok { color: var(--ok); } .dg-root .dg-st.no { color: var(--warn); }
.dg-root .dg-steps { margin: 4px 0 0; padding-left: 20px; }
.dg-root .dg-steps li { margin: 6px 0; }
`;

export function render(page, ctx) {
  const { ui, plan, store } = ctx;
  const d = compute(plan);
  const root = ui.h("div", { class: "dg-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  let editing = null;
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  if (!d.count) root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Your digital life"),
    ui.h("p", { class: "lede" }, "If something happened to you, could someone you trust get into your email, your photos, your password manager or your crypto? This page lists the accounts that matter and how each could be reached."),
    ui.h("p", { class: "muted small" }, "Never type a password or a recovery phrase here. Write only where it is kept and who can get to it.")));
  else root.append(ui.card(null, ui.row(ui.stat("Accounts with a plan", `${d.planned} of ${d.count}`, "someone could get in"), ui.stat("Still to plan", String(d.missing.length), d.missing.length ? d.missing.map((k) => KINDS[k].label.toLowerCase()).join(", ") : "the key accounts are covered"))));
  for (const w of d.warnings) root.append(ui.notice("warn", w));

  // the steps that cover most of it
  root.append(ui.card("Start here", ui.h("ol", { class: "dg-steps" },
    ui.h("li", {}, "Put every login in a password manager and turn on its emergency access for someone you trust."),
    ui.h("li", {}, "Name a legacy contact on your main email and phone accounts (Google: Inactive Account Manager; Apple: Legacy Contact)."),
    ui.h("li", {}, "Write the phone passcode and where the crypto recovery phrase is kept in the letter of instruction (Documents)."),
    ui.h("li", {}, "List the accounts below so the executor knows they exist."))));

  if (d.count) root.append(ui.card("Your accounts", ui.h("p", { class: "muted small" }, "Tap one to change it."), ui.h("ul", { class: "dg-list" }, [...d.items].sort((a, b) => Number(a.planned) - Number(b.planned)).map((x) => ui.h("li", { role: "button", tabindex: "0", onClick: () => { editing = (plan.estate.digital ?? []).find((y) => y.id === x.id); drawForm(true); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); }, onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
    ui.h("span", { class: "dg-ic" }, x.icon),
    ui.h("span", { class: "dg-body" }, ui.h("div", { class: "dg-t" }, x.name || x.kindLabel), ui.h("div", { class: "dg-d" }, `${x.accessLabel}${x.contact ? ` · ${x.contact}` : ""}`)),
    ui.h("span", { class: `dg-st ${x.planned ? "ok" : "no"}` }, x.planned ? "✓" : "to do"))))));

  const formHost = ui.h("div");
  const drawForm = (open = !d.count) => {
    formHost.innerHTML = "";
    if (!open && !editing) { formHost.append(ui.button("+ Add another account", () => drawForm(true), { class: "secondary" })); return; }
    const values = editing ? { ...editing } : { kind: d.missing[0] ?? "email", access: "none" };
    const tip = ui.h("p", { class: "muted small" }, KINDS[values.kind]?.tip ?? "");
    const form = ui.form([
      { key: "kind", label: "What kind", type: "select", options: Object.entries(KINDS).map(([value, k]) => ({ value, label: k.label })) },
      { key: "name", label: "Which one", type: "text", required: true, placeholder: "e.g. Ana's main email" },
      { key: "access", label: "How someone could get in", type: "select", options: Object.entries(ACCESS).map(([value, label]) => ({ value, label })) },
      { key: "contact", label: "Who", type: "text", placeholder: "e.g. Bo; my sister" },
      { key: "notes", label: "Notes (never a password)", type: "textarea", rows: 2, help: "where the recovery codes are kept, what to do with it" },
    ], values, (v) => {
      const clean = { kind: v.kind, name: v.name.trim(), access: v.access, contact: (v.contact ?? "").trim(), notes: v.notes ?? "" };
      if (!clean.name) return;
      pending = editing ? "Changes saved." : `${clean.name} added.`;
      const id = editing?.id;
      store.update((p) => {
        p.estate = p.estate ?? { documents: [], beneficiaries: [] }; p.estate.digital = p.estate.digital ?? [];
        if (id) { const i = p.estate.digital.findIndex((x) => x.id === id); if (i >= 0) p.estate.digital[i] = { ...p.estate.digital[i], ...clean }; }
        else p.estate.digital.push({ id: ui.uid(), ...clean });
      });
    }, { submitLabel: editing ? "Save changes" : "Add", resetAfter: !editing, onCancel: (editing || d.count) ? () => { editing = null; drawForm(false); } : null });
    form.querySelector("select[name=kind]")?.addEventListener("change", (e) => { tip.textContent = KINDS[e.target.value]?.tip ?? ""; });
    formHost.append(...[ui.h("h2", {}, editing ? `Change ${editing.name}` : "Add an account"), tip, form,
      editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button(`Remove ${editing.name}`, () => {
        if (!ui.confirm(`Remove ${editing.name}?`)) return;
        const id = editing.id, name = editing.name; editing = null;
        pending = `${name} removed.`;
        store.update((p) => { p.estate.digital = (p.estate.digital ?? []).filter((x) => x.id !== id); });
      }, { class: "danger" })) : null].filter(Boolean));
  };
  drawForm();
  root.append(ui.card(null, out, formHost));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/estate/documents" }, "Documents"), ui.h("a", { class: "btn secondary", href: "#/estate/beneficiaries" }, "Beneficiaries"))));
}

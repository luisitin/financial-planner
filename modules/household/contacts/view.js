// modules/household/contacts/view.js -- DOM only. The people and firms to call, grouped by what they do, each with a
// phone and email you can tap and the accounts and policies they handle (last four digits only). Banks and insurers
// named on your accounts and policies are offered as one-tap contacts.
import { compute, saveContact, removeContact, lastFour, ROLES, NO_FIRM } from "./compute.js";

let pending = null;   // the confirmation shown on the next render
let editing = null;   // the id of the contact whose form is open
let adding = false;   // the add form is open on a page that already has contacts

const STYLE = `
.ct-root .rec-foot { flex-wrap: wrap; gap: 8px; }
.ct-root .ct-checks { list-style: none; padding: 0; margin: 0; }
.ct-root .ct-checks li { padding: 10px 0; border-top: 1px solid var(--line); }
.ct-root .ct-checks li:first-child { border-top: 0; }
.ct-root .ct-reach a { display: inline-flex; align-items: center; min-height: 44px; margin-right: 16px; }
.ct-root .ct-links { margin: 12px 0 4px; }
.ct-root .ct-link { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-height: 44px; border-top: 1px solid var(--line); padding: 6px 0; }
.ct-root .ct-link label { display: flex; align-items: center; gap: 10px; flex: 1 1 200px; min-height: 44px; }
.ct-root .ct-link input[type="checkbox"] { width: 22px; height: 22px; }
.ct-root .ct-link input[type="text"] { width: 96px; min-height: 44px; }
.ct-root .card h3 { margin-top: 18px; }
`;

export function render(page, ctx) {
  const { ui, plan, store } = ctx;
  const d = compute(plan);
  const root = ui.h("div", { class: "ct-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 5000); pending = null; }
  const rerender = () => { page.replaceChildren(); render(page, ctx); };
  const accounts = (plan.accounts ?? []).filter((a) => a?.id && !NO_FIRM.includes(a.type));
  const policies = (plan.insurance?.policies ?? []).filter((p) => p?.id);

  if (d.empty) root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Who to call"),
    ui.h("p", { class: "lede" }, "Your advisor, accountant, lawyer, bank and insurers, and the person to call in an emergency, in one place, with the accounts each one handles. Only the last four digits of an account or policy number go here."),
    adding ? null : ui.row(ui.button("Add someone", () => { adding = true; rerender(); }))));

  if (d.checks.length && !d.empty) root.append(ui.card("Worth a look", ui.h("ul", { class: "ct-checks" }, d.checks.map((c) => ui.h("li", {}, c.text)))));

  // the contacts, grouped by role
  if (!d.empty) {
    const card = ui.card("Your contacts");
    for (const g of d.byRole) {
      card.append(ui.h("h3", {}, g.label), ui.h("ul", { class: "records" }, g.contacts.map((c) => (c.id === editing ? ui.h("li", {}, contactForm(c)) : record(c)))));
    }
    if (adding) card.append(ui.h("h3", {}, "Add someone"), contactForm(null));
    else if (!editing) card.append(ui.row(ui.button("+ Add someone else", () => { adding = true; rerender(); }, { class: "secondary" })));
    root.append(card);
  } else if (adding) root.append(ui.card("Add someone", contactForm(null)));

  // suggestions from the plan
  if (d.suggestions.length) root.append(ui.h("details", { class: "card fold fold-card", open: d.empty || d.suggestions.length <= 3 ? true : null },
    ui.h("summary", {}, ui.h("h2", {}, "From your accounts and policies"), ui.h("span", { class: "fold-status" }, `${d.suggestions.length} to add`), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("p", { class: "muted small" }, "These banks, lenders and insurers are named on what you already have. Add one, then fill in the phone number."),
    ui.h("ul", { class: "records" }, d.suggestions.map((s) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, s.firm), ui.h("span", { class: "rec-value" }, s.role === "bank" ? "Bank or lender" : "Insurer")),
      ui.h("div", { class: "rec-sub" }, s.what),
      ui.h("div", { class: "rec-foot" }, ui.button(`Add ${s.firm}`, () => {
        const id = ui.uid();
        pending = `Added ${s.firm}. Add a phone number so it is ready when you need it.`;
        editing = id; adding = false;
        store.update((q) => { saveContact(q, { id, role: s.role, firm: s.firm, accountIds: s.accountIds, policyIds: s.policyIds }); });
      }, { class: "secondary small" })))))));

  root.append(ui.h("p", { class: "muted small" }, "Never put passwords, full account numbers or Social Security numbers here."));

  function record(c) {
    return ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, c.name || c.firm || "Someone")),
      c.name && c.firm ? ui.h("div", { class: "rec-sub" }, c.firm) : null,
      c.phone || c.email ? ui.h("div", { class: "rec-sub ct-reach" },
        c.phone ? ui.h("a", { href: `tel:${c.phone.replace(/[^\d+]/g, "")}` }, c.phone) : null,
        c.email ? ui.h("a", { href: `mailto:${c.email}` }, c.email) : null) : ui.h("div", { class: "rec-sub" }, ui.h("span", { class: "pill warn" }, "No phone or email")),
      c.links.length ? ui.h("div", { class: "rec-sub" }, `Handles: ${c.links.map((l) => `${l.name}${l.last4 ? ` (ending ${l.last4})` : ""}`).join(", ")}`) : null,
      c.notes ? ui.h("div", { class: "rec-sub" }, c.notes) : null,
      ui.h("div", { class: "rec-foot" }, ui.h("span", { class: "rec-actions" },
        ui.button("Change", () => { editing = c.id; adding = false; rerender(); }, { class: "secondary small" }),
        ui.button("Remove", () => {
          if (!ui.confirm(`Remove ${c.name || c.firm || "this contact"}?`)) return;
          pending = `${c.name || c.firm || "The contact"} removed.`;
          if (editing === c.id) editing = null;
          store.update((q) => { removeContact(q, c.id); });
        }, { class: "secondary small" }))));
  }

  function contactForm(c) {
    const form = ui.form([
      { key: "role", label: "What they do", type: "select", options: Object.entries(ROLES).map(([value, r]) => ({ value, label: r.label })) },
      { key: "name", label: "Name", placeholder: "A person's name (optional for a firm)" },
      { key: "firm", label: "Firm or company", placeholder: "optional" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "notes", label: "Notes", type: "textarea", rows: 2, help: "for example: the claims line, office hours, what they helped with" },
    ], c ?? { role: d.empty ? "emergency" : "advisor" }, (v) => {
      if (!String(v.name ?? "").trim() && !String(v.firm ?? "").trim()) { form.append(ui.notice("error", "Add a name or a firm.")); return; }
      const picked = { accountIds: [], policyIds: [], last4: {} };
      let bad = false;
      for (const row of links.querySelectorAll(".ct-link")) {
        const on = row.querySelector('input[type="checkbox"]').checked, typed = row.querySelector('input[type="text"]').value.trim();
        if (!on) continue;
        (row.dataset.kind === "account" ? picked.accountIds : picked.policyIds).push(row.dataset.id);
        if (typed && !lastFour(typed)) bad = true; else if (typed) picked.last4[row.dataset.id] = lastFour(typed);
      }
      if (bad) { form.append(ui.notice("error", "Type only the last four digits of a number, like 1234.")); return; }
      const id = c?.id ?? ui.uid();
      const who = String(v.name ?? "").trim() || String(v.firm ?? "").trim();
      pending = c ? `${who} saved.` : `${who} added.`;
      editing = null; adding = false;
      store.update((q) => { saveContact(q, { ...v, id, ...picked }); });
    }, { submitLabel: c ? "Save" : "Add", onCancel: () => { editing = null; adding = false; rerender(); } });
    // the accounts and policies this contact handles
    const has = (kind, id) => (kind === "account" ? c?.accountIds : c?.policyIds)?.includes(id);
    const row = (kind, id, label) => ui.h("div", { class: "ct-link", "data-kind": kind, "data-id": id },
      ui.h("label", {}, ui.h("input", { type: "checkbox", checked: has(kind, id) ? true : null }), label),
      ui.h("input", { type: "text", inputmode: "numeric", maxlength: 4, placeholder: "last 4", "aria-label": `Last four digits for ${label}`, value: lastFour(c?.last4?.[id]) }));
    const links = ui.h("div", { class: "ct-links" },
      accounts.length || policies.length ? ui.h("p", { class: "muted small" }, "What they handle (tick each one; the last four digits are optional):") : null,
      ...accounts.map((a) => row("account", a.id, a.name || "Account")),
      ...policies.map((p) => row("policy", p.id, p.name || "Policy")));
    form.insertBefore(links, form.querySelector(".form-actions"));
    return form;
  }
}

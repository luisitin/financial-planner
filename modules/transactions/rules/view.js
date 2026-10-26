// modules/transactions/rules/view.js -- DOM only. The list of rules, one form, and a button
// that runs them over what is still uncategorised.
import { compute, applyRules } from "./compute.js";
import { categoriesOf } from "../categories/compute.js";

const FIELDS = (plan) => [
  { key: "contains", label: "When the bank description contains", type: "text", required: true, placeholder: "e.g. netflix" },
  { key: "category", label: "Give it the category", type: "select", options: categoriesOf(plan).map((c) => ({ value: c.id, label: `${c.icon} ${c.label}` })) },
  { key: "payee", label: "And show the payee as", type: "text", placeholder: "e.g. Netflix (blank keeps the bank's text)" },
  { key: "direction", label: "Only for", type: "select", options: [{ value: "any", label: "money in or out" }, { value: "out", label: "money going out" }, { value: "in", label: "money coming in" }] },
  { key: "accountId", label: "Only in this account", type: "select", options: [{ value: "", label: "Any account" }, ...(plan.accounts ?? []).map((a) => ({ value: a.id, label: a.name }))] },
];

let pending = null;   // confirmation kept across the shell re-render

export function render(root, ctx) {
  const { ui, store, plan } = ctx;
  const d = compute(plan);
  let editing = null;

  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Rules"),
    ui.h("p", { class: "lede" }, "A rule files a transaction for you: when the bank's description contains some text, give it this category and a readable name. Rules run on every import. The Categorise page writes one each time you confirm a payee, so you rarely need to type them here."),
    d.total ? ui.h("p", { class: "muted small" }, `${d.count} rule${d.count === 1 ? "" : "s"}. ${d.uncategorised} transaction${d.uncategorised === 1 ? "" : "s"} still uncategorised${d.wouldFix ? `, ${d.wouldFix} of them would be filed by the rules below` : ""}.`) : null,
  ));
  if (d.wouldFix) root.append(ui.card(null, ui.row(
    ui.button(`File ${d.wouldFix} uncategorised transaction${d.wouldFix === 1 ? "" : "s"} now`, () => store.update((p) => {
      const r = applyRules(p.rules ?? [], p.transactions ?? []);
      p.transactions = r.txs;
      for (const rule of p.rules ?? []) rule.hits = (rule.hits ?? 0) + (r.hits[rule.id] ?? 0);
    })),
  )));

  const formCard = ui.card(null);
  const formHost = ui.h("div");
  let showForm = d.count === 0;
  const drawForm = () => {
    formHost.innerHTML = "";
    if (!showForm && !editing) { formHost.append(ui.button("+ Add a rule", () => { showForm = true; drawForm(); }, { class: "secondary" })); return; }
    const values = editing ? { ...editing } : { direction: "any", accountId: "", category: categoriesOf(plan)[0]?.id ?? "" };
    formHost.append(ui.h("div", {},
      ui.h("h2", {}, editing ? "Edit rule" : "Add a rule"),
      ui.form(FIELDS(plan), values, (v) => {
        const clean = { contains: v.contains.trim(), category: v.category, payee: (v.payee || "").trim(), direction: v.direction || "any", accountId: v.accountId || "" };
        if (!clean.contains) return;
        pending = editing ? "Rule saved." : "Rule added.";
        store.update((p) => {
          p.rules = p.rules ?? [];
          if (editing) { const i = p.rules.findIndex((x) => x.id === editing.id); if (i >= 0) p.rules[i] = { ...p.rules[i], ...clean }; }
          else p.rules.push({ id: ui.uid(), ...clean, hits: 0, createdAt: ctx.fmt.today() });
        });
        editing = null;
      }, { submitLabel: editing ? "Save changes" : "Add rule", resetAfter: !editing, onCancel: (editing || d.count) ? () => { editing = null; showForm = false; drawForm(); } : null }),
      editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button("Remove this rule", () => {
        if (!ui.confirm("Remove this rule? Transactions it already filed keep their category.")) return;
        const id = editing.id; editing = null;
        pending = "Rule removed.";
        store.update((p) => { p.rules = (p.rules ?? []).filter((x) => x.id !== id); });
      }, { class: "danger" })) : null,
    ));
  };
  drawForm();

  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  if (d.count) {
    const acct = (id) => (plan.accounts ?? []).find((a) => a.id === id)?.name;
    root.append(ui.card("Your rules",
      ui.h("ul", { class: "page-list" }, d.rules.map((r) => ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer" },
        onClick: () => { editing = plan.rules.find((x) => x.id === r.id); showForm = true; drawForm(); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); },
        onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
        ui.h("span", { class: "body" },
          ui.h("div", { class: "t" }, `"${r.contains}" → ${r.categoryLabel}`),
          ui.h("div", { class: "d" }, [r.payee ? `shown as ${r.payee}` : null, r.direction === "out" ? "money out only" : r.direction === "in" ? "money in only" : null, r.accountId ? (acct(r.accountId) ?? "one account") : null, `${r.matches} match${r.matches === 1 ? "" : "es"} on file`].filter(Boolean).join(" · "))),
        ui.h("span", { class: "st muted" }, "Edit ›"),
      ))),
      out, formHost,
    ));
  } else { formCard.append(out, formHost); root.append(formCard); }
}

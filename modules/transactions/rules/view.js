// modules/transactions/rules/view.js -- DOM only. The list of rules, one form, and a button
// that runs them over what is still uncategorised. Gap next-60 #42 (2026-11-15): the form opens with three boxes; the
// rest (how the words match, the amount, money in or out, the account, tags) waits under "More details (optional)";
// a rule may only rename or tag; a rule's edit area moves it up or down (first match wins, said in one plain line).
import { compute, fileOpen, ruleFiles, ruleTags, alsoTexts, whenWords, amountWords, savedWords, REFUSED, movedWords, orderWords, moveRule } from "./compute.js";
import { categoriesOf } from "../categories/compute.js";
import { cleanTags } from "../splits.js";
import { rest } from "../../../core/ui/more.js";

const MATCH_OPTIONS = [{ value: "contains", label: "Contains them (usual)" }, { value: "starts", label: "Starts with them" }, { value: "exact", label: "Is exactly them" }];
const AMOUNT_OPTIONS = [{ value: "", label: "Any amount" }, { value: "exactly", label: "Exactly" }, { value: "atLeast", label: "At least" }, { value: "atMost", label: "At most" }, { value: "between", label: "Between" }];

const FIELDS = (plan, keep = "", { also = false } = {}) => [
  { key: "contains", label: "When the bank description contains", type: "text", required: true, placeholder: "e.g. netflix" },
  // starts on "Pick a category...": a rule added without touching it filed under the first category (stress test T5). Not
  // required since gap #42: a rule may only rename or tag (the save asks for one thing to do)
  { key: "category", label: "Give it the category", type: "select", options: [{ value: "", label: "Pick a category..." }, ...categoriesOf(plan).map((c) => ({ value: c.id, label: `${c.icon} ${c.label}` })),
    // a rule whose category was hidden on the Categories page still opens on it (attack, 2026-11-11)
    ...(keep && !categoriesOf(plan).some((c) => c.id === keep) ? [((c = categoriesOf(plan, { all: true }).find((x) => x.id === keep)) => ({ value: keep, label: c ? `${c.icon ?? ""} ${c.label} (hidden)`.trim() : "(category removed)" }))()] : [])] },
  // a placeholder that fits a 320 px phone (the old one was cut off at 390 px)
  { key: "payee", label: "And show the payee as", type: "text", placeholder: "e.g. Netflix (or leave blank)" },
  // one quiet tap away (gap #42): how the words match, the amount; then the two narrowing choices that were on the form
  { key: "match", label: "How the words must match", type: "select", more: true, options: MATCH_OPTIONS, help: "Capitals, store numbers and dates never count." },
  ...(also ? [{ key: "anyOf", label: "Or when it is", type: "text", more: true, help: "Other spellings, with commas between." }] : []),
  { key: "amountIs", label: "And the amount is", type: "select", more: true, options: AMOUNT_OPTIONS },
  // shown only once a kind is picked, the second only for "Between" (amountBoxes below): never two empty boxes under "Any amount"
  { key: "amountValue", label: "Amount", type: "money", more: true, min: 0 },
  { key: "amountTo", label: "And up to", type: "money", more: true, min: 0 },
  { key: "direction", label: "Money", type: "select", more: true, options: [{ value: "any", label: "In or out" }, { value: "out", label: "Only going out" }, { value: "in", label: "Only coming in" }] },
  { key: "accountId", label: "Only in this account", type: "select", more: true, options: [{ value: "", label: "Any account" }, ...(plan.accounts ?? []).map((a) => ({ value: a.id, label: a.name }))] },
  // gap #24: the rule can also tag what it files, so "Where the money goes" adds the tag up; gap #42: several tags
  { key: "tag", label: "And add tags", type: "text", more: true, placeholder: "e.g. trip", help: "One or more, with commas between, to find these by later. Where the money goes adds up each tag." },
];
/** What the form shows for a rule (the new boxes at their defaults for a rule saved before). */
const valuesOf = (r) => (r ? { ...r, category: r.category ?? "", match: r.match ?? "contains", anyOf: alsoTexts(r).join(", "), amountIs: r.amount?.is ?? "", amountValue: r.amount?.value ?? null, amountTo: r.amount?.to ?? null, tag: ruleTags(r).join(", ") }
  : { direction: "any", accountId: "", category: "", match: "contains", amountIs: "" });
const OPTIONAL = ["category", "match", "anyOf", "amount", "tag", "tags"];

let pending = null;   // { text, edit?, typed?, foldOpen? } kept across the shell re-render: the green line, the rule whose form stays open, what was typed in it
/** The amount's boxes follow its choice: none under "Any amount", "Amount" for one figure, and "And up to" too for "Between". */
function amountBoxes(f) {
  const q = (name) => f.querySelector(`[name="${name}"]`);
  const kind = q("amountIs"), one = q("amountValue")?.closest(".field"), two = q("amountTo")?.closest(".field");
  if (!kind) return;
  // .field is display: flex, which beats the hidden attribute: the style says it too
  const hide = (el, gone) => { if (!el) return; el.hidden = gone; el.style.display = gone ? "none" : ""; };
  const show = () => { hide(one, !kind.value); hide(two, kind.value !== "between"); };
  kind.addEventListener("change", show);
  show();
}

export function render(root, ctx) {
  const { ui, store, plan } = ctx;
  const d = compute(plan);
  const said = pending; pending = null;
  let editing = said?.edit ? (plan.rules ?? []).find((x) => x.id === said.edit) ?? null : null;
  // what was typed in the moved rule's form before Move up / Move down: shown again, still to be saved (critic F1, 2026-11-15)
  let carried = said?.typed && editing ? { id: editing.id, values: said.typed, open: !!said.foldOpen } : null;

  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Rules"),
    ui.h("p", { class: "lede" }, "A rule files a transaction for you: when the bank's description contains some text, give it this category and a readable name. Rules run on every import. The Categorize page writes one each time you confirm a payee, so you rarely need to type them here."),
    d.total ? ui.h("p", { class: "muted small" }, `${d.count} rule${d.count === 1 ? "" : "s"}. ${d.uncategorised} transaction${d.uncategorised === 1 ? "" : "s"} still uncategorized${d.wouldFix ? `, ${d.wouldFix} of them would be filed by the rules below` : ""}.`) : null,
  ));
  if (d.wouldFix) root.append(ui.card(null, ui.row(
    ui.button(`File ${d.wouldFix} uncategorized transaction${d.wouldFix === 1 ? "" : "s"} now`, () => store.update((p) => {
      const r = fileOpen(p.rules ?? [], p.transactions ?? []);   // the lines it files, nothing else (a filed line keeps its name)
      pending = { text: `Filed ${d.wouldFix} transaction${d.wouldFix === 1 ? "" : "s"} by your rules.` };   // stress test T4
      p.transactions = r.txs;
      for (const rule of p.rules ?? []) rule.hits = (rule.hits ?? 0) + (r.hits[rule.id] ?? 0);
    })),
  )));

  const formCard = ui.card(null);
  const formHost = ui.h("div");
  let showForm = d.count === 0 || !!editing;
  const drawForm = () => {
    formHost.innerHTML = "";
    if (!showForm && !editing) { formHost.append(ui.button("+ Add a rule", () => { showForm = true; drawForm(); }, { class: "secondary" })); return; }
    const at = editing ? (plan.rules ?? []).findIndex((x) => x.id === editing.id) : -1, n = (plan.rules ?? []).length;
    const fields = FIELDS(plan, editing?.category ?? "", { also: alsoTexts(editing).length > 0 });
    let f = null;
    const box = (name) => f?.querySelector?.(`[name="${name}"]`) ?? null;
    const kept = carried && editing && carried.id === editing.id ? carried : null;
    carried = null;
    f = ui.form(fields, kept ? kept.values : valuesOf(editing), (v) => {
      const clean = { contains: v.contains.trim() };
      if (!clean.contains) return false;
      const files = !!v.category, name = (v.payee || "").trim(), tags = cleanTags(v.tag);
      if (!files && !name && !tags.length) return ui.fieldError(box("category"), REFUSED.nothing);
      // the amount: a kind needs its figure (two for between); a box its choice hides (any amount; the second one for a
      // single figure) is not read, so nothing out of sight is saved
      const kind = v.amountIs || "", val = kind ? v.amountValue ?? null : null, to = kind === "between" ? v.amountTo ?? null : null;
      if (kind && val === null) return ui.fieldError(box("amountValue"), REFUSED.noAmount);
      if (kind === "between" && to === null) return ui.fieldError(box("amountTo"), REFUSED.noTo);
      // the keys a rule always had, in their order, so a rule saved before is saved the same; the new ones only when used
      if (files) clean.category = v.category;
      Object.assign(clean, { payee: name, direction: v.direction || "any", accountId: v.accountId || "" });
      if (v.match && v.match !== "contains") clean.match = v.match;
      const also = String(v.anyOf ?? "").split(",").map((x) => x.trim()).filter(Boolean);
      if (also.length) clean.anyOf = also;
      if (kind) clean.amount = kind === "between" ? { is: kind, value: Math.abs(val), to: Math.abs(to) } : { is: kind, value: Math.abs(val) };
      if (tags.length) clean.tag = tags[0];   // the first as before; the others after it
      if (tags.length > 1) clean.tags = tags.slice(1);
      pending = { text: savedWords({ added: !editing, files, name, tags }) };
      store.update((p) => {
        p.rules = p.rules ?? [];
        if (editing) { const i = p.rules.findIndex((x) => x.id === editing.id); if (i >= 0) { p.rules[i] = { ...p.rules[i], ...clean }; for (const k of OPTIONAL) if (!(k in clean)) delete p.rules[i][k]; } }
        else p.rules.push({ id: ui.uid(), ...clean, hits: 0, createdAt: ctx.fmt.today() });
      });
      editing = null;
    }, { submitLabel: editing ? "Save changes" : "Add rule", resetAfter: !editing, moreOpen: kept?.open || undefined,
      onCancel: (editing || d.count) ? () => { editing = null; showForm = false; drawForm(); } : null });
    amountBoxes(f);
    // a rule's place: first match wins, so Move up and Move down (44 px, outlined) sit in one quiet row over the form; the form
    // stays open after a move, with what was typed in it (not saved: Save changes still saves it) and its More details as it was
    const move = (by) => {
      const id = editing.id;
      const raw = Object.fromEntries(fields.map((fd) => [fd.key, box(fd.key)?.value ?? ""]));
      const fold = f?.querySelector?.(".form-more");
      pending = { text: movedWords(by, at + Math.sign(by), n), edit: id, typed: ui.readValues(fields, raw).values, foldOpen: !!fold && fold.hasAttribute("open") };
      store.update((p) => { p.rules = moveRule(p.rules ?? [], id, by); });
    };
    const moves = editing ? [at > 0 ? ui.button("Move up", () => move(-1), { class: "secondary" }) : null,
      at >= 0 && at < n - 1 ? ui.button("Move down", () => move(1), { class: "secondary" }) : null].filter(Boolean) : [];
    formHost.append(ui.h("div", {},
      ui.h("h2", {}, editing ? "Edit rule" : "Add a rule"),
      moves.length ? ui.h("div", { class: "row", style: { marginBottom: "12px", gap: "8px", flexWrap: "wrap" } }, ...moves) : null,
      f,
      editing ? ui.h("p", { style: { marginTop: "12px" } }, ui.button("Remove this rule", () => {
        if (!ui.confirm("Remove this rule? Transactions it already filed keep their category.")) return;
        const id = editing.id; editing = null;
        pending = { text: "Rule removed." };
        store.update((p) => { p.rules = (p.rules ?? []).filter((x) => x.id !== id); });
      }, { class: "danger" })) : null,
    ));
  };
  drawForm();

  const out = ui.h("div");
  if (said?.text) { const n = ui.notice("ok", said.text); out.append(n); setTimeout(() => n.remove(), 4000); }
  if (d.count) {
    const acct = (id) => (plan.accounts ?? []).find((a) => a.id === id)?.name;
    const numbered = d.count > 1, renames = d.rules.some((r) => !ruleFiles(r));
    const row = (r, i) => {
      const files = ruleFiles(r), tags = ruleTags(r), tagWords = tags.length ? `adds ${tags.map((t) => `#${t}`).join(", ")}` : null;
      const does = files ? r.categoryLabel : r.payee ? `shown as ${r.payee}` : tagWords;
      return ui.h("li", { role: "button", tabindex: "0", style: { cursor: "pointer" },
        onClick: () => { editing = plan.rules.find((x) => x.id === r.id); showForm = true; drawForm(); formHost.scrollIntoView({ behavior: "smooth", block: "start" }); },
        onKeydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.currentTarget.click(); } } },
        numbered ? ui.h("span", { class: "ic ic-sm" }, String(i + 1)) : null,
        ui.h("span", { class: "body" },
          ui.h("div", { class: "t" }, `${whenWords(r)} → ${does}`),
          ui.h("div", { class: "d" }, [files && r.payee ? `shown as ${r.payee}` : null, amountWords(r.amount) || null, files || r.payee ? tagWords : null, r.direction === "out" ? "money out only" : r.direction === "in" ? "money in only" : null, r.accountId ? (acct(r.accountId) ?? "one account") : null, `${r.matches} match${r.matches === 1 ? "" : "es"} on file`].filter(Boolean).join(" · "))),
        ui.h("span", { class: "st muted" }, "Edit ›"));
    };
    root.append(ui.card("Your rules",
      numbered ? ui.h("p", { class: "muted small" }, orderWords(renames)) : null,
      ...rest(ctx, { id: "rules", items: d.rules, row, noun: "rules", one: "rule", list: "page-list" }),
      out, formHost,
    ));
  } else { formCard.append(out, formHost); root.append(formCard); }
}

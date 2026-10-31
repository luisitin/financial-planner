// modules/household/documents/view.js -- DOM only. The list of important papers, grouped and folded, each with where
// it is kept, where a copy is and who else knows. A row opens a small form in place; the will and other estate papers
// are shown as Estate documents keeps them, with a link there. Never the paper itself or what it says.
import { compute, savePlace, addPaper, clearPlace } from "./compute.js";

let pending = null;    // the confirmation shown on the next render
let editing = null;    // the key of the row whose form is open
let opened = null;     // the groups the person opened or closed (null = the page decides)
let adding = false;    // the "add a paper" form is open

const STYLE = `
.dv-root .rec-foot { flex-wrap: wrap; gap: 8px; }
.dv-root .dv-help { color: var(--muted); font-size: var(--fs-sm); margin: 4px 0 0; }
.dv-root .dv-what { color: var(--muted); font-size: var(--fs-sm); margin: 0 0 8px; }
.dv-root .dv-checks { list-style: none; padding: 0; margin: 0; }
.dv-root .dv-checks li { padding: 10px 0; border-top: 1px solid var(--line); }
.dv-root .dv-checks li:first-child { border-top: 0; }
.dv-root .dv-checks a { display: inline-block; min-height: 44px; line-height: 44px; }
.dv-root .fold-status { white-space: normal; text-align: right; }
.dv-root .dv-extra { border-top: 1px solid var(--line); margin-top: 4px; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const today = fmt.today();
  const d = compute(plan, { today });
  const root = ui.h("div", { class: "dv-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 5000); pending = null; }
  const rerender = () => { page.replaceChildren(); render(page, ctx); };
  const next = d.groups.flatMap((g) => g.rows).find((r) => !r.done && !r.optional && !r.readOnly)?.key ?? null;   // the one filled button
  if (!opened) opened = new Set([d.groups.find((g) => g.rows.some((r) => !r.done && !r.optional))?.key ?? "id"]);

  if (!d.started) root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Where your papers are"),
    ui.h("p", { class: "lede" }, "If there were a fire, a flood or an emergency, could you, or someone you trust, find your birth certificates, deed, insurance policies and will? Write down where each one is kept. Only the place goes here, never the paper or the numbers on it."),
    ui.h("p", { class: "muted small" }, "Start with the first group below: tap a paper and write where it is.")));
  else root.append(ui.h("section", { class: "card" }, ui.row(
    ui.stat("Papers with a place", `${d.placed} of ${d.total}`, d.placed === d.total ? "everything is written down" : `${d.total - d.placed} still to write down`))));

  if (d.checks.length && d.started) root.append(ui.card("Worth a look", ui.h("ul", { class: "dv-checks" }, d.checks.map((c) => ui.h("li", {},
    ui.h("span", {}, c.text), c.go ? ui.h("div", {}, ui.h("a", { href: `#/${c.go.join("/")}` }, "Open Estate documents ›")) : null)))));

  for (const g of d.groups) {
    if (g.key === "estate" && !g.rows.length) {
      root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, g.label), ui.h("p", { class: "muted" }, "No will or other estate paper is marked as signed yet. Estate documents walks you through them and keeps where each one is."),
        ui.row(ui.h("a", { class: "btn secondary small", href: "#/estate/documents" }, "Open Estate documents"))));
      continue;
    }
    if (g.key === "own" && !g.rows.length && !adding) {
      root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, g.label), ui.h("p", { class: "muted small" }, "Anything else worth finding quickly: a pension letter, a storage unit contract, a pet's papers."),
        ui.row(ui.button("+ Add a paper", () => { adding = true; rerender(); }, { class: "secondary" }))));
      continue;
    }
    const det = ui.h("details", { class: "card fold fold-card", open: opened.has(g.key) || g.rows.some((r) => r.key === editing) || (g.key === "own" && adding) ? true : null },
      ui.h("summary", {}, ui.h("h2", {}, g.label), ui.h("span", { class: "fold-status" }, g.total ? `${g.placed} of ${g.total}` : g.rows.length ? "done" : ""), ui.h("span", { class: "fold-chev" }, "›")));
    det.addEventListener("toggle", () => { if (det.open) opened.add(g.key); else opened.delete(g.key); });
    const item = (r) => (r.key === editing ? ui.h("li", {}, editForm(r)) : record(r));
    const main = g.rows.filter((r) => !r.optional), extra = g.rows.filter((r) => r.optional);
    det.append(ui.h("p", { class: "dv-what" }, g.what));
    if (main.length) det.append(ui.h("ul", { class: "records" }, main.map(item)));
    if (extra.length) {
      const noted = extra.filter((r) => r.done).length;
      det.append(ui.h("div", { class: "folds dv-extra" }, ui.h("details", { class: "fold", open: extra.some((r) => r.key === editing) ? true : null },
        ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Only if you have them"), ui.h("span", { class: "fold-status" }, noted ? `${noted} of ${extra.length} noted` : `${extra.length} more`), ui.h("span", { class: "fold-chev" }, "›")),
        ui.h("div", { class: "fold-body" }, ui.h("ul", { class: "records" }, extra.map(item))))));
    }
    if (g.key === "own") det.append(adding ? addForm() : ui.row(ui.button("+ Add another paper", () => { adding = true; editing = null; rerender(); }, { class: "secondary" })));
    root.append(det);
  }

  root.append(ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("h2", {}, "Good places to keep papers"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("p", {}, "Keep the originals together in one place that survives a fire or flood, such as a fireproof and waterproof box at home or a safe deposit box. Keep a copy somewhere else: with someone you trust, or as scanned files in a protected folder."),
    ui.h("p", {}, "A lost birth certificate, marriage license or divorce decree can be ordered again from the vital records office of the state where it happened, usually for a small fee."),
    ui.h("p", { class: "muted small" }, "From the Federal Emergency Management Agency's Emergency Financial First Aid Kit and Ready.gov. Never write passwords, full account numbers or Social Security numbers here.")));

  function record(r) {
    const title = `${r.label}${r.personName ? ` · ${r.personName}` : ""}`;
    const status = r.none ? ui.h("span", { class: "pill" }, "Do not have") : r.placed ? ui.h("span", { class: "pill ok" }, "Noted") : r.optional ? ui.h("span", { class: "muted small" }, "if you have one") : null;
    return ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, title), ui.h("span", { class: "rec-value" }, status)),
      r.placed ? ui.h("div", { class: "rec-sub" }, `Kept: ${r.where}`) : null,
      r.copy ? ui.h("div", { class: "rec-sub" }, `Copy: ${r.copy}`) : null,
      r.who ? ui.h("div", { class: "rec-sub" }, `Also knows: ${r.who}`) : null,
      r.stale ? ui.h("div", { class: "rec-sub" }, ui.h("span", { class: "pill warn" }, `Written ${fmt.date(r.updatedAt)}: still right?`)) : null,
      r.readOnly && !r.placed ? ui.h("div", { class: "rec-sub" }, "Signed; where it is kept is not written down yet.") : null,
      r.help && !r.placed ? ui.h("p", { class: "dv-help" }, r.help) : null,
      ui.h("div", { class: "rec-foot" }, r.readOnly
        ? ui.h("a", { class: "btn secondary small", href: `#/${r.go.join("/")}` }, r.placed ? "Change on Estate documents" : "Add where on Estate documents")
        : ui.button(r.done ? "Change" : "Write where it is", () => { editing = r.key; adding = false; rerender(); }, { class: r.key === next ? "small" : "secondary small" })));
  }

  function editForm(r) {
    const fields = [
      ...(r.custom ? [{ key: "label", label: "What paper", required: true }] : []),
      { key: "where", label: "Where it is kept", placeholder: "For example: fire safe in the hall closet" },
      { key: "copy", label: "Where a copy is (optional)", placeholder: "For example: scanned in the family folder" },
      { key: "who", label: "Who else knows (optional)", placeholder: "For example: my sister" },
      ...(r.optional && !r.custom ? [{ key: "none", label: "We do not have this", type: "checkbox" }] : []),
    ];
    const form = ui.form(fields, { label: r.label, where: r.where, copy: r.copy, who: r.who, none: r.none }, (v) => {
      if (!v.none && !String(v.where ?? "").trim()) { form.append(ui.notice("error", r.optional ? "Write where it is kept, or tick \"We do not have this\"." : "Write where it is kept, or tap Cancel.")); return; }
      pending = v.none ? `${r.label} marked as one you do not have.` : `Saved where your ${(r.custom ? String(v.label) : r.label).toLowerCase()}${r.personName ? ` (${r.personName})` : ""} is kept.`;
      editing = null;
      store.update((q) => { savePlace(q, r.key, v, today); });
    }, { submitLabel: "Save", onCancel: () => { editing = null; rerender(); } });
    const out = ui.h("div", {}, ui.h("h3", {}, `${r.label}${r.personName ? ` · ${r.personName}` : ""}`), r.help ? ui.h("p", { class: "dv-help" }, r.help) : null, form);
    if (r.done) out.append(ui.row(ui.button(r.custom ? "Remove this paper" : "Clear what is written", () => {
      if (!ui.confirm(r.custom ? `Remove ${r.label} from the list?` : `Clear where ${r.label} is kept?`)) return;
      pending = r.custom ? `${r.label} removed.` : `Cleared ${r.label}.`;
      editing = null;
      store.update((q) => { clearPlace(q, r.key); });
    }, { class: "secondary small" })));
    return out;
  }

  function addForm() {
    const form = ui.form([
      { key: "label", label: "What paper", required: true, placeholder: "For example: pension letter" },
      { key: "where", label: "Where it is kept", required: true },
      { key: "copy", label: "Where a copy is (optional)" },
      { key: "who", label: "Who else knows (optional)" },
    ], {}, (v) => {
      pending = `${String(v.label).trim() || "The paper"} added.`;
      adding = false;
      opened.add("own");
      store.update((q) => { addPaper(q, ui.uid(), v.label, v, today); });
    }, { submitLabel: "Add it", onCancel: () => { adding = false; rerender(); } });
    return ui.h("div", {}, ui.h("h3", {}, "Add a paper"), form);
  }
}

// modules/household/documents/view.js -- DOM only. The list of important papers, each group a quiet row that opens in place
// (simple first, docs/OPTIONAL.md: core/ui/more.js parts), each paper with where it is kept, where a copy is and who else
// knows. A paper opens a small form in place; the will and other estate papers are shown as Estate documents keeps them,
// with a link there. One filled button on the first view: the next paper to write down. Never the paper or what it says.
import { compute, savePlace, addPaper, clearPlace } from "./compute.js";
import { part, parts, links } from "../../../core/ui/more.js";

let pending = null;    // { text, part }: the confirmation shown on the next render, and the group that stays open (R17)
let editing = null;    // the key of the row whose form is open
let adding = false;    // the "add a paper" form is open

const STYLE = `
.dv-root .rec-foot { flex-wrap: wrap; gap: 8px; }
.dv-root .dv-help { color: var(--muted); font-size: var(--fs-sm); margin: 4px 0 0; }
.dv-root .dv-what { color: var(--muted); font-size: var(--fs-sm); margin: 0; }
.dv-root .dv-checks { list-style: none; padding: 0; margin: 0; }
.dv-root .dv-checks li { padding: 10px 0; border-top: 1px solid var(--line); }
.dv-root .dv-checks li:first-child { border-top: 0; }
.dv-root .dv-checks a { display: inline-block; min-height: 44px; line-height: 44px; }
.dv-root .dv-next { margin: 10px 0 0; color: var(--text-2); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const today = fmt.today();
  const d = compute(plan, { today });
  const root = ui.h("div", { class: "dv-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  const just = pending; pending = null;
  if (just) root.append(ui.notice("ok", just.text));
  const redraw = () => (ctx.redraw ? ctx.redraw() : (page.replaceChildren(), render(page, ctx)));
  const named = (r) => `${r.label}${r.personName ? ` (${r.personName})` : ""}`;
  // the one filled way on: the next paper to write down (none while a form is open: its Save is the filled button then)
  const nextRow = d.groups.flatMap((g) => g.rows).find((r) => !r.done && !r.optional && !r.readOnly) ?? null;
  const way = nextRow && !editing && !adding ? [ui.h("p", { class: "dv-next" }, `Next paper: ${named(nextRow)}`),
    ui.row(ui.button("Write where it is kept", () => { editing = nextRow.key; adding = false; redraw(); }))] : [];

  if (!d.started) root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Where your papers are"),
    ui.h("p", { class: "lede" }, "If there were a fire or a flood, could you or someone you trust find your birth certificates, deed, policies and will? Write down where each one is kept: only the place, never the paper or its numbers."),
    ...way));
  else root.append(ui.h("section", { class: "card" }, ui.row(
    ui.stat("Papers with a place", `${d.placed} of ${d.total}`, d.placed === d.total ? "everything is written down" : `${d.total - d.placed} still to write down`)), ...way));

  if (d.checks.length && d.started) root.append(ui.card("Worth a look", ui.h("ul", { class: "dv-checks" }, d.checks.map((c) => ui.h("li", {},
    ui.h("span", {}, c.text), c.go ? ui.h("div", {}, ui.h("a", { href: `#/${c.go.join("/")}` }, "Open Estate documents ›")) : null)))));

  // each group a quiet row of one card; papers of your own only once there are some (else one outlined button)
  const item = (r) => (r.key === editing ? ui.h("li", {}, editForm(r)) : record(r));
  const rows = [];
  for (const g of d.groups) {
    if (g.key === "own" && !g.rows.length && !adding) continue;
    const id = `papers-${g.key}`;
    const holdsEdit = g.rows.some((r) => r.key === editing) || (g.key === "own" && adding);
    const says = g.key === "estate" && !g.rows.length ? "none signed yet" : g.total ? `${g.placed} of ${g.total}` : g.rows.length ? "done" : "";
    rows.push(part(ctx, { id, kind: "item", title: g.label, says, open: holdsEdit || just?.part === id ? true : undefined, body: () => {
      const out = [ui.h("p", { class: "dv-what" }, `${g.what} Tap a paper to write where it is kept, where a copy is and who else knows.`)];
      if (g.key === "estate" && !g.rows.length) {
        out.push(ui.h("p", { class: "muted" }, "No will or other estate paper is marked as signed yet. Estate documents walks you through each one (a will, powers of attorney, a health care directive) and keeps track of where each is kept."),
          ui.row(ui.h("a", { class: "btn secondary small", href: "#/estate/documents" }, "Open Estate documents")));
        return out;
      }
      const main = g.rows.filter((r) => !r.optional), extra = g.rows.filter((r) => r.optional);
      if (main.length) out.push(ui.h("ul", { class: "records" }, main.map(item)));
      if (extra.length && extra.length < 3) out.push(ui.h("h3", {}, "Only if you have them"), ui.h("ul", { class: "records" }, extra.map(item)));   // a fold is worth a tap only with three rows
      else if (extra.length) {
        const noted = extra.filter((r) => r.done).length;
        out.push(ui.h("div", { class: "folds" }, part(ctx, { id: `extra-${g.key}`, kind: "item", title: "Only if you have them", says: noted ? `${noted} of ${extra.length} noted` : `${extra.length} more`,
          open: extra.some((r) => r.key === editing) ? true : undefined, body: () => ui.h("ul", { class: "records" }, extra.map(item)) })));
      }
      if (g.key === "own") out.push(adding ? addForm() : ui.row(ui.button("+ Add another paper", () => { adding = true; editing = null; redraw(); }, { class: "secondary" })));
      return out;
    } }));
  }
  root.append(ui.h("section", { class: "card" }, ui.h("h2", {}, "Your papers"), ui.h("div", { class: "folds" }, rows),
    !d.groups.find((g) => g.key === "own").rows.length && !adding ? ui.row(ui.button("+ Add a paper of your own", () => { adding = true; editing = null; redraw(); }, { class: "secondary" })) : null));

  root.append(parts(ctx, { id: "places", kind: "how", title: "Good places to keep papers", says: "3 tips", body: () => [
    ui.h("p", {}, "Keep the originals together in one place that survives a fire or flood, such as a fireproof and waterproof box at home or a safe deposit box. Keep a copy somewhere else: with someone you trust, or as scanned files in a protected folder."),
    ui.h("p", {}, "A lost birth certificate, marriage license or divorce decree can be ordered again from the vital records office of the state where it happened, usually for a small fee."),
    ui.h("p", { class: "muted small" }, "From the Federal Emergency Management Agency's Emergency Financial First Aid Kit and Ready.gov. Never write passwords, full account numbers or Social Security numbers here.")] }));
  // the deeper pages, once there is something written (before that, the one way to start is the button above)
  if (d.started) root.append(links(ctx, [
    { href: "#/estate/documents", ask: "Are the will and the other papers signed?", says: "Estate documents" },
    { href: "#/reports/if-something-happens", ask: "What would your family need if something happened to you?", says: "One packet to print" },
  ]));

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
        : ui.button(r.done ? "Change" : "Write where it is", () => { editing = r.key; adding = false; redraw(); }, { class: "secondary small" })));
  }
  const groupOf = (key) => `papers-${d.groups.find((g) => g.rows.some((r) => r.key === key))?.key ?? "own"}`;

  function editForm(r) {
    const fields = [
      ...(r.custom ? [{ key: "label", label: "What paper", required: true }] : []),
      { key: "where", label: "Where it is kept", placeholder: "For example: fire safe in the hall closet" },
      { key: "copy", label: "Where a copy is (optional)", placeholder: "For example: scanned in the family folder" },
      { key: "who", label: "Who else knows (optional)", placeholder: "For example: my sister" },
      ...(r.optional && !r.custom ? [{ key: "none", label: "We do not have this", type: "checkbox" }] : []),
    ];
    const form = ui.form(fields, { label: r.label, where: r.where, copy: r.copy, who: r.who, none: r.none }, (v) => {
      if (!v.none && !String(v.where ?? "").trim()) { form.append(ui.notice("error", r.optional ? "Write where it is kept, or check \"We do not have this\"." : "Write where it is kept, or tap Cancel.")); return; }
      pending = { part: groupOf(r.key), text: v.none ? `${r.label} marked as one you do not have.` : `Saved where your ${(r.custom ? String(v.label) : r.label).toLowerCase()}${r.personName ? ` (${r.personName})` : ""} is kept.` };
      editing = null;
      store.update((q) => { savePlace(q, r.key, v, today); });
    }, { submitLabel: "Save", onCancel: () => { editing = null; redraw(); } });
    const out = ui.h("div", {}, ui.h("h3", {}, `${r.label}${r.personName ? ` · ${r.personName}` : ""}`), r.help ? ui.h("p", { class: "dv-help" }, r.help) : null, form);
    if (r.done) out.append(ui.row(ui.button(r.custom ? "Remove this paper" : "Clear what is written", () => {
      if (!ui.confirm(r.custom ? `Remove ${r.label} from the list?` : `Clear where ${r.label} is kept?`)) return;
      pending = { part: groupOf(r.key), text: r.custom ? `${r.label} removed.` : `Cleared ${r.label}.` };
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
      pending = { part: "papers-own", text: `${String(v.label).trim() || "The paper"} added.` };
      adding = false;
      store.update((q) => { addPaper(q, ui.uid(), v.label, v, today); });
    }, { submitLabel: "Add it", onCancel: () => { adding = false; redraw(); } });
    return ui.h("div", {}, ui.h("h3", {}, "Add a paper"), form);
  }
}

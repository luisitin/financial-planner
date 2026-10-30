// modules/taxes/documents/view.js -- DOM only. The forms to collect for the tax year, grouped by when each
// arrives, a tick when it has come; documents of your own added in a fold.
import { compute } from "./compute.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.td-root .td-list { list-style: none; margin: 0; padding: 0; }
.td-root .td-list li { border-bottom: 1px solid var(--line); }
.td-root .td-list li:last-child { border-bottom: 0; }
.td-root .td-item { display: flex; gap: 12px; align-items: flex-start; padding: 10px 0; min-height: 44px; cursor: pointer; }
.td-root .td-item input { width: 22px; height: 22px; margin-top: 2px; flex: none; accent-color: var(--accent); }
.td-root .td-form { font-weight: 650; }
.td-root .td-got .td-form { text-decoration: line-through; color: var(--text-2); }
.td-root .td-d { color: var(--text-2); font-size: var(--fs-sm); }
.td-root .td-remove { margin-left: auto; flex: none; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "td-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const deadline = new Date(`${d.deadline}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

  root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, `Tax papers for ${d.year}`),
    ui.h("p", { class: "lede" }, `The forms to gather before you file, worked out from your plan: who sends each one and when it should arrive. Tick each one as it comes. The return is due ${deadline}.`)));
  root.append(ui.card(null, ui.row(
    ui.stat("Received", `${d.received} of ${d.total}`, d.received === d.total ? "everything is in" : `${d.total - d.received} still to come`),
    ui.stat("Filing deadline", deadline, "an extension gives until October, but not more time to pay"),
  )));

  const order = ["now", "by January 31", "by February 15", "by March 15 (K-1s often come later)"];
  const groups = new Map();
  for (const x of d.items) {
    const g = order.includes(x.due) ? x.due : x.due?.startsWith("by May 31") ? "may" : "other";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(x);
  }
  const titles = { now: "Have it now", "by January 31": "Arrives by January 31", "by February 15": "Arrives by February 15", "by March 15 (K-1s often come later)": "Arrives by March 15", may: "Arrives by May 31 (no need to wait for it)", other: "Other papers" };
  for (const g of [...order, "may", "other"]) {
    const list = groups.get(g);
    if (!list?.length) continue;
    root.append(ui.card(titles[g], ui.h("ul", { class: "td-list" }, list.map((x) => {
      const box = ui.h("input", { type: "checkbox", checked: x.received ? true : null, "aria-label": `${x.form} from ${x.from || "you"}` });
      box.addEventListener("change", () => {
        pending = box.checked ? `${x.form} ticked as received.` : `${x.form} marked as still to come.`;
        store.update((p) => {
          p.taxes = p.taxes ?? {};
          p.taxes.documents = p.taxes.documents ?? {};
          const yr = (p.taxes.documents[d.year] = p.taxes.documents[d.year] ?? {});
          if (box.checked) yr[x.key] = true; else delete yr[x.key];
        });
      });
      const remove = x.own ? ui.button("Remove", (e) => {
        e.preventDefault();
        pending = `${x.form} removed from the list.`;
        store.update((p) => { p.taxes.extraDocuments = (p.taxes.extraDocuments ?? []).filter((y) => `x:${y.id}` !== x.key); });
      }, { class: "secondary td-remove" }) : null;
      return ui.h("li", { class: x.received ? "td-got" : null }, ui.h("label", { class: "td-item" }, box,
        ui.h("span", {}, ui.h("div", { class: "td-form" }, `${x.form}${x.from ? ` · ${x.from}` : ""}`),
          ui.h("div", { class: "td-d" }, x.own ? x.what : `${x.what}. Listed because ${x.why}.`)), remove));
    }))));
  }
  root.append(ui.card(null, ui.h("p", { class: "muted small" }, "The list follows what is on your plan: a job on Income, an account on Accounts, a loan, a pension. A form that never comes may be online at the bank or employer; ask for it before the deadline. Interest under $10 needs no 1099-INT but is still taxed.")));

  const own = ui.form([
    { key: "form", label: "What it is", type: "text", placeholder: "e.g. Daycare receipts" },
    { key: "from", label: "Who sends it", type: "text", placeholder: "e.g. the daycare" },
  ], {}, (v) => {
    if (!String(v.form ?? "").trim()) { own.prepend(ui.notice("error", "Write what the document is first.")); return; }
    pending = `${v.form} added to the list.`;
    store.update((p) => { p.taxes = p.taxes ?? {}; p.taxes.extraDocuments = [...(p.taxes.extraDocuments ?? []), { id: ui.uid(), form: String(v.form).trim(), from: String(v.from ?? "").trim() }]; });
  }, { submitLabel: "Add" });
  const extra = (plan.taxes?.extraDocuments ?? []).length;
  root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "Add a document of your own"), ui.h("span", { class: "fold-status" }, extra ? `${extra} added` : "receipts, statements"), ui.h("span", { class: "fold-chev" }, "›")), own));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/taxes/federal" }, "Federal tax estimate"), ui.h("a", { class: "btn secondary", href: "#/taxes/filing-status" }, "Filing status"))));
}

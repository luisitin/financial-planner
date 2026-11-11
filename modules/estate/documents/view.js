// modules/estate/documents/view.js -- DOM only. How many of the essential papers are signed, then one
// row per paper (per person where each adult needs their own), tap to mark it and say where it is kept.
import { compute, KINDS, STATUS, REVIEW_YEARS } from "./compute.js";

let pending = null;   // the confirmation shown on the next render
let openKey = null;   // the row being edited, kept across the re-render that follows a save
let heroRoute = null; // the visit that opened on the intro keeps it, so the first tick does not pull the list up under the thumb
let tickWords = null; // a tick's confirmation: drawn at the foot of the page so nothing above the thumb moves

const STYLE = `
.ed-root .ed-list { list-style: none; margin: 0; padding: 0; }
.ed-root .ed-list > li { border-bottom: 1px solid var(--line); }
.ed-root .ed-list > li:last-child { border-bottom: 0; }
.ed-root .ed-line { display: flex; align-items: flex-start; gap: 0; }
.ed-root .ed-row { display: flex; flex: 1; min-width: 0; gap: 12px; align-items: flex-start; min-height: 52px; padding: 10px 0; background: none; border: 0; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.ed-root .ed-tick { flex: none; width: 44px; height: 44px; min-height: 44px; margin: 4px 4px 0 -10px; padding: 0; display: flex; align-items: center; justify-content: center; background: none; border: 0; border-radius: 8px; color: inherit; font-size: 18px; cursor: pointer; }
.ed-root .ed-body { flex: 1; min-width: 0; }
.ed-root .ed-t { font-weight: 600; }
.ed-root .ed-d { color: var(--text-2); font-size: var(--fs-sm); }
.ed-root .ed-st { flex: none; min-width: 6.2em; text-align: right; font-size: var(--fs-sm); color: var(--muted); white-space: nowrap; }
.ed-root .ed-st.done { color: var(--ok); } .ed-root .ed-st.started { color: var(--warn); }
.ed-root .ed-edit { padding: 0 0 14px 34px; }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "ed-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  if (d.done === 0) heroRoute = ctx.route;
  if (d.done === 0 || heroRoute === ctx.route) root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "The papers that protect your family"),
    ui.h("p", { class: "lede" }, "A will, powers of attorney and a few health papers decide who looks after your children, your money and your medical care if you cannot. Most families put them off; together they usually take one visit to a lawyer, or an online service for simple cases."),
    ui.h("p", { class: "muted small" }, "Tap the square beside a paper to mark it signed; tap its name to note where the original is kept.")));
  else root.append(ui.card(null, ui.row(ui.stat("Signed", `${d.done} of ${d.required}`, d.done === d.required ? "all the essentials" : "essential papers"), ui.stat("To look at again", String(d.items.filter((x) => x.stale).length), `older than ${REVIEW_YEARS} years, or the family has grown since`))));
  for (const w of d.warnings) root.append(ui.notice("warn", w));

  const groups = [["For each of you", d.items.filter((x) => !x.optional && x.personId)], ["For the household", d.items.filter((x) => !x.optional && !x.personId)], ["Worth having", d.items.filter((x) => x.optional)]];
  for (const [title, list] of groups) {
    if (!list.length) continue;
    const ul = ui.h("ul", { class: "ed-list" });
    const seen = new Set();
    for (const x of list) {
      const first = !seen.has(x.kind); seen.add(x.kind);
      const li = ui.h("li");
      const draw = () => {
        const name = x.personName ? `${x.label}: ${x.personName}` : x.label;
        const signed = x.status === "done";
        // the square is its own 44 px button: one tap marks the paper signed (today), another tap takes it back; it
        // looked like a tick box but opened a form set to "Not yet" (stress test IE-6)
        const tick = ui.h("button", { type: "button", class: "ed-tick", "aria-pressed": signed ? "true" : "false", "aria-label": signed ? `${name}: signed. Tap to mark it not signed` : `Mark ${name} signed`, onClick: () => {
          const on = !signed;
          tickWords = on ? `${name} marked signed. Tap its name to note where the original is kept.` : `${name} marked not signed.`;
          store.update((p) => {
            p.estate = p.estate ?? { documents: [], beneficiaries: [] }; p.estate.documents = p.estate.documents ?? [];
            const i = p.estate.documents.findIndex((r) => r.kind === x.kind && (r.personId ?? "") === x.personId);
            const was = i >= 0 ? p.estate.documents[i] : null;
            const row = { kind: x.kind, personId: x.personId, status: on ? "done" : "none", done: on, updatedAt: on ? (was?.updatedAt || fmt.today()) : (was?.updatedAt ?? "") };
            if (was) p.estate.documents[i] = { ...was, ...row }; else p.estate.documents.push({ id: ui.uid(), where: "", notes: "", ...row });
          });
        } }, signed ? (x.stale ? "🔁" : "✅") : x.status === "started" ? "✍️" : "⬜");
        li.replaceChildren(ui.h("div", { class: "ed-line" }, tick, ui.h("button", { type: "button", class: "ed-row", "aria-expanded": openKey === x.key ? "true" : "false", onClick: () => { openKey = openKey === x.key ? null : x.key; draw(); } },
          ui.h("span", { class: "ed-body" }, ui.h("div", { class: "ed-t" }, name), ui.h("div", { class: "ed-d" }, x.stale ? `Look at it again: ${x.reasons.join("; ")}.` : signed && x.where ? `Kept: ${x.where}` : first ? x.what : x.status === "none" ? "The same, for this person." : signed ? "Signed." : "")),
          ui.h("span", { class: `ed-st ${x.status}` }, signed && x.updatedAt ? x.updatedAt.slice(0, 4) : STATUS[x.status]))));
        if (openKey === x.key) li.append(ui.h("div", { class: "ed-edit" }, x.status === "done" && !x.stale ? ui.h("p", { class: "ed-d" }, x.what) : null, ui.form([
          { key: "status", label: "Status", type: "select", options: Object.entries(STATUS).map(([value, label]) => ({ value, label })) },
          { key: "updatedAt", label: "Signed or last updated", type: "date" },
          { key: "where", label: "Where the original is kept", type: "text", placeholder: "e.g. fire safe at home; the lawyer's office" },
          { key: "notes", label: "Notes", type: "textarea", rows: 2, help: "who it names, the lawyer, what to change" },
        ], { status: x.status, updatedAt: x.updatedAt, where: x.where, notes: x.notes }, (v) => {
          pending = `${x.label} saved.`;
          openKey = null;
          store.update((p) => {
            p.estate = p.estate ?? { documents: [], beneficiaries: [] }; p.estate.documents = p.estate.documents ?? [];
            const row = { kind: x.kind, personId: x.personId, status: v.status, done: v.status === "done", updatedAt: v.updatedAt || "", where: (v.where ?? "").trim(), notes: v.notes ?? "" };
            const i = p.estate.documents.findIndex((r) => r.kind === x.kind && (r.personId ?? "") === x.personId);
            if (i >= 0) p.estate.documents[i] = { ...p.estate.documents[i], ...row }; else p.estate.documents.push({ id: ui.uid(), ...row });
          });
        }, { submitLabel: "Save", onCancel: () => { openKey = null; draw(); } })));
      };
      draw();
      ul.append(li);
    }
    root.append(ui.card(title, ul));
  }
  root.append(ui.card("More on this", ui.row(ui.h("a", { class: "btn secondary", href: "#/estate/beneficiaries" }, "Beneficiaries"), ui.h("a", { class: "btn secondary", href: "#/estate/digital" }, "Digital assets"))));
  if (tickWords) { root.append(ui.notice("ok", tickWords)); tickWords = null; }
  root.append(ui.h("p", { class: "muted small" }, `What each paper is called and how it is signed differs by state. This list is a reminder, not legal advice: ${Object.keys(KINDS).length} papers most estate lawyers start from.`));
}

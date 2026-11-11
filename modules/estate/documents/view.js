// modules/estate/documents/view.js -- DOM only. How many of the essential papers are signed, then one
// row per paper (per person where each adult needs their own), tap to mark it and say where it is kept.
import { compute, nextPaper, KINDS, STATUS, REVIEW_YEARS } from "./compute.js";

let pending = null;   // the confirmation shown on the next render
let openKey = null;   // the row being edited, kept across the re-render that follows a save
let heroRoute = null; // the visit that opened on the intro keeps it, so the first tick does not pull the list up under the thumb
let tickWords = null; // a tick's confirmation: drawn at the foot of the page so nothing above the thumb moves
// For a few hours (6a29d2a) the guardian's name was typed into Notes under "Who would raise the children?". A one-line note
// of a few words, on a guardian with no `who`, fills the box so the name is not typed again; nothing counts as chosen until
// Save stores it in `who` (attack on N14: an old note must never read as a chosen guardian on its own)
const oldWho = (x) => { const n = String(x.notes ?? "").trim(); return n && !n.includes("\n") && n.length <= 40 && n.split(/\s+/).length <= 4 ? n : ""; };

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

  // the one filled button: open the paper to start with in place (the guardian first when children have none), so the person
  // Needs attention sends here has something to do on the first screen (stress test MR-7)
  const rows = new Map();
  let shut = null;   // the open row's draw, to close it when the button opens another
  const nx = nextPaper(d);
  const goBtn = nx ? ui.h("button", { type: "button", class: "btn", onClick: () => rows.get(nx.key)?.() }, `${nx.label} ›`) : null;
  const go = goBtn ? ui.row(goBtn) : null;
  if (d.done === 0) heroRoute = ctx.route;
  if (d.done === 0 || heroRoute === ctx.route) root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "The papers that protect your family"),
    ui.h("p", { class: "lede" }, "A will, powers of attorney and a few health papers decide who looks after your children, your money and your medical care if you cannot. Most families put them off; together they usually take one visit to a lawyer, or an online service for simple cases."),
    ui.h("p", { class: "muted small" }, "Tap the square beside a paper to mark it signed; tap its name to note where the original is kept."),
    d.warnings.length ? null : go));
  else root.append(ui.card(null, ui.row(ui.stat("Signed", `${d.done} of ${d.required}`, d.done === d.required ? "all the essentials" : "essential papers"), ui.stat("To look at again", String(d.items.filter((x) => x.stale).length), `older than ${REVIEW_YEARS} years, or the family has grown since`)), d.warnings.length ? null : go));
  // a warning (no guardian) carries the button itself, right under what it says
  d.warnings.forEach((w, i) => { const n = ui.notice("warn", w); if (!i && go) n.append(go); root.append(n); });

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
        li.replaceChildren(ui.h("div", { class: "ed-line" }, tick, ui.h("button", { type: "button", class: "ed-row", "aria-expanded": openKey === x.key ? "true" : "false", onClick: () => { if (openKey && openKey !== x.key) { openKey = null; shut?.(); } openKey = openKey === x.key ? null : x.key; shut = openKey ? draw : null; draw(); } },
          ui.h("span", { class: "ed-body" }, ui.h("div", { class: "ed-t" }, name), ui.h("div", { class: "ed-d" }, x.stale ? `Look at it again: ${x.reasons.join("; ")}.` : x.kind === "guardian" && x.who ? `${signed ? "Named" : "Chosen"}: ${x.who}` : signed && x.where ? `Kept: ${x.where}` : first ? x.what : x.status === "none" ? "The same, for this person." : signed ? "Signed." : "")),
          ui.h("span", { class: `ed-st ${x.status}` }, signed && x.updatedAt ? x.updatedAt.slice(0, 4) : STATUS[x.status]))));
        // while the paper the button opens is open, its form's Save is the one filled button: the button above goes quiet
        // (review 2026-11-11 N13: two filled buttons on one screen after "Start here")
        if (goBtn && x.key === nx.key) goBtn.className = openKey === x.key ? "btn secondary" : "btn";
        // the guardian's form asks who it is first (review 2026-11-11 N14: "Name a guardian" opened a status form and the
        // name went only in Notes); the name has its own field, `who`, so an old note is never taken for a chosen guardian
        // (attack on N14: "Not sure yet, need to ask my sister" read as "You chose ...")
        const guardian = x.kind === "guardian";
        const notesField = { key: "notes", label: "Notes", type: "textarea", rows: 2, help: guardian ? "a second choice, the lawyer, what to change" : "who it names, the lawyer, what to change" };
        const whoField = { key: "who", label: "Who would raise the children?", type: "text", placeholder: "e.g. Aunt Kay", help: "the person you name in your will" };
        if (openKey === x.key) li.append(ui.h("div", { class: "ed-edit" }, x.status === "done" && !x.stale ? ui.h("p", { class: "ed-d" }, x.what) : null, ui.form([
          ...(guardian ? [whoField] : []),
          { key: "status", label: guardian ? "Is it in a signed will?" : "Status", type: "select", options: Object.entries(STATUS).map(([value, label]) => ({ value, label })) },
          { key: "updatedAt", label: "Signed or last updated", type: "date" },
          { key: "where", label: "Where the original is kept", type: "text", placeholder: "e.g. fire safe at home; the lawyer's office" },
          notesField,
        ], { status: x.status, updatedAt: x.updatedAt, where: x.where, notes: x.notes, ...(guardian ? { who: x.who || oldWho(x) } : {}) }, (v) => {
          pending = `${x.label} saved.`;
          openKey = null;
          store.update((p) => {
            p.estate = p.estate ?? { documents: [], beneficiaries: [] }; p.estate.documents = p.estate.documents ?? [];
            const row = { kind: x.kind, personId: x.personId, status: v.status, done: v.status === "done", updatedAt: v.updatedAt || "", where: (v.where ?? "").trim(), notes: v.notes ?? "", ...(guardian ? { who: String(v.who ?? "").trim() } : {}) };
            const i = p.estate.documents.findIndex((r) => r.kind === x.kind && (r.personId ?? "") === x.personId);
            if (i >= 0) p.estate.documents[i] = { ...p.estate.documents[i], ...row }; else p.estate.documents.push({ id: ui.uid(), ...row });
          });
        }, { submitLabel: "Save", onCancel: () => { openKey = null; draw(); } })));
      };
      draw();
      // the filled button opens this row's form where it is, scrolls it to the middle and puts the cursor in its first box
      // a row already open closes first, so only one form is ever open (review 2026-11-11)
      if (openKey === x.key) shut = draw;
      rows.set(x.key, () => { if (openKey !== x.key) { openKey = null; shut?.(); } openKey = x.key; shut = draw; draw(); li.scrollIntoView({ block: "center", behavior: "smooth" }); li.querySelector("select, input, textarea")?.focus({ preventScroll: true }); });
      ul.append(li);
    }
    root.append(ui.card(title, ul));
  }
  root.append(ui.card("More on this", ui.row(ui.h("a", { class: "btn secondary", href: "#/estate/beneficiaries" }, "Beneficiaries"), ui.h("a", { class: "btn secondary", href: "#/estate/digital" }, "Digital assets"))));
  if (tickWords) { root.append(ui.notice("ok", tickWords)); tickWords = null; }
  root.append(ui.h("p", { class: "muted small" }, `What each paper is called and how it is signed differs by state. This list is a reminder, not legal advice: ${Object.keys(KINDS).length} papers most estate lawyers start from.`));
}

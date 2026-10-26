// core/ui/placeholder.js -- the shared "Coming soon" page used by every planned module
// that tools/scaffold-from-catalog.mjs generated. It says what the page will do, which
// phase builds it, and keeps a notes box saved INTO THE PLAN (plan.pageNotes) so ideas
// typed on the phone are there when the page gets built.
import { phaseOf, PHASES } from "../phases.js";

// The shell re-renders after store.update, so the confirmation waits here for the next render.
let pending = null;

export function renderPlaceholder(root, ctx) {
  const { ui, store, plan, module: meta, GROUPS } = ctx;
  const key = `${meta.group}/${meta.id}`;
  const group = GROUPS.find((g) => g.id === meta.group);
  const phase = phaseOf(meta.phase ?? 10);
  const note = plan.pageNotes?.[key] ?? "";

  root.append(ui.h("section", { class: "card hero" },
    ui.h("div", { style: { fontSize: "40px", lineHeight: "1", marginBottom: "10px" } }, meta.icon ?? group?.icon ?? "🧩"),
    ui.h("span", { class: "coming-badge" }, `Coming in phase ${phase.n}`),
    ui.h("h1", { style: { marginTop: "10px" } }, meta.title),
    ui.h("p", { class: "lede" }, sentence(meta.purpose)),
    ui.h("p", { class: "muted small" }, `Part of ${group?.title ?? meta.group}. Comes in build phase ${phase.n} of ${Math.max(...PHASES.map((p) => p.n))}.`),
  ));

  const ta = ui.h("textarea", { rows: 5, placeholder: "What would make this page useful to you? Numbers you want to see, things your advisor's plan shows, questions you keep asking..." }, note);
  const saved = ui.h("div");
  if (pending?.key === key) { const n = ui.notice("ok", pending.text); saved.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(ui.card("Your notes for this page",
    ui.h("p", { class: "muted small" }, "Saved into the plan, so they follow you to every device, and whoever builds this page will read them first."),
    ta,
    ui.row(ui.button("Save notes", () => {
      const v = ta.value.trim();
      pending = { key, text: v ? "Notes saved." : "Notes cleared." };
      store.update((p) => { p.pageNotes = p.pageNotes ?? {}; if (v) p.pageNotes[key] = v; else delete p.pageNotes[key]; });
    }), note ? ui.button("Clear", () => { ta.value = ""; pending = { key, text: "Notes cleared." }; store.update((p) => { delete p.pageNotes?.[key]; }); }, { class: "secondary" }) : null),
    saved,
  ));

  // Builder details (seeds, catalog key) stay in the catalog and README, never on screen.
  root.append(ui.row(ui.h("a", { href: "#/overview/dashboard", class: "btn secondary" }, "Back to the dashboard"), ui.h("a", { href: `#/overview/pages/phase-${phase.n}`, class: "btn secondary" }, `Other phase ${phase.n} pages`)));
}
function sentence(s) { s = String(s ?? "Planned page.").trim(); return s ? s[0].toUpperCase() + s.slice(1) + (/[.!?]$/.test(s) ? "" : ".") : "Planned page."; }

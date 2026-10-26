// modules/system/assumptions/view.js -- DOM only. One form with every assumption, a plain
// line under each field, the sources in one fold at the end, a "reviewed" status and a reset.
// Layout and wording per docs/DESIGN_LOG.md 2026-09-15 (Assumptions round 17).
import { compute, ASSUMPTIONS } from "./compute.js";

// One plain sentence per field; the full sourcing from compute.js goes in the fold below.
const PLAIN = {
  inflation: "How fast prices rise.",
  returnStocks: "Before inflation; a cautious long-run guess that leaves room for fees and bad decades.",
  returnBonds: "Before inflation.",
  returnCash: "Savings and money-market accounts; roughly keeps pace with prices over time.",
  stdevStocks: "How far a normal year can land from the average; used by the what-if pages.",
  stdevBonds: "Same idea for bonds.",
  salaryGrowth: "Typical yearly raise: about inflation plus a little.",
  retirementAge: "The usual planning age; each person can have their own on the People page.",
  planEndAge: "Planning this long leaves a margin; each person can have their own.",
  emergencyMonths: "Three to six is the usual advice; more if income is irregular or there is one earner.",
};

// The shell re-renders after store.update, so a confirmation waits here for the next render.
let pending = null;

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const d = compute(plan, { today: fmt.today() });
  const defText = (x) => x.kind === "percent" ? fmt.pct(x.def, 1) : String(x.def);

  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Assumptions"),
    ui.h("p", { class: "lede" }, "Ten numbers drive every projection: how fast prices rise, how much investments grow, when you retire, how long the money must last. The defaults are middle-of-the-road; change any that your advisor set differently."),
    ui.h("p", { class: "muted small" }, "Percentages are typed as plain numbers: 7 means 7% a year."),
  ));

  // Review status as a notice, not a tile.
  if (!d.reviewedAt) root.append(ui.notice("warn", "You have not looked these over yet. Saving marks them as reviewed."));
  else if (d.stale) root.append(ui.notice("warn", `Reviewed on ${fmt.date(d.reviewedAt)}, more than a year ago. Look them over and save to mark them reviewed again.`));
  else root.append(ui.notice("ok", `Reviewed on ${fmt.date(d.reviewedAt)}.`));
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);

  root.append(ui.card(null, ui.row(
    ui.stat("Changed from defaults", String(d.changedCount), d.changedCount ? "fields with your own number" : "all defaults"),
    ui.stat("Stocks after inflation", fmt.pct(d.realStocks, 1), `bonds ${fmt.pct(d.realBonds, 1)}, cash ${fmt.pct(d.realCash, 1)}`),
  )));
  for (const w of d.warnings) root.append(ui.notice("warn", w));

  const fields = ASSUMPTIONS.map((x) => ({
    key: x.key, label: x.label, type: x.kind === "percent" ? "percent" : "number",
    min: x.kind === "percent" ? x.min * 100 : x.min, max: x.kind === "percent" ? x.max * 100 : x.max, step: x.kind === "percent" ? "0.1" : "1",
    help: `${PLAIN[x.key] ?? ""} Default: ${defText(x)}.`.trim(),
  }));
  // ui.form shows percent fields as percentages itself (stored 0.07 -> shown 7), so pass the fractions.
  const values = Object.fromEntries(d.rows.map((r) => [r.key, r.value]));
  const form = ui.form(fields, values, (v) => {
    pending = "Saved and marked as reviewed.";
    store.update((p) => {
      p.assumptions = p.assumptions ?? {};
      for (const x of ASSUMPTIONS) if (v[x.key] !== null && v[x.key] !== undefined && !Number.isNaN(v[x.key])) p.assumptions[x.key] = v[x.key];
      p.assumptions.reviewedAt = fmt.today();   // saving is reviewing (design log 2026-09-15)
    });
  }, { submitLabel: "Save and mark as reviewed" });
  root.append(ui.card("The numbers", form,
    ui.h("p", { class: "muted small", style: { marginTop: "12px" } }, "Saving marks the setup step on the dashboard as done and dates it, so a year from now the plan can remind you to look again."),
    ui.h("div", { style: { marginTop: "12px" } }, ui.button("Reset to defaults", () => { if (ui.confirm("Put every assumption back to its default?")) { pending = "Every assumption is back to its default."; store.update((p) => { const keep = p.assumptions?.reviewedAt; p.assumptions = Object.fromEntries(ASSUMPTIONS.map((x) => [x.key, x.def])); if (keep) p.assumptions.reviewedAt = keep; }); } }, { class: "secondary" })),
  ));

  root.append(ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("h2", {}, "Where these numbers come from"), ui.h("span", { class: "fold-chev", "aria-hidden": "true" }, "›")),
    ui.h("div", { class: "fold-body" }, ASSUMPTIONS.map((x) => ui.h("p", { class: "small" }, ui.h("strong", {}, `${x.label} (default ${defText(x)}). `), x.source)))));
}

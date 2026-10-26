// modules/investments/allocation/view.js -- DOM only. The drift verdict first, the actual and
// target mixes as two bars, each class with its drift, the mix per account (folded) and the
// target form (folded).
import { compute, TARGET_CLASSES } from "./compute.js";
import { ASSET_CLASSES } from "../holdings/compute.js";

let pending = null;
const COLORS = { us_stocks: "var(--accent)", intl_stocks: "#7c9cd6", bonds: "#8fb996", cash: "#c9c9c9", real_estate: "#d6a06b", other: "#b48ad6", unknown: "#e0e0e0" };

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  const pts = (x) => `${Math.round(x * 100)}%`;
  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Your mix against your target"), ui.h("p", { class: "lede" }, "How much of your money sits in US stocks, international stocks, bonds and cash across every account, next to the mix you aim for. It needs your holdings first."), ui.row(ui.h("a", { class: "btn", href: "#/investments/holdings" }, "Add holdings"))));
    root.append(targetFold(ctx, d));
    return;
  }
  const w = d.worst;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.flaggedCount ? `${d.flaggedCount === 1 ? "One class has" : `${d.flaggedCount} classes have`} drifted past the band` : "Your mix is close to the target"),
    ui.h("p", { class: "lede" }, `${pts(d.stockShareActual)} in stocks against a target of ${pts(d.stockShareTarget)}, across ${money(d.total)} of classified holdings. ${w && d.flaggedCount ? `The biggest gap is ${w.label}: ${pts(w.actual)} held, ${pts(w.target)} wanted (${w.drift > 0 ? "over" : "under"} by ${money(Math.abs(w.move))}).` : "Nothing is more than the band away from its target."}${d.flaggedCount ? " The Rebalance page turns that into trades." : ""}`),
    ui.h("p", { class: "muted small" }, `A class is flagged when it is more than ${Math.round(d.band * 100)} points off, or more than a quarter of its own target off (the 5/25 rule). Balanced and target-date funds are split into their parts.`),
  ));
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  root.append(out);
  for (const n of d.notes) root.append(ui.notice("info", n));
  const bar = (mixRows, key) => ui.h("div", { class: "alloc-bar", style: { display: "flex", height: "28px", borderRadius: "8px", overflow: "hidden", background: "var(--line)" } }, mixRows.filter((r) => r[key] > 0.001).map((r) => ui.h("span", { title: `${r.label} ${pts(r[key])}`, style: { width: `${r[key] * 100}%`, background: COLORS[r.cls] ?? "var(--muted)", display: "inline-block" } })));
  root.append(ui.card("Actual and target",
    ui.h("div", { class: "muted small", style: { marginBottom: "4px" } }, "What you hold"), bar(d.rows, "actual"),
    ui.h("div", { class: "muted small", style: { margin: "10px 0 4px" } }, "What you aim for"), bar(d.rows, "target"),
    ui.h("div", { class: "chips", style: { marginTop: "10px" } }, d.rows.map((r) => ui.h("span", { class: "chip", style: { cursor: "default", minHeight: "32px", padding: "2px 10px" } }, ui.h("span", { style: { display: "inline-block", width: "10px", height: "10px", borderRadius: "3px", background: COLORS[r.cls], marginRight: "6px", verticalAlign: "middle" } }), `${r.label} ${pts(r.actual)}`))),
    ui.h("ul", { class: "records" }, d.rows.map((r) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, r.icon ? `${r.icon} ` : "", r.label, r.flagged ? ui.h("span", { class: "pill warn" }, "off target") : null), ui.h("span", { class: "rec-value" }, `${pts(r.actual)} of ${pts(r.target)}`)),
      ui.h("div", { class: "rec-sub" }, `${money(r.value)} held; ${Math.abs(r.move) < 1 ? "on target" : `${r.move > 0 ? "add" : "trim"} ${money(Math.abs(r.move))} to match`}${r.flagged ? ` · ${r.reason}` : ""}`)))),
  ));
  if (d.byAccountClass.length > 1) root.append(ui.h("details", { class: "card fold fold-card" },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Mix by account"), ui.h("span", { class: "fold-status" }, `${d.byAccountClass.length} accounts`), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" }, ui.h("ul", { class: "records" }, d.byAccountClass.map((a) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, a.account), ui.h("span", { class: "rec-value" }, money(a.value))),
      ui.h("div", { class: "rec-sub" }, Object.entries(a.classes).filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]).map(([cls, v]) => `${ASSET_CLASSES[cls].label} ${a.value > 0 ? pts(v / a.value) : "-"}`).join(" · ")),
      bar(Object.entries(a.classes).map(([cls, v]) => ({ cls, label: ASSET_CLASSES[cls].label, share: a.value > 0 ? v / a.value : 0 })), "share")))))));
  root.append(targetFold(ctx, d));
}

function targetFold(ctx, d) {
  const { ui, store, plan } = ctx;
  const t = d.target ?? {};
  const FIELDS = [
    ...TARGET_CLASSES.map((cls) => ({ key: cls, label: ASSET_CLASSES[cls].label, type: "number", min: 0, max: 100, step: "1", help: cls === "us_stocks" ? "percent of the whole portfolio; the six add up to 100" : undefined })),
    { key: "band", label: "Rebalance band", type: "number", min: 1, max: 25, step: "1", help: "points a class may drift before it is flagged; 5 is the usual" },
  ];
  const values = { ...Object.fromEntries(TARGET_CLASSES.map((c) => [c, Math.round((t[c] ?? 0) * 100) || null])), band: Math.round((plan.investments?.band ?? 0.05) * 100) };
  const form = ui.form(FIELDS, values, (v) => {
    const sum = TARGET_CLASSES.reduce((s, c) => s + (v[c] ?? 0), 0);
    pending = sum > 0 && Math.abs(sum - 100) > 0.5 ? `Target saved (the ${sum}% you typed was scaled to 100%).` : "Target saved.";
    store.update((p) => { p.investments.target = sum > 0 ? Object.fromEntries(TARGET_CLASSES.map((c) => [c, (v[c] ?? 0) / sum])) : null; p.investments.band = Math.min(0.25, Math.max(0.01, (v.band ?? 5) / 100)); });
  }, { submitLabel: "Save target" });
  return ui.h("details", { class: "card fold fold-card", open: d.ready ? null : true },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Your target mix"), ui.h("span", { class: "fold-status" }, d.targetSource === "own" ? `${Math.round((t.us_stocks + t.intl_stocks + (t.real_estate ?? 0)) * 100)}% stocks` : "from the Projection page"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" }, ui.h("p", { class: "muted small" }, "Leave everything blank to follow the Projection page's stock share (60/40 US/international, the rest bonds). Typical: 60% stocks / 40% bonds for a near retiree, 90/10 for a long horizon; a third of stocks abroad is the world's weight."), form));
}

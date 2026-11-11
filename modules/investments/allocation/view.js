// modules/investments/allocation/view.js -- DOM only. The drift verdict first, the actual and
// target mixes as two bars, each class with its drift, the mix per account (folded) and the
// target form (folded). With no target of your own: what you hold and a few mixes to pick in one tap.
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
  // a target of your own is judged only once most of the money is classified: on a guess, show what is held
  const own = d.targetSource === "own" && d.verdict !== "partial";
  const out = ui.h("div");
  if (pending) {
    const n = ui.notice("ok", pending.text ?? pending), share = pending.stocks;
    // a target that differs from the Projection's stock share: one tap makes the plan's projection use it too
    if (share !== undefined) n.append(" ", ui.button(`Use ${pts(share)} stocks on Will the money last? too`, () => { pending = `Will the money last? now assumes ${pts(share)} stocks.`; store.update((q) => { q.retirement.stocksNow = Math.round(share * 100) / 100; }); }, { class: "secondary small" }));
    out.append(n); if (share === undefined) setTimeout(() => n.remove(), 4000); pending = null;
  }
  // no target of your own: what you hold, and a few mixes to pick in one tap; no drift is called against a default
  if (d.verdict === "pick" || d.verdict === "partial") {
    const fund = d.choices.find((c) => c.key === "fund"), planC = d.choices.find((c) => c.key === "plan");
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, d.verdict === "partial" ? "Add what's in your other accounts first" : (d.restWords ? `You hold ${pts(d.stockShareActual)} stocks and ${pts(1 - d.stockShareActual)} ${d.restWords}` : `You hold ${pts(d.stockShareActual)} stocks`)),
      ui.h("p", { class: "lede" }, d.verdict === "partial"
        ? `The funds typed so far cover ${pts(d.known)} of the money in your investment accounts, so the mix below is a guess. Add each account's funds on Holdings, and pick a class for any marked unknown.`
        : `Pick the mix you want and this page will tell you when you drift away from it.${fund ? ` A ${fund.year} target-date fund holds about ${pts(fund.stocks)} stocks; your plan's projection assumes ${pts(planC?.stocks ?? 0.7)}.` : ` Your plan's projection assumes ${pts(planC?.stocks ?? 0.7)}.`}`),
      d.verdict === "partial" ? ui.row(ui.h("a", { class: "btn", href: "#/investments/holdings" }, "Open Holdings")) : null));
    root.append(out);
    if (d.verdict === "pick") {
      const save = (c) => {
        const sharePlan = Number(plan.retirement?.stocksNow ?? 0.7);
        pending = Math.abs(c.stocks - sharePlan) >= 0.05 ? { text: `Target saved: ${pts(c.stocks)} stocks.`, stocks: c.stocks } : `Target saved: ${pts(c.stocks)} stocks.`;
        store.update((q) => { q.investments.target = { ...c.mix }; });
      };
      root.append(ui.card("Pick the mix you want",
        ui.h("p", { class: "muted small" }, "Stocks grow more and swing more; bonds and cash steady the ride. You can change it any time."),
        ui.h("div", { style: { display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-start" } },
          d.choices.map((c, i) => ui.button(`${c.label}: ${pts(c.stocks)} stocks`, () => save(c), { class: i === 0 ? null : "secondary" })),
          ui.button("Type my own", () => { const f = root.querySelector("details.alloc-target"); if (f) { f.open = true; f.scrollIntoView({ behavior: "smooth", block: "start" }); f.querySelector("input")?.focus({ preventScroll: true }); } }, { class: "secondary" }))));
    }
  } else root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.flaggedCount ? `${d.flaggedCount === 1 ? "One kind of investment has" : `${d.flaggedCount} kinds of investment have`} drifted too far from your target` : "Your mix is close to the target"),
    ui.h("p", { class: "lede" }, `${pts(d.stockShareActual)} in stocks against a target of ${pts(d.stockShareTarget)}, across ${money(d.total)} of holdings sorted into kinds. ${w && d.flaggedCount ? `The biggest gap is ${w.label}: ${pts(w.actual)} held, ${pts(w.target)} wanted (${w.drift > 0 ? "over" : "under"} by ${money(Math.abs(w.move))}).` : "No kind of investment has drifted too far from its target."}${d.flaggedCount ? " The Rebalance page says how to move back." : ""}`),
    ui.h("p", { class: "muted small" }, `A class is flagged when it is more than ${Math.round(d.band * 100)} points off, or more than a quarter of its own target off (the 5/25 rule). Balanced and target-date funds are split into their parts.`),
  ));
  if (d.verdict === "drift" || d.verdict === "ok") root.append(out);
  for (const n of d.notes) root.append(ui.notice("info", n));
  const bar = (mixRows, key) => ui.h("div", { class: "alloc-bar", style: { display: "flex", height: "28px", borderRadius: "8px", overflow: "hidden", background: "var(--line)" } }, mixRows.filter((r) => r[key] > 0.001).map((r) => ui.h("span", { title: `${r.label} ${pts(r[key])}`, style: { width: `${r[key] * 100}%`, background: COLORS[r.cls] ?? "var(--muted)", display: "inline-block" } })));
  root.append(ui.card(own ? "Actual and target" : "What you hold",
    own ? ui.h("div", { class: "muted small", style: { marginBottom: "4px" } }, "What you hold") : null, bar(d.rows, "actual"),
    own ? ui.h("div", { class: "muted small", style: { margin: "10px 0 4px" } }, "What you aim for") : null, own ? bar(d.rows, "target") : null,
    ui.h("div", { class: "chips", style: { marginTop: "10px" } }, d.rows.map((r) => ui.h("span", { class: "chip", style: { cursor: "default", minHeight: "32px", padding: "2px 10px" } }, ui.h("span", { style: { display: "inline-block", width: "10px", height: "10px", borderRadius: "3px", background: COLORS[r.cls], marginRight: "6px", verticalAlign: "middle" } }), `${r.label} ${pts(r.actual)}`))),
    ui.h("ul", { class: "records" }, d.rows.map((r) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, r.icon ? `${r.icon} ` : "", r.label, own && d.verdict === "drift" && r.flagged ? ui.h("span", { class: "pill warn" }, "off target") : null), ui.h("span", { class: "rec-value" }, own ? `${pts(r.actual)} of ${pts(r.target)}` : pts(r.actual))),
      ui.h("div", { class: "rec-sub" }, own ? `${money(r.value)} held; ${Math.abs(r.move) < 1 ? "on target" : `${r.move > 0 ? "add" : "trim"} ${money(Math.abs(r.move))} to match`}${r.flagged ? ` · ${r.reason}` : ""}` : `${money(r.value)} held`)))),
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
  // the boxes start blank unless you chose a target: the Projection's default is not yours to save by accident
  const t = d.targetSource === "own" ? d.target ?? {} : {};
  const FIELDS = [
    ...TARGET_CLASSES.map((cls) => ({ key: cls, label: ASSET_CLASSES[cls].label, type: "number", min: 0, max: 100, step: "1", help: cls === "us_stocks" ? "percent of the whole portfolio; the six add up to 100" : undefined })),
    { key: "band", label: "How far a kind of investment can drift", type: "number", min: 1, max: 25, step: "1", help: "how many percentage points it can drift before the page flags it; 5 is the usual" },
  ];
  const values = { ...Object.fromEntries(TARGET_CLASSES.map((c) => [c, Math.round((t[c] ?? 0) * 100) || null])), band: Math.round((plan.investments?.band ?? 0.05) * 100) };
  const form = ui.form(FIELDS, values, (v) => {
    const sum = TARGET_CLASSES.reduce((s, c) => s + (v[c] ?? 0), 0);
    // a target that does not add up to 100 is held, with the sum said beside the button (60 + 60 was saved as 50 / 50)
    if (sum > 0 && Math.abs(sum - 100) > 0.5) { tally(); sumLine.scrollIntoView({ block: "center" }); form.querySelector("input")?.focus({ preventScroll: true }); return false; }
    pending = "Target saved.";
    store.update((p) => { p.investments.target = sum > 0 ? Object.fromEntries(TARGET_CLASSES.map((c) => [c, (v[c] ?? 0) / sum])) : null; p.investments.band = Math.min(0.25, Math.max(0.01, (v.band ?? 5) / 100)); });
  }, { submitLabel: "Save target" });
  const sumLine = ui.h("p", { class: "small", "aria-live": "polite", style: { margin: "4px 0 0" } });
  const tally = () => {
    const sum = TARGET_CLASSES.reduce((s, c) => s + (Number(form.elements[c]?.value) || 0), 0);
    const off = Math.round((sum - 100) * 10) / 10;
    sumLine.style.color = sum > 0 && Math.abs(off) > 0.5 ? "var(--bad)" : "var(--muted)";
    sumLine.textContent = sum <= 0 ? "Leave all six blank for no target." : Math.abs(off) <= 0.5 ? "Adds up to 100%." : `Adds up to ${Math.round(sum * 10) / 10}%: ${off > 0 ? `take ${off} off` : `add ${-off}`} somewhere so it comes to 100.`;
  };
  for (const c of TARGET_CLASSES) form.elements[c]?.addEventListener("input", tally);
  tally();
  form.querySelector(".form-actions")?.before(sumLine);
  return ui.h("details", { class: "card fold fold-card alloc-target", open: d.ready ? null : true },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Your target mix"), ui.h("span", { class: "fold-status" }, d.targetSource === "own" ? `${Math.round((t.us_stocks + t.intl_stocks + (t.real_estate ?? 0)) * 100)}% stocks` : "not chosen yet"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" }, ui.h("p", { class: "muted small" }, "Percent of the whole portfolio in each; leave everything blank for no target (the page then shows what you hold without calling anything off target). Typical: 60% stocks / 40% bonds for someone near retirement, 90/10 for someone with decades to go; about a third of stocks outside the US matches the world's markets."), form));
}

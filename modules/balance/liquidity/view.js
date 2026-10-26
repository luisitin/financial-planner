// modules/balance/liquidity/view.js -- DOM only. The emergency-fund check: months of bills
// covered, the target, and every asset account sorted by how fast it turns into cash.
import { compute, TIERS } from "./compute.js";

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  // Whole months; one decimal only under 2 months, where the difference matters (design log 2026-09-15).
  const months = (m) => m === null ? "-" : m >= 100 ? "100+" : m < 2 ? (Math.round(m * 10) / 10).toString() : String(Math.round(m));

  if (!d.accounts.length) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "How long could you last?"),
      ui.h("p", { class: "lede" }, "This page shows how many months of bills the cash you can reach would cover, and whether your emergency fund is big enough. It needs two things: your accounts and your expenses."),
      ui.row(ui.h("a", { class: "btn", href: "#/balance/net-worth" }, "Add your accounts"), ui.h("a", { class: "btn secondary", href: "#/cashflow/expenses" }, "Add your expenses")),
    ));
    return;
  }

  const statusText = { ok: "covered", warn: "getting there", bad: "thin", unknown: "" }[d.status];
  // The fund card comes first with the months as the headline; the tiles follow.
  if (d.target) {
    const above = d.now - d.target;
    root.append(ui.card("Emergency fund",
      ui.h("div", { class: "fund-head" },
        ui.h("div", {}, ui.h("div", { class: "stat-value" }, d.expenses ? `${months(d.runwayMonths)} months covered` : fmt.money(d.now, cur)),
          ui.h("div", { class: "muted small" }, `target: ${d.targetMonths} months (${fmt.money(d.target, cur)})`)),
        ui.h("span", { class: `pill ${d.status === "ok" ? "ok" : "warn"}` }, statusText)),
      ui.h("div", { class: "progress" }, ui.h("span", { style: { width: `${Math.round((d.fundedShare ?? 0) * 100)}%`, background: d.status === "ok" ? "var(--ok)" : d.status === "warn" ? "var(--warn)" : "var(--bad)" } })),
      ui.h("p", { class: "small" },
        d.status === "ok" ? `Your usable cash covers ${months(d.runwayMonths)} months of must-pay bills; the plan aims for ${d.targetMonths}.${above > 0 ? ` About ${fmt.money(above, cur)} above the target could work harder elsewhere.` : ""}`
        : `Your usable cash covers ${months(d.runwayMonths)} of the ${d.targetMonths} months the plan aims for. ${fmt.money(d.gap, cur)} more in savings gets you there.`),
      ui.h("p", { class: "muted small" }, "The target is months x your must-pay expenses. Change the months on the Assumptions page; mark expenses as must-pay on the Expenses page."),
    ));
  }
  root.append(ui.card(null, ui.row(
    ui.stat("Usable today", fmt.money(d.now, cur), d.earmarked ? `${TIERS.now.desc}; ${fmt.money(d.earmarked, cur)} more is set aside for goals` : TIERS.now.desc),
    d.oneOffs > 0 ? ui.stat("After one-time costs", fmt.money(d.nowAfterOneOffs, cur), `${fmt.money(d.oneOffs, cur)} of one-time costs are coming up${d.runwayAfterOneOffs !== null ? `: ${months(d.runwayAfterOneOffs)} months of must-pay bills after them` : ""}`) : null,
    d.expenses ? ui.stat("Months of must-pay bills", months(d.runwayMonths), d.fullRunwayMonths !== null ? `${months(d.fullRunwayMonths)} months of all spending` : null) : null,
    d.target ? ui.stat("Emergency fund target", fmt.money(d.target, cur), `${d.targetMonths} months of must-pay bills; ${d.gap ? `${fmt.money(d.gap, cur)} to go` : "you have it"}`) : null,
    ui.stat("Sellable within a week", fmt.money(d.week, cur), TIERS.week.desc),
  )));
  for (const w of d.warnings) root.append(ui.notice("info", w));

  for (const [tier, t] of Object.entries(TIERS)) {
    const rows = d.accounts.filter((a) => a.tier === tier);
    if (!rows.length) continue;
    root.append(ui.card(t.label,
      ui.h("p", { class: "muted small" }, t.desc),
      ui.h("ul", { class: "page-list" }, rows.map((a) => ui.h("li", {},
        ui.h("span", { class: "body" }, ui.h("div", { class: "t" }, a.name), ui.h("div", { class: "d" }, [a.typeLabel, a.institution].filter(Boolean).join(" · "))),
        ui.h("span", { class: "st" }, fmt.money(a.balance, cur))))),
    ));
  }
  root.append(ui.h("p", { class: "muted small" }, "Balances come from the Net worth page."), ui.row(ui.h("a", { href: "#/balance/net-worth", class: "btn secondary" }, "Update balances on Net worth")));
  // scoped style for the fund headline row
  root.append(ui.h("style", {}, ".fund-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 6px; } .fund-head .pill { margin-top: 6px; }"));
}

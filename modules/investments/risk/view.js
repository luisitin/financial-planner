// modules/investments/risk/view.js -- DOM only. What a bad year and the deepest fall would
// cost in your own dollars, then the same for the standard mixes.
import { compute } from "./compute.js";

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today() });
  const money = (n) => fmt.money(n, cur);
  const m = d.main;
  const mixText = (w) => `${Math.round(w.stocks * 100)}% stocks, ${Math.round(w.bonds * 100)}% bonds${w.bills > 0.005 ? `, ${Math.round(w.bills * 100)}% cash` : ""}`;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, d.amount > 0 ? `A bad year could take about ${money(-m.badYear)}` : "How rough is the ride?"),
    ui.h("p", { class: "lede" }, `${m.label} (${mixText(m.weights)})${d.amount > 0 ? ` on ${money(d.amount)}` : ""}: since 1871 a mix like this moved ${fmt.pct(m.stdev, 0)} a year either way around its ${fmt.pct(m.mean, 1)} average, lost money in ${Math.round(m.lossShare * 100)}% of years, and had its worst year in ${m.worstYearWhen} (${fmt.pct(m.worstYear, 0)}${d.amount > 0 ? `, ${money(-m.worstYearDollars)} of yours` : ""}). The deepest fall was ${fmt.pct(m.drawdown.depth, 0)} from ${m.drawdown.peakYear} to ${m.drawdown.troughYear}${d.amount > 0 ? ` (${money(m.drawdownDollars)})` : ""}${m.drawdown.recoveryYear ? `, made good by ${m.drawdown.recoveryYear}` : ""}.`),
    ui.h("p", { class: "muted small" }, `A "bad year" here is one standard deviation down, about a one-in-six year. Since 1970 the same mix has moved ${fmt.pct(m.recentStdev, 0)} a year with a worst year of ${fmt.pct(m.recentWorst, 0)} (${m.recentWorstWhen}). The plan's own assumption is ${fmt.pct(d.plan.stdev, 0)} a year around ${fmt.pct(d.plan.mean, 1)} (Assumptions page).`),
  ));
  for (const n of d.notes) root.append(ui.notice(n.includes("Retirement is") ? "warn" : "info", n));
  root.append(ui.card(null, ui.row(
    ui.stat("Ups and downs", fmt.pct(m.stdev, 0), "a year, one standard deviation"),
    ui.stat("Losing years", `${Math.round(m.lossShare * 100)}%`, "of years since 1871"),
    ui.stat("Worst year", fmt.pct(m.worstYear, 0), String(m.worstYearWhen)),
    ui.stat("Deepest fall", fmt.pct(m.drawdown.depth, 0), `${m.drawdown.peakYear} to ${m.drawdown.troughYear}`),
  )));
  if (d.held && d.target && Math.abs(d.held.weights.stocks - d.target.weights.stocks) > 0.02) root.append(ui.card("What you hold against your target",
    ui.h("ul", { class: "records" }, [d.held, d.target].map((x) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${x.label}: ${mixText(x.weights)}`), ui.h("span", { class: "rec-value" }, `${fmt.pct(x.stdev, 0)} a year`)), ui.h("div", { class: "rec-sub" }, `worst year ${fmt.pct(x.worstYear, 0)} (${money(-x.worstYearDollars)}), deepest fall ${fmt.pct(x.drawdown.depth, 0)} (${money(x.drawdownDollars)}), ${Math.round(x.lossShare * 100)}% losing years`)))),
  ));
  root.append(ui.card("The standard mixes, on your money",
    ui.h("ul", { class: "records" }, d.comparison.map((x) => ui.h("li", { style: Math.abs(x.weights.stocks - m.weights.stocks) < 0.1 ? { background: "var(--accent-soft)", borderRadius: "8px" } : null },
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${x.label} stocks / bonds`, Math.abs(x.weights.stocks - m.weights.stocks) < 0.1 ? ui.h("span", { class: "pill accent" }, "closest to yours") : null), ui.h("span", { class: "rec-value" }, `${fmt.pct(x.mean, 1)} a year`)),
      ui.h("div", { class: "rec-sub" }, `moves ${fmt.pct(x.stdev, 0)} a year · worst year ${fmt.pct(x.worstYear, 0)}${d.amount > 0 ? ` (${money(-x.worstYearDollars)})` : ""} · deepest fall ${fmt.pct(x.drawdown.depth, 0)}${d.amount > 0 ? ` (${money(x.drawdownDollars)})` : ""} · losing years ${Math.round(x.lossShare * 100)}%`)))),
    ui.h("p", { class: "muted small" }, "Yearly returns 1871-2025 (Shiller, then Damodaran), rebalanced once a year, before fees and taxes. Bonds are 10-year Treasuries. The Backtest page runs any two mixes side by side."),
  ));
  root.append(ui.card("What to do with this",
    ui.h("ul", { class: "records" }, [
      ["Pick the fall you can sit through", "The right mix is the most stock you can hold through a fall like 1929-32, 1973-74 or 2008 without selling at the bottom. Everything else is detail."],
      ["Time heals stocks, not always bonds", "Every ten-year stretch of a 60/40 mix has ended up in nominal terms; all-stock had losing decades. The Backtest page shows the worst ten years of any mix."],
      ["Money needed soon is not investment money", "Spending in the next three to five years belongs in cash and short bonds; the Emergency fund and Irregular expenses pages cover it."],
    ].map(([t, s]) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, t)), ui.h("div", { class: "rec-sub" }, s)))),
  ));
}

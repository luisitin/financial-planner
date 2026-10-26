// modules/investments/backtest/view.js -- DOM only. Two mixes through history: the verdict,
// the growth lines, the figures side by side, and the choices (mixes, start year, real or
// nominal) as chips.
import { compute } from "./compute.js";
import { lineChart } from "../../retirement/charts.js";

const state = { mixA: "own", mixB: "60-40", from: 1928, real: false };

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today(), ...state });
  const money = (n) => fmt.money(n, cur);
  const redraw = () => { root.innerHTML = ""; render(root, ctx); };
  const mixText = (m) => `${Math.round(m.stocks * 100)}% stocks, ${Math.round(m.bonds * 100)}% bonds${m.bills > 0.005 ? `, ${Math.round(m.bills * 100)}% cash` : ""}`;
  const A = d.a, B = d.b;
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, `${money(10000)} in ${A.from} became ${money(A.end)} by ${A.to}`),
    ui.h("p", { class: "lede" }, `${d.mixA.label} (${mixText(d.mixA)}): ${fmt.pct(A.cagr, 1)} a year${d.real ? " above inflation" : ""}, the worst year ${fmt.pct(A.stats.worst, 0)} (${A.worstYear}), the deepest fall ${fmt.pct(A.drawdown.depth, 0)} from ${A.drawdown.peakYear}${A.drawdown.recoveryYear ? `, made good by ${A.drawdown.recoveryYear}` : ", not yet made good"}. ${d.mixB.label} (${mixText(d.mixB)}) ended at ${money(B.end)}: ${fmt.pct(B.cagr, 1)} a year, worst year ${fmt.pct(B.stats.worst, 0)}, deepest fall ${fmt.pct(B.drawdown.depth, 0)}.`),
    ui.h("p", { class: "muted small" }, `${A.years} years of history, ${d.real ? "in today's dollars" : "in the dollars of each year"}. The past is a range of what markets do, not a forecast.`),
  ));
  for (const n of d.notes) root.append(ui.notice("info", n));
  const chip = (label, on, fn) => ui.h("button", { type: "button", class: `chip${on ? " on" : ""}`, onClick: fn }, label);
  const mixChips = (which) => ui.h("div", { class: "chips" }, [
    chip(`Your target`, state[which] === "own", () => { state[which] = "own"; redraw(); }),
    d.held ? chip("What you hold", state[which] === "held", () => { state[which] = "held"; redraw(); }) : null,
    ...d.presets.map((p) => chip(p.label, state[which] === p.key, () => { state[which] = p.key; redraw(); })),
  ]);
  root.append(ui.card("Which mixes",
    ui.h("div", { class: "muted small" }, "First mix"), mixChips("mixA"),
    ui.h("div", { class: "muted small", style: { marginTop: "6px" } }, "Compared with"), mixChips("mixB"),
    ui.h("div", { class: "muted small", style: { marginTop: "6px" } }, "Starting in"), ui.h("div", { class: "chips" }, d.startYears.map((y) => chip(String(y), state.from === y, () => { state.from = y; redraw(); }))),
    ui.h("div", { class: "chips" }, chip("Dollars of each year", !state.real, () => { state.real = false; redraw(); }), chip("Today's dollars", state.real, () => { state.real = true; redraw(); })),
  ));
  root.append(ui.card(`Growth of ${money(10000)}`,
    lineChart({ years: A.labels, series: [{ values: A.values, width: 2.5 }, { values: B.values, color: "var(--muted)", dash: "4 3" }], marks: A.drawdown.troughYear ? [{ year: A.drawdown.troughYear, label: "low" }] : [], label: "growth of 10,000, log scale", log: true }),
    ui.h("p", { class: "muted small" }, `Solid: ${d.mixA.label.toLowerCase()}. Dashed: ${d.mixB.label.toLowerCase()}. Log scale, so equal slopes are equal growth rates.`),
  ));
  const row = (label, fa, fb) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, label), ui.h("span", { class: "rec-value" }, fa)), ui.h("div", { class: "rec-sub" }, `${d.mixB.label}: ${fb}`));
  root.append(ui.card("Side by side",
    ui.h("ul", { class: "records" },
      row("Ended at", money(A.end), money(B.end)),
      row("A year, compounded", fmt.pct(A.cagr, 1), fmt.pct(B.cagr, 1)),
      row("Ups and downs (standard deviation)", fmt.pct(A.stats.stdev, 0), fmt.pct(B.stats.stdev, 0)),
      row("Worst year", `${fmt.pct(A.stats.worst, 0)} in ${A.worstYear}`, `${fmt.pct(B.stats.worst, 0)} in ${B.worstYear}`),
      row("Best year", `${fmt.pct(A.stats.best, 0)} in ${A.bestYear}`, `${fmt.pct(B.stats.best, 0)} in ${B.bestYear}`),
      row("Years with a loss", `${A.stats.lossYears} of ${A.years}`, `${B.stats.lossYears} of ${B.years}`),
      row("Deepest fall", `${fmt.pct(A.drawdown.depth, 0)}, ${A.drawdown.peakYear} to ${A.drawdown.troughYear ?? "-"}${A.drawdown.recoveryYear ? `, back by ${A.drawdown.recoveryYear}` : ""}`, `${fmt.pct(B.drawdown.depth, 0)}, ${B.drawdown.peakYear} to ${B.drawdown.troughYear ?? "-"}${B.drawdown.recoveryYear ? `, back by ${B.drawdown.recoveryYear}` : ""}`),
      A.worstTen ? row("Worst ten years", `${fmt.pct(A.worstTen.rate, 1)} a year, ${A.worstTen.from}-${A.worstTen.to}`, B.worstTen ? `${fmt.pct(B.worstTen.rate, 1)} a year, ${B.worstTen.from}-${B.worstTen.to}` : "-") : null,
      A.bestTen ? row("Best ten years", `${fmt.pct(A.bestTen.rate, 1)} a year, ${A.bestTen.from}-${A.bestTen.to}`, B.bestTen ? `${fmt.pct(B.bestTen.rate, 1)} a year, ${B.bestTen.from}-${B.bestTen.to}` : "-") : null,
    ),
    ui.h("p", { class: "muted small" }, "Sources: Robert Shiller's monthly data (1871-1927) and Aswath Damodaran's yearly returns (1928 on): the S&P 500 with dividends, 10-year Treasuries, 3-month bills, CPI."),
  ));
}

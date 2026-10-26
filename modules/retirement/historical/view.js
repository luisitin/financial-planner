// modules/retirement/historical/view.js -- DOM only. The plan replayed from every start year in
// history: how many stretches it survived, which would have sunk it, and the spending that
// survived them all.
import { lineChart } from "../charts.js";

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const host = ui.h("div");
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "If history repeated itself"),
    ui.h("p", { class: "lede" }, "Your plan replayed through every stretch of real US history since 1928: the same years of stock and bond returns and inflation, starting in 1929, in 1966, in 2000... Each start year is one run."),
  ));
  root.append(host);
  host.append(ui.notice("info", "Replaying history..."));
  ctx.computeRemote("retirement/historical", { today: fmt.today() }).then((d) => {
    host.innerHTML = "";
    if (!d || !d.ready) { host.append(ui.notice("warn", ui.h("span", {}, "The projection needs a few things first: ", (d?.missing ?? []).join("; "), ". ", ui.h("a", { href: "#/retirement/projection" }, "Projection page")))); return; }
    host.append(ui.card(null, ui.row(
      ui.stat("Survived", fmt.pct(d.successRate, 0), `of ${d.windows} start years (${d.dataRange[0]} to ${d.dataRange[1] - d.years + 1})`),
      ui.stat("Spending that survived every start", d.safeSpending !== null ? fmt.money(d.safeSpending, cur) : "-", `a year, today's dollars; you plan on ${fmt.money(d.spendingYearly, cur)}`),
      ui.stat("Typical amount left", fmt.money(Math.max(0, d.medianEndReal), cur), "middle start year, today's dollars"),
    ), ui.h("p", { class: "small" }, { strong: "Strong: it held up through the Depression, the 1970s and 2000-2009.", fair: "Fair: most stretches were fine; the worst starts below sank it.", weak: "Weak: many stretches of real history would have run this plan dry." }[d.verdict])));
    const years = d.runs.map((r) => r.startYear);
    const ends = d.runs.map((r) => Math.max(0, r.endReal));
    host.append(ui.card("Money left at the end, by the year the plan would have started",
      ends.some((v) => v > 0)
        ? lineChart({ years, series: [{ values: ends }], label: "end balance by start year" })
        : ui.notice("warn", "The money ran out before the end in every start year, so there is nothing left to chart."),
      ends.some((v) => v > 0) ? ui.h("p", { class: "muted small" }, "Today's dollars. Zero means the money ran out before the end.") : null,
    ));
    host.append(ui.card("The hardest starts",
      ui.h("ul", { class: "records" }, d.worst.map((w) => {
        const head = ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `Starting in ${w.startYear}`), ui.h("span", { class: `rec-value ${w.success ? "" : "bad"}` }, w.success ? fmt.money(w.endReal, cur) : `ran out at ${w.failAge}`));
        const sub = ui.h("div", { class: "rec-sub" }, w.success ? `left at the end; lowest point ${fmt.money(Math.max(0, w.minReal), cur)}` : `the money ran out at age ${w.failAge}, in ${w.failYear}`);
        return ui.h("li", {}, head, sub);
      })),
      ui.h("p", { class: "muted small" }, "Data: Aswath Damodaran's yearly returns (S&P 500 with dividends, 10-year Treasuries, 3-month bills, CPI), 1928 to " + d.dataRange[1] + "."),
    ));
  }).catch((e) => { host.innerHTML = ""; host.append(ui.notice("error", `Could not run it: ${e.message}`)); });
}

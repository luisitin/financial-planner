// modules/retirement/monte-carlo/view.js -- DOM only. Runs the projection thousands of times on
// the PC (or here if the PC is not connected), then shows the chance the money lasts, the range
// of outcomes as a band, and the age it ran out in the paths that failed.
import { bandChart } from "../charts.js";

const state = { paths: 2000, seed: 1 };

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const host = ui.h("div");
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "How often does the money last?"),
    ui.h("p", { class: "lede" }, "The same plan run thousands of times with returns drawn at random around your assumptions (the swings on the Assumptions page). The share of runs where the money lasts to the end is the plan's chance of success."),
    ui.h("p", { class: "muted small" }, ctx.store.backend() === "server" ? "Runs on your PC." : "Runs on this device (the PC is not connected)."),
  ));
  root.append(host);
  host.append(ui.notice("info", `Running ${state.paths.toLocaleString("en-US")} paths...`));
  ctx.computeRemote("retirement/monte-carlo", { today: fmt.today(), paths: state.paths, seed: state.seed }).then((d) => {
    host.innerHTML = "";
    if (!d || !d.ready) {
      const missing = (d?.missing ?? ["see the Projection page"]).join("; ");
      host.append(ui.notice("warn", ui.h("span", {}, `The projection needs a few things first: ${missing}. `, ui.h("a", { href: "#/retirement/projection" }, "Projection page"))));
      return;
    }
    const verdict = { strong: "Strong: the money lasted in almost every run.", fair: "Fair: it lasted in most runs, but not all. A little less spending or a little more saving moves this a lot.", weak: "Weak: it ran out in many runs. Look at spending, the retirement age and Social Security timing." }[d.verdict];
    host.append(ui.card(null, ui.row(
      ui.stat("Chance the money lasts", fmt.pct(d.successRate, 0), `${d.paths.toLocaleString("en-US")} runs, to ${d.endYear}`),
      ui.stat("Typical amount left", fmt.money(d.medianEndReal, cur), `at ${d.endYear}, today's dollars (middle run)`),
      d.failAges ? ui.stat("When it ran out", `age ${Math.round(d.failAges.p50)}`, `in the ${d.failAges.count} run${d.failAges.count === 1 ? "" : "s"} that failed; one in ten of those by ${Math.round(d.failAges.p10)}`) : ui.stat("Ran out", "never", "in any run"),
    ), ui.h("p", { class: "small" }, verdict)));
    const years = d.bands.map((b) => b.year);
    host.append(ui.card("The range of outcomes, in today's dollars",
      bandChart({ years, low: d.bands.map((b) => Math.max(0, b.p10)), high: d.bands.map((b) => b.p90), mid: d.bands.map((b) => Math.max(0, b.p50)), marks: [{ year: d.retireYear, label: "retire" }], label: "range of balances" }),
      ui.h("p", { class: "muted small" }, "The band holds the middle 80% of runs (one in ten did better than the top, one in ten worse than the bottom); the line is the middle run."),
    ));
    const at = (age) => d.byAge.find((b) => b.age === age);
    host.append(ui.card("Still funded at...",
      ui.h("ul", { class: "records" }, [70, 75, 80, 85, 90, 95].map((a) => at(a)).filter(Boolean).map((b) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `Age ${b.age} (${b.year})`), ui.h("span", { class: "rec-value" }, fmt.pct(b.funded, 0))), ui.h("div", { class: "progress", style: { margin: "6px 0 0" } }, ui.h("span", { style: { width: `${Math.round(b.funded * 100)}%`, background: b.funded >= 0.85 ? "var(--ok)" : b.funded >= 0.7 ? "var(--warn)" : "var(--bad)" } }))))),
    ));
    const pathsSel = ui.select([{ value: "1000", label: "1,000 runs (quick)" }, { value: "2000", label: "2,000 runs" }, { value: "10000", label: "10,000 runs (PC)" }], String(state.paths), { "aria-label": "Runs", onChange: (e) => { state.paths = Number(e.target.value); root.innerHTML = ""; render(root, ctx); } });
    host.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "How this is done"), ui.h("span", { class: "fold-chev" }, "›")),
      ui.h("div", { class: "fold-body" }, ui.h("p", { class: "muted small" }, `Each run draws a return for stocks and bonds every year (lognormal, mean ${fmt.pct(plan.assumptions.returnStocks, 1)} and ${fmt.pct(plan.assumptions.returnBonds, 1)}, swings ${fmt.pct(plan.assumptions.stdevStocks, 0)} and ${fmt.pct(plan.assumptions.stdevBonds, 0)}, mildly linked), inflation steady at ${fmt.pct(plan.assumptions.inflation, 1)}. The same seed gives the same answer every time.`), ui.h("div", { class: "form" }, ui.field("Runs", pathsSel)))));
  }).catch((e) => { host.innerHTML = ""; host.append(ui.notice("error", `Could not run it: ${e.message}`)); });
}

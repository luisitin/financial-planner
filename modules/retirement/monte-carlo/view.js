// modules/retirement/monte-carlo/view.js -- DOM only. Runs the projection thousands of times on
// the PC (or here if the PC is not connected), then shows the chance the money lasts, the range
// of outcomes as a band, and the age it ran out in the paths that failed.
import { bandChart } from "../charts.js";
import { ssNotice } from "../ss-notice.js";
import { needsWords } from "../../../core/words.js";

const state = { paths: 2000, seed: 1 };

export function render(root, ctx) {
  const { ui, fmt, plan } = ctx;
  { const ss = ssNotice(ctx); if (ss) root.append(ss); }   // no Social Security in the plan: say so first (ss-notice.js)
  const cur = plan.meta.currency;
  const host = ui.h("div");
  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Chance the money lasts"),
    ui.h("p", { class: "lede" }, "Your plan was tried thousands of times, each a pretend future with its own good and bad years mixed at random. The share of pretend futures in which the money lasts to the end is the chance it lasts."),
    ctx.view.build ? ui.h("p", { class: "muted small" }, ctx.store.backend() === "server" ? "Runs on your computer." : "Runs on this device (your computer is not connected).") : null,
  ));
  root.append(host);
  host.append(ui.notice("info", `Trying your plan ${state.paths.toLocaleString("en-US")} times...`));
  // careful: false: this page shows the chance at the plan's own spending, not the careful figure (Will the money last? does)
  ctx.computeRemote("retirement/monte-carlo", { today: fmt.today(), paths: state.paths, seed: state.seed, careful: false }).then((d) => {
    host.innerHTML = "";
    if (!d || !d.ready) {
      // the same words as every page that cannot run yet (core/words.js needsWords; wording follow-up l001), never "...: see Will the money last?."
      const missing = d?.missing?.length ? needsWords("First, the plan needs", d.missing) : "First, the plan needs a few answers.";
      host.append(ui.notice("warn", ui.h("span", {}, `${missing} `, ui.h("a", { href: "#/retirement/projection" }, "Will the money last?"))));
      return;
    }
    const verdict = { strong: d.successRate >= 1 ? "Strong: the money lasted in every pretend future." : "Strong: the money lasted in nearly every pretend future.", fair: "Fair: it lasted in most pretend futures, but not all. A little less spending or a little more saving moves this a lot.", weak: "Weak: it ran out in many pretend futures. Look at spending, the retirement age and Social Security timing." }[d.verdict];
    host.append(ui.card(null, ui.row(
      ui.stat("Chance the money lasts", fmt.pct(d.successRate, 0), `${d.paths.toLocaleString("en-US")} pretend futures, to ${d.endYear}`),
      ui.stat("Typical amount left", fmt.money(d.medianEndReal, cur), `at ${d.endYear}, today's dollars (the middle pretend future)`),
      d.failAges ? ui.stat("When it ran out", `age ${Math.round(d.failAges.p50)}`, `in the ${d.failAges.count} ${d.failAges.count === 1 ? "pretend future" : "pretend futures"} where the money ran out; in one in ten of those, it ran out by ${Math.round(d.failAges.p10)}`) : ui.stat("Ran out", "never", "in any pretend future"),
    ), ui.h("p", { class: "small" }, verdict)));
    const years = d.bands.map((b) => b.year);
    host.append(ui.card("The range of outcomes, in today's dollars",
      bandChart({ years, low: d.bands.map((b) => Math.max(0, b.p10)), high: d.bands.map((b) => b.p90), mid: d.bands.map((b) => Math.max(0, b.p50)), marks: [{ year: d.retireYear, label: "retire" }], label: "range of balances" }),
      ui.h("p", { class: "muted small" }, "The band holds the middle 80% of pretend futures (one in ten did better than the top, one in ten worse than the bottom); the line is the middle one."),
    ));
    const at = (age) => d.byAge.find((b) => b.age === age);
    host.append(ui.card("Still funded at...",
      ui.h("ul", { class: "records" }, [70, 75, 80, 85, 90, 95].map((a) => at(a)).filter(Boolean).map((b) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `Age ${b.age} (${b.year})`), ui.h("span", { class: "rec-value" }, fmt.pct(b.funded, 0))), ui.h("div", { class: "progress", style: { margin: "6px 0 0" } }, ui.h("span", { style: { width: `${Math.round(b.funded * 100)}%`, background: b.funded >= 0.85 ? "var(--ok)" : b.funded >= 0.7 ? "var(--warn)" : "var(--bad)" } }))))),
    ));
    const pathsSel = ui.select([{ value: "1000", label: "1,000 pretend futures (quick)" }, { value: "2000", label: "2,000 pretend futures" }, { value: "10000", label: ctx.view.build ? "10,000 pretend futures (best on your computer)" : "10,000 pretend futures" }], String(state.paths), { "aria-label": "Pretend futures", onChange: (e) => { state.paths = Number(e.target.value); root.innerHTML = ""; render(root, ctx); } });
    host.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "How this is done"), ui.h("span", { class: "fold-chev" }, "›")),
      ui.h("div", { class: "fold-body" }, ui.h("p", { class: "muted small" }, `Each pretend future picks a random return for stocks and bonds every year, averaging ${fmt.pct(plan.assumptions.returnStocks, 1)} and ${fmt.pct(plan.assumptions.returnBonds, 1)}, with typical swings of ${fmt.pct(plan.assumptions.stdevStocks, 0)} and ${fmt.pct(plan.assumptions.stdevBonds, 0)}, and inflation steady at ${fmt.pct(plan.assumptions.inflation, 1)}. The random picks are the same each time, so the answer does not change when you reopen the page.`), ui.h("div", { class: "form" }, ui.field("Runs", pathsSel)))));
  }).catch((e) => { host.innerHTML = ""; host.append(ui.notice("error", `Could not run it: ${e.message}`)); });
}

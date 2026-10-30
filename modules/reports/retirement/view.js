// modules/reports/retirement/view.js -- DOM only. The retirement report as a printable sheet: a
// plain-words opening, the range of outcomes chart, the plan's figures, history, Social Security,
// how the money comes out, required withdrawals, the plan every five years, the market stress tests.
import { reportFrame, figs, rtable, wideTable, section, list } from "../report-kit.js";
import { bandChart } from "../../retirement/charts.js";

const lc = (s) => String(s).charAt(0).toLowerCase() + String(s).slice(1);   // "Taxable, then pre-tax, then Roth" -> "taxable, then pre-tax, then Roth"

export function render(page, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => (n === null || n === undefined ? "-" : fmt.money(Math.round(n / 10) * 10, cur));
  const big = (n) => fmt.money(Math.round(n / 1000) * 1000, cur);
  const ageTxt = (a) => { const y = Math.floor(a + 1e-9), m = Math.round((a - y) * 12); return m ? `${y} and ${m} months` : String(y); };
  const longDate = (iso) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const host = ui.h("div", {}, ui.notice("info", "Putting the retirement report together (this runs the simulations)..."));
  page.append(host);
  ctx.computeRemote("reports/retirement", { today: fmt.today() }).then((d) => {
    host.replaceChildren();
    if (!d || !d.ready) {
      host.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Retirement report"),
        ui.h("p", { class: "lede" }, "Your retirement pages in one printable report: whether the money lasts and the chance it does, what history says, Social Security, how the money comes out, and the plan every five years. It needs:"),
        ui.h("ul", {}, (d?.missing ?? []).map((m) => ui.h("li", {}, m))), ui.row(ui.h("a", { class: "btn", href: "#/retirement/projection" }, "Will the money last?"))));
      return;
    }
    const { wrap, sheet } = reportFrame(ui, { title: "Retirement report" });
    host.append(wrap);
    const p = d.plan;
    sheet.append(ui.h("h1", {}, "Retirement report"), ui.h("p", { class: "rp-sub" }, `${plan.meta?.name ? `${plan.meta.name} · ` : ""}prepared ${longDate(d.today)} · today's dollars unless said otherwise`),
      ui.h("p", { class: "rp-lead" }, [
        p.retireYear ? `The spending years start in ${p.retireYear}, at ${money(p.spendingMonthly)} a month.` : `The plan spends ${money(p.spendingMonthly)} a month.`,
        p.success ? `At expected returns the money lasts to ${p.lastsTo} and leaves about ${big(p.endReal)}.` : `At expected returns the money runs out in ${p.shortYear}${p.shortAge ? `, at ${p.shortAge}` : ""}.`,
        d.chance ? `In ${fmt.pct(d.chance.rate, 0)} of ${d.chance.paths.toLocaleString("en-US")} simulated markets it lasts${d.history ? `; replayed through history since ${d.history.from} it lasts in ${fmt.pct(d.history.rate, 0)} of ${d.history.windows} starting years` : ""}.` : "",
        p.coverage !== null ? `Guaranteed income (Social Security and pensions) covers ${fmt.pct(p.coverage, 0)} of spending in the first retirement year.` : "",
      ].filter(Boolean).join(" ")));
    if (d.chance) {
      const years = d.chance.bands.map((b) => b.year);
      sheet.append(section(ui, "The range of outcomes",
        bandChart({ years, low: d.chance.bands.map((b) => Math.max(0, b.p10)), high: d.chance.bands.map((b) => b.p90), mid: d.chance.bands.map((b) => Math.max(0, b.p50)), marks: p.retireYear ? [{ year: p.retireYear, label: "retire" }] : [], height: 200, label: "Savings by year: the middle 80% of simulated outcomes and the middle one" }),
        ui.h("p", { class: "rp-sub" }, "The band holds the middle 80% of the simulated outcomes; the line is the middle one. Today's dollars.")));
    }
    sheet.append(section(ui, "The plan at expected returns",
      figs(ui, [p.retireYear ? ["Spending years start", String(p.retireYear)] : null, p.atRetirementReal !== null ? ["Saved by then", big(p.atRetirementReal)] : null, p.success ? ["The money lasts", `to ${p.lastsTo}`, "good"] : ["The money runs out", String(p.shortYear), "bad"], ["Left at the end", big(p.endReal)], ["Can carry a month", money(p.affordableMonthly)], ["Planned a month", money(p.spendingMonthly)]]),
      list(ui, [`Spending: ${lc(p.strategy)}.`, `Withdrawals: cash first, then ${lc(p.orderLabel)}.`, p.taxMode === "brackets" ? "Tax: the federal brackets on each year's income." : "Tax: one flat rate on pre-tax withdrawals."])));
    if (d.history) sheet.append(section(ui, "If history repeated",
      ui.h("p", {}, `The plan replayed from every starting year with the real returns and inflation that followed (${d.history.from} to ${d.history.to}): the money lasts in ${d.history.windows ? fmt.pct(d.history.rate, 0) : "-"} of ${d.history.windows}.`),
      d.history.worst.length ? rtable(ui, [{ label: "Hardest starting years", get: (w) => String(w.startYear) }, { label: "Result", num: true, get: (w) => (w.failAge ? `runs out at ${w.failAge}` : `lasts, ${big(w.endReal)} left`) }], d.history.worst) : null));
    if (d.socialSecurity.people.length) sheet.append(section(ui, "Social Security",
      rtable(ui, [{ label: "", get: (x) => x.name }, { label: "Claims at", get: (x) => ageTxt(x.claimAge) }, { label: "A month", num: true, get: (x) => money(x.monthly) }, ...[62, 70].map((a) => ({ label: `At ${a}`, num: true, get: (x) => money(x.options.find((o) => o.claimAge === a)?.monthly) }))], d.socialSecurity.people),
      d.socialSecurity.survivorMonthly ? ui.h("p", { class: "rp-sub" }, `If one of you dies, the other keeps ${Object.entries(d.socialSecurity.survivorMonthly).map(([id, v]) => `${money(v)} a month (${d.socialSecurity.names[id]})`).join(" or ")}.`) : null));
    const out = [];
    if (d.order) out.push(d.order.best === d.order.current ? `The withdrawal order (${lc(d.order.current)}) is already the one that leaves the most after tax.` : `Drawing ${lc(d.order.best)} would leave about ${big(d.order.gain)} more after tax than the plan's ${lc(d.order.current)} (Withdrawal order).`);
    if (d.roth) out.push(d.roth.gain > 500 ? `Roth conversions (${lc(d.roth.best)}) would leave about ${big(d.roth.gain)} more after tax (Roth conversions).` : "Roth conversions would make little difference to what is left after tax.");
    for (const r of d.rmd) out.push(`${r.name}'s required withdrawals begin in ${r.startYear}${r.firstRmdReal ? `, about ${money(r.firstRmdReal)} the first year` : ""}.`);
    if (out.length) sheet.append(section(ui, "How the money comes out", list(ui, out)));
    sheet.append(section(ui, `The plan every ${5} years`,
      wideTable(ui, [{ label: "Year", get: (r) => String(r.year) }, { label: "Ages", get: (r) => r.ages.join(" / ") }, { label: "Saved in", num: true, get: (r) => (r.contributions ? big(r.contributions) : "-") }, { label: "Income", num: true, get: (r) => (r.income ? big(r.income) : "-") }, { label: "Spent", num: true, get: (r) => (r.spending ? big(r.spending) : "-") }, { label: "Tax", num: true, get: (r) => (r.taxes ? big(r.taxes) : "-") }, { label: "Left", num: true, get: (r) => (r.short > 0 ? ui.h("span", { class: "rp-bad" }, "short") : big(r.end)) }], d.years)));
    if (d.market) sheet.append(section(ui, `Market stress tests (hitting ${d.hitYear})`,
      rtable(ui, [{ label: "", get: (m) => m.title }, { label: "Result", num: true, get: (m) => (m.success ? ui.h("span", { class: "rp-ok" }, `lasts, ${big(m.endReal)} left`) : ui.h("span", { class: "rp-bad" }, `runs out at ${m.failAge}`)) }], d.market)));
    sheet.append(ui.h("p", { class: "rp-foot" }, `Prepared with Financial Planner on ${longDate(d.today)}. Simulations draw returns around the plan's assumptions; history repeats only in rhyme. Look at it again at least once a year.`));
  });
}

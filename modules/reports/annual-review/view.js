// modules/reports/annual-review/view.js -- DOM only. The year in review as a printable sheet: an
// opening, net worth over the year, the money in and out, where it went, the months reviewed and
// their notes, the goals, the plan's health, and what next year holds.
import { reportFrame, figs, rtable, wideTable, section, list } from "../report-kit.js";
import { lineChart } from "../../retirement/charts.js";

let year = null;   // the year picked on this device

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const today = fmt.today();
  const longDate = (iso) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const host = ui.h("div", {}, ui.notice("info", "Rolling the year up..."));
  page.append(host);
  ctx.computeRemote("reports/annual-review", { today, year }).then((d) => {
    host.replaceChildren();
    if (!d || !d.ready) { host.append(ui.notice("warn", `The review needs ${(d?.missing ?? []).join(", ")}.`)); return; }
    const thisYear = Number(today.slice(0, 4));
    host.append(ui.h("div", { class: "chips", role: "group", "aria-label": "Year" }, [thisYear, thisYear - 1].map((y) => ui.h("button", { type: "button", class: `chip${d.year === y ? " on" : ""}`, "aria-pressed": d.year === y ? "true" : "false", onClick: () => { year = y; store.update(() => {}); } }, y === thisYear ? `${y} so far` : String(y)))));
    const { wrap, sheet } = reportFrame(ui, { title: `${d.year} in review` });
    host.append(wrap);
    const nw = d.netWorth, m = d.money;
    sheet.append(ui.h("h1", {}, `${d.year} in review`), ui.h("p", { class: "rp-sub" }, `${plan.meta?.name ? `${plan.meta.name} · ` : ""}${d.partial ? "the year so far · " : ""}prepared ${longDate(d.today)}`),
      ui.h("p", { class: "rp-lead" }, [
        nw ? `Net worth went from ${money(nw.first.netWorth)} to ${money(nw.last.netWorth)}: ${nw.change >= 0 ? "up" : "down"} ${money(Math.abs(nw.change))}.` : "No net-worth points were saved this year: save one each month on Net worth and next year's review will show the change.",
        m ? `${money(m.in)} came in and ${money(m.out)} went out${m.rate !== null ? `; ${fmt.pct(m.rate, 0)} of it was kept` : ""}.` : "",
        `${d.reviews.count} of ${d.partial ? Number(d.today.slice(5, 7)) : 12} months were reviewed.`,
        d.health ? `The plan's health today: ${d.health.score} out of 100 (${d.health.band.toLowerCase()}).` : "",
      ].filter(Boolean).join(" ")));
    if (nw) sheet.append(section(ui, "Net worth",
      figs(ui, [["At the start", money(nw.first.netWorth)], ["At the end", money(nw.last.netWorth)], ["Change", `${nw.change >= 0 ? "+" : "-"}${money(Math.abs(nw.change))}`, nw.change >= 0 ? "good" : "bad"]]),
      nw.points.length >= 3 ? lineChart({ years: nw.points.map((p) => new Date(Number(p.date.slice(0, 4)), Number(p.date.slice(5, 7)) - 1, 1).toLocaleDateString("en-US", { month: "short" })), series: [{ values: nw.points.map((p) => p.netWorth) }], height: 170, label: "Net worth through the year" }) : null));
    if (m) sheet.append(section(ui, "Money in and out (the bank files)",
      wideTable(ui, [{ label: "Month", get: (r) => r.label }, { label: "In", num: true, get: (r) => money(r.in) }, { label: "Out", num: true, get: (r) => money(r.out) }, { label: "Kept", num: true, get: (r) => money(r.net) }], m.months),
      d.categories.length ? rtable(ui, [{ label: "Where it went", get: (c) => c.label }, { label: "", num: true, get: (c) => money(c.total) }, { label: "Share", num: true, get: (c) => fmt.pct(c.share, 0) }], d.categories.slice(0, 10)) : null));
    sheet.append(section(ui, "The months reviewed", d.reviews.count ? list(ui, d.reviews.months.map((r) => ui.h("span", {}, ui.h("b", {}, r.label), r.note ? `: ${r.note}` : ""))) : ui.h("p", {}, "No months were marked reviewed: the Monthly review page walks through one in ten minutes.")));
    sheet.append(section(ui, "Goals", list(ui, [d.goals.reached.length ? `Reached: ${d.goals.reached.join(", ")}.` : "No goal is marked reached yet.", d.goals.open.length ? `Still open: ${d.goals.open.map((g) => `${g.name} (${g.status})`).join(", ")}.` : null])));
    sheet.append(section(ui, `What ${d.ahead.year} holds`,
      d.ahead.moments.length ? rtable(ui, [{ label: "When", get: (e) => (e.date ? new Date(Number(e.date.slice(0, 4)), Number(e.date.slice(5, 7)) - 1, 1).toLocaleDateString("en-US", { month: "short" }) : "") }, { label: "", get: (e) => `${e.icon} ${e.title}` }], d.ahead.moments) : ui.h("p", {}, "No dated moments on the timeline next year."),
      d.ahead.steps.length ? ui.h("ol", { class: "rp-list" }, d.ahead.steps.map((s) => ui.h("li", {}, ui.h("b", {}, `${s.title}. `), s.detail))) : null));
    sheet.append(ui.h("p", { class: "rp-foot" }, `Prepared with Financial Planner on ${longDate(d.today)} from the plan's saved points, monthly reviews and bank files.`));
  });
}

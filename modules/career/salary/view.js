// modules/career/salary/view.js -- DOM only. Each job's pay from now to retirement in today's money: the household's
// pay still to come, a chart, and per job the raise against prices, what the next raise keeps after tax, what one more
// percent or a raise won now is worth, the years ahead, and the raise, promotions and level-off age in a fold.
import { compute, useAverage, DEFAULTS, RAISE_NOW } from "./compute.js";
import { lineChart } from "../../retirement/charts.js";

let pending = null;   // the confirmation shown on the next render
let openJob = null;   // the job whose settings were just saved stays open

const STYLE = `
.sl-root .sl-lines { list-style: none; margin: 0; padding: 0; }
.sl-root .sl-lines li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); }
.sl-root .sl-lines li:last-child { border-bottom: 0; }
.sl-root .sl-lines li span:last-child { white-space: nowrap; font-variant-numeric: tabular-nums; font-weight: 600; }
.sl-root .sl-key { display: flex; gap: 14px; flex-wrap: wrap; font-size: var(--fs-xs); color: var(--muted); margin: 6px 0; }
.sl-root .sl-key i { display: inline-block; width: 18px; height: 0; border-top: 3px solid; vertical-align: middle; margin-right: 6px; }
.sl-root .sl-key i.dash { border-top-style: dashed; }
.sl-root .sl-verdict { font-weight: 650; margin: 10px 0 4px; }
.sl-root .sl-src { font-size: var(--fs-xs); color: var(--muted); }
`;
const COLORS = ["var(--accent)", "var(--muted)", "var(--text-2)"];

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n / 10) * 10, cur);
  const big = (n) => fmt.money(Math.round(n / 1000) * 1000, cur);
  const pct = (x, dp = 1) => `${(x * 100).toFixed(dp)}%`;
  const a = (text) => (/^(8|1[18](\D|$))/.test(text) ? "an" : "a");   // "an 8% raise", "a 3% raise"
  const today = fmt.today();
  const d = compute(plan, { today });
  const root = ui.h("div", { class: "sl-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  const saved = !!plan.whatIfs?.salary && Object.keys(plan.whatIfs.salary).length > 0;

  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Your pay ahead"),
      ui.h("p", { class: "lede" }, "How your pay could grow with raises and promotions until you retire, shown in today's money, so you can see what rising prices take away and what a raise really keeps."),
      ui.h("p", { class: "muted small" }, "First add your pay on the Income page as \"Pay from a job\", with its yearly raise."),
      ui.row(ui.h("a", { class: "btn", href: "#/cashflow/income" }, "Add your pay on Income"))));
    return;
  }

  if (!saved) root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Your pay ahead"),
    ui.h("p", { class: "lede" }, "Each job's pay from now until retirement, in today's money: the raise against rising prices, what the next raise keeps after tax, and what your career still brings in."),
    ui.h("p", { class: "muted small" }, "It starts from the raise on the Income page. Add promotions, or the age your pay stops growing, under each job.")));
  for (const w of d.warnings) root.append(ui.notice("warn", w));

  // the household
  const multi = d.jobs.length > 1;
  root.append(ui.card(multi ? "Your pay, together" : "Your pay", ui.row(
    ui.stat("Pay a year now", money(d.total.pay), `before tax; ${multi ? `${d.jobs.length} jobs` : d.jobs[0].name}`),
    ui.stat("Still to come before retiring", big(d.total.lifetimeReal), `before tax, in today's money; ${big(d.total.lifetimeNominal)} in the dollars of each year`),
  ), ui.h("p", { class: "muted small" }, `Today's money means dollars that buy what a dollar buys now, with prices rising ${pct(d.inflation)} a year (the Assumptions page).`)));

  // the chart, in today's money
  const years = [...new Set(d.jobs.flatMap((j) => j.rows.map((r) => r.year)))].sort((a, b) => a - b);
  if (years.length > 1) {
    const dashOf = (i) => (i === 0 ? null : i === 1 ? "6 4" : "2 3");
    const series = d.jobs.map((j, i) => ({ values: years.map((y) => j.rows.find((r) => r.year === y)?.real ?? NaN), color: COLORS[i % COLORS.length], dash: dashOf(i), width: 2 }));
    const twoJobs = (j) => d.jobs.filter((x) => x.personId === j.personId).length > 1;
    root.append(ui.card("In today's money, year by year",
      multi ? ui.h("div", { class: "sl-key" }, d.jobs.map((j, i) => ui.h("span", {}, ui.h("i", { class: i > 0 ? "dash" : null, style: { borderColor: COLORS[i % COLORS.length] } }), j.personName && !twoJobs(j) ? j.personName : j.name))) : null,
      lineChart({ years, series, height: 180, label: "Pay a year in today's money, by year" }),
      ui.h("p", { class: "muted small" }, "A flat line means the raises only keep up with prices; a rising line is a real gain.")));
  }

  for (const j of d.jobs) root.append(jobCard(j));

  // where the usual figures come from
  const b = d.benchmarks;
  const src = [b.budget, b.promotion, b.switchers, b.peak].filter((x) => x && x.text);
  if (src.length) root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "What raises usually are"), ui.h("span", { class: "fold-status" }, b.budget?.short ?? ""), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("ul", { class: "records" }, src.map((x) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, x.title), ui.h("span", { class: "rec-value" }, x.short)), ui.h("div", { class: "rec-sub" }, x.text), ui.h("div", { class: "sl-src" }, x.source))))));

  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/career/offer-compare" }, "Compare a job offer"), ui.h("a", { class: "btn secondary", href: "#/cashflow/income" }, "Income"), ui.h("a", { class: "btn secondary", href: "#/system/assumptions" }, "Assumptions"))));

  function jobCard(j) {
    const s = j.settings;
    const who = j.personName || "you";
    const card = ui.card(j.name);
    if (!j.atEnd) { card.append(ui.h("p", {}, `${who} has reached the retirement age on People, so there are no years ahead to show.`)); return card; }
    const endLabel = j.knownAge ? `When ${who} retires (${j.retireYear})` : `In ${j.atEnd.year}`;
    card.append(ui.row(
      ui.stat("Now", money(j.pay), "a year"),
      ui.stat(endLabel, money(j.atEnd.real), `in today's money; about ${money(j.atEnd.pay)} in ${j.atEnd.year} dollars`),
    ));
    const real = j.realGrowth;
    const levelOn = s.levelAge !== null && j.knownAge;
    const levelText = !levelOn ? "" : s.levelAge > j.ageNow ? `, then only as fast as prices from ${s.levelAge}` : `, held to prices (${who} is past ${s.levelAge})`;
    const raiseText = `${pct(s.raise)} a year${s.promoEvery ? ` and ${a(pct(s.promoBump, 0))} ${pct(s.promoBump, 0)} promotion every ${s.promoEvery} years` : ""}${levelText}`;
    card.append(ui.h("p", { class: "sl-verdict" }, Math.abs(real) < 0.0005
      ? `${raiseText}: the pay only keeps up with prices, so it buys about the same all the way.`
      : real > 0 ? `${raiseText}: about ${pct(real)} a year more than prices, so the pay buys more over time.`
        : `${raiseText}: ${pct(-real)} a year less than prices, so the pay buys less every year.`));
    card.append(ui.h("p", { class: "muted small" }, [j.raiseFrom === "typed" ? "The raise is the one you set below." : j.raiseFrom === "income" ? "The raise is the one on the Income page." : "No raise on the Income page, so the Assumptions page's pay rise is used.",
      j.endsEarly ? ` This pay ends on ${fmt.date(j.endsEarly)} (the Income page), so its years stop there.` : ""].join("")));

    const k = j.nextRaise;
    if (k.amount > 0) {
      const taxes = k.state > 0 ? "federal income tax, Social Security, Medicare and state tax" : "federal income tax, Social Security and Medicare";
      const rate = pct(k.rate);
      card.append(ui.h("h3", { style: { margin: "14px 0 4px" } }, `The next raise, in ${j.rows[1].year}`),
        ui.h("ul", { class: "sl-lines" },
          ui.h("li", {}, ui.h("span", {}, `${a(rate) === "an" ? "An" : "A"} ${rate} raise${k.promoted ? " with a promotion" : ""}`), ui.h("span", {}, `${money(k.amount)} a year`)),
          ui.h("li", {}, ui.h("span", {}, "Federal income tax"), ui.h("span", {}, `−${money(k.federal)}`)),
          ui.h("li", {}, ui.h("span", {}, "Social Security and Medicare"), ui.h("span", {}, `−${money(k.payroll)}`)),
          k.state > 0 ? ui.h("li", {}, ui.h("span", {}, "State tax"), ui.h("span", {}, `−${money(k.state)}`)) : null,
          ui.h("li", {}, ui.h("span", {}, ui.h("b", {}, "You keep")), ui.h("span", {}, `${money(k.keep)} (${pct(k.share, 0)})`))),
        ui.h("p", { class: "muted small" }, `After ${taxes}, worked out with your household's taxes as they are this year.${d.state && d.state.rate === null ? " State tax is not counted: set your state's rate on the State tax page." : d.state?.method === "prior" ? " State tax is at last year's average rate; the tax on a raise is often a little higher." : ""}`));
    }

    card.append(ui.h("h3", { style: { margin: "14px 0 4px" } }, "What moves it most"), ui.h("ul", { class: "sl-lines" },
      ui.h("li", {}, ui.h("span", {}, "All the pay still to come, before tax"), ui.h("span", {}, big(j.lifetime.real))),
      ui.h("li", {}, ui.h("span", {}, "A raise 1% bigger every year"), ui.h("span", {}, `+${big(j.extraPercent)}`)),
      ui.h("li", {}, ui.h("span", {}, `${a(pct(RAISE_NOW, 0)) === "an" ? "An" : "A"} ${pct(RAISE_NOW, 0)} raise won now`), ui.h("span", {}, `+${big(j.raiseNowWorth)}`))),
      ui.h("p", { class: "muted small" }, "All in today's money. A raise won now is worth more than its first year, because every later raise builds on it."));

    // the Income page's raise
    const avg = Math.round(j.avgGrowth * 1000) / 1000;
    const withWhat = [s.promoEvery ? "the promotions" : null, levelOn ? `pay held to prices from ${s.levelAge}` : null].filter(Boolean).join(" and ");
    if (Math.abs(avg - j.incomeGrowth) >= 0.0005) card.append(ui.h("p", {}, `On average this pay grows ${pct(avg)} a year${withWhat ? ` with ${withWhat}` : ""}; the Income page has ${pct(j.incomeGrowth)}.`),
      ui.row(ui.button(`Use ${pct(avg)} on the Income page`, () => {
        pending = `${j.name} now rises ${pct(avg)} a year on the Income page.`;
        store.update((p) => { useAverage(p, j); });
      }, { class: "secondary" })));

    // a few years ahead
    const marks = j.rows.filter((r, i) => i > 0 && (i % 5 === 0 || i === j.rows.length - 1));
    if (marks.length) card.append(ui.h("details", { class: "fold" }, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Years ahead"), ui.h("span", { class: "fold-chev" }, "›")),
      ui.h("ul", { class: "records" }, marks.map((r) => ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${r.year}${r.age !== null ? ` (age ${r.age})` : ""}`), ui.h("span", { class: "rec-value" }, money(r.real))), ui.h("div", { class: "rec-sub" }, `in today's money; ${money(r.pay)} in ${r.year} dollars`))))));

    // its settings
    const values = { raise: plan.whatIfs?.salary?.[j.incomeId]?.raise ?? null, promoEvery: s.promoEvery || null, promoBump: s.promoBump, levelAge: s.levelAge };
    const fields = [
      { key: "raise", label: "Raise every year", type: "percent", min: 0, max: 30, help: j.incomeGrowth > 0 ? `empty: the Income page's (${pct(j.incomeGrowth)})` : `empty: the Assumptions page's pay rise (${pct(plan.assumptions?.salaryGrowth ?? 0.03)})` },
      { key: "promoEvery", label: "A promotion every ... years", type: "number", min: 0, max: 20, step: "1", help: "empty or 0: no promotions" },
      { key: "promoBump", label: "Raise that comes with a promotion", type: "percent", min: 0, max: 100, help: `${pct(DEFAULTS.promoBump, 0)} is only an example: use what your employer gives` },
      { key: "levelAge", label: "Pay stops gaining on prices at age", type: "number", min: 18, max: 80, step: "1", help: j.knownAge ? "empty: raises run until retirement; from this age pay only keeps up with prices" : "needs a birth date on People" },
    ];
    card.append(ui.h("details", { class: "fold", open: openJob === j.incomeId || null }, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Raises and promotions"), ui.h("span", { class: "fold-status" }, s.promoEvery ? `${pct(s.raise)}, promotions` : pct(s.raise)), ui.h("span", { class: "fold-chev" }, "›")),
      ui.form(fields, values, (v) => {
        pending = "Saved."; openJob = j.incomeId;
        store.update((p) => {
          p.whatIfs = p.whatIfs ?? {}; p.whatIfs.salary = p.whatIfs.salary ?? {};
          p.whatIfs.salary[j.incomeId] = { raise: v.raise, promoEvery: v.promoEvery || 0, promoBump: v.promoBump ?? DEFAULTS.promoBump, levelAge: v.levelAge };
        });
      }, { submitLabel: "Work it out" })));
    return card;
  }
}

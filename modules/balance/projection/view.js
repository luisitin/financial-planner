// modules/balance/projection/view.js -- DOM only. Net worth over the years ahead in today's money: where it
// is in ten years and at retirement, a line with the moments marked, the moments listed, the parts every
// five years (a table on a wide screen, records on a phone), and the page's assumptions in a fold.
import { compute } from "./compute.js";
import { lineChart } from "../../retirement/charts.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.np-root .np-list { list-style: none; margin: 0; padding: 0; }
.np-root .np-list li { display: flex; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--line); }
.np-root .np-list li:last-child { border-bottom: 0; }
.np-root .np-list li { justify-content: flex-start; }
.np-root .np-year { font-weight: 650; font-variant-numeric: tabular-nums; flex: none; min-width: 3.2em; }
.np-root .np-d { color: var(--text-2); font-size: var(--fs-sm); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "np-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Net worth in the years ahead"),
      ui.h("p", { class: "lede" }, "What you own minus what you owe, year by year: savings growing, the home's value, debts paid down, and retirement spending it again."),
      ui.h("p", { class: "muted small" }, `To start, the plan needs ${d.missing.join("; ")}.`),
      ui.row(ui.h("a", { class: "btn", href: "#/household/people" }, "People"), ui.h("a", { class: "btn secondary", href: "#/retirement/projection" }, "Retirement"))));
    return;
  }

  const r10 = d.inTen, rr = d.atRetirement;
  root.append(ui.card(null, ui.row(
    ui.stat("Net worth now", money(d.now.netWorth), `${money(d.now.assets)} owned, ${money(d.now.liabilities)} owed`),
    r10 ? ui.stat(`In ten years (${r10.year})`, money(r10.netWorthReal), "in today's money") : ui.stat(`In ${d.last.year}`, money(d.last.netWorthReal), "in today's money"),
    rr && rr !== r10 ? ui.stat(`At retirement (${rr.year})`, money(rr.netWorthReal), "in today's money") : null,
  )));

  const years = d.rows.map((r) => r.year);
  const marks = d.milestones.filter((m) => ["retire", "debtfree", "mortgage"].includes(m.kind)).map((m) => ({ year: m.year, label: m.kind === "retire" ? "retire" : "debt-free" }));
  const seenMarks = new Set();
  root.append(ui.card("Net worth, in today's money", lineChart({ years, series: [{ values: d.rows.map((r) => r.netWorthReal) }], marks: marks.filter((m) => !seenMarks.has(m.year) && seenMarks.add(m.year)), label: "net worth over the years, in today's money" }),
    ui.h("p", { class: "muted small" }, `"Today's money" takes out ${((plan.assumptions?.inflation ?? 0.03) * 100).toFixed(1)}% a year of rising prices, so a figure buys what it would today. In money of the day, ${d.last.year}'s ${money(d.last.netWorthReal)} is ${money(d.last.netWorth)}.`)));

  if (d.milestones.length) root.append(ui.card("Along the way", ui.h("ul", { class: "np-list" }, d.milestones.map((m) => {
    const row = d.rows.find((r) => r.year === m.year);
    return ui.h("li", {}, ui.h("span", { class: "np-year" }, String(m.year)), ui.h("div", {}, ui.h("div", {}, m.label), row ? ui.h("div", { class: "np-d" }, `net worth ${money(row.netWorthReal)} in today's money`) : null));
  }))));

  // every five years: what makes it up
  const shown = d.rows.filter((r, i) => i % 5 === 4 || i === d.rows.length - 1);
  const real = (r, v) => money(v / r.priceLevel);
  const hasHome = d.now.homes > 0, hasCar = d.now.vehicles > 0, hasCollege = d.now.college > 0, hasOther = d.now.other > 0;
  root.append(ui.card("What makes it up",
    ui.h("div", { class: "only-wide" }, ui.table([
      { key: "year", label: "Year" }, { key: "age", label: "Age" },
      { key: "invested", label: "Savings and investments", align: "right", render: (r) => real(r, r.invested) },
      hasHome ? { key: "homes", label: "Home", align: "right", render: (r) => real(r, r.homes) } : null,
      hasCar ? { key: "vehicles", label: "Cars", align: "right", render: (r) => real(r, r.vehicles) } : null,
      hasCollege ? { key: "college", label: "529 plans", align: "right", render: (r) => real(r, r.college) } : null,
      hasOther ? { key: "other", label: "Other", align: "right", render: (r) => real(r, r.other) } : null,
      { key: "debts", label: "Owed", align: "right", render: (r) => real(r, r.debts) },
      { key: "nw", label: "Net worth", align: "right", render: (r) => ui.h("strong", {}, real(r, r.netWorth)) },
    ].filter(Boolean), shown)),
    ui.h("ul", { class: "records only-narrow" }, shown.map((r) => ui.h("li", {},
      ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, `${r.year}${r.age !== null ? ` · age ${r.age}` : ""}`), ui.h("span", { class: "rec-value" }, real(r, r.netWorth))),
      ui.h("div", { class: "rec-sub" }, [`${real(r, r.invested)} saved and invested`, hasHome ? `${real(r, r.homes)} home` : null, hasCar ? `${real(r, r.vehicles)} cars` : null, hasCollege ? `${real(r, r.college)} 529 plans` : null, hasOther ? `${real(r, r.other)} other` : null, r.debts > 0.5 ? `${real(r, r.debts)} owed` : "nothing owed"].filter(Boolean).join(" · "))))),
    ui.h("p", { class: "muted small" }, "All in today's money. Savings follow the retirement projection: contributions while you work, spending and tax taken out after. Debts follow the payoff plan on Debts."),
    ...d.notes.map((n) => ui.h("p", { class: "muted small" }, n))));

  // the page's assumptions
  const s = d.settings;
  root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "Assumptions"), ui.h("span", { class: "fold-status" }, `${s.years} years, homes +${(s.homeGrowth * 100).toFixed(1)}%`), ui.h("span", { class: "fold-chev" }, "›")),
    ui.form([
      { key: "years", label: "Years to show", type: "number", min: 1, max: 40, step: "1", help: `empty: to five years after retirement (${s.years} now)` },
      { key: "homeGrowth", label: "Home values grow each year", type: "percent", min: -5, max: 15, help: "about prices plus half a point over the long run" },
      { key: "vehicleLoss", label: "Cars lose each year", type: "percent", min: 0, max: 50 },
    ], { ...s, years: plan.whatIfs?.netWorth?.years ?? "" }, (v) => {
      pending = "Saved.";
      store.update((p) => { p.whatIfs = p.whatIfs ?? {}; p.whatIfs.netWorth = { years: v.years ?? null, homeGrowth: v.homeGrowth ?? null, vehicleLoss: v.vehicleLoss ?? null }; });
    }, { submitLabel: "Save" }),
    ui.h("p", { class: "muted small" }, "Investment returns, inflation and pay growth are the plan's own, on Settings. Spending on goals, gifts and inheritances is not in it.")));
  root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/balance/net-worth" }, "Net worth today"), ui.h("a", { class: "btn secondary", href: "#/retirement/projection" }, "Retirement"))));
}

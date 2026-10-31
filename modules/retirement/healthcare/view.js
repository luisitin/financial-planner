// modules/retirement/healthcare/view.js -- DOM only. Health cover between retiring and Medicare: the
// marketplace years, the credit on the plan's own income, what is left to pay, the cliff and how far each
// year sits from it; the household's benchmark premium and which rules to use, in a fold.
import { compute } from "./compute.js";
import { SCHEDULES, BENCHMARK_40 } from "./data/aca.js";

let pending = null;   // the confirmation shown on the next render

const STYLE = `
.hc-root .hc-list { list-style: none; margin: 0; padding: 0; }
.hc-root .hc-list li { display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--line); font-size: var(--fs-sm); }
.hc-root .hc-list li:last-child { border-bottom: 0; }
.hc-root .hc-list .hc-s { display: block; color: var(--muted); font-size: var(--fs-xs); }
.hc-root .hc-list b { white-space: nowrap; text-align: right; }
.hc-root .hc-bad { color: var(--bad); } .hc-root .hc-ok { color: var(--ok); }
`;

export function render(page, ctx) {
  const { ui, fmt, plan, store } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => fmt.money(Math.round(n), cur);
  const d = compute(plan, { today: fmt.today() });
  const root = ui.h("div", { class: "hc-root" }, ui.h("style", {}, STYLE));
  page.append(root);
  if (pending) { const n = ui.notice("ok", pending); root.append(n); setTimeout(() => n.remove(), 4000); pending = null; }

  root.append(ui.h("section", { class: "card accent hero" },
    ui.h("h1", {}, "Before Medicare"),
    ui.h("p", { class: "lede" }, "Retire before 65 and you need health cover until Medicare starts. Most people buy it on the marketplace (healthcare.gov or the state's site), where a tax credit lowers the premium based on your income. Your income in retirement is partly your choice: which accounts you draw from."),
    d.cliffIncome ? ui.h("p", { class: "muted small" }, `Under the law as it stands, a household of ${d.size} with income over ${money(d.cliffIncome)} (four times the poverty line) gets no credit at all: a dollar over can cost thousands.`) : null));
  if (!d.ready) { root.append(ui.card(null, ui.h("p", { class: "muted" }, `To work out the years before Medicare, the plan needs: ${d.missing.join("; ")}.`))); return; }

  if (d.onWorkPlan.length) root.append(ui.notice("info", `${d.onWorkPlan.map((y) => y.year).filter((y, i, a) => i === 0 || i === a.length - 1).join(" to ")}: ${d.onWorkPlan[0].covered.join(" and ")} can usually join ${d.onWorkPlan[0].worker}'s plan at work, so those years are not counted here.`));
  if (d.noBridge) { root.append(ui.card(null, ui.h("p", {}, "In your plan no one needs marketplace cover: everyone works until 65, or a partner's job covers the gap."), ui.h("p", { class: "muted small" }, "Thinking of retiring earlier? Try it on Compare what-ifs, then come back here."), ui.row(ui.h("a", { class: "btn secondary", href: "#/scenarios/compare" }, "Compare what-ifs")))); return settingsCard(d); }

  root.append(ui.card(null, ui.row(
    ui.stat("Cover until 65 costs", money(d.total), `${d.years.length} year${d.years.length === 1 ? "" : "s"}, after ${money(d.totalCredit)} of credits`),
    ui.stat("Years over the cliff", String(d.cliffYears), d.cliffYears ? "no credit those years" : "income stays under it"),
  )));
  if (d.cliffYears) {
    const over = d.years.filter((y) => y.overCliff > 0);
    const lost = over.reduce((s, y) => s + y.lostCredit, 0);
    root.append(ui.notice("warn", `In ${over.length} year${over.length === 1 ? "" : "s"} the plan's income is over the cliff by as little as ${money(Math.min(...over.map((y) => y.overCliff)))}, which costs about ${money(lost)} of credits in all. Drawing more from Roth, cash or an ordinary investment account (only the gains count as income) and less from a 401(k) or IRA in those years could keep income under the line.`));
  }
  if (d.underLineYears) root.append(ui.notice("info", `In ${d.underLineYears} year${d.underLineYears === 1 ? "" : "s"} the plan's income is under the poverty line, where the marketplace gives no tax credit. Medicaid may cover people with that income instead; your state's marketplace site will say. Drawing a little more taxable income in those years can also bring the credit back.`));
  root.append(ui.card("Year by year", ui.h("ul", { class: "hc-list" }, d.years.map((y) => ui.h("li", {},
    ui.h("span", {}, `${y.year}: ${y.covered.join(", ")}`, ui.h("span", { class: "hc-s" }, `income ${money(y.magi)}${y.room !== null ? `, ${money(y.room)} under the cliff` : y.overCliff ? `, ${money(y.overCliff)} over the cliff` : ""}${y.conversion > 1 ? ` (a Roth conversion of ${money(y.conversion)})` : ""}`)),
    ui.h("b", { class: y.overCliff ? "hc-bad" : null }, money(y.cost), ui.h("span", { class: "hc-s" }, y.credit > 0 ? `after ${money(y.credit)} credit` : y.underLine ? "no credit: under the poverty line" : "no credit"))))),
    ui.h("p", { class: "muted small" }, "The cost is the benchmark plan (the second-cheapest silver plan) for the people covered that year, less the credit, in today's dollars. Income is the plan's own: what it draws and earns that year. Cheaper bronze plans cost less up front and more when you are ill.")));
  settingsCard(d);

  function settingsCard(dd) {
    const s = plan.retirement?.aca ?? {};
    root.append(ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("h2", {}, "Premium and rules"), ui.h("span", { class: "fold-status" }, s.benchmarkMonthly ? `${money(s.benchmarkMonthly)} a month` : "national estimate"), ui.h("span", { class: "fold-chev" }, "›")),
      ui.form([
        { key: "benchmarkMonthly", label: "Benchmark premium for the two of you today, a month", type: "money", min: 0, help: `healthcare.gov's plan preview for your ZIP and ages: the second-cheapest silver plan. Empty: a national estimate (about ${money(BENCHMARK_40)} for a 40-year-old)` },
        { key: "rules", label: "Which credits", type: "select", options: Object.entries(SCHEDULES).map(([value, x]) => ({ value, label: x.label })) },
      ], { benchmarkMonthly: s.benchmarkMonthly ?? "", rules: dd.rules }, (v) => {
        pending = "Saved.";
        store.update((p) => { p.retirement = p.retirement ?? {}; p.retirement.aca = { benchmarkMonthly: v.benchmarkMonthly ?? null, rules: v.rules }; });
      }, { submitLabel: "Save" }),
      ui.h("p", { class: "muted small" }, "The larger credits of 2021 to 2025 (no cliff, at most 8.5% of income) ended with 2025. Congress may bring them back; switch the rules above to see the difference.")));
    root.append(ui.card("Next", ui.row(ui.h("a", { class: "btn secondary", href: "#/retirement/withdrawal-order" }, "Withdrawal order"), ui.h("a", { class: "btn secondary", href: "#/retirement/medicare" }, "Medicare at 65"))));
  }
}

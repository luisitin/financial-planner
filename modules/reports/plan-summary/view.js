// modules/reports/plan-summary/view.js -- DOM only. The plan summary as a document: a plain-words
// opening paragraph, then where you stand, each month's money, retirement, protection, goals, debts,
// the milestones ahead, the next steps, the plan's health and the assumptions. "Print or save as PDF"
// prints the same sheet on its own (report-kit.js). Runs on the PC when connected.
import { reportFrame, figs, rtable, section, list } from "../report-kit.js";

export function render(page, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => (n === null || n === undefined ? "-" : fmt.money(Math.round(n / 10) * 10, cur));
  const big = (n) => fmt.money(Math.round(n / 1000) * 1000, cur);
  const pct = (x, d = 0) => fmt.pct(x, d);
  const longDate = (iso) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const monthYear = (iso) => iso ? new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "-";
  const host = ui.h("div", {}, ui.notice("info", "Putting your plan summary together..."));
  page.append(host);
  ctx.computeRemote("reports/plan-summary", { today: fmt.today() }).then((d) => {
    host.replaceChildren();
    if (!d || !d.ready) {
      host.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Plan summary"),
        ui.h("p", { class: "lede" }, "A printable overview of your whole plan, in the style of an advisor's: where you stand, each month's money, retirement, protection, goals, debts and the next steps. It starts from:"),
        ui.h("ul", {}, (d?.missing ?? []).map((m) => ui.h("li", {}, m))), ui.row(ui.h("a", { class: "btn", href: "#/household/people" }, "People"))));
      return;
    }
    const title = `Financial plan summary${d.household.name ? `: ${d.household.name}` : ""}`;
    const { wrap, sheet } = reportFrame(ui, { title });
    host.append(wrap);
    const names = d.household.people.map((p) => `${p.name}${p.age !== null ? ` (${p.age})` : ""}`);
    const who = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
    const adults = d.household.people.filter((p) => p.role !== "dependent");
    const r = d.retirement;

    // the opening paragraph
    const lead = [
      `This plan is for ${who}.`,
      r.ready && r.retireYear ? `${adults.length > 1 ? "The household's" : "The"} spending years start in ${r.retireYear}.` : null,
      `Today ${adults.length > 1 ? "you own" : "you own"} ${big(d.netWorth.assets)} and owe ${big(d.netWorth.liabilities)}: a net worth of ${big(d.netWorth.netWorth)}.`,
      r.ready ? (r.success ? `At the plan's own assumptions the money lasts to ${r.lastsTo}, leaving about ${big(r.endReal)} in today's dollars` : `At the plan's own assumptions the money runs out in ${r.shortYear}${r.shortAge ? `, at ${r.shortAge}` : ""}`) + (r.chance !== null ? `; in ${pct(r.chance)} of ${r.paths.toLocaleString("en-US")} simulated markets it lasts.` : ".") : null,
      d.health ? `Plan health: ${d.health.score} out of 100 (${d.health.band.toLowerCase()}).` : null,
    ].filter(Boolean).join(" ");
    sheet.append(
      ui.h("h1", {}, "Financial plan summary"),
      ui.h("p", { class: "rp-sub" }, `${d.household.name ? `${d.household.name} · ` : ""}${d.household.filing}${d.household.state ? ` · ${d.household.state}` : ""} · prepared ${longDate(d.today)}`),
      ui.h("p", { class: "rp-lead" }, lead));

    sheet.append(section(ui, "Where you stand",
      figs(ui, [["Net worth", big(d.netWorth.netWorth)], ["What you own", big(d.netWorth.assets)], ["What you owe", big(d.netWorth.liabilities)], ["Cash", big(d.netWorth.cash)], ["Invested for later", big(d.netWorth.investable)]]),
      d.netWorth.investable > 0 ? ui.h("p", { class: "rp-sub" }, `Invested money by tax treatment: taxable ${big(d.netWorth.byTaxBucket.taxable)}, pre-tax ${big(d.netWorth.byTaxBucket.deferred)}, tax-free ${big(d.netWorth.byTaxBucket.free)}.`) : null));

    if (d.cashflow) {
      const c = d.cashflow;
      sheet.append(section(ui, "Each month",
        rtable(ui, [{ label: "", get: (x) => x[0] }, { label: "a month", num: true, get: (x) => x[1] }], [
          ["Income before tax", money(c.gross)], ["Federal income tax", `- ${money(c.federalTax)}`], ["Social Security and Medicare tax", `- ${money(c.payrollTax)}`], ["Spending", `- ${money(c.spending)}`],
          ["Retirement saving", `- ${money(c.retirementSaving)}`], ["Saving for goals", `- ${money(c.goalSaving)}`], [c.monthly >= 0 ? "Spare" : "Short", money(c.monthly)],
        ]),
        ui.h("p", { class: "rp-sub" }, "State and local income tax is not included.")));
    }

    if (r.ready) sheet.append(section(ui, "Retirement",
      figs(ui, [
        ["Spending years start", r.retireYear ? String(r.retireYear) : "now"],
        r.atRetirementReal !== null ? ["Saved by then (today's dollars)", big(r.atRetirementReal)] : null,
        r.success ? ["The money lasts", `to ${r.lastsTo}`, "good"] : ["The money runs out", String(r.shortYear), "bad"],
        r.chance !== null ? ["Chance it lasts (simulated)", pct(r.chance), r.chance >= 0.85 ? "good" : r.chance < 0.7 ? "bad" : null] : null,
        ["Can carry a month", money(r.affordableMonthly)], ["Planned a month", money(r.spendingMonthly)],
        r.socialSecurityMonthly > 0 ? ["Social Security a month", money(r.socialSecurityMonthly)] : null,
      ]),
      ui.h("p", {}, r.affordableMonthly >= r.spendingMonthly ? `The plan can carry about ${money(r.affordableMonthly - r.spendingMonthly)} a month more than it spends, steady after inflation, at expected returns.` : `To last at expected returns the plan would spend about ${money(r.spendingMonthly - r.affordableMonthly)} a month less, or save more, or retire later (Goal seek).`)));

    if (d.protection) sheet.append(section(ui, "Protection: the stress tests",
      ui.h("p", {}, `The plan survives ${d.protection.passed} of ${d.protection.total} shocks: five real market crises, lower returns, a job loss, never working again, a death, a long life and a care home.`),
      d.protection.failing.length ? list(ui, d.protection.failing.map((f) => ui.h("span", {}, ui.h("span", { class: "rp-bad" }, `${f.title}: `), `runs out ${f.failAge ? `at ${f.failAge}` : `in ${f.failYear}`}; about ${money(-f.roomMonthly)} a month less spending would make it last.`))) : ui.h("p", { class: "rp-ok" }, "No shock runs the money out.")));

    if (d.goals.length) sheet.append(section(ui, "Goals",
      rtable(ui, [{ label: "Goal", get: (g) => `${g.icon ? g.icon + " " : ""}${g.name}` }, { label: "Target", num: true, get: (g) => money(g.target) }, { label: "By", get: (g) => monthYear(g.targetDate) }, { label: "Status", get: (g) => ui.h("span", { class: g.status === "done" || g.status === "on track" ? "rp-ok" : g.status === "behind" || g.status === "past due" ? "rp-warn" : null }, g.status) }], d.goals)));

    if (d.debts.length) sheet.append(section(ui, "Debts",
      rtable(ui, [{ label: "Debt", get: (x) => x.name }, { label: "Owed", num: true, get: (x) => money(x.owed) }, { label: "Rate", num: true, get: (x) => (x.rate === null ? "-" : pct(x.rate, 1)) }, { label: "Payment", num: true, get: (x) => (x.payment ? money(x.payment) : "-") }, { label: "Paid off", get: (x) => monthYear(x.payoffDate) }], d.debts)));

    if (d.milestones.length) sheet.append(section(ui, "The next ten years",
      rtable(ui, [{ label: "When", get: (e) => (e.date ? monthYear(e.date) : String(e.year)) }, { label: "", get: (e) => `${e.icon} ${e.title}` }], d.milestones)));

    if (d.nextSteps.length) sheet.append(section(ui, "Next steps", ui.h("ol", { class: "rp-list" }, d.nextSteps.map((s) => ui.h("li", {}, ui.h("b", {}, `${s.title}. `), s.detail)))));

    if (d.health) sheet.append(section(ui, `Plan health: ${d.health.score} of 100`,
      rtable(ui, [{ label: "Part", get: (p) => p.title }, { label: "Points", num: true, get: (p) => `${Number.isInteger(p.points) ? p.points : p.points.toFixed(1)} / ${p.max}` }], d.health.parts)));

    const as = d.assumptions;
    sheet.append(section(ui, "Assumptions",
      list(ui, [`Inflation ${pct(as.inflation, 1)} a year; stocks earn ${pct(as.returnStocks, 1)} and bonds ${pct(as.returnBonds, 1)} a year before inflation.`,
        `Retirement at ${adults.map((p) => `${p.retirementAge ?? as.retirementAge} for ${p.name}`).join(", ")}; the plan runs to age ${as.planEndAge}.`,
        as.taxMode === "brackets" ? "Tax in retirement through the federal brackets." : "Tax in retirement at one flat rate on pre-tax withdrawals.",
        "Amounts are in today's dollars unless said otherwise."])),
      ui.h("p", { class: "rp-foot" }, `Prepared with Financial Planner on ${longDate(d.today)} from the figures in the plan. Projections are estimates built on the assumptions above, not promises; markets, laws and lives change. Look at it again at least once a year.`));
  });
}

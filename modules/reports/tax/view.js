// modules/reports/tax/view.js -- DOM only. The tax report as a printable sheet: this year's estimate
// step by step, the rates, the brackets, how it gets paid, gains, the HSA, and the tax in retirement.
import { reportFrame, figs, rtable, section, list } from "../report-kit.js";

export function render(page, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => (n === null || n === undefined ? "-" : fmt.money(Math.round(n), cur));
  const big = (n) => fmt.money(Math.round(n / 100) * 100, cur);
  const pct = (x, dg = 1) => fmt.pct(x, dg);
  const longDate = (iso) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const host = ui.h("div", {}, ui.notice("info", "Putting the tax report together..."));
  page.append(host);
  ctx.computeRemote("reports/tax", { today: fmt.today() }).then((d) => {
    host.replaceChildren();
    if (!d || !d.ready) {
      host.append(ui.h("section", { class: "card accent hero" }, ui.h("h1", {}, "Tax report"),
        ui.h("p", { class: "lede" }, "Your tax pages in one printable report: this year's federal estimate step by step, your rates and brackets, how the tax gets paid, and the tax your retirement plan pays year by year. It needs:"),
        ui.h("ul", {}, (d?.missing ?? []).map((m) => ui.h("li", {}, m))), ui.row(ui.h("a", { class: "btn", href: "#/taxes/federal" }, "Federal estimate"))));
      return;
    }
    const { wrap, sheet } = reportFrame(ui, { title: `Tax report ${d.year}` });
    host.append(wrap);
    const t = d.thisYear, pay = d.paying;
    sheet.append(ui.h("h1", {}, `Tax report, ${d.year}`), ui.h("p", { class: "rp-sub" }, `${plan.meta?.name ? `${plan.meta.name} · ` : ""}federal income tax${d.isIndexed ? " (this year's tables are estimated from the latest published)" : ""} · prepared ${longDate(d.today)}`),
      ui.h("p", { class: "rp-lead" }, `Federal income tax for ${d.year} comes to about ${money(t.totalTax)}: ${pct(t.effectiveRate)} of income. The next dollar of ordinary income pays ${pct(t.marginal, 0)}; ${Number.isFinite(t.roomInBracket) ? `${money(t.roomInBracket)} more taxable income fits in the ${pct(t.bracketRate, 0)} bracket before ${pct(t.nextRate, 0)} starts` : `that is the top bracket`}.`));
    sheet.append(section(ui, `${d.year}, step by step`,
      rtable(ui, [{ label: "", get: (s) => ui.h("span", {}, ui.h("b", {}, s.label), s.sub ? ui.h("span", { class: "rp-sub" }, ` · ${s.sub}`) : null) }, { label: "Amount", num: true, get: (s) => money(s.amount) }], d.thisYear.steps)));
    sheet.append(section(ui, "The rates",
      figs(ui, [["Federal tax", money(t.totalTax)], ["Of all income", pct(t.effectiveRate)], ["The next dollar", pct(t.marginal, 0)], ["Your bracket", pct(t.bracketRate, 0)], Number.isFinite(t.roomInBracket) ? ["Room left in it", big(t.roomInBracket)] : null])));
    sheet.append(section(ui, "The brackets",
      rtable(ui, [{ label: "Rate", get: (l) => ui.h("span", { class: l.current ? "rp-ok" : null }, pct(l.rate, 0)) }, { label: "Taxable income", get: (l) => (Number.isFinite(l.to) ? `${money(l.from)} to ${money(l.to)}` : `over ${money(l.from)}`) }, { label: "Yours in it", num: true, get: (l) => (l.filled > 0 ? money(l.filled) : "-") }, { label: "Tax", num: true, get: (l) => (l.tax > 0 ? money(l.tax) : "-") }], d.ladder)));
    const payLines = [];
    if (pay.verdict === "unknown") payLines.push("No withholding is on file, so whether paychecks take enough out is not known: the Withholding check page works it out from a pay stub.");
    else if (pay.verdict === "refund") payLines.push(`Withholding and estimated payments come to about ${money(pay.withheld + pay.estimatesPaid)}: a refund of about ${money(-pay.balance)} next spring.`);
    else if (pay.verdict === "owe") payLines.push(`Withholding and estimated payments come to about ${money(pay.withheld + pay.estimatesPaid)}: about ${money(pay.balance)} left to pay at filing${pay.penaltyRisk ? ", enough to risk the underpayment penalty" : ""}.`);
    else payLines.push(`Withholding and estimated payments come to about ${money(pay.withheld + pay.estimatesPaid)}: about right (${pay.balance >= 0 ? `${money(pay.balance)} to pay` : `${money(-pay.balance)} back`} at filing).`);
    if (pay.verdict !== "unknown" && pay.needsEstimates && pay.nextDue) payLines.push(`Estimated payments: the ${pay.nextDue.label} payment of ${money(pay.nextDue.amount)} is due ${longDate(pay.nextDue.due)}.`);
    sheet.append(section(ui, "Paying it", list(ui, payLines)));
    const more = [];
    if (d.gains.hasSales) more.push(`Sales this year add about ${money(d.gains.taxOnGains)} of tax.${d.gains.carryForward < 0 ? ` ${money(-d.gains.carryForward)} of loss carries to next year.` : ""}`);
    if (d.gains.zeroRoom > 0) more.push(`About ${money(d.gains.zeroRoom)} of long-term gains could still be taken this year at 0%.`);
    if (d.hsa) more.push(`The health savings account saves about ${money(d.hsa.taxSaved)} of tax this year; ${money(d.hsa.room)} of this year's ${money(d.hsa.limit)} limit is left.`);
    if (more.length) sheet.append(section(ui, "Gains and the HSA", list(ui, more)));
    const r = d.retirement;
    if (r.ready) sheet.append(section(ui, "Tax in retirement",
      ui.h("p", {}, `Over ${r.years} retirement years the plan pays about ${big(r.total)} of federal tax in today's dollars, ${big(r.average)} a year on average; the most in ${r.peak.year} (${big(r.peak.taxes)}${r.peak.why ? `, ${r.peak.why}` : ""}).${r.bracketsOn ? "" : ` The plan itself uses a flat rate (which would charge ${big(r.flatTaxes)}); these figures run the same years through the real brackets.`}`),
      rtable(ui, [{ label: "Bracket", get: (b) => pct(b.rate, 0) }, { label: "Years in it", num: true, get: (b) => String(b.years) }], r.byBracket)));
    sheet.append(ui.h("p", { class: "rp-foot" }, `Prepared with Financial Planner on ${longDate(d.today)}. An estimate of federal income tax from the plan's figures, not a return: state tax, the alternative minimum tax and some credits are not included. Check with the return you file.`));
  });
}

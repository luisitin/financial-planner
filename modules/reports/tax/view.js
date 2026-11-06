// modules/reports/tax/view.js -- DOM only. The tax report as a printable sheet: this year's estimate
// step by step, the rates, the brackets, how it gets paid, gains, the HSA, and the tax in retirement.
import { reportFrame, figs, rtable, section, list, settleReport } from "../report-kit.js";
import { ratePct } from "../../taxes/federal/compute.js";

export function render(page, ctx) {
  const { ui, fmt, plan } = ctx;
  const cur = plan.meta.currency;
  const money = (n) => (n === null || n === undefined ? "-" : fmt.money(Math.round(n), cur));
  const big = (n) => fmt.money(Math.round(n / 100) * 100, cur);
  const pct = (x, dg = 1) => fmt.pct(x, dg);
  const longDate = (iso) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const host = ui.h("div", {}, ui.notice("info", "Putting the tax report together..."));
  page.append(host);
  settleReport(ctx.computeRemote("reports/tax", { today: fmt.today() }), host, ui, "tax report", (d) => {
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
    // filing separately: each return's own bracket, room and next dollar, and its own ladder (compute thisYear.returns), not the
    // two returns' combined taxable income laid on one return's ladder (Review 2026-11-06)
    const sepRets = Array.isArray(t.returns) && t.returns.length > 1 ? t.returns : null;
    const who = (x) => `${x.name ?? "one spouse"}'s`;
    const roomWords = (x, short = false) => (Number.isFinite(x.roomInBracket) ? `${money(x.roomInBracket)} more ${short ? "" : "taxable income "}fits in the ${pct(x.bracketRate, 0)} bracket before ${pct(x.nextRate, 0)} starts` : `that is the top bracket`);
    sheet.append(ui.h("h1", {}, `Tax report, ${d.year}`), ui.h("p", { class: "rp-sub" }, `${plan.meta?.name ? `${plan.meta.name} · ` : ""}federal income tax${d.isIndexed ? " (this year's tables are estimated from the latest published)" : ""} · prepared ${longDate(d.today)}`),
      ui.h("p", { class: "rp-lead" }, `${t.totalTax < -0.5 ? `No federal tax for ${d.year}: the credits are about ${money(-t.totalTax)} more than the tax, and that comes back with the refund.` : `Federal tax for ${d.year} comes to about ${money(t.totalTax)}${t.seTax >= 1 ? ` (${money(t.seTax)} of it self-employment tax)` : ""}: ${ratePct(t.effectiveRate)} of income.`} ${sepRets
        ? `Filing separately, each return has its own brackets: ${sepRets.map((x, i) => (i ? `on ${who(x)}, the next dollar pays ${pct(x.nextDollar, 0)}, and ${roomWords(x, true)}` : `on ${who(x)} return the next dollar of ordinary income pays ${pct(x.nextDollar, 0)}, and ${roomWords(x)}`)).join("; ")}.`
        : `The next dollar of ordinary income pays ${pct(t.nextDollar ?? t.marginal, 0)}; ${roomWords(t)}.`}`));
    sheet.append(section(ui, `${d.year}, step by step`,
      rtable(ui, [{ label: "", get: (s) => ui.h("span", {}, ui.h("b", {}, s.label), s.sub ? ui.h("span", { class: "rp-sub" }, ` · ${s.sub}`) : null) }, { label: "Amount", num: true, get: (s) => money(s.amount) }], d.thisYear.steps)));
    const head = [t.totalTax < -0.5 ? ["Credits back", money(-t.totalTax)] : ["Federal tax", money(t.totalTax)], t.totalTax < -0.5 ? null : ["Of all income", ratePct(t.effectiveRate)]];
    // filing separately: the household's tax and rate, then a row a figure (the next dollar, the bracket, the room) with a
    // column a return, so the table stays inside a 360 px phone (verifier: a row a return with four columns was 329 px in a
    // 320 px section, and scrolled sideways at 360 px)
    const perReturn = [["The next dollar", (x) => pct(x.nextDollar, 0)], ["Bracket", (x) => pct(x.bracketRate, 0)], ["Room left in it", (x) => (Number.isFinite(x.roomInBracket) ? money(x.roomInBracket) : "top rate")]];
    sheet.append(sepRets
      ? section(ui, "The rates", figs(ui, head),
        rtable(ui, [{ label: "", get: ([label]) => ui.h("b", {}, label) }, ...sepRets.map((x) => ({ label: who(x), num: true, get: ([, f]) => f(x) }))], perReturn))
      : section(ui, "The rates",
        figs(ui, [...head, ["The next dollar", pct(t.nextDollar ?? t.marginal, 0)], ["Your bracket", pct(t.bracketRate, 0)], Number.isFinite(t.roomInBracket) ? ["Room left in it", big(t.roomInBracket)] : null])));
    const ladderTable = (rows, mine) => rtable(ui, [{ label: "Rate", get: (l) => ui.h("span", { class: l.current ? "rp-ok" : null }, pct(l.rate, 0)) }, { label: "Taxable income", get: (l) => (Number.isFinite(l.to) ? `${money(l.from)} to ${money(l.to)}` : `over ${money(l.from)}`) }, { label: mine, num: true, get: (l) => (l.filled > 0 ? money(l.filled) : "-") }, { label: "Tax", num: true, get: (l) => (l.tax > 0 ? money(l.tax) : "-") }], rows);
    sheet.append(sepRets
      ? section(ui, "The brackets", ui.h("p", {}, "Filing separately, each of you has your own ladder, on the brackets for a separate return."),
        ...sepRets.flatMap((x) => [ui.h("h3", {}, `${who(x)} return: ${money(x.ordinaryTaxable)} of ordinary taxable income`), ladderTable(x.ladder, `${who(x)} in it`)]))
      : section(ui, "The brackets", ladderTable(d.ladder, "Yours in it")));
    const payLines = [];
    // the same answer as Withholding check: typed figures, else withholding estimated from pay
    const took = pay.noPay && pay.from === "none" ? `Nothing is taken out of pay${pay.estimatesPaid > 0 ? `; estimated payments so far come to ${money(pay.estimatesPaid)}` : ""}`
      : `${pay.from === "typed" ? "Paychecks take out" : "Paychecks take out about"} ${money(pay.withheld)} by December${pay.from === "paycheck" ? " (estimated from pay)" : pay.from === "mixed" ? " (partly estimated from pay)" : ""}${pay.estimatesPaid > 0 ? ` and ${money(pay.estimatesPaid)} is paid in estimates` : ""}`;
    // filing separately: each return's own bill or refund, and its own estimated payments (compute `paying.returns`)
    const rets = Array.isArray(pay.returns) && pay.returns.length > 1 ? pay.returns : null;
    if (rets) {
      payLines.push(`About ${money(pay.totalTax)} of tax on the two returns. ${took}. Filing separately, each return settles on its own, and one return's refund cannot pay the other's bill.`);
      for (const x of rets) payLines.push(`${x.name}'s return: ${x.verdict === "owe" ? `about ${money(x.balance)} left to pay at filing${x.penaltyRisk ? ", enough to risk the underpayment penalty" : ""}` : x.verdict === "refund" ? `a refund of about ${money(-x.balance)} next spring` : `about right (${x.balance >= 0 ? `${money(x.balance)} to pay` : `${money(-x.balance)} back`} at filing)`}.`);
      for (const x of rets.filter((y) => y.needsEstimates)) {
        if (x.overdue) payLines.push(`Estimated payments on ${x.name}'s return: ${money(x.overdue.amount)} due from ${longDate(x.overdue.due)} on is not marked as paid.`);
        if (x.nextDue) payLines.push(`Estimated payments on ${x.name}'s return: the ${x.nextDue.label} payment of ${money(x.nextDue.amount)} is due ${longDate(x.nextDue.due)}.`);
      }
    }
    else if (pay.verdict === "unknown") payLines.push("Whether paychecks take enough out is not known yet: the Withholding check page works it out from a pay stub.");
    else if (pay.verdict === "refund") payLines.push(`About ${money(pay.totalTax)} of tax. ${took}: a refund of about ${money(-pay.balance)} next spring.`);
    else if (pay.verdict === "owe") payLines.push(`About ${money(pay.totalTax)} of tax. ${took}: about ${money(pay.balance)} left to pay at filing${pay.penaltyRisk ? ", enough to risk the underpayment penalty" : ""}.`);
    else payLines.push(`About ${money(pay.totalTax)} of tax. ${took}: about right (${pay.balance >= 0 ? `${money(pay.balance)} to pay` : `${money(-pay.balance)} back`} at filing).`);
    if (!rets && pay.verdict !== "unknown" && pay.needsEstimates && pay.overdue) payLines.push(`Estimated payments: ${money(pay.overdue.amount)} due from ${longDate(pay.overdue.due)} on is not marked as paid.`);
    if (!rets && pay.verdict !== "unknown" && pay.needsEstimates && pay.nextDue) payLines.push(`Estimated payments: the ${pay.nextDue.label} payment of ${money(pay.nextDue.amount)} is due ${longDate(pay.nextDue.due)}.`);
    sheet.append(section(ui, "Paying it", list(ui, payLines)));
    const more = [];
    if (d.gains.hasSales) more.push(`Sales this year add about ${money(d.gains.taxOnGains)} of tax.${d.gains.carryForward < 0 ? ` ${money(-d.gains.carryForward)} of loss carries to next year.` : ""}`);
    if (d.gains.zeroRoom > 0) more.push(`About ${money(d.gains.zeroRoom)} of long-term gains could still be taken this year at 0%.`);
    if (d.hsa) more.push(`The health savings account saves about ${money(d.hsa.taxSaved)} of tax this year; ${money(d.hsa.room)} of this year's ${money(d.hsa.limit)} limit is left.`);
    if (more.length) sheet.append(section(ui, "Gains and the HSA", list(ui, more)));
    const r = d.retirement;
    // no retirement year inside the plan (it ends before retirement, or everyone is past its end age): there is no peak year,
    // so the section says why instead of reading r.peak (Review 2026-11-06: 17 qa households never finished)
    if (r.ready && !(r.years > 0)) sheet.append(section(ui, "Tax in retirement",
      ui.h("p", {}, `There are no retirement years to tax: ${r.noYears?.why ?? "the plan has no years after work stops"}. Check ${r.noYears?.check ?? 'the retirement age and "Plan to age"'} on the People page.`)));
    else if (r.ready) sheet.append(section(ui, "Tax in retirement",
      ui.h("p", {}, `Over ${r.years === 1 ? "1 retirement year" : `${r.years} retirement years`} the plan pays about ${big(r.total)} of federal tax in today's dollars${r.years === 1 ? "" : `, ${big(r.average)} a year on average`}${r.peak && r.years > 1 ? `; the most in ${r.peak.year} (${big(r.peak.taxes)}${r.peak.why ? `, ${r.peak.why}` : ""})` : ""}.${r.bracketsOn ? "" : ` The plan itself uses a flat rate (which would charge ${big(r.flatTaxes)}); these figures run the same years through the real brackets.`}`),
      rtable(ui, [{ label: "Bracket", get: (b) => pct(b.rate, 0) }, { label: "Years in it", num: true, get: (b) => String(b.years) }], r.byBracket)));
    sheet.append(ui.h("p", { class: "rp-foot" }, `Prepared with Financial Planner on ${longDate(d.today)}. An estimate of federal income tax from the plan's figures, not a return: state tax, the alternative minimum tax and some credits are not included. Check with the return you file.`));
  });
}

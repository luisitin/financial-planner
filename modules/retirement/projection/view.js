// modules/retirement/projection/view.js -- DOM only. The verdict, the money over time, what the
// plan assumes, and the settings that every retirement page shares (folded, saved with a green line).
import { compute, healthAdded, healthSummary, incomeWords, onJobWords, spouseWords, saveSpendingFigure } from "./compute.js";
import { STRATEGIES } from "../../../core/math/retirement.js";
import { lineChart } from "../charts.js";
import { ssNotice } from "../ss-notice.js";
import { whenCareful, monthlyOf, CAREFUL_CHANCE, busyWords, RULE_WORDS, leftWords, leftWhy } from "../careful.js";

/** "a, b and c" */
const listOf = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

let pending = null;
let healthPending = null;   // the health toggle's confirmation, shown on the next render (the shell re-renders after store.update)

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  { const ss = ssNotice(ctx); if (ss) root.append(ss); }   // no Social Security in the plan: say so first (ss-notice.js)
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today(), showHealth: true });   // showHealth: with the box ticked, still say what cover would cost
  const rt = plan.retirement ?? {};
  const money = (n) => fmt.money(n, cur);

  if (!d.ready) {
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Will the money last?"),
      ui.h("p", { class: "lede" }, "This page runs your plan year by year to the end: what you have, what you add, what Social Security and pensions bring in, what you spend, and what is left each year. It needs a few things first:"),
      ui.h("ul", {}, d.missing.map((m) => ui.h("li", {}, m))),
      ui.row(ui.h("a", { class: "btn", href: "#/household/people" }, "People"), ui.h("a", { class: "btn secondary", href: "#/balance/net-worth" }, "Accounts"), ui.h("a", { class: "btn secondary", href: "#/cashflow/expenses" }, "Expenses")),
    ));
    root.append(settingsCard(ctx, d));
    return;
  }
  // "(Contributions page)" and the like are links to that page, not plain text to go and find
  const PAGES = { Contributions: "#/retirement/contributions", "Social Security": "#/retirement/social-security", Assumptions: "#/system/assumptions", Taxes: "#/taxes/federal" };
  const linked = (text) => String(text).split(/\((Contributions|Social Security|Assumptions|Taxes) pages?\)/).map((part, i) => i % 2 ? ["(", ui.h("a", { href: PAGES[part] }, `${part} page`), ")"] : part);
  // the line below is markets doing exactly as well as average every year; the careful figure (9 of 10 markets, from the
  // Monte Carlo page's engine) fills in under it once worked out (round 5, 2026-11-02: the average figure lasts in only
  // about 4 of 10 markets, and every page called it the most you could spend)
  // health cover (marketplace to 65, then Medicare) is added on top of the spending figure unless it already includes it (2026-11-02)
  const healthOn = healthAdded(d.health);
  const onTop = healthOn ? " on top of health cover" : "";
  const verdictText = { "on track": `On track if markets do as well as average: the plan then carries ${money(d.affordable)} a year of spending${onTop}, in today's dollars; you plan on ${money(d.spendingYearly)}.`, tight: `Tight. If markets do as well as average the plan carries about ${money(d.affordable)} a year${onTop}; you plan on ${money(d.spendingYearly)}. Small changes matter here.`, short: `Short. If markets do as well as average, ${money(d.spendingYearly)} a year${onTop} runs out in ${d.shortYear} (age ${d.shortAge}), ${d.affordable >= 1 ? `and the most the plan carries is about ${money(d.affordable)} a year` : "and even spending nothing it would not last to the end"}.` }[d.verdict];
  // the careful line, drawn first with grey bars where its figures go (the same words, so the same height: nothing jumps when
  // they arrive), then filled in after the first paint (careful.js: on the PC, or here a slice at a time)
  const steady = d.strategy === "fixed-real";
  // under 9 in 10 at the planned spending: said here, in amber, next to the figure (one verdict word on every page: the headline
  // above stays the average-market verdict that the Dashboard, Quick answers, Timeline and Goal seek also show; review 2026-11-05)
  const fewer = (share) => (share !== null && share < CAREFUL_CHANCE ? ui.h("span", { class: "pill warn" }, "fewer than 9 in 10") : null);
  const careWords = (y, mo, share, shareN = null) => steady
    ? ["In 9 of 10 markets the money carries about ", y, " a year ", ui.h("span", { style: { whiteSpace: "nowrap" } }, "(", mo), ` a month)${onTop}. At the ${money(d.spendingYearly)} you plan, it lasts in `, share, " of them (", ui.h("a", { href: "#/retirement/monte-carlo" }, "Chance the money lasts"), ").", fewer(shareN)]
    : ["In 9 of 10 markets the money carries about ", y, " a year ", ui.h("span", { style: { whiteSpace: "nowrap" } }, "(", mo), ` a month)${onTop}, spent the same every year. Your plan uses another rule, ${RULE_WORDS[d.strategy] ?? "its own"}, so what you spend moves with markets (`, ui.h("a", { href: "#/retirement/withdrawal-strategy" }, "How much to take out"), ")."];
  // a soft grey bar as wide as the figure that will take its place (the average figure's own length), so the lines break the same
  const slot = (like) => ui.h("span", { "aria-hidden": "true", style: { display: "inline-block", width: `${String(like).length * 0.55}em`, height: "0.8em", borderRadius: "4px", background: "var(--line-2)", verticalAlign: "-0.05em" } });
  // nothing lasts to the end even at $0 (affordable 0): no careful search, no placeholder; the average figure, named as such
  const noCare = !(d.affordable >= 1);
  const careLine = noCare ? null : ui.h("p", { "aria-live": "polite", "aria-busy": "true", style: { color: "var(--muted)" } }, busyWords(ui, "Working out the spending that lasts in 9 of 10 markets. "), ...careWords(slot(money(d.affordable)), slot(money(d.affordable / 12)), slot("98%")));
  const careSub = `a year${onTop}, today's dollars; ${money(d.affordable)} if markets do as well as average`;
  const careStat = ui.h("div", { style: { display: "contents" } }, noCare ? ui.stat("Spending it can carry", money(d.affordable), `a year${onTop}, today's dollars, if markets do as well as average`) : ui.stat("Spending that lasts in 9 of 10 markets", "...", careSub));
  const headline = ui.h("h1", {}, d.verdict === "on track" ? "The money lasts" : d.verdict === "tight" ? "It lasts, just" : `Runs out in ${d.shortYear}`);
  if (!noCare) whenCareful(ctx, careLine, (c) => {
    // nothing worked out, or nothing lasts in 9 of 10 markets even at $0: no careful line, the average figure named as such
    if (!c || !(c.yearly > 0)) { careLine.remove(); careStat.replaceChildren(ui.stat("Spending it can carry", money(d.affordable), `a year${onTop}, today's dollars, if markets do as well as average`)); return; }
    careLine.style.minHeight = `${careLine.offsetHeight}px`;   // never shorter than the placeholder it replaces
    careLine.style.color = "";
    careLine.removeAttribute("aria-busy");
    // the share rounded down, so a figure just under 9 in 10 never reads "90%" (review 2026-11-05)
    careLine.replaceChildren(...careWords(money(c.yearly), money(monthlyOf(c.yearly)), `${Math.floor(c.planned * 100)}%`, c.planned).filter((x) => x !== null));   // replaceChildren writes a null as the text "null"
    careStat.replaceChildren(ui.stat("Spending that lasts in 9 of 10 markets", money(c.yearly), careSub));
  });
  // who starts retirement (fifth pass): the first adult, or the last working adult when Get started says the first does not work,
  // or nobody ("nobody in the plan works now")
  const rb = d.retireBy ?? { name: d.people[0].name, age: d.atRetirement.age, first: true };
  // the first adult has stopped while a partner with pay works on (seventh pass): retirement starts now, the pay counted as income
  const paidOn = rb.stopped && rb.working?.length ? `${rb.name} ${rb.notWorking ? "is not working" : "has stopped work"}; ${listOf(rb.working.map((w) => `${w.name}'s pay comes in until ${w.untilYear}`))}` : null;
  const startWho = paidOn ?? (rb.nobody ? "nobody in the plan works now" : rb.first ? `${rb.name} at ${rb.age}` : `when ${rb.name} stops work at ${rb.age}`);
  root.append(ui.h("section", { class: "card accent hero" },
    headline,
    ui.h("p", { class: "lede" }, verdictText),
    careLine,
    // income not counted after work stops (support and other with no end date; dividends), and how to keep it (recheck 2026-11-05)
    ui.h("p", { class: "muted small" }, linked(`Retirement starts in ${d.atRetirement.year} (${startWho}); the plan runs to ${d.atEnd.year}. Expected returns, ${STRATEGIES[d.strategy].toLowerCase()}.${d.notes.length ? " " + d.notes.join(" ") : ""}`), ...(d.otherLeft?.length ? [" ", ...leftWords(ui, money, d.otherLeft)] : [])),
    // what would change the answer is on Goal seek (the most you could spend, the earliest age, what more to save): one tap away
    ui.row(ui.h("a", { class: "btn secondary", href: "#/scenarios/goal-seek" }, "What would change it ›")),
  ));
  root.append(ui.card(null, ui.row(
    ui.stat("At retirement", money(d.atRetirement.totalReal), `${d.atRetirement.year}, in today's dollars`),
    careStat,
    // all the income that comes in that year, named by what it is (recheck 2026-11-05: "Guaranteed income ... Social Security,
    // pensions, a partner's pay" read 203% for a couple whose rent and dividends were in it), against that year's spending and
    // health cover (the health line is spending too)
    ui.stat("Paid by income", d.coverage !== null ? fmt.pct(d.coverage, 0) : "-", `of the first retirement year's spending${healthOn ? " and health cover" : ""}${d.coverageFrom?.length ? `, from ${listOf(d.coverageFrom)}` : ": nothing comes in that year but savings"}`),
    ui.stat(`Left in ${d.atEnd.year}`, money(Math.max(0, d.atEnd.totalReal)), d.atEnd.totalReal > 0 ? "today's dollars" : "nothing"),
  )));
  const years = d.rows.map((r) => r.year);
  root.append(ui.card("Money over the years, in today's dollars",
    lineChart({ years, series: [{ values: d.rows.map((r) => r.totalReal) }], marks: [{ year: d.atRetirement.year, label: "retire" }], label: "balance over the years" }),
    ui.h("p", { class: "muted small" }, "One line, expected returns. The Monte Carlo and History pages show the range around it."),
  ));
  root.append(ui.card("What goes into this",
    ui.h("ul", { class: "records" }, [
      // the first adult who has stopped while a partner's pay comes in (seventh pass): their age on file is not when it starts
      ["People", d.people.map((p) => (rb.stopped && rb.id === p.id ? `${p.name}: ${rb.notWorking ? "not working now" : "stopped work"} (${p.retireAge} on file), plan to ${p.endAge}` : `${p.name}: retires at ${p.retireAge}, plan to ${p.endAge}`)).join("; ")],
      ["Retirement money today", `${money(d.inputs.balances.cash + d.inputs.balances.taxable + d.inputs.balances.deferred + d.inputs.balances.free)}: ${money(d.inputs.balances.cash)} cash, ${money(d.inputs.balances.taxable)} taxable, ${money(d.inputs.balances.deferred)} pre-tax, ${money(d.inputs.balances.free)} tax-free`],
      ["Added each year until retirement", d.inputs.contributions.length ? `${money(d.inputs.contributions.reduce((s, c) => s + c.yearly, 0))}, rising with pay (Contributions page)` : "nothing entered (Contributions page)"],
      // each line by its own name, with its ages or years (incomeWords: rent says "from 2033", never its owner's age)
      ["Income counted", d.inputs.incomes.length ? incomeWords(d.inputs, money).join("; ") : "none entered (Social Security page)"],
      ...(d.otherLeft?.length ? [["Not counted", d.otherLeft.map((x) => `${x.name}: ${money(x.yearly)} a year, ${leftWhy(x)}`).join("; ")]] : []),
      ["Spending in retirement", `${money(d.spendingYearly)} a year in today's dollars${d.spendingSource === "expenses" || d.health?.fromSetup ? ` (${d.health?.fromSetup ? "the figure from Get started" : "today's expenses"}${d.health?.removedMonthly > 0 ? `, less ${money(d.health.removedMonthly)} a month of health insurance` : ""})` : ""}${healthOn ? ", on top of health cover" : d.health?.included ? ", health cover included" : ""}`],
      ["Growth and inflation", `${fmt.pct(d.inputs.returns.stocks, 1)} stocks, ${fmt.pct(d.inputs.returns.bonds, 1)} bonds, ${fmt.pct(d.inputs.rates.inflation, 1)} inflation (Assumptions page); ${Math.round(d.inputs.rates.stocksNow * 100)}% in stocks now, ${Math.round(d.inputs.rates.stocksRetired * 100)}% in retirement`],
      ["Taxes", d.inputs.tax?.mode === "brackets" ? `the federal brackets on each year's income, filing ${d.inputs.tax.filingStatus.replace(/_/g, " ").replace("married joint", "jointly").replace("married separate", "separately")} (Taxes pages); withdrawals ${d.orderLabel.toLowerCase()}${d.inputs.rothConversion ? `; Roth conversions fill the ${fmt.pct(d.inputs.rothConversion.fillRate, 0)} bracket before required withdrawals` : ""}; required withdrawals from ${d.inputs.rmd.startAge}` : `${fmt.pct(d.inputs.rates.taxRate, 0)} on money taken from pre-tax accounts; withdrawals ${d.orderLabel.toLowerCase()}; required withdrawals from ${d.inputs.rmd.startAge}`],
    ].flatMap(([k, v]) => [ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, k)), ui.h("div", { class: "rec-sub" }, linked(v))),
      // health cover right under the spending it goes on top of (by its name: the "Not counted" row comes and goes above it)
      ...(k === "Spending in retirement" ? [healthRecord(ctx, d)] : [])]).filter(Boolean)),
  ));
  root.append(settingsCard(ctx, d));
}

/**
 * The health line as a record of "What goes into this" (2026-11-02): marketplace cover from retirement to 65 after the
 * credit, then Medicare, both worked out on their own pages and added on top of the spending figure, the cliff year when
 * there is one, and the box "My spending figure already includes health cover" (retirement.healthIncluded, saved on change).
 */
function healthRecord(ctx, d) {
  const { ui, fmt, store, plan } = ctx;
  const h = d.health;
  if (!h) return null;
  const around = (n) => fmt.money(Math.round(n / 10) * 10, plan.meta.currency);
  const list = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
  const span = (from, until, n) => (from === until ? `${from}` : n === 2 ? `${from} and ${until}` : `${from} to ${until}`);
  // years as words: "2053", "2053 and 2054", "2053 to 2056", or a list when they skip
  const yearsOf = (ys) => (ys.length === 1 ? `${ys[0]}` : ys.length === 2 || ys.at(-1) - ys[0] + 1 !== ys.length ? list(ys.map(String)) : `${ys[0]} to ${ys.at(-1)}`);
  // a sentence a part, naming the people and the years (healthSummary; fifth pass, 2026-11-02): "Bo: about $210 to $1,440 a
  // month, 2026 and 2027 (marketplace; with the credit in the years it applies). Ana: Medicare, about $240 a month from 2026.
  // Bo: Medicare from 2028 (about $480 a month for the two of you)." "after the credit" only when every year of a part has
  // one, "with the credit in the years it applies" when some do (creditWords)
  const say = (b, m, surcharge) => healthSummary(b, m, { money: (n) => fmt.money(n, plan.meta.currency), surcharge });
  const words = [];
  if (h.included) {
    const s = h.shown;
    words.push("Not added: you said your spending figure already includes it.");
    if (s) words.push(`Without that, the plan would add about ${around(s.total)} in all, in today's dollars. ${say(s.bridge, s.medicare, false)}`);
  } else {
    const b = h.bridge, m = h.medicare;
    // the total names what it holds; a work premium kept while a partner works is said on its own line, with its own amount
    const jobTotal = h.jobPlan?.total ?? 0;
    if (b || m) words.push(`${say(b, m, true)} About ${around(h.total - jobTotal)} in all for ${list([b ? "the marketplace" : null, m ? "Medicare" : null].filter(Boolean))}, in today's dollars, added to what you spend.`);
    // married filing separately: no marketplace credit (26 U.S.C. 36B(c)(1)(C); seventh pass), said once
    if (b?.separate) words.push("You file separate returns, and a married couple filing separately gets no marketplace tax credit, so the full premium is counted. Only someone living apart from a spouse who abused or abandoned them can still get it (the instructions for IRS Form 8962 say how).");
    // what Medicare holds beyond Part B and the drug plan, and what it leaves out (seventh pass)
    if (m) words.push(`Medicare here is Part B, a drug plan and a supplement (${m.supplementDefault ? `about ${fmt.money(Math.round(m.supplementMonthly), plan.meta.currency)} a month each, the national average for Medigap Plan G; yours on the Medicare page` : m.supplementMonthly > 0 ? `${fmt.money(Math.round(m.supplementMonthly), plan.meta.currency)} a month each, as you entered on the Medicare page` : "none: you entered $0 on the Medicare page"}). Not counted: what you pay at the pharmacy, dental care, glasses, hearing aids and long-term care.`);
    if (b?.underLine?.length) words.push(`In ${yearsOf(b.underLine)} the plan's income is under the poverty line, where the marketplace gives no credit: Medicaid may cover people with that income instead (your state's marketplace site will say).`);
    if (h.paidBy) words.push(h.paidBy.era
      ? `Your expenses list "${h.paidBy.line}": with ${list(h.paidBy.names)} 65 or over and retired, that counts as ${h.paidBy.names.length > 1 ? "their" : `${h.paidBy.names[0]}'s`} Medicare and any supplement, so it stays in your spending and Medicare is not added again.`
      : `Medicare for ${list(h.paidBy.names)} is already in your spending (your expenses list "${h.paidBy.line}"), so it is not added again.`);
    if (h.otherLine) words.push(`Your expenses list "${h.otherLine}": nobody here is 65 yet, so it stays in your spending as it is, and your own Medicare is added from 65.`);
    // the Medicare years left to a job's plan, a sentence for each worker's run of years (onJobWords; verify 2026-11-06)
    if (h.onJob) words.push(...onJobWords(h.onJob, list));
    // a husband's or wife's Medicare counted while the other still works, and how to leave it out (spouseWords; seventh pass)
    if (h.spouseOnJob) words.push(...spouseWords(h.spouseOnJob, list));
    if (h.coverLines?.length) words.push(`${list(h.coverLines.map((x) => `"${x.name}"`))} on Expenses ${h.coverLines.length === 1 ? "is" : "are"} left out of retirement spending: cover from retirement on is worked out here instead.`);
    if (h.jobPlan) words.push(`While ${h.jobPlan.worker} still works (${span(h.jobPlan.fromYear, h.jobPlan.untilYear, h.jobPlan.years)}), the ${around(h.jobPlan.monthly)} a month stays in, for the plan at work: about ${around(h.jobPlan.total)}${b || m ? " more" : ""} over ${h.jobPlan.years === 1 ? "that year" : "those years"}.`);
    if (!words.length) return null;
  }
  const out = ui.h("div");
  if (healthPending) { const n = ui.notice("ok", healthPending); out.append(n); setTimeout(() => n.remove(), 4000); healthPending = null; }
  const box = ui.h("input", { type: "checkbox", checked: h.included ? true : null, onChange: (e) => {
    const on = e.target.checked;
    healthPending = on ? "Saved: your spending figure counts as including health cover, so none is added." : "Saved: health cover is added on top of your spending.";
    store.update((p) => { p.retirement = p.retirement ?? {}; if (on) p.retirement.healthIncluded = true; else delete p.retirement.healthIncluded; });
  } });
  // the cliff: which years are over it, by how little, what it costs and that the cost is already in the figure above
  const cliff = !h.included && h.bridge?.cliff ? h.bridge.cliff : null;
  const cliffYears = cliff ? yearsOf(cliff.yearsList) : "";
  return ui.h("li", {}, out,
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, "Health cover")),
    ui.h("div", { class: "rec-sub" }, words[0]),
    // what is left out or kept, and why (a Medicare line, years on a job's plan, a premium), under the figure itself
    words.length > 1 ? ui.h("div", { class: "rec-sub", style: { marginTop: "6px" } }, words.slice(1).join(" ")) : null,
    cliff ? ui.h("div", { class: "rec-sub", style: { marginTop: "6px" } }, `In ${cliffYears} the plan's income is over ${fmt.money(Math.round(cliff.income), plan.meta.currency)} (by ${cliff.years > 1 ? "as little as" : "about"} ${around(cliff.overBy)}), so ${cliff.years > 1 ? "those years get" : "that year gets"} no marketplace credit: about ${around(cliff.lostTotal)}, already in the cost above. Taking ${cliff.years > 1 ? "those years'" : "that year's"} money from Roth or cash could keep the credit (Healthcare before 65 shows how).`) : null,
    ui.row(ui.h("a", { class: "btn secondary", href: "#/retirement/healthcare" }, "Healthcare before 65 ›"), ui.h("a", { class: "btn secondary", href: "#/retirement/medicare" }, "Medicare ›")),
    ui.h("label", { style: { display: "flex", gap: "10px", alignItems: "center", minHeight: "44px", marginTop: "4px", fontSize: "var(--fs-sm)" } }, box, ui.h("span", {}, "My spending figure already includes health cover")));
}

function settingsCard(ctx, d) {
  const { ui, fmt, store, plan } = ctx;
  const rt = plan.retirement ?? {};
  const out = ui.h("div");
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  // the box shows what the plan counts before health cover (figureMonthly; fourth pass, 2026-11-02): a typed figure as it is,
  // or Get started's own less the health insurance among today's bills that the health line replaces
  const spendNow = d.figureMonthly ?? (Number(rt.spendingMonthly) > 0 ? Number(rt.spendingMonthly) : null);
  const less = d.health?.fromSetup && d.health.removedMonthly > 0 ? `: Get started's figure from today's bills, less ${fmt.money(Math.round(d.health.removedMonthly), plan.meta.currency)} a month of health insurance` : "";
  const FIELDS = [
    // the help follows the box under Health cover: before cover (the plan adds it), or cover included (you said so)
    { key: "spendingMonthly", label: "Spending in retirement, a month", type: "money", min: 0, help: rt.healthIncluded === true ? "today's dollars, health cover included (you said so under Health cover); blank uses today's expenses" : `today's dollars, before health cover (the plan adds it)${less}; blank uses today's expenses` },
    { key: "stocksNow", label: "Share in stocks now", type: "percent", min: 0, max: 100, help: "the rest counts as bonds" },
    { key: "stocksRetired", label: "Share in stocks once retired", type: "percent", min: 0, max: 100 },
    { key: "taxMode", label: "How tax is worked out", type: "select", options: [{ value: "flat", label: "A flat rate on pre-tax withdrawals (quick)" }, { value: "brackets", label: "The federal brackets on each year's income" }], help: "the brackets use the filing status from the People page and the rules on the Taxes pages" },
    { key: "taxRate", label: "Flat rate on money taken from pre-tax accounts", type: "percent", min: 0, max: 60, help: "used by the flat setting only" },
    { key: "strategy", label: "How much to take out each year", type: "select", options: Object.entries(STRATEGIES).map(([value, label]) => ({ value, label })) },
    { key: "withdrawalRate", label: "Starting withdrawal rate", type: "percent", min: 1, max: 15, help: "for the percentage and guardrail methods; 4 is the classic figure" },
  ];
  const values = { spendingMonthly: spendNow, stocksNow: rt.stocksNow ?? 0.7, stocksRetired: rt.stocksRetired ?? 0.5, taxMode: rt.taxMode ?? "flat", taxRate: rt.taxRate ?? 0.15, strategy: rt.strategy ?? "fixed-real", withdrawalRate: rt.withdrawalRate ?? 0.04 };
  const form = ui.form(FIELDS, values, (v) => {
    pending = "Retirement settings saved.";
    store.update((p) => {
      // a figure typed here, other than the one shown, is the household's own: no longer Get started's (retireAuto), taken as typed
      saveSpendingFigure(p, v.spendingMonthly ?? null, spendNow);
      p.retirement = { ...(p.retirement ?? {}), stocksNow: v.stocksNow ?? 0.7, stocksRetired: v.stocksRetired ?? 0.5, taxMode: v.taxMode === "brackets" ? "brackets" : "flat", taxRate: v.taxRate ?? 0.15, strategy: v.strategy, withdrawalRate: v.withdrawalRate ?? 0.04 };
    });
  }, { submitLabel: "Save settings" });
  const details = ui.h("details", { class: "card fold fold-card", open: d.ready ? null : true },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Retirement settings"), ui.h("span", { class: "fold-status" }, spendNow ? `${fmt.money(spendNow, plan.meta.currency)} a month` : "spending = today's expenses"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" }, ui.h("p", { class: "muted small" }, "Shared by every retirement page. Ages and how long the plan runs come from the People page; growth and inflation from Assumptions."), out, form));
  return details;
}

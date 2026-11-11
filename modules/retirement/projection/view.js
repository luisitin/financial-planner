// modules/retirement/projection/view.js -- DOM only. The verdict, the money over time, what the
// plan assumes, and the settings that every retirement page shares (folded, saved with a green line).
import { compute, savingsUnknown, healthAdded, healthSummary, incomeWords, onJobWords, spouseWords, saveSpendingFigure } from "./compute.js";
import { STRATEGIES } from "../../../core/math/retirement.js";
import { lineChart } from "../charts.js";
import { ssNotice } from "../ss-notice.js";
import { afterPaint, whenCareful, carefulKey, knownAnswer, slot as barOf, monthlyOf, CAREFUL_CHANCE, busyWords, leftWords, leftWhy, chanceWords, BAD_RUN, BAD_RUN_NOTE } from "../careful.js";
import { isYou, nameIn, NameIn, nameOf, verbFor } from "../../../core/words.js";
// the ways How much to take out offers (round 8 review UX 7: this list set the ways that page holds back, with no reason given),
// by the names that page gives them (batch 5b UX review 8)
import { wayOptions, wayOptionsFor, DESCRIPTIONS } from "../withdrawal-strategy/compute.js";

/** "a, b and c" */
const listOf = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

let pending = null;
let healthPending = null;   // the health toggle's confirmation, shown on the next render (the shell re-renders after store.update)

// "taxable, then pre-tax, then Roth" read as jargon in a list a person scrolls (money review UX 6): the same order in plain words
const orderWords = (label) => String(label).replace(/Taxable/g, "regular savings").replace(/\btaxable\b/g, "regular savings").replace(/Pre-tax/g, "retirement accounts you pay tax on later").replace(/\bpre-tax\b/g, "retirement accounts you pay tax on later").replace(/Roth/g, "Roth accounts (tax already paid)").replace(/^./, (c) => c.toLowerCase());
/**
 * The "Retirement money today" row without the empty parts: "$3,700, all of it cash" (never "$3,700: $3,700 cash, $0 taxable, ..."),
 * "none yet", and, when nothing is saved for retirement and only cash is counted, said so ("No retirement savings on file").
 */
export function moneyToday(b, noSavings, money) {
  const parts = [[b.cash, "in cash"], [b.taxable, "in regular savings"], [b.deferred, "in retirement accounts you pay tax on later"], [b.free, "you already paid tax on"]].filter(([v]) => v > 0.5);
  const total = b.cash + b.taxable + b.deferred + b.free;
  if (!parts.length) return "none on file yet";
  if (noSavings && parts.length === 1 && b.cash > 0.5) return `no retirement savings on file; ${money(b.cash)} in cash is counted`;
  if (parts.length === 1) return `${money(total)}, all of it ${parts[0][1]}`;
  return `${money(total)}: ${parts.map(([v, w]) => `${money(v)} ${w}`).join(", ")}`;
}

export function render(root, ctx) {
  const { ui, fmt, store, plan } = ctx;
  const cur = plan.meta.currency;
  const d = compute(plan, { today: fmt.today(), showHealth: true });   // showHealth: with the box ticked, still say what cover would cost
  // no Social Security in the plan: say so first (ss-notice.js); not while the page still needs its basics, where its filled button
  // stood above the one thing to do first (stress test 2026-11-11, x-5: four filled buttons on the first screen)
  if (d.ready) { const ss = ssNotice(ctx); if (ss) root.append(ss); }
  const rt = plan.retirement ?? {};
  root.append(ui.h("style", {}, ".pj-link { display: inline; padding: 14px 0; margin: -14px 0; }"));
  const money = (n) => fmt.money(n, cur);

  if (!d.ready) {
    // one button for each thing still missing, the first one filled; what is done has none (stress test 2026-11-11, x-3: "People"
    // stayed the filled button after People was done, while the one thing missing was a box further down)
    const settings = settingsCard(ctx, d);
    const typeSpending = () => typeInto(settings);
    const steps = d.missing.map((m) => {
      const t = String(m);
      if (/People page/.test(t)) return { words: t.replace("a person with a birth date on the People page", "who is in the household, with birth dates (People page)"), act: ui.h("a", { href: "#/household/people" }, /^a person/.test(t) ? "Add people ›" : "Check People ›") };
      if (/Net worth page/.test(t)) return { words: "what you own: your savings and retirement accounts", act: ui.h("a", { href: "#/balance/net-worth" }, "Add what you own ›") };
      if (/spend in retirement/.test(t)) return { words: "what you will spend in retirement: type it under Retirement settings below, or list today's bills on the Expenses page", act: ui.h("button", { type: "button", onClick: typeSpending }, "Type what you'll spend ↓") };
      return { words: t, act: null };
    });
    const acts = steps.map((x) => x.act).filter(Boolean);
    acts.forEach((a, i) => { a.className = i ? "btn secondary" : "btn"; });
    if (steps.some((x) => /spend in retirement/.test(x.words))) acts.push(ui.h("a", { class: "btn secondary", href: "#/cashflow/expenses" }, "Expenses ›"));
    root.append(ui.h("section", { class: "card accent hero" },
      ui.h("h1", {}, "Will the money last?"),
      ui.h("p", { class: "lede" }, `This page runs your plan year by year to the end: what you have, what you add, what Social Security and pensions bring in, what you spend, and what is left each year. It needs ${steps.length === 1 ? "this" : "these"} first:`),
      ui.h("ul", {}, steps.map((x) => ui.h("li", {}, x.words))),
      ui.row(...acts),
    ));
    root.append(settings);
    openAsked(ctx, settings);
    return;
  }
  // "(Contributions page)" and the like are links to that page, not plain text to go and find
  const PAGES = { "What you save for retirement": "#/retirement/contributions", "Social Security page": "#/retirement/social-security", "Assumptions": "#/system/assumptions", "Taxes pages": "#/taxes/federal" };
  // (the links are 44 px tall: inline links on a phone are hard to hit)
  const linked = (text) => String(text).split(/\((What you save for retirement|Social Security page|Assumptions|Taxes pages)\)/).map((part, i) => i % 2 ? (/page/.test(part) ? ["(", ui.h("a", { href: PAGES[part], class: "pj-link" }, part), ")"] : ["(on the ", ui.h("a", { href: PAGES[part], class: "pj-link" }, part), " page)"]) : part);
  // the line below is markets doing exactly as well as average every year; the careful figure (even in a bad run of years, from the
  // Monte Carlo page's engine) fills in under it once worked out (round 5, 2026-11-02: the average figure lasts in only
  // about 4 of 10 markets, and every page called it the most you could spend)
  // health cover (marketplace to 65, then Medicare) is added on top of the spending figure unless it already includes it (2026-11-02)
  const healthOn = healthAdded(d.health);
  const onTop = healthOn ? " on top of health insurance" : "";
  // what the plan spends in its first retirement year: with a way that sets its own withdrawal that is the way's figure, not the
  // one in the settings, and "Paid by income" below is against it (round 8, Batch 5b: "you plan on $36,000" sat beside "Paid by
  // income 299%" of the $16,880 the way then planned)
  const r0 = d.rows.find((r) => r.year === d.atRetirement?.year) ?? null;
  // a way that moves with markets is said as itself (batch 5b UX review 5: "The money lasts", "On track" and "you plan on $72,380"
  // beside "$0 left" and more than the plan can carry): what it spends a month the first year, how low it goes, and a way that
  // spends savings down says so
  const moving = d.strategy !== "fixed-real" && !!r0;
  const retiredRows = d.rows.filter((r) => r.retired);
  const lowest = retiredRows.length ? Math.min(...retiredRows.map((r) => r.spendingReal)) : 0;
  const thisYear = Number(String(fmt.today()).slice(0, 4));
  const movingText = moving ? `About ${money(r0.spendingReal / 12)} a month ${r0.year === thisYear ? "this year" : `in ${r0.year}`}, about ${money(lowest / 12)} at the lowest if markets do as well as average.` : null;
  const spentDown = moving && d.strategy === "vpw" && d.result.success && d.atEnd.totalReal < 1 ? `Savings are spent down to $0 by ${d.atEnd.year} on purpose.` : null;
  const planOn = `you plan to spend ${money(d.spendingYearly)}`;
  const verdictText = moving && d.verdict !== "short" ? movingText : { "on track": `If markets do as well as average, it can pay for ${money(d.affordable)} a year${onTop}; ${planOn}.`, tight: `If markets do as well as average, it can pay for about ${money(d.affordable)} a year${onTop}; ${planOn}.`, short: `Short. If markets do as well as average, ${moving ? `this way runs out` : `${money(d.spendingYearly)} a year${onTop} runs out`} in ${d.shortYear} (age ${d.shortAge}), ${d.affordable >= 1 ? `and the most the plan can pay for is about ${money(d.affordable)} a year` : "and even spending nothing it would not last to the end"}.` }[d.verdict];
  // the careful line, drawn first with grey bars where its figures go (the same words, so the same height: nothing jumps when
  // they arrive), then filled in after the first paint (careful.js: on the PC, or here a slice at a time)
  const steady = d.strategy === "fixed-real";
  // under 9 in 10 at the planned spending: said here, in amber, next to the figure (one verdict word on every page: the headline
  // above stays the average-market verdict that the Dashboard, Quick answers, Timeline and Goal seek also show; review 2026-11-05)
  const fewer = (share) => (share !== null && share < CAREFUL_CHANCE ? ui.h("span", { class: "pill warn" }, "short in a bad run") : null);
  // the chance in the words How much to take out uses (UX review 7); the page it comes from is a button below, not a link (UX 17)
  // two short paragraphs, not one of five lines on a phone: what lasts even in a bad run of years, then how often the plan's own
  // figure does (path part 3: "Even in a bad run of years (only 1 in 10 is worse)" on this first screen; odds.js says it everywhere)
  const careWords = (y, mo) => steady
    ? [`Even in a bad run of years ${BAD_RUN_NOTE}, the money can pay for about `, y, " a year ", ui.h("span", { style: { whiteSpace: "nowrap" } }, "(", mo), ` a month)${onTop}.`]
    : ["Spent the same every year instead, about ", mo, ` a month${onTop} would last ${BAD_RUN} ${BAD_RUN_NOTE}.`];
  // the amber pill follows the full stop with a space ("lasts 7 in 10. short in a bad run"), never ".short in a bad run"
  const shareWords = (share, shareN = null) => { const f = fewer(shareN); return [`At the ${money(d.spendingYearly)} you plan, it lasts `, share, ".", f ? " " : null, f]; };
  // a soft grey bar as wide as the figure that will take its place (the average figure's own length), so the lines break the same
  // (careful.js's own bar, never wider than its line: stress test 2026-11-11, x-3 and A9)
  const slot = (like) => barOf(ui, like);
  // nothing lasts to the end even at $0 (affordable 0): no careful search, no placeholder; the average figure, named as such
  const noCare = !(d.affordable >= 1);
  const careLine = noCare ? null : ui.h("p", { "aria-live": "polite", "aria-busy": "true", style: { color: "var(--muted)" } }, busyWords(ui, "Working out the spending that lasts even in a bad run of years. "), ...careWords(slot(money(d.affordable)), slot(money(d.affordable / 12))));
  const careLine2 = noCare || !steady ? null : ui.h("p", { style: { color: "var(--muted)" } }, ...shareWords(slot("in most pretend futures (93 of 100)")));
  const careSub = `a year${onTop}, today's dollars; ${money(d.affordable)} if markets do as well as average`;
  const careStat = ui.h("div", { style: { display: "contents" } }, noCare ? ui.stat("Spending it can pay for", money(d.affordable), `a year${onTop}, today's dollars, if markets do as well as average`) : ui.stat("Spending that lasts, even in a bad run of years", "...", careSub));
  // nothing saved for retirement is on file and the income alone does not carry the spending: the page cannot say the money
  // runs out, only that it does not know yet (review UX 3: a 26-year-old who never mentioned savings read "Runs out in 2065")
  const unknownYet = savingsUnknown(d);
  const averageHead = unknownYet ? "We don't know yet" : d.verdict === "short" ? `Runs out in ${d.shortYear}` : moving ? "Your spending moves with markets" : d.verdict === "on track" ? "The money lasts" : "It lasts, just";
  // the headline the bad-run answer can still change (steady spending that lasts if markets are average): under 6 in 10 it says
  // so in the same words (UX review 7: "It lasts, just" over 47%); between 6 and 9 in 10 "The money lasts" over a line saying it
  // fails in a third of them contradicted itself (money review UX 1): "just" is for 9 in 10 or more
  const canTurn = !noCare && !unknownYet && steady && d.verdict !== "short";
  const finalHead = (c) => (!canTurn || !c || !(c.yearly > 0) || !Number.isFinite(c.planned) ? averageHead
    : c.planned < 0.6 ? `Lasts ${chanceWords(c.planned, { exact: false })}` : c.planned < 0.9 ? "It lasts in most cases, not all" : averageHead);
  // a verdict is never shown before it is known (stress test 2026-11-11, HC-2, R-A1, W5): "The money lasts" stood for one to three
  // seconds and then turned into "It lasts in most cases, not all". Until the bad-run answer is in, the headline says it is being
  // checked, two lines tall (the longest verdict's height); an answer already worked out for this plan is used at once
  const known = canTurn ? knownAnswer(carefulKey(ctx)) : null;
  const waiting = canTurn && known === undefined;
  const headline = waiting
    ? ui.h("h1", { "aria-busy": "true", style: { minHeight: "2.5em", color: "var(--muted)" } }, "Checking your plan against bad years...")
    : ui.h("h1", {}, canTurn ? finalHead(known) : averageHead);
  if (!noCare) whenCareful(ctx, careLine, (c) => {
    if (waiting) { headline.textContent = finalHead(c); headline.removeAttribute("aria-busy"); headline.style.color = ""; }   // the two lines stay held: a one-line verdict must not pull the page up 32 px (review of this change)
    // nothing worked out, or nothing lasts even in a bad run of years, even at $0: no careful line, the average figure named as such
    if (!c || !(c.yearly > 0)) { careLine.remove(); careLine2?.remove(); careStat.replaceChildren(ui.stat("Spending it can pay for", money(d.affordable), `a year${onTop}, today's dollars, if markets do as well as average`)); return; }
    careLine.style.minHeight = `${careLine.offsetHeight}px`;   // never shorter than the placeholder it replaces
    careLine.style.color = "";
    careLine.removeAttribute("aria-busy");
    // the share rounded down, so a figure just under 9 in 10 never reads "90%" (review 2026-11-05), in the shared words (UX review 7)
    careLine.replaceChildren(...careWords(money(c.yearly), money(monthlyOf(c.yearly))));
    if (careLine2) { careLine2.style.color = ""; careLine2.replaceChildren(...shareWords(chanceWords(c.planned), c.planned).filter((x) => x !== null)); }   // replaceChildren writes a null as the text "null"
    careStat.replaceChildren(ui.stat("Spending that lasts, even in a bad run of years", money(c.yearly), careSub));
  });
  // who starts retirement (fifth pass): the first adult, or the last working adult when Get started says the first does not work,
  // or nobody ("nobody in the plan works now")
  // the projection's own note about the spending figure, said where it can be changed (UX review 18: "on this page")
  const noteWords = (n) => n.replace("Social Security already paid, from the Income page:", "Social Security you already get (from the Income page):").replace("The plan assumes you will spend in retirement what you spend today; set your own figure on this page if it will differ.", "Retirement spending is set to what you spend today; change it under Retirement settings below.");
  const rb = d.retireBy ?? { name: d.people[0].name, age: d.atRetirement.age, first: true };
  // the first adult has stopped while a partner with pay works on (seventh pass): retirement starts now, the pay counted as income
  // "you" and "your" for the first adult Get started left unnamed ("you at 65", "your spouse's pay"; round 7)
  const paidOn = rb.stopped && rb.working?.length ? `${nameIn(rb.name)} ${rb.notWorking ? `${verbFor(rb.name, "is", "are")} not working` : `${verbFor(rb.name, "has", "have")} stopped work`}; ${listOf(rb.working.map((w) => `${nameOf(w.name)} pay comes in until ${w.untilYear}`))}` : null;
  // the person who starts it is past their retirement age already: it has begun, it does not "start in" this year
  const starter = d.people.find((p) => p.id === rb.id), alreadyRetired = !!starter && !rb.nobody && !rb.stopped && thisYear - starter.birthYear > starter.retireAge;
  const startWho = paidOn ?? (rb.nobody ? "nobody in the plan works now" : rb.first ? `${nameIn(rb.name)} at ${rb.age}` : `when ${nameIn(rb.name)} ${verbFor(rb.name, "stops", "stop")} work at ${rb.age}`);
  root.append(ui.h("section", { class: "card accent hero" },
    headline,
    // no retirement savings on file (stress test 2026-11-11, F4): what to do, as the one filled button below; no chart of a line
    // falling to $0 under "we don't know"
    unknownYet ? ui.h("p", { class: "lede" }, "You haven't told us about retirement savings, so we can't say whether the money will last. Add what you own to see. If you have no retirement savings yet, that is common; you can go on and come back.") : ui.h("p", { class: "lede" }, verdictText),
    spentDown && d.verdict !== "short" && !unknownYet ? ui.h("p", {}, spentDown) : null,
    unknownYet ? null : careLine,
    unknownYet ? null : careLine2,
    // income not counted after work stops (support and other with no end date; dividends), and how to keep it (recheck 2026-11-05)
    // in the normal text colour (grey on the hero's tint was under 4.5:1), short (UX review 17, 18)
    // where the age is set, one tap away (stress test 2026-11-11, A6: "Can I retire at 62?" had no way to the age)
    ui.h("p", { class: "small" }, `${alreadyRetired ? "Retirement has already begun" : `Retirement starts in ${d.atRetirement.year}`} (${startWho}); the plan runs to ${d.atEnd.year}. `, ui.h("a", { href: "#/household/people", class: "pj-link" }, alreadyRetired ? "Ages ›" : "Change the age ›")),
    d.notes.length || d.otherLeft?.length ? ui.h("p", { class: "small" }, ...linked(d.notes.map(noteWords).join(" ")), ...(d.otherLeft?.length ? [d.notes.length ? " " : "", ...leftWords(ui, money, d.otherLeft)] : [])) : null,
    // what would change the answer is on Goal seek (the most you could spend, the earliest age, what more to save): one tap away;
    // the page the chance comes from, or the one that compares the ways, as a button beside it (no links inside sentences); with
    // nothing saved on file there is no chance to show (path part 3: the careful line is not shown then either)
    ui.row(unknownYet ? ui.h("a", { class: "btn", href: "#/balance/net-worth" }, "Add what you own ›") : ui.h("a", { class: "btn secondary", href: "#/scenarios/goal-seek" }, alreadyRetired ? "What would change it ›" : "Could you stop sooner? What would change it ›"),
      noCare || unknownYet ? null : steady ? ui.h("a", { class: "btn secondary", href: "#/retirement/monte-carlo" }, "Chance the money lasts ›") : ui.h("a", { class: "btn secondary", href: "#/retirement/withdrawal-strategy" }, "How much to take out ›")),
  ));
  // (with nothing saved on file the four figures would all read $0 or 0%: left out until there is something to measure)
  if (!unknownYet) root.append(ui.card(null, ui.row(
    ui.stat("At retirement", money(d.atRetirement.totalReal), `${d.atRetirement.year}, in today's dollars`),
    careStat,
    // all the income that comes in that year, named by what it is (recheck 2026-11-05: "Guaranteed income ... Social Security,
    // pensions, a partner's pay" read 203% for a couple whose rent and dividends were in it), against that year's spending and
    // health cover (the health line is spending too)
    ui.stat("Paid by income", d.coverage !== null ? fmt.pct(d.coverage, 0) : "-", `of the first retirement year's spending${healthOn ? " and health insurance" : ""}${d.coverageFrom?.length ? `, from ${listOf(d.coverageFrom)}` : ": nothing comes in that year but savings"}`),
    ui.stat(`Left in ${d.atEnd.year}`, money(Math.max(0, d.atEnd.totalReal)), d.atEnd.totalReal > 0 ? "today's dollars" : "nothing"),
  )));
  const years = d.rows.map((r) => r.year);
  if (!unknownYet) root.append(ui.card("Money over the years, in today's dollars",
    lineChart({ years, series: [{ values: d.rows.map((r) => r.totalReal) }], marks: [{ year: d.atRetirement.year, label: "retire" }], label: "balance over the years" }),
    // (R-A8: a page title in the middle of a sentence read as a question)
    ui.h("p", { class: "muted small" }, "One line, at expected returns. Two more pages, Chance the money lasts and If history repeated, show the range around it."),
  ));
  // a rental's loan payment the spending holds (round 8 batch 6 review, UX 7): said with the spending, so the line that gives
  // it back after the loan is paid off does not read as income
  const back = d.inputs.incomes.filter((x) => x.part === "loan back");
  const heldLoans = back.length ? `, which holds ${back.map((x) => `${x.rental}'s ${money(x.monthly)} a month loan payment${x.loanEnds && !x.sold ? ` until ${String(x.loanEnds).slice(0, 4)}` : ""}`).join(" and ")}` : "";
  const intoList = ui.h("ul", { class: "records" }, [
      // the first adult who has stopped while a partner's pay comes in (seventh pass): their age on file is not when it starts
      // "You: retire at 65, plan to 95; your spouse: retires at 62, ..." (the first adult unnamed; round 7)
      ["People", d.people.map((p, i) => (rb.stopped && rb.id === p.id ? `${(i ? nameIn : NameIn)(p.name)}: ${rb.notWorking ? "not working now" : "stopped work"} (${p.retireAge} on file), plan to ${p.endAge}` : (thisYear - p.birthYear >= p.retireAge || plan.guide?.setup?.status?.[p.id] === "retired") ? `${(i ? nameIn : NameIn)(p.name)}: already retired (${thisYear - p.birthYear}), plan to ${p.endAge}` : `${(i ? nameIn : NameIn)(p.name)}: ${verbFor(p.name, "retires", "retire")} at ${p.retireAge}, plan to ${p.endAge}`)).join("; ")],
      ["Retirement money today", moneyToday(d.inputs.balances, unknownYet, money)],
      ["Added each year until retirement", d.inputs.contributions.length ? `${money(d.inputs.contributions.reduce((s, c) => s + c.yearly, 0))}, rising with pay (What you save for retirement)` : "nothing entered (What you save for retirement)"],
      // each line by its own name, with its ages or years (incomeWords: rent says "from 2033", never its owner's age)
      // the lines named for the unnamed first adult say "your Social Security": a capital only at the start of the record
      ["Income counted", d.inputs.incomes.length ? incomeWords(d.inputs, money).join("; ").replace(/^your /, "Your ") : "none entered (Social Security page)"],
      ...(d.otherLeft?.length ? [["Not counted", d.otherLeft.map((x) => `${x.name}: ${money(x.yearly)} a year, ${leftWhy(x)}`).join("; ")]] : []),
      ["Spending in retirement", `${money(d.spendingYearly)} a year in today's dollars${d.spendingSource === "expenses" || d.health?.fromSetup ? ` (${d.health?.fromSetup ? "the figure from Set up my plan" : "today's expenses"}${d.health?.removedMonthly > 0 ? `, less ${money(d.health.removedMonthly)} a month of health insurance` : ""}${heldLoans})` : ""}${healthOn ? ", on top of health insurance" : d.health?.included ? ", health insurance included" : ""}`],
      ["Growth and rising prices", `stocks ${fmt.pct(d.inputs.returns.stocks, 1)} a year, bonds ${fmt.pct(d.inputs.returns.bonds, 1)}, prices rising ${fmt.pct(d.inputs.rates.inflation, 1)} a year (Assumptions); ${Math.round(d.inputs.rates.stocksNow * 100)}% in stocks now, ${Math.round(d.inputs.rates.stocksRetired * 100)}% in retirement`],
      ["Taxes", d.inputs.tax?.mode === "brackets" ? `the federal brackets on each year's income, filing ${d.inputs.tax.filingStatus.replace(/_/g, " ").replace("married joint", "jointly").replace("married separate", "separately")} (Taxes pages); withdrawals ${orderWords(d.orderLabel)}${d.inputs.rothConversion ? `; Roth conversions fill the ${fmt.pct(d.inputs.rothConversion.fillRate, 0)} bracket before required withdrawals` : ""}; required withdrawals start at ${d.inputs.rmd.startAge}` : `${fmt.pct(d.inputs.rates.taxRate, 0)} on money taken from retirement accounts you pay tax on later; withdrawals ${orderWords(d.orderLabel)}; required withdrawals start at ${d.inputs.rmd.startAge}`],
    ].flatMap(([k, v]) => [ui.h("li", {}, ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, k)), ui.h("div", { class: "rec-sub" }, linked(v))),
      // health cover right under the spending it goes on top of (by its name: the "Not counted" row comes and goes above it)
      ...(k === "Spending in retirement" ? [healthRecord(ctx, d)] : [])]).filter(Boolean));
  // with no retirement savings on file the list is folded (F4: nine blocks of Medigap and tax rates under "we don't know yet")
  root.append(unknownYet
    ? ui.h("details", { class: "card fold fold-card" }, ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "What goes into this"), ui.h("span", { class: "fold-chev" }, "›")), ui.h("div", { class: "fold-body" }, intoList))
    : ui.card("What goes into this", intoList));
  const settings = settingsCard(ctx, d);
  root.append(settings);
  openAsked(ctx, settings);
}

/** Retirement settings opened at the spending box, scrolled to and focused (the not-ready hero's "Type what you'll spend ↓"). */
function typeInto(settings) {
  settings.open = true;
  const box = settings.querySelector("input[name=spendingMonthly]") ?? settings.querySelector("input");
  settings.scrollIntoView({ behavior: "smooth", block: "start" });
  box?.focus({ preventScroll: true });
}

// ?type=spending (another retirement page's "Type what you'll spend ›", needs.js): the settings open at the box once per visit,
// not again on each redraw after a save (stress test 2026-11-11, RB2: those pages sent a newcomer here to read the list again)
let typedFor = null;
function openAsked(ctx, settings) {
  if (ctx.route?.query?.type !== "spending" || typedFor === ctx.route) return;
  typedFor = ctx.route;
  afterPaint(() => { if (settings.isConnected) typeInto(settings); });
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
      ? `Your expenses list "${h.paidBy.line}": with ${list(h.paidBy.names.map(nameIn))} 65 or over and retired, that counts as ${h.paidBy.names.length > 1 ? (h.paidBy.names.some(isYou) ? "your" : "their") : nameOf(h.paidBy.names[0])} Medicare and any supplement, so it stays in your spending and Medicare is not added again.`
      : `Medicare for ${list(h.paidBy.names.map(nameIn))} is already in your spending (your expenses list "${h.paidBy.line}"), so it is not added again.`);
    if (h.otherLine) words.push(`Your expenses list "${h.otherLine}": nobody here is 65 yet, so it stays in your spending as it is, and your own Medicare is added from 65.`);
    // the Medicare years left to a job's plan, a sentence for each worker's run of years (onJobWords; verify 2026-11-06)
    if (h.onJob) words.push(...onJobWords(h.onJob, list));
    // a husband's or wife's Medicare counted while the other still works, and how to leave it out (spouseWords; seventh pass)
    if (h.spouseOnJob) words.push(...spouseWords(h.spouseOnJob, list));
    if (h.coverLines?.length) words.push(`${list(h.coverLines.map((x) => `"${x.name}"`))} on Expenses ${h.coverLines.length === 1 ? "is" : "are"} left out of retirement spending: coverage from retirement on is worked out here instead.`);
    if (h.jobPlan) words.push(`While ${nameIn(h.jobPlan.worker)} still ${verbFor(h.jobPlan.worker, "works", "work")} (${span(h.jobPlan.fromYear, h.jobPlan.untilYear, h.jobPlan.years)}), the ${around(h.jobPlan.monthly)} a month stays in, for the plan at work: about ${around(h.jobPlan.total)}${b || m ? " more" : ""} over ${h.jobPlan.years === 1 ? "that year" : "those years"}.`);
    if (!words.length) return null;
  }
  const out = ui.h("div");
  if (healthPending) { const n = ui.notice("ok", healthPending); out.append(n); setTimeout(() => n.remove(), 4000); healthPending = null; }
  const box = ui.h("input", { type: "checkbox", checked: h.included ? true : null, onChange: (e) => {
    const on = e.target.checked;
    healthPending = on ? "Saved: your spending figure counts as including health insurance, so none is added." : "Saved: health insurance is added on top of your spending.";
    store.update((p) => { p.retirement = p.retirement ?? {}; if (on) p.retirement.healthIncluded = true; else delete p.retirement.healthIncluded; });
  } });
  // the cliff: which years are over it, by how little, what it costs and that the cost is already in the figure above
  const cliff = !h.included && h.bridge?.cliff ? h.bridge.cliff : null;
  const cliffYears = cliff ? yearsOf(cliff.yearsList) : "";
  return ui.h("li", {}, out,
    ui.h("div", { class: "rec-head" }, ui.h("span", { class: "rec-title" }, "Health insurance")),
    ui.h("div", { class: "rec-sub" }, words[0]),
    // what is left out or kept, and why (a Medicare line, years on a job's plan, a premium), under the figure itself
    words.length > 1 ? ui.h("div", { class: "rec-sub", style: { marginTop: "6px" } }, words.slice(1).join(" ")) : null,
    cliff ? ui.h("div", { class: "rec-sub", style: { marginTop: "6px" } }, `In ${cliffYears} the plan's income is over ${fmt.money(Math.round(cliff.income), plan.meta.currency)} (by ${cliff.years > 1 ? "as little as" : "about"} ${around(cliff.overBy)}), so ${cliff.years > 1 ? "those years get" : "that year gets"} no marketplace credit: about ${around(cliff.lostTotal)}, already in the cost above. Taking ${cliff.years > 1 ? "those years'" : "that year's"} money from Roth or cash could keep the credit (Healthcare before 65 shows how).`) : null,
    ui.row(ui.h("a", { class: "btn secondary", href: "#/retirement/healthcare" }, "Healthcare before 65 ›"), ui.h("a", { class: "btn secondary", href: "#/retirement/medicare" }, "Medicare ›")),
    ui.h("label", { style: { display: "flex", gap: "10px", alignItems: "center", minHeight: "44px", marginTop: "4px", fontSize: "var(--fs-sm)" } }, box, ui.h("span", {}, "My spending figure already includes health insurance")));
}

// a slip of extra digits is refused at the box, in the box's own words (stress test 2026-11-11, R-A10: $99,999,999,999 a month
// was saved and the page said "Runs out in 2055"); far above any household this plan is for
export const SPEND_MONTHLY_CEILING = 100000;
function settingsCard(ctx, d) {
  const { ui, fmt, store, plan } = ctx;
  const rt = plan.retirement ?? {};
  const out = ui.h("div");
  const justSaved = !!pending;
  if (pending) { const n = ui.notice("ok", pending); out.append(n); setTimeout(() => n.remove(), 4000); pending = null; }
  // the box shows what the plan counts before health cover (figureMonthly; fourth pass, 2026-11-02): a typed figure as it is,
  // or Get started's own less the health insurance among today's bills that the health line replaces
  const spendNow = d.figureMonthly ?? (Number(rt.spendingMonthly) > 0 ? Number(rt.spendingMonthly) : null);
  const less = d.health?.fromSetup && d.health.removedMonthly > 0 ? `: Get started's figure from today's bills, less ${fmt.money(Math.round(d.health.removedMonthly), plan.meta.currency)} a month of health insurance` : "";
  // each way judged on its own run (review D2), as How much to take out does
  const ways = d.ready ? wayOptions(plan, { today: fmt.today() }, { inputs: d.inputs }) : wayOptionsFor(null, rt.strategy ?? "fixed-real");
  const waysLeft = Object.keys(STRATEGIES).length - ways.length;
  const FIELDS = [
    // the help follows the box under Health cover: before cover (the plan adds it), or cover included (you said so)
    { key: "spendingMonthly", label: "Spending in retirement, a month", type: "money", min: 0, max: SPEND_MONTHLY_CEILING, help: rt.healthIncluded === true ? "today's dollars, health insurance included (you said so under Health insurance); leave blank to use today's expenses" : `today's dollars, before health insurance (the plan adds it)${less}; leave blank to use today's expenses` },
    { key: "stocksNow", label: "Share in stocks now", type: "percent", min: 0, max: 100, help: "the rest counts as bonds" },
    { key: "stocksRetired", label: "Share in stocks once retired", type: "percent", min: 0, max: 100 },
    { key: "taxMode", label: "How tax is worked out", type: "select", options: [{ value: "flat", label: "A flat rate on pre-tax withdrawals (quick)" }, { value: "brackets", label: "The federal brackets on each year's income" }], help: "the brackets use the filing status from the People page and the rules on the Taxes pages" },
    { key: "taxRate", label: "Flat rate on money taken from pre-tax accounts", type: "percent", min: 0, max: 60, help: "used by the flat setting only" },
    { key: "strategy", label: "How much to take out each year", type: "select", options: ways, help: waysLeft ? `${waysLeft === 1 ? "One way is" : `${waysLeft} ways are`} left out: on your plan ${waysLeft === 1 ? "it" : "they"} would leave some of your income unspent (How much to take out says when)` : "How much to take out compares them on your plan" },
    { key: "withdrawalRate", label: "Starting withdrawal rate", type: "percent", min: 1, max: 15, help: `the share of savings "${DESCRIPTIONS.percent.name}" and "${DESCRIPTIONS.guardrails.name}" start from; 4 is the classic figure` },
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
  // folded like every technical section, also on a first open (stress test 2026-11-11, R-A5, x-5: seven boxes in finance words opened
  // under "add these first"); the hero's "Type what you'll spend" opens it at the box when that is what is missing
  const noFigure = !spendNow && (d.spendingSource === "none" || (d.missing ?? []).some((m) => /spend in retirement/.test(String(m))));
  // open after its own Save, so its green line is seen (a review of the stress-test fixes: saved from the hero's "Type what you'll
  // spend", the note sat inside the shut section); the shell keeping the place after a save is wave 1's
  const details = ui.h("details", { class: "card fold fold-card", open: justSaved ? true : null },
    ui.h("summary", {}, ui.h("span", { class: "fold-title" }, "Retirement settings"), ui.h("span", { class: "fold-status" }, spendNow ? `${fmt.money(spendNow, plan.meta.currency)} a month` : noFigure ? "spending not set yet" : "spending = today's expenses"), ui.h("span", { class: "fold-chev" }, "›")),
    ui.h("div", { class: "fold-body" }, ui.h("p", { class: "muted small" }, "Shared by every retirement page. Ages and how long the plan runs come from the People page; growth and inflation from Assumptions."), out, form));
  return details;
}

// modules/overview/quick/compute.js -- PURE. The questions Quick answers lists, each opening a page that gives an
// answer on an empty plan, and the rule for listing one (README "What is listed").
//   key      "group/id" of a usable page
//   icon     one emoji for the row (the pages' own icons repeat: three goals pages share 🎯)
//   title    the question, in the reader's words, ending in "?"
//   line     one sentence: what the answer holds
//   hint     optional: what the bar on that page says after the question (default "Type your own numbers below.")

import { compute as projection, retirementKnown, healthAdded, savingsUnknown } from "../../retirement/projection/compute.js";
import { compute as payoff } from "../../debt/payoff/compute.js";
import { taxAnswer } from "../../taxes/withholding/compute.js";
import { compute as estimatedOf } from "../../taxes/estimated/compute.js";
import { money as fmtMoney } from "../../../core/format.js";
import { compute as lifeNeeds, protectionGaps } from "../../insurance/life-needs/compute.js";
import { compute as benchmarks } from "../benchmarks/compute.js";
import { RETURNS } from "../../retirement/historical/data/returns.js";

/** Answer on an empty plan, and save only calculator inputs (whatIfs, insurance quotes) or a goal by its own button. */
export const MOST_ASKED = [
  { key: "goals/house", icon: "🏠", title: "How much home can I afford?", line: "The monthly cost, the cash you need at closing, and when you will have it." },
  { key: "property/rent-vs-buy", icon: "🔑", title: "Should I rent or buy?", line: "Who comes out ahead after the years you stay, and the rent at which they come out even." },
  { key: "goals/vehicle", icon: "🚗", title: "Pay cash for a car or borrow?", line: "What to save a month to pay cash, or the loan for the rest." },
  { key: "property/purchase", icon: "🛋️", title: "Save up or pay over time?", line: "A sofa, a laptop, a ring: what saving, a payment plan or paying now each costs." },
  { key: "insurance/health", icon: "🩺", title: "Which health plan costs least?", line: "Premiums plus your share of the bills, in a quiet, a usual and a bad year." },
  { key: "goals/charitable", icon: "🎁", title: "What does my giving save in tax?", line: "What a gift really costs, and how to give the same for less." },
  { key: "investments/backtest", icon: "📈", title: "How has a mix of stocks and bonds done?", line: "Any mix run through the years since 1871: growth, worst years, deepest fall.", hint: "Pick two mixes below." },
  { key: "property/renovation", icon: "🔨", title: "Is this home project worth it?", line: "What it adds to the home's value and the cheapest way to pay for it." },
];
export const MORE = [
  { key: "career/offer-compare", icon: "💼", title: "Which job offer pays more?", line: "Pay, bonus, stock, benefits and the commute side by side, after tax." },
  { key: "investments/risk", icon: "🎢", title: "How much could my savings drop in a bad year?", line: "The worst year and the deepest fall since 1871 for your target mix of stocks and bonds, and for the usual mixes.", hint: "The answer is below; nothing to type." },
  { key: "insurance/term-vs-permanent", icon: "🛡️", title: "Whole life or term life insurance?", line: "Whole life against cheaper term insurance plus investing the difference, using the prices you were quoted." },
];
/** Questions whose answer needs your own numbers first: they open the step-by-step guide that gathers them. */
export const NEEDS_FIRST = [
  { guide: "retire", icon: "🌴", title: "Will my money last?", line: "Your ages, savings and spending first, about 20 minutes; then how often the money lasts." },
  { guide: "debt", icon: "💳", title: "When will I be debt-free?", line: "Your loans and cards first, about 10 minutes; then the order and the month each is paid off." },
  { guide: "taxes", icon: "🧮", title: "What will I owe in tax this year?", line: "Your household and pay first, about 15 minutes; then the bill or refund." },
  // (stress test 2026-11-11, j-one-answer/A4: two questions pages answer on their first screen were not listed)
  { guide: "protect", icon: "🛡️", title: "Do I have enough life insurance?", line: "Your family, pay and policies first, about 30 minutes; then how much more, if any." },
  { guide: "budget", icon: "🐖", title: "Am I saving enough?", line: "Your pay, spending and saving first, about 20 minutes; then how you compare with what is advised." },
];
/** The page that answers each of those questions once the plan has the numbers. */
export const ANSWER_PAGES = { retire: "retirement/projection", debt: "debt/payoff", taxes: "taxes/federal", protect: "insurance/life-needs", budget: "overview/benchmarks" };

const monthsText = (m) => m < 12 ? `${m} month${m === 1 ? "" : "s"}` : `${Math.floor(m / 12)} year${Math.floor(m / 12) === 1 ? "" : "s"}${m % 12 ? ` ${m % 12} month${m % 12 === 1 ? "" : "s"}` : ""}`;
const monthYear = (iso) => { const m = /^(\d{4})-(\d{2})/.exec(String(iso ?? "")); return m ? `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][Number(m[2]) - 1]} ${m[1]}` : null; };

/**
 * The answer the plan already gives, in the answer page's own words (its heading and first line), or null when the
 * page cannot answer yet. Each is the same compute the page runs, so the two never disagree.
 */
export function answerFor(guide, plan, params = {}) {
  const cur = plan.meta?.currency ?? "USD";
  const m = (n) => fmtMoney(n, cur);
  if (guide === "retire") {
    // no verdict before Social Security is known for each adult (the Dashboard's rule): the guide's own line shows instead
    if (!retirementKnown(plan, params.today ?? null)) return null;
    const d = projection(plan, params);
    if (!d.ready || !d.verdict) return null;
    // no retirement savings on file: not "runs out", only "not known yet" (Your plan asks for what you own)
    if (savingsUnknown(d)) return { headline: "We don't know yet", line: "You haven't told us about retirement savings, so we can't say whether the money will last. Add what you own to see.", status: "calm", verdict: "unknown", shortAge: null };
    return {
      headline: d.verdict === "on track" ? "The money lasts" : d.verdict === "tight" ? "It lasts, just" : `Runs out in ${d.shortYear}`,
      // the carried figure is markets doing exactly as well as average (about a 4 in 10 chance); Will the money last? gives the
      // figure that lasts in 9 of 10 markets, too slow to work out on every page this line shows on (round 5, 2026-11-02)
      line: d.verdict === "short" ? `At ${m(d.spendingYearly)} a year${healthAdded(d.health) ? " plus health insurance" : ""} the money runs out at age ${d.shortAge}, even if markets do as well as average.` : `You plan to spend ${m(d.spendingYearly)} a year${healthAdded(d.health) ? " plus health insurance" : ""}. If markets do as well as average, your plan can pay for ${d.verdict === "tight" ? "about " : ""}${m(d.affordable)} a year; less after a run of bad years (see the Will the money last? page).`,
      status: d.verdict === "on track" ? "ok" : "warn",
      // quoted for Your plan (overview/plan): the same projection's verdict and the age the money runs out (null when it lasts)
      verdict: d.verdict, shortAge: d.shortAge ?? null,
    };
  }
  if (guide === "debt") {
    const d = payoff(plan, params);
    const c = d.chosen;
    if (!d.hasData || !c) return null;
    if (!Number.isFinite(c.months)) return { headline: "This plan never ends", line: "The payments do not cover the interest on every debt. The page shows what to add.", status: "warn" };
    return { headline: `Debt-free ${monthYear(c.endDate) ? `by ${monthYear(c.endDate)}` : `in ${monthsText(c.months)}`}`, line: `${monthsText(c.months)} at ${m(d.budget)} a month, ${m(c.totalInterest)} of interest.`, status: "ok" };
  }
  if (guide === "protect") {
    // Life insurance needs' own words: the first gap's title and sentence (protectionGaps, the words every page uses)
    const d = lifeNeeds(plan, params);
    if (!d?.ready) return null;
    const gaps = protectionGaps(plan, params);
    if (gaps.length) return { headline: gaps[0].title, line: gaps[0].sentence, status: "warn" };
    const kids = (plan.household?.people ?? []).some((q) => q.role === "dependent"), adults = (plan.household?.people ?? []).filter((q) => q.role !== "dependent").length;
    return kids || adults > 1 ? { headline: "Your family is covered", line: "Life insurance needs finds no gap: if an earner died, the family's plan would still work.", status: "ok" } : { headline: "Nobody depends on one income", line: "With no one counting on your pay, life insurance is not needed now.", status: "ok" };
  }
  if (guide === "budget") {
    // How am I doing's own line for saving (benchmarks' saving-rate item)
    const d = benchmarks(plan, params);
    const it = d?.ready ? (d.items ?? []).find((x) => x.id === "saving-rate") : null;
    if (!it || it.verdict === "unknown") return null;
    return { headline: it.verdict === "ahead" ? "Yes: more than is advised" : it.verdict === "behind" ? "Less than is advised" : it.verdict === "rule" ? "Enough for your plan, less than the usual aim" : "About what is advised", line: it.sentence, status: it.verdict === "behind" ? "warn" : "ok" };
  }
  if (guide === "taxes") {
    // "What will I owe in tax this year?": the refund or bill in April first (the same answer as Withholding check), then the year's tax
    const a = taxAnswer(plan, params);
    if (!a) return null;
    const rate = `${(Math.round(a.effectiveRate * 1000) / 10).toFixed(1)}% of your income`;
    const from = a.from === "paycheck" ? "estimated from your pay" : a.from === "mixed" ? "partly estimated from pay" : "from your pay stubs";
    // the year's tax in words; credits above the tax read as no tax and what they come to, never "About $0 of federal tax
    // (-1.9% of your income)" (round 8 fix: the Federal estimate's total and rate are negative when refundable credits are
    // more than the tax; Bracket explorer says it the same way)
    // (taxAnswer's totalTax is at least 0; `creditsBack` is the refundable credits past the tax)
    const back = Number(a.creditsBack) || 0;
    const yearTax = (tail) => (a.totalTax >= 0.5 ? `About ${m(a.totalTax)} of federal tax for ${a.year}${tail}`
      : back >= 0.5 ? `No federal income tax for ${a.year}: the credits are about ${m(back)} more than the tax` : `No federal income tax for ${a.year}: the credits cover it`);
    if (a.from === "none") {
      // no pay with tax taken out (retired, self-employed): the tax is paid by quarterly estimates
      let e = null;
      try { e = estimatedOf(plan, params); } catch { e = null; }
      // a retiree whose tax is on this year's IRA withdrawals: having tax held back from a withdrawal before December 31
      // counts as paid through the whole year (IRC 6654(g)), so that comes first, the quarters as the other way, never
      // "past due" beside it (round 8 review: the widow read "$2,676 of it is past due" here and "hold back" on two pages)
      if (e?.needsEstimates && e.remaining > 0 && e.holdBack) return { headline: `Have about ${m(e.holdBack.amount)} of tax held back from your IRA withdrawal by December 31`,
        line: `About ${m(a.totalTax)} of federal tax for ${a.year} (${rate}), and you have not entered any tax withheld. Tax held back from a withdrawal counts as paid through the whole year, so the quarters already past are covered too${e.holdBack.whole > e.holdBack.amount + 50 ? `; about ${m(e.holdBack.whole)} leaves nothing to pay in April` : ""}. Paying by quarters works too: the Estimated payments page has both.`, status: "warn" };
      if (e?.needsEstimates && e.remaining > 0) return { headline: `About ${m(e.remaining)} left to pay in estimates for ${a.year}`, line: `About ${m(a.totalTax)} of federal tax (${rate}) and no paycheck takes it out${e.behind > 0 ? `; ${m(e.behind)} of it is past due` : ""}. The Estimated payments page splits it into four payments.`, status: e.behind > 0 ? "warn" : "ok" };
      if (a.totalTax < 0.5 && a.seTax < 1) return { headline: `No federal income tax for ${a.year}`, line: `${yearTax("")}. Type what a paycheck withholds to see the refund.`, status: "ok" };
      return { headline: `About ${m(a.totalTax)} of federal tax for ${a.year}`, line: `${rate} overall. Type what a paycheck withholds to see the refund or bill.`, status: "ok" };
    }
    // filing separately, each return settles on its own: one return's refund cannot pay the other's bill (withholding
    // byReturn; Review 2026-11-06: "About $540 back in April" while Bo's own return owed 1,660)
    const rets = Array.isArray(a.returns) && a.returns.length > 1 ? a.returns : null;
    if (rets) {
      const owe = rets.filter((x) => x.verdict === "owe"), back = rets.filter((x) => x.verdict === "refund");
      const sum = (xs) => xs.reduce((t, x) => t + x.balance, 0);
      return {
        headline: owe.length && back.length ? `${owe[0].name} owes about ${m(owe[0].balance)}; ${back[0].name} gets about ${m(-back[0].balance)} back`
          : owe.length ? `${owe.length > 1 ? "Owe" : `${owe[0].name} owes`} about ${m(sum(owe))} in April` : back.length ? `${back.length > 1 ? "About" : `${back[0].name} gets about`} ${m(-sum(back))} back in April` : "About right: no big bill or refund",
        line: `Filing separately, each return settles on its own. ${yearTax(` in all (${a.seTax >= 1 ? `self-employment tax included` : rate})`)}; your paychecks take out about ${m(a.projected)}, ${from}${a.paid > 0 ? `, and ${m(a.paid)} is already paid` : ""}.`,
        status: owe.length ? "warn" : "ok",
      };
    }
    return {
      headline: a.verdict === "owe" ? `Owe about ${m(a.balance)} in April` : a.verdict === "refund" ? `About ${m(-a.balance)} back in April` : "About right: no big bill or refund",
      line: `${yearTax(` (${a.seTax >= 1 ? `self-employment tax included` : rate})`)}; your paychecks take out about ${m(a.projected)}, ${from}${a.paid > 0 ? `, and ${m(a.paid)} is already paid` : ""}.`,
      status: a.verdict === "owe" ? "warn" : "ok",
    };
  }
  return null;
}

/** What a listed page may save: calculator inputs and quotes, or a goal through its own "Make it a goal" button. */
export const ALLOWED_WRITES = ["whatIfs", "goals", "insurance"];

export const quickHref = (key) => `#/${key}?from=quick`;
export const questionFor = (key) => [...MOST_ASKED, ...MORE].find((q) => q.key === key)
  ?? (() => { const n = NEEDS_FIRST.find((x) => ANSWER_PAGES[x.guide] === key); return n ? { key, icon: n.icon, title: n.title, hint: "The answer below comes from your plan." } : null; })();

/**
 * compute(plan, { off?, today? }) -> { mostAsked, more, answers, needsFirst }: rows with their href; pages in `off`
 * (switched off or not ready on this device) left out. `answers`: the questions of NEEDS_FIRST the plan already
 * answers ({ ...question, key, headline, line, status, href to the answer page }); `needsFirst`: the rest, each opening
 * its guide.
 */
export function compute(plan, params = {}) {
  const off = params.off ?? [];
  const rows = (list) => list.filter((q) => !off.includes(q.key)).map((q) => ({ ...q, href: quickHref(q.key) }));
  const answers = [], needsFirst = [];
  for (const n of NEEDS_FIRST) {
    const key = ANSWER_PAGES[n.guide];
    let a = null;
    if (!off.includes(key)) { try { a = answerFor(n.guide, plan, { today: params.today ?? null }); } catch { a = null; } }
    if (a) answers.push({ ...n, ...a, key, href: quickHref(key) });
    else if (!off.includes("overview/guide")) needsFirst.push({ ...n, href: `#/overview/guide/${n.guide}` });
  }
  const out = { mostAsked: rows(MOST_ASKED), more: rows(MORE), answers, needsFirst };
  // "Will my savings last?" (gap #2): only once both amounts are saved, so a plan without them reads exactly as before
  const q = lastInputs(plan.whatIfs?.quickLast);
  if (q) { const a = savingsLast(q); out.last = { ...a, words: lastWords(a, plan.meta?.currency ?? "USD") }; }
  return out;
}

// ================================================================ "Will my savings last?" in three boxes (gap #2, 2026-11-13)
// Saved for retirement, to take out each month (today's dollars), for how many years; the share in stocks and the fee are
// "More details (optional)". Tried against every stretch of that many years in the real history bundled with
// If history repeated: Damodaran (NYU Stern), S&P 500 with dividends, 10-year Treasury bonds, CPI, 1928-2025
// (README "Will my savings last?": the loop, the sources and their read dates). A what-if: whatIfs.quickLast, never
// counted in the plan.

/** The page's own figures where the person set none: 30 years, 60% in stocks (the rest in bonds), no fee. */
export const LAST_DEFAULTS = Object.freeze({ years: 30, stocks: 0.6, fee: 0 });
/** The chips: years, share in stocks, fee a year (an investing app about 0.25%, an adviser about 1%: README). */
export const LAST_YEARS = Object.freeze([20, 25, 30, 35]);
export const LAST_STOCKS = Object.freeze([0.4, 0.6, 0.8]);
export const LAST_FEES = Object.freeze([0, 0.0025, 0.01]);

const given = (v) => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));
const within = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/**
 * whatIfs.quickLast -> { saved, monthly, years, stocks, fee } with the page's defaults, or null while either amount is
 * missing or not above $0 (the page then asks first: nothing saved or nothing taken out has nothing to test, critic g12
 * F2). Years are held inside the history (1 to 98), the shares inside 0 to 100%.
 */
export function lastInputs(q, R = RETURNS) {
  if (!q || typeof q !== "object" || !given(q.saved) || !given(q.monthly)) return null;
  const saved = Number(q.saved), monthly = Number(q.monthly);
  if (!(saved > 0) || !(monthly > 0)) return null;
  return {
    saved, monthly,
    years: within(Math.round(given(q.years) ? Number(q.years) : LAST_DEFAULTS.years), 1, R.length),
    stocks: within(given(q.stocks) ? Number(q.stocks) : LAST_DEFAULTS.stocks, 0, 1),
    fee: within(given(q.fee) ? Number(q.fee) : LAST_DEFAULTS.fee, 0, 1),
  };
}

/**
 * One stretch from start index s: each year the year's amount comes out at its start (a stretch has run out the year it
 * cannot), then the rest grows by stocks x the year's stocks + (1 - stocks) x its bonds - fee, then is divided by
 * 1 + that year's inflation, so every figure is in today's dollars. -> { start, lasted, failYear (1-based) | null,
 * yearsPaid, end (today's dollars; 0 once it ran out) }
 */
export function runStretch(s, { saved, yearly, years, stocks, fee }, R = RETURNS) {
  let b = saved;
  for (let k = 0; k < years; k++) {
    b -= yearly;
    if (b < 0) return { start: R[s].year, lasted: false, failYear: k + 1, yearsPaid: k, end: 0 };
    const y = R[s + k];
    b = b * (1 + stocks * y.stocks + (1 - stocks) * y.bonds - fee) / (1 + y.inflation);
  }
  return { start: R[s].year, lasted: true, failYear: null, yearsPaid: years, end: b };
}
const everyStretch = (o, yearly, R) => { for (let s = 0; s + o.years <= R.length; s++) if (!runStretch(s, { ...o, yearly }, R).lasted) return false; return true; };
/**
 * The most a month, in steps of $10, that lasted in every stretch: bisection, since what is left falls as the amount
 * rises. $0 always lasts; more than the savings in a year fails in the first year, so the search starts between them.
 */
export function safeMonthly({ saved, years, stocks, fee }, R = RETURNS) {
  const o = { saved, years, stocks, fee };
  let lo = 0, hi = Math.floor(Math.max(0, saved) / 120) + 1;   // in tens of dollars: hi x 10 x 12 is more than the savings
  while (hi - lo > 1) { const mid = Math.floor((lo + hi) / 2); if (everyStretch(o, mid * 120, R)) lo = mid; else hi = mid; }
  return lo * 10;
}
/** "all" (every stretch lasted), "most" (90% or more), "often" (50% to 90%), "seldom" (under 50%), "never" (none). */
export const lastCase = (lasted, windows) => (lasted === windows ? "all" : lasted === 0 ? "never" : lasted / windows >= 0.9 ? "most" : lasted / windows >= 0.5 ? "often" : "seldom");

/**
 * savingsLast({ saved, monthly, years, stocks, fee }) -> { saved, monthly, years, stocks, fee, windows, lasted, share,
 * case, hardest: { start, failYear, yearsPaid, end }, medianEnd, safeMonthly, from, to, lastStart } or null when the
 * history is shorter than the years. The hardest start is the one that ran out soonest (the earliest start on a tie);
 * when every stretch lasted, the one with the least left. medianEnd counts a stretch that ran out as 0.
 */
export function savingsLast({ saved, monthly, years, stocks = LAST_DEFAULTS.stocks, fee = LAST_DEFAULTS.fee }, R = RETURNS) {
  const windows = R.length - years + 1;
  if (!(windows >= 1)) return null;
  const runs = [];
  for (let s = 0; s < windows; s++) runs.push(runStretch(s, { saved, yearly: 12 * monthly, years, stocks, fee }, R));
  const lasted = runs.filter((r) => r.lasted).length;
  const failed = runs.filter((r) => !r.lasted);
  const hardest = failed.length ? failed.reduce((a, b) => (b.failYear < a.failYear ? b : a)) : runs.reduce((a, b) => (b.end < a.end ? b : a));
  const ends = runs.map((r) => r.end).sort((a, b) => a - b);
  const medianEnd = windows % 2 ? ends[(windows - 1) / 2] : (ends[windows / 2 - 1] + ends[windows / 2]) / 2;
  return {
    saved, monthly, years, stocks, fee, windows, lasted, share: lasted / windows, case: lastCase(lasted, windows),
    hardest: { start: hardest.start, failYear: hardest.failYear, yearsPaid: hardest.yearsPaid, end: hardest.end },
    medianEnd, safeMonthly: safeMonthly({ saved, years, stocks, fee }, R), from: R[0].year, to: R[R.length - 1].year, lastStart: R[windows - 1].year,
  };
}

/** A figure that is an estimate, said without false precision: to the nearest $1,000 from $10,000, else to $10. */
export const roughly = (n) => (Math.abs(n) >= 10000 ? Math.round(n / 1000) * 1000 : Math.round(n / 10) * 10);
const yearsWord = (n) => `${n} year${n === 1 ? "" : "s"}`;
/**
 * The words for an answer (README "Will my savings last?": one written sentence per case, tested):
 *   sentence  the answer; second  the hardest start; saved  the green line after a save; more  the three more numbers;
 *   figures   the status of "The figures": the two amounts, or the savings alone past 20 characters.
 */
export function lastWords(a, cur = "USD") {
  const m = (n) => fmtMoney(n, cur);
  const { saved, monthly, years: n, windows, lasted, from } = a;
  const sentence = {
    all: `In every ${n}-year stretch since ${from}, ${m(monthly)} a month from ${m(saved)} lasted.`,
    most: `In ${lasted} of ${windows} stretches of ${yearsWord(n)} since ${from}, ${m(monthly)} a month from ${m(saved)} lasted.`,
    often: `It lasted in ${lasted} of ${windows} stretches since ${from}; in the rest it ran out early.`,
    seldom: `In most stretches since ${from}, ${m(monthly)} a month ran out before ${yearsWord(n)}.`,
    never: `In every stretch since ${from}, ${m(monthly)} a month ran out before ${yearsWord(n)}.`,
  }[a.case];
  const h = a.hardest;
  const second = a.case === "all"
    ? (h.end >= 0.5 ? `Even starting in ${h.start}, the hardest year, ${m(roughly(h.end))} was left.` : `Even starting in ${h.start}, the hardest year, it lasted with nothing left.`)
    : h.yearsPaid === 0 ? `The hardest start was ${h.start}: it ran out in the first year.` : `The hardest start was ${h.start}: it ran out after ${yearsWord(h.yearsPaid)}.`;
  const saidSaved = a.case === "all" ? `Saved. It lasted in all ${windows} stretches.` : a.case === "never" ? `Saved. It ran out in all ${windows} stretches.` : `Saved. It lasted in ${lasted} of ${windows} stretches.`;
  const more = [
    a.safeMonthly >= 10 ? `Up to ${m(a.safeMonthly)} a month lasted in every stretch.` : "Less than $10 a month lasted in every stretch.",
    // (a run-out counts as $0 in the middle figure: when at least half lasted, the middle one lasted with nothing left)
    a.medianEnd >= 0.5 ? `In the middle stretch, ${m(roughly(a.medianEnd))} was left after ${yearsWord(n)}, in today's dollars.`
      : 2 * lasted >= windows ? `In the middle stretch, it lasted with nothing left after ${yearsWord(n)}.` : `In the middle stretch, the money ran out before ${yearsWord(n)}.`,
    windows === 1 ? `1 stretch of ${yearsWord(n)}, starting in ${from}.` : `${windows} stretches of ${yearsWord(n)}, the first starting in ${from} and the last in ${a.lastStart}.`,
  ];
  const both = `${m(saved)}, ${m(monthly)}`;
  return { sentence, second, saved: saidSaved, more, figures: both.length <= 20 ? both : m(saved) };
}

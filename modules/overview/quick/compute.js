// modules/overview/quick/compute.js -- PURE. The questions Quick answers lists, each opening a page that gives an
// answer on an empty plan, and the rule for listing one (README "What is listed").
//   key      "group/id" of a usable page
//   icon     one emoji for the row (the pages' own icons repeat: three goals pages share 🎯)
//   title    the question, in the reader's words, ending in "?"
//   line     one sentence: what the answer holds
//   hint     optional: what the bar on that page says after the question (default "Type your own numbers below.")

import { compute as projection } from "../../retirement/projection/compute.js";
import { compute as payoff } from "../../debt/payoff/compute.js";
import { taxAnswer } from "../../taxes/withholding/compute.js";
import { money as fmtMoney } from "../../../core/format.js";

/** Answer on an empty plan, and save only calculator inputs (whatIfs, insurance quotes) or a goal by its own button. */
export const MOST_ASKED = [
  { key: "goals/house", icon: "🏠", title: "How much home can I afford?", line: "The monthly cost, the cash you need on the day, and when you will have it." },
  { key: "property/rent-vs-buy", icon: "🔑", title: "Should I rent or buy?", line: "Who comes out ahead after the years you stay, and the rent where they are even." },
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
];
/** The page that answers each of those questions once the plan has the numbers. */
export const ANSWER_PAGES = { retire: "retirement/projection", debt: "debt/payoff", taxes: "taxes/federal" };

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
    const d = projection(plan, params);
    if (!d.ready || !d.verdict) return null;
    return {
      headline: d.verdict === "on track" ? "The money lasts" : d.verdict === "tight" ? "It lasts, just" : `Runs out in ${d.shortYear}`,
      line: d.verdict === "short" ? `At ${m(d.spendingYearly)} a year the money runs out at age ${d.shortAge}; the plan carries about ${m(d.affordable)} a year.` : `The plan carries ${d.verdict === "tight" ? "about " : ""}${m(d.affordable)} a year of spending in today's dollars; you plan on ${m(d.spendingYearly)}.`,
      status: d.verdict === "on track" ? "ok" : "warn",
    };
  }
  if (guide === "debt") {
    const d = payoff(plan, params);
    const c = d.chosen;
    if (!d.hasData || !c) return null;
    if (!Number.isFinite(c.months)) return { headline: "This plan never ends", line: "The payments do not cover the interest on every debt. The page shows what to add.", status: "warn" };
    return { headline: `Debt-free ${monthYear(c.endDate) ? `by ${monthYear(c.endDate)}` : `in ${monthsText(c.months)}`}`, line: `${monthsText(c.months)} at ${m(d.budget)} a month, ${m(c.totalInterest)} of interest.`, status: "ok" };
  }
  if (guide === "taxes") {
    // "What will I owe in tax this year?": the refund or bill in April first (the same answer as Withholding check), then the year's tax
    const a = taxAnswer(plan, params);
    if (!a) return null;
    const rate = `${(Math.round(a.effectiveRate * 1000) / 10).toFixed(1)}% of your income`;
    const from = a.from === "paycheck" ? "estimated from your pay" : "from your pay stubs";
    if (a.from === "none") return { headline: `About ${m(a.totalTax)} of federal tax for ${a.year}`, line: `${rate} overall. Type what a paycheck withholds to see the refund or bill.`, status: "ok" };
    return {
      headline: a.verdict === "owe" ? `Owe about ${m(a.balance)} in April` : a.verdict === "refund" ? `About ${m(-a.balance)} back in April` : "About right: no big bill or refund",
      line: `About ${m(a.totalTax)} of federal tax for ${a.year} (${rate}); your paychecks take out about ${m(a.projected)}, ${from}.`,
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
  return { mostAsked: rows(MOST_ASKED), more: rows(MORE), answers, needsFirst };
}

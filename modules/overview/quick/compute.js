// modules/overview/quick/compute.js -- PURE. The questions Quick answers lists, each opening a page that gives an
// answer on an empty plan, and the rule for listing one (README "What is listed").
//   key      "group/id" of a usable page
//   icon     one emoji for the row (the pages' own icons repeat: three goals pages share 🎯)
//   title    the question, in the reader's words, ending in "?"
//   line     one sentence: what the answer holds

/** Answer on an empty plan, and save only calculator inputs (whatIfs, insurance quotes) or a goal by its own button. */
export const MOST_ASKED = [
  { key: "goals/house", icon: "🏠", title: "How much home can I afford?", line: "The monthly cost, the cash you need on the day, and when you will have it." },
  { key: "property/rent-vs-buy", icon: "🔑", title: "Should I rent or buy?", line: "Who comes out ahead after the years you stay, and the rent where they are even." },
  { key: "goals/vehicle", icon: "🚗", title: "Pay cash for a car or borrow?", line: "What to save a month to pay cash, or the loan for the rest." },
  { key: "property/purchase", icon: "🛋️", title: "Save up or pay over time?", line: "A sofa, a laptop, a ring: what saving, a payment plan or paying now each costs." },
  { key: "insurance/health", icon: "🩺", title: "Which health plan costs least?", line: "Premiums plus your share of the bills, in a quiet, a usual and a bad year." },
  { key: "goals/charitable", icon: "🎁", title: "What does my giving save in tax?", line: "What a gift really costs, and how to give the same for less." },
  { key: "investments/backtest", icon: "📈", title: "How has a mix of stocks and bonds done?", line: "Any mix run through the years since 1871: growth, worst years, deepest fall." },
  { key: "property/renovation", icon: "🔨", title: "Is this home project worth it?", line: "What it adds to the home's value and the cheapest way to pay for it." },
];
export const MORE = [
  { key: "career/offer-compare", icon: "💼", title: "Which job offer pays more?", line: "Pay, bonus, stock, benefits and the commute side by side, after tax." },
  { key: "investments/risk", icon: "🎢", title: "How much could my savings drop in a bad year?", line: "The worst year and the deepest fall that history has dealt the mix of stocks and bonds you pick." },
  { key: "insurance/term-vs-permanent", icon: "🛡️", title: "Whole life or term life insurance?", line: "Whole life against cheaper term insurance plus investing the difference, using the prices you were quoted." },
];
/** Questions whose answer needs your own numbers first: they open the step-by-step guide that gathers them. */
export const NEEDS_FIRST = [
  { guide: "retire", icon: "🌴", title: "Will my money last?", line: "Your ages, savings and spending first, about 20 minutes; then how often the money lasts." },
  { guide: "debt", icon: "💳", title: "When will I be debt-free?", line: "Your loans and cards first, about 10 minutes; then the order and the month each is paid off." },
  { guide: "taxes", icon: "🧮", title: "What will I owe in tax this year?", line: "Your household and pay first, about 15 minutes; then the bill or refund." },
];
/** What a listed page may save: calculator inputs and quotes, or a goal through its own "Make it a goal" button. */
export const ALLOWED_WRITES = ["whatIfs", "goals", "insurance"];

export const quickHref = (key) => `#/${key}?from=quick`;
export const questionFor = (key) => [...MOST_ASKED, ...MORE].find((q) => q.key === key) ?? null;

/** compute(plan, { off? }) -> { mostAsked, more, needsFirst }: rows with their href; pages in `off` (switched off or not ready on this device) left out. */
export function compute(plan, params = {}) {
  const off = params.off ?? [];
  const rows = (list) => list.filter((q) => !off.includes(q.key)).map((q) => ({ ...q, href: quickHref(q.key) }));
  return {
    mostAsked: rows(MOST_ASKED), more: rows(MORE),
    needsFirst: NEEDS_FIRST.filter((n) => !off.includes("overview/guide")).map((n) => ({ ...n, href: `#/overview/guide/${n.guide}` })),
  };
}

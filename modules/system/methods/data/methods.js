// modules/system/methods/data/methods.js -- the hand-written list behind "How we work out the answers" (gap design #28).
//
//   { id, topic, status, says: [sentence, ...], sources: [{ name, url?, read, readme, cited }], pages: ["group/id", ...] }
//
// Nothing here is new research. Every source is one a module README already cites, with the day that README says it
// was read: `readme` is the module whose README cites it, `cited` the words (or the address) that README uses, and
// module.test.mjs opens the README and finds both, with the date beside them. `url` is given only where the README
// gives a full address. `name` says what it is in plain words first; the publisher's own name or number (a law, a
// procedure, a table) comes after, in brackets. `read` is the LATEST day a README says it read that source. To add a
// source: cite it in the page's README first, with its read date, then add it here.
// `status` is the row's short line (at most 20 characters, docs/OPTIONAL.md R25). `says` is what a person reads: plain
// words, page names exactly as their titles (the test checks each quoted title is a page).

const DAMODARAN = {
  name: "Yearly returns of stocks, bonds and cash, 1928 to 2025 (Aswath Damodaran, NYU Stern)",
  url: "https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html",
  read: "2026-11-13", readme: "overview/quick", cited: "pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html",
};

export const METHODS = [
  {
    id: "retirement", topic: "Retirement", status: "history since 1928",
    says: [
      "Your plan is run one year at a time, from this year to the age you want the money to last to: what you have, what you add, what comes in, what you spend and the tax on it.",
      "\"If history repeated\" replays your plan through every stretch of real years since 1928. \"Chance the money lasts\" runs it thousands of times with returns drawn at random and counts how often the money lasts.",
      "How long you may live comes from a curve fitted to come close to Social Security's life tables. The withdrawals the law requires later in life use the IRS's own table.",
    ],
    sources: [
      DAMODARAN,
      { name: "The IRS's table for the withdrawals the law requires, by age (Publication 590-B, Table III)", url: "https://www.irs.gov/publications/p590b", read: "2026-10-26", readme: "retirement/rmd", cited: "irs.gov/publications/p590b" },
      { name: "Social Security's yearly limits on pay while you collect", url: "https://www.ssa.gov/oact/cola/rtea.html", read: "2026-10-31", readme: "retirement/social-security", cited: "ssa.gov/oact/cola/rtea.html" },
    ],
    pages: ["retirement/projection", "retirement/monte-carlo", "retirement/historical", "retirement/longevity", "retirement/social-security", "retirement/rmd"],
  },
  {
    id: "taxes", topic: "Taxes", status: "IRS tables for 2026",
    says: [
      "Your income for the year, less the deductions you can take, goes through the IRS's tax brackets for 2026. Then the credits you qualify for come off.",
      "The amounts are the IRS's yearly figures and the tax law passed in 2025.",
      "It is an estimate to plan with, not a tax return: it counts what the plan knows and what you type.",
    ],
    sources: [
      { name: "The IRS's tax tables and amounts for 2026 (Revenue Procedure 2025-32)", url: "https://www.irs.gov/pub/irs-drop/rp-25-32.pdf", read: "2026-11-06", readme: "taxes/federal", cited: "irs.gov/pub/irs-drop/rp-25-32.pdf" },
      { name: "The tax law passed in 2025 (Public Law 119-21)", url: "https://www.govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm", read: "2026-11-02", readme: "taxes/federal", cited: "govinfo.gov/content/pkg/PLAW-119publ21/html/PLAW-119publ21.htm" },
    ],
    pages: ["taxes/federal", "taxes/brackets", "taxes/withholding", "taxes/estimated", "taxes/capital-gains"],
  },
  {
    id: "debt", topic: "Debt", status: "lenders' own rules",
    says: [
      "Each month a debt grows by its balance times its yearly rate divided by 12, and your payment comes off. Repeating that month after month gives the date each debt is gone and the interest you pay on the way.",
      "Whether your debts are heavy for your income is judged on the lines that lenders and the government's consumer bureau publish.",
      "When the insurance on a mortgage can stop follows the federal law on it.",
    ],
    sources: [
      { name: "The government consumer bureau's worksheet for how much of your income goes to debt (Consumer Financial Protection Bureau)", url: "https://files.consumerfinance.gov/f/documents/cfpb_your-money-your-goals_debt_income_calc_tool_2018-11_ADA.pdf", read: "2026-11-06", readme: "debt/ratios", cited: "files.consumerfinance.gov/f/documents/cfpb_your-money-your-goals_debt_income_calc_tool_2018-11_ADA.pdf" },
      { name: "Fannie Mae's rules for lenders on how much of your income may go to debt (Selling Guide B3-6-02)", url: "https://selling-guide.fanniemae.com/sel/b3-6-02/debt-income-ratios", read: "2026-11-06", readme: "debt/ratios", cited: "selling-guide.fanniemae.com/sel/b3-6-02/debt-income-ratios" },
      { name: "The federal law on when mortgage insurance ends (Homeowners Protection Act of 1998)", url: "https://www.law.cornell.edu/uscode/text/12/4902", read: "2026-11-07", readme: "debt/mortgage", cited: "law.cornell.edu/uscode/text/12/4902" },
      { name: "The rule for the minimum payment warning on a card statement (Consumer Financial Protection Bureau)", url: "https://www.consumerfinance.gov/rules-policy/regulations/1026/7/", read: "2026-11-06", readme: "debt/credit-cards", cited: "consumerfinance.gov/rules-policy/regulations/1026/7/" },
    ],
    pages: ["debt/payoff", "debt/mortgage", "debt/credit-cards", "debt/ratios"],
  },
  {
    id: "cash", topic: "Cash and budget", status: "your own numbers",
    says: [
      "These pages add up what you typed: your pay, your bills, your envelopes and your bank lines. No outside figure is used for them.",
      "The one exception is turning pay before tax into take-home pay. That follows the IRS's worksheet for what an employer holds back, and its rates for Social Security and Medicare tax.",
      "The forecast starts from today's balances and adds each pay and each bill on its day.",
    ],
    sources: [
      { name: "The IRS's rates for Social Security and Medicare tax (Topic no. 751)", url: "https://www.irs.gov/taxtopics/tc751", read: "2026-10-31", readme: "cashflow/paycheck", cited: "irs.gov/taxtopics/tc751" },
      { name: "The IRS's worksheet for what an employer holds back for income tax (Publication 15-T, 2026)", read: "2026-10-30", readme: "cashflow/paycheck", cited: "Publication 15-T (2026), Worksheet 1A" },
    ],
    pages: ["cashflow/budget", "cashflow/budget-percent", "cashflow/paycheck", "cashflow/forecast", "cashflow/expenses"],
  },
  {
    id: "investments", topic: "Investments", status: "history, forecasts",
    says: [
      "Growth is the yearly return on the Assumptions page: 7% for stocks and 3% for rising prices, unless you change them. Under them the page shows what two large investment firms forecast, so you can judge ours.",
      "Looking back uses the real yearly returns of stocks, bonds and cash.",
      "Fees are your funds' yearly charges times what you hold, carried through the years of your plan. How much you may put into each kind of account is the IRS's limit for the year.",
    ],
    sources: [
      DAMODARAN,
      { name: "Vanguard's 10-year return forecasts, as of September 30, 2026", read: "2026-11-11", readme: "system/assumptions", cited: "VCMM 10-year return forecasts as of 2026-09-30" },
      { name: "The rule on telling savers what a plan at work charges (U.S. Department of Labor, 29 CFR 2550.404a-5)", url: "https://www.law.cornell.edu/cfr/text/29/2550.404a-5", read: "2026-11-13", readme: "investments/fees", cited: "law.cornell.edu/cfr/text/29/2550.404a-5" },
      { name: "The IRS's limits on how much you may put in for 2026 (Notice 2025-67)", url: "https://www.irs.gov/pub/irs-drop/n-25-67.pdf", read: "2026-11-06", readme: "retirement/contributions", cited: "Notice 2025-67" },
    ],
    pages: ["system/assumptions", "investments/allocation", "investments/fees", "investments/backtest", "investments/limits", "retirement/contributions"],
  },
  {
    id: "insurance", topic: "Insurance", status: "published costs",
    says: [
      "Each page asks what would have to be paid if something happened, and sets it beside the coverage you have.",
      "Life insurance looks at what your family would need without you, and counts what Social Security would pay them.",
      "Long-term care uses a national survey of what care costs. The rules for a health savings account are the IRS's.",
    ],
    sources: [
      { name: "The most Social Security pays one family on one person's record (Social Security Administration)", url: "https://www.ssa.gov/oact/cola/familymax.html", read: "2026-10-31", readme: "insurance/life-needs", cited: "ssa.gov/oact/cola/familymax.html" },
      { name: "A national survey of what care costs (CareScout / Genworth Cost of Care Survey 2025)", read: "2026-10-31", readme: "insurance/ltc", cited: "CareScout / Genworth Cost of Care Survey 2025" },
      { name: "The IRS's 2026 rules for health plans that allow a health savings account (Revenue Procedure 2025-19)", read: "2026-10-31", readme: "insurance/health", cited: "Rev. Proc. 2025-19" },
    ],
    pages: ["insurance/life-needs", "insurance/disability", "insurance/ltc", "insurance/health", "insurance/policies"],
  },
  {
    id: "guesses", topic: "Our guesses", status: "public surveys",
    says: [
      "Where you leave a box empty, the plan fills in a gray figure: what is usual for someone like you in public surveys, such as pay by state and age, or what Social Security pays on average at your age.",
      "A guess is always marked as ours and never hidden. \"Our guesses for you\" lists every one still in use, the ones that change your answers most first, so you can type the real figure.",
    ],
    sources: [
      { name: "What Social Security pays on average, by age (Annual Statistical Supplement 2026, Table 5.B9)", url: "https://www.ssa.gov/policy/docs/statcomps/supplement/2026/5b.html#table5.b9", read: "2026-11-07", readme: "overview/guesses", cited: "ssa.gov/policy/docs/statcomps/supplement/2026/5b.html#table5.b9" },
      { name: "What households own and owe (Federal Reserve Board, Survey of Consumer Finances 2025)", url: "https://www.federalreserve.gov/econres/scfindex.htm", read: "2026-11-11", readme: "overview/guesses", cited: "federalreserve.gov/econres/scfindex.htm" },
      { name: "What people are paid, by state (U.S. Census Bureau, American Community Survey 2025)", read: "2026-11-02", readme: "overview/guesses", cited: "American Community Survey 2025 1-year, table B20018" },
      { name: "What health coverage through work costs (KFF Employer Health Benefits Survey 2026)", read: "2026-11-02", readme: "overview/guesses", cited: "KFF Employer Health Benefits Survey 2026" },
    ],
    pages: ["overview/guesses", "system/assumptions"],
  },
];

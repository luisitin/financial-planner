// core/phases.js -- the build phases, machine-readable. ROADMAP.md is the prose version;
// docs/MODULE_CATALOG.md's "phase" column assigns every page to one of these, and the
// scaffold writes that number into each placeholder's module.js. Keep the three in step.
export const PHASES = [
  { n: 0,  title: "Foundation",                    blurb: "The app itself: shell, storage, PC server, the first pages." },
  { n: 1,  title: "Reach it anywhere",             blurb: "Access token, router port forward or Tailscale, start with Windows." },
  { n: 2,  title: "Your numbers",                  blurb: "People, income, expenses, goals and the assumptions behind everything." },
  { n: 3,  title: "Transactions",                  blurb: "Import bank exports, rules, AI categorisation, real income statement." },
  { n: 4,  title: "Cash flow and debt",            blurb: "Bills, a 90-day forecast, envelope budget, payoff plans." },
  { n: 5,  title: "Retirement",                    blurb: "Projections, Social Security, withdrawal strategies, Monte Carlo on the PC." },
  { n: 6,  title: "Taxes",                         blurb: "Federal estimate, brackets, withholding, Roth conversions." },
  { n: 7,  title: "Investments",                   blurb: "Holdings, allocation, rebalancing, fees, performance." },
  { n: 8,  title: "Protection and the advisor's plan", blurb: "Insurance needs, estate checklist, the advisor's plan side by side with yours." },
  { n: 9,  title: "Scenarios and reports",         blurb: "What-ifs, stress tests, printable summaries, the monthly review." },
  { n: 10, title: "Polish",                        blurb: "Offline, live sync, encryption, Spanish, explain-this-page everywhere." },
];
export const phaseOf = (n) => PHASES.find((p) => p.n === Number(n)) ?? PHASES[PHASES.length - 1];

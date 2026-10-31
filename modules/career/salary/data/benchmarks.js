// modules/career/salary/data/benchmarks.js -- the usual raises the page quotes and the promotion raise its form starts
// from, each with its source and date. All checked on 2026-10-30 against the publishers' own releases; refresh each
// autumn when the salary budget surveys come out.
export const BENCHMARKS = {
  asOf: "2026-10-30",
  promotion: {
    value: 0.085, title: "A promotion", short: "about 8.5%",
    text: "What employers expect to give for a one-level promotion, on top of the yearly raise.",
    source: "Mercer US compensation planning survey, March 2026 (WorldatWork Workspan Daily, 7 May 2026)",
  },
  budget: {
    value: 0.035, title: "The yearly raise", short: "about 3.5%",
    text: "What employers plan to spend on raises in 2027, promotions included: 3.4% to 3.5% (the median) across the big surveys, about the same as in 2026. The yearly raise alone, without promotions, is about 3.1% to 3.2%: use that as your raise when you add promotions, so they are not counted twice.",
    source: "WTW (July 2026), Mercer (31 Aug 2026), Payscale (4 Aug 2026), The Conference Board (3 Sep 2026), WorldatWork (15 Jul 2026, median)",
  },
  switchers: {
    switcher: 0.047, stayer: 0.034, month: "September 2026", title: "Changing jobs", short: "4.7% against 3.4%",
    text: "Typical (median) pay growth over a year for people who changed jobs, against people who stayed in theirs (averaged over three months to September 2026).",
    source: "Federal Reserve Bank of Atlanta, Wage Growth Tracker (FRED, updated 9 Oct 2026)",
  },
  peak: {
    title: "When pay peaks", short: "35 to 54",
    text: "Typical (median) full-time pay is highest from 35 to 54 ($1,414 a week at 35 to 44, $1,407 at 45 to 54) and a little lower from 55 to 64 ($1,376).",
    source: "Bureau of Labor Statistics, Usual Weekly Earnings, third quarter 2026 (21 Oct 2026)",
  },
  prices: {
    value: 0.037, title: "Prices", short: "3.7% a year",
    text: "Consumer prices rose 3.7% in the 12 months to September 2026: a raise below that buys less than last year's pay.",
    source: "Bureau of Labor Statistics, Consumer Price Index, September 2026 (14 Oct 2026)",
  },
};

# UX research: "what drives your answer", checking it and changing it, on a 390 px phone

Lane: ux (research and reasoning only; nothing in the repo was edited).
Date: 2026-11-11. Repo walked: HEAD `c6fb730` on `claude/creative-build-b531q0`, which contains the named tip
`fe678cb`. It was copied with `git archive` into the scratchpad, served on 127.0.0.1:9361/9362 and walked in the sandbox with
the shared kit (iPhone emulation, 390 x 844). The households are the invented `qa/` ones.
Screenshots: `$SP/rv/shots/`.

The owner asked for five things:
(1) when a plan falls short, show the inputs that can change it and let the person adjust them, because the inputs may simply be
wrong (a missing 401(k), a wrong match, leftover money not counted as invested, inflation and returns);
(2) show the assumptions and defaults, let the person change them, and show how things would change;
(3) Roth and traditional buckets, per person and per account;
(4) the big picture first, then a deeper look;
(5) account connection, only if it is easy and well documented. That one belongs to another lane; there is one pointer in 4.11.

---

## 0. The short version

1. **Every good planner leads with one answer.** Fidelity gives the share of retirement costs covered when markets are poor. T. Rowe
   Price gives a monthly income that holds in 80% of simulations. MaxiFi gives the most you can spend a year. Boldin, Empower and
   ProjectionLab give a chance of success. The careful headline in this app ("in a bad run of years, about $6,600 a month") is
   already the best-supported form. Keep it.
2. **None of the seven planners looked at says which inputs are your figures and which are the tool's.** That is this app's
   opening. It already keeps a record of every guessed figure (`plan.guesses`, with a spread) and already has a Sensitivity page.
   Put the two together: "This answer rests on 5 numbers. You typed 3; we filled in 2."
3. **Show the levers in this order.**
   (a) Blanks that count as zero but probably aren't: no retirement saving on file while working, money left over each month
   that is never counted as invested, and the employer match.
   (b) Our guesses, ranked by how much they move the answer.
   (c) Market and life assumptions, shown as unknowns and not as fixes.
   (d) Choices: when to stop work, how much to save, how much to spend, when to claim Social Security. These lead to Goal seek.
4. **Each lever is one card.** It shows the value now, a tag (Yours, Our guess or Usual figure), a typical range with a source,
   and the effect of one sensible change, in the same unit as the headline (dollars a month, or the age the money runs out).
5. **Leftover money is the biggest silent driver, and the engine drops it today.** In `core/math/retirement.js`, pay left over
   while working is never saved; only spare required withdrawals go to regular savings.
   - On the invented young single (Sam), the plan counts $0 of the $746 a month left over. Counting 5% of pay plus a typical
     half match ($300 a month in all) takes Sam from "runs out at 65" to "can pay about $2,850 a month", against the $2,650
     planned (it lasts in about 6 of 10 pretend futures). Counting the leftover as invested gives about $4,350.
   - The person needs a stated choice ("invested / stays in the bank / gets spent"). The leftover should also be checked against
     how the balances actually moved, because a large leftover often means spending is missing.
6. **Return guardrails.**
   - Take "the return it needs" out of Goal seek's list of fixes and show it as information.
   - Offer three sourced presets (careful, middle, hopeful).
   - A typed return above the forecast band carries a "hopeful" tag wherever the answer shows, and it can never turn a verdict
     green, the way a guess never does today.
   - FP Canada's planner guidelines say in so many words that it "would not be prudent to increase return assumptions to 'force'
     a projection that secures a client's goal."
7. **Sensitivity needs three fixes.**
   - It leads with something the person cannot act on ("Inflation moves your plan the most").
   - It shows rows of "$0 / $0" for a household with no savings, while Will the money last? and Goal seek both say "We don't know
     yet".
   - It lists 11 rows on a 2,522 px page.
   Split it into "Things you decide" and "Things nobody knows", show 5 rows, and gate it like the other two pages.
8. **Roth vs traditional in plain words: "pay the tax now" or "pay the tax later".**
   - Each contribution row gets a split ("Later / Now / Some of each").
   - The match is "later" unless the plan offers a Roth match.
   - One plain rule of thumb and the effect on this year's tax.
   - Balances shown after tax, so $100k pre-tax and $100k Roth no longer look equal.
9. **Big picture, then deeper, in two levels at most** (Nielsen 2006).
   - Level 1 is the answer plus "What this rests on".
   - Level 2 is the pages: Contributions, Assumptions, Social Security, then the analysis pages, labelled as questions ("How sure
     is this?", "What matters most?", "What would it take?").
   - The check should be a step of the existing path, not a new walk. The design log (2026-11-06) forbids a new walk.
10. **After the check, show a before-and-after card.** For example: "You checked 5 numbers; 2 changed; the money now lasts to 95,
    with little to spare." This is the valuable moment the owner is asking for.

---

## 1. What the app does today (walked on a phone)

Two cases.
- **"Short":** the invented family (`qa/fixtures/family-plan.mjs`, Ana and Bo) with retirement spending raised to $11,000 a month
  so that it falls short.
- **"No savings":** Sam (`setup-personas`), 24, pays himself $48k, no retirement account and no contributions. The invented Jordan
  and the renter in debt are in the same state: the savings verdict is "short", the money runs out at 65 and the plan can pay $0.

| # | Page | What a layperson sees | Why it matters |
|---|---|---|---|
| F1 | Will the money last? (short) | A good hero: "Runs out in 2070". The average: "the most the plan can pay for is about $101,203 a year". The bad run: "about $79,700 a year ($6,600 a month)". The odds: "6 of 100". Then two outlined buttons, "Could you stop sooner? What would change it ›" and "Chance the money lasts ›". The inputs sit far down in "What goes into this" (a 2,800 px page), with no mark for which ones are the person's own. | The answer comes first, which is right. But nothing says which inputs to check first. The average figure is printed to the dollar ($101,203) next to a rounded one ($79,700), which suggests false precision. |
| F2 | Sensitivity (short) | Headline: "Inflation moves your plan the most". 11 rows of bars nudged ±1 point or ±2 years. Choices and guesses are mixed together, and only explained at the bottom ("Read it like this"). | The top row is something nobody controls. The inflation row holds returns fixed as typed, so it really measures growth after prices, the same uncertainty as the stock and bond rows. The nudges are round steps, not sized by real uncertainty (the module README lists that as "Ideas / not yet"). |
| F3 | Sensitivity (no savings) | "When Sam retires moves your plan the most". 7 of 9 rows read $0 at both ends. "When Social Security starts: at 70 $0, at 62 $1,410." | A floor effect: the plan can pay $0, so nothing moves it, and claiming at 62 looks better than 70 only because it fills a two-year gap. Will the money last? and Goal seek both say "We don't know yet" for the same plan. Three pages, two stories. |
| F4 | Goal seek (short) | Six cards. Five are marked "needs a change": spend $8,430, retire at 73, save $3,100 a month, **"The return it needs: 7.4% a year, 1.6 points more than the 5.8% you assume"** with an "Assumptions ›" button, and $312,310 short today. The sixth, claiming at 70, is marked "room to spare". | The return is shown as a fix that sits beside the real choices and has a button. This is exactly the "fix it by raising the return" trap. |
| F5 | Your plan (no savings) vs Will the money last? | Your plan: "About $8,900 a year builds up in checking and savings." Will the money last?: "the plan adds nothing to savings before you retire." | This is the owner's "maybe we're not assuming that the extra money that built up in savings is actually invested". The engine drops it (see 0.5). |
| F6 | Retirement contributions (no savings) | A good one-question card: "Does Sam's job have a retirement plan with a match? … would add about $1,440 a year." | The right fix exists, but the retirement answer does not send the person to it as "check this first". The guess for a contribution (E13 in the guesses README) is deliberately left at nothing when joining is unlikely, which is honest. It still has to be asked. |
| F7 | Assumptions | Ten boxes, each with one plain line and "Default: X". "0 Changed from defaults". "3.9% Stocks after inflation". | Shows ours vs yours as a count only. No typical range, no effect on the answer, no presets. |
| F8 | Contributions and accounts | One contribution row points to one account. The account type decides the tax treatment (type `roth` is labelled "Roth IRA / 401(k)"). | A 401(k) split between pre-tax and Roth at one job needs two accounts. Nothing on screen says what the split changes. |
| F9 | Sensitivity, Goal seek, Chance | Heavy pages that read fine with data but sit behind outlined links. | Fine as "deeper" pages. They need one front door (4.9). |

---

## 2. How well-regarded planners show "what drives your result"

| Product | The headline | How a person checks or changes inputs | Defaults and assumptions | Source (date) |
|---|---|---|---|---|
| **Fidelity** Planning & Guidance Center | The share of estimated retirement costs covered, worked out for a "significantly below average market" (the 90% confidence level: only 1 in 10 simulated outcomes is worse). Zones: dark green 95+, green 80-95, yellow 65-80, red under 65. | Input tabs (accounts, savings rate, asset mix, time and expenses). Market toggles at 50%, 75% and 90% confidence. What-ifs are compared by saving PDF snapshots. | The 90% scenario is recommended for conservative planning. 250 simulations on historical returns. | Fidelity NetBenefits "About your score" (page © 1996-2024); The Finance Buff review (updated 2026-01-05) |
| **T. Rowe Price** Retirement Income Calculator | A "Confidence Score" (% of simulations that succeed) and whether you are above, in or below a **Confidence Zone**: 70-95% if 44 or younger, 80-95% if 45 or older. Income estimates are the 80th-percentile ones. | A **"Play Zone" on the results screen**: retirement age, living expenses, saving amounts, other income, allocation. Each change re-scores. | Inflation 3%, 500 simulations, money lasts to 95, Social Security from 70. | Methodology PDF (file dated December 2023); workplace methodology page (© 2026) |
| **Vanguard** Retirement Nest Egg Calculator | The probability your savings last N years. | Four sliders: balance, allocation, years, yearly withdrawal. | Historical returns, 100,000 simulations. A researcher noted it assumes fixed withdrawals and may understate stock risk. | Boston College CRR, Squared Away (2019-01-31) |
| **Empower** Retirement Planner | A likelihood of success, also described as low, medium or high. | "Adjust the sliders to see how changes affect your savings in real time." Side-by-side scenario comparison. | Not published in the sources found. | Empower flyer (2025); Empower, The Currency (2025-07-22); Rob Berger (2026-11-02) |
| **Boldin** (NewRetirement) | Chance of success from 1,000 Monte Carlo paths, framed as "a probability of needing to make adjustments", not a pass/fail grade. "A 70% score doesn't mean failure." | What-if scenarios. Toggles between **optimistic, average and pessimistic** return and inflation assumptions. Explorers (Social Security, Roth Conversion). A new what-if for "Investments: Future" is "Explore-only for now; Apply to Plan is coming soon". | One blended return per account (for example 6%); volatility set by the model. Article ranges: 5-8% nominal for most portfolios. | Boldin (2025-07-04, 2025-09-05, 2026-04-15); Boldin release notes (2026-09-24 entry) |
| **ProjectionLab** | Chance of success from up to 2,000 trials (or historical runs). Success thresholds and colours are user-set. | Plan-level and per-account growth rates. **Cash-flow priorities**: an explicit last step, "Save anything left over" (to cash) or "Spend anything left over" (shows up as discretionary spending). | The help page calls "Save anything left over" "a helpful default" but does not say it is preset. | ProjectionLab help, "How do I ensure extra income is saved or invested?" (updated 2026-07-28) |
| **MaxiFi** | No chance-of-success headline. "The highest annual spending level that your household income and assets can support" (a living standard in dollars). It argues that "an 80% chance of success means a 20% chance of going broke". | Scenario runs. | Consumption smoothing (an even spending level over the years). | MaxiFi, economics-based planning page (© 2025, read 2026-11-11); Rob Berger (2026-11-02) |

**Patterns worth copying**
- **One careful headline.** Fidelity uses the 90% level and T. Rowe Price the 80th percentile. The app's "in a bad run of years
  (only 1 in 10 is worse)" is the same idea in plainer words.
- **Change inputs on the results screen** (T. Rowe Price's Play Zone, Empower's sliders, Vanguard's sliders), so cause and effect
  are seen together.
- **Presets instead of a blank box for markets** (Boldin's three-way toggle, Fidelity's three markets). A layperson picks a
  stance, not a number.
- **Aim for a band, not 100%.** T. Rowe Price's 70/80-95% zone; the CRR article suggests aiming "in the 80 percent range";
  Boldin: "a 70% score doesn't mean failure". Rob Berger (2024-05-21): judge any score against its assumptions.
  In his example, 40% sounds bad until you see it assumes a 3% return and 6% inflation.
- **Make leftover money an explicit choice** (ProjectionLab).

**What none of them does**
None of them marks which inputs are the tool's defaults and which are the person's. None sizes its what-ifs by real uncertainty.
None stops "raise the return" from passing as a fix. None of the consumer tools found shows a ranked "what matters most" chart.
The search turned up no tornado chart in any of the seven, and this app already has one. Those four gaps are where this app can be
better than the paid tools.

---

## 3. What research says about laypeople deciding about money (dated)

| # | Finding | Source | What it means here |
|---|---|---|---|
| L1 | U.S. adults answer about half of basic personal-finance questions correctly (49%, flat since 2017). | TIAA Institute-GFLEC P-Fin Index (2025-05-29) | No "real return", "deferred" or "Monte Carlo" on screen. Say "after prices rise", "pay the tax later", "pretend futures". |
| L2 | Showing a retirement-income projection made employees more likely to change their contribution, and to raise it. The randomly assigned assumptions (retirement age, returns) moved saving; anchoring explains part of it. | Goda, Manchester and Sojourner, *Journal of Public Economics* 119 (2014) | The assumptions on screen are not neutral. They move behaviour. Pick them from sources and show where they come from. |
| L3 | A one-sentence anchor in a 401(k) email ("raise it by 1% / 10% of pay") shifted contribution rates by up to 1.4% of income. High anchors made people slower to act in the short run. | Choi, Haisley, Kurkoski and Massey, *Journal of Economic Behavior & Organization* 142 (2017) | Every example number is an anchor. Use small, sensible steps ("1% more of pay", "up to the full match"), never a high return as an example. |
| L4 | Defaults stick: automatic enrolment raised 401(k) joining from 37% to 86% for new hires. | Madrian and Shea, *Quarterly Journal of Economics* 116(4) (2001) | Our guesses and defaults will stick unless the person is asked to confirm them. "Our guess" must stay visible, and the ones that matter must be asked about. |
| L5 | About 1 in 4 savers missed part of the employer match, about $1,336 a year each (4.4 million participants, 2015). Half of older workers with a clear-cut case stayed below the match level, and an information mailing barely moved them. | Financial Engines "Missing Out" (2015-05-12); Choi, Laibson and Madrian, *Review of Economics and Statistics* 93(3) (2011) | The match is a top lever to check. Telling isn't enough: the card should do it ("Set to 6%, the full match").
| L6 | A numeric range lowered trust in a figure only slightly and did not lower trust in the source. A vague "there is uncertainty" hurt more. | van der Bles et al., *PNAS* 117(14) (2020) | Show ranges as numbers ("about $6,600 to $8,430 a month"), not as hedges. |
| L7 | On phones, quantile dot plots (outcomes drawn as countable dots) gave more consistent probability judgements than smooth density plots, and better decisions later. Counts ("1 in 10") are easier than percentages. | Kay, Kola, Hullman and Munson, CHI 2016; Fernandes et al., CHI 2018; Gigerenzer and Hoffrage, *Psychological Review* 102(4) (1995) | Keep "6 of 100 pretend futures". A 20-dot strip is the right picture if any is wanted. |
| L8 | Letting people sample simulated outcomes improved their recall of expected return and chance of loss, compared with numbers alone. | Kaufmann, Weber and Haisley, *Management Science* 59(2) (2013) | Showing outcomes as concrete examples ("in a bad run like 2000-2009 …") helps understanding. |
| L9 | "Probability of failure" frightens people. Telling them the adjustments in dollars ("if it falls to $740,000, spend $300 a month less") communicates better. | Tharp, Kitces.com (2022-06-29); Boldin (2025-07-04) | Effects in dollars a month or in years, not in % chance. |
| L10 | More options means less engagement: 401(k) joining was lower in plans offering many funds. | Iyengar, Huberman and Jiang, in *Pension Design and Structure* (Oxford, 2004) | 5 levers, not 11. Put the rest behind "More ›". |
| L11 | Progressive disclosure: put up front what people often need; more than 2 levels "typically have low usability". "Overview first, zoom and filter, then details on demand." | Nielsen, NN/g (2006-12-03); Shneiderman, IEEE Visual Languages (1996) | Two levels: the answer with its drivers, then the pages. |
| L12 | Investors expect long-run returns of 10.7% above inflation; advisers call about 8.3% realistic (21 countries, February-March 2025). | Natixis Individual Investor Survey (2025-06-11) | Laypeople lean optimistic, so a return box with no limits invites wishful thinking. |
| L13 | Professional forecasts, for reference: U.S. stocks 4.8-6.8% a year over 10 years, U.S. bonds 5.1-6.1% (Vanguard, as of 2026-09-30). U.S. large caps 6.7%, a 60/40 mix 6.4% (J.P. Morgan 2026 LTCMA, 2025-10-20). U.S. stocks 6.4%, inflation 2.1%, before fees (FP Canada/IQPF Projection Assumption Guidelines, in force 2026-04-30). FP Canada lets planners move within ±0.5% and says it is not prudent to raise returns to "force" a goal. History: the S&P 500 grew about 10.0% a year from 1928 to 2025, worked out from Damodaran's table (updated 2026-01-05). Social Security Trustees' middle inflation assumption: 2.4% (2025 report). | as cited | Gives the "typical range" line its sources (4.6). The app's 7% for stocks sits at or above the top of current 10-year forecasts, though well under history. That is for the owner to judge. The screen should say it plainly. |
| L14 | After employers added a Roth 401(k), total contribution rates did not change, so take-home pay fell. The authors point to confusion about, or neglect of, the accounts' tax treatment. | Beshears, Choi, Laibson and Madrian, *Journal of Public Economics* 151 (2017) | People don't see that $1 in a Roth is worth more than $1 pre-tax. Show balances after tax. |
| L15 | With future tax rates unknown, most savers do better with a mix of pre-tax and Roth. Roth wins when the tax rate later is higher than now. | Brown, Cederburg and O'Doherty, *Journal of Financial Economics* (2017); Vanguard, "A BETR approach to Roth conversions" (2022-03); Vanguard Roth-contributions paper (2025) | "Not sure? Some of each" is a sound default message. |
| L16 | Roth 401(k) is offered by 98% of Vanguard plans but used by 18% of participants (year-end 2025; it was 86% offered at year-end 2024). | Vanguard *How America Saves* 2026 and 2025 (2025-06-24) | Most people have the choice and don't use it, so a split control is relevant to most users. |
| L17 | From 2026, people over 50 whose 2025 FICA wages topped $150,000 must make catch-up contributions as Roth. A plan may let the match go into the Roth side; it is then taxed as pay in that year. | IRS Notice 2025-67 (2025-11-13); final rules TD 10033 (announced 2025-09-15); SECURE 2.0 §604 and Notice 2024-2 (2023-12-20) | The split control must know these two rules (4.8). |
| L18 | Tornado charts: no controlled study of laypeople reading them was found. A European drug-safety project (IMI PROTECT) lists their audience as "statisticians and regulators", "not for physicians and patients", and warns that unfamiliar users "may easily misunderstand". Bar charts are read better than pie charts. | IMI PROTECT "Tornado plot" page (undated, project 2009-2015); graph-format trials (BMC Medicine 4:33) | Keep the bars, but lead every bar with a sentence in dollars and cut to 5 rows. |
| L19 | People underestimate compound growth (exponential growth bias). | Stango and Zinman, *Journal of Finance* 64(6) (2009) | Say what a change does at the end ("+$670 a month in retirement"), worked out by the app. Never "1% more of pay" alone. |

---

## 4. Recommendations for this app

### 4.1 What a person who is short sees first (Will the money last?)
Order, top to bottom. The hero keeps today's sentences, rounded.
1. **The answer**, as now: "Runs out at 80" (or "Lasts to 95, with little to spare").
2. **One range in dollars:** "In a bad run of markets about $6,600 a month; in average ones about $8,430. You plan $11,000."
   Round to $100 or to 3 significant figures (F1).
3. **The new line:** "This rests on **5 numbers**. You typed 3; **we filled in 2**." When nothing is typed: "We filled in all 5."
4. **The page's one filled button:** "Check the 5 numbers ›" (about 2 minutes). It opens the "What it rests on" card below,
   already scrolled into view. On the path it is the new step (4.4).
5. Outlined, as now: "What would fix it? ›" (Goal seek) and "How sure is this? ›" (Chance).

Wireframe W1 (section 5) shows it.

### 4.2 Choosing the five, and the order
- **Measure.** Use the hero's own unit.
  - A plan that lasts, or is short but can still pay something: the steady spending a month in today's dollars. Sensitivity's
    measure already does this.
  - A plan that can pay under 10% of what it plans (Sam): "the age the money runs out", or simply show only the blanks (below).
    Any other measure floors at $0 (F3).
- **A sensible change per lever.** Size the step by real uncertainty, as the Sensitivity README already wants:

| Lever | Kind | Sensible change shown | Why this size |
|---|---|---|---|
| Saving into retirement at work | blank or yours | up to the full match; else +1% of pay | L3 (small anchor), L5 (the match) |
| Employer match | blank or our guess | the match the job really pays | L5 |
| Money left over each month | **blank** (not counted today) | "invested" vs "spent" | F5, 4.5 |
| Each guessed balance or rate | our guess | the guess's own spread (`plan.guesses[path].s`; C8's "If it's off …" line) | already built for Our guesses |
| How fast investments grow (after prices) | usual figure | careful or hopeful preset (about ±1 point) | L13 band |
| How fast prices rise | usual figure | 2.4% (Trustees' middle) vs 3% (ours) vs 4% | L13 |
| How long the money must last | usual figure | to 90 / 95 / 100 | SSA life tables (already the source) |
| Social Security paid in full | usual figure | 77% if the trust fund runs dry | Trustees 2025 (already used) |
| When you stop work | yours | +2 years | Sensitivity today |
| Spending in retirement | yours or our guess | −10% | |
| When you claim Social Security | yours or usual | at 70 (or at 67) | Sensitivity today |

- **Order of the five:**
  1. Blanks that count as zero but are likely not zero (no saving while working; leftover; match).
  2. Our guesses and untouched usual figures, ranked by effect.
  3. Choices, ranked by effect.

  Show a row only if its sensible change moves the answer by at least $100 a month (or 2%) or by 1 year. Cap the card at 5 rows,
  with "N more ›" folded underneath.
- **Count.** "We filled in N" counts our guesses plus usual figures the person never confirmed (`assumptions.reviewedAt` absent,
  or older than a year, as the Assumptions page already counts).
- **Cost.** One bisection per lever, one direction each, about 200 projections in all. That is cheap on a phone. The careful
  Monte Carlo figure stays on the hero only, worked out after the first paint as `careful.js` already does.

### 4.3 How one lever looks (anatomy of a card, one per row; records, never a table)
```
How fast investments grow          OUR FIGURE    <- tag: Yours / Our guess / Usual figure
7% a year (about 4% after prices)                 <- value now, plain units
Most forecasts: 5% to 7% for the next 10 years     <- typical range + "where from ›" in the fold
1 point lower: about $630 less a month            <- effect of the sensible change, in the hero's unit
[ Change ]                                        <- outlined; opens in place (one open at a time)
```
- Tags: **Yours** (typed), **Our guess** (from `plan.guesses`, existing word), **Usual figure** (an untouched default assumption).
  No colour on the tag: a guess never turns anything green, amber or red (existing rule).
- Opened in place, the card shows: the box, presets where they exist (4.6), "That's right" (filled), and "Type my own" (box).
  It is the same pattern as Our guesses' `saveField` / `confirmGuess`. After Save: `ui.notice("ok", "Saved: … The money now
  lasts to 86 (was 80).")`, kept in the module-level `pending` as the house pattern says.
- The effect line always names the direction and the size. It is a sentence the app worked out, never an AI number (AGENTS
  rule 5).

### 4.4 Where the check lives (no new walk)
The design log (2026-11-06) says: "Do not add a second menu, a stepper beyond the bar's track, or a new 'walk': a new step is a
step of the path."
- So add one path step, `check-retire` ("What it rests on"), between `retire` (Will the money last?) and `fix-retire` (Goal seek)
  in `overview/guide`. Its page is the "What it rests on" card: on Will the money last?, or as a small page of its own if the
  projection page is too long (it is 2,800 px).
- The check is one page of records, not a multi-screen wizard. Each lever opens in place.
- When every row is Yours or confirmed, the step is done. A before-and-after card then shows:
  "You checked 5 numbers. 2 changed. Before: runs out at 80. Now: lasts to 95, with little to spare."
- Then Next goes to Goal seek ("What would help").
- Blanks come first and are asked as questions, not numbers. For Sam:
  "Do you put money into a retirement plan at work?" [Yes, about _% of pay] [No] [Not sure]. "Not sure" leaves it blank and
  says what a typical match would add, as Contributions already does ("about $1,440 a year").

### 4.5 The leftover-money lever (the owner's "is the extra money actually invested?")
- **Make it a stated choice**, as ProjectionLab does: "Money left over each month ($746)" with three answers:
  - **Invested for later**: counted as savings growing with your mix.
  - **Stays in the bank**: counted as cash at the cash rate.
  - **Gets spent**: not counted. This is what the engine does today.
- **Until it is answered, show both answers** rather than silently picking one: "If the $746 left over is invested, the money
  lasts to 95; if it's spent, it runs out at 65."
- **Engine.** `retirement.js` keeps no leftover today (F5), so this needs a small change: put the chosen share of each working
  year's leftover into `taxable` or `cash`. Because it changes what the engine counts, it should be a new optional field (for
  example `retirement.leftover: "invest" | "cash" | "spend"`), documented in DATA_MODEL. No version bump is needed if absence
  means today's "spend".
- **Fill the cushion first.** Count as invested only what is left after the emergency fund reaches its target. Say so in the
  card's second line.
- **Check the leftover against what really happened.** This is a valuable insight, and the data is already there (account
  `history`, `netWorthHistory`, the monthly check-in). For example: "Your plan says $3,880 is left over each month, but your
  savings grew about $1,200 a month over the last 3 months. Some spending may be missing. Check Expenses ›". It matters because,
  on the invented family, counting their $3,884 a month as invested takes the plan from $8,430 a month and 6 in 100 futures to
  $16,140 and about 91 in 100 (Compare's engine, 400 pretend futures). A lever that strong must be checked against the bank.

### 4.6 Guardrails against "fixing" the plan by raising the return
1. **Goal seek.** Take "The return it needs" out of the cards marked "needs a change" and remove its "Assumptions ›" button
   there. Show it once, in grey, under the list:
   > "For the plan to work as it is, investments would have to grow 7.4% a year. Most forecasts for the next 10 years are lower
   > (U.S. stocks 4.8% to 6.8%). That isn't a choice you can make; the cards above are."
2. **Presets on Assumptions and in the check: Careful, Middle, Hopeful.** Each has a one-line source in the fold, for example:
   Careful 6% (near the middle of Vanguard's and FP Canada's), Middle 7% (what we use), Hopeful 8% (closer to the last 100
   years, which few forecasters expect again). The exact numbers are the owner's call; L13 has the sources. Typing your own stays
   possible (the owner wants control, PLAN.md §1).
3. **A typed return above the band** (more than about 1 point over the top preset) does three things:
   - an amber notice: "Higher than any forecast we know; plan on it only if you have a reason";
   - a "**on your hopeful return**" tag on every answer that uses it (the hero, Your plan, the Dashboard), like "Some of this
     rests on our guesses";
   - it can never turn a verdict green (the same rule as guesses).
4. **The headline stays the careful 9-in-10 figure.** A return change shows its effect on both lines ("average: +$770; in a bad
   run: +$X", the second from the careful figure), so it is seen as a bet on markets, not a fix.
5. **One lever for markets, not three.** On Sensitivity and in the check, "How fast your savings grow after prices" replaces the
   separate stock-return, bond-return and inflation rows for the main list. Today a 1-point inflation nudge with returns held
   fixed is a 1-point real-return nudge, so the same uncertainty is counted twice (F2). Keep inflation as its own row only on the
   deeper Sensitivity view.
6. **Fees.** FP Canada subtracts fees from the return before planning. Show "after fees" when holdings carry fund fees (`holdings[].expenseRatio`) or an advisory fee (`investments.advisoryFee`). Compare already has a fee lever.
7. **The same guardrail for "plan to age".** Below the SSA-table age that 1 in 4 people of that age outlive, show: "About 1 in 4
   people your age live past 92."

### 4.7 Sensitivity page changes
- **Gate it** like Will the money last? and Goal seek. When the plan can pay less than 10% of what it plans, say "We don't know
  yet …" or switch the measure to years (F3).
- **Lead with the biggest choice, then the biggest unknown:**
  "Stopping at 67 instead of 65 adds about $760 a month. The biggest unknown is how markets do: about ±$700 a month."
  Two groups: "Things you decide" and "Things nobody knows". Each row carries its tag (Yours / Our guess / Usual).
- **5 rows on screen, the rest behind "6 more ›"**, which brings the page from 2,522 px to about 1,200. "Read it like this" moves
  into the hero as one sentence.
- **Size the nudges by real uncertainty** (the README's own idea): the guesses' spreads, the market presets, the Trustees
  inflation figure.

### 4.8 Roth vs traditional for a layperson
- **Words.** "Pay the tax **later**" (traditional, pre-tax) and "Pay the tax **now**" (Roth). Never "deferred", "free" or "bucket"
  on screen; those stay in the README.
- **Per contribution row** (per person, per account): "When do you pay the tax on it?" [Later] [Now] [Some of each]. Some of
  each shows two boxes in % of pay or dollars.
  - The match is "Later". "Now" is offered only if the person says their plan allows a Roth match, with: "taxed as pay this
    year" (SECURE 2.0 §604; Notice 2024-2).
  - For someone 50 or over whose last year's pay topped $150,000: "From 2026, catch-up money must go in as Roth" (Notice
    2025-67). It is set and explained, not asked.
- **Data.** Today one row means one account. Either add an optional `rothShare` (0 to 1) on a contribution row, with the engine
  splitting it between deferred and free, or let one 401(k) account carry both sides. Either way it is an optional field, with
  the DATA_MODEL line in the same change.
- **One rule of thumb, one number:**
  - "Later lowers this year's tax by about $X." The tax engine works this out at the person's top rate; the AI never does.
  - "Now means that part comes out tax-free in retirement."
  - "If you expect a lower tax rate in retirement, later usually wins; higher, now wins. Not sure? Some of each is a sound
    choice." (L15)
- **Show balances after tax** (L14). For example: "Ana's 401(k) $86,000 (about $73,000 after tax)". Also "Your money at 65: 70%
  pay-tax-later, 20% already taxed, 10% regular savings". That is the "mix" insight advisers call tax diversification.
- **Deeper:** Withdrawal order and Roth conversions already exist. Link them as "Which account to spend first ›" and "Should
  some move to a Roth? ›" from this card. Boldin's Roth Conversion Explorer ("tests conversion amounts across many years and
  shows how each one changes your lifetime taxes", page © 2026) is the model for that deeper page, which this app already has.

### 4.9 Big picture first, then deeper
- **Level 1** (the big picture): Your plan's retirement row (exists), then Will the money last?'s hero and the "What it rests on"
  card.
- **Level 2** (deeper): the input pages (Contributions, Assumptions, Social Security, Expenses) and the analysis pages, offered as
  questions in one "Go deeper" card after the check:
  - "How sure is this?" goes to Chance the money lasts.
  - "What matters most?" goes to Sensitivity.
  - "What would it take?" goes to Goal seek.
  - "Try two plans side by side" goes to Compare.
  - "If history repeated" goes to Historical.
  No third level: each deeper page links back, not further down.
- **Deeper pages carry the same honesty.** A banner on each says "This rests on 2 numbers we filled in. Check them ›" until they
  are checked, so a deep chart never looks more certain than the inputs.
- **After the first setup**, the reveal already ends on "Then: your whole plan on one page". The first time the retirement row is
  short or rests on guesses, that row's "fixHref" should open the check, not Goal seek. Check before you fix.

### 4.10 Words (use / avoid)
| Use | Avoid |
|---|---|
| after prices rise | real, inflation-adjusted |
| how fast investments grow | rate of return, CAGR |
| in a bad run of markets (only 1 in 10 is worse) | 10th percentile, 90% confidence |
| pretend futures | simulations, Monte Carlo |
| pay the tax later / now | pre-tax / post-tax / tax-deferred / Roth bucket |
| our guess / usual figure / yours | default, assumption, input |
| what it rests on | sensitivity, drivers |
| lasts to 95 / runs out at 80 | success, failure, probability of success |

### 4.11 Connecting accounts and statements (pointer only; another lane)
For this lane the UX point is narrow. The check (4.4) is where a statement would plug in: "Have your 401(k) statement? Read it
from the PDF ›", using the existing Statement reader on the PC. It fills the box, and the person taps "That's right"; the AI
fills a box but never applies a number (AGENTS rule 5). Even Boldin lists account linking as "Coming soon". Its Document Vault,
where "Boldin AI can then parse and reference these files", shipped 2026-09-17 (release notes). Upload-to-confirm is a normal
pattern, not a gap.

### 4.12 What not to do
- No new global CSS, no new walk or stepper (design log 2026-11-06), no second filled button on a screen.
- No AI-made numbers in effect lines.
- Do not undo the Assumptions page's round-17 choice (one plain line, "Default: X", sources in one fold). Add to it: the range
  line, the effect line and the presets.
- Do not show 11 bars on the answer page. Do not put "raise the return" among the fixes.

---

## 5. Wireframes (390 px, about 42 characters a line; [ ] = outlined button, [[ ]] = the one filled button)

### W1. Will the money last? when short: the answer, then what it rests on
The figures are real outputs of the app's own engine for the invented family with spending raised to $11,000 a month
(Sensitivity and Compare, average markets).
```
+------------------------------------------+
| =  Will the money last?        Sandbox   |
+------------------------------------------+
| Runs out at 80                           |
| You plan $11,000 a month. A bad run of   |
| markets pays about $6,600; average ones  |
| about $8,400.  (short)                   |
|                                          |
| This rests on 5 numbers.                 |
| You typed 3; we filled in 2.             |
| [[   Check the 5 numbers  (2 min)  >  ]] |
| [ What would fix it? > ]                 |
| [ How sure is this? > ]                  |
+------------------------------------------+
| What it rests on                         |
|                                          |
| Money left over each month   NOT COUNTED |
| $3,880 a month - is it invested?         |
| Invested: lasts to 95 and beyond         |
|                         [ Answer ]       |
| ---------------------------------------- |
| How fast investments grow   USUAL FIGURE |
| 7% a year, about 4% after prices         |
| 1 point lower: about $630 less a month   |
|                         [ Change ]       |
| ---------------------------------------- |
| What you save for retirement       YOURS |
| $1,570 a month, match included           |
| $390 more: about $670 more a month later |
|                         [ Change ]       |
| ---------------------------------------- |
| When Ana stops work                YOURS |
| 65.  At 67: about $760 more a month      |
|                         [ Change ]       |
| ---------------------------------------- |
| When you claim Social Security    USUAL  |
| 67.  At 70: about $390 more a month      |
|                         [ Change ]       |
|                                          |
| 6 more numbers >                         |
+------------------------------------------+
```

### W2. One lever opened in place: how fast investments grow (with guardrails)
```
+------------------------------------------+
| How fast investments grow   USUAL FIGURE |
|                                          |
| Nobody knows this. We use 7% a year for  |
| stocks before prices rise: about 4%      |
| after them.                              |
|                                          |
|  ( ) Careful   6%   most forecasts       |
|  (o) Middle    7%   what we use          |
|  ( ) Hopeful   8%   closer to the past   |
|                                          |
| What it does to your answer              |
|  Careful   about $7,800 a month          |
|  Middle    about $8,430 a month          |
|  Hopeful   about $9,200 a month          |
|  (average markets; you plan $11,000)     |
|                                          |
| A higher number doesn't make markets     |
| pay more. Fix the plan with what you     |
| control: saving, when you stop, spending.|
|                                          |
| [[         Keep Middle (7%)          ]]  |
| [ Type my own number ]                   |
| Where these come from >                  |
+------------------------------------------+
```
Typing 10 shows an amber `ui.notice`: "Higher than any forecast we know. Your answers will say 'on your hopeful return', and none
will turn green on it."

### W3. Retirement contributions: one row, pay the tax now or later
```
+------------------------------------------+
| =  Retirement contributions              |
+------------------------------------------+
| Ana - 401(k) at work                     |
| 6% of pay, plus her job's match          |
|                                          |
| When do you pay the tax on it?           |
|  [ Later ]  [ Now ]  [ Some of each ]    |
|                       ^ chosen           |
|  Later (pre-tax)     4 % of pay          |
|  Now (Roth)          2 % of pay          |
|  Match from work     Later               |
|                                          |
| This year: paying later on the 4% lowers |
| your tax by about $X. The 2% comes out   |
| tax-free when you retire.                |
|                                          |
| Which is better? If you expect a lower   |
| tax rate when retired, later usually     |
| wins; higher, now wins. Not sure? Some   |
| of each is a sound choice.               |
|                                          |
| [[               Save                ]]  |
| Which account to spend first >           |
+------------------------------------------+
```
$X comes from the tax engine at Ana's top rate. After Save: "Saved: Ana puts 4% in pre-tax and 2% in Roth. Your money at 65:
68% pay-tax-later, 22% already taxed."

Mini sketch for the no-savings case (Sam), the first record on the check:
```
| Saving for retirement at work      BLANK |
| Your plan counts $0. Is that right?      |
| A typical 5% plus a half match:          |
| the money lasts (about $2,850 a month,   |
| you plan $2,650).                        |
| [ Yes, about __% of pay ] [ No ] [ Not sure ]
```
(The figures are the engine's for the invented Sam, through Compare's extra-saving lever: 5% of $48k plus a 50% match, $300 a
month in all, which lasts in about 6 of 10 pretend futures. At 6% plus the full half match, $360 a month: about $3,050, 7 of 10.)

---

## 6. Suggested build order (small, shippable slices)
1. Gate Sensitivity like the other two pages, and take "the return it needs" out of Goal seek's fixes (copy and logic only; small).
2. The leftover choice plus its engine change, with the bank-balance check (biggest effect on answers; optional field).
3. The "What it rests on" card on Will the money last?:
   - a pure compute that ranks levers;
   - effect lines reusing Sensitivity's nudges and the guesses' spreads;
   - the path step `check-retire` and the before-and-after card.
4. Market presets with sources on Assumptions, plus the "hopeful" tag and the no-green rule.
5. The Roth split on contribution rows, balances after tax and the mix line.
6. Sensitivity rework: two groups, 5 rows, uncertainty-sized nudges, one markets lever.

Each slice needs a formula line in the module README, a test per formula (AGENTS rules 3 and 8), a catalog row for any new page
or step, and a phone screenshot with `tools/shot.mjs`.

---

## 7. Sources (all read 2026-11-11 unless dated otherwise)
- Fidelity NetBenefits, "About Your Score" (page © 1996-2024): https://nb.fidelity.com/public/nb/default/resourceslibrary/articles/WorkspaceAboutYourScore
- H. Sit, The Finance Buff, "Fidelity Retirement Planning Tool: High-Level Model, Not Tactical" (updated 2026-01-05): https://thefinancebuff.com/fidelity-retirement-calculator-review.html
- T. Rowe Price, Retirement Income Calculator methodology (PDF, file dated Dec 2023): https://www.troweprice.com/content/dam/iinvestor/Forms/retirement-income-calculator-methodology.pdf
- T. Rowe Price, workplace "Methodology and Assumptions" (© 2026): https://www.troweprice.com/workplace/en/participant/home/methodology-and-assumptions.html
- K. Blanton, CRR Squared Away, "How Long Will Retirement Savings Last?" (2019-01-31): https://crr.bc.edu/squared-away/how-long-will-retirement-savings-last/
- Empower, "How much do I need to retire? Why one number isn't the whole story" (2025-07-22): https://www.empower.com/the-currency/money/how-much-do-i-need-to-retire
- Empower, Personalized Web Experience flyer (PDF, 2025): https://www.empower.com/client/ducks/resources/docs/Personalized-Web-Experience-Flyer.pdf
- R. Berger, "4 Best Retirement Calculators" (2026-11-02): https://robberger.com/best-retirement/
- R. Berger, "Decoding the 'Chance of Success' in Your Retirement Plan" (2024-05-21): https://robberger.com/decoding-the-chance-of-success-in-your-retirement-plan/
- Boldin, "Understanding Boldin's Monte Carlo Simulation" (2025-07-04): https://www.boldin.com/retirement/understanding-boldins-monte-carlo-simulation-what-it-is-why-it-matters-and-whats-new/
- Boldin, "Beyond Chance of Success" (2025-09-05): https://www.boldin.com/retirement/assess-your-financial-health/
- Boldin, "What rates of return should you use for retirement planning" (2026-04-15): https://www.boldin.com/retirement/what-rates-of-return-should-you-use-for-retirement-planning/
- Boldin, release notes (entries 2026-08-04, 2026-09-17, 2026-09-24): https://www.boldin.com/retirement/release-notes/
- Boldin, Roth Conversion Calculator (page © 2026): https://www.boldin.com/retirement/roth-conversion-calculator/
- ProjectionLab help, "How do I ensure extra income is saved or invested?" (updated 2026-07-28): https://projectionlab.com/help/invest-extra-income
- MaxiFi, "Economics-based planning" (© 2025): https://www.maxifi.com/why-maxifi/economics-based-planning
- D. Tharp, Kitces.com, Monte Carlo guardrails and probability of adjustment (2022-06-29): https://www.kitces.com/blog/monte-carlo-guardrails-probability-of-adjustment-success-client-communication-dynamic-retirement-spending/
- J. Nielsen, NN/g, "Progressive Disclosure" (2006-12-03): https://www.nngroup.com/articles/progressive-disclosure/
- B. Shneiderman, "The Eyes Have It", IEEE Symposium on Visual Languages (1996): https://www.cs.umd.edu/~ben/papers/Shneiderman1996eyes.pdf
- Goda, Manchester and Sojourner (2014), J. Public Econ. 119:80-92; NBER w17927: https://www.nber.org/papers/w17927
- Choi, Haisley, Kurkoski and Massey (2017), JEBO 142:378-395; NBER w17843: https://www.nber.org/papers/w17843
- Choi, Laibson and Madrian (2011), REStat 93(3):748-763; NBER w11554: https://www.nber.org/papers/w11554
- Financial Engines, "Missing Out" (2015-05-12): https://www.businesswire.com/news/home/[number removed]/en
- Madrian and Shea (2001), QJE 116(4):1149-1187
- van der Bles, van der Linden, Freeman and Spiegelhalter (2020), PNAS 117(14): https://core.ac.uk/download/[number removed].pdf
- Kay, Kola, Hullman and Munson, "When(ish) is My Bus?", CHI 2016: https://idl.uw.edu/papers/when-ish-is-my-bus ; Fernandes et al., CHI 2018: https://idl.uw.edu/papers/uncertainty-bus
- Gigerenzer and Hoffrage (1995), Psychological Review 102(4):684-704
- Kaufmann, Weber and Haisley (2013), Management Science 59(2):323-340: https://econpapers.repec.org/RePEc:inm:ormnsc:v:59:y:2013:i:2:p:323-340
- Iyengar, Huberman and Jiang (2004), "How Much Choice Is Too Much?": https://business.columbia.edu/faculty/research/how-much-choice-too-much-contributions-401k-retirement-plans
- Stango and Zinman (2009), Journal of Finance 64(6)
- TIAA Institute-GFLEC P-Fin Index 2025 (2025-05-29): https://gflec.org/wp-content/uploads/2025/05/2025_05_29_PFIN-Index-Release_FINAL.pdf
- Natixis IM, Individual Investor Survey 2025 (2025-06-11): https://assets.im.natixis.com/content/dam/natixis/website/about/newsroom/press-releases/2025/2025-06-11-intl-natixis-ims-Individual-investor-survey-2025.pdf
- Vanguard, VCMM 10-year return forecasts (as of 2026-09-30): https://corporate.vanguard.com/content/corporatesite/us/en/corp/vemo/vemo-return-forecasts.html
- J.P. Morgan AM, 2026 LTCMA release (2025-10-20): https://am.jpmorgan.com/us/en/asset-management/adv/about-us/media/press-releases/jp-morgan-releases-2026-long-term-capital-market-assumptions/
- IQPF and FP Canada, 2026 Projection Assumption Guidelines (in force 2026-04-30): https://institutpf.org/en/communique/linstitut-de-planification-financiere-et-fp-canada-et-publient-les-normes-dhypotheses-de-projection-2026 ; deviation-margin and "force a projection" text (edition with data to December 2024): https://www.fpcanada.ca/docs/default-source/standards/2024-pag---english.pdf
- A. Damodaran, historical returns 1928-2025 (updated 2026-01-05): https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html
- SSA, 2025 Trustees Report, economic assumptions (CPI 2.4% intermediate): https://www.ssa.gov/OACT/TR/2025/V_B_econ.html
- Beshears, Choi, Laibson and Madrian (2017), J. Public Econ. 151:84-95; NBER w20738: https://www.nber.org/papers/w20738
- Brown, Cederburg and O'Doherty (2017), "Tax Uncertainty and Retirement Savings Diversification", Journal of Financial Economics
- Vanguard, "A BETR approach to Roth conversions" (2022-03): https://corporate.vanguard.com/content/corporatesite/us/en/corp/articles/betr-way-assess-roth-ira-conversions.html ; Vanguard, Roth contributions paper (2025): https://workplace.vanguard.com/content/dam/inst/iig-transformation/insights/pdf/2025/Roth-contributions-retirement-planning-final.pdf
- Vanguard, How America Saves 2025 key trends (2025-06-24): https://corporate.vanguard.com/content/corporatesite/us/en/corp/articles/how-america-saves-2025-key-trends-insights.html ; How America Saves 2026 coverage: https://www.napa-net.org/news/2026/6/plan-design-drives-record-retirement-participation-better-outcomes-vanguard/
- IRS, final Roth catch-up regulations (2025-09-15): https://www.irs.gov/newsroom/treasury-irs-issue-final-regulations-on-new-roth-catch-up-rule-other-secure-2point0-act-provisions ; Notice 2025-67 threshold $150,000 (2025-11-13): https://www.plansponsor.com/what-is-the-wage-threshold-requiring-roth-catch-ups-in-2026/
- IRS Notice 2024-2 on SECURE 2.0 §604 Roth employer contributions (2023-12-20): https://kpmg.com/us/en/home/insights/2023/12/tnf-notice-2024-2-guidance-provisions-secure-act-2.html
- IMI PROTECT, "Tornado plot" (undated): https://imi-protect-eu.cc.ic.ac.uk/tornadoplot.html

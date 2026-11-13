# Your plan  (`overview/plan`)

**Status:** usable
**Purpose:** Your whole plan on one page: each answer in one plain sentence, which figures are our guesses, and what to do next.

The owner asked (2026-11-06): "when a layman clicks on something to go navigate it, at the end of it, there should be a way
to go to the next part and the next part and the next part, right? It should be very easy to follow a set of steps to go from
point A to point B, where point B is the final plan with everything in it and all the result pages." This page is B. A is
Get started; the way between is the path: overview/guide's `plan` journey, with Next at the end of every page
(`overview/guide/frame.js`, path mode). Spec: the path build spec of 2026-11-06 (revision 2).

## Inputs
Plan sections read (`needs`): accounts, household, income, expenses, debts, debtPlan, goals, retirement, taxes, insurance,
whatIfs, assumptions, guesses, guide, reviews.
`compute(plan, { today, off })`: `off` is the list of pages turned off or hidden on this device; a row whose page is off is not drawn.

## B quotes; it never works out a figure
Each row's figure and words come from the function the result page uses for its own top answer, so the two never disagree
(the test compares them on four households). This file adds no formula of its own.

| row | page | source |
|---|---|---|
| What you own, minus what you owe | balance/net-worth | `standing()` netWorth, assets, liabilities, netWorthGuessed (overview/setup) |
| Your month | cashflow/expenses | `standing()` spare, spareWaits, drawing, bank |
| Your debts | debt/payoff | `answerFor("debt")` (overview/quick); a guessed rate from `standing().guessed` |
| Your cash cushion | balance/liquidity | `standing()` runway, runwayTarget, runwayStatus, runwayWaits, cushionLater |
| Cover for your family | insurance/life-needs | `protectionGaps()`, or the "No one depends on my pay" mark |
| Your retirement | retirement/projection | `answerFor("retire")` (headline, line, verdict, shortAge); `standing().retireGuessed` |
| What would help | scenarios/goal-seek | no figure: goal seek is heavy and stays on its own page |
| Where to take money from | retirement/withdrawal-strategy | `firstYear()` |
| The yearly amount the law requires | retirement/rmd | `thisYear()` |
| Your goals | goals/goals | goals compute and `goalsBehind`, worded by `goalsWords` (words.js) |
| The home you can afford | goals/house | `maxPrice` |
| College costs | goals/education | the children's totals |
| This year's tax | taxes/federal | `answerFor("taxes")` |

No heavy simulation runs here (Monte Carlo, stress tests, goal seek and the health score stay on their own pages and in
Plan summary; the test reads this file's imports). Life-needs is heavy-marked but Next best action already runs it.

## Outputs
`{ head: { state: empty | going | complete, ready, title, lede, step, total, doneCount, next, name, inShort, gaps, firstGap }, groups: [{ title,
rows: [{ key, label, value, line, short, status: ok | warn | bad | calm | open, guessed, href, figure, note, needs, fixHref }] }],
moves, guesses, guessCount, notCounted, assumptions, checkIn: { due, next, nextName }, madeOn, someGuessed }`.
- A row shows when its step applies (guide/compute.js `resultOrder`) and its page is not off. "What you own, minus what you
  owe" and "Your goals" also show whenever there is data.
- `status`: ok (green), warn (amber), bad (red), calm (grey: information, or a figure that rests mostly on our guesses),
  open (a gap: "Not worked out yet: needs ...").
- A row that rests mostly on guesses is never warn or bad (`mostlyGuessed`).
- `head.inShort` joins up to three rows' `short` phrases, the red ones first, then amber, then green; it ends "Some of this
  rests on our guesses." when one of those rows is `guessed` (the tax row is until the paycheck's tax is typed).
- `head.ready` is true only when the steps are all done and no row is open. With a gap the title is "Your plan is not
  finished yet" (no check mark, no "ready"), "What to do next" says to fill the gaps first, and the closing "You're done for now"
  lines are left out (review of the first build: an empty plan that skipped every question read "ready" and "Nothing urgent").
- The cushion row has no bare figure while its bills are mostly our guesses ("isn't known yet", like its page); the month row
  says "Spending is our guess (about $X a month). Add your pay to see what is left." when only the pay is missing; the cover row
  is grey "Not checked yet" until the life insurance step is passed; the retirement row drops the page's "(Will the money last? shows
  how much less)" pointer.
- Rows that open a setup screen end in `?back=done&from=plan`: setup's Back ("‹ Your plan") and Save lead back here.
- `words.js` holds what is shared with the path: `goalsWords` (the Dashboard builds the same sentence inline today),
  `protectionAsks` (life-needs' first test, for the path's "Cover for your family" step), `guessList` and `notCounted` (what the
  questions' last screen used to list).

## The page
Head (one filled button in every state: Let's go; Continue: <step>; Fill in the first gap; or, when complete and a check-in is
due, Start the <Month> check-in; else Go to my dashboard), the three groups, What to do next (`standing().moves`), Make it fit you
better (three guesses, then the page with all of them), What we're counting on (folded; "These sound fine" calls setup's
`applyGuesses`), Keep it up to date (the monthly check-in, Plan summary for a copy to print, Timeline), and the end.

## Edge cases
An empty plan (the intro and Let's go); a path under way; complete with gaps (a step whose page waits); a household that
is retired (the retirement steps instead of the saving ones); a page turned off (its row and step are left out).

## Tests
`module.test.mjs`: the numbers agree with the result pages for four households, calm rows, `inShort`, the guess list, banned
words, imports, and the A-to-B walk in pure code (taps from an empty plan to this page).

## Ideas / not yet
- The Dashboard could import `goalsWords` from here (or from overview/alerts) instead of building the line inline.
- A row for Medicare, Social Security and stress tests as links, not steps.

## Path part 3, review fixes
- The retirement row reads "Not known yet" (calm; not a gap, so the plan is not held unfinished) when Quick answers' retire answer has `verdict: "unknown"` (`savingsUnknown` in retirement/projection).

## Follow-up, 2026-11-07 (workflow wfu1; tests `tests/followups-*.test.mjs`)
- A cushion at or above its target reads "Cash for 18 months of the bills you have to pay, well over the 6 you want." and "cash for 18 months, well over the 6 you want" in In short, never "18 of 6 months". The row is named "Emergency fund" (the page's name), with the path step; `ROWS` is exported for the test.

## Wording follow-up (2026-11-07, claude-b lane B)
- The Emergency fund row says "a bit over" or "well over" the months wanted by `overTarget` (`core/words.js`, 1.5 times the target); see Get started's README.

## Wording follow-up, final check (2026-11-07; test `tests/wording-verify.test.mjs`)
- The goals row says the Dashboard's sentence: "1 reached; 1 goal behind (it needs about $120 more a month)", parts joined by a semicolon (w017).
- No cash at all is said in words: "No cash set aside yet for the bills you have to pay. Aim for 6 months." and, in In short, "no cash set aside for bills yet (the aim is 6 months)" (it said "about 0 months").
- A tax answer that starts with a person's name keeps its capital in In short ("Bo owes about $1,785; Ana gets about $2,200 back", filing separately).
- A plan that only just lasts reads "the money only just lasts" in In short ("..., the money only just lasts and you owe about $4,300 in April"); it read "the money lasts, just and you owe". The row's figure stays "It lasts, just".

## Review 2026-11-11 round 5 (claude-r N21)
- The empty plan's "Set up my plan ›" opens the questions' intro (`#/overview/setup`), as the Dashboard's and `firstStep()`'s do; it opened Question 1 (`#/overview/setup/you`).

## Our guesses, biggest first; the left-over says what it waits for (C5 follow-ups, 2026-11-13; hand-off rows H2, C2)
- **Make it fit you better** lists every guess in use (`guessesInUse`). The month's own figures lead: our pay, then our
  spending (what the left-over waits for, and what the Dashboard and Needs attention ask for first; critic F4: the spending,
  nearly all of the month's outgo, had come after a card and a 401(k) balance). Then a big one before a small one, in the
  order Our guesses for you lists them (each estimator's `tier * 100 + order`; the guesses' and setup's estimators merged, as
  the Dashboard's `bigGuessInUse` does). Get started's own rows keep their words and stand for the guesses they hold (the
  spending rows, a home's value, each debt's figures, Social Security from pay); every other guess is one row in Our guesses
  for you's words with its figure: "Sam's pay before tax: about $69,000 a year", "Spending: about $4,030 a month", "Credit
  cards: still owed about $2,400, ...", "Your retirement savings at work: about $42,000", "House down payment goal: about
  $43,000". A row that opens one of Get started's questions comes back here (`?back=done&from=plan`). The page shows the
  first three.
- **What to do next**, while the left-over waits on our pay (`spareWaitsOn` "pay" or "both"), starts with "Type your pay"
  ("Your pay is our guess for now, and what is left each month waits for it."), opening the pay question, as the Dashboard,
  Get started's tile and Needs attention ask it (critic F3); Get started's own moves follow ("Type what you really spend" when
  the spending is ours too), three in all. Get started's own move list (`standing().moves`, setup's file) still starts with the
  spending: that is for setup's owner.
- **Your month**, while the left-over waits on our guesses, says what it waits for (`standing().spareWaitsOn`): "Your pay is our
  guess for now, so this waits for yours. With our guess, about $1,370 spare."; "Your pay and most of your spending are our
  guesses for now, ..."; or, as before, "Most of your spending is our guesses, ...". With the pay ours the row opens the pay
  question (a row's builder may give its own `href`).

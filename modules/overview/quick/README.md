# Quick answers  (`overview/quick`)

**Status:** usable
**Purpose:** Questions you can answer in a minute with your own numbers, with nothing to set up first.

The owner asked (2026-10-31) for a way to "start picking an option of what you want to do (calculator / financial plan /
etc...) then guide". This page is the "calculator" door: a list of questions, each opening the page that answers it.
Get started (`overview/start`) links here; so does search ("calculator", "quick answer").

## Inputs
The view passes `off` (the pages switched off or not ready on this device) and `today`. For the three questions that
need the plan's numbers, the plan itself is read through the answer pages' own computes (`retirement/projection`,
`debt/payoff`, `taxes/federal`), so the manifest's `needs` lists their sections.

## Outputs
`compute(plan, { off, today })` -> `{ mostAsked: [{ key, icon, title, line, href }], more: [...], answers: [{ guide, icon,
title, key, headline, line, status, href }], needsFirst: [{ guide, icon, title, line, href }] }`. `answerFor(guide, plan,
params)` -> `{ headline, line, status }` or null.
Rows open `#/<key>?from=quick`, so the page shows a "‹ Quick answers" bar on top and "Another question?" at the bottom
(drawn by the step-by-step guides' frame, `overview/guide` `frame.js`).

## What is listed (the rule, tested)
- The page gives an answer on an **empty** plan. A sweep of every usable page on an empty sandbox at 390 px (2026-10-31)
  sorted them; pages that open with "It needs ... first" or a wall of $0 are not quick (the test's `NOT_QUICK_YET`).
- The page saves **only** calculator inputs (`whatIfs`), insurance quotes (`insurance`), or a goal through its own
  "Make it a goal" button (`ALLOWED_WRITES`, read from each manifest's `writes`). A page that saves records other pages
  count (a sale into this year's tax, an account into net worth, a trip into events) would quietly turn "nothing to set
  up" into set-up, so Capital gains, Crypto, Trips, Vehicles, Rental, Federal estimate and similar stay in their guides'
  "More on this" folds and in the menu. Goals itself is left out for the same reason: its answer appears only after
  Add, which saves a goal.
- The bar on a page opened from here repeats the question ("How much home can I afford? Type your own numbers below.";
  a question's `hint` replaces the second sentence where there is nothing to type, as on Market risk). The pages that open with example figures already say so in their own words, so the bar does not repeat it.
- Three questions need the plan's own numbers (will the money last, when am I debt-free, this year's tax). When the
  plan already answers one (2026-11-01, the owner's experience list: "the app already has the answers ... but sends
  people to setup steps"), it is shown at the top under "Your plan already answers" with the answer itself, in the
  answer page's own heading and first line ("The money lasts", "Debt-free by March 2039", "About $15,072 of federal
  tax for 2026"), and opens that page; the page's bar says the answer comes from the plan. The questions it cannot
  answer yet stay under "Questions that need your numbers first" and open the matching step-by-step guide.

## Choices made (no owner input; noted per the builder instructions)
- "Start with these" instead of "Most asked" (asked by whom?), and one flat "More questions" card instead of topic
  folds with one or two rows each.
- "Not here? Search by a word" opens the menu with the cursor in its search box (`ctx.openSearch()`), not All pages,
  which is about 23 phone screens long.
- No filled button: the page is a list of choices.

## The tax answer (2026-11-02)
"What will I owe in tax this year?" answers with the April bill or refund first ("Owe about $5,602 in April"), from
`taxAnswer` in taxes/withholding, and the year's tax and what the paychecks take out in the line. It used to headline the
year's whole tax ("About $15,072 of federal tax"), which read like a $15,072 bill. With business income the year's tax
includes self-employment tax and the line says "self-employment tax included" in place of the overall rate.

## Sources
GOV.UK start pages and NN/g on task-based navigation (pick by what you want done); NerdWallet's and Vanguard's
calculator hubs (a question per row, not a tool name). Research notes: the build session's `competitors.md` and
`guidance.md` (not in the repo).

No retirement answer before Social Security is known (`retirementKnown`, 2026-11-02): `answerFor("retire")` is null
and the guide's own line shows, as the Dashboard says "Needs Social Security".

## Tests
`module.test.mjs`: at most 8 rows to start with, no page twice, titles are questions; every row is a usable page that
answers on an empty plan and writes only `ALLOWED_WRITES`; the guide rows name real guides; `quickHref`, `questionFor`,
and pages in `off` are left out.

## Ideas / not yet
- Make the debt, retirement, paycheck and emergency-fund pages answer on an empty plan (example figures saved under
  `whatIfs.<page>`, as Home affordability does); then list them here.
- Search that understands questions across all pages (aliases on the existing manifests).

## Retirement line (round 5, 2026-11-02)
"The plan carries $X" is the average-market figure: the line now says so ("if markets do as well as average ... less in a bad
run of years") and points to Will the money last?, which gives the figure that lasts in 9 of 10 markets (too slow to work out
on every page this line shows on). Review 2026-11-02: "carries $111,897 a year, less in a bad run of years" (the "a year" was
missing).

## Review 2026-11-06
- "What will I owe in tax this year?", filing separately: each return settles on its own (withholding `byReturn` through
  `taxAnswer` `returns`), so the answer names who owes and who gets money back: "Bo owes about $1,660; Ana gets about
  $2,200 back" for the family with 3,750 each, where it said "About $540 back in April". Filing jointly, nothing changes.
  Test: "the tax answer, filing separately".

## Health cover (2026-11-02)
The retirement line says "You plan on $84,000 a year plus health cover" when Will the money last? adds its health line (marketplace cover to 65, then Medicare) on top of the spending figure, so the carried figure it quotes is read the same way there and here.

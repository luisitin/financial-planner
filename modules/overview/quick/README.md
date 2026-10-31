# Quick answers  (`overview/quick`)

**Status:** usable
**Purpose:** Questions you can answer in a minute with your own numbers, with nothing to set up first.

The owner asked (2026-10-31) for a way to "start picking an option of what you want to do (calculator / financial plan /
etc...) then guide". This page is the "calculator" door: a list of questions, each opening the page that answers it.
Get started (`overview/start`) links here; so does search ("calculator", "quick answer").

## Inputs
None from the plan (`needs: []`). The view passes `off`: the pages switched off or not ready on this device.

## Outputs
`compute(plan, { off })` -> `{ mostAsked: [{ key, icon, title, line, href }], more: [...], needsFirst: [{ guide, icon, title, line, href }] }`.
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
- Three questions need the plan's own numbers (will the money last, when am I debt-free, this year's tax). They are
  listed honestly under "Questions that need your numbers first" and open the matching step-by-step guide.

## Choices made (no owner input; noted per the builder instructions)
- "Start with these" instead of "Most asked" (asked by whom?), and one flat "More questions" card instead of topic
  folds with one or two rows each.
- "Not here? Search by a word" opens the menu with the cursor in its search box (`ctx.openSearch()`), not All pages,
  which is about 23 phone screens long.
- No filled button: the page is a list of choices.

## Sources
GOV.UK start pages and NN/g on task-based navigation (pick by what you want done); NerdWallet's and Vanguard's
calculator hubs (a question per row, not a tool name). Research notes: the build session's `competitors.md` and
`guidance.md` (not in the repo).

## Tests
`module.test.mjs`: at most 8 rows to start with, no page twice, titles are questions; every row is a usable page that
answers on an empty plan and writes only `ALLOWED_WRITES`; the guide rows name real guides; `quickHref`, `questionFor`,
and pages in `off` are left out.

## Ideas / not yet
- Make the debt, retirement, paycheck and emergency-fund pages answer on an empty plan (example figures saved under
  `whatIfs.<page>`, as Home affordability does); then list them here.
- Search that understands questions across all pages (aliases on the existing manifests).

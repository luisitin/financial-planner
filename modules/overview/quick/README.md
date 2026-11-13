# Quick answers  (`overview/quick`)

**Status:** usable
**Purpose:** Questions you can answer in a minute with your own numbers, with nothing to set up first.
**Writes:** `whatIfs.quickLast` only ("Will my savings last?", a what-if never counted in the plan).

The owner asked (2026-10-31) for a way to "start picking an option of what you want to do (calculator / financial plan /
etc...) then guide". This page is the "calculator" door: a list of questions, each opening the page that answers it.
Get started (`overview/start`) links here; so does search ("calculator", "quick answer").

## Inputs
The view passes `off` (the pages switched off or not ready on this device) and `today`. For the three questions that
need the plan's numbers, the plan itself is read through the answer pages' own computes (`retirement/projection`,
`debt/payoff`, `taxes/federal`), so the manifest's `needs` lists their sections.

## Outputs
`compute(plan, { off, today })` -> `{ mostAsked: [{ key, icon, title, line, href }], more: [...], answers: [{ guide, icon,
title, key, headline, line, status, href }], needsFirst: [{ guide, icon, title, line, href }] }`, plus `last` (the answer of
"Will my savings last?", below) only when `whatIfs.quickLast` holds both amounts, each above $0, so a plan without them reads byte for byte
as before. `answerFor(guide, plan,
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

## Health insurance (2026-11-02)
The retirement line says "You plan on $84,000 a year plus health insurance" when Will the money last? adds its health line (marketplace cover to 65, then Medicare) on top of the spending figure, so the carried figure it quotes is read the same way there and here.

## A retiree's tax answer leads with the hold-back (round 8 review, 2026-11-06)
- **The headline:** with Estimated payments' `holdBack` (tax on this year's IRA withdrawals, no paycheck), it is "Have
  about $X of tax held back from your IRA withdrawal by December 31". Tax held back counts as paid through the whole year
  (IRC 6654(g); Pub. 505).
- **The line:** it gives the year's tax, the rate as the Federal estimate says it, the amount that leaves nothing to pay in
  April, and the quarters as the other way.
- **Why.** The widow read "$2,676 of it is past due" here and "hold back" on two other pages.
- **Credits above the tax (round 8 fix, 2026-11-06).** When refundable credits are more than the tax, `taxAnswer`'s
  `totalTax` is 0 and the Federal estimate's rate is negative. The line said "About $0 of federal tax for 2026 (-1.9% of
  your income)". It now says "No federal income tax for 2026: the credits are about $1,510 more than the tax" (from
  `creditsBack`), or "the credits cover it". Bracket explorer words it the same way. Test: "credits above the tax read as no
  federal income tax".

## Two more questions (stress test 2026-11-11, A4)
"Do I have enough life insurance?" (guide protect; answer page insurance/life-needs: the first `protectionGaps` title and
sentence, else "Your family is covered" / "Nobody depends on one income") and "Am I saving enough?" (guide budget; answer page
overview/benchmarks: the saving-rate item's sentence, headed by its verdict). Adding "retire at" to core/search.js's plain words
for retirement/projection is wave 1's file.

## Simple first (gap commit 1.2 with opt C19, 2026-11-13)
What a person sees with nothing opened, top to bottom:
1. "Get a quick answer" and one sentence: "Pick a question and type your own numbers: nothing to set up first.", or, when
   the plan already answers some, "Your plan already answers the questions below; for any other, type your own numbers."
   followed by those answers (never folded: they are answers).
2. "Will my savings last?" in three boxes (below).
3. "Other quick questions": the first six rows, then one quiet row "5 more questions" (`rest()`, kind `more`); the old
   "More questions" card joined it.
4. "Questions that need your numbers first" (the guides), "Not here? Search by a word" (outlined) and the line
   "Everything stays on your own devices. Nothing goes to the cloud." (moved here from under the title, not deleted).

The one filled button is "See the answer". The first view, counted outside shut parts on the fake DOM: empty plan 417 words
before, 331 now; family 489 to 419; renterDebt 447 to 377; retiredCouple 456 to 367 (money figures unchanged: 0, 12, 8, 4).
Fewer words, not a shorter page at 390 px: the three boxes are a card the page did not have. Measured in a phone browser
(sandbox, 2026-11-13, critic g12 F3): the empty plan 1,987 px tall before, 2,006 now at 390 px wide (2,656 to 2,485 at 320);
the family's plan 2,291 to 2,399 at 390 (3,062 to 3,019 at 320). Builder chose:
- The plan's own answers stay above the three boxes: for a household with a plan they are the most useful rows, and the
  three boxes are still the first *question*.
- "Will my money last?" (the retirement guide's row) is left out of the guides card while the line under the three boxes
  links the same steps ("Set up my plan ›"), so the page does not ask the same question twice. Its question comes back when
  the guide is switched off.

## Will my savings last? (gap #2, 2026-11-13)
**By default.** Three boxes: "Saved for retirement" ($), "To take out each month" ($, in today's dollars), "For how many
years" as chips 20 / 25 / 30 / 35 years with "Type my own" (`choice()`; 30 is on). "More details (optional)" holds the
share in stocks (40% / 60% / 80%, 60% on, the rest in bonds) and the fee a year (None / 0.25% / 1%, None on), each with
"Type my own". One filled button, "See the answer". Once answered the answer leads, one written sentence per case:

| case | when | sentence (the design's example figures) |
|---|---|---|
| all | every stretch lasted | "In every 30-year stretch since 1928, $4,000 a month from $1,000,000 lasted." |
| most | 90% or more | "In 64 of 69 stretches of 30 years since 1928, $4,000 a month from $1,000,000 lasted." |
| often | 50% to under 90% | "It lasted in 48 of 69 stretches since 1928; in the rest it ran out early." |
| seldom | under 50%, not none | "In most stretches since 1928, $4,000 a month ran out before 30 years." |
| never | none | "In every stretch since 1928, $4,000 a month ran out before 30 years." |

Under it: "The hardest start was 1966: it ran out after 19 years." (or "...in the first year."), or when every stretch
lasted "Even starting in 1966, the hardest year, $117,000 was left." Never folded: "This leaves out Social Security,
pensions and taxes. Your plan counts them: Set up my plan ›" (the retirement guide; "See your plan's answer ›" to Will the
money last? when the plan already answers it). After a save the green line names the new answer: "Saved. It lasted in 52
of 69 stretches." / "...in all 69 stretches." / "Saved. It ran out in all 69 stretches."

**On request** (one card of three rows under the answer, `parts()`):
- "3 more numbers" (kind `more`): "Up to $3,100 a month lasted in every stretch."; "In the middle stretch, $975,000 was left
  after 30 years, in today's dollars." (or "In the middle stretch, it lasted with nothing left after 1 year." / "...the money
  ran out before 30 years."); "69 stretches of 30 years, the first starting in 1928 and the last in 1996."
- "The figures" (kind `figures`, status the two amounts, at most 20 characters, else the savings alone): the same form,
  shut until the person opens it; it stays open after a save made inside it (R17). Its S11 tests compare every part after
  each save (See the answer, a years chip, a mix chip): only The figures (and "More details (optional)" for the mix)
  differs; a 0 or an empty box says "Use $1 or more." at that box, opens only the part around it, and saves nothing
  (through a recording stand-in for `ui.fieldError`, whose own opening is tested in `tests/ui-kit-helpers.test.mjs`).
- "How this is worked out" (kind `how`, "4 steps"): the loop below with the person's own figures, what it leaves out, and
  where the years come from.

**Saving.** "See the answer" writes `whatIfs.quickLast = { saved, monthly, years, stocks, fee }` and nothing else. Before
the first answer a chip is held on the page (the shell keeps the typing in the two boxes across the redraw) and goes with
"See the answer"; once there is an answer a chip saves at once, so the answer always matches the chips on screen.
"More details (optional)" opens by itself when the mix or the fee is not the page's own ("1 filled in"), after a chip in it,
and when this phone shows every box in forms. The chips' rows carry `data-no-keep`: the box "Type my own" opens saves on
change, and the shell's typing memory (core/place.js) names a form by its boxes, so a box opening inside the form left the two
amounts' typing under an old name, said after See the answer as a stale "Not saved yet ... Undo my typing" line (critic g12
F1, seen with any "Type my own" box, not only after an error).

**Formulas** (`compute.js`: `lastInputs`, `runStretch`, `safeMonthly`, `savingsLast`, `lastCase`, `lastWords`, `roughly`):
```
windows = 98 - N + 1                       (one per start year s with s + N <= 98; 69 for N = 30)
for each window s:  B = saved; W = 12 x monthly
  for k in 0..N-1:
    B = B - W                              (taken at the start of the year)
    if B < 0: it ran out in year k+1 (it paid k years); stop
    r = stocks x S&P[s+k] + (1 - stocks) x bond10[s+k] - fee
    B = B x (1 + r) / (1 + CPI[s+k])       (today's dollars)
case: all / most (>= 90%) / often (>= 50%) / seldom (> 0) / never
hardest = the window that ran out soonest (earliest start on a tie); if all lasted, the one with the least left
median left = the middle ending balance, a window that ran out counting as 0; under $0.50 it is said as "lasted with
  nothing left" when at least half the windows lasted (2 x lasted >= windows), else "ran out" (critic g12 F2)
"Up to": bisection in $10 steps between $0 (always lasts) and just over saved / 12 (fails in year 1), since B falls as W rises
shown figures for what is left: to the nearest $1,000 from $10,000, else to $10 (they are estimates)
```
Missing figures read as the page's own: 30 years, 60% stocks, no fee; years are held to 1..98, shares to 0..100%.
An amount of $0 (saved or taken out) is no answer: there is nothing to test, so both boxes ask for $1 or more (the kit's
words at the box, "Use $1 or more.") and `lastInputs` returns null (critic g12 F2: "$0 a month from $0 lasted" read as one).

**A hand example** (test 1): a three-year history 2000 (stocks +10%, bonds 0, prices 0), 2001 (-20%, +5%, +2%), 2002 (+30%,
0, 0), half stocks, $100,000 saved, $1,000 a month. 2000-01: 88,000 x 1.05 = 92,400; 80,400 x 0.925 / 1.02 = 72,911.76.
2001-02: 88,000 x 0.925 / 1.02 = 79,803.92; 67,803.92 x 1.15 = 77,974.51. Both last; the most that lasts both is $3,960 a
month (2001 binds at 47,557.84 a year); at $4,000 a month 2001 cannot pay its second year (1 of 2: "often").

**Sources** (read 2026-11-13):
- The years: Aswath Damodaran, NYU Stern, "Historical Returns on Stocks, Bonds and Bills: 1928-2025", updated January 5,
  2026 (pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/histretSP.html): S&P 500 with dividends, 3-month T-bill,
  10-year Treasury bond; CPI from the same spreadsheet. The bundled `modules/retirement/historical/data/returns.js` matches
  the page's 1966 row (stocks -9.97%, bonds 2.91%) and its 2025 row (17.78%, 7.80%). Free with attribution; facts, no code.
- The fee chips: NerdWallet, "How Much Does a Financial Advisor Cost?" (nerdwallet.com/article/investing/financial-advice-cost,
  updated 2026-10-26): an adviser's average fee 0.96% of assets a year (Envestnet's 2026 State of Financial Planning Fees, as
  the article cites it); robo-advisers (on screen "an investing app") 0.25% to 0.50%. The chips are 0.25% and 1%.
- The design: FIRECalc (firecalc.com, read 2026-11-13: spending, portfolio and years in, how often the plan held up across
  historical start years out; its data run from 1871). Reference only, no code (it is not open source). Shiller's years
  before 1928 are not used here: If history repeated and this answer share Damodaran's 1928-2025.
- Taken at the start of the year is this page's choice, said in "How this is worked out".

**Tests** (`module.test.mjs`, "gap #2"): the hand example and the two real 97-year stretches; 98 - N + 1 windows; $0 always
lasts; more than the savings fails in year 1; the safe amount lasts in every stretch and $10 more fails one; a higher fee
never lasts in more stretches; every case's sentence, second line, green line and the three numbers; the defaults and
limits; the empty form shows no answer; See the answer writes only `whatIfs.quickLast`; the answer leads and the boxes fold
into The figures; a save inside The figures keeps it open and moves no other part; a chip before an answer is held, after
one it saves; the manifest writes only `whatIfs`; the invariance test (with no `quickLast`, compute() over the four fixture
plans and every qa household type reads byte for byte as before, and adding it changes nothing but `last`). Critic g12:
$0 in either amount is no answer and See the answer saves nothing; the middle stretch that lasted with nothing left is not
said to have run out; the "Type my own" boxes are outside the typing memory, the form's kept boxes stay the two amounts;
a year of your own reads "Yours: 1 year", not "1 years".

**Not yet.** Social Security, a pension, taxes, and spending less after a bad year belong to the whole plan (Will the money
last?); this page points there instead of growing those boxes.

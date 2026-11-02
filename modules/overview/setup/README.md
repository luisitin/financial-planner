# Set up my plan  (`overview/setup`)

**Status:** usable
**Purpose:** A few friendly questions, one per screen, that put your household, pay, accounts, debts, spending and
goals in the plan, then show where you stand and your first three moves.

The owner, on 2026-11-01, after seeing Get started and the step-by-step guides on a phone: "It does not look INSANELY
user friendly and experience focused." Before this page, "Start my plan" opened Net worth with a six-field form. Here
the plan is built the way Monarch, Copilot and YNAB start, and the way TurboTax runs its interview: one question per
screen, in plain words, with big tiles and big money boxes. Every answer is saved on Continue, in the same shapes the
real pages write, so each page shows it afterwards. The page ends with a reveal: your money on one page.

## The screens
Address: `#/overview/setup/<screen>`, so the phone's Back button works. Get started's "Let's go" goes straight to `you`;
`welcome` shows only when the page is opened some other way.

| # | screen | asks | saves |
|---|---|---|---|
| | `welcome` | nothing: three things you get, three promises (about 5 minutes, rough numbers, stop any time), the privacy line. Once finished: "Change an answer", a list of the seven questions with what the plan holds for each | |
| 1 | `you` | first name; just me / me and my spouse / me and my partner; partner's name; children who live with you more than half the year (stepper); state | `household.people` (`setup-self`, `setup-partner` with `relation`, `setup-kid-N`), `filingStatus`, `state` |
| 2 | `money` | per adult: I work (pay before tax, how often, with "That's about $X a month" as you type) / I'm retired (a pension a month) / not working now; other money a month and its kind | `income` (`setup-pay-<person>`, `setup-pension-<person>`, `setup-other`) |
| 3 | `ages` | per adult: birth month and year, when you'd like to stop working (or already retired), Social Security (estimate it / my statement figure / I already get it / I won't get any; a retiree under 62 sees "Not yet: I have my statement figure" first); children's birth years | `birthDate`, `retirementAge`, `retirement.socialSecurity`, `income` (`setup-ss-<person>`) |
| 4 | `have` | tiles: checking, savings, retirement, investments, a home, a car | `guide.setup.picks.have` |
| 4b | `have-amounts` | about how much in each; retirement per adult with through work / on my own, a month from pay, the employer's match | `accounts` (`setup-have-<kind>`, `setup-have-retire-<person>`), `retirement.contributions` (`setup-contrib-<person>`) |
| 5 | `owe` | tiles: credit cards, car loan, student loans, mortgage, another loan, or "No, I'm debt free" | `guide.setup.picks.owe` |
| 5b | `owe-amounts` | cards first: "Do you pay the whole bill every month?"; then how much you owe, the payment a month, the rate if you know it; with a mortgage and no home in the plan, what the home would sell for | liability `accounts` (`setup-owe-<kind>`), `debts` (`setup-debt-<kind>`), `setup-have-home` |
| 6 | `spend` | a typical month in rows (must-pay, with the loan payments shown read-only, and everything else, with subtotals) or one rough total; the total with its parts; then "once you stop working, about how much a month?" | `expenses` (`setup-x-<category>`, `setup-x-total`), `retirement.spendingMonthly` |
| 7 | `goals` | tiles: a safety cushion, paying off debt, buying a home, retiring well, education, a big trip, a car, something else | `guide.setup.picks.goals`, `guide.setup.focus` |
| 7b | `goal-details` | how much and by when (1, 2, 3, 5 years or a date); the cushion: how many months (1 to 12) | `goals` (`setup-goal-<kind>`), `assumptions.emergencyMonths` |
| | `done` | where you stand (four figures; one not known yet links to the question that fills it), your first three moves, what is not counted yet, the plan's guesses | `assumptions.reviewedAt` ("These sound fine") |

Follow-up screens (4b, 5b, 7b) show only when their question needs them (`SCREENS[].show`), and count half a step on the
bar. An address whose screen no longer applies (5b after "debt free") moves on to the next screen that does
(`resolveScreen`), with `history.replaceState` so Back does not loop.

**Moving around (view.js).**
- **Enter** (the phone keyboard's Next) moves to the next box and never submits the screen; the last box says Done and
  closes the keyboard. Only the Continue button moves on.
- **Back** (the ‹ at the top and "‹ Back") goes back in the browser history when the screen was reached by Continue from
  the one before (the history entry carries `suFrom`); otherwise it replaces the address, so the phone's Back never
  walks forward through the questions.
- **What you typed and did not save** is kept while you go Back and forth (`drafts`, per screen, dropped once the plan
  changes or the end is reached).
- **"?back=done"** (from Change an answer or a figure's "Add them" link): the button says Save, there is no Skip, and
  saving returns to where you stand (through the question's follow-up screen when it now needs one).
- **Finish later** saves and goes to Get started. If an account had to be kept ("Kept Checking: it has transactions"),
  it stays on the screen once so that is read.
- **A low pay** (a working adult's pay under $15,000 a year) is asked about once before moving on: "$4,500 a year is low
  for a job. If that's what comes in each month, tap A month." Continue again keeps it.

## What the setup writes (the rules)
1. **Its own ids.** Every record it makes has an id starting `setup-`, so going back and changing an answer updates the
   same record and never adds a second one.
2. **Only the asked fields on a record that exists** (`put`). A checking account renamed on Net worth keeps its name; a
   raise set on Income keeps its growth; money a month set on Goals stays. The full record is written only when new.
   Fields the screen shows rounded come back unchanged when the box was not touched: a Roth set on Net worth stays a
   Roth (a type in the chosen kind's group, work: 401(k) or Roth, own: IRA or Roth, is kept); a yearly match typed on
   Contributions stays when its month, rounded, is what the box shows; an Income type set on Income (investment) stays
   unless a kind is picked; a rate typed on Liabilities stays when the box shows it (rates are shown and saved to a
   thousandth of a percent, so 6.875% works); a payment stays when its whole dollars are what the box shows.
3. **A kind the plan already has is not asked.** Accounts of that type (`existingHave`, `existingOwe`), pay on Income
   (`existingPay`), bills in those categories (`spendRows`), a goal like it (`existingGoal`): the screen shows them as
   "Already in your plan" and the setup adds nothing of that kind. This applies to kinds made elsewhere first: once
   the setup has made its own (`askOwners`, `oweTaken`, `goalTaken`, a `setup-x-` bill, `setup-pay-`), a second record
   of the same kind added later on its own page never makes the setup drop its own. Retirement is per adult: only
   adults without an account of their own are asked. A household typed on People is left alone; only the state is
   saved.
4. **Nothing another record points at is removed** (`referenced`). An account the setup made is removed when its tile
   is unticked or its box cleared, unless one of these points at it: transactions, imports, holdings, reconciliations,
   rules, import profiles, a goal's `fundedBy`, a Liabilities row, a retirement contribution (made elsewhere),
   `debtPlan.customOrder` or `mortgageAccountId`, `property[].accountId` or `loanAccountId`, `contacts[].accountIds`,
   `estate.beneficiaries[].accountId` (the places `docs/DATA_MODEL.md` names an account id). Then it stays and the
   screen says "Kept Checking: it has transactions. Remove it on Net worth." A person (the partner, a child) stays the
   same way when Income, Net worth, contributions, pensions, insurance, estate papers, a pasted Social Security
   record, an annuity, work stock, investment sales, gifts, a beneficiary line or a saved college plan name them
   (`personReferenced`); otherwise removing the partner removes their pay, pension, Social Security, retirement account
   and saving in the same change.
5. **A blank box saves nothing**: it never becomes 0. Two blanks get a marked guess instead, so the figure is not
   missing from the sums: a debt's rate (a typical rate, `rateGuessed`) and its payment (a typical payment,
   `paymentGuessed`). Both are named on the last screen. "Skip this question" never deletes anything.
6. **A Continue that changes nothing saves nothing** (`wouldChange` runs the writer on a copy and compares), so going
   back and forward makes no saves, backups or audit lines. `guide.setup.at` only moves forward (the furthest screen
   reached), so Back never moves "pick up where you left off".

## Inputs
`needs`: household, income, accounts, debts, expenses, goals, assumptions, retirement, guide.
`compute(plan, { today, screen })`.

## Outputs
`{ screens: [{ id, q }], progress: { started, finished, at, q, total, share }, standing (on "done" only) }`.
`standing(plan, { today })` = `{ netWorth (null while the plan has no accounts), assets, liabilities, spare, runway,
runwayTarget, runwayStatus, drawing, saved, retire: { verdict, shortAge } | null, retirementKnown, retirementMissing,
moves: [{ id, title, detail, href }], later: [{ label, href, key }], headline, guessed: [{ name, rate, payment }],
homeMissing }`.
`ssMissingFor(plan)` (2026-11-01): the adults with no Social Security figure who have not said they get none; the retirement
pages' notice (`modules/retirement/ss-notice.js`) reads it and its "won't get Social Security" button saves the same
`guide.setup.ss[personId] = "none"` as the ages screen. A figure typed later wins over that "none": `valuesFor("ages")` shows it
as "statement", so going through the ages screen again keeps it.

## Formulas and sources
- **Pay a year** = amount x periods a year (`core/math/periods.js`: 52, 26, 24, 12, 1). The live line under the box:
  a year's pay / 12 ("That's about $6,000 a month"), or a month, two weeks... x periods ("That's about $54,600 a year").
- **Social Security, "estimate it for me"** (`estimateSocialSecurity`): the method of SSA's Quick Calculator
  (ssa.gov/OACT/quickcalc, "How the Quick Calculator works"): earnings before this year are assumed to have followed
  the national average wage index, so each past year = today's pay x AWI(year) / AWI(latest); from age 22; the same pay
  until the age you stop (capped at full retirement age); then the app's own benefit formula
  (`retirement/social-security` `estimateBenefit`: 35 best indexed years, the bend points, the full-retirement amount,
  in today's dollars). AWI from `retirement/social-security/data/ssa.js` (SSA's published series). The figure this
  setup wrote is kept in `guide.setup.ssWrote`: it follows the pay each time the ages screen is saved, a figure typed
  on the Social Security page since is never replaced, and while it is still the estimate the last screen says so
  ("the statement at ssa.gov/myaccount is exact").
- **Already getting it**: full-retirement amount = payment now / claim factor at the age it started
  (`claimFactor`: 5/9% a month for the first 36 months early, 5/12% beyond; 8% a year delayed; SSA, "Early or Late
  Retirement?"), so the projection and Social Security pages work from the same base. The age it started runs from 62
  to the person's age today (at most 70); it starts at full retirement age for someone past it, else at today's age.
  Before 62 the payment can only be disability or survivor benefits (SSA, "Disability Benefits" and "Survivors
  Benefits": paid unreduced), so it is saved as the full-retirement amount, from full retirement age.
- **Birth date** saved as the 15th of the month (only the month and year are asked): a mid-month day, so no rule that
  turns on the exact day fires by accident (Social Security, for one, reads a birthday on January 1 as the year before:
  the note on ssa.gov's "Benefit reduction for early retirement" table). People keeps the exact day editable.
- **Typical rates** for a blank rate box (`TYPICAL_RATES`, all read 2026-11-01). Saved on the Liabilities row with the
  guess in `rateGuessed`; the rate counts as guessed while it still equals it (`rateIsGuess`), so a rate typed later on
  What you owe is never overwritten, and the end of the setup says which rates are guesses:

  | debt | rate | source |
  |---|---|---|
  | credit cards | 22.36% | Federal Reserve G.19 Consumer Credit, release of October 7, 2026, commercial bank interest rates, credit card plans, accounts assessed interest, August 2026 (preliminary) (federalreserve.gov/releases/g19/current) |
  | car loan | 7.17% | same G.19 release, new car loans, 72-month, August 2026 (preliminary) |
  | another loan | 11.90% | same G.19 release, personal loans, 24-month, August 2026 (preliminary) |
  | mortgage | 7.24% | Freddie Mac Primary Mortgage Market Survey, 30-year fixed, week of October 29, 2026 (freddiemac.com/pmms). A loan taken out in an earlier year may cost less: the screen asks for the real rate |
  | student loans | 6.52% | studentaid.gov, "Interest Rates for Direct Loans First Disbursed on or After July 1, 2026, and Before July 1, 2027", Direct Subsidized and Unsubsidized, undergraduate |
- **Typical payments** for a blank payment box (`typicalPayment`), so a debt's cost is never left out of spending, the
  cushion and the left-over figure (a $0 payment would drop out of all three): a loan's level payment over a usual term,
  P x r / (1 - (1 + r)^-n) with r = rate / 12 (`pmt` in `core/math/finance.js`), n = 360 months for a mortgage (the
  30-year loan Freddie Mac's survey quotes), 60 for a car loan, 120 for student loans (the 10-year Standard
  Repayment Plan for federal loans made before July 1, 2026; loans made since fall under the Tiered Standard plan,
  10 to 25 years by the amount borrowed: U.S. Department of Education fact sheet "Simplifying Student Loan
  Repayment", read 2026-11-01, so a large newer balance may really pay less a month), 36 for another loan; cards, a common minimum: the month's
  interest plus 1% of the balance. A rule of thumb the app chose, not a law: card issuers set their own minimums.
  Saved with `paymentGuessed`; a guess while the payment still equals it (`paymentIsGuess`). It follows what is owed
  and the rate until a real payment is typed. 300,000 at 7.24% over 360 months = 2,044 a month.
- **Loan and card payments** are not written as an expense: Expenses counts the Liabilities rows' payments itself when
  no expense is filed under "Loan and card payments" (its F-019 rule), so the total is right either way and nothing is
  counted twice. The spending screen says "Leave out loan and card payments: we already have them ($2,120 a month)
  and add them to the total below", shows them as a read-only must-pay row (so its subtotal is the cushion's must-pay
  figure), and writes the total's parts under it ("$3,780 here + $2,120 loan payments").
- **Mortgage payment and escrow**: the payment box asks for the whole payment, tax and insurance in it included; the
  housing row then asks only for what the payment does not cover (HOA fees, tax or insurance paid separately), so
  escrow is not counted twice.
- **Must-pay** spending: the row's group (must-pay or everything else), matching the Expenses categories' own
  `essential`. One rough total is counted as must-pay: safer for the cushion.
- **Spending once you stop working**, the first figure (`retireDefault`), to $10: today's bills a month without
  childcare and loan payments, plus the payment of each loan still being paid when the first adult stops work (months
  to payoff at its payment, `nper` in `core/math/finance.js`, past the months until then; a loan that never pays off at
  its payment counts too) (`loansAfterWork`). Without birth dates no loan is added. Saved as Retirement's own figure
  (`retirement.spendingMonthly`), which Will the money last? uses instead of today's expenses. While the box holds
  the screen's own figure (`guide.setup.retireAuto`), it follows the bills when you come back; once typed, it stays.
  Not asked when everyone is already retired (today's bills are retirement's).
- **The safety cushion** (`cushion`) = months x must-pay bills a month (Expenses' `essentialMonthly`, loan payments
  included), rounded to $100; with no bills yet, no amount (loan payments alone are not the bills; Emergency fund waits
  for expenses the same way), and the goal is made with a target of 0. Months default to the plan's emergency months
  (6) and are saved there too, so Emergency fund and the goal agree. The goal has no date (it is kept topped up, not
  reached once: no money a month is asked for it on Next best action), is marked `isEmergencyFund`, and is drawn from
  what Emergency fund counts as usable today: cash, checking and savings (`TIERS.now` in balance/liquidity). Its
  accounts and amount follow the plan while they are the ones this setup wrote (`guide.setup.cushionFunds`,
  `cushionTarget`); a choice made on Goals stays.
- **Filing status**: married filing jointly with a spouse; head of household for one adult with children at home
  (IRS Pub. 501: unmarried, paying more than half the cost of a home where a qualifying child lived more than half the
  year: the screen asks for "children who live with you more than half the year"); single for an unmarried couple
  (each files their own return). Set the first time and again only when the answer that decides it changes, so a
  status picked on Filing status stays.
- **Child support** coming in is saved as Income type `support` with `taxable: false` (IRS Pub. 504: child support is
  not income to the parent who gets it). Side work is `business` (in the first adult's name, so self-employment tax
  applies), rent is `rental`.
- **Where you stand** reads the pages' own computes, never its own math: Net worth (`netWorth`, "Not yet" while the
  plan has no accounts), Next best action (`spare.monthly`: pay after federal income tax and payroll tax, less
  spending, saving and goals; state tax is not in it, said in "Not counted yet" for states that tax wages), Emergency
  fund (`runwayMonths`), and Will the money last? (`verdict`), the last only once every adult has a birth date and
  Social Security (estimated, typed, a record, or "I won't get any") so a missing figure never reads as "short". What
  is missing is named exactly ("Social Security", "your birth date", or both). A negative net worth is neutral, not
  amber ("Grows as the loans shrink"); with a mortgage and no home it says the home's value is not in yet.
- **The sentence at the top** never contradicts the figures under it, checked in this order: someone retired drawing
  on savings ("You draw about $1,200 a month from savings ($414,000 saved)"); more out than in; costly debt as the
  first move; a cushion under the aim (never "your month works" without a left-over figure; when the first move is
  something else, "The move below comes first, then a bigger cushion", so the sentence and the button agree); retirement not on
  track; "You're in good shape" only when the month, the cushion and retirement are all fine; else "A few more answers
  will fill this in."
- **Your first three moves**: Next best action's first step not done (its own order, never re-ranked; "Then: your
  choice" left out), then a guide for what you said matters most (paying off debt, unless the first move already is;
  retiring well; buying a home), then Next best action's next steps. Someone retired spending more than comes in is
  living on savings, as planned: the retirement guide comes first and "Spend less than comes in" becomes "See how long
  your savings last". The words are plainer than on Next best action (`revealWords`): "Pay down the cards first" with
  each card's rate (and "(a typical rate: type yours on What you owe)" for a guess), "A retirement account of your own
  (an IRA)" ("for each of you" only for two adults), no "backdoor", "Put more into your 401(k)". A match step that is
  a question (a 401(k) and pay with nothing going in, 2026-11-02) reads "Check if Bo's job matches retirement saving"
  ("your job" for Me, "your jobs" for two), since the 401(k) may be an old job's or the job may not match; its page,
  Retirement contributions, answers it in one tap. The protection step (2026-11-02) reads "Get life insurance on Ana"
  ("Raise the life cover on Ana" when some is on file), and when it is the first move the headline says "Life cover for
  the people who count on you comes first. The moves below start there."
- **Not counted yet**: what no figure above already links to: state income tax; for an unmarried couple, federal tax
  as two returns (the federal estimate works one return for both today, so the left-over figure reads a little low);
  an estimated Social Security; each guessed rate and payment.

## The guide state (`plan.guide.setup`)
`{ at (furthest screen), startedAt, finishedAt?, picks: { have, owe, goals }, focus, who, status: { [personId]: work |
retired | none }, ss: { [personId]: estimate | statement | getting | none | unsure }, ssWrote: { [personId]: amount },
spendMode, paidInFull, retireAuto, cushionFunds, cushionTarget, homeFromOwe }`, optional, documented in
`docs/DATA_MODEL.md` under `guide`.

## Choices made (the owner said: decide and note it here)
- When the bank files show clearly more going out than Expenses lists (income-statement `bankVsPlan().over`), `standing`
  returns `bank`, the headline says the figures may be too rosy, and the first move is "Add what your bank shows to
  Expenses": every figure here comes from Expenses, so that comes before the plan's own order (2026-11-02).
- The left-over figure takes off the state's income tax once it can be worked out (Next best action's `spare.stateKnown`:
  a no-tax or flat-rate state, or a rate typed on the State page); the "not counted yet" line under the figures then goes,
  and the figure says "After tax". A graduated state with no rate typed is asked for by name (2026-11-02).
- A debt step a saved debt plan already pays off ("under way" on Next best action) is not a move: the moves skip it, and
  `standing` returns `debtExtra`, `debtOn` (the debt's name, two names, or "your debts") and `debtUntil`, so "Left over each
  month" says what the extra goes to (2026-11-02).
- Seven questions, follow-ups only when needed: the critics' newcomer persona gave up past about eight screens.
- Ages and Social Security share one screen (the stop-working age is what the estimate needs).
- No "already saved" box on a goal: the money is already in the accounts you typed, so asking again counted it twice.
- An unmarried couple is planned as one household with two single returns; the federal estimate today works one
  return for the household, said in "Not counted yet" (a follow-up is posted on the WORKBOARD for taxes/federal).
- A mortgage's typical rate is today's new-loan rate, which may be higher than an older loan's; the guess is marked
  and named on the last screen.
- A blank payment gets a typical one rather than nothing: an understated month is worse than a marked guess.
- The home's value is asked beside the mortgage when the plan has no home, rather than sending the person back to
  question 4 (`guide.setup.homeFromOwe` marks a home made there, so the box keeps showing it).
- The low-pay question fires under $15,000 a year: below full-time pay at the federal minimum wage ($7.25 x 2,080
  hours = $15,080; the federal rate under the Fair Labor Standards Act, unchanged since July 24, 2009: FRED series
  STTMINWGFG from Department of Labor data, 2026 value, read 2026-11-01), where a month's pay with "A year" left on is the likely
  slip. It asks once and never blocks.
- How often stays "A year" by default (an offer letter's figure); the live line shows the month it means.
- Get started's "Let's go" skips the welcome screen: that page already says what the welcome would.

## Edge cases
Empty plan (every screen works, the first screen makes "Me"); every question skipped (the end says "Your plan is
ready for numbers", no green, each figure links to its question); a household typed on People (left alone); accounts,
pay, bills and goals made elsewhere (not asked, not doubled), or added after the setup (the setup's own stay); a
referenced account or person (kept, with the reason); a card paid in full (no debt); everyone retired (no retirement
spending question, the ages question asks about Social Security only); a retiree under 62 (statement figure first;
"getting it" is disability or survivor pay); no birth date (no retirement check, no "already retired" age); a pasted
ssa.gov record (never overwritten); a debt with no payment typed (a typical payment, marked); a mortgage with no home
(the home's value asked).

## Tests
`module.test.mjs`: money boxes; the Social Security estimate against a record built by hand; filing status for each
household and kept when unchanged; removing the partner (and keeping one other pages use, a beneficiary line among
them); a household typed on People; pay, pension and other money with their types and names ("My pay"); ages, the
stop age rule and already retired; already getting Social Security (claim factor round trip) and under 62 (unreduced);
Social Security set on its own page kept, the estimate following the pay; a pasted record kept; accounts per kind and
per adult, 401(k) or IRA, contributions and match; kinds already in the plan not asked; a same-kind record added later
never removes the setup's own (a full Continue pass); fields set on the real pages surviving a Continue (Roth, yearly
match, Income type, a rate to the thousandth); referenced accounts kept; debts with typical or typed rates; typical
payments by hand (300,000 at 7.24% = 2,044) and a real one typed later; a mortgage with no home; loan payments counted
once; a rate typed later survives; a card paid in full; spending rows, existing categories, one total; retirement
spending, following the bills until typed, a mortgage still paid at the stop age; the cushion (no date, never
"behind", its money following the accounts, no amount without bills); goals and dates; an existing emergency fund;
going back updates only the asked fields; a Continue that changes nothing; follow-up screens and `resolveScreen`; the
furthest screen; where you stand (net worth sum, first move, no "your choice", guessed rates, state tax, the
dashboard's six steps done); the headline never contradicting the cards; a retiree living on savings; the moves in
plain words; what is not counted yet; retirement never "short" before Social Security is known; every typical rate in
this README with its source; the debt guide's rates step waiting for real rates and payments.

## cushionLater in standing (round 4, 2026-11-02)
`standing()` returns `cushionLater` (next-best-action's `{ until } | null`) when the runway is short, for the Dashboard's Safety cushion line.

## Ideas / not yet
- Bank file import as an alternative to typing balances ("I'd rather bring in my bank's file").
- Ask the payoff date of a car loan (`termMonths`) for a cleaner debt-free date.
- The federal estimate for an unmarried couple as two single returns (taxes/federal, see WORKBOARD).
- Split a mortgage's escrow (tax and insurance) out of its payment for the payoff math.

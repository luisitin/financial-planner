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
| 2 | `money` | per adult: I work (pay before tax, how often, with "That's about $X a month" as you type; under pay from an employer, "Retirement plan at work?" Yes / No / Not sure) / I'm retired (a pension a month) / not working now; other money a month and its kind | `income` (`setup-pay-<person>`, `setup-pension-<person>`, `setup-other`), `retirement.workPlans[<person>].plan` (No: and `match: false`), a $0 401(k) `setup-workplan-<person>` on Yes |
| 3 | `ages` | per adult: birth month and year, when you'd like to stop working (or already retired), Social Security (estimate it / my statement figure / I already get it / I won't get any; a retiree under 62 sees "Not yet: I have my statement figure" first); children's birth years | `birthDate`, `retirementAge`, `retirement.socialSecurity`, `income` (`setup-ss-<person>`) |
| 4 | `have` | tiles: checking, savings, retirement, investments, a home, a car | `guide.setup.picks.have` |
| 4b | `have-amounts` | about how much in each; retirement per adult with through work / on my own (then "Which kind of IRA?" Traditional / Roth / Not sure), a month from pay, the employer's match | `accounts` (`setup-have-<kind>`, `setup-have-retire-<person>`; "Through work" into question 2's `setup-workplan-<person>` when it is there), `retirement.contributions` (`setup-contrib-<person>`) |
| 5 | `owe` | tiles: credit cards, car loan, student loans, mortgage, another loan, or "No, I'm debt free" | `guide.setup.picks.owe` |
| 5b | `owe-amounts` | cards first: "Do you pay the whole bill every month?"; then how much you owe, the payment a month, the rate if you know it; with a mortgage and no home in the plan, what the home would sell for | liability `accounts` (`setup-owe-<kind>`), `debts` (`setup-debt-<kind>`), `setup-have-home` |
| 6 | `spend` | one box, "Your best guess for a normal month" (the grey guess in it); under "Split it up (optional)": the groups (bills you have to pay, with the loan payments shown read-only, and everything else, with subtotals), the health cover tap, and "once you stop working, about how much a month?"; the total with its parts under the box | `expenses` (`setup-x-<category>`, `setup-x-total`), `retirement.spendingMonthly` |
| 7 | `goals` | tiles: a safety cushion, paying off debt, buying a home, retiring well, education, a big trip, a car, something else | `guide.setup.picks.goals`, `guide.setup.focus` |
| 7b | `goal-details` | how much and by when (1, 2, 3, 5 years or a date); "Is any of your savings already for this?" (the cash accounts as pills, or None of it); the cushion: how many months (1 to 12), with what counts toward it | `goals` (`setup-goal-<kind>`, `fundedBy`), `assumptions.emergencyMonths` |
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
  Review 2026-11-02 (round 5, third pass): that before-62 answer also marks the entry `paidUnreduced: true` (with an
  amount or not, a pasted record or not; docs/DATA_MODEL.md), the only sign besides an Income line near the full-age
  figure that tells the Social Security page a benefit paid from 62 on is not a reduced early claim. Any other answer
  takes the mark off. From 62, the ages screen given back as it shows the plan (its "It started at age" stepper holds
  the age on file to 62..today's age, and the amount is setup's Income line) keeps the entry as it is: going through it
  again no longer turns Ana's disability benefit ($1,800, 67 on file) into a claim at 62 worth $2,571.40 at full age. A
  marked entry takes a new amount as its full-age amount while the age is left as shown; another age is a retirement
  claim from that age and the mark comes off.
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
spendMode, spendZero, paidInFull, retireAuto, cushionFunds, cushionTarget, homeFromOwe, goalFunds: { [goalKey]: [accountId] }
(question 7b's own links of cash to a goal), iraKind: { [personId]: traditional | roth | unsure } (question 4b's
answer) }`, optional, documented in
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
  Round 8 asks instead which of those accounts is already for the goal (`fundedBy`, never `saved`): the money is counted
  once, toward the goal, and Liquidity takes it off the cushion (its F-020 earmark), as it does for a link made on Goals.
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

## Who pays you (round 4, 2026-11-02)
"What comes in?" asks who pays the work: "An employer" (saved as a salary, as before) or "Myself: my business or freelance" (saved as business income, `setup-pay-<id>` with type "business", named "<name>'s business"). Before, a full-time freelancer was saved as an employee: Estimated payments led with a W-4 change and assumed thousands withheld from a paycheck that does not exist, and self-employment tax was counted only on side work. The help says to give a typical year when it changes month to month; business costs come later, on Small business. `WHO_PAYS` lists the answers; `valuesFor("money")` returns `by`. The record's name follows the answer while it is still the setup's own.

## Ideas / not yet
- Bank file import as an alternative to typing balances ("I'd rather bring in my bank's file").
- Ask the payoff date of a car loan (`termMonths`) for a cleaner debt-free date.
- The federal estimate for an unmarried couple as two single returns (taxes/federal, see WORKBOARD).
- Split a mortgage's escrow (tax and insurance) out of its payment for the payoff math.

## Paid by their own business (review 2026-11-02)
- Retirement savings start "On my own" for someone whose setup pay is business income (no employer plan); the hint names an
  IRA, SEP-IRA or solo 401(k), and the extra box asks what the business adds instead of an employer match "on your pay stub".
- The pay's name follows the answer also when the person was named or renamed in between ("My pay" becomes "Dee's
  business"): any name of the setup's shape (`My|<name>'s pay|business`) follows when the kind changes, and the setup's own
  names for someone not named yet ("My pay", "My business", "My spouse's pay", "My partner's business") follow a new name;
  a name typed on Income of another shape stays. Review 2026-11-02, round 5: "My ..." used to mean any name starting with
  "My", so "My wife's business" typed on Income became "Lena's business" when the money screen was saved again unchanged.
- When someone's setup pay is their own business, the money screen also asks "Estimated tax paid so far this year" (once
  for the household: the return is one). A typed amount is spread evenly over the quarters already due (taxes/estimated
  `QUARTERS`; the cents on the last one) and saved with `taxes.estimated.typedAt`, so Estimated payments, Needs attention
  and Next best action start from it. Blank writes nothing, and the pages ask later ("if none were made").

## Review 2026-11-02, round 5: a raise from a later date, and a lean month on the done screen
- **The pay question** (`valuesFor(plan, "money", { today })`, `applyMoney`) shows and changes today's pay:
  `payLineNow(income, personId, today)` is the setup's line (`setup-pay-<id>`, which keeps its id when Income splits it for
  a raise), or once the raise has started, the line that `continues` it. Before the start date a new answer changes today's
  pay and keeps the raise; after it, it changes the new pay and the pay that ended stays. `reflect(plan, "money", { today })`
  counts only the pay coming in today (it added both halves). Before (the first pass of this review), the setup's id moved
  to the raise: the question showed $66,000 for someone earning $60,000 and an answer overwrote the raise.
  The raise is the setup's own pay carried on (`setupRoot`: a `setup-` id, or `continues` one), so `existingPay` leaves it
  out: the screen still asks for the pay instead of "Already in your plan: Ana's pay $66,000 a year" (what the phone showed,
  with no box), and a cleared box or "Not working now" removes the setup's pay and the raise together, as does removing
  the person.
- **The done screen in a lean month**: `standing()` returns `lean: { full, about }` when the month is short only because
  Side income's "count on" holds part of uneven pay back (Next best action's `spare.held` above $0.50, not drawing in
  retirement): `full` = `spare.full`, `about` = `spare.fullAbout` (to the nearest $10). The headline then reads "Counting your
  uneven pay at what you can count on, more goes out than comes in. Good months make up for it; the moves below start with
  the lean months." (a full month still short: "... even when uneven pay brings its full amount. That's the first thing to
  fix ..."), and the left-over tile adds "That is a lean month: when all your uneven pay comes in, about $X is left" with
  "● Short in a lean month". The Dashboard shows the same sentence and figure (it had its own). Tests: `module.test.mjs`.

## Review 2026-11-02, round 5, second review: the line in force today, for every answer kept by a chain
- **The line Get started reads and writes** is `lineNow(income, setupId, today)`: of the setup record's chain (the line with
  that id and every line that `continues` it), the one going today (the setup's own first, else the one that started
  last); none going, the next to start; nothing to come either, the setup's own line, else the last to start; without
  `today`, the setup's own line, else the last to start. `payLineNow(income, personId, today)` is `lineNow` of
  `setup-pay-<id>`. The money screen (pay, pension, other money), the ages screen (Social Security already coming in),
  the estimated-tax question, the retirement screen's "On my own" start and "Your business adds" all use it. Before (the
  second review's data-loss finding): once the ended half of a split line was removed on Income, `payLineNow` found
  nothing, the box showed empty, and Continue deleted the pay still coming in (the chain is the setup's, so the clean-up
  removed it); typing the pay again made a second `setup-pay-` line beside it and doubled income ($11,000 a month for
  $5,500). Pension and other money read and wrote the half that had ended ($2,000 and $900 shown while $2,100 and $1,000
  came in, and an answer changed nothing that counts).
- **Writing never makes a second line** beside a chain: the answer goes on `lineNow`'s line in place (`amount`, how often,
  who pays; the name rule as before); a new `setup-` line is made only when the chain is gone. Clean-up keeps or removes
  whole chains by `setupRoot` (the `setup-` id a line is or continues), Social Security's included.
- **"Who pays you" changed** goes on to the chain's lines that start after the one changed (the raise still to come is paid
  the same way, its amount kept), with the setup's own names following as on the line itself, as Salary's `useAverage`
  does for growth. Changed to an employer, the careful figure (`countOn`) is dropped from those lines, as Income does
  when a line stops being business pay. A raise typed on Income as another kind on purpose is left alone while "who pays
  you" is not changed. Other money's kind picked anew goes on the same way. My choice: lines that ended stay as they were
  (they are what was paid).
- **Removing a person** (`personReferenced`): the setup's own pay and the raise that carries it on (`setupRoot`) do not keep
  them, so removing the partner removes both halves, as the first note above says; pay typed on Income for them still
  keeps them.
- **The money answer** (`reflect(plan, "money", { today })`): pay coming in today, as before; nothing today but pay that
  starts later, `{ monthly, from }` (what comes in from its first day; "About $5,000 a month before tax from January 4,
  2027"); every line ended, `{ monthly: 0, ended: true }` ("Nothing comes in now: the pay on Income has ended"). It used to
  return nothing, so "Change an answer" said "Not answered yet" for a question that was answered.
- **A full month within $5 of $0** (`lean.kind`, Next best action's `spare.fullKind`, Budget (50/30/20)'s `fullKind`):
  "ahead" reads as before, "even" says "only just about breaks even" (no "about $0"), and the headline is "Counting your
  uneven pay at what you can count on, more goes out than comes in, and a month that brings all of it only just about
  breaks even. That's the first thing to fix ...". `lean` is `{ full, about, kind }`.
Tests: `module.test.mjs` (the ended half removed, then Get started walked again; pension and other money after a start
date; Social Security; removing a partner with a raise; who pays you before a start date; the money answer when pay has
ended or starts later; a lean month that just about breaks even).

## Recheck 2026-11-05
- **A new amount for an unmarked benefit the Social Security page reads as unreduced** (`applyAges`, "getting" from 62).
  An entry without the `paidUnreduced` mark that the Social Security page reads as unreduced (paid before the claim age
  on file, and the old Income line pays at least 99.5% of `monthlyAtFRA`: that page's own test, read from its compute's
  `unreduced` on the plan as it stands before this answer) is now taken as the marked branch takes it: given back with the
  age as shown, a new amount is the new full-age amount (`monthlyAtFRA` = the amount) and the age on file stays. Ana (62
  and 8 months, disability benefit set up before the mark, $1,800 at 67, $1,800 on Income; Sam $900 at 67), her yearly
  letter saying $1,850: `{ claimAge 67, monthlyAtFRA 1850 }`, Sam's survivor figure $1,850, his top-up $25 (half of
  $1,850 less $900). Before: `{ claimAge 62, monthlyAtFRA 2642.9 }` ($1,850 / 0.70), a $2,180.30 survivor figure and a
  $421.40 top-up. An entry the page reads as a reduced early claim (old line clearly below the full-age amount) is not
  touched by this rule.

`standing`'s `bankCard` move and headline also come for two cards at one bank with no file for either (`bankVsPlan`'s
`cardFile` with `plural`): "Bring in the card files", "About $2,800 a month went to your Chase cards, whose files aren't
in, so your bank can't be checked against your plan yet. The first move fixes that." (it said "Your month works"). Test in
`cashflow/income-statement/module.test.mjs`.

## What you owe with our guesses (smart guesses C2, 2026-11-06; spec 5.2, 7.D, 8.1, 14.4)
Before C2 a picked debt with no balance typed was dropped: no account, no Liabilities row. A mortgage known only by its
payment vanished from net worth (overstated by the whole loan), from Timeline ("Debt-free now"), Next best action and
Pay off debts. Now Q5b keeps every picked debt and fills each blank box with our guess
(modules/overview/guesses/estimators/debts.js and home.js, formulas and sources in that README).
- **The screen (view.js).** One line: "Start with what you pay a month. Leave the rest empty and we'll work it out."
  The boxes in this order: Paid a month, Still owed, Interest rate a year (and, with a mortgage and no home on file,
  what the home would sell for; with a home on file, a line "Your home: about $X ... Change"). Each blank box shows
  our guess grey (its placeholder) with "Our guess: why." under it; its accessible name adds ", blank uses our guess of
  about $X". At most one tap per screen, for the first debt that has one: the mortgage's "When did you take out this
  mortgage, or last refinance it?" (shown once the payment is typed and the balance is blank), else the car loan's "When
  did you get this car loan?". The "Got it" line says which balances are our guesses ("Got it: about $X still owed in
  all, by our guesses." / "One balance is our guess for now." / "N balances are ..."; below). "Skip: use our guesses"
  saves the screen as it stands, every blank box guessed, and moves on.
- **`applyOweAmounts(draft, values, today, { guess })`.** Without `guess` (every older caller and test) it is exactly
  the old function. With `guess` (the view passes `ctx.guess`, which reads the plan before the save) it runs
  `applyOweGuessed`: the screen's answers go through `oweArgs(plan, x, kind, { askHome })` (`{ owed, payment, rate (a
  fraction), start?, home? }`, a box that reads back what the plan holds stays the plan's figure, a blank box null) and
  each blank box gets `guess("debt.<kind>.owed" | ".payment" | ".rate" | "home.value", { path, args })`: the same call
  the screen's placeholder made, so the grey figure is what is saved. A guessed box is written with `markGuess` (the
  ledger; a rate or payment also mirrors the older `rateGuessed` / `paymentGuessed` flag, so Liabilities and the debt
  guide read it as before), a typed one with `clearGuess`. The tap's answer is saved in `guide.setup.taps`
  (`"mortgage-start"`, `"car-loan-start"`; values in docs/DATA_MODEL.md). When the gate is closed (not U.S. dollars,
  "outside the U.S.") the old behaviour stays: a blank balance saves nothing and the rate is the typical one.
- **`valuesFor("owe-amounts")`**: a guessed balance, payment, rate or home reopens blank (grey again), never as typed
  text; the tap's answer comes back as `start`.
- **`reflect("owe-amounts")`** adds `{ guessed, of }` (balances that are our guess, of how many) only when one is.
- **`standing()`** adds `netWorthGuessed: true` when net worth's compute says `partlyGuessed` (a guessed balance is half
  or more of what you own, or of what you owe; spec 8.1), and `guessed` lists a debt whose balance is our guess with
  its `owed`. The done screen's net-worth tile then says "Partly our guesses. You own about $X and owe about $Y." with
  the calm "● Our guesses for now" status, never "A solid base"; a section "Our guesses for now" lists the guessed home
  and debts ("Mortgage: still owed about $110,000, rate 4.6%, $880 a month") with a link to Our guesses for you.
- **Choices.** The skip button saves our guesses (the spec's "Skip: use our guesses"); "Skip this question" elsewhere
  is unchanged. Q4b's own guesses are C4's; a home value saved on Q5b as a guess shows grey on Q4b (below). The done
  screen's "Not counted yet" no longer lists a guessed debt (it is counted now).
- **Answer keys** (module.test.mjs, the walks in `qa/fixtures/setup-personas.mjs`): Jordan's mortgage known only by
  its $1,100 payment is kept at $110,000 owed, 4.6%, home $210,000 (net worth $100,000, partly our guesses); Pat and
  Lee's at $210,000 (they owe more than $100,000; net worth $978,000 → $768,000; Timeline's debt-free year none →
  2041; Pay off debts lists it; Next best action's spending +$1,600); Sam's car loan $12,000 at 11.2% and card payment
  $90 at 22.4%; skipping every box keeps the card ($1,800, $50), the car loan ($14,000, $480) and the mortgage
  ($110,000, $880). For every walk the grey figure equals what is saved and the settle after the save moves nothing;
  typing over a guess ends its entry and the payment guess follows the typed balance; the 2010s tap gives $116,000;
  outside the U.S. nothing differs from the old function.

### After the two C2 reviews (2026-11-06; est/c2/c2-fix.md)
- **A 0 typed is the person's.** `oweArgs` reads owed and payment with `nonneg`: a box left empty is null (our guess
  fills it), a 0 typed is 0. "Still owed: 0" saves no debt (as before the guesses); a $0 payment (a loan on hold) is
  saved as typed and reopens as 0 (`valuesFor`), so a second Continue never puts our guess over it.
- **Our guessed home is asked as a grey box, never as a line "from question 4".** `askHomeWithMortgage` is also true
  while the setup home's balance is our guess. On Q4b, `valuesFor("have-amounts")` returns "" for a balance that is our
  guess and the box shows it grey with its why-line; `applyHaveAmounts` keeps our guess when that box stays empty (it
  used to drop the home and leave the mortgage standing: net worth −$110,000) and clears the mark when a figure is
  typed, even the same one. Plans with no guesses behave exactly as before.
- **A plan from before the guesses going back through Q5b.** Its mortgage was dropped, so Q6 asked "Rent" and the
  person put the home's payment there. When `applyOweGuessed` now creates the mortgage, a setup housing row still named
  "Rent" is renamed "Rent or mortgage", so Expenses files the mortgage under it and counts the payment once ($1,700,
  not $2,580). Answering Q6 again (now asked as "Home costs besides the mortgage") names it "Home costs", and the
  mortgage payment counts from Debts again.
- **The screen.** "Skip: use our guesses" saves what is on the screen (typed boxes stay typed) with every empty box
  guessed: the same save as Continue. Each grey figure's line is "Our guess: why." followed by the box's own help (where
  to find it). The tap sits under "Still owed", with "Tell us and we'll work out what's left from your payment."; the
  owed line is announced when it changes (`aria-live`). A payment that covers the typical balance says so ("typical in
  Ohio at your age and pay; your payment covers it"). The tap is still offered only once a payment is typed: without a
  payment the spec's work-back (E21) has nothing to work from, and the reviews showed a tap paired with the typical
  balance makes a steep payment (now refused in E22/E27).
- **No grey examples in boxes** (spec 10's general change, brought forward: grey now means what is counted): `moneyIn`
  has no default "0"; the pay box's "65,000", the rough total's "3,500", the goal targets' 60,000 / 4,000 / 10,000 and
  "e.g. A new kitchen" are gone; the goal boxes' help says "For example, 4,000." The grey uses `--muted` (scoped to
  `.su-root`: 4.8:1 light, about 6:1 dark).
- **The done screen.** "About" figures that add up our guesses have three significant figures ("about $159,000");
  "Got it: about $16,600 still owed in all, by our guesses. The payments you typed stay as you typed them." or "One
  balance is our guess for now."; the Social Security estimate is listed under "Our guesses for now" (it is counted);
  a car loan with no car value adds "Your car: type what it would sell for, so it counts beside its loan" to "Not
  counted yet"; a debt or home added later beside the one we guessed adds "Is Home loan the mortgage we guessed? ..." (overview/guesses'
  "Is this the same loan?"); the market fold is titled "What the plan assumes about prices and markets", as on the
  guesses page. The first moves say "type yours on Our guesses for you" for a rate in the guesses' ledger (older plans
  keep "What you owe").

## Spending with our guesses (smart guesses C3, 2026-11-06; spec 7.0, 7.A, 7.F, 8.1, 10, 14.4)
Before C3 a spending box left empty was $0: someone who knew only the rent had a month of rent alone, and the left-over
figure, the cushion and the retirement check rested on it. Now every row of Q6 shows our guess grey
(modules/overview/guesses/estimators/spend.js, formulas and sources in that README) and saving a blank box writes it.
- **The screen (view.js `spend()`, U.S. plans; `spendPlain()` keeps the old screen when the guesses' gate is closed).**
  The screen line "Round numbers are fine. Leave a box empty and we'll use the grey figure: what's typical for someone
  like you." One basis line for the grey figures ("The grey figures are what a household like yours usually spends: one
  adult renting in Texas on about $48,000 a year.", `spendBasis`), in place of a why-line per box. A renter whose rent is
  ours reads "Type your rent first: it decides most of the total." Each blank box's placeholder is
  `ctx.guess("spend.<row>", { path, args: spendArgs(plan, v) })` and its accessible name ends ", blank uses our guess
  of about $X"; the group sums, "In all, about a month" and its parts ("$1,100 you typed + $4,710 our guesses + $1,850
  loan payments") add the grey figures, so the total is the sum of the rows. Taps under their rows, shown while the
  row's guess asks and kept once answered: "How do you get health cover?" (insurance and health), "Do you pay for
  childcare or after-school care?" (childcare: no grey figure until Yes), "Do you pay an HOA or condo fee?" (home costs,
  only where 35-65% of the state's owners pay one). "One rough total" left empty shows the rows' guesses added up and
  saves them as rows. Retirement: under 50 (the oldest adult; no birth dates counts as under), one muted line "We'll
  plan on about $1,900 a month once you stop working: today's costs without childcare and loans that end by then.
  Change it on Will the money last?"; from 50, or once typed, the box with our grey figure and "Our guess: about $4,070
  a month of costs, plus the $1,600 of loan payments still running then. Health cover is added on Will the money
  last?". A typed row far from what households like this spend that a slip explains is asked about once ("$15,000 a
  month for rent? Did you mean $15,000 a year ($1,250 a month)? Continue keeps what you typed.", R9 `year-as-month`).
  "Got it: about $3,190 a month. All 7 amounts are our guesses for now." ("6 of the 7 amounts are our guesses" when some
  are typed; spec 9.6's "7 of these" had nothing to point to) (the month in all, as the screen's "In all" says
  it: Sam's $2,680 of rows plus the $510 of loan payments from question 5). "Skip: use our guesses" saves the screen as it
  stands with every empty box guessed.
- **`applySpend(draft, values, today, { guess })`.** Without `guess` (every older caller and test) it is exactly the old
  function. With it: `spendArgs(draft, values)` reads the screen (`{ mode, rows: { [row]: number | null }, total, taps }`,
  `nonneg`: a box left empty is null, a 0 typed is 0); a typed row is written and any guess on it cleared (even when it is
  the figure we guessed: saving it makes it the person's); a 0 typed writes no row and is remembered in
  `guide.setup.spendZero` (never guessed again; `valuesFor` reopens it as 0); a blank row gets
  `guess("spend.<row>", { path, args })`, written with `markGuess` (no figure, as for childcare without a Yes: no row).
  A typed rough total is written as before, with no guess. The taps answered go to `guide.setup.taps`. Retirement: a
  typed figure is the person's (`retireAuto` false, any guess cleared); otherwise `guess("overview/setup:retireSpend",
  { path: "retirement.spendingMonthly", args })` is written and marked (the ledger mirrors `retireAuto` true).
- **`overview/setup:retireSpend` (`retireSpendFor`).** Under 50: `retireDefault` (with the screen's rows when it has
  them). From 50 (spec 7.F): each everyday row x what households 65-74 spend on it over households 55-64 (utilities
  0.880, groceries 0.953, car and transit 0.792, eating out 0.876, shopping 0.859), plus the home costs that go on (the
  housing row, and a mortgage's property tax and insurance when it is paid off before work stops), the other bills on
  Expenses (as retireDefault counts them) and the loans still running then; never health cover (the projection's health
  line). A mortgage still running when work stops is in the loans with its whole payment, which holds the home's tax and
  insurance (E22), and the figure is one amount for every year, so they are not added a second time (C3 money review D9;
  `loansRunningThen`). Pat and Lee: about $3,790 + the $1,600 mortgage = $5,390 (7.H's "$4,100 + mortgage while it lasts"
  added the $280 of tax and insurance on top of the payment that pays them: about $280 a month too much for life). Will the money last?
  uses a figure in the ledger as saved (settle keeps it in step with the rows), instead of working today's bills out
  again (`setupFigure`), which is the under-50 formula.
- **`valuesFor("spend")`**: a guessed row reopens blank (grey), a 0 typed as 0, our retirement figure blank; `taps`.
  **`reflect("spend")`** adds `{ guessed, count, rows }` (how many rows are ours, of how many, and the screen's rows a
  month) when one is.
- **The waiting verdict (8.1; `standing()`).** Next best action's `spare.waits` (half or more of the month is our
  guesses: Expenses' `guessedShare`), Emergency fund's `waits` (half or more of the must-pay bills) and the retirement
  verdict resting on our spending add `spareWaits`, `runwayWaits`, `retireGuessed` (only when true), and `spendGuessed`
  (`{ monthly, count, rows, typed }`). Then the headline is "Your real spending decides whether your month works, so it's
  the best figure to type next."; the left-over tile reads "Depends on your spending" with "With our spending guesses:
  about $780 short. Type yours ›" and the muted "● Our guesses for now" (no green or amber); the cushion "About 0.6
  months" "By our guesses of your must-pay bills"; retirement the verdict word (never "Short at 65") with "Partly our
  guesses. Type what you spend ›"; the first move "Type what you really spend" goes back to this screen; "Our guesses for
  now" starts with "Spending: about $3,000 a month, besides the $900 you typed". The Dashboard's three rows say the same
  (its view, the designer's lane, claimed for C3).
- **Answer keys** (module.test.mjs): blank rows saved as marked rows equal to the grey figures, the settle after moving
  nothing, for the three walks; Got it's rows ($2,680, 7 ours; Jordan $3,900) and its month in all ($3,190 for Sam);
  Skip and a blank rough total write the rows; a
  typed total writes no guess; one row typed keeps the others ours and the total is their sum; a 0 stays 0 through a
  settle and a second save; the grey figure typed in is the person's; under 50 the line ($2,680 for Sam), from 50 the
  box ($5,390 for Pat and Lee), a typed figure stays; the verdict waits and speaks plainly once every row is typed; the
  walk replays' left-over figures within $100 of 7.H (with C4's contributions stood in; Jordan's 7.H -$780 is -$605 here
  because the app's tax engine counts the child and dependent care credit on her $900 of childcare, $175 a month, which
  the spec's prototype left out); outside the U.S. Q6 saves exactly as before.
- **After the C3 reviews (est/c3/c3-fix.md).**
  - *A guess is never the mortgage's payment* (D1). A renter's "Rent" that is our guess, when a mortgage is added later on
    question 5b, is renamed "Home costs" (never "Rent or mortgage"), and settle prices it as the home's other costs. Expenses
    never takes a row of ours for the mortgage's payment (`guessedSetupRow`), so the payment counts from Debts.
  - *The retirement verdict and the headline wait with no pay on file* (D4): with no left-over figure, half or more of the
    month being ours (Expenses' `guessedShare`) is enough for `retireGuessed` and the waiting headline.
  - *A rough total typed as 0 is the person's 0* (D7): `spendArgs` reads it with `nonneg`; nothing is guessed under it.
  - *The housing row is named for the household* (UX 5; `housingWords`, the guesses' own tenure): a renter "Rent" (help:
    "What you pay in rent. Power and water go under utilities"); an owner with a mortgage "Home costs besides the mortgage"
    ("Repairs and upkeep, plus HOA fees and any tax or insurance not in the mortgage payment"); an owner with none "Home
    costs" ("Property tax, home insurance, HOA fees and upkeep"), saved as "Home costs". "Type your rent first: it's the
    biggest one." shows to renters only. Insurance and health's help: "Health premiums (with what comes out of your pay),
    medicine, doctor visits", which is what the through-work figure holds (UX 8).
  - *At most two "does this exist" taps* (P9; UX 10): with childcare asked, the HOA fee is not asked on question 6 (left
    blank it takes the likelier side, as Not sure does).
  - *Childcare is never dropped in silence* (UX 4): a Skip with the childcare tap unanswered asks it once more ("we never
    guess childcare"; a second Skip goes on); and with our spending in, a child under 13 and the tap not answered Yes or No,
    `standing()` adds `childcareMissing` and a "Not counted yet" row "Childcare: do you pay for it, or for after-school
    care? Tell us and it's counted", and the left-over tile adds "Childcare is not counted yet."
  - *When typing moves our other figures, the screen says so, under the total* (UX 2; R10; part 3 review): "We changed our other guesses to fit what you typed (was: As you type, our other
    figures adjust, so the month stays near what households like yours usually spend in all."
  - *The under-50 line says only what applies* (UX 12): "today's costs" with "without childcare" only when there is any,
    and the loans that run on or end by then only when there are any; "on the "Will the money last?" page".
- **Speed.** Settle works the retirement figure out again on every update, so `retireSpendFor` works out `spendBase`
  once and hands it to `retireDefault`, and `spendBase` reads Expenses without the guess ledger (it reads amounts only,
  and no amount depends on the ledger). tests/estimate-perf.test.mjs (200 settles of the largest qa plan with 40 guesses
  under 600 ms) takes about as long as before C3.

## Round 8, batch 3: Get started asks what it needs (2026-11-06)
Six laypeople went through Get started (round 8). What they hit here, and what changed:

- **The plan at work (item 1, setup part).** Under pay from an employer (`by` not "self", or a salary already on Income),
  question 2 asks "Retirement plan at work?" Yes / No / Not sure (`WORK_PLAN`). One tap, or none: nothing chosen writes
  nothing. The answer is its own field, `retirement.workPlans[personId].plan` (review D2: a plan says nothing about a
  match, and Batch 2's match step reads `match: true` as "with a match"). Yes writes `plan: true` and, when the person has
  no plan account at a job they still have (a 401(k), or a Roth 401(k) by Contributions' `limitKind`: a Roth account with a
  match or a 401(k)/403(b)/457/TSP name; theirs, or unowned for the first adult; not `formerJob`; review D6), a $0 401(k)
  of its own, `setup-workplan-<person>`, "Priya's plan at work" (review UX 4: not the retirement box's place, so "On my
  own" on question 4b makes the IRA beside it). No contribution row is made (a $0 row would read as "already putting money
  in"). With the account, Next best action's match step asks ("Check if Priya's job matches retirement saving"), and
  Contributions and Benefits have an account to work with. No writes `plan: false` and `match: false` (no plan, so no match:
  Next best action, Benefits and Contributions stop asking); Not sure takes the answer on file away, with the `match: false`
  its No wrote. Only an answer that differs from the one on file does anything (review D7): Contributions' "No plan or no
  match" (`match: false` alone) is not read back as No, and an unchanged Continue never takes back or puts back the
  account. No, Not sure, or no longer working for an employer takes back the $0 401(k) while nothing is in it and nothing
  is set to go in. Question 4b's "Through work" box goes into it (a typed balance, never a second account; blank keeps it at
  $0 and shows blank); "On my own" is an IRA in the box's own place; Retirement unticked on question 4 after it was ticked
  puts it back to $0 and drops the setup's contribution to it. Question 4 says once "Priya's plan at work is added with $0.
  Money in it already? Tap Retirement." (`workPlanLine`), and question 2's "Got it" says "We added Priya's plan at work,
  with $0 in it for now." (`workPlanAdded`) on the Continue that adds it. Removing the person removes the answer and the
  account.
- **Savings already for a goal (item 10).** Question 7b asks under each saving goal "Is any of your savings already for
  this?", with the cash accounts (checking, savings, cash with money in them: `goalFundChoices`) as pills plus "None of
  it". The answer is the goal's `fundedBy` (cash ids only; another account the goal draws on, such as a 529 linked on
  Goals, stays in its place). `saved` is never written: Liquidity's cushion leaves out what goals claim through `fundedBy`
  (F-020: `min(funded - saved, targetThen)` for a goal with an amount), and `saved` would not come off it. The help says
  what happens (`GOAL_FUNDS_HELP`, review D8 and UX 2): "Tap an account if money in it is for this. Up to this goal's amount
  then counts here, not as your safety cushion." An answer is written only when it differs from the cash the goal already
  draws on, and is kept as 7b's own in `guide.setup.goalFunds` (review D1). The cushion goal's own accounts
  (`cushionFundIds`): every cash account, except one 7b linked to a goal while those goals need all of it (Goals' F-013
  sharing worked over every goal but the cushion: by priority, then date, each taking `target - saved`; a goal with no
  amount takes nothing). An account with money left over stays in the cushion's list, after the others (review D3), and
  Goals gives the cushion its share of it first (priority 1), so Goals, Emergency fund and the done screen show one
  cushion: savings $30,000 ticked for a $4,000 trip gives the cushion $16,800 of $16,800 on Goals, the trip $4,000, and
  Emergency fund $29,000 (Liquidity: $33,000 less the trip's $4,000). When a ticked account holds more than the goal needs
  but not enough for both, it stays out of the cushion's list (verify, round 8): Goals gives the cushion (priority 1) its
  share first, so with it in the list a $15,001 savings ticked for a $15,000 car gave the car $1,201 and the cushion
  6.0 months "Covered", one dollar after $15,000 gave the car all of it and the cushion 1.1 months; that broke the help's
  "Up to this goal's amount then counts here". The rule (`sharedOut`, Goals' F-013 over every goal with the cushion on a
  given list): a ticked account with money left over joins the list only when no other goal then gets less. So the car
  keeps $15,000 and Emergency fund and the done screen count what it leaves ($3,000 + $10,000 = $13,000 for $25,000 of
  savings: 4.6 months); Goals' own cushion row then counts only the untouched accounts ($3,000) until the savings covers
  both ($15,000 + $13,800 = $28,800), an owner question. A link made on Goals does not count
  (plans that never answered 7b keep every cash account in the cushion, as before). The setup's guess of those accounts
  (`overview/setup:cushionFunds`) reads the same list, so "Better guesses are ready" never offers it back. Couple-home
  (checking $3,000, savings $22,000, $3,930 of must-pay bills and loan payments, a $60,000 home in 3 years, Savings
  ticked): the house holds $22,000 of $60,000 and needs $1,067.63 a month (Goals' `pmtToReach` on $65,563.62 by then at
  3% inflation, the plan's bond return 4%, since 36 months away is not under 3 years); the cushion is $3,000 / $3,930 = 0.76, "0.8 months", "Worth building up"
  (before: $25,000 / $3,930 = 6.4, "Covered").
- **Why the cushion reads less than the accounts hold (items 10 and 29).** `cushion()` now also returns `all` (Liquidity's
  `nowAll`), `earmarked`, `taxOwed` (Estimated payments' `taxOwedNow`, as Liquidity takes it: at most the cash), `taxDue`
  (all of it, `owedNow`), the goals in words, and `exact` = months x the must-pay bills going today, Emergency fund's own
  target (`goals/emergency-fund`: `essentialMonthly x months`, worked out with `today`, so a bill that ended or has not
  started is left out; review D5). `essential` is that figure too; `essentialAll` (every must-pay bill on file, dated or
  not) is what the saved cushion goal and its guess still use, rounded to $100 (`target`), so no existing plan moves (owner
  question 1).
  Question 7b says "That's $20,580" (exact; it said $20,600, the goal amount rounded to $100, which is still what the
  cushion goal saves: changing it would move every plan's saved guess) and, through `cushionHave`, "You have $8,500 in
  checking and savings. This year's tax not paid yet, about $9,250, takes all of it, so none counts toward the cushion: 0.0
  of 6 months." (it said "$0 in checking, savings and cash"; review UX 3: the tax has its own figure, $15,898.44 x 10/12 -
  $4,000 = $9,248.70, said to the $10, when it is more than the cash; the done screen: "This year's tax not paid yet (about
  $9,250) is more than the $8,500 you have, so none of it is cushion yet."). The line follows a savings account ticked lower on the same screen (worked
  out on a copy of the plan with the screen's answers). Nothing held back: the line it always was. The done screen's
  Safety cushion figure says it too (`standing().cushionHeld`, only when something is held back; `cushionHeldWords`):
  "Your $22,000 is set aside for the home, so your cushion is $3,000. Aim for 6 months." A goal the owner made on Goals
  is named as a goal ('the "Japan trip" goal'). When the held goal looks like the cushion itself but is not ticked as it
  (Liquidity's and Emergency fund's test: the name says emergency, rainy day or cushion, or the 🛟 icon; F-034),
  `standing().cushionHeld.cushionGoal` names it, and the figure says the money may be cushion and asks (review UX 5):
  '$11,500 more sits in your "Emergency fund" goal. Aim for 6 months. Count it as your cushion? Say so on Emergency fund ›'
  (with tax held too, or several goals, the "set aside" sentence and "Is that goal your safety cushion?"); it opens
  Emergency fund, whose "This goal is my emergency fund" counts it (`cushionHeldAsk`). The family fixture: 0.9 months
  ($4,200 / $4,768.33 of must-pay bills = 0.88); ticked, $15,700 / $4,768.33 = 3.29, "3.3 months". Found by running the done
  screen on every qa plan: 1,079 of 1,424 hold cash for a goal, 1,075 of them for an unticked goal that looks like
  the cushion (686 named "Emergency fund"; all 🛟), and Emergency fund's page shows that same goal in all 1,075.
- **Which kind of IRA (item 35).** Under "On my own", question 4b asks "Which kind of IRA?" Traditional / Roth / Not sure
  (`IRA_KINDS`). Roth saves type `roth`, Traditional `ira`, Not sure `ira` with `guide.setup.iraKind[personId] = "unsure"`,
  listed under "Our guesses for now" on the done screen ("Your retirement: counted as a traditional IRA. A Roth? Tell us
  which", opening question 4b; review UX 9).
  No answer: as before (a new account is an IRA; a Roth set on Net worth stays a Roth). For the freelancer's $14,000 IRA
  with $250 a month, Roth stops the $3,000 deduction: federal income tax $7,670 to $8,330 in the app's terms today (single,
  2026 standard deduction $16,100: taxable $58,900 to $61,900, the extra $3,000 at 22%). Nothing is said about a SEP-IRA
  (`iraKindHelp`, review D4): the app would count it against the $7,500 IRA limit and deduction, while a SEP has its own
  (the lesser of 25% of pay or $72,000 for 2026, IRS "SEP contribution limits"; employer SEP money "do[es] not affect the
  amount you can contribute to an IRA", IRS "Retirement plans FAQs regarding SEPs"; as read by the money review
  2026-11-06). A SEP kind with its own limit is Batch 1 / Limits work.
- **Social Security already paid (item 37).** "What you get a month" now says what figure: from 65, "Before Medicare is
  taken out: the figure on your yearly benefit letter, not what reaches your bank. Only know the deposit? Add about
  $203." (`ssGettingHelp`; $203 is `PART_B` in `retirement/medicare/data/medicare.js`, $202.90, the 2026 standard Part B
  premium: CMS fact sheet "2026 Medicare Parts A & B Premiums and Deductibles", November 14, 2025, read 2026-11-06; no 2027
  figure was published on that day). From 62 to 64, "Before anything is taken out"; before 62: "Before 62 that's disability or survivor
  benefits. Use the figure on your benefit letter, before Medicare or anything else is taken out; we count it as it is."
  (review D10: Medicare Part A and B start after 24 months of disability benefits, medicare.gov "How do I sign up for
  Medicare?", and "Most people get their Medicare Part B premium deducted automatically" from the benefit, medicare.gov
  "Pay premiums", both read 2026-11-06; a survivor benefit from 60 is reduced, 71.5% at 60, SSA "Receiving survivors
  benefits early" as quoted by search, the page itself refused the fetcher that day; so not "paid in full".)
- **The home's down payment (item 39, the Q7 hint).** `goalAmountHelp("home")` adds "Some loans take 3% down or less (VA and
  USDA loans can take none); under 20% down usually adds mortgage insurance or a fee to the monthly cost." (review D9: the
  same CFPB page says "Special zero down payment programs exist for veterans, servicemembers, and rural borrowers. Those
  programs also require mortgage insurance or other fees.") Sources, read 2026-11-06: CFPB, "How to decide how
  much to spend on your down payment" ("Some lenders may offer conventional loans with 3 percent down payments"; FHA from
  3.5%; page last modified June 25, 2026), and CFPB, "What is private mortgage insurance?" (required "if you take out a
  conventional loan with a down payment of less than 20 percent"). The house page's own monthly cost does not count
  mortgage insurance yet (item 39's house math, in the backlog).
- **Waiting for other work.** Move 3's IRA words (item 9) wait for Batch 1's `iraDeductible` helper; the escrow default on
  question 5 (item 17) waits for Batch 4's `debts[].escrowMonthly`; the rental stub for "Rent I collect" (item 5) waits for
  Batch 6; the city-tax question on question 1 (item 19) waits for claude-a's `taxes.state.localRate`.
- **Question 7b's pills say what they did** (review UX 7 and 8). After a tap, a line under the pills: "Your cushion now
  counts $3,000: 0.8 months of must-pay bills. Aim for 6." (worked out on the plan with the screen's answers; the cushion's own
  line may be above the screen), and, when an account is ticked under another goal too, "Savings is also for the trip.
  The goal due first fills first." (Goals' F-013: same priority, by date).
- **Tests** (`R8 item ...` and `R8 B3 review ...` in `module.test.mjs`; the review's ten failing first, saved in
  `r8/b3/failing/review-fixes-before.txt`): the three answers and what each writes, taking back, the question only
  for employer pay, no second 401(k), an unanswered screen writes nothing; question 4 keeping the plan at work; the
  savings link, None of it, an answer left alone, cash only, the cushion's own accounts and its guess agreeing; the unpaid
  tax sentence and Emergency fund's target; the IRA kinds; the Social Security and down-payment help.

## Q6 opens with one box (path part 3, 2026-11-06)
`valuesFor(plan, "spend")` is unchanged; the view adds `v.sum`, "Your best guess for a normal month". `applySpend(..., { guess })` reads
`v.sum` through `sumSplit(rows, args, sum, guessOf)` (pure, exported): rows typed in the fold stay theirs and come off the figure;
what is left is shared over the blank rows in the proportions of our guesses for them (whole dollars, the biggest row takes the odd
dollars), so the rows add up to the figure. Those rows carry **no guess mark**: the figure is the person's own, so the month is not
"mostly our guesses" and the verdicts do not wait; they reopen as typed rows with the box empty. A split typed above the figure wins
(nothing is left to share; the screen says so). With no guess to share by, the rest is one "Monthly spending (rough)" row. A zero
typed is the person's zero and takes no share. The retirement guess is worked out from the rows as shared out. Left empty, nothing
changes: every blank row is our guess, as before. A plan saved with the old "One rough total" reopens with that figure in the box
(saving it again writes rows instead of the one row); `mode: "total"` stays supported in compute for old callers and tests.
The "Skip: use our guesses" childcare reminder opens the fold. "Must-pay bills" is "Bills you have to pay" on screen. Tests: "part 3 ...".

## Q6 remembers the figure (path part 3 fix, 2026-11-06)
The top box's figure is saved as `guide.setup.spendSum: { sum, typed }` (whole dollars; `typed` = the groups typed in the fold). Reopening puts `sum` back in the box, keeps the typed groups as typed and shows the rest as the share of the figure (grey). A new figure re-shares only the blank groups, so the rows always add up to it and no "Monthly spending (rough)" row appears unless nothing can be shared. The figure is read back only while the setup bills still add up to `sum`; if a bill was changed or removed on Expenses, the screen opens as for typed rows and never overwrites it. Leaving the box empty removes `spendSum` and the blank groups go back to our marked guesses. A decimal figure is rounded once, so the rows and the retirement guess agree. A decimal group typed beside the figure is rounded the same way (at least $1), so the sum always matches. While a figure is given, the line under the box says the grey figures are the figure shared out.

## Year you bought it (2026-11-07, owner's request)
Question 4 (the home's value) has an optional "Year you bought it" box; question 5 (the mortgage) says the year once it is given
("You said you bought it in 2025", with "Change the year") and has the box itself only when there is none. Blank shows the grey guess
(`home.boughtYear`) in the box's help in words; typed, it is the purchase date (July 1 of the year) on the Home page's entry for the home
when there is one, else on `property[setup-home]` (`applyBought`, `boughtYearOn`, `homeEntryFor`: one entry; the Get started entry is
removed when the box is emptied, when the home is unpicked or its account goes). `parseYear(v, thisYear)` takes the year of the plan's
today as its upper bound (a year ahead is no answer and the box says so); there is no hidden clock. `oweArgs`
passes `bought` (a year, or null for a blank box; a screen without the box passes nothing and the plan's year is read). A refinance answered
on the mortgage tap still wins as the loan's start (unless it is earlier than the year typed). Formulas: overview/guesses README "When the
home was bought".

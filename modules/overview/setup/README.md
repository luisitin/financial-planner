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
| | `welcome` | nothing: three things you get, "about 5 minutes", the privacy line | |
| 1 | `you` | first name; just me / me and my spouse / me and my partner; partner's name; children who live with you (stepper); state | `household.people` (`setup-self`, `setup-partner` with `relation`, `setup-kid-N`), `filingStatus`, `state` |
| 2 | `money` | per adult: I work (pay before tax, how often) / I'm retired (a pension a month) / not working now; other money a month and its kind | `income` (`setup-pay-<person>`, `setup-pension-<person>`, `setup-other`) |
| 3 | `ages` | per adult: birth month and year, when you'd like to stop working (or already retired), Social Security (estimate it / my statement figure / I already get it / I won't get any); children's birth years | `birthDate`, `retirementAge`, `retirement.socialSecurity`, `income` (`setup-ss-<person>`) |
| 4 | `have` | tiles: checking, savings, retirement, investments, a home, a car | `guide.setup.picks.have` |
| 4b | `have-amounts` | about how much in each; retirement per adult with through work / on my own, a month from pay, the employer's match | `accounts` (`setup-have-<kind>`, `setup-have-retire-<person>`), `retirement.contributions` (`setup-contrib-<person>`) |
| 5 | `owe` | tiles: credit cards, car loan, student loans, mortgage, another loan, or "nothing, I'm debt free" | `guide.setup.picks.owe` |
| 5b | `owe-amounts` | cards first: "Do you pay the whole bill every month?"; then how much you owe, the payment a month, the rate if you know it | liability `accounts` (`setup-owe-<kind>`), `debts` (`setup-debt-<kind>`) |
| 6 | `spend` | a typical month in rows (must-pay and everything else, with subtotals) or one rough total; then "once you stop working, about how much a month?" | `expenses` (`setup-x-<category>`, `setup-x-total`), `retirement.spendingMonthly` |
| 7 | `goals` | tiles: a safety cushion, paying off debt, buying a home, retiring well, education, a big trip, a car, something else | `guide.setup.picks.goals`, `guide.setup.focus` |
| 7b | `goal-details` | how much and by when (1, 2, 3, 5 years or a date); the cushion: how many months (1 to 12) | `goals` (`setup-goal-<kind>`), `assumptions.emergencyMonths` |
| | `done` | where you stand, your first three moves, what is not counted yet, the plan's guesses | `assumptions.reviewedAt` ("These sound fine") |

Follow-up screens (4b, 5b, 7b) show only when their question needs them (`SCREENS[].show`), and count half a step on the
bar. An address whose screen no longer applies (5b after "debt free") moves on to the next screen that does
(`resolveScreen`), with `history.replaceState` so Back does not loop.

## What the setup writes (the rules)
1. **Its own ids.** Every record it makes has an id starting `setup-`, so going back and changing an answer updates the
   same record and never adds a second one.
2. **Only the asked fields on a record that exists** (`put`). A checking account renamed on Net worth keeps its name; a
   raise set on Income keeps its growth; money a month set on Goals stays. The full record is written only when new.
3. **A kind the plan already has is not asked.** Accounts of that type (`existingHave`, `existingOwe`), pay on Income
   (`existingPay`), bills in those categories (`spendRows`), a goal like it (`existingGoal`): the screen shows them as
   "Already in your plan" and the setup adds nothing of that kind. Retirement is per adult: only adults without an
   account of their own are asked. A household typed on People is left alone; only the state is saved.
4. **Nothing another record points at is removed** (`referenced`). An account the setup made is removed when its tile
   is unticked or its box cleared, unless one of these points at it: transactions, imports, holdings, reconciliations,
   rules, import profiles, a goal's `fundedBy`, a Liabilities row, a retirement contribution (made elsewhere),
   `debtPlan.customOrder` or `mortgageAccountId`, `property[].accountId` or `loanAccountId`, `contacts[].accountIds`,
   `estate.beneficiaries[].accountId` (the places `docs/DATA_MODEL.md` names an account id). Then it stays and the
   screen says "Kept Checking: it has transactions. Remove it on Net worth." A person (the partner, a child) stays the
   same way when Income, Net worth, contributions, pensions, insurance or estate papers name them
   (`personReferenced`); otherwise removing the partner removes their pay, pension, Social Security, retirement account
   and saving in the same change.
5. **A blank box saves nothing**: it never becomes 0. "Skip this question" never deletes anything.
6. **A Continue that changes nothing saves nothing** (`wouldChange` runs the writer on a copy and compares), so going
   back and forward makes no saves, backups or audit lines. `guide.setup.at` only moves forward (the furthest screen
   reached), so Back never moves "pick up where you left off".

## Inputs
`needs`: household, income, accounts, debts, expenses, goals, assumptions, retirement, guide.
`compute(plan, { today, screen })`.

## Outputs
`{ screens: [{ id, q }], progress: { started, finished, at, q, total, share }, standing (on "done" only) }`.
`standing(plan, { today })` = `{ netWorth, assets, liabilities, spare, runway, runwayTarget, runwayStatus, retire:
{ verdict, shortAge } | null, retirementKnown, moves: [{ id, title, detail, href }], later: [{ label, href }], headline,
guessed: [{ name, rate }] }`.

## Formulas and sources
- **Pay a year** = amount x periods a year (`core/math/periods.js`: 52, 26, 24, 12, 1).
- **Social Security, "estimate it for me"** (`estimateSocialSecurity`): the method of SSA's Quick Calculator
  (ssa.gov/OACT/quickcalc, "How the Quick Calculator works"): earnings before this year are assumed to have followed
  the national average wage index, so each past year = today's pay x AWI(year) / AWI(latest); from age 22; the same pay
  until the age you stop (capped at full retirement age); then the app's own benefit formula
  (`retirement/social-security` `estimateBenefit`: 35 best indexed years, the bend points, the full-retirement amount,
  in today's dollars). AWI from `retirement/social-security/data/ssa.js` (SSA's published series).
- **Already getting it**: full-retirement amount = payment now / claim factor at the age it started
  (`claimFactor`: 5/9% a month for the first 36 months early, 5/12% beyond; 8% a year delayed; SSA, "Early or Late
  Retirement?"), so the projection and Social Security pages work from the same base.
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
- **Loan and card payments** are not written as an expense: Expenses counts the Liabilities rows' payments itself when
  no expense is filed under "Loan and card payments" (its F-019 rule), so the total is right either way and nothing is
  counted twice. The spending screen says so ("Not counting the $2,120 a month of loan and card payments you told us").
- **Must-pay** spending: the row's group (must-pay or everything else), matching the Expenses categories' own
  `essential`. One rough total is counted as must-pay: safer for the cushion.
- **Spending once you stop working**, the first figure: today's bills a month without loan payments and childcare
  (`retireDefault`), to $10; saved as Retirement's own figure (`retirement.spendingMonthly`), which Will the money last?
  uses instead of today's expenses. Not asked when everyone is already retired (today's bills are retirement's).
- **The safety cushion** (`cushion`) = months x must-pay bills a month (Expenses' `essentialMonthly`, loan payments
  included), rounded to $100; months default to the plan's emergency months (6) and are saved there too, so Emergency
  fund and the goal agree. The goal has no date (it is kept topped up, not reached once: no money a month is asked for
  it on Next best action) and is drawn from the savings and cash accounts (`fundedBy`), marked `isEmergencyFund`.
- **Filing status**: married filing jointly with a spouse; head of household for one adult with children at home
  (IRS Pub. 501: unmarried, paying more than half the cost of a home where a qualifying child lived more than half the
  year: the setup assumes "children who live with you" meets it); single for an unmarried couple (each files their own
  return). Set the first time and again only when the answer that decides it changes, so a status picked on Filing
  status stays.
- **Child support** coming in is saved as Income type `support` with `taxable: false` (IRS Pub. 504: child support is
  not income to the parent who gets it). Side work is `business` (in the first adult's name, so self-employment tax
  applies), rent is `rental`.
- **Where you stand** reads the pages' own computes, never its own math: Net worth (`netWorth`), Next best action
  (`spare.monthly`: pay after federal income tax and payroll tax, less spending, saving and goals; state tax is not in
  it, said on screen and in "Not counted yet" for states that tax wages), Emergency fund (`runwayMonths`), and Will the
  money last? (`verdict`), the last only once every adult has a birth date and Social Security (estimated, typed, a
  record, or "I won't get any") so a missing figure never reads as "short".
- **Your first three moves**: Next best action's first step not done (its own order, never re-ranked; "Then: your
  choice" left out), then a guide for what you said matters most (paying off debt, unless the first move already is;
  retiring well; buying a home), then Next best action's next steps.

## The guide state (`plan.guide.setup`)
`{ at (furthest screen), startedAt, finishedAt?, picks: { have, owe, goals }, focus, who, status: { [personId]: work |
retired | none }, ss: { [personId]: estimate | statement | getting | none | unsure }, spendMode, paidInFull }`, optional,
documented in `docs/DATA_MODEL.md` under `guide`.

## Choices made (the owner said: decide and note it here)
- Seven questions, follow-ups only when needed: the critics' newcomer persona gave up past about eight screens.
- Ages and Social Security share one screen (the stop-working age is what the estimate needs).
- No "already saved" box on a goal: the money is already in the accounts you typed, so asking again counted it twice.
- An unmarried couple is planned as one household with two single returns; the federal estimate today works one
  return for the household (a follow-up is posted on the WORKBOARD for taxes/federal).
- A mortgage's typical rate is today's new-loan rate, which may be higher than an older loan's; the guess is marked
  and named on the last screen.
- Get started's "Let's go" skips the welcome screen: that page already says what the welcome would.

## Edge cases
Empty plan (every screen works, the first screen makes "Me"); a household typed on People (left alone); accounts,
pay, bills and goals made elsewhere (not asked, not doubled); a referenced account or person (kept, with the reason);
a card paid in full (no debt); everyone retired (no retirement spending question); no birth date (no retirement
check, no "already retired" age); a pasted ssa.gov record (never overwritten); a debt with no payment typed (a $0
payment: Liabilities then says it never pays off, which is the truth to fix).

## Tests
`module.test.mjs`: money boxes; the Social Security estimate against a record built by hand; filing status for each
household and kept when unchanged; removing the partner (and keeping one other pages use); a household typed on People;
pay, pension and other money with their types and names ("My pay"); ages, the stop age rule and already retired;
already getting Social Security (claim factor round trip); a pasted record kept; accounts per kind and per adult, 401(k)
or IRA, contributions and match; kinds already in the plan not asked; referenced accounts kept; debts with typical or
typed rates; loan payments counted once; a rate typed later survives; a card paid in full; spending rows, existing
categories, one total; retirement spending; the cushion (no date, never "behind"); goals and dates; an existing
emergency fund; going back updates only the asked fields; a Continue that changes nothing; follow-up screens and
`resolveScreen`; the furthest screen; where you stand (net worth sum, first move, no "your choice", guessed rates,
state tax, the dashboard's six steps done); retirement never "short" before Social Security is known; every typical
rate in this README with its source.

## Ideas / not yet
- Bank file import as an alternative to typing balances ("I'd rather bring in my bank's file").
- Ask the payoff date of a car loan (`termMonths`) for a cleaner debt-free date.
- The federal estimate for an unmarried couple as two single returns (taxes/federal, see WORKBOARD).

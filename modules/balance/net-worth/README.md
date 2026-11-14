# Net worth  (`balance/net-worth`)

**Status:** usable
**Purpose:** the balance sheet: every account with a balance, totals, liquidity and tax-bucket splits, and a dated history of snapshots.

## Inputs
Plan sections read: `accounts`, `netWorthHistory`, `meta.currency`, `guesses` (the ledger of our guesses, read only).
`compute(plan)` takes no parameters.

## Outputs
`assets`, `liabilities`, `netWorth` (= assets - liabilities), `liquid` (cash-like and taxable brokerage),
`investable` (everything with a tax bucket), `byType`, `bySide`, `byTaxBucket` (taxable / deferred / free / none),
`count`, `history` sorted by date, `change` vs the last snapshot or `null`.
Only when the plan holds guesses (smart guesses C2, spec 8.1; additive, so a plan without any computes exactly as
before): `guessedAssets` and `guessedLiabilities` (the sums of the balances that are our guess: `isGuess(plan,
"accounts[<id>].balance")`, core/estimate) and `partlyGuessed` (a guessed side is 50% or more of what you own, or of
what you owe). Get started's done screen reads it ("Partly our guesses", "● Our guesses for now" in place of "A solid
base"); this page's view and the Dashboard tile are the designer's to change (see the C2 notes).

## Formulas
Sums. Liability balances are stored as positive amounts owed and subtracted. The type table
`ACCOUNT_TYPES` (this module's compute.js) is the single source of truth for what is an asset,
what is liquid and which tax bucket a type belongs to; other modules import it.

## The kinds in plain words (plain-words pass C10, 2026-11-13; SPEC 13.1)
Each kind keeps its `label` (other pages, the AI pages, the export file and their tests read it: AI notes pins "House (Real
estate)" and "Car loan (Personal / auto loan)" and keeps the kind off "Brokerage" because the label's first word is in the
name; Explain pins "type label Roth IRA / 401(k)" in Emergency fund's figures). The words this page and Emergency fund show
are `plain` where the label is a hard word, through `typeName(type, fallback = "other_asset")`:

| kind | label (kept) | shown |
|---|---|---|
| brokerage | Brokerage (taxable) | Investments outside retirement |
| ira | Traditional IRA | Traditional IRA (taxed when taken out) |
| roth | Roth IRA / 401(k) | Roth (tax-free later) |
| hsa | HSA | Health savings account (HSA) |
| 529 | 529 plan | College savings (529) |
| property | Real estate | A home or land |
| cash_value_life | Life insurance cash value | Savings inside a life insurance policy |
| other_asset | Other asset | Something else I own |
| loan | Personal / auto loan | Car or personal loan |
| other_liability | Other liability | Something else I owe |

The IRA does not use the spec's "IRA that cuts this year's tax": a traditional IRA cuts this year's tax only within the
income limits for a person (or spouse) with a plan at work (IRC 219(g); Contribution limits works it out), and money put in
without the deduction never did, so the shown words say what is true of every one: it is taxed when taken out (the
"deferred" bucket, the Invested for later line's own words). The other kinds show their label. Another page can show the
same words with `typeName` from this file. Also on screen:
"Bank or company" (was "Bank or firm" in the form, "Institution" on the wide table); the Invested for later line says
"$X in retirement accounts, taxed when taken out; $Y tax-free; $Z in other investments" (was "(pre-tax)" and "taxable"),
the same three sums; an address asking for a kind with no heading of its own (`?add=hsa`) is headed "Add an account",
"Add something you own" or "Add something you owe" (was "Add a hsa account"). No figure, kind or saved value changed.

## Whose account
The form's "Whose account" is a choice of the people on the People page, saved as the person's id ("Both of us" saves "";
"Shared" with three adults or more), because the tax pages put an account's contributions and sales on its owner's return
(`ownerId` in DATA_MODEL). With one adult there is no "Both of us" (C10): the adult's choice saves "" as it did (every page
counts an account nobody owns as the one adult's), or their id when that is what is on file, and a child can still be picked;
with one adult and no one else (or no one on the People page) the box is not shown and the owner on file is kept ("" for a
new account, as the box would have saved). Until
2026-10-31 it was a typed name, which never matched an id; `migrate` (`ownersToIds`) now turns a typed name that matches
exactly one person's name into their id when the plan is opened, and a name that matches no one stays selectable in the
form marked "typed before; choose a person".

## Mistakes in the history (2026-11-02)
- Editing a balance to a figure that looks like the old one with a key slipped (`looksLikeSlip`, balance/update) asks
  once: "$115,000 was a mistake" fixes it where it stood (`correctSlip`: the account's points and the saved totals),
  so no fall is drawn; "Both are right: it changed" keeps the old figure as a point, as before.
- Each saved total under "Over time" has a Remove button (the table on a wide screen, stacked records on a phone), for
  a day saved while a balance was wrong. The accounts are not touched.

## Edge cases
Unknown `type` is treated as `other_asset`. Non-numeric balances count as 0. One snapshot per
calendar day (the later one wins).

Editing an account's balance (2026-11-01): a new balance is dated today unless "Balance as of" was changed in the same
edit, and the old balance stays a point in the account's history on its old date (`keepOnFile` in
`balance/update/compute.js`), so Account detail's chart and the monthly review see the update. Adding, saving and
removing an account each confirm at the top of the Accounts card. "Update all balances at once" opens
`balance/update`, which dates every balance today in one save.

## Tests
`module.test.mjs`: totals, liability handling, tax buckets, change vs last snapshot; C10: every kind's words with the
label kept, the form's words, "Both of us" and the one-adult form (what a save stores), the list and the invested line (the
view through `qa/fixtures/fake-dom.mjs`).

## Review fixes 2026-11-02
The edit form's slip question has "It changed" as the filled default and "$X was a mistake" outlined. A changed balance records `typedOn` and refreshes today's saved total (update's `markTyped`).

## Ideas / not yet
- Per-account balance history from imported statements (feed from transactions/import).
- Chart of the snapshot history (uPlot).
- Owner filter (each person / joint) and a per-person net worth.
- Benchmarks from the Fed Survey of Consumer Finances (see docs/RESOURCES.md).

## Opened to do one thing (touch and input stress test, 2026-11-11, claude-g)
Pages that send people here to add or change one account pass it in the address (DP-3, B4, D1, CF-1):
- `?add=<kind>`: the add form opens in view with Type chosen, a heading and a name hint, the cursor in the name box. Kinds: any
  account type (`credit`, `mortgage`, `loan`, `student_loan`, `property`, `vehicle`, `checking`, `savings` ...), `debt` (a loan
  or card) and `belonging` (a home or car).
- `?edit=<account id>`: that account's edit form opens in view, the cursor in the balance.
- `?back=<group/id>` (or `group/id/<one more part>`), or `?from=import`: the green line after the save carries a filled "Back to
  <page> ›" ("Now import the bank file ›" for Import). A new loan or card also gets "Next: its rate and payment ›" (its form on
  Debts); sent from Debts, that is the one button.
The address is read once: the redraw after the save has the same route object and does not open the form again. The green line
after an add or edit is drawn where the form was, where the thumb is.
Follow-ups (2026-11-11): after the save the address drops `add` and `edit` (history.replaceState), so Back or Reload does not
open an empty form again; the boxes use the kind's words (a home: "What to call it", "What it would sell for today", no bank box,
"Add it"; a debt: "What you owe now", "Lender (optional)") and follow a change of Type; the green line with its buttons is brought
into view when it would sit under the top bar (320 px); "Back to Your home" (not "Home"). A debt's "Next: its rate and payment"
carries `?back=` on to Debts.
`?add=investment` (asked by claude-h for Holdings) opens the add form as a brokerage account; `?at=history` (the check-in's step,
MR-5, asked by claude-f) opens the page at the Over time card, once per address.
`?from=import` with `?add=` (Import's "It is not on my plan yet" for an account a YNAB, Monarch or Mint file names; gap #33, fix
round 2026-11-14): `?name=` starts the name box with the file's name for it (Import leaves its masked number off; at most 60
characters), and the balance may be left empty ("Not sure now? Leave it empty: it is added at $0, and you type the balance
later."): someone moving their history in rarely has the balance at hand, and a made-up figure would move net worth. Left
empty, the account is added at 0 with no "as of" date (the form already allowed an empty date: it is not a balance anyone
saw), and the green line says "Rewards Card added at $0 for now. When you know its balance, tap Edit beside it here." with
"Now import the bank file ›". A balance typed is saved as always. Without `from=import` the name is not read and the balance
is asked as before.

## A mortgage balance of ours saved here (2026-11-11, loans lane fix round 1)
Saving the account form makes the balance the person's. For a mortgage whose payment was read with tax and insurance of ours
inside it, that figure is kept on the loan (`overview/guesses estimators/home.js escrowBefore` and `escrowKept`), so the payoff
date on Debts does not jump when a balance is confirmed.

## Ahead or behind the path you drew (gap design #35, 2026-11-14) -- `path.js`
**What a person sees.** With no kept path the page is the page of before (the module test draws every household in
`qa/households` and the four fixtures both ways). "Save today's totals" confirms with "Today's totals saved. Your plan is
kept too, so you can compare in six months." when that save kept a path (`savedWords`; plain "Today's totals saved." when
none was kept). While the first kept path is younger than six months, one small line stands where the row will be: "From
May 14, 2027, this page also says whether your savings are ahead of or behind the plan you had when you saved your totals."
(`comingOn`, `comingWords`). Once a path is six months old the Over time card has one quiet row under the button, "Your
earlier plan · ahead by $12,400" (a `part()` of kind `how` with a pinned title, `qa/first-view-lib.mjs` `PINNED_TITLES`).
Inside: one sentence, the two figures, what counts as savings, and the day the plan was kept. It reads the plan and writes
nothing.

**One sentence per case** (`sentenceOf`, each with a test):
- ahead: "Your savings are $12,400 ahead of where last November's plan put them, about 3 months of your usual saving."
- behind: "Your savings are $8,000 behind where last November's plan put them, about 2 months of your usual saving." Never an alarm:
  no colour, no notice, no warning word.
- on plan (under $100, or under 1% of the expected figure): "Your savings are right where last November's plan put them."
- ", about N months of your usual saving" is left out under one month or when the plan saves nothing; from 24 months it is said in years.
- The plan is named by its month: "last November's plan" (last calendar year), "this May's plan" (this year), "your
  December 2024 plan" (older).
- Status beside the title, at most 20 characters: "ahead by $12,400", "behind by $8,000", "on track"; a figure too
  long for the line leaves "ahead" or "behind".
- Old balances (`staleWords`): when the oldest counted balance (an account in the projection's buckets that holds money and
  has an "as of" day, `oldestBalance`) is more than one month old, a line under the sentence says "This compares the
  balances on file, the oldest from May 3, 2026. Update your balances for today's answer." with a way to Update my
  balances (an outlined button), and the second figure is labelled "Your savings on file" instead of "Your savings today". A balance held still
  for a year would otherwise read as "behind" with no hint why.
- Nothing to say (`against` gives null, no row): the plan saves nothing today and the savings are under $5,000 on the day
  the path was kept, by the path today, and in the accounts today (`MIN_PATH`). "Right where the plan put them" about $2,000
  and a few dollars of interest is noise. For the same household the save promises nothing and the "From <day>" line is
  not shown (`tooSmall`); the path is kept all the same, in case saving starts.

**Data.** `plan.pathSnapshots` (docs/DATA_MODEL.md): `{ at, start, points: { [year]: savings }, lastsTo, inflation }`. No second store:
it sits beside `netWorthHistory`, is written in the same `store.update` as "Save today's totals" and removed with that
day's totals by "Remove". At most one a month (the same day replaces, another day of that month writes nothing), at most
24. A household with no projection yet (no birth date, no spending figure) keeps nothing.

**Formulas** (all in `path.js`, pure; the path itself is `modules/retirement/projection/compute.js`, whose sources are in
its README; nothing here is a figure from outside the plan).
- `snapshotOf`: `start` = the projection's starting balances added up (cash + taxable + pre-tax + tax-free, its
  `BUCKET_OF` kinds); `points[startYear + i]` = `rows[i].totalReal`, rounded to dollars, for the first 10 rows.
- `expectedAt(snapshot, today, inflation)`: `years = days since the snapshot / 365.25`. The path's marks are a year apart:
  mark 0 = `start`, mark k = row k-1. A row's `totalReal` is in the prices of the day the path was kept, and the
  projection's first year is at those prices (`core/math/retirement.js`: the price level is 1 in row 0 and x (1 +
  inflation) each row after), so mark k in the money of its own day = `points[year0 + k - 1] x (1 + inflation)^(k - 1)`,
  with the inflation that plan assumed, kept in the snapshot as `inflation` (a snapshot without it is read with the plan's
  inflation of today), so changing the assumption later does not move a path already kept. `expected` = the straight line
  between the two marks around `years`.
- A path kept in the middle of a year: the projection's first row is one full year of growth and saving from the day it is
  run, whatever the month, and `expectedAt` reads it that way (mark 1 is one year after the day the path was kept). It is
  the same rounding the projection itself makes; it is not sharpened here.
- `isDay`: a date counts only when it is a real calendar day ("2025-13-45" and "2025-02-30" are refused), in `snapshotOf`,
  `keepSnapshot`, `pickSnapshot` and `expectedAt`.
- `against`: `now` = today's savings in the same buckets; `ahead = now - expected`; `months = |ahead| / monthly saving`,
  the monthly saving being the projection's contribution rows that run this year (`monthlySaving`), employer match included.
- `pickSnapshot`: the entries at least six months old (`addMonths(today, -6)`), the one closest to 365 days old.

**Choices where the spec was silent or wrong.**
- The spec interpolates "between the snapshot's points for this year and next" and then adds inflation "over the time
  since the snapshot". Against the engine that is wrong twice: a row is the savings one more year after the day the plan
  was kept (whatever the calendar year), and its first row is already in that day's prices. Read the spec's way, a
  household that followed its plan to the letter would show a year of growth and 3% of its savings "behind". The marks
  above are tested against the projection's own rows (a plan followed for four years lands on row 4's own total).
- `start` is one more field than the spec's shape: the line needs the savings on the day the path was kept.
- Ten years of points, not the whole projection: 24 snapshots stay small in the plan file; a path older than ten years
  says nothing.
- The title is "Your earlier plan", not "Against last year's plan": the path compared can be six months old, and with its
  status it reads as one short line that fits a 320 px screen ("Your earlier plan · on track").
- The spec says the page is unchanged until a snapshot is six months old. Two small things do show before that, because
  otherwise nobody learns the comparison exists: the save's own confirmation says the plan is kept too, and a household
  that has a kept path gets the one "From <day>, this page also says..." line. The standing help text of the card is not
  touched, so a household with no kept path sees the page of before, word for word.
- "about 3 months of your usual saving", not the spec's "of saving": read alone, "20 months of saving" does not say whose
  saving or at what pace.
- The $5,000 floor (`MIN_PATH`) and the one-month age for a balance (`STALE_MONTHS`) are this page's own choices, not
  figures from outside; both are constants in `path.js`.
- The page was not converted to the simple-first layout in this change (opt spec C8): the brief asked for a page identical
  to before without a path. `tests/first-view.known.json` is unchanged (the new row is a shut part: no figure on the first
  view beyond its status, and only for a household with an old path).
- Markets move this as much as saving does, and the part says so in plain words instead of judging the person.

## One filled button (review N3, 2026-11-11)
While the green line offers a filled way on, "Save today's totals" is outlined: one filled button on the screen. (The rest of
this README was cut by mistake in that change, a624d22; it was put back in the C10 change.)

## Our guess for a balance left empty (smart guesses C6, 2026-11-14)
The balance box of the add and edit forms shows our guess grey for the kind of account picked under Type (the form kit's
`guess`, docs/CONVENTIONS.md "Guesses"). Left empty, the account is saved at that figure, counted in every total and marked
in the ledger (`markGuess`; `compute` already reports `guessedAssets`, `guessedLiabilities` and `partlyGuessed`, C2). A typed
figure is the person's, even equal to ours. The box is not required while it shows a guess; with none it is required as
before.

| Type | estimator (modules/overview/guesses, its README has every formula and source) | worked out for |
|---|---|---|
| Checking, Savings or money market, Cash | `account.cash`: the Survey of Consumer Finances' median transaction-account balance by income and age | the household |
| 401(k) / 403(b) | `account.retire.balance`: Vanguard's How America Saves balances by pay and age | the owner under "Whose account" (else the first adult), via the path `accounts[setup-have-retire-<pid>].balance` that Get started's own use |
| Traditional IRA, Roth | `account.ira.balance`: the survey's median retirement-account balance among holders by income and age, the owner's share by pay | the owner, as above |
| Investments outside retirement | `account.invest.balance`: the survey's median pooled investment funds among holders | the household |
| A home or land | `home.value`: the state's median home value (ACS) by income and age, or what was paid grown with the state's home prices | the household |
| Vehicle | `account.car.value`: the survey's median vehicles value over the household's vehicles (CE) | one car |
| Credit card, Car or personal loan, Mortgage, Student loan | `debt.<kind>.owed`: what families like this owe (the survey by income and age; a mortgage from FHFA and the purchase) | the household |

`balanceGuessKey(plan, type, id)` (pure, in compute.js) says whether a kind gets a guess: only a kind with a table; only while
no other account of its group is on file (bank accounts; 401(k)s; IRAs and Roths; investments; homes; cards; loans;
mortgages; student loans): the table is the household's whole figure for it, so a second one would be counted twice. Cars are
never grouped (a second car is worth what a car is worth). Bank accounts get none when Get started was told of both checking
and savings (it shares one figure between the two). No guess for a file's account added from Import (it waits at $0, as
before), nor outside the U.S. (`applies`). The grey figure follows Type and, for a retirement account, Whose account
(`ui.setGuess`).

The grey figure is worked out twice: first for the kind (and owner), then again on a copy of the plan that already holds the
new account as the save leaves it (its kind, its owner, that figure, marked as ours), on the path the plan keeps it under,
through `ctx.guess(key, { path, plan: draft })`. The second is what the box shows, what the save writes and what the green
line says, because it is what settle counts once the account is on file (review round 2, F1: a home for a couple in Texas who
owned none showed $330,000 grey, and once it was on file, an owner's, the plan counted $270,000; `home.value` reads the
household's tenure). For every other kind both readings are the same (test over every kind, three households). When the
second reading gives none, the box is asked, as for a kind with no table. A household that already has an account of a kind
gets no guess for another of the same group: one rule for every household (Family, with three bank accounts on file, is
asked for a fourth's balance, and offered one for a first car or student loan).

- A balance still ours reopens empty and grey, with "This balance is our guess for now. Type the real one; left empty, it
  stays our guess." Its line under the box is the one Add showed ("Our guess: a typical bank balance."), read again for the
  account on file; "what we filled in for now" only when today's reading is another figure than the one counted (review
  round 2, P2: a bank balance of ours reopened with "what we filled in", because the Cash guess took the account itself out
  of the survey's total, came to nothing, and froze; `account.cash` now leaves out the account it is guessing). Saved empty
  again, nothing changes (the same entry, its date kept); a guess puts no point in the
  account's history (nobody saw that balance). Typed over, it is the person's (as before: the old figure becomes a point),
  and it is never asked about as a typing slip of our figure (review fix F3, 2026-11-14: "was $41,000 a typing slip?" about
  a figure nobody typed).
- On Edit, a balance the person typed gets no guess: the box stays required, as before C6 (review fix F2: cleared, it saved
  our $130,000 over a typed $500,000 with no word and no history point). A guess is offered on Edit only while the balance
  is ours or nothing is on file. Cleared and saved, the box says "Type the balance, or tap Cancel to keep $11,500." ("the
  amount owed" for a debt, "the value" for a home or car), so the way back is in view (review round 2, P5).
- The green line: "Work 401(k) added. Its balance is our guess for now: about $2,200." (the row under it says how to change
  it, "Our guess for now. Tap Edit to type the real one.", so the line does not say it again: review fix P5; the row's words
  as a sentence: review round 2, P3).
- When every balance counted is ours (a first account saved empty), the hero's line says "A rough start, from our guesses.
  Type the real balances below." instead of "Partly ..." (review fix P1; round 2 P1: calmer than "All our guesses"). The
  guess itself stays: the spec asks for the population's most likely figure when nothing is known (spec, first paragraph),
  and its line says so ("a typical bank balance").
- No grey example in a box (grey means counted): the name box's hints ("e.g. Visa card") are its help line, "For example,
  Visa card."; the plain add form's, and `?add=checking`'s, is "For example, Main checking." (no real bank named: review fix
  P6).

Tests (`module.test.mjs`, "C6 ..."): the key rules and the retirement path; a 401(k) added empty is guessed, counted,
marked and said; typed equal is typed; reopened grey and saved unchanged; typed over; a student loan's owed is guessed and a
second card is not; the grey figure follows Type; none on Import, outside the U.S. or for a kind with no table; no grey
example in the name box; with no guess offered the form saves exactly as before (invariance). Review fixes ("C6 fix ..."):
no guess over a typed balance on Edit; no slip question over our guess; "A rough start"; the helpers read malformed data
(`plan.accounts` not a list, a null person) without throwing (F6). Round 2 ("C6 round 2 ..."): grey equals counted for
every kind in three households, the Texas home and the spouse's 401(k) named; Edit says Add's why and a bank guess follows
the household; the words for a typed balance cleared on Edit.

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
Only when the plan holds one (gap list, next 60, item 45; additive): `metals` (each account held by weight, `metals.js`
`metalOf`), `privates` and `keepReady` (each private investment, `private-fund.js` `privateOf`, and what they can still ask
for in all). Neither moves a total: both read the balances above. See "Gold and silver by weight; a private investment".

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

## Gold and silver by weight; a private investment (gap list, next 60, item 45) -- `metals.js`, `private-fund.js`

**What a person sees.** Nothing new on a plan without them (digests, below). The way in is the add or edit form, which is
not in the first view once there are accounts: when Type is "Something else I own", one box shows under it, **"What it
is"**: "Something else: I type what it is worth" / "Gold, by its weight" / "Silver, by its weight" / "A private fund, or a
share in a business". The Type list is unchanged and the box is hidden for every other kind (its label gets `hidden` and an
inline `display: none`: base.css's `.field { display: flex }` outranks the hidden attribute, which is also why the old
"Bank or company" box still showed for a thing picked under Type; it is hidden the same way now).
- Gold or silver: in place of the worth box, "How much gold" (or silver), "Weighed in" (ounces (troy) / grams), "Price of
  one ounce" ("Type the price you see: this app never looks prices up."); the date box reads "Price as of". Save
  writes the balance (ounces x price, to the cent) and that day as `asOf`, and says "Gold coins added: 10 ounces of gold at
  $2,400.00 an ounce, $24,000." with Undo. The row: "10 ounces of gold at $2,400.00 an ounce, your price of 11/10/2026";
  once the balance is changed elsewhere (Update all balances), "10 ounces of gold, about $2,450.00 an ounce going by its
  balance of 11/20/2026" (that price was never typed, so it is not called "your price").
  An empty weight or price is refused at its box ("Type how much gold you hold.", "Type the price of one ounce.").
- A private investment: the worth box reads "What it is worth now", the date "Worth that on", and one more box, "Still
  promised" ("money you agreed to put in but have not put in yet; leave it empty if none"). Save says
  "Fund II added. Next: what you put in and when, under Private investments below." with Undo, and that row opens once.
  The account's row: "as of 9/30/2026 · about 5.5% a year" and, with something promised, "It can still ask for $40,000:
  keep that ready." (never folded: money the person must have on hand).
- **"Private investments"**, one quiet row (kind `item`) in a parts card under the list, drawn only while one is on file.
  Status: "keep $40,000 ready" (or "$1,250,000 promised" when that does not fit 20 characters), else the one investment's
  "about 5.5% a year", "not set yet", or "2 investments". Inside, for each: its name, one sentence (six cases, below), the
  stale line when its worth is older than money that moved, the keep-ready line, its dated amounts newest first ("Dec 15,
  2025 · Paid back to you" / "$8,000", each with an outlined "Remove" that asks first; at most 10, then "and N earlier
  amounts, counted above."), then one form, "Add money in or out" (open while nothing is typed, else behind "+ Add money in
  or out"): Which one (two or more), "What happened" (You put money in / It paid money back to you), "How much", "On", and,
  when something is promised, the tick "It was money the fund asked for: take it off what is still promised" (on). Its
  "Add it" is the row's one filled button. The green line names the new return ("Added: $25,000 put into Cafe share on
  Apr 1, 2023. Its own return is now about 5.2% a year."), with Undo; the row stays open (R17). Last, one muted line on
  how the return is worked out.

**Data** (optional, no version bump; the type stays `other_asset`, so every other page counts these exactly as before):
`accounts[].metal?: { kind: "gold" | "silver", weight, unit: "oz" | "g", price }` and `accounts[].private?: { flows: [{ id,
date, kind: "in" | "back", amount }], promised? }` (docs/DATA_MODEL.md). The balance stays the one figure every page reads.

**Formulas.**
- A troy ounce = 480 grains x 64.79891 mg = 31,103.4768 mg = 31.1034768 g (the grain is defined as exactly 64.79891 mg;
  gold and silver are priced per troy ounce). nist.gov (Handbook 44, Appendix C), uscode.house.gov (31 U.S.C. 5112) and
  usmint.gov refused this session's reads (2026-11-16), so the definition is written out and the arithmetic is a test.
  Ounces = grams / 31.1034768. Worth = round(ounces x price of one ounce, to the cent): 10 oz at $2,400 = $24,000; 100 g at
  $2,400 = 3.2150747 x 2,400 = $7,716.18; 1,000 g of silver at $31.45 = $1,011.14.
- The price the row says: the one typed while the balance still equals weight x it (to the cent); once the balance is
  changed elsewhere (Update all balances), the price that balance means, balance / ounces, said as "about ... going by its
  balance" (critic F2). The row never contradicts the balance.
- A unit of weight not on the list (a plan edited by hand: "kg") is not read as ounces: the account is not one held by
  weight and reads as a plain thing with its balance (critic F3). No unit saved is ounces, the form's first choice.
- Its own yearly return (`privateOf`, through core/math/returns.js `xirr`, the money-weighted return Performance uses too):
  the one rate r with sum(amount_i / (1 + r)^(t_i)) = 0 over money put in (negative, on its day), money paid back
  (positive, on its day) and what it is worth now (positive, on the worth's day; today when none), t_i in years of 365.25
  days from the first amount (Newton's method, bisection when it wanders). The reference pages for this rate (a
  spreadsheet's XIRR help, the SEC's investor glossary) refused this session's reads, so the formula is written out and
  tested against hand calculations: 100,000 in, worth 121,000 730 days later: (1 + r)^(730/365.25) = 1.21, r = 10.007%;
  100 in, 50 back a year on, worth 60 a year after that: with y = (1 + r)^(365/365.25), 100y^2 - 50y - 60 = 0, y =
  (50 + sqrt(26,500)) / 200 = 1.0639410, r = 6.39% (the sentence says "about 6.4% a year").
- Under a year from the first money in (365 days): no yearly rate (a few months made yearly misleads); the plain change so
  far, (paid back + worth - put in) / put in ("Up 12% so far"). Nothing back and worth $0: "Nothing is left".
- How many times = (paid back + worth) / put in ("1.30 times what you put in").
- Still promised: never a debt and never in net worth (nothing is owed until the fund calls it); it is the money to keep
  ready, said on the row and in the part, and summed as `keepReady`. A call added with the tick comes off it (at most all
  of it; none left removes the figure); removing that amount later does not put it back (Undo does).

**The sentences** (R5, each tested): none typed ("Add what you put into Fund II and when, and what it paid back, to see its
own yearly return."); under a year (up, down or even so far); a rate ("About 6.4% a year since January 2021: you put in
$100, got $50 back, and it is worth $60 now, 1.10 times what you put in."); a loss ("It has lost about 10.0% a year since
..."); all gone; no rate found ("Its yearly return could not be worked out from these amounts: ..."); the stale worth; what
to keep ready (one, and in all for two or more).

**Builder's choices.** No separate row for gold and silver (the form and the row line carry them; one price box for all
gold is an idea below). Platinum, palladium and a coin's purity are not asked (the person types the metal's own weight).
The dated amounts of a private investment live in its own row, not the account form, so that form stays at its boxes.
Saved as another kind, a private investment's amounts go after a question ("... they are no longer kept. Save it
anyway?"); Undo brings them back. Every save of these two kinds has the green line with Undo; every other save is as it
was.

**Tests** (`module.test.mjs`): the troy ounce and the weight conversion, the worth in ounces and grams, the price said,
every row line and green line; the rate against the hand calculations above, a loss, four amounts (npv 0 at the rate),
under a year (364 and 365 days), all gone, a worth older than an amount, what is promised (not in net worth); every
sentence and status (each at most 20 characters); adding in date order, a call off what is promised, removing, every
refusal; compute adds `metals` / `privates` only when there are some and moves no total; the form (hidden for another
kind, gold refuses an empty weight or price, saves the worth and says it with Undo, grams of silver edited with the old
worth kept on its day, back to "Something else" drops the weight, another Type puts the worth box back), a private
investment from the form to its row (open once, keep ready, an amount added and its new return, the tick, Undo, Remove
asks first), and saving one as something else asks first; invariance against dca545e (Net worth's compute, the page as it
opens, the page with the add form open, 48 plans).

**Found, not mine to change:** adding a "Something else I own" through the form shows "Not saved yet: what you typed in
'Add an account'" after the save, already at dca545e (a box hidden by a Type change seems to change the form's identity
for core/place.js, so the save does not forget its typing). Reported in the build log.

## Ideas / not yet
- One price box for all of a person's gold (or silver) at once, in a quiet row (each item is edited on its own now).
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

## Your own labels (gap list, next 60, item 44; 2026-11-15) -- `labels.js`, `labels-view.js`
- **What a person sees.** Nothing new until they label something. The account form (from the second account on: the
  first account's form is the empty page's first view and stays as it was) has "Your own labels" under "More details
  (optional)", with the help "For example, kids or retirement. Commas between two or more." and, under the box, a chip
  for each label already used anywhere in the plan (accounts and holdings): a tap adds it, a second tap takes it out.
  Once an account carries a label, the Accounts card shows one row of chips, "All accounts" then each label, a to z;
  a tap lists only the accounts with that label and says one line, written per case:
  "2 accounts labeled kids: $6,000." (things owned), "1 account labeled cards: $500 owed." (debts only),
  "2 accounts labeled car: $8,000 owned, $3,000 owed, $5,000 in all." (both). The labels show as quiet pills on the
  rows. The figures at the top stay the whole plan's.
- **Saved.** `accounts[].labels` (docs/DATA_MODEL.md): written by the form's own Save; absent when the box is empty (an
  emptied box removes it); the green line adds "Labels: kids, college." or "No labels now." when they changed. A label
  over 30 characters is held back at Save with words at the box: "Keep each label to 30 letters or fewer. Separate two
  labels with a comma." (`readLabels`; a long label is often two typed without a comma). A label already used keeps
  its first spelling ("Kids" typed, "kids" on file: "kids").
- **No invitation on the first view** (decided 2026-11-15, after a critic's note): until something carries a label,
  nothing on the page mentions labels; the box waits with the account's other optional details under "More details
  (optional)" on Add and on Edit. Simple first (design log 2026-11-12), and this page's first view is already over its
  word budget, whose counts may only go down. If the owner wants a hint, the place would be one quiet line in the
  "+ Add another account" form, not on the first view.
- **Rules** (`labels.js`, pure, imports nothing; Holdings uses them too): split at commas, spaces squeezed, two labels
  are the same when only capitals or spaces differ, nothing is cut. `labelTotals(plan, label)` in `compute.js` counts
  each balance as `compute()` does (`countedBalance`: an asset keeps its sign, a debt is what is owed).
- **Never the plan.** The label shown by the chips is a module variable for the visit (a reload shows all again, and
  Back leaves the page rather than stepping through chip taps: the address is not changed by a chip); a tap
  calls `ctx.redraw()` and writes nothing. A save that leaves the record outside the label shown puts the list back to
  all, so what was just saved is in view. No new localStorage key.
- **Net worth lists accounts only**: a holding's own label is not offered here (its value is part of its account's
  balance, which cannot be split by it); Holdings lists those.
- **Invariance.** With no label anywhere: no chip, no pill, no extra node on a row; `compute()` and the page's words
  are what they were at 154a597 over every invented household and fixture (the builder's scratch run, 2,828 runs and
  1,414 drawings); the form saved with the box empty writes the same record as before (no `labels`, no `labelsText`),
  tested on add and on Edit. `compute()` never reads labels (its module test sets labels on every account and compares).
- **Tests** in `module.test.mjs`: the rules, `labelTotals` and its three sentences, the save on add and on Edit, the
  removal, the words, the 30-character refusal, the first account without the box, the chips to pick, the filter (only
  the rows and the line change, `store.update` never called, the top figure the same), the invariance.

## One figure or item by item (gap list, next 60, item 11; 2026-11-16) -- `one-figure.js`

A person can keep a kind of account as **one figure** (typed and changed in one place) or list it **item by item**, as
before. Research Ux8 (Boldin, ProjectionLab: "one lump or itemize"). Get started already asks one figure per kind
(Checking, Savings, Retirement per adult, Investments, Credit cards...); this is the way, on this page, to go from
several rows to one and back.

- **What a "kind" is (a section).** One kind of account of one owner: Savings; Checking; Ana's 401(k); Ana's 401(k), from
  former jobs; My Roth; Credit cards. Key: `type|ownerId|formerJob|nameClass` (`sectionKey`). Offered for bank
  accounts (checking, savings, cash), investments (brokerage, crypto), retirement accounts (401(k)/403(b), traditional
  IRA, Roth) and cards and loans (credit card, car or personal loan, student loan, something else I owe). Never for the
  mortgage (tied to a home), a home, a car, something else owned, the HSA, college savings (one per child) or a policy.
  **Builder's choice, where the brief was wrong about the code:** the brief named four sections (bank accounts,
  investments, retirement accounts, debts), but this page has no sections, and one figure across kinds or owners would
  keep the sum and change answers: the retirement plan taxes a Roth and a 401(k) differently (`BUCKET_OF`) and reads
  contributions by the account's kind; Emergency fund reads checking apart from savings; the tax pages and Balance
  sheet by owner read the owner. Rows of one kind and owner are counted the same by every page, so one row with their
  total gives every page the same answer.
- **Names other pages read** are part of the kind (`nameClass`, the same patterns as those pages): a 401(k), IRA or Roth
  named "old", "former", "previous", "prior" or "rollover" is from a job left (retirement/contributions `atJob`, Goal seek,
  levers); a Roth named for a 401(k), 403(b), 457, TSP or thrift plan is one through work (contributions `limitKind`); a
  401(k) named 457, TSP or thrift is not a 401(k) for the limits (investments/limits `NOT_401K`); a loan whose name or bank
  says car, auto, vehicle or truck is a car loan (insurance/property). So "Old job 401(k)" and "Rollover 401(k)" go
  together, apart from the 401(k) at the job she has now, and a car loan apart from a personal loan. Put together, a row of
  those kinds (401(k), IRA, Roth, loans: `NAME_READ`) keeps the kept row's own name, so it is read as before; the others
  take the kind's name ("Savings", "Credit cards"). A row named "Credit cards" is what Import calls Get started's one line
  for every card (`isCardLump`): a card's file is not taken as its balance, which is right for one figure.
- **First view: nothing new** unless a kind can change: two or more of its rows can go together, or it is one figure
  now. Then one quiet row at the foot of the Accounts card, above "+ Add another account": the part "One figure or item
  by item" (`core/ui/more.js` `part()`, kind `own`, title pinned in `qa/first-view-lib.mjs`), shut, status "1 can be one
  figure" / "2 as one figure" (no money). None of the invented households has such a kind (their repeated kinds are
  credit cards and student loans with their own rates on Debts, college savings, homes and cars), so no first view moved.
- **One tap away**: one sentence ("Keep a kind of account as one figure, typed and changed in one place, or list each
  account on its own. Either way your net worth counts the same, and so does every plan that reads it."), then per kind:
  its name and "3 accounts, $14,700 in all", or, when some of its rows stay on their own, what one figure would hold: "2 of
  3 accounts can be one figure, $3,200" (review 2026-11-16 P1: the line said $14,700 while the question replaced only
  $3,200); one figure: "One figure: $3,200", "...with 1 more on its own", "...owed". Then two chips (`choice()`): **One
  figure** / **Item by item**, and one muted sentence for each row that stays on its own.
- **One figure** asks first, in place (no filled button): "Replace Holiday fund and Old savings with one line, Savings:
  $3,200? Ally savings stays on its own. Your net worth stays $290,300." [Replace with one line] [Keep them as they are].
  While it asks, the **One figure** chip is the one lit (review 2026-11-16 P2: the old choice stayed lit and the tap
  looked lost); Keep them as they are, or a tap on Item by item, takes the question away and lights the old chip again.
  Nothing is written until Replace. Replace is one `store.update` through `ui.undoable`; the part stays open (R17) with the
  green line "Savings is one figure now: $3,200, in place of 2 accounts. Ally savings stays on its own. Your net worth is
  still $290,300." (the rows that stay are named, so a "Savings" row beside "Ally savings" is no surprise) and an outlined
  Undo, which puts every row back exactly ("Put back: Holiday fund and Old savings. Your net worth is still $290,300.").
  A kind of one row is only marked ("Chase savings is one figure now: $500. ..."), its name kept. As with every Undo line
  (docs/CONVENTIONS.md "Back, Forward"), the shell puts the green line back when the person looks at another page and
  comes Back while the plan is unchanged, so the way back is not lost.
- **Item by item** removes nothing, so it asks nothing: the one row stays as the first of the list. "Savings is item by
  item now. List each one: tap Edit on its line to rename it, then + Add another account." (short for a phone: review
  2026-11-16 P4). With Undo.
- **In the list** the row that holds a kind's figure says "One figure for your savings accounts, as of 9/1/2026" (under
  its name on a wide screen). Its Edit form is the usual one: one balance box, typed once, edited once.
- **Adding** another account of that kind and owner here takes the mark off, and the green line says "Rainy day added.
  Savings is item by item again: each account is on the list." (`unmarkOnAdd`). An account added on another page
  (Update my balances, Import, Get started) leaves the mark, and the kind reads item by item because a free row now
  stands beside it.

**Which row holds the figure, and which stay on their own** (`sectionsOf`): the row marked, else Get started's own row
(`setup-...`, so Get started's question shows the total), else the biggest; never one whose balance another page reads
by its id. A row stays on its own, with one sentence each (`<name> stays on its own: <why>.`), when the plan keeps its
id anywhere outside `accounts` (a scan of the plan, `pointedAt`, so a new place is never missed): it has bank lines in
your ledger / bank files were imported into it / it has investments listed in it / its statements were checked against
it / a rule files bank lines into it / a bank file layout points at it / a goal draws on it / its rate and payment are
on Debts / your debt plan puts it in its own place / a home or rental is linked to it / a contact is linked to it / it
has beneficiaries / a money move in your retirement plan uses it / another page keeps something about it; or its
balance is our guess for now: type the real one first; or it carries labels of its own; or it is an answer in Get
started (a second Get started row); or the app cannot tell it apart from another account on your list (its id is missing
or another row has the same one: migrate keeps such rows, and a change by id cannot say which row it is for; review
2026-11-16 F3, where three savings rows "a", "a", "b" put together removed all three). A contribution is no reason: it
follows the row (same kind, same bucket). Rows are removed by which row they are, never by id.

**Formulas** (all arithmetic on the person's own figures; no outside figure is used, so nothing here has a source to
date). For the rows R put together into the kept row k (`asOne`):
- balance(k) = Σ countedBalance(r), r ∈ R, to the cent; a debt is what is owed (|balance|), stored with k's sign.
  Example: Holiday fund $2,400 + Old savings $800 = Savings $3,200.
- asOf(k) = the earliest "as of" among R: the one figure is no fresher than its oldest part, so a part that was due for an
  update still asks for one (Update balances, the stale-balance alert) until the person types the new total; the latest
  would hide an old part. **Builder's choice** (review 2026-11-16 F5). typedOn(k) = the latest `typedOn` among R (the
  total as it stands existed only from the day its last part was typed; Update balances' slip fix moves saved totals
  from that day), or none when no row has one.
- history(k), `mergedHistory`: from s = the latest of R's first point days (the first day EVERY row has a figure), over
  the days D ≥ s on which any row has a point, h(d) = Σ b_r(d), b_r(d) = r's latest point on or before d. Days before s are
  left out: counting a row as 0 before its first point showed that point as growth (review 2026-11-16 F2: two brokerage
  rows, one saved from January, one only from September, read as a 520% return on Performance, which reads
  `accounts[].history`). A row with no point at all: no day qualifies, and the history starts afresh (Save today's totals
  adds the first point; Undo gives the old points back). For a debt each b_r(d) is what is owed, |point|, and h(d) takes the
  kept balance's sign (F4: points -400 and +250 are $650 owed, -650, not -150). Example: Holiday fund 9/1 $2,000, 10/1
  $2,300; Old savings 10/1 $790 -> 10/1 $3,090 (9/1 left out: Old savings had no figure then).
- institution(k) = the one they share, else blank; notes(k) = their notes joined with " · "; owner, kind, labels as k's
  (equal by the rules above); the name is the kind's name ("Savings", "Credit cards"), or k's own for a kind whose name
  other pages read (401(k), IRA, Roth, loans).
- every `retirement.contributions[].accountId` in R \ {k} becomes k.
**Why every total stays the same**: each page adds rows, and k has the kind, owner and bucket of every row it replaces, so
each page's sum over the kind is the same sum. Tested to the cent: `module.test.mjs` (Net worth's figures, the retirement
plan's balances, contributions by bucket and its answer, after One figure and after Item by item again) and
`tests/one-figure-totals.test.mjs` (every invented household, each eligible row split in two and put back together).

**Data**: `accounts[].oneFigure` (optional, `true`; docs/DATA_MODEL.md). A kind is "one figure" when a row carries the mark
and every other row of the kind stays on its own. No total reads it.

**Invariance**: with no mark anywhere, Net worth's and Income's compute, Paycheck, the Federal estimate, the retirement
inputs and projection, and the words of this page and Income are byte for byte those of a491122 over every invented
household (`tests/one-figure-invariance.test.mjs`).

**Not done**: no "Bank accounts" figure across checking and savings, and none across people (it would change answers);
Get started is not edited (a Get started row is kept, never removed); a debt with its rate on Debts stays on its own (the
payoff plan pays each one by its own rate and payment).

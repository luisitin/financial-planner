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

## A mortgage balance of ours saved here (2026-11-11, loans lane fix round 1)
Saving the account form makes the balance the person's. For a mortgage whose payment was read with tax and insurance of ours
inside it, that figure is kept on the loan (`overview/guesses estimators/home.js escrowBefore` and `escrowKept`), so the payoff
date on Debts does not jump when a balance is confirmed.

## One filled button (review N3, 2026-11-11)
While the green line offers a filled way on, "Save today's totals" is outlined: one filled button on the screen. (The rest of
this README was cut by mistake in that change, a624d22; it was put back in the C10 change.)

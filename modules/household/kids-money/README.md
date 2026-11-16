# Children's money  (`household/kids-money`)

**Status:** usable (gap list, next 60, item 57; map U10), phase 10
**Purpose:** Each child's allowance, their own money, and what it could grow to by 18.

For each child in the plan: an allowance (how much and how often), what it is meant to cover, and the money the child
holds of their own (a savings jar, a kids' bank account, a custodial account in the child's name). One quiet row shows
what that money could become by 18 if a share of the allowance is saved, and a line on the kiddie tax appears only when
a custodial account's earnings could reach the IRS figure. Nothing here changes the household's budget unless the person
taps "Add allowances to spending" (asked first, with Undo).

## Inputs
Plan sections read (`needs`): `household` (the people: a child is a `dependent` under 18 or with no birth date; their
`childMoney`), `expenses` (the lines "Add allowances to spending" wrote, by id), `assumptions` (`returnCash`,
`returnStocks`, `inflation`), `whatIfs` (`kidsMoney`, the two picks under "Growing it").
Written (`writes`): `household.people[].childMoney` (a child's form), `whatIfs.kidsMoney` (a chip), `expenses[]` (only
"Add allowances to spending" / "Update allowances in spending").
Parameters of `compute(plan, params)`: `today` ("YYYY-MM-DD"; without it no age, no months to 18 and no growth).

New optional fields, no version bump (docs/DATA_MODEL.md, `household` and `whatIfs` rows):
- `household.people[].childMoney?: { allowance?, period?: weekly|biweekly|monthly, covers?, jar?, bank?, custodial? }`:
  dollars each `period`; what it is meant to cover (text, at most 120 characters); dollars held in each place. An empty
  box removes its key, an empty form removes the field. Read only by this page. It is the child's money, so no total of
  the plan counts it (not Net worth, not the budget).
- `whatIfs.kidsMoney?: { share: 0|0.25|0.5|1, grow: "jar"|"savings"|"stocks" }`: absent reads as half and a savings
  account. A calculator's choice, never counted in the plan.
- Expenses lines with id `kids-money-<child id>` (no new field): name "<Name>'s allowance", category `other` (in no Get
  started spending row, so no guess and no left-over check moves), `essential: false`, `inflates: true`, `endDate` the
  18th birthday when the birth date is known. After that they are ordinary bills: edited or deleted on Expenses. A line
  whose child is no longer listed (18, or taken off People) is the household's bill and is left alone.

## Outputs
`compute()` returns `{ case, kids, older, totals, pick, spending, growing, kiddie, kiddieRule }`:
- `case`: `"none"` (no dependent), `"older"` (dependents, all 18 or over), `"start"` (children, nothing typed), `"set"`.
- `kids[]`: `{ id, name, birthDate, age, money (moneyOf), monthly, own, hasAny (anything typed), hasMoney (an allowance
  or money held), months18, grow: { value, monthlyIn, realRate } | null, kiddie: { age, now } | null }`.
- `older[]`: `{ id, name, age }`; `totals`: `{ monthly, own, custodial, withAllowance, withSaved }`.
- `pick`: `{ share, grow, rate, rates: { jar, savings, stocks }, inflation, picked }` (`picked`: a chip was tapped, so the
  picks are the person's; else both are our guess).
- `spending`: `{ rows: [{ childId, childName, expenseId, name, amount, period, monthly, endDate, state: new|same|differs|remove,
  why?: amount|end }], todo, monthly, allNew, onlyEnds, lookalike: [{ id, name }] }`.
- `growing`: "Growing it" is shown (a child with a birth date has an allowance or money held).
- `kiddie[]`: `{ name, age, now }`; `kiddieRule`: the 2026 figures and their sources.
Every sentence on screen is a function of compute.js (`answerFor`, `rowWords`, `savedLine`, `spendLine`, `spendConfirm`,
`spendDone`, `growLine`, `growSaved`, `kiddieLine`, `howSteps`, ...), one per case, each with a test.

## Formulas
1. **An allowance a month** = amount x times a year / 12: 52 for every week, 26 for every two weeks, 12 for every month
   (`core/math/periods.js` `perMonth`). $5 a week is 5 x 52 / 12 = $21.67, "$22 a month".
2. **What a child holds** = jar + bank + custodial (each an amount above 0; anything else counts as 0).
3. **Months to 18** = whole months from today to the 18th birthday (`core/math/dates.js` `monthsBetween`, `dateAtAge`),
   never below 0; none without a birth date.
4. **By 18, in today's dollars.** The rate picked r is 0 for a jar, or the plan's own `assumptions.returnCash` (a savings
   account) or `assumptions.returnStocks` (a stock fund): the page claims no current rate of its own, and says the chips
   are examples. Prices rise i = `assumptions.inflation` a year. A rate or a rise in prices at or below -100% means nothing
   (Assumptions refuses it; only an imported plan could hold one) and reads as the default (2%, 7%, 3%), so the page never
   shows "Infinity%". The rate counted is the real rate
   rr = (1 + r) / (1 + i) - 1, monthly rm = (1 + rr)^(1/12) - 1. With P what the child holds, S = the allowance a month x
   the share saved (put in at each month's end; the allowance is taken to rise with prices, so S is the same in today's
   dollars) and n the months to 18:
   V = P (1 + rm)^n + S ((1 + rm)^n - 1) / rm, or P + S n when rm = 0.
   This is the textbook future value of a sum and of an ordinary annuity (the same sum as `core/math/finance.js` `fv`),
   written out so the real rate is plain. Worked: the invented family's Cy, 6 on 2026-11-16 (18 on 2038-03-03, 135
   months), $5 a week and $300 held, half saved at 2% with prices up 3%: rm = (1.02 / 1.03)^(1/12) - 1, about -0.081% a
   month; (1 + rm)^135 = 0.8961; V = 300 x 0.8961 + 10.83 x (0.8961 - 1) / rm = 268.82 + 10.83 x 127.91 = 268.82 +
   1,385.66, about $1,654.
5. **The kiddie tax line.** For 2026 the amount in IRC 1(g)(4)(A)(ii)(I) is **$1,350** (Rev. Proc. 2025-32, section 4.02,
   https://www.irs.gov/pub/irs-drop/rp-25-32.pdf, read 2026-11-16: "For taxable years beginning in 2026, the amount in
   § 1(g)(4)(A)(ii)(I), which is used to reduce the net unearned income reported on the child's return that is subject to
   the 'kiddie tax,' is $1,350."), and a child's unearned income over twice that, **$2,700**, is taxed using the parent's
   rate on Form 8615 (IRS Topic no. 553, https://www.irs.gov/taxtopics/tc553, page last reviewed 2026-09-24, read
   2026-11-16: "Use Form 8615 to figure the child's tax on unearned income over $2,700 if the child is under age 18").
   The amount is the dependent's standard deduction figure "as adjusted for inflation" (the same section), so it is
   compared in today's dollars. The line shows when a custodial account, growing at rr with nothing added, earns r x its
   value at the start of a year of at least $2,700 in some year before 18: the first such year gives "by age N" ("this
   year" for the first). A kids' bank account is not tested (the brief names the custodial account; a bank account large
   enough to earn $2,700 a year is rare), and the saved share of the allowance is counted in "what they hold" as a whole,
   not added to the custodial account. The page says "can be taxed at your rate": who must file and the exceptions (a
   child of 18, a student up to 24) are on the IRS page, not here.
6. **Add allowances to spending.** A line per listed child with an allowance: new (no line yet), same (the line's amount
   and period are the allowance's and, when the birth date is known, it ends on the 18th birthday), differs (`why`:
   "amount", or "end" when only the end date is not the 18th birthday, after a birth date was changed on People), or
   remove (the allowance was cleared and the line is still there). The button writes every line that is not "same" in
   one change (`ui.undoable`), asked first. With no birth date the page has no better end date, so a line keeps its own.
   **Counted twice?** A bill typed by hand on Expenses whose name says "allowance" or "pocket money" (and that has not
   ended) may be the same money: the spending line and the question before adding name it first ("Expenses already has
   “Cy allowance”. If that is this allowance, your budget counts it already, and adding it here would count it twice."),
   and once this page's line is there too, "Expenses also has ...". The page warns and lets the person decide; it never
   deletes or merges a bill typed by hand.

Sources that could not be read: none were needed beyond irs.gov. No rate of a savings account or a stock fund is cited:
the chips use the plan's own Assumptions and say "For example only".

## First view and parts
Kind `list` in the first-view check (`tests/first-view.kinds.mjs`). Simple first (`docs/OPTIONAL.md`):
- **No child** (case none, or older): the hero's sentence and one filled link, "Add a child on People". Nothing else.
- **Children, nothing typed** (start): "Start with Mia's allowance: how much, how often and what it is meant to cover.
  What Mia has saved goes in the same place." (and "Then the same for Leo."), the one filled button "Set Mia's allowance"
  (it opens Mia's form under her row and hides while a form is open, so the form's Save is the one filled button), and
  the card "Each child" with one line per child ("Mia, 9 · No allowance · Nothing saved yet", outlined "Set allowance",
  the start button's own words; "Change" once something is typed).
- **Something typed** (set): the sentence ("Allowances come to $97 a month, and the children have $340 saved."; five
  written cases), one record per child (name and age; the allowance a month; how it is paid and what it covers; what is
  saved and where; outlined "Change"), six rows then "N more children" (`rest()`), the custodial line when any child has
  a custodial account, the dependents 18 or over named in one quiet line, and the spending line with its outlined button.
- Never folded: every green line (under the row saved, under the spending button, inside the part saved in), the spending
  line, the custodial line.

| part | kind and title | holds | status |
|---|---|---|---|
| `grow` | own, "Growing it" (pinned in `qa/first-view-lib.mjs`: two rows of chips and no box, so not "Set my own numbers") | the share of the allowance saved (None, A quarter, Half, All of it), what the savings earn (A jar: 0%, A savings account and A stock fund at the plan's own rates), "For example only", each child's figure by 18, the kiddie tax line when it applies | "our guess · half, 2%" until a chip is tapped (R26; "our guess" alone when the rate's figure does not fit 20 characters), then the picks, "half, at 7%" |
| `how` | how, "How this is worked out" | the five steps with the household's own numbers and the IRS source with its date | "5 steps" |
| `kids` | more, "N more children" | the rows after the sixth (from `rest()`) | - |

"Growing it" and its working show once a child with a birth date has an allowance or money held (what it covers alone
has nothing to grow; a child with nothing typed reads "Leo: no allowance or savings entered yet." inside it). A chip saves the pick at once
(`whatIfs.kidsMoney`), keeps the part open and says the new figures (R7, R17). For the test's family on 2026-11-16 (Mia, 9,
$20 a week and $340 held; Leo, 5, $15 in a jar), "All of it" and "A stock fund: 7%" say "Saved: all of the allowance
saved, at 7%. By 18: Mia about $10,772 and Leo about $24."

A child's form (opened under the row, `ui.openUnder`; Cancel shuts it): Allowance ("For example, $5 a week. Leave it
empty for none.": a labelled example in the help line, never grey text in the box, which means our guess), How often
(every week by default), What it is meant to cover ("For example, snacks, toys or saving for a bike."), In a savings jar
or piggy bank, In a kids' bank account, and under its own line "An account in Mia's name (optional)" (the kit's
`moreLabel`, so a parent with one sees where it goes) In an account in Mia's name (custodial), with "It belongs to Mia:
you manage it until the age your state sets, then it is Mia's." Save writes `childMoney` in one change with Undo ("Saved.
Mia's allowance comes to $87 a month, and Mia has $340 saved."; "Saved. Mia's allowance comes to $87 a month. No savings
entered yet."; "Saved. Mia has $340 saved. No allowance entered yet." / "Mia's money is back as it was."); a Save that
changes nothing writes nothing and says "Nothing changed: Mia's money is as it was." A stored allowance with no period
reads as monthly and cleans to monthly (`cleanMoney`), so an unchanged Save of it writes nothing.

"More on this": "Is everyone in your plan?" (People), "What do you spend each month?" (Expenses), "What will college
cost?" (Education (529)).

Builder's choices (the brief left them open):
- A child is a dependent under 18 or with no birth date; a dependent 18 or over (a grown child, a parent cared for) is
  not listed, and is named in one quiet line when there are children too.
- The money is kept on the child, not as accounts: the app has no custodial account type, and the money is the child's,
  so no total counts it. A custodial account already typed on Net worth is the person's own choice and is left alone.
- The rate chips are the plan's own Assumptions (no current figure claimed), and the growth is in today's dollars, as
  the app says elsewhere: a jar's money buys less each year, which the working says in words.
- One child's button reads "Add the allowance to spending"; two or more, the brief's "Add allowances to spending".
- A bill typed by hand that looks like an allowance is named before adding (critic M1, 2026-11-16), not refused: the
  page cannot know it is the same money ("Clothing allowance" is not), and the person can still add theirs.
- The empty page names the exact choice on People ("where it asks “Who is this”, choose “Dependent”, the choice for a
  child you support"): People's own option says "Dependent", so the page says the word the person has to find.
- The allowance lines end at the 18th birthday and rise with prices; category "Other", not a must-pay bill.

## Edge cases
Empty plan and no people: case none. Dependents only 18 or over: case older. A child with no birth date: listed ("Sam, age
not known"), no figure by 18 ("Sam: add a birth date on People to see this."), no end date on the spending line. Not born
yet: "Kit, not born yet", months counted from today. 18 this month: "about $100 at 18", "18 this month". A period not
known reads as monthly; an amount that is not above 0 counts as 0. A rate equal to the rise in prices (rm = 0): the plain
sum. A line on Expenses edited by hand (renamed): Update keeps its name and category, sets the amount, period and end.
A line whose end date is not the 18th birthday (the birth date changed on People, or the end was edited on Expenses):
"Cy's allowance on Expenses ends on another day than the 18th birthday." with "Update allowances in spending" ("Make
Cy's allowance on Expenses stop at the 18th birthday?"); a birth date cleared on People leaves the line's end alone.
Assumptions with inflation at -100% (an imported plan): read as 3%.

## Tests
`module.test.mjs`: every formula (the allowance a month, what is held, months to 18, growth by hand at four rates, the
family's Cy, the kiddie tax figures and its first age, the picks, who is a child, the spending lines' states and what
`applySpending` writes, `cleanMoney`); every written sentence case (none, older, start with one, two and three children,
set with both, allowance only, savings only and only what it covers, the row, the green lines, the spending line's five
cases with their confirm and done words, Growing it's status, labels, lines and green line, the kiddie line's three
cases, the five working steps); the page on the stand-in DOM (no child, older, start: the filled button opens the form
under the row and hides; the form's boxes and fold; a Save with Undo; an empty form removes the field; a Save with nothing
changed writes nothing; something typed: the first view word for word with no box, Growing it holds no box; S11: a chip
keeps its part open with its green line and a row's Save opens no part; the kiddie line; Add allowances to spending asks
first, writes the lines, Undo takes them off, Update changes them); invariance: no plan holds the new fields and
migrate adds none, and with child money and picks typed on every child of seven households, 101 pages that read the
household, the bills or the calculators' choices give the same output (People's echo of the record, a page's copy of the
plan and Diagnostics' count of the plan's characters aside).

## Ideas / not yet
- Chores that earn part of the allowance; a child's own goal ("a bike, $180, by June") with weeks to get there.
- A child's own money at the bank by name (an account of the child's in `accounts`, kept out of Net worth).
- The kiddie tax worked out in dollars (Form 8615) for a custodial account above the line.

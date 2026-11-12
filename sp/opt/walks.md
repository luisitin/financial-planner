# Walks: five people on a phone, looking for what should be optional

Tip **737fb6a**, served from the read-only worktree on port 9811 (stopped). Everything in the sandbox, real touches
(Playwright touch taps, typed boxes, a real file chooser), 390 x 844, and one person a second time at 320 x 568.
Nothing in the repo or the worktree was edited. Screenshots, scripts, logs and recorded counts are in
`$SP/opt/walks` (624 PNGs; the ones cited below are named in full).

What "walked" means here: I was five invented people, one after the other. Each answered Get started with their own
figures, tap by tap, to the reveal; then Dashboard, Your plan, and the twelve pages, opening, typing and saving the way
that person would. Where the report says a person "stopped", that is my judgment of a screen that asks for something
this person does not know, or uses words they would not use, backed by a count. No real people were asked.

How things were counted. "First screen" is what fits in 844 px before any scroll (568 px at 320). Words are words of
visible text; "figures" are dollar amounts, percentages and long numbers; "controls" are everything a thumb can press
(links, buttons, boxes, folds, chips). "Screens" is page height / 844.

In flight, not repeated here: wave 1 (place memory for opened sections across redraw, Back and reload; form kit), and
the retirement request L1-L8 (L2 "What this rests on" on Will the money last?, L3 Contributions landings and match
check, L5 Assumptions chips careful/middle/hopeful, L6 pay the tax later or now per row, L7 pay stub reader, L8
OFX import). Where a finding touches one of them it says so. None of the twelve pages is one of claude-a's 13 folders;
two recommendations add a link *to* a claude-a page (Balance sheet, State, Consolidation), which needs no edit there.

---------------------------------------------------------------------------------------------------------------------

## 0. The short version

1. **The app already opens short on a fresh plan.** After Get started, 10 of Sam's 14 pages and 8 of Dana's are under two screens; the
   Dashboard leads with three verdict rows and one filled button; empty pages say what to do first. The "less" people
   were stopped by five things, not by the whole app: the long question screens of Get started, the step pages of the
   path, forms that show every box, three pages that speak in several figures per sentence (Federal estimate, Will the
   money last?, Debts), and pages that do not apply to them but show their full machinery anyway.
2. **The app has almost nothing for the person who wants more, and it is not about missing pages.** The deep pages
   exist (Year by year: 5.7 screens and 234 figures; Tax, year by year: 247 figures; Bracket explorer; Tax report;
   Export of any table as CSV). They are not one tap from the answer they explain: **0 of the 14 walked pages has a
   "Go deeper" row**; Federal estimate links to one tax page of ten. The working behind a figure is on screen on
   16 of 159 pages. Settings has 158 page switches and not one switch about detail.
3. **Forms are the largest single source of "more than they need".** Counted with real taps: Expenses 8 boxes (2
   required), Income 9 (2), Holdings 9 (3), Policies 12 (1), Home 10 (0), Add account 6 (2), Add debt 6 (2). One page
   in the app (Goals) folds the optional boxes behind "More details (optional)": 3 shown, 7 folded.
4. **Folds do not yet behave as one thing.** On Federal estimate three sibling folds do three different things after
   their own Save (one stays open and says "2 typed", one closes and keeps saying "standard $32,200 is better" with
   four figures typed inside, one closes everything). On Expenses, saving the *simple* answer ("my month in one
   number") closes that fold and opens the 7-bill list: the page grows by 611 px in answer to a one-box choice.

---------------------------------------------------------------------------------------------------------------------

## 1. The five people

### 1.1 Sam, 24, rents, first job (wants less)
Plan built by his own answers: $48,000 a year, $1,200 and $800 in the bank, a card and a car loan left to our guesses.

- **Get started**: 10 question screens, then the reveal. The first screen of every question holds 58 to 115 words
  and 5 to 11 controls, and Continue is cut off or below the first screen on 7 of 10. Two screens grow as he answers: "What
  comes in?" goes from 1.4 to 2.0 screens and from 13 to 24 controls the moment he taps "I work" (who pays you, pay,
  five how-often chips, "Retirement plan at work?" with three chips, other money with four chips). "Tell us about
  each one" (debts) is 2.1 screens with 6 boxes for two debts, each with a three-line "Our guess: ..." under it.
  `$SP/opt/walks/sam-02-money-answered-full.png`, `$SP/opt/walks/sam-07-owe-amounts-full.png`
- **The reveal**: 111 words, 4 tiles, and the way on ("Next: Your month") at y=1287, half a screen down.
- **The path** (5 step pages): 10.1 screens and 1,219 words for what the reveal calls "about 10 more minutes".
  The two that stopped him: Pay off debts as step 3 (the answer, then a form: an Extra box, an "Order" list with
  "highest rate first costs the least; smallest balance first gives quick wins", Save plan, then three more cards)
  and Federal estimate as step 6: 2.9 screens to say "about right". `$SP/opt/walks/w1-sam-04-step-debts.png`,
  `$SP/opt/walks/w1-sam-07-step-tax.png`
- **What he did**: typed one number for his month. The fold he used closed, and the 7-bill list opened by itself
  (page 1.3 -> 2.4 screens, 21 figures, 10 buttons). `$SP/opt/walks/w1-sam-03-month-saved.png`
- **Pages after**: Net worth 1.6 screens with 4 tiles and a red Delete on every row; Debts shows **15 figures on the
  first screen** for two debts; Assumptions is 10 boxes he has no opinion on; Holdings and Will the money last? both
  open as one short card that says what to add (good). Settings opens on "Plan basics: Plan name, Currency, Number
  and date format".
- **Would never use**: Assumptions, Holdings, Import (until someone tells him why), the Order list, Itemized
  deductions, Year and people, the Pages switches, "What we're counting on".

### 1.2 Dana, busy parent of two, monthly check-in (wants less)
First evening on her own answers (married, two children, both work, a home, three debts); the monthly visit on the
family household that has been in use for a while.

- **Get started**: the same 10 questions, but for a couple with a home three of them are walls. "What comes in for
  each of you?" is **3.1 screens and 38 controls** once both work. "About how much is in each?" is **2.9 screens,
  20 controls, 7 boxes and 2 folds** (home value, year bought, where the retirement money is held, is it a Roth).
  "Tell us about each one" is **3.1 screens, 10 boxes** for three debts. `$SP/opt/walks/dana-02-money-answered-full.png`,
  `$SP/opt/walks/dana-05-have-amounts-full.png`, `$SP/opt/walks/dana-07-owe-amounts-full.png`
- **The path**: 8 step pages, **20.6 screens and 2,755 words** ("about 15 more minutes"): Your month 1.3, Your
  debts 2.3, Emergency fund 2.4, Life insurance 3.1, Your retirement 3.9, What would help 3.6, College 1.0, Tax 3.0.
  Next is at the bottom of each. `$SP/opt/walks/w2-dana-path-06-step-6.png`
- **The monthly visit**: the Dashboard row "Your October check-in ... Start" is one tap. The check-in is 2 screens,
  8 steps, 3 of them marked "optional" but listed in full. Its next step says: save them with "Save today's
  totals", at the bottom of Net worth. That is an instruction to go and find a button on another page.
  `$SP/opt/walks/w2-dana-02-checkin.png`
- **Update my balances**: 10 boxes, one Save: right for her. **Expenses**: opens at 2.3 screens because the 13-bill
  list is open; "Edit" on Groceries shows 8 boxes (What is it, Category, Amount, How often, I must pay this, Goes up
  with prices over the years, Starts, Ends) to change one amount. `$SP/opt/walks/w2-dana-06-expenses-edit.png`
- **Federal estimate**: she owes about $5,253 in April. The headline says "About $14,723 of federal tax for 2026";
  the April figure is in the third sentence of a 60-word paragraph with seven figures. The filled button "Fix it in your paychecks" is
  right. `$SP/opt/walks/w5-lee-01-federal.png`
- **Would never use**: Assumptions, Holdings, Pay off debts' three orders, the Budget's month list before she has a
  budget, Settings' Pages, the 1040 walk.

### 1.3 Ruth, 70, retired, not good with apps (wants less; also walked at 320 px)
Her own answers: a pension, Social Security she already gets, three accounts, her home, no debts.

- **Get started**: 8 questions. She was stopped twice. On "About how much is in each?" (2.2 screens; 3.5 at 320)
  the retirement box comes with "Where is it held? In a company plan / In my own IRA / Not sure" and a fold "Is it a
  Roth IRA? optional". On Social Security the help reads "Before Medicare is taken out: the figure on your yearly
  benefit letter, not what reaches your bank. Only know the deposit? Add about $203." `$SP/opt/walks/ruth-05-have-amounts-full.png`
- **The reveal at 320**: nothing to press on the first screen; "Next: Your month" is at y=1316, 2.3 screens down.
  `$SP/opt/walks/w3-ruth-320-01-reveal.png`
- **Will the money last?**: the answer is three words, "The money lasts". Under it: three sentences with two
  figures each ("if markets do as well as average ... $52,311", "only 1 in 10 is worse ... $47,000", "99 of 100
  pretend futures"), "Change the age", and a button "Could you stop sooner?" for someone who stopped years ago.
  Then 4 tiles, a chart, and a nine-row list. 3.1 screens at 390, **5.3 at 320**. "today's dollars" appears four
  times. `$SP/opt/walks/w3-ruth-09-projection.png`
- **Federal estimate**: "About $0 of federal tax for 2026", followed by "the next dollar you earn costs 0 cents
  (the 10% rate, $12,400 of room left before it goes up)", a button "See the estimated payments", and a note about
  the child tax credit and the child care credit. 2.8 screens at 390, **4.8 at 320**, to say nothing is owed.
  `$SP/opt/walks/w3-ruth-320-11-federal.png`
- **Retirement contributions**: she is retired; the page opens on a five-box form about "each paycheck" and what
  "your employer adds". `$SP/opt/walks/w3-ruth-12-contributions.png`
- **Good for her as they are**: Debts and Pay off debts (one card, 46 to 54 words, "Add a loan or card"), Required
  withdrawals (1 screen, the working in a fold), Emergency fund, the Dashboard.
- **At 320**: no page runs off the side and no target is under 44 px. Pages take 1.5 to 1.8 times as many screens, the first
  screen holds 31 to 105 words, and the top bar clips four titles ("Federal estim...").
- **Would never use**: Budget, Holdings, Import, Assumptions, Contributions, Retirement settings (7 boxes), Settings.

### 1.4 Kai, 38, engineer, tracks every dollar (wants more)
Typed every figure to the dollar and the cent, opened every fold, imported a brokerage file and a bank file.

- **Could not reach in one tap**: Year by year (the table behind "Will the money last?": menu, scroll to the
  Retirement topic, tap it, tap the page). The same for If history repeated and Sensitivity. Export ("Any table in
  the app as a file a spreadsheet opens") is not linked from any table. A month-by-month payoff schedule: Pay off
  debts has none and links to no page that has one.
- **Reopens every time**: every fold. On 8 pages I opened all folds with taps, left and came back, then reloaded:
  all closed again each time (Federal 3, Will the money last? 1, Holdings 1, Assumptions 1, Settings 22, Your plan
  1, Our guesses 1; Expenses keeps only the one its own rule opens). Wave 1 fixes this for folds. It does not give
  him a way to say "I always want these open".
- **Where the working is**: good examples exist. Chance the money lasts > "How this is done" names the returns
  (7.0% and 4.0%), the swings (15% and 5%) and the 2,000 runs. Assumptions > "Where these numbers come from" gives
  a source per number. Our guesses > "Where our guesses come from (70 tables from 18 publishers)". Required
  withdrawals > "How this is worked out".
- **Where it is missing**: Federal estimate's "Income tax $16,865, at the tax rates" (no split by rate; the row is
  not tappable; 0 of the 11 rows of the walk open anything). "Left over each month" on Expenses and the Dashboard
  (after tax, bills and saving: no sum shown). Pay off debts' interest total. Contributions' "you are on track".
  Net worth "Over time" is a list of saved totals with no chart. Year by year shows spent, income, from savings,
  tax and what is left, but not what the money earned that year.
- **Assumptions are in three places**: Assumptions (10 numbers), the "Retirement settings" fold at the foot of Will
  the money last? (7 more, among them the share in stocks and a flat 15% tax on withdrawals), and Our guesses. The
  page he changed a number on does not come back marked: after setting stocks to 6.5%, Will the money last? says
  "stocks 6.5% a year ... (on the Assumptions page)" with nothing to say it is his figure.
- **Would switch on once and forever**: show the working under every answer; keep what I open, open; every box in
  every form; figures to the dollar; the long menu. Today: nothing of the kind in Settings (searched the page for
  detail, exact, cents, working, formula, simple, expert: only the word "Advanced", which holds the PC address, the
  AI helper and the build view).

### 1.5 Lee, 45, does the family's taxes (wants more)
The family household with a side business, then figures typed from "the forms".

- **Federal estimate is close to what Lee wants**: an 11-row walk from income to tax laid out like the form, a
  card "What the plan already knows" that names the page each figure comes from, and a fold for what the plan
  cannot see (9 boxes). The sources of the tables are cited at the foot.
- **Could not reach in one tap**: Bracket explorer, Tax year by year, State, Capital gains, HSA and FSA, Estimated
  payments, Tax report (the printable one, the only page of these with real tables). The page has one link,
  "Fix it in your paychecks".
- **Reopens every time, and three folds with three habits**: typed four itemized figures and saved: the fold
  closed; its line still read "standard $32,200 is better" (the walk above it says the standard deduction is
  $34,200), with nothing to say four figures are inside. Typed two figures in "Figures the plan cannot see" and
  saved: that fold stayed open and its line became "2 typed". Saved "Year and people": every fold closed.
  `$SP/opt/walks/w5-lee-03-itemized-saved.png`, `$SP/opt/walks/w5-lee-04-figures-saved.png`
- **Working hidden or missing**: tax by rate band; how "your paychecks take out about $9,470 by December
  (estimated from your pay)" is estimated; the flat 15% used for tax in retirement, which is not on Assumptions and
  not on a tax page (it is box 5 of 7 in a fold on Will the money last?).
- **Contributions**: Edit shows five boxes and no choice of paying the tax now or later (L6, in flight).
- **Would switch on once**: the walk and the "cannot see" boxes open by default; figures to the dollar everywhere;
  the tax pages listed at the foot of each tax page.

---------------------------------------------------------------------------------------------------------------------

## 2. The counts

### Setup: each question screen as first drawn (screens tall · words, controls on the first screen · boxes+buttons on the whole screen)

| screen | Sam | Dana | Ruth | Ruth 320 | Kai | Lee |
|---|---|---|---|---|---|---|
| start | 1 · 92w 3c · 3 in all | 1 · 92w 3c · 3 in all | 1 · 92w 3c · 3 in all | 1.4 · 56w 2c · 3 in all | 1 · 92w 3c · 3 in all | 1 · 92w 3c · 3 in all |
| you | 1.4 · 86w 8c · 12 in all | 1.4 · 86w 8c · 12 in all | 1.4 · 86w 8c · 12 in all | 2.1 · 52w 5c · 12 in all | 1.4 · 86w 8c · 12 in all | 1.4 · 86w 8c · 12 in all |
| money | 1.4 · 58w 8c · 13 in all | 1.8 · 42w 8c · 16 in all | 1.4 · 58w 8c · 13 in all | 2.1 · 34w 5c · 13 in all | 1.8 · 42w 8c · 16 in all | 1.8 · 42w 8c · 16 in all |
| money (answered) | 2 · 57w 11c · 24 in all | 3.1 · 53w 8c · 38 in all | 1.5 · 66w 7c · 14 in all | 2.4 · 40w 5c · 14 in all | 3.1 · 53w 8c · 38 in all | 3.1 · 53w 8c · 38 in all |
| ages | 1.4 · 69w 11c · 14 in all | 2.3 · 75w 9c · 25 in all | 1.5 · 66w 7c · 13 in all | 2.4 · 43w 4c · 13 in all | 2.1 · 77w 9c · 23 in all | 2.3 · 77w 9c · 25 in all |
| have | 1.1 · 71w 11c · 11 in all | 1.2 · 76w 11c · 11 in all | 1.1 · 71w 11c · 11 in all | 1.7 · 43w 6c · 11 in all | 1.2 · 78w 11c · 11 in all | 1.2 · 78w 11c · 11 in all |
| have-amounts | 1.1 · 80w 7c · 7 in all | 2.9 · 83w 6c · 20 in all | 2.2 · 88w 6c · 14 in all | 3.5 · 59w 3c · 14 in all | 3.1 · 83w 6c · 21 in all | 2.8 · 83w 6c · 20 in all |
| owe | 1.2 · 59w 10c · 11 in all | 1.3 · 67w 8c · 11 in all | 1.3 · 54w 8c · 11 in all | 1.9 · 46w 6c · 11 in all | 1.3 · 67w 8c · 11 in all | 1.3 · 67w 8c · 11 in all |
| owe-amounts | 2.1 · 100w 6c · 13 in all | 3.1 · 100w 6c · 18 in all | - | - | 2.2 · 111w 5c · 13 in all | 1.6 · 107w 5c · 10 in all |
| spend | 1.6 · 108w 5c · 9 in all | 1.6 · 108w 5c · 9 in all | 1.4 · 116w 5c · 9 in all | 2.4 · 60w 4c · 9 in all | 1.5 · 126w 5c · 9 in all | 1.6 · 108w 5c · 9 in all |
| goals | 1.4 · 76w 10c · 13 in all | 1.4 · 76w 10c · 13 in all | 1.3 · 106w 9c · 12 in all | 2 · 81w 4c · 12 in all | 1.4 · 75w 10c · 13 in all | 1.4 · 75w 10c · 13 in all |
| goal-details | 1.1 · 115w 7c · 7 in all | 1.3 · 89w 11c · 14 in all | - | - | 2.1 · 91w 11c · 24 in all | 1.3 · 89w 11c · 14 in all |
| the reveal | 1.8 · 111w 3c · 5 in all | 2 · 113w 3c · 5 in all | 1.7 · 124w 1c · 3 in all | 2.8 · 50w 0c · 3 in all | 1.9 · 107w 1c · 3 in all | 1.9 · 112w 1c · 3 in all |
| **question screens / total height** | 10 screens, tallest once answered 2.1 | 10 screens, tallest once answered 3.1 | 8 screens, tallest once answered 2 | 8 screens, tallest once answered 3.2 | 10 screens, tallest once answered 3.1 | 10 screens, tallest once answered 3.1 |

### The pages, right after Get started (screens tall · words, figures, controls on the first screen)

| page | Sam | Dana | Ruth | Ruth 320 | Kai | Lee | family (in use) | retired couple (in use) |
|---|---|---|---|---|---|---|---|---|
| Dashboard | 1.6 · 127w 6f 9c | 1.6 · 137w 6f 9c | 1.6 · 103w 7f 9c | 2.8 · 49w 3f 4c | 1.6 · 134w 10f 9c | 1.5 · 136w 9f 9c | 1.7 · 149w 10f 10c | 2.5 · 129w 8f 6c |
| Your plan | 3.2 · 219w 11f 5c | 3.8 · 220w 11f 5c | 2.3 · 220w 12f 5c | 3.9 · 67w 5f 2c | 3.3 · 212w 18f 5c | 3.6 · 204w 14f 4c | 3.3 · 204w 18f 5c | 2.5 · 193w 12f 4c |
| Net worth | 1.6 · 89w 8f 7c | 2.2 · 104w 9f 9c | 1.5 · 87w 9f 9c | 2.7 · 38w 6f 0c | 2.2 · 94w 10f 9c | 2 · 102w 10f 7c | 2.5 · 92w 12f 7c | 1.8 · 85w 11f 7c |
| Expenses | 1 · 70w 3f 4c | 1 · 70w 3f 4c | 1 · 90w 6f 5c | 1.7 · 66w 6f 2c | 1 · 54w 4f 4c | 1 · 59w 4f 4c | 2.3 · 120w 12f 7c | 2.3 · 121w 11f 3c |
| Budget | 1.7 · 117w 4f 3c | 1.7 · 116w 4f 3c | 1.6 · 119w 4f 3c | 2.5 · 80w 1f 1c | 1.7 · 115w 4f 3c | 1.7 · 116w 4f 3c | 2 · 114w 4f 3c | 1.6 · 112w 4f 3c |
| Will the money last? | 1 · 99w 1f 6c | 3.4 · 159w 5f 3c | 3 · 147w 8f 3c | 5 · 103w 5f 1c | 3.4 · 136w 8f 3c | 3.4 · 150w 8f 3c | 3.3 · 150w 8f 3c | 3.6 · 138w 5f 3c |
| Assumptions | 2.6 · 95w 6f 2c | 2.6 · 95w 6f 2c | 2.6 · 95w 6f 2c | 4.4 · 54w 1f 0c | 2.6 · 95w 6f 2c | 2.6 · 95w 6f 2c | 2.6 · 95w 6f 2c | 2.6 · 95w 6f 2c |
| Retirement contributions | 1 · 120w 1f 5c | 1.9 · 134w 11f 3c | 1.1 · 72w 1f 6c | 1.8 · 36w 0f 3c | 1.4 · 133w 13f 2c | 1.9 · 134w 11f 3c | 1.9 · 147w 4f 4c | 1.1 · 72w 1f 6c |
| Debts | 1.3 · 161w 15f 2c | 1.6 · 164w 19f 3c | 1 · 54w 0f 2c | 1 · 54w 0f 2c | 1.2 · 149w 14f 4c | 1.1 · 133w 11f 3c | 1.4 · 134w 21f 4c | 1 · 50w 0f 2c |
| Pay off debts | 1.6 · 101w 8f 3c | 1.8 · 103w 8f 3c | 1 · 50w 0f 2c | 1 · 50w 0f 2c | 1.6 · 102w 8f 3c | 1.4 · 100w 8f 3c | 2 · 112w 12f 3c | 1 · 46w 0f 2c |
| Federal estimate | 2.4 · 106w 12f 1c | 2.5 · 102w 12f 1c | 2.8 · 107w 11f 1c | 4.8 · 74w 5f 1c | 3.4 · 117w 8f 1c | 2.5 · 106w 12f 1c | 3.3 · 115w 11f 1c | 3.2 · 114w 12f 1c |
| Holdings | 1 · 71w 0f 2c | 1.8 · 60w 0f 6c | 1.8 · 60w 0f 6c | 2.8 · 38w 0f 2c | 1.8 · 60w 0f 6c | 1.8 · 60w 0f 6c | 1.8 · 60w 0f 6c | 1.8 · 60w 0f 6c |
| Import | 1.2 · 77w 0f 4c | 1.2 · 77w 0f 4c | 1.2 · 77w 0f 4c | 2 · 61w 0f 1c | 1.2 · 77w 0f 4c | 1.2 · 77w 0f 4c | 1.2 · 77w 0f 4c | 1.2 · 77w 0f 4c |
| Settings | 2.3 · 66w 0f 11c | 2.3 · 66w 0f 11c | 2.3 · 66w 0f 11c | 3.5 · 31w 0f 5c | 2.3 · 66w 0f 11c | 2.3 · 66w 0f 11c | 2.3 · 66w 0f 11c | 2.3 · 66w 0f 11c |

### Whole page (family, in use): words · figures · boxes · folds shut/open · filled buttons

| page | whole page |
|---|---|
| Dashboard | 1440px = 1.7 screens · 162 words · 9 figures · 0 boxes · 12 buttons and links · folds 1/0 |
| Your plan | 2780px = 3.3 screens · 481 words · 23 figures · 0 boxes · 19 buttons and links · folds 1/0 |
| Net worth | 2106px = 2.5 screens · 242 words · 22 figures · 0 boxes · 25 buttons and links · folds 0/0 |
| Expenses | 1919px = 2.3 screens · 307 words · 31 figures · 0 boxes · 16 buttons and links · folds 1/1 |
| Budget | 1651px = 2 screens · 175 words · 14 figures · 1 boxes · 4 buttons and links · folds 0/0 |
| Will the money last? | 2782px = 3.3 screens · 512 words · 30 figures · 0 boxes · 8 buttons and links · folds 1/0 |
| Assumptions | 2223px = 2.6 screens · 293 words · 11 figures · 10 boxes · 3 buttons and links · folds 1/0 |
| Retirement contributions | 1571px = 1.9 screens · 236 words · 15 figures · 0 boxes · 8 buttons and links · folds 0/0 |
| Debts | 1196px = 1.4 screens · 199 words · 21 figures · 0 boxes · 6 buttons and links · folds 0/0 |
| Pay off debts | 1711px = 2 screens · 271 words · 24 figures · 2 boxes · 2 buttons and links · folds 0/0 |
| Federal estimate | 2761px = 3.3 screens · 489 words · 45 figures · 0 boxes · 2 buttons and links · folds 3/0 |
| Holdings | 1480px = 1.8 screens · 165 words · 0 figures · 9 boxes · 2 buttons and links · folds 1/0 |
| Import | 1050px = 1.2 screens · 127 words · 0 figures · 2 boxes · 3 buttons and links · folds 0/0 |
| Settings | 1927px = 2.3 screens · 216 words · 0 figures · 3 boxes · 5 buttons and links · folds 19/0 |

### The path (step pages between the reveal and Your plan)

| person | steps | screens in all | words in all | the reveal says | tallest step |
|---|---|---|---|---|---|
| Sam | 5 | 10.1 | 1,219 | about 10 more minutes | This year's tax, 2.9 screens |
| Dana | 8 | 20.6 | 2,755 | about 15 more minutes | Your retirement, 3.9 screens |
| Ruth (390) | 4 | 9.2 | 1,135 | about 10 more minutes | Your retirement, 3.4 screens |
| Ruth (320) | 4 | 15.9 | 1,135 | about 10 more minutes | Your retirement, 5.8 screens |

### What a form asks when a person taps Add or Edit (family household, real taps)

| form | boxes shown | required | folded | height |
|---|---|---|---|---|
| Net worth: add an account | 6 (name, type of 19, bank, balance, as of, whose) | 2 | 0 | 0.7 screen |
| Net worth: edit an account | 5 | 2 | 0 | 0.5 |
| Expenses: add or edit a bill | 8 (what, category of 19, amount, how often, must pay, goes up with prices, starts, ends) | 2 | 0 | 0.9 |
| Income: add or edit | 9 (what, kind, whose, amount, how often, yearly raise, starts, ends, income tax applies) | 2 | 0 | 1.0 |
| Debts: add a loan or card | 6 | 2 | 0 | 0.6 |
| Debts: edit | 4 (rate, payment, extra, credit limit) | 2 | 0 | 0.5 |
| Contributions: add or edit | 5 | 1 | 0 | 0.6 |
| Holdings: add | 9 (account, symbol, name, shares, price, paid, kind, expense ratio, yield) | 3 | 0 | 1.1 |
| People: add or edit | 5 | 1 | 0 | 0.6 |
| Policies: add | 12 | 1 | 1 | 1.5 |
| Home | 10 | 0 | 0 | 1.1 |
| Budget: edit an envelope | 3 | - | 0 | 0.4 |
| **Goals: add a goal** | **3** | 2 | **7 behind "More details (optional)"** | 0.5 |

Screenshots of each: `$SP/opt/walks/form-cashflow-expenses-add-a-bill.png`,
`$SP/opt/walks/form-investments-holdings-add-a-holding-form-already-open-.png` and the other `form-*.png` files beside them.

### What is one tap from each page (links on the page, the path's own "Continue your plan" row left out)

| page | links to other pages | deeper pages that exist but are only in the menu |
|---|---|---|
| Dashboard | 12 | - |
| Your plan | 19 | - |
| Net worth | Update my balances | Account detail, Asset register, Balance sheet, Net worth projection |
| Expenses | (the left-over tile goes to Next best action) | Where the money goes, Bills and regular payments, Subscriptions, Cash-flow forecast |
| Budget | Import | Budget (50/30/20), Irregular expenses |
| Will the money last? | People, Goal seek, Chance the money lasts, Contributions, Healthcare before 65, Medicare, Assumptions | **Year by year**, If history repeated, Sensitivity, How much to take out, Stress tests |
| Assumptions | none | Our guesses for you; every page that uses a number |
| Contributions | Will the money last? | Contribution limits, Paycheck, Work benefits |
| Debts | Pay off debts, Net worth (to add) | Credit cards, Mortgage, What lenders see |
| Pay off debts | none | Credit cards, Mortgage, Refinance, Consolidation, What lenders see |
| Federal estimate | Withholding check | Bracket explorer, Tax year by year, State, Capital gains, HSA and FSA, Estimated payments, Filing status compare, Tax report |
| Holdings | none | Allocation, Fees, Rebalance, Risk, Dividends, Tax lots |
| Import | none | Categorize, Rules, Ledger, Check a statement |
| Settings | none | - |

The menu is the other way in: 27 entries (8 under "Start with", "All 150 pages", 18 topics that each open a list;
15 fit on the screen at 390, 9 at 320). From an answer to the page that explains it is menu, scroll, topic, page.
`$SP/opt/walks/sam-20-menu.png`. All pages is 19.8 screens and 151 links. `$SP/opt/walks/w4-kai-27-all-pages.png`

---------------------------------------------------------------------------------------------------------------------

## 3. Page by page: keep, fold, add

Each page: **Keep** on the first view / **Fold** behind an opt-in in plain words / **Add** for the people who want
more. Counts are the family household in use unless a person is named.

### Get started: the questions
`$SP/opt/walks/dana-02-money-answered-full.png`, `$SP/opt/walks/dana-05-have-amounts-full.png`, `$SP/opt/walks/dana-07-owe-amounts-full.png`,
`$SP/opt/walks/kai-10-goal-details-full.png`
- **Keep**: one question per screen, tiles before boxes, "Our guess" under every amount box, "Skip: use our
  guesses", the spending question exactly as it is (one box, the total, and "Split it up (optional)" as a fold:
  the model for the others).
- **Fold**: on "What comes in": "Who pays you" (default An employer; "I work for myself" as a quiet line) and
  "Any other money coming in" (a line "Other money too? Side work, rent, child support" that opens it). Move
  "Retirement plan at work?" to the next-but-one screen, where Retirement is a tile: today the answer pre-ticks that
  tile, and a person who taps every tile that applies un-ticks it (it happened in the first Dana and Kai runs, and
  the retirement boxes then never came). On "About how much is in each?": "Year you bought it", "Where is it held?"
  and "Is it a Roth IRA?" behind one "A little more (optional)". On "Tell us about each one": one box per debt
  ("Paid a month"), with "Still owed" and "Interest rate" behind "I know the balance and rate" per debt.
  On "How much, and by when?": "Is any of your savings already for this?" behind "Some is already saved".
- **Add**: nothing. Kai typed every box and was served. The guessed value itself is only the gray text in the box;
  a detail lover would like to see it stated ("Our guess: $13,000, a typical ..."), which also helps Ruth.

### The reveal
`$SP/opt/walks/w1-sam-01-reveal.png`, `$SP/opt/walks/w3-ruth-320-01-reveal.png`
- **Keep**: the four tiles with their "Our guesses for now" tags, the one filled Next.
- **Fold**: the numbered list of steps under "What's next" (6 to 9 rows) behind "See the steps", so Next sits on
  the first screen (it is at y=1179 to 1339 at 390 and y=1316 at 320).
- **Add**: a quiet "See every guess we made" link to Our guesses for you (Kai looked for it; it is in the menu).

### Dashboard
`$SP/opt/walks/w2-dana-01-dashboard.png`, `$SP/opt/walks/w2-dana-01-dashboard-full.png`
- **Keep**: everything on the first screen: the one-line verdict, the three rows (left over, emergency fund,
  retirement) with a dot and a figure, the check-in row, one filled button, "See your plan". This page is the
  model for "the answer, a few rows, one action".
- **Fold**: the 23-word sentence under "Left over each month" (two more figures) to the figure alone; the fourth
  tile "Goals: 3 goals behind (they need about $1,659 more a month); 1 starts in December 2026" to "3 behind".
- **Add**: for detail lovers a quiet last row "All your numbers" to Your plan and Our guesses; nothing else.

### Your plan
`$SP/opt/walks/w1-sam-09-your-plan-full.png`
- **Keep**: "In short", the filled button, "Right now" with its rows, "What to do next".
- **Fold**: "Make it fit you better", "Not counted yet" and "Keep it up to date" into one fold "More about your
  plan" (they are 3 of the 8 headings on a 3.3-screen page); "What we're counting on" is already a fold and its
  status "Worth a look" is good.
- **Add**: inside "What we're counting on", a link to Assumptions and Our guesses for each line.

### Net worth
`$SP/opt/walks/w2-dana-11-net-worth.png`, `$SP/opt/walks/w1-sam-12-networth-edit.png`
- **Keep**: the net worth figure with "since" or "Partly our guesses", "Update all balances at once", the list of
  accounts with name and balance, the guess note on a guessed row.
- **Fold**: the Delete button on every row (10 red-outlined buttons on the family's first view: put Delete inside
  Edit); "as of 11/12/2026" on every row (show it only when a balance is old); the tiles "You own", "You owe" and
  "Invested for later" behind the headline ("3 more numbers"); in the add form, "Bank or firm", "Balance as of"
  and "Whose account" behind "More options".
- **Add**: a chart of "Over time" (today a list of saved totals, no chart); a "Go deeper" row: Account detail,
  Balance sheet, Net worth projection.

### Expenses
`$SP/opt/walks/w2-dana-05-expenses.png`, `$SP/opt/walks/w1-sam-03-month-saved.png`, `$SP/opt/walks/w2-dana-06-expenses-edit.png`
- **Keep**: the two tiles (per month, left over) and the two folds. A fresh plan opens at 1 screen and 68 words:
  right.
- **Fold**: the bill list stays shut until asked, also after "Save my month" (today that save opens it: +611 px)
  and for a plan in use (the family's opens at 2.3 screens with 13 bills). In the bill form: Category, "I must pay
  this", "Goes up with prices", Starts and Ends behind "More options" (What is it, Amount, How often stay).
- **Add**: how "Left over" is worked out, as a fold under the tile (income, tax, bills, saving, with the figures);
  totals by category and by year for the list; a "Go deeper" row: Where the money goes, Bills, Subscriptions.

### Budget
`$SP/opt/walks/w2-dana-08-budget.png`, `$SP/opt/walks/w2-dana-09-budget-used.png`
- **Keep**: "Start from your expenses" with its one filled button; after it, the envelope list.
- **Fold**: the Month list (a card of its own above everything, before a budget exists) until there is more than
  one month to choose; the introduction (about 55 words in two paragraphs) to one line; "Unspent money rolls into next month" behind "More
  options" in the envelope form.
- **Add**: nothing found missing without bank files; with them, a link to the transactions behind each envelope.

### Will the money last?
`$SP/opt/walks/w3-ruth-09-projection.png`, `$SP/opt/walks/w4-kai-03-projection-full.png`, `$SP/opt/walks/w1-sam-18-projection.png`
- **Keep**: the verdict in the heading; one sentence that pairs what you plan to spend with what the money can
  pay for in a bad run; the note that spending "is set to what you spend today"; the empty state (Sam: 1 screen,
  "We don't know yet", one filled button).
- **Fold**: the other two sentences ("if markets do as well as average", "N of 100 pretend futures") behind "How
  sure is this?"; the four tiles to one ("Spending that lasts"), with "3 more numbers"; the chart's caption.
  "Could you stop sooner?" should not show for a person who has stopped. The nine-row "What goes into this" list
  is being rebuilt as L2; it stands open on a plan with data (about 1,180 px) and is a fold only on an empty plan.
- **Add**: Year by year one tap away (a "Go deeper" row: Year by year, Chance the money lasts, If history
  repeated, Sensitivity, How much to take out); in Retirement settings, each box saying where else it is used and
  the summary line saying what was changed (today "$7,000 a month" only); a mark on any assumption the person
  set ("stocks 6.5%, yours").

### Assumptions
`$SP/opt/walks/w4-kai-05-assumptions.png`, `$SP/opt/walks/w4-kai-07-assumptions-sources.png`
- **Keep**: the two numbers people have a view on (prices, stock growth). L5 turns them into chips.
- **Fold**: the other eight behind "8 more numbers"; the tile "0 Changed from defaults" and the amber "You have
  not looked these over yet" into the summary line of that fold ("all as we set them"). Today all ten boxes are
  on the page with a Save at y=1830; Sam, Dana and Ruth each saw 2.6 screens (4.4 at 320) of boxes.
- **Add**: for each number, the pages that use it (the sources fold says it for two of ten); the assumptions that
  live elsewhere, listed with a link (share in stocks, tax on withdrawals, the withdrawal rate: all in the
  Retirement settings fold; the tax tables and their year: foot of Federal estimate).

### Retirement contributions
`$SP/opt/walks/w2-dana-13-contributions.png`, `$SP/opt/walks/w3-ruth-12-contributions.png`
- **Keep**: the yearly total, "you are on track", the match question as three buttons, the list.
- **Fold**: "Against the 2026 limits" behind "Room left this year"; in the form, "Whose" (the account usually says)
  and "How often" behind "More options".
- **Not applicable**: a retired person gets a five-box "each paycheck" form. One card instead: "You're retired,
  so nothing goes in. Add a contribution" as a quiet link.
- **Add**: the working of "11% of your pay" and of "on track" (what figure it was tested against); pay the tax
  now or later per row is L6.

### Debts
`$SP/opt/walks/w2-dana-15-debts.png`
- **Keep**: what you owe, the costliest debt in one line ("Visa card costs about $127 a month in interest at
  23.9%") with its button, each debt with its balance and the month it is paid off.
- **Fold**: three of the four tiles (paying each month, interest each month, debt payments vs income) behind
  "3 more numbers": the first screen carries **21 figures**, the most of the fourteen pages. Each row's sentence
  ("6.3% - paid off by January 2046 if you keep paying $1,980 a month, March 2039 on your payoff plan - $190,195
  interest to come") to "paid off by January 2046", the rest on tap. "Extra you pay" and "Credit limit" behind
  "More options" in the edit form.
- **Add**: a "Go deeper" row: Credit cards, Mortgage, What lenders see.

### Pay off debts
`$SP/opt/walks/w2-dana-16-payoff.png`, `$SP/opt/walks/w1-sam-04-step-debts.png`
- **Keep**: the debt-free month, the monthly amount and the interest in one sentence; "$100 more a month would
  end it 8 months sooner"; the Extra box with Save plan; when each debt ends.
- **Fold**: the "Order" list behind "Change the order" (highest rate first is the default and costs the least);
  "The three orders, same money" behind "Compare the three orders".
- **Add**: the month-by-month schedule (none on the page, and no link to one); the working of the interest
  total; a "Go deeper" row.

### Federal estimate
`$SP/opt/walks/w5-lee-01-federal.png`, `$SP/opt/walks/w5-lee-01-federal-full.png`, `$SP/opt/walks/w3-ruth-320-11-federal.png`,
`$SP/opt/walks/w5-lee-03-itemized-saved.png`
- **Keep**: one headline that says what happens in April ("You'd owe about $5,253 in April" / "About right:
  nothing to do" / "No federal tax this year") and the one button that fixes it.
- **Fold**: the 60-word paragraph (seven figures) to the one sentence; the 49-word note on what is left out behind
  "What this leaves out" (and without the child credits for a household with no children); the four tiles behind
  "3 more numbers"; "From income to tax" and "What the plan already knows" behind "See how this is worked out"
  on the first visit. The page is 2.4 to 3.4 screens for everyone, including Ruth, who owes nothing.
- **Add**: the income tax split by rate band under "Income tax, at the tax rates", opened by tapping the row
  (today 0 of 11 rows open anything); the same for the paycheck estimate; a "Go deeper" row with the seven tax
  pages and the Tax report; fold lines that say what they hold ("4 typed: standard is better by $1,594").
  The line "standard $32,200 is better" and the walk's "Standard deduction -$34,200" disagree by the $2,000 of
  gifts allowed without itemizing; one of them should say so.

### Holdings
`$SP/opt/walks/w2-dana-18-holdings.png`, `$SP/opt/walks/w4-kai-23-holdings-import.png`, `$SP/opt/walks/w1-sam-22-holdings.png`
- **Keep**: with no investment account, the one card and "Add an investment account" (Sam's view). With holdings,
  the four tiles and the mismatch warning ("the holdings add up to 32,331 but the account balance on Net worth
  says 140,000").
- **Fold**: the nine-box form that opens the page for everyone who has an account and no holdings. First view:
  a filled "Bring in the file from your brokerage" (today a fold at y=1276, under the form) and "Type one in"
  opening three boxes (account, symbol, shares); price, paid, name, kind, expense ratio and yield behind "More
  about this holding".
- **Add**: a "Go deeper" row (Allocation, Fees, Rebalance, Tax lots): the page says "Allocation, Fees, Dividends
  and the tax pages all read this list" and links to none.

### Import
`$SP/opt/walks/w1-sam-23-import.png`, `$SP/opt/walks/w4-kai-25-import-check.png`
- **Keep**: account, "Choose the file", then the check. "Columns worked out for you. Change them" as a fold after
  a file is read is the pattern to copy.
- **Fold**: "Or paste" with its text box and button behind "Paste the text instead"; the how-to in the heading
  ("most sites: Activity > Download > CSV, last 90 days") behind "Where do I get the file?".
- **Add**: after import, how many rows matched a rule and a link to them; OFX is L8.

### Settings
`$SP/opt/walks/w1-sam-25-settings.png`, `$SP/opt/walks/w4-kai-26-settings-advanced.png`
- **Keep**: Your data (download, restore).
- **Fold**: "Plan basics" (plan name, currency, number and date format: the first card and the only filled
  button on the first screen) to the end, beside Advanced; the 18 topic folds with 158 switches behind three
  choices first ("The basics", "Everything", "Let me choose").
- **Add**: the missing card, first on the page: how much detail this device shows (see change 2).

### Seen on the way
- **Monthly check-in**: fold steps 3 to 5 behind "3 optional steps"; let step 2 save the totals in place instead
  of sending her to the bottom of Net worth. `$SP/opt/walks/w2-dana-02-checkin-full.png`
- **Our guesses for you**: three guesses that matter most, then "More of our guesses (4 guesses)", then two
  folds for the assumptions and the sources. The best example of the rule in the app. `$SP/opt/walks/w4-kai-02-guesses.png`
- **Year by year**: two lists at the top ("Show amounts in", "Years") choose the view without touching the plan:
  a good toggle. No download, though Export can make the file. `$SP/opt/walks/w4-kai-08-year-by-year.png`
- **Chance the money lasts**, **Required withdrawals**, **Sensitivity**: each has its working in a fold at the
  foot, under three different titles ("How this is done", "How this is worked out", "How it is worked out").

---------------------------------------------------------------------------------------------------------------------

## 4. The 15 changes that would matter most

Ranked by how many of the five people each one reaches and how much screen it removes or opens up. "Evidence" is
what was counted or done in the walks. "Lane" says who may touch it.

**1. Forms show two or three boxes; the rest wait behind "More options".**
Evidence: the form table in section 2: 8, 9, 9, 12 and 10 boxes with 2, 2, 3, 1 and 0 required. Dana changed one
amount through an 8-box form; Ruth met a 5-box form she did not need. Goals already does it (3 shown, 7 folded).
Serves: Sam, Dana, Ruth every time they add or fix anything. For Kai and Lee the fold opens itself when a folded
box holds a value, and change 2 can keep it open.
Lane: the kit (`ui.form` has no "more" option; wave 1 names it as a follow-up it does not build), then each view.
Order by use: Expenses, Net worth add, Income, Debts, Holdings, Contributions, Policies, Home.

**2. One choice per device: how much detail to show.**
Evidence: Kai and Lee found nothing to switch on. Settings holds 158 page switches, a PC address, the AI helper
and the build view; a search of the page for detail, exact, working, formula, simple or expert finds only
"Advanced". Every fold they opened was shut again on return, on all 8 pages tested (wave 1 will keep them; it will
not open them for a person who always wants them).
What they asked of it, in their words: show the working under every answer; show every box; figures to the
dollar; list the deeper pages; the long menu. The simple view must remain the default, and each page's own folds
must work without the setting, so it adds to them and never replaces them.
Serves: Kai, Lee. It is also what makes changes 1, 4, 5, 11 and 15 safe to do boldly.
Lane: `core/view.js` is unclaimed and the shell already redraws on its event (inventory, fact 8); Settings view.

**3. On the path, each step page opens with its answer and Next on the first screen.**
Evidence: Dana's 8 steps are 20.6 screens and 2,755 words for "about 15 more minutes"; Sam's 5 are 10.1 screens;
Ruth's 4 are 15.9 screens at 320. Next sits at the foot of each (y=906 to 2,682). The step bar already has
"Done? Go to Next" as a jump.
What: while a page is a step, everything under its answer card is one fold, "More on this page", and Next comes
right after the answer.
Serves: Sam, Dana, Ruth on the first evening, which is when people give up.
Lane: `overview/guide/frame.js` and the step pages; the shell part touches wave 1's ground, so after it lands.

**4. Federal estimate: the April answer first, the form walk on request, the rate bands for whoever wants them.**
Evidence: 2.4 to 3.4 screens for all five (4.8 at 320), the same for Sam ("about right"), Dana (owes $5,253) and
Ruth ($0). The headline is the total tax; what happens in April is in sentence three. 116 words before the first
tile. For Lee: one link to another tax page, no split of "Income tax, at the tax rates", 0 of 11 rows tappable.
What: section 3. Three plain headlines (owe, about right, nothing), one button; "See how this is worked out"
holds the walk, the tiles and the sources; tapping the income tax row opens the bands.
Serves: all five, in opposite directions, on the same page. Lane: `taxes/federal` (claude-b's).

**5. Will the money last?: one sentence under the verdict; the odds behind "How sure is this?".**
Evidence: Ruth's answer is three words; she was given 149 words, 8 figures, "pretend futures", "today's dollars"
four times and "Could you stop sooner?". 3.1 to 3.4 screens with data; 5.3 at 320. Year by year is not linked.
What: section 3. Coordinate with L2, which rebuilds the list below the hero; this is the hero, the tiles and the
links. Serves: Ruth, Dana; Kai through the links. Lane: `retirement/projection/view.js` (claimed by the L2 work).

**6. A "Go deeper" row at the foot of every main page.**
Evidence: 0 of 14 pages has one; the table in section 2 lists about 40 deeper pages that are menu-only from the
page they explain. The rule already names "Go deeper" links as the way to deeper pages.
What: one quiet row of two to five links in plain words, last on the page, the same on every page; it can stay
shut as "Go deeper (4 pages)" in the simple view.
Serves: Kai, Lee; costs the others one line. Lane: each view, or one helper fed from a per-page list. Links to
claude-a's pages (Balance sheet, Net worth projection, State, Filing status compare, Consolidation, Student
loans) need no edit in their folders.

**7. Get started: the three long question screens ask one thing first.**
Evidence: "What comes in" 3.1 screens and 38 controls for a couple; "About how much is in each?" 2.9 to 3.1
screens, 7 or 8 boxes and 2 folds for a home owner; "Tell us about each one" 3.1 screens and 10 boxes for three
debts. Continue is cut off or under the first screen on 7 of 10 questions for Sam and 9 of 10 for a couple. Ruth
stopped at "Where is it held?".
What: section 3; the spending question's "Split it up (optional)" is the pattern.
Serves: every new person. Lane: `overview/setup/view.js` (claude-e has had FL-SETUP; check the claim).

**8. The working under every answer, with one name and one place.**
Evidence: a working fold exists on 16 of 159 pages, under three titles; of the 14 walked, Will the money last?
lists its inputs and nothing shows a sum. Missing where Kai and Lee looked: left over each month, the income tax
line, the paycheck estimate, the payoff interest, "on track", net worth over time. Export exists and is linked
from no table.
What: a fold "How this is worked out", last before "Go deeper", with the person's own numbers in the sum, the
assumptions it used (each a link), and "Get this as a table" where there is one.
Serves: Kai, Lee; and Dana the day a figure looks wrong. Lane: each view; the formulas are already in the READMEs.

**9. Folds behave alike and say what they hold.**
Evidence: Federal's three folds after their own Save: stays open and says "2 typed"; closes and says "standard
$32,200 is better" with four figures inside and $34,200 in the walk above; closes all. Expenses: saving the
one-number answer opens the 7-bill list (+611 px). Retirement settings' line says "$7,000 a month" whatever was
changed. The inventory counted eight spellings for "you set this".
What: one summary grammar ("3 typed", "yours: 80% in stocks", "all as we set them", "1 to fix"); the fold just
saved stays open; no save opens a different fold.
Serves: all five. Lane: wave 1 owns keeping folds open across a redraw; the status words are each view's.

**10. A page that does not apply says so in one card.**
Evidence: Ruth: a paycheck form on Contributions; a 2.8-screen Federal estimate for $0, with child credits in the
note; "Could you stop sooner?". Debts and Pay off debts already do this well for her (46 to 54 words, one link),
and Holdings does it for Sam.
What: retired and no pay: "Nothing goes in now". No tax: "No federal tax this year", the rest folded. No
children: no child credits in the note. Serves: Ruth, Sam. Lane: each view; small.

**11. Net worth and Debts: quieter rows, one headline, "3 more numbers".**
Evidence: Net worth shows Edit and a red Delete on every row (20 buttons for 10 accounts) and "as of" ten times.
Debts puts 21 figures on the first screen; one row reads "6.3% - paid off by January 2046 if you keep paying
$1,980 a month, March 2039 on your payoff plan - $190,195 interest to come".
What: section 3. Serves: Sam, Dana, Ruth. Lane: `balance/net-worth`, `balance/liabilities` (claude-b's).

**12. Settings starts with what a person came for.**
Evidence: the first card is Plan name, Currency, Number and date format with the page's only filled button on
screen; then 18 topics "14 of 14 on". No preset. With every fold open the page is 10,639 px.
What: detail (change 2) first; then pages as three choices with "Let me choose" opening today's list; Plan
basics and Advanced last. Serves: all five. Lane: `system/settings`.

**13. A short menu, with the long one a tap away.**
Evidence: 27 entries, "All 150 pages", 18 topics; 9 of them fit at 320. Ruth and Sam need four: Dashboard, Your
plan, the check-in, Settings.
What: those four, then "More pages" opening today's menu; the long menu stays as it is for whoever chose
"Everything". Serves: Sam, Dana, Ruth. Lane: `core/app.js` (wave 1's ground; after it lands).

**14. Holdings and Import lead with one action.**
Evidence: Holdings opens on nine boxes with the file import folded under them at y=1276; Kai's file brought in
4 positions in two taps. Import shows a paste box and its button on the first view.
What: section 3. Serves: Dana (who would not type holdings), Kai (who wants the file). Lane:
`investments/holdings` (claude-h's rounds; check), `transactions/import` (L8 is in it now).

**15. Assumptions: two numbers first, and one home for all of them.**
Evidence: ten boxes on 2.6 screens for everyone; an amber notice and a "0 changed" tile for people who will never
change one. For Kai the assumptions are in three places, the tax on withdrawals (15%) and the share in stocks
among them, and a number he set comes back unmarked on the pages that use it.
What: L5's chips for the two, "8 more numbers" for the rest; a list "Also assumed" linking to Retirement
settings, Our guesses and the tax tables; "yours" beside a changed number wherever it is quoted.
Serves: all five. Lane: `system/assumptions` (L5 is in it now); quoting pages as they are touched.

Smaller, each one view: Pay off debts' "Order" and "The three orders" behind folds; the check-in's three optional
steps behind one line and its step 2 saving in place; Your plan's last three headings into one fold; Budget's
Month list hidden until a second month exists; the reveal's list of steps folded so Next is on the first screen;
the gray guess shown as text under each setup box.

---------------------------------------------------------------------------------------------------------------------

## 5. Five places where hiding would hurt

1. **The Dashboard's three rows and its one button.** Left over each month with its figure, emergency fund in
   months, retirement in two words, each with its dot, then the next move. This is the whole value of the page on a
   phone, it fits one screen for all five people (103 to 149 words), and it is what Dana reads once a month. Trim
   the words under the figures; never put a row behind "more".
2. **What happens in April, on Federal estimate.** "Owe about $5,253" or "about right" or "$0", with the button
   that fixes it. Folding the page (change 4) must lift this figure into the headline, not fold it with the walk.
   Today it is already half hidden, in the third sentence and in the small line of the first tile.
3. **Every "our guess" mark and every "does not add up" warning.** "Our guesses for now" on the reveal's tiles,
   "Partly our guesses" under net worth, "(our guess)" on a contribution row, "Our guess for now: Edit to type the
   real balance" on an account, "Childcare is not counted yet", "Not counted yet: your car", and Holdings' "the
   holdings add up to 32,331 but the account balance on Net worth says 140,000". These tell a person how far to
   trust the figure above them. A "3 more numbers" fold may hold figures; it may not hold the reason to doubt one.
4. **The pair that carries the retirement verdict.** What you plan to spend beside what the money can pay for in
   a bad run ("you plan $84,000 ... about $79,700"), the tag "short in a bad run", and the line that spending "is
   set to what you spend today". Fold the average case and the count of pretend futures; keep this pair with the
   verdict, or "It lasts in most cases, not all" has no meaning.
5. **On the debt pages: the debt-free month with its monthly amount, the one costly debt, and each debt's end
   date.** "Debt-free by March 2039 ... $2,790 a month", "Visa card costs about $127 a month in interest at
   23.9%", "paid off by July 2028". Sam's whole plan on day one is this. The three other tiles, the comparison of
   orders and the long row sentences can fold; these cannot. The same holds for the two dates of the mortgage
   when they differ: the short note that explains why must stay with them.

Also keep in view: the save confirmation where the thumb is; "Skip: use our guesses" on every amounts question;
for a retired person, this year's required withdrawal with its amount and date; the fold lines that count what
was typed ("2 typed").

---------------------------------------------------------------------------------------------------------------------

## 6. What already follows the rule (do not undo)

- The Dashboard; the empty states of Will the money last?, Holdings, Debts and Pay off debts; Expenses on a fresh
  plan (two tiles, two folds, 68 words).
- "Split it up (optional)" on the spending question; "Skip: use our guesses"; "Our guess: ..." under each box.
- Our guesses for you: three first, then "More of our guesses (4 guesses)", then assumptions, then sources.
- Goals' "More details (optional)"; Import's "Columns worked out for you. Change them"; Year by year's two
  view lists; Required withdrawals' one screen with the working folded; "Figures the plan cannot see (2 typed)".
- At 320 px: no page runs off the side, no target under 44 px on the 17 pages checked.

## 7. Limits

- Five invented people walked by one reviewer; no real person was asked. Counts are exact; "stopped" is judgment.
- One tip (737fb6a), light mode, phone only. Not walked: desktop, dark mode, the AI pages, the PC connection,
  a household with bank files in use for months (Budget and the check-in were seen without transactions).
- The 12 pages plus Monthly check-in, Update my balances, Our guesses, Year by year, Chance the money lasts,
  Sensitivity, Withholding, Bracket explorer, Tax year by year, Capital gains, Tax report, Export, Required
  withdrawals, How much to take out, Mortgage, People, Needs attention, Quick answers, All pages. The other
  pages were not opened; the form and fold findings very likely hold there too (the inventory counts say so) but
  were not walked.
- Claude-a's pages were only looked at (State, as a link target). Nothing here asks for an edit in their folders.

## 8. Files

- This report: `$SP/opt/walks.md`
- Screenshots and data: `$SP/opt/walks` (PNGs named `<person>-NN-<screen>.png` for Get started and the first look at each
  page, `w1-sam-*`, `w2-dana-*`, `w3-ruth-*`, `w3-ruth-320-*`, `w4-kai-*`, `w5-lee-*` for the walks with taps,
  `form-*.png` for the forms; `-full` is the whole page)
- Recorded counts: `$SP/opt/walks/data` (one JSON per walk: first-screen lines, controls, folds, headings, links per page);
  the tables above are built from them by `$SP/opt/walks/tables.mjs`
- The walks as scripts (each step a real touch): `$SP/opt/walks/setup.mjs` (the five people's answers), `$SP/opt/walks/walk.mjs`,
  `$SP/opt/walks/w-sam.mjs`, `$SP/opt/walks/w-dana.mjs`, `$SP/opt/walks/w-dana-path.mjs`, `$SP/opt/walks/w-ruth.mjs`, `$SP/opt/walks/w-kai.mjs`, `$SP/opt/walks/w-lee.mjs`,
  `$SP/opt/walks/w-folds.mjs`; logs `$SP/opt/walks/log-*.txt`; page text with every fold opened `$SP/opt/walks/text`
- The plans each person built: `$SP/opt/walks/data/sam-plan.json`, `$SP/opt/walks/data/dana-plan.json`, `$SP/opt/walks/data/ruth-plan.json`,
  `$SP/opt/walks/data/kai-plan.json`, `$SP/opt/walks/data/lee-plan.json`

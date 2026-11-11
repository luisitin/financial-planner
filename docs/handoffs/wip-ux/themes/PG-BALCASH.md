# PG-BALCASH: Balance, cash flow, goals and household pages (page-specific)

11 verified findings (each reproduced on screen by an independent skeptic). Scripts and pictures for a finding `<walker>/<id>` are in `$SP/ux/<walker>/` and `$SP/ux/<walker>/verify/`.

## p-career-household-system/F9 (severity 4, next, scope several-pages, owner claude-b (household/calendar, cashflow/income), confirmed)
**The calendar asks for a "first payday" on Income, gives no link, Income has no such box, and the obvious answer breaks the plan**

- pages: household/calendar, cashflow/income
- reach: any household whose salaries came from Get started (no start date): family, sam, jordan, patLee
- steps: H.family(), household/calendar. Read the two amber notices. Go to Income by the menu, tap Ana's salary, look for "first payday". Type the next payday (11/20/2026) in the only date box that fits, "Starts", and tap Save changes. Open the Dashboard.
- saw: Two notices, "Add the first payday to \"Ana's salary\" on Income to see your paydays here." and the same for Bo: no link or button in either, and no link to Income anywhere on the page. On Income the word payday appears nowhere; the box is "Starts" with help "leave blank if it has already started". With 11/20/2026 typed there: Income drops from $14,250 to $5,800 a month, Ana's salary turns grey "not yet ... starts 11/20/2026", and the Dashboard changes from "Your month works." to "More goes out than comes in each month." A past payday (11/06/2026) works and changes nothing else.
- should: One notice with its own action: "To show paydays, tell us one recent payday" and a date box per salary right on the calendar (or a button that opens that salary with a box named "A recent payday"). The calendar's payday must not be the date the income starts.
- why: Reproduced twice. The walker saw only the missing link (severity 3); following the instruction is worse: the named box does not exist and the natural entry removes a salary from the whole plan.
- cause: modules/household/calendar/compute.js:107 builds the sentence and uses income[].startDate as the payday anchor; view.js:53 shows it as a plain ui.notice with no action; modules/cashflow/income/view.js:17 labels that field "Starts" (the day the income begins), so a future date makes the income "not yet".
- fix: Smallest: calendar/view.js replaces the notices with one card: for each salary without an anchor a date box "A recent payday for Ana's salary" and one Save, stored as an optional income[].payday (no version bump; note it in docs/DATA_MODEL.md); compute.js:107-108 uses payday ?? startDate. Until then at least reword to "...put a payday that has already passed in Starts" and link the notice to #/cashflow/income.
- evidence: $SP/ux/p-career-household-system/verify/f9-calendar.png, $SP/ux/p-career-household-system/verify/f9-income-form.png, $SP/ux/p-career-household-system/verify/f9-starts-2026-11-20.png (v8.mjs, v15.mjs, v15c.mjs)

## j-debt-fixer/D7 (severity 3, focus, scope page, owner claude-b, confirmed)
**Debts: three amber warnings push the list down to y=727, and the page has no filled button**

- pages: balance/liabilities
- reach: Debts, for any household with two or more debts at a high rate.
- steps: H.renterDebt(), balance/liabilities.
- saw: Four tiles, then three amber notices (71, 94 and 94 px, y=397 to 671), one per costly card, each repeating what its row says with the 'expensive' pill; 'Your debts' starts at y=696 and the first row at y=727, so one row fits on the first screen. filledOnScreen is empty for the whole page. With one costly debt (H.family()) there is one notice and the first row is at y=506; with none (H.jordan()) the row is at y=427. So it grows with each costly card, which is exactly the person this page is for.
- should: One notice for all of them: '3 cards cost about $220 a month in interest. Visa card first (29%), then Store card, then Mastercard.' with one filled 'See my payoff plan' button; the per-card detail stays in the rows.
- why: The eye lands on a wall of orange before the list it came for, and nothing on the page says what to do about it.
- cause: modules/balance/liabilities/view.js:51 appends one ui.notice per warning; modules/balance/liabilities/compute.js:148-152 pushes one warning per debt at or above the high-rate line, with no cap.
- fix: liabilities/view.js:51: when there are two or more 'costs about' warnings, draw one notice with the summed monthly interest and the order, and move the existing 'Open my payoff plan' link into it as the page's one filled button.
- evidence: $SP/ux/j-debt-fixer/verify/v1-debts-top.png, $SP/ux/j-debt-fixer/verify/v1-debts-full.png

## j-debt-fixer/D3 (severity 3, focus, scope page, owner claude-b, confirmed)
**Editing a debt: one seven-box form for every kind of debt, with Save below the screen**

- pages: balance/liabilities
- reach: Debts, every debt; the mortgage is edited through the same form.
- steps: H.renterDebt(), balance/liabilities, tap 'Visa card' (then, separately, 'Car loan').
- saw: The page smooth-scrolls 1,267 px from the top (638 px from the row) to the heading 'Visa card: rate and payments' at y=68; that heading makes clear what opened. The form is 742 px tall with seven boxes; for a card three of them are loan-only ('Loan length in months', 'Started', 'Secured by'), and the car loan gets 'Credit limit (cards only)'. Save's top edge is at y=833 of 844, so it is off screen until you scroll. Focus stays on the tapped row (now at y=-540); no box is focused. -5 in the rate box gives the browser's bubble 'Value must be greater than or equal to 0.' at the box, which is plain enough. Where the form opens is not a defect to re-open: the owner chose 'the form opens inside the list card' on 2026-09-15 (Debts, round 14, option A), and Income (827 px), Goals (1,036 px) and People (534 px) do the same. Cancel returns the screen to the list; Save returns with 'Saved <name>.' in view.
- should: A card's form shows rate, required payment, extra and credit limit; a loan's shows rate, payment, extra, loan length, start date and what secures it. With four boxes Save is on the first screen.
- why: A card owner reads 'Loan length in months' and 'Secured by', wonders what to put, and cannot see Save without scrolling past boxes that do not apply.
- cause: modules/balance/liabilities/view.js:12-20: FIELDS is one list for every debt; drawForm (lines 55-77) passes it unfiltered. Line 110: onClick scrolls the form into view and leaves focus on the <li>.
- fix: liabilities/view.js: build the field list from the account's kind (credit card: rate, minPayment, extra, creditLimit; others: without creditLimit), keeping the form inside the list card (2026-09-15). After drawForm(), give the form's h2 tabindex=-1 and focus it with preventScroll so a screen reader lands on the form without opening the keyboard.
- evidence: $SP/ux/j-debt-fixer/verify/v4-form-open.png, $SP/ux/j-debt-fixer/verify/v4-form-neg.png

## p-balance/x-2 (severity 3, navigate, scope page, owner claude-b, confirmed)
**'Change how many months ›' lands at the top of Assumptions; the months box is two screens down**

- pages: balance/liquidity, system/assumptions
- reach: None
- steps: H.family(), balance/liquidity. Tap 'Change how many months ›' under the fund card.
- saw: Assumptions opens at the top (scroll 0 of 2,223 px): 'Ten numbers drive every projection: how fast prices rise...', an amber 'You have not looked these over yet', then Inflation and Stocks. The box 'Emergency fund, in months of must-pay bills' is 1,708 px down and nothing points to it. Back returns to Emergency fund.
- should: The link opens Assumptions with that box in the middle of the screen and marked for a moment (or the months can be changed on the Emergency fund page itself).
- why: Missed by the walker (it checked that links answer, not where they land). Reproduced twice.
- cause: modules/balance/liquidity/view.js:27 links to bare '#/system/assumptions'; modules/system/assumptions/view.js cannot be opened at one box.
- fix: Link '#/system/assumptions?show=emergencyMonths'; in assumptions/view.js, after the form is drawn, scroll the label of the box named by ctx.route.query.show to the middle of the screen and give it a 1.5 s highlight class scoped to the page.
- evidence: $SP/ux/p-balance/verify/k-months-landed.png, $SP/ux/p-balance/verify/v-miss3.mjs

## p-career-household-system/F4 (severity 3, input, scope page, owner claude-b (household/people), confirmed)
**Impossible ages are saved with "Changes saved."**

- pages: household/people
- reach: household/people add and edit
- steps: H.family(), household/people, tap Bo (38), Retirement age 20, Plan to age 30, Save changes.
- saw: "Changes saved." Stored: retirementAge 20, lifeExpectancy 30. The list now reads "Bo · age 38 · retired". No warning anywhere on the page.
- should: Plan to age at or below the person's age (or below the retirement age) is refused at the box: "Bo is 38 now. Plan to age is the age the money should last to, like 95." A retirement age below the current age asks "Is Bo already retired?" before saving.
- why: Reproduced. "Plan to age" is easy to read as a number of years (30), so this is a likely slip, and it flips a 38-year-old to retired without a word.
- cause: modules/household/people/view.js:10-11 only set min 18; the save at :69-78 does not compare with the age from birthDate.
- fix: In the submit handler (:69): work out the age from clean.birthDate; if lifeExpectancy <= age or <= retirementAge append ui.notice("error", ...) to the form and return false (ui.form keeps what was typed); if retirementAge < age ask once with ui.confirm.
- evidence: $SP/ux/p-career-household-system/verify/f4-saved.png (v4.mjs)

## p-cashflow-b-goals/F4 (severity 3, navigate, scope page, owner claude-b, confirmed)
**A tap in the middle of a goal row opens another page instead of the goal**

- pages: goals/goals
- reach: goals/goals, every goal that has a costing page (all four in the family household)
- steps: Family household. Open goals/goals. Bring 'Replace Bo's car' on screen and tap the middle of its row (same for 'Cy's college'). The walker's own example row (Emergency fund) opened Edit for me; these two rows did not.
- saw: Fresh browser per row, one real touch at the row's centre: Emergency fund -> Edit form; Replace Bo's car -> #/goals/vehicle; Cy's college -> #/goals/education; Japan trip -> Edit form. The link box (141 to 231 px wide, 44 px tall) starts 9 to 10 px below the centre on the two rows that left; the browser's fat-finger rule gives the tap to the link. The link covers 10 to 26% of each row. Back returned to Goals at the same scroll (301).
- should: The upper part of the row (name, figures, Edit) always opens the goal; the link to the costing page is the row's last line, under the progress bar, with clear space above it.
- why: The page says 'Tap a goal to change it'. Two of four taps in the middle of a row go to a different page with a different title. Back recovers, so it costs a moment and some trust, not data.
- cause: modules/goals/goals/view.js:146 (the whole <li role=button> opens Edit) and :153-154 (an inline-flex link, minHeight 44 px, placed inside the row's text block between the figures and the bar).
- fix: Move the link out of span.body to the end of the <li>, after the progress bar, with 8 px above it; keep its 44 px height and stopPropagation.
- evidence: $SP/ux/p-cashflow-b-goals/verify/f4-list.png, $SP/ux/p-cashflow-b-goals/verify/f4-centre-tap-row1.png

## p-cashflow-b-goals/F5 (severity 3, next, scope page, owner claude-b (goals/goals); the form option is shell (core/ui/dom.js), confirmed)
**First goal: ten boxes before the button, which is 1.6 screens down**

- pages: goals/goals
- reach: goals/goals add form (984 px tall when reopened with '+ Add another goal' too)
- steps: Empty household (first open). Open goals/goals. Count the boxes; find 'Add goal'. Tap it with nothing typed. Then type a name, 5000, and 80 in 'Growth per year', and tap again.
- saw: Ten inputs (name, icon, amount, date, importance, already set aside, account, monthly, growth per year, an inflation tick). 'Add goal' is at y=1357 of a 1539 px page; no filled button on the first screen. Only two boxes are required. Empty submit: the screen jumps back 344 px to the first box with the browser's 'Please fill out this field.' Growth 80: the browser's 'Value must be less than or equal to 50.'; the help text never states a range. A valid submit works well: 388 ms, 'Vacation added.' in view, list at the top.
- should: Name, amount and date, then 'Add goal'. The other seven behind a closed 'More details (optional)' row above the button. Growth help: 'between 0 and 50; leave blank to use the plan's figure'.
- why: A first goal needs a name and an amount. The person meets 'Icon', 'Growth per year' and an inflation tick before they find the button, and cannot tell which boxes they may skip.
- cause: modules/goals/goals/view.js:6-17 (FIELDS: ten fields in one flat list); core/ui/dom.js form() (line 92) has no way to fold optional fields.
- fix: ui.form: fields marked more: true go inside one <details class='fold'> before the submit button (opened automatically if any holds a value, so Edit shows them). goals/goals marks icon, priority, saved, accountId, monthly, rate, inflates. One kit change serves other long forms.
- evidence: $SP/ux/p-cashflow-b-goals/verify/f5-full.png, $SP/ux/p-cashflow-b-goals/verify/f5-empty-submit.png

## p-cashflow-b-goals/x-2 (severity 3, navigate, scope several-pages, owner claude-b, confirmed)
**Tapping a category on Where the money goes opens the whole month, not that category**

- pages: cashflow/spending, transactions/ledger
- reach: every category row on Where the money goes
- steps: Family household plus four months of bank lines (verify/tx.mjs). Open cashflow/spending. Tap the row 'Groceries · 8% · 1 transaction · $180'.
- saw: The Ledger opens on 'Sep 2026 · all accounts · all categories': 8 transactions, Money out $2,155. The first screen is the three totals and the four filter boxes; the first transaction starts at y=893, below the 844 px screen. Seen twice.
- should: The Ledger opens on that month and that category ('Sep 2026 · Groceries', 1 transaction) with the list brought to the top of the screen. The 'Showing' row staying open while a filter is set is the owner's choice of 2026-09-15 (Transactions round 18) and stays.
- why: The person tapped Groceries to see the grocery line. They get every line of the month, out of sight under a form, and have to scroll and pick Groceries again themselves.
- cause: modules/cashflow/spending/view.js:68: the row's onClick sends only ['month', d.month]; modules/transactions/ledger/view.js:31-37 has no deep link for a category.
- fix: spending/view.js:68: add the category to the link (query category=<id>, or 'none' for unfiled); ledger/view.js: read it into state.category, clear filters the link does not set, and scroll the list's first row into view on a deep link. Do it together with F1 (same lines).
- evidence: $SP/ux/p-cashflow-b-goals/verify/x-spend-groceries-ledger.png

## p-cashflow-a/CF-4 (severity 2, input, scope page, owner claude-b, confirmed)
**'My own split' of 60 / 30 / 30 is saved as 50 / 25 / 25 with only a short note at the bottom, and a save on this page shuts the other open sections**

- pages: cashflow/budget-percent
- reach: budget-percent
- steps: H.family(), cashflow/budget-percent, open 'Needs: the bills you must pay', open 'The split to aim for', choose 'My own split', type 60, 30, 30, tap Save. Then with Needs and Wants both open, tap 'Count as a want' on a bill.
- saw: Saved at once: 'Saved. Your shares add up to 120%, so they are scaled to 100%: 50 / 25 / 25.' The lasting notice is at the top of the page, out of view; the copy at the bottom leaves after 3.6 s. The boxes still read 60 / 30 / 30 while the section's heading reads 50 / 25 / 25. Open sections 2 -> 1 after Save. 'Count as a want': the bill moves into Wants, which was open and is now shut (open=false). NOT confirmed: the 'thrown up 1,000 px'. scrollY did change by -1,022 because the open section above closed, but on screen nothing moved: Save stayed at y 490 -> 483 and the section heading at 11 -> 4.
- should: At the boxes: 'These add up to 120. Needs, wants and savings must add up to 100, for example 60, 20 and 20.' and nothing is saved until they do; sections that were open stay open.
- why: Walker gave 3; I set 2. The app does say what it did, in plain words, where the eye is. But a person who types three numbers that do not add up has most likely made a slip, and gets a different split saved rather than a question.
- cause: modules/cashflow/budget-percent/view.js:106 scales and saves; lines 7, 78 and 102 keep one `openFold` name, so every other open section closes on the redraw.
- fix: Before line 106: if (v.preset === 'own' && Math.abs(sum - 1) > 1e-6) return formError(splitForm, `These add up to ${Math.round(sum * 100)}. Needs, wants and savings must add up to 100, for example 60, 20 and 20.`) (formError exists and keeps what was typed). Make openFold a Set filled from details[open] before each store.update.
- evidence: $SP/ux/p-cashflow-a/verify/cf4-before-save-needsopen.png, $SP/ux/p-cashflow-a/verify/cf4-after-save-needsopen.png, $SP/ux/p-cashflow-a/verify/cf4-after-count-as-want.png (script v4.mjs)

## p-cashflow-a/CF-6 (severity 2, understand, scope page, owner claude-b, confirmed)
**Paycheck: 'Use $243.91 on the Withholding check page' vanishes on tap, pulls the page up 220 px and leaves a sentence that goes in a circle**

- pages: cashflow/paycheck
- reach: paycheck, once per earner
- steps: H.family(), cashflow/paycheck, scroll to the outlined 'Use $243.91 on the Withholding check page' under Ana's paycheck, tap it.
- saw: No navigation. The button and its line of explanation are removed, the page is 220 px shorter and 'Bo's paycheck' now sits where the button was. A note at the bottom: 'The Withholding check page now counts $243.91 of federal tax from each of Ana's 26 paychecks.' The card then reads 'The federal tax is the figure on the Withholding check page; the IRS method gives $243.91 ... Set the W-4 below to use that instead' (the same figure). No link to the page it names, no undo. NOT confirmed: the walker's fix ('show the changed take-home beside it'): the take-home does not change ($2,888 before and after) and should not, the button copies a figure to another page. The 'W-4 Step 4(b)' labels match the paper form the person copies from; opening the section keeps its heading in place (351 -> 351), the 0.48 shift is the section opening.
- should: The row stays after the tap: 'Sent to the Withholding check page: $243.91 a paycheck.' with a button 'See if your paychecks cover the year's tax'.
- why: Walker gave 3; I set 2. The button says what it does and confirms it; the roughness is that the thing tapped disappears, the page moves under the thumb, and the sentence left behind confuses.
- cause: modules/cashflow/paycheck/view.js:78-83: the row is drawn only while the figures differ; line 75 writes the 'Set the W-4 below to use that instead' sentence even when both figures are equal.
- fix: paycheck/view.js: when p.federal.from === 'withholding' and the figures match, draw in the same place ui.h('p', { class: 'muted small' }, 'Sent to the Withholding check page: ' + cents(amount) + ' a paycheck.') and ui.h('a', { class: 'btn secondary', href: '#/taxes/withholding' }, "See if your paychecks cover the year's tax"); say 'It matches the IRS method for your W-4.' instead of 'Set the W-4 below to use that instead.'
- evidence: $SP/ux/p-cashflow-a/verify/cf6-before-use.png, $SP/ux/p-cashflow-a/verify/cf6-after-use.png, $SP/ux/p-cashflow-a/verify/cf6-w4-fold.png (script v6.mjs)

## p-cashflow-a/CF-8 (severity 2, understand, scope page, owner claude-b, confirmed)
**Budget envelopes (and the rows on Retirement contributions) can be tapped but carry no 'Edit' cue; they look exactly like the rows on Bills that cannot**

- pages: cashflow/budget, retirement/contributions
- reach: budget (12 rows for the family), retirement/contributions (2 rows)
- steps: H.family(), cashflow/budget, tap 'Use these as my budget', look at the Envelopes list.
- saw: 12 tappable rows, none with 'Edit' or a chevron (0 of 12); the hint 'Tap an envelope to change its amount.' is under the twelfth row, about 1,500 px down; the green notice says 'tap one to change it' for 5 s. Income, Expenses, Goals, Debts and People rows all show 'Edit' under the amount. Retirement contributions: 2 tappable rows, no cue.
- should: 'Edit' under each amount, as on Income and Expenses.
- why: The design log (2026-09-15, Expenses round 16) calls 'Edit rows' a settled rule that had not reached every page; it has not reached this one. The hint and the notice keep it passable.
- cause: modules/cashflow/budget/view.js:92-99: the row's right-hand span holds only the amount.
- fix: budget/view.js:99: wrap the amount and add ui.h('div', { class: 'muted small' }, 'Edit \u203a') under it, as income/view.js does; the same line on retirement/contributions.
- evidence: $SP/ux/p-cashflow-a/verify/cf8-budget-rows.png (script w1.mjs)


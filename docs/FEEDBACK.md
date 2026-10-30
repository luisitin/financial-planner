# Feedback: what the tester found, who fixes it, what happened

Written by the tester session (`.claude/skills/tester/SKILL.md`, launched with `Tester.bat`),
read by the builder and the designer at the start of every work block (`docs/TEAM.md` rule
7). The Docs page in the app shows this file, so the owner can read it on the phone.

How an item looks (one per problem, ids never reused, newest at the bottom of "Open";
the fixer changes the status line in place and adds a CHANGELOG line):

```
### F-001  Page: one-line title in plain words
- when: 2026-09-15 13:05   page: group/id   severity: blocker | bug | confusing | idea
- for: builder | designer | owner
- what happened: ...
- expected: ...
- steps: 1) ... 2) ... 3) ...
- suggestion: ...
- evidence: shots/qa-...-phone.png
- status: fixed (2026-09-15, builder) — `countedBalance()` in net-worth compute keeps the sign on asset balances; liquidity and goals follow it. The accounts table still prints -$500 as $500 (view.js): filed as F-008 for the designer. | fixed (date, role) | verified (date) | declined (why)
```

## Open

### F-001  Net worth: a negative balance is flipped positive and added to what you own
- when: 2026-09-15 14:20   page: balance/net-worth   severity: bug
- for: builder
- what happened: added an account with Current balance -500 (an overdraft). The saved data keeps -500, but every number on screen (Net worth, You own, Invested for later) shows it as a positive $500, as if it were money you have instead of money you are short.
- expected: a negative balance on an asset account should either be refused with a plain message ("A balance cannot be negative. For a card or loan still owed, pick a loan type instead."), or if it is allowed (an overdraft), it should reduce Net worth and You own, not add to them.
- steps: 1) Net worth  2) Account name: Negative Test  3) Type: Checking  4) Current balance: -500  5) Add account
- suggestion: `modules/balance/net-worth/compute.js` line 42 does `const bal = Math.abs(Number(a.balance) || 0)` for every account before summing, which throws away the sign on asset balances. Only take the absolute value for liability types (where the user enters what is owed as a positive number); keep the sign for asset types, or reject negative asset balances at input time.
- evidence: shots/qa-round1-bad-inputs-phone.png
- status: verified (2026-09-15) -- re-added a -500 checking account: Net worth and You own now correctly show -$500. The Accounts table still shows it as a positive $500 (Edit/Delete row) -- that half is tracked as F-008, left open.

### F-002  Net worth: the accounts table's balance and Edit/Delete buttons are cut off on a phone
- when: 2026-09-15 14:20   page: balance/net-worth   severity: bug
- for: designer
- what happened: on a 390 px phone screen, the Accounts table shows Account/Type/Institution and then stops — Balance, Balance as of, and the Edit/Delete buttons are all off the right edge of the screen, with nothing on screen hinting the row keeps going.
- expected: on a narrow screen, either stack the important fields (balance, edit, delete) so they are reachable without scrolling, or show a clear horizontal-scroll hint so a person knows there is more to the row.
- steps: 1) Net worth on a phone (390 px)  2) add any account  3) look at the Accounts table
- suggestion: give the table an explicit horizontally-scrollable wrapper with a visible affordance (e.g. a fading edge), or switch to a stacked card per account on narrow screens (name/type as the title, balance/edit/delete underneath).
- evidence: shots/qa-round1-bad-inputs-overflow-check-phone.png
- status: verified (2026-09-15) -- accounts are now a stacked card (name/type/date, then balance and Edit/Delete) instead of a wide table; everything fits inside 390 px with nothing cut off.

### F-003  Net worth: "Invested for later" counts plain checking, savings and cash balances
- when: 2026-09-15 14:20   page: balance/net-worth   severity: bug
- for: builder
- what happened: added a plain Checking account with balance $2,500 (no retirement or brokerage account at all). The "Invested for later" tile shows $2,500 taxable, as if a checking balance were an investment.
- expected: "Invested for later" should only include money actually invested for the future (brokerage, crypto, 401(k), IRA, Roth, HSA, 529) — not everyday cash sitting in checking, savings or a cash account.
- steps: 1) Net worth  2) Add an account: Checking, balance 2500  3) look at "Invested for later"
- suggestion: in `modules/balance/net-worth/compute.js`, `investable` is added whenever `t.taxBucket && t.taxBucket !== "none"`, and checking/savings/cash/brokerage/crypto are all tagged `taxBucket: "taxable"` for the separate tax-diversification breakdown. Add a distinct flag (e.g. `invested: true/false`) so checking/savings/cash keep their `taxable` tax bucket for that other purpose but are left out of `investable`.
- evidence: shots/qa-round1-happy-path-phone.png
- status: verified (2026-09-15) -- a plain Checking account now shows "Invested for later: $0, nothing yet: retirement and investment accounts count here" instead of counting the checking balance.

### F-004  Net worth: a very large balance breaks the stat tile layout
- when: 2026-09-15 14:20   page: balance/net-worth   severity: confusing
- for: designer
- what happened: added an account with Current balance 1000000000000 ($1 trillion). Net worth, You own and Invested for later all wrap onto two lines and split the number mid-digit ("$1,000,00" / "0,000,500"), instead of shrinking or wrapping cleanly.
- expected: a large number should shrink to fit on one line, or wrap only at a comma, never in the middle of a group of digits.
- steps: 1) Net worth  2) Add an account: Checking, balance 1000000000000  3) look at the stat tiles
- suggestion: give the stat-tile figure a responsive font size (e.g. `clamp()`) or a max-width with `white-space: nowrap` and a smaller font step for long values, so it shrinks instead of breaking mid-number.
- evidence: shots/qa-round1-bad-inputs-phone.png
- status: verified (2026-09-15) -- a $1,000,000,000,000 balance now wraps cleanly at a comma ("$1,000,000,000," / "000") instead of splitting a digit group.

### F-005  Sitewide: sidebar links and row buttons are under the 44 px tap target rule
- when: 2026-09-15 14:20   page: balance/net-worth (sidebar is on every page)   severity: bug
- for: designer
- what happened: `qa.smallTargets(44)` on Net worth found the 14 sidebar links at 40 px tall, the "Hide coming soon" toggle at 36 px, and the accounts table's Edit/Delete buttons at 34 px — all below the 44 px minimum `AGENTS.md` already sets as a rule.
- expected: every tappable link/button at least 44 px tall, per the existing design rule.
- steps: 1) any page  2) open the sidebar  3) run `qa.smallTargets(44)` (or measure a nav link/Edit/Delete button with a ruler on a phone)
- suggestion: bump the sidebar link row's min-height and the row-action button padding in `core/ui/base.css` to reach 44 px; this is one shared class change, not a per-page fix.
- evidence: shots/qa-round1-bad-inputs-overflow-check-phone.png
- status: verified (2026-09-15) -- `qa.smallTargets(44)` on Net worth now returns zero elements under 44 px (sidebar links, toggle and row buttons all measured).

### F-006  All pages: only the title text opens a page, not the row around it
- when: 2026-09-15 14:20   page: overview/pages   severity: bug
- for: designer
- what happened: `qa.smallTargets(44)` on "All pages" found every one of the 149 page-list links only 20 px tall (e.g. "Debts" is a 40x20 px link) — because the link only wraps the title word. The purpose sentence under it, the icon, the "ready"/"phase N" pill, and all the row's padding sit next to the link but are not part of it, even though the whole row looks like one tappable card.
- expected: the whole row (icon, title, purpose text, pill) should be one tap target that opens the page, at least 44 px tall.
- steps: 1) All pages  2) run `qa.smallTargets(44)` (or, on a phone, tap the purpose text under any page title — nothing happens)
- suggestion: in `modules/overview/pages/view.js` line 42-45, wrap the whole `<li>` row's content in the `<a href="#/${key}">` instead of just wrapping `m.title`, or add a click handler on the `<li>` that navigates; keep the pill and pointer cursor as visual confirmation it is one tap target.
- evidence: shots/qa-round1-pages-check-phone.png
- status: verified (2026-09-15) -- `qa.smallTargets(44)` on "All pages" now returns zero `<a>` elements under 44 px; the whole row is one tap target.

### F-007  All pages: searching "what I owe" finds nothing, even though Net worth answers it
- when: 2026-09-15 14:20   page: overview/pages   severity: bug
- for: builder
- what happened: typed "what I owe" into the search box: "0 pages across 18 topics. No pages match." Typed "what you owe" instead (the exact wording already in Net worth's purpose text): it found Net worth immediately. The search is a plain substring match against each page's title/purpose/group text, so a first-person phrasing that does not appear word-for-word finds nothing, even though a matching page exists.
- expected: a person searching in their own words ("what I owe", "what I own", "how much debt do I have"...) should still find Net worth or Debts, per `docs/DESIGN_LOG.md`'s own goal of plain-word search. "No pages match" should be rare, not the result of a phrasing mismatch.
- steps: 1) All pages  2) type "what I owe" in the search box  3) compare with typing "what you owe"
- suggestion: give manifests a short `aliases` list of the plain phrases an owner might type (e.g. Net worth: `["what I owe", "what I own", "how much am I worth"]`) and match against those too, or normalise "I"/"my" to "you"/"your" before matching as a quick first pass.
- evidence: (JSON output of qa/flows/search-nav.js via drive.mjs, no screenshot taken)
- status: verified (2026-09-15) -- "what I owe" now returns 6 matches led by Net worth and Debts; "what you owe" and "mortgage" still work.

### F-008  Net worth: the accounts table shows an overdrawn checking account as a positive amount
- when: 2026-09-15 15:15   page: balance/net-worth   severity: confusing
- for: designer
- what happened: after F-001, an asset with balance -500 lowers Net worth and You own correctly, but the Accounts table cell renders `fmt.money(Math.abs(a.balance))` with a "-" only for loan types, so the row still reads "$500".
- expected: the row reads "-$500" (in red, like a loan) so the table agrees with the totals.
- steps: 1) sandbox  2) Net worth  3) add Checking with balance -500  4) compare the row with the You own tile
- suggestion: in `modules/balance/net-worth/view.js` balance column: show the sign for asset types (`a.balance < 0`), keep the liability rule as is; `countedBalance` from compute.js gives the number the totals use.
- evidence: (none; follows from F-001)
- status: verified (2026-09-15) -- the accounts table now shows "-$500" in red for an overdrawn checking account instead of a plain positive "$500".

### F-009  Expenses: the "Where it goes" percentages add up to 101%, not 100%
- when: 2026-09-15 16:10   page: cashflow/expenses   severity: idea
- for: builder
- what happened: seeded a realistic household (`qa/flows/seed-sample.js`) and checked every category's own share by hand against the displayed percentage. Each one rounds correctly on its own, but because every category is rounded independently, the twelve shares shown under "Where it goes" add up to 101%.
- expected: the shown shares should add up to 100%, since they are described as parts of one whole.
- steps: 1) seed a household with 12+ expense categories  2) look at Expenses > "Where it goes"  3) add up every percentage shown
- suggestion: use a largest-remainder rounding pass (round every share down, then hand the leftover 1 point to the category with the largest fractional remainder) instead of rounding each one independently.
- evidence: (JSON output of drive.mjs on cashflow/expenses with the sample data, no screenshot taken)
- status: verified (2026-09-16) -- Expenses 'Where it goes' shares now add up to exactly 100 (9 categories: 22+17+14+14+12+8+7+3+3).

### F-010  Settings: the full ~149-page on/off list makes the everyday screen very long
- when: 2026-09-15 16:20   page: system/settings   severity: confusing
- for: designer
- what happened: right below the PC server and AI connection fields, Settings shows an on/off checkbox for every one of ~149 pages, grouped by topic -- a very long screen for what most visits need (checking the connection or the AI).
- expected: owner's call (asked directly): collapse the full page on/off list behind an "Advanced" section, so the everyday Settings screen is short and the server/AI fields are what a person sees first.
- steps: 1) Settings  2) scroll past "Save all settings"
- suggestion: keep PC server + AI settings visible up top; put the grouped page checkboxes behind a collapsed "Advanced: turn pages on/off" disclosure.
- evidence: shots/system-settings-phone.png
- status: verified (2026-09-15) -- Settings now opens with Plan basics, then 18 topics folded to one "N of N on" row each (tap to expand); PC connection and AI assistant are folded lower down. The everyday screen is short; the full per-page list is a tap away.

### F-011  People: a future birth date shows as a negative age
- when: 2026-09-15 17:00   page: household/people   severity: confusing
- for: designer
- what happened: added a dependent with birth date 2099-01-01. The page correctly warns "Future Baby has a birth date in the future", but right above that warning the household row still reads "age -73".
- expected: when the birth date is already flagged as invalid, show something like "not born yet" instead of a negative age -- the warning banner already says what's wrong; the age line should not restate it in a confusing way.
- steps: 1) People  2) Add a person: any name, Birth date a year in the future  3) look at the household row
- suggestion: in `modules/household/people/view.js`, where the row builds its age text, show "not born yet" (or hide the age line) when `p.age < 0`, instead of printing the negative number.
- evidence: shots/qa-round3-people-bad2-phone.png
- status: verified (2026-09-15) -- a dependent born 2099-01-01 now reads "not born yet" on the household row; the warning banner stays.

### F-012  Ask the plan: developer wording and no chat feedback (filed by the designer; page is a stub, outside the design lane)
- when: 2026-09-15 15:10   page: ai/assistant   severity: confusing
- for: builder
- what happened: the page says "The model sees a 172-character summary of the plan (never the raw data) and is told not to do arithmetic. Language tasks only." Status lines read "thinking...", "answered by qwen3.5:9b", "failed: <error>" as grey text. There is no empty state saying what to ask and the send button sits alone under the box.
- expected: plain words for a layperson: intro "Ask anything about your plan in your own words. The assistant only sees a short summary of your numbers and never does the math itself." A few example questions as tappable chips ("What should I do first?", "Is my emergency fund big enough?"). While waiting: "Thinking..." with the send button disabled; on failure a red notice: "The assistant did not answer. Check Settings > AI assistant." Answers as speech-bubble rows with "You" / "Assistant".
- steps: 1) Ask the plan  2) read the intro  3) send a question with the AI off
- suggestion: when the page is promoted to usable, use ui.notice for status and the `.records`/`.chat` classes in base.css; the designer will review it in the next pass once it is usable.
- evidence: shots/ai-assistant-phone.png
- status: fixed (2026-09-15, builder) — `ai/assistant` is usable: plain intro, four example chips, "Thinking..." with the button disabled, red notice with what to do on failure, a warning when the AI is off. Designer: it is yours to review now.

### F-013  Goals: one account linked to two goals is counted in full for both
- when: 2026-09-15 18:10   page: goals/goals   severity: bug
- for: builder
- what happened: two goals of $30,000 each, both "saved in" Joint savings ($45,000). Both rows read "$45,000 of $30,000 · reached", and the top says "Saved so far $60,000 of $60,000, 2 reached" -- $60,000 counted from a $45,000 balance. In real life that money can only cover one and a half of them.
- expected: an account's balance should be spread across the goals that point at it (by priority, or in proportion to their targets), never counted twice; the totals should never exceed the real money.
- steps: 1) Net worth: one savings account with 45,000  2) Goals: add two goals of 30,000, each with "Account it is saved in" = that account  3) read the two rows and "Saved so far"
- suggestion: in `modules/goals/goals/compute.js`, allocate each account's `countedBalance` across the goals that list it: sort those goals by priority then date, give each goal up to its `remaining`, pass the rest to the next; show "shares Joint savings with Goal B" on the row so a person sees why.
- evidence: (drive.mjs output on goals/goals with qa/flows/seed-retired-couple.js + two goals on one account)
- status: verified (2026-09-16) -- two $30,000 goals on one $45,000 account now read $30,000 and $15,000 ('shared with'); qa/households two-goals-one-account cases pass with the priority-then-date rule encoded in qa/households/lib/expect.mjs.

### F-014  Goals: a goal with a negative amount counts as "reached" and pulls "Saved so far" below zero
- when: 2026-09-15 18:10   page: goals/goals   severity: bug
- for: builder
- what happened: a goal with amount -500 shows the warning "has a negative amount" (good) but is still listed as "reached", counted in "1 reached", and drags the header to "Saved so far -$400 of $24,500" (0 + 100 - 500).
- expected: a goal with a negative or zero amount should be left out of every total and never marked reached; the warning is enough.
- steps: 1) Goals  2) add a goal with Amount needed -500 and no date  3) read the header and the row
- suggestion: refuse negatives in the form (min 0, like the Retirement age field already does), and in compute treat `target <= 0` as status "no amount" and skip it in `totalTarget`, `totalFunded` and `done`.
- evidence: (drive.mjs output on goals/goals with qa/flows/seed-warnings.js)
- status: verified (2026-09-16) -- a -500 goal is 'no amount', left out of totals, never reached; the warning says so.

### F-015  Needs attention: a goal that is behind with nothing going in, and goals' own warnings, never show up
- when: 2026-09-15 18:10   page: overview/alerts   severity: bug
- for: builder
- what happened: with a $20,000 goal due in two years, $0 saved and $0 a month going in ("Silent goal", status behind, needs $817/mo), Needs attention lists 15 items and this one is not among them; a goal that is behind but has $200/mo going in does appear. Goals' own warnings ("Roof fund points to an account that no longer exists", "has a negative amount") are also missing from Needs attention, while People/Income/Expenses/Assumptions warnings are all pulled in.
- expected: the goal with nothing going in is the most behind of all and should be first among the goal items; and goal warnings should be listed like the other pages' warnings.
- steps: 1) seed qa/flows/seed-warnings.js  2) Needs attention  3) look for "Silent goal" and "Negative goal"
- suggestion: in `modules/overview/alerts/compute.js` line 64 drop the `&& g.monthly > 0` condition (wording: "Needs about $817 a month; nothing is going in yet"), and add a loop over `gl.warnings` next to the People/Income/Expenses loops (line 68-71).
- evidence: (drive.mjs output on overview/alerts with qa/flows/seed-warnings.js)
- status: verified (2026-09-16) -- 'Silent goal is behind: Needs about $817 a month; nothing is going in yet' and 'Negative goal has a negative amount' both appear on Needs attention.

### F-016  Emergency fund: when the fund is covered, the sentence quotes the target instead of the real runway
- when: 2026-09-15 18:10   page: balance/liquidity   severity: confusing
- for: designer
- what happened: usable cash covers 26.1 months (the tile says so), but the sentence under it reads "Your usable cash covers 6 months of the bills you must pay. Anything above that could work harder elsewhere." A person reads that as "6 months", not 26.
- expected: "Your usable cash covers 26 months of must-pay bills; the plan aims for 6. About $40,820 above the target could work harder elsewhere." (53,000 - 12,180)
- steps: 1) seed qa/flows/seed-retired-couple.js  2) Emergency fund
- suggestion: `modules/balance/liquidity/view.js` line 30: use `months(d.runwayMonths)` and `d.targetMonths` both, and show `d.now - d.target` as the amount above target.
- evidence: (drive.mjs output on balance/liquidity with qa/flows/seed-retired-couple.js)
- status: verified (2026-09-15) -- now reads "Your usable cash covers 26 months of must-pay bills; the plan aims for 6. About $40,820 above the target could work harder elsewhere."

### F-017  Expenses: one-time costs disappear from every total (Income shows them, Expenses does not)
- when: 2026-09-15 18:10   page: cashflow/expenses   severity: idea
- for: builder
- what happened: an $8,000 one-time roof repair is listed in the rows but there is no "One-time amounts" tile; Income has one ("$15,000, not in the monthly total"). The $8,000 is in `compute().oneTime` already. Emergency fund also does not know about it: "usable today" stays at $53,000 with an $8,000 bill on the way.
- expected: the same "One-time amounts" tile on Expenses, and on Emergency fund a line "after $8,000 of one-time costs coming up: 22 months" (45,000 / 2,030).
- steps: 1) seed qa/flows/seed-retired-couple.js  2) Expenses, then Emergency fund
- suggestion: show `oneTime` on Expenses; in `modules/balance/liquidity/compute.js` subtract active one-time expenses (and add active one-time income) to produce `nowAfterOneOffs` and a second runway figure.
- evidence: (drive.mjs output on cashflow/expenses)
- status: verified (2026-09-16) -- Expenses shows 'One-time costs coming up: $8,000, not in the monthly total'; Emergency fund has the after-one-offs runway (qa/households one-time cases pass).

### F-018  Expenses: no "Next year" figure, so income and spending a year out cannot be compared
- when: 2026-09-15 18:10   page: cashflow/expenses   severity: idea
- for: builder
- what happened: Income shows "Next year $72,480 after the raises you entered". Expenses has every input for the same number (`inflatingMonthly`, each item's `inflates` flag, `assumptions.inflation`) but shows nothing, so the plan cannot say whether next year's left-over grows or shrinks.
- expected: an Expenses tile "Next year $35,300" (inflating items x 1.03 + the rest) and, on either page, "Left over next year".
- steps: 1) seed qa/flows/seed-retired-couple.js  2) compare the Income and Expenses headers
- suggestion: add `nextYear = inflatingMonthly * 12 * (1 + inflation) + (yearly - inflatingMonthly * 12)` to expenses compute and a tile; show `income.nextYear - expenses.nextYear` next to "Left over".
- evidence: (drive.mjs output on cashflow/expenses and cashflow/income)
- status: verified (2026-09-16) -- Expenses: 'Next year about $36,461 after inflation (leaving $36,019 a year)' = 2,780 x 12 x 1.03 + 175 x 12, against Income's $72,480 -- recomputed by hand.

### F-019  Debts and Expenses do not know about each other's payments
- when: 2026-09-15 18:10   page: balance/liabilities   severity: idea
- for: builder
- what happened: the Visa's $75/mo minimum lives on Debts; Expenses has a "Loan and card payments" category that is empty for the same household. Nothing links them: a person either types the same payment twice (double-counted in "must pay") or forgets it on Expenses, and the emergency-fund target is wrong either way.
- expected: Expenses shows a read-only line "Required debt payments (from Debts): $75/mo" inside "must pay", or Debts payments are pulled into the Expenses total automatically with a note.
- steps: 1) seed qa/flows/seed-retired-couple.js  2) Debts shows $75/mo paying each month  3) Expenses shows $0 in "Loan and card payments"
- suggestion: in expenses compute, when `plan.debts` has payments and no expense of category `debt` exists, add a synthetic essential item "Debt payments (from Debts)" = liabilities `payments`; if a `debt` expense exists, warn when it differs from Debts by more than 10%.
- evidence: (drive.mjs output on balance/liabilities and cashflow/expenses)
- status: verified (2026-09-16) -- Expenses lists 'Loan and card payments (from Debts) $75 a month' inside must-pay when nothing is filed under that category; totals moved from $2,880 to $2,955.

### F-020  Emergency fund: money set aside for goals still counts as usable cash
- when: 2026-09-15 18:10   page: balance/liquidity   severity: idea
- for: builder
- what happened: linking a $12,000 goal to Joint savings ($45,000) makes the goal "reached", but Emergency fund still counts the whole $45,000 as "usable today", so the same dollars are promised twice.
- expected: "Usable today $53,000, of which $12,000 is set aside for goals" and a runway on the rest (41,000 / 2,030 = 20 months).
- steps: 1) seed qa/flows/seed-retired-couple.js  2) Goals: edit Grandkids' trip, Account = Joint savings  3) Emergency fund
- suggestion: liquidity compute takes `min(goal.target, balance)` for goals whose `fundedBy` names a "now"-tier account and shows it as `earmarked`; runway uses `now - earmarked`.
- evidence: (drive.mjs output on balance/liquidity after linking a goal)
- status: verified (2026-09-16) -- Usable today is net of goal-earmarked money (single adult: 9,700 - 6,500 = 3,200; 1.2 months); the qa/households sweep confirms it across every household type.

### F-021  Net worth: the "since last time" change is computed but never shown, and no page has a chart
- when: 2026-09-15 18:10   page: balance/net-worth   severity: idea
- for: builder
- what happened: with a saved point from 6/1/2026 ($995,000) and today's ($1,072,700), the compute returns `change.sinceLast = 77,700 (+7.8%)` but the page only shows the history as a table. Also, no page draws anything: no net-worth line over time, no "where it goes" bars on Expenses, no progress bars on Goals, no payoff timeline on Debts -- every view is text and tables (no `<svg>` or `<canvas>` in any view.js).
- expected: a "+$77,700 since 6/1/2026 (+7.8%)" line under the Net worth tile; a small line chart of the history; bars for expense shares and goal progress; a payoff timeline on Debts.
- steps: 1) seed qa/flows/seed-retired-couple.js  2) Net worth: add a history point from a few months ago, press Save today's totals
- suggestion: a tiny `core/ui/chart.js` (inline SVG, no library: line, bars, progress) used by Net worth, Expenses, Goals and Debts. Note: `change` compares against the last point, which after saving today is today itself, so it should compare against the last point before today.
- evidence: (drive.mjs output on balance/net-worth with a seeded history point)
- status: fixed for the numbers (2026-09-15, builder) — `change` now compares with the last saved point before today; the "since" line and any charts are the designer's (view.js, core/ui): see F-024.

### F-022  Needs attention: retirement within a year is not called out
- when: 2026-09-15 18:10   page: overview/alerts   severity: idea
- for: builder
- what happened: Sam retires at 70 next year (People says "retires at 70 (2027)", 1 year away). Needs attention says nothing; a retirement inside 12 months changes income, healthcare and withdrawals and is the kind of thing this page exists for.
- expected: an item "Sam retires in about a year (2027)" pointing at Income (to add the pension/Social Security and end the salary).
- steps: 1) seed qa/flows/seed-retired-couple.js  2) Needs attention
- suggestion: in alerts compute, for each adult with `yearsToRetirement` between 0 and 1 and not retired, add an "info" item; later the same hook can carry age-based milestones (59½, 65 Medicare, 73 RMDs).
- evidence: (drive.mjs output on overview/alerts with qa/flows/seed-retired-couple.js)
- status: verified (2026-09-16) -- 'Sam retires in about a year (2027)' appears on Needs attention, pointing at Income.

### F-023  Net worth / Emergency fund: account type label "Savings / MMF" is an abbreviation on screen (filed by the designer)
- when: 2026-09-15 17:10   page: balance/net-worth, balance/liquidity   severity: confusing
- for: builder
- what happened: the account type "Savings / MMF" appears in the Type dropdown and in every account row. A layperson does not know MMF.
- expected: "Savings or money market".
- steps: 1) Net worth  2) open the Type dropdown
- suggestion: change the label in `modules/balance/net-worth/compute.js` ACCOUNT_TYPES (labels live in compute, outside the designer's lane).
- evidence: shots/qa-ef-phone.png
- status: fixed (2026-09-15, builder) — "Savings or money market".

### F-024  Net worth and others: show the change since last time, and draw the numbers (from F-021, builder part done)
- when: 2026-09-15 22:00   page: balance/net-worth, cashflow/expenses, goals/goals, balance/liabilities   severity: idea
- for: designer
- what happened: the numbers exist (`change.sinceLast`, `change.since`, `history[]`, category shares, goal `progress`, debt `months`) but no page draws anything and Net worth never says "+$77,700 since 6/1/2026".
- expected: a "+$77,700 since 6/1/2026 (+7.8%)" line under the Net worth tile; a small line of the history; bars where shares and progress are shown; a payoff timeline on Debts.
- suggestion: a tiny inline-SVG helper in `core/ui/` (line, bars), no library; the computes already provide everything.
- evidence: (see F-021)
- status: open

### F-025  Ask the plan: the assistant points to pages that do not exist (filed by the designer)
- when: 2026-09-15 23:30   page: ai/assistant   severity: confusing
- for: builder
- what happened: asked "What should I do first?" on the seeded retired-couple plan. The answer sent me to the "Debt Management page", the "Goals Dashboard" and the "Investment Allocation page"; none of those names exist in the menu. It also adds its own "Not a licensed advisor" note, which the page already says.
- expected: the assistant names real pages ("Debts", "Goals", "Net worth") so a person can find them, and does not repeat the disclaimer.
- steps: 1) sandbox, seed qa/flows/seed-retired-couple.js  2) Ask the plan  3) tap "What should I do first?"
- suggestion: in `modules/ai/assistant/compute.js`, add the list of ready page titles (with one-line purposes) to the SYSTEM_PROMPT / plan summary and tell the model to refer to pages by those titles only; drop the disclaimer instruction since the page shows it.
- evidence: shots/qa-ask-chat-phone.png
- status: fixed (2026-09-16, builder) — the model gets a PAGES list (every ready page: title and purpose, from ctx.modules) and is told to use only those names and to add no disclaimer.

### F-026  Bills and regular payments: ended incomes and expenses are listed as expected (filed by the designer)
- when: 2026-09-16 00:30   page: cashflow/recurring   severity: confusing
- for: builder
- what happened: on the seeded retired-couple plan, "Typed on the Income and Expenses pages" lists "Old mortgage payment" (ended 6/30/2024) and "Sam's old salary" (ended 12/31/2025) alongside the live ones, with a monthly amount each. The Forecast page correctly leaves them out.
- expected: ended items are left out (or shown greyed with an "ended" pill like Income and Expenses do); items that have not started yet say so.
- steps: 1) sandbox, seed qa/flows/seed-retired-couple.js  2) Bills and regular payments
- suggestion: in `modules/cashflow/recurring/compute.js`, filter the typed list by start/end date against today the way `cashflow/forecast` does.
- evidence: shots/qa-p4-recurring-phone.png
- status: fixed (2026-09-16, builder) — typed items carry a state (active / ended / upcoming); the Bills page lists only active ones and names the others in a "Not counted" line; test added.

### F-027  Emergency fund and Docs: inline text links are 17-20 px tall (found by qa/smoke-all.mjs)
- when: 2026-09-16 01:10   page: balance/liquidity, system/docs   severity: confusing
- for: designer
- what happened: the whole-app smoke pass (`node qa/smoke-all.mjs`, every usable page in the sandbox) is clean except two places with links inside running text: "Update them there." under the account lists on Emergency fund, and the links inside rendered docs (AGENTS.md, docs/PLAN.md ...), all 17-20 px tall.
- expected: either a real button/row for the Emergency fund link, and for docs either bigger line-height on links or leave them (prose links are a known exception: decide and note the rule).
- suggestion: Emergency fund: make "Update balances on Net worth" a secondary button in a `ui.row`. Docs: `.doc a` with `padding: 12px 0; display: inline-block` or an explicit rule in AGENTS.md that prose links are exempt.
- evidence: run `node qa/smoke-all.mjs` (4 minutes) or look at shots/qa-smoke-balance-liquidity-phone.png
- status: open

### F-028  Retirement: a pension typed on the Income page never reaches "Will the money last?" (found by the lead)
- when: 2026-10-26 15:22   page: retirement/projection, cashflow/income   severity: wrong number
- for: builder
- what happened: the Income page asks for "a pension" (income type `pension`), but `modules/retirement/projection/compute.js` builds retirement income only from Social Security and `plan.retirement.pensions`, and line 74 leaves `pension` items out of a partner's pay on purpose. Nothing in the app writes `retirement.pensions`: only `core/schema/migrate.js` creates it (empty) and the tests fill it. So a pension entered where the app asks for it is missing from the projection, the year-by-year table and every page built on them.
- expected: a pension entered once counts in retirement.
- suggestion: in the projection, also turn current or future `income` items of type `pension` into retirement incomes (yearly from amount and period, start age from `startDate` or the person's retirement age, `cola` from `growth > 0`), skipping any that duplicate a `retirement.pensions` entry. Or route the Income page's pension type into `retirement.pensions`. The planned `retirement/pensions` page (prompt `build-retirement-pensions`, #14 on the prompt board) can then own the details. Add a test: a plan whose only retirement income is a pension from the Income page.
- evidence: `modules/retirement/projection/compute.js` lines 68 and 74; `core/schema/migrate.js` line 64; `grep -rn "retirement.pensions" modules core`.
- status: fixed (2026-10-30, builder) — `incomePensions()` in the projection turns Income-page pensions into retirement incomes (start from the start date or now, end date, rise = keeps up with inflation, taxable flag), skipping one-offs, ended items and repeats of a `retirement.pensions` entry; every retirement page built on `buildInputs` gets it. Two tests in `modules/retirement/projection/module.test.mjs`.

### F-029  Federal tax: the tax math disagrees with the law on 2,246 of 12,000 test returns, seven causes (found by the federal tax answer key)
- when: 2026-10-26 16:00   page: taxes/federal, core/math/tax.js   severity: wrong number
- for: builder
- what happened: `tests/golden-federal.test.mjs` (pull request #1, merged in `c61f889`) checks the engine against 12,000 invented returns for 2024 to 2026 whose answers were worked from the IRS figures without the app's code. 9,754 agree within $1. The other 2,246 run as to-do tests, listed by cause in `tests/golden/taxes/federal-todo.json`, each cause with a worked example in `tests/golden/taxes/RULES.md` section 11:
  1. `capital-loss-dropped` (870 rows): a net capital loss larger than interest, non-qualified dividends, pensions and IRA money is dropped (`otherOrdinary` is floored at 0), so AGI and taxable income come out too high. The law takes up to $3,000 off any income, wages included (IRC §1211(b)).
  2. `charity-2026` (998): the 2026 charity rules are missing: gifts count only above 0.5% of AGI for people who itemize, and people who take the standard deduction deduct up to $1,000 ($2,000 joint) of cash gifts.
  3. `senior-deduction-separate` (325): the $6,000 senior deduction is given on married-filing-separately returns; the law allows it to married people only on a joint return (so the separate-return threshold in `modules/taxes/federal/data/federal.js` goes too).
  4. `itemized-limit-2026` (225): the 2026 limit on itemized deductions in the 37% bracket (cut by 2/37, IRC §68 as amended) is missing.
  5. `senior-phase-out-per-person` (96): the senior deduction's 6% phase-out is taken once from $12,000 instead of from each person's $6,000, so a couple keeps too much.
  6. `salt-separate-phase-down` (50): the married-filing-separately cap on state and local taxes phases down at 15% of the income over the threshold instead of the law's 30%.
  7. `gains-worksheet-line-25` (1): the capital gains worksheet's last step (take the smaller of the worksheet tax and the regular tax) is not applied.
  Also, outside the test's columns (checked): `taxInputs()` in `modules/taxes/federal/compute.js` never passes `investmentIncome`, so `core/math/tax.js` line 169 counts only qualified dividends and long-term gains toward the 3.8% net investment income tax; interest, other dividends and short-term gains are left out.
- expected: all 12,000 rows within $1, and the page's net investment income tax counting all investment income.
- suggestion: fix one cause at a time in `core/math/tax.js` (and the page's inputs for 1 and the investment income); when a cause is fixed, delete its list from `federal-todo.json` and its rows must then pass. The answer's author reports that all seven fixes, applied to a scratch copy, brought every row into agreement and that taking any one away brought its rows back. Add the investment-income case to `tests/tax-pages.test.mjs`.
- evidence: `npm test` (2,246 to-do); `node --test tests/golden-federal.test.mjs`; https://github.com/luisitin/financial-planner/pull/1; prompt `heavy-federal-tax-grid` on the prompt board.
- status: fixed (2026-10-30, builder) — all seven causes fixed in `core/math/tax.js` and `itemizedTotal` (allowed capital loss as its own input, `capitalLoss`; senior deduction per person and joint-only; gains worksheet line 25; separate-return SALT at 30% on halved figures; 2026 charity floor, non-itemizer gifts `charitableCash`, and the §68 limit from new `charity` / `itemizedLimit` table entries). The golden runner passes the loss and gifts the way the page does; `federal-todo.json` is empty and all 12,000 rows agree within $1. `taxInputs()` now passes `investmentIncome` (dividends and interest, typed qualified dividends, net gain or allowed loss). Tests corrected in `tests/tax.test.mjs` and `tests/tax-pages.test.mjs`, one added.

### F-030  Retirement: 468 of 12,700 answer-key cases disagree with the rules, seventeen causes (found by the retirement answer key)
- when: 2026-10-26 18:05   page: retirement/* (ten pages), core/math/retirement.js, core/math/rmd.js   severity: wrong number
- for: builder
- what happened: `tests/golden-retirement.test.mjs` (pull request #4, merged in `9557ad3`) checks ten retirement pages against 12,700 cases worked from cited rules without the app's code. 12,232 agree; 468 run as to-do tests. `tests/golden/retirement/DISAGREEMENTS.md` gives each cause with worked numbers and a case id:
  1. Required withdrawals: people born before July 1949 start at 70½, not 72 (`rmd-cohort-061`); the withdrawal is worked on the household's total instead of each owner's accounts (`rmd-ownership-001`); life-insurance cash value is treated as an IRA and gets a required withdrawal (`rmd-exclusions-009`).
  2. Contributions: an employer's HSA deposits do not count toward the yearly HSA limit (`contributions-hsa-employer-cap-001`).
  3. "How much can I spend": the search's upper bound is too low ($20,000 that could all be spent comes out as $10,004, `projection-affordable-001`) and it stops about $2 short at very large balances (`projection-affordable-092`).
  4. Variable percentage withdrawal pays at the end of the year instead of the start (`withdrawal-strategy-vpw-beginning-timing-092`).
  5. Tax inside the retirement pages: indexing rounds the 2025 head-of-household standard deduction in its own year ($23,650 instead of $23,625, `withdrawal-order-indexing-004`); the senior deduction on separate returns and the once-only couple phase-out, the same causes as F-029 (`withdrawal-order-senior-003`, `-027`, `roth-conversions-room-073`).
  6. Roth conversions: the room is rounded to whole dollars (`roth-conversions-room-061`), the bracket-filling target stops within a dollar (`roth-conversions-eligibility-009`) and conversions under $1 are skipped (`-091`).
  7. How long the money must last: the survival search stops at 120 before it crosses, the remaining-life sum drops the years after 120, and the couple search stops after 70 years.
- expected: the cases agree, or a cause is recorded as an intended simplification in the page README and its rows' to-do says so.
- suggestion: fix 1, 2 and 5 first (they change real plans' numbers); 3 and 4 next; 6 and 7 are small. F-029's fixes to `core/math/tax.js` clear part of 5. When a cause is fixed, clear the `todo` column on its rows and they must pass. The generators in `tools/golden_retirement/` rebuild the CSVs from the rules; never regenerate them from the app's code.
- evidence: `npm test` (468 retirement to-do); `GOLDEN_PAGES=rmd node --test tests/golden-retirement.test.mjs`; https://github.com/luisitin/financial-planner/pull/4; prompt `heavy-golden-retirement`.
- status: fixed (2026-10-30, builder) — all seventeen causes: required withdrawals per owner at each owner's age (`rmd.owners` slices in the engine, `rmdBy` per row), 70½ for births before July 1949 (`rmdStartAge`/`rmdStartYear` take the birth date), cash value has none; employer HSA deposits count toward the HSA limit; the spending search's ceiling doubles until it fails and bisects below a cent; VPW pays at the start of the year; a table's own year keeps its published figures; senior deduction per F-029; Roth room and conversions solved to a fraction of a cent (`largestAtOrUnder`), no $1 minimum; no 120 or 70-year caps in How long to plan for. The `vpw` and `life-expectancy-sum` compatibility rules were changed in the generators to match their sourced twins, every CSV was rebuilt by `tools/golden_retirement/*.py` (byte-identical before the change), the lead audit re-ran, `package.py` was fixed to skip the Social Security CSVs; 12,700 of 12,700 agree, 0 to-do.

### F-031  Social Security: the tables stop before SSA's October 2026 figures; spouse and survivor amounts missing (found by the Social Security answer key)
- when: 2026-10-26 18:05   page: retirement/social-security   severity: wrong number
- for: builder
- what happened: `tests/golden-social-security.test.mjs` (from pull request #3, in `07c455d`) checks the page against 2,000 invented earnings histories and 66,000 claiming-age rows worked from SSA's rules. Six to-do tests record what is missing: `modules/retirement/social-security/data/ssa.js` ends at the 2024 average wage index and the 2025 cost-of-living raise, so a 1965 birth year indexes earnings with a stale wage index; the 2027 bend points are derived ($1,286 and $7,749) instead of SSA's published $1,340 and $8,077; the 2026 raise (3.6%) is not applied; 2027 earnings are not capped at $192,300. Nine benefits come out one dime low because binary floating point floors the claim factor product ($2,315.50 shows as $2,315.40). The page returns no spouse or survivor estimate.
- expected: the published SSA figures in the table; benefits exact to the dime; spouse and survivor amounts (the CSV has benchmark columns for both).
- suggestion: add the 2025 wage index, the 2026 raise, the 2027 bend points and the 2027 earnings cap to `ssa.js`, each checked on ssa.gov (links in `tests/golden/retirement/ss-rules.md`; the answer key read them on 2026-10-26). Round in whole cents before the dime floor (or work in cents). Spouse and survivor amounts can come with the planned pages that need them.
- evidence: `node --test tests/golden-social-security.test.mjs` (6 to-do); `tests/golden/retirement/ss-rules.md`; prompt `heavy-social-security-grid`.
- status: fixed (2026-10-30, builder) — `data/ssa.js` (via `tools/extract-ssa.mjs`) has the 2025 wage index, the December 2026 COLA, the 2027 maximum and credit amount; the 2027 bend points now derive to $1,340 and $8,077; later years keep the last published maximum instead of none; every dime floor goes through `floorDime`; `compute()` returns `pia`, `spousalAtSameAge`, `survivor` per person and a `couple` block (top-ups, survivor income). The golden test now checks all 66,000 rows (not the 2% sample), every to-do is a normal test, 0 to-do. Two things the key gets wrong, recorded in the test and README: history `w12-h04-steady-y1957` is a dime low in the key (its generator floored 2,984.80 to 2,984.70), and its `survivor` column ignores the widow(er)'s limit (82.5% of the PIA when the worker claimed early); the test applies the limit. Filed as F-032 for whoever owns the key; showing the spouse and survivor amounts on the page is F-033 for the designer.

### F-032  Social Security answer key: one history a dime low, and the survivor column misses the widow(er)'s limit (found by the builder)
- when: 2026-10-30 12:00   page: tests/golden/retirement/ss-benefits.csv   severity: wrong number (in the key)
- for: owner
- what happened: replaying all 66,000 rows (F-031) agrees everywhere except (1) `w12-h04-steady-y1957`: the key has PIA 3,068.20; exact is 3,068.30 (2,912.00 x 1.025 = 2,984.80 exactly, the key floored a binary 2,984.7999... to 2,984.70), and the dime carries into every claiming age; (2) the `survivor` column is "the worker's benefit at that age" (ss-rules.md), but a survivor at full retirement age gets at least 82.5% of the worker's PIA when the worker claimed early (SSA POMS RS 00615.320, the widow(er)'s limit), so 16,616 early-claim rows understate it.
- expected: the key's generator in Decimal arithmetic end to end, and the survivor column with the limit (or renamed "worker's benefit").
- suggestion: the generator is not in the repo (pull request #3 shipped only the CSVs); regenerate with the two fixes and remove `KEY_DIME_LOW` and `survivorByLaw` from `tests/golden-social-security.test.mjs`.
- evidence: `node --test tests/golden-social-security.test.mjs`; the comments above `KEY_DIME_LOW` and `survivorByLaw`.
- status: open

### F-033  Social Security: show the spouse and survivor amounts (filed by the builder)
- when: 2026-10-30 12:00   page: retirement/social-security   severity: idea
- for: designer
- what happened: `compute()` now returns, per person, `spousalAtSameAge` and `survivor`, and for a couple `couple.spousal[personId]` (the top-up on the partner's record), `couple.survivorMonthly[personId]` (what that person keeps if the other dies first) and `couple.survivorYearly`. The page shows none of it yet.
- suggestion: in each person's fold, a line "If Lee dies first, Sam keeps $2,475 a month" and, when a top-up is above 0, "On Lee's record, Sam gets $500 a month more once Lee has claimed". Plain words; no "PIA".
- status: open

### F-034  Emergency fund: money saved for a goal called "Emergency fund" is taken out of the emergency fund (found by the builder)
- when: 2026-10-30 14:00   page: balance/liquidity (and overview/next-best-action, which follows it)   severity: confusing
- for: owner
- what happened: F-020 sets money earmarked for goals aside so it is not counted as usable cash. Every household in `qa/households` (and the sample family) has a goal named "Emergency fund" (icon 🛟) funded by the savings account, so that very money is subtracted from the emergency fund: the family in `qa/fixtures/family-plan.mjs` has $15,700 of cash but the page counts $4,200 (0.9 months), and the goal and the page then track the same money twice with different targets ($20,000 vs 6 months = $27,470).
- expected: a decision: is an emergency-fund goal the emergency fund?
- suggestion: A) a goal whose name says "emergency" (or icon 🛟) is not earmarked: its money counts as usable cash, and the Emergency fund page shows the goal's target next to its own; B) leave it, and say on the Goals page that an emergency-fund goal is kept apart from the cash cushion; C) let the owner tick "this is my emergency fund" on a goal. A or C needs `qa/households/lib/expect.mjs` updated by the tester.
- status: open (owner). 2026-10-30 builder: option C is built as an opt-in: goals/emergency-fund has "This goal is my emergency fund", and balance/liquidity skips earmarking for a ticked goal. Nothing changes until a goal is ticked, so `qa/households` expectations hold; A or B remain the owner's call.

### F-035  Printing any page prints the app around it (filed by the builder)
- when: 2026-10-30 15:00   page: all   severity: idea
- for: designer
- what happened: there are no print styles, so the browser's Print on any page prints the top bar and, on a wide screen, the sidebar. The reports print through their own button (`modules/reports/report-kit.js` opens the sheet as a document of its own), so they are fine; every other page is not.
- suggestion: in `core/ui/base.css`, `@media print { #topbar, #sidebar, #scrim, .chips, button { display: none } #content { max-width: none; padding: 0 } .card { box-shadow: none; break-inside: avoid } }`, light colours forced (`color-scheme: light`).
- status: open

## Closed

(nothing yet)

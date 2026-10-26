# Design log

Every design decision the owner made, so no future session re-argues it. Newest first.
Written by the design-review loop (`.claude/skills/design-review/SKILL.md`, launched with
`Design-Review.bat`) and by anyone who changes the look on purpose.

Format for an entry:

```
## 2026-09-15  <item>
Finding: <what was wrong, in plain words>
Options offered: A) ...  B) ...  C) Leave as is
Owner chose: B
Changed: core/ui/base.css, modules/x/y/view.js
Rule (if any): ...
```

## Pass 4 summary, 2026-09-16 (after Phase 5), 2 rounds
The builder's `qa/smoke-all.mjs` now does the mechanical sweep (errors, overflow, tap targets) at the
start of each pass: 54 usable pages, all clean after this pass. Rounds: the eleven retirement pages
(shared chart helper redrawn at phone size, run-out years collapsed, method sources folded, Social
Security folded per person) and one leftover small link on Emergency fund. Skipped on purpose: Will
the money last? (compute claimed by the builder for Phase 6) and the tax pages the builder has
already marked usable but still holds claims on; both join the next pass.

## 2026-09-16  Pass 4, round 2: Emergency fund
Finding: the last sub-44 px tap target in the app, an inline "Update them there." link.
Options offered: A) outlined button "Update balances on Net worth"  B) Leave as is
Owner chose: A
Changed: modules/balance/liquidity/view.js

## 2026-09-16  Pass 4 (after Phase 5), round 1: the eleven retirement pages
Reviewed all eleven with the sample household (smoke-all profile). Will the money last? is left untouched this pass: the builder has its compute claimed for a Phase 6 change.
Finding 1: chart labels were about 6 px on a phone (640-wide drawing shrunk to 360); an all-zero History result drew an empty chart with ticks "1 1 1 0 0".
Options offered: A) phone-size drawing (labels 11 px), capped at 560 px on desktop, a sentence instead of an empty chart  B) labels only  C) Leave as is
Owner chose: A
Changed: modules/retirement/charts.js (shared look-only helper), modules/retirement/historical/view.js

Finding 2: Year by year listed 27 identical "$0 ... short" rows after the money ran out.
Options offered: A) one collapsed row "2059 to 2085: nothing left; about $73,516 short every year"  B) fold by decade  C) Leave as is
Owner chose: A
Changed: modules/retirement/cash-flow/view.js

Finding 3: How much to take out carried academic tags on every method, said "runs out at 95" for a plan ending at 95, and placed "Use this one" inconsistently.
Options offered: A) tags into a "Where these methods come from" fold, "lasts to the end (95)", buttons on their own line  B) Leave as is
Owner chose: A
Changed: modules/retirement/withdrawal-strategy/view.js

Finding 4: Social Security opened both people's full forms at once.
Options offered: A) one fold per person, first open, the one just saved stays open; green Saved (already there)  B) confirmations only  C) Leave as is
Owner chose: A
Changed: modules/retirement/social-security/view.js

Noted for when the builder releases it: Will the money last? shares the chart fix already; its "Left in 2085 $0 - nothing" tile and the "retire" label will be checked next pass.

## Pass 3 summary, 2026-09-16 (after Phase 4), 4 rounds
Loop re-run from the Dashboard with the seeded plan plus imported transactions. The pages reviewed
in passes 1-2 held up (an automated sweep of all 34 usable pages: 0 tap targets under 44 px, no
horizontal overflow, no render errors). Changes: Expenses back to four tiles with next-year and
one-time costs as a sentence; ended rows on Expenses and Income read "ended"; the Import flow
shows results first with the column choices folded and an app-style file button; Categorise,
Budget and Rules got the green confirmations and folded add forms. Nothing declined; nothing
filed for the builder this pass. Phase 5 (retirement) scaffolds were appearing as the pass ended;
those pages join the queue when the builder marks them usable.

## 2026-09-16  Pass 3, round 4: Rules (with rules on file)
Finding: add form open under the list; silent saves.
Options offered: A) fold behind "+ Add a rule", green Rule added / saved / removed  B) Leave as is
Owner chose: A
Changed: modules/transactions/rules/view.js
Transfers: no findings.

## 2026-09-16  Pass 3, round 3: Categorise and Budget flows
Finding: picking a category and adding an envelope saved silently; Budget's add form stayed open.
Options offered: A) green confirmations on both ("Kroger Dayton filed under Groceries (2 transactions).", "Envelope added."), Budget's form folds behind "+ Add another envelope"  B) confirmations only  C) Leave as is
Owner chose: A
Changed: modules/transactions/categorize/view.js, modules/cashflow/budget/view.js

## 2026-09-16  Pass 3, round 2: Import flow (paste, preview, import)
Finding 1: five column dropdowns came before the results although the columns were found automatically.
Options offered: A) results first; columns behind "Columns worked out for you. Change them ›", open by itself when the date or amount column is missing  B) Leave as is
Owner chose: A
Changed: modules/transactions/import/view.js

Finding 2: the browser's raw file control.
Options offered: A) "Choose the file" button with the file name beside it (like the Statement reader)  B) Leave as is
Owner chose: A
Changed: modules/transactions/import/view.js

## 2026-09-16  Pass 3 (after Phase 4), round 1: Dashboard, drawer, Expenses, Emergency fund, Goals
Dashboard, drawer, Emergency fund, Goals: no new findings.
Finding 1 (Expenses): six tiles after the builder's additions.
Options offered: A) four tiles + one sentence for next year and one-time costs  B) Leave as is
Owner chose: A
Changed: modules/cashflow/expenses/view.js

Finding 2 (Expenses, Income): ended rows still showed a grey monthly amount on the right.
Options offered: A) right column says "ended" / "not yet"  B) Leave as is
Owner chose: A
Changed: modules/cashflow/expenses/view.js, modules/cashflow/income/view.js

## Pass 2 summary, 2026-09-15/16 (after Phase 3; Phase 4 landed mid-pass), 10 rounds
Re-ran the loop from the Dashboard with real data in the sandbox (retired-couple seed + a bank
import). Reviewed: Dashboard, drawer, All pages, Net worth, Settings, Docs, coming-soon, dark,
desktop, Ask the plan (now usable), Statement reader (new), and the ten Phase 4 pages.
Decisions: 24 accepted, 1 alternative chosen (Net worth keeps Edit/Delete on rows), 0 declined.
Filed for the builder: F-025 (assistant names pages that do not exist), F-026 (Bills lists ended
items). New shared pieces: `.stat-link` tiles, `button:disabled` look, the drawer's "Recent" list,
the Forecast balance chart (inline SVG pattern other pages can copy).
Left for later: the next phase's pages; a real bank file has still not been tried on Import.

## 2026-09-16  Pass 2, round 10: debt pages (Pay off debts, Credit cards, What lenders see; Mortgage and Refinance empty states read fine)
Finding 1: "3 yr 10 mo", "$75/mo required", "0.4 mo", "Debt-free by 7/15/2030", "100 more a month".
Options offered: A) spell them out ("3 years 10 months", "$75 a month required", "0.4 months", "Debt-free by July 2030", "$100 more a month") + green confirmations on Save plan / Use these numbers  B) Leave as is
Owner chose: A
Changed: modules/debt/payoff/view.js, modules/debt/credit-cards/view.js, modules/debt/ratios/view.js

Finding 2: a tiny "·" in the icon box of rows without a status.
Options offered: A) empty box  B) neutral symbol  C) Leave as is
Owner chose: A
Changed: modules/debt/payoff/view.js, modules/debt/ratios/view.js

## 2026-09-16  Pass 2, round 9: cash-flow pages (Bills, Forecast, Budget, Irregular expenses, Subscriptions)
Finding 1: "$650/mo" and cents on typed amounts on Bills and Irregular expenses.
Options offered: A) "a month" under the figure, whole numbers for typed amounts (bank amounts keep cents)  B) Leave as is
Owner chose: A
Changed: modules/cashflow/recurring/view.js, modules/cashflow/sinking-funds/view.js

Finding 2: the Forecast "Day by day" chart was 90 unlabeled bars.
Options offered: A) a balance line with the lowest day marked, month labels, a red band only below zero, touch readout  B) bars + labels  C) Leave as is
Owner chose: A. Built as inline SVG (2 px accent line, soft fill, 8 px marker, range gridlines, crosshair on touch/hover); the vertical range hugs the data so a dip is visible; the start balance is the first point so the marked low matches the tile.
Changed: modules/cashflow/forecast/view.js (balanceChart)

Finding 3: "What is expected" was one 90-day block with "(typed)" on every line.
Options offered: A) grouped by month, first month open, others folded, "(typed)" dropped, bank items say "from your bank"  B) drop "(typed)" only  C) Leave as is
Owner chose: A
Changed: modules/cashflow/forecast/view.js

Budget and Subscriptions: no findings. Filed F-026 for the builder: ended items (Old mortgage payment, Sam's old salary) still appear on Bills.

## 2026-09-15  Pass 2, round 8: Statement reader (new)
Finding 1: "No CSV from the bank?", "a model that can see images", "the status pill should say PC".
Options offered: A) plain rewrite (text in the round)  B) Leave as is
Owner chose: A
Changed: modules/transactions/statements/view.js

Finding 2: the browser's raw file control; no camera shortcut on a phone.
Options offered: A) "Choose a PDF or picture" + "Take a photo" buttons with the file name beside them  B) one button  C) Leave as is
Owner chose: A
Changed: modules/transactions/statements/view.js

Finding 3: "Read the statement" looked active with no file chosen.
Options offered: A) visibly disabled until a file is picked; "Reading... this takes a minute or two for a photo" while working  B) Leave as is
Owner chose: A
Changed: core/ui/base.css (button:disabled), modules/transactions/statements/view.js
Rule: disabled buttons look disabled (base.css does it for every button).

## 2026-09-15  Pass 2, round 7: Ask the plan (now usable)
Finding 1: answers showed raw formatting marks (**bold**, *italic*).
Options offered: A) render bold, italic, lists and paragraphs; file the made-up page names for the builder  B) strip the marks  C) Leave as is
Owner chose: A (F-025 filed: give the model the real page names)
Changed: modules/ai/assistant/view.js (formatAnswer, escaped first)

Finding 2: the intro and suggestion chips stayed above the chat after the first question.
Options offered: A) intro shrinks to one line, chips fold behind "Suggestions", newest answer scrolled into view  B) scroll only  C) Leave as is
Owner chose: A
Changed: modules/ai/assistant/view.js

## 2026-09-15  Pass 2, round 6: Docs, coming-soon page, dark mode, desktop
No new findings. Consistency fix from round 4: the dashboard's Net worth tile also says "saved today" when the last snapshot is today.
Changed: modules/overview/dashboard/view.js

## 2026-09-15  Pass 2, round 5: Settings
Finding 1: "Last changed ... Nothing saved yet" on an empty plan.
Options offered: A) "No accounts or entries yet." until there is something  B) Leave as is
Owner chose: A
Changed: modules/system/settings/view.js

Finding 2: the access-token help sounded optional although the PC now requires one.
Options offered: A) "Your PC asks for one. On the PC, run Show-Token to see it, then type it here once." when the PC reports it requires a token  B) Leave as is
Owner chose: A
Changed: modules/system/settings/view.js

## 2026-09-15  Pass 2, round 4: Net worth with data
Finding 1: with eight accounts, sixteen Edit/Delete buttons in a column.
Options offered: A) tap the row to edit, Delete inside the form  B) keep both buttons, smaller, right-aligned on the name line  C) Leave as is
Owner chose: B (buttons keep the 44 px height with narrow padding; balance moves to the second line)
Changed: modules/balance/net-worth/view.js, core/ui/base.css (.records .rec-actions)

Finding 2: "Save today's totals" gave no confirmation and the tile then read "+$0 since today".
Options offered: A) green "Today's totals saved." + "saved today" on the tile  B) confirmation only  C) Leave as is
Owner chose: A
Changed: modules/balance/net-worth/view.js

## 2026-09-15  Pass 2, round 3: All pages
Finding 1: rows with their own icon were indented, the rest hugged the left edge.
Options offered: A) small icon on every row (own or topic's), titles aligned  B) no row icons  C) Leave as is
Owner chose: A
Changed: modules/overview/pages/view.js, core/ui/base.css (.page-list .ic-sm)

Finding 2: builder/finance words in descriptions: "r/personalfinance flowchart", "DIME", "xlsx or csv or JSON", "CSV file".
Options offered: A) rewrite those (wording in the round)  B) Leave as is
Owner chose: A
Changed: purpose in modules/overview/next-best-action, insurance/life-needs, reports/export, transactions/import, transactions/statements (module.js) and docs/MODULE_CATALOG.md; npm run registry

## 2026-09-15  Pass 2, round 2: menu drawer
Finding: "Ready now" listed the first 8 ready pages in topic order; the most-used pages fell behind "All 24 ready pages".
Options offered: A) "Recent": the 8 pages opened last on this device, Dashboard always first (falls back to today's list before anything is opened)  B) fixed short list  C) Leave as is
Owner chose: A
Changed: core/app.js (nav.recent in the saved nav state; recorded in show())

## 2026-09-15  Pass 2 (after Phase 3), round 1: Dashboard with data
Finding 1: "Start here" never changed once the plan had data.
Options offered: A) after the first account: "What to do now" with Needs attention (live count), Import a bank file, Ask a question  B) hide once all steps done  C) Leave as is
Owner chose: A
Changed: modules/overview/dashboard/view.js (uses computeOf("overview/alerts"))

Finding 2: six struck-through steps stayed on screen after setup was complete.
Options offered: A) one folded line "all 6 steps done ✓"  B) hide the card  C) Leave as is
Owner chose: A
Changed: modules/overview/dashboard/view.js

Finding 3: money tiles were static; Goals said "see Goals".
Options offered: A) tiles open their pages with a chevron; Goals reads "1 reached, 2 behind"  B) wording only  C) Leave as is
Owner chose: A
Changed: modules/overview/dashboard/view.js, core/ui/base.css (.stat-link, .stat-chev)

## Session summary, 2026-09-15 (design review, 19 rounds)
Reviewed on a 390 px phone, then dark mode and 1280 px desktop: Dashboard, menu drawer, All pages,
Net worth, Settings, Docs, coming-soon pages, shell pieces, People, Emergency fund, Debts, Income,
Expenses, Goals, Assumptions, Needs attention, Ledger, Categorise, Where the money goes, Rules,
Categories, Transfers, Duplicates, Import, Income statement.

Decisions the owner made (all recorded below, newest first): 46 accepted, 1 declined (the ten-phase
list stays on the dashboard "for now, once built it won't exist"). Tester items closed: F-002,
F-004, F-005, F-006, F-008, F-011, F-016 (F-010 was solved by the Settings round). Filed for the
builder: F-012 (Ask the plan is a stub: plain wording, chat feedback), F-023 ("Savings / MMF" label).

Rules that came out of it (also in AGENTS.md "Design rules"): tables become stacked records on a
phone; big figures go through ui.stat; a page with data folds its add form behind "+ Add another
..."; every save/add/remove confirms in green and errors say what to do (kept across the shell
re-render via a module-level `pending`); technical sections are folded last; text on a filled
accent element is var(--on-accent); 44 px tap targets everywhere (verified with qa.smallTargets).

Bugs fixed on the way (not design choices): ui.form prefilled percent fields with the stored
fraction (editing an existing rate silently failed); a round-5 change of mine had stacked the
builder's .page-list rows (fixed in round 9).

Left for later: Statements (transactions/statements) once the builder finishes it; the "Ready now"
list will need revisiting when most pages are ready; Docs purposes still carry a few builder words
("r/personalfinance flowchart"); the dashboard's phase list wording lives in core/phases.js
(builder's file) if the owner ever wants it plainer.

## 2026-09-15  Categories, round 19 (phone); Rules, Transfers, Duplicates reviewed, no findings
Finding: thirty rows each saying "not used yet", plus the open add form: five screens.
Options offered: A) count only when used, add form folded behind "+ Add a category"  B) fold the form only  C) Leave as is
Owner chose: A
Changed: modules/transactions/categories/view.js

## 2026-09-15  Transactions, round 18 (Ledger, Categorise, Where the money goes; phone)
Finding 1: Ledger opened with a full screen of four stacked filters.
Options offered: A) totals first, filters folded behind a "Showing: all months · all accounts · all categories" row that stays open while a filter is set  B) filters in two rows  C) Leave as is
Owner chose: A
Changed: modules/transactions/ledger/view.js

Finding 2: uncategorised rows said it twice (pill + "Uncategorised" in the grey line).
Options offered: A) pill only  B) Leave as is
Owner chose: A
Changed: modules/transactions/ledger/view.js

Finding 3: counts as "2×" pills.
Options offered: A) "2 transactions" / "1 transaction"  B) "2 times"  C) Leave as is
Owner chose: A
Changed: modules/transactions/categorize/view.js, modules/cashflow/spending/view.js

Reviewed without findings: Import (empty state), Income statement (empty state).

## 2026-09-15  Assumptions, round 17 (phone); Needs attention reviewed, no findings
Finding 1: every field carried a paragraph of sourcing; four screens long.
Options offered: A) one plain line + "Default: 3%" per field, all sources in one fold at the end  B) fold each paragraph  C) Leave as is
Owner chose: A (plain lines live in the view's PLAIN table; compute.js sources are untouched and shown in the fold)
Changed: modules/system/assumptions/view.js

Finding 2: a "not yet" tile posing as a number and two filled buttons.
Options offered: A) review status as a notice, one filled "Save and mark as reviewed" (saving is reviewing), Reset outlined, green confirmation  B) two buttons, Save outlined  C) Leave as is
Owner chose: A
Changed: modules/system/assumptions/view.js

## 2026-09-15  Expenses and Goals, round 16 (phone)
Finding 1: the settled rules (fold the add form, "Edit ›" rows, green confirmations) had not reached these pages.
Options offered: A) both pages  B) Expenses only  C) Leave as is
Owner chose: A
Changed: modules/cashflow/expenses/view.js, modules/goals/goals/view.js

Finding 2: "$650/mo" on every Expenses row; "needs $1,993/mo · you put in $200/mo" on Goals.
Options offered: A) same as Income: amount on top, "a month" / "one time" under it; Goals reads "needs $1,993 a month; you put in $200"  B) Leave as is
Owner chose: A
Changed: modules/cashflow/expenses/view.js, modules/goals/goals/view.js

Finding 3: "Roof fund points to an account that no longer exists." with nothing to do about it.
Options offered: A) the goal name in the warning is a tap that opens its form + "Tap it to pick another." + a "check account" pill on the row  B) pill only  C) Leave as is
Owner chose: A
Changed: modules/goals/goals/view.js

## 2026-09-15  Income, round 15 (phone)
Finding 1: the settled rules (fold the add form, "Edit ›" on rows, green confirmations) had not reached this page.
Options offered: A) all three  B) Leave as is
Owner chose: A
Changed: modules/cashflow/income/view.js

Finding 2: right-hand amounts read "$3,500/mo"; a one-time "$15,000" looked monthly.
Options offered: A) amount on top, "a month" / "one time" in small text under it, caption dropped  B) inline "a month"  C) Leave as is
Owner chose: A
Changed: modules/cashflow/income/view.js

Note: the Social Security row icon shows as the letters "US" in these screenshots because Windows has no flag emoji; phones show the flag.

## 2026-09-15  Debts, round 14 (phone)
Finding 1: an empty card said "Tap a debt above..."; rows gave no tap hint; Save showed nothing.
Options offered: A) "Edit ›" on each row, the form opens inside the list card, green "Saved X." / "Cleared X."  B) Edit + Saved only  C) Leave as is
Owner chose: A
Changed: modules/balance/liabilities/view.js

Finding 2: "$75/mo · gone by 7/15/2030".
Options offered: A) "$75 a month · paid off by July 2030"  B) spell out /mo only  C) Leave as is
Owner chose: A
Changed: modules/balance/liabilities/view.js

Bug found while verifying (not a design choice): `ui.form` prefilled percent fields with the stored fraction (0.219) instead of 21.9, so editing any existing rate failed validation silently. Fixed in core/ui/dom.js (percent fields now show x100); modules/system/assumptions/view.js stopped pre-multiplying so it does not double. Income and Goals percent fields get the fix for free.

## 2026-09-15  Emergency fund, round 13 (phone; tester F-016)
Finding 1 (F-016): the "covered" sentence quoted the target months instead of the real runway.
Options offered: A) both numbers and the amount above target  B) fix the number only  C) Leave as is
Owner chose: A
Changed: modules/balance/liquidity/view.js

Finding 2: four money tiles came first; the fund verdict was the second card.
Options offered: A) fund card first with "26 months covered" as the headline, tiles after  B) months tile first  C) Leave as is
Owner chose: A
Changed: modules/balance/liquidity/view.js (scoped .fund-head style inside the page)

Finding 3: months showed one decimal.
Options offered: A) whole months; one decimal only under 2 months  B) Leave as is
Owner chose: A
Changed: modules/balance/liquidity/view.js

Noted for the builder (F-023): the account-type label "Savings / MMF" is an abbreviation on screen; labels live in net-worth compute.js.

## 2026-09-15  Desktop widths, round 12
Reviewed People and Docs at 1280 px (dashboard, All pages, Net worth, Settings were checked wide in their own rounds).
Finding 1: Docs text ran about 150 characters per line.
Options offered: A) cap text at ~78 characters, code and tables keep the full card  B) Leave as is
Owner chose: A
Changed: core/ui/base.css (.doc > * max-width)

Finding 2: the menu's "Ready now" list grows with every finished page (18 today, heading for 150).
Options offered: A) cap at 8 + "All N ready pages ›" to All pages filtered to Ready  B) drop the list above 12 ready  C) Leave as is
Owner chose: A
Changed: core/app.js (buildNav), core/ui/base.css (.nav-more)

## 2026-09-15  Dark mode, round 11 (phone)
Reviewed dashboard, drawer, Net worth, Settings in dark mode; only one finding.
Finding: filled accent elements (buttons, next-step number, current phase, selected chip, chat bubble) were white on light blue, about 2.6:1.
Options offered: A) near-black text on the same light-blue fill in dark mode (new token --on-accent)  B) deeper blue fill with white text  C) Leave as is
Owner chose: A
Changed: core/ui/base.css (--on-accent; every `background: var(--accent)` fill uses it)
Rule: text on a filled accent element is `var(--on-accent)`, never a hard-coded #fff.

## 2026-09-15  Shell pieces, round 10 (phone)
Finding 1: the status pill said "PC" / "This device" with the meaning in a hover tooltip, 32 px tall.
Options offered: A) "Saved on PC" (green) / "Phone only" (orange) / "Sandbox", 44 px  B) height only  C) Leave as is
Owner chose: A
Changed: core/app.js (refreshStatus), core/ui/base.css (#status)

Finding 2: pills used 10-11 px text.
Options offered: A) 12 px text, 20 px tall everywhere incl. the drawer's SOON  B) Leave as is
Owner chose: A
Changed: core/ui/base.css (.pill, .nav-link .soon)

Finding 3: first load showed a bare "Loading..." and a pill saying "starting".
Options offered: A) centred icon + "Financial Planner" + "Opening your plan..." and "Connecting..." in the pill  B) reword only  C) Leave as is
Owner chose: A
Changed: index.html, core/ui/base.css (.booting)

## 2026-09-15  People, round 9 (phone; tester F-011)
Regression fixed first: round 5 moved the row layout of `.page-list li` onto the All-pages link, which stacked the builder's People rows (icon / name / Edit on separate lines). `.page-list li` is a flex row again; a row whose only child is `.row-link` hands the layout to the link.

Finding 1 (F-011): a future birth date showed "age -73".
Options offered: A) "not born yet"  B) hide the age line  C) Leave as is
Owner chose: A
Changed: modules/household/people/view.js

Finding 2: the settled rules (fold the add form once there is data; green confirmations) had not reached this page.
Options offered: A) both  B) confirmations only  C) fold only  D) Leave as is
Owner chose: A. "+ Add another person" and the open form live inside the Household card; "Bo added." / "Changes saved." / "Ana removed." / "Saved." under the tax choices.
Changed: modules/household/people/view.js

Finding 3: the "Two adults but the tax filing status is Single" warning sat at the top, the choice at the bottom.
Options offered: A) "Change it" becomes a tap that scrolls to the Taxes card  B) move Taxes above the form  C) Leave as is
Owner chose: A
Changed: modules/household/people/view.js

## 2026-09-15  Coming-soon page, round 8 (phone)
Finding 1: "Save notes" showed no confirmation (the grey "Saved." was wiped by the re-render).
Options offered: A) green "Notes saved." / "Notes cleared." kept across the refresh  B) Leave as is
Owner chose: A
Changed: core/ui/placeholder.js

Finding 2: a "For the builder: starting point ..., catalog key ..." line was printed on screen.
Options offered: A) remove it (stays in catalog + README)  B) fold behind "For builders"  C) Leave as is
Owner chose: A
Changed: core/ui/placeholder.js

Finding 3: the phase line quoted the whole phase blurb in builder words.
Options offered: A) "Part of Retirement. Comes in build phase 5 of 10."  B) Leave as is
Owner chose: A
Changed: core/ui/placeholder.js

Skipped: Ask the plan (ai/assistant) is a catalog stub, outside the designer's lane; wording findings filed as F-012 for the builder.

## 2026-09-15  Docs, round 7 (phone)
Finding 1: fourteen stacked buttons with file names in capitals filled the first screen.
Options offered: A) one "Which document" dropdown with plain names, "For you" first then "For builders"  B) chips in one scrolling row  C) Leave as is
Owner chose: A. Names: What the tester found, What you decided, What changed, Build phases, Phone at home and away, About this app; builders: How to edit this project, The blueprint, Module contract, Data model, Every page (module catalog), Open-source starting points, What is inside each vendored clone, Three sessions, one folder.
Changed: modules/system/docs/view.js

Finding 2: wide code boxes and tables scrolled sideways with no hint; the card title repeated the document heading.
Options offered: A) fade on the right edge while there is more + drop the duplicate title  B) drop the title only  C) Leave as is
Owner chose: A. Table cells also got a 14-character minimum so the catalog scrolls instead of wrapping into very tall rows.
Changed: modules/system/docs/view.js, core/ui/base.css (.scroll-hint, .doc td)

Finding 3: a long document ended with nothing.
Options offered: A) "Back to top" + the picker again at the end  B) "Back to top" only  C) Leave as is
Owner chose: A
Changed: modules/system/docs/view.js, core/ui/base.css (.doc-foot)

## 2026-09-15  Settings, round 6 (phone)
Finding 1: 154 page checkboxes with "default" pills in wrapping tiles, eight screens long.
Options offered: A) one fold per topic ("8 of 8 on"), pills only when a page was switched  B) one page per line, no pills  C) Leave as is
Owner chose: A
Changed: modules/system/settings/view.js, core/ui/base.css (.fold, .folds, .toggle-row)

Finding 2: PC server and AI setup came first; Plan basics last.
Options offered: A) Plan basics, Pages, Your data, then "PC connection" and "AI assistant" folded with a one-line status  B) move Plan basics up only  C) Leave as is
Owner chose: A
Changed: modules/system/settings/view.js, core/ui/base.css (.fold-card)

Finding 3: developer wording (FROM the server, planner.properties, auth.token, Active source, Schema v1, netWorthHistory, Export plan (JSON), Reset this device's copy).
Options offered: A) plain rewrite (preview in the round)  B) three button names only  C) Leave as is
Owner chose: A. New names: PC connection / PC address / "blank = where this page came from" / "only if you set one up on the PC" / Test the connection; AI assistant / "Ollama on the PC" / "Another service (OpenAI-compatible)" / Show available models; Your data / Download a copy / Restore from a copy / Erase the copy on this device; section counts in plain names ("net-worth snapshots", "income sources").
Changed: modules/system/settings/view.js

Finding 4: saves showed bare grey text or nothing (Plan basics); errors looked like successes.
Options offered: A) green "Saved." notices everywhere, red errors that say what to do  B) Plan basics only  C) Leave as is
Owner chose: A. Because the shell re-renders after every store.update, a confirmation is kept in a module-level `pending` and shown by the next render (rule below).
Changed: modules/system/settings/view.js, core/ui/base.css (.out:empty)
Rule: every save/add/remove confirms with a green notice; errors are red and say what to do next.

## 2026-09-15  Tester items, round 5 (F-005, F-006, F-008)
F-005: menu links (40 px), the "Hide coming soon" toggle (36 px) and small row buttons (34 px) were under the 44 px rule.
Options offered: A) all three to 44 px  B) links and toggle only  C) Leave as is
Owner chose: A. The All-pages filter chips and phase dropdown (36 px) fall under the same rule and were raised too; `qa.smallTargets(44)` is now 0 on All pages with the drawer open and on Net worth.
Changed: core/ui/base.css (.nav-link, .nav-soon-toggle, button.small, .chip), modules/overview/pages/view.js (select height)

F-006: on All pages only the title word opened a page.
Options offered: A) whole row is the link  B) chevron, title-only link  C) Leave as is
Owner chose: A
Changed: modules/overview/pages/view.js, core/ui/base.css (.page-list .row-link)

F-008: an overdrawn asset showed as a positive amount in the accounts list.
Options offered: A) "-$500" in red like a loan  B) sign only  C) Leave as is
Owner chose: A (uses compute's countedBalance so the row and the totals agree)
Changed: modules/balance/net-worth/view.js

## 2026-09-15  Net worth, round 4 (phone; tester F-002 and F-004)
Finding 1 (F-002): the Accounts table was cut off on a phone; balance and Edit/Delete were off the right edge.
Options offered: A) stacked record per account under 720 px, table on desktop  B) keep the table with a swipe hint  C) Leave as is
Owner chose: A
Changed: modules/balance/net-worth/view.js, core/ui/base.css (.records, .only-wide / .only-narrow)
Rule: tables become stacked records on a phone (see AGENTS.md "Design rules").

Finding 2 (F-004): a huge figure split mid-digit across two lines in a stat tile.
Options offered: A) long figures step down a size and wrap only after a comma  B) wrap at commas only  C) Leave as is
Owner chose: A
Changed: core/ui/dom.js (stat), core/ui/base.css (.stat-value.long / .xlong)

Finding 3: the six-field add form stayed open under the list on every visit.
Options offered: A) fold it behind "+ Add another account" once accounts exist  B) move it below Over time  C) Leave as is
Owner chose: A (first visit with no accounts keeps the form open; Edit opens it filled in; Cancel folds it)
Changed: modules/balance/net-worth/view.js

Finding 4: "Invested for later" read "$0 pre-tax, $0 tax-free, $0 taxable" at zero.
Options offered: A) plain words at zero, $0 parts hidden otherwise  B) hide the tile until something is invested  C) Leave as is
Owner chose: A
Changed: modules/balance/net-worth/view.js (investedLine)

## 2026-09-15  All pages, round 3 (phone)
Finding 1: page descriptions were cut off after two lines with an ellipsis.
Options offered: A) full sentence  B) three lines  C) Leave as is
Owner chose: A
Changed: core/ui/base.css (.page-list .d no longer clamped; rows align to the top)

Finding 2: the count line said "4 pages across 18 topics" while searching; no result said "No pages match."
Options offered: A) "4 pages match "roth"" and a friendlier no-result card with example words  B) hide the line while searching  C) Leave as is
Owner chose: A (the count line is blank when nothing matches, so the card is the only message)
Changed: modules/overview/pages/view.js

Finding 3: planned pages carried a pill that only said "phase 9".
Options offered: A) "soon · phase 9"  B) "coming soon"  C) Leave as is
Owner chose: A
Changed: modules/overview/pages/view.js

Finding 4: every row repeated the topic's icon.
Options offered: A) icon only when the page has its own  B) smaller icons always  C) Leave as is
Owner chose: A. Rows with an own icon are indented a little more than the rest; if that ragged edge bothers the owner, option B is the fallback.
Changed: modules/overview/pages/view.js

Noted for a later wording round: some purposes still carry builder words ("r/personalfinance flowchart", an advisor's product name); purposes are in the designer's lane.

## 2026-09-15  Menu drawer, round 2 (phone)
Finding 1: searching "tax" listed topics that only mention tax in a description before the Taxes topic; a word with no match showed an empty drawer.
Options offered: A) rank page-name hits, then topic-name hits, then description hits + a "No page matches" line with a link to All pages  B) message only  C) Leave as is
Owner chose: A (ties break on topic-name match, then number of hits)
Changed: core/app.js (buildNav), core/ui/base.css (.nav-empty)

Finding 2: the "Show pages that are coming soon" checkbox sat below all 18 topics.
Options offered: A) small "Hide/Show coming soon" button on the topics header  B) checkbox above the search box  C) Leave as is
Owner chose: A. The header was shortened from "Everything, by topic" to "By topic" so both fit in the 272 px drawer; the "N of M pages ready" line stays at the bottom.
Changed: core/app.js, core/ui/base.css (.nav-section-row, .nav-soon-toggle)

Finding 3: topic rows said "2 ready" or "7 soon", hiding the size of the topic.
Options offered: A) "2 of 8 ready" when any page is ready, "7 soon" otherwise  B) ready counts only  C) Leave as is
Owner chose: A (search results keep the short "N ready"/"N soon" of the matches)
Changed: core/app.js

Finding 4: nothing visible said how to close the open drawer.
Options offered: A) the menu button turns into a cross while open  B) a Close row inside the drawer  C) Leave as is
Owner chose: A
Changed: core/app.js (setToggleIcon)

## 2026-09-15  Dashboard, round 1 (phone)
Finding 1: pages that fail to load showed a red box of developer messages with web addresses running off the phone's edge, above the plan.
Options offered: A) plain sentence + "Show details" expander  B) plain sentence only, details in console  C) Leave as is
Owner chose: A
Changed: core/app.js (broken-page notice), core/ui/base.css (.notice-details)

Finding 2: the welcome card led with a 4 % progress bar and "6 of 146 pages ready", software progress before money.
Options offered: A) hero says "Start by adding your accounts. It takes about five minutes."; bar + count move to "What is coming"  B) keep bar, drop the count  C) Leave as is
Owner chose: A
Changed: modules/overview/dashboard/view.js

Finding 3: "What is coming" is ten build phases with builder words, more than half the phone screen.
Options offered: A) collapse to current + next phase with "Show all"  B) one line + link  C) Leave as is
Owner chose: C, "leave as is for now, once built it won't exist". Do not re-propose.

Finding 4: the six setup steps read as plain text and the page had no filled button.
Options offered: A) chevron on every step row + one filled button "Do step N: ..." under the list  B) chevrons only  C) make the first Start-here card filled  D) Leave as is
Owner chose: A
Changed: modules/overview/dashboard/view.js (whole row is the link; short button labels kept in the view), core/ui/base.css (.steps .chev, .step-link, .steps-cta)

## 2026-09-15  Baseline before the review loop
The owner printed the first dashboard (a wall of 153 links, "$0" tiles, a status pill that
overflowed the phone screen) and asked for a layperson's design. The redesign that followed
is described in `docs/PLAN.md` section 13 and `CHANGELOG.md`. Principles the owner has
already confirmed by that review: plain words on screen, see the real page before calling
it done, fewer things per screen, phone first.

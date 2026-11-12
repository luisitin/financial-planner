# A-LANE: claude-a's pages (hand over, do not edit)

9 verified findings (each reproduced on screen by an independent skeptic). Scripts and pictures for a finding `<walker>/<id>` are in `$SP/ux/<walker>/` and `$SP/ux/<walker>/verify/`.

## p-taxes/T4 (severity 4, smooth, scope page, owner claude-a, confirmed)
**Ticking a tax paper moves the whole list 65 px down under the thumb, so the next tick lands on the row above and unticks it**

- pages: taxes/documents, taxes/estimated
- reach: taxes/documents (wrong row ticked); the same insert-above notice moves 'Save payments' 76 px down after a save on taxes/estimated (mild). Settings' page switches do not move (0 px).
- steps: family, taxes/documents, scroll down 300 px so the list is on screen. Tap 'W-2 · Ana's salary'. Between 0.7 and 1.5 s later tap 'W-2 · Bo's salary' at the place it was on the screen.
- saw: After the first tap every row sits 65 px lower (Ana's row 382 to 447, Bo's 465 to 529; a row is 82 px tall) because a green notice was put in at the very top of the page, off screen. The second tap lands on Ana's row: Ana's W-2 is unticked ('W-2 marked as still to come.') and Bo's is never ticked: 0 of 9 received. Both messages say only 'W-2'. Four seconds later the notice is taken out and every row jumps 65 px back up. Same with the page at the top (682 to 747 and back). Reproduced with 700 ms and 1,500 ms between the taps.
- should: A tick changes only its own row (struck through, '1 of 9'); nothing above the thumb is put in or taken out; the confirmation shows at the bottom of the screen and names the paper: 'W-2 · Ana's salary ticked as received.'
- why: Someone ticking the papers that came in the post goes down the list one after another. Every second tap hits the wrong row, and the message cannot tell them which W-2 it meant.
- cause: modules/taxes/documents/view.js:25 appends the pending notice as the first block of the page and removes it after 4 s; the shell's redraw keeps scrollY (core/app.js:205, 218), not the thing under the thumb, so everything below the insert moves by its height.
- fix: Page fix: in modules/taxes/documents/view.js move the `if (pending) ...` line from line 25 to the end of render() (after the last card), so nothing above the list changes; the shell's bottom echo (core/app.js:261-264) then shows it whenever it is off screen. Build the words from `${x.form}${x.from ? ` · ${x.from}` : ""}` (lines 48 and 56). Same move for taxes/estimated (view.js:60) if wanted.
- evidence: p-taxes/verify/t4b-shifted.png (rows 65 px lower after one tick), p-taxes/verify/t4b-after.png (0 of 9, 'W-2 marked as still to come.'); scripts p-taxes/verify/t4.mjs, t4b.mjs

## j-navigator/N6 (severity 3, navigate, scope page, owner claude-a (goals/emergency-fund); balance/liquidity is claude-b, confirmed)
**Two different pages are both called 'Emergency fund'**

- pages: balance/liquidity, goals/emergency-fund
- reach: menu, search, All pages, and the title of both pages. Narrowed: 'Budget' and 'Budget (50/30/20)' have different names and are not a problem.
- steps: H.family(), Menu, search 'rainy day'.
- saw: Two results, both 'Emergency fund', one under Assets and debts and one under Goals. It is the only title used twice among the 150 pages. Both pages carry the title 'Emergency fund' and both open with the same cash figure and target ($4,200 / 0.9 months, $28,610), so nothing tells them apart once you are on one.
- should: Different plain names, for example 'Emergency fund' (how many months your cash covers; the one the Dashboard opens) and 'Emergency fund goal' or 'How big should it be?' for the goals page.
- why: The person cannot tell which one they opened last time or whether the two are the same thing.
- cause: modules/balance/liquidity/module.js line 7 and modules/goals/emergency-fund/module.js line 7: both `title: "Emergency fund"`.
- fix: Rename the goals page in its module.js and its row in docs/MODULE_CATALOG.md; keep 'Emergency fund' on balance/liquidity, which the Dashboard row and the design log entries of 2026-09-15 and 2026-09-16 use. No design-log decision is touched.
- evidence: $SP/ux/j-navigator/verify/n6-rainy-day.png, $SP/ux/j-navigator/verify/n6-goals-emergency-fund.png; script v5.mjs

## p-cashflow-b-goals/F7 (severity 3, input, scope page, owner claude-a, confirmed)
**Travel: choosing the kind after typing wipes the name and date**

- pages: goals/travel
- reach: goals/travel add and change forms
- steps: Empty household. Open goals/travel. Type What 'Beach trip', When 7/1/2027, Nights 10, Flights 120. Tap 'Something else'. Second run (family): 'Our wedding day', 6/17/2028, then tap 'A wedding'. Third: Change a saved event, retype its name, tap another kind.
- saw: Every time the form redrew empty: What and When blank, no notice (layout shift up to 0.09). Tapping back to 'A trip' did not bring the values back. While editing, the retyped name reverted to the saved one. Not confirmed: the walker's 'three filled chips'. Only the chosen chip is filled (class 'chip on'); the other two are white. The kit counts any button with a background as filled.
- should: Changing the kind keeps everything the two kinds share (name, date, other costs) and drops only the boxes that no longer exist.
- why: The kind chips sit above the boxes and look like a harmless choice. A person who names the event first and then picks its kind loses what they typed, with no sign that it happened.
- cause: modules/goals/travel/view.js:76 (the chip's onClick calls drawForm(true)) and :78 (values start again from editing or { people: 2, nights: 7 }, never from what is in the boxes).
- fix: In the chip's onClick read the live form first (new FormData(formHost.querySelector('form'))) into a module-level draft and merge it into values on the redraw; clear the draft on submit and cancel.
- evidence: $SP/ux/p-cashflow-b-goals/verify/f7-1-typed.png, $SP/ux/p-cashflow-b-goals/verify/f7-2-after-switch.png, $SP/ux/p-cashflow-b-goals/verify/f7b-after-wedding.png

## p-cashflow-b-goals/F8 (severity 3, navigate, scope page, owner claude-a, confirmed)
**'What it costs: Travel' opens a blank form that does not know the Japan trip**

- pages: goals/travel, goals/goals
- reach: goals/travel reached from any goal the Goals page links to it
- steps: Family household. Open goals/goals. On the Japan trip row ($1,200 of $8,000, by 10/1/2027) tap 'What it costs: Travel'. Compare with the same link on the other three rows.
- saw: Travel opens exactly as for a new person: hero 'Trips and big days' and an empty 'Plan a trip or a big day' form; the page text never contains 'Japan' or 8,000. The other three planner links do know their goal: Vehicle opens on '$26,720 car, by 3/1/2029 ... ("Replace Bo's car")', Emergency fund names the goal in its first line, Education shows 'Cy: college from 2038'.
- should: Travel greets the goal: 'Japan trip is a goal of $8,000 by 10/1/2027. Price its parts to check that figure.' with the form's name and date filled in, and saving ties the two together.
- why: The link promised what this goal costs. The person lands on a form asking them to type the trip again, and may add a second one beside the goal they already have.
- cause: modules/goals/goals/compute.js:107 sends any goal with the plane icon or 'trip' in its name to goals/travel, but modules/goals/travel/compute.js:44-51 only knows goals an event already points to (e.goalId); view.js:43 shows the first-time hero whenever there are no events.
- fix: travel/compute.js: also return goals that plannerFor() sends here and no event points to; view.js: one card per such goal with an outlined 'Price Japan trip' that opens the form with name and date filled and sets goalId on save.
- evidence: $SP/ux/p-cashflow-b-goals/verify/f8-What_it_costs_Travel.png, $SP/ux/p-cashflow-b-goals/verify/f8-What_it_costs_Vehicle.png

## p-balance/B6 (severity 2, next, scope several-pages, owner claude-a, confirmed)
**Seven pages still end with their own card headed 'Next' above the one 'Continue your plan' row**

- pages: balance/projection, taxes/state, taxes/documents, debt/student-loans, goals/charitable, goals/vehicle, goals/travel
- reach: the 7 pages that still call ui.card("Next", ...); 37 pages already say 'More on this'
- steps: H.family(), balance/projection. Scroll to the bottom.
- saw: A card headed 'Next' with two outlined buttons (Net worth today, Retirement), then the row 'Continue your plan: step 2 of 8 ›': three ways on, and the word Next is on the two that are not the path. Net worth, Account detail, Asset register, Balance sheet and Update my balances end with the one Continue row. The empty pages the walker listed (Update, Projection, Emergency fund) show one filled button, one outlined and the 'Start your plan' row; that follows the design rule for empty pages and is not counted here.
- should: What the design log of 2026-11-06 already says is waiting: the page's own card is headed 'More on this', which leaves the Continue row as the one way on.
- why: Seen on screen for projection; the other six are the same line of code on claude-a pages.
- cause: modules/balance/projection/view.js:86 ui.card("Next", ...); the same line in the six other files.
- fix: Rename the heading to 'More on this' in those 7 files (the log's own pending item; no new decision).
- evidence: $SP/ux/p-balance/verify/b6-family-projection-bottom.png, $SP/ux/p-balance/verify/b6-empty-projection-bottom.png, $SP/ux/p-balance/verify/v-b6.mjs

## p-balance/x-3 (severity 2, next, scope page, owner claude-a, confirmed)
**Balance sheet, first open: the filled button 'Accounts' leads to another empty page that sends you on again**

- pages: balance/statement
- reach: None
- steps: H.empty(), balance/statement. Tap the filled 'Accounts', then the filled 'Add an account'.
- saw: 'Add your accounts, home, cars and debts first.' with a button that only says 'Accounts'. It opens Account detail, itself empty ('Your accounts, one at a time. Once you add an account...'), whose filled 'Add an account' opens Net worth's form. Two taps and two page titles to reach the one place accounts are added.
- should: One filled button 'Add your accounts' that opens Net worth's add form.
- why: Missed by the walker. Reproduced in a fresh browser.
- cause: modules/balance/statement/view.js:17: href '#/balance/accounts', label 'Accounts'.
- fix: ui.h("a", { class: "btn", href: "#/balance/net-worth" }, "Add your accounts").
- evidence: $SP/ux/p-balance/verify/m1-statement-empty.png, $SP/ux/p-balance/verify/x3-statement-hop.png, $SP/ux/p-balance/verify/v-miss2.mjs

## p-cashflow-b-goals/F10 (severity 2, understand, scope several-pages, owner claude-a (travel); claude-b (education), confirmed)
**Two labels a layperson would not follow: 'Sinking funds' and "(for 'a cost I enter')"**

- pages: goals/travel, goals/education
- reach: those two pages
- steps: Family household. goals/travel: last card, tap 'Sinking funds'. goals/education: open 'Type of college and share to cover'.
- saw: 'Sinking funds' lands on a page titled 'Irregular expenses' (the menu also says Irregular expenses); no other page in this group says 'sinking'. Education has a money box labelled "A year's cost today (for 'a cost I enter')", shown whatever kind of college is chosen. The two 'Save' buttons are each at the end of their own fold; I do not count that as a problem. The card heading 'Next' on Travel, Vehicle and Giving is already logged as waiting to be renamed 'More on this' (design log 2026-11-06), so it is left out.
- should: Link text 'Irregular expenses'. Box label 'Cost of one year today', shown only when 'a cost I enter' is chosen.
- why: A link should carry the name of the page it opens. The Education box reads like a note to the builder.
- cause: modules/goals/travel/view.js:100 (link text); modules/goals/education/view.js:98 (label).
- fix: Two string changes; hide the yearly box unless kind is the entered-cost option.
- evidence: $SP/ux/p-cashflow-b-goals/verify/f7-0-arrive.png, $SP/ux/p-cashflow-b-goals/verify/f10-edu-open.png

## p-cashflow-b-goals/x-1 (severity 2, understand, scope page, owner claude-a, confirmed)
**The word 'null' is printed under the Add button on Travel**

- pages: goals/travel
- reach: goals/travel, every visit
- steps: Any household (empty, family, ruth, renterDebt). Open goals/travel and look under the 'Add' button.
- saw: The text 'null' on its own line under the filled 'Add' button, on first arrival, after every kind change and whenever '+ Plan another' is open (not while an event is being changed).
- should: Nothing under the button unless an event is being changed (then 'Remove ...').
- why: A stray program word right under the page's main button looks broken, and may be read as the result of tapping Add.
- cause: modules/goals/travel/view.js:79-96: formHost.append(h2, picker, form, editing ? removeButton : null). The browser's own append() turns null into the text 'null' (ui.h skips nulls, element.append does not).
- fix: Pass the last argument only when editing: formHost.append(h2, picker, form, ...(editing ? [removeP] : [])).
- evidence: $SP/ux/p-cashflow-b-goals/verify/f7-0-arrive.png, $SP/ux/p-cashflow-b-goals/verify/f7-2-after-switch.png

## p-debt-property/DP-6 (severity 2, understand, scope page, owner claude-a (debt/consolidation), confirmed)
**Consolidation says 'None of your debts is at 10% or more' after you untick every debt**

- pages: debt/consolidation
- reach: Only this page, and only after unticking all the debts and tapping 'Use these'.
- steps: H.renterDebt(), debt/consolidation, open 'Which debts', untick the three ticked cards, tap 'Use these'.
- saw: The page becomes the empty hero with 'None of your debts is at 10% or more; choose any below to compare anyway.' while the cards are at 24%, 27% and 29%. The one filled button is 'Debts' and opens Pay off debts; 'Which debts 0 of 4' sits closed under it. Reproduced twice.
- should: 'You have not chosen any debt. Tick the ones to compare.' with the 'Which debts' list open and no button that leaves the page.
- why: The sentence is false and the filled button leads away from the fix. Lowered from 3: few people untick everything, and the line does say 'choose any below'.
- cause: modules/debt/consolidation/view.js:33 uses one sentence for 'no debt over the threshold' and 'none chosen' (it only tests d.candidates.length); line 34 always shows the 'Debts' link; chooser() is always drawn closed (line 64).
- fix: When Array.isArray(s.include) && s.include.length === 0: the sentence above, chooser drawn with open, and no 'Debts' button.
- evidence: $SP/ux/p-debt-property/verify/v7_cons_none.png


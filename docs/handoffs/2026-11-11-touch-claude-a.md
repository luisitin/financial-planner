# Touch and input stress test: what is on claude-a's pages (claude-b -> claude-a, 2026-11-11)

The owner asked on 2026-11-11: "Be extensive and use tons of agents to stress test every single touch and input for
usability, ease, smoothness, choreography, user experience, easy to understand and navigate. Focusing on easy to know next
step, to go back, to navigate and to focus correctly while understanding. Quality over quantity."

26 testers walked the app at phone size (390 x 844, touch, the sandbox) and an independent skeptic reproduced every finding on
screen before it counted: 278 are confirmed. 37 of them touch your 13 folders. Your files
have not changed since the test ran (commit 1dd3773), so every file and line below still holds until you edit them.

Severity: 5 = a person loses data or is told something false; 4 = blocked, misled or loses their place; 3 = slowed or
confused; 2 = rough.

## How to work through it

- Part 1 is yours alone: the cause is in your files and nobody else will touch them.
- Part 2 lists findings where your page is one of several with the same page-level cause. Other builders fix their own
  pages the same way (claude-d, claude-e and claude-f are working page batches now; see docs/WORKBOARD.md); the fix for
  yours is the same idea.
- Part 3 is caused in the shared shell or form kit. claude-b is fixing those once for every page (wave 1:
  `core/app.js`, `core/router.js`, `core/search.js`, `index.html`, `core/ui/dom.js`, `core/ui/base.css`,
  `modules/overview/guide/frame.js`), so your pages get the fix with no edit. Do not build a page-level workaround for
  these; when wave 1 lands, the kit will have helpers (errors said at the box, an Undo notice, an edit form that opens at
  its row, a way to bring a fresh answer into view) and a short adoption note in docs/CONVENTIONS.md.
- Each item: what to do to see it, what was seen, what should happen, the cause with file and line, and a proposed fix.
  Reproduce before you fix; a proposed fix is a suggestion, not a decision.

## Part 1: yours alone

Two quick ones first (a few minutes each): the stray word `null` under Travel's Add button, and the seven pages that still
end with a card headed "Next" (docs/DESIGN_LOG.md 2026-11-06 already records the rename to "More on this" as pending).
The two pages called "Emergency fund" are the same item as the title change in docs/handoffs/2026-11-07-wording-claude-a.md.

### Ticking a tax paper moves the whole list 65 px down under the thumb, so the next tick lands on the row above and unticks it
`p-taxes/T4`, severity 4; your pages: taxes/documents; all pages: taxes/documents, taxes/estimated

- **To see it:** family, taxes/documents, scroll down 300 px so the list is on screen. Tap 'W-2 · Ana's salary'. Between 0.7 and 1.5 s later tap 'W-2 · Bo's salary' at the place it was on the screen.
- **Seen:** After the first tap every row sits 65 px lower (Ana's row 382 to 447, Bo's 465 to 529; a row is 82 px tall) because a green notice was put in at the very top of the page, off screen. The second tap lands on Ana's row: Ana's W-2 is unticked ('W-2 marked as still to come.') and Bo's is never ticked: 0 of 9 received. Both messages say only 'W-2'. Four seconds later the notice is taken out and every row jumps 65 px back up. Same with the page at the top (682 to 747 and back). Reproduced with 700 ms and 1,500 ms between the taps.
- **Should:** A tick changes only its own row (struck through, '1 of 9'); nothing above the thumb is put in or taken out; the confirmation shows at the bottom of the screen and names the paper: 'W-2 · Ana's salary ticked as received.'
- **Cause:** modules/taxes/documents/view.js:25 appends the pending notice as the first block of the page and removes it after 4 s; the shell's redraw keeps scrollY (core/app.js:205, 218), not the thing under the thumb, so everything below the insert moves by its height.
- **Fix:** Page fix: in modules/taxes/documents/view.js move the `if (pending) ...` line from line 25 to the end of render() (after the last card), so nothing above the list changes; the shell's bottom echo (core/app.js:261-264) then shows it whenever it is off screen. Build the words from `${x.form}${x.from ? ` · ${x.from}` : ""}` (lines 48 and 56). Same move for taxes/estimated (view.js:60) if wanted.

### Two different pages are both called 'Emergency fund'
`j-navigator/N6`, severity 3; your pages: goals/emergency-fund; all pages: balance/liquidity, goals/emergency-fund

- **To see it:** H.family(), Menu, search 'rainy day'.
- **Seen:** Two results, both 'Emergency fund', one under Assets and debts and one under Goals. It is the only title used twice among the 150 pages. Both pages carry the title 'Emergency fund' and both open with the same cash figure and target ($4,200 / 0.9 months, $28,610), so nothing tells them apart once you are on one.
- **Should:** Different plain names, for example 'Emergency fund' (how many months your cash covers; the one the Dashboard opens) and 'Emergency fund goal' or 'How big should it be?' for the goals page.
- **Cause:** modules/balance/liquidity/module.js line 7 and modules/goals/emergency-fund/module.js line 7: both `title: "Emergency fund"`.
- **Fix:** Rename the goals page in its module.js and its row in docs/MODULE_CATALOG.md; keep 'Emergency fund' on balance/liquidity, which the Dashboard row and the design log entries of 2026-09-15 and 2026-09-16 use. No design-log decision is touched.

### Travel: choosing the kind after typing wipes the name and date
`p-cashflow-b-goals/F7`, severity 3; your pages: goals/travel

- **To see it:** Empty household. Open goals/travel. Type What 'Beach trip', When 7/1/2027, Nights 10, Flights 120. Tap 'Something else'. Second run (family): 'Our wedding day', 6/17/2028, then tap 'A wedding'. Third: Change a saved event, retype its name, tap another kind.
- **Seen:** Every time the form redrew empty: What and When blank, no notice (layout shift up to 0.09). Tapping back to 'A trip' did not bring the values back. While editing, the retyped name reverted to the saved one. Not confirmed: the walker's 'three filled chips'. Only the chosen chip is filled (class 'chip on'); the other two are white. The kit counts any button with a background as filled.
- **Should:** Changing the kind keeps everything the two kinds share (name, date, other costs) and drops only the boxes that no longer exist.
- **Cause:** modules/goals/travel/view.js:76 (the chip's onClick calls drawForm(true)) and :78 (values start again from editing or { people: 2, nights: 7 }, never from what is in the boxes).
- **Fix:** In the chip's onClick read the live form first (new FormData(formHost.querySelector('form'))) into a module-level draft and merge it into values on the redraw; clear the draft on submit and cancel.

### 'What it costs: Travel' opens a blank form that does not know the Japan trip
`p-cashflow-b-goals/F8`, severity 3; your pages: goals/travel; all pages: goals/travel, goals/goals

- **To see it:** Family household. Open goals/goals. On the Japan trip row ($1,200 of $8,000, by 10/1/2027) tap 'What it costs: Travel'. Compare with the same link on the other three rows.
- **Seen:** Travel opens exactly as for a new person: hero 'Trips and big days' and an empty 'Plan a trip or a big day' form; the page text never contains 'Japan' or 8,000. The other three planner links do know their goal: Vehicle opens on '$26,720 car, by 3/1/2029 ... ("Replace Bo's car")', Emergency fund names the goal in its first line, Education shows 'Cy: college from 2038'.
- **Should:** Travel greets the goal: 'Japan trip is a goal of $8,000 by 10/1/2027. Price its parts to check that figure.' with the form's name and date filled in, and saving ties the two together.
- **Cause:** modules/goals/goals/compute.js:107 sends any goal with the plane icon or 'trip' in its name to goals/travel, but modules/goals/travel/compute.js:44-51 only knows goals an event already points to (e.goalId); view.js:43 shows the first-time hero whenever there are no events.
- **Fix:** travel/compute.js: also return goals that plannerFor() sends here and no event points to; view.js: one card per such goal with an outlined 'Price Japan trip' that opens the form with name and date filled and sets goalId on save.

### Seven pages still end with their own card headed 'Next' above the one 'Continue your plan' row
`p-balance/B6`, severity 2; your pages: goals/vehicle, goals/travel, goals/charitable, debt/student-loans, taxes/state, taxes/documents, balance/projection

- **To see it:** H.family(), balance/projection. Scroll to the bottom.
- **Seen:** A card headed 'Next' with two outlined buttons (Net worth today, Retirement), then the row 'Continue your plan: step 2 of 8 ›': three ways on, and the word Next is on the two that are not the path. Net worth, Account detail, Asset register, Balance sheet and Update my balances end with the one Continue row. The empty pages the walker listed (Update, Projection, Emergency fund) show one filled button, one outlined and the 'Start your plan' row; that follows the design rule for empty pages and is not counted here.
- **Should:** What the design log of 2026-11-06 already says is waiting: the page's own card is headed 'More on this', which leaves the Continue row as the one way on.
- **Cause:** modules/balance/projection/view.js:86 ui.card("Next", ...); the same line in the six other files.
- **Fix:** Rename the heading to 'More on this' in those 7 files (the log's own pending item; no new decision).

### Balance sheet, first open: the filled button 'Accounts' leads to another empty page that sends you on again
`p-balance/x-3`, severity 2; your pages: balance/statement

- **To see it:** H.empty(), balance/statement. Tap the filled 'Accounts', then the filled 'Add an account'.
- **Seen:** 'Add your accounts, home, cars and debts first.' with a button that only says 'Accounts'. It opens Account detail, itself empty ('Your accounts, one at a time. Once you add an account...'), whose filled 'Add an account' opens Net worth's form. Two taps and two page titles to reach the one place accounts are added.
- **Should:** One filled button 'Add your accounts' that opens Net worth's add form.
- **Cause:** modules/balance/statement/view.js:17: href '#/balance/accounts', label 'Accounts'.
- **Fix:** ui.h("a", { class: "btn", href: "#/balance/net-worth" }, "Add your accounts").

### Two labels a layperson would not follow: 'Sinking funds' and "(for 'a cost I enter')"
`p-cashflow-b-goals/F10`, severity 2; your pages: goals/travel; all pages: goals/travel, goals/education

- **To see it:** Family household. goals/travel: last card, tap 'Sinking funds'. goals/education: open 'Type of college and share to cover'.
- **Seen:** 'Sinking funds' lands on a page titled 'Irregular expenses' (the menu also says Irregular expenses); no other page in this group says 'sinking'. Education has a money box labelled "A year's cost today (for 'a cost I enter')", shown whatever kind of college is chosen. The two 'Save' buttons are each at the end of their own fold; I do not count that as a problem. The card heading 'Next' on Travel, Vehicle and Giving is already logged as waiting to be renamed 'More on this' (design log 2026-11-06), so it is left out.
- **Should:** Link text 'Irregular expenses'. Box label 'Cost of one year today', shown only when 'a cost I enter' is chosen.
- **Cause:** modules/goals/travel/view.js:100 (link text); modules/goals/education/view.js:98 (label).
- **Fix:** Two string changes; hide the yearly box unless kind is the entered-cost option.

### The word 'null' is printed under the Add button on Travel
`p-cashflow-b-goals/x-1`, severity 2; your pages: goals/travel

- **To see it:** Any household (empty, family, ruth, renterDebt). Open goals/travel and look under the 'Add' button.
- **Seen:** The text 'null' on its own line under the filled 'Add' button, on first arrival, after every kind change and whenever '+ Plan another' is open (not while an event is being changed).
- **Should:** Nothing under the button unless an event is being changed (then 'Remove ...').
- **Cause:** modules/goals/travel/view.js:79-96: formHost.append(h2, picker, form, editing ? removeButton : null). The browser's own append() turns null into the text 'null' (ui.h skips nulls, element.append does not).
- **Fix:** Pass the last argument only when editing: formHost.append(h2, picker, form, ...(editing ? [removeP] : [])).

### Consolidation says 'None of your debts is at 10% or more' after you untick every debt
`p-debt-property/DP-6`, severity 2; your pages: debt/consolidation

- **To see it:** H.renterDebt(), debt/consolidation, open 'Which debts', untick the three ticked cards, tap 'Use these'.
- **Seen:** The page becomes the empty hero with 'None of your debts is at 10% or more; choose any below to compare anyway.' while the cards are at 24%, 27% and 29%. The one filled button is 'Debts' and opens Pay off debts; 'Which debts 0 of 4' sits closed under it. Reproduced twice.
- **Should:** 'You have not chosen any debt. Tick the ones to compare.' with the 'Which debts' list open and no button that leaves the page.
- **Cause:** modules/debt/consolidation/view.js:33 uses one sentence for 'no debt over the threshold' and 'none chosen' (it only tests d.candidates.length); line 34 always shows the 'Debts' link; chooser() is always drawn closed (line 64).
- **Fix:** When Array.isArray(s.include) && s.include.length === 0: the sentence above, chooser drawn with open, and no 'Debts' button.

## Part 2: same page-level cause on several pages, yours among them

Where a proposed fix below names a new helper in `core/ui/dom.js` or a change in `core/app.js` (errors said at the box,
an answer brought into view after a save, an Undo after a removal), that part is wave 1's: wait for it and use its
helper instead of adding one. The page-only part of each fix (a link that opens the right form, a wrong sentence, a
question before a removal) is yours whenever you like.

### After Compare, Save or Add the page gets shorter and the screen lands at the bottom, with the new answer off screen above
`p-debt-property/DP-1`, severity 4; your pages: debt/consolidation; all pages: property/rent-vs-buy, property/renovation, property/home, property/rental, property/vehicles

- **To see it:** H.family(), open property/rent-vs-buy at 390x844. The 'The figures' form is already open. Type 450000 in 'Home price', scroll down to Compare, tap it. Same shape: property/renovation, type 45,000 in 'What it will cost', Compare; property/home, type 310,000 in 'What you paid' and 2019 in 'Year you bought it', Save; H.empty() property/rental, Name Flat, worth 250,000, rent 1,800, Add rental.
- **Seen:** Rent vs buy: the fold closes, the page goes from 3238 to 1492 px, scrollY 2394 to 648; the 'After 10 years' heading is at -358 px and the verdict tiles higher still. The screen shows the tail of a chart, 'The first year, a month', 'More on this' and a floating 'Saved.'. Renovation: scrollY 1427 to 893, 'Ways to pay' at -464 px. Your home: 1868 to 974 (page 2712 to 1818). Rental add: 1409 to 1200, the new rental's heading at -825 px. Vehicles, second car: 1713 to 1213, the new car at -523 px. Focus drops to the page body each time. Reproduced twice per page with taps by coordinates (no Playwright auto-scroll at the tap). A second Compare six seconds later still confirms, so that part is fine.
- **Should:** After the redraw the green 'Saved.' and the top of the answer sit just under the top bar. After an add, the new item's heading does.
- **Cause:** The views draw the form fold open only until the first save (modules/property/renovation/view.js:55 `open: s.cost ? null : true`, rent-vs-buy/view.js:81 `open: saved ? null : true`, home/view.js:139, the add folds at rental/view.js:190 and vehicles/view.js:108), so the redraw is 500 to 1,750 px shorter. core/app.js show() puts back the old pixel position (lines 205 and 218) and the browser clamps it to the new bottom. The page's own 'Saved.' is at the top of the page, so the shell shows its floating copy (lines 258-261) instead of taking the person there.
- **Fix:** One change in core/app.js show(): after a keepScroll redraw, when the scroll was clamped (window.scrollY < keepY - 2) and this save's fresh notice is out of view, scroll that notice to just under the top bar instead of echoing it. These pages put the notice at the top, right above the answer. On Rental and Vehicles the new card can sit below older ones, so the view marks it and scrolls it into view. This keeps the logged choice that add forms fold away once there is data (2026-09-15, Net worth round 4).

### The one button on an empty debt or home page lands on a page that does not show the form it promised
`p-debt-property/DP-3`, severity 4; your pages: debt/student-loans, debt/consolidation; all pages: debt/mortgage, debt/refinance, debt/credit-cards, debt/student-loans, property/home

- **To see it:** H.sam() (a renter with four accounts), open debt/mortgage, tap the filled 'Add the mortgage'. Then H.sam(), property/home, tap the filled 'Accounts'. Then H.empty(), debt/mortgage, 'Add the mortgage', add 'Home loan' as Mortgage with 265,000.
- **Seen:** Sam, Mortgage: lands on Net worth at scroll 0 showing four tiles and the account list; no form on screen, '+ Add another account' is at y=951, below the 844 px screen. Sam, Your home (and Student loans): the page says 'Add the home on Net worth as Real estate' but the button is called 'Accounts' and opens Account detail, showing his Checking account and a balance-history form; that page has no way to add an account. Empty plan: Net worth's form is open but Type is 'Checking', nothing mentions the mortgage; after 'Home loan added.' the filled button is 'Save today's totals' and nothing says to give it a rate and payment or links back. The phone's Back does return to Mortgage (scroll 0), which then asks for 'the rate and payment'. Reproduced twice.
- **Should:** The button opens Net worth with the add form open, the type already chosen and the cursor in the name box; after the save a 'Back to Mortgage' button. On Your home and Student loans the button says what it does ('Add your home', 'Add a student loan') and goes to that same form.
- **Cause:** Plain links: modules/debt/mortgage/view.js:31, refinance/view.js:14 and credit-cards/view.js:76 go to #/balance/net-worth; student-loans/view.js:31 and property/home/view.js:38 go to #/balance/accounts (Account detail). modules/balance/net-worth/view.js:54 and 62 open the form only when there are no accounts (`showForm = empty`) and always start at `type: 'checking'`; it never reads ctx.route.query. The 2026-09-16 design log line 'Mortgage and Refinance empty states read fine' was about the wording, not the landing, so nothing here undoes a choice.
- **Fix:** The router already carries a query inside the hash. Links become #/balance/net-worth?add=mortgage&back=debt/mortgage (credit, student, real-estate likewise). net-worth/view.js reads ctx.route.query.add: showForm = true, values.type = that type, scroll the form into view and focus 'Account name'; its 'X added.' notice gets a 'Back to Mortgage ›' link built from `back`. Rename the two 'Accounts' buttons.

### A missing answer is reported off screen, so 'Add grant' and 'Add coin' look dead
`p-investments/x-2`, severity 4; your pages: taxes/documents; all pages: investments/employer-stock, investments/crypto, property/vehicles, property/rental, cashflow/budget-percent, taxes/documents, retirement/contributions

- **To see it:** Family household plus invented holdings and one grant (verify/hh.mjs held()): Investments > Employer stock > open '+ Add another grant' > type 400 in 'Units or options granted', leave 'Vesting starts' empty > scroll to the button > tap 'Add grant'. Also blank plan: Crypto > type 0.5 coins with the keyboard up (508 px of screen), leave the price empty > tap 'Add coin'. Also family: Home, cars > Vehicles > '+ Add' > tap 'Add car' with nothing typed.
- **Seen:** Employer stock: the red message 'Type how many units or options and when vesting starts.' is put at the top of the form, 198 px above the top of the screen (the form is about 800 px tall); on screen the only change is a 99 px jump. No box is marked, nothing is added (grants still 1). A second tap adds a second identical message above (tops at -297 and -198) and the screen jumps again. Crypto with the keyboard up: message at y -240, nothing visible. Vehicles 'Add car': message at y -234. The shell's bottom confirmation does not fire because nothing was saved.
- **Should:** The message appears where the thumb is: directly above the form's buttons (or at the empty box), one at a time, and the empty box is focused and outlined: 'Type the date vesting starts.'
- **Cause:** form.prepend(ui.notice("error", ...)) at the top of a tall form, never removed, no scroll, no focus: modules/investments/employer-stock/view.js:124 and :142, modules/investments/crypto/view.js:133-134, modules/property/vehicles/view.js:99, modules/retirement/contributions/view.js:306 (removes the old one, still no scroll). The shell's echo (core/app.js:284) only follows a store.update redraw. modules/career/equity/view.js:39 already does it properly (removes the old message, scrolls the form into view).
- **Fix:** Add ui.formError(form, text, fieldKey) to core/ui/dom.js: remove any earlier message, insert the notice just above .form-actions, focus and mark the named box. Replace the 8 form.prepend calls with it. One helper, 8 one-line call sites; no design-log decision is touched (errors stay red and say what to do next).

### Remove deletes at once on these pages: no question, no undo (the rest of the app asks first)
`p-investments/INV-2`, severity 4; your pages: taxes/documents; all pages: investments/holdings, investments/tax-lots, investments/employer-stock, retirement/contributions, taxes/capital-gains, career/business, taxes/documents

- **To see it:** Family plus invented holdings (held()): Holdings > tap the BND row > 'Remove this holding'. Tax lots > 'Remove lot' under any lot. Employer stock > '+ Add another grant' > 'Remove' beside the grant. Family: Retirement > Contributions > tap a row > 'Remove this contribution'.
- **Seen:** No question in any of the four (0 dialogs). BND and its 2 lots gone in 388 ms; a lot gone; the grant gone in 421 ms; the contribution gone. Feedback is only '... removed.' in the bottom confirmation, which cannot be tapped (pointer-events: none) and has no Undo. Tax lots shows an outlined 'Remove lot' under every lot (4 on one screen), the same look as any harmless button. On Income and Goals the same action asks first: 'Remove Ana's salary?'.
- **Should:** Ask first, in the app's own way: 'Remove BND and its 2 lots?' / 'Remove this lot (200 shares, 3/10/2021)?' / 'Remove New-hire RSU grant?'.
- **Cause:** The handlers call store.update directly: modules/investments/holdings/view.js:62, tax-lots/view.js:67, employer-stock/view.js:146, modules/retirement/contributions/view.js:323, modules/taxes/capital-gains/view.js:67, modules/career/business/view.js:158, modules/taxes/documents/view.js:56. Compare modules/cashflow/income/view.js:112: if (!ui.confirm(`Remove ${name}?`)) return;
- **Fix:** Add the same one-line ui.confirm guard to each of the 7 handlers, naming the thing and what goes with it. No shell change needed. (Seen on screen for the first four pages; the last three by the same code.)

### Tapping a row to edit it throws the page to a form far away, and Cancel or Save leaves you there, not at the row
`p-transactions-helpers/T9`, severity 4; your pages: goals/travel; all pages: transactions/ledger, transactions/categories, transactions/rules

- **To see it:** Ledger: H.family(), import a 150-line bank file (verify/big150.csv; any 3-month bank file is this long), open transactions/ledger, tap 'Show more', scroll to the 120th row, tap it, then tap Cancel (or change the category and tap 'Save changes'). Categories: H.family(), transactions/categories, tap 'Pets', then Cancel. Rules: with 12 rules on file tap the first rule, then Cancel.
- **Seen:** Ledger, 150 rows: the tap scrolls the page UP 8,075 px to the form above the list; after Cancel the page stays at scrollY 483 and the row is 8,501 px below (ten screens). With 16 rows: jump of 758 px, row left 375 px under the fold; after 'Save changes' the screen is pixel-identical to the one after Cancel (no notice, changed row off screen). Categories: tapping Pets (row at y=427) scrolls 1,399 px DOWN to a form at the end of the 2,390 px page; Cancel leaves scrollY 1546 with Pets 568 px above the screen, in the 'Money in' list. Rules, 12 rules: form opens 1,068 px below the row; after Cancel the row is 177 px above the screen. For comparison the phone's Back does restore the scroll position on these pages (7 pages, 2 rounds).
- **Should:** The form opens directly under the row that was tapped (the row stays where it is, nothing scrolls). Cancel closes it in place. After Save the row is still where the thumb was, showing its new value, with the confirmation beside it.
- **Cause:** One shared form card at a fixed spot plus scrollIntoView: ledger/view.js:79-80,119,134-135 (form card above the list; onCancel at :98 only redraws the form), categories/view.js:25,72,84,88-89 (form card appended at the end of the page), rules/view.js:70,77 (form after the list). Nothing remembers the row or the scroll position.
- **Fix:** Smallest: in the row's onClick move formHost into the list right after the tapped <li> (list.insertBefore(formHost, li.nextSibling)) instead of scrollIntoView; on Cancel put it back. After Save the shell already keeps scrollY (core/app.js show(), keepScroll), so the row stays put. A small ui helper (e.g. ui.openUnder(li, formEl)) would let the 19 other pages with the same code use it.

### Boxes that redraw the page the moment they change swallow the next tap and drop the focus
`j-keyboard-reader/x-redraw-on-change`, severity 3; your pages: taxes/documents; all pages: debt/mortgage, taxes/capital-gains, taxes/brackets, household/people, taxes/documents, retirement/projection, retirement/cash-flow, cashflow/forecast

- **To see it:** Touch, family household (and jordan), phone 390x844: debt/mortgage, tap 'Extra each month', type 300, then tap straight into the 'Lump sum' box and type 20000. taxes/capital-gains: type 8000 in Gain, then tap the '+$25,000' chip. Keyboard, 1280x800: type 7000 in the box and press Tab on debt/mortgage, taxes/capital-gains, taxes/brackets; household/people: focus the filing-status list and press the down arrow once; taxes/documents and retirement/projection: Space on the first tick box.
- **Seen:** Mortgage, 3 runs on 2 households: the extra is applied (300) but the tap on Lump sum focuses nothing; 20000 typed goes nowhere; a second tap works. Capital gains: 8000 is applied and the chip tap is ignored. Keyboard: after Tab the focus is on nothing on Mortgage and Capital gains; on Tax brackets it lands on 'Continue your plan' at the bottom and the page scrolls 1,022 px away from the answer. People: one arrow key saves 'married filing separately' at once ('Saved.') and the focus is gone, so you cannot arrow on to the one you wanted. Tax documents checklist, Will the money last?, Year by year and Cash-flow forecast: focus on nothing after the change (one Tab gets back).
- **Should:** Changing a box updates the answer under it and leaves the boxes where they are: the next box you tap takes the tap, and Tab moves to the next box.
- **Cause:** Page-local redraws that rebuild the whole page from a change handler: modules/debt/mortgage/view.js:21 and :92-93, modules/taxes/capital-gains/view.js:15 and :45, modules/taxes/brackets/view.js:36 (root.replaceChildren(); render). The box about to receive the tap is destroyed while the tap is in flight. For choices that save (household/people/view.js:157-158, taxes/documents/view.js:47, retirement/projection/view.js:233) it is the shell's redraw, core/app.js:208, which never puts the focus back.
- **Fix:** Shell, one change (core/app.js show() with keepScroll): before clearing the page note which control had the focus (tag, name or aria-label, and its position among its like), and after the redraw focus its twin with preventScroll. That fixes every choice or tick box that saves (People, Documents, Will the money last? and the rest). Pages, three small changes (Mortgage, Capital gains, Tax brackets): on change redraw only the results under the boxes, not the boxes themselves, as debt/payoff already does with its live preview.

### Edit on a long list throws you a screen and a half away, and neither Save nor Cancel brings you back to the row
`p-balance/B3`, severity 3; your pages: balance/projection; all pages: balance/net-worth, cashflow/expenses, balance/projection

- **To see it:** H.family(), balance/net-worth. Scroll until Ana's 401(k) (second row) is mid-screen and tap its Edit. Tap Cancel. Again: Edit on Chase checking, type 1.2k in Current balance, tap Save changes.
- **Seen:** Edit: the screen moves 1,318 px down to a form under the tenth account; the row is now 930 px above the screen. Cancel: the form goes, the page is 516 px shorter and the screen is left at the very bottom (Car loan, Visa card, Over time); the row is 655 px above the screen, layout shift 0.33, no cue. Save changes on Chase checking: same landing; the changed row ($1,200) ends under the top bar (bottom edge at y 10) and only the toast 'Chase checking saved.' shows for 3.6 s. Expenses: tap Mortgage payment: 1,449 px down; Cancel: row 497 px above the screen; Save changes on Groceries: row 413 px above. Projection, Save in Assumptions with Years to show 20: the fold closes, the page shrinks 890 px and the screen lands at the page bottom; the fold's summary shows '20 years' and the toast says Saved. Not reproduced: 'Delete: scroll jumps 740'. With a tap at the button's position the scroll did not move (0 px on Chase checking, Brokerage and House); the 740 was the kit's tapText scrolling the button into view first.
- **Should:** After Save changes or Cancel the screen goes back to the row you were on (in the upper half of the screen); after a save the row flashes once, or the toast names the new value: 'Chase checking is now $1,200'.
- **Cause:** modules/balance/net-worth/view.js:110 edit() draws the form after the whole list and scrolls to it; save() (lines 68-88) and onCancel (line 106) set editing = null and redraw without going back. modules/cashflow/expenses/view.js:337 and :306 do the same. There is no shared helper in core/ui.
- **Fix:** A small helper in core/ui/dom.js, for example ui.backTo(el): scroll el to about a third of the way down the screen and give it a 'just-saved' class for 1.5 s. Both pages call it: on Cancel with the row's li; on save, keep the row id in the module-level pending and call it for that row on the next render (the shell already lets a page that scrolls itself while drawing win, core/app.js:193). Edit and Delete stay on the rows (design log 2026-09-15).

### Irregular expenses, Subscriptions and Bills list what you typed with no way to change it or add to it
`p-cashflow-b-goals/F2`, severity 3; your pages: cashflow/statement; all pages: cashflow/sinking-funds, cashflow/subscriptions, cashflow/recurring, cashflow/forecast, cashflow/statement

- **To see it:** Family household. Open cashflow/sinking-funds ('Summer trip $3,000 once a year · date unknown'), cashflow/subscriptions ('Streaming typed'), cashflow/recurring (15 typed rows). Tap a row. Look for any button or link.
- **Seen:** Zero controls inside all three pages (census: only the shell's 'Continue your plan' row). Tapping the Summer trip row changes nothing (same address, same height, no chevron). 'date unknown' appears on both irregular costs with nothing to set a date. The link to Expenses exists only in the empty state. Bills says in words 'the bills typed on Expenses are listed below' but gives no link; Forecast names 'the Expenses and Income pages' with no link; Cash-flow statement has only Print.
- **Should:** Under each list one outlined button 'Change these on Expenses' (to #/cashflow/expenses); a typed row is a link there; 'date unknown' becomes 'no date yet: add one on Expenses'.
- **Cause:** modules/cashflow/sinking-funds/view.js:19-35 and modules/cashflow/subscriptions/view.js:18-29: the link to Expenses is drawn only in the empty branch (lines 16 and 15); rows are plain <li>. modules/cashflow/recurring/view.js:38: typed list with no link.
- **Fix:** Add ui.row(ui.h('a', { class: 'btn secondary', href: '#/cashflow/expenses' }, 'Change these on Expenses')) under the list on the three pages; sinking-funds line 31: ' · no date yet' and make the row an <a>. It sits inside the card, so the page still ends with its one way on (design log 2026-11-06).

### 'Work it out' shuts the figures and leaves you at the bottom of the page, the answer above the screen
`p-cashflow-b-goals/F6`, severity 3; your pages: goals/vehicle, goals/charitable; all pages: goals/house, goals/vehicle, goals/charitable, property/rent-vs-buy, property/renovation

- **To see it:** Family household. goals/house: 'The figures' is open; change Home price to 500000, scroll to 'Work it out', tap it. goals/vehicle: open 'The figures', Price 40000, 'Work it out'. goals/charitable: 5000, 'Work it out'. Also property/rent-vs-buy and property/renovation ('Compare').
- **Seen:** House: the fold closes, the page shrinks 2660 -> 1323 px, the screen goes from scroll 1816 to 479 (the new bottom); the headline figure sits 296 px above the screen; the page's own 'Saved.' is off screen (the bottom toast is in view). Vehicle: 1989 -> 1266, scroll 1145 -> 422, headline '$1,400 to pay cash' 239 px above; the screen shows 'The 20/4/10 rule'. Charitable: 1712 -> 1144, headline 117 px above. Rent or buy: 3238 -> 1492, headline 327 px above. Renovation: 2271 -> 1737, 741 px above.
- **Should:** After 'Work it out' the top of the answer (the first card whose figure changed) is at the top of the screen, and 'The figures' stays open below it for the next try. That matches the owner's 2026-09-16 choice for Social Security ('the one just saved stays open').
- **Cause:** Each view folds the form as soon as anything is saved: modules/goals/house/view.js:99, vehicle/view.js:63, charitable/view.js:44, property/rent-vs-buy/view.js:81, property/renovation/view.js:55 (open: saved ? null : true). The shell holds the old height while redrawing and then lets go (core/app.js:205 and 253), so the shorter page clamps the scroll to its new bottom.
- **Fix:** In each view: a module-level justSaved flag set in the submit handler; draw the fold open when justSaved; after drawing, scroll the first answer card to the top (the shell lets a page that scrolls itself win). One small helper in core/ui could carry this for all the 'The figures' pages.

### A tap in the middle of a goal row opens another page instead of the goal
`p-cashflow-b-goals/F4`, severity 3; your pages: goals/vehicle; all pages: goals/goals

- **To see it:** Family household. Open goals/goals. Bring 'Replace Bo's car' on screen and tap the middle of its row (same for 'Cy's college'). The walker's own example row (Emergency fund) opened Edit for me; these two rows did not.
- **Seen:** Fresh browser per row, one real touch at the row's centre: Emergency fund -> Edit form; Replace Bo's car -> #/goals/vehicle; Cy's college -> #/goals/education; Japan trip -> Edit form. The link box (141 to 231 px wide, 44 px tall) starts 9 to 10 px below the centre on the two rows that left; the browser's fat-finger rule gives the tap to the link. The link covers 10 to 26% of each row. Back returned to Goals at the same scroll (301).
- **Should:** The upper part of the row (name, figures, Edit) always opens the goal; the link to the costing page is the row's last line, under the progress bar, with clear space above it.
- **Cause:** modules/goals/goals/view.js:146 (the whole <li role=button> opens Edit) and :153-154 (an inline-flex link, minHeight 44 px, placed inside the row's text block between the figures and the bar).
- **Fix:** Move the link out of span.body to the end of the <li>, after the progress bar, with 8 px above it; keep its 44 px height and stopPropagation.

### Boxes that have limits never check them: 600 months and a 150% fee are kept under a green 'Using these numbers.'
`p-debt-property/DP-4`, severity 3; your pages: debt/consolidation; all pages: debt/credit-cards, debt/payoff

- **To see it:** H.demo(), debt/credit-cards, open 'Moving a balance to a 0% card', type 600 in 'Promotional 0% months' and 150 in 'Transfer fee, percent' (or 35 for a meant 3.5), tap 'Use these numbers'. H.family(), debt/payoff: paste abc into 'Extra each month', tap 'Save plan'.
- **Seen:** Credit cards: the fold summary reads '600 months, 150% fee', the toast says 'Using these numbers.', and the card above flips to 'Moving to a 0% card does not pay'. The boxes carry min 1 / max 36 and min 0 / max 10 and their own messages ('Value must be less than or equal to 36.') but nothing shows them. Months 0 becomes 15 and a fee of -3 becomes 0 without a word. Pay off debts: the box already holds 'Type an amount in numbers, like 4,500.' as its message, yet Save plan stores $0 and shows a green 'Plan saved.'. On the phone's number pad letters and a minus cannot be typed, so the realistic slips are a missing decimal point or an extra digit, or a pasted figure.
- **Should:** The box that is out of range says so at the box and nothing is saved until it is fixed; nothing is swapped for a default silently.
- **Cause:** modules/debt/credit-cards/view.js:143 ('Use these numbers') and debt/payoff/view.js:88 ('Save plan') are plain buttons outside a form, so the validity the inputs already hold (min/max at lines 129-130; ui.moneyBox's check in core/ui/dom.js:53-59) is never reported. Line 143 also does `Number(monthsIn.value) || 15`.
- **Fix:** First line of each handler: `if (!monthsIn.reportValidity() || !feeIn.reportValidity()) return;` and `if (!extraIn.reportValidity()) return;`. Drop the `|| 15` so an empty or zero months box is refused by its min of 1.

### With nothing entered yet, five tax pages show $0 answers and say 'add it on the Income page' with nothing to tap
`p-taxes/T3`, severity 3; your pages: taxes/state, taxes/self-employment, taxes/filing-status; all pages: taxes/federal, taxes/withholding, taxes/estimated, taxes/capital-gains, taxes/brackets

- **To see it:** H.blank() (same with H.empty()): open taxes/federal, then taxes/withholding, taxes/estimated, taxes/capital-gains, taxes/brackets.
- **Seen:** Federal estimate: tiles '$0 Federal tax, 0.0% Of your income, 0% On the next dollar, $0 Taxable income' and a ladder of $0 rows (8 times '$0' on a 3,191 px page). Withholding: '$0 Tax for the year, $0 Withheld by December'. Estimated payments: four $0 tiles. Capital gains: three $0 tiles and 'With your income, $65,550 of long-term gain would be taxed at 0%'. Bracket explorer: '$0 Extra tax ... You keep $10,000'. The hint 'No income on file yet: add it on the Income page or type it on the Federal estimate page.' is plain text: none of the five pages has one link in its content, and federal, withholding and estimated have no filled button on the first screen. With the same empty plan cashflow/paycheck, debt/payoff, cashflow/forecast, retirement/projection, insurance/life-needs and investments/fees show no tiles and one filled button ('Open Income', 'Add your debts', 'People').
- **Should:** With no income counted: the heading, one plain line ('Add what you earn first, then this page works out your tax.'), one filled button 'Add your income' (to Income), no tiles and no ladder. Federal estimate keeps its 'or type it here' section below.
- **Cause:** The views draw their stat rows whatever the plan holds: modules/taxes/federal/view.js:96, modules/taxes/estimated/view.js:64, modules/taxes/capital-gains/view.js:36-41, modules/taxes/withholding/view.js (the stat card after the notes), modules/taxes/brackets/view.js:37-43. The hint is a text note from compute (withholding/compute.js:385, estimated/compute.js:108, federal/compute.js:622) shown through ui.notice.
- **Fix:** In each of the five views: when compute reports no income (hasIncome false / nothingCounted), skip the stat card (and Federal's ladder) and follow the note with ui.h("a", { class: "btn", href: "#/cashflow/income" }, "Add your income"). No shell change.

### 'Remove this sale' and a tax paper's 'Remove' delete at once: no question and no undo
`p-taxes/x-4`, severity 3; your pages: taxes/documents; all pages: taxes/capital-gains, taxes/documents

- **To see it:** family, taxes/capital-gains: add a sale ('Index fund', sold for 12000, cost 9000), tap its row, tap 'Remove this sale'. family, taxes/documents: add a document of your own, then tap its 'Remove'.
- **Seen:** Both are gone at once ('Sale removed.', '... removed from the list.'): no dialog fired, no Undo on the page or in the bottom message. The red 'Remove this sale' sits 12 px under 'Save changes' (tops 542 and 598 px).
- **Should:** Ask first, in the page's words: 'Remove Index fund from this year's sales?' with Cancel, as the other pages do; then the green 'Sale removed.'
- **Cause:** modules/taxes/capital-gains/view.js:67 and modules/taxes/documents/view.js:53-57 call store.update straight from the button.
- **Fix:** Wrap both in if (ui.confirm(...)) with the item's name in the question.

### 'Yes, count it as my emergency fund' changes the plan in one tap and the page offers no way to take it back
`p-balance/x-4`, severity 2; your pages: goals/emergency-fund; all pages: balance/liquidity

- **To see it:** H.family(), balance/liquidity. In 'Your next move', tap 'Yes, count it as my emergency fund'.
- **Seen:** No question. The headline goes from 0.9 to 3 months covered, the whole 'Your next move' card disappears (page 336 px shorter) and the notice 'Done: the "Emergency fund" goal's money now counts as your emergency fund...' is drawn above the screen, with a toast copy at the bottom. Nothing on the page says how to change it back; the only switch is the checkbox 'This goal is my emergency fund' on another page (goals/emergency-fund), which nothing here links to.
- **Should:** The Done line carries an Undo (as Update my balances' notice does after a history fix), or the fund card keeps one quiet line: 'Counting the "Emergency fund" goal's $11,500. Change ›'.
- **Cause:** modules/balance/liquidity/view.js:100-102 sets g.isEmergencyFund = true and keeps nothing to undo with.
- **Fix:** Keep the goal id in pending; the notice (line 52) appends ui.button("Undo", ...) that sets isEmergencyFund back to false. With the B2 shell change the toast would carry that button.

## Part 3: caused in the shared shell or form kit (claude-b fixes once; no edit on your pages)

Listed so you know these are seen and owned. If a fix you make in Part 1 or 2 touches the same behavior, keep it page-only.

- **Figures typed but not yet saved vanish without a word: when you leave and come back, and also when you save or tap something else on the same page** (`p-taxes/T1`, severity 5; your pages: taxes/documents)
- **A rejected Save or Add says why out of sight: the red message goes to the top of the page or form while the button is at the bottom, so the button looks dead** (`j-fat-fingers/FF1`, severity 4; your pages: taxes/documents)
- **After a save the whole page is rebuilt: a section you opened snaps shut and what you tapped moves, by up to a screen and a half** (`j-first-freelancer/x-1`, severity 4; your pages: goals/vehicle, taxes/state, balance/projection)
- **A half-typed form is thrown away without a word when you look at another page** (`p-cashflow-b-goals/x-3`, severity 4; your pages: goals/travel)
- **Tapping Add or Save with a needed box empty or wrong shows the error 300 to 1,800 px above the button; on screen nothing changes** (`p-debt-property/DP-2`, severity 4; your pages: taxes/documents)
- **Back from a linked page sometimes lands at the top instead of where you were** (`p-insurance-estate/IE-1`, severity 4; your pages: goals/emergency-fund)
- **The phone's Back brings you to the right page but usually at its top, with the sections you had opened shut again** (`p-taxes/x-1`, severity 4; your pages: taxes/documents)
- **Saving inside an open section closes the section and jumps the screen (Credit cards, Consolidation)** (`j-debt-fixer/x-3`, severity 3; your pages: debt/consolidation)
- **A setting changed inside a fold shuts the fold; on Roth conversions the whole page can collapse to the top with the box hidden** (`p-retirement-b/RB1`, severity 3; your pages: goals/vehicle)
- **A double tap on Save or Add puts its second tap on whatever slid under the thumb: on HSA and FSA it opens Expenses, on Tax papers it opens Federal estimate** (`p-taxes/x-2`, severity 3; your pages: taxes/documents)
- **Page titles are cut off in the top bar: one in the sandbox, about 58 with the words the owner's phone shows in the status pill** (`p-taxes/T8`, severity 3; your pages: taxes/self-employment, taxes/filing-status, taxes/documents)
- **With the phone's 'reduce motion' on, the menu still slides and pages still glide to a form** (`j-hard-conditions/HC-5`, severity 2; your pages: goals/travel)
- **A money box says nothing about a mistyped amount until Save; then the browser's bubble covers the box's own help and the box's label is under the top bar** (`p-taxes/T6`, severity 2; your pages: taxes/state)
- **Enter in a box saves the half-filled form and shuts its section (the shut section and the dropped cursor after a tapped Save are fine)** (`p-taxes/T2`, severity 2; your pages: taxes/state)

## When you are done

Post a line under Messages in docs/WORKBOARD.md naming the finding ids you closed, and delete this file in the same
commit as the last one (or leave a short note at the top of what is still open).

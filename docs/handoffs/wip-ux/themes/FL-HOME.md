# FL-HOME: Dashboard, Your plan, the step-by-step guides, Get started's first screen, Quick answers: one next step, one count, names that match

17 verified findings (each reproduced on screen by an independent skeptic). Scripts and pictures for a finding `<walker>/<id>` are in `$SP/ux/<walker>/` and `$SP/ux/<walker>/verify/`.

## j-first-freelancer/x-4 (severity 4, next / navigate, scope page, owner claude-b, confirmed)
**After the seven questions, the Dashboard of anyone who ticked nothing under 'What do you have?' says 'Start with a few easy questions' and 'Start here: Set up my plan', with no filled button**

- pages: overview/dashboard
- reach: Every plan with no account in it once the questions are done (all skipped; or pay and spending typed but 'What do you have?' skipped). Reached from the menu and from the last button of Your plan, 'Go to my dashboard'
- steps: H.empty() on a phone (390x844): open Get started, tap Let's go, Continue, I work, 'Myself: my business or freelance', Continue (pay left blank), then Skip on every question to the reveal (second time: type 60,000 as pay, skip the rest); open the menu, tap Dashboard.
- saw: Both times: hero 'Your financial plan ... Start with a few easy questions: about five minutes for those, about 20 for your whole plan.', a text link 'See your plan so far', then a card 'Start here' with 'Set up my plan: Seven easy questions, about five minutes', then a folded 'Set up your plan: 2 of 6 done' (3 of 6 with pay). No filled button on the page (filledOnScreen empty). Tapping 'Set up my plan' opens 'Your plan is set up. Tap a question to change its answer.' The path is at step 2 of 4, yet 'Continue your plan: Your month' is nowhere on the Dashboard.
- should: Hero: 'You've answered the questions. Next: a quick look at each step.' with the filled 'Continue your plan: Your month' and, under it, 'See your plan so far'. The tile reads 'Change an answer', not 'Start here'.
- why: The person has just answered the questions and is told to start them; the one button that would carry them on is missing, so the Dashboard is a dead end for the path.
- cause: modules/overview/dashboard/view.js:61 `if (!d.hasMoney)` draws the first-open hero even when `pathStarted` is set (hasMoney is 'the plan has an account', compute.js:25); the path's filled button exists only in the other branch (:141-144); the 'Start here' title at :198 is keyed on hasMoney too.
- fix: In the !d.hasMoney branch, when pathStarted and the questions are finished: change the bold line (view.js:67), add the same filled `Continue your plan: ${way.next.name}` as :142 above the existing 'See your plan so far' link (:69), and title the tile card 'Change an answer' (:198). Keeps 2026-11-06 ('the one filled button continues the path while it is under way'; the review note that this Dashboard links to Your plan).
- evidence: $SP/ux/j-first-freelancer/verify/10-alex-dash-full.png, $SP/ux/j-first-freelancer/verify/28-dash-pay-only.png, $SP/ux/j-first-freelancer/verify/28-after-setup-card.png (scripts v10, v28)

## j-debt-fixer/D4 (severity 3, next, scope page, owner claude-b, confirmed)
**Dashboard: the sentence says the emergency fund 'is next', the filled button under it continues the plan somewhere else**

- pages: overview/dashboard
- reach: Dashboard, every household whose path is started and not finished (all four tried).
- steps: H.jordan() (also H.sam(), H.renterDebt(), H.family()), overview/dashboard.
- saw: All four: 'Your month works. Building your emergency fund is next.' and, right under the three rows, the one filled button 'Continue your plan: The questions ›' (jordan, sam) or 'Continue your plan: Your month ›' (renterDebt, family). Jordan, Sam and the family also have 'Do step 5: Set your first goal' (step 6 for the family) at y=1573 to 2006; it is outlined, not filled as the walker wrote, so there is one filled button on the page. The filled button continuing the path is the owner's choice (2026-11-06) and must stay; the walker's proposal to make the emergency fund the filled button would undo it. What is wrong is only the words: two things on one card both claim to be next.
- should: While the plan's path is under way the sentence gives the verdict without promising a next step, for example 'Your month works. Your emergency fund is thin.', and the button stays 'Continue your plan: <step> ›'. Once the path is complete the sentence may say what is next, because the button then says the same thing.
- why: Read top to bottom, the card says 'the emergency fund is next' and then offers a different next; a careful reader stops to work out which one is meant.
- cause: modules/overview/dashboard/view.js:135 prints st.headline unchanged while underWay (lines 131-142) picks the path for the button; the words come from modules/overview/setup/compute.js:2345 ('... is next.').
- fix: dashboard/view.js:135: when underWay, use a headline without the 'is next' clause (a second wording returned beside st.headline by setup/compute.js, or replace / is next\.$/ with a plain state). No change to the button (2026-11-06).
- evidence: $SP/ux/j-debt-fixer/verify/v7-dash-jordan.png, $SP/ux/j-debt-fixer/verify/v7-dash-jordan-bottom.png

## j-first-family/F4 (severity 3, understand, scope page, owner claude-b, confirmed)
**'The moves below start there' points at moves that are not on the screen, on the reveal and on the Dashboard; the first row is ticked while the button says it is next**

- pages: overview/setup/done, overview/dashboard
- reach: Every household whose headline names a first move (six of the headline sentences end this way), on the reveal and on the Dashboard.
- steps: H.empty(): Get started > Let's go. Question 1: Me and my spouse, Dana and Chris, 2 children, Ohio. Question 2: both work, 85,000 and 70,000 a year, plan at work Yes for both. Question 3: born 1986 and 1984. Question 4: tick Checking, Savings, A home, A car (Retirement is already ticked); amounts 5,200, 12,000, 90,000, 41,000, home 340,000. Question 5: Credit cards, Car loan, Mortgage with any amounts. Question 6: 5,500. Question 7: An emergency fund, Retiring well, Education; See where I stand. Read the screen; then open the Dashboard from the menu.
- saw: Reveal: under 'You did it, Dana. Here is your money so far.' the one sentence is 'Life insurance for the people who count on you comes first. The moves below start there.' Below are four figures and a list of steps that starts '✓ Your month', then a filled 'Next: Your month ›'; life insurance is row 5. The Dashboard repeats the sentence under 'Hi Dana.', above 'Continue your plan: Your month ›'. Neither screen lists a move.
- should: A sentence that is true of the screen: 'Life insurance for the people who count on you comes first. Your plan gets to it at step 5.' The row the button leads to shows its number, not a tick: '2 Your month'.
- why: It is the first sentence read at the moment the person looks for what to do, and it sends the eye to something that is not there; the button below then goes somewhere else than the sentence said. Widened from the reveal to the Dashboard. The gray 'Our guesses for now' on Retirement is a logged, calm state, not part of this.
- cause: modules/overview/setup/compute.js standing() headline L2337-2342 still says 'the moves below'; modules/overview/setup/view.js drawDone L1585-1597 no longer draws them (comment L1585: they moved to Your plan); modules/overview/dashboard/view.js L135 prints the same headline. Tick: view.js L1594 ticks a row when `x.done` (true from the spending typed at question 6) while the button goes to `ps.next`, the first step not passed.
- fix: compute.js: reword the endings of the six headlines so none says 'below' (both screens follow). view.js L1594: tick a row only when it was passed (`x.passed`). Keeps the logged list of 2026-11-06 (only steps numbered, 'Then: your whole plan on one page' unnumbered).
- evidence: verify/reveal-full.png, x10-dashboard.png; scripts mkplans.mjs, x10.mjs

## j-first-freelancer/F5 (severity 3, understand / focus, scope page, owner claude-b, confirmed)
**The step card at the top of a path page tells the person to read or tap things that are not on the page**

- pages: cashflow/expenses (step 'Your month'), retirement/projection (step 'Your retirement'), balance/liquidity (step 'Emergency fund')
- reach: Step 'Your month' whenever pay or spending is missing (3 of 4 households tried: the skipper, H.freelancer(), H.samMidSetup(); fine for H.sam()), and step 'Your retirement' whenever the answer cannot be worked out yet
- steps: H.empty() on a phone (390x844): open Get started, tap Let's go, Continue, I work, 'Myself: my business or freelance', Continue (pay left blank), then Skip on every question to the reveal; tap 'Next: Your month'; then 'Next: Emergency fund'; then 'Next: Your retirement'.
- saw: Your month: 'Read what is left each month at the top; rows marked our guess are figures we filled in, so tap a row to type yours, or leave them.' The page shows $3,730 Per month (spending), no left-over figure (no pay) and no rows (they are behind 'See or change each bill, 7 bills'); the lower card says 'marked "our guess"' and nothing on screen is so marked. For H.freelancer() and H.samMidSetup() the same sentence sits over the empty state 'What goes out?'. Your retirement: 'Read the answer at the top: whether your money lasts, and to what age.' over a page that says it needs a birth date and accounts. Emergency fund: the page says it 'needs two things: your accounts and your expenses' and offers 'Add your expenses' although seven guessed bills are already in the plan. The two cards (bar on top, Next at the end) are the logged design and stay.
- should: When a step is waiting on something, the top card says so in the words the bottom card already uses: 'This step needs your pay first. Add it, or go on and come back.'
- why: The person looks for a figure and rows that are not there and wonders whether the page is broken or they missed a step.
- cause: modules/overview/guide/journeys.js:172, 174, 176: each step's `ask` is one fixed sentence; 'month' has no `waits` (cushion and retire have cushionWaits / retireWaits at :165-168), and modules/overview/guide/frame.js:378 draws `step.ask` whatever the page can show. The Emergency fund empty state is balance/liquidity's own.
- fix: Add a `waits` to the month step (no income: { what: 'your pay', href: '#/overview/setup/money?back=done' }; no expenses: 'your spending') and, in frame.js:378, show the waiting sentence in place of `step.ask` when the step waits. One change in overview/guide covers every step page. In balance/liquidity's empty state, do not ask for expenses when plan.expenses has rows.
- evidence: $SP/ux/j-first-freelancer/verify/07-yourmonth.png, $SP/ux/j-first-freelancer/verify/08-path-1.png, $SP/ux/j-first-freelancer/verify/08-path-2.png, $SP/ux/j-first-freelancer/verify/24-step4-top.png (scripts v07, v08, v22)

## j-first-freelancer/F3 (severity 3, navigate, scope page, owner claude-b, confirmed)
**The Dashboard counts the same plan two ways: 'Your plan: step 2 of 8' in the first card and 'Set up your plan: 5 of 6 done' with 'Do step 6' lower down**

- pages: overview/dashboard
- reach: Every plan with an account in it that did not finish Get started: H.family() (step 2 of 8, 5 of 6 done, Do step 6), H.sam() and H.jordan() (step 1 of 7, 4 of 6 done, Do step 5), H.freelancer() (step 1 of 5, 3 of 6 done, Do step 4). A plan that finished Get started shows only the path count and a folded 'Set up my plan: done' (H.renterDebt())
- steps: H.freelancer() (or H.family()): open the Dashboard and read the first card, then scroll to the last card.
- saw: First card: 'Your plan: step 1 of 5' over the filled 'Continue your plan: The questions'. Last card: 'Set up your plan: 3 of 6 done', six numbered rows and an outlined 'Do step 4: Enter what goes out'. Narrower than reported: the walker's '2 of 4, 1 of 5 and 3 of 6 at once' mixes two households (2 of 4 is the skipper, where the reveal's list 2, 3, 4 and the guide card 'Step 2 of 4' agree; 1 of 5 and 3 of 6 are the freelancer). There are two lists, not three.
- should: While 'Your plan: step N of M' is on the page, the six-row card is the folded line the log already chose for a finished setup, and its button does not say 'step'.
- why: Two numbered lists both say 'step' on one page and point to different next things, so 'which one am I following?' has no answer. The 2026-11-06 entry names 'the Dashboard's six steps' among the walks that should not compete, and says 'The path says Step'.
- cause: modules/overview/dashboard/view.js:141-142 (the path line and button) and :237-239 (the open six-step card with 'Do step N'), both drawn when the plan has accounts and Get started was not finished.
- fix: view.js:237: when `underWay` is true, draw the card as the folded <details> of :228 ('Set up your plan: 3 of 6 done') with its rows inside and the button worded 'Next on this list: Enter what goes out'. Keeps 2026-09-15 (rows are links with chevrons, one button under the list; folded line when done) and 2026-11-06 (one path, only the path says Step).
- evidence: $SP/ux/j-first-freelancer/verify/09-free-dash-full.png (scripts v09, v30)

## j-first-renter/F5 (severity 3, next, scope page, owner claude-b, confirmed)
**After questions 1 to 3 the Dashboard has no filled button and still says "Start with a few easy questions"**

- pages: overview/dashboard
- reach: Narrower than reported: only until the first account is typed (stopped at question 2, 3 or 4). From question 5 on the Dashboard has the filled "Continue your plan: The questions ›".
- steps: H.empty(); Let's go; Sam; Continue; I work, 3200, A month; Continue; menu; Dashboard.
- saw: No filled button on the screen (filledOnScreen empty; page 845 px). The hero says "Start with a few easy questions: about five minutes for those" as if nothing had been answered. Under it a text link "See your plan so far ›" opens Your plan ("You've done 0 of 5 steps", every row "Not yet") whose filled button "Continue: The questions ›" is the way back, two taps. The direct way is an outlined tile under "Start here": "Set up my plan. Question 3 of 7. Next: your ages. Pick up where you left off." Get started shows the same resume as a filled button.
- should: One filled button in the hero: "Pick up where you left off: question 3 of 7 ›", and the line above it "2 of 7 questions answered". "See your plan so far ›" stays under it (design log 2026-11-06); the duplicate tile goes.
- why: Sam reopens the app, reads "Start with a few easy questions" and wonders whether his answers were kept; the first thing to tap is a link to an empty plan.
- cause: modules/overview/dashboard/view.js:61-70: the hero for a plan with no accounts (`!d.hasMoney`) has fixed words and no button, started or not; the resume is an `.action` tile built at :179.
- fix: In that hero, when `resume` (setupCard state "started") exists: draw `a.btn.db-go` to resume.href with the words above and replace the bold sentence; drop the tile at :179 for that case. The design log's rule (2026-11-06: "the one filled button continues the path while it is under way") asks for exactly this.
- evidence: $SP/ux/j-first-renter/verify/f5-dash.png, $SP/ux/j-first-renter/verify/f5-plan-so-far.png, $SP/ux/j-first-renter/verify/f5b-after-q5.png (scripts f5.mjs, f5b.mjs)

## j-one-answer/A2 (severity 3, next, scope page, owner claude-b, confirmed)
**Under 'Just want one answer?' six of eight tiles open a 3 to 7 step guide, and the tile does not say so**

- pages: overview/start, overview/guide/retire, overview/guide/taxes, overview/guide/protect, overview/quick
- reach: Get started on first open; the three guides with 5 or more steps.
- steps: H.empty() -> Get started -> tap 'Just want one answer?' -> tap each of the 8 tiles in turn, phone Back after each.
- saw: Quick answer -> overview/quick (the only tile that leads to answers). Pay off debt, Spend less, Buy a home, Plan retirement, Sort out taxes, Protect my family -> a 'Step-by-step guide' page ('About 10 / 20 / 15 / 30 minutes', '0 of N steps done'). On the retire, taxes and protect guides the filled 'Do step 1' button is below the first screen (no filled button in view; the step rows are tappable). On Quick answers for an empty plan the three plain questions (money last, debt-free, tax) are at y 1,396 to 1,581 of a 1,802 px page, each also opening a guide.
- should: Keep the eight tiles and the fold as they are (owner's choice). Make each guide tile's second line say what it is, for example 'Pay off debt: 3 short steps, about 10 minutes', and on a guide whose step list is longer than the screen put the filled 'Do step 1' above the list.
- why: Happens as described, but it is hesitation, not a dead end: the first tile is exactly right and comes first; I measured the debt guide at 5 screens and 13 taps to 'Debt-free by August 2034', a few minutes, not the 20 the walker quoted from the label. Severity lowered from 4 to 3 and the fix narrowed to keep the logged decision.
- cause: modules/overview/start/compute.js:57-60 (the tiles' `line` text promises an answer: 'Which first, and when you're free', 'Will the money last?'); modules/overview/guide/view.js:142-145 draws 'Do step N' after the whole step list.
- fix: Wording and order only. The walker's own proposal (replace the tiles with three questions, keep guides for 'Build my plan') must NOT be done: docs/DESIGN_LOG.md 2026-11-06 records the owner choosing 'the eight tiles folded behind Just want one answer?' and 'do not add a new walk'.
- evidence: $SP/ux/j-one-answer/verify/v2-empty-fold-open.png; v17-guide-retire.png; v1-quick-empty.png (script v2.mjs)

## j-one-answer/A4 (severity 3, navigate, scope page, owner claude-b, confirmed)
**Quick answers leaves out 'Do I have enough life insurance?' and 'Am I saving enough?' although pages answer both on their first screen**

- pages: overview/quick, menu search
- reach: Quick answers for every household; one search phrase.
- steps: H.patLee() and H.family() -> overview/quick, read the three lists. Then open insurance/life-needs and overview/benchmarks. Search: menu, put each of the six questions into 'Find a page' whole (as a paste).
- saw: Quick answers lists 14 questions for patLee (3 answered from the plan, 8 calculators, 3 more); neither question is there (only 'Whole life or term life insurance?'). insurance/life-needs opens on 'Your family is covered' (patLee) and 'Ana needs about $312,000 more life insurance' (family); overview/benchmarks on 'Ahead on 4 of 6'. Search with the whole question: 'can I retire at 62' -> Will the money last? first; 'how much house can I afford' -> House down payment first; 'am I saving enough' -> How am I doing, Will the money last?; 'when will my debt be gone' -> Debts, Pay off debts; 'what will my taxes be' -> Federal estimate first; 'do I have enough life insurance' -> Life insurance needs. Only 'retire at 62' misses (Social Security alone).
- should: Two more rows on Quick answers, with the page's own headline when the plan answers ('Your family is covered · Do I have enough life insurance?'). 'retire at 62' also finds Will the money last?.
- why: The list part is confirmed. The search part is mostly refuted: five of six full questions find the right page first when the text arrives whole. The walker tested with fill(), so it did not see that typing itself is broken (x-1).
- cause: modules/overview/quick/compute.js:32-38 (NEEDS_FIRST and ANSWER_PAGES hold three questions); core/search.js PLAIN has no phrase with an age for retirement/projection.
- fix: Add the two questions to NEEDS_FIRST / ANSWER_PAGES with answerFor() quoting each page's headline; add 'retire at' to PLAIN['retirement/projection'] in core/search.js. Search results stay page names (design log 2026-09-15, search ranking): do not change that.
- evidence: $SP/ux/j-one-answer/verify/v8-patLee-quick.png; v25-patLee-insurance_life-needs.png; v25-family-insurance_life-needs.png; v7-patLee-retire-at-62.png (scripts v8.mjs, v25.mjs, v7.mjs)

## p-overview-home/OV-2 (severity 3, next, scope page, owner claude-b, confirmed)
**The Dashboard gives two different next steps with two different counts (step 2 of 8, and 5 of 6 done with 'Do step 6')**

- pages: overview/dashboard
- reach: Dashboard of every household that is on the path and has not finished the old six-step list: 7 of the 9 filled households tried (family, demo, ruth, patLee, sam, jordan, retiredCouple, freelancer; not renterDebt, whose list is already folded).
- steps: family household: open the Dashboard and read from the top to the bottom. Script: verify/v4-dash.mjs.
- saw: family and demo: 'Your plan: step 2 of 8' with the filled 'Continue your plan: Your month' (to Expenses) at y=466, then at y=1205 an open card 'Set up your plan: 5 of 6 done' ending in an outlined 'Do step 6: Check the assumptions' (to Assumptions). ruth, patLee: 'step 1 of 6' against '4 of 6 done' and 'Do step 5: Set your first goal'. sam, jordan, retiredCouple: 'step 1 of 7' against '4 of 6 done'. freelancer: 'step 1 of 5', a second filled button 'Use these guesses', and '3 of 6 done' with 'Do step 4: Enter what goes out'.
- should: One next step and one count. While the path is under way the six-step list is one folded line with no button of its own ('Set up your plan: 5 of 6 done', the 2026-09-15 pass 2 form); it opens on a tap for anyone who wants it.
- why: Seen on screen for eight households. The filled 'Continue your plan' button is the owner's choice (2026-11-06) and stays; the fault is the older six-step walk still open beside it, which that same entry names as one of the 'five separate walks that never met'.
- cause: modules/overview/dashboard/view.js lines 237-239: the last branch draws the open six-step card and its 'Do step N' button whenever the list is unfinished, without looking at 'underWay' (lines 130-142), which already drew the path's count and filled button.
- fix: In that branch, when underWay is true draw the same folded <details class='card fold fold-card'> used at lines 228-232 (summary 'Set up your plan: N of 6 done', the list inside, no steps-cta). Keep the open card with its button only when no path is under way. Nothing in the design log is undone: the filled path button (2026-11-06) and the folded line (2026-09-15 pass 2) are both the owner's.
- evidence: $SP/ux/p-overview-home/verify/dash-family-full.png, $SP/ux/p-overview-home/verify/dash-freelancer-full.png

## j-first-family/F9 (severity 2, navigate, scope page, owner claude-b, confirmed)
**The step a button names is not the name on the page it opens ('Next: Your month ›' opens 'Expenses')**

- pages: cashflow/expenses, debt/payoff, insurance/life-needs, retirement/projection, goals/education, taxes/federal
- reach: Every step page of the path except Emergency fund.
- steps: The family to the reveal; tap 'Next: Your month ›', then Next on each step, reading the top bar and the first card each time.
- saw: 'Next: Your month ›' opens a page titled 'Expenses' whose first card says 'Your plan · Step 2 of 8' with no name and whose last card says 'Step 2 of 8 · See what's left each month'. Likewise 'Your debts' -> 'Pay off debts', 'Life insurance for your family' -> 'Life insurance needs', 'Your retirement' -> 'Will the money last?', 'College costs' -> 'Education (529)', 'This year's tax' -> 'Federal estimate'. The other half of the walker's finding is not a problem: Finish later lands on Get started with 'Question 4 of 7 · Next: how much is in each' and one filled 'Pick up where you left off', and the typed 5,200 and 12,000 are there on return.
- should: The first card says the name the button promised: 'Your plan · Step 2 of 8 · Your month'.
- why: Narrowed to the names. The step number carries the person through, so it is rough, not a trap; a moment of 'is this the page it meant?' on six of the seven step pages.
- cause: modules/overview/guide/frame.js L376 prints only `Your plan · ${where}`; the name the previous button used (step.name, modules/overview/guide/journeys.js L172-182) is nowhere on the page; the top bar shows the module's own title (core/app.js L209).
- fix: frame.js L376: add the step's name to the bar's head. One line, every step page. No new stepper or menu (rule of 2026-11-06).
- evidence: verify/f3-step2-top.png, f9-after-finish-later.png; scripts f3.mjs, f9.mjs

## j-first-family/x-2 (severity 2, understand, scope several-pages, owner claude-b, confirmed)
**Emergency fund reads '3 months' next to 'Aim for 3', 'Worth building up' and '$914 to go'**

- pages: overview/setup/done, overview/dashboard, overview/plan, balance/liquidity
- reach: Any household whose cash is within half a month under its target, on four pages.
- steps: The family's finished plan (5,200 in checking, 12,000 in savings, bills of 6,038 a month). Read the Emergency fund figure on the reveal, the Dashboard, Your plan and step 4.
- saw: Reveal: '3 months · Emergency fund · of the bills you have to pay, in cash. Aim for 3. · Worth building up' (amber). Dashboard and Your plan: 'Enough for now; build it to 3 months once the costly debt is paid' beside '3 months'. Step 4: '3 months covered · target: 3 months ($18,114)' and '$914 to go'. The question screen itself said '2.8 of 3 months'.
- should: When the months are short of the target but round up to it, show one decimal: '2.8 months'.
- why: Missed by the walker. 2.8 is rounded to 3, so the figure says the target is met while the words beside it say it is not.
- cause: modules/overview/setup/compute.js monthsWords L1816 rounds to a whole month from 2 up (used by setup/view.js L1575 and dashboard/view.js L10); modules/balance/liquidity/view.js L146 rounds the same way.
- fix: monthsWords(m, target): one decimal when Math.round(m) >= target > m; pass the target at the call sites; the same rule in liquidity's months().
- evidence: verify/reveal-full.png, x10-dashboard.png, x2-your-plan.png, x9-liquidity-top.png; script x9.mjs

## j-first-renter/F9 (severity 2, navigate, scope page, owner claude-b, confirmed)
**The name on the Next button is not the name on the page it opens**

- pages: cashflow/expenses, retirement/projection, scenarios/goal-seek, taxes/federal
- reach: Four of Sam's five steps (Emergency fund matches). The place in the path is still clear: every step opens with "Your plan · Step N of 6" and a bar.
- steps: H.empty(); answer as Sam; follow Next from the reveal to Your plan and read the top bar on each page.
- saw: "Next: Your month ›" opens a page titled "Expenses"; "Next: Your retirement ›" opens "Will the money last?"; "Next: What would help ›" opens "Goal seek"; "Next: This year's tax ›" opens "Federal estimate". The step card at the top says only "Your plan · Step 4 of 6".
- should: The step card names the step: "Step 4 of 6 · Your retirement".
- why: A small stumble: the word Sam tapped is nowhere on the page he lands on, and "Goal seek" is not a plain word.
- cause: modules/overview/guide/frame.js:376 draws `Your plan · ${where}` without step.name; the top bar (core/app.js:209) shows the module's own title.
- fix: frame.js:376: `${where} · ${step.name ?? step.short}` (drop "Your plan · " so it fits 390 px: .gb-name is one line with an ellipsis; the card's aria-label already says Your plan). One line, every step, no shell change.
- evidence: $SP/ux/j-first-renter/verify/f4-step3-top.png, $SP/ux/j-first-renter/verify/f4-step4-top.png (script f4.mjs)

## j-first-retiree/x-3 (severity 2, next, scope page, owner claude-b pages, confirmed)
**The reveal ticks 'Your month' as done and then says 'Next: Your month'; the list is numbered from 3**

- pages: overview/setup/done, overview/plan ('You've done 2 of 6 steps' with 'Continue: Your month')
- reach: Everyone who types a spending figure in Question 6.
- steps: H.empty() as Ruth (spending 2,500) to the reveal; read 'What's next'.
- saw: The list reads: tick 'Your month', 3 'Emergency fund', 4 'Your retirement', 5 'Where to take money from', 6 'The yearly amount the law requires', arrow 'Then: your whole plan on one page', and under it the filled 'Next: Your month'. Your plan says 'You've done 2 of 6 steps' above 'Continue: Your month'.
- should: The list ticks only steps she has been through: 2 Your month, 3, 4, 5, 6; Next goes to 2.
- why: The one ticked row is where Next sends her, and there is no 1 or 2 to count from. A small 'did I do that already?' on the first screen after the questions.
- cause: modules/overview/setup/view.js line 1594 ticks x.done (done by what the plan holds: she typed her spending), while Next is the first step not passed (modules/overview/guide/compute.js lines 105 and 122).
- fix: view.js line 1594: tick on x.passed and number the rest from 2; count passed steps in Your plan's 'You've done N of M'.
- evidence: $SP/ux/j-first-retiree/verify/b-reveal.png, i-plan-after-reveal.png (scripts b.mjs, i.mjs)

## j-hard-conditions/HC-3 (severity 2, next, scope page, owner claude-b, confirmed)
**On a 320 px phone the Dashboard's filled 'Continue your plan' button is cut by the bottom of the first screen (family household)**

- pages: overview/dashboard
- reach: Narrower than reported: only the Dashboard, only at 320 px, and only when the first verdict row carries the long explanation (family). ruth and samMidSetup at 320 px show the whole button on the first screen (y=449..518 and 468..537). Swept 16 most used pages at 320 px with family and ruth: no other page has a filled button cut by the fold.
- steps: Household family, open({viewport: SMALL_PHONE}) (320x568), Dashboard. Do not scroll.
- saw: The button 'Continue your plan: Your month' is 69 px tall (its words wrap to two lines) at y=538..607 of a 568 px screen: 30 px of blue with half a line of words shows. The row above it, 'Left over each month', is 175 px tall because its explanation is squeezed into a 148 px column next to the figure and wraps to six lines.
- should: At 320 px the whole button is on the first screen, on one line.
- why: Rough but passable: the strip of blue at the bottom edge does tell the eye there is a button, and a small scroll shows it. Worth a few lines of CSS for people on a small phone or with the display zoomed, not more.
- cause: modules/overview/dashboard/view.js style block, lines 20-29: .db-rows a is a flex row, so the sub-text (.db-s, inside .db-k) only gets what is left beside the figure (148 px at 320); .db-go uses var(--fs-md) and wraps.
- fix: In the Dashboard's own style block (no global CSS): @media (max-width: 359px) { .db-now .db-rows a { flex-wrap: wrap; } .db-now .db-s { flex-basis: 100%; order: 3; padding-left: 22px; } .db-now .db-go { font-size: var(--fs); } } or, simpler, show only the first sentence of the long explanation under 360 px. Keeps the three verdict rows and the one filled path button (design log 2026-11-06).
- evidence: $SP/ux/j-hard-conditions/verify/v3-dash-family-small.png; scripts v3.mjs, v3b.mjs, v3c.mjs.

## j-navigator/N7 (severity 2, navigate, scope page, owner claude-b, confirmed)
**The Dashboard says $3,884 is left over each month; the page it opens says $3,880 under the same words**

- pages: overview/dashboard, overview/next-best-action
- reach: narrowed. The walker said the figure appears 'further down'; it does not: the card 'Each month's money' is on the first screen of Next best action and ends with 'Left over each month $3,880' at y 637 of 844, so the tap does lead to the explanation.
- steps: H.family(), Dashboard, tap the first row 'Left over each month $3,884'.
- saw: Lands on Next best action at the top: first card 'A starter emergency fund ... at $3,880 a month', second card 'Each month's money' with every line to the nearest $10 and 'Left over each month $3,880'. Your plan says $3,884.
- should: The same figure to the dollar wherever it carries the label 'Left over each month'.
- why: A careful reader sees two numbers for one thing one tap apart and wonders which is right. Small, and nobody gets lost.
- cause: modules/overview/next-best-action/view.js line 34: `const money = (n) => fmt.money(Math.round(n / 10) * 10, cur)` rounds every figure on the page, including the left-over line (line 83) that repeats the Dashboard's figure.
- fix: In next-best-action/view.js show the left-over line and 'at $X a month' with the exact figure (fmt.money(s.monthly, cur)); the other lines can stay rounded. No change to the Dashboard.
- evidence: $SP/ux/j-navigator/verify/n7-landing.png; script v7.mjs

## p-overview-home/OV-7 (severity 2, next, scope page, owner claude-b, confirmed)
**Empty Dashboard: the one filled button is below the first screen, and the list above it highlights a different first step**

- pages: overview/dashboard
- reach: Dashboard of a plan with nothing in it (someone who chose to look around first; a first open with no page in the address goes to Get started instead). Narrowed from the walker's five pages to one.
- steps: empty household: open the Dashboard. Script: verify/v8-empty.mjs.
- saw: First screen (844 px): the hero, an outlined 'Set up my plan' tile at y=368, and the six-step list with step 1 'Add your accounts and balances' marked in blue as next (it opens Net worth). No filled button on the first screen; the filled 'Do steps 1 to 5 in one go: Set up my plan' is at y=922. Three things lead to setup and the highlighted one leads somewhere else. The other pages the walker listed do not have the fault: empty Life timeline has a filled 'Add the people in your household' (the walker wrote it had none), How am I doing has a filled 'People', Our guesses has a filled 'Get started'; Needs attention is a list of four rows that each say 'Open ›' and ends with the quiet row the owner chose (2026-11-06).
- should: With nothing in the plan the filled 'Set up my plan' button is on the first screen, and no step of the list is marked as next (the next step is the questions).
- why: The Dashboard part reproduced; the Timeline claim is refuted by my picture and the Needs attention part is the logged path rule.
- cause: modules/overview/dashboard/view.js lines 233-236 (0 of 6 done: the list with the filled button under it) after a 'Start here' card (lines 179-180) that offers the same thing, which pushes the button to y=922; stepsList() marks d.next (step 1) as 'next' even in this state.
- fix: In the 0-of-6 state only: do not give step 1 the 'next' class, and do not draw the separate 'Start here' tile (the filled button under the list is the same destination and then sits at about y=575). The list with one filled button under it stays as the owner chose (2026-09-15, round 1, finding 4).
- evidence: $SP/ux/p-overview-home/verify/empty-dashboard.png, $SP/ux/p-overview-home/verify/empty-timeline.png, $SP/ux/p-overview-home/verify/empty-alerts.png

## p-overview-path/OP-7 (severity 2, next, scope page, owner claude-b, confirmed)
**On a step-by-step guide the filled "Do step N" button is below the first screen**

- pages: overview/guide/retire, overview/guide/taxes, overview/guide/protect, overview/guide/home, overview/guide/plan
- reach: 9 of 14 guide openings measured (family and ruth, seven guides each); debt and budget fit
- steps: Household: family. Open #/overview/guide/retire (Get started > Plan retirement). Compare taxes, protect, home, plan; then ruth on retire, taxes, protect, plan.
- saw: Family: the filled button is at y 931 (retire, taxes), 1,025 (protect), 905 (home), 971 (plan) on an 844 px screen; ruth: 870, 931, 1,025, 850. Narrowed from the walker's 3: the next step is also a row in the list with a blue number and "Next step.", it is tappable and goes to the same page, and it is on the first screen in 13 of the 14 openings; only family/retire has it cut by the bottom edge (y 806-850). It is not only the finished steps: the head card (what it is, how long, have ready, progress) takes 430 px even with one step done.
- should: Opening a guide shows the progress bar and, right under it, the filled "Do step 6: Add a pension".
- why: The first screen of a guide has no filled button, so the eye lands on ticks and gray text; a person has to notice the one row with a blue number or scroll. Passable, but it is the owner's first test (one filled button on the screen, in thumb reach).
- cause: modules/overview/guide/view.js:144: the "Do step N" button is appended after the whole steps list; the head card (lines 95-100) carries no action.
- fix: Move the one filled "Do step N: ..." button into the head card, directly under the progress bar (view.js about line 100), and leave "Do something else" outlined under the list. Still exactly one filled button and one way on; no bar fixed to the bottom (2026-11-06).
- evidence: $SP/ux/p-overview-path/verify/op7-family-retire.png


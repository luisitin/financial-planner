# PG-RETIRE: Retirement and what-if pages (page-specific)

23 verified findings (each reproduced on screen by an independent skeptic). Scripts and pictures for a finding `<walker>/<id>` are in `$SP/ux/<walker>/` and `$SP/ux/<walker>/verify/`.

## j-hard-conditions/HC-2 (severity 4, understand, scope several-pages, owner claude-b, confirmed)
**Will the money last? says 'The money lasts' first, then changes to 'It lasts in most cases, not all' one to three seconds later, on every visit**

- pages: retirement/projection, retirement/fire
- reach: Will the money last? for households whose plan lasts in 6 to 9 of 10 futures (family and demo flip; patLee, ruth and retiredCouple keep 'The money lasts'; sam and jordan say 'We don't know yet' and do not flip). Same pattern, milder, on Financial independence: 'Ana could stop work at [grey bar]' becomes 'Ana would need to work until 67' and the filled 'Will the money last?' button moves down 58 px, 2.6 s after the page appears at 4x slowdown. Checked and steady: How much to take out, Goal seek, Required withdrawals, Chance the money lasts, Your plan (headings do not change).
- steps: Household family, phone 390x844, Dashboard. Tap the row 'Retirement: The money lasts, On track'. Watch the big heading. Repeat with open({slow: 4}).
- saw: Heading 'The money lasts' 137 ms after the tap; at 1,112 ms it becomes 'It lasts in most cases, not all' with an amber 'short in a bad run' pill (layout shift 0.030, the two buttons under it move 33 px). At 4x slowdown: 'The money lasts' from 510 ms to 3,228 ms, so the wrong good news is on screen for 2.7 s. Nothing is remembered: it happens on every visit and after every save on the page. While waiting, the grey placeholder in 'At the $84,000 you plan, it lasts ...' is about 550 px wide and runs off the right edge of the card, leaving a lone full stop on the next line. The Dashboard row keeps saying 'The money lasts / On track' for the same household.
- should: No verdict until the careful answer is in: a neutral heading such as 'Checking your plan against bad years...' (two lines reserved so nothing below moves), then the one final verdict. On a second visit with an unchanged plan the final verdict shows at once. The grey placeholders never leave the card.
- why: This is the answer the whole path leads to. A person who glances and goes back leaves with 'The money lasts'; one who keeps looking sees it change to a worse answer and no longer knows which is true. A slower phone shows the wrong one longer. The app's own rule (comment at view.js:116) is that 'The money lasts' must not stand over a plan that fails in a third of futures.
- cause: modules/retirement/projection/view.js line 103 writes the average-markets verdict into the h1 at first paint; lines 104-119 (whenCareful) overwrite it when the bad-run search returns (headline.textContent at 116 and 118). modules/retirement/careful.js whenWorked() keeps nothing between visits. The overflowing bar is line 97: slot("even in a bad run of years (93 of 100 pretend futures last)") is 59 characters x 0.55em wide with no max-width (slot at line 93; shared copy in careful.js line 73). Financial independence: modules/retirement/fire/view.js lines 105, 124, 137-139.
- fix: Smallest change that keeps the after-paint working out (round 5, so the page never freezes): (1) projection/view.js line 103: when the careful answer can still change the heading (!noCare && steady && verdict is not 'short' and not unknown), start the h1 with the neutral words and aria-busy, give it min-height of two lines, and set the real verdict inside the whenCareful callback (which already knows all three outcomes). (2) careful.js: keep the last answer in a module-level Map keyed by the inputs (JSON of buildInputs().inputs plus legacy) and call done() straight away when it is there. (3) slot(): add maxWidth: '100%' (both copies). (4) fire/view.js line 105: same neutral first heading, same reserved height. Not one shell change: two pages plus the shared helper.
- evidence: $SP/ux/j-hard-conditions/verify/v2-family-s4-0.png (first: 'The money lasts', bar off the card), $SP/ux/j-hard-conditions/verify/v2-family-s4-1.png (after: 'It lasts in most cases, not all'), $SP/ux/j-hard-conditions/verify/v2c-fire-first.png; scripts v2.mjs, v2b.mjs, v2d.mjs.

## p-retirement-a/R-A1 (severity 4, understand, scope several-pages, owner claude-b, confirmed)
**The verdict is shown before it is known, then changes: 'The money lasts' becomes 'It lasts in most cases, not all'**

- pages: retirement/projection, retirement/fire
- reach: retirement/projection for any plan whose bad-run odds are under 9 in 10 (family: yes; patLee, ruth: heading stays 'The money lasts'; sam, jordan: 'We don't know yet', no change). retirement/fire: the heading 'Ana could stop work at [grey blob]' becomes 'Ana would need to work until 67' (patLee: 'Pat could stop work now'). No heading change on retirement/withdrawal-strategy, retirement/monte-carlo, retirement/rmd, scenarios/goal-seek.
- steps: H.family(), from the Dashboard go to retirement/projection and read the big heading at once. Script $SP/ux/p-retirement-a/verify/a1.mjs records every change of the heading: node a1.mjs retirement/projection family [4 = phone 4x slower]. Same with retirement/fire.
- saw: Projection: 'The money lasts' from 52 ms to 1,509 ms (200 ms to 2,541 ms on a 4x slower phone), then 'It lasts in most cases, not all' with an amber 'short in a bad run' pill; the heading goes from one line to two, so everything below moves down 64 px. While waiting, one grey bar is 487 px wide and runs from x=31 to x=518 on a 390 px screen (the page is 518 px wide until the answer arrives). FIRE: 'Ana could stop work at [blob]' for 158 to 1,115 ms, then 'Ana would need to work until 67'. Correction to the walker: on FIRE the sentence 'stopping at 62 would do, with little to spare' stays in the final text, it is the heading that turns from 'could stop' to 'would need to work'.
- should: No verdict words until the careful run is in: the heading says 'Working it out...' (one line, same height), then the final words appear once. The average-case sentence under it may stay, it is labelled as such. No grey bar wider than its line.
- why: The first thing the eye lands on is the answer to the page's question, and for one to two and a half seconds it is the wrong one. Someone who glances and leaves takes 'The money lasts' with them; someone who stays sees the page change its mind.
- cause: modules/retirement/projection/view.js:103 draws the h1 from the average-markets result ('The money lasts' / 'It lasts, just') and lines 104-119 (whenCareful callback, 116-118) rewrite headline.textContent when the bad-run answer arrives. modules/retirement/fire/view.js:105-109 draws 'could stop work at' + slot and lines 124-139 replace it. modules/retirement/careful.js:73 slot() sizes the bar from the text length with no max width.
- fix: projection/view.js:103: when a careful run is pending and could change the heading (steady spending, verdict not 'short', not unknownYet, not noCare) create the h1 as 'Working it out...' with aria-busy and set its words only inside the whenCareful callback (the same four outcomes it already knows); if the run returns nothing, fall back to the average-case words there. fire/view.js:105: head = 'When could ' + Who + ' stop work?' until whenWorked answers. careful.js:73: add maxWidth: '100%' to the slot. Keeps the design (page drawn first, answer filled in after) and no log entry is touched.
- evidence: $SP/ux/p-retirement-a/verify/a1-projection-family-first.png, $SP/ux/p-retirement-a/verify/a1-projection-family-final.png, $SP/ux/p-retirement-a/verify/a1-fire-family-first.png, $SP/ux/p-retirement-a/verify/x4-waiting.png

## p-retirement-a/R-A3 (severity 4, input, scope page, owner claude-b, confirmed)
**Social Security: Save does not say when it could not read what I pasted, and says 'saved' when it removed my figure**

- pages: retirement/social-security
- reach: retirement/social-security, every person's fold. Pensions and Retirement settings refuse a negative at the box ('Use 0 or more.'); contributions too. This is the one page of the group whose boxes are not a form.
- steps: H.family(), retirement/social-security, Ana's fold is open. (a) Paste an earnings table the way a phone often copies one, one cell per line: 2024 / $69,000 / $69,000 / 2023 / $66,500 / $66,500, tap 'Save Ana's Social Security'. (b) Paste '2024 69000', '203 66500', '2022 61000' on three lines, Save. (c) Clear 'monthly benefit at full retirement age' (or type -5), Save. (d) Paste '2055 40000', Save. (e) Type 2700 in the benefit box and press Enter. Scripts: $SP/ux/p-retirement-a/verify/a3.mjs, a3b.mjs, x6.mjs.
- saw: (a) A green note under the button: 'Nothing to save: these are the figures already in the plan for Ana.' Nothing says the six lines could not be read; the same for 'hello world' and for amount-first lines. (b) Green 'Ana's Social Security saved.'; the box now holds 2022 and 2024 only, the mistyped line is gone without a word, status drops to $2,462 a month. (c) Green 'Ana's Social Security saved.' and the fold status goes from '$2,650 a month at 67' to 'nothing yet'. (d) Green 'saved', status '$0 a month at 67'. (e) Enter does nothing at all (nothingHappened). 99999 is saved as '$99,999 a month at 67'. Not reproduced as the walker wrote it: 'hello world' was not 'saved, box emptied': it stays in the box under 'Nothing to save'. Not a phone case: 'abc' and '1.2k' cannot be typed, the box brings up the number pad.
- should: Nothing readable in the box: a red line at the box, 'I could not find a year and an amount in what you pasted. Put one year on each line, like 2024 69,000.', and the text stays. Some lines unreadable: 'Saved 2 years. I could not read 1 line: 203 66500.' A year after this one: left out and said. A negative amount: 'Type the monthly amount, like 2,650.' An emptied box that had a figure: 'Removed: the plan now counts no Social Security for Ana.' with Undo, not 'saved'. Enter saves.
- why: Pasting the earnings record is what this page asks for. A person whose paste arrives in a shape the page cannot read is told in green that there was nothing to save, with no hint what to change; a person who clears the box, or mistypes one line, is told 'saved' while the plan now counts less or nothing for them, which moves every retirement answer.
- cause: modules/retirement/social-security/view.js:64-73: save() runs on a plain button (line 108), the boxes are not in a form so min=0 on line 61 is never checked and Enter does nothing; line 70 reads the amount as Number(value) || null and the record as parseRecord(text); line 73 answers 'Nothing to save' whenever the result equals what is on file, which is what an unreadable paste produces. modules/retirement/social-security/compute.js:78-87 parseRecord() skips every line that does not hold a year and an amount (continue) and reports nothing; a year and its amount on separate lines never match.
- fix: In view.js save(): count the non-empty lines of the box against parseRecord().length; none read: ui.notice('error', ...) in saidHere and return; some unread: add the count and the first unread line to the pending message; in compute.js parseRecord join a line that is only a year with the next line that is only an amount, and drop years after today's with a count; refuse typed < 0 with the red line; when the entry ends with neither record nor amount and one was on file, say 'Removed ...' and offer Undo (the setNone button pattern is already there); wrap the fields in ui.h('form', { onSubmit }) so the keyboard's Go saves. The fold-per-person design (log 2026-09-16, Pass 4 round 1, finding 4) is untouched.
- evidence: $SP/ux/p-retirement-a/verify/a3b-cells.png, $SP/ux/p-retirement-a/verify/a3-cleared.png

## j-first-freelancer/x-5 (severity 3, focus / understand, scope page, owner claude-b, confirmed)
**Step 4 of the path ('Will the money last?') greets someone with no birth date or accounts with an open form of seven technical boxes and four filled buttons**

- pages: retirement/projection
- reach: Everyone who reaches the retirement step or page before a birth date and an account are in the plan
- steps: H.empty() on a phone (390x844): open Get started, tap Let's go, Continue, I work, 'Myself: my business or freelance', Continue (pay left blank), then Skip on every question to the reveal; Next: Your month; Next: Emergency fund; Next: Your retirement.
- saw: Page 2,237 px. Filled buttons: 'Add Social Security' (y=422), 'People' (y=834), 'Save settings' (y=1819), 'Finish: see your plan' (y=2051). The 'Retirement settings' section is open by itself: 'Share in stocks now', 'Share in stocks once retired', 'How tax is worked out', 'Flat rate on money taken from pre-tax accounts', 'How much to take out each year', 'Starting withdrawal rate', between the two things the page actually needs and Finish. For H.family(), where the page has its answer, the same section is folded.
- should: The settings are folded here as everywhere else; one filled button for the first missing thing.
- why: A 'not sure' person at the last step meets a form they cannot answer and may think it has to be filled in before Finish.
- cause: modules/retirement/projection/view.js:282 `open: d.ready ? null : true` (open exactly when the page has nothing to show) and :50 (the empty state appends the settings card); :48 makes 'People' filled under the Social Security notice's own filled button.
- fix: view.js:282: `open: null`; :48: make the hero's three links outlined when the Social Security notice above carries the filled button (or the other way round: one filled in all). AGENTS.md design rule: technical sections go last, folded.
- evidence: $SP/ux/j-first-freelancer/verify/08-path-2.png, $SP/ux/j-first-freelancer/verify/24-step4-top.png (scripts v08, v24)

## j-first-renter/F4 (severity 3, next, scope several-pages, owner claude-b, confirmed)
**For someone with no retirement savings, steps 4 and 5 of the path say "we don't know" and then show a falling chart and exact figures anyway**

- pages: retirement/projection, scenarios/goal-seek, overview/guide
- reach: Steps 4 and 5 of the path for every household still working with no retirement or investment account and nothing going in. The other three steps of Sam's path are fine (Expenses 869 px, Emergency fund 1,572 px, Federal estimate 2,433 px with its answer as the heading).
- steps: H.empty(); answer as Sam; See where I stand; Next: Your month; Next: Emergency fund; Next: Your retirement; Next: What would help.
- saw: Step 4 "Will the money last?": 2,407 px, heading "We don't know yet", then a chart whose line drops to 0 at "retire", then nine blocks of "What goes into this" (Medigap Plan G, 15% tax on withdrawals); Next is at 2,221 px. Step 5 "Goal seek": 2,800 px; the top says "we can't say what it would take yet. Add what you own first" and right under it six cards give exact answers: "What you need to save: $210 a month", "What it is short today: $60,930", "When to claim Social Security: age 65"; Next is at 2,614 px. Corrections to the walker: the chips do work ("Leave $1,000,000" moves $210 to $730 a month, "Room for bad luck" to $810), and both pages have "Done? Go to Next ↓" at the top, so the way on is one tap, not two screens of scrolling. The link that fixes it is called "Net worth" on step 4 and "What you own ›" on step 5.
- should: With no retirement savings on file: step 4 is one short card ("You have no retirement savings in the plan yet. That is normal at 24. Add an account ›, or go on") with Next under it, no chart; step 5 (What would help) is left out of the path until there is a forecast to improve.
- why: A 24-year-old with no retirement account is shown a line crashing to zero and "$60,930 short" one line below "we can't say". He cannot tell which to believe or whether he must do something before going on.
- cause: modules/overview/guide/journeys.js:143 keeps the step when `retirementKnown && savingHelp`, without asking savingsUnknown(); modules/retirement/projection/view.js:103,131 change only the heading and first sentence for unknownYet and still draw the chart and "What goes into this"; modules/scenarios/goal-seek/view.js:73 prints the "can't say yet" sentence for d.noSavings and still draws every card.
- fix: journeys.js:143: add `&& !savingsUnknown(projection)` so the path has no "What would help" step for such a plan (the path already drops steps that do not apply). projection/view.js: when unknownYet, skip the chart card and keep "What goes into this" folded; name the link "What you own ›". goal-seek/view.js: when d.noSavings draw only the hero. No design-log rule is touched.
- evidence: $SP/ux/j-first-renter/verify/f4-step3-top.png, $SP/ux/j-first-renter/verify/f4-step3-full.png, $SP/ux/j-first-renter/verify/f4-step4-top.png, $SP/ux/j-first-renter/verify/f4-step4-full.png (scripts f4.mjs, f4b.mjs)

## j-heavy-waiting/W5 (severity 3, understand, scope several-pages, owner claude-b, confirmed)
**The verdict changes after you have read it, and the page then disagrees with itself**

- pages: retirement/projection, scenarios/goal-seek, retirement/fire
- reach: Wider than the walker wrote. Will the money last? (the main result page): for H.family() the big headline reads 'The money lasts' and 0.6 s later (2.4 s at 4x) becomes 'It lasts in most cases, not all' with an amber 'short in a bad run' pill; the buttons under it move down 32 px (431 -> 463, layout shift 0.03). patLee and ruth keep 'The money lasts'. Goal seek: the pill on 'What you can spend' goes from green 'room to spare' to amber 'tight' 0.7 s after the page (2.2 s at 4x); that card starts at 874 px on an 844 px screen, so the flip itself is rarely seen, but what stays is: headline 'Your plan works, with room to spare', card 'tight', and inside the card both '$400 less than the $7,000 the plan spends' and '$1,430 more than the $7,000 the plan spends'. Financial independence: the headline frame 'Ana could stop work at [grey bar]' becomes 'Ana would need to work until 67' (2.6 s at 4x). Checked and fine: How much to take out.
- steps: H.family(), phone, from the Dashboard open Will the money last? and watch the headline (node v5b-flip.mjs family 1; node v5-careful.mjs family retirement/projection 4). Goal seek: scroll to the first card (node v5c-card.mjs).
- saw: projection: 43 ms 'The money lasts' -> 610 ms 'It lasts in most cases, not all'. goal-seek: 421 ms pills 'room to spare, room to spare, room to spare' and 'about ... a month' -> 1,137 ms 'tight' and 'about $6,600 a month, $400 less than the $7,000 the plan spends'; the headline never changes.
- should: While the careful figure is being worked out, do not show a final-looking verdict in the place that can change: Will the money last? keeps the two-line height and says 'Checking a bad run of years...' in the headline slot (or shows the headline only once it is settled, the first sentence under it is already there); Goal seek shows a grey 'checking' pill and, when the careful figure is below the plan's spending, the headline reads 'Your plan works if markets are average' instead of 'with room to spare'; Financial independence starts 'Working out when Ana can stop work' and then states the age.
- why: 'The money lasts' is the sentence a person came for. Read it, look away, and it is a weaker sentence when you look back; on Goal seek 'room to spare' sits over 'tight'. Which one is true?
- cause: modules/retirement/projection/view.js line 103 draws the average-market headline and lines 115 to 118 replace headline.textContent inside whenCareful(); modules/scenarios/goal-seek/view.js carefulLine() (pill.className = 'pill warn'; 'tight') while the hero h1 (`d.meets ? 'Your plan works, with room to spare'`) is never revisited; modules/retirement/fire/view.js headline built around a slot. The wait itself is right (careful.js whenWorked slices the search, the page stays free): only the words are early.
- fix: Per page, small: (a) projection/view.js: when `steady && d.verdict !== 'short'` (the only case that can change) start the h1 as a grey slot of two lines' height and set its words in the whenCareful callback (or keep the words and reserve min-height: 2 lines so nothing below moves). (b) goal-seek/view.js: start the spending pill as a neutral 'checking' and in carefulLine, when less > 0, also set the hero h1 to 'Your plan works if markets are average'. (c) fire/view.js: neutral lead-in until the age is known. Not in docs/DESIGN_LOG.md, so nothing the owner chose is undone.
- evidence: $SP/ux/j-heavy-waiting/verify/w5-family-retirement_projection-s4-first.png ; $SP/ux/j-heavy-waiting/verify/w5-family-retirement_projection-s4-settled.png ; $SP/ux/j-heavy-waiting/verify/w5-goal-seek-first-card.png ; $SP/ux/j-heavy-waiting/verify/w5-family-retirement_fire-s4-first.png

## j-heavy-waiting/x-2 (severity 3, navigate, scope page, owner claude-b, confirmed)
**Stress tests: under 'If Ana died this year' the button says 'Social Security' and opens Life insurance needs**

- pages: scenarios/stress-tests
- reach: Both 'If <name> died this year' rows, for H.family() (Ana, Bo) and H.patLee() (Pat, Lee). The other eleven buttons carry the title of the page they open.
- steps: H.family(), phone, Stress tests. 'If Ana died this year' is open (it runs out at 69). Scroll to the button at its foot and tap it (node x3-label.mjs).
- saw: Button 'Social Security' -> lands on the page titled 'Life insurance needs' ('Ana needs about $312,000 more life insurance').
- should: The button reads 'Life insurance needs' (the title of the page it opens).
- why: The row that fails says the money runs out at 69; the one way on is labelled with something that does not sound like the fix, so the person may not tap it, and if they do they land somewhere they did not ask for. The destination is the right one; the words are wrong.
- cause: modules/scenarios/stress-tests/view.js linkLabel(): `if (s.id === 'disability' || s.id.startsWith('death-')) return 'Social Security'` while compute gives death rows `go: ['insurance', 'life-needs']`.
- fix: In fold(), take the label from the page it opens (pass ctx.modules: `modules.get(s.go.join('/'))?.title`) and delete linkLabel(), or return 'Life insurance needs' for death rows.
- evidence: $SP/ux/j-heavy-waiting/verify/x3-stress-button.png ; $SP/ux/j-heavy-waiting/verify/x3-stress-landed.png

## j-one-answer/A6 (severity 3, understand, scope page, owner claude-b, confirmed)
**'Can I retire at 62?' cannot be asked on the retirement answer page, and the place that answers it is behind a button that does not say so**

- pages: retirement/projection, scenarios/goal-seek
- reach: retirement/projection for every household that has a retirement age.
- steps: H.patLee() -> overview/quick -> 'Will my money last?'. Read the first screen and every box on the page; tap 'What would change it ›'.
- saw: The verdict is tied to 'Retirement starts in 2030 (Pat at 65)'; lower down 'Pat: retires at 65, plan to 95'. No age box among the eight controls (spending, stocks now, stocks retired, tax, flat rate, how much to take out, starting rate, a health checkbox) and no link to where the age is set. 'What would change it ›' opens Goal seek, which says 'When Pat can retire: age 61 ... the money already lasts if Pat stopped this year': the answer exists, two taps from Quick answers, about one screen down, under a label that does not mention age.
- should: Next to 'Retirement starts in 2030 (Pat at 65)' a link 'Change the age ›' to People (the one-page '‹ Back to: Will my money last?' already works from here), and the first button reads 'Could you stop sooner? What would change it ›'.
- why: Confirmed on screen. The walker did not open 'What would change it'; it holds the answer, so this is a labelling and link gap rather than a missing feature. No design-log entry covers it.
- cause: modules/retirement/projection/view.js: the 'Retirement starts in ...' line and the People record at :168 are plain text; the age lives on household/people.
- fix: Two links, no new maths and no new box: the age line links to #/household/people, and the goal-seek button's label names the question it answers.
- evidence: $SP/ux/j-one-answer/verify/v8-patLee-projection.png; v10-goal-seek.png (scripts v8.mjs, v10.mjs)

## j-one-answer/x-3 (severity 3, next, scope page, owner claude-b, confirmed)
**'It needs a few things first': the filled button is always 'People', even when People is done and the one thing missing is typed right below**

- pages: retirement/projection
- reach: retirement/projection while the plan is being filled in, with or without a guide.
- steps: H.empty() -> 'Will the money last?' (menu, or step 3 of the retire guide) -> People: add Marcus with a birth date -> Back -> Accounts: add a 401(k) of 450k -> Back.
- saw: The list of needs shrinks correctly (3 -> 2 -> 1: 'what you will spend in retirement (a figure here, or your expenses on the Expenses page)'), but the buttons stay People (filled), Accounts, Expenses. With only the spending figure missing, the first screen has two filled buttons, 'Add Social Security' and 'People', and neither is the next step; 'a figure here' means the Retirement settings box one card down.
- should: The filled button is the first thing still missing; done ones go (or get a tick). When only spending is missing: one filled 'Type what you'll spend ↓' that opens Retirement settings and puts the cursor in the box.
- why: This is the last screen before the verdict on the from-scratch path to 'Can I retire at 62?' (5 screens, about 15 taps); its only filled button in the answer card leads to a page already done.
- cause: modules/retirement/projection/view.js:46-48: the three buttons are fixed, with People always the filled one, whatever d.missing holds.
- fix: Build the row from d.missing: first missing = filled, the rest outlined, none for what is done; for the spending figure reuse the guide frame's 'Show me where' behaviour (open the fold, scroll, focus).
- evidence: $SP/ux/j-one-answer/verify/v22-needs-spending-people-filled.png; v18-step3-verdict.png (scripts v22.mjs, v18.mjs)

## p-retirement-a/R-A5 (severity 3, next, scope page, owner claude-b, confirmed)
**First open of Will the money last?: under the 'add these first' card sits an open form of seven boxes in finance words**

- pages: retirement/projection
- reach: retirement/projection with no plan (H.empty()); the other five pages of the group show no form before there is something to work with, except Pensions, whose add form is the point of the page.
- steps: H.empty(), open retirement/projection. Script: $SP/ux/p-retirement-a/verify/a5.mjs.
- saw: First screen: the hero with three things it needs and the buttons People (filled), Accounts, Expenses. Directly under it 'Retirement settings' is open: Spending in retirement, Share in stocks now (70), Share in stocks once retired (50), How tax is worked out ('A flat rate on pre-tax withdrawals'), Flat rate on money taken from pre-tax accounts (15), How much to take out each year, Starting withdrawal rate (4), and a second filled button 'Save settings' at y=1417. The page is 1,607 px long instead of one screen.
- should: With nothing in the plan the settings stay folded like on a full plan (status 'optional'), and the hero's third bullet says where a figure can be typed: 'under Retirement settings below'.
- why: The hero says 'go to People', the form under it says 'fill me in'. A first-time person cannot tell which comes first and does not know what a pre-tax withdrawal or a withdrawal rate is.
- cause: modules/retirement/projection/view.js:282: open: d.ready ? null : true opens the settings fold whenever the projection cannot run.
- fix: Line 282: never open by default (open only after its own save, see R-A4); line 283: status 'optional' when there is no figure. One line, no other page.
- evidence: $SP/ux/p-retirement-a/verify/a5-empty-projection.png

## p-retirement-a/R-A8 (severity 3, understand, scope several-pages, owner claude-b, confirmed)
**A page title used as a noun in the middle of a sentence: 'Will the money last? adds these every year until each person retires.'**

- pages: retirement/contributions, retirement/projection
- reach: On screen: the contributions hero (H.family()), and on Will the money last? the line 'Chance the money lasts and If history repeated show the range around it.' Still in the repo head (6fc5299, modules/retirement/contributions/view.js:106), so the wording sweep did not catch it.
- steps: H.family(), open retirement/contributions and read the second sentence of the hero. Script: $SP/ux/p-retirement-a/verify/a8.mjs.
- saw: '$15,820 of your own money and $3,050 from employers. Will the money last? adds these every year until each person retires.' Two lines lower the same words are a link, 'Will the money last? >', 131x16 px, the only small target on the page.
- should: 'The plan adds these every year until each person retires.' and one 44 px outlined button 'See if the money lasts'.
- why: It reads as a question put to me, followed by half a sentence. It is the first paragraph of the page.
- cause: modules/retirement/contributions/view.js:106 (the lede string) and :123 (inline <a> 'Will the money last? >'); modules/retirement/projection/view.js (the 'show the range around it' line).
- fix: Reword line 106 as above; line 123: ui.row(ui.h('a', { class: 'btn secondary', href: '#/retirement/projection' }, 'See if the money lasts')); projection: 'Two more pages, Chance the money lasts and If history repeated, show the range around it.'
- evidence: $SP/ux/p-retirement-a/verify/a8-contrib-hero.png

## p-retirement-b/RB4 (severity 3, understand, scope page, owner claude-b, confirmed)
**Year by year: the bold figure on every row has no label; its meaning is one line after the last row**

- pages: retirement/cash-flow, retirement/roth-conversions (year list inside 'How this is worked out')
- reach: cash-flow (whole page), roth-conversions (one folded list)
- steps: ruth: open retirement/cash-flow on the phone and read the first row.
- saw: Row: '2026 - age 72' on the left, '$450,880' bold on the right, then '$30,600 spent - $37,200 guaranteed income - $0 from savings - $0 tax'. Nothing on the row or above the list says $450,880 is what is left. The only explanation, 'Left = every retirement account together at the end of that year', is at y 3041 of 3238 px, after 24 rows (family: after 31 rows, page 4,428 px). sam: a red '$0' with no label. The Roth page's folded year list has the same shape ('2030 - ages 65 / 63   $21,005') and its lead-in talks about 'Income before', a column that exists only in the desktop table.
- should: '$450,880 left' on the row (or 'Left $450,880'), and the one-line key moved above the list. Roth fold: '$21,005 to convert', and the lead-in without 'Income before' on a phone.
- why: Reproduced for ruth, family and sam. The largest figure on each row is the one nobody can name without scrolling 3,000 px; it reads like that year's income or spending. Kept at 3.
- cause: modules/retirement/cash-flow/view.js:44 (rec-value is money(r.end.total) alone) and :48 (the key is the card's last line); modules/retirement/roth-conversions/view.js:206-208.
- fix: Two words in the rec-value and move one <p> up, in each of the two views.
- evidence: $SP/ux/p-retirement-b/verify/rb4-ruth-cf-records.png; $SP/ux/p-retirement-b/verify/sv-sam-cash-flow.png; $SP/ux/p-retirement-b/verify/roth-fold-years.png

## p-retirement-b/x-4 (severity 3, next, scope page, owner claude-b, confirmed)
**Withdrawal order names the best order but its button is over a screen down, and the step that makes the choice count has no link**

- pages: retirement/withdrawal-order
- reach: withdrawal-order, every household still on the flat rate (the default)
- steps: family: open retirement/withdrawal-order. Read the first screen. Scroll to the first 'Use this order' (y 1037) and tap it. Scroll back to the top.
- saw: First screen (844 px): headline '"Pre-tax, then taxable, then Roth" works best for you', and zero controls; the three buttons, all labelled 'Use this order', are at y 1037, 1234 and 1412. After the tap: 'The plan now draws pre-tax, then taxable, then roth.' and the headline 'Your order is the best one for this plan', but the blue box still says 'The projection itself still uses a flat tax rate, where the order makes no difference. Switch it to the federal brackets in the settings on Will the money last? to make the chosen order count.' with no link or button (plan.retirement.taxMode stays 'flat'). Reproduced twice.
- should: First card: a filled 'Use this order' for the best one when it is not yours. The blue box in plain words with its own button: 'Your plan works out tax at one flat rate, so the order changes nothing yet.' [Work out tax at the real rates] (sets it, confirms with the same sentence the Roth page uses).
- why: The page tells the person their choice changes nothing until they do something else, in builder's words ('the projection', 'federal brackets'), and leaves them to find a select inside a fold at the bottom of another page. Most will think they are done. The Roth page does this right: one filled button in the first card, and it switches the tax setting with the choice and says so.
- cause: modules/retirement/withdrawal-order/view.js:17-23 (hero has no button), :27 (notes drawn as plain text), :32; modules/retirement/withdrawal-order/compute.js:34 (the note's words).
- fix: Add the hero button (as roth-conversions/view.js:139 does) and turn the taxMode note into a notice with one outlined button that writes p.retirement.taxMode = 'brackets'.
- evidence: $SP/ux/p-retirement-b/verify/wo-family-0.png; $SP/ux/p-retirement-b/verify/wo-family-use-1-top.png

## p-retirement-c-scenarios/x-annuity-added-not-shown (severity 3, next, scope page, owner claude-b, confirmed)
**Annuities on a plan without the basics: "added", and the quote is nowhere**

- pages: retirement/annuities
- reach: Annuities. Advisor's plan does the same on a blank plan (RC-1).
- steps: H.empty() (first open) or H.samMidSetup(), retirement/annuities. Type Quote = Income at 65, You pay 100,000, It pays a month 550, tap Add quote. Do it again.
- saw: "Income at 65 added." The form is empty again and no quote card appears; "On whose life" is an empty list. The second add stores a second identical quote, still invisible (2 stored, 0 shown). Both turn up later, once the plan has a birth date, accounts and spending.
- should: Until the plan has the basics the page shows what is missing as links (People, What you own, Expenses) and no form; or it lists saved quotes with "waiting for your plan's basics".
- why: The page says it worked and shows nothing, so the person adds it again; later two identical quotes appear from nowhere.
- cause: modules/retirement/annuities/compute.js:30 returns quotes: [] when the plan is not ready, while view.js:42 and :75-97 still draw the add form and save into the plan.
- fix: In view.js: when !d.ready, show the missing list with links and skip the form (the hero already explains the page).
- evidence: $SP/ux/p-retirement-c-scenarios/verify/x5-blank-annuity.png (scripts x5.mjs, x5b.mjs)

## p-retirement-c-scenarios/x-stress-link-wrong-name (severity 3, navigate, scope page, owner claude-b, confirmed)
**Stress tests: the button "Social Security" under "If Ana died this year" opens Life insurance needs**

- pages: scenarios/stress-tests
- reach: Stress tests, one button per adult in a couple.
- steps: H.family(), scenarios/stress-tests. "If Ana died this year" is open (it runs out). Tap the outlined button "Social Security" at the end of that section.
- saw: It opens the page titled "Life insurance needs" ("Ana needs about $312,000 more life insurance"). The section's own text points there too ("Life insurance needs works it out"). The "Social Security" button under "Ana can never work again" does open Social Security.
- should: The button reads "Life insurance needs".
- why: A link should say where it goes; here the same words lead to two different pages on one screen.
- cause: modules/scenarios/stress-tests/view.js:101: linkLabel() returns "Social Security" for every death- shock, while compute.js:154 sends that shock to insurance/life-needs.
- fix: In linkLabel: death- returns "Life insurance needs"; only disability returns "Social Security".
- evidence: $SP/ux/p-retirement-c-scenarios/verify/x1-death-fold.png, x1-landed.png (script x1.mjs)

## p-retirement-c-scenarios/RC-6 (severity 3, next, scope page, owner claude-b, confirmed)
**How long to plan for says plan to 96 while the plan runs to 95, with nothing to tap to change it**

- pages: retirement/longevity
- reach: How long to plan for.
- steps: H.ruth(), retirement/longevity.
- saw: Headline "Plan to about 96"; tile "96, 1 in 10 reach, the plan runs to 95". The only controls are Sex, Health, Save and the shell's Continue row. For a couple (H.family()) the last card says in plain text: Set "Plan to age" on the People page; no link.
- should: Under the tiles, when the two ages differ: an outlined button "Plan to 96 instead of 95" that changes it on the tap and confirms "Your plan now runs to 96."; and "People page" as a link.
- why: The page gives advice and no way to act on it; a single person is not even told where the setting lives.
- cause: modules/retirement/longevity/view.js:25 (the tile only states the two ages) and :33 (plain text, couples only).
- fix: Add the button (store.update sets that person's lifeExpectancy to p.planTo, with a pending notice) and make the People mention a link. The figure reaches the plan only on the tap.
- evidence: $SP/ux/p-retirement-c-scenarios/verify/rc5-ruth-full.png (script rc5.mjs)

## p-retirement-c-scenarios/RC-5 (severity 3, back, scope page, owner claude-b, confirmed)
**How long to plan for: picking Sex or Health does nothing until Save, and is dropped if you leave**

- pages: retirement/longevity
- reach: How long to plan for (one pair of lists per adult).
- steps: H.family(), retirement/longevity. Change Ana's Health to "better than most". Tap "Continue your plan", then the phone's Back.
- saw: After the choice: no figure moves, no message (the page text is identical). After Continue and Back: Health is "about average" again. Save (outlined, 70x44) does work: the note "Bo's details saved." shows at the bottom, the tiles change (81 and 95 -> 77 and 91) and the screen stays put.
- should: The choice saves itself and the figures change at once, with the usual confirmation, as the Medicare checkbox does.
- why: A choice from a list looks set once it shows in the box; the person leaves believing the page used it.
- cause: modules/retirement/longevity/view.js:22-28: the two selects have no change handler; only the separate Save button writes the plan.
- fix: Give both selects an onChange that runs the same store.update with the confirmation, and remove the Save button (the shell keeps the place and shows the note).
- evidence: $SP/ux/p-retirement-c-scenarios/verify/rc5-family-changed.png, rc5b-saved-bo.png (scripts rc5.mjs, rc5b.mjs)

## p-retirement-c-scenarios/RC-8 (severity 3, understand, scope several-pages, owner claude-b, confirmed)
**"Does the money last? Yes" sits right above "Chance it lasts 37%"**

- pages: scenarios/compare, scenarios/advisor-plan
- reach: Compare what-ifs (seen) and Advisor's plan (same row in the code).
- steps: H.family(), scenarios/compare, tap "+ Retire 3 years earlier".
- saw: The new card: "Does the money last? Yes", then "Chance it lasts 37%, -40 pts", "Left at the end $31,690". The card never says that Yes means markets doing exactly as well as average.
- should: One answer per card: the chance first, and the other row worded as what it is, "If markets do as well as average: lasts" (or "runs out in 2071").
- why: Yes and 37% answer the same question in opposite ways; the person takes whichever they prefer.
- cause: modules/scenarios/compare/view.js:67 and modules/scenarios/advisor-plan/view.js:46: the first row is the straight-line run's success flag with a yes/no label.
- fix: Reword and reorder those two rows (wording only; no change to the figures).
- evidence: $SP/ux/p-retirement-c-scenarios/verify/rc8-card.png (script rc8.mjs)

## j-heavy-waiting/W7 (severity 2, understand, scope page, owner claude-b, confirmed)
**Two figures for the same chance: 80% on Chance the money lasts, 78% for 'Your plan' on Scenario compare**

- pages: scenarios/compare
- reach: Only Scenario compare's 'Your plan' card differs (78%); Chance the money lasts says 80% and Will the money last? says '8 of 10 pretend futures (80 of 100)'. If history repeated is a different question and says so. Borders on money math (other agents own that): kept only as a 'which is my number' problem.
- steps: H.family(), phone. Chance the money lasts: 80%. Scenario compare, tap '+ Save $500 more a month': 'Your plan: Chance it lasts 78%'.
- saw: 78% on the card every other card is measured against; the reason ('over 400 pretend futures') is in small grey text above.
- should: The unchanged plan shows the same figure everywhere, or both pages say 'about 8 in 10'.
- why: Someone who has just read 80% sees 78% for the unchanged plan and wonders which is right. Two points, so a pause, not a wrong decision.
- cause: modules/scenarios/compare/compute.js line 11 `export const PATHS = 400` against 2,000 on retirement/monte-carlo.
- fix: compare/compute.js: take the 'Your plan' chance from the same 2,000 draw the Chance page uses (one extra run, about 0.2 s once W2's hidden run is gone) and keep 400 for the copies' differences; or show both as 'about 8 in 10'.
- evidence: $SP/ux/j-heavy-waiting/verify/w3-same-spot-s1-after.png

## j-heavy-waiting/x-3 (severity 2, smooth, scope page, owner claude-b, confirmed)
**Will the money last?: while it works, a grey waiting bar pokes out of the card and the whole page becomes 518 px wide**

- pages: retirement/projection
- reach: H.family(), H.patLee(), H.ruth(): 3 of 3. Lasts 0.15 to 0.6 s at normal speed, about 2.4 s on a processor four times slower. Not for H.jordan() (no careful line).
- steps: Any of the three households, phone, open Will the money last? from the Dashboard and look at the first second (node v5b-flip.mjs family 1; picture from v5-careful.mjs family retirement/projection 4).
- saw: Grey bars end at 97, 204 and 518 px on a 390 px screen; document scroll width 518 until the figure arrives, then 390. In the picture the long bar runs past the card's edge to the side of the screen with a lone '.' under it.
- should: Waiting bars never exceed the line they sit in.
- why: For a moment the page can be dragged sideways and looks broken, right at the top of the most important result page.
- cause: modules/retirement/projection/view.js line 93 slot(): `display: inline-block; width: ${String(like).length * 0.55}em`, and line 97 passes a 60-character sample ('even in a bad run of years (93 of 100 pretend futures last)'), about 33em, which cannot wrap. The same helper is exported from modules/retirement/careful.js.
- fix: Add `maxWidth: '100%'` to the slot style in projection/view.js and careful.js (or pass a shorter sample on line 97).
- evidence: $SP/ux/j-heavy-waiting/verify/w5-family-retirement_projection-s4-first.png

## j-one-answer/A9 (severity 2, smooth, scope page, owner claude-b, confirmed)
**Retirement answer: a grey placeholder bar 487 px wide makes the page 518 px wide until the figure arrives**

- pages: retirement/projection
- reach: retirement/projection only; retirement/fire, withdrawal-strategy and rmd use bars the length of a figure.
- steps: H.patLee() -> overview/quick -> tap 'Will my money last?', sample the page every 60 ms.
- saw: From about 90 ms to 480 ms (1.5 s with the processor slowed 4 times, a mid-range phone) three grey bars stand in for figures; the third is 487 px wide and ends at x 518 on a 390 px screen, so the page can be dragged sideways. When the figures arrive the two buttons under the text move up 22 px (layout shift 0.009).
- should: No bar wider than its card; nothing moves when the figure arrives.
- why: Reproduced at normal and phone speed. Short and harmless, but it is the first half second of the app's most asked answer.
- cause: modules/retirement/projection/view.js:93 and :97: slot('even in a bad run of years (93 of 100 pretend futures last)') is an inline-block 60 x 0.55em = 33em wide with no max-width, and cannot wrap.
- fix: Add maxWidth: '100%' to the slot style (also modules/retirement/careful.js:73) and use a stand-in the length of the usual words ('in every pretend future we ran').
- evidence: $SP/ux/j-one-answer/verify/v9-bars-slow4.png (the bar runs off the right edge); v9-bars-slow1.png (script v9.mjs)

## p-retirement-b/x-5 (severity 2, choreography, scope page, owner claude-b, confirmed)
**How much to take out: a button and a paragraph arrive late and push the three 'Use this one' buttons down 66 to 121 px**

- pages: retirement/withdrawal-strategy
- reach: withdrawal-strategy
- steps: family: open retirement/withdrawal-strategy and watch the first card for two seconds (ruth and patLee: same, smaller).
- saw: The page appears with a grey placeholder for one figure. 0.7 s later (2.3 s with the processor slowed four times, about a mid-range phone) 'Plan on $6,600 a month' and a paragraph are added: page 1494 -> 1616 px, the first 'Use this one' moves from y 878 to 999 (family, 121 px; ruth 747 -> 813; patLee 789 -> 855), layout shift 0.055. My own first tap on 'Use this one' landed in that moment and hit plain text. It repeats after Back (lands at 650, then 771).
- should: The room for the late line and button is held from the first paint (or they replace the placeholder in place), so nothing below moves.
- why: Real but narrow: the buttons are just below the first screen, so a person has to scroll and tap within about two seconds of opening. Kept at 2.
- cause: modules/retirement/withdrawal-strategy/view.js:111-133: whenCareful() fills careLine2 and planOn after the heavy figure is ready; the comment at :124-125 says the placeholder height is held only when nothing comes below.
- fix: Give planOn and careLine2 a min-height while the figure is being worked out when the plan may be under (c unknown yet), and release it when the answer needs no button.
- evidence: $SP/ux/p-retirement-b/verify/ws-family-0.png; $SP/ux/p-retirement-b/verify/ws-family-1-after-first.png

## p-retirement-c-scenarios/RC-9 (severity 2, understand, scope page, owner claude-b, confirmed)
**Annuities: a quote that costs more than your savings shows 0.0% and $0 a month with no reason**

- pages: retirement/annuities
- reach: Annuities, only for a quote larger than the household's savings.
- steps: H.family(), retirement/annuities, Quote = Q, You pay 250,000, It pays a month 1,200, Add quote.
- saw: "Chance the money lasts 76.3% -> 0.0%", "Could spend a month $8,430 -> $0", "Left at the end $871,110 -> $179,140". Narrower than reported: the family has about $193,000 in accounts, so the quote cannot be paid. With 100,000 for 550 the rows are sensible (65.7%, $7,860, $501,890), and H.patLee() with 250,000 is sensible too.
- should: In place of the table: "This quote costs $250,000 and your savings are about $193,000, so the plan cannot pay for it today. Try a smaller sum."
- why: Three zeros beside $179,140 left read as a broken page; the real message (you do not have that much) is never said.
- cause: modules/retirement/annuities/compute.js:65 takes the whole premium out in the first year whatever the savings; view.js:53-59 prints the rows bare.
- fix: View: when the premium is more than the savings on file, show the sentence instead of the table. The engine side belongs to the money review.
- evidence: $SP/ux/p-retirement-c-scenarios/verify/rc9-family.png, rc9-family-top.png (scripts rc9.mjs, rc9b.mjs)


# SH-WAYBACK: Pages opened from a list (Needs attention, Next best action, Quick answers, an answer's missing numbers) have no way back on screen

3 verified findings (each reproduced on screen by an independent skeptic). Scripts and pictures for a finding `<walker>/<id>` are in `$SP/ux/<walker>/` and `$SP/ux/<walker>/verify/`.

## j-monthly-return/MR-4 (severity 3, back, scope several-pages, owner claude-b pages (overview/alerts, overview/next-best-action, balance/net-worth, overview/guide), confirmed)
**Pages opened from Needs attention, from Next best action and from Net worth's 'Update all balances at once' have no way back on screen; only the phone's Back returns**

- pages: overview/alerts (6 of 6 rows: balance/liquidity, taxes/withholding, insurance/life-needs, balance/liabilities, estate/documents, goals/goals), overview/next-best-action ('Open the page' and every row of The order), balance/net-worth > balance/update when opened from the check-in
- reach: the two hubs of the monthly visit; the hubs that do pass a way back are the check-in (from=review), Your plan (from=plan) and Quick answers (from=quick)
- steps: H.family(): #/overview/monthly-review > step 7 (alerts opens with '‹ Back to the November 2026 check-in') > tap each of the six rows and look for a back link (v5.mjs). #/overview/next-best-action > 'Open the page' (v11.mjs). Check-in > step 1 > 'Update all balances at once' (v15.mjs).
- saw: All six alert destinations: no '‹ Back to …' link, address without from=. Next best action > Life insurance needs: none. Check-in > Net worth > 'Update all balances at once' lands on #/balance/update with the check-in link gone (two phone Backs to return).
- should: '‹ Back to Needs attention' / '‹ Back to your next step' at the top of a page opened from those lists, and the check-in's back link carried one page further (as the guide's trail already does for quick answers).
- why: She fixes one thing and looks for the list she came from; the only link under the page is 'Continue your plan', which is somewhere else. With x-back-top the phone's Back then drops her at the top of the list.
- cause: modules/overview/alerts/view.js:12 ctx.go(a.go[0], a.go[1], [], a.query ?? {}) passes no from; modules/overview/next-best-action/view.js:62 and :98 build plain hrefs; modules/balance/net-worth/view.js:141 links to #/balance/update without the review query; modules/overview/guide/compute.js:271 knows only from=review (and quick, plan).
- fix: Add two 'from' values to the frame (guide/compute.js barFor and frame.js beside the review branch at :188): from=alerts -> '‹ Back to Needs attention', from=next -> '‹ Back to your next step'; pass them from alerts/view.js:12 and next-best-action/view.js:62/:98; net-worth/view.js:141 keeps ctx.route.query.from/review on its link. Use the x-backlink-history click handler so these links go back in history.
- evidence: $SP/ux/j-monthly-return/verify/v5-row3-dest.png ; $SP/ux/j-monthly-return/verify/v11-visa-dest.png ; $SP/ux/j-monthly-return/verify/v15-update-from-checkin.png

## j-navigator/x-5 (severity 3, back, scope shell, owner shell, confirmed)
**Nothing on the screen goes back, except on pages opened from Your plan; as a home-screen app there is no browser Back button either**

- pages: balance/net-worth, balance/liquidity, balance/liabilities, taxes/federal, debt/payoff, system/settings, every page not opened from Your plan or a guide
- reach: 8 of 9 pages reached by a Dashboard tile or the menu had no on-screen way back
- steps: H.family(), Dashboard, tap the Net worth tile. Look for a way back on the screen.
- saw: The top bar holds Menu, the title and the pill; the page has no Back. Same on Emergency fund, Debts, Federal estimate, Pay off debts, Settings. Only a page opened from Your plan shows '‹ Your plan' at the top and '‹ Back to your plan' at the bottom (and that lands at the top of Your plan, see N1). The app is set up to run without the browser's bars (index.html line 16, manifest.webmanifest 'display: standalone') and docs/NETWORK.md tells the owner to add it to the home screen, where Safari's Back button does not exist.
- should: A '‹' button, 44 px, in the top bar next to the title whenever there is an earlier page in this visit; it does exactly what the phone's Back does and, with N1 fixed, returns to the same spot.
- why: 'Easy to go back' is one of the owner's four. Without a visible Back the only routes are an edge swipe the person may not know, or Menu > Dashboard, which starts again at the top.
- cause: index.html lines 82-85: the top bar has only #nav-toggle, #page-title and #status; core/app.js keeps no count of pages visited in this visit, so it cannot know whether Back would stay inside the app.
- fix: Shell: add `<button id="nav-back" aria-label="Back" hidden>‹</button>` to the top bar; in show() unhide it when the entry number from N1 is above 0; click -> history.back(). No design-log entry covers the top bar's buttons beyond the pill's words and the cross on the menu button, which stay.
- evidence: $SP/ux/j-navigator/verify/x3-from-plan.png (the one kind of page that has a way back); script x3.mjs. Check on the owner's iPhone, opened from the home-screen icon: Dashboard > Net worth, is there any visible way back, and does a swipe from the left edge go back?

## j-one-answer/A3 (severity 3, back, scope several-pages, owner claude-b, confirmed)
**The page an answer sends you to for its missing numbers has no way back to the answer**

- pages: retirement/projection, debt/payoff, insurance/life-needs, overview/benchmarks, retirement/fire, goals/house, household/people, balance/net-worth, balance/liabilities, cashflow/expenses, cashflow/income, overview/guide/*
- reach: Every answer page with a 'needs first' card on an empty or half-filled plan, reached by the menu or search; guides opened from Quick answers.
- steps: H.empty() -> open 'Will the money last?' from the menu (Retirement) -> tap 'People' on its 'It needs a few things first' card -> add Marcus, a birth date, retirement age 62 -> look for the way back to the answer. Repeat with 'Accounts'. Also: H.empty() -> overview/quick -> 'When will I be debt-free?' -> 'Do step 1'.
- saw: People opens with no link back; after 'Marcus added.' the only way on at the bottom is 'Continue your plan: step 1 of 4 › The questions' (the build-my-plan questions), before adding it is 'Start your plan: a few easy questions ›'. Only the phone's Back returns to the answer (it does, with the needs list updated). Same on debt/payoff ('Add your debts' -> Debts), insurance/life-needs and overview/benchmarks (-> People), retirement/fire (-> Expenses), goals/house (-> Income): six of six. Guides opened from Quick answers show no '‹ Quick answers', and 'Do something else' goes to Get started; phone Back returns to Quick answers at the same scroll (958). Step 1 of the debt guide is the page titled 'Net worth' with a form that starts on 'Checking', under a bar that says 'Pay off what I owe · Step 1 of 3 · Add each loan and card'.
- should: A page opened from an answer's 'needs first' button shows '‹ Back to: Will the money last?' at the top, and after its save one button 'Back to: Will the money last? ›', the way a page opened from a quick answer already shows '‹ Back to: <the question>'.
- why: Confirmed for the menu and search route, six pages. Refuted in part: the guides DO end on the answer (debt guide step 3 is 'Debt-free by August 2034' on its first screen, 5 screens and 13 taps from Quick answers; retire guide step 3 is 'Will the money last?'), so 'never to the answer' is wrong. Nothing is lost and the phone's Back works, so 3, not 4.
- cause: modules/retirement/projection/view.js:48 (plain links to #/household/people and the like, the same in the other five pages); modules/overview/guide/frame.js:165-171 writes the one-page back trail only for a page opened with ?from=quick; modules/overview/guide/view.js:145 'Do something else' is fixed to #/overview/start.
- fix: One addition in modules/overview/guide/frame.js: honour a ?back=<group/id> query like the quick trail ('‹ Back to: <page title>' on top, the same as the one way on after a save), and the six needs-first cards add ?back= to their links. The bottom row and the path rule of 2026-11-06 stay as they are.
- evidence: $SP/ux/j-one-answer/verify/v22-people-bottom.png; v22-empty-projection.png; v3-step1.png; v5d-step3-answer.png (scripts v22.mjs, v23.mjs, v3.mjs, v5d.mjs)


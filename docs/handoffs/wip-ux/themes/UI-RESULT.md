# UI-RESULT: After Compare, Work it out or Save the answer is above or below the screen

6 verified findings (each reproduced on screen by an independent skeptic). Scripts and pictures for a finding `<walker>/<id>` are in `$SP/ux/<walker>/` and `$SP/ux/<walker>/verify/`.

## j-one-answer/A1 (severity 4, focus, scope several-pages, owner claude-b, confirmed)
**Federal estimate: after you type a figure and save, the tax it changes is 1,300 to 1,500 px above the screen**

- pages: taxes/federal, goals/house, retirement/projection (see x-2)
- reach: taxes/federal for every household; goals/house; retirement/projection (worse, x-2). Checked and clean: debt/payoff, taxes/withholding.
- steps: Empty plan: H.empty() -> overview/quick -> 'What will I owe in tax this year?' (opens the taxes guide) -> step 3 'Estimate this year's tax' -> scroll to 'Wages this year', type 85,000, tap 'Save figures'. Finished plan: H.patLee() -> overview/quick -> 'What will I owe in tax this year?' -> open 'Figures the plan cannot see' -> type 9,000 in 'Federal tax withheld so far' -> Enter.
- saw: Empty plan: the wages box is at y 1,959 of a 3,735 px page (y 1,733 without the guide bar); the four tiles do not change while typing or on leaving the box; after Save the screen stays put (scrollBy 0), the tiles now read $9,870 / 11.6% / 22% / $68,900 but sit 1,496 px above the screen; only a bottom strip 'Figures saved.' shows. patLee: Enter saves, the fold closes, the screen jumps 846 px and lands on the closed folds and 'Another question?'; the headline is 1,323 px above. goals/house does the same in a milder way (Work it out folds 'The figures', screen jumps 466 px and lands on 'Cash needed at closing', the headline above). Not on debt/payoff (box and answer on one screen) or taxes/withholding (fold stays open).
- should: Keep the place (the app's 'Saving keeps your place' rule), but say the answer where the eye is: the green message and its bottom strip read 'Figures saved. Federal tax for 2026 is now about $9,870.'; the fold that was just saved stays open so the screen does not jump.
- why: Reproduced twice (empty plan through the guide, finished plan from Quick answers). The person typed the one figure asked for and the screen shows no tax number; on a finished plan the screen also jumps 846 px.
- cause: modules/taxes/federal/view.js:173 (the save says only 'Figures saved.'), :178 (the fold is drawn closed on every redraw once the plan has income), hero and tiles at :76-:96 above 1,200+ px of table; core/app.js:205-218 keeps the scroll on a save by design.
- fix: Per page, no shell change: put the new headline figure into the save's message (the shell's echo already repeats it at the bottom of the screen), and keep the fold open on the redraw that follows its own save. Same two lines on goals/house ('Saved. A $350,000 home: about $X a month.').
- evidence: $SP/ux/j-one-answer/verify/v1a-federal-after-save.png; v16-patLee-federal-after-save.png; v15-empty-house-after.png (same folder; scripts v1.mjs, v16.mjs, v15.mjs)

## p-debt-property/DP-1 (severity 4, focus, scope shell, owner shell (core/app.js); claude-b for the new-card scroll on property/rental and property/vehicles, confirmed)
**After Compare, Save or Add the page gets shorter and the screen lands at the bottom, with the new answer off screen above**

- pages: property/rent-vs-buy, property/renovation, property/home, property/rental, property/vehicles
- reach: Every page whose form fold is drawn open until the first save and sits below its result. Seen on the five listed. Checked and NOT affected: property/purchase (the answer heading stays in view at 137 px), debt/credit-cards and debt/consolidation (result and fold summary stay in view), debt/refinance.
- steps: H.family(), open property/rent-vs-buy at 390x844. The 'The figures' form is already open. Type 450000 in 'Home price', scroll down to Compare, tap it. Same shape: property/renovation, type 45,000 in 'What it will cost', Compare; property/home, type 310,000 in 'What you paid' and 2019 in 'Year you bought it', Save; H.empty() property/rental, Name Flat, worth 250,000, rent 1,800, Add rental.
- saw: Rent vs buy: the fold closes, the page goes from 3238 to 1492 px, scrollY 2394 to 648; the 'After 10 years' heading is at -358 px and the verdict tiles higher still. The screen shows the tail of a chart, 'The first year, a month', 'More on this' and a floating 'Saved.'. Renovation: scrollY 1427 to 893, 'Ways to pay' at -464 px. Your home: 1868 to 974 (page 2712 to 1818). Rental add: 1409 to 1200, the new rental's heading at -825 px. Vehicles, second car: 1713 to 1213, the new car at -523 px. Focus drops to the page body each time. Reproduced twice per page with taps by coordinates (no Playwright auto-scroll at the tap). A second Compare six seconds later still confirms, so that part is fine.
- should: After the redraw the green 'Saved.' and the top of the answer sit just under the top bar. After an add, the new item's heading does.
- why: The person asks a question (Compare) and the answer is not on the screen; the screen jumps 500 to 1,750 px to the foot of the page. They scroll up to hunt for it or think nothing changed.
- cause: The views draw the form fold open only until the first save (modules/property/renovation/view.js:55 `open: s.cost ? null : true`, rent-vs-buy/view.js:81 `open: saved ? null : true`, home/view.js:139, the add folds at rental/view.js:190 and vehicles/view.js:108), so the redraw is 500 to 1,750 px shorter. core/app.js show() puts back the old pixel position (lines 205 and 218) and the browser clamps it to the new bottom. The page's own 'Saved.' is at the top of the page, so the shell shows its floating copy (lines 258-261) instead of taking the person there.
- fix: One change in core/app.js show(): after a keepScroll redraw, when the scroll was clamped (window.scrollY < keepY - 2) and this save's fresh notice is out of view, scroll that notice to just under the top bar instead of echoing it. These pages put the notice at the top, right above the answer. On Rental and Vehicles the new card can sit below older ones, so the view marks it and scrolls it into view. This keeps the logged choice that add forms fold away once there is data (2026-09-15, Net worth round 4).
- evidence: $SP/ux/p-debt-property/verify/v1_rvb_after.png, $SP/ux/p-debt-property/verify/v1_reno_after.png, $SP/ux/p-debt-property/verify/v3_rental_added.png, $SP/ux/p-debt-property/verify/v13_home_saved.png

## p-cashflow-b-goals/F6 (severity 3, focus, scope several-pages, owner claude-b (house, rent-vs-buy, renovation); claude-a (vehicle, charitable), confirmed)
**'Work it out' shuts the figures and leaves you at the bottom of the page, the answer above the screen**

- pages: goals/house, goals/vehicle, goals/charitable, property/rent-vs-buy, property/renovation
- reach: every calculator page with a 'The figures' fold (about 18 views use the same construct; five checked on screen)
- steps: Family household. goals/house: 'The figures' is open; change Home price to 500000, scroll to 'Work it out', tap it. goals/vehicle: open 'The figures', Price 40000, 'Work it out'. goals/charitable: 5000, 'Work it out'. Also property/rent-vs-buy and property/renovation ('Compare').
- saw: House: the fold closes, the page shrinks 2660 -> 1323 px, the screen goes from scroll 1816 to 479 (the new bottom); the headline figure sits 296 px above the screen; the page's own 'Saved.' is off screen (the bottom toast is in view). Vehicle: 1989 -> 1266, scroll 1145 -> 422, headline '$1,400 to pay cash' 239 px above; the screen shows 'The 20/4/10 rule'. Charitable: 1712 -> 1144, headline 117 px above. Rent or buy: 3238 -> 1492, headline 327 px above. Renovation: 2271 -> 1737, 741 px above.
- should: After 'Work it out' the top of the answer (the first card whose figure changed) is at the top of the screen, and 'The figures' stays open below it for the next try. That matches the owner's 2026-09-16 choice for Social Security ('the one just saved stays open').
- why: The person asked a question and the screen answers with whatever happens to be at the bottom of the page. To see the number that changed they scroll up; to try another figure they reopen the fold and scroll about 1,000 px back to the button, every time.
- cause: Each view folds the form as soon as anything is saved: modules/goals/house/view.js:99, vehicle/view.js:63, charitable/view.js:44, property/rent-vs-buy/view.js:81, property/renovation/view.js:55 (open: saved ? null : true). The shell holds the old height while redrawing and then lets go (core/app.js:205 and 253), so the shorter page clamps the scroll to its new bottom.
- fix: In each view: a module-level justSaved flag set in the submit handler; draw the fold open when justSaved; after drawing, scroll the first answer card to the top (the shell lets a page that scrolls itself win). One small helper in core/ui could carry this for all the 'The figures' pages.
- evidence: $SP/ux/p-cashflow-b-goals/verify/f6-goals_house-2-after-tap.png, $SP/ux/p-cashflow-b-goals/verify/f6-goals_vehicle-2-after-tap.png, $SP/ux/p-cashflow-b-goals/verify/f6-goals_charitable-2-after-tap.png

## p-investments/INV-7 (severity 3, choreography, scope page, owner claude-b pages, confirmed)
**Backtest: tapping a mix or a year changes an answer that is not on the screen**

- pages: investments/backtest
- reach: all 23 chips
- steps: Blank plan (same with held()): Investments > Backtest > scroll to 'Compared with' > tap '40 / 60'.
- saw: Only the chip turns blue. The sentence that carries the result is in the top card (ends at 401 px) and is off screen; the chart starts at y 791 of 844. The 'Which mixes' card is 608 px tall (561 to 1,169) with 23 chips. The headline never changes for 'Compared with' because it speaks only of the first mix. Not as reported: the two rows do not both start on 60 / 40 (first row starts on 'The mix on Will the money last?' or 'Your target').
- should: One live line inside the chips card, for example 'Your plan's mix: $10,000 became $39.9 million. 60 / 40: $25.7 million.' The first chip reads 'Your plan's mix (70% stocks)'.
- why: Each comparison costs a scroll up to read and a scroll down to choose again; a first-timer taps twice wondering whether anything happened.
- cause: modules/investments/backtest/view.js:20-24 (the result lives only in the hero) and :31-36 (the chips card sits between the hero and the chart).
- fix: Append one aria-live result line under the last row of chips in the 'Which mixes' card; rename the first chip. Page-level.
- evidence: $SP/ux/p-investments/verify/inv7-backtest-blank-after-tap.png

## p-retirement-c-scenarios/RC-11 (severity 3, focus, scope several-pages, owner claude-b, confirmed)
**After Compare or Add at the bottom of a long form, the answer is above the screen**

- pages: scenarios/advisor-plan, scenarios/compare, retirement/annuities
- reach: Pages whose long form folds away on save: three found.
- steps: H.family(), scenarios/advisor-plan. Fill Spend in retirement 9,000, Stock return 12, Their fee 1.2, Chance of success 85. Scroll to Compare and tap it.
- saw: The page shrank from 2,513 to 1,634 px and the screen landed at 790, on "What the fee costs" and "Their quoted chance". The answer asked for, "Your plan and the advisor's", was 638 px above the top of the screen; only the bottom note said "Advisor's plan saved." Same pattern, milder: Compare what-ifs > Make your own (2,510 -> 1,487 px; the new card's name 62 px above the top bar, its last three rows showing) and Annuities (1,641 -> 917 px; the new quote's name above the top bar).
- should: After the save the new result's heading is at the top of the screen, with the confirmation.
- why: The button says Compare and the comparison is not on the screen; the person sees the tail of the result and has to guess to scroll up.
- cause: The shell's keep-your-place redraw (core/app.js:205-218) puts back the old scroll position; the form folds away, the page is shorter and the browser clamps to the new bottom. The pages do not bring the result into view (modules/scenarios/advisor-plan/view.js:34-58, modules/scenarios/compare/view.js, modules/retirement/annuities/view.js:35-63).
- fix: In each of the three pages, on the draw that follows a save (pending was set), scroll the new result card to the top under the top bar. The shell already lets a page that scrolls itself win (app.js:192-194, :248). A shell fallback is possible (when the page shrank past the old position, go to the new confirmation instead of clamping) but lands less exactly.
- evidence: $SP/ux/p-retirement-c-scenarios/verify/rc11-after.png, rc11b-compare-own.png, rc2-after.png (scripts rc11.mjs, rc11b.mjs)

## p-cashflow-a/x-3 (severity 2, focus, scope page, owner claude-b, confirmed)
**Paycheck: after saving the 16-box 'W-4 and deductions' section, the figure it changed is 2,000 px above the screen**

- pages: cashflow/paycheck
- reach: paycheck, each earner's section
- steps: H.family(), cashflow/paycheck, open 'Ana: W-4 and deductions', type 300 in 'Federal income tax on your pay stub, a paycheck', scroll down to Save (1,429 px below that box), tap Save.
- saw: A note at the bottom: 'Ana's paycheck saved.' Ana's take-home changed from $2,888 to $2,832, but that tile is 2,015 px above the screen; what the screen shows is the end of the form and Bo's paycheck. The Save button moved from y 600 to 406 under the thumb.
- should: The note says the result: 'Ana's paycheck saved: take-home is now $2,832 a paycheck (was $2,888).'
- why: The person typed a figure to see what it does to the paycheck and is shown only 'saved'; they have to scroll a long form back up to find out.
- cause: modules/cashflow/paycheck/view.js:111: `pending = `${NameOf(p.name)} paycheck saved.`` carries no result.
- fix: paycheck/view.js:111: keep p.net before the update in a module-level `was`, and on the next render build the notice from the new figure: `${NameOf(p.name)} paycheck saved: take-home is now ${money(now)} a paycheck${Math.abs(now - was) >= 1 ? ` (was ${money(was)})` : ', as before'}.`
- evidence: $SP/ux/p-cashflow-a/verify/x4-paycheck-after-save.png (script x4.mjs)


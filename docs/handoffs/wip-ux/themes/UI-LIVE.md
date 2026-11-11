# UI-LIVE: Boxes that redraw the page the moment they change swallow the next tap and drop the focus

3 verified findings (each reproduced on screen by an independent skeptic). Scripts and pictures for a finding `<walker>/<id>` are in `$SP/ux/<walker>/` and `$SP/ux/<walker>/verify/`.

## j-keyboard-reader/x-redraw-on-change (severity 3, focus, scope several-pages, owner claude-b (debt/mortgage, taxes/capital-gains, taxes/brackets) and shell (the focus kept across a save's redraw, which also covers claude-a's taxes/documents), confirmed)
**Boxes that redraw the page the moment they change swallow the next tap and drop the focus**

- pages: debt/mortgage, taxes/capital-gains, taxes/brackets, household/people, taxes/documents, retirement/projection, retirement/cash-flow, cashflow/forecast
- reach: touch: the what-if boxes on Mortgage, Capital gains and Tax brackets. Keyboard: every choice or tick box that saves or redraws at once (8 pages checked)
- steps: Touch, family household (and jordan), phone 390x844: debt/mortgage, tap 'Extra each month', type 300, then tap straight into the 'Lump sum' box and type 20000. taxes/capital-gains: type 8000 in Gain, then tap the '+$25,000' chip. Keyboard, 1280x800: type 7000 in the box and press Tab on debt/mortgage, taxes/capital-gains, taxes/brackets; household/people: focus the filing-status list and press the down arrow once; taxes/documents and retirement/projection: Space on the first tick box.
- saw: Mortgage, 3 runs on 2 households: the extra is applied (300) but the tap on Lump sum focuses nothing; 20000 typed goes nowhere; a second tap works. Capital gains: 8000 is applied and the chip tap is ignored. Keyboard: after Tab the focus is on nothing on Mortgage and Capital gains; on Tax brackets it lands on 'Continue your plan' at the bottom and the page scrolls 1,022 px away from the answer. People: one arrow key saves 'married filing separately' at once ('Saved.') and the focus is gone, so you cannot arrow on to the one you wanted. Tax documents checklist, Will the money last?, Year by year and Cash-flow forecast: focus on nothing after the change (one Tab gets back).
- should: Changing a box updates the answer under it and leaves the boxes where they are: the next box you tap takes the tap, and Tab moves to the next box.
- why: On a phone you fill the first what-if box, tap the second, and nothing happens: no cursor, no keyboard, until you tap again. On a keyboard the page throws you out of the form after every change.
- cause: Page-local redraws that rebuild the whole page from a change handler: modules/debt/mortgage/view.js:21 and :92-93, modules/taxes/capital-gains/view.js:15 and :45, modules/taxes/brackets/view.js:36 (root.replaceChildren(); render). The box about to receive the tap is destroyed while the tap is in flight. For choices that save (household/people/view.js:157-158, taxes/documents/view.js:47, retirement/projection/view.js:233) it is the shell's redraw, core/app.js:208, which never puts the focus back.
- fix: Shell, one change (core/app.js show() with keepScroll): before clearing the page note which control had the focus (tag, name or aria-label, and its position among its like), and after the redraw focus its twin with preventScroll. That fixes every choice or tick box that saves (People, Documents, Will the money last? and the rest). Pages, three small changes (Mortgage, Capital gains, Tax brackets): on change redraw only the results under the boxes, not the boxes themselves, as debt/payoff already does with its live preview.
- evidence: verify/x5.mjs, verify/x5b.mjs, verify/x5c.mjs, verify/x5-mortgage-after-tap-next-box.png (300 applied, Lump sum not focused after the tap)

## p-debt-property/x-1 (severity 3, focus, scope page, owner claude-b (debt/mortgage), confirmed)
**Mortgage 'What if': after typing an extra, the tap on the next box is thrown away**

- pages: debt/mortgage
- reach: Any page that rebuilds itself on a box's change event. Found on debt/mortgage (both What if boxes). Pay off debts previews on each keystroke without rebuilding and is fine.
- steps: H.family(), debt/mortgage. Tap 'Extra each month', type 250, then tap 'One lump sum (for a recast)' and type 20000.
- saw: After the second tap the focus is on the page body, not on the lump-sum box; the 20000 goes nowhere and the box still shows its 'e.g. 20000' hint. A second tap is needed. Both runs. On a phone the keyboard would drop at that moment.
- should: The tapped box takes the focus and the keyboard stays up; only the answer tiles below change.
- why: 'I tapped the box and nothing happened': an extra tap every time a person moves between the two boxes, with the keyboard closing in between.
- cause: modules/debt/mortgage/view.js:92-93: each box's onChange calls redraw() (line 21: `root.innerHTML = ''; render(root, ctx)`). Leaving box one for box two fires change first, the whole page is rebuilt, and the box being tapped no longer exists when the focus arrives.
- fix: Keep the 'What if' card in place and put the tiles and the year-by-year list in their own holder; on change (or on input, as Pay off debts does at view.js:78-83) recompute and replace only that holder's children.
- evidence: $SP/ux/p-debt-property/verify/v10_mortgage_second_box.png

## p-taxes/x-3 (severity 3, focus, scope several-pages, owner claude-b, confirmed)
**After typing in a what-if box, the first tap on the next control does nothing**

- pages: taxes/brackets, taxes/capital-gains, debt/mortgage
- reach: the three pages whose number box redraws the whole page when it is left
- steps: family, taxes/brackets: tap 'Or an amount', type 12345, tap the '+$25,000' chip. family, taxes/capital-gains: type 12345 in 'Gain', tap 'Holding period' (or a chip). family, debt/mortgage: type 250 in 'Extra each month', tap the 'One lump sum' box.
- saw: Bracket explorer: the answer reads 'on $12,345 more' and no chip is lit; the chip needs a second tap (2 runs of 2). Capital gains: the choice list does not open and no chip is lit (2 of 2). Mortgage: the cursor is in no box and the second box needs another tap (2 of 2).
- should: The tap that leaves the box also does what it was aimed at: the chip is chosen, the list opens, the next box takes the cursor.
- why: 'I tapped it and nothing happened.'
- cause: The box's change handler redraws the whole page: modules/taxes/brackets/view.js:36 (root.replaceChildren(); render(root, ctx)), modules/taxes/capital-gains/view.js:44-45 (redraw(), defined at :15), modules/debt/mortgage/view.js:92-93. The change fires when the tap on the next control takes the cursor out of the box, so that control is destroyed before the tap reaches it.
- fix: In those three views keep the chips, boxes and select in place and put the result tiles in their own container; on change redraw only that container (and toggle the chip's 'on' class).
- evidence: p-taxes/verify/x2-cg-chip-swallowed.png (12345 typed, +$25,000 tapped, no chip lit); scripts p-taxes/verify/t5b.mjs, x2.mjs. On an iPhone a tap on a chip may leave the cursor in the box (then the chip works); box to box and box to list still lose the tap. Check both on the phone.


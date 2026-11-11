# UI-ENTER: Enter in a box saves a half-filled form

4 verified findings (each reproduced on screen by an independent skeptic). Scripts and pictures for a finding `<walker>/<id>` are in `$SP/ux/<walker>/` and `$SP/ux/<walker>/verify/`.

## p-career-household-system/x-2 (severity 3, focus, scope ui-kit, owner shell (core/ui/dom.js), confirmed)
**The keyboard's Go / return in the first box sends the whole form**

- pages: household/contacts, household/people, every ui.form without required boxes after the first
- reach: contacts, people, calendar reminder, any ui.form whose later boxes are optional
- steps: H.family(), household/contacts, Add someone, type "Dr Lee" in Name and press Enter (the phone keyboard's return / Go). Same on household/people: + Add another person, type Dee, Enter.
- saw: Contacts: "Dr Lee added." with no phone or email, the form closes, and "Worth a look: Dr Lee has no phone or email yet" appears. People: "Dee added." with no birth date, form closed. No box has enterkeyhint. (cashflow/income is fine: the next required box takes the focus.)
- should: Return in any box but the last moves to the next box (key reads "next"); in the last box it reads "done" and saves.
- why: Reproduced on two pages. The walker listed Enter-saves as a good thing after testing only the last box. On a real phone confirm what the key says (Go or return) and that it submits; the submit itself is standard browser behaviour.
- cause: core/ui/dom.js:95-127 form(): a submit button plus single-line inputs means implicit submission from any box; no keydown handling, no enterkeyhint.
- fix: In form(): for each single-line input except the last set enterkeyhint="next" and on keydown Enter preventDefault and focus the next control; the last gets enterkeyhint="done".
- evidence: $SP/ux/p-career-household-system/verify/f10-contacts-open.png (v8.mjs, v10.mjs logs)

## p-insurance-estate/x-2 (severity 3, focus (keyboard Next / Enter), scope ui-kit, owner shell, confirmed)
**The keyboard's return key in the first box submits the whole form**

- pages: estate/gifting, estate/inheritance, estate/legacy, insurance/health, insurance/policies, estate/digital
- reach: every form built with ui.form. Harmless where the amounts are required (the form stops at the empty box); on the IE-2 pages it creates a $0 row.
- steps: Household family. Open estate/gifting, tap 'To whom', type Sam, press the keyboard's return / go key (Enter).
- saw: 'Gift to Sam added.' with $0: the form was submitted from the first box, focus dropped to the page body and the form was reset. The box has no enterkeyhint, so the key does not say what it will do. (Get started already does this properly: its boxes say 'next' and 'done'.)
- should: Return in any box but the last moves to the next box (the key reads 'next'); in the last box it reads 'done' and submits.
- why: On a phone people press return to get to the next box. Here it files the form with everything else empty and tells them it was added.
- cause: core/ui/dom.js:92-129 form(): no keydown handling and no enterkeyhint on the controls, so the browser's implicit submission runs on Enter in any text box.
- fix: One change in core/ui/dom.js form(): set enterkeyhint='next' on every text/number/money box except the last ('done'), and on keydown Enter in a non-last box preventDefault and focus the next control. To confirm on a real iPhone: the key label changes and the number pad's Done bar still closes the keyboard.
- evidence: $SP/ux/p-insurance-estate/verify/m2.mjs ; $SP/ux/p-insurance-estate/verify/v2-gifting-empty-amount.png

## j-first-freelancer/F6 (severity 2, input, scope ui-kit, owner shell, needs-real-phone)
**Enter in a Side income month box saves the whole form: only possible if the phone's number pad has a Go key**

- pages: career/side-income
- reach: None
- steps: H.freelancer(): Side income, tap 'November 2025', type 1,200, press the keyboard's Go / Enter key.
- saw: In this headless browser Enter does save ('Months saved.', the typed month kept, nothing lost), the cursor leaves the box and the page moves 213 px. But the month boxes ask for the number pad (inputmode decimal), and an iPhone's number pad has no Go or return key, only 'Done' above the keys, which just closes the keyboard. In the setup questions Enter moves to the next box (checked: pay box to 'Estimated tax paid so far this year').
- why: Cannot be judged here. Check on the owner's phone: tap 'November 2025' on Side income. iPhone: confirm the pad has no Go key (then this cannot happen and nothing needs doing). Android: press the pad's bottom-right key after one month; if the form saves and the keyboard closes, fix it in the UI kit so that key moves to the next box (enterkeyhint 'next' on all but the last box of ui.form, core/ui/dom.js). The jump after 'Save the months' itself is real and is covered by x-1.
- evidence: $SP/ux/j-first-freelancer/verify/13-side-after-enter.png (script v13)

## p-taxes/T2 (severity 2, focus, scope ui-kit, owner shell, needs-real-phone)
**Enter in a box saves the half-filled form and shuts its section (the shut section and the dropped cursor after a tapped Save are fine)**

- pages: taxes/hsa-fsa, taxes/state, taxes/federal, taxes/withholding, taxes/estimated
- reach: forms whose boxes are all optional; a form with a required box (capital gains' sale) moves to the next box on Enter instead
- steps: family, taxes/hsa-fsa: type 500 in 'You put in this year' and press Enter. Compare: the same, but tap Save.
- saw: Enter: 'Saved.', the section shuts (page 818 px shorter), cursor nowhere; the other four boxes need the section reopened. Tapped Save on hsa-fsa, withholding, federal, state: the section shuts with its saved value in the summary ('HSA $500', '$640 biweekly', '1 typed') on screen and the green confirmation shows; on estimated it stays open. That half reads well and is not a problem.
- should: On the phone: put the cursor in 'You put in this year' and look for a Go / return / tick key on the keyboard. If there is one (Android's number pad has it), it should move to the next box and only the last box should save.
- why: It only bites if the keyboard has an Enter or Go key while the cursor is in a money box. The iPhone's number pad (inputmode decimal) has none, so on the owner's phone this cannot happen in these boxes; headless Chromium cannot show the keyboard.
- cause: core/ui/dom.js:92-96 form(): the browser's implicit submit on Enter; no enterkeyhint and no keydown handling.
- fix: If the phone check shows the key: in form(), set enterkeyhint="next" on every control but the last and, on keydown Enter in a control that is not the last, preventDefault and focus the next control.
- evidence: p-taxes/verify/t2-hsa-before.png, p-taxes/verify/t2-hsa-after.png, p-taxes/verify/t2b-hsa-fsa-after.png; scripts p-taxes/verify/t2.mjs, t2b.mjs, t2c.mjs, t2d.mjs


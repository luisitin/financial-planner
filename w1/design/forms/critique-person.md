# Forms track, critique from the person's side (a layperson, one thumb, an iPhone)

How I walked it: a copy of the prototype (`$SP/w1/forms/crit-person/app`, same files as `proto`, served on 127.0.0.1:9326,
always `?sandbox=1`, now stopped), real touch taps at a person's pace (the design's own `lib.mjs` helpers), 390 x 844 and
390 x 664 (what Safari shows of the page between its address bar and toolbar). Scripts and pictures:
`$SP/w1/forms/crit-person/{journeys,undo-where,undo-safari,undo-link,refusal,c-return,dark}.mjs`, `shots/`, `out/`.
17 journeys (12 from the findings plus 5 follow-ups), households family, blank and family plus bank lines.

`$SP` = `$SP`.

## Blocking

### 1. B8's Undo is out of sight after the tap on two of the three adopted pages, and the bottom note drops it

- **What a person sees.** On Emergency fund and Goals prioritizer, a person who has scrolled down to read the card taps
  "Yes, count it as my emergency fund" or "Use these amounts" with the button in the middle of the screen. The card with
  the button goes away (liquidity) or the button stays (prioritizer); the green line holding Undo is drawn at the top of
  the page, above the screen; the bottom note copies the words **without** the Undo (core/app.js `echo` removes `a,
  button` and has `pointer-events: none`) and leaves after 3.6 s. After that nothing on the screen says what happened
  and there is no visible way back. This is the x-4 (balance) and x-4 (goals) complaint left as it was.
- **Evidence.** `undo-where.mjs` (button scrolled to y about 440 of 844, then one tap):
  liquidity: Undo top **-123** (notice top -204), echo "Done: the "Emergency fund" goal's money now counts as..." with no
  Undo; prioritizer: Undo top **-271**, echo "Monthly amounts set on your goals." with no Undo; 3.8 s later both echoes
  gone, Undo still above the screen. `undo-safari.mjs` at 390 x 664 with the person's own `swipeInto` (try-list item 7
  as written): prioritizer Undo top **-248**, liquidity **-106**: the owner's try-list item 7 fails on the phone.
  The design's "Undo on the screen, 5 of 5" (`m-undo.mjs`) only ran with the button already on the first screen of a
  844 px viewport (no scroll; `out/undo.json` also holds only 2 of the 5 rows).
- **And where it does show, it is wedged into a sentence.** `shots/liquidity-undo-link.png`: "...pay is covered ✓
  [Undo] Your next move: Get life insurance on Ana ›" on one line. An inline button mid-sentence next to another way on
  goes against "buttons on their own line" (DESIGN_LOG 2026-09-16, Pass 4 round 1, owner chose A; the design quotes it in
  section 7). The new `.notice a { padding-block: 13px }` of the link on the next line covers the bottom of Undo:
  `undo-link.mjs` probes 21 points on the 60 x 44 Undo (top 159 to 203); 4 of them (the bottom-left 12 px) open
  "Your next move: Get life insurance on Ana" instead of undoing (link line 2 at 191 to 236).
- **Change.**
  1. B8, A4 and CONVENTIONS: the Undo is drawn **where the tapped control was**: `ui.undoLine(ticket, words)` in the
     place of the button or of the card that held it (Subscriptions already does this, and it reads well:
     `shots/on-subs-1.png`). `ui.notice(kind, text, { undo })` only for a notice drawn at that place; never an inline
     button inside a sentence; a link in the same green line goes on its own line.
  2. Redo the two prototype adoptions that way (prioritizer: the line replaces the "Use these amounts" row; liquidity:
     the line stands where "Your next move" card was) and re-measure with the button scrolled to the middle of a 664 px
     screen.
  3. Contract with place: the echo is never the only carrier of an Undo (it cannot be tapped). Touch rules: D-UNDO (and
     D-SEEN, which accepts `.save-echo`) should require the Undo itself on the screen after the tap; today both read green
     on this case.

## Should fix

1. **A double tap lands on Undo and puts the row back.** Subscriptions: the done-row's Undo is drawn exactly under the
   thumb (tapped "Not a subscription" at 218..359 x 377..421; Undo at 284..344 x 366..410). `undo-where.mjs`
   subs-dbl: second tap at 250 ms and at 600 ms: "under the thumb before the 2nd tap: Undo", `recurringIgnored` back to
   `[]`, echo "Netflix is back on the list.". The design says the second tap "landed on the done-row, harmless": it does
   not. Better than today (today it hides a second subscription), but a surprise. Change: name the dependency on the taps
   track's guard (its "changed" rule swallows a tap within 40 px and 700 ms) in "Contract", land S9 with or after it, and
   correct the m-undo claim; or keep the Undo off the tapped spot (start of the line).
2. **What-if answers are stale while the next box is open.** Mortgage (`journeys.mjs mortgage`): 250 in Extra, tap
   Lump sum: the first tile still reads "no change, Extra $0 a month" while the box shows 250; it changes only after
   Lump sum is left ("3 years 8 months sooner, Extra $250 a month"). The findings asked for the simpler visible thing:
   redraw only the answer holder on each change, boxes untouched (x-1, p-taxes/x-3 fixes; Pay off debts already does
   it). Change: A10 does that on Mortgage, Capital gains and Tax brackets; `ui.later` stays as the net for pages not yet
   split, not the fix.
3. **A page's own "no" names a box the person cannot see.** Vehicles: "Type what the car is worth today." sits above
   Add car (top 662, still there 7 s later, no stack: good), but the focus stays on the button, nothing is marked, and
   the worth box is above the screen. Crypto (blank): "Type how many coins and today's price for one." above Add coin,
   `aria-invalid` on nothing (`refusal.mjs`). A1 covers Vehicles and Rental, but not Crypto, Employer stock and
   Contributions, whose finding (p-investments/x-2) asks for "the empty box focused and outlined". Change: add them to A1
   (`required` + `missing`, or `ui.fieldError(box, words)` in their handlers).
4. **The try-list and B5 promise a Return key the iPhone's number pad does not have.** Try-list item 3 ("type 500,
   press Done: the gift is added") fails on the owner's phone: Amount and Year are decimal pads with no Return; Safari's
   bar "Done" only closes the keyboard, and Year follows Amount anyway. Change: B5 says "in text, phone and email boxes";
   item 3 becomes "type Sam, press next: the cursor is in Amount, nothing is saved; type 500, tap Add gift". Also a real
   phone check (or set `enterkeyhint` when the form is built, not in `focusin`) that the first box's key already reads
   "next".
5. **Return jumps past a notes box.** Contacts: Return in Email (key "next") skips Notes and lands in "Last four digits
   for Chase checking", 204 px lower, a box whose digits are dropped unless the checkbox beside it is ticked
   (`journeys.mjs contacts`). Census `c-return.mjs` (79 kit forms on the family's pages, folds opened): 17 save from the
   last one-line box while other controls follow; 3 of them have a text keyboard: estate/digital (Notes skipped,
   saved), system/settings, transactions/rules. Change: Return walks to the next box you type in, Notes included;
   Return saves only from the box right above the buttons; otherwise it closes the keyboard and brings the rest of the
   form and its button into view.
6. **The notice-link padding is invisible and not what the owner chose.** "Pass 4, round 2: Emergency fund. Finding:
   the last sub-44 px tap target in the app, an inline 'Update them there.' link. Owner chose: A) outlined button
   'Update balances on Net worth'". The padding keeps a 19 px word in a sentence, makes T-TARGET read green, and covers
   part of Undo (blocking 1). Change: keep it only as a net; do not count R-A9 or RB3 as closed by it; in A8 and
   `ui.goTo` default to the owner's pattern, the action and the place ("Add birth dates on People", "Update balances on
   Net worth"), with "Open <title> ›" as the fallback.
7. **The count line reads wrong when a label has a comma.** 62 field labels contain commas ("Federal income tax on your
   pay stub, a paycheck", "Employer adds, a year"): "2 boxes need a fix: Federal income tax on your pay stub, a paycheck,
   Employer adds, a year." reads as four boxes. Change: separate the names with semicolons (or quote them).
8. **"Value grows each year" now opens the letter keyboard** (`journeys.mjs home`: mode=text) on 3 boxes (Home,
   Rental, and claude-a's Projection) where nearly everyone types 3 or 4. The GOV.UK reason is right and T-KEYBOARD
   allows it, but it is worse than today for the usual case: list it in "choices made without the owner" and the
   try-list so the owner decides.
9. **Whether the screen moves depends on the button's words** (`/^(compare|work it out|show|check|see|try)\b/`).
   Renaming a button changes where the person lands, silently. Change: `answer: true` on the forms that ask (a short
   list in A6), the regex only as a fallback.
10. **Renovation Compare**: the answer comes just under the top bar and glows (good), but the page's own "Saved." sits
    right above it, under the bar, and only the bottom note says it. Bring a fresh notice that sits directly above the
    target into view with it.

## What I tried that held up

- Goals, Add with nothing typed: "Fill this in first." and "Type an amount first." at the boxes, the first box under the
  top bar with its label showing and the cursor in it, the count above the button; typing "Boat" removes its words and
  the count follows; the second Add goes to Amount; the third adds, the new row glows on screen with "Boat added." in
  view. Same in dark mode (`shots/dark-goals.png`, red readable).
- Debts, Visa at 500%: "Use a number from 0% to 100%." under the box; 22.9 clears it at once; Save brings the row back to
  the middle (top 402), glowing, "Saved Visa card." in the bottom note.
- Net worth, Brokerage: "12..5" held with words; Cancel brings the screen from 1,537 back to 545 with the row at 395,
  glowing, focus on its Edit; Save 19,000 does the same with "Brokerage saved." at the bottom. The Goals add form's
  Cancel returns to "+ Add another goal" the same way.
- Vehicles: the refusal stays above Add car, one copy only, still there after 7 s; with a worth, the new car comes under
  the top bar and glows.
- Gifting: Return in "To whom" goes to Amount (key "next"), in Amount to Year (key "done"), in Year saves; nothing saved
  half-way.
- Income, Add with nothing typed (try-list 1): as described, apart from the keyboard (needs the phone).
- Mortgage what-if: after 250 in Extra, the tap on Lump sum lands, the cursor stays there; 20000 and Return give one
  redraw with both figures. Home: words for "Selling costs" -20 appear after the next tap landed; the box tapped moved 0
  px. Goal seek 1,250: words at the box, no bubble. Renovation with the cost empty: "Type an amount first." at the
  cost box, cursor in it. Paycheck W-4 Save: take-home $2,832 on screen, the changed row glows.
- Subscriptions: the done-row stands where Netflix was, Undo 60 x 44, Spotify does not slide under the thumb.
- New words: plain ("Fill this in first.", "Check the year: 0026 is not a year this plan can use.", "That is a billion
  or more: check for an extra zero.", "Put back as it was."), apart from item 7 above.
- Design log: no other conflict found. Net worth's "Cancel folds it" is kept; no disabled Save; no bar fixed to the
  bottom; no PC, AI or build words; Debts round 14 ("the form opens inside the list card") is spread by A7, not undone.

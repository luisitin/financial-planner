# Person critic, track "doc" (L7 aaed872, L8 6ce1c29): people with thumbs, a pay stub and a bank file

Track HEAD 6ce1c29 against fa2026e. Checked 2026-11-12.

**Setup**
- Two detached worktrees: `rv/v-doc-person` (6ce1c29) on 127.0.0.1:9751 and `rv/v-doc-person-base` (fa2026e) on 9752.
  Both servers were stopped by pid (my own launcher, `rv/doc/person/srv.mjs`), and both worktrees were removed at the end.
- Every walk used the kit (`ux/kit.mjs`): Chromium with iPhone emulation, touch, sandbox only. Taps were touch taps at the
  element's centre after swiping it into view. A pasted stub went in with `keyboard.insertText`, which works like a paste.
  Files came in through the real file chooser after tapping "Choose the file". Back and Forward were `history.back()` and
  `history.forward()`.
- Scripts are in `rv/doc/person/*.mjs`, logs in `rv/doc/person/shots/*.json`, screenshots in `rv/doc/person/shots/`.
  Invented stubs are in `rv/doc/person/stubs/`, and the bank files are the builder's `rv/doc/files/`.
- People: Jamie (`noMatch`), Casey (`noContrib`), Dana & Lee (`couple2k`), all phone-built in Get started. They were walked
  at 390 px, at 320 px once (Casey's reader, Casey's import) and in dark mode once (Jamie's reader, Casey's import at 320).
- Severity (also in the structured findings): 5 = one tap on the screen as shown records something wrong that the person
  did not give; 4 = the page offers or keeps a wrong figure that the person is likely to accept; 3 = the person cannot
  undo or find what they did; 2 = the person cannot see or trust what changed; 1 = wording or a small slip.

---

## What works (checked, no finding)

- **One filled button per screen.** On the reader, base fa2026e showed "Read it" plus three filled "Use it" buttons on one
  screen (r2.json, old-jamie-dark: 4 filled). The track shows one: the first change not yet used. "Read it" turns outlined
  once text is read. Import shows one: "Import N transactions" (or "Update the balance" when nothing is new).
- **"Already on file" replaces the pointless change.** The base said "Now: $72,000, annual. Would be: $2,769, every two
  weeks. That is $72,000 a year instead of $72,000." with a filled Use it. The track says "Already on file: $72,000 a
  year. Nothing to change." with no button (r1-new-read-full.png).
- **The ?kind=paystub landing at 320 px.** It shows "Read your pay stub", the box, and a filled "Read it" on the first
  screen (r6-new-320-landing.png). Sampled every 20 ms for 0.6 to 0.8 s, nothing on the first screen moved (r1.json,
  r2.json "moves": []).
- **Whose is right when it is set.** For Lee's Roth-only stub with Whose = Lee, the pay reads "Already on file: $52,000",
  and the 401(k) cards say "Lee's 401(k)" and "Lee's Roth 401(k)". The select keeps its place when changed (r7).
- **Notices sit where the thumb was.** After each "Use it", the scroll did not move (600 → 600; 829 → 827), and the ok
  notice was in view where the button had been (r1.json, r2.json). In base, the in-card notice was off screen and only the
  shell's echo showed.
- **Import reads the bank's Quicken file.** The base says "That does not look like a bank file: no dates or amounts were
  found." (i1.json old). The track says "Your bank's download for Checking ending 7351 (Prairie Bank): 10 lines … No columns
  to check. The account number is not kept. Checking is your only checking account, so it is picked above." It has the
  filled "Import 10 transactions" and the ticked "Also set Checking's balance to $4,512.36 … (on file: $6,000.00)"
  (i1-new-preview.png). It reads the same at 320 px in dark (i3-new-casey-320-dark.png).
- **Back and Forward.**
  - Import → Categorize, then Back, returns to Import.
  - Reader, then Back, returns to the page it was opened from (Dashboard or Contributions). Forward returns to the reader
    with the stub still read.
- **The two-account file works.** "This file holds 2 accounts. Bring in [Checking ending 7351]". After the import and Back,
  choosing the file again moves the select to "Savings ending 9964" and the account to Savings (i2.json new-two).
- **No sideways scroll and no small targets.** `overflowX` was false on every screen walked. The census found no small,
  unnamed or covered control. The only flags were "under the top bar" for a button already scrolled past.

---

## Findings (most severe first)

### P1 (5) L8: a card file goes into Jamie's 401(k) and, with the pre-ticked box, sets the 401(k) to minus $6,522
**Steps**
1. Jamie (`noMatch`; accounts: Jamie's plan at work 401(k) $30,000, Checking, Savings, Car loan; no card).
2. Ledger, then Import.
3. Tap "Choose the file" and pick `rv/doc/files/Maple_8642.qbo`, the card's QuickBooks download.

**Evidence** (i2-new-jamie-card.png, i2.json)
- The preview's amber notice reads: "Check the account above: Card ending 8642 could be more than one of your accounts.
  This goes to Jamie's plan at work."
- The filled button reads "Import 5 transactions", above the box "Also set Jamie's plan at work's balance to -$6,522.17,
  the bank's figure on 11/11/2026 (on file: $30,000.00)". The box is ticked.
- One tap, and Categorize says: "Added 5 transactions from Maple_XXXX.qbo. Jamie's plan at work's balance is now
  -$6,522.17". The five card lines now sit on the 401(k).
- Net worth went from **$37,000 to $478**.
- Will the money last? went from **"Runs out in 2052 … (age 70)" to "Runs out in 2048 … (age 66)"** (e1.json,
  e1-jamie-networth-after-card.png, e1-jamie-proj-after-card.png).
- The account box ("1. Which account is the file from?") is off screen above the preview. Even scrolled up, it holds no
  card, so Jamie has nothing right to pick.
- The amber sentence is also untrue: no account could be this card.

**Fix** (`transactions/import/compute.js` guess, and the view)
- Bank and card files may only go to an account of a bank kind (checking, savings, cash, credit card). Never offer a
  401(k), an IRA, a loan or a mortgage for transaction lines.
- When the plan has no account of the file's kind, pick none.
- Say "You have no card on file yet." and offer an outlined "Add Card ending 8642 as a new card" (an ordinary card account
  with no number), or "Add it on Net worth ›" with a way back.
- Keep Import disabled until an account is picked.
- Pre-tick the balance only when the account's kind matches the file's (card to card, checking or savings to the same).
  Never offer a card's balance for any other kind.
- Test: Jamie plus Maple_8642.qbo gives no account picked and no balance offer, and the 401(k) stays at $30,000.

### P2 (4) L7: Lee's pay stub is read as Dana's, and the filled "Use it" cuts Dana's pay to $52,000
**Steps**
1. Dana & Lee (`couple2k`; Dana $78,000 a year, Lee $52,000).
2. Open the Document reader from the menu (`#/ai/reader`, no `?person`).
3. Lee pastes Lee's stub (`stubs/lee.txt`: Gross Pay 2,000.00, ROTH 401K 80.00, biweekly), then taps "Read it".

**Evidence** (r4-new-lee-asdana.png, r2.json new-lee-general)
- "Whose" defaults to **Dana**, with no word on why.
- The first card, with the screen's one filled button, is titled "Pay on the Income page" and names no one. It reads:
  "Now: $78,000, annual. Would be: $2,000, every two weeks. That is $52,000 a year instead of $78,000."
- The cards below offer:
  - "Dana's 401(k), pay the tax later: none on this stub", which would take Dana's $400 a month to nothing;
  - a new "Dana's Roth 401(k) at work".
- One tap on the filled button writes Dana's pay as 2,000 every two weeks, which is $52,000 a year (usedFirst.income).
- With Whose = Lee, the same stub says "Already on file: $52,000 a year". So the app holds what it needs to tell whose
  stub this is (r7).
- The pay overwrite already happens at fa2026e. The zero offer and the new account are L7's.

**Fix** (`ai/reader/view.js`, `compute.js`)
- When `?person` is not given, pick Whose from the stub: the adult whose pay on file is within 2% of the stub's gross ×
  pay periods. Say so in one line: "This looks like Lee's pay stub: its pay matches Lee's $52,000 a year."
- Name the person in every card title: "Dana's pay on the Income page", "Dana's tax withheld per paycheck".
- When the stub's yearly pay differs from the chosen adult's by more than 15% while it matches another adult's, outline
  every "Use it" and show an amber line above the cards.
- Test: couple2k plus lee.txt gives personId setup-partner and the pay card `same: true`.

### P3 (4) L7: an ADP-style stub (deductions printed with a minus sign) gives no 401(k) card, only the match
**Steps**
1. Casey (`noContrib`: a 401(k) with $0 going in).
2. Menu, search "pay stub", tap "Document reader".
3. Paste `stubs/casey-adp.txt`. Its lines are "Federal Income Tax -241.12 5,063.52", "401K -166.15 3,489.15" and
   "401K ER Match 83.08 1,744.68", the way ADP prints this-period deductions.
4. Tap "Read it", then tap the one filled "Use it".

**Evidence** (r1-new-read-full.png, r1.json, e1.json, e1-casey-contrib-after-match.png)
- "Found in it" lists "Federal income tax withheld **-$241.12**" and "401(k), pay the tax later **-$166.15**".
- "What it would change" has no card for either of them. The only change offered is "Casey's employer's match … about
  $2,160 a year".
- After Use it, "What you save for retirement" reads "$0 of your own money and $2,160 from employers". The row reads
  "Casey · $0 every month · employer adds $2,160 a year".
- The stub said $166.15 of Casey's own goes in every paycheck ($4,320 a year). The page shows that the line was read, then
  drops it without a word.
- Base fa2026e also had no 401(k) change for this stub, but it offered nothing at all. L7 now offers the match on its own
  and records it.

**Fix** (`ai/reader/compute.js`)
- On a pay stub, federal, k401 and roth401k are amounts taken out of pay. Read their absolute value: a leading minus or
  parentheses means "taken out". Casey then gets "$166.15 every two weeks, $4,320 a year" and "Tax withheld $241.12".
- When the stub has a 401(k) line that gives no card, never offer the match alone. Say "Your stub shows a 401(k) line we
  could not read. Type it on What you save for retirement ›".
- Test: casey-adp.txt gives k401 166.15 and federal 241.12, each with a card.

### P4 (3) L8: Undo removes the lines but keeps the balance the import set
**Steps**
1. Dana & Lee, Import, tap "Choose the file", pick `Prairie7351_Activity.qfx`.
2. Leave the box ticked and tap "Import 10 transactions".
3. Press Back, then under Past imports tap "Undo" and OK.

**Evidence** (i1.json new, i1-new-after-undo.png)
- The dialog says "Remove the 10 transactions from PrairieXXXX_Activity.qfx?" and the notice says "Removed the 10
  transactions …".
- The plan then holds 0 lines, but Checking is still **$4,512.36** as of 11/12 (it was $6,000).
- Nothing on screen says the balance stayed.
- With P1 this is worse: undoing the card file leaves Jamie's 401(k) at -$6,522.17.

**Fix**
- Keep the balance change on the import record: `{ accountId, was, wasAsOf, set }`.
- Undo restores `was` while the account still holds `set`, and drops the point it added.
- The dialog says "and put Checking's balance back to $6,000.00".
- Test: import with the balance, then undo, gives Checking 6000 as of 2026-11-11.

### P5 (3) L7: a stub that arrives as one line loses the 401(k) that fa2026e read, and only the match is offered
**Steps**
1. Dana & Lee, `#/ai/reader?kind=paystub`.
2. Paste Dana's stub (`stubs/dana.txt`) with its line breaks turned into spaces. This is how a copy from a PDF can arrive,
   and the builder lists it to try on the iPhone.
3. Tap "Read it".

**Evidence** (r5-new-dana-oneline.png, r5-old-dana-oneline.png, r2.json)
- At fa2026e, "Found in it" lists "401(k) contribution $195" with its card.
- At 6ce1c29 it says "Not found: 401(k), pay the tax later, …". Only "Dana's employer's match … about $2,340 a year" is
  offered.
- The same happens with Casey's stub on one line (c0.mjs output): only the match is offered.
- The new skip pattern (`NOT_PRETAX`: match, employer, roth…) rejects the whole line, so on a one-line stub it rejects the
  401(k) too.

**Fix**
- Apply the skip only to the words around the label (from the line start, or the previous amount, up to the label's own
  amount), not to the whole line.
- Or, when the text has fewer than 3 line breaks, cut it into pseudo-lines before each known label (Gross, Federal, 401,
  Roth, Match, Net Pay).
- Test: dana.txt joined into one line still gives k401 195 and match 97.50.

### P6 (2) L7: the "saved" confirmation is drawn at 60% opacity: 2.3:1 in light mode
**Steps:** any household, read a stub, tap "Use it".

**Evidence** (r1-new-use1.png, r3-new-jamie-dark-use1.png)
- The notice ("Casey's employer's match: saved. What you save for retirement shows it.") sits inside the used card, and
  `.rd-prop.done { opacity: .6 }` fades it with the card.
- Measured from the screenshots: text against its background is **2.28:1** in light mode and **4.11:1** in dark. Both are
  below 4.5:1.
- In base, the confirmation was the shell's full-strength echo.

**Fix:** fade only the card's title and description (`.rd-root .rd-prop.done > .rd-t, .rd-root .rd-prop.done > .rd-d {
opacity: .6 }`, scoped in the module's STYLE), not the notice.

### P7 (2) L7: a used card says "Would be: $123.08 … That is $3,200 a year instead of $3,200"
**Steps:** Jamie (`noMatch`, $250 a month on file), paste `stubs/jamie.txt`, Read it, Use it on the 401(k) card.

**Evidence** (r3-new-jamie-dark-use1.png)
- The used card reads "Now: $123.08 every two weeks. Would be: $123.08 every two weeks. That is $3,200 a year instead of
  $3,200."
- The withholding card above it reads "Now: $198, every two weeks. Would be: $198, every two weeks."
- Jamie cannot see what changed ($250 a month, or $3,000 a year, became $3,200 a year). Base also printed Now = Would be on
  used cards. The "instead of" sentence is L7's.

**Fix**
- Keep the card's `before` at tap time (in `pending` or a module-level Map keyed by proposal id).
- Word a used card as "Was: $250.00 every month ($3,000 a year). Now: $123.08 every two weeks ($3,200 a year)."

### P8 (2) L7: at 320 px, tapping "Read it" shows nothing new on the screen
**Steps:** Casey, opened from Contributions to `#/ai/reader?kind=paystub` at 320 × 568. Paste `stubs/casey-cells.txt` and
tap "Read it".

**Evidence** (r6-new-320-after-read.png, r6 log)
- After the tap, the scroll stays at 177.
- The screen shows the same text box, three outlined buttons and "What it is".
- "Found in it" starts at 630 px and "What it would change" at 967 px, both below the 568 px screen.
- Nothing says anything was found, and the filled button is gone from the screen.
- Base: same (Found at 696). At 390 px the Found card does show (r1-new-read.png).

**Fix:** after "Read it", bring "Found in it" (or "What it would change") to the top once and focus its heading, as
Import's `bringUp` does for its preview.

### P9 (2) L7: "What you save for retirement shows it." names a page with no link, and nothing leads to the answer
**Steps:** any "Use it" on a 401(k) or match card.

**Evidence** (r1-new-use1.png, r3-new-jamie-dark-use1.png)
- The notice names the page as plain text.
- After the last change the page offers only "Continue your plan: step 2 of 6 ›".
- Casey, who just added $2,160 a year of the employer's money, has no one-tap way to see what it did to "runs out at …".

**Fix:** make "What you save for retirement ›" a link, and after the last used 401(k) or match card add an outlined "See if
the money lasts ›" (`#/retirement/projection`). Neither is filled.

### P10 (2) L7: the Roth-only offer asks a question a person cannot answer
**Steps:** Dana & Lee, Lee's Roth-only stub, Whose = Lee.

**Evidence** (r7 log, r7-lee-as-lee.png)
- The card reads "Lee's 401(k), pay the tax later: none on this stub. Now: $150.00 every month. This pay stub has a Roth
  401(k) line and no line for money you pay the tax on later, so it would be nothing. Use it if the money on file is the
  same Roth money."
- "the money on file is the same Roth money" asks Lee to know how the app stored a figure Lee gave during setup.

**Fix:** "You told us $150.00 a month goes into Lee's 401(k). This stub shows Lee's money going in as Roth ($80.00 every two
weeks) and none as pay-the-tax-later. If that is the same money, Use it sets this part to nothing; the Roth part is the next
card."

### P11 (1) L7: "paystub" finds nothing in the menu search
**Steps:** Menu, then type in "Find a page".

**Evidence** (w0 runs)
- "pay stub" gives "Paycheck | Document reader".
- "paystub", the common one-word spelling, gives "No page matches".
- "401k" does not list the Document reader.
- Same at fa2026e.

**Fix:** `modules/ai/reader/module.js` gets `aliases: ["paystub", "pay stub", "payslip", "pay slip", "earnings statement",
"statement", "401k from pay stub"]`.

### P12 (1) L8: two end dates for one file on one screen
**Evidence** (i1-new-preview.png)
- The header says "10 lines from 10/20/2026 to 11/12/2026" (the file's span).
- The tile under it says "Will be added 10/20/2026 to 11/10/2026" (the lines).

**Fix:** "10 lines, 10/20/2026 to 11/10/2026 (the file covers to 11/12/2026)", or the lines' dates alone.

### P13 (1) L7: dates in "Found in it" are machine dates
**Evidence:** "Pay date 2026-11-06", "Period start 2026-10-19" (r1-new-read-full.png). This is at fa2026e too, but L7
reworked `show` for money and left dates raw.

**Fix:** `show` uses `fmt.date(v)` for `unit === "date"`.

(The money critic's M8, whole dollars on the withholding card, was also seen here: "Would be: $198" under "Found:
$198.40". It is not repeated.)

---

## Seen, not this track (for wave 1)
- **Typing in the menu's "Find a page" box comes out reversed.** Typing "pay stub" key by key shows "buts yap", and "stub"
  shows "buts". This happens at fa2026e too. `core/app.js:76` rebuilds the menu on every keystroke and focuses the new box
  with the caret at the start.
- A person who types to find the reader or Import gets "No page matches". Seen in Chromium. Safari behaviour was not
  checked.
- This is wave 1's file, so it is not listed as a finding of this track.

## Safari (not walked: only Chromium is installed). Try on the real iPhone
- **Reader:**
  - copy a pay stub from a PDF in Safari or Files, paste it, and check whether the line breaks survive (P5 decides the
    result);
  - the "Whose" and "How often are you paid?" selects open the wheel and re-render without a jump;
  - the textarea at 16 px does not zoom.
- **Import:**
  - the Files picker with the broad accept list: .qfx, .qbo and .ofx are not greyed, and a file saved as "download" with
    no extension can be picked;
  - `readAsArrayBuffer` plus `TextDecoder("windows-1252")` on a 1252 file with é or ’;
  - the balance tick row: tapping the words ticks it;
  - the smooth scroll that brings the preview up after a file is chosen.
- **Menu search:** whether the reversed typing (above) also happens in Safari, or whether the keyboard closes.

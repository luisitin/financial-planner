# Person critic, track "doc" (L7 aaed872, L8 6ce1c29): second pass, 2026-11-12

The builder's worktree is still at 6ce1c29 (two commits on fa2026e, nothing uncommitted), so this pass walks the same code
as the first person pass. Nothing below is copied from it: every finding was walked again by me, on screen or by running
the code, and six are new (P1b-d, P4, P6, P8, P9, P15). The first pass is kept at
$SP/rv/doc/p2/critic-person.round1.md.

**Setup**
- Two detached worktrees of my own: `rv/v-doc-person` (6ce1c29) on 127.0.0.1:9751 and `rv/v-doc-person-base` (fa2026e) on
  9752. Both servers were stopped by pid and both worktrees removed at the end. The builder's worktree was only read.
- The kit (`ux/kit.mjs`): Chromium with iPhone emulation, touch, the sandbox only. Taps are touch taps at the control's
  centre after swiping it into view. A stub goes in with `keyboard.insertText` (a paste). Files come in through the real
  file chooser after tapping "Choose the file". Back and Forward are `history.back()` / `forward()`.
- Everything is under $SP/rv/doc/p2/
  (called p2/ below): scripts `w1 w2 w6 r3 r4 r5 r6 i1 i3 i5 i6 i7 i8 e1 k1 o1 s1 s2 c1 .mjs`, logs `p2/shots/*.json`,
  screenshots `p2/shots/*.png`, invented stubs `p2/stubs/`. Bank files are the builder's `rv/doc/files/`.
- People: Jamie (`noMatch`), Casey (`noContrib`), Dana & Lee (`couple2k`), Morgan (`renter`), all phone-built; Sam and
  Riley (`renterDebt`) from the kit. 390 px throughout; 320 px for Casey's reader, Casey's import, Lee's reader and Jamie's
  card file; dark for Jamie's reader (390), Casey's import (320), Lee's reader (320) and Jamie's card file (320).
- Severity: 5 = one tap on the screen as shown records something wrong the person did not give; 4 = the page offers a
  wrong figure the person is likely to accept; 3 = the person cannot undo or find it, or a second tap writes something
  unread; 2 = the person cannot see or trust what changed, or what to do next; 1 = wording.

---

## What works (walked, no finding)

- **The reader reads a real stub right, and base did not.** Casey's stub ("401(k) Pre-Tax 4.00% 110.77", "Roth 401(k) 2.00%
  55.38", "401(k) ER Match 110.77"): fa2026e read the 401(k) as **$4** (the "4.00%"), showed four filled buttons on one
  screen and offered "Pay ... $72,000 a year instead of $72,000". The track finds all 9 lines, says "Already on file: $72,000
  a year. Nothing to change.", and offers the 401(k) $110.77, the Roth $55.38 into its own row and the match $2,880 a year
  (p2/shots/w1-new-read-full.png, w1-old.json). After the four "Use it": "$7,200 a year ... $4,320 of your own money and
  $2,880 from employers", and Will the money last? moves from "runs out at about 67" to "Runs out in 2067 (age 87)".
- **One filled button per screen** on every reader and import screen walked (the first change not yet used; "Import N
  transactions"; "Update the balance to ..." when nothing is new). Base had "Read it" plus three "Use it" filled.
- **The confirmation sits where the thumb was.** After each ordinary "Use it" the scroll did not move (600 to 600, 900 to
  900, 1200 to 1200) and the notice was in view. In base it was off screen and only the shell's echo showed.
- **Whose, when it is set.** `?kind=paystub&person=setup-partner` opens with Whose = Lee; the cards say "Lee's 401(k)",
  "Lee's Roth 401(k)"; changing Whose by hand did not move the page (scroll 0 to 0).
- **"How often are you paid?"** appears only when the stub does not say, and changing it did not move the box (y 614 to
  614) (but see P4 for its default).
- **Import reads the bank's Quicken file.** Base: "That does not look like a bank file: no dates or amounts were found."
  The track: "Your bank's download for Checking ending 7351 (Prairie Bank): 10 lines ... Checking is your only checking
  account, so it is picked above.", filled "Import 10 transactions", then Categorize says "Added 10 transactions ...
  Checking's balance is now $4,512.36 as of 11/12/2026." (p2/shots/i1-dana-new-preview.png). The same file again: no
  Import button, "Everything in this file is already on file." A file named `download` with no extension reads the same.
- **The tick box.** 328 x 44 px (258 x 59 at 320 px); a tap on its words unticks it, and then the balance is left alone
  (Casey, 320 px dark: Checking stayed $4,000; p2/shots/i4-casey320-new.json).
- **Two accounts in one file**: "This file holds 2 accounts. Bring in [Checking ending 7351 / Savings ending 9964]. One at
  a time: pick the file again for the next one." Picking the file again moved to Savings by itself (p2/shots/i5.json).
- **Back and Forward.** Reader, Back: the page it came from. Forward: the reader with the stub still read. Import to
  Categorize, Back: Import with "Past imports".
- **No sideways scroll, no small target, no page error** in any state at 390 and 320 px, light and dark (o1.json: 0
  offenders in 7 states). The only census flag is a button already scrolled under the top bar.
- **No account number kept**: the plan after Casey's stub holds no "6789"; import records say "PrairieXXXX_Activity.qfx".

---

## Findings (most severe first)

### P1 (5) L8: a bank or card file lands on an account of the wrong kind, and the pre-ticked box sets that account's balance
Four ways in, all on screen, all one tap on the filled button.

**a. No card on file (Jamie).** Import, "Choose the file", `Maple_8642.qbo` (a card file).
- Amber: "Check the account above: Card ending 8642 could be more than one of your accounts. This goes to Jamie's plan at
  work." Filled "Import 5 transactions". Ticked: "Also set Jamie's plan at work's balance to -$6,522.17, the bank's figure
  on 11/11/2026 (on file: $30,000.00)." (p2/shots/i2-jamie-card-new-preview.png)
- One tap: "Added 5 transactions from Maple_XXXX.qbo. Jamie's plan at work's balance is now -$6,522.17".
- Net worth **$37,000 to $478**. Will the money last? **"Runs out in 2052 (age 70)" to "Runs out in 2048 (age 66)"**
  (p2/shots/e1.json, e1-jamie-networth-after.png, e1-jamie-proj-after.png).
- The amber sentence is untrue (Jamie has no card), the account box is 325 px above the screen, and it holds no card to pick.

**b. Several cards (Riley: Visa card, Mastercard, Store card).** Same file.
- "Check the account above: Card ending 8642 could be more than one of your accounts. **This goes to Checking.**" Ticked:
  "Also set Checking's balance to -$6,522.17 ... (on file: $400.00)." (p2/shots/i3-riley-new-preview.png)
- When unsure, the file goes to the first account in the list whatever its kind. Picking Mastercard by hand then gives the
  right offer ("$6,522.17 owed (on file: $3,300.00 owed)") and the page does not jump.

**c. The person does step 1 first and picks the wrong kind.** No warning at all.
- Dana picks Savings, then the checking file: "Your bank's download for Checking ending 7351 ..." and, ticked, "Also set
  Savings's balance to $4,512.36 ... (on file: $22,000.00)." (p2/shots/i6-dana-savings.png)
- Jamie picks Checking, then the card file: ticked "Also set Checking's balance to -$6,522.17 ... (on file: $3,000.00)."
  (p2/shots/i6-jamie-checking.png). The file itself says which kind it is.

**d. Get started's one "Credit cards" line (Sam).** "Credit cards is your only card, so it is picked above." Ticked: "Also
  set Credit cards's balance to $6,522.17 owed ... (on file: $3,200.00 owed)." Get started makes that line as everything
  owed on cards (`setup/compute.js:114`), so one card's file replaces the total (p2/shots/i7-sam390.png).

**Fix** (`transactions/import/compute.js` account guess and balance offer, `view.js`)
- A bank file may only go to checking, savings or cash; a card file only to a card. Never list or fall back to a 401(k),
  IRA, loan, mortgage or home for transaction lines.
- Not sure which: pick none. Show the choice inside the preview as chips ("Which card is this? Visa card / Mastercard /
  Store card"), and keep Import outlined and disabled until one is tapped.
- No account of that kind: "You have no card on file yet." with an outlined "Add this card" (a plain card account, no
  number), and no Import until it exists.
- A hand-picked account whose kind differs from the file's: amber "This file says it is a checking account; you picked
  Savings." and no balance offer.
- Tick the balance box by default only when the kind matches and the account was picked for a sure reason (lines already
  there, or the only one of its kind that Get started did not make as a lump). Otherwise leave it unticked.
- Tests: Jamie + Maple gives no account and no offer, 401(k) stays 30,000; Riley + Maple gives no account; Dana with Savings
  picked + Prairie gives the warning and no offer.

### P2 (4) L7: Lee's stub is read as Dana's, and the filled "Use it" cuts Dana's pay to $52,000
**Steps:** Dana & Lee, Document reader from the menu (no `?person`), paste `p2/stubs/lee.txt`, "Read it".

**Evidence** (p2/shots/w4-lee-new-read-full.png, w4-lee-new.json)
- "Whose" shows Dana, with no word why.
- First card, the screen's filled button, titled "Pay on the Income page" (no name): "Now: $78,000, annual. Would be:
  $2,000, every two weeks. That is $52,000 a year instead of $78,000."
- Below: "Dana's 401(k), pay the tax later: none on this stub. Now: $400.00 every month ... it would be nothing" and a new
  "Dana's Roth 401(k) at work".
- With Whose = Lee the same stub says "Already on file: $52,000 a year. Nothing to change." The app can tell whose it is.
- The pay overwrite is at fa2026e too; the zero offer and the new account are L7's.

**Fix** (`ai/reader/view.js`, `compute.js`)
- With no `?person`, pick Whose from the stub: the adult whose pay on file is within 2% of gross x pay periods, and say
  "This looks like Lee's pay stub: its pay matches Lee's $52,000 a year."
- Name the person in every title on a plan with two adults: "Dana's pay on the Income page", "Dana's tax withheld".
- When the stub's yearly pay is more than 15% from the chosen adult's and matches the other's, outline every "Use it" and
  put an amber line above the cards.

### P3 (4) L7: a stub that prints deductions with a minus sign gives no 401(k) card, and the match is recorded alone
**Steps:** Casey, `#/ai/reader?kind=paystub`, paste `p2/stubs/casey-adp.txt` ("Federal Income Tax -241.12", "401K -166.15",
"401K ER Match 83.08"), "Read it", tap the one filled "Use it".

**Evidence** (p2/shots/w6-adp-new-full.png, w6-new-3.json; `c1.mjs`)
- "Found in it" lists "Federal income tax withheld **-$241.12**" and "401(k), pay the tax later **-$166.15**".
- "What it would change" has no card for either. The only offer: "Casey's employer's match ... about $2,160 a year".
- After the tap, What you save for retirement: "**$0 of your own money and $2,160 from employers** ... runs out at about 72".
  The stub said $166.15 of Casey's own goes in each paycheck ($4,320 a year).

**Fix** (`ai/reader/compute.js`)
- Federal tax, 401(k) and Roth 401(k) are money taken out: read the absolute value (a leading minus or parentheses).
- Never offer the match by itself when a 401(k) line was seen and gave no card, or when the person's own money on file is
  $0: say "Your stub has a 401(k) line we could not read. Type it on What you save for retirement".
- Test: casey-adp.txt gives k401 166.15, federal 241.12, each with a card.

### P4 (3) L7: a stub that does not say how often it pays is taken as "every two weeks", and every yearly figure is then wrong
**Steps:** Dana & Lee, `?kind=paystub`, paste `p2/stubs/dana-noperiod.txt` (Dana is paid twice a month: gross 3,250.00; the
words "Semi-Monthly" left off, as on many stubs), "Read it".

**Evidence** (p2/shots/w3-dana-noperiod-new-read-full.png, w3-dana-noperiod-new.json)
- "How often are you paid?" shows "Every two weeks", with "This pay stub does not say."
- The filled button: "Pay on the Income page. Now: $78,000, annual. Would be: $3,250, every two weeks. That is **$84,500** a
  year instead of $78,000."
- "Dana's 401(k) ... That is **$5,070** a year instead of $4,800" (the stub's real figure is $4,680) and "match ... about
  **$2,535** a year" (real: $2,340).
- Tapping all four writes pay 3,250 biweekly, 401(k) 195 biweekly, match 2,535.
- Pick "Twice a month" and the pay card turns to "Already on file: $78,000 a year": 3,250 x 24 is exactly the pay on file,
  so the app holds what it needs to answer its own question.
- At 320 px the question is below the screen after "Read it".
- Same root, by code (`c1.mjs`, `p2/stubs/dana-bonus.txt`): a paycheck with a $2,000 bonus offers pay "$126,000 a year",
  401(k) $7,560 and match $3,780 with no word that this paycheck is unlike the pay on file.
- Base took "every two weeks" too, without asking. L7 added the question and the 401(k) and match figures that depend on it.

**Fix**
- When the stub does not say, choose the period whose gross x periods is within 2% of the adult's pay on file, and say so:
  "Taken as twice a month: $3,250 x 24 is your $78,000 a year. Change it if that is wrong."
- When no period fits, outline every "Use it" and put the question directly above the first card until it is answered.
- When gross x periods is more than 15% from the pay on file with the period known: "This paycheck is bigger than your
  usual pay (a bonus or overtime?). The yearly figures below would assume every paycheck is like it."

### P5 (3) L8: Undo takes the lines back but leaves the balance the import set, and says nothing about it
**Steps:** Dana & Lee, import `Prairie7351_Activity.qfx` with the box ticked, Back, "Undo" under Past imports, OK.

**Evidence** (p2/shots/i1-dana-new-after-undo.png, i1-dana-new.json, `i8.mjs`)
- Dialog: "Remove the 10 transactions from PrairieXXXX_Activity.qfx?" Notice: "Removed the 10 transactions ...".
- The plan then holds 0 lines; Checking is still **$4,512.36** as of 11/12 (it was $6,000). Nothing on screen mentions it.
- After P1a's Undo, Jamie's 401(k) stays **-$6,522.17**, Net worth stays $478 and the answer stays "2048 (age 66)" (e1.json).
- When the bank's date is the plan's own date, the old figure is gone altogether: Jamie's history holds only
  `{2026-11-11: -6522.17}`; the two-account file left Checking `[{2026-11-11: 1500}]`, no $6,000 (i5.json).

**Fix**
- Keep on the import record what the balance was: `{ accountId, was, wasAsOf, set }`.
- Undo puts `was` back while the account still holds `set`, and its dialog says so: "... and put Checking's balance back to
  $6,000.00 (11/11/2026)?"
- Never overwrite a same-day point without keeping `was` somewhere the Undo can reach.

### P6 (3) L7: after "Use it" on the "none on this stub" card, the next card's filled "Use it" slides under the thumb
**Steps:** Dana & Lee, `?kind=paystub&person=setup-partner`, Lee's stub, "Read it", use the withholding card, then tap "Use
it" on "Lee's 401(k), pay the tax later: none on this stub". Tap the same spot again half a second later.

**Evidence** (p2/shots/r3-lee-after-use1.png, r3.json, r4.json, r4-lee-double-tap.png)
- The used card disappears from the list (its notice goes to the top of the section), so everything below moves up.
- The tap was at (82, 681). After it, the filled "Use it" of "Lee's Roth 401(k), pay the tax now" sits at y 681 to 725:
  `elementFromPoint(82, 681)` is that button.
- A second tap in the same place made a new account ("Lee's Roth 401(k) at work", $0) and a new row ($80.00 every two
  weeks) that Lee had not read.
- If Lee stops after the first tap instead, Lee's saving on file has gone from $1,800 a year to $0.

**Fix**
- Never remove a card during the visit: a used card stays in place, faded, with its confirmation where the button was.
- Better, make it one change (see P14): "Lee's 401(k) money is Roth on this stub" moves the $150 a month in one tap.

### P7 (3) L7: a stub pasted as one line loses the 401(k) that fa2026e read; only the match is offered
**Steps:** Dana & Lee, `?kind=paystub`, paste `p2/stubs/dana.txt` with its line breaks turned to spaces, "Read it".

**Evidence** (p2/shots/w6-danaline-new-full.png, w6-new-3.json, `c1.mjs`)
- fa2026e: "401(k) contribution $195" with its card.
- 6ce1c29: "Not found: 401(k), pay the tax later, ..." and only "Dana's employer's match ... about $2,340 a year".
- Casey's stub on one line: the same, the match alone ($2,880 a year).
- The new skip words (match, employer, Roth) reject the whole line, and here the whole stub is one line.

**Fix:** apply the skip only to the words between the previous amount and the label's own amount; or, when the text has
fewer than 3 line breaks, cut it before each known label first. Test: dana.txt on one line gives k401 195 and match 97.50.

### P8 (3) L7: nothing leads a person to the pay stub page
**Steps:** Casey opens What you save for retirement, where the plan shows $0 going in.

**Evidence** (p2/shots/w1-new-contrib-before.png, w1-new.json, s1.json, p2/shots/s2.txt)
- The page says "Not sure? Your pay stub or your job's benefits site shows what goes in each paycheck and what the employer
  adds." It has **0 links** to the reader. `grep -rn "ai/reader"` over `modules` and `core` finds no link in this track, in
  the retirement track (`rv/b-ret`: `levers.js:446` says the link "waits for ... L7") or in `rv/b-scn`.
- So `#/ai/reader?kind=paystub&person=<id>`, built for this, is reached from nowhere.
- Menu search: "pay stub" gives "Paycheck | Document reader"; "paystub" and "payslip" give nothing; "401k" and "match" do
  not list it; "bank statement" gives Ledger, not Import. L8 gave Import its words ("qfx", "quicken" now find it); L7 gave
  the reader none.
- Typed key by key, the search box writes backwards ("import" shows "tropmi", the caret stays at 0), at fa2026e as well
  (see "Seen, not this track").

**Fix**
- This track: `modules/ai/reader/module.js` gets `aliases: ["paystub", "pay stub", "payslip", "pay slip", "earnings
  statement", "401k from a pay stub", "match", "statement"]`; Import gets "bank statement" and "statement".
- With the retirement track (its files): "Read it from a pay stub" on the card's work-saving row, and the same link on the
  three pay-stub sentences of Contributions (`view.js:330`, `:359`, `:372` in rv/b-ret), each with `&person=<pid>`.

### P9 (2) L7: for Casey's own case (nothing going in), the page never says what the stub shows
**Steps:** Casey, `?kind=paystub`, paste `p2/stubs/casey-none-plain.txt` (no 401(k) line: Casey really puts nothing in).

**Evidence** (p2/shots/w6-none-new-full.png)
- Small gray text: "Not found: 401(k), pay the tax later, Roth 401(k), pay the tax now, employer match."
- The one filled button is "Tax withheld per paycheck (Withholding check) ... Use it". Nothing about the 401(k).
- "Not found" reads as "the reader failed", not "your stub shows nothing going in". Casey's question is left unanswered and
  nothing points to the next step.

**Fix:** when pay and take-home are found and no 401(k) or Roth line is, add a plain card with no button: "Your 401(k): this
pay stub shows no money going into a 401(k). That matches what is on file ($0)." and an outlined "See what putting some in
would do" to What you save for retirement. When money is on file (Jamie's $250 a month) and the stub shows none: "We found
no 401(k) line on this stub. If it is under another name, type it on What you save for retirement."

### P10 (2) L7: the "saved" confirmation is drawn at 60% strength
**Evidence** (p2/shots/w1-new-use1.png, w2-jamie-new-use1.png, k1.json)
- The notice sits inside the used card, and `.rd-prop.done { opacity: .6 }` fades it with the card.
- Composited contrast, text on its own background: **2.28:1** in light (4.42:1 unfaded), **4.09:1** in dark (8.87:1).
- The same notice outside a used card (P6's, at the top of the section) is full strength.

**Fix:** fade only the title and the description (`.rd-root .rd-prop.done > .rd-t, .rd-root .rd-prop.done > .rd-d {
opacity: .6 }`), not the card.

### P11 (2) L7: a used card reads "Now: X. Would be: X. That is $3,200 a year instead of $3,200."
**Evidence** (p2/shots/w2-jamie-new-use1.png, w1-new-use3.png)
- Jamie: "Now: $123.08 every two weeks. Would be: $123.08 every two weeks. That is $3,200 a year instead of $3,200."
- Casey: "That is $2,880 a year instead of $2,880."; "$1,440 a year instead of $1,440."
- What changed ($250 a month, $3,000 a year, became $3,200) is no longer on the screen.

**Fix:** keep the card's `before` at tap time (a module-level Map by proposal id) and word a used card "Was: $250.00 every
month ($3,000 a year). Now: $123.08 every two weeks ($3,200 a year)."

### P12 (2) L7: after the last change, nothing says what it did to the answer or where to go
**Evidence** (p2/shots/w1-new-use3.png, r5.json)
- "Casey's employer's match: saved. What you save for retirement shows it." names a page as plain text. The reader page
  holds **0 links**; the only way on is the guide bar's "Continue your plan: step 2 of 6".
- Casey's answer had just moved from "runs out at about 67" to "2067 (age 87)". The page does not say so.
- "Casey's Roth 401(k) at work is on Net worth at $0: type its balance there." has no link either.

**Fix:** make "What you save for retirement" and "Net worth" links in the notice, and after the last 401(k) or match card add
an outlined "See if the money lasts" (`#/retirement/projection`).

### P13 (2) L7: at 320 px, "Read it" changes nothing a person can see
**Evidence** (p2/shots/w5-casey320-new-read.png, w5-casey320-new.json)
- After the tap the scroll stays at 177. The screen shows the same box, the three buttons and "What it is".
- "Found in it" starts at 556 of 568 px (a 12 px sliver); "What it would change" at 963. No filled button is on screen.
- Base: the same.

**Fix:** after "Read it", bring "What it would change" (or "Found in it") to the top once and focus its heading, as Import
does for its preview.

### P14 (2) L7: the Roth-only offer asks what a person cannot answer, in two cards
**Evidence** (p2/shots/o1-lee-320-dark-read-full.png, r3-lee-after-use1.png)
- "Lee's 401(k), pay the tax later: none on this stub. Now: $150.00 every month. This pay stub has a Roth 401(k) line and no
  line for money you pay the tax on later, so it would be nothing. Use it if the money on file is the same Roth money."
- Its confirmation: "Lee's 401(k), pay the tax later: none on this stub: saved."
- The next card: "... into a new account, Lee's Roth 401(k) at work, at $0 until you type its balance on Net worth", which
  can be read as the app opening an account.

**Fix:** one card, one tap: "Lee's 401(k) money is Roth. You told us $150.00 a month goes in. This stub shows it going in as
Roth (pay the tax now): $80.00 every two weeks, $2,080 a year. Use it moves it to a Roth line for Lee's plan at work; the
$30,000 stays where it is until you split it on Net worth." Confirmation: "Lee's saving is now Roth: $80.00 every two weeks
(was $150.00 a month, pay the tax later)."

### P15 (2) L8: Import still opens on the long way round
**Evidence** (p2/shots/i1-dana-new-landing-full.png)
- First question: "1. Which account is the file from?" with **"Dana's plan at work"** (a 401(k)) already chosen; Home and
  Mortgage are in the list. A Quicken file names its own account, so this step is asked for nothing, and a hand pick there
  is what makes P1c.
- The landing has no filled button; "Choose the file" is outlined, level with "Use the pasted text". The paste box is open.
- The words do not say which download to take: "as a CSV file or the Quicken or QuickBooks file".
- The pre-ticked balance option sits **under** the button it changes.

**Fix** (simple first)
- Lead with one filled "Choose the file" and "If your bank offers "Quicken" or "QuickBooks" (.qfx, .qbo), take that one:
  nothing to set up. Otherwise CSV."
- Ask for the account after the file, and only when the file cannot tell. Fold "Or paste the file's text" behind "More
  options".
- Put the balance option above the Import button.

### P16 (1) L8: words on the preview
**Evidence** (p2/shots/i1-dana-new-preview.png, i6-dana-savings.png, i7-sam390.png, i5-two-first.png)
- Two end dates for one file: "10 lines from 10/20/2026 to 11/12/2026" and "Will be added 10/20/2026 to 11/10/2026".
- "No columns to check." means nothing to someone who never brought in a CSV.
- "Savings's balance", "Credit cards's balance", "Credit cards is your only card".
- "10 lines" in the sentence, "10 transactions" on the button.
- After the first account of a two-account file, Categorize and Import no longer mention the second.

**Fix:** "10 transactions, 10/20/2026 to 11/10/2026 (the file covers to 11/12/2026). Nothing to set up."; "Set the balance
of Savings to ..."; "Credit cards is the only card line in your plan"; on return, "two-accounts.ofx also holds Savings
ending 9964: choose it again to bring that in."

### P17 (1) L7: words on the reader
**Evidence** (p2/shots/w1-new-read-full.png, r3-lee-landing.png, w1-new-use1.png)
- Dates as the machine writes them: "Pay date 2026-11-06", "Period start 2026-10-19" (the rest of the app: 11/6/2026).
- "Found: $231.40" then "Would be: $231, every two weeks." Two figures for one line, and a stray comma.
- Lee's landing says "Read your pay stub" on a plan with two adults.
- Titles carry page names: "Tax withheld per paycheck (Withholding check)", "Pay on the Income page".
- After Casey's 401(k) is used, the notice ends "1 of our guesses moved with it." (the shell's words) and the match card
  below changes from "Now: no match on file" to "Now: $1,920 a year (our guess)" with nothing tying the two together.

**Fix:** `show` uses `fmt.date` for dates; withholding to the cent; "Read Lee's pay stub"; "Dana's tax taken out of each
paycheck"; on the match card, "Our guess, made when you added what goes in: $1,920 a year."

---

## Seen, not this track
- **The menu's "Find a page" box writes backwards when typed.** "import" shows "tropmi", "pay stub" shows "buts yap"; the
  caret is at 0 after every key (p2/shots/s2.txt). At fa2026e as well. `core/app.js:76` rebuilds the menu on each key and focuses
  the new box; the same line is at the branch tip 737fb6a. Wave 1's file. It is why P8 matters: a person who types cannot
  find either page.
- Payee names lose letters ("CAFé LUNA" becomes "Caf Luna", "JOE'S COFFEE" becomes "Joe Coffee"): `prettyPayee`, for CSV
  too; the builder reported it.

## Safari (not walked: only Chromium is installed). Try on the real iPhone
- **Reader:** copy a stub from a PDF in Safari or Files and paste: do the line breaks survive (P7), and do deductions
  arrive with a minus (P3)? The two selects open the wheel and the page does not jump. The 16 px box does not zoom. On a
  320 px phone with the keyboard up, are the box and "Read it" on screen (the kit's check says no: box top 338 of 300
  visible px, but iOS scrolls a focused box itself).
- **Import:** the Files picker with the broad accept list: .qfx, .qbo and .ofx not greyed; a file named "download" can be
  picked. `readAsArrayBuffer` + `TextDecoder("windows-1252")` on a file with an é or a ’. A tap on the tick box's words
  ticks it. The smooth scroll to the preview after a file is chosen.
- **Menu search:** does typing come out backwards there too?

# Track "doc" (L7 449a4d5, L8 9d34f08 on 707355c): final skeptic, 2026-11-13

I ran my own detached copy of the track's HEAD 9d34f08 (`rv/v-doc-fin`, now removed). I served it on ports 9731-9739, in the
sandbox only, with the kit's Chromium in iPhone emulation and real touch taps. Files went in through the real file chooser
after a tap on "Choose the file", and stubs were pasted with `insertText`. Every server was stopped by the kit's `stop()`,
all nine ports answer nothing now, and no process was killed by pattern. I only read the builder's worktree (`rv/b-doc`): it
is still at 9d34f08 and clean.

Everything I wrote is under
`$SP/rv/doc/final/` (called final/
below):
- walks `walk/i1.mjs` (Dana's bank file), `walk/i2.mjs` (9 import screens), `walk/i3.mjs` (import findings by their own
  steps), `walk/r1.mjs` (9 reader screens), `walk/r2.mjs` (reader findings by their own steps), `walk/r3.mjs` (the AI from
  the fold), `walk/w320.mjs` (page width at 320) and `walk/shotfold.mjs`;
- the sweep `walk/sweep2.mjs` and its output `sweep2.out`;
- the critics' own pure scripts, pointed at my copy (`crit/*.mjs`, outputs `crit/*.out`), and the builder's repros run on my
  copy (`repro7.out`, `repro8.out`);
- logs `shots/*.json`, about 200 pictures in `shots/`, and the whole test log `npmtest.txt`.

## Verdict

The track does what it says for the two people it serves. The four confirmed findings below are all of severity 2 or lower.
None of them writes a wrong figure to the plan.

## (a) fix-2.md's "fixed": closed or not, by the original steps

Each finding was checked on screen (390 and 320 px, light and dark) or with the critic's own script against my copy.

**L8, all closed.**
- **M1 / P1a / B2.** Jamie with the card file: "You have no card on your plan yet. Add it, then choose the file again.
  Nothing has been brought in." There is one filled "Add this card", and the 401(k) stays at 30,000.
- **P1b.** Riley's three cards are offered as chips. Picking Mastercard gives "This goes to Mastercard" and an unticked
  "$6,522.17 owed (on file: $3,300.00 owed)".
- **P1c / N1.** Opened with `?accountId=a-visa` and given the checking file, the page says in amber "Visa card is not a
  checking account" and shows the chips. "Bring it in to Visa card anyway" puts the 10 lines on Visa and leaves Visa's
  6,400 untouched, as the page said it would.
- **M4.** The family's Prairie file: "This file is from Prairie Bank; Chase checking is at Chase. Is it this account?"
  There is no filled button until an account is picked.
- **B3.** A file with two checking accounts gives a select, the chips and no guess.
- **M11.** Visa dated 11/01 with the card-in-credit file. The page asks "Is that what you owe, or a credit (the card owes
  you)?" with no filled answer. After "It is a credit", the notice says "now $0.00 owed" and the plan holds 0.
- **P5 / B4.** Box ticked by hand, then Import, then Undo. The dialog says "... and put Checking's balance back to $6,000.00
  (11/11/2026)?". Afterwards the plan holds 6000 as of 11-11 with the history as it was.
- **N5.** On screen the file name shows as `XXXX_activity.qfx`, and the plan holds no "2899".
- **N7.** A file dated next year gets no balance offer.
- **B6.** A cut-short file gets an amber line and 3 transactions.
- **N6.** The CDATA file reads "STREAMING & MORE".
- **M8, M9, M10, M15, B1.** Closed, by the critics' scripts given an account and by my sweep ("the same file again adds 0"
  on every plan).
- **P15 and P16.** The landing has one filled button and one fold, and the preview shows one date range.

**L7, all closed.**
- **M2.** Robin's catch-up is read as 273.84 ($7,120 a year).
- **M3.** The period's dates win over stray words (the critic's five stubs).
- **M5 / P3 / B10.** Minus signs and brackets are read.
- **M6.** The HSA match line is not taken: the match is 73.85.
- **M7 / P2.** "This looks like Lee's pay stub: its pay matches Lee's $52,000 a year."
- **P4.** "paid twice a month".
- **P7.** A stub pasted as one line reads in full.
- **P9.** "This pay stub shows no money going into a 401(k). That matches what is on file ($0)."
- **P14 / M12.** For Lee, "Yes" leaves 0 on the pay-the-tax-later line and 80 every two weeks on a new $0 Roth account;
  "No" leaves both 150 a month and 80 every two weeks. Both are exactly as the card and "What each answer does" say.
- **M14 / N3 / B9.** The wrong-line cases give no card or a doubted card. "Set my own number" warns on an empty box, then
  110.77 becomes a normal card, and "Use it" writes 110.77 every two weeks.
- **N2, N4, B8, B11.** Closed. "Add yourself" lands on People.
- **P6.** After each "Use it", the spot under the thumb is the used card's text, never a filled button.
- **B7.** Changing the period after a use shows the cards fresh and does not change the plan.
- **N8.** Text pasted but not read survives Back and Forward.
- **P10, P11, P12, P13, P17.** Closed: the notice is at full strength, used cards read "Was / Now", "See if the money lasts
  ›" appears, the changes come to the top at 320, and dates are written as 11/6/2026.

**Not this track (as fix-2 says).** P8's links from the retirement pages, M13 (the projection), and the statement path's
older balance. That last one was seen again: a 10/31 statement replaces 11,500 dated 11/13, and its history then holds only
the 10/31 point. It is older than this track and a decision for the owner.

## (b) The owner's rule, screen by screen

- **Opening or closing never changes the plan.** I opened and closed every fold on every walked screen: 242 pairs, all at
  390 and 320, light and dark. The saved plan was the same string every time.
- **The first view is the least a person needs.**
  - Import landing: one filled "Choose the file" and one fold.
  - Import preview: the account line, "This goes to ...", the balance box, one filled Import and "See the lines".
  - Reader landing: one box, one filled "Read it" and one fold.
  - Reader after "Read it": at most 3 change cards; the match is never folded.
  - Every screen has at most one filled button.
- **Every ability is one tap away.** Pasting, picking a file, Clear, Change (whose stub, how often), what was read, Undo,
  "bring it in anyway" and the column choices are all one tap away.

Four places do not hold. These are findings F1 to F4 below:
- the "See the lines" summary at 320 px (F2);
- the AI's answer hidden after "Ask the AI" (F3);
- the column fold after a change by hand (F4);
- one opt-in worded as a statement (F5).

## (c) As a layperson

**Pasting a pay stub (Casey).** Paste, "Read it", then "Use it" three times. The plan holds the 401(k) at 110.77 every two
weeks with a match of 2,880.02, and a new Roth 401(k) at 55.38 every two weeks. Nothing needs a fold. The tax card waits
under "1 more change: tax taken out", and using it from inside the fold works.

**Uploading a bank .qfx (Dana).** "Choose the file" gives "This goes to Checking, your only checking account.", then
"Import 10 transactions" lands on Categorize with 10 lines. Nothing needs a fold. "See the lines" shows the tiles and the
first lines.

**A gap.** A stub whose 401(k) line reads 0.00 this paycheck gets no word at all (finding F1).

## (d) Regressions

**Whole `npm test`.** 189,456 tests, 188,815 pass, 1 fail, 3 skipped, 637 todo (`final/npmtest.txt`).
- The one failure is the known speed test "takes well under 1.5 s" (it ran beside the phone walks). Run alone it passes:
  1 of 1, 523 ms.
- The track's own tests (reader, ofx, import, import-banks, wording): 87 pass, 0 fail.

**Checks.**
- `npm run registry`: 161 modules, unchanged.
- `npm run check`: OK.
- `node tools/leak-guard.mjs --worktree`: OK, 2,881 files.
- `git diff 707355c HEAD -- tests/golden`: empty.
- CHANGELOG.md, TEAM.md and WORKBOARD.md are untouched.
- Each L is one commit, and the trailers are exact. L8 carries "Prompt: quick-ofx-import" above "Agent:".

**Sweep (`final/sweep2.out`).** It covers 1,451 plans: every qa fixture, the personas (finished and mid-setup), every
archetype with every pack, the five phone-built households, the empty plan and 10 odd plans. Each plan was run against:
- 23 stubs, each for every adult and for no one;
- 38 bank files, for the page's guess and for every account offered.

That is 214,009 runs. Nothing threw. After every plain change was used, reading the same stub again offered nothing.
Importing the same file again added 0. No 5-or-more-digit tail of any ACCTID was kept. Every balance the page said it would
set was set (41,827 times). Every Undo put each account's balance, date, history and guess back exactly. The one gap it
counted is F1.

**The critics' own pure scripts on my copy** (`final/crit/*.out`) reproduce none of their findings. The differences
remaining in the old scripts come from the API they call: `today` and an account are now required for a balance offer, and
a file from another bank is no longer guessed.

## Findings (confirmed)

### F1 (2) L7: a 401(k) line printed as $0.00 this paycheck gets no word on the screen
**Steps.** Jamie (`noMatch`, $250 a month on file), `#/ai/reader?kind=paystub`. Paste `p2/stubs/casey-ytd-only.txt`, which
has the line "401(k) 0.00 1,200.00", then tap "Read it". Casey (`noContrib`, $0 on file) gives the same result.

**Evidence** (`final/shots/r2-zero-noMatch-390.png`, `r2-390.json`, `r2-320-dark.json`; the sweep counted 3,940 runs for
each of two such stubs).
- The cards shown are only the pay and the tax taken out.
- There is no 401(k) card, no "shows no money going into a 401(k)" line and no amber line, although the plan says $3,000 a
  year goes in.
- "401(k), pay the tax later $0.00" appears only inside the folded "What the app read on it".
- A stub with no 401(k) line at all gets the P9 card. A $0.00 line falls between the two rules:
  - `noPlanLine` needs no plan line on the stub (compute.js:584);
  - `hasOwn` needs a figure above 0.

**Fix.** When `fields.k401 === 0` (or `roth401k === 0`) and no other own-money line reads above 0, set `noPlanLine`
(`{ onFile, zeroLine: true }`).
- With $0 on file, say "This pay stub shows $0.00 going into the 401(k) this paycheck. That matches what is on file ($0)."
- With money on file, say "This pay stub shows $0.00 going into the 401(k) this paycheck ($1,200.00 so far this year); the
  plan says $3,000 a year. If you stopped, change it on What you save for retirement ›". Add an outlined "Set it to $0"
  that applies a k401 = 0 proposal; it is never the filled button.
- Tests: these two plans with this stub.

### F2 (2) L8: "See the lines" runs off a 320 px screen when a file has new, already-on-file and unreadable lines
**Steps.**
1. Dana (`couple2k`), Import, choose `files/Prairie7351_Activity.qfx`, then "Import 10 transactions".
2. Back to Import and choose `final/files/Prairie_mix.qfx`: one new line, one already on file and four unreadable lines. The
   critic's `b2/files/Prairie_oddlines.qfx` does the same.
3. Look at the phone at 320 px.

**Evidence** (`final/shots/x-mix-summary-320.png`, `x-mix-summary-390.png`; `w320.mjs` output).
- The summary's status "1 new · 1 already on file · 4 could not be read" is `white-space: nowrap`
  (base.css `.fold .fold-status`). It runs from 75 to 348 px on a card that ends at 306.
- The text is cut at the screen edge ("4 could not be") and the chevron is off the screen.
- The page's layout grows to 367 px wide on a 320 px phone: innerWidth and scrollWidth are 367, the visual viewport is 320,
  so the page scrolls sideways or zooms out.
- At 390 px it fits, but "See the lines" is squeezed to 34 px and stacks one word per line.
- The CSV preview builds the same summary (`csvFold`), so the same happens there. Every other screen walked stays at
  320 px.

**Fix.** In the page's own STYLE (base.css is wave 1's file), let this status wrap and keep the title whole:
`.im-root .fold > summary .fold-status { white-space: normal; text-align: right; } .im-root .fold > summary .fold-title {
flex: 0 0 auto; }`. Or shorten it ("1 new · 1 on file · 4 unreadable"). Add a w320-style check that the layout width stays
320.

### F3 (2) L7: "Ask the AI to find the rest" closes the fold it was tapped in and hides the answer or the error
**Steps.** Casey, `#/ai/reader?kind=paystub&view=build`. The same button shows on the household view whenever the AI
answers on the PC.
1. Paste `casey-ytd-only.txt` and tap "Read it".
2. Open "What the app read on it" and tap "Ask the AI to find the rest".

**Evidence** (`final/shots/r3-ai-390.png`, `r3-ai-320-dark`; `walk/r3.mjs` output).
- The page redraws with that fold closed, and its summary still says "5 of 9".
- The notice "The AI is not available: Failed to fetch. Settings has the AI connection." is in the page's text but not
  shown: innerText does not hold it. The success note "The AI found N more. Check them against the document." would be
  hidden the same way.
- The cause: `foundCard()` builds a plain `<details>` that is not in `opened` (view.js:385-389), and the button calls
  `again()`. Before this track that block was an open card.

**Fix.** Build it with the page's `fold("found", ...)` helper (cls `card fold fold-card`, h2), so it stays open once opened.
Also open it, or put `aiNote` above it, whenever `aiNote` holds an answer or an error.

### F4 (2) L8 (CSV): a column changed by hand folds away under "Columns worked out for you", and the rows it broke follow
**Steps.**
1. Family plan, Import, choose `qa/fixtures/chase-checking.csv`.
2. Open "Columns worked out for you. Change them".
3. Set "Date order" to "day/month/year".

**Evidence** (`final/shots/i2-csv-dmy-390.png`; `i2.json`, csv at 390, 390-dark, 320 and 320-dark).
- After the redraw that fold is closed, and its summary still reads "Columns worked out for you. Change them".
- "See the lines" opens on "4 new · 6 could not be read", with "Will be added 1/9/2026 to 12/8/2026", which is wrong dates.
- The filled "Import 4 transactions" sits between the two folds.
- The figure the person changed, and the cause of the error, are hidden in a fold that says the app worked them out.
- The README says "A fold opened on this visit stays open when the preview or the page is drawn again". That holds for "See
  the lines" and "Past imports", not for this fold.
- Opening and closing did not change the plan.

**Fix.**
- Build the columns fold with `fold("cols", ...)` so it stays open while being changed.
- When `mapping` or `flipSign` differs from what the file worked out, the summary says "Columns: changed by you" with the
  change as its status ("dates day/month/year").
- When a change by hand leaves rows unreadable, open it, as an error must.

### F5 (1) L8: the opt-in "It does belong on Visa card" reads as the app's verdict
**Steps.** Family plan, `#/transactions/import?accountId=a-visa`, choose the checking file.

**Evidence** (`final/shots/i2-visaAsked-320.png`, `i2-visaAsked-390-full.png`).
- Right under the amber "Visa card is not a checking account. Pick the account it belongs to." and "Nothing is brought in
  until you pick one.", the fold's title states "It does belong on Visa card ›".
- A person can read that as the page contradicting itself, not as the choice "I am sure it is Visa's".

**Fix.** Word the summary as the person's choice: "Bring it in to Visa card anyway" (the button inside can stay), or "It is
my Visa card file after all".

## Seen, not findings
- In the statement path (older than this track), a 10/31 statement replaces a balance dated today. The account's history
  then holds only the 10/31 point. "Ending balance $11,820" is shown in whole dollars.
- Re-downloads that change both the line ids and shorten the name are not matched (CITY POWER versus CITY POWER & LIGHT,
  same day and amount). That is a contrived file of mine, not a finding.

## To try on the real iPhone (only Chromium here)
- **"See the lines" at 320 px** with a three-part summary (F2): wrap, sideways scroll, Dynamic Type larger.
- **The Files picker.** .qfx, .qbo, .ofx and a file saved as "download" must not be greyed out, and a dashed name must show
  as XXXX.
- **Encoding.** A windows-1252 file with é or ’ through Safari's TextDecoder.
- **The balance tick box.** A tap on its words toggles it, and the row is 44 px.
- **A stub copied from a PDF in Safari.** Do line breaks, the Unicode minus, brackets and the Current / YTD columns survive,
  and does a 0.00 current line (F1) arrive as 0.00?
- **The selects.** The wheels for "How often are you paid?", "Whose", "Which account in the file" and "Which account is
  it?".
- **Folds.**
  - "1 more change" and "Past imports" stay open after "Use it" or Undo redraws the page.
  - The AI fold (F3), when the AI is on.
  - The columns fold after a change (F4).
- **Scrolling.** The page scrolls itself to the changes after "Read it", and to the preview after a file is chosen.
- **The keyboard over the paste box at 320 px**, and a double tap on "Use it" and "Import".

# Track "doc" (L7, L8): simple first, screen by screen

The owner's rule (2026-11-12, 2026-11-13): simple by default, complexity one quiet tap away, nothing removed. Applied to
every screen of L7 (Document reader, `modules/ai/reader/view.js`) and L8 (Import with a bank's Quicken / QuickBooks file,
`modules/transactions/import/view.js`; the CSV preview shares the page and was given the same treatment).

How it was counted: `fix2/w7.mjs` and `fix2/w8.mjs` open each screen in the sandbox at 390 and 320 px, light and dark, and
`fix2/lib.mjs` `seen()` counts what a person sees before any tap, in the page's own area (the menu bar and the shell's
"Continue your plan" bar are not counted): filled buttons, outlined buttons and chips, boxes, fold lines, text blocks
(paragraphs, notices, list rows, tiles, change cards), the words in them, and the page's height in screens; content inside
a closed fold is not seen. "First screen" is what is on the phone's screen as the page lands (after "Read it" or a file,
where the page scrolls itself). Before = the committed tip before this round's view changes (`fix2/base`); after = the
worktree. Import's landing once a file is in was walked by `fix2/past.mjs` (its pictures `*-landing-past2-*`). Pictures: `fix2/shots/before-*` and `after-*` (`-390`, `-390-dark`, `-320`, `-320-dark`, and `-390-full`).
All paths are under `$SP/rv/doc/`.

## Document reader (L7): every screen, 390 px, before any tap

Same counts ("filled / outlined and chips / boxes / folds / text blocks / words, screens tall at 390 (at 320)"). Every
screen keeps at most one filled button, no sideways scroll at 390 or 320, no page errors (`after-w7-log.json`).

| screen | before | after | what moved, behind what |
|---|---|---|---|
| landing, opened for a pay stub | 1/1/1/0/2/57, 1.0 (1.3) | 1/0/1/1/2/43, 1.0 (1.2) | the outlined "Pick a PDF / Pick a text file" and the list of what the page finds go under "More options"; the lede says only what happens ("You see what each figure would change, and you use only the ones that are right") |
| landing, any document | 1/1/1/0/2/53, 1.0 (1.3) | 1/0/1/1/2/47, 1.0 (1.3) | the same |
| Casey's stub read | 1/6/1/2/8/169, 2.0 (3.3) | 1/2/0/4/5/104, 1.4 (2.3) | the pasted text, "Read it", "Pick ...", "Clear" fold to the bottom as "The pay stub you pasted · Paste another" (box 1 to 0, outlined 6 to 2); 4 change cards become 3 (the 401(k), the Roth 401(k), the match: the money lines asked about, the match never folded) and "1 more change: tax taken out"; her pay, already on file, is one quiet line, not a card |
| Casey, every change used | 0/4/1/2/12/209, 2.2 (3.8) | 0/1/0/3/10/154, 1.8 (2.9) | used cards stay where they were (P6), each with its saved note; "See if the money lasts" the one way on |
| Lee's Roth-only stub | 1/5/1/2/8/184, 1.8 (3.0) | 1/2/0/4/4/73, 1.3 (2.0) | one card asks "Is it the same money?" with two outlined answers; what each answer does to the plan sits under "What each answer does"; the own-money total is not said again (one own-money line: the card says both figures) |
| Dana's stub with no period | 1/5/1/2/9/169, 1.9 (3.1) | 1/2/0/3/5/93, 1.3 (2.1) | "whose" and "how often" said in one line, not two ("This looks like Dana's pay stub, paid twice a month: $3,250.00 x 24 is Dana's $78,000 a year. Change it above if that is wrong.") |
| Dana's bonus stub, whose? | 0/5/1/2/11/122, 1.4 (2.3) | 0/2/0/3/2/27, 1.0 (1.1) | only the question and its two chips; "What the app read on it" stays folded (it opened itself before) and the text folds away |
| a year-to-date-only 401(k) line | 1/3/1/3/6/119, 1.7 (2.8) | 1/0/0/4/4/64, 1.2 (1.9) | the doubted card stays open with its amber line and "Set my own number" fold (a doubt is never folded); the pay one quiet line |
| Casey's stub with no 401(k) line | 1/4/1/2/5/93, 1.5 (2.4) | 1/1/0/3/3/38, 1.0 (1.6) | the "no money going into a 401(k)" card first, the tax card, the pay one line |
| an account statement | 1/3/3/0/5/109, 1.4 (2.2) | 1/0/2/1/3/56, 1.0 (1.5) | the pasted text folds away as "The text you pasted"; Kind and Account stay (they decide the change) |
| no adult on the plan | 1/3/1/2/12/113, 1.5 (2.5) | 1/0/0/3/1/17, 1.0 (1.1) | only "Add yourself on People first" and its button; what was read and the text are folded |

Kept, nothing removed: every change, the box for your own number, the pay rhythm and whose box ("Change"), what was
read, the pasted text, picking a file and Clear are all still there, one tap away; a fold opened on this visit stays
open after "Use it" redraws the page (never saved). The README's "Simple first" section lists the same choices.

## Import (L8): every screen, 390 px, before any tap

Counts as "filled / outlined and chips / boxes / folds / text blocks / words, screens tall at 390 (at 320)". Every screen
keeps one filled button (or none while a question waits), no sideways scroll at 390 or 320, no page errors.

| screen | before | after | what moved, behind what |
|---|---|---|---|
| landing, nothing imported | 1/0/0/1/3/82, 1.0 (1.2) | 1/0/0/1/3/75, 1.0 (1.2) | the lede lost "The app reads it, ... and applies your rules" (it said what happens anyway); round 1 had already made it one filled "Choose the file", the Quicken/QuickBooks hint, pasting under "More options" (P15) |
| landing, a file imported (`past.mjs`) | 1/1/0/1/4/93, 1.0 (1.5) | 1/0/0/2/3/75, 1.0 (1.3) | "Past imports" folds into a card whose summary says "1 file"; the list and its Undo are one tap away (opened on this visit, it stays open after an Undo redraws the page) |
| Dana's Prairie file, checking guessed | 1/1/1/2/16/228, 2.1 (3.5) | 1/1/1/3/6/119, 1.3 (2.0) | the three tiles (new, already on file, could not be read), money in / money out and the first six lines go behind "See the lines", whose summary says "10 new" (or "8 new · 2 already on file · 1 could not be read"); "the file covers to ..." moved in with them; the first line is shorter ("Checking ending 7351 (Prairie Bank): 10 transactions, 10/20/2026 to 11/10/2026. Nothing to set up; the account number is not kept.") |
| Jamie's card file, no card on the plan | 1/1/0/1/11/156, 1.5 (2.3) | 1/1/0/2/6/116, 1.2 (1.8) | the file's first lines behind "See the lines" ("5 transactions"); "You have no card on your plan yet" and "Add this card" stay first |
| Riley's card file, three cards | 0/5/0/1/11/152, 1.5 (2.5) | 0/5/0/2/6/112, 1.2 (2.0) | the same; the three card chips and "It is not on my plan yet" stay open (the question is the screen) |
| the family's Prairie file (another bank) | 0/4/0/1/12/167, 1.6 (2.6) | 0/4/0/2/7/126, 1.3 (2.1) | the same; the amber "This file is from Prairie Bank; Chase checking is at Chase" stays open |
| opened for the Visa card, a checking file | 0/4/0/2/12/174, 1.7 (2.8) | 0/4/0/3/7/133, 1.4 (2.3) | the same; the fold that holds "Bring it in to Visa card anyway" was a second "More options" on the screen: now named for what it holds, "It does belong on Visa card" |
| a card in credit (M11) | 1/1/1/1/13/204, 1.7 (2.9) | 1/3/0/2/8/144, 1.3 (2.1) | the tick box became the question "Is that what you owe, or a credit?" with two chips (M11, money first, never folded); the lines behind "See the lines" |
| a file cut short | 1/1/0/2/13/203, 1.9 (3.2) | 1/1/0/3/6/123, 1.3 (2.1) | the lines behind "See the lines"; the amber "This file looks cut short" stays open, above everything |
| a file with two accounts | 1/1/2/2/11/203, 1.8 (3.0) | 1/1/2/3/6/142, 1.4 (2.2) | the lines behind "See the lines"; "This file holds 2 accounts. Bring in [box]" stays (it decides what is brought in) |
| a CSV | 1/1/1/2/15/253, 2.2 (3.6) | 1/1/1/3/3/99, 1.1 (1.8) | the "10 rows. Columns found: ..." line goes inside "Columns worked out for you. Change them"; the tiles, the days the file covers, the totals and the first rows behind "See the lines"; rows that could not be read are said in that fold's summary and open it |

Kept, nothing removed: every tile, total, line, column choice, Undo and "bring it in anyway" is still there, one tap
away. Open where it matters: a warning (cut short, another bank, another kind of account, lines that could not be read),
the account question, the balance choice above the Import button, and the card-in-credit question.

## What only the real iPhone can show

Only Chromium is installed. On the phone: the folds' open/close tap and their 44 px summary rows in Safari; that a fold
stays open after "Use it" or an Undo redraws the page; the "See the lines" summary at 320 px with Dynamic Type larger.

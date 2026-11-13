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
worktree. Pictures: `fix2/shots/before-*` and `after-*` (`-390`, `-390-dark`, `-320`, `-320-dark`, and `-390-full`).
All paths are under `$SP/rv/doc/`.

PLACEHOLDER_COUNTS

# Track "doc" (L7 d7be064, L8 257e754 on 707355c): recheck of the final skeptic's four findings, 2026-11-13

I ran my own detached copy of the track's tip 257e754 (`rv/v-doc-fin2`, removed at the end). I served it on ports 9731-9739,
in the sandbox only, with the kit's Chromium in iPhone emulation and real touch taps. Files went in through the real file
chooser after a tap on "Choose the file"; stubs were pasted with `insertText`. Every server was stopped by the kit's `stop()`,
all nine ports answer nothing now, and no process was killed by pattern. I only read the builder's worktree (`rv/b-doc`): it is
still at 257e754 and clean.

Everything I wrote is under
`$SP/rv/doc/fin2/` (called fin2/ below):
- `walk/mine.mjs`: my own walk of F1-F4 (written for this recheck, not the fixer's `rp.mjs`). Logs `mine-F1.json`,
  `mine-390.json`, `mine-F2-F3-F4-390-dark_320_320-dark.json`; pictures in `shots/`.
- `walk/f1pure.mjs`: F1 on the five phone-built plans and six edge stubs, straight against `compute()`.
- The earlier skeptic's walks pointed at my copy: `walk/{i1,i2,i3,r1,r2,r3,w320}.mjs`, output and 203 pictures in `reg/`,
  run log `walks.log`.
- `npmtest.txt`: the whole `npm test`.

## Verdict

All four findings are **closed**. I found no regression on the walked screens. Nothing is left open.

## F1 (L7): a 401(k) line printed as 0.00 this paycheck: CLOSED

**Pure** (`walk/f1pure.mjs`, the finding's stub `casey-ytd-only.txt`, "401(k) 0.00 1,200.00"):
- Jamie (noMatch, $250 a month): `noPlanLine = { onFile: 3000, zeroLine: true, sides: ["later"], ytd: 1200 }`, with one
  `set` change (row `setup-contrib-setup-self`, amount 0, monthly).
- Casey (noContrib) and Morgan (renter): `onFile: 0`, `set: []`.
- Dana ($400 a month, match 2,400), Lee ($150) and Robin ($600, match 2,760) each get their own row in `set`, with the match
  kept in `before`.
- Edge stubs:
  - a match line beside the 0.00 line, a "Current YTD" heading, "-0.00", the stub pasted on one line, and no frequency:
    all still give the zero card;
  - a lone "Roth 401(k) 0.00": `sides: ["now"]`, `ytd: null`, nothing to set.
- After "Set it to $0" only that row's amount changed (period and match kept, the rest of the plan identical). Read again,
  the stub gives `onFile: 0` and nothing to set.

**On screen** (`mine-F1.json`; 390, 390-dark, 320, 320-dark; three households):
- **Jamie:** "Jamie's 401(k)" is the first card, outside every fold: "This pay stub shows $0.00 going into the 401(k) this
  paycheck ($1,200.00 so far this year); the plan says $3,000 a year. If you stopped, change it on What you save for
  retirement ›, or set it to $0 here." It is amber and has an outlined "Set it to $0".
  - The only filled button is "Use it" on "Jamie's pay".
  - After the tap the plan holds 0 monthly on that row, and nothing else in the plan changed (`restSame: true`).
  - The card reads "Was: $250.00 every month ($3,000 a year). Now: $0." with a green note, then "See if the money lasts ›".
  - Read again on a new visit: "... That matches what is on file ($0)."
- **Casey:** "This pay stub shows $0.00 going into the 401(k) this paycheck ($1,200.00 so far this year). That matches what
  is on file ($0)." It has the outlined "See what putting some in would do ›". The filled button is on the tax card.
- **Dana** (couple2k): picked by the "Whose" chip, as a person would. She gets the amber card. After "Set it to $0" the note
  adds "The employer's match on file, $2,400 a year, stays: change it there if it stopped too." Her row holds 0 with
  match 2,400, and Lee's row is untouched.
- In every view the width is equal to the screen (320 at 320), there are no page errors, and opening or closing each of
  the three folds left the plan unchanged.
- Pictures read: `shots/F1-noMatch-390.png`, `F1-noMatch-set0-390.png`, `F1-noMatch-320-dark.png`,
  `F1-couple2k-set0-320-dark.png`.
- The earlier skeptic's `r2.mjs` (`reg/r2-390.json`, `reg/r2-320-dark.json`, zeroLine-*) shows the same.
- Tests: the three new F1 tests pass (reader 31 of 31).

## F2 (L8): "See the lines" running off a 320 px screen: CLOSED

Steps: Dana (couple2k), then Prairie7351_Activity.qfx imported, then back to Import, then `Prairie_mix.qfx` and
`Prairie_oddlines.qfx` (`mine-*.json`, all four views).

| | title (left..right) | status | chevron | card | inner / scroll / visual width |
|---|---|---|---|---|---|
| 320 | 31..124, 1 line | 134..271, 3 lines | 281..289 | 14..306 | 320 / 320 / 320 |
| 390 | 31..124, 1 line | 134..341, 2 lines | 351..359 | 14..376 | 390 / 390 / 390 |

- The table holds whether the fold is closed, open, or every fold on the page is open, in light and dark.
- The CSV's own "See the lines 4 new · 6 could not be read" (family, chase-checking.csv, day/month/year): at 320 the title
  is one line and the status two, inside the card.
- The new columns summary "Columns: changed by you · dates day/month/year" takes two lines each side at 320, also inside.
- `w320.mjs` (`reg/w320.out`): all nine screens give 320/320/320, closed and all-open, including "import mix" and "odd lines
  only".
- Pictures read: `shots/F2-Prairie_mix-320.png` (status in three short lines, chevron visible), `F2-Prairie_mix-390.png`,
  `reg/i2-mix-320-dark.png`.

## F3 (L7): "Ask the AI to find the rest" closing its fold: CLOSED

Steps: Casey (noContrib), `#/ai/reader?kind=paystub&view=build`, paste, Read it, open "What the app read on it", then tap
"Ask the AI to find the rest" (`mine-*.json` F3-none and F3-ok; all four views).

- **No AI here:**
  - The fold stays open. Its summary reads "5 of 9, the AI did not answer".
  - A red notice in view under the button says "The AI is not available: Failed to fetch. Settings has the AI connection."
    It is in innerText, not only in textContent.
  - The plan is unchanged and the width stays 320 at 320.
  - Closed by hand, the summary still says "the AI did not answer". After a "Use it" elsewhere redraws the page, the fold
    the person closed stays closed, and its summary still tells.
- **A stand-in answer at the AI's address:**
  - "The AI found 2 more. Check them against the document." shows in view.
  - The summary reads "7 of 9, 2 from the AI", closed or open.
- The earlier skeptic's own `r3.mjs` (`reg/r3-390.out`, `reg/r3-320-dark.out`): the fold is open with the note, the visible
  notice is "error: The AI is not available ...", and the plan is unchanged.
- The only console error is the refused connection to the AI's address, which is expected with no AI.
- Pictures read: `shots/F3-none-390.png`, `F3-none-320-dark.png`.

## F4 (L8): a CSV column changed by hand folded away under a stale summary: CLOSED

Steps: family plan, Import, `qa/fixtures/chase-checking.csv`, open the columns fold, "Date order" set to day/month/year
(`mine-*.json` F4; all four views).

- **After the change:**
  - The fold stays open and reads "Columns: changed by you · dates day/month/year".
  - In it, in amber: "With this change, 6 rows could not be read; the app's own choices read every row."
  - It has an outlined "Put back what the app worked out", and "Import 4 transactions" is outlined: no filled button on the
    page.
- **Closed by hand:** the summary still says "changed by you · dates day/month/year".
- **Set back to month/day/year by hand:** "Columns worked out for you. Change them", 10 new, and the filled "Import 10
  transactions" again.
- **Date column set to "Details" (my extra step):** "Columns: changed by you · date column: Details". The fold opens with
  "10 rows could not be read", and no filled button. "Put back what the app worked out" restores 10 new and the filled
  Import.
- **"Amounts look backwards" ticked:** "Columns: changed by you · amounts turned around". Every row still reads, so the
  fold is not forced open and Import stays filled.
- The plan was unchanged throughout, every fold opened and closed with the plan unchanged, and the width is 320 at 320.
- Pictures read: `shots/F4-dmy-390.png`, `F4-dmy-notice-390.png`, `F4-dmy-320-dark.png`, `F4-dmy-notice-320-dark.png`.
- Tests: import 15 of 15, including the new `columnChanges` test.

## Regressions (the same screens as the final review)

- `i1`: Dana's file end to end, with Undo, in all four views. No errors, no sideways scroll, and no fold changed the plan.
- `i2`: nine import screens with every fold opened and closed. No errors or overflow. "visaAsked" now reads "It is my Visa
  card file after all"; I read `reg/i2-visaAsked-fold-320.png`.
- `i3`:
  - P5: "put Checking's balance back to $6,000.00 (11/11/2026)?", and afterwards the plan holds 6000 as of 11-11.
  - M11: "I owe $25.17" and "It is a credit", both outlined.
  - N5: the file name shows as `PrairieXXXX_Activity.qfx`.
  - N7: the next-year file gets no balance offer.
  - B3: chips and no filled button.
  - N1: 10 lines on Visa, with Visa's 6,400 untouched.
- `r1`: nine reader screens. I read `reg/r-casey-read-320.png` and `reg/r-casey-used-390-dark.png`.
- `r2`:
  - Lee: Yes and No as before.
  - B7.
  - N8: the text is kept across Back and Forward.
  - Own number, and the "1 more change" fold used from inside.
  - zeroLine: Jamie and Casey.
  - No adult: "Add yourself", the one filled button.
  - The statement path.
- Across all the regression logs: no page errors, no overflow, no fold that changed the plan, and no screen with more than
  one filled button in view.

## Checks

- `npm run registry`: 161 modules, `modules/registry.js` unchanged (`git status` clean).
- Touched modules' tests: `modules/ai/reader`, `modules/transactions/import` and `tests/ofx.test.mjs`, 73 of 73.
- Whole `npm test` (`fin2/npmtest.txt`): 189,460 tests, 188,820 pass, **0 fail**, 3 skipped, 637 todo (610 s). This ran
  under load from my walks, and neither speed test failed this time.
- `npm run check`: OK.
- `node tools/leak-guard.mjs --worktree`: OK, 2,881 files.
- `git diff 707355c HEAD -- tests/golden`: empty.
- Nothing in the out-of-lane list is touched: CHANGELOG.md, docs/TEAM.md, docs/WORKBOARD.md, registry.js, wave 1's files,
  investments/holdings, claude-c's and claude-f's folders.
- Two commits on 707355c, one per L. Each ends with Agent / Co-Authored-By (Claude) / Claude-Session, and L8 has
  "Prompt: quick-ofx-import" just above "Agent:".
- `rv/doc/L7.changelog` and `L8.changelog` describe the $0.00 line and the changed-columns fold.

## Notes (not findings)

- **A lone "Roth 401(k) 0.00" line.** When the plan's money is all in the pay-the-tax-later row, the amber card says "$0.00
  going into the Roth 401(k) ...; the plan says $3,000 a year" and offers no "Set it to $0", because the Roth row holds
  nothing. That is true and harmless, and before the fix this stub got no word at all.
- **The household view.** Routing a stand-in answer to the AI's address did not make "Ask the AI to find the rest" appear
  there. The household view appears to need the PC to say the AI is on, so F3 was walked in the build view, as the finding
  did. The same `fold("found")` code serves both views.

## To try on the real iPhone (only Chromium here)

- **F2:** the "See the lines" summary with three parts, at 320 px and with Dynamic Type larger. It should wrap at the right,
  with the chevron visible and no sideways scroll. Check the same for "Columns: changed by you" and "What the app read on
  it 5 of 9, the AI did not answer".
- **F3:** with the AI really on (PC), "Ask the AI to find the rest" from inside the opened fold on the household view. The
  fold should stay open with the note.
- **F4:** the "Date order" and "Date column" wheels inside the columns fold. After choosing, the fold stays open, and the
  amber note and "Put back what the app worked out" can be reached above the wheel and the keyboard.
- **F1:** a real stub copied from a PDF in Safari with a 0.00 current 401(k) line and a year-to-date figure on one line. A
  double tap on "Set it to $0" should set the row once.
- **From before:**
  - the Files picker (.qfx, .qbo and .ofx not greyed out);
  - windows-1252 text;
  - a tap on the label of the balance tick box;
  - the page scrolling itself to the changes;
  - a double tap on "Use it" and "Import".
